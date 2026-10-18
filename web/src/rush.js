// Kona Rush: the core arcade mode. Ride the Queen K from the lava fields to Aliʻi Drive in about three minutes.
// Swipe or tap to change lanes, hold to tuck. Pass slower riders but never sit in their draft zone (the coral wedge
// behind every rider): stay in it too long and you get a card, three cards and you are out. Gels and bottles keep the
// energy tank up; run it dry and you bonk. Hāwī brings crosswind gusts (tuck to hold your line), the Energy Lab burns
// energy faster, Aliʻi Drive has the crowds and the finish arch. Credits from every run buy upgrades you feel next run.
// Rules and numbers live in rushRules.js (unit-tested); this file is the scene, the input and the loop.
import * as THREE from 'three';
import { effects } from './weather.js';
import { ambience } from './ambience.js';
import { LANES, esc, makeRider, pedal, makeCone, makePickup, createCourse, makeArch } from './rideKit.js';
import { haptic } from './appShell.js';
import { createSfx, confetti } from './aptFx.js';
import { readSection, writeSection } from './save.js';
import { hstDay } from './clock.js';
import { statsFor, zoneAt, ZONES, MEDALS, medalFor, scoreRun, creditsFor, applyRunToMissions, validGarage } from './rushRules.js';

const KM_PER_M = 2.6 / 1000;                 // course compression: ~2.5 km of course every ~40 s of riding
const FINISH_KM = MEDALS.finish;
const SPAWN_Z = -170;
const DRAFT_LEN = 10, DRAFT_CARD = 1.5;      // metres of draft zone behind a rider; seconds in it before a card
const MEDAL_TXT = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', finish: 'Finisher' };
const MEDAL_BONUS = { bronze: 40, silver: 80, gold: 150, finish: 300 };
// ------------------------------------------------------------------ the run
export async function runRush({ player, rewards, onExit, onGarage }) {
  const look = player?.look || {};
  const suit = look.suit || '#2E6F73', lid = 0xfbf8f2;
  const root = document.createElement('div');
  root.id = 'rush';
  root.innerHTML = `
    <canvas id="rushCanvas"></canvas>
    <div class="rs-top">
      <div class="rs-dist"><b id="rsKm">0.00</b><span>km</span><em id="rsZone">Queen K lava fields</em></div>
      <div class="rs-right"><div class="rs-score" id="rsScore">0</div><button type="button" class="rs-pause" id="rsPause" aria-label="Pause">II</button></div>
    </div>
    <div class="rs-track"><i id="rsProg"></i>${ZONES.slice(1).map(z => `<s style="left:${(z.from / FINISH_KM) * 100}%"></s>`).join('')}<u style="left:100%"></u></div>
    <div class="rs-combo" id="rsCombo"></div>
    <div class="rs-banner" id="rsBanner"></div>
    <div class="rs-tip" id="rsTip"></div>
    <div class="rs-count" id="rsCount"></div>
    <div class="rs-gust" id="rsGust"></div>
    <div class="rs-bottom">
      <div class="rs-cards" id="rsCards" aria-label="Drafting cards"><i></i><i></i><i></i></div>
      <div class="rs-energy"><span>Energy</span><div><i id="rsEnergy"></i></div></div>
      <div class="rs-speed"><b id="rsSpeed">0</b><span>km/h</span></div>
    </div>
    <div class="rs-draft" id="rsDraft"><span>DRAFT ZONE</span><div><i id="rsDraftBar"></i></div></div>
    <div class="rs-pops" id="rsPops"></div>
    <section class="rs-sheet" id="rsSheet" hidden role="dialog" aria-modal="true"></section>`;
  document.body.appendChild(root);
  document.body.classList.add('in-challenge');
  const $ = s => root.querySelector(s);

  // ---------------------------------------------------------------- renderer, scene, light
  const canvas = $('#rushCanvas');
  const course = createCourse({ canvas, zone: 'queenk' });
  const { scene, renderer, coarse } = course;
  const arch = makeArch('FINISH · KONA');
  arch.visible = false;
  scene.add(arch);

  // The athlete.
  const me = makeRider(suit, lid, true);
  me.scale.setScalar(1.15);
  scene.add(me);

  // Pools.
  const riderCols = [0xd9785b, 0x13293d, 0xe8c35a, 0x6b4ea0, 0xc0392b, 0x2a9d8f, 0x111418, 0xf1faee];
  const draftGeo = new THREE.PlaneGeometry(2.4, DRAFT_LEN);
  const riders = Array.from({ length: 9 }, (_, i) => {
    const m = makeRider(riderCols[i % riderCols.length], riderCols[(i + 3) % riderCols.length]);
    const zone = new THREE.Mesh(draftGeo, new THREE.MeshBasicMaterial({ color: 0xd9785b, transparent: true, opacity: 0.2, depthWrite: false }));
    zone.rotation.x = -Math.PI / 2; zone.position.set(0, 0.03, DRAFT_LEN / 2 + 0.9);
    m.add(zone);
    m.visible = false;
    scene.add(m);
    return { mesh: m, zone, live: false };
  });
  const cones = Array.from({ length: 12 }, () => { const m = makeCone(); m.visible = false; scene.add(m); return { mesh: m, live: false }; });
  const pickups = [];
  for (const [kind, n] of [['gel', 6], ['bottle', 5], ['ring', 8], ['shell', 2]]) for (let i = 0; i < n; i++) { const m = makePickup(kind); m.visible = false; scene.add(m); pickups.push({ kind, mesh: m, live: false }); }

  const sfx = createSfx();
  const FX = effects(), amb = ambience();
  root.classList.add('vignette');
  const garage0 = validGarage(readSection('garage'));
  const stats = statsFor(garage0.levels);

  // ---------------------------------------------------------------- state
  let S;
  function reset() {
    S = {
      phase: 'count', t: 0, countT: 3.2, km: 0, dist: 0, lane: 1, px: 0, speed: 0, energy: 100 * stats.tank, tank: 100 * stats.tank,
      tuck: false, boost: 0, cards: 0, passes: 0, rings: 0, shells: 0, combo: 0, comboT: 0, bestCombo: 0, crashes: 0,
      invuln: 0, draftT: 0, grace: 0, nextSpawn: 40, zone: 'queenk', gust: null, nextGust: 0, shake: 0, lean: 0, bonus: 0,
      tips: new Set(), over: null, paused: false,
    };
    for (const r of riders) { r.live = false; r.mesh.visible = false; }
    for (const c of cones) { c.live = false; c.mesh.visible = false; }
    for (const p of pickups) { p.live = false; p.mesh.visible = false; }
    arch.visible = false;
    $('#rsSheet').hidden = true;
    root.classList.remove('over', 'low', 'drafting');
    $('#rsZone').textContent = ZONES[0].name;
    applyPalette('queenk', 1);
    hud(true);
  }

  // ---------------------------------------------------------------- spawning (a new row every ~20–34 m, at least one lane always open)
  const take = list => list.find(o => !o.live);
  function spawnRider(lane, z, ratio) {
    const r = take(riders);
    if (!r) return;
    Object.assign(r, { live: true, lane, x: LANES[lane], z, ratio, passed: false, hit: false, bob: Math.random() * 6 });
    r.mesh.position.set(r.x, 0, z);
    r.mesh.visible = true;
  }
  function spawnCone(lane, z) {
    const c = take(cones);
    if (!c) return;
    Object.assign(c, { live: true, lane, z, hit: false });
    c.mesh.position.set(LANES[lane], 0, z);
    c.mesh.rotation.set(0, 0, 0);
    c.mesh.visible = true;
  }
  function spawnPickup(kind, lane, z) {
    const p = pickups.find(o => !o.live && o.kind === kind);
    if (!p) return;
    Object.assign(p, { live: true, lane, z, spin: Math.random() * 6, got: false });
    p.mesh.position.set(LANES[lane], 0, z);
    p.mesh.scale.setScalar(1);
    p.mesh.visible = true;
  }
  const pick = a => a[(Math.random() * a.length) | 0];
  function spawnRow() {
    const d = Math.min(1, S.km / 8);                                    // difficulty 0 → 1 over the course
    const first = garage0.runs === 0 && S.km < 0.6;
    const free = [0, 1, 2].sort(() => Math.random() - 0.5);
    const z = SPAWN_Z;
    const x = Math.random();
    const heat = S.zone === 'energylab';
    const fuelOdds = (heat ? 0.3 : 0.22) - d * 0.05;
    if (x < fuelOdds) {
      spawnPickup(heat && Math.random() < 0.6 ? 'bottle' : Math.random() < 0.55 ? 'gel' : 'bottle', free[0], z);
      if (Math.random() < 0.5) spawnCone(free[1], z);
    } else if (x < fuelOdds + 0.14) {
      const lane = free[0];                                            // a line of rings in one lane
      for (let i = 0; i < 3; i++) spawnPickup('ring', lane, z - i * 9);
      if (Math.random() < 0.5 + d * 0.3) spawnRider(free[1], z - 8, 0.55 + Math.random() * 0.15);
    } else if (x < fuelOdds + 0.2 && S.km > 1) {
      spawnPickup('shell', free[0], z);
      spawnCone(free[1], z); if (d > 0.4) spawnCone(free[2], z);   // shells sit behind a gap you have to thread
      spawnCone(free[1], z - 6);
    } else if (x < fuelOdds + 0.5) {
      const n = first ? 1 : Math.random() < 0.35 + d * 0.4 ? 2 : 1;   // riders, some nearly as fast as you
      for (let i = 0; i < n; i++) spawnRider(free[i], z - i * 5, 0.5 + Math.random() * (0.25 + d * 0.2));
    } else {
      const n = first ? 1 : Math.random() < 0.3 + d * 0.5 ? 2 : 1;
      for (let i = 0; i < n; i++) spawnCone(free[i], z);
      if (!first && d > 0.3 && Math.random() < d * 0.6) spawnCone(free[n] ?? free[0], z - 14);
    }
    S.nextSpawn = (first ? 38 : 34 - d * 12) + Math.random() * 8;
  }

  // ---------------------------------------------------------------- feedback
  let popN = 0;
  function pop(text, cls = '') {
    const el = document.createElement('div');
    el.className = 'rs-pop ' + cls;
    el.textContent = text;
    el.style.left = `${46 + ((popN++ % 3) - 1) * 12}%`;
    $('#rsPops').appendChild(el);
    setTimeout(() => el.remove(), 900);
  }
  let tipTimer = 0;
  function tip(key, text, bad = false, ms = 2600) {
    if (key && S.tips.has(key)) return;
    if (key) S.tips.add(key);
    const el = $('#rsTip');
    el.textContent = text;
    el.classList.toggle('bad', bad);
    el.classList.add('on');
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => el.classList.remove('on'), ms);
  }
  let bannerTimer = 0;
  function bannerMsg(title, sub) {
    const el = $('#rsBanner');
    el.innerHTML = `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`;
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.classList.remove('on'), 2200);
  }
  function addCombo(pts, label) {
    S.combo += 1; S.comboT = 3.5;
    S.bestCombo = Math.max(S.bestCombo, S.combo);
    S.bonus += pts * Math.min(S.combo, 10);
    pop(`${label}${S.combo > 1 ? ` ×${S.combo}` : ''}`, S.combo >= 5 ? 'hot' : '');
    sfx.pack(S.combo);
  }
  const tutorial = garage0.runs < 2;

  // ---------------------------------------------------------------- input: tap or swipe to change lanes, hold to tuck
  function steer(dir) {
    if (S.phase !== 'ride') return;
    const n = Math.max(0, Math.min(2, S.lane + dir));
    if (n === S.lane) { S.lean = dir * 0.2; return; }
    S.lane = n;
    S.lean = dir * 0.35;
    haptic(8);
  }
  const setTuck = on => { S.tuck = !!on && S.phase === 'ride'; };
  let touch = null;
  canvas.addEventListener('pointerdown', ev => {
    sfx.unlock();
    touch = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, t: performance.now(), swiped: false, held: false };
    canvas.setPointerCapture(ev.pointerId);
  });
  canvas.addEventListener('pointermove', ev => {
    if (!touch || ev.pointerId !== touch.id || touch.swiped) return;
    const dx = ev.clientX - touch.x;
    if (Math.abs(dx) > 28) { touch.swiped = true; steer(Math.sign(dx)); touch.x = ev.clientX; }
  });
  const up = ev => {
    if (!touch || ev.pointerId !== touch.id) return;
    if (!touch.swiped && !touch.held) steer(ev.clientX < innerWidth / 2 ? -1 : 1);
    touch = null;
    setTuck(false);
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  const keysDown = new Set();
  function onKey(ev) {
    const k = ev.key.toLowerCase();
    if (ev.type === 'keydown') {
      if (keysDown.has(k)) return;
      keysDown.add(k);
      if (k === 'arrowleft' || k === 'a') steer(-1);
      else if (k === 'arrowright' || k === 'd') steer(1);
      else if (k === ' ' || k === 'shift' || k === 'arrowdown' || k === 's') setTuck(true);
      else if (k === 'escape' || k === 'p') togglePause();
      else if (k === 'enter' && S.phase === 'over') again();
    } else {
      keysDown.delete(k);
      if (k === ' ' || k === 'shift' || k === 'arrowdown' || k === 's') setTuck(false);
    }
  }
  addEventListener('keydown', onKey);
  addEventListener('keyup', onKey);

  function togglePause(force) {
    if (S.phase !== 'ride' && S.phase !== 'count') return;
    S.paused = force ?? !S.paused;
    const sh = $('#rsSheet');
    if (!S.paused) { sh.hidden = true; return; }
    sh.innerHTML = `<h2>Paused</h2><p>${S.km.toFixed(2)} km · ${S.passes} passed</p>
      <div class="rs-row"><button type="button" class="rs-primary" data-a="resume">Resume</button></div>
      <div class="rs-row"><button type="button" class="rs-ghost" data-a="retry">Restart</button><button type="button" class="rs-ghost" data-a="home">Home</button></div>`;
    sh.hidden = false;
  }
  $('#rsPause').addEventListener('click', () => togglePause());
  document.addEventListener('visibilitychange', onHide);
  function onHide() { if (document.hidden && S.phase === 'ride') togglePause(true); }
  $('#rsSheet').addEventListener('click', ev => {
    const a = ev.target.closest('[data-a]')?.dataset.a;
    if (a === 'resume') togglePause(false);
    else if (a === 'retry') again();
    else if (a === 'home') exit();
    else if (a === 'garage') exit('garage');
    else if (a === 'share') share();
    else if (a?.startsWith('claim:')) claimMission(a.slice(6), ev.target);
  });

  // ---------------------------------------------------------------- zones
  const applyPalette = (id, instant) => course.setZone(id, instant);
  function enterZone(z) {
    S.zone = z.id;
    applyPalette(z.id);
    $('#rsZone').textContent = z.name;
    const sub = { hawi: 'Crosswinds · tuck to hold your line', energylab: 'Heat · energy burns faster, grab bottles', alii: 'The crowds · the finish is close' }[z.id];
    bannerMsg(z.name.split(' · ')[0], sub);
    haptic([10, 40, 10]);
    sfx.step();
    if (z.id === 'hawi') S.nextGust = S.t + 2.5;
    const medal = medalFor(S.km);
    if (medal) pop(`${MEDAL_TXT[medal]} medal reached`, 'medal');
  }

  // ---------------------------------------------------------------- end of run
  let lastResult = null;
  function end(kind) {
    if (S.over) return;
    S.over = kind;
    S.phase = 'over';
    S.tuck = false;
    root.classList.add('over');
    const km = Math.min(FINISH_KM, Math.round(S.km * 100) / 100);
    const run = { km, passes: S.passes, rings: S.rings, bestCombo: S.bestCombo, cards: S.cards, shells: S.shells };
    const score = scoreRun(run) + Math.round(S.bonus / 5);
    const medal = medalFor(km);
    // Save progress: garage stats and today's missions.
    const g = validGarage(readSection('garage'));
    const pb = score > g.best;
    const day = hstDay();
    const missionsBefore = g.missions && g.missions.day === day ? g.missions.list : null;
    const next = {
      ...g, runs: g.runs + 1, best: Math.max(g.best, score), bestPasses: Math.max(g.bestPasses, S.passes),
      totalKm: Math.round((g.totalKm + km) * 100) / 100, zonesSeen: Math.max(g.zonesSeen, ZONES.filter(z => km >= z.from).length),
      missions: applyRunToMissions(g.missions, run, day),
    };
    writeSection('garage', next);
    // Pay: Credits for the run, plus a one-off bonus the first time each medal is reached.
    const paid = rewards?.grant({ xp: Math.round(score / 15), credits: creditsFor(run), reason: `Kona Rush · ${km.toFixed(1)} km` });
    const medalPaid = medal ? rewards?.grantOnce(`rush:medal:${medal}`, { xp: MEDAL_BONUS[medal], credits: MEDAL_BONUS[medal], reason: `Kona Rush ${MEDAL_TXT[medal]} medal` }) : null;
    const newlyDone = next.missions.list.filter(m => m.done && !(missionsBefore || []).find(o => o.id === m.id && o.done));
    lastResult = { kind, run, score, medal, pb, credits: (paid?.credits || 0) + (medalPaid?.credits || 0), medalFirst: !!medalPaid, missions: next.missions.list, newlyDone, best: next.best };
    if (kind === 'finish' || pb) { confetti(root); sfx.done(); haptic([20, 60, 20, 60, 40]); } else haptic(80);
    setTimeout(() => showResult(lastResult), kind === 'finish' ? 1400 : 900);
  }
  function showResult(r) {
    const title = { finish: 'FINISHER!', bonk: 'Bonk!', dq: 'Disqualified', quit: 'Run over' }[r.kind];
    const why = { finish: 'You rode all the way to Aliʻi Drive.', bonk: 'Out of energy. Grab more gels and bottles next time.', dq: 'Three drafting cards. Pass quickly and stay out of the coral zones.', quit: '' }[r.kind];
    const nextMedal = ['bronze', 'silver', 'gold', 'finish'].find(m => r.run.km < MEDALS[m]);
    const toGo = nextMedal ? `${(MEDALS[nextMedal] - r.run.km).toFixed(1)} km to ${MEDAL_TXT[nextMedal]}` : 'Every medal won';
    const sh = $('#rsSheet');
    sh.innerHTML = `
      <p class="rs-eyebrow">${esc(why)}</p>
      <h2>${title}</h2>
      <div class="rs-medal ${r.medal || 'none'}"><b>${r.medal ? MEDAL_TXT[r.medal] : 'No medal yet'}</b><span>${esc(toGo)}</span></div>
      <div class="rs-score-big"><b>${r.score.toLocaleString()}</b>${r.pb ? '<em>New best!</em>' : `<span>Best ${r.best.toLocaleString()}</span>`}</div>
      <div class="rs-stats">
        <div><b>${r.run.km.toFixed(2)}</b><span>km</span></div>
        <div><b>${r.run.passes}</b><span>passed</span></div>
        <div><b>${r.run.rings}</b><span>rings</span></div>
        <div><b>×${r.run.bestCombo}</b><span>combo</span></div>
      </div>
      <p class="rs-earn">+${r.credits} Credits${r.medalFirst ? ' · first-time medal bonus' : ''}</p>
      ${missionHtml(r.missions)}
      <div class="rs-row"><button type="button" class="rs-primary" data-a="retry" autofocus>Ride again</button></div>
      <div class="rs-row"><button type="button" class="rs-ghost" data-a="garage">Garage</button><button type="button" class="rs-ghost" data-a="share">Share</button><button type="button" class="rs-ghost" data-a="home">Home</button></div>`;
    sh.hidden = false;
  }
  function missionHtml(list) {
    if (!list?.length) return '';
    return `<ul class="rs-missions">${list.map(m => `<li class="${m.done ? 'done' : ''}"><span>${esc(m.text)}</span>
      <div class="bar"><i style="width:${Math.min(100, (m.progress / m.target) * 100)}%"></i></div>
      ${m.done && !m.claimed ? `<button type="button" data-a="claim:${esc(m.id)}">Claim +${m.reward}</button>` : m.claimed ? '<em>Claimed</em>' : `<em>${fmtN(m.progress)}/${fmtN(m.target)}</em>`}</li>`).join('')}</ul>`;
  }
  const fmtN = n => (Number.isInteger(n) ? n : n.toFixed(1));
  function claimMission(id, btn) {
    const paid = claimRushMission(id, rewards);
    if (!paid) return;
    if (btn) btn.outerHTML = `<em>+${paid.credits} Credits</em>`;
    haptic(20); sfx.done();
  }
  async function share() {
    const r = lastResult;
    if (!r) return;
    const url = location.origin + location.pathname + '?c=rush';
    const text = `Kona Rush: ${r.score.toLocaleString()} points, ${r.run.km.toFixed(2)} km on the Queen K${r.medal ? ` (${MEDAL_TXT[r.medal]})` : ''}. Beat that: ${url}`;
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); pop('Copied'); } } catch { /* dismissed */ }
  }
  function again() { reset(); }

  // ---------------------------------------------------------------- the loop
  let raf = 0, last = performance.now(), alive = true;
  function hud(force) {
    $('#rsKm').textContent = S.km.toFixed(2);
    $('#rsScore').textContent = (scoreRun(S) + Math.round(S.bonus / 5)).toLocaleString();
    $('#rsProg').style.width = `${Math.min(100, (S.km / FINISH_KM) * 100)}%`;
    const e = Math.max(0, S.energy / S.tank);
    $('#rsEnergy').style.width = `${e * 100}%`;
    root.classList.toggle('low', e < 0.25 && S.phase === 'ride');
    $('#rsSpeed').textContent = Math.round(S.speed * 1.75);
    const cards = $('#rsCards').children;
    for (let i = 0; i < 3; i++) cards[i].classList.toggle('on', i < S.cards);
    $('#rsCombo').textContent = S.combo > 1 ? `×${S.combo}` : '';
    $('#rsCombo').classList.toggle('hot', S.combo >= 5);
    $('#rsDraftBar').style.width = `${Math.min(100, (S.draftT / DRAFT_CARD) * 100)}%`;
    if (force) $('#rsCount').textContent = '';
  }

  function frame(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!S.paused) step(dt);
    render(dt);
    raf = requestAnimationFrame(frame);
  }

  function step(dt) {
    S.t += dt;
    course.tick(dt);
    if (S.phase === 'count') {
      S.countT -= dt;
      const n = Math.ceil(S.countT - 0.2);
      const el = $('#rsCount');
      const txt = n > 0 ? String(n) : 'GO!';
      if (el.textContent !== txt) { el.textContent = txt; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); sfx.step(); }
      S.speed = Math.max(S.speed, 4);
      if (S.countT <= 0) {
        S.phase = 'ride';
        setTimeout(() => { if (el.textContent === 'GO!') el.textContent = ''; }, 500);
        if (tutorial) tip('lanes', coarse ? 'Tap left or right (or swipe) to change lanes · hold to tuck' : '← → to change lanes · hold Space to tuck', false, 4200);
      }
    }
    const riding = S.phase === 'ride';
    if (touch && !touch.swiped && !touch.held && performance.now() - touch.t > 170) { touch.held = true; setTuck(true); }
    // Speed: cruising speed rises along the course; tuck, boost and slipstream stack on top.
    const base = (21 + Math.min(S.km, 10) * 1.1) * stats.topSpeed;
    let target = riding ? base * (S.tuck ? 1.28 : 1) * (S.boost > 0 ? 1.4 : 1) * (S.draftT > 0 ? 1.05 : 1) : S.phase === 'over' ? 0 : 4;
    if (S.over === 'finish') target = 9;
    S.speed += (target - S.speed) * Math.min(1, dt * (target < S.speed ? 2.2 : 1.1));
    S.boost = Math.max(0, S.boost - dt);
    S.invuln = Math.max(0, S.invuln - dt);
    S.grace = Math.max(0, S.grace - dt);
    const move = S.speed * dt;
    S.dist += move;
    if (riding) S.km += move * KM_PER_M;
    course.advance(move, S.t);

    if (riding) {
      // Energy: steady burn, more in the heat, a lot more when tucked, less in a slipstream.
      const drain = (0.85 * (S.zone === 'energylab' ? 1.8 * Math.max(0.85, Math.min(1.25, FX.heat)) : 1) + (S.tuck ? 3.2 * stats.tuckCost : 0)) * (S.draftT > 0 ? 0.6 : 1);
      S.energy -= drain * dt;
      if (S.energy < S.tank * 0.3 && tutorial) tip('fuel', 'Energy is low: ride through gels and bottles', true);
      if (S.energy <= 0) { S.energy = 0; end('bonk'); bannerMsg('Bonk', 'Out of energy'); }
      const z = zoneAt(S.km);
      if (z.id !== S.zone) enterZone(z);
      if (S.km >= FINISH_KM) { end('finish'); bannerMsg('FINISH', 'You are an IRONMAN… of the Queen K'); }
      S.comboT -= dt;
      if (S.comboT <= 0 && S.combo) S.combo = 0;
      S.nextSpawn -= move;
      if (S.nextSpawn <= 0 && S.km < FINISH_KM - 0.25) { spawnRow(); S.rows = (S.rows || 0) + 1; }
      // Hāwī crosswinds: a warning, then a gust that pushes you a lane unless you are tucked.
      if (S.zone === 'hawi') {
        if (!S.gust && S.t >= S.nextGust) { S.gust = { dir: Math.random() < 0.5 ? -1 : 1, at: S.t + 1.3 }; tip('gust', 'Gust coming: hold to tuck and keep your line', false, 2000); }
        if (S.gust) {
          $('#rsGust').textContent = S.gust.dir < 0 ? '⟵ GUST' : 'GUST ⟶';
          $('#rsGust').classList.add('on');
          if (S.t >= S.gust.at) {
            if (S.tuck) { addCombo(20, 'Held the line'); }
            else { const n = Math.max(0, Math.min(2, S.lane + S.gust.dir)); if (n !== S.lane) { S.lane = n; S.lean = S.gust.dir * 0.5; } else S.energy -= 6; S.shake = 0.25; haptic(30); pop('Blown sideways', 'bad'); }
            S.gust = null;
            S.nextGust = S.t + (4 + Math.random() * 3.5) / Math.max(0.7, Math.min(1.4, FX.wind));
            $('#rsGust').classList.remove('on');
          }
        }
      } else if (S.gust) { S.gust = null; $('#rsGust').classList.remove('on'); }
    }

    // The athlete: glide to the lane, lean into the move, tuck lower.
    S.px += (LANES[S.lane] - S.px) * Math.min(1, dt * 11);
    S.lean *= Math.pow(0.02, dt);
    me.position.set(S.px, 0, 0);
    me.rotation.z = -S.lean - (LANES[S.lane] - S.px) * 0.06;
    const body = me.userData.body;
    body.position.y += ((S.tuck ? 0.9 : 1.02) - body.position.y) * Math.min(1, dt * 10);
    body.rotation.x += ((S.tuck ? -0.18 : 0) - body.rotation.x) * Math.min(1, dt * 10);
    pedal(me, S.dist / 7);
    me.visible = S.invuln <= 0 || Math.floor(S.t * 14) % 2 === 0;

    // Riders: slower than you, pedal, avoid cones, and carry a draft zone behind them.
    let inDraft = false;
    for (const r of riders) {
      if (!r.live) continue;
      const rz0 = r.z;
      r.z += S.speed * (1 - r.ratio) * dt;
      if (r.z > 14) { r.live = false; r.mesh.visible = false; continue; }
      const blocked = cones.some(c => c.live && c.lane === r.lane && c.z < r.z && c.z > r.z - 10);
      if (blocked) {
        const alt = [r.lane - 1, r.lane + 1].filter(l => l >= 0 && l <= 2 && !cones.some(c => c.live && c.lane === l && Math.abs(c.z - r.z) < 12));
        if (alt.length) r.lane = alt[0];
      }
      r.x += (LANES[r.lane] - r.x) * Math.min(1, dt * 3);
      r.bob += dt;
      r.mesh.position.set(r.x, 0, r.z);
      r.mesh.rotation.z = (r.x - LANES[r.lane]) * 0.08;
      pedal(r.mesh, S.dist * r.ratio / 7 + r.bob);
      const sameLane = Math.abs(r.x - S.px) < 1.25;
      const behind = r.z < -0.9 && r.z > -0.9 - DRAFT_LEN;
      const here = riding && sameLane && behind && !r.hit;
      r.zone.material.opacity = here ? 0.5 : 0.18;
      if (here) inDraft = true;
      if (riding && !r.hit && sameLane && r.z > -1.5 && rz0 < 1.0 && S.invuln <= 0) crash(r);
      if (!r.passed && r.z > 1.2 && riding) { r.passed = true; if (!r.hit) { S.passes++; addCombo(10, 'Pass'); } }
    }
    if (inDraft && S.grace <= 0) {
      S.draftT += dt;
      if (tutorial) tip('draft', 'Coral zone = drafting. Change lane and pass or you get a card', true);
      if (S.draftT >= DRAFT_CARD) {
        S.cards++; S.draftT = 0; S.grace = 2; S.combo = 0;
        bannerMsg(S.cards >= 3 ? 'Third card' : `Drafting card ${S.cards}/3`, S.cards >= 3 ? 'Disqualified' : 'Stay out of the coral zones');
        haptic([40, 40, 40]); sfx.trap();
        if (S.cards >= 3) end('dq');
      }
    } else S.draftT = Math.max(0, S.draftT - dt * 1.5);
    root.classList.toggle('drafting', inDraft && riding);

    // Cones. Hits are swept over the frame's movement so nothing tunnels through at low frame rates.
    for (const c of cones) {
      if (!c.live) continue;
      c.z += move;
      if (c.z > 14) { c.live = false; c.mesh.visible = false; continue; }
      c.mesh.position.z = c.z;
      if (c.hit) { c.mesh.rotation.x += dt * 8; c.mesh.position.y = Math.max(0, c.mesh.position.y + c.vy * dt); c.vy -= 20 * dt; c.mesh.position.x += c.vx * dt; }
      else if (riding && Math.abs(LANES[c.lane] - S.px) < 1.1 && c.z > -0.7 && c.z - move < 0.7 && S.invuln <= 0) { c.hit = true; c.vy = 6; c.vx = (Math.random() - 0.5) * 6; crash(null); }
    }
    // Pickups.
    for (const p of pickups) {
      if (!p.live) continue;
      p.z += move;
      if (p.z > 14) { p.live = false; p.mesh.visible = false; continue; }
      p.spin += dt;
      const m = p.mesh.userData.model;
      p.mesh.position.z = p.z;
      if (p.kind === 'ring') m.rotation.y = 0; else { m.rotation.y = p.spin * 2.4; m.position.y = 0.85 + Math.sin(p.spin * 4) * 0.12; }
      if (riding && !p.got && Math.abs(LANES[p.lane] - S.px) < 1.3 && p.z > -0.8 && p.z - move < 0.8) collect(p);
      if (p.got) { p.mesh.scale.multiplyScalar(1 - dt * 6); p.mesh.position.y += dt * 4; if (p.mesh.scale.x < 0.05) { p.live = false; p.mesh.visible = false; } }
    }
    // Props and the finish arch.
    if (S.km > FINISH_KM - 0.5 || S.over === 'finish') {
      arch.visible = true;
      if (S.over !== 'finish') arch.position.z = -(FINISH_KM - S.km) / KM_PER_M;
      else arch.position.z += move;
    }
    if (S.phase === 'ride' || S.phase === 'over') hud();
  }

  function crash(r) {
    S.crashes++;
    S.speed *= 0.45;
    S.energy -= 10;
    S.combo = 0;
    S.invuln = 1.3;
    S.grace = 2;
    S.shake = 0.45;
    if (r) { r.hit = true; r.lane = [r.lane - 1, r.lane + 1].find(l => l >= 0 && l <= 2) ?? r.lane; }
    pop('Crash! −10 energy', 'bad');
    haptic([60, 30, 60]);
    sfx.trap();
    root.classList.remove('hurt'); void root.offsetWidth; root.classList.add('hurt');
    if (tutorial) tip('crash', 'Swerve around riders and cones: tap the side you want to go', true);
  }
  function collect(p) {
    p.got = true;
    const e0 = S.energy;
    if (p.kind === 'gel' || p.kind === 'bottle') S.fuel = (S.fuel || 0) + 1;
    if (p.kind === 'gel') { S.energy = Math.min(S.tank, S.energy + 32); pop(`Gel +${Math.round(S.energy - e0)}`, 'fuel'); sfx.step(); }
    else if (p.kind === 'bottle') { S.energy = Math.min(S.tank, S.energy + (S.zone === 'energylab' ? 26 : 16)); pop(`Bottle +${Math.round(S.energy - e0)}`, 'fuel'); sfx.step(); }
    else if (p.kind === 'ring') { S.rings++; S.boost = 1.4; addCombo(15, 'Ring · boost'); }
    else if (p.kind === 'shell') { S.shells++; S.bonus += 150; pop('Golden shell +5', 'medal'); sfx.done(); }
    haptic(12);
  }

  function render(dt) {
    amb.set({ wind: FX.wind * (S.zone === 'hawi' ? 1.3 : 0.7), surf: S.zone === 'queenk' ? 0.5 : 0.25, birds: 0.4, crowd: S.zone === 'alii' ? 1 : 0, rain: FX.rain, speed: S.phase === 'ride' ? S.speed / 32 : 0, night: false });
    // Chase camera: behind and above, drifting with the lane; wider and lower as speed builds.
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt);
    course.chase(S.px, Math.min(1, S.speed / 45), dt, { tuck: S.tuck, shake: S.shake, fovKick: S.boost > 0 ? 6 : 0 });
    scene.fog.near = S.zone === 'energylab' ? 40 : 60;
    course.render();
  }

  function exit(to) {
    if (!alive) return;
    alive = false;
    cancelAnimationFrame(raf);
    removeEventListener('keydown', onKey);
    removeEventListener('keyup', onKey);
    document.removeEventListener('visibilitychange', onHide);
    course.dispose();
    amb.set({ speed: 0, crowd: 0 });
    root.remove();
    document.body.classList.remove('in-challenge');
    if (to === 'garage') onGarage?.(); else onExit?.();
  }

  reset();
  raf = requestAnimationFrame(frame);
  // Handles for automated play-tests.
  return {
    get state() { const { tips, ...rest } = S; return { ...rest, riders: riders.filter(r => r.live).map(r => ({ lane: r.lane, z: r.z, hit: !!r.hit })), cones: cones.filter(c => c.live && !c.hit).map(c => ({ lane: c.lane, z: c.z })), pickups: pickups.filter(q => q.live && !q.got).map(q => ({ kind: q.kind, lane: q.lane, z: q.z })) }; },
    left: () => steer(-1), right: () => steer(1), tuck: setTuck, pause: togglePause, again, exit,
    skip(km) { S.km = km; },
    get result() { return lastResult; },
    get drawCalls() { return renderer.info.render.calls; },
  };
}

// Claim a finished daily mission (also used by the home screen). Returns what was paid, or null.
export function claimRushMission(id, rewards) {
  const g = validGarage(readSection('garage'));
  const m = g.missions?.day === hstDay() ? g.missions.list.find(x => x.id === id) : null;
  if (!m || !m.done || m.claimed) return null;
  const paid = rewards?.grantOnce(`rush:mission:${g.missions.day}:${id}`, { xp: m.reward, credits: m.reward, reason: `Mission: ${m.text}` });
  m.claimed = true;
  writeSection('garage', g);
  return paid || { credits: 0 };
}
