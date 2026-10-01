import * as THREE from 'three';

// Authored offline: curved quills, face, shoes and articulated joints are geometry.
const sphere = new THREE.SphereGeometry(1, 16, 12);
const smoothSphere = new THREE.SphereGeometry(1, 28, 20);
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 16);
const up = new THREE.Vector3(0, 1, 0);
function piece(geometry, material, position, scale, parent, rotation) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position); mesh.scale.set(...scale);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
  return mesh;
}
function ball(material, position, scale, parent) { return piece(Math.max(...scale) > .32 ? smoothSphere : sphere, material, position, scale, parent); }
function line(material, points, radius, parent, segments = 20) {
  return piece(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, 6, false), material, [0, 0, 0], [1, 1, 1], parent);
}
function link(material, a, b, radius, parent) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), vector = end.clone().sub(start);
  const mesh = piece(cylinder, material, start.add(end).multiplyScalar(.5).toArray(), [radius, vector.length(), radius], parent);
  mesh.quaternion.setFromUnitVectors(up, vector.normalize()); return mesh;
}

// An elliptical curved taper gives each quill a broad root and swept silhouette.
function quill(material, points, radius, flatten, parent) {
  const curve = new THREE.CubicBezierCurve3(...points.map(p => new THREE.Vector3(...p)));
  const segments = 18, sides = 16, frames = curve.computeFrenetFrames(segments, false);
  const positions = [], indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, center = curve.getPoint(t);
    const width = radius * Math.pow(1 - t, .76) * (1 + .16 * Math.sin(t * Math.PI));
    for (let j = 0; j <= sides; j++) {
      const angle = j / sides * Math.PI * 2;
      const p = center.clone().addScaledVector(frames.normals[i], Math.cos(angle) * width)
        .addScaledVector(frames.binormals[i], Math.sin(angle) * width * flatten);
      positions.push(p.x, p.y, p.z);
      if (i < segments && j < sides) {
        const a = i * (sides + 1) + j, b = a + sides + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return piece(geometry, material, [0, 0, 0], [1, 1, 1], parent);
}
function earShape(size, depth) {
  const s = new THREE.Shape();
  s.moveTo(-size * .75, 0);
  s.quadraticCurveTo(-size * .88, size * .08, -size * .45, size * .92);
  s.quadraticCurveTo(-size * .25, size * 1.14, -size * .08, size * .97);
  s.lineTo(size * .65, size * .09); s.quadraticCurveTo(size * .78, -size * .05, -size * .75, 0);
  return new THREE.ExtrudeGeometry(s, {depth, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .035, bevelThickness: .025, curveSegments: 12});
}
function eyeMask() {
  const s = new THREE.Shape(); s.moveTo(0, .25);
  s.bezierCurveTo(-.16, .50, -.49, .49, -.55, .27);
  s.bezierCurveTo(-.62, .06, -.48, -.18, -.24, -.23);
  s.quadraticCurveTo(-.09, -.22, 0, -.08); s.quadraticCurveTo(.09, -.22, .24, -.23);
  s.bezierCurveTo(.48, -.18, .62, .06, .55, .27); s.bezierCurveTo(.49, .49, .16, .50, 0, .25);
  return new THREE.ExtrudeGeometry(s, {depth: .045, bevelEnabled: true, bevelSize: .045, bevelThickness: .045, bevelSegments: 4, curveSegments: 18});
}
// A rounded heel and low toe box share their outline with the distinct sole.
function shoeGeometry(sole = false) {
  const profile = [[-.30, .04, .04], [-.275, .18, .11], [-.15, .235, .175], [.05, .275, .185], [.28, .29, .14], [.48, .25, .10], [.58, .15, .065], [.62, .015, .02]];
  const positions = [], indices = [], sides = 20;
  profile.forEach(([z, width, height], i) => {
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * Math.PI * 2;
      positions.push(Math.cos(a) * width * (sole ? 1.04 : 1), Math.sin(a) * (sole ? .043 : height), z);
      if (i < profile.length - 1 && j < sides) {
        const n = i * (sides + 1) + j, next = n + sides + 1;
        indices.push(n, n + 1, next, n + 1, next + 1, next);
      }
    }
  });
  const heel = positions.length / 3, toe = heel + 1;
  positions.push(0, 0, profile[0][0], 0, 0, profile.at(-1)[0]);
  for (let j = 0; j < sides; j++) {
    const end = (profile.length - 1) * (sides + 1) + j;
    indices.push(heel, j + 1, j, toe, end, end + 1);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
const shoeUpper = shoeGeometry(), shoeSole = shoeGeometry(true);
function buckleGeometry() {
  const shape = new THREE.Shape(); shape.moveTo(-.075, -.07); shape.lineTo(.075, -.07); shape.lineTo(.075, .07); shape.lineTo(-.075, .07); shape.closePath();
  const hole = new THREE.Path(); hole.moveTo(-.045, -.043); hole.lineTo(-.045, .043); hole.lineTo(.045, .043); hole.lineTo(.045, -.043); hole.closePath(); shape.holes.push(hole);
  return new THREE.ExtrudeGeometry(shape, {depth: .018, bevelEnabled: true, bevelSize: .012, bevelThickness: .008, bevelSegments: 2});
}
const buckle = buckleGeometry();

export function createCharacter(color = '#0879ed') {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const blue = new THREE.MeshStandardMaterial({color, roughness: .46, metalness: .035});
  const pale = new THREE.MeshStandardMaterial({color: '#ffd0a1', roughness: .64});
  const paleShade = new THREE.MeshStandardMaterial({color: '#de9b72', roughness: .7});
  const white = new THREE.MeshStandardMaterial({color: '#fffef6', roughness: .48});
  const seam = new THREE.MeshStandardMaterial({color: '#d2d8dd', roughness: .65});
  const black = new THREE.MeshStandardMaterial({color: '#111521', roughness: .32});
  const iris = new THREE.MeshStandardMaterial({color: '#10ad65', roughness: .34});
  const red = new THREE.MeshStandardMaterial({color: '#ed263c', roughness: .5});
  const redShade = new THREE.MeshStandardMaterial({color: '#a2112d', roughness: .66});
  const gold = new THREE.MeshStandardMaterial({color: '#ffd15b', metalness: .65, roughness: .27});
  ball(blue, [0, 1.51, -.025], [.46, .63, .39], body);
  ball(pale, [0, 1.51, .335], [.29, .40, .085], body);
  for (const side of [-1, 1]) quill(blue, [[side * .17, 1.50, -.29], [side * .30, 1.40, -.5], [side * .26, 1.15, -.70], [side * .18, 1.02, -.73]], .20, .8, body);
  quill(blue, [[0, 1.12, -.22], [0, 1.08, -.40], [0, .98, -.55], [0, 1.02, -.64]], .13, .85, body);
  const head = new THREE.Group(); head.position.set(0, 2.36, 0); body.add(head);
  ball(blue, [0, 0, -.045], [.745, .73, .675], head);
  quill(blue, [[0, .43, -.24], [0, .73, -.57], [0, .63, -1.10], [0, .38, -1.34]], .41, .78, head);
  for (const side of [-1, 1]) {
    quill(blue, [[side * .43, .22, -.19], [side * .86, .35, -.43], [side * 1.04, .03, -.97], [side * .91, -.20, -1.24]], .40, .78, head);
    quill(blue, [[side * .37, -.20, -.29], [side * .71, -.23, -.51], [side * .69, -.70, -.98], [side * .47, -.90, -1.12]], .36, .80, head);
    const ear = piece(earShape(.40, .14), blue, [side * .46, .44, .06], [side, 1, 1], head); ear.rotation.z = -side * .16;
    piece(earShape(.24, .02), pale, [side * .455, .49, .23], [side, 1, 1], head, [0, 0, -side * .16]);
  }
  quill(blue, [[0, -.30, -.36], [0, -.48, -.62], [0, -.89, -.93], [0, -.94, -1.09]], .31, .80, head);
  const eyes = new THREE.Group(); eyes.position.set(0, .045, .573); head.add(eyes);
  piece(eyeMask(), white, [0, 0, 0], [1, 1, 1], eyes);
  for (const side of [-1, 1]) {
    ball(iris, [side * .22, .035, .116], [.078, .197, .022], eyes);
    ball(black, [side * .218, .032, .137], [.036, .14, .012], eyes);
    ball(white, [side * .207, .11, .15], [.018, .038, .008], eyes);
    line(blue, [[side * .06, .29, .648], [side * .26, .49, .613], [side * .46, .46, .555], [side * .58, .29, .50]], .043, head);
  }
  ball(pale, [0, -.28, .602], [.54, .235, .236], head);
  ball(pale, [0, -.10, .657], [.16, .12, .16], head);
  ball(black, [0, -.11, .902], [.122, .094, .118], head);
  ball(white, [-.031, -.079, .992], [.030, .018, .009], head);
  line(black, [[.10, -.366, .817], [.23, -.383, .815], [.34, -.34, .793], [.39, -.285, .754]], .015, head);
  line(paleShade, [[.36, -.28, .767], [.40, -.25, .745], [.435, -.267, .724]], .012, head, 8);
  ball(paleShade, [.405, -.269, .755], [.026, .017, .008], head);
  const legs = [], arms = [], knees = [], elbows = [], ankles = [], wrists = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(side * .235, 1.05, -.015); body.add(leg); legs.push(leg);
    ball(blue, [0, -.03, 0], [.125, .16, .135], leg); link(blue, [0, -.03, 0], [0, -.38, 0], .105, leg);
    const knee = new THREE.Group(); knee.position.y = -.39; leg.add(knee); knees.push(knee);
    ball(blue, [0, 0, 0], [.114, .116, .114], knee); link(blue, [0, 0, 0], [0, -.34, .01], .093, knee);
    const ankle = new THREE.Group(); ankle.position.set(0, -.35, .01); knee.add(ankle); ankles.push(ankle);
    ball(white, [0, -.035, .01], [.20, .125, .20], ankle);
    piece(new THREE.TorusGeometry(.15, .037, 8, 20), white, [0, .055, .01], [1, 1, 1], ankle, [Math.PI / 2, 0, 0]);
    piece(new THREE.TorusGeometry(.17, .013, 6, 20), seam, [0, -.092, .01], [1, 1, 1], ankle, [Math.PI / 2, 0, 0]);
    const shoe = new THREE.Group(); shoe.position.set(0, -.14, .055); ankle.add(shoe);
    piece(shoeUpper, red, [0, 0, 0], [1, 1, 1], shoe);
    piece(shoeSole, white, [0, -.122, 0], [1, 1, 1], shoe);
    piece(shoeSole, redShade, [0, -.17, 0], [.97, .36, .99], shoe);
    line(redShade, [[-.21, .08, .29], [-.18, .10, .42], [0, .109, .51], [.18, .10, .42], [.21, .08, .29]], .009, shoe);
    const strap = new THREE.CatmullRomCurve3([new THREE.Vector3(-.281, -.04, .14), new THREE.Vector3(-.245, .10, .14), new THREE.Vector3(0, .174, .14), new THREE.Vector3(.245, .10, .14), new THREE.Vector3(.281, -.04, .14)]);
    const strapShape = new THREE.Shape(); strapShape.moveTo(-.060, -.012); strapShape.lineTo(.060, -.012); strapShape.lineTo(.060, .012); strapShape.lineTo(-.060, .012); strapShape.closePath();
    piece(new THREE.ExtrudeGeometry(strapShape, {steps: 24, bevelEnabled: false, extrudePath: strap}), white, [0, 0, 0], [1, 1, 1], shoe);
    piece(buckle, gold, [side * .286, .035, .14], [1, 1, 1], shoe, [0, side * Math.PI / 2, 0]);
    line(redShade, [[-.14, .04, -.252], [0, .07, -.283], [.14, .04, -.252]], .009, shoe, 12);
    const arm = new THREE.Group(); arm.position.set(side * .405, 1.84, .005); body.add(arm); arms.push(arm);
    ball(pale, [side * .04, -.065, 0], [.112, .14, .11], arm); link(pale, [side * .03, -.035, 0], [side * .15, -.32, 0], .084, arm);
    const elbow = new THREE.Group(); elbow.position.set(side * .15, -.325, 0); arm.add(elbow); elbows.push(elbow);
    ball(pale, [0, 0, 0], [.09, .09, .09], elbow); link(pale, [0, 0, 0], [side * .03, -.255, .01], .074, elbow);
    const wrist = new THREE.Group(); wrist.position.set(side * .035, -.27, .015); elbow.add(wrist); wrists.push(wrist);
    ball(white, [0, -.015, 0], [.174, .11, .17], wrist);
    piece(new THREE.TorusGeometry(.131, .031, 8, 18), white, [0, .05, 0], [1, 1, 1], wrist, [Math.PI / 2, 0, 0]);
    piece(new THREE.TorusGeometry(.155, .010, 6, 18), seam, [0, -.06, 0], [1, 1, 1], wrist, [Math.PI / 2, 0, 0]);
    ball(white, [0, -.185, .055], [.19, .21, .145], wrist); ball(white, [-side * .17, -.16, .135], [.10, .125, .10], wrist);
    for (let finger = 0; finger < 4; finger++) {
      const x = -.123 + finger * .081;
      ball(white, [x, -.327 + Math.abs(finger - 1.5) * .018, .07], [.052, .089, .075], wrist);
      if (finger < 3) line(seam, [[x + .045, -.23, .184], [x + .045, -.29, .159], [x + .045, -.346, .109]], .0055, wrist, 8);
    }
    line(seam, [[-side * .11, -.152, .187], [-side * .055, -.18, .196], [-side * .018, -.215, .184]], .006, wrist, 8);
  }
  const aura = new THREE.Mesh(new THREE.TorusGeometry(.84, .033, 8, 48), new THREE.MeshBasicMaterial({color: '#6deaff', transparent: true, opacity: .66, depthWrite: false}));
  aura.position.set(0, 1.3, -.68); root.add(aura); aura.visible = false;
  root.userData = {body, head, legs, arms, aura, eyes, knees, elbows, ankles, wrists, update: (speed, time, jumpHeight, boosting) => animateCharacter(root, speed, time, jumpHeight, boosting)};
  return root;
}

export function animateCharacter(root, speed = 0, time = 0, jumpHeight = 0, boosting = false) {
  const {body, head, legs, arms, aura, eyes, knees, elbows, ankles, wrists} = root.userData;
  const run = THREE.MathUtils.clamp(Math.abs(speed) / 14, 0, 1), phase = time * (9 + Math.min(Math.abs(speed), 65) * .25), breathing = Math.sin(time * 2.4);
  body.position.y = .014 * breathing * (1 - run) + Math.abs(Math.sin(phase)) * .063 * run;
  body.scale.set(1 + breathing * .006 * (1 - run), 1 + breathing * .009 * (1 - run), 1);
  body.rotation.x = run * (boosting ? .31 : .17); body.rotation.z = Math.sin(phase * .5) * .027 * run;
  head.rotation.x = -run * (boosting ? .19 : .10) + .018 * Math.sin(time * 1.5) * (1 - run);
  head.rotation.y = Math.sin(time * .75) * .065 * (1 - run); head.rotation.z = Math.sin(time * .8) * .024 * (1 - run);
  const blinkTime = ((time % 6.7) + 6.7) % 6.7;
  const blink = Math.max(0, 1 - Math.abs(blinkTime - 4.25) / .095, .85 * (1 - Math.abs(blinkTime - 4.55) / .065));
  eyes.scale.y = 1 - blink * .985;
  legs.forEach((leg, i) => {
    const gait = phase + i * Math.PI, stride = Math.sin(gait);
    leg.rotation.x = stride * .78 * run; leg.rotation.z = (i === 0 ? -.035 : .035) * (1 - run);
    knees[i].rotation.x = Math.max(0, stride) * 1.04 * run;
    ankles[i].rotation.x = -.25 * stride * run - Math.max(0, stride) * .25 * run;
  });
  arms.forEach((arm, i) => {
    const side = i === 0 ? -1 : 1, stride = Math.sin(phase + i * Math.PI + Math.PI);
    arm.rotation.x = boosting ? .85 + .13 * stride : stride * .63 * run;
    arm.rotation.z = -side * (.16 + .018 * breathing * (1 - run));
    elbows[i].rotation.x = boosting ? -.20 : -.33 - .48 * run + .13 * stride * run;
    wrists[i].rotation.y = side * (.12 + .08 * run); wrists[i].rotation.z = -side * .09;
  });
  if (jumpHeight > .3) {
    legs[0].rotation.x = -.55; legs[1].rotation.x = .55; knees[0].rotation.x = .32; knees[1].rotation.x = 1.0;
    ankles.forEach(a => { a.rotation.x = .12; });
    arms.forEach((arm, i) => { arm.rotation.x = -.35; arm.rotation.z = i === 0 ? .52 : -.52; });
  }
  aura.visible = boosting; aura.rotation.z = time * 4; aura.scale.setScalar(1 + Math.sin(time * 20) * .07);
}
