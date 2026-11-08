// Service worker Bouchnocam v2 : l'application s'ouvre hors connexion,
// les fonds de carte déjà vus restent disponibles, les données restent toujours fraîches.
const VERSION = 'bcm-v2.1.0';
const APP = `${VERSION}-app`;
const TILES = `${VERSION}-tiles`;
const MAX_TILES = 600;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function trimTiles() {
  const cache = await caches.open(TILES);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i += 1) await cache.delete(keys[i]);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname.endsWith('supabase.co') || url.hostname.endsWith('openstreetmap.org')) return;

  if (url.hostname.endsWith('basemaps.cartocdn.com')) {
    event.respondWith((async () => {
      const cache = await caches.open(TILES);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok) { cache.put(req, res.clone()); trimTiles(); }
        return res;
      } catch {
        return new Response('', { status: 504 });
      }
    })());
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(APP)).put(req, res.clone());
        return res;
      } catch {
        const hit = await caches.match(req, { ignoreSearch: true });
        if (hit) return hit;
        if (req.mode === 'navigate') return (await caches.match('./index.html')) || new Response('', { status: 504 });
        return new Response('', { status: 504 });
      }
    })());
  }
});
