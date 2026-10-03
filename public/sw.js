// SurveyOS app-shell service worker. Hand-written on purpose: it caches the
// shell and hashed static chunks only. Every cross-origin call (Firestore,
// Drive, Google APIs, AI providers, the Sync Worker) is left untouched.
// ponytail: no update prompt â€” an online load always fetches the fresh shell;
// add a "new version, reload" toast only if stale shells cause support calls.
const CACHE = 'surveyos-shell-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.add('/')).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The page posts the hashed chunks it loaded before this worker took control.
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'CACHE_URLS' || !Array.isArray(data.urls)) return;
  event.waitUntil(
    caches.open(CACHE).then((c) => Promise.all(data.urls.map((u) => c.add(u).catch(() => {})))),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // Network first. Only the app root ('/') refreshes the cached shell —
    // marketing pages (/landing, /blog…) are separate HTML files.
    // On weak signal, serve the cached shell if the network is silent for 4 s.
    event.respondWith(new Promise((resolve) => {
      let settled = false;
      const settle = (res) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(res);
      };
      const timer = setTimeout(() => {
        caches.match('/').then((hit) => { if (hit) settle(hit); });
      }, 4000);
      fetch(req)
        .then((res) => {
          if (url.pathname === '/' && res.ok) {
            const copy = res.clone();
            event.waitUntil(caches.open(CACHE).then((c) => c.put('/', copy)));
          }
          settle(res);
        })
        .catch(() => caches.match('/').then((hit) => settle(hit || Response.error())));
    }));
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    // Content-hashed filenames never change, so cache first is safe.
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          event.waitUntil(caches.open(CACHE).then((c) => c.put(req, copy)));
        }
        return res;
      })),
    );
  }
});
