/* ============================================================
   persistencia.js — Panel antiborrado (sin backend)
   El progreso (resultados + eventos + terceros partidos
   generados) vive en localStorage vía js/estado.js. Este
   archivo solo pone la interfaz encima: descargar/leer el JSON.
   ============================================================ */
(function () {
  "use strict";

  function descargarCopiaSeguridadLiga() {
    if (!window.Estado) return;
    var estado = window.Estado.exportarEstadoCrudo();
    var blob = new Blob([JSON.stringify(estado, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var fecha = new Date().toISOString().slice(0, 10);

    var a = document.createElement("a");
    a.href = url;
    a.download = "efootball-t7-backup-" + fecha + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function importarProgreso(file, onDone) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var obj = JSON.parse(reader.result);
        window.Estado.importarEstadoCrudo(obj);
        if (onDone) onDone(true);
      } catch (err) {
        console.error("[persistencia] JSON de importación inválido:", err);
        if (onDone) onDone(false, err);
      }
    };
    reader.onerror = function () { if (onDone) onDone(false, reader.error); };
    reader.readAsText(file);
  }

  // Resalta el botón de guardado tras confirmar un partido, en vez de
  // forzar una descarga automática (evita que el navegador bloquee
  // descargas repetidas y es mucho menos invasivo para el admin).
  function resaltarBotonGuardado() {
    var btn = document.getElementById("btn-exportar");
    if (!btn) return;
    btn.classList.add("btn-ghost--resaltado");
    setTimeout(function () { btn.classList.remove("btn-ghost--resaltado"); }, 6000);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var btnExportar = document.getElementById("btn-exportar");
    var btnImportar = document.getElementById("btn-importar");
    var inputImportar = document.getElementById("input-importar");

    if (btnExportar) {
      btnExportar.addEventListener("click", descargarCopiaSeguridadLiga);
    }
    if (btnImportar && inputImportar) {
      btnImportar.addEventListener("click", function () { inputImportar.click(); });
      inputImportar.addEventListener("change", function () {
        var file = inputImportar.files[0];
        if (!file) return;
        importarProgreso(file, function (ok) {
          if (ok) {
            alert("✅ Progreso importado correctamente. Recarga la página para verlo reflejado en todas las pantallas.");
          } else {
            alert("⚠️ El archivo elegido no es una copia de seguridad válida.");
          }
          inputImportar.value = "";
        });
      });
    }
  });

  window.Persistencia = {
    descargarCopiaSeguridadLiga: descargarCopiaSeguridadLiga,
    importarProgreso: importarProgreso,
    resaltarBotonGuardado: resaltarBotonGuardado
  };
})();
