/* ============================================================
   renderizadores.js — Fase 2: motores de estadio, clima y calendario
   Todo corre en memoria activa (fetch de los JSON una sola vez,
   cacheados en variables de módulo) — 0 KB extra en Render.
   ============================================================ */
(function () {
  "use strict";

  var DATA_URLS = {
    equipos: "data/equipos.json",
    equiposIA: "data/equipos_ia.json",
    estadios: "data/estadios.json",
    balones: "data/balones.json",
    partidos: "data/partidos.json"
  };

  var TOTAL_JORNADAS_POR_LIGA = {
    LIGA_1RFEF: 15,
    LIGA_HYPERMOTION: 17,
    LIGA_EA_SPORTS: 38
  };

  var CLIMA_ICONO = { sol: "☀️", lluvia: "🌧️", nieve: "❄️" };
  var CLIMA_LABEL = { sol: "Sol", lluvia: "Lluvia", nieve: "Nieve" };

  // ---------- Carga de datos (fetch una sola vez, caché en memoria) ----------
  var _cacheFetch = {};
  function cargarJSON(ruta) {
    if (!_cacheFetch[ruta]) {
      _cacheFetch[ruta] = fetch(ruta).then(function (r) {
        if (!r.ok) throw new Error("No se pudo cargar " + ruta + " (" + r.status + ")");
        return r.json();
      });
    }
    return _cacheFetch[ruta];
  }

  var _estadiosLista = null; // caché síncrona para obtenerEstadioCorrelativoAjustado

  function cargarTodo() {
    return Promise.all([
      cargarJSON(DATA_URLS.equipos),
      cargarJSON(DATA_URLS.equiposIA),
      cargarJSON(DATA_URLS.estadios),
      cargarJSON(DATA_URLS.balones),
      cargarJSON(DATA_URLS.partidos)
    ]).then(function (r) {
      var datos = { equipos: r[0], equiposIA: r[1], estadios: r[2], balones: r[3], partidos: r[4] };
      _estadiosLista = datos.estadios.estadios || [];
      return datos;
    });
  }

  // Precarga en cuanto el script se evalúa — para cuando el usuario haga
  // el primer click ya suele estar resuelto (JSON locales, muy ligeros).
  cargarTodo().catch(function (err) {
    console.error("[renderizadores] fallo en la precarga de datos:", err);
  });

  // ============================================================
  // 1. ALGORITMO DE NORMALIZACIÓN DE ESTADIOS
  // ============================================================
  var PODER_MIN = 50;
  var PODER_MAX = 98;

  function obtenerEstadioCorrelativoAjustado(valoracionPoder) {
    if (!_estadiosLista || !_estadiosLista.length) return null;

    var poder = Number(valoracionPoder);
    if (isNaN(poder)) poder = PODER_MIN;
    // Controles por si el poder baja de 50 o sube de 98 — clamp a los límites.
    if (poder < PODER_MIN) poder = PODER_MIN;
    if (poder > PODER_MAX) poder = PODER_MAX;

    var n = _estadiosLista.length; // 30
    var idx = Math.round((poder - PODER_MIN) / (PODER_MAX - PODER_MIN) * (n - 1));
    if (idx < 0) idx = 0;
    if (idx > n - 1) idx = n - 1;

    return _estadiosLista[idx];
  }

  // ============================================================
  // 2. MOTOR CLIMATOLÓGICO ESTACIONAL
  // ============================================================
  function calcularClimaDinamicoPartido(jornadaActual, totalJornadasLiga) {
    var total = Number(totalJornadasLiga) || 1;
    var jornada = Number(jornadaActual) || 0;
    var progreso = jornada / total; // 0..1

    var estacion, clima;
    var roll = Math.random();

    if (progreso <= 0.33) {
      estacion = "VERANO";
      clima = roll < 0.85 ? "sol" : "lluvia"; // nieve prohibida
    } else if (progreso <= 0.75) {
      estacion = "INVIERNO";
      if (roll < 0.40) clima = "nieve";
      else if (roll < 0.80) clima = "lluvia";
      else clima = "sol";
    } else {
      estacion = "VERANO";
      clima = roll < 0.90 ? "sol" : "lluvia";
    }

    return {
      estacion: estacion,
      clima: clima,
      icono: CLIMA_ICONO[clima],
      label: CLIMA_LABEL[clima]
    };
  }

  // Envoltorio: resuelve jornadaActual/totalJornadasLiga a partir de un
  // partido real (liga -> su propia jornada; torneos KO sin jornada ->
  // posición proporcional dentro de la temporada por fecha).
  function calcularClimaParaPartido(partido, totalJornadasLiga, fechaInicioMs, fechaFinMs) {
    if (partido.competicion === "liga" && typeof partido.jornada === "number") {
      return calcularClimaDinamicoPartido(partido.jornada, totalJornadasLiga);
    }
    var fechaMs = new Date(partido.fecha).getTime();
    var rango = Math.max(1, fechaFinMs - fechaInicioMs);
    var ratio = Math.min(1, Math.max(0, (fechaMs - fechaInicioMs) / rango));
    return calcularClimaDinamicoPartido(Math.round(ratio * 1000), 1000);
  }

  // Regla especial de balones: nieve -> fuerza el balón de alta visibilidad,
  // sea cual sea la competición.
  var BALON_NIEVE_ID = "efootball-max-vis-27";

  function resolverBalonPartido(compKey, climaResultado, balonesData) {
    var catalogo = {};
    (balonesData.balones || []).forEach(function (b) { catalogo[b.id] = b.nombre; });

    if (climaResultado && climaResultado.clima === "nieve") {
      return {
        id: BALON_NIEVE_ID,
        nombre: catalogo[BALON_NIEVE_ID] || "eFootball™ MAX VIS 27",
        forzadoPorNieve: true
      };
    }

    var asign = (balonesData.asignacionPorCompeticion || {})[compKey];
    if (!asign) return { id: null, nombre: "Balón oficial", forzadoPorNieve: false };
    return { id: asign.balonId, nombre: catalogo[asign.balonId] || asign.balonId, forzadoPorNieve: false };
  }

  // ============================================================
  // Helpers de equipo / escudo / fecha
  // ============================================================
  function buscarEquipoPorId(id, datos) {
    var humano = (datos.equipos.equipos || []).find(function (e) { return e.id === id; });
    if (humano) return humano;
    var bloques = datos.equiposIA.bloques || {};
    for (var key in bloques) {
      if (!bloques.hasOwnProperty(key)) continue;
      var found = (bloques[key].equipos || []).find(function (e) { return e.id === id; });
      if (found) return found;
    }
    return null;
  }

  function crearEscudoHTML(equipo, claseTamano) {
    if (!equipo) return '<div class="escudo ' + claseTamano + '"><span class="escudo-siglas">?</span></div>';
    var formato = equipo.escudoFormato === "rombo" ? "escudo--rombo" : "escudo--rayas";
    var style = "--primary:" + (equipo.colorPrimario || "#39ff6a") + "; --secondary:" + (equipo.colorSecundario || "#101114") + ";";
    return (
      '<div class="escudo ' + formato + " " + claseTamano + '" style="' + style + '">' +
      '<span class="escudo-siglas">' + (equipo.siglas || "") + "</span>" +
      "</div>"
    );
  }

  var MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  function formatFecha(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.getUTCDate() + " " + MESES[d.getUTCMonth()] + " " + d.getUTCFullYear();
  }

  var COMP_LABEL = {
    liga: "Liga", copa: "Copa del Rey", supercopa: "Supercopa de España",
    champions: "Champions League", uel: "Europa League", uecl: "Conference League",
    recopa: "Recopa de Europa", usc: "Supercopa de Europa"
  };

  // ============================================================
  // 3. CALENDARIO LATERAL DERECHO
  // ============================================================
  var _ultimoContexto = null; // { datos, equipo, totalJornadas, partidosPorId }

  function nodoEstado(icono, texto) {
    var div = document.createElement("div");
    div.className = "calendar-empty";
    div.innerHTML = '<span class="calendar-empty-icon">' + icono + "</span>" + texto;
    return div;
  }

  function construirTarjetaPartido(partido, idActivo, datos, totalJornadasLiga) {
    var esLocal = partido.local === idActivo;
    var rivalId = esLocal ? partido.visitante : partido.local;
    var rival = buscarEquipoPorId(rivalId, datos);
    var activo = buscarEquipoPorId(idActivo, datos);

    var local = esLocal ? activo : rival;
    var visitante = esLocal ? rival : activo;

    var card = document.createElement("div");
    card.className = "match-card" + (partido.jugado ? " is-played" : "");
    card.dataset.partidoId = partido.id;

    var compLabel = COMP_LABEL[partido.competicion] || partido.competicion;
    var etiquetaRonda = partido.ronda ? " · " + partido.ronda : (partido.jornada ? " · J" + partido.jornada : "");

    var marcador = "VS";
    if (partido.jugado && partido.resultado) {
      marcador = partido.resultado.golesLocal + " - " + partido.resultado.golesVisitante;
    }

    card.innerHTML =
      '<div class="match-card-comp">' + compLabel + etiquetaRonda + "</div>" +
      '<div class="match-card-teams">' +
      crearEscudoHTML(local, "escudo--sm") +
      '<span class="match-card-vs">' + marcador + "</span>" +
      crearEscudoHTML(visitante, "escudo--sm") +
      "</div>" +
      '<div class="match-card-date">🗓️ ' + formatFecha(partido.fecha) + "</div>" +
      '<button type="button" class="match-card-btn" data-partido-id="' + partido.id + '">👁 Previa</button>';

    return card;
  }

  function generarCalendarioLateralDerecho(idEquipoHumanoActivo) {
    var contenedor = document.getElementById("calendar-content");
    var badge = document.getElementById("calendar-liga-badge");
    if (!contenedor) return;

    // Destruye datos cruzados del mánager anterior antes de redibujar.
    contenedor.innerHTML = "";
    contenedor.appendChild(nodoEstado("⏳", "Cargando calendario…"));

    cargarTodo()
      .then(function (datos) {
        var equipo = buscarEquipoPorId(idEquipoHumanoActivo, datos);
        contenedor.innerHTML = "";

        if (!equipo) {
          contenedor.appendChild(nodoEstado("⚠️", "No se encontró el equipo seleccionado."));
          return;
        }

        var ligaActual = equipo.ligaActual;
        var totalJornadas = TOTAL_JORNADAS_POR_LIGA[ligaActual] || 38;

        if (badge) badge.textContent = (ligaActual || "").replace(/_/g, " ");

        var partidosDelClub = (datos.partidos.partidos || []).filter(function (p) {
          var esSuyo = p.local === idEquipoHumanoActivo || p.visitante === idEquipoHumanoActivo;
          if (!esSuyo) return false;
          // Liga regular: solo la liga actual del mánager.
          // Torneos eliminatorios (Copa, Supercopa...): siempre, en paralelo.
          if (p.competicion === "liga") return p.liga === ligaActual;
          return true;
        });

        if (!partidosDelClub.length) {
          contenedor.appendChild(nodoEstado("🗓️", "Este equipo todavía no tiene partidos programados."));
          return;
        }

        partidosDelClub.sort(function (a, b) { return new Date(a.fecha) - new Date(b.fecha); });

        var partidosPorId = {};
        partidosDelClub.forEach(function (p) { partidosPorId[p.id] = p; });

        _ultimoContexto = { datos: datos, equipo: equipo, totalJornadas: totalJornadas, partidosPorId: partidosPorId };

        var frag = document.createDocumentFragment();
        partidosDelClub.forEach(function (p) {
          frag.appendChild(construirTarjetaPartido(p, idEquipoHumanoActivo, datos, totalJornadas));
        });
        contenedor.appendChild(frag);
      })
      .catch(function (err) {
        contenedor.innerHTML = "";
        contenedor.appendChild(nodoEstado("⚠️", "No se pudo cargar el calendario."));
        console.error("[renderizadores] generarCalendarioLateralDerecho:", err);
      });
  }

  // ============================================================
  // PANTALLA DE PREVIA — estadio + clima + balón calculados en vivo
  // ============================================================
  function abrirPreviaPartido(partidoId) {
    if (!_ultimoContexto) return;
    var partido = _ultimoContexto.partidosPorId[partidoId];
    if (!partido) return;

    var datos = _ultimoContexto.datos;
    var local = buscarEquipoPorId(partido.local, datos);
    var visitante = buscarEquipoPorId(partido.visitante, datos);
    if (!local || !visitante) return;

    var totalJornadas = partido.competicion === "liga"
      ? (TOTAL_JORNADAS_POR_LIGA[partido.liga] || 38)
      : (TOTAL_JORNADAS_POR_LIGA.LIGA_EA_SPORTS);

    var meta = datos.partidos._meta.temporada || {};
    var inicioMs = meta.inicio ? new Date(meta.inicio).getTime() : new Date(partido.fecha).getTime();
    var finMs = meta.finLiga ? new Date(meta.finLiga).getTime() : inicioMs + 1;

    var clima = calcularClimaParaPartido(partido, totalJornadas, inicioMs, finMs);
    var balon = resolverBalonPartido(partido.competicion, clima, datos.balones);
    var estadio = obtenerEstadioCorrelativoAjustado(local.valoracionPoder);

    var ov = document.getElementById("previa-overlay");
    if (!ov) return;

    document.getElementById("previa-team-local").innerHTML =
      crearEscudoHTML(local, "escudo--lg") + '<span class="previa-team-nombre">' + local.nombre + "</span>";
    document.getElementById("previa-team-visitante").innerHTML =
      crearEscudoHTML(visitante, "escudo--lg") + '<span class="previa-team-nombre">' + visitante.nombre + "</span>";

    document.getElementById("previa-marcador").textContent =
      partido.jugado ? (partido.resultado.golesLocal + " - " + partido.resultado.golesVisitante) : "VS";

    document.getElementById("previa-comp").textContent =
      (COMP_LABEL[partido.competicion] || partido.competicion) +
      (partido.ronda ? " · " + partido.ronda : (partido.jornada ? " · Jornada " + partido.jornada : ""));

    document.getElementById("previa-fecha").textContent = formatFecha(partido.fecha);

    document.getElementById("previa-estadio").textContent = estadio
      ? estadio.nombre + " — " + estadio.capacidad.toLocaleString("es-ES") + " esp. — " + estadio.categoria
      : "Estadio no disponible";

    document.getElementById("previa-clima").textContent =
      clima.estacion + " · " + clima.icono + " " + clima.label;

    document.getElementById("previa-balon").innerHTML =
      balon.nombre + (balon.forzadoPorNieve ? ' <span class="previa-balon-forzado">❄️ forzado por nieve</span>' : "");

    ov.hidden = false;
  }

  function cerrarPreviaPartido() {
    var ov = document.getElementById("previa-overlay");
    if (ov) ov.hidden = true;
  }

  // ---------- Delegación de eventos ----------
  document.addEventListener("click", function (ev) {
    var btn = ev.target.closest && ev.target.closest(".match-card-btn");
    if (btn) { abrirPreviaPartido(btn.dataset.partidoId); return; }

    if (ev.target.id === "previa-close" || ev.target.id === "previa-overlay") {
      cerrarPreviaPartido();
    }
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") cerrarPreviaPartido();
  });

  // ---------- API pública ----------
  window.Renderizadores = {
    obtenerEstadioCorrelativoAjustado: obtenerEstadioCorrelativoAjustado,
    calcularClimaDinamicoPartido: calcularClimaDinamicoPartido,
    generarCalendarioLateralDerecho: generarCalendarioLateralDerecho,
    abrirPreviaPartido: abrirPreviaPartido,
    cerrarPreviaPartido: cerrarPreviaPartido,
    cargarTodo: cargarTodo,
    buscarEquipoPorId: buscarEquipoPorId
  };
})();
