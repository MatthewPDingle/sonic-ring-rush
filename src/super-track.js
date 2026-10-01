import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { surfaceMaterial, detailedFrondGeometry, addWorldDetail, disposeWorld } from './world-detail.js';

// The course uses distance, including the entire inverted road of each loop.
// There is no horizontal projection shortcut: getPointAt and frameAt agree.
const Y = new THREE.Vector3(0, 1, 0);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const mod = (x, n) => ((x % n) + n) % n;
const material = (color, emissive = null) => new THREE.MeshStandardMaterial({ color, roughness: .78, ...(emissive ? { emissive, emissiveIntensity: .45 } : {}) });
function mesh(parent, geometry, mat, p = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
  const result = new THREE.Mesh(geometry, mat);
  result.position.set(...p); result.scale.set(...scale); result.rotation.set(...rotation);
  result.castShadow = true; result.receiveShadow = true; parent.add(result); return result;
}
function instanced(parent, geometry, mat, records) {
  if (!records.length) return;
  const result = new THREE.InstancedMesh(geometry, mat, records.length), dummy = new THREE.Object3D();
  records.forEach((r, i) => {
    dummy.position.copy(r.p); dummy.scale.set(...(r.scale || [1, 1, 1]));
    if (r.quaternion) dummy.quaternion.copy(r.quaternion); else dummy.rotation.set(...(r.rotation || [0, 0, 0]));
    dummy.updateMatrix(); result.setMatrixAt(i, dummy.matrix);
    if (r.color) result.setColorAt(i, new THREE.Color(r.color));
  });
  result.castShadow = true; result.receiveShadow = true; parent.add(result); return result;
}
function frameQuaternion(f) { return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.right, f.up, f.forward)); }

function makeCourse() {
  const segments = [], loops = [];
  let cursor = V(0, 9, 340);
  function line(end) {
    const begin = cursor.clone(), delta = end.clone().sub(begin);
    segments.push({ point: u => begin.clone().addScaledVector(delta, u), tangent: () => delta.clone().normalize(), samples: Math.ceil(delta.length() * 2) }); cursor = end.clone();
  }
  function bend(c1, c2, end, bank = 0) {
    const c = new THREE.CubicBezierCurve3(cursor.clone(), c1, c2, end);
    segments.push({ point: u => c.getPoint(u), tangent: u => c.getTangent(u), samples: 420, bank }); cursor = end.clone();
  }
  function loop(radius, advance, forward, name) {
    const begin = cursor.clone(), right = V(forward.z, 0, -forward.x), drift = 54;
    segments.push({ loop: true, name, samples: 900, right,
      // A smooth lateral drift separates the ascending and descending decks.
      // Its derivative vanishes at both ends, preserving the straight approaches.
      point: u => begin.clone().addScaledVector(forward, radius * Math.sin(u * Math.PI * 2) + advance * u).addScaledVector(Y, radius * (1 - Math.cos(u * Math.PI * 2))).addScaledVector(right, drift * u * u * (3 - 2 * u)),
      tangent: u => forward.clone().multiplyScalar(radius * Math.PI * 2 * Math.cos(u * Math.PI * 2) + advance).addScaledVector(Y, radius * Math.PI * 2 * Math.sin(u * Math.PI * 2)).addScaledVector(right, drift * 6 * u * (1 - u)).normalize(),
    }); cursor.addScaledVector(forward, advance).addScaledVector(right, drift);
  }
  line(V(160, 9, 340));
  loop(26, 62, V(1, 0, 0), 'Sunbird Loop');
  line(V(300, 9, 286));
  bend(V(378, 9, 286), V(425, 17, 292), V(425, 24, 220), -.21);
  bend(V(425, 35, 140), V(393, 43, 78), V(408, 34, -12), .14);
  bend(V(423, 25, -102), V(441, 16, -231), V(361, 12, -300), -.17);
  bend(V(320, 12, -335), V(302, 12, -350), V(245, 12, -350), -.17);
  line(V(65, 12, -350));
  loop(29, 66, V(-1, 0, 0), 'Moonflower Loop');
  line(V(-282, 12, -296));
  bend(V(-365, 12, -296), V(-427, 14, -295), V(-427, 20, -220), -.24);
  bend(V(-427, 27, -150), V(-330, 34, -140), V(-330, 27, -62), .25);
  bend(V(-330, 20, 8), V(-441, 8, 53), V(-441, 8, 142), -.25);
  bend(V(-441, 8, 262), V(-380, 9, 340), V(-282, 9, 340), -.2);
  line(V(0, 9, 340));
  const table = [{ s: 0, segment: 0, u: 0 }];
  let length = 0, previous = segments[0].point(0);
  segments.forEach((seg, index) => {
    seg.start = length;
    for (let j = 1; j <= seg.samples; j++) {
      const u = j / seg.samples, p = seg.point(u); length += p.distanceTo(previous);
      table.push({ s: length, segment: index, u }); previous = p;
    }
    seg.end = length;
    if (seg.loop) loops.push({ start: seg.start, end: seg.end, name: seg.name });
  });
  function locate(s) {
    s = mod(s, length); let lo = 0, hi = table.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >>> 1; if (table[mid].s <= s) lo = mid; else hi = mid; }
    const a = table[lo], b = table[hi], t = (s - a.s) / (b.s - a.s);
    // At a segment boundary the preceding sample represents u=0 of the next.
    return { seg: segments[b.segment], u: (a.segment === b.segment ? a.u : 0) * (1 - t) + b.u * t };
  }
  function frameAt(s) {
    const { seg, u } = locate(s), position = seg.point(u), forward = seg.tangent(u);
    const right = seg.loop ? seg.right.clone().addScaledVector(forward, -seg.right.dot(forward)).normalize() : V(forward.z, 0, -forward.x).normalize();
    const up = forward.clone().cross(right).normalize(), bank = seg.loop ? 0 : (seg.bank || 0) * Math.sin(Math.PI * u) ** 2;
    if (bank) { right.applyAxisAngle(forward, bank); up.applyAxisAngle(forward, bank); }
    return { position, forward, right, up, loop: !!seg.loop, bank };
  }
  const curve = {
    getLength: () => length,
    getPointAt: (t, target = new THREE.Vector3()) => target.copy(frameAt(t * length).position),
    getTangentAt: (t, target = new THREE.Vector3()) => target.copy(frameAt(t * length).forward),
  };
  return { curve, length, frameAt, loops, segments };
}

