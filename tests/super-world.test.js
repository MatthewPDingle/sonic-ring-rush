import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, TRACKS } from '../src/world.js';
import { Race } from '../src/race.js';
import * as THREE from 'three';

globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {} }) }) };

test('decorative loop rocks leave the entire racing corridor and character height clear', () => {
  const world=createWorld(3);
  try {
    world.group.updateMatrixWorld(true);
    const rocks=world.group.getObjectByName('loop-rock-outcrops');assert.ok(rocks);
    rocks.geometry.computeBoundingBox();const matrix=new THREE.Matrix4();
    for(let i=0;i<rocks.count;i++) {
      rocks.getMatrixAt(i,matrix);matrix.premultiply(rocks.matrixWorld);
      const bounds=rocks.geometry.boundingBox.clone().applyMatrix4(matrix).expandByScalar(.75);
      for(let s=0;s<world.length;s+=2) {
        const frame=world.frameAt(s);
        for(const lane of [-8,-6,-4,-2,0,2,4,6,8])for(const height of [.4,1.8,3.4]) {
          const point=frame.position.clone().addScaledVector(frame.right,lane).addScaledVector(frame.up,height);
          assert.equal(bounds.containsPoint(point),false,`Rock ${i} intrudes at distance ${s}, lane ${lane}`);
        }
      }
    }
  }finally{world.dispose();}
});

test('fourth world is larger, closed, and has two real inverted loop surfaces', () => {
  assert.equal(TRACKS.length, 4);
  const world = createWorld(3);
  try {
    assert.ok(world.length > 2800 && world.length < 3400);
    assert.equal(world.loops.length, 2);
    assert.ok(world.curve.getPointAt(0).distanceTo(world.curve.getPointAt(1)) < .001);
    for (let s = 0; s < world.length; s += .5) {
      const frame = world.frameAt(s), next = world.frameAt(s + .01);
      for (const vector of [frame.position, frame.forward, frame.right, frame.up]) assert.ok(vector.toArray().every(Number.isFinite));
      for (const vector of [frame.forward, frame.right, frame.up]) assert.ok(Math.abs(vector.length() - 1) < 1e-6);
      assert.ok(Math.abs(frame.forward.dot(frame.up)) < 1e-6);
      assert.ok(Math.abs(frame.forward.dot(frame.right)) < 1e-6);
      assert.ok(frame.right.clone().cross(frame.up).distanceTo(frame.forward) < 1e-6);
      assert.ok(frame.position.distanceTo(next.position) < .012, 'Arc-length sampling stays continuous at joins');
    }
    for (const loop of world.loops) {
      let minUp = 1, maxHeight = -Infinity;
      for (let i = 0; i <= 120; i++) {
        const frame = world.frameAt(loop.start + (loop.end - loop.start) * i / 120);
        minUp = Math.min(minUp, frame.up.y); maxHeight = Math.max(maxHeight, frame.position.y);
      }
      assert.ok(minUp < -.99, 'Sonic actually goes upside down');
      assert.ok(maxHeight - world.frameAt(loop.start).position.y > 45);
      const points = Array.from({ length: 101 }, (_, i) => world.frameAt(loop.start + (loop.end - loop.start) * i / 100));
      for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
        if ((j-i) * (loop.end-loop.start) / 100 < 40) continue;
        assert.ok(points[i].position.distanceTo(points[j].position) > 20, 'Separate loop passes leave room for the entire road');
      }
    }
  } finally { world.dispose(); }
});

test('new obstacles and visible parrots align with course and remain out of loops', () => {
  const world = createWorld(3);
  try {
    assert.ok(world.parrots.length >= 6);
    for (const type of ['ring', 'log', 'pendulum', 'boost', 'spring']) assert.ok(world.items.some(item => item.type === type));
    for (const item of world.items.filter(item => ['log','pendulum','hazard','spring'].includes(item.type))) {
      assert.ok(world.loops.every(loop => item.s < loop.start - 25 || item.s > loop.end + 25));
    }
    const race = new Race({ length: world.length, loops: world.loops, parrots: world.parrots });
    const bird = race.parrots[0]; bird.phase = 'swooping'; bird.progress = .5; bird.targetOffset = 4;
    world.update(2, 0, race);
    const frame = world.frameAt(bird.worldS);
    const strike = frame.position.clone().addScaledVector(frame.right, 4).addScaledVector(frame.up, 1.4);
    assert.ok(world.parrots[0].mesh.position.distanceTo(strike) < .001, 'Visible bird reaches the physics collision lane');
  } finally { world.dispose(); }
});

test('actual super-track can finish both laps with loop entries and one parrot warning per bird per lap', () => {
  const world = createWorld(3);
  try {
    for (const difficulty of ['easy', 'normal']) {
      const race = new Race({ length: world.length, items: world.items, loops: world.loops, parrots: world.parrots, halfWidth: world.halfWidth, difficulty });
      race.start(); let loops = 0, warnings = 0;
      for (let frame = 0; frame < 60 * 210 && race.state !== 'finished'; frame++) {
        race.step(1 / 60);
        loops += race.events.filter(event => event.type === 'loopEnter').length;
        warnings += race.events.filter(event => event.type === 'parrotWarning').length;
        assert.ok(Math.abs(race.player.offset) <= world.halfWidth-.65+1e-6);
        if (race.player.inLoop) assert.equal(race.player.y, 0);
      }
      assert.equal(race.state, 'finished');
      assert.equal(loops, world.loops.length * 2);
      assert.equal(warnings, world.parrots.length * 2);
      assert.ok(race.time > 100 && race.time < 180);
      assert.equal(race.player.lap, 2);
    }
  } finally { world.dispose(); }
});
