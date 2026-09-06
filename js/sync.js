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

  // ---------- Aviso si una clave NUNCA consigue sincronizar ----------
  // El servidor responde 200 OK a /api/ef7/state incluso cuando RECHAZA
  // en silencio alguna clave del cuerpo (app.py::api_ef7_state_post), por
  // 2 motivos distintos: (a) el JSON supera 2 MB (_KV_MAX_BYTES) — solo
  // realista en la clave grande de resultados/actas (ef7_estado_liga_v1),
  // que no tiene archivado automático de temporadas antiguas; o (b) el
  // "guard de regresión" (_ef7_es_regresion_grave) — CUALQUIER otra
  // clave (calendario extra de un club, plantilla, textos de Liga 1ª
  // REF...) cuyo valor entrante sea MUCHO más corto que el ya guardado en
  // el servidor: típico de un dispositivo con una copia vieja/vacía (tras
  // importar una copia de seguridad antigua, o llevar mucho sin
  // sincronizar) intentando pisar lo que el admin acaba de terminar de
  // pegar en OTRO dispositivo. Sin este contador, una clave así queda en
  // `_pendientes` INDEFINIDAMENTE: se reintenta cada 10 s, cada vez sin
  // éxito, sin avisar nunca — este dispositivo sigue viéndose "normal"
  // con SU copia (la vieja/pobre), sin enterarse de que el servidor (y
  // todos los demás) tienen la buena.
  var UMBRAL_AVISO_SYNC_ATASCADO = 5; // ~5 ciclos (INTERVALO_MS) seguidos sin éxito
  var _intentosFallidos = {}; // clave -> nº de ciclos seguidos rechazada por el servidor
  var _avisoSyncMostrado = false;
  function _avisarSyncAtascado(clave) {
    if (_avisoSyncMostrado) return;
    _avisoSyncMostrado = true;
    try {
      window.setTimeout(function () {
        window.alert(
          "⚠️ La copia de \"" + clave + "\" de ESTE dispositivo no se pudo subir al servidor " +
          "tras varios intentos — probablemente porque el servidor ya tiene una versión más " +
          "completa (p. ej. si aquí se importó una copia de seguridad antigua) y la protege para " +
          "que no se pierda por accidente.\n\n" +
          "Este dispositivo va a adoptar AHORA la versión del servidor — si de verdad querías " +
          "guardar un cambio grande aquí, vuelve a hacerlo tras comprobar que el resto de " +
          "dispositivos ya lo reflejan."
        );
      }, 0);
    } catch (err2) { /* nada más que hacer si ni alert está disponible */ }
  }

  // Mismo umbral/criterio que app.py::_ef7_es_regresion_grave, aplicado
  // aquí en la dirección CONTRARIA (PULL en vez de PUSH): protege a ESTE
  // dispositivo de adoptar a ciegas una copia del servidor mucho más
  // pobre que la que ya tiene en local. El guard del servidor por sí solo
  // no basta — si el servidor YA se quedó con una copia vieja/vacía
  // (p. ej. otro dispositivo la pisó ANTES de que existiera ese guard, o
  // importó una copia de seguridad de hace días), un dispositivo con la
  // copia buena la habría perdido igualmente al sincronizar, sin que
  // nadie la hubiera tocado aquí. Umbral idéntico: por debajo de 20
  // caracteres no se protege (ruido/campos cortos); por debajo de la
  // mitad del tamaño local, se considera una regresión.
  var _REGRESION_LEN_MINIMO = 20;
  function _esRegresionGrave(valorLocal, valorServidor) {
    if (typeof valorLocal !== "string" || valorLocal.length < _REGRESION_LEN_MINIMO) return false;
    return valorServidor.length < valorLocal.length * 0.5;
  }

  // Única EXCEPCIÓN al guard de arriba: "🗑️ Borrar TODO" (ver
  // js/estado.js::borrarTodo) es una regresión LEGÍTIMA y deliberada de
  // ef7_estado_liga_v1 — vacía a propósito, y DEBE llegar a un
  // dispositivo que todavía tenga partidos jugados en local (si no,
  // "Borrar TODO" nunca resetearía a los otros 5 móviles, que es
  // justamente lo que promete). Se reconoce por el sello
  // `_resetGlobalEn` que app.py::_ef7_merge_resultados ya usa para
  // decidir lo mismo en el servidor: si el valor del servidor lleva un
  // sello MÁS RECIENTE que el que este dispositivo conoce, es un reset
  // de verdad — no una copia vieja/huérfana — y se adopta pese a ser
  // más corto.
  var CLAVE_RESULTADOS = "ef7_estado_liga_v1"; // igual que app.py::_EF7_ESTADO_LIGA_KEY
  function _selloReset(valorStr) {
    try {
      var obj = JSON.parse(valorStr);
      var v = obj && obj._resetGlobalEn;
      return typeof v === "number" ? v : 0;
    } catch (err) {
      return 0;
    }
  }
  function _esReseteoGlobalLegitimo(clave, valorLocal, valorServidor) {
    if (clave !== CLAVE_RESULTADOS) return false;
    return _selloReset(valorServidor) > _selloReset(valorLocal);
  }

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
        var confirmadasSet = {};
        (resp.guardadas || []).forEach(function (k) {
          confirmadasSet[k] = true;
          // Solo se da por reconciliada si el valor no volvió a cambiar
          // MIENTRAS la petición estaba en vuelo — si cambió, se deja
          // pendiente para reintentar con el valor más reciente.
          if (actualesTrasEnviar[k] === cuerpo[k]) {
            _snapshot[k] = _hash(cuerpo[k]);
            delete _pendientes[k];
            delete _intentosFallidos[k];
            huboConfirmadas = true;
          }
        });
        // Una clave que se mandó pero el servidor NO devolvió en
        // `guardadas` fue RECHAZADA en silencio (formato inválido, límite
        // de 2 MB, o el guard de regresión de app.py — ver
        // _avisarSyncAtascado más arriba). Sigue en `_pendientes` para
        // reintentarse unos ciclos, por si el rechazo fuera transitorio,
        // pero tras varios seguidos sin éxito NO se deja atascada para
        // siempre insistiendo con SU copia: se abandona (se quita de
        // `_pendientes` y se avisa) para que el SIGUIENTE pull la trate
        // como cualquier otra clave sin edición local pendiente y adopte
        // la del servidor — sin este auto-abandono, un dispositivo con
        // una copia vieja/vacía se quedaría viendo esa copia para
        // siempre, sin enterarse nunca de que el resto tiene la buena
        // (el guard del servidor protege a los DEMÁS, pero por sí solo no
        // arregla la vista de ESTE dispositivo).
        claves.forEach(function (k) {
          if (confirmadasSet[k]) return;
          _intentosFallidos[k] = (_intentosFallidos[k] || 0) + 1;
          if (_intentosFallidos[k] >= UMBRAL_AVISO_SYNC_ATASCADO) {
            _avisarSyncAtascado(k);
            // Se limpia YA (no en el próximo ciclo): en la rama normal
            // (no primer ciclo) el pull de este mismo _ciclo() corre
            // justo después de este .then, así que la clave abandonada
            // adopta la copia del servidor sin esperar 10 s más.
            delete _pendientes[k];
            delete _intentosFallidos[k];
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
        // RE-detecta cambios locales AQUÍ, con el valor recién leído —
        // no basta con lo que _detectarCambiosLocales ya marcó al
        // EMPEZAR el ciclo (antes de este fetch). Si el admin edita y
        // guarda una clave (p. ej. pega el Calendario extra corregido de
        // un club) justo MIENTRAS este GET está en vuelo, esa edición
        // nunca se marcó pendiente para este ciclo — sin este re-chequeo
        // el pull de abajo la pisaba con el valor viejo del servidor en
        // cuanto la respuesta llegaba. Bug real (reporte usuario: "se me
        // ha ido lo que te di del calendario de Copa del Rey... otra vez
        // vuelve a salir 1 ronda menos" — la re-pegó, guardó, y un pull
        // en vuelo en ESE instante la sobrescribió con la versión vieja
        // en cuanto resolvió, sin que hiciera falta ningún otro
        // dispositivo). Barato: es la misma comparación de hash de
        // siempre, solo repetida con el valor más fresco posible.
        _detectarCambiosLocales(actuales);
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
          // El servidor tiene una copia MUCHO más pobre que la de este
          // dispositivo (ver _esRegresionGrave arriba) — no se adopta,
          // SALVO que sea un "🗑️ Borrar TODO" legítimo más reciente
          // (ver _esReseteoGlobalLegitimo) — ese SÍ debe pisar aunque
          // este dispositivo tenga partidos jugados en local, o el
          // reseteo nunca llegaría a los otros 5 móviles. Cuando no lo
          // es, se marca PENDIENTE para que el próximo push suba la
          // copia buena de este dispositivo y la "cure" en el servidor
          // (el guard de app.py deja pasar ese push porque va a MEJOR,
          // nunca a peor) — así el dispositivo con la copia rica es el
          // que gana, sea cual sea el orden en que cada uno sincronizó.
          if (_esRegresionGrave(actuales[k], valorServidor) && !_esReseteoGlobalLegitimo(k, actuales[k], valorServidor)) {
            _pendientes[k] = true;
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
