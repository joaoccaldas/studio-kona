// Ring 1 tile streamer: 500 m packs (terrain + buildings + trees + 0.56 m imagery), loaded by distance.
import * as THREE from 'three';

export class TileStreamer {
  constructor({ scene, W, base, radius, palm, onGround }) {
    this.scene = scene; this.W = W; this.base = base; this.radius = radius; this.palm = palm; this.onGround = onGround;
    this.live = new Map(); this.busy = 0; this.t = 0; this.tex = new THREE.TextureLoader();
  }
  async init() {
    this.index = await (await fetch(this.base + 'index.json')).json();
    this.size = this.index.size; this.core = this.index.core;
  }
  liveCount() { let n = 0; for (const v of this.live.values()) if (v && v !== 'loading') n++; return n; }
  update(dt, cam) {
    if (!this.index) return;
    this.t += dt; if (this.t < .35) return; this.t = 0;
    const alt = cam.position.y;
    if (alt > 1600) { for (const k of [...this.live.keys()]) this.drop(k); return; }
    const cx = cam.position.x, cy = -cam.position.z;
    const R = Math.min(this.radius + Math.max(0, alt) * .25, this.radius + 400);
    const maxLive = (matchMedia('(pointer: coarse)').matches || innerWidth < 760) ? 6 : 10;
    const want = [];
    for (const t of this.index.tiles) {
      const here = t.x0 <= cx && cx < t.x0 + this.size && t.y0 <= cy && cy < t.y0 + this.size;
      const d = here ? -1 : Math.hypot(t.x0 + this.size / 2 - cx, t.y0 + this.size / 2 - cy);
      if (d < R) want.push([d, t]);
    }
    want.sort((a, b) => a[0] - b[0]);
    const keep = new Set(want.slice(0, maxLive).map(([, t]) => t.k));
    for (const k of this.live.keys()) if (!keep.has(k)) this.drop(k);
    for (const [, t] of want.slice(0, maxLive)) if (!this.live.has(t.k) && this.busy < 2) this.load(t);
  }
  drop(k) {
    const g = this.live.get(k); if (!g || g === 'loading') return;
    this.onGround?.(g, false); this.scene.remove(g);
    const sharedG = this.palm?.geometry, sharedM = this.palm?.material;
    g.traverse(o => {
      if (o.geometry && o.geometry !== sharedG) o.geometry.dispose();
      if (o.material && o.material !== sharedM) { o.material.map?.dispose(); o.material.dispose(); }
    });
    this.live.delete(k);
  }
  async load(t) {
    this.live.set(t.k, 'loading'); this.busy++;
    try {
      const p = await (await fetch(this.base + `t_${t.k}.json`)).json();
      const img = this.tex.loadAsync(this.base + `img_${t.k}.jpg`);
      const grp = new THREE.Group(); grp.name = 'tile_' + t.k;
      grp.add(this.terrain(p, await img));
      if (p.b.length) grp.add(this.buildings(p));
      if (p.t.length && this.palm) grp.add(this.trees(p));
      this.scene.add(grp); this.live.set(t.k, grp); this.onGround?.(grp, true);
    } catch (e) { console.warn('tile', t.k, e); this.live.delete(t.k); }
    this.busy--;
  }
  terrain(p, tex) {
    const N = p.grid, bin = atob(p.h), dv = new DataView(new ArrayBuffer(bin.length));
    for (let i = 0; i < bin.length; i++) dv.setUint8(i, bin.charCodeAt(i));
    const pos = new Float32Array(N * N * 3), uv = new Float32Array(N * N * 2), idx = [];
    const core = this.core, inside = (i, j) => {
      if (!core) return false;
      const x = p.x0 + i / (N - 1) * p.size, y = p.y0 + j / (N - 1) * p.size;
      return x > core[0] + 6 && x < core[2] - 6 && y > core[1] + 6 && y < core[3] - 6;
    };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i, h = dv.getInt16(k * 2, true) / 10;
      const w = this.W(p.x0 + i / (N - 1) * p.size, p.y0 + j / (N - 1) * p.size, h);
      pos.set([w.x, w.y, w.z], k * 3); uv.set([i / (N - 1), j / (N - 1)], k * 2);
      if (i < N - 1 && j < N - 1 && !(inside(i, j) && inside(i + 1, j) && inside(i, j + 1) && inside(i + 1, j + 1)))
        idx.push(k, k + N, k + 1, k + 1, k + N, k + N + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    g.computeVertexNormals();
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: .92 });
    m.onBeforeCompile = sh => {       // below sea level the imagery shows water: turn it into sand / basalt / algae seabed
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vH;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvH = position.y;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vH;').replace('#include <map_fragment>', `#include <map_fragment>
        if (vH < -.2) { float l = dot(diffuseColor.rgb, vec3(.3,.59,.11));
          vec3 c = l < .12 ? vec3(.10,.10,.085) : (l < .2 ? vec3(.28,.30,.22) : vec3(.78,.72,.56));
          diffuseColor.rgb = mix(diffuseColor.rgb, c, smoothstep(-.2, -2., vH)); }`);
    };
    const mesh = new THREE.Mesh(g, m); mesh.name = 'ground'; mesh.userData.ground = true; return mesh;
  }
  buildings(p) {
    const pos = [], col = [], wallC = [[.80, .78, .72], [.68, .60, .50], [.62, .64, .60], [.86, .84, .80]];
    const push = (w, c) => { pos.push(w.x, w.y, w.z); col.push(...c); };
    for (const b of p.b) {
      const pts = b.p.map(([x, y]) => [p.x0 + x, p.y0 + y]);
      let area = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], c = pts[(i + 1) % pts.length]; area += a[0] * c[1] - c[0] * a[1]; }
      if (area < 0) pts.reverse();
      const base = .3, top = base + b.h, wc = wallC[Math.abs(Math.round(pts[0][0] * 7)) % 4];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], c = pts[(i + 1) % pts.length];
        const A = this.W(a[0], a[1], base), B = this.W(c[0], c[1], base), C = this.W(c[0], c[1], top), D = this.W(a[0], a[1], top);
        const shade = .85 + .15 * Math.abs(Math.sin(Math.atan2(c[1] - a[1], c[0] - a[0])));
        const k = wc.map(v => v * shade);
        push(A, k); push(B, k); push(C, k); push(A, k); push(C, k); push(D, k);
      }
      const tri = THREE.ShapeUtils.triangulateShape(pts.map(([x, y]) => new THREE.Vector2(x, y)), []);
      for (const [a, b2, c] of tri) for (const q of [a, b2, c]) push(this.W(pts[q][0], pts[q][1], top), b.c.map(v => Math.pow(v, 2.2)));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, side: THREE.DoubleSide }));
    mesh.name = 'buildings'; mesh.userData.solid = true; return mesh;
  }
  trees(p) {
    const im = new THREE.InstancedMesh(this.palm.geometry, this.palm.material, p.t.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    p.t.forEach(([x, y], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), x * 7.1); const k = .85 + (Math.abs(y * 13.7) % 1) * .3; m4.compose(this.W(p.x0 + x, p.y0 + y, .4), q, new THREE.Vector3(k, k, k)); im.setMatrixAt(i, m4); });
    return im;
  }
}
