/* ============================================================
   acta.js — Acta en vivo: registro de eventos y cierre en cadena.
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
    //    la Fase 1, CSS .match-card.is-played). El 5º argumento sella la
    //    "identidad de reserva" del partido (competición+rivales+ida o
    //    vuelta) para que este resultado sobreviva si el admin corrige
    //    DESPUÉS el texto de la ronda de esa línea en el Calendario extra
    //    (ver Estado.registrarResultadoPartido/listarPartidosResueltos).
    window.Estado.registrarResultadoPartido(idPartido, golesL, golesV, actaTemporal, { partido: ctx.partido, datos: ctx.datos });

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
  // PANTALLA EN VIVO — wiring de la UI (formulario de eventos + acta)
  // ============================================================
  var _partidoActivo = null; // { partido, local, visitante, datos, lado, modo, prorroga }

  function esEquipoHumano(equipoId, datos) {
    return (datos.equipos.equipos || []).some(function (e) { return e.id === equipoId; });
  }

  // Minuto: 5' a 95' SIEMPRE (los 90-95 representan el descuento). Si
  // `_partidoActivo.prorroga` está activa se añaden 100'-120' + la
  // opción de Tanda — en modo "eliminatoria-unica" depende de la
  // casilla que el admin marcó en la previa; en la VUELTA de una
  // eliminatoria a doble partido `prorroga` llega SIEMPRE en true
  // (forzado en iniciarPartidoEnVivo — es el único partido que puede
  // decidir el global, ver js/sistema-temporadas.js). La IDA nunca
  // llega aquí con prorroga:true (su previa no pinta la casilla).
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

    var permiteProrroga = !!_partidoActivo.prorroga;
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

  // Caja "🎯 Tanda de penaltis" — oculta salvo que el admin haya
  // seleccionado esa opción del minuto, o ya haya penaltis registrados
  // en la tanda (para que no desaparezca si vuelve a cambiar el minuto).
  // Los 2 números son INPUTS editables (ver _fijarTandaPenaltis) — este
  // helper solo los refleja, nunca decide el ganador (eso lo sigue
  // haciendo sistema-temporadas.js contando estos mismos eventos).
  function actualizarTandaInfo() {
    var box = document.getElementById("live-tanda-info");
    var inputL = document.getElementById("live-tanda-local");
    var inputV = document.getElementById("live-tanda-visitante");
    if (!box || !inputL || !inputV || !_partidoActivo) return;
    var minutoSel = document.getElementById("live-minuto");
    var enModoTanda = !!(minutoSel && minutoSel.value === MINUTO_TANDA);
    var penL = _contarTandaPenaltis(_partidoActivo.local.id);
    var penV = _contarTandaPenaltis(_partidoActivo.visitante.id);
    box.hidden = !(enModoTanda || (penL + penV) > 0);
    // No pisar el input mientras el admin lo tiene enfocado (escribiendo)
    // — evita que el eco de _fijarTandaPenaltis le mueva el cursor/borre
    // lo que lleva tecleado a mitad de un número de 2 cifras.
    if (document.activeElement !== inputL) inputL.value = String(penL);
    if (document.activeElement !== inputV) inputV.value = String(penV);
  }

  function _contarTandaPenaltis(equipoId) {
    return actaTemporal.filter(function (e) {
      return e.tipo === "PENALTI_GOL" && e.minuto === MINUTO_TANDA && e.equipo_id === equipoId;
    }).length;
  }

  // Etiqueta genérica para un penalti de la tanda añadido por el
  // resultado-final-editable — no hay forma de saber QUÉ jugador tiró
  // cada uno cuando el admin escribe el número directamente (es
  // precisamente lo que este atajo evita tener que registrar uno a
  // uno). Los botones del grid (🥅 GOL PENAL, con jugador/IA
  // resueltos) siguen funcionando en paralelo si el admin prefiere ir
  // sumando penalti a penalti con atribución real.
  var _JUGADOR_TANDA_GENERICO = "Tanda de penaltis";

  // Fija el resultado final de la tanda de ESE equipo: borra sus
  // eventos PENALTI_GOL@TANDA ya existentes (los venga de donde vengan
  // — botón o edición anterior) y crea exactamente `cantidad` nuevos.
  // Mismo modelo de datos que el flujo de botones (un evento por
  // penalti marcado), así que sistema-temporadas.js (_tandaPenaltis,
  // que solo CUENTA estos eventos) decide el ganador exactamente igual:
  // el equipo que termine con más penaltis marcados avanza de ronda.
  function _fijarTandaPenaltis(equipo, cantidad) {
    if (!_partidoActivo || !equipo) return;
    var n = Math.max(0, Math.floor(Number(cantidad)) || 0);
    actaTemporal = actaTemporal.filter(function (e) {
      return !(e.tipo === "PENALTI_GOL" && e.minuto === MINUTO_TANDA && e.equipo_id === equipo.id);
    });
    for (var i = 0; i < n; i++) {
      actaTemporal.push({
        id_evento: nuevoIdEvento(),
        minuto: MINUTO_TANDA,
        tipo: "PENALTI_GOL",
        equipo_id: equipo.id,
        equipo_nombre: equipo.nombre || null,
        es_humano: false,
        jugador_id: null,
        jugador_nombre: _JUGADOR_TANDA_GENERICO
      });
    }
    pintarActaLista();
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

  // Construye el atributo style="--team-color-a:...;--team-color-b:..."
  // para el botón del nombre del equipo, a partir de sus colores de
  // escudo. Solo se usa si colorPrimario existe (equipos sintéticos
  // muy antiguos podrían no tenerlo). Los valores son hex de nuestros
  // propios JSON (no input de usuario), no requieren escapado.
  function _colorEscudoStyleAttr(equipo) {
    var a = equipo && equipo.colorPrimario;
    if (!a) return "";
    var b = (equipo && equipo.colorSecundario) || a;
    return ' style="--team-color-a:' + a + ";--team-color-b:" + b + '"';
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
    // La VUELTA de una eliminatoria a doble partido es la ÚNICA que
    // puede decidir el global (empate + gol de visitante también
    // empatado -> prórroga de ESTE MISMO partido, ver
    // js/sistema-temporadas.js) — por eso la previa NO le pinta una
    // casilla opcional, la prórroga+penaltis está SIEMPRE disponible ahí,
    // sin que el admin tenga que acordarse de marcarla. Misma detección
    // de fase (`faseIdaVuelta`) que usa la previa para decidir si pinta
    // el aviso — así nunca pueden discrepar.
    var esVueltaDecisiva = modo === "ida-vuelta" && R.faseIdaVuelta && R.faseIdaVuelta(partido) === "vuelta";
    var prorrogaChk = document.getElementById("live-prorroga-toggle");
    _partidoActivo = {
      partido: partido, local: local, visitante: visitante, datos: datos, lado: "local", modo: modo,
      prorroga: esVueltaDecisiva ? true : !!(prorrogaChk && prorrogaChk.checked)
    };

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
    // Texto del nombre con degradado de los colores del propio escudo
    // (petición usuario: "mezcla los colores del equipo en el texto").
    // colorPrimario/colorSecundario YA viven en cada equipo (equipos.json,
    // equipos_ia.json, rivales_reales.json) — coste 0 KB extra, solo se
    // inyectan como custom properties CSS (--team-color-a/-b) que el
    // degradado de .tiene-color-escudo (css/estilos.css) consume. Sin
    // colorPrimario (no debería pasar, pero por si acaso) el botón se
    // queda con el color plano de siempre.
    document.getElementById("live-nombre-local").innerHTML =
      '<button type="button" class="live-team-nombre' + (local.colorPrimario ? " tiene-color-escudo" : "") + '" data-lado="local"' + _colorEscudoStyleAttr(local) + ">" + local.nombre + "</button>";
    document.getElementById("live-nombre-visitante").innerHTML =
      '<button type="button" class="live-team-nombre' + (visitante.colorPrimario ? " tiene-color-escudo" : "") + '" data-lado="visitante"' + _colorEscudoStyleAttr(visitante) + ">" + visitante.nombre + "</button>";

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
      if (res.motivo === "empate-sin-prorroga") {
        return '<p class="live-eliminatoria live-eliminatoria--pendiente">⚠️ Empate total (marcador global y gol de visitante) — hacía falta la <strong>prórroga de este partido de vuelta</strong>. Reinícialo y repítelo con "Activar Prórroga y Penaltis" activa.</p>';
      }
      if (res.motivo === "penaltis-sin-resolver") {
        return '<p class="live-eliminatoria live-eliminatoria--pendiente">🎯 Sigue empate tras la prórroga — decide la tanda de penaltis (regístralos con 🟢/🔴 antes de confirmar).</p>';
      }
      return "";
    }
    var eq = window.Renderizadores.buscarEquipoPorId(res.ganador, datos);
    var nombre = eq ? eq.nombre : res.ganador;
    var motivos = {
      "global": "por marcador global",
      "gol-visitante-doble": "por la regla del gol de visitante (doble)",
      "gol-de-oro": "por gol de oro en la prórroga",
      "penaltis": "en la tanda de penaltis (" + res.penL + "-" + res.penV + ")"
    };
    return '<p class="live-eliminatoria live-eliminatoria--decidida">🏆 <strong>' + nombre + '</strong> avanza de ronda ' + (motivos[res.motivo] || "") + ".</p>";
  }

  // Un partido a ELIMINACIÓN DIRECTA (Copa/competición europea a
  // partido único, final, dieciseisavos… "eliminatoria-unica" en
  // Renderizadores.detectarModoPartido) SIEMPRE tiene que dar un
  // ganador — nunca puede quedarse en empate (bug real, foto usuario:
  // "Levante 0-0 Atlético Madrid" confirmado tal cual en Dieciseisavos
  // de Copa del Rey). El amistoso es la ÚNICA excepción dentro de
  // "eliminatoria-unica" — su casilla de prórroga es OPCIONAL, no
  // obligatoria (ver _renderFormatoBoxPrevia en js/renderizadores.js):
  // un amistoso sí puede terminar en tablas, como en la vida real.
  function _necesitaGanador(partido) {
    var R = window.Renderizadores;
    if (!R || !R.detectarModoPartido) return false;
    if (R.detectarModoPartido(partido) !== "eliminatoria-unica") return false;
    return R.resolverCompKeyPartido(partido.competicion) !== "amistosos";
  }

  function confirmarPartido() {
    if (!_partidoActivo) return;

    // Si este partido NECESITA un ganador y sigue empatado, se bloquea
    // el finalizado con un aviso claro de qué falta por jugar — nunca
    // se confirma un empate en una eliminatoria a partido único. Misma
    // cadena de resolución que la VUELTA de una eliminatoria a doble
    // partido (ver js/sistema-temporadas.js): primero la prórroga
    // (100'-120', el gol de oro desempata solo), y si sigue empate tras
    // ella, la tanda de penaltis. "Activar Prórroga y Penaltis" ya es
    // OBLIGATORIA en la previa de estos partidos (checkbox "fuego"), así
    // que el desplegable de Minuto ya ofrece 100'-120' + Tanda — aquí
    // solo se comprueba que el admin de verdad los haya usado.
    if (_necesitaGanador(_partidoActivo.partido)) {
      var rEmpate = calcularMarcadorDesdeActa(_partidoActivo.local.id, _partidoActivo.visitante.id);
      if (rEmpate.golesLocal === rEmpate.golesVisitante) {
        var huboProrroga = actaTemporal.some(function (e) {
          return e.minuto === MINUTO_TANDA || (typeof e.minuto === "number" && e.minuto > 95);
        });
        if (!huboProrroga) {
          window.alert("⏱️ Este partido es a eliminación directa y no puede terminar en empate — juega la PRÓRROGA (100'-120') y, si sigue igual, la TANDA DE PENALTIS antes de finalizar.");
          return;
        }
        var penL = _contarTandaPenaltis(_partidoActivo.local.id);
        var penV = _contarTandaPenaltis(_partidoActivo.visitante.id);
        if (penL === penV) {
          window.alert("🎯 Sigue empate tras la prórroga — decide la TANDA DE PENALTIS (elige el minuto \"🎯 Tanda de penaltis\" y registra los goles de cada equipo) antes de finalizar.");
          return;
        }
      }
    }

    // El MVP es OBLIGATORIO antes de finalizar — si nadie lo ha marcado
    // todavía, avisamos claramente y volvemos a la MISMA pantalla de
    // registro de eventos para que lo elija (nunca "confirmar de todas
    // formas": ese mensaje generaba confusión — petición usuario).
    var tieneMvp = actaTemporal.some(function (e) { return e.tipo === "MVP"; });
    if (!tieneMvp) {
      window.alert("⭐ Tienes que elegir el MVP del partido antes de finalizar.");
      return;
    }

    var r = calcularMarcadorDesdeActa(_partidoActivo.local.id, _partidoActivo.visitante.id);
    var resultado = finalizarYSubirPartido(_partidoActivo.partido.id, r.golesLocal, r.golesVisitante);

    document.getElementById("live-resumen-eliminatoria").innerHTML = textoEliminatoria(resultado.eliminatoria, _partidoActivo.datos);

    document.getElementById("live-entrada").hidden = true;
    document.getElementById("live-resumen").hidden = false;

    // 💾 Backup: se resalta el botón de guardado en vez de forzar una
    // descarga automática en cada partido (evitaría que el navegador
    // bloquee descargas repetidas y sería muy invasivo).
    if (window.Persistencia) window.Persistencia.resaltarBotonGuardado();

    _partidoActivo = null;

    // Captura automática de ESTA pantalla (🏁 FINALIZADO, ya visible con
    // marcador/acta/MVP/eliminatoria) + apertura del Grupo WhatsApp LIGA
    // — mismo patrón que "▶ Empezar partido"/"▶ Continuar 2ª parte" (ver
    // js/renderizadores.js::_capturarYCompartirPreviaWhatsapp). A
    // diferencia de esos 2 (capturan la pantalla ANTES de pasar a la
    // siguiente), aquí se captura DESPUÉS de mostrar el resumen — es
    // justo lo que pedía el antiguo aviso "📸 Envía captura final del
    // partido" (ya retirado de index.html), ahora automático.
    if (window.Renderizadores && window.Renderizadores.capturarYCompartirPreviaWhatsapp) {
      if (window.Renderizadores.whatsappGrupoLigaUrl) {
        window.open(window.Renderizadores.whatsappGrupoLigaUrl, "_blank");
      }
      var liveCardEl = document.querySelector("#partido-live-overlay .live-card");
      window.Renderizadores.capturarYCompartirPreviaWhatsapp(liveCardEl, function () {});
    }
  }

  // ---------- Delegación de eventos de la pantalla en vivo ----------
  document.addEventListener("click", function (ev) {
    // Descanso ANTES que el chequeo genérico de .live-evt-btn: es la 9ª
    // caja del grid (misma clase), pero no registra ningún evento del
    // acta — solo cambia de vista (VISTA A -> VISTA C, ver index.html)
    // para poder hacer la captura sobre una pantalla limpia, sin el
    // formulario de eventos (minuto/jugador/grid 3x3) detrás de un
    // alert() bloqueando la vista (petición usuario 2026-09-03 #3).
    var descansoBtn = ev.target.closest && ev.target.closest("#live-descanso");
    if (descansoBtn) {
      document.getElementById("live-entrada").hidden = true;
      document.getElementById("live-descanso-vista").hidden = false;
      return;
    }
    // "▶ Continuar 2ª parte" (petición usuario 2026-09-05, mismo
    // automatismo que "▶ Empezar partido" — ver js/renderizadores.js::
    // _capturarYCompartirPreviaWhatsapp): UN SOLO toque ⇒ captura la
    // pantalla de DESCANSO tal cual se ve (escudos/marcador/nombres +
    // el aviso 🛌 DESCANSO) y la copia al portapapeles, abre el Grupo
    // WhatsApp LIGA en una pestaña nueva, y SOLO ENTONCES vuelve a la
    // VISTA A (la acta —mini-eventos, escudos, marcador— sigue siendo
    // la MISMA de siempre, arriba de ambas vistas; aquí solo se
    // reactiva el formulario para seguir registrando eventos de la 2ª
    // parte). La captura debe correr ANTES de ocultar la vista de
    // DESCANSO — html2canvas no puede fotografiar un nodo ya oculto.
    var btnContinuar2 = ev.target.closest && ev.target.closest("#live-continuar-2parte");
    if (btnContinuar2) {
      if (btnContinuar2.dataset.enCurso) return; // evita doble-toque mientras se genera la captura
      btnContinuar2.dataset.enCurso = "1";
      var seguirA2Parte = function () {
        btnContinuar2.dataset.enCurso = "";
        document.getElementById("live-descanso-vista").hidden = true;
        document.getElementById("live-entrada").hidden = false;
      };
      if (window.Renderizadores && window.Renderizadores.capturarYCompartirPreviaWhatsapp) {
        if (window.Renderizadores.whatsappGrupoLigaUrl) {
          window.open(window.Renderizadores.whatsappGrupoLigaUrl, "_blank");
        }
        var liveCardEl = document.querySelector("#partido-live-overlay .live-card");
        window.Renderizadores.capturarYCompartirPreviaWhatsapp(liveCardEl, seguirA2Parte);
      } else {
        seguirA2Parte();
      }
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

    if (ev.target.id === "live-cancelar") {
      cerrarPartidoEnVivo();
      return;
    }

    // El ✕ superior cierra el overlay en CUALQUIER vista — incluida la
    // VISTA B (resumen), donde ya no hace falta ningún patrón de 2
    // toques: al llegar aquí la captura + el Grupo WhatsApp LIGA ya se
    // dispararon solos al pulsar "🏁 FINALIZAR" (ver confirmarPartido()),
    // así que un solo toque para cerrar es seguro.
    if (ev.target.id === "live-close" || ev.target.id === "live-cerrar-resumen") {
      cerrarPartidoEnVivo();
      return;
    }

    if (ev.target.id === "live-confirmar") {
      confirmarPartido();
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

  // Resultado final de la tanda tecleado a mano — "input" (no "change")
  // para que se refleje al momento, no solo al perder el foco.
  document.addEventListener("input", function (ev) {
    if (!_partidoActivo) return;
    if (ev.target.id === "live-tanda-local") {
      _fijarTandaPenaltis(_partidoActivo.local, ev.target.value);
      return;
    }
    if (ev.target.id === "live-tanda-visitante") {
      _fijarTandaPenaltis(_partidoActivo.visitante, ev.target.value);
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
    iniciarPartidoEnVivo: iniciarPartidoEnVivo,
    obtenerActaTemporal: function () { return actaTemporal.slice(); }
  };
})();
