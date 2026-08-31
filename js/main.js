/* ============================================================
   main.js — Orquestador de la app · Fase 4: navegación a
   pantalla completa (Inicio / Panel Admin / Club activo).

   3 pantallas mutuamente excluyentes (nunca 2 visibles a la vez):
     screen-inicio  -> las 6 cajas humanas + engranaje
     screen-admin   -> Calendar / Stadium Hub / Ball Storage /
                       Espacio del navegador / Borrar TODO,
                       detrás del candado 646
     screen-club    -> cabecera del mánager activo + tabs
                       Calendario / Plantilla + botón Salir

   El candado NO es seguridad real (comparación de string en
   claro) — es solo fricción para que ninguno de los 6 amigos
   pulse "Borrar TODO" sin querer, mismo criterio que los PIN de
   3 dígitos ya usados en otras herramientas de admin del proyecto.
   ============================================================ */
(function () {
  "use strict";

  // Contraseña ÚNICA de administrador — antes había 2 candados distintos
  // (747 para el Panel Admin, 646 para el resto: editor de club,
  // sancionados, quitar lesionados/sancionados...). Petición usuario:
  // unificar todos los candados de la web en uno solo (646).
  var ADMIN_PASSWORD = "646";

  // ---------- Gestor de pantallas ----------
  var PANTALLAS = ["inicio", "admin", "club"];
  function mostrarPantalla(nombre) {
    PANTALLAS.forEach(function (n) {
      var el = document.getElementById("screen-" + n);
      if (el) el.hidden = n !== nombre;
    });
  }

  // "#c8102e" -> "200, 16, 46" — para poder usar rgba(var(--x-rgb), N) en
  // CSS sin depender de color-mix() (no está en todos los móviles).
  function _hexToRgbParts(hex) {
    var h = String(hex || "").replace("#", "");
    if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join("");
    var num = parseInt(h, 16);
    if (isNaN(num) || h.length !== 6) return "57, 255, 106";
    return ((num >> 16) & 255) + ", " + ((num >> 8) & 255) + ", " + (num & 255);
  }

  // ---------- Pantalla 1: Inicio -> entrar a un club ----------
  function activarCaja(box) {
    document.querySelectorAll(".team-box").forEach(function (b) {
      b.classList.remove("team-box--active");
    });
    box.classList.add("team-box--active");
  }

  // ---------- Menú del club (columna izquierda, siempre visible) ----------
  // Las tarjetas (orden + etiqueta + icono) salen de Estado.obtenerMenuClub
  // — cada caja humana tiene la suya, editable detrás del candado 646
  // (ver abrirCandadoEditorClub más abajo). Plantilla abre datos reales;
  // el resto (de fábrica o añadidas por el admin) son subsistemas que este
  // simulador ligero todavía no implementa — se muestra un aviso honesto
  // en vez de inventar datos falsos.
  function abrirModalClub(vista) {
    var clubId = window._idManagerActivo;
    if (!clubId || !window.Estado) return;
    var tarjetas = window.Estado.obtenerMenuClub(clubId);
    var def = null;
    for (var i = 0; i < tarjetas.length; i++) {
      if (tarjetas[i].id === vista) { def = tarjetas[i]; break; }
    }
    var etiqueta = def ? (def.icono + " " + def.etiqueta) : vista;

    var ov = document.getElementById("club-modal-overlay");
    var titulo = document.getElementById("club-modal-title");
    var body = document.getElementById("club-modal-body");
    if (!ov || !titulo || !body || !window.Renderizadores) return;

    titulo.textContent = etiqueta;
    ov.hidden = false;

    if (vista === "plantilla") {
      body.innerHTML = '<div id="plantilla-content"></div>';
      window.Renderizadores.renderizarPlantillaClub(clubId);
    } else if (vista === "liga1ref") {
      body.innerHTML = '<div id="liga1ref-content"></div>';
      window.Renderizadores.renderizarLiga1RefClasificacion("liga1ref-content", clubId);
    } else if (vista === "copadelrey") {
      body.innerHTML = '<div id="copa-content"></div>';
      window.Renderizadores.renderizarCopaDelRey("copa-content", clubId);
    } else if (vista === "superliga") {
      body.innerHTML = '<div id="superliga-content"></div>';
      window.Renderizadores.renderizarSuperliga("superliga-content", clubId);
    } else if (vista === "titulos") {
      body.innerHTML = '<div id="titulos-content"></div>';
      window.Renderizadores.renderizarTitulos("titulos-content", clubId);
    } else {
      body.innerHTML = '<div id="club-modal-vista"></div>';
      window.Renderizadores.renderizarProximamente("club-modal-vista", etiqueta);
    }
  }

  function cerrarModalClub() {
    var ov = document.getElementById("club-modal-overlay");
    if (ov) ov.hidden = true;
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

        // Tema de color del club — cada caja se ve con SUS colores (menú +
        // calendario), leídos directamente de data/equipos.json. Se fija
        // en la pantalla entera para que TODO lo de dentro (menú, cards
        // de partido) herede la misma pareja de colores sin recalcularla.
        var pantalla = document.getElementById("screen-club");
        if (pantalla) {
          var primario = equipo.colorPrimario || "#39ff6a";
          pantalla.style.setProperty("--club-primary", primario);
          pantalla.style.setProperty("--club-secondary", equipo.colorSecundario || "#101114");
          pantalla.style.setProperty("--club-primary-rgb", _hexToRgbParts(primario));
        }
      });

      if (typeof window.Renderizadores.generarCalendarioLateralDerecho === "function") {
        window.Renderizadores.generarCalendarioLateralDerecho(teamId);
      }
      if (typeof window.Renderizadores.renderizarMenuClub === "function") {
        window.Renderizadores.renderizarMenuClub(teamId, "club-menu");
      }
    }

    cerrarModalClub();
    mostrarPantalla("club");
  }

  // ---------- Editor del menú del club (candado 646) ----------
  function abrirEditorClub(clubId) {
    var ov = document.getElementById("club-modal-overlay");
    var titulo = document.getElementById("club-modal-title");
    var body = document.getElementById("club-modal-body");
    if (!ov || !titulo || !body || !window.Renderizadores) return;

    titulo.textContent = "✏️ Editar menú";
    body.innerHTML =
      '<div class="editor-club-tabs">' +
      '<button type="button" class="editor-club-tab is-active" data-accion="editor-club-tab" data-tab="menu" data-club-id="' + clubId + '">📋 Menú</button>' +
      '<button type="button" class="editor-club-tab" data-accion="editor-club-tab" data-tab="calendario" data-club-id="' + clubId + '">🗓️ Calendario extra</button>' +
      '<button type="button" class="editor-club-tab" data-accion="editor-club-tab" data-tab="plantilla" data-club-id="' + clubId + '">👕 Plantilla</button>' +
      "</div>" +
      '<div id="editor-club-contenido"></div>';
    ov.hidden = false;
    window.Renderizadores.pintarEditorMenuClub(clubId, document.getElementById("editor-club-contenido"));
  }

  function cambiarTabEditorClub(clubId, tab, btnEl) {
    var tabs = document.querySelectorAll(".editor-club-tab");
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove("is-active");
    if (btnEl) btnEl.classList.add("is-active");

    var contenido = document.getElementById("editor-club-contenido");
    if (!contenido || !window.Renderizadores) return;
    if (tab === "calendario") window.Renderizadores.pintarEditorCalendarioExtraClub(clubId, contenido);
    else if (tab === "plantilla") window.Renderizadores.pintarEditorPlantillaClub(clubId, contenido);
    else window.Renderizadores.pintarEditorMenuClub(clubId, contenido);
  }

  // Re-pinta el editor de tarjetas Y el menú real de la izquierda tras
  // añadir/mover/borrar — el admin ve el cambio reflejado al instante en
  // ambos sitios sin cerrar el modal.
  function repintarMenuClub(clubId) {
    var contenido = document.getElementById("editor-club-contenido");
    if (contenido && window.Renderizadores) window.Renderizadores.pintarEditorMenuClub(clubId, contenido);
    if (window.Renderizadores) window.Renderizadores.renderizarMenuClub(clubId, "club-menu");
  }

  function anadirTarjetaMenuClubPrompt(clubId) {
    if (!window.Estado) return;
    var etiqueta = window.prompt("Nombre de la nueva competición:");
    if (etiqueta === null || !etiqueta.trim()) return;
    var icono = window.prompt("Icono/emoji (opcional):", "⭐");
    if (icono === null) icono = "⭐";
    window.Estado.anadirTarjetaMenuClub(clubId, icono, etiqueta);
    repintarMenuClub(clubId);
  }
  function moverTarjetaMenuClub(clubId, id, direccion) {
    if (!window.Estado) return;
    window.Estado.moverTarjetaMenuClub(clubId, id, Number(direccion));
    repintarMenuClub(clubId);
  }
  function editarTarjetaMenuClubPrompt(clubId, id, iconoActual, etiquetaActual) {
    if (!window.Estado) return;
    var etiqueta = window.prompt("Nombre de la competición:", etiquetaActual);
    if (etiqueta === null || !etiqueta.trim()) return;
    var icono = window.prompt("Icono/emoji:", iconoActual);
    if (icono === null) icono = iconoActual;
    window.Estado.editarTarjetaMenuClub(clubId, id, icono, etiqueta);
    repintarMenuClub(clubId);
  }
  function restablecerTarjetaMenuClubPrompt(clubId, id, nombre) {
    if (!window.Estado) return;
    if (!window.confirm('¿Restablecer "' + nombre + '" a su nombre e icono de fábrica?')) return;
    window.Estado.restablecerTarjetaMenuClub(clubId, id);
    repintarMenuClub(clubId);
  }
  function borrarTarjetaMenuClubPrompt(clubId, id, nombre) {
    if (!window.Estado) return;
    if (!window.confirm('¿Borrar la tarjeta "' + nombre + '" del menú?')) return;
    window.Estado.borrarTarjetaMenuClub(clubId, id);
    repintarMenuClub(clubId);
  }

  // ---------- Calendario EXTRA del club (candado 646) ----------
  function guardarCalendarioExtraClub(clubId) {
    var ta = document.getElementById("calendario-extra-club-textarea");
    if (!ta || !window.Estado) return;
    window.Estado.guardarCalendarioExtraTexto(clubId, ta.value);
    cerrarModalClub();
    if (window.Renderizadores) window.Renderizadores.generarCalendarioLateralDerecho(clubId);
  }
  function cancelarCalendarioExtraClub() {
    cerrarModalClub();
  }

  // ---------- Plantilla (roster real) del club (candado 646) ----------
  function guardarPlantillaClub(clubId) {
    var ta = document.getElementById("plantilla-club-textarea");
    if (!ta || !window.Estado) return;
    window.Estado.guardarRosterTexto(clubId, ta.value);
    cerrarModalClub();
  }
  function cancelarPlantillaClub() {
    cerrarModalClub();
  }

  // ---------- Liga 1ª REF — clasificación única (edición INLINE, PIN 646) ----------
  // A diferencia del resto de editores del candado 646 (que viven en el
  // "✏️ Editar menú" aparte), este se abre desde un ✏️ pequeño DENTRO de
  // la propia pantalla de clasificación — Guardar/Cancelar vuelven a la
  // tabla en el MISMO contenedor, sin cerrar el modal.
  function editarLiga1RefInline(clubId) {
    if (!window.Renderizadores) return;
    abrirCandado(ADMIN_PASSWORD, function () {
      var cont = document.getElementById("liga1ref-content");
      if (cont) window.Renderizadores.pintarEditorLiga1Ref(cont, clubId);
    }, "🔒 Editar clasificación", "PIN de administrador (646)");
  }
  function guardarLiga1Ref(clubId) {
    var ta = document.getElementById("liga1ref-textarea");
    if (!ta || !window.Estado || !window.Renderizadores) return;
    window.Estado.guardarLiga1RefTexto(ta.value);
    window.Renderizadores.renderizarLiga1RefClasificacion("liga1ref-content", clubId);
  }
  function cancelarLiga1Ref(clubId) {
    if (window.Renderizadores) window.Renderizadores.renderizarLiga1RefClasificacion("liga1ref-content", clubId);
  }

  // ---------- Liga 1ª REF — Pichichi/MVP/Tarjetas/Zamora (mismo contenedor) ----------
  function verLiga1RefStat(clubId, categoria) {
    if (window.Renderizadores) window.Renderizadores.renderizarLiga1RefStatDetalle("liga1ref-content", clubId, categoria);
  }
  function volverLiga1Ref(clubId) {
    if (window.Renderizadores) window.Renderizadores.renderizarLiga1RefClasificacion("liga1ref-content", clubId);
  }
  function editarLiga1RefStatInline(clubId, categoria) {
    if (!window.Renderizadores) return;
    abrirCandado(ADMIN_PASSWORD, function () {
      var cont = document.getElementById("liga1ref-content");
      if (cont) window.Renderizadores.pintarEditorLiga1RefStat(cont, clubId, categoria);
    }, "🔒 Editar estadística", "PIN de administrador (646)");
  }
  function guardarLiga1RefStat(clubId, categoria) {
    var ta = document.getElementById("liga1ref-stat-textarea");
    if (!ta || !window.Estado || !window.Renderizadores) return;
    window.Estado.guardarLiga1RefStatTexto(categoria, ta.value);
    window.Renderizadores.renderizarLiga1RefStatDetalle("liga1ref-content", clubId, categoria);
  }
  function cancelarLiga1RefStat(clubId, categoria) {
    if (window.Renderizadores) window.Renderizadores.renderizarLiga1RefStatDetalle("liga1ref-content", clubId, categoria);
  }

  // ---------- Copa del Rey — estado del cuadro + Pichichi/MVP/Amarillas/Rojas ----------
  // Sin editor de "clasificación" (no es una liguilla, no hay tabla que
  // pegar) — solo las 4 cajas de estadísticas tienen PIN, mismo patrón
  // EXACTO que Liga 1ª REF, reutilizando el mismo contenedor "copa-content".
  function verCopaStat(clubId, categoria) {
    if (window.Renderizadores) window.Renderizadores.renderizarCopaStatDetalle("copa-content", clubId, categoria);
  }
  function volverCopa(clubId) {
    if (window.Renderizadores) window.Renderizadores.renderizarCopaDelRey("copa-content", clubId);
  }
  function editarCopaStatInline(clubId, categoria) {
    if (!window.Renderizadores) return;
    abrirCandado(ADMIN_PASSWORD, function () {
      var cont = document.getElementById("copa-content");
      if (cont) window.Renderizadores.pintarEditorCopaStat(cont, clubId, categoria);
    }, "🔒 Editar estadística", "PIN de administrador (646)");
  }
  function guardarCopaStat(clubId, categoria) {
    var ta = document.getElementById("copa-stat-textarea");
    if (!ta || !window.Estado || !window.Renderizadores) return;
    window.Estado.guardarCopaStatTexto(categoria, ta.value);
    window.Renderizadores.renderizarCopaStatDetalle("copa-content", clubId, categoria);
  }
  function cancelarCopaStat(clubId, categoria) {
    if (window.Renderizadores) window.Renderizadores.renderizarCopaStatDetalle("copa-content", clubId, categoria);
  }

  // ---------- Superliga — clasificación + Pichichi/MVP/Amarillas/Rojas/
  // Zamora (mismo contenedor "superliga-content"). Sin editor/PIN: es
  // 100% humano-vs-humano, se auto-calcula todo (0 texto que pegar).
  function verSuperligaStat(clubId, categoria) {
    if (window.Renderizadores) window.Renderizadores.renderizarSuperligaStatDetalle("superliga-content", clubId, categoria);
  }
  function volverSuperliga(clubId) {
    if (window.Renderizadores) window.Renderizadores.renderizarSuperliga("superliga-content", clubId);
  }

  // ---------- Sala de Títulos ----------
  // Sin PIN (petición usuario): el catálogo de trofeos es CERRADO y el
  // editor viene pre-relleno con los 33 — el admin solo cambia números,
  // no puede teclear ni inventar un trofeo nuevo, así que no hace falta
  // la misma protección que el resto de editores de texto libre.
  function editarTitulosInline(clubId) {
    if (!window.Renderizadores) return;
    var cont = document.getElementById("titulos-content");
    if (cont) window.Renderizadores.pintarEditorTitulos(cont, clubId);
  }
  function guardarTitulos(clubId) {
    var ta = document.getElementById("titulos-textarea");
    if (!ta || !window.Estado || !window.Renderizadores) return;
    window.Estado.guardarTitulosTexto(clubId, ta.value);
    window.Renderizadores.renderizarTitulos("titulos-content", clubId);
  }
  function cancelarTitulos(clubId) {
    if (window.Renderizadores) window.Renderizadores.renderizarTitulos("titulos-content", clubId);
  }

  function salirDelClub() {
    window._idManagerActivo = null;
    document.querySelectorAll(".team-box").forEach(function (b) {
      b.classList.remove("team-box--active");
    });
    cerrarModalClub();
    mostrarPantalla("inicio");
  }

  // ---------- Candado genérico (contraseña única 646) ----------
  // Un ÚNICO overlay reutilizado por TODOS los candados del proyecto
  // (Panel Admin, editor de cada caja humana, sancionar, quitar
  // lesionados/sancionados...): guarda qué password se espera y qué
  // hacer al acertarla.
  var _candadoEsperado = null;
  var _candadoOnOk = null;

  function abrirCandado(passwordEsperada, onOk, titulo, subtitulo) {
    var ov = document.getElementById("admin-password-overlay");
    var input = document.getElementById("password-input");
    var error = document.getElementById("password-error");
    var tituloEl = document.getElementById("password-title");
    var subEl = document.getElementById("password-sub");
    _candadoEsperado = passwordEsperada;
    _candadoOnOk = onOk;
    if (tituloEl && titulo) tituloEl.textContent = titulo;
    if (subEl && subtitulo) subEl.textContent = subtitulo;
    if (error) error.hidden = true;
    if (input) input.value = "";
    if (ov) ov.hidden = false;
    if (input) input.focus();
  }

  function cerrarCandado() {
    var ov = document.getElementById("admin-password-overlay");
    var input = document.getElementById("password-input");
    var error = document.getElementById("password-error");
    if (ov) ov.hidden = true;
    if (input) input.value = "";
    if (error) error.hidden = true;
    _candadoEsperado = null;
    _candadoOnOk = null;
  }

  function comprobarCandado() {
    var input = document.getElementById("password-input");
    var error = document.getElementById("password-error");
    if (!input) return;
    if (input.value === _candadoEsperado) {
      var onOk = _candadoOnOk;
      cerrarCandado();
      if (onOk) onOk();
    } else {
      if (error) error.hidden = false;
      input.value = "";
      input.focus();
    }
  }

  function abrirCandadoAdmin() {
    abrirCandado(ADMIN_PASSWORD, function () { mostrarPantalla("admin"); },
      "🔒 Panel Admin", "Introduce la contraseña para continuar.");
  }

  function abrirCandadoEditorClub() {
    var clubId = window._idManagerActivo;
    if (!clubId) return;
    abrirCandado(ADMIN_PASSWORD, function () { abrirEditorClub(clubId); },
      "🔒 Editar menú del club", "Introduce la contraseña para editar este club.");
  }

  // Reutilizable desde CUALQUIER otro módulo (renderizadores.js: Sancionados
  // solo-admin, quitar Lesionados/Sancionados solo-admin) — mismo overlay/
  // candado de siempre (646), 0 KB nuevos, solo un punto de entrada público.
  function pedirPinAdmin(onOk, titulo, subtitulo) {
    abrirCandado(ADMIN_PASSWORD, onOk,
      titulo || "🔒 Acción de administrador",
      subtitulo || "Introduce la contraseña de administrador para continuar.");
  }
  window.Main = { pedirPinAdmin: pedirPinAdmin };

  // ---------- Pantalla 2: Panel Admin ----------
  var ADMIN_VISTAS = {
    calendario: {
      titulo: "🗓️ Calendario de competiciones",
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

  var _adminVistaActual = null;

  function abrirVistaAdmin(vista) {
    var detalle = document.getElementById("admin-detalle");
    var def = ADMIN_VISTAS[vista];
    if (!detalle || !def || !window.Renderizadores) return;

    _adminVistaActual = vista;
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

  // Re-pinta la vista admin abierta (Stadium Hub / Ball Storage) tras
  // añadir/editar/borrar — mismo id de contenedor, sin cerrar el panel.
  function repintarVistaAdminActual() {
    var def = _adminVistaActual && ADMIN_VISTAS[_adminVistaActual];
    if (def) def.render("admin-detalle-contenido");
  }

  // ---------- Stadium Hub / Ball Storage editables ----------
  // window.prompt() por simplicidad (coherente con el resto de acciones
  // de admin de esta app, que ya usan confirm()/prompt() nativos en vez
  // de formularios propios) — sin él no hace falta CSS/JS extra para un
  // modal de edición de 2-3 campos.
  function anadirEstadioPrompt() {
    if (!window.Estado) return;
    var nombre = window.prompt("Nombre del estadio:");
    if (nombre === null || !nombre.trim()) return;
    var capacidad = window.prompt("Aforo (nº de espectadores):", "40000");
    if (capacidad === null) return;
    var cats = window.Estado.CATEGORIAS_ESTADIO || [];
    var categoria = window.prompt("Categoría (" + cats.join(" / ") + "):", cats[0] || "");
    if (categoria === null) categoria = cats[0] || "";
    window.Estado.anadirEstadio(nombre, capacidad, categoria);
    repintarVistaAdminActual();
  }
  function editarEstadioPrompt(id, nombreActual, capacidadActual, categoriaActual) {
    if (!window.Estado) return;
    var nombre = window.prompt("Nombre del estadio:", nombreActual);
    if (nombre === null || !nombre.trim()) return;
    var capacidad = window.prompt("Aforo:", String(capacidadActual));
    if (capacidad === null) return;
    var categoria = window.prompt("Categoría:", categoriaActual);
    if (categoria === null) categoria = categoriaActual;
    window.Estado.editarEstadio(id, nombre, capacidad, categoria);
    repintarVistaAdminActual();
  }
  function borrarEstadioPrompt(id, nombre) {
    if (!window.Estado) return;
    if (!window.confirm('¿Borrar el estadio "' + nombre + '"?')) return;
    window.Estado.borrarEstadio(id);
    repintarVistaAdminActual();
  }
  function anadirBalonPrompt() {
    if (!window.Estado) return;
    var nombre = window.prompt("Nombre del balón:");
    if (nombre === null || !nombre.trim()) return;
    window.Estado.anadirBalon(nombre);
    repintarVistaAdminActual();
  }
  function editarBalonPrompt(id, nombreActual) {
    if (!window.Estado) return;
    var nombre = window.prompt("Nombre del balón:", nombreActual);
    if (nombre === null || !nombre.trim()) return;
    window.Estado.editarBalon(id, nombre);
    repintarVistaAdminActual();
  }
  function borrarBalonPrompt(id, nombre) {
    if (!window.Estado) return;
    if (!window.confirm('¿Borrar el balón "' + nombre + '"?')) return;
    window.Estado.borrarBalon(id);
    repintarVistaAdminActual();
  }

  // ---------- Calendario de competiciones (roadmap editable) ----------
  // Toggle in-place entre el roadmap de lectura y un textarea de edición,
  // dentro del MISMO contenedor "admin-detalle-contenido" — sin volver a
  // pedir datos (data/*.json), esto es puro texto en localStorage.
  function abrirEditorCalendarioComp() {
    var contenedor = document.getElementById("admin-detalle-contenido");
    if (!contenedor || !window.Renderizadores) return;
    window.Renderizadores.pintarEditorCalendario(contenedor);
    var ta = document.getElementById("calendario-comp-textarea");
    if (ta) ta.focus();
  }
  function cancelarEditorCalendarioComp() {
    var contenedor = document.getElementById("admin-detalle-contenido");
    if (!contenedor || !window.Renderizadores) return;
    window.Renderizadores.pintarRoadmapCalendario(contenedor);
  }
  function guardarCalendarioComp() {
    var ta = document.getElementById("calendario-comp-textarea");
    var contenedor = document.getElementById("admin-detalle-contenido");
    if (!ta || !contenedor || !window.Estado || !window.Renderizadores) return;
    window.Estado.guardarCalendarioTexto(ta.value);
    window.Renderizadores.pintarRoadmapCalendario(contenedor);
  }

  function cerrarVistaAdmin() {
    _adminVistaActual = null;
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

  // ---------- Temporada editable (arriba del Inicio) ----------
  function editarTemporada() {
    if (!window.Estado) return;
    var actual = window.Estado.obtenerTemporada();
    var nueva = window.prompt("Nombre de la temporada:", actual);
    if (nueva === null) return; // cancelado
    if (!nueva.trim()) return;
    window.Estado.guardarTemporada(nueva);
    if (window.Renderizadores) window.Renderizadores.pintarTemporada();
  }

  // ---------- Nombre de la liga — editable pulsando el propio badge ----------
  // Cada club humano tiene SU PROPIA liga (nombre distinto por club, ver
  // js/estado.js::obtenerNombreLiga/guardarNombreLiga) — al ascender o
  // descender de división, o cuando un club juega su liga real (p.ej. el
  // PSG en la Ligue 1), cada caja necesita su propio nombre, no uno
  // compartido por los 6. Se pulsa directamente el badge del calendario
  // (ya no hay lápiz aparte al lado).
  function editarNombreLiga() {
    var clubId = window._idManagerActivo;
    if (!clubId || !window.Estado) return;
    var actual = window.Estado.obtenerNombreLiga(clubId);
    var nueva = window.prompt("Nombre de la liga de este club:", actual);
    if (nueva === null) return; // cancelado
    if (!nueva.trim()) return;
    window.Estado.guardarNombreLiga(clubId, nueva);
    var badge = document.getElementById("calendar-liga-badge");
    if (badge) badge.textContent = nueva.trim();
  }

  // ---------- Reiniciar TODOS los partidos del club activo (solo admin) ----------
  // Botón "🔄 Reiniciar" de la cabecera del calendario — vuelve a "sin
  // jugar" cada partido ya jugado de la caja abierta (Liga + Copa +
  // cualquier otra competición en paralelo), conservando el resto del
  // calendario (rivales, fechas, competiciones) intacto. Gateado por PIN
  // + confirmación explícita: es destructivo y afecta a todos los
  // partidos jugados del club, no a uno solo (ver el marcador-botón de
  // cada partido para reiniciarlos de uno en uno).
  function reiniciarTodosPartidosClub() {
    var clubId = window._idManagerActivo;
    if (!clubId || !window.Renderizadores) return;
    pedirPinAdmin(function () {
      var ok = window.confirm(
        "⚠️ Esto reinicia a CERO todos los partidos ya jugados de este club (Liga, Copa y cualquier otra competición en curso).\n\n" +
        "El calendario en sí (rivales, fechas, competiciones) NO se toca — solo se borran los resultados. Esta acción NO se puede deshacer.\n\n" +
        "¿Seguro que quieres continuar?"
      );
      if (!ok) return;
      var n = window.Renderizadores.reiniciarTodosPartidosClub(clubId);
      alert(n ? "✅ " + n + " partido(s) reiniciado(s)." : "No había ningún partido jugado que reiniciar.");
    }, "🔒 Reiniciar partidos del club", "Solo el administrador puede reiniciar todos los partidos jugados.");
  }

  // ---------- Wiring ----------
  document.addEventListener("DOMContentLoaded", function () {
    if (window.Renderizadores) {
      window.Renderizadores.renderizarInicioEquipos();
      window.Renderizadores.pintarTemporada();
    }

    var btnTemporada = document.getElementById("btn-editar-temporada");
    if (btnTemporada) btnTemporada.addEventListener("click", editarTemporada);

    var btnLigaNombre = document.getElementById("calendar-liga-badge");
    if (btnLigaNombre) btnLigaNombre.addEventListener("click", editarNombreLiga);

    var btnResetPartidos = document.getElementById("calendar-reset-btn");
    if (btnResetPartidos) btnResetPartidos.addEventListener("click", reiniciarTodosPartidosClub);

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

    var btnEditarClub = document.getElementById("btn-editar-club-menu");
    if (btnEditarClub) btnEditarClub.addEventListener("click", abrirCandadoEditorClub);

    var btnPassSubmit = document.getElementById("password-submit");
    if (btnPassSubmit) btnPassSubmit.addEventListener("click", comprobarCandado);

    var inputPass = document.getElementById("password-input");
    if (inputPass) {
      inputPass.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") comprobarCandado();
      });
    }

    var btnPassClose = document.getElementById("password-close");
    if (btnPassClose) btnPassClose.addEventListener("click", cerrarCandado);

    var ovPass = document.getElementById("admin-password-overlay");
    if (ovPass) {
      ovPass.addEventListener("click", function (ev) {
        if (ev.target === ovPass) cerrarCandado();
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

    var clubMenu = document.getElementById("club-menu");
    if (clubMenu) {
      clubMenu.addEventListener("click", function (ev) {
        var btn = ev.target.closest(".club-menu-btn[data-club-vista]");
        if (!btn) return;
        abrirModalClub(btn.dataset.clubVista);
      });
    }

    var btnModalClose = document.getElementById("club-modal-close");
    if (btnModalClose) btnModalClose.addEventListener("click", cerrarModalClub);

    var modalOv = document.getElementById("club-modal-overlay");
    if (modalOv) {
      modalOv.addEventListener("click", function (ev) {
        if (ev.target === modalOv) cerrarModalClub();
      });
    }

    document.addEventListener("click", function (ev) {
      if (ev.target && ev.target.id === "admin-detalle-close") {
        cerrarVistaAdmin();
        return;
      }

      // Stadium Hub / Ball Storage editables — delegado ÚNICO y estable
      // (document), así el re-pintado tras cada acción nunca acumula
      // listeners sobre el contenedor que se regenera en cada render.
      var accionBtn = ev.target.closest && ev.target.closest("[data-accion]");
      if (!accionBtn) return;
      var d = accionBtn.dataset;
      switch (d.accion) {
        case "anadir-estadio": anadirEstadioPrompt(); break;
        case "editar-estadio": editarEstadioPrompt(d.id, d.nombre, d.capacidad, d.categoria); break;
        case "borrar-estadio": borrarEstadioPrompt(d.id, d.nombre); break;
        case "anadir-balon": anadirBalonPrompt(); break;
        case "editar-balon": editarBalonPrompt(d.id, d.nombre); break;
        case "borrar-balon": borrarBalonPrompt(d.id, d.nombre); break;
        case "editar-calendario-comp": abrirEditorCalendarioComp(); break;
        case "cancelar-calendario-comp": cancelarEditorCalendarioComp(); break;
        case "guardar-calendario-comp": guardarCalendarioComp(); break;
        case "editor-club-tab": cambiarTabEditorClub(d.clubId, d.tab, accionBtn); break;
        case "anadir-tarjeta-menu-club": anadirTarjetaMenuClubPrompt(d.clubId); break;
        case "mover-tarjeta-menu-club": moverTarjetaMenuClub(d.clubId, d.id, d.direccion); break;
        case "editar-tarjeta-menu-club": editarTarjetaMenuClubPrompt(d.clubId, d.id, d.icono, d.etiqueta); break;
        case "restablecer-tarjeta-menu-club": restablecerTarjetaMenuClubPrompt(d.clubId, d.id, d.nombre); break;
        case "borrar-tarjeta-menu-club": borrarTarjetaMenuClubPrompt(d.clubId, d.id, d.nombre); break;
        case "guardar-calendario-extra-club": guardarCalendarioExtraClub(d.clubId); break;
        case "cancelar-calendario-extra-club": cancelarCalendarioExtraClub(); break;
        case "guardar-plantilla-club": guardarPlantillaClub(d.clubId); break;
        case "cancelar-plantilla-club": cancelarPlantillaClub(); break;
        case "editar-liga1ref-inline": editarLiga1RefInline(d.clubId); break;
        case "guardar-liga1ref": guardarLiga1Ref(d.clubId); break;
        case "cancelar-liga1ref": cancelarLiga1Ref(d.clubId); break;
        case "ver-liga1ref-stat": verLiga1RefStat(d.clubId, d.categoria); break;
        case "volver-liga1ref": volverLiga1Ref(d.clubId); break;
        case "editar-liga1ref-stat-inline": editarLiga1RefStatInline(d.clubId, d.categoria); break;
        case "guardar-liga1ref-stat": guardarLiga1RefStat(d.clubId, d.categoria); break;
        case "cancelar-liga1ref-stat": cancelarLiga1RefStat(d.clubId, d.categoria); break;
        case "ver-copa-stat": verCopaStat(d.clubId, d.categoria); break;
        case "volver-copa": volverCopa(d.clubId); break;
        case "editar-copa-stat-inline": editarCopaStatInline(d.clubId, d.categoria); break;
        case "guardar-copa-stat": guardarCopaStat(d.clubId, d.categoria); break;
        case "cancelar-copa-stat": cancelarCopaStat(d.clubId, d.categoria); break;
        case "ver-superliga-stat": verSuperligaStat(d.clubId, d.categoria); break;
        case "volver-superliga": volverSuperliga(d.clubId); break;
        case "editar-titulos-inline": editarTitulosInline(d.clubId); break;
        case "guardar-titulos": guardarTitulos(d.clubId); break;
        case "cancelar-titulos": cancelarTitulos(d.clubId); break;
      }
    });

    document.addEventListener("keydown", function (ev) {
      if (ev.key !== "Escape") return;
      cerrarCandado();
      cerrarModalClub();
    });

    // js/sync.js avisa con este evento cuando trae datos NUEVOS de otro
    // dispositivo (calendario extra, iconos del menú...) mientras el
    // usuario tenía la app abierta. Refresca lo que esté visible ahora
    // mismo — sin esto, el cambio solo se vería al recargar la página.
    document.addEventListener("ef7-sync-actualizado", function () {
      var screenClub = document.getElementById("screen-club");
      if (screenClub && !screenClub.hidden && window._idManagerActivo && window.Renderizadores) {
        window.Renderizadores.generarCalendarioLateralDerecho(window._idManagerActivo);
        window.Renderizadores.renderizarMenuClub(window._idManagerActivo, "club-menu");
      }
    });
  });
})();
