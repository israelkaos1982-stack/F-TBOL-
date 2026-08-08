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
/* v1 → v2 (2026-07-28/29): un usuario reportó código JS de una versión
   MUY antigua (un boot-splash con barra de progreso — `boot-splash-bar`/
   `_bootBump`/`_bootProgressPre` — que ya NO existe en ningún archivo del
   proyecto actual) apareciendo como TEXTO VISIBLE en pantalla, en
   CUALQUIER pantalla de la app. Causa: el fallback de abajo (`.catch()`
   del fetch de navegación) servía la copia de `ftbol-html-v1` sin
   NINGÚN límite de antigüedad — si la red fallaba/tardaba (Railway en
   cold-start, muy documentado en este proyecto) aunque fuera SOLO UNA
   VEZ en semanas, esa caché quedaba servida indefinidamente hasta el
   próximo fallo de red que la refrescara, sin que nada la invalidara
   por edad. El bump de nombre aquí purga esa copia (posiblemente
   corrupta/rota — el HTML viejo tenía un <script> mal cerrado que
   dejaba código JS como texto plano) para TODOS los usuarios en el
   próximo `activate` (el handler ya borra cualquier caché fuera de
   `keep`). Ver además el límite de antigüedad `HTML_CACHE_MAX_AGE_MS`
   más abajo — el bump por sí solo no evita que vuelva a pasar. */
var CACHE_HTML   = 'ftbol-html-v2';
/* Antigüedad máxima que se acepta servir de la caché HTML de
   emergencia. Sin este límite, un solo fallo de red puede dejar
   servida una copia de hace SEMANAS indefinidamente (hasta el próximo
   fallo de red que la refresque) — exactamente el bug de arriba. Con
   el límite, una copia más vieja que esto se descarta y se deja que el
   error de red se propague (el navegador muestra su propio aviso de
   sin-conexión) en vez de mostrar una app con código obsoleto/roto. */
var HTML_CACHE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutos

/* Activos a pre-cachear en el install.  Actualizar ?v= aquí cuando cambien. */
var PRECACHE = [
  '/static/css/index.bundle.css?v=5.6',
  '/static/css/goal-notification-improved.css?v=2.1',
  '/static/js/goal-notification-improved.js?v=2.0',
  '/static/js/var-system.js?v=1.0',
  '/static/js/index.bundle.js?v=9.38',
  '/static/js/goal-notification-patch.js?v=2.2',
  '/static/js/copa-engine.js?v=1.8',
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

  /* HTML de navegación: network-first; caché solo si la red falla, y
     SOLO si esa copia cacheada no supera `HTML_CACHE_MAX_AGE_MS` — sin
     este límite un único fallo de red puede dejar servida una copia de
     hace semanas indefinidamente (ver comentario de arriba). */
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
          caches.open(CACHE_HTML).then(function (c) {
            c.put('/', resClone);
            /* Sello de "cuándo se guardó esta copia" — Response de texto
               plano con el timestamp, guardado junto a '/' bajo una key
               propia para no tocar el body del HTML real. */
            try {
              c.put('/__ftbol_html_cached_at__', new Response(String(Date.now())));
            } catch (_e) {}
          }).catch(function () {});
        }
        return res;
      }).catch(function () {
        return caches.open(CACHE_HTML).then(function (c) {
          return c.match('/__ftbol_html_cached_at__').then(function (tsRes) {
            return (tsRes ? tsRes.text() : Promise.resolve(null)).then(function (tsText) {
              var ts = tsText ? parseInt(tsText, 10) : NaN;
              var fresh = !isNaN(ts) && (Date.now() - ts) <= HTML_CACHE_MAX_AGE_MS;
              if (!fresh) {
                /* Demasiado vieja (o sin sello — copia de un SW anterior
                   al que no le dio tiempo a escribir el sello) — NO la
                   servimos. Dejamos que el error de red se propague: el
                   navegador muestra su propio aviso de sin-conexión, en
                   vez de una app con código potencialmente obsoleto o
                   roto. */
                return Promise.reject(new Error('stale html cache'));
              }
              return c.match('/');
            });
          });
        });
      })
    );
  }
});
