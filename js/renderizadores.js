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
  // Registro de rivales SINTÉTICOS resueltos al fusionar el calendario
  // EXTRA en texto de cada club (ver resolverRivalPorNombre / sección 3b
  // más abajo) — nunca persiste en ningún JSON, se reconstruye en cada
  // generarCalendarioLateralDerecho.
  var _sinteticosExtra = {};

  function buscarEquipoPorId(id, datos) {
    var humano = (datos.equipos.equipos || []).find(function (e) { return e.id === id; });
    if (humano) return humano;
    var bloques = datos.equiposIA.bloques || {};
    for (var key in bloques) {
      if (!bloques.hasOwnProperty(key)) continue;
      var found = (bloques[key].equipos || []).find(function (e) { return e.id === id; });
      if (found) return found;
    }
    if (_sinteticosExtra[id]) return _sinteticosExtra[id];
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

    // mostrarSiglas: exclusivo de los rivales SINTÉTICOS del calendario
    // extra en texto (ver resolverRivalPorNombre) — nunca lo llevan los
    // equipos IA reales del catálogo, así que su blasón sigue igual.
    var esHumano = !!equipo.mister || !!equipo.mostrarSiglas;
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

  // Color de la etiqueta de competición — Liga (rojo, por defecto — sin
  // clase extra) y Copa (dorado) se diferencian a golpe de vista, tal
  // como se pidió; el resto de competiciones conocidas + cualquier
  // nombre libre tecleado por el admin (calendario extra) caen en un
  // tono neutro común ("comp-otro") en vez de inventar un color para
  // cada una. Ver reglas .match-card-comp* en css/estilos.css.
  var COMP_CLASE = {
    liga: "", copa: "comp-copa", supercopa: "comp-otro",
    champions: "comp-otro", uel: "comp-otro", uecl: "comp-otro",
    recopa: "comp-otro", usc: "comp-otro"
  };
  function _claseComp(competicion) {
    return COMP_CLASE.hasOwnProperty(competicion) ? COMP_CLASE[competicion] : "comp-otro";
  }

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

  // ---------- 3b. Calendario EXTRA de cada club (texto libre -> partidos) ----------
  // data/partidos.json ya trae Liga+Copa+Supercopa reales de los 6 humanos.
  // Esto es SOLO para que cada caja pueda sumar partidos que ese fixture
  // estático todavía no cubre (una ronda de Champions/Europa League recién
  // sorteada, un amistoso...) pegando texto — se fusionan en el MISMO
  // calendario de la derecha, con el MISMO estilo de tarjeta.
  //
  // Formato de línea (una por partido), documentado también en el propio
  // editor: "Competición - Ronda - Rival [- Fecha]". El rival puede llevar
  // el resultado ya jugado pegado al final entre paréntesis: "(2-1)".
  function _normNombre(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  }
  function parsearPartidosExtraTexto(texto) {
    var items = [];
    (texto || "").split("\n").forEach(function (linea) {
      var l = linea.trim();
      if (!l) return;
      l = l.replace(/^\d+[.)]\s*/, ""); // número de lista inicial opcional, cosmético

      var partes = l.split(/\s+-\s+/);
      if (partes.length < 3) return; // hace falta Competición - Ronda - Rival como mínimo

      var competicion = partes[0].trim();
      var ronda = partes[1].trim();
      var rivalCrudo = partes[2].trim();
      var fecha = partes.length > 3 ? partes.slice(3).join(" - ").trim() : "";
      if (!competicion || !ronda) return;

      var golesLocal = null, golesVisitante = null, jugado = false;
      var mScore = rivalCrudo.match(/\(\s*(\d+)\s*-\s*(\d+)\s*\)\s*$/);
      if (mScore) {
        golesLocal = Number(mScore[1]);
        golesVisitante = Number(mScore[2]);
        jugado = true;
        rivalCrudo = rivalCrudo.slice(0, mScore.index).trim();
      }
      if (!rivalCrudo) return;

      items.push({
        id: "extra-" + items.length + "-" + _normNombre(rivalCrudo).replace(/[^a-z0-9]+/g, "-"),
        competicion: competicion,
        ronda: ronda,
        rivalNombre: rivalCrudo,
        fecha: fecha,
        jugado: jugado,
        golesLocal: golesLocal,
        golesVisitante: golesVisitante
      });
    });
    return items;
  }

  var _COLORES_SINTETICOS = ["#e6484f", "#3ba7ff", "#ffb020", "#8b5cf6", "#2bbf7a", "#ff7ab8", "#54c7d0", "#c9a24b"];
  function _colorSintetico(nombre) {
    var h = 0;
    for (var i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) >>> 0;
    return _COLORES_SINTETICOS[h % _COLORES_SINTETICOS.length];
  }

  // Busca el rival tecleado en texto libre dentro de los catálogos reales
  // (los 6 humanos + los 300+ equipos IA). Si no se encuentra (nombre que
  // no existe en ningún JSON — un rival de una competición que este
  // simulador aún no modela), se crea un equipo SINTÉTICO de solo-lectura
  // con un color hash + siglas de sus iniciales, así el partido igual se
  // pinta con un escudo reconocible — nunca se persiste ni rompe nada.
  function resolverRivalPorNombre(nombre, datos) {
    var norm = _normNombre(nombre);
    var candidatos = (datos.equipos.equipos || []).slice();
    var bloques = datos.equiposIA.bloques || {};
    Object.keys(bloques).forEach(function (k) {
      candidatos = candidatos.concat(bloques[k].equipos || []);
    });

    var exacto = candidatos.find(function (e) { return _normNombre(e.nombre) === norm; });
    if (exacto) return exacto;
    var parcial = candidatos.find(function (e) {
      var n = _normNombre(e.nombre);
      return norm.length > 2 && (n.indexOf(norm) !== -1 || norm.indexOf(n) !== -1);
    });
    if (parcial) return parcial;

    var id = "extra-rival-" + norm.replace(/[^a-z0-9]+/g, "-");
    if (!_sinteticosExtra[id]) {
      var siglas = (nombre.match(/\b[a-zA-Z0-9]/g) || []).slice(0, 3).join("").toUpperCase() || "?";
      _sinteticosExtra[id] = {
        id: id,
        nombre: nombre,
        siglas: siglas,
        colorPrimario: _colorSintetico(nombre),
        colorSecundario: "#101114",
        escudoFormato: "rombo",
        mostrarSiglas: true
      };
    }
    return _sinteticosExtra[id];
  }

  // Nombre COMPLETO bajo el escudo (petición usuario) — si no cabe en el
  // ancho de la tarjeta, se acorta con sentido común: abrevia la PRIMERA
  // palabra a su inicial + "." (p.ej. "Cultural Leonesa" -> "C.Leonesa"),
  // y si con eso sigue sin caber (nombre de una sola palabra muy larga, o
  // muchas palabras), corta con puntos suspensivos como último recurso.
  var MAX_LEN_NOMBRE_TARJETA = 15;
  function _abreviarNombre(nombre, maxLen) {
    var n = String(nombre || "").trim();
    if (!n) return "";
    if (n.length <= maxLen) return n;
    var partes = n.split(/\s+/);
    if (partes.length > 1) {
      var abrev = partes[0].charAt(0).toUpperCase() + "." + partes.slice(1).join(" ");
      if (abrev.length <= maxLen) return abrev;
      return abrev.slice(0, Math.max(1, maxLen - 1)) + "…";
    }
    return n.slice(0, Math.max(1, maxLen - 1)) + "…";
  }
  function _nombreCortoEquipo(equipo) {
    if (!equipo) return "";
    return _abreviarNombre(equipo.nombre || equipo.siglas || "", MAX_LEN_NOMBRE_TARJETA);
  }

  // Segunda pasada, YA en el DOM: el bloque de cada equipo (escudo + nombre
  // apilados) es más estrecho que la mitad de la tarjeta, así que un
  // nombre que "cabía" según la heurística de longitud de arriba puede
  // seguir desbordando en píxeles reales según el ancho de pantalla. Se
  // detecta con el propio recorte del navegador (scrollWidth > clientWidth,
  // fiable con white-space:nowrap + overflow:hidden ya puestos en CSS) y
  // solo entonces se re-abrevia más corto — nunca se acorta un nombre que
  // sí cabe.
  function _ajustarNombresQueNoQuepan(contenedor) {
    var nombres = contenedor.querySelectorAll(".match-card-nombre");
    for (var i = 0; i < nombres.length; i++) {
      var el = nombres[i];
      if (el.scrollWidth <= el.clientWidth + 1) continue;

      // 1er intento: la abreviatura normal (inicial + "." + resto).
      var texto = _abreviarNombre(el.textContent, 11);
      el.textContent = texto;

      // Si ni así cabe (pantalla muy estrecha, nombre largo de verdad),
      // se recorta carácter a carácter con "…" hasta que quepa DE VERDAD
      // — comprobado contra el ancho real (scrollWidth vs clientWidth),
      // nunca una longitud adivinada. Así funciona igual sin importar el
      // tamaño de pantalla o la fuente del dispositivo.
      var guard = 0;
      while (el.scrollWidth > el.clientWidth + 1 && texto.length > 3 && guard < 20) {
        texto = texto.slice(0, -2) + "…";
        el.textContent = texto;
        guard++;
      }
    }
  }

  // Solo se acepta como color inline un hex de verdad (#rgb / #rrggbb) —
  // todo lo demás (dato ausente/raro) cae a "transparent" para que el
  // ::before de fondo del bloque de equipo simplemente no pinte nada.
  function _colorInlineSeguro(hex) {
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(hex || "")) ? hex : "transparent";
  }

  function _bloqueEquipoHTML(equipo, ladoClase) {
    return (
      '<div class="match-card-team ' + ladoClase + '" style="--team-color:' + _colorInlineSeguro(equipo && equipo.colorPrimario) + ';">' +
      crearEscudoHTML(equipo, "escudo--sm") +
      '<span class="match-card-nombre">' + escapeHTML(_nombreCortoEquipo(equipo)) + "</span>" +
      "</div>"
    );
  }

  function construirTarjetaPartido(partido, idActivo, datos, totalJornadasLiga, esSiguiente) {
    var esLocal = partido.local === idActivo;
    var rivalId = esLocal ? partido.visitante : partido.local;
    var rival = buscarEquipoPorId(rivalId, datos);
    var activo = buscarEquipoPorId(idActivo, datos);

    var local = esLocal ? activo : rival;
    var visitante = esLocal ? rival : activo;

    var card = document.createElement("div");

    // Borde de resultado (solo si ya se jugó, comparando el marcador
    // desde el punto de vista del club activo — no importa si jugó de
    // local o visitante) + resalte del "próximo partido a jugar" (el
    // primer pendiente del calendario, calculado una vez en
    // generarCalendarioLateralDerecho y pasado aquí como flag).
    var claseResultado = "";
    if (partido.jugado && partido.resultado) {
      var golesActivo = esLocal ? partido.resultado.golesLocal : partido.resultado.golesVisitante;
      var golesRival = esLocal ? partido.resultado.golesVisitante : partido.resultado.golesLocal;
      claseResultado = golesActivo > golesRival ? " match-card--gano"
        : (golesActivo === golesRival ? " match-card--empate" : " match-card--perdio");
    }

    card.className = "match-card" + (partido.jugado ? " is-played" : "") + claseResultado + (esSiguiente ? " match-card--siguiente" : "");
    card.dataset.partidoId = partido.id;

    var compLabel = COMP_LABEL[partido.competicion] || partido.competicion;
    var claseComp = _claseComp(partido.competicion);
    var etiquetaRonda = partido.ronda ? " · " + partido.ronda : (partido.jornada ? " · J" + partido.jornada : "");

    // Centro — el marcador si ya se jugó, si no el botón PREVIA (sin
    // icono, para que quepa siempre entre los 2 bloques de equipo), más
    // el separador "vs" debajo, entre medias de los 2 nombres.
    var centroTop = (partido.jugado && partido.resultado)
      ? '<span class="match-card-marcador">' + partido.resultado.golesLocal + " - " + partido.resultado.golesVisitante + "</span>"
      : '<button type="button" class="match-card-btn" data-partido-id="' + partido.id + '">PREVIA</button>';

    card.innerHTML =
      '<div class="match-card-comp' + (claseComp ? " " + claseComp : "") + '">' + escapeHTML(compLabel + etiquetaRonda) + "</div>" +
      '<div class="match-card-teams">' +
      _bloqueEquipoHTML(local, "match-card-team--local") +
      '<div class="match-card-center">' + centroTop + '<span class="match-card-vs-sep">vs</span></div>' +
      _bloqueEquipoHTML(visitante, "match-card-team--visitante") +
      "</div>";

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

        if (badge) {
          badge.textContent = (ligaActual === "LIGA_EA_SPORTS" && window.Estado && window.Estado.obtenerNombreLiga)
            ? window.Estado.obtenerNombreLiga()
            : (ligaActual || "").replace(/_/g, " ");
        }

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

        // Calendario EXTRA del club (texto libre pegado por el admin) —
        // se fusiona en la MISMA lista, con el MISMO estilo de tarjeta.
        // Reset del registro de rivales sintéticos antes de resolverlos
        // de nuevo (evita acumular entradas de sesiones anteriores).
        _sinteticosExtra = {};
        var textoExtra = window.Estado ? window.Estado.obtenerCalendarioExtraTexto(idEquipoHumanoActivo) : "";
        var ahoraMs = Date.now();
        var partidosExtra = parsearPartidosExtraTexto(textoExtra).map(function (ex, i) {
          var rival = resolverRivalPorNombre(ex.rivalNombre, datos);
          return {
            id: ex.id,
            competicion: ex.competicion,
            ronda: ex.ronda,
            jornada: null,
            local: idEquipoHumanoActivo,
            visitante: rival.id,
            fecha: null,
            _fechaTexto: ex.fecha,
            _fechaFallbackMs: ahoraMs + i * 86400000,
            _soloInformativo: true,
            jugado: ex.jugado,
            resultado: ex.jugado ? { golesLocal: ex.golesLocal, golesVisitante: ex.golesVisitante } : null
          };
        });
        partidosDelClub = partidosDelClub.concat(partidosExtra);

        if (!partidosDelClub.length) {
          contenedor.appendChild(nodoEstado("🗓️", "Este equipo todavía no tiene partidos programados."));
          return;
        }

        partidosDelClub.sort(function (a, b) {
          var ta = a.fecha ? new Date(a.fecha).getTime() : (a._fechaFallbackMs || 0);
          var tb = b.fecha ? new Date(b.fecha).getTime() : (b._fechaFallbackMs || 0);
          return ta - tb;
        });

        var partidosPorId = {};
        partidosDelClub.forEach(function (p) { partidosPorId[p.id] = p; });

        _ultimoContexto = { datos: datos, equipo: equipo, totalJornadas: totalJornadas, partidosPorId: partidosPorId };

        // El primer partido sin jugar de la lista (ya ordenada por fecha)
        // es "el próximo" — se resalta con su propia clase para que
        // destaque de un vistazo cuál toca jugar ahora.
        var idSiguiente = null;
        for (var i = 0; i < partidosDelClub.length; i++) {
          if (!partidosDelClub[i].jugado) { idSiguiente = partidosDelClub[i].id; break; }
        }

        var frag = document.createDocumentFragment();
        partidosDelClub.forEach(function (p) {
          frag.appendChild(construirTarjetaPartido(p, idEquipoHumanoActivo, datos, totalJornadas, p.id === idSiguiente));
        });
        contenedor.appendChild(frag);

        // Scroll inteligente + acortado por ancho REAL — deferidos al mismo
        // frame, para que el layout ya esté asentado. El acortado por
        // longitud de `_nombreCortoEquipo` es solo una primera pasada
        // barata (evita nombres kilométricos); el bloque de cada equipo
        // ahora es más estrecho que antes (comparte columna con su
        // escudo), así que un nombre "corto" según esa heurística puede
        // seguir sin caber en píxeles reales — se detecta con
        // scrollWidth > clientWidth (el propio navegador ya sabe si
        // recortó el texto) y se re-abrevia con más margen.
        requestAnimationFrame(function () {
          _ajustarNombresQueNoQuepan(contenedor);
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

    document.getElementById("previa-estadio").textContent = estadio
      ? estadio.nombre
      : "Estadio no disponible";

    document.getElementById("previa-clima").textContent =
      clima.estacion + " · " + clima.icono + " " + clima.label;

    document.getElementById("previa-balon").innerHTML =
      balon.nombre + (balon.forzadoPorNieve ? ' <span class="previa-balon-forzado">❄️ forzado por nieve</span>' : "");

    // Los partidos EXTRA (texto libre) son SOLO INFORMATIVOS — no hay
    // roster resuelto para un rival sintético, así que no se pueden jugar
    // en vivo. Se sigue mostrando el resto de la previa (estadio/clima/
    // balón) tal cual, solo se oculta "Empezar partido".
    var btnEmpezar = document.getElementById("previa-empezar");
    if (btnEmpezar) {
      btnEmpezar.hidden = !!partido.jugado || !!partido._soloInformativo;
      btnEmpezar.dataset.partidoId = partido.id;
    }

    ov.hidden = false;
  }

  function cerrarPreviaPartido() {
    var ov = document.getElementById("previa-overlay");
    if (ov) ov.hidden = true;
  }

  // ============================================================
  // 3c. MENÚ DEL CLUB — columna izquierda (JS-rendered, editable 646)
  // ============================================================
  // Pinta las tarjetas del menú de la izquierda para el club activo, en
  // el orden que el propio admin de esa caja haya guardado (o el de
  // fábrica). El color de las tarjetas sale de --club-primary/-secondary,
  // ya puestas en .club-layout por js/main.js al abrir la caja — así
  // cada club se ve con SUS colores sin que este render necesite
  // conocerlos.
  function renderizarMenuClub(clubId, contenedorId) {
    var contenedor = document.getElementById(contenedorId);
    if (!contenedor || !window.Estado) return;

    var tarjetas = window.Estado.obtenerMenuClub(clubId);
    contenedor.innerHTML = "";
    var frag = document.createDocumentFragment();
    tarjetas.forEach(function (t) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "club-menu-btn";
      btn.dataset.clubVista = t.id;
      btn.innerHTML =
        '<span class="club-menu-btn-icon">' + t.icono + "</span>" +
        '<span class="club-menu-btn-label">' + escapeHTML(t.etiqueta) + "</span>";
      frag.appendChild(btn);
    });
    contenedor.appendChild(frag);
  }

  // Editor (candado 646) — lista reordenable de tarjetas + alta de
  // competiciones nuevas. Las de fábrica se pueden mover pero no borrar;
  // las añadidas por el admin llevan su propio 🗑️. Reutiliza el MISMO
  // markup .admin-list-item que Stadium Hub/Ball Storage.
  function pintarEditorMenuClub(clubId, contenedor) {
    contenedor.innerHTML = "";

    var nota = document.createElement("p");
    nota.className = "admin-nota";
    nota.textContent =
      "Mueve las tarjetas arriba/abajo con las flechas. Las de fábrica solo " +
      "se reordenan; las que añadas tú también se pueden borrar.";
    contenedor.appendChild(nota);

    var btnAdd = document.createElement("button");
    btnAdd.type = "button";
    btnAdd.className = "admin-list-add-btn";
    btnAdd.dataset.accion = "anadir-tarjeta-menu-club";
    btnAdd.dataset.clubId = clubId;
    btnAdd.textContent = "➕ Añadir competición";
    contenedor.appendChild(btnAdd);

    var tarjetas = window.Estado ? window.Estado.obtenerMenuClub(clubId) : [];
    var frag = document.createDocumentFragment();
    tarjetas.forEach(function (t, i) {
      var fila = document.createElement("div");
      fila.className = "admin-list-item";
      fila.innerHTML =
        '<div class="admin-list-item-main">' +
        '<span class="admin-list-item-title">' + escapeHTML(t.icono) + " " + escapeHTML(t.etiqueta) + "</span>" +
        '<span class="admin-list-item-sub">' + (t.esCustom ? "Añadida por ti" : "De fábrica") + "</span>" +
        "</div>" +
        '<div class="admin-list-item-actions">' +
        '<button type="button" class="admin-list-item-btn" data-accion="mover-tarjeta-menu-club" data-club-id="' + clubId +
        '" data-id="' + t.id + '" data-direccion="-1"' + (i === 0 ? " disabled" : "") + ' aria-label="Subir">▲</button>' +
        '<button type="button" class="admin-list-item-btn" data-accion="mover-tarjeta-menu-club" data-club-id="' + clubId +
        '" data-id="' + t.id + '" data-direccion="1"' + (i === tarjetas.length - 1 ? " disabled" : "") + ' aria-label="Bajar">▼</button>' +
        (t.esCustom
          ? '<button type="button" class="admin-list-item-btn admin-list-item-btn--danger" data-accion="borrar-tarjeta-menu-club" data-club-id="' + clubId +
            '" data-id="' + t.id + '" data-nombre="' + escapeHTML(t.etiqueta) + '" aria-label="Borrar">🗑️</button>'
          : "") +
        "</div>";
      frag.appendChild(fila);
    });
    contenedor.appendChild(frag);
  }

  // Editor del calendario EXTRA de un club concreto — mismo patrón que el
  // roadmap del Panel Admin (textarea con el texto crudo + Guardar/Cancelar),
  // pero namespaced por club y con formato de línea distinto (rival +
  // fecha/resultado opcionales, ver parsearPartidosExtraTexto).
  function pintarEditorCalendarioExtraClub(clubId, contenedor) {
    contenedor.innerHTML = "";

    var nota = document.createElement("p");
    nota.className = "admin-nota";
    nota.textContent =
      "Una línea por partido: «Competición - Ronda - Rival». Puedes añadir " +
      "la fecha al final («... - Rival - 15 sep») y, si ya se jugó, el " +
      "resultado pegado al rival: «Rival (2-1)». Se suma al calendario de " +
      "la derecha sin tocar los partidos ya programados.";
    contenedor.appendChild(nota);

    var textarea = document.createElement("textarea");
    textarea.id = "calendario-extra-club-textarea";
    textarea.className = "admin-roadmap-textarea";
    textarea.rows = 10;
    textarea.placeholder = "Champions League - Jornada 1 - Bayern Munich - 15 sep\nCopa del Rey - Octavos - Real Sociedad (3-1)";
    textarea.value = window.Estado ? window.Estado.obtenerCalendarioExtraTexto(clubId) : "";
    contenedor.appendChild(textarea);

    var acciones = document.createElement("div");
    acciones.className = "admin-roadmap-editor-acciones";
    acciones.innerHTML =
      '<button type="button" class="btn-ghost" data-accion="cancelar-calendario-extra-club" data-club-id="' + clubId + '">✕ Cancelar</button>' +
      '<button type="button" class="admin-list-add-btn" data-accion="guardar-calendario-extra-club" data-club-id="' + clubId + '">💾 Guardar</button>';
    contenedor.appendChild(acciones);
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
  // NO es el calendario de partidos (eso vive en data/partidos.json, con
  // fecha real, y ya se ve en el calendario de cada club). Esto es un
  // ROADMAP de texto libre editado a mano por el admin: el ORDEN en que
  // se suceden las jornadas/rondas de cada competición, SIN fecha
  // asignada — exactamente lo que pidió el usuario tras ver que el
  // calendario admin mostraba partidos de equipo en vez de competiciones.
  //
  // Formato de una línea: "N. <emoji> <Competición> - <Ronda>" (el
  // número y el " - " son opcionales; si faltan, se numera correlativo y
  // toda la línea se trata como una sola etiqueta).
  var EMOJI_INICIAL_RE = /^((?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\uFE0F|\u200D)+)\s*/u;
  function parsearCalendarioCompeticiones(texto) {
    var items = [];
    (texto || "").split("\n").forEach(function (linea) {
      var l = linea.trim();
      if (!l) return;

      var mNum = l.match(/^(\d+)[.)]\s*(.*)$/);
      var numero = mNum ? mNum[1] : String(items.length + 1);
      var resto = (mNum ? mNum[2] : l).trim();
      if (!resto) return;

      var emoji = "";
      var mEmoji = resto.match(EMOJI_INICIAL_RE);
      if (mEmoji) {
        emoji = mEmoji[1];
        resto = resto.slice(mEmoji[0].length).trim();
      }

      var partes = resto.split(/\s+-\s+/);
      var competicion = (partes[0] || resto).trim();
      var ronda = partes.length > 1 ? partes.slice(1).join(" - ").trim() : "";

      items.push({ numero: numero, emoji: emoji, competicion: competicion, ronda: ronda });
    });
    return items;
  }

  function _pintarRoadmapCalendario(contenedor) {
    contenedor.innerHTML = "";

    var btnEditar = document.createElement("button");
    btnEditar.type = "button";
    btnEditar.className = "admin-list-add-btn";
    btnEditar.dataset.accion = "editar-calendario-comp";
    btnEditar.textContent = "✏️ Editar calendario";
    contenedor.appendChild(btnEditar);

    var texto = window.Estado ? window.Estado.obtenerCalendarioTexto() : "";
    var items = parsearCalendarioCompeticiones(texto);

    if (!items.length) {
      contenedor.appendChild(nodoEstado("🗓️", "Todavía no hay calendario de competiciones. Pulsa «Editar calendario» para pegarlo."));
      return;
    }

    var lista = document.createElement("div");
    lista.className = "admin-roadmap";
    items.forEach(function (it) {
      var fila = document.createElement("div");
      fila.className = "admin-roadmap-item";
      fila.innerHTML =
        '<span class="admin-roadmap-num">' + escapeHTML(it.numero) + "</span>" +
        '<div class="admin-roadmap-body">' +
        '<span class="admin-roadmap-comp">' + (it.emoji ? escapeHTML(it.emoji) + " " : "") + escapeHTML(it.competicion) + "</span>" +
        (it.ronda ? '<span class="admin-roadmap-ronda">' + escapeHTML(it.ronda) + "</span>" : "") +
        "</div>";
      lista.appendChild(fila);
    });
    contenedor.appendChild(lista);
  }

  function _pintarEditorCalendario(contenedor) {
    contenedor.innerHTML = "";
    var texto = window.Estado ? window.Estado.obtenerCalendarioTexto() : "";

    var nota = document.createElement("p");
    nota.className = "admin-nota";
    nota.textContent =
      "Una línea por jornada/ronda, en el orden en que se juegan. Formato: " +
      "«N. emoji Competición - Ronda» (el número es opcional, se renumera solo).";
    contenedor.appendChild(nota);

    var textarea = document.createElement("textarea");
    textarea.id = "calendario-comp-textarea";
    textarea.className = "admin-roadmap-textarea";
    textarea.rows = 14;
    textarea.value = texto;
    contenedor.appendChild(textarea);

    var acciones = document.createElement("div");
    acciones.className = "admin-roadmap-editor-acciones";
    acciones.innerHTML =
      '<button type="button" class="btn-ghost" data-accion="cancelar-calendario-comp">✕ Cancelar</button>' +
      '<button type="button" class="admin-list-add-btn" data-accion="guardar-calendario-comp">💾 Guardar</button>';
    contenedor.appendChild(acciones);
  }

  // Vista pública — arranca en modo lectura (roadmap). El toggle a modo
  // edición y el guardado los gestiona el delegado de clicks de
  // js/main.js (data-accion="editar-calendario-comp"/"guardar-…"/
  // "cancelar-…"), que vuelve a llamar a estas dos pintoras.
  function renderizarAdminCalendario(contenedorId) {
    var contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;
    _pintarRoadmapCalendario(contenedor);
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
    renderizarMenuClub: renderizarMenuClub,
    pintarEditorMenuClub: pintarEditorMenuClub,
    pintarEditorCalendarioExtraClub: pintarEditorCalendarioExtraClub,
    parsearPartidosExtraTexto: parsearPartidosExtraTexto,
    resolverRivalPorNombre: resolverRivalPorNombre,
    renderizarPlantillaClub: renderizarPlantillaClub,
    renderizarProximamente: renderizarProximamente,
    renderizarAdminCalendario: renderizarAdminCalendario,
    parsearCalendarioCompeticiones: parsearCalendarioCompeticiones,
    pintarRoadmapCalendario: _pintarRoadmapCalendario,
    pintarEditorCalendario: _pintarEditorCalendario,
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
