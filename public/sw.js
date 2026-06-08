// NOT HUMANS Command Center Service Worker
const CACHE_NAME = 'not-humans-hq-v1';
const PRE_CACHE_RESOURCES = [
  '/',
  '/index.html',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pure pass-through fetch to satisfy PWA criteria without aggressive asset lockups
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request) || new Response("Command Center Offline Mode", {
        headers: { "Content-Type": "text/plain" }
      });
    })
  );
});
