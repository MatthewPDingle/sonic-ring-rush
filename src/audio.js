import { TRACK_SCORES, Synth, createAudioGraph, scoreEvents } from './score.js';
export { TRACK_SCORES, scheduleScore, createAudioGraph } from './score.js';

/** Authored tactile effects, shared between live play and OfflineAudioContext audits. */
export function sfxEvents(type) {
  const notes = [];
  const add = (voice,midi,duration,velocity,offset = 0,pan = 0) => notes.push({voice,midi,duration,velocity,offset,pan});
  switch (type) {
    case 'ring':
      add('bell',86,.22,.17,0,-.14); add('bell',93,.3,.12,.045,.22); add('bell',98,.24,.038,.06,.45); break;
    case 'countdown': case 'count':
      add('pluck',72,.18,.2); add('kick',0,.12,.08); break;
    case 'go':
      [72,76,79,84].forEach((midi,i)=>add('pluck',midi,.32,.12,i*.045,(i-1.5)*.18)); add('crash',0,.6,.065); break;
    case 'jump':
      add('rise',52,.19,.12); add('wind',0,.14,.055,0,-.1); break;
    case 'spring':
      add('rise',44,.38,.17); [67,74,79].forEach((midi,i)=>add('pan',midi,.15,.05,i*.075)); break;
    case 'boost': case 'pad':
      add('wind',0,.48,.23); add('rise',40,.32,.075); [60,67,72].forEach((midi,i)=>add('pluck',midi,.2,.06,i*.055)); break;
    case 'hit': case 'parrotHit': case 'ringLoss':
      add('impact',0,.21,.22); add('tom',43,.19,.1);
      [93,86,89,81,86].forEach((midi,i)=>add('bell',midi,.24,.07-i*.007,.035+i*.048,(i%2 ? -1 : 1)*(.15+i*.12))); break;
    case 'parrotWarning':
      [0,.16,.35].forEach((offset,i)=>add('chirp',81+i*2,.11,.135,offset,i%2 ? .25 : -.25)); break;
    case 'parrotSwoop':
      [0,.08,.18].forEach((offset,i)=>add('wind',0,.15,.11+i*.02,offset,-.5+i*.5)); break;
    case 'loopEnter':
      [60,64,67,72,79].forEach((midi,i)=>add('pan',midi,.24,.1,i*.07,(i-2)*.2)); add('wind',0,.6,.09); break;
    case 'loopExit': add('wind',0,.26,.06); break;
    case 'lap':
      [67,72,76,79,84].forEach((midi,i)=>add('pluck',midi,.29,.13,i*.1,(i-2)*.15)); add('crash',0,.7,.05,.15); break;
    case 'finish':
      [72,76,79,84,83,79,81,83,84].forEach((midi,i)=>add('pluck',midi,i === 8 ? 1.35 : .28,.15,i*.17,(i%3-1)*.2));
      [60,64,67,72].forEach((midi,i)=>add('pad',midi,1.6,.065,1.36,(i-1.5)*.25));
      add('snare',0,.2,.09,1.17); add('kick',0,.3,.16,1.36); add('crash',0,.8,.07,1.36); break;
    case 'select': case 'click': add('marimba',79,.095,.1); add('marimba',86,.13,.06,.035); break;
    default: break;
  }
  return notes;
}

export function scheduleSfx(context, {type = 'ring', time = 0, destination, reverb, track = 0} = {}) {
  const graph = destination ? null : createAudioGraph(context), synth = new Synth(context,reverb || graph?.sfxReverb);
  for (const event of sfxEvents(type)) synth.voice(event,time+event.offset,destination || graph.sfx);
  return {synth,graph,track};
}

const normalized = (value, fallback = 1) => Number.isFinite(Number(value)) ? Math.max(0,Math.min(1,Number(value))) : fallback;

