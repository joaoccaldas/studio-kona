// The blocky triathlete (Roblox/Minecraft style) and its TT bike. Everything a triathlete would want to wear:
// suit patterns, aero or road helmet, visor, cap, swim cap and goggles, shades, compression socks, race belt
// with bib, and fun unlockables (Underpants Run briefs, pineapple, flower crown, lei, finisher medal, surfboard,
// coffee). Parts pivot at the joints so walking, riding, swimming and emotes are simple rotations.
import * as THREE from 'three';
import { DEFAULT_LOOK } from './lore.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const lam = c => new THREE.MeshLambertMaterial({ color: c });
const tex = (draw, w = 128, h = 128) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
  return t;
};
const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return `#${c.getHexString()}`; };

// Suit patterns drawn on the torso and shorts.
const SUITS = {
  suit_solid: (c, w, h, col) => { c.fillStyle = col; c.fillRect(0, 0, w, h); c.fillStyle = '#FBF8F2'; c.fillRect(0, 0, 10, h); c.fillRect(w - 10, 0, 10, h); c.fillStyle = '#D9785B'; c.fillRect(10, 0, 4, h); c.fillRect(w - 14, 0, 4, h); },
  suit_stripes: (c, w, h, col) => { c.fillStyle = col; c.fillRect(0, 0, w, h); for (let y = 8; y < h; y += 28) { c.fillStyle = '#FBF8F2'; c.fillRect(0, y, w, 8); c.fillStyle = '#D9785B'; c.fillRect(0, y + 10, w, 5); } },
  suit_twotone: (c, w, h, col) => { c.fillStyle = col; c.fillRect(0, 0, w, h); c.fillStyle = '#13293D'; c.beginPath(); c.moveTo(0, h * 0.45); c.lineTo(w, h * 0.7); c.lineTo(w, h); c.lineTo(0, h); c.fill(); },
  suit_wave: (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#3e8ea0'); g.addColorStop(1, '#13293D'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.strokeStyle = '#FBF8F2'; c.lineWidth = 5; for (let y = 20; y < h; y += 30) { c.beginPath(); for (let x = 0; x <= w; x += 4) c.lineTo(x, y + Math.sin(x / 10) * 6); c.stroke(); } },
  suit_floral: (c, w, h, col) => {
    c.fillStyle = col; c.fillRect(0, 0, w, h);
    const flower = (x, y, r, p) => { c.fillStyle = p; for (let i = 0; i < 5; i++) { const a = i * 1.2566; c.beginPath(); c.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.8, 0, 7); c.fill(); } c.fillStyle = '#e8c35a'; c.beginPath(); c.arc(x, y, r * 0.5, 0, 7); c.fill(); };
    [[24, 22, 9], [90, 30, 11], [52, 70, 10], [110, 90, 8], [20, 104, 10], [74, 118, 7]].forEach(([x, y, r], i) => flower(x, y, r, i % 2 ? '#FBF8F2' : '#D9785B'));
    c.fillStyle = '#2f5d2a'; [[40, 40], [100, 60], [30, 80]].forEach(([x, y]) => { c.beginPath(); c.ellipse(x, y, 10, 4, 0.6, 0, 7); c.fill(); });
  },
  suit_lava: (c, w, h) => { c.fillStyle = '#16110f'; c.fillRect(0, 0, w, h); c.strokeStyle = '#ff6a1f'; c.lineWidth = 3; let x = 20, y = 0; c.beginPath(); c.moveTo(x, y); for (let i = 0; i < 16; i++) { x += (Math.sin(i * 7.3) * 20); y += 9; c.lineTo(x, y); } c.stroke(); c.beginPath(); c.moveTo(90, 0); for (let i = 0; i < 16; i++) c.lineTo(90 + Math.sin(i * 3.1) * 18, i * 9); c.stroke(); c.fillStyle = 'rgba(255,160,40,.5)'; for (let i = 0; i < 20; i++) c.fillRect((i * 37) % w, (i * 53) % h, 3, 3); },
  suit_sunrise: (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#e8c35a'); g.addColorStop(0.55, '#D9785B'); g.addColorStop(1, '#6b4ea0'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = '#fff3c4'; c.beginPath(); c.arc(w / 2, h * 0.62, 26, Math.PI, 0); c.fill(); c.fillStyle = '#13293D'; c.fillRect(0, h * 0.62, w, 5); },
  suit_underpants: (c, w, h) => { c.fillStyle = '#e63946'; c.fillRect(0, 0, w, h); c.fillStyle = '#FBF8F2'; for (let y = 10; y < h; y += 24) for (let x = (y / 24) % 2 ? 14 : 2; x < w; x += 24) { c.beginPath(); c.arc(x + 4, y, 4, Math.PI, 0); c.arc(x + 12, y, 4, Math.PI, 0); c.lineTo(x + 8, y + 10); c.closePath(); c.fill(); } },
};
function faceTex(skin, eyes) {
  return tex((c, w, h) => {
    c.fillStyle = skin; c.fillRect(0, 0, w, h);
    c.fillStyle = '#13293D'; c.fillRect(34, 46, 14, 20); c.fillRect(80, 46, 14, 20);
    c.fillStyle = '#fff'; c.fillRect(38, 48, 5, 6); c.fillRect(84, 48, 5, 6);
    c.fillStyle = shade(skin, 0.8); c.fillRect(28, 82, 10, 6); c.fillRect(90, 82, 10, 6);          // cheeks
    c.strokeStyle = '#13293D'; c.lineWidth = 7; c.lineCap = 'round';
    c.beginPath(); c.arc(64, 78, 20, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();
    if (eyes === 'eyes_none') { c.fillStyle = '#13293D'; c.fillRect(32, 36, 18, 5); c.fillRect(78, 36, 18, 5); }
  });
}
const bibTex = n => tex((c, w, h) => { c.fillStyle = '#FBF8F2'; c.fillRect(0, 0, w, h); c.fillStyle = '#D9785B'; c.fillRect(0, 0, w, 18); c.fillStyle = '#13293D'; c.font = '900 56px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n), w / 2, 70); }, 128, 104);
const pineTex = () => tex((c, w, h) => { c.fillStyle = '#e8b93c'; c.fillRect(0, 0, w, h); c.strokeStyle = '#a8761c'; c.lineWidth = 4; for (let i = -h; i < w; i += 20) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke(); c.beginPath(); c.moveTo(i + h, 0); c.lineTo(i, h); c.stroke(); } });

export const FRAME = { bike_coral: 0xd9785b, bike_teal: 0x2e6f73, bike_ink: 0x13293d, bike_gold: 0xd4a53c, bike_lava: 0x1a1412 };

export function makeAthlete({ skin = '#b07a52', suit = '#1d3557', bib = 1, look = {} } = {}) {
  const L = { ...DEFAULT_LOOK, ...look };
  const g = new THREE.Group();
  const mSkin = lam(skin), mDark = lam(0x13293d), mWhite = lam(0xfbf8f2), mCoral = lam(0xd9785b);
  const suitTex = tex((c, w, h) => (SUITS[L.suit] || SUITS.suit_solid)(c, w, h, suit));
  const mSuit = new THREE.MeshLambertMaterial({ map: suitTex, emissive: L.suit === 'suit_lava' ? 0x331000 : 0x000000 });
  const underpants = L.suit === 'suit_underpants';
  const box = (m, sx, sy, sz, x, y, z, parent = g) => { const b = new THREE.Mesh(BOX, m); b.scale.set(sx, sy, sz); b.position.set(x, y, z); b.castShadow = true; parent.add(b); return b; };
  const joint = (x, y, z, parent = g) => { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; };

  const hips = joint(0, 0.86, 0);
  const legL = joint(-0.17, 0, 0, hips), legR = joint(0.17, 0, 0, hips);
  const socks = { socks_white: [mWhite, 0.14], socks_coral: [mCoral, 0.42], socks_teal: [lam(0x2e6f73), 0.42] }[L.socks] || [mWhite, 0.14];
  for (const l of [legL, legR]) {
    box(underpants ? mSuit : mSuit, 0.32, 0.26, 0.34, 0, -0.08, 0, l);                   // shorts
    box(mSkin, 0.3, 0.6 - socks[1], 0.32, 0, -0.21 - (0.6 - socks[1]) / 2, 0, l);          // thigh and shin
    box(socks[0], 0.3, socks[1], 0.31, 0, -0.81 + socks[1] / 2, 0, l);                    // socks
    box(lam(0xfbf8f2), 0.32, 0.14, 0.46, 0, -0.84, 0.06, l);                              // shoes
    box(mCoral, 0.33, 0.04, 0.47, 0, -0.9, 0.06, l);                                      // soles
  }
  const chest = joint(0, 0, 0, hips);
  box(underpants ? mSkin : mSuit, 0.72, 0.8, 0.4, 0, 0.4, 0, chest);
  if (underpants) { box(mSuit, 0.74, 0.22, 0.42, 0, 0.05, 0, chest); }
  // Race belt with bib.
  box(mDark, 0.76, 0.06, 0.44, 0, 0.1, 0, chest);
  const bibM = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.34), new THREE.MeshLambertMaterial({ map: bibTex(bib) }));
  bibM.position.set(0, 0.2, 0.222); chest.add(bibM);
  const armL = joint(-0.47, 0.72, 0, chest), armR = joint(0.47, 0.72, 0, chest);
  for (const a of [armL, armR]) { box(underpants ? mSkin : mSuit, 0.24, 0.3, 0.3, 0, -0.1, 0, a); box(mSkin, 0.22, 0.52, 0.26, 0, -0.48, 0, a); }
  const neck = joint(0, 0.82, 0, chest);
  const faceM = new THREE.MeshLambertMaterial({ map: faceTex(skin, L.eyes) });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.56, 0.56), [mSkin, mSkin, mSkin, mSkin, faceM, mSkin]);
  head.position.y = 0.3; head.castShadow = true; neck.add(head);
  box(lam(0x3a2a1f), 0.58, 0.16, 0.58, 0, 0.54, -0.02, neck);                            // hair

  // Headwear.
  const H = L.helmet;
  if (H === 'helmet_aero') {
    box(mWhite, 0.64, 0.3, 0.66, 0, 0.62, 0, neck);
    const tail = box(mWhite, 0.34, 0.14, 0.5, 0, 0.6, -0.5, neck); tail.rotation.x = -0.3;
    box(mCoral, 0.66, 0.06, 0.68, 0, 0.66, 0, neck);
    box(new THREE.MeshLambertMaterial({ color: 0x1b3a52, transparent: true, opacity: 0.85 }), 0.62, 0.2, 0.05, 0, 0.36, 0.31, neck);   // visor
  } else if (H === 'helmet_road') {
    box(mDark, 0.66, 0.26, 0.7, 0, 0.64, 0, neck);
    for (let i = -1; i <= 1; i++) box(mCoral, 0.08, 0.03, 0.6, i * 0.18, 0.78, 0, neck);
  } else if (H === 'helmet_visor') {
    box(mWhite, 0.6, 0.1, 0.6, 0, 0.5, 0, neck); box(mWhite, 0.6, 0.04, 0.3, 0, 0.48, 0.4, neck);
  } else if (H === 'helmet_cap') {
    box(mCoral, 0.62, 0.18, 0.62, 0, 0.62, 0, neck); box(mCoral, 0.6, 0.04, 0.32, 0, 0.56, 0.42, neck); box(mWhite, 0.2, 0.08, 0.02, 0, 0.64, 0.32, neck);
  } else if (H === 'helmet_swim') {
    box(mCoral, 0.62, 0.28, 0.62, 0, 0.58, 0, neck);
    box(mDark, 0.6, 0.05, 0.6, 0, 0.36, 0, neck);
    for (const x of [-0.13, 0.13]) box(new THREE.MeshLambertMaterial({ color: 0x9fe3f0, emissive: 0x1b4f5a }), 0.18, 0.12, 0.04, x, 0.36, 0.3, neck);
  } else if (H === 'helmet_crown') {
    const cols = [0xd9785b, 0xe8c35a, 0xfbf8f2, 0xc0392b];
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; box(lam(cols[i % 4]), 0.14, 0.14, 0.14, Math.cos(a) * 0.32, 0.6, Math.sin(a) * 0.32, neck).rotation.y = a; }
  } else if (H === 'helmet_pineapple') {
    box(new THREE.MeshLambertMaterial({ map: pineTex() }), 0.5, 0.56, 0.5, 0, 0.84, 0, neck);
    for (let i = 0; i < 6; i++) { const lf = box(lam(0x3f7a3a), 0.08, 0.5, 0.2, 0, 1.28, 0, neck); lf.rotation.set(Math.sin(i) * 0.5, i, Math.cos(i * 2) * 0.5); }
  }
  // Eyewear.
  if (L.eyes === 'eyes_shield' && H !== 'helmet_aero' && H !== 'helmet_swim') box(new THREE.MeshLambertMaterial({ color: 0x0f2130, emissive: 0x0a2a3a }), 0.6, 0.1, 0.04, 0, 0.37, 0.3, neck);
  else if (L.eyes === 'eyes_round' && H !== 'helmet_swim') for (const x of [-0.13, 0.13]) box(mDark, 0.17, 0.14, 0.03, x, 0.37, 0.3, neck);
  else if (L.eyes === 'eyes_star' && H !== 'helmet_swim') for (const x of [-0.14, 0.14]) { const s = box(lam(0xe8c35a), 0.2, 0.2, 0.03, x, 0.38, 0.3, neck); s.rotation.z = Math.PI / 4; }
  // Extras.
  const E = L.extra;
  if (E === 'extra_lei') { const cols = [0xd9785b, 0xe8c35a, 0xfbf8f2, 0xc0392b, 0x6b4ea0]; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; box(lam(cols[i % 5]), 0.13, 0.13, 0.13, Math.cos(a) * 0.36, 0.78 - Math.max(0, Math.sin(a)) * 0.25, Math.sin(a) * 0.24, chest); } }
  else if (E === 'extra_medal') { box(mCoral, 0.06, 0.4, 0.02, -0.1, 0.62, 0.21, chest).rotation.z = -0.3; box(mCoral, 0.06, 0.4, 0.02, 0.1, 0.62, 0.21, chest).rotation.z = 0.3; const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 16), new THREE.MeshStandardMaterial({ color: 0xd4a53c, metalness: 0.9, roughness: 0.25 })); m.rotation.x = Math.PI / 2; m.position.set(0, 0.4, 0.24); chest.add(m); }
  else if (E === 'extra_surf') { const b = box(lam(0xe8c35a), 0.5, 1.9, 0.08, 0, 0.5, -0.28, chest); b.rotation.z = 0.25; box(mCoral, 0.08, 1.9, 0.09, 0.05, 0.5, -0.29, chest).rotation.z = 0.25; }
  else if (E === 'extra_coffee') { box(mWhite, 0.14, 0.2, 0.14, 0, -0.78, 0.1, armR); box(lam(0x6b3e20), 0.15, 0.06, 0.15, 0, -0.66, 0.1, armR); }

  g.userData = { hips, chest, legL, legR, armL, armR, neck, look: L };
  return g;
}

