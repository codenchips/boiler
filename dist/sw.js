const CACHE_NAME = 'sst-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/sst.css',
  '/js/bundle.js',
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

// Network first, falling back to cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request);
      })
  );
});