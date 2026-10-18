// Hand-shaped gear models built in code: smooth, high-resolution shapes with physical materials, replacing the
// low-poly Blender archetypes wherever they are shown up close (apartment, transition). Same ids, sizes and frame
// as assets/gear/gear.json: metres, +X forward (toe, visor), +Y up, origin on the ground at the item's centre.
// Generic designs, not copies of any commercial product.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const C = { ink: 0x13293d, carbon: 0x1b1f24, rubber: 0x16181b, foam: 0xf2efe8, coral: 0xd9785b, sea: 0x2e6f73, gold: 0xc9a14a, lens: 0x1d3f55, white: 0xf7f5f0 };

function mat(color, o = {}) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.45, metalness: 0, clearcoat: 0, emissive: 0xffc46b, emissiveIntensity: 0, ...o });
}
const gloss = (color, o = {}) => mat(color, { roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12, ...o });
const lensMat = () => mat(C.lens, { roughness: 0.05, metalness: 0.7, clearcoat: 1, iridescence: 0.6, iridescenceIOR: 1.6 });
function mesh(geo, material, [x = 0, y = 0, z = 0] = [], [rx = 0, ry = 0, rz = 0] = []) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}

// ---------------------------------------------------------------- helmets
// A sphere shaped into a teardrop: the back is pulled into a tail that tapers, the bottom is cut flat at the rim.
function shell(tail, len, h, w) {
  const g = new THREE.SphereGeometry(1, 72, 44);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let { x, y, z } = v;
    if (x < 0) {
      const k = -x;
      x = -k * (1 + tail * k * k);
      const taper = 1 - (tail / (tail + 0.6)) * Math.pow(k, 2.4) * 0.85;
      y = y * taper + tail * 0.06 * k * k;
      z *= taper;
    }
    y = Math.max(y, -0.22);
    p.setXYZ(i, x * len, (y + 0.22) * h, z * w);
  }
  g.computeVertexNormals();
  return g;
}
function helmet(kind, tint) {
  const g = new THREE.Group();
  const tail = kind === 'helmet_longtail' ? 2.2 : kind === 'helmet_shorttail' ? 0.9 : 0.25;
  const body = gloss(tint);
  const LEN = 0.125, H = 0.16, WID = 0.106;
  g.add(mesh(shell(tail, LEN, H, WID), body));
  if (kind !== 'helmet_aeroroad') {
    // Wrap visor across the face: a band of the same ellipsoid, just proud of the shell, around the equator.
    const visor = new THREE.SphereGeometry(1.035, 56, 12, Math.PI - Math.PI * 0.36, Math.PI * 0.72, Math.PI * 0.42, Math.PI * 0.2);
    visor.scale(LEN, H, WID);
    g.add(mesh(visor, lensMat(), [0, 0.22 * H, 0]));
  } else {
    for (let i = 0; i < 4; i++) g.add(mesh(new RoundedBoxGeometry(0.05, 0.012, 0.02, 2, 0.005), mat(C.carbon), [0.05 - i * 0.04, 0.176 - Math.abs(i - 1.5) * 0.016, (i % 2 ? 1 : -1) * 0.028]));
  }
  // Rim and a thin accent line.
  const rim = new THREE.TorusGeometry(1, 0.012, 8, 64);
  rim.scale(0.12, 0.105, 1);
  g.add(mesh(rim, mat(C.rubber, { roughness: 0.8 }), [kind === 'helmet_aeroroad' ? 0 : -0.02, 0.012, 0], [Math.PI / 2, 0, 0]));
  return g;
}

