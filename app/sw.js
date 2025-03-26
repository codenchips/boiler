const CACHE_NAME = 'sst-cache-v33'; 

self.addEventListener('message', (event) => {  
  if (event.data?.type === 'GET_VERSION') {     
      // Send response back to all clients
      self.clients.matchAll().then(clients => {
          clients.forEach(client => {
              client.postMessage({ 
                  type: 'CACHE_VERSION',
                  version: CACHE_NAME,
                  timestamp: event.data.timestamp
              });
          });
      });
  }
});

const urlsToCache = [
  '/',
  '/index.html',
  '/js/bundle.js',
  '/js/vendor/jquery-3.7.1.min.js',
  '/js/vendor/uikit.min.js',
  '/css/sst.css',
  '/css/vendor/uikit.min.css',
  '/views/container.html',
  '/views/modals.html',
  '/views/home.html',
  '/views/tables.html',
  '/views/schedule.html',
  '/views/account.html',
  '/views/offline.html',
  '/manifest.json',
  '/site.webmanifest',  
  '/img/screen-tall.webp',
  '/img/screen-wide.webp',
  '/img/sync.png',
  '/img/tamlite-logo.jpg',
  '/img/tamlite-logo-pwa.webp'
];

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      // Clean up old caches
      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );

      // Take control of all clients immediately
      await clients.claim();

      // Optionally notify clients that the SW is ready
      const allClients = await clients.matchAll();
      allClients.forEach(client => {
        client.postMessage({
          type: 'SW_READY',
          message: 'Service Worker is ready and has cached all required assets'
        });
      });
    })()
  );
});

// Add message handler for client communication
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
      self.skipWaiting()
          .then(() => {
              // Notify all clients about the update
              self.clients.matchAll().then(clients => {
                  clients.forEach(client => {
                      client.postMessage({ type: 'UPDATE_READY' });
                  });
              });
          });
  }
});


self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        console.log('Precaching assets...');
        
        // Cache all assets in parallel
        await Promise.all(
          urlsToCache.map(async url => {
            try {
              const response = await fetch(url);
              if (!response.ok) {
                throw new Error(`Failed to fetch ${url}`);
              }
              await cache.put(url, response);
            } catch (error) {
              console.error(`Failed to cache ${url}:`, error);
            }
          })
        );

        console.log('Precaching complete');
        
        // Force the waiting service worker to become the active service worker
        await self.skipWaiting();
      } catch (error) {
        console.error('Precaching failed:', error);
      }
    })()
  );
});

self.addEventListener('fetch', (event) => {
  // Ignore chrome extension requests
  if (event.request.url.startsWith('chrome-extension://')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Handle navigation requests differently (page loads/refreshes)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Try network first for fresh content
          const preloadResponse = await event.preloadResponse;
          if (preloadResponse) {
            return preloadResponse;
          }

          const networkResponse = await fetch(event.request);
          return networkResponse;
        } catch (error) {
          // Network failed, try cache
          const cache = await caches.open(CACHE_NAME);
          const cachedResponse = await cache.match('/index.html');
          if (cachedResponse) {
            return cachedResponse;
          }

          // If no cached index.html, try the specific page
          const specificCachedResponse = await cache.match(event.request);
          if (specificCachedResponse) {
            return specificCachedResponse;
          }

          // If everything fails, return offline page
          return await cache.match('/views/offline.html');
        }
      })()
    );
    return;
  }

  // Handle API calls differently
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(error => {
          console.log('API call failed (offline):', error);
          return new Response(
            JSON.stringify({ 
              error: 'You are offline. This action will be queued for when you are back online.' 
            }),
            { 
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // Handle regular GET requests with caching
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            return response;
          }
          
          return fetch(event.request)
            .then(response => {
              if (response.ok) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME)
                  .then(cache => {
                    cache.put(event.request, responseClone);
                  });
              }
              return response;
            })
            .catch(async () => {
              // For HTML requests, return index.html
              if (event.request.headers.get('accept').includes('text/html')) {
                const cache = await caches.open(CACHE_NAME);
                return cache.match('/index.html');
              }
              return caches.match('/views/offline.html');
            });
        })
    );
    return;
  }

  // Let other requests pass through
  event.respondWith(fetch(event.request));
});

