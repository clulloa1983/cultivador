/* Service worker de Cultivador: permite usar la app sin conexión.
   Estrategia "stale-while-revalidate": responde al tiro desde la caché y
   actualiza en segundo plano, así la próxima visita ya trae la versión nueva.
   Si cambias la lista de archivos, sube el número de VERSION. */
const VERSION = 'cultivador-v5';
const ARCHIVOS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './data/cultivos.json',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './fonts/bitter-latin.woff2',
  './fonts/atkinson-hyperlegible-next-latin.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(ARCHIVOS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== VERSION).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    // Las navegaciones siempre sirven la portada (la app usa rutas con #).
    const clave = request.mode === 'navigate' ? './index.html' : request;
    const enCache = await cache.match(clave, { ignoreSearch: request.mode === 'navigate' });

    const deRed = fetch(request)
      .then((resp) => {
        if (resp.ok && resp.type === 'basic') cache.put(clave, resp.clone());
        return resp;
      })
      .catch(() => null);

    if (enCache) {
      event.waitUntil(deRed);
      return enCache;
    }
    const resp = await deRed;
    return resp || new Response('Sin conexión', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});
