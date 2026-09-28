// Persistent arrival: land at KOA, and the island unblurs only where you have been.
// Geography is the real island. The fog mask is the only generated layer.
import * as THREE from 'three';

import { readSection, writeSection, readFog, writeFog } from './save.js';
export const KOA = {
  lat: 19.7388,
  lon: -156.0456,
  name: 'Ellison Onizuka Kona International Airport',
  short: 'KOA',
};

// The player lives in the versioned save (save.js); the fog mask is stored apart because it is large.
export function loadPlayer() {
  return readSection('player');
}

export function savePlayer(p) {
  if (!p) return;
  const { mask, ...rest } = p;
  if (mask) writeFog(mask);
  writeSection('player', rest);
}

export function createExplorer(isl) {
  const N = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  let dirty = false;
  let saveAt = 0;

  const savedMask = readFog();
  if (savedMask) {
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, 0, 0, N, N); tex.needsUpdate = true; };
    img.src = savedMask;
  } else {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, N, N);
  }

  function stamp(x, y, radiusM) {
    const u = (x - isl.x0) / isl.size;
    const v = (y - isl.y0) / isl.size;
    if (u < -0.05 || u > 1.05 || v < -0.05 || v > 1.05) return;
    const cx = u * N;
    const cy = (1 - v) * N;
    const pr = Math.max(4, radiusM / isl.size * N);
    const g = ctx.createRadialGradient(cx, cy, pr * 0.35, cx, cy, pr);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, pr, 0, Math.PI * 2);
    ctx.fill();
    tex.needsUpdate = true;
    dirty = true;
  }

  function seen(x, y) {
    const u = (x - isl.x0) / isl.size;
    const v = (y - isl.y0) / isl.size;
    const px = Math.round(u * (N - 1));
    const py = Math.round((1 - v) * (N - 1));
    if (px < 0 || py < 0 || px >= N || py >= N) return false;
    return ctx.getImageData(px, py, 1, 1).data[0] > 40;
  }

  function apply(material) {
    material.customProgramCacheKey = () => 'explore-fog';
    material.onBeforeCompile = sh => {
      sh.uniforms.uExplore = { value: tex };
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D uExplore;')
        .replace('#include <map_fragment>', `
          vec4 texelColor = texture2D(map, vMapUv);
          float e = texture2D(uExplore, vMapUv).r;
          texelColor.rgb = mix(vec3(0.02, 0.035, 0.05), texelColor.rgb, smoothstep(0.12, 0.4, e));
          diffuseColor *= texelColor;
        `);
    };
    material.needsUpdate = true;
  }

  return {
    texture: tex,
    stamp,
    seen,
    apply,
    // Throttled: encoding the mask is expensive, so write at most every 4 s (or when forced, e.g. on pagehide).
    persist(extra, force = false) {
      const now = performance.now();
      if (!force && now < saveAt) return;
      if (!dirty && !extra) return;
      saveAt = now + 4000;
      dirty = false;
      writeFog(cv.toDataURL('image/png'));
      const prev = loadPlayer();
      if (prev && extra) savePlayer({ ...prev, ...extra });
    },
  };
}

function asphalt(color, rough = 0.92) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.02 });
}

function paint(text) {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 512;
  const c = cv.getContext('2d');
  c.fillStyle = '#f4f7f8';
  c.font = '800 220px sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, 128, 256);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function jet(x, z, yaw) {
  const g = new THREE.Group();
  const white = asphalt(0xf2f5f6, 0.45);
  const dark = asphalt(0x1c2126, 0.5);
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.15, 37, 14), white);
  fus.rotation.x = Math.PI / 2;
  fus.position.y = 3.3;
  const nose = new THREE.Mesh(new THREE.SphereGeometry(2.15, 14, 10), white);
  nose.scale.set(1, 1, 1.5);
  nose.position.set(0, 3.3, 19.2);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(32, 0.4, 7), white);
  wing.position.set(0, 2.9, -1);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(11, 0.28, 3.2), white);
  stab.position.set(0, 3.2, -16);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6.2, 5), white);
  fin.position.set(0, 6.4, -16);
  for (const sx of [-7.5, 7.5]) {
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.9, 4.2, 10), dark);
    eng.rotation.x = Math.PI / 2;
    eng.position.set(sx, 1.7, 0);
    g.add(eng);
  }
  g.add(fus, nose, wing, stab, fin);
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  return g;
}

