// Aloha rings: a ride-through arcade layer on the corridor from KOA into Kailua-Kona.
// Each ring gives a short speed burst; rings taken within a few seconds of each other build a combo; every fifth
// ring is a bigger coral one. Every ring pays a little once per Hawaiʻi day (they come back tomorrow).
import * as THREE from 'three';
import { hstDay } from './clock.js';

const SPACING = 140;          // metres between rings
const R = 2.6;                // ring radius (a road lane is ~3.6 m, so aiming matters but is forgiving)

export function createRideRings({ scene, W, pts, surfaceY, rewards, locomotion, sfx, pop, onCount }) {
  // Place rings along the corridor, facing the direction of travel, first one ~250 m after the start.
  const rings = [];
  let acc = 0, next = 250;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const seg = Math.hypot(bx - ax, by - ay);
    while (acc + seg >= next) {
      const t = (next - acc) / seg, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      rings.push({ x, y, z: surfaceY(x, y) + R + 0.3, yaw: Math.atan2(by - ay, bx - ax), big: rings.length % 5 === 4 });
      next += SPACING;
    }
    acc += seg;
  }
  rings.length = Math.max(0, rings.length - 2);                 // leave the last stretch into town clear

  const geo = new THREE.TorusGeometry(R, 0.16, 10, 40);
  const mats = {
    ring: new THREE.MeshStandardMaterial({ color: 0x3e8ea0, emissive: 0x2e6f73, emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.1 }),
    big: new THREE.MeshStandardMaterial({ color: 0xd9785b, emissive: 0xd9785b, emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.1 }),
  };
  const meshes = new THREE.InstancedMesh(geo, mats.ring, rings.length);
  const bigs = new THREE.InstancedMesh(geo, mats.big, rings.length);
  meshes.frustumCulled = bigs.frustumCulled = false;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), zero = new THREE.Vector3(0, 0, 0);
  const day = hstDay();
  const key = i => `ring:${day}:${i}`;
  function place(i, scale) {
    const r = rings[i], big = r.big;
    // Torus lies in XY; turn it so its opening faces along the road (heading yaw in survey space).
    q.setFromAxisAngle(UP, Math.PI / 2 + r.yaw);            // torus axis (+Z) onto the heading (cos yaw, 0, -sin yaw)
    const s = scale * (big ? 1.25 : 1);
    m4.compose(W(r.x, r.y, r.z), q, new THREE.Vector3(s, s, s));
    (big ? bigs : meshes).setMatrixAt(i, m4);
    (big ? meshes : bigs).setMatrixAt(i, m4.compose(zero, q, zero));
  }
  rings.forEach((r, i) => { r.taken = !!rewards?.claimed(key(i)); place(i, r.taken ? 0 : 1); });
  meshes.instanceMatrix.needsUpdate = bigs.instanceMatrix.needsUpdate = true;
  scene.add(meshes, bigs);

  let combo = 0, lastAt = -99, t = 0;
  const taken = () => rings.filter(r => r.taken).length;
  onCount?.(taken(), rings.length);

  function update(dt, camera) {
    t += dt;
    const pulse = 0.7 + 0.35 * Math.sin(t * 4);
    mats.ring.emissiveIntensity = pulse;
    mats.big.emissiveIntensity = pulse + 0.2;
    const st = locomotion.getState();
    if (!st.active || st.mode !== 'bike') return;
    const px = camera.position.x, py = -camera.position.z, pz = camera.position.y;
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      if (r.taken) continue;
      const dx = px - r.x, dy = py - r.y;
      if (dx * dx + dy * dy > 16) continue;                       // within 4 m of the ring's centre line
      if (Math.abs(pz - r.z) > R + 1) continue;
      r.taken = true;
      place(i, 0);
      meshes.instanceMatrix.needsUpdate = bigs.instanceMatrix.needsUpdate = true;
      combo = t - lastAt < 9 ? combo + 1 : 1;
      lastAt = t;
      locomotion.boost(r.big ? 4 : 2.5);
      sfx?.pack(combo);
      const g = rewards?.grantOnce(key(i), { xp: r.big ? 15 : 5, credits: (r.big ? 12 : 4) + Math.min(combo - 1, 5), reason: 'Aloha ring' });
      pop?.(g, `${r.big ? 'Big ring' : 'Ring'}${combo > 1 ? ` · combo ×${combo}` : ''} · boost`);
      onCount?.(taken(), rings.length);
      if (taken() === rings.length) pop?.(rewards?.grantOnce(`rings:all:${day}`, { xp: 150, credits: 60, reason: 'Every Aloha ring' }), 'Every ring today!');
    }
  }
  return { update, get count() { return { taken: taken(), total: rings.length }; }, get list() { return rings; } };
}
