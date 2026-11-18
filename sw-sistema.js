/* Service worker de la app del sistema.
   Siempre pide a la red primero (los datos de ventas y leads nunca se guardan en caché).
   Solo guarda la pantalla y los archivos del sistema para que abra aunque falle el internet un momento. */
const CACHE = 'cardian-sistema-v1';
const BASE = ['/sistema', '/assets/site.css', '/assets/sistema.css', '/assets/data.js', '/assets/estado-pedido.js', '/assets/sistema.js', '/img/logo.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  const clave = r.mode === 'navigate' ? '/sistema' : u.pathname;
  if (r.mode !== 'navigate' && !BASE.includes(u.pathname)) return;
  e.respondWith(
    fetch(r).then(res => {
      if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(clave, copia)); }
      return res;
    }).catch(() => caches.match(clave).then(m => m || new Response('Sin conexión. Revisa tu internet y vuelve a abrir la app.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })))
  );
});
