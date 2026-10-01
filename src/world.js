import * as THREE from 'three';
import { createSuperWorld } from './super-track.js';
import { surfaceMaterial, detailedFrondGeometry, addWorldDetail, disposeWorld } from './world-detail.js';

export const TRACKS = [
  { id: 'green-coast', name: 'Emerald Coast', subtitle: 'Palms • waterfalls • ocean curves', color: '#37df91', sky: '#85d9ff', description: 'A sunlit tropical sprint through rolling green islands and golden coastlines.', medalTimes: [49, 63, 82] },
  { id: 'sunset-ruins', name: 'Sunset Ruins', subtitle: 'Ancient arches • canyon climbs', color: '#ffb45f', sky: '#edb4a2', description: 'Race through towering sandstone ruins and sweeping sunset canyon turns.', medalTimes: [53, 69, 88] },
  { id: 'starlight-city', name: 'Starlight Circuit', subtitle: 'Neon towers • sky bridges', color: '#ba87ff', sky: '#161b48', description: 'A luminous skyway winds above a futuristic city under the stars.', medalTimes: [56, 72, 92] },
  { id: 'parrot-jungle', name: 'Parrot Paradise', subtitle: 'SUPER TRACK · Loops • swooping parrots', color: '#ffbf46', sky: '#a5e5ed', description: 'A giant jungle expedition with vertical loops, waterfall bridges, swinging obstacles, and mischievous parrots.', superTrack: true },
];

const UP = new THREE.Vector3(0, 1, 0);
function random(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function mat(color, roughness = .75, emissive = null) {
  return new THREE.MeshStandardMaterial({color, roughness, ...(emissive ? {emissive, emissiveIntensity: .65} : {})});
}
function addMesh(group, geometry, material, position, scale = [1, 1, 1], rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); mesh.scale.set(...scale); mesh.rotation.set(...rotation); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
}
function instances(group, geometry, material, records) {
  if (!records.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, records.length);
  const dummy = new THREE.Object3D();
  records.forEach((record, i) => {
    dummy.position.set(...record.p); dummy.scale.set(...(record.s || [1,1,1])); dummy.rotation.set(...(record.r || [0,0,0])); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    if (record.c) mesh.setColorAt(i, new THREE.Color(record.c));
  });
  mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
}

function checkerMaterial(repeatX=12,repeatY=5) {
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#bd7c40';ctx.fillRect(0,0,128,128);
  ctx.fillStyle='#965429';ctx.fillRect(0,0,64,64);ctx.fillRect(64,64,64,64);
  // Soft inset color variation gives each original tile a little depth.
  ctx.fillStyle='rgba(255,207,129,.15)';ctx.fillRect(2,2,60,5);ctx.fillRect(66,66,60,5);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(repeatX,repeatY);texture.anisotropy=4;
  return new THREE.MeshStandardMaterial({map:texture,roughness:.92});
}

function palmFrondGeometry() {
  return detailedFrondGeometry();
}

function strataMaterial() {
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=256;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#d19665';ctx.fillRect(0,0,128,256);
  const colors=['#ae7053','#dfaa78','#c98b60','#e7b888','#b97a57'];
  for(let i=0;i<22;i++){ctx.fillStyle=colors[i%colors.length];ctx.fillRect(0,i*12,128,i%4===0?7:3);}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(2,2);
  return new THREE.MeshStandardMaterial({map:texture,roughness:.96});
}

