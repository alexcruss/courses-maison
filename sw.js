// Service worker : garde l'appli disponible sans internet.
// VERSION change à chaque publication (tools/publier.ps1) : les téléphones
// téléchargent alors la nouvelle version à la prochaine ouverture.

const VERSION = 'assimeto-20261028-1824';

// Le SDK Firebase (foyer partagé) est gardé à part : il ne change pas à chaque
// version de l'appli et doit rester disponible hors ligne.
const SDK = 'https://www.gstatic.com/firebasejs/12.6.0/';
const CACHE_SDK = 'firebase-sdk-12.6.0';

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
  './js/sync.js',
  './js/firebase-config.js',
  './js/ia.js',
  './js/ia-config.js',
  './js/abonnement.js',
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
      .then((cles) => Promise.all(cles.filter((k) => k !== VERSION && k !== CACHE_SDK).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  if (req.url.startsWith(SDK)) {
    e.respondWith(caches.open(CACHE_SDK).then((cache) => cache.match(req).then((enCache) => enCache
      || fetch(req).then((rep) => {
        if (rep.ok) cache.put(req, rep.clone());
        return rep;
      }))));
    return;
  }

  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((enCache) => enCache || fetch(req).catch(() => (
      req.mode === 'navigate' ? caches.match('./index.html') : Response.error()
    ))),
  );
});
