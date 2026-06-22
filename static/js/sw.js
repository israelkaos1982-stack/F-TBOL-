'use strict';
/* Service Worker — F-TBOL  (2026-06-22)
   ─────────────────────────────────────────────────────────────────────────
   Estrategia por tipo de recurso:
   • /static/ (CSS/JS con ?v=)  → cache-first  (URL cambia al actualizar)
   • /        (HTML principal)  → network-first, caché como red de seguridad
   • /api/    (datos dinámicos) → siempre red, nunca cachear
   ─────────────────────────────────────────────────────────────────────────
   Beneficio: en la 2ª visita (o tras un cold-start de Railway) los 1.4 MB
   de JS/CSS se sirven INSTANTÁNEAMENTE desde caché sin tocar la red.
   El HTML sigue siendo siempre fresco (network-first); la caché solo
   actúa si Railway no responde (offline / error). */

var CACHE_STATIC = 'ftbol-static-v1';
var CACHE_HTML   = 'ftbol-html-v1';

/* Activos a pre-cachear en el install.  Actualizar ?v= aquí cuando cambien. */
var PRECACHE = [
  '/static/css/index.bundle.css?v=5.5',
  '/static/css/goal-notification-improved.css?v=2.1',
  '/static/js/goal-notification-improved.js?v=2.0',
  '/static/js/var-system.js?v=1.0',
  '/static/js/index.bundle.js?v=9.10',
  '/static/js/goal-notification-patch.js?v=2.1',
  '/static/js/copa-engine.js?v=1.2',
];

/* ── INSTALL: pre-cachear activos estáticos ─────────────────────────────── */
self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_STATIC).then(function (cache) {
      return Promise.all(
        PRECACHE.map(function (url) {
          return cache.add(url).catch(function () { /* fallo individual — no bloquear install */ });
        })
      );
    })
  );
});

/* ── ACTIVATE: limpiar cachés antiguas y tomar control inmediato ─────────── */
self.addEventListener('activate', function (e) {
  var keep = [CACHE_STATIC, CACHE_HTML];
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return keep.indexOf(k) === -1; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

/* ── FETCH: enrutador de estrategias ────────────────────────────────────── */
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;

  var url = e.request.url;
  if (!url.startsWith(self.location.origin)) return;  /* solo same-origin */

  var path = new URL(url).pathname;

  /* API dinámica: siempre red, nunca caché */
  if (path.startsWith('/api/')) return;

  /* Activos estáticos: cache-first (la URL incluye ?v= → siempre fresca) */
  if (path.startsWith('/static/')) {
    e.respondWith(
      caches.open(CACHE_STATIC).then(function (cache) {
        return cache.match(e.request).then(function (hit) {
          if (hit) return hit;
          return fetch(e.request).then(function (res) {
            if (res && res.ok) cache.put(e.request, res.clone());
            return res;
          });
        });
      })
    );
    return;
  }

  /* HTML de navegación: network-first; caché solo si la red falla */
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(function (res) {
        if (res && res.ok) {
          caches.open(CACHE_HTML).then(function (c) { c.put('/', res.clone()); });
        }
        return res;
      }).catch(function () {
        return caches.open(CACHE_HTML).then(function (c) { return c.match('/'); });
      })
    );
  }
});
