/* ============================================================
   main.js — Orquestador de la app
   FASE 2: wiring mínimo — el click en una caja humana dispara
   el motor de calendario (js/renderizadores.js).
   PENDIENTE (Fase 3+):
     - Sustituir las 6 cajas humanas hardcodeadas en index.html
       por un render dinámico desde data/equipos.json.
     - Router de columna central (data-view del nav): limpiar
       #main-content con innerHTML = "" antes de redibujar cada
       sección para no acumular memoria (regla anti-OOM).
   ============================================================ */
(function () {
  "use strict";

  function activarCaja(box) {
    document.querySelectorAll(".team-box").forEach(function (b) {
      b.classList.remove("team-box--active");
    });
    box.classList.add("team-box--active");
  }

  document.addEventListener("DOMContentLoaded", function () {
    var grid = document.getElementById("team-select-grid");
    if (!grid) return;

    grid.addEventListener("click", function (ev) {
      var box = ev.target.closest(".team-box");
      if (!box) return;
      var id = box.dataset.teamId;
      if (!id) return;

      activarCaja(box);
      if (window.Renderizadores && typeof window.Renderizadores.generarCalendarioLateralDerecho === "function") {
        window.Renderizadores.generarCalendarioLateralDerecho(id);
      }
    });
  });
})();