// The TT bike, blocky to match: disc rear wheel, deep front, aero bars, frame in the chosen colour.
export function makeBike(look = {}) {
  const L = { ...DEFAULT_LOOK, ...look };
  const outer = new THREE.Group(), g = new THREE.Group();
  g.scale.setScalar(1.3);                                  // sized for the chunky athlete
  outer.add(g);
  const frame = new THREE.MeshStandardMaterial({ color: FRAME[L.bike] ?? 0xd9785b, metalness: L.bike === 'bike_gold' ? 0.8 : 0.3, roughness: 0.35, emissive: L.bike === 'bike_lava' ? 0x401000 : 0 });
  const black = lam(0x16181c);
  const wheel = (z, disc) => {
    const w = new THREE.Group(); w.position.set(0, 0.36, z);
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 28), black); tyre.rotation.y = Math.PI / 2; w.add(tyre);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, disc ? 0.05 : 0.02, 24), disc ? frame : lam(0x2b2f36)); rim.rotation.z = Math.PI / 2; w.add(rim);
    g.add(w); return w;
  };
  const front = wheel(0.56, false), rear = wheel(-0.52, true);
  const bar = (x1, y1, z1, x2, y2, z2, t = 0.06) => { const a = new THREE.Vector3(x1, y1, z1), b = new THREE.Vector3(x2, y2, z2); const m = new THREE.Mesh(BOX, frame); m.position.copy(a).add(b).multiplyScalar(0.5); m.scale.set(t, a.distanceTo(b), t * 1.6); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize()); g.add(m); return m; };
  bar(0, 0.36, -0.52, 0, 0.9, -0.1); bar(0, 0.9, -0.1, 0, 0.95, 0.46); bar(0, 0.95, 0.46, 0, 0.36, 0.56); bar(0, 0.36, -0.52, 0, 0.42, 0.02); bar(0, 0.42, 0.02, 0, 0.9, -0.1);
  const saddle = new THREE.Mesh(BOX, black); saddle.scale.set(0.14, 0.05, 0.3); saddle.position.set(0, 0.98, -0.12); g.add(saddle);
  for (const x of [-0.08, 0.08]) { const ab = new THREE.Mesh(BOX, black); ab.scale.set(0.04, 0.04, 0.42); ab.position.set(x, 1.02, 0.62); g.add(ab); }
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 10), lam(0x3e8ea0)); bottle.rotation.x = Math.PI / 2; bottle.position.set(0, 1.0, 0.78); g.add(bottle);
  outer.userData = { front, rear, saddleY: 1.3 };
  outer.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return outer;
}

