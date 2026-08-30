/* ============================================================
   estado.js — Capa de persistencia y cálculo en caliente
   Sin backend: el progreso vive en localStorage, superpuesto a
   los data/*.json estáticos (que son el estado de fábrica).
   Clasificación y estadísticas de jugador NUNCA se guardan como
   contadores aparte — se recalculan en caliente desde los
   partidos ya confirmados (regla de Fase 1: "las estadísticas
   globales se suman en caliente solo al entrar a mirar la
   pestaña"), así que no pueden desincronizarse ni duplicarse.
   ============================================================ */
(function () {
  "use strict";

  var STORAGE_KEY = "ef7_estado_liga_v1";

  function estadoPorDefecto() {
    return {
      version: 1,
      // partidoId -> { jugado, golesLocal, golesVisitante, eventos: [...] }
      resultados: {},
      // partidoId -> objeto de partido completo (terceros partidos de
      // desempate inyectados en caliente por js/sistema-temporadas.js)
      partidosGenerados: {}
    };
  }

  var _estado = null;

  function cargarEstado() {
    if (_estado) return _estado;
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      _estado = raw ? JSON.parse(raw) : estadoPorDefecto();
      if (!_estado.resultados) _estado.resultados = {};
      if (!_estado.partidosGenerados) _estado.partidosGenerados = {};
    } catch (err) {
      console.error("[estado] localStorage no disponible o corrupto, uso estado por defecto:", err);
      _estado = estadoPorDefecto();
    }
    return _estado;
  }

  function guardarEstado() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_estado));
      return true;
    } catch (err) {
      console.error("[estado] no se pudo guardar en localStorage:", err);
      return false;
    }
  }

  function registrarResultadoPartido(partidoId, golesLocal, golesVisitante, eventos) {
    var e = cargarEstado();
    e.resultados[partidoId] = {
      jugado: true,
      golesLocal: golesLocal,
      golesVisitante: golesVisitante,
      eventos: (eventos || []).slice()
    };
    return guardarEstado();
  }

  // Resultado confirmado en vivo para UN partido, tal cual lo guardó
  // registrarResultadoPartido — lo usa generarCalendarioLateralDerecho
  // para superponerlo sobre un partido de "Calendario extra" (que se
  // reconstruye desde texto en cada render y, si no, perdería el
  // resultado de una simulación en vivo en el siguiente repintado).
  function obtenerResultadoOverride(partidoId) {
    var e = cargarEstado();
    return e.resultados[partidoId] || null;
  }

  function registrarPartidoGenerado(partido) {
    var e = cargarEstado();
    e.partidosGenerados[partido.id] = partido;
    return guardarEstado();
  }

  // Vista fusionada: partidos base (data/partidos.json) + generados
  // (terceros partidos de desempate), con el resultado local superpuesto
  // si existe. Es la ÚNICA fuente de verdad que debe leer cualquier
  // pantalla (calendario, clasificación, estadísticas de jugador).
  function listarPartidosResueltos(datos) {
    var e = cargarEstado();
    var base = (datos.partidos.partidos || []).slice();
    var generados = Object.keys(e.partidosGenerados).map(function (id) { return e.partidosGenerados[id]; });
    var todos = base.concat(generados);

    return todos.map(function (p) {
      var override = e.resultados[p.id];
      if (!override) return p;
      var copia = {};
      for (var k in p) if (p.hasOwnProperty(k)) copia[k] = p[k];
      copia.jugado = override.jugado;
      copia.resultado = { golesLocal: override.golesLocal, golesVisitante: override.golesVisitante };
      copia.eventos = override.eventos;
      return copia;
    });
  }

  // ---------- Clasificación (calculada en caliente) ----------
  function calcularClasificacion(datos, ligaKey) {
    var partidos = listarPartidosResueltos(datos).filter(function (p) {
      return p.competicion === "liga" && p.liga === ligaKey && p.jugado;
    });

    var tabla = {};
    function fila(id) {
      if (!tabla[id]) tabla[id] = { equipoId: id, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 };
      return tabla[id];
    }

    partidos.forEach(function (p) {
      var gl = p.resultado.golesLocal, gv = p.resultado.golesVisitante;
      var L = fila(p.local), V = fila(p.visitante);
      L.pj++; V.pj++;
      L.gf += gl; L.gc += gv;
      V.gf += gv; V.gc += gl;
      if (gl > gv) { L.pg++; L.pts += 3; V.pp++; }
      else if (gl < gv) { V.pg++; V.pts += 3; L.pp++; }
      else { L.pe++; V.pe++; L.pts += 1; V.pts += 1; }
    });

    var lista = Object.keys(tabla).map(function (id) { return tabla[id]; });
    lista.sort(function (a, b) {
      if (b.pts !== a.pts) return b.pts - a.pts;
      var dgA = a.gf - a.gc, dgB = b.gf - b.gc;
      if (dgB !== dgA) return dgB - dgA;
      return b.gf - a.gf;
    });
    return lista;
  }

  // ---------- Estadísticas de jugador HUMANO (calculadas en caliente) ----------
  // Los eventos de la IA (es_humano:false) se ignoran a propósito — sus
  // jugadores genéricos no tienen ficha en data/jugadores.json ni se
  // persiste ningún histórico suyo (0 KB extra, regla de Fase 1).
  function calcularEstadisticasJugador(datos, jugadorId) {
    var partidos = listarPartidosResueltos(datos).filter(function (p) { return p.jugado && p.eventos; });
    var porComp = {};
    function comp(c) {
      if (!porComp[c]) porComp[c] = { goles: 0, amarillas: 0, rojas: 0, mvp: 0 };
      return porComp[c];
    }
    partidos.forEach(function (p) {
      (p.eventos || []).forEach(function (ev) {
        if (!ev.es_humano || ev.jugador_id !== jugadorId) return;
        var c = comp(p.competicion);
        if (ev.tipo === "GOL" || ev.tipo === "GOL_FAV_FALTA" || ev.tipo === "PENALTI_GOL") c.goles++;
        else if (ev.tipo === "AMARILLA") c.amarillas++;
        else if (ev.tipo === "ROJA") c.rojas++;
        else if (ev.tipo === "MVP") c.mvp++;
      });
    });
    return porComp;
  }

  // ---------- "Temporada N" editable (etiqueta libre arriba del Inicio) ----------
  var TEMPORADA_KEY = "ef7_temporada_v1";
  var TEMPORADA_DEFECTO = "Temporada 7";
  function obtenerTemporada() {
    try {
      var v = localStorage.getItem(TEMPORADA_KEY);
      return v && v.trim() ? v : TEMPORADA_DEFECTO;
    } catch (err) {
      return TEMPORADA_DEFECTO;
    }
  }
  function guardarTemporada(valor) {
    var limpio = (valor || "").trim();
    if (!limpio) return false;
    try {
      localStorage.setItem(TEMPORADA_KEY, limpio);
      return true;
    } catch (err) {
      console.error("[estado] no se pudo guardar la temporada:", err);
      return false;
    }
  }

  // ---------- Nombre de la LIGA principal (editable) ----------
  // El badge del calendario ("LIGA_EA_SPORTS" -> "LIGA EA SPORTS") venía
  // derivado a pelo de la clave interna de data/equipos_ia.json — un
  // resto del primer mock del proyecto. La liga real de estos 6 clubes es
  // "1ª REF" (así la llama ya el propio roadmap de arriba, "🇪🇸 1ª REF -
  // 1ªJornada de Liga"); el admin la deja como quiera desde el lápiz
  // junto al badge del calendario (js/main.js::editarNombreLiga).
  var LIGA_NOMBRE_KEY = "ef7_liga_principal_nombre_v1";
  var LIGA_NOMBRE_DEFECTO = "1ª REF";
  function obtenerNombreLiga() {
    try {
      var v = localStorage.getItem(LIGA_NOMBRE_KEY);
      return v && v.trim() ? v : LIGA_NOMBRE_DEFECTO;
    } catch (err) {
      return LIGA_NOMBRE_DEFECTO;
    }
  }
  function guardarNombreLiga(valor) {
    var limpio = (valor || "").trim();
    if (!limpio) return false;
    try {
      localStorage.setItem(LIGA_NOMBRE_KEY, limpio);
      return true;
    } catch (err) {
      console.error("[estado] no se pudo guardar el nombre de la liga:", err);
      return false;
    }
  }

  // ---------- Calendario de COMPETICIONES (roadmap editable, SIN fecha) ----------
  // No es el calendario de partidos (eso vive en data/partidos.json y ya
  // se ve bien en el calendario de cada club, con fecha real). Esto es
  // una lista de texto libre que el admin pega/edita — el ORDEN en que se
  // suceden las jornadas/rondas de cada competición, sin fecha asignada
  // (ver js/renderizadores.js::parsearCalendarioCompeticiones para el
  // parser y el render "tipo roadmap").
  var CALENDARIO_TEXTO_KEY = "ef7_calendario_competiciones_v1";
  var CALENDARIO_TEXTO_DEFECTO = [
    "1. 🇪🇸 1ª REF - 1ªJornada de Liga",
    "2. 🇪🇸 1ª REF - 2ªJornada de Liga",
    "3. 🇪🇸 1ª REF - 3ªJornada de Liga",
    "4. 🏆 Copa del Rey - 1/64 de Final",
    "5. 🇪🇸 1ª REF - 4ªJornada de Liga",
    "6. 🇪🇸 1ª REF - 5ªJornada de Liga",
    "7. 🏆 Copa del Rey - 1/16 de Final",
    "8. 🇪🇸 1ª REF - 6ªJornada de Liga",
    "9. 🇪🇸 1ª REF - 7ªJornada de Liga",
    "10. 🏆 Copa del Rey - Octavos de Final",
    "11. 🇪🇸 1ª REF - 8ªJornada de Liga",
    "12. 🇪🇸 1ª REF - 9ªJornada de Liga",
    "13. 🏆 Copa del Rey - Cuartos de Final",
    "14. 🇪🇸 1ª REF - 10ªJornada de Liga",
    "15. 🇪🇸 1ª REF - 11ªJornada de Liga",
    "16. 🏆 Copa del Rey - Ida de Semifinal",
    "17. 🇪🇸 1ª REF - 12ªJornada de Liga",
    "18. 🇪🇸 1ª REF - 13ªJornada de Liga",
    "19. 🏆 Copa del Rey - Vuelta de Semifinal",
    "20. 🇪🇸 1ª REF - 14ªJornada de Liga",
    "21. 🇪🇸 1ª REF - 15ªJornada de Liga",
    "22. 🏆 Copa del Rey - Final"
  ].join("\n");
  function obtenerCalendarioTexto() {
    try {
      var v = localStorage.getItem(CALENDARIO_TEXTO_KEY);
      return v !== null ? v : CALENDARIO_TEXTO_DEFECTO;
    } catch (err) {
      return CALENDARIO_TEXTO_DEFECTO;
    }
  }
  function guardarCalendarioTexto(texto) {
    try {
      localStorage.setItem(CALENDARIO_TEXTO_KEY, texto || "");
      return true;
    } catch (err) {
      console.error("[estado] no se pudo guardar el calendario de competiciones:", err);
      return false;
    }
  }

  // ---------- Menú del club (izquierda) — orden + tarjetas personalizadas ----------
  // Cada una de las 6 cajas humanas tiene su PROPIO menú (candado 646,
  // editable): las 8 tarjetas de fábrica se pueden REORDENAR (nunca
  // borrar) y el admin puede añadir tarjetas de competición nuevas (esas
  // sí se pueden borrar). Se guarda solo el ORDEN + lo añadido — nunca se
  // toca ninguna seed estática, mismo principio que balones/estadios.
  var MENU_CLUB_BUILTIN = [
    { id: "titulos", icono: "🏆", etiqueta: "Títulos" },
    { id: "derbys", icono: "⚔️", etiqueta: "Derbys" },
    { id: "objetivos", icono: "🎯", etiqueta: "Objetivos" },
    { id: "plantilla", icono: "👕", etiqueta: "Plantilla" },
    { id: "liga1ref", icono: "🔹", etiqueta: "Liga 1ª REF" },
    { id: "copadelrey", icono: "🔹", etiqueta: "Copa del Rey" },
    { id: "superliga", icono: "🍇", etiqueta: "Superliga" },
    { id: "supercopaespana", icono: "🏅", etiqueta: "Supercopa España" }
  ];
  function _menuClubIdsBuiltin() { return MENU_CLUB_BUILTIN.map(function (c) { return c.id; }); }
  function _menuClubKey(clubId) { return "ef7_club_menu_v1_" + clubId; }
  function _cargarMenuClub(clubId) {
    try {
      var raw = localStorage.getItem(_menuClubKey(clubId));
      var ov = raw ? JSON.parse(raw) : null;
      if (!ov) return { orden: _menuClubIdsBuiltin(), personalizadas: {}, overridesFabrica: {} };
      if (!ov.orden) ov.orden = _menuClubIdsBuiltin();
      if (!ov.personalizadas) ov.personalizadas = {};
      if (!ov.overridesFabrica) ov.overridesFabrica = {};
      return ov;
    } catch (err) {
      return { orden: _menuClubIdsBuiltin(), personalizadas: {}, overridesFabrica: {} };
    }
  }
  function _guardarMenuClub(clubId, ov) {
    try {
      localStorage.setItem(_menuClubKey(clubId), JSON.stringify(ov));
      return true;
    } catch (err) {
      console.error("[estado] no se pudo guardar el menú del club:", err);
      return false;
    }
  }
  function obtenerMenuClub(clubId) {
    var ov = _cargarMenuClub(clubId);
    var builtinPorId = {};
    MENU_CLUB_BUILTIN.forEach(function (c) { builtinPorId[c.id] = c; });

    var orden = ov.orden.slice();
    // Cualquier tarjeta de fábrica NUEVA (añadida en una versión futura de
    // la app) que el admin todavía no tenga en su orden guardado se añade
    // al final automáticamente — nunca desaparece solo por haber editado
    // el menú antes de que esa tarjeta existiera.
    MENU_CLUB_BUILTIN.forEach(function (c) {
      if (orden.indexOf(c.id) === -1) orden.push(c.id);
    });

    return orden.map(function (id) {
      if (builtinPorId[id]) {
        var override = ov.overridesFabrica[id];
        return Object.assign(
          { esCustom: false, esFabricaEditada: !!override },
          builtinPorId[id],
          override || {}
        );
      }
      var custom = ov.personalizadas[id];
      if (!custom) return null;
      return Object.assign({ esCustom: true, id: id }, custom);
    }).filter(Boolean);
  }
  function anadirTarjetaMenuClub(clubId, icono, etiqueta) {
    if (!etiqueta || !etiqueta.trim()) return null;
    var ov = _cargarMenuClub(clubId);
    var id = "custom-menu-" + Date.now();
    ov.personalizadas[id] = { icono: (icono || "⭐").trim(), etiqueta: etiqueta.trim() };
    ov.orden.push(id);
    return _guardarMenuClub(clubId, ov) ? id : null;
  }
  // Renombra/re-icona CUALQUIER tarjeta del menú, de fábrica o añadida por
  // el admin. Las de fábrica se guardan como override (nunca se toca
  // MENU_CLUB_BUILTIN — el nombre/icono "de verdad" sigue disponible para
  // restablecerTarjetaMenuClub); las custom se editan directamente porque
  // su único origen de datos YA es `personalizadas`.
  function editarTarjetaMenuClub(clubId, id, icono, etiqueta) {
    if (!etiqueta || !etiqueta.trim()) return false;
    var ov = _cargarMenuClub(clubId);
    var valor = { icono: (icono || "⭐").trim(), etiqueta: etiqueta.trim() };
    if (_menuClubIdsBuiltin().indexOf(id) !== -1) {
      ov.overridesFabrica[id] = valor;
    } else if (ov.personalizadas[id]) {
      ov.personalizadas[id] = valor;
    } else {
      return false;
    }
    return _guardarMenuClub(clubId, ov);
  }
  // Solo aplica a tarjetas de fábrica editadas — vuelve a su nombre/icono
  // original sin afectar a su posición en el orden.
  function restablecerTarjetaMenuClub(clubId, id) {
    var ov = _cargarMenuClub(clubId);
    if (!ov.overridesFabrica[id]) return false;
    delete ov.overridesFabrica[id];
    return _guardarMenuClub(clubId, ov);
  }
  function moverTarjetaMenuClub(clubId, id, direccion) {
    var ov = _cargarMenuClub(clubId);
    MENU_CLUB_BUILTIN.forEach(function (c) { if (ov.orden.indexOf(c.id) === -1) ov.orden.push(c.id); });
    var idx = ov.orden.indexOf(id);
    if (idx === -1) return false;
    var destino = idx + direccion;
    if (destino < 0 || destino >= ov.orden.length) return false;
    var tmp = ov.orden[idx];
    ov.orden[idx] = ov.orden[destino];
    ov.orden[destino] = tmp;
    return _guardarMenuClub(clubId, ov);
  }
  function borrarTarjetaMenuClub(clubId, id) {
    if (!_esIdCustom(id) || id.indexOf("custom-menu-") !== 0) return false; // solo tarjetas añadidas por el admin
    var ov = _cargarMenuClub(clubId);
    ov.orden = ov.orden.filter(function (x) { return x !== id; });
    delete ov.personalizadas[id];
    return _guardarMenuClub(clubId, ov);
  }

  // ---------- Calendario EXTRA por club (partidos añadidos a mano, en texto) ----------
  // data/partidos.json ya trae el calendario real completo de Liga + Copa
  // + Supercopa para los 6 humanos — esto es SOLO para sumar partidos que
  // ese fixture estático no cubre todavía (una ronda de Champions/Europa
  // League recién sorteada, un amistoso...): cada caja pega su propio
  // texto y se fusiona en el calendario de la derecha (ver
  // js/renderizadores.js::parsearPartidosExtraTexto +
  // generarCalendarioLateralDerecho).
  function _calendarioExtraKey(clubId) { return "ef7_club_calendario_extra_v1_" + clubId; }
  function obtenerCalendarioExtraTexto(clubId) {
    try {
      var v = localStorage.getItem(_calendarioExtraKey(clubId));
      return v !== null ? v : "";
    } catch (err) {
      return "";
    }
  }
  function guardarCalendarioExtraTexto(clubId, texto) {
    try {
      localStorage.setItem(_calendarioExtraKey(clubId), texto || "");
      return true;
    } catch (err) {
      console.error("[estado] no se pudo guardar el calendario extra del club:", err);
      return false;
    }
  }

  // ---------- Lesionados / sancionados por club (Fase 4) ----------
  // Igual que el calendario extra: una lista de texto libre POR CLUB
  // (el mánager de cada caja lleva la suya, independiente de con quién
  // juegue cada partido), persistida en su propia clave localStorage.
  // "tipo" es "lesionados" o "sancionados" — mismas 3 funciones sirven
  // para ambas listas, sin duplicar código.
  function _listaJugadoresKey(clubId, tipo) { return "ef7_club_" + tipo + "_v1_" + clubId; }
  function obtenerListaJugadores(clubId, tipo) {
    try {
      var raw = localStorage.getItem(_listaJugadoresKey(clubId, tipo));
      var lista = raw ? JSON.parse(raw) : [];
      return Array.isArray(lista) ? lista : [];
    } catch (err) {
      return [];
    }
  }
  function _guardarListaJugadores(clubId, tipo, lista) {
    try {
      localStorage.setItem(_listaJugadoresKey(clubId, tipo), JSON.stringify(lista));
      return true;
    } catch (err) {
      console.error("[estado] no se pudo guardar la lista de " + tipo + " del club:", err);
      return false;
    }
  }
  function agregarJugadorALista(clubId, tipo, nombre) {
    nombre = String(nombre || "").trim();
    var lista = obtenerListaJugadores(clubId, tipo);
    if (!nombre) return lista;
    lista.push(nombre);
    _guardarListaJugadores(clubId, tipo, lista);
    return lista;
  }
  function quitarJugadorDeLista(clubId, tipo, indice) {
    var lista = obtenerListaJugadores(clubId, tipo);
    if (indice < 0 || indice >= lista.length) return lista;
    lista.splice(indice, 1);
    _guardarListaJugadores(clubId, tipo, lista);
    return lista;
  }

  // ---------- Plantilla (nombres reales de jugadores) por club ----------
  // data/jugadores.json trae el esqueleto FIJO (id/equipoId/posicion/
  // dorsal) sin nombre — cada mánager rellena el nombre real de SU
  // plantilla desde el editor del club (candado 646, pestaña "👕
  // Plantilla"). Se guarda como mapa { jugadorId: nombre } por club
  // (overlay puro — nunca se toca data/jugadores.json), mismo criterio
  // que balones/estadios pero namespaced por club como el calendario
  // extra. `obtenerNombresPlantilla` alimenta tanto la pantalla
  // "Plantilla" (solo lectura) como el picker de Lesionados/Sancionados
  // de la previa — una única fuente de nombres para todo el club.
  function _plantillaKey(clubId) { return "ef7_plantilla_v1_" + clubId; }
  function obtenerNombresPlantilla(clubId) {
    try {
      var raw = localStorage.getItem(_plantillaKey(clubId));
      var mapa = raw ? JSON.parse(raw) : {};
      return mapa && typeof mapa === "object" ? mapa : {};
    } catch (err) {
      return {};
    }
  }
  function guardarNombresPlantilla(clubId, mapa) {
    try {
      localStorage.setItem(_plantillaKey(clubId), JSON.stringify(mapa || {}));
      return true;
    } catch (err) {
      console.error("[estado] no se pudo guardar la plantilla del club:", err);
      return false;
    }
  }

  // ---------- Liga 1ª REF — tabla BASE de los equipos IA, pegada en texto (candado 646) ----------
  // Este simulador NO simula los partidos IA-vs-IA — el admin lleva esos
  // resultados fuera de la web y pega aquí el snapshot agregado de cada
  // equipo IA REAL (los que el propio usuario dio: Real Zaragoza, SD
  // Huesca...). Es UNA sola tabla global (no por club): las 6 cajas parten
  // de la MISMA base. La clasificación final que se ve en pantalla suma
  // esta base + los partidos de LIGA que cada uno de los 6 humanos ya
  // tiene jugados en su propio calendario dentro de la app — "la
  // batidora" (ver js/renderizadores.js::calcularLiga1RefCombinada). Un
  // club humano NUNCA se alimenta de este texto (aunque el admin pegue su
  // nombre por error, se ignora): su fila sale SIEMPRE de sus propios
  // partidos jugados, para que solo haya una fuente de verdad por equipo.
  // Se edita desde dentro de la propia pantalla "🔹 Liga 1ª REF" (✏️
  // arriba a la derecha, PIN 646) — ver
  // js/renderizadores.js::parsearLiga1RefTexto/
  // renderizarLiga1RefClasificacion/pintarEditorLiga1Ref.
  // Formato de línea: "Pos Nombre Pts PJ PE PP G+ G- DG" (separado por
  // espacios, tal cual se copia de otra tabla — Pos y DG son opcionales,
  // el motor los ignora/recalcula). Sembrada con la clasificación real que
  // dio el usuario al pedir esta pantalla, para que no arranque vacía.
  var LIGA1REF_TEXTO_KEY = "ef7_liga1ref_clasificacion_v1";
  var LIGA1REF_TEXTO_DEFECTO = [
    "1    Real Zaragoza        9   3   0   0   10  0   10",
    "2    SD Huesca            6   3   0   1   5   2   3",
    "3    CD Tenerife          6   2   0   0   3   0   3",
    "4    CD Mirandés          6   3   0   1   3   3   0",
    "5    Cultural Leonesa     4   3   1   1   3   2   1",
    "6    Real Sociedad B      4   3   1   1   4   4   0",
    "7    FC Andorra           3   2   0   1   3   3   0",
    "8    AD Ceuta FC          2   3   2   1   1   6   -5",
    "9    CE Sabadell          1   3   1   2   2   5   -3",
    "10   Celta Fortuna        1   3   1   2   0   4   -4",
    "11   CD Eldense           0   2   0   2   0   5   -5"
  ].join("\n");
  function obtenerLiga1RefTexto() {
    try {
      var v = localStorage.getItem(LIGA1REF_TEXTO_KEY);
      return v !== null ? v : LIGA1REF_TEXTO_DEFECTO;
    } catch (err) {
      return LIGA1REF_TEXTO_DEFECTO;
    }
  }
  function guardarLiga1RefTexto(texto) {
    try {
      localStorage.setItem(LIGA1REF_TEXTO_KEY, texto || "");
      return true;
    } catch (err) {
      console.error("[estado] no se pudo guardar la clasificación de 1ª REF:", err);
      return false;
    }
  }

  // ---------- Balones y estadios EDITABLES (overlay sobre el seed) ----------
  // data/balones.json y data/estadios.json son el estado de fábrica —
  // añadir/editar/borrar nunca los toca. Se guarda solo la DIFERENCIA
  // (overlay) en localStorage, y cargarTodo() la aplica una vez al fusionar,
  // así el resto de la app (resolución de estadio por poder, balón por
  // competición) ve siempre la lista YA fusionada sin tocar cada sitio.
  function _cargarOverlay(key) {
    try {
      var raw = localStorage.getItem(key);
      var ov = raw ? JSON.parse(raw) : null;
      if (!ov) return { anadidos: [], ediciones: {}, eliminados: [] };
      if (!ov.anadidos) ov.anadidos = [];
      if (!ov.ediciones) ov.ediciones = {};
      if (!ov.eliminados) ov.eliminados = [];
      return ov;
    } catch (err) {
      return { anadidos: [], ediciones: {}, eliminados: [] };
    }
  }
  function _guardarOverlay(key, ov) {
    try {
      localStorage.setItem(key, JSON.stringify(ov));
      return true;
    } catch (err) {
      console.error("[estado] no se pudo guardar overlay", key, err);
      return false;
    }
  }
  function _esIdCustom(id) { return typeof id === "string" && id.indexOf("custom-") === 0; }

  function _fusionarOverlay(base, key) {
    var ov = _cargarOverlay(key);
    var lista = (base || [])
      .filter(function (item) { return ov.eliminados.indexOf(item.id) === -1; })
      .map(function (item) {
        var edicion = ov.ediciones[item.id];
        if (!edicion) return item;
        var copia = {};
        for (var k in item) if (item.hasOwnProperty(k)) copia[k] = item[k];
        for (var k2 in edicion) if (edicion.hasOwnProperty(k2)) copia[k2] = edicion[k2];
        return copia;
      });
    return lista.concat(ov.anadidos);
  }

  var BALONES_KEY = "ef7_balones_custom_v1";
  var ESTADIOS_KEY = "ef7_estadios_custom_v1";

  function fusionarBalones(baseBalones) { return _fusionarOverlay(baseBalones, BALONES_KEY); }
  function fusionarEstadios(baseEstadios) { return _fusionarOverlay(baseEstadios, ESTADIOS_KEY); }

  function anadirBalon(nombre) {
    if (!nombre || !nombre.trim()) return null;
    var ov = _cargarOverlay(BALONES_KEY);
    var id = "custom-balon-" + Date.now();
    ov.anadidos.push({ id: id, nombre: nombre.trim() });
    return _guardarOverlay(BALONES_KEY, ov) ? id : null;
  }
  function editarBalon(id, nombre) {
    if (!nombre || !nombre.trim()) return false;
    var ov = _cargarOverlay(BALONES_KEY);
    if (_esIdCustom(id)) {
      ov.anadidos = ov.anadidos.map(function (b) { return b.id === id ? { id: id, nombre: nombre.trim() } : b; });
    } else {
      ov.ediciones[id] = { nombre: nombre.trim() };
    }
    return _guardarOverlay(BALONES_KEY, ov);
  }
  function borrarBalon(id) {
    var ov = _cargarOverlay(BALONES_KEY);
    if (_esIdCustom(id)) {
      ov.anadidos = ov.anadidos.filter(function (b) { return b.id !== id; });
    } else {
      if (ov.eliminados.indexOf(id) === -1) ov.eliminados.push(id);
      delete ov.ediciones[id];
    }
    return _guardarOverlay(BALONES_KEY, ov);
  }

  var CATEGORIAS_ESTADIO = ["Modesto", "Medio", "Grande", "Élite"];
  function anadirEstadio(nombre, capacidad, categoria) {
    if (!nombre || !nombre.trim()) return null;
    var ov = _cargarOverlay(ESTADIOS_KEY);
    var id = "custom-estadio-" + Date.now();
    ov.anadidos.push({
      id: id,
      nombre: nombre.trim(),
      capacidad: Math.max(0, Number(capacidad) || 0),
      categoria: categoria || CATEGORIAS_ESTADIO[0]
    });
    return _guardarOverlay(ESTADIOS_KEY, ov) ? id : null;
  }
  function editarEstadio(id, nombre, capacidad, categoria) {
    if (!nombre || !nombre.trim()) return false;
    var datos = { nombre: nombre.trim(), capacidad: Math.max(0, Number(capacidad) || 0), categoria: categoria || CATEGORIAS_ESTADIO[0] };
    var ov = _cargarOverlay(ESTADIOS_KEY);
    if (_esIdCustom(id)) {
      ov.anadidos = ov.anadidos.map(function (e) { return e.id === id ? Object.assign({ id: id }, datos) : e; });
    } else {
      ov.ediciones[id] = datos;
    }
    return _guardarOverlay(ESTADIOS_KEY, ov);
  }
  function borrarEstadio(id) {
    var ov = _cargarOverlay(ESTADIOS_KEY);
    if (_esIdCustom(id)) {
      ov.anadidos = ov.anadidos.filter(function (e) { return e.id !== id; });
    } else {
      if (ov.eliminados.indexOf(id) === -1) ov.eliminados.push(id);
      delete ov.ediciones[id];
    }
    return _guardarOverlay(ESTADIOS_KEY, ov);
  }

  // Todas las claves de esta app en localStorage empiezan por "ef7_" —
  // resultados (STORAGE_KEY), temporada, nombre de liga, calendario
  // admin, menú/calendario extra/lesionados/sancionados/plantilla de
  // CADA club, Liga 1ª REF y los overlays de balones/estadios. Barrer
  // por prefijo (en vez de mantener una lista de claves a mano) es lo
  // que garantiza que "Borrar TODO" y el backup de "Exportar/Importar
  // progreso" cubran SIEMPRE el 100% de los datos reales de la app,
  // incluida cualquier clave NUEVA que se añada en el futuro sin tener
  // que acordarse de tocar este bloque.
  var PREFIJO_CLAVES = "ef7_";
  function _clavesDeLaApp() {
    var claves = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(PREFIJO_CLAVES) === 0) claves.push(k);
      }
    } catch (err) {
      console.error("[estado] no se pudo listar localStorage:", err);
    }
    return claves;
  }

  // Wipe total — Panel Admin, "🗑️ Borrar TODO". Alcance DELIBERADAMENTE
  // ESTRECHO (el propio texto de confirmación en js/main.js lo promete
  // así): solo borra resultados/actas/terceros partidos de desempate
  // (STORAGE_KEY). Las 6 plantillas, el calendario extra de cada club,
  // los iconos del menú, Lesionados/Sancionados, Liga 1ª REF y los
  // balones/estadios editados NUNCA se tocan aquí — eso es edición del
  // admin, no "progreso de partidos jugados". `_clavesDeLaApp()` solo
  // se usa para el backup completo (exportar/importar), no para este
  // borrado — son alcances distintos a propósito.
  function borrarTodo() {
    _estado = estadoPorDefecto();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error("[estado] no se pudo borrar localStorage:", err);
    }
    return true;
  }

  // ---------- Backup (panel antiborrado) ----------
  // El progreso REAL de la app vive repartido en muchas claves de
  // localStorage (resultados, el calendario de CADA club, los iconos
  // del menú, la plantilla, lesionados/sancionados, balones/estadios
  // editados, el nombre de la liga...). Exportar solo el blob de
  // resultados (como hacía la versión antigua de esta función) dejaba
  // fuera casi todo eso — al importar en otro dispositivo, o tras
  // borrar datos de navegación, los calendarios y los iconos seguían
  // perdidos, aunque el import "funcionara" (partidos jugados sí
  // volvían, todo lo demás no). El backup ahora es un volcado COMPLETO
  // de toda clave "ef7_*", así cubre siempre el 100% — y, sin backend
  // real, es también la única forma de pasar el progreso de un
  // dispositivo a otro: exportar en uno, mandar el archivo (WhatsApp,
  // email...) e importar en el otro.
  var FORMATO_BACKUP_COMPLETO = "ef7-backup-v2";
  function exportarEstadoCrudo() {
    var claves = {};
    _clavesDeLaApp().forEach(function (k) { claves[k] = localStorage.getItem(k); });
    return { formato: FORMATO_BACKUP_COMPLETO, claves: claves };
  }
  function importarEstadoCrudo(obj) {
    if (!obj || typeof obj !== "object") throw new Error("Copia de seguridad inválida");

    // Formato NUEVO (v2) — volcado completo de todas las claves ef7_*.
    if (obj.formato === FORMATO_BACKUP_COMPLETO && obj.claves && typeof obj.claves === "object") {
      var huboAlgo = false;
      Object.keys(obj.claves).forEach(function (key) {
        if (key.indexOf(PREFIJO_CLAVES) !== 0) return; // nunca escribas nada ajeno a esta app
        try {
          localStorage.setItem(key, obj.claves[key]);
          huboAlgo = true;
        } catch (err) {
          console.error("[estado] no se pudo restaurar la clave " + key + ":", err);
        }
      });
      _estado = null; // fuerza a releer desde localStorage en el próximo cargarEstado()
      return huboAlgo;
    }

    // Formato VIEJO (backups guardados ANTES de este fix, solo traían
    // resultados/partidosGenerados) — se sigue aceptando para no
    // invalidar copias de seguridad ya hechas por el usuario.
    _estado = {
      version: obj.version || 1,
      resultados: obj.resultados || {},
      partidosGenerados: obj.partidosGenerados || {}
    };
    return guardarEstado();
  }

  window.Estado = {
    cargarEstado: cargarEstado,
    guardarEstado: guardarEstado,
    registrarResultadoPartido: registrarResultadoPartido,
    obtenerResultadoOverride: obtenerResultadoOverride,
    registrarPartidoGenerado: registrarPartidoGenerado,
    listarPartidosResueltos: listarPartidosResueltos,
    calcularClasificacion: calcularClasificacion,
    calcularEstadisticasJugador: calcularEstadisticasJugador,
    exportarEstadoCrudo: exportarEstadoCrudo,
    importarEstadoCrudo: importarEstadoCrudo,
    borrarTodo: borrarTodo,
    obtenerTemporada: obtenerTemporada,
    guardarTemporada: guardarTemporada,
    obtenerNombreLiga: obtenerNombreLiga,
    guardarNombreLiga: guardarNombreLiga,
    obtenerCalendarioTexto: obtenerCalendarioTexto,
    guardarCalendarioTexto: guardarCalendarioTexto,
    obtenerMenuClub: obtenerMenuClub,
    anadirTarjetaMenuClub: anadirTarjetaMenuClub,
    editarTarjetaMenuClub: editarTarjetaMenuClub,
    restablecerTarjetaMenuClub: restablecerTarjetaMenuClub,
    moverTarjetaMenuClub: moverTarjetaMenuClub,
    borrarTarjetaMenuClub: borrarTarjetaMenuClub,
    obtenerCalendarioExtraTexto: obtenerCalendarioExtraTexto,
    guardarCalendarioExtraTexto: guardarCalendarioExtraTexto,
    obtenerListaJugadores: obtenerListaJugadores,
    agregarJugadorALista: agregarJugadorALista,
    quitarJugadorDeLista: quitarJugadorDeLista,
    obtenerNombresPlantilla: obtenerNombresPlantilla,
    guardarNombresPlantilla: guardarNombresPlantilla,
    obtenerLiga1RefTexto: obtenerLiga1RefTexto,
    guardarLiga1RefTexto: guardarLiga1RefTexto,
    fusionarBalones: fusionarBalones,
    fusionarEstadios: fusionarEstadios,
    anadirBalon: anadirBalon,
    editarBalon: editarBalon,
    borrarBalon: borrarBalon,
    anadirEstadio: anadirEstadio,
    editarEstadio: editarEstadio,
    borrarEstadio: borrarEstadio,
    CATEGORIAS_ESTADIO: CATEGORIAS_ESTADIO
  };
})();
