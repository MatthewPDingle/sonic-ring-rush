import * as THREE from 'three';

const palettes = [
  ['#1b7ad4', '#98e7f4', '#deefe0', '#fff1bb'],
  ['#765995', '#e6a57c', '#f8d6a0', '#ffe3a0'],
  ['#070b26', '#293464', '#624376', '#c5deff'],
  ['#348cba', '#a5ded9', '#e6edd3', '#ffedb5'],
];

/** A local sky dome: painted gradients, soft cloud bands and a night sky. */
export function createAtmosphere() {
  const uniforms = {
    zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() },
    lower: { value: new THREE.Color() }, sunColor: { value: new THREE.Color() },
    night: { value: 0 }, clock: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    vertexShader: 'varying vec3 direction; void main(){direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `
      uniform vec3 zenith,horizon,lower,sunColor;
      uniform float night,clock;
      varying vec3 direction;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){
        vec3 d=normalize(direction);
        vec3 color=mix(horizon,zenith,pow(max(d.y,0.0),0.55));
        color=mix(color,lower,1.0-smoothstep(-0.35,0.08,d.y));
        vec3 sun=normalize(vec3(-0.6,0.38,-0.65));
        float alignment=max(dot(d,sun),0.0);
        color+=sunColor*pow(alignment,22.0)*0.22;
        color+=sunColor*smoothstep(0.9992,0.99965,alignment)*(1.0-night*0.2);
        vec2 cloud=d.xz/max(0.14,d.y)*1.9+vec2(clock*0.002,0.0);
        float clouds=noise(cloud)*0.62+noise(cloud*2.7)*0.28+noise(cloud*7.0)*0.1;
        float veil=smoothstep(0.58,0.79,clouds)*smoothstep(0.02,0.2,d.y)*(1.0-smoothstep(0.7,0.95,d.y));
        color=mix(color,mix(vec3(0.97,0.99,1.0),horizon,0.13),veil*0.62*(1.0-night));
        vec2 starUV=vec2(atan(d.z,d.x),asin(d.y))*140.0;
        vec2 cell=floor(starUV),jitter=vec2(hash(cell+3.1),hash(cell+11.4));
        float star=(1.0-smoothstep(0.02,0.11,length(fract(starUV)-jitter)))*step(0.984,hash(cell+7.0));
        color+=vec3(0.72,0.84,1.0)*star*night*smoothstep(0.02,0.12,d.y)*(0.8+0.2*sin(clock*0.5+hash(cell)*20.0));
        gl_FragColor=vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), material);
  mesh.name = 'painted-sky'; mesh.renderOrder = -1000; mesh.frustumCulled = false;
  let skyTarget;
  return {
    mesh,
    bake(renderer) {
      // Reuse the painted sky on mobile instead of evaluating cloud/star noise
      // across millions of screen pixels on every frame.
      skyTarget ??= new THREE.WebGLCubeRenderTarget(512, { type: THREE.HalfFloatType });
      const sky = new THREE.Scene(), dome = mesh.clone();
      dome.position.set(0, 0, 0); dome.visible = true; sky.add(dome);
      const camera = new THREE.CubeCamera(1, 1000, skyTarget);
      camera.update(renderer, sky);
      mesh.visible = false;
      return skyTarget.texture;
    },
    setTrack(index) {
      const palette = palettes[index] || palettes[0];
      ['zenith', 'horizon', 'lower', 'sunColor'].forEach((key, i) => uniforms[key].value.set(palette[i]));
      uniforms.night.value = index === 2 ? 1 : 0;
    },
    update(camera, time) { mesh.position.copy(camera.position); uniforms.clock.value = time; },
    dispose() { skyTarget?.dispose();mesh.geometry.dispose(); material.dispose(); },
  };
}
