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
    AUTOGOL: { emoji: "🥅", label: "Autogol", esGol: true, autogol: true },
    GOL_FAV_FALTA: { emoji: "🎯", label: "Gol de falta", esGol: true, autogol: false },
    PENALTI_GOL: { emoji: "🟢", label: "Penalti anotado", esGol: true, autogol: false },
    PENALTI_FALLADO: { emoji: "🔴", label: "Penalti fallado", esGol: false, autogol: false },
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
    //    Estado.calcularEstadisticasJugador() ya solo cuenta es_humano:true
    //    al leer los eventos que acabamos de guardar en el paso A.

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
  var _partidoActivo = null; // { partido, local, visitante, datos, lado }
  var _ultimoResumen = null;

  function esEquipoHumano(equipoId, datos) {
    return (datos.equipos.equipos || []).some(function (e) { return e.id === equipoId; });
  }

  function poblarSelectMinuto() {
    var sel = document.getElementById("live-minuto");
    if (!sel) return;
    sel.innerHTML = "";
    for (var m = 5; m <= 90; m += 5) {
      var op = document.createElement("option");
      op.value = String(m);
      op.textContent = m + "'";
      if (m === 45) op.selected = true;
      sel.appendChild(op);
    }
    // Opción especial: penaltis de la tanda de un tercer partido 0-0.
    // No suman al marcador (calcularMarcadorDesdeActa los ignora) —
    // solo los lee sistema-temporadas.js para decidir el ganador.
    var opTanda = document.createElement("option");
    opTanda.value = MINUTO_TANDA;
    opTanda.textContent = "🎯 Tanda de penaltis";
    sel.appendChild(opTanda);
  }

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

    var jugadores = (_partidoActivo.datos.jugadores.jugadores || []).filter(function (j) { return j.equipoId === equipo.id; });
    jugadores.forEach(function (j) {
      var op = document.createElement("option");
      op.value = j.id;
      op.textContent = "#" + j.dorsal + " " + j.nombre + " (" + j.posicion + ")";
      sel.appendChild(op);
    });
  }

  function seleccionarLado(lado) {
    if (!_partidoActivo) return;
    _partidoActivo.lado = lado;
    document.querySelectorAll(".live-toggle-btn").forEach(function (b) {
      b.classList.toggle("is-active", b.dataset.lado === lado);
    });
    poblarSelectJugador();
  }

  function pintarActaLista() {
    var cont = document.getElementById("live-acta-lista");
    if (!cont) return;
    cont.innerHTML = "";

    if (!actaTemporal.length) {
      var vacio = document.createElement("div");
      vacio.className = "live-acta-vacia";
      vacio.textContent = "Todavía no hay eventos registrados.";
      cont.appendChild(vacio);
      return;
    }

    function ordenMinuto(ev) { return ev.minuto === MINUTO_TANDA ? 999 : ev.minuto; }
    var ordenado = actaTemporal.slice().sort(function (a, b) { return ordenMinuto(a) - ordenMinuto(b); });
    ordenado.forEach(function (ev) {
      var meta = TIPOS_EVENTO[ev.tipo];
      var equipo = ev.equipo_id === _partidoActivo.local.id ? _partidoActivo.local : _partidoActivo.visitante;
      var etiquetaMinuto = ev.minuto === MINUTO_TANDA ? "🎯" : ev.minuto + "'";
      var fila = document.createElement("div");
      fila.className = "live-acta-item";
      fila.innerHTML =
        '<span class="live-acta-min">' + etiquetaMinuto + "</span>" +
        '<span class="live-acta-tipo">' + meta.emoji + " " + meta.label + "</span>" +
        '<span class="live-acta-jugador">' + (ev.jugador_nombre || "—") + " <em>(" + equipo.siglas + ")</em></span>" +
        '<button type="button" class="live-acta-del" data-id-evento="' + ev.id_evento + '" aria-label="Eliminar evento">✕</button>';
      cont.appendChild(fila);
    });
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
    _partidoActivo = { partido: partido, local: local, visitante: visitante, datos: datos, lado: "local" };

    var R = window.Renderizadores;
    document.getElementById("live-comp").textContent =
      (R.COMP_LABEL[partido.competicion] || partido.competicion) +
      (partido.ronda ? " · " + partido.ronda : (partido.jornada ? " · Jornada " + partido.jornada : ""));

    document.getElementById("live-team-local").innerHTML =
      R.crearEscudoHTML(local, "escudo--lg") + '<span class="previa-team-nombre">' + local.nombre + "</span>";
    document.getElementById("live-team-visitante").innerHTML =
      R.crearEscudoHTML(visitante, "escudo--lg") + '<span class="previa-team-nombre">' + visitante.nombre + "</span>";

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
    var toggleBtn = ev.target.closest && ev.target.closest(".live-toggle-btn");
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
        jugadorNombre = opt ? opt.textContent.replace(/^#\d+\s/, "").replace(/\s\([A-Z]+\)$/, "") : null;
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

    var delBtn = ev.target.closest && ev.target.closest(".live-acta-del");
    if (delBtn) {
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
