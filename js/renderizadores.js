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
    // Superliga: condición FIJA de la competición (petición usuario) —
    // siempre ☀️ Soleado, nunca entra en el motor estacional aleatorio.
    if (partido.competicion === "superliga") {
      return { estacion: "VERANO", clima: "sol", icono: "☀️", label: "Soleado" };
    }
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
    promocion: "promocion", "promocion de ascenso": "promocion", "promocion de descenso": "promocion",
    "promocion ascenso": "promocion", "promocion descenso": "promocion",
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
  // más abajo) — nunca persiste en ningún JSON, se repuebla en cada
  // llamada a Estado.listarPartidosResueltos() (que resuelve el
  // Calendario extra de los 6 humanos, no solo el que se esté pintando
  // ahora mismo — ver estado.js::_partidosExtraDeTodosLosClubes), así
  // que buscarEquipoPorId() siempre encuentra el rival sintético que
  // necesite, venga la llamada del calendario, la clasificación o
  // cualquier estadística.
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
  // previa/acta en vivo. Si el equipo trae `crest` (URL real — los 6
  // humanos: 5 reusan los SVG que ya sirve la app Flask hermana en
  // /static/img/escudos-*/, el del PSG es un vector propio en el mismo
  // sitio; cero KB nuevos en ningún caso), se pinta la imagen real sobre
  // un fondo claro para que se lea con contraste. Sin `crest` (los 300+
  // equipos IA) cae al blasón CSS de siempre — nunca se rompe nada para
  // un equipo sin imagen todavía.
  function crearEscudoHTML(equipo, claseTamano) {
    if (!equipo) return '<div class="escudo escudo--ia ' + claseTamano + '"></div>';

    // Rival TODAVÍA no sorteado (el admin tecleó "?" en vez de un nombre,
    // p.ej. el visitante de una semifinal de Copa que depende de OTRA
    // eliminatoria sin jugar) — ver resolverRivalPorNombre. Nada de rombo
    // ni color hash aleatorio: un cuadro negro liso con ❓️, 0 KB nuevos
    // (mismo <div>.escudo de siempre, solo cambia el contenido/clase).
    if (equipo.desconocido) {
      return (
        '<div class="escudo escudo--desconocido ' + claseTamano + '">' +
        '<span class="escudo-siglas">❓️</span>' +
        "</div>"
      );
    }

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
  // siempre coincide con el tema real del club — así que vive en su propio
  // mapa, sin tocar el tema compartido. `secundario` cae en el lado del
  // texto (0%, más oscuro para que el nombre en blanco se lea bien);
  // `primario` es el color que asoma limpio en la esquina opuesta.
  //
  // `primario: "#ffffff"` (Arsenal/Atlético/Real Madrid, versión anterior)
  // se veía "genérico" porque `.team-box::before` interpola ese tramo
  // contra `--bg-1` (casi negro) — negro→blanco es una rampa DE GRIS PURO,
  // así que la mitad de la caja perdía todo el color del club por mucho
  // que `secundario` fuera vivo. Fix (petición usuario, degradados por
  // escudo real): Arsenal y Real Madrid pasan a un 2º tono DENTRO de la
  // familia de color del club (nunca blanco) para que la caja entera se
  // lea con su color — rojo vibrante → burdeos (Arsenal), púrpura
  // heráldico → dorado del monograma (Real Madrid).
  //
  // Atlético Madrid tuvo una 1ª versión con franjas rojo/blanco
  // ALTERNAS cubriendo TODA la caja — el usuario la rechazó ("ese
  // degradado hace que ni se vea", el nombre del club quedaba ilegible
  // encima de tantas franjas). Ahora `secundario`/`primario` son el rojo
  // y el azul marino REALES del club (mismos valores que
  // colorPrimario/colorSecundario en data/equipos.json) en un degradado
  // normal — las franjas blancas se reducen a solo 2, encajadas como
  // acento en el extremo derecho del todo (ver
  // `.team-box[data-team-id="atletico-madrid"]::before` en
  // css/estilos.css), dejando el resto de la caja (donde va el nombre)
  // como un degradado liso rojo→azul, legible.
  //
  // Liverpool (escudo monocromático, sin más colores que sacar de él):
  // `secundario` (0%, lado del texto) es el rojo carmesí REAL del
  // Liverbird/las letras "L.F.C." (mismo `#c8102e` ya usado como
  // colorPrimario en data/equipos.json — reutilizado, cero valores
  // nuevos inventados); `primario` (100%, esquina opuesta) es negro con
  // un ligero tinte granate para dar profundidad sin caer en gris puro
  // (0 KB — solo 2 valores hex, igual que el resto de este mapa).
  var CAJA_INICIO_COLORES = {
    arsenal: { primario: "#7a1024", secundario: "#ef0107" },
    "atletico-madrid": { primario: "#192c5b", secundario: "#cb3524" },
    "real-madrid": { primario: "#e3b13c", secundario: "#5b2c8c" },
    liverpool: { primario: "#170406", secundario: "#c8102e" }
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
    selecciones: "Selecciones", "sel-clasif": "Selecciones · Clasif.",
    superliga: "Superliga"
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
    selecciones: "comp-selecciones", "sel-clasif": "comp-selecciones",
    superliga: "comp-superliga"
  };
  function _claseComp(competicion) {
    return COMP_CLASE.hasOwnProperty(competicion) ? COMP_CLASE[competicion] : "comp-otro";
  }

  // Competiciones de ELIMINACIÓN DIRECTA (partido único o eliminatoria, sin
  // fase de grupos): perder aquí saca del cuadro entero, y una ronda NUNCA
  // se puede jugar sin haber ganado antes la anterior (petición usuario:
  // "hasta que el Atlético Madrid no elimine en 1/64 al AD Mérida no puede
  // jugar los Dieciseisavos" — y lo mismo en Supercopa de España y en la
  // Promoción de ascenso/descenso). Un futuro playoff que cumpla lo mismo
  // se añade aquí sin más — NUNCA un torneo con fase de grupos (ahí perder
  // un partido no elimina, y las jornadas no dependen de ganar la anterior).
  var COMPS_ELIMINACION_DIRECTA = { copa: true, supercopa: true, promocion: true };

  // ¿Esta "ronda" es UNA de las 2 legs de una eliminatoria ida+vuelta
  // ("Ida", "Vuelta", "Ida Semifinal", "Promoción · Vuelta"...)? Y su base
  // (el texto sin la palabra ida/vuelta) para poder emparejar la ida con
  // su vuelta exacta, sea cual sea el resto del texto que haya alrededor.
  function _rondaEsIdaOVuelta(ronda) {
    var n = _normNombre(ronda || "");
    return /\bida\b/.test(n) || /\bvuelta\b/.test(n);
  }
  function _rondaBaseSinLeg(ronda) {
    return _normNombre(ronda || "").replace(/\bida\b/g, "").replace(/\bvuelta\b/g, "").replace(/\s+/g, " ").trim();
  }

  // ¿El rival de este partido (visto desde `clubId`) es "?" — todavía sin
  // determinar (ver crearEscudoHTML/resolverRivalPorNombre)? Señal SIEMPRE
  // válida de "no hay PREVIA real que abrir", en CUALQUIER competición —
  // no depende de COMPS_ELIMINACION_DIRECTA ni de ningún cálculo por orden
  // de ronda.
  function _rivalDesconocido(p, clubId, datos) {
    var esLocalP = p.local === clubId;
    var rival = buscarEquipoPorId(esLocalP ? p.visitante : p.local, datos);
    return !!(rival && rival.desconocido);
  }

  // Dado el listado de partidos de UNA sola competición de eliminación
  // directa para UN club, YA ordenado cronológicamente (mismo criterio que
  // el resto de la app: fecha real, o el fallback _fechaFallbackMs/orden
  // del texto), calcula qué rondas quedan:
  //  - eliminadas: el club ya cayó en una ronda/eliminatoria anterior — no
  //    hay nada real que jugar (se pinta apagada, "Eliminado").
  //  - bloqueadas: el club SIGUE vivo pero la ronda anterior aún no está
  //    jugada/ganada — no se puede adelantar (se pinta con 🔒).
  // La PRIMERA ronda sin jugar de la lista es siempre la única jugable
  // (nunca se bloquea a sí misma); cualquier ronda posterior sí, hasta que
  // esa se resuelva. Una ida+vuelta (2 líneas consecutivas con la MISMA
  // ronda salvo "ida"/"vuelta") se trata como UNA sola eliminatoria: solo
  // el marcador AGREGADO de las 2 legs decide si el club sigue vivo —
  // perder la ida sola NUNCA elimina (regla de la propia Copa: gol doble
  // fuera de casa / desempate), y la vuelta se desbloquea en cuanto la ida
  // esté jugada, gane o pierda. 0 KB nuevos en localStorage — se recalcula
  // en cada render a partir de los mismos partidos que ya se pintaban.
  function _estadoRondasEliminacion(partidos, clubId) {
    var eliminado = false, pendiente = false;
    var eliminadoIds = {}, bloqueadoIds = {};
    var i = 0;
    while (i < partidos.length) {
      var p = partidos[i];
      if (eliminado) { eliminadoIds[p.id] = true; i++; continue; }

      // El emparejamiento ida+vuelta funciona igual con o sin texto extra
      // en la ronda ("Ida Semifinal"/"Vuelta Semifinal" en Copa, o el "IDA"/
      // "VUELTA" a secas de Promoción — ambos reducen a la misma base tras
      // quitar la palabra ida/vuelta, incluida una base vacía).
      var unidad = [p];
      var pSig = partidos[i + 1];
      if (pSig && _rondaEsIdaOVuelta(p.ronda) && _rondaEsIdaOVuelta(pSig.ronda) && _rondaBaseSinLeg(p.ronda) === _rondaBaseSinLeg(pSig.ronda)) {
        unidad.push(pSig);
      }

      var jugados = unidad.filter(function (m) { return m.jugado && m.resultado; });
      if (jugados.length === unidad.length) {
        // Unidad COMPLETA: decide el marcador AGREGADO (1 leg = su propio
        // resultado; 2 legs = la suma de ambas). Un empate en el agregado
        // no elimina — lo resuelve el propio marcador que teclee el admin
        // (gol de oro/penaltis), no este cálculo.
        var golesClubTot = 0, golesRivalTot = 0;
        unidad.forEach(function (m) {
          var esLocal = m.local === clubId;
          golesClubTot += esLocal ? m.resultado.golesLocal : m.resultado.golesVisitante;
          golesRivalTot += esLocal ? m.resultado.golesVisitante : m.resultado.golesLocal;
        });
        if (golesClubTot < golesRivalTot) eliminado = true;
      } else {
        // Unidad incompleta: cada leg SIN jugar bloquea igual que una
        // ronda suelta — la 1ª pendiente de toda la comp queda libre, el
        // resto no (una leg YA jugada no cuenta ni desbloquea ni bloquea).
        unidad.forEach(function (m) {
          if (m.jugado && m.resultado) return;
          if (pendiente) bloqueadoIds[m.id] = true;
          else pendiente = true;
        });
      }
      i += unidad.length;
    }
    return { eliminadoIds: eliminadoIds, bloqueadoIds: bloqueadoIds };
  }

  // ============================================================
  // 3. CALENDARIO LATERAL DERECHO
  // ============================================================
  var _ultimoContexto = null; // { datos, equipo, totalJornadas, partidosPorId }
  var _previaPartidoActual = null; // partido cuya previa está abierta ahora mismo (para Lesionados/Sancionados con rango, ver abrirPreviaPartido)

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

  // Línea separadora entre secciones apiladas dentro de un mismo modal
  // (clasificación / calendario / estadísticas / bloque de equipo en
  // Copa) — petición usuario: sin ella todo se veía "apelmazado", sin
  // ningún corte visual entre zonas. Reutilizable en cualquier pantalla
  // que apile secciones dentro del mismo contenedor (Superliga, Liga 1ª
  // REF, Copa del Rey, y cualquier futura).
  function nodoSeparador() {
    var hr = document.createElement("hr");
    hr.className = "seccion-separador";
    return hr;
  }

  // Título "📊 Estadísticas" que abre la fila de cajas (Pichichi/MVP/
  // Tarjetas/Zamora), justo después del separador — petición usuario: en
  // cursiva y sin negrita, igual estilo que "📅 Calendario de X" en
  // Superliga. Reutilizado por Superliga/Liga 1ª REF/Copa del Rey.
  function nodoTituloEstadisticas() {
    var p = document.createElement("p");
    p.className = "liga1ref-stat-titulo liga1ref-stat-titulo--bonito";
    p.textContent = "📊 Estadísticas";
    return p;
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

  // Distancia de edición (Levenshtein) clásica — solo se usa contra los
  // ~59 nombres de data/rivales_reales.json (nunca contra los catálogos
  // grandes de equipos IA), así que el coste es insignificante.
  function _distanciaEdicion(a, b) {
    var m = a.length, n = b.length;
    var prev = [];
    for (var j = 0; j <= n; j++) prev[j] = j;
    for (var i = 1; i <= m; i++) {
      var cur = [i];
      for (var k = 1; k <= n; k++) {
        var costo = a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1;
        cur[k] = Math.min(prev[k] + 1, cur[k - 1] + 1, prev[k - 1] + costo);
      }
      prev = cur;
    }
    return prev[n];
  }

  // Un mismo club REAL debe resolver SIEMPRE al mismo escudo/colores/
  // alias, lo teclee el admin donde lo teclee (Liga, Copa, cualquier
  // torneo) — aunque se le cuele una errata de 1-2 letras al escribirlo
  // a mano en el Calendario extra (ej. "Real Zargoza" en vez de "Real
  // Zaragoza"). Match exacto -> substring (ya existía) -> por último,
  // erratas de hasta 2 caracteres, SOLO para nombres de 6+ letras y
  // SOLO si hay un único candidato más cercano (si dos claves distintas
  // quedan igual de cerca — ej. "villarreal"/"villarreal b" — no se
  // adivina, se deja sin resolver antes que confundir 2 equipos reales).
  function _buscarRivalReal(norm) {
    if (!_rivalesRealesMap) return null;
    if (_rivalesRealesMap[norm]) return _rivalesRealesMap[norm];
    var claves = Object.keys(_rivalesRealesMap);
    for (var i = 0; i < claves.length; i++) {
      var k = claves[i];
      if (norm.length > 2 && (k.indexOf(norm) !== -1 || norm.indexOf(k) !== -1)) return _rivalesRealesMap[k];
    }
    if (norm.length >= 6) {
      var mejor = null, mejorDist = 3, empatado = false;
      for (var j = 0; j < claves.length; j++) {
        var d = _distanciaEdicion(norm, claves[j]);
        if (d <= 2) {
          if (d < mejorDist) { mejorDist = d; mejor = claves[j]; empatado = false; }
          else if (d === mejorDist) { empatado = true; }
        }
      }
      if (mejor && !empatado) return _rivalesRealesMap[mejor];
    }
    return null;
  }

  // Abreviaturas conocidas de los 6 clubes HUMANOS (los únicos con
  // "Calendario extra" propio, ver estado.js::_partidosExtraDeTodosLosClubes)
  // — cubre lo que el admin puede escribir al pegar el texto de UN club
  // sobre el rival humano ("At. Madrid" en vez de "Atlético Madrid"), que
  // el match exacto/parcial de abajo NO reconoce: el punto rompe cualquier
  // substring contra "atletico madrid". Sin esto, la abreviatura no
  // encuentra al club real y crea un rival SINTÉTICO con id distinto —
  // ese mismo partido humano-vs-humano puede acabar duplicado (2 ids
  // distintos para el mismo enfrentamiento, y el nombre corto/genérico se
  // queda pegado en el calendario para siempre en vez del nombre largo
  // real). Lista CERRADA y explícita (nunca fuzzy genérico contra los 20
  // equipos IA / data/rivales_reales.json) para no arriesgarse a
  // emparejar con el club equivocado — verificado sin colisiones contra
  // ambos catálogos (incluida "Atlético Madrileño", el filial real, que
  // NUNCA se abrevia igual que el primer equipo).
  var _ALIAS_CLUBES_HUMANOS = {
    liverpool: ["liverpool", "lfc"],
    arsenal: ["arsenal", "arsenal fc"],
    "real-madrid": ["real madrid", "r madrid"],
    "atletico-madrid": ["atletico madrid", "atletico de madrid", "at madrid", "atleti"],
    "fc-barcelona": ["fc barcelona", "barcelona", "barca", "barça"],
    psg: ["psg", "paris saint germain", "paris sg"]
  };
  function _normSinPuntuacion(s) {
    return _normNombre(s).replace(/[.,]/g, "").replace(/\s+/g, " ").trim();
  }

  // Busca el rival tecleado en texto libre, en 4 pasadas:
  // 1) catálogos reales (los 6 humanos + los equipos IA) — match exacto.
  // 2) alias conocidos de los 6 humanos (abreviaturas, ver arriba) —
  //    SIEMPRE resuelve al club real, nunca a un sintético.
  // 3) catálogos reales — match parcial (substring en cualquier dirección).
  // 4) data/rivales_reales.json — clubes reales de 1ª RFEF/Hypermotion/LaLiga
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

    var normSinPunto = _normSinPuntuacion(nombre);
    var aliasId = null;
    Object.keys(_ALIAS_CLUBES_HUMANOS).some(function (id) {
      if (_ALIAS_CLUBES_HUMANOS[id].indexOf(normSinPunto) !== -1) { aliasId = id; return true; }
      return false;
    });
    if (aliasId) {
      var porAlias = candidatos.find(function (e) { return e.id === aliasId; });
      if (porAlias) return porAlias;
    }

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
          // Nombre CANÓNICO del catálogo, no el texto tal cual lo tecleó
          // el admin — si se coló una errata ("Real Zargoza" en vez de
          // "Real Zaragoza"), el club real ya se encontró vía
          // _buscarRivalReal (match exacto/substring/errata); mostrar su
          // nombre real es lo que garantiza que el MISMO club se vea
          // igual (nombre/escudo/colores/alias) esté donde esté escrito.
          nombre: real.nombre,
          siglas: real.siglas,
          colorPrimario: real.colorPrimario,
          colorSecundario: real.colorSecundario,
          escudoFormato: real.escudoFormato,
          valoracionPoder: real.valoracionPoder,
          // Plantilla real de data/rivales_reales.json (ver
          // js/acta.js::simularGoleadorAutomatorioIA) — sin esto, un
          // equipo con `jugadores` puesto en el JSON seguía cayendo al
          // pool de nombres genéricos porque este objeto sintético (el
          // que de verdad usa el motor de eventos) nunca lo copiaba.
          jugadores: real.jugadores,
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
          mostrarSiglas: true,
          // Rival aún SIN sortear (el admin tecleó "?" como marcador de
          // "todavía no se sabe" — típico de una semifinal de Copa cuyo
          // rival depende de otra eliminatoria sin jugar). Ver
          // crearEscudoHTML: en vez del rombo de color hash de un rival
          // genérico de verdad, pinta un cuadro negro liso con ❓️.
          desconocido: /^[?¿]+$/.test(String(nombre || "").trim())
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

      // DG (la última columna, que se descarta) puede venir con signo
      // explícito en ambos sentidos: "+4" en las filas positivas, "-2"
      // en las negativas, o "0" sin signo — el regex acepta los 3.
      var fin = tokens.length;
      var numerosFinales = [];
      while (fin > 0 && numerosFinales.length < 7 && /^[+-]?\d+$/.test(tokens[fin - 1])) {
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

  // Comparación tolerante de 2 nombres libres (normalizado + substring,
  // con un mínimo de 3 letras para el substring — evita que "CD" o "FC"
  // sueltos empaten con cualquier cosa). Único criterio de "¿es el mismo
  // equipo?" en toda esta pantalla: lo usa tanto _liga1RefEsNombreHumano
  // (¿el nombre pegado es en realidad uno de los 6 humanos?) como la
  // fusión de rivales IA de más abajo (¿este rival ya tiene fila en el
  // texto pegado, con otra grafía?).
  function _liga1RefNombresCoinciden(a, b) {
    var na = _normNombre(a || ""), nb = _normNombre(b || "");
    if (!na || !nb) return false;
    return na === nb || (na.length > 2 && nb.length > 2 && (na.indexOf(nb) !== -1 || nb.indexOf(na) !== -1));
  }

  // ¿El nombre libre que acaba de pegar el admin (equipo de la
  // clasificación, o "equipo" de una fila de estadística) es en realidad
  // uno de los clubes humanos? Comparte el mismo criterio tolerante
  // (normalizado + substring) en clasificación y en las 5 cajas de stats.
  function _liga1RefEsNombreHumano(nombre, equiposHumanos) {
    if (!_normNombre(nombre || "")) return false;
    return equiposHumanos.some(function (e) { return _liga1RefNombresCoinciden(nombre, e.nombre); });
  }

  // La fusión: texto pegado (solo IA) + los clubes humanos que SÍ juegan
  // esta liga, con sus propios partidos de Liga ya jugados dentro de la
  // app (Estado.calcularClasificacion sobre la liga ACTUAL de cada club —
  // hoy "LIGA_EA_SPORTS", pero se lee de equipo.ligaActual para que siga
  // funcionando si algún club cambia de liga más adelante). Un humano
  // NUNCA sale del texto pegado — si el admin escribe su nombre ahí por
  // error, esa línea se descarta; su fila sale SIEMPRE de sus propios
  // partidos (una sola fuente de verdad por equipo).
  //
  // El rival IA de un partido humano-vs-IA es la ÚNICA fila de esta
  // tabla que, sin esto, nunca se movía del snapshot pegado por el admin
  // (bug real: Atlético Madrid empata 3-3 con Tenerife, el punto/empate/
  // goles del propio Atlético SÍ se ven en su fila — pero el de Tenerife
  // no, porque su fila entera venía copiada tal cual de fuera de la app
  // y nada volvía a tocarla). Se suma la aportación de CADA partido de
  // liga humano-vs-IA ya jugado sobre la fila pegada de ESE rival (por
  // nombre, mismo criterio tolerante que ya identifica a los 6 humanos);
  // si el rival no tenía fila pegada (nunca se copió su clasificación
  // real), se crea una nueva partiendo de 0 — un resultado ya jugado en
  // la app JAMÁS se pierde. Un partido humano-vs-humano NO genera fila
  // IA (su rival es otro humano, con fila propia más abajo).
  // Resultado de UN partido, visto desde un lado concreto (golesPropios
  // vs golesRival) — {pj:1, pe, pp, gf, gc, pts}. Único punto que decide
  // 3/1/0 puntos; lo comparten `propia` (fila del humano) y `destino`
  // (fila del rival IA) para no poder desincronizarse entre sí.
  function _liga1RefResultadoLado(golesPropios, golesRival) {
    var r = { pj: 1, pe: 0, pp: 0, gf: golesPropios, gc: golesRival, pts: 0 };
    if (golesPropios > golesRival) r.pts = 3;
    else if (golesPropios === golesRival) { r.pe = 1; r.pts = 1; }
    else r.pp = 1;
    return r;
  }
  function _liga1RefSumar(acc, r) {
    acc.pj += r.pj; acc.pe += r.pe; acc.pp += r.pp;
    acc.gf += r.gf; acc.gc += r.gc; acc.pts += r.pts;
  }

  function calcularLiga1RefCombinada(datos) {
    var equiposHumanos = _liga1RefEquiposHumanos(datos);
    var idsHumanos = {};
    equiposHumanos.forEach(function (e) { idsHumanos[e.id] = true; });
    var filas = [];

    var texto = window.Estado ? window.Estado.obtenerLiga1RefTexto() : "";
    parsearLiga1RefTexto(texto).forEach(function (f) {
      if (_liga1RefEsNombreHumano(f.nombre, equiposHumanos)) return; // su fila la aporta el bloque de abajo, nunca el texto
      filas.push({
        nombre: f.nombre, nombreMostrado: f.nombre, equipoId: null,
        pts: f.pts, pj: f.pj, pe: f.pe, pp: f.pp, gf: f.gf, gc: f.gc
      });
    });

    var todosPartidos = window.Estado ? window.Estado.listarPartidosResueltos(datos) : [];

    equiposHumanos.forEach(function (e) {
      // SOLO los partidos donde ESTE club es local o visitante — mismo
      // fix ya aplicado en calcularLiga1RefStatsHumanos (ver su
      // comentario): con varios humanos compartiendo la MISMA liga
      // (todos ligaActual="LIGA_EA_SPORTS"), Estado.calcularClasificacion
      // devuelve la tabla GLOBAL de esa liga — llamarla una vez POR CADA
      // humano y volver a sumar la fila de un mismo rival IA en cada
      // vuelta multiplicaba sus puntos/PJ por el nº de humanos (bug real,
      // foto usuario: Huesca ganó 1 partido de verdad y su fila sumaba
      // como si hubiera jugado y ganado 5 veces). Filtrando a los
      // partidos de ESTE club, cada partido se cuenta UNA sola vez.
      var partidos = todosPartidos.filter(function (p) {
        return p.jugado && p.resultado && p.competicion === "liga" && p.liga === e.ligaActual &&
          (p.local === e.id || p.visitante === e.id);
      });

      var propia = { pj: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 };

      partidos.forEach(function (p) {
        var esLocal = p.local === e.id;
        var oponenteId = esLocal ? p.visitante : p.local;
        var golesE = esLocal ? p.resultado.golesLocal : p.resultado.golesVisitante;
        var golesRival = esLocal ? p.resultado.golesVisitante : p.resultado.golesLocal;

        _liga1RefSumar(propia, _liga1RefResultadoLado(golesE, golesRival));

        if (idsHumanos[oponenteId]) return; // HvH: la fila del rival humano la aporta SU PROPIA iteración

        var rival = buscarEquipoPorId(oponenteId, datos);
        var nombreRival = rival ? rival.nombre : oponenteId;
        var destino = filas.find(function (fl) {
          return fl.equipoId === null && _liga1RefNombresCoinciden(fl.nombre, nombreRival);
        });
        if (!destino) {
          destino = { nombre: nombreRival, nombreMostrado: nombreRival, equipoId: null, pts: 0, pj: 0, pe: 0, pp: 0, gf: 0, gc: 0 };
          filas.push(destino);
        }
        _liga1RefSumar(destino, _liga1RefResultadoLado(golesRival, golesE));
      });

      filas.push({
        nombre: e.nombre,
        nombreMostrado: (e.misterEmoji || "") + e.nombre,
        equipoId: e.id,
        pts: propia.pts, pj: propia.pj, pe: propia.pe, pp: propia.pp, gf: propia.gf, gc: propia.gc
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

  // Envuelve `_liga1RefZona` para que las filas de la TABLA nunca se
  // coloreen de promo-descenso/descenso en una división que no tiene
  // liga debajo a la que descender (hoy, 2ª REF — la más baja de la
  // pirámide, ver LIGA_NAV_ORDEN). La leyenda (`_ligaLeyendaHTML`) YA
  // ocultaba esas 2 líneas ahí con el mismo criterio (`abajo === ""`);
  // esto lleva la MISMA regla a las filas reales para que nunca
  // vuelvan a divergir (bug 2ª REF: 6º en marrón, 7º-10º en rojo, sin
  // ninguna zona de descenso real a la que apuntar).
  function _liga1RefZonaFn(ligaId) {
    var tieneAbajo = LIGA_NAV_ORDEN.indexOf(ligaId) > 0;
    return function (pos, total) {
      var z = _liga1RefZona(pos, total);
      if (!tieneAbajo && (z === "promo-descenso" || z === "descenso")) return "";
      return z;
    };
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
  // Zamora es la ÚNICA categoría con semántica distinta al resto: NO es
  // un contador (más es mejor) sino la MEDIA de goles encajados por
  // partido (menos es mejor) — el propio Trofeo Zamora real. `asc:true`
  // ordena de menor a mayor; `decimales:true` muestra siempre 2 cifras
  // decimales (0.90, no 0.9), aunque el número interno sea entero.
  var LIGA1REF_STATS = [
    { key: "pichichi", icono: "⚽", label: "PICHICHI", columna: "Goles" },
    { key: "mvp", icono: "⭐", label: "MVP", columna: "MVP" },
    { key: "amarillas", icono: "🟨", label: "T. AMARILLAS", columna: "Amarillas" },
    { key: "rojas", icono: "🟥", label: "T. ROJAS", columna: "Rojas" },
    {
      key: "zamora", icono: "🧤", label: "ZAMORA", columna: "Media", asc: true, decimales: true,
      placeholder: "1 Sem Westerveld - Real Zaragoza  0.90\n2 Ramón Vila - Eldense  0.90"
    }
  ];

  // Formato de línea (texto libre, una por jugador): "Nº Nombre Jugador -
  // Equipo  Cantidad" — el Nº/separador inicial es opcional (se
  // recalcula solo, igual que Pos en la clasificación de equipos); el
  // ÚLTIMO número de la línea es la cantidad (admite decimales, con "."
  // o "," — la media de Zamora la calcula y teclea el propio admin,
  // aquí solo se guarda tal cual) y el "-" INMEDIATO anterior separa
  // nombre de equipo (si no hay "-", todo es el nombre y el equipo
  // queda vacío).
  function parsearLiga1RefStatTexto(texto) {
    var items = [];
    (texto || "").split("\n").forEach(function (linea) {
      var l = linea.trim();
      if (!l) return;
      l = l.replace(/^\d+[ºª°]?[.\-)]?\s*/, ""); // quita "1º ", "12.", "3) "...
      var m = l.match(/^(.*\S)\s+(\d+(?:[.,]\d+)?)\s*$/);
      if (!m) return;
      var cantidad = Number(m[2].replace(",", "."));
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
  // amarillas/rojas por jugador — de ESTE club (es_humano:true, ficha
  // real vía obtenerJugadoresClub) Y del RIVAL IA de cada partido
  // (es_humano:false, nombre real generado por
  // js/acta.js::simularGoleadorAutomatorioIA — petición usuario: los
  // goles/tarjetas de la IA TAMBIÉN suben a Pichichi/MVP/etc) + porterías
  // a 0 del equipo, atribuidas a su portero principal.
  function calcularLiga1RefStatsHumanos(datos) {
    var acumulado = { pichichi: {}, mvp: {}, amarillas: {}, rojas: {}, zamora: {} };
    var ES_GOL = { GOL: 1, GOL_FAV_FALTA: 1, PENALTI_GOL: 1 };

    function sumar(bucket, jugadorId, nombre, equipo, equipoId) {
      if (!bucket[jugadorId]) bucket[jugadorId] = { nombre: nombre, equipo: equipo, equipoId: equipoId, cantidad: 0 };
      bucket[jugadorId].cantidad++;
    }
    function sumarPorTipo(ev, jugadorId, nombre, equipo, equipoId) {
      if (ES_GOL[ev.tipo]) sumar(acumulado.pichichi, jugadorId, nombre, equipo, equipoId);
      else if (ev.tipo === "MVP") sumar(acumulado.mvp, jugadorId, nombre, equipo, equipoId);
      else if (ev.tipo === "AMARILLA") sumar(acumulado.amarillas, jugadorId, nombre, equipo, equipoId);
      else if (ev.tipo === "ROJA") sumar(acumulado.rojas, jugadorId, nombre, equipo, equipoId);
    }

    _liga1RefEquiposHumanos(datos).forEach(function (e) {
      var nombresPorId = {};
      obtenerJugadoresClub(e.id).forEach(function (j) { nombresPorId[j.id] = j.nombre; });
      var portero = _liga1RefPorteroPrincipal(e.id);
      var zamoraEncajados = 0, zamoraPartidos = 0;

      // SOLO los partidos donde ESTE club es local o visitante — sin este
      // filtro, con varios humanos en la MISMA liga (todos comparten
      // ligaActual="LIGA_EA_SPORTS"), el partido de un club se procesaba
      // también en el bucle de los otros 4, multiplicando el conteo.
      var partidos = (window.Estado ? window.Estado.listarPartidosResueltos(datos) : []).filter(function (p) {
        return p.jugado && p.competicion === "liga" && p.liga === e.ligaActual &&
          (p.local === e.id || p.visitante === e.id);
      });

      partidos.forEach(function (p) {
        var oponenteId = p.local === e.id ? p.visitante : p.local;
        (p.eventos || []).forEach(function (ev) {
          if (!ev.jugador_id) return;
          if (ev.equipo_id === e.id) {
            // Eventos de ESTE club — un partido humano-vs-humano trae
            // eventos de AMBOS lados; cada club solo suma los suyos.
            if (!ev.es_humano) return;
            var nombreJ = nombresPorId[ev.jugador_id] || ev.jugador_nombre;
            if (!nombreJ) return;
            sumarPorTipo(ev, ev.jugador_id, nombreJ, e.nombre, e.id);
          } else if (ev.equipo_id === oponenteId && !ev.es_humano) {
            // Rival IA de ESTE partido concreto (nunca otro humano — ese
            // caso ya lo cubre su propia iteración de arriba).
            if (!ev.jugador_nombre) return;
            sumarPorTipo(ev, ev.jugador_id, ev.jugador_nombre, ev.equipo_nombre || "Rival IA", oponenteId);
          }
        });

        if (!portero || !p.resultado) return;
        var encajados = p.local === e.id ? p.resultado.golesVisitante
          : p.visitante === e.id ? p.resultado.golesLocal : null;
        if (encajados === null) return;
        zamoraEncajados += encajados;
        zamoraPartidos++;
      });

      // Zamora del portero titular = media de goles encajados por partido
      // (menos es mejor, el Trofeo Zamora real) — no un contador de
      // porterías a 0, para que case con el número que el admin escribe a
      // mano en el texto pegado (ver LIGA1REF_STATS.zamora).
      if (portero && zamoraPartidos > 0) {
        acumulado.zamora[portero.id] = {
          nombre: portero.nombre, equipo: e.nombre, equipoId: e.id,
          cantidad: Math.round((zamoraEncajados / zamoraPartidos) * 100) / 100
        };
      }
    });

    var salida = {};
    Object.keys(acumulado).forEach(function (k) {
      salida[k] = Object.keys(acumulado[k]).map(function (id) { return acumulado[k][id]; });
    });
    return salida;
  }

  // Ranking final de una categoría: texto pegado (IA) + auto-suma humana,
  // top 15 por cantidad (empate -> alfabético, mismo criterio que el
  // resto de tablas de este archivo). Zamora es la ÚNICA que ordena
  // ascendente (menos goles de media es mejor) — ver LIGA1REF_STATS.
  function calcularLiga1RefStatsCombinado(datos, categoria) {
    var equiposHumanos = _liga1RefEquiposHumanos(datos);
    var meta = LIGA1REF_STATS.filter(function (s) { return s.key === categoria; })[0];
    var filas = [];

    var texto = window.Estado ? window.Estado.obtenerLiga1RefStatTexto(categoria) : "";
    parsearLiga1RefStatTexto(texto).forEach(function (it) {
      if (_liga1RefEsNombreHumano(it.equipo, equiposHumanos)) return; // esa fila la aporta la auto-suma
      filas.push(it);
    });

    (calcularLiga1RefStatsHumanos(datos)[categoria] || []).forEach(function (it) { filas.push(it); });

    filas.sort(function (a, b) {
      var diff = meta && meta.asc ? a.cantidad - b.cantidad : b.cantidad - a.cantidad;
      return diff || a.nombre.localeCompare(b.nombre);
    });
    return filas.slice(0, 15);
  }

  // ============================================================
  // 3c-ter-bis. NAVEGACIÓN entre las 4 divisiones — 2ª REF / 1ª REF /
  // Hypermotion / Ea Sports. Solo 1ª REF tiene "batidora" (fusiona con
  // los partidos reales de los clubes humanos, ver
  // calcularLiga1RefCombinada más arriba) — las otras 3 son 100% texto
  // libre que pega el admin (petición usuario: "el resto de
  // estadísticas y clasificación te las doy yo manualmente texto"),
  // mismo formato EXACTO que 1ª REF (parsearLiga1RefTexto/
  // parsearLiga1RefStatTexto se reutilizan tal cual).
  // Orden izquierda->derecha: 2ª REF · 1ª REF (central por defecto,
  // igual que siempre) · Hypermotion (azul) · Ea Sports (rojo) — los
  // mismos colores que ya llevan sus bordes de pestaña.
  // ============================================================
  var LIGA_NAV_ORDEN = ["2ref", "1ref", "hypermotion", "easports"];
  var LIGA_NAV_META = {
    "2ref": { corta: "2ª REF", boxClase: "liga-tab-box--2ref", leyenda: "promocion" },
    "1ref": { corta: "1ª REF", boxClase: "liga-tab-box--1ref", leyenda: "promocion" },
    hypermotion: { corta: "Hypermotion", boxClase: "liga-tab-box--hypermotion", leyenda: "promocion" },
    easports: { corta: "Ea Sports", boxClase: "liga-tab-box--easports", leyenda: "europa" }
  };
  // Título largo de cada liga — "🇪🇸 Liga <nombre corto>" (petición
  // usuario: antes decía solo "🇪🇸 1ª REF"), calculado a partir de
  // `corta` para las 4 sin repetirlo en cada entrada.
  function _ligaTituloLargo(ligaId) {
    var meta = LIGA_NAV_META[ligaId] || LIGA_NAV_META["1ref"];
    return "🇪🇸 Liga " + meta.corta;
  }
  // Nombre corto de una división ("1ª REF", "Hypermotion"...) — lo usa
  // la cabecera del modal del club para el título "ℹ️ <corta>".
  function obtenerLigaNombreCorta(ligaId) {
    var meta = LIGA_NAV_META[ligaId] || LIGA_NAV_META["1ref"];
    return meta.corta;
  }

  // El texto EXACTO del ℹ️ de 1ª REF (petición usuario, verbatim). Las
  // otras 3 (2ª REF/Hypermotion/Ea Sports) tienen el suyo propio más
  // abajo (FORMATO_LIGA_EXTRA_TEXTO).
  var FORMATO_LIGA_1REF_TEXTO = [
    "📋FORMATO LIGA:",
    "Liga regular corta de 16 equipos a vuelta única (15 jornadas cada club)",
    "",
    " * Duración: 15 jornadas por equipo a partido único.",
    " * Reparto de localía: Cada club juega 7 u 8 partidos como local y 7 u 8 como visitante.",
    "",
    "⚖️CRITERIOS DE DESEMPATE:",
    "(Aplicados en estricto orden de prioridad en caso de igualdad de puntos)",
    " * Puntos totales.",
    " * Mayor diferencia de goles general (Goles marcados menos goles encajados).",
    " * Mayor cantidad de goles marcados.",
    " * Menor cantidad de goles encajados.",
    " * Resultado del partido directo entre los equipos involucrados.",
    "",
    "🏁RESOLUCIÓN CLASIFICACIÓN:",
    " 🟦 Puestos 1º al 4º: Ascenso directo a Liga Hypermotion.",
    "",
    " 🟨Puesto 5º: Promoción de ascenso en eliminatoria a ida y vuelta contra el 12º clasificado de Liga Hypermotion.",
    "",
    " ⬜️Puestos 6º al 11º: Permanencia asegurada en la categoría sin disputar fases adicionales.",
    "",
    "🟫 Puesto 12º: Promoción de permanencia en eliminatoria a ida y vuelta contra el 5º clasificado de 2ª RFEF.",
    "",
    "🟥 Puestos 13º al 16º: Descenso directo a 2ª RFEF."
  ].join("\n");

  // Bloque de desempate compartido por 2ª REF/Hypermotion/Ea Sports
  // (mismo criterio que ya llevaba 1ª REF) — sin duplicarlo 3 veces.
  var FORMATO_LIGA_EXTRA_DESEMPATE_TEXTO = [
    "⚖️CRITERIOS DE DESEMPATE:",
    "(Aplicados en estricto orden de prioridad en caso de igualdad de puntos)",
    " * Puntos totales.",
    " * Mayor diferencia de goles general (Goles marcados menos goles encajados).",
    " * Mayor cantidad de goles marcados.",
    " * Menor cantidad de goles encajados.",
    " * Resultado del partido directo entre los equipos involucrados."
  ].join("\n");

  // 2ª REF/Hypermotion/Ea Sports — clasificación de texto libre pegada
  // por el admin (petición usuario: dictar también sus reglas de
  // ascenso/descenso, antes solo 1ª REF tenía ℹ️). Mismas 4 zonas que
  // ya pinta la leyenda plegable de la clasificación (_ligaLeyendaHTML)
  // — sin fijar un total de equipos concreto (cada liga puede tener
  // uno distinto según lo que pegue el admin).
  var FORMATO_LIGA_EXTRA_TEXTO = {
    "2ref": [
      "📋FORMATO LIGA 2ª REF:",
      "Clasificación de texto libre pegada por el admin.",
      "",
      FORMATO_LIGA_EXTRA_DESEMPATE_TEXTO,
      "",
      "🏁RESOLUCIÓN CLASIFICACIÓN:",
      " 🟦 Puestos 1º al 4º: Ascenso directo a Liga 1ª REF.",
      "",
      " 🟨 Puesto 5º: Promoción de ascenso en eliminatoria contra Liga 1ª REF.",
      "",
      " ⬜️ Resto de puestos: Permanencia asegurada en la categoría."
    ].join("\n"),
    hypermotion: [
      "📋FORMATO LIGA HYPERMOTION:",
      "Clasificación de texto libre pegada por el admin.",
      "",
      FORMATO_LIGA_EXTRA_DESEMPATE_TEXTO,
      "",
      "🏁RESOLUCIÓN CLASIFICACIÓN:",
      " 🟦 Puestos 1º al 4º: Ascenso directo a Liga Ea Sports.",
      "",
      " 🟨 Puesto 5º: Promoción de ascenso en eliminatoria contra Liga Ea Sports.",
      "",
      " ⬜️ Puestos intermedios: Permanencia asegurada en la categoría.",
      "",
      " 🟫 Penúltimo grupo de descenso: Promoción de permanencia en eliminatoria contra Liga 1ª REF.",
      "",
      " 🟥 Últimos clasificados: Descenso directo a Liga 1ª REF."
    ].join("\n"),
    easports: [
      "📋FORMATO LIGA EA SPORTS:",
      "Clasificación de texto libre pegada por el admin.",
      "",
      FORMATO_LIGA_EXTRA_DESEMPATE_TEXTO,
      "",
      "🏁RESOLUCIÓN CLASIFICACIÓN:",
      " 🟦 Puestos 1º al 4º: Champions League.",
      "",
      " 🟪 Puesto 5º: Previa Champions League.",
      "",
      " 🟧 Puestos 6º y 7º: Europa League.",
      "",
      " 🟩 Puesto 8º: Conference League.",
      "",
      " 🟫 Penúltimo grupo de descenso: Promoción de permanencia en eliminatoria contra Liga Hypermotion.",
      "",
      " 🟥 Últimos clasificados: Descenso directo a Liga Hypermotion."
    ].join("\n")
  };

  // El admin puede sustituir CUALQUIERA de estos 4 textos por el suyo
  // (📌 dentro del propio overlay ℹ️, PIN 646 — ver
  // js/main.js::_infoOverlayGuardar). Override vacío = sigue el de
  // fábrica de arriba.
  function obtenerFormatoLigaTexto(ligaId) {
    var override = window.Estado ? window.Estado.obtenerFormatoOverride("liga_" + ligaId) : "";
    if (override) return override;
    return ligaId === "1ref" ? FORMATO_LIGA_1REF_TEXTO : (FORMATO_LIGA_EXTRA_TEXTO[ligaId] || "");
  }

  // Fila de cajas de color con las OTRAS 3 ligas (nunca la activa) —
  // petición usuario: sustituye a las flechas ⬅️/➡️. Tocar una caja
  // abre esa liga "en solitario" (ver _ligaTituloRowHTML) y esta fila
  // se re-pinta con las 3 que quedan.
  function _ligaTabBoxesHTML(ligaId, idClubActivo) {
    // Las 4 divisiones SIEMPRE en fila (petición usuario: "que entren
    // las 4 en horizontal") — incluida la activa, marcada con
    // --activa para distinguirla a simple vista sin tener que leer el
    // título centrado de arriba.
    var html = '<div class="liga-tab-boxes">';
    LIGA_NAV_ORDEN.forEach(function (id) {
      var meta = LIGA_NAV_META[id];
      var activa = id === ligaId;
      html += '<button type="button" class="liga-tab-box ' + meta.boxClase +
        (activa ? " liga-tab-box--activa" : "") +
        '" data-accion="liga-nav-ir" data-liga-id="' + id + '" data-club-id="' +
        (idClubActivo || "") + '">' + escapeHTML(meta.corta) + "</button>";
    });
    return html + "</div>";
  }

  // Fila del título de la liga ACTIVA — título centrado ("🇪🇸 Liga
  // <corta>"), ✏️ a la derecha (la ℹ️ vive en la cabecera del propio
  // modal, ver js/main.js::abrirModalClub / _actualizarTituloModalLiga
  // más abajo). El 📌 (fijar/ver qué división es "la suya") ya NO vive
  // aquí — se molestaba con el resto de la fila (petición usuario) —
  // ahora está DENTRO del editor de clasificación (✏️ → PIN 646, ver
  // pintarEditorLiga1Ref más abajo), junto al resto de acciones de
  // admin sobre esa liga.
  function _ligaTituloRowHTML(ligaId, idClubActivo) {
    var izq = '<span class="liga1ref-titulo-spacer"></span>';
    var der = '<button type="button" class="liga1ref-editar-btn" data-accion="editar-liga1ref-inline" data-liga-id="' +
      ligaId + '" data-club-id="' + (idClubActivo || "") + '" aria-label="Editar clasificación">✏️</button>';
    return (
      '<div class="liga1ref-titulo-row">' + izq +
      '<span class="liga1ref-titulo-actual">' + escapeHTML(_ligaTituloLargo(ligaId)) + "</span>" +
      der + "</div>"
    );
  }

  // La cabecera del propio modal ("ℹ️ 1ª REF"/etc.) reflejaba SIEMPRE el
  // formato de "1ref" — con 4 divisiones posibles, eso era un error en
  // cuanto se navegaba/fijaba una liga distinta (petición usuario: "hay
  // 4 ligas en total y la ℹ️ de arriba solo lee el formato de 1ref").
  // Se resincroniza AQUÍ, en el único punto por el que pasa CUALQUIER
  // cambio de división visible (abrir, navegar con las cajas, fijar,
  // guardar/cancelar edición…), delegando en el mismo pintor que usa
  // js/main.js::abrirModalClub la primera vez (window.Main, el único
  // puente entre los 2 módulos). Las 4 divisiones ya tienen reglas
  // dictadas (obtenerFormatoLigaTexto) así que el botón ℹ️ sale
  // siempre — este fallback al título largo normal solo cubriría un
  // ligaId desconocido.
  function _actualizarTituloModalLiga(ligaId) {
    if (!window.Main || typeof window.Main.pintarTituloModalInfo !== "function") return;
    var tituloEl = document.getElementById("club-modal-title");
    if (!tituloEl) return;
    window.Main.pintarTituloModalInfo(
      tituloEl, obtenerLigaNombreCorta(ligaId), "info-liga-formato", ligaId,
      obtenerFormatoLigaTexto(ligaId), _ligaTituloLargo(ligaId)
    );
  }

  // Leyenda en rejilla 2x2 — vive DEBAJO de la tabla (petición usuario),
  // sin flechas ⬆️/⬇️ (el orden/color de cada zona ya la distingue). Ea
  // Sports usa 6 zonas de estilo europeo en vez de ascenso/descenso.
  //
  // Recorre TODAS las posiciones 1..total con la MISMA `zonaFn` que
  // pinta la tabla (_liga1RefZona/_ligaEuropaZona) — solo para saber SI
  // esa zona existe (con totales pequeños, el orden de ese if-chain
  // hace que "promoción descenso"/"descenso" ni siquiera existan como
  // fila propia); la leyenda ya NO nombra la posición exacta (petición
  // usuario, quitó el "(el Nº clasificado)" entre paréntesis), pero
  // sigue sin poder mostrar una fila que la tabla real no tenga.
  function _ligaZonaPosiciones(zonaFn, total) {
    var byZone = {};
    for (var pos = 1; pos <= total; pos++) {
      var z = zonaFn(pos, total);
      if (!z) continue;
      (byZone[z] || (byZone[z] = [])).push(pos);
    }
    return byZone;
  }
  function _ligaLeyendaHTML(ligaId, total) {
    var meta = LIGA_NAV_META[ligaId] || LIGA_NAV_META["1ref"];
    var idx = LIGA_NAV_ORDEN.indexOf(ligaId);
    var arriba = idx >= 0 && idx < LIGA_NAV_ORDEN.length - 1
      ? LIGA_NAV_META[LIGA_NAV_ORDEN[idx + 1]].corta : "";
    var abajo = idx > 0 ? LIGA_NAV_META[LIGA_NAV_ORDEN[idx - 1]].corta : "";
    var subeTxt = arriba ? " a Liga " + arriba : "";
    var bajaTxt = abajo ? " a Liga " + abajo : "";
    var items = [];
    if (meta.leyenda === "europa") {
      // Zonas 1-4/5/6-7/8 (_ligaEuropaZona) — Promoción/Descenso
      // apuntan SIEMPRE a Hypermotion (la liga de abajo de Ea Sports en
      // la pirámide, ver LIGA_NAV_ORDEN). Solo color + destino, SIN la
      // posición exacta entre paréntesis (petición usuario: la quita).
      var zE = _ligaZonaPosiciones(_ligaEuropaZona, total);
      if (zE.champions) items.push({ e: "🟦", t: "Champions" });
      if (zE.previa) items.push({ e: "🟪", t: "Previa Champions" });
      if (zE.eleague) items.push({ e: "🟧", t: "Europa League" });
      if (zE.conference) items.push({ e: "🟩", t: "Conference League" });
      if (abajo && zE["promo-descenso"]) items.push({ e: "🟫", t: "Promoción descenso" + bajaTxt });
      if (abajo && zE.descenso) items.push({ e: "🟥", t: "Descenso" + bajaTxt });
    } else {
      // Zonas 1-4/5 (_liga1RefZona) — Ascenso/Promoción ascenso apuntan
      // a la liga de ARRIBA en la pirámide; Promoción descenso/Descenso
      // a la de ABAJO. 2ª REF (la más baja) no tiene liga debajo, así
      // que sus 2 filas de descenso no se pintan (abajo === "").
      var zP = _ligaZonaPosiciones(_liga1RefZona, total);
      if (arriba && zP.ascenso) items.push({ e: "🟦", t: "Ascenso" + subeTxt });
      if (arriba && zP["promo-ascenso"]) items.push({ e: "🟨", t: "Promoción ascenso" + subeTxt });
      if (abajo && zP["promo-descenso"]) items.push({ e: "🟫", t: "Promoción descenso" + bajaTxt });
      if (abajo && zP.descenso) items.push({ e: "🟥", t: "Descenso" + bajaTxt });
    }
    var claseExtra = meta.leyenda === "europa" ? " liga1ref-leyenda-grid--europa" : "";
    var grid = '<div class="liga1ref-leyenda-grid' + claseExtra + '">' +
      items.map(function (it) { return "<span>" + it.e + " " + escapeHTML(it.t) + "</span>"; }).join("") +
      "</div>";
    return _leyendaDetailsHTML(grid);
  }

  // Envuelve una leyenda/nota en un <details> nativo (0 JS, CSS mínimo)
  // para que quede plegada por defecto — mismo patrón para TODAS las
  // pantallas (2ª REF/1ª REF/Hypermotion/Ea Sports/Superliga/Copa del
  // Rey), reutilizado con cualquier `gridHTML` que ya lleve su propia
  // clase de rejilla.
  function _leyendaDetailsHTML(gridHTML) {
    return (
      '<details class="liga1ref-leyenda-details">' +
      '<summary class="liga1ref-leyenda-summary">LEYENDA</summary>' +
      gridHTML +
      "</details>"
    );
  }

  // Zonas de la clasificación de Ea Sports (estilo europeo): 1-4
  // Champions, 5 Previa, 6-7 Europa League, 8 Conference, promoción de
  // descenso el 4º empezando por el final, descenso los últimos 3 —
  // reparto provisional (editable aquí si el usuario da otro reparto
  // exacto), reutiliza las clases de color ya definidas en CSS.
  function _ligaEuropaZona(pos, total) {
    if (pos <= 4) return "champions";
    if (pos === 5) return "previa";
    if (pos === 6 || pos === 7) return "eleague";
    if (pos === 8) return "conference";
    if (total && pos === total - 3) return "promo-descenso";
    if (total && pos > total - 3) return "descenso";
    return "";
  }

  // Filas de una liga EXTRA (2ª REF / Hypermotion / Ea Sports) — 100%
  // texto libre pegado por el admin, mismo parser que 1ª REF
  // (parsearLiga1RefTexto), SIN fusión con partidos de ningún club
  // humano (esas 3 competiciones no se juegan de verdad dentro de la
  // app). Mismo criterio de orden que calcularLiga1RefCombinada.
  function calcularLigaExtraFilas(ligaId) {
    var texto = window.Estado ? window.Estado.obtenerLigaExtraTexto(ligaId) : "";
    var filas = parsearLiga1RefTexto(texto).map(function (f) {
      return {
        nombre: f.nombre, nombreMostrado: f.nombre, equipoId: null,
        pts: f.pts, pj: f.pj, pe: f.pe, pp: f.pp, gf: f.gf, gc: f.gc
      };
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

  // Construye el <tbody> de la tabla de clasificación — compartido por
  // 1ª REF (filas de la batidora) y las 3 ligas extra (filas del texto
  // pegado), solo cambia qué `filas`/zonaFn se le pasa.
  function _construirTbodyClasificacion(filas, idClubActivo, zonaFn) {
    var tbody = document.createElement("tbody");
    filas.forEach(function (f, i) {
      var pos = i + 1;
      var dg = f.gf - f.gc;
      // PG (partidos ganados) no se guarda aparte: PJ = PG+PE+PP
      // siempre (cada partido suma exactamente 1 a PJ y a UNO solo de
      // PG/PE/PP), así que se deriva aquí sin tocar el cálculo ni el
      // texto pegado por el admin (que tampoco trae PG).
      var pg = f.pj - f.pe - f.pp;
      var zona = zonaFn(pos, filas.length);
      var claseFila = "clasificacion-fila" + (zona ? " liga1ref-zona-" + zona : "");
      if (f.equipoId && f.equipoId === idClubActivo) claseFila += " clasificacion-fila--activo";

      var tr = document.createElement("tr");
      tr.className = claseFila;
      tr.innerHTML =
        '<td class="clasificacion-pos">' + pos + "</td>" +
        '<td class="clasificacion-equipo">' + escapeHTML(f.nombreMostrado) +
        (f.equipoId && f.equipoId === idClubActivo ? ' <span class="clasificacion-tag">TÚ</span>' : "") + "</td>" +
        '<td class="clasificacion-pts">' + f.pts + "</td>" +
        "<td>" + f.pj + "</td><td>" + pg + "</td><td>" + f.pe + "</td><td>" + f.pp + "</td>" +
        "<td>" + f.gf + "</td><td>" + f.gc + "</td>" +
        "<td>" + (dg > 0 ? "+" + dg : dg) + "</td>";
      tbody.appendChild(tr);
    });
    return tbody;
  }

  function renderizarLiga1RefClasificacion(contenedorId, idClubActivo, ligaId) {
    ligaId = ligaId || "1ref";
    var contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;
    contenedor.innerHTML = "";
    contenedor.appendChild(nodoEstado("⏳", "Cargando…"));

    cargarTodo().then(function (datos) {
      contenedor.innerHTML = "";
      // 1) Cajas con las otras 3 ligas. 2) Título de la liga activa
      // (ℹ️/nombre/✏️). La leyenda YA NO va aquí — baja debajo de la
      // tabla, para que la clasificación suba y se vean más filas sin
      // hacer scroll (petición usuario).
      contenedor.insertAdjacentHTML("beforeend", _ligaTabBoxesHTML(ligaId, idClubActivo));
      contenedor.insertAdjacentHTML("beforeend", _ligaTituloRowHTML(ligaId, idClubActivo));
      _actualizarTituloModalLiga(ligaId);

      var filas = ligaId === "1ref" ? calcularLiga1RefCombinada(datos) : calcularLigaExtraFilas(ligaId);
      var metaZona = LIGA_NAV_META[ligaId] || LIGA_NAV_META["1ref"];
      var zonaFn = metaZona.leyenda === "europa" ? _ligaEuropaZona : _liga1RefZonaFn(ligaId);

      if (!filas.length) {
        contenedor.appendChild(nodoEstado("📊", "Todavía no hay clasificación pegada. Pulsa ✏️ (PIN 646) para añadirla."));
      } else {
        var wrap = document.createElement("div");
        wrap.className = "clasificacion-wrap";
        var tablaEl = document.createElement("table");
        tablaEl.className = "clasificacion-tabla liga1ref-tabla";
        tablaEl.innerHTML =
          "<thead><tr><th>#</th><th>Equipo</th><th>Pts</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th>" +
          "<th>G+</th><th>G-</th><th>DG</th></tr></thead>";
        tablaEl.appendChild(_construirTbodyClasificacion(filas, idClubActivo, zonaFn));
        wrap.appendChild(tablaEl);
        contenedor.appendChild(wrap);
        contenedor.insertAdjacentHTML("beforeend", _ligaLeyendaHTML(ligaId, filas.length));
      }

      contenedor.appendChild(nodoSeparador());
      contenedor.appendChild(nodoTituloEstadisticas());

      // Cajas de estadísticas — Pichichi/MVP/Tarjetas/Zamora. Cada una
      // abre su propio ranking (top 15) dentro de este mismo contenedor.
      var statsGrid = document.createElement("div");
      statsGrid.className = "liga1ref-stats-grid";
      statsGrid.innerHTML = LIGA1REF_STATS.map(function (s) {
        return '<button type="button" class="liga1ref-stat-box" data-accion="ver-liga1ref-stat" data-liga-id="' +
          ligaId + '" data-club-id="' + (idClubActivo || "") + '" data-categoria="' + s.key +
          '"><span class="liga1ref-stat-box-icono">' + s.icono + '</span><span class="liga1ref-stat-box-label">' +
          escapeHTML(s.label) + "</span></button>";
      }).join("");
      contenedor.appendChild(statsGrid);
    });
  }

  // Ranking (top 15) de UNA categoría — pinta DENTRO del mismo contenedor
  // que la clasificación, con un botón "← Volver" para regresar sin
  // cerrar el modal (mismo patrón que el editor inline de la tabla).
  // Ranking de UNA categoría de una liga EXTRA — 100% texto libre (sin
  // auto-suma humana, mismo motivo que calcularLigaExtraFilas), mismo
  // orden top-15 y misma excepción de Zamora ascendente que 1ª REF.
  function calcularLigaExtraStatFilas(ligaId, categoria) {
    var meta = LIGA1REF_STATS.filter(function (s) { return s.key === categoria; })[0];
    var texto = window.Estado ? window.Estado.obtenerLigaExtraStatTexto(ligaId, categoria) : "";
    var filas = parsearLiga1RefStatTexto(texto);
    filas.sort(function (a, b) {
      var diff = meta && meta.asc ? a.cantidad - b.cantidad : b.cantidad - a.cantidad;
      return diff || a.nombre.localeCompare(b.nombre);
    });
    return filas.slice(0, 15);
  }

  function renderizarLiga1RefStatDetalle(contenedorId, idClubActivo, categoria, ligaId) {
    ligaId = ligaId || "1ref";
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
        '<button type="button" class="btn-ghost liga1ref-volver-btn" data-accion="volver-liga1ref" data-liga-id="' +
        ligaId + '" data-club-id="' + (idClubActivo || "") + '">← Volver</button>' +
        '<button type="button" class="liga1ref-editar-btn" data-accion="editar-liga1ref-stat-inline" data-liga-id="' +
        ligaId + '" data-club-id="' + (idClubActivo || "") + '" data-categoria="' + categoria + '" aria-label="Editar ' + escapeHTML(meta.label) + '">✏️</button>';
      contenedor.appendChild(header);

      var titulo = document.createElement("p");
      titulo.className = "liga1ref-stat-titulo";
      titulo.textContent = meta.icono + " " + meta.label;
      contenedor.appendChild(titulo);

      var filas = ligaId === "1ref" ? calcularLiga1RefStatsCombinado(datos, categoria) : calcularLigaExtraStatFilas(ligaId, categoria);
      if (!filas.length) {
        contenedor.appendChild(nodoEstado(meta.icono, "Todavía no hay datos. Pulsa ✏️ (PIN 646) para añadirlos, o suman solos al añadir eventos de un club humano."));
        return;
      }

      var wrap = document.createElement("div");
      wrap.className = "clasificacion-wrap";
      var tablaEl = document.createElement("table");
      tablaEl.className = "clasificacion-tabla liga1ref-stat-tabla";
      tablaEl.innerHTML = "<thead><tr><th>#</th><th>Jugador</th><th>Equipo</th><th>" + escapeHTML(meta.columna) + "</th></tr></thead>";
      var tbody = document.createElement("tbody");
      filas.forEach(function (f, i) {
        // Fila del propio jugador humano (equipoId = el club activo) —
        // mismo badge "TÚ" + resalte verde neón que ya usa la clasificación
        // de equipos (clasificacion-fila--activo / clasificacion-tag), 0 KB
        // de CSS nuevo. Un jugador de la IA (sin equipoId, viene del texto
        // pegado) nunca lo lleva.
        var esTuyo = !!(f.equipoId && f.equipoId === idClubActivo);
        var tr = document.createElement("tr");
        tr.className = "clasificacion-fila" + (esTuyo ? " clasificacion-fila--activo" : "");
        var valor = meta.decimales ? Number(f.cantidad).toFixed(2) : f.cantidad;
        tr.innerHTML =
          '<td class="clasificacion-pos">' + (i + 1) + "</td>" +
          '<td class="clasificacion-equipo">' + escapeHTML(f.nombre) +
          (esTuyo ? ' <span class="clasificacion-tag">TÚ</span>' : "") + "</td>" +
          '<td class="liga1ref-stat-equipo">' + escapeHTML(f.equipo || "—") + "</td>" +
          '<td class="clasificacion-pts">' + valor + "</td>";
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
  function pintarEditorLiga1Ref(contenedor, idClubActivo, ligaId) {
    ligaId = ligaId || "1ref";
    contenedor.innerHTML = "";

    var nota = document.createElement("p");
    nota.className = "admin-nota";
    nota.textContent =
      "Pega la tabla completa, una línea por equipo: «Pos Nombre Pts PJ PE PP " +
      "G+ G- DG» separado por espacios, tal cual se copia de otro sitio (Pos y " +
      "DG son opcionales, se recalculan solos). Es una clasificación ÚNICA de " +
      (LIGA_NAV_META[ligaId] ? LIGA_NAV_META[ligaId].corta : "esta liga") + " — la ven las 6 cajas igual.";
    contenedor.appendChild(nota);

    // 📌 Fijar/ver qué división es "la suya" (Estado.obtenerDivisionClub,
    // "1ref" por defecto) — la que abrirá su tarjeta de menú a partir de
    // ahora. Vivía junto al título de la liga (molestaba ahí, petición
    // usuario) — ahora vive AQUÍ, dentro del editor ✏️ (PIN 646), junto
    // al resto de acciones de admin. Ya fijada → solo informa (sin
    // acción, no hace falta PIN de nuevo para algo que ya está hecho);
    // sin fijar → botón real que la fija (mismo candado 646 de
    // fijar-division-club de siempre).
    if (idClubActivo && window.Estado) {
      var actualDiv = window.Estado.obtenerDivisionClub(idClubActivo);
      var fijarWrap = document.createElement("div");
      fijarWrap.className = "liga1ref-fijar-wrap";
      fijarWrap.innerHTML = actualDiv === ligaId
        ? '<span class="liga1ref-fijar-info">📌 Esta ya es la liga fijada de este club.</span>'
        : '<button type="button" class="liga1ref-fijar-btn" data-accion="fijar-division-club" data-liga-id="' +
          ligaId + '" data-club-id="' + idClubActivo + '">📌 Fijar esta liga a este club</button>';
      contenedor.appendChild(fijarWrap);
    }

    var textarea = document.createElement("textarea");
    textarea.id = "liga1ref-textarea";
    textarea.className = "admin-roadmap-textarea";
    textarea.rows = 14;
    textarea.placeholder = "1  Real Zaragoza  9  3  0  0  10  0  10\n2  SD Huesca      6  3  0  1  5   2   3";
    textarea.value = window.Estado
      ? (ligaId === "1ref" ? window.Estado.obtenerLiga1RefTexto() : window.Estado.obtenerLigaExtraTexto(ligaId))
      : "";
    contenedor.appendChild(textarea);

    var acciones = document.createElement("div");
    acciones.className = "admin-roadmap-editor-acciones";
    acciones.innerHTML =
      '<button type="button" class="btn-ghost" data-accion="cancelar-liga1ref" data-liga-id="' + ligaId + '" data-club-id="' + (idClubActivo || "") + '">✕ Cancelar</button>' +
      '<button type="button" class="admin-list-add-btn" data-accion="guardar-liga1ref" data-liga-id="' + ligaId + '" data-club-id="' + (idClubActivo || "") + '">💾 Guardar</button>';
    contenedor.appendChild(acciones);
  }

  // Editor inline de UNA categoría de estadística (PIN 646) — mismo
  // patrón exacto que pintarEditorLiga1Ref, pinta dentro del contenedor
  // del ranking para poder Guardar/Cancelar sin cerrar el modal.
  function pintarEditorLiga1RefStat(contenedor, idClubActivo, categoria, ligaId) {
    ligaId = ligaId || "1ref";
    var meta = LIGA1REF_STATS.filter(function (s) { return s.key === categoria; })[0];
    if (!meta) return;
    contenedor.innerHTML = "";

    var nota = document.createElement("p");
    nota.className = "admin-nota";
    nota.textContent = ligaId === "1ref"
      ? ("Pega el ranking, una línea por jugador: «Nombre Jugador - Equipo  " + meta.columna +
        "» (el Nº inicial es opcional, se recalcula solo). Los jugadores de las 6 cajas " +
        "humanas se suman SOLOS al añadir eventos en un partido — no hace falta escribirlos aquí.")
      : ("Pega el ranking, una línea por jugador: «Nombre Jugador - Equipo  " + meta.columna +
        "» (el Nº inicial es opcional, se recalcula solo). 100% texto libre.");
    contenedor.appendChild(nota);

    var textarea = document.createElement("textarea");
    textarea.id = "liga1ref-stat-textarea";
    textarea.className = "admin-roadmap-textarea";
    textarea.rows = 14;
    textarea.placeholder = meta.placeholder || "1º Carlos Fernández - CD Mirandés  7\n2º Ander Herrera - Real Zaragoza  6";
    textarea.value = window.Estado
      ? (ligaId === "1ref" ? window.Estado.obtenerLiga1RefStatTexto(categoria) : window.Estado.obtenerLigaExtraStatTexto(ligaId, categoria))
      : "";
    contenedor.appendChild(textarea);

    var acciones = document.createElement("div");
    acciones.className = "admin-roadmap-editor-acciones";
    acciones.innerHTML =
      '<button type="button" class="btn-ghost" data-accion="cancelar-liga1ref-stat" data-liga-id="' + ligaId + '" data-club-id="' + (idClubActivo || "") + '" data-categoria="' + categoria + '">✕ Cancelar</button>' +
      '<button type="button" class="admin-list-add-btn" data-accion="guardar-liga1ref-stat" data-liga-id="' + ligaId + '" data-club-id="' + (idClubActivo || "") + '" data-categoria="' + categoria + '">💾 Guardar</button>';
    contenedor.appendChild(acciones);
  }

  // ============================================================
  // 3c-quinquies. COPA DEL REY — estado de cada club (ronda + rivales) +
  // Pichichi/MVP/Amarillas/Rojas
  // ============================================================
  // A diferencia de Liga 1ª REF, la Copa NO es una liguilla con clasificación
  // — es un cuadro eliminatorio a partido único donde cada club humano
  // avanza por SU PROPIO camino (rival distinto en cada ronda, puede caer
  // eliminado en cualquiera). No hay "tabla" que pegar: la pantalla es
  // puramente lo que YA está en el calendario de cada club (Calendario
  // extra, competición = "Copa del Rey") — mismo dato, sin duplicar nada
  // nuevo que mantener sincronizado. Las 4 cajas de estadísticas SÍ
  // reutilizan el mismo mecanismo de Liga 1ª REF (texto IA + auto-suma
  // humana) pero con su PROPIA clave — nunca comparten contador con Liga.
  // Sin Zamora: no tiene sentido una "media de la temporada" en un cuadro
  // donde un club puede jugar un solo partido (petición usuario).
  var COPA_STATS = [
    { key: "pichichi", icono: "⚽", label: "PICHICHI", columna: "Goles" },
    { key: "mvp", icono: "⭐", label: "MVP", columna: "MVP" },
    { key: "amarillas", icono: "🟨", label: "T. AMARILLAS", columna: "Amarillas" },
    { key: "rojas", icono: "🟥", label: "T. ROJAS", columna: "Rojas" }
  ];

  // Los 6 clubes humanos pueden jugar Copa del Rey (a diferencia de Liga
  // 1ª REF, PSG NO queda excluido: el admin decide libremente en qué
  // competiciones mete a cada club vía "Calendario extra" — si PSG nunca
  // tiene líneas de Copa, sencillamente no aporta ningún bloque aquí).
  function _copaEquiposHumanos(datos) {
    return datos.equipos.equipos || [];
  }

  // Partidos de Copa de UN club, ordenados por fecha — misma fuente y
  // mismo criterio de orden que el calendario de la propia caja.
  function _copaPartidosDelClub(datos, clubId) {
    return (window.Estado ? window.Estado.listarPartidosResueltos(datos) : [])
      .filter(function (p) {
        return p.competicion === "copa" && (p.local === clubId || p.visitante === clubId);
      })
      .sort(function (a, b) {
        var ta = a.fecha ? new Date(a.fecha).getTime() : (a._fechaFallbackMs || 0);
        var tb = b.fecha ? new Date(b.fecha).getTime() : (b._fechaFallbackMs || 0);
        return ta - tb;
      });
  }

  // Recorre, para cada club humano, sus propios partidos de Copa ya
  // jugados y suma goles/MVP/amarillas/rojas por jugador — de ESTE club
  // (es_humano:true, ficha real) Y del RIVAL IA de cada partido
  // (es_humano:false, nombre real generado por
  // js/acta.js::simularGoleadorAutomatorioIA — mismo criterio que Liga
  // 1ª REF, ver calcularLiga1RefStatsHumanos más arriba).
  function calcularCopaStatsHumanos(datos) {
    var acumulado = { pichichi: {}, mvp: {}, amarillas: {}, rojas: {} };
    var ES_GOL = { GOL: 1, GOL_FAV_FALTA: 1, PENALTI_GOL: 1 };

    function sumar(bucket, jugadorId, nombre, equipo, equipoId) {
      if (!bucket[jugadorId]) bucket[jugadorId] = { nombre: nombre, equipo: equipo, equipoId: equipoId, cantidad: 0 };
      bucket[jugadorId].cantidad++;
    }
    function sumarPorTipo(ev, jugadorId, nombre, equipo, equipoId) {
      if (ES_GOL[ev.tipo]) sumar(acumulado.pichichi, jugadorId, nombre, equipo, equipoId);
      else if (ev.tipo === "MVP") sumar(acumulado.mvp, jugadorId, nombre, equipo, equipoId);
      else if (ev.tipo === "AMARILLA") sumar(acumulado.amarillas, jugadorId, nombre, equipo, equipoId);
      else if (ev.tipo === "ROJA") sumar(acumulado.rojas, jugadorId, nombre, equipo, equipoId);
    }

    _copaEquiposHumanos(datos).forEach(function (e) {
      var nombresPorId = {};
      obtenerJugadoresClub(e.id).forEach(function (j) { nombresPorId[j.id] = j.nombre; });

      _copaPartidosDelClub(datos, e.id).filter(function (p) { return p.jugado; }).forEach(function (p) {
        var oponenteId = p.local === e.id ? p.visitante : p.local;
        (p.eventos || []).forEach(function (ev) {
          if (!ev.jugador_id) return;
          if (ev.equipo_id === e.id) {
            if (!ev.es_humano) return;
            var nombreJ = nombresPorId[ev.jugador_id] || ev.jugador_nombre;
            if (!nombreJ) return;
            sumarPorTipo(ev, ev.jugador_id, nombreJ, e.nombre, e.id);
          } else if (ev.equipo_id === oponenteId && !ev.es_humano) {
            if (!ev.jugador_nombre) return;
            sumarPorTipo(ev, ev.jugador_id, ev.jugador_nombre, ev.equipo_nombre || "Rival IA", oponenteId);
          }
        });
      });
    });

    var salida = {};
    Object.keys(acumulado).forEach(function (k) {
      salida[k] = Object.keys(acumulado[k]).map(function (id) { return acumulado[k][id]; });
    });
    return salida;
  }

  // Ranking final de una categoría: texto pegado (IA) + auto-suma humana,
  // top 15 — mismo criterio que calcularLiga1RefStatsCombinado pero sobre
  // el almacén propio de Copa (Estado.obtenerCopaStatTexto).
  function calcularCopaStatsCombinado(datos, categoria) {
    var equiposHumanos = _copaEquiposHumanos(datos);
    var filas = [];

    var texto = window.Estado ? window.Estado.obtenerCopaStatTexto(categoria) : "";
    parsearLiga1RefStatTexto(texto).forEach(function (it) {
      if (_liga1RefEsNombreHumano(it.equipo, equiposHumanos)) return; // esa fila la aporta la auto-suma
      filas.push(it);
    });

    (calcularCopaStatsHumanos(datos)[categoria] || []).forEach(function (it) { filas.push(it); });

    filas.sort(function (a, b) { return b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre); });
    return filas.slice(0, 15);
  }

  // Bloque "estado de la Copa" de UN club: ronda actual (la de su partido
  // MÁS RECIENTE por fecha, jugado o no — es literalmente "dónde está" en
  // el cuadro ahora mismo) + la lista de sus partidos, cada uno con su
  // ronda/rival/resultado — más qué rondas quedan eliminadas/bloqueadas
  // (mismo cálculo _estadoRondasEliminacion que usa el calendario general,
  // así esta pantalla NUNCA muestra "PREVIA" en una ronda que en realidad
  // no se puede jugar todavía). Devuelve null si el club no tiene ningún
  // partido de Copa todavía (no aporta bloque).
  function _copaEstadoClub(datos, e) {
    var partidos = _copaPartidosDelClub(datos, e.id);
    if (!partidos.length) return null;
    var ultima = partidos[partidos.length - 1];
    var estado = _estadoRondasEliminacion(partidos, e.id);
    return {
      equipo: e, partidos: partidos, rondaActual: ultima.ronda || "—",
      eliminadoIds: estado.eliminadoIds, bloqueadoIds: estado.bloqueadoIds
    };
  }

  function _copaPartidoRowHTML(p, clubId, datos, esEliminado, esBloqueado) {
    var esLocal = p.local === clubId;
    var rival = buscarEquipoPorId(esLocal ? p.visitante : p.local, datos);
    // Mismo criterio que construirTarjetaPartido: rival "?" bloquea aunque
    // el cálculo por orden de ronda no lo haya marcado.
    esBloqueado = esBloqueado || !!(rival && rival.desconocido);
    var claseEstado = "";
    var resultadoHTML;
    if (p.jugado && p.resultado) {
      var golesClub = esLocal ? p.resultado.golesLocal : p.resultado.golesVisitante;
      var golesRival = esLocal ? p.resultado.golesVisitante : p.resultado.golesLocal;
      claseEstado = golesClub > golesRival ? " copa-partido-row--gano"
        : (golesClub === golesRival ? " copa-partido-row--empate" : " copa-partido-row--perdio");
      resultadoHTML = '<span class="copa-partido-resultado">' + golesClub + " - " + golesRival + "</span>";
    } else if (esEliminado) {
      claseEstado = " copa-partido-row--pendiente";
      resultadoHTML = '<span class="copa-partido-resultado">Eliminado</span>';
    } else if (esBloqueado) {
      claseEstado = " copa-partido-row--pendiente";
      resultadoHTML = '<span class="copa-partido-resultado copa-partido-resultado--bloqueado" title="Aún no has ganado la ronda anterior">🔒</span>';
    } else {
      claseEstado = " copa-partido-row--pendiente";
      resultadoHTML = '<span class="copa-partido-resultado">PREVIA</span>';
    }
    return (
      '<div class="copa-partido-row' + claseEstado + '">' +
      '<span class="copa-partido-ronda">' + escapeHTML(p.ronda || "—") + "</span>" +
      crearEscudoHTML(rival, "escudo--sm") +
      '<span class="copa-partido-rival">' + escapeHTML(esLocal ? "vs " : "@ ") + escapeHTML(rival ? rival.nombre : "Rival") + "</span>" +
      resultadoHTML +
      "</div>"
    );
  }

  // Texto EXACTO del ℹ️ de Copa del Rey (petición usuario, verbatim) —
  // mismo overlay propio que Liga 1ª REF/Superliga (ver
  // js/main.js::mostrarInfoCopa/_abrirInfoOverlay).
  var FORMATO_COPA_TEXTO = [
    "📋FORMATO COPA:",
    "64 Clubes participan en 7 eliminatorias desde 1/64 de final hasta la final.",
    "",
    "👥️FORMATO ELIMINATORIAS:",
    "1/64  partido único con prórroga y penaltis .",
    "Dieciseisavos partido único con prórroga y penaltis.",
    "Octavos partido único con prórroga y penaltis .",
    "Cuartos partido único con prórroga y penaltis .",
    "Semis partidos a ida y vuelta con gol doble fuera de casa, en caso de empate se reinicia el tercer partido con gol de oro.",
    "Final partido único con prórroga y penaltis ",
    "",
    " * Reparto de localía: ",
    "Los equipos mas débiles siempre juegan como Local",
    "",
    "🏁RESOLUCIÓN  COPA:",
    " 🥈 EL Campeón y Subcampeon juegan la Recopa de Europa la próxima temporada."
  ].join("\n");
  function obtenerFormatoCopaTexto() {
    var override = window.Estado ? window.Estado.obtenerFormatoOverride("copa") : "";
    return override || FORMATO_COPA_TEXTO;
  }

  function renderizarCopaDelRey(contenedorId, idClubActivo) {
    var contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;
    contenedor.innerHTML = "";
    contenedor.appendChild(nodoEstado("⏳", "Cargando…"));

    cargarTodo().then(function (datos) {
      contenedor.innerHTML = "";

      // El club activo va primero (es el que se acaba de abrir); el resto,
      // alfabético — nunca por "quién va más lejos" (no hay clasificación
      // que ordenar en un cuadro eliminatorio).
      var equiposHumanos = _copaEquiposHumanos(datos).slice().sort(function (a, b) {
        if (a.id === idClubActivo) return -1;
        if (b.id === idClubActivo) return 1;
        return a.nombre.localeCompare(b.nombre);
      });

      var bloques = equiposHumanos
        .map(function (e) { return _copaEstadoClub(datos, e); })
        .filter(Boolean);

      if (!bloques.length) {
        contenedor.appendChild(nodoEstado("🏆", "Todavía no hay partidos de Copa del Rey. Añádelos desde el ✏️ de cada caja (Calendario extra → Competición «Copa del Rey»)."));
      } else {
        bloques.forEach(function (b, bi) {
          // Separador ENTRE bloques de equipo (nunca antes del primero —
          // el header ya hace de corte ahí) — petición usuario: cada club
          // tiene su propio cuadro completo (1/64 → Final), sin ninguna
          // línea que marque dónde acaba uno y empieza el siguiente.
          if (bi > 0) contenedor.appendChild(nodoSeparador());
          var esActivo = b.equipo.id === idClubActivo;
          var bloque = document.createElement("div");
          bloque.className = "copa-club-block" + (esActivo ? " copa-club-block--activo" : "");
          bloque.innerHTML =
            '<div class="copa-club-header">' +
            crearEscudoHTML(b.equipo, "escudo--sm") +
            '<span class="copa-club-nombre">' + (b.equipo.misterEmoji || "") + escapeHTML(b.equipo.nombre) +
            (esActivo ? ' <span class="clasificacion-tag">TÚ</span>' : "") + "</span>" +
            '<span class="copa-club-ronda">' + escapeHTML(b.rondaActual) + "</span>" +
            "</div>" +
            '<div class="copa-club-partidos">' +
            b.partidos.map(function (p) { return _copaPartidoRowHTML(p, b.equipo.id, datos, !!b.eliminadoIds[p.id], !!b.bloqueadoIds[p.id]); }).join("") +
            "</div>";
          contenedor.appendChild(bloque);
        });
        // Leyenda plegable, debajo de TODOS los cuadros (mismo patrón
        // colapsable que 2ª REF/1ª REF/Hypermotion/Ea Sports/Superliga)
        // — antes vivía fija arriba del todo, antes de cualquier club.
        contenedor.insertAdjacentHTML("beforeend", _leyendaDetailsHTML(
          '<div class="liga1ref-leyenda-grid">' +
          "<span>🥈 Recopa Campeón y Subcampeón</span></div>"
        ));
      }

      contenedor.appendChild(nodoSeparador());
      contenedor.appendChild(nodoTituloEstadisticas());

      // Cajas de estadísticas — Pichichi/MVP/Amarillas/Rojas (sin Zamora).
      var statsGrid = document.createElement("div");
      statsGrid.className = "liga1ref-stats-grid";
      statsGrid.innerHTML = COPA_STATS.map(function (s) {
        return '<button type="button" class="liga1ref-stat-box" data-accion="ver-copa-stat" data-club-id="' +
          (idClubActivo || "") + '" data-categoria="' + s.key + '"><span class="liga1ref-stat-box-icono">' +
          s.icono + '</span><span class="liga1ref-stat-box-label">' + escapeHTML(s.label) + "</span></button>";
      }).join("");
      contenedor.appendChild(statsGrid);
    });
  }

  // Ranking (top 15) de UNA categoría de Copa — mismo patrón exacto que
  // renderizarLiga1RefStatDetalle, con su propio botón "← Volver".
  function renderizarCopaStatDetalle(contenedorId, idClubActivo, categoria) {
    var contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;
    var meta = COPA_STATS.filter(function (s) { return s.key === categoria; })[0];
    if (!meta) return;
    contenedor.innerHTML = "";
    contenedor.appendChild(nodoEstado("⏳", "Cargando…"));

    cargarTodo().then(function (datos) {
      contenedor.innerHTML = "";

      var header = document.createElement("div");
      header.className = "liga1ref-header";
      header.innerHTML =
        '<button type="button" class="btn-ghost liga1ref-volver-btn" data-accion="volver-copa" data-club-id="' +
        (idClubActivo || "") + '">← Volver</button>' +
        '<button type="button" class="liga1ref-editar-btn" data-accion="editar-copa-stat-inline" data-club-id="' +
        (idClubActivo || "") + '" data-categoria="' + categoria + '" aria-label="Editar ' + escapeHTML(meta.label) + '">✏️</button>';
      contenedor.appendChild(header);

      var titulo = document.createElement("p");
      titulo.className = "liga1ref-stat-titulo";
      titulo.textContent = meta.icono + " " + meta.label;
      contenedor.appendChild(titulo);

      var filas = calcularCopaStatsCombinado(datos, categoria);
      if (!filas.length) {
        contenedor.appendChild(nodoEstado(meta.icono, "Todavía no hay datos. Pulsa ✏️ (PIN 646) para añadirlos, o suman solos al añadir eventos de un club humano."));
        return;
      }

      var wrap = document.createElement("div");
      wrap.className = "clasificacion-wrap";
      var tablaEl = document.createElement("table");
      tablaEl.className = "clasificacion-tabla liga1ref-stat-tabla";
      tablaEl.innerHTML = "<thead><tr><th>#</th><th>Jugador</th><th>Equipo</th><th>" + escapeHTML(meta.columna) + "</th></tr></thead>";
      var tbody = document.createElement("tbody");
      filas.forEach(function (f, i) {
        var esTuyo = !!(f.equipoId && f.equipoId === idClubActivo);
        var tr = document.createElement("tr");
        tr.className = "clasificacion-fila" + (esTuyo ? " clasificacion-fila--activo" : "");
        tr.innerHTML =
          '<td class="clasificacion-pos">' + (i + 1) + "</td>" +
          '<td class="clasificacion-equipo">' + escapeHTML(f.nombre) +
          (esTuyo ? ' <span class="clasificacion-tag">TÚ</span>' : "") + "</td>" +
          '<td class="liga1ref-stat-equipo">' + escapeHTML(f.equipo || "—") + "</td>" +
          '<td class="clasificacion-pts">' + f.cantidad + "</td>";
        tbody.appendChild(tr);
      });
      tablaEl.appendChild(tbody);
      wrap.appendChild(tablaEl);
      contenedor.appendChild(wrap);
    });
  }

  // Editor inline de UNA categoría de estadística de Copa (PIN 646) —
  // mismo patrón exacto que pintarEditorLiga1RefStat.
  function pintarEditorCopaStat(contenedor, idClubActivo, categoria) {
    var meta = COPA_STATS.filter(function (s) { return s.key === categoria; })[0];
    if (!meta) return;
    contenedor.innerHTML = "";

    var nota = document.createElement("p");
    nota.className = "admin-nota";
    nota.textContent =
      "Pega el ranking, una línea por jugador: «Nombre Jugador - Equipo  " + meta.columna +
      "» (el Nº inicial es opcional, se recalcula solo). Los jugadores de las 6 cajas " +
      "humanas se suman SOLOS al añadir eventos en un partido de Copa — no hace falta escribirlos aquí.";
    contenedor.appendChild(nota);

    var textarea = document.createElement("textarea");
    textarea.id = "copa-stat-textarea";
    textarea.className = "admin-roadmap-textarea";
    textarea.rows = 14;
    textarea.placeholder = "1º Carlos Fernández - CD Mirandés  3\n2º Ander Herrera - Real Zaragoza  2";
    textarea.value = window.Estado ? window.Estado.obtenerCopaStatTexto(categoria) : "";
    contenedor.appendChild(textarea);

    var acciones = document.createElement("div");
    acciones.className = "admin-roadmap-editor-acciones";
    acciones.innerHTML =
      '<button type="button" class="btn-ghost" data-accion="cancelar-copa-stat" data-club-id="' + (idClubActivo || "") + '" data-categoria="' + categoria + '">✕ Cancelar</button>' +
      '<button type="button" class="admin-list-add-btn" data-accion="guardar-copa-stat" data-club-id="' + (idClubActivo || "") + '" data-categoria="' + categoria + '">💾 Guardar</button>';
    contenedor.appendChild(acciones);
  }

  // ============================================================
  // SUPERLIGA — los 6 clubes humanos, todos contra todos (calendario
  // generado por Estado.listarPartidosResueltos, ver js/estado.js). A
  // diferencia de Liga 1ª REF y Copa del Rey, NO hay texto libre que
  // pegar — es 100% humano-vs-humano, así que la clasificación Y las 5
  // estadísticas (Pichichi/MVP/Amarillas/Rojas/Zamora, igual que Liga 1ª
  // REF) se auto-calculan siempre desde los partidos ya jugados, sin
  // ningún editor ni PIN.
  // ============================================================
  var SUPERLIGA_STATS = [
    { key: "pichichi", icono: "⚽", label: "PICHICHI", columna: "Goles" },
    { key: "mvp", icono: "⭐", label: "MVP", columna: "MVP" },
    { key: "amarillas", icono: "🟨", label: "T. AMARILLAS", columna: "Amarillas" },
    { key: "rojas", icono: "🟥", label: "T. ROJAS", columna: "Rojas" },
    { key: "zamora", icono: "🧤", label: "ZAMORA", columna: "Media", asc: true, decimales: true }
  ];

  function _superligaEquiposHumanos(datos) {
    return datos.equipos.equipos || [];
  }

  function _superligaPartidosDelClub(datos, clubId) {
    return (window.Estado ? window.Estado.listarPartidosResueltos(datos) : []).filter(function (p) {
      return p.competicion === "superliga" && (p.local === clubId || p.visitante === clubId);
    });
  }

  // Clasificación de la liguilla — misma fórmula (3/1/0, DG, goles a
  // favor) que Estado.calcularClasificacion, pero sobre los partidos de
  // Superliga de los 6 humanos (nunca hay rival IA que fusionar).
  function calcularSuperliga(datos) {
    var equipos = _superligaEquiposHumanos(datos);
    var partidos = (window.Estado ? window.Estado.listarPartidosResueltos(datos) : []).filter(function (p) {
      return p.competicion === "superliga" && p.jugado && p.resultado;
    });

    var tabla = {};
    equipos.forEach(function (e) {
      tabla[e.id] = { equipo: e, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 };
    });

    partidos.forEach(function (p) {
      var L = tabla[p.local], V = tabla[p.visitante];
      if (!L || !V) return;
      var gl = p.resultado.golesLocal, gv = p.resultado.golesVisitante;
      L.pj++; V.pj++;
      L.gf += gl; L.gc += gv;
      V.gf += gv; V.gc += gl;
      if (gl > gv) { L.pg++; L.pts += 3; V.pp++; }
      else if (gl < gv) { V.pg++; V.pts += 3; L.pp++; }
      else { L.pe++; V.pe++; L.pts += 1; V.pts += 1; }
    });

    var filas = equipos.map(function (e) { return tabla[e.id]; });
    filas.sort(function (a, b) {
      if (b.pts !== a.pts) return b.pts - a.pts;
      var dgA = a.gf - a.gc, dgB = b.gf - b.gc;
      if (dgB !== dgA) return dgB - dgA;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.equipo.nombre.localeCompare(b.equipo.nombre);
    });
    return filas;
  }

  // 🟪 CAMPEÓN (1º) · 🟨 SUBCAMPEÓN (2º) · 🟥 FAROLILLO (último) — los 3
  // únicos puestos con badge, pedidos explícitamente por el usuario.
  function _superligaZona(pos, total) {
    if (pos === 1) return "campeon";
    if (pos === 2) return "subcampeon";
    if (total && pos === total) return "farolillo";
    return "";
  }

  // Recorre, para cada uno de los 6 humanos, sus propios partidos de
  // Superliga ya jugados y suma goles/MVP/amarillas/rojas por jugador
  // (solo eventos es_humano:true — un partido HvH trae eventos de los 2
  // lados, cada club suma solo los suyos) + Zamora (media de goles
  // encajados por el portero titular) — mismo criterio EXACTO que
  // calcularLiga1RefStatsHumanos/calcularCopaStatsHumanos.
  function calcularSuperligaStatsHumanos(datos) {
    var acumulado = { pichichi: {}, mvp: {}, amarillas: {}, rojas: {}, zamora: {} };
    var ES_GOL = { GOL: 1, GOL_FAV_FALTA: 1, PENALTI_GOL: 1 };

    function sumar(bucket, jugadorId, nombre, equipo, equipoId) {
      if (!bucket[jugadorId]) bucket[jugadorId] = { nombre: nombre, equipo: equipo, equipoId: equipoId, cantidad: 0 };
      bucket[jugadorId].cantidad++;
    }

    _superligaEquiposHumanos(datos).forEach(function (e) {
      var nombresPorId = {};
      obtenerJugadoresClub(e.id).forEach(function (j) { nombresPorId[j.id] = j.nombre; });
      var portero = _porteroPrincipalClub(e.id);
      var zamoraEncajados = 0, zamoraPartidos = 0;

      _superligaPartidosDelClub(datos, e.id).filter(function (p) { return p.jugado; }).forEach(function (p) {
        (p.eventos || []).forEach(function (ev) {
          if (!ev.es_humano || !ev.jugador_id || ev.equipo_id !== e.id) return;
          var nombreJ = nombresPorId[ev.jugador_id] || ev.jugador_nombre;
          if (!nombreJ) return;
          if (ES_GOL[ev.tipo]) sumar(acumulado.pichichi, ev.jugador_id, nombreJ, e.nombre, e.id);
          else if (ev.tipo === "MVP") sumar(acumulado.mvp, ev.jugador_id, nombreJ, e.nombre, e.id);
          else if (ev.tipo === "AMARILLA") sumar(acumulado.amarillas, ev.jugador_id, nombreJ, e.nombre, e.id);
          else if (ev.tipo === "ROJA") sumar(acumulado.rojas, ev.jugador_id, nombreJ, e.nombre, e.id);
        });

        if (!portero || !p.resultado) return;
        var encajados = p.local === e.id ? p.resultado.golesVisitante
          : p.visitante === e.id ? p.resultado.golesLocal : null;
        if (encajados === null) return;
        zamoraEncajados += encajados;
        zamoraPartidos++;
      });

      if (portero && zamoraPartidos > 0) {
        acumulado.zamora[portero.id] = {
          nombre: portero.nombre, equipo: e.nombre, equipoId: e.id,
          cantidad: Math.round((zamoraEncajados / zamoraPartidos) * 100) / 100
        };
      }
    });

    var salida = {};
    Object.keys(acumulado).forEach(function (k) {
      salida[k] = Object.keys(acumulado[k]).map(function (id) { return acumulado[k][id]; });
    });
    return salida;
  }

  // Ranking final de una categoría — top 15, sin texto pegado que
  // fusionar (100% auto-suma). Zamora ordena ascendente (menos goles de
  // media es mejor), igual que Liga 1ª REF.
  function calcularSuperligaStatsCombinado(datos, categoria) {
    var meta = SUPERLIGA_STATS.filter(function (s) { return s.key === categoria; })[0];
    var filas = (calcularSuperligaStatsHumanos(datos)[categoria] || []).slice();
    filas.sort(function (a, b) {
      var diff = meta && meta.asc ? a.cantidad - b.cantidad : b.cantidad - a.cantidad;
      return diff || a.nombre.localeCompare(b.nombre);
    });
    return filas.slice(0, 15);
  }

  // Agrupa los 15 partidos de Superliga del club activo por RIVAL (5
  // grupos de 3 — un cruce SIEMPRE juega sus 3 partidos con la misma
  // localía, ver Estado._partidosSuperliga), en el orden CANÓNICO de
  // data/equipos.json (estable y predecible, no el orden de generación).
  function _superligaGrupoPorRival(datos, clubId) {
    var equipos = datos.equipos.equipos || [];
    var partidos = _superligaPartidosDelClub(datos, clubId);
    var porRival = {};
    partidos.forEach(function (p) {
      var esLocal = p.local === clubId;
      var rivalId = esLocal ? p.visitante : p.local;
      if (!porRival[rivalId]) porRival[rivalId] = { rivalId: rivalId, esLocal: esLocal, partidos: [] };
      porRival[rivalId].partidos.push(p);
    });
    return equipos
      .filter(function (e) { return e.id !== clubId && porRival[e.id]; })
      .map(function (e) { return porRival[e.id]; });
  }

  // Reparte los 5 grupos de rivales en "Jornadas" alternando localía
  // (H,A,H,A,H o A,H,A,H,A según cuál sea el grupo mayoritario — con 6
  // clubes SIEMPRE es 3/2) — mismo espíritu que el ejemplo del usuario
  // ("Superliga- 1ª Jornada... local / 2ª Jornada... visitante / 3ª
  // Jornada... local"), sin depender de un calendario global sincronizado
  // entre los 6 clubes (cada uno calcula el suyo al vuelo, en el render).
  function _superligaOrdenJornadas(grupos) {
    var casa = grupos.filter(function (g) { return g.esLocal; });
    var fuera = grupos.filter(function (g) { return !g.esLocal; });
    var mayor = casa.length >= fuera.length ? casa : fuera;
    var menor = casa.length >= fuera.length ? fuera : casa;
    var out = [];
    for (var i = 0; i < mayor.length; i++) {
      out.push(mayor[i]);
      if (menor[i]) out.push(menor[i]);
    }
    return out;
  }

  // Texto EXACTO del ℹ️ de Superliga (petición usuario, verbatim) — mismo
  // overlay propio que el de Liga 1ª REF/2ª REF/Hypermotion/Ea Sports
  // (ver js/main.js::mostrarInfoSuperliga/_abrirInfoOverlay).
  var FORMATO_SUPERLIGA_TEXTO = [
    "📋FORMATO SUPERLIGA:",
    "6 clubes humanos todos contra todos a 3 vueltas (3 partidos contra cada equipo humano jugando,, total de 15 partidos cada club humano)",
    "",
    "🏁RESOLUCION CLASIFICACIÓN:",
    "🟣1º Es Campeón y busca rival digno para derby decente",
    "🟨2º Subcampeón",
    "🔴6º Farolillo rojo y necesita ajustes o un plan mejor."
  ].join("\n");
  function obtenerFormatoSuperligaTexto() {
    var override = window.Estado ? window.Estado.obtenerFormatoOverride("superliga") : "";
    return override || FORMATO_SUPERLIGA_TEXTO;
  }

  function renderizarSuperliga(contenedorId, idClubActivo) {
    var contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;
    contenedor.innerHTML = "";
    contenedor.appendChild(nodoEstado("⏳", "Cargando…"));

    cargarTodo().then(function (datos) {
      contenedor.innerHTML = "";

      // Sin ✏️ (nada que pegar, todo se auto-calcula). La ℹ️ ya no vive
      // aquí dentro — está en la cabecera del propio modal ("ℹ️
      // Superliga", ver js/main.js::abrirModalClub). La leyenda baja
      // debajo de la tabla (mismo criterio que Liga 1ª REF/2ª REF/
      // Hypermotion/Ea Sports).
      var filas = calcularSuperliga(datos);
      var wrap = document.createElement("div");
      wrap.className = "clasificacion-wrap";
      var tablaEl = document.createElement("table");
      tablaEl.className = "clasificacion-tabla liga1ref-tabla";
      tablaEl.innerHTML =
        "<thead><tr><th>#</th><th>Equipo</th><th>Pts</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th>" +
        "<th>G+</th><th>G-</th><th>DG</th></tr></thead>";
      var tbody = document.createElement("tbody");
      filas.forEach(function (f, i) {
        var pos = i + 1;
        var dg = f.gf - f.gc;
        var zona = _superligaZona(pos, filas.length);
        var esTuyo = f.equipo.id === idClubActivo;
        var tr = document.createElement("tr");
        tr.className = "clasificacion-fila" + (zona ? " superliga-zona-" + zona : "") + (esTuyo ? " clasificacion-fila--activo" : "");
        tr.innerHTML =
          '<td class="clasificacion-pos">' + pos + "</td>" +
          '<td class="clasificacion-equipo">' + (f.equipo.misterEmoji || "") + escapeHTML(f.equipo.nombre) +
          (esTuyo ? ' <span class="clasificacion-tag">TÚ</span>' : "") + "</td>" +
          '<td class="clasificacion-pts">' + f.pts + "</td>" +
          "<td>" + f.pj + "</td><td>" + f.pg + "</td><td>" + f.pe + "</td><td>" + f.pp + "</td>" +
          "<td>" + f.gf + "</td><td>" + f.gc + "</td>" +
          "<td>" + (dg > 0 ? "+" + dg : dg) + "</td>";
        tbody.appendChild(tr);
      });
      tablaEl.appendChild(tbody);
      wrap.appendChild(tablaEl);
      contenedor.appendChild(wrap);
      contenedor.insertAdjacentHTML("beforeend",
        _leyendaDetailsHTML('<div class="liga1ref-leyenda-grid liga1ref-leyenda-grid--superliga"><span>🟪 Campeón</span><span>🟨 Subcampeón</span><span>🟥 Farolillo</span></div>'));

      // Calendario — SOLO los 15 partidos del club activo (5 rivales x 3),
      // nunca los 45 de toda la Superliga ("para no subir KB", petición
      // usuario). Reusa construirTarjetaPartido tal cual (mismo botón
      // PREVIA que el calendario general) — el partido.id es el MISMO
      // objeto de Estado.listarPartidosResueltos, así que el click
      // funciona sin cablear nada nuevo. `ronda` se clona SOLO para
      // pintar la etiqueta "Nª Jornada" — nunca se persiste.
      var equipoActivo = buscarEquipoPorId(idClubActivo, datos);
      var grupos = _superligaOrdenJornadas(_superligaGrupoPorRival(datos, idClubActivo));
      if (equipoActivo && grupos.length) {
        contenedor.appendChild(nodoSeparador());

        var calTitulo = document.createElement("p");
        calTitulo.className = "liga1ref-stat-titulo titulo-cursiva";
        calTitulo.textContent = "📅 Calendario de " + equipoActivo.nombre;
        contenedor.appendChild(calTitulo);

        // El botón PREVIA de cada card reutiliza abrirPreviaPartido, que
        // resuelve el partido buscándolo en _ultimoContexto.partidosPorId
        // (el mapa que rellena generarCalendarioLateralDerecho para el
        // calendario GENERAL) — pero ese mapa EXCLUYE a propósito los
        // partidos de Superliga (no salen en el calendario general, ver
        // comentario ahí). Sin registrarlos aquí también, PREVIA se
        // quedaba sin encontrar el partido y no hacía nada (bug real,
        // foto usuario: "como si las cards hubieran sido eliminadas").
        // Si el calendario general de este mismo club ya está pintado
        // (caso normal — la Superliga se abre DESDE la pantalla del
        // club), reutilizamos ese mismo contexto; si no existiera aún,
        // se crea uno mínimo para este club.
        if (!_ultimoContexto || !_ultimoContexto.equipo || _ultimoContexto.equipo.id !== idClubActivo) {
          _ultimoContexto = {
            datos: datos,
            equipo: equipoActivo,
            totalJornadas: TOTAL_JORNADAS_POR_LIGA[equipoActivo.ligaActual] || 38,
            partidosPorId: {}
          };
        }

        var calWrap = document.createElement("div");
        calWrap.className = "superliga-calendario";
        grupos.forEach(function (g, gi) {
          var numJornada = gi + 1;
          var rondaTxt = numJornada + "ª Jornada";
          // Jornadas pares en blanco en vez de fucsia (petición usuario:
          // con las 3 cards de cada jornada idénticas, jornadas
          // consecutivas se veían "todas la misma").
          var esPar = numJornada % 2 === 0;
          var grupoEl = document.createElement("div");
          grupoEl.className = "superliga-calendario-grupo";
          g.partidos.forEach(function (p) {
            _ultimoContexto.partidosPorId[p.id] = p;
            var clon = {};
            for (var k in p) if (p.hasOwnProperty(k)) clon[k] = p[k];
            clon.ronda = rondaTxt;
            var card = construirTarjetaPartido(clon, idClubActivo, datos, null, false);
            if (esPar) card.className += " superliga-jornada-par";
            grupoEl.appendChild(card);
          });
          calWrap.appendChild(grupoEl);
        });
        contenedor.appendChild(calWrap);
      }

      contenedor.appendChild(nodoSeparador());
      contenedor.appendChild(nodoTituloEstadisticas());

      // Cajas de estadísticas — Pichichi/MVP/Amarillas/Rojas/Zamora, sin
      // ✏️ (no hay nada que pegar, se suman solas).
      var statsGrid = document.createElement("div");
      statsGrid.className = "liga1ref-stats-grid";
      statsGrid.innerHTML = SUPERLIGA_STATS.map(function (s) {
        return '<button type="button" class="liga1ref-stat-box" data-accion="ver-superliga-stat" data-club-id="' +
          (idClubActivo || "") + '" data-categoria="' + s.key + '"><span class="liga1ref-stat-box-icono">' +
          s.icono + '</span><span class="liga1ref-stat-box-label">' + escapeHTML(s.label) + "</span></button>";
      }).join("");
      contenedor.appendChild(statsGrid);
    });
  }

  // Ranking (top 15) de UNA categoría de Superliga — mismo patrón que
  // renderizarCopaStatDetalle, sin botón ✏️ (nada que editar).
  function renderizarSuperligaStatDetalle(contenedorId, idClubActivo, categoria) {
    var contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;
    var meta = SUPERLIGA_STATS.filter(function (s) { return s.key === categoria; })[0];
    if (!meta) return;
    contenedor.innerHTML = "";
    contenedor.appendChild(nodoEstado("⏳", "Cargando…"));

    cargarTodo().then(function (datos) {
      contenedor.innerHTML = "";

      var header = document.createElement("div");
      header.className = "liga1ref-header";
      header.innerHTML =
        '<button type="button" class="btn-ghost liga1ref-volver-btn" data-accion="volver-superliga" data-club-id="' +
        (idClubActivo || "") + '">← Volver</button>';
      contenedor.appendChild(header);

      var titulo = document.createElement("p");
      titulo.className = "liga1ref-stat-titulo";
      titulo.textContent = meta.icono + " " + meta.label;
      contenedor.appendChild(titulo);

      var filas = calcularSuperligaStatsCombinado(datos, categoria);
      if (!filas.length) {
        contenedor.appendChild(nodoEstado(meta.icono, "Todavía no hay datos — se suman solos al añadir eventos en un partido de Superliga."));
        return;
      }

      var wrap = document.createElement("div");
      wrap.className = "clasificacion-wrap";
      var tablaEl = document.createElement("table");
      tablaEl.className = "clasificacion-tabla liga1ref-stat-tabla";
      tablaEl.innerHTML = "<thead><tr><th>#</th><th>Jugador</th><th>Equipo</th><th>" + escapeHTML(meta.columna) + "</th></tr></thead>";
      var tbody = document.createElement("tbody");
      filas.forEach(function (f, i) {
        var esTuyo = !!(f.equipoId && f.equipoId === idClubActivo);
        var tr = document.createElement("tr");
        tr.className = "clasificacion-fila" + (esTuyo ? " clasificacion-fila--activo" : "");
        var valor = meta.decimales ? Number(f.cantidad).toFixed(2) : f.cantidad;
        tr.innerHTML =
          '<td class="clasificacion-pos">' + (i + 1) + "</td>" +
          '<td class="clasificacion-equipo">' + escapeHTML(f.nombre) +
          (esTuyo ? ' <span class="clasificacion-tag">TÚ</span>' : "") + "</td>" +
          '<td class="liga1ref-stat-equipo">' + escapeHTML(f.equipo || "—") + "</td>" +
          '<td class="clasificacion-pts">' + valor + "</td>";
        tbody.appendChild(tr);
      });
      tablaEl.appendChild(tbody);
      wrap.appendChild(tablaEl);
      contenedor.appendChild(wrap);
    });
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
  // Orden del resumen de arriba — distinto al de los estantes de abajo
  // (petición usuario: "Clubes - Selección - Individuales").
  var TITULOS_RESUMEN_ORDEN = ["club", "seleccion", "individual"];

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

      // Resumen — nº TOTAL de títulos ganados por estante (suma de veces,
      // no nº de trofeos distintos): "3 títulos de Champions+Copa+Kao Cup"
      // cuenta 3, no 1. Siempre visible, incluso en 0 (petición usuario,
      // "arriba el número total Clubes - Selección - Individuales").
      var totales = { club: 0, individual: 0, seleccion: 0 };
      ganados.forEach(function (g) { totales[g.categoria] = (totales[g.categoria] || 0) + g.veces; });
      var resumen = document.createElement("div");
      resumen.className = "titulos-resumen";
      resumen.innerHTML = TITULOS_RESUMEN_ORDEN.map(function (cat) {
        return '<span class="titulos-resumen-item"><b>' + totales[cat] + "</b> " + TITULOS_CATEGORIA_LABEL[cat] + "</span>";
      }).join("");
      contenedor.appendChild(resumen);

      if (!ganados.length) {
        contenedor.appendChild(nodoEstado("🏆", "Sin títulos todavía. Pulsa ✏️ para poner a cuántos ganaste cada uno."));
        return;
      }

      // Separador ENTRE categorías (Clubes / Individuales / Selecciones —
      // petición usuario: "un borde separador... para diferenciarlos"),
      // nunca antes de la primera categoría que tenga algo que mostrar.
      var primeraCategoriaPintada = true;
      TITULOS_CATEGORIA_ORDEN.forEach(function (cat) {
        var deEstaCategoria = ganados.filter(function (g) { return g.categoria === cat; });
        if (!deEstaCategoria.length) return;
        if (!primeraCategoriaPintada) contenedor.appendChild(nodoSeparador());
        primeraCategoriaPintada = false;
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

  // ============================================================
  // OBJETIVOS DEL CLUB — 4 cajas FIJAS (Liga/Copa/Superliga/Globales),
  // iguales para los 6 humanos pero cada uno con su propio texto/número
  // (candado 646, texto libre — a diferencia de Títulos, aquí el admin
  // SÍ puede añadir/quitar objetivos enteros, no solo tocar un número de
  // un catálogo cerrado). Cada objetivo vale 1 o 2 puntos; tocar la fila
  // la marca LOGRADA (sin PIN — es el progreso del propio mánager). La
  // suma real para "seguir en el club la temporada que viene" la lleva
  // el usuario a mano en el 💼 de la cabecera (ver
  // Estado.obtenerValoracionClub/guardarValoracionClub) — estos puntos
  // son solo un contador de referencia, no se suman solos al 💼.
  // ============================================================
  var OBJETIVOS_SECCION_ORDEN = ["LIGA", "COPA", "SUPERLIGA", "GLOBALES"];
  var OBJETIVOS_SECCION_NOMBRE = { LIGA: "Liga", COPA: "Copa", SUPERLIGA: "Superliga", GLOBALES: "Globales" };
  // Iconos por defecto — SOLO se usan si Estado no está disponible; la
  // fuente real (editable por el admin, candado 646) es
  // Estado.obtenerObjetivosIconos/guardarObjetivosIconoSeccion.
  var OBJETIVOS_ICONOS_DEFAULT = { LIGA: "🏆", COPA: "🎖️", SUPERLIGA: "🌟", GLOBALES: "🌍" };

  // "# SECCIÓN" (LIGA/COPA/SUPERLIGA/GLOBALES) abre caja; toda línea
  // siguiente "Texto - N" (N=1 o 2, cualquier otro valor cae a 1) es un
  // objetivo de esa caja. Una cabecera desconocida se ignora junto con
  // sus líneas (catálogo de cajas CERRADO a las 4 de la pantalla,
  // aunque el TEXTO de dentro sea libre). `clave` identifica el
  // objetivo para el progreso marcado — por sección+texto, así cambiar
  // solo el nº de puntos de una línea no borra el progreso ya tocado.
  //
  // La cabecera admite texto EXTRA tras la palabra clave (p.ej.
  // "# LIGA 1ª REF" o "# COPA DEL REY") — se sigue mapeando a esa caja
  // (por prefijo, con límite de palabra) y el texto completo se guarda
  // como TÍTULO visible de la caja (bug 2026: escribir "# LIGA 1ª REF"
  // hacía que todos los objetivos de Liga desaparecieran porque solo
  // se reconocía la palabra exacta "LIGA").
  //
  // La línea de objetivo tolera espacios irregulares alrededor del
  // guion y que falte el número de puntos: se busca el ÚLTIMO "-" de la
  // línea; si no hay número válido detrás (vacío, sin espacio, mal
  // escrito…) el objetivo se guarda igual con 1 punto por defecto, en
  // vez de descartarse en silencio como antes.
  function parsearObjetivosTexto(texto) {
    var secciones = {}, etiquetas = {};
    OBJETIVOS_SECCION_ORDEN.forEach(function (s) { secciones[s] = []; });
    var actual = null;
    (texto || "").split("\n").forEach(function (linea) {
      var l = linea.trim();
      if (!l) return;
      var mHeader = l.match(/^#\s*(.+)$/);
      if (mHeader) {
        var etiqueta = mHeader[1].trim();
        var norm = etiqueta.toUpperCase();
        var clave = null;
        for (var i = 0; i < OBJETIVOS_SECCION_ORDEN.length; i++) {
          var k = OBJETIVOS_SECCION_ORDEN[i];
          if (new RegExp("^" + k + "\\b").test(norm)) { clave = k; break; }
        }
        actual = clave;
        if (clave && norm !== clave) etiquetas[clave] = etiqueta;
        return;
      }
      if (!actual) return;
      var idx = l.lastIndexOf("-");
      var objTexto, puntos;
      if (idx === -1) {
        objTexto = l;
        puntos = 1;
      } else {
        objTexto = l.slice(0, idx).trim();
        var ptsNum = parseInt(l.slice(idx + 1).trim(), 10);
        puntos = (ptsNum === 1 || ptsNum === 2) ? ptsNum : 1;
      }
      if (!objTexto) return;
      secciones[actual].push({ texto: objTexto, puntos: puntos, clave: actual + "::" + objTexto });
    });
    return { secciones: secciones, etiquetas: etiquetas };
  }

  // Puntos LOGRADOS / TOTALES de los objetivos de un club — extraído de
  // renderizarObjetivos para poder reutilizarlo desde fuera (js/main.js
  // sincroniza el 💼 de la cabecera con este mismo cálculo cada vez que
  // se marca/desmarca un objetivo, para que nunca puedan desincronizarse).
  function calcularObjetivosPuntos(idClubActivo) {
    var texto = window.Estado ? window.Estado.obtenerObjetivosTexto(idClubActivo) : "";
    var secciones = parsearObjetivosTexto(texto).secciones;
    var logrados = window.Estado ? window.Estado.obtenerObjetivosLogrados(idClubActivo) : [];
    var logradosSet = {};
    logrados.forEach(function (c) { logradosSet[c] = true; });
    var totalPts = 0, ptsLogrados = 0;
    OBJETIVOS_SECCION_ORDEN.forEach(function (s) {
      (secciones[s] || []).forEach(function (o) {
        totalPts += o.puntos;
        if (logradosSet[o.clave]) ptsLogrados += o.puntos;
      });
    });
    return { totalPts: totalPts, ptsLogrados: ptsLogrados };
  }

  function renderizarObjetivos(contenedorId, idClubActivo) {
    var contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;
    contenedor.innerHTML = "";

    var puntos = calcularObjetivosPuntos(idClubActivo);

    // El resumen "N / M puntos conseguidos" va en la MISMA fila que el
    // ✏️ (petición usuario: "subirlo a la altura del ✏️") — así todas las
    // cajas de sección quedan una fila más arriba, sin scroll de más.
    var header = document.createElement("div");
    header.className = "liga1ref-header";
    header.innerHTML =
      '<span class="liga1ref-leyenda-mini"><b>' + puntos.ptsLogrados + "</b> / " + puntos.totalPts +
      " puntos conseguidos</span>" +
      '<button type="button" class="liga1ref-editar-btn" data-accion="editar-objetivos-inline" data-club-id="' +
      (idClubActivo || "") + '" aria-label="Editar objetivos">✏️</button>';
    contenedor.appendChild(header);

    var texto = window.Estado ? window.Estado.obtenerObjetivosTexto(idClubActivo) : "";
    var parseo = parsearObjetivosTexto(texto);
    var secciones = parseo.secciones;
    var etiquetas = parseo.etiquetas;
    var logrados = window.Estado ? window.Estado.obtenerObjetivosLogrados(idClubActivo) : [];
    var logradosSet = {};
    logrados.forEach(function (c) { logradosSet[c] = true; });

    var iconos = window.Estado ? window.Estado.obtenerObjetivosIconos(idClubActivo) : OBJETIVOS_ICONOS_DEFAULT;

    OBJETIVOS_SECCION_ORDEN.forEach(function (s) {
      var lista = secciones[s];
      var sub = 0, subTotal = 0;
      lista.forEach(function (o) { subTotal += o.puntos; if (logradosSet[o.clave]) sub += o.puntos; });

      // Caja SIEMPRE abierta (petición usuario) — ya no es un <details>
      // plegable, es un bloque fijo con cabecera + lista debajo.
      var caja = document.createElement("div");
      caja.className = "objetivos-seccion-caja";

      var cab = document.createElement("div");
      cab.className = "objetivos-seccion-cabecera";
      cab.innerHTML =
        '<button type="button" class="objetivos-seccion-icono" data-accion="editar-objetivos-icono" data-club-id="' +
        (idClubActivo || "") + '" data-seccion="' + s + '" aria-label="Editar icono">' +
        (iconos[s] || OBJETIVOS_ICONOS_DEFAULT[s]) + "</button>" +
        '<span class="objetivos-seccion-nombre">' + escapeHTML(etiquetas[s] || OBJETIVOS_SECCION_NOMBRE[s]) + "</span>" +
        '<span class="objetivos-seccion-pts">' + sub + "/" + subTotal + "</span>";
      caja.appendChild(cab);

      var body = document.createElement("div");
      body.className = "objetivos-seccion-lista";
      if (!lista.length) {
        var vacio = document.createElement("p");
        vacio.className = "objetivos-vacio";
        vacio.textContent = "Sin objetivos todavía. Pulsa ✏️ para añadir alguno.";
        body.appendChild(vacio);
      } else {
        lista.forEach(function (o) {
          var logrado = !!logradosSet[o.clave];
          var fila = document.createElement("button");
          fila.type = "button";
          fila.className = "objetivos-fila" + (logrado ? " objetivos-fila--logrado" : "");
          fila.dataset.accion = "toggle-objetivo";
          fila.dataset.clubId = idClubActivo || "";
          fila.dataset.clave = o.clave;
          fila.innerHTML =
            '<span class="objetivos-fila-check">' + (logrado ? "✅" : "⬜") + "</span>" +
            '<span class="objetivos-fila-texto">' + escapeHTML(o.texto) + "</span>" +
            '<span class="objetivos-fila-pts">' + o.puntos + (o.puntos === 1 ? " pt" : " pts") + "</span>";
          body.appendChild(fila);
        });
      }
      caja.appendChild(body);
      contenedor.appendChild(caja);
    });
  }

  // Editor de texto libre por caja (candado 646) — a diferencia de
  // Títulos (catálogo cerrado, solo números), aquí el admin puede
  // añadir/quitar objetivos enteros, así que sí necesita la misma
  // protección que Calendario extra/Roster.
  function pintarEditorObjetivos(contenedor, idClubActivo) {
    contenedor.innerHTML = "";

    var nota = document.createElement("p");
    nota.className = "admin-nota";
    nota.textContent =
      'Una línea "# LIGA" / "# COPA" / "# SUPERLIGA" / "# GLOBALES" abre cada caja — puedes añadir ' +
      'texto detrás (p.ej. "# LIGA 1ª REF") y se usará como título de la caja, sigue siendo la ' +
      "misma caja. Debajo, un objetivo por línea con \"- 1\" o \"- 2\" al final (los puntos que vale); " +
      "si te dejas el número o el guion mal puesto, el objetivo se guarda igual con 1 punto, nunca " +
      "desaparece. Añade, edita o borra líneas libremente.";
    contenedor.appendChild(nota);

    var textoGuardado = window.Estado ? window.Estado.obtenerObjetivosTexto(idClubActivo) : "";
    var textarea = document.createElement("textarea");
    textarea.id = "objetivos-textarea";
    textarea.className = "admin-roadmap-textarea";
    textarea.rows = 26;
    textarea.value = textoGuardado;
    contenedor.appendChild(textarea);

    var acciones = document.createElement("div");
    acciones.className = "admin-roadmap-editor-acciones";
    acciones.innerHTML =
      '<button type="button" class="btn-ghost" data-accion="cancelar-objetivos" data-club-id="' + (idClubActivo || "") + '">✕ Cancelar</button>' +
      '<button type="button" class="admin-list-add-btn" data-accion="guardar-objetivos" data-club-id="' + (idClubActivo || "") + '">💾 Guardar</button>';
    contenedor.appendChild(acciones);
  }

  // ============================================================
  // DERBYS — Humano vs Humano. Catálogo CERRADO (los otros 5 mánagers,
  // sale de data/equipos.json — nunca hardcodeado aquí, así que si el
  // día de mañana cambia algún mister/emoji en ese JSON, esta pantalla
  // lo hereda sola). Cada club tiene una caja GLOBAL (SUMA de las 5,
  // nunca guardada aparte — igual que Objetivos con sus puntos: si se
  // guardara aparte podría desincronizarse del desglose) + una caja
  // "Contra <mister>" por rival, con PJ/PG/PE/PP/G+/G- editables (candado
  // 646, catálogo cerrado — mismo criterio de riesgo que Títulos: el
  // admin solo puede tocar números de una lista fija, no puede inventar
  // un rival que no exista, así que no hace falta el PIN de Objetivos).
  // ============================================================

  // "<Mister>: PJ N PG N PE N PP N G+ N G- N" — tolerante a que falte
  // algún campo (cuenta 0), a que no lleve ":" y al orden de los campos.
  // Una línea que no case con NINGUNO de los rivales del catálogo cerrado
  // se ignora en silencio (mismo criterio que parsearTitulosTexto).
  var DERBY_CAMPO_REGEX = {
    pj: /\bPJ\s*:?\s*(\d+)/i,
    pg: /\bPG\s*:?\s*(\d+)/i,
    pe: /\bPE\s*:?\s*(\d+)/i,
    pp: /\bPP\s*:?\s*(\d+)/i,
    gf: /\b(?:GF|G\s*\+)\s*:?\s*(\d+)/i,
    gc: /\b(?:GC|G\s*-)\s*:?\s*(\d+)/i
  };
  function _derbyResolverRival(nombreCrudo, rivales) {
    var norm = _normNombre(nombreCrudo);
    if (!norm) return null;
    for (var i = 0; i < rivales.length; i++) {
      var rn = _normNombre(rivales[i].mister);
      if (rn && norm.indexOf(rn) !== -1) return rivales[i];
    }
    return null;
  }
  function parsearDerbysTexto(texto, rivales) {
    var porRival = {};
    (texto || "").split("\n").forEach(function (linea) {
      var l = linea.trim();
      if (!l) return;
      var idxColon = l.indexOf(":");
      var etiqueta = idxColon !== -1 ? l.slice(0, idxColon) : l;
      var rival = _derbyResolverRival(etiqueta, rivales);
      if (!rival) return;
      var datos = {};
      Object.keys(DERBY_CAMPO_REGEX).forEach(function (campo) {
        var m = l.match(DERBY_CAMPO_REGEX[campo]);
        datos[campo] = m ? (parseInt(m[1], 10) || 0) : 0;
      });
      porRival[rival.id] = datos;
    });
    return porRival;
  }

  // DG y % de victorias SIEMPRE derivados, nunca guardados — mismo
  // principio que "PG no se guarda aparte" de _construirTbodyClasificacion.
  function _derbyCalcFila(s) {
    var pj = s.pj || 0, pg = s.pg || 0, pe = s.pe || 0, pp = s.pp || 0, gf = s.gf || 0, gc = s.gc || 0;
    return { pj: pj, pg: pg, pe: pe, pp: pp, gf: gf, gc: gc, dg: gf - gc, pct: pj > 0 ? Math.round((pg / pj) * 100) : 0 };
  }

  // Los otros 5 mánagers humanos (nunca el propio club activo) — mismo
  // orden en que aparecen en data/equipos.json. Si algún día hay más o
  // menos de 6 clubes humanos, esta lista se ajusta sola (no hay "5"
  // hardcodeado en ningún sitio del cálculo).
  function _derbyRivales(datos, idClubActivo) {
    return ((datos.equipos && datos.equipos.equipos) || [])
      .filter(function (e) { return e.id !== idClubActivo && e.mister; })
      .map(function (e) { return { id: e.id, mister: e.mister, misterEmoji: e.misterEmoji || "" }; });
  }
  function _derbyEtiquetaRival(rival) {
    return (rival.misterEmoji ? rival.misterEmoji + " " : "") + escapeHTML(rival.mister);
  }
  function _derbyFilaHtml(etiquetaHtml, c, claseExtra) {
    return (
      '<tr class="derbys-fila' + (claseExtra ? " " + claseExtra : "") + '">' +
      '<td class="clasificacion-equipo">' + etiquetaHtml + "</td>" +
      "<td>" + c.pj + "</td><td>" + c.pg + "</td><td>" + c.pe + "</td><td>" + c.pp + "</td>" +
      "<td>" + c.gf + "</td><td>" + c.gc + "</td>" +
      "<td>" + (c.dg > 0 ? "+" + c.dg : c.dg) + "</td>" +
      "<td>" + c.pct + "%</td></tr>"
    );
  }

  function renderizarDerbys(contenedorId, idClubActivo) {
    var contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;
    contenedor.innerHTML = "";
    contenedor.appendChild(nodoEstado("⏳", "Cargando…"));

    cargarTodo().then(function (datos) {
      contenedor.innerHTML = "";

      var header = document.createElement("div");
      header.className = "liga1ref-header";
      header.innerHTML =
        '<span class="liga1ref-leyenda-mini">Histórico Humano vs Humano</span>' +
        '<button type="button" class="liga1ref-editar-btn" data-accion="editar-derbys-inline" data-club-id="' +
        (idClubActivo || "") + '" aria-label="Editar derbys">✏️</button>';
      contenedor.appendChild(header);

      var rivales = _derbyRivales(datos, idClubActivo);
      if (!rivales.length) {
        contenedor.appendChild(nodoEstado("⚔️", "No hay otros clubes humanos todavía."));
        return;
      }

      var texto = window.Estado ? window.Estado.obtenerDerbysTexto(idClubActivo) : "";
      var porRival = parsearDerbysTexto(texto, rivales);
      var filas = rivales.map(function (r) {
        var c = _derbyCalcFila(porRival[r.id] || {});
        c.rival = r;
        return c;
      });

      var global = filas.reduce(function (acc, f) {
        acc.pj += f.pj; acc.pg += f.pg; acc.pe += f.pe; acc.pp += f.pp; acc.gf += f.gf; acc.gc += f.gc;
        return acc;
      }, { pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0 });
      global = _derbyCalcFila(global);

      var wrap = document.createElement("div");
      wrap.className = "clasificacion-wrap";
      var tablaHtml =
        '<table class="clasificacion-tabla derbys-tabla">' +
        "<thead><tr><th>Rival</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>G+</th><th>G-</th><th>DG</th><th>%</th></tr></thead><tbody>" +
        _derbyFilaHtml("🌐 GLOBAL", global, "derbys-fila--global") +
        filas.map(function (f) { return _derbyFilaHtml(_derbyEtiquetaRival(f.rival), f); }).join("") +
        "</tbody></table>";
      wrap.innerHTML = tablaHtml;
      contenedor.appendChild(wrap);

      // Rival más temido/cómodo — solo entre rivales con partidos jugados;
      // con todos a 0 (club recién estrenado) no se muestra nada.
      var conPartidos = filas.filter(function (f) { return f.pj > 0; });
      if (conPartidos.length) {
        var temido = conPartidos.reduce(function (a, b) { return b.pct < a.pct ? b : a; });
        var comodo = conPartidos.reduce(function (a, b) { return b.pct > a.pct ? b : a; });
        var resumen = document.createElement("div");
        resumen.className = "derbys-resumen";
        resumen.innerHTML =
          '<p class="derbys-resumen-linea">🔥 <b>Rival más temido:</b> ' + _derbyEtiquetaRival(temido.rival) +
          " (" + temido.pct + "% victorias)</p>" +
          '<p class="derbys-resumen-linea">😌 <b>Rival más cómodo:</b> ' + _derbyEtiquetaRival(comodo.rival) +
          " (" + comodo.pct + "% victorias)</p>";
        contenedor.appendChild(resumen);
      }
    });
  }

  // Pre-relleno del editor: una línea por rival con los números YA
  // guardados (0 si nunca se ha tocado ninguno) — el admin solo cambia
  // dígitos, igual que en Títulos.
  function _construirTextoEdicionDerbys(rivales, textoGuardado) {
    var porRival = parsearDerbysTexto(textoGuardado, rivales);
    return rivales.map(function (r) {
      var s = porRival[r.id] || {};
      return (r.misterEmoji ? r.misterEmoji + " " : "") + r.mister + ": PJ " + (s.pj || 0) + " PG " + (s.pg || 0) +
        " PE " + (s.pe || 0) + " PP " + (s.pp || 0) + " G+ " + (s.gf || 0) + " G- " + (s.gc || 0);
    }).join("\n");
  }

  function pintarEditorDerbys(contenedor, idClubActivo) {
    contenedor.innerHTML = "";
    contenedor.appendChild(nodoEstado("⏳", "Cargando…"));

    cargarTodo().then(function (datos) {
      contenedor.innerHTML = "";

      var rivales = _derbyRivales(datos, idClubActivo);
      if (!rivales.length) {
        contenedor.appendChild(nodoEstado("⚔️", "No hay otros clubes humanos todavía."));
        return;
      }

      var nota = document.createElement("p");
      nota.className = "admin-nota";
      nota.textContent =
        "Una línea por rival, con PJ/PG/PE/PP/G+ (goles a favor)/G- (goles en contra). Solo cambia " +
        "los números — el DG y el % de victorias de cada uno, y la caja GLOBAL, se calculan solos.";
      contenedor.appendChild(nota);

      var textoGuardado = window.Estado ? window.Estado.obtenerDerbysTexto(idClubActivo) : "";
      var textarea = document.createElement("textarea");
      textarea.id = "derbys-textarea";
      textarea.className = "admin-roadmap-textarea";
      textarea.rows = 14;
      textarea.value = _construirTextoEdicionDerbys(rivales, textoGuardado);
      contenedor.appendChild(textarea);

      var acciones = document.createElement("div");
      acciones.className = "admin-roadmap-editor-acciones";
      acciones.innerHTML =
        '<button type="button" class="btn-ghost" data-accion="cancelar-derbys" data-club-id="' + (idClubActivo || "") + '">✕ Cancelar</button>' +
        '<button type="button" class="admin-list-add-btn" data-accion="guardar-derbys" data-club-id="' + (idClubActivo || "") + '">💾 Guardar</button>';
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

  // Chincheta "es el próximo partido de TU caja" — solo en la card ya
  // resaltada con el borde azul (.match-card--siguiente). Sin disco de
  // color detrás (se probó con los colores del club y el usuario lo
  // quitó): es solo el emoji 📌, más grande, sin envolverlo en nada.
  function _pinProximoHTML() {
    return '<span class="match-card-pin" title="Tu próximo partido">📌</span>';
  }

  function construirTarjetaPartido(partido, idActivo, datos, totalJornadasLiga, esSiguiente, esEliminado, esBloqueado) {
    var esLocal = partido.local === idActivo;
    var rivalId = esLocal ? partido.visitante : partido.local;
    var rival = buscarEquipoPorId(rivalId, datos);
    var activo = buscarEquipoPorId(idActivo, datos);

    // Rival AÚN sin determinar ("?" en el calendario, ver crearEscudoHTML /
    // resolverRivalPorNombre) — bloquea la card aunque el cálculo por orden
    // de ronda (esBloqueado, ver generarCalendarioLateralDerecho) no lo
    // haya detectado por su cuenta (p.ej. si ya se ganó la ronda anterior
    // pero el admin todavía no escribió el nombre real del rival). No hay
    // PREVIA real que abrir sin rival — señal SIEMPRE válida, en CUALQUIER
    // competición, no solo en COMPS_ELIMINACION_DIRECTA.
    esBloqueado = esBloqueado || !!(rival && rival.desconocido);

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
    // Ronda de Copa del Rey (u otra eliminación directa) POSTERIOR a la
    // derrota que ya eliminó al club de esa competición: se pinta apagada
    // igual que un partido jugado (misma opacidad .is-played) aunque no
    // haya marcador real — el club ya no participa, no hay nada que
    // jugar (ver detección en generarCalendarioLateralDerecho). Una ronda
    // BLOQUEADA (el club sigue vivo pero aún no ganó la ronda anterior de
    // esa misma eliminatoria) se pinta apagada IGUAL, con 🔒 en vez de
    // PREVIA — no se puede adelantar a Dieciseisavos sin haber ganado 1/64.
    card.className = "match-card" + (claseComp ? " " + claseComp : "") +
      ((partido.jugado || esEliminado || esBloqueado) ? " is-played" : "") + claseResultado + (esSiguiente ? " match-card--siguiente" : "");
    card.dataset.partidoId = partido.id;

    var compLabel = COMP_LABEL[compKeyResuelto] || partido.competicion;
    var etiquetaRonda = partido.ronda ? " · " + partido.ronda : (partido.jornada ? " · J" + partido.jornada : "");

    // Centro — el marcador si ya se jugó, si no el botón PREVIA (sin
    // icono, para que quepa siempre entre los 2 bloques de equipo), más
    // el separador "vs" debajo, entre medias de los 2 nombres. El
    // marcador de un partido YA jugado es TAMBIÉN un botón — pulsarlo
    // reinicia el partido (vuelve a "sin jugar", para poder repetirlo
    // en pruebas), pero SOLO el administrador puede hacerlo (PIN, ver
    // la delegación de eventos más abajo) — petición usuario.
    var centroTop = (partido.jugado && partido.resultado)
      ? '<button type="button" class="match-card-marcador" data-accion="reiniciar-partido" data-partido-id="' + partido.id + '" title="Reiniciar partido (solo admin)">' +
        partido.resultado.golesLocal + " - " + partido.resultado.golesVisitante + "</button>"
      : (esEliminado
        ? '<span class="match-card-eliminado" title="El club ya quedó eliminado de esta competición">Eliminado</span>'
        : (esBloqueado
          ? '<span class="match-card-bloqueado" title="Aún no has ganado la ronda anterior de esta eliminatoria">🔒</span>'
          : '<button type="button" class="match-card-btn" data-partido-id="' + partido.id + '">PREVIA</button>'));

    card.innerHTML =
      (esSiguiente ? _pinProximoHTML() : "") +
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
            ? window.Estado.obtenerNombreLiga(idEquipoHumanoActivo)
            : (ligaActual || "").replace(/_/g, " ");
        }

        // Vista fusionada: partidos base (data/partidos.json) + Calendario
        // extra en texto de LOS 6 CLUBES humanos + confirmados/generados en
        // caliente (Estado) — así un partido recién jugado se pinta gris al
        // instante, sin recargar la página. Estado.listarPartidosResueltos
        // YA incluye el Calendario extra de cada club (ver
        // estado.js::_partidosExtraDeTodosLosClubes) — no hace falta
        // volver a parsearlo/resolverlo aquí, filtrar por "es de este
        // club" ya basta, y así la clasificación/estadísticas ven
        // EXACTAMENTE los mismos partidos que pinta esta pantalla.
        var todosLosPartidos = window.Estado
          ? window.Estado.listarPartidosResueltos(datos)
          : (datos.partidos.partidos || []);

        var partidosDelClub = todosLosPartidos.filter(function (p) {
          var esSuyo = p.local === idEquipoHumanoActivo || p.visitante === idEquipoHumanoActivo;
          if (!esSuyo) return false;
          // La Superliga NUNCA sale en el calendario GENERAL de un club
          // (petición usuario): sus partidos surgen "por casualidad"
          // cuando 2 humanos coinciden, no son partidos oficiales de la
          // temporada del club — solo se ven dentro de su propia caja
          // Superliga (renderizarSuperliga, calendario propio).
          if (p.competicion === "superliga") return false;
          // Liga regular: solo la liga actual del mánager.
          // Torneos eliminatorios (Copa, Supercopa...): siempre, en paralelo.
          if (p.competicion === "liga") return p.liga === ligaActual;
          return true;
        });

        if (!partidosDelClub.length) {
          contenedor.appendChild(nodoEstado("🗓️", "Este equipo todavía no tiene partidos programados."));
          return;
        }

        partidosDelClub.sort(function (a, b) {
          var ta = a.fecha ? new Date(a.fecha).getTime() : (a._fechaFallbackMs || 0);
          var tb = b.fecha ? new Date(b.fecha).getTime() : (b._fechaFallbackMs || 0);
          return ta - tb;
        });

        // Orden cronológico de ESTE club (0, 1, 2…), estable mientras no
        // cambien los partidos/el Calendario extra — es la "línea de
        // tiempo" que usan los Lesionados/Sancionados con rango (ver
        // estado.js) para saber qué partidos ya habían pasado cuando se
        // marcó/quitó a un jugador de la lista.
        partidosDelClub.forEach(function (p, i) { p._ordenClub = i; });

        var partidosPorId = {};
        partidosDelClub.forEach(function (p) { partidosPorId[p.id] = p; });

        _ultimoContexto = { datos: datos, equipo: equipo, totalJornadas: totalJornadas, partidosPorId: partidosPorId };

        // Eliminación/bloqueo en competiciones de eliminación directa
        // (Copa del Rey, futuros playoffs — ver COMPS_ELIMINACION_DIRECTA):
        // en cuanto el club pierde una ronda ya jugada, TODAS las rondas
        // POSTERIORES de esa misma competición (mismo orden que ya usa
        // "próximo partido" — fecha real o, sin ella, el orden en que se
        // pegó la línea en el Calendario extra) dejan de ser jugables —
        // se pintan apagadas en vez de activas con un rival "?" pendiente
        // y un botón PREVIA que no lleva a ningún partido real. Y aunque el
        // club SIGA vivo, no puede adelantarse a una ronda posterior sin
        // haber ganado antes la anterior (1/64 antes que Dieciseisavos) —
        // esa ronda se pinta apagada con 🔒 en vez de PREVIA. Se calcula
        // COMP POR COMP (nunca mezclando Copa con Liga u otra competición
        // en paralelo) vía _estadoRondasEliminacion, ver comentario ahí.
        var partidosElimPorComp = {};
        partidosDelClub.forEach(function (p) {
          var compKeyP = _resolverCompKeyBalon(p.competicion);
          if (!COMPS_ELIMINACION_DIRECTA[compKeyP]) return;
          (partidosElimPorComp[compKeyP] = partidosElimPorComp[compKeyP] || []).push(p);
        });
        var idsEliminados = {};
        var idsBloqueados = {};
        Object.keys(partidosElimPorComp).forEach(function (compKeyP) {
          var estadoComp = _estadoRondasEliminacion(partidosElimPorComp[compKeyP], idEquipoHumanoActivo);
          Object.keys(estadoComp.eliminadoIds).forEach(function (id) { idsEliminados[id] = true; });
          Object.keys(estadoComp.bloqueadoIds).forEach(function (id) { idsBloqueados[id] = true; });
        });

        // El primer partido sin jugar de la lista (ya ordenada por fecha)
        // es "el próximo" — se resalta con su propia clase para que
        // destaque de un vistazo cuál toca jugar ahora. Una ronda ya
        // eliminada, aún bloqueada por no haber ganado la anterior, o con
        // rival todavía sin determinar ("?"), nunca puede ser "el próximo
        // partido" — no hay PREVIA real que abrir.
        var idSiguiente = null;
        for (var i = 0; i < partidosDelClub.length; i++) {
          var pp = partidosDelClub[i];
          if (!pp.jugado && !idsEliminados[pp.id] && !idsBloqueados[pp.id] && !_rivalDesconocido(pp, idEquipoHumanoActivo, datos)) { idSiguiente = pp.id; break; }
        }

        var frag = document.createDocumentFragment();
        partidosDelClub.forEach(function (p) {
          frag.appendChild(construirTarjetaPartido(p, idEquipoHumanoActivo, datos, totalJornadas, p.id === idSiguiente, !!idsEliminados[p.id], !!idsBloqueados[p.id]));
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

  // Reinicia a "sin jugar" TODOS los partidos ya jugados del club cuyo
  // calendario está abierto ahora mismo (los mismos que pinta la pantalla
  // — Liga de su división actual + el resto de competiciones en
  // paralelo). Un solo botón para no tener que pulsar el marcador de
  // cada partido uno a uno tras una tanda de pruebas. Cubre las 2 formas
  // en que un partido puede quedar "jugado":
  //  1) confirmado EN VIVO desde la app (Estado.registrarResultadoPartido)
  //     -> reiniciarResultadoPartido, uno por partido.
  //  2) tecleado por el admin con el marcador ya puesto en el propio
  //     texto de "Calendario extra" ("Rival (2-1)") -> el 1) por sí solo
  //     NO hace nada aquí (nunca hubo override que borrar), así que
  //     además se limpia el marcador del propio texto.
  // Requiere que el calendario de ESE club ya esté pintado en pantalla
  // (usa _ultimoContexto.partidosPorId) — es lo normal, el botón vive en
  // la cabecera del propio calendario. Devuelve el nº de partidos que
  // quedaron reiniciados (0 si no había ninguno jugado).
  //
  // partidosPorId también puede llevar mezclados los partidos de
  // Superliga (renderizarSuperliga los registra ahí para que su propio
  // botón PREVIA los encuentre — ver esa función) — este botón general
  // los IGNORA a propósito: "Reiniciar" vive en la cabecera del
  // calendario GENERAL, que nunca muestra Superliga, así que no debe
  // borrar de rebote partidos de una competición que ni siquiera se ve
  // ahí.
  function reiniciarTodosPartidosClub(clubId) {
    if (!clubId || !window.Estado) return 0;
    var n = 0;
    if (_ultimoContexto && _ultimoContexto.equipo && _ultimoContexto.equipo.id === clubId) {
      var partidosPorId = _ultimoContexto.partidosPorId || {};
      Object.keys(partidosPorId).forEach(function (id) {
        if (partidosPorId[id].competicion === "superliga") return;
        if (!partidosPorId[id].jugado) return;
        n++;
        window.Estado.reiniciarResultadoPartido(id);
      });
    }
    n += window.Estado.reiniciarCalendarioExtraJugados(clubId);
    generarCalendarioLateralDerecho(clubId);
    return n;
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
    "atletico-madrid": { icono: "🎲", label: "Impredecible" },
    "fc-barcelona": { icono: "↘️", label: "Irregular" },
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
  // Forma SIEMPRE muestra 2 lados: "Tu" (el gestionado, humano — 🎲
  // fijo, imposible de predecir sea quien sea el rival) y "Rival" (el
  // icono fijo de _FORMA_POR_CLUB para el club gestionado, el mismo
  // esté quien esté al otro lado — petición usuario: deja de depender
  // de si el rival es humano o IA).
  // `partido` es opcional (solo lo necesita la excepción de Superliga,
  // "🔋 Estado ambos🎲" fijo para los 2 lados — petición usuario). El
  // resto de competiciones ignoran el parámetro, igual que antes.
  function _calcularMetaPartido(local, visitante, datos, contexto, partido) {
    var par = _resolverGestionadoYRival(local, visitante, contexto);
    var rivalEsHumano = _esClubHumano(par.rival.id, datos);
    var esSuperliga = !!partido && partido.competicion === "superliga";
    var forma = _FORMA_POR_CLUB[par.managed.id];
    var formaIconoRival = esSuperliga ? "🎲" : (forma ? forma.icono : "➡️");
    return {
      tiempo: "⏱️ " + (rivalEsHumano ? "10 min" : "8 min"),
      nivel: "🤖 " + (par.managed.id === _NIVEL_LEYENDA_ID ? "Leyenda" : "Crack"),
      forma: "🔋 Tu🎲-" + formaIconoRival + "Rival"
    };
  }

  // Fase (ida/vuelta) de una eliminatoria a doble partido — null en Liga
  // y en eliminatorias a partido único. La prórroga SOLO puede decidirse
  // en el partido que cierra la eliminatoria: la vuelta (o el partido
  // único). La ida nunca la necesita.
  function _faseIdaVuelta(partido) {
    if (partido.eliminatoria && (partido.eliminatoria.fase === "ida" || partido.eliminatoria.fase === "vuelta")) {
      return partido.eliminatoria.fase;
    }
    var rondaNorm = _normNombre(partido.ronda || "");
    if (/\bvuelta\b/.test(rondaNorm) || /\bvta\b/.test(rondaNorm)) return "vuelta";
    if (/\bida\b/.test(rondaNorm)) return "ida";
    return null;
  }

  // Modo de la eliminatoria, deducido del texto libre que el admin
  // escribe en "Calendario extra" (competición/ronda) o, si algún día
  // vuelve a poblarse data/partidos.json con el campo `eliminatoria` de
  // sistema-temporadas.js, de ese campo. El modo "desempate" (tercer
  // partido 0-0) cae dentro de "eliminatoria-unica" a propósito — ya
  // resuelve sus penaltis leyendo el acta (ver sistema-temporadas.js).
  function detectarModoPartido(partido) {
    // Superliga comparte el modo "liga" (nunca prórroga ni penaltis — la
    // caja del checkbox no se pinta) — petición usuario explícita.
    if (partido.competicion) {
      var compNorm = _normNombre(partido.competicion);
      if (compNorm === "liga" || compNorm === "superliga") return "liga";
    }
    if (_faseIdaVuelta(partido)) return "ida-vuelta";
    return "eliminatoria-unica";
  }

  // Listas de 🚑 Lesionados / 🟨 Sancionados del club GESTIONADO (persisten
  // por club en localStorage, no por partido concreto — sobreviven al
  // recargar y a cambiar de rival). Viven en la PREVIA (pantalla
  // informativa), no en la pantalla en vivo — se consultan ANTES de
  // empezar el partido.
  function _filaJugadorLista(entrada, tipo) {
    return (
      '<div class="live-acta-item"><span class="live-acta-jugador">' + escapeHTML(entrada.nombre) + "</span>" +
      '<button type="button" class="live-acta-del" data-tipo-lista="' + tipo + '" data-entrada-id="' + escapeHTML(entrada.id) + '" aria-label="Quitar">✕</button></div>'
    );
  }
  function _renderListaJugadores(tipo, contId, vacioTxt) {
    var cont = document.getElementById(contId);
    if (!cont || !window._idManagerActivo || !window.Estado) return;
    // Solo las entradas VIGENTES para el partido cuya previa está
    // abierta (rango desde/hasta, ver estado.js) — no la lista entera
    // del club, que puede incluir lesiones/sanciones ya cerradas antes
    // de este partido o que todavía no empezaban en su momento.
    var orden = _previaPartidoActual ? _previaPartidoActual._ordenClub : 0;
    var lista = window.Estado.obtenerListaJugadoresActivosPara(window._idManagerActivo, tipo, orden);
    cont.innerHTML = lista.length
      ? lista.map(function (entrada) { return _filaJugadorLista(entrada, tipo); }).join("")
      : '<div class="live-acta-vacia">' + vacioTxt + "</div>";
  }
  function renderListasJugadores() {
    _renderListaJugadores("lesionados", "previa-lesionados-lista", "Sin lesionados registrados.");
    _renderListaJugadores("sancionados", "previa-sancionados-lista", "Sin sancionados registrados.");
  }

  // Casilla "Activar Prórroga y Penaltis": eliminatoria a partido único
  // (Copa, tercer partido de desempate...) o VUELTA de una eliminatoria a
  // doble partido (Semis de Copa, Playoffs europeos...) — es el único
  // partido que puede decidir la eliminatoria, así que es el único que
  // puede necesitar prórroga. La IDA nunca la muestra (solo el aviso
  // informativo del gol de visitante). Liga no muestra ninguna caja.
  // Vive AQUÍ (la PREVIA, antes de empezar) y no en la pantalla en vivo —
  // el checkbox se decide de antemano; js/acta.js solo lee su `.checked`
  // al arrancar el partido (mismo id `live-prorroga-toggle`, el DOM
  // sobrevive porque la previa se OCULTA, no se destruye, al pulsar
  // "▶ Empezar partido"). Sin texto largo debajo — solo la etiqueta, en
  // azul clarito (petición usuario: el aviso tapaba la ✕ y el botón de
  // Empezar, sin scroll para llegar a ellos).
  function _renderFormatoBoxPrevia(partido) {
    var box = document.getElementById("previa-formato-box");
    if (!box) return;
    var modo = detectarModoPartido(partido);
    var checkboxHtml =
      '<label class="live-checkbox-row"><input type="checkbox" id="live-prorroga-toggle">' +
      '<span>Activar Prórroga y Penaltis</span></label>';
    // Mismo aviso, corto, tanto en ida como en vuelta (petición usuario —
    // antes tenían textos distintos y más largos por fase).
    var avisoGolVisitante =
      '<p class="live-eliminatoria live-eliminatoria--pendiente">⚠️ El gol marcado fuera cuenta doble en caso de empate global.</p>';
    if (modo === "eliminatoria-unica") {
      box.innerHTML = checkboxHtml;
    } else if (modo === "ida-vuelta" && _faseIdaVuelta(partido) === "vuelta") {
      box.innerHTML = avisoGolVisitante + checkboxHtml;
    } else if (modo === "ida-vuelta") {
      box.innerHTML = avisoGolVisitante;
    } else {
      box.innerHTML = "";
    }
  }

  // ---------- Alias eFootball — qué equipo real elegir en el juego ----------
  // Cualquier equipo SIN `crest` (los 6 humanos son los ÚNICOS con escudo
  // real — ver crearEscudoHTML) puede no tener licencia en eFootball, así
  // que la PREVIA le pinta debajo del nombre el club real que el admin ha
  // decidido que se le parece más (nivel/escudo/uniforme) — o un botón
  // para añadirlo si todavía no existe. La clave del mapa es el nombre
  // YA NORMALIZADO (nunca el id: un rival sintético del Calendario extra
  // puede llegar con un id distinto cada vez que se resuelve).
  function _claveAliasEquipo(equipo) {
    return _normNombre(equipo && equipo.nombre);
  }
  // Alias PERMANENTE (dictado por el usuario, ver data/rivales_reales.json
  // -> campo "alias") para los rivales reales de 1ª RFEF/Hypermotion que sí
  // se conocen de antemano — se ve en CUALQUIER dispositivo desde el
  // primer arranque, sin que el admin tenga que teclearlo. El admin sigue
  // pudiendo pulsar el botón y editarlo (ver el handler de
  // "alias-efootball" más abajo): esa edición se guarda por dispositivo
  // (Estado.guardarAliasEfootball) y SIEMPRE gana sobre este valor de
  // fábrica. Pasa por `_buscarRivalReal` (no un lookup exacto directo)
  // para heredar la MISMA tolerancia a erratas que ya usan escudo/
  // colores/poder — un club real resuelve igual esté como esté escrito.
  function _aliasEfootballDefault(clave) {
    var r = clave && _buscarRivalReal(clave);
    return (r && r.alias) || "";
  }
  function _previaAliasHTML(equipo, lado) {
    if (!equipo || equipo.crest) return ""; // los 6 humanos siempre existen en el juego
    var clave = _claveAliasEquipo(equipo);
    if (!clave) return "";
    var actual = (window.Estado ? window.Estado.obtenerAliasEfootball(clave) : "") || _aliasEfootballDefault(clave);
    var claveAttr = escapeHTML(clave);
    var nombreAttr = escapeHTML(equipo.nombre || "");
    var atributos =
      'data-accion="alias-efootball" data-alias-clave="' + claveAttr + '" ' +
      'data-alias-nombre="' + nombreAttr + '" data-alias-lado="' + lado + '"';
    if (actual) {
      return (
        '<button type="button" class="previa-team-alias" ' + atributos + '>' +
        "🎮 " + escapeHTML(actual) +
        "</button>"
      );
    }
    return (
      '<button type="button" class="previa-team-alias previa-team-alias--vacio" ' + atributos + '>' +
      "➕ Añadir" +
      "</button>"
    );
  }

  // ============================================================
  // PANTALLA DE PREVIA — estadio + clima + balón calculados en vivo
  // ============================================================
  function abrirPreviaPartido(partidoId) {
    if (!_ultimoContexto) return;
    var partido = _ultimoContexto.partidosPorId[partidoId];
    if (!partido) return;
    _previaPartidoActual = partido;

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

    // Fuera de .previa-team a propósito (ver comentario en index.html junto
    // a #previa-alias-row) — así los 2 escudos quedan SIEMPRE a la misma
    // altura, tenga o no alias uno de los 2 lados.
    var aliasRow = document.getElementById("previa-alias-row");
    if (aliasRow) aliasRow.innerHTML = _previaAliasHTML(local, "local") + _previaAliasHTML(visitante, "visitante");

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

    var metaPartido = _calcularMetaPartido(local, visitante, datos, _ultimoContexto, partido);
    document.getElementById("previa-tiempo").textContent = metaPartido.tiempo;
    document.getElementById("previa-nivel").textContent = metaPartido.nivel;
    document.getElementById("previa-forma").textContent = metaPartido.forma;

    _renderFormatoBoxPrevia(partido);
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
      // Se reinicia el flujo de "captura antes de empezar" en cada
      // apertura de previa (misma pantalla reutilizada para partidos
      // distintos) — ver el 1er click de #previa-empezar más abajo.
      btnEmpezar.dataset.armado = "";
      btnEmpezar.textContent = "▶ Empezar partido";
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

    // 💼 Valoración — 2 números sueltos que el mánager teclea a mano (la
    // suma real de Objetivos la lleva él aparte). Vive aquí, dentro del
    // editor ya protegido por PIN, en vez de un ✏️ suelto en la cabecera.
    var v = window.Estado ? window.Estado.obtenerValoracionClub(clubId) : { logrado: 0, objetivo: 0 };
    var filaValoracion = document.createElement("div");
    filaValoracion.className = "admin-list-item";
    filaValoracion.innerHTML =
      '<div class="admin-list-item-main">' +
      '<span class="admin-list-item-title">💼 Valoración: ' + escapeHTML(String(v.logrado)) + "/" + escapeHTML(String(v.objetivo)) + "</span>" +
      '<span class="admin-list-item-sub">Suma manual — para seguir en el club la próxima temporada</span>' +
      "</div>" +
      '<div class="admin-list-item-actions">' +
      '<button type="button" class="admin-list-item-btn" data-accion="editar-valoracion-club" data-club-id="' + clubId + '" aria-label="Editar valoración">✏️</button>' +
      "</div>";
    contenedor.appendChild(filaValoracion);

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
      if (!stats[id]) {
        stats[id] = {
          goles: 0, amarillas: 0, rojas: 0, mvp: 0, porteriaImbatida: 0,
          // Contadores POR PARTIDO (no total de tarjetas) — alimentan el
          // bloqueo de color de la Plantilla: cuántos partidos distintos
          // tuvo 2+ amarillas en el mismo encuentro (doble amarilla,
          // pierde el siguiente) y cuántos tuvo alguna roja directa
          // (pierde 2). Ver _tarjetaActivaPara.
          partidosDobleAmarilla: 0,
          partidosRojaDirecta: 0
        };
      }
      return stats[id];
    }
    var ES_GOL = { GOL: 1, GOL_FAV_FALTA: 1, PENALTI_GOL: 1 };
    // La Superliga NUNCA suma aquí (petición usuario): sus partidos solo
    // cuentan para la clasificación/Pichichi-MVP DE LA PROPIA Superliga
    // (calcularSuperliga/SUPERLIGA_STATS), nunca a la ficha del jugador
    // dentro de su club — esos partidos surgen "por casualidad" cuando
    // coinciden 2 humanos, no son partidos oficiales del club.
    var partidos = (window.Estado ? window.Estado.listarPartidosResueltos(datos) : []).filter(function (p) {
      return p.jugado && p.competicion !== "superliga" && (p.local === clubId || p.visitante === clubId);
    });

    partidos.forEach(function (p) {
      var amarillasEnEstePartido = {}; // jugador_id -> nº de AMARILLA en ESTE partido
      var hayRojaEnEstePartido = {}; // jugador_id -> true si tuvo alguna ROJA en ESTE partido
      (p.eventos || []).forEach(function (ev) {
        if (!ev.es_humano || !ev.jugador_id || ev.equipo_id !== clubId) return;
        var f = fila(ev.jugador_id);
        if (ES_GOL[ev.tipo]) f.goles++;
        else if (ev.tipo === "MVP") f.mvp++;
        else if (ev.tipo === "AMARILLA") {
          f.amarillas++;
          amarillasEnEstePartido[ev.jugador_id] = (amarillasEnEstePartido[ev.jugador_id] || 0) + 1;
        } else if (ev.tipo === "ROJA") {
          f.rojas++;
          hayRojaEnEstePartido[ev.jugador_id] = true;
        }
      });
      Object.keys(amarillasEnEstePartido).forEach(function (jid) {
        if (amarillasEnEstePartido[jid] >= 2) fila(jid).partidosDobleAmarilla++;
      });
      Object.keys(hayRojaEnEstePartido).forEach(function (jid) {
        fila(jid).partidosRojaDirecta++;
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

  // Bloqueo de color del nombre en la Plantilla — 3 niveles, prioridad
  // roja > naranja > amarillo (si coincidieran varias a la vez se
  // resuelven de una en una: al quitar la más grave con el nombre,
  // la siguiente pasa a mostrarse sola en el siguiente render).
  // `flagsJ` es la entrada guardada de ESTE jugador en
  // window.Estado.obtenerTarjetaFlags(clubId) — {ciclo,doble,roja}, cada
  // campo el "valor" que tenía cuando el admin quitó ESE bloqueo por
  // última vez (o undefined si nunca se ha quitado). Devuelve null si no
  // hay ningún bloqueo activo ahora mismo.
  function _tarjetaActivaPara(s, flagsJ) {
    if (s.partidosRojaDirecta > 0 && flagsJ.roja !== s.partidosRojaDirecta) {
      return { tipo: "roja", valor: s.partidosRojaDirecta, titulo: "🟥 Roja directa — se pierde 2 partidos. Pulsa para quitar el bloqueo (PIN admin)." };
    }
    if (s.partidosDobleAmarilla > 0 && flagsJ.doble !== s.partidosDobleAmarilla) {
      return { tipo: "doble", valor: s.partidosDobleAmarilla, titulo: "🟨🟨 2 amarillas en el mismo partido — se pierde el siguiente. Pulsa para quitar el bloqueo (PIN admin)." };
    }
    // Umbral = el múltiplo de 3 más alto YA ALCANZADO (3 con 3-5
    // amarillas, 6 con 6-8, 9 con 9-11…) — el color se queda encendido
    // en TODO ese tramo, no solo en el instante exacto del múltiplo
    // (petición usuario: "hasta que el admin no quite el bloqueo, ese
    // jugador seguirá saliendo en amarillo" — antes se apagaba solo en
    // la siguiente amarilla que no fuera múltiplo exacto de 3).
    var umbralCiclo = Math.floor(s.amarillas / 3) * 3;
    if (umbralCiclo > 0 && flagsJ.ciclo !== umbralCiclo) {
      return { tipo: "ciclo", valor: umbralCiclo, titulo: umbralCiclo + " amarillas acumuladas (ciclo de 3 en 3). Pulsa para quitar el bloqueo (PIN admin)." };
    }
    return null;
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
          return stats[j.id] || { goles: 0, amarillas: 0, rojas: 0, mvp: 0, porteriaImbatida: 0, partidosDobleAmarilla: 0, partidosRojaDirecta: 0 };
        }
        var flags = window.Estado ? window.Estado.obtenerTarjetaFlags(idEquipoHumanoActivo) : {};
        // Lesionado ACTUAL (entrada todavía sin cerrar, hasta === null) —
        // por nombre, igual que la lista de la previa. Prioridad MÁXIMA
        // sobre el color de tarjetas (roja/naranja/amarillo): un jugador
        // lesionado no se puede convocar pase lo que pase con sus
        // tarjetas. Se marca en rojo pero, a diferencia del bloqueo de
        // tarjetas, NO es clicable aquí — se quita desde LESIONADOS en la
        // previa de un partido (con PIN), donde sí se sabe desde/hasta
        // qué partido aplica el alta.
        var lesionadoSet = {};
        (window.Estado ? window.Estado.obtenerNombresListaActiva(idEquipoHumanoActivo, "lesionados") : []).forEach(function (n) { lesionadoSet[n] = true; });

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
            var esLesionado = !!lesionadoSet[j.nombre];
            var tarjeta = esLesionado ? null : _tarjetaActivaPara(s, flags[j.id] || {});
            var fila = document.createElement("div");
            fila.className = "plantilla-jugador" + (esLesionado ? " plantilla-jugador--lesion" : (tarjeta ? " plantilla-jugador--" + tarjeta.tipo : ""));
            var nombreTag = esLesionado
              ? '<span class="plantilla-nombre" title="🚑 Lesionado — se quita desde LESIONADOS en la previa de un partido (PIN admin).">' + escapeHTML(j.nombre) + "</span>"
              : (tarjeta
                ? '<span class="plantilla-nombre plantilla-nombre--flag" data-accion="quitar-flag-tarjeta"' +
                  ' data-club-id="' + escapeHTML(idEquipoHumanoActivo) + '" data-jugador-id="' + escapeHTML(j.id) + '"' +
                  ' data-tipo-flag="' + tarjeta.tipo + '" data-flag-valor="' + tarjeta.valor + '"' +
                  ' title="' + escapeHTML(tarjeta.titulo) + '">' + escapeHTML(j.nombre) + "</span>"
                : '<span class="plantilla-nombre">' + escapeHTML(j.nombre) + "</span>");
            fila.innerHTML =
              '<span class="plantilla-dorsal">' + j.dorsal + "</span>" +
              nombreTag +
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

    // Agrupados por posición (Porteros/Defensas/Centrocampistas/
    // Delanteros), mismo orden/etiquetas que el selector de jugador del
    // acta en vivo (js/acta.js::poblarSelectJugador) — petición usuario:
    // con plantillas largas, una lista plana por dorsal era lenta de
    // recorrer a mano.
    var opciones = ORDEN_POSICIONES.map(function (pos) {
      var deEstaPos = jugadores.filter(function (j) { return j.posicion === pos; });
      if (!deEstaPos.length) return "";
      return '<optgroup label="' + escapeHTML(LABEL_POSICION[pos]) + '">' +
        deEstaPos.map(function (j) {
          var etiqueta = "#" + j.dorsal + " " + j.nombre;
          return '<option value="' + escapeHTML(j.nombre) + '">' + escapeHTML(etiqueta) + "</option>";
        }).join("") +
        "</optgroup>";
    }).join("");

    cont.innerHTML =
      '<div class="live-lista-picker">' +
      '<select id="lista-picker-select" class="live-select">' + opciones + "</select>" +
      '<button type="button" class="live-lista-add" data-accion-picker="confirmar" data-tipo-lista="' + tipoLista + '">✓</button>' +
      '<button type="button" class="live-lista-add" data-accion-picker="cancelar" data-tipo-lista="' + tipoLista + '">✕</button>' +
      "</div>";
  }

  // Placeholder plano para cualquier tarjeta del menú del club que el
  // admin añada a mano (data-accion="anadir-tarjeta-menu-club") y que no
  // tenga un subsistema real detrás — este simulador ligero no inventa
  // datos falsos para una competición nueva. Plantilla / Liga 1ª REF /
  // Copa del Rey / Superliga / Títulos / Objetivos / Derbys ya SÍ son
  // reales (ver sus renderizar* respectivos).
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

    // Espacio REAL usado por la app: suma TODAS las claves "ef7_*" (no
    // solo resultados/partidosGenerados) — ver Estado.calcularEspacioTotal.
    // Antes esto medía solo esa clave sola, así que casi siempre salía un
    // valor mínimo tipo "0.05 KB" aunque hubiera bastante más guardado
    // (calendarios, plantillas, edición del admin...): el número era real,
    // pero no representaba el total.
    var espacio = window.Estado ? window.Estado.calcularEspacioTotal() : { bytes: 0, nClaves: 0 };
    var kb = (espacio.bytes / 1024).toFixed(2);

    var estado = window.Estado ? window.Estado.cargarEstado() : { resultados: {}, partidosGenerados: {} };
    var nPartidos = Object.keys(estado.resultados || {}).length;
    var nGenerados = Object.keys(estado.partidosGenerados || {}).length;

    var filas = [
      { titulo: "Espacio usado en total", sub: espacio.nClaves + " clave(s) guardadas (ef7_*)", valor: kb + " KB" },
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

    // Reiniciar un partido ya jugado (pruebas) — EXCLUSIVO del
    // administrador (PIN), igual que Sancionados/quitar de la lista.
    var btnReiniciar = ev.target.closest && ev.target.closest('[data-accion="reiniciar-partido"]');
    if (btnReiniciar) {
      var idReiniciar = btnReiniciar.dataset.partidoId;
      if (idReiniciar && window.Estado && window.Main) {
        window.Main.pedirPinAdmin(function () {
          window.Estado.reiniciarResultadoPartido(idReiniciar);
          if (window._idManagerActivo) generarCalendarioLateralDerecho(window._idManagerActivo);
        }, "🔒 Reiniciar partido", "Solo el administrador puede reiniciar un partido ya jugado.");
      }
      return;
    }

    if (ev.target.id === "previa-close" || ev.target.id === "previa-overlay") {
      cerrarPreviaPartido();
      return;
    }

    // 1er toque: solo avisa (📸) y NO sale de la previa — así el usuario
    // puede hacer la captura de la propia pantalla que está viendo antes
    // de que cambie. 2º toque (botón ya "armado"): ahí sí arranca el
    // partido en vivo. Se rearma en cada apertura de previa (ver
    // abrirPreviaPartido más arriba).
    var btnEmpezar = ev.target.closest && ev.target.closest("#previa-empezar");
    if (btnEmpezar && window.Acta && _ultimoContexto) {
      if (!btnEmpezar.dataset.armado) {
        window.alert("📸 Vas a INICIAR el partido, haz una captura para el Grupo WhatsApp LIGA.");
        btnEmpezar.dataset.armado = "1";
        btnEmpezar.textContent = "✅ Ya hice la captura — Empezar";
        return;
      }
      btnEmpezar.dataset.armado = "";
      btnEmpezar.textContent = "▶ Empezar partido";
      cerrarPreviaPartido();
      window.Acta.iniciarPartidoEnVivo(btnEmpezar.dataset.partidoId, _ultimoContexto);
      return;
    }

    // Lesionados: ➕ Añadir sigue abierto a cualquiera (como hasta ahora).
    // Sancionados: ➕ Añadir es EXCLUSIVO del administrador (PIN 646) — el
    // usuario pidió que solo él pueda marcar sanciones.
    if (ev.target.id === "previa-lesionado-add") {
      _abrirPickerJugadorLista("lesionados");
      return;
    }
    if (ev.target.id === "previa-sancionado-add") {
      if (window.Main) {
        window.Main.pedirPinAdmin(function () { _abrirPickerJugadorLista("sancionados"); },
          "🔒 Añadir sancionado", "Solo el administrador puede sancionar jugadores.");
      }
      return;
    }

    // "🎮 <alias>" / "➕ Añadir equipo eFootball" bajo el nombre de un
    // equipo sin licencia en el juego (ver _previaAliasHTML) — admin-only,
    // texto libre igual que el resto de editores de una línea de la app
    // (window.prompt, PIN 646). Se guarda por NOMBRE normalizado, así que
    // el mismo equipo lo hereda en TODAS las previas donde vuelva a salir.
    var btnAlias = ev.target.closest && ev.target.closest('[data-accion="alias-efootball"]');
    if (btnAlias) {
      var claveAlias = btnAlias.dataset.aliasClave;
      var nombreAlias = btnAlias.dataset.aliasNombre || "";
      if (claveAlias && window.Estado && window.Main) {
        window.Main.pedirPinAdmin(function () {
          // Prefill con el override de ESTE dispositivo si existe, si no
          // con el alias de fábrica (data/rivales_reales.json) — así el
          // admin ve/edita SIEMPRE lo que el botón ya está mostrando,
          // nunca un prompt vacío para un equipo que ya tiene alias.
          var actual = window.Estado.obtenerAliasEfootball(claveAlias) || _aliasEfootballDefault(claveAlias);
          var nuevo = window.prompt(
            '"' + nombreAlias + '" no tiene licencia en eFootball — ¿qué equipo REAL debe buscar el jugador ' +
            "en el juego para representarlo? (mismo nivel/escudo/uniforme)\n" +
            "Formato: Continente/región - División - País - Nombre del equipo\n" +
            'Ej: "Asia y Oceanía - 2ª Japón - Blaublitz Akita"\n\n' +
            "(déjalo vacío y acepta para borrar el alias)",
            actual
          );
          if (nuevo === null) return; // cancelado
          window.Estado.guardarAliasEfootball(claveAlias, nuevo);
          // Repinta la previa entera (misma partido, misma pantalla abierta)
          // para que el botón refleje el alias recién guardado/borrado.
          var btnEmpezarActual = document.getElementById("previa-empezar");
          if (btnEmpezarActual && btnEmpezarActual.dataset.partidoId) {
            abrirPreviaPartido(btnEmpezarActual.dataset.partidoId);
          }
        }, "🔒 Equipo eFootball", "Solo el administrador puede fijar qué equipo real elegir en el juego.");
      }
      return;
    }

    var pickerBtn = ev.target.closest && ev.target.closest("[data-accion-picker]");
    if (pickerBtn) {
      var tipoPicker = pickerBtn.dataset.tipoLista;
      if (pickerBtn.dataset.accionPicker === "confirmar") {
        var selJugador = document.getElementById("lista-picker-select");
        var nombreElegido = selJugador ? selJugador.value : "";
        if (nombreElegido && window._idManagerActivo && window.Estado) {
          // Queda vigente desde EL PARTIDO cuya previa está abierta ahora
          // (inclusive) — ver estado.js::agregarJugadorALista.
          var ordenAlta = _previaPartidoActual ? _previaPartidoActual._ordenClub : 0;
          window.Estado.agregarJugadorALista(window._idManagerActivo, tipoPicker, nombreElegido, ordenAlta);
        }
      }
      renderListasJugadores();
      return;
    }

    // Quitar (✕) un lesionado o sancionado ya listado — SIEMPRE requiere
    // el PIN de administrador: un humano normal ya no puede des-lesionar/
    // des-sancionar a su propio jugador por su cuenta.
    var delBtnLista = ev.target.closest && ev.target.closest(".live-acta-del[data-tipo-lista]");
    if (delBtnLista && window._idManagerActivo && window.Estado) {
      var tipoDel = delBtnLista.dataset.tipoLista, entradaIdDel = delBtnLista.dataset.entradaId;
      if (window.Main) {
        window.Main.pedirPinAdmin(function () {
          // Se cierra desde el partido cuya previa está abierta ahora —
          // los partidos ANTERIORES a este (ya jugados o no) lo siguen
          // mostrando lesionado/sancionado; este y los siguientes, no.
          var ordenBaja = _previaPartidoActual ? _previaPartidoActual._ordenClub : 0;
          window.Estado.quitarJugadorDeLista(window._idManagerActivo, tipoDel, entradaIdDel, ordenBaja);
          renderListasJugadores();
        }, "🔒 Quitar de la lista", "Solo el administrador puede quitar lesionados/sancionados.");
      }
      return;
    }

    // Quitar el bloqueo de color (amarillo/naranja/rojo) del nombre de un
    // jugador en la Plantilla — SIEMPRE requiere PIN admin. Vuelve a
    // encenderse solo si el jugador suma otra tarjeta que haga crecer el
    // contador correspondiente (ver _tarjetaActivaPara/limpiarTarjetaFlag).
    var btnFlag = ev.target.closest && ev.target.closest('[data-accion="quitar-flag-tarjeta"]');
    if (btnFlag) {
      var clubIdFlag = btnFlag.dataset.clubId, jugadorIdFlag = btnFlag.dataset.jugadorId,
        tipoFlag = btnFlag.dataset.tipoFlag, valorFlag = Number(btnFlag.dataset.flagValor);
      if (clubIdFlag && jugadorIdFlag && tipoFlag && window.Estado && window.Main) {
        window.Main.pedirPinAdmin(function () {
          window.Estado.limpiarTarjetaFlag(clubIdFlag, jugadorIdFlag, tipoFlag, valorFlag);
          renderizarPlantillaClub(clubIdFlag);
        }, "🔒 Quitar bloqueo", "Solo el administrador puede quitar el bloqueo de tarjetas de un jugador.");
      }
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
    reiniciarTodosPartidosClub: reiniciarTodosPartidosClub,
    renderizarMenuClub: renderizarMenuClub,
    pintarEditorMenuClub: pintarEditorMenuClub,
    pintarEditorCalendarioExtraClub: pintarEditorCalendarioExtraClub,
    parsearPartidosExtraTexto: parsearPartidosExtraTexto,
    resolverRivalPorNombre: resolverRivalPorNombre,
    resolverCompKeyPartido: _resolverCompKeyBalon,
    renderizarPlantillaClub: renderizarPlantillaClub,
    obtenerJugadoresClub: obtenerJugadoresClub,
    parsearRosterTexto: parsearRosterTexto,
    calcularStatsRosterClub: calcularStatsRosterClub,
    pintarEditorPlantillaClub: pintarEditorPlantillaClub,
    renderizarLiga1RefClasificacion: renderizarLiga1RefClasificacion,
    pintarEditorLiga1Ref: pintarEditorLiga1Ref,
    renderizarLiga1RefStatDetalle: renderizarLiga1RefStatDetalle,
    pintarEditorLiga1RefStat: pintarEditorLiga1RefStat,
    obtenerFormatoLigaTexto: obtenerFormatoLigaTexto,
    obtenerLigaNombreCorta: obtenerLigaNombreCorta,
    obtenerFormatoSuperligaTexto: obtenerFormatoSuperligaTexto,
    obtenerFormatoCopaTexto: obtenerFormatoCopaTexto,
    parsearLiga1RefTexto: parsearLiga1RefTexto,
    calcularLiga1RefCombinada: calcularLiga1RefCombinada,
    renderizarCopaDelRey: renderizarCopaDelRey,
    renderizarCopaStatDetalle: renderizarCopaStatDetalle,
    pintarEditorCopaStat: pintarEditorCopaStat,
    renderizarSuperliga: renderizarSuperliga,
    renderizarSuperligaStatDetalle: renderizarSuperligaStatDetalle,
    calcularSuperliga: calcularSuperliga,
    renderizarTitulos: renderizarTitulos,
    pintarEditorTitulos: pintarEditorTitulos,
    parsearTitulosTexto: parsearTitulosTexto,
    renderizarObjetivos: renderizarObjetivos,
    pintarEditorObjetivos: pintarEditorObjetivos,
    parsearObjetivosTexto: parsearObjetivosTexto,
    calcularObjetivosPuntos: calcularObjetivosPuntos,
    renderizarDerbys: renderizarDerbys,
    pintarEditorDerbys: pintarEditorDerbys,
    parsearDerbysTexto: parsearDerbysTexto,
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
