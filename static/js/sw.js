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
/* Bump v1→v2 (2026-07-29): el fallback de HTML (línea ~126, solo se usa
   si el fetch de red falla) no tiene caducidad — puede servir una copia
   de HACE DÍAS si el dispositivo tuvo una sola petición fallida en
   cualquier momento. Con el cold-start de Railway (documentado en todo
   este proyecto) eso es frecuente, así que un dispositivo podía quedarse
   sirviendo la SPLASH VIEJA (sin el contador real, o con una versión con
   bugs ya corregidos) indefinidamente, sin que ningún cambio en
   index.html/misc_body_*.html le llegara nunca — el `activate` de abajo
   solo purga cachés cuyo NOMBRE ya no está en `keep`, así que renombrar
   la caché es lo que fuerza a CADA dispositivo a descartar cualquier
   copia vieja y pedir HTML fresco en su próxima navegación. */
var CACHE_HTML   = 'ftbol-html-v2';

/* Activos a pre-cachear en el install.  Actualizar ?v= aquí cuando cambien. */
var PRECACHE = [
  '/static/css/index.bundle.css?v=5.6',
  '/static/css/goal-notification-improved.css?v=2.1',
  '/static/js/goal-notification-improved.js?v=2.0',
  '/static/js/var-system.js?v=1.0',
  '/static/js/index.bundle.js?v=9.34',
  '/static/js/goal-notification-patch.js?v=2.1',
  '/static/js/copa-engine.js?v=1.7',
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
    }).then(function () {
      /* PURGAR versiones VIEJAS dentro de CACHE_STATIC (2026-07-22).
         Bug: cache-first guarda cada ?v=X.X que se haya pedido ALGUNA VEZ,
         y nada las borraba — solo se eliminaban cachés completos que ya no
         se usan (arriba), nunca las entradas individuales. Si el HTML
         network-first cae a su fallback de caché (Railway lento/caído en
         un cold-start, red móvil intermitente — ambos muy documentados en
         este proyecto), esa copia HTML puede ser de hace semanas y seguir
         referenciando `index.bundle.js?v=9.10` en vez de la versión
         actual. Sin esta purga, esa URL vieja SEGUÍA en CACHE_STATIC desde
         la sesión en que se vio por última vez → cache-first la servía al
         INSTANTE, sin tocar la red — la web "cargaba" pero con código de
         hace meses, sin ningún error visible. Con la purga, esa URL vieja
         ya no está en caché → el fetch va a la red → el servidor Flask
         devuelve el archivo ACTUAL (el `?v=` es solo cache-busting del
         cliente, el servidor ignora la query string y sirve siempre el
         contenido vigente) → la app corre con código actual aunque el
         HTML stale siga pidiendo una URL con número de versión viejo. */
      return caches.open(CACHE_STATIC).then(function (cache) {
        return cache.keys().then(function (reqs) {
          return Promise.all(
            reqs.filter(function (req) {
              var path = new URL(req.url).pathname + new URL(req.url).search;
              return PRECACHE.indexOf(path) === -1;
            }).map(function (req) { return cache.delete(req); })
          );
        });
      });
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

  /* HTML de navegación: network-first; caché solo si la red falla.
     La caché lleva un sello de fecha (2026-07-29) para que, si algún día
     vuelve a acumularse una copia vieja, NUNCA se sirva indefinidamente
     — pasadas 6h se trata como un miss (el navegador ve el error de red
     real en vez de una página desactualizada disfrazada de actual). */
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(function (res) {
        /* clonar YA, síncrono: si se difiere dentro del .then() de
           caches.open() (async, IndexedDB), el navegador puede empezar
           a consumir el body de `res` (para pintar la página) antes de
           que el clone() llegue a ejecutarse → "Response body is
           already used". Clonar aquí evita la carrera. */
        var resClone = (res && res.ok) ? res.clone() : null;
        if (resClone) {
          resClone.blob().then(function (body) {
            var headers = new Headers(resClone.headers);
            headers.set('x-sw-cached-at', String(Date.now()));
            var stamped = new Response(body, { status: resClone.status, statusText: resClone.statusText, headers: headers });
            return caches.open(CACHE_HTML).then(function (c) { return c.put('/', stamped); });
          }).catch(function () {});
        }
        return res;
      }).catch(function () {
        return caches.open(CACHE_HTML).then(function (c) {
          return c.match('/').then(function (hit) {
            if (!hit) return undefined;
            var cachedAt = parseInt(hit.headers.get('x-sw-cached-at') || '0', 10);
            var MAX_AGE_MS = 6 * 60 * 60 * 1000; /* 6 h */
            if (cachedAt && (Date.now() - cachedAt) > MAX_AGE_MS) return undefined;
            return hit;
          });
        });
      })
    );
  }
});
