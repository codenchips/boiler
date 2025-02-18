const CACHE_NAME = 'sst-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/js/bundle.js',
  '/js/vendor/jquery-3.7.1.min.js',
  '/css/sst.css',
  '/css/vendor/uikit.min.css',
  '/views/home.html',
  '/views/tables.html',
  '/views/schedule.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.startsWith('chrome-extension://')) {
    console.log(`Ignoring chrome-extension:// request: ${event.request.url}`);
    event.respondWith(fetch(event.request)); // Just fetch normally
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Return cached version
        }
        
        // Not in cache - fetch from network
        return fetch(event.request)
          .then(response => {
            // Cache successful responses
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseClone);
                });
            }
            return response;
          })
          .catch(() => {
            // Network failed, show offline page
            return caches.match('/views/offline.html');
          });
      })
  );
});