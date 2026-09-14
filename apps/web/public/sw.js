const CACHE = 'bluff-tavern-v7.1.2-event-cleanup1';
const APP_SHELL = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/socket.io')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then((response) => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        void caches.open(CACHE).then((cache) => cache.put(APP_SHELL, copy));
      }
      return response;
    }).catch(() => caches.match(APP_SHELL)));
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => cached ?? fetch(event.request).then((response) => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match('/'))));
});
