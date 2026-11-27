// Offline-Fallback für die App-Shell und Empfang der Push-Nachrichten.
// App-Dateien: immer zuerst das Netz (am HTTP-Cache vorbei), Cache nur ohne Netz. Abfahrten (Worker) werden nie gecacht.
const CACHE = 'monitor-v22';
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', 'index.html'])).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then((r) => {
    if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match('./'))));
});

// Nachricht vom Worker: {title, body, tag, silent, badge, url} oder {close: tag}.
// Der Countdown kommt jede Minute mit demselben tag und ersetzt die vorige Nachricht still.
self.addEventListener('push', (e) => {
  let m = {};
  try { m = e.data.json(); } catch { m = { title: 'Monitor', body: e.data && e.data.text() }; }
  e.waitUntil((async () => {
    if (m.close) {
      for (const n of await self.registration.getNotifications({ tag: m.close })) n.close();
      if (navigator.clearAppBadge) await navigator.clearAppBadge().catch(() => {});
      return;
    }
    if (navigator.setAppBadge) {
      if (m.badge) await navigator.setAppBadge(m.badge).catch(() => {});
      else await navigator.clearAppBadge().catch(() => {});
    }
    await self.registration.showNotification(m.title || 'Monitor', {
      body: m.body || '',
      tag: m.tag,
      renotify: !m.silent,
      silent: !!m.silent,
      icon: 'icons/icon-192.png',
      badge: 'icons/badge-96.png',
      data: { url: m.url || '?tab=jump' },
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const c = all.find((x) => x.url.startsWith(self.registration.scope));
    if (c) { await c.focus(); c.postMessage({ tab: new URL(url).searchParams.get('tab') }); return; }
    await self.clients.openWindow(url);
  })());
});
