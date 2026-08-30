/* ============================================================
   sync.js — Sincronización entre dispositivos (Fase 5)

   Sin esto, el progreso vive SOLO en el localStorage de CADA
   móvil — nada viaja entre los 6 dispositivos (los calendarios,
   los iconos del menú, la plantilla... solo se veían en el móvil
   donde se editaron; exportar/importar era el único puente, y
   manual). Esta capa empuja/trae en segundo plano TODAS las
   claves "ef7_*" contra /api/ef7/state (server con Postgres
   persistente — ver app.py), sin tocar en ningún momento cómo
   funciona js/estado.js: sigue siendo localStorage-primero, esto
   solo lo mantiene igualado con el servidor.

   Estrategia (LWW por CLAVE, nunca por blob completo — así dos
   admins editando clubes DISTINTOS a la vez nunca se pisan):
     1. Arranque: PULL completo. El servidor manda en el primer
        boot (si ya hay datos ahí de otro dispositivo, se adoptan).
     2. A partir de ahí, cada ciclo:
        a) Detecta qué claves cambiaron LOCALMENTE desde el último
           ciclo reconciliado (diff simple de valores) y las marca
           "pendientes".
        b) Empuja (POST) las pendientes. Solo se dan por
           reconciliadas si su valor no volvió a cambiar mientras
           la petición estaba en vuelo (si cambió, se reintenta en
           el siguiente ciclo con el valor más nuevo).
        c) Trae (GET) el estado del servidor y adopta cualquier
           clave que el servidor tenga distinta a la local — PERO
           NUNCA una que siga pendiente de subir (evita que un pull
           tardío pise una edición local que aún no se ha
           confirmado en el servidor).
   ============================================================ */
(function () {
  "use strict";

  if (!window.Estado || typeof fetch !== "function") return;

  var ENDPOINT = "/api/ef7/state";
  var INTERVALO_MS = 10000;
  var PREFIJO = "ef7_";

  // "Último valor reconciliado" por clave (local == servidor la última
  // vez que los comparamos). Vive en memoria — no hace falta persistirlo,
  // el primer ciclo de cada carga de página siempre reconstruye el
  // estado real comparando contra el servidor.
  var _snapshot = {};
  var _pendientes = {}; // clave -> true mientras haya un cambio local sin confirmar en el servidor
  var _enVuelo = false;
  var _primerCicloHecho = false;

  function _clavesLocales() {
    var backup = window.Estado.exportarEstadoCrudo();
    return (backup && backup.claves) || {};
  }

  function _marcarUiActualizada() {
    document.dispatchEvent(new CustomEvent("ef7-sync-actualizado"));
  }

  // Detecta claves cuyo valor local difiere de `_snapshot` (cambio
  // hecho por el propio usuario en ESTE dispositivo desde el último
  // ciclo) y las añade a `_pendientes`. Nunca quita nada de aquí — solo
  // el push con éxito limpia una clave pendiente.
  function _detectarCambiosLocales(actuales) {
    Object.keys(actuales).forEach(function (k) {
      if (actuales[k] !== _snapshot[k]) _pendientes[k] = true;
    });
  }

  function _empujarPendientes(actuales) {
    var claves = Object.keys(_pendientes);
    if (!claves.length) return Promise.resolve();

    var cuerpo = {};
    claves.forEach(function (k) { cuerpo[k] = actuales[k]; });

    return fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claves: cuerpo })
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (resp) {
        if (!resp || !resp.ok) return;
        var actualesTrasEnviar = _clavesLocales();
        (resp.guardadas || []).forEach(function (k) {
          // Solo se da por reconciliada si el valor no volvió a cambiar
          // MIENTRAS la petición estaba en vuelo — si cambió, se deja
          // pendiente para reintentar con el valor más reciente.
          if (actualesTrasEnviar[k] === cuerpo[k]) {
            _snapshot[k] = cuerpo[k];
            delete _pendientes[k];
          }
        });
      })
      .catch(function (err) {
        console.warn("[sync] push falló (sin conexión / servidor no disponible):", err);
      });
  }

  function _traerDelServidor() {
    return fetch(ENDPOINT)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (resp) {
        if (!resp || !resp.ok || !resp.claves) return;
        var actuales = _clavesLocales();
        var huboCambio = false;
        Object.keys(resp.claves).forEach(function (k) {
          if (k.indexOf(PREFIJO) !== 0) return;
          if (_pendientes[k]) return; // hay un cambio local sin confirmar: el servidor NO lo pisa
          var valorServidor = resp.claves[k];
          if (typeof valorServidor !== "string") return; // esta app solo guarda strings (igual que localStorage)
          if (valorServidor === actuales[k]) {
            _snapshot[k] = valorServidor;
            return;
          }
          try {
            localStorage.setItem(k, valorServidor);
            _snapshot[k] = valorServidor;
            huboCambio = true;
          } catch (err) {
            console.error("[sync] no se pudo escribir la clave recibida del servidor:", k, err);
          }
        });
        if (huboCambio) {
          if (window.Estado.invalidarCache) window.Estado.invalidarCache();
          _marcarUiActualizada();
        }
      })
      .catch(function (err) {
        console.warn("[sync] pull falló (sin conexión / servidor no disponible):", err);
      });
  }

  function _ciclo() {
    if (_enVuelo) return;
    _enVuelo = true;

    var actuales = _clavesLocales();
    _detectarCambiosLocales(actuales);

    var cadena;
    if (!_primerCicloHecho) {
      // Primer ciclo de la sesión: el servidor manda primero (si otro
      // dispositivo ya tiene datos aquí, se adoptan) ANTES de empezar a
      // empujar lo local — evita que un móvil que arranca con datos
      // locales viejos/placeholder machaque lo que ya había en el
      // servidor desde otro dispositivo.
      cadena = _traerDelServidor().then(function () {
        _primerCicloHecho = true;
        return _empujarPendientes(_clavesLocales());
      });
    } else {
      cadena = _empujarPendientes(actuales).then(_traerDelServidor);
    }

    return cadena.then(function () { _enVuelo = false; });
  }

  document.addEventListener("DOMContentLoaded", function () {
    _ciclo();
    setInterval(_ciclo, INTERVALO_MS);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") _ciclo();
    });
    window.addEventListener("beforeunload", function () {
      // Best-effort — no bloqueante, no hay garantía de que llegue, pero
      // reduce la ventana de "cerré la app antes del próximo ciclo".
      var actuales = _clavesLocales();
      _detectarCambiosLocales(actuales);
      var claves = Object.keys(_pendientes);
      if (!claves.length || !navigator.sendBeacon) return;
      var cuerpo = {};
      claves.forEach(function (k) { cuerpo[k] = actuales[k]; });
      try {
        navigator.sendBeacon(ENDPOINT, new Blob([JSON.stringify({ claves: cuerpo })], { type: "application/json" }));
      } catch (err) {}
    });
  });

  window.Sync = { forzarCiclo: _ciclo };
})();