// Ellison Onizuka Kona (KOA / PHKO): runway 17/35, 11,000 ft by 150 ft.
// The open-air terminal sits inland, east of the runway. This is a scaled reconstruction, not a survey.
export function buildAirport(scene, W, heightAt, xy) {
  const [x, y] = xy;
  const h = Math.max(heightAt(x, y), 1);
  const bearing = 170 * Math.PI / 180;
  const g = new THREE.Group();
  g.position.copy(W(x, y, h));
  g.rotation.y = Math.PI - bearing;

  const deck = asphalt(0x2c3238);
  const concrete = asphalt(0xb7b1a6, 0.84);
  const mark = new THREE.MeshStandardMaterial({ color: 0xf4f7f8, roughness: 0.6 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xe2b53a, roughness: 0.55 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x8ec9d6, roughness: 0.15, metalness: 0.25, transparent: true, opacity: 0.45 });
  const wall = asphalt(0xe7e0d4, 0.72);
  const roofM = asphalt(0x8a4a32, 0.7);
  const grass = asphalt(0x3d6b45, 0.95);

  const runway = new THREE.Mesh(new THREE.BoxGeometry(46, 0.3, 3353), deck);
  runway.position.y = 0.15;
  g.add(runway);
  for (const end of [-1, 1]) {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(46, 0.28, 180), concrete);
    pad.position.set(0, 0.16, end * 1766);
    g.add(pad);
  }
  for (let z = -1500; z <= 1500; z += 58) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 28), mark);
    dash.position.set(0, 0.33, z);
    g.add(dash);
  }
  for (const side of [-22, 22]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 3300), mark);
    edge.position.set(side, 0.33, 0);
    g.add(edge);
  }
  for (const endZ of [-1580, 1580]) {
    for (let i = 0; i < 8; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 28), mark);
      bar.position.set(-16 + i * 4.6, 0.34, endZ);
      g.add(bar);
    }
  }
  for (const [num, z, rot] of [['17', -1450, 0], ['35', 1450, Math.PI]]) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(16, 28), new THREE.MeshStandardMaterial({ map: paint(num), transparent: true, roughness: 0.5 }));
    plane.rotation.x = -Math.PI / 2;
    plane.rotation.z = rot;
    plane.position.set(0, 0.36, z);
    g.add(plane);
  }
  for (const z of [-900, 900]) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const td = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 22), mark);
        td.position.set(side * (8 + i * 5), 0.34, z + (i - 1) * 40);
        g.add(td);
      }
    }
  }

  const taxi = new THREE.Mesh(new THREE.BoxGeometry(23, 0.28, 3000), deck);
  taxi.position.set(95, 0.14, 0);
  g.add(taxi);
  const taxiLine = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 2900), yellow);
  taxiLine.position.set(95, 0.32, 0);
  g.add(taxiLine);
  for (const z of [-700, 0, 700]) {
    const link = new THREE.Mesh(new THREE.BoxGeometry(70, 0.28, 23), deck);
    link.position.set(48, 0.14, z);
    g.add(link);
  }

  const apron = new THREE.Mesh(new THREE.BoxGeometry(210, 0.28, 780), concrete);
  apron.position.set(200, 0.16, 40);
  g.add(apron);
  const lawn = new THREE.Mesh(new THREE.BoxGeometry(36, 0.2, 40), grass);
  lawn.position.set(268, 0.2, 40);
  g.add(lawn);

  for (const z of [-50, 130]) {
    const hall = new THREE.Mesh(new THREE.BoxGeometry(28, 9, 150), wall);
    hall.position.set(300, 4.6, z);
    g.add(hall);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.4, 130), glass);
    win.position.set(286, 5.2, z);
    g.add(win);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(36, 0.6, 156), roofM);
    roof.position.set(300, 9.4, z);
    g.add(roof);
    for (let i = -3; i <= 3; i++) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 9, 8), asphalt(0x6e655c, 0.6));
      col.position.set(282, 4.5, z + i * 18);
      g.add(col);
    }
  }
  const curb = new THREE.Mesh(new THREE.BoxGeometry(14, 0.22, 420), asphalt(0x4a4038, 0.8));
  curb.position.set(332, 0.2, 40);
  g.add(curb);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.2, 26, 10), wall);
  shaft.position.set(360, 13, -120);
  g.add(shaft);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(9, 4, 9), glass);
  cab.position.set(360, 28, -120);
  g.add(cab);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 8, 6), asphalt(0x222222, 0.4));
  mast.position.set(360, 34, -120);
  g.add(mast);

  g.add(jet(150, -80, Math.PI / 2));
  g.add(jet(175, 40, Math.PI / 2));
  g.add(jet(160, 180, 0.4));

  const carGeo = new THREE.BoxGeometry(1.8, 1.4, 4.2);
  const cars = new THREE.InstancedMesh(carGeo, asphalt(0xd8dde2, 0.5), 36);
  const dummy = new THREE.Object3D();
  let n = 0;
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 9; i++) {
      dummy.position.set(390 + row * 7, 0.8, -80 + i * 8);
      dummy.rotation.y = row % 2 ? 0.05 : Math.PI;
      dummy.updateMatrix();
      cars.setMatrixAt(n++, dummy.matrix);
    }
  }
  g.add(cars);

  for (let i = 0; i < 14; i++) {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 6), asphalt(0x6b4a32, 0.8));
    trunk.position.y = 3.5;
    const crown = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), grass);
    crown.position.y = 7.2;
    palm.add(trunk, crown);
    palm.position.set(250 + (i % 2) * 90, 0, -160 + i * 28);
    g.add(palm);
  }

  const boardCv = document.createElement('canvas');
  boardCv.width = 1024;
  boardCv.height = 512;
  const boardMap = new THREE.CanvasTexture(boardCv);
  boardMap.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 11),
    new THREE.MeshBasicMaterial({ map: boardMap })
  );
  board.name = 'koa-flights';
  board.position.set(286, 5.5, -30);
  board.rotation.y = -Math.PI / 2;
  board.userData.canvas = boardCv;
  board.userData.map = boardMap;
  g.add(board);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 8),
    new THREE.MeshStandardMaterial({ map: signTexture(), transparent: true, roughness: 0.4 })
  );
  sign.position.set(286.4, 7.2, 40);
  sign.rotation.y = -Math.PI / 2;
  g.add(sign);

  const road = new THREE.Mesh(new THREE.BoxGeometry(12, 0.22, 1600), deck);
  road.position.set(430, 0.12, 900);
  g.add(road);

  scene.add(g);
  g.updateMatrixWorld(true);
  const drop = new THREE.Vector3(332, 1.7, 40);
  const face = new THREE.Vector3(286, 2, 40);
  drop.applyMatrix4(g.matrixWorld);
  face.applyMatrix4(g.matrixWorld);
  return { group: g, h, stand: [drop.x, -drop.z], look: [face.x, -face.z] };
}

function signTexture() {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 160;
  const c = cv.getContext('2d');
  c.fillStyle = '#14303a';
  c.fillRect(0, 0, 512, 160);
  c.fillStyle = '#f9c74f';
  c.font = '800 72px sans-serif';
  c.textAlign = 'center';
  c.fillText('KOA', 256, 78);
  c.fillStyle = '#f4f7f8';
  c.font = '500 28px sans-serif';
  c.fillText('Ellison Onizuka', 256, 124);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
