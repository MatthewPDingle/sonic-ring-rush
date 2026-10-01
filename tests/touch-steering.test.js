import test from 'node:test';
import assert from 'node:assert/strict';
import { steeringFromPosition, createSteeringPad } from '../src/touch-steering.js';

test('steering pad is neutral at its center, proportional toward each edge, and bounded outside',()=>{
  assert.equal(steeringFromPosition(150,50,200),0);
  assert.equal(steeringFromPosition(153,50,200),0);
  assert.equal(steeringFromPosition(50,50,200),-1);
  assert.equal(steeringFromPosition(250,50,200),1);
  assert.equal(steeringFromPosition(-100,50,200),-1);
  assert.equal(steeringFromPosition(500,50,200),1);
  assert.ok(steeringFromPosition(190,50,200)>.3&&steeringFromPosition(190,50,200)<.4);
  assert.ok(Math.abs(steeringFromPosition(110,50,200)+steeringFromPosition(190,50,200))<1e-12);
});
test('the thumb moves smoothly across phone and unfolded pad widths',()=>{
  for(const width of [112,138,250,284]) {
    let previous=-1;
    for(let x=0;x<=width;x+=.5){const value=steeringFromPosition(x,0,width);assert.ok(value>=previous);assert.ok(value-previous<.02);previous=value;}
    assert.equal(steeringFromPosition(width/2,0,width),0);
  }
  assert.equal(steeringFromPosition(NaN,0,200),0);
  assert.equal(steeringFromPosition(50,0,0),0);
});

test('lane gestures ignore small movement, emit once while held and rearm at the center',()=>{
  const handlers=new Map(),commands=[];
  const element={style:{setProperty(){}},classList:{toggle(){}},setAttribute(){},getBoundingClientRect:()=>({left:0,width:220}),addEventListener:(type,handler)=>handlers.set(type,handler),setPointerCapture(){},hasPointerCapture:()=>false};
  createSteeringPad(element,direction=>commands.push(direction));
  const send=(type,x)=>handlers.get(type)({clientX:x,button:0,pointerId:1,preventDefault(){}});
  send('pointerdown',110);send('pointermove',135);assert.deepEqual(commands,[]);
  send('pointermove',170);send('pointermove',190);send('pointermove',180);assert.deepEqual(commands,[1]);
  send('pointermove',110);send('pointermove',170);assert.deepEqual(commands,[1,0,1]);
  send('pointermove',40);assert.deepEqual(commands,[1,0,1,-1]);
  send('pointerup',40);assert.equal(commands.at(-1),0);
});
