// Installable app shell: service worker, "Install the app" (Android/Chrome prompt; iPhone Share → Add to Home Screen),
// screen kept awake while playing, and light haptics. Everything degrades silently where a browser lacks it.
const $ = s => document.querySelector(s);
export const standalone = () => matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone === true;
const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let deferred = null;
export function initAppShell() {
  if (standalone()) document.body.classList.add('app');
  // The service worker must be same-origin; on hosts that proxy the page from elsewhere this simply does not register.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === '127.0.0.1' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; refresh(); });
  addEventListener('appinstalled', () => { deferred = null; refresh(); haptic(20); });
  $('#gateInstall')?.addEventListener('click', offerInstall);
  refresh();
  keepAwake();
}
export function canInstall() { return !standalone() && (!!deferred || ios()); }
function refresh() { const b = $('#gateInstall'); if (b) b.hidden = !canInstall(); }

export async function offerInstall() {
  if (deferred) {
    deferred.prompt();
    const { outcome } = await deferred.userChoice.catch(() => ({}));
    if (outcome === 'accepted') deferred = null;
    refresh();
    return;
  }
  const el = $('#installSheet');
  if (!el) return;
  el.innerHTML = `<div class="row" style="align-items:center"><img class="app-icon" src="icons/icon-192.png" alt=""><div>
      <h2 id="installTitle">Kona on your home screen</h2></div></div>
    <ol>${ios()
      ? '<li>Tap the <b>Share</b> button in Safari (the square with an arrow).</li><li>Choose <b>Add to Home Screen</b>.</li><li>Open Kona from your home screen: full screen, no browser bars.</li>'
      : '<li>Open your browser menu (⋮).</li><li>Choose <b>Install app</b> or <b>Add to Home screen</b>.</li><li>Open Kona from your home screen.</li>'}</ol>
    <div class="row"><button type="button" class="primary" id="installOk">Got it</button></div>`;
  el.hidden = false;
  $('#installOk').onclick = () => { el.hidden = true; };
}

// Keep the screen on while the game is visible (released automatically when the app goes to the background).
let lock = null;
async function keepAwake() {
  const want = async () => { try { if (document.visibilityState === 'visible' && 'wakeLock' in navigator && !lock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); } } catch { lock = null; } };
  document.addEventListener('visibilitychange', want);
  addEventListener('pointerdown', want, { once: true });
}

export function haptic(pattern = 12) { try { navigator.vibrate?.(pattern); } catch { /* not supported */ } }