// ---------------------------------------------------------------- shoes
function footShape(len = 0.29, ball = 0.05, heel = 0.036) {
  const s = new THREE.Shape(), L = len / 2;
  s.moveTo(-L + heel, -heel);
  s.bezierCurveTo(-L - 0.004, -heel, -L - 0.004, heel, -L + heel, heel);                 // heel
  s.bezierCurveTo(-0.02, heel + 0.006, 0.06, ball + 0.004, L - 0.05, ball * 0.92);      // outer edge to the ball
  s.bezierCurveTo(L - 0.005, ball * 0.8, L + 0.004, -0.004, L - 0.02, -ball * 0.55);    // toe
  s.bezierCurveTo(0.05, -ball * 0.95, -0.03, -heel - 0.004, -L + heel, -heel);           // arch side back to heel
  return s;
}
function sole(depth, color, rocker = 0) {
  const g = new THREE.ExtrudeGeometry(footShape(), { depth, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 3, curveSegments: 24 });
  g.rotateX(-Math.PI / 2);                                                                 // extrude upward
  if (rocker) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setY(i, p.getY(i) + rocker * Math.max(0, x - 0.04) ** 2 * 1.6); }   // ~2 cm toe spring
  }
  g.computeVertexNormals();
  return mesh(g, mat(color, { roughness: 0.7 }));
}
function upper(h, tint, base) {
  const g = new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);         // dome
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {                                                      // lower the toe box, keep the heel high
    const x = p.getX(i), y = p.getY(i);
    p.setY(i, y * (x > 0 ? 1 - 0.42 * x * x : 1 + 0.12 * -x));              // low toe box, fuller heel
  }
  g.scale(0.142, h, 0.049);
  g.computeVertexNormals();
  return mesh(g, mat(tint, { roughness: 0.55, sheen: 1, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.6 }), [0.005, base, 0]);
}
function shoe(kind, tint) {
  const g = new THREE.Group();
  if (kind === 'shoe_plated') {
    g.add(sole(0.034, C.foam, 1));
    g.add(mesh(new RoundedBoxGeometry(0.22, 0.003, 0.05, 2, 0.0015), mat(C.carbon, { roughness: 0.3, clearcoat: 1 }), [0.01, 0.022, 0]));
    g.add(upper(0.085, tint === 0xffffff ? C.coral : tint, 0.036));
    for (let i = 0; i < 4; i++) g.add(mesh(new RoundedBoxGeometry(0.008, 0.004, 0.05, 2, 0.002), mat(C.white), [0.035 - i * 0.022, 0.1 - i * 0.004, 0], [0, 0, 0.35]));
  } else {
    g.add(sole(0.01, C.carbon));
    g.add(upper(0.085, tint === 0xffffff ? C.white : tint, 0.012));
    if (kind === 'shoe_tri' || kind === 'shoe_road') {
      g.add(mesh(new RoundedBoxGeometry(0.03, 0.006, 0.108, 2, 0.003), mat(kind === 'shoe_tri' ? C.coral : C.ink), [0.0, 0.077, 0], [0, 0, 0.25]));
      if (kind === 'shoe_road') g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 20), gloss(C.carbon), [-0.04, 0.078, 0.03]));
      if (kind === 'shoe_tri') g.add(mesh(new THREE.TorusGeometry(0.016, 0.004, 8, 24, Math.PI), mat(C.coral), [-0.148, 0.07, 0], [0, Math.PI / 2, Math.PI / 2]));
    } else {
      for (let i = 0; i < 4; i++) g.add(mesh(new RoundedBoxGeometry(0.008, 0.004, 0.05, 2, 0.002), mat(C.white), [0.035 - i * 0.022, 0.075 - i * 0.003, 0], [0, 0, 0.35]));
    }
  }
  const collar = mesh(new THREE.SphereGeometry(0.03, 24, 12), mat(C.ink, { roughness: 0.9 }), [-0.075, kind === 'shoe_plated' ? 0.118 : 0.094, 0]);
  collar.scale.set(1.2, 0.22, 0.85);                                                           // the opening for the foot
  g.add(collar);
  return g;
}

