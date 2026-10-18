// Winners hall. Names and times come from the results table.
// A bike is placed only when that year's model is sourced. No likeness is invented.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const SOURCED = {
  2019: {
    file: 'speedmax_2019_slx.glb',
    side: 'men',
    note: 'Jan Frodeno rode a size-XL Speedmax with Zipp 858 wheels front and rear.',
  },
};

const ORIGIN = [70, -12];
const COLS = 1;
const GAP = 4.8;

function plaque(row, bikeNote) {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 320;
  const c = cv.getContext('2d');
  c.fillStyle = '#101820';
  c.fillRect(0, 0, 512, 320);
  c.fillStyle = '#f9c74f';
  c.fillRect(0, 0, 512, 8);
  c.font = '700 36px sans-serif';
  c.fillText(`${row.year} · ${row.v || ''}`, 20, 52);
  c.fillStyle = '#f4f7f8';
  c.font = '24px sans-serif';
  const line = (p, y) => {
    if (!p) { c.fillText('—', 20, y); return; }
    c.fillText(`${p.n}  ${p.c}  ${p.t}`, 20, y);
  };
  c.fillStyle = '#9fb0bd';
  c.fillText('Men', 20, 92);
  c.fillStyle = '#f4f7f8';
  line(row.men, 122);
  c.fillStyle = '#9fb0bd';
  c.fillText('Women', 20, 164);
  c.fillStyle = '#f4f7f8';
  line(row.women, 194);
  c.fillStyle = '#f9c74f';
  c.font = '20px sans-serif';
  c.fillText(bikeNote, 20, 246);
  c.fillText('Statue: not built. No likeness is shown.', 20, 278);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function createWinnersHall({ scene, W, heightAt, addGround, progress, base, explorer, grounds }) {
  const sheet = document.querySelector('#winnersSheet');
  document.querySelector('#winnersBtn')?.addEventListener('click', () => { if (sheet) sheet.hidden = false; });
  sheet?.querySelector('[data-close]')?.addEventListener('click', () => { sheet.hidden = true; });
  const rows = await fetch(base + 'winners.json').then(r => r.json());
  const terrain = [...(grounds || [])].filter(mesh => mesh && mesh.isMesh);
  const down = new THREE.Raycaster();
  down.ray.direction.set(0, -1, 0);
  function standAt(x, yNorth) {
    const w = W(x, yNorth, 0);
    down.ray.origin.set(w.x, 80, w.z);
    const hits = terrain.length ? down.intersectObjects(terrain, false) : [];
    const top = hits.reduce((best, hit) => Math.max(best, hit.point.y), heightAt(x, yNorth));
    return Math.max(top, 2.3);
  }
  const group = new THREE.Group();
  group.name = 'winners-hall';
  const stone = new THREE.MeshStandardMaterial({ color: 0x24303a, roughness: 0.8 });
  const bays = [];

  rows.forEach((row, i) => {
    const col = i % COLS;
    const line = Math.floor(i / COLS);
    const x = ORIGIN[0] + col * GAP;
    const y = ORIGIN[1] - line * GAP;
    const z = standAt(x, y);
    const bay = new THREE.Group();
    bay.position.copy(W(x, y, z));
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.22, 8), stone);
    plinth.position.y = 0.11;
    bay.add(plinth);
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.16, 3.2),
      new THREE.MeshStandardMaterial({ color: 0x4a5560, roughness: 0.9 })
    );
    pad.position.y = 0.08;
    pad.userData.ground = true;
    bay.add(pad);
    addGround(pad);
    const sourced = SOURCED[row.year];
    const note = sourced ? `Men's bike sourced. It appears after the arrival ride. ${sourced.note}` : 'Bike: not sourced.';
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 2.1),
      new THREE.MeshBasicMaterial({ map: plaque(row, note), side: THREE.DoubleSide })
    );
    board.position.set(0, 1.65, 0);
    bay.add(board);
    bay.userData = { year: String(row.year), x, y };
    group.add(bay);
    bays.push(bay);
  });

  scene.add(group);

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  function refresh() {
    const open = year => progress && progress().isBikeUnlocked({ year: String(year) });
    for (const bay of bays) {
      const spec = SOURCED[bay.userData.year];
      if (!spec || bay.userData.loaded || !open(bay.userData.year)) continue;
      bay.userData.loaded = true;
      loader.load('assets/bikes/' + spec.file, gltf => {
        const model = gltf.scene;
        model.scale.setScalar(0.38);
        model.position.set(spec.side === 'men' ? -0.7 : 0.7, 0.28, 0.2);
        bay.add(model);
      });
    }
  }
  refresh();

  const list = document.querySelector('#winnersBody');
  if (list) {
    list.replaceChildren();
    for (const row of rows) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'winner-row';
      const men = row.men ? `${row.men.n} ${row.men.t}` : '—';
      const women = row.women ? `${row.women.n} ${row.women.t}` : '—';
      item.innerHTML = `<b>${row.year} · ${row.v}</b><span>${men}</span><span>${women}</span>`;
      item.addEventListener('click', () => {
        const bay = bays.find(b => b.userData.year === String(row.year));
        if (!bay || !window.__kona?.locomotion) return;
        explorer?.stamp(bay.userData.x, bay.userData.y, 500);
        window.__kona.locomotion.teleport(bay.position.x, bay.position.y + 1.7, bay.position.z + 3.2, 0, 0);
        document.querySelector('#winnersSheet').hidden = true;
      });
      list.appendChild(item);
    }
  }

  return { group, refresh, stand: [ORIGIN[0] + 8, ORIGIN[1] + 6] };
}
