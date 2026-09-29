// The Kona Almanac (knowledge cards + hidden surprises) and the Locker (dress your triathlete, live 3D preview).
import * as THREE from 'three';
import { CARDS, CATEGORIES, COSMETICS, hint, unlockedCards, unlockedCosmetics } from './lore.js';
import { EGGS } from './eggs.js';
import { LANDMARKS } from './landmarks.js';
import { LEVELS } from './rideLevels.js';
import { progressSnapshot, lookNow, saveLook } from './unlocks.js';
import { makeAthlete, makeBike, pose, EMOTES } from './athlete.js';
import { haptic } from './appShell.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NAMES = {
  places: Object.fromEntries(LANDMARKS.map(l => [l.id, l.name])),
  levels: Object.fromEntries(LEVELS.map(l => [l.id, l.name])),
  eggs: Object.fromEntries(EGGS.map(e => [e.id, e.hint])),
};

export function showAlmanac({ rewards, onClose }) {
  document.getElementById('almanac')?.remove();
  const p = progressSnapshot(rewards);
  const open = new Set(unlockedCards(p));
  const root = document.createElement('div');
  root.id = 'almanac';
  const tabs = Object.entries(CATEGORIES).concat([['eggs', { name: 'Surprises', icon: '🥚' }]]);
  let tab = 'race';
  root.innerHTML = `
    <header class="al-top"><button type="button" class="al-back" aria-label="Close">‹</button>
      <div><b>Kona Almanac</b><span>${open.size} / ${CARDS.length} cards · ${p.eggs.length} / ${EGGS.length} surprises</span></div></header>
    <div class="al-bar"><i style="width:${(open.size / CARDS.length) * 100}%"></i></div>
    <nav class="al-tabs">${tabs.map(([k, c]) => `<button type="button" data-t="${k}">${c.icon} ${esc(c.name)}</button>`).join('')}</nav>
    <div class="al-list"></div>
    <p class="al-foot">New cards open as you come back each day, walk, ride and swim the island, win stars, discover places and find surprises.</p>`;
  document.body.appendChild(root);
  const list = root.querySelector('.al-list');
  function render() {
    root.querySelectorAll('.al-tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
    if (tab === 'eggs') {
      list.innerHTML = EGGS.map(e => {
        const got = p.eggs.includes(e.id);
        return `<article class="al-card ${got ? '' : 'locked'}"><h3>${got ? '🥚 ' + esc(e.name) : '🔍 Somewhere in Kona…'}</h3><p>${esc(e.hint)}</p></article>`;
      }).join('');
      return;
    }
    list.innerHTML = CARDS.filter(c => c.cat === tab).map(c => open.has(c.id)
      ? `<article class="al-card"><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p></article>`
      : `<article class="al-card locked"><h3>🔒 Locked card</h3><p>${esc(hint(c.unlock, NAMES))}</p></article>`).join('');
  }
  root.querySelector('.al-tabs').addEventListener('click', ev => { const t = ev.target.closest('[data-t]')?.dataset.t; if (t) { tab = t; render(); haptic(6); } });
  root.querySelector('.al-back').onclick = () => { root.remove(); onClose?.(); };
  render();
}

const SLOTS = { suit: 'Suit', helmet: 'Head', eyes: 'Shades', socks: 'Socks', extra: 'Extra', bike: 'Bike' };

export function showLocker({ rewards, player, onChange, onClose }) {
  document.getElementById('locker')?.remove();
  const p = progressSnapshot(rewards);
  const owned = new Set(unlockedCosmetics(p));
  let look = lookNow();
  let slot = 'suit';
  const root = document.createElement('div');
  root.id = 'locker';
  root.innerHTML = `
    <header class="al-top"><button type="button" class="al-back" aria-label="Close">‹</button>
      <div><b>Locker</b><span>${owned.size} / ${COSMETICS.length} items · tap your athlete for an emote</span></div></header>
    <div class="lk-stage"><canvas></canvas><button type="button" class="lk-ride">🚴 Show bike</button></div>
    <nav class="al-tabs">${Object.entries(SLOTS).map(([k, n]) => `<button type="button" data-s="${k}">${n}</button>`).join('')}</nav>
    <div class="lk-grid"></div>`;
  document.body.appendChild(root);

  // Live preview.
  const canvas = root.querySelector('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 1.6));
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.6); sun.position.set(2, 4, 3); scene.add(sun);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.4, 40), new THREE.MeshLambertMaterial({ color: 0xe8dcc6 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const turn = new THREE.Group(); scene.add(turn);
  let athlete = null, bike = null, riding = false, emote = null, emoteT = 0;
  function dress() {
    turn.clear();
    athlete = makeAthlete({ skin: player?.look?.skin || '#b07a52', suit: player?.look?.suit || '#1d3557', bib: 1, look });
    bike = makeBike(look);
    if (riding) { bike.add(athlete); turn.add(bike); } else turn.add(athlete);
  }
  dress();
  function size() { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  size();
  addEventListener('resize', size);
  let raf = 0, last = performance.now(), t = 0, spin = 0.5;
  (function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    spin += dt * 0.5;
    turn.rotation.y = spin;
    if (emote) { emoteT += dt; if (emoteT > 2.6) emote = null; }
    pose(athlete, { mode: riding ? 'bike' : 'walk', t, walk: 0, speed: 0, airborne: false, emote, emoteT, pedal: t * 6 });
    if (riding) bike.userData.front.rotation.x = bike.userData.rear.rotation.x = -t * 8;
    camera.position.set(0, riding ? 1.7 : 1.3, riding ? 6.2 : 5.4); camera.lookAt(0, riding ? 1.15 : 1.0, 0);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  })(last);
  canvas.addEventListener('click', () => { emote = EMOTES[(Math.random() * EMOTES.length) | 0]; emoteT = 0; riding = false; dress(); haptic(10); });
  root.querySelector('.lk-ride').onclick = () => { riding = !riding; root.querySelector('.lk-ride').textContent = riding ? '🏃 Show runner' : '🚴 Show bike'; dress(); };

  const grid = root.querySelector('.lk-grid');
  function render() {
    root.querySelectorAll('.al-tabs button').forEach(b => b.classList.toggle('on', b.dataset.s === slot));
    grid.innerHTML = COSMETICS.filter(c => c.slot === slot).map(c => {
      const has = owned.has(c.id), on = look[slot] === c.id;
      return `<button type="button" class="lk-item ${has ? '' : 'locked'} ${on ? 'on' : ''}" data-id="${c.id}" ${has ? '' : 'aria-disabled="true"'}>
        <b>${esc(c.name)}</b><span>${has ? (on ? 'Wearing' : 'Tap to wear') : '🔒 ' + esc(hint(c.unlock, NAMES))}</span></button>`;
    }).join('');
  }
  root.querySelector('.al-tabs').addEventListener('click', ev => { const s = ev.target.closest('[data-s]')?.dataset.s; if (s) { slot = s; if (s === 'bike' && !riding) { riding = true; root.querySelector('.lk-ride').textContent = '🏃 Show runner'; dress(); } render(); } });
  grid.addEventListener('click', ev => {
    const id = ev.target.closest('[data-id]')?.dataset.id;
    if (!id || !owned.has(id)) { if (id) haptic([20, 30, 20]); return; }
    look = { ...look, [slot]: id };
    saveLook(look);
    dress(); render(); haptic(12);
    onChange?.(look);
  });
  function close() { cancelAnimationFrame(raf); removeEventListener('resize', size); renderer.dispose(); renderer.forceContextLoss?.(); root.remove(); onClose?.(); }
  root.querySelector('.al-back').onclick = close;
  render();
}
