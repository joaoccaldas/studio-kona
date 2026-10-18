// The frame every ride mini-game runs in: intro card (what, where, skill, how), 3-2-1, HUD (score, meters, the call,
// action buttons, pops), pause, and the 3-star result with rewards, Retry, Next level and the Map.
// A game module only brings its rules and its scene: { scene: '3d' | '2d', create(ctx) → { step, render?, down?, move?, up?, key?, debug? } }.
import * as THREE from 'three';
import { createCourse, makeRider, esc } from './rideKit.js';
import { haptic } from './appShell.js';
import { createSfx, confetti } from './aptFx.js';
import { readSection, writeSection } from './save.js';
import { levelById, recordLevel, isUnlocked, STAR_REWARD, starKey, LEVELS } from './rideLevels.js';
import { weatherNow, effects } from './weather.js';
import { ambience } from './ambience.js';
import { liveChallenge, liveKey } from './konaToday.js';

const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>';

export async function runLevel({ id, game, player, rewards, onExit }) {
  const level = levelById(id);
  const root = document.createElement('div');
  root.id = 'mg';
  root.className = `mg-${id}`;
  root.innerHTML = `
    <canvas id="mgCanvas"></canvas>
    <div class="mg-top">
      <div class="mg-title"><b>${level.n}</b><div><strong>${esc(level.name)}</strong><span>${esc(level.skill)}</span></div></div>
      <div class="mg-right"><div class="mg-score" id="mgScore">0</div><button type="button" class="mg-pause" id="mgPause" aria-label="Pause">II</button></div>
    </div>
    <div class="mg-meters" id="mgMeters"></div>
    <div class="mg-call" id="mgCall"></div>
    <div class="mg-banner" id="mgBanner"></div>
    <div class="mg-tip" id="mgTip"></div>
    <div class="mg-count" id="mgCount"></div>
    <div class="mg-pops" id="mgPops"></div>
    <div class="mg-actions" id="mgActions"></div>
    <section class="mg-sheet" id="mgSheet" hidden role="dialog" aria-modal="true"></section>`;
  document.body.appendChild(root);
  document.body.classList.add('in-challenge');
  const $ = s => root.querySelector(s);
  const canvas = $('#mgCanvas');
  const sfx = createSfx();

  // ---------------------------------------------------------------- HUD helpers handed to the game
  const meters = new Map();
  let popN = 0, tipT = 0, banT = 0;
  const hud = {
    score(v, fmt) { $('#mgScore').textContent = fmt ? fmt(v) : String(v); },
    meter(key, { label, value = 0, band = null, danger = false, color } = {}) {
      let m = meters.get(key);
      if (!m) {
        m = document.createElement('div');
        m.className = 'mg-meter';
        m.innerHTML = `<span></span><div><em></em><i></i></div>`;
        $('#mgMeters').appendChild(m);
        meters.set(key, m);
      }
      m.querySelector('span').textContent = label;
      const bar = m.querySelector('i'), zone = m.querySelector('em');
      bar.style.width = `${Math.max(0, Math.min(1, value)) * 100}%`;
      if (color) bar.style.background = color;
      zone.style.display = band ? 'block' : 'none';
      if (band) { zone.style.left = `${band[0] * 100}%`; zone.style.width = `${(band[1] - band[0]) * 100}%`; }
      m.classList.toggle('danger', !!danger);
    },
    call(html) { const el = $('#mgCall'); el.innerHTML = html || ''; el.classList.toggle('on', !!html); },
    tip(text, bad = false, ms = 2600) {
      const el = $('#mgTip');
      el.textContent = text; el.classList.toggle('bad', bad); el.classList.add('on');
      clearTimeout(tipT); tipT = setTimeout(() => el.classList.remove('on'), ms);
    },
    pop(text, cls = '', x = null, y = null) {
      const el = document.createElement('div');
      el.className = 'mg-pop ' + cls;
      el.textContent = text;
      el.style.left = x != null ? `${x}px` : `${46 + ((popN++ % 3) - 1) * 12}%`;
      if (y != null) el.style.top = `${y}px`;
      $('#mgPops').appendChild(el);
      setTimeout(() => el.remove(), 950);
    },
    banner(title, sub) {
      const el = $('#mgBanner');
      el.innerHTML = `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`;
      el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
      clearTimeout(banT); banT = setTimeout(() => el.classList.remove('on'), 1900);
    },
    // A big thumb button. handlers: { down, up }. Returns the element.
    button(key, label, { down, up, cls = '' } = {}) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `mg-act ${cls}`;
      b.dataset.key = key;
      b.innerHTML = label;
      b.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); b.setPointerCapture(ev.pointerId); b.classList.add('held'); if (phase === 'play' && !paused) down?.(ev); });
      const release = ev => { b.classList.remove('held'); if (phase === 'play') up?.(ev); };
      b.addEventListener('pointerup', release);
      b.addEventListener('pointercancel', release);
      $('#mgActions').appendChild(b);
      return b;
    },
    flash(color = '#fff') { root.style.setProperty('--flash', color); root.classList.remove('flash'); void root.offsetWidth; root.classList.add('flash'); },
    shake() { root.classList.remove('hurt'); void root.offsetWidth; root.classList.add('hurt'); },
  };

  // ---------------------------------------------------------------- scene (3D games get the shared course and a rider)
  let course = null, me = null;
  if (game.scene !== '2d') {
    course = createCourse({ canvas, zone: level.zone, shoreX: game.shoreX ?? -36 });
    me = makeRider(player?.look?.suit || '#2E6F73', 0xfbf8f2, true);
    me.scale.setScalar(1.15);
    course.scene.add(me);
  }

  let phase = 'intro', paused = false, t = 0, result = null;
  const ctx = {
    level, player, course, me, root, $, hud, sfx, haptic, THREE,
    scene: course?.scene, camera: course?.camera, canvas,
    get t() { return t; }, get phase() { return phase; },
    end: (score, extra = {}) => finish(score, extra),
  };
  const g = game.create(ctx);
  // Sound of the place, following today's weather.
  const fx = effects(), amb = ambience();
  amb.set({ wind: fx.wind * (id === 'crosswind' ? 1.3 : 0.7), surf: id === 'honu' ? 1 + fx.surf * 0.4 : 0.3, birds: 0.5, crowd: id === 'highfive' ? 1 : id === 'handoff' ? 0.45 : 0, rain: fx.rain, speed: 0, night: false });
  root.classList.add('vignette');

  // ---------------------------------------------------------------- intro → countdown → play
  function intro() {
    const rec = validRecord();
    const sh = $('#mgSheet');
    sh.innerHTML = `
      <div class="mg-intro-head"><span class="mg-icon">${level.icon}</span><div><p class="mg-eyebrow">Level ${level.n} · ${esc(level.where)}</p><h2>${esc(level.name)}</h2></div></div>
      <p class="mg-skill">Skill: <b>${esc(level.skill)}</b></p>
      <p class="mg-live">${liveLine()}</p>
      <p class="mg-blurb">${esc(level.blurb)}</p>
      <ol class="mg-how">${level.how.map(h => `<li>${esc(h)}</li>`).join('')}</ol>
      <div class="mg-targets">${level.stars.map((s, i) => `<div class="${(rec?.stars || 0) > i ? 'got' : ''}"><span class="st">${STAR.repeat(i + 1)}</span><b>${level.better === 'low' ? '≤ ' : ''}${s}</b><span>${esc(level.unit)}</span></div>`).join('')}</div>
      ${rec?.best != null ? `<p class="mg-best">Your best: <b>${fmtScore(rec.best)}</b></p>` : ''}
      <div class="mg-row"><button type="button" class="mg-primary" data-a="start">Start</button></div>
      <div class="mg-row"><button type="button" class="mg-ghost" data-a="map">Back to map</button></div>`;
    sh.hidden = false;
    root.classList.add('sheet-open');
  }
  let countT = 0;
  function start() {
    sfx.unlock();
    $('#mgSheet').hidden = true;
    root.classList.remove('sheet-open');
    phase = 'count';
    countT = 3.2;
  }
  function liveLine() {
    const w = weatherNow(), s = w.live ? 'Live in Kona' : 'Typical Kona';
    if (id === 'crosswind') return `${w.icon} ${s}: Hāwī wind ${Math.round(w.hawi.windKmh)} km/h, gusts ${Math.round(w.hawi.gustKmh)}. Your gusts follow it.`;
    if (id === 'heat') return `${w.icon} ${s}: the Energy Lab feels like ${Math.round(w.lab.feelsC)} °C. Your heat follows it.`;
    if (id === 'honu') return `${w.icon} ${s}: waves ${w.sea.waveM.toFixed(1)} m, sea ${w.sea.seaC.toFixed(1)} °C.`;
    return `${w.icon} ${s}: ${Math.round(w.kailua.tempC)} °C, ${w.desc.toLowerCase()}, wind ${w.windLabel}.`;
  }
  const lc = liveChallenge();
  const fmtScore = v => (level.unit === 's' ? `${v.toFixed(1)} s` : level.unit === '%' ? `${Math.round(v)}%` : `${Math.round(v)} ${level.unit}`);
  const validRecord = () => readSection('levels')?.[id] || null;

  // ---------------------------------------------------------------- result
  function finish(score, { title, note, failed } = {}) {
    if (phase === 'over') return;
    phase = 'over';
    score = Math.round(score * 10) / 10;
    const before = readSection('levels') || {};
    const r = recordLevel(before, id, failed ? (level.better === 'low' ? 9999 : 0) : score);
    writeSection('levels', r.levels);
    let credits = 0;
    for (const k of r.newStars) credits += rewards?.grantOnce(starKey(id, k), { ...STAR_REWARD[k], reason: `${level.name} · ${k} star${k > 1 ? 's' : ''}` })?.credits || 0;
    credits += rewards?.grant({ xp: 10 + r.stars * 10, credits: 5 + r.stars * 5, reason: `${level.name}` })?.credits || 0;
    const liveBonus = !failed && r.stars >= 1 && lc.id === id ? rewards?.grantOnce(liveKey(), { xp: 60, credits: 40, reason: 'Live challenge' }) : null;
    credits += liveBonus?.credits || 0;
    const nextL = LEVELS[level.n];
    const unlockedNow = nextL && !isUnlocked(before, nextL.id) && isUnlocked(r.levels, nextL.id);
    result = { score, stars: r.stars, newStars: r.newStars, pb: r.pb, credits, failed: !!failed };
    if (r.stars >= 2) { confetti(root); sfx.done(); haptic([20, 60, 20, 60, 40]); } else haptic(40);
    setTimeout(() => {
      const sh = $('#mgSheet');
      sh.innerHTML = `
        <p class="mg-eyebrow">${esc(note || level.where)}</p>
        <h2>${esc(title || (r.stars === 3 ? 'Perfect!' : r.stars === 2 ? 'Great ride!' : r.stars === 1 ? 'Cleared!' : 'Not quite'))}</h2>
        <div class="mg-stars">${[1, 2, 3].map(k => `<i class="${r.stars >= k ? 'on' : ''} ${r.newStars.includes(k) ? 'new' : ''}" style="animation-delay:${k * 0.22}s">${STAR}</i>`).join('')}</div>
        <div class="mg-score-big"><b>${failed ? '—' : fmtScore(score)}</b>${r.pb ? '<em>New best!</em>' : ''}</div>
        <p class="mg-next-star">${r.stars < 3 ? `Next star at ${level.better === 'low' ? '≤ ' : ''}${fmtScore(level.stars[r.stars])}` : 'All three stars'}</p>
        <p class="mg-earn">+${credits} Credits${r.newStars.length ? ` · ${r.newStars.length} new star${r.newStars.length > 1 ? 's' : ''}` : ''}</p>
        ${liveBonus ? '<p class="mg-unlock live">⚡ Today’s live challenge complete</p>' : ''}
        ${unlockedNow ? `<p class="mg-unlock">Unlocked: Level ${nextL.n} · ${esc(nextL.name)} ${nextL.icon}</p>` : ''}
        <div class="mg-row"><button type="button" class="mg-primary" data-a="retry">Try again</button>
          ${nextL && isUnlocked(r.levels, nextL.id) ? `<button type="button" class="mg-primary alt" data-a="next">Next level</button>` : ''}</div>
        <div class="mg-row"><button type="button" class="mg-ghost" data-a="map">Map</button></div>`;
      sh.hidden = false;
      root.classList.add('sheet-open');
    }, 700);
  }

  // ---------------------------------------------------------------- pause and buttons
  function togglePause(force) {
    if (phase !== 'play' && phase !== 'count') return;
    paused = force ?? !paused;
    const sh = $('#mgSheet');
    if (!paused) { sh.hidden = true; root.classList.remove('sheet-open'); return; }
    sh.innerHTML = `<h2>Paused</h2><p class="mg-eyebrow">${esc(level.name)}</p>
      <div class="mg-row"><button type="button" class="mg-primary" data-a="resume">Resume</button></div>
      <div class="mg-row"><button type="button" class="mg-ghost" data-a="retry">Restart</button><button type="button" class="mg-ghost" data-a="map">Map</button></div>`;
    sh.hidden = false;
    root.classList.add('sheet-open');
  }
  $('#mgPause').addEventListener('click', () => togglePause());
  const onHide = () => { if (document.hidden && phase === 'play') togglePause(true); };
  document.addEventListener('visibilitychange', onHide);
  $('#mgSheet').addEventListener('click', ev => {
    const a = ev.target.closest('[data-a]')?.dataset.a;
    if (a === 'start') start();
    else if (a === 'resume') togglePause(false);
    else if (a === 'retry') exit({ to: 'level', id });
    else if (a === 'next') exit({ to: 'level', id: LEVELS[level.n].id });
    else if (a === 'map') exit({ to: 'map' });
  });

  // ---------------------------------------------------------------- input forwarded to the game
  const live = () => phase === 'play' && !paused;
  canvas.addEventListener('pointerdown', ev => { sfx.unlock(); canvas.setPointerCapture(ev.pointerId); if (live()) g.down?.(ev); });
  canvas.addEventListener('pointermove', ev => { if (live()) g.move?.(ev); });
  canvas.addEventListener('pointerup', ev => { if (live()) g.up?.(ev); });
  canvas.addEventListener('pointercancel', ev => { if (live()) g.up?.(ev); });
  const held = new Set();
  function onKey(ev) {
    const k = ev.key.toLowerCase(), down = ev.type === 'keydown';
    if (down && held.has(k)) return;
    if (down) held.add(k); else held.delete(k);
    if (down && (k === 'escape' || k === 'p')) { togglePause(); return; }
    if (down && k === 'enter' && phase === 'intro') { start(); return; }
    if (live()) g.key?.(k, down, ev);
  }
  addEventListener('keydown', onKey);
  addEventListener('keyup', onKey);

  // ---------------------------------------------------------------- loop
  let raf = 0, last = performance.now(), alive = true;
  function frame(now) {
    if (!alive) return;
    const rdt = Math.min(0.25, (now - last) / 1000), dt = Math.min(0.05, rdt);   // rdt: real time, for stopwatch games
    last = now;
    if (!paused) {
      if (phase === 'count') {
        countT -= dt;
        const n = Math.ceil(countT - 0.2), txt = n > 0 ? String(n) : 'GO!';
        const el = $('#mgCount');
        if (el.textContent !== txt) { el.textContent = txt; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); sfx.step(); }
        if (countT <= 0) { phase = 'play'; g.start?.(); setTimeout(() => { if (el.textContent === 'GO!') el.textContent = ''; }, 500); }
      }
      if (phase === 'play') { t += dt; g.step(dt, rdt); }
      else if (g.idle) g.idle(dt);
      else if (course) course.chase(me.position.x, 0, dt);
    }
    course?.tick(dt);
    amb.set({ speed: phase === 'play' ? (course?.speedNow || 0) / 32 : 0 });
    if (g.render) g.render(dt); else course?.render();
    raf = requestAnimationFrame(frame);
  }

  function exit(next = { to: 'map' }) {
    if (!alive) return;
    alive = false;
    cancelAnimationFrame(raf);
    removeEventListener('keydown', onKey);
    removeEventListener('keyup', onKey);
    document.removeEventListener('visibilitychange', onHide);
    g.dispose?.();
    amb.set({ speed: 0, crowd: 0 });
    course?.dispose();
    root.remove();
    document.body.classList.remove('in-challenge');
    onExit?.(next);
  }

  intro();
  raf = requestAnimationFrame(frame);
  return {
    level, start, exit, pause: togglePause,
    get phase() { return phase; }, get result() { return result; },
    get state() { return g.debug?.() || {}; }, game: g,
    get drawCalls() { return course?.renderer.info.render.calls ?? 0; },
  };
}
