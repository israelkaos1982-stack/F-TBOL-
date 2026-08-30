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
    rivalesReales: "data/rivales_reales.json",
    titulos: "data/titulos.json"
  };

  // Rango de valoracionPoder (correlativo con data/estadios.json) por liga —
  // usado como fallback cuando un rival tecleado en "Calendario extra" no
  // está ni en los catálogos reales ni en data/rivales_reales.json. Así un
  // rival de 1ª RFEF nunca cae en un estadio ÉLITE ni al revés, aunque su
  // nombre sea totalmente desconocido para la app.
  var _PODER_RANGO_POR_LIGA = {
    LIGA_1RFEF: [50, 57], // BARRIO
    LIGA_HYPERMOTION: [58, 72], // REGIONAL
    LIGA_EA_SPORTS: [76, 92] // ÉLITE
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
  var _rivalesRealesMap = null; // caché síncrona clave normalizada -> ficha, para resolverRivalPorNombre

  function cargarTodo() {
    return Promise.all([
      cargarJSON(DATA_URLS.equipos),
      cargarJSON(DATA_URLS.equiposIA),
      cargarJSON(DATA_URLS.estadios),
      cargarJSON(DATA_URLS.balones),
      cargarJSON(DATA_URLS.partidos),
      cargarJSON(DATA_URLS.rivalesReales),
      cargarJSON(DATA_URLS.titulos)
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
        rivalesReales: r[5],
        titulos: r[6]
      };
      _estadiosLista = datos.estadios.estadios || [];
      _rivalesRealesMap = {};
      (datos.rivalesReales.rivales || []).forEach(function (r2) {
        _rivalesRealesMap[r2.clave] = r2;
      });
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

  // Estadio REAL fijo de un equipo (campo "estadioId" en data/equipos.json,
  // referencia a data/estadios.json.estadios[].id) — usado por los 6 clubes
  // humanos. Si el equipo no tiene estadioId, o el id ya no existe en la
  // lista (p. ej. lo borró el admin desde el Stadium Hub), cae al algoritmo
  // correlativo de siempre. La IA nunca tiene estadioId, así que sigue
  // resolviendo igual que hasta ahora.
  function obtenerEstadioDelEquipo(equipo) {
    if (equipo && equipo.estadioId && _estadiosLista && _estadiosLista.length) {
      var fijo = _estadiosLista.find(function (e) { return e.id === equipo.estadioId; });
      if (fijo) return fijo;
    }
    return obtenerEstadioCorrelativoAjustado(equipo ? equipo.valoracionPoder : null);
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

  // "Competición - Ronda - Rival" de Calendario extra es texto LIBRE que
  // teclea el admin ("Liga", "Champions League", "Copa del Rey"...) — casi
  // nunca coincide EXACTO con el compKey interno de
  // data/balones.json.asignacionPorCompeticion ("liga", "champions", "uel"...).
  // Este alias normaliza las etiquetas más habituales a su compKey real,
  // para que el balón asignado a esa competición SIEMPRE se resuelva, no
  // solo cuando el admin teclea la clave interna a pelo.
  var _BALON_COMP_ALIAS = {
    liga: "liga",
    copa: "copa", "copa del rey": "copa",
    supercopa: "supercopa", "supercopa de espana": "supercopa", "super copa de espana": "supercopa",
    champions: "champions", "champions league": "champions", "uefa champions league": "champions", ucl: "champions",
    uel: "uel", "europa league": "uel", "uefa europa league": "uel",
    uecl: "uecl", "conference league": "uecl", "uefa conference league": "uecl",
    recopa: "recopa", "recopa de europa": "recopa",
    usc: "usc", "supercopa de europa": "usc", "super copa de europa": "usc",
    "ucl-previa": "ucl-previa", previa: "ucl-previa", "previa champions": "ucl-previa", "fase previa champions": "ucl-previa",
    selecciones: "selecciones", "fase final selecciones": "selecciones", mundial: "selecciones",
    "sel-clasif": "sel-clasif", "clasificacion selecciones": "sel-clasif",
    intercontinental: "intercontinental", "copa intercontinental": "intercontinental",
    clasif: "clasif", clasificatorias: "clasif", repesca: "clasif",
    amistosos: "amistosos", amistoso: "amistosos",
    superliga: "superliga",
    verano: "verano", "torneos de verano": "verano",
    mundialito: "mundialito", "mundialito de clubes": "mundialito"
  };
  // Emoji/símbolos decorativos que el admin puede haber tecleado delante
  // de una competición en el "Calendario extra" ("🇪🇸 Liga", "🏆 Copa del
  // Rey"...) — sin quitarlos, el match EXACTO contra _BALON_COMP_ALIAS
  // falla y esa competición se queda sin balón asignado ni color de card
  // (cae siempre a "comp-otro" gris). Cubre banderas (regional indicators),
  // emoticonos, pictogramas, símbolos varios y el selector de variación
  // emoji (U+FE0F) que WhatsApp/teclados suelen pegar detrás del glifo.
  var _EMOJI_RE = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}️‍]/gu;
  // Normalización SOLO para resolver el compKey (balón + color de card) —
  // deliberadamente DISTINTA de _normNombre (esa alimenta el ID estable de
  // cada partido del calendario extra vía _hashStr; si le quitáramos los
  // emoji ahí, el id de un partido YA jugado con emoji delante cambiaría y
  // su resultado guardado quedaría huérfano). Aquí no hay ese riesgo — solo
  // decide QUÉ color/balón usar, nunca identidad de partido.
  function _normCompKey(s) {
    return String(s || "")
      .replace(_EMOJI_RE, "")
      .replace(/[️‍]/g, "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  function _resolverCompKeyBalon(compKeyCrudo) {
    var norm = _normCompKey(compKeyCrudo || "");
    return _BALON_COMP_ALIAS.hasOwnProperty(norm) ? _BALON_COMP_ALIAS[norm] : compKeyCrudo;
  }

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

    var asign = (balonesData.asignacionPorCompeticion || {})[_resolverCompKeyBalon(compKey)];
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
  // Degradado de la caja de Inicio — DISTINTO de colorPrimario/
  // colorSecundario (que visten TODA la pantalla del club activo: menú,
  // cards de partido…, ver js/main.js::abrirClub). El usuario pidió una
  // combinación concreta por caja, pensada solo para esta rejilla, que no
  // siempre coincide con el tema real del club (p.ej. Real Madrid en
  // blanco+morado) — así que vive en su propio mapa, sin tocar el tema
  // compartido. `secundario` cae en el lado del texto (0%, más oscuro
  // para que el nombre en blanco se lea bien); `primario` es el color que
  // asoma limpio en la esquina opuesta.
  var CAJA_INICIO_COLORES = {
    arsenal: { primario: "#ffffff", secundario: "#ef0107" },
    "atletico-madrid": { primario: "#ffffff", secundario: "#cb3524" },
    "real-madrid": { primario: "#ffffff", secundario: "#5b2c8c" },
    liverpool: { primario: "#2b0a10", secundario: "#7a0d1f" }
  };

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
        var cajaColor = CAJA_INICIO_COLORES[eq.id] ||
          { primario: eq.colorPrimario || "#39ff6a", secundario: eq.colorSecundario || "#101114" };
        btn.style.setProperty("--primary", cajaColor.primario);
        btn.style.setProperty("--secondary", cajaColor.secundario);

        // Sin la bandera de selección (petición usuario) — solo emoji + mister.
        var misterLinea = [eq.misterEmoji, eq.mister].filter(Boolean).join(" ");

        btn.innerHTML =
          '<div class="team-box-inner">' +
          crearEscudoHTML(eq, "escudo--lg") +
          '<div class="team-box-meta">' +
          '<span class="team-box-club">' + eq.nombre + "</span>" +
          (misterLinea ? '<span class="team-box-mister">· ' + misterLinea + "</span>" : "") +
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
    promocion: "Promoción",
    champions: "Champions League", "ucl-previa": "Previa Champions",
    uel: "Europa League", uecl: "Conference League",
    recopa: "Recopa de Europa", usc: "Supercopa de Europa",
    intercontinental: "Intercontinental",
    selecciones: "Selecciones", "sel-clasif": "Selecciones · Clasif."
  };

  // Color de la etiqueta de competición — cada una con el SUYO propio
  // (Liga rojo, Copa dorado, Supercopa España marrón, Promoción gris,
  // Champions azul, Previa Champions morado, Europa League naranja,
  // Conference League verde, Intercontinental amarillo vivo, Supercopa
  // de Europa plata, Selecciones rosa), para que ninguna se pierda de
  // un vistazo entre las demás. Recopa de Europa + cualquier nombre
  // libre tecleado por el admin (calendario extra) caen en un tono
  // neutro común ("comp-otro") — no se pidió color para ellas. Ver
  // reglas .match-card-comp*/.match-card.comp-* en css/estilos.css.
  var COMP_CLASE = {
    liga: "comp-liga", copa: "comp-copa", supercopa: "comp-supercopa",
    promocion: "comp-promocion",
    champions: "comp-champions", "ucl-previa": "comp-previa",
    uel: "comp-uel", uecl: "comp-uecl",
    recopa: "comp-otro", usc: "comp-usc",
    intercontinental: "comp-intercontinental",
    selecciones: "comp-selecciones", "sel-clasif": "comp-selecciones"
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

  // Hash determinista simple (mismo texto -> mismo número, siempre) — lo
  // reutilizan el id estable de "Calendario extra", el color del escudo
  // sintético y el valoracionPoder sintético, sin duplicar el bucle 3 veces.
  function _hashStr(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
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
  // el resultado ya jugado pegado al final entre paréntesis: "(2-1)" —
  // SIEMPRE el gol del club activo primero, el del rival segundo, juegue
  // en casa o fuera (así no hay que pensar en local/visitante al escribir
  // el marcador, solo en "cuántos hicimos nosotros / ellos").
  //
  // El club activo juega en CASA por defecto, salvo que el rival venga
  // escrito como "Rival vs Club" (en vez de "Club vs Rival" — el orden
  // decide quién es local) o lleve la marca explícita "(visitante)" al
  // final (sin "vs": solo el nombre del rival + esa marca).
  function _normNombre(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  }
  function parsearPartidosExtraTexto(texto, nombreClubActivo) {
    var clubNorm = _normNombre(nombreClubActivo || "");
    var items = [];
    var idsVistos = {}; // desambigua el raro caso de 2 líneas con la MISMA competición+ronda+rival (ida/vuelta sin distinguir en el texto)
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

      // Marcador ya jugado: SIEMPRE (goles del club activo - goles del
      // rival), en ese orden, sea cual sea el lado en el que jugó.
      var golesClub = null, golesRival = null, jugado = false;
      var mScore = rivalCrudo.match(/\(\s*(\d+)\s*-\s*(\d+)\s*\)\s*$/);
      if (mScore) {
        golesClub = Number(mScore[1]);
        golesRival = Number(mScore[2]);
        jugado = true;
        rivalCrudo = rivalCrudo.slice(0, mScore.index).trim();
      }

      // Marca explícita "(visitante)"/"(local)" al final — cubre el caso
      // sin "vs" (solo el nombre suelto del rival) y sirve de confirmación
      // redundante cuando sí hay "vs".
      var esVisitante = false;
      var mMarca = rivalCrudo.match(/\(\s*(visitante|local)\s*\)\s*$/i);
      if (mMarca) {
        esVisitante = /visitante/i.test(mMarca[1]);
        rivalCrudo = rivalCrudo.slice(0, mMarca.index).trim();
      }
      if (!rivalCrudo) return;

      // "Equipo A vs Equipo B": el orden decide quién es local (A) y quién
      // visitante (B) — miramos cuál de los 2 es el club activo para saber
      // en qué lado juega, y el OTRO lado es el rival de verdad a resolver.
      // Antes esto solo evitaba el auto-emparejamiento "Liverpool vs
      // Liverpool" (si se pegaba la línea entera en vez del rival suelto);
      // ahora ADEMÁS decide casa/fuera con el mismo patrón.
      var mVs = rivalCrudo.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
      if (mVs && clubNorm) {
        var ladoA = _normNombre(mVs[1]), ladoB = _normNombre(mVs[2]);
        var aEsClub = ladoA.indexOf(clubNorm) !== -1 || clubNorm.indexOf(ladoA) !== -1;
        var bEsClub = ladoB.indexOf(clubNorm) !== -1 || clubNorm.indexOf(ladoB) !== -1;
        if (aEsClub && !bEsClub) { rivalCrudo = mVs[2].trim(); esVisitante = false; }
        else if (bEsClub && !aEsClub) { rivalCrudo = mVs[1].trim(); esVisitante = true; }
        // si ninguno de los 2 lados es el club activo (o lo son ambos, con
        // nombres muy cortos), no tocamos nada — mejor un rival sintético
        // (ver resolverRivalPorNombre) que adivinar mal cuál es cuál; se
        // respeta lo que ya se supiera por la marca (visitante)/(local).
      }

      // Id ESTABLE (competición+ronda+rival, sin la posición en la lista):
      // reordenar/añadir líneas en el texto no le cambia el id a un partido
      // ya existente, así un resultado confirmado en vivo (ver
      // Estado.registrarResultadoPartido) no se queda huérfano al re-parsear.
      // Si 2 líneas comparten exactamente competición+ronda+rival (p.ej.
      // ida/vuelta sin distinguirlo en la "ronda") se desambiguan por orden
      // de aparición para que nunca colisionen entre sí.
      var idBase = "extra-" + _hashStr(_normNombre(competicion) + "|" + _normNombre(ronda) + "|" + _normNombre(rivalCrudo)).toString(36);
      idsVistos[idBase] = (idsVistos[idBase] || 0) + 1;
      var idFinal = idsVistos[idBase] > 1 ? idBase + "-" + idsVistos[idBase] : idBase;

      items.push({
        id: idFinal,
        competicion: competicion,
        ronda: ronda,
        rivalNombre: rivalCrudo,
        fecha: fecha,
        jugado: jugado,
        esVisitante: esVisitante,
        golesClub: golesClub,
        golesRival: golesRival
      });
    });
    return items;
  }

  var _COLORES_SINTETICOS = ["#e6484f", "#3ba7ff", "#ffb020", "#8b5cf6", "#2bbf7a", "#ff7ab8", "#54c7d0", "#c9a24b"];
  function _colorSintetico(nombre) {
    return _COLORES_SINTETICOS[_hashStr(nombre) % _COLORES_SINTETICOS.length];
  }

  // valoracionPoder determinista (mismo nombre -> mismo poder siempre) pero
  // repartido dentro del rango [min, max] de la liga de contexto, para que
  // un rival genérico no reconocido en absoluto siga cayendo en el estadio
  // "de su categoría" (ver _PODER_RANGO_POR_LIGA) en vez de siempre el
  // mínimo — sin necesidad de tocar el algoritmo correlativo de siempre.
  function _poderSinteticoPorLiga(nombre, ligaContexto) {
    var rango = _PODER_RANGO_POR_LIGA[ligaContexto] || _PODER_RANGO_POR_LIGA.LIGA_HYPERMOTION;
    var span = rango[1] - rango[0];
    return rango[0] + (span > 0 ? _hashStr(nombre) % (span + 1) : 0);
  }

  function _buscarRivalReal(norm) {
    if (!_rivalesRealesMap) return null;
    if (_rivalesRealesMap[norm]) return _rivalesRealesMap[norm];
    var claves = Object.keys(_rivalesRealesMap);
    for (var i = 0; i < claves.length; i++) {
      var k = claves[i];
      if (norm.length > 2 && (k.indexOf(norm) !== -1 || norm.indexOf(k) !== -1)) return _rivalesRealesMap[k];
    }
    return null;
  }

  // Busca el rival tecleado en texto libre, en 3 pasadas:
  // 1) catálogos reales (los 6 humanos + los 300+ equipos IA) — match exacto.
  // 2) catálogos reales — match parcial (substring en cualquier dirección).
  // 3) data/rivales_reales.json — clubes reales de 1ª RFEF/Hypermotion/LaLiga
  //    que no viven como equipo IA completo (no simulamos su liga entera,
  //    solo aparecen como rival puntual de un club humano) pero sí tienen
  //    su identidad visual (colores/formato/siglas) y estadio correctos.
  // Si NINGUNA pasada encuentra nada (nombre de una competición que este
  // simulador aún no modela en absoluto), se crea un equipo SINTÉTICO de
  // solo-lectura con un color hash + siglas de sus iniciales — el partido
  // igual se pinta con un escudo reconocible, y con un valoracionPoder
  // acorde a `ligaContexto` (la liga actual del club humano cuyo calendario
  // se está resolviendo) para que caiga en un estadio de su categoría en
  // vez de siempre el mismo. Nada de esto se persiste ni rompe nada.
  function resolverRivalPorNombre(nombre, datos, ligaContexto) {
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
      var real = _buscarRivalReal(norm);
      if (real) {
        _sinteticosExtra[id] = {
          id: id,
          nombre: nombre,
          siglas: real.siglas,
          colorPrimario: real.colorPrimario,
          colorSecundario: real.colorSecundario,
          escudoFormato: real.escudoFormato,
          valoracionPoder: real.valoracionPoder,
          mostrarSiglas: true
        };
      } else {
        var siglas = (nombre.match(/\b[a-zA-Z0-9]/g) || []).slice(0, 3).join("").toUpperCase() || "?";
        _sinteticosExtra[id] = {
          id: id,
          nombre: nombre,
          siglas: siglas,
          colorPrimario: _colorSintetico(nombre),
          colorSecundario: "#101114",
          escudoFormato: "rombo",
          valoracionPoder: _poderSinteticoPorLiga(nombre, ligaContexto),
          mostrarSiglas: true
        };
      }
    }
    return _sinteticosExtra[id];
  }

  // ============================================================
  // 3c-ter. LIGA 1ª REF — "la batidora": base IA (texto) + partidos humanos
  // ============================================================
  // Los equipos IA de esta competición son los REALES que da el usuario
  // (Real Zaragoza, SD Huesca...) — NUNCA se inventan ni se simulan sus
  // partidos entre sí; su snapshot agregado se pega tal cual se copia de
  // otra tabla: "Pos Nombre Pts PJ PE PP G+ G- DG", separado por ESPACIOS
  // (no por " - "), así que el nombre del equipo puede llevar varias
  // palabras — se identifica cogiendo, desde el FINAL de la línea, la
  // tanda de números consecutivos (hasta 7 — Pts/PJ/PE/PP/G+/G- y, si
  // está, DG, que se ignora: el DG se recalcula SIEMPRE como G+ - G-) y
  // tratando el primer token que quede como Pos si también es numérico.
  //
  // Los 6 clubes humanos SIEMPRE aparecen (aunque todavía no hayan
  // jugado nada) con SUS PROPIOS partidos de Liga ya registrados en la
  // app (calcularLiga1RefCombinada) — nunca desde el texto pegado, ni
  // aunque el admin escriba su nombre por error ahí (se ignora).
  function parsearLiga1RefTexto(texto) {
    var items = [];
    (texto || "").split("\n").forEach(function (linea) {
      var l = linea.trim();
      if (!l) return;
      var tokens = l.split(/\s+/);
      if (tokens.length < 7) return; // Nombre + al menos 6 números

      var fin = tokens.length;
      var numerosFinales = [];
      while (fin > 0 && numerosFinales.length < 7 && /^-?\d+$/.test(tokens[fin - 1])) {
        numerosFinales.unshift(tokens[fin - 1]);
        fin--;
      }
      if (numerosFinales.length < 6) return; // hacen falta Pts/PJ/PE/PP/G+/G-

      var numeros = numerosFinales.slice(0, 6).map(Number); // descarta un 7º (DG)
      var inicio = 0;
      if (fin > 0 && /^\d+$/.test(tokens[0])) inicio = 1; // Pos inicial opcional

      var nombre = tokens.slice(inicio, fin).join(" ").trim();
      if (!nombre) return;
      if (numeros.some(function (n) { return isNaN(n); })) return;

      items.push({
        nombre: nombre,
        pts: numeros[0], pj: numeros[1], pe: numeros[2], pp: numeros[3],
        gf: numeros[4], gc: numeros[5]
      });
    });
    return items;
  }

  // PSG no juega en la Liga 1ª REF (Primera RFEF) — ni siquiera en España,
  // juega en Francia. Es el único de los 6 humanos fuera de esta liga; si
  // en el futuro se añade otro club humano de fuera de España, su id va
  // aquí también.
  var LIGA1REF_HUMANOS_EXCLUIDOS = ["psg"];

  function _liga1RefEquiposHumanos(datos) {
    return (datos.equipos.equipos || []).filter(function (e) {
      return LIGA1REF_HUMANOS_EXCLUIDOS.indexOf(e.id) === -1;
    });
  }

  // ¿El nombre libre que acaba de pegar el admin (equipo de la
  // clasificación, o "equipo" de una fila de estadística) es en realidad
  // uno de los clubes humanos? Comparte el mismo criterio tolerante
  // (normalizado + substring) en clasificación y en las 5 cajas de stats.
  function _liga1RefEsNombreHumano(nombre, equiposHumanos) {
    var norm = _normNombre(nombre || "");
    if (!norm) return false;
    return equiposHumanos.some(function (e) {
      var n = _normNombre(e.nombre);
      return n === norm || (norm.length > 2 && (n.indexOf(norm) !== -1 || norm.indexOf(n) !== -1));
    });
  }

  // La fusión: texto pegado (solo IA) + los clubes humanos que SÍ juegan
  // esta liga, con sus propios partidos de Liga ya jugados dentro de la
  // app (Estado.calcularClasificacion sobre la liga ACTUAL de cada club —
  // hoy "LIGA_EA_SPORTS", pero se lee de equipo.ligaActual para que siga
  // funcionando si algún club cambia de liga más adelante). Un humano
  // NUNCA sale del texto pegado — si el admin escribe su nombre ahí por
  // error, esa línea se descarta; su fila sale SIEMPRE de sus propios
  // partidos (una sola fuente de verdad por equipo).
  function calcularLiga1RefCombinada(datos) {
    var equiposHumanos = _liga1RefEquiposHumanos(datos);
    var filas = [];

    var texto = window.Estado ? window.Estado.obtenerLiga1RefTexto() : "";
    parsearLiga1RefTexto(texto).forEach(function (f) {
      if (_liga1RefEsNombreHumano(f.nombre, equiposHumanos)) return; // su fila la aporta el bloque de abajo, nunca el texto
      filas.push({
        nombre: f.nombre, nombreMostrado: f.nombre, equipoId: null,
        pts: f.pts, pj: f.pj, pe: f.pe, pp: f.pp, gf: f.gf, gc: f.gc
      });
    });

    equiposHumanos.forEach(function (e) {
      var propia = window.Estado ? window.Estado.calcularClasificacion(datos, e.ligaActual) : [];
      var fila = propia.find(function (r) { return r.equipoId === e.id; });
      filas.push({
        nombre: e.nombre,
        nombreMostrado: (e.misterEmoji || "") + e.nombre,
        equipoId: e.id,
        pts: fila ? fila.pts : 0, pj: fila ? fila.pj : 0, pe: fila ? fila.pe : 0,
        pp: fila ? fila.pp : 0, gf: fila ? fila.gf : 0, gc: fila ? fila.gc : 0
      });
    });

    filas.sort(function (a, b) {
      if (b.pts !== a.pts) return b.pts - a.pts;
      var dgA = a.gf - a.gc, dgB = b.gf - b.gc;
      if (dgB !== dgA) return dgB - dgA;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.nombre.localeCompare(b.nombre);
    });
    return filas;
  }

  // Zona de ascenso/descenso por POSICIÓN ABSOLUTA — el ascenso (1-4) y la
  // promoción de ascenso (5) siempre son los mismos puestos por arriba; el
  // descenso y su promoción se cuentan desde ABAJO de la tabla (últimos 4
  // puestos descenso directo, el 5º empezando por el final promoción de
  // descenso), para que sigan siendo correctos aunque cambie el nº total
  // de equipos (hoy 16: 11 IA reales + 5 humanos, PSG no juega esta liga).
  function _liga1RefZona(pos, total) {
    if (pos <= 4) return "ascenso";
    if (pos === 5) return "promo-ascenso";
    if (total && pos === total - 4) return "promo-descenso";
    if (total && pos > total - 4) return "descenso";
    return "";
  }

  // ============================================================
  // 3c-quater. LIGA 1ª REF — Pichichi/MVP/Tarjetas/Zamora
  // ============================================================
  // Mismo espíritu que la clasificación de equipos: texto libre pegado
  // por el admin (para los jugadores IA, sin ficha real en la app) +
  // auto-suma desde los partidos ya jugados de los clubes humanos (para
  // esos SÍ hay ficha e id de jugador real, vía los eventos que se
  // registran al "+ Añadir evento" en un partido en vivo). Ninguna caja
  // guarda un contador aparte — se recalculan en caliente igual que el
  // resto de estadísticas de este archivo.
  var LIGA1REF_STATS = [
    { key: "pichichi", icono: "⚽", label: "PICHICHI", columna: "Goles" },
    { key: "mvp", icono: "⭐", label: "MVP", columna: "MVP" },
    { key: "amarillas", icono: "🟨", label: "TARJETAS AMARILLAS", columna: "Amarillas" },
    { key: "rojas", icono: "🟥", label: "TARJETAS ROJAS", columna: "Rojas" },
    { key: "zamora", icono: "🧤", label: "ZAMORA", columna: "Porterías a 0" }
  ];

  // Formato de línea (texto libre, una por jugador): "Nº Nombre Jugador -
  // Equipo  Cantidad" — el Nº/separador inicial es opcional (se
  // recalcula solo, igual que Pos en la clasificación de equipos); el
  // ÚLTIMO número de la línea es la cantidad, y el "-" INMEDIATO anterior
  // separa nombre de equipo (si no hay "-", todo es el nombre y el
  // equipo queda vacío).
  function parsearLiga1RefStatTexto(texto) {
    var items = [];
    (texto || "").split("\n").forEach(function (linea) {
      var l = linea.trim();
      if (!l) return;
      l = l.replace(/^\d+[ºª°]?[.\-)]?\s*/, ""); // quita "1º ", "12.", "3) "...
      var m = l.match(/^(.*\S)\s+(\d+)\s*$/);
      if (!m) return;
      var cantidad = Number(m[2]);
      if (isNaN(cantidad)) return;
      var partes = m[1].split(/\s-\s/);
      var equipo = partes.length > 1 ? partes.pop().trim() : "";
      var nombre = partes.join(" - ").trim();
      if (!nombre) return;
      items.push({ nombre: nombre, equipo: equipo, cantidad: cantidad });
    });
    return items;
  }

  // El portero "titular" de un club humano a efectos de Zamora: el
  // primero (por dorsal) de su plantilla con posición POR. Sin plantilla
  // de porteros todavía, ese club simplemente no aporta Zamora automática
  // (nunca se inventa un nombre). Mismo criterio que usa la Plantilla
  // para atribuir las porterías imbatidas — ver _porteroPrincipalClub,
  // más abajo (se define después pero es la MISMA función, reutilizada).
  function _liga1RefPorteroPrincipal(clubId) {
    return _porteroPrincipalClub(clubId);
  }

  // Recorre, para cada club humano de esta liga, sus propios partidos de
  // Liga ya jugados (misma fuente que la clasificación) y suma goles/MVP/
  // amarillas/rojas por jugador (solo eventos es_humano:true — los de la
  // IA no tienen ficha real, igual que en calcularStatsRosterClub, más
  // abajo) + porterías a 0 del equipo, atribuidas a su portero principal.
  function calcularLiga1RefStatsHumanos(datos) {
    var acumulado = { pichichi: {}, mvp: {}, amarillas: {}, rojas: {}, zamora: {} };
    var ES_GOL = { GOL: 1, GOL_FAV_FALTA: 1, PENALTI_GOL: 1 };

    function sumar(bucket, jugadorId, nombre, equipo) {
      if (!bucket[jugadorId]) bucket[jugadorId] = { nombre: nombre, equipo: equipo, cantidad: 0 };
      bucket[jugadorId].cantidad++;
    }

    _liga1RefEquiposHumanos(datos).forEach(function (e) {
      var nombresPorId = {};
      obtenerJugadoresClub(e.id).forEach(function (j) { nombresPorId[j.id] = j.nombre; });
      var portero = _liga1RefPorteroPrincipal(e.id);

      // SOLO los partidos donde ESTE club es local o visitante — sin este
      // filtro, con varios humanos en la MISMA liga (todos comparten
      // ligaActual="LIGA_EA_SPORTS"), el partido de un club se procesaba
      // también en el bucle de los otros 4, multiplicando el conteo.
      var partidos = (window.Estado ? window.Estado.listarPartidosResueltos(datos) : []).filter(function (p) {
        return p.jugado && p.competicion === "liga" && p.liga === e.ligaActual &&
          (p.local === e.id || p.visitante === e.id);
      });

      partidos.forEach(function (p) {
        (p.eventos || []).forEach(function (ev) {
          // SOLO eventos de ESTE club (equipo_id) — un partido humano-vs-
          // humano trae eventos de AMBOS lados; cada club solo suma los suyos.
          if (!ev.es_humano || !ev.jugador_id || ev.equipo_id !== e.id) return;
          var nombreJ = nombresPorId[ev.jugador_id] || ev.jugador_nombre;
          if (!nombreJ) return;
          if (ES_GOL[ev.tipo]) sumar(acumulado.pichichi, ev.jugador_id, nombreJ, e.nombre);
          else if (ev.tipo === "MVP") sumar(acumulado.mvp, ev.jugador_id, nombreJ, e.nombre);
          else if (ev.tipo === "AMARILLA") sumar(acumulado.amarillas, ev.jugador_id, nombreJ, e.nombre);
          else if (ev.tipo === "ROJA") sumar(acumulado.rojas, ev.jugador_id, nombreJ, e.nombre);
        });

        if (!portero || !p.resultado) return;
        var encajados = p.local === e.id ? p.resultado.golesVisitante
          : p.visitante === e.id ? p.resultado.golesLocal : null;
        if (encajados === 0) sumar(acumulado.zamora, portero.id, portero.nombre, e.nombre);
      });
    });

    var salida = {};
    Object.keys(acumulado).forEach(function (k) {
      salida[k] = Object.keys(acumulado[k]).map(function (id) { return acumulado[k][id]; });
    });
    return salida;
  }

  // Ranking final de una categoría: texto pegado (IA) + auto-suma humana,
  // top 15 por cantidad (empate -> alfabético, mismo criterio que el
  // resto de tablas de este archivo).
  function calcularLiga1RefStatsCombinado(datos, categoria) {
    var equiposHumanos = _liga1RefEquiposHumanos(datos);
    var filas = [];

    var texto = window.Estado ? window.Estado.obtenerLiga1RefStatTexto(categoria) : "";
    parsearLiga1RefStatTexto(texto).forEach(function (it) {
      if (_liga1RefEsNombreHumano(it.equipo, equiposHumanos)) return; // esa fila la aporta la auto-suma
      filas.push(it);
    });

    (calcularLiga1RefStatsHumanos(datos)[categoria] || []).forEach(function (it) { filas.push(it); });

    filas.sort(function (a, b) { return b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre); });
    return filas.slice(0, 15);
  }

  function renderizarLiga1RefClasificacion(contenedorId, idClubActivo) {
    var contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;
    contenedor.innerHTML = "";
    contenedor.appendChild(nodoEstado("⏳", "Cargando…"));

    cargarTodo().then(function (datos) {
      contenedor.innerHTML = "";

      // Leyenda mini (los propios emoji de color hacen de swatch, sin CSS
      // extra) a la izquierda del ✏️ — sustituye al título "1ª REF" (ya se
      // ve arriba del modal) y a la leyenda larga que había abajo.
      var header = document.createElement("div");
      header.className = "liga1ref-header";
      header.innerHTML =
        '<span class="liga1ref-leyenda-mini">🟦Ascenso 🟨Promoción 🟥Descenso 🟫Promoción</span>' +
        '<button type="button" class="liga1ref-editar-btn" data-accion="editar-liga1ref-inline" data-club-id="' +
        (idClubActivo || "") + '" aria-label="Editar clasificación">✏️</button>';
      contenedor.appendChild(header);

      var filas = calcularLiga1RefCombinada(datos);

      if (!filas.length) {
        contenedor.appendChild(nodoEstado("📊", "Todavía no hay clasificación pegada. Pulsa ✏️ (PIN 646) para añadirla."));
      } else {
        var wrap = document.createElement("div");
        wrap.className = "clasificacion-wrap";
        var tablaEl = document.createElement("table");
        tablaEl.className = "clasificacion-tabla liga1ref-tabla";
        tablaEl.innerHTML =
          "<thead><tr><th>#</th><th>Equipo</th><th>Pts</th><th>PJ</th><th>PE</th><th>PP</th>" +
          "<th>G+</th><th>G-</th><th>DG</th></tr></thead>";
        var tbody = document.createElement("tbody");

        filas.forEach(function (f, i) {
          var pos = i + 1;
          var dg = f.gf - f.gc;
          var zona = _liga1RefZona(pos, filas.length);
          var claseFila = "clasificacion-fila" + (zona ? " liga1ref-zona-" + zona : "");
          if (f.equipoId && f.equipoId === idClubActivo) claseFila += " clasificacion-fila--activo";

          var tr = document.createElement("tr");
          tr.className = claseFila;
          tr.innerHTML =
            '<td class="clasificacion-pos">' + pos + "</td>" +
            '<td class="clasificacion-equipo">' + escapeHTML(f.nombreMostrado) +
            (f.equipoId && f.equipoId === idClubActivo ? ' <span class="clasificacion-tag">TÚ</span>' : "") + "</td>" +
            '<td class="clasificacion-pts">' + f.pts + "</td>" +
            "<td>" + f.pj + "</td><td>" + f.pe + "</td><td>" + f.pp + "</td>" +
            "<td>" + f.gf + "</td><td>" + f.gc + "</td>" +
            "<td>" + (dg > 0 ? "+" + dg : dg) + "</td>";
          tbody.appendChild(tr);
        });
        tablaEl.appendChild(tbody);
        wrap.appendChild(tablaEl);
        contenedor.appendChild(wrap);
      }

      // Cajas de estadísticas — Pichichi/MVP/Tarjetas/Zamora. Cada una
      // abre su propio ranking (top 15) dentro de este mismo contenedor.
      var statsGrid = document.createElement("div");
      statsGrid.className = "liga1ref-stats-grid";
      statsGrid.innerHTML = LIGA1REF_STATS.map(function (s) {
        return '<button type="button" class="liga1ref-stat-box" data-accion="ver-liga1ref-stat" data-club-id="' +
          (idClubActivo || "") + '" data-categoria="' + s.key + '"><span class="liga1ref-stat-box-icono">' +
          s.icono + '</span><span class="liga1ref-stat-box-label">' + escapeHTML(s.label) + "</span></button>";
      }).join("");
      contenedor.appendChild(statsGrid);
    });
  }

  // Ranking (top 15) de UNA categoría — pinta DENTRO del mismo contenedor
  // que la clasificación, con un botón "← Volver" para regresar sin
  // cerrar el modal (mismo patrón que el editor inline de la tabla).
  function renderizarLiga1RefStatDetalle(contenedorId, idClubActivo, categoria) {
    var contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;
    var meta = LIGA1REF_STATS.filter(function (s) { return s.key === categoria; })[0];
    if (!meta) return;
    contenedor.innerHTML = "";
    contenedor.appendChild(nodoEstado("⏳", "Cargando…"));

    cargarTodo().then(function (datos) {
      contenedor.innerHTML = "";

      var header = document.createElement("div");
      header.className = "liga1ref-header";
      header.innerHTML =
        '<button type="button" class="btn-ghost liga1ref-volver-btn" data-accion="volver-liga1ref" data-club-id="' +
        (idClubActivo || "") + '">← Volver</button>' +
        '<button type="button" class="liga1ref-editar-btn" data-accion="editar-liga1ref-stat-inline" data-club-id="' +
        (idClubActivo || "") + '" data-categoria="' + categoria + '" aria-label="Editar ' + escapeHTML(meta.label) + '">✏️</button>';
      contenedor.appendChild(header);

      var titulo = document.createElement("p");
      titulo.className = "liga1ref-stat-titulo";
      titulo.textContent = meta.icono + " " + meta.label;
      contenedor.appendChild(titulo);

      var filas = calcularLiga1RefStatsCombinado(datos, categoria);
      if (!filas.length) {
        contenedor.appendChild(nodoEstado(meta.icono, "Todavía no hay datos. Pulsa ✏️ (PIN 646) para añadirlos, o suman solos al añadir eventos de un club humano."));
        return;
      }

      var wrap = document.createElement("div");
      wrap.className = "clasificacion-wrap";
      var tablaEl = document.createElement("table");
      tablaEl.className = "clasificacion-tabla liga1ref-tabla";
      tablaEl.innerHTML = "<thead><tr><th>#</th><th>Jugador</th><th>Equipo</th><th>" + escapeHTML(meta.columna) + "</th></tr></thead>";
      var tbody = document.createElement("tbody");
      filas.forEach(function (f, i) {
        var tr = document.createElement("tr");
        tr.className = "clasificacion-fila";
        tr.innerHTML =
          '<td class="clasificacion-pos">' + (i + 1) + "</td>" +
          '<td class="clasificacion-equipo">' + escapeHTML(f.nombre) + "</td>" +
          "<td>" + escapeHTML(f.equipo || "—") + "</td>" +
          '<td class="clasificacion-pts">' + f.cantidad + "</td>";
        tbody.appendChild(tr);
      });
      tablaEl.appendChild(tbody);
      wrap.appendChild(tablaEl);
      contenedor.appendChild(wrap);
    });
  }

  // Editor inline (PIN 646, ✏️ dentro de la propia pantalla) — pinta
  // DENTRO del mismo contenedor que la tabla, así Guardar/Cancelar pueden
  // volver a la vista de clasificación sin cerrar el modal entero.
  function pintarEditorLiga1Ref(contenedor, idClubActivo) {
    contenedor.innerHTML = "";

    var nota = document.createElement("p");
    nota.className = "admin-nota";
    nota.textContent =
      "Pega la tabla completa, una línea por equipo: «Pos Nombre Pts PJ PE PP " +
      "G+ G- DG» separado por espacios, tal cual se copia de otro sitio (Pos y " +
      "DG son opcionales, se recalculan solos). Es una clasificación ÚNICA — " +
      "la ven las 6 cajas igual.";
    contenedor.appendChild(nota);

    var textarea = document.createElement("textarea");
    textarea.id = "liga1ref-textarea";
    textarea.className = "admin-roadmap-textarea";
    textarea.rows = 14;
    textarea.placeholder = "1  Real Zaragoza  9  3  0  0  10  0  10\n2  SD Huesca      6  3  0  1  5   2   3";
    textarea.value = window.Estado ? window.Estado.obtenerLiga1RefTexto() : "";
    contenedor.appendChild(textarea);

    var acciones = document.createElement("div");
    acciones.className = "admin-roadmap-editor-acciones";
    acciones.innerHTML =
      '<button type="button" class="btn-ghost" data-accion="cancelar-liga1ref" data-club-id="' + (idClubActivo || "") + '">✕ Cancelar</button>' +
      '<button type="button" class="admin-list-add-btn" data-accion="guardar-liga1ref" data-club-id="' + (idClubActivo || "") + '">💾 Guardar</button>';
    contenedor.appendChild(acciones);
  }

  // Editor inline de UNA categoría de estadística (PIN 646) — mismo
  // patrón exacto que pintarEditorLiga1Ref, pinta dentro del contenedor
  // del ranking para poder Guardar/Cancelar sin cerrar el modal.
  function pintarEditorLiga1RefStat(contenedor, idClubActivo, categoria) {
    var meta = LIGA1REF_STATS.filter(function (s) { return s.key === categoria; })[0];
    if (!meta) return;
    contenedor.innerHTML = "";

    var nota = document.createElement("p");
    nota.className = "admin-nota";
    nota.textContent =
      "Pega el ranking, una línea por jugador: «Nombre Jugador - Equipo  " + meta.columna +
      "» (el Nº inicial es opcional, se recalcula solo). Los jugadores de las 6 cajas " +
      "humanas se suman SOLOS al añadir eventos en un partido — no hace falta escribirlos aquí.";
    contenedor.appendChild(nota);

    var textarea = document.createElement("textarea");
    textarea.id = "liga1ref-stat-textarea";
    textarea.className = "admin-roadmap-textarea";
    textarea.rows = 14;
    textarea.placeholder = "1º Carlos Fernández - CD Mirandés  7\n2º Ander Herrera - Real Zaragoza  6";
    textarea.value = window.Estado ? window.Estado.obtenerLiga1RefStatTexto(categoria) : "";
    contenedor.appendChild(textarea);

    var acciones = document.createElement("div");
    acciones.className = "admin-roadmap-editor-acciones";
    acciones.innerHTML =
      '<button type="button" class="btn-ghost" data-accion="cancelar-liga1ref-stat" data-club-id="' + (idClubActivo || "") + '" data-categoria="' + categoria + '">✕ Cancelar</button>' +
      '<button type="button" class="admin-list-add-btn" data-accion="guardar-liga1ref-stat" data-club-id="' + (idClubActivo || "") + '" data-categoria="' + categoria + '">💾 Guardar</button>';
    contenedor.appendChild(acciones);
  }

  // ============================================================
  // SALA DE TÍTULOS — catálogo cerrado (data/titulos.json). SIN
  // imágenes: cada trofeo es un icono (emoji) + su propio color de
  // fondo (ver .trofeo-card en css/estilos.css), 0 KB por trofeo —
  // mismo principio "0 KB de imágenes externas" que los escudos.
  //
  // El editor (pintarEditorTitulos) PRE-RELLENA el textarea con los 33
  // trofeos del catálogo completo, uno por línea "Nombre - N" (N=veces
  // ganado, 0 si nunca) — el admin SOLO edita el número, nunca teclea
  // un nombre de trofeo a mano (evita typos que no casen con el
  // catálogo). Con 0 el trofeo NO aparece en la Sala; con 1 o más sí,
  // mostrando el nº de veces ganado en grande junto al icono.
  // Persistencia (Estado.obtenerTitulosTexto/guardarTitulosTexto) sigue
  // siendo el mismo texto libre de siempre — el formato "Nombre - N" es
  // compatible con datos ya guardados (un nº ya es lo que se guardaba).
  // ============================================================
  var TITULOS_CATEGORIA_LABEL = { club: "🏆 Clubes", individual: "🥇 Individuales", seleccion: "🌍 Selecciones" };
  var TITULOS_CATEGORIA_ORDEN = ["club", "individual", "seleccion"];

  // Palabras de enlace que el admin puede omitir/añadir sin querer decir
  // otro trofeo distinto ("Supercopa España" == "Supercopa de España").
  var _CONECTORES_TITULO = { de: 1, del: 1, la: 1, el: 1, los: 1, las: 1 };
  function _tokensSinConectores(s) {
    return _normNombre(s).split(/\s+/).filter(function (w) { return w && !_CONECTORES_TITULO[w]; }).join(" ");
  }

  function _titulosCatalogoIndexado(datos) {
    var lista = (datos.titulos && datos.titulos.titulos) || [];
    var porId = {}, porNombre = {}, porTokens = {};
    lista.forEach(function (t) {
      porId[t.id] = t;
      porNombre[_normNombre(t.nombre)] = t;
      porTokens[_tokensSinConectores(t.nombre)] = t;
    });
    return { porId: porId, porNombre: porNombre, porTokens: porTokens };
  }

  // Resuelve el trofeo tecleado por el admin contra el catálogo: id
  // exacto -> nombre exacto (normalizado) -> mismas palabras SIN contar
  // conectores de/del/la/el/los/las ("Supercopa España" == "Supercopa de
  // España", "Copa Rey" == "Copa del Rey" — cubre además el dato YA
  // GUARDADO en producción antes de este cambio, que no llevaba "de") ->
  // substring en cualquier dirección (mismo criterio de tolerancia que
  // resolverRivalPorNombre, más arriba). Cada pasada más laxa SOLO se
  // intenta si la anterior no encontró nada, para que "Mundial" no se
  // confunda con "Mundialito de Clubes" ni "Liga" con "Liga Francia".
  function _resolverTitulo(nombreCrudo, indice) {
    if (indice.porId[nombreCrudo]) return indice.porId[nombreCrudo];
    var norm = _normNombre(nombreCrudo);
    if (indice.porNombre[norm]) return indice.porNombre[norm];
    var tokens = _tokensSinConectores(nombreCrudo);
    if (indice.porTokens[tokens]) return indice.porTokens[tokens];
    var claves = Object.keys(indice.porNombre);
    for (var i = 0; i < claves.length; i++) {
      var k = claves[i];
      if (norm.length > 2 && (k.indexOf(norm) !== -1 || norm.indexOf(k) !== -1)) return indice.porNombre[k];
    }
    return null;
  }

  // "Nombre - N" por línea (N = veces ganado). Una línea SIN "- N" es
  // una cabecera/comentario del pre-relleno (ver
  // _construirTextoEdicionTitulos) — se ignora ANTES de intentar
  // resolverla contra el catálogo, así una cabecera como "🏆 Clubes"
  // nunca puede colar por substring contra un trofeo real (p.ej.
  // "Mundialito de Clubes"). N=0 (o no numérico) tampoco emerge — solo
  // 1 o más. Una línea que no case con NINGÚN trofeo del catálogo
  // cerrado se ignora en silencio (mismo criterio que
  // parsearPartidosExtraTexto) — nunca se inventa un trofeo nuevo.
  function parsearTitulosTexto(texto, indice) {
    var items = [];
    (texto || "").split("\n").forEach(function (linea) {
      var l = linea.trim();
      if (!l) return;
      l = l.replace(/^\d+[.)]\s*/, "");
      var partes = l.split(/\s+-\s+/);
      if (partes.length < 2) return;
      var nombreCrudo = partes[0].trim();
      if (!nombreCrudo) return;
      var veces = parseInt(partes[1].trim(), 10);
      if (!veces || veces < 1) return;
      var trofeo = _resolverTitulo(nombreCrudo, indice);
      if (!trofeo) return;
      items.push({ id: trofeo.id, nombre: trofeo.nombre, icono: trofeo.icono, color: trofeo.color, categoria: trofeo.categoria, veces: veces });
    });
    return items;
  }

  function _trofeoCardHtml(t) {
    return (
      '<div class="trofeo-card" style="--trofeo-color:' + _colorInlineSeguro(t.color) + ';">' +
      '<span class="trofeo-icono-wrap">' +
      '<span class="trofeo-veces">' + t.veces + "</span>" +
      '<span class="trofeo-icono">' + t.icono + "</span>" +
      "</span>" +
      '<span class="trofeo-nombre">' + escapeHTML(t.nombre) + "</span>" +
      "</div>"
    );
  }

  function renderizarTitulos(contenedorId, idClubActivo) {
    var contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;
    contenedor.innerHTML = "";
    contenedor.appendChild(nodoEstado("⏳", "Cargando…"));

    cargarTodo().then(function (datos) {
      contenedor.innerHTML = "";

      var header = document.createElement("div");
      header.className = "liga1ref-header";
      header.innerHTML =
        '<span class="liga1ref-leyenda-mini">Trofeos conseguidos como entrenador</span>' +
        '<button type="button" class="liga1ref-editar-btn" data-accion="editar-titulos-inline" data-club-id="' +
        (idClubActivo || "") + '" aria-label="Editar títulos">✏️</button>';
      contenedor.appendChild(header);

      var indice = _titulosCatalogoIndexado(datos);
      var texto = window.Estado ? window.Estado.obtenerTitulosTexto(idClubActivo) : "";
      var ganados = parsearTitulosTexto(texto, indice);

      if (!ganados.length) {
        contenedor.appendChild(nodoEstado("🏆", "Sin títulos todavía. Pulsa ✏️ para poner a cuántos ganaste cada uno."));
        return;
      }

      TITULOS_CATEGORIA_ORDEN.forEach(function (cat) {
        var deEstaCategoria = ganados.filter(function (g) { return g.categoria === cat; });
        if (!deEstaCategoria.length) return;
        var bloque = document.createElement("div");
        bloque.className = "titulos-bloque";
        bloque.innerHTML =
          '<p class="titulos-bloque-titulo">' + TITULOS_CATEGORIA_LABEL[cat] + "</p>" +
          '<div class="titulos-grid">' + deEstaCategoria.map(_trofeoCardHtml).join("") + "</div>";
        contenedor.appendChild(bloque);
      });
    });
  }

  // Construye el pre-relleno del editor: TODOS los trofeos del catálogo
  // cerrado, uno por línea "Nombre - N" (N = veces ya guardadas para ese
  // trofeo, si no 0), agrupados por categoría con una línea de cabecera
  // SIN "-" (nunca puede confundirse con un dato real — ver el guard
  // `partes.length < 2` de parsearTitulosTexto). El admin solo cambia
  // el número tras el guion; nunca teclea un nombre de trofeo a mano.
  function _construirTextoEdicionTitulos(datos, textoGuardado) {
    var indice = _titulosCatalogoIndexado(datos);
    var yaGanados = {};
    parsearTitulosTexto(textoGuardado, indice).forEach(function (g) { yaGanados[g.id] = g.veces; });

    var catalogo = (datos.titulos && datos.titulos.titulos) || [];
    var porCategoria = {};
    catalogo.forEach(function (t) {
      (porCategoria[t.categoria] = porCategoria[t.categoria] || []).push(t);
    });

    var lineas = [];
    TITULOS_CATEGORIA_ORDEN.forEach(function (cat) {
      var lista = porCategoria[cat] || [];
      if (!lista.length) return;
      if (lineas.length) lineas.push("");
      lineas.push(TITULOS_CATEGORIA_LABEL[cat]);
      lista.forEach(function (t) {
        lineas.push(t.nombre + " - " + (yaGanados[t.id] || 0));
      });
    });
    return lineas.join("\n");
  }

  // Editor inline, sin PIN — el admin solo puede tocar el número de un
  // catálogo CERRADO ya pre-rellenado (no hay nombre libre que teclear
  // mal ni trofeo inventado posible), así que no hace falta protegerlo
  // como el resto de editores de texto libre.
  function pintarEditorTitulos(contenedor, idClubActivo) {
    contenedor.innerHTML = "";
    contenedor.appendChild(nodoEstado("⏳", "Cargando…"));

    cargarTodo().then(function (datos) {
      contenedor.innerHTML = "";

      var nota = document.createElement("p");
      nota.className = "admin-nota";
      nota.textContent =
        "Ahí abajo están TODOS los trofeos posibles, cada uno con su número a 0. Solo tienes " +
        "que cambiar el número de los que hayas ganado (cuántas veces) — con 0 no aparece en tu " +
        "Sala de Títulos, con 1 o más sí.";
      contenedor.appendChild(nota);

      var textoGuardado = window.Estado ? window.Estado.obtenerTitulosTexto(idClubActivo) : "";
      var textarea = document.createElement("textarea");
      textarea.id = "titulos-textarea";
      textarea.className = "admin-roadmap-textarea";
      textarea.rows = 26;
      textarea.value = _construirTextoEdicionTitulos(datos, textoGuardado);
      contenedor.appendChild(textarea);

      var acciones = document.createElement("div");
      acciones.className = "admin-roadmap-editor-acciones";
      acciones.innerHTML =
        '<button type="button" class="btn-ghost" data-accion="cancelar-titulos" data-club-id="' + (idClubActivo || "") + '">✕ Cancelar</button>' +
        '<button type="button" class="admin-list-add-btn" data-accion="guardar-titulos" data-club-id="' + (idClubActivo || "") + '">💾 Guardar</button>';
      contenedor.appendChild(acciones);
    });
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

    // `partido.competicion` de un partido REAL ya es el compKey interno
    // ("liga", "copa"...), pero el de un partido del "Calendario extra"
    // (ver parsearPartidosExtraTexto) es texto LIBRE tecleado por el
    // admin ("Champions League", "Copa Intercontinental"...). Reusamos
    // el MISMO alias que ya normaliza esos nombres para el balón
    // (_resolverCompKeyBalon, más arriba) — así una competición extra
    // también sale con su color real, no siempre en gris "comp-otro".
    var compKeyResuelto = _resolverCompKeyBalon(partido.competicion);

    // La misma clase .comp-XXX tiñe el borde de la card ENTERA (abajo)
    // y la etiqueta interior (más abajo, en el innerHTML) — mismo color
    // en los dos sitios, a petición del usuario. Un partido ya jugado
    // (--gano/--empate/--perdio) o el próximo a jugar (--siguiente)
    // siguen mandando sobre este color de competición — están
    // declarados DESPUÉS en el CSS a propósito (ver css/estilos.css).
    var claseComp = _claseComp(compKeyResuelto);
    card.className = "match-card" + (claseComp ? " " + claseComp : "") +
      (partido.jugado ? " is-played" : "") + claseResultado + (esSiguiente ? " match-card--siguiente" : "");
    card.dataset.partidoId = partido.id;

    var compLabel = COMP_LABEL[compKeyResuelto] || partido.competicion;
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
        var partidosExtra = parsearPartidosExtraTexto(textoExtra, equipo.nombre).map(function (ex, i) {
          var rival = resolverRivalPorNombre(ex.rivalNombre, datos, equipo.ligaActual);
          // ex.esVisitante decide qué id va en local/visitante; el marcador
          // (siempre guardado como "club-rival") se remapea al mismo orden.
          var p = {
            id: ex.id,
            competicion: ex.competicion,
            ronda: ex.ronda,
            jornada: null,
            local: ex.esVisitante ? rival.id : idEquipoHumanoActivo,
            visitante: ex.esVisitante ? idEquipoHumanoActivo : rival.id,
            fecha: null,
            _fechaTexto: ex.fecha,
            _fechaFallbackMs: ahoraMs + i * 86400000,
            jugado: ex.jugado,
            resultado: ex.jugado ? {
              golesLocal: ex.esVisitante ? ex.golesRival : ex.golesClub,
              golesVisitante: ex.esVisitante ? ex.golesClub : ex.golesRival
            } : null
          };
          // Si el admin ya lo jugó EN VIVO desde "▶ Empezar partido" (en vez
          // de escribir el marcador a mano en el texto), ese resultado
          // confirmado (Estado.registrarResultadoPartido) manda sobre lo que
          // diga el texto — mismo criterio de superposición que
          // Estado.listarPartidosResueltos usa para los partidos base.
          var override = window.Estado && window.Estado.obtenerResultadoOverride
            ? window.Estado.obtenerResultadoOverride(ex.id) : null;
          if (override) {
            p.jugado = override.jugado;
            p.resultado = { golesLocal: override.golesLocal, golesVisitante: override.golesVisitante };
            p.eventos = override.eventos;
          }
          return p;
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
  // FORMA / NIVEL / TIEMPO — datos "de referencia" del partido en la
  // PANTALLA DE PREVIA (Fase 4). Es una tabla FIJA, editable solo por
  // código (nunca desde la UI) — mismo criterio que estadio/balón fijo.
  // ============================================================
  var _NIVEL_LEYENDA_ID = "atletico-madrid"; // único club humano en nivel "Leyenda"
  var _FORMA_POR_CLUB = {
    liverpool: { icono: "⬇️", label: "En bajón" },
    arsenal: { icono: "↘️", label: "Irregular" },
    "real-madrid": { icono: "🎲", label: "Impredecible" },
    "atletico-madrid": { icono: "↗️", label: "En racha" },
    "fc-barcelona": { icono: "⬆️", label: "Gran momento" },
    psg: { icono: "➡️", label: "Estable" }
  };
  function _esClubHumano(id, datos) {
    return (datos.equipos.equipos || []).some(function (e) { return e.id === id; });
  }

  // Determina qué lado del partido es "el equipo gestionado" (la caja
  // humana cuyo calendario está abierto) y cuál es "el rival" — Tiempo,
  // Nivel y Forma se calculan SIEMPRE en función del gestionado, sea
  // local o visitante en ESTE partido concreto.
  function _resolverGestionadoYRival(local, visitante, contexto) {
    var managedId = contexto && contexto.equipo ? contexto.equipo.id : null;
    if (visitante.id === managedId) return { managed: visitante, rival: local };
    return { managed: local, rival: visitante }; // default: cubre el caso normal + cualquier id inesperado
  }

  // Los 3 valores ya llevan el emoji horneado dentro del string (sin
  // etiqueta de texto ni palabra descriptiva — petición usuario: solo
  // emoji + valor corto, en una línea horizontal única en la previa).
  function _calcularMetaPartido(local, visitante, datos, contexto) {
    var par = _resolverGestionadoYRival(local, visitante, contexto);
    var rivalEsHumano = _esClubHumano(par.rival.id, datos);
    var forma = _FORMA_POR_CLUB[par.managed.id];
    var formaIcono = rivalEsHumano ? "🎲" : (forma ? forma.icono : "➡️");
    return {
      tiempo: "⏱️" + (rivalEsHumano ? "10 min" : "8 min"),
      nivel: "🤖" + (par.managed.id === _NIVEL_LEYENDA_ID ? "Leyenda" : "Crack"),
      forma: "🔋" + formaIcono
    };
  }

  // Modo de la eliminatoria, deducido del texto libre que el admin
  // escribe en "Calendario extra" (competición/ronda) o, si algún día
  // vuelve a poblarse data/partidos.json con el campo `eliminatoria` de
  // sistema-temporadas.js, de ese campo. El modo "desempate" (tercer
  // partido 0-0) cae dentro de "eliminatoria-unica" a propósito — ya
  // resuelve sus penaltis leyendo el acta (ver sistema-temporadas.js).
  function detectarModoPartido(partido) {
    if (partido.competicion && _normNombre(partido.competicion) === "liga") return "liga";
    if (partido.eliminatoria && (partido.eliminatoria.fase === "ida" || partido.eliminatoria.fase === "vuelta")) return "ida-vuelta";
    var rondaNorm = _normNombre(partido.ronda || "");
    if (/\bida\b/.test(rondaNorm) || /\bvuelta\b/.test(rondaNorm) || /\bvta\b/.test(rondaNorm)) return "ida-vuelta";
    return "eliminatoria-unica";
  }

  // Listas de 🚑 Lesionados / 🟨 Sancionados del club GESTIONADO (persisten
  // por club en localStorage, no por partido concreto — sobreviven al
  // recargar y a cambiar de rival). Viven en la PREVIA (pantalla
  // informativa), no en la pantalla en vivo — se consultan ANTES de
  // empezar el partido.
  function _filaJugadorLista(nombre, tipo, indice) {
    return (
      '<div class="live-acta-item"><span class="live-acta-jugador">' + escapeHTML(nombre) + "</span>" +
      '<button type="button" class="live-acta-del" data-tipo-lista="' + tipo + '" data-indice="' + indice + '" aria-label="Quitar">✕</button></div>'
    );
  }
  function _renderListaJugadores(tipo, contId, vacioTxt) {
    var cont = document.getElementById(contId);
    if (!cont || !window._idManagerActivo || !window.Estado) return;
    var lista = window.Estado.obtenerListaJugadores(window._idManagerActivo, tipo);
    cont.innerHTML = lista.length
      ? lista.map(function (nombre, i) { return _filaJugadorLista(nombre, tipo, i); }).join("")
      : '<div class="live-acta-vacia">' + vacioTxt + "</div>";
  }
  function renderListasJugadores() {
    _renderListaJugadores("lesionados", "previa-lesionados-lista", "Sin lesionados registrados.");
    _renderListaJugadores("sancionados", "previa-sancionados-lista", "Sin sancionados registrados.");
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
    var estadio = obtenerEstadioDelEquipo(local);

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

    var metaPartido = _calcularMetaPartido(local, visitante, datos, _ultimoContexto);
    document.getElementById("previa-tiempo").textContent = metaPartido.tiempo;
    document.getElementById("previa-nivel").textContent = metaPartido.nivel;
    document.getElementById("previa-forma").textContent = metaPartido.forma;

    renderListasJugadores();

    // El motor en vivo (js/acta.js) nunca necesitó el roster del rival —
    // el desplegable de jugador solo se muestra para el lado HUMANO
    // (poblarSelectJugador), así que un rival sin roster (cualquier
    // "Calendario extra": real o sintético) se juega en vivo exactamente
    // igual que uno del fixture base. Solo se oculta si ya está jugado.
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
      "Mueve las tarjetas arriba/abajo con las flechas y edita su nombre/icono " +
      "con ✏️ — incluidas las de fábrica (↺ las devuelve a su nombre/icono " +
      "original). Las de fábrica no se pueden borrar; las que añadas tú sí.";
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
      var subEtiqueta = t.esCustom ? "Añadida por ti" : (t.esFabricaEditada ? "De fábrica (editada)" : "De fábrica");
      var fila = document.createElement("div");
      fila.className = "admin-list-item";
      fila.innerHTML =
        '<div class="admin-list-item-main">' +
        '<span class="admin-list-item-title">' + escapeHTML(t.icono) + " " + escapeHTML(t.etiqueta) + "</span>" +
        '<span class="admin-list-item-sub">' + subEtiqueta + "</span>" +
        "</div>" +
        '<div class="admin-list-item-actions">' +
        '<button type="button" class="admin-list-item-btn" data-accion="mover-tarjeta-menu-club" data-club-id="' + clubId +
        '" data-id="' + t.id + '" data-direccion="-1"' + (i === 0 ? " disabled" : "") + ' aria-label="Subir">▲</button>' +
        '<button type="button" class="admin-list-item-btn" data-accion="mover-tarjeta-menu-club" data-club-id="' + clubId +
        '" data-id="' + t.id + '" data-direccion="1"' + (i === tarjetas.length - 1 ? " disabled" : "") + ' aria-label="Bajar">▼</button>' +
        '<button type="button" class="admin-list-item-btn" data-accion="editar-tarjeta-menu-club" data-club-id="' + clubId +
        '" data-id="' + t.id + '" data-icono="' + escapeHTML(t.icono) + '" data-etiqueta="' + escapeHTML(t.etiqueta) +
        '" aria-label="Editar">✏️</button>' +
        (t.esFabricaEditada
          ? '<button type="button" class="admin-list-item-btn" data-accion="restablecer-tarjeta-menu-club" data-club-id="' + clubId +
            '" data-id="' + t.id + '" data-nombre="' + escapeHTML(t.etiqueta) + '" aria-label="Restablecer de fábrica">↺</button>'
          : "") +
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
      "Una línea por partido: «Competición - Ronda - Rival». Por defecto juegas " +
      "en casa; para jugar fuera escribe «Rival vs Tu Equipo» (en vez de «Tu " +
      "Equipo vs Rival») o añade «(visitante)» al final. Puedes añadir la fecha " +
      "(«... - Rival - 15 sep») y, si ya se jugó, el resultado pegado al rival — " +
      "SIEMPRE tu gol primero, el del rival segundo, juegues en casa o fuera: " +
      "«Rival (2-1)». Se suma al calendario de la derecha sin tocar los partidos " +
      "ya programados.";
    contenedor.appendChild(nota);

    var textarea = document.createElement("textarea");
    textarea.id = "calendario-extra-club-textarea";
    textarea.className = "admin-roadmap-textarea";
    textarea.rows = 10;
    textarea.placeholder = "Champions League - Jornada 1 - Bayern Munich - 15 sep\nCopa del Rey - Octavos - Real Sociedad (3-1)\nLiga - Jornada 3 - Real Zaragoza vs Tu Equipo";
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
  // Columna de estadística "principal" de cada grupo — porteros suman
  // porterías imbatidas (🧤), el resto suma goles (⚽) — + MVP/amarilla/
  // roja, iguales para las 4 posiciones. Ver calcularStatsRosterClub.
  var ICONOS_STAT_POSICION = {
    POR: ["🧤", "⭐", "🟨", "🟥"],
    DEF: ["⚽", "⭐", "🟨", "🟥"],
    MED: ["⚽", "⭐", "🟨", "🟥"],
    DEL: ["⚽", "⭐", "🟨", "🟥"]
  };
  var _ROSTER_POS_MAP = { por: "POR", def: "DEF", med: "MED", del: "DEL" };

  // Parsea el texto libre pegado por el admin (una línea por jugador):
  // "#<dorsal> <Nombre> (Por|Def|Med|Del)", con un emoji delante opcional
  // y puramente decorativo (🧤 en los porteros del ejemplo del usuario,
  // ignorado al parsear — la posición SIEMPRE sale del paréntesis final).
  // Sin esqueleto fijo detrás: el nº de jugadores por posición es el que
  // traiga el texto pegado. Una línea que no case con el formato, o un
  // dorsal repetido, se ignora en silencio — mismo criterio que el resto
  // de parsers de texto libre de esta app (Calendario extra, Títulos).
  function parsearRosterTexto(texto, clubId) {
    var items = [];
    var vistos = {};
    String(texto || "").split("\n").forEach(function (linea) {
      var l = linea.trim();
      if (!l) return;
      var m = l.match(/#\s*(\d+)\s+(.+?)\s*\(\s*(por|def|med|del)\s*\)\s*$/i);
      if (!m) return;
      var dorsal = Number(m[1]);
      var nombre = m[2].trim();
      var posicion = _ROSTER_POS_MAP[m[3].toLowerCase()];
      if (!nombre || !posicion || vistos[dorsal]) return;
      vistos[dorsal] = true;
      items.push({ id: clubId + "-" + dorsal, dorsal: dorsal, nombre: nombre, posicion: posicion });
    });
    items.sort(function (a, b) { return a.dorsal - b.dorsal; });
    return items;
  }

  // Plantilla REAL de un club — fuente ÚNICA para la pantalla "Plantilla"
  // (solo lectura), el editor (candado 646), el selector de jugador del
  // acta en vivo (js/acta.js) y el picker de Lesionados/Sancionados de
  // la previa: los 4 leen siempre el mismo texto libre pegado por el
  // admin (window.Estado.obtenerRosterTexto/guardarRosterTexto).
  function obtenerJugadoresClub(clubId) {
    var texto = window.Estado ? window.Estado.obtenerRosterTexto(clubId) : "";
    return parsearRosterTexto(texto, clubId);
  }

  // El portero "titular" a efectos de porterías imbatidas: el primero
  // (por dorsal) de la plantilla con posición POR. Sin plantilla de
  // porteros todavía, ese club simplemente no aporta ninguna — nunca se
  // inventa un nombre. Mismo criterio ya usado para la Zamora de Liga
  // 1ª REF (ver _liga1RefPorteroPrincipal, más abajo).
  function _porteroPrincipalClub(clubId) {
    var porteros = obtenerJugadoresClub(clubId).filter(function (j) { return j.posicion === "POR"; });
    return porteros.length ? porteros[0] : null;
  }

  // Estadísticas de CADA jugador de la plantilla, sumadas de TODOS los
  // partidos ya jugados de CUALQUIER competición (Liga + Copa + lo que
  // sea) — no por separado. Misma fuente que Liga 1ª REF
  // (window.Estado.listarPartidosResueltos), filtrada a los eventos
  // es_humano:true de ESTE club — un partido HvH trae eventos de ambos
  // lados, cada club solo suma los suyos (equipo_id). Las porterías
  // imbatidas se atribuyen SIEMPRE al portero principal del club (no hay
  // forma de saber quién jugó cada partido concreto sin añadir un evento
  // manual nuevo) — mismo criterio que la Zamora de Liga 1ª REF.
  function calcularStatsRosterClub(clubId, datos) {
    var stats = {};
    function fila(id) {
      if (!stats[id]) stats[id] = { goles: 0, amarillas: 0, rojas: 0, mvp: 0, porteriaImbatida: 0 };
      return stats[id];
    }
    var ES_GOL = { GOL: 1, GOL_FAV_FALTA: 1, PENALTI_GOL: 1 };
    var partidos = (window.Estado ? window.Estado.listarPartidosResueltos(datos) : []).filter(function (p) {
      return p.jugado && (p.local === clubId || p.visitante === clubId);
    });

    partidos.forEach(function (p) {
      (p.eventos || []).forEach(function (ev) {
        if (!ev.es_humano || !ev.jugador_id || ev.equipo_id !== clubId) return;
        var f = fila(ev.jugador_id);
        if (ES_GOL[ev.tipo]) f.goles++;
        else if (ev.tipo === "MVP") f.mvp++;
        else if (ev.tipo === "AMARILLA") f.amarillas++;
        else if (ev.tipo === "ROJA") f.rojas++;
      });
    });

    var portero = _porteroPrincipalClub(clubId);
    if (portero) {
      var f2 = fila(portero.id);
      partidos.forEach(function (p) {
        if (!p.resultado) return;
        var encajados = p.local === clubId ? p.resultado.golesVisitante
          : p.visitante === clubId ? p.resultado.golesLocal : null;
        if (encajados === 0) f2.porteriaImbatida++;
      });
    }

    return stats;
  }

  function renderizarPlantillaClub(idEquipoHumanoActivo) {
    var contenedor = document.getElementById("plantilla-content");
    if (!contenedor) return;

    contenedor.innerHTML = "";
    contenedor.appendChild(nodoEstado("⏳", "Cargando plantilla…"));

    cargarTodo()
      .then(function (datos) {
        contenedor.innerHTML = "";
        var jugadores = obtenerJugadoresClub(idEquipoHumanoActivo);

        if (!jugadores.length) {
          contenedor.appendChild(nodoEstado("👕", "Todavía no hay plantilla. Pulsa ✏️ Editar menú → 👕 Plantilla para pegarla."));
          return;
        }

        var stats = calcularStatsRosterClub(idEquipoHumanoActivo, datos);
        function statsDe(j) {
          return stats[j.id] || { goles: 0, amarillas: 0, rojas: 0, mvp: 0, porteriaImbatida: 0 };
        }

        var frag = document.createDocumentFragment();
        ORDEN_POSICIONES.forEach(function (pos) {
          var deEstaPos = jugadores.filter(function (j) { return j.posicion === pos; });
          if (!deEstaPos.length) return;

          var iconos = ICONOS_STAT_POSICION[pos] || ["⚽", "⭐", "🟨", "🟥"];
          var grupo = document.createElement("div");
          grupo.className = "plantilla-grupo";

          var titulo = document.createElement("div");
          titulo.className = "plantilla-grupo-titulo";
          titulo.innerHTML =
            '<span class="plantilla-grupo-nombre">' + (LABEL_POSICION[pos] || pos) + " · " + deEstaPos.length + "</span>" +
            '<span class="plantilla-grupo-iconos"><span>' + iconos.join("</span><span>") + "</span></span>";
          grupo.appendChild(titulo);

          deEstaPos.forEach(function (j) {
            var s = statsDe(j);
            var principal = pos === "POR" ? s.porteriaImbatida : s.goles;
            var fila = document.createElement("div");
            fila.className = "plantilla-jugador";
            fila.innerHTML =
              '<span class="plantilla-dorsal">' + j.dorsal + "</span>" +
              '<span class="plantilla-nombre">' + escapeHTML(j.nombre) + "</span>" +
              '<span class="plantilla-stat">' + principal + "</span>" +
              '<span class="plantilla-stat">' + s.mvp + "</span>" +
              '<span class="plantilla-stat">' + s.amarillas + "</span>" +
              '<span class="plantilla-stat">' + s.rojas + "</span>";
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

  // Editor de la PLANTILLA — un único textarea con la plantilla real
  // ENTERA del club (mismo patrón que Calendario extra/Títulos: texto
  // libre, se guarda tal cual, se reinterpreta con parsearRosterTexto en
  // cada render). El admin pega/edita la lista completa de golpe — no
  // hay huecos fijos que rellenar, el nº de jugadores por posición sale
  // de lo que traiga el texto.
  function pintarEditorPlantillaClub(clubId, contenedor) {
    contenedor.innerHTML = "";

    var nota = document.createElement("p");
    nota.className = "admin-nota";
    nota.textContent =
      "Una línea por jugador: «#Dorsal Nombre (Posición)» — Posición es Por/Def/Med/Del. " +
      "Pega la plantilla real completa; estos jugadores son los que aparecen en la Plantilla " +
      "del club, en el selector de jugador del acta en vivo y al elegir a quién dar de baja " +
      "por lesión o sanción.";
    contenedor.appendChild(nota);

    var textarea = document.createElement("textarea");
    textarea.id = "plantilla-club-textarea";
    textarea.className = "admin-roadmap-textarea";
    textarea.rows = 22;
    textarea.placeholder = "🧤#1 Alisson (Por)\n#4 V. Van Dijk (Def)\n#8 D. Szoboszlai (Med)\n#9 Alexander Isak (Del)";
    textarea.value = window.Estado ? window.Estado.obtenerRosterTexto(clubId) : "";
    contenedor.appendChild(textarea);

    var acciones = document.createElement("div");
    acciones.className = "admin-roadmap-editor-acciones";
    acciones.innerHTML =
      '<button type="button" class="btn-ghost" data-accion="cancelar-plantilla-club" data-club-id="' + clubId + '">✕ Cancelar</button>' +
      '<button type="button" class="admin-list-add-btn" data-accion="guardar-plantilla-club" data-club-id="' + clubId + '">💾 Guardar</button>';
    contenedor.appendChild(acciones);
  }

  // Picker de jugador REAL (reemplaza el window.prompt() de texto libre)
  // para "➕ Añadir" en Lesionados/Sancionados de la previa. Se pinta
  // DENTRO del propio contenedor de la lista — reutiliza `.live-select`
  // (0 KB de CSS nuevo salvo el layout de la fila) y desaparece solo al
  // confirmar/cancelar porque `renderListasJugadores()` vuelve a pintar
  // el contenido real de la lista encima.
  function _abrirPickerJugadorLista(tipoLista) {
    var contId = tipoLista === "lesionados" ? "previa-lesionados-lista" : "previa-sancionados-lista";
    var cont = document.getElementById(contId);
    if (!cont || !window._idManagerActivo || !_ultimoContexto) return;

    var jugadores = obtenerJugadoresClub(window._idManagerActivo);
    if (!jugadores.length) {
      window.alert("Este club todavía no tiene plantilla. Pégala desde ✏️ Editar menú → 👕 Plantilla.");
      return;
    }

    var opciones = jugadores
      .map(function (j) {
        var etiqueta = j.dorsal + " · " + j.nombre;
        return '<option value="' + escapeHTML(j.nombre) + '">' + escapeHTML(etiqueta) + "</option>";
      })
      .join("");

    cont.innerHTML =
      '<div class="live-lista-picker">' +
      '<select id="lista-picker-select" class="live-select">' + opciones + "</select>" +
      '<button type="button" class="live-lista-add" data-accion-picker="confirmar" data-tipo-lista="' + tipoLista + '">✓</button>' +
      '<button type="button" class="live-lista-add" data-accion-picker="cancelar" data-tipo-lista="' + tipoLista + '">✕</button>' +
      "</div>";
  }

  // Placeholder plano para los botones del menú del club que todavía no
  // existen como subsistema real en este simulador ligero (Derbys,
  // Objetivos, Copa del Rey, Superliga pertenecen a OTRA app mucho más
  // grande — no se inventan datos falsos aquí). Títulos ya SÍ es real
  // (ver renderizarTitulos, catálogo cerrado data/titulos.json).
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
      return;
    }

    if (ev.target.id === "previa-lesionado-add" || ev.target.id === "previa-sancionado-add") {
      var tipoLista = ev.target.id === "previa-lesionado-add" ? "lesionados" : "sancionados";
      _abrirPickerJugadorLista(tipoLista);
      return;
    }

    var pickerBtn = ev.target.closest && ev.target.closest("[data-accion-picker]");
    if (pickerBtn) {
      var tipoPicker = pickerBtn.dataset.tipoLista;
      if (pickerBtn.dataset.accionPicker === "confirmar") {
        var selJugador = document.getElementById("lista-picker-select");
        var nombreElegido = selJugador ? selJugador.value : "";
        if (nombreElegido && window._idManagerActivo && window.Estado) {
          window.Estado.agregarJugadorALista(window._idManagerActivo, tipoPicker, nombreElegido);
        }
      }
      renderListasJugadores();
      return;
    }

    var delBtnLista = ev.target.closest && ev.target.closest(".live-acta-del[data-tipo-lista]");
    if (delBtnLista && window._idManagerActivo && window.Estado) {
      window.Estado.quitarJugadorDeLista(window._idManagerActivo, delBtnLista.dataset.tipoLista, Number(delBtnLista.dataset.indice));
      renderListasJugadores();
      return;
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
    obtenerEstadioDelEquipo: obtenerEstadioDelEquipo,
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
    obtenerJugadoresClub: obtenerJugadoresClub,
    parsearRosterTexto: parsearRosterTexto,
    calcularStatsRosterClub: calcularStatsRosterClub,
    pintarEditorPlantillaClub: pintarEditorPlantillaClub,
    renderizarLiga1RefClasificacion: renderizarLiga1RefClasificacion,
    pintarEditorLiga1Ref: pintarEditorLiga1Ref,
    renderizarLiga1RefStatDetalle: renderizarLiga1RefStatDetalle,
    pintarEditorLiga1RefStat: pintarEditorLiga1RefStat,
    parsearLiga1RefTexto: parsearLiga1RefTexto,
    calcularLiga1RefCombinada: calcularLiga1RefCombinada,
    renderizarTitulos: renderizarTitulos,
    pintarEditorTitulos: pintarEditorTitulos,
    parsearTitulosTexto: parsearTitulosTexto,
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
    detectarModoPartido: detectarModoPartido,
    cargarTodo: cargarTodo,
    buscarEquipoPorId: buscarEquipoPorId,
    crearEscudoHTML: crearEscudoHTML,
    formatFecha: formatFecha,
    COMP_LABEL: COMP_LABEL,
    TOTAL_JORNADAS_POR_LIGA: TOTAL_JORNADAS_POR_LIGA
  };
})();
