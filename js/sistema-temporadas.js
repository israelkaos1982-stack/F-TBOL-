/* ============================================================
   sistema-temporadas.js — Eliminatorias de Copa y Promoción
   Reglas de desempate para fases a doble partido (ida/vuelta).
   Genérico por diseño: funciona igual para `competicion:'copa'`
   que para una futura `competicion:'promocion'` — ambas usan el
   mismo campo `eliminatoria: { grupoId, fase }`.

   Gol de visitante DOBLE: si tras ida+vuelta el marcador global
   está empatado, decide quién marcó MÁS goles jugando fuera de
   casa (ver calcularGlobal). Si también empatan ahí, la eliminatoria
   se decide en la PRÓRROGA del propio partido de VUELTA — no se
   genera ningún tercer partido aparte: "Activar Prórroga y
   Penaltis" está SIEMPRE disponible en la previa de la vuelta (ver
   js/renderizadores.js::_renderFormatoBoxPrevia) precisamente
   porque es el único partido que puede necesitarla. Dentro de esa
   prórroga rige el gol de oro (el primer gol de cualquiera de los 2
   equipos desempata el global al instante — se detecta solo, porque
   ESE gol ya rompe el empate en calcularGlobal); si nadie marca, se
   decide con la tanda de penaltis de ESE MISMO partido.
   ============================================================ */
(function () {
  "use strict";

  var MINUTO_TANDA = "TANDA"; // mismo sentinel que js/acta.js — penaltis de la tanda, no cuentan como gol real

  // ---------- Global + gol de visitante doble ----------
  // equipoA fue LOCAL en la ida y VISITANTE en la vuelta.
  // equipoB fue VISITANTE en la ida y LOCAL en la vuelta.
  // golesA/golesB YA incluyen cualquier gol marcado en la prórroga de la
  // vuelta (calcularMarcadorDesdeActa, en js/acta.js, cuenta todos los
  // goles del partido salvo los de la tanda de penaltis) — así que un
  // gol de oro en la prórroga desempata el global aquí mismo, sin lógica
  // aparte.
  function calcularGlobal(idaResuelta, vueltaResuelta) {
    var golesA = idaResuelta.resultado.golesLocal + vueltaResuelta.resultado.golesVisitante;
    var golesB = idaResuelta.resultado.golesVisitante + vueltaResuelta.resultado.golesLocal;
    var foraA = vueltaResuelta.resultado.golesVisitante; // goles de A jugando fuera (la vuelta)
    var foraB = idaResuelta.resultado.golesVisitante;    // goles de B jugando fuera (la ida)
    return { golesA: golesA, golesB: golesB, foraA: foraA, foraB: foraB };
  }

  // ¿Se llegó a jugar la prórroga en este partido? (minutos 100'-120' o
  // la tanda de penaltis) — distingue "el global sigue empatado porque
  // la vuelta se confirmó a los 90' sin activar la prórroga" (hace falta
  // reiniciar y repetir esa vuelta con la casilla activada) de "se jugó
  // la prórroga entera 0-0 y toca resolver por penaltis".
  function _huboProrroga(eventos) {
    return (eventos || []).some(function (e) {
      return e.minuto === MINUTO_TANDA || (typeof e.minuto === "number" && e.minuto > 95);
    });
  }

  // Penaltis de la TANDA (no los goles de penalti metidos en juego, que
  // ya suman al marcador normal) marcados por cada equipo en el partido.
  function _tandaPenaltis(eventos, equipoA, equipoB) {
    var penA = 0, penB = 0;
    (eventos || []).forEach(function (e) {
      if (e.tipo !== "PENALTI_GOL" || e.minuto !== MINUTO_TANDA) return;
      if (e.equipo_id === equipoA) penA++;
      else if (e.equipo_id === equipoB) penB++;
    });
    return { penA: penA, penB: penB };
  }

  // Resuelve la eliminatoria identificada por grupoId a partir de sus 2
  // legs (ida + vuelta). Devuelve:
  //   { ganador, motivo, ... }              -> eliminatoria decidida
  //   { pendiente:true, motivo:'empate-sin-prorroga' }
  //   { pendiente:true, motivo:'penaltis-sin-resolver' }
  //   null                                   -> ida y/o vuelta aún sin jugar
  function resolverEliminatoria(grupoId, datos) {
    if (!window.Estado) return null;
    var todos = window.Estado.listarPartidosResueltos(datos);
    var partidos = todos.filter(function (p) { return p.eliminatoria && p.eliminatoria.grupoId === grupoId; });

    var ida = partidos.filter(function (p) { return p.eliminatoria.fase === "ida"; })[0];
    var vuelta = partidos.filter(function (p) { return p.eliminatoria.fase === "vuelta"; })[0];
    if (!ida || !vuelta || !ida.jugado || !vuelta.jugado) return null;

    var equipoA = ida.local, equipoB = ida.visitante;
    var g = calcularGlobal(ida, vuelta);
    var huboProrroga = _huboProrroga(vuelta.eventos);

    if (g.golesA !== g.golesB) {
      return {
        ganador: g.golesA > g.golesB ? equipoA : equipoB,
        // Si hubo prórroga, el desempate SOLO puede venir de un gol
        // marcado ahí (antes del descanso ya se habría contado en la
        // rama "gol-visitante-doble" o habría sido un empate en toda
        // regla) — así que el motivo real es el gol de oro.
        motivo: huboProrroga ? "gol-de-oro" : "global",
        golesA: g.golesA, golesB: g.golesB
      };
    }
    if (g.foraA !== g.foraB) {
      return { ganador: g.foraA > g.foraB ? equipoA : equipoB, motivo: "gol-visitante-doble" };
    }

    // Empate absoluto (global Y gol de visitante) -> decide la prórroga
    // de la propia vuelta. Si nadie la jugó, no hay nada más que resolver
    // aquí: el admin tiene que reiniciar ese partido de vuelta y
    // repetirlo con "Activar Prórroga y Penaltis" marcada.
    if (!huboProrroga) {
      return { pendiente: true, motivo: "empate-sin-prorroga" };
    }
    var pen = _tandaPenaltis(vuelta.eventos, equipoA, equipoB);
    if (pen.penA === pen.penB) {
      return { pendiente: true, motivo: "penaltis-sin-resolver" };
    }
    return { ganador: pen.penA > pen.penB ? equipoA : equipoB, motivo: "penaltis", penL: pen.penA, penV: pen.penB };
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