// Poses. t: time, speed: m/s, s: locomotion state (for airborne), em: current emote and its age.
export function pose(athlete, { mode, t, walk, speed, airborne, emote, emoteT, pedal }) {
  const u = athlete.userData;
  u.hips.rotation.set(0, 0, 0); u.chest.rotation.set(0, 0, 0); u.neck.rotation.set(0, 0, 0);
  u.armL.rotation.set(0, 0, 0); u.armR.rotation.set(0, 0, 0); u.legL.rotation.set(0, 0, 0); u.legR.rotation.set(0, 0, 0);
  athlete.rotation.x = 0; athlete.position.y = 0; u.hips.position.y = 0.86;
  if (mode === 'bike') {
    // Aero tuck: sitting on the saddle, flat back, forearms on the bars, legs turning the cranks.
    athlete.position.set(0, 0.5, -0.22);
    u.chest.rotation.x = 1.15; u.neck.rotation.x = -0.95;
    u.armL.rotation.x = u.armR.rotation.x = -2.1;
    const a = pedal;
    u.legL.rotation.x = -1.2 + Math.sin(a) * 0.45; u.legR.rotation.x = -1.2 + Math.sin(a + Math.PI) * 0.45;
    return;
  }
  athlete.position.set(0, 0, 0);
  if (mode === 'swim') {
    athlete.rotation.x = Math.PI / 2 * 0.92; athlete.position.y = 0.1;
    const a = t * 5;
    u.armL.rotation.x = a % (Math.PI * 2); u.armR.rotation.x = (a + Math.PI) % (Math.PI * 2);
    u.legL.rotation.x = Math.sin(a * 2) * 0.35; u.legR.rotation.x = -Math.sin(a * 2) * 0.35;
    return;
  }
  const run = Math.min(1, speed / 6);
  const sw = Math.sin(walk) * (0.25 + run * 0.75) * (speed > 0.3 ? 1 : 0);
  u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
  u.armL.rotation.x = airborne ? -2.6 : -sw * 0.9; u.armR.rotation.x = airborne ? -2.6 : sw * 0.9;
  u.chest.rotation.x = run * 0.15;
  u.hips.position.y = 0.86 + (speed > 0.3 ? Math.abs(Math.cos(walk)) * 0.06 * (0.5 + run) : Math.sin(t * 2) * 0.01);
  if (!emote) return;
  const e = emoteT;
  if (emote === '👋') { u.armR.rotation.x = -2.9; u.armR.rotation.z = 0.35 + Math.sin(e * 14) * 0.35; }
  else if (emote === '🤙') { u.armR.rotation.x = -1.6; u.armR.rotation.z = Math.sin(e * 10) * 0.25; }
  else if (emote === '💃') { u.hips.rotation.y = Math.sin(e * 8) * 0.5; u.armL.rotation.z = -1.2 + Math.sin(e * 8) * 0.5; u.armR.rotation.z = 1.2 + Math.sin(e * 8) * 0.5; u.hips.position.y = 0.86 + Math.abs(Math.sin(e * 8)) * 0.12; }
  else if (emote === '🏆') { u.armL.rotation.x = u.armR.rotation.x = -2.9; u.hips.position.y = 0.86 + Math.abs(Math.sin(e * 7)) * 0.25; }
  else if (emote === '✈️') { u.armL.rotation.z = -1.5; u.armR.rotation.z = 1.5; u.hips.rotation.z = Math.sin(e * 3) * 0.3; u.chest.rotation.x = 0.3; u.legL.rotation.x = Math.sin(e * 12) * 0.6; u.legR.rotation.x = -Math.sin(e * 12) * 0.6; }
  else if (emote === '💪') { u.armL.rotation.z = -1.5; u.armR.rotation.z = 1.5; u.armL.rotation.x = u.armR.rotation.x = -0.2; const k = Math.abs(Math.sin(e * 4)); u.armL.rotation.y = -k; u.armR.rotation.y = k; u.chest.rotation.x = -0.1; }
  else if (emote === '😵') { u.legL.rotation.x = -1.4; u.hips.position.y = 0.86 + Math.abs(Math.sin(e * 9)) * 0.22; u.armL.rotation.x = -1.2; u.armR.rotation.z = 0.8 + Math.sin(e * 9) * 0.3; u.chest.rotation.x = 0.35; }
}
export const EMOTES = ['👋', '🤙', '✈️', '💪', '😵', '💃', '🏆'];
export const EMOTE_NAMES = { '👋': 'Wave', '🤙': 'Shaka', '✈️': 'Flying finish', '💪': 'Flex', '😵': 'Cramp!', '💃': 'Dance', '🏆': 'Champion' };
