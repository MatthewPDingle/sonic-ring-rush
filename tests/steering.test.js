import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWorld } from '../src/world.js';
import { Race } from '../src/race.js';
import { steerFromControls, laneForOffset } from '../src/steering.js';

globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {} }) }) };

test('combined digital and analog steering stays bounded and opposing inputs cancel', () => {
  assert.equal(steerFromControls(), 0);
  assert.equal(steerFromControls({left:true,right:true}), 0);
  assert.equal(steerFromControls({right:true,axis:1}), -1);
  assert.equal(steerFromControls({left:true,axis:-1}), 1);
  assert.equal(steerFromControls({left:true,axis:1}), 0);
});

for (let track = 0; track < 4; track++) {
  test(`world ${track + 1}: controls move toward the requested screen side, including inverted loops`, () => {
    const world = createWorld(track), camera = new THREE.PerspectiveCamera(65, 16/9, .1, 1000);
    try {
      // Use actual course geometry and the race's lateral integration, then
      // project through the chase view. An offset-only assertion missed this bug.
      const samples = Array.from({length:100}, (_,i) => world.length * i/100);
      for (const loop of world.loops || []) for (const u of [.1,.25,.5,.75,.9]) samples.push(loop.start + (loop.end-loop.start)*u);
      for (const s of samples) {
        const position=world.curve.getPointAt(s/world.length), forward=world.curve.getTangentAt(s/world.length).normalize();
        const frame=world.frameAt?.(s), right=frame?.right || new THREE.Vector3(forward.z,0,-forward.x).normalize();
        const up=frame?.up || new THREE.Vector3(0,1,0), tight=frame?.loop;
        camera.up.copy(up);
        camera.position.copy(position).addScaledVector(forward,tight?-9:-15).addScaledVector(up,frame?6:6.5);
        const ahead=world.frameAt?.(s+(tight?11:22));
        const look=ahead ? ahead.position.clone().addScaledVector(ahead.up,2.1) : world.curve.getPointAt(((s+24)/world.length)%1).addScaledVector(up,2.1);
        camera.lookAt(look); camera.updateMatrixWorld(true);
        const center=position.clone().addScaledVector(up,1.5).project(camera).x;
        for (const [controls,side] of [[{right:true},1],[{left:true},-1],[{axis:.7},1],[{axis:-.7},-1]]) {
          const race=new Race({length:world.length,items:[],halfWidth:world.halfWidth}); race.start();
          for(let i=0;i<190;i++) race.step(1/60,{});
          for(let i=0;i<12;i++) race.step(1/60,{steer:steerFromControls(controls)});
          const x=position.clone().addScaledVector(right,race.player.offset).addScaledVector(up,1.5).project(camera).x;
          assert.ok((x-center)*side>0,`Track ${track}, distance ${s}, controls ${JSON.stringify(controls)} moved the wrong screen direction`);
          assert.equal(laneForOffset(side===1?-4:4),side===1?'RIGHT':'LEFT');
        }
      }
      assert.equal(laneForOffset(0),'CENTER');
    } finally { world.dispose(); }
  });
}
