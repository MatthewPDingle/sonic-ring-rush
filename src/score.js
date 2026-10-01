/** Four original scores. Notes are authored here; no recordings or borrowed melodies. */
export const TRACK_SCORES = [
  { name: 'Coastline Carousel', bpm: 132, root: 62, scale: [0,2,4,5,7,9,11], instrument: 'steelpan', swing: .12,
    chords: [[0,4,7,11],[9,12,16,19],[5,9,12,16],[7,11,14,17]],
    a: [4,7,9,7,4,null,2,4,7,null,9,11,9,7,4,null],
    b: [12,null,11,9,7,9,7,4,5,null,9,7,4,2,0,null] },
  { name: 'Amber Expedition', bpm: 114, root: 57, scale: [0,2,3,5,7,8,10], instrument: 'marimba', swing: .04,
    chords: [[0,3,7,10],[8,12,15,19],[5,8,12,15],[7,11,14,17]],
    a: [7,10,12,null,10,7,5,null,3,5,7,10,7,null,3,2],
    b: [12,10,8,7,5,null,7,8,10,null,12,15,12,10,7,null] },
  { name: 'Midnight Circuit', bpm: 140, root: 54, scale: [0,2,3,5,7,8,10], instrument: 'synth', swing: 0,
    chords: [[0,3,7,10],[8,12,15,19],[3,7,10,14],[10,14,17,21]],
    a: [0,null,7,10,12,null,10,7,3,null,7,10,14,12,10,null],
    b: [15,14,12,null,10,12,14,10,8,null,7,5,7,10,12,null] },
  { name: 'Canopy Capers', bpm: 126, root: 60, scale: [0,2,4,5,7,9,10], instrument: 'steelpan', swing: .16,
    chords: [[0,4,7,10],[5,9,12,16],[9,12,16,19],[7,11,14,17]],
    a: [7,9,7,null,4,5,7,null,9,12,9,7,4,null,2,4],
    b: [12,14,12,9,7,null,9,7,5,9,12,null,11,9,7,null] },
];
export const midiHz = midi => 440 * 2 ** ((midi - 69) / 12);

export function arrangement(bar) {
  const b = ((bar % 64) + 64) % 64;
  if (b < 4) return 'intro';
  if (b < 16) return 'a';
  if (b < 24) return 'b';
  if (b < 32) return 'break';
  if (b < 48) return 'reprise';
  return 'finale';
}

