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

  // Elige, de la mini-plantilla de texto de un equipo IA, un jugador de
  // Medio o Delantero al azar (fallback a cualquiera si no hay). NUNCA
  // pide selección manual — es automático e instantáneo.
  function simularGoleadorAutomatorioIA(idEquipoIA, datos) {
    var equipo = window.Renderizadores.buscarEquipoPorId(idEquipoIA, datos);
    if (!equipo || !equipo.jugadores || !equipo.jugadores.length) {
      return { id: null, nombre: "Jugador IA" };
    }
    var candidatos = equipo.jugadores.filter(function (j) { return j.posicion === "MED" || j.posicion === "DEL"; });
    if (!candidatos.length) candidatos = equipo.jugadores;
    var elegido = candidatos[Math.floor(Math.random() * candidatos.length)];
    return { id: null, nombre: elegido.nombre };
  }

  // opts: { tipo, minuto, equipoId, esHumano, jugadorId, jugadorNombre, datos }
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
    m.textContent = r.golesLocal + " - " + r.golesVisitante;
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
    document.getElementById("live-team-local").innerHTML =
      R.crearEscudoHTML(local, "escudo--lg") +
      '<button type="button" class="live-team-nombre" data-lado="local">' + local.nombre + "</button>";
    document.getElementById("live-team-visitante").innerHTML =
      R.crearEscudoHTML(visitante, "escudo--lg") +
      '<button type="button" class="live-team-nombre" data-lado="visitante">' + visitante.nombre + "</button>";

    poblarSelectMinuto();
    seleccionarLado("local");
    pintarActaLista();
    pintarMarcadorEnVivo();

    document.getElementById("live-entrada").hidden = false;
    document.getElementById("live-resumen").hidden = true;
    document.getElementById("partido-live-overlay").hidden = false;
  }

  function cerrarPartidoEnVivo() {
    document.getElementById("partido-live-overlay").hidden = true;
    actaTemporal = [];
    _partidoActivo = null;
  }

  // idsPartido: ids de los 2 equipos del partido recién confirmado. Si el
  // club que acaba de jugar cae fuera del top 6 mostrado, su fila se añade
  // debajo con su posición REAL en vez de desaparecer del resumen.
  function renderTablaClasificacionMini(clasificacion, datos, idsPartido) {
    if (!clasificacion || !clasificacion.length) return "";
    idsPartido = idsPartido || [];

    function fila(f, posReal) {
      var eq = window.Renderizadores.buscarEquipoPorId(f.equipoId, datos);
      var nombre = eq ? eq.nombre : f.equipoId;
      var destacada = idsPartido.indexOf(f.equipoId) !== -1;
      return '<tr' + (destacada ? ' class="live-clasificacion-destacada"' : "") + '><td>' + posReal + '</td><td>' + nombre + '</td><td>' + f.pj + '</td>' +
        '<td>' + f.gf + '-' + f.gc + '</td><td><strong>' + f.pts + '</strong></td></tr>';
    }

    var top = clasificacion.slice(0, 6);
    var filas = top.map(function (f, i) { return fila(f, i + 1); }).join("");

    clasificacion.forEach(function (f, i) {
      if (i < 6) return; // ya está arriba
      if (idsPartido.indexOf(f.equipoId) === -1) return;
      filas += fila(f, i + 1);
    });

    return (
      '<table class="live-clasificacion"><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>GF-GC</th><th>Pts</th></tr></thead>' +
      "<tbody>" + filas + "</tbody></table>"
    );
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

    // Recordatorio de MVP — solo si nadie lo ha marcado todavía (no
    // bloquea de verdad: cancelable, por si el admin de verdad no quiere
    // elegir MVP en este partido).
    var tieneMvp = actaTemporal.some(function (e) { return e.tipo === "MVP"; });
    if (!tieneMvp && !window.confirm("⭐ Todavía no has elegido el MVP del partido. ¿Confirmar de todas formas?")) return;

    window.alert("📸 Vas a FINALIZAR el partido, haz una captura para el Grupo WhatsApp LIGA.");

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

    document.getElementById("live-resumen-texto").textContent =
      _partidoActivo.local.nombre + " " + resultado.golesL + " - " + resultado.golesV + " " + _partidoActivo.visitante.nombre;

    document.getElementById("live-resumen-eliminatoria").innerHTML = textoEliminatoria(resultado.eliminatoria, _partidoActivo.datos);
    document.getElementById("live-resumen-clasificacion").innerHTML = renderTablaClasificacionMini(
      resultado.clasificacion,
      _partidoActivo.datos,
      [_partidoActivo.local.id, _partidoActivo.visitante.id]
    );

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
