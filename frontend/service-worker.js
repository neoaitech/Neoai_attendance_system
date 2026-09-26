const CACHE_NAME = 'neoai-tech-v32.0';
const STATIC_ASSETS = [
  '/',
  'index.html',
  'manifest.json',
  'css/styles.css?v=32.0',
  'css/pages/dashboard.css?v=31.0',
  'css/pages/review.css?v=31.0',
  'css/pages/reports.css?v=31.0',
  'images/icon-192.png',
  'images/icon-512.png',
  'images/visionattend_logo.png'
];

// Install Event - Pre-cache core shell
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

// Activate Event - Clean old caches & claim clients immediately
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

// Fetch Event - Stale-While-Revalidate for instant 0ms mobile loads
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip caching for API endpoints and uploads to preserve real-time biometrics
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/uploads') || event.request.method !== 'GET') {
    return;
  }

  // Stale-While-Revalidate: Return instant cached response (0ms) while updating in background
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const networkFetch = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        // Serve cached response immediately if available; otherwise wait for network
        return cachedResponse || networkFetch;
      });
    })
  );
});