/** Deterministic musical event generator, shared by realtime and offline rendering. */
export function scoreEvents(track, step, intensity = 0) {
  const tune = TRACK_SCORES[Math.max(0, Math.min(3, track | 0))];
  const bar = Math.floor(step / 16), tick = ((step % 16) + 16) % 16;
  const section = arrangement(bar), events = [];
  const beat = 60 / tune.bpm, chord = tune.chords[Math.floor(bar / 2) % 4];
  const add = (voice, midi, duration, velocity, offset = 0, pan = 0) => events.push({ voice, midi, duration, velocity, offset, pan });
  const intro = section === 'intro', quiet = section === 'break';
  const full = ['b','reprise','finale'].includes(section);
  const swing = tick % 2 ? tune.swing * beat / 4 : 0;
  if (tick === 0 && bar % 2 === 0) {
    chord.forEach((note, i) => add('pad', tune.root + note + 12, beat * 7.7, quiet ? .05 : .042, 0, (i - 1.5) * .24));
  }
  const island = track === 0 || track === 3;
  const bassTicks = island ? [0,3,6,8,10,14] : [0,4,8,12,3,10,14];
  if (bassTicks.includes(tick) && (!intro || tick % 4 === 0)) {
    const bassDegree = island ? ([3,10].includes(tick) ? chord[2] : tick === 6 ? chord[0]+12 : tick === 14 ? chord[1] : chord[0])
      : tick === 10 ? chord[2] : tick === 14 ? chord[1] : chord[0];
    add('bass', tune.root - 24 + bassDegree, beat * (tick % 4 ? .38 : .66), quiet ? .12 : .17, swing);
  }
  // Kick/snare arrangements differ: jungle syncopation, neon four-on-floor, coastal backbeat.
  const kick = track === 3 ? [0,6,8,11] : track === 1 ? [0,7,8] : track === 2 ? [0,4,8,12] : [0,6,8,10];
  if ((!quiet || bar % 2 === 0) && kick.includes(tick)) add('kick', 0, .32, intro ? .2 : .32);
  if (!intro && !quiet && [4,12].includes(tick)) add('snare', 0, .22, island ? .09 : .16);
  if (!quiet && tick % (intro ? 4 : 2) === 0) add(tick === 14 && full ? 'openhat' : 'hat', 0, .08, tick % 4 ? .04 : .065, swing, tick % 4 ? .35 : -.3);
  if (island && tick % 2) add('shaker', 0, .07, intro ? .024 : .043, swing, -.45);
  if (island && !quiet) {
    if ((bar % 2 === 0 ? [0,6,12] : [4,8]).includes(tick)) add('clave', 0, .075, intro ? .035 : .052, swing, .3);
    if ([3,7,10,15].includes(tick)) add('conga', tick === 10 ? 57 : 50, .19, intro ? .05 : .095, swing, tick < 8 ? -.35 : .35);
  }
  if (track === 1) {
    if (!quiet && [3,7,10,15].includes(tick)) add('tom', tick === 10 ? 54 : 47, .19, .085, swing, tick < 8 ? -.35 : .35);
  }
  const fill = bar % 8 === 7 && tick >= 12 && !quiet;
  if (fill) add('tom', 54 - (tick - 12) * 2, .19, .09 + (tick - 12) * .01, swing, -.45 + (tick - 12) * .3);
  if (tick === 0 && [4,16,32,48].includes(bar % 64)) add('crash', 0, .8, .08);
  // Sixteen eighth-note phrases with a response; avoid mechanically repeating one bar.
  if (tick % 2 === 0 && !intro && !quiet) {
    const phrase = section === 'b' || (section === 'finale' && bar % 8 >= 4) ? tune.b : tune.a;
    const phraseIndex = (bar % 2) * 8 + tick / 2;
    let note = phrase[phraseIndex];
    if (note !== null) {
      // Last two bars in an eight-bar phrase climb, then resolve into the next chord.
      const shift = bar % 8 >= 6 && !(bar % 8 === 7 && tick === 14) ? (track === 1 || track === 2 ? 3 : 5) : 0;
      const end = tick >= 12 && bar % 2 === 1;
      if (bar % 8 === 7 && tick === 14) note = chord[0] + 12;
      const register = island || track === 1 ? 0 : 12;
      add(tune.instrument, tune.root + note + register + shift, beat * (end ? .95 : island ? .7 : .43), island ? .16 : .12, swing, -.08);
      if (full && tick === 6 && bar % 2 === 0) add(tune.instrument, tune.root + note + register + 12, beat * .38, .04, beat * .29, .35);
    }
  }
  // Steel drums announce the island tracks immediately, before the full melody enters.
  if (intro && island && [0,3,6,10].includes(tick)) {
    const note = chord[[2,1,3,2][[0,3,6,10].indexOf(tick)]];
    add('steelpan', tune.root + note, beat * .78, .115, swing, -.12);
  }
  // An answering arpeggio enters later; the break deliberately gives the lead a rest.
  if ((full || quiet || (intro && bar >= 2)) && [1,5,9,13].includes(tick)) {
    const degree = chord[(Math.floor(tick / 4) + bar) % 4];
    add(track === 2 ? 'bell' : 'marimba', tune.root + 12 + degree, beat * .42, quiet ? .065 : .045, swing, .38);
  }
  if (intensity > .5 && !quiet && tick % 2 === 1) add('shaker', 0, .06, .026, swing, .5);
  return events;
}

export function createAudioGraph(context, destination = context.destination) {
  const master = context.createGain(), compressor = context.createDynamicsCompressor();
  master.gain.value = .76;
  compressor.threshold.value = -15; compressor.knee.value = 12; compressor.ratio.value = 3;
  compressor.attack.value = .005; compressor.release.value = .14;
  master.connect(compressor).connect(destination);
  const music = context.createGain(), sfx = context.createGain(), ambience = context.createGain();
  music.gain.value = .75; sfx.gain.value = .8; ambience.gain.value = .12;
  music.connect(master); sfx.connect(master); ambience.connect(master);
  const musicReverb = context.createConvolver(), sfxReverb = context.createConvolver();
  const musicWet = context.createGain(), sfxWet = context.createGain();
  const impulse = context.createBuffer(2, Math.floor(context.sampleRate * .48), context.sampleRate);
  let seed = 713;
  for (let channel = 0; channel < 2; channel++) {
    const samples = impulse.getChannelData(channel);
    for (let i = 0; i < samples.length; i++) {
      seed = (seed * 16807) % 2147483647;
      samples[i] = (seed / 1073741824 - 1) * (1 - i / samples.length) ** 3 * .33;
    }
  }
  musicReverb.buffer = impulse; sfxReverb.buffer = impulse;
  musicWet.gain.value = .16; sfxWet.gain.value = .16;
  // Both wet returns enter their own volume-controlled bus, so a zero slider is silent.
  musicReverb.connect(musicWet).connect(music); sfxReverb.connect(sfxWet).connect(sfx);
  return { master, music, sfx, ambience, reverb:musicReverb, musicReverb, sfxReverb, compressor,
    dispose() { [master,music,sfx,ambience,musicReverb,sfxReverb,musicWet,sfxWet,compressor].forEach(node => node.disconnect()); } };
}

