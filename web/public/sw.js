// Kona Race Week service worker: installable app + fast repeat launches + offline play of anything already seen.
// Page (index.html): network first, cached copy when offline, so updates arrive as soon as there is a connection.
// Game files (assets/, icons/, fonts): cache first, filled as they are used (the full island is ~55 MB, so nothing
// big is downloaded up front). Bump VERSION when the asset format changes to drop old caches.
const VERSION = 'kona-v4';
const SHELL = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const page = req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/');
  if (page) {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
    return;
  }
  const game = url.origin === self.location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || /githubusercontent\.com$/.test(url.hostname);
  if (!game) return;
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  })));
});
