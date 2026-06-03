# Logos oficiales de competiciones (chips del hub)

Los PNG de esta carpeta alimentan los iconos de la caja COMPETICIONES
del hub (`#munich-comps-row` en `templates/partials/misc_body_1.html`).

Para activar un logo:
1. Coloca el PNG aquí (preferible fondo transparente, ~256x256).
2. Añade su entrada en `_CHIP_LOGO_FILES` (en misc_body_1.html,
   bloque "Logos oficiales de cada competición"), p.ej.
   `mundial:'mundialito.png'`.

ID de cada chip (clave de `_CHIP_LOGO_FILES`):

| id        | competición       |
|-----------|-------------------|
| liga      | Liga EA           |
| copa      | Copa Rey          |
| sup-esp   | Supercopa Esp.    |
| champ     | Champions         |
| prevch    | Previa Champ.     |
| uel       | Europa Lg.        |
| uecl      | Conference        |
| recopa    | Recopa            |
| sup-eur   | Supercopa Eur.    |
| inter     | Intercont.        |
| mundial   | Mundialito        |
| sel       | Selecciones       |
| torneo    | Torneo Verano     |
| amist     | Amistosos         |
| superliga | Superliga         |

Si un chip no tiene entrada (y el admin no subió override por
`comp_icons_v1`), se muestra su emoji por defecto.