function frondGeometry() {
  return detailedFrondGeometry();
}

// Articulated wings remain groups; each static colored assembly becomes one draw.
function mergeBirdParts(parent) {
  const buckets = new Map();
  for(const part of [...parent.children])if(part.isMesh){if(!buckets.has(part.material))buckets.set(part.material,[]);buckets.get(part.material).push(part);}
  for(const [mat,parts] of buckets)if(parts.length>1){
    const geos=parts.map(part=>{part.updateMatrix();return part.geometry.clone().applyMatrix4(part.matrix);});
    const geo=mergeGeometries(geos);geos.forEach(g=>g.dispose());
    if(geo){for(const part of parts){parent.remove(part);part.geometry.dispose();}mesh(parent,geo,mat);}
  }
}

export function createSuperWorld() {
  const { curve, length, frameAt, loops, segments } = makeCourse(), halfWidth = 8;
  const group = new THREE.Group(); group.name = 'Parrot Paradise';
  const items = [], parrots = [], pendulums = [], waterfalls = [];
  let seed = 839127; const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const colors = { sand: surfaceMaterial('sand',{color:'#dfc290'}), stone: surfaceMaterial('stone',{color:'#cab58a'}), wood: surfaceMaterial('wood',{color:'#a67544',repeat:[3,5]}), grass: surfaceMaterial('grass',{color:'#50a634'}), leaf: surfaceMaterial('grass'), turquoise: material('#10b0a8'), gold: material('#ffe27b', '#b38417') };
  colors.leaf.side = THREE.DoubleSide;
  const place = (s, lane = 0, h = 0) => { const f = frameAt(s); return f.position.clone().addScaledVector(f.right, lane).addScaledVector(f.up, h); };
  function localGroup(s, lane = 0, h = 0) {
    const g = new THREE.Group(); g.position.copy(place(s, lane, h)); g.quaternion.copy(frameQuaternion(frameAt(s))); group.add(g); return g;
  }
  function ribbon(offsets, heights, shades, step = 1.4, filter = null) {
    const positions = [], color = [], indices = [], uv = [], n = Math.ceil(length / step), count = offsets.length;
    for (let i = 0; i <= n; i++) {
      const f = frameAt(i * length / n);
      for (let j = 0; j < count; j++) {
        const p = f.position.clone().addScaledVector(f.right, offsets[j]).addScaledVector(f.up, heights[j]); positions.push(...p.toArray());
        uv.push(offsets[j]/6,i*length/n/10);
        const c = new THREE.Color(shades[j]); color.push(c.r, c.g, c.b);
      }
      if (i < n && (!filter || filter((i + .5) * length / n))) for (let j = 0; j < count - 1; j++) {
        const a = i * count + j, b = a + count; indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); geo.setIndex(indices); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, surfaceMaterial(offsets.length>4?'grass':'sand',{ vertexColors: true, roughness: .9, side: THREE.DoubleSide })); m.receiveShadow = true; group.add(m); return m;
  }
  const awayFromLoops = (s, margin = 18) => loops.every(l => s < l.start - margin || s > l.end + margin);
  // Dense strips preserve curvature at the loop crown and on steep transitions.
  ribbon([-8, -7.45, 7.45, 8], [0, .035, .035, 0], ['#ffe09b', '#dbc38f', '#dbc38f', '#ffe09b']);
  ribbon([-8.6, -8.6, 8.6, 8.6], [-.6, -.12, -.12, -.6], ['#704625', '#a47440', '#a47440', '#704625']);
  const ravine = { start: segments[4].start + 22, end: segments[5].end - 15 };
  ribbon([-57, -34, -11, 11, 34, 57], [-13, -3.5, -.9, -.9, -3.5, -13], ['#775336', '#398c36', '#75bd45', '#75bd45', '#398c36', '#775336'], 4, s => awayFromLoops(s, 0) && (s < ravine.start || s > ravine.end));
  const posts = [], curbs = [], dashes = [], support = [];
  for (let s = 0; s < length; s += 5) {
    const f = frameAt(s), quaternion = frameQuaternion(f);
    for (const side of [-1, 1]) {
      curbs.push({ p: place(s, side * 7.7, .1), quaternion, scale: [.35, .16, 2.6], color: Math.floor(s / 5) % 2 ? '#fffbe2' : '#10aa9d' });
      if (Math.floor(s / 5) % 2 === 0) posts.push({ p: place(s, side * 8.7, .55), quaternion, scale: [.15, 1.1, .15] });
    }
    if (Math.floor(s / 5) % 3 === 0) dashes.push({ p: place(s, 0, .065), quaternion, scale: [.16, .035, 3.2] });
    if (!f.loop && s > ravine.start && s < ravine.end && Math.floor(s / 5) % 5 === 0) {
      for (const side of [-1, 1]) { const p = place(s, side * 7.8, -18); support.push({ p, scale: [1.3, 35, 1.3] }); }
    }
  }
  instanced(group, new THREE.BoxGeometry(1, 1, 1), material('#ffffff'), curbs);
  instanced(group, new THREE.BoxGeometry(1, 1, 1), colors.turquoise, posts);
  instanced(group, new THREE.BoxGeometry(1, 1, 1), material('#fff5cb'), dashes);
  instanced(group, new THREE.CylinderGeometry(1, 1.25, 1, 8), colors.stone, support);
  // Tubes follow the very same local up vector as the driving surface.
  for (const side of [-1, 1]) {
    const railCurve = { getPoint: (t, target = new THREE.Vector3()) => target.copy(place(t * length, side * 8.7, 1.05)), getTangent: (t, target = new THREE.Vector3()) => {
      const eps = .00005; return target.copy(place((t + eps) * length, side * 8.7, 1.05)).sub(place((t - eps) * length, side * 8.7, 1.05)).normalize();
    }, computeFrenetFrames: THREE.Curve.prototype.computeFrenetFrames, getPointAt(t, target) { return this.getPoint(t, target); }, getTangentAt(t, target) { return this.getTangent(t, target); } };
    mesh(group, new THREE.TubeGeometry(railCurve, Math.ceil(length / 2), .12, 5, true), material('#f5e7b5'));
  }
  const trunks = [], leaves = [], bushes = [], stones = [], flowers = [], coconuts=[],growthRings=[],roots=[],mossLedges=[],loopStones=[],cliffTerraces=[];
  function palm(s, lane, height, broad = false) {
    const f = frameAt(s), base = place(s, lane, -1.3); base.y = f.position.y - 1.3;
    const crown = base.clone().add(V(0, height, 0)), lean = (rand() - .5) * .16;
    trunks.push({ p: base.clone().add(V(0, height / 2, 0)), scale: [broad ? .95 : .58, height, broad ? .95 : .58], rotation: [lean, 0, lean * .4] });
    for(let k=0;k<3;k++)coconuts.push({p:crown.clone().add(V(Math.cos(k*2.1)*.62,-.65,Math.sin(k*2.1)*.62)),scale:[.45,.52,.45]});
    for(let j=1;j<height;j+=.9)growthRings.push({p:base.clone().add(V(0,j,0)),scale:[broad?.75:.45,.035,broad?.75:.45],rotation:[Math.PI/2,0,0]});
    for(let k=0;k<4;k++){const a=k*Math.PI/2+s,delta=V(Math.cos(a)*1.8,-.5,Math.sin(a)*1.8);roots.push({p:base.clone().add(V(0,.35,0)).addScaledVector(delta,.5),scale:[.16,delta.length(),.16],quaternion:new THREE.Quaternion().setFromUnitVectors(Y,delta.normalize())});}
    for (let k = 0; k < 8; k++) leaves.push({ p: crown, scale: [2.8, 3.3, broad ? 8 : 6.5], rotation: [0, k * Math.PI / 4 + s, 0], color: k % 2 ? '#24863b' : '#62bd38' });
    return crown;
  }
  for (let s = 30; s < length; s += 13) {
    if (!awayFromLoops(s, 20) || (s > ravine.start && s < ravine.end)) continue;
    for (const side of [-1, 1]) {
      const off = side * (21 + rand() * 32), p = place(s, off, -2);
      if (rand() > .16) palm(s + rand() * 6, off, 10 + rand() * 10);
      for (let j = 0; j < 2; j++) bushes.push({ p: p.clone().add(V(j * 3, .7, 0)), scale: [2.4 + rand() * 2, 1.5 + rand() * 2, 2.6 + rand() * 2], color: j ? '#7bc644' : '#218a4f' });
      if (rand() > .65) stones.push({ p: p.clone().add(V(4, -.5, 3)), scale: [2 + rand() * 3, 2 + rand() * 4, 2 + rand() * 3], rotation: [rand(), rand(), rand()],color:rand()>.5?'#acb091':'#c0b28c' });
      if (rand() > .5) for (let j = 0; j < 4; j++) flowers.push({ p: p.clone().add(V(j - 1.5, 1.1 + rand(), 2)), scale: [.5, .6, .5], color: j % 2 ? '#ff6fa7' : '#ffe356' });
    }
  }
  // Tall outer trees form true overhead canopy passages with clear road space.
  for (const center of [length * .36, length * .79]) for (let j = -3; j <= 3; j++) {
    const s = center + j * 14;
    if (!awayFromLoops(s, 30)) continue;
    for (const side of [-1, 1]) {
      const top = palm(s, side * 18, 20 + rand() * 4, true);
      bushes.push({ p: top.clone().addScaledVector(frameAt(s).right, -side * 8), scale: [11, 3.5, 9], color: j % 2 ? '#1d7843' : '#2e9252' });
    }
  }
  // Loop structures leave the whole 16 m racing ribbon unobstructed.
  for (const l of loops) {
    const entry = frameAt(l.start), g = localGroup(l.start);
    for (const side of [-1, 1]) {
      mesh(g, new THREE.BoxGeometry(2.4, 14, 3), colors.stone, [side * 13, 6, 25]);
      mesh(g, new THREE.BoxGeometry(5, 1.6, 5), colors.grass, [side * 13, 13.8, 25]);
      palm(l.start - 25, side * 25, 15, true);
    }
    for (let s = l.start + 10; s < l.end; s += 12) {
      const f = frameAt(s); for (const side of [-1, 1]) {
        const bolt = localGroup(s, side * 8.85, 0); mesh(bolt, new THREE.BoxGeometry(.3, .3, 1.5), colors.gold);
      }
    }
    mesh(g, new THREE.BoxGeometry(25, 1, 2.5), colors.turquoise, [0, 11, -27]);
    for (const side of [-1, 1]) mesh(g, new THREE.BoxGeometry(1, 11, 1), colors.stone, [side * 11.5, 5.5, -27]);
    // Keep vegetation behind loop silhouettes so inversion reads from afar.
    // Stay on the opposite side from the loop's lateral drift. Every offset is
    // frame-relative; a world-Z addition previously moved the first rock back
    // into the racing ribbon and obscured Sonic on the loop approach.
    const ledge=entry.position.clone().addScaledVector(entry.right,-58).addScaledVector(entry.forward,28).addScaledVector(entry.up,-10);
    loopStones.push({ p: ledge, scale: [20, 18, 24], rotation: [0, .2, 0],color:'#bcad87' });
    mossLedges.push({p:ledge.clone().add(V(0,17,0)),scale:[15,2.4,19],rotation:[0,.2,0],color:'#73a64b'});
    bushes.push({p:ledge.clone().add(V(3,20,0)),scale:[5,3,5],color:'#4d9f45'});
  }
  for (const s of [length * .3, length * .65, length * .9]) {
    if (!awayFromLoops(s, 30)) continue;
    const gate = localGroup(s);
    for (const side of [-1, 1]) {
      mesh(gate, new THREE.BoxGeometry(3, 13, 3.4), colors.stone, [side * 11, 5.8, 0]);
      mesh(gate, new THREE.BoxGeometry(4.3, 1, 4.5), colors.grass, [side * 11, 12.8, 0]);
      mesh(gate, new THREE.BoxGeometry(.25, 5.5, .22), colors.turquoise, [side * 9.42, 6.5, 1.8]);
    }
    mesh(gate, new THREE.BoxGeometry(25, 2.1, 4), colors.stone, [0, 13, 0]);
    mesh(gate, new THREE.ConeGeometry(9, 4, 4), colors.grass, [0, 16, 0], [1, 1, .35], [0, Math.PI / 4, 0]);
    const accents=[];
    for(const side of [-1,1])for(let j=0;j<4;j++){
      accents.push({p:V(side*11,2+j*3,1.74),scale:[.55,.6,.065],rotation:[0,0,Math.PI/4]});
      accents.push({p:V(side*11,1+j*3,0),scale:[3.3,.12,3.7]});
    }
    for(let j=-4;j<=4;j++)accents.push({p:V(j*2.3,13,2.04),scale:[.42,.6,.06],rotation:[0,0,Math.PI/4]});
    instanced(gate,new THREE.BoxGeometry(1,1,1),material('#588e71'),accents);
  }
  // A raised bridge looks directly into a waterfall gorge.
  const waterfallS = (ravine.start + ravine.end) / 2, cliff = localGroup(waterfallS, -48, -3);
  mesh(cliff, new THREE.BoxGeometry(32, 52, 22), colors.stone, [0, -5, 0]);
  mesh(cliff, new THREE.BoxGeometry(36, 4, 25), colors.grass, [0, 22, 0]);
  const waterMat = surfaceMaterial('water',{ color: '#b6f4ff', roughness: .15, transparent: true, opacity: .84, emissive: '#1384a1', emissiveIntensity: .18, side: THREE.DoubleSide,repeat:[1,10] });
  for (let j = 0; j < 7; j++) {
    const fall = mesh(cliff, new THREE.PlaneGeometry(1.5, 54), waterMat.clone(), [16.05 + (j % 2) * .1, -4, -5.4 + j * 1.8], [1, 1, 1], [0, Math.PI / 2, 0]); waterfalls.push(fall);
  }
  waterMat.dispose();
  const mistPositions=[];for(let j=0;j<48;j++)mistPositions.push(17+rand()*7,-28+rand()*6,-10+rand()*20);
  const mistGeometry=new THREE.BufferGeometry();mistGeometry.setAttribute('position',new THREE.Float32BufferAttribute(mistPositions,3));
  const mist=new THREE.Points(mistGeometry,new THREE.PointsMaterial({color:'#d0faff',size:.6,transparent:true,opacity:.42,depthWrite:false}));cliff.add(mist);
  for (let j = 0; j < 14; j++) mesh(cliff, new THREE.SphereGeometry(1, 7, 5), material('#e4fcff'), [16 + rand() * 9, -30 + rand() * 2, -9 + rand() * 18], [2.5, .65, 2.5]);
  const water = mesh(group, new THREE.CircleGeometry(1900, 80), surfaceMaterial('water',{color:'#23aebe',roughness:.25,metalness:.15,repeat:[200,200]}), [0, -24, 0], [1, 1, 1], [-Math.PI / 2, 0, 0]); water.castShadow = false;
  // Off-course mountains surround the clearing, never the track.
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * Math.PI * 2, r = 620 + rand() * 220, h = 70 + rand() * 100;
    const p = V(Math.sin(a) * r, -20, Math.cos(a) * r);
    const w=55+rand()*50,d=55+rand()*50,yaw=rand()*3;
    // Stepped, irregular cliffs with exposed grassy caps replace giant rounded
    // boulders. Cap heights follow the actual top face instead of sitting buried
    // inside the rock. The changing silhouettes read across the jungle valley.
    for(let tier=0;tier<3;tier++) {
      const factor=1.25-tier*.24,height=h*(.35-tier*.075);
      const center=p.clone().add(V(Math.sin(yaw)*tier*10,h*(.15+tier*.245),Math.cos(yaw)*tier*10));
      cliffTerraces.push({p:center,scale:[w*factor,height,d*factor],rotation:[0,yaw+tier*.12,0],color:tier%2?'#ac9979':'#c7b38c'});
      const summit=center.clone().add(V(0,height*.5+.6,0));
      mossLedges.push({p:summit,scale:[w*factor*.71,2.2+rand()*1.4,d*factor*.71],rotation:[0,yaw+tier*.12,0],color:tier%2?'#6ba345':'#4b8e49'});
      if(tier===2)for(let k=0;k<3;k++) {
        const treeBase=summit.clone().add(V((k-1)*w*.15,1.6,(rand()-.5)*d*.22)),treeHeight=11+rand()*7,crown=treeBase.clone().add(V(0,treeHeight,0));
        trunks.push({p:treeBase.clone().add(V(0,treeHeight*.5,0)),scale:[.8,treeHeight,.8]});
        for(let j=0;j<8;j++)leaves.push({p:crown,scale:[2.8,3.3,7.5],rotation:[0,j*Math.PI/4+i,0],color:j%2?'#2a7a3b':'#65aa3e'});
        bushes.push({p:summit.clone().add(V((k-1)*w*.18,3.4,(k%2?1:-1)*d*.12)),scale:[7+rand()*4,3.5,6+rand()*3],color:'#4e9b45'});
      }
    }
  }
  instanced(group, new THREE.CylinderGeometry(.7, 1, 1, 12), colors.wood, trunks);
  instanced(group, frondGeometry(), colors.leaf, leaves);
  instanced(group, new THREE.IcosahedronGeometry(1, 1), material('#ffffff'), bushes);
  instanced(group, new THREE.DodecahedronGeometry(1, 1), surfaceMaterial('rock'), stones);
  const loopRocks=instanced(group,new THREE.DodecahedronGeometry(1,1),surfaceMaterial('rock'),loopStones);loopRocks.name='loop-rock-outcrops';
  instanced(group,new THREE.CylinderGeometry(.7,1,1,8),surfaceMaterial('rock',{repeat:[3,2]}),cliffTerraces);
  instanced(group,new THREE.CylinderGeometry(.84,1,1,7),surfaceMaterial('grass'),mossLedges);
  instanced(group, new THREE.SphereGeometry(1, 6, 5), material('#ffffff'), flowers);

  const ringMat = material('#ffd83d', '#ca8a08'); ringMat.roughness = .2;
  function item(type, s, lane = 0, extra = {}) {
    s = mod(s, length); const g = localGroup(s, lane);
    if (type === 'ring') mesh(g, new THREE.TorusGeometry(.67, .14, 7, 16), ringMat, [0, 1.5, 0]);
    if (type === 'boost') {
      mesh(g, new THREE.BoxGeometry(3.1, .12, 5), colors.turquoise, [0, .09, 0]);
      for (const z of [-1.4, .4]) for (const side of [-1, 1]) mesh(g, new THREE.BoxGeometry(.18, .05, 1.5), colors.gold, [side * .48, .18, z], [1, 1, 1], [0, side * -.7, 0]);
    }
    if (type === 'hazard') {
      mesh(g, new THREE.CylinderGeometry(1.3, 1.5, .35, 8), colors.wood, [0, .15, 0]);
      for (const x of [-.65, 0, .65]) mesh(g, new THREE.ConeGeometry(.28, 1.2, 6), material('#dceced'), [x, .85, 0]);
    }
    if (type === 'spring') {
      mesh(g, new THREE.CylinderGeometry(1.1, 1.1, .2, 12), colors.stone, [0, .12, 0]);
      for (let j = 0; j < 4; j++) mesh(g, new THREE.TorusGeometry(.55, .08, 5, 16), colors.gold, [0, .24 + j * .17, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
      mesh(g, new THREE.CylinderGeometry(1.15, 1.15, .25, 12), material('#f04250'), [0, 1, 0]);
    }
    if (type === 'log') {
      mesh(g, new THREE.CylinderGeometry(.76, .83, 5, 14), colors.wood, [0, .76, 0], [1, 1, 1], [0, 0, Math.PI / 2]);
      const cutwood=material('#deb376'),grain=material('#986739');
      for (const x of [-2.52, 2.52]) {
        mesh(g, new THREE.CylinderGeometry(.65, .65, .025, 14), cutwood, [x, .76, 0], [1, 1, 1], [0, 0, Math.PI / 2]);
        for(const r of [.2,.38,.57])mesh(g,new THREE.TorusGeometry(r,.018,4,20),grain,[x+Math.sign(x)*.019,.76,0],[1,1,1],[0,Math.PI/2,0]);
      }
      mesh(g, new THREE.CylinderGeometry(.16, .24, 1.5, 6), colors.wood, [.7, 1.25, 0], [1, 1, 1], [0, 0, -.6]);
      mergeBirdParts(g);
    }
    if (type === 'pendulum') {
      mesh(g, new THREE.IcosahedronGeometry(1.4, 1), material('#bb7b32'), [0, 1.6, 0]);
      for (let j = 0; j < 6; j++) mesh(g, new THREE.ConeGeometry(.26, .9, 5), colors.gold, [Math.cos(j * Math.PI / 3) * 1.3, 1.6 + Math.sin(j * Math.PI / 3) * 1.3, 0], [1, 1, 1], [0, 0, j * Math.PI / 3 - Math.PI / 2]);
      const rig = localGroup(s), chain = mesh(rig, new THREE.CylinderGeometry(.07, .07, 1, 5), colors.wood);
      for (const side of [-1, 1]) mesh(rig, new THREE.CylinderGeometry(.5, .7, 12, 7), colors.wood, [side * 11, 6, 0]);
      mesh(rig, new THREE.BoxGeometry(23, .8, .8), colors.wood, [0, 12, 0]);
      extra = { swayAmplitude: 5, swayFrequency: 1.5, phase: s * .011, ...extra, chain, rig }; pendulums.push({ g, s, lane, extra });
    }
    const entry = { type, s, lane, mesh: g, collected: false, ...extra }; items.push(entry); return entry;
  }
  // Rings teach lines through varied terrain. Obstacles have generous recovery.
  for (let block = 0; block < 64; block++) {
    const s = 36 + block * (length - 90) / 64, lane = [-4, 0, 4, 0][block % 4];
    for (let j = 0; j < 5; j++) item('ring', s + j * 4.2, lane);
    if (!awayFromLoops(s, 70) || !awayFromLoops(s + 27, 65)) continue;
    if (block % 8 === 2) item('log', s + 27, lane, { height: 1.65 });
    else if (block % 8 === 5) item('pendulum', s + 30, 0, { height: 2.8 });
    else if (block % 4 === 0) item('hazard', s + 29, -lane || 4);
    if (block % 9 === 6) item('spring', s + 28, lane === 0 ? -4 : 0);
    if (block % 7 === 3) item('boost', s + 29, -lane);
  }
  for (const l of loops) { for (const lane of [-4, 0, 4]) item('boost', l.start - 36, lane); }
  // Authored macaws sit visibly above the verge, then swoop into the course.
  const birdPalette = [material('#ed3945'), material('#2279da'), material('#ffdc38'), material('#fff3d8'), material('#222943')];
  const birdOrange=material('#f46738'),birdHighlight=material('#fffaf0');
  const birdSites = [length * .14, length * .29, length * .39, length * .57, length * .71, length * .84, length * .94].filter(s => awayFromLoops(s, 80));
  birdSites.forEach((s, id) => {
    const side = id % 2 ? 1 : -1, g = new THREE.Group(); group.add(g);
    const wingL = new THREE.Group(), wingR = new THREE.Group(); wingL.position.set(-.45, .18, 0); wingR.position.set(.45, .18, 0); g.add(wingL, wingR);
    mesh(g, new THREE.SphereGeometry(1, 16, 12), birdPalette[0], [0, .15, 0], [.58, .85, .53]);
    mesh(g, new THREE.SphereGeometry(1,12,8),birdOrange,[0,.18,.36],[.39,.59,.2]);
    mesh(g, new THREE.SphereGeometry(.49, 16, 12), birdPalette[0], [0, .88, .18]);
    for (const side of [-1, 1]) {
      mesh(g, new THREE.SphereGeometry(.2, 8, 6), birdPalette[3], [side * .36, 1, .38], [1, 1, .5]);
      mesh(g, new THREE.SphereGeometry(.08, 7, 5), birdPalette[4], [side * .38, 1.03, .47]);
      mesh(g,new THREE.SphereGeometry(.027,6,4),birdHighlight,[side*.399,1.064,.5]);
      for(let j=0;j<3;j++)mesh(g,new THREE.BoxGeometry(.11,.017,.022),birdPalette[4],[side*.407,.89+j*.045,.4],[1,1,1],[0,side*.6,0]);
      mesh(g, new THREE.CylinderGeometry(.04, .04, .3, 5), birdPalette[4], [side * .22, -.65, .1]);
      for(let j=0;j<3;j++)mesh(g,new THREE.CylinderGeometry(.022,.023,.22,5),birdPalette[4],[side*.22+(j-1)*.05,-.8,.16],[1,1,1],[Math.PI/2,0,0]);
    }
    mesh(g, new THREE.SphereGeometry(1,12,8), birdPalette[3], [0, .86, .69], [.21,.2,.31]);
    mesh(g, new THREE.ConeGeometry(.15,.36,10),birdPalette[4],[0,.67,.88],[1,1,1],[Math.PI-.25,0,0]);
    for (const [wing, sign] of [[wingL, -1], [wingR, 1]]) {
      mesh(wing, new THREE.SphereGeometry(1, 8, 5), birdPalette[0], [sign * .52, 0, -.04], [.8, .15, .5]);
      for (let j = 0; j < 7; j++) mesh(wing, new THREE.SphereGeometry(1, 9, 6), birdPalette[j < 3 ? 2 : 1], [sign * (.6 + j * .17), -.015-j*.005, -.11 - j * .07], [.4+(j/7)*.1, .07, .24]);
      for(let j=0;j<5;j++)mesh(wing,new THREE.SphereGeometry(1,8,5),birdPalette[j<2?0:2],[sign*(.42+j*.14),.065,.14-j*.015],[.22,.075,.18]);
      mergeBirdParts(wing);
    }
    for (const x of [-.2, 0, .2]) mesh(g, new THREE.ConeGeometry(.15, 1.9, 6), birdPalette[1], [x, -.7, -.68], [1, 1, 1], [-.45, 0, Math.PI]);
    mergeBirdParts(g);
    const perch = palm(s, side * 18, 12, true);
    // A horizontal branch clearly connects the waiting bird to its tree.
    const branch = localGroup(s, side * 18, 9.5); mesh(branch, new THREE.CylinderGeometry(.18, .3, 5, 7), colors.wood, [-side * 2, 0, 0], [1, 1, 1], [0, 0, Math.PI / 2]);
    const descriptor = { id, s, side, treeOffset: 16, perchHeight: 10, warningDistance: 95, attackDuration: 1.4, hitOffset: 0, knockDirection: -side, mesh: g, wings: [wingL, wingR], perch: place(s, side * 16, 10) };
    g.position.copy(descriptor.perch); g.quaternion.copy(frameQuaternion(frameAt(s))); parrots.push(descriptor);
  });
  // Parrot palms are included after bird authoring without duplicating the first batch.
  const lateTrunks = trunks.slice(-birdSites.length), lateLeaves = leaves.slice(-birdSites.length * 8);
  instanced(group, new THREE.CylinderGeometry(.7, 1, 1, 12), colors.wood, lateTrunks);
  instanced(group, frondGeometry(), colors.leaf, lateLeaves);
  instanced(group,new THREE.SphereGeometry(1,10,7),surfaceMaterial('wood',{color:'#75583b'}),coconuts);
  instanced(group,new THREE.TorusGeometry(1,.085,4,12),material('#705331'),growthRings);
  instanced(group,new THREE.CylinderGeometry(.9,1.1,1,7),colors.wood,roots);
  const start = localGroup(0);
  for (const side of [-1, 1]) { mesh(start, new THREE.CylinderGeometry(.55, .8, 9, 8), colors.stone, [side * 10, 4.5, 0]); mesh(start, new THREE.ConeGeometry(1.1, 2.5, 7), colors.gold, [side * 10, 10, 0]); }
  mesh(start, new THREE.BoxGeometry(21, 1.8, 1), colors.turquoise, [0, 8.8, 0]);
  for (let x = 0; x < 16; x++) for (let z = 0; z < 3; z++) mesh(start, new THREE.BoxGeometry(1, .05, 1), material((x + z) % 2 ? '#244e4b' : '#fff8dc'), [x - 7.5, .09, z - 1]);
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 128; const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#12887f'; ctx.fillRect(0, 0, 1024, 128); ctx.fillStyle = '#fff4bc'; ctx.font = '900 65px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('PARROT PARADISE', 512, 68);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    mesh(start, new THREE.PlaneGeometry(18, 2.25), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }), [0, 8.8, .52]);
  }
  const minimapPoints = Array.from({ length: 301 }, (_, i) => { const p = curve.getPointAt(i / 300); return { x: p.x, z: p.z }; });
  const detail=addWorldDetail({group,curve,length,index:3,frameAt,loops,excludeRanges:[ravine]});
  function update(time, dt = 0, race = null) {
    detail.update(time);water.material.map.offset.set(time*.004,time*.003);water.material.bumpMap.offset.copy(water.material.map.offset);mist.material.opacity=.36+Math.sin(time*1.2)*.06;
    for (const i of items) if (i.type === 'ring' && !i.collected) { i.mesh.children[0].rotation.y += dt * 1.8; i.mesh.children[0].position.y = 1.5 + Math.sin(time * 3 + i.s * .08) * .1; }
    for (const { g, s, lane, extra } of pendulums) {
      const offset = lane + extra.swayAmplitude * Math.sin(time * extra.swayFrequency + extra.phase); g.position.copy(place(s, offset));
      const top = V(0, 11.8, 0), bottom = V(offset, 2.4, 0), delta = top.clone().sub(bottom);
      extra.chain.position.copy(top).add(bottom).multiplyScalar(.5); extra.chain.scale.y = delta.length(); extra.chain.quaternion.setFromUnitVectors(Y, delta.normalize());
    }
    for (let j = 0; j < waterfalls.length; j++) { waterfalls[j].material.opacity = .82 + .04 * Math.sin(time * 5 + j); waterfalls[j].scale.x = 1 + .05 * Math.sin(time * 4 + j);waterfalls[j].material.map.offset.y=-time*.65;waterfalls[j].material.bumpMap.offset.y=-time*.65; }
    const states = race?.parrots || [];
    for (const bird of parrots) {
      const state = Array.isArray(states) ? states.find(p => p.id === bird.id) : states[bird.id];
      const phase = state?.phase || 'perched', progress = THREE.MathUtils.clamp(state?.progress || 0, 0, 1), s = state?.worldS ?? bird.s;
      const targetOffset = state?.targetOffset ?? state?.hitOffset ?? bird.hitOffset;
      const target = place(s, targetOffset, 1.4), perch = bird.perch;
      let p = perch.clone(), tangent = frameAt(s).forward;
      if (phase === 'swooping') {
        // First half dives from its branch; mid-swoop crosses the rider's lane.
        const exit = place(s + 9, -bird.side * 17, 7);
        if (progress < .5) { const u = progress * 2; p.lerp(target, u).addScaledVector(Y, 3 * Math.sin(u * Math.PI)); tangent = target.clone().sub(perch).normalize(); }
        else { const u = (progress - .5) * 2; p.copy(target).lerp(exit, u).addScaledVector(Y, 2.5 * Math.sin(u * Math.PI)); tangent = exit.clone().sub(target).normalize(); }
      } else if (phase === 'returning') {
        const exit = place(s + 9, -bird.side * 17, 7); p.copy(exit).lerp(perch, progress).addScaledVector(Y, 4 * Math.sin(progress * Math.PI)); tangent = perch.clone().sub(exit).normalize();
      } else if (phase === 'warning') p.y += .25 * Math.sin(time * 12 + bird.id);
      bird.mesh.position.copy(p);
      const right = V(tangent.z, 0, -tangent.x).normalize(), up = tangent.clone().cross(right).normalize(); bird.mesh.quaternion.copy(frameQuaternion({ right, up, forward: tangent }));
      const flap = phase === 'perched' ? .12 * Math.sin(time * 2 + bird.id) : .75 * Math.sin(time * 19 + bird.id);
      bird.wings[0].rotation.z = -.25 + flap; bird.wings[1].rotation.z = .25 - flap;
    }
  }
  function dispose() {
    disposeWorld(group);
  }
  return { group, curve, length, halfWidth, items, minimapPoints, loops, parrots, frameAt, update, dispose };
}
