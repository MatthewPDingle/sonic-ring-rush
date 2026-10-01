import * as THREE from 'three';

// Small, deterministic tiled surfaces keep the complete game local and offline.
export function surfaceMaterial(kind, options = {}) {
  const size = 128, pixels = new Uint8Array(size * size * 4), heights = new Uint8Array(pixels.length);
  let seed = 5217; const noise = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = noise(), fine = (n - .5) * .13; let tone = .94 + fine, bump = .48 + (n - .5) * .25;
    if (kind === 'sand') { tone = .93 + fine + .025 * Math.sin(x * .19 + Math.sin(y * .08)); bump = n * .38 + .3; }
    if (kind === 'grass') { tone = .96 + fine * .18 + .017 * Math.sin(x * .2) * Math.sin(y * .32); bump = .5 + (n - .5) * .16; }
    if (kind === 'stone') { const seam = y % 32 < 2 || (x + (Math.floor(y / 32) % 2) * 32) % 64 < 2; tone = seam ? .56 : .92 + fine + .035 * Math.sin(y * .8); bump = seam ? .08 : .55 + n * .12; }
    if (kind === 'rock') { tone=.89+fine+.055*Math.sin(y*.3+Math.sin(x*.07));bump=.5+(n-.5)*.22+.08*Math.sin(y*.3); }
    if (kind === 'wood') { const grain = Math.sin(x * .44 + Math.sin(y * .043) * 1.7) * Math.sin(x * .19); tone = .85 + grain * .12 + fine; bump = .52 + grain * .2; }
    if (kind === 'metal') { const seam = y % 32 < 1 || x % 64 < 1; tone = seam ? .56 : .94 + fine * .2; bump = seam ? .1 : .5; }
    if (kind === 'water') { const ripple = Math.sin(x * Math.PI / 16 + Math.sin(y * Math.PI / 32)) * Math.cos(y * Math.PI / 16); tone = .97 + ripple * .018; bump = .5 + ripple * .04; }
    if (kind === 'checker') { const tile = ((x >> 5) + (y >> 5)) % 2; tone = (tile ? .68 : .94) + fine; bump = x % 32 < 1 || y % 32 < 1 ? .22 : .5 + n * .05; }
    const i = (y * size + x) * 4, c = Math.round(Math.max(0, Math.min(1, tone)) * 255), h = Math.round(bump * 255);
    pixels[i] = pixels[i + 1] = pixels[i + 2] = c; pixels[i + 3] = 255;
    heights[i] = heights[i + 1] = heights[i + 2] = h; heights[i + 3] = 255;
  }
  const map = new THREE.DataTexture(pixels, size, size), bumpMap = new THREE.DataTexture(heights, size, size);
  for (const tex of [map, bumpMap]) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.repeat.set(...(options.repeat || [1, 1])); tex.anisotropy = 4; tex.needsUpdate = true; }
  map.colorSpace = THREE.SRGBColorSpace;
  const { repeat, ...materialOptions } = options;
  return new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .85, map, bumpMap, bumpScale: kind === 'water' ? .045 : kind === 'grass' ? .025 : kind === 'sand' ? .02 : .07, ...materialOptions });
}

