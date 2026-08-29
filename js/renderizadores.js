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
    partidos: "data/partidos.json",
    jugadores: "data/jugadores.json"
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
      cargarJSON(DATA_URLS.partidos),
      cargarJSON(DATA_URLS.jugadores)
    ]).then(function (r) {
      // r[2]/r[3] son las respuestas CACHEADAS de cargarJSON (misma
      // referencia en cada llamada a cargarTodo) — NUNCA se mutan
      // directamente, se copian antes de fusionar el overlay de
      // balones/estadios (js/estado.js), o el overlay se aplicaría
      // dos veces (duplicando los "añadidos") en la siguiente llamada.
      var estadiosBase = r[2].estadios || [];
      var balonesBase = r[3].balones || [];
      var estadiosFusion = (window.Estado && window.Estado.fusionarEstadios)
        ? window.Estado.fusionarEstadios(estadiosBase) : estadiosBase;
      var balonesFusion = (window.Estado && window.Estado.fusionarBalones)
        ? window.Estado.fusionarBalones(balonesBase) : balonesBase;

      var datos = {
        equipos: r[0],
        equiposIA: r[1],
        estadios: Object.assign({}, r[2], { estadios: estadiosFusion }),
        balones: Object.assign({}, r[3], { balones: balonesFusion }),
        partidos: r[4],
        jugadores: r[5]
      };
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

  // Escudo de CUALQUIER equipo (humano o IA), listo para Inicio/calendario/
  // previa/acta en vivo. Si el equipo trae `crest` (URL real — 5 de los 6
  // humanos reusan los SVG que ya sirve la app Flask hermana en
  // /static/img/escudos-*/, cero KB nuevos), se pinta la imagen real sobre
  // un fondo claro para que se lea con contraste. Sin `crest` (PSG, y los
  // 300+ equipos IA) cae al blasón CSS de siempre — nunca se rompe nada
  // para un equipo sin imagen todavía.
  function crearEscudoHTML(equipo, claseTamano) {
    if (!equipo) return '<div class="escudo escudo--ia ' + claseTamano + '"></div>';

    if (equipo.crest) {
      return (
        '<div class="escudo escudo--real ' + claseTamano + '">' +
        '<img src="' + equipo.crest + '" alt="' + (equipo.nombre || "") + '" loading="lazy">' +
        "</div>"
      );
    }

    var esHumano = !!equipo.mister;
    var formato = equipo.escudoFormato === "rombo" ? "escudo--rombo" : "escudo--rayas";
    var style = "--primary:" + (equipo.colorPrimario || "#39ff6a") + "; --secondary:" + (equipo.colorSecundario || "#101114") + ";";

    if (esHumano) {
      return (
        '<div class="escudo ' + formato + " " + claseTamano + '" style="' + style + '">' +
        '<span class="escudo-siglas">' + (equipo.siglas || "") + "</span>" +
        "</div>"
      );
    }

    return '<div class="escudo escudo--ia ' + formato + " " + claseTamano + '" style="' + style + '"></div>';
  }

  // ============================================================
  // PANTALLA DE INICIO — las 6 cajas humanas (fuente única: data/equipos.json)
  // ============================================================
  // Se renderizan en JS (no hardcodeadas en index.html) para que el escudo
  // real, el mánager, su selección y su emoji salgan SIEMPRE del mismo
  // sitio que usa el resto de la app (calendario, previa, club activo) —
  // cero riesgo de que el Inicio se desincronice de esos datos.
  function renderizarInicioEquipos() {
    var grid = document.getElementById("team-select-grid");
    if (!grid) return;

    cargarTodo().then(function (datos) {
      var frag = document.createDocumentFragment();
      (datos.equipos.equipos || []).forEach(function (eq) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "team-box";
        btn.dataset.teamId = eq.id;
        btn.style.setProperty("--primary", eq.colorPrimario || "#39ff6a");
        btn.style.setProperty("--secondary", eq.colorSecundario || "#101114");

        var ghost = eq.crest
          ? '<img class="team-box-crest-ghost" src="' + eq.crest + '" alt="" aria-hidden="true">'
          : "";
        var misterLinea = [eq.misterEmoji, eq.mister, eq.banderaSeleccion].filter(Boolean).join(" ");

        btn.innerHTML =
          ghost +
          '<div class="team-box-inner">' +
          crearEscudoHTML(eq, "escudo--lg") +
          '<div class="team-box-meta">' +
          '<span class="team-box-club">' + eq.nombre + "</span>" +
          '<span class="team-box-mister">' + misterLinea + "</span>" +
          "</div>" +
          "</div>";

        frag.appendChild(btn);
      });
      grid.innerHTML = "";
      grid.appendChild(frag);
    }).catch(function (err) {
      grid.innerHTML = "";
      grid.appendChild(nodoEstado("⚠️", "No se pudieron cargar los equipos."));
      console.error("[renderizadores] renderizarInicioEquipos:", err);
    });
  }

  // "Temporada N" editable — pinta el valor guardado (o el de fábrica) en
  // el header del Inicio.
  function pintarTemporada() {
    var label = document.getElementById("brand-sub-label");
    if (label && window.Estado) label.textContent = window.Estado.obtenerTemporada();
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

  // Escapa texto ESCRITO POR EL ADMIN (nombre de estadio/balón/jugador vía
  // prompt()) antes de interpolarlo en innerHTML — evita que un nombre con
  // "<"/">" rompa el markup o inyecte HTML.
  var _escapeMap = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function escapeHTML(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) { return _escapeMap[c]; });
  }

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

    // Recuerda qué mánager está activo — lo usan js/acta.js y
    // js/sistema-temporadas.js para re-pintar tras confirmar un partido.
    window._idManagerActivo = idEquipoHumanoActivo;

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

        // Vista fusionada: partidos base + confirmados/generados en
        // caliente (Estado) — así un partido recién jugado se pinta gris
        // al instante, sin recargar la página.
        var todosLosPartidos = window.Estado
          ? window.Estado.listarPartidosResueltos(datos)
          : (datos.partidos.partidos || []);

        var partidosDelClub = todosLosPartidos.filter(function (p) {
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

        // Scroll inteligente: deja el visor centrado en el primer partido
        // SIN jugar (el "actual"), en vez de arrancar siempre desde J1.
        // Deferido un frame para que el layout ya esté asentado.
        requestAnimationFrame(function () {
          var actual = contenedor.querySelector(".match-card:not(.is-played)");
          if (actual) actual.scrollIntoView({ block: "center" });
        });
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

    var btnEmpezar = document.getElementById("previa-empezar");
    if (btnEmpezar) {
      btnEmpezar.hidden = !!partido.jugado;
      btnEmpezar.dataset.partidoId = partido.id;
    }

    ov.hidden = false;
  }

  function cerrarPreviaPartido() {
    var ov = document.getElementById("previa-overlay");
    if (ov) ov.hidden = true;
  }

  // ============================================================
  // 4. PANTALLA DE CLUB — PLANTILLA (roster agrupado por posición)
  // ============================================================
  var ORDEN_POSICIONES = ["POR", "DEF", "MED", "DEL"];
  var LABEL_POSICION = { POR: "Porteros", DEF: "Defensas", MED: "Centrocampistas", DEL: "Delanteros" };

  function renderizarPlantillaClub(idEquipoHumanoActivo) {
    var contenedor = document.getElementById("plantilla-content");
    if (!contenedor) return;

    contenedor.innerHTML = "";
    contenedor.appendChild(nodoEstado("⏳", "Cargando plantilla…"));

    cargarTodo()
      .then(function (datos) {
        contenedor.innerHTML = "";
        var jugadores = (datos.jugadores.jugadores || []).filter(function (j) {
          return j.equipoId === idEquipoHumanoActivo;
        });

        if (!jugadores.length) {
          contenedor.appendChild(nodoEstado("👕", "Todavía no hay jugadores cargados para este club."));
          return;
        }

        var frag = document.createDocumentFragment();
        ORDEN_POSICIONES.forEach(function (pos) {
          var deEstaPos = jugadores
            .filter(function (j) { return j.posicion === pos; })
            .sort(function (a, b) { return a.dorsal - b.dorsal; });
          if (!deEstaPos.length) return;

          var grupo = document.createElement("div");
          grupo.className = "plantilla-grupo";

          var titulo = document.createElement("div");
          titulo.className = "plantilla-grupo-titulo";
          titulo.textContent = (LABEL_POSICION[pos] || pos) + " · " + deEstaPos.length;
          grupo.appendChild(titulo);

          deEstaPos.forEach(function (j) {
            var tieneNombre = !!(j.nombre && j.nombre.trim());
            var fila = document.createElement("div");
            fila.className = "plantilla-jugador";
            fila.innerHTML =
              '<span class="plantilla-dorsal">' + j.dorsal + "</span>" +
              '<span class="plantilla-nombre' + (tieneNombre ? "" : " plantilla-nombre--vacio") + '">' +
              (tieneNombre ? escapeHTML(j.nombre) : "— sin asignar —") + "</span>" +
              '<span class="plantilla-posicion">' + j.posicion + "</span>";
            grupo.appendChild(fila);
          });

          frag.appendChild(grupo);
        });

        contenedor.appendChild(frag);
      })
      .catch(function (err) {
        contenedor.innerHTML = "";
        contenedor.appendChild(nodoEstado("⚠️", "No se pudo cargar la plantilla."));
        console.error("[renderizadores] renderizarPlantillaClub:", err);
      });
  }

  // Placeholder plano para los botones del menú del club que todavía no
  // existen como subsistema real en este simulador ligero (Títulos,
  // Derbys, Objetivos, Liga 1ªREF, Copa del Rey, Superliga pertenecen a
  // OTRA app mucho más grande — no se inventan datos falsos aquí).
  function renderizarProximamente(contenedorId, etiqueta) {
    var contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;
    contenedor.innerHTML =
      '<div class="club-modal-proximamente">🚧 ' + etiqueta + " todavía no está disponible en esta versión ligera.<br>" +
      "Se irá añadiendo en próximas fases.</div>";
  }

  // ============================================================
  // 5. PANEL ADMIN — Calendar / Stadium Hub / Ball Storage / Espacio
  // ============================================================

  // "Calendar" del Panel Admin: TODOS los partidos de la temporada, de
  // TODAS las competiciones y los 6 clubes juntos, de solo lectura — a
  // diferencia del calendario de cada club (que filtra por su equipo),
  // esto es para que el admin repase la temporada entera de un vistazo.
  // Agrupado por FECHA (con cabecera propia) — un dump plano de 380+
  // partidos sin agrupar era ilegible.
  function renderizarAdminCalendario(contenedorId) {
    var contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;
    contenedor.innerHTML = "";
    contenedor.appendChild(nodoEstado("⏳", "Cargando calendario completo…"));

    cargarTodo()
      .then(function (datos) {
        contenedor.innerHTML = "";
        var todos = window.Estado ? window.Estado.listarPartidosResueltos(datos) : (datos.partidos.partidos || []);
        todos = todos.slice().sort(function (a, b) { return new Date(a.fecha) - new Date(b.fecha); });

        if (!todos.length) {
          contenedor.appendChild(nodoEstado("🗓️", "No hay partidos programados."));
          return;
        }

        // Agrupa por el día (ignora la hora) preservando el orden cronológico.
        var grupos = [];
        var indicePorDia = {};
        todos.forEach(function (p) {
          var dia = (p.fecha || "").slice(0, 10);
          if (!indicePorDia.hasOwnProperty(dia)) {
            indicePorDia[dia] = grupos.length;
            grupos.push({ dia: dia, partidos: [] });
          }
          grupos[indicePorDia[dia]].partidos.push(p);
        });

        var frag = document.createDocumentFragment();
        grupos.forEach(function (g) {
          var jugados = g.partidos.filter(function (p) { return p.jugado; }).length;
          var cab = document.createElement("div");
          cab.className = "admin-calendario-fecha";
          cab.innerHTML =
            '<span class="admin-calendario-fecha-dia">🗓️ ' + formatFecha(g.partidos[0].fecha) + "</span>" +
            '<span class="admin-calendario-fecha-cont">' + jugados + "/" + g.partidos.length + " jugados</span>";
          frag.appendChild(cab);

          var fila = document.createElement("div");
          fila.className = "admin-calendario-fecha-partidos";
          g.partidos.forEach(function (p) {
            var local = buscarEquipoPorId(p.local, datos);
            var visitante = buscarEquipoPorId(p.visitante, datos);
            if (!local || !visitante) return;

            var card = document.createElement("div");
            card.className = "match-card" + (p.jugado ? " is-played" : "");

            var compLabel = COMP_LABEL[p.competicion] || p.competicion;
            var etiquetaRonda = p.ronda ? " · " + p.ronda : (p.jornada ? " · J" + p.jornada : "");
            var marcador = p.jugado && p.resultado ? (p.resultado.golesLocal + " - " + p.resultado.golesVisitante) : "VS";

            card.innerHTML =
              '<div class="match-card-comp">' + compLabel + etiquetaRonda + "</div>" +
              '<div class="match-card-teams">' +
              crearEscudoHTML(local, "escudo--sm") +
              '<span class="match-card-vs">' + marcador + "</span>" +
              crearEscudoHTML(visitante, "escudo--sm") +
              "</div>";
            fila.appendChild(card);
          });
          frag.appendChild(fila);
        });
        contenedor.appendChild(frag);
      })
      .catch(function (err) {
        contenedor.innerHTML = "";
        contenedor.appendChild(nodoEstado("⚠️", "No se pudo cargar el calendario."));
        console.error("[renderizadores] renderizarAdminCalendario:", err);
      });
  }

  // "Stadium Hub": los 30 estadios ordenados por aforo — EDITABLE. Solo
  // pinta markup con data-accion/data-id; el CLIC lo gestiona un único
  // delegado en js/main.js (evita acumular listeners al re-pintar tras
  // cada edición). El id "custom-estadio-…" identifica los añadidos a
  // mano frente a los del seed data/estadios.json.
  function renderizarAdminEstadios(contenedorId) {
    var contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;
    contenedor.innerHTML = "";

    cargarTodo().then(function (datos) {
      contenedor.innerHTML = "";

      var btnAdd = document.createElement("button");
      btnAdd.type = "button";
      btnAdd.className = "admin-list-add-btn";
      btnAdd.dataset.accion = "anadir-estadio";
      btnAdd.textContent = "➕ Añadir estadio";
      contenedor.appendChild(btnAdd);

      var lista = (datos.estadios.estadios || []).slice().sort(function (a, b) { return a.capacidad - b.capacidad; });
      var frag = document.createDocumentFragment();
      lista.forEach(function (e) {
        var fila = document.createElement("div");
        fila.className = "admin-list-item";
        fila.innerHTML =
          '<div class="admin-list-item-main">' +
          '<span class="admin-list-item-title">' + escapeHTML(e.nombre) + "</span>" +
          '<span class="admin-list-item-sub">' + escapeHTML(e.categoria) + "</span>" +
          "</div>" +
          '<span class="admin-list-item-value">' + Number(e.capacidad || 0).toLocaleString("es-ES") + " esp.</span>" +
          '<div class="admin-list-item-actions">' +
          '<button type="button" class="admin-list-item-btn" data-accion="editar-estadio" data-id="' + e.id +
          '" data-nombre="' + escapeHTML(e.nombre) + '" data-capacidad="' + Number(e.capacidad || 0) +
          '" data-categoria="' + escapeHTML(e.categoria) + '" aria-label="Editar">✏️</button>' +
          '<button type="button" class="admin-list-item-btn admin-list-item-btn--danger" data-accion="borrar-estadio" data-id="' + e.id +
          '" data-nombre="' + escapeHTML(e.nombre) + '" aria-label="Borrar">🗑️</button>' +
          "</div>";
        frag.appendChild(fila);
      });
      contenedor.appendChild(frag);

      if (!lista.length) contenedor.appendChild(nodoEstado("🏟️", "No hay estadios."));
    }).catch(function (err) {
      contenedor.innerHTML = "";
      contenedor.appendChild(nodoEstado("⚠️", "No se pudo cargar Stadium Hub."));
      console.error("[renderizadores] renderizarAdminEstadios:", err);
    });
  }

  // "Ball Storage": los balones del inventario + a qué competición está
  // asignado cada uno (búsqueda inversa sobre asignacionPorCompeticion) —
  // EDITABLE, mismo patrón declarativo que renderizarAdminEstadios.
  function renderizarAdminBalones(contenedorId) {
    var contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;
    contenedor.innerHTML = "";

    cargarTodo().then(function (datos) {
      contenedor.innerHTML = "";

      var btnAdd = document.createElement("button");
      btnAdd.type = "button";
      btnAdd.className = "admin-list-add-btn";
      btnAdd.dataset.accion = "anadir-balon";
      btnAdd.textContent = "➕ Añadir balón";
      contenedor.appendChild(btnAdd);

      var asign = datos.balones.asignacionPorCompeticion || {};
      var compsPorBalon = {};
      Object.keys(asign).forEach(function (compKey) {
        var a = asign[compKey];
        if (!compsPorBalon[a.balonId]) compsPorBalon[a.balonId] = [];
        compsPorBalon[a.balonId].push(a.comp || compKey);
      });

      var lista = datos.balones.balones || [];
      var frag = document.createDocumentFragment();
      lista.forEach(function (b) {
        var comps = compsPorBalon[b.id];
        var fila = document.createElement("div");
        fila.className = "admin-list-item";
        fila.innerHTML =
          '<div class="admin-list-item-main">' +
          '<span class="admin-list-item-title">' + escapeHTML(b.nombre) + "</span>" +
          '<span class="admin-list-item-sub">' + (comps ? escapeHTML(comps.join(" · ")) : "Sin asignar") + "</span>" +
          "</div>" +
          '<div class="admin-list-item-actions">' +
          '<button type="button" class="admin-list-item-btn" data-accion="editar-balon" data-id="' + b.id +
          '" data-nombre="' + escapeHTML(b.nombre) + '" aria-label="Editar">✏️</button>' +
          '<button type="button" class="admin-list-item-btn admin-list-item-btn--danger" data-accion="borrar-balon" data-id="' + b.id +
          '" data-nombre="' + escapeHTML(b.nombre) + '" aria-label="Borrar">🗑️</button>' +
          "</div>";
        frag.appendChild(fila);
      });
      contenedor.appendChild(frag);

      if (!lista.length) contenedor.appendChild(nodoEstado("⚽", "No hay balones."));
    }).catch(function (err) {
      contenedor.innerHTML = "";
      contenedor.appendChild(nodoEstado("⚠️", "No se pudo cargar Ball Storage."));
      console.error("[renderizadores] renderizarAdminBalones:", err);
    });
  }

  // "Espacio del navegador": tamaño real del progreso guardado en
  // localStorage (la única clave que usa este simulador).
  function renderizarAdminEspacio(contenedorId) {
    var contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;
    contenedor.innerHTML = "";

    var raw = "";
    try { raw = localStorage.getItem("ef7_estado_liga_v1") || ""; } catch (err) { /* localStorage no disponible */ }
    var bytes = new Blob([raw]).size;
    var kb = (bytes / 1024).toFixed(2);

    var estado = window.Estado ? window.Estado.cargarEstado() : { resultados: {}, partidosGenerados: {} };
    var nPartidos = Object.keys(estado.resultados || {}).length;
    var nGenerados = Object.keys(estado.partidosGenerados || {}).length;

    var filas = [
      { titulo: "Progreso guardado", sub: "clave ef7_estado_liga_v1", valor: kb + " KB" },
      { titulo: "Partidos confirmados", sub: "resultados guardados", valor: String(nPartidos) },
      { titulo: "Partidos de desempate generados", sub: "terceros partidos de eliminatoria", valor: String(nGenerados) }
    ];

    var frag = document.createDocumentFragment();
    filas.forEach(function (f) {
      var fila = document.createElement("div");
      fila.className = "admin-list-item";
      fila.innerHTML =
        '<div class="admin-list-item-main">' +
        '<span class="admin-list-item-title">' + f.titulo + "</span>" +
        '<span class="admin-list-item-sub">' + f.sub + "</span>" +
        "</div>" +
        '<span class="admin-list-item-value">' + f.valor + "</span>";
      frag.appendChild(fila);
    });
    contenedor.appendChild(frag);

    var nota = document.createElement("p");
    nota.className = "admin-nota";
    nota.textContent = "Los navegadores modernos permiten varios MB por sitio — muy por encima de lo que este progreso puede llegar a pesar.";
    contenedor.appendChild(nota);
  }

  // ---------- Delegación de eventos ----------
  document.addEventListener("click", function (ev) {
    var btn = ev.target.closest && ev.target.closest(".match-card-btn");
    if (btn) { abrirPreviaPartido(btn.dataset.partidoId); return; }

    if (ev.target.id === "previa-close" || ev.target.id === "previa-overlay") {
      cerrarPreviaPartido();
      return;
    }

    var btnEmpezar = ev.target.closest && ev.target.closest("#previa-empezar");
    if (btnEmpezar && window.Acta && _ultimoContexto) {
      cerrarPreviaPartido();
      window.Acta.iniciarPartidoEnVivo(btnEmpezar.dataset.partidoId, _ultimoContexto);
    }
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") cerrarPreviaPartido();
  });

  // ---------- API pública ----------
  // (buscarEquipoPorId, crearEscudoHTML, formatFecha, COMP_LABEL y
  // TOTAL_JORNADAS_POR_LIGA se exponen para que js/acta.js y
  // js/sistema-temporadas.js no dupliquen esta lógica.)
  window.Renderizadores = {
    obtenerEstadioCorrelativoAjustado: obtenerEstadioCorrelativoAjustado,
    calcularClimaDinamicoPartido: calcularClimaDinamicoPartido,
    renderizarInicioEquipos: renderizarInicioEquipos,
    pintarTemporada: pintarTemporada,
    generarCalendarioLateralDerecho: generarCalendarioLateralDerecho,
    renderizarPlantillaClub: renderizarPlantillaClub,
    renderizarProximamente: renderizarProximamente,
    renderizarAdminCalendario: renderizarAdminCalendario,
    renderizarAdminEstadios: renderizarAdminEstadios,
    renderizarAdminBalones: renderizarAdminBalones,
    renderizarAdminEspacio: renderizarAdminEspacio,
    abrirPreviaPartido: abrirPreviaPartido,
    cerrarPreviaPartido: cerrarPreviaPartido,
    cargarTodo: cargarTodo,
    buscarEquipoPorId: buscarEquipoPorId,
    crearEscudoHTML: crearEscudoHTML,
    formatFecha: formatFecha,
    COMP_LABEL: COMP_LABEL,
    TOTAL_JORNADAS_POR_LIGA: TOTAL_JORNADAS_POR_LIGA
  };
})();
