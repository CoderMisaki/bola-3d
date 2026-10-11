// BOLA 3D service worker — offline support
const CACHE = 'bola3d-v1';
const FILES = ['./', './index.html', './manifest.webmanifest',
  './js/main.js', './js/config.js', './js/world.js', './js/entities.js',
  './js/ai.js', './js/game.js', './js/input.js', './js/audio.js',
  './js/vendor/three.module.js', './icons/icon-512.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).catch(() => caches.match('./index.html'))));
});
