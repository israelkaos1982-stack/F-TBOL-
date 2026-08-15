'use strict';
/* Service Worker — F-TBOL  (2026-08-10)
   ─────────────────────────────────────────────────────────────────────────
   Estrategia por tipo de recurso:
   • /static/ (CSS/JS con ?v=)  → cache-first  (URL cambia al actualizar)
   • /        (HTML principal)  → STALE-WHILE-REVALIDATE (ver abajo)
   • /api/    (datos dinámicos) → siempre red, nunca cachear
   ─────────────────────────────────────────────────────────────────────────
   Beneficio: en la 2ª visita (o tras un cold-start de Railway) los 1.4 MB
   de JS/CSS se sirven INSTANTÁNEAMENTE desde caché sin tocar la red.

   ── HTML principal: de network-first a STALE-WHILE-REVALIDATE ──────────
   Investigación de rendimiento en móvil (2026-08-10, Chromium real vía
   CDP con CPU×6 + red 1.6 Mbps/150 ms — condiciones típicas de un móvil
   gama media con datos): `misc_body_1.html`+`misc_body_2.html` van
   INLINE en el propio `/` (no son `/static/`, así que nunca entraban en
   la rama cache-first de arriba) — ~1.3 MB YA comprimidos con gzip. Con
   el network-first de siempre, CADA apertura de la app pagaba esa
   descarga completa antes de poder pintar nada, aunque el usuario
   hubiera abierto la web hace 2 minutos. En PC (CPU/red rápidas) apenas
   se nota; en móvil son varios segundos SOLO de descarga, cada vez.

   Con SWR: si hay una copia en caché de menos de `HTML_SWR_MAX_AGE_MS`,
   se sirve AL INSTANTE (cero espera de red) y, en paralelo
   (`e.waitUntil`, no bloquea la respuesta ya entregada), se pide la
   versión fresca — si difiere de la servida, se avisa a las pestañas
   abiertas vía `postMessage` para que muestren el MISMO banner
   "🔄 Hay una versión más nueva" que ya usa el propio Service Worker
   (nunca recarga sola — un partido en curso vive en memoria). Pasada esa
   ventana de frescura, se vuelve al network-first clásico (1ª visita del
   día, por ejemplo) — el objetivo es que REABRIR la app varias veces en
   la misma sesión sea instantáneo, no eliminar la comprobación de red
   por completo. El límite de antigüedad de la caché de EMERGENCIA
   (`HTML_CACHE_MAX_AGE_MS`, para cuando la red falla del todo) no
   cambia — sigue siendo la última red de seguridad, más laxa que la de
   SWR a propósito. */

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
var CACHE_HTML   = 'ftbol-html-v15';
/* v9 → v10 (2026-08-15): fix de los 6 toasts sin `pointer-events:none`
   que bloqueaban los toques a las cards del menú de debajo (misma
   regla de abajo — toda edición de `misc_body_1.html` exige este
   bump, o el fix no llega a un usuario con la app ya abierta/reciente
   pese a estar ya fusionado en `main`). */
/* v10 → v11 (2026-08-15): el portero de la portería imbatida pasa a
   auto-seleccionarse SIEMPRE por mayor nivel-poder (humano e IA, sin
   picker) — toca `misc_body_1.html`/`misc_body_2.html`, exige el mismo
   bump. */
/* v3 → v4 → v5 → v6 → v7 → v8 → v9 (2026-08-10): la nueva estrategia SWR de arriba (ver cabecera
   del archivo) sirve el HTML principal desde caché hasta 30 min sin
   comprobar red — así que cualquier fix a `misc_body_1.html`/
   `misc_body_2.html` (van INLINE en `/`, nunca en `/static/`) quedaba
   invisible para un usuario que ya tuviera la app abierta/reciente,
   aunque el fix ya estuviera en producción (bug real: el usuario
   probó un botón nuevo y "seguía sin funcionar" porque su navegador
   servía la copia de HACE UNOS MINUTOS, de antes del fix). El bump
   purga esa caché para TODOS en el próximo `activate` — mismo
   mecanismo que el v1→v2 de arriba. Toda edición de
   `misc_body_1.html`/`misc_body_2.html`/`templates/index.html` DEBE
   bumpear esta versión (regla obligatoria, ver CLAUDE.md — espejo de
   la que ya exige bumpear `?v=X.X` para `index.bundle.js`/`.css`). */
/* Antigüedad máxima que se acepta servir de la caché HTML de
   emergencia. Sin este límite, un solo fallo de red puede dejar
   servida una copia de hace SEMANAS indefinidamente (hasta el próximo
   fallo de red que la refresque) — exactamente el bug de arriba. Con
   el límite, una copia más vieja que esto se descarta y se deja que el
   error de red se propague (el navegador muestra su propio aviso de
   sin-conexión) en vez de mostrar una app con código obsoleto/roto. */
var HTML_CACHE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutos

/* Ventana de frescura para SERVIR AL INSTANTE (stale-while-revalidate) sin
   esperar red. Deliberadamente MÁS CORTA que el "todo vale con tal de no
   mostrar el error offline del navegador" de arriba — aquí SÍ hay red
   disponible, así que en cuanto pase esta ventana se vuelve a pedir la
   página al servidor antes de responder (network-first clásico), no se
   sirve una copia vieja sin comprobar. 30 min cubre sobradamente reabrir
   la app varias veces en la misma sesión de uso. */
var HTML_SWR_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutos

