// St. George, Utah — IRONMAN 70.3 Worlds (29 Oct 2022) place.
// Evidence: AWS terrarium DEM (M) + OSM massing (+ESRI imagery, ODbL) — a separate local frame
// anchored 37.0965,-113.5684, mounted at its great-circle offset from Kailua Pier.
import * as THREE from 'three';

export async function createStGeorge({ scene, W, stgOffset, coarse, base = 'assets/stgeorge/' }) {
  const S = { enabled: false, groups: [], buildingsLoaded: new Set(), idx: null };

  // Terrain (200x200 heightgrid, decimetres, b64 int16) + ESRI course imagery
  async function loadTerrain() {
    const t = await (await fetch(base + 'st_terrain.json')).json();
    const N = t.grid, bin = atob(t.h), dv = new DataView(new ArrayBuffer(bin.length));
    for (let i = 0; i < bin.length; i++) dv.setUint8(i, bin.charCodeAt(i));
    const pos = new Float32Array(N * N * 3), uv = new Float32Array(N * N * 2), idx = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i, h = dv.getInt16(k * 2, true) / 10;
      const x = t.x0 + i / (N - 1) * size(t), y = t.y0 + j / (N - 1) * size(t);
      const wx = x - stgOffset.x, wz = -(y - stgOffset.y); // world: subtract stg offset, y->-z (survey +Y north = -z)
      pos.set([wx, h, wz], k * 3);
      uv.set([i / (N - 1), 1 - j / (N - 1)], k * 2);       // flip v so j=0 (north) maps to top of image
      if (i < N - 1 && j < N - 1) idx.push(k, k + 1, k + N, k + 1, k + N + 1, k + N);
    }
    function size(t2) { return t2.size; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const tex = new THREE.TextureLoader().load(base + 'sat_course.jpg');
    tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; tex.anisotropy = coarse ? 2 : 4;
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    mesh.name = 'STG_terrain'; mesh.visible = false;
    scene.add(mesh); S.terrain = mesh; S.groups.push(mesh);
  }

  // Building massing: 2 km tiles streamed by camera proximity
  async function loadIndex() {
    S.idx = await (await fetch(base + 'st_buildings_index.json')).json();
  }

  const wallC = [[.80, .74, .66], [.85, .79, .70], [.78, .72, .62], [.88, .83, .76]]; // red-rock desert neutrals
  function buildingMesh(bl) {
    const pos = [], col = [];
    const push = (x, h, z, c) => { pos.push(x, h, z); col.push(...c); };
    for (const b of bl) {
      const pts = b.p.map(([x, y]) => [x - stgOffset.x, -(y - stgOffset.y)]); // world space
      let area = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], c = pts[(i + 1) % pts.length]; area += a[0] * c[1] - c[0] * a[1]; }
      if (area < 0) pts.reverse();
      const base = 0.0, top = base + b.h, wc = wallC[Math.abs(Math.round(pts[0][0])) % 4];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], c = pts[(i + 1) % pts.length];
        const shade = .8 + .2 * Math.abs(Math.sin(Math.atan2(c[1] - a[1], c[0] - a[0])));
        const k = wc.map(v => v * shade);
        push(a[0], base, a[1], k); push(c[0], base, c[1], k); push(c[0], top, c[1], k);
        push(a[0], base, a[1], k); push(c[0], top, c[1], k); push(a[0], top, a[1], k);
      }
      const tri = THREE.ShapeUtils.triangulateShape(pts.map(([x, y]) => new THREE.Vector2(x, -y)), []);
      const roof = wc.map(v => v * .92);
      for (const [a, b2, c] of tri) for (const q of [a, b2, c]) push(pts[q][0], top, pts[q][1], roof);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
  }

  async function streamTile(ti) {
    if (S.buildingsLoaded.has(ti.k)) return;
    S.buildingsLoaded.add(ti.k);
    try {
      const p = await (await fetch(base + `st_b_${ti.k}.json`)).json();
      const m = buildingMesh(p.b);
      m.name = 'STG_b_' + ti.k; m.visible = S.enabled;
      scene.add(m); S.groups.push(m);
    } catch (e) { /* tile missing is fine */ }
  }

  // update: enable when camera within ~60 km of the stg anchor; stream nearest 12 tiles
  let cool = 0;
  function update(dt, cam) {
    if (!S.enabled) return;
    cool += dt; if (cool < 0.5) return; cool = 0;
    if (!S.idx) return;
    const dx = cam.position.x, dz = cam.position.z;  // world coords (y up)
    const near = S.idx.tiles
      .map(t => ({ t, d: Math.hypot(t.x0 + 1000 - (dx + stgOffset.x), t.y0 + 1000 - (stgOffset.y - (-dz))) }))
      .sort((a, b) => a.d - b.d).slice(0, 12);
    for (const { t } of near) streamTile(t);
  }

  await loadTerrain().catch(e => console.warn('stg terrain', e));
  await loadIndex().catch(e => console.warn('stg idx', e));

  return {
    setEnabled(on) {
      S.enabled = on;
      for (const g of S.groups) g.visible = on;
    },
    update,
    state: S,
    offset: stgOffset,
  };
}
