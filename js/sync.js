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

  // ---------- Claves que se empujan SALTÁNDOSE el guard de regresión del
  // servidor (app.py::_ef7_es_regresion_grave) ----------
  // Reporte usuario 2026-09-22 ("Añadí todo nuevo... Absolutamente todo...
  // abro la web y sale todo lo antiguo"): el guard de regresión (pensado
  // para proteger contra un dispositivo con copia VIEJA/VACÍA pisando la
  // buena) trata IGUAL una copia vieja accidental que un recorte GRANDE y
  // DELIBERADO del admin — "🧹 Reiniciar TODA la pirámide a cero" sustituye
  // la clasificación de una temporada entera (con puntos/goles reales) por
  // un texto "todo a cero" mucho más corto, y una plantilla con muchas
  // bajas puede encoger a menos de la mitad igual de fácil. Sin esta vía,
  // ese recorte legítimo se rechaza en el servidor, se reintenta ~50 s
  // (5 ciclos) y termina ABANDONADO — este dispositivo adopta de vuelta la
  // copia vieja del servidor, exactamente lo que el admin acababa de
  // borrar a propósito.
  //
  // `marcarParaForzar(clave)` lo llama código que ya sabe (por su propio
  // confirm() explícito, o por preguntárselo al admin — ver
  // js/estado.js::_confirmarSiEncogeMucho) que este recorte es intencional.
  // La clave se manda en el próximo push dentro de `forzar` (ver
  // `_empujarPendientes`) y el servidor la exime del guard SOLO para ese
  // push — no cambia nada del resto de protecciones (tamaño máximo,
  // formato, etc.), y una clave que no está en `_pendientes` no se llega a
  // enviar aunque esté marcada. Se limpia igual que `_intentosFallidos` en
  // cuanto el servidor confirma el guardado.
  var _forzar = {}; // clave -> true mientras el próximo push deba saltarse el guard de regresión
  function marcarParaForzar(clave) {
    if (typeof clave === "string" && clave) _forzar[clave] = true;
  }

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
  // Reporte usuario 2026-09-22 ("Añadí todo nuevo... abro la web y sale
  // todo lo antiguo"): este flag era un ÚNICO booleano GLOBAL, así que solo
  // avisaba la PRIMERA vez que CUALQUIER clave se atascaba en TODA la
  // sesión — si esa misma tanda de ediciones (p.ej. las 4 clasificaciones +
  // 5 plantillas de la pirámide, empujadas juntas en el MISMO ciclo) hacía
  // que 2+ claves distintas se atascaran a la vez, solo la PRIMERA del
  // forEach mostraba el aviso; las demás se abandonaban y se pisaban con la
  // copia del servidor EN SILENCIO, sin que el admin llegara a enterarse de
  // que también se habían perdido. Ahora es por CLAVE — cada clave que se
  // atasca avisa una vez, sea la primera o la quinta de la misma sesión.
  var _avisoMostradoPara = {};
  function _avisarSyncAtascado(clave) {
    if (_avisoMostradoPara[clave]) return;
    _avisoMostradoPara[clave] = true;
    try {
      window.setTimeout(function () {
        // "ef7_estado_liga_v1" (los resultados/actas) NUNCA se abandona
        // ni se adopta la copia del servidor (ver el comentario junto a
        // CLAVE_RESULTADOS en _empujarPendientes) — el aviso debe decir
        // la verdad: sigue intentándose, no que "se va a adoptar ahora".
        var esResultados = clave === CLAVE_RESULTADOS;
        window.alert(
          esResultados
            ? ("⚠️ Los resultados/actas confirmados en ESTE dispositivo no se han podido subir " +
               "al servidor tras varios intentos — probablemente porque el historial completo de " +
               "la temporada ya pesa demasiado para guardarse de una vez.\n\n" +
               "NO se pierde nada: se sigue reintentando en segundo plano y este dispositivo " +
               "conserva su copia. Si el problema persiste, avisa para revisar el tamaño del " +
               "historial guardado.")
            : ("⚠️ La copia de \"" + clave + "\" de ESTE dispositivo no se pudo subir al servidor " +
               "tras varios intentos — probablemente porque el servidor ya tiene una versión más " +
               "completa (p. ej. si aquí se importó una copia de seguridad antigua) y la protege para " +
               "que no se pierda por accidente.\n\n" +
               "Este dispositivo va a adoptar AHORA la versión del servidor — si de verdad querías " +
               "guardar un cambio grande aquí, vuelve a hacerlo tras comprobar que el resto de " +
               "dispositivos ya lo reflejan.")
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

  // ---------- Guard DEDICADO para ef7_estado_liga_v1 (reporte usuario
  // 2026-09-13: "no se ha guardado ningún de los partidos de anoche") ----------
  // `_esRegresionGrave` de arriba solo protege si el servidor pierde MÁS
  // DE LA MITAD del contenido — funciona bien para texto libre, pero es
  // completamente ciego a "el servidor le falta SOLO los 4 partidos de
  // anoche" cuando el blob entero acumula toda una temporada: esos 4
  // partidos pueden ser un porcentaje minúsculo del total, así que nunca
  // cruzan el umbral del 50% y el pull de abajo los ADOPTABA igualmente,
  // borrando en este mismo dispositivo la única copia que existía de
  // ellos. Para esta clave concreta el criterio correcto NO es tamaño —
  // es "¿el servidor tiene TODOS los partidos que yo ya tengo?": basta con
  // que le falte UN SOLO id de partido que este dispositivo sí conoce para
  // que sea una regresión real, sea cual sea el tamaño relativo del resto
  // del blob.
  function _resultadosDeObj(valorStr) {
    try {
      var obj = JSON.parse(valorStr);
      var res = obj && obj.resultados;
      return res && typeof res === "object" ? res : {};
    } catch (err) {
      return {};
    }
  }
  // Firma EXACTA de un reinicio deliberado — la misma que producen
  // js/estado.js::_tumbaDeResultado (`_borrado:true`) y
  // ::marcarPartidoPospuesto (`pospuesto:true`). Espejo del guard
  // servidor de app.py::_ef7_merge_resultados (ver comentario ahí).
  function _esTumbaReconocible(entry) {
    return !!(entry && (entry._borrado === true || entry.pospuesto === true));
  }
  function _esRegresionResultados(valorLocal, valorServidor) {
    var resLocal = _resultadosDeObj(valorLocal);
    var idsLocal = Object.keys(resLocal);
    if (!idsLocal.length) return false; // nada local que proteger todavía
    var resServidor = _resultadosDeObj(valorServidor);
    for (var i = 0; i < idsLocal.length; i++) {
      var id = idsLocal[i];
      var entryServidor = resServidor[id];
      if (!entryServidor) return true; // le falta un partido que YA tenemos aquí
      var entryLocal = resLocal[id];
      // Un partido que este dispositivo YA tiene CONFIRMADO como jugado
      // y que el servidor devuelve como no-jugado SOLO se acepta si trae
      // una tumba/pospuesto reconocible — cualquier otra forma se trata
      // como regresión (aunque el resto del blob del servidor sea más
      // reciente), y el pull de abajo la descarta + re-empuja esta copia
      // local para "curar" al servidor. Protege contra "se finaliza un
      // partido y al volver a abrirlo aparece como no jugado" causado
      // por CUALQUIER ruta que produzca una entrada mal formada, no solo
      // las ya identificadas (reinicio masivo de HvH).
      if (entryLocal && entryLocal.jugado === true && !(entryServidor && entryServidor.jugado === true) && !_esTumbaReconocible(entryServidor)) {
        return true;
      }
      // NUEVO (reporte usuario 2026-09-14, «Has duplicado dos veces el
      // resultado de 10-5 / Es una vez 10-5 y una vez 4-1»): el guard de
      // arriba solo cubre "jugado:true -> false". Una Superliga es
      // Humano vs Humano — el MISMO match_id puede confirmarse desde
      // CUALQUIERA de los 2 dispositivos de los clubes implicados, así
      // que el servidor puede traer este partido TAMBIÉN jugado:true
      // pero con un marcador DISTINTO (otro mánager confirmó lo mismo
      // desde su móvil). Sin este chequeo, ese "jugado:true" bastaba
      // para no considerarlo regresión y se adoptaba sin más — pisando
      // en este dispositivo un acta real (goles/tarjetas/MVP, `jug` no
      // vacío) con un marcador más pobre/erróneo que no la trae. Se
      // protege SOLO en ese caso concreto (acta real aquí, nada
      // equivalente en el servidor) — si ambas copias tienen acta, o
      // ninguna, no hay ninguna señal objetiva para preferir una sobre
      // otra y se deja el criterio de siempre (recencia/servidor manda).
      // Espejo exacto de app.py::_ef7_merge_resultados, que cierra el
      // mismo hueco en la fusión del propio servidor.
      if (
        entryLocal && entryLocal.jugado === true && entryServidor.jugado === true &&
        (entryLocal.golesLocal !== entryServidor.golesLocal || entryLocal.golesVisitante !== entryServidor.golesVisitante) &&
        Array.isArray(entryLocal.jug) && entryLocal.jug.length > 0 &&
        !(Array.isArray(entryServidor.jug) && entryServidor.jug.length > 0)
      ) {
        return true;
      }
      // NUEVO (reporte usuario: "no se están subiendo las estadísticas de
      // estos 2 partidos en la Plantilla del Atlético Madrid" — marcador
      // y calendario perfectos en TODAS partes, pero 0 goles/tarjetas/MVP
      // para esos 2 partidos concretos): el guard de arriba solo cubre el
      // marcador DISTINTO. El caso real y mucho más común es justo el
      // opuesto — el MISMO marcador en las 2 copias (no hay ningún
      // conflicto de resultado, es una re-sincronización normal) pero una
      // de las 2 perdió el acta (`jug`) por el camino: p.ej. el servidor
      // todavía no había recibido el push con el acta cuando otra ruta
      // (otra pestaña de este mismo dispositivo, u otro móvil confirmando
      // el mismo cruce) volvió a escribir ESTE MISMO match_id sin acta.
      // Sin acta compacta, `Renderizadores.calcularStatsRosterClub`/Liga
      // 1ª REF nunca ven los goles/tarjetas/MVP de ese partido — el
      // marcador sigue siendo correcto en todos lados, así que nada más
      // delata el problema. Mismo criterio que el guard de arriba: basta
      // con que la copia LOCAL tenga acta real y la del servidor no, para
      // bloquear la adopción y dejar que el próximo push "cure" al
      // servidor con la copia completa. Espejo exacto del guard nuevo de
      // app.py::_ef7_merge_resultados.
      if (
        entryLocal && entryLocal.jugado === true && entryServidor.jugado === true &&
        entryLocal.golesLocal === entryServidor.golesLocal && entryLocal.golesVisitante === entryServidor.golesVisitante &&
        Array.isArray(entryLocal.jug) && entryLocal.jug.length > 0 &&
        !(Array.isArray(entryServidor.jug) && entryServidor.jug.length > 0)
      ) {
        return true;
      }
    }
    return false;
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
    var claves = (backup && backup.claves) || {};
    // ef7_estado_liga_v1 se lee de MEMORIA, no de localStorage (ver
    // js/estado.js::estadoLigaCrudoEnMemoria) — si el guardado local
    // reventó por cuota llena, `_estado` en memoria YA tiene el partido
    // recién confirmado aunque el disco se quedara con la copia vieja;
    // sin esto, el sync nunca se enteraba de que había algo nuevo que
    // subir y el resultado se perdía al recargar la página (reporte
    // usuario: "se borra todo el rato" — coincide con los mismos
    // partidos que la propia sesión SÍ mostraba como FINALIZADO segundos
    // antes de recargar/cerrar la app).
    if (window.Estado.estadoLigaCrudoEnMemoria) {
      var enMemoria = window.Estado.estadoLigaCrudoEnMemoria();
      if (typeof enMemoria === "string") claves[CLAVE_RESULTADOS] = enMemoria;
    }
    return claves;
  }

  // fetch con TIMEOUT. Sin esto, una petición colgada (cambio WiFi/datos,
  // arranque en frío de Render, red móvil que se queda a medias) dejaba
  // `_enVuelo = true` PARA SIEMPRE: ese móvil no volvía a subir NI a traer
  // nada hasta recargar la página — los partidos que jugaba su mánager se
  // quedaban solo en ese teléfono. Con el timeout el ciclo siempre termina
  // y se reintenta a los 10 s.
  var TIMEOUT_PETICION_MS = 45000;
  function _fetchConTimeout(url, opciones) {
    if (typeof AbortController !== "function") return fetch(url, opciones);
    var ctl = new AbortController();
    var t = setTimeout(function () { try { ctl.abort(); } catch (err) {} }, TIMEOUT_PETICION_MS);
    var o = opciones ? Object.assign({}, opciones) : {};
    o.signal = ctl.signal;
    return fetch(url, o).then(
      function (r) { clearTimeout(t); return r; },
      function (err) { clearTimeout(t); throw err; }
    );
  }

  // El servidor (Python) devuelve `ef7_estado_liga_v1` re-serializado con
  // espacios (`"a": 1, "b": 2`) y el cliente lo guarda compacto
  // (`"a":1,"b":2`). Con esa diferencia de FORMATO, "¿es el mismo valor que
  // ya tengo?" daba siempre NO: cada ciclo de 10 s el dispositivo se creía
  // con un cambio local pendiente (volvía a subir los ~80 KB enteros) y a
  // continuación "adoptaba" el del servidor (reescribía localStorage,
  // invalidaba la caché y repintaba la pantalla), alternando sin parar.
  // Se normaliza SIEMPRE a la forma compacta del cliente antes de comparar,
  // hashear o guardar.
  function _normalizarJson(valor) {
    if (typeof valor !== "string") return valor;
    try { return JSON.stringify(JSON.parse(valor)); } catch (err) { return valor; }
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

  // ---------- ENVÍO INCREMENTAL de resultados (ef7_estado_liga_v1) ----------
  // Esta clave es un blob de ~80 KB que crece con cada partido, y se re-subía
  // ENTERO tras cada confirmación. Ahora, salvo el primer envío, solo viajan
  // los partidos que cambiaron desde el último envío confirmado (0,3–1 KB):
  // llega antes, gasta datos mínimos y es lo bastante pequeño para salir con
  // `keepalive` aunque la app se vaya a segundo plano justo al confirmar. El
  // servidor los fusiona con la MISMA lógica partido a partido de siempre
  // (/api/ef7/resultado -> app.py::_ef7_merge_resultados).
  //
  // `efsync_res_v1` (fuera del prefijo ef7_: no se sincroniza ni entra en las
  // copias) recuerda { r: último reseteo global enviado, g: hash de los
  // partidos generados, m: { idPartido: hash de su contenido } } de lo que YA
  // está en el servidor. Se compara por CONTENIDO, no por fecha: cualquier
  // cambio en un partido (aunque no actualice `_actualizadoEn`) se envía.
  var ENDPOINT_RES = "/api/ef7/resultado";
  var META_RES_KEY = "efsync_res_v1";
  function _metaRes() {
    try {
      var m = JSON.parse(localStorage.getItem(META_RES_KEY) || "null");
      return m && typeof m === "object" && m.m && typeof m.m === "object" ? m : null;
    } catch (err) { return null; }
  }
  function _guardarMetaRes(m) {
    try { localStorage.setItem(META_RES_KEY, JSON.stringify(m)); } catch (err) {}
  }
  function _hashEntrada(e) { return _hash(JSON.stringify(e)); }
  // Marca como "ya en el servidor" los partidos de `valorStr` (todos, o solo
  // `soloIds`). Se usa tras un envío confirmado y al ADOPTAR el blob del
  // servidor (lo que viene de allí está en el servidor por definición).
  function _marcarSubidos(valorStr, soloIds) {
    var obj;
    try { obj = JSON.parse(valorStr); } catch (err) { return; }
    if (!obj || typeof obj !== "object") return;
    var res = obj.resultados && typeof obj.resultados === "object" ? obj.resultados : {};
    var meta = _metaRes() || { r: 0, g: "", m: {} };
    var ids = soloIds || Object.keys(res);
    ids.forEach(function (id) { if (res[id]) meta.m[id] = _hashEntrada(res[id]); });
    var reset = typeof obj._resetGlobalEn === "number" ? obj._resetGlobalEn : 0;
    if (reset > (meta.r || 0)) meta.r = reset;
    if (!soloIds) meta.g = _hash(JSON.stringify(obj.partidosGenerados || {}));
    _guardarMetaRes(meta);
  }
  // Devuelve { obj, delta, n, gCambio, reciente } o `null` si hay que hacer un
  // envío COMPLETO (primer envío de este dispositivo o reseteo global nuevo).
  function _construirDelta(valorStr) {
    var meta = _metaRes();
    if (!meta) return null;
    var obj;
    try { obj = JSON.parse(valorStr); } catch (err) { return null; }
    if (!obj || typeof obj !== "object") return null;
    var reset = typeof obj._resetGlobalEn === "number" ? obj._resetGlobalEn : 0;
    if (reset > (meta.r || 0)) return null; // "Borrar TODO": viaja completo, con su sello
    var res = obj.resultados && typeof obj.resultados === "object" ? obj.resultados : {};
    var delta = {}, n = 0, reciente = false, ahora = Date.now();
    Object.keys(res).forEach(function (id) {
      var h = _hashEntrada(res[id]);
      if (meta.m[id] !== h) {
        delta[id] = res[id];
        n++;
        if (res[id] && res[id].jugado === true && typeof res[id]._actualizadoEn === "number" && ahora - res[id]._actualizadoEn < 5 * 60 * 1000) reciente = true;
      }
    });
    var gCambio = _hash(JSON.stringify(obj.partidosGenerados || {})) !== (meta.g || "");
    return { obj: obj, delta: delta, n: n, gCambio: gCambio, reciente: reciente };
  }

  // ---------- Aviso visible de "guardado" ----------
  // Tras confirmar un partido, el mánager ve si llegó al servidor. Hasta ahora
  // un fallo de red era invisible: el partido se quedaba solo en ese móvil y se
  // descubría días después.
  var _badgeTimer = null;
  function _badge(tipo, texto) {
    try {
      var el = document.getElementById("ef7-sync-badge");
      if (!el) {
        el = document.createElement("div");
        el.id = "ef7-sync-badge";
        el.setAttribute("role", "status");
        el.style.cssText = "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:99999;max-width:92vw;" +
          "padding:10px 16px;border-radius:999px;font:600 14px/1.3 system-ui,sans-serif;color:#fff;" +
          "box-shadow:0 4px 18px rgba(0,0,0,.5);text-align:center;pointer-events:none";
        document.body.appendChild(el);
      }
      if (_badgeTimer) { clearTimeout(_badgeTimer); _badgeTimer = null; }
      if (tipo === "off") { el.style.display = "none"; return; }
      el.style.display = "block";
      el.style.background = tipo === "ok" ? "#15803d" : (tipo === "error" ? "#b45309" : "#1d4ed8");
      el.textContent = texto;
      if (tipo === "ok") _badgeTimer = setTimeout(function () { el.style.display = "none"; }, 4500);
    } catch (err) {}
  }

  function _empujarDelta(info, valorActual) {
    var K = CLAVE_RESULTADOS;
    if (info.n === 0 && !info.gCambio) {
      // Nada distinto de lo que ya tiene el servidor (p. ej. un cambio que no
      // toca resultados): se da por reconciliado sin gastar red.
      _snapshot[K] = _hash(valorActual);
      delete _pendientes[K]; delete _intentosFallidos[K]; delete _forzar[K];
      _guardarSnapshotPersistido();
      return Promise.resolve();
    }
    var cuerpo = { partidos: info.delta };
    if (info.gCambio) cuerpo.generados = info.obj.partidosGenerados || {};
    var texto = JSON.stringify(cuerpo);
    if (info.reciente) _badge("subiendo", "⏳ Guardando el partido en el servidor…");
    return _fetchConTimeout(ENDPOINT_RES, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: texto,
      keepalive: texto.length < 60000 // el límite de keepalive es ~64 KB
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (resp) {
        if (!resp || !resp.ok) throw new Error("respuesta no válida");
        var enviados = Object.keys(info.delta);
        _marcarSubidos(valorActual, enviados);
        if (info.gCambio) {
          var meta = _metaRes();
          if (meta) { meta.g = _hash(JSON.stringify(info.obj.partidosGenerados || {})); _guardarMetaRes(meta); }
        }
        delete _intentosFallidos[K];
        var ahora = _clavesLocales()[K];
        if (ahora === valorActual) {
          _snapshot[K] = _hash(valorActual);
          delete _pendientes[K]; delete _forzar[K];
          _guardarSnapshotPersistido();
        } // si cambió mientras volaba, sigue pendiente: el próximo ciclo manda solo lo nuevo
        if (info.reciente) _badge("ok", "✅ Partido guardado en el servidor");
      })
      .catch(function (err) {
        console.warn("[sync] envío incremental falló:", err);
        _intentosFallidos[K] = (_intentosFallidos[K] || 0) + 1;
        if (info.reciente || _intentosFallidos[K] >= 2) {
          _badge("error", "⚠️ Sin conexión: el partido está guardado en este móvil y se subirá solo. No borres los datos del navegador.");
        }
        if (_intentosFallidos[K] >= UMBRAL_AVISO_SYNC_ATASCADO) _avisarSyncAtascado(K);
      });
  }

  // ---------- Aviso PERSISTENTE de partidos sin subir ----------
  // El aviso de error solo salía si el envío FALLABA; si el móvil se
  // quedaba en segundo plano/sin red antes de intentarlo, nadie se enteraba
  // y el partido se descubría perdido días después. Ahora, si hay partidos
  // jugados sin confirmar en el servidor durante más de 25 s, el aviso se
  // queda fijo hasta que suban.
  var _sinSubirDesde = 0, _avisoSinSubir = false;
  function _revisarSinSubir() {
    try {
      var info = null;
      var act = _clavesLocales()[CLAVE_RESULTADOS];
      if (typeof act === "string" && (_pendientes[CLAVE_RESULTADOS] || _hash(act) !== _snapshot[CLAVE_RESULTADOS])) info = _construirDelta(act);
      var n = 0;
      if (info) {
        Object.keys(info.delta).forEach(function (id) { if (info.delta[id] && info.delta[id].jugado === true) n++; });
      }
      if (!n) {
        _sinSubirDesde = 0;
        if (_avisoSinSubir) { _avisoSinSubir = false; _badge("off"); }
        return;
      }
      if (!_sinSubirDesde) _sinSubirDesde = Date.now();
      if (Date.now() - _sinSubirDesde > 25000) {
        _avisoSinSubir = true;
        _badge("error", "⚠️ " + n + (n === 1 ? " partido sin subir" : " partidos sin subir") + " al servidor. Deja la app abierta con WiFi/datos hasta ver ✅.");
      }
    } catch (err) {}
  }

  // ---------- Versión nueva de la app ----------
  // Un móvil que lleva la app abierta (o instalada en la pantalla de inicio)
  // días sin recargar sigue ejecutando el código VIEJO aunque ya se haya
  // desplegado el arreglo: sus partidos podían no subirse. Se compara el
  // `?v=` de este script con el de la página publicada; si cambió y no hay
  // partido en curso ni nada sin subir, se recarga sola (al volver a abrir
  // la app); si no, se muestra un aviso para actualizar con un toque.
  var _versionPropia = (function () {
    try {
      var sc = document.querySelector('script[src*="sync.js"]');
      var m = sc && /[?&]v=(\d+)/.exec(sc.getAttribute("src") || "");
      return m ? m[1] : null;
    } catch (err) { return null; }
  })();
  function _hayPartidoEnCurso() {
    var a = document.getElementById("partido-live-overlay");
    var b = document.getElementById("previa-overlay");
    var t = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    return !!((a && !a.hidden) || (b && !b.hidden) || t);
  }
  function _revisarVersion(permitirRecarga) {
    if (!_versionPropia) return;
    _fetchConTimeout("/?_=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.text() : ""; })
      .then(function (html) {
        var m = /js\/sync\.js\?v=(\d+)/.exec(html || "");
        if (!m || m[1] === _versionPropia) return;
        var libre = !_hayPartidoEnCurso() && !_pendientes[CLAVE_RESULTADOS] && Object.keys(_pendientes).length === 0;
        if (permitirRecarga && libre) {
          // Tope anti-bucle: como mucho una recarga automática cada 5 min.
          var ult = 0;
          try { ult = parseInt(sessionStorage.getItem("efsync_recarga_v") || "0", 10) || 0; } catch (err) {}
          if (Date.now() - ult > 5 * 60 * 1000) {
            try { sessionStorage.setItem("efsync_recarga_v", String(Date.now())); } catch (err) {}
            location.reload();
            return;
          }
        }
        if (document.getElementById("ef7-version-aviso")) return;
        var el = document.createElement("button");
        el.id = "ef7-version-aviso";
        el.type = "button";
        el.textContent = "🔄 Hay una versión nueva — toca para actualizar";
        el.style.cssText = "position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:99998;max-width:92vw;padding:10px 16px;" +
          "border:0;border-radius:999px;background:#1d4ed8;color:#fff;font:600 14px/1.3 system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.5)";
        el.addEventListener("click", function () { location.reload(); });
        document.body.appendChild(el);
      })
      .catch(function () {});
  }

  function _empujarPendientes(actuales) {
    var pendientes = Object.keys(_pendientes);
    if (!pendientes.length) return Promise.resolve();
    var info = null;
    if (_pendientes[CLAVE_RESULTADOS] && typeof actuales[CLAVE_RESULTADOS] === "string") {
      info = _construirDelta(actuales[CLAVE_RESULTADOS]);
    }
    var completas = pendientes.filter(function (k) { return !(info && k === CLAVE_RESULTADOS); });
    var tareas = [];
    if (info) tareas.push(_empujarDelta(info, actuales[CLAVE_RESULTADOS]));
    if (completas.length) tareas.push(_empujarCompleto(completas, actuales));
    return Promise.all(tareas).then(function () {});
  }

  function _empujarCompleto(claves, actuales) {

    var cuerpo = {};
    claves.forEach(function (k) { cuerpo[k] = actuales[k]; });
    // Solo se listan las que de verdad van en ESTE push — una clave
    // marcada con `marcarParaForzar` que hoy no tenga ningún cambio local
    // pendiente no debe viajar suelta en `forzar` sin su valor.
    var forzar = claves.filter(function (k) { return !!_forzar[k]; });

    var cuerpoPeticion = { claves: cuerpo };
    if (forzar.length) cuerpoPeticion.forzar = forzar;
    // Marca de la última EDICIÓN EXPLÍCITA (editor/import) de cada Calendario
    // extra: el servidor solo deja que cambie su texto un push con marca más
    // nueva que la guardada (ver app.py, _EF7_META_CALED_KEY).
    var ediciones = {};
    claves.forEach(function (k) {
      if (k.indexOf("ef7_club_calendario_extra_v1_") !== 0) return;
      try {
        var ts = Number(localStorage.getItem("efm_caled_" + k));
        if (ts > 0) ediciones[k] = ts;
      } catch (e) { /* sin marca: el servidor lo tratará como copia no editada */ }
    });
    if (Object.keys(ediciones).length) cuerpoPeticion.ediciones = ediciones;

    return _fetchConTimeout(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpoPeticion)
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
            if (k === CLAVE_RESULTADOS) _marcarSubidos(cuerpo[k]);
            _snapshot[k] = _hash(cuerpo[k]);
            delete _pendientes[k];
            delete _intentosFallidos[k];
            delete _forzar[k];
            huboConfirmadas = true;
          }
        });
        // Una clave que se mandó pero el servidor NO devolvió en
        // `guardadas` fue RECHAZADA en silencio (formato inválido, límite
        // de tamaño, o el guard de regresión de app.py — ver
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
        //
        // `CLAVE_RESULTADOS` (ef7_estado_liga_v1) es la ÚNICA excepción —
        // reporte usuario 2026-09-13, "no se ha guardado ningún de los
        // partidos de anoche": esta clave es el historial de actas
        // COMPLETO, irrecuperable si se pierde. El auto-abandono de
        // arriba asume que la copia LOCAL es "vieja/pobre" cuando falla
        // repetidas veces — pero para esta clave concreta lo normal es
        // justo lo contrario: SIEMPRE tiene TODOS los partidos que este
        // dispositivo confirmó, así que un rechazo repetido casi siempre
        // significa que el blob entero superó el tope de guardado (ver
        // _EF7_ESTADO_LIGA_MAX_BYTES en app.py), NUNCA que la copia local
        // esté equivocada. Abandonarla dejaría que el pull de justo
        // después adoptara la copia MÁS POBRE del servidor — exactamente
        // la pérdida que motivó este fix. Se avisa igual (una sola vez),
        // pero se sigue reintentando el push para siempre y NUNCA se
        // adopta el servidor por esta vía (el guard dedicado
        // `_esRegresionResultados` del pull, más abajo, es la 2ª capa de
        // protección independiente por si esta exención cambiara algún
        // día).
        claves.forEach(function (k) {
          if (confirmadasSet[k]) return;
          _intentosFallidos[k] = (_intentosFallidos[k] || 0) + 1;
          if (_intentosFallidos[k] >= UMBRAL_AVISO_SYNC_ATASCADO) {
            _avisarSyncAtascado(k);
            if (k === CLAVE_RESULTADOS) return; // nunca se abandona — se sigue reintentando
            // Se limpia YA (no en el próximo ciclo): en la rama normal
            // (no primer ciclo) el pull de este mismo _ciclo() corre
            // justo después de este .then, así que la clave abandonada
            // adopta la copia del servidor sin esperar 10 s más.
            delete _pendientes[k];
            delete _intentosFallidos[k];
            delete _forzar[k];
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
  // Fusión por partido SOLO cuando `ef7_estado_liga_v1` está pendiente de
  // subir (ver el comentario en _traerDelServidor). Reglas, por id de
  // partido del servidor: (a) no existe aquí -> se añade; (b) existe y aquí
  // NO ha cambiado desde el último envío confirmado -> el del servidor es
  // más nuevo, se adopta; (c) existe y aquí SÍ ha cambiado (pendiente de
  // subir) -> se conserva lo local. Nunca adopta un reseteo global (eso lo
  // gestiona el flujo normal). Devuelve true si cambió algo.
  function _fusionarResultadosDelServidor(valorLocal, valorServidor) {
    try {
      if (typeof valorLocal !== "string" || typeof valorServidor !== "string") return false;
      var loc = JSON.parse(valorLocal), srv = JSON.parse(valorServidor);
      if (!loc || !srv || typeof loc !== "object" || typeof srv !== "object") return false;
      if ((typeof srv._resetGlobalEn === "number" ? srv._resetGlobalEn : 0) > (typeof loc._resetGlobalEn === "number" ? loc._resetGlobalEn : 0)) return false;
      var resL = loc.resultados && typeof loc.resultados === "object" ? loc.resultados : (loc.resultados = {});
      var resS = srv.resultados && typeof srv.resultados === "object" ? srv.resultados : {};
      var meta = _metaRes();
      var tomados = [];
      Object.keys(resS).forEach(function (id) {
        var eS = resS[id];
        if (!eS || typeof eS !== "object") return;
        var eL = resL[id];
        if (!eL) { resL[id] = eS; tomados.push(id); return; }
        var hL = _hashEntrada(eL);
        if (hL === _hashEntrada(eS)) return;
        if (meta && meta.m && meta.m[id] === hL) { resL[id] = eS; tomados.push(id); return; }
        // Reporte usuario 2026-10-06: el servidor tenía J13/J14 de Acsa JUGADOS,
        // pero en el móvil del admin seguían como "📌 pospuesto"/PREVIA. Con un
        // cambio local pendiente cualquiera, un pospuesto local sin confirmar
        // bloqueaba para siempre el resultado jugado por OTRO mánager. Regla:
        // un partido JUGADO en el servidor gana a una copia local NO jugada que
        // no sea más reciente (mismo criterio que el guard de app.py: solo una
        // tumba/pospuesto POSTERIOR al resultado puede des-jugarlo).
        if (eS.jugado === true && eL.jugado !== true) {
          var tS = typeof eS._actualizadoEn === "number" ? eS._actualizadoEn : 0;
          var tL = typeof eL._actualizadoEn === "number" ? eL._actualizadoEn : 0;
          if (tS >= tL) { resL[id] = eS; tomados.push(id); }
        }
      });
      if (!tomados.length) return false;
      var nuevo = JSON.stringify(loc);
      localStorage.setItem(CLAVE_RESULTADOS, nuevo);
      _marcarSubidos(JSON.stringify({ resultados: resS }), tomados);
      if (window.Estado.invalidarCache) window.Estado.invalidarCache();
      return true;
    } catch (err) {
      console.warn("[sync] fusión de resultados pendientes falló:", err);
      return false;
    }
  }

  function _traerDelServidor() {
    return _fetchConTimeout(ENDPOINT)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (resp) {
        if (!resp || !resp.ok || !resp.claves) return false;
        _ultimoPullOkMs = Date.now();
        _pintarChip();
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
          if (_pendientes[k]) {
            // Hay un cambio local sin confirmar: el servidor NO lo pisa. Pero
            // para los RESULTADOS eso no puede significar "dejar de ver los
            // partidos que juegan los demás": con un envío atascado este
            // móvil no veía NINGÚN partido nuevo de otro mánager hasta que
            // el suyo subiera. Se traen SOLO los partidos que faltan aquí
            // (o que aquí no han cambiado) y lo local pendiente se respeta.
            if (k === CLAVE_RESULTADOS && typeof resp.claves[k] === "string") {
              if (_fusionarResultadosDelServidor(actuales[k], _normalizarJson(resp.claves[k]))) huboCambio = true;
            }
            return;
          }
          var valorServidor = resp.claves[k];
          if (typeof valorServidor !== "string") return; // esta app solo guarda strings (igual que localStorage)
          if (k === CLAVE_RESULTADOS) valorServidor = _normalizarJson(valorServidor);
          if (valorServidor === actuales[k]) {
            _snapshot[k] = _hash(valorServidor);
            huboSnapshotNuevo = true;
            return;
          }
          // El servidor tiene una copia peor que la de este dispositivo —
          // no se adopta, SALVO que sea un "🗑️ Borrar TODO" legítimo más
          // reciente (ver _esReseteoGlobalLegitimo) — ese SÍ debe pisar
          // aunque este dispositivo tenga partidos jugados en local, o el
          // reseteo nunca llegaría a los otros 5 móviles. Cuando no lo
          // es, se marca PENDIENTE para que el próximo push suba la
          // copia buena de este dispositivo y la "cure" en el servidor
          // (el guard de app.py deja pasar ese push porque va a MEJOR,
          // nunca a peor) — así el dispositivo con la copia rica es el
          // que gana, sea cual sea el orden en que cada uno sincronizó.
          //
          // `CLAVE_RESULTADOS` usa un criterio DEDICADO
          // (`_esRegresionResultados`, por id de partido) en vez del
          // genérico por longitud (`_esRegresionGrave`) — perder los
          // partidos de anoche era una fracción minúscula de un historial
          // de temporada entera, así que nunca cruzaba el umbral del 50%
          // y esta app los adoptaba/perdía igualmente (reporte usuario
          // 2026-09-13). Basta con que falte UN SOLO id de partido ya
          // conocido aquí para bloquear la adopción, sea cual sea el
          // tamaño relativo del resto del blob.
          // CALENDARIO EXTRA editado a mano en ESTE dispositivo: si el servidor
          // difiere y la marca de la última edición explícita de aquí es MÁS
          // NUEVA que la que el servidor tiene registrada (o no tiene ninguna:
          // reinicio/borrado de su base de datos, o una copia vieja de otro
          // móvil/pestaña que llegó primero), la copia del servidor es la
          // vieja — NO se adopta, se vuelve a subir la de aquí con su marca
          // (reporte usuario: "otra vez se ha jodido el calendario del FC
          // Barcelona, pasa todos los días"). Si la marca del servidor es
          // mayor (otro dispositivo editó después), se adopta y se copia su
          // marca para no discutir otra vez.
          if (k.indexOf("ef7_club_calendario_extra_v1_") === 0) {
            var marcaLocal = 0, marcaServ = 0;
            try { marcaLocal = Number(localStorage.getItem("efm_caled_" + k)) || 0; } catch (e0) { marcaLocal = 0; }
            marcaServ = Number(resp.caled_meta && resp.caled_meta[k]) || 0;
            if (marcaLocal > marcaServ && typeof actuales[k] === "string") {
              _pendientes[k] = true;
              _forzar[k] = true;
              return;
            }
            if (marcaServ > marcaLocal) {
              try { localStorage.setItem("efm_caled_" + k, String(marcaServ)); } catch (e1) { /* sin marca local */ }
            }
          }
          var esRegresion = k === CLAVE_RESULTADOS
            ? _esRegresionResultados(actuales[k], valorServidor)
            : (k.indexOf("ef7_vivo_v1_") === 0 ? false : _esRegresionGrave(actuales[k], valorServidor));
          // RECORTE DELIBERADO de otro dispositivo (reporte usuario 2026-10-06:
          // "edito el calendario del FC Barcelona y al poco vuelven a salir los
          // partidos de 1ª REF"). Este móvil NO ha tocado la clave desde la
          // última vez que la confirmó con el servidor (hash local == snapshot)
          // y el servidor dice que el admin la recortó a propósito (`forzados`):
          // la versión corta es la buena. Sin esto, la tomaba por una "copia
          // vieja", re-subía su texto largo antiguo y deshacía la edición.
          if (esRegresion && k !== CLAVE_RESULTADOS && resp.forzados && resp.forzados[k] &&
              typeof actuales[k] === "string" && _snapshot[k] !== undefined && _hash(actuales[k]) === _snapshot[k]) {
            esRegresion = false;
          }
          if (esRegresion && !_esReseteoGlobalLegitimo(k, actuales[k], valorServidor)) {
            _pendientes[k] = true;
            return;
          }
          try {
            localStorage.setItem(k, valorServidor);
            if (k === CLAVE_RESULTADOS) _marcarSubidos(valorServidor); // lo que viene del servidor ya está en el servidor
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

  // Si algo pide sincronizar mientras hay un ciclo en curso (p. ej. el
  // mánager confirma un partido justo entonces), antes se perdía el aviso y
  // el partido esperaba hasta 10 s al siguiente ciclo. Ahora se vuelve a
  // ejecutar en cuanto termina el actual.
  var _cicloPedidoMientrasVuelo = false;
  function _ciclo() {
    if (_enVuelo) { _cicloPedidoMientrasVuelo = true; return Promise.resolve(); }
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
        // Correcciones de datos únicas (idempotentes por contenido): se
        // aplican SOBRE la copia recién traída del servidor y el push de
        // justo abajo las sube para todos los dispositivos.
        try {
          if (window.Estado.corregirCalendarioLiverpoolV1 && window.Estado.corregirCalendarioLiverpoolV1()) {
            if (window.Estado.invalidarCache) window.Estado.invalidarCache();
            _marcarUiActualizada();
          }
        } catch (err) { console.warn("[sync] corrección de calendario falló:", err); }
        return _empujarPendientes(_clavesLocales());
      });
    } else {
      cadena = _empujarPendientes(actuales).then(_traerDelServidor);
    }

    return cadena.then(function () {
      _enVuelo = false;
      _revisarSinSubir();
      if (_cicloPedidoMientrasVuelo) {
        _cicloPedidoMientrasVuelo = false;
        setTimeout(_ciclo, 0);
      }
    }, function (err) {
      _enVuelo = false;
      console.warn("[sync] ciclo falló:", err);
    });
  }

  // Sincronización INMEDIATA tras un cambio local (ver Estado.guardarEstado).
  // Antes un partido confirmado esperaba al siguiente tick de 10 s, y en el
  // móvil el siguiente paso típico (compartir el acta por WhatsApp) manda la
  // app a segundo plano: el navegador congela los temporizadores y el
  // partido se quedaba SOLO en ese teléfono — el otro mánager/el admin lo
  // veía sin jugar y lo repetía. Con un pequeño debounce se sube en cuanto se
  // confirma, con la app todavía en primer plano.
  var _temporizadorPeticion = null;
  function pedirSincronizacion() {
    if (_temporizadorPeticion) return;
    _temporizadorPeticion = setTimeout(function () {
      _temporizadorPeticion = null;
      _ciclo();
    }, 400);
  }

  document.addEventListener("DOMContentLoaded", function () {
    _ciclo();
    setInterval(_ciclo, INTERVALO_MS);
    setTimeout(function () { _revisarVersion(true); }, 2500);
    setInterval(function () { _revisarVersion(false); }, 10 * 60 * 1000);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") _revisarVersion(true);
      // Al pasar a segundo plano se intenta subir YA lo pendiente (la
      // petición normal suele alcanzar a salir antes de que el navegador
      // congele la pestaña); al volver, se sincroniza de inmediato.
      _ciclo();
    });
    window.addEventListener("pagehide", function () { _ciclo(); });
    window.addEventListener("beforeunload", function () {
      // Best-effort — no bloqueante, no hay garantía de que llegue, pero
      // reduce la ventana de "cerré la app antes del próximo ciclo".
      var actuales = _clavesLocales();
      _detectarCambiosLocales(actuales);
      var claves = Object.keys(_pendientes);
      if (!claves.length || !navigator.sendBeacon) return;
      // Los resultados viajan como envío incremental (unos cientos de bytes):
      // el blob completo (~80 KB) supera el límite de sendBeacon (~64 KB) y
      // fallaba siempre en silencio.
      var info = (_pendientes[CLAVE_RESULTADOS] && typeof actuales[CLAVE_RESULTADOS] === "string")
        ? _construirDelta(actuales[CLAVE_RESULTADOS]) : null;
      try {
        if (info && (info.n || info.gCambio)) {
          var cuerpoRes = { partidos: info.delta };
          if (info.gCambio) cuerpoRes.generados = info.obj.partidosGenerados || {};
          navigator.sendBeacon(ENDPOINT_RES, new Blob([JSON.stringify(cuerpoRes)], { type: "application/json" }));
        }
        var cuerpo = {}, hay = false;
        claves.forEach(function (k) {
          if (info && k === CLAVE_RESULTADOS) return;
          cuerpo[k] = actuales[k]; hay = true;
        });
        if (hay) navigator.sendBeacon(ENDPOINT, new Blob([JSON.stringify({ claves: cuerpo })], { type: "application/json" }));
      } catch (err) {}
    });
  });

  // Expuesto para que pantallas como el Calendario (ver
  // js/renderizadores.js::generarCalendarioLateralDerecho) puedan
  // distinguir "no hay NADA de verdad" de "todavía no ha llegado el
  // primer pull con éxito" — sin esto, justo después de borrar datos de
  // navegación (localStorage vacío, sin respaldo local) y con el
  // servidor gratuito de Render "dormido" (arranque en frío lento), la
  // pantalla mostraba el mensaje definitivo de "sin partidos" mientras
  // la sync de fondo seguía reintentando en silencio cada 10 s — daba la
  // falsa impresión de que los datos se habían perdido, cuando en
  // realidad solo hacía falta esperar a que el primer pull tuviera éxito
  // (reporte usuario: "cuando borro datos... no aparece en mi móvil,
  // pero si otro humano abre el suyo, ya me funciona a mí" — coincidencia
  // de tiempos: el servidor ya estaba despierto para entonces, no que el
  // otro móvil hiciera nada especial).
  function estaSincronizado() { return _primerCicloHecho; }

  // ---------- Comprobación EXPLÍCITA de que un partido llegó al servidor ----------
  // Reporte usuario 2026-10-06: partidos de otros humanos jugados desde su móvil
  // (Acsa, Hypermotion J13/J14) no aparecían en el calendario del admin, y nadie
  // sabía si fallaba la SUBIDA o la LECTURA. Tras confirmar un partido, el móvil
  // fuerza un ciclo y LEE el servidor (/api/ef7/partido/<id>, ~200 bytes) para
  // decirle al mánager, con certeza, si el resultado está de verdad en la nube.
  // Resuelve siempre con {estado:"ok"|"falta"|"red", detalle}; nunca rechaza.
  var _VERIF_ESPERAS_MS = [0, 2500, 6000, 12000];
  function verificarPartido(id, golesL, golesV, alProgreso) {
    var intento = 0, ultimoError = null;
    function _paso() {
      var espera = _VERIF_ESPERAS_MS[intento];
      return new Promise(function (res) { setTimeout(res, espera); })
        .then(function () { return _ciclo(); })
        .then(function () {
          return _fetchConTimeout("/api/ef7/partido/" + encodeURIComponent(id) + "?_=" + Date.now(), { cache: "no-store" });
        })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)); })
        .then(function (d) {
          ultimoError = null;
          if (d && d.jugado && !d.borrado) {
            var esperado = (golesL != null && golesV != null) ? (golesL + "-" + golesV) : null;
            if (!esperado || d.marcador === esperado) return { estado: "ok", detalle: d };
            return { estado: "falta", detalle: d, motivo: "marcador distinto en el servidor (" + d.marcador + ")" };
          }
          intento++;
          if (intento < _VERIF_ESPERAS_MS.length) { if (alProgreso) alProgreso(intento); return _paso(); }
          return { estado: "falta", detalle: d, motivo: d && d.existe ? "el servidor lo tiene sin jugar" : "el servidor no lo tiene" };
        }, function (err) {
          ultimoError = err;
          intento++;
          if (intento < _VERIF_ESPERAS_MS.length) { if (alProgreso) alProgreso(intento); return _paso(); }
          return { estado: "red", detalle: null, motivo: String((err && err.message) || err) };
        });
    }
    return _paso().catch(function (err) { return { estado: "red", detalle: null, motivo: String((err && err.message) || err) }; });
  }

  // ---------- Chip permanente: versión + hora del último pull con éxito ----------
  // Permite que una captura de pantalla de cualquier móvil diga si ese móvil
  // lleva el JS viejo o lleva rato sin hablar con el servidor.
  var _ultimoPullOkMs = 0;
  function _versionJs() {
    try {
      var sc = document.querySelector('script[src*="sync.js"]');
      var m = sc && /[?&]v=([^&]+)/.exec(sc.getAttribute("src") || "");
      return m ? m[1] : "?";
    } catch (err) { return "?"; }
  }
  function _pintarChip() {
    try {
      if (!document.body) return;
      var el = document.getElementById("ef7-sync-chip");
      if (!el) {
        el = document.createElement("div");
        el.id = "ef7-sync-chip";
        el.style.cssText = "position:fixed;left:6px;bottom:4px;z-index:99990;padding:1px 6px;border-radius:6px;" +
          "font:500 10px/1.4 system-ui,sans-serif;color:#cbd5e1;background:rgba(15,23,42,.55);pointer-events:none;opacity:.8";
        document.body.appendChild(el);
      }
      var hora = _ultimoPullOkMs ? new Date(_ultimoPullOkMs).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "sin conexión aún";
      el.textContent = "v" + _versionJs() + " · sync " + hora;
    } catch (err) {}
  }
  document.addEventListener("DOMContentLoaded", function () { _pintarChip(); setInterval(_pintarChip, 15000); });

  window.Sync = { forzarCiclo: _ciclo, pedirSincronizacion: pedirSincronizacion, estaSincronizado: estaSincronizado, marcarParaForzar: marcarParaForzar, verificarPartido: verificarPartido };
})();
