const VERSION = '2.0.1'; // Change this version to force-update the cache
const CACHE_NAME = `createmode-cache-${VERSION}`;

// These are the files that make up the "app shell" and are required for the app to work offline.
const STATIC_CACHE_URLS = [
  './', // Caches the root URL
  './index.html',
  './manifest.webmanifest',
  './icon-192x192.png',
  './icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css' // Crucial for offline UI
];

/**
 * On install, cache the static assets.
 */
self.addEventListener('install', event => {
  console.log(`[Service Worker] Installing version ${VERSION}...`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching App Shell...');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => self.skipWaiting()) // Activate the new service worker immediately
  );
});

/**
 * On activate, clean up old caches.
 */
self.addEventListener('activate', event => {
  console.log(`[Service Worker] Activating version ${VERSION}...`);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // If the cache name is one of ours but not the current one, delete it.
          if (cacheName.startsWith('createmode-cache-') && cacheName !== CACHE_NAME) {
            console.log(`[Service Worker] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all open pages
  );
});

/**
 * On fetch, serve from cache first, then network.
 * This is a "Cache, falling back to Network" strategy.
 */
self.addEventListener('fetch', event => {
  // We only want to handle GET requests.
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // 1. If we have a cached response, return it.
        if (cachedResponse) {
          // console.log('[Service Worker] Serving from cache:', event.request.url);
          return cachedResponse;
        }

        // 2. If not in cache, fetch from the network.
        // console.log('[Service Worker] Fetching from network:', event.request.url);
        return fetch(event.request).then(
          networkResponse => {
            // Check if we received a valid response
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                // Cache the new resource for next time.
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        );
      })
      .catch(() => {
        // If both cache and network fail (e.g., offline and not in cache),
        // provide a fallback for navigation requests.
        if (event.request.mode === 'navigate') {
          console.log('[Service Worker] Offline fallback for navigation.');
          return caches.match('./index.html');
        }
      })
  );
});
