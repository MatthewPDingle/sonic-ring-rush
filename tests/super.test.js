import test from 'node:test';
import assert from 'node:assert/strict';
import { Race } from '../src/race.js';

const bird = { id: 'canopy', s: 160, side: 1, knockDirection: -1, warningDistance: 90, attackDuration: 1.4 };
function ready(options = {}) {
  const race = new Race({ length: 500, parrots: [bird], ...options });
  race.start();
  for (let i = 0; i < 12; i++) race.step(0.25);
  return race;
}
function advance(race, seconds, input = {}, dt = 1 / 120) {
  const events = [];
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    race.step(Math.min(dt, seconds - t), typeof input === 'function' ? input(race) : input);
    events.push(...race.events.map(event => ({ ...event, time: race.time, s: race.player.s })));
  }
  return events;
}

test('a boosting player gets a locked lane warning before the bird meets the track', () => {
  const race = ready(); race.player.rings = 12;
  const events = advance(race, 4, { boost: true });
  const warning = events.find(event => event.type === 'parrotWarning');
  const swoop = events.find(event => event.type === 'parrotSwoop');
  const hit = events.find(event => event.type === 'parrotHit');
  assert.ok(warning && swoop && hit);
  assert.ok(hit.time - warning.time >= 0.8);
  assert.ok(warning.time < swoop.time && swoop.time < hit.time);
  assert.equal(warning.lane, 0);
  assert.equal(race.player.rings, 7);
  assert.ok(Math.abs(hit.s - bird.s) < 0.7);
});

test('steering after the warning and jumping at the crossing both evade swoops', () => {
  const dodged = ready(); dodged.player.rings = 10;
  const dodgeEvents = advance(dodged, 5, race => ({ steer: race.parrots[0].lastAttackLap ? 1 : 0 }));
  assert.ok(dodgeEvents.some(event => event.type === 'parrotWarning'));
  assert.ok(!dodgeEvents.some(event => event.type === 'parrotHit'));
  assert.equal(dodged.parrots[0].targetOffset, 0, 'the bird cannot retarget a successful dodge');
  assert.equal(dodged.player.rings, 10);
  const jumped = ready(); jumped.player.rings = 10;
  const jumpEvents = advance(jumped, 5, race => ({ jump: race.player.s >= bird.s - 21 && race.player.s < bird.s + 2 }));
  assert.ok(jumpEvents.some(event => event.type === 'jump'));
  assert.ok(!jumpEvents.some(event => event.type === 'parrotHit'));
  assert.equal(jumped.player.rings, 10);
});

test('parrot approach progress reaches the collision point at the swept crossing', () => {
  const race = ready();
  while (race.player.s < bird.s) {
    race.step(1 / 120);
    if (race.events.some(event => event.type === 'parrotHit')) {
      assert.equal(race.parrots[0].phase, 'swooping');
      assert.ok(Math.abs(race.parrots[0].progress - 0.5) < 0.01);
      assert.equal(race.parrots[0].impactProgress, 0.5);
      return;
    }
  }
  assert.fail('expected a collision');
});

test('easy parrot knocks are bounded, recoverable, and milder than normal', () => {
  const easy = ready(); const normal = ready({ difficulty: 'normal' });
  for (const race of [easy, normal]) {
    race.player.rings = 20;
    while (race.player.s < bird.s) race.step(1 / 120);
    assert.ok(race.player.knockVelocity < 0);
    advance(race, 3);
    assert.ok(race.player.offset >= -race.halfWidth + 0.65);
    assert.ok(race.player.offset <= race.halfWidth - 0.65);
    assert.equal(race.player.knockVelocity, 0);
    assert.ok(race.player.speed >= 51.9);
  }
  assert.equal(easy.player.rings, 15);
  assert.equal(normal.player.rings, 12);
  assert.ok(Math.abs(easy.player.offset) < Math.abs(normal.player.offset));
  advance(normal, 1, { steer: 1 });
  assert.ok(normal.player.offset > 0, 'steering recovers from the shove');
});

