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
        // Importar SOBREESCRIBE de golpe TODO lo de este dispositivo
        // (calendarios, plantillas, resultados...) con lo que traiga el
        // archivo — sin avisar nunca de que el archivo podría ser VIEJO
        // (de hace días) y machacar algo más reciente. Con la app
        // sincronizando sola cada pocos segundos entre los 6 móviles,
        // esta vía manual (pensada para cuando no había servidor) ya casi
        // nunca hace falta — el aviso es la última red antes de un
        // "aceptar sin pensar" que puede deshacer ediciones recientes de
        // cualquiera de los 6 (aunque el servidor ya protege de que ese
        // archivo viejo se propague a los demás, ver app.py).
        var ok0 = window.confirm(
          "⚠️ Vas a IMPORTAR esta copia de seguridad: \"" + file.name + "\".\n\n" +
          "Esto SOBREESCRIBE todo lo de este dispositivo (calendarios, plantillas, resultados...) " +
          "con lo que traiga el archivo — si es de hace días, vas a volver este dispositivo hacia " +
          "atrás. Con la app ya sincronizando sola entre los 6 móviles, esto casi nunca hace falta.\n\n" +
          "¿Seguro que quieres continuar?"
        );
        if (!ok0) { inputImportar.value = ""; return; }
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
