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

   FIX 2026 — el "último valor reconciliado" (_snapshot) DEBE
   sobrevivir a un recargo de página. Si arranca vacío (como estaba
   antes), el paso "a" de arriba marca TODAS las claves que ya
   tengan algún valor local como "pendientes" — incluso las que
   nunca se han tocado en esta sesión — porque cualquier valor
   difiere de `undefined`. Eso hace que el paso "c" del PRIMER ciclo
   (el que debía dejar mandar al servidor) se salte esas claves por
   estar "pendientes", y el dispositivo acaba EMPUJANDO su copia
   local — aunque sea más vieja/pobre que la del servidor — y la
   PISA para siempre. Fue así como se borraron títulos ya guardados
   de un club: un móvil con una copia más antigua de esa clave la
   sobrescribió sin darse cuenta en su primer ciclo de sync.
   Solución: `_snapshot` se persiste (como hash corto por clave, no
   el valor completo — no duplicar el peso de cada clave) en
   localStorage bajo SNAPSHOT_KEY, y se recarga al arrancar. Además,
   si el PRIMER pull de la sesión falla (red/cold-start del
   servidor), ese ciclo no empuja nada — se reintenta el pull en el
   siguiente, nunca se empuja a ciegas sin haber confirmado antes
   contra el servidor.
   ============================================================ */