// ---------------------------------------------------------------- small kit
function goggles(tint) {
  const g = new THREE.Group();
  for (const z of [-0.034, 0.034]) {
    const lens = new THREE.SphereGeometry(1, 32, 16);
    lens.scale(0.009, 0.019, 0.026);                                                     // domed oval lens facing +X
    g.add(mesh(lens, lensMat(), [0.004, 0.022, z]));
    const frame = new THREE.TorusGeometry(0.022, 0.0035, 8, 40);
    frame.scale(1.2, 0.86, 1);                                                           // oval gasket around the lens
    g.add(mesh(frame, mat(tint === 0xffffff ? C.sea : tint, { roughness: 0.6 }), [0, 0.022, z], [0, Math.PI / 2, 0]));
  }
  g.add(mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.02, 8), mat(C.ink), [0, 0.022, 0], [Math.PI / 2, 0, 0]));
  const strap = new THREE.TorusGeometry(0.065, 0.0035, 6, 48, Math.PI * 1.25);
  g.add(mesh(strap, mat(C.ink, { roughness: 0.8 }), [-0.055, 0.006, 0], [Math.PI / 2, 0, Math.PI * 0.375]));
  return g;
}
function sunglasses() {
  const g = new THREE.Group();
  const shield = new THREE.CylinderGeometry(0.085, 0.085, 0.045, 48, 1, true, -0.9, 1.8);
  g.add(mesh(shield, lensMat(), [-0.06, 0.03, 0], [0, Math.PI / 2, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.086, 0.086, 0.008, 48, 1, true, -0.95, 1.9), gloss(C.white), [-0.06, 0.053, 0], [0, Math.PI / 2, 0]));
  for (const z of [-1, 1]) g.add(mesh(new RoundedBoxGeometry(0.12, 0.007, 0.004, 2, 0.002), gloss(C.white), [-0.1, 0.048, z * 0.068], [0, z * 0.08, 0]));
  return g;
}
function bottle(tint) {
  const pts = [[0, 0], [0.034, 0], [0.037, 0.008], [0.037, 0.06], [0.034, 0.075], [0.037, 0.09], [0.037, 0.16], [0.03, 0.18], [0.021, 0.19], [0.02, 0.195]].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.Group();
  g.add(mesh(new THREE.LatheGeometry(pts, 48), mat(tint === 0xffffff ? C.white : tint, { roughness: 0.35, clearcoat: 0.6, transmission: 0.15, thickness: 0.01 })));
  g.add(mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.018, 32), gloss(C.ink), [0, 0.204, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.014, 16), mat(C.coral), [0, 0.22, 0]));
  return g;
}
function sunscreen() {
  const g = new THREE.Group();
  const tube = new THREE.CapsuleGeometry(0.024, 0.09, 8, 24);
  tube.scale(1, 1, 0.6);
  g.add(mesh(tube, gloss(0xf2c14e), [0, 0.07, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.02, 24), gloss(C.white), [0, 0.14, 0]));
  return g;
}
function watch(tint) {
  const g = new THREE.Group();
  const strap = new THREE.TorusGeometry(0.032, 0.009, 10, 48);
  strap.scale(1, 1, 0.35);
  g.add(mesh(strap, mat(tint === 0xffffff ? C.ink : tint, { roughness: 0.7 }), [0, 0.012, 0], [Math.PI / 2, 0, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 40), gloss(C.carbon, { metalness: 0.4 }), [0.032, 0.02, 0], [0, 0, Math.PI / 2]));
  g.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.002, 40), lensMat(), [0.039, 0.02, 0], [0, 0, Math.PI / 2]));
  return g;
}
function bibTexture(text) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 180;
  const c = cv.getContext('2d');
  c.fillStyle = '#fbf8f2'; c.fillRect(0, 0, 256, 180);
  c.fillStyle = '#d9785b'; c.fillRect(0, 0, 256, 26);
  c.fillStyle = '#13293d'; c.font = '900 92px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, 128, 106);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function raceBelt() {
  const g = new THREE.Group();
  const band = new THREE.TorusGeometry(0.11, 0.004, 6, 64);
  band.scale(1, 0.55, 1);
  g.add(mesh(band, mat(C.ink, { roughness: 0.8 }), [0, 0.006, 0], [Math.PI / 2, 0, 0]));
  g.add(mesh(new RoundedBoxGeometry(0.15, 0.002, 0.105, 2, 0.001), mat(0xffffff, { map: bibTexture('1197'), roughness: 0.8 }), [0.02, 0.01, 0], [0, -Math.PI / 2, 0]));
  return g;
}
function nutrition() {
  const g = new THREE.Group();
  [C.coral, 0xf2c14e, C.sea].forEach((c, i) => {
    const gel = new THREE.CapsuleGeometry(0.018, 0.06, 6, 16);
    gel.scale(1, 1, 0.28);
    g.add(mesh(gel, gloss(c), [-0.045 + i * 0.04, 0.006, 0], [Math.PI / 2, 0, 0.15 * (i - 1)]));
  });
  g.add(mesh(new RoundedBoxGeometry(0.13, 0.018, 0.034, 3, 0.006), gloss(0xd8b36a), [0, 0.012, 0.075]));
  return g;
}
function passport() {
  const g = new THREE.Group();
  g.add(mesh(new RoundedBoxGeometry(0.125, 0.01, 0.088, 3, 0.003), mat(C.ink, { roughness: 0.7 }), [0, 0.005, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.001, 32), gloss(C.gold, { metalness: 0.8 }), [0, 0.0105, 0]));
  return g;
}
// Folded clothing: a few soft slabs, slightly offset, with a contrasting stripe.
function folded(color, stripe, thick = 0.03, [w, d] = [0.3, 0.24]) {
  const g = new THREE.Group(), layers = 3, t = thick / layers;
  for (let i = 0; i < layers; i++) {
    g.add(mesh(new RoundedBoxGeometry(w - i * 0.01, t, d - i * 0.006, 3, t * 0.45), mat(color, { roughness: 0.85, sheen: 1, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.8 }), [i * 0.003, t / 2 + i * t, 0]));
  }
  if (stripe != null) g.add(mesh(new RoundedBoxGeometry(w * 0.9, 0.003, d * 0.12, 2, 0.001), mat(stripe, { roughness: 0.7 }), [0, thick + 0.001, d * 0.25]));
  return g;
}
function pedals() {
  const g = new THREE.Group();
  for (const z of [-0.055, 0.055]) {
    g.add(mesh(new RoundedBoxGeometry(0.09, 0.02, 0.07, 3, 0.008), gloss(C.carbon), [0, 0.01, z]));
    g.add(mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.06, 12), mat(0xb8bcc2, { metalness: 0.9, roughness: 0.3 }), [0, 0.012, z + Math.sign(z) * 0.06], [Math.PI / 2, 0, 0]));
  }
  return g;
}
function tools() {
  const g = new THREE.Group();
  g.add(mesh(new RoundedBoxGeometry(0.09, 0.018, 0.032, 3, 0.006), mat(0x8a9096, { metalness: 0.8, roughness: 0.35 }), [0, 0.009, -0.04]));
  g.add(mesh(new THREE.CapsuleGeometry(0.011, 0.07, 6, 16), mat(0xc9ced4, { metalness: 0.9, roughness: 0.25 }), [0, 0.011, 0.02], [0, 0, Math.PI / 2]));
  g.add(mesh(new THREE.TorusGeometry(0.04, 0.009, 10, 40), mat(C.rubber, { roughness: 0.9 }), [-0.08, 0.009, 0.01], [Math.PI / 2, 0, 0]));
  return g;
}
function charger() {
  const g = new THREE.Group();
  g.add(mesh(new RoundedBoxGeometry(0.05, 0.026, 0.05, 3, 0.008), gloss(C.white), [0, 0.013, 0]));
  const cable = new THREE.TorusGeometry(0.045, 0.003, 6, 48);
  g.add(mesh(cable, mat(C.ink), [0.085, 0.004, 0], [Math.PI / 2, 0, 0]));
  return g;
}
function glassBottle() {
  const pts = [[0, 0], [0.034, 0], [0.036, 0.01], [0.036, 0.17], [0.03, 0.2], [0.014, 0.23], [0.013, 0.27]].map(([r, y]) => new THREE.Vector2(r, y));
  return mesh(new THREE.LatheGeometry(pts, 40), mat(0x3f7f52, { roughness: 0.05, transmission: 0.7, thickness: 0.02, ior: 1.5 }));
}

