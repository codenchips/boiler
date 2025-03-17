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
  '/views/account.html',  
  '/manifest.json'
];

//const backgroundSync = new BackgroundSyncManager('api-queue');

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  // Ignore chrome extension requests
  if (event.request.url.startsWith('chrome-extension://')) {
    event.respondWith(fetch(event.request));
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
            .catch(() => {
              return caches.match('/views/offline.html');
            });
        })
    );
    return;
  }

  // Let other requests pass through
  event.respondWith(fetch(event.request));
});

