// Island Map and Passport: the Big Island (and a Kailua town close-up) with a pin for every famous place.
// Tap a pin for its story; "Travel" drops you nearby so you can walk up and discover it. Stamps fill the passport.
import { esc } from './rideKit.js';
import { haptic } from './appShell.js';

export function showIslandMap({ landmarks, isl, core, player, base = 'assets/', onTravel, onClose }) {
  document.getElementById('islmap')?.remove();
  const root = document.createElement('div');
  root.id = 'islmap';
  const list = landmarks.list;
  const town = list.filter(l => l.area === 'Kailua');
  const views = {
    island: { img: base + 'island_color.jpg', x0: isl.x0, y0: isl.y0, size: isl.size, zoom: 2.6, cx: -8000, cy: 12000 },
    town: { img: base + 'sat_core.jpg', x0: core.center[0] - core.half, y0: core.center[1] - core.half, size: core.half * 2, zoom: 1.6, cx: 60, cy: 20 },
  };
  let view = Math.abs(player.x) < 900 && Math.abs(player.y) < 900 ? 'town' : 'island';
  root.innerHTML = `
    <header class="im-top">
      <button type="button" class="im-back" aria-label="Close map">‹</button>
      <div><b>Island Map</b><span>Passport ${landmarks.found} / ${list.length} stamps</span></div>
      <div class="im-tabs"><button type="button" data-v="island">Island</button><button type="button" data-v="town">Kailua</button></div>
    </header>
    <div class="im-map"><div class="im-inner"><img alt=""><div class="im-pins"></div></div></div>
    <section class="im-card" hidden></section>
    <section class="im-passport"><h3>Island Passport</h3><div class="im-stamps">${list.map(l => `<button type="button" class="im-stamp ${l.found ? 'on' : ''}" data-id="${l.id}"><span>${l.found ? l.icon : '?'}</span><em>${l.found ? esc(l.name) : esc(l.area)}</em></button>`).join('')}</div></section>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);
  const mapEl = $('.im-map'), inner = $('.im-inner'), img = $('.im-inner img'), pins = $('.im-pins'), card = $('.im-card');

  function render() {
    const v = views[view];
    root.querySelectorAll('.im-tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === view));
    img.src = v.img;
    const S = Math.round(Math.min(mapEl.clientWidth, 520) * v.zoom);
    inner.style.width = inner.style.height = `${S}px`;
    const toPx = (x, y) => [((x - v.x0) / v.size) * S, (1 - (y - v.y0) / v.size) * S];
    const inside = l => l.x >= v.x0 && l.x <= v.x0 + v.size && l.y >= v.y0 && l.y <= v.y0 + v.size;
    const shown = view === 'island' ? list.filter(l => l.area !== 'Kailua').concat([{ id: '_town', icon: '🏝️', name: 'Kailua town', x: 60, y: 20, found: true, cluster: true }]) : town;
    pins.innerHTML = shown.filter(inside).map(l => { const [x, y] = toPx(l.x, l.y); return `<button type="button" class="im-pin ${l.found ? 'on' : ''} ${l.cluster ? 'cluster' : ''}" data-id="${l.id}" style="left:${x}px;top:${y}px"><span><b>${l.found ? l.icon : '?'}</b></span>${l.cluster ? '<em>Kailua town</em>' : ''}</button>`; }).join('')
      + (() => { const [x, y] = toPx(player.x, player.y); return `<i class="im-me" style="left:${x}px;top:${y}px;transform:translate(-50%,-50%) rotate(${player.heading || 0}rad)"></i>`; })();
    // Centre on the player when they are on this map, else on its default centre.
    const on = player.x >= v.x0 && player.x <= v.x0 + v.size && player.y >= v.y0 && player.y <= v.y0 + v.size;
    const [cx, cy] = on ? toPx(player.x, player.y) : toPx(v.cx, v.cy);
    requestAnimationFrame(() => { mapEl.scrollLeft = cx - mapEl.clientWidth / 2; mapEl.scrollTop = cy - mapEl.clientHeight / 2; });
  }
  function open(id) {
    if (id === '_town') { view = 'town'; render(); return; }
    const l = list.find(x => x.id === id);
    if (!l) return;
    haptic(10);
    const km = Math.hypot(l.x - player.x, l.y - player.y) / 1000;
    card.innerHTML = `
      <div class="im-card-head"><span class="im-ico">${l.found ? l.icon : '?'}</span><div><p>${esc(l.area)} · ${km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`} away</p><h2>${l.found ? esc(l.name) : 'Undiscovered place'}</h2></div></div>
      <p class="im-fact">${l.found ? esc(l.fact) : 'Travel close, then walk up to it to discover it and earn its passport stamp.'}</p>
      <div class="im-row"><button type="button" class="im-go">${l.found ? 'Travel here' : 'Travel nearby'}</button><button type="button" class="im-x">Close</button></div>`;
    card.hidden = false;
    card.querySelector('.im-go').onclick = () => { close(); onTravel?.(l); };
    card.querySelector('.im-x').onclick = () => { card.hidden = true; };
  }
  function close() { root.remove(); onClose?.(); }
  $('.im-back').onclick = close;
  root.querySelectorAll('.im-tabs button').forEach(b => b.onclick = () => { view = b.dataset.v; card.hidden = true; render(); });
  pins.addEventListener('click', ev => { const id = ev.target.closest('[data-id]')?.dataset.id; if (id) open(id); });
  $('.im-stamps').addEventListener('click', ev => { const id = ev.target.closest('[data-id]')?.dataset.id; if (!id) return; const l = list.find(x => x.id === id); view = l.area === 'Kailua' ? 'town' : 'island'; render(); open(id); });
  render();
  return { close };
}

// The discovery moment: a card with the stamp, the story and the reward.
export function showDiscovery(l, paid, n, total) {
  document.getElementById('lmCard')?.remove();
  const el = document.createElement('div');
  el.id = 'lmCard';
  el.innerHTML = `<div class="lm-stamp">${l.icon}</div>
    <p class="lm-eyebrow">Discovered · ${esc(l.area)}</p>
    <h2>${esc(l.name)}</h2>
    <p class="lm-fact">${esc(l.fact)}</p>
    <p class="lm-reward">${paid ? `+${paid.xp} XP · +${paid.credits} Credits · ` : ''}Passport ${n} / ${total}</p>
    <button type="button">Keep exploring</button>`;
  document.body.appendChild(el);
  haptic([20, 50, 20]);
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 300); };
  el.querySelector('button').onclick = close;
  setTimeout(close, 9000);
}
