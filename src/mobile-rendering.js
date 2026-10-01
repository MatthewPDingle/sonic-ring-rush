import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
let shadowTexture;

export function partitionMobileScenery(root) {
  const originals=[];root.traverse(object=>{if(object.isInstancedMesh&&object.count>20)originals.push(object);});
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),color=new THREE.Color();
  for(const original of originals) {
    const tiles=new Map();
    for(let i=0;i<original.count;i++) {
      original.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix);
      const key=`${Math.floor(position.x/80)}:${Math.floor(position.z/80)}`;
      if(!tiles.has(key))tiles.set(key,[]);tiles.get(key).push(i);
    }
    if(tiles.size<2)continue;
    for(const indices of tiles.values()) {
      const batch=new THREE.InstancedMesh(original.geometry,original.material,indices.length);
      batch.position.copy(original.position);batch.quaternion.copy(original.quaternion);batch.scale.copy(original.scale);
      batch.castShadow=original.castShadow;batch.receiveShadow=original.receiveShadow;
      indices.forEach((index,i)=>{original.getMatrixAt(index,matrix);batch.setMatrixAt(i,matrix);if(original.instanceColor){original.getColorAt(index,color);batch.setColorAt(i,color);}});
      batch.computeBoundingSphere();batch.userData.mobileScenery=true;original.parent.add(batch);
    }
    original.parent.remove(original);original.dispose();
  }
}

export function addMobileGroundShadow(root) {
  root.traverse(object=>{if(object.isMesh)object.castShadow=false;});
  if(!shadowTexture) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
    const context=canvas.getContext('2d'),gradient=context.createRadialGradient(32,32,3,32,32,32);
    gradient.addColorStop(0,'rgba(0,0,0,.5)');gradient.addColorStop(1,'rgba(0,0,0,0)');
    context.fillStyle=gradient;context.fillRect(0,0,64,64);shadowTexture=new THREE.CanvasTexture(canvas);
  }
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(2.7,2.1),new THREE.MeshBasicMaterial({map:shadowTexture,color:'#182e4b',transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
  shadow.rotation.x=-Math.PI/2;root.add(shadow);root.userData.groundShadow=shadow;
}

export function batchMobileCharacter(root) {
  const parents=[]; root.traverse(object=>{if(object.isGroup)parents.push(object);});
  for(const parent of parents) {
    const buckets=new Map();
    for(const mesh of parent.children) {
      if(!mesh.isMesh||mesh===root.userData.aura||Array.isArray(mesh.material))continue;
      const key=`${mesh.material.uuid}:${Object.keys(mesh.geometry.attributes).sort().join(',')}:${Boolean(mesh.geometry.index)}`;
      if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(mesh);
    }
    for(const meshes of buckets.values()) {
      if(meshes.length<2)continue;
      const pieces=meshes.map(mesh=>{mesh.updateMatrix();return mesh.geometry.clone().applyMatrix4(mesh.matrix);});
      const geometry=mergeGeometries(pieces);
      pieces.forEach(piece=>piece.dispose());
      if(!geometry)continue;
      const merged=new THREE.Mesh(geometry,meshes[0].material);
      merged.castShadow=meshes[0].castShadow;merged.receiveShadow=meshes[0].receiveShadow;
      parent.add(merged);meshes.forEach(mesh=>parent.remove(mesh));
    }
  }
}

// Keep the authored meshes, textures and surface normals. Mobile lighting uses
// a cheaper specular model without the per-pixel environment reflection lookup.
export function prepareMobileMaterials(root) {
  const converted = new Map();
  function convert(material) {
    if (!material.isMeshStandardMaterial) return material;
    if (converted.has(material)) return converted.get(material);
    const replacement = new THREE.MeshPhongMaterial({
      color: material.color.clone(), map: material.map, vertexColors: material.vertexColors,
      emissive: material.emissive.clone(), emissiveMap: material.emissiveMap,
      emissiveIntensity: material.emissiveIntensity,
      normalMap: material.normalMap, normalScale: material.normalScale.clone(),
      bumpMap: material.bumpMap, bumpScale: material.bumpScale,
      aoMap: material.aoMap, aoMapIntensity: material.aoMapIntensity,
      alphaMap: material.alphaMap, alphaTest: material.alphaTest,
      transparent: material.transparent, opacity: material.opacity,
      side: material.side, depthWrite: material.depthWrite, depthTest: material.depthTest,
      flatShading: material.flatShading, fog: material.fog,
      specular: new THREE.Color().setScalar(.08 + material.metalness * .22),
      shininess: 4 + (1 - material.roughness) * 45,
    });
    replacement.name = material.name;
    converted.set(material, replacement);
    return replacement;
  }
  root.traverse(object => {
    if (!object.isMesh) return;
    object.material = Array.isArray(object.material) ? object.material.map(convert) : convert(object.material);
  });
  for (const material of converted.keys()) material.dispose();
}
