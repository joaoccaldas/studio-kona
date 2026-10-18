// Detail around the player everywhere outside Kailua town. The whole-island backdrop is a 200 m mesh with a
// 78 m/pixel photo, fine from the air but flat and blurry on foot. Around the athlete this streams 256 m terrain
// chunks with rugged relief and a shader that adds lava, grass and cinder texture on top of the island colours,
// and scatters trees, lava rocks, fountain grass and coconut palms by what the satellite colour and height say.
// The backdrop is lowered inside the detail ring so the two never fight.
import * as THREE from 'three';

const CH = 256, SEG = 48;

function hash(x, y) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function rng(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; }

export function createIslandDetail({ scene, W, heightAt, isl, base, farIsland, isDetailArea, addGround, removeGround, coarse }) {
  const RING = coarse ? 1 : 2;
  const chunks = new Map();
  let queue = [];

  // Colour lookup from the island photo (for scatter decisions on the CPU).
  let px = null, N = 0;
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement('canvas'); cv.width = cv.height = N = img.width;
    const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(img, 0, 0);
    px = c.getImageData(0, 0, N, N).data;
    for (const ch of chunks.values()) if (!ch.scattered) scatter(ch);
  };
  img.src = base + 'island_color.jpg';
  const colorAt = (x, y) => {
    if (!px) return null;
    const i = Math.max(0, Math.min(N - 1, Math.floor((x - isl.x0) / isl.size * N))), j = Math.max(0, Math.min(N - 1, Math.floor((1 - (y - isl.y0) / isl.size) * N)));
    const k = (j * N + i) * 4;
    return [px[k], px[k + 1], px[k + 2]];
  };

  // Relief: the DEM plus two octaves of noise on land (none at the shoreline so beaches stay flat).
  const surf = (x, y) => {
    const h = heightAt(x, y);
    if (h < 0.5) return h;
    const k = Math.min(1, (h - 0.5) / 6);
    return h + k * ((vnoise(x / 38, y / 38) - 0.5) * 2.2 + (vnoise(x / 11, y / 11) - 0.5) * 0.7);
  };

  // Ground shader: island colour + procedural detail by world position.
  const colTex = new THREE.TextureLoader().load(base + 'island_color.jpg');
  colTex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uCol = { value: colTex };
    sh.uniforms.uBox = { value: new THREE.Vector3(isl.x0, isl.y0, isl.size) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vW; uniform sampler2D uCol; uniform vec3 uBox;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `
        vec2 sv = vec2(vW.x, -vW.z);
        vec3 base = texture2D(uCol, (sv - uBox.xy) / uBox.z).rgb;
        float lum = dot(base, vec3(.3,.59,.11));
        float green = clamp((base.g - max(base.r, base.b)) * 6.0, 0.0, 1.0);
        float n1 = vn(sv * 0.45), n2 = vn(sv * 2.1), n3 = vn(sv * 0.08);
        // Lava: dark with glossy ropey streaks; grass: speckled greens; everything: large soft variation.
        vec3 lava = base * (0.75 + 0.5 * n2) * (0.85 + 0.3 * n3);
        lava += vec3(0.05) * smoothstep(0.62, 0.7, vn(sv * vec2(0.9, 3.0))) * (1.0 - green);
        vec3 grass = mix(base * 0.8, base * 1.25 + vec3(0.02, 0.04, 0.0), n1 * n2);
        diffuseColor.rgb *= mix(lava, grass, green) * (1.15 + 0.25 * n3);
      `);
  };

  // The backdrop sinks inside the detail ring.
  const sinkU = { center: { value: new THREE.Vector2() }, rad: { value: RING * CH * 0.95 } };
  if (farIsland) {
    const m = farIsland.material, prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey?.bind(m);
    m.onBeforeCompile = (sh, r) => {
      prev?.(sh, r);
      sh.uniforms.uSinkC = sinkU.center; sh.uniforms.uSinkR = sinkU.rad;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform vec2 uSinkC; uniform float uSinkR;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec2 wxz = (modelMatrix * vec4(transformed, 1.0)).xz;
          transformed.y -= 30.0 * (1.0 - smoothstep(uSinkR * 0.85, uSinkR, distance(wxz, uSinkC)));`);
    };
    m.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '-sink';
    m.needsUpdate = true;
  }

  // Scatter prototypes.
  const P = {
    tree: (() => { const g = new THREE.IcosahedronGeometry(1, 0); g.scale(2.6, 1.8, 2.6); g.translate(0, 3.4, 0); const t = new THREE.CylinderGeometry(0.15, 0.25, 2.8, 5); t.translate(0, 1.4, 0); return { canopy: g, trunk: t }; })(),
    rock: (() => { const g = new THREE.DodecahedronGeometry(1, 0); g.scale(1, 0.55, 0.8); return g; })(),
    grass: (() => { const g = new THREE.ConeGeometry(0.7, 0.8, 6, 1, true); g.translate(0, 0.3, 0); return g; })(),
    palmTrunk: (() => { const g = new THREE.CylinderGeometry(0.16, 0.26, 8, 6); g.translate(0, 4, 0); return g; })(),
    palmTop: (() => { const parts = []; for (let i = 0; i < 6; i++) { const f = new THREE.ConeGeometry(0.45, 3.4, 4, 1); f.translate(0, 1.7, 0); f.rotateX(1.95); f.rotateY(i * 1.05); f.scale(1, 1, 1); f.translate(0, 8, 0); parts.push(f); } return mergeGeos(parts); })(),
  };
  const MAT = {
    canopy: new THREE.MeshLambertMaterial({ color: 0x4f6f33, flatShading: true }),
    trunk: new THREE.MeshLambertMaterial({ color: 0x5a4632 }),
    rock: new THREE.MeshLambertMaterial({ color: 0x2a2624, flatShading: true }),
    grass: new THREE.MeshLambertMaterial({ color: 0x9c8f52, side: THREE.DoubleSide }),
    palm: new THREE.MeshLambertMaterial({ color: 0x3f7a3a, flatShading: true }),
  };

  function build(cx, cy) {
    const x0 = cx * CH, y0 = cy * CH;
    const g = new THREE.PlaneGeometry(CH, CH, SEG, SEG);
    const pos = g.attributes.position;
    let anyLand = false;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i), ly = pos.getY(i), x = x0 + CH / 2 + lx, y = y0 + CH / 2 + ly;
      let h = surf(x, y);
      if (h > -2) anyLand = true;
      if (isDetailArea(x, y)) h -= 25;                        // town tiles own this ground
      const w = W(x, y, h);
      pos.setXYZ(i, w.x, w.y, w.z);
    }
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = true;
    mesh.visible = anyLand;
    scene.add(mesh);
    if (anyLand) addGround(mesh);
    const ch = { key: `${cx},${cy}`, cx, cy, mesh, objs: [], scattered: false, anyLand };
    if (anyLand) scatter(ch);
    return ch;
  }

  function scatter(ch) {
    if (!px || !ch.anyLand) return;
    ch.scattered = true;
    const r = rng((ch.cx * 73856093) ^ (ch.cy * 19349663));
    const x0 = ch.cx * CH, y0 = ch.cy * CH;
    const buckets = { tree: [], rock: [], grass: [], palm: [] };
    for (let i = 0; i < 520; i++) {
      const x = x0 + r() * CH, y = y0 + r() * CH;
      if (isDetailArea(x, y)) continue;
      const h = heightAt(x, y);
      if (h < 0.6) continue;
      const c = colorAt(x, y);
      if (!c) continue;
      const [R, G, B] = c, lum = 0.3 * R + 0.59 * G + 0.11 * B, green = G - Math.max(R, B);
      const pick = r();
      let kind = null;
      if (h < 9 && green > -6 && pick < 0.12) kind = 'palm';
      else if (green > 4 && h < 1900 && pick < 0.45) kind = pick < 0.22 ? 'tree' : 'grass';
      else if (lum < 70 && pick < 0.14) kind = 'rock';
      else if (lum >= 70 && green <= 4 && h < 1500 && pick < 0.3) kind = 'grass';
      else if (h > 2500 && pick < 0.05) kind = 'rock';
      if (kind) buckets[kind].push([x, y, surf(x, y), r() * 6.28, 0.6 + r() * 0.9]);
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s = new THREE.Vector3();
    const inst = (geo, material, items, scaleY = 1) => {
      if (!items.length) return;
      const im = new THREE.InstancedMesh(geo, material, items.length);
      items.forEach(([x, y, h, rot, k], i) => { q.setFromAxisAngle(up, rot); m4.compose(W(x, y, h - 0.1), q, s.set(k, k * scaleY, k)); im.setMatrixAt(i, m4); });
      im.instanceMatrix.needsUpdate = true;
      scene.add(im);
      ch.objs.push(im);
    };
    inst(P.tree.canopy, MAT.canopy, buckets.tree);
    inst(P.tree.trunk, MAT.trunk, buckets.tree);
    inst(P.rock, MAT.rock, buckets.rock);
    inst(P.grass, MAT.grass, buckets.grass, 1.2);
    inst(P.palmTrunk, MAT.trunk, buckets.palm);
    inst(P.palmTop, MAT.palm, buckets.palm);
  }

  function dispose(ch) {
    scene.remove(ch.mesh);
    removeGround(ch.mesh);
    ch.mesh.geometry.dispose();
    for (const o of ch.objs) { scene.remove(o); o.dispose?.(); }
  }

  function update(camera) {
    const px = camera.position.x, py = -camera.position.z;
    sinkU.center.value.set(camera.position.x, camera.position.z);
    const ccx = Math.floor(px / CH), ccy = Math.floor(py / CH);
    const want = new Set();
    for (let dy = -RING; dy <= RING; dy++) for (let dx = -RING; dx <= RING; dx++) want.add(`${ccx + dx},${ccy + dy}`);
    for (const [k, ch] of chunks) if (!want.has(k)) { dispose(ch); chunks.delete(k); }
    queue = [...want].filter(k => !chunks.has(k)).sort((a, b) => {
      const [ax, ay] = a.split(',').map(Number), [bx, by] = b.split(',').map(Number);
      return Math.hypot(ax - ccx, ay - ccy) - Math.hypot(bx - ccx, by - ccy);
    });
    // One chunk per frame keeps the frame time smooth; the nearest first.
    const k = queue.shift();
    if (k) { const [cx, cy] = k.split(',').map(Number); chunks.set(k, build(cx, cy)); }
  }
  return { update, get count() { return chunks.size; }, surf };
}

function mergeGeos(list) {
  const pos = [], nor = [], idx = [];
  let off = 0;
  for (const g of list) {
    const gi = g.index ? g : g.toNonIndexed();
    const p = gi.attributes.position.array, n = gi.attributes.normal.array;
    pos.push(...p); nor.push(...n);
    if (gi.index) idx.push(...[...gi.index.array].map(i => i + off)); else for (let i = 0; i < p.length / 3; i++) idx.push(i + off);
    off += p.length / 3;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setIndex(idx);
  return out;
}
