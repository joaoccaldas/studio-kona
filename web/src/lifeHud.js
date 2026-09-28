// HUD for the living island: wallet chip, island dispatch (what changed + what you earned), bag, next-day gate.
import { ITEMS, RARITY } from './rewards.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function chipFor(id) {
  const it = ITEMS[id];
  if (!it) return '';
  const r = RARITY[it.rarity];
  return `<span class="chip" style="border-color:${r.color}66"><span>${it.icon}</span>${esc(it.name)}<i style="color:${r.color}">${r.label}</i></span>`;
}

export function createLifeHud({ rewards, onUseTicket }) {
  const box = $('#dispatch');
  let closeCb = null;

  function wallet() {
    const st = rewards.state, lv = rewards.level;
    $('#wLevel').textContent = `Lv ${lv.level}`;
    $('#wCredits').textContent = st.credits.toLocaleString('en-US');
    $('#wStreak').textContent = st.streak > 1 ? `🔥${st.streak}` : '';
  }

  function levelBlock() {
    const lv = rewards.level, k = rewards.multiplier;
    const pct = Math.round(lv.into / lv.need * 100);
    return `<div class="d-level"><div style="display:flex;justify-content:space-between"><b style="color:var(--ink)">Level ${lv.level}</b>
      <span>${lv.into} / ${lv.need} XP${k > 1 ? ` · ×${k.toFixed(1)} streak boost` : ''}</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>`;
  }

  function rewardsBlock(g) {
    if (!g) return '';
    const chips = [];
    if (g.xp) chips.push(`<span class="chip">+${g.xp} XP</span>`);
    if (g.credits) chips.push(`<span class="chip">+${g.credits} Credits</span>`);
    for (const id of g.items || []) chips.push(chipFor(id));
    if (g.levelUp) chips.push(`<span class="chip" style="border-color:var(--gold)">Level ${g.levelUp}</span>`);
    return chips.length ? `<div class="d-rewards">${chips.join('')}</div>` : '';
  }

  function open(html, actions = [{ label: 'Explore', primary: true }], onClose = null) {
    box.innerHTML = html + `<div class="d-actions">${actions.map((a, i) =>
      `<button type="button" data-a="${i}" class="${a.primary ? 'primary' : ''}" ${a.disabled ? 'disabled' : ''}>${esc(a.label)}</button>`).join('')}</div>`;
    box.hidden = false;
    closeCb = onClose;
    box.querySelectorAll('[data-a]').forEach(b => {
      b.onclick = () => {
        const a = actions[Number(b.dataset.a)];
        if (a.run) a.run();
        if (!a.keep) close();
      };
    });
    box.querySelector('button.primary')?.focus({ preventScroll: true });
  }
  function close() {
    box.hidden = true;
    const cb = closeCb;
    closeCb = null;
    cb?.();
  }

  // What changed on the island, plus anything earned for it.
  function dispatch({ eyebrow, title, news = [], grant = null, note = '' }) {
    open(`<div class="d-eyebrow">${esc(eyebrow)}</div><h2 id="dTitle">${esc(title)}</h2>
      ${news.length ? `<ul>${news.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      ${rewardsBlock(grant)}${levelBlock()}${note ? `<p class="d-note">${esc(note)}</p>` : ''}`);
  }

  function bag({ shellsFound = 0, shellsTotal = 5 } = {}) {
    const st = rewards.state;
    const ids = Object.keys(st.items).filter(id => st.items[id] > 0 && ITEMS[id])
      .sort((a, b) => Object.keys(RARITY).indexOf(ITEMS[b].rarity) - Object.keys(RARITY).indexOf(ITEMS[a].rarity));
    const items = ids.map(id => {
      const it = ITEMS[id], r = RARITY[it.rarity];
      return `<div class="bag-item" style="border-color:${r.color}55"><b>${it.icon} ${esc(it.name)}${st.items[id] > 1 ? ` ×${st.items[id]}` : ''}</b>
        <span style="color:${r.color};font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase">${r.label}</span><small>${esc(it.text)}</small></div>`;
    }).join('');
    open(`<div class="d-eyebrow">Your week · ${st.days.length} day${st.days.length === 1 ? '' : 's'} played · streak ${st.streak}</div>
      <h2 id="dTitle">${st.credits.toLocaleString('en-US')} Credits</h2>${levelBlock()}
      <p class="d-note">Today's shells: ${shellsFound} of ${shellsTotal} found. They glow on beaches and in town, and move every day.
      Each day in a row adds 10% to everything you earn, up to 50%.</p>
      ${items ? `<div class="d-bag">${items}</div>` : '<p class="d-note">Your bag is empty. Find shells, spot honu and finish race-week days.</p>'}`,
    [{ label: 'Close', primary: true }]);
  }

  // The next race-week day is not open yet: come back tomorrow, or spend a ticket.
  function gate({ nextTitle, opensAt, onTicket }) {
    const tickets = rewards.state.items.ticket || 0;
    const hrs = Math.max(1, Math.round((opensAt - Date.now()) / 3600e3));
    open(`<div class="d-eyebrow">Day complete</div><h2 id="dTitle">${esc(nextTitle)} opens tomorrow</h2>
      <p class="d-note">A new race-week day opens each day you come back (in about ${hrs} h), and every day opens on its real
      Hawaiʻi date. The island changes with each one. Until then: find today's shells, spot honu, ride the Queen K.</p>
      <p class="d-note">You have ${tickets} Fast-forward ticket${tickets === 1 ? '' : 's'}.</p>`,
    [{ label: tickets ? 'Use a ticket now' : 'No tickets yet', primary: !!tickets, disabled: !tickets, run: () => { if (rewards.useTicket()) onTicket?.(); } },
      { label: 'Keep exploring', primary: !tickets }]);
  }

  // Small floating confirmation for pickups, without covering the view.
  let popT = 0;
  function pop(g, label) {
    if (!g) return;
    const parts = [label, g.xp ? `+${g.xp} XP` : '', g.credits ? `+${g.credits} Credits` : '', ...(g.items || []).map(id => `${ITEMS[id]?.icon || ''} ${ITEMS[id]?.name || id}`)].filter(Boolean);
    const t = $('#toast');
    t.textContent = parts.join(' · ');
    t.classList.add('on');
    clearTimeout(popT);
    popT = setTimeout(() => t.classList.remove('on'), 2600);
    if (g.levelUp) setTimeout(() => dispatch({ eyebrow: 'Level up', title: `Level ${g.levelUp}`, news: ['Higher levels open harder challenges and rarer finds.'] }), 900);
  }

  $('#wallet')?.addEventListener('click', () => bag({ shellsFound: rewards.shellsFoundToday(), shellsTotal: 5 }));
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) close(); });
  wallet();
  return { wallet, dispatch, bag, gate, pop, close, sheet: open, get open() { return !box.hidden; } };
}
