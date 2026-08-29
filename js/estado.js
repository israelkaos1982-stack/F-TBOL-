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

  // Wipe total — Panel Admin, "🗑️ Borrar TODO". Vuelve al estado de
  // fábrica (data/*.json sin ninguna capa local encima). El propio
  // caller (js/main.js) pide confirmación explícita antes de llamar.
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
  function exportarEstadoCrudo() {
    return JSON.parse(JSON.stringify(cargarEstado()));
  }
  function importarEstadoCrudo(obj) {
    if (!obj || typeof obj !== "object") throw new Error("Copia de seguridad inválida");
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
    registrarPartidoGenerado: registrarPartidoGenerado,
    listarPartidosResueltos: listarPartidosResueltos,
    calcularClasificacion: calcularClasificacion,
    calcularEstadisticasJugador: calcularEstadisticasJugador,
    exportarEstadoCrudo: exportarEstadoCrudo,
    importarEstadoCrudo: importarEstadoCrudo,
    borrarTodo: borrarTodo,
    obtenerTemporada: obtenerTemporada,
    guardarTemporada: guardarTemporada,
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