(function () {
  "use strict";

  if (!window.Estado || typeof fetch !== "function") return;

  var ENDPOINT = "/api/ef7/state";
  var INTERVALO_MS = 10000;
  var PREFIJO = "ef7_";
  // Fuera del prefijo "ef7_" a propósito: así _clavesDeLaApp()/
  // exportarEstadoCrudo() (js/estado.js) nunca la confunde con datos
  // de la app — no viaja al servidor ni se mete en el export/backup.
  var SNAPSHOT_KEY = "efsync_snapshot_v1";

  // Hash corto (no criptográfico) — solo para saber "¿este valor es el
  // mismo que reconciliamos la última vez?" sin tener que persistir el
  // contenido COMPLETO de cada clave por duplicado (que puede pesar
  // bastante con calendarios/plantillas de 6 clubes).
  function _hash(s) {
    s = String(s == null ? "" : s);
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return s.length + ":" + h.toString(36);
  }

  function _cargarSnapshotPersistido() {
    try {
      var raw = localStorage.getItem(SNAPSHOT_KEY);
      var obj = raw ? JSON.parse(raw) : null;
      return obj && typeof obj === "object" ? obj : {};
    } catch (err) {
      return {};
    }
  }
  function _guardarSnapshotPersistido() {
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(_snapshot));
    } catch (err) { /* no crítico — peor caso, se re-detecta como pendiente en el próximo arranque */ }
  }

  // "Último valor reconciliado" por clave (local == servidor la última
  // vez que los comparamos), como hash — persistido para sobrevivir a
  // un recargo de página (ver nota FIX 2026 de la cabecera).
  var _snapshot = _cargarSnapshotPersistido();
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
      if (_hash(actuales[k]) !== _snapshot[k]) _pendientes[k] = true;
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
        var huboConfirmadas = false;
        (resp.guardadas || []).forEach(function (k) {
          // Solo se da por reconciliada si el valor no volvió a cambiar
          // MIENTRAS la petición estaba en vuelo — si cambió, se deja
          // pendiente para reintentar con el valor más reciente.
          if (actualesTrasEnviar[k] === cuerpo[k]) {
            _snapshot[k] = _hash(cuerpo[k]);
            delete _pendientes[k];
            huboConfirmadas = true;
          }
        });
        if (huboConfirmadas) _guardarSnapshotPersistido();
      })
      .catch(function (err) {
        console.warn("[sync] push falló (sin conexión / servidor no disponible):", err);
      });
  }

  // Devuelve `true` si el pull llegó a completarse con éxito (haya
  // habido o no cambios que adoptar) y `false` si falló — el caller de
  // arranque (_ciclo, primer ciclo) lo usa para NO empujar nada a
  // ciegas si todavía no se ha podido confirmar nada contra el
  // servidor (ver nota FIX 2026 de la cabecera).
  function _traerDelServidor() {
    return fetch(ENDPOINT)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (resp) {
        if (!resp || !resp.ok || !resp.claves) return false;
        var actuales = _clavesLocales();
        var huboCambio = false;
        var huboSnapshotNuevo = false;
        Object.keys(resp.claves).forEach(function (k) {
          if (k.indexOf(PREFIJO) !== 0) return;
          if (_pendientes[k]) return; // hay un cambio local sin confirmar: el servidor NO lo pisa
          var valorServidor = resp.claves[k];
          if (typeof valorServidor !== "string") return; // esta app solo guarda strings (igual que localStorage)
          if (valorServidor === actuales[k]) {
            _snapshot[k] = _hash(valorServidor);
            huboSnapshotNuevo = true;
            return;
          }
          try {
            localStorage.setItem(k, valorServidor);
            _snapshot[k] = _hash(valorServidor);
            huboCambio = true;
            huboSnapshotNuevo = true;
          } catch (err) {
            console.error("[sync] no se pudo escribir la clave recibida del servidor:", k, err);
          }
        });

        // AUTO-REPARACIÓN — si `_snapshot` cree que una clave YA está
        // confirmada con el servidor (mismo hash reconciliado en un ciclo
        // anterior) pero el servidor, AHORA, no la tiene en absoluto (se
        // perdió: reinicio de base de datos, migración, fila borrada...),
        // ese "ya está sincronizada" es mentira. Sin este chequeo el
        // dispositivo se queda creyendo PARA SIEMPRE que no hay nada que
        // subir — ni cerrar y reabrir la app lo arregla, porque
        // `_snapshot` vive en localStorage y sobrevive a los reinicios de
        // pestaña. Se vuelve a marcar pendiente para que el próximo push
        // la restaure sola.
        Object.keys(_snapshot).forEach(function (k) {
          if (Object.prototype.hasOwnProperty.call(resp.claves, k)) return; // el servidor SÍ la tiene
          if (actuales[k] === undefined) return; // tampoco existe en local, nada que restaurar
          delete _snapshot[k];
          _pendientes[k] = true;
          huboSnapshotNuevo = true;
        });

        if (huboSnapshotNuevo) _guardarSnapshotPersistido();
        if (huboCambio) {
          if (window.Estado.invalidarCache) window.Estado.invalidarCache();
          _marcarUiActualizada();
        }
        return true;
      })
      .catch(function (err) {
        console.warn("[sync] pull falló (sin conexión / servidor no disponible):", err);
        return false;
      });
  }

  function _ciclo() {
    if (_enVuelo) return;
    _enVuelo = true;

    // `_snapshot` ya viene persistido (ver arriba) — con eso,
    // `_detectarCambiosLocales` puede volver a llamarse aquí SIEMPRE,
    // incluso en el primer ciclo de la sesión: una clave que no ha
    // cambiado desde la última vez que se confirmó con el servidor
    // (hash igual al persistido) no se marca pendiente, así que el
    // pull de abajo puede adoptar sin problema el valor del servidor
    // si es más rico. Una clave con una edición local genuina desde
    // el último cierre de la app SÍ se marca pendiente y queda
    // protegida frente al pull, en cualquier ciclo.
    var actuales = _clavesLocales();
    _detectarCambiosLocales(actuales);

    var cadena;
    if (!_primerCicloHecho) {
      // Primer ciclo de la sesión: el servidor manda primero (si otro
      // dispositivo ya tiene datos aquí, se adoptan) ANTES de empezar a
      // empujar lo local. Si el pull falla (red/cold-start del
      // servidor), este ciclo no empuja nada — se reintenta el pull en
      // el siguiente (defensa extra para un dispositivo SIN snapshot
      // persistido todavía, p. ej. la primera vez que abre la app; ver
      // nota FIX 2026 de la cabecera).
      cadena = _traerDelServidor().then(function (pullOk) {
        if (!pullOk) return;
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
