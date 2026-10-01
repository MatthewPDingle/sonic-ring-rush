import * as THREE from 'three';
import { TRACKS, createWorld } from './world.js';
import { createCharacter, animateCharacter } from './character.js';
import { Race, formatTime } from './race.js';
import { steerFromControls, laneForOffset } from './steering.js';
import { displayProfile } from './display.js';
import { prepareMobileMaterials, batchMobileCharacter, addMobileGroundShadow, partitionMobileScenery } from './mobile-rendering.js';
import { createSteeringPad } from './touch-steering.js';
import { GameAudio } from './audio.js';
import { createAtmosphere } from './atmosphere.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import './style.css';
import './mobile.css';

const $ = (id) => document.getElementById(id);
const screens = ['menu', 'hud', 'pause-screen', 'help-screen', 'results-screen'];
const storage = { get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }, set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private browsing still plays. */ } } };
let selected = 0, difficulty = storage.get('ring-rush-difficulty', 'easy');
if (!['easy', 'normal'].includes(difficulty)) difficulty = 'easy';
let records = storage.get('ring-rush-records', {}), muted = storage.get('ring-rush-muted', false);
let world, race, renderer, scene, camera, sonic, rivals = [], mode = 'menu', lastTime = 0, elapsed = 0, toastUntil = 0, goUntil = 0, lastCountdown = 4, resultShown = false;
let composer, bloom, atmosphere, fxaa, nextShadowUpdate=0;
const savedMix = storage.get('ring-rush-mix', {music: .75, sfx: .85});
const volume = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : .8;
const mix = { music: volume(savedMix?.music), sfx: volume(savedMix?.sfx) };
const audio = new GameAudio(); audio.setMuted(muted);
audio.setVolumes?.(mix);
const android = Boolean(window.AndroidGame?.isNative?.());
let foreground = true;
const keys = new Set(), touch = {jump:false,boost:false}, particles = [];
const touchPointers=Object.fromEntries(Object.keys(touch).map(action=>[action,new Set()]));
let touchSteer=0, touchLaneTarget=null, steeringPad=null;
let controllerJump = false, controllerBoost = false, controllerBrake = false, controllerSteer = 0, gamepadPauseDown = false;
let fps = 60, drawCalls = 0;
const forward = new THREE.Vector3(), right = new THREE.Vector3(), targetPosition = new THREE.Vector3(), lookPosition = new THREE.Vector3();
const desiredCamera = new THREE.Vector3(), cameraLook = new THREE.Vector3();
const cameraUp = new THREE.Vector3(0,1,0), orientation = new THREE.Matrix4();
const mapContext = $('minimap').getContext('2d');
const medalNames = ['GOLD', 'SILVER', 'BRONZE', 'FINISHER'];