export function detailedFrondGeometry() {
  const vertices = [], uv = [], indices = [];
  // Individual tapered leaflets, connected to a narrow curved central rib.
  for (let i = 0; i < 15; i++) {
    const t = i / 15, next = (i + 1) / 15, y = u => .32 * Math.sin(u * Math.PI) - .29 * u * u;
    const width = .54 * Math.sin(Math.PI * Math.pow(t + .03, .8)) + .015;
    const a = vertices.length / 3;
    vertices.push(-.022,y(t)+.02,t,.022,y(t)+.02,t,-.018,y(next)+.02,next,.018,y(next)+.02,next);
    uv.push(.48,t,.52,t,.48,next,.52,next); indices.push(a,a+2,a+1,a+1,a+2,a+3);
    for (const side of [-1,1]) {
      const b = vertices.length / 3;
      vertices.push(side*.018,y(t),t,side*width,y(t)-.035,t+.105,side*.024,y(next),next);
      uv.push(.5,t,side<0?0:1,t+.07,.5,next); indices.push(b,b+1,b+2);
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)); geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

function batch(group, geometry, material, records) {
  if (!records.length) { geometry.dispose();for(const value of Object.values(material))if(value?.isTexture)value.dispose();material.dispose(); return null; }
  const mesh = new THREE.InstancedMesh(geometry, material, records.length), dummy = new THREE.Object3D();
  records.forEach((r,i) => { dummy.position.copy(r.p); dummy.scale.set(...(r.s || [1,1,1])); dummy.rotation.set(...(r.r || [0,0,0]));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(r.c)mesh.setColorAt(i,new THREE.Color(r.c)); });
  mesh.castShadow = true;mesh.receiveShadow = true;group.add(mesh);return mesh;
}

function fernGeometry() {
  const geometry = detailedFrondGeometry(), positions = geometry.attributes.position;
  for(let i=0;i<positions.count;i++) {
    const t=Math.max(0,Math.min(1,positions.getZ(i)));
    positions.setY(i,.04+Math.sin(t*Math.PI*.88)*.48+t*.18);
  }
  positions.needsUpdate=true;geometry.computeVertexNormals();return geometry;
}

export function addWorldDetail({ group, curve, length, index, frameAt = null, loops = [], excludeRanges = [] }) {
  let seed = 17412 + index * 9301;const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0;return seed/4294967296; };
  const ferns=[], grass=[], petals=[], flowerHearts=[], stones=[], shells=[], mosaics=[], uplights=[], crystals=[];
  const frame = s => {if(frameAt)return frameAt(s);const position=curve.getPointAt(s/length),forward=curve.getTangentAt(s/length),right=new THREE.Vector3(forward.z,0,-forward.x).normalize();return{position,forward,right,up:new THREE.Vector3(0,1,0)};};
  const off = (f,lane,height) => f.position.clone().addScaledVector(f.right,lane).add(new THREE.Vector3(0,height,0));
  const count = index===3?180:100;
  for(let i=0;i<count;i++) {
    const s=length*i/count;if(loops.some(l=>s>l.start-30&&s<l.end+30)||excludeRanges.some(r=>s>r.start&&s<r.end))continue;
    const f=frame(s),yaw=Math.atan2(f.forward.x,f.forward.z);
    for(const side of [-1,1]) {
      const lane=side*(13.8+rand()*5),p=off(f,lane,index===0||index===3?-1.03:-1.6);
      if(index===0||index===3) {
        const scale=.65+rand()*.8;
        for(let k=0;k<7;k++)ferns.push({p,s:[scale*1.2,scale*1.8,scale*2.7],r:[.16,k*Math.PI*2/7+rand()*.2,0],c:k%2?'#357e37':'#75b343'});
        for(let k=0;k<6;k++){const h=.5+rand()*.5;grass.push({p:p.clone().add(new THREE.Vector3(rand()*2,h*.5,rand()*2)),s:[.1+rand()*.1,h,.12],r:[0,rand()*6,(rand()-.5)*.45],c:'#84c45a'});}
        if(i%3===0) {
          const fp=p.clone().add(new THREE.Vector3(1.8,.8,1));flowerHearts.push({p:fp,s:[.13,.12,.13],c:'#fff1a6'});
          for(let k=0;k<5;k++){const a=k*Math.PI*2/5;petals.push({p:fp.clone().add(new THREE.Vector3(Math.cos(a)*.24,.025,Math.sin(a)*.24)),s:[.3,.08,.15],r:[0,-a,0],c:i%2?'#ffb364':'#e87bb0'});}
        }
        if(index===0&&i%4===0)shells.push({p:off(f,side*(39+rand()*8),-4),s:[.8,.25,.6],r:[0,rand()*6,0],c:i%2?'#f8dba6':'#f3bcad'});
      }
      if(index===1) {
        // Broken paving and engraved face fragments outside the racing verge.
        stones.push({p,s:[1+rand()*1.8,.25+rand()*.2,1.3+rand()*2],r:[.05,yaw+rand()*.5,.02],c:i%2?'#dab481':'#b88463'});
        for(let k=0;k<3;k++)mosaics.push({p:p.clone().add(new THREE.Vector3(0,.29,k*.45-.4)),s:[.72,.035,.065],r:[0,yaw,0],c:k===1?'#5aa49b':'#ad7651'});
        if(i%5===0){const q=off(f,side*20,-1);crystals.push({p:q,s:[.5,1.8,.5],r:[0,yaw,.08],c:'#ddaa70'});}
      }
      if(index===2) {
        const q=off(f,side*9.4,.65);uplights.push({p:q,s:[.32,.25,.75],r:[0,yaw,0],c:i%2?'#61dcea':'#d292f5'});
      }
    }
  }
  const leafmat=surfaceMaterial('grass',{side:THREE.DoubleSide,roughness:.93});batch(group,fernGeometry(),leafmat,ferns);
  batch(group,new THREE.ConeGeometry(1,1,3),new THREE.MeshStandardMaterial({color:'#fff',roughness:.96}),grass);
  batch(group,new THREE.SphereGeometry(1,7,5),new THREE.MeshStandardMaterial({color:'#fff',roughness:.8}),petals);
  batch(group,new THREE.SphereGeometry(1,6,4),new THREE.MeshStandardMaterial({color:'#fff'}),flowerHearts);
  batch(group,new THREE.BoxGeometry(1,1,1),surfaceMaterial('stone'),stones);
  batch(group,new THREE.SphereGeometry(1,10,6),new THREE.MeshStandardMaterial({color:'#fff',roughness:.45}),shells);
  batch(group,new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:'#fff',roughness:.75}),mosaics);
  batch(group,new THREE.OctahedronGeometry(1),surfaceMaterial('stone'),crystals);
  batch(group,new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:'#fff'}),uplights);
  const foam=[];
  if(index===0||index===3)for(let i=0;i<100;i++){
    const a=i*Math.PI*2/100,r=index===3?580:230;const p=new THREE.Vector3(Math.cos(a)*r,index===3?-23.8:-14.8,Math.sin(a)*r);
    foam.push({p,s:[8+rand()*12,.08,1.5+rand()*2],r:[0,-a+Math.PI/2,0],c:i%3?'#86e0df':'#d5f6ed'});
  }
  const foamMesh=batch(group,new THREE.SphereGeometry(1,8,5),new THREE.MeshStandardMaterial({color:'#fff',roughness:.45,transparent:true,opacity:.55}),foam);if(foamMesh)foamMesh.castShadow=false;
  return {update(time){if(foamMesh)foamMesh.material.opacity=.46+Math.sin(time*.9)*.07;}};
}

export function disposeWorld(group) {
  const geometries=new Set(),materials=new Set(),textures=new Set();
  group.traverse(object=>{if(object.geometry)geometries.add(object.geometry);for(const m of Array.isArray(object.material)?object.material:[object.material])if(m){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
}
