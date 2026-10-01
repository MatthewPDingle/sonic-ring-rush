import test from 'node:test';
import assert from 'node:assert/strict';
import { Race, formatTime } from '../src/race.js';
import { GameAudio } from '../src/audio.js';

function go(race) {
  race.start();
  for (let index = 0; index < 12; index++) race.step(0.25);
  assert.equal(race.state, 'racing');
}

function run(race, seconds, input = {}, dt = 1 / 60) {
  for (let time = 0; time < seconds - 1e-9; time += dt) race.step(Math.min(dt, seconds - time), typeof input === 'function' ? input(race) : input);
}

test('countdown, race physics, and timer freeze while paused', () => {
  const race = new Race();
  race.start(); race.step(0.25);
  race.togglePause();
  const countdown = race.countdown;
  run(race, 2, { boost: true, jump: true });
  assert.equal(race.countdown, countdown);
  assert.equal(race.player.s, 0);
  race.resume(); run(race, 2.75);
  assert.equal(race.state, 'racing');
  run(race, 1); race.togglePause();
  const snapshot = JSON.stringify([race.player, race.rivals, race.time]);
  run(race, 2, { steer: 1, boost: true });
  assert.equal(JSON.stringify([race.player, race.rivals, race.time]), snapshot);
  race.togglePause(); run(race, 1);
  assert.ok(race.player.s > 20);
});

test('two laps finish correctly at representative track lengths and difficulties', () => {
  for (const length of [1800, 2100, 2400]) for (const difficulty of ['easy', 'normal', 'challenge']) {
    const race = new Race({ length, difficulty }); go(race);
    run(race, 120);
    assert.equal(race.state, 'finished');
    assert.equal(race.player.s, length * 2);
    assert.equal(race.player.lap, 2);
    assert.ok(race.time > 60 && race.time < 100);
    assert.equal(race.results.length, 4);
    assert.equal(race.results.find(row => row.player).position, race.position);
    assert.deepEqual(race.results.map(row => row.position), [1, 2, 3, 4]);
    assert.deepEqual(race.results.map(row => row.time), race.results.map(row => row.time).sort((a, b) => a - b));
    const time = race.time; race.step(0.25);
    assert.equal(race.time, time);
  }
});

test('rings refill boost once per lap and reset their visible state at lap crossing', () => {
  const item = { type: 'ring', s: 10, lane: 0 };
  const race = new Race({ length: 100, items: [item] }); go(race);
  race.player.boost = 0;
  run(race, 1.2);
  assert.equal(race.player.rings, 1);
  assert.equal(item.collected, true);
  assert.ok(race.player.boost > 6);
  while (race.player.lap === 1) race.step(1 / 120);
  assert.equal(item.collected, false);
  run(race, 0.5);
  assert.equal(race.player.rings, 2);
});

test('jump clears a hazard, grounded hit sheds rings and always recovers', () => {
  const hazard = () => ({ type: 'hazard', s: 28, lane: 0 });
  const grounded = new Race({ items: [hazard()] }); go(grounded); grounded.player.rings = 14;
  run(grounded, 1.7);
  assert.equal(grounded.player.rings, 4);
  assert.ok(grounded.player.invulnerable > 0);
  run(grounded, 3);
  assert.ok(grounded.player.speed > 50);
  const jumping = new Race({ items: [hazard()] }); go(jumping); jumping.player.rings = 14;
  run(jumping, 1);
  jumping.step(1 / 60, { jump: true }); run(jumping, 0.7, { jump: true });
  assert.equal(jumping.player.rings, 14);
  assert.ok(jumping.player.y > 0);
});

test('held jump does not repeatedly jump; releasing then pressing works', () => {
  const race = new Race(); go(race);
  let jumps = 0;
  for (let frame = 0; frame < 180; frame++) { race.step(1 / 60, { jump: true }); jumps += race.events.filter(event => event.type === 'jump').length; }
  assert.equal(jumps, 1); assert.equal(race.player.y, 0);
  race.step(1 / 60, { jump: false }); race.step(1 / 60, { jump: true });
  assert.ok(race.player.vY > 0);
});

test('boost drains charge, increases speed, and bounded steering never leaves the road', () => {
  const race = new Race(); go(race);
  run(race, 1.7, { boost: true, steer: 1 });
  assert.ok(race.player.speed > 60);
  assert.ok(race.player.boost < 30);
  assert.equal(race.player.offset, race.halfWidth - 0.65);
  run(race, 2, { boost: true });
  assert.equal(race.player.boosting, false);
  assert.ok(race.player.boost >= 0);
  run(race, 1, { brake: true }); assert.ok(race.player.speed <= 16);
});

test('boost pads and springs apply visible movement effects', () => {
  const pad = new Race({ items: [{ type: 'boost', s: 10, lane: 0 }] }); go(pad); run(pad, 1.1);
  assert.ok(pad.player.speed > 65);
  const spring = new Race({ items: [{ type: 'spring', s: 10, lane: 0 }] }); go(spring); run(spring, 1.1);
  assert.ok(spring.player.y > 1);
});

test('fixed substeps produce consistent progress across frame rates; huge deltas are capped', () => {
  const a = new Race({ seed: 99 }); const b = new Race({ seed: 99 }); go(a); go(b);
  run(a, 10, { boost: true }, 1 / 30); run(b, 10, { boost: true }, 1 / 120);
  assert.ok(Math.abs(a.player.s - b.player.s) < 0.001);
  assert.ok(Math.abs(a.rivals[0].s - b.rivals[0].s) < 0.001);
  const before = a.player.s; a.step(30); assert.ok(a.player.s - before <= 20);
  a.step(NaN); assert.ok(Number.isFinite(a.player.s));
});

test('finish order uses finish times and deterministic tie breaking', () => {
  const race = new Race();
  race.player.finished = true; race.player.time = 70;
  race.rivals[0].finished = true; race.rivals[0].time = 69;
  race.rivals[1].finished = true; race.rivals[1].time = 70;
  assert.equal(race.position, 2);
  assert.equal(race.results[1].name, 'Sonic');
});

test('manual acceleration is optional and requires explicit throttle', () => {
  const race = new Race({ autoAccelerate: false }); go(race);
  run(race, 1); assert.equal(race.player.s, 0);
  run(race, 1, { accelerate: true }); assert.ok(race.player.s > 10);
});

test('time formatter and audio fallback tolerate unavailable data or browser audio', async () => {
  assert.equal(formatTime(65.129), '1:05.12');
  assert.equal(formatTime(null), '--:--.--');
  const audio = new GameAudio(); audio.setMuted(true); audio.play('ring'); audio.update(52, true, 0.016);
  assert.equal(await audio.unlock(), false); audio.dispose();
});
