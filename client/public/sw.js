/*
 * Tectum service worker - makes the site installable and shows a friendly offline page.
 * Deliberately simple and safe:
 *  - page loads (navigations): network first; if the network is down, the cached offline page
 *  - built assets (/assets/*, hashed file names) and icons: cache first, filled as they're used
 *  - the API, uploads and everything else: always the network (never cached, never stale)
 */
const VERSION = 'tectum-v2';
const PRECACHE = ['/offline.html', '/favicon.png', '/logo-mark.png', '/icons/icon-192.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/offline.html')));
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
  // everything else (API, uploads, sockets): straight to the network
});
