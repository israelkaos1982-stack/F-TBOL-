/* ============================================================
   main.js — Orquestador de la app · Fase 4: navegación a
   pantalla completa (Inicio / Panel Admin / Club activo).

   3 pantallas mutuamente excluyentes (nunca 2 visibles a la vez):
     screen-inicio  -> las 6 cajas humanas + engranaje
     screen-admin   -> Calendar / Stadium Hub / Ball Storage /
                       Espacio del navegador / Borrar TODO,
                       detrás del candado 747
     screen-club    -> cabecera del mánager activo + tabs
                       Calendario / Plantilla + botón Salir

   El candado NO es seguridad real (comparación de string en
   claro) — es solo fricción para que ninguno de los 6 amigos
   pulse "Borrar TODO" sin querer, mismo criterio que los PIN de
   3 dígitos ya usados en otras herramientas de admin del proyecto.
   ============================================================ */
(function () {
  "use strict";

  var ADMIN_PASSWORD = "747";

  // ---------- Gestor de pantallas ----------
  var PANTALLAS = ["inicio", "admin", "club"];
  function mostrarPantalla(nombre) {
    PANTALLAS.forEach(function (n) {
      var el = document.getElementById("screen-" + n);
      if (el) el.hidden = n !== nombre;
    });
  }

  // ---------- Pantalla 1: Inicio -> entrar a un club ----------
  function activarCaja(box) {
    document.querySelectorAll(".team-box").forEach(function (b) {
      b.classList.remove("team-box--active");
    });
    box.classList.add("team-box--active");
  }

  function mostrarClubTab(tab) {
    document.querySelectorAll(".club-tab").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.dataset.clubTab === tab);
    });
    var panelCal = document.getElementById("club-tab-calendario");
    var panelPla = document.getElementById("club-tab-plantilla");
    if (panelCal) panelCal.hidden = tab !== "calendario";
    if (panelPla) panelPla.hidden = tab !== "plantilla";
  }

  function abrirClub(teamId, box) {
    window._idManagerActivo = teamId;
    activarCaja(box);

    if (window.Renderizadores && typeof window.Renderizadores.cargarTodo === "function") {
      window.Renderizadores.cargarTodo().then(function (datos) {
        var equipo = window.Renderizadores.buscarEquipoPorId(teamId, datos);
        if (!equipo) return;
        var escudoSlot = document.getElementById("club-escudo");
        var nombreEl = document.getElementById("club-nombre");
        var misterEl = document.getElementById("club-mister");
        if (escudoSlot) escudoSlot.innerHTML = window.Renderizadores.crearEscudoHTML(equipo, "escudo--sm");
        if (nombreEl) nombreEl.textContent = equipo.nombre || "—";
        if (misterEl) misterEl.textContent = equipo.mister || "—";
      });

      if (typeof window.Renderizadores.generarCalendarioLateralDerecho === "function") {
        window.Renderizadores.generarCalendarioLateralDerecho(teamId);
      }
      if (typeof window.Renderizadores.renderizarPlantillaClub === "function") {
        window.Renderizadores.renderizarPlantillaClub(teamId);
      }
    }

    mostrarClubTab("calendario");
    mostrarPantalla("club");
  }

  function salirDelClub() {
    window._idManagerActivo = null;
    document.querySelectorAll(".team-box").forEach(function (b) {
      b.classList.remove("team-box--active");
    });
    mostrarPantalla("inicio");
  }

  // ---------- Candado del Panel Admin (747) ----------
  function abrirCandadoAdmin() {
    var ov = document.getElementById("admin-password-overlay");
    var input = document.getElementById("password-input");
    var error = document.getElementById("password-error");
    if (error) error.hidden = true;
    if (input) input.value = "";
    if (ov) ov.hidden = false;
    if (input) input.focus();
  }

  function cerrarCandadoAdmin() {
    var ov = document.getElementById("admin-password-overlay");
    var input = document.getElementById("password-input");
    var error = document.getElementById("password-error");
    if (ov) ov.hidden = true;
    if (input) input.value = "";
    if (error) error.hidden = true;
  }

  function comprobarCandadoAdmin() {
    var input = document.getElementById("password-input");
    var error = document.getElementById("password-error");
    if (!input) return;
    if (input.value === ADMIN_PASSWORD) {
      cerrarCandadoAdmin();
      mostrarPantalla("admin");
    } else {
      if (error) error.hidden = false;
      input.value = "";
      input.focus();
    }
  }

  // ---------- Pantalla 2: Panel Admin ----------
  var ADMIN_VISTAS = {
    calendario: {
      titulo: "🗓️ Calendar — temporada completa",
      render: function (id) { window.Renderizadores.renderizarAdminCalendario(id); }
    },
    estadios: {
      titulo: "🏟️ Stadium Hub — 30 estadios",
      render: function (id) { window.Renderizadores.renderizarAdminEstadios(id); }
    },
    balones: {
      titulo: "⚽ Ball Storage — inventario",
      render: function (id) { window.Renderizadores.renderizarAdminBalones(id); }
    },
    espacio: {
      titulo: "💾 Espacio del navegador",
      render: function (id) { window.Renderizadores.renderizarAdminEspacio(id); }
    }
  };

  function abrirVistaAdmin(vista) {
    var detalle = document.getElementById("admin-detalle");
    var def = ADMIN_VISTAS[vista];
    if (!detalle || !def || !window.Renderizadores) return;

    detalle.innerHTML =
      '<div class="admin-detalle-header">' +
      '<span class="admin-detalle-title">' + def.titulo + "</span>" +
      '<button type="button" class="admin-detalle-close" id="admin-detalle-close">✕ Cerrar</button>' +
      "</div>" +
      '<div class="admin-list" id="admin-detalle-contenido"></div>';
    detalle.hidden = false;
    def.render("admin-detalle-contenido");
    detalle.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cerrarVistaAdmin() {
    var detalle = document.getElementById("admin-detalle");
    if (detalle) {
      detalle.hidden = true;
      detalle.innerHTML = "";
    }
  }

  function borrarTodoConfirmado() {
    var ok = window.confirm(
      "⚠️ Esto borra TODO el progreso guardado en este dispositivo (partidos jugados, actas, terceros partidos de desempate por eliminatoria).\n\n" +
      "Las 6 plantillas y el calendario base NO se pierden — vuelven a su estado de fábrica. Esta acción NO se puede deshacer.\n\n" +
      "¿Seguro que quieres continuar?"
    );
    if (!ok) return;
    if (window.Estado) window.Estado.borrarTodo();
    cerrarVistaAdmin();
    alert("✅ Progreso borrado. Vuelves al inicio.");
    salirDelClub();
  }

  // ---------- Wiring ----------
  document.addEventListener("DOMContentLoaded", function () {
    var grid = document.getElementById("team-select-grid");
    if (grid) {
      grid.addEventListener("click", function (ev) {
        var box = ev.target.closest(".team-box");
        if (!box) return;
        var id = box.dataset.teamId;
        if (!id) return;
        abrirClub(id, box);
      });
    }

    var btnGear = document.getElementById("btn-abrir-admin");
    if (btnGear) btnGear.addEventListener("click", abrirCandadoAdmin);

    var btnPassSubmit = document.getElementById("password-submit");
    if (btnPassSubmit) btnPassSubmit.addEventListener("click", comprobarCandadoAdmin);

    var inputPass = document.getElementById("password-input");
    if (inputPass) {
      inputPass.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") comprobarCandadoAdmin();
      });
    }

    var btnPassClose = document.getElementById("password-close");
    if (btnPassClose) btnPassClose.addEventListener("click", cerrarCandadoAdmin);

    var ovPass = document.getElementById("admin-password-overlay");
    if (ovPass) {
      ovPass.addEventListener("click", function (ev) {
        if (ev.target === ovPass) cerrarCandadoAdmin();
      });
    }

    var btnAdminVolver = document.getElementById("admin-volver");
    if (btnAdminVolver) {
      btnAdminVolver.addEventListener("click", function () {
        cerrarVistaAdmin();
        mostrarPantalla("inicio");
      });
    }

    var adminGrid = document.getElementById("admin-grid");
    if (adminGrid) {
      adminGrid.addEventListener("click", function (ev) {
        var card = ev.target.closest(".admin-card[data-admin-vista]");
        if (!card) return;
        abrirVistaAdmin(card.dataset.adminVista);
      });
    }

    var btnBorrar = document.getElementById("btn-borrar-todo");
    if (btnBorrar) btnBorrar.addEventListener("click", borrarTodoConfirmado);

    var btnSalir = document.getElementById("club-salir");
    if (btnSalir) btnSalir.addEventListener("click", salirDelClub);

    document.addEventListener("click", function (ev) {
      if (ev.target && ev.target.id === "admin-detalle-close") {
        cerrarVistaAdmin();
        return;
      }
      var tabBtn = ev.target.closest && ev.target.closest(".club-tab[data-club-tab]");
      if (tabBtn) mostrarClubTab(tabBtn.dataset.clubTab);
    });

    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") cerrarCandadoAdmin();
    });
  });
})();
