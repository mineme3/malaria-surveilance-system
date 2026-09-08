const CACHE_NAME = 'malaria-pwa-v4';
const API_CACHE = 'malaria-api-v3';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Short hash of the auth token so each logged-in user gets their own API cache.
// API responses contain role-scoped data (region/zone/district), so they must
// never be served from a cache written by a different user.
function tokenCacheKey(token) {
  let h = 0;
  for (let i = 0; i < token.length; i++) {
    h = (h * 31 + token.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

function offlineApiResponse() {
  return new Response(JSON.stringify({ error: 'Offline' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/@') || url.pathname.includes('vite') || url.search.includes('t=')) return;

  // API requests: network-first with a per-user cache fallback.
  // The cache key includes a hash of the caller's token, so one region's data is
  // never served to a different region/zone/district user when the network fails.
  if (url.pathname.startsWith('/api/')) {
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) {
      // Unauthenticated requests are never cached or served from cache.
      event.respondWith(fetch(request).catch(() => offlineApiResponse()));
      return;
    }
    const cacheUrl = new URL(request.url);
    cacheUrl.searchParams.set('_uid', tokenCacheKey(token));
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => cache.put(cacheUrl, clone));
          }
          return response;
        })
        .catch(async () => (await caches.match(cacheUrl)) || offlineApiResponse())
    );
    return;
  }

  // Static assets: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetched = fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          if (cached) return cached;
          if (request.mode === 'navigate') {
            return caches.match('/offline.html');
          }
          return new Response('Offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        });
      return cached || fetched;
    })
  );
});

// Background sync for offline cases
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-cases') {
    event.waitUntil(
      (async () => {
        const clients = await self.clients.matchAll();
        for (const client of clients) {
          client.postMessage({ type: 'SYNC_STARTED' });
        }
        for (const client of clients) {
          client.postMessage({ type: 'TRIGGER_SYNC' });
        }
      })()
    );
  }
});

// Push notification support
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || data.message || 'New notification',
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/dashboard' },
    actions: [
      { action: 'open', title: 'Open', icon: '/icons/icon-192.svg' },
      { action: 'dismiss', title: 'Dismiss', icon: '/icons/icon-192.svg' },
    ],
    tag: data.tag || 'malaria-notification',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Malaria Surveillance', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(event.notification.data?.url || '/dashboard');
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data?.url || '/dashboard');
      }
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
