/* RunTwi service worker: offline app shell + phrase-bank audio cache + run sync. */
const CACHE = 'runtwi-v1';
const AUDIO_CACHE = 'runtwi-audio-v1';
const SHELL = ['/', '/run', '/history', '/plan', '/settings', '/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => ![CACHE, AUDIO_CACHE].includes(k)).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Phrase-bank audio: cache-first, keep forever (immutable native recordings).
  if (url.pathname.includes('/phrasebank/')) {
    e.respondWith(
      caches.open(AUDIO_CACHE).then(async (c) => {
        const hit = await c.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        if (res.ok) c.put(e.request, res.clone());
        return res;
      }),
    );
    return;
  }

  // App shell / navigation: network-first, fall back to cache offline.
  if (e.request.mode === 'navigate' || SHELL.includes(url.pathname)) {
    e.respondWith(
      fetch(e.request).then((res) => {
        caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
        return res;
      }).catch(() => caches.match(e.request).then((r) => r || caches.match('/'))),
    );
  }
});

// Background Sync: retry queued runs once connectivity returns.
self.addEventListener('sync', (e) => {
  if (e.tag === 'sync-runs') {
    e.waitUntil(
      self.clients.matchAll().then((clients) =>
        clients.forEach((c) => c.postMessage({ type: 'flush-runs' })),
      ),
    );
  }
});
