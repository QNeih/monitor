// Cacht nur die App-Shell (offline-Fallback), nie Abfahrten.
// Immer zuerst das Netz, und zwar am HTTP-Cache vorbei (cache: 'no-cache' = beim Server nachfragen).
// Sonst liefert der Browser nach einem Deploy bis zu 10 min alte Dateien (GitHub Pages: max-age=600),
// und neue index.html + altes app.js passen nicht zusammen.
// Bei jeder Änderung an App-Dateien: V hier, ?v= in index.html und den Import in app.js hochzählen.
const V = 13;
const CACHE = 'monitor-v' + V;
const SHELL = ['./', 'index.html', `style.css?v=${V}`, `app.js?v=${V}`, `config.js?v=${V}`, 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
const fresh = (url) => fetch(url, { cache: 'no-cache' });
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => fresh(u).then((r) => c.put(u, r))))).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fresh(e.request.url).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