const BUILD = {
  helmet_longtail: helmet, helmet_shorttail: helmet, helmet_aeroroad: helmet,
  shoe_tri: shoe, shoe_road: shoe, shoe_plated: shoe, shoe_trainer: shoe,
  goggles: (id, t) => goggles(t), sunglasses: () => sunglasses(), bottle: (id, t) => bottle(t), sunscreen: () => sunscreen(),
  watch: (id, t) => watch(t), race_belt: () => raceBelt(), nutrition: () => nutrition(), passport: () => passport(),
  suit_sleeved: (id, t) => folded(t === 0xffffff ? C.sea : t, C.ink), suit_sleeveless: (id, t) => folded(t === 0xffffff ? C.sea : t, C.coral),
  kit_training: (id, t) => folded(t === 0xffffff ? C.white : t, C.sea, 0.05), kit_casual: () => folded(C.white, C.coral, 0.05),
  swimskin: (id, t) => folded(C.ink, t === 0xffffff ? C.coral : t, 0.014, [0.3, 0.22]), wetsuit: () => folded(0x101316, 0x3e8ea0, 0.075, [0.36, 0.3]),
  pedals: () => pedals(), tools: () => tools(), charger: () => charger(), glass_bottle: () => glassBottle(),
};

// A new model of gear `id` tinted with `tint` (the player's colour), or null if only the Blender archetype exists.
export function gearModel(id, tint = 0xffffff) {
  const f = BUILD[id];
  if (!f) return null;
  const t = typeof tint === 'string' ? new THREE.Color(tint).getHex() : tint;
  const g = f(id, t);
  const obj = g.isGroup ? g : new THREE.Group().add(g);
  obj.name = 'gear:' + id;
  obj.userData.gearId = id;
  obj.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return obj;
}

// Highlight glow for both kinds of gear object (a single Blender mesh or a built group).
export function setGlow(obj, v) {
  obj.traverse(o => {
    if (!o.isMesh || !o.material || o.userData.noGlow) return;
    // Glossy physical materials bloom far more than the matte Blender ones: keep their highlight subtle.
    for (const m of [].concat(o.material)) if ('emissiveIntensity' in m && m.emissive) m.emissiveIntensity = m.isMeshPhysicalMaterial ? v * 0.4 : v;
  });
}
