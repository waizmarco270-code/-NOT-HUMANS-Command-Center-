// NOT HUMANS Command Center Service Worker with Web Push Notifications
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

// Real-Time Web Push Event Listener
self.addEventListener('push', (event) => {
  let data = { title: "NOT HUMANS HQ", body: "New tactical alert received!" };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "NOT HUMANS HQ", body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: 'https://api-assets.clashofclans.com/badges/200/HdJ2Uoq78hEwblk6vU0Nt74HmQ0PGMeL-SaTp2KWphc.png',
    badge: 'https://api-assets.clashofclans.com/badges/70/HdJ2Uoq78hEwblk6vU0Nt74HmQ0PGMeL-SaTp2KWphc.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.data?.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click Event Listener to open or focus window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        const isSameOrigin = new URL(client.url).origin === self.location.origin;
        if (isSameOrigin && 'focus' in client) {
          // Tell client to change tab
          client.postMessage({ type: 'NAVIGATE', url: targetUrl });
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
