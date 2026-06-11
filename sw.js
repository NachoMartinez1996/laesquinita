const CACHE_NAME = 'la-esquinita-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/app.js',                          // ← AÑADIDO: caché offline de la lógica
  'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Estrategia stale-while-revalidate: devuelve caché si existe, actualiza en segundo plano
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // Si la respuesta es válida, la guardamos en caché para la próxima
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => cachedResponse); // si falla la red, devuelve lo que haya en caché
        // Devolvemos primero lo que tengamos en caché (o null) y luego la promesa de red
        return cachedResponse || fetchPromise;
      });
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
});