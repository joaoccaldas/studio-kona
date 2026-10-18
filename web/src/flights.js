// KOA board for the local day, from the Hawaii airports FlightView page, plus aircraft at the field.

export function mountFlights(opts = {}) {
  const btn = document.querySelector('#flightBtn');
  const sheet = document.querySelector('#flightSheet');
  const body = document.querySelector('#flightBody');
  const meta = document.querySelector('#flightMeta');
  if (!sheet || !body) return;

  // The live board needs the proxy in web/serve.py. It is only asked while the sheet is open, so static hosting
  // (GitHub Pages, Vercel) never requests it on load.
  let timer = 0;
  const open = () => { sheet.hidden = false; load(); clearInterval(timer); timer = setInterval(load, 120000); };
  const close = () => { sheet.hidden = true; clearInterval(timer); };
  btn?.addEventListener('click', open);
  sheet.querySelector('[data-close]')?.addEventListener('click', close);

  async function load() {
    body.textContent = 'Asking the live feed…';
    try {
      const res = await fetch('/api/koa-flights');
      if (!res.ok) throw new Error('offline');
      const data = await res.json();
      paintWorld(data);
      paintSheet(data);
    } catch (e) {
      body.textContent = 'The live KOA board is offline on this server. No flights are invented.';
      if (meta) meta.textContent = '';
    }
  }

  function paintSheet(data) {
    const rows = data.rows || [];
    if (meta) meta.textContent = data.note || '';
    if (!rows.length) {
      body.textContent = data.error || 'No aircraft recorded at KOA in this window.';
      return;
    }
    body.replaceChildren();
    const groups = [
      ['in', 'Arriving'],
      ['out', 'Departing'],
      ['field', 'At the field'],
    ];
    for (const [leg, title] of groups) {
      const list = rows.filter(row => (row.leg || 'field') === leg);
      if (!list.length) continue;
      const head = document.createElement('h3');
      head.className = 'flight-group';
      head.textContent = title;
      body.appendChild(head);
      for (const row of list) {
        const line = document.createElement('div');
        line.className = 'flight-row';
        const who = row.airline ? `${row.airline} · ${row.callsign}` : row.callsign;
        line.innerHTML = `<b>${esc(who)}</b><span>${esc(row.from)} → ${esc(row.to)}</span><em>${esc(row.status)}</em><span>${esc(row.time)}</span>`;
        body.appendChild(line);
      }
    }
  }

  if (opts.open) open();
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function paintWorld(data) {
  let board = null;
  const root = window.__kona?.scene;
  root?.traverse(o => { if (o.name === 'koa-flights') board = o; });
  const cv = board?.userData?.canvas;
  if (!cv) return;
  const c = cv.getContext('2d');
  c.fillStyle = '#0c1822';
  c.fillRect(0, 0, cv.width, cv.height);
  c.fillStyle = '#f9c74f';
  c.font = '700 42px sans-serif';
  c.fillText('KOA · today', 36, 64);
  c.fillStyle = '#9fb0bd';
  c.font = '22px sans-serif';
  const note = (data.note || '').slice(0, 90);
  c.fillText(note, 36, 104);
  const rows = (data.rows || []).slice(0, 8);
  c.font = '28px sans-serif';
  rows.forEach((row, i) => {
    const y = 170 + i * 40;
    c.fillStyle = '#f4f7f8';
    c.fillText(`${row.callsign}   ${row.from} → ${row.to}`, 36, y);
    c.fillStyle = '#f9c74f';
    c.fillText(row.status, 760, y);
  });
  if (!rows.length) {
    c.fillStyle = '#f4f7f8';
    c.fillText(data.error || 'No aircraft recorded yet today.', 36, 180);
  }
  if (board.userData.map) board.userData.map.needsUpdate = true;
}
