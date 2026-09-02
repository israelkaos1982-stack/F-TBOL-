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

  // Fuerza a releer el blob de resultados desde localStorage en la
  // próxima llamada a cargarEstado() — necesario cuando js/sync.js
  // escribe una copia nueva de STORAGE_KEY directamente en
  // localStorage (llegada de otro dispositivo): sin esto, el _estado
  // cacheado en memoria seguiría siendo el viejo hasta recargar la
  // página.
  function invalidarCache() {
    _estado = null;
  }

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

  // Borra el resultado guardado de un partido — vuelve a "sin jugar"
  // para poder repetirlo (pruebas). Acción destructiva: la UI que la
  // dispara la gatea SIEMPRE detrás del PIN de administrador (ver
  // js/renderizadores.js, window.Main.pedirPinAdmin).
  function reiniciarResultadoPartido(partidoId) {
    var e = cargarEstado();
    if (!e.resultados[partidoId]) return false;
    delete e.resultados[partidoId];
    return guardarEstado();
  }

  function registrarPartidoGenerado(partido) {
    var e = cargarEstado();
    e.partidosGenerados[partido.id] = partido;
    return guardarEstado();
  }

  // "Calendario extra" de CADA club humano (texto libre pegado por el
  // admin — competiciones que data/partidos.json todavía no cubre, ver
  // js/renderizadores.js::parsearPartidosExtraTexto) convertido a objetos
  // de partido PLANOS, con la MISMA forma que data/partidos.json — para
  // que listarPartidosResueltos() sea la ÚNICA fuente que necesitan
  // calcularClasificacion/calcularLiga1RefStatsHumanos/calcularStatsRosterClub,
  // sin que ninguno tenga que saber que ese texto existe. `competicion` se
  // normaliza al mismo compKey interno ("liga"/"copa"/"supercopa"...) que
  // ya usa la propia card del calendario (resolverCompKeyPartido, alias de
  // js/renderizadores.js::_resolverCompKeyBalon) — así "Liga"/"🇪🇸 Liga"/
  // "LIGA" tecleado por el admin siempre cuadra con el `=== "liga"` que
  // usa calcularClasificacion. 0 KB de datos nuevos: reutiliza el mismo
  // texto que ya pega el admin, solo lo hace VISIBLE a los agregadores que
  // antes no llegaban a verlo — es la causa raíz de que la clasificación/
  // los 15 mejores/la Plantilla se quedaran a 0 pese a partidos jugados.
  function _partidosExtraDeTodosLosClubes(datos, resultadosEnVivo) {
    var R = window.Renderizadores;
    if (!R || !R.parsearPartidosExtraTexto || !R.resolverRivalPorNombre) return [];
    var resolverCompKey = R.resolverCompKeyPartido || function (c) { return c; };
    var ahoraMs = Date.now();
    var out = [];
    (datos.equipos.equipos || []).forEach(function (club) {
      var texto = obtenerCalendarioExtraTexto(club.id);
      R.parsearPartidosExtraTexto(texto, club.nombre).forEach(function (ex, i) {
        var rival = R.resolverRivalPorNombre(ex.rivalNombre, datos, club.ligaActual);
        var compKey = resolverCompKey(ex.competicion);
        out.push({
          id: ex.id,
          competicion: compKey,
          liga: compKey === "liga" ? club.ligaActual : null,
          ronda: ex.ronda,
          jornada: null,
          local: ex.esVisitante ? rival.id : club.id,
          visitante: ex.esVisitante ? club.id : rival.id,
          fecha: null,
          _fechaTexto: ex.fecha,
          // Mismo fallback que usaba generarCalendarioLateralDerecho antes de
          // esta unificación: "ahora" + i días, i = orden dentro del texto de
          // ESTE club — solo importa el orden RELATIVO entre sus propios
          // partidos sin fecha real, nunca se compara entre clubes distintos.
          _fechaFallbackMs: ahoraMs + i * 86400000,
          // Solo para _deduplicarExtraHumanoVsHumano — se quita antes de
          // devolver la lista (mismo shape que data/partidos.json siempre).
          _origenClubId: club.id,
          jugado: ex.jugado,
          resultado: ex.jugado ? {
            golesLocal: ex.esVisitante ? ex.golesRival : ex.golesClub,
            golesVisitante: ex.esVisitante ? ex.golesClub : ex.golesRival
          } : null
        });
      });
    });
    return _deduplicarExtraHumanoVsHumano(out, resultadosEnVivo || {});
  }

  function _normTxtExtra(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  }

  // BUG REAL (2026, fotos de calendarios humanos con partidos duplicados):
  // un partido HUMANO vs HUMANO puede quedar escrito DOS VECES en el
  // "Calendario extra" — el admin pega la línea de ESE partido en el
  // texto de AMBOS clubes (cada uno "desde su propio lado"), sin saber
  // que el otro club también la tiene. Como el id de cada línea sale del
  // hash del texto de CADA club (que nombra al rival de forma distinta:
  // "Liverpool" desde el texto de Real Madrid, "Real Madrid" desde el de
  // Liverpool), el bucle de arriba genera 2 partidos SINTÉTICOS con id
  // distinto para el MISMO partido real — ambos sobreviven en
  // listarPartidosResueltos() y se cuentan 2 veces: en el calendario de
  // los 2 clubes, y también en clasificación/estadísticas (que leen la
  // misma lista). Nunca pasa con un rival IA porque solo un club (el
  // humano) tiene texto — el rival IA no puede "duplicarlo por su lado".
  //
  // Se colapsan a UNO cuando 2 CLUBES DISTINTOS describen el mismo
  // partido: misma competición + misma ronda (normalizadas) + el MISMO
  // PAR de equipos, sin importar quién es local o quién visitante (el
  // admin pudo escribirlo con la localía al revés en cada texto). Si es
  // el MISMO club el que repite la línea (p.ej. ida y vuelta de una
  // eliminatoria sin distinguirlo en el texto de la ronda — el propio
  // parsearPartidosExtraTexto ya contempla y soporta ese caso vía
  // idsVistos) NO se toca: ambas líneas se conservan, es intencional.
  //
  // Prioridad al elegir cuál de los 2 duplicados sobrevive: (1) el que
  // ya tenga un resultado registrado EN VIVO desde la app
  // (Estado.registrarResultadoPartido) — CRÍTICO: nunca se descarta un
  // partido que el usuario ya jugó, o "revertiría" a sin jugar; (2) el
  // que ya traiga marcador escrito a mano en el propio texto; (3) el
  // primero que aparezca.
  function _deduplicarExtraHumanoVsHumano(items, resultadosEnVivo) {
    function prioridad(p) {
      if (resultadosEnVivo[p.id]) return 2;
      if (p.jugado) return 1;
      return 0;
    }
    var vistoPorClave = {};
    var out = [];
    items.forEach(function (p) {
      var par = [p.local, p.visitante].slice().sort().join("|");
      var clave = _normTxtExtra(p.competicion) + "|" + _normTxtExtra(p.ronda) + "|" + par;
      var registro = vistoPorClave[clave];
      if (!registro) {
        registro = { partido: p, clubes: {} };
        registro.clubes[p._origenClubId] = true;
        vistoPorClave[clave] = registro;
        out.push(p);
        return;
      }
      if (registro.clubes[p._origenClubId]) {
        // Repetición intencional del MISMO club (ida/vuelta sin
        // distinguir en la ronda) — se conservan las 2 líneas.
        out.push(p);
        return;
      }
      registro.clubes[p._origenClubId] = true;
      if (prioridad(p) > prioridad(registro.partido)) {
        var idx = out.indexOf(registro.partido);
        if (idx !== -1) out[idx] = p;
        registro.partido = p;
      }
      // Si no gana prioridad, se descarta en silencio: es el duplicado.
    });
    return out.map(function (p) {
      var copia = {};
      for (var k in p) if (p.hasOwnProperty(k) && k !== "_origenClubId") copia[k] = p[k];
      return copia;
    });
  }

  // ---------- SUPERLIGA — los 6 clubes humanos, todos contra todos ----------
  // A diferencia del Calendario extra (texto libre pegado por el admin) o
  // Liga 1ª REF (snapshot IA + partidos propios), la Superliga es 100%
  // determinista: NINGÚN dato se pega ni se persiste — el par de cada
  // cruce, su localía y sus 3 partidos (SUPERLIGA_LEGS) se recalculan en
  // cada llamada a partir de `datos.equipos.equipos`. 0 KB nuevos en
  // localStorage; solo el resultado ya jugado (registrarResultadoPartido,
  // por id, igual que cualquier otro partido) se guarda.
  var SUPERLIGA_LEGS = 3;

  // Localía FIJA por pareja (i<j, índices dentro de datos.equipos.equipos):
  // con 6 clubes, cada índice se enfrenta a los otros 5 y siempre termina
  // con un reparto balanceado — 3 partidos como local / 2 como visitante
  // en los índices PARES (0,2,4) y 2 local / 3 visitante en los IMPARES
  // (1,3,5), comprobado a mano para las 15 parejas posibles. La regla:
  // `(j - i)` impar -> local el de índice MENOR (i); par -> local el de
  // índice MAYOR (j). Nunca ida y vuelta — un mismo cruce SIEMPRE juega
  // sus 3 partidos con la MISMA localía (petición usuario explícita).
  function _superligaLocalIdx(i, j) {
    return (j - i) % 2 === 1 ? i : j;
  }

  function _partidosSuperliga(datos) {
    var equipos = (datos.equipos && datos.equipos.equipos) || [];
    if (equipos.length < 2) return [];
    var ahoraMs = Date.now();
    var out = [];
    var contador = 0;
    for (var i = 0; i < equipos.length; i++) {
      for (var j = i + 1; j < equipos.length; j++) {
        var localIdx = _superligaLocalIdx(i, j);
        var visitanteIdx = localIdx === i ? j : i;
        var local = equipos[localIdx], visitante = equipos[visitanteIdx];
        for (var leg = 1; leg <= SUPERLIGA_LEGS; leg++) {
          out.push({
            id: "superliga-" + i + "-" + j + "-" + leg,
            competicion: "superliga",
            liga: null,
            ronda: null,
            jornada: null,
            local: local.id,
            visitante: visitante.id,
            fecha: null,
            // Solo importa el orden RELATIVO entre los propios partidos de
            // Superliga (mismo criterio que _fechaFallbackMs de arriba).
            _fechaFallbackMs: ahoraMs + (contador++) * 86400000,
            jugado: false,
            resultado: null
          });
        }
      }
    }
    return out;
  }

  // Vista fusionada: partidos base (data/partidos.json) + Calendario extra
  // de los 6 clubes humanos + Superliga (los 6 humanos, todos contra
  // todos) + generados (terceros partidos de desempate), con el resultado
  // local superpuesto si existe. Es la ÚNICA fuente de verdad que debe
  // leer cualquier pantalla (calendario, clasificación, estadísticas de
  // jugador).
  function listarPartidosResueltos(datos) {
    var e = cargarEstado();
    var base = (datos.partidos.partidos || []).slice();
    var extra = _partidosExtraDeTodosLosClubes(datos, e.resultados);
    var superliga = _partidosSuperliga(datos);
    var generados = Object.keys(e.partidosGenerados).map(function (id) { return e.partidosGenerados[id]; });
    var todos = base.concat(extra).concat(superliga).concat(generados);

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

  // Nota: las estadísticas por jugador (goles/amarillas/rojas/MVP) NUNCA
  // se guardan aparte — se recalculan en caliente escaneando los eventos
  // ya persistidos de listarPartidosResueltos(). Los eventos de la IA
  // (es_humano:false) se ignoran a propósito — sus jugadores genéricos no
  // tienen ficha ni histórico persistido (0 KB extra, regla de Fase 1).
  // Ver js/renderizadores.js::calcularStatsRosterClub (Plantilla) y
  // ::calcularLiga1RefStatsHumanos (ranking Liga 1ª REF) — los 2
  // agregadores reales de este dato, ambos leyendo la MISMA fuente.

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

  // ---------- Nombre de la LIGA principal — UNA por CADA club humano ----------
  // El badge del calendario ("LIGA_EA_SPORTS" -> "LIGA EA SPORTS") venía
  // derivado a pelo de la clave interna de data/equipos_ia.json — un
  // resto del primer mock del proyecto; el admin lo renombraba pulsando
  // el propio badge (js/main.js::editarNombreLiga). Antes era UN solo
  // nombre compartido por los 6 clubes — pero cada uno puede jugar una
  // liga real distinta (p.ej. el PSG SÍ juega la Ligue 1 de verdad, el
  // resto no), y al ascender/descender de división el nombre cambia por
  // club, no para los 6 a la vez — así que cada club guarda el suyo,
  // indexado por su id (petición usuario).
  var LIGA_NOMBRE_KEY_BASE = "ef7_liga_principal_nombre_v1";
  var LIGA_NOMBRE_DEFECTO = "1ª REF";
  function obtenerNombreLiga(clubId) {
    try {
      var v = localStorage.getItem(LIGA_NOMBRE_KEY_BASE + "_" + clubId);
      return v && v.trim() ? v : LIGA_NOMBRE_DEFECTO;
    } catch (err) {
      return LIGA_NOMBRE_DEFECTO;
    }
  }
  function guardarNombreLiga(clubId, valor) {
    var limpio = (valor || "").trim();
    if (!clubId || !limpio) return false;
    try {
      localStorage.setItem(LIGA_NOMBRE_KEY_BASE + "_" + clubId, limpio);
      return true;
    } catch (err) {
      console.error("[estado] no se pudo guardar el nombre de la liga:", err);
      return false;
    }
  }

  // ---------- División actual de cada club (2ª REF/1ª REF/Hypermotion/Ea
  // Sports) ----------
  // Qué tabla de clasificación abre la tarjeta "Liga 1ª REF" del menú de
  // CADA club. Antes esa tarjeta abría SIEMPRE la división "1ref" fuera
  // cual fuera el club (bug: el PSG, que no juega 1ª REF, veía esa tabla
  // igual que los demás) — con ascensos/descensos de temporada en
  // temporada, cada club puede acabar en una división distinta. Se
  // guarda por club (id de LIGA_NAV_ORDEN en js/renderizadores.js:
  // "2ref"/"1ref"/"hypermotion"/"easports"), un string suelto por clave,
  // 0 KB de más. Se fija desde el propio botón 📌 dentro de la pantalla
  // de clasificación (candado 646) — ver js/main.js::fijarDivisionClub.
  var LIGA_DIVISION_KEY_BASE = "ef7_liga_division_v1";
  var LIGA_DIVISION_DEFECTO = "1ref";
  function obtenerDivisionClub(clubId) {
    try {
      var v = localStorage.getItem(LIGA_DIVISION_KEY_BASE + "_" + clubId);
      return v && v.trim() ? v : LIGA_DIVISION_DEFECTO;
    } catch (err) {
      return LIGA_DIVISION_DEFECTO;
    }
  }
  function guardarDivisionClub(clubId, ligaId) {
    if (!clubId || !ligaId) return false;
    try {
      localStorage.setItem(LIGA_DIVISION_KEY_BASE + "_" + clubId, ligaId);
      return true;
    } catch (err) {
      console.error("[estado] no se pudo guardar la división del club:", err);
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
  // data/partidos.json es el fixture ESTÁTICO real (Liga + Copa +
  // Supercopa...) — hoy sigue vacío (nadie lo ha rellenado todavía), así
  // que en la práctica esto es la ÚNICA fuente del calendario de los 6
  // humanos: cada caja pega su propio texto ("Competición - Ronda -
  // Rival") y se fusiona en el calendario de la derecha (ver
  // js/renderizadores.js::parsearPartidosExtraTexto +
  // generarCalendarioLateralDerecho) — y, vía
  // _partidosExtraDeTodosLosClubes() más abajo, TAMBIÉN en
  // listarPartidosResueltos(), para que la clasificación, los rankings de
  // Liga 1ª REF y las estadísticas de la Plantilla vean estos partidos
  // exactamente igual que si vinieran de data/partidos.json. Cuando algún
  // día ese fixture estático se rellene con datos reales, ambas fuentes
  // conviven sin más — cada partido con su propio id nunca colisiona.
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

  // Quita el marcador "(N-M)" pegado al rival en CADA línea del
  // Calendario extra de este club — vuelve esas líneas a "sin jugar" sin
  // borrar la línea entera (conserva competición/ronda/rival/fecha).
  // Complementa a reiniciarResultadoPartido: ese solo borra un resultado
  // CONFIRMADO EN VIVO desde la app (Estado.registrarResultadoPartido) —
  // un partido tecleado por el admin YA CON el marcador en el propio
  // texto (ver js/renderizadores.js::parsearPartidosExtraTexto, "Rival
  // (2-1)") nunca pasa por ahí, así que sin esto el botón de reinicio
  // individual no tenía ningún efecto sobre ellos: el texto seguía
  // trayendo el marcador y el partido volvía a salir "jugado" en el
  // siguiente repintado. Devuelve el nº de líneas a las que se les quitó
  // el marcador (0 si no había ninguna, y en ese caso no toca el guardado).
  function reiniciarCalendarioExtraJugados(clubId) {
    var texto = obtenerCalendarioExtraTexto(clubId);
    if (!texto) return 0;
    var n = 0;
    var limpio = texto
      .split("\n")
      .map(function (linea) {
        var sinMarcador = linea.replace(/\s*\(\s*\d+\s*-\s*\d+\s*\)/, "");
        if (sinMarcador !== linea) n++;
        return sinMarcador;
      })
      .join("\n");
    if (!n) return 0;
    guardarCalendarioExtraTexto(clubId, limpio);
    return n;
  }

  // ---------- Títulos ganados por club (Sala de Títulos) ----------
  // Igual que el calendario extra: texto libre POR CLUB, una línea por
  // trofeo ganado ("Liga - 2032"), que js/renderizadores.js resuelve
  // contra el catálogo cerrado data/titulos.json (ver
  // parsearTitulosTexto/renderizarTitulos). Sin imágenes — cada trofeo
  // se pinta con su icono+color del catálogo, 0 KB por título.
  function _titulosKey(clubId) { return "ef7_club_titulos_v1_" + clubId; }
  function obtenerTitulosTexto(clubId) {
    try {
      var v = localStorage.getItem(_titulosKey(clubId));
      return v !== null ? v : "";
    } catch (err) {
      return "";
    }
  }
  function guardarTitulosTexto(clubId, texto) {
    try {
      localStorage.setItem(_titulosKey(clubId), texto || "");
      return true;
    } catch (err) {
      console.error("[estado] no se pudo guardar los títulos del club:", err);
      return false;
    }
  }

  // ---------- Lesionados / sancionados por club (Fase 4) ----------
  // Igual que el calendario extra: una lista POR CLUB (el mánager de
  // cada caja lleva la suya, independiente de con quién juegue cada
  // partido), persistida en su propia clave localStorage. "tipo" es
  // "lesionados" o "sancionados" — mismas funciones sirven para ambas
  // listas, sin duplicar código.
  //
  // Cada entrada NO es solo un nombre — lleva un RANGO de vigencia
  // sobre el orden cronológico de los partidos del club ("orden" =
  // posición del partido dentro de TODOS los partidos ordenados por
  // fecha de esa caja, ver renderizadores.js::generarCalendarioLateralDerecho,
  // partido._ordenClub):
  //   { id, nombre, desde, hasta }
  //   - desde: orden del partido en cuya previa se marcó al jugador.
  //     Aparece lesionado/sancionado en ESE partido y en todos los
  //     posteriores, hasta que se cierre.
  //   - hasta: orden del partido en cuya previa el admin lo QUITÓ de la
  //     lista, o null si sigue activo (todavía no se ha quitado). Un
  //     partido con orden >= hasta ya NO lo muestra — pero cualquier
  //     partido con orden < hasta (incluidos los que ya se jugaron
  //     antes de quitarlo) SIGUE mostrándolo. Petición explícita del
  //     usuario: "un jugador está lesionado hasta que lo elimine; una
  //     vez lo elimine no aparecerá en ESE partido ni en los siguientes,
  //     pero los partidos previos sí lo tendrán lesionado" — sin este
  //     rango, quitarlo desde CUALQUIER previa lo sanaba también en las
  //     previas de partidos anteriores todavía no jugados (lista plana,
  //     sin historial).
  var _entradaListaSeq = 0;
  function _nuevoIdEntradaLista() { return "el" + Date.now() + "_" + (_entradaListaSeq++); }
  function _normalizarEntradaLista(e) {
    if (typeof e === "string") {
      // Formato legacy (solo el nombre, sin rango): se trata como
      // "lesionado/sancionado desde siempre" para no perder el dato ya
      // guardado — aplica a cualquier partido hasta que se cierre.
      var nombreLegacy = e.trim();
      if (!nombreLegacy) return null;
      return { id: _nuevoIdEntradaLista(), nombre: nombreLegacy, desde: 0, hasta: null };
    }
    if (e && typeof e === "object" && typeof e.nombre === "string" && e.nombre.trim()) {
      return {
        id: e.id || _nuevoIdEntradaLista(),
        nombre: e.nombre,
        desde: typeof e.desde === "number" ? e.desde : 0,
        hasta: typeof e.hasta === "number" ? e.hasta : null
      };
    }
    return null;
  }
  function _listaJugadoresKey(clubId, tipo) { return "ef7_club_" + tipo + "_v1_" + clubId; }
  function obtenerListaJugadores(clubId, tipo) {
    try {
      var raw = localStorage.getItem(_listaJugadoresKey(clubId, tipo));
      var lista = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(lista)) return [];
      var huboLegacy = false;
      var normalizada = lista.map(function (e) {
        if (typeof e === "string") huboLegacy = true;
        return _normalizarEntradaLista(e);
      }).filter(Boolean);
      // Migra el formato legacy a objetos con rango en el primer read,
      // así el id queda estable en las siguientes lecturas (lo usan los
      // botones ✕ de la previa para identificar la entrada exacta).
      if (huboLegacy) _guardarListaJugadores(clubId, tipo, normalizada);
      return normalizada;
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
  // Entradas vigentes para el partido de orden `orden` — las que ya
  // empezaron (desde <= orden) y todavía no se han cerrado antes de él
  // (hasta === null || orden < hasta). Es lo que debe pintar la previa
  // de CUALQUIER partido (jugado o por jugar): cada uno ve el estado
  // real que tenía en su propio momento, no el estado "actual" global.
  function obtenerListaJugadoresActivosPara(clubId, tipo, orden) {
    orden = typeof orden === "number" ? orden : 0;
    return obtenerListaJugadores(clubId, tipo).filter(function (e) {
      return e.desde <= orden && (e.hasta === null || orden < e.hasta);
    });
  }
  // Nombres con una entrada AÚN ABIERTA (hasta === null) — "sigue
  // lesionado/sancionado ahora mismo, todavía no se ha cerrado en NINGÚN
  // partido". Lo usa la Plantilla (fuera de cualquier previa concreta,
  // sin un "orden" de partido al que atarse) para colorear el nombre.
  function obtenerNombresListaActiva(clubId, tipo) {
    var vistos = {};
    obtenerListaJugadores(clubId, tipo).forEach(function (e) {
      if (e.hasta === null) vistos[e.nombre] = true;
    });
    return Object.keys(vistos);
  }
  function agregarJugadorALista(clubId, tipo, nombre, orden) {
    nombre = String(nombre || "").trim();
    var lista = obtenerListaJugadores(clubId, tipo);
    if (!nombre) return lista;
    lista.push({ id: _nuevoIdEntradaLista(), nombre: nombre, desde: typeof orden === "number" ? orden : 0, hasta: null });
    _guardarListaJugadores(clubId, tipo, lista);
    return lista;
  }
  // "Quita" a un jugador de la lista CERRANDO su vigencia en `orden` (el
  // partido cuya previa tenía abierta el admin al pulsar ✕) — nunca
  // borra la entrada: los partidos anteriores a `orden` que ya lo
  // mostraban lesionado/sancionado lo siguen mostrando (ver comentario
  // de la cabecera de esta sección).
  function quitarJugadorDeLista(clubId, tipo, entradaId, orden) {
    var lista = obtenerListaJugadores(clubId, tipo);
    var entrada = null;
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].id === entradaId) { entrada = lista[i]; break; }
    }
    if (!entrada) return lista;
    entrada.hasta = typeof orden === "number" ? orden : 0;
    _guardarListaJugadores(clubId, tipo, lista);
    return lista;
  }

  // ---------- Bloqueo de tarjetas por ciclo/partido (Plantilla) ----------
  // Independiente de Lesionados/Sancionados de arriba — esto es el color
  // AUTOMÁTICO del nombre en la pantalla "Plantilla" (js/renderizadores.js
  // ::renderizarPlantillaClub) según las tarjetas ya acumuladas en el
  // acta de los partidos jugados, no una lista que el admin rellena a
  // mano. 1 sola clave por club, minúscula (solo guarda un número por
  // jugador con AL MENOS un bloqueo ya quitado alguna vez — la inmensa
  // mayoría de la plantilla nunca tiene entrada):
  //   { "<jugadorId>": { ciclo: N, doble: N, roja: N } }
  // El número guardado es el "valor" (amarillas totales / partidos con
  // doble amarilla / partidos con roja directa) que tenía el jugador la
  // ÚLTIMA vez que el admin quitó ESE bloqueo — mientras el valor actual
  // siga siendo ESE MISMO número, el bloqueo sigue quitado; en cuanto el
  // jugador suma una tarjeta más que hace CRECER ese número (otro ciclo
  // de 3, otro partido con doble amarilla, otra roja), el bloqueo se
  // vuelve a encender solo, sin que nadie tenga que "reactivarlo".
  function _tarjetaFlagsKey(clubId) { return "ef7_tarjeta_flags_v1_" + clubId; }
  function obtenerTarjetaFlags(clubId) {
    try {
      var raw = localStorage.getItem(_tarjetaFlagsKey(clubId));
      var obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
    } catch (err) {
      return {};
    }
  }
  function limpiarTarjetaFlag(clubId, jugadorId, tipo, valorActual) {
    if (!jugadorId || !tipo) return obtenerTarjetaFlags(clubId);
    var flags = obtenerTarjetaFlags(clubId);
    if (!flags[jugadorId]) flags[jugadorId] = {};
    flags[jugadorId][tipo] = typeof valorActual === "number" ? valorActual : 0;
    try {
      localStorage.setItem(_tarjetaFlagsKey(clubId), JSON.stringify(flags));
    } catch (err) {
      console.error("[estado] no se pudo guardar el bloqueo de tarjetas:", err);
    }
    return flags;
  }

  // ---------- Objetivos del Club (texto libre, candado 646) ----------
  // Mismo patrón que Calendario extra/Títulos: UN textarea de texto
  // libre por club. Formato: una línea "# SECCIÓN" (LIGA/COPA/SUPERLIGA/
  // GLOBALES) abre sección, y cada línea siguiente hasta la próxima
  // "# " es "Texto del objetivo - N" (N = 1 o 2 puntos, editable). El
  // parseo real vive en js/renderizadores.js::parsearObjetivosTexto —
  // aquí solo se guarda/lee el texto tal cual, 0 KB de estructura extra.
  // Los 6 clubes arrancan con la MISMA plantilla de ejemplo (editable
  // por separado, cada uno la suya, sin tocar las de los demás).
  var OBJETIVOS_DEFAULT_TEXTO = [
    "# LIGA",
    "Ascender - 2",
    "Quedar delante de X equipo - 1",
    "Marcar más de X goles - 1",
    "1 jugador marca X goles o más - 1",
    "1 jugador entre los 15 máximos MVP - 1",
    "",
    "# COPA",
    "Llegar a Cuartos - 2",
    "1 jugador entre los 15 máximos Goleadores - 1",
    "1 jugador entre los 15 máximos MVP - 1",
    "",
    "# SUPERLIGA",
    "Ganar 4 partidos - 2",
    "Quedar delante de X - 1",
    "",
    "# GLOBALES",
    "Marcar 1 hat-trick - 1",
    "Marcar 5 o más goles en 1 partido - 2",
    "6 porterías imbatidas - 2"
  ].join("\n");
  function _objetivosTextoKey(clubId) { return "ef7_objetivos_v1_" + clubId; }
  function obtenerObjetivosTexto(clubId) {
    try {
      var v = localStorage.getItem(_objetivosTextoKey(clubId));
      return v !== null ? v : OBJETIVOS_DEFAULT_TEXTO;
    } catch (err) {
      return OBJETIVOS_DEFAULT_TEXTO;
    }
  }
  function guardarObjetivosTexto(clubId, texto) {
    try {
      localStorage.setItem(_objetivosTextoKey(clubId), texto || "");
      return true;
    } catch (err) {
      console.error("[estado] no se pudo guardar los objetivos del club:", err);
      return false;
    }
  }

  // Objetivos ya LOGRADOS (marcados a mano, tocando la propia fila —
  // sin PIN, es el progreso del mánager, no la estructura). Se guardan
  // por CLAVE de texto (el objetivo SIN el " - N" de puntos), así
  // cambiar solo el nº de puntos de una línea no borra el progreso ya
  // marcado — solo cambiar el TEXTO del objetivo lo hace (mismo criterio
  // que el resto de listas por-nombre de este archivo).
  function _objetivosLogradosKey(clubId) { return "ef7_objetivos_logrados_v1_" + clubId; }
  function obtenerObjetivosLogrados(clubId) {
    try {
      var raw = localStorage.getItem(_objetivosLogradosKey(clubId));
      var lista = raw ? JSON.parse(raw) : [];
      return Array.isArray(lista) ? lista : [];
    } catch (err) {
      return [];
    }
  }
  function toggleObjetivoLogrado(clubId, clave) {
    var lista = obtenerObjetivosLogrados(clubId);
    var idx = lista.indexOf(clave);
    if (idx === -1) lista.push(clave); else lista.splice(idx, 1);
    try {
      localStorage.setItem(_objetivosLogradosKey(clubId), JSON.stringify(lista));
    } catch (err) {
      console.error("[estado] no se pudo guardar el progreso de objetivos:", err);
    }
    return lista;
  }

  // ---------- 💼 Valoración del club (cabecera) ----------
  // 2 números sueltos que el propio mánager teclea a mano ("logrado" /
  // "objetivo para seguir la temporada que viene") — NO se derivan de
  // los Objetivos de arriba (el mánager puede llevar su cuenta aparte,
  // "yo hago la suma manual"). Sin PIN: es su propio progreso.
  function _valoracionClubKey(clubId) { return "ef7_valoracion_v1_" + clubId; }
  function obtenerValoracionClub(clubId) {
    try {
      var raw = localStorage.getItem(_valoracionClubKey(clubId));
      var v = raw ? JSON.parse(raw) : null;
      if (!v || typeof v !== "object") return { logrado: 0, objetivo: 0 };
      return { logrado: Number(v.logrado) || 0, objetivo: Number(v.objetivo) || 0 };
    } catch (err) {
      return { logrado: 0, objetivo: 0 };
    }
  }
  function guardarValoracionClub(clubId, logrado, objetivo) {
    try {
      localStorage.setItem(_valoracionClubKey(clubId), JSON.stringify({
        logrado: Number(logrado) || 0,
        objetivo: Number(objetivo) || 0
      }));
      return true;
    } catch (err) {
      console.error("[estado] no se pudo guardar la valoración del club:", err);
      return false;
    }
  }

  // ---------- Iconos de las 4 cajas de Objetivos (candado 646) ----------
  // Las 4 cajas (LIGA/COPA/SUPERLIGA/GLOBALES) son fijas — solo su
  // ICONO es editable, no su nombre. Por defecto los puestos al crear
  // la pantalla; el admin los cambia por caja, uno a uno.
  var OBJETIVOS_ICONOS_DEFAULT = { LIGA: "🏆", COPA: "🎖️", SUPERLIGA: "🌟", GLOBALES: "🌍" };
  function _objetivosIconosKey(clubId) { return "ef7_objetivos_iconos_v1_" + clubId; }
  function obtenerObjetivosIconos(clubId) {
    var out = {};
    var guardados = null;
    try {
      var raw = localStorage.getItem(_objetivosIconosKey(clubId));
      guardados = raw ? JSON.parse(raw) : null;
    } catch (err) {
      guardados = null;
    }
    Object.keys(OBJETIVOS_ICONOS_DEFAULT).forEach(function (s) {
      out[s] = (guardados && guardados[s]) ? guardados[s] : OBJETIVOS_ICONOS_DEFAULT[s];
    });
    return out;
  }
  function guardarObjetivosIconoSeccion(clubId, seccion, icono) {
    var actuales = obtenerObjetivosIconos(clubId);
    actuales[seccion] = (icono && String(icono).trim()) || OBJETIVOS_ICONOS_DEFAULT[seccion];
    try {
      localStorage.setItem(_objetivosIconosKey(clubId), JSON.stringify(actuales));
      return true;
    } catch (err) {
      console.error("[estado] no se pudo guardar el icono del objetivo:", err);
      return false;
    }
  }

  // ---------- Derbys (Humano vs Humano) — candado 646 ----------
  // Catálogo CERRADO (mismo patrón que Títulos): cada club humano tiene
  // UNA línea por cada uno de los OTROS 5 mánagers, con PJ/PG/PE/PP/G+/G-
  // — el admin solo cambia esos 6 números, el DG y el % de victorias se
  // calculan solos (ver js/renderizadores.js::parsearDerbysTexto). La
  // caja GLOBAL de cada club tampoco se guarda aparte: es la SUMA de las
  // 5 líneas, siempre recalculada, para que nunca pueda desincronizarse
  // del desglose por rival.
  //
  // A diferencia de Objetivos/Títulos (arrancan vacíos o en 0), aquí el
  // texto por defecto es el HISTÓRICO REAL de la temporada anterior que
  // dio el usuario — no hay ningún otro sitio de la app donde ese dato
  // viva, así que "vacío" sería borrarlo. Cada mánager lleva su PROPIA
  // cuenta de forma independiente (petición usuario) — el desglose de
  // Isra contra Álvaro no tiene por qué coincidir número a número con el
  // de Álvaro contra Isra, son 2 registros separados a propósito.
  var DERBYS_DEFAULT_TEXTO = {
    "atletico-madrid": [ // ISRA ✏️
      "Álvaro 🐭: PJ 9 PG 6 PE 1 PP 2 G+ 26 G- 19",
      "Acsa 🔨: PJ 7 PG 6 PE 0 PP 1 G+ 37 G- 8",
      "Toñín 💡: PJ 12 PG 9 PE 1 PP 2 G+ 52 G- 21",
      "Ángel 😈: PJ 10 PG 8 PE 0 PP 2 G+ 40 G- 16",
      "Izan 🦆: PJ 3 PG 2 PE 0 PP 1 G+ 8 G- 4"
    ].join("\n"),
    arsenal: [ // ÁLVARO 🐭
      "Acsa 🔨: PJ 8 PG 2 PE 0 PP 6 G+ 15 G- 27",
      "Toñín 💡: PJ 11 PG 9 PE 1 PP 1 G+ 27 G- 8",
      "Ángel 😈: PJ 10 PG 4 PE 2 PP 4 G+ 31 G- 24",
      "Izan 🦆: PJ 0 PG 0 PE 0 PP 0 G+ 0 G- 0",
      "Isra ✏️: PJ 10 PG 2 PE 1 PP 7 G+ 21 G- 30"
    ].join("\n"),
    "real-madrid": [ // ACSA 🔨
      "Álvaro 🐭: PJ 8 PG 6 PE 0 PP 2 G+ 27 G- 15",
      "Toñín 💡: PJ 10 PG 5 PE 1 PP 4 G+ 15 G- 17",
      "Ángel 😈: PJ 8 PG 2 PE 1 PP 5 G+ 19 G- 25",
      "Izan 🦆: PJ 0 PG 0 PE 0 PP 0 G+ 0 G- 0",
      "Isra ✏️: PJ 8 PG 1 PE 0 PP 7 G+ 9 G- 37"
    ].join("\n"),
    "fc-barcelona": [ // ÁNGEL 😈
      "Álvaro 🐭: PJ 10 PG 4 PE 2 PP 4 G+ 24 G- 31",
      "Acsa 🔨: PJ 8 PG 5 PE 1 PP 2 G+ 25 G- 19",
      "Toñín 💡: PJ 8 PG 2 PE 4 PP 2 G+ 16 G- 16",
      "Izan 🦆: PJ 4 PG 3 PE 1 PP 0 G+ 9 G- 4",
      "Isra ✏️: PJ 10 PG 1 PE 0 PP 9 G+ 15 G- 41"
    ].join("\n"),
    psg: [ // IZAN 🦆
      "Álvaro 🐭: PJ 0 PG 0 PE 0 PP 0 G+ 0 G- 0",
      "Acsa 🔨: PJ 0 PG 0 PE 0 PP 0 G+ 0 G- 0",
      "Toñín 💡: PJ 3 PG 2 PE 0 PP 1 G+ 6 G- 3",
      "Ángel 😈: PJ 4 PG 0 PE 1 PP 3 G+ 4 G- 9",
      "Isra ✏️: PJ 3 PG 1 PE 0 PP 2 G+ 4 G- 8"
    ].join("\n"),
    liverpool: [ // TOÑÍN 💡
      "Álvaro 🐭: PJ 11 PG 1 PE 1 PP 9 G+ 8 G- 27",
      "Acsa 🔨: PJ 10 PG 3 PE 1 PP 6 G+ 15 G- 17",
      "Ángel 😈: PJ 8 PG 2 PE 4 PP 2 G+ 16 G- 16",
      "Izan 🦆: PJ 3 PG 1 PE 0 PP 2 G+ 3 G- 6",
      "Isra ✏️: PJ 11 PG 2 PE 1 PP 8 G+ 17 G- 47"
    ].join("\n")
  };
  function _derbysKey(clubId) { return "ef7_derbys_v1_" + clubId; }
  function obtenerDerbysTexto(clubId) {
    try {
      var v = localStorage.getItem(_derbysKey(clubId));
      return v !== null ? v : (DERBYS_DEFAULT_TEXTO[clubId] || "");
    } catch (err) {
      return DERBYS_DEFAULT_TEXTO[clubId] || "";
    }
  }
  function guardarDerbysTexto(clubId, texto) {
    try {
      localStorage.setItem(_derbysKey(clubId), texto || "");
      return true;
    } catch (err) {
      console.error("[estado] no se pudo guardar los derbys del club:", err);
      return false;
    }
  }

  // ---------- Plantilla (roster real) por club ----------
  // Texto libre, una línea por jugador — mismo patrón que el calendario
  // extra o los títulos: cada mánager pega su plantilla real completa
  // (dorsal + nombre + posición) desde el editor del club (candado 646,
  // pestaña "👕 Plantilla"). js/renderizadores.js::parsearRosterTexto la
  // interpreta; NO hay ningún esqueleto fijo detrás — el nº de jugadores
  // por posición es el que traiga el texto pegado, ni más ni menos.
  // `obtenerRosterTexto` alimenta la pantalla "Plantilla" (solo lectura),
  // el picker de Lesionados/Sancionados de la previa y el selector de
  // jugador del acta en vivo — una única fuente de la plantilla real.
  function _rosterKey(clubId) { return "ef7_roster_v1_" + clubId; }
  function obtenerRosterTexto(clubId) {
    try {
      var v = localStorage.getItem(_rosterKey(clubId));
      return v !== null ? v : "";
    } catch (err) {
      return "";
    }
  }
  function guardarRosterTexto(clubId, texto) {
    try {
      localStorage.setItem(_rosterKey(clubId), texto || "");
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

  // ---------- Liga 1ª REF — Pichichi/MVP/Tarjetas/Zamora (candado 646) ----------
  // Mismo criterio que la tabla de arriba (texto libre, sin IDs) pero con
  // UNA clave por categoría en vez de 5 claves+funciones sueltas — ver
  // js/renderizadores.js::parsearLiga1RefStatTexto/
  // calcularLiga1RefStatsCombinado/renderizarLiga1RefStatDetalle.
  function _liga1RefStatKey(categoria) {
    return "ef7_liga1ref_stat_" + categoria + "_v1";
  }
  function obtenerLiga1RefStatTexto(categoria) {
    try {
      return localStorage.getItem(_liga1RefStatKey(categoria)) || "";
    } catch (err) {
      return "";
    }
  }
  function guardarLiga1RefStatTexto(categoria, texto) {
    try {
      localStorage.setItem(_liga1RefStatKey(categoria), texto || "");
      return true;
    } catch (err) {
      console.error("[estado] no se pudo guardar la estadística " + categoria + " de 1ª REF:", err);
      return false;
    }
  }

  // ---------- Ligas EXTRA (2ª REF / Hypermotion / Ea Sports) — mismo
  // formato de texto libre que Liga 1ª REF de arriba (clasificación:
  // "Pos Nombre Pts PJ PE PP G+ G- DG"; estadística: "Nombre - Equipo
  // Cantidad"), pero SIN "batidora": ningún club humano juega de verdad
  // estas 3 competiciones dentro de la app (a diferencia de Liga 1ª REF,
  // que sí fusiona con los partidos reales de cada club vía
  // js/renderizadores.js::calcularLiga1RefCombinada). Aquí la
  // clasificación Y las 5 cajas de estadísticas son 100% lo que el admin
  // pega a mano — petición usuario: "el resto de estadísticas y
  // clasificación te las doy yo manualmente texto". Una clave de texto
  // por liga (clasificación) + una por liga+categoría (cada estadística).
  var LIGA_EXTRA_IDS = ["2ref", "hypermotion", "easports"];
  function _ligaExtraTextoKey(ligaId) {
    return "ef7_liga_" + ligaId + "_clasificacion_v1";
  }
  function obtenerLigaExtraTexto(ligaId) {
    try {
      return localStorage.getItem(_ligaExtraTextoKey(ligaId)) || "";
    } catch (err) {
      return "";
    }
  }
  function guardarLigaExtraTexto(ligaId, texto) {
    try {
      localStorage.setItem(_ligaExtraTextoKey(ligaId), texto || "");
      return true;
    } catch (err) {
      console.error("[estado] no se pudo guardar la clasificación de " + ligaId + ":", err);
      return false;
    }
  }
  // ---------- 📌 Override del texto de ℹ️ FORMATO/reglas (candado 646)
  // — cada pantalla con ℹ️ (2ª REF/1ª REF/Hypermotion/Ea Sports/Copa
  // del Rey/Superliga) tiene un texto de fábrica
  // (js/renderizadores.js::FORMATO_*_TEXTO); el admin puede sustituirlo
  // por el suyo desde el propio overlay ℹ️ (📌 arriba a la derecha).
  // Vacío = "sigue el de fábrica" (no hay override guardado todavía).
  function _formatoOverrideKey(clave) {
    return "ef7_formato_override_" + clave + "_v1";
  }
  function obtenerFormatoOverride(clave) {
    try {
      return localStorage.getItem(_formatoOverrideKey(clave)) || "";
    } catch (err) {
      return "";
    }
  }
  function guardarFormatoOverride(clave, texto) {
    try {
      localStorage.setItem(_formatoOverrideKey(clave), texto || "");
      return true;
    } catch (err) {
      console.error("[estado] no se pudo guardar el formato de " + clave + ":", err);
      return false;
    }
  }
  function _ligaExtraStatKey(ligaId, categoria) {
    return "ef7_liga_" + ligaId + "_stat_" + categoria + "_v1";
  }
  function obtenerLigaExtraStatTexto(ligaId, categoria) {
    try {
      return localStorage.getItem(_ligaExtraStatKey(ligaId, categoria)) || "";
    } catch (err) {
      return "";
    }
  }
  function guardarLigaExtraStatTexto(ligaId, categoria, texto) {
    try {
      localStorage.setItem(_ligaExtraStatKey(ligaId, categoria), texto || "");
      return true;
    } catch (err) {
      console.error("[estado] no se pudo guardar la estadística " + categoria + " de " + ligaId + ":", err);
      return false;
    }
  }

  // ---------- Copa del Rey — Pichichi/MVP/Amarillas/Rojas (candado 646) ----------
  // Mismo mecanismo EXACTO que las 5 cajas de Liga 1ª REF de arriba (texto
  // libre pegado para la IA + auto-suma de los 6 humanos), pero con su
  // PROPIA clave de guardado — nunca comparte contador con Liga 1ª REF, son
  // 2 competiciones distintas con estadísticas propias. Sin Zamora: no
  // aplica a un cuadro eliminatorio (no hay "media de la temporada" en una
  // Copa que un club puede jugar 1 solo partido). Ver
  // js/renderizadores.js::COPA_STATS/calcularCopaStatsCombinado/
  // renderizarCopaStatDetalle.
  function _copaStatKey(categoria) {
    return "ef7_copa_stat_" + categoria + "_v1";
  }
  function obtenerCopaStatTexto(categoria) {
    try {
      return localStorage.getItem(_copaStatKey(categoria)) || "";
    } catch (err) {
      return "";
    }
  }
  function guardarCopaStatTexto(categoria, texto) {
    try {
      localStorage.setItem(_copaStatKey(categoria), texto || "");
      return true;
    } catch (err) {
      console.error("[estado] no se pudo guardar la estadística " + categoria + " de Copa del Rey:", err);
      return false;
    }
  }

  // ---------- Alias eFootball — "qué equipo real elegir en el juego" ----------
  // eFootball no tiene licencia de la inmensa mayoría de clubes que esta
  // app simula — el admin ha comparado, equipo a equipo, nivel/escudo/
  // uniforme y ha decidido a qué club REAL con licencia en el juego se
  // parece cada uno (ej. "CE Europa" -> "Asia y Oceanía - 2ª Japón -
  // Blaublitz Akita"). Va a hacer falta para MUCHOS equipos (cualquier
  // rival IA o sintético del Calendario extra, potencialmente cientos),
  // así que es UN solo mapa {nombreNormalizado -> texto} en vez de un
  // campo aparte por cada catálogo — se añade sobre la marcha, según el
  // admin vaya encontrando equipos sin alias en la PREVIA (ver
  // js/renderizadores.js::abrirPreviaPartido / _previaAliasHTML).
  // La clave es el nombre del equipo YA NORMALIZADO (Renderizadores._normNombre
  // — minúsculas, sin tildes) para que sobreviva a que el mismo rival se
  // resuelva desde catálogos IA distintos o desde un id sintético que
  // cambia de sesión a sesión; nunca se guarda por id.
  var ALIAS_EFOOTBALL_KEY = "ef7_alias_efootball_v1";
  function _obtenerAliasEfootballMapa() {
    try {
      var raw = localStorage.getItem(ALIAS_EFOOTBALL_KEY);
      var mapa = raw ? JSON.parse(raw) : null;
      return mapa && typeof mapa === "object" ? mapa : {};
    } catch (err) {
      return {};
    }
  }
  function obtenerAliasEfootball(clave) {
    if (!clave) return "";
    return _obtenerAliasEfootballMapa()[clave] || "";
  }
  function guardarAliasEfootball(clave, texto) {
    if (!clave) return false;
    try {
      var mapa = _obtenerAliasEfootballMapa();
      var limpio = String(texto || "").trim();
      if (limpio) mapa[clave] = limpio;
      else delete mapa[clave];
      localStorage.setItem(ALIAS_EFOOTBALL_KEY, JSON.stringify(mapa));
      return true;
    } catch (err) {
      console.error("[estado] no se pudo guardar el alias eFootball de \"" + clave + "\":", err);
      return false;
    }
  }

  // Migración de UN SOLO USO (candado ef7_alias_fabrica_migracion_v1):
  // estos 16 equipos de data/rivales_reales.json acaban de recibir un
  // alias PERMANENTE "de fábrica" (ver js/renderizadores.js::_aliasEfootballDefault,
  // que ahora cae en ese valor cuando este dispositivo no tiene su
  // propio override). El problema: un override viejo de ESTE dispositivo
  // (de una prueba/edición anterior a que existiera el valor de fábrica —
  // a veces con texto de OTRO equipo pegado por error) SIEMPRE gana sobre
  // el valor de fábrica, así que se quedaría mostrando ese dato viejo
  // para siempre sin que el admin sepa por qué. Se BORRA (nunca se
  // reescribe con texto fijo aquí — la fuente sigue siendo SOLO
  // data/rivales_reales.json) el override de estos 16, UNA vez por
  // dispositivo, para que el valor de fábrica correcto pueda mostrarse.
  // Si el admin edita alguno de ellos DESPUÉS de esta migración, su
  // edición es respetada con normalidad (esto no vuelve a correr).
  var ALIAS_FABRICA_MIGRACION_KEY = "ef7_alias_fabrica_migracion_v1";
  var ALIAS_FABRICA_CLAVES_V1 = [
    "antequera cf", "villarreal b", "ce europa", "fc cartagena",
    "ponferradina", "ad merida", "algeciras cf", "atletico madrileno",
    "cd lugo", "rm castilla", "real murcia", "unionistas cf",
    "pontevedra", "barakaldo", "hercules", "zamora cf"
  ];
  function _migrarAliasFabricaV1() {
    try {
      if (localStorage.getItem(ALIAS_FABRICA_MIGRACION_KEY)) return;
      var mapa = _obtenerAliasEfootballMapa();
      var cambio = false;
      ALIAS_FABRICA_CLAVES_V1.forEach(function (clave) {
        if (mapa.hasOwnProperty(clave)) { delete mapa[clave]; cambio = true; }
      });
      if (cambio) localStorage.setItem(ALIAS_EFOOTBALL_KEY, JSON.stringify(mapa));
      localStorage.setItem(ALIAS_FABRICA_MIGRACION_KEY, "1");
    } catch (err) {
      console.error("[estado] no se pudo migrar el alias de fábrica:", err);
    }
  }
  _migrarAliasFabricaV1();

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
  // Espacio REAL usado por la app en el navegador — suma TODAS las claves
  // "ef7_*" (resultados, calendario/menú/plantilla/roster/lesionados de
  // cada club, Liga 1ª REF y extras, balones/estadios editados, alias
  // eFootball...), no solo STORAGE_KEY. Antes "💾 Espacio del navegador"
  // solo medía STORAGE_KEY (resultados/partidosGenerados) — un objeto casi
  // vacío en cuanto no hay muchos partidos jugados, así que SIEMPRE
  // mostraba algo como "0.05 KB" pese a que el resto de datos de la app
  // (edición del admin, calendarios, plantillas...) ocupan bastante más.
  // No era una ilusión — el número era real para esa clave concreta —
  // pero no representaba el uso total del sitio, que es lo que el admin
  // quiere ver aquí.
  function calcularEspacioTotal() {
    var claves = _clavesDeLaApp();
    var bytes = 0;
    claves.forEach(function (k) {
      try {
        var v = localStorage.getItem(k) || "";
        bytes += new Blob([k]).size + new Blob([v]).size;
      } catch (err) { /* clave ilegible, se ignora */ }
    });
    return { bytes: bytes, nClaves: claves.length };
  }

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
    invalidarCache: invalidarCache,
    guardarEstado: guardarEstado,
    registrarResultadoPartido: registrarResultadoPartido,
    obtenerResultadoOverride: obtenerResultadoOverride,
    reiniciarResultadoPartido: reiniciarResultadoPartido,
    registrarPartidoGenerado: registrarPartidoGenerado,
    listarPartidosResueltos: listarPartidosResueltos,
    calcularClasificacion: calcularClasificacion,
    exportarEstadoCrudo: exportarEstadoCrudo,
    importarEstadoCrudo: importarEstadoCrudo,
    borrarTodo: borrarTodo,
    calcularEspacioTotal: calcularEspacioTotal,
    obtenerTemporada: obtenerTemporada,
    guardarTemporada: guardarTemporada,
    obtenerNombreLiga: obtenerNombreLiga,
    guardarNombreLiga: guardarNombreLiga,
    obtenerDivisionClub: obtenerDivisionClub,
    guardarDivisionClub: guardarDivisionClub,
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
    reiniciarCalendarioExtraJugados: reiniciarCalendarioExtraJugados,
    obtenerTitulosTexto: obtenerTitulosTexto,
    guardarTitulosTexto: guardarTitulosTexto,
    obtenerListaJugadores: obtenerListaJugadores,
    obtenerListaJugadoresActivosPara: obtenerListaJugadoresActivosPara,
    obtenerNombresListaActiva: obtenerNombresListaActiva,
    agregarJugadorALista: agregarJugadorALista,
    quitarJugadorDeLista: quitarJugadorDeLista,
    obtenerTarjetaFlags: obtenerTarjetaFlags,
    limpiarTarjetaFlag: limpiarTarjetaFlag,
    obtenerObjetivosTexto: obtenerObjetivosTexto,
    guardarObjetivosTexto: guardarObjetivosTexto,
    obtenerObjetivosLogrados: obtenerObjetivosLogrados,
    toggleObjetivoLogrado: toggleObjetivoLogrado,
    obtenerValoracionClub: obtenerValoracionClub,
    guardarValoracionClub: guardarValoracionClub,
    obtenerObjetivosIconos: obtenerObjetivosIconos,
    guardarObjetivosIconoSeccion: guardarObjetivosIconoSeccion,
    obtenerDerbysTexto: obtenerDerbysTexto,
    guardarDerbysTexto: guardarDerbysTexto,
    obtenerRosterTexto: obtenerRosterTexto,
    guardarRosterTexto: guardarRosterTexto,
    obtenerLiga1RefTexto: obtenerLiga1RefTexto,
    guardarLiga1RefTexto: guardarLiga1RefTexto,
    obtenerLiga1RefStatTexto: obtenerLiga1RefStatTexto,
    guardarLiga1RefStatTexto: guardarLiga1RefStatTexto,
    obtenerLigaExtraTexto: obtenerLigaExtraTexto,
    guardarLigaExtraTexto: guardarLigaExtraTexto,
    obtenerFormatoOverride: obtenerFormatoOverride,
    guardarFormatoOverride: guardarFormatoOverride,
    obtenerLigaExtraStatTexto: obtenerLigaExtraStatTexto,
    guardarLigaExtraStatTexto: guardarLigaExtraStatTexto,
    obtenerCopaStatTexto: obtenerCopaStatTexto,
    guardarCopaStatTexto: guardarCopaStatTexto,
    obtenerAliasEfootball: obtenerAliasEfootball,
    guardarAliasEfootball: guardarAliasEfootball,
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
