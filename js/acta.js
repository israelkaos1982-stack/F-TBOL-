/* ============================================================
   acta.js — Acta en vivo: registro de eventos, cierre en cadena
   y comparte en WhatsApp.
   ============================================================ */
(function () {
  "use strict";

  // ---------- 1. GESTIÓN DEL ACTA TEMPORAL ----------
  var actaTemporal = [];
  var _contadorEventoId = 0;

  var TIPOS_EVENTO = {
    GOL: { emoji: "⚽", label: "Gol", esGol: true, autogol: false },
    AUTOGOL: { emoji: "🚫", label: "Autogol", esGol: true, autogol: true },
    GOL_FAV_FALTA: { emoji: "🎯", label: "Gol de falta", esGol: true, autogol: false },
    PENALTI_GOL: { emoji: "🥅", label: "Gol de penalti", esGol: true, autogol: false },
    PENALTI_FALLADO: { emoji: "❌", label: "Penalti fallado", esGol: false, autogol: false },
    AMARILLA: { emoji: "🟨", label: "Amarilla", esGol: false, autogol: false },
    ROJA: { emoji: "🟥", label: "Roja", esGol: false, autogol: false },
    MVP: { emoji: "⭐", label: "MVP", esGol: false, autogol: false }
  };

  function nuevoIdEvento() {
    _contadorEventoId += 1;
    return "evt-" + Date.now() + "-" + _contadorEventoId;
  }

  // ---------- Nombre REAL para el jugador IA que dispara un evento ----------
  // Petición usuario: al pulsar GOL/AMARILLA/etc. del lado IA, el motor
  // pone SOLO el nombre — el humano nunca elige ni escribe nada. Pool
  // COMPARTIDO por TODOS los equipos IA/rivales (0 KB por equipo — no es
  // un fichero nuevo, son ~40 nombres inline aquí mismo). El nombre que
  // le toca a cada "hueco" de plantilla (posición dentro del equipo) es
  // SIEMPRE el mismo — determinista por hash(equipoId + hueco) — para que
  // el MISMO jugador pueda acumular sus goles/tarjetas entre partidos
  // distintos (necesario para que sume en Pichichi/MVP, ver
  // renderizadores.js). Cuando el admin quiera un plantel real para un
  // equipo concreto, lo añade en data/equipos_ia.json o
  // data/rivales_reales.json (campo `jugadores`) y ESE equipo deja de
  // usar el pool — nada que tocar aquí.
  var _POOL_NOMBRES_IA = [
    "Marc Soler", "Iker Muñoz", "Alex Vidal", "Pau Ferrer", "Dani Roig",
    "Sergi Camps", "Adrià Bosch", "Jordi Vela", "Nil Puig", "Aleix Serra",
    "Rubén Calvo", "Hugo Prieto", "Mario Casas", "Diego Peña", "Álvaro Reyes",
    "Óscar Miranda", "Iván Lozano", "Raúl Cordero", "Nacho Pastor", "Fran Nieto",
    "Carlos Vega", "Javier Osuna", "Manu Sáez", "Toni Bravo", "Guille Aranda",
    "Lucas Perales", "David Montoya", "Pol Escobar", "Bruno Salinas", "Yeray Cintas",
    "Kevin Marín", "Samu Ortiz", "Gonzalo Rus", "Enzo Villalba", "Mateo Cobos",
    "Adrián Solá", "Cristian Nova", "Fer Cuadrado", "Biel Rovira", "Ander Zubia"
  ];

  // Roster corto (1 portero + 4 de línea, sesgado a Medio/Delantero para
  // que siempre haya candidato a goleador) para un equipo IA/rival SIN
  // plantilla en los catálogos (todo lo que viene de
  // data/rivales_reales.json, o cualquier rival tecleado a mano que ni
  // siquiera está ahí — ver resolverRivalPorNombre). Se calcula AL VUELO,
  // nunca se persiste ni pesa nada en los ficheros de datos.
  var _SLOTS_ROSTER_SINTETICO = [
    { slot: "POR1", posicion: "POR" },
    { slot: "DEF1", posicion: "DEF" },
    { slot: "MED1", posicion: "MED" },
    { slot: "DEL1", posicion: "DEL" },
    { slot: "DEL2", posicion: "DEL" }
  ];

  var RE_NOMBRE_PLACEHOLDER_IA = /^jugador\s*\d+$/i;

  function _hashStrIA(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }

  function _nombreIAPara(equipoId, hueco) {
    var h = _hashStrIA(String(equipoId) + "::" + hueco);
    return _POOL_NOMBRES_IA[h % _POOL_NOMBRES_IA.length];
  }

  function _rosterSinteticoIA(equipoId) {
    return _SLOTS_ROSTER_SINTETICO.map(function (s) {
      return { nombre: _nombreIAPara(equipoId, s.slot), posicion: s.posicion, _hueco: s.slot };
    });
  }

  // Elige, de la plantilla (real o sintética) de un equipo IA, un jugador
  // de Medio o Delantero al azar (fallback a cualquiera si no hay). NUNCA
  // pide selección manual — es automático e instantáneo. Devuelve un id
  // ESTABLE (equipoId + hueco de plantilla) para que Pichichi/MVP puedan
  // sumar los eventos de este mismo jugador entre partidos.
  function simularGoleadorAutomatorioIA(idEquipoIA, datos) {
    var equipo = window.Renderizadores.buscarEquipoPorId(idEquipoIA, datos);
    var jugadores = (equipo && equipo.jugadores && equipo.jugadores.length) ? equipo.jugadores : _rosterSinteticoIA(idEquipoIA);

    var candidatos = jugadores.filter(function (j) { return j.posicion === "MED" || j.posicion === "DEL"; });
    if (!candidatos.length) candidatos = jugadores;
    if (!candidatos.length) return { id: null, nombre: "Jugador IA" };

    var elegido = candidatos[Math.floor(Math.random() * candidatos.length)];
    var hueco = elegido._hueco || elegido.nombre;
    // Un nombre placeholder ("Jugador 6", los 20 equipos de
    // data/equipos_ia.json que aún no tienen plantel real) se sustituye
    // por el del pool — SIEMPRE el mismo para el mismo hueco. Un nombre
    // real ya puesto por el admin se respeta tal cual.
    var nombreReal = RE_NOMBRE_PLACEHOLDER_IA.test(elegido.nombre) ? _nombreIAPara(idEquipoIA, hueco) : elegido.nombre;
    return { id: idEquipoIA + "::" + hueco, nombre: nombreReal };
  }

  // opts: { tipo, minuto, equipoId, equipoNombre, esHumano, jugadorId, jugadorNombre, datos }
  function agregarEventoActa(opts) {
    var meta = TIPOS_EVENTO[opts.tipo];
    if (!meta) throw new Error("Tipo de evento desconocido: " + opts.tipo);

    var jugadorId = opts.jugadorId || null;
    var jugadorNombre = opts.jugadorNombre || null;

    // Regla de automatización IA: se salta la selección manual.
    if (!opts.esHumano) {
      var auto = simularGoleadorAutomatorioIA(opts.equipoId, opts.datos);
      jugadorId = auto.id;
      jugadorNombre = auto.nombre;
    }

    var evento = {
      id_evento: nuevoIdEvento(),
      minuto: opts.minuto,
      tipo: opts.tipo,
      equipo_id: opts.equipoId,
      // Nombre del equipo cacheado EN el evento (no solo el id) — así
      // cualquier pantalla de estadísticas puede mostrar/agrupar por
      // equipo sin tener que volver a resolver el id contra los
      // catálogos (los rivales sintéticos de Calendario extra solo
      // existen en memoria de ESTA sesión — ver resolverRivalPorNombre).
      equipo_nombre: opts.equipoNombre || null,
      es_humano: !!opts.esHumano,
      jugador_id: jugadorId,
      jugador_nombre: jugadorNombre
    };

    actaTemporal.push(evento);
    return evento;
  }

  // La "X" del acta — el administrador se equivocó, borra el evento.
  function eliminarEventoDeActa(idEvento) {
    var idx = actaTemporal.findIndex(function (e) { return e.id_evento === idEvento; });
    if (idx === -1) return false;
    actaTemporal.splice(idx, 1);
    return true;
  }

  var MINUTO_TANDA = "TANDA"; // penaltis de la tanda de desempate — NO cuentan como gol real

  function calcularMarcadorDesdeActa(idLocal, idVisitante) {
    var golesLocal = 0, golesVisitante = 0;
    actaTemporal.forEach(function (ev) {
      var meta = TIPOS_EVENTO[ev.tipo];
      if (!meta || !meta.esGol) return;
      if (ev.minuto === MINUTO_TANDA) return; // tanda de penaltis: no es gol del marcador
      if (meta.autogol) {
        // El autogol beneficia al RIVAL del equipo del jugador que lo comete.
        if (ev.equipo_id === idLocal) golesVisitante++;
        else if (ev.equipo_id === idVisitante) golesLocal++;
      } else {
        if (ev.equipo_id === idLocal) golesLocal++;
        else if (ev.equipo_id === idVisitante) golesVisitante++;
      }
    });
    return { golesLocal: golesLocal, golesVisitante: golesVisitante };
  }

  // ============================================================
  // 2. EL CIERRE DEFINITIVO — 4 pasos en cadena
  // ============================================================
  function finalizarYSubirPartido(idPartido, golesL, golesV) {
    var ctx = _partidoActivo;
    if (!ctx || ctx.partido.id !== idPartido) throw new Error("No hay un partido activo con id " + idPartido);

    // A) Cerrar partido: inyecta el marcador real + el acta y marca
    //    jugado:true. El calendario derecho lo pintará gris con la
    //    PREVIA oculta en el siguiente render (regla ya vigente desde
    //    la Fase 1, CSS .match-card.is-played).
    window.Estado.registrarResultadoPartido(idPartido, golesL, golesV, actaTemporal);

    // B) Clasificación de la liga: Estado.calcularClasificacion() la
    //    recalcula en caliente a partir de TODOS los partidos jugados —
    //    en cuanto el resultado queda registrado (paso A) ya la refleja,
    //    sin mantener un contador aparte que se pueda desincronizar.
    var clasificacion = ctx.partido.competicion === "liga"
      ? window.Estado.calcularClasificacion(ctx.datos, ctx.partido.liga)
      : null;

    // C) Fichas de jugadores humanos: mismo principio. Se ignoran los
    //    eventos de la IA (es_humano:false) por diseño — sus jugadores
    //    genéricos no tienen ficha ni historial persistido (0 KB extra).
    //    Renderizadores.calcularStatsRosterClub() ya solo cuenta
    //    es_humano:true al leer los eventos que acabamos de guardar en
    //    el paso A — la Plantilla y Liga 1ª REF quedan al día solas.

    // D) Vaciar RAM — el acta temporal queda a cero para el siguiente partido.
    var actaCerrada = actaTemporal.slice();
    actaTemporal = [];

    // 3. Eliminatorias de Copa/Promoción: si este partido era una vuelta
    //    o un tercer partido de desempate, decide (o hace avanzar) la
    //    eliminatoria.
    var partidoConfirmado = Object.assign({}, ctx.partido, {
      jugado: true,
      resultado: { golesLocal: golesL, golesVisitante: golesV },
      eventos: actaCerrada
    });
    var resultadoEliminatoria = window.SistemaTemporadas
      ? window.SistemaTemporadas.evaluarTrasConfirmar(partidoConfirmado, ctx.datos)
      : null;

    // Re-pinta el calendario del mánager activo al instante.
    if (window._idManagerActivo && window.Renderizadores) {
      window.Renderizadores.generarCalendarioLateralDerecho(window._idManagerActivo);
    }

    return {
      golesL: golesL,
      golesV: golesV,
      clasificacion: clasificacion,
      eliminatoria: resultadoEliminatoria
    };
  }

  // ============================================================
  // 4. COMPARTIR EN WHATSAPP
  // ============================================================
  function compartirEnWhatsApp(resumen) {
    var localTxt = resumen.local.nombre + (resumen.localEsHumano ? "" : " (IA)");
    var visitanteTxt = resumen.visitante.nombre + (resumen.visitanteEsHumano ? "" : " (IA)");
    var mensaje = "⚽ ¡eFOOTBALL Resultadazo! " + localTxt + " " + resumen.golesL + " - " + resumen.golesV +
      " " + visitanteTxt + ". ¡Acta oficial cerrada! 📋";
    var url = "https://api.whatsapp.com/send?text=" + encodeURIComponent(mensaje);
    window.open(url, "_blank", "noopener");
    return mensaje;
  }

  // ============================================================
  // PANTALLA EN VIVO — wiring de la UI (formulario de eventos + acta)
  // ============================================================
  var _partidoActivo = null; // { partido, local, visitante, datos, lado, modo, prorroga }
  var _ultimoResumen = null;

  function esEquipoHumano(equipoId, datos) {
    return (datos.equipos.equipos || []).some(function (e) { return e.id === equipoId; });
  }

  // Minuto: 5' a 95' SIEMPRE (los 90-95 representan el descuento). Solo
  // en modo "eliminatoria-unica" con la casilla "Activar Prórroga y
  // Penaltis" marcada se añaden 100'-120' + la opción de Tanda — Liga e
  // Ida y Vuelta nunca la muestran (esas eliminatorias se deciden por
  // el global de ida+vuelta, no en este partido suelto).
  function poblarSelectMinuto() {
    var sel = document.getElementById("live-minuto");
    if (!sel || !_partidoActivo) return;
    sel.innerHTML = "";
    for (var m = 5; m <= 95; m += 5) {
      var op = document.createElement("option");
      op.value = String(m);
      op.textContent = m + "'";
      if (m === 5) op.selected = true;
      sel.appendChild(op);
    }

    var permiteProrroga = _partidoActivo.modo === "eliminatoria-unica" && _partidoActivo.prorroga;
    if (permiteProrroga) {
      for (var e = 100; e <= 120; e += 5) {
        var opE = document.createElement("option");
        opE.value = String(e);
        opE.textContent = e + "' (prórroga)";
        sel.appendChild(opE);
      }
      // Opción especial: penaltis de la tanda. No suman al marcador
      // (calcularMarcadorDesdeActa los ignora) — solo los lee
      // sistema-temporadas.js para decidir el ganador de la eliminatoria.
      var opTanda = document.createElement("option");
      opTanda.value = MINUTO_TANDA;
      opTanda.textContent = "🎯 Tanda de penaltis";
      sel.appendChild(opTanda);
    }

    actualizarTandaInfo();
  }

  // Caja "🎯 Tanda de penaltis: X - Y" — oculta salvo que el admin haya
  // seleccionado esa opción del minuto, o ya haya penaltis registrados
  // en la tanda (para que no desaparezca si vuelve a cambiar el minuto).
  function actualizarTandaInfo() {
    var box = document.getElementById("live-tanda-info");
    var marcador = document.getElementById("live-tanda-marcador");
    if (!box || !marcador || !_partidoActivo) return;
    var minutoSel = document.getElementById("live-minuto");
    var enModoTanda = !!(minutoSel && minutoSel.value === MINUTO_TANDA);
    var penL = actaTemporal.filter(function (e) { return e.tipo === "PENALTI_GOL" && e.minuto === MINUTO_TANDA && e.equipo_id === _partidoActivo.local.id; }).length;
    var penV = actaTemporal.filter(function (e) { return e.tipo === "PENALTI_GOL" && e.minuto === MINUTO_TANDA && e.equipo_id === _partidoActivo.visitante.id; }).length;
    box.hidden = !(enModoTanda || (penL + penV) > 0);
    marcador.textContent = penL + " - " + penV;
  }

  // Mismo orden/etiquetas que la pantalla "Plantilla" (Renderizadores) —
  // agrupar por posición en vez de una lista plana ordenada solo por
  // dorsal: con plantillas de 20+ jugadores, encontrar uno a mano en una
  // lista sin ordenar era lento (petición usuario).
  var POSICIONES_ORDEN = ["POR", "DEF", "MED", "DEL"];
  var POSICIONES_LABEL = { POR: "Porteros", DEF: "Defensas", MED: "Centrocampistas", DEL: "Delanteros" };

  function poblarSelectJugador() {
    var sel = document.getElementById("live-jugador");
    var fila = document.getElementById("live-jugador-row");
    if (!sel || !fila || !_partidoActivo) return;

    var lado = _partidoActivo.lado; // 'local' | 'visitante'
    var equipo = lado === "local" ? _partidoActivo.local : _partidoActivo.visitante;
    var esHumano = esEquipoHumano(equipo.id, _partidoActivo.datos);

    fila.hidden = !esHumano;
    sel.innerHTML = "";
    if (!esHumano) return;

    var jugadores = window.Renderizadores.obtenerJugadoresClub(equipo.id);
    POSICIONES_ORDEN.forEach(function (pos) {
      var deEstaPos = jugadores.filter(function (j) { return j.posicion === pos; });
      if (!deEstaPos.length) return;
      var grupo = document.createElement("optgroup");
      grupo.label = POSICIONES_LABEL[pos];
      deEstaPos.forEach(function (j) {
        var op = document.createElement("option");
        op.value = j.id;
        op.textContent = "#" + j.dorsal + " " + j.nombre;
        grupo.appendChild(op);
      });
      sel.appendChild(grupo);
    });
  }

  function seleccionarLado(lado) {
    if (!_partidoActivo) return;
    _partidoActivo.lado = lado;
    document.querySelectorAll(".live-team-nombre").forEach(function (b) {
      b.classList.toggle("is-active", b.dataset.lado === lado);
    });
    poblarSelectJugador();
  }

  // El acta ya NO sale en una lista única al final de la pantalla (con
  // marcador + equipos + acta, la captura no cabía entera en la
  // pantalla) — cada evento se pinta DEBAJO del escudo/nombre de SU
  // propio equipo, en letra pequeña (0 KB de "(local)"/"(visitante)":
  // la posición ya lo dice).
  function _miniActaFila(ev) {
    var meta = TIPOS_EVENTO[ev.tipo];
    var etiquetaMinuto = ev.minuto === MINUTO_TANDA ? "🎯" : ev.minuto + "'";
    return (
      '<div class="live-acta-mini-item">' +
      '<span class="live-acta-mini-min">' + etiquetaMinuto + "</span>" +
      '<span class="live-acta-mini-tipo">' + meta.emoji + "</span>" +
      '<span class="live-acta-mini-jugador">' + (ev.jugador_nombre || "—") + "</span>" +
      '<button type="button" class="live-acta-mini-del" data-id-evento="' + ev.id_evento + '" aria-label="Eliminar evento">✕</button>' +
      "</div>"
    );
  }
  function pintarActaLista() {
    var contL = document.getElementById("live-acta-local");
    var contV = document.getElementById("live-acta-visitante");
    if (!contL || !contV || !_partidoActivo) return;

    function ordenMinuto(ev) { return ev.minuto === MINUTO_TANDA ? 999 : ev.minuto; }
    var ordenado = actaTemporal.slice().sort(function (a, b) { return ordenMinuto(a) - ordenMinuto(b); });

    var htmlL = "", htmlV = "";
    ordenado.forEach(function (ev) {
      if (ev.equipo_id === _partidoActivo.local.id) htmlL += _miniActaFila(ev);
      else if (ev.equipo_id === _partidoActivo.visitante.id) htmlV += _miniActaFila(ev);
    });
    contL.innerHTML = htmlL;
    contV.innerHTML = htmlV;

    actualizarTandaInfo();
  }

  function pintarMarcadorEnVivo() {
    var m = document.getElementById("live-marcador");
    if (!m || !_partidoActivo) return;
    var r = calcularMarcadorDesdeActa(_partidoActivo.local.id, _partidoActivo.visitante.id);
    // Formato compacto "0-1" (sin espacios, petición usuario) — así cabe
    // de sobra entre los 2 escudos sin empujarlos ni cortar el nombre.
    m.textContent = r.golesLocal + "-" + r.golesVisitante;
  }

  // Los 2 botones .live-team-nombre (local + visitante) van SIEMPRE en
  // una sola línea, con el nombre COMPLETO (nunca recortado con "…",
  // petición usuario ya documentada en css/estilos.css) y con la MISMA
  // fuente entre ambos — petición usuario explícita ("con la misma
  // fuente"): reducir cada botón a SU PROPIO tamaño mínimo (como se hizo
  // en un primer intento) deja "Real Madrid" grande y "Atlético Madrid"
  // pequeño, dos tamaños distintos que no combinan bien al ser un par
  // visual (aunque, desde que los nombres viven en su propia fila
  // .live-teams-nombres — ver index.html —, ya NO pueden desnivelar los
  // escudos de arriba; son 2 filas independientes). Por eso: se calcula
  // el tamaño mínimo que necesita CADA nombre por separado (sin tocar el
  // DOM más que para medir) y se aplica a AMBOS botones el MENOR de los
  // dos — el más restrictivo. Solo actúa si alguno de los 2 desborda;
  // con 2 nombres cortos no se toca nada. Debe ejecutarse DESPUÉS de que
  // el overlay esté visible (clientWidth es 0 con el elemento oculto),
  // por eso se llama diferido a requestAnimationFrame tras mostrar
  // #partido-live-overlay.
  function _ajustarFuenteEquiposEnVivo() {
    var els = document.querySelectorAll(".live-team-nombre");
    if (!els.length) return;
    els.forEach(function (el) {
      el.style.fontSize = ""; // vuelve al tamaño base del CSS antes de medir
    });
    var base = parseFloat(getComputedStyle(els[0]).fontSize) || 12;
    var minSize = base;
    els.forEach(function (el) {
      var size = base;
      var guard = 0;
      while (el.scrollWidth > el.clientWidth + 1 && size > 8 && guard < 20) {
        size -= 0.5;
        el.style.fontSize = size + "px"; // aplicar para poder re-medir scrollWidth
        guard++;
      }
      if (size < minSize) minSize = size;
    });
    // Tamaño final: el MENOR necesario de los 2 (el más restrictivo),
    // aplicado a AMBOS por igual — nunca 2 tamaños distintos.
    els.forEach(function (el) {
      el.style.fontSize = minSize < base ? minSize + "px" : "";
    });
  }

  function iniciarPartidoEnVivo(partidoId, ultimoContexto) {
    var partido = ultimoContexto.partidosPorId[partidoId];
    if (!partido) return;
    var datos = ultimoContexto.datos;
    var local = window.Renderizadores.buscarEquipoPorId(partido.local, datos);
    var visitante = window.Renderizadores.buscarEquipoPorId(partido.visitante, datos);
    if (!local || !visitante) return;

    actaTemporal = [];
    var R = window.Renderizadores;
    var modo = R.detectarModoPartido ? R.detectarModoPartido(partido) : "eliminatoria-unica";

    // "Activar Prórroga y Penaltis" ya se decide en la PANTALLA DE PREVIA
    // (ver js/renderizadores.js::abrirPreviaPartido), ANTES de llegar
    // aquí — su checkbox sigue existiendo en el DOM (la previa solo se
    // OCULTA, no se destruye), así que basta con leer su estado actual.
    var prorrogaChk = document.getElementById("live-prorroga-toggle");
    _partidoActivo = { partido: partido, local: local, visitante: visitante, datos: datos, lado: "local", modo: modo, prorroga: !!(prorrogaChk && prorrogaChk.checked) };

    document.getElementById("live-comp").textContent =
      (R.COMP_LABEL[partido.competicion] || partido.competicion) +
      (partido.ronda ? " · " + partido.ronda : (partido.jornada ? " · Jornada " + partido.jornada : ""));

    // El nombre de cada equipo ES el selector de "¿a quién le añado el
    // evento?" (antes había una fila de botones Local/Visitante aparte,
    // duplicando el nombre que ya se ve debajo del escudo) — con borde
    // resaltado (CSS .live-team-nombre.is-active) se entiende de un
    // vistazo a quién se le está registrando el evento. El escudo/nombre
    // quedan FIJOS (nunca se mueven al añadir eventos): la mini-acta de
    // cada equipo vive en su propio contenedor, ya existente en el HTML,
    // debajo de una barra separadora — ver #live-acta-local/visitante en
    // index.html y pintarActaLista() más abajo.
    document.getElementById("live-team-local").innerHTML = R.crearEscudoHTML(local, "escudo--lg");
    document.getElementById("live-team-visitante").innerHTML = R.crearEscudoHTML(visitante, "escudo--lg");
    document.getElementById("live-nombre-local").innerHTML =
      '<button type="button" class="live-team-nombre" data-lado="local">' + local.nombre + "</button>";
    document.getElementById("live-nombre-visitante").innerHTML =
      '<button type="button" class="live-team-nombre" data-lado="visitante">' + visitante.nombre + "</button>";

    poblarSelectMinuto();
    seleccionarLado("local");
    pintarActaLista();
    pintarMarcadorEnVivo();

    document.getElementById("live-entrada").hidden = false;
    document.getElementById("live-resumen").hidden = true;
    document.getElementById("partido-live-overlay").hidden = false;
    requestAnimationFrame(_ajustarFuenteEquiposEnVivo);
  }

  function cerrarPartidoEnVivo() {
    document.getElementById("partido-live-overlay").hidden = true;
    actaTemporal = [];
    _partidoActivo = null;
  }

  function textoEliminatoria(res, datos) {
    if (!res) return "";
    if (res.pendiente) {
      if (res.motivo === "tercer-partido-generado") {
        return '<p class="live-eliminatoria live-eliminatoria--pendiente">⚠️ Empate total — se ha generado un <strong>TERCER PARTIDO DE DESEMPATE</strong>, ya añadido al calendario de ambos equipos.</p>';
      }
      if (res.motivo === "penaltis-sin-resolver") {
        return '<p class="live-eliminatoria live-eliminatoria--pendiente">🎯 0-0 tras el tercer partido — decide la tanda de penaltis (regístralos con 🟢/🔴 en la próxima confirmación).</p>';
      }
      return "";
    }
    var eq = window.Renderizadores.buscarEquipoPorId(res.ganador, datos);
    var nombre = eq ? eq.nombre : res.ganador;
    var motivos = {
      "global": "por marcador global",
      "gol-visitante-doble": "por la regla del gol de visitante (doble)",
      "desempate-90min": "en el tercer partido de desempate",
      "gol-visitante-partido-unico": "por gol de visitante en el tercer partido",
      "penaltis": "en la tanda de penaltis (" + res.penL + "-" + res.penV + ")"
    };
    return '<p class="live-eliminatoria live-eliminatoria--decidida">🏆 <strong>' + nombre + '</strong> avanza de ronda ' + (motivos[res.motivo] || "") + ".</p>";
  }

  function confirmarPartido() {
    if (!_partidoActivo) return;

    // El MVP es OBLIGATORIO antes de finalizar — si nadie lo ha marcado
    // todavía, avisamos claramente y volvemos a la MISMA pantalla de
    // registro de eventos para que lo elija (nunca "confirmar de todas
    // formas": ese mensaje generaba confusión — petición usuario). La
    // captura para el WhatsApp ya NO se pide aquí — se pide en el
    // resumen final, una vez el partido está confirmado (ver el aviso
    // fijo de #live-resumen en index.html).
    var tieneMvp = actaTemporal.some(function (e) { return e.tipo === "MVP"; });
    if (!tieneMvp) {
      window.alert("⭐ Tienes que elegir el MVP del partido antes de finalizar.");
      return;
    }

    var r = calcularMarcadorDesdeActa(_partidoActivo.local.id, _partidoActivo.visitante.id);
    var resultado = finalizarYSubirPartido(_partidoActivo.partido.id, r.golesLocal, r.golesVisitante);

    var localEsHumano = esEquipoHumano(_partidoActivo.local.id, _partidoActivo.datos);
    var visitanteEsHumano = esEquipoHumano(_partidoActivo.visitante.id, _partidoActivo.datos);

    _ultimoResumen = {
      local: _partidoActivo.local,
      visitante: _partidoActivo.visitante,
      golesL: resultado.golesL,
      golesV: resultado.golesV,
      localEsHumano: localEsHumano,
      visitanteEsHumano: visitanteEsHumano
    };

    document.getElementById("live-resumen-eliminatoria").innerHTML = textoEliminatoria(resultado.eliminatoria, _partidoActivo.datos);

    document.getElementById("live-entrada").hidden = true;
    document.getElementById("live-resumen").hidden = false;

    // 💾 Backup: se resalta el botón de guardado en vez de forzar una
    // descarga automática en cada partido (evitaría que el navegador
    // bloquee descargas repetidas y sería muy invasivo).
    if (window.Persistencia) window.Persistencia.resaltarBotonGuardado();

    _partidoActivo = null;
  }

  // ---------- Delegación de eventos de la pantalla en vivo ----------
  document.addEventListener("click", function (ev) {
    // Descanso ANTES que el chequeo genérico de .live-evt-btn: es la 9ª
    // caja del grid (misma clase), pero no registra ningún evento del
    // acta — solo el aviso de captura.
    var descansoBtn = ev.target.closest && ev.target.closest("#live-descanso");
    if (descansoBtn) {
      window.alert("📸 Descanso — haz una captura del marcador actual para el Grupo WhatsApp LIGA antes de continuar la 2ª parte.");
      return;
    }

    var toggleBtn = ev.target.closest && ev.target.closest(".live-team-nombre");
    if (toggleBtn) { seleccionarLado(toggleBtn.dataset.lado); return; }

    var evtBtn = ev.target.closest && ev.target.closest(".live-evt-btn");
    if (evtBtn && _partidoActivo) {
      var lado = _partidoActivo.lado;
      var equipo = lado === "local" ? _partidoActivo.local : _partidoActivo.visitante;
      var esHumano = esEquipoHumano(equipo.id, _partidoActivo.datos);
      var minutoRaw = document.getElementById("live-minuto").value;
      var minuto = minutoRaw === MINUTO_TANDA ? MINUTO_TANDA : Number(minutoRaw);
      var jugadorSel = document.getElementById("live-jugador");
      var jugadorId = null, jugadorNombre = null;
      if (esHumano && jugadorSel && jugadorSel.value) {
        jugadorId = jugadorSel.value;
        var opt = jugadorSel.options[jugadorSel.selectedIndex];
        jugadorNombre = opt ? opt.textContent.replace(/^#\d+\s/, "") : null;
      }
      agregarEventoActa({
        tipo: evtBtn.dataset.tipo,
        minuto: minuto,
        equipoId: equipo.id,
        equipoNombre: equipo.nombre,
        esHumano: esHumano,
        jugadorId: jugadorId,
        jugadorNombre: jugadorNombre,
        datos: _partidoActivo.datos
      });
      pintarActaLista();
      pintarMarcadorEnVivo();
      return;
    }

    var delBtn = ev.target.closest && ev.target.closest(".live-acta-mini-del");
    if (delBtn && delBtn.dataset.idEvento) {
      eliminarEventoDeActa(delBtn.dataset.idEvento);
      pintarActaLista();
      pintarMarcadorEnVivo();
      return;
    }

    if (ev.target.id === "live-cancelar" || ev.target.id === "live-close") {
      cerrarPartidoEnVivo();
      return;
    }

    if (ev.target.id === "live-confirmar") {
      confirmarPartido();
      return;
    }

    if (ev.target.id === "live-whatsapp" && _ultimoResumen) {
      compartirEnWhatsApp(_ultimoResumen);
      return;
    }

    if (ev.target.id === "live-cerrar-resumen") {
      document.getElementById("partido-live-overlay").hidden = true;
      _ultimoResumen = null;
      return;
    }
  });

  // Minuto: mostrar/ocultar la caja de tanda al vuelo. "Activar Prórroga
  // y Penaltis" ya no vive en esta pantalla (se decide en la previa,
  // ANTES de empezar) — su valor solo se LEE una vez, al arrancar el
  // partido (ver iniciarPartidoEnVivo).
  document.addEventListener("change", function (ev) {
    if (ev.target.id === "live-minuto") {
      actualizarTandaInfo();
      return;
    }
  });

  // ---------- API pública ----------
  window.Acta = {
    agregarEventoActa: agregarEventoActa,
    eliminarEventoDeActa: eliminarEventoDeActa,
    simularGoleadorAutomatorioIA: simularGoleadorAutomatorioIA,
    calcularMarcadorDesdeActa: calcularMarcadorDesdeActa,
    finalizarYSubirPartido: finalizarYSubirPartido,
    compartirEnWhatsApp: compartirEnWhatsApp,
    iniciarPartidoEnVivo: iniciarPartidoEnVivo,
    obtenerActaTemporal: function () { return actaTemporal.slice(); }
  };
})();
