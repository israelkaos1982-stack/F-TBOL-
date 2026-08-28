/* ============================================================
   sistema-temporadas.js — Eliminatorias de Copa y Promoción
   Reglas de desempate para fases a doble partido (ida/vuelta).
   Genérico por diseño: funciona igual para `competicion:'copa'`
   que para una futura `competicion:'promocion'` — ambas usan el
   mismo campo `eliminatoria: { grupoId, fase }`.
   ============================================================ */
(function () {
  "use strict";

  // ---------- Global + gol de visitante doble ----------
  // equipoA fue LOCAL en la ida y VISITANTE en la vuelta.
  // equipoB fue VISITANTE en la ida y LOCAL en la vuelta.
  function calcularGlobal(idaResuelta, vueltaResuelta) {
    var golesA = idaResuelta.resultado.golesLocal + vueltaResuelta.resultado.golesVisitante;
    var golesB = idaResuelta.resultado.golesVisitante + vueltaResuelta.resultado.golesLocal;
    var foraA = vueltaResuelta.resultado.golesVisitante; // goles de A jugando fuera (la vuelta)
    var foraB = idaResuelta.resultado.golesVisitante;    // goles de B jugando fuera (la ida)
    return { golesA: golesA, golesB: golesB, foraA: foraA, foraB: foraB };
  }

  function nuevaFechaTrasVuelta(fechaVuelta) {
    var d = new Date(fechaVuelta);
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString();
  }

  // El tercer partido se juega "en las mismas condiciones que la vuelta":
  // mismo estadio (= mismo local, equipoB) y misma regla de gol visitante
  // doble a la hora de decidir el ganador si acaba en tablas con goles.
  function generarTercerPartido(vueltaResuelta, equipoA, equipoB, grupoId) {
    return {
      id: grupoId + "-desempate",
      competicion: vueltaResuelta.competicion,
      liga: null,
      ronda: (vueltaResuelta.ronda || "Eliminatoria") + " · Desempate",
      jornada: null,
      local: equipoB,
      visitante: equipoA,
      fecha: nuevaFechaTrasVuelta(vueltaResuelta.fecha),
      jugado: false,
      resultado: { golesLocal: null, golesVisitante: null },
      eliminatoria: { grupoId: grupoId, fase: "desempate" }
    };
  }

  // Partido único (no ida/vuelta): empate CON goles -> pasa el visitante
  // (misma regla del gol fuera aplicada a un solo encuentro). 0-0 exacto
  // -> penaltis, leídos directamente del acta ya guardada del partido.
  function resolverTercerPartido(desempate) {
    var gl = desempate.resultado.golesLocal, gv = desempate.resultado.golesVisitante;

    if (gl !== gv) {
      return { ganador: gl > gv ? desempate.local : desempate.visitante, motivo: "desempate-90min" };
    }

    if (gl === 0 && gv === 0) {
      var eventos = desempate.eventos || [];
      var penL = eventos.filter(function (e) { return e.tipo === "PENALTI_GOL" && e.equipo_id === desempate.local; }).length;
      var penV = eventos.filter(function (e) { return e.tipo === "PENALTI_GOL" && e.equipo_id === desempate.visitante; }).length;
      if (penL === penV) return { pendiente: true, motivo: "penaltis-sin-resolver" };
      return { ganador: penL > penV ? desempate.local : desempate.visitante, motivo: "penaltis", penL: penL, penV: penV };
    }

    // Empate CON goles (ej. 1-1, 2-2) -> gana el visitante.
    return { ganador: desempate.visitante, motivo: "gol-visitante-partido-unico" };
  }

  // Resuelve (o hace avanzar) la eliminatoria identificada por grupoId.
  // Devuelve:
  //   { ganador, motivo }                          -> eliminatoria decidida
  //   { pendiente:true, motivo:'tercer-partido-generado', partido }
  //   { pendiente:true, motivo:'penaltis-sin-resolver' }
  //   null                                          -> ida y vuelta aún no jugadas
  function resolverEliminatoria(grupoId, datos) {
    if (!window.Estado) return null;
    var todos = window.Estado.listarPartidosResueltos(datos);
    var partidos = todos.filter(function (p) { return p.eliminatoria && p.eliminatoria.grupoId === grupoId; });

    var ida = partidos.filter(function (p) { return p.eliminatoria.fase === "ida"; })[0];
    var vuelta = partidos.filter(function (p) { return p.eliminatoria.fase === "vuelta"; })[0];
    var desempate = partidos.filter(function (p) { return p.eliminatoria.fase === "desempate"; })[0];

    if (desempate) {
      if (!desempate.jugado) return { pendiente: true, motivo: "esperando-desempate", partido: desempate };
      return resolverTercerPartido(desempate);
    }

    if (!ida || !vuelta || !ida.jugado || !vuelta.jugado) return null;

    var equipoA = ida.local, equipoB = ida.visitante;
    var g = calcularGlobal(ida, vuelta);

    if (g.golesA !== g.golesB) {
      return { ganador: g.golesA > g.golesB ? equipoA : equipoB, motivo: "global", golesA: g.golesA, golesB: g.golesB };
    }
    if (g.foraA !== g.foraB) {
      return { ganador: g.foraA > g.foraB ? equipoA : equipoB, motivo: "gol-visitante-doble" };
    }

    // Empate absoluto (incluidos los goles fuera) -> tercer partido.
    var nuevo = generarTercerPartido(vuelta, equipoA, equipoB, grupoId);
    window.Estado.registrarPartidoGenerado(nuevo);
    return { pendiente: true, motivo: "tercer-partido-generado", partido: nuevo };
  }

  // Punto de entrada llamado por js/acta.js justo después de confirmar
  // cualquier partido. Solo actúa si el partido confirmado pertenece a
  // una eliminatoria y NO es la ida (la ida nunca puede decidir nada).
  function evaluarTrasConfirmar(partidoConfirmado, datos) {
    if (!partidoConfirmado.eliminatoria) return null;
    if (partidoConfirmado.eliminatoria.fase === "ida") return null;
    return resolverEliminatoria(partidoConfirmado.eliminatoria.grupoId, datos);
  }

  window.SistemaTemporadas = {
    resolverEliminatoria: resolverEliminatoria,
    evaluarTrasConfirmar: evaluarTrasConfirmar
  };
})();
