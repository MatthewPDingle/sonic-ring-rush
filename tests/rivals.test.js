import test from 'node:test';
import assert from 'node:assert/strict';
import { Race } from '../src/race.js';
import { createWorld } from '../src/world.js';

globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {} }) }) };
function start(options) {
  const race = new Race(options); race.start();
  for (let i = 0; i < 12; i++) race.step(.25);
  return race;
}
function run(race, seconds, dt = 1 / 120) {
  for (let t = 0; t < seconds - 1e-9; t += dt) race.step(Math.min(dt, seconds - t));
}

test('rivals chase real course rings, boost pads and jumps, with independent progress on all four worlds', () => {
  for (let track = 0; track < 4; track++) {
    const world = createWorld(track);
    try {
      const race = start({ length: world.length, items: world.items, loops: world.loops, halfWidth: world.halfWidth, difficulty: 'normal', autoAccelerate: false });
      run(race, 22);
      for (const rival of race.rivals) {
        assert.ok(rival.stats.rings > 15, `${track}: ${rival.name} collects course rings`);
        assert.ok(rival.stats.pads > 0, `${track}: ${rival.name} uses a boost pad`);
        assert.ok(rival.stats.boosts > 0 && rival.boost >= 0 && rival.boost <= 100);
        assert.ok(rival.stats.jumps > 0, `${track}: ${rival.name} jumps actual obstacles`);
        assert.ok(rival.s > 800 && rival.s !== race.player.s);
        assert.ok(Math.abs(rival.offset) <= world.halfWidth - .65);
      }
      assert.ok(Math.max(...race.rivals.map(r => r.s)) - Math.min(...race.rivals.map(r => r.s)) > .01, 'rivals have independent progress');
      assert.ok(world.items.filter(i => i.type === 'ring').every(i => !i.collected), 'AI pickups leave Sonic his own rings');
    } finally { world.dispose(); }
  }
});

test('rival boost spends finite charge and stops after its chosen burst', () => {
  const race = start({ difficulty: 'normal', autoAccelerate: false });
  const rival = race.rivals[0];
  while (!rival.boosting) race.step(1 / 120);
  const charge = rival.boost, speed = rival.speed;
  run(race, .7);
  assert.ok(rival.boost < charge - 15 && rival.speed > speed + 10);
  run(race, 1.5); assert.equal(rival.boosting, false);
});

test('a rival caught by a sudden obstacle loses rings, slows down and recovers', () => {
  const race = start({ autoAccelerate: false, items: [{ type: 'hazard', s: .001, lane: -3.3 }] });
  const rival = race.rivals[0]; rival.rings = 14; rival.speed = 50;
  race.step(1 / 120);
  assert.equal(rival.rings, 4);
  assert.equal(rival.stats.hits, 1);
  assert.ok(rival.speed < 30 && rival.invulnerable > 1);
  run(race, 4);
  assert.ok(rival.speed >= rival.baseSpeed && rival.invulnerable === 0);
});

test('rival pad and spring crossings produce real acceleration and airborne movement', () => {
  for (const type of ['boost', 'spring']) {
    const race = start({ autoAccelerate: false, items: [{ type, s: .001, lane: -3.3 }] });
    const rival = race.rivals[0]; rival.speed = 50;
    race.step(1 / 120);
    if (type === 'boost') { assert.equal(rival.stats.pads, 1); assert.ok(rival.speed >= 76); }
    else { assert.equal(rival.stats.springs, 1); run(race, .2); assert.ok(rival.y > 2); }
  }
});

test('rival item pickups reset each lap and cannot repeatedly farm a crossed ring', () => {
  const race = start({ length: 220, autoAccelerate: false, items: [{ type: 'ring', s: 30, lane: -4 }] });
  const rival = race.rivals[0];
  while (rival.s < 45) race.step(1 / 120);
  assert.equal(rival.stats.rings, 1);
  run(race, .2); assert.equal(rival.stats.rings, 1);
  while (rival.s < 265) race.step(1 / 120);
  assert.equal(rival.stats.rings, 2);
  assert.equal(race.player.rings, 0);
});

test('rival routes, pickups and boost decisions remain deterministic across frame rates', () => {
  const world = createWorld(3);
  try {
    const make = () => start({ length: world.length, items: world.items.map(({type,s,lane,...rest}) => ({type,s,lane,phase:rest.phase,swayAmplitude:rest.swayAmplitude,swayFrequency:rest.swayFrequency})), loops: world.loops, difficulty: 'normal', seed: 77, autoAccelerate: false });
    const a = make(), b = make(); run(a, 25, 1 / 30); run(b, 25, 1 / 120);
    for (let i = 0; i < 3; i++) {
      assert.ok(Math.abs(a.rivals[i].s - b.rivals[i].s) < .001);
      assert.deepEqual(a.rivals[i].stats, b.rivals[i].stats);
    }
  } finally { world.dispose(); }
});
