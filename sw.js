const CACHE_NAME = 'la-esquinita-v3';
const APP_SHELL = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './manifest.json',
  './favicon.ico',
  './favicon-16x16.png',
  './favicon-32x32.png',
  './favicon-96x96.png',
  './apple-icon.png',
  './apple-icon-180x180.png',
  './android-icon-192x192.png',
  'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css'
];

const CDN_HOSTS = new Set([
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com'
]);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isAppRequest = url.href.startsWith(self.registration.scope);
  const isCdnAsset = CDN_HOSTS.has(url.hostname);

  // Firebase and other remote data calls should always go straight to network.
  if (!isAppRequest && !isCdnAsset) return;

  event.respondWith(networkFirstWithCacheFallback(request));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function networkFirstWithCacheFallback(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;

    if (request.mode === 'navigate') {
      const appShell = await cache.match(new URL('./index.html', self.registration.scope).href);
      if (appShell) return appShell;
    }

    throw error;
  }
}
