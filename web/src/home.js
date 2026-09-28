// Home: the hub you land on. One big PLAY (Kona Rush, instant, no sign-up), today's missions, the garage where
// Credits become upgrades, the daily streak, the Race Week story and "Install the app".
import { readSection, writeSection } from './save.js';
import { hstDay, nextHstMidnight } from './clock.js';
import { UPGRADES, MAX_LEVEL, nextCost, buy, missionsFor, validGarage, MEDALS } from './rushRules.js';
import { claimRushMission } from './rush.js';
import { canInstall, offerInstall, haptic } from './appShell.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtN = n => (Number.isInteger(n) ? n : n.toFixed(1));

export function showHome({ rewards, player, onPlay, onStory, onChallenge, focus }) {
  document.getElementById('home')?.remove();
  const root = document.createElement('div');
  root.id = 'home';
  document.body.appendChild(root);
  document.body.classList.add('at-home');

  // Daily check-in: the streak and its gift, once per Hawaiʻi day.
  const gift = rewards?.checkIn?.();

  function garage() {
    const g = validGarage(readSection('garage'));
    if (!g.missions || g.missions.day !== hstDay()) { g.missions = missionsFor(); writeSection('garage', g); }
    return g;
  }
  const hoursLeft = () => Math.max(1, Math.round((nextHstMidnight() - Date.now()) / 3600000));

  function render() {
    const g = garage();
    const st = rewards?.state || { credits: 0, streak: 0 };
    const medal = g.best ? (g.totalKm && g.zonesSeen >= 4 ? 'All zones seen' : `${g.zonesSeen}/4 zones seen`) : 'Ride from the lava fields to Aliʻi Drive';
    root.innerHTML = `
      <div class="hm">
        <header class="hm-top">
          <div class="hm-chip" title="Daily streak"><b>${st.streak || 0}</b><span>day streak</span></div>
          <div class="hm-chip" title="Credits"><b id="hmCredits">${(st.credits || 0).toLocaleString()}</b><span>Credits</span></div>
        </header>
        <section class="hm-hero">
          <img src="icons/logo-512.png" alt="" width="96" height="96">
          <p class="hm-eyebrow">Kailua-Kona · Hawaiʻi</p>
          <h1>Kona Rush</h1>
          <p class="hm-sub">${esc(medal)}</p>
          ${g.best ? `<p class="hm-best">Best <b>${g.best.toLocaleString()}</b> · ${g.runs} run${g.runs === 1 ? '' : 's'}</p>` : ''}
          <button type="button" class="hm-play" id="hmPlay">${g.runs ? 'Ride again' : 'Play'}</button>
          <p class="hm-how">Tap left / right to change lanes · hold to tuck · stay out of the coral draft zones</p>
        </section>
        ${gift ? `<p class="hm-gift">${gift.first ? 'Welcome to Kona' : `Day ${gift.streak} streak`} · +${gift.credits} Credits${gift.items?.length ? ' and a gift' : ''}</p>` : ''}
        <section class="hm-card" id="hmMissions">
          <h2>Today's missions <span>new in ${hoursLeft()} h</span></h2>
          <ul>${g.missions.list.map(m => `<li class="${m.done ? 'done' : ''}">
            <div><span>${esc(m.text)}</span><div class="bar"><i style="width:${Math.min(100, (m.progress / m.target) * 100)}%"></i></div></div>
            ${m.done && !m.claimed ? `<button type="button" data-claim="${esc(m.id)}">Claim +${m.reward}</button>` : m.claimed ? '<em>Done</em>' : `<em>${fmtN(m.progress)}/${fmtN(m.target)}</em>`}
          </li>`).join('')}</ul>
        </section>
        <section class="hm-card" id="hmGarage">
          <h2>Garage <span>upgrades you feel next run</span></h2>
          <ul>${Object.entries(UPGRADES).map(([k, u]) => {
            const lvl = g.levels[k] | 0, cost = nextCost(k, lvl), can = cost != null && (st.credits || 0) >= cost;
            return `<li><div><b>${esc(u.name)}</b><span>${esc(u.what)}</span>
              <div class="pips">${Array.from({ length: MAX_LEVEL }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div>
              ${cost == null ? '<em>Max</em>' : `<button type="button" data-buy="${k}" ${can ? '' : 'disabled'}>${cost.toLocaleString()}</button>`}</li>`;
          }).join('')}</ul>
        </section>
        <section class="hm-more">
          <button type="button" id="hmStory"><b>Race Week</b><span>${player ? 'Continue your Kona story' : 'Pack, fly to Kona, live the week'}</span></button>
          <button type="button" id="hmT1"><b>Transition Tangle</b><span>T1 speed challenge</span></button>
          ${canInstall() ? '<button type="button" id="hmInstall"><b>Install the app</b><span>Full screen, on your home screen</span></button>' : ''}
        </section>
        <p class="hm-foot">Medals: bronze ${MEDALS.bronze} km · silver ${MEDALS.silver} km · gold ${MEDALS.gold} km · finish ${MEDALS.finish} km</p>
      </div>`;
    root.querySelector('#hmPlay').onclick = () => { haptic(12); close(); onPlay?.(); };
    root.querySelector('#hmStory').onclick = () => { close(); onStory?.(); };
    root.querySelector('#hmT1').onclick = () => { close(); onChallenge?.('transition_tangle'); };
    root.querySelector('#hmInstall')?.addEventListener('click', offerInstall);
    root.querySelectorAll('[data-claim]').forEach(b => b.addEventListener('click', () => { if (claimRushMission(b.dataset.claim, rewards)) { haptic(20); render(); } }));
    root.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => {
      const next = buy(garage(), b.dataset.buy, rewards);
      if (!next) return;
      writeSection('garage', next);
      haptic([10, 30, 10]);
      render();
      root.querySelector(`[data-buy="${b.dataset.buy}"]`)?.closest('li')?.classList.add('bought');
    }));
  }
  function close() { root.remove(); document.body.classList.remove('at-home'); }
  render();
  if (focus === 'garage') root.querySelector('#hmGarage')?.scrollIntoView({ block: 'center' });
  return { close, render };
}
