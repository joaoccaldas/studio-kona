// Famous places of Kona and the Big Island in 3D. Each landmark has a hand-built stylised model placed at its real
// position (OpenStreetMap geocodes), a light-pillar pin you can see from kilometres away until you discover it,
// a discovery card with its story, and a stamp in your Island Passport. In Kailua town the generic grey box of the
// real building is removed and the landmark is fitted to that building's own footprint.
import * as THREE from 'three';

const R = s => { let x = s; return () => ((x = (x * 16807) % 2147483647) / 2147483647); };
const mats = new Map();
const M = (color, o = {}) => { const k = color + JSON.stringify(o); if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.02, ...o })); return mats.get(k); };
const BOX = new THREE.BoxGeometry(1, 1, 1);
function box(parent, m, sx, sy, sz, x, y, z, ry = 0) { const b = new THREE.Mesh(BOX, m); b.scale.set(sx, sy, sz); b.position.set(x, y, z); b.rotation.y = ry; b.castShadow = b.receiveShadow = true; parent.add(b); return b; }
function cyl(parent, m, r0, r1, h, x, y, z, seg = 12) { const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m); c.position.set(x, y, z); c.castShadow = true; parent.add(c); return c; }
function roofPrism(parent, m, w, l, h, x, y, z, ry = 0) {
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: l, bevelEnabled: false }); g.translate(0, 0, -l / 2);
  const r = new THREE.Mesh(g, m); r.position.set(x, y, z); r.rotation.y = ry; r.castShadow = true; parent.add(r); return r;
}
function hipRoof(parent, m, w, l, h, x, y, z) { const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1); g.rotateY(Math.PI / 4); const r = new THREE.Mesh(g, m); r.scale.set(w, h, l); r.position.set(x, y + h / 2, z); r.castShadow = true; parent.add(r); return r; }
function texture(draw, w = 256, h = 256, repeat = [1, 1]) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 4;
  return t;
}
const stoneTex = (base = [70, 66, 62], spread = 40) => texture((c, w, h) => {
  const r = R(7);
  c.fillStyle = `rgb(${base})`; c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 18) for (let x = -(y % 36); x < w; x += 26 + r() * 14) {
    const k = r() * spread - spread / 2;
    c.fillStyle = `rgb(${base.map(v => Math.max(0, Math.min(255, v + k)))})`;
    c.beginPath(); c.roundRect(x + 1, y + 1, 24 + r() * 10, 16, 5); c.fill();
  }
});
const plankTex = (col = '#d9c6a0') => texture((c, w, h) => {
  c.fillStyle = col; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(60,40,20,.35)'; c.lineWidth = 2;
  for (let x = 0; x < w; x += 16) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
});
const thatchTex = () => texture((c, w, h) => {
  c.fillStyle = '#b89b62'; c.fillRect(0, 0, w, h);
  const r = R(3);
  for (let i = 0; i < 900; i++) { c.strokeStyle = `rgba(${90 + r() * 60},${70 + r() * 40},${30 + r() * 20},.6)`; c.lineWidth = 1 + r() * 2; const x = r() * w, y = r() * h; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 6, y + 14 + r() * 10); c.stroke(); }
});
export function signTexture(title, sub = '', { bg = '#13293D', fg = '#FBF8F2', accent = '#D9785B' } = {}) {
  return texture((c, w, h) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.fillStyle = accent; c.fillRect(0, h - 14, w, 14);
    c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 ${sub ? 64 : 76}px Georgia, serif`; c.fillText(title, w / 2, sub ? h * 0.38 : h * 0.47);
    if (sub) { c.font = '600 34px system-ui'; c.globalAlpha = 0.8; c.fillText(sub, w / 2, h * 0.72); }
  }, 1024, 200);
}
function sign(parent, title, sub, x, y, z, ry = 0, w = 5) {
  const t = signTexture(title, sub);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.195), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
  m.position.set(x, y, z); m.rotation.y = ry; parent.add(m);
  for (const s of [-1, 1]) cyl(parent, M(0x6b4a2a), 0.06, 0.06, y, x + Math.cos(ry) * s * w * 0.42, y / 2 - 0.4, z - Math.sin(ry) * s * w * 0.42, 6);
  return m;
}
function kii(parent, x, z, h = 3.2, ry = 0) {   // carved wooden temple image, simplified
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
  const wood = M(0x5b4128, { roughness: 0.95 });
  cyl(g, wood, 0.28, 0.34, h * 0.62, 0, h * 0.31, 0, 8);
  box(g, wood, 0.9, h * 0.42, 0.62, 0, h * 0.78, 0);                                   // head
  box(g, M(0x2a1d12), 0.62, 0.12, 0.05, 0, h * 0.74, 0.32);                            // mouth
  box(g, wood, 1.2, 0.2, 0.3, 0, h * 1.02, 0);                                         // crest
  parent.add(g); return g;
}
function palm(parent, x, z, h = 8, lean = 0.1, seed = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const r = R(seed);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, h, 7), M(0x8a6a48)); trunk.position.y = h / 2; trunk.rotation.z = lean; g.add(trunk);
  const top = new THREE.Group(); top.position.set(-Math.sin(lean) * h, h, 0); g.add(top);
  for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.6, 4, 1), M(0x3f7a3a, { flatShading: true })); f.geometry.translate(0, 1.8, 0); f.rotation.set(1.9 + r() * 0.3, i * 0.9, 0); f.scale.set(1, 1, 0.25); top.add(f); }
  parent.add(g); return g;
}

// ------------------------------------------------------------------ builders. fit = { w, l, angle } from the real footprint when known
const B = {
  mokuaikaua(fit) {       // 1837 lava-rock and coral church with its white steeple, the oldest church in Hawaiʻi
    const g = new THREE.Group(), w = fit?.w || 13, l = fit?.l || 32;
    const stone = new THREE.MeshStandardMaterial({ map: stoneTex([74, 70, 66]), roughness: 0.95 }); stone.map.repeat.set(3, 1.2);
    box(g, stone, w, 8, l, 0, 4, 0);
    roofPrism(g, M(0x4a5560, { roughness: 0.6 }), w + 1, l + 0.6, 4.2, 0, 8, 0);
    for (let i = -2; i <= 2; i++) for (const s of [-1, 1]) box(g, M(0xfbf8f2), 0.1, 3.4, 1.4, s * (w / 2 + 0.05), 4.2, i * l / 6);   // tall windows
    const tz = -l / 2 - 2.6;
    box(g, stone, 5.4, 12, 5.4, 0, 6, tz);
    box(g, M(0xfbf8f2), 4.6, 6, 4.6, 0, 15, tz);
    box(g, M(0xfbf8f2), 3.6, 4, 3.6, 0, 20, tz);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(1.9, 10, 8), M(0xfbf8f2)); spire.position.set(0, 27, tz); g.add(spire);
    box(g, M(0x13293d), 1.6, 2.6, 0.1, 0, 15.5, tz - 2.32);                              // belfry louvres
    box(g, M(0x6b4a2a), 2.2, 3.6, 0.2, 0, 1.8, tz - 2.72);                               // door
    g.userData.colliders = [[0, 0, w / 2, l / 2], [0, tz, 2.7, 2.7]];
    return g;
  },
  hulihee(fit) {          // Huliheʻe Palace, 1838: two storeys of lava rock with white verandas, a royal summer home
    const g = new THREE.Group(), w = fit?.w || 20, l = fit?.l || 16;
    const stone = new THREE.MeshStandardMaterial({ map: stoneTex([64, 60, 58]), roughness: 0.95 }); stone.map.repeat.set(3, 1.4);
    box(g, stone, w, 8.4, l, 0, 4.2, 0);
    box(g, M(0xfbf8f2), w + 3.4, 0.35, 3, 0, 4.2, l / 2 + 1.4);                          // upper lanai floor
    box(g, M(0xfbf8f2), w + 3.4, 0.25, 3, 0, 8.4, l / 2 + 1.4);
    for (let i = 0; i <= 8; i++) { const x = -w / 2 - 1.5 + i * (w + 3) / 8; cyl(g, M(0xfbf8f2), 0.16, 0.16, 4, x, 2.1, l / 2 + 2.7, 8); cyl(g, M(0xfbf8f2), 0.14, 0.14, 4, x, 6.3, l / 2 + 2.7, 8); }
    box(g, M(0xfbf8f2), w + 3.4, 0.7, 0.12, 0, 5, l / 2 + 2.8);                          // railing
    hipRoof(g, M(0x3a4a57), w * 1.12, l * 1.25, 3.4, 0, 8.4, 0.8);
    for (let i = -2; i <= 2; i++) { box(g, M(0x2e6f73), 1.4, 2.4, 0.1, i * w / 5.5, 2.4, l / 2 + 0.06); box(g, M(0x2e6f73), 1.4, 2.4, 0.1, i * w / 5.5, 6.4, l / 2 + 0.06); }
    for (let i = 0; i < 4; i++) palm(g, -w / 2 - 6 + i * (w + 12) / 3, l / 2 + 9, 9 + i % 2 * 2, 0.08 * (i % 2 ? 1 : -1), i + 3);
    g.userData.colliders = [[0, 0, w / 2 + 1.7, l / 2 + 2.8]];
    return g;
  },
  konainn() {             // the inn's own buildings are already in the survey; add the seawall lawn palms and a sign
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) palm(g, -14 + i * 7, -6 + (i % 2) * 3, 9 + (i % 3), 0.1 * (i % 2 ? 1 : -1), i + 40);
    sign(g, 'Kona Inn', 'Since 1928 · the sunset lawn', 0, 1.8, 4, 0, 5);
    return g;
  },
  finish() {              // the finish arch on Aliʻi Drive with the banyan beside it
    const g = new THREE.Group();
    for (const x of [-7.5, 7.5]) box(g, M(0x13293d), 1, 7.5, 1.4, x, 3.75, 0);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(16, 2.4), new THREE.MeshBasicMaterial({ map: signTexture('FINISH', 'Aliʻi Drive · Kailua-Kona'), side: THREE.DoubleSide }));
    banner.position.set(0, 7.2, 0); g.add(banner);
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(9, 60), M(0xc0392b, { roughness: 0.95 })); carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.06, 26); carpet.receiveShadow = true; g.add(carpet);
    for (const s of [-1, 1]) for (let i = 0; i < 14; i++) box(g, M(0x2e6f73), 0.2, 1.1, 2, s * 5.2, 0.55, 2 + i * 2.2);   // barriers
    // Banyan: many trunks and a huge flat canopy.
    const bx = 22, bz = -16, bark = M(0x7a6a5a, { roughness: 1 });
    const r = R(11);
    for (let i = 0; i < 14; i++) { const a = r() * 6.28, d = r() * 5; cyl(g, bark, 0.25 + r() * 0.4, 0.4 + r() * 0.5, 7, bx + Math.cos(a) * d, 3.5, bz + Math.sin(a) * d, 7); }
    for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), M(0x3d6e38, { flatShading: true })); const a = r() * 6.28, d = r() * 8; c.scale.set(4 + r() * 2, 2.2 + r() * 1, 4 + r() * 2); c.position.set(bx + Math.cos(a) * d * 0.7, 8 + r() * 1.5, bz + Math.sin(a) * d * 0.7); c.castShadow = true; g.add(c); }
    g.userData.colliders = [[-7.5, 0, 0.5, 0.7], [7.5, 0, 0.5, 0.7], [bx, bz, 3, 3]];
    return g;
  },
  ahuena() {              // Ahuʻena Heiau is already modelled from survey; add its anuʻu tower glow and a sign
    const g = new THREE.Group();
    sign(g, 'Ahuʻena Heiau', 'Restored by Kamehameha I · Kamakahonu', 0, 2.6, 22, Math.PI, 6);
    return g;
  },
  nelha() {               // Natural Energy Laboratory: solar arrays, cold deep-seawater pipes, the famous hot road
    const g = new THREE.Group();
    const panel = new THREE.MeshStandardMaterial({ color: 0x1d3557, metalness: 0.6, roughness: 0.25 });
    for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) { const p = box(g, panel, 5, 0.12, 2.6, -24 + c * 6.4, 1.3, -14 + r * 5); p.rotation.x = -0.45; cyl(g, M(0x9aa0a6), 0.06, 0.06, 1.3, -24 + c * 6.4, 0.65, -14 + r * 5, 6); }
    for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 80, 14), M(0x2b2f36, { roughness: 0.5 })); p.rotation.z = Math.PI / 2; p.rotation.y = 0.3; p.position.set(10, 0.6, 20 + i * 1.6); g.add(p); }
    box(g, M(0xfbf8f2), 18, 6, 12, 32, 3, 0);
    box(g, M(0x6f8f9a), 19, 0.6, 13, 32, 6.3, 0);
    sign(g, 'Natural Energy Lab', 'Keāhole Point · the hottest miles of the run', 0, 2.4, 30, 0, 7);
    g.userData.colliders = [[32, 0, 9, 6]];
    return g;
  },
  puukohola() {           // Puʻukoholā Heiau, 1791: Kamehameha's great war temple of stacked lava rock
    const g = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ map: stoneTex([80, 70, 62], 50), roughness: 1 }); stone.map.repeat.set(8, 1);
    const steps = [[68, 5, 32], [62, 4, 26], [56, 3, 20]];
    let y = 0;
    for (const [w, h, l] of steps) { box(g, stone, w, h, l, 0, y + h / 2, 0); y += h; }
    for (let i = 0; i < 3; i++) { const h = new THREE.Group(); h.position.set(-16 + i * 16, y, 0); box(h, M(0x6b4a2a), 5, 2.4, 3.5, 0, 1.2, 0); roofPrism(h, new THREE.MeshStandardMaterial({ map: thatchTex(), roughness: 1 }), 6.4, 4.4, 3.2, 0, 2.4, 0, Math.PI / 2); g.add(h); }
    for (let i = 0; i < 6; i++) kii(g, -25 + i * 10, 9.5, 3.6);
    sign(g, 'Puʻukoholā Heiau', 'Built by Kamehameha I · 1791', 0, 2.2, 24, 0, 6);
    g.userData.colliders = [[0, 0, 34, 16]];
    return g;
  },
  hawi() {                // Hāwī: the bike turnaround in a little plantation town of wooden storefronts
    const g = new THREE.Group();
    const cols = [0xd9785b, 0x2e6f73, 0xe8c35a, 0x6b8fb3, 0xfbf8f2];
    for (let i = 0; i < 6; i++) {
      const x = -28 + i * 11, f = new THREE.Group(); f.position.set(x, 0, -14);
      box(f, M(cols[i % cols.length]), 9, 4.2, 9, 0, 2.1, 0);
      box(f, M(cols[(i + 2) % cols.length]), 9.4, 2.2, 0.3, 0, 5.2, 4.6);              // false front
      box(f, M(0x6b4a2a), 9.6, 0.2, 2.6, 0, 3.4, 5.6);                                   // awning
      for (const s of [-1, 1]) cyl(f, M(0xfbf8f2), 0.1, 0.1, 3.4, s * 4.4, 1.7, 6.8, 6);
      box(f, M(0x9fd3e8, { roughness: 0.2 }), 5, 2, 0.1, 0, 1.6, 4.55);
      g.add(f);
    }
    for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 12), M(0xff7a3d)); const a = i / 9 * Math.PI * 2; c.position.set(Math.cos(a) * 6, 0.45, 10 + Math.sin(a) * 6); g.add(c); }
    sign(g, 'Hāwī', 'Bike turnaround · mile 60', 0, 2.4, 18, 0, 6);
    g.userData.colliders = [[0, -14, 33, 5]];
    return g;
  },
  kamehameha() {          // the original King Kamehameha statue in Kapaʻau, gold-clad with feather cloak and spear
    const g = new THREE.Group();
    box(g, new THREE.MeshStandardMaterial({ map: stoneTex([110, 105, 98], 30) }), 4, 3, 4, 0, 1.5, 0);
    const gold = M(0xd4a53c, { metalness: 0.85, roughness: 0.3 }), bronze = M(0x2f261d, { metalness: 0.5, roughness: 0.5 });
    const f = new THREE.Group(); f.position.y = 3; g.add(f);
    for (const s of [-1, 1]) box(f, bronze, 0.5, 2, 0.55, s * 0.4, 1, 0);
    box(f, bronze, 1.5, 2.1, 0.8, 0, 3, 0);
    box(f, M(0xc0392b, { roughness: 0.6 }), 1.9, 2.3, 0.3, 0, 2.9, -0.5);                 // cloak
    box(f, gold, 1.95, 0.4, 0.34, 0, 3.9, -0.45);
    box(f, gold, 1.2, 0.5, 0.9, 0, 2.2, 0.05);                                              // sash
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), bronze); head.position.set(0, 4.5, 0); f.add(head);
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), gold); helm.position.set(0, 4.6, 0); f.add(helm);
    box(f, gold, 0.18, 0.7, 1.1, 0, 5, 0);                                                  // crest
    box(f, bronze, 0.35, 1.7, 0.35, 1, 3.9, 0.3).rotation.z = -0.8;                         // outstretched arm
    cyl(f, M(0x6b4a2a), 0.06, 0.06, 5.5, -1, 2.8, 0.2, 6);                                  // spear
    sign(g, 'King Kamehameha', 'Kapaʻau · the original statue', 0, 1.8, 8, 0, 5);
    g.userData.colliders = [[0, 0, 2, 2]];
    return g;
  },
  littleblue() {          // St. Peter's, the "Little Blue Church" on the water at Kahaluʻu
    const g = new THREE.Group();
    box(g, new THREE.MeshStandardMaterial({ map: plankTex('#5d8fc9') }), 6, 4, 11, 0, 2, 0);
    roofPrism(g, M(0xfbf8f2), 7, 11.6, 3, 0, 4, 0);
    box(g, M(0xfbf8f2), 1.6, 2.6, 0.1, 0, 1.3, 5.53);
    box(g, M(0xfbf8f2), 0.2, 1.4, 0.2, 0, 7.8, 4.8); box(g, M(0xfbf8f2), 0.9, 0.2, 0.2, 0, 8.1, 4.8);
    for (let i = -1; i <= 1; i++) for (const s of [-1, 1]) box(g, M(0xfbf8f2), 0.08, 1.6, 0.9, s * 3.03, 2.3, i * 3.2);
    sign(g, 'St. Peter’s Church', 'The Little Blue Church · Kahaluʻu', 8, 1.8, 6, -0.4, 5);
    g.userData.colliders = [[0, 0, 3.2, 5.8]];
    return g;
  },
  kahaluu() {             // Kahaluʻu Bay: honu hauled out on the black sand
    const g = new THREE.Group();
    const r = R(5);
    for (let i = 0; i < 6; i++) {
      const t = new THREE.Group(); t.position.set((r() - 0.5) * 18, 0.05, (r() - 0.5) * 12); t.rotation.y = r() * 6;
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0x5d6b34)); s.scale.set(1, 0.5, 1.3); t.add(s);
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), M(0x6f7a45)); h.position.set(0, 0.1, -0.85); t.add(h);
      for (const [x, z] of [[-0.55, -0.35], [0.55, -0.35], [-0.4, 0.55], [0.4, 0.55]]) { const f = box(t, M(0x6f7a45), 0.45, 0.05, 0.18, x, 0.02, z); f.rotation.y = x * 0.8; }
      g.add(t);
    }
    sign(g, 'Kahaluʻu Bay', 'Honu rest here · give them 3 m', 0, 1.6, 10, 0, 5);
    return g;
  },
  cook() {                // the Captain Cook Monument on Kealakekua Bay
    const g = new THREE.Group();
    box(g, M(0xeeeeea), 3, 0.6, 3, 0, 0.3, 0);
    const o = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.05, 8, 4, 1), M(0xf4f2ec)); o.rotation.y = Math.PI / 4; o.position.y = 4.6; g.add(o);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.78, 1.1, 4), M(0xf4f2ec)); tip.rotation.y = Math.PI / 4; tip.position.y = 9.15; g.add(tip);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; cyl(g, M(0x2b2f36), 0.08, 0.08, 1, Math.cos(a) * 3.2, 0.5, Math.sin(a) * 3.2, 6); }
    sign(g, 'Kealakekua Bay', 'Captain Cook Monument · 1874', 0, 1.6, 7, 0, 5);
    g.userData.colliders = [[0, 0, 1.6, 1.6]];
    return g;
  },
  puuhonua() {            // Puʻuhonua o Hōnaunau: the place of refuge, Hale o Keawe and its kiʻi, the Great Wall
    const g = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ map: stoneTex([60, 56, 52], 40), roughness: 1 }); stone.map.repeat.set(12, 1);
    box(g, stone, 3.2, 3.2, 110, -30, 1.6, 0);                                              // the Great Wall
    const plat = new THREE.MeshStandardMaterial({ map: stoneTex([70, 64, 58], 40) });
    box(g, plat, 16, 1.4, 12, 0, 0.7, 0);
    const h = new THREE.Group(); h.position.set(0, 1.4, 0); g.add(h);
    box(h, M(0x6b4a2a), 6, 3, 4.5, 0, 1.5, 0);
    roofPrism(h, new THREE.MeshStandardMaterial({ map: thatchTex(), roughness: 1 }), 7.4, 5.6, 4.4, 0, 3, 0, Math.PI / 2);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; kii(g, Math.cos(a) * 9.5, Math.sin(a) * 7.5, 3.6 + (i % 3) * 0.5, -a + Math.PI / 2); }
    for (let i = 0; i < 6; i++) palm(g, 14 + (i % 3) * 5, -10 + i * 5, 10 + (i % 2) * 3, 0.12, i + 20);
    sign(g, 'Puʻuhonua o Hōnaunau', 'Place of refuge', 0, 2, 14, 0, 6);
    g.userData.colliders = [[-30, 0, 1.6, 55], [0, 0, 8, 6]];
    return g;
  },
  maunakea() {            // the observatories on the summit of Mauna Kea, 4,207 m
    const g = new THREE.Group();
    const r = R(9);
    for (let i = 0; i < 9; i++) {
      const s = 5 + r() * 6, x = (r() - 0.5) * 260, z = (r() - 0.5) * 200;
      cyl(g, M(i % 4 === 0 ? 0xd9d6cf : 0xf4f2ec, { roughness: 0.4, metalness: 0.2 }), s, s, s * 0.9, x, s * 0.45, z, 20);
      const d = new THREE.Mesh(new THREE.SphereGeometry(s, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(0xf4f2ec, { roughness: 0.3, metalness: 0.3 })); d.position.set(x, s * 0.9, z); g.add(d);
      box(g, M(0x2b2f36), s * 0.3, s * 0.9, 0.2, x, s * 1.2, z + s * 0.9);
    }
    sign(g, 'Mauna Kea', 'Summit observatories · 4,207 m', 0, 2, 40, 0, 7);
    return g;
  },
  kilauea() {             // Halemaʻumaʻu crater at Kīlauea: the home of Pele, glowing lava lake and a steam plume
    const g = new THREE.Group();
    const lava = new THREE.Mesh(new THREE.CircleGeometry(160, 48), new THREE.MeshBasicMaterial({ color: 0xff5a1f }));
    lava.rotation.x = -Math.PI / 2; lava.position.y = -60; g.add(lava);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(190, 170, 70, 48, 1, true), M(0x2b2522, { side: THREE.BackSide, roughness: 1 }));
    wall.position.y = -25; g.add(wall);
    const glow = new THREE.PointLight(0xff6a2a, 4, 600, 1.5); glow.position.y = -30; g.add(glow);
    const smoke = new THREE.Group(); g.add(smoke);
    for (let i = 0; i < 14; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(40 + i * 6, 12, 8), new THREE.MeshBasicMaterial({ color: 0xe8e2da, transparent: true, opacity: 0.18, depthWrite: false })); p.position.set(i * 12, -20 + i * 38, i * 6); smoke.add(p); }
    g.userData.tick = t => { lava.material.color.setHSL(0.04, 1, 0.5 + Math.sin(t * 2) * 0.06); smoke.rotation.y = t * 0.02; };
    sign(g, 'Halemaʻumaʻu', 'Kīlauea · the home of Pele', 0, 2, 210, 0, 8);
    return g;
  },
  holualoa() {            // a Kona coffee farm on the slopes above Kailua: rows of coffee, a drying deck, the farm shack
    const g = new THREE.Group();
    const r = R(13), leaf = M(0x2f5d2a, { flatShading: true }), cherry = M(0xc0392b);
    for (let row = 0; row < 7; row++) for (let i = 0; i < 12; i++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), leaf); b.scale.set(1, 1.3 + r() * 0.3, 1); b.position.set(-22 + i * 3.6, 1.1, -10 + row * 3.2); b.castShadow = true; g.add(b);
      if (r() < 0.6) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), cherry); c.position.set(b.position.x + 0.5, 1.2, b.position.z + 0.6); g.add(c); }
    }
    box(g, plankMat('#8a5a3a'), 10, 3.6, 7, 26, 1.8, -2);
    roofPrism(g, M(0x9aa0a6, { metalness: 0.5, roughness: 0.4 }), 11, 8, 2, 26, 3.6, -2);
    box(g, plankMat('#c9a878'), 12, 0.3, 8, 26, 0.3, 10);
    for (let i = 0; i < 40; i++) { const bean = new THREE.Mesh(new THREE.SphereGeometry(0.2, 5, 4), M(0x6b3e20)); bean.position.set(21 + r() * 10, 0.5, 7 + r() * 6); g.add(bean); }
    sign(g, 'Kona Coffee Farm', 'Hōlualoa · 100% Kona', 0, 1.8, 14, 0, 5);
    g.userData.colliders = [[26, -2, 5, 3.5]];
    return g;
  },
  koa() { const g = new THREE.Group(); return g; },     // the airport already exists in the world
};
function plankMat(c) { return new THREE.MeshStandardMaterial({ map: plankTex(c), roughness: 0.9 }); }

// ------------------------------------------------------------------ the catalog. pos: lat/lon (or survey x/y), r: town footprint to replace
export const LANDMARKS = [
  { id: 'ahuena', name: 'Ahuʻena Heiau', icon: '🗿', xy: [-60, -30], area: 'Kailua', fact: 'King Kamehameha I restored this temple at Kamakahonu and lived here in his last years. It is still a sacred place: look from the beach.' },
  { id: 'finish', name: 'The Finish Line', icon: '🏁', xy: [155.7, 98.7], rot: -1.8, area: 'Kailua', fact: 'Every October thousands run down Aliʻi Drive under the banyan to this spot. The last finishers come in at midnight to the loudest cheers of the day.' },
  { id: 'mokuaikaua', name: 'Mokuʻaikaua Church', icon: '⛪', ll: [19.6396149, -155.9937126], replace: 22, area: 'Kailua', fact: 'Built in 1837 from lava rock and coral mortar, the oldest Christian church in Hawaiʻi. Its steeple is still the tallest thing on Aliʻi Drive.' },
  { id: 'hulihee', name: 'Huliheʻe Palace', icon: '🏛️', ll: [19.63908, -155.99405], replace: 18, area: 'Kailua', fact: 'A summer palace of Hawaiian royalty since 1838, now a museum of their furniture, quilts and feather work, right on the bay.' },
  { id: 'konainn', name: 'Kona Inn', icon: '🌺', ll: [19.6382065, -155.9935801], area: 'Kailua', fact: 'Opened in 1928 for the first steamship tourists. Its lawn on the seawall is the best sunset seat in town.' },
  { id: 'holualoa', name: 'Kona Coffee Farm', icon: '☕', ll: [19.6205, -155.9478], area: 'Hōlualoa', fact: 'Kona coffee only grows on this one strip of volcanic slope: morning sun, afternoon clouds and rich lava soil.' },
  { id: 'kahaluu', name: 'Kahaluʻu Bay', icon: '🐢', ll: [19.5793, -155.9667], area: 'Kahaluʻu', fact: 'A shallow, sheltered bay full of reef fish, where green sea turtles (honu) come ashore to rest. Give them 3 m of space.' },
  { id: 'littleblue', name: 'The Little Blue Church', icon: '💙', ll: [19.5826, -155.9669], area: 'Kahaluʻu', fact: 'St. Peter’s Catholic Church, a tiny wooden chapel right on the rocks, moved here from White Sands beach in 1912.' },
  { id: 'cook', name: 'Captain Cook Monument', icon: '⚓', ll: [19.4810, -155.9330], area: 'Kealakekua Bay', fact: 'Where Captain James Cook died in 1779. The bay is now a marine sanctuary with spinner dolphins in the mornings.' },
  { id: 'puuhonua', name: 'Puʻuhonua o Hōnaunau', icon: '🛡️', ll: [19.4213, -155.9112], area: 'Hōnaunau', fact: 'A place of refuge: anyone who broke a kapu and reached these walls was safe. The kiʻi guard Hale o Keawe, the temple of the chiefs.' },
  { id: 'nelha', name: 'Natural Energy Lab', icon: '☀️', ll: [19.7174904, -156.0380702], area: 'Keāhole', fact: 'Deep cold seawater is pumped up here for science and aquaculture. For runners it is the hottest, loneliest stretch of the marathon.' },
  { id: 'koa', name: 'Kona Airport', icon: '✈️', ll: [19.743906, -156.042296], area: 'Keāhole', fact: 'An open-air airport of thatched pavilions on the lava. Most athletes and their bike boxes arrive here.' },
  { id: 'puukohola', name: 'Puʻukoholā Heiau', icon: '🔥', ll: [20.0266, -155.8219], area: 'Kawaihae', fact: 'Kamehameha I built this great temple in 1791 with rocks passed hand to hand from Pololū Valley, before uniting the islands.' },
  { id: 'hawi', name: 'Hāwī Turnaround', icon: '🔄', ll: [20.239006, -155.831451], area: 'North Kohala', fact: 'The bike turnaround at mile 60, after the long crosswind climb. The descent back down is the fastest part of the race.' },
  { id: 'kamehameha', name: 'King Kamehameha Statue', icon: '👑', ll: [20.2328, -155.8003], area: 'Kapaʻau', fact: 'The original statue, lost at sea in 1880 and found again, stands in his birthplace, North Kohala. Every June it is draped in long lei.' },
  { id: 'maunakea', name: 'Mauna Kea Summit', icon: '🔭', ll: [19.8206673, -155.468071], area: 'Mauna Kea', fact: 'Measured from the sea floor it is the tallest mountain on Earth. Its summit holds some of the world’s largest telescopes.' },
  { id: 'kilauea', name: 'Halemaʻumaʻu Crater', icon: '🌋', ll: [19.4064949, -155.2820958], area: 'Kīlauea', fact: 'The home of Pele, goddess of fire and volcanoes. One of the most active volcanoes on Earth.' },
];

// ------------------------------------------------------------------ town building carving (remove a real building's generic box)
function components(geo) {
  const idx = geo.index.array, n = geo.attributes.position.count, parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  for (let t = 0; t < idx.length; t += 3) { const a = find(idx[t]), b = find(idx[t + 1]), c = find(idx[t + 2]); parent[b] = a; parent[c] = a; }
  // Vertices at identical positions (split normals) belong together too.
  const pos = geo.attributes.position, key = new Map();
  for (let i = 0; i < n; i++) { const k = `${pos.getX(i).toFixed(2)},${pos.getY(i).toFixed(2)},${pos.getZ(i).toFixed(2)}`; const j = key.get(k); if (j == null) key.set(k, i); else parent[find(i)] = find(j); }
  return i => find(i);
}
// Remove every building whose centre lies within r of (x, z) (three.js coords). Returns the footprint of the biggest one.
export function carveTown(meshes, x, z, r) {
  let best = null;
  for (const mesh of meshes) {
    const g = mesh.geometry, pos = g.attributes.position, idx = g.index.array;
    const root = g.userData._root || (g.userData._root = components(g));
    const groups = new Map();
    for (let i = 0; i < pos.count; i++) { const k = root(i); let e = groups.get(k); if (!e) groups.set(k, e = { xs: [], zs: [] }); e.xs.push(pos.getX(i)); e.zs.push(pos.getZ(i)); }
    const kill = new Set();
    for (const [k, e] of groups) {
      const cx = e.xs.reduce((a, b) => a + b, 0) / e.xs.length, cz = e.zs.reduce((a, b) => a + b, 0) / e.zs.length;
      if (Math.hypot(cx - x, cz - z) > r) continue;
      kill.add(k);
      // Footprint by principal axes.
      let sxx = 0, szz = 0, sxz = 0;
      for (let i = 0; i < e.xs.length; i++) { const dx = e.xs[i] - cx, dz = e.zs[i] - cz; sxx += dx * dx; szz += dz * dz; sxz += dx * dz; }
      const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz), ca = Math.cos(ang), sa = Math.sin(ang);
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      for (let i = 0; i < e.xs.length; i++) { const dx = e.xs[i] - cx, dz = e.zs[i] - cz, u = dx * ca + dz * sa, v = -dx * sa + dz * ca; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
      const area = (u1 - u0) * (v1 - v0);
      if (!best || area > best.area) best = { x: cx + ca * (u0 + u1) / 2 - sa * (v0 + v1) / 2, z: cz + sa * (u0 + u1) / 2 + ca * (v0 + v1) / 2, l: u1 - u0, w: v1 - v0, angle: ang, area };
    }
    if (!kill.size) continue;
    for (let t = 0; t < idx.length; t += 3) if (kill.has(root(idx[t]))) { idx[t + 1] = idx[t]; idx[t + 2] = idx[t]; }
    g.index.needsUpdate = true;
  }
  return best;
}

// ------------------------------------------------------------------ the manager: lazy models, pins, discovery, colliders
export function createLandmarks({ scene, W, toLocal, groundAt, townMeshes = [], rewards, onDiscover }) {
  const list = LANDMARKS.map(l => {
    const [x, y] = l.xy || toLocal(l.ll[0], l.ll[1]);
    return { ...l, x, y, built: null, found: false };
  });
  let found = new Set();
  try { found = new Set(JSON.parse(localStorage.getItem('kona-passport') || '[]')); } catch { /* storage blocked */ }
  for (const l of list) l.found = found.has(l.id);

  // Pins: a soft light pillar and a floating icon, visible from far away (no fog), hidden once discovered.
  const pillarGeo = new THREE.CylinderGeometry(1.2, 1.2, 1, 12, 1, true);
  pillarGeo.translate(0, 0.5, 0);
  function iconSprite(text, found) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const c = cv.getContext('2d');
    c.fillStyle = found ? '#2E6F73' : '#D9785B'; c.beginPath(); c.arc(64, 56, 46, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(40, 90); c.lineTo(64, 124); c.lineTo(88, 90); c.fill();
    c.fillStyle = '#FBF8F2'; c.beginPath(); c.arc(64, 56, 38, 0, Math.PI * 2); c.fill();
    c.font = '48px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(found ? text : '?', 64, 60);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: t, fog: false, depthWrite: false, transparent: true }));
  }
  for (const l of list) {
    const pin = new THREE.Group();
    const pillar = new THREE.Mesh(pillarGeo, new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.25, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    pillar.scale.set(1, 140, 1);
    const icon = iconSprite(l.icon, l.found);
    icon.position.y = 150;
    pin.add(pillar, icon);
    const h = Math.max(0, groundAt(l.x, l.y));
    pin.position.copy(W(l.x, l.y, h));
    scene.add(pin);
    l.pin = pin; l.pillar = pillar; l.sprite = icon;
    pillar.visible = !l.found;
  }

  function build(l) {
    const raw = l.replace ? carveTown(townMeshes, l.x, -l.y, l.replace) : null;
    // Normalise the footprint: l is the long side, and the model's local z runs along it.
    const fit = raw && raw.area > 80 && { x: raw.x, z: raw.z, l: Math.max(raw.l, raw.w), w: Math.min(raw.l, raw.w), rot: raw.l >= raw.w ? Math.PI / 2 - raw.angle : -raw.angle };
    const make = B[l.id];
    const g = make ? make(fit) : new THREE.Group();
    const cx = fit ? fit.x : l.x, cz = fit ? fit.z : -l.y;
    const h = Math.max(0, groundAt(cx, -cz)) - 0.05;
    g.position.set(cx, h, cz);
    // Long side of the model runs along its local z; line it up with the building's long axis.
    if (fit) g.rotation.y = fit.rot;
    else if (l.rot != null) g.rotation.y = l.rot;
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(g);
    l.built = g;
    l.colliders = (g.userData.colliders || []).map(([x, z, hx, hz]) => ({ x, z, hx, hz }));
  }

  let t = 0;
  const inv = new THREE.Matrix4(), p = new THREE.Vector3();
  function update(dt, camera) {
    t += dt;
    const px = camera.position.x, py = -camera.position.z;
    for (const l of list) {
      const d = Math.hypot(px - l.x, py - l.y);
      if (!l.built && d < 2500) build(l);
      l.pin.visible = d > 60;
      if (l.pillar.visible) l.pillar.material.opacity = 0.18 + Math.sin(t * 2 + l.x) * 0.06;
      l.sprite.scale.setScalar(Math.max(8, Math.min(90, d * 0.035)));
      l.sprite.position.y = 150 + Math.sin(t * 1.5 + l.y) * 4;
      l.built?.userData.tick?.(t);
      if (!l.found && d < (l.area === 'Kailua' ? 32 : 60)) discover(l);
    }
    // Keep the athlete out of walls and statues (simple boxes in each model's own frame).
    for (const l of list) {
      if (!l.colliders?.length || Math.hypot(px - l.x, py - l.y) > 200) continue;
      inv.copy(l.built.matrixWorld).invert();
      for (const c of l.colliders) {
        p.copy(camera.position).applyMatrix4(inv);
        const dx = p.x - c.x, dz = p.z - c.z, ox = c.hx + 0.4 - Math.abs(dx), oz = c.hz + 0.4 - Math.abs(dz);
        if (ox > 0 && oz > 0) {
          if (ox < oz) p.x += Math.sign(dx || 1) * ox; else p.z += Math.sign(dz || 1) * oz;
          const y = camera.position.y;
          camera.position.copy(p.applyMatrix4(l.built.matrixWorld));
          camera.position.y = y;
        }
      }
    }
  }
  function discover(l) {
    l.found = true;
    found.add(l.id);
    try { localStorage.setItem('kona-passport', JSON.stringify([...found])); } catch { /* storage blocked */ }
    l.pillar.visible = false;
    const old = l.sprite, nu = iconSprite(l.icon, true);
    nu.position.copy(old.position); nu.scale.copy(old.scale); l.pin.remove(old); l.pin.add(nu); l.sprite = nu;
    const paid = rewards?.grantOnce(`landmark:${l.id}`, { xp: 60, credits: 25, reason: `Discovered ${l.name}` });
    onDiscover?.(l, paid, found.size, list.length);
  }
  return {
    list, update, discover,
    get found() { return found.size; },
    spawnFor(l) { const d = l.area === 'Kailua' ? 60 : l.id === 'kilauea' ? 280 : l.id === 'maunakea' ? 180 : 110; return { x: l.x - d * 0.4, y: l.y - d * 0.92 }; },
  };
}
