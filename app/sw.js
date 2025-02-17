const CACHE_NAME = 'sst-cache-v1';
const urlsToCache = [
  '/',
  '/views/home.html',
  '/views/tables.html',
  '/views/schedule.html',
  '/js/bundle.js',
  '/css/sst.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});