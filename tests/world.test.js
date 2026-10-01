import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/world.js';
import { Race } from '../src/race.js';

// Rendering is checked in a real browser. The canvas stub lets these tests use
// the shipped courses and their actual item layouts in the pure simulation.
globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {} }) }) };

function finish(world, difficulty, engaged) {
  const race = new Race({ length: world.length, items: world.items, halfWidth: world.halfWidth, difficulty });
  race.start();
  for (let frame = 0; frame < 60 * 100 && race.state !== 'finished'; frame++) {
    const player = race.player, s = player.s % world.length;
    const input = {};
    if (engaged) {
      const ring = world.items.find(item => item.type === 'ring' && item.s > s + 2);
      const lane = ring?.lane ?? 0;
      input.steer = Math.abs(player.offset - lane) > .1 ? Math.sign(lane - player.offset) : 0;
      input.jump = player.y <= .001 && world.items.some(item => item.type === 'hazard' && item.s > s && item.s - s < Math.max(10, player.speed * .22) && Math.abs(player.offset - item.lane) < 2);
      input.boost = true;
    }
    race.step(1 / 60, input);
  }
  assert.equal(race.state, 'finished');
  return race;
}

for (let track = 0; track < 3; track++) {
  test(`world ${track + 1}: safe closed course and fair hazards across all lanes`, () => {
    const world = createWorld(track);
    try {
      assert.ok(world.length > 900 && world.length < 1200);
      assert.ok(world.curve.getPointAt(0).distanceTo(world.curve.getPointAt(1)) < .001);
      const hazards = world.items.filter(item => item.type === 'hazard');
      assert.equal(new Set(hazards.map(item => item.lane)).size, 3);
      for (let i = 1; i < hazards.length; i++) assert.ok(hazards[i].s - hazards[i - 1].s > 80);
      assert.ok(world.items.every(item => item.s > 0 && item.s < world.length && Math.abs(item.lane) < world.halfWidth - 2));
      const springs = world.items.filter(item => item.type === 'spring');
      assert.ok(springs.every(spring => !hazards.some(hazard => hazard.lane === spring.lane && Math.abs(hazard.s - spring.s) < 10)));
    } finally { world.dispose(); }
  });
  test(`world ${track + 1}: easy is forgiving; normal rewards active play`, () => {
    const world = createWorld(track);
    try {
      const easy = finish(world, 'easy', false);
      assert.ok(easy.position <= 2);
      const idle = finish(world, 'normal', false);
      const engaged = finish(world, 'normal', true);
      assert.ok(idle.position > 1, 'Normal must require more than waiting');
      assert.equal(engaged.position, 1, 'Steering, collecting, jumping and boosting can win');
      assert.ok(engaged.time < idle.time * .8);
      assert.ok(engaged.player.rings > 40);
    } finally { world.dispose(); }
  });
}
