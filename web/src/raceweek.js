// Race week for the 2026 Kailua-Kona test build. Times and places come from data/raceweek.json.
import * as THREE from 'three';

const KEY = 'kona.raceweek.v1';
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const SKIN = [0x3f2918, 0x8d5524, 0xc68642, 0xe0ac69, 0xf1c27d, 0xffdbac];
const SHORTS = [0xe31c3d, 0xf2c14e, 0x3ddc97, 0x4c6ef5, 0xff6b2c, 0xf5f0e6, 0x222222, 0xc77dff];

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

function people(n) {
  const body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(.28, .9, 3, 6), new THREE.MeshStandardMaterial({ roughness: .72 }), n);
  const shorts = new THREE.InstancedMesh(new THREE.BoxGeometry(.52, .26, .32), new THREE.MeshStandardMaterial({ roughness: .5 }), n);
  const g = new THREE.Group(); g.add(body, shorts);
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  return {
    g, n,
    place(i, x, y, z, skin, cloth, bob = 0) {
      dummy.position.set(x, z + .85 + bob, -y);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      body.setMatrixAt(i, dummy.matrix);
      body.setColorAt(i, col.setHex(skin));
      dummy.position.y -= .38;
      dummy.updateMatrix();
      shorts.setMatrixAt(i, dummy.matrix);
      shorts.setColorAt(i, col.setHex(cloth));
    },
    commit() {
      body.instanceMatrix.needsUpdate = shorts.instanceMatrix.needsUpdate = true;
      if (body.instanceColor) body.instanceColor.needsUpdate = true;
      if (shorts.instanceColor) shorts.instanceColor.needsUpdate = true;
    },
  };
}

function pathLen(pts) {
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return s;
}
function sample(pts, s, dist) {
  const L = s[s.length - 1];
  let d = ((dist % (2 * L)) + 2 * L) % (2 * L);
  if (d > L) d = 2 * L - d;
  let i = 1;
  while (i < s.length - 1 && s[i] < d) i++;
  const span = s[i] - s[i - 1] || 1, t = (d - s[i - 1]) / span;
  return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
}

