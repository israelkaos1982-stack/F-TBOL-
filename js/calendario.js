/* ============================================================
   calendario.js — Motor evolutivo de calendario (columna derecha)
   FASE 1: solo existe el estado vacío (#calendar-empty) en
   index.html.
   FASE 2 (pendiente):
     - Al pulsar una .team-box: limpiar #calendar-content
       (innerHTML = "") y leer la propiedad ligaActual del
       mánager seleccionado (data/equipos.json).
     - Filtrar data/partidos.json por esa liga (15 partidos en
       1ª RFEF, 17 en Hypermotion, 38 en Liga EA Sports) y sumar
       en paralelo los partidos de los torneos KO activos (Copa
       del Rey, Supercopa de España, Champions...) donde
       participe el club.
     - Pintar una .match-card por partido; si `jugado === true`
       añadir la clase `.is-played` (opacidad gris + botón
       PREVIA oculto — ya resuelto por CSS, ver estilos.css).
   ============================================================ */
(function () {
  "use strict";
  // Intencionalmente vacío en Fase 1.
})();
