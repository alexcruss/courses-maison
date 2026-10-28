// Service worker : garde l'appli disponible sans internet.
// VERSION change à chaque publication (tools/publier.ps1) : les téléphones
// téléchargent alors la nouvelle version à la prochaine ouverture.

const VERSION = 'assimeto-20261028-1';

const FICHIERS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/util.js',
  './js/store.js',
  './js/metier.js',
  './js/ui.js',
  './js/data/referentiel.js',
  './js/data/aliments.js',
  './js/data/recettes.js',
  './js/vues/courses.js',
  './js/vues/maison.js',
  './js/vues/plats.js',
  './js/vues/conserver.js',
  './js/vues/reglages.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(FICHIERS.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((enCache) => enCache || fetch(req).catch(() => (
      req.mode === 'navigate' ? caches.match('./index.html') : Response.error()
    ))),
  );
});