export async function mountWeek(ctx) {
  const data = await (await fetch(ctx.base + 'raceweek.json')).json();
  const { scene, camera, W, setHour, goSurvey, setWalk, toast, getHour, getWalk, heightAt, coffee, coarse } = ctx;
  const progress = loadProgress();
  let selected = data.days[2].id;
  let armed = null;
  let hour = 7;
  const alii = data.alii, cum = pathLen(alii);
  const nRun = coarse ? 36 : 110;
  const runners = people(nRun);
  const queue = people(14);
  const starters = people(coarse ? 12 : 22);
  const guests = people(18);
  runners.g.visible = queue.g.visible = starters.g.visible = guests.g.visible = false;
  scene.add(runners.g, queue.g, starters.g, guests.g);

  const flags = new THREE.Group();
  const pennant = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.4, .7), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: .6 }), 28);
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(.04, .04, 3.2, 5), new THREE.MeshStandardMaterial({ color: 0xded6c8, roughness: .7 }), 28);
  flags.add(pennant, poles);
  const fd = new THREE.Object3D(), fc = new THREE.Color();
  for (let i = 0; i < 28; i++) {
    const [x, y] = sample(alii, cum, 40 + i * 16);
    const z = Math.max(.4, heightAt(x, y));
    fd.position.copy(W(x, y, z + 1.6)); fd.rotation.y = i; fd.updateMatrix(); poles.setMatrixAt(i, fd.matrix);
    fd.position.copy(W(x + .7, y, z + 2.7)); fd.updateMatrix(); pennant.setMatrixAt(i, fd.matrix);
    pennant.setColorAt(i, fc.setHex(SHORTS[i % SHORTS.length]));
  }
  flags.visible = false; scene.add(flags);

  const tents = new THREE.Group();
  const tentColors = [0xf4f1ea, 0xd9efe8, 0xf6e2b8, 0xe7eef8];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(7, 3.2, 5), new THREE.MeshStandardMaterial({ color: tentColors[i % 4], roughness: .85 }));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 1.4, 4), new THREE.MeshStandardMaterial({ color: 0xf7f4ee }));
    const x = 200 + i * 9, y = 4 + (i % 2) * 6, z = Math.max(.4, heightAt(x, y));
    m.position.copy(W(x, y, z + 1.6)); roof.position.copy(W(x, y, z + 3.6)); roof.rotation.y = Math.PI / 4;
    tents.add(m, roof);
  }
  tents.visible = false; scene.add(tents);

  const root = document.querySelector('#week');
  const daysEl = root.querySelector('#days');
  const eventsEl = root.querySelector('#events');
  const alsoEl = root.querySelector('#also');
  const metaEl = root.querySelector('#weekMeta');
  const foot = root.querySelector('#weekFoot');
  foot.textContent = data.trademark;

  function plays() { return data.days.flatMap(d => (d.play || []).map(ev => ({ day: d, ev }))); }
  function doneCount() { return plays().filter(({ ev }) => progress[ev.id] === 'done').length; }
  function meta() { metaEl.textContent = `${doneCount()} / ${plays().length} · schedule 15 Sep 2026`; }
  function save() { localStorage.setItem(KEY, JSON.stringify(progress)); meta(); }
  function dayById(id) { return data.days.find(d => d.id === id); }
  function ymd(date) { const [y, m, d] = date.split('-').map(Number); return [y, m, d]; }
  function label(date) {
    const [y, m, d] = ymd(date);
    const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    return `${wd} ${d} Oct ${y}`;
  }
  function inWindow(key) {
    const day = dayById(selected);
    return (data.dressing[key] || []).some(([date, a, b]) => date === day.date && hour >= a && hour <= b);
  }

  function render() {
    const day = dayById(selected);
    daysEl.innerHTML = data.days.map(d => `<button type="button" data-day="${d.id}" class="${d.id === selected ? 'on' : ''}">${esc(d.short)}</button>`).join('');
    eventsEl.innerHTML = (day.play || []).map(ev => {
      const st = progress[ev.id] === 'done' ? 'done' : (armed === ev.id ? 'on' : '');
      const hh = `${String(Math.floor(ev.start)).padStart(2, '0')}:${String(Math.round((ev.start % 1) * 60)).padStart(2, '0')}`;
      return `<li data-id="${ev.id}" class="${st}"><i>${hh}</i> ${esc(ev.title)}</li>`;
    }).join('') || '<li class="quiet">Schedule only this day</li>';
    alsoEl.textContent = (day.also || []).join(' · ');
    meta();
  }

  function syncDressing() {
    const show = k => inWindow(k);
    if (coffee()) coffee().g.visible = show('coffee');
    flags.visible = show('parade');
    tents.visible = show('village');
    runners.g.visible = show('underpants');
    queue.g.visible = show('checkin');
    guests.g.visible = show('banquet');
    starters.g.visible = show('race');
  }

  function poseStatic(group, origin, along, n, spread) {
    for (let i = 0; i < n; i++) {
      const x = origin[0] + along[0] * i * spread, y = origin[1] + along[1] * i * spread;
      group.place(i, x, y, Math.max(.35, heightAt(x, y)), SKIN[i % SKIN.length], SHORTS[(i * 3) % SHORTS.length]);
    }
    group.commit();
  }

  let posed = false;
  function poseOnce() {
    if (posed) return; posed = true;
    poseStatic(queue, [-78, 108], [0, 1], 14, 1.15);
    poseStatic(guests, [8, 150], [1, .15], 18, 1.3);
    const dir = [0.321, -0.947];
    for (let i = 0; i < starters.n; i++) {
      const x = 36 + dir[0] * (i % 8) * 4 + (i > 10 ? 8 : -6);
      const y = -40 + dir[1] * (i % 8) * 4 + ((i % 3) - 1) * 3;
      starters.place(i, x, y, 0.05, SKIN[i % SKIN.length], SHORTS[i % SHORTS.length]);
    }
    starters.commit();
  }

  function animate(t) {
    if (!runners.g.visible) return;
    for (let i = 0; i < runners.n; i++) {
      const [x, y] = sample(alii, cum, (i / runners.n) * cum[cum.length - 1] * 2 + t * 2.4);
      runners.place(i, x, y, Math.max(.35, heightAt(x, y)), SKIN[i % SKIN.length], SHORTS[i % SHORTS.length], Math.sin(t * 8 + i) * .05);
    }
    runners.commit();
  }

  function survey() { return [camera.position.x, -camera.position.z]; }
  function hit(check) {
    const [x, y] = survey();
    if (check.type === 'coffee') {
      const c = coffee(); if (!c) return false;
      return Math.hypot(x - c.xy[0], y - c.xy[1]) < check.r;
    }
    const p = data.places[check.place];
    return Math.hypot(x - p.x, y - p.y) < check.r;
  }

  function checkObjectives() {
    const walk = getWalk();
    if (!walk.on) return;
    const day = dayById(selected);
    for (const ev of day.play || []) {
      if (progress[ev.id] === 'done') continue;
      const armedOk = armed === ev.id;
      const windowOk = hour >= ev.start && hour <= ev.end;
      if (!armedOk && !windowOk) continue;
      if (ev.mode === 'swim' && !walk.swim) continue;
      if (ev.mode === 'walk' && walk.swim) continue;
      const have = new Set(Array.isArray(progress[ev.id]) ? progress[ev.id] : []);
      const next = ev.checks.find(c => !have.has(c.id));
      if (!next || !hit(next)) continue;
      have.add(next.id);
      const rest = ev.checks.filter(c => !have.has(c.id));
      if (!rest.length) {
        progress[ev.id] = 'done';
        save(); render();
        toast(`${ev.title}. Done.`);
        if (doneCount() === plays().length) toast('Race week complete.');
      } else {
        progress[ev.id] = [...have];
        save();
        toast(rest[0].id === 'home' ? 'Turnaround. Back to the parking lot.' : 'Checkpoint.');
      }
    }
  }

  async function focus(ev, day, opts = {}) {
    selected = day.id; armed = ev.id; hour = ev.start;
    setHour(ev.start, label(day.date), ymd(day.date));
    const slider = document.querySelector('#hour'); if (slider) slider.value = ev.start;
    render(); syncDressing(); poseOnce();
    const cam = ev.cam;
    await goSurvey({ x: cam.x, y: cam.y, z: cam.z, lx: cam.lx, ly: cam.ly, lz: cam.lz, name: ev.title, note: `${ev.where}. ${ev.note}` }, opts.dur ?? 2.2);
    if (opts.board !== false) setWalk(true);
  }

  function open(id, opts = {}) {
    const day = dayById(id) || data.days[2];
    selected = day.id; armed = null;
    const pending = (day.play || []).find(ev => progress[ev.id] !== 'done') || (day.play || [])[0];
    if (pending) return focus(pending, day, opts);
    hour = 8;
    setHour(8, label(day.date), ymd(day.date));
    render(); syncDressing();
    const p = data.places.pier;
    return goSurvey({ x: -30, y: 40, z: 6, lx: p.x, ly: p.y, lz: 2, name: day.short, note: (day.also || []).join(' · ') }, opts.dur ?? 1.6);
  }

  daysEl.addEventListener('click', e => { const b = e.target.closest('button'); if (b) open(b.dataset.day); });
  eventsEl.addEventListener('click', e => {
    const li = e.target.closest('li'); if (!li || !li.dataset.id) return;
    const day = dayById(selected);
    const ev = (day.play || []).find(x => x.id === li.dataset.id);
    if (ev) focus(ev, day);
  });
  root.querySelector('#resetWeek').onclick = () => {
    for (const k of Object.keys(progress)) delete progress[k];
    save(); render(); toast('Race week progress cleared.');
  };
  render();
  return {
    open, focus, data,
    tick(t) { hour = getHour(); syncDressing(); animate(t); checkObjectives(); },
  };
}