export class GameAudio {
  constructor({context = null} = {}) {
    this.context = context; this.graph = null; this.master = null; this.music = null; this.engine = null;
    this.muted = false; this.paused = false; this.track = 0; this.mode = 'menu';
    this.volumes = {music:.75,sfx:.85}; this.raceState = {lap:1,laps:2,boosting:false};
    this._step = 0; this._nextStep = 0; this._lastSound = new Map(); this._disposed = false;
    this._duckUntil = 0; this._nextAmbience = 0; this._gainCache = {}; this._ownsContext = !context;
  }

  async unlock() {
    if (this._disposed) return false;
    try {
      if (!this.context) {
        const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioContext) return false;
        this.context = new AudioContext();
      }
      if (!this.graph) this._initialize();
      if (this.context.state === 'suspended') await this.context.resume();
      if (this._nextStep < this.context.currentTime) this._nextStep = this.context.currentTime + .04;
      this._applyGains();
      return this.context.state === 'running';
    } catch { return false; }
  }

  _initialize() {
    const context = this.context;
    this.graph = createAudioGraph(context); this.master = this.graph.master; this.music = this.graph.music;
    this._musicSynth = new Synth(context,this.graph.musicReverb); this._sfxSynth = new Synth(context,this.graph.sfxReverb);
    this._ambienceSynth = new Synth(context);
    // Air rushing past Sonic, rather than a vehicle-like engine oscillator.
    const wind = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    wind.buffer = this._sfxSynth.noiseBuffer; wind.loop = true;
    filter.type = 'lowpass'; filter.frequency.value = 650; filter.Q.value = .4; gain.gain.value = 0;
    wind.connect(filter).connect(gain).connect(this.graph.sfx); wind.start();
    this.engine = {source:wind,filter,gain};
    this._nextStep = context.currentTime + .04; this._nextAmbience = context.currentTime + 2;
    this._applyGains();
  }

  _target(param,value,name,constant = .05) {
    if (this._gainCache[name] === value) return;
    const initial = this._gainCache[name] === undefined;
    this._gainCache[name] = value;
    if (initial) param.setValueAtTime(value,this.context.currentTime);
    else param.setTargetAtTime(value,this.context.currentTime,constant);
  }

  _applyGains() {
    if (!this.graph) return;
    const now = this.context.currentTime;
    this._target(this.master.gain,this.muted ? 0 : .76,'master');
    const modeGain = this.mode === 'race' ? 1 : this.mode === 'results' ? .42 : .45;
    this._target(this.music.gain,this.volumes.music * modeGain * (this.paused ? .08 : 1) * (now < this._duckUntil ? .38 : 1),'music',.09);
    this._target(this.graph.sfx.gain,this.volumes.sfx,'sfx');
    this._target(this.graph.ambience.gain,this.volumes.music * (this.paused ? .015 : .12),'ambience',.2);
  }

  setMuted(muted) { this.muted = Boolean(muted); this._applyGains(); }
  setPaused(paused) {
    const wasPaused = this.paused; this.paused = Boolean(paused);
    if (wasPaused && !this.paused && this.context) this._nextStep = this.context.currentTime + .04;
    if (this.paused && this.engine) this.engine.gain.gain.setTargetAtTime(0,this.context.currentTime,.04);
    this._applyGains();
  }
  setVolumes(volumes = {}) {
    if (volumes.music !== undefined) this.volumes.music = normalized(volumes.music,this.volumes.music);
    if (volumes.sfx !== undefined) this.volumes.sfx = normalized(volumes.sfx,this.volumes.sfx);
    this._applyGains();
  }
  setTrack(index) {
    const next = Math.max(0,Math.min(3,index|0)); if (next === this.track) return;
    this.track = next; this._step = 0;
    if (this.context) { this._musicSynth?.stop(); this._ambienceSynth?.stop(); this._nextStep = this.context.currentTime+.06; this._nextAmbience = this.context.currentTime+1.5; }
  }
  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = ['menu','race','results'].includes(mode) ? mode : 'menu';
    if (mode === 'race') { this._step = 0; this._musicSynth?.stop(); if (this.context) this._nextStep = this.context.currentTime+.04; }
    this._applyGains();
  }
  setRaceState(state = {}) { Object.assign(this.raceState,state); }

  get diagnostics() {
    return {unlocked:Boolean(this.graph),contextState:this.context?.state || 'unavailable',track:this.track,
      score:TRACK_SCORES[this.track].name,step:this._step,mode:this.mode,muted:this.muted,paused:this.paused,
      musicVolume:this.volumes.music,sfxVolume:this.volumes.sfx,
      activeSources:(this._musicSynth?.active.size || 0)+(this._sfxSynth?.active.size || 0)+(this._ambienceSynth?.active.size || 0)};
  }

  play(type) {
    if (type === 'pause') return this.setPaused(true);
    if (type === 'resume') return this.setPaused(false);
    if (!this.context || this.context.state !== 'running' || !this.graph || this._disposed || this.muted) return;
    const now = this.context.currentTime, cooldown = type === 'ring' ? .035 : type === 'boost' ? .35 : .075;
    if (now-(this._lastSound.get(type) ?? -Infinity) < cooldown) return;
    this._lastSound.set(type,now);
    if (['parrotWarning','finish','lap'].includes(type)) {
      this._duckUntil = Math.max(this._duckUntil,now+(type === 'finish' ? 3 : type === 'lap' ? .9 : .95));
      this._applyGains();
    }
    for (const event of sfxEvents(type)) this._sfxSynth.voice(event,now+.005+event.offset,this.graph.sfx);
  }

  update(speed = 0, boosting = false, dt = 0) {
    if (!this.context || this.context.state !== 'running' || !this.graph || this._disposed) return;
    const now = this.context.currentTime, safeSpeed = Math.max(0,Number(speed)||0);
    if (now >= (this._nextWindUpdate || 0)) {
      this.engine.filter.frequency.setTargetAtTime(450+Math.min(1800,safeSpeed*14),now,.1);
      this.engine.gain.gain.setTargetAtTime(this.paused || this.mode !== 'race' ? 0 : Math.min(1,safeSpeed/50)*(boosting ? .065 : .025),now,.08);
      this._nextWindUpdate = now+.08;
    }
    this._applyGains();
    if (this.paused || this.muted) { this._nextStep = now+.04; return; }
    if (this._nextStep < now-.15) this._nextStep = now+.02;
    const tune = TRACK_SCORES[this.track], interval = 60/tune.bpm/4;
    const intensity = boosting || this.raceState.lap >= this.raceState.laps && this.mode === 'race' ? 1 : 0;
    let scheduled = 0;
    while (this._nextStep < now+.12 && scheduled++ < 8) {
      for (const event of scoreEvents(this.track,this._step,intensity)) this._musicSynth.voice(event,this._nextStep+event.offset,this.music);
      this._step++; this._nextStep += interval;
    }
    if (now >= this._nextAmbience) {
      if (this.track === 0 || this.track === 3) this._ambienceSynth.voice({voice:'wind',midi:0,duration:3.8,velocity:this.track === 0 ? .14 : .08,pan:-.45},now+.01,this.graph.ambience);
      if (this.track === 3 || this.track === 1) this._ambienceSynth.voice({voice:'chirp',midi:this.track === 3 ? 80 : 74,duration:.16,velocity:.075,pan:.6},now+.6,this.graph.ambience);
      if (this.track === 2) this._ambienceSynth.voice({voice:'pad',midi:30,duration:3.8,velocity:.045,pan:0},now+.01,this.graph.ambience);
      this._nextAmbience = now+5.5;
    }
  }

  dispose() {
    if (this._disposed) return; this._disposed = true;
    this._musicSynth?.stop(); this._sfxSynth?.stop(); this._ambienceSynth?.stop();
    if (this.engine) { this.engine.source.stop(); this.engine.source.disconnect(); this.engine.filter.disconnect(); this.engine.gain.disconnect(); }
    this.graph?.dispose();
    if (this._ownsContext && this.context && this.context.state !== 'closed') this.context.close().catch(()=>{});
    this.engine = null; this.graph = null; this.master = null; this.music = null; this.context = null;
  }
}