/* Activos a pre-cachear en el install.  Actualizar ?v= aquí cuando cambien. */
var PRECACHE = [
  '/static/css/index.bundle.css?v=5.6',
  '/static/css/goal-notification-improved.css?v=2.1',
  '/static/js/goal-notification-improved.js?v=2.0',
  '/static/js/var-system.js?v=1.0',
  '/static/js/index.bundle.js?v=9.42',
  '/static/js/goal-notification-patch.js?v=2.2',
  '/static/js/copa-engine.js?v=1.9',
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

  /* HTML de navegación: STALE-WHILE-REVALIDATE (ver cabecera del archivo).
     Copia en caché de menos de `HTML_SWR_MAX_AGE_MS` → se sirve AL
     INSTANTE y se revalida en segundo plano. Sin copia utilizable →
     network-first clásico (con la caché de emergencia, más laxa, como
     último recurso si la red falla del todo). */
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.open(CACHE_HTML).then(function (cache) {
        return Promise.all([
          cache.match('/'),
          cache.match('/__ftbol_html_cached_at__').then(function (tsRes) {
            return tsRes ? tsRes.text() : null;
          })
        ]).then(function (r) {
          var cachedRes = r[0];
          var tsText = r[1];
          var ts = tsText ? parseInt(tsText, 10) : NaN;
          var age = isNaN(ts) ? Infinity : (Date.now() - ts);

          if (cachedRes && age <= HTML_SWR_MAX_AGE_MS) {
            /* Clonar YA, síncrono, ANTES de entregar la respuesta: si se
               clona más tarde (dentro de `_revalidateHtmlAndNotify`), hay
               una carrera real con el navegador empezando a CONSUMIR el
               body de `cachedRes` para pintar la página — quien llegue
               2º se encuentra "Response body is already used" y ese
               error queda tragado por el catch genérico de abajo, sin
               ningún síntoma visible (la revalidación simplemente nunca
               avisa de nada, para siempre). Con dos objetos Response
               INDEPENDIENTES desde el principio, cada consumidor lee el
               suyo sin pisarse. `waitUntil` mantiene el SW vivo para
               terminar la revalidación aunque la respuesta ya se haya
               entregado. */
            var cloneForResponse = cachedRes.clone();
            e.waitUntil(_revalidateHtmlAndNotify(cache, cachedRes));
            return cloneForResponse;
          }

          /* Sin copia "fresca" para SWR (1ª visita, o llevas > 30 min sin
             abrir la app) → network-first: se pide la red, y solo si
             falla se recurre a la caché de emergencia (límite más laxo,
             `HTML_CACHE_MAX_AGE_MS`). */
          return fetch(e.request).then(function (res) {
            var resClone = (res && res.ok) ? res.clone() : null;
            if (resClone) _storeHtmlInCache(cache, resClone);
            return res;
          }).catch(function () {
            var fresh = cachedRes && age <= HTML_CACHE_MAX_AGE_MS;
            if (!fresh) {
              /* Demasiado vieja (o sin sello, o no había copia) — NO la
                 servimos. Dejamos que el error de red se propague: el
                 navegador muestra su propio aviso de sin-conexión, en
                 vez de una app con código potencialmente obsoleto o
                 roto. */
              return Promise.reject(new Error('stale html cache'));
            }
            return cachedRes;
          });
        });
      })
    );
  }
});

/* Guarda `res` (ya clonado por el caller) como la copia vigente de '/' +
   su sello de "cuándo se guardó" — el ÚNICO punto que escribe en
   CACHE_HTML, usado tanto por el camino network-first como por la
   revalidación en segundo plano de SWR. */
function _storeHtmlInCache(cache, resClone) {
  try {
    cache.put('/', resClone);
    cache.put('/__ftbol_html_cached_at__', new Response(String(Date.now())));
  } catch (_e) {}
}

/* Pide la versión fresca de '/' en segundo plano (nunca bloquea la
   respuesta ya servida desde caché), actualiza la caché, y — SOLO si el
   contenido cambió de verdad respecto a lo que se acaba de servir — avisa
   a las pestañas abiertas para que muestren el banner de "hay una
   versión nueva" ya existente (`_showSwUpdateBanner` en index.html).
   Comparar por longitud del texto decomprimido (no por Content-Length:
   con gzip/chunked ese header puede faltar) es una heurística barata —
   un falso negativo ocasional (cambio real con la MISMA longitud) se
   autocorrige solo en la siguiente navegación, no es una garantía de
   integridad, solo un aviso de cortesía. */
function _revalidateHtmlAndNotify(cache, oldRes) {
  return fetch('/', { cache: 'no-store' }).then(function (res) {
    if (!res || !res.ok) return;
    var freshForCache = res.clone();
    var freshForCompare = res.clone();
    return Promise.all([
      oldRes.text().catch(function () { return null; }),
      freshForCompare.text().catch(function () { return null; })
    ]).then(function (t) {
      _storeHtmlInCache(cache, freshForCache);
      var oldText = t[0], newText = t[1];
      var changed = (oldText == null || newText == null) ? false : (oldText.length !== newText.length);
      if (!changed) return;
      return self.clients.matchAll({ type: 'window' }).then(function (list) {
        list.forEach(function (c) {
          try { c.postMessage({ type: 'ftbol-html-updated' }); } catch (_e) {}
        });
      });
    });
  }).catch(function () { /* revalidación fallida: sin problema, se reintenta en la próxima navegación */ });
}