function ribbon(curve, offsets, heights, colors, material, samples = 680) {
  const positions = [], vertexColors = [], indices = [], uvs = [];
  for (let i = 0; i <= samples; i++) {
    const p = curve.getPointAt(i / samples), v = curve.getTangentAt(i / samples);
    const right = new THREE.Vector3(v.z, 0, -v.x).normalize();
    for (let j = 0; j < offsets.length; j++) {
      positions.push(p.x + right.x * offsets[j], p.y + heights[j], p.z + right.z * offsets[j]);
      uvs.push(offsets[j] / 6, i / samples * curve.getLength() / 10);
      const color = new THREE.Color(colors[j]); vertexColors.push(color.r, color.g, color.b);
    }
    if (i < samples) for (let j = 0; j < offsets.length - 1; j++) {
      const a = i * offsets.length + j, b = a + offsets.length;
      // Winding points upward for tangent-cross-right convention.
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

function createCourse(index) {
  const points = index === 0 ? [
    [0,4,160], [74,5,138], [126,7,85], [139,11,14], [119,14,-60], [57,10,-127], [-18,7,-155], [-94,6,-129], [-127,4,-62], [-93,4,1], [-127,7,67], [-76,5,137],
  ] : index === 1 ? [
    [0,5,161], [75,8,142], [138,12,91], [148,16,15], [114,24,-53], [143,20,-108], [76,13,-158], [-5,8,-150], [-69,10,-123], [-127,17,-68], [-119,19,3], [-140,12,73], [-72,6,142],
  ] : [
    [0,9,174], [71,12,150], [137,17,96], [149,23,25], [104,22,-44], [123,15,-112], [65,10,-171], [-13,10,-181], [-84,17,-133], [-147,22,-85], [-149,25,-5], [-106,20,46], [-128,13,104], [-68,10,151],
  ];
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), true, 'centripetal');
  curve.arcLengthDivisions = 2400; curve.updateArcLengths(); return curve;
}

export function createWorld(index = 0) {
  index = Math.max(0, Math.min(TRACKS.length-1, index));
  if (index === 3) return createSuperWorld();
  const cfg = TRACKS[index], curve = createCourse(index), length = curve.getLength(), halfWidth = 8;
  const group = new THREE.Group(); group.name = cfg.name;
  const rand = random(19285 + index * 39017);
  const items = [], movers = [];
  const palette = index === 0 ? {road:'#d9ba83', edge:'#ffd767', ground:'#54bd39', earth:'#ac6a35', rail:'#fff8d4'} : index === 1 ? {road:'#b76644', edge:'#ffd088', ground:'#dc9c62', earth:'#9e5246', rail:'#ffe4ac'} : {road:'#253459', edge:'#65eafa', ground:'#273354', earth:'#17243f', rail:'#62e7ff'};
  const vertexMat = surfaceMaterial(index===2?'metal':'sand',{vertexColors: true,roughness:index===2?.65:.9});
  const road = ribbon(curve, [-8,-7.5,7.5,8], [0, .025,.025,0], [palette.edge,palette.road,palette.road,palette.edge], vertexMat); road.receiveShadow = true; group.add(road);
  const shoulders = ribbon(curve, [-11,-8,8,11], [-.35,-.12,-.12,-.35], [palette.earth,palette.edge,palette.edge,palette.earth], vertexMat); group.add(shoulders);
  if (index < 2) {
    const terrain = ribbon(curve, [-64,-51,-35,-12,12,35,51,64], [-12,-5,-2,-1.3,-1.3,-2,-5,-12], [palette.earth,index===0?'#eed08a':'#c07d56',palette.ground,palette.ground,palette.ground,palette.ground,index===0?'#eed08a':'#c07d56',palette.earth], surfaceMaterial(index===0?'grass':'sand',{vertexColors:true,roughness:.97}));
    terrain.receiveShadow = true; group.add(terrain);
  } else {
    const bridge = ribbon(curve, [-10,-10,10,10], [-5,-.35,-.35,-5], [palette.earth,palette.ground,palette.ground,palette.earth], vertexMat); group.add(bridge);
  }
  const sideCurves = [-1, 1].map(side => new THREE.CatmullRomCurve3(Array.from({length: 450}, (_, i) => {
    const p=curve.getPointAt(i/450), tangent=curve.getTangentAt(i/450); return p.add(new THREE.Vector3(tangent.z,0,-tangent.x).normalize().multiplyScalar(side*8.65)).add(new THREE.Vector3(0,.58,0));
  }), true));
  const railMat = mat(palette.rail, .4, index === 2 ? palette.rail : null);
  for (const c of sideCurves) group.add(new THREE.Mesh(new THREE.TubeGeometry(c, 680, index===2?.16:.12, 6, true), railMat));
  const dashRecords=[], curbRecords=[], postRecords=[];
  for(let i=0;i<180;i++) {
    const t=i/180,p=curve.getPointAt(t),v=curve.getTangentAt(t), yaw=Math.atan2(v.x,v.z),right=new THREE.Vector3(v.z,0,-v.x).normalize();
    if(i%2===0) dashRecords.push({p:[p.x,p.y+.045,p.z],s:[.14,.018,2.5],r:[0,yaw,0]});
    for(const side of [-1,1]) {
      const q=p.clone().addScaledVector(right,side*7.72); curbRecords.push({p:[q.x,q.y+.08,q.z],s:[.38,.08,1.8],r:[0,yaw,0],c:i%2===0?palette.rail:palette.edge});
      if(i%3===0) {const q2=p.clone().addScaledVector(right,side*8.65);postRecords.push({p:[q2.x,q2.y+.3,q2.z],s:[.14,.6,.14],r:[0,yaw,0]});}
    }
  }
  instances(group,new THREE.BoxGeometry(1,1,1),mat(index===2?'#67d8f7':'#fff1d2'),dashRecords);
  instances(group,new THREE.BoxGeometry(1,1,1),mat('#ffffff'),curbRecords);
  instances(group,new THREE.BoxGeometry(1,1,1),mat(palette.earth),postRecords);
  const water = addMesh(group,new THREE.CircleGeometry(1800,96),surfaceMaterial('water',{color:index===0?'#27bcdb':index===1?'#a36786':'#111e46',roughness:.27,metalness:.15,repeat:[180,180]}),[0,-15,0],[1,1,1],[-Math.PI/2,0,0]); water.castShadow=false;
  // Scenic foliage / stone uses instancing so the vista stays inexpensive.
  const trunks=[],leaves=[],bushes=[],rocks=[],flowers=[],flowerStems=[],flowerCenters=[],mushroomStems=[],mushroomCaps=[],mushroomDots=[],cliffs=[],terraces=[],islandCaps=[],pillars=[],caps=[],buildings=[],windows=[],citySpire=[],coconuts=[],growthRings=[],columnGrooves=[],columnFeet=[],roofDetails=[],facadeFrames=[];
  for(let i=0;i<210;i++) {
    const t=rand(),p=curve.getPointAt(t),v=curve.getTangentAt(t),right=new THREE.Vector3(v.z,0,-v.x).normalize(),side=rand()>.5?1:-1;
    // Keep even the widest palm fronds, rocks and city blocks outside the 11 m verge.
    const off=side*(22+rand()*29),q=p.clone().addScaledVector(right,off); q.y-=2+Math.max(0,Math.abs(off)-35)*.15;
    if(index===0) {
      const h=6+rand()*7, angle=rand()*Math.PI*2;
      if(i<94) {
        trunks.push({p:[q.x,q.y+h*.5,q.z],s:[.46,h,.46],r:[.08*Math.sin(angle),0,.09*Math.cos(angle)]});
        const top=[q.x+.3*Math.cos(angle),q.y+h,q.z+.3*Math.sin(angle)];
        for(let k=0;k<7;k++) leaves.push({p:[top[0],top[1],top[2]],s:[1.9,2.2,5.1+rand()],r:[.02,k*Math.PI*2/7,0],c:k%2?'#258a39':'#52bd38'});
        for(let k=0;k<3;k++)coconuts.push({p:[top[0]+Math.cos(k*2.1)*.43,top[1]-.55,top[2]+Math.sin(k*2.1)*.43],s:[.36,.44,.36]});
        for(let j=1;j<h;j+=.65)growthRings.push({p:[q.x,q.y+j,q.z],s:[.34,.035,.34],r:[Math.PI/2,0,0]});
      }
      bushes.push({p:[q.x,q.y+.4,q.z],s:[1+rand()*3,1+rand()*2,1+rand()*3],c:i%3?'#4aaf32':'#83d43b'});
      if(i%2===0) {
        // Bright sunflower patches and red spotted mushrooms punctuate the verge.
        for(let f=0;f<3;f++) {
          const fx=q.x+2+f*.75,fz=q.z+1+Math.sin(f*2)*.7,fy=q.y+.8+f*.08;
          flowerStems.push({p:[fx,fy-.35,fz],s:[.065,.8,.065]});
          flowerCenters.push({p:[fx,fy+.16,fz],s:[.17,.18,.15]});
          for(let petal=0;petal<7;petal++){const a=petal*Math.PI*2/7;flowers.push({p:[fx+Math.cos(a)*.29,fy+.16+Math.sin(a)*.29,fz],s:[.19,.2,.075],c:i%4?'#ffdc35':'#ff9fcb'});}
        }
      }
      if(i%7===0)for(let m=0;m<3;m++) {
        const x=q.x-2+m*.85,z=q.z-1+Math.cos(m)*.7,y=q.y+.35,scale=.65+m*.12;
        mushroomStems.push({p:[x,y,z],s:[.18*scale,.7*scale,.18*scale]});
        mushroomCaps.push({p:[x,y+.42*scale,z],s:[.7*scale,.32*scale,.7*scale]});
        for(let dot=0;dot<4;dot++)mushroomDots.push({p:[x+Math.cos(dot*1.7)*.35*scale,y+.67*scale,z+Math.sin(dot*1.7)*.35*scale],s:[.105*scale,.045*scale,.105*scale]});
      }
    } else if(index===1) {
      if(i<100) {
        const h=5+rand()*15;
        pillars.push({p:[q.x,q.y+h/2,q.z],s:[1.3+rand(),h,1.3+rand()],r:[0,rand()*2,rand()*.05],c:i%3?'#e4b878':'#c88d5d'});
        caps.push({p:[q.x,q.y+h+.2,q.z],s:[2.5, .5,2.5],r:[0,rand()*2,0]});
        columnFeet.push({p:[q.x,q.y+.12,q.z],s:[3,.5,3]});
        for(let j=0;j<6;j++){const a=j*Math.PI/3;columnGrooves.push({p:[q.x+Math.cos(a)*1.05,q.y+h*.5,q.z+Math.sin(a)*1.05],s:[.09,h*.88,.09]});}
      }
      if(i%3===0) bushes.push({p:[q.x,q.y+1,q.z],s:[.7,2.2,.7],c:'#658348'});
    } else {
      const h=8+rand()*60,w=5+rand()*6,d=5+rand()*6;
      buildings.push({p:[q.x,-17+h/2,q.z],s:[w,h,d],c:i%3?'#26385c':'#353969'});
      roofDetails.push({p:[q.x,-17+h+.6,q.z],s:[w*.72,1.2,d*.72],c:i%3?'#435572':'#615582'});
      for(const x of [-1,1])facadeFrames.push({p:[q.x+x*w*.43,-17+h*.5,q.z+d*.51],s:[.18,h*.96,.16]});
      for(let j=0;j<Math.min(10,h/5);j++) {
        for(let k=0;k<4;k++){
          windows.push({p:[q.x+(k-1.5)*w*.18,-14+j*5,q.z+d/2+.045],s:[w*.12,.75,.08],c:(i+j+k)%4?'#79b5df':'#ecba82'});
          windows.push({p:[q.x+w/2+.045,-14+j*5,q.z+(k-1.5)*d*.18],s:[.08,.75,d*.12],c:(i+j+k)%3?'#7388c9':'#c395e0'});
        }
      }
      if(i%3===0) citySpire.push({p:[q.x,-15+h+2,q.z],s:[.12,6,.12]});
    }
    if(index<2 && i%2===0) rocks.push({p:[q.x+3,q.y+.1,q.z+3],s:[1+rand()*4,1+rand()*3,1+rand()*4],r:[rand(),rand(),rand()],c:index===0?'#ccbd91':'#b97558'});
  }
  instances(group,new THREE.CylinderGeometry(.75,1,1,12),surfaceMaterial('wood',{color:'#b88858',repeat:[3,10]}),trunks);
  const leafMaterial=surfaceMaterial('grass',{color:'#ffffff'});leafMaterial.side=THREE.DoubleSide;
  instances(group,palmFrondGeometry(),leafMaterial,leaves);
  instances(group,new THREE.IcosahedronGeometry(1,1),mat('#ffffff'),bushes);
  instances(group,new THREE.DodecahedronGeometry(1,1),surfaceMaterial('stone'),rocks);
  instances(group,new THREE.SphereGeometry(1,9,7),surfaceMaterial('wood',{color:'#705637'}),coconuts);
  instances(group,new THREE.TorusGeometry(1,.09,4,12),mat('#6f4e32'),growthRings);
  instances(group,new THREE.CylinderGeometry(1,1,1,6),mat('#96664a'),columnGrooves);
  instances(group,new THREE.BoxGeometry(1,1,1),surfaceMaterial('stone',{color:'#c7986a'}),columnFeet);
  instances(group,new THREE.BoxGeometry(1,1,1),surfaceMaterial('metal'),roofDetails);
  instances(group,new THREE.BoxGeometry(1,1,1),mat('#537493',.5),facadeFrames);
  instances(group,new THREE.SphereGeometry(1,6,4),mat('#ffffff'),flowers);
  instances(group,new THREE.CylinderGeometry(1,1,1,5),mat('#478d36'),flowerStems);
  instances(group,new THREE.SphereGeometry(1,8,6),mat('#925026'),flowerCenters);
  instances(group,new THREE.CylinderGeometry(1,1,1,7),mat('#fff0d0'),mushroomStems);
  instances(group,new THREE.SphereGeometry(1,12,8),mat('#ec3544'),mushroomCaps);
  instances(group,new THREE.SphereGeometry(1,6,4),mat('#fff8e6'),mushroomDots);
  instances(group,new THREE.CylinderGeometry(1,1.15,1,16),surfaceMaterial('stone'),pillars);
  instances(group,new THREE.BoxGeometry(1,1,1),surfaceMaterial('stone',{color:'#f7cf90'}),caps);
  instances(group,new THREE.BoxGeometry(1,1,1),surfaceMaterial('metal',{roughness:.48}),buildings);
  instances(group,new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:'#ffffff'}),windows);
  instances(group,new THREE.CylinderGeometry(1,1,1,5),mat('#56e5fa',.3,'#38a9cf'),citySpire);
  // Far silhouettes frame the view beyond the playable circuit.
  for(let i=0;i<23;i++) {
    const angle=i/23*Math.PI*2, radius=265+rand()*140, h=45+rand()*95;
    const cx=Math.sin(angle)*radius,cz=Math.cos(angle)*radius,w=40+rand()*30,d=40+rand()*30,yaw=rand()*6;
    if(index<2) {
      cliffs.push({p:[cx,-18+h*.28,cz],s:[w,h*.56,d],r:[0,yaw,0]});
      terraces.push({p:[cx+Math.sin(yaw)*8,-18+h*.68,cz+Math.cos(yaw)*8],s:[w*.68,h*.3,d*.68],r:[0,yaw+.17,0]});
      islandCaps.push({p:[cx,-18+h*.56+.4,cz],s:[w*1.02,1.5,d*1.02],r:[0,yaw,0],c:index===0?(i%3?'#64ba43':'#42a55a'):'#e7b888'});
      islandCaps.push({p:[cx+Math.sin(yaw)*8,-18+h*.83+.4,cz+Math.cos(yaw)*8],s:[w*.7,1.5,d*.7],r:[0,yaw+.17,0],c:index===0?'#83cb51':'#f4cb96'});
    } else cliffs.push({p:[cx,-18+h*.36,cz],s:[w,h,d],r:[0,yaw,0],c:'#273459'});
  }
  const cliffSurface=index===0?checkerMaterial():index===1?strataMaterial():mat('#ffffff');
  instances(group,index<2?new THREE.CylinderGeometry(.88,1,1,6):new THREE.ConeGeometry(1,1,9),cliffSurface,cliffs);
  instances(group,new THREE.CylinderGeometry(.82,1,1,6),cliffSurface,terraces);
  instances(group,new THREE.CylinderGeometry(.88,1,1,6),mat('#ffffff'),islandCaps);
  const cloudRecords=[];
  for(let i=0;i<30;i++) {
    const angle=rand()*Math.PI*2,r=170+rand()*300,cx=Math.sin(angle)*r,cz=Math.cos(angle)*r,cy=78+rand()*70;
    for(let j=0;j<4;j++) cloudRecords.push({p:[cx+j*8,cy+(j===1?3:0),cz],s:[9+rand()*7,4+rand()*4,7+rand()*6]});
  }
  const clouds=instances(group,new THREE.SphereGeometry(1,9,7),mat(index===2?'#3b3b76':index===1?'#ffd4b7':'#ffffff'),cloudRecords); if(clouds)clouds.castShadow=false;

  const at = (s,lane,height=0) => {
    const t=((s/length)%1+1)%1,p=curve.getPointAt(t),v=curve.getTangentAt(t); p.add(new THREE.Vector3(v.z,0,-v.x).normalize().multiplyScalar(lane)); p.y+=height; return {p,yaw:Math.atan2(v.x,v.z)};
  };
  function item(type,s,lane) {
    const mesh=new THREE.Group(),pos=at(s,lane); mesh.position.copy(pos.p); mesh.rotation.y=pos.yaw;
    if(type==='ring') {
      addMesh(mesh,new THREE.TorusGeometry(.64,.13,8,18),mat('#ffdc40',.2,'#c08c0e'),[0,1.4,0]);
    } else if(type==='hazard') {
      addMesh(mesh,new THREE.CylinderGeometry(1.2,1.45,.3,8),mat(index===2?'#6541a0':'#876353'),[0,.15,0]);
      for(const x of [-.6,0,.6]) addMesh(mesh,new THREE.ConeGeometry(.26,1.15,7),mat('#e2e9ed',.28),[x,.8,0]);
    } else if(type==='boost') {
      addMesh(mesh,new THREE.BoxGeometry(3.1,.1,5),mat(index===2?'#7459fa':'#147f9e',.4,'#075875'),[0,.1,0]);
      const arrow=new THREE.Shape(); arrow.moveTo(-.9,-.7);arrow.lineTo(0,.6);arrow.lineTo(.9,-.7);arrow.lineTo(.9,0);arrow.lineTo(0,1.3);arrow.lineTo(-.9,0);arrow.closePath();
      for(const z of [-1.4,.35]) addMesh(mesh,new THREE.ShapeGeometry(arrow),new THREE.MeshBasicMaterial({color:'#8dffff',side:THREE.DoubleSide}),[0,.17,z],[1,1,1],[-Math.PI/2,0,Math.PI]);
    } else {
      addMesh(mesh,new THREE.CylinderGeometry(1,1,.2,12),mat('#b7cad0',.25),[0,.14,0]);
      addMesh(mesh,new THREE.CylinderGeometry(.48,.48,.65,8),mat('#ffdf48',.3),[0,.48,0]);
      addMesh(mesh,new THREE.CylinderGeometry(1.1,1.1,.25,12),mat('#ef3849',.35),[0,.95,0]);
      addMesh(mesh,new THREE.TorusGeometry(.64,.06,6,20),mat('#fff0c1'),[0,1.09,0],[1,1,1],[Math.PI/2,0,0]);
    }
    group.add(mesh); const entry={type,s,lane,mesh,collected:false}; items.push(entry); if(type==='ring')movers.push(entry);
  }
  for(let block=0;block<29;block++) {
    const s=28+block*(length-65)/29;
    const lane=[-4,0,4][block%3];
    const hazardLane=[-4,0,4][(Math.floor(block/3)+index)%3];
    for(let j=0;j<4;j++)item('ring',s+j*3.8,lane);
    if(block%3===1)item('hazard',s+17,hazardLane);
    if(block%5===2)item('boost',s+19,-lane);
    if(block%9===4) {
      let springLane=lane===0?4:0;
      // A nearby hazard must never block a spring's approach.
      if(block%3===1 && springLane===hazardLane)springLane=-4;
      item('spring',s+19,springLane);
    }
  }
  // Start gantry, checkered road line and pennants read clearly at racing speed.
  const start=new THREE.Group(),startPos=at(0,0); start.position.copy(startPos.p);start.rotation.y=startPos.yaw;group.add(start);
  const gantry=mat(index===2?'#b58cff':'#f6faf4',.4,index===2?'#674498':null);
  for(const side of [-1,1]) {addMesh(start,new THREE.BoxGeometry(.65,8,.65),gantry,[side*9,4,0]);addMesh(start,new THREE.ConeGeometry(.9,2,6),mat(cfg.color),[side*9,9,0]);}
  addMesh(start,new THREE.BoxGeometry(19,1.4,.7),mat(index===2?'#393658':'#166275'),[0,8,0]);
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle=index===2?'#343161':'#156579';ctx.fillRect(0,0,1024,128);ctx.fillStyle='#ffffff';ctx.font='900 62px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('SONIC  •  GO!',512,68);
  const labelTexture=new THREE.CanvasTexture(canvas);labelTexture.colorSpace=THREE.SRGBColorSpace;
  addMesh(start,new THREE.PlaneGeometry(16.8,2.1),new THREE.MeshBasicMaterial({map:labelTexture,side:THREE.DoubleSide}),[0,8.02,.38]);
  const checks=[];
  for(let x=0;x<16;x++)for(let z=0;z<3;z++)checks.push({p:[x-7.5,.05,z-1],s:[1,.03,1],c:(x+z)%2?'#203344':'#fff9df'});
  instances(start,new THREE.BoxGeometry(1,1,1),mat('#ffffff'),checks);
  for(let side of [-1,1])for(let i=0;i<6;i++) {
    const flag=addMesh(start,new THREE.PlaneGeometry(1.4,.8),new THREE.MeshBasicMaterial({color:i%2?cfg.color:'#ffe57a',side:THREE.DoubleSide}),[side*8.2,5.7-i*.14,-3-i*2.5]);flag.rotation.y=side*Math.PI/2;
  }
  // Track-specific hero landmarks, placed off the racing line.
  if(index===0) {
    const loopPos=at(length*.24,35,9);addMesh(group,new THREE.TorusGeometry(14,2,12,64),checkerMaterial(22,3),loopPos.p.toArray(),[1,1,1],[0,loopPos.yaw,0]);
    addMesh(group,new THREE.TorusGeometry(14, .65,8,64),mat('#65bd3e'),[loopPos.p.x,loopPos.p.y+.7,loopPos.p.z],[1,1,1],[0,loopPos.yaw,0]);
    const waterfall=at(length*.53,-39,0), wf=new THREE.Group();wf.position.copy(waterfall.p);wf.rotation.y=waterfall.yaw;group.add(wf);
    addMesh(wf,new THREE.BoxGeometry(20,30,11),checkerMaterial(4,5),[0,6,0]);addMesh(wf,new THREE.BoxGeometry(23,3,14),surfaceMaterial('grass',{color:'#60b53a'}),[0,22,0]);
    const fall=addMesh(wf,new THREE.PlaneGeometry(7,35),surfaceMaterial('water',{color:'#b2f5ff',roughness:.2,transparent:true,opacity:.87,emissive:'#2485a9',emissiveIntensity:.18,side:THREE.DoubleSide,repeat:[2,7]}),[0,5,5.6]);movers.push({waterfall:fall});
    const streams=[];for(let j=0;j<12;j++)streams.push({p:[-3+j*.53,5,5.68],s:[.045+(j%3)*.04,34,.035],c:j%2?'#e4fdff':'#62cddb'});
    instances(wf,new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:'#fff',transparent:true,opacity:.37}),streams);
    for(let i=0;i<8;i++)addMesh(wf,new THREE.SphereGeometry(1,8,6),mat('#e5ffff'),[-3+rand()*6,-11+rand()*2,5+rand()*3],[2,.8,2]);
    addMesh(group,new THREE.SphereGeometry(7,24,16),new THREE.MeshBasicMaterial({color:'#fff3ba'}),[-180,140,-340]);
  } else if(index===1) {
    for(const t of [.24,.52,.74]) {
      const where=at(t*length,t===.52?-37:36),temple=new THREE.Group();temple.position.copy(where.p);temple.rotation.y=where.yaw;group.add(temple);
      const masonry=surfaceMaterial('stone',{color:'#e7b679',repeat:[2,5]});
      for(const side of [-1,1]) {addMesh(temple,new THREE.BoxGeometry(5,28,5),masonry,[side*12,12,0]);addMesh(temple,new THREE.BoxGeometry(7,2,7),surfaceMaterial('stone',{color:'#f6d29a'}),[side*12,27,0]);}
      addMesh(temple,new THREE.BoxGeometry(31,5,7),surfaceMaterial('stone',{color:'#d8a06d',repeat:[6,1]}),[0,27,0]);
      addMesh(temple,new THREE.CylinderGeometry(0,22,6,4),mat('#b57556'),[0,33,0],[1,1,.4],[0,Math.PI/4,0]);
      const carvings=[],bands=[];
      for(const side of [-1,1])for(let j=0;j<6;j++){
        bands.push({p:[side*12,j*4+.5,0],s:[5.4,.18,5.4]});
        carvings.push({p:[side*12,j*4+2.3,2.56],s:[.42,.6,.09],r:[0,0,Math.PI/4]});
        for(const x of [-1.45,1.45])carvings.push({p:[side*12+x,j*4+2.3,2.56],s:[.08,1.1,.08]});
      }
      for(let j=-6;j<=6;j++)carvings.push({p:[j*2,27,3.55],s:[.45,.5,.08],r:[0,0,Math.PI/4]});
      instances(temple,new THREE.BoxGeometry(1,1,1),mat('#aa7754'),bands);
      instances(temple,new THREE.BoxGeometry(1,1,1),mat('#498e89'),carvings);
      for(const side of [-1,1]){addMesh(temple,new THREE.BoxGeometry(9,1,9),surfaceMaterial('stone',{color:'#bd8b66'}),[side*12,-1.4,0]);addMesh(temple,new THREE.BoxGeometry(11,.8,11),surfaceMaterial('stone',{color:'#d7aa7a'}),[side*12,-2.2,0]);}
    }
    addMesh(group,new THREE.SphereGeometry(18,32,20),new THREE.MeshBasicMaterial({color:'#ffdd93'}),[-190,90,-360]);
    const birds=[];for(let i=0;i<18;i++)birds.push({p:[-180+rand()*250,70+rand()*35,-160+rand()*260],s:[2,.1,.8],r:[0,rand()*3,rand()*.3]});instances(group,new THREE.ConeGeometry(1,1,3),mat('#705375'),birds);
  } else {
    const starPositions=[];for(let i=0;i<550;i++){const theta=rand()*Math.PI*2,phi=rand()*Math.PI*.42,r=550;starPositions.push(Math.cos(theta)*Math.sin(phi)*r,Math.cos(phi)*r,Math.sin(theta)*Math.sin(phi)*r);}
    const starsGeometry=new THREE.BufferGeometry();starsGeometry.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));group.add(new THREE.Points(starsGeometry,new THREE.PointsMaterial({color:'#cfe1ff',size:1.1,sizeAttenuation:true})));
    addMesh(group,new THREE.SphereGeometry(34,32,20),mat('#8379ba',.9),[-230,170,-380]);
    addMesh(group,new THREE.TorusGeometry(53,2,8,96),mat('#e7bafa',.4,'#574475'),[-230,170,-380],[1,1,1],[1.1,.3,.25]);
    const observatory=at(length*.44,-48,0),spire=new THREE.Group();spire.position.copy(observatory.p);group.add(spire);
    addMesh(spire,new THREE.CylinderGeometry(7,10,6,8),mat('#443c70'),[0,0,0]);
    addMesh(spire,new THREE.CylinderGeometry(3,6,43,6),mat('#52598a',.35),[0,23,0]);
    addMesh(spire,new THREE.CylinderGeometry(1,1,48,8),mat('#a67bff',.3,'#8a51ed'),[0,26,0]);
    addMesh(spire,new THREE.TorusGeometry(19,.6,8,80),mat('#7df2ff',.3,'#49cddd'),[0,34,0],[1,1,1],[Math.PI/2+.2,0,.15]);
    addMesh(spire,new THREE.TorusGeometry(13,.45,8,64),mat('#e8a1ff',.3,'#bf68da'),[0,43,0],[1,1,1],[Math.PI/2-.35,0,-.2]);
    addMesh(spire,new THREE.SphereGeometry(4.5,20,14),mat('#b89aff',.25,'#7955b4'),[0,48,0]);
    for(const t of [.22,.5,.77]) {
      const where=at(t*length,0,19);const gate=addMesh(group,new THREE.TorusGeometry(14,.32,8,64),mat(t===.5?'#df7cff':'#5de6ff',.3,t===.5?'#c347ef':'#21bad9'),where.p.toArray(),[1,.9,1],[0,where.yaw,0]);movers.push({gate});
    }
    for(let i=0;i<28;i++){const t=i/28,p=at(t*length,0,-9).p;addMesh(group,new THREE.CylinderGeometry(2.5,4,35,8),mat('#23314f'),[p.x,p.y-17,p.z]);}
  }
  const minimapPoints=Array.from({length:181},(_,i)=> {const p=curve.getPointAt(i/180);return {x:p.x,z:p.z};});
  const detail=addWorldDetail({group,curve,length,index});
  function update(time,dt=0) {
    detail.update(time);water.material.map.offset.set(time*.005,time*.002);water.material.bumpMap.offset.copy(water.material.map.offset);
    for(const entry of movers) {
      if(entry.type==='ring' && !entry.collected) {entry.mesh.rotation.y+=dt*1.7; entry.mesh.children[0].position.y=1.4+Math.sin(time*2.5+entry.s*.12)*.13;}
      if(entry.gate)entry.gate.material.emissiveIntensity=.65+Math.sin(time*2)*.25;
      if(entry.waterfall){entry.waterfall.material.opacity=.84+Math.sin(time*4)*.035;entry.waterfall.material.map.offset.y=-time*.7;entry.waterfall.material.bumpMap.offset.y=-time*.7;}
    }
  }
  function dispose() {
    disposeWorld(group);
  }
  return {group,curve,length,halfWidth,items,minimapPoints,update,dispose};
}
