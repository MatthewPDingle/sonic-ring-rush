import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACK_SCORES, arrangement, scoreEvents } from '../src/score.js';
import { sfxEvents, GameAudio } from '../src/audio.js';

test('all four complete original arrangements have variation, bounded event density and finite playable notes', () => {
  const signatures = [];
  for (let track = 0; track < 4; track++) {
    const events = Array.from({length:64*16},(_,step)=>scoreEvents(track,step)).flat();
    assert.ok(events.length > 1500 && events.length < 5000);
    for (let step = 0; step < 64*16; step++) {
      const notes = scoreEvents(track,step);
      assert.ok(notes.length <= 14,'scheduler stays bounded at each subdivision');
      for (const event of notes) {
        assert.ok(Number.isFinite(event.midi) && event.midi >= 0 && event.midi <= 100);
        assert.ok(event.duration > 0 && event.duration < 5);
        assert.ok(event.velocity > 0 && event.velocity <= .4);
        assert.ok(event.offset >= 0 && event.offset < .3);
      }
    }
    const lead = events.filter(event=>event.voice === TRACK_SCORES[track].instrument);
    assert.ok(new Set(lead.map(event=>event.midi)).size >= 12);
    signatures.push(JSON.stringify(events));
    const a = Array.from({length:32},(_,tick)=>scoreEvents(track,4*16+tick)).flat().filter(e=>e.voice === TRACK_SCORES[track].instrument).map(e=>e.midi);
    const b = Array.from({length:32},(_,tick)=>scoreEvents(track,16*16+tick)).flat().filter(e=>e.voice === TRACK_SCORES[track].instrument).map(e=>e.midi);
    assert.notDeepEqual(a,b,'B section is a genuinely different melodic response');
    const breakLead = Array.from({length:8*16},(_,tick)=>scoreEvents(track,24*16+tick)).flat().filter(e=>e.voice === TRACK_SCORES[track].instrument);
    if (TRACK_SCORES[track].instrument !== 'marimba') assert.equal(breakLead.length,0);
  }
  assert.equal(new Set(signatures).size,4);
  assert.deepEqual([0,4,16,24,32,48,64].map(arrangement),['intro','a','b','break','reprise','finale','intro']);
});

test('boost and final-lap percussion adds energy without overwriting melody or harmony', () => {
  for (let track = 0; track < 4; track++) {
    const base = scoreEvents(track,33*16+1,0), intense = scoreEvents(track,33*16+1,1);
    assert.deepEqual(intense.slice(0,base.length),base);
    assert.equal(intense.length,base.length+1);
    assert.equal(intense.at(-1).voice,'shaker');
  }
});

test('island tracks open with warm register steel drums and Caribbean percussion rather than waiting for the A section', () => {
  for (const track of [0,3]) {
    assert.equal(TRACK_SCORES[track].instrument,'steelpan');
    const opening = Array.from({length:32},(_,step)=>scoreEvents(track,step)).flat();
    const pan = opening.filter(e=>e.voice === 'steelpan');
    assert.ok(pan.length >= 8);
    assert.ok(pan.every(e=>e.midi >= 60 && e.midi < 84));
    for (const voice of ['conga','clave','shaker']) assert.ok(opening.some(e=>e.voice === voice));
    const lead = Array.from({length:32},(_,step)=>scoreEvents(track,64+step)).flat().filter(e=>e.voice === 'steelpan');
    assert.ok(lead.every(e=>e.midi < 84));
  }
});

test('essential gameplay effects are distinct; parrot warning precedes a wing effect and scattered rings use stereo', () => {
  const types = ['ring','countdown','go','jump','spring','boost','hit','parrotWarning','parrotSwoop','loopEnter','lap','finish'];
  const signatures = types.map(type=>JSON.stringify(sfxEvents(type)));
  assert.equal(new Set(signatures).size,types.length);
  assert.ok(types.every(type=>sfxEvents(type).length > 0));
  assert.ok(sfxEvents('parrotWarning').every(event=>event.voice === 'chirp'));
  assert.ok(sfxEvents('parrotSwoop').every(event=>event.voice === 'wind'));
  const scattered = sfxEvents('hit').filter(e=>e.voice === 'bell');
  assert.ok(scattered.some(e=>e.pan < 0) && scattered.some(e=>e.pan > 0));
  assert.ok(sfxEvents('finish').some(e=>e.voice === 'pad' && e.duration > 1));
});

test('no-device audio still allows track/settings changes and disposal safely', async () => {
  const audio = new GameAudio();
  audio.setTrack(3); audio.setMode('race'); audio.setVolumes({music:.4,sfx:2});
  audio.setRaceState({lap:2,laps:2,boosting:true}); audio.setPaused(true); audio.setMuted(true);
  audio.play('ring'); audio.update(50,true,.016);
  assert.equal(audio.track,3); assert.equal(audio.volumes.music,.4); assert.equal(audio.volumes.sfx,1);
  assert.equal(await audio.unlock(),false);
  audio.dispose(); audio.dispose();
});