test('pause freezes bird flight and restart copies clean descriptor state', () => {
  const descriptors = [{ ...bird }];
  const race = ready({ parrots: descriptors });
  while (race.parrots[0].phase !== 'swooping') race.step(1 / 60);
  race.togglePause();
  const snapshot = JSON.stringify([race.parrots, race.player, race.time]);
  advance(race, 5, { boost: true, steer: 1 });
  assert.equal(JSON.stringify([race.parrots, race.player, race.time]), snapshot);
  race.resume(); advance(race, 0.1);
  assert.notEqual(JSON.stringify([race.parrots, race.player, race.time]), snapshot);
  const restarted = ready({ parrots: descriptors });
  assert.equal(restarted.parrots[0].phase, 'perched');
  assert.equal(restarted.parrots[0].lastAttackLap, 0);
  assert.equal(descriptors[0].phase, undefined);
});

test('each bird attacks once per lap, including after slowing through its approach', () => {
  const race = ready({ length: 300 });
  const events = advance(race, 50, r => ({ brake: r.player.s > 90 && r.player.s < 130 }));
  assert.equal(race.state, 'finished');
  assert.equal(events.filter(event => event.type === 'parrotWarning').length, 2);
  assert.equal(events.filter(event => event.type === 'parrotSwoop').length, 2);
  assert.equal(race.parrots[0].lastAttackLap, 2);
  assert.equal(race.parrots[0].lap, 2);
});

test('loops hold the ground and maintain progress even with braking and held jumping', () => {
  const race = ready({ length: 250, parrots: [], loops: [{ start: 30, end: 190, name: 'Canopy Loop' }] });
  const events = advance(race, 30, { brake: true, jump: true });
  assert.equal(race.state, 'finished');
  assert.equal(race.player.s, 500);
  assert.equal(events.filter(event => event.type === 'loopEnter').length, 2);
  assert.equal(events.filter(event => event.type === 'loopExit').length, 2);
  assert.equal(events.filter(event => event.type === 'jump').length, 1, 'holding jump through a loop never creates another jump');
  const grounded = ready({ loops: [{ start: 0, end: 490 }], parrots: [] });
  for (let frame = 0; frame < 120; frame++) {
    grounded.step(1 / 60, { brake: true, jump: frame % 2 === 0 });
    assert.equal(grounded.player.y, 0);
    assert.equal(grounded.player.vY, 0);
    assert.ok(grounded.player.speed >= 40);
    assert.ok(grounded.player.loopProgress > 0);
  }
  advance(grounded, 4);
  assert.ok(grounded.rivals.some(rival => rival.inLoop));
  grounded.rivals.filter(rival => rival.inLoop).forEach(rival => assert.equal(rival.y, 0));
});

test('logs require a jump and moving pendulums collide at their simulated swing lane', () => {
  const log = ready({ parrots: [], items: [{ type: 'log', s: 28, lane: 0 }] });
  log.player.rings = 15; advance(log, 1.7);
  assert.equal(log.player.rings, 5);
  const jumpedLog = ready({ parrots: [], items: [{ type: 'log', s: 28, lane: 0 }] });
  jumpedLog.player.rings = 15; advance(jumpedLog, 1);
  advance(jumpedLog, 0.7, { jump: true });
  assert.equal(jumpedLog.player.rings, 15);
  const collisionTime = Math.sqrt(28 / 11); // Initial 22 m/s² acceleration, before top speed.
  const pendulum = { type: 'pendulum', s: 28, lane: 0, swayAmplitude: 5, swayFrequency: 1.5, phase: Math.PI / 2 - collisionTime * 1.5 };
  const clear = ready({ parrots: [], items: [{ ...pendulum }] }); clear.player.rings = 15;
  advance(clear, 1.7); assert.equal(clear.player.rings, 15, 'the pendulum is away from the middle lane');
  const hit = ready({ parrots: [], items: [{ ...pendulum }] }); hit.player.offset = 5; hit.player.rings = 15;
  advance(hit, 1.7); assert.equal(hit.player.rings, 5, 'the moving mesh lane is the collision lane');
});

test('super simulation remains deterministic across render frame rates', () => {
  const options = { loops: [{ start: 200, end: 350 }], items: [{ type: 'pendulum', s: 400, lane: 0, phase: 0.8 }] };
  const a = ready(options); const b = ready({ ...options, items: options.items.map(item => ({ ...item })) });
  advance(a, 9, { boost: true }, 1 / 30); advance(b, 9, { boost: true }, 1 / 120);
  assert.ok(Math.abs(a.player.s - b.player.s) < 0.001);
  assert.ok(Math.abs(a.player.offset - b.player.offset) < 0.001);
  assert.equal(a.parrots[0].phase, b.parrots[0].phase);
  assert.ok(Math.abs(a.parrots[0].progress - b.parrots[0].progress) < 0.001);
});
