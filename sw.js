/* Tres al día — service worker: la app completa queda guardada en el teléfono y abre sin internet. */
var VERSION = 'tres-al-dia-v2';
var SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (cache) { return cache.addAll(SHELL); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isFont(url) { return url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'; }

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // La página misma: lo guardado primero, y se actualiza en segundo plano para la próxima apertura.
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html').then(function (cached) {
        var fresh = fetch(req).then(function (res) {
          if (res && res.ok) { caches.open(VERSION).then(function (c) { c.put('./index.html', res.clone()); }); }
          return res;
        }).catch(function () { return cached; });
        return cached || fresh;
      })
    );
    return;
  }

  // Fuentes: se guardan la primera vez que hay internet; después sirven sin conexión.
  if (isFont(url)) {
    e.respondWith(
      caches.match(req).then(function (cached) {
        if (cached) return cached;
        return fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy); });
          return res;
        }).catch(function () { return new Response('', { status: 503 }); });
      })
    );
    return;
  }

  // Archivos propios (íconos, manifiesto): lo guardado primero.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(function (cached) {
        return cached || fetch(req).then(function (res) {
          if (res && res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
          return res;
        });
      })
    );
  }
});