export class Synth {
  constructor(context, reverb = null) {
    this.context = context; this.reverb = reverb; this.active = new Set(); this.envelopes = new Set();
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    let seed = 379;
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) { seed = (seed * 16807) % 2147483647; data[i] = seed / 1073741824 - 1; }
    this.noiseBuffer = buffer;
  }

  voice(event, time, destination) {
    const {voice,midi,duration,velocity,pan = 0} = event;
    const context = this.context, envelope = context.createGain(), panner = context.createStereoPanner();
    // A source start and a future automation event can round to adjacent audio
    // samples. Keep the envelope silent before its scheduled attack as well.
    envelope.gain.value = 0;
    this.envelopes.add(envelope);
    panner.pan.value = Math.max(-1,Math.min(1,pan));
    envelope.connect(panner).connect(destination);
    const sources = [], extras = [];
    const register = source => { sources.push(source); this.active.add(source); return source; };
    const noise = () => { const node = register(context.createBufferSource()); node.buffer = this.noiseBuffer; node.loop = true; return node; };
    const osc = (frequency, type = 'sine', amount = 1, detune = 0, partialDecay = 0) => {
      const node = register(context.createOscillator()), gain = context.createGain();
      node.type = type; node.frequency.setValueAtTime(frequency,time); node.detune.value = detune;
      gain.gain.setValueAtTime(amount,time);
      if (partialDecay) gain.gain.exponentialRampToValueAtTime(.00001,time+partialDecay);
      node.connect(gain).connect(envelope); extras.push(gain); return node;
    };
    let attack = .004, sustain = .0001, end = duration, volume = velocity;
    const hz = midiHz(midi || 60);
    if (['hat','openhat','shaker','snare','crash','wind','impact'].includes(voice)) {
      const filter = context.createBiquadFilter(); extras.push(filter);
      filter.type = voice === 'wind' || voice === 'impact' ? 'lowpass' : 'highpass';
      filter.frequency.setValueAtTime(voice === 'snare' ? 1400 : voice === 'wind' ? 850 : voice === 'impact' ? 1100 : 6500,time);
      noise().connect(filter).connect(envelope);
      if (voice === 'snare') { osc(180,'triangle',.55); end = .2; }
      if (voice === 'hat') end = .045;
      if (voice === 'openhat') end = .2;
      if (voice === 'crash') { end = .8; filter.frequency.value = 4300; }
      if (voice === 'wind') { attack = .06; filter.frequency.exponentialRampToValueAtTime(2200,time+duration*.4); filter.frequency.exponentialRampToValueAtTime(350,time+duration); }
      if (voice === 'impact') osc(85,'sine',.55).frequency.exponentialRampToValueAtTime(35,time+end);
    } else if (voice === 'kick') {
      const node = osc(150,'sine'); node.frequency.exponentialRampToValueAtTime(43,time+.12); end = .3;
      osc(280,'triangle',.07).frequency.exponentialRampToValueAtTime(60,time+.025);
    } else if (voice === 'tom') {
      const node = osc(hz,'sine'); node.frequency.exponentialRampToValueAtTime(hz*.53,time+duration);
      osc(hz*1.58,'sine',.12); volume *= 1.1;
    } else if (voice === 'conga') {
      const node = osc(hz,'sine',.85); node.frequency.exponentialRampToValueAtTime(hz*.84,time+.075);
      osc(hz*1.52,'sine',.25,0,.08); osc(hz*2.36,'sine',.12,0,.035);
      end = duration; attack = .002;
    } else if (voice === 'clave') {
      osc(2250,'sine',.5,0,.025); osc(3375,'sine',.3,0,.017); end = .06; attack = .001;
    } else if (voice === 'pad') {
      osc(hz,'triangle',.5,-6); osc(hz,'triangle',.5,6); osc(hz*2,'sine',.12);
      attack = .17; sustain = velocity * .8; end = duration + .32;
      if (this.reverb) { const send = context.createGain(); send.gain.value = .5; envelope.connect(send).connect(this.reverb); extras.push(send); }
    } else if (voice === 'bass') {
      osc(hz,'sine',.82); osc(hz*2,'triangle',.18); attack = .006;
    } else if (voice === 'synth') {
      const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = .5;
      filter.frequency.setValueAtTime(1700,time); filter.frequency.exponentialRampToValueAtTime(550,time+duration); extras.push(filter);
      for (const detune of [-5,5]) { const node = register(context.createOscillator()); node.type = 'sawtooth'; node.frequency.value = hz; node.detune.value = detune; const gain = context.createGain(); gain.gain.value = .3; node.connect(gain).connect(filter); extras.push(gain); }
      filter.connect(envelope); osc(hz,'sine',.2);
    } else if (voice === 'steelpan') {
      // Hammered tuned steel: warm body, a struck octave, and briefly ringing
      // inharmonic upper modes. The upper partials decay independently of the body.
      osc(hz,'sine',.86); osc(hz*2,'sine',.34,-4,.17);
      osc(hz*2.97,'sine',.18,3,.105); osc(hz*4.12,'sine',.085,-7,.065);
      osc(hz*5.47,'sine',.045,0,.038); attack = .0025;
      if (this.reverb) { const send = context.createGain(); send.gain.value = .38; envelope.connect(send).connect(this.reverb); extras.push(send); }
    } else if (voice === 'marimba' || voice === 'pan' || voice === 'bell' || voice === 'pluck') {
      osc(hz,'sine',.72); osc(hz*(voice === 'marimba' ? 4 : 2),'sine',voice === 'bell' ? .2 : .14);
      osc(hz*3,'sine',.075);
      if (voice === 'pan') { osc(hz,'sine',.12,9); osc(hz*2,'sine',.08,-12); }
      if (voice === 'pluck') osc(hz,'triangle',.14);
      if (this.reverb) { const send = context.createGain(); send.gain.value = .27; envelope.connect(send).connect(this.reverb); extras.push(send); }
    } else if (voice === 'chirp') {
      const node = osc(hz,'sine',.8); node.frequency.exponentialRampToValueAtTime(hz*1.8,time+duration*.35); node.frequency.exponentialRampToValueAtTime(hz*.7,time+duration);
      osc(hz*2,'sine',.08);
    } else if (voice === 'rise') {
      const node = osc(hz,'triangle',.65); node.frequency.exponentialRampToValueAtTime(hz*3.4,time+duration); osc(hz*2,'sine',.08).frequency.exponentialRampToValueAtTime(hz*6.8,time+duration);
    } else osc(hz,'sine');
    envelope.gain.setValueAtTime(0,time);
    envelope.gain.linearRampToValueAtTime(Math.max(.0001,volume),time+Math.min(attack,end*.25));
    if (sustain) { envelope.gain.linearRampToValueAtTime(sustain,time+Math.min(end*.65,attack+.3)); }
    envelope.gain.exponentialRampToValueAtTime(.00001,time+end);
    let remaining = sources.length;
    sources.forEach(source => {
      source.onended = () => { this.active.delete(source); source.disconnect(); if (--remaining === 0) { this.envelopes.delete(envelope); [envelope,panner,...extras].forEach(node => node.disconnect()); } };
      source.start(time); source.stop(time+end+.015);
    });
  }

  stop() {
    const now = this.context.currentTime;
    this.envelopes.forEach(envelope => {
      if (envelope.gain.cancelAndHoldAtTime) envelope.gain.cancelAndHoldAtTime(now);
      else { envelope.gain.cancelScheduledValues(now); envelope.gain.setValueAtTime(0,now); }
      envelope.gain.linearRampToValueAtTime(.00001,now+.025);
    });
    this.active.forEach(source => { try { source.stop(now+.03); } catch {} }); this.active.clear();
  }
}

export function scheduleScore(context, {track = 0, duration = 30, destination, reverb, intensity = 0, startTime = 0, includeAmbience = false} = {}) {
  const graph = destination ? null : createAudioGraph(context), bus = destination || graph.music;
  const synth = new Synth(context, reverb || graph?.reverb);
  const tune = TRACK_SCORES[Math.max(0,Math.min(3,track|0))], interval = 60/tune.bpm/4;
  for (let step = 0; step*interval < duration; step++) {
    for (const event of scoreEvents(track,step,intensity)) synth.voice(event,startTime+step*interval+event.offset,bus);
  }
  if (includeAmbience && graph) {
    for (let time = 0; time < duration; time += 4) synth.voice({voice:'wind',midi:0,duration:3.8,velocity:track === 2 ? .013 : .022,pan:-.35},startTime+time,graph.ambience);
  }
  return { synth, graph, bpm: tune.bpm, bars: 64, seconds: 64*4*60/tune.bpm };
}
