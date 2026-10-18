// The Ride Map: the Kona bike course as a winding path of levels, one skill per stop, stars under each.
// Tap an open level to play it; the next one to beat pulses. Kona Rush (endless) waits at the end of the road.
import { readSection } from './save.js';
import { LEVELS, isUnlocked, totalStars, nextLevel, MAX_STARS } from './rideLevels.js';
import { esc } from './rideKit.js';
import { haptic } from './appShell.js';

const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>';
const XS = [30, 68, 40, 72, 30, 64, 36, 70];                        // node x (%) so the road winds

export function showRideMap({ rewards, onLevel, onRush, onBack }) {
  document.getElementById('ridemap')?.remove();
  const levels = readSection('levels') || {};
  const next = nextLevel(levels);
  const st = rewards?.state || { credits: 0 };
  const rush = readSection('garage') || {};
  const root = document.createElement('div');
  root.id = 'ridemap';
  const STEP = 132, TOP = 150, h = TOP + LEVELS.length * STEP + 170;
  const pts = LEVELS.map((l, i) => ({ x: XS[i], y: TOP + i * STEP }));
  const path = pts.map((p, i) => (i ? `S ${(pts[i - 1].x + p.x) / 2 + (i % 2 ? 18 : -18)} ${p.y - STEP / 2} ${p.x} ${p.y}` : `M ${p.x} ${p.y}`)).join(' ');
  root.innerHTML = `
    <header class="rm-top">
      <button type="button" class="rm-back" id="rmBack" aria-label="Back">‹</button>
      <div><b>Ride Map</b><span>Kona bike course</span></div>
      <div class="rm-chips"><span class="rm-chip">${STAR}<b>${totalStars(levels)}</b>/${MAX_STARS}</span><span class="rm-chip"><b>${(st.credits || 0).toLocaleString()}</b> Cr</span></div>
    </header>
    <div class="rm-scroll"><div class="rm-road" style="height:${h}px">
      <svg class="rm-path" viewBox="0 0 100 ${h}" preserveAspectRatio="none"><path d="${path} L ${pts[pts.length - 1].x} ${h - 90}" /></svg>
      ${LEVELS.map((l, i) => {
        const open = isUnlocked(levels, l.id), rec = levels[l.id], stars = rec?.stars || 0, isNext = next?.id === l.id;
        return `<button type="button" class="rm-node ${open ? 'open' : 'locked'} ${isNext ? 'next' : ''} z-${l.zone}" data-id="${l.id}" style="left:${pts[i].x}%;top:${pts[i].y}px" aria-label="Level ${l.n}: ${esc(l.name)}${open ? '' : ' (locked)'}">
          <span class="rm-disc"><span class="rm-icon">${open ? l.icon : '🔒'}</span><em>${l.n}</em></span>
          <span class="rm-stars">${[1, 2, 3].map(k => `<i class="${stars >= k ? 'on' : ''}">${STAR}</i>`).join('')}</span>
          <span class="rm-name">${esc(l.name)}</span><span class="rm-skill">${esc(l.skill)} · ${esc(l.where.split(' · ')[0])}</span>
          ${isNext ? '<span class="rm-play">PLAY</span>' : ''}
        </button>`;
      }).join('')}
      <button type="button" class="rm-rush" id="rmRush" style="top:${h - 110}px"><b>Kona Rush</b><span>Endless · best ${(rush.best || 0).toLocaleString()}</span></button>
    </div></div>
    <p class="rm-toast" id="rmToast"></p>`;
  document.body.appendChild(root);
  const close = () => root.remove();
  root.querySelector('#rmBack').onclick = () => { close(); onBack?.(); };
  root.querySelector('#rmRush').onclick = () => { close(); onRush?.(); };
  root.querySelectorAll('.rm-node').forEach(b => b.addEventListener('click', () => {
    const l = LEVELS.find(x => x.id === b.dataset.id);
    if (!isUnlocked(levels, l.id)) {
      const t = root.querySelector('#rmToast');
      t.textContent = `Earn a star on Level ${l.n - 1} to open ${l.name}`;
      t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2200);
      haptic([20, 40, 20]);
      return;
    }
    haptic(12);
    close();
    onLevel?.(l.id);
  }));
  // Scroll the next level into view.
  const n = root.querySelector('.rm-node.next');
  if (n) requestAnimationFrame(() => n.scrollIntoView({ block: 'center' }));
  return { close };
}
