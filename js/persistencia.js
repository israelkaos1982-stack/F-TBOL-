/* ============================================================
   persistencia.js — Panel antiborrado (sin backend)
   FASE 1: los botones #btn-exportar / #btn-importar ya existen
   en el nav (index.html) pero están `disabled` — sin lógica
   todavía.
   FASE 2 (pendiente):
     - Exportar: serializar el estado de progreso a JSON y
       forzar la descarga con un <a download> generado en
       runtime (Blob + URL.createObjectURL) — 100% nativo del
       navegador, sin backend.
     - Importar: leer el archivo elegido en #input-importar con
       FileReader, parsear el JSON y restaurar el estado al
       instante.
   ============================================================ */
(function () {
  "use strict";
  // Intencionalmente vacío en Fase 1.
})();
