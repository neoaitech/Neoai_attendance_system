// VisionAttend Service Worker - PWA Offline Shell & Fast Asset Caching
const CACHE_NAME = 'visionattend-v14.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/styles.css?v=14.0',
  '/images/icon-192.png',
  '/images/icon-512.png',
  '/images/visionattend_logo.png'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Some static assets skipped caching:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Network first for API, cache fallback for static
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip caching for API endpoints and camera uploads to preserve real-time biometrics
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/uploads') || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