function show(...ids) { for (const id of screens) $(id).classList.toggle('hidden', !ids.includes(id)); }
function toast(message, seconds = 1.3) { $('toast').textContent = message; toastUntil = elapsed + seconds; }
function safeTrackName(index) { return TRACKS[index]?.name || ['Palm Coast', 'Sunset Ruins', 'Neon Skyway'][index]; }
function trackArt(index) {
 if(index===3)return `<svg viewBox="0 0 180 115" aria-hidden="true"><defs><linearGradient id="jungleSky" x2="0" y2="1"><stop stop-color="#64d4ce"/><stop offset="1" stop-color="#d2e888"/></linearGradient></defs><rect width="180" height="115" fill="url(#jungleSky)"/><path d="M0 83L22 44 44 72 69 25 101 79 129 33 162 73 180 45V115H0" fill="#268660"/><path d="M0 96L38 69 78 99 118 61 180 87V115H0" fill="#5fbc46"/><path d="M0 112Q39 87 70 99T160 84" fill="none" stroke="#e8bc69" stroke-width="14"/><ellipse cx="97" cy="66" rx="22" ry="31" fill="none" stroke="#ffc541" stroke-width="9"/><ellipse cx="97" cy="66" rx="22" ry="31" fill="none" stroke="#9b6434" stroke-width="4"/><path d="M19 90L20 48 M20 50Q4 37 4 52 M20 50Q30 35 43 48" fill="none" stroke="#15563c" stroke-width="6"/><path d="M143 33Q125 13 129 42L141 38Q152 57 163 36Z" fill="#ed5849"/><ellipse cx="146" cy="29" rx="9" ry="10" fill="#ffc43b"/><circle cx="149" cy="26" r="2" fill="#102c45"/><path d="M153 30L165 31 155 37Z" fill="#173e49"/><path d="M136 40L128 55 138 48Z" fill="#358df1"/></svg>`;
 const colors = [['#77d9ec','#37a694','#83cf50','#287152'],['#ffc786','#e29183','#b37650','#743b66'],['#182855','#68379a','#352461','#24d8f0']][index];
 return `<svg viewBox="0 0 180 115" aria-hidden="true"><defs><linearGradient id="sky${index}" x2="0" y2="1"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient></defs><rect width="180" height="115" fill="url(#sky${index})"/><circle cx="139" cy="29" r="17" fill="${index===2?'#fff0bd':'#fff3b0'}"/><path d="M0 85L35 28 66 74 104 43 153 80 180 47V115H0" fill="${colors[3]}"/><path d="M0 97L52 58 88 99 130 63 180 87V115H0" fill="${colors[2]}"/><path d="M-20 122 Q120 89 87 77 T134 68 Q168 61 149 54" fill="none" stroke="${index===2?'#45f3ed':'#f4dd96'}" stroke-width="19"/><path d="M-20 122 Q120 89 87 77 T134 68 Q168 61 149 54" fill="none" stroke="${index===2?'#18365b':'#c39b69'}" stroke-width="12"/><circle cx="78" cy="83" r="5" fill="none" stroke="#ffdf35" stroke-width="2"/>${index===0?'<path d="M29 87L27 45 M27 47Q12 34 9 49 M27 47Q35 32 45 45 M27 47Q18 28 19 37" fill="none" stroke="#1a654c" stroke-width="5"/>':index===1?'<path d="M21 87V49H39V72M21 49Q31 38 39 49" fill="none" stroke="#f5c784" stroke-width="8"/>':'<path d="M13 92V47H31V92M39 74V26H53V81" fill="#173353" stroke="#24d8f0" stroke-width="1"/>'}</svg>`;
}
function updateCards() {
 $('track-list').innerHTML = TRACKS.map((track, i) => {
  const record = records[`${i}-${difficulty}`];
  return `<button class="track-card ${i===selected?'selected':''} ${track.superTrack?'super-card':''}" data-track="${i}" aria-pressed="${i===selected}"><div class="track-art">${trackArt(i)}</div><div class="track-detail"><small>${track.superTrack?'THE BIG ADVENTURE':'WORLD 0'+(i+1)}</small><h3>${track.name}</h3><p>${track.subtitle || ['Sunshine, sea & speedy feet','Ancient paths. Golden skies.','Bright lights. Blazing speed.'][i]}</p><div class="track-status">${record ? `${medalNames[Math.min(record.position-1,3)]} · BEST ${formatTime(record.time)}` : '2 LAPS · READY TO EXPLORE'}</div></div>${i===selected?'<span class="track-check">●</span>':''}</button>`;
 }).join('');
 document.querySelectorAll('[data-track]').forEach(button => button.addEventListener('click', () => selectTrack(Number(button.dataset.track))));
 document.querySelectorAll('[data-difficulty]').forEach(button => { const active = button.dataset.difficulty === difficulty; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
}
function selectTrack(index) {
 audio.unlock().catch(() => {});audio.play('select');
 selected = index;
 createSceneWorld();
 updateCards();
}
function setWorldPosition(object, s, offset = 0, y = 0) {
 if(object.userData.groundShadow){object.userData.groundShadow.position.y=.03-y;object.userData.groundShadow.material.opacity=Math.max(.35,1-y*.12);}
 if(world.frameAt) {
  const frame=world.frameAt(s);
  object.position.copy(frame.position).addScaledVector(frame.right,offset).addScaledVector(frame.up,y+.08);
  orientation.makeBasis(frame.right,frame.up,frame.forward);
  object.quaternion.setFromRotationMatrix(orientation);
  return ((s/world.length)%1+1)%1;
 }
 const t = ((s / world.length) % 1 + 1) % 1;
 world.curve.getPointAt(t, targetPosition);
 world.curve.getTangentAt(t, forward).normalize();
 right.set(forward.z, 0, -forward.x).normalize();
 object.position.copy(targetPosition).addScaledVector(right, offset);
 object.position.y += y + .08;
 object.rotation.set(0,Math.atan2(forward.x, forward.z),0);
 return t;
}
function createSceneWorld() {
 if (world) { scene.remove(world.group); world.dispose(); }
 world = createWorld(selected); scene.add(world.group);
 if(android){prepareMobileMaterials(world.group);if(selected===3)partitionMobileScenery(world.group);}
 atmosphere.setTrack(selected); audio.setTrack?.(selected); audio.setMode?.(mode==='race'?'race':'menu');
 $('mix-track').textContent = TRACKS[selected].name;
 scene.background = new THREE.Color(TRACKS[selected].sky || ['#83daf0','#e9ac85','#172243'][selected]);
 scene.fog = new THREE.Fog(scene.background, selected === 2 ? 165 : 210, selected === 2 ? 630 : 790);
 const sun = scene.getObjectByName('sun');
 sun.color.set(selected === 1 ? '#ffe0af' : selected === 2 ? '#9dccff' : '#fff4db');
 sun.intensity = selected === 2 ? 1.5 : selected === 1 ? 2.8 : 3.1;
 scene.environmentIntensity = selected === 2 ? .38 : .45;
 if(android)scene.background=atmosphere.bake(renderer);
 bloom.strength = selected === 2 ? .34 : .15;
 setWorldPosition(sonic, 0, 0);
 sonic.scale.setScalar(mode==='menu'||mode==='help'?2.1:1);
 sonic.visible = true;
 rivals.forEach((model, index) => { setWorldPosition(model, -4 - index * 3, index % 2 ? -3 : 3); model.visible = false; });
 updateCamera(0, true);
 drawMap();
}
function startRace() {
 audio.unlock().catch(() => {});
 audio.setTrack?.(selected); audio.setMode?.('race');
 audio.setPaused(false); sonic.scale.setScalar(1);
 keys.clear(); clearTouch();
 race = new Race({length:world.length,items:world.items,halfWidth:world.halfWidth,loops:world.loops,parrots:world.parrots,difficulty,laps:2});
 race.start(); mode = 'race'; resultShown = false; lastCountdown = 4; goUntil = 0; toastUntil = 0;
 world.items.forEach(item => { item.collected = false; if (item.mesh) item.mesh.visible = true; });
 rivals.forEach(model => { model.visible = true; });
 show('hud'); $('track-name').textContent = safeTrackName(selected).toUpperCase(); $('countdown').textContent = '3';
 $('toast').textContent = ''; $('boost-hint').textContent = 'HOLD SHIFT'; updateCamera(0, true);
 $('parrot-alert').classList.add('hidden');
}
function clearTouch() { touchSteer=0;touchLaneTarget=null;steeringPad?.reset();Object.keys(touch).forEach(key=>{touch[key]=false;touchPointers[key].clear();}); document.querySelectorAll('[data-action]').forEach(b=>b.classList.remove('pressed')); }
function pause() {
 if (mode !== 'race' || !race || !['racing','countdown'].includes(race.state)) return;
 race.togglePause(); audio.setPaused(true); audio.update(0,false,0); keys.clear(); clearTouch(); mode = 'paused'; show('hud','pause-screen'); $('resume').focus();
}
function resume() { if(mode!=='paused')return; race.resume(); audio.setPaused(false); mode='race'; keys.clear(); clearTouch(); show('hud'); }
function home() { mode='menu'; race=null; audio.setPaused(false); audio.setMode?.('menu'); audio.update(0,false,0); sonic.scale.setScalar(2.1); keys.clear(); clearTouch(); $('speed-lines').classList.remove('active'); show('menu'); rivals.forEach(m=>m.visible=false); world.items.forEach(item=>{item.collected=false;if(item.mesh)item.mesh.visible=true;}); updateCards(); updateCamera(0,true); }
function getInput() {
 const left=keys.has('ArrowLeft')||keys.has('KeyA'),rightKey=keys.has('ArrowRight')||keys.has('KeyD');
 if(left||rightKey||controllerSteer)touchLaneTarget=null;
 const steer=touchLaneTarget!==null&&race?Math.max(-1,Math.min(1,(touchLaneTarget-race.player.offset)*1.8)):steerFromControls({left,right:rightKey,axis:controllerSteer});
 return {steer,accelerate:true,brake:keys.has('ArrowDown')||keys.has('KeyS')||controllerBrake,jump:keys.has('Space')||touch.jump||controllerJump,boost:keys.has('ShiftLeft')||keys.has('ShiftRight')||touch.boost||controllerBoost};
}
function gamepad() {
 const pads = navigator.getGamepads?.() || [];
 const pad = Array.from(pads).find(p=>p?.connected);
 if (!pad) { controllerSteer=0;controllerJump=false;controllerBoost=false;controllerBrake=false;gamepadPauseDown=false;return; }
 const pressed = i=>Boolean(pad.buttons[i]?.pressed);
 controllerSteer = Math.abs(pad.axes[0])>.16?pad.axes[0]:0;
 controllerSteer += pressed(15)?1:pressed(14)?-1:0;
 controllerJump=pressed(0);controllerBoost=pressed(2)||pressed(7);controllerBrake=pressed(1);
 if(pressed(9)&&!gamepadPauseDown) { if(mode==='race')pause();else if(mode==='paused')resume(); }
 gamepadPauseDown=pressed(9);
}
function handleEvents() {
 for(const event of race.events) {
  if(event.type.startsWith('rival')) {
   const model=rivals[event.rival];
   if(model&&Math.abs(race.rivals[event.rival].s-race.player.s)<100) {
    if(event.type==='rivalRing')burst(model.position,'#ffdf4a',3);
    if(event.type==='rivalHit')burst(model.position,'#ff9252',10);
    if(event.type==='rivalPad'||event.type==='rivalSpring')burst(model.position,'#77eeff',8);
   }
   continue;
  }
  audio.play(event.type,event);
  if(event.type==='ring') { burst(sonic.position, '#ffdf4a', 5); }
  if(event.type==='hit'||event.type==='hazard') { toast('BUMP! KEEP GOING!'); burst(sonic.position,'#ff9252',12); }
  if(event.type==='boost'||event.type==='boostPad'||event.type==='pad') toast('SUPER SPEED!');
  if(event.type==='spring') { toast('CATCH SOME AIR!');burst(sonic.position,'#77eeff',14); }
  if(event.type==='lap') toast('FINAL LAP! LET’S GO!',2);
  if(event.type==='loopEnter') toast('LOOP THE LOOP!',1.8);
  if(event.type==='parrotWarning') toast('PARROT INCOMING! DODGE OR JUMP!',1.6);
  if(event.type==='parrotHit') {toast('CHEEKY PARROT! KEEP RUNNING!',1.5);burst(sonic.position,'#ffc846',12);}
 }
 world.items.forEach(item=>{if(item.mesh)item.mesh.visible=!item.collected;});
}
function burst(position,color,count=8) {
 for(let i=0;i<count;i++) {
  let particle=particles.find(p=>p.life<=0); if(!particle)return;
  particle.life=.5+Math.random()*.4;particle.mesh.visible=true;particle.mesh.position.copy(position).y+=1.4;
  particle.mesh.material.color.set(color);particle.velocity.set((Math.random()-.5)*11,Math.random()*8+3,(Math.random()-.5)*11);
 }
}
function updateParticles(dt) {
 for(const particle of particles) {
  if(particle.life<=0)continue;
  particle.life-=dt;particle.velocity.y-=18*dt;particle.mesh.position.addScaledVector(particle.velocity,dt);particle.mesh.scale.setScalar(Math.max(.01,particle.life*.25));particle.mesh.visible=particle.life>0;
 }
}
function updateCamera(dt, snap=false) {
 if(!world)return;
 const p=mode==='menu'||mode==='help'?{s:0,offset:0,y:0,speed:0}:race?.player||{s:0,offset:0,y:0,speed:0};
 const t=((p.s/world.length)%1+1)%1;
 world.curve.getPointAt(t,targetPosition);world.curve.getTangentAt(t,forward).normalize();right.set(forward.z,0,-forward.x).normalize();
 const frame=world.frameAt?.(p.s);
 if(frame){targetPosition.copy(frame.position);forward.copy(frame.forward);right.copy(frame.right);cameraUp.copy(frame.up);}else cameraUp.set(0,1,0);
 if(mode==='menu'||mode==='help') {
  const portrait=innerWidth<650;
  desiredCamera.copy(targetPosition).addScaledVector(forward,portrait?22:19).addScaledVector(right,portrait?14:18);
  desiredCamera.y+=9;
  lookPosition.copy(targetPosition).addScaledVector(right,portrait?-1.5:-8).addScaledVector(forward,2);lookPosition.y+=portrait?4:2.6;
 } else if(frame) {
  const tight=frame.loop||p.inLoop;
  desiredCamera.copy(targetPosition).addScaledVector(forward,tight?-9:-15-p.speed*.025).addScaledVector(right,p.offset*.55).addScaledVector(frame.up,6+Math.min(p.y*.32,2.5));
  const ahead=world.frameAt(p.s+(tight?11:22));
  lookPosition.copy(ahead.position).addScaledVector(ahead.right,p.offset*.38).addScaledVector(ahead.up,2.1);
 } else {
  desiredCamera.copy(targetPosition).addScaledVector(forward,-13-p.speed*.035).addScaledVector(right,p.offset*.55);
  desiredCamera.y+=6.5+Math.min(p.y*.32,2.5);
  world.curve.getPointAt(((p.s+24)/world.length)%1,lookPosition);lookPosition.addScaledVector(right,p.offset*.38);lookPosition.y+=2.1;
 }
 if(snap){camera.position.copy(desiredCamera);cameraLook.copy(lookPosition);}else{camera.position.lerp(desiredCamera,1-Math.exp(-dt*7));cameraLook.lerp(lookPosition,1-Math.exp(-dt*9));}
 if(snap)camera.up.copy(cameraUp);else camera.up.lerp(cameraUp,1-Math.exp(-dt*15)).normalize();
 camera.lookAt(cameraLook);
 const desiredFov=mode==='race'&&p.boosting?76:mode==='menu'?48:65;
 camera.fov = snap?desiredFov:THREE.MathUtils.lerp(camera.fov,desiredFov,1-Math.exp(-dt*4));camera.updateProjectionMatrix();
 const sun=scene.getObjectByName('sun');sun.position.copy(targetPosition).add(new THREE.Vector3(-70,100,40));sun.target.position.copy(targetPosition);sun.target.updateMatrixWorld();
}
function drawMap() {
 if(!world||!mapContext)return;
 const ctx=mapContext,w=200,h=160;
 const points=Array.from({length:101},(_,i)=>world.curve.getPointAt(i/100));
 const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minZ=Math.min(...points.map(p=>p.z)),maxZ=Math.max(...points.map(p=>p.z));
 const scale=Math.min((w-30)/(maxX-minX),(h-30)/(maxZ-minZ));
 const map=p=>({x:(p.x-(minX+maxX)/2)*scale+w/2,y:(p.z-(minZ+maxZ)/2)*scale+h/2});
 ctx.clearRect(0,0,w,h);ctx.lineWidth=7;ctx.strokeStyle='#d5edff33';ctx.lineJoin='round';ctx.beginPath();points.forEach((p,i)=>{const m=map(p);i?ctx.lineTo(m.x,m.y):ctx.moveTo(m.x,m.y)});ctx.stroke();
 const start=map(points[0]);ctx.fillStyle='#ffffff';ctx.fillRect(start.x-4,start.y-4,8,8);
 if(race) {
  [...race.rivals,race.player].forEach((r,i)=>{const m=map(world.curve.getPointAt(((r.s/world.length)%1+1)%1));ctx.beginPath();ctx.arc(m.x,m.y,i===3?5:3,0,Math.PI*2);ctx.fillStyle=i===3?'#ffdb45':['#ff9557','#ec719f','#af90ff'][i];ctx.fill();if(i===3){ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();}});
 }
}
function updateHud() {
 const p=race.player,pos=race.position;
 $('position').innerHTML=`${pos}<span>${['st','nd','rd','th'][pos-1]}</span>`;
 $('lap').innerHTML=`${Math.min(2,Math.floor(p.s/world.length)+1)} <span>/ 2</span>`;
 $('rings').textContent=p.rings;$('timer').textContent=formatTime(race.time);$('speed').textContent=Math.round(p.speed*3.6);
 $('boost-fill').style.width=`${Math.max(0,p.boost)}%`;
 $('speed-lines').classList.toggle('active',mode==='race'&&p.boosting);
 if(race.state==='countdown') {
  const count=Math.max(1,Math.ceil(race.countdown));$('countdown').textContent=count;
  if(count!==lastCountdown){audio.play('countdown');lastCountdown=count;}
 } else if(lastCountdown!==0) { lastCountdown=0;goUntil=elapsed+.8;audio.play('go');toast('COLLECT RINGS · JUMP · BOOST',3); }
 if(race.state!=='countdown')$('countdown').textContent=elapsed<goUntil?'GO!':'';
 if(elapsed>toastUntil)$('toast').textContent='';
 const bird=race.parrots?.find(b=>b.phase==='warning'||(b.phase==='swooping'&&b.progress<.5));
 $('parrot-alert').classList.toggle('hidden',!bird);
 if(bird){$('parrot-alert').textContent=`🦜 ${laneForOffset(bird.targetOffset)} LANE · JUMP OR DODGE!`;}
 drawMap();
}
function results() {
 if(resultShown)return;resultShown=true;mode='results';show('results-screen');$('speed-lines').classList.remove('active');audio.play('finish');
 audio.setPaused(false); audio.setMode?.('results'); audio.update(0,false,0);
 const position=race.position,time=race.player.time||race.time;
 const medal=$('medal');medal.className=`medal ${position===2?'silver':position===3?'bronze':position===4?'finisher':''}`;medal.textContent=position===1?'★':position===2?'★':position===3?'★':'✓';
 $('result-title').textContent=['You’re a speed star!','So close. So speedy!','An awesome adventure!','You did it, legend!'][position-1];
 $('result-subtitle').textContent=`${safeTrackName(selected)} complete · ${['1st','2nd','3rd','4th'][position-1]} place`;
 $('result-time').textContent=formatTime(time);$('result-rings').textContent=race.player.rings;
 const previous=records[`${selected}-${difficulty}`],newBest=!previous||time<previous.time;
 records[`${selected}-${difficulty}`]={time:Math.min(previous?.time??Infinity,time),position:Math.min(previous?.position??4,position)};storage.set('ring-rush-records',records);
 $('personal-best').textContent=newBest?'NEW PERSONAL BEST! YOUR ADVENTURE IS SAVED.':`PERSONAL BEST · ${formatTime(previous.time)}`;
 const rows=race.results;
 $('standings').innerHTML=rows.map((row,i)=>`<div class="standing ${row.player?'player':''}"><span>${row.position||i+1}</span><b>${row.player?'Sonic · YOU':row.name}</b><span>${!row.estimated&&Number.isFinite(row.time)&&row.time>0?formatTime(row.time):'Behind you'}</span></div>`).join('');
 burst(sonic.position,'#ffdf4a',35);
 $('next-track').textContent=selected===TRACKS.length-1?'BACK TO EMERALD COAST ↗':'NEXT WORLD →';
 $('next-track').focus();
}
function frame(now) {
 const frameDt=(now-lastTime)/1000||0,dt=Math.min(frameDt,.05);lastTime=now;elapsed+=dt;fps=THREE.MathUtils.lerp(fps,frameDt>0?1/frameDt:60,.02);
 gamepad();
 if(world) {
  if(mode==='race'&&race) {
   race.step(dt,getInput());handleEvents();
   setWorldPosition(sonic,race.player.s,race.player.offset,race.player.y);
   animateCharacter(sonic,race.player.speed,elapsed,race.player.y,race.player.boosting);
   race.rivals.forEach((r,i)=>{
    const model=rivals[i];setWorldPosition(model,r.s,r.offset,r.inLoop?0:r.y||0);animateCharacter(model,r.speed,elapsed+i*.4,r.inLoop?0:r.y||0,r.boosting);
    // Keep nearby trailing racers from blocking the blue player in the chase view.
    const gap=((r.s-race.player.s+world.length/2)%world.length+world.length)%world.length-world.length/2;
    const fade=gap < -2 && gap > -22 ? .16 : 1;
    model.userData.opacity=THREE.MathUtils.lerp(model.userData.opacity??1,fade,1-Math.exp(-dt*12));
    model.traverse(object=>{if(object.isMesh){object.material.opacity=model.userData.opacity*(object.material.userData.baseOpacity??1);object.material.depthWrite=object.material.userData.baseDepthWrite&&model.userData.opacity>.5;}});
   });
   updateHud();audio.setRaceState?.({lap:Math.min(2,Math.floor(race.player.s/world.length)+1),laps:2,boosting:race.player.boosting});
   if(race.state==='finished')results();
  } else if(mode==='menu'||mode==='help') { setWorldPosition(sonic,0,0);animateCharacter(sonic,0,elapsed,0,false); }
  if(mode!=='paused'){world.update?.(race?race.time:elapsed,dt,race);updateParticles(dt);}
  if(android) {
   const local=(race?.player.s??0)%world.length;
   world.items.forEach(item=>{const ahead=(item.s-local+world.length)%world.length;item.mesh.visible=!item.collected&&(ahead<190||ahead>world.length-35);});
  }
  audio.update(mode==='race'?race?.player.speed||0:0,mode==='race'&&race?.player.boosting,dt);
  updateCamera(dt);atmosphere.update(camera,elapsed);
  if(android&&elapsed>=nextShadowUpdate){renderer.shadowMap.needsUpdate=true;nextShadowUpdate=elapsed+1/15;}
  renderer.info.reset();composer.render(dt);drawCalls=renderer.info.render.calls;
 }
 requestAnimationFrame(frame);
}
function syncSound() {document.querySelectorAll('.sound-toggle').forEach(button=>{button.textContent=muted?'♪̸':'♫';button.setAttribute('aria-label',muted?'Turn sound on':'Turn sound off');button.title=muted?'Sound off — click to enable':'Sound on — click to mute';});}
function wireControls() {
 document.querySelectorAll('.mix-open').forEach(button=>button.addEventListener('click',()=>{audio.unlock().catch(()=>{});$('audio-settings').showModal();}));
 $('mix-close').addEventListener('click',()=>$('audio-settings').close());
 $('try-sound').addEventListener('click',async()=>{await audio.unlock();audio.play('ring');});
 for(const channel of ['music','sfx']) {
  const slider=$(`${channel}-volume`),label=$(`${channel}-percent`);
  slider.value=Math.round(mix[channel]*100);label.textContent=`${slider.value}%`;
  slider.addEventListener('input',()=>{mix[channel]=Number(slider.value)/100;label.textContent=`${slider.value}%`;audio.setVolumes?.(mix);storage.set('ring-rush-mix',mix);});
 }
 $('play').addEventListener('click',startRace);$('help-play').addEventListener('click',startRace);
 $('how-to').addEventListener('click',()=>{mode='help';show('menu','help-screen');$('close-help').focus();});
 $('close-help').addEventListener('click',()=>{mode='menu';show('menu');$('how-to').focus();});
 $('pause').addEventListener('click',pause);$('resume').addEventListener('click',resume);$('restart').addEventListener('click',startRace);$('quit').addEventListener('click',home);$('result-home').addEventListener('click',home);$('again').addEventListener('click',startRace);
 $('next-track').addEventListener('click',()=>{selected=(selected+1)%TRACKS.length;createSceneWorld();startRace();});
 document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();home();});
 document.querySelectorAll('[data-difficulty]').forEach(button=>button.addEventListener('click',()=>{difficulty=button.dataset.difficulty;storage.set('ring-rush-difficulty',difficulty);updateCards();}));
 document.querySelectorAll('.sound-toggle').forEach(button=>button.addEventListener('click',()=>{muted=!muted;storage.set('ring-rush-muted',muted);audio.setMuted(muted||!foreground);if(!muted)audio.unlock().catch(()=>{});syncSound();}));
 $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Fullscreen unavailable in this browser');}});
 const handled=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','ShiftLeft','ShiftRight','KeyA','KeyD','KeyS','KeyW'];
 window.addEventListener('keydown',event=>{
  if($('audio-settings').open)return;
  if(event.code==='Escape'){if(mode==='race')pause();else if(mode==='paused')resume();else if(mode==='help'){mode='menu';show('menu');}return;}
  if(handled.includes(event.code)&&mode==='race'){event.preventDefault();keys.add(event.code);}
 });
 window.addEventListener('keyup',event=>keys.delete(event.code));
 window.addEventListener('blur',()=>{keys.clear();clearTouch();pause();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
 document.querySelectorAll('[data-action]').forEach(button=>{
  const action=button.dataset.action;
  button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);touchPointers[action].add(event.pointerId);touch[action]=true;button.classList.add('pressed');});
  const release=event=>{touchPointers[action].delete(event.pointerId);touch[action]=touchPointers[action].size>0;button.classList.toggle('pressed',touch[action]);};button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
 });
 steeringPad=createSteeringPad($('steering-pad'),value=>{
  touchSteer=value;if(!value||mode!=='race'||!race)return;
  const lanes=[-4,0,4];const from=touchLaneTarget??race.player.offset;
  const nearest=lanes.reduce((best,lane,index)=>Math.abs(lane-from)<Math.abs(lanes[best]-from)?index:best,0);
  touchLaneTarget=lanes[Math.max(0,Math.min(2,nearest-value))];
 });
 if(android||matchMedia('(pointer: coarse)').matches){document.body.classList.add('touch');document.querySelector('.control-summary').textContent='SLIDE TO CHANGE LANES · JUMP · HOLD BOOST';document.querySelector('.help-grid p').textContent='Slide past a side marker to change one lane. Recenter or lift your thumb to change again. Sonic finishes each lane change automatically.';}
 if(android){
  document.body.classList.add('android');$('fullscreen').classList.add('hidden');
  window.addEventListener('ringrush-foreground',event=>{
   foreground=Boolean(event.detail);keys.clear();clearTouch();
   if(!foreground){pause();audio.setPaused(true);}else if(mode!=='paused')audio.setPaused(false);
   audio.setMuted(muted||!foreground);
  });
  window.addEventListener('ringrush-back',()=>{
   if($('audio-settings').open){$('audio-settings').close();return;}
   if(mode==='race'){pause();return;}
   if(mode==='paused'||mode==='results'||mode==='help'){home();return;}
   window.AndroidGame.exit();
  });
 }
 window.addEventListener('resize',resize);syncSound();
 resize();
}
function viewportSize() {
 const viewport=android?window.visualViewport:null;
 return viewport?{width:Math.round(viewport.width*devicePixelRatio)/devicePixelRatio+1e-6,height:Math.round(viewport.height*devicePixelRatio)/devicePixelRatio+1e-6}:{width:innerWidth,height:innerHeight};
}
function resize() { if(!renderer)return;const {width,height}=viewportSize();const profile=displayProfile(width,height,devicePixelRatio,android);document.body.dataset.layout=profile.layout;keys.clear();clearTouch();renderer.setPixelRatio(profile.pixelRatio);renderer.setSize(width,height);if(composer){composer.setPixelRatio(profile.pixelRatio);composer.setSize(width,height);}if(fxaa)fxaa.uniforms.resolution.value.set(1/renderer.domElement.width,1/renderer.domElement.height);camera.aspect=width/height;camera.updateProjectionMatrix();if(world&&(mode==='menu'||mode==='help'))updateCamera(0,true); }
function fail(error) { $('loading').classList.add('hidden');$('error-screen').classList.remove('hidden');$('error-message').textContent=`${error.message || 'Could not create a 3D view.'} ${android?'Update Android System WebView in the Play Store, then reopen the game.':'Try an updated Chrome or Edge browser with hardware acceleration enabled.'}`;console.error(error); }
try {
 renderer=new THREE.WebGLRenderer({canvas:$('game'),antialias:!android,powerPreference:'high-performance'});
 renderer.info.autoReset=false;
 renderer.setPixelRatio(displayProfile(innerWidth,innerHeight,devicePixelRatio,android).pixelRatio);renderer.shadowMap.enabled=true;renderer.shadowMap.type=android?THREE.VSMShadowMap:THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,1100);resize();
 atmosphere=createAtmosphere();scene.add(atmosphere.mesh);
 if(!android){const studio=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(studio,.035).texture;studio.dispose();pmrem.dispose();}
 // Canvas MSAA alone does not cover the offscreen postprocessing image.
 const renderTarget=new THREE.WebGLRenderTarget(innerWidth*renderer.getPixelRatio(),innerHeight*renderer.getPixelRatio(),{type:THREE.HalfFloatType});
 renderTarget.samples=android?0:Math.min(4,renderer.capabilities.maxSamples);
 composer=new EffectComposer(renderer,renderTarget);composer.setSize(viewportSize().width,viewportSize().height);composer.addPass(new RenderPass(scene,camera));
 bloom=android?{strength:0}:new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.15,.45,1.3);
 if(!android)composer.addPass(bloom);composer.addPass(new OutputPass());
 if(android){fxaa=new ShaderPass(FXAAShader);fxaa.uniforms.resolution.value.set(1/renderer.domElement.width,1/renderer.domElement.height);composer.addPass(fxaa);renderer.shadowMap.autoUpdate=false;}
 scene.add(new THREE.HemisphereLight('#dcf5ff','#476345',1.55));
 const sun=new THREE.DirectionalLight('#fff5db',3.1);sun.name='sun';sun.castShadow=true;sun.shadow.mapSize.setScalar(android?1024:2048);sun.shadow.camera.left=-45;sun.shadow.camera.right=45;sun.shadow.camera.top=45;sun.shadow.camera.bottom=-45;sun.shadow.camera.near=1;sun.shadow.camera.far=230;sun.shadow.normalBias=.045;sun.shadow.bias=-.0002;scene.add(sun,sun.target);
 sonic=createCharacter();scene.add(sonic);rivals=['#ed7a3c','#ed589e','#886ce2'].map(color=>{const character=createCharacter(color);character.traverse(object=>{if(object.isMesh)object.material.transparent=true;});scene.add(character);return character;});
 if(android)[sonic,...rivals].forEach(model=>{prepareMobileMaterials(model);batchMobileCharacter(model);addMobileGroundShadow(model);});
 rivals.forEach(model=>model.traverse(object=>{if(object.isMesh){object.material.userData.baseOpacity=object.material.opacity;object.material.userData.baseDepthWrite=object.material.depthWrite;}}));
 const particleGeometry=new THREE.IcosahedronGeometry(1,0);
 for(let i=0;i<64;i++){const mesh=new THREE.Mesh(particleGeometry,new THREE.MeshBasicMaterial({color:'#ffda44'}));mesh.visible=false;scene.add(mesh);particles.push({mesh,life:0,velocity:new THREE.Vector3()});}
 const requestedTrack=new URLSearchParams(location.search).get('track');
 if(requestedTrack!==null&&Number.isInteger(Number(requestedTrack))&&Number(requestedTrack)>=0&&Number(requestedTrack)<TRACKS.length)selected=Number(requestedTrack);
 createSceneWorld();updateCards();wireControls();$('loading').classList.add('hidden');requestAnimationFrame(frame);
 // Read-only diagnostics used by the independent gauntlet reviewers.
 window.__ringRush={get state(){return {mode,track:selected,android,layout:document.body.dataset.layout,renderPixelRatio:renderer.getPixelRatio(),devicePixelRatio,renderSize:{width:renderer.domElement.width,height:renderer.domElement.height},antialias:android?'FXAA':'MSAA',antialiasSamples:composer.renderTarget1.samples,steering:{direction:touchSteer,targetLane:touchLaneTarget},rivals:race?.rivals.map(r=>({name:r.name,s:r.s,speed:r.speed,offset:r.offset,y:r.y,rings:r.rings,boost:r.boost,boosting:r.boosting,decision:r.decision,stats:{...r.stats}})),difficulty,length:world?.length,loops:world?.loops,raceState:race?.state,time:race?.time,parrots:race?.parrots?.map(b=>({id:b.id,phase:b.phase,progress:b.progress,targetOffset:b.targetOffset,worldS:b.worldS})),player:race?{s:race.player.s,speed:race.player.speed,offset:race.player.offset,y:race.player.y,inLoop:race.player.inLoop,loopProgress:race.player.loopProgress,rings:race.player.rings,boost:race.player.boost,position:race.position}:null,fps:Math.round(fps),drawCalls,audio:audio.diagnostics};}};
} catch(error) { fail(error); }
