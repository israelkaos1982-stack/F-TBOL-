# CLAUDE.md — Reglas obligatorias del proyecto F-TBOL

## Inter/Portugal (ex-mister Rubén, retirado 2026-08-02) seguían tratándose como humanos — lesiones colgadas, previa a 10 MIN (HvH), escudo pisado por el hub humano (obligatorio, 2026-08-03)

**Bug (3 fotos usuario 2026-08-03, «Atlético Madrid vs Inter», Trofeo
Joan Gamper Jornada 4)**: pese a que el 2026-08-02 se retiró a Rubén
(7º mister, club Inter + selección Portugal) de `MISTERS_HUMANOS`, el
usuario seguía viendo: (1) la PANTALLA DE PREVIA mostraba
**«DURACIÓN 10 MIN»** — la etiqueta de partido **HvH** (Humano vs
Humano), como si Inter siguiera siendo humano; (2) el overlay
**«AÑADIR LESIONADOS · EQUIPO HUMANO»** seguía listando a
**Nicolò Barella · Inter** con 5 partidos de baja; (3) el escudo real
del Inter (visible correctamente en la propia previa) "desaparece
para siempre" en otros puntos de la app. Petición explícita: "Inter y
Portugal han dejado de ser equipos humanos, son IA, no puede tener
lesionados, los partidos vs IA son a 8min... por favor todo esto hay
que limpiarlo".

### Causa raíz — el fix de 2026-08-02 quitó a Rubén del REGISTRO pero no de los DATOS ni de la maquinaria de hub

1. **`t.isHuman`/`t.humanEmoji` siguen ganando sobre el registro.**
   Docenas de detectores de humanidad del proyecto (`_psTeamIsHumanGeneric`,
   el escaneo de candidatos del Mundial, `_realPair`/`_slotIsH`, etc.)
   hacen "Pase 1: `if (t.isHuman) return true;`" **ANTES** de consultar
   `MISTERS_HUMANOS`/`_isHumanClubCanonico`. Quitar a Rubén del array no
   borra el flag ya persistido en los datos del equipo. Los fixups de
   2026-08-02 (`_fixupInterHumanoItaliaV1`, que solo miraba el slug
   `'italia'`; `_fixupUnhumanizeRubenTournamentsV1`, que solo limpiaba
   los `tour_<id>_v1` que YA estuvieran en `localStorage` en el instante
   exacto del boot — `if (!raw) return;`) corrían **UNA sola vez** y
   dependían de qué estuviera cacheado en ESE dispositivo en ESE
   instante. Un torneo/liga que se cargó DESPUÉS (async, otra pestaña,
   una copia del servidor más reciente con el flag stale) se quedaba con
   `isHuman:true` colado indefinidamente — de ahí que la Previa del
   Trofeo Joan Gamper (un torneo, no la liga 'italia') siguiera saliendo
   como HvH un día entero después del fix.
2. **La caja "Inter-Portugal-Rubén" seguía siendo un hub HUMANO
   completo.** La pantalla `s-internazionale` hacía
   `setActiveHub('ruben')` + `go('s-munich')` (reutilizando el hub
   genérico humano — plantilla, calendario, HUD, lesiones). Con Rubén
   fuera de `MISTERS_HUMANOS`, `setActiveHub('ruben')` no encontraba el
   id y **caía en silencio al hub por defecto** (Toñín/Liverpool) —
   la pantalla seguía existiendo y disparando TODA la maquinaria de "hub
   humano" bajo la etiqueta "Inter", en vez de simplemente no existir.
3. **Las lesiones/sanciones ya registradas mientras Rubén era humano
   nunca se purgaban.** Quitar a Rubén del registro no borra las
   entradas ya guardadas en `LESION_STORE`/`BAJA_STORE`/
   `SANCION_STORE.__global` (club, Inter) ni en `LESION_STORE_SEL`/
   `SANCION_STORE_SEL`/`YELLOW_STORE_SEL` (selección, Portugal) — esos
   stores se sincronizan con el servidor y sobreviven indefinidamente
   hasta que algo las borra explícitamente.

### Fix — sanitización EN CADA LECTURA (no un fixup de una sola vez) + purga de stores + hub desactivado

- **`_sanitizeLigaTeamNames`** (`misc_body_1.html`, el sanitizador
  universal que `loadData` ejecuta en CADA lectura de `ligaExt_<slug>`,
  cache-hit y fresh-parse): nueva Phase 1b que limpia `isHuman`/
  `humanEmoji` de cualquier equipo cuyo nombre normalizado matchee Inter
  (todas las grafías). `_SAN_VER` 2→3 para forzar que TODA liga ya
  sellada con la versión anterior vuelva a pasar por el sanitizador una
  vez más.
- **`_tourDehumanizeRetired(cfg)`** (nuevo, junto a `_tourLoadCachedSync`):
  mismo principio para `cfg.teams[]` de CUALQUIER torneo (Inter Y
  Portugal), llamado en los 3 puntos donde `_tourLoadCachedSync`/
  `_tourLoad` cachean/adoptan un cfg — cache-hit, fresh-parse local, y
  tras adoptar la copia del servidor.
- **`_hydrate()`** (IIFE de `selecciones_squad_v1`): Portugal se excluye
  explícitamente de `_SEL_HUMAN_ICONS` en cada hidratación, aunque el
  campo `icon` stale resucite por sync desde otro dispositivo.
- **`window._purgeRetiredHumanStores()`** (nuevo, `index.bundle.js`,
  junto a `_purgeSeleccionFromClubStores`): purga Inter de los 4 stores
  de club y Portugal de los 3 de selección, y re-persiste (local +
  servidor) si algo cambió. Se llama en el barrido diferido de boot, en
  los callbacks `.hydrate()` de lesiones/sanciones (club Y selección), y
  justo antes de `_refreshSancionInjList` (la función que pinta el
  overlay "AÑADIR LESIONADOS").
- **`s-internazionale`** ya NO redirige a ningún hub humano. Muestra un
  aviso explicando que Inter/Portugal son ahora IA normales, con
  indicación de dónde editarlos (Resto de Ligas · Italia / editor de
  Selecciones). Elimina de raíz la duración HvH y cualquier resolución
  de escudo vía la maquinaria de hub humano para este club.

### Reglas a respetar

1. **PROHIBIDO** que un fixup de "retirar humano" nuevo (o cualquier
   corrección de datos futura) se limite a un `localStorage.getItem`
   condicionado (`if(!raw) return`) que solo corrige lo YA cacheado en
   ESE dispositivo en el instante del boot. La corrección DEBE vivir
   dentro del CHOKEPOINT de lectura universal (`_sanitizeLigaTeamNames`
   para ligas, `_tourLoadCachedSync`/`_tourLoad` para torneos, `_hydrate`
   para selecciones) para que se aplique en CADA lectura, sin depender
   de timing ni de qué dispositivo/sesión corrió el fixup primero.
2. **PROHIBIDO** retirar un mister de `MISTERS_HUMANOS` sin auditar
   TAMBIÉN: (a) los stores de lesión/sanción de club Y selección
   (purgar las entradas de ese club/selección), (b) cualquier pantalla
   `s-<hub>` que reutilice el hub humano genérico vía `setActiveHub`
   (debe dejar de redirigir ahí), (c) el flag `isHuman`/`humanEmoji` en
   TODAS las fuentes donde ese equipo pueda aparecer (ligas, torneos,
   selecciones) — no solo la liga/torneo que motivó el reporte original.
3. **PROHIBIDO** que `setActiveHub(id)` caiga en silencio al hub por
   defecto (Toñín) cuando `id` ya no existe en `MISTERS_HUMANOS` SIN que
   el caller que disparó ese `id` (una pantalla `s-<hub>` obsoleta) deje
   de intentarlo. Un fallback silencioso + una pantalla que insiste en
   pedir un hub retirado = el usuario ve datos de OTRO mister bajo una
   etiqueta equivocada.
4. Si en el futuro se retira OTRO mister humano, este mismo patrón (3
   sanitizadores universales + purga de stores + desactivar su pantalla
   `s-<hub>`) es el checklist completo — no un fixup de boot aislado.

### Refuerzo (mismo día, 2026-08-03 #2) — `index.bundle.js` tiene SUS PROPIAS listas de "humanos", ajenas al chokepoint de `misc_body_1.html`

**Bug (2 fotos usuario, mismo día, "REPITO INTER Y PORTUGAL SON EQUIPOS
IA")**: pese al fix de arriba, un partido NUEVO (Real Madrid vs Inter,
Trofeo Joan Gamper Jornada 7) seguía mostrando **«DURACIÓN 10 MIN»**
(HvH) Y el overlay pre-partido de lesiones seguía dejando marcar
lesionado a **CUALQUIER** jugador del roster completo del Inter (25
jug.) igual que al del Real Madrid — como si ambos fueran humanos.

**Causa raíz — el fix anterior solo tocó `misc_body_1.html`; `index.bundle.js`
construye sus PROPIAS copias de "quién es humano" escaneando
`ligaExt_liga-ea-sports` DIRECTO, sin pasar por `_sanitizeLigaTeamNames`
ni por `MISTERS_HUMANOS`**: `refreshLigaEaShields` (`misc_body_1.html`,
alimenta `window._LIGA_HUMAN_FLAGS`, que `_hasHumanIcon`/`esHumano`
consultan) lee `localStorage.getItem('ligaExt_'+slug)` con un
`_eachTeam` que **nunca pasa por `loadData`** — inmune a la Phase 1b
añadida en el fix de arriba. Y, por separado, `index.bundle.js` tiene
**4 listas `HUMANOS`/`_EQUIPOS_HUMANOS`/`_mmHUMANOS`/`HUMANOS_FORM`**
(usadas por `_formaHumanTeamsInMatch` —la que pinta el overlay
"AÑADIR LESIONADOS DEL EQUIPO HUMANO" con AMBOS rosters—, `esHumano`,
y el generador de lesiones automáticas) que hacen, cada una por su
cuenta, `d.teams.filter(t=>t.isHuman)` sobre `ligaExt_liga-ea-sports`
— si una fila "Inter" quedó ahí con `isHuman:true` (posible residuo de
antes de que se moviera a Italia — sección "Mover equipos" — o
resucitada por la fusión de un dispositivo desactualizado), TODAS
estas listas seguían devolviendo "Inter" como humano, y `MISTERS_HUMANOS`/
`_isHumanClubCanonico` (que sí excluyen a Inter) nunca llegaban a
arbitrar porque estas rutas ni los consultan.

**Fix — filtro único `window._isRetiredHumanTeamName(name)`, aplicado en el PROPIO `index.bundle.js`**:

- `window._isRetiredHumanTeamName(name)` (nuevo, junto a
  `window.YELLOW_STORE`/`SANCION_STORE`, principio de `index.bundle.js`):
  lista hardcoded de clubes/selecciones retirados (Inter + grafías,
  Portugal). Se aplica dentro del `.filter(...)` de las 4 listas
  `HUMANOS`/`_EQUIPOS_HUMANOS`/`_mmHUMANOS`/`HUMANOS_FORM` — un
  `isHuman:true` stale en disco YA NO basta para que ninguna de ellas
  devuelva a Inter/Portugal.
- `refreshLigaEaShields` (`misc_body_1.html`): `_markHuman`/`_scan`
  (los dos puntos que pueblan `humanNames`/`humanShieldNames`/
  `window._LIGA_HUMAN_FLAGS`) ahora comprueban
  `_isRetiredHumanClubName(nm)` ANTES de tratar `t.isHuman` como
  válido — mismo principio, aplicado al escaneo que vive fuera de
  `loadData`.
- `_fixupInterHumanoItaliaV1` (`misc_body_1.html`) se generaliza a
  `_fixupInterHumanoSlug(slug, flagSuffix)` y ahora limpia **DOS**
  slugs — `'italia'` (ya cubierto) y **`'liga-ea-sports'`** (el
  origen real de una fila "Inter" residual) — cada uno con su propio
  flag de idempotencia, y llama a `refreshLigaEaShields()` tras
  corregir para que `_LIGA_HUMAN_FLAGS` se reconstruya al instante.

### Reglas a respetar (refuerzo)

5. **PROHIBIDO** asumir que arreglar la detección de humanidad en
   `misc_body_1.html` (chokepoints `loadData`/`_tourLoadCachedSync`/
   `_hydrate`) cubre TODO el proyecto. `index.bundle.js` tiene sus
   PROPIAS copias de "lista de humanos" (`HUMANOS`, `_EQUIPOS_HUMANOS`,
   `_mmHUMANOS`, `HUMANOS_FORM`, y cualquier otra que se añada) que
   escanean `ligaExt_liga-ea-sports` de forma independiente — toda
   nueva de este tipo DEBE filtrar con `window._isRetiredHumanTeamName`
   dentro de su propio `.filter(...)`, no basta con sanear la fuente
   en `misc_body_1.html`.
6. **PROHIBIDO** que `refreshLigaEaShields` (`_markHuman`/`_scan`)
   trate `t.isHuman` como autoritativo sin comprobar antes si ese
   nombre es un club retirado (`_isRetiredHumanClubName`). Es el ÚNICO
   punto que alimenta `window._LIGA_HUMAN_FLAGS`, consultado por
   `_hasHumanIcon`/`esHumano` en TODO el proyecto.
7. **PROHIBIDO** que un fixup de "limpiar isHuman de un club retirado"
   se limite a la liga donde el club vive HOY (`'italia'`). Debe cubrir
   TAMBIÉN la liga de ORIGEN de donde se movió (`'liga-ea-sports'` en
   este caso) — un movimiento de equipo no siempre deja esa liga
   origen limpia en TODOS los dispositivos/backups.
8. Toda lista `HUMANOS*` nueva que se añada a `index.bundle.js` en el
   futuro hereda `window._isRetiredHumanTeamName` automáticamente en
   cuanto copie el patrón `.filter(t=>t.isHuman && !window._isRetiredHumanTeamName(t.name))`
   — no reinventar el filtro con una lista local nueva.

### Refuerzo (mismo día, 2026-08-03 #3) — `standings()` seguía priorizando la fila STALE, `part2/misc_body_2.html` tiene SU PROPIA `HUMANOS`/`esHumano()`, y el alta de jugador EN VIVO podía escribir en la fila DUPLICADA equivocada

**Bug (4 fotos usuario, mismo día, "El inter es equipo IA no puede
tener el icono del dragon" + "Añadí a L.Enrique como nuevo jugador
del Inter en el partido de la foto 1 pero cuando voy a la plantilla
del Inter este nuevo jugador no sale en la misma")**: pese a los dos
refuerzos anteriores, la tabla de clasificación de **Italia/Serie A**
(«Resto de Ligas») seguía mostrando el icono 🐲 junto a «Inter». Y un
jugador nuevo (L. Enrique) añadido DURANTE un partido vía el overlay
"+ AÑADIR JUGADOR" del gm-modal — que anotó gol y fue MVP, así que
sí quedó registrado en el ACTA — no aparecía después en la pantalla
🖍 PLANTILLA del Inter.

### Causa raíz 1 — `standings()` prioriza la fila PROPIA (`t.isHuman`) sobre `_LIGA_HUMAN_FLAGS`, sin filtrar retirados

`standings(data)` (`misc_body_1.html`, la función que alimenta
`renderTable()` de CUALQUIER pantalla de Resto de Ligas, incluida
Italia) construye `hf` así: si la fila `t` trae su PROPIO
`isHuman`/`humanEmoji`, ese gana SIEMPRE sobre el mapa global
`_LIGA_HUMAN_FLAGS` (por diseño — un PSG añadido manualmente a
Superliga debe heredar su bandera humana de Liga Francesa incluso si
`_LIGA_HUMAN_FLAGS` aún no lo indexa). El problema: ese mismo
"gana la fila propia" hacía que un `t.isHuman:true` STALE en el
disco del Inter (que los 2 refuerzos anteriores limpian en
`_sanitizeLigaTeamNames`/`refreshLigaEaShields`, pero solo se aplican
en el momento de LEER/reconstruir el índice — una copia ya cacheada
en `map`/render antes de esa limpieza, o una liga que el saneador
aún no ha vuelto a tocar) siguiera ganando en `standings()`, sin que
ningún fix anterior lo interceptara aquí. Fix: nuevo guard
`_retiredClub` (vía `window._isRetiredHumanClubName`) que fuerza
`hf = {isHuman:false, humanEmoji:''}` ANTES de mirar `t.isHuman`,
para cualquier nombre retirado — gana sobre TODO lo demás.

### Causa raíz 1b — `buildExtraRowHtml` (filas "extra" de Liga EA Sports) tenía el MISMO hueco

`buildExtraRowHtml(team, pos)` (`misc_body_1.html`, usada por
`appendLigaEaExtras` para pintar equipos añadidos a mano a la
clasificación de Liga EA Sports que no viven en `LIGA_SCHEDULE`) leía
`team.isHuman && team.humanEmoji` DIRECTO, sin ningún filtro de
retirados — es EXACTAMENTE el punto que el historial de este mismo
archivo ya documentó como origen de "un Inter 🐲 de más, colado como
fila extra" (sección "`setLigaSchedule` arma un lock..." más abajo).
Mismo fix: guard `_isRetiredHumanClubName` antes de pintar el sufijo.

### Causa raíz 2 — `part2/misc_body_2.html` tiene SU PROPIA lista `HUMANOS`/`esHumano()`, una CUARTA copia independiente

El refuerzo #2 (arriba) cubrió las 4 listas `HUMANOS*` de
`index.bundle.js` y el índice `_LIGA_HUMAN_FLAGS` de
`misc_body_1.html` — pero **`part2/misc_body_2.html` tiene su PROPIA
variable `HUMANOS`**, poblada por `_refreshHumanosFromStorage()`
(`data.teams.filter(function(t){ return t.isHuman; })` escaneando
`ligaExt_liga-ea-sports` DIRECTO, sin ningún filtro), y **`esHumano(t)`
—la función que decide humanidad en TODO ese archivo, incluida la
duración HvH/HvIA (8 vs 10 min) de un partido— la consulta
directamente**. Es una CUARTA lista independiente de "quién es
humano", en un TERCER archivo, que ninguno de los 2 refuerzos
anteriores tocó — el bug "partido vs Inter sigue a 10 MIN" del turno 2
podía seguir reproduciéndose por ESTA vía aunque las otras 3 ya
estuvieran limpias.

**Fix**: `_refreshHumanosFromStorage` filtra con
`_isRetiredHumanoP2(t.name)` — un helper SELF-CONTAINED (lista local
`_RETIRED_HUMANOS_P2` + fallback a `window._isRetiredHumanTeamName` si
ya está disponible) porque esta función corre en BOOT SÍNCRONO,
**antes** de que `index.bundle.js` (cargado al final del `<body>`)
haya podido definir `window._isRetiredHumanTeamName` — no puede
depender ÚNICAMENTE de esa función global como haría un código que
corre más tarde.

### Causa raíz 3 — `_gmFindAndPersistPlayer` (alta de jugador EN VIVO) se detenía en el PRIMER hit, sin desambiguar duplicados

`window._gmFindAndPersistPlayer(teamName, player)` (`part2/misc_body_2.html`,
el motor tras "+ AÑADIR JUGADOR" del gm-modal — permite dar de alta un
jugador que NO está en la plantilla, DURANTE el partido) recorría
`localStorage` buscando el equipo por nombre y, en cuanto encontraba
la PRIMERA fila que coincidía, empujaba el jugador ahí y paraba. El
historial de este mismo archivo (sección "Refuerzo #2" de arriba)
confirma que el Inter tuvo una **fila DUPLICADA** — la real en
`ligaExt_italia` y una residual en `ligaExt_liga-ea-sports` (origen:
el club vivió en el slot de Liga EA Sports antes de moverse a Italia).
Si el orden de enumeración de `localStorage` (no determinista,
depende del navegador) entregaba antes la fila residual, L. Enrique
se persistía ahí — un documento que la pantalla 🖍 PLANTILLA (que lee
específicamente `ligaExt_italia`) nunca muestra. El alta "desaparecía"
sin ningún error, porque SÍ tuvo éxito — solo que en el sitio
equivocado. Además, el lector solo miraba `localStorage`, nunca
`window.LIGA_CACHE` (chokepoint obligatorio desde 2026-07-29).

**Fix**: la 1ª pasada ya NO para en el primer hit — recorre TODAS las
`ligaExt_*` (leyendo `window.LIGA_CACHE[slug]` PRIMERO, con fallback a
`localStorage`, mismo chokepoint que `loadData`/`_readLigaData`) y
elige la fila con MÁS jugadores (`t.players.length`) entre todas las
coincidencias por nombre — la fila residual/duplicada, casi siempre
vacía o casi vacía, pierde frente a la plantilla real.

### Reglas a respetar (refuerzo #3)

9. **PROHIBIDO** que `standings()` (o cualquier constructor de fila de
   clasificación nuevo) calcule `isHuman`/`humanEmoji` sin comprobar
   PRIMERO `window._isRetiredHumanClubName` — ni siquiera cuando el
   diseño exige que "la fila propia gane sobre el índice global" (regla
   PSG→Superliga, 2026-05-04): el guard de retirados va ANTES de esa
   prioridad, nunca después.
10. **PROHIBIDO** que un pintor de "fila extra" (`buildExtraRowHtml` o
    cualquier futuro que añada equipos fuera del `LIGA_SCHEDULE` normal
    a una clasificación) lea `team.isHuman`/`team.humanEmoji` sin el
    mismo guard.
11. **PROHIBIDO** que un archivo NUEVO (o ya existente) mantenga su
    PROPIA copia de "lista de humanos" (`HUMANOS`, `esHumano`, o
    equivalente) escaneando `ligaExt_*`/`ligaExt_liga-ea-sports` sin
    filtrar retirados. `part2/misc_body_2.html` es la CUARTA copia
    encontrada — antes de dar por cerrado este bug, auditar si existe
    una QUINTA en cualquier otro `.html`/`.js` del proyecto.
12. **PROHIBIDO** que una función que escanee TODAS las `ligaExt_*` en
    busca de un equipo por nombre (alta de jugador, recuperación,
    diagnóstico) se detenga en el PRIMER hit cuando el mismo nombre
    puede existir DUPLICADO en más de una liga. Recorrer TODAS las
    coincidencias y elegir la de MÁS jugadores (mismo criterio que
    `_findRichestHubRow`/`_hubRowLooksGeneric`) — nunca "la primera que
    aparezca por orden de enumeración de `localStorage`" (no
    determinista entre navegadores).
13. **PROHIBIDO** que un lector nuevo de `ligaExt_<slug>` (incluido
    dentro de `part2/misc_body_2.html`) mire SOLO `localStorage` sin
    consultar `window.LIGA_CACHE[slug]` primero — regla ya obligatoria
    desde 2026-07-29, aquí extendida explícitamente a
    `_gmFindAndPersistPlayer`.

## Open Qualifier/Wild Card/Recopa se quedaban corto de Ligas Mixtas 5-9 y de copas "sin campeón" — los lectores de `ligaExt_<slug>` del reparto europeo solo miraban `localStorage`, nunca `window.LIGA_CACHE` (obligatorio, 2026-08-02 #5)

**Bug (5 fotos usuario 2026-08-02)**: el Open Qualifier solo mostraba
equipos de Liga Mixta 1-4 (12 equipos), sin rastro de Liga Mixta 5-9.
Wild Card salía a 0 equipos. El diagnóstico de la Recopa
("13 liga(s) SIN campeón todavía") marcaba Dinamarca, Escocia, Suiza,
Turquía y las 9 Ligas Mixtas como "sin Copa simulada todavía" — pero
el usuario confirmó (y la propia app lo demuestra: la pantalla de la
Copa de Dinamarca muestra la FINAL jugada con **København** campeón)
que esas copas SÍ estaban simuladas.

### Causa raíz

`_computeQualifiedFromLeagues` (Open Qualifier/Wild Card/UCL/UEL/UECL),
`_buildPool` (Recopa), `_recopaMissingChampionLeagues` (diagnóstico),
`_uclPrevLeagueRanking` (Previa Champions) y `_eurPickerLoadLeague`
(picker "AÑADIR POR LIGA") leían **ÚNICAMENTE** `localStorage.getItem
('ligaExt_'+slug)` — nunca consultaban `window.LIGA_CACHE[slug]`
primero. Es EXACTAMENTE el mismo bug ya documentado y arreglado para
`_readLigaData`/`loadData` (sección "'Resto de Ligas · Estadísticas'
salía vacío..." más abajo): `saveData` SIEMPRE deja la copia fresca en
`window.LIGA_CACHE[slug]` (memoria), pase lo que pase con la cuota del
navegador — pero si `localStorage.setItem` falla en silencio (banner
"Navegador sin espacio", frecuente al simular ~60 ligas de golpe, o
las 9 Ligas Mixtas al ser de las últimas en un bucle de simulación
masiva), la copia persistida en disco se queda ATRASADA o vacía
mientras la copia en memoria (y el servidor) SÍ tienen la simulación
completa/el campeón. La propia pantalla de cada liga (`loadData`) SÍ
mira `LIGA_CACHE` primero y por eso mostraba los datos correctos — los
5 lectores de arriba, al saltarse ese paso, veían una copia distinta
(más pobre) de la MISMA liga y la daban por "sin terminar"/"sin
campeón".

### Fix — `window._eurBestLeagueData(slug, localParsed)`, fuente única

Nuevo helper compartido (`misc_body_1.html`, junto al primer
`_buildPool`): dado el JSON ya parseado de `localStorage` para un
slug, lo compara con `window.LIGA_CACHE[slug]` y devuelve la copia con
MÁS resultados de liga jugados, o con campeón de copa si la otra
copia no lo tiene — nunca menos que lo que ya había en `localStorage`.
`window._eurAllKnownLeagueSlugs(fromLocalStorageKeys)` complementa el
helper: une los slugs que solo existen en `LIGA_CACHE` esta sesión
(nunca llegaron a persistir en `localStorage`) con los que sí están
en disco, para que ninguna liga hidratada solo en memoria quede fuera
del bucle.

Aplicado en los 5 puntos: `_computeQualifiedFromLeagues` (con unión de
slugs vía `_eurAllKnownLeagueSlugs`), `_buildPool` (Recopa, misma
unión), `_recopaMissingChampionLeagues` (ya iteraba TODOS los slugs de
`LEAGUE_DEFAULT_ZONES`, solo necesitaba el read mejorado),
`_uclPrevLeagueRanking` y `_eurPickerLoadLeague`.

### Reglas a respetar

1. **PROHIBIDO** que un lector nuevo de `ligaExt_<slug>` para el
   reparto europeo (Open Qualifier, Wild Card, UCL/UEL/UECL, Previa,
   Recopa, Intercontinental, o cualquier diagnóstico/picker de esa
   familia) lea `localStorage.getItem('ligaExt_'+slug)` sin pasar el
   resultado por `window._eurBestLeagueData(slug, parsed)`. Es el
   mismo chokepoint que ya exige la regla de `_readLigaData` —
   generalizado aquí a los 5 lectores del reparto europeo.
2. **PROHIBIDO** que un bucle que enumera "todas las ligas" para el
   reparto europeo derive la lista de slugs SOLO de
   `localStorage.length`/`localStorage.key(i)`. Debe unir con
   `window._eurAllKnownLeagueSlugs(...)` para no perderse una liga
   hidratada solo en `LIGA_CACHE` esta sesión (nunca escrita a disco).
3. **PROHIBIDO** que `_eurBestLeagueData` pise la copia de
   `localStorage` con una de `LIGA_CACHE` más pobre (menos resultados,
   sin campeón cuando la local sí lo tiene) — solo gana si aporta
   estrictamente más.
4. Toda liga NUEVA (una 10ª Liga Mixta, o cualquier liga futura)
   hereda el fix automáticamente — el helper es genérico por slug, sin
   lista hardcodeada.

## El desplegable "AÑADIR POR LIGA" (equipos por competición) se cerraba solo al primer segundo — `preventDefault()` en touchstart bloqueaba el scroll de la lista de 54 ligas (obligatorio, 2026-08-02 #4)

**Bug (foto usuario 2026-08-02, overlay «👁 Ver / Añadir equipos por
competición» → «📋 AÑADIR POR LIGA», lista desplegada hasta «Liga mixta
1» con Dinamarca ✅ ya elegida)**: "ese desplegable solo dura 1 segundo
y se cierra" — el admin necesitaba DESLIZAR el dedo por la lista de 54
ligas para llegar a la que quería, pero el desplegable se cerraba
prácticamente al instante de tocarlo, sin darle tiempo a scrollear.

### Causa raíz

El fix 2026-08-01 #4 ("El picker 'AÑADIR POR LIGA'… no dejaba
seleccionar Liga") unificó el disparo de TODOS los elementos del
overlay —botones Y filas `[data-eur-pick-league]`— en
`_eurWireTapFallback`: `touchstart` PURO con `e.preventDefault()`
SIEMPRE, para que el tap nunca se perdiera. Ese `preventDefault()` en
`touchstart` es correcto para un BOTÓN suelto (no necesita scroll
propio), pero para una FILA dentro de `#eur-pick-league-list`
(`overflow-y:auto`, hasta 54 entradas) tiene un efecto colateral grave:
**bloquea el scroll nativo del contenedor para ESE toque** — en cuanto
el dedo tocaba CUALQUIER fila para empezar a deslizar, el navegador no
podía interpretar el gesto como scroll (el `preventDefault` ya lo había
cancelado), así que `_fire()` disparaba el `click()` de esa fila al
instante → seleccionaba esa liga y **cerraba el desplegable** — el
admin no llegaba nunca a deslizar hasta la liga que quería.

### Fix — filas de la lista con detección tap-vs-scroll POR TOUCHMOVE, sin `preventDefault` en touchstart

`_eurWireLeagueRowTap(row)` (nueva, junto a `_eurWireTapFallback`),
cableada SOLO a `[data-eur-pick-league]` (los botones del overlay
siguen con `_eurWireTapFallback`, touchstart inmediato — no son listas
scrollables, no tienen este problema):

- `touchstart`/`touchmove` van con `passive:true` y **NUNCA** llaman
  `preventDefault()` — el scroll nativo del contenedor funciona con
  total normalidad.
- Se mide el movimiento del dedo entre `touchstart` y `touchend`
  (`MOVE_PX=10`). Si superó el umbral (scroll real), **no se
  selecciona nada** — el desplegable se queda fijo.
- Solo si el movimiento fue mínimo (tap real, no scroll) se llama
  `row.click()` en `touchend`, con `preventDefault()` justo AHÍ (no en
  touchstart) para que el click sintético que el navegador añadiría
  después no dispare la selección DOS veces.

### Reglas a respetar

1. **PROHIBIDO** que una fila dentro de una lista LARGA scrollable
   (`overflow-y:auto`, `#eur-pick-league-list` o cualquier lista nueva
   de este tipo con más de ~15 filas que el admin necesite recorrer
   deslizando) use `_eurWireTapFallback` (touchstart inmediato +
   `preventDefault` en touchstart). Ese patrón es SOLO para botones
   sueltos que no requieren scroll sobre sí mismos — usar
   `_eurWireLeagueRowTap` (o el mismo patrón: sin `preventDefault` en
   touchstart/touchmove, decisión tap-vs-scroll por `touchmove`,
   `preventDefault` solo en el `touchend` que decide disparar).
2. **PROHIBIDO** volver a unificar el selector de `_eurWireTapFallbackAll`
   en un único `container.querySelectorAll('button, [data-eur-pick-league]')`
   con la MISMA función para ambos. Botones y filas de lista larga
   necesitan gestos táctiles distintos — la regla 2026-08-01 #4 ("no
   dependa ÚNICAMENTE del click sintético") sigue vigente para AMBOS,
   pero el mecanismo de disparo no es el mismo.
3. Toda lista NUEVA de este overlay con ≥15 filas scrollables (o
   cualquier lista larga de otra pantalla con el mismo problema) hereda
   `_eurWireLeagueRowTap` en vez de reinventar el patrón.

## "Resto de Ligas · Estadísticas" mostraba TODAS las banderas de una Liga Mixta apiladas en vez de la bandera REAL del equipo (obligatorio, 2026-08-02)

**Petición/bug usuario 2026-08-02** (foto, caja "GOLEADORES"): «Jugador 10 · Lokomotiv Moscow» (equipo ruso de `liga-mixta-8`, fusión de Rusia+Armenia+Finlandia+Moldavia+Azerbaiyán) salía con las **5 banderas apiladas** de toda la Liga Mixta en vez de solo la rusa. Igual para cualquier jugador de una de las 9 Ligas Mixtas (fusión de 3-5 ligas menores en una sola, sección "Ligas Mixtas" 2026-07-30/31 más abajo). Petición: mostrar SOLO la bandera real del equipo; si no se conoce, una bandera negra.

### Causa raíz

`_collectAggregateStats()` (`misc_body_1.html`, agregador de la caja "📈 Resto de Ligas · Estadísticas") asignaba a CADA jugador la bandera de la **card de la liga** (`_eachLeagueCard(function(name, flag, slug){...})`). Para las ~40 ligas de un solo país eso es correcto (una card = un país = una bandera). Pero para las 9 Ligas Mixtas, `flag` es la CONCATENACIÓN de las 3-5 banderas de los países fusionados (el icono de la card, correcto como icono de LA LIGA) — nunca se resolvía a qué país concreto pertenece CADA equipo dentro de esa liga.

### Fix — bandera por `t.country`, negra si no se conoce

- **`LIGA_MIXTA_COUNTRIES`** (nuevo, `misc_body_1.html`, junto a `_collectAggregateStats`): mapa `slug → [{name, alias[], flag}]` con los 3-5 países de cada una de las 9 Ligas Mixtas, en el mismo orden y con las MISMAS banderas que ya usa la card (`mc-emoji`) — no se inventan banderas nuevas. Expuesto en `window.LIGA_MIXTA_COUNTRIES`.
- **`_mixtaTeamFlag(slug, countryRaw)`**: resuelve la bandera del país escrito en `t.country` (campo opcional YA EXISTENTE del editor de plantilla, "🌐 País", normalizado sin acentos/mayúsculas + una lista corta de alias por país) dentro de esa Liga Mixta. Si `t.country` está vacío o no coincide con ninguno de los países de esa liga, devuelve **🏴 (bandera negra)** — petición explícita del usuario: *"si no sabes de donde es cada equipo pon una bandera de color negro"*.
- `_collectAggregateStats`: para slugs `liga-mixta-N` (detectados vía `_isLigaMixtaSlug`), cada equipo resuelve su propia bandera con `_mixtaTeamFlag(slug, t.country)` en vez de heredar la de la card. El resto de ligas (un solo país) no cambia.
- **Datalist de ayuda** en el editor de plantilla (vista cards, `_lcRenderCard`/`_lcRender`): el campo "🌐 País" de un equipo de Liga Mixta gana un `<datalist id="lc-country-datalist">` (repoblado en cada render vía `_lcRefreshCountryDatalist`) con SOLO los 3-5 países válidos de esa liga concreta — evita que el admin escriba un país con una grafía que `_mixtaTeamFlag` no reconozca y el equipo se quede con bandera negra por un simple typo.

### Reglas a respetar

1. **PROHIBIDO** que un agregador de estadísticas nuevo (o cualquier pantalla que muestre la bandera de un equipo de Resto de Ligas) use la bandera de la CARD de la liga sin comprobar antes si esa liga es una Liga Mixta (`_isLigaMixtaSlug`). Una Liga Mixta no tiene una bandera única — cada equipo tiene la suya.
2. **PROHIBIDO** que `_mixtaTeamFlag` devuelva la bandera de OTRO país de la misma Liga Mixta como fallback cuando `t.country` no coincide — el fallback es SIEMPRE la bandera negra (🏴), nunca una bandera real "aproximada".
3. **PROHIBIDO** inventar banderas nuevas en `LIGA_MIXTA_COUNTRIES` que no coincidan con las ya usadas en el `mc-emoji` de la card de esa Liga Mixta (`s-ligas`, grid de `menu-card[data-slug="liga-mixta-N"]`) — deben ser las MISMAS, carácter a carácter, para que la bandera de un equipo sea siempre un subconjunto reconocible de la bandera de su liga.
4. Toda Liga Mixta NUEVA (una 10ª futura, si se añade) hereda esto en cuanto se añada su entrada a `LIGA_MIXTA_COUNTRIES` con el mismo slug `liga-mixta-N` — `_isLigaMixtaSlug` ya es genérico (regex `^liga-mixta-\d+$`), no hace falta tocar el agregador.
5. El campo `t.country` sigue siendo libre/opcional para TODAS las ligas (no solo las Mixtas) — el datalist de sugerencias solo aparece cuando `LIGA_MIXTA_COUNTRIES[slug]` existe; en el resto de ligas el campo sigue aceptando cualquier texto sin validarlo contra nada.

## El reset masivo (♻️ Rest) de las Ligas Mixtas/Resto Mundo se deshacía solo al reabrir la liga — resurrección SIN sello en `_lextIdbTopupIfEmpty` + cache de "Máximo goleador" nunca se limpiaba (obligatorio, 2026-08-02)

**Bug (usuario 2026-08-02, «cuando pulso Rest global las ligas mixtas y
copas mixtas no vuelven a cero»)**: tras pulsar ♻️ Rest en "Resto de
Ligas" (resetea las ~60 ligas + sus copas, ver sección de arriba), las
9 "Ligas Mixtas" (Liga Mixta 1-9, fusión de países menores) y Resto del
Mundo seguían mostrando la clasificación Y la cabecera "Máximo
goleador" de la copa con los valores de ANTES del reset — a veces
incluso sin necesidad de recargar la página, solo con volver a abrir
la card.

### Causa raíz 1 — `_lextIdbTopupIfEmpty` resucitaba `results` SIN comprobar el sello, y se dispara EN CADA APERTURA

Las Ligas Mixtas y Resto del Mundo son las únicas en `_EXTRA_LEAGUE_SEEDS`,
y `openLigaExt` (parcheado) llama a `_ensureExtraLeagueSeed(slug)` **cada
vez que se abre esa card** (no solo al arrancar la web) — el resto de
ligas normales NO tiene este re-seed-on-open. Con la liga ya con equipos
(roster intacto tras el reset, solo `results`/stats a 0),
`_ensureExtraLeagueSeed` delega en `_lextIdbTopupIfEmpty(slug)`, que
compara la copia de `localStorage` con la de IndexedDB (espejo durable,
escrito por `saveData` en CADA guardado, incluido cada simulación
ANTERIOR al reset). Su primer intento de recuperación
(`_lextBackfillResults`) SÍ respeta `resultsStamp` (un reset con sello
fresco correctamente no se pisa) — pero justo después había una 2ª rama,
`else if (merged === curNow && !_hasResults(curNow) && idbHasResults) {
merged.results = idbData.results; }`, que volvía a copiar los resultados
de IndexedDB **sin mirar el sello en absoluto** — deshaciendo el reset
en cuanto `results` estaba vacío (que es EXACTAMENTE el estado normal
justo después de resetear). Escrita para el caso legítimo "eviction se
llevó todo, restaurar desde IDB", nunca distinguía ese caso de "el admin
acaba de vaciar esto a propósito".

### Causa raíz 2 — la cabecera "Máximo goleador" lee una cache aparte que el reset nunca limpiaba

`ef_player_stats_v1` (localStorage) es una cache separada de
`t.players[].gol` que alimenta la cabecera "Máximo goleador" (liga+copa)
de la pantalla de cada liga. La sincroniza `_lecSyncPlayerStatsCache(data)`
— pero el reset global (`ligaExtReiniciarSlug`, y el individual
`ligaExtReiniciar`) nunca la llamaba, así que aunque `t.players[].gol`
quedara en 0 correctamente, la cabecera seguía leyendo el valor viejo de
esta cache hasta el próximo Sim. Agravante: la propia
`_lecSyncPlayerStatsCache`, cuando un equipo tenía `totalPj===0` (recién
reseteado), hacía `return` sin tocar `stats[k]` — dejaba la entrada VIEJA
intacta en vez de borrarla, así que aunque se la hubiera llamado tras el
reset tampoco habría servido de nada.

### Fix

- **`_lextIdbTopupIfEmpty`**: se elimina la rama `else if` que copiaba
  `results` sin sello. `_lextBackfillResults` (llamada justo antes, con
  EMPTY-GUARD + comparación de `resultsStamp`) ya cubre el caso legítimo
  de recuperación tras un vaciado de `localStorage` — no hace falta (ni
  es seguro) un segundo intento sin sello.
- **`_lecSyncPlayerStatsCache`**: cuando `totalPj===0` para un equipo,
  BORRA (`delete stats[k]`) la entrada de cada jugador de ese equipo en
  vez de saltarse la escritura — antes dejaba el valor viejo intacto
  para siempre.
- **`ligaExtReiniciar`/`ligaExtReiniciarSlug`**: ambas llaman a
  `_lecSyncPlayerStatsCache(data)` tras `saveData` (mismo patrón que
  `_finishSim`/`_lecCopa.reset()`), y a `_lecRender()` si la pantalla de
  Copa de esa liga está abierta, para que la cabecera se repinte al
  instante sin esperar a la siguiente navegación.

### Reglas a respetar

1. **PROHIBIDO** que `_lextIdbTopupIfEmpty` (o cualquier recuperación
   nueva desde IndexedDB/`_protected`/snapshots) copie `results`/
   cualquier campo protegido por `resultsStamp` sin pasar por
   `_lextBackfillResults` (o el arbitraje de sello equivalente). Un
   `results` vacío es un estado LEGÍTIMO justo después de un reset — no
   se puede asumir que "vacío = hay que recuperar de IndexedDB".
2. **PROHIBIDO** que `_lecSyncPlayerStatsCache` (o cualquier sync de
   cache de stats similar) deje una entrada VIEJA intacta cuando el
   jugador/equipo ya no tiene nada que aportar (`totalPj===0`). Debe
   BORRAR la entrada, no saltarse la escritura.
3. **PROHIBIDO** que un reset nuevo (global, individual, o de cualquier
   competición futura que tenga su propia cache de "líder/máximo
   goleador") toque `t.players[]`/`data.results` sin refrescar TAMBIÉN
   cualquier cache derivada (`ef_player_stats_v1` u otra) que la UI lea
   por separado — de lo contrario el dato "ya está a 0" pero la pantalla
   sigue mostrando el valor viejo hasta el próximo Sim.
4. Toda liga NUEVA que se añada a `_EXTRA_LEAGUE_SEEDS` (con
   re-seed-on-open vía `openLigaExt`) hereda automáticamente el fix 1;
   no hay lista de slugs que mantener aparte.

## El reset INDIVIDUAL de una Copa duplicaba las estadísticas al re-simular — snapshot pre-copa que se restaura al resetear (obligatorio, 2026-08-02)

**Bug (usuario 2026-08-02, "sobre las estadísticas duplicadas cuando reseteo individualmente una copa se duplican")**: pulsar **♻️ Reset** en el modal de una Copa individual (botón `_lecCopa.reset()`, distinto del reset MASIVO "Res" de las ~54 ligas) rehacía el sorteo y volvía a simular la copa desde cero, pero los goles/MVP/tarjetas que la copa VIEJA ya había sumado a `team.players[]` se quedaban ahí — y la copa NUEVA sumaba los suyos ENCIMA. Cada ciclo reset+resim inflaba/duplicaba las stats de copa de cada jugador.

### Causa raíz

`applyMatchStats(team, gf, ga, yellows, reds)` (`misc_body_1.html`) **SUMA** sobre los campos del jugador (`p.pj++`, `p.gol++`, `p.ta++`…) — nunca sobreescribe. Es el motor compartido por Liga y Copa: en Resto de Ligas, `team.players[]` guarda un TOTAL único Liga+Copa (regla ya existente, "Resto de Ligas — las stats de COPA + LIGA se SUMAN por jugador"). `_lecCopa.reset()` hacía únicamente `data.copa = null` — el propio confirm() lo decía explícitamente: *"Las estadísticas que ya se sumaron a las plantillas... NO se borran — quedan tal como están"*. Eso era intencional para no perder historial, pero es incompatible con que la copa se vaya a **re-simular**: sin restar la contribución de la copa borrada, la siguiente simulación parte de un total que YA incluía esa copa, y la duplica.

El caso MASIVO (`ligaExtReiniciarSlug`, botón global "Res", y `_finishSim` con `_lecSimCupOn(data,{force:true})`) no tenía este bug porque SIEMPRE llama a `resetPlayerStats` (pone todo a 0) justo antes de re-simular Liga+Copa — la copa nueva parte de una base limpia. El reset individual de copa no tiene ese lujo: solo debe tocar lo que la COPA aportó, sin tocar la Liga.

### Fix — `statsSnapshot` tomado al crear `data.copa`, restaurado al resetear

- **`_lecSnapshotStats(data)`** (nuevo, junto a `_lecEnsureCopa`): captura `{pj,gol,pen,fk,mvp,ta,tr,imbat,penSaved}` de CADA jugador de CADA equipo, indexado por `team.name` + `player.id` (fallback `player.name`).
- Se toma **en el instante exacto en que `data.copa` se crea** — en los 2 únicos puntos donde eso ocurre: `_lecEnsureCopa` (botón "🎮 SIM Copa" individual, primera vez) y `_lecSimCupOn` (motor reutilizable de `_lecRunAllAuto` y de la Sim masiva `force:true`) — y se guarda como `data.copa.statsSnapshot`. En ese instante los jugadores YA tienen su total de Liga (y, si hubo `force`, acaban de pasar por `resetPlayerStats`), así que el snapshot representa exactamente "todo lo que NO es de esta copa".
- **`_lecRestoreStatsSnapshot(data, snap)`** (nuevo): restaura cada jugador a los valores del snapshot — deshace SOLO lo que la copa (a punto de borrarse) había sumado encima.
- **`_lecCopa.reset()`**: si `data.copa.statsSnapshot` existe, restaura ANTES de poner `data.copa = null`, y llama a `_lecSyncPlayerStatsCache(data)` para que el cache `ef_player_stats_v1` (cabeceras "Máximo goleador", dashboards) refleje el valor corregido al instante, sin esperar al próximo Sim. El texto del `confirm()` se actualizó para reflejar el comportamiento real.
- Un `data.copa` **legacy** (creado antes de este fix, sin `statsSnapshot`) no tiene nada que restaurar — se conserva el comportamiento previo para esos saves ya existentes; el fix protege TODA copa que se cree/resetee desde ahora en adelante.

### Reglas a respetar

1. **PROHIBIDO** que `_lecCopa.reset()` (o cualquier reset INDIVIDUAL de una copa que se vaya a re-simular) vuelva a dejar `team.players[]` "tal como está" sin restar la contribución de la copa que se borra. `applyMatchStats` es aditivo — un reset que no resta y luego resimula SIEMPRE duplica.
2. **PROHIBIDO** que un punto NUEVO de creación de `data.copa` (si se añade un 3er sitio en el futuro) omita `statsSnapshot: _lecSnapshotStats(data)`. Es lo único que permite deshacer la copa individualmente sin tocar la Liga.
3. **PROHIBIDO** que `_lecRestoreStatsSnapshot` toque jugadores que no estaban en el snapshot (altas posteriores a la creación de la copa) — se dejan intactos, no había nada suyo que deshacer.
4. El reset MASIVO (`ligaExtReiniciarSlug`, botón "Res") sigue llamando a `resetPlayerStats` de todos los jugadores ANTES de re-simular — no necesita el snapshot (parte de 0), y no se ha tocado.
5. Si se persiste el `statsSnapshot` en `data.copa`, tener en cuenta que viaja dentro de `ligaExt_<slug>` (cap 2 MB por carpeta, regla ya existente) — es proporcional al nº de jugadores de la liga, mismo orden de magnitud que `team.players[]` ya persistido, no debería acercarse al límite.

## Una liga SOLO aporta equipos a Europa cuando termina TODOS sus partidos — ni ranking por poder, ni standings a medias (obligatorio, 2026-08-02 #3) ⚠️ SUPERSEDE la sección "Una liga RECIÉN RESETEADA..." (#2) y MATIZA aún más la regla "Clasificación a competiciones europeas" (2026-05-02), ambas más abajo

**Petición usuario 2026-08-02** (tras el fix #2 de abajo — "puedes
distinguirlo / el Open Qualifier hasta que no se jueguen los 38
partidos de cada Liga / en la Copa de cada pais hasta que no haya un
campeón"): el fix #2 (flag `data.neverPlayed`) solo evitaba el ranking
por poder para ligas RECIÉN RESETEADAS — una liga VIRGEN (nunca
tocada) o A MEDIO SIMULAR seguía aportando equipos a Open Qualifier/
Wild Card/UCL/UEL/UECL/Previa por ranking por poder o por standings
parciales. El usuario pidió una regla más simple y más estricta:
ninguna liga aporta NADA hasta que termine TODOS sus partidos — el
mismo criterio "todo o nada" que la Recopa ya aplicaba al campeón de
Copa (`cp.champion` debe existir; una Copa a medias no aporta nada).

### Fix — `_computeQualifiedFromLeagues(zoneKey)`: gate único por completitud

`rN < needed` (`needed = N*(N-1)`, el total de partidos de una liga a
doble vuelta — "38 partidos por equipo" para una liga de 20) → esa
liga aporta **0 equipos** a la zona, punto. Se ELIMINAN por completo:

- El ranking por poder (`_rankByPower`) para `rN === 0` — cualquier
  liga sin terminar, virgen o no, ya no cae aquí.
- El filtro per-team `pj === 0` sobre standings parciales
  (`0 < rN < needed`) — ya no hay standings parciales: o la liga está
  COMPLETA (`rN >= needed`) y se usa `_standingsFromResults` entero, o
  no aporta nada.
- El trato permisivo especial de las zonas feeder (`uclQual`/
  `wildcard`, incluido el auto-cupo `isWcAuto` de las 40 ligas de Wild
  Card): antes aceptaban cualquier estado de simulación; ahora
  requieren la misma completitud que las zonas directas.

El flag `data.neverPlayed` del fix #2 (sección de abajo) queda
**REDUNDANTE y se ha ELIMINADO** del código: con el gate de
completitud, una liga recién reseteada (`rN=0 < needed`) ya queda
excluida sin necesidad de ningún flag adicional — igual que una liga
virgen. `ligaExtReiniciar`/`ligaExtReiniciarSlug`/`ligaExtSimular` ya
NO tocan ningún flag de este tipo.

**`_uclPrevLeagueRanking(slug)`** (Previa Champions, usado por
`computeUclPrevFixedR2Teams` para elegir "la mejor de las 2 plazas 🟣
de una liga-mixta"): mismo gate — antes caía a `_rankByPower` si
`results.length` era 0; ahora devuelve `[]` (sin ranking) si
`results.length < needed`.

**Recopa/Intercontinental NO necesitaban este fix** — ya exigían
`cp.champion` (Copa terminada) desde siempre; el usuario lo confirmó
("en la Copa de cada país hasta que no haya un campeón" ya era el
comportamiento existente).

### Precio conocido y ACEPTADO a propósito

El propio historial de la regla 2026-05-02 documenta que un gate de
completitud estricto "dejaba el pool de Previa Champions con muchos
TBD-50..63 cuando las ligas estaban parcialmente simuladas" — es
EXACTAMENTE lo que motivó relajar la regla en su momento. El usuario,
con este pedido, decide explícitamente que ese hueco TBD es preferible
a mostrar un equipo cuya clasificación aún no está demostrada. Esta
decisión SUPERSEDE la de 2026-05-02 — no es un descuido, es la
prioridad actual del usuario.

### Reglas a respetar

1. **PROHIBIDO** que `_computeQualifiedFromLeagues` (o cualquier
   cómputo nuevo de zona europea) vuelva a aceptar una liga con
   `rN < needed` (partidos incompletos), sea por ranking por poder, por
   standings parciales, o por cualquier trato especial de zona feeder/
   auto-cupo. El gate es único y se aplica ANTES de calcular cualquier
   ranking — `if (rN < needed) return;` (con su nota de diagnóstico).
2. **PROHIBIDO** reintroducir el flag `data.neverPlayed` (fix #2,
   ahora eliminado) o cualquier equivalente — el gate de completitud ya
   cubre TODOS los casos (virgen, recién reseteada, a medio simular)
   sin necesidad de distinguir el motivo de por qué `rN` está por
   debajo de `needed`.
3. **PROHIBIDO** que `_uclPrevLeagueRanking` (o cualquier helper que
   resuelva "el equipo en el rank N de esta liga concreta", usado por
   Previa Champions u otra competición) caiga a `_rankByPower` cuando
   la liga no ha terminado. Debe devolver `[]`/vacío, igual que el
   cómputo de zona.
4. **PROHIBIDO** volver a dar trato permisivo especial a `uclQual`/
   `wildcard` frente a las zonas directas (`ucl`/`uclPrev`/`uel`/
   `uecl`) en cuanto a completitud — todas exigen `rN >= needed` por
   igual. El auto-cupo (`isWcAuto`) sigue existiendo SOLO para la
   configuración de la zona (bypass de `slots > 0`), nunca para saltar
   la exigencia de completitud.
5. `window._eurRankByPower`/`_rankByPower` NO se elimina del código —
   sigue expuesto para el picker manual "Añadir por liga" del overlay
   de admin (`_eurManualOverlayOpen`), una herramienta de PREVIEW/
   asistencia manual, no del cómputo automático de zonas. Esa
   herramienta puede seguir mostrando el ranking de una liga incompleta
   porque es el admin quien decide a mano qué añadir, con conocimiento
   de causa — el gate de completitud es solo para el cómputo
   AUTOMÁTICO.
6. Toda liga con un nº de equipos distinto de 20 sigue funcionando
   igual (`needed = N*(N-1)` generaliza a cualquier N — "38 partidos"
   es solo el caso concreto de una liga de 20 a doble vuelta).

## Una liga RECIÉN RESETEADA ya no aporta equipos fantasma a Open Qualifier/Wild Card/UCL/UEL/UECL/Previa por "ranking por poder" (obligatorio, 2026-08-02 #2, ⚠️ SUPERSEDED por la sección de arriba, #3 — se documenta como histórico) ⚠️ MATIZA la regla "Clasificación a competiciones europeas" (2026-05-02) más abajo

**Bug/petición usuario 2026-08-02** ("he reiniciado todas las ligas /
todos los contadores de liga, copa y estadísticas están a cero / porque
el Open Qualifier y la Recopa en el Reparto Europeo salen si no se ha
jugado nada / Investigar y arreglar", con fotos): tras pulsar el botón
global "♻️ Res" (`_restoLigasResAll`, resetea las ~54 ligas de golpe),
con TODOS los contadores de liga/copa/estadísticas confirmados a cero,
el overlay "Equipos por competición" seguía mostrando **Open Qualifier
con 28 equipos reales** y **Recopa con 50 equipos reales**, agrupados
por liga (Liga Mixta 1-9, Inglaterra, Italia, Liga EA Sports…).

### Causa raíz — DOS mecanismos distintos, cada uno con su propio motivo

1. **Recopa YA estaba arreglada** (ver sección de arriba, "diagnóstico
   sin campeón" + el fix paralelo de `ligaExtReiniciarSlug` que ya pone
   `data.copa = null` en el reset global): `_buildPool()` solo aporta
   equipos si `data.copa.champion`/`runnerUp`/`semis` existen — con
   `data.copa = null` tras el reset, el cómputo automático YA da 0. Los
   50 equipos que el usuario vio venían de una sesión/dispositivo que
   aún no tenía ese fix, o de los manuales explícitos (`_meaTeamsFor`/
   `eur_manual_extra_v1`, que NUNCA se tocan por un reset — son
   adiciones a mano del admin, correcto que sobrevivan).
2. **Open Qualifier (y, por el mismo camino, Wild Card/UCL/Previa/UEL/
   UECL) SÍ tenía un bug real**: `_computeQualifiedFromLeagues(zoneKey)`
   tiene la regla obligatoria 2026-05-02 "si la liga tiene `rN === 0`
   (cero partidos) → ranking por PODER (`_rankByPower`), aceptando TODOS
   los equipos aunque no hayan jugado nada — es la única señal
   disponible". Esa regla se diseñó para una liga **VIRGEN** (nunca
   tocada, en medio de una configuración progresiva del admin) — pero
   el código no distinguía "liga virgen" de "liga RECIÉN RESETEADA a
   propósito": ambas tienen `results.length === 0` de forma idéntica.
   Tras un reset masivo, las ~54 ligas volvían a poblar Open Qualifier/
   Wild Card/UCL/UEL/UECL/Previa con equipos ordenados por su atributo
   `power` (estático, nunca se resetea) — exactamente como si el admin
   nunca hubiera tocado nada, contradiciendo la expectativa de "todo a
   cero" tras un reset deliberado.

### Fix (HISTÓRICO — SUPERSEDED, ver sección #3 de arriba)

Este fix introducía un flag `data.neverPlayed` (sellado `true` por
`ligaExtReiniciar`/`ligaExtReiniciarSlug`, `false` por
`ligaExtSimular`) para que el ranking por poder de
`_computeQualifiedFromLeagues` distinguiera "liga virgen" de "liga
recién reseteada". **El fix #3 de arriba (2026-08-02, mismo día)
ELIMINÓ POR COMPLETO el ranking por poder** (para virgen Y para
reseteada) sustituyéndolo por un gate único de completitud
(`rN >= needed`) — por eso `data.neverPlayed` quedó redundante y
**SE ELIMINÓ del código** (ya no existe en `ligaExtReiniciar`/
`ligaExtReiniciarSlug`/`ligaExtSimular`/`_computeQualifiedFromLeagues`).
Esta sección se conserva solo como registro histórico de la
investigación — **el código y las reglas vigentes son las de la
sección #3, más arriba**. No reintroducir `data.neverPlayed`.

## Una liga elegible para Recopa sin campeón simplemente DESAPARECÍA del informe — diagnóstico "sin campeón" en vez de un hueco mudo (obligatorio, 2026-08-02)

**Petición/bug usuario 2026-08-02 (fotos, informe «Equipos por
competición» → 🥈 Recopa de Europa)**: el informe mostraba 7 de las 9
"Liga mixta" con su campeón/subcampeón/semifinalistas listados, pero
**Liga Mixta 2** y **Liga Mixta 3** no aparecían en absoluto — "faltan
2 ligas mixtas, solo hay 7 asignadas a la recopa y 2 que no salen".

### Causa raíz — no es un bug de cómputo, es un hueco de DIAGNÓSTICO

`_eurZoneSectionHtml(zone, teams)` (el render compartido por el informe
post-«Enviar» y por el overlay «Equipos por competición») agrupa los
equipos del pool por liga (`_eurLeagueLabel`) y **solo pinta una
sección para las ligas que SÍ tienen ≥1 equipo** en `teams`. Una liga
elegible (no está en `EUROPE_BLACKLIST`) cuyo `ligaExt_<slug>.copa.champion`
está vacío en ESTE dispositivo —porque nunca se pulsó "🎮 SIM Copa"
para ella, o porque sus datos ni siquiera están cacheados localmente—
aporta **0 equipos** al pool de `_buildPool()` (Recopa) y por tanto
**no genera ninguna sección**, ni siquiera una vacía. El resultado es
indistinguible, a simple vista, de un fallo real del cómputo — el
admin no tiene forma de saber si "no sale" porque hay un bug o porque
sencillamente esa Copa no se ha jugado todavía en su móvil.

### Fix — `window._recopaMissingChampionLeagues()`, diagnóstico explícito

Nuevo helper (`misc_body_1.html`, junto a `_recopaLivePool`): recorre
TODAS las ligas elegibles para Recopa (mismo `EUROPE_BLACKLIST` que
`_buildPool` — excluye Resto del Mundo/EA Sports/Hypermotion/1ª RFEF) y
devuelve las que NO tienen `data.copa.champion`, con el motivo exacto:
**"sin datos en este dispositivo"** (la liga nunca se abrió/cacheó
aquí) o **"sin Copa simulada todavía"** (los equipos están, pero nadie
ha pulsado Sim Copa). `_eurZoneSectionHtml` lo consulta SOLO para la
zona `recopa` y, si hay ligas sin campeón, añade un bloque ámbar
explícito bajo la lista normal con el nombre de cada liga + su motivo —
en vez de dejarlas desaparecer en silencio. Como esta función es
compartida por el informe post-«Enviar» (`_eurShowCommitReport`) y por
el overlay de consulta+edición «Equipos por competición», el aviso
aparece en ambos sitios sin duplicar código.

**Relación con la sección siguiente** ("Resto de Ligas · Estadísticas"
salía vacío... las 9 Ligas Mixtas quedaban fuera por slug vacío"): esa
es probablemente la causa de FONDO de por qué Liga Mixta 2/3 nunca
llegaron a tener campeón en este dispositivo — el botón global "🎮 Sim"
las saltaba en silencio (slug vacío). Con ese fix, el próximo "🎮 Sim"
masivo debería simularlas también; este diagnóstico queda como red de
seguridad para cualquier otra liga que, por el motivo que sea, se quede
sin Copa simulada en un dispositivo concreto.

### Reglas a respetar

1. **PROHIBIDO** que `_eurZoneSectionHtml` (o cualquier render de
   informe agrupado por liga que se añada en el futuro) trate "0
   equipos de esta liga" como "esta liga no existe/no aplica" sin
   distinguirlo de "esta liga SÍ es elegible pero aún no tiene datos".
   Toda zona cuyo pool dependa de una condición previa por-liga
   (campeón de copa, clasificación completa, etc.) debe poder listar
   EXPLÍCITAMENTE qué ligas elegibles se están quedando fuera y por qué
   — no basta con que la sección "no aparezca".
2. **PROHIBIDO** que `_recopaMissingChampionLeagues` use un
   `EUROPE_BLACKLIST` distinto al de `_buildPool` — deben ir siempre
   sincronizados (misma liga blacklisted en el pool ⇒ blacklisted
   también en el diagnóstico), o el diagnóstico podría "avisar" de una
   liga que en realidad nunca debió aportar nada (Resto del Mundo, Liga
   EA Sports, Hypermotion, 1ª RFEF).
3. Toda liga NUEVA hereda el diagnóstico automáticamente (recorre
   `LEAGUE_DEFAULT_ZONES`, sin lista hardcodeada de slugs).
## "Resto de Ligas · Estadísticas" salía vacío tras "Sim" masivo — el agregador solo miraba `localStorage`, nunca la cache en memoria; y las 9 Ligas Mixtas quedaban fuera por slug vacío (obligatorio, 2026-08-02)

**Bug (usuario 2026-08-02, «todas las ligas y copas del resto de ligas
simuladas pero no hay ni una sola estadística subida a la caja
estadísticas»)**: tras pulsar 🎮 Sim (las ~60 ligas de golpe), la
clasificación de cada liga se veía bien, pero el overlay 📈
Estadísticas mostraba «Sin datos todavía» en las 8 categorías
(Goleadores, MVP, penaltis, faltas, porterías imbatidas, penaltis
parados, amarillas, rojas).

### Causa raíz 1 — el agregador solo leía `localStorage`, nunca la cache en memoria

`_readLigaData(slug)` (`misc_body_1.html`, IIFE de "Resto de Ligas")
leía ÚNICAMENTE `localStorage.getItem('ligaExt_'+slug)` (+ `_protected`).
`saveData(k,d)` — el chokepoint de CADA guardado tras simular — SÍ deja
la copia fresca en `LIGA_CACHE[k]` (memoria), pero esa `LIGA_CACHE` es
una `var` LOCAL al IIFE del editor de plantilla — un IIFE DISTINTO del
que contiene `_readLigaData`, así que era invisible para el agregador.
Con `localStorage` lleno (banner «Navegador sin espacio», documentado
muchas veces en este archivo, aquí agravado por simular ~60 ligas con
plantilla+copa de golpe), el `_lsSetSafe` de `saveData` puede fallar en
silencio para varias/todas las ligas — la clasificación se sigue viendo
en otras pantallas (que leen `LIGA_CACHE` vía `loadData`), pero
`_readLigaData` veía `raw` vacío para TODAS y las marcaba `sin-data`.

### Causa raíz 2 — las 9 "Ligas Mixtas" quedaban fuera de Sim/Reset/Estadísticas por slug vacío

Las 9 cards de "Ligas Mixtas" (fusión de ligas menores, 2026-07-30/31)
tienen el `.mc-label` oculto (`display:none`) con el texto = las
mismas banderas emoji que `.mc-emoji`, y dependen de `data-slug="liga-
mixta-N"` para resolver su slug real (ya usado por `wireLigasExt`/
`openLigaExt`, con el comentario explícito "bypasa el slugify() del
label, que con emoji daría cadena vacía"). Pero `_eachLeagueCard` (el
iterador que usan `_restoLigasSimAll`/`_restoLigasResAll`/
`_collectAggregateStats`) NUNCA leía `data-slug` — derivaba el slug
SIEMPRE de `_slugify(mc-label.textContent)`, que para esas 9 cards da
`''`. Con slug vacío, `ligaExtSimularSlug('')`/`ligaExtReiniciarSlug('')`
devuelven `false` al instante — esas 9 ligas nunca se simulaban ni
reseteaban desde los botones globales, sin ningún aviso.

### Fix

- **`saveData(k,d)`**: además de `LIGA_CACHE[k] = d` (local), espeja
  SIEMPRE en `window.LIGA_CACHE[k] = d` — accesible desde cualquier
  IIFE del proyecto, inmune a que el `setItem` de `localStorage` quepa
  o no.
- **`_readLigaData(slug)`**: consulta `window.LIGA_CACHE[slug]` como
  fuente 0, ANTES de `localStorage`. Su hidratación de fondo (fuente 3)
  pasa además de `/api/liga-ext/<slug>` (solo `main`) a
  `/api/liga-ext-any/<slug>` (resuelve el fallback a `_protected` EN EL
  SERVIDOR) — se había quedado fuera de la migración obligatoria
  2026-07-29 #2.
- **`_eachLeagueCard(cb)`**: el callback recibe un 3er argumento
  `slug` = `data-slug` de la card si existe, si no
  `_slugify(mc-label)` (mismo criterio que `wireLigasExt`). Los 3
  consumidores (`_restoLigasSimAll`, `_restoLigasResAll`,
  `_collectAggregateStats`) usan ese slug en vez de re-derivarlo.

### Reglas a respetar

1. **PROHIBIDO** que un agregador/lector nuevo de `ligaExt_<slug>`
   (estadísticas, auditoría, diagnóstico, o cualquier pantalla que
   recorra "todas las ligas") mire SOLO `localStorage` sin consultar
   antes `window.LIGA_CACHE[slug]`. `saveData` es el chokepoint único
   de guardado y SIEMPRE deja la copia fresca ahí, sea cual sea el
   estado de la cuota del navegador.
2. **PROHIBIDO** que un iterador de `#s-ligas .menu-card` (o cualquier
   grid de cards con `data-slug` para labels-solo-emoji, patrón ya
   usado por las Ligas Mixtas) derive el slug SOLO de
   `_slugify(mc-label.textContent)` sin comprobar `data-slug` primero.
   Toda card nueva de este tipo (label oculto/solo-emoji) hereda el
   `data-slug` automáticamente en cuanto pase por `_eachLeagueCard`.
3. **PROHIBIDO** que una lectura nueva de `ligaExt_<slug>` con
   propósito de "recuperar/mostrar la plantilla real" use
   `/api/liga-ext/<slug>` pelado — usar siempre `/api/liga-ext-any/<slug>`
   (regla ya existente 2026-07-29 #2, este helper se había quedado
   fuera).

## El calendario (global + individual de los 7 humanos) de la Previa de Champions pasa de 6 Jornadas a solo Ida/Vuelta de la Ronda 2 (obligatorio, 2026-08-02)

**Petición usuario 2026-08-02** (fotos calendario individual + global,
«31 Jul · Previa Champions — J1» … «14 Ago · Previa Champions — J6»):
sustituir las 6 jornadas de fase de grupos por SOLO 2 partidos —
**"Ida Previa Champions — R2"** (01 Ago, 🌧) y **"Vuelta Previa
Champions — R2"** (09 Ago) — dejando el resto de días como Descanso/
Entrenamiento/Liga tal cual especificó el usuario.

### Por qué esto encaja con el motor actual (no es solo un cambio visual)

El motor de la Previa lleva desde 2026-07-31 en formato **Ronda 1 +
Ronda 2, ambas KO a doble partido** (`part2/misc_body_2.html`,
`_doDrawR1/_doSimR1/_doDrawR2/_doSimR2`), que **YA SUPERSEDE** el
formato de "16 grupos de 4 con 6 jornadas" documentado más abajo en
este archivo. La ÚNICA vía por la que un club HUMANO llega a la Previa
es el 5º de España (Liga EA Sports, manual vía "EA Sports → Europa" →
`computeUclPrevFixedR2Teams`), que **SIEMPRE** entra FIJO a la Ronda 2
— el club humano **NUNCA** juega la Ronda 1 (esa la juegan 24 equipos
IA: 12 del Open Qualifier + 12 directos-no-fijos). Por eso el
calendario de CUALQUIERA de los 7 humanos solo necesita 2 días: Ida y
Vuelta de SU eliminatoria de Ronda 2. La etiqueta "Previa Champions —
J1..J6" (fase de grupos con 12 grupos de 4) era **texto muerto**: el
resolver que la leía (`_wprevHubResolve`, leía
`wprev_state_v1.groups`/`.fixtures`, un shape que el motor actual ni
siquiera escribe) tenía su callback `open()` apuntando a
`window._wprevPlayHumanMatch`, una función que **nunca llegó a
definirse** en ningún archivo — la card era 100% inalcanzable incluso
si el calendario la hubiera mostrado bien.

### Fix

- **`calendario.json`** (`version` 8→9 para forzar la migración
  server-side sobre cualquier fila `calendario_global_v1` ya cacheada
  en BD — ver `load_calendario()`, `app.py`: sin el bump de versión el
  fichero git-baked se ignora en cualquier deploy ya arrancado): los 6
  eventos "Previa Champions — J1".."J6" (ev-092/094/096/100/102/106)
  se sustituyen por 2 ("Ida"/"Vuelta" ... — R2", ev-093/ev-101) y los 4
  días que quedan libres pasan a Descanso/Entrenamiento según el
  calendario exacto que dio el usuario. Mismas fechas totales (28
  Jul–18 Ago), mismos ids de evento, mismo icono 🔵 (🟣 no está en
  `CALENDARIO_VALID_ICONS`; el color morado en la UI lo sigue dando
  el detector de nombre `_detectComp`/`_applyIconColors`,
  `part2/misc_body_2.html`, que ya reconoce "previa"+"champ" → 🟣 sin
  tocar nada).
- **`_wprevHubResolve`** (`misc_body_1.html`) reescrito para leer
  `wprev_state_v1.r2.ties[idx]` (formato real del motor 2026-07-31) en
  vez del `groups`/`fixtures` muerto, y para parsear "Ida/Vuelta Previa
  Champions — R2" en vez de "Previa Champions — J<N>". El `open()`
  ahora sí llama a una función real: `window._wprevKoOpenMatch('r2',
  idx)` (auto-deriva la ida o la vuelta según `tie.legs.length`, igual
  que ya hace `_eurKoHubResolve` con Champions/Europa/Conference KO).
- **`_cardWprevPending`** (nueva): si `s.r2.ties` todavía no tiene la
  eliminatoria del club humano (Ronda 1 IA-vs-IA sin terminar), la card
  del hub muestra "⚠️ RIVAL PENDIENTE" + botón "🤖 Simular Ronda 1"
  (llama a `window.simulateUclPrev()`, hasta 2 veces seguidas si la
  1ª pasada deja `phase==='r1-done'`, para sortear Y revelar la Ronda 2
  en el mismo toque). **Sin 📌 Posponer** en este estado — a diferencia
  del bracket europeo (que reserva de antemano un índice por ronda),
  `s.r2.ties` no existe hasta que `_doDrawR2` sortea la Ronda 2, así
  que no hay ningún matchKey estable que posponer todavía.
- **`_playDeferredHvH`** (`misc_body_1.html`, pantalla 📌 PARTIDOS
  POSPUESTOS): nueva rama para matchKey `wprevko_<r1|r2>_<idx>_<i|v>`
  (mismo patrón que la rama `eurko_` ya existente) — sin ella, posponer
  el partido de Ronda 2 (sí soportado, con `defer:{tourId:'ucl',
  matchKey:'wprevko_r2_'+idx+'_'+leg}` en el objeto que devuelve
  `_wprevHubResolve`) habría caído al fallback genérico
  `_tourOpenHumanMatch('ucl', ...)`, que no sabe nada de `wprev_state_v1`
  — el partido pospuesto habría quedado en un callejón sin salida,
  visible en la lista pero imposible de reabrir.
- **`_mmCalLabel`** (`static/js/index.bundle.js`, resolutor de fecha de
  la PANTALLA DE PREVIA a pantalla completa): la rama muerta
  `wprevfg_<gi>_<j>` (fase de grupos) y el regex viejo
  `wprevko_\d+_[iv]` (sin segmento de ronda, nunca coincidía con el
  matchKey real `wprevko_<r1|r2>_<idx>_<leg>`) se sustituyen por un
  único match `^wprevko_(r1|r2)_\d+_([iv])$` → "Ida/Vuelta Previa
  Champions — R1/R2". Bump `index.bundle.js` 9.34→9.35 en
  `templates/index.html` y `static/js/sw.js` (regla obligatoria de
  versión de assets estáticos, sección "Todo cambio en
  `index.bundle.js`/`.css`..." más abajo).

### Reglas a respetar

1. **PROHIBIDO** reintroducir "Previa Champions — J1".."J6" (fase de
   grupos, 6 jornadas) en `calendario.json` ni en ningún resolver. El
   motor de la Previa es Ronda 1 + Ronda 2 KO desde 2026-07-31; el club
   humano SOLO juega la Ronda 2 (2 días: Ida/Vuelta — R2).
2. **PROHIBIDO** que `_wprevHubResolve` vuelva a leer
   `wprev_state_v1.groups`/`.fixtures` (shape del formato viejo, ya no
   lo escribe nada) o a delegar en `window._wprevPlayHumanMatch`/
   `window._wprevSaveHumanResult` (nunca definidas). La fuente única es
   `wprev_state_v1.r2.ties[idx]` vía `window._wprevKoOpenMatch`/
   `window._wprevKoSaveHumanResult`.
3. **PROHIBIDO** añadir 📌 Posponer a la card "RIVAL PENDIENTE"
   (`_cardWprevPending`) sin resolver antes cómo reabrir un matchKey
   sin índice de tie todavía asignado. El botón "🤖 Simular Ronda 1" es
   la única vía de desbloqueo mientras `s.r2.ties` no exista.
4. Si se toca `_mmCalLabel` o `_wprevHubResolve` en el futuro
   (competición nueva, ronda nueva), mantener el bump de versión de
   `calendario.json` (server-side) Y de `index.bundle.js` (cliente) —
   sin ambos, el fix no llega a un deploy ya arrancado con datos en BD.

## "🎮 Admin - Europa" no dejaba añadir NINGÚN equipo a NINGUNA competición — `_lsSetSafe` nunca lanza, el try/catch que comprobaba su resultado quedó MUERTO (obligatorio, 2026-08-02)

**Bug (foto usuario 2026-08-02, «🎮 Admin - Europa» → sección SUPERLIGA,
buscador con "Atle" mostrando sugerencias «Atlético Madrid»)**: "no me
deja añadir manualmente los equipos cuando antes siempre me dejaba...
no me deja añadir ningún equipo a ninguna competición" — el buscador
por nombre (typeahead) funcionaba y mostraba sugerencias, pero pulsar
"➕ Añadir" (o una sugerencia) no añadía nada a NINGUNA de las 11
secciones de la pantalla (Champions/Previa/Open Qualifier/Wild Card/
Europa League/Conference/Recopa/Supercopa Europa/Intercontinental/
Superliga/Torneos de Verano), sin ningún error visible.

### Causa raíz — regresión de la migración masiva a `_lsSetSafe` (2026-07-29)

El commit "Migra localStorage.setItem a _lsSetSafe en todo el proyecto"
sustituyó mecánicamente `localStorage.setItem(...)` por
`window._lsSetSafe(...)` en ~250 puntos, incluida `_save(slug, list)`
de este módulo (`s-ea-manual`, `misc_body_1.html`). El problema: **`_lsSetSafe`
NUNCA lanza** (su propio contrato, "Devuelve true/false; NUNCA lanza")
— libera espacio y reintenta INTERNAMENTE, y si tras todo no cabe,
simplemente **devuelve `false`**. El `try{ window._lsSetSafe(...); ...
return true; } catch(err){ ...comprobar err.code...; return isQuota ?
'quota' : false; }` de `_save` quedó con el **catch MUERTO** — como
`_lsSetSafe` nunca lanza, ese bloque nunca se ejecuta, y `_save`
devolvía `true` SIEMPRE, aunque el guardado local hubiera fallado de
verdad. Con el `localStorage` de este usuario crónicamente cerca del
límite (documentado en muchas secciones de este archivo), el guardado
de `manual_ea_<slug>_v1` fallaba en TODAS las competiciones y `_doAdd`
nunca se enteraba: ni revertía el push, ni mostraba ningún aviso — el
usuario pulsaba "Añadir" y, en cuanto `render()` releía el
`localStorage` (que seguía con el valor VIEJO), el equipo simplemente
no aparecía, sin ningún error. Antes de la migración,
`localStorage.setItem` SÍ lanzaba de verdad y el catch original
funcionaba (de ahí "antes siempre me dejaba").

Se encontraron y arreglaron **2 instancias más del MISMO patrón** en el
mismo archivo, migradas por el mismo commit: `saveIcons` (iconos custom
de competiciones, `comp_icons_v1`) y `save(arr)` de la vitrina de
Trofeos (`bayern_trofeos_v1`). Ambas también reportaban éxito a ciegas
sin comprobar el resultado real de `_lsSetSafe`.

**NO se tocó** `_setItemSafe` dentro de `saveData` (el chokepoint de
`ligaExt_<slug>`, línea ~48802): tiene el MISMO catch muerto, pero su
cascada de limpieza interna es en gran parte redundante con la que
`_lsSetSafe` ya hace, y sus reintentos (`_retry()`) vuelven a llamar a
`_lsSetSafe` — que, una vez `window._lsQuotaExhausted` queda a `true`
(pestillo de sesión), corta en seco cualquier valor >64 KB SIN
reintentar aunque `_setItemSafe` acabe de liberar más espacio. Arreglar
el booleano ahí sin resolver esa interacción con el pestillo es
arriesgado en la función más crítica del proyecto — queda pendiente
para una sesión dedicada solo a `saveData`.

### Fix

- `_save(slug, list)` (`s-ea-manual`): usa el booleano real de
  `window._lsSetSafe(...)`; si es `false`, revierte y reporta
  `'quota'`/`false` según `window._lsQuotaExhausted` — igual que se
  pretendía desde el principio.
- `_hydrateFromServer(slug, cb)`: antes solo hacía GET si el
  `localStorage` de esa clave estaba VACÍO — si el guardado local
  fallaba pero el POST al servidor llegaba, la próxima vez el
  `localStorage` ya NO estaba vacío (tenía el valor viejo) y el GET se
  saltaba para siempre, perdiendo el equipo. Ahora compara `ts` (GET
  SIEMPRE, adopta el del servidor si es más reciente que el local) —
  cumple lo que el propio comentario del código ya prometía.
- `saveIcons` y `save(arr)` (Trofeos): mismo fix del booleano.
- Los avisos de fallo de `_doAdd` usan `window._gmCriticalNotice ||
  alert` (regla ya existente 2026-07-06): un `alert()` a secas puede
  quedar suprimido por el navegador tras muchos diálogos en la misma
  sesión, indistinguible de "no pasa nada".

### Reglas a respetar

1. **PROHIBIDO** envolver una llamada a `window._lsSetSafe(...)` en un
   `try{...} catch(err){ ...comprobar err.code...}` para detectar fallo
   de cuota. `_lsSetSafe` NUNCA lanza — su contrato es devolver
   `true`/`false`. Todo caller nuevo o migrado debe comprobar
   `if (window._lsSetSafe(key, value)) {...} else {...}` (o guardar el
   booleano en una variable), nunca depender de una excepción.
2. **PROHIBIDO** asumir que una función de guardado con un
   `try{ window._lsSetSafe(...); return true; } catch(...)` está
   protegida contra cuota solo porque "tiene su propio catch" — auditar
   si ese catch puede llegar a ejecutarse de verdad.
3. **PROHIBIDO** que una hidratación desde servidor (`_hydrateFromServer`
   o equivalente) se salte el GET solo porque el `localStorage` local
   NO está vacío. Si el guardado local puede fallar en silencio (cuota),
   un local "no vacío pero viejo" bloquea para siempre la recuperación
   desde el servidor — comparar por `ts`/recencia, no por presencia.
4. Si aparece un bug nuevo de "no me deja guardar/añadir X" en
   CUALQUIER pantalla de este proyecto, buscar primero este mismo
   patrón (`try { window._lsSetSafe(...); return true; } catch(err){...}`)
   antes de investigar otra causa — es una regresión sistémica de la
   migración 2026-07-29, no necesariamente aislada a la pantalla
   reportada.

## El picker "AÑADIR POR LIGA" (equipos por competición) no dejaba seleccionar Liga — tap-vs-scroll + re-render de fondo interrumpiendo el gesto (obligatorio, 2026-08-01 #4)

**Bug (fotos usuario 2026-08-01, overlay «👁 Equipos por competición» →
«📋 AÑADIR POR LIGA», lista desplegada con Bélgica/Dinamarca/Escocia/
Francia/Inglaterra/…)**: "no deja seleccionar Ligas, el selector se
cierra muy rápido" — el admin abría la lista de ~54 ligas para elegir
Inglaterra y no conseguía que el tap "cuajara": la lista se cerraba
antes de poder seleccionar la liga deseada.

### Causa raíz (dos bugs combinados en el mismo picker)

1. **Ambigüedad tap-vs-scroll**: `#eur-pick-league-list`
   (`_eurPickerButtonHtml`) es un contenedor `overflow-y:auto` con
   ~54 filas, cada una dependiendo ÚNICAMENTE del `click` sintético
   (`row.onclick`). Es el MISMO patrón ya documentado muchas veces en
   este proyecto (portería imbatida, FINALIZAR, etc.): un tap real con
   el mínimo movimiento del dedo dentro de un contenedor scrollable
   puede hacer que el navegador lo interprete como intento de scroll y
   cancele el `click` — el admin "tocaba" Inglaterra pero el evento
   nunca llegaba a disparar la selección.
2. **Re-render de fondo destruye el picker a mitad de gesto**: la
   auto-hidratación al abrir el overlay (`_eurManualTriggerHydrate`,
   throttle 2 min, puede tardar **1-2 minutos** con ~50 ligas) llama a
   `_eurManualOverlayRender()` en cuanto termina — y esa función hace
   SIEMPRE `ov.innerHTML = ...`, destruyendo y reconstruyendo TODO el
   overlay de golpe. Si esa hidratación de fondo termina justo mientras
   el admin tiene la lista `#eur-pick-league-list` desplegada y está
   scrolleando/tocando una fila, el nodo que su dedo está tocando
   desaparece del DOM a mitad de gesto — el picker "se cierra solo",
   sin que el admin lo pidiera, indistinguible de un fallo del tap.

### Fix

- **`_eurWireTapFallback(el)` / `_eurWireTapFallbackAll(container)`**
  (junto a `_eurManualOverlayRender`): respaldo táctil en `touchstart`
  PURO (+ `pointerdown` + `mousedown` de respaldo, guarda `fired`
  compartida) sobre TODOS los botones y filas `[data-eur-pick-league]`
  del overlay — mismo patrón, tras la misma escalada, que el picker de
  portero/MVP (`_imbatWireTapFallback`). Una 1ª iteración con umbral de
  movimiento de 12px en `touchend` (menos agresiva, para no romper el
  scroll de la lista) se probó insuficiente en dispositivo real —
  algunas filas de la misma zona sí registraban el tap y otras no, sin
  patrón — así que se escaló a disparo inmediato en `touchstart`, igual
  que ya tuvo que hacer el picker de portero/MVP. El riesgo de un falso
  positivo al apoyar el dedo para empezar a scrollear es aceptable y
  recuperable (✕ Quitar) frente al coste de dejar el overlay entero sin
  responder. Cableado en `_eurWireNameSearchResultButtons` (resultados
  de búsqueda) y al final de `_eurManualOverlayRender` (pase completo
  del overlay).
- **`_eurManualRenderOrDefer()`** (nuevo): sustituye la llamada directa
  a `_eurManualOverlayRender()` en el callback de
  `_eurHydrateMissingLeagues` dentro de `_eurManualTriggerHydrate`. Si
  `_eurPickerListOpen` es `true` (el admin tiene la lista abierta),
  DIFIERE el re-render (`_eurRenderPendingAfterPicker = true` y
  `return`) en vez de aplicarlo al instante — el estado más fresco
  (`_eurManualHydrating`/`_eurManualLastHydrateAt`) ya quedó
  actualizado y se pinta solo en el PRÓXIMO render natural (elegir una
  liga, cerrar el desplegable, tocar cualquier otro control), nunca a
  mitad de una interacción con la lista.

### Reglas a respetar

1. **PROHIBIDO** que un botón o fila de este overlay (o de una lista
   larga SCROLLABLE nueva, `overflow-y:auto` con más de ~10-15 filas)
   dependa ÚNICAMENTE del `click` sintético. Todo elemento de este tipo
   hereda `_eurWireTapFallback`/`_eurWireTapFallbackAll` — el disparo es
   en `touchstart` PURO (no un umbral de movimiento): la 1ª iteración
   con umbral de 12px en `touchend` ya se probó insuficiente en
   dispositivo real. El riesgo de falso positivo al apoyar el dedo para
   scrollear es aceptable; el coste de un overlay que no responde no lo
   es.
2. **PROHIBIDO** que una auto-hidratación/refresco de FONDO (disparado
   por un timer, un fetch asíncrono, o cualquier callback no iniciado
   directamente por el toque actual del admin) llame a
   `_eurManualOverlayRender()` sin pasar por `_eurManualRenderOrDefer()`
   — o el equivalente que compruebe si hay un picker/desplegable
   abierto. Un re-render que destruye y reconstruye TODO el overlay
   (`innerHTML`) mientras el admin tiene el dedo sobre un elemento
   scrollable es indistinguible de "el selector se cierra solo".
3. Toda lista/picker NUEVO que se añada a este overlay («Equipos por
   competición») hereda ambos fixes automáticamente en cuanto reutilice
   `_eurWireTapFallbackAll`/`_eurManualRenderOrDefer` — no reinventar el
   patrón con un `onclick` suelto ni con una llamada directa a
   `_eurManualOverlayRender()` desde un callback asíncrono.

## Los toggles de Recopa (Subcampeón/Semifinalistas) volvían a 0 solos — store dedicado fuera de `ligaExt_<slug>` (obligatorio, 2026-08-01 #2)

**Bug (fotos usuario 2026-08-01, «FA Cup» — 15:59 con Subcampeón=1 y
Semifinalistas=2 recién activados, 16:00 ambos vueltos a 0 sin que el
usuario tocara nada)**: los 2 toggles nuevos de la sección anterior
(«Recopa — SEMIFINALISTAS…») se ACTIVABAN visualmente al pulsarlos,
pero minutos después volvían solos a 0/0 — "no se guardan los cambios
de qué equipos van a la Recopa".

### Causa raíz

`toggleSubcampeon`/`toggleSemis` guardaban el flag en
`data.config.recopaSubcampeon`/`recopaSemis`, DENTRO del documento
COMPLETO de la liga (`ligaExt_<slug>`, con equipos/plantillas/copa/etc,
hasta varios MB). Ese documento tiene una máquina de sync/anti-wipe
MUY elaborada (`fetchData`, `misc_body_1.html`) que decide si "adoptar
la copia del servidor" comparando SOLO nº de equipos/jugadores/
resultados — **nunca compara `config`** (el único backfill que existe
ahí es para `logo`/`cupLogo`, sección "El logo de la liga...").

Si un `fetchData` (disparado por CUALQUIER navegación/hidratación en
segundo plano de la app, no solo por el propio guardado) resolvía con
la copia del servidor ANTERIOR al POST del toggle — típico si el POST
tarda unos segundos en confirmar (red floja, Railway en cold-start) —,
esa respuesta se ADOPTABA completa (`LIGA_CACHE[k] = data;` +
`localStorage`) sin que ningún anti-wipe lo detectara, PISANDO
`data.config` entero con la copia vieja (sin el toggle). El admin veía
el cambio al pulsar (JS lo aplica al instante) pero, en cuanto CUALQUIER
hidratación de fondo de esa liga resolvía tarde, el toggle volvía a 0
sin que nadie lo tocara — exactamente el patrón ya documentado para el
HUD del hub (🪙💊💼, 2026-06-06/07): *"un store PEQUEÑO de banderas del
admin nunca debe viajar dentro de un blob COMPARTIDO gigante sujeto a
sync/anti-wipe de otra cosa"*.

### Fix — store dedicado `recopa_copa_flags_v1`, fuera del documento de la liga

Los 2 flags salen de `ligaExt_<slug>.config` y pasan a su PROPIA fila
KV: `recopa_copa_flags_v1`, objeto `{<slug>: {sub, semis}}`, gestionada
por un IIFE nuevo en `misc_body_1.html` (justo antes del motor de
Recopa) que reutiliza `window._kvBlobSync` (el mismo helper genérico
del HUD/lesiones/sanciones/trofeos — cache local + servidor como
fuente de verdad, merge por RECENCIA, hidrata al cargar, push
debounced tras cada cambio). Al vivir en su propia fila, es INMUNE a
la sync (mucho más pesada y frágil) del documento de equipos/
plantillas/resultados de la liga.

- `window._recopaFlagGet(slug, field)` / `window._recopaFlagToggle(slug,
  field, currentValue)` — API del store nuevo.
- `_lecCopa.toggleSubcampeon`/`toggleSemis`, `_lecRenderReglas` (UI) y
  `_buildPool` (motor de Recopa) leen de ahí PRIMERO, con **fallback a
  `data.config.recopaSubcampeon`/`recopaSemis`** (legacy) SOLO si ese
  slug+campo nunca se tocó en el store nuevo — así una copa que el
  admin ya había activado en la sesión anterior (bug de esta misma
  sección) no "pierde" su preferencia visible, pero toda escritura
  nueva va SIEMPRE al store dedicado.
- Servidor (`app.py`): `recopa_copa_flags_v1` añadida a
  `_KV_ALLOWED_EXACT` y `_KV_RECENCY_BLOB_KEYS` — mismo merge genérico
  por recencia que ya usan `bplant_stat_adjust_v1`/`mu_messages_v1`, sin
  necesidad de un caso especial (el blob entero es pequeño y viaja
  siempre completo en cada `touch`).

### Reglas a respetar

1. **PROHIBIDO** volver a guardar un flag/preferencia del admin (toggle,
   config editable) DENTRO de un documento grande sujeto a su propia
   sync/anti-wipe (`ligaExt_<slug>`, cfg de torneo, etc.) si esa
   maquinaria no está diseñada para preservar el campo nuevo. Todo flag
   de este tipo va a su PROPIA fila `/api/kv/<key>` (vía
   `window._kvBlobSync`), igual que el HUD/lesiones/sanciones/trofeos.
2. **PROHIBIDO** que un fetch/hidratación en segundo plano de un
   documento grande (`fetchData`, o cualquier equivalente futuro)
   "adopte" la copia del servidor sin preservar campos que otra
   feature guarda ahí — si de verdad hace falta guardar algo dentro de
   ese documento, hay que añadir su backfill explícito (como ya existe
   para `logo`/`cupLogo`); si no, mejor sacarlo a su propia fila KV
   desde el principio (más simple y más robusto).
3. **PROHIBIDO** quitar el fallback a `data.config.recopaSubcampeon`/
   `recopaSemis` en `_buildPool`/`_lecRenderReglas`/los toggles: es lo
   que evita perder visualmente la preferencia de una copa activada
   antes de este fix, mientras el store nuevo no se haya tocado para
   ese slug+campo.
4. Toda copa NUEVA hereda el store dedicado automáticamente (es
   genérico por slug, sin lista hardcodeada).

### Refuerzo (mismo día, #3) — `_kvBlobSync` se inicializaba DEMASIADO PRONTO, `sync` se quedaba `null` para siempre

**Bug (fotos usuario 2026-08-01, «FA Cup» — sigue en 0/0 tras el fix
anterior, "se sigue sin guardar los clubes ingleses que van a la
Recopa, quiero que vayan 4")**: el store dedicado de la sección de
arriba SÍ escribía el toggle en `localStorage`, pero JAMÁS llegaba al
servidor — la sincronización cross-device del store nuevo estaba rota
desde el primer commit.

**Causa raíz**: el IIFE del store nuevo hacía
`var sync = (typeof window._kvBlobSync === 'function') ?
window._kvBlobSync(KEY) : null;` de forma SÍNCRONA, a tiempo de
PARSEO. Pero `window._kvBlobSync` vive en `index.bundle.js`, que
`templates/index.html` carga con un `<script src>` AL FINAL del body —
DESPUÉS de `{% include 'partials/misc_body_1.html' %}` (donde vive
este store nuevo). En el instante en que el IIFE se evalúa,
`window._kvBlobSync` todavía NO EXISTE → `sync` quedaba `null` PARA
SIEMPRE (el chequeo era una comprobación única, nunca se repetía) →
ni `hydrate()` ni `touch()`/`push` se llamaban jamás → el toggle nunca
salía de ese dispositivo, así que cualquier otra pestaña/recarga que
dependiera del servidor (o cualquier merge cross-device) nunca lo veía.

Este es el MISMO problema que ya tiene solución establecida en este
archivo: `_bedOvInitSync`/`_btMsInitSync`/`_muInitSync` (búsqueda
`"diferimos el alta hasta que esté disponible"`) — un `setTimeout` con
reintentos hasta que `window._kvBlobSync` exista de verdad. El IIFE
nuevo del store de Recopa se escribió SIN copiar ese patrón.

**Fix**: `_initSync(tries)` reintenta cada 150 ms hasta 60 veces (9 s)
hasta que `window._kvBlobSync` esté disponible; solo entonces crea el
`sync`, llama `.config()`/`.seed()`/`.hydrate()`. Si un toggle ocurre
ANTES de que `_initSync` termine, `_persist()` ya dejó `updatedAt`
sellado y `FLAGS` actualizado — en cuanto `_initSync` conecta, su
`hydrate()` detecta que el local no está vacío y lo empuja al servidor
(`_push(0)` dentro de `_kvBlobSync.hydrate`), así que ningún toggle
hecho durante la ventana de espera se pierde.

**Reglas a respetar (además de las 4 de arriba)**:
5. **PROHIBIDO** que un IIFE de `misc_body_1.html`/`part2/misc_body_2.html`
   capture `window._kvBlobSync` con un chequeo ÚNICO y síncrono al
   parsear el script. Estos partials se evalúan ANTES que
   `index.bundle.js` (que se carga al final del `<body>`) — TODO store
   `_kvBlobSync` nuevo que se defina en un partial debe usar el patrón
   de reintento con `setTimeout` (ver `_bedOvInitSync` como referencia),
   nunca una comprobación `typeof window._kvBlobSync === 'function'`
   de una sola vez.
6. Antes de dar por buena la sincronización de un store `_kvBlobSync`
   NUEVO, verificar explícitamente (no solo por inspección) que
   `sync` deja de ser `null` tras la carga completa de la página — un
   `console.log`/breakpoint tras `_initSync` es más fiable que asumir
   que "el mismo patrón que lesiones/sanciones" se copió correctamente.

## Recopa de Europa — SEMIFINALISTAS (los 2 eliminados en semis) ahora también son elegibles, y el SUBCAMPEÓN deja de estar limitado a 9 copas (obligatorio, 2026-08-01)

**Petición usuario 2026-08-01**: "en todas las Copas las 11 Ligas
normales y las 9 mixtas me tienes que dejar añadir a la Recopa
Campeón, Subcampeón, Semifinales (que son los equipos eliminados en
semifinales)… para añadir a Recopa me tiene que salir CAMPEON,
SUBCAMPEÓN, 3 SEMIS, 4 SEMIS, en todas las Copas excepto Resto del
Mundo".

### Qué cambia

1. **La whitelist `RECOPA_SUBCAMPEON_SLUGS` (9 copas) queda
   ELIMINADA.** El toggle "🥈 Subcampeón" del modal 📜 Reglas de cada
   copa (`_lecRenderReglas`/`_lecCopa.toggleSubcampeon`) ya funcionaba
   igual (default `false`, editable por el admin) — el único cambio es
   que ahora está disponible en **cualquier copa externa**, no solo en
   las 9 de la whitelist.
2. **Nuevo toggle "⚔️ Semifinalistas (3º/4º)"** (`data.config.recopaSemis`,
   default `false`, `window._lecCopa.toggleSemis`): si el admin lo
   activa, los **2 equipos eliminados en semifinales** de esa copa
   (`copa.semis[].winner` → el perdedor de cada eliminatoria) entran
   también al pool de la Recopa. Solo se MUESTRA (y solo tiene efecto)
   en copas con fase de semis real — formato 20 (con cuartos, 2 legs
   por semi vía `_lecSim2Leg`, `s.tieHome`/`s.tieAway`) o formato 18
   (semis estilo Andorra a partido único vía `_lecSim1Leg`,
   `s.home`/`s.away`). Los formatos 14 y 12 van directos a la final
   (sin fase de semis) y no tienen semifinalistas que ofrecer — el
   toggle ni se pinta en esos casos.
3. **Orden de prioridad al capar el pool a 64** (`_buildPool`, sin
   cambios de criterio, solo generalizado): primero TODOS los
   campeones, luego TODOS los subcampeones (de cualquier copa con el
   toggle activo), luego TODOS los semifinalistas (de cualquier copa
   con `recopaSemis` activo). Así los de más peso siempre entran antes
   si el pool supera las 64 plazas.
4. **Resto del Mundo sigue sin aportar nada a Recopa** (regla ya
   existente 2026-05-27): su bloque de Reglas ni siquiera muestra el
   apartado "Plazas a Recopa" (`isRM` en `_lecRenderReglas`), y su
   slug está en `EUROPE_BLACKLIST` de `_buildPool` — ninguno de los 2
   toggles nuevos le afecta.

### Reglas a respetar

1. **PROHIBIDO** reintroducir `RECOPA_SUBCAMPEON_SLUGS` (o cualquier
   whitelist de copas concretas) para el subcampeón. El toggle
   `recopaSubcampeon` es válido en CUALQUIER copa externa excepto
   Resto del Mundo.
2. **PROHIBIDO** que `recopaSemis` aporte equipos de una copa sin fase
   de semis (formato 14/12, `cp.semis` inexistente/vacío) — `_buildPool`
   ya lo comprueba (`cp.semis && cp.semis.length`), y la UI no debe
   pintar el toggle para esos formatos (`hasSemis = fmt===20||fmt===18`).
3. **PROHIBIDO** que el helper `_semiLoser(s)` asuma un único shape de
   partido: formato 20 usa `tieHome`/`tieAway` (`_lecSim2Leg`, ida+
   vuelta), formato 18 usa `home`/`away` (`_lecSim1Leg`, partido
   único). Debe distinguir por la presencia de `s.tieHome !== undefined`,
   no por el formato — si se añade un formato nuevo con fase de semis,
   reutilizar uno de los 2 shapes existentes o extender el helper.
4. **PROHIBIDO** que los toggles nuevos tengan default distinto de
   `false`. Igual que el subcampeón (regla 2026-07-03): el admin activa
   explícitamente qué añade a Recopa, copa por copa.
5. Toda copa NUEVA (liga externa nueva) hereda ambos toggles
   automáticamente en cuanto tenga `data.copa` — no hay lista
   hardcodeada de slugs que mantener.

## El banner "El navegador se quedó sin espacio" reaparecía SIEMPRE sin que el usuario pudiera saber qué liberar — diagnóstico de espacio en el Panel Admin (obligatorio, 2026-08-01)

**Petición usuario 2026-08-01 (foto, banner marrón sobre «👁 Ver / Añadir
equipos por competición»)**: "siempre que abro la web sale ese mensaje...
he eliminado un montón de ligas y problemas pero sigue saliendo".

### Investigación — el banner es un síntoma REAL, no un falso positivo

El mensaje sale ÚNICAMENTE desde `_warnOnce()` (dentro de la IIFE
`window._lsSetSafe`, principio de `misc_body_1.html`), y solo se
dispara cuando: (1) un `localStorage.setItem` real revienta con
`QuotaExceededError`, **y** (2) `_freeAndRetry` ya agotó TODA su
cascada de limpieza automática (snapshots datados → `_backup` legacy →
caches de stats `ef_player_stats_*` → `_protected` de TODAS las demás
ligas, en lotes de 10 → `comp_icons_v1`) **y sigue sin caber**. Es
decir: para cuando el usuario VE el banner, el navegador ya intentó
liberar todo lo reconstruible por su cuenta y no fue suficiente — el
mensaje es preciso, no un bug de detección.

**Por qué "eliminar ligas" no lo arreglaba**: no existe ninguna función
de "eliminar liga entera" en el proyecto — solo se pueden borrar
equipos/jugadores DENTRO de una liga (`lextDeleteTeam`/
`lextDeletePlayer`, vía `saveData`). Eso SÍ reduce el tamaño de esa
liga en concreto (`main` + `_protected`, que `saveData` reescribe con
el estado actual en cada guardado — no es un histórico que crezca sin
límite). Pero con **~54 ligas externas** cada una con su propio
`main`+`_protected`+1 snapshot, reducir manualmente unas pocas no
compite con el total acumulado de las ~50 restantes sin tocar — el
usuario no tenía forma de saber CUÁLES eran las que más pesaban, así
que estaba adivinando a ciegas qué borrar.

Un segundo factor agravante: `window._lsQuotaExhausted` es un pestillo
de SESIÓN (2026-07-29) que, una vez activado, hace que CUALQUIER
guardado >64 KB se descarte sin ni siquiera reintentar durante el
resto de esa sesión — aunque el usuario libere espacio manualmente a
mitad de sesión (borrando equipos), los guardados grandes seguirían
saltándose hasta la próxima recarga completa de la página.

### Fix — pantalla de diagnóstico real en el Panel Admin (⚙️ → 📊 Espacio del navegador)

Nueva pantalla `s-admin-storage` (`misc_body_1.html`, junto a CASH):

- **Desglose real** por familia de clave, de mayor a menor: cada liga
  (`ligaExt_<slug>` + su `_protected`/`_snap_*`/`_backup` SUMADOS en
  una sola fila, así el usuario ve DE UN VISTAZO cuáles pesan más),
  torneos, selecciones, caches de estadísticas, iconos de competición,
  progreso/hub. Marca qué categorías son "reconstruibles" (se
  recuperan solas del servidor) frente a las que son datos reales.
- **`window._lsFreeReconstructibleNow()`** — ejecuta AHORA MISMO,
  bajo demanda del usuario, la MISMA cascada de categorías
  reconstruibles que `_freeAndRetry` ya sacrifica de forma reactiva
  (snapshots + `_backup` + stats caches + **TODOS** los `_protected` +
  `comp_icons_v1`), pero de golpe en vez de parar en el primer
  reintento con éxito — es una limpieza deliberada, no una emergencia
  a mitad de un guardado. **NUNCA toca ningún `ligaExt_<slug>`
  principal** (los datos reales de plantilla/resultados).
- Tras liberar, **resetea `_lsQuotaExhausted`/`_lsQuotaWarned`** para
  que el resto de la sesión vuelva a intentar guardados grandes en vez
  de descartarlos a ciegas.
- Hereda el patrón "RENDER FIABLE" (`part2/misc_body_2.html`, MAP de
  observer+go-wrap ya usado por Stadium Hub/Ball Storage/CASH) — la
  pantalla se repinta sola venga la navegación de donde venga (router,
  atrás, recarga), no solo del `onclick` de la card del menú.

### Reglas a respetar

1. **PROHIBIDO** que la única respuesta a "sigue saliendo el aviso de
   espacio" sea pedir al usuario que borre cosas a ciegas. El Panel
   Admin (⚙️ → 📊 Espacio del navegador) DEBE mostrar el desglose real
   por liga/categoría para que la limpieza sea DIRIGIDA.
2. **PROHIBIDO** que `_lsFreeReconstructibleNow` borre un
   `ligaExt_<slug>` principal (main). Solo toca las categorías 100%
   reconstruibles ya identificadas por `_freeAndRetry` — misma lista,
   sin desincronizarlas si una cambia.
3. **PROHIBIDO** que una limpieza manual de espacio deje
   `_lsQuotaExhausted`/`_lsQuotaWarned` en `true` tras liberar: sin el
   reset, los guardados grandes seguirían descartándose sin reintentar
   el resto de la sesión aunque ya quepan.
4. Toda categoría NUEVA que se añada a `_freeAndRetry` (cascada
   reactiva de `saveData`/`_lsSetSafe`) debe reflejarse también en el
   desglose y en `_lsFreeReconstructibleNow` de esta pantalla — son la
   misma lista de "qué es seguro tirar", no puede haber una versión
   reactiva y otra manual desincronizadas.
5. Si tras liberar TODO lo reconstruible el total sigue por encima de
   lo que el móvil da de sí, el hueco es de VOLUMEN real de datos
   (~54 ligas con plantillas completas) y la única vía adicional es
   reducir equipos/jugadores en las ligas más pesadas (visibles ahora
   en el desglose) — el banner seguirá siendo honesto en ese caso: el
   servidor sigue teniendo todo, solo se degrada la copia local.

## "Simular todas las ligas" fabricaba y GUARDABA plantillas genéricas "Jugador N" cuando el registro no resolvía a tiempo — el servidor las dejaba GANAR sobre la plantilla real (obligatorio, 2026-07-29)

**Bug (fotos usuario 2026-07-29, «Resto de Ligas» — Inglaterra, Alemania,
Italia, Francia, Países Bajos, Portugal y la mayoría de clasificados a
Champions)**: la caja "Resto de Ligas · Estadísticas" salía con
TODAS las categorías (Goleadores, MVP, Goles de penalti, Goles de
falta, Portería imbatida, Penaltis parados, Tarjetas amarillas) en
«Sin datos todavía». Al abrir Manchester City / Chelsea, los datos de
EQUIPO seguían intactos (PJ 38, G/E/P/G+, GLOBAL/ATQ/MED/DEF con
valores reales), pero la PLANTILLA mostraba jugadores genéricos
(«Jugador 18», «Jugador 10», «Jugador 22»…, PJ=41 en todos, 0 goles/
asistencias) en vez de los nombres y estadísticas reales que el
usuario ya tenía cargados.

### Causa raíz — `_lecSimCupOn` fabricaba placeholder sin el guard de bulk sim que SÍ tenía `ligaExtSimular`

`window._restoLigasSimAll` ("Simular todas las ligas") activa
`window._restoSimBulkInProgress` y, dentro de ese modo, el propio bucle
de `ligaExtSimular` (`misc_body_1.html`) YA evitaba fabricar un roster
genérico si `SQUAD_REGISTRY` no resolvía la plantilla real a tiempo —
dejaba `t.players` VACÍO en vez de inventar datos. Pero **`_finishSim`
llama SIEMPRE, sin mirar ese flag, a `_lecSimCupOn(data, {force:true})`**
(el motor de copa, "🎮 Sim = liga + copa" desde 2026-06-12), y
`_lecSimCupOn` tenía su PROPIA copia del mismo bloque de sembrado —
**sin el guard `_bulkSim`**. Si `SQUAD_REGISTRY` no tenía la plantilla
de ese equipo en ESE instante (muy probable en una pasada rápida por
~54 ligas), `_lecSimCupOn` caía a `_lextEnsureDefaultRoster(t)` —
fabricaba 30 "Jugador N" (los índices 10/11/22/6/7 con flags
natGoalPro/elite/penalty/natGoal/freeKick, exactamente los badges
P/⭐/🏀/⚾ vistos en las capturas) — y ese roster genérico quedaba en
`t.players`, que `saveData(slug, data)` persiste inmediatamente después.

Ni el roster genérico recién fabricado NI la plantilla real anterior
llevan `updatedAt` sellado (`_lextHydrateFromSquadRegistry` y
`_lextBuildDefaultRoster` nunca sellan). En `_lx_merge_teams` (`app.py`),
la regla "ninguno sellado → gana el entrante" dejaba que la plantilla
genérica recién guardada **sustituyera para siempre** la real en el
servidor — para TODOS los dispositivos. El backfill de identidad de
roster ya existente (`best_roster_by_name`) no lo evitaba porque solo
mira "vacío vs no-vacío": un roster de 30 "Jugador N" SÍ es no-vacío,
así que nunca disparaba el backfill.

### Fix — dos capas, mismo patrón que escudo/estadio/alias

- **Cliente** (`misc_body_1.html`, `_lecSimCupOn`): el sembrado de
  plantilla por defecto ahora respeta `window._restoSimBulkInProgress`,
  idéntico al guard que ya tenía `ligaExtSimular`. En bulk sim, si
  `SQUAD_REGISTRY` no resuelve, `t.players` se queda VACÍO (sin stats
  de copa para ese equipo en esa pasada) en vez de fabricar y guardar
  un roster falso.
- **Servidor** (`app.py`, `_lx_merge_teams`): el backfill de roster
  (`best_roster_by_name`) ahora detecta la firma exacta del roster
  placeholder (≥80% de nombres que matchean `^Jugador\s*\d+$`) y, si
  existe una versión REAL del mismo equipo (por nombre canónico) en
  cualquiera de las dos copias (old o new), esa real gana SIEMPRE —
  sin importar cuál ganó la fusión por-equipo ni qué `updatedAt` traiga
  cada una. Es la MISMA red de seguridad ya establecida para escudo/
  estadio/alias, extendida a "genérico vs real" en vez de solo "vacío
  vs no-vacío". Tests en `tests/test_api.py::TestLigaExtMerge`
  (`test_roster_generico_nunca_gana_a_real`,
  `test_roster_generico_se_reemplaza_por_real_de_otra_grafia`).

### Reglas a respetar

1. **PROHIBIDO** que un motor de simulación nuevo (copa, competición
   europea, o cualquier otro que toque `team.players[]` de una liga
   externa) tenga su PROPIA copia del bloque "hidratar desde
   SQUAD_REGISTRY → sembrar default si no hay nada" sin el MISMO guard
   `window._restoSimBulkInProgress` que usa `ligaExtSimular`. Si se
   necesita sembrar plantilla, se reutiliza el guard existente — no se
   duplica el bloque sin él.
2. **PROHIBIDO** que `_lextEnsureDefaultRoster`/`_lextBuildDefaultRoster`
   se llamen dentro de un bucle que itere TODAS las ligas de golpe (Sim
   masiva, migración, seed). Son seguros SOLO en flujos de una liga a
   la vez, donde el registro ya tuvo tiempo de resolver.
3. **PROHIBIDO** que el backfill de identidad de roster
   (`best_roster_by_name`) trate CUALQUIER roster no-vacío como
   "ganado, no tocar". Debe seguir distinguiendo genérico (firma
   "Jugador N") de real — un roster genérico NUNCA puede sobrevivir a
   la fusión si existe una versión real del mismo equipo en cualquiera
   de las dos copias.
4. Este bug es DISTINTO del ya documentado "Resto del Mundo — la
   PLANTILLA de jugadores es IDENTIDAD" (2026-07-02, backfill vacío→real):
   aquel cubre "no hay roster en absoluto"; este cubre "hay un roster,
   pero es un placeholder que nunca debió persistirse ni ganar".
5. **Recuperación de datos ya perdidos**: este fix es preventivo — NO
   reconstruye retroactivamente los nombres/estadísticas reales que ya
   se sobrescribieron en el servidor de producción (ninguna copia de
   este repo tiene acceso a esa base de datos en vivo). Si algún
   dispositivo del usuario todavía conserva localmente la plantilla
   real de una de estas ligas (no llegó a sincronizarse tras el
   incidente), el nuevo merge la restaurará automáticamente al servidor
   la próxima vez que ese dispositivo sincronice — es la única vía de
   recuperación posible sin acceso directo a la base de datos.

## `loadData` solo consultaba IndexedDB para 4 ligas auto-sembradas — se generaliza a TODA `ligaExt_*` como red final de recuperación (obligatorio, 2026-07-29 #3)

**Bug (usuario 2026-07-29, tras el fix #2 de arriba): «se han perdido
todas las plantillas de todos los equipos de Resto de Ligas también»**.
No solo Liga EA Sports/Hypermotion/Primera Federación — las ~50 ligas
externas normales de "Resto de Ligas" también aparecían sin plantilla.

### Causa raíz — IndexedDB (el espejo con más margen) solo se consultaba para 4 ligas

`saveData(k,d)` (el chokepoint único de todo guardado de `ligaExt_*`)
espeja SIEMPRE la liga completa en IndexedDB (`window._idbKV.set`,
~cientos de MB de cuota frente a los ~5 MB de `localStorage`, con
evicción mucho menos agresiva) — esto es genérico, corre para
CUALQUIER liga. Pero el ÚNICO lector de ese espejo,
`_lextIdbTopupIfEmpty(slug)`, solo se llamaba desde
`_ensureRestoMundoSeed`/`_ensureExtraLeagueSeed` — es decir, SOLO para
las 4 ligas con seed automático (Resto Mundo, Montenegro, N. Irlanda,
Albania). `loadData` (el chokepoint de lectura de TODAS las ligas,
usado por las ~50 externas "normales") agotaba local main →
`_protected` → `_backup` → `_snap_*` → hidratación del servidor, pero
JAMÁS miraba IndexedDB — la fuente local con más margen de todas se
quedaba sin usar para el 90% de las ligas del juego.

Si, además, el servidor también viene vacío para estas ligas (ver
sección de arriba: main y `_protected` pueden perderse juntos si la
base de datos del servidor es efímera — ver diagnóstico
`_persistence_diagnostic()` en `app.py`, expuesto en `/api/debug`: si
`DATABASE_URL` no está configurada o se desvincula en un redeploy de
Railway, el server cae a SQLite en disco efímero y TODAS las filas
`liga_ext_*` —main y `_protected`— desaparecen de golpe en el próximo
deploy/restart), la ÚNICA copia que puede sobrevivir es la que ya
tenía este dispositivo en su propio IndexedDB de antes del incidente.

### Fix

`loadData` llama a `_lextIdbTopupIfEmpty(k)` en los 3 puntos donde ya
llamaba a `_lextTriggerBgHydrate(k)` (cache poblada pero vacía / main
persistido vacío / agotadas todas las fuentes locales) — para
CUALQUIER slug, no solo los 4 auto-sembrados. `_lextIdbTopupIfEmpty`
ya era seguro por diseño (nunca pisa datos ya presentes, re-comprueba
justo antes de escribir, hace merge por nombre) — solo hacía falta
invocarlo desde el punto de lectura genérico.

### Reglas a respetar

1. **PROHIBIDO** que una red de recuperación local nueva (IndexedDB,
   o cualquier espejo durable futuro) se cablee SOLO a las 4 ligas
   auto-sembradas cuando el escritor (`saveData`) ya la alimenta para
   TODAS las ligas por igual. Si el escritor es genérico, el lector
   también debe serlo — auditar `loadData` (el chokepoint de lectura)
   además de los `_ensure*Seed` de las 4 ligas especiales.
2. **PROHIBIDO** asumir que "el servidor tiene `_protected`" basta como
   red de seguridad única. Si el servidor pierde AMBAS copias (main y
   `_protected`) a la vez — el patrón exacto de una base de datos
   efímera reiniciándose — la única copia que puede quedar es la de
   un dispositivo que todavía no ha sincronizado ese vacío. IndexedDB
   (evicción más laxa que `localStorage`) es esa última red.
3. Si un incidente futuro vuelve a mostrar "0 equipos" en MUCHAS ligas
   a la vez (no 1 o 2 sueltas), sospechar primero de una pérdida a
   nivel de servidor (comprobar `/api/debug` → `database_url_env_set`
   / el diagnóstico de persistencia en los logs de arranque) antes que
   de un bug de un flujo de cliente concreto — el patrón "todo a la
   vez" es la firma de un reinicio de base de datos efímera, no de un
   fallo de sincronización aislado.

## El clic en una fila de clasificación (EA Sports/Hypermotion/Primera Federación) y las 2 herramientas de "recuperación de emergencia" pedían SOLO el `main` del servidor — nunca miraban el snapshot `_protected` (obligatorio, 2026-07-29 #2)

**Bug (usuario 2026-07-29, fotos «Liga EA Sports · Clasificación»)**:
Liga EA Sports, Liga Hypermotion y el 80% de Primera Federación tenían
la plantilla COMPLETA (jugador a jugador) desde hacía meses, y de
repente la clasificación mostró TODOS los equipos a 0 PJ/0 PTS y, al
pulsar cualquier equipo (Arsenal), un alert: **«⚠️ No encuentro
«Arsenal» en ligaExt_liga-ea-sports. Equipos guardados (0)»**.

### Causa raíz — 3 puntos que solo consultaban `main`, nunca `_protected`

Este proyecto tiene, desde 2026-07-07, un snapshot `_protected` por
liga en el servidor (`liga_ext_<slug>_protected`) que es **monotónico**
(nunca encoge por debajo de su nº de jugadores más alto) precisamente
para sobrevivir a un `main` que se vacía por un guardado concurrente,
cuota agotada, o cualquier otra carrera. El endpoint
`/api/liga-ext-any/<slug>` resuelve ese fallback EN EL SERVIDOR (si
`main.teams` tiene <2 equipos, cae a `_protected`). El bug: **3 puntos
del cliente pedían el endpoint pelado `/api/liga-ext/<slug>` (solo
`main`, SIN fallback)**, así que si el `main` de estas 3 ligas se
vació (guardado concurrente entre varios dispositivos, cuota de
localStorage agotada en algún momento…), la plantilla parecía
"desaparecida" aunque siguiera intacta en `_protected`:

1. **El delegado de clic en `.clas-row`** (`document.addEventListener
   ('click', …)`, `misc_body_1.html`) — el que abre la plantilla al
   pulsar un equipo en `s-liga-clas`/`s-segunda-clas`/`s-primf-clas`
   (EXACTAMENTE las 3 competiciones del reporte) — pedía
   `/api/liga-ext/<slug>` cuando el localStorage local venía vacío.
   También su "Fuente B" (busca el mismo nombre en otras ligas
   conocidas, incluidas estas 3) usaba el mismo endpoint pelado.
2. **`window.emergencyRestore(slug)`** (herramienta de consola,
   "RECUPERACIÓN DE EMERGENCIA") — su paso 2 ("Intentar desde
   servidor") pedía el endpoint pelado.
3. **`_lextFetchServerSync` / `window.lextDeepRecoverSlug` /
   `lextDeepRecoverAll`** ("DEEP RECOVERY", la herramienta de consola
   más exhaustiva, con 6 fuentes) — su fuente Nº1 ("Servidor") pedía
   el endpoint pelado.

Las 3 son, literalmente, las herramientas que existen para este
escenario exacto — y las 3 se rendían justo antes de mirar la única
copia que probablemente seguía teniendo el dato.

### Fix

Los 4 fetches se cambian de `/api/liga-ext/<slug>` a
`/api/liga-ext-any/<slug>` (mismo formato de respuesta, `resp.data`),
para que el primer clic en un equipo — o cualquiera de las 2
herramientas de consola — recupere automáticamente desde `_protected`
si el `main` viene vacío, sin que el admin tenga que hacer nada
especial.

### Reglas a respetar

1. **PROHIBIDO** que un fetch nuevo de lectura de `ligaExt_<slug>`
   (handler de clic, herramienta de recuperación, o cualquier ruta
   futura) use `/api/liga-ext/<slug>` pelado cuando el propósito es
   "recuperar/mostrar la plantilla real". Usar SIEMPRE
   `/api/liga-ext-any/<slug>` (o `window._lextFetchJsonTimeout`/
   `_lextClickFetchJson` apuntando a ese endpoint) — es el único que
   resuelve el fallback a `_protected` en el servidor.
2. **PROHIBIDO** que una herramienta con el nombre "recuperación de
   emergencia" / "deep recovery" tenga MENOS cobertura de fuentes que
   el flujo normal de apertura de pantalla (`loadData`/`fetchData`,
   que ya usa `_lxAnyFallback` desde 2026-07-18). Si `loadData` mira
   `_protected`, toda herramienta de recuperación manual también debe
   mirarlo — si no, el admin puede acabar "confirmando" una pérdida de
   datos que en realidad no existe.
3. `/api/liga-ext/<slug>` (pelado) sigue siendo válido para las
   escrituras (`POST`) y para cualquier lectura donde "main vacío" es
   una respuesta legítima y no hay nada que recuperar (p.ej. comprobar
   si el admin ya guardó algo en una liga nueva). El problema es
   usarlo como ÚNICA fuente en un flujo de recuperación/visualización.

## Un club IA con el MISMO NOMBRE que un club humano le robaba el escudo y la plantilla — desempate por `isHuman`, nunca solo por "riqueza" (obligatorio, 2026-07-29)

**Bug (usuario 2026-07-29): «el Arsenal en la caja principal
Arsenal-Brasil-Álvaro no tiene su escudo verdadero / y la plantilla
dentro de la caja Arsenal no aparece y tiene que aparecer»**. La caja
del menú EQUIPOS mostraba un escudo ajeno y la pantalla 👕 PLANTILLA
del hub salía con el roster equivocado.

### Causa raíz — DOS índices por NOMBRE, y hay homónimos IA

En «Resto de Ligas» existen clubes IA cuyo nombre coincide
EXACTAMENTE con el de un club humano: **Arsenal** (FK Arsenal Tivat,
Montenegro · Арсенал/Arsenal Dzerzhinsk, Bielorrusia), **Inter**, etc.
Los dos sitios que resuelven identidad por nombre se los tragaban:

1. **Escudo — `refreshLigaEaShields`** (`misc_body_1.html`) construye
   `window._ligaEaShields[nombre] → escudo` con «primero en llegar
   gana», escaneando `liga-ea-sports` primero y luego TODAS las
   `ligaExt_*` en orden alfabético. La fila humana del Arsenal **no
   tiene `shield` guardado** (su escudo va hardcoded en el HTML de la
   caja y en `_CANON_CLUB_CREST`), así que el nombre quedaba libre y
   se lo llevaba el primer IA homónimo. Luego `applyOverride` (la
   función que aplica el override de `menu_home_v1` a cada caja del
   menú) hacía `getTeamLogoUrl(o.label)` y **pintaba ese escudo ENCIMA
   del correcto** que ya traía el HTML.
2. **Plantilla — `_findRichestHubRow`**: casa por nombre normalizado y
   elegía por `_hubRowRichness` (Σ `pj+gol+pen+fk` de `t.players[]`).
   Un IA homónimo juega su liga entera y acumula cientos de partidos;
   la plantilla REAL de un club humano **no guarda `pj`/`gol` dentro
   de `t.players[]`** (esas stats viven aparte, en
   `ef_player_stats_*`) → su riqueza es **0** y PERDÍA SIEMPRE.

Reproducido en Chromium real (CDP) con la colisión sembrada:
antes → `getTeamLogoUrl('Arsenal') = /dzerzhinsk.png` y la plantilla
con 22 filas del Tivat; después → escudo real del Arsenal y las 24
filas del roster humano.

### Fix

- **`refreshLigaEaShields`**: PRE-PASADA que anota qué nombres tienen
  fila `isHuman` (y cuáles de ellas traen `shield`). Un nombre
  «reclamado» por una fila humana solo lo puede escribir otra fila
  humana. Si NINGUNA fila humana de ese nombre trae escudo, se siembra
  con `window._canonClubCrestFor(nombre)` y el nombre queda reclamado
  igualmente. Si el admin SÍ guardó un escudo en una fila humana, ese
  gana (la edición del admin manda sobre el canónico).
- **`window._canonClubCrestFor(name)`** (nuevo): expone el mapa
  canónico `_PS_CANON_CREST` (el mismo que ya usaban el hub y la
  plantilla) para que cualquier pantalla que pinte el escudo de un
  club humano tenga la fuente autoritativa. Lo consultan ANTES que
  `getTeamLogoUrl`: `applyOverride`, `syncHubCard` y `buildAdded`
  (cajas añadidas a mano).
- **`_findRichestHubRow`**: el desempate pasa a ser una tupla
  lexicográfica `[tiene jugadores, isHuman, fila real (no genérica),
  riqueza, es liga-ea-sports]`.

### Reglas a respetar

1. **PROHIBIDO** que `refreshLigaEaShields` (o cualquier índice
   nombre→identidad nuevo) vuelva al «primero en llegar gana» a secas.
   Si un nombre tiene fila `isHuman`, solo las filas humanas (o el
   escudo canónico) pueden escribirlo.
2. **PROHIBIDO** usar `window._isHumanClubCanonico` como filtro en ese
   índice: hace match **LAXO por substring**, así que
   `_isHumanClubCanonico('FK Arsenal Tivat')` da `true` y bloquearía
   el escudo PROPIO del Tivat. La comprobación tiene que ser por
   nombre EXACTO (la pre-pasada).
3. **PROHIBIDO** que un pintor de escudo de la caja de un club humano
   (`applyOverride`, `syncHubCard`, `buildAdded`, o cualquiera nuevo)
   consulte `getTeamLogoUrl` **antes** que `_canonClubCrestFor`: esa
   función resuelve por nombre y puede devolver el escudo de un
   homónimo IA.
4. **PROHIBIDO** que `_findRichestHubRow` decida solo por
   `_hubRowRichness`, y **PROHIBIDO** subir `isHuman` por encima de
   «tiene jugadores» (una fila humana vacía —duplicado en
   `liga-ea-sports` de un club que juega en su liga doméstica, caso
   PSG/Izan 2026-06-29— dejaría la plantilla en blanco para siempre).
5. Toda caja de mister NUEVA hereda los 3 arreglos automáticamente
   (son genéricos vía `isHuman` + el registro `MISTERS_HUMANOS`; no
   hardcodean Arsenal). Si se añade un 8º mister, basta con meter su
   club en `_PS_CANON_CREST`/`_CANON_CLUB_CREST` para que su caja
   tenga escudo canónico.

## Lentitud entre pantallas: escritura de `textContent` NO idempotente + `MutationObserver` que barre TODO el documento (obligatorio, 2026-07-29)

**Bug (usuario 2026-07-29, tras arreglar el cuelgue de arranque): «se
abre, pero entre pantalla y pantalla va lento»**. Diagnosticado con
perfil de CPU real (Chromium + CDP) navegando 10 veces entre pantallas.

### 1. `apply()` del HUD se re-disparaba a sí mismo en BUCLE INFINITO

Asignar `textContent` **sustituye el nodo de texto SIEMPRE**, aunque la
cadena sea idéntica → el navegador emite una mutación igualmente. Los
observers del HUD (`setupObservers`) vigilan exactamente los nodos que
`apply()` escribe y reprograman `setTimeout(apply, 0)` en cada mutación.
El guard `applying` NO protege: cuando ese timeout corre, `applying` ya
volvió a `false`. Resultado: `apply → muta → apply → muta…` sin parar,
con el hilo principal ocupado de fondo TODA la sesión.
Medido: **3,2 s de 9,8 s (33 %)** — el mayor consumidor tras arreglar el
arranque. **Fix**: helper `_setTxt(el, val)` que escribe solo si el
valor CAMBIA; la 2ª pasada no muta nada y el ciclo se corta solo.
Tras el fix la CPU queda **79 % OCIOSA** al navegar (antes ~8 %).

### 2. Dos `MutationObserver` con `subtree:true` barrían el documento ENTERO

- `purgeGooool` (`templates/index.html`): `document.querySelectorAll(
  '.ml-goal-flash-inner')` sobre ~7 MB de DOM en CADA mutación.
  Medido en el arranque: **13,2 s (24 %)**.
- `attachObserver` (`static/js/goal-notification-patch.js`):
  `document.querySelectorAll('[id^="ml-acta-list-"]')` en CADA mutación
  — y con un selector de PREFIJO DE ATRIBUTO, de los más lentos que hay
  (sin índice posible, recorre todos los nodos comparando cadenas).
  Medido al navegar: el mayor consumidor (~52 ms por cambio de pantalla
  en escritorio; en móvil se multiplica).

**Fix (ambos)**: el observer YA recibe QUÉ nodos se añadieron — basta
comprobar esos (`records[].addedNodes`, con `matches()` + un
`querySelectorAll` acotado al subárbol añadido). Mismo efecto, coste
proporcional a lo que CAMBIA en vez de a lo que EXISTE.

### 3. `_smallTarget` (HUD) hacía `document.querySelector` en cada llamada

Dos barridos del documento entero por cada `apply()`. Los nodos del HUD
son estáticos → se cachean con revalidación por `isConnected`.
Medido: de **10,2 s (18 %)** en el arranque a **14 ms**.

### Reglas a respetar

1. **PROHIBIDO** que un `MutationObserver` con `subtree:true` sobre
   `document.body` (o cualquier raíz grande) responda haciendo un
   `querySelector*` sobre TODO el documento. Se inspeccionan los
   `addedNodes` del propio registro de mutaciones. Si de verdad hace
   falta un barrido global, va DEBOUNCED (patrón `if(pend) return;
   setTimeout(...)`, ya usado en varios sitios del proyecto), nunca por
   mutación.
2. **PROHIBIDO** escribir `textContent`/`innerHTML` sin comprobar antes
   si el valor CAMBIA, cuando ese mismo nodo está vigilado por un
   `MutationObserver` que puede volver a disparar al escritor. Un guard
   tipo `applying` NO basta si la re-entrada es diferida
   (`setTimeout`), porque el flag ya se liberó.
3. **PROHIBIDO** resolver por `document.querySelector` en cada llamada
   un nodo ESTÁTICO que se consulta muchas veces por segundo. Cachear
   con revalidación (`isConnected`).
4. El coste de estos patrones es proporcional al tamaño del DOM, y el
   de este proyecto ronda los **7 MB**: lo que en un escritorio son
   decenas de ms, en el móvil del usuario son segundos.

## `applyEngineOverrides` ⇄ `sqFromRegistryFull`: recursión mutua que colgaba la web PARA SIEMPRE — guarda de reentrada obligatoria (obligatorio, 2026-07-29)

**Bug (docenas de capturas usuario 2026-07-29: «no abre la web» →
«se congela al pulsar cualquier caja», también en incógnito y tras
borrar todos los datos de navegación)**: el hilo principal quedaba
bloqueado indefinidamente. La web *parecía* abrir —la cortina CSS del
splash la destapa desde el compositor— pero no respondía a NINGÚN
toque, ni siquiera a un listener de `pointerdown` en fase de captura
sobre `document` (por eso ni el rastro del toque llegaba a escribirse).

### Causa raíz — reproducida en navegador real, pila capturada

Reproducido en Chromium headless vía CDP sirviendo el HTML renderizado
+ un backend stub con volumen de datos realista, y **pausando el hilo
bloqueado** (`Debugger.pause`) para leer la pila:

```
applyEngineOverrides()                    (misc_body_1.html)
  → _lextRefreshJ1Pickers()               (paso 6 de applyEngineOverrides)
    → sqFromRegistryFull(equipo)          ×20 (los 2 equipos de los 10
                                           partidos de LIGA_SCHEDULE[0])
      → si el equipo NO está en SQUAD_REGISTRY, el BUNDLE
        (`index.bundle.js`, dentro de `sqFromRegistryFull`) llama a
        `window.applyEngineOverrides()` para intentar poblarlo
          → applyEngineOverrides()  … y vuelta a empezar
```

No es solo recursión: **RAMIFICA ×20 en cada vuelta**, así que crece de
forma explosiva y ni siquiera desborda la pila rápido — cada nivel hace
trabajo pesado real (`refreshLigaEaShields` escanea todas las ligas,
`_importOtherLeaguesIntoEngine`, etc.). **Basta UN equipo del calendario
sin plantilla resoluble** para dejar el hilo bloqueado para siempre.

### Fix

Guarda de reentrada en `applyEngineOverrides` (el chokepoint): si ya
está corriendo, la llamada anidada es un no-op inmediato. La reentrada
es SIEMPRE redundante — para cuando corre el paso 6, el paso 4
(`_importOtherLeaguesIntoEngine`) ya pobló el registro, así que volver a
entrar no puede aportar nada. El cuerpo se movió a
`_applyEngineOverridesBody()` y el flag se libera en un `finally`.

Verificado con el mismo arnés: antes, hilo bloqueado desde t≈2 s y sin
recuperación en 2,5 min; después, arranque completo, splash cerrado a
t≈3,7 s y app respondiendo.

### Reglas a respetar

1. **PROHIBIDO** quitar la guarda `window._engineOverridesRunning` o
   moverla dentro del cuerpo: tiene que ser lo PRIMERO de
   `applyEngineOverrides`, y el flag debe liberarse en un `finally`
   (una excepción no puede dejarlo bloqueado el resto de la sesión).
2. **PROHIBIDO** que `sqFromRegistryFull`/`sqFromRegistry` (o cualquier
   resolutor de plantilla nuevo) llame a `applyEngineOverrides` sin que
   exista esa guarda. El fallback del bundle («si no está en el
   registro, dispara applyEngineOverrides») es legítimo, pero SOLO es
   seguro con la guarda puesta.
3. Cuando la web «no responde al tocar» y ni un listener de captura
   sobre `document` deja rastro, el hilo ya estaba bloqueado ANTES del
   toque: buscar un bucle/recursión en el ARRANQUE, no en el handler de
   la pantalla que se intentaba abrir. La vía más rápida para
   identificarlo es reproducir en Chromium vía CDP y hacer
   `Debugger.pause` sobre el hilo bloqueado para leer la pila.

## `_lsSetSafe` con la cuota AGOTADA no puede costar O(claves × tamaño) por llamada — congelaba el hilo durante MINUTOS (obligatorio, 2026-07-29)

**Bug (muchas capturas usuario 2026-07-29, «no abre la web» → luego «se
congela al pulsar cualquier caja»)**: la web tardaba minutos en abrir o
no abría; una vez abierta, tocar CUALQUIER caja del menú la dejaba
congelada sin recuperación. Pasaba también en incógnito.

### Causa raíz — el limpiador de cuota reintentaba un valor multi-MB tras CADA borrado

`_freeAndRetry` (dentro de `_lsSetSafe`, `misc_body_1.html`) reintentaba
el `setItem` **después de cada `removeItem` individual**. Con el almacén
lleno y ~50 claves `_protected` que expulsar, eso son ~100 intentos de
escribir de nuevo el MISMO valor — y esos valores son plantillas de liga
completas, de VARIOS MEGAS. Un `setItem` fallido de ese tamaño no es
gratis: el navegador serializa y comprueba cuota antes de rechazarlo.

El multiplicador: `_lextRestoreAllFromServer` llama a `_lsSetSafe` para
las ~54 ligas seguidas, y **no había ningún pestillo** — cada liga
repetía el ciclo COMPLETO (escaneo íntegro del almacén incluido) aunque
la anterior ya hubiera demostrado que no cabe nada más. Medido en
aislado con el escenario del usuario (almacén lleno + 54 ligas de 2 MB):
**127 intentos de escritura y 254 MB serializados**. En un móvil eso son
minutos de hilo principal bloqueado.

Por eso «se congela al pulsar cualquier caja»: el hilo YA estaba
bloqueado antes del toque — ni siquiera llegaba a ejecutarse un listener
de `pointerdown` registrado en fase de captura sobre `document`. La web
"abría" solo porque la cortina CSS del splash la destapa desde el
compositor (ver sección del splash), no porque estuviera lista.

Agravante en bucle: la expulsión borra `_protected` de OTRAS ligas → en
el siguiente arranque esas ligas faltan → se dispara otra vez la
restauración masiva → vuelve a expulsar. Se repite en cada sesión.

### Fix

- **Reintento por LOTES, no por borrado**: mismo orden y mismo resultado
  de expulsión, pero los reintentos bajan de ~100 a ~5. Las categorías
  100% reconstruibles (snapshots, `_backup`, stats) se tiran enteras;
  los `_protected` van en lotes de 10 para no expulsar de más.
- **Pestillo de sesión `window._lsQuotaExhausted`**: una vez agotada la
  cuota, los valores GRANDES (>64 KB) se descartan al instante sin
  volver a intentar nada — su copia durable vive en IndexedDB
  (`_idbKV`, cientos de MB) y en `LIGA_CACHE`. Los valores PEQUEÑOS
  (cursores, banderas, preferencias) se siguen intentando SIEMPRE.
- Medido tras el fix, mismo escenario: **9 intentos y 18 MB** (25× menos
  trabajo). Verificado además que, cuando SÍ hay espacio recuperable, el
  guardado sigue teniendo éxito y el pestillo NO se activa.

### Reglas a respetar

1. **PROHIBIDO** que `_freeAndRetry` vuelva a reintentar el `setItem`
   tras CADA `removeItem` individual. El valor que se reintenta puede
   ser multi-MB y el coste se multiplica por el nº de claves a expulsar
   Y por el nº de llamadas (las ~54 ligas de la restauración masiva).
2. **PROHIBIDO** quitar el pestillo `window._lsQuotaExhausted` o hacer
   que los valores grandes lo ignoren. Sin él, cada liga repite el ciclo
   completo de expulsión aunque ya se sepa que no cabe nada.
3. **PROHIBIDO** extender el pestillo a los valores PEQUEÑOS: cursores,
   banderas y preferencias son justo los que necesitan `localStorage` y
   casi siempre caben tras la expulsión. El umbral vive en
   `LARGE_VALUE` (64 KB).
4. Un bloqueo del hilo principal de este tipo es indistinguible de "la
   web no responde al tocar": si un toque no deja ni rastro en un
   listener de captura sobre `document`, el hilo ya estaba bloqueado
   ANTES del toque — buscar la causa en el arranque, no en el handler
   de la pantalla que se intentaba abrir.

## `setLigaSchedule` arma un lock anti-reversión GENÉRICO — mover un equipo fuera de Liga EA Sports ya no "vuelve solo" (obligatorio, 2026-07-28)

**Bug (2 fotos usuario 2026-07-28, «Girona FC»)**: el admin abre "🔀 Mover
equipos" desde Liga EA Sports (mostraba **21 equipos** — un Inter 🐲 de
más, colado como fila "extra" con 0 partidos vía `appendLigaEaExtras`),
tilda **Girona FC** y lo mueve a **Liga Hypermotion**. El editor confirma
el movimiento, pero **al volver a abrir la web, Girona sigue apareciendo
en la Liga EA Sports** — como si el movimiento nunca se hubiera guardado.

### Causa raíz — el mismo bug ya arreglado para el botón 🎲, nunca generalizado

La clasificación y el calendario de Liga EA Sports son **100% derivados
de `window.LIGA_SCHEDULE`** (`ef_liga38_schedule_v2`), NO del roster
`ligaExt_liga-ea-sports.teams[]` directamente — el roster solo alimenta
la regeneración del calendario cuando `applyEngineOverrides()` detecta
que el conjunto de nombres del editor difiere del calendario vigente
(bloque "Motor por PLANTILLA EDITABLE", `misc_body_1.html`). "Mover
equipos" (`lextExecuteMoveTeams`) SÍ persiste el roster (local + POST) Y
llama a `applyEngineOverrides()` después — y con el roster resultante en
EXACTAMENTE 20 (como en este caso: 21 − 1 Girona = 20), el bloque de
sincronización SÍ regenera un `LIGA_SCHEDULE` nuevo sin Girona.

El problema es lo que pasa DESPUÉS de esa regeneración: `setLigaSchedule`
(`part2/misc_body_2.html`) persiste el calendario nuevo con un **POST
suelto, sin reintentos, sin ningún lock** — mientras que el botón
**🎲 Sortear calendario** (`_sortearCalendarioLigaRun`) SÍ arma un lock de
30 s (`window._ligaSorteoLock` + `LS_SORTEO_LOCK_KEY`) y pausa el poll de
5 s (`_pauseLigaStatePoll`) precisamente para que `hydrateLigaStateFromBackend`
—que adopta SIN condiciones cualquier `liga_schedule` del servidor
estructuralmente válido— no revierta el calendario recién guardado con
una respuesta stale. Ese lock **nunca se generalizó** a los demás
callers de `setLigaSchedule` (el propio "Mover equipos" vía
`applyEngineOverrides`, y "🔼 Aplicar EA Sports ↔ Hypermotion"). Si el
POST de estos otros callers se pierde (red móvil, cold-start de
Railway — el escenario más documentado de este proyecto) o si el poll de
5 s gana la carrera antes de que el POST aterrice, el siguiente
poll/hydrate ve el servidor TODAVÍA con el calendario viejo (con Girona)
y lo re-impone — el equipo movido "vuelve a aparecer", exactamente el
mismo bug ya diagnosticado y arreglado para el 🎲, reproducido en los
demás puntos de escritura del calendario.

### Fix

- **`persistSharedLigaState(patch, tries)`** (`part2/misc_body_2.html`):
  ahora reintenta hasta 3 veces con backoff (1.5 s) si el POST falla —
  mismo patrón que el resto del proyecto (`_postClearRetry` y
  equivalentes). Antes era un `fetch` suelto con `.catch(()=>false)`.
- **`saveSchedule(schedule)`**: arma el lock (`window._ligaSorteoLock` +
  `LS_SORTEO_LOCK_KEY`) y pausa el poll (`_pauseLigaStatePoll(20000)`)
  **ANTES** de persistir — **generalizado a TODOS los callers** de
  `setLigaSchedule(..., persist!==false)`, no solo al botón 🎲. Como
  `saveSchedule` es el ÚNICO punto por el que pasa cualquier persistencia
  de calendario "intencional" (el 🎲, el motor editable de
  `applyEngineOverrides`, "Aplicar EA Sports ↔ Hypermotion", y cualquier
  caller futuro), un solo fix en el chokepoint protege a todos sin tener
  que tocar cada call site.
- **`_lcCommit`** (editor de equipos en vista CARDS, `misc_body_1.html`
  — el editor real detrás de "🎴 Editar equipos", usado también por
  "🔀 Mover equipos" al recargar `_LC_STATE`): ahora llama a
  `window.applyEngineOverrides()` inmediatamente después de
  `saveData(...)`, igual que exige la regla ya existente de este
  archivo ("editar un club... tiene que verse EN EL PRÓXIMO PARTIDO").
  Este editor (2026-05-26) se había quedado FUERA de esa regla — antes
  dependía de que otra acción cualquiera disparase `applyEngineOverrides`
  por casualidad para que un alta/baja de equipo se reflejara.
- **`refreshEngineBanner`** (banner de estado del motor, actualmente sin
  nodo DOM que lo muestre — dead code) y **`lextExecuteMoveTeams`**: se
  añade un aviso explícito (`confirm()`) cuando la ORIGEN del movimiento
  es Liga EA Sports y el resultado no deja el roster en EXACTAMENTE 20
  — el calendario de 38 jornadas SOLO se regenera con 20 exactos
  (`generarCalendario` produce `2×(N-1)` jornadas, que solo da 38 con
  N=20); con cualquier otro N la regeneración se descarta en silencio
  (`isValidLigaSchedule` exige `length===38`) y el admin no tenía forma
  de saber que su movimiento no había "entrado en vigor" del todo.

### Reglas a respetar

1. **PROHIBIDO** que un caller nuevo de `setLigaSchedule(...)` persista
   sin pasar por `saveSchedule` (el único punto con lock + reintentos).
   Si se necesita un POST adicional específico (como el
   `/api/state/reset-liga` del botón 🎲, que además limpia resultados),
   es ADEMÁS de `setLigaSchedule`, nunca en sustitución.
2. **PROHIBIDO** que un handler de guardado NUEVO del editor de
   plantilla (equipo, jugador, escudo, alias, valor — cualquier vista,
   incluida la de cards) omita la llamada a `window.applyEngineOverrides()`
   inmediatamente después de `saveData(...)`. Ver regla ya existente
   más abajo ("PRINCIPIO ABSOLUTO: editar un club...") — este fix es la
   generalización de esa regla al editor de cards.
3. **PROHIBIDO** que la regeneración del calendario de Liga EA Sports se
   intente con un roster que no tenga EXACTAMENTE 20 equipos sin avisar
   al admin de por qué "no se aplicó". Un roster de 19 o 21 no es un
   error silencioso más — el admin necesita saber cuántos equipos le
   faltan/sobran para que el cambio tenga efecto real.
4. Si se reintroduce alguna vez una interfaz nueva que module directamente
   `ligaExt_liga-ea-sports.teams[]` (altas, bajas, movimientos entre
   ligas), debe heredar automáticamente esta protección en cuanto llame
   a `saveData(...)` + `applyEngineOverrides()` — no duplicar el lock ni
   los reintentos en el nuevo call site.

## El acta EN VIVO y el mensaje de WhatsApp (descanso/prórroga/FINAL) reparan nombres placeholder al vuelo — no solo la pantalla de IA-vs-IA de Liga (obligatorio, 2026-07-21 #2)

**Bug (4 fotos usuario 2026-07-21, «Torino (IA) 1-3 Arsenal (Álvaro)»,
Trofeo Joan Gamper Jornada 5)**: con Torino confirmado como equipo IA
de "Resto de Ligas · Italia" con plantilla 100% real y años de
estadísticas acumuladas (Franco Israel portero titular, Cristiano
Biraghi, Giovanni Simeone 27 goles…), el mensaje de WhatsApp del FINAL
mostró `72' 🚫⚽ Jugador G (TOR)` y `76' ⚽ Jugador J (TOR)` en vez de los
nombres reales — el mismo síntoma que Young Boys (sección anterior),
pese al prefetch de plantilla ya desplegado.

### Causa raíz — el prefetch reduce el problema, pero un evento YA grabado con placeholder nunca se corregía en el DISPLAY

El prefetch de la sección anterior (`_matchSquadPrefetch`) evita que
LA MAYORÍA de eventos nuevos se graben con placeholder, pero no es
infalible al 100% (cold-start de servidor más lento que el margen de
la previa, o el usuario tocando el picker antes de que resuelva). El
proyecto YA tenía una defensa para exactamente este residuo — pero
**escondida en un solo sitio**: `_iaEventsHtml` (pantalla "Liga · IA vs
IA jornada", `part2/misc_body_2.html`) repara en vivo "Jugador A".."Jugador K"/
"Portero"/"Jugador N" sustituyéndolos por un nombre real de la
plantilla ACTUAL (`sqFromRegistry`) cada vez que se RENDERIZA el acta —
sin tocar `cfg.results` persistido. Ese reparador **nunca se generalizó**
a los otros ~8 sitios del proyecto que también imprimen `e.player`/
`e.name`/`mvpEvt.name` tal cual: el acta EN VIVO del gm-modal
(`_gmEvtRow`, usado en el overlay de DESCANSO y en el de FINAL), el
mensaje de WhatsApp de descanso/prórroga/FINAL (`_gmShareHalfTime`,
`_gmShareHtp`, `_gmShareFinal`, `_waGateActaLines`), su equivalente en
ml-cards (`_mlBuildAndShareWA`, acta + MVP) y el acta/MVP del overlay
post-partido de ml-card (`ml-post-acta`/`ml-post-mvp`). Así, aunque el
prefetch resolviera la plantilla real ANTES del minuto 90 (como pasó
aquí — el editor mostraba la plantilla perfecta al momento), el evento
YA grabado con "Jugador G" se quedaba así PARA SIEMPRE en la vista que
el humano realmente mira y comparte.

### Fix — `window._acFixPlaceholder`, el reparador de `_iaEventsHtml` generalizado

Nuevo helper (`part2/misc_body_2.html`, junto a `_waGateActaLines`):
`window._acFixPlaceholder(rawName, teamSide, home, away, preferGk)`
extrae el MISMO detector/regex que ya usaba `_iaEventsHtml`
(`_isPlaceholderName`, idéntico al de `_bfIsRealName` del backfill
persistente) y el mismo reemplazo (`sqFromRegistry(teamSide==='a'?home:away)`,
priorizando porteros si `preferGk`). Cableado en LOS 8 SITIOS de arriba
— cada uno pasa su propio `e.team`/`home`/`away` en vez de asumir
`m.home`/`m.away` como hacía el original. Es **SOLO DISPLAY**: nunca
reescribe `_gm.events`/`st.events`/`cfg.results` — si la plantilla real
se resuelve DESPUÉS de grabar el evento (el caso normal con el
prefetch ya activo), el humano ve el nombre correcto en el acta visible
y en el texto que comparte por WhatsApp, sin depender de abrir la
pantalla de Estadísticas del torneo.

### Reglas a respetar

1. **PROHIBIDO** que un reparador de placeholder nuevo (o una extensión
   del existente) se quede limitado a una sola pantalla cuando el
   mismo dato (`e.player`/`e.name`/`mvpEvt.name`) se imprime en varios
   sitios del proyecto. Todo builder de acta/resumen/WhatsApp NUEVO que
   imprima un nombre de jugador de un evento debe pasar por
   `window._acFixPlaceholder` en vez de `e.player || e.name || 'Jugador'`
   a pelo.
2. **PROHIBIDO** que `_acFixPlaceholder` reescriba datos persistidos
   (`_gm.events`, `st.events`, `cfg.results`). Es un parche de DISPLAY —
   la corrección persistente para el histórico de estadísticas la sigue
   haciendo `_tourBackfillActasFromResults` (`misc_body_1.html`) al
   abrir la pantalla de Estadísticas del torneo, un mecanismo
   DISTINTO y complementario (uno corrige lo que se ve AHORA, el otro
   lo que queda GUARDADO).
3. Este fix no sustituye al prefetch de la sección anterior — lo
   COMPLEMENTA: el prefetch reduce cuántos eventos se graban con
   placeholder en primer lugar; este repara los que, pese al prefetch,
   se graben así igualmente (picker más rápido que la respuesta del
   servidor, offline momentáneo, etc.).
4. Si un bug futuro reporta "sigue saliendo Jugador X" en un builder de
   acta/WhatsApp que NO esté en la lista de los 8 sitios ya cableados
   (por ejemplo, uno de una competición añadida después de 2026-07-21),
   añadir ahí la misma llamada a `window._acFixPlaceholder` — no crear
   un reparador nuevo ni duplicar el regex.

## PRINCIPIO ABSOLUTO: editar un club o selección (escudo/valor/plantilla) tiene que verse EN EL PRÓXIMO PARTIDO de ese equipo, sin recargar la página (obligatorio, 2026-07-21)

**Petición usuario 2026-07-21** ("es obligatorio que cualquier club o
selección que es editada tanto su escudo, valor, plantilla etc etc esto
funcione en el momento que se cambie esa plantilla... que si ese club o
selección actualizada es la que tiene que salir en el siguiente partido
que juegue ese club o selección con sus jugadores nuevos. no es tan
dificil"). Esto es un PRINCIPIO GENERAL, no un bug puntual — se auditó
la cadena completa de `saveData` (chokepoint único de todo guardado de
`ligaExt_<slug>`, incluida Liga EA Sports) y de `_save`/`_hydrate` de
`selecciones_squad_v1` para verificar qué caches quedan REALMENTE
invalidadas al instante de guardar, y cuáles no.

### Lo que YA funcionaba (verificado, no tocar)

- **Plantilla (roster)**: `sqFromRegistry`/`sqFromRegistryFull` leen de
  `window.SQUAD_REGISTRY[name]`, que `_importOtherLeaguesIntoEngine`
  (misc_body_1.html) **sobreescribe SIN condición** para cualquier
  equipo con `players.length>0` cada vez que corre. `saveData` invalida
  `window.__importLeaguesHash=''` (fuerza el re-scan), y CADA handler
  de guardado real de plantilla (`lextSaveTeam`, `lextSavePlayer`,
  `lextEditPlayer`, `lextDeletePlayer`, `lextTogglePlayerFlag`,
  `lextApplySquadPaste`) llama a `window.applyEngineOverrides()`
  INMEDIATAMENTE después de `saveData(...)` — el roster editado se ve
  en el siguiente partido sin recargar. Selecciones: `_seedSelectionsToRegistry`
  (llamada desde `_hydrate()`, que el editor invoca tras cada `_save`)
  también sobreescribe sin condición.
- **Valor (GLOBAL/ATQ/MED/DEF)**: `computeLineStats` (Resto de Ligas)
  lee siempre los 4 valores manuales frescos de `data.config`/`t.*`
  directamente — sin cache intermedia (regla ya obligatoria desde
  2026-05-02, sección "Nivel + valor del equipo" más abajo). Para el
  MOTOR de simulación, `_teamStats`/`_teamOffense`/`_teamDefense` leen
  `window._LIGA_EA_TEAM_STATS[name]`, que `ligaEaBuildEngineOverrides()`
  **resetea a `{}` por completo** en cada `applyEngineOverrides()` — así
  que cuando `_importOtherLeaguesIntoEngine` corre a continuación (en la
  MISMA llamada) y comprueba `!window._LIGA_EA_TEAM_STATS[name]` antes
  de escribir, ese "si no existe" es sobre un sidecar RECIÉN vaciado, no
  sobre datos viejos — el equipo recién editado SIEMPRE se re-escribe.
  **PRECAUCIÓN** (no tocar sin entender esto primero): esta guarda
  ("solo si no existe") existe para que Liga EA Sports GANE si un equipo
  de Resto de Ligas comparte nombre con uno de los 20 de Liga EA — es
  intencional, no un descuido.

### El hueco REAL encontrado — el escudo (`getLogoEquipo`) no se invalidaba en el guardado LOCAL

`getLogoEquipo` (`part2/misc_body_2.html`) memoiza su resultado por
nombre PARA SIEMPRE en `TEAM_LOGO_CACHE` — es una cache DISTINTA de
`_eurResolveTeamLogo`/`_eurLogoIdxCache` (la del resolutor cross-liga de
la Previa, que `saveData` SÍ invalida desde 2026-07-12 #6 vía
`_eurInvalidateLogoIndex()`). Hasta este fix, `TEAM_LOGO_CACHE` solo se
vaciaba (`_invalidateAllTeamLogos()`) desde `_eurHydrateMissingLeagues`
(hidratación DEL SERVIDOR) — nunca desde un guardado LOCAL del propio
admin. Si un equipo se había consultado ANTES de subirle/cambiarle el
escudo (quedando memoizado con el escudo-default de Estepona, o con el
escudo VIEJO), el admin podía editar y guardar el escudo nuevo y
seguiría viendo el viejo en cards del hub / gm-modal / ml-cards hasta
recargar la página o hasta que una hidratación de servidor NO
relacionada lo invalidara de rebote.

**Fix**: `saveData(k,d)` (misc_body_1.html, el chokepoint único de todo
guardado de `ligaExt_<slug>`) ahora también llama a
`window._invalidateAllTeamLogos()` justo al lado de
`_eurInvalidateLogoIndex()` — mismo patrón, misma ubicación. El
siguiente render de CUALQUIER pantalla (no solo la Previa) ve el
escudo recién guardado al instante.

**Fix menor (consistencia)**: `lextDeleteTeam` guardaba con `saveData`
pero nunca llamaba a `applyEngineOverrides()` después (a diferencia de
TODOS los demás handlers de mutación de la plantilla) — el equipo
borrado quedaba huérfano en `SQUAD_REGISTRY` hasta el próximo boot.
Ahora purga la entrada y re-aplica el motor igual que el resto.

### Reglas a respetar

1. **PROHIBIDO** que un cache nuevo de identidad por equipo (escudo,
   alias, plantilla, estadio, valor, o cualquier campo que el admin
   pueda editar desde CUALQUIER pantalla) se invalide SOLO desde una
   ruta de hidratación DEL SERVIDOR. El guardado LOCAL del propio admin
   es la ruta MÁS COMÚN de cambio — todo cache de este tipo se invalida
   también desde `saveData` (clubes/Liga EA) o desde `_save`/`_hydrate`
   (selecciones), igual que ya hacen `_invalidateAliasCache`,
   `_eurInvalidateLogoIndex` y ahora `_invalidateAllTeamLogos`.
2. **PROHIBIDO** añadir un cache de escudo/plantilla/valor NUEVO sin
   registrar su invalidador en el chokepoint (`saveData`) — auditar
   TODOS los consumidores de identidad de equipo (no asumir que
   invalidar uno solo cubre a los demás; escudo por sí solo YA tiene 2
   caches independientes: `_eurLogoIdxCache` y `TEAM_LOGO_CACHE`).
3. **PROHIBIDO** que un handler de guardado NUEVO del editor de
   plantilla (equipo, jugador, escudo, alias, valor) omita la llamada a
   `window.applyEngineOverrides()` inmediatamente después de
   `saveData(...)`. Todo handler de mutación (crear/editar/borrar
   equipo o jugador, toggle de flags, pegado masivo) lo hereda copiando
   el mismo patrón que `lextSaveTeam`/`lextSavePlayer`/etc.
4. Antes de "arreglar" la guarda `if (!window._LIGA_EA_TEAM_STATS[name])`
   de `_importOtherLeaguesIntoEngine` pensando que bloquea la
   actualización de valores: leer primero que `ligaEaBuildEngineOverrides()`
   resetea ESE MISMO sidecar a `{}` en cada llamada — la guarda opera
   sobre datos recién vaciados, no viejos. Sí existe un margen teórico
   de estar vacío un instante si `applyEngineOverrides()` corre por un
   motivo AJENO al equipo en cuestión (no supone pérdida de datos, solo
   una degradación transitoria de ATK/MID/DEF a un único valor "power"
   hasta el siguiente ciclo) — no se ha tocado por el riesgo de romper
   la protección "Liga EA gana en colisión de nombre" sin entenderla a
   fondo primero.

## La plantilla del rival IA se PREFETCHEA al abrir la previa de CUALQUIER partido humano — ya no depende de ganar la carrera contra el picker (obligatorio, 2026-07-21)

**Bug (5 fotos usuario 2026-07-21, «Young Boys» — Liga Suiza, Torneo de
Verano Joan Gamper J2, Arsenal 0-1 Young Boys)**: con la plantilla del
Young Boys 100% completa y real (confirmado en el editor de "Resto de
Ligas · Suiza", con estadísticas ya acumuladas — Christian Fassnacht 25
goles, Marvin Keller portero titular, etc.), el acta del partido mostró
`78' ⚽ Jugador F (YB)` y `90' 🧤 Portero (YB)` en vez de los nombres
reales. El usuario preguntó explícitamente si esto era exclusivo de
Torneos de Verano o pasaba en todas las competiciones.

### Investigación — es un bug del MOTOR COMPARTIDO, no de una competición

`sqFromRegistry`/`sqFromRegistryFull` (`static/js/index.bundle.js`) —
las funciones que resuelven la plantilla de CUALQUIER equipo para
CUALQUIER competición (picker "+ AÑADIR EVENTO" vía `_gmGetSquad`,
auto-pick del portero en la portería imbatida vía `_getTopGk`, MVP,
`genMatchEventsEnhanced`…) — solo escanean lo que ESTE dispositivo tenga
cacheado LOCALMENTE (`localStorage['ligaExt_*']` + `window.LIGA_CACHE`
en memoria + `selecciones_squad_v1`). Si el rival IA pertenece a una
liga que este dispositivo no ha abierto todavía en la sesión (aquí,
Suiza — el usuario entró directo al Torneo de Verano sin pasar antes
por "Resto de Ligas · Suiza"), la búsqueda local no encuentra nada y:

1. **El picker de eventos** (`_gmGetSquad`/`_gmRenderPlayerPick`) cae al
   roster genérico `_fallbackSq11()` (`Jugador A`.."Jugador K"). Desde
   2026-07-12 #7 existe una búsqueda DIFERIDA en servidor que re-pinta
   el picker si sigue abierto — pero si el usuario toca un nombre ANTES
   de que esa búsqueda resuelva (razonable: el partido real de eFootball
   sigue corriendo en tiempo real), el placeholder queda grabado en el
   acta PARA SIEMPRE. Coincide con `Jugador F` (posición M, entrada nº6
   de `_fallbackSq11`).
2. **El auto-pick del portero IA en la portería imbatida** (`_getTopGk`,
   invocado desde `_ensureImbatEvents`) NO tiene NINGÚN reintento ni
   búsqueda en servidor — es una única llamada SÍNCRONA a
   `sqFromRegistryFull` en el instante de FINALIZAR; si falla, cae
   DIRECTAMENTE y para siempre a `{num:'1', name:'Portero'}` (línea
   108-112 y 322 de `index.bundle.js`), sin ninguna corrección
   posterior. Explica el `90' 🧤 Portero (YB)`.

Ninguno de los 2 puntos es exclusivo de Torneos de Verano: `_gmGetSquad`/
`_getTopGk` son el motor de TODO partido humano vs IA — Liga EA Sports,
Copa del Rey, Supercopa de España, Champions/Europa/Conference,
Recopa, Supercopa de Europa, Intercontinental, Previa Champions,
Selecciones, Mundialito de Clubes, Superliga y amistosos. El bug se
manifiesta más en Torneos de Verano/competiciones europeas porque sus
rivales IA suelen salir de "Resto de Ligas" (53 ligas externas que el
dispositivo rara vez tiene TODAS cacheadas), pero el motor es el mismo
para las 5 canónicas de Liga EA Sports si su rival fuera de fuera.

### Fix — prefetch de plantilla en el chokepoint único `showPrePartidoOverlay`

Mismo principio que `_tourPrefetchMatchAlias` (2026-07-06, el fix
equivalente para el ❓ de alias eFootball): en vez de esperar a que el
picker o el auto-pick de portero necesiten la plantilla, se dispara la
búsqueda en servidor **en el instante en que se abre la previa** — da a
la búsqueda TODO el margen del partido (varios minutos) para resolver
antes de que se necesite.

`window._matchSquadPrefetch(name)` (nuevo, `part2/misc_body_2.html`,
junto al resto de parches post-bundle de `showPrePartidoOverlay`):
si `sqFromRegistry(name)` ya resuelve LOCALMENTE, no hace nada; si no,
llama a `window._eurRetryServerSearch(window._eurTeamSquadServerSearch,
name, ...)` (los mismos 6 intentos/backoff que ya protegen escudo/alias/
plantilla del picker manual, 2026-07-13). Al encontrarlo, el equipo
queda cacheado en `LIGA_CACHE.__server_squad_search__` — la MISMA vía
que ya consume `sqFromRegistry` en su escaneo de `LIGA_CACHE`
(2026-07-06 #6) — así que tanto el picker como `_getTopGk` lo ven sin
ningún camino nuevo que mantener. Cooldown de 15s por nombre para no
repetir un intento fallido reciente (mismo patrón que
`_tourPrefetchMatchAlias`, corrige el bug de "un fallo bloquea el
equipo para siempre" de 2026-07-06 #7: solo un ÉXITO se marca
permanente).

Se cablea envolviendo `window.showPrePartidoOverlay` UNA VEZ (mismo
patrón de parche no-destructivo ya usado en ese archivo para duración/
balón/estadio, guardado con el flag `._sqPrefetchPatched`) — como esa
función es el chokepoint ÚNICO por el que pasa TODO partido humano de
CUALQUIER competición, un solo wrap cubre las 14+ competiciones sin
tocar cada call site. Los nombres de equipo se leen con la MISMA
prioridad que ya usa `_renderPreviaMeta` para pintar la previa:
`window._ppPreviaTeams.home/.away` si están puestos (el caso normal —
Liga, Copa, Torneos, Recopa… TODOS los callers los fijan antes de
llamar a `showPrePartidoOverlay`), si no, lectura del DOM
`mlw-<matchKey> .ml-team-name`.

### Reglas a respetar

1. **PROHIBIDO** que un fix de resolución de plantilla/escudo/alias
   nuevo se limite al picker de eventos (`_gmGetSquad`) sin cubrir
   también el auto-pick de portero (`_getTopGk`/`_ensureImbatEvents`).
   Este último NUNCA reintenta ni busca en servidor por diseño (regla
   2026-07-12 "onDone() SÍNCRONO" — no se puede volver a hacerlo async
   sin reabrir el bug del partido que se congela para siempre) — la
   ÚNICA forma segura de protegerlo es que la plantilla YA esté
   resuelta ANTES de que se invoque, vía el prefetch de esta sección.
2. **PROHIBIDO** que un prefetch nuevo de este tipo (identidad de
   equipo: plantilla, escudo, alias) se cablee call-site por call-site
   en cada competición. `showPrePartidoOverlay` es el chokepoint único
   — todo prefetch de previa nuevo se envuelve ahí (siguiendo el patrón
   `._xxxPatched` ya usado por duración/balón/estadio/alias), nunca
   duplicado en `_tourOpenHumanMatch`/`copaAbrirPrevia`/`abrirEurKo`/etc.
   por separado.
3. **PROHIBIDO** que `_matchSquadPrefetch` marque un fallo del servidor
   como resuelto permanente (mismo bug que ya se corrigió para el alias,
   2026-07-06 #7): solo un ÉXITO se marca `true`; un fallo guarda el
   timestamp y permite reintentar tras el cooldown.
4. Toda competición NUEVA que abra un partido humano vía
   `showPrePartidoOverlay` (siguiendo el patrón `_ppPreviaTeams.home/
   .away` antes de llamarla) hereda el prefetch automáticamente — no
   hace falta cablearlo aparte.
5. Este fix es PREVENTIVO — no corrige retroactivamente actas ya
   grabadas con "Jugador A/B/C…"/"Portero" (como la de este bug
   report). Esas ya cuentan con su propia red de recuperación al abrir
   la pantalla de Estadísticas del torneo (`_tourBackfillActasFromResults`
   + `_bfIsRealName`, que ya reconoce el patrón "Jugador [a-k]"/
   "Portero" — sección "La caja `s-tour-stats` MERGEA SOLA", 2026-06-29 /
   "El backfill RE-HIDRATA el roster GENÉRICO…", 2026-06-30).

### ¿Afecta también a las SELECCIONES nacionales? Sí, mismo motor — pero MENOS expuestas

Un partido humano de Mundial 2032 / Rondas Previas / Rondas Finales
(`spv*`/`sfn*`, `format:'mundial-48'`) usa el MISMO `_tourOpenHumanMatch`
→ `showPrePartidoOverlay` que un Torneo de Verano (confirmado: TODOS los
openers de partido humano —card del hub, calendario, pantalla del
torneo, "PARTIDOS POSPUESTOS"— llaman a `_tourOpenHumanMatch`), así que
el prefetch de esta sección lo cubre igual, SIN cambios de código
adicionales. Pero las selecciones están MENOS expuestas al bug original
porque `selecciones_squad_v1` (a diferencia de las ~53 `ligaExt_<slug>`
fragmentadas de Resto de Ligas, que solo cargan al abrir ESA liga
concreta) se **hidrata/fusiona con el servidor en CADA carga de
página**, incondicionalmente, vía el `_boot()` de la IIFE
`KEY='selecciones_squad_v1'` (`misc_body_1.html` ~58061:
`document.readyState==='loading' ? addEventListener(DOMContentLoaded,
_boot) : _boot()` — corre siempre, sin depender de qué pantalla esté
abierta). Con esto, el escenario "este dispositivo nunca vio esta
plantilla" es mucho más raro para una selección que para una liga
externa — pero NO imposible (arranque en frío/red lenta antes de que
termine ese fetch, o una selección editada en OTRO dispositivo que aún
no ha propagado). Para esos casos, `_matchSquadPrefetch` funciona igual:
el endpoint `/api/team-squad/<nombre>` que consume ya cae a
`selecciones_squad_v1` como ÚLTIMO recurso tras escanear `liga_ext_*`
(`app.py::api_team_squad`), así que una selección sin resolver local
también se repara por la misma vía. **PROHIBIDO** asumir que las
selecciones necesitan su propio prefetch dedicado — comparten el mismo
`showPrePartidoOverlay` y el mismo endpoint server-side.

## Restauración MASIVA de "Resto de Ligas" en UNA sola petición — `/api/liga-ext-bulk` mata la tormenta de ~50 fetches por-liga (obligatorio, 2026-07-23)

**Bug (usuario 2026-07-23, «el 90% de las ligas me sale sin equipos… incluso
República Checa ya no merge / tienes alguna solución en lugar de decirme
cosas que no funcionan?»)**: tras BORRAR los datos de navegación (el
usuario lo hizo muchas veces), el `localStorage` del dispositivo queda
VACÍO, así que CADA liga de "Resto de Ligas" tiene que descargarse del
servidor al abrirla. El patrón observado —"cada vez que abro la web se ven
unas ligas u otras", solo las PRIMERAS ~9 del orden de fetch + las 4
auto-sembradas aparecen— es el síntoma clásico de una TORMENTA de
peticiones: descargar las ~50 ligas de golpe (el auto-hidratador de boot)
satura los 2 workers de gunicorn; solo las que ganan la carrera antes de
que el servidor se sature aparecen, el resto se quedan "sin equipos" para
siempre en ese arranque. El sondeo directo se quedaba «Preguntando…» >2 min
(request encolado tras la tormenta / cold-start de Railway).

### Fix — resolver TODAS las ligas en el SERVIDOR, UNA petición, UNA respuesta

- **Servidor** (`app.py`, `GET /api/liga-ext-bulk`): UNA query
  (`clave LIKE 'liga_ext_%'`) trae todas las filas; resuelve el
  main→`_protected` de CADA liga EN EL SERVIDOR (mismo criterio que
  `/api/liga-ext-any/<slug>`: si el `main` viene con <2 equipos cae al
  snapshot `_protected` monotónico) y devuelve `{ok, count, leagues:{slug:data}}`
  con el roster completo de cada liga con ≥2 equipos. Una sola respuesta,
  cero carreras, cero tormenta.
- **Cliente** (`misc_body_1.html`, `window._lextRestoreAllFromServer`):
  UNA petición a `/api/liga-ext-bulk`; por cada liga cuyo local esté
  VACÍO de equipos, adopta (sanea + `LIGA_CACHE` + `_lsSetSafe` +
  IndexedDB) — NUNCA pisa una copia local ya rica (eso lo sigue
  resolviendo `fetchData`/el merge del servidor). Timeout que NO depende
  de `AbortController` (WebViews viejos sin él dejaban el sondeo colgado
  para siempre en «Preguntando…»): watchdog `setTimeout` + flag `settled`.
- **Disparos**: (1) auto al ARRANCAR una sola vez si faltan ≥ la mitad de
  las ligas esperadas en local (post-borrado-de-datos / móvil nuevo) —
  UNA petición, no la tormenta desactivada; (2) el botón «🔄 RECUPERAR
  DEL SERVIDOR» de la pantalla vacía llama a la bulk primero (recupera
  ESTA liga y todas), y solo si la liga sigue vacía cae al sondeo
  por-liga `/api/liga-ext-any/<slug>` para dar el veredicto exacto
  (servidor con 0 equipos vs fallo de red).

### Reglas a respetar

1. **PROHIBIDO** reactivar el auto-hidratador MASIVO por-liga
   (`_eurAutoHydrateAndRender` en boot/focus/pageshow/visibilitychange —
   desactivado 2026-07-18) sin resolver antes la capacidad del servidor.
   Para restaurar muchas ligas se usa la bulk (UNA petición), nunca ~50
   fetches simultáneos.
2. **PROHIBIDO** que un sondeo/recuperación de la que dependa un
   resultado visible dependa ÚNICAMENTE de `AbortController` para su
   timeout: un WebView sin él deja el spinner colgado para siempre.
   Watchdog `setTimeout` + `settled` independiente SIEMPRE.
3. **PROHIBIDO** que `_lextRestoreAllFromServer` pise una copia local con
   equipos: solo adopta ligas VACÍAS en local. El merge de copias ricas
   sigue siendo de `fetchData`/`_lx_merge_teams`.
4. Toda liga NUEVA aparece en la bulk automáticamente (la query es
   `liga_ext_%`); no hay lista hardcodeada.

## `fetchData` recupera el snapshot `_protected` del servidor cuando el `main` viene VACÍO — regresión que dejó el 90% de "Resto de Ligas" sin equipos (obligatorio, 2026-07-18)

**Bug (foto usuario 2026-07-18, «Israeli Premier League» + «el 90% de
las ligas me sale sin equipos, pero realmente están el 100% de los
equipos… cuando siempre se han visto»)**: al abrir casi cualquier liga
de "Resto de Ligas" en un dispositivo sin la liga cacheada localmente,
la pantalla `s-liga-ext` mostraba «No hay equipos. Usa 🖍 Editar para
añadir clubes.» pese a que el roster completo seguía existiendo en el
servidor.

### Causa raíz — la conversión a hidratación async (2026-07-13) perdió el fallback a `_protected`

Hasta el 2026-07-13, `loadData` hacía un XHR SÍNCRONO que, cuando el
`main` de la liga en el servidor (`/api/liga-ext/<slug>`) venía VACÍO,
caía como "última esperanza" a `/api/liga-ext-protected/<slug>` (el
snapshot MONOTÓNICO por nº de jugadores, que NUNCA encoge). El commit
`d7ef9e0` eliminó todo XHR síncrono y movió la hidratación a
`fetchData` (async, en segundo plano) — pero `fetchData` SOLO consulta
`/api/liga-ext/<slug>` (`main`) y **nunca** cayó al snapshot
`_protected`. Así, cualquier liga cuyo `main` en el servidor se hubiera
regresado a vacío por un guardado CONCURRENTE de otro dispositivo
(escenario frecuente y ya documentado con varios móviles + PC) mostraba
"No hay equipos" PARA SIEMPRE, aunque el `_protected` del servidor
conservara el roster completo. Antes de 2026-07-13 el XHR síncrono lo
restauraba; después, nada lo hacía.

### Fix

`fetchData` (`templates/partials/misc_body_1.html`): cuando el `main`
del servidor viene VACÍO (0 equipos, o 304/error) **Y** el local
(cache/localStorage) también está vacío de equipos (`_lxCacheEmpty()`),
cae a `/api/liga-ext-any/<slug>` (`_lxAnyFallback()`) — el endpoint que
resuelve main→protected EN EL SERVIDOR en UNA sola petición (existe
desde 2026-07-07). Si trae equipos, los sanea + backfillea identidad
(escudos/roster/logo/alias/resultados) desde lo local, cachea, persiste
y re-pinta. Solo actúa cuando NO hay nada local que proteger — el resto
de casos los sigue cubriendo el anti-wipe. Como es en `fetchData`, los
caminos de hidratación que pasan por él (bg-hydrate de `loadData`,
`openLigaExt`) heredan el fallback sin duplicar lógica ni carreras de
doble fetch.

**Ampliación mismo día (fotos «faltan todos los equipos desde República
Checa hasta San Marino… pero en la última foto [overlay Equipos por
competición] están todos»)**: el auto-hidratador de boot
`_eurHydrateMissingLeagues` (que corre en boot/focus/pageshow vía
`_eurAutoHydrateAndRender` y rellena TODAS las ligas que faltan en este
dispositivo) tenía su PROPIO `fetch('/api/liga-ext/<slug>')` (main), NO
pasaba por `fetchData`, así que también se saltaba el `_protected`. Se
cambió a `/api/liga-ext-any/<slug>` → ahora en cada arranque recupera de
golpe TODAS las ligas cuyo main del servidor esté vacío, sin que el
usuario abra cada una. Tras rellenar el `localStorage`, la reconciliación
proactiva (`_lextReconcileResultsToServer`) empuja el roster recuperado de
vuelta al `main` del servidor (`needPushRoster`), curándolo para todos los
dispositivos. Si `s-liga-ext` está activa, se re-pinta al instante.

### Reglas a respetar

1. **PROHIBIDO** que `fetchData` (o cualquier hidratación de
   `ligaExt_<slug>` nueva) trate un `main` VACÍO del servidor como
   respuesta definitiva sin caer al snapshot `_protected` cuando el
   local también está vacío. El `main` de una liga puede regresar a
   vacío por un guardado concurrente de otro dispositivo; el snapshot
   `_protected` (monotónico) es la red que conserva el roster.
2. **PROHIBIDO** reintroducir un XHR síncrono para este fallback (regla
   2026-07-13 #4, absoluta): usar `/api/liga-ext-any/<slug>` (fallback
   resuelto en el servidor, una sola petición async).
3. El fallback solo dispara con local VACÍO (`_lxCacheEmpty()`): con
   equipos locales, el anti-wipe manda (no pisar una copia local rica
   con el `main` vacío del servidor).

## El botón 🏁 FINALIZAR (`gm-btn-end`) NUNCA dependió solo del `click` sintético — respaldo táctil obligatorio (obligatorio, 2026-07-17)

**Bug (7 fotos usuario 2026-07-17, «más de 50 intentos… es imposible
finalizar», 3 partidos DISTINTOS del Mundial 2032 — Brasil vs Haití
J1, Brasil vs Escocia J2, Brasil vs Marruecos J3)**: en los 3 partidos,
con el acta completa (goles, portería imbatida, MVP ya elegido), pulsar
🏁 FINALIZAR no producía NADA — ni siquiera aparecía el cuadro
"¿Seguro que quieres finalizar?" (`_mlConfirmEnd`), el primer paso de
toda la cadena. El usuario llevaba semanas reportando este mismo
bloqueo en distintas variantes ("imposible compartir", "imposible
finalizar") pese a docenas de fixes previos en pasos POSTERIORES de la
cadena (imbatida, estadísticas, MVP, WhatsApp — ver secciones de más
abajo).

### Causa raíz — el botón MÁS crítico de la cadena era el ÚNICO sin respaldo táctil

`#gm-btn-end` (el botón FINALIZAR del gm-modal) vive al fondo de una
pantalla que hace scroll (acta de eventos + botones apilados) y
dependía ÚNICAMENTE del atributo `onclick="window._mlConfirmEnd(...)"`
— el evento `click` SINTÉTICO que el navegador solo dispara si
`touchstart`/`touchend` ocurren en el MISMO punto sin movimiento
detectable. Es EXACTAMENTE la misma ambigüedad tap-vs-scroll ya
diagnosticada y arreglada para el selector de portero de la portería
imbatida (`_imbatWireTapFallback`, sección "El decremento…"/"Card
'Próximo partido'" más abajo, 2026-07-04/05): un dedo real con el
mínimo movimiento dentro de un contenedor scrollable hace que el
navegador interprete el toque como intento de scroll y CANCELE el
`click` sintético — sin excepción, sin alert, sin log, indistinguible
de "el botón no reacciona". Ese fix se aplicó al picker de porteros,
al botón Cancelar de ese picker, y a varios overlays más — pero
NUNCA al propio botón FINALIZAR, pese a ser el disparador de TODA la
cadena y el que más se pulsa en cada partido.

### Fix — delegación en `document` con disparo en `touchstart`/`pointerdown`

`templates/partials/part2/misc_body_2.html`, justo tras la definición
de `window._mlConfirmEnd`: un listener delegado en `document` (mismo
patrón que ya usa este archivo para el spinner "Procesando partido…")
detecta un toque sobre `#gm-btn-end` (gm-modal, botón único y
estático) o `ml-btn-end-<mk>` (cards de calendario, uno por partido) y
llama a `_mlConfirmEnd` en el instante `touchstart`/`pointerdown`, sin
esperar al `click` sintético. `_mlConfirmEnd` es idempotente (si el
diálogo ya está abierto, lo recrea) así que no hace falta
`preventDefault` ni un guard complejo — solo un cooldown de 700 ms por
elemento para no crear el overlay 2 veces en el mismo gesto físico
(touchstart + pointerdown + el click normal, si llega, del mismo
toque). Respeta `el.disabled` (no dispara mientras el botón está
deshabilitado por la cadena de gates).

### Reglas a respetar

1. **PROHIBIDO** que `#gm-btn-end` o `ml-btn-end-<mk>` (o cualquier
   botón FINALIZAR nuevo de este tipo) dependa ÚNICAMENTE del `click`
   sintético. Es el botón MÁS crítico de todo el proyecto — el que
   arranca la cadena imbatida→estadísticas→MVP→WhatsApp→fin — y por
   estar al fondo de una pantalla con scroll es el más expuesto a la
   ambigüedad tap-vs-scroll.
2. **PROHIBIDO** quitar el listener delegado de `touchstart`/
   `pointerdown` de FINALIZAR sin sustituirlo por un mecanismo
   equivalente. Es la causa raíz confirmada de "más de 50 intentos sin
   poder finalizar" en 3 partidos distintos — todos los fixes previos
   de esta cadena (documentados en las secciones de abajo) arreglaban
   pasos POSTERIORES que nunca llegaban a dispararse porque el primer
   paso ya fallaba en silencio.
3. Todo botón NUEVO que se añada a esta cadena (imbatida, stats, MVP,
   compartir, o cualquier gate futuro) y que pueda vivir dentro de un
   contenedor con scroll hereda este patrón — no asumir que "ya
   funciona en el emulador/con `.click()`" prueba nada: la ambigüedad
   táctil real solo se reproduce con un dedo de verdad sobre un
   contenedor scrollable.

## Recopa/Supercopa España/Supercopa Europa/Champions-Europa-Conference (fase Y eliminatoria)/Previa Champions NUNCA tenían fusión en servidor — un partido jugado podía perderse en CUALQUIERA de las 7 cajas humanas (obligatorio, 2026-07-17)

**Petición usuario 2026-07-17** (tras el bug de Mundial 2032 de
Arsenal-Brasil-Álvaro, secciones de abajo): "no puede volver a suceder…
quiero que investigues y que el guardado de los partidos sea automático
como el avance en el calendario en los equipos humanos" — para las 7
cajas: Liverpool-Francia-Toñín, Arsenal-Brasil-Álvaro,
Real Madrid-Inglaterra-Acsa, Atlético Madrid-Noruega-Isra,
FC Barcelona-Argentina-Ángel, PSG-España-Izan, Inter-Portugal-Rubén.

### Investigación — el mismo fallo era SISTÉMICO, no exclusivo de Mundial 2032

El bug de Mundial 2032 (ver sección "`_tourLoad` UNE los partidos…" más
abajo) ya estaba cubierto en el servidor por `tour_cfg_merge`
(`sync_merge.py`), que UNE `results` por matchKey en cada POST — el
fallo ahí era puramente de CLIENTE. Al auditar el resto de
competiciones de club se encontró que **7 claves adicionales NUNCA
tuvieron NINGÚN merge, ni en cliente ni en servidor**:
`wprev_state_v1` (Previa Champions), `sc_state_v1` (Supercopa España),
`usc_state_v1` (Supercopa Europa), `recopa_state_v1`,
`ucl_ko_state_v1`/`uel_ko_state_v1`/`uecl_ko_state_v1` (fase
eliminatoria de Champions/Europa/Conference) — viajan como JSON opaco
dentro de `competition_state` (`/api/state`), y `merge_dict` (app.py)
solo recursa en dicts anidados: un valor STRING se sobreescribe
ENTERO. Y `ucl_phase_v1`/`uel_phase_v1`/`uecl_phase_v1` (fase de
grupos), que viajan por `/api/kv/<key>`, tampoco tenían merge alguno
en `api_kv_set` — caían al `else` genérico de sobreescritura total. El
MISMO mecanismo que perdió los 3 partidos de Brasil en Mundial 2032
podía reproducirse en CUALQUIERA de estas 10 competiciones, para
CUALQUIERA de los 7 misters humanos: un POST perdido/tardío + una
hidratación posterior con `competition_state` "más reciente" (de
CUALQUIER otro guardado, no necesariamente de la misma competición)
sustituía el bracket entero, perdiendo en silencio un partido ya
jugado y confirmado.

**Bonus encontrado en la misma auditoría**: `copa_state_merge` (la
fusión anti-pérdida-de-acta de la Copa del Rey, documentada como
"obligatoria" desde 2026-06-06) **NUNCA estaba importada en `app.py`**
— `/api/copa/state_set` la invocaba dentro de un `try/except Exception:
pass` que tragaba el `NameError` en silencio, así que esa protección
llevaba rota (sin dar ningún error visible) desde que se escribió.
Corregido en el mismo `import`.

### Fix — `bracket_state_merge`, unión GENÉRICA y ESTRUCTURAL (sync_merge.py)

En vez de escribir un merge a medida para cada una de las 10
competiciones (7 esquemas de datos distintos: `sorteo:{ronda:[m,...]}`
en Recopa, `semis:[m,m], final:m` en Supercopa España/Europa, brackets
propios de KO europea, fase de grupos con `results{matchKey}`, y la
estructura compuesta de la Previa con `prelim.ties[].legs[]` +
`groups[]` + `fixtures[gi][jornada][idx]`), `bracket_state_merge`
recorre la estructura ESTRUCTURALMENTE, sin necesitar conocer el
esquema exacto de cada una:

- En cualquier punto donde encuentra un dict con pinta de "resultado de
  un partido concreto" (`_looks_like_match`: tiene `played`/`jugado`, o
  marcador numérico en los campos ya usados en todo el proyecto —
  `a`/`b`/`gh`/`ga`/`gl`/`gv`), decide con el MISMO criterio que
  `_pick_result`/`_copa_pick_result` (jugado > no jugado; a igualdad de
  marcador gana el acta; si no, `ua`/`updatedAt` mayor o el entrante).
- **ANTI-FRANKENSTEIN**: si `home`/`away` difieren entre las dos copias
  en la MISMA posición del bracket, NO es el mismo partido — es un
  re-sorteo/rebuild (p. ej. la Final de Supercopa se regenera cuando
  cambia el ganador de una semifinal). En ese caso NO se fusiona: gana
  el entrante, para que un slot recién reseteado a `played:false` NUNCA
  resucite el resultado jugado del emparejamiento ANTERIOR.
- El resto de la estructura (dicts/listas normales: pool, sorteo,
  clasificados, cursores…) se UNE recursivamente sin perder ninguna
  clave de ningún lado; un escalar suelto lo decide el entrante
  (last-write, igual que el resto del proyecto para campos que no son
  resultado de partido).

Tests exhaustivos en `tests/test_sync_merge.py` (unión de 2
dispositivos, anti-Frankenstein de re-sorteo, acta gana a igualdad de
marcador, un `None` entrante no borra un partido jugado, estructura
anidada tipo Previa Champions, campos no-partido siguen siendo
last-write). Ejecutar con `python3 tests/test_sync_merge.py` (stdlib
pura, sin Flask).

**Wiring** (`app.py`): `_STATE_BRACKET_KEYS` (las 7 de
`competition_state`) se fusionan en `save_global_state`, mismo patrón
que `_is_cursor_key`/`_cursor_winner` ya usa para el cursor del día.
Las 3 de `ucl_phase_v1`/`uel_phase_v1`/`uecl_phase_v1` se fusionan en
`api_kv_set` (viajan por `/api/kv/<key>`, no por `competition_state`).

### Reglas a respetar

1. **PROHIBIDO** que una competición NUEVA con estado de
   bracket/fixtures (una 11ª copa, una fase nueva de una competición
   europea, etc.) viaje a `competition_state`/`/api/kv` sin pasar por
   `bracket_state_merge`. Añadir su clave a `_STATE_BRACKET_KEYS`
   (`competition_state`) o a la whitelist explícita de `api_kv_set`
   (`/api/kv`) — NUNCA dejarla caer al `else` de sobreescritura total.
2. **PROHIBIDO** escribir un merge a medida por competición cuando
   `bracket_state_merge` ya cubre el caso genéricamente. Si una
   competición nueva tiene una estructura tan distinta que el detector
   `_looks_like_match` da falsos positivos/negativos, ampliar el
   detector (o los campos que reconoce), no bifurcar la lógica.
3. **PROHIBIDO** quitar el guard ANTI-FRANKENSTEIN (`_match_identity` /
   comparación `home`/`away`) de `_pick_match`. Sin él, un re-sorteo de
   cualquiera de estas competiciones podría resucitar el resultado
   jugado del emparejamiento ANTERIOR en la misma posición del bracket.
4. **PROHIBIDO** que `copa_state_merge` (o cualquier función de
   `sync_merge.py` usada en `app.py`) se invoque sin estar en el
   `from sync_merge import (...)` del principio del archivo — el
   `try/except Exception: pass` que envuelve su uso TRAGA el
   `NameError` en silencio, exactamente el bug que dejó esta protección
   rota sin que nadie lo notara.
5. **Esto NO sustituye la protección del lado CLIENTE** (que sigue
   pendiente para estas 10 claves, ver limitación documentada en la
   sección "`_tourLoad` UNE los partidos…" — el cliente aún puede
   perder un partido si SU PROPIO POST nunca llegó a confirmarse en
   NINGÚN intento). El servidor ahora garantiza que, una vez un partido
   llega a CUALQUIER dispositivo con éxito, ningún otro POST puede
   volver a perderlo — que es la mayoría de los casos reales (POST
   tardío, no perdido del todo).

## El cursor del calendario del hub AVANZA SOLO — SOLO hacia adelante, SOLO sobre partidos de selección YA jugados (obligatorio, 2026-07-17) ⚠️ REESCRIBE PARCIALMENTE la regla 4 de "Card 'Próximo partido' del hub" (2026-05-27)

**Petición usuario 2026-07-17** (2 fotos, «Arsenal-Brasil-Álvaro»): tras
jugar y confirmar los 3 partidos del Grupo C del Mundial 2032 (J1 03
May, J2 07 May, J3 11 May — el mismo caso de la sección anterior), la
caja del hub seguía mostrando **"01 MAY · Día de Descanso · CONTINUAR"**
— antes incluso de la primera jornada. "Mínimo después de haber jugado
los 3 partidos del Grupo debería estar en la fecha 12 de Mayo."

### Causa raíz — `d.dayIdx` SOLO avanza con CONTINUAR, nunca por jugar el partido

El cursor del calendario de cada hub (`d.dayIdx`, clave
`liverpool_preseason_v1[_<hubId>]`) **solo** se mueve vía `_advance()` →
`_markDoneAndAdvance()`, cableado a los botones CONTINUAR de la propia
card del hub. El usuario jugó los 3 partidos **entrando directo a la
pantalla "Mundial 2032"** desde el menú de competiciones, sin pasar
NUNCA por la card "Próximo partido" del hub Arsenal-Brasil — así que
`d.dayIdx` nunca se enteró de que pasaron 3 jornadas. `_psCursorHeal`
(el self-heal existente) **NO** repara esto: desde el rewrite
2026-06-30 ("el cursor NUNCA RETROCEDE") archiva en POSPUESTOS los
partidos de selección sin jugar que quedaron detrás del cursor, pero
**jamás mueve `d.dayIdx`** (ni adelante ni atrás) — y si `curIdx===0`
ni siquiera llega a intentarlo (`return` inmediato).

### Por qué esto SÍ se implementa pese a la regla previa "PROHIBIDO auto-avance"

La sección "Card 'Próximo partido' del hub" (2026-05-27, regla 4)
prohíbe el "auto-avance del cursor al jugar el partido" — pero esa
regla nació para evitar usar el ESTADO DE UNA COMPETICIÓN (cursores
internos tipo `cfg.currentJornadaByGroup`/`koCurrentRound`) como
sustituto de leer el CALENDARIO para decidir QUÉ partido mostrar en un
día — no para prohibir que `d.dayIdx` (el puntero de qué día es HOY en
el calendario del hub) se autocorrija hacia adelante cuando es un
HECHO objetivo que el día ya está resuelto. Se le preguntó
explícitamente al usuario (dado que toca la misma zona del bug "letal"
de 2026-06-30, donde un self-heal anterior arrastraba el cursor HACIA
ATRÁS y obligaba a re-simular/re-entrenar días ya superados) y **eligió
la opción de auto-heal hacia adelante, con las 2 salvaguardas**
(nunca retrocede, nunca salta Descanso/Entrenamiento).

### Fix — `_psCursorAdvancePastPlayed()`

Nueva función (`misc_body_1.html`, junto a `_psCursorHeal`): desde
`d.dayIdx`, mientras la fila del calendario sea un día de PARTIDO
(selección `ag-sel`, o club `row.type==='match'`: Liga EA Sports, Copa
del Rey, Recopa, Supercopa España/Europa, Champions/Europa/Conference
fase de grupos y eliminatoria, Previa Champions) cuyo resultado ya está
confirmado `played`, avanza el cursor +1 y repite. Se **detiene** en el
primer día que no cumpla la condición — un partido pendiente,
eliminado, sin resolver, un día que ningún resolver reconoce, o un día
de Descanso/Entrenamiento, corta el avance ahí mismo, sin tocarlo.
Llamada desde `_bootStage` (antes de `_psCursorHeal`, para que el
self-heal de POSPUESTOS opere ya sobre el cursor corregido) y desde el
listener de `hubchange` (cada caja humana se autocorrige al activarse).

**AMPLIACIÓN el mismo día (petición usuario "que no vuelva a suceder…
en todos los equipos humanos")**: el scope inicial (SOLO selección) se
amplió a partidos de CLUB reutilizando los MISMOS resolvers que ya usa
`_cardNonTour` para pintar la card (`_copaRondaFromLabel`+
`_copaHubResolve`, `_recopaHubResolve`, `_scHubResolve`,
`_uscHubResolve`, `_eurKoHubResolve`, `_eurHubResolve`,
`_wprevHubResolve`, `_resolveHubLigaMatch`+`loadResults()`) — todos
funciones PURAS por `label` (sin depender del cursor ambiente), así que
es seguro llamarlas especulativamente para días futuros. **NO** cubre
Torneos de Verano ni Mundialito de Clubes (`_realPair`, que lee el
cursor AMBIENTE en vez de recibir el día como parámetro — su guardado
YA es fiable vía `_tourMergeMissingLocalResults`, solo el auto-avance
del calendario queda pendiente si se pide explícitamente en el futuro).

### Reglas a respetar

1. **PROHIBIDO** que `_psCursorAdvancePastPlayed` mueva el cursor HACIA
   ATRÁS bajo ninguna circunstancia — es exactamente el bug "letal" de
   2026-06-30 que motivó que `_psCursorHeal` dejara de tocar el cursor.
2. **PROHIBIDO** que salte un día `ag-rest`/`ag-train` (Descanso/
   Entrenamiento): ahí se sortean lesiones y requieren pulsar
   CONTINUAR/ENTRENAR a mano. El auto-avance es EXCLUSIVO de días de
   PARTIDO (`ag-sel` o `row.type==='match'`) ya confirmados `played`.
3. **PROHIBIDO** que avance sobre un partido `pending` (rival TBD) o
   `eliminated`: esos casos los sigue gestionando `_psCursorHeal`
   (POSPUESTOS), nunca el auto-avance. `_psClubDayPlayed` devuelve
   `false`/`null` (nunca `true`) en cualquier caso ambiguo — el loop
   SOLO avanza con `=== true` explícito.
4. **PROHIBIDO** extenderlo a Torneos de Verano/Mundialito (`_realPair`)
   sin resolver antes su acoplamiento al cursor ambiente — ver nota de
   ALCANCE arriba.
5. Toda caja de mister NUEVA hereda el auto-avance automáticamente (la
   función es genérica por hub vía `_load`/`_calRows`/`_selPair`/los
   `*HubResolve`, no hardcodea ningún club/selección/mister).

## `_tourLoad` UNE los partidos jugados que solo existen en LOCAL — un POST perdido del humano ya no se pierde al llegar una hidratación más reciente (obligatorio, 2026-07-17)

**Petición usuario 2026-07-17** (3 fotos, «Arsenal-Brasil-Álvaro»,
Mundial 2032 · Grupo C): el usuario jugó y compartió el acta completa
de los 3 partidos de Brasil (J1 3-0 Escocia, J2 2-2 Haití, J3 1-0
Marruecos — con eventos, estadísticas y MVP), pero al volver a la
clasificación **Brasil sale a 0 PJ / 0 PTS** mientras los OTROS 3
equipos del grupo (Haití, Escocia, Marruecos) sí muestran sus 2 PJ
(los 3 partidos IA-vs-IA entre ellos en FIN). Los 3 partidos del
HUMANO, en las 3 jornadas, volvieron a "PREVIA" (sin jugar) pese al
acta ya compartida — mientras el partido IA-vs-IA de esa MISMA
jornada sí quedó guardado.

### Causa raíz — `_tourLoad` sustituye `cfg.results` ENTERO por el del servidor, sin unir lo que solo existe en local

`window._tourSaveHumanResult` (misc_body_1.html) persiste el resultado
del humano vía `_tourSave`, que además del `localStorage.setItem`
SÍNCRONO hace un POST al servidor con un timeout DURO de 8 s
(`AbortController`, `misc_body_1.html:25811-25823`) — en red móvil ese
POST puede fallar/timeout SIN que el dispositivo se entere (el
`localStorage` local ya quedó bien, así que el partido se ve "jugado"
en ESE dispositivo). El servidor (`tour_cfg_merge`, `sync_merge.py`)
SÍ hace una UNIÓN correcta de `results` por matchKey en cada POST que
sí llega — pero si el POST del humano nunca llegó, el servidor
sencillamente **nunca tuvo ese matchKey**, no hay nada que fusionar.

El problema está en el LADO CLIENTE: cuando después llega una
hidratación (`window._tourLoad`) con un `updatedAt` de servidor más
reciente (por ejemplo, porque justo después se pulsó "▶ SIMULAR
JORNADA" para los partidos IA-vs-IA de la MISMA jornada, y ese POST sí
confirmó), `_tourLoad` **sustituye `cfg.results` completo** por el del
servidor (`misc_body_1.html:25723-25724`). El único blindaje existente,
`_tourBackfillActaFromLocal`, solo rellena el ACTA (`events`) de un
matchKey presente **en AMBOS lados con el MISMO marcador** — no cubre
el caso de un matchKey **AUSENTE del todo** en el servidor. Resultado:
el partido del humano, jugado y perfectamente guardado en LOCAL,
desaparece en silencio al adoptar la copia "más reciente" del
servidor — que nunca llegó a tenerlo.

### Fix — `_tourMergeMissingLocalResults(srv, loc)`, unión por matchKey en el cliente

Nueva función (`misc_body_1.html`, junto a `_tourBackfillActaFromLocal`):
recorre `loc.results` (la copia local) y, para cada matchKey **JUGADO**
(`played:true`) que en `srv.results` (la copia del servidor) esté
AUSENTE o NO jugado, lo copia hacia `srv.results[mk]`. Mismo principio
de unión que ya aplica `tour_cfg_merge` en el servidor, llevado al
cliente — nunca pisa un partido que el servidor YA tenga jugado (gana
la fuente que lo tenga, nunca last-write-wins sobre `results` entero).

Se llama en `_tourLoad` justo después de `_tourBackfillActaFromLocal`
y ANTES de cachear el cfg del servidor. Si recuperó algo (devuelve el
nº de matchKeys recuperados), el cfg curado se **re-sube** vía
`_tourSave(id, cfg)` — el servidor nunca tuvo esos partidos, así que
sin re-subir, un dispositivo nuevo (o el borrado de datos de éste)
volvería a perderlos.

### Reglas a respetar

1. **PROHIBIDO** que `_tourLoad` (o cualquier hidratación de torneo
   nueva) sustituya `cfg.results` ENTERO por la copia del servidor sin
   pasar antes por `_tourMergeMissingLocalResults`. `_tourBackfillActaFromLocal`
   protege el ACTA de un matchKey presente en ambos lados; esta función
   protege el matchKey ENTERO cuando el servidor nunca llegó a tenerlo
   — son complementarias, ninguna sustituye a la otra.
2. **PROHIBIDO** que `_tourMergeMissingLocalResults` pise un matchKey
   que el servidor YA tenga `played:true`: solo rellena huecos
   (ausente o no-jugado en servidor), nunca decide entre dos resultados
   YA jugados por recencia (eso lo sigue haciendo el `updatedAt`/
   `resetAt` de más arriba).
3. **PROHIBIDO** que la recuperación se quede solo en el cliente sin
   re-subir: si `_tourMergeMissingLocalResults` recuperó algo, `_tourLoad`
   DEBE llamar a `_tourSave(id, cfg)` para que el servidor deje de
   estar "por detrás" — si no, el próximo dispositivo que hidrate desde
   cero (o el mismo tras borrar datos) vuelve a perder el partido.
4. Este bug es DISTINTO de los ya documentados de `tour_cfg_merge`/
   `resetAt` (que cubren conflictos YA presentes en la unión del
   servidor): aquí el servidor NUNCA recibió el matchKey — el hueco
   está en que el cliente confiaba en que "servidor más reciente" ⇒
   "servidor tiene todo lo que yo tengo", lo cual es falso si un POST
   se perdió.

## La caja Inter-Portugal-Rubén (7º mister) se quedó FUERA de `SYNC_KEYS` — su cursor de calendario nunca sincronizaba con el servidor (obligatorio, 2026-07-17)

**Hallazgo** (auditoría derivada de la petición "que no vuelva a
suceder en ninguno de los 7 equipos humanos"): `SYNC_KEYS`
(`part2/misc_body_2.html`, la lista que `hydrateFromServer` usa para
saber qué claves pedir/hidratar del servidor) tenía las variantes
por-hub de `liverpool_preseason_v1`/`bayern_calendar_comps_v1`/
`bayern_calendar_title_v1`/`bayern_cal_v2` para Álvaro/Acsa/Isra/Ángel/
Izan (5 misters) — pero **NUNCA se añadieron las de Rubén** (`_ruben`)
cuando se dio de alta el 7º mister (Inter-Portugal, 2026-06-26). El
servidor YA soporta genéricamente cualquier sufijo de hub
(`_STATE_CURSOR_PREFIXES = ("liverpool_preseason_v1_", ...)`, un
`startswith` que no enumera hubs concretos) — el hueco era
EXCLUSIVAMENTE del lado cliente: sin la entrada en `SYNC_KEYS`,
`hydrateFromServer` nunca pedía `liverpool_preseason_v1_ruben` al
servidor, así que el cursor de calendario (y la config del calendario)
de esa caja NUNCA sobrevivía a un borrado de datos / cambio de móvil,
a diferencia de las otras 6.

**Fix**: añadidas `liverpool_preseason_v1_ruben`,
`bayern_calendar_comps_v1_ruben`, `bayern_calendar_title_v1_ruben`,
`bayern_cal_v2_ruben` a `SYNC_KEYS`.

**Regla a respetar**: toda lista hardcoded de sufijos por-hub (como
`SYNC_KEYS`, que NO es genérica por diseño — a diferencia del servidor)
DEBE tener una entrada por cada uno de los 7 misters de
`window._MISTERS_HUMANOS`. Al añadir un 8º mister en el futuro, auditar
`SYNC_KEYS` explícitamente (no asumir que "hereda" el soporte del
servidor — el servidor es genérico, esta lista cliente NO lo es).

## La reconciliación proactiva al servidor también cura el ROSTER (equipos), no solo la clasificación (obligatorio, 2026-07-15)

**Petición usuario 2026-07-15** (7 fotos, «Resto de Ligas» — Suecia,
Escocia, Suiza, Chipre, Austria…): "todas esas ligas tienen 20 equipos
cada una y no se ven cuando abres cada liga" — al abrir CUALQUIERA de
varias ligas externas (no una de las 4 auto-sembradas — Suecia, Escocia,
Suiza, Chipre, Austria son ligas normales, con roster 100% manual del
admin), la pantalla mostraba "No hay equipos. Usa 🖍 Editar para
añadir clubes." pese a que el admin insiste en que cada una tiene 20
equipos ya añadidos (en OTRO dispositivo).

### Causa raíz — la reconciliación proactiva (2026-06-30) solo curaba RESULTADOS, nunca el ROSTER

`window._lextReconcileResultsToServer` (`misc_body_1.html`) es la red de
seguridad que, cuando el POST normal de `saveData` se pierde en
silencio (localStorage lleno, red móvil, cold-start de Railway — sin
ningún aviso visible para el admin), re-empuja la copia local durable
(`LIGA_CACHE` / main / `_protected` / IndexedDB) hacia el servidor. Se
dispara sola al arrancar, al volver el foco a la pestaña, y tras cada
simulación. Su guard de entrada era:
```js
var localResults = _lextResLen(local);
if (!local || localResults === 0) { /* nada que curar */ return; }
```
Esto significa que una liga con el **ROSTER recién editado** (20 equipos
pegados/creados a mano) pero **SIN NINGÚN partido simulado todavía**
(`results:[]`, exactamente el estado de una liga recién configurada,
antes de pulsar 🎮 Sim) tenía `localResults === 0` — el guard la
saltaba ENTERA, tratándola como "nada que curar", cuando en realidad
tenía 20 equipos completos esperando a subirse. Si el POST original de
`saveData` para esa liga se había perdido (el escenario más común de
todo este proyecto, documentado en la sección "Resto Mundo/Montenegro/
N.Irlanda/Albania simuladas en PC, a 0 en el móvil" de más abajo, aquí
generalizado a CUALQUIER liga externa), el roster se quedaba
**invisible para siempre** en cualquier otro dispositivo — exactamente
el síntoma: 20 equipos en el dispositivo que los editó, 0 equipos en
cualquier otro que solo hace `GET`.

### Fix

`_lextReconcileResultsToServer`: el guard de entrada ahora comprueba
TAMBIÉN el roster (`_lextTeamsLen(local)`) — solo se salta una liga si
NI tiene resultados NI tiene equipos. Tras el `GET` al servidor, se
añade `needPushRoster = localTeamsN > 0 && srvTeamsN < localTeamsN`
(además del `needPushResults` ya existente) — si la copia local trae
MÁS equipos que el servidor, se re-empuja, **sin exigir que la liga
tenga partidos jugados**. El merge por equipo del servidor
(`_lx_merge_teams`, `app.py`) es ADITIVO por diseño (fusiona por nombre
canónico, nunca reemplaza el documento entero a lo bruto), así que
empujar el roster nunca pisa equipos que el servidor ya tuviera de otro
dispositivo.

### Reglas a respetar

1. **PROHIBIDO** que el guard de entrada de
   `_lextReconcileResultsToServer` (o cualquier reconciliación
   proactiva nueva de este tipo) mire SOLO `results`/clasificación para
   decidir si una liga "tiene algo que curar". El ROSTER (equipos) es
   un dato igual de crítico que puede quedarse sin subir — y es
   PREVIO a cualquier resultado (una liga recién configurada, antes de
   simular NADA, es exactamente el estado con más riesgo de perderse
   sin este guard).
2. **PROHIBIDO** que el push de roster de esta reconciliación reemplace
   el documento del servidor a lo bruto en vez de pasar por el merge
   por equipo (`_lx_merge_teams`). Es lo que garantiza que nunca se
   pisa un roster que el servidor ya tuviera de otro dispositivo.
3. Esta reconciliación aplica a **CUALQUIER liga externa** (las ~50
   normales, no solo las 4 auto-sembradas Resto Mundo/Montenegro/
   N.Irlanda/Albania) — el roster de esas 4 lo cubre además el seed
   automático (`_ensureExtraLeagueSeed`/`_ensureRestoMundoSeed`), pero
   las ~50 normales dependen ÚNICAMENTE de esta reconciliación + del
   POST original de `saveData` para llegar al servidor.

## La búsqueda server-side de escudo/alias/plantilla (`/api/team-shield`, `/api/team-alias`, `/api/team-squad`) también mira el snapshot `_protected` de cada liga (obligatorio, 2026-07-13 #2)

**Petición usuario 2026-07-13** (2 fotos, «Maccabi Haifa vs Atlético
Madrid», Previa Champions — J4): pese a los fixes de 2026-07-12 (#5,
#6, #7) que añadieron búsqueda server-side de escudo/alias/plantilla,
"siguen sin salir los escudos / sin salir la ❓ el alias / y sin salir
los jugadores del Maccabi Haifa" — tanto en la card del hub (escudo
totalmente vacío, ni siquiera el placeholder de iniciales) como en la
PANTALLA DE PREVIA (escudo genérico "MAC", sin botón ❓).

### Causa raíz — los 3 endpoints EXCLUYEN a propósito los snapshots `_protected`

`api_team_shield`/`api_team_alias`/`api_team_squad` (`app.py`) escanean
todas las filas `liga_ext_%` pero **saltan explícitamente** las que
terminan en `_protected` (`rest.endswith("_protected")`) — a propósito,
para no leer snapshots viejos en el camino feliz. El problema: el
snapshot `liga_ext_<slug>_protected` es un **monotónico por nº de
jugadores** (`/api/liga-ext-protected/<slug>` POST, sección "PROTECTED
snapshot" más abajo) que puede llegar a tener MÁS datos que el propio
`main` — si una escritura CONCURRENTE de otro dispositivo (3 móviles +
PC editando la misma liga) regresó el `main` a una copia más pobre (sin
el escudo/alias/plantilla recién editados), el guard anti-wipe de
`_protected` conserva la edición rica **solo ahí**, y `main` nunca la
recupera automáticamente. Como los 3 endpoints de búsqueda por nombre
solo miran `main`, un dato de identidad que sobrevive ÚNICAMENTE en
`_protected` es invisible para CUALQUIER dispositivo, para siempre —
exactamente el síntoma reportado (no depende de qué móvil pregunte).

### Fix

Nuevo `_liga_ext_protected_scan(rows, target, scan_fn)` (`app.py`,
junto a `_team_alias_scan_teams`): reutiliza la MISMA lista de filas ya
consultada por el escaneo de `main` (sin una 2ª query a la BD) y hace
una segunda pasada filtrando SOLO las que terminan en `_protected`, con
el mismo `scan_fn` (`_team_alias_scan_teams`/`_team_shield_scan_teams`/
`_team_squad_scan_teams`). Se invoca como ÚLTIMO RECURSO en los 3
endpoints, DESPUÉS de fallar el escaneo de `main` en todas las ligas y
ANTES del fallback a `selecciones_squad_v1` — `main` sigue ganando
siempre que traiga el dato (esta pasada solo actúa si `main` viene
vacío para ese campo). Tests en
`tests/test_api.py::TestTeamIdentityProtectedFallback`.

### Reglas a respetar

1. **PROHIBIDO** que un endpoint de búsqueda de identidad por nombre
   nuevo (escudo, alias, plantilla, estadio, o cualquier campo similar
   futuro) descarte los snapshots `_protected` sin ofrecer un fallback
   a ellos. El `main` de una liga puede quedar por detrás de su propio
   `_protected` en cualquier momento (escritura concurrente de OTRO
   dispositivo) — sin este fallback, un dato de identidad puede quedar
   invisible PARA SIEMPRE, en CUALQUIER dispositivo, no solo el que lo
   editó.
2. **PROHIBIDO** que la pasada de `_protected` se ejecute ANTES que la
   de `main`, o que gane sobre un dato que `main` SÍ trae. Es
   estrictamente un último recurso: `main` es la fuente de verdad
   cuando la tiene.
3. Todo endpoint nuevo de este tipo reutiliza `_liga_ext_protected_scan`
   (no duplicar el bucle de escaneo de `_protected`) pasándole su propia
   función `_team_xxx_scan_teams`.

## El overlay "Equipos por competición" lanzaba `ReferenceError: EUR_MANUAL_ZONES is not defined` en CADA apertura desde 2026-07-07 (obligatorio, 2026-07-13 #5)

**Petición usuario 2026-07-13** (foto, overlay "👁 Ver / Añadir equipos
por competición" abierto y funcionando, con un banner rojo debajo:
"⚠️ La acción no se pudo completar: EUR_MANUAL_ZONES is not defined"):
bug NO relacionado con los fixes de XHR síncrono de esta misma sesión —
existe desde el commit `9a8fb78` (2026-07-07, "No hidratar las ~50 ligas
si todas las zonas europeas son manuales").

### Causa raíz

`window._eurManualOverlayOpen` (`misc_body_1.html` ~43610) referenciaba
la variable pelada `EUR_MANUAL_ZONES` en la línea
`var anyAutomatic = EUR_MANUAL_ZONES.some(...)` — pero `EUR_MANUAL_ZONES`
es un `var` **LOCAL** de la IIFE `(function(){...})()` que va de la línea
~35611 a la ~37163, y `_eurManualOverlayOpen` vive en OTRA IIFE distinta
que arranca después de la 37163. El nombre pelado no existe en ese scope
→ `ReferenceError` en CADA apertura del overlay desde que se escribió
esa línea. Como el `_eurManualOverlayRender()` que pinta el overlay se
llama ANTES de la línea que revienta, el overlay se veía perfectamente
bien — solo fallaba (en silencio hasta que `window.pG` lo capturó y
mostró el banner) el auto-hidrate condicional de después.

### Fix

Usa `window._eurManualExtraZones` — la MISMA lista, ya expuesta
deliberadamente en `window` (misc_body_1.html ~36426,
`window._eurManualExtraZones = EUR_MANUAL_ZONES;`) precisamente para que
otras IIFEs de este archivo puedan leerla sin duplicarla.

### Reglas a respetar

1. **PROHIBIDO** que una IIFE lea una `var` de OTRA IIFE por su nombre
   pelado. Si una constante/lista debe ser compartida entre IIFEs de
   este archivo, se expone explícitamente en `window.*` (como ya se hizo
   con `_eurManualExtraZones`) y el consumidor SIEMPRE lee la versión de
   `window`, nunca el nombre local.
2. Antes de dar por bueno un fix que añade lógica dentro de una función
   ya existente (aquí, el auto-hidrate condicional dentro de
   `_eurManualOverlayOpen`), verificar que toda variable referenciada
   está en el scope de ESA función — un `grep` del nombre + confirmar en
   qué IIFE vive cada aparición evita este tipo de regresión silenciosa.

## TODO el proyecto queda libre de XHR síncrono — «Resto de Ligas» sufría el MISMO bug en 10 sitios más + guardián automático (obligatorio, 2026-07-13 #4)

**Petición usuario 2026-07-13** ("en resto de ligas pasaba lo mismo,
¿arreglado también? ¿podemos intentar que ese error no vuelva a
suceder?"): tras el fix del click en la clasificación (sección
siguiente, #3), se auditó el resto del proyecto en busca de la MISMA
familia de bug. Resultado: había **10 sitios más** con
`XMLHttpRequest` **síncrono** (`async=false`), todos alcanzables desde
"Resto de Ligas" (y algunos desde Liga EA Sports también):

1. **`loadData(k)`** (la función que carga CUALQUIER `ligaExt_<slug>` —
   usada por `openLigaExt`, `renderTable`, `lextOpenSquad`, 76 sitios en
   total): hasta 3 XHR síncronos encadenados (main → protected →
   protected-solo) cuando no había NADA en cache local. Esto se disparaba
   tanto al ABRIR la pantalla de una liga sin datos como al pulsar un
   equipo suyo (`.lext-row onclick="lextOpenSquad(...)"`, un handler
   DISTINTO del ya arreglado en #3 — usa clases/mecanismos propios).
2. **`saveData(k,d)`** (guardado de CUALQUIER edición del editor, 40
   sitios): hasta 6 XHR síncronos encadenados (POST main ×3 reintentos +
   POST protected ×3 reintentos) en CADA guardado — congelaba la pestaña
   al pulsar "Guardar" en el editor de cualquier equipo/liga.
3. **`_readLigaData(slug)`** (agregador de "Resto de Ligas ·
   Estadísticas"): llamado en un BUCLE sobre las ~51 ligas — el peor
   caso, hasta 51 XHR síncronos ENCADENADOS con solo abrir esa pantalla.
4. **`_lextSeedRecoverFromServer(slug)`** (recuperación de las 4 ligas
   auto-sembradas: Resto Mundo/Montenegro/N.Irlanda/Albania): hasta 2 XHR
   síncronos al abrir su pantalla si local+`_protected`+snapshots estaban
   vacíos. **Esto SUPERSEDE la regla previa que prohibía hacerlo
   asíncrono** ("el coste es aceptable, es un caso raro") — con la regla
   general de abajo, ningún XHR síncrono es aceptable en ningún caso,
   por raro que sea.
5. **`emergencyRestore`/`lextDeepRecoverSlug`/`lextDeepRecoverAll`**
   (herramientas de recuperación manual desde consola): hasta 55 XHR
   síncronos encadenados en `lextDeepRecoverAll` (uno por liga conocida).
6. **`rosterFor(team)`** (`part2/misc_body_2.html`, plantilla de la card
   BAJAS PARA EL PARTIDO): hasta 3 XHR síncronos si el equipo humano no
   tenía plantilla cacheada localmente.

### Fix — mismo patrón en los 10 sitios: nunca bloquear, hidratar de fondo

Todos sustituidos por `fetch()` con `AbortController` + timeout de 6s
(`window._lextFetchJsonTimeout`, alias de `_lextClickFetchJson` del fix
#3). Donde la función tenía un contrato de retorno SÍNCRONO usado por
muchos callers (`loadData`, `saveData`, `_readLigaData`, `rosterFor`):
se preserva ese contrato devolviendo lo que YA hay en local (o vacío) al
instante, y la hidratación real del servidor corre en segundo plano,
actualizando `localStorage`/`LIGA_CACHE` y re-pintando la pantalla si
sigue abierta cuando el servidor responde — nunca bloquea, nunca pierde
la capacidad de recuperar datos, solo lo hace un tick más tarde. Donde
la función era una herramienta de consola sin otros callers
(`emergencyRestore`, `lextDeepRecoverSlug/All`, `_lextSeedRecoverFromServer`)
se convirtió directamente a `async`/callback.

### El guardián de sintaxis (`tools/check_js_blocks.py`) ahora TAMBIÉN bloquea XHR síncrono

Respuesta a "¿podemos intentar que no vuelva a pasar?": el hook de
`SessionStart` que ya comprobaba sintaxis JS (`node --check` de cada
`<script>`) ahora ADEMÁS escanea con regex cualquier
`.open(MÉTODO, url, false)` en los archivos vigilados
(`misc_body_1.html`, `misc_body_2.html`, `static/js/*.js`) y **falla la
sesión** si encuentra uno. Antes esta regla solo vivía en texto
(CLAUDE.md) — ahora un futuro Claude (o el propio código) que reintroduzca
un XHR síncrono lo verá fallar el arranque de la sesión siguiente, en vez
de depender de que alguien recuerde leer esta prohibición.

### Reglas a respetar

1. **PROHIBIDO** usar `XMLHttpRequest` con `async=false` en NINGÚN sitio
   del proyecto, sin excepción — ni siquiera en herramientas de consola,
   flujos de recuperación "raros", o casos ya documentados como
   "el coste es aceptable". La regla del fix #3 (más abajo) es absoluta
   y SUPERSEDE cualquier excepción previa escrita para un caso concreto.
2. **PROHIBIDO** que una función con contrato de retorno síncrono usado
   por muchos callers (`loadData`, `saveData`, o cualquier función nueva
   de este tipo) se vuelva `async` para "arreglar" esto — eso obligaría a
   tocar decenas de callers. El patrón correcto es: devolver lo que haya
   en local YA (o vacío) al instante, e hidratar el servidor en segundo
   plano sin bloquear, re-pintando si la pantalla sigue abierta.
3. **PROHIBIDO** quitar el chequeo de XHR síncrono de
   `tools/check_js_blocks.py` (`SYNC_XHR_RE`/`check_sync_xhr`). Toda
   liga/pantalla/herramienta NUEVA que añada un fetch al servidor hereda
   esta protección automáticamente con solo estar en los archivos ya
   vigilados por el guardián.

## El click en una fila de clasificación NUNCA hace XHR SÍNCRONO — congelaba la pestaña entera al pulsar CUALQUIER equipo (obligatorio, 2026-07-13 #3)

**Petición usuario 2026-07-13** (3 fotos, «Liga EA Sports · Clasificación»,
temporada recién empezada/reiniciada, todos los equipos a 0 PJ): "la web
se congela al meterte en cualquier caja donde al pulsar un equipo la
pantalla se congela" — tocar CUALQUIER fila de la tabla de clasificación
(Arsenal, Athletic Club, Real Madrid…) dejaba la pestaña entera
congelada, sin ninguna reacción visible.

### Causa raíz — hasta ~14 `XMLHttpRequest` SÍNCRONOS encadenados en el propio click handler

El delegado único `document.addEventListener('click', …)` que abre la
plantilla (overlay `lext-ov-squad`) al pulsar una fila `.clas-row` de
CUALQUIER pantalla de clasificación (`s-liga-clas`, `s-segunda-clas`,
`s-primf-clas`, `s-superliga-clas`, `s-champions`, `s-uel`, `s-uecl`, …)
hacía, cuando el equipo tocado no tenía plantilla ya cacheada en
`localStorage` (el caso típico de una temporada recién reiniciada, o de
un dispositivo/instalación nueva — exactamente lo que muestran las 3
fotos, TODOS los equipos a 0 PJ), hasta **3 bloques de peticiones
`XMLHttpRequest` con `async=false`** (bloqueantes de verdad, congelan el
hilo principal ENTERO hasta que el servidor responde):

1. `GET /api/liga-ext/<slug>` inicial si `localStorage` está vacío
   (`misc_body_1.html`, bloque "1.").
2. **"Fuente B"**: un `for` que recorre hasta **12 slugs de liga
   conocidos**, cada uno con su PROPIO XHR síncrono, **secuencial**
   (`misc_body_1.html`, bloque "Fuente B").
3. **"Fuente H"**: un XHR síncrono a `/api/jugadores-hardcoded`
   (`misc_body_1.html`, bloque "Fuente H").

Con el backend en cold-start (Railway/Render, documentado en varios
sitios de este mismo archivo) cada una de esas peticiones puede tardar
varios segundos — y al ser SÍNCRONAS, sin ningún timeout, la pestaña se
queda congelada sin ninguna animación/feedback hasta que TODAS
resuelven o el navegador las corta por su cuenta. Como una temporada
recién empezada tiene TODOS los equipos sin plantilla cacheada
todavía, el bug se reproducía con CUALQUIER equipo que se pulsara.

### Fix

Los 3 bloques de XHR síncrono se sustituyen por
`window`-scoped `_lextClickFetchJson(url)` (`misc_body_1.html`, justo
antes del handler): `fetch()` envuelto en `AbortController` con
**timeout duro de 6 s** (mismo patrón que `_efAliasServerSearch`/
`_eurTeamShieldServerSearch` de este mismo proyecto) que NUNCA lanza —
resuelve `null` en fallo/timeout, igual que antes se comprobaba
`xhr.status === 200`. El handler del click pasa a ser
`async function(ev){...}` y usa `await` en los 3 puntos — el hilo
principal deja de bloquearse mientras esperan al servidor. Se añade un
toast mínimo (`_lextClickToast`/`_lextClickToastDismiss`) para que el
usuario vea "⏳ Cargando…" en vez de una pantalla sin ninguna reacción
mientras las peticiones (ahora asíncronas) resuelven.

### Reglas a respetar

1. **PROHIBIDO** usar `XMLHttpRequest` con `async=false` (3er argumento
   `false` de `.open()`) en NINGÚN handler de click/tap de este
   proyecto. Un XHR síncrono congela la pestaña ENTERA hasta que el
   servidor responde, sin límite de tiempo — con el backend en
   cold-start (caso frecuente y ya documentado de este proyecto) eso
   puede ser muchos segundos, y ENCADENAR varios (como hacían las
   "Fuentes B/H" de este handler) los multiplica.
2. **PROHIBIDO** que una petición de red de la que depende continuar un
   flujo visible (abrir un overlay, resolver una plantilla) carezca de
   timeout. Usar `_lextClickFetchJson` (o el patrón `fetch` +
   `AbortController` + 6 s ya establecido en `_efAliasServerSearch`/
   `_eurTeamShieldServerSearch`) — nunca un `fetch`/XHR sin límite.
3. Todo nuevo fallback de resolución de plantilla por nombre (una
   "Fuente I", J, etc. futura) que necesite preguntar al servidor debe
   usar `_lextClickFetchJson`, nunca un XHR síncrono nuevo.

## Toda comprobación diferida en servidor (escudo Y plantilla, no solo alias) REINTENTA — un fallo de red no debe dejarla sin aparecer para siempre (obligatorio, 2026-07-13 #2)

**Petición usuario 2026-07-13** (6 fotos, mismo caso «Maccabi Haifa»/
«CF Univer Comrat»/«Dunajska Streda» vs Atlético Madrid, GRUPO I —
"sigue igual, no salen los escudos ni las plantillas, no tan siquiera
la ❓️ para saber el Alias de cada equipo", tras el fix anterior del
mismo día): investigación exhaustiva de las 4 comprobaciones diferidas
en servidor que ya existían (`_psShieldDeferredCheck` del hub,
`_ppShieldDeferredCheck` de la Pantalla de Previa, la nueva
`_wprevShieldDeferredCheck` de la tabla de grupos, y la búsqueda de
plantilla dentro de `_gmRenderPlayerPick`).

### Causa raíz — 3 de las 4 eran UNA sola petición, sin reintentos

La regla ya obligatoria de 2026-07-05 ("PROHIBIDO que una búsqueda...
se rinda tras el PRIMER fallo sin reintentar") solo se aplicó en su
momento a `_ppAliasDeferredCheck` (❓ de alias — 6 intentos con backoff
`[0,1500,3000,5000,8000,12000]` ms). Las comprobaciones de ESCUDO
(`_psShieldDeferredCheck`, `_ppShieldDeferredCheck`,
`_wprevShieldDeferredCheck`) y de PLANTILLA (`_gmRenderPlayerPick` →
`_eurTeamSquadServerSearch`), aunque añadidas DESPUÉS (2026-07-12 #7)
copiando "el mismo patrón", en realidad solo copiaron la PETICIÓN
(`fetch` con timeout de 6s) — nunca los reintentos. Un cold-start de
Railway o un blip de red (el escenario más documentado de todo este
proyecto) mataba la comprobación ENTERA a la primera, dejando el
placeholder vacío PARA SIEMPRE — exactamente el mismo síntoma que ya
se arregló para el alias, reproducido en las otras 3 capas porque el
fix de 2026-07-05 nunca se generalizó.

### Fix — helper único `window._eurRetryServerSearch(searchFn, teamName, onFound)`

Nuevo helper genérico (`misc_body_1.html`, junto a
`_eurTeamShieldServerSearch`/`_eurTeamSquadServerSearch`): envuelve
CUALQUIER función de búsqueda de identidad por nombre (`(teamName,
onDone) => void`, un solo intento) con los MISMOS 6 intentos/backoff
que ya probó su eficacia con el alias. Reutilizado por los 4 puntos:

- `_psShieldDeferredCheck` (card del hub, `misc_body_1.html`).
- `_ppShieldDeferredCheck` (Pantalla de Previa, `index.bundle.js`,
  bump `9.33`→`9.34`).
- `_wprevShieldDeferredCheck` (tabla de grupos/fixture/cruces de la
  Previa, `part2/misc_body_2.html`, sección de arriba).
- La búsqueda de plantilla dentro de `_gmRenderPlayerPick`
  (`part2/misc_body_2.html`).

Cada call site sigue el patrón `typeof window._eurRetryServerSearch
=== 'function' ? envolver : fallback al single-shot original` — si el
helper no cargó (orden de scripts roto por cualquier motivo), el
comportamiento anterior se conserva en vez de romper por completo.

### Reglas a respetar

1. **PROHIBIDO** que una comprobación diferida en servidor NUEVA
   (escudo, plantilla, alias, estadio, o cualquier campo de identidad
   futuro) haga una única petición sin pasar por
   `window._eurRetryServerSearch`. Es el ÚNICO punto que garantiza los
   6 intentos/backoff — copiar "el patrón" sin usar el helper repite
   exactamente este bug.
2. **PROHIBIDO** asumir que porque una comprobación diferida "ya sigue
   el mismo patrón que el alias" hereda también sus reintentos: hay que
   verificar que llama de verdad a `_eurRetryServerSearch` (o al
   `_attempt()`/`DELAYS` equivalente), no solo que hace un `fetch` con
   timeout de 6s.
3. Recordatorio: cualquier edición de `index.bundle.js` exige bump de
   `?v=X.X` en `templates/index.html` Y `PRECACHE` de `static/js/sw.js`
   (regla ya existente, 2026-07-04) — este fix la cumple (9.33→9.34).

## La tabla de grupos / jornadas / cruces de la Previa de Champions también hereda la búsqueda server-side del escudo — `_badge`/`_badgeBig` se habían quedado fuera del fix #7/#8 (obligatorio, 2026-07-13)

**Petición usuario 2026-07-13** (6 fotos, «Maccabi Haifa»/«Dunajska
Streda»/«CF Univer Comrat» vs Atlético Madrid, GRUPO I de la Previa de
Champions): "cuando un equipo está con su escudo y Plantilla, no
entiendo porque a la hora de jugar cualquier competición no sale ni su
escudo ni su plantilla" — con los 3 equipos rivales YA confirmados con
escudo real en sus ligas de origen (Niké Liga de Eslovaquia para
Dunajska Streda, Ligat Ha'al de Israel para Maccabi Haifa, visibles en
capturas de "Resto de Ligas" del mismo dispositivo), la tabla
**"GRUPO I"** de la Previa de Champions (`_groupTable`) mostraba los 3
rivales SIN NINGÚN escudo — ni siquiera el placeholder de iniciales que
sí muestra la Pantalla de Previa — y la propia Pantalla de Previa
(`_renderPreviaMeta`) seguía mostrando el placeholder gris de iniciales.

### Causa raíz — `_badge`/`_badgeBig` (WPREV) nunca heredaron el fallback server-side

Las reglas 2026-07-12 #7 y #8 ya obligan a que "toda tabla/card/cruce/
picker NUEVO de la Previa hereda `_eurTeamShieldServerSearch` como
último fallback" — pero esa herencia solo se cableó en la card del hub
(`_psShieldDeferredCheck`, `misc_body_1.html`) y en la Pantalla de
Previa a pantalla completa (`_ppShieldDeferredCheck`,
`index.bundle.js`). Los 3 puntos que pintan escudos DENTRO de la propia
pantalla de la Previa (`part2/misc_body_2.html`, IIFE `wprev_state_v1`)
— la tabla de cada grupo (`_groupTable`), las jornadas del fixture del
grupo humano (`_fgJornadaHtml`) y los cruces de la Ronda Preliminar
(`_prelimTieHtml`) — comparten los helpers `_badge`/`_badgeBig`, que
SOLO probaban `_logoOf(name)` (resolución SÍNCRONA local: `getTeamLogoUrl`
→ `TEAM_LOGOS` → `window._eurResolveTeamLogo`, que escanea
`localStorage`+`LIGA_CACHE` de ESTE dispositivo) y, si venía vacío,
devolvían la cadena vacía `''` — ni `<img>` ni placeholder, así que no
había NADA a lo que engancharle una comprobación diferida en servidor.
Un dispositivo que entra directo a la Previa sin haber abierto antes la
liga de origen del rival (Eslovaquia/Israel/Moldavia) se queda con el
hueco vacío para siempre en estas 3 vistas, aunque el servidor SÍ tenga
el escudo guardado.

### Fix

- **`_badge(name,logo)`/`_badgeBig(name,logo)`**: cuando `_logoOf`
  viene vacío, ya NO devuelven `''` — devuelven un placeholder
  `<span data-shield-name="<nombre>">` (mismas dimensiones que el
  `<img>` real: 18px inline para `_badge`, clase `.crest` para
  `_badgeBig`) para que exista un nodo identificable al que sustituir.
- **`_wprevShieldDeferredCheck(container)`** (nuevo, mismo patrón EXACTO
  que `_psShieldDeferredCheck`/`_ppShieldDeferredCheck`): recorre TODOS
  los placeholders `[data-shield-name]` de `container`, agrupa por
  nombre de equipo ÚNICO (una sola petición aunque el mismo rival
  aparezca en la tabla de clasificación Y en 6 jornadas del fixture) y
  llama a `window._eurTeamShieldServerSearch(nombre, onDone)`. Si el
  servidor lo encuentra, sustituye TODAS las apariciones de ese equipo
  en `container` por el `<img>` real.
- Llamado tras cada `innerHTML` que pueda contener escudos sin resolver:
  `buildUclPrevClas` (tras `host.innerHTML=html`, cubre `_groupTable` +
  `_fgJornadaHtml` de los 12 grupos) y `_renderPrelim` (tras
  `dr.innerHTML=...`, cubre `_prelimTieHtml` de los 14 cruces).

### Reglas a respetar

1. **PROHIBIDO** que `_badge`/`_badgeBig` (o cualquier helper de escudo
   nuevo de la Previa que viva DENTRO de `part2/misc_body_2.html`)
   devuelvan `''` cuando la resolución local falla. Deben dejar un
   placeholder identificable (`data-shield-name`) para que una
   comprobación diferida en servidor pueda sustituirlo — el patrón
   "resolución local → placeholder con identificador → búsqueda
   diferida en servidor" es el mismo en LAS 3 CAPAS de esta pantalla
   (card del hub, Pantalla de Previa a pantalla completa, Y la propia
   tabla/fixture/cruces de la pantalla de la Previa) — ninguna sustituye
   a las otras 2, son 3 componentes de UI distintos.
2. **PROHIBIDO** que la comprobación diferida dispare una petición por
   FILA en vez de por EQUIPO ÚNICO: un rival puede aparecer en la tabla
   de clasificación Y en hasta 6 jornadas del fixture del grupo humano
   — `_wprevShieldDeferredCheck` deduplica por nombre antes de llamar a
   `_eurTeamShieldServerSearch`.
3. Toda tabla/card/cruce NUEVO de esta pantalla (o de cualquier
   competición que pinte escudos de Resto de Ligas por nombre) hereda
   `_wprevShieldDeferredCheck` en cuanto use `_badge`/`_badgeBig` — no
   reinventar el pintado de escudo con un `_logoOf(...)||''` suelto.

## 📌 PARTIDOS POSPUESTOS — club/sel mal clasificados (Mundialito vs "rival pendiente") + pospuestos STALE que ya se jugaron por otra vía + rondas KO bloqueadas que se perdían sin rastro (obligatorio, 2026-07-13)

**Petición usuario 2026-07-13** (3 fotos, caja «Atlético Madrid-
Noruega-Isra»): "con el Atlético Madrid tiene pendiente el partido del
Joan Gamper y desde Octavos a la Final del Mundialito de Clubes / con
Noruega pone pendiente J1 J2 J3 del grupo del Mundial pero eso ya lo
jugó, faltaría desde Dieciseisavos hasta la final pendiente". La pestaña
**Selección** de 📌 PARTIDOS POSPUESTOS mostraba `MUNDIAL GRUPO — J1/J2/J3`
(Noruega vs Senegal/Iraq/Francia) con botón ▶ JUGAR pese a que la
pantalla del propio Mundial confirmaba el grupo **6/6 jugado** (Noruega
1ª, 9 PTS) — y la misma pestaña, no la de Club, mostraba
`MUNDIALITO DE CLUBES · OCTAVOS` con "Noruega — SIN RIVAL", un partido
de CLUB (Atlético Madrid) contaminando la caja de la selección.

### 3 causas raíz, las 3 en la misma sección "Cajas POSPUESTOS · PENDIENTES
· JUGADOS" (`misc_body_1.html`)

1. **`_cardPendingPrevPhase`, el botón 📌 Posponer de la card "⚠️ RIVAL
   PENDIENTE"** (se pinta tanto para el CLUB —Mundialito de Clubes,
   torneos de verano— como para la SELECCIÓN —Mundial-48— reutilizando
   la MISMA función): su `deferBtn.onclick` rellenaba `home.name`
   **SIEMPRE** con el nombre de la selección del mister
   (`_nrSelName || _psHumanLogicName()`) si el mister tenía selección
   asignada — lo cual es SIEMPRE cierto para los 7 misters. Así, posponer
   la card de "Mundialito de Clubes · Octavos" (bloqueo del CLUB, rival
   TBD) guardaba la entrada con `home:'Noruega'`, y `_entrySide` (el
   filtro de pertenencia del fix #7 de más abajo) la bucketeaba en la
   pestaña Selección por pura coincidencia de nombre — un partido de
   club apareciendo en la caja de la selección.
2. **Un pospuesto solo se elimina de `pend_hvh_deferred_v1` si se
   re-juega DESDE ESTA MISMA caja** (`_playDeferredHvH`/`_paySimDeferred`,
   los únicos 2 puntos que llaman a `_pendHvHRemove`). Si el partido se
   resuelve por CUALQUIER OTRA vía —entrar directo a la pantalla del
   Mundial y jugar la jornada allí, como hizo el usuario con J1/J2/J3—
   la entrada se queda **STALE para siempre**: el partido real ya tiene
   resultado (`cfg.results[matchKey].played`) pero la caja POSPUESTOS lo
   sigue anunciando como pendiente de jugar.
3. **El self-heal de cursor (`_psCursorHeal`) descartaba, sin guardar
   rastro, cualquier día `ag-sel` "RIVAL PENDIENTE" que el cursor hubiera
   dejado atrás** (`if (_pair.pending) continue;`, con un comentario
   —"ya vive en POSPUESTOS vía `_realPair`"— que resultó ser falso: esa
   entrada SOLO se crea si el humano pulsó a mano el 📌 Posponer de la
   card `_cardPendingPrevPhase` MIENTRAS estaba activa en pantalla). Una
   ronda KO bloqueada (Dieciseisavos en adelante, rival TBD porque el
   bracket del Mundial-48 aún no se ha construido) que el cursor superó
   sin que el humano pulsara ese botón desaparecía sin dejar ningún
   rastro — nunca volvía a mostrar esa card, y tampoco quedaba en
   POSPUESTOS.

### Fix

- **`_cardPendingPrevPhase`**: el contexto (club vs selección) se
  distingue por `info.compEmoji` — la rama de Mundial-48/selección
  SIEMPRE lo pone a `'🌍'`; la rama de club (`_realPendingShape`,
  reutilizada por Mundialito de Clubes Y por los torneos de verano)
  SIEMPRE lo pone a `'🌞'`. `_nrIsSelCtx = (_nrEmoji === '🌍')`: solo en
  contexto de selección se resuelve `_nrSelName` vía `_mhFindMister`; en
  contexto de club, `home.name` es SIEMPRE `_psHumanLogicName()` (el
  club del hub), nunca la selección.
- **Auto-heal de pospuestos ya jugados** (`_render(mode==='posp')`, justo
  antes de bucketear por `_entrySide`): `_entryAlreadyPlayed(e)` comprueba
  `cfg.results[e.matchKey].played` (vía `_TOUR_CACHE`/`_tourLoadCachedSync`,
  mismo patrón que usa `_psCursorHeal` para el guard "ya jugado"). Si el
  partido ya se jugó por cualquier vía, la entrada se tombstonea
  (`_pendHvHRemove`) y se EXCLUYE del render — nunca se pierde nada real,
  solo se limpia un pospuesto que ya dejó de serlo. Solo aplica a
  entradas `isTour` (con `tourId`+`matchKey`); las de Liga/Copa/europeas
  (sin cfg en `_TOUR_CACHE`) no se tocan.
- **`_psCursorHeal`**: la rama `_pair.pending` ya NO hace `continue` en
  silencio — construye el MISMO shape `noRival:true` que el botón manual
  (mismo formato de uid `tourId::RIVAL_PENDING::<ref>`, deduplicado vía
  `_healIsDeferred`) usando `_pair.tourId`/`_pair.compEmoji`/
  `_pair.compName` (ya vienen resueltos desde `_selPair`), y SOLO
  entonces hace `continue`. Así una ronda KO bloqueada que el cursor deja
  atrás sin intervención manual del usuario SIEMPRE queda visible en
  POSPUESTOS · Selección, en vez de desaparecer sin rastro.

### Reglas a respetar

1. **PROHIBIDO** que una card de bloqueo reutilizada por CLUB y por
   SELECCIÓN (`_cardPendingPrevPhase` o cualquier futura de este tipo)
   rellene el nombre del equipo con una fuente fija (siempre la
   selección, o siempre el club) sin comprobar antes en qué contexto se
   está — usar una señal explícita del `info` (como `compEmoji`), nunca
   asumir "si el mister tiene selección, usarla siempre".
2. **PROHIBIDO** que una entrada de `pend_hvh_deferred_v1` con
   `tourId`+`matchKey` reales se muestre como pendiente de JUGAR sin
   comprobar antes si `cfg.results[matchKey]` ya está `played`. Todo
   render de esta caja hereda `_entryAlreadyPlayed` como filtro previo al
   bucketing — un partido resuelto por CUALQUIER vía (no solo el botón
   ▶ JUGAR de esta caja) debe autolimpiarse de la lista.
3. **PROHIBIDO** que un self-heal de cursor (`_psCursorHeal` o cualquier
   futuro) descarte en silencio un día bloqueado ("rival pendiente", sin
   matchKey resuelto) que quedó atrás del cursor. Si el usuario no llegó
   a posponerlo a mano mientras la card estaba activa, el self-heal debe
   crearlo él mismo (mismo shape `noRival:true`) para que no desaparezca
   sin dejar rastro — mismo principio que ya aplica a los días con
   partido real (`matchKey` resuelto) de esta misma función.
4. Toda caja de mister NUEVA hereda los 3 fixes automáticamente (el
   discriminador club/sel es genérico vía `compEmoji`, el auto-heal de
   pospuestos ya jugados es genérico por `tourId`+`matchKey`, y el
   self-heal de rondas KO bloqueadas es genérico vía `_selPair`/
   `_mhFindMister` — no hardcodea Atlético Madrid/Noruega).

## La card del HUB ("Próximo partido") también hereda la búsqueda server-side del escudo — `_psVsBlockHtml` se había quedado fuera del fix #7 (obligatorio, 2026-07-12 #8)

**Petición usuario 2026-07-12** (6 fotos, "Dunajska Streda" vs Atlético
Madrid, Previa de Champions — mismo caso que la sección #7 de abajo):
con el escudo y la plantilla de Dunajska Streda YA confirmados en el
editor de «Eslovaquia» (39 jugadores, escudo `cdn.resfu.com` válido),
la card **"Próximo partido"** del hub (la mini-card con escudo+VS+
botón "PREVIA · JUGAR" que aparece ANTES de entrar a la Pantalla de
Previa) seguía mostrando el hueco de Dunajska Streda completamente
VACÍO (ni siquiera el placeholder de iniciales) — pese a que, al pulsar
"PREVIA · JUGAR" y entrar a la Pantalla de Previa completa, el escudo
sí terminaba apareciendo (gracias al fix #7).

### Causa raíz — el fix #7 solo tocó la Pantalla de Previa, no la card del HUB

El fix #7 (`_ppShieldDeferredCheck` en `index.bundle.js`) resuelve el
escudo con búsqueda diferida en servidor SOLO dentro de
`_renderPreviaMeta` (la Pantalla de Previa a pantalla completa). La
card del HUB (`_cardCupCard`/`_wprevHubResolve` en `misc_body_1.html`,
además de las cards de Liga/Selección que comparten el mismo helper)
renderiza sus escudos vía `_psVsBlockHtml` → `_psVsTeamHtml`, que
SOLO probaba `o.shield` (ya resuelto por el caller, típicamente
`getTeamLogoUrl`/`_eurResolveTeamLogo`, ambos 100% locales) y, si
venía vacío, pintaba un `<div class="ps-shield"></div>` MUDO — sin id,
sin fallback de iniciales, y sin NINGÚN intento de preguntar al
servidor. Un dispositivo con `localStorage` lleno (mismo escenario
"Navegador sin espacio" de la sección #7) se quedaba con ese hueco
vacío para siempre en la card del hub, aunque la Previa completa (una
pantalla distinta, con su propio fix) sí lo resolviera segundos después.

### Fix

- **`_psVsTeamHtml(o, side)`** (`misc_body_1.html`): el `<img>`/`<div>`
  del escudo lleva ahora un id (`ps-shield-home`/`ps-shield-away`).
- **`_psResolveShield(o)`** (nuevo, extraído de la lógica que antes
  vivía inline en `_psVsTeamHtml`): resuelve `o.shield` → fallback
  `getTeamLogoUrl(o.name)`. Reutilizado por `_psVsBlockHtml` para saber
  si hace falta el fallback de servidor SIN duplicar la resolución.
- **`_psShieldDeferredCheck(side, teamName)`** (nuevo, mismo patrón
  EXACTO que `_ppShieldDeferredCheck`): llama a
  `window._eurTeamShieldServerSearch` (el endpoint
  `/api/team-shield/<nombre>` ya introducido en el fix #7) y, si lo
  encuentra, sustituye el placeholder vacío por el `<img>` real.
- **`_psVsBlockHtml(home, away, centerHtml)`**: tras construir el HTML,
  si a CUALQUIER lado le falta el escudo, agenda
  (`setTimeout(fn, 0)`, para correr justo después de que el caller
  asigne `st.innerHTML`) la comprobación diferida del lado que lo
  necesite. Como `_psVsBlockHtml` es el ÚNICO punto por el que pasan
  TODAS las cards del hub (Copa/Champions/Liga/Selección/Previa —
  7 call-sites), el fix cubre todas de un plumazo sin tocar cada
  call-site por separado.

### Reglas a respetar

1. **PROHIBIDO** que un helper de escudo NUEVO del hub (o cualquier
   variante futura de `_psVsTeamHtml`) pinte un placeholder vacío sin
   id y sin invocar `_psShieldDeferredCheck` cuando la resolución local
   viene vacía. El patrón "resolución local → placeholder con id →
   búsqueda diferida en servidor" es el mismo en LA PANTALLA DE PREVIA
   (`_ppShieldDeferredCheck`) y en LA CARD DEL HUB
   (`_psShieldDeferredCheck`) — ambos son obligatorios, uno no sustituye
   al otro (son 2 componentes de UI distintos).
2. **PROHIBIDO** volver a resolver el escudo de `_psVsBlockHtml`/
   `_psVsTeamHtml` de forma duplicada (una resolución para decidir si
   hace falta el fallback, otra distinta para pintar el `<img>`). Usar
   SIEMPRE `_psResolveShield` en ambos puntos para que no puedan
   discrepar.
3. Toda card NUEVA del hub que necesite escudo de equipo debe pasar por
   `_psVsBlockHtml` (no reinventar el pintado de escudo) para heredar
   este fallback automáticamente.

## Escudo, alias Y plantilla de un equipo IA de Resto de Ligas — los 3 heredan búsqueda SERVER-SIDE, no solo local (obligatorio, 2026-07-12 #7)

**Petición usuario 2026-07-12** (4 fotos, "Dunajska Streda" vs Atlético
Madrid, Previa de Champions — "el escudo, plantilla y Alias del equipo
IA lo tiene asignado y no sale reflejado en ninguna de las fotos, ni su
escudo en la card, ni la ❓️ con su alias, ni cuando añades un evento
los jugadores de la plantilla. Porque ocurre esto tan grave"): con el
escudo, alias eFootball ("America - 1🇺🇸 MLS - Los Ángeles WY ⭐⭐⭐⭐")
y plantilla (46 jugadores, stats reales) YA confirmados en el editor
de «Eslovaquia», la PANTALLA DE PREVIA seguía mostrando el placeholder
genérico de iniciales ("DUN") sin escudo, sin botón ❓, y el picker de
"+ AÑADIR EVENTO" habría mostrado el roster genérico "Jugador A/B/C…"
en vez de la plantilla real.

### Causa raíz — `localStorage` lleno + el escudo/plantilla NUNCA tuvieron fallback en servidor

El propio dispositivo mostraba el banner **"⚠️ Navegador sin espacio.
Los cambios se siguen subiendo al servidor, pero conviene limpiar caché
para reactivar el guardado local."** — `localStorage` está lleno y el
guardado LOCAL de una edición reciente puede fallar aunque el POST al
servidor SÍ se reintente hasta confirmar (patrón `_lsSetSafe` ya
documentado en el resto de este archivo). Mientras el guardado local
falla, la edición vive SOLO en (a) el servidor y (b) la memoria
(`window.LIGA_CACHE`) del dispositivo/pestaña que hizo la edición —
**NUNCA** en la pestaña de la Previa si es una sesión distinta (cada
pestaña tiene su propio `LIGA_CACHE` en memoria; `localStorage` sí se
comparte, pero justo ESE es el que falló al escribir).

De los 3 resolutores de identidad por nombre de la Previa, solo el
ALIAS ya tenía la cobertura completa (localStorage → `LIGA_CACHE` →
`TOUR_CACHE` → selecciones → **SERVIDOR** con reintentos,
`_efAliasServerSearch`/`/api/team-alias/<nombre>`, sección 2026-07-05
de más abajo). Los otros 2 se quedaban cortos:
- **`_eurResolveTeamLogo`** (escudo, sección #5/#6 de arriba): SOLO
  escaneaba `localStorage` — a diferencia de `_buildAliasCache` y
  `sqFromRegistry`, ni siquiera tenía el fallback a `window.LIGA_CACHE`
  (memoria), y mucho menos un fallback en servidor.
- **`sqFromRegistry`** (plantilla del picker de eventos): SÍ tenía el
  fallback a `LIGA_CACHE` (2026-07-06 #6), pero tampoco tenía fallback
  en servidor — si NINGUNA pestaña de este dispositivo tenía la liga en
  memoria esta sesión, caía al roster genérico "Jugador A/B/C…".

### Fix

- **`_eurBuildTeamLogoIndex`** (`misc_body_1.html`, junto a
  `_eurResolveTeamLogo`): añade el mismo pase por `window.LIGA_CACHE`
  que ya tenían `_buildAliasCache`/`sqFromRegistry` (rellena huecos,
  nunca pisa lo que ya encontró en `localStorage`).
- **`GET /api/team-shield/<nombre>`** (`app.py`, nuevo endpoint,
  mismo patrón exacto que `/api/team-alias/<nombre>`): busca el escudo
  de un equipo por nombre canónico en TODAS las `liga_ext_*` +
  `selecciones_squad_v1` del servidor, una sola petición.
  `window._eurTeamShieldServerSearch(nombre, onDone)` (cliente,
  timeout 6s) lo consume y backfillea `_eurLogoIdxCache` si lo
  encuentra.
- **`GET /api/team-squad/<nombre>`** (`app.py`, nuevo endpoint, mismo
  patrón): busca la plantilla (`players[]`) de un equipo por nombre en
  el servidor. `window._eurTeamSquadServerSearch(nombre, onDone)`
  (cliente): si encuentra el equipo, lo inyecta en
  `window.LIGA_CACHE.__server_squad_search__.teams[]` — **NO**
  duplica el parser de `sqFromRegistry` (POS_MAP, auto-numerado de
  dorsales, flags C/F/P/⭐/⚾); la siguiente llamada a
  `sqFromRegistry`/`sqFromRegistryFull` lo encuentra vía su propio
  escaneo de `LIGA_CACHE` y lo procesa con la lógica de siempre.
- **PANTALLA DE PREVIA** (`index.bundle.js`, `_renderPreviaMeta`): el
  `<img>`/fallback SVG del escudo de cada lado lleva ahora un id
  (`pp-shield-home`/`pp-shield-away`). Si la resolución local vino
  vacía, `_ppShieldDeferredCheck` llama a
  `_eurTeamShieldServerSearch` y, si encuentra el escudo, sustituye el
  placeholder por el `<img>` real — mismo patrón que
  `_ppAliasDeferredCheck` ya usaba para el alias.
- **Picker de eventos** (`part2/misc_body_2.html`, `_gmGetSquad`/
  `_gmRenderPlayerPick`): `_gmGetSquad` marca
  `_gmGetSquad._lastWasFallback` cuando cae al roster genérico. Si
  ocurre, `_gmRenderPlayerPick` dispara `_eurTeamSquadServerSearch` y,
  si encuentra la plantilla Y el picker sigue abierto para el MISMO
  equipo (no pisa una selección en curso del usuario), se
  re-renderiza con la plantilla real.
- Bump `index.bundle.js` 9.30 → 9.31 (`templates/index.html` +
  `PRECACHE` de `static/js/sw.js`).

### Reglas a respetar

1. **PROHIBIDO** que un resolutor de identidad por equipo NUEVO
   (escudo, alias, plantilla, estadio, o cualquier campo similar
   futuro) se quede SOLO en `localStorage`/`LIGA_CACHE`. Todo dato que
   el admin edita en UN dispositivo debe ser encontrable desde
   CUALQUIER OTRO vía un endpoint `GET /api/team-<campo>/<nombre>`
   (mismo patrón exacto que `/api/team-alias/<nombre>`: búsqueda
   server-side en `liga_ext_*` + `selecciones_squad_v1`, una sola
   petición, timeout 6s en el cliente) — la alternativa (confiar en que
   `localStorage`/`LIGA_CACHE` de ESE dispositivo concreto tengan el
   dato) falla exactamente en el caso más común de "Navegador sin
   espacio", que este proyecto ya documenta como frecuente.
2. **PROHIBIDO** que la búsqueda en servidor de la plantilla duplique
   el parser de `sqFromRegistry` (POS_MAP/dorsales/flags). Inyectar el
   equipo encontrado en `LIGA_CACHE` y dejar que `sqFromRegistry` lo
   procese con su lógica existente — un único punto de conversión.
3. **PROHIBIDO** que el picker de eventos se re-renderice con la
   plantilla recién encontrada en servidor SIN comprobar que sigue
   abierto para el MISMO equipo — evita pisar una selección de
   jugador ya en curso si el admin cambió de pantalla mientras la
   búsqueda volaba.
4. Toda tabla/card/cruce/picker NUEVO de la Previa (o de cualquier
   competición que resuelva identidad de un equipo de Resto de Ligas
   por nombre) hereda `_eurTeamShieldServerSearch`/
   `_eurTeamSquadServerSearch` como último fallback, igual que ya
   hereda `_eurResolveTeamLogo`/`getTeamEfootballAlias`.

## 📌 PARTIDOS POSPUESTOS mezclaba los pospuestos de TODAS las cajas de mister — filtro de pertenencia por mister (obligatorio, 2026-07-12 #7)

**Petición usuario 2026-07-12** (4 fotos, caja **Real Madrid-Inglaterra-
Acsa**): la pestaña "CLUB (9)" de 📌 PARTIDOS POSPUESTOS mostraba
`MUNDIAL · OCTAVOS/CUARTOS/SEMIS — Francia SIN RIVAL`, `Noruega vs
Senegal`, `Noruega vs Iraq`, `Francia vs Noruega`, `Atlético vs Inter`,
`Noruega SIN RIVAL (Mundialito Octavos)` — **ninguno de esos partidos
involucra al Real Madrid**. Solo 1 de los 9 (Trofeo Joan Gamper ·
Partido 1: Real Madrid vs Liverpool) pertenecía de verdad a esta caja.
"No entiendo que tiene que ver Francia o Noruega — Francia tiene que ir
con Francia, Noruega con Noruega, cada pospuesto con su equipo."

### Causa raíz

`pend_hvh_deferred_v1` (`misc_body_1.html`) es un store **GLOBAL**
compartido por las 7 cajas de mister — cualquier partido pospuesto
desde CUALQUIER hub (📌 Posponer) se añade al MISMO array. Eso es
correcto (debe viajar cross-device); el bug estaba en el RENDER de
`s-munich` → sección 📌 PARTIDOS POSPUESTOS (`_render('posp')`, dentro
del IIFE "Cajas POSPUESTOS · PENDIENTES · JUGADOS"): leía el array
COMPLETO (`_pendHvHGet()`, sin filtrar por hub) y bucketeaba CADA
entrada en la pestaña "Club" o "Selección" de la caja ACTIVA. El
bucketing (heredado del fix 2026-06-13 "el bucketing ESTRICTO
descartaba partidos que no casaban con el hub ni con la selección")
decidía: si toca la SELECCIÓN de este hub → 'sel'; **TODO LO DEMÁS →
'club' por defecto** — sin comprobar si esa entrada pertenecía siquiera
remotamente al CLUB de este hub. Cualquier pospuesto de OTRO mister
(Francia/Toñín, Noruega/Isra) que no fuera la selección de ESTE hub
(Inglaterra) caía en el catch-all "club" y contaminaba la caja del
Real Madrid.

### Fix

`_entrySide(e)` (`misc_body_1.html`, IIFE de `s-munich`) ahora exige
PERTENENCIA antes de bucketear: nuevo `_isClubName(n)` (nombre EXACTO
del hub, o alias legacy del MISMO mister vía `_isHumanClubCanonico(n)
&& _mhSameMister(hub, n)` — cubre "Bayern Munich"→Liverpool/Toñín,
"Paris SG"→PSG/Izan, etc., SIN colar el alias de OTRO mister). Una
entrada solo entra en 'sel' si `_isSelName` casa, en 'club' si
`_isClubName` casa (en `home` o `away`), y si NINGUNO de los dos casa
se **EXCLUYE** (`return null`) — no se pierde: sigue viva en el store
global y aparece en la caja del mister al que sí pertenece.
**Deliberadamente NO se reutiliza `_aliasesLiga(hub)`** para el check
de club: esa función inyecta el alias "Bayern Munich" para CUALQUIER
hub (genérica para el colector de Liga EA Sports), lo que habría vuelto
a colar los pospuestos de Liverpool en la caja de cualquier otro
mister — el check nuevo usa `_mhSameMister` para que el alias solo
aplique al mister correcto.

### Reglas a respetar

1. **PROHIBIDO** que un render que lea `pend_hvh_deferred_v1` (u otro
   store GLOBAL compartido por las 7 cajas de mister) bucketee una
   entrada en la caja ACTIVA sin comprobar antes que esa entrada
   PERTENECE a ese mister (club O selección, en home o away). Un
   catch-all "si no es la selección de este hub, es del club de este
   hub" es SIEMPRE incorrecto — hay 6 OTROS misters cuyos pospuestos
   viven en el MISMO array.
2. **PROHIBIDO** reutilizar `_aliasesLiga(hub)` (o cualquier función que
   inyecte el alias "Bayern Munich"/"Paris SG"/etc. de forma
   INCONDICIONAL para cualquier hub) como filtro de pertenencia. El
   alias legacy de un mister SOLO debe reconocerse para SU PROPIO hub —
   usar `_isHumanClubCanonico(n) && _mhSameMister(hub, n)`.
3. Toda caja de mister NUEVA hereda el filtro automáticamente (genérico
   vía `_mhFindMister`/`_mhSameMister`/`_isHumanClubCanonico`/
   `_isHumanSeleccionCanonica` — no hardcodea Real Madrid/Inglaterra).
4. Una entrada que no pertenece a NINGÚN mister conocido (p.ej. un IA
   vs IA que se pospuso por error) se excluye de las 7 cajas sin
   perderse del store — sigue disponible si algún día se necesita
   depurar el array global directamente.

## `saveData` también invalidaba el índice de escudos con retraso de hasta 30s — ahora invalida al instante (obligatorio, 2026-07-12 #6)

**Petición usuario 2026-07-12** (2 fotos, Ronda Preliminar de la Previa
de Champions, "otra vez con el problema de los equipos que no existen
en el juego, que tienen alias para que emerga la ❓️"): tras editar el
equipo **Maccabi Haifa** en «Editar equipos · Israel» (escudo ya
puesto + alias eFootball ya relleno: "Europa - 2ª 🏴 Norwich ⭐⭐⭐½"),
el partido **Atlético Madrid vs Maccabi Haifa** de la Ronda Preliminar
seguía mostrando el escudo genérico (iniciales "MAC" sobre fondo
gris) en la PANTALLA DE PREVIA.

### Causa raíz — el índice de escudos NUNCA se invalidaba al editar en local

`_eurResolveTeamLogo` (el resolutor cross-liga por nombre que la
sección #5 de arriba introdujo para `_logoOf` en la Previa/Ronda
Preliminar/fase de grupos) cachea su índice `_eurLogoIdxCache` durante
**30 segundos** — barato para no re-escanear ~50 `ligaExt_*` en cada
fila de una tabla. La invalidación explícita
(`window._eurInvalidateLogoIndex()`) SOLO se llamaba desde
`_eurHydrateMissingLeagues` (cuando trae escudos NUEVOS del
SERVIDOR) — **nunca** desde `saveData` (el chokepoint único por el
que pasa CUALQUIER guardado de una liga en ESTE dispositivo, incluida
la propia edición del admin en «Editar equipos»). El **alias**
(`_ALIAS_CACHE`, TTL 3s) SÍ se invalidaba ya en `saveData` — por eso
el alias podía llegar a aparecer tras unos segundos de espera (vía el
`_ppAliasDeferredCheck` con reintentos + el TTL corto), mientras el
escudo se quedaba con el placeholder genérico hasta 30s después de
cada guardado, y CUALQUIER guardado posterior en OTRA liga
reiniciaba la ventana de 30s sin que el admin lo supiera.

### Fix

`saveData(k,d)` (`misc_body_1.html`, el único punto por el que pasa
TODO guardado de `ligaExt_<slug>` en este dispositivo — editor
clásico `lextSaveTeam`, editor de cards `_lcCommit`, pegado masivo,
sim de liga/copa, etc.) llama ahora también a
`window._eurInvalidateLogoIndex()` justo después de
`window._invalidateAliasCache()` — mismo patrón, mismo sitio. El
siguiente render de la Previa de Champions (card del hub, tablas de
grupo, Ronda Preliminar, jornadas del fixture) ve el escudo recién
guardado al instante, sin esperar el TTL de 30s.

### Reglas a respetar

1. **PROHIBIDO** que un cache nuevo de identidad por equipo (escudo,
   alias, estadio, plantilla…) se invalide SOLO desde una ruta de
   hidratación del SERVIDOR (`_eurHydrateMissingLeagues` y
   equivalentes) sin invalidarse TAMBIÉN desde `saveData` — el guardado
   LOCAL del propio admin es la ruta MÁS COMÚN de cambio, y sin
   invalidación ahí el fix de resolución cross-liga (sección #5) se
   siente "a medias" (funciona para escudos ya viejos, tarda hasta
   30s para uno recién editado).
2. Todo cache nuevo de este tipo hereda el patrón: su función
   `_xxxInvalidateYyy()` se registra en `window.*` y se llama desde
   `saveData` junto a `_invalidateAliasCache`/`_invalidateLineStatsCache`
   — un único chokepoint, no un botón/ruta aislada.

## Previa de Champions — escudos AUSENTES, refuerzo #2: cache de `getLogoEquipo` STALE + escudo-default (Estepona) mostrándose como si fuera el escudo real (obligatorio, 2026-07-12 #6)

**Petición usuario 2026-07-12** (sin fotos, tras el fix #5): "siguen sin
salir los escudos y eso que el 90% de los equipos los tienen / en liga
previa Champions tienes que salir en la clasificación y en las cards
donde haya un humano implicado / en la card del Atlético Madrid el del
Macca Haifa dale oculto". El fix anterior (`_eurResolveTeamLogo` +
`_eurHydrateMissingLeagues` con escudos) era correcto pero insuficiente
— 3 causas adicionales seguían bloqueando el resultado.

### Causa raíz (3 capas más)

1. **`getLogoEquipo` (`part2/misc_body_2.html`) MEMOIZA su resultado
   por nombre en `TEAM_LOGO_CACHE`, para SIEMPRE**. Si un equipo se
   consulta ANTES de que `_eurHydrateMissingLeagues` termine de traer
   su escudo del servidor (típico: la Previa se renderiza nada más
   entrar, la hidratación en segundo plano tarda unos segundos más),
   el resultado (vacío o el escudo-default) queda cacheado — ninguna
   hidratación POSTERIOR lo corrige en esa sesión. `window
   ._invalidateTeamLogo(name)` ya existía para invalidar UNA entrada
   pero ningún flujo de hidratación lo llamaba.
2. **El umbral de re-hidratación era "re-pedir SOLO si a la MAYORÍA le
   falta el escudo"** (fix #5). El caso real más común es justo lo
   contrario: una liga con la mayoría de equipos YA con escudo pero
   UN puñado concreto (p.ej. solo Maccabi Haifa) sin él — ese caso
   nunca cruzaba el umbral de "mayoría" y la liga jamás se re-pedía.
3. **`_pickLogo` (previa, `index.bundle.js`), `_gmLogo`/`_gmLogoUrl`×2
   (gm-modal, `part2/misc_body_2.html`) caían a `getLogoEquipo(name)`
   sin filtrar su escudo-default** (`/static/img/escudos-fallback/
   estepona.svg`, `BACKEND_ESCUDO_DEFAULT`). A diferencia de otros
   call-sites del proyecto que YA filtran este caso
   (`indexOf('estepona')===-1`), estos 3 NO lo hacían — así que un
   equipo sin escudo real en NINGUNA fuente no se ocultaba: mostraba
   el escudo AJENO de Estepona como si fuera el suyo. Es lo que el
   usuario ve como "el del Maccabi Haifa" — una imagen real pero
   incorrecta, en vez de nada.

### Fix

- **`window._invalidateAllTeamLogos()`** (nuevo, `part2/misc_body_2.html`,
  junto a `window._invalidateTeamLogo`): vacía TODA `TEAM_LOGO_CACHE`
  de golpe (más simple y seguro que invalidar por nombre — es solo una
  cache de rendimiento). `_eurHydrateMissingLeagues`
  (`misc_body_1.html`) lo llama tras cada escudo nuevo traído del
  servidor, junto a `_eurInvalidateLogoIndex()` (el propio índice de
  `_eurResolveTeamLogo`).
- **Umbral de re-hidratación**: de "re-pedir si a la MAYORÍA le falta
  el escudo" a **"re-pedir si a UN SOLO equipo le falta"**
  (`withShield < d.teams.length`). Más caro en peticiones pero
  correcto para el caso real (equipos sueltos sin escudo dentro de una
  liga ya casi completa); sigue siendo secuencial+pausado+con
  reintentos (sin thundering herd) y throttled a 1 pasada/5 min.
- **`_pickLogo`** (`index.bundle.js`, bump `9.30`→`9.31`), **`_gmLogo`**
  y **`_gmLogoUrl`×2** (`part2/misc_body_2.html`): antes de caer a
  `getLogoEquipo`, prueban `window._eurResolveTeamLogo(name)`. Si
  `getLogoEquipo` como último recurso devuelve el escudo-default
  (contiene `'estepona'`), se trata como **VACÍO** — el caller ya sabe
  ocultar un escudo vacío (`lA ? <img> : ''` en `_gmLogo`, el fallback
  procedural de iniciales `_ppShieldFallback` en la previa) en vez de
  mostrar el escudo de un equipo ajeno.

### Reglas a respetar

1. **PROHIBIDO** que un resolutor de escudo por nombre memoice su
   resultado (`TEAM_LOGO_CACHE` o cualquier cache nueva) sin que TODO
   flujo de hidratación que pueda traer un escudo nuevo (`_eurHydrateMissingLeagues`
   o cualquier futuro) invalide esa cache al terminar. Una cache sin
   invalidación convierte un fix correcto en inútil durante toda la
   sesión del usuario.
2. **PROHIBIDO** que el umbral de "¿hace falta re-hidratar esta liga
   por escudos?" vuelva a ser "a la MAYORÍA le falta". El caso real es
   equipos SUELTOS sin escudo dentro de ligas casi completas — el
   umbral correcto es "a CUALQUIER equipo le falta".
3. **PROHIBIDO** que un resolutor de escudo nuevo (previa, gm-modal, o
   cualquier card futura) caiga a `getLogoEquipo`/cualquier fuente que
   pueda devolver el escudo-default (Estepona) SIN filtrarlo. Un
   escudo-default devuelto como si fuera real es PEOR que no mostrar
   nada — todo caller debe tratarlo como vacío (`indexOf('estepona')`)
   y dejar que el fallback de "sin escudo" (oculto / iniciales
   procedurales) actúe.
4. Recordatorio: cualquier edición de `index.bundle.js` exige bump de
   `?v=X.X` en `templates/index.html` Y `static/js/sw.js` (regla ya
   existente, 2026-07-04) — este fix la cumple (9.30→9.31).

## Previa de Champions — escudos AUSENTES en la card, la fase de grupos y los partidos del Atlético: resolutor cross-liga por nombre (obligatorio, 2026-07-12 #5)

**Petición usuario 2026-07-12** (6 fotos): "mi hija iPad tiene escudo y
no sale en la principal del calendario del Atlético Madrid en la
previa de champion, todos los equipos tienen escudo y no salen en la
fase de grupos ni los partidos que va a jugar el Atlético Madrid.
Tienen que salir los escudos de todos los equipos." Las plantillas de
Resto de Ligas SÍ tienen escudo configurado (confirmado en el iPad),
pero en la Previa de Champions (card del hub, tablas de los 12 grupos,
Ronda Preliminar, jornadas del fixture del Atlético) la inmensa
mayoría de equipos salían SIN escudo — solo un puñado (los de unas
pocas ligas concretas) lo mostraban.

### Causa raíz (2 capas del mismo problema: "el escudo vive en OTRO dispositivo/liga que este render no consulta")

1. **`_eurHydrateMissingLeagues`** (`misc_body_1.html`, el auto-
   hidratador que trae del servidor las `ligaExt_<slug>` que faltan
   antes de calcular cualquier reparto europeo) solo comprobaba si a
   una liga le faltaban EQUIPOS o RESULTADOS — nunca si le faltaban
   ESCUDOS. Una liga que YA tenía equipos+resultados completos en
   ESTE dispositivo (aunque sin `team.shield`, por ejemplo porque este
   móvil nunca abrió esa liga y solo la hidrató vía un seed/backfill
   ligero) se consideraba "ya completa" y NUNCA se volvía a pedir al
   servidor — así que el escudo (guardado en el servidor por el iPad)
   jamás llegaba a este dispositivo.
2. **`_logoOf`/`_sh`** (los resolutores de escudo por NOMBRE que usan
   `_badge`/`_badgeBig` en la Previa — `_groupTable`, `_prelimTieHtml`,
   `_fgJornadaHtml` — y `_cardCupCard` en la card del hub) caían
   ÚNICAMENTE a `getTeamLogoUrl`/`TEAM_LOGOS`, que **nunca** escanean
   `ligaExt_<slug>` (regla ya documentada, sección "escudo del rival
   viaja con la previa" de arriba). Aunque el pool de la Previa SÍ
   resuelve bien el `.logo` en el momento de construir el pool (vía
   `_teamLogo(t)`), ese valor queda CONGELADO en `wprev_state_v1` en
   cuanto se sortea — si en ese instante el dispositivo no tenía la
   liga de origen hidratada, el `.logo` quedaba vacío PARA SIEMPRE en
   ese grupo/cruce/fixture ya sorteado, sin que ninguna hidratación
   posterior lo corrigiera retroactivamente.

### Fix

- **`_eurHydrateMissingLeagues`**: el filtro `toFetch` añade un 3er
  motivo para re-pedir una liga al servidor — si menos de la mitad de
  sus equipos tienen `shield`/`logo`/`escudo`/`img`/`src` no vacío, se
  re-hidrata. En el fetch, la rama donde el local "gana" por tener más
  jugadores (`keep=true`) ahora TAMBIÉN hace backfill de escudos desde
  la respuesta del servidor hacia el local (antes solo mezclaba
  `results`) — y la rama donde gana el servidor hace el backfill en
  sentido inverso, para no perder un escudo que solo estuviera en la
  copia local descartada. Usa `window._lextBackfillShields` (el helper
  ya existente de la sección "Escudos de Resto de Ligas — backfill por
  nombre", ahora expuesto en `window` para poder llamarlo desde esta
  otra IIFE).
- **`window._eurResolveTeamLogo(name)`** (nuevo, `misc_body_1.html`,
  junto a `_teamLogo`): escanea TODAS las `ligaExt_<slug>` cacheadas
  localmente y devuelve el escudo por nombre normalizado —
  independientemente de cuándo se sorteó/persistió el equipo en
  cualquier pool. Cache de 30s (`window._eurInvalidateLogoIndex()` la
  invalida en cuanto `_eurHydrateMissingLeagues` trae escudos nuevos).
  Es el resolutor "por nombre, en caliente" que faltaba: cubre tanto
  equipos con `.logo` vacío en snapshots YA sorteados (Ronda
  Preliminar, grupos, fixture) como cualquier pool futuro.
- **`_sh` (card del hub, `misc_body_1.html`, dentro de
  `_cardCupCard`)** y **`_logoOf` (Previa, `part2/misc_body_2.html`)**
  caen a `window._eurResolveTeamLogo(name)` cuando `getTeamLogoUrl`/
  `TEAM_LOGOS` no lo resuelven — esto arregla de un plumazo la card
  del hub, la tabla de cada uno de los 12 grupos (`_groupTable`), los
  cruces de la Ronda Preliminar (`_prelimTieHtml`) y las jornadas del
  fixture del club humano (`_fgJornadaHtml`), sin tener que re-sortear
  nada ni tocar los datos ya persistidos.
- **`_wprevKoAbrirPrevia`/`window._wprevPlayHumanMatch`**
  (`part2/misc_body_2.html`, los 2 puntos que abren la previa/gm-modal
  de un partido concreto de la Previa): `_hLogo`/`_aLogo` caen a
  `_logoOf(nombre)` cuando el `.logo` del pool venía vacío, para que
  la PANTALLA DE PREVIA (no solo la tabla) también muestre el escudo
  real al abrir el partido del Atlético.

### Reglas a respetar

1. **PROHIBIDO** que un auto-hidratador de ligas (`_eurHydrateMissingLeagues`
   o cualquier futuro) considere una liga "completa" mirando solo
   equipos+resultados. Si le faltan escudos a la mayoría de sus
   equipos, sigue necesitando re-hidratarse — el escudo es un dato de
   IDENTIDAD que puede vivir en OTRO dispositivo aunque este ya tenga
   la clasificación entera.
2. **PROHIBIDO** que una tabla/card/cruce NUEVO de la Previa (o de
   cualquier competición que dibuje escudos de Resto de Ligas) resuelva
   el escudo SOLO desde el campo `.logo` congelado en el momento del
   sorteo, sin un fallback que re-resuelva por nombre en caliente
   (`window._eurResolveTeamLogo`). Un pool sorteado en un dispositivo
   con hidratación incompleta congela escudos vacíos para siempre si no
   hay este fallback.
3. **PROHIBIDO** que `_sh`/`_logoOf` (o cualquier resolutor de escudo
   por nombre nuevo en el hub o en una competición) se quede solo en
   `getTeamLogoUrl`/`TEAM_LOGOS` — ambos NUNCA escanean `ligaExt_*`.
   Todo resolutor de este tipo hereda `window._eurResolveTeamLogo` como
   último fallback.
4. Toda competición NUEVA que sortee equipos de Resto de Ligas hereda
   este fix automáticamente en cuanto sus renders de escudo pasen por
   `_sh`/`_logoOf` (o llamen directamente a `window._eurResolveTeamLogo`
   como último recurso) — no hardcodear una lista de ligas "que sí
   tienen escudo".

## Previa de Champions — card del HUB para "Previa Champions — J<N>" + el escudo del rival viaja con la previa (obligatorio, 2026-07-12 #4)

**Petición usuario 2026-07-12** (4 fotos): "en la caja Atlético Madrid
debe salir en grande como están el resto la card de la foto 2 (creo
que solo es error en la Previa de Champions) / fijate en la foto 3 el
calendario y automatizalo / el rival tiene escudo pero en la card del
partido no sale". Con el fixture de 6 jornadas del grupo humano ya
implementado (sección de arriba, 2026-07-12 #2), la card "Próximo
partido" del hub (`s-atletico`/cualquier hub) en un día de calendario
"Previa Champions — J1".."J6" seguía cayendo al placeholder genérico
("La jornada se juega desde la pantalla de la competición" +
CONTINUAR ▶) en vez de mostrar la card grande del partido — y, cuando
el partido SÍ se abría desde la propia pantalla de Previa, el escudo
del rival (equipo de Resto de Ligas, visible en la clasificación) no
aparecía en la card ni en la previa.

### Causa raíz 1 — sin resolver para el hub

`_cardNonTour(day)` (`misc_body_1.html`, la cadena de resolvers que
intenta mapear la etiqueta del calendario a un partido real de cada
competición: Copa, Recopa, SC, USC, EurKo, Eur…) no tenía NINGUNA rama
para "Previa Champions — J<N>". Ninguno de los resolvers existentes
conoce `wprev_state_v1` ni su fixture por grupo, así que SIEMPRE caía
al genérico.

### Causa raíz 2 — `getTeamLogoUrl` no conoce Resto de Ligas

`getTeamLogoUrl(name)` (`static/js/index.bundle.js`) solo resuelve
escudos desde `_ligaEaShields`/`TEAM_LOGOS`/`TEAM_RATINGS`/
`_TOUR_CACHE` — **nunca** escanea `ligaExt_<slug>` (Resto de Ligas).
El pool de la Previa (`computeUclPrevDirectTeams`/
`computeUclPrevOqPoolTeams`) SÍ trae el `.logo` correcto (via
`_teamLogo(t)`, el mismo que usa la tabla de clasificación de Resto de
Ligas), pero ese dato se perdía en cuanto la previa/card intentaban
re-resolver el escudo por nombre con `getTeamLogoUrl`.

### Fix

- **`_wprevHubResolve(lbl)`** (nuevo, `misc_body_1.html`, junto a
  `_cardEurKoPending`): parsea `Previa Champions — J<N>` con regex,
  localiza el grupo con club humano en `wprev_state_v1.groups` y, en
  su `fixtures[gi]`, el partido de esa jornada (`jornada === N-1`) que
  involucra al humano. Devuelve el descriptor `{home, away, homeLogo,
  awayLogo, rival, rivalHuman, played, gh, ga, events, mvp, mvpTeam,
  uid, emoji:'🔵', open}` que ya consume `_cardCupCard`. Wireado en
  `_cardNonTour` justo después de `_eurHubResolve`.
- **`_cardCupCard`**: ahora prioriza `r.homeLogo`/`r.awayLogo` (si el
  resolver los trae) sobre su propio `_sh()`/`getTeamLogoUrl()` —
  mismo patrón que ya usaba `copaAbrirPrevia` para equipos de PF/
  Hypermotion que tampoco están en `getTeamLogoUrl`.
- **`_ppPreviaTeams.homeLogo`/`.awayLogo`** (override YA EXISTENTE que
  lee `_renderPreviaMeta` con prioridad sobre su resolución interna):
  se rellenan con el `.logo` correcto del pool en los 3 puntos que
  abren la previa de un partido de la Previa de Champions —
  `_wprevKoAbrirPrevia` (Ronda Preliminar), `window._wprevPlayHumanMatch`
  (fixture de grupo, `part2/misc_body_2.html`) y el propio
  `_wprevHubResolve` (`misc_body_1.html`).
- **`window._wprevSaveHumanResult(gi, j, gh, ga, events, mvp, mvpTeam)`**
  (firma ampliada, antes solo `(gi, j, gh, ga)`): persiste también el
  acta (`m.events`, sin eventos `pen-result`) y el MVP
  (`m.mvp`/`m.mvpTeam`) en el partido del fixture — necesarios para que
  la card del hub pinte el resumen del partido jugado. Los 2 call
  sites que lo invocan (`_gm._isWprev` en `gmEndMatch` y el
  equivalente `st.isWprev` en `_mlFinishMatchGen`, ambos en
  `part2/misc_body_2.html`) extraen MVP/eventos de `_gm.events`/
  `st.events` y los pasan; el branch de gm-modal además llama a
  `registrarLigaPlayerStats` (mismo patrón que el resto de comps
  europeas) para que las stats del jugador computen igual.

### Reglas a respetar

1. **PROHIBIDO** que una competición NUEVA con partidos humanos
   propios (fixture, KO, lo que sea) quede sin resolver en la card del
   hub. Toda comp nueva debe añadir su rama a la cadena de resolvers de
   `_cardNonTour` (mismo patrón `_xxxHubResolve(lbl)` → descriptor
   consumido por `_cardCupCard`), igual que Recopa/SC/USC/EurKo/Eur.
2. **PROHIBIDO** confiar en `getTeamLogoUrl`/`_sh()` como ÚNICA fuente
   del escudo cuando el rival puede venir de Resto de Ligas (esa
   función NUNCA escanea `ligaExt_*`). Si el pool/estado de la comp ya
   trae un `.logo` correcto (como el pool de la Previa, via
   `_teamLogo(t)`), pasarlo explícitamente por
   `_ppPreviaTeams.homeLogo`/`.awayLogo` (o el campo `homeLogo`/
   `awayLogo` del descriptor de `_cardCupCard`) — NUNCA re-resolverlo
   por nombre.
3. **PROHIBIDO** que `window._wprevSaveHumanResult` (o cualquier
   persistor de resultado humano de una comp con card propia) guarde
   SOLO el marcador sin acta/MVP — la card del hub y las stats del
   jugador dependen de que `events`/`mvp`/`mvpTeam` viajen con el
   resultado.

## Previa de Champions — grupo humano en AZUL, píldora "Previa" en vez de "vs" + sin botón aparte, Champions en azul (obligatorio, 2026-07-12 #3)

**Petición usuario 2026-07-12** (foto de la jornada del grupo con
Atlético Madrid): "el grupo de Previa de Champions que tengo equipo
humano en color azul para diferenciarlo. La palabra previa en los
partidos donde haya un humano en la fase previa tiene que ir en el
medio donde pone VS (poniendo solo Previa) quitando lo de ⭐️>
PREVIA > JUGAR. En cada grupo en color azul el primer clasificado (ya
que va a Fase grupo Champions) en Naranja los que van a Europa League
y en color verde los que van a conference".

### 1) Grupo con club humano — AZUL (antes dorado/rojo Atlético)

`.wprev-group.wprev-group-human`/`.wprev-row.wprev-row-human`
(`misc_body_1.html`) pasan de la paleta dorado+rojo (`#f0c040`/
`#c50f1f`, "Atlético-themed") a AZUL (`#4aa3ff`/`#1560c9`/`#0a2a5a`).
`_groupTable` (`part2/misc_body_2.html`) ahora SÍ añade estas clases
(antes existían en el CSS pero ninguna función las generaba —
`wprev-group-human` en la fila del contenedor si `_groupHasHuman(grp)`,
`wprev-row-human` en la fila de un jugador si `_prevIsHuman(r.name)`).

### 2) La píldora central dice "Previa" en vez de "vs" — sin botón aparte

`_fgJornadaHtml`: el partido del humano SIN jugar ya NO pinta
`⭐ ▶ PREVIA · JUGAR` como botón debajo de la fila — la propia píldora
central (`<span class="sc">`, donde antes ponía "vs") se convierte en
un `<button class="sc wprev-fg-play-btn">Previa</button>` clicable
(mismo `data-gi`/`data-j`, mismo wiring de `buildUclPrevClas` que ya
buscaba `.wprev-fg-play-btn` por selector de clase — sigue funcionando
sin cambios). CSS nuevo `.wprev-mrow .sc.wprev-fg-play-btn` resetea los
estilos por defecto de `<button>` para que la píldora se vea igual de
compacta que el "vs"/marcador, con el mismo dorado de "jugable" que
tenía el botón antiguo.

### 3) Colores del reparto de grupo — Champions AZUL (antes púrpura)

`.wprev-row.qual-best` (1º de grupo → Champions) pasa de púrpura
(`#a855f7`) a AZUL (`#4aa3ff`), igual en la leyenda superior ("1º grupo
→ Champions", punto de color) y en la leyenda inferior tras simular
("■ Champions (1º)"). `.wprev-row.qual-death` (Europa, naranja
`#F37335`) y `.wprev-row.qual-conf` (Conference, verde `#5fe08a`) NO
cambian — ya eran naranja/verde tal como pedía el usuario.

### Reglas a respetar

1. **PROHIBIDO** volver a pintar el grupo con club humano en dorado/rojo
   — es AZUL (`#4aa3ff` de borde/acento). El resto de highlights de la
   Previa (Ronda Preliminar, cruce del humano) siguen su propio
   esquema dorado — NO se tocan, son una sección distinta.
2. **PROHIBIDO** reintroducir el botón `⭐ ▶ PREVIA · JUGAR` como
   elemento separado bajo la fila. El disparador del partido humano
   pendiente ES la propia píldora central, con el texto "Previa".
3. **PROHIBIDO** que `qual-best` (1º de grupo, destino Champions)
   vuelva a `#a855f7` (púrpura). Es azul, a juego con el resto de la UI
   de Champions (`--comp-color:#88aaff` del gm-modal).
4. Toda tabla de grupo NUEVA de esta pantalla hereda el marcado
   `wprev-group-human`/`wprev-row-human` automáticamente en cuanto
   pase por `_groupTable` — no hardcodear qué grupo es "el humano".

## Previa de Champions — la Ronda Preliminar es "videojuego" + colapsable, y el club humano JUEGA sus propios partidos (obligatorio, 2026-07-12 #2)

**Petición usuario 2026-07-12** (2 fotos: "Ronda Preliminar · Open
Qualifier (14 cruces)" en texto plano · tabla morada "GRUPO A/B/C"):
"La fase preliminar de eliminatoria de la previa de la champion, que
sea un poco más como videojuego que salgan ver de los equipos que se
clasifican, y cuando se acabe que se pueda cerrar la pestaña para ver
bien los grupos de previa ya de champion, y el equipo humano hay que
poder simular sus partidos como equipo humano, con sus cards y
partidos. El resto de grupos se puede simular sin necesidad de
desplegar las 6 jornadas". Hasta este cambio, la Ronda Preliminar
(sección de arriba, 2026-07-12 #1) y la fase de grupos eran **100%
IA-vs-IA**, incluso para el cruce/partidos del club humano — exactamente
lo que ya avisaba esa misma sección ("Sin partidos humanos
individuales... `_wprevPlayHumanMatch`/`_wprevSaveHumanResult` quedan
como no-ops").

### 1) Ronda Preliminar — cards con escudo grande + destacado dorado

`_prelimTieHtml` (IIFE de la Previa, `part2/misc_body_2.html`) reactiva
las clases CSS `.wprev-dr-tie`/`.wprev-dr-leg`/`.wprev-dr-agg`
(definidas desde el formato "Death Round" antiguo pero sin usar —
`_prelimTieHtml` pintaba con `.wprev-mrow`, la fila compacta de
jornadas). Nuevo helper `_badgeBig(name,logo)` (escudo con `class="crest"`,
30px normal / 38px si el cruce es del humano vía
`.wprev-dr-tie.human .crest`, CSS en `misc_body_1.html`). El cruce
con un club humano (`_tieHasHuman`) se destaca en dorado
(`.wprev-dr-tie.human`, mismo lenguaje visual que `.wprev-group-human`)
con la etiqueta "⭐ TU CRUCE".

### 2) Colapsable — "cuando se acabe, cerrar para ver los grupos"

`_renderPrelim` pinta un chevron clicable (`#wprev-dr-toggle`, CSS
`.wprev-dr-chev`/`.collapsed` YA EXISTÍA del diseño antiguo, solo
faltaba cablear el toggle). Estado por defecto: **colapsado** en cuanto
existen los 12 grupos (`s.phase==='groups-drawn'||'done'`), **expandido**
mientras la preliminar aún se está jugando — salvo que el admin fuerce
lo contrario con el chevron (`_drCollapsedManual`, variable de módulo,
persiste mientras la pantalla siga montada).

### 3) El club humano JUEGA su cruce de la Ronda Preliminar (ida+vuelta)

**Nunca se auto-simula** un cruce donde participe un club humano
(`_tieHasHuman` + `_tieBothReal` — un BYE con hueco TBD sí se resuelve
solo, haya humano o no en el lado real). Nuevas funciones (mismo
patrón que `_eurKoOpenMatch`/`abrirEurKo`/`_eurKoSaveHumanResult` de
Champions/Europa/Conference eliminatorias, pero AUTOCONTENIDAS en la
propia IIFE de la Previa — no se generaliza el motor `_eurKo*` para no
arriesgar UCL/UEL/UECL):

- `window._wprevKoOpenMatch(idx)` — abre la previa + gm-modal (ida si
  `tie.legs` vacío, vuelta si ya hay 1 leg jugado). `comp:'ucl'` (tema
  azul Champions, igual que el resto de la Previa).
- `window.abrirWprevKo(idx, leg, home, away)` — marca
  `_gm._isWprevKo`/`_wprevTieIdx`/`_wprevLeg`/`_wprevIda` (la ida
  persistida, para poder decidir el GLOBAL en la vuelta — mismo patrón
  que `_gm.dobleIda` de los amistosos doble-vuelta).
- `window._wprevKoSaveHumanResult(idx,leg,gh,ga,etGh,etGa,penWinner)` —
  persiste el marcador en `wprev_state_v1.prelim.ties[idx]`. En la
  VUELTA calcula el agregado; si empata, prórroga (lambda reducido,
  igual que `_simulatePrelimTie` IA) y, si sigue empatado, penaltis.
  Si con esto TODOS los cruces quedan decididos (`_allPrelimDecided`),
  `phase` pasa a `'prelim-done'` sin que el admin tenga que volver a
  pulsar Sim.
- gm-modal (`part2/misc_body_2.html`, `gmRenderTimer`+`gmEndMatch`):
  nuevas `_isWprevKoVuelta`+`_wprevKoTied` (mismo cálculo que
  `_isAmsDobleVuelta`/`_amsDobleTied`) se añaden a `_shouldForceET` en
  LOS 2 SITIOS donde ya vive esa fórmula. Nueva rama de persistencia
  `else if (_gm._isWprevKo)` (junto a `_isWprev`/`_isEurKo`, mismo
  patrón: lee `_gm.etScores`/`_gm.penWinner`, normaliza a 'a'/'b').
  `_isWprevKoLeg` se añade a la fórmula `_showET` (botón manual
  PRÓRROGA) para que NO aparezca ni en ida ni en vuelta — el forzado es
  SIEMPRE automático al Finalizar, igual que `_isEurKoTwoLeg`. Flags
  guardados/restaurados en el snapshot de resumen del partido
  (`_isWprevKo`/`_wprevTieIdx`/`_wprevLeg`/`_wprevIda`), para que un
  partido a medias sobreviva a un recargo de página.
- `_wprevDraw`: re-sortear la preliminar (o los 12 grupos) con
  progreso humano ya jugado muestra un aviso ESPECÍFICO de que ese
  progreso se perdería (antes del genérico "¿sortear de nuevo?").

### 4) El club humano JUEGA sus 6 partidos de grupo — el resto se simula de golpe

`_doDrawGroups` marca con `_groupHasHuman(grp)` qué grupo(s) tienen un
club humano y les construye un **fixture de 6 jornadas**
(`_buildGroupFixture`, método del círculo para 4 equipos: 3 jornadas
ida + 3 vuelta con los mismos pares invertidos) — los grupos SIN
humano siguen sin fixture (`s.fixtures[gi]=null`) y se simulan de golpe
con `_simulateGroup` tal cual antes, **sin desplegar jornadas**
(petición explícita del usuario). Al pulsar Sim,
`_autoSimNonHumanFixtures` resuelve YA los 6 partidos entre los 3
rivales del grupo humano (no dependen del club humano); los OTROS 6
(los del propio club humano) quedan pendientes.

- `window._wprevPlayHumanMatch(gi, j)` — localiza el partido del
  humano en la jornada `j` de su grupo, abre previa+gm-modal vía
  `window.abrirPreviaChampionsMatch(home,away,isHvH,gi,j)` —
  **YA EXISTÍA**, cableado con `_gm._isWprev`/`_wprevGi`/`_wprevJ` desde
  un diseño anterior de la Previa (jamás activado: las dos funciones
  de arriba eran no-ops). Solo hacía falta implementarlas de verdad.
- `window._wprevSaveHumanResult(gi, j, gh, ga)` — persiste el
  marcador en `s.fixtures[gi]`, recalcula `sortedTables[gi]` con los
  partidos ya jugados de ese fixture, y si con esto TODOS los grupos
  quedan completos (`_allGroupsDecided`) pasa `phase` a `'done'` y
  llama a `_persistDistribution` (reparto final 12/22/28) — sin que el
  admin tenga que volver a pulsar Sim.
- Render: `_fgJornadaHtml(s, gi)` pinta, SOLO para el grupo con
  humano, un bloque de 6 jornadas (reusa `.wprev-jbtn`/`.wprev-jmatches`
  ya existentes) con un botón "⭐ ▶ PREVIA · JUGAR" en el partido del
  humano de cada jornada. Los grupos sin humano NO llaman a esta
  función — se quedan solo con `_groupTable` (tabla de clasificación).

### Reglas a respetar

1. **PROHIBIDO** que un cruce de la Ronda Preliminar con un club humano
   en un lado REAL (no BYE) se auto-simule. Se juega SIEMPRE con
   card+previa vía `_wprevKoOpenMatch`. Un BYE (hueco TBD en el pool)
   se resuelve solo, tenga o no humano el lado real.
2. **PROHIBIDO** que los 6 partidos del club humano dentro de su grupo
   se auto-simulen. `_autoSimNonHumanFixtures` SOLO toca los 6 partidos
   entre los 3 rivales — nunca los que involucran al humano.
3. **PROHIBIDO** que un grupo SIN club humano despliegue jornadas
   (`_fgJornadaHtml` no se llama para esos grupos) — se simulan de
   golpe con `_simulateGroup`, como pedía el usuario explícitamente.
4. **PROHIBIDO** generalizar el motor `_eurKo*`/`_eurFase*` (Champions/
   Europa/Conference eliminatorias) para que sirva también a la
   Previa. Se creó un motor AUTOCONTENIDO (`_wprevKo*`) en la propia
   IIFE de la Previa — mismo patrón conceptual, cero riesgo de romper
   UCL/UEL/UECL.
5. **PROHIBIDO** que `phase` pase a `'prelim-done'`/`'done'` mientras
   quede CUALQUIER cruce/partido del club humano sin decidir —
   `_allPrelimDecided`/`_allGroupsDecided` son la ÚNICA fuente de esa
   transición, se comprueban tanto al pulsar Sim como al persistir un
   resultado humano.
6. **PROHIBIDO** volver a un re-sorteo (Draw) de la preliminar o de los
   grupos sin avisar ESPECÍFICAMENTE si el club humano ya tiene
   progreso jugado ahí — se perdería sin un aviso claro.
7. Si en el futuro hay 2+ clubes humanos en la misma Previa
   (simultáneos), el código NO asume "solo 1 grupo humano": cualquier
   grupo con `_groupHasHuman` gana su fixture de jornadas
   independientemente, y cualquier cruce con `_tieHasHuman` se juega
   con card (incluido un HvH si 2 humanos caen en el mismo cruce/grupo).

## Previa de Champions — Ronda Preliminar (28→14, Open Qualifier) + 12 grupos de 4 (obligatorio, 2026-07-12) ⚠️ SUPERSEDE el formato "16 grupos + corte global 12/22/28" de la sección "Wild Card + Open Qualifier — FASE DE GRUPOS" más abajo

**Petición usuario 2026-07-12** ("LA FASE PREVIA CHAMPIONS TENIA UN
ERROR DE FORMATO, LOS VAMOS A HACER ASÍ"): el formato v3 (62 = 34
directos + 28 del Open Qualifier → 16 grupos de tamaño desigual (14×4 +
2×3) → corte por RANKING GLOBAL 12/22/28) queda **sustituido** por un
formato en DOS ETAPAS, más simétrico, que además arregló de paso el bug
reportado el mismo día ("el botón 🎲 no hace nada, debería formar los
grupos").

### Formato nuevo

**Etapa 1 — Ronda Preliminar** (SOLO los 28 clasificados del Open
Qualifier, los 34 directos de liga NO participan aquí):
- 28 equipos → **14 eliminatorias a doble partido** (ida + vuelta),
  emparejados AL AZAR (sin bombos, es una eliminatoria 1v1, no un
  reparto de grupos que necesite equilibrar fuerza).
- Si el **global** (agregado ida+vuelta) queda empatado → **prórroga**
  (motor de partido con lambda reducido, ~1/3 del habitual, para
  representar 30 min en vez de 90) y, si sigue empatado, **penaltis**
  (ponderados por poder del equipo, igual que el resto de penaltis IA
  del proyecto).
- **14 ganadores** → pasan a la Etapa 2 (fase de grupos).
- **14 perdedores** → eliminados DIRECTOS a Conference League.

**Etapa 2 — Fase de grupos** (34 directos + 14 ganadores de la
preliminar = 48 equipos exactos):
- **12 GRUPOS DE 4** (ya no hay grupos desiguales de 3 — 48/12=4
  encaja perfecto). Snake por poder + barajado por bombos
  (`_shuffleTiered`) + anti-mismo-país, liguilla a DOBLE ida y vuelta,
  IA-vs-IA. La UI muestra SOLO las tablas de clasificación.
- **Reparto POR POSICIÓN DE GRUPO** (ya NO por ranking global — ese
  era precisamente el "error de formato" a corregir):
  - **1º de cada grupo (12)** → Champions, SIEMPRE.
  - **2º de cada grupo (12)** → Europa, SIEMPRE.
  - **Los 12 terceros de grupo se rankean entre sí** (PTS→DG→GF→nombre):
    los **10 mejores** → Europa (22 = 12+10). Los **2 peores** →
    Conference.
  - **4º de cada grupo (12)** → Conference, SIEMPRE.
- **Conference final** = 2 peores terceros + 12 cuartos (14, de la
  fase de grupos) **+ los 14 perdedores de la Ronda Preliminar** = 28.

### Balance final (idéntico al de antes — verificado, no cambia)

```
Champions:  12 (Previa) + 28 directos = 40 🔵
Europa:     22 (Previa) + 18 directos = 40 🟠
Conference: 28 (Previa) + 12 directos = 40 🟢
```

### Implementación

`part2/misc_body_2.html`, IIFE de la Previa (`WPREV_KEY='wprev_state_v1'`):
- `computeUclPrevDirectTeams()`/`computeUclPrevOqPoolTeams()`
  (**NUEVAS**, `misc_body_1.html`) separan el pool en DOS —
  `computeUclPrevTeams()` (unión de ambas) se conserva solo para
  diagnóstico/compat, el motor de la Previa YA NO la usa para construir
  su pool de trabajo. La separación respeta `feederTag` de los extras
  manuales (`eur_manual_extra_v1.uclPrev`): las entradas con
  `feederTag:'open-qualifier'` (los ganadores del OQ re-sincronizados
  para que lleguen en modo 🔒 Manual) van al pool del OQ, el resto
  (extras genuinamente manuales del admin) van al pool directo.
- Estado (`wprev_state_v1`) con 4 fases: `null` (nada sorteado) →
  `'prelim-drawn'` → `'prelim-done'` → `'groups-drawn'` → `'done'`.
  Guarda `prelim.ties[]` (cada uno con `a`/`b`/`legs`/`et`/`penWinner`/
  `winner`/`loser`/`aggA`/`aggB`) y `direct[]` (los 34, capturados al
  sortear la preliminar) además de `groups[]`/`matchesByGroup[]`/
  `sortedTables[]` (fase de grupos, igual que antes).
- **🎲 Draw** y **🎮 Sim** son contextuales por fase — cada uno hace
  SOLO su paso (Draw sortea, Sim juega), y avanzan a la fase siguiente
  automáticamente cuando corresponde (p.ej. pulsar Sim con
  `phase===null` sortea Y juega la preliminar de un tirón, igual que el
  comportamiento legacy de "Sim sin Draw previo"). El label de AMBOS
  botones se recalcula en cada render (`_nextLabel`/`_drawLabel`).
- Render: la Ronda Preliminar se pinta en el contenedor
  `wprev-deathround-container` (reutilizado del formato viejo "Ronda 1
  + exentos", mismas clases CSS `.wprev-dr`/`.wprev-mrow` ya existentes
  — sin CSS nuevo), y la fase de grupos en `wprev-groups-container`
  (sin cambios de markup, solo N_GROUPS 16→12).
- **Se ELIMINÓ el wrapper decorativo de `ftbolLoaderRun`** que envolvía
  `simulateUclPrev`/`_wprevDraw` con `setTimeout` fake-progress: el
  overlay real llevaba deshabilitado desde 2026-05-21, así que ese
  wrapper solo aportaba 400-900ms de latencia artificial sin ningún
  beneficio visual — mismo antipatrón que Wild Card ya abandonó el
  2026-06-03. Los botones llaman a `simulateUclPrev`/`_wprevDraw`
  directamente.
- Las 3 claves de salida (`wprev_to_fase_grupos_v1`/`wprev_to_europa_v1`/
  `wprev_r1_to_conference_v1`) **NO cambian de nombre** — las fases
  finales (UCL/UEL/UECL) las siguen consumiendo sin tocar nada.

### Reglas a respetar

1. **PROHIBIDO** que los 34 directos de liga participen en la Ronda
   Preliminar — solo los 28 del Open Qualifier juegan esa eliminatoria.
   Los directos entran DIRECTOS a la fase de grupos.
2. **PROHIBIDO** volver al corte por RANKING GLOBAL (posición→PTS→DG→GF)
   de la fase de grupos. El corte es POR POSICIÓN DE GRUPO: 1º/2º/4º
   siempre van al mismo sitio; solo los 3º se rankean entre sí (mejores
   10 → Europa, peores 2 → Conference).
3. **PROHIBIDO** que los 14 perdedores de la Ronda Preliminar se
   pierdan — `_persistDistribution` los concatena SIEMPRE al resultado
   de Conference de la fase de grupos (14+14=28).
4. **PROHIBIDO** reintroducir un wrapper de `ftbolLoaderRun`/fake-progress
   sobre `simulateUclPrev`/`_wprevDraw`: el overlay real está
   deshabilitado desde 2026-05-21, así que ese wrapper es SIEMPRE pura
   latencia sin beneficio.
5. Toda fase preliminar NUEVA de este tipo (eliminatoria de filtro antes
   de una fase de grupos) hereda el patrón: pool de entrada SEPARADO
   (nunca mezclado con el pool que entra directo), estado con fases
   explícitas, Draw/Sim contextuales por fase, y los perdedores/
   eliminados de la preliminar sumados al reparto final de la
   competición inferior correspondiente.

## Los ganadores de cada fase SIEMPRE se registran también como extra manual de la zona destino — si no, el modo 🔒 Manual (default de las 6 zonas) los bloquea del todo (obligatorio, 2026-07-10 #3)

**Petición usuario 2026-07-10** (3 fotos, tras el botón "⬇️ Traer Wild
Card" de arriba): "no funciona el pasar los 24 equipos de la Wild
Card al Open Qualifier". El botón mostraba `✅ Pool del Open
Qualifier actualizado: 88 / 112 equipos reales (incluye los 24
ganadores de la Wild Card)` — pero la Grupo A seguía sin ningún
ganador real de la Wild Card, y el mensaje mentía: 88 es EXACTAMENTE
el número de plazas de liga sin los 24 de la Wild Card (88+24=112),
así que los 24 nunca entraron pese al mensaje de éxito.

### Causa raíz — el modo 🔒 Manual corta ANTES de mirar los ganadores

Las 6 zonas europeas (`ucl`/`uclPrev`/`uel`/`uecl`/`uclQual`/
`wildcard`) arrancan en **🔒 Manual por defecto** desde 2026-07-03
(regla ya documentada: "el admin pidió DOS VECES que los equipos
automáticos desaparezcan"). En ese modo, **CADA**
`compute*Classified()`/`computeOpenQualifierTeams()`/
`computeUclPrevTeams()` hace, literalmente en su PRIMERA línea:
```js
if(window._eurManualOnly && window._eurManualOnly(zone)) return _appendManualExtra([], zone);
```
Esto corta ANTES de mirar `_europeFrozenFor` (snapshot congelada) y
ANTES de leer `wc_to_open_qualifier_v1`/`oq_to_previa_v1`/
`wprev_to_*`. Con la zona `uclQual` en Manual (el default), el pool
del Open Qualifier es SOLO lo que haya en `eur_manual_extra_v1.uclQual`
(los equipos que el admin añadió a mano con el picker "AÑADIR POR
LIGA" del overlay "Equipos por competición" — de ahí el 88, que
coincide con el nº de plazas de liga que el admin fue añadiendo a
mano ahí). El fix anterior (botón "⬇️ Traer Wild Card" recalculando
"en vivo" con `_europeIgnoreFrozen`) **no servía de nada**: ese
recálculo en vivo TAMBIÉN pasa por el mismo `computeOpenQualifierTeams()`,
que sigue cortando en la primera línea si la zona está en Manual —
nunca llega ni al bypass de la snapshot ni a leer los ganadores de la
Wild Card. Este mismo hueco afecta EXACTAMENTE IGUAL a Open Qualifier
→ Previa (zona `uclPrev`) y a Previa → Champions/Europa/Conference
(zonas `ucl`/`uel`/`uecl`) — es un bug SISTÉMICO de toda la cadena de
propagación, no solo de la Wild Card.

### Fix — `window._eurSyncManualExtraFromFeeder(zone, teams, feederTag)`

Nuevo helper (`misc_body_1.html`, junto a `_eurManualExtraAdd`):
registra los ganadores de una fase **TAMBIÉN** como extras manuales de
la zona destino. Como `_appendManualExtra(arr, zone)` se llama
**SIEMPRE** al final de cada `compute*Classified()` —tanto en la rama
Manual (`return _appendManualExtra([], zone)`) como en la rama
automática/híbrida (`return _appendManualExtra(out, zone)`)— este es
el ÚNICO camino que garantiza que los ganadores aparezcan **sin
importar** si la zona está en 🔒 Manual o en 🔓 Auto.

- Cada entrada añadida lleva `feederTag` (nombre de la fase de
  origen: `'wild-card'`/`'open-qualifier'`/`'previa-champions'`). En
  cada sincronización se **quitan primero** las entradas con ESE
  MISMO `feederTag` (para no acumular ganadores de una simulación
  anterior) y se añaden las actuales — sin tocar entradas SIN
  `feederTag` (esas son manuales de verdad, añadidas a mano por el
  admin con el picker, y nunca se tocan).
- El campo `league` de la entrada prioriza `sourceLeague` (país real,
  como en los ganadores de la Wild Card, donde `league` es la
  constante `'wild-card'` y el país real vive en `sourceLeague`) sobre
  `league` — así el anti-mismo-país de los sorteos siguientes no trata
  a todos los ganadores como un único "país".
- Llamado desde `_persistWinners` (Wild Card → zona `uclQual`,
  `part2/misc_body_2.html`), `_persistPreviaFlag` (Open Qualifier →
  zona `uclPrev`, `misc_body_1.html`) y `_persistDistribution` (Previa
  → zonas `ucl`/`uel`/`uecl`, `part2/misc_body_2.html`) — los 3 puntos
  donde cada fase persiste sus ganadores hacia la siguiente.
- El botón "⬇️ Traer Wild Card" (sección de arriba) también lo usa
  como PRIMER paso (antes de la invalidación de caché y del recálculo
  en vivo), y su `alert()` de confirmación ahora VERIFICA de verdad
  cuántos ganadores quedaron dentro del pool recalculado (`got`/`teams.length`)
  en vez de asumirlo ciegamente por el tamaño de `wc_to_open_qualifier_v1`.

### Reglas a respetar

1. **PROHIBIDO** asumir que invalidar el sorteo cacheado
   (`_eurInvalidateDownstream`) o recalcular "en vivo"
   (`_europeIgnoreFrozen`) basta para que los ganadores de una fase
   lleguen a la siguiente. Si la zona destino está en 🔒 Manual (el
   DEFAULT), ambos mecanismos son inútiles — `compute*Classified()`
   corta ANTES de llegar a ellos. La ÚNICA vía que funciona en
   CUALQUIER modo es registrar los ganadores como extra manual
   (`_eurSyncManualExtraFromFeeder`).
2. **PROHIBIDO** que un mensaje de confirmación de un botón de
   propagación diga "incluye los N ganadores" sin comprobar de verdad
   que esos N nombres están presentes en el pool recalculado. Un
   recuento que no verifica es indistinguible de un fallo silencioso
   (exactamente el bug de este reporte: el botón "confirmaba" éxito
   con 0 ganadores realmente incluidos).
3. **PROHIBIDO** que `_eurSyncManualExtraFromFeeder` borre entradas SIN
   `feederTag` (las manuales de verdad, añadidas a mano por el admin)
   al re-sincronizar. Solo reemplaza las que llevan el MISMO
   `feederTag` de la llamada actual.
4. Toda fase NUEVA que produzca ganadores hacia una zona europea
   (WC→OQ, OQ→Previa, Previa→UCL/UEL/UECL, o cualquier par nuevo
   futuro) hereda este patrón: su función de persistencia
   (`_persistXxx`) debe llamar a `_eurSyncManualExtraFromFeeder(zonaDestino,
   ganadores, 'tag-de-esta-fase')` ADEMÁS de escribir su propia clave
   feeder (`xxx_to_yyy_v1`) — la clave feeder sigue siendo necesaria
   para el cómputo automático cuando la zona SÍ está en Auto, pero el
   extra manual es la red que cubre el caso (mucho más común) de que la
   zona esté en Manual.

## Botón "⬇️ Traer Wild Card" en Open Qualifier — recuperación manual si la propagación automática no llegó (obligatorio, 2026-07-10 #2)

**Petición usuario 2026-07-10** (2 fotos, tras el fix de propagación en
cascada de arriba): "no se lanzan al Open Qualifier, pon un botón en
Open Qualifier para que lo haga". Pese a la invalidación en cascada
(`_eurInvalidateDownstream`) y al botón "🟡 LANZAR CLASIFICADOS AL OPEN
QUALIFIER" de la propia pantalla de la Wild Card (que re-persiste
`wc_to_open_qualifier_v1` y navega a Open Qualifier), la Grupo A del
Open Qualifier seguía mostrando `TBD-OQ-112` en vez de un ganador real.

### Causa raíz — 2 caminos distintos por los que los 24 ganadores no llegan

1. **Snapshot CONGELADA** (`europe_committed_v1`, del botón admin
   "📤 Enviar realidad de cada equipo a su Europa" / "📤 ENVIAR TODOS
   LOS EQUIPOS A SU COMPETICIÓN"): `computeOpenQualifierTeams()`
   devuelve esa snapshot **VERBATIM** si existe y tiene la zona
   `uclQual` no vacía (`_europeFrozenFor('uclQual')`), **sin mirar
   `wc_to_open_qualifier_v1` en absoluto**. Si el admin congeló esa
   snapshot ANTES de que la Wild Card terminara, se queda para
   siempre sin los 24 ganadores — es el comportamiento DELIBERADO de
   esa función (regla "se queda GUARDADO hasta editar/reenviar", más
   abajo), pero significa que la cascada de invalidación (que solo
   toca `oq_simulation_v1`/`wprev_*`, nunca `europe_committed_v1`) no
   basta por sí sola.
2. **El dispositivo que mira Open Qualifier no es el mismo que terminó
   la Wild Card**: la invalidación en cascada llega al servidor con
   reintentos pero de forma asíncrona; un dispositivo que abre la
   pantalla justo en esa ventana, o que perdió el POST tras agotar los
   3 reintentos (offline prolongado), puede seguir viendo el
   `oq_simulation_v1` viejo.

### Fix — `window._oqPullWildCardWinners()` + botón dedicado

Nuevo botón **"⬇️ Traer Wild Card"** junto a 🎮 Sim / ♻️ Reset en
`s-open-qualifier-clas` (mismo gate PIN 747 vía `pG(...)`). Al
pulsarlo:
1. Comprueba que `wc_to_open_qualifier_v1` tiene ganadores reales; si
   no, avisa que hay que terminar la Wild Card primero.
2. Invalida `oq_simulation_v1` vía `_eurInvalidateDownstream` (borra
   local + servidor con reintentos) — cubre el caso 2.
3. Recalcula el pool **EN VIVO** (`_europeIgnoreFrozen=true` temporal,
   restaurado después) y, **si existe** una snapshot congelada
   (`europe_committed_v1`), **actualiza su zona `uclQual`** con el
   resultado en vivo (local + `POST /api/kv/europe_committed_v1`) —
   cubre el caso 1. Es una acción EXPLÍCITA del admin (pulsar el
   botón), tan legítima como pulsar "Enviar realidad..." de nuevo —
   NO viola la regla de esa snapshot ("solo cambia al editar/reenviar
   explícitamente").
4. Re-pinta `buildOpenQualifierClas()` y confirma con un `alert()`
   cuántos equipos reales quedaron en el pool (de 112).

### Reglas a respetar

1. **PROHIBIDO** asumir que la invalidación en cascada
   (`_eurInvalidateDownstream`) es suficiente por sí sola para que los
   ganadores de una fase lleguen a la siguiente: si existe una
   snapshot `europe_committed_v1` congelada para esa zona, seguirá
   ganando hasta que algo la actualice explícitamente. Todo botón
   nuevo de "traer ganadores a mano" de este tipo debe, además de
   invalidar el sorteo cacheado, recalcular en vivo y refrescar esa
   zona de la snapshot si existe.
2. **PROHIBIDO** que este botón deje `window._europeIgnoreFrozen` en
   `true` de forma permanente — se restaura al valor previo
   inmediatamente después de leer el pool en vivo (mismo patrón que
   `_doCommitEurope`).
3. Todo par fase-anterior/fase-siguiente NUEVO que dependa de un pool
   propagado (como WC→OQ, OQ→Previa) hereda este patrón: un botón
   "Traer <fase anterior>" en la pantalla de la fase siguiente que
   invalide el sorteo cacheado propio Y refresque la snapshot congelada
   si existe, para que el admin tenga un control manual explícito
   cuando la propagación automática no baste.

## Corrección manual de estadísticas por jugador (`p.statsOverride`) en Resto de Ligas / Liga EA Sports (obligatorio, 2026-07-10 #3)

**Petición usuario 2026-07-10** (foto Salzburg, Liga Austria): «esas
estadísticas del Salzburg… un jugador con 89 goles cuando el equipo
solo ha marcado 71 — edita las estadísticas o déjame editarlas a mi».

### Contexto

La cabecera de la plantilla (`_lextRenderSquadStatsHeader`, "Máximo
goleador") suma, por diseño, los goles del jugador en **TODAS** las
competiciones oficiales del equipo (regla "SUMA TOTAL de competiciones",
2026-06-15: Liga+Copa+UCL+UEL+UECL+Recopa+USC+Inter+Mundialito), mientras
que la caja de arriba (GF) solo muestra Liga+Copa. Con un equipo que
juega también competición europea, el total del jugador puede superar
a simple vista el GF doméstico visible — pero, sea o no ese el caso
exacto de Karim Konaté, el pedido explícito del usuario es tener control
manual sobre estos números cuando algo se vea mal, sin depender de que
se investigue cada caso puntual.

### Fix — `p.statsOverride`, máxima prioridad sobre el cálculo automático

Nuevo campo opcional `p.statsOverride = {pj,gol,pen,fk,mvp,ta,tr,imbat,
penSaved}` en cada jugador de `team.players[]` (Resto de Ligas + Liga EA
Sports). Se edita desde el mismo editor 🖍 de plantilla
(`lextEditPlayer`/`lextSavePlayer`, `misc_body_1.html`):

- Nuevo toggle **"🔒 Corregir estadísticas a mano"** + una rejilla de 9
  campos (PJ/Goles/Penaltis/Faltas/MVP/Amarillas/Rojas/Imbatidas/Pen.
  parados) dentro del form "➕ Añadir jugador individual" / edición.
- Al abrir el editor de un jugador SIN corrección previa, la rejilla se
  precarga con los números que la plantilla está mostrando AHORA MISMO
  (mismo cálculo que `renderSquadList`), para que el admin parta de un
  valor con sentido en vez de 0.
- Al guardar con el toggle marcado, se persiste `target.statsOverride`;
  al guardarlo DESMARCADO, se borra (`delete target.statsOverride`) y el
  jugador vuelve al cálculo automático.
- Badge 🔒 junto al nombre del jugador en la fila de la plantilla cuando
  tiene una corrección activa.

**`window._lextHydratePlayerStats(team, p, real)`** — el ÚNICO punto que
resuelve "los stats limpios de un jugador" (lo usan `renderSquadList` Y
`_lextRenderSquadStatsHeader`, así que ambos quedan sincronizados sin
tocarlos por separado) — comprueba `p.statsOverride` **ANTES que
cualquier otra cosa**, incluso antes del `teamPJ===0` early-return:
si existe, se devuelve tal cual, ignorando eventos reales / cachés /
`p.*` sin corregir. El guard de `renderSquadList` que decide si
sobrescribir `p.*`/usar el valor de DISPLAY (`clean.pj > 0`) se amplía a
`clean.pj > 0 || p.statsOverride`, para que una corrección a **0**
(p.ej. "este jugador no ha jugado nada, ponlo a cero") no quede
descartada por ese guard y no caiga de vuelta a los valores viejos.

### Reglas a respetar

1. **PROHIBIDO** que un cálculo de stats de jugador nuevo (dashboard,
   cabecera, ranking, lo que sea) lea `p.gol`/`p.pj`/etc. o los cachés
   `ef_player_stats_*` SIN pasar antes por `_lextHydratePlayerStats` —
   es el único chokepoint que respeta `p.statsOverride`. Leer directo se
   salta la corrección manual del admin.
2. **PROHIBIDO** que `applyMatchStats`/`resetPlayerStats`/cualquier
   escritor de la simulación borre o modifique `p.statsOverride`. Es un
   dato del admin (como derbys/trofeos/plantillas) — sobrevive a
   partidos nuevos y a "Reiniciar Temporada" hasta que el admin lo quite
   explícitamente desde el mismo editor.
3. **PROHIBIDO** que `p.statsOverride` afecte al MOTOR de simulación
   (elección de goleador, MVP, etc.). Es **solo de DISPLAY/rating** — la
   ponderación real de goles sigue gobernada por los flags
   `natGoal`/`natGoalPro`/`elite`/`captain`, nunca por el histórico de
   goles marcados.
4. Toda liga/competición NUEVA que reutilice `renderSquadList` /
   `_lextHydratePlayerStats` hereda la corrección manual automáticamente
   — no hace falta cablearla aparte.

## Wild Card → Open Qualifier → Previa de Champions: los ganadores se propagan EN EL MOMENTO, con invalidación en cascada al servidor (obligatorio, 2026-07-10)

**Petición usuario 2026-07-10** (12 fotos: Wild Card "24 GANADORES →
OPEN QUALIFIER" con nombres reales · Open Qualifier con `TBD-OQ-56/
57/.../112` en vez de esos 24 ganadores, YA simulado (PJ=6) · Previa
"34/62, PREVIA SIN SORTEAR" · Champions fase de grupos "28/40,
posiciones 29-40 Por definir"): "LOS 24 equipos (primero de cada
grupo una vez terminan todos los partidos) al darle a enviar deberían
lanzarse en el momento a la OPEN QUALIFIER... Una vez se juegan todos
los partidos del OPEN QUALIFIER, los 28 primeros de cada grupo pasan
en ese mismo momento a la PREVIA DE CHAMPIONS... el primero de cada
grupo de Previa de Champions una vez se jueguen todos los partidos
los 12 primeros de cada grupo pasan al instante a la Fase de grupos
de Champions". El reparto 24→OQ, 34+28=62→Previa, 28+12=40→Champions
YA estaba bien implementado (`_persistWinners`, `_persistPreviaFlag`,
`_persistDistribution`) — el bug es que la pantalla SIGUIENTE no
reflejaba esos ganadores porque su sorteo ya estaba cacheado (drawn/
simulado antes de que la fase anterior terminara) y ese caché nunca
se invalidaba de forma que sobreviviera al sync multi-dispositivo.

### Causa raíz

`buildOpenQualifierClas()`/`buildUclPrevClas()` leen su propio estado
persistido (`oq_simulation_v1`/`wprev_state_v1`) SI YA EXISTE — solo
recalculan el pool fresco (`computeOpenQualifierTeams()`/`buildPool()`)
cuando ese estado está AUSENTE. Si el admin sorteaba/simulaba el
Open Qualifier ANTES de que la Wild Card terminara (con placeholders
`TBD-OQ-N` reservados para los 24 ganadores aún desconocidos), ese
sorteo quedaba fijado para siempre — aunque `simulateAll`/
`simulateAllChunked` (Wild Card, `part2/misc_body_2.html`) hiciera
`localStorage.removeItem('oq_simulation_v1')` al terminar, precisamente
para forzar el re-sorteo.

El problema: un `removeItem` SUELTO no es un borrado real en este
proyecto. `pushPendingChanges` (sync genérico cada 3 s,
`part2/misc_body_2.html`) SALTA los valores `null`
(`if(v === null) return;`) — nunca empuja el borrado al servidor. El
servidor conserva la snapshot vieja (con los placeholders) para
siempre, y en el SIGUIENTE `hydrateFromServer()` (arranque de
CUALQUIER pestaña, incluida la misma), como el local ya no existe,
`if(!local){ doRestore = true; }` RESUCITA esa snapshot vieja —
deshaciendo la invalidación en silencio. Mismo patrón exacto ya
documentado para `_resetEuropePoolFeeders` (2026-07-02: "el Reset del
Open Qualifier no funciona"), pero ese fix solo cubrió el botón
♻️ Reset (acción explícita del admin) — la ruta de "Sim termina y
limpia el caché de la fase siguiente" seguía con el `removeItem` sin
avisar al servidor. El mismo hueco existía en Open Qualifier → Previa:
`_finishOqSim` nunca invalidaba el sorteo ya cacheado de la Previa
(`wprev_state_v1`), así que una Previa sorteada antes de que el Open
Qualifier terminara se quedaba con su pool incompleto para siempre.

Previa → Champions NO sufre este bug: `buildUclGruposClas()` es
100% dinámica (recalcula `computeUclClassified()` en cada render, sin
ningún "sorteo" persistido que invalidar) — en cuanto
`_persistDistribution` (Previa) escribe `wprev_to_fase_grupos_v1` con
los 12 ganadores, el siguiente render de Champions ya los ve.

### Fix — `window._eurInvalidateDownstream(keys)` (misc_body_1.html)

Nuevo helper compartido, hermano de `_resetEuropePoolFeeders` pero
para la ruta de "Sim natural terminó" en vez de "Reset explícito del
admin": borra las claves en local Y avisa al servidor con 3
reintentos (`POST /api/state` con cadena vacía por clave — mismo
patrón que `_postClearRetry`), sembrando `window._compStateSyncSnapshot`
para que el push siguiente no intente resucitar lo que se acaba de
limpiar. A diferencia de `_resetEuropePoolFeeders`, **NUNCA toca la
fase que ACABA de terminar** — solo invalida el sorteo YA CACHEADO de
la(s) fase(s) siguiente(s):

- `window._EUR_DOWNSTREAM_OF_WC` (Wild Card termina): invalida
  `oq_simulation_v1` + `oq_to_conference_v1` + `oq_to_previa_v1` +, en
  CASCADA, las 4 claves de la Previa (`wprev_state_v1` +
  `wprev_to_fase_grupos_v1` + `wprev_to_europa_v1` +
  `wprev_r1_to_conference_v1`) — los ganadores del OQ (que dependen de
  la WC) alimentan a su vez el pool de la Previa.
- `window._EUR_DOWNSTREAM_OF_OQ` (Open Qualifier termina): invalida
  SOLO las 4 claves de la Previa (no las del propio OQ, que se acaban
  de escribir con datos frescos en esta misma sim).
- Llamado desde `simulateAll`/`simulateAllChunked.finish` (Wild Card,
  `part2/misc_body_2.html`, tras `_persistWinners`) y desde
  `_finishOqSim` (Open Qualifier, `misc_body_1.html`, tras
  `_persistPreviaFlag`). Fallback a los `removeItem` sueltos si el
  helper no cargó (defensivo, no debería pasar dado el orden de carga
  `misc_body_1.html` → `part2/misc_body_2.html`).
- Re-pinta al instante `buildOpenQualifierClas`/`buildUclPrevClas`/
  `buildUclGruposClas`/`buildUelGruposClas`/`buildUeclGruposClas`/
  `_refreshChampionsDoneFlags` si esas pantallas ya están montadas —
  el admin ve el pool actualizado sin tener que navegar fuera y volver.

### Reglas a respetar

1. **PROHIBIDO** que una fase que acaba de terminar (Wild Card, Open
   Qualifier, o cualquier fase previa futura) invalide el sorteo
   cacheado de la fase SIGUIENTE con un `localStorage.removeItem`
   suelto. El sync genérico (`pushPendingChanges`) salta los valores
   `null` — ese borrado nunca llega al servidor y una snapshot vieja
   se resucita en el próximo `hydrateFromServer()`. Usar SIEMPRE
   `window._eurInvalidateDownstream(keys)` (borra local + avisa al
   servidor con reintentos + siembra el snapshot del sync).
2. **PROHIBIDO** que la invalidación de una fase hija toque las claves
   de la fase que ACABA de producir el resultado (p.ej. que la
   invalidación disparada por el Open Qualifier borre
   `oq_simulation_v1`/`oq_to_previa_v1`, que se acaban de escribir en
   la MISMA llamada). Cada lista `_EUR_DOWNSTREAM_OF_*` cubre
   estrictamente lo que hay AGUAS ABAJO de la fase que terminó.
3. **PROHIBIDO** duplicar la lista de claves de la Previa
   (`wprev_state_v1`/`wprev_to_fase_grupos_v1`/`wprev_to_europa_v1`/
   `wprev_r1_to_conference_v1`) entre `_EUR_DOWNSTREAM_OF_WC` y
   `_EUR_DOWNSTREAM_OF_OQ` sin mantenerlas sincronizadas con las
   mismas claves que usa `_resetEuropePoolFeeders` — si se añade una
   fase europea nueva con su propio "sorteo cacheado" dependiente de
   un pool aguas arriba, añadir su clave a la lista `_EUR_DOWNSTREAM_OF_*`
   correspondiente Y a `_resetEuropePoolFeeders`.
4. Toda fase NUEVA cuyo render sea del tipo "sorteo persistido, solo
   se recalcula si el estado está ausente" (como OQ/Previa/WC) hereda
   este patrón: su `finish`/`_persistXxx` debe invalidar en cascada el
   sorteo cacheado de la fase siguiente vía `_eurInvalidateDownstream`.
   Una fase DINÁMICA (recalcula en cada render, como Champions/Europa/
   Conference fase de grupos) NO lo necesita — ya está siempre al día.

## "📤 ENVIAR TODOS LOS EQUIPOS" del overlay europeo es a prueba de cuota + confirma con el servidor (obligatorio, 2026-07-10 #2)

**Bug (foto usuario 2026-07-10, «porque no me deja guardar»)**: tras el
fix del badge 💾 Guardado / 📝 Sin guardar (sección siguiente), el admin
pulsaba "📤 ENVIAR TODOS LOS EQUIPOS A SU COMPETICIÓN" y el badge se
quedaba SIEMPRE en 📝 Sin guardar, por más veces que lo intentara.

### Causa raíz

`_doCommitEurope` (`misc_body_1.html`) persistía la snapshot con un
`localStorage.setItem(EUROPE_COMMIT_KEY, ...)` PELADO envuelto en
`try{}catch(_){}` — exactamente el antipatrón que el propio archivo
documenta en su cabecera («GUARDADO A PRUEBA DE CUOTA — `_lsSetSafe`»):
si el navegador va sin espacio (banner «⚠️ Navegador sin espacio», ya
visible en las capturas de este mismo usuario), `setItem` lanza
`QuotaExceededError`, el catch lo TRAGA en silencio, y la snapshot
(hasta ~250 equipos con escudos — puede pesar varios cientos de KB)
JAMÁS se escribía. El POST al servidor (`_saveEuropeCommitServer`) era
además fire-and-forget con `.catch()` mudo, sin reintentos — en red
móvil se pierde con frecuencia. Con los DOS fallos combinados (local
lleno + POST perdido), la snapshot no llegaba a ningún sitio y el badge
`_eurEuropeCommitSaved()` (que solo miraba `localStorage`) nunca podía
pasar a "Guardado" — el admin podía pulsar ENVIAR indefinidamente sin
ningún resultado visible ni ningún aviso de error.

### Fix

- **Guardado local a prueba de cuota**: `_doCommitEurope` usa
  `window._lsSetSafe(EUROPE_COMMIT_KEY, ...)` en vez del `setItem`
  pelado — libera espacio reconstruible (snapshots viejos, `_backup`,
  stores de stats, `_protected` de OTRAS ligas) y reintenta antes de
  rendirse, mismo helper que ya protege el resto del proyecto.
- **POST al servidor CON reintentos + confirmación**:
  `_saveEuropeCommitServer(blob, onDone)` reintenta hasta 3 veces con
  backoff exponencial (mismo patrón que `_postClearRetry`) y llama a
  `onDone(true/false)` según si el servidor aceptó la snapshot.
- **El badge confía en el servidor, no solo en `localStorage`**:
  `_eurEuropeCommitSaved()` devuelve `true` si `window._eurCommitConfirmedAt`
  está puesto (el servidor confirmó esta sesión), aunque el guardado
  LOCAL de este dispositivo concreto haya fallado por falta de espacio
  — el servidor es la fuente de verdad multi-dispositivo de este
  proyecto (mismo principio que HUD/derbys/trofeos/lesiones).
- **Aviso explícito si AMBOS fallan** (local Y servidor): `alert()` con
  instrucciones (limpiar caché / reintentar con mejor conexión) en vez
  de dejar al admin sin ninguna pista de por qué "no guarda".

### Reglas a respetar

1. **PROHIBIDO** que `_doCommitEurope` (o cualquier guardado nuevo de
   `europe_committed_v1`) vuelva a un `localStorage.setItem` pelado con
   catch mudo. Debe usar `window._lsSetSafe` — este blob es lo bastante
   grande (hasta ~250 equipos con escudos) para disparar
   `QuotaExceededError` con facilidad en dispositivos ya cargados de
   ligas.
2. **PROHIBIDO** que `_saveEuropeCommitServer` vuelva a ser
   fire-and-forget sin reintentos ni callback de confirmación. El badge
   de guardado depende de saber si el servidor aceptó la snapshot.
3. **PROHIBIDO** que `_eurEuropeCommitSaved()` dependa ÚNICAMENTE de
   `localStorage.getItem('europe_committed_v1')`. Debe considerar
   también `window._eurCommitConfirmedAt` — un dispositivo con
   `localStorage` lleno puede seguir guardando correctamente en el
   servidor, y el badge no debe mentir diciendo "sin guardar" en ese
   caso.
4. **PROHIBIDO** que un fallo COMPLETO de guardado (local Y servidor)
   quede en silencio. Avisar siempre al admin con una acción concreta
   a tomar (limpiar caché / revisar conexión).

## El overlay "Equipos por competición" ya NO fuerza cálculo en vivo — el conteo se queda GUARDADO hasta editar/reenviar (obligatorio, 2026-07-10)

**Petición usuario 2026-07-10** (foto del header "👁 EQUIPOS POR
COMPETICIÓN (EN VIVO)"): "Arriba el texto eliminado [EN VIVO]. En su
lugar un icono dice de guardado, una vez se guarde quiero que se
quede guardada esa configuración de distribución de equipos y que no
se borre a no ser que yo lo edite manualmente."

### Causa raíz

El overlay (`_eurManualOverlayRender`, `misc_body_1.html`) pintaba sus
6 cajas de conteo (Champions/Previa/Europa League/Conference/Open
Qualifier/Wild Card) desde `_eurLiveBlob()`, que forzaba
`window._europeIgnoreFrozen = true` alrededor de CADA
`compute*Classified()` — a propósito, por diseño original (2026-07-03),
para que el admin "viera el estado actual sin tener que congelar
nada". El efecto secundario: el conteo NUNCA reflejaba la snapshot ya
enviada (`europe_committed_v1`) — recalculaba desde las ligas en CADA
apertura del overlay, así que dos aperturas seguidas podían mostrar
números distintos aunque el admin ya hubiera pulsado "📤 ENVIAR TODOS
LOS EQUIPOS" — de ahí el «(EN VIVO)» del título, que el usuario
interpretó (con razón) como "esto no se está guardando de verdad".

### Fix

- **`_eurDisplayBlob()`** (antes `_eurLiveBlob`): llama a los 6
  `compute*Classified()` SIN forzar `_europeIgnoreFrozen`. Esas
  funciones YA respetan `europe_committed_v1` internamente
  (`_europeFrozenFor`, chequeado tras el gate de `_eurManualOnly`) —
  es EXACTAMENTE el mismo camino que usan las pantallas reales
  (Champions/Europa/Conference/Previa/OQ/Wild Card), así el overlay
  deja de divergir de lo que el juego muestra de verdad. Recopa/
  Intercontinental (sin `europe_committed_v1`, regla ya existente: son
  SIEMPRE aditivos en vivo) no cambian.
- **Header**: el título pasa a "👁 Equipos por competición" (sin
  sufijo) + un badge `_eurEuropeCommitSaved()`: 💾 **Guardado** (verde)
  si `europe_committed_v1` existe, 📝 **Sin guardar** (ámbar) si el
  admin nunca pulsó ENVIAR todavía.

### Por qué el conteo se queda "clavado" hasta editar/reenviar

- **Zonas en 🔒 Manual**: `_eurManualOnly(zone)` corta en la primera
  línea de cada compute* (antes de mirar el congelado) — siempre
  reflejan al instante lo que el admin añada/quite a mano
  (`eur_manual_extra_v1`, ya persistido con tombstones — regla
  2026-07-07 #2).
- **Zonas en 🔓 Auto con snapshot guardada**: `_europeFrozenFor(zone)`
  devuelve la snapshot congelada — el conteo NO cambia aunque una liga
  se re-simule en segundo plano, hasta que el admin pulse
  "📤 ENVIAR TODOS LOS EQUIPOS" de nuevo (`_doCommitEurope`, que SÍ
  fuerza `_europeIgnoreFrozen` temporalmente para recalcular y
  re-congelar).
- **Zonas en 🔓 Auto sin snapshot todavía**: caen al cómputo dinámico
  normal (mismo comportamiento que las pantallas reales antes de la
  1ª vez que se congela algo) — el badge muestra 📝 Sin guardar.

### Reglas a respetar

1. **PROHIBIDO** que el conteo de este overlay vuelva a forzar
   `_europeIgnoreFrozen=true` fuera de `_doCommitEurope` (el único
   punto legítimo de recálculo forzado, disparado por una acción
   EXPLÍCITA del admin — pulsar ENVIAR). El overlay de consulta debe
   leer SIEMPRE por el mismo camino que las pantallas reales.
2. **PROHIBIDO** reintroducir el texto "(en vivo)"/"(EN VIVO)" en el
   título de este overlay. El estado de guardado se comunica con el
   badge 💾/📝 de `_eurEuropeCommitSaved()`, nunca con texto en el título.
3. **PROHIBIDO** que `_eurManualOnly` dejar de cortocircuitar ANTES del
   chequeo de congelado en cualquier compute*Classified() (regla ya
   existente 2026-07-03 #4) — es lo que garantiza que una zona en
   Manual siga reflejando ediciones al instante pese a este cambio.

## El Nivel + Forma (🎲) de la PREVIA se resuelven POR CAJA vía el registro de misters, no por el hub activo (obligatorio, 2026-07-10)

**Bug (2 fotos usuario 2026-07-10, «St. Gallen vs Inter», Torneos de
Verano)**: la caja Inter-Portugal-Rubén 🐲 juega en nivel **ESTRELLA**
con forma **🎲/🎲** (Yo/Rival) — la cabecera de su hub lo muestra bien
(foto 1) — pero la PANTALLA DE PREVIA de sus partidos (foto 2) no
mostraba la fila NIVEL en absoluto y los dados salían con la forma de
OTRO hub (⬇️ bajo St. Gallen, heredado del hub activo Liverpool).
Petición: "tiene que salir en cada partido el nivel estrella y ambos
🎲🎲".

### Causa raíz (2 huecos del mismo patrón)

1. **`_teamLevel`** (previa, `static/js/index.bundle.js`) solo conocía
   el override de la caja Liverpool (`menu_home_v1.ov['go:s-munich']`)
   + 5 clubes hardcodeados (Atlético/Real Madrid/Barcelona/Bayern/
   Arsenal). Inter (Rubén) y PSG (Izan) — que viven en Resto de Ligas,
   no en Liga EA — devolvían `null` → sin badge → la fila NIVEL ni se
   pintaba (`nivelHtml` solo se genera si `lvlA || lvlB`).
2. **`_wrapPRFS`** (forma de temporada, `misc_body_1.html`) detectaba
   el lado humano SOLO con `esHumano()` (los 5 legacy de Liga EA) y
   sembraba `window._ppFormStates` con la forma del **hub ACTIVO**
   (`_load()`). Un partido del Inter abierto desde la pantalla del
   torneo (sin pasar por su hub) no reconocía a Inter como humano y
   colocaba la forma del hub activo (Liverpool) en el lado equivocado.

### Fix — resolutor por equipo `window._misterSeasonFormFor(teamName)`

Nuevo helper en el IIFE de forma de temporada (`misc_body_1.html`),
junto a `_teamSeasonForm`: resuelve el Nivel + Forma (yo/rival) del
MISTER que dirige a `teamName` (club O selección, vía
`_isHumanClubCanonico`/`_isHumanSeleccionCanonica` + `_mhFindMister`),
sea cual sea el hub activo. Jerarquía de fuentes:
1. Mister del hub ACTIVO → `_load()` completo (defaults +
   `team_season_form_v1` + `menu_home_v1`) — el camino Liverpool queda
   byte-for-byte igual que antes.
2. Defaults por hub (`window._hubSeasonDefaultsFor(id)`, nuevo, expone
   `_HUB_DEF` del IIFE del HUD: ruben → ESTRELLA + rival 🎲).
3. Override del editor 🖍 de ESA caja (`menu_home_v1.ov['go:<screen>']`,
   sincronizada con servidor): `formState`/`formRival`/`level` mandan.
   `level: ''` explícito → `none:true` (admin eligió "Ninguno").

Consumidores:
- **`_wrapPRFS`**: tras el mapeo legacy, refina `_ppFormStates` por
  caja — el lado del mister usa SU "yo", el rival SU "rival"; HvH
  entre dos cajas: cada lado usa el "yo" de su propio mister.
- **`_teamLevel`** (bundle, bump 9.29 → 9.30): consulta el helper tras
  el override explícito de la caja Liverpool (que mantiene prioridad)
  y ANTES de los 5 hardcodes (que quedan como fallback si el helper no
  cargó). Mapea CRACK ⭐ / LEYENDA 🏅 / ESTRELLA 🌟; `none` → sin badge.

### Reglas a respetar

1. **PROHIBIDO** que la previa (o cualquier pantalla nueva que muestre
   Nivel/Forma de un partido) detecte al humano SOLO con `esHumano()`
   o resuelva Nivel/Forma desde el hub ACTIVO / la caja Liverpool
   hardcodeada. Se resuelve POR EQUIPO vía `_misterSeasonFormFor`
   (registro `MISTERS_HUMANOS`) — toda caja de mister NUEVA lo hereda
   automáticamente al estar en el registro + `_HUB_DEF`.
2. **PROHIBIDO** que `_misterSeasonFormFor` deje de devolver `_load()`
   completo cuando el mister ES el del hub activo — es lo que garantiza
   que la cabecera del hub y la previa muestren EXACTAMENTE lo mismo
   (incluida la fuente local `team_season_form_v1`, que no es por-hub).
3. Todo mister nuevo que se añada a `_HUB_DEF` con `nivel`/`formRival`
   propios (como Rubén = ESTRELLA/🎲) debe verse en la previa de CADA
   partido de su club y su selección sin que el admin guarde nada — si
   no sale, el hueco está en uno de los 2 consumidores de arriba.

## El overlay "Equipos por competición" cubre las 10 competiciones europeas/mundiales + buscador por nombre + envío único (obligatorio, 2026-07-07 #7)

**Petición usuario 2026-07-07**: "vuelve a añadir el poder añadir
manualmente equipo a equipo a la competición Europea que queramos:
CHAMPIONS, PREVIA CHAMPIONS, EUROPA LEAGUE, CONFERENCE LEAGUE, OPEN
QUALIFIER, WILD CARD, RECOPA, SUPERCOPA EUROPA, INTERCONTINENTAL,
MUNDIALITO CLUBES. Quiero un buscador lupa... por liga o por nombre...
un botón de enviar todos los equipos y que emerjan en cada
competición asignada." El overlay `_eurManualOverlayOpen`
(`misc_body_1.html`) solo cubría 6 zonas (`ucl/uclPrev/uel/uecl/
uclQual/wildcard`).

### Extensión a 10 zonas

`EUR_MANUAL_ZONES` (cliente) y `_EUR_MANUAL_EXTRA_ZONES` (servidor,
`app.py`) pasan de 6 a 10: se añaden `recopa`, `usc`, `inter`,
`mundial`. `_EUR_REPORT_ZONES` marca cada zona con `kind:'pool'` (las
6 originales + Recopa + Intercontinental — motores que computan un
POOL en vivo) o `kind:'candidates'` (Supercopa de Europa + Mundialito
— setups 100% manuales con su propio picker dedicado).

- **Recopa** (`_buildPool()`, IIFE `recopa_state_v1`): los extras de
  `window._eurManualExtraTeamNames('recopa')` se empujan con la MISMA
  prioridad que los manuales de "EA Sports → Europa", ANTES de los
  campeones/subcampeones automáticos. Aditivo siempre (no hay modo
  "solo manual" para esta zona). Expone `window._recopaLivePool()`.
- **Intercontinental** (`_buildPool()`, IIFE `inter_state_v1`): los
  extras de `_eurManualExtraTeamNames('inter')` se fusionan con
  `_meaTeamsFor('intercontinental')`; a diferencia de antes, TODOS los
  manuales entran al pool de 8 (no solo los 2 primeros) — si el admin
  añade 8 a mano, la Copa Intercontinental se puede sortear SIN
  esperar a que Resto del Mundo termine de simularse. Expone
  `window._interLivePool()`.
- **Supercopa de Europa** (`_availableTeams()`, IIFE `usc_state_v1`):
  los extras de `_eurManualExtraTeamNames('usc')` se añaden como
  candidatos pseudo-equipo (`nombre · Manual`) al buscador con lupa
  YA existente del setup de 4 equipos — no auto-configura nada, solo
  los hace elegibles.
- **Mundialito de Clubes** (`doSearch()` dentro de
  `_mundialRosterEditor`): los extras de
  `_eurManualExtraTeamNames('mundial')` se añaden como candidatos
  etiquetados `_leagues:['manual']` (cuentan como EUROPEOS, nunca como
  Resto del Mundo) al buscador por slot ya existente del roster de 32.

### Buscador por NOMBRE (además de "por liga")

Nueva sección "🔍 BUSCAR EQUIPO POR NOMBRE" en el overlay: chips para
elegir la zona destino (10, sin `<select>` nativo — mismo criterio que
el resto de pickers de esta pantalla) + input de texto que busca por
substring en TODAS las `ligaExt_<slug>` cacheadas localmente (NUNCA
dispara peticiones de red — para eso está "AÑADIR POR LIGA") + botón
para añadir el texto ESCRITO tal cual aunque no haya coincidencias
(equipo que no vive en ninguna liga local). El input solo refresca su
propio contenedor de resultados (`_eurRenderNameSearchResults`), NUNCA
el overlay entero, para no perder el foco/cursor en cada letra.

### Botón único "📤 ENVIAR TODOS LOS EQUIPOS A SU COMPETICIÓN"

Hidrata + llama a `_doCommitEurope` (igual que "Enviar realidad...") y
muestra un informe (`_eurShowCommitReport`) con las 10 competiciones:
las 6 originales desde el blob persistido en `europe_committed_v1`
(sin cambios), Recopa/Intercontinental desde su pool EN VIVO
(`_eurPoolToTeams`, con la liga de cada equipo resuelta vía
`_eurResolveLeagueForName`), y Supercopa/Mundialito desde sus listas
de candidatos manuales. Solo las 6 originales se PERSISTEN en
`europe_committed_v1` — Recopa/Intercontinental ya leen los manuales
en vivo en cada cómputo (persistirlos ahí no aportaría nada y
agrandaría esa clave sin necesidad, regla de cuota 2 MB).

### Reglas a respetar

1. **PROHIBIDO** desincronizar `EUR_MANUAL_ZONES` (cliente) de
   `_EUR_MANUAL_EXTRA_ZONES` (servidor): toda zona nueva se añade a
   AMBOS a la vez — si falta en el servidor, el merge aditivo
   (`_eur_manual_extra_merge`) descarta esa zona en SILENCIO en cada
   guardado.
2. **PROHIBIDO** añadir un toggle 🔓Auto/🔒Manual (`_eurManualOnly`) a
   Recopa o Intercontinental sin implementar también el bypass
   correspondiente en su `_buildPool()` — tal como está, son SIEMPRE
   aditivos sobre el cómputo automático, nunca "solo manual".
3. **PROHIBIDO** que Supercopa de Europa/Mundialito auto-configuren su
   bracket/roster desde los candidatos manuales sin acción explícita
   del admin en su pantalla dedicada — el overlay unificado solo los
   hace ELEGIBLES en el picker existente, nunca clobberea un setup ya
   en curso.
4. **PROHIBIDO** que el input de búsqueda por nombre dispare
   `_eurManualOverlayRender()` completo en cada `oninput` — pierde el
   foco/cursor. Solo `_eurRenderNameSearchResults()` (contenedor
   propio) en cada tecla; el re-render completo queda para acciones
   discretas (cambiar de zona, añadir, cerrar picker…).
5. Toda competición NUEVA que se añada a este overlay hereda el mismo
   patrón: si tiene un motor de POOL propio, se engancha ahí
   (`_eurManualExtraTeamNames(zone)`, aditivo); si es 100% manual con
   picker propio, se engancha como candidato en ESE picker.

## El click en "COMPARTIR POR WHATSAPP" SIEMPRE marca compartido, aunque el armado del mensaje reviente (obligatorio, 2026-07-07 #6)

**Bug (foto usuario 2026-07-07, «Real Madrid vs Al Hilal SFC», Mundialito
de Clubes — "después de darle decenas de veces consigo hacerlo hay algún
bloqueo, tiene que ser sencillo y facil")**: en la puerta obligatoria
"📲 COMPARTIR PARTIDO" (tras elegir MVP), pulsar "🟢 COMPARTIR POR
WHATSAPP" no producía ninguna reacción visible — el botón seguía verde
sin cambiar a "✅ COMPARTIDO" y "🏁 FINALIZAR PARTIDO" seguía gris/
deshabilitado. Hacía falta pulsar el botón decenas de veces hasta que,
en algún intento, "funcionaba".

### Causa raíz

Los 3 handlers que arman el mensaje de WhatsApp y comparten
(`_gmFinalShareGate.shareBtn.onclick`, `window._waShareGate.shareBtn.onclick`,
`_mlBuildAndShareWA`, todos en `part2/misc_body_2.html`) construían el
texto completo (cabecera vía `_waBuildHeaderLines`, líneas del acta,
bloque de estadísticas vía `_waFmtStatsBlock`, línea del MVP) **SIN
try/catch**, y solo AL FINAL de esa construcción — tras `_waShareToGroup(...)`
— marcaban `shared = true` y habilitaban el botón "FINALIZAR"/
"CONTINUAR". Si CUALQUIER paso del armado lanzaba una excepción (un
evento del acta con datos inesperados de un torneo nuevo como el
Mundialito de Clubes, un helper de abreviatura de equipo fallando,
etc.), el click terminaba ahí mismo: ni se copiaba nada al portapapeles,
ni se marcaba compartido, ni se habilitaba el botón siguiente — el
usuario veía el botón "sin reaccionar" al pulsarlo, indistinguible de
un bloqueo total. Coincide exactamente con el patrón "clicar decenas de
veces hasta que un intento cuela" (la condición de fallo puede depender
de datos que varían ligeramente entre reintentos, p.ej. un evento en
concreto del acta).

### Fix

Los 3 puntos separan el ARMADO del mensaje (try/catch, con fallback al
marcador simple `Local X - Y Visitante` si falla) de la ACCIÓN de
compartir/marcar (incondicional): `_waShareToGroup(...)` va en su
propio try/catch, y **`shared = true` + habilitar el botón siguiente
+ el cambio visual del botón a "✅ COMPARTIDO" SIEMPRE se ejecutan**,
pase lo que pase con el armado del texto rico. `_mlBuildAndShareWA`
(compartida por el post-partido de ml-card y el descanso) envuelve TODO
su cuerpo en try/catch con un fallback de una sola línea, para que
NUNCA propague una excepción a sus 2 callers (que desbloquean un botón
justo después de llamarla, sin su propio try/catch).

### Reglas a respetar

1. **PROHIBIDO** que un handler de "COMPARTIR POR WHATSAPP" (o
   cualquier botón nuevo de esta cadena que arme un mensaje rico antes
   de compartir) marque `shared`/habilite el botón siguiente SOLO tras
   una construcción de texto sin try/catch. El armado del mensaje puede
   fallar por datos de UN torneo/competición concreta; el marcado de
   "compartido" + la habilitación del siguiente paso son
   SIEMPRE incondicionales (con fallback de texto mínimo si el armado
   rico revienta).
2. **PROHIBIDO** que `_mlBuildAndShareWA` (o cualquier función de
   armado+compartir reutilizada por varios callers que desbloquean UI
   justo después de invocarla) propague una excepción a sus callers.
   Debe atrapar sus propios fallos y compartir como mínimo el marcador
   simple.
3. Si un click en un botón de esta cadena "no reacciona" de forma
   intermitente (funciona a la enésima pulsación), sospechar primero de
   un armado de mensaje sin try/catch antes que de un problema de
   captura del evento táctil/click — es el mismo síntoma pero con causa
   distinta a los bugs táctiles ya documentados de esta cadena.

## El overlay de ESTADÍSTICAS del FINALIZAR también se blinda con try/catch + display incondicional (obligatorio, 2026-07-07 #5)

**Bug (2 fotos usuario 2026-07-07, «Real Madrid vs Al Hilal SFC»,
Mundialito de Clubes — "ni deja finalizar (caja opaca) / ni deja poner
estadísticas / ni deja poner MVP / ni deja compartir por WhatsApp /
SOLUCION YA")**: tras elegir el portero en el picker de portería
imbatida (Thibaut Courtois), el partido se quedaba congelado — nunca
aparecía la pantalla de Estadísticas, ni MVP, ni WhatsApp, y FINALIZAR
seguía deshabilitado.

### Causa raíz

`_mlShowStatsOverlay` (`part2/misc_body_2.html`, el overlay de
posesión/tiros/faltas/córners que se abre tras la portería imbatida,
compartido por gm-modal y ml-card) construye TODO su contenido
(cabecera con escudos vía `getLogoEquipo`, `humanIcon`, el grid de filas
vía `_mlCountAutoStats` + `appendRow`) **SIN try/catch**, y solo al
FINAL hacía `ov.classList.add('show')`. Exactamente el mismo
anti-patrón ya corregido en `_gmShowFinalOv` (2026-07-05) y
`_gmFinalShareGate` (2026-07-06): si CUALQUIER paso del relleno lanzaba
una excepción (un dato inesperado del roster, un helper de escudo
fallando…), la función abortaba ANTES de mostrar el overlay — invisible
para el usuario, indistinguible de "se ha congelado". Como el botón
FINALIZAR ya estaba deshabilitado desde `_mlConfirmEnd` (regla
2026-07-05, botón se deshabilita al confirmar SÍ para evitar doble
disparo), el usuario se quedaba con la caja opaca sin ninguna pantalla
posterior. `_mlOpenStatsEntry` (el equivalente en ml-cards vía
`_mlShowFinalThenPost`) tenía el mismo hueco, más pequeño pero del
mismo patrón. Además, el callback `onDone` de `_ensureImbatEvents` en
la cadena de portería imbatida (`part2/misc_body_2.html`, la llamada
que re-dispara `gmEndMatch()` tras registrar el portero) invocaba
`window.gmEndMatch()` DIRECTAMENTE, sin pasar por `_gmSafeReenter`
(regla 2026-07-06 #4) — un único punto de reentrada que se había
quedado fuera de la auditoría de esa regla.

### Fix

- `_mlShowStatsOverlay`: todo el relleno de contenido (cabecera +
  grid de filas) envuelto en try/catch. Si falla, pinta un mensaje de
  aviso mínimo en el grid («No se pudieron cargar los detalles… pulsa
  CONFIRMAR para continuar sin estadísticas manuales») + banner
  `_gmCriticalNotice`. `ov.classList.add('show')` es **incondicional**,
  fuera del try/catch — el overlay SIEMPRE se muestra, con contenido
  completo o con el fallback.
- `_mlOpenStatsEntry`: mismo patrón (try/catch + display incondicional).
- El callback `onDone` de `_ensureImbatEvents` en `gmEndMatch` pasa a
  `window._gmSafeReenter(window.gmEndMatch, 'tras registrar portería
  imbatida')` en vez de `window.gmEndMatch()` directo.

### Reglas a respetar

1. **PROHIBIDO** que `_mlShowStatsOverlay`/`_mlOpenStatsEntry` (o
   cualquier overlay obligatorio nuevo de la cadena FINALIZAR) rellene
   su contenido sin try/catch antes de `classList.add('show')`. Mismo
   contrato que `_gmShowFinalOv`/`_gmFinalShareGate`: el display es
   SIEMPRE incondicional, con fallback mínimo si el relleno revienta.
2. **PROHIBIDO** que un callback `onDone`/reentrada a `gmEndMatch()`
   nuevo (o ya existente pero no auditado) llame a
   `window.gmEndMatch()` directo sin `_gmSafeReenter`. Auditar TODOS
   los call sites de `_ensureImbatEvents`, no solo los ya conocidos.

## La plantilla del HUB (caja "PLANTILLA" de un mister) nunca prefiere una fila "genérica" (power 70 / pos MED para todos) sobre la plantilla REAL editada (obligatorio, 2026-07-07 #4)

**Bug (6 fotos usuario 2026-07-07, «Arsenal-Brasil-Álvaro»)**: dentro de
la caja Arsenal-Brasil-Álvaro → 👕 PLANTILLA, TODOS los jugadores del
Arsenal aparecían bajo un único encabezado «⚙ MEDIOS» (porteros,
defensas y delanteros incluidos) con la media (🛡) fija en **70 para
absolutamente todos**. El editor de Resto de Ligas, para el MISMO
Arsenal, muestra la plantilla real con sus posiciones correctas
(PORTEROS/DEFENSAS/CENTROCAMPISTAS/DELANTEROS) y sus medias reales
(David Raya 86, Kepa 82, Saliba 87, Rice 88, Saka 88…).

### Causa raíz

`_findBayernRow()` (hub NO-legacy, `misc_body_1.html`) resuelve la
plantilla del club vía `_findRichestHubRow(name)`, que escanea TODAS
las `ligaExt_*` buscando filas que casen con el club (nombre exacto o
alias del mismo mister) y se queda con la de MÁS «riqueza»
(`_hubRowRichness` = Σ pj+gol+pen+fk de `t.players[]`), a propósito:
un club NO-legacy juega su liga doméstica como IA en una liga EXTERNA
(Resto de Ligas), así que esa fila —con partidos y goles reales— debe
ganar a un posible duplicado vacío en `liga-ea-sports`.

El problema: existen varios reconstructores de plantilla en el mismo
archivo (Fuentes C/D/E/F/G del rebuild de detalle de equipo,
~línea 13203 en adelante) que, cuando un equipo aparece con
`players:[]` en algún `ligaExt_<slug>`, lo RECONSTRUYEN a partir de
`ef_player_stats_v1` / `SQUAD_REGISTRY` / eventos de acta / resultados
— fuentes que solo traen el NOMBRE del jugador (además de sus
stats: pj/gol/mvp/ta/tr, que SÍ vienen reales), nunca su posición ni
su media real, así que rellenan `power:70, pos:'MED'` como placeholder
— y **persisten** ese resultado de vuelta en `ligaExt_<slug>` (local +
servidor). Esa fila "reconstruida" trae `pj`/`gol` reales embebidos en
cada jugador (porque las Fuentes C-G los copian directamente de
`ef_player_stats_v1`), así que su `_hubRowRichness` da un número
positivo. La plantilla REAL editada a mano, en cambio, JAMÁS guarda
`pj`/`gol` dentro de `t.players[]` (esas stats se calculan aparte, vía
`_statsFor`/`ef_player_stats_*`, para pintarlas en la columna de la
plantilla del hub) — su `_hubRowRichness` da **0 siempre**. Resultado:
la fila degradada (nombres reales, posiciones/medias inventadas)
"gana" por riqueza a la plantilla real, y `_findBayernRow` devuelve la
fila mala → `renderBayernPlantillaScreen` agrupa por `p.pos` (todo
`'MED'` o vacío → cae al bucket `by.MED`) y pinta `p.power` (70 fijo).

### Fix

Nuevo `_hubRowLooksGeneric(t)` (`misc_body_1.html`, junto a
`_hubRowRichness`): detecta la firma exacta de una fila
auto-reconstruida — **≥90% de sus jugadores con `power` vacío/exactamente
70 Y `pos` vacía/`'MED'`** (un roster real jamás tiene esa distribución
degenerada). `_findRichestHubRow` ahora compara primero por este flag:
una fila REAL siempre gana a una genérica, sin importar cuánta
"riqueza" de stats acumulada tenga esta última; solo si TODAS las
filas encontradas son genéricas se devuelve la de mayor riqueza (mismo
comportamiento de antes, para no dejar la caja vacía si de verdad no
hay ningún roster real en ningún dispositivo).

### Confirmación de la 2ª parte de la petición del usuario

Las estadísticas por jugador (goles/MVP/tarjetas/nota) de la plantilla
del hub YA se suman automáticamente de TODAS las competiciones
oficiales del club (Liga EA Sports, Copa del Rey, Supercopa de España,
Champions/Europa/Conference, Recopa, Supercopa de Europa,
Intercontinental, Mundialito de Clubes) **excepto Superliga, amistosos
y torneos de verano** — ver sección "Plantilla del hub (Liverpool-
Francia) — stats SUMADAS…" (2026-06-03) más abajo. Ese cálculo busca
por NOMBRE de jugador en `_STATS_STORES`/`_NOTA_STORES`
(`_buildStatsCache`), es independiente de qué fila de `t.players[]` se
haya resuelto como "la plantilla" — así que, con el roster REAL del
Arsenal ya resuelto correctamente por este fix, las estadísticas se
siguen sumando exactamente igual que en la caja de Liverpool, sin
tocar nada más.

### Reglas a respetar

1. **PROHIBIDO** que `_findRichestHubRow` (o cualquier resolutor de
   "la fila más rica" entre duplicados de un mismo club) compare
   ÚNICAMENTE por `_hubRowRichness` (stats acumuladas). Debe descartar
   primero las filas `_hubRowLooksGeneric` (placeholder auto-
   reconstruido) — una fila real con posiciones/medias editadas SIEMPRE
   gana a una degradada, aunque la degradada tenga más partidos/goles
   embebidos.
2. **PROHIBIDO** que las Fuentes C/D/E/F/G del rebuild de plantilla
   (`misc_body_1.html`, ~línea 13203, disparado cuando un equipo tiene
   `players:[]` en algún `ligaExt_<slug>`) dejen de usar `power:70,
   pos:'MED'` como placeholder explícito — el propio `_hubRowLooksGeneric`
   depende de esa firma exacta para poder distinguir "reconstruido" de
   "real". Si algún día se cambia el placeholder, actualizar el
   detector a la vez.
3. Toda caja de mister NUEVA hereda el fix automáticamente (el gate
   vive en `_findRichestHubRow`, genérico por club vía
   `_isHumanClubCanonico`/`_mhSameMister`, no hardcodea Arsenal).

## El overlay "Equipos por competición" NO hidrata las ~50 ligas si las 6 zonas están en modo Manual + las hidrataciones one-shot de arranque reintentan (obligatorio, 2026-07-07 #3)

**Bug (foto usuario 2026-07-07, «sigue sin cargar»)**: con las 6 zonas
en 🔒 Manual (el DEFAULT desde 2026-07-03), el overlay mostraba TODAS
las cajas a "0/40"/"0/34"/etc. y "CHAMPIONS LEAGUE — 0 EQUIPOS — Sin
equipos, revisa esta competición" — pese a que el servidor tenía
guardados 24 equipos manuales en Champions, 73/88 en Open Qualifier y
61/72 en Wild Card (confirmado en capturas anteriores del mismo día).
Encima el picker "AÑADIR POR LIGA" (Andorra) seguía atascado en
"⏳ Cargando clasificación…" y el banner superior en
"⏳ Cargando ligas del servidor (puede tardar 1-2 min con ~50 ligas)…".

### Causa raíz (2 bugs independientes)

1. **`_eurManualOverlayOpen` auto-hidrataba las ~50 ligas SIEMPRE al
   abrirse**, aunque las 6 zonas estuvieran en modo 🔒 Manual — en ese
   caso los 6 `compute*Classified()` cortan en la primera línea
   (`if(_eurManualOnly(zone)) return _appendManualExtra([], zone)`) y
   **NUNCA llegan a usar** los datos de las ~50 ligas. Era trabajo 100%
   desperdiciado que además competía por red/servidor (Railway) con el
   fetch del picker "AÑADIR POR LIGA" abierto en la MISMA pantalla,
   haciendo que este último se sintiera "eterno" por contención de
   recursos, no por su propio código (que ya tenía timeout+reintentos
   del fix anterior del mismo día).
2. **Las hidrataciones one-shot de arranque de `eur_manual_extra_v1` y
   `eur_manual_override_v1` (`_hydrateEurManualExtra`/
   `_hydrateEurManualOverride`) no tenían NINGÚN reintento** — un solo
   `fetch(...).catch(function(){})` mudo. Si ese único intento fallaba
   (cold-start de Railway, blip de red, justo la ventana de contención
   del bug 1), el store local se quedaba **VACÍO PARA SIEMPRE** en ese
   dispositivo — aunque el servidor SÍ tuviera los 24/73/61 equipos
   guardados, el dispositivo nunca los veía porque ya no reintentaba
   (y el guard `if(local) return;` significa que solo se hidrata UNA
   vez por dispositivo mientras no haya ninguna escritura local).

### Fix

- `_eurManualOverlayOpen` solo dispara el auto-hidrate de las ~50
  ligas si **al menos una** de las 6 zonas sigue en 🔓 Auto
  (`EUR_MANUAL_ZONES.some(z => !overridesNow[z])`). Con las 6 en
  Manual (caso más común tras el default 2026-07-03), el overlay abre
  sin disparar ni una sola petición de liga — solo lee
  `eur_manual_extra_v1` (ya local o ya hidratado).
- `_hydrateEurManualExtra`/`_hydrateEurManualOverride` pasan a usar
  `_eurBootFetchRetry` (3 intentos, backoff 1s/2s/3s) — mismo
  principio "un fallo de red nunca es la respuesta definitiva" que
  `_ppAliasDeferredCheck` (regla 2026-07-05).

### Reglas a respetar

1. **PROHIBIDO** que un auto-hidratador que trae datos para el cómputo
   AUTOMÁTICO se dispare cuando NINGUNA zona/consumidor va a usar ese
   cómputo (p.ej. las 6 zonas en modo Manual). Comprobar primero si el
   resultado se va a usar — si no, no hacer la petición.
2. **PROHIBIDO** que una hidratación one-shot de arranque (dispara solo
   si `!local`, nunca más mientras no haya escritura local) haga UN
   solo intento sin reintentos. Un fallo aquí no es recuperable después
   sin que el usuario añada manualmente algo (lo que dispara un save
   que sí persiste) — el coste de NO reintentar es un store que parece
   vacío para siempre en ese dispositivo, indistinguible de "no hay
   datos" cuando en realidad el servidor SÍ los tiene.
3. Toda hidratación one-shot NUEVA de este mismo patrón
   (`if(local) return; fetch(...)`) hereda `_eurBootFetchRetry` (o un
   helper equivalente) en vez de un `fetch` suelto con `.catch` mudo.

## 🗑 "Vaciar lista" por zona europea — el borrado es un TOMBSTONE (`clearedAt`) que sobrevive a la unión aditiva (obligatorio, 2026-07-07 #2)

**Petición usuario 2026-07-07** ("la lista entera de equipos en
Competiciones Europeas quiero un botón para limpiar la lista entera de
equipos de cada competición y si lo pulso que ese borrado se guarde
hasta que vuelva a añadir equipos"): en el overlay "👁 Ver / Añadir
equipos por competición", cada zona (Champions/Previa/Europa League/
Conference/Open Qualifier/Wild Card) solo tenía un ✕ POR EQUIPO. Vaciar
una lista de 24+ equipos a mano, uno a uno, es tedioso.

### Por qué no basta con vaciar el array local

`eur_manual_extra_v1` se fusiona en el servidor por **UNIÓN aditiva**
(`_eur_manual_extra_merge`, regla 2026-07-03: "con 6 móviles + PC, dos
dispositivos pueden añadir equipos DISTINTOS... un merge por recencia
perdería la adición del más lento"). Si el botón se limitara a mandar
`{zone: []}`, el servidor fusionaría ese array vacío con lo que YA
tenía guardado (`old[zone] ∪ [] = old[zone]`) — el vaciado sería
**invisible**, los equipos "borrados" seguirían ahí en el siguiente pull.

### Fix — tombstone `clearedAt` por zona + `addedAt` por entrada

- **Cliente** (`misc_body_1.html`): cada entrada añadida
  (`_eurManualExtraAdd`) lleva ahora `addedAt: Date.now()`.
  `window._eurManualExtraClearZone(zone)` vacía el array de esa zona Y
  sella `clearedAt[zone] = Date.now()`. `_eurManualExtraLoad` preserva
  `clearedAt` en cada round-trip load→save (si no, un add/remove
  posterior en OTRA zona lo pisaría con `{}` sin querer).
- **Servidor** (`_eur_manual_extra_merge`, `app.py`): tras la unión por
  nombre, se descarta cualquier entrada cuyo `addedAt` sea ANTERIOR o
  igual al `clearedAt` vigente de esa zona (el mayor entre lo
  almacenado y lo entrante). Un equipo añadido DESPUÉS del vaciado
  (`addedAt > clearedAt`) sobrevive con normalidad — así el vaciado
  persiste pero NO bloquea altas futuras. Entradas legacy sin
  `addedAt` cuentan como `addedAt=0` (un vaciado las descarta también,
  que es justo "limpiar la lista ENTERA"). Tests en
  `tests/test_api.py::TestEurManualExtraMerge`.
- **UI**: botón "🗑 Vaciar lista" junto a la cabecera de cada zona en la
  lista de manuales (`_eurManualOverlayRender`), con `confirm()` antes
  de vaciar (mismo patrón que el toggle 🔓 Auto / 🔒 Manual).

### Reglas a respetar

1. **PROHIBIDO** que un "vaciar lista"/"borrar todo" sobre un store con
   merge ADITIVO (unión) se implemente mandando el array vacío sin más:
   la unión lo resucitaría con la copia que el servidor ya tenía. Todo
   vaciado masivo nuevo sobre un store aditivo de este proyecto hereda
   el patrón tombstone (`clearedAt` por grupo + timestamp por entrada).
2. **PROHIBIDO** que `_eurManualExtraLoad` deje de preservar
   `clearedAt` en el objeto que devuelve — sin esto, cualquier
   add/remove en OTRA zona borraría el tombstone de la zona vaciada al
   guardar, y el vaciado "se olvidaría" en el siguiente ciclo.
3. **PROHIBIDO** que el vaciado bloquee altas futuras: una entrada con
   `addedAt` posterior al `clearedAt` de su zona SIEMPRE sobrevive.

## El picker "AÑADIR POR LIGA" (equipos por competición) resuelve el fallback `_protected` EN EL SERVIDOR — una sola petición (obligatorio, 2026-07-07)

**Bug (5 fotos usuario 2026-07-07, «Andorra», «Armenia», «Austria»,
«Azerbaiyán» — "la mayoría de las Ligas pone Cargando y se queda una
eternidad, no pudiendo añadir los equipos de esas ligas"; "en Ligas
como Alemania, Inglaterra, Italia etc la carga es rapidísima pero en
otras es eterna y ni siquiera carga")**: en el overlay "👁 Ver / Añadir
equipos por competición" → "📋 AÑADIR POR LIGA", elegir una liga menor
(nunca abierta en ESTE dispositivo) dejaba el picker congelado en
"⏳ Cargando clasificación…" durante mucho tiempo, mientras que las
ligas grandes/populares (ya cacheadas localmente por haberse abierto
antes en "Resto de Ligas") cargaban al instante.

### Causa raíz

`_eurPickerLoadLeague` (`misc_body_1.html`) ya tenía timeout+reintentos
(fix 2026-07-04) pero encadenaba **2 fetches CLIENT-SIDE secuenciales**:
primero `/api/liga-ext/<slug>` (hasta 3 intentos × 12 s = 36 s), y SOLO
si ese venía vacío, `/api/liga-ext-protected/<slug>` (hasta 2 intentos
× 12 s = 24 s más). Para una liga menor que NINGÚN dispositivo ha
tocado nunca (Andorra, Armenia, Austria, Azerbaiyán…, sin plantilla ni
clasificación en ningún lado), el picker tenía que agotar la cadena
COMPLETA — hasta 60 segundos — antes de poder mostrar el mensaje de
error. Las ligas "rapidísimas" (Alemania, Inglaterra, Italia) en
realidad no pasaban por red en absoluto: ya estaban cacheadas en
`localStorage` de ese dispositivo (`_finish(local)` síncrono), lo que
hacía el contraste con las demás aún más chocante.

### Fix

- **Nuevo endpoint `GET /api/liga-ext-any/<slug>`** (`app.py`): resuelve
  el fallback main→`_protected` **EN EL SERVIDOR**, en una sola
  petición — mismo principio que `/api/team-alias/<nombre>`
  (2026-07-05, "la búsqueda de identidad por nombre es SERVER-SIDE").
  `_eurPickerLoadLeague` pasa a hacer UNA sola llamada con reintentos
  más cortos (3 × 6 s = 18 s peor caso, antes 60 s).
- **Índice pre-cargado** (`_eurEnsureLeagueIndex`, reutiliza
  `GET /api/liga-ext` sin slug, ya existente para el editor de
  torneos): una única petición barata trae qué ligas tienen equipos
  reales en el servidor. Si la liga elegida NO aparece en ese índice,
  el picker se salta el fetch por completo y muestra al instante
  "esta liga aún no tiene equipos guardados en ningún dispositivo" —
  sin esperar ningún timeout, porque el resultado ya se sabe de
  antemano que va a ser vacío.

### Reglas a respetar

1. **PROHIBIDO** que un picker/búsqueda que dependa de un fallback
   servidor (main → `_protected`, o cualquier par similar) encadene
   2+ fetches CLIENT-SIDE secuenciales, cada uno con sus propios
   reintentos. El fallback se resuelve en el SERVIDOR en una sola
   petición (patrón ya establecido por `/api/team-alias/<nombre>`).
2. **PROHIBIDO** que el picker espere el timeout completo para una
   liga que un índice barato (`/api/liga-ext` sin slug) ya puede
   confirmar que no tiene equipos en ningún dispositivo. Consultar
   el índice primero y solo hacer el fetch por-liga si hace falta.
3. **PROHIBIDO** volver a subir el timeout por intento por encima de
   6-8 s o los reintentos por encima de 3 para este picker — el
   objetivo es que el peor caso se sienta como "unos segundos", no
   "un minuto".

## Un fallo del prefetch de alias NO bloquea PARA SIEMPRE los reintentos de ESE equipo en la sesión (obligatorio, 2026-07-06 #7)

**Bug (3 fotos usuario 2026-07-06, «Arsenal vs Maccabi Tel Aviv» ·
«Inter vs Aris Thessaloniki» · «FK Bodø Glimt vs Arsenal», Trofeo Joan
Gamper — "el arista es harónico [Aris y Bodø funcionan], pero Maccabi
Tel Aviv, que SÍ tiene alias (Sudamérica - Argentina - Rosario AA), no
emerge la interrogación")**: en la misma sesión/dispositivo, el botón ❓
aparecía correctamente para Aris Thessaloniki y FK Bodø Glimt (equipos
tocados por PRIMERA vez) pero NUNCA para Maccabi Tel Aviv, pese a tener
alias configurado y confirmado guardado en servidor.

### Causa raíz

`window._tourPrefetchMatchAlias` (misc_body_1.html, fix 2026-07-06 #2)
usa `_TOUR_ALIAS_PREFETCHED[norm]` como guarda para no repetir la
petición de servidor en cada tap. El bug: la marca se ponía a `true`
**ANTES** de conocer la respuesta (para evitar peticiones duplicadas
concurrentes), y el callback **NUNCA la desmarcaba** cuando el servidor
respondía "no encontrado" (`if (!found) return;`, sin tocar la marca).
Efecto: el PRIMER intento fallido de un equipo (p.ej. un tap anterior en
la misma sesión, antes de que el admin terminara de guardar el alias en
otro dispositivo, o un cold-start de Railway) dejaba ese nombre de
equipo **bloqueado para SIEMPRE** — ningún tap futuro de NINGÚN partido
con ese equipo volvía a preguntar al servidor, aunque el alias ya
estuviera disponible minutos después. Los equipos tocados por primera
vez (Aris, Bodø) no tenían ese lastre y funcionaban a la primera.

### Fix

`_tourPrefetchMatchAlias` distingue ÉXITO de FALLO: solo un alias
ENCONTRADO marca `_TOUR_ALIAS_PREFETCHED[norm] = true` (permanente, ya
resuelto). Un fallo guarda el **timestamp** del intento
(`_TOUR_ALIAS_PREFETCHED[norm] = Date.now()`) y permite reintentar
pasados `_ALIAS_PREFETCH_COOLDOWN_MS` (15 s) — evita machacar al
servidor en taps consecutivos inmediatos del mismo partido, pero ya NO
bloquea el equipo para el resto de la sesión.

### Reglas a respetar

1. **PROHIBIDO** que `_TOUR_ALIAS_PREFETCHED` (o cualquier guarda anti-
   duplicados de una búsqueda de identidad por nombre) marque un fallo
   igual que un éxito. Solo un resultado POSITIVO puede marcarse como
   "resuelto, no repetir nunca más" — un fallo es SIEMPRE temporal
   (cooldown corto), nunca un bloqueo permanente de sesión.
2. Este bug es el mismo patrón, en otra capa, que la regla 2026-07-05
   ("PROHIBIDO que una búsqueda... se rinda tras el PRIMER fallo sin
   reintentar") — esa regla ya protegía `_ppAliasDeferredCheck`
   (reintentos dentro de un mismo render de previa); esta capa protege
   el prefetch DISPARADO AL TAP entre distintas aperturas de previa /
   distintos partidos con el mismo equipo a lo largo de la sesión.

## El acta/MVP de un equipo IA con plantilla REAL completa NUNCA muestra "Jugador A"/"Portero" (obligatorio, 2026-07-06 #6)

**Bug (3 fotos usuario 2026-07-06, «Maccabi Tel Aviv vs Liverpool», 0-0,
Trofeo Joan Gamper — "la plantilla del Maccabi Tel Aviv está completa
pero en el acta salen jugador A etc, así con todas")**: el acta del
partido mostraba «90' 🧤 Portero» (imbatida) y «FIN ⭐ Jugador A» (MVP)
para el Maccabi Tel Aviv, pese a que la pantalla de PLANTILLA del mismo
equipo (misma sesión) mostraba su roster REAL y completo (Sagiv
Jehezkel, O. Davida, Hélio Varela… 46 partidos cada uno, `PJ`/goles/MVP
ya acumulados). El usuario confirmó que le pasa "así con todas" las
cajas IA, no solo Maccabi.

### Causa raíz (2 bugs independientes)

1. **`sqFromRegistry` (`static/js/index.bundle.js`) solo escaneaba
   `localStorage['ligaExt_*']`**, nunca `window.LIGA_CACHE` (el cache EN
   MEMORIA que `loadData()` rellena al abrir la pantalla de una liga).
   Una liga grande de Resto de Ligas (40+ equipos con plantilla
   completa) puede superar la cuota de `localStorage` y quedar
   `_lsSetSafe`-descartada — la liga sigue viva en `LIGA_CACHE` (por
   eso la pantalla de PLANTILLA, que lee de ahí, mostraba el roster
   real) pero `sqFromRegistry`/`sqFromRegistryFull` (usados por
   `_getTopGk`, `genMatchEventsEnhanced`, el MVP obligatorio…) no la
   veían — caían al placeholder `['','Jugador A','F',76]` /
   `{num:'1', name:'Portero'}` documentado en las reglas de arriba.
2. **`_mlEndMatchGen` (MVP obligatorio genérico, `part2/misc_body_2.html`)
   leía `window.SQUAD_REGISTRY[st.home]`/`[st.away]` DIRECTAMENTE**, sin
   pasar por `sqFromRegistryFull`/`sqFromRegistry` (ni sus fallbacks:
   `applyEngineOverrides`, escaneo `ligaExt_*`, ahora `LIGA_CACHE`).
   `SQUAD_REGISTRY[team]` solo se "calienta" como efecto colateral de
   una llamada previa a `sqFromRegistry`/`sqFromRegistryFull` para ESE
   equipo exacto — en un partido sin portería a cero (por tanto sin
   `_ensureImbatEvents`/`_getTopGk` de por medio) el MVP era el PRIMER
   punto que tocaba la plantilla del IA, y como leía el registro a
   pelo, la devolvía vacía.
3. **`_iaEventsHtml` (el render del acta, mismo archivo) reparaba EN
   VIVO solo "Jugador A"/"Jugador B" exactos** (`_fixPlayer`, comentario
   "evitamos migración destructiva"). No cubría "Portero" (placeholder
   de portería imbatida), ni "Jugador N" (roster genérico numérico,
   `_lextBuildDefaultRoster`), y el MVP mostrado en la fila "FIN ⭐"
   (`m.mvp`) NI SIQUIERA pasaba por esa reparación — se imprimía tal
   cual viniera guardado.

### Fix

- `sqFromRegistry`: el escaneo de `ligaExt_*` se extrajo a un helper
  `_matchTeamInArray(teams)` (mismas 3 pasadas: exacto → substring →
  agresivo sin sufijos) reutilizado también contra
  `Object.keys(window.LIGA_CACHE)` cuando el escaneo de localStorage no
  encuentra nada. Barato (solo ligas ya cargadas en memoria esta
  sesión), sin tocar red.
- `_mlEndMatchGen`: `sqA`/`sqB` del MVP obligatorio se resuelven vía
  `sqFromRegistryFull(st.home)`/`sqFromRegistryFull(st.away)` primero
  (con TODOS sus fallbacks), cayendo a `SQUAD_REGISTRY[...]` crudo solo
  si `sqFromRegistryFull` también viene vacío.
- `_iaEventsHtml`: `_isPlaceholderName` generaliza el detector al MISMO
  regex que `_bfIsRealName` (backfill persistente,
  `/^(?:\d+\.?\s*)?(?:jugador|portero)\s*(?:[a-k]|ia|\d+)?$/i`) — cubre
  "Portero"/"Portero A"/"Jugador N" además de "Jugador A/B".
  `_realFallbackName` acepta un 2º parámetro `preferGk`: para un evento
  `imbat` (portería a cero) elige un PORTERO real del roster en vez de
  cualquier jugador de campo. El MVP (`m.mvp`) ahora pasa por la MISMA
  reparación antes de imprimirse.

### Reglas a respetar

1. **PROHIBIDO** que `sqFromRegistry` (o cualquier resolutor de
   plantilla nuevo) escanee SOLO `localStorage['ligaExt_*']` sin
   consultar también `window.LIGA_CACHE`. Una liga grande puede vivir
   SOLO en memoria si superó la cuota de `localStorage` — el escaneo
   debe cubrir ambas fuentes, igual que el bake de alias eFootball
   escanea `window._TOUR_CACHE` además de localStorage.
2. **PROHIBIDO** que un gate obligatorio nuevo (MVP, imbat, sanciones,
   evento manual…) lea `window.SQUAD_REGISTRY[team]` DIRECTAMENTE sin
   pasar antes por `sqFromRegistryFull`/`sqFromRegistry`. El registro
   solo se puebla como efecto colateral de una llamada previa a esas
   funciones — un gate que sea el PRIMERO en tocar la plantilla de un
   equipo (p.ej. MVP en un partido sin portería a cero) se queda con
   `[]` si no dispara él mismo la resolución completa.
3. **PROHIBIDO** que el detector de "nombre placeholder" de un reparador
   EN VIVO del acta (`_iaEventsHtml`/`_fixPlayer` o cualquier futuro)
   reconozca SOLO "Jugador A"/"Jugador B" exactos. Debe compartir el
   MISMO regex que `_bfIsRealName` (backfill persistente) — de lo
   contrario un placeholder tipo "Portero"/"Jugador 22" pasa la
   reparación de display pero no la de persistencia (o viceversa),
   dando inconsistencias entre lo que se ve y lo que se guarda.
4. **PROHIBIDO** que el MVP mostrado al final del acta (`m.mvp`) se
   imprima sin pasar por el mismo reparador de placeholder que el resto
   de eventos — es el ÚNICO valor que quedaba sin blindar.

## Los avisos CRÍTICOS de la cadena FINALIZAR usan un banner propio, NUNCA `alert()` a secas (obligatorio, 2026-07-06 #5)

**Bug (foto usuario 2026-07-06, «Real Madrid vs CA Boca Juniors», MVP y
estadísticas ya confirmados, "error crítico" — reproducido tras varias
rondas previas de fixes que SÍ deberían haber mostrado un aviso)**: el
botón FINALIZAR seguía quedando bloqueado sin ningún mensaje visible,
pese a que `_gmSafeReenter` y el watchdog recurrente (ambos ya
mergeados) deberían capturar CUALQUIER fallo de la cadena y mostrar un
`alert()`.

### Causa raíz — Chrome puede SUPRIMIR `alert()` sin avisar

Verificado en un harness Playwright real (Chromium) que la pantalla de
"📲 COMPARTIR PARTIDO" se pinta correctamente cuando se la invoca
directamente — el código de esa pantalla no tiene ningún bug de
renderizado. La sesión de este usuario lleva HORAS de pruebas con
docenas de `alert()`/`confirm()` disparados (confirmaciones de
FINALIZAR, "elige MVP", avisos de error de rondas anteriores…). Chrome
(y otros navegadores) puede **suprimir silenciosamente** los diálogos
`alert()`/`confirm()` de una pestaña que ya mostró varios seguidos — es
un comportamiento anti-spam del propio navegador, el usuario no tiene
que marcar ninguna casilla a propósito. El JS sigue corriendo con total
normalidad (el `catch` se ejecuta, `_gmReenableEndBtn()` reactiva el
botón — de ahí que el botón cambiara de aspecto en las fotos) pero el
`alert()` final NUNCA llega a pintarse en pantalla: desde el punto de
vista del usuario es indistinguible de "no ha pasado nada".

### Fix

Nuevo `window._gmCriticalNotice(msg)` (`part2/misc_body_2.html`, junto
a `_gmSafeReenter`): un `<div>` fijo (`z-index:2147483647`, el máximo
posible) creado con `document.createElement` y añadido directamente a
`document.body`, con su propio botón "ENTENDIDO" — **NUNCA usa la API
`alert()`/`confirm()` del navegador**, así que es inmune a la supresión
anti-spam. Sustituye a `alert(...)` en TODOS los puntos críticos de la
cadena FINALIZAR: `_gmSafeReenter`, las 3 alertas del watchdog
recurrente, el fallback de `_mlConfirmEnd`, el fallback interno de
`_gmFinalShareGate`, y los 3 `alert()` de `_ensureImbatEvents`/
`confirmImbatForce`/`cancelImbatForce` en `index.bundle.js` (con
`(window._gmCriticalNotice || alert)(...)` como patrón, para que
funcione aunque `misc_body_2.html` no haya cargado aún). Bump
`index.bundle.js` 9.27 → 9.29 (9.28 colisionaba con el bump en paralelo
de otra sesión, "La plantilla del HUB…", mergeada a la vez).

### Reglas a respetar

1. **PROHIBIDO** que un aviso CRÍTICO de un flujo obligatorio largo
   (imbatida→Estadísticas→MVP→WhatsApp→fin, o cualquier cadena similar
   con múltiples diálogos previos) dependa ÚNICAMENTE de `alert()`.
   Sesiones largas con muchos diálogos previos pueden hacer que el
   navegador los suprima en silencio — usar `window._gmCriticalNotice`
   (o el patrón `(window._gmCriticalNotice || alert)(...)`) para
   cualquier aviso nuevo de esta cadena.
2. **PROHIBIDO** asumir que "el catch no mostró alert visible" significa
   "el catch no se ejecutó". El `console.warn`/`console.error` que
   acompaña a cada aviso sigue siendo la única forma fiable de
   confirmarlo por remote-debugging si hiciera falta — `_gmCriticalNotice`
   igual logea a consola además de pintar el banner.
3. Antes de seguir buscando un bug de LÓGICA en una cadena ya
   fuertemente blindada (`_gmSafeReenter` + watchdog recurrente) que
   "sigue sin mostrar ningún aviso", verificar primero con un harness
   real (Playwright) si la función implicada renderiza correctamente en
   aislado — si SÍ renderiza, el hueco está en la VISIBILIDAD del aviso
   de error (esta regla), no en la lógica de la cadena.

## El PRIMER disparo de `gmEndMatch()` (al confirmar "SÍ") también va protegido con `_gmSafeReenter` (obligatorio, 2026-07-06 #4)

**Bug (foto usuario 2026-07-06, «Maccabi Tel Aviv vs Liverpool», 1-1,
MVP ya elegido — "sigue igual", tras 3 rondas previas de fixes en el
mismo día sobre esta misma cadena)**: pese a que `_gmSafeReenter` ya
protegía TODAS las reentradas diferidas a `gmEndMatch()` (tras
MVP/estadísticas/WhatsApp/penaltis), el bloqueo seguía reproduciéndose
sin ningún aviso.

### Causa raíz — el PRIMER disparo de la cadena se quedó sin blindar

`_mlConfirmEnd` (el handler de "SÍ" en el diálogo de confirmar
FINALIZAR) llama a `yesCb()` — la primerísima invocación de
`gmEndMatch()` de todo el partido — con:
```js
try { yesCb(); }
catch(errYes) {
  try { if (typeof window._gmDiagLog === 'function') window._gmDiagLog('yesCb() LANZÓ: ' + ...); } catch(_){}
}
```
Este `catch` NUNCA se actualizó a `_gmSafeReenter` cuando se introdujo
el helper — solo logueaba (antes en el panel visible, ahora solo en
consola tras quitar ese panel). Si un partido llega a este punto con
`matchStats` y MVP YA puestos de antes (p.ej. añadidos a mano vía
+ AÑADIR EVENTO antes de pulsar FINALIZAR, en vez de a través de los
gates automáticos), esta ÚNICA llamada puede recorrer TODA la cadena
—incluido el gate de WhatsApp— en el mismo tick sin pasar nunca por
ninguna de las reentradas diferidas que sí estaban protegidas. Si algo
revienta ahí, no quedaba NINGÚN rastro visible: ni alert, ni
reactivación del botón — indistinguible del bloqueo original.

### Fix

`_mlConfirmEnd` llama a `yesCb()` a través de `window._gmSafeReenter`
(con fallback equivalente in-place si el helper no estuviera cargado),
igual que todas las demás reentradas.

### Reglas a respetar

1. **PROHIBIDO** que la llamada INICIAL a `gmEndMatch()`/`mlEndMatchGen`
   (la que dispara `_mlConfirmEnd` al confirmar "SÍ") tenga un
   tratamiento de errores distinto — más débil — que las reentradas
   diferidas posteriores. Es la MISMA función y puede recorrer la MISMA
   cadena completa en una sola llamada si los gates previos ya estaban
   satisfechos de antemano.
2. Todo helper de blindaje nuevo (`_gmSafeReenter` o el que lo suceda)
   debe auditarse contra **todos** los call-sites de la función que
   protege, no solo los que se tocaron en el momento de crearlo — un
   call-site olvidado reproduce el bug original de forma intermitente
   y muy difícil de diagnosticar a distancia.

## Las plantillas de los equipos IA JAMÁS muestran jugadores lesionados (obligatorio, 2026-07-06 #5)

**Bug (foto usuario 2026-07-06, «EC Bahía», Resto Mundo)**: la pantalla
de PLANTILLA del editor de Resto de Ligas (`renderSquadList`, pantalla
genérica que edita el roster de CUALQUIER equipo — Liga EA Sports,
Resto de Ligas, Resto del Mundo, etc.) mostraba jugadores con roster
genérico («Jugador 7», «Jugador 8», «Jugador 19»…) marcados con un
badge de LESIÓN («1P»/«2P»/«3P»). EC Bahía es un equipo 100% IA — no
tiene ningún mister humano — y NUNCA debería mostrar bajas por lesión.
El usuario fue tajante: **"las plantillas de los equipos IA jamás
pueden tener jugadores lesionados, ese invento elimínalo"**.

### Causa raíz

El badge de lesión de `rowFor` (dentro de `renderSquadList`,
`templates/partials/misc_body_1.html`) leía
`(window.LESION_STORE || {})[p.name]` **sin comprobar en absoluto de
qué equipo es `p`**. `LESION_STORE` es un diccionario plano indexado
por NOMBRE de jugador (no por equipo), y los rosters GENÉRICOS por
defecto (`_lextBuildDefaultRoster`: «Jugador 1».."Jugador 30") se
REPITEN literalmente en decenas de equipos IA distintos de Resto de
Ligas. Si el hub humano (o cualquier otro flujo que escriba en
`LESION_STORE`) tenía una lesión registrada para un jugador llamado
"Jugador 8", **CUALQUIER equipo IA con un jugador del mismo nombre
genérico heredaba visualmente esa lesión** — aunque fuera de un club
completamente distinto y nunca hubiera jugado ese partido. El
comentario original del código incluso admitía la intención real:
"Pedido por el usuario: en las plantillas de las cajas de los
equipos HUMANOS salga los partidos lesionados" — pero el gate a
"solo humanos" nunca se implementó.

### Fix

El badge de lesión en `rowFor` ahora solo se calcula si
`window._isHumanClubCanonico(t.name)` es `true` (el mismo registro
canónico de los 6 misters humanos que usa el resto del proyecto). Un
equipo IA (Resto de Ligas, Resto del Mundo, Liga EA Sports IA, o
cualquier otro) JAMÁS entra en el `if` y por tanto JAMÁS puede
mostrar el badge de lesión, sin importar coincidencias de nombre
genérico con `LESION_STORE`.

### Reglas a respetar

1. **PROHIBIDO** que `renderSquadList` (o cualquier editor de roster
   genérico que sirva para editar equipos IA Y humanos por igual)
   lea `LESION_STORE[p.name]` sin comprobar primero
   `window._isHumanClubCanonico(t.name)`. Es un store indexado SOLO
   por nombre de jugador — sin ese gate, los rosters genéricos
   compartidos entre decenas de equipos IA contaminan el display.
2. **PROHIBIDO** que un equipo IA muestre CUALQUIER indicador de baja
   por lesión en su plantilla. Las bajas por lesión son un dato
   EXCLUSIVO de las 6 cajas de mister humano (Liverpool, Arsenal,
   Real Madrid, Atlético Madrid, FC Barcelona, PSG) y de sus
   selecciones (vía el motor `_sel*` paralelo). Ningún equipo IA
   "inventa" lesiones visibles en su plantilla.
3. Si en el futuro se añade OTRO editor de roster genérico nuevo que
   pinte badges de estado (lesión, sanción, etc.), debe heredar el
   mismo gate `_isHumanClubCanonico` — nunca fiarse de que el nombre
   del jugador por sí solo identifique de forma única a quién
   pertenece esa baja.

## Dos sesiones en paralelo arreglaron el mismo bug del ❓ — consolidado en `index.bundle.js` 9.26 (2026-07-06 #3)

Dos ramas distintas (`claude/team-alias-display-issue-99z45k` y
`claude/efootball-alias-team-indicator-tt4oyf`) atacaron el mismo bug del
❓ de alias eFootball en paralelo con fixes COMPLEMENTARIOS, no
contradictorios: una añade `_ppTourAliasFor`/`_ppResolveAlias` (lee
`cfg.teams[].efootballAlias` directo y síncrono en el render, inmune al
TTL de 3 s de `_ALIAS_CACHE`); la otra añade `_tourPrefetchMatchAlias`
(pregunta al servidor en el instante del tap, antes de pintar la previa)
+ amplía los reintentos de `_ppAliasDeferredCheck` de 3 a 6. Ambas se
consolidaron en una sola rama — **`index.bundle.js` queda en 9.26**
(9.24→9.25 de cada fix por separado colisionaba en el mismo número).
**PROHIBIDO** asumir que solo una de las dos vías es la "buena": las 3
capas (síncrona vía cfg del torneo, prefetch al tap, deferred check con
más reintentos) son necesarias y se complementan.

## El alias eFootball se PREGUNTA AL SERVIDOR EN EL INSTANTE del tap, no solo cuando la previa ya se está pintando (obligatorio, 2026-07-06 #2)

**Bug (5 fotos usuario 2026-07-06, mismo día del fix anterior — «Arsenal
vs Maccabi Tel Aviv», «Maccabi Tel Aviv vs Liverpool», «FK Bodø Glimt vs
Arsenal», Trofeo Joan Gamper — "llevamos 20 veces intentando y no
funciona")**: pese al fix de arriba (bake del alias dentro de
`cfg.teams[]`), el ❓ seguía sin aparecer bajo Maccabi Tel Aviv ni bajo FK
Bodø Glimt en NINGUNO de los 3 partidos probados, aunque el editor de
Resto de Ligas mostraba el alias ya guardado para ambos equipos
(confirmado en las mismas capturas: Maccabi con «Sudamérica - 1🇦🇷 -
Rosario AA…», Bodø Glimt con «Sudamérica - 🇦🇷 - Boca Juniors…»).

### Causa raíz — la única vía a servidor arrancaba TARDE y con poco margen

El bake local (`_tourBackfillEfootballAlias`) solo puede rellenar el
alias si ESTE dispositivo tiene cacheada la liga origen; si no, la ÚNICA
vía que pregunta al servidor era `_ppAliasDeferredCheck`
(`index.bundle.js`), y esa función **arranca justo cuando la pantalla de
previa ya se está pintando** — con solo 3 intentos y ~5 s de margen
propio (cada intento puede tardar hasta 6 s por el timeout interno de
`_efAliasServerSearch` antes de fallar y pasar al siguiente). Con
Railway en cold-start o una red móvil floja, esa única ventana se agotaba
antes de que el servidor respondiera, y como el resultado no se
reintenta por ninguna otra vía, CADA apertura de la previa volvía a
depender de ganar la misma carrera contra el mismo cold-start — de ahí
que fallara las veces que hiciera falta probarlo.

### Fix — prefetch dirigido en el instante del TAP, más reintentos

- **`window._tourPrefetchMatchAlias(nameA, nameB)`** (nuevo,
  `misc_body_1.html`, junto a `_efAliasBakeIntoTours`): dispara
  `_efAliasServerSearch` para los 2 equipos del partido **en el instante
  en que `_tourOpenHumanMatch` procesa el tap** — ANTES de que la
  pantalla de previa empiece siquiera a construirse. Le da a la petición
  todo el tiempo de la carga/animación previa como margen EXTRA, y si el
  admin reabre el mismo partido el resultado cacheado
  (`_TOUR_ALIAS_PREFETCHED`) evita repetir la petición. Si el alias
  llega ANTES de que `_ppPreviaTeams`/`_renderPreviaMeta` corran, el
  bake en `cfg.teams[]` hace que el PRIMER pintado ya salga con el ❓ —
  sin depender en absoluto del deferred check del bundle. Si llega
  DESPUÉS (previa ya pintada sin alias), `_tourAliasInjectIfOpen`
  localiza el placeholder correcto por LADO (`window._ppPreviaTeams.home/
  away`, no por atributo — el placeholder vacío no lleva el nombre del
  equipo) e inyecta el botón ❓ directamente, cubriendo el caso de que el
  deferred check del bundle ya se hubiera rendido. Es ADITIVO — nunca
  sustituye el deferred check existente, es una segunda vía
  independiente — y son SOLO 2 peticiones como máximo por partido, nunca
  la liga/torneo entera.
- **`_ppAliasDeferredCheck`** (`index.bundle.js`): reintentos ampliados
  de 3 a 6 (`DELAYS = [0, 1500, 3000, 5000, 8000, 12000]`) — 3
  intentos/5 s no sobrevivían a un cold-start lento de Railway.
- Bump `index.bundle.js` 9.24 → 9.25.

### Reglas a respetar

1. **PROHIBIDO** que la búsqueda de alias en servidor dependa de una
   ÚNICA vía que arranca cuando la previa YA se está pintando. Todo
   opener de partido humano (`_tourOpenHumanMatch`, `copaAbrirPrevia`, o
   cualquier futuro) debe disparar el prefetch de alias EN EL INSTANTE
   del tap, antes de construir la previa, para maximizar el margen
   contra cold-starts / red móvil lenta.
2. **PROHIBIDO** ampliar `_tourPrefetchMatchAlias` a recorrer más de los
   2 equipos del partido concreto (nunca la liga/torneo entera de golpe)
   — eso reintroduce el thundering herd contra el servidor que este
   proyecto lleva evitando desde 2026-06-25.
3. **PROHIBIDO** que `_tourAliasInjectIfOpen` identifique el placeholder
   por un atributo con el nombre del equipo: el placeholder vacío
   (`_ppAliasHtml` con `show=false`) NO lo lleva. Identificar SIEMPRE por
   LADO contra `window._ppPreviaTeams.home`/`.away`.
4. **PROHIBIDO** volver a bajar `_ppAliasDeferredCheck` a 3 intentos /
   5 s de margen: un cold-start de Railway puede tardar bastante más y
   esa era la causa exacta de este bug.

## La pantalla BAJAS PARA EL PARTIDO solo muestra las bajas del lado HUMANO (obligatorio, 2026-07-06)

**Bug (foto usuario 2026-07-06, «Inter vs Antwerp», Trofeo Joan Gamper)**:
la pantalla previa "🚑 LESIONADOS" mostraba a «Farouck Adekami · Antwerp»
y «Jugador 28 · Antwerp» — jugadores del rival IA — en la caja del
usuario, que juega con el Inter (humano). El usuario: "no tienen que
salirme los lesionados del Antwerp, solo los de mi equipo".

### Causa raíz

`window._ppPlayerBelongsToMatch` (filtro compartido de la pantalla BAJAS
PARA EL PARTIDO, usado tanto por la lista de LESIONADOS como por el
resto de la card) aceptaba un jugador si su equipo era CUALQUIERA de
los 2 equipos del partido (`teams.home` **o** `teams.away`), sin mirar
si ese lado era humano o IA. La regla previa (2026-06-28) solo excluía
selecciones y cajas de OTRO mister humano — nunca contempló que el
propio RIVAL IA del partido también debía quedar fuera: esta pantalla
es para que el humano sepa a quién de SU plantilla no puede convocar,
el rival IA no aporta nada ahí.

### Fix

`_ppPlayerBelongsToMatch` ahora construye `normTargets` filtrando
`teams.home`/`teams.away` por humanidad (`isHumanInComp` →
`_isHumanClubCanonico` → `_esSelHumana` → `esHumano`, mismas capas que
`_gmHumanInvolved`). Si NINGÚN lado resuelve humano (detección aún
hidratando), no se restringe — mejor mostrar de más que arriesgarse a
ocultar las bajas del propio humano por un falso negativo transitorio.
Bump `index.bundle.js` 9.25 → 9.26.

### Reglas a respetar

1. **PROHIBIDO** que `_ppPlayerBelongsToMatch` (o cualquier filtro de la
   pantalla BAJAS PARA EL PARTIDO) acepte un jugador solo por pertenecer
   a "alguno de los 2 equipos del partido" sin comprobar que ese lado es
   HUMANO. El rival IA nunca aporta bajas relevantes para el humano.
2. **PROHIBIDO** quitar el fallback "si ningún lado resuelve humano, no
   restringir" — es la red que evita ocultar las bajas del propio
   humano si la detección de humanidad falla transitoriamente.

## El watchdog anti-bloqueo de FINALIZAR es un POLL recurrente, no un único disparo a los 9s (obligatorio, 2026-07-06)

**Bug (2 fotos usuario 2026-07-06, «Inter vs Antwerp»)**: con el MVP ya
elegido (Marcus Thuram) y las estadísticas ya confirmadas, la pantalla
obligatoria "📲 COMPARTIR PARTIDO" nunca llegó a aparecer y FINALIZAR se
quedó bloqueado para siempre — sin ningún aviso, ni siquiera el del
watchdog ya existente.

### Causa raíz

El watchdog de `_mlConfirmEnd` (introducido 2026-07-05) comprobaba
UNA SOLA VEZ, a los 9 segundos exactos desde que el usuario confirma
"SÍ", si algún overlay conocido de la cadena estaba visible. El
problema: la cadena real (rellenar estadísticas + elegir equipo/jugador
del MVP) tarda, de sobra, MÁS de 9 segundos para un humano — así que a
los 9s casi siempre hay un overlay legítimo abierto (`gm-team-pick`,
`gm-player-pick`, el propio `alert()` de "elige MVP"…), el chequeo
único se descartaba a sí mismo PARA SIEMPRE sin volver a mirar nunca
más. Si el fallo real ocurría DESPUÉS (como aquí, la puerta de
WhatsApp que no llegó a pintarse), no quedaba NINGUNA red que lo
detectara.

### Fix

El watchdog pasa de `setTimeout` único a `setInterval` cada 4s,
indefinido mientras el botón siga deshabilitado. Cualquier overlay
conocido visible en un tick RESETEA el contador de estancamiento (hay
progreso legítimo); solo tras 4 comprobaciones SEGUIDAS sin nada
visible (~16s de estancamiento REAL, no 9s desde el clic inicial) se
reactiva el botón + aviso. Se detiene solo si `#gm-modal` se cierra, si
el partido termina (`_gm.finished`, con su propio aviso) o si el botón
deja de estar deshabilitado.

### Reglas a respetar

3. **PROHIBIDO** que un watchdog anti-bloqueo de una cadena
   MULTI-PASO con interacción humana real (rellenar formularios, elegir
   equipo/jugador…) sea un chequeo ÚNICO a un tiempo fijo corto. Debe
   ser un POLL recurrente que resetee su contador de estancamiento cada
   vez que detecta progreso legítimo (un overlay conocido visible), y
   solo actuar tras varias comprobaciones SEGUIDAS sin nada — nunca tras
   una única foto fija del estado a los pocos segundos del clic inicial.
4. Todo watchdog recurrente nuevo de este tipo debe pararse solo
   (`clearInterval`) al cerrarse el modal/pantalla que vigila, al
   terminar el partido, o al reactivar el botón — nunca dejar el
   intervalo corriendo indefinidamente de fondo.

## Toda reentrada a `gmEndMatch()` desde un callback diferido va protegida con `_gmSafeReenter` (obligatorio, 2026-07-06)

**Bug (5 fotos usuario 2026-07-06, «España vs Líbano», Road Copa Asia)**:
partido HvIA con MVP ya elegido (Mikel Oyarzabal, visible en el acta a
91') y estadísticas ya confirmadas — "va todo bien hasta la última
foto". Tras elegir el MVP, la pantalla OBLIGATORIA de "📲 COMPARTIR
PARTIDO" (WhatsApp) nunca llegó a aparecer y el botón FINALIZAR se
quedó bloqueado (deshabilitado) para siempre, sin ningún aviso.

### Causa raíz

`gmPickPlayer` (el handler que registra al MVP elegido) re-disparaba
`gmEndMatch()` así:
```js
try { setTimeout(function(){ window.gmEndMatch && window.gmEndMatch(); }, 80); } catch(_){}
```
El `try/catch` envuelve la llamada a `setTimeout(...)`, que NUNCA lanza
— el código que de verdad puede reventar (`gmEndMatch()` → el siguiente
gate, `_gmFinalShareGate`) corre DENTRO del callback, en un macrotask
POSTERIOR, fuera de ese `try/catch`. Cualquier excepción real ahí queda
TOTALMENTE sin capturar: no hay `alert`, no hay log, el overlay de
WhatsApp nunca se pinta y el botón FINALIZAR — deshabilitado por
`_mlConfirmEnd` al confirmar "SÍ" — jamás se reactiva. Mismo patrón que
el bug de portería imbatida (2026-07-05/06): un `try/catch` que solo
protege la PROGRAMACIÓN del callback, no su EJECUCIÓN real, es
indistinguible de no tener ningún try/catch en absoluto.

### Fix

Nuevo helper `window._gmSafeReenter(fn, label)` (junto a
`_gmReenableEndBtn`, `part2/misc_body_2.html`): ejecuta `fn()` en su
propio try/catch — si revienta, loguea, **reactiva FINALIZAR**
(`_gmReenableEndBtn`) y muestra un `alert` con el punto exacto donde
falló, para que el usuario pueda reintentar en vez de quedarse
mirando la pantalla congelada sin ninguna pista. Se usa en TODAS las
reentradas diferidas a `gmEndMatch()`: tras elegir MVP (`gmPickPlayer`),
tras confirmar estadísticas (`_mlShowStatsOverlay`), tras compartir por
WhatsApp (`_gmFinalShareGate`) y tras la tanda de penaltis. Además,
`_gmFinalShareGate` (la propia pantalla de compartir) se blinda con el
MISMO patrón que `_gmShowFinalOv` (regla 2026-07-05, más abajo): el
cálculo de cabecera y el pintado del overlay van en try/catch con
fallback mínimo, y `ov.style.display='flex'` es INCONDICIONAL — un
dato inesperado ya no puede impedir que el gate se muestre.

### Reglas a respetar

1. **PROHIBIDO** que un `try/catch` alrededor de un `setTimeout(...)`
   (o cualquier otro programador de macrotask/microtask) se considere
   protección del código que corre DENTRO del callback. El try/catch
   debe envolver la EJECUCIÓN real, no la llamada de programación.
2. **PROHIBIDO** añadir una reentrada nueva a `gmEndMatch()` (o a
   `mlEndMatchGen`, su equivalente en ml-card) sin pasar por
   `_gmSafeReenter`/un patrón equivalente que reactive el botón y avise
   visiblemente si falla. Toda la cadena imbatida→Estadísticas→MVP→
   WhatsApp→fin hereda esto — un gate nuevo que se añada a la cadena
   debe re-disparar el siguiente paso a través del helper.
3. **PROHIBIDO** que `_gmFinalShareGate` (o cualquier gate obligatorio
   nuevo con overlay propio) calcule su contenido o pinte su HTML sin
   try/catch, o que el `display='flex'`/`.show` dependa de que ese
   pintado saliera perfecto. Mismo contrato que `_gmShowFinalOv`.

## La continuación tras elegir portero NUNCA depende solo de `requestAnimationFrame` (obligatorio, 2026-07-06)

**Bug (foto usuario 2026-07-06, «Atlético Madrid vs Villarreal», Liga ·
Jornada 3, "no funciona el finalizar ningún partido humano vs ia o
humano vs humano")**: con el bundle YA en 9.24 (confirmado por el log
en pantalla: aparecían las líneas nuevas `imbat IA auto-registrado…` e
`imbat: portero humano elegido lado a (Jan Oblak)`, que solo existen
desde la reescritura sin promesas), el partido se congelaba en el
MISMO punto de siempre — tras elegir portero, nunca aparecía
`imbat: todos los lados resueltos → onDone()` ni ninguna pantalla
posterior (Estadísticas/MVP/WhatsApp), y FINALIZAR seguía
deshabilitado. Esta vez NO era caché vieja (el log lo demuestra).

### Causa raíz

`_finish()` (dentro de `_ensureImbatEvents`, `static/js/index.bundle.js`)
diferá la llamada a `onDone()` ÚNICAMENTE con
`requestAnimationFrame(function(){ setTimeout(_run, 0); })` (añadido
2026-07-05 para forzar un repintado del cierre del picker antes del
trabajo pesado). Los navegadores móviles PUEDEN pausar por completo los
callbacks de `requestAnimationFrame` si la pestaña pierde visibilidad
aunque sea un instante (paso a 2º plano, bloqueo de pantalla, cambio de
app) justo después del tap que cierra el picker — el callback
simplemente NUNCA se ejecuta, sin excepción, sin log, indistinguible
del "se congela" reportado. Verificado en aislado (harness Node con
`requestAnimationFrame` que nunca invoca su callback, simulando el
throttling real): sin red de seguridad, `onDone()` no se llamaba jamás.

### Fix

`_finish()` añade una red de seguridad independiente:
`setTimeout(_run, 300)` que se dispara SIEMPRE, haya disparado el rAF o
no, con una guarda `_ran` para que `onDone()` no se llame dos veces si
ambos mecanismos llegan a ejecutarse. `setTimeout` sigue disparándose
(aunque con throttling) cuando la pestaña estuvo en 2º plano, a
diferencia de `requestAnimationFrame`, que puede quedar completamente
suspendido. Bump `index.bundle.js` 9.24 → 9.25.

### Reglas a respetar

1. **PROHIBIDO** que la continuación de un flujo obligatorio
   (imbatida→Estadísticas→MVP→WhatsApp, o cualquier cadena similar)
   dependa ÚNICAMENTE de `requestAnimationFrame` para programar el
   siguiente paso. Todo diferido con rAF que exista para forzar un
   repintado debe llevar TAMBIÉN un `setTimeout` de red de seguridad
   (con guarda anti-doble-ejecución) que garantice progreso aunque el
   rAF quede suspendido por pérdida de visibilidad de la pestaña.
2. Antes de asumir "esto ya no puede ser caché vieja" basta con mirar
   si el panel de diagnóstico (`_gmDiagLog`) muestra las líneas nuevas
   del último fix — si aparecen (como en este caso), el bloqueo es un
   bug DISTINTO y hay que seguir investigando la cadena, no repetir el
   diagnóstico de "recarga la página".

## Aviso de versión nueva — una pestaña vieja YA NO se queda bloqueada en silencio para siempre (obligatorio, 2026-07-06)

**Bug (2 fotos usuario 2026-07-06, «Maccabi Tel Aviv vs Liverpool»,
Trofeo Joan Gamper — «vez número 20» del mismo bloqueo de la portería
imbatida)**: el usuario reportó, con el panel de diagnóstico en
pantalla visible, que tras elegir a Alisson en el picker de portería
imbatida el partido se congelaba exactamente en el mismo punto que ya
se había arreglado varias veces (commits `9cff430`/`1635b6a`, bundle
9.22→9.24, que reescribió `_ensureImbatEvents` sin cadena de promesas).

### Causa raíz — el fix YA estaba en `main`, pero la pestaña del usuario nunca lo descargó

El propio log de diagnóstico (`_gmDiagLog`, panel visible en pantalla)
lo demuestra: tras `_ensureImbatEvents() llamado. hasA=false
hasB=false` no aparece NINGUNA de las líneas nuevas que la reescritura
9.24 añade (`imbat IA auto-registrado…`, `imbat: pidiendo portero
humano…`, `imbat: portero humano elegido…`, `imbat: todos los lados
resueltos → onDone()`) — esas cadenas literales no existían en el
bundle antes de 9.24 (verificado con `git log -S`). Es decir, el
navegador del usuario seguía ejecutando una copia de
`index.bundle.js` de ANTES de la reescritura, aunque el servidor ya
serviría 9.24 a una carga nueva. Como `misc_body_2.html` (donde vive
`gmEndMatch`/el watchdog de 9 s) es un partial INLINE que SIEMPRE se
sirve fresco, pero `index.bundle.js` (donde vive
`_ensureImbatEvents`) SÍ se cachea por `?v=`, el código fresco de
`gmEndMatch` llamaba a la función VIEJA (con la cadena de promesas
frágil) — el bug ya arreglado en el repo se seguía reproduciendo en
cualquier pestaña que llevara abierta desde antes del deploy del fix.
Exactamente el patrón ya documentado en la regla "Todo cambio en
`index.bundle.js`/`.css`… DEBE bumpear su `?v=X.X`" — pero esa regla
solo cubre EVITAR que el fix no llegue nunca; no había ningún
mecanismo para AVISAR al usuario cuando su pestaña ya tenía una
versión vieja cargada en memoria (el bump correcto en el servidor no
sirve de nada si nadie le dice a la pestaña abierta que recargue).

### Fix — banner de actualización + watchdog más honesto

1. **`templates/index.html`** (registro del Service Worker): tras
   `register('/sw.js')`, se escucha `updatefound` +
   `statechange==='installed'` con `navigator.serviceWorker.controller`
   ya existente (= hay una versión más nueva que la que controla esta
   pestaña) y se muestra un banner fijo abajo
   ("🔄 Hay una versión más nueva… RECARGAR") con un botón que hace
   `location.reload()`. **NUNCA recarga solo/automático** — un partido
   en curso vive en memoria (`_gm`) y una recarga forzada sin avisar
   lo perdería; el usuario decide cuándo es buen momento. Se
   comprueba también `reg.waiting` al registrar (ya había una versión
   esperando) y se hace `reg.update()` cada 2 min + en cada
   `visibilitychange` a visible (una pestaña puede llevar horas
   abiertas sin recargar).
2. **`misc_body_2.html`** (watchdog de 9 s de `_mlConfirmEnd`, ya
   existente desde 2026-07-05): si el watchdog salta una 2ª vez en el
   MISMO partido (`window._gmWatchdogRetries >= 2`), el aviso deja de
   sugerir solo "pulsa FINALIZAR de nuevo" (que no sirve de nada si la
   causa es JS viejo cacheado) y apunta explícitamente al banner de
   arriba / a recargar manualmente — siendo HONESTO en que el
   marcador/acta de ESE partido concreto aún no están guardados en
   ese punto de la cadena (a diferencia del caso `_gm.finished===true`
   del mismo watchdog, que si puede prometer que el resultado ya está
   guardado).

### Reglas a respetar

1. **PROHIBIDO** asumir que un fix de `index.bundle.js` ya
   desplegado y bumpeado en `main` "no puede seguir reproduciéndose".
   Una pestaña abierta ANTES del deploy sigue ejecutando el JS viejo
   indefinidamente hasta que el usuario recarga — el bump de versión
   solo garantiza que la PRÓXIMA carga completa reciba el fix, nunca
   que una pestaña ya abierta lo reciba sola.
2. **PROHIBIDO** quitar el banner de actualización de
   `templates/index.html` o hacerlo recargar la página
   automáticamente sin acción del usuario — el estado de un partido en
   curso vive en memoria (`_gm`/`st` de las ml-cards) y no se persiste
   hasta que el partido finaliza del todo; un `location.reload()` sin
   avisar lo perdería.
3. **PROHIBIDO** que un mensaje de watchdog/aviso afirme "el
   resultado ya está guardado" en un punto de la cadena
   (imbatida/stats/MVP/WhatsApp) ANTERIOR a que `_gm.finished`/
   `st.finished` se ponga a `true`. Solo se puede prometer eso DESPUÉS
   de ese punto (como ya hace el watchdog para el caso
   `_gm.finished===true` sin pantalla final visible).
4. Antes de investigar una regresión de código en un bug que la
   sesión anterior "ya arregló", comprobar primero (regla 14 de la
   sección de portería imbatida, más abajo) si el log de diagnóstico
   en pantalla muestra las líneas de log que el fix más reciente
   introdujo — si faltan, es carga vieja, no una regresión nueva.

## El alias eFootball VIAJA DENTRO de la cfg del torneo — el ❓ ya no depende de que el dispositivo tenga la liga origen (obligatorio, 2026-07-06)

**Bug (2 fotos usuario 2026-07-06, «Maccabi Tel Aviv vs Liverpool» y
«FK Bodø Glimt vs Arsenal», Trofeo Joan Gamper — «vez número 15», «de
repente la ❓ ya no emerge»)**: en la PANTALLA DE PREVIA de un torneo de
verano, bajo el equipo IA ficticio (Maccabi Tel Aviv, que SÍ tiene alias
configurado) NO aparecía el botón ❓ que indica con qué equipo real de
eFootball hay que jugar.

### Causa raíz — el alias es IDENTIDAD pero NO viajaba con el torneo

`efootballAlias` es un dato de identidad por equipo (igual que escudo/
estadio/plantilla, regla 2026-07-04) que vive en `ligaExt_<slug>`. PERO
los equipos de un torneo (`cfg.teams[]`) se añaden copiando SOLO
`name/shield/power` (el roster editor, `sr-ok` y equivalentes) — **NUNCA
copiaban `efootballAlias`**. Así, la resolución del alias en la previa
(`getTeamEfootballAlias` → `_buildAliasCache`) dependía de que ESE
dispositivo tuviera cacheada la liga origen del equipo ficticio en
`ligaExt_*`/`LIGA_CACHE`. Un dispositivo que nunca abrió esa liga (el
móvil del amigo, o el propio tras un borrado de datos / eviction) no
podía resolverlo y el ❓ quedaba dependiendo por completo de una búsqueda
ASÍNCRONA en servidor (`/api/team-alias/<nombre>`) — frágil en red móvil
/ cold-start / deploy reciente, y EFÍMERA (el backfill de `_ALIAS_CACHE`
se reconstruye al expirar el TTL de 3 s y se pierde porque la liga no
está local). Resultado: el ❓ "de repente ya no emerge".

### Fix — bake del alias DENTRO de `cfg.teams[]` (identity-propagation)

`window._tourBackfillEfootballAlias(cfg)` (`misc_body_1.html`, junto a
`_tourLoadCachedSync`): al cargar un torneo, RESUELVE desde el cache
LOCAL (`getTeamEfootballAlias`, que escanea ligaExt_/LIGA_CACHE/
selecciones/TOUR_CACHE) el alias de cada equipo del torneo que aún no lo
lleve y lo GRABA en el propio `cfg.teams[].efootballAlias`. Al cambiar
algo, `_tourSave` lo sincroniza → todos los dispositivos reciben el alias
DENTRO de la cfg del torneo. Como `_buildAliasCache` YA escanea
`window._TOUR_CACHE`, a partir de ahí `getTeamEfootballAlias` lo resuelve
de forma SÍNCRONA en la previa (❓ instantáneo, sin round-trip). Se llama
en las 3 rutas de carga (`_tourLoadCachedSync` cache-hit + lectura de
localStorage, y `_tourLoad` tras adoptar el server). Throttle de 4 s por
cfg (no flag permanente) para permitir re-intentar tras cargar la liga
origen. NUNCA pisa un alias ya presente.

`window._efAliasBakeIntoTours(teamName, alias)`: cuando `_efAliasServerSearch`
resuelve un alias POR SERVIDOR (dispositivo sin la liga local), lo graba
en las cfgs de torneo cacheadas que tengan ese equipo → permanente +
propagado. Así el PRIMER acierto de servidor en CUALQUIER dispositivo
cura el ❓ para toda la flota, sin depender de repetir la búsqueda.

### Reglas a respetar

1. **PROHIBIDO** que un equipo de torneo (`cfg.teams[]`) dependa SOLO de
   que el dispositivo tenga la `ligaExt_<slug>` origen cacheada para
   resolver su alias eFootball. El alias es IDENTIDAD y debe VIAJAR
   dentro de la cfg del torneo vía `_tourBackfillEfootballAlias` (bake
   local) + `_efAliasBakeIntoTours` (bake del acierto de servidor).
2. **PROHIBIDO** que el bake pise un alias ya presente en `cfg.teams[]`
   (mismo contrato que `_lextBackfillAlias`/`_lextBackfillShields`): solo
   rellena huecos.
3. **PROHIBIDO** que el bake sea síncrono-bloqueante o entre en bucle de
   guardado: solo `_tourSave` (diferido) cuando algo CAMBIÓ; tras bakear,
   el siguiente escaneo no cambia nada (throttle + guard de "ya lo lleva").
4. Todo campo de identidad por equipo que en el futuro deba verse en la
   previa de un torneo (no solo el alias) hereda este patrón: bakearlo en
   `cfg.teams[]` al cargar el torneo, no resolverlo solo desde la liga
   origen local.

## La pantalla FINAL (`_gmShowFinalOv`) NUNCA se queda sin mostrar tras `_gm.finished=true` (obligatorio, 2026-07-05)

**Bug (foto usuario 2026-07-05, mismo partido «Maccabi Tel Aviv vs
Liverpool», Trofeo Joan Gamper)**: tras los 2 fixes anteriores (auto-pick
del portero IA + `_gmHumanInvolved` con registro canónico), el partido
avanzó más — la portería imbatida de AMBOS lados y el MVP («Jugador A»,
placeholder porque el roster de Maccabi no resuelve nombres reales)
quedaron registrados en el acta — pero el partido volvió a quedarse
igual: FINALIZAR deshabilitado, sin pantalla de resumen ni de WhatsApp.

### Causa raíz

`gmEndMatch()` marca `_gm.finished = true` y hace
`setTimeout(function(){ _gmShowFinalOv(); }, 80)` para abrir la pantalla
FINAL (marcador + acta completa + MVP + botón compartir). `_gmShowFinalOv`
rellenaba TODO su contenido (cabecera, escudos, MVP, acta completa vía
`_gmEvtRow`) en línea recta, SIN try/catch, y solo al FINAL hacía
`ov.style.display = 'flex'`. Si CUALQUIER paso de ese relleno lanzaba una
excepción (un dato inesperado en un evento del acta, un helper de
escudo/humanIcon fallando, etc.), la función abortaba ANTES de llegar a
esa línea — el overlay JAMÁS se hacía visible. Como `_gm.finished` ya es
`true` en ese punto, `gmEndMatch()` no vuelve a hacer nada
(`if (_gm.finished) return;`) y el watchdog de `_mlConfirmEnd` (sección
de arriba) explícitamente SALTA la reactivación cuando el partido está
`finished` — así que el usuario se quedaba mirando el gm-modal congelado
sin NINGUNA pantalla ni forma de recuperar el partido, aunque el
resultado ya estuviera guardado internamente.

### Fix

1. `_gmShowFinalOv` envuelve cada bloque de relleno (cabecera/escudos,
   MVP, acta, botones) en su propio try/catch — un fallo parcial se
   loguea pero NUNCA impide llegar a `ov.style.display = 'flex'`, que
   ahora es INCONDICIONAL al final de la función.
2. El `setTimeout` que llama a `_gmShowFinalOv()` desde `gmEndMatch`
   también va envuelto: si pese al blindaje interno algo revienta,
   se avisa con `alert()` (el resultado ya está guardado) y se llama a
   `gmVolver()` para no dejar al usuario atrapado en el modal.
3. El watchdog de `_mlConfirmEnd` (9 s) ya NO ignora los partidos
   `finished`: si el partido está `finished` pero NINGÚN overlay
   terminal (`gm-fin-ov` incluido en la lista vigilada, junto con
   `gm-mvp-share-gate` que faltaba en la lista) está visible, avisa que
   el resultado ya se guardó y ofrece `gmVolver()` en vez de dejar la
   pantalla congelada silenciosamente para siempre.

### Reglas a respetar

1. **PROHIBIDO** que `_gmShowFinalOv` (o cualquier pantalla terminal
   obligatoria equivalente: descanso, prórroga, penaltis…) rellene su
   contenido SIN try/catch antes de hacerse visible. El `display=flex`
   (o `.show`) que revela el overlay debe ser INCONDICIONAL — un dato
   inesperado en un solo evento del acta no puede impedir que el
   usuario vea NINGUNA pantalla tras finalizar.
2. **PROHIBIDO** que un watchdog anti-bloqueo (el de `_mlConfirmEnd`, o
   cualquier futuro) descarte por completo los partidos `finished`. Un
   partido puede quedar `finished=true` internamente y aun así no haber
   mostrado NINGUNA pantalla al usuario si el paso que la muestra
   falló — el watchdog debe cubrir también ese caso (ofreciendo salir,
   ya que el resultado está guardado, en vez de reactivar un botón que
   ya no sirve de nada).
3. Toda lista de "overlays terminales conocidos" que use un watchdog o
   un observer de UI (spinner, watchdog de finalizar, etc.) debe incluir
   TODOS los overlays reales del flujo — `gm-mvp-share-gate` faltaba en
   la lista del watchdog anterior. Al añadir un overlay obligatorio
   nuevo a la cadena, añadirlo también a estas listas.

## `_gmHumanInvolved` reconoce al humano por el registro canónico + watchdog anti-bloqueo-silencioso tras FINALIZAR (obligatorio, 2026-07-05)

**Bug (foto usuario 2026-07-05, mismo partido «Maccabi Tel Aviv (IA) vs
Liverpool (humano)», Trofeo Joan Gamper)**: tras el fix del auto-pick de
portero de arriba, el acta ya registraba las 2 porterías imbatidas
(Maccabi automático + Alisson elegido), pero el partido "sigue igual,
no deja finalizar" — el botón FINALIZAR seguía deshabilitado sin que
apareciera la pantalla obligatoria de Estadísticas, ni MVP, ni WhatsApp.

### Causa raíz

`_gmHumanInvolved()` (`part2/misc_body_2.html`) — la función que decide
si `gmEndMatch()` debe abrir la pantalla OBLIGATORIA de Estadísticas
antes del MVP — solo reconocía al humano por 3 vías: (1) `cfg.teams[].
isHuman` del torneo con match EXACTO de nombre, (2) `isHumanInComp`, (3)
`esHumano()` (los 5 humanos legacy de Liga EA Sports por su nombre
crudo). Ninguna de las 3 usa el registro canónico `MISTERS_HUMANOS`
(`_isHumanClubCanonico`/`_esSelHumana`, alias-safe Bayern↔Liverpool)
que SÍ usa `_ensureImbatEvents` (por eso el picker de Alisson SÍ se
mostró: esa función usa el fallback correcto). Con el slot de Liga EA
Sports renombrado Bayern→Liverpool y un torneo de 63 equipos
(`format:'league'`) donde el nombre guardado en `cfg.teams[]` o el
`humanIcon` puede no coincidir exactamente, `_gmHumanInvolved()` podía
devolver `false` mientras `_ensureImbatEvents` (con el fallback
correcto) sí reconocía a Liverpool como humano — inconsistencia entre
dos detectores de "¿es humano?" para el MISMO partido, saltándose en
silencio el gate de Estadísticas.

### Fix

1. `_gmHumanInvolved()` añade la MISMA capa 0 de refuerzo que ya usa
   `_ensureImbatEvents` (`esH`): fallback a `window._isHumanClubCanonico`
   y `window._esSelHumana` tras agotar las 3 vías anteriores. Ahora
   AMBOS detectores usan la fuente canónica como última red, así que no
   pueden discrepar sobre el mismo partido.
2. **Watchdog anti-bloqueo-silencioso** en `_mlConfirmEnd` (el handler
   de "SÍ" de la confirmación de FINALIZAR): 9 s después de confirmar,
   si `#gm-btn-end` sigue deshabilitado, el partido no está `finished`,
   y NINGÚN overlay obligatorio conocido (imbatida, stats, MVP, team/
   player pick, post-partido, loading…) está visible, se asume que la
   cadena se atascó por CUALQUIER motivo no previsto y se reactiva el
   botón con un aviso, para que el usuario pueda reintentar en vez de
   quedarse mirando el marcador sin ninguna pista ni forma de avanzar.
   `gmEndMatch`/`mlEndMatchGen` son idempotentes (retoman desde el
   primer gate pendiente), así que reintentar es seguro.

### Reglas a respetar

1. **PROHIBIDO** que un detector nuevo de "¿hay un humano en este
   partido?" (para gatear Estadísticas, MVP, cronómetro, sanciones,
   etc.) omita el fallback al registro canónico
   (`_isHumanClubCanonico`/`_esSelHumana`) cuando OTRO detector del
   MISMO flujo (p.ej. `_ensureImbatEvents`) ya lo usa. Dos detectores
   de humanidad para el mismo partido que puedan discrepar reintroducen
   gates obligatorios que se saltan en silencio para unos partidos sí y
   para otros no.
2. **PROHIBIDO** que la confirmación de FINALIZAR (`_mlConfirmEnd`)
   deshabilite el botón sin un watchdog de resolución acotada. La
   cadena de gates automáticos (imbatida→stats→MVP→WhatsApp) se
   re-dispara sola sin interacción del usuario en la ventana normal,
   pero CUALQUIER gate que falle en silencio (ahora o en el futuro) deja
   al usuario sin ninguna salida si no hay un timeout que reactive el
   botón. Todo gate NUEVO que se añada a esta cadena hereda esta red de
   seguridad automáticamente (el watchdog es genérico, no por-gate).

## La inyección diferida del ❓ REINTENTA — un fallo de red no debe dejar el botón sin aparecer para siempre (obligatorio, 2026-07-05)

**Bug (foto usuario 2026-07-05, «Maccabi Tel Aviv vs Liverpool», misma
previa que ya se había confirmado con alias guardado en servidor)**:
tras el fix "el ❓ solo sale si el equipo tiene alias" (sección
siguiente), el usuario reportó "otra vez no sale la ❓" para un partido
donde el alias SÍ existía (confirmado vía `/api/debug` — la liga de
Israel estaba guardada en el servidor con `updated_at` de ese mismo
día).

### Causa raíz

`_ppAliasDeferredCheck` (`static/js/index.bundle.js`) hacía **UNA sola**
llamada a `window._efAliasServerSearch` para el lado candidato sin alias
local. Esa función no distingue, de cara al caller, entre "el servidor
respondió: no hay alias" y "la petición falló" (red móvil, timeout de
6 s, o el servidor recién desplegado tras el merge de este mismo fix
aún arrancando) — en ambos casos `onDone(null)`. Sin reintento, un
único fallo transitorio (muy probable justo después de un deploy,
cuando Railway está reiniciando el proceso) dejaba el botón **sin
inyectar para siempre**, indistinguible de "el equipo es real y no
necesita alias" — exactamente el síntoma reportado.

Verificado en aislado (simulación Node con DOM falso): la lógica de
inyección en sí es correcta cuando el servidor responde — el bug es la
falta de reintento ante un fallo transitorio de la ÚNICA petición.

### Fix

`_ppAliasDeferredCheck` reintenta hasta 3 veces con backoff (0 ms,
1.5 s, 3.5 s) antes de rendirse. Cada intento sigue siendo una única
petición ligera (`_efAliasServerSearch`); el tope de intentos evita un
bucle infinito. Solo se dispara para el lado candidato sin alias local
(nunca para equipos ya resueltos ni para HvH/IAvIA).

### Reglas a respetar

1. **PROHIBIDO** que una comprobación diferida en servidor (la de este
   botón, o cualquier otra que dependa de una única petición para
   decidir "mostrar algo o no") se rinda tras el PRIMER fallo sin
   reintentar. Un fallo de red o un cold-start del servidor (típico
   justo tras un deploy) es indistinguible, desde el cliente, de "el
   dato no existe" — sin reintento, ambos casos producen el mismo
   síntoma silencioso.
2. **PROHIBIDO** subir el tope de reintentos sin límite (bucle
   infinito): 3 intentos con backoff corto es suficiente para cubrir un
   cold-start o un blip de red sin machacar al servidor.

## El auto-pick de portero IA en la portería imbatida SIEMPRE registra un evento — nunca deja `needsImbat` en true para siempre (obligatorio, 2026-07-05)

**Bug (fotos usuario 2026-07-05, «Maccabi Tel Aviv (IA) vs Liverpool
(humano)», 0-0, Trofeo Joan Gamper)**: tras elegir Alisson en el picker
de portería imbatida, el acta registraba SOLO ese evento («90' Portería
Imbatida — Alisson · Liverpool») y el partido se quedaba congelado ahí
para siempre — sin el evento automático de portero del Maccabi (equipo
IA), sin la pantalla obligatoria de Estadísticas, sin MVP, sin
WhatsApp y sin FINALIZAR. El botón FINALIZAR permanecía deshabilitado
sin ningún error visible.

### Causa raíz

En `_ensureImbatEvents` (`static/js/index.bundle.js`), la rama IA
(auto-pick, sin overlay) de `_step(side)` hacía:
```js
var gk = window._getTopGk(teamName);
if (gk.name) { opts.pushEv({...}); }   // ← si gk.name viene vacío, NO se llama pushEv
return Promise.resolve();
```
Si `_getTopGk` no lograba resolver un portero del equipo IA (roster
aún no indexado en `SQUAD_REGISTRY`/`ligaExt_*` en ese instante —
Maccabi Tel Aviv es un equipo con alias/roster de "Resto de Ligas"),
`pushEv` NUNCA se llamaba para ese lado. Como `gmEndMatch()` recalcula
`needsImbat` en CADA invocación comprobando si existe un evento
`imbat` para ese lado, la ausencia PERPETUA de ese evento hacía que
`needsImbat` siguiera `true` para siempre. La cadena
`gmEndMatch → _ensureImbatEvents → onDone (gmEndMatch) → needsImbat
sigue true → ...` se repetía en un bucle SILENCIOSO e invisible (todo
"resuelve" con éxito, no hay excepción que capturar ni alertar) — el
usuario veía el acta congelada con un solo evento y el botón FINALIZAR
deshabilitado sin explicación, indistinguible de "se atasca".

### Fix

La rama auto-IA de `_step` ahora GARANTIZA que `pushEv` se llama
siempre: si `_getTopGk` no resuelve un portero real, cae a un
fallback genérico `{num:'1', name:'Portero'}` (mismo patrón que ya
usaba `showImbatForce` cuando el picker humano no encuentra porteros).
Así el evento `imbat` de ese lado SIEMPRE queda registrado y
`needsImbat` puede volver a `false`, permitiendo que la cadena
continúe a Estadísticas → MVP → WhatsApp → FINALIZAR tal como está
diseñada en `gmEndMatch`.

### Reglas a respetar

1. **PROHIBIDO** que la rama auto-IA de `_ensureImbatEvents._step`
   condicione la llamada a `pushEv` a que `_getTopGk` haya resuelto un
   nombre real. `pushEv` debe llamarse SIEMPRE (con fallback genérico
   si no hay portero resuelto) — de lo contrario `needsImbat` puede
   quedar perpetuamente `true` y `gmEndMatch` entra en un bucle
   silencioso indistinguible de un partido bloqueado.
2. **PROHIBIDO** que un gate obligatorio de `gmEndMatch` (imbatida,
   stats, MVP, WhatsApp) dependa de una condición que pueda no
   cumplirse NUNCA (como "encontrar un portero real") sin un fallback
   que garantice progreso. Todo gate nuevo de este tipo hereda el
   patrón: fallback genérico que desbloquea la cadena en vez de dejarla
   pendiente para siempre.
3. Bump `index.bundle.js` 9.19 → 9.20 en `templates/index.html` y el
   `PRECACHE` de `static/js/sw.js` (regla obligatoria de versión de
   assets estáticos).

## El ❓ de alias eFootball SOLO sale si el equipo TIENE alias — «ficticio» = «tiene alias», nunca al revés (obligatorio, 2026-07-05)

**Bug (fotos + grabación usuario 2026-07-05, «Torino»/«Timor Oriental»/
«Maccabi Tel Aviv»)**: el diseño de 2026-07-04 («TIENE QUE SALIR SI O SI
LA ❓») hacía que el botón ❓ apareciera SIEMPRE bajo cualquier equipo IA
que se enfrentara a un humano, tuviera o no alias configurado. Resultado:
**Torino** (equipo real con licencia en eFootball) y **Timor Oriental**
(selección real) mostraban el ❓ como si fueran equipos ficticios sin
licencia — al pulsarlo, el aviso "sin alias configurado" confundía al
usuario haciéndole creer que algo estaba mal configurado cuando en
realidad esos equipos simplemente no necesitan alias. El usuario corrigió
la regla explícitamente: **"Los equipos ficticios son unicamente los que
en su liga tienen un ALIAS"**.

Por separado, **Maccabi Tel Aviv** (SÍ tiene alias configurado —
"Sudamérica - 1🇦🇷 - Rosario AA - 1ª👕 - ⭐⭐⭐⭐", visible en el editor de
Resto de Ligas) seguía mostrando "no tiene alias" al pulsar el ❓, pese a
la búsqueda en servidor de la sección anterior.

### Fix 1 — visibilidad del ❓ gobernada por la existencia real del alias

`static/js/index.bundle.js` (bloque de la previa, ~línea 6930): antes,
`_ppHomeAliasShow`/`_ppAwayAliasShow` dependían SOLO de quién es humano
(`_humAwayAlias && !_humHomeAlias`). Ahora esa condición (`_humCandidateHome`/
`_humCandidateAway`) es NECESARIA pero YA NO SUFICIENTE: el botón solo se
pinta si además `_aliasFor(team)` (resolución LOCAL, síncrona) devuelve
texto no vacío. Un equipo real (sin alias en ningún lado) nunca muestra
nada — ni botón, ni aviso.

**Comprobación DIFERIDA para el caso "alias existe pero no está cacheado
en ESTE dispositivo"** (el bug real de Maccabi): cuando el lado candidato
no tiene alias resuelto localmente, se pinta un placeholder VACÍO con id
(`pp-alias-home`/`pp-alias-away`) y, tras insertar la previa en el DOM, se
llama a `_ppAliasDeferredCheck(side, team, isCandidate, txt)` — si `txt`
viene vacío, pregunta a `window._efAliasServerSearch` (servidor, una sola
petición) y, si encuentra alias, INYECTA el botón ❓ en el placeholder. Si
el servidor tampoco lo tiene, no se inyecta nada — el equipo es real de
verdad.

### Fix 2 — `_copaShowAlias` deja de fiarse de "conocido localmente sin alias" como respuesta definitiva

`static/js/copa-engine.js`: se eliminó el atajo que devolvía "sin alias
configurado" en cuanto `window._efAliasKnownLocally(team)` era true, SIN
preguntar nunca al servidor. Ese atajo asumía que si el equipo estaba
indexado localmente (en `ligaExt_<slug>`, `LIGA_CACHE` o
`selecciones_squad_v1`) con alias vacío, la respuesta era definitiva —
pero la copia LOCAL de ese dispositivo puede ser ANTERIOR a la edición
del admin (guardada en otro dispositivo, o en una sesión previa de este
mismo dispositivo antes de refrescar `ligaExt_<slug>`). Un escaneo local
que no encuentra el alias **no prueba que no exista**, solo prueba que
este dispositivo no lo tiene todavía. Ahora `_copaShowAlias` **SIEMPRE**
pregunta al servidor (`/api/team-alias/<nombre>`, una sola petición
rápida con timeout de 6 s) cuando el botón no trae ya el alias resuelto —
sin excepción, ya no hay atajo local.

### Reglas a respetar

1. **PROHIBIDO** que el ❓ (o cualquier indicador de "equipo ficticio")
   se muestre basándose SOLO en "el rival es humano". La condición
   necesaria es esa, pero la SUFICIENTE es que el alias exista de verdad
   (local o, si no está cacheado, confirmado por el servidor). Un equipo
   real (Torino, Timor Oriental, o cualquier otro con licencia) JAMÁS
   debe mostrar el botón ni ningún aviso.
2. **PROHIBIDO** que la ausencia de alias en el escaneo LOCAL se trate
   como respuesta definitiva de "no tiene". Solo el servidor (fuente de
   verdad, recibe los guardados de TODOS los dispositivos) puede
   confirmar "no tiene alias" — el cliente pregunta siempre que su copia
   local venga vacía, sin atajos por "ya lo conozco sin alias".
3. Toda pantalla NUEVA que muestre el ❓/alias hereda el patrón: mostrar
   solo si hay alias YA resuelto (local o servidor), placeholder vacío +
   comprobación diferida si no está cacheado localmente, nunca mostrar
   basándose solo en la condición de humanidad del rival.

## FINALIZAR no se queda en bucle — el botón se deshabilita mientras la cadena de gates automáticos corre sola (obligatorio, 2026-07-05)

**Bug (grabación usuario 2026-07-05, «Maccabi Tel Aviv vs Liverpool»)**:
tras elegir el portero de la portería imbatida (Alisson), el partido "no
continúa al finalizar" — debería encadenar Estadísticas + MVP obligatorio
pero en vez de eso "se queda en bucle y jamás se cierra ese partido".

### Causa raíz

`gmEndMatch()` encadena varios gates OBLIGATORIOS que se re-disparan SOLOS
sin que el usuario tenga que volver a pulsar nada: portería imbatida →
estadísticas → MVP → compartir por WhatsApp → fin real. Cada gate hace
`return` tras mostrar su overlay, y el propio overlay (al confirmarse)
vuelve a llamar a `gmEndMatch()` internamente. El botón `#gm-btn-end`
(FINALIZAR) **seguía activo** durante toda esta cadena — solo se
deshabilitaba al terminar de verdad (`_gm.finished = true`). Entre el
cierre de un overlay (p.ej. el picker de portero, cerrado por
`confirmImbatForce`) y la apertura del siguiente (estadísticas), el
`onDone()` que continúa la cadena está DIFERIDO a
`requestAnimationFrame + setTimeout(0)` (fix 2026-07-05 anterior, para
forzar un repintado) — durante esa breve ventana el gm-modal queda
visible SIN ningún overlay tapando el botón. Un usuario que no ve
progreso inmediato podía volver a pulsar FINALIZAR, disparando una
**segunda invocación de `gmEndMatch()` en PARALELO** con la primera
cadena aún en curso — dos cadenas compitiendo por los mismos overlays es
indistinguible, desde fuera, de "se queda en bucle y jamás se cierra".

### Fix

- `window._mlConfirmEnd` (`part2/misc_body_2.html`) deshabilita
  `#gm-btn-end` (`disabled=true` + opacidad reducida) INMEDIATAMENTE
  al confirmar "SÍ", antes de llamar a `yesCb()` (`gmEndMatch`). Ninguna
  segunda pulsación puede volver a disparar la cadena mientras la
  primera sigue en curso.
- Nuevo helper `_gmReenableEndBtn()` (expuesto como
  `window._gmReenableEndBtn`) — lo llaman los ÚNICOS 3 puntos donde
  `gmEndMatch()` hace `return` esperando que el usuario haga algo FUERA
  de la cadena automática antes de poder reintentar (forzar prórroga,
  bloqueo defensivo antes del min 110 de la prórroga, puerta pre-penaltis):
  ahí SÍ hace falta reactivar el botón, porque el siguiente paso depende
  de una acción del usuario (reanudar el cronómetro), no de un gate que
  se resuelve solo.
- La cancelación del picker de portero (`imbat_cancelled` en el `.catch`
  de `_ensureImbatEvents`, `static/js/index.bundle.js`) y cualquier error
  de la cadena (`onDone` fallando, o el `.catch` genérico) también llaman
  a `window._gmReenableEndBtn()` — si el usuario cancela o algo revienta,
  el botón vuelve a estar disponible para reintentar en vez de quedar
  permanentemente bloqueado.

### Reglas a respetar

4. **PROHIBIDO** que `#gm-btn-end` (o cualquier botón FINALIZAR
   equivalente) permanezca activo mientras una cadena de gates
   automáticos (imbatida/stats/MVP/WhatsApp) está en curso. Se
   deshabilita al confirmar "SÍ" en `_mlConfirmEnd` y solo se reactiva:
   (a) en los puntos de `gmEndMatch()` que exigen una acción del usuario
   fuera de la cadena (prórroga, min 110), vía `_gmReenableEndBtn()`; o
   (b) si el usuario cancela un picker obligatorio o la cadena revienta.
5. **PROHIBIDO** añadir un gate automático nuevo a `gmEndMatch()`
   (que haga `return` y se re-dispare solo al confirmarse) sin mantener
   el botón deshabilitado durante su espera — heredarlo es automático
   mientras el gate no llame a `_gmReenableEndBtn()`.

## Todo cambio en `index.bundle.js`/`.css` (o cualquier asset del Service Worker) DEBE bumpear su `?v=X.X` — si no, no llega NUNCA a dispositivos con caché (obligatorio, 2026-07-04)

**Bug (foto usuario 2026-07-04, «Maccabi vs Liverpool», portería imbatida
— tocar cualquiera de los 5 porteros de la lista «no funciona»)**: un
amigo terminó un partido de Trofeo Joan Gamper y, al abrirse el overlay
obligatorio «🧤 PORTERÍA IMBATIDA» (elegir qué portero mantuvo la
portería a 0), pulsar CUALQUIERA de los 5 nombres (Alisson, Mamardashvili,
Woodman, Pecsi, Davies) no hacía nada — el overlay se quedaba fijo.

### Investigación — el código en sí es correcto

`showImbatForce`/`confirmImbatForce`/`_ensureImbatEvents`
(`static/js/index.bundle.js`) se reprodujeron de forma aislada
(Playwright + harness mínimo) con el roster exacto de la foto: el click
en cualquier botón SÍ dispara `confirmImbatForce` → resuelve la promesa
→ cierra el overlay correctamente. El código servido HOY no tiene el bug.

### Causa raíz real — caché de 30 días + Service Worker "cache-first" sin versión bumpeada

- **`app.py`** (`_static_cache_headers`): toda respuesta bajo
  `/static/js/` o `/static/css/` lleva `Cache-Control: public,
  max-age=2592000` (30 DÍAS). El comentario del propio código lo dice:
  «Los archivos JS/CSS llevan `?v=X.X` → pueden cachearse 30 días» — la
  estrategia ENTERA depende de que el número de versión se incremente
  cada vez que el contenido cambia.
- **`static/js/sw.js`** (Service Worker): además del caché HTTP, el SW
  precachea `index.bundle.js?v=9.10` (junto a `index.bundle.css`,
  `copa-engine.js`, `goal-notification-*`, `var-system.js`) en el
  `install`, y sirve TODO `/static/` con estrategia **cache-first**
  (`cache.match(e.request)` — si hay un HIT, se devuelve la copia
  cacheada **sin comprobar la red jamás**, para esa URL exacta).
- **El número de versión llevaba en `9.10` sin tocarse** pese a que
  `static/js/index.bundle.js` — donde vive literalmente
  `showImbatForce`/`confirmImbatForce`/`_ensureImbatEvents` — se ha
  modificado varias veces en el historial visible del repo. Cualquier
  dispositivo (móvil, PC, portátil) que instaló el Service Worker o
  cacheó el bundle ANTES de una de esas modificaciones se queda
  **ATRAPADO PARA SIEMPRE** con esa copia vieja — el navegador no tiene
  ningún motivo para volver a pedir `index.bundle.js?v=9.10`: la URL no
  cambió, así que ni el caché HTTP ni el Service Worker la consideran
  stale. Esto explica el patrón «funciona en mi móvil, no en el de mi
  amigo»: quien recargó/reinstaló recientemente obtiene el bundle
  actual; quien no, se queda con el que tenía cacheado desde hace
  semanas, con bugs ya corregidos en el servidor pero invisibles para
  ese dispositivo.
- **Los partials `misc_body_1.html`/`misc_body_2.html` NO sufren esto**:
  se sirven inline dentro del HTML de navegación (`network-first` en el
  SW, `no-cache` en las rutas dinámicas) — por eso la inmensa mayoría de
  fixes de este CLAUDE.md (que viven en esos partials) SÍ llegan a todos
  los dispositivos de inmediato. El problema es exclusivo de los assets
  bajo `/static/js/` y `/static/css/` referenciados por `?v=`.

### Fix

Bump de `9.10` → `9.11` en **AMBOS** sitios donde aparece la URL
(`templates/index.html` y el array `PRECACHE` de `static/js/sw.js`,
que deben coincidir siempre) — fuerza a todo dispositivo, tenga la
caché que tenga, a descargar el bundle actual en su próxima carga.

### Reglas a respetar

1. **PROHIBIDO** modificar `static/js/index.bundle.js`,
   `static/css/index.bundle.css`, `static/js/copa-engine.js`,
   `static/js/var-system.js`, `static/js/goal-notification-improved.js`,
   `static/js/goal-notification-improved.css` o
   `static/js/goal-notification-patch.js` sin **incrementar su `?v=X.X`
   en LOS DOS sitios donde vive**: la etiqueta `<script>`/`<link>` de
   `templates/index.html` Y la entrada correspondiente del array
   `PRECACHE` de `static/js/sw.js`. Si solo se bumpea uno de los dos
   sitios, quedan desincronizados (el HTML pide una URL que el SW no
   tiene precacheada con ese número, o viceversa) — deben ir SIEMPRE
   juntos.
2. **PROHIBIDO** asumir que un fix en `index.bundle.js`/`.css` "ya está
   arreglado" solo porque el código fuente en el repo es correcto: sin
   el bump de versión, los dispositivos con caché (HTTP de 30 días +
   Service Worker cache-first) NUNCA reciben el cambio. Todo bug
   reportado en algo que vive en estos archivos debe hacer sospechar
   PRIMERO si el dispositivo que falla tiene una versión vieja cacheada
   (pedir al usuario recargar forzado / borrar caché del navegador como
   diagnóstico, y bumpear la versión como fix).
3. Todo asset NUEVO que se añada al array `PRECACHE` de `sw.js` hereda
   esta regla: su URL debe llevar `?v=` y esa versión debe bumpearse en
   ambos sitios cada vez que su contenido cambie.
4. Los partials `misc_body_1.html`/`misc_body_2.html` (inline en el HTML
   de navegación, `network-first`) NO necesitan este bump — solo los
   archivos servidos como `<script src>`/`<link href>` bajo `/static/`.

### Refuerzo — el propio picker se blinda además del bump de versión (obligatorio, 2026-07-04)

**El bump de versión (9.10→9.11) no bastó**: el amigo repitió la prueba
(mismo partido Maccabi vs Liverpool) y la portería imbatida seguía sin
responder a ningún portero. En vez de seguir asumiendo caché, se
blindó el propio código de `showImbatForce`/`confirmImbatForce`/
`_ensureImbatEvents` (`static/js/index.bundle.js`) contra TODOS los
fallos silenciosos posibles, en vez de depender de una única teoría:

1. **Cierre determinístico del spinner "Procesando partido…"**
   (`#ml-loading-ov`, z-index 100020): `showImbatForce` llama
   `window._mlHideLoading()` de inmediato al abrirse, en vez de confiar
   en el `MutationObserver` que lo auto-cierra — ese observer NUNCA
   detecta este overlay concreto porque se crea con la clase `show` YA
   puesta antes de insertarse en el DOM (no genera una mutación de
   atributo observable; solo lo salvaban 3 temporizadores de hasta
   4.5 s, confirmado con un test de `MutationObserver` aislado).
2. **z-index inline 100050** en el propio overlay del picker — por
   encima de CUALQUIER spinner/overlay de proceso — como red de
   seguridad adicional aunque el cierre determinístico fallara por
   cualquier motivo no previsto.
3. **`confirmImbatForce` envuelto en try/catch con `alert()` visible
   en caso de error**: antes, si algo dentro de la función reventaba
   (p.ej. un dato inesperado en la plantilla), el fallo era
   COMPLETAMENTE SILENCIOSO — exactamente el síntoma "no funciona el
   elegir ninguno de los porteros". Ahora cualquier excepción se
   muestra al usuario en vez de dejar el overlay atascado sin
   explicación.
4. **Resolución de plantilla por el registro CANÓNICO del mister**
   (`_humanClubSlotName`, si existe) antes de caer al nombre crudo en
   `_getTopGk`/`showImbatForce` — estos dos eran los ÚNICOS pickers de
   plantilla humana que aún resolvían por nombre crudo (regla
   2026-06-28 "El picker de eventos de una caja humana muestra SIEMPRE
   la plantilla de SU mister" solo cubría `_gmGetSquad`/`genTpSelect`).
5. **Detección de humano con capas** (`_isHumanClubCanonico`/
   `_esSelHumana` como fallback de `esHumano`) en `_ensureImbatEvents`:
   `esHumano()` solo reconoce los 5 humanos legacy de Liga EA Sports;
   sin el fallback, un club/selección humano nuevo (PSG, Inter, o
   cualquier selección canónica) caía al auto-pick silencioso de IA en
   vez de mostrar el picker al humano.

Verificado con un harness Playwright aislado que reproduce exactamente
la cadena `_ensureImbatEvents → showImbatForce → confirmImbatForce`
con el roster real de la foto (Alisson, Mamardashvili, Woodman, Pecsi,
Davies): tras el fix, el cierre del spinner es determinístico (no
depende del observer), el z-index del picker queda por encima de
cualquier overlay de proceso, y el click resuelve la cadena
correctamente.

**Reglas a respetar (además de las 4 de arriba)**:
5. **PROHIBIDO** que un overlay obligatorio nuevo (picker de un solo
   uso creado con `document.createElement` + `className` puesto ANTES
   de insertarse en el DOM) dependa SOLO del `MutationObserver` de
   `misc_body_2.html` (`obs2`, TARGETS/TARGET_CLASSES) para cerrar el
   spinner "Procesando partido…". Ese observer solo detecta cambios de
   atributo en nodos YA insertados (`classList.add` posterior, como
   hace `showMvpForce` reutilizando un div ya en el DOM) — un nodo
   nuevo con la clase ya puesta es invisible para él. Todo picker
   nuevo de este tipo debe llamar `window._mlHideLoading()`
   explícitamente al abrirse.
6. **PROHIBIDO** que un handler de confirmación de un overlay
   obligatorio (imbatida, MVP, sanciones…) falle en silencio. Envolver
   siempre en try/catch con un aviso VISIBLE (`alert`/toast) — un fallo
   silencioso en un flujo obligatorio dejaba al usuario sin ninguna
   pista de qué había pasado.
7. **PROHIBIDO** que `_getTopGk`/`showImbatForce` (o cualquier picker
   de plantilla humana nuevo) resuelvan el roster por nombre crudo sin
   pasar antes por `_humanClubSlotName`. Toda caja de humano nueva lo
   hereda automáticamente en cuanto esté en el registro `MISTERS_HUMANOS`.

### Refuerzo 2 — el tap real seguía sin responder + el ❓ desaparecía sin alias (obligatorio, 2026-07-04)

**El refuerzo 1 no bastó**: el amigo repitió la prueba y el botón
"Alisson" se quedaba resaltado (color `:active`) al tocarlo pero el
partido seguía bloqueado — ni elegir portero ni "Cancelar (no
finalizar)" hacían nada, sin forma de avanzar ni de salir. A la vez, en
la PANTALLA DE PREVIA del mismo partido, el botón **❓** (alias
eFootball, bajo el equipo IA cuando el rival es humano) había
desaparecido por completo.

**Causa raíz 1 — ambigüedad táctil real, invisible para tests con `.click()`**:
un tap dentro de un contenedor `overflow-y:auto` anidado
(`.mvp-pl-list` dentro de `.mvp-force-overlay`) puede ser reinterpretado
por el navegador como intento de scroll si detecta el mínimo movimiento
del dedo entre `touchstart`/`touchend` — en ese caso el evento `click`
sintético **NUNCA se dispara**, aunque el botón SÍ muestra su estado
`:active` (que depende solo del `touchstart`, no del click). Un test
automatizado con `.click()` directo no lo reproduce porque no simula
touchstart→touchmove→touchend con micro-movimiento real. Verificado
con Playwright + `Input.dispatchTouchEvent` (CDP) disparando la
secuencia táctil SIN click sintético: reproduce el bloqueo exacto.
Afecta IGUAL al botón "Cancelar" (misma clase de contenedor), por eso
tampoco dejaba salir del overlay.

**Fix 1**: `showImbatForce` cablea un respaldo `touchend` (con
comprobación de que el dedo no se movió >12px desde el `touchstart`,
para no confundir un scroll real con un tap) en CADA botón del overlay
— porteros y "Cancelar" por igual. `confirmImbatForce`/`cancelImbatForce`
son idempotentes (el overlay ya se removió, `_imbatForceCallback` ya es
null), así que si el `click` normal SÍ llega después no hay doble
confirmación.

**Causa raíz 2 — el ❓ solo se dibujaba SI ya había un alias configurado**:
`_ppAliasHtml(txt)` hacía `if(!txt) return ''` — el botón entero
desaparecía (no solo su contenido) cuando `getTeamEfootballAlias(team)`
venía vacío. Un equipo IA sin alias configurado (nunca editado, o
perdido) se quedaba sin NINGÚN botón, sin pista de que la función
existe ni forma de comprobarlo/configurarlo desde la previa.

**Fix 2**: el ❓ se muestra SIEMPRE que el rival sea humano y este lado
no lo sea (misma condición de siempre, `_ppHomeAliasShow`/
`_ppAwayAliasShow`, ya independiente del texto). Si el alias viene
vacío, `window._copaShowAlias` (`copa-engine.js`) ya no hace `return`
en silencio — muestra un aviso "⚠️ Sin alias eFootball configurado para
`<equipo>` — ve al editor de Resto de Ligas…" en vez de no responder al
pulsar.

**Reglas a respetar**:
8. **PROHIBIDO** que un botón crítico dentro de un contenedor
   `overflow-y:auto` (picker de porteros, MVP, jugador de evento, o
   cualquier overlay obligatorio nuevo) dependa ÚNICAMENTE del evento
   `click` sintético. Todo botón así DEBE cablear también un respaldo
   `touchend` con comprobación de movimiento (patrón
   `_imbatWireTapFallback` en `showImbatForce`), para que un tap real en
   móvil con la mínima ambigüedad de scroll no deje al usuario sin
   forma de avanzar NI de cancelar/salir.
9. **PROHIBIDO** que el botón ❓ (alias eFootball) desaparezca por no
   haber alias configurado. La condición de mostrarlo depende SOLO de
   quién es humano (`_ppHomeAliasShow`/`_ppAwayAliasShow`); el texto
   vacío se gestiona dentro del popup (`_copaShowAlias`), nunca
   ocultando el botón entero.
10. **PROHIBIDO** que `_copaShowAlias` (o cualquier popup de alias
    nuevo) haga `return` en silencio cuando el alias viene vacío — debe
    informar al usuario qué hacer (dónde configurarlo) en vez de no
    responder al pulsar.

## El picker de portería imbatida y el popup de alias NUNCA se quedan colgados en silencio — la continuación tras confirmar también va blindada (obligatorio, 2026-07-05)

**Bug (4 fotos usuario, «Maccabi Tel Aviv vs Liverpool», 0-0, 12
intentos para terminar el partido)**: pese a los refuerzos anteriores
(touchstart inmediato en el picker, búsqueda de alias server-side de
una sola petición), el usuario seguía reportando: (1) el popup ❓ se
quedaba en «🔄 Buscando en el servidor…» varios MINUTOS sin resolver
nunca, y (2) pulsar cualquiera de los 5 porteros del picker «PORTERÍA
IMBATIDA» no hacía avanzar el partido — «imposible continuar».

### Causa raíz — los fixes anteriores blindaban el TAP, no lo que pasa DESPUÉS

Investigación exhaustiva confirmó que el código de `showImbatForce` /
`confirmImbatForce` / `_efAliasServerSearch` / `/api/team-alias/<name>`
ya estaba correctamente implementado y mergeado a `main` (verificado
con `git log`, `py_compile` y un parser JS sobre cada bloque
`<script>`). El hueco real estaba en la CONTINUACIÓN, no en la
detección del toque:

1. **`_ensureImbatEvents`**: `opts.pushEv(...)` se llamaba SIN
   try/catch dentro del executor de una `new Promise(...)` — si algo
   en el pintado del acta (`document.getElementById('gm-acta-list')`,
   construcción del `<li>`, etc.) lanzaba, la excepción se convertía
   automáticamente en un **rechazo silencioso** de la promesa. Peor
   aún: la llamada a `onDone()` (el `gmEndMatch()`/`mlEndMatch()` que
   debe reanudar el partido tras registrar la portería) vivía FUERA de
   cualquier try/catch — si `onDone()` reventaba por cualquier motivo
   posterior (stats, MVP, guardado…), el picker YA se había cerrado
   (parecía que el tap "funcionó") pero el partido se quedaba
   congelado sin overlay siguiente ni ninguna explicación. El `.catch`
   final solo hacía `console.warn` — invisible para el usuario,
   violando la propia regla de este archivo ("un handler de
   confirmación de un overlay obligatorio NUNCA falla en silencio").
2. **`_copaShowAlias`**: el timeout de 6 s vivía DENTRO de
   `_efAliasServerSearch`, protegiendo solo la promesa del `fetch`. Si
   algo ANTES de esa promesa reventaba de forma SÍNCRONA (`fetch`/
   `AbortController` no definidos en un WebView viejo, o
   `_aliasNormName` lanzando), `onDone` nunca llegaba a invocarse y el
   overlay se quedaba en «Buscando…» para siempre — sin más salida que
   pulsar CERRAR a ciegas, sin saber si alguna vez iba a resolver.

### Fix

- **`_ensureImbatEvents`** (`static/js/index.bundle.js`): las dos
  llamadas a `opts.pushEv(...)` (humano y auto-pick IA) van envueltas
  en try/catch — un fallo al pintar el acta ya NUNCA bloquea el
  registro del evento ni el avance del partido. La llamada a
  `onDone()` va envuelta en try/catch con `alert()` visible si falla.
  El `.catch` final de la cadena de promesas también avisa con
  `alert()` (antes solo `console.warn`) para cualquier error que no
  sea la cancelación explícita del usuario.
- **`_copaShowAlias`** (`static/js/copa-engine.js`): watchdog
  `setTimeout` de 7 s **independiente** del timeout interno de
  `_efAliasServerSearch` — resuelve el overlay a «sin alias
  configurado» pase lo que pase, aunque algo reviente antes de que el
  timeout interno llegue a arrancar. La llamada a
  `window._efAliasServerSearch` va envuelta en try/catch. Guardia
  `settled` para que solo el primero en llegar (respuesta real o
  watchdog) escriba el resultado.
- **`_efAliasServerSearch`** (`templates/partials/misc_body_1.html`):
  todo el cuerpo envuelto en try/catch — un fallo síncrono (p.ej.
  `fetch` no definido) se resuelve como "no encontrado" en vez de
  dejar `onDone` sin invocar nunca.
- Bump `index.bundle.js` 9.15 → 9.16 y `copa-engine.js` 1.4 → 1.5 en
  `templates/index.html` y el `PRECACHE` de `static/js/sw.js`.

### Reglas a respetar

11. **PROHIBIDO** que `opts.pushEv(...)` dentro de `_ensureImbatEvents`
    (o cualquier callback de un overlay obligatorio que registre un
    evento en el acta) se llame sin try/catch cuando vive dentro del
    executor de una `new Promise(...)`: una excepción ahí se convierte
    en un rechazo silencioso indistinguible de una cancelación real.
12. **PROHIBIDO** que la llamada a `onDone()` (o cualquier callback de
    "continuar tras confirmar" de un overlay obligatorio) viva fuera de
    un try/catch con aviso visible. El picker puede cerrarse
    correctamente y aun así dejar al usuario bloqueado si lo que viene
    DESPUÉS falla en silencio — el `alert()` es lo único que distingue
    "tap no detectado" de "tap detectado pero la continuación reventó".
13. **PROHIBIDO** que un watchdog de timeout para un overlay de
    "buscando…" viva SOLO dentro de la función que hace la petición de
    red. Debe existir un watchdog independiente en el CALLER (quien
    pinta el "Buscando…") que garantice una resolución acotada aunque
    la función interna falle antes de llegar a su propio timeout.
14. Antes de asumir que un bug "ya arreglado" sigue reproduciéndose por
    una regresión de código, comprobar primero con `git log`/`git
    fetch origin main` si el fix realmente llegó a `main` y cuánto
    tiempo llevaba desplegado en el momento de la prueba — un fix
    mergeado minutos antes de la prueba puede no haber terminado de
    desplegarse/activarse (Service Worker `skipWaiting`+`clients.claim`
    necesita una recarga real de la pestaña, no solo el merge).

## Extras manuales del reparto europeo — rellenar huecos cuando la hidratación automática no basta (obligatorio, 2026-07-03)

**Contexto (fotos usuario 2026-07-03, «ahora van menos», Wild Card 8/72
→ 11/72 tras el fix de hidratación secuencial)**: incluso con
`_eurHydrateMissingLeagues` arreglado (secuencial + pausado + reintentos,
ver sección anterior), el pool puede seguir muy por debajo del objetivo
si el SERVIDOR simplemente no tiene guardada la clasificación de esa
liga todavía (dato, no código — p.ej. una liga que solo se ha simulado
en un móvil que nunca llegó a sincronizar). El admin pidió: (1) un botón
que le muestre qué equipos van a cada competición SIN tener que pulsar
"Enviar realidad" (que congela una snapshot), y (2) poder añadir un
equipo a mano, rápido, a CUALQUIER zona — no solo a las que ya cubría el
inyector "EA Sports → Europa" (que es solo para España).

### Fix — nuevo botón + store genérico, independiente de "EA Sports → Europa"

- **`window._eurManualOverlayOpen()`** (`misc_body_1.html`, botón "👁 Ver
  / Añadir equipos por competición (admin)" bajo Resto de Ligas, ANTES
  de "Enviar realidad"): overlay de consulta + edición INMEDIATA.
  Calcula el pool **EN VIVO** (`_eurLiveBlob`, bypass de
  `europe_committed_v1` vía `_europeIgnoreFrozen`) cada vez que se abre
  o se añade/quita un equipo — el admin ve el estado real sin congelar
  nada. Muestra el conteo real vs el objetivo oficial por zona
  (`_EUR_ZONE_TARGET`), un formulario para añadir un equipo (nombre +
  país/liga opcional + chip de zona) y la lista de extras manuales ya
  añadidos con botón ✕ para quitarlos. El listado completo agrupado por
  liga reutiliza `_eurZoneSectionHtml`/`_EUR_REPORT_ZONES` (los mismos
  que ya pintaba `_eurShowCommitReport`).
- **`eur_manual_extra_v1`** (nuevo store, `misc_body_1.html` junto a
  `_prependManualEa`): `{ucl:[],uclPrev:[],uel:[],uecl:[],uclQual:[],
  wildcard:[]}`, cada entrada `{name,league,logo}`.
  **INDEPENDIENTE** de `manual_ea_<slug>_v1` (el inyector "EA Sports →
  Europa", solo para las plazas manuales de España). Los 6
  `compute*Classified()` lo consumen vía `_appendManualExtra(arr,zone)`
  **AL FINAL** (tras `_prependManualEa` + el cómputo automático,
  dedupe por nombre) — incluidas `uclQual`/`wildcard`, que desde
  2026-07-03 NO leen `_prependManualEa` (España tiene cupo 0 ahí) pero
  SÍ deben poder recibir extras genéricos de CUALQUIER país para tapar
  huecos.
- **Servidor** (`app.py`): `eur_manual_extra_v1` en `_KV_ALLOWED_EXACT`
  + merge dedicado `_eur_manual_extra_merge` — **UNIÓN por (zona,
  nombre)**, NUNCA reemplazo por recencia. Con 6 móviles + PC, dos
  dispositivos pueden añadir equipos DISTINTOS sin haberse sincronizado
  entre ellos; un merge por recencia pura (`_KV_RECENCY_BLOB_KEYS`)
  perdería la adición del dispositivo más lento. Compromiso aceptado:
  un ✕ (borrado) puede resucitar si otro dispositivo con una copia sin
  ese borrado hace POST después — mismo trade-off que el resto de listas
  aditivas del proyecto (derbys, `cash_ledger_v1`). Tests en
  `tests/test_api.py::TestEurManualExtraMerge`.

### Reglas a respetar

1. **PROHIBIDO** mezclar `eur_manual_extra_v1` con `manual_ea_<slug>_v1`.
   El inyector EA es SOLO para las plazas manuales de España (limitado a
   `ucl`/`uclPrev`/`uel`/`uecl`, cupo 0 en `uclQual`/`wildcard` — regla
   2026-07-03 "Open Qualifier y Wild Card NUNCA leen el inyector
   manual"). `eur_manual_extra_v1` es agnóstico de liga y SÍ se lee en
   las 6 zonas — son mecanismos distintos con propósitos distintos.
2. **PROHIBIDO** que el merge del servidor de `eur_manual_extra_v1`
   vuelva a un reemplazo por recencia (`_KV_RECENCY_BLOB_KEYS`): es una
   lista ADITIVA multi-dispositivo, la fusión es SIEMPRE unión por
   (zona, nombre).
3. **PROHIBIDO** que `_eurManualOverlayOpen`/`_eurLiveBlob` escriban en
   `europe_committed_v1`: es una vista EN VIVO, de solo-lectura respecto
   a la snapshot. Solo "Enviar realidad de cada equipo a su Europa"
   congela.
4. Toda zona nueva que se añada al reparto europeo (si en el futuro hay
   una 7ª) hereda el patrón añadiendo su key a `EUR_MANUAL_ZONES`
   (cliente) y `_EUR_MANUAL_EXTRA_ZONES` (servidor) — deben ir siempre
   sincronizadas entre sí.

### El overlay se AUTO-hidrata al abrirse — no depende de otros botones (obligatorio, 2026-07-03)

**Refuerzo (mismo día, fotos usuario "no me cuadra nada" — Wild Card
9/72 al abrir el overlay recién publicado)**: el overlay inicial solo
LEÍA lo que ya hubiera en `localStorage`; si el admin abría "👁 Ver /
Añadir equipos" sin haber pulsado antes "♻️ Re-cuadrar" o
"📤 Enviar realidad", veía un conteo bajo que no reflejaba lo que el
servidor realmente tiene guardado.

- **`_eurManualOverlayOpen`** ahora dispara `_eurManualTriggerHydrate()`
  (= `_eurHydrateMissingLeagues` + re-render) automáticamente al abrirse
  (throttle 2 min), con un estado visible en el header: `⏳ Cargando
  ligas del servidor…` mientras hidrata, `✅ Actualizado — <hora>` al
  terminar. Botón `🔄 Cargar del servidor` para forzar un refresco manual
  en cualquier momento sin cerrar/reabrir el overlay.
- **`_eurMissingLeaguesList()`**: lista, por NOMBRE de país/liga (vía
  `LEAGUE_DEFAULT_NAMES`), las ligas de `LEAGUE_DEFAULT_ZONES` que en
  ESTE dispositivo siguen sin plantilla (≥2 equipos) tras la hidratación
  — convierte "el número no cuadra" en "estas ligas concretas faltan":
  el admin sabe exactamente cuáles abrir/simular en algún dispositivo
  que sí las tenga, o rellenar a mano con el formulario de arriba.

**Regla a respetar**: **PROHIBIDO** que el overlay vuelva a depender de
que el admin haya pulsado "Re-cuadrar"/"Enviar realidad" ANTES de
abrirlo para mostrar un conteo fiable — debe auto-hidratarse él solo.
Si tras una hidratación COMPLETA (`✅ Actualizado`) una zona sigue por
debajo del objetivo, la lista de "LIGAS SIN DATOS" debe explicar por qué
(dato ausente en el servidor, no un fallo de red) — no dejar al admin
adivinando.

### El objetivo de ucl/uel/uecl en el overlay es 40, NO 28/18/12 (bug propio, 2026-07-03)

**Bug (fotos usuario "no me cuadra nada", Champions 38/28 · Europa
38/18 · Conference 40/12, las 3 en VERDE)**: el overlay mostraba las 3
zonas directas como si tuvieran DEMASIADOS equipos (verde = "por
encima del objetivo"), haciendo creer al admin que algo estaba
sobrecargado, cuando en realidad `computeUclClassified()` /
`computeUelClassified()` / `computeUeclClassified()` YA suman el corte
de la Previa de Champions (12/22/28) a las plazas directas por liga
(28/18/12) — el pool final de esas 3 pantallas es **40/40/40** (ver
sección "Wild Card + Open Qualifier — FASE DE GRUPOS": «🔵 UCL 28+12=40
· 🟠 UEL 18+22=40 · 🟢 UECL 12+28=40»). `_EUR_ZONE_TARGET` usaba por
error las plazas DIRECTAS (28/18/12) como si fueran el total.

**Fix**: `_EUR_ZONE_TARGET = { ucl:40, uclPrev:34, uel:40, uecl:40,
uclQual:88, wildcard:72 }`. **PROHIBIDO** volver a poner 28/18/12 como
objetivo de ucl/uel/uecl en este overlay (ni en ningún diagnóstico
nuevo) — esas son solo las plazas DIRECTAS de liga, el objetivo real
del pool completo de la pantalla es 40 en las 3.

### Añadir por liga — clasificación completa + buscador + quitar (obligatorio, 2026-07-03)

**Petición usuario** (fotos "no me cuadra nada"): el añadido manual
equipo-a-equipo escribiendo el nombre a mano es lento y propenso a
error. Pidió: (1) un buscador al escribir el nombre, (2) poder elegir
una liga y ver su clasificación completa para saber qué equipo va a
cada competición según su posición, añadiendo varios de golpe, y
(3) poder quitar un equipo ya añadido.

- **Buscador typeahead** (`#eur-manual-name` + `_eurSearchAllTeams`):
  al escribir 2+ letras, busca por substring en TODAS las
  `ligaExt_<slug>` YA cacheadas en este dispositivo (best-effort — no
  trae del servidor, para eso está el picker por liga) y muestra un
  dropdown clicable que rellena nombre + liga.
- **📋 Añadir por liga** (`_eurPickerSectionHtml`/`_eurPickerLoadLeague`/
  `_eurPickerRows`): un `<select>` con las 54 ligas
  (`_eurAllLeagueSlugsSorted`, vía `LEAGUE_DEFAULT_ZONES`/
  `LEAGUE_DEFAULT_NAMES`). Al elegir una, trae ESA liga SOLA (local si
  ya está cacheada, si no 1 sola petición al servidor — nunca las 53 de
  golpe, así es rápido y fiable) y pinta su clasificación completa
  (posición, nombre, PJ) con la **zona SUGERIDA por posición** — misma
  lógica de rangos ("skip") que `_computeQualifiedFromLeagues`: ucl →
  uclPrev → uclQual → uel → uecl → wildcard, en ese orden, según
  `zones.<zona>` de la liga. Cada fila tiene un botón "➕ Añadir" (pasa a
  "✓ Añadido" si ya está) y hay un botón "✅ AÑADIR TODOS LOS SUGERIDOS"
  para volcar de golpe todas las filas con zona.
- **Quitar equipo añadido**: ya existía (botón ✕ junto a cada entrada en
  la lista de "extras manuales" agrupada por zona, sección justo debajo
  del formulario) — se mantiene sin cambios, solo se hace más visible
  al quedar bajo las dos formas de añadir.

**Reglas a respetar**:
1. `_eurPickerLoadLeague` **NUNCA** dispara una hidratación masiva de
   las 53 ligas — es SIEMPRE 1 sola liga (local o 1 fetch). Si se
   necesita traer todas, existe `_eurManualTriggerHydrate` (botón
   "🔄 Cargar del servidor" / auto-hidrata al abrir) — son mecanismos
   DISTINTOS y complementarios, no fusionar.
2. El orden de rangos por posición (`ORDER = ['ucl','uclPrev','uclQual',
   'uel','uecl','wildcard']`) en `_eurPickerRows` **DEBE** coincidir
   exactamente con el orden de `skip` de `_computeQualifiedFromLeagues`
   — si ese orden cambia algún día, cambiar aquí también o la zona
   sugerida por posición dejará de coincidir con el cómputo automático.
3. El buscador (`_eurSearchAllTeams`) es de solo LECTURA de lo que ya
   hay en localStorage — **PROHIBIDO** que dispare peticiones de red
   (eso lo hace el picker por liga, con 1 fetch explícito por selección
   del admin, nunca en cada tecla escrita).

### Modo MANUAL por zona — "elimina los equipos automáticos, lo hago yo" (obligatorio, 2026-07-03)

**Petición usuario** (fotos "Champions League — 31 equipos" con
mezcolanza de países, "Previa de Champions — 9 equipos"): "todos esos
equipos que están automáticamente en las competiciones elimínalos, lo
hago yo manualmente". El cómputo automático sigue siendo útil para
otras zonas, así que el modo manual es **POR ZONA**, no global.

- **`eur_manual_override_v1`** (nuevo store, junto a
  `eur_manual_extra_v1`): `{ucl,uclPrev,uel,uecl,uclQual,wildcard}`
  booleanos. `window._eurManualOnly(zone)` / `window._eurManualOverrideSet(zone,bool)`.
- Cada uno de los 6 `compute*Classified()` comprueba
  `window._eurManualOnly(zone)` **AL PRINCIPIO**, ANTES incluso de mirar
  `_europeFrozenFor` (una snapshot congelada previa NO debe resucitar
  los automáticos si el admin activó manual): si está activo, devuelve
  `_appendManualExtra([], zone)` — SOLO lo que el admin haya añadido a
  mano (formulario / picker por liga), cero automático.
- **UI**: cada tarjeta de conteo del overlay lleva un botón
  `🔓 Auto` / `🔒 Manual` que alterna el flag (con `confirm()` al
  ACTIVAR, para que no sea un toque accidental). El conteo, la lista
  agrupada por liga (`_eurZoneSectionHtml`) y el picker por liga siguen
  funcionando igual — simplemente `blob[zone]` pasa a ser 100% manual.
- Servidor: `eur_manual_override_v1` en `_KV_ALLOWED_EXACT` +
  `_KV_RECENCY_BLOB_KEYS` (edición rara de admin, recencia simple).

**Reglas a respetar**:
4. **PROHIBIDO** que el check de `_eurManualOnly(zone)` se coloque
   DESPUÉS de `_europeFrozenFor` en cualquiera de los 6 compute
   functions — si no, una snapshot congelada antigua seguiría
   devolviendo los equipos automáticos aunque el admin haya activado
   modo manual para esa zona.
5. El modo manual NUNCA borra `eur_manual_extra_v1` ni
   `europe_committed_v1` — solo cambia qué fuente se LEE. Desactivar el
   modo manual (volver a 🔓 Auto) restaura el cómputo automático tal
   cual sin perder nada.
6. Toda zona nueva que se añada al reparto (7ª futura) hereda el modo
   manual automáticamente en cuanto se añada a `EUR_MANUAL_ZONES` +
   tenga su propio check `_eurManualOnly` al principio de su función de
   cómputo.

**Refuerzo (mismo día, fotos usuario "siguen saliendo los equipos,
elimínalos, los añado yo manualmente" — el toggle opt-in de arriba no
bastó)**: el admin pidió DOS VECES que los equipos automáticos
desaparezcan de las 6 competiciones, no que exista un botón que hay
que ir a pulsar zona por zona. **El DEFAULT de `_eurManualOverrideLoad`
pasa a ser `true` (manual) en las 6 zonas** — antes era `false`
(automático) y el admin tenía que activar el candado 🔒 uno a uno.
Cualquier elección EXPLÍCITA previa del admin (guardada en
`eur_manual_override_v1`) sigue ganando sobre este default — si en
algún momento vuelve a poner una zona en 🔓 Auto, esa elección se
respeta y persiste.

**Regla a respetar**: **PROHIBIDO** volver a poner `false` (automático)
como default de `_eurManualOverrideLoad` sin acuerdo explícito del
usuario — es la 2ª vez que pide esto y la 1ª implementación (opt-in vía
toggle) no fue suficiente porque requería una acción por zona que el
admin no había hecho.

### El picker de liga es un botón/lista PROPIO, no un `<select>` nativo (obligatorio, 2026-07-03)

**Petición usuario** (foto del `<select>` nativo de Android abierto a
pantalla completa con radios ⭕): "mejor para seleccionar liga que sea
marcar ✅". El `<select>` nativo rompe el look de la app (picker gris
del sistema operativo) y usa radios genéricos.

**Fix**: `_eurPickerButtonHtml()` sustituye el `<select>` por un botón
`#eur-pick-league-btn` que despliega una lista propia
`#eur-pick-league-list` (mismo estilo oscuro que el resto del overlay),
con un ✅ junto a la liga seleccionada en vez de un radio. Estado
`_eurPickerListOpen` controla la visibilidad; clicar una fila cierra la
lista y dispara `_eurPickerLoadLeague` igual que antes.

**Regla a respetar**: **PROHIBIDO** volver a un `<select>` nativo para
selecciones dentro de overlays de admin de esta pantalla — usar el
patrón botón + lista propia con ✅ (mismo que otros pickers custom del
proyecto, p.ej. `.mea-drop` de "EA Sports → Europa").

## La hidratación de ligas para el reparto europeo es SECUENCIAL + PAUSADA, nunca thundering herd (obligatorio, 2026-07-03)

**Bug (fotos usuario 2026-07-03, «solo detecta 8 en Wild Card, tienen
que ser 72»)**: tras pulsar «♻️ Re-cuadrar reparto europeo (canónico)»
y «📤 Enviar realidad de cada equipo a su Europa», el diagnóstico de la
Wild Card mostraba **«Pool real detectado: 8 / 72»** con **«LIGAS QUE
APORTAN (0)»**, y las pantallas de Open Qualifier / Previa de Champions
se quedaban llenas de placeholders `TBD-OQ-XX` (6/62 · 12/62).

### Causa raíz (2 bugs)

1. **`_eurHydrateMissingLeagues`** (`misc_body_1.html`) — la función que
   trae del servidor las `ligaExt_<slug>` que faltan en el dispositivo
   ANTES de recalcular el reparto europeo — disparaba **TODOS** los
   `fetch('/api/liga-ext/<slug>')` de golpe con `toFetch.forEach(...)`:
   un **thundering herd** de hasta ~53 GETs simultáneos contra Railway.
   En frío (o bajo carga) la mayoría fallaba/timeaba en silencio
   (`.catch(function(){})`, sin reintento) y el timer fijo de 25 s
   cortaba el resto aunque siguieran en vuelo. Solo las ~8 ligas que
   respondían a tiempo hidrataban `localStorage` → el cómputo en vivo
   (`_computeQualifiedFromLeagues`) solo veía esas 8. Es el MISMO patrón
   ya identificado y arreglado para la subida PC→servidor
   (`_lextReconcileResultsToServer`, «Secuencial+pausado (mata el
   thundering herd que rompía la subida original)») — aquí faltaba
   aplicar el mismo remedio al lado PULL (servidor→dispositivo).
2. **`window._wcDebugPool`** (`part2/misc_body_2.html`) — el diagnóstico
   🔍 llamaba a `computeWildCardClassified()`, que si existe un snapshot
   congelado (`europe_committed_v1`) lo devuelve TAL CUAL sin llamar a
   `_computeQualifiedFromLeagues` → `window._lastQualDiag` queda
   obsoleto (de otra pantalla, o vacío) → el diagnóstico mostraba un
   `poolReal` (del snapshot) y un `contributing` (de un cálculo viejo)
   que NO correspondían entre sí — «8/72 pero 0 ligas aportan» no tiene
   sentido y no ayuda a depurar.

### Fix

- `_eurHydrateMissingLeagues` hidrata las ligas **una a una** (`step()`
  secuencial), con **2 reintentos** en fallo de red/HTTP (nunca cuando
  el servidor responde OK pero sin esa liga — eso no es un fallo) y una
  pausa corta entre pasos. Timer de seguridad subido de 25 s a 90 s
  (una pasada secuencial completa tarda más que una ráfaga paralela,
  pero AHORA SÍ completa en vez de cortarse a los 25 s con la mayoría
  sin intentar). `_eurToast(...)` da feedback visual mientras tanto —
  antes el admin no tenía ninguna señal de que el botón seguía
  trabajando tras el `confirm()`.
- `window._wcDebugPool` fuerza el cálculo **EN VIVO** (bypass del
  snapshot vía `window._europeIgnoreFrozen`) para el diagnóstico —
  SIEMPRE refleja el desglose real por liga — e informa APARTE si hay
  un snapshot congelado con un recuento distinto, indicando que hay que
  volver a pulsar «Enviar realidad…» para refrescarlo.

### Reglas a respetar

1. **PROHIBIDO** que `_eurHydrateMissingLeagues` (o cualquier hidratador
   nuevo que traiga N recursos del servidor en un mismo golpe) dispare
   los `fetch` en paralelo sin cap de concurrencia. Contra Railway, un
   thundering herd de decenas de requests simultáneos falla en silencio
   para la mayoría. Todo fetch masivo nuevo hereda el patrón secuencial
   + pausado + reintentos de `_lextReconcileResultsToServer` /
   `_eurHydrateMissingLeagues`.
2. **PROHIBIDO** que una herramienta de diagnóstico (`_wcDebugPool` o
   cualquier futura) lea `window._lastQualDiag` sin garantizar que se
   acaba de poblar para la MISMA zona que está reportando. Si la
   función que lo puebla puede quedar short-circuited por un snapshot
   congelado (`_europeFrozenFor`), el diagnóstico debe forzar el cálculo
   en vivo (`_europeIgnoreFrozen=true`) para no mostrar cifras
   contradictorias.
3. Si el diagnóstico detecta un snapshot congelado con un recuento
   distinto del cálculo en vivo, debe decírselo EXPLÍCITAMENTE al admin
   (qué botón pulsar para refrescarlo) en vez de dejarle adivinar por
   qué el número de la pantalla no coincide con el del diagnóstico.

## El picker de eventos de una caja humana muestra SIEMPRE la plantilla de SU mister (obligatorio, 2026-06-28)

**Los 7 misters canónicos (club ↔ selección) — fuente de verdad, NUNCA mezclar**:

| Mister | Club | Selección |
|---|---|---|
| Toñín 💡 | Liverpool | Francia |
| Álvaro 🐭 | Arsenal | Brasil |
| Acsa 🔨 | Real Madrid | Inglaterra |
| Isra ✏️ | Atlético Madrid | Noruega |
| Ángel 😈 | FC Barcelona | Argentina |
| Izan 🦆 | PSG | España |
| Rubén 🐲 | Inter | Portugal |

**Bug (fotos usuario 2026-06-28, «Liverpool-Francia-Toñín»)**: al jugar la
card del Liverpool y pulsar **+ AÑADIR EVENTO**, el selector de jugador
(«GOL · LIVERPOOL») mostraba la plantilla del **INTER** (Sommer, Bastoni,
Lautaro, Thuram…) en vez de la del Liverpool. Coincidió con la alta del 7º
mister **Rubén = Inter** (2026-06-26). Causa raíz combinada: (1) el slot
«Liverpool» de `ligaExt_liga-ea-sports` tenía guardada físicamente la
plantilla del Inter (corrupción de datos del save del usuario — se resuelve
re-metiendo la plantilla del Liverpool en el editor); (2) los resolutores
del hub (`_bayernSquad`, `_findBayernRow`, `_lextFindHubTeamRow`, el
`_resolve` del header) llevaban listas `OTHER`/`others`/`o` de «clubes
humanos a excluir para encontrar MI slot» que **NO se actualizaron** al
añadir Inter/PSG → el fallback de un hub podía coger el slot del Inter.

**Fix (código, permanente)**:
- **`window._humanClubSlotName(teamName)`** (`misc_body_1.html`, junto a
  `_mhSameMister`): para un CLUB humano canónico, devuelve el NOMBRE del
  slot de `ligaExt_liga-ea-sports` que pertenece a SU MISTER (exacto si el
  slot se llama igual que el club — preserva byte-for-byte Liverpool/Toñín;
  si no, el slot del MISMO mister vía `_mhSameMister`, gateado a clubes
  humanos con `_isHumanClubCanonico` para NUNCA cruzar a otro mister).
  No-op para IA / selecciones / nombres no canónicos.
- **El event picker lo usa SIEMPRE**: gm-modal `_gmGetSquad` y ml-card
  `genTpSelect` resuelven el nombre por `_humanClubSlotName` ANTES de
  `sqFromRegistryFull`. Así cada caja humana muestra SU plantilla y jamás
  la de otro club humano.
- **Listas de exclusión completadas** con Inter (+ PSG donde faltaba) en
  los 4 resolutores del hub (`_bayernSquad` OTHER, `_findBayernRow` others,
  `_lextFindHubTeamRow` others, `_resolve` o): ningún hub humano puede
  coger por fallback el slot de OTRO mister.

**Reglas a respetar**:
1. **PROHIBIDO** que el event picker (gm-modal o ml-card) resuelva la
   plantilla de un club humano por nombre crudo sin pasar por
   `_humanClubSlotName`. Cada caja humana = la plantilla de SU mister.
2. **PROHIBIDO** añadir un mister nuevo sin meter su club (todos los alias)
   en las 4 listas de exclusión del hub (`OTHER`/`others`/`o`) y en
   `_MISTERS_HUMANOS`. El registro es la fuente única; toda caja nueva
   hereda `_humanClubSlotName` automáticamente.
3. La plantilla VIVE en `ligaExt_liga-ea-sports.teams[].players`. Si está
   corrupta (un club humano con la plantilla de otro), el código no puede
   inventarla: se restaura en el editor. El fix garantiza que, con datos
   correctos, cada caja muestre SIEMPRE su plantilla y nunca la cruce.

### La CABECERA del hub no se contamina con el override de OTRO mister — `_slot` también gateado (obligatorio, 2026-06-29)

**Bug (foto usuario «caja PSG → Inter»)**: al abrir la caja del **PSG**
(Izan 🦆🇪🇸) la cabecera del hub mostraba **«Inter · RUBÉN · GIUSEPPE
MEAZZA»** con el escudo del Inter, aunque el hub activo era Izan/PSG.

**Causa raíz**: el override del menú de la caja del PSG
(`menu_home_v1.ov['go:s-psg']`) había quedado con `label/escudo/estadio`
del **Inter** (contaminación del save). El guard anti-contaminación vivía
SOLO en `_resolve()` (descarta la identidad del override si apunta a OTRO
club humano canónico), pero **`_slot()` leía `_boxOv().label` por su
cuenta** y lo metía como PRIMERA pista de búsqueda → encontraba el slot
del «Inter» y lo devolvía; `_resolve` tomaba entonces `name=t.name=
"Inter"`. Como el míster y el tema se derivan del club RESUELTO `r.name`
(commit «el míster SIGUE al club mostrado»), la cabecera mostraba Rubén +
Giuseppe Meazza pese a estar en la caja de Izan.

**Fix** (`misc_body_1.html`, `_slot()`): el `label` del override SOLO
entra en `wants` si NO apunta a otro mister (`_mhFindMister(canon).id ===
_mhFindMister(ov.label).id`). Mismo guard que `_resolve()`. Así la caja
del PSG localiza SIEMPRE el slot del PSG por su nombre canónico, jamás el
del Inter por el label contaminado.

**Reglas a respetar**:
4. **PROHIBIDO** que `_slot()` (o cualquier resolutor de identidad del hub)
   use `_boxOv().label`/`escudo`/`stadium` SIN el guard anti-contaminación
   (`_mhFindMister(canon).id !== _mhFindMister(label).id` ⇒ descartar). El
   guard de `_resolve` no basta si `_slot` reintroduce el label por su lado.

## HUB MULTI-MISTER — el hub `s-munich` es GENÉRICO, datos por hub (obligatorio, 2026-06-13)

**Petición usuario 2026-06-13 («al pulsar la caja del Arsenal-Brasil sea
exactamente igual que la del Liverpool-Francia pero con los datos del
Arsenal: plantilla, histórico derbys, calendario, todo correspondiente al
Arsenal»)**: el hub rico (`s-munich`) deja de ser exclusivo de Liverpool y
pasa a ser un hub GENÉRICO que sirve a CUALQUIER caja de mister humano del
`MISTERS_HUMANOS`. Empezando por **Arsenal-Brasil** (Álvaro 🐭🇧🇷).

### Arquitectura: 1 pantalla parametrizada + datos POR HUB (NO duplicar)

- `window._ACTIVE_HUB` (en el IIFE de `MISTERS_HUMANOS`, `misc_body_1.html`)
  apunta al mister cuya caja se pulsó. Default = Toñín/Liverpool. Se
  persiste en `active_hub_v1` (cliente). Setter `window.setActiveHub(id)`
  (dispara `_mkHubResync` + evento `hubchange`). Accesores
  `window._activeHub()`, `window._activeHubIsLegacy()`.
- **Clave de almacenamiento POR HUB**: `window._hubKey(base)` devuelve la
  clave BASE sin sufijo para Liverpool/Toñín (datos + sync EXISTENTES
  intactos) y `base+'_'+id` para el resto (Arsenal → `..._alvaro`).
- **PROHIBIDO duplicar la pantalla** `s-munich` ni clonar sus IIFEs por
  hub: se REUTILIZA parametrizada. La caja Arsenal navega a `s-arsenal`,
  que tiene un MutationObserver que (pre-paint) hace
  `setActiveHub('alvaro'); go('s-munich')`. La caja Liverpool y la grid de
  EQUIPOS fijan el hub vía `data-hub` (handler del grid) + onclick inline.

### Resolutores hub-aware (default = Liverpool, byte-for-byte intacto)

`_psHumanName`, `_psHumanLogicName`, `_psHumanShield`/`_psCanonCrest`,
`_hubTeamName` (wallet + calendario misc_body_2), `_hubSelName`, el header
`_boxOv/_canonHubName/_slot` (+ `_mkHubResync`), `_bayernSquad` (exclusión
ya no descarta el club activo), los `_hubName` de las cajas de partidos, y
los prefill/save de Nivel/Forma del modal HUD: TODOS leen el HUB ACTIVO
(`_activeHub().screen/club`) ANTES de los fallbacks legacy. Si el hub es
Toñín, devuelven EXACTAMENTE lo de antes (Liverpool).

### Stores namespaced por hub (cada uno re-resuelve en `hubchange`)

| Dato | Clave base | Re-resolución |
|---|---|---|
| Cursor calendario | `liverpool_preseason_v1` (+cookie `livps`) | IIFE pretemporada: reasigna KEY + `_psInvalidateCache` |
| HUD 💼🪙💊 | `bayern_hud_overrides_v1` (+cookie `bayhud`, IDB row) | IIFE HUD: reasigna KEY/KV_URL, RESET gate hidratación + cache, re-pull |
| Trofeos | `bayern_trofeos_v1` | IIFE trofeos: reasigna + re-hidrata + render (no-Liverpool arranca VACÍO). Sync RECENCIA + EMPTY-GUARD por hub (ver abajo) |
| Objetivos config | `munich-obj-overrides-v1` | IIFE config: render DIFERIDO (tras reasignar progreso) |
| Objetivos progreso | `munich-obj-state-v4` | IIFE progreso: reasigna LS_OBJ SÍNCRONO + re-crea `_kvBlobSync` |
| Derbys temporadas/partidos | `bayern_derbys_seasons_v1` / `bayern_derbys_matches_v1` | 3 IIFEs (render/seasons/matches): reasignan + re-pull + render |

- Plantilla (`s-bayern-plantilla`) y card "Próximo partido" NO necesitan
  clave propia: resuelven el club/selección por los resolutores hub-aware
  (Arsenal = roster real de `ligaExt_liga-ea-sports` + selección Brasil).

### Servidor (app.py) — heredar TODAS las protecciones, sin duplicarlas

`_kv_hub_base(key)` mapea una variante `base_<id>` a su BASE, y se usa en
`_kv_is_allowed`, el branch `_KV_RECENCY_BLOB_KEYS`, los special-cases
`bayern_hud_overrides_v1` (rev guard + field-merge + anchor-guard) y
`munich-obj-state-v4` (empty-guard), y el merge de `_STATE_RECENCY_BLOB_KEYS`.
El cursor: `_is_cursor_key(k)` cubre `liverpool_preseason_v1_<id>` con el
MISMO merge monotónico (`_cursor_winner`). Derbys: viajan por `/api/state`
(merge_dict genérico acepta claves arbitrarias) + unión cliente. Tests en
`tests/test_api.py::TestMultiHubKeys`.

### Vitrina de trofeos POR HUB — RECENCIA + EMPTY-GUARD (obligatorio, 2026-06-27)

**Bug (fotos usuario 2026-06-27, «Arsenal-Álvaro» + «Real Madrid-Acsa»)**:
el admin tenía la vitrina de trofeos llena para esas cajas de mister y al
volver salían a **0** («no se han guardado»). El sync de `bayern_trofeos_v1`
(+ variantes por hub) era frágil: `save()` era fire-and-forget SIN sello ni
reintentos, el server hacía **last-write-wins** (un POST vacío de un móvil
recién wipeado borraba la vitrina de toda la red), y la hidratación usaba una
heurística que podía saltar el GET. Mismo patrón «se pierde al borrar datos»
que el HUD/derbys/sanciones.

**Fix** — la vitrina hereda la durabilidad documentada:
- **Cliente** (`misc_body_1.html`, IIFE trofeos): cada `save()` (acción
  EXPLÍCITA del admin tras PIN 747) sella `updatedAt` en `<STORE_KEY>_ts`,
  POSTea el formato `{updatedAt, items}` con **3 reintentos** y marca
  `authoritative:true` (gana por recencia, puede vaciar a mano).
  `_hydrateTrofFromServer` SIEMPRE hace GET y resuelve por recencia: adopta
  el server si es más nuevo (o el local solo trae defaults), o RE-EMPUJA el
  local autoritativo para CURAR el server (basta un dispositivo con la
  vitrina para restaurarla en todos). Acepta el formato legacy (array crudo).
- **Servidor** (`app.py`, `_trofeos_merge` en `api_kv_set`, vía
  `_kv_hub_base == 'bayern_trofeos_v1'`): **EMPTY-GUARD** (un POST vacío
  NO-autoritativo nunca borra una vitrina almacenada con datos) +
  **RECENCIA** (sello mayor gana; stale no pisa lo nuevo). La acción
  autoritativa del admin SÍ puede vaciar. Acepta legacy bare-array. Tests en
  `tests/test_api.py::TestTrofeosMerge`.

**Reglas a respetar**:
- **PROHIBIDO** que el sync de la vitrina vuelva al fire-and-forget sin
  sello / al last-write-wins del server. Toda variante por hub
  (`bayern_trofeos_v1_<id>`) hereda RECENCIA + EMPTY-GUARD vía `_kv_hub_base`.
- **PROHIBIDO** que un POST vacío NO-autoritativo borre la vitrina: solo la
  acción autoritativa del admin (✏️/🗑 tras PIN) puede vaciarla.
- La importación de backup (V2) re-sube TODAS las variantes
  `bayern_trofeos_v1_<id>` (no solo la base) autoritativas, para restaurar el
  palmarés de las 6 cajas.

### Reglas a respetar

1. **PROHIBIDO** romper el camino Liverpool: si `_ACTIVE_HUB` es Toñín,
   `_hubKey` devuelve la clave BASE y TODO resuelve como antes. Cualquier
   refactor debe preservar esto (los tests del HUD/cursor base no bajan).
2. **PROHIBIDO** duplicar físicamente la pantalla `s-munich` o sus IIFEs por
   hub. Se parametriza por `_ACTIVE_HUB` + `_hubKey`. Toda caja de mister
   nueva se habilita igual que Arsenal (registro + `data-hub` + redirect).
3. **PROHIBIDO** que un store de hub NUEVO use la clave base cruda: debe
   pasar por `_hubKey(base)`, re-resolverse en `hubchange`, y —si va a KV—
   añadir su base a `_KV_HUB_BASE_KEYS` (servidor) para heredar el merge.
4. **PROHIBIDO** que un writer AUTOMÁTICO del HUD escriba antes de hidratar
   tras un `hubchange`: el listener resetea el gate (`_hudHydrated=false`)
   y re-pull; trátalo como cold-start (reglas 5-7 del HUD siguen vigentes).
5. El gate de objetivos (reglas 14-17) sobrevive: al cambiar de hub se
   re-crea `_objStateSync` ligado a la nueva clave; `liverpoolObjEarnings`
   no deflacta hasta que el nuevo progreso HTTP-hidrate.

## El ACTA de un partido NUNCA se pierde en la fusión cross-device — TODA competición (obligatorio, 2026-06-06)

**Regla general (petición usuario 2026-06-06, «que no vuelva a pasar con
las estadísticas de NINGÚN torneo, Copa, Liga, competición»)**: en un
juego con 6 móviles + PC tocando los mismos datos, una copia
**solo-marcador** (un dispositivo que guardó el partido ANTES de cargar
el motor de actas `genMatchEventsEnhanced`, o re-guardó solo el resultado)
NUNCA debe machacar los `events`/goleadores/MVP que otro dispositivo ya
generó para el MISMO partido. Es la causa raíz de «el partido se jugó
(marcador OK) pero las Estadísticas salen vacías».

### Principio único (espejo en TODAS las fusiones de resultados)

A igualdad de MARCADOR, entre dos copias de un mismo partido la que trae
el acta (`events`/`acta`/`scorers`) GANA, aunque su sello (`ua`/updatedAt)
sea menor. Un marcador DISTINTO sí decide por recencia (una corrección
legítima del resultado no se revierte). Es ADITIVO: nunca borra un acta
ya presente.

### Dónde está implementado (cada fuente de eventos del juego)

| Competición(es) | Fuente de eventos | Fusión protegida |
|---|---|---|
| Torneos: Selecciones (`spv*`/`sfn*`), Mundial 2032 (`mundial-48`), Mundialito (`tour_mundial_v1`), Verano (`jg/asia/sct/pss/tx*`) | `tour_<id>_v1.cfg.results[mk].events` | **Servidor** `sync_merge.py::_pick_result` (a igualdad de marcador gana el acta) + **cliente** `_tourLoad`→`_tourBackfillActaFromLocal` |
| Copa del Rey | `copa_state.resultados[ronda][idx].events` | **Servidor** `sync_merge.py::copa_state_merge` (unión por ronda+idx, `_copa_pick_result`) en `/api/copa/state_set` |
| Liga EA Sports | `liga_results[<j\|home\|away>].events` (= `ef_liga38_v4`) | **Servidor** `app.py::_preserve_results_acta` tras el `merge_dict` de `/api/state` (restaura el acta que un `events:[]` entrante vaciaría) |
| Resto de Ligas / Hypermotion / 1ªRFEF / Superliga / Resto del Mundo | stats per-jugador en `team.players[]` (NO en `results[].events`; `ligaExtSimular` solo guarda `{h,a,gh,ga,tah,...}`) | `_lx_merge_teams` fusiona por equipo por `updatedAt` (las stats viajan en el equipo, no en el acta) |
| Europeas KO (UCL/UEL/UECL fase final, Recopa, USC, Inter) | bracket en `recopa_state_v1`/`inter_state_v1`/etc. + `cfg.results` en vivo | `rebuildPlayerStatsStore` las reconstruye EN VIVO desde su estado; sin fusión KV propia (estado local) |

### Las estadísticas SOBREVIVEN al borrado de datos / cambio de móvil

No basta con que el acta no se pierda en la fusión: tras un borrado de
datos de navegación (o en un móvil nuevo) el cliente debe poder
RECONSTRUIR las estadísticas desde el servidor. Para cada fuente:

- **Torneos** (`tour_*_v1`): la cfg (con `results[].events`) está en KV
  y se rehidrata en `_tourLoad`; `rebuildPlayerStatsStore` Source 3 +
  `_tourCollectStatsForTour` leen `cfg.results` en vivo.
- **Liga EA Sports**: `liga_results` (con events) viaja en `/api/state`;
  el poll global (`hydrateLigaStateFromBackend`) lo escribe en
  `ef_liga38_v4` y Source 2 reconstruye.
- **Copa del Rey**: `copa_state` (con `resultados[].events`) viaja en
  `/api/state`; el poll global Y la pantalla de la Copa lo espejan a
  `localStorage['copa_state_v1']`, y **`rebuildPlayerStatsStore` Source 5**
  lo itera → bucket `copa` (dedup `copa|`+`_mkPJ` compartido con Source 1).
- **Intercontinental**: `inter_state_v1` (Source 4), ya durable.

**PROHIBIDO** que una caja de stats dependa SOLO de `LIGA_PLAYER_MATCH_STORE`
(memoria volátil): toda comp cuyos events no viajen ya en `tour_*_v1`/
`ef_liga38_v4` necesita su propia Source durable en `rebuildPlayerStatsStore`
leyendo el estado persistido (como Source 4 inter / Source 5 copa).

### Reglas a respetar

1. **PROHIBIDO** que CUALQUIER fusión de resultados (servidor o cliente,
   actual o futura) decida solo por recencia/last-write ignorando el acta.
   A igualdad de marcador, la copia con `events` gana SIEMPRE.
2. **Toda competición/fuente NUEVA** que guarde `events` de partido debe
   heredar este principio en su punto de fusión (añadir el guard como en
   `_pick_result`/`copa_state_merge`/`_preserve_results_acta`) Y, si sus
   events no viven ya en una fuente durable que el rebuild lea, añadir su
   Source en `rebuildPlayerStatsStore`.
3. Tests obligatorios en `tests/test_sync_merge.py` (torneos + Copa) y la
   verificación del helper de Liga. No bajarlos.
4. El guard es ADITIVO: nunca borra ni cambia un acta ya presente, solo
   restaura la que el merge habría perdido con el mismo marcador.
5. **PROHIBIDO** quitar el mirror `copa_state_v1` (poll global + pantalla
   Copa) o la Source 5: sin ellos la caja Estadísticas de la Copa se
   vacía tras un borrado de datos / cambio de móvil.

## El ACTA de un partido de torneo NUNCA se pierde en la fusión cross-device (obligatorio, 2026-06-06)

**Bug (fotos usuario 2026-06-06, «Road Copa Asia»)**: un torneo de
Selecciones (Rondas Previas, slot `spv*`, formato `qualifier-route`)
tenía partidos JUGADOS y con 📋 ACTA visible (España 1-2 Líbano,
Birmania 1-0 Vietnam, España 4-2 Hong Kong…), pero la pantalla
**«Road Copa Asia - Estadísticas»** (`s-tour-stats`) salía «Sin datos
todavía» en TODAS las categorías (Goleadores, Portería imbatida,
Tarjetas).

### Causa raíz

La card del torneo y la caja de Estadísticas leen el MISMO cfg
(`_TOUR_CACHE[tourId]` / `_tourLoadCachedSync`). El botón 📋 ACTA solo
se pinta si `res.events` es un array no vacío (`_tourActaPanelHtml`),
así que ver ACTA demuestra que los eventos SÍ estaban en `cfg.results`.
La caja de stats salía vacía porque, entre ver la card y abrir las
stats, el `_tourLoad` ASÍNCRONO traía del servidor una copia del cfg
con los partidos SOLO-MARCADOR (sin `events`) y machacaba la cache:

- **Servidor** (`sync_merge.py`, `_pick_result`): al reconciliar un
  mismo `matchKey` presente en dos dispositivos, decidía SOLO por
  `played` + `ua` (sello ms por partido). Como los resultados de torneo
  **no estampan `ua`**, ganaba el último que escribió — y si esa copia
  era solo-marcador (un móvil que guardó el partido ANTES de cargar el
  motor de actas `genMatchEventsEnhanced`, o re-guardó solo el marcador),
  **descartaba los `events` ya generados en otro móvil**. El partido
  sobrevivía (marcador → clasificación OK) pero el acta/goleadores/MVP
  desaparecían → caja de stats vacía.

### Fix — el acta es dato que NO se pierde (espejo de la regla de escudos)

- **Servidor** (`_pick_result`): si dos copias jugadas tienen el MISMO
  marcador pero una trae acta (`events`/`acta`) y la otra es
  solo-marcador, **gana SIEMPRE la que tiene acta**, aunque su `ua` sea
  menor. Un marcador DISTINTO sigue decidiendo por `ua` (una corrección
  legítima del resultado no se revierte). Tests en
  `tests/test_sync_merge.py`.
- **Cliente** (`_tourLoad` → `_tourBackfillActaFromLocal`): al adoptar
  el cfg del servidor, rellena el acta de cada partido que el server
  trajo solo-marcador desde la copia LOCAL que sí la tiene, SIEMPRE que
  el marcador coincida. Nunca pisa un acta que el server ya traiga ni
  toca partidos con marcador distinto. Defensa en profundidad: la caja
  de stats no se vacía al sincronizar aunque el server tarde en
  converger.

### Reglas a respetar

1. **PROHIBIDO** que `_pick_result` vuelva a decidir SOLO por
   `played`+`ua` ignorando el acta: a igualdad de marcador, la copia con
   `events` gana. Eso evita que un guardado solo-marcador borre los
   goleadores.
2. **PROHIBIDO** que `_tourLoad` adopte el cfg del servidor sin pasar
   por `_tourBackfillActaFromLocal` (rellena el acta perdida desde el
   local con el mismo marcador).
3. Todo result de torneo debe llevar `events`+`home`+`away` (lo estampan
   `_tourAttachActa` para IA y `_tourSaveHumanResult` para humanos). La
   caja `s-tour-stats` los agrega vía `_tourCollectStatsForTour`
   (`_mundialStatsRobustScan` → `_tourStatsFromCfgResults`), que ya tiene
   backfill por si faltaran — pero la fuente NO debe perderlos en el sync.

## El HUD del hub (🪙💊💼) se SINCRONIZA por `/api/kv` (recencia), NUNCA por `/api/state` (obligatorio, 2026-06-06)

**Bug (fotos usuario 2026-06-06, «Liverpool-Francia»)**: el usuario
reinicia la temporada, abre el editor 🖍 EDITAR HUD y pone 🪙 2500 ·
💊 4 · valoración objetivo 8.80. **Borra los datos de navegación** y al
volver la FECHA (01 May) está bien pero los **valores del HUD vuelven a
los defaults** (🪙 0 · 💊 8 · /9.10). «Los valores no se han cambiado.»

### Causa raíz

`bayern_hud_overrides_v1` (🪙 presupuesto · 💊 puntos de fisio · 💼
valoración + objetivos) era el ÚNICO blob de running-total que aún vivía
en el blob **TOP-LEVEL de `/api/state`**, compartido por DECENAS de
writers concurrentes:

- El poll de Liga / `competition_state` POSTea `/api/state` cada pocos
  segundos (read-modify-write del estado completo).
- `/api/state/reset-liga` («Reiniciar Temporada») hace
  `save_global_state(data, replace=True)` con el estado ENTERO cargado
  — y la rama `replace=True` **NO aplica la corrección por recencia**
  (esa solo está en la rama `replace=False`).

Cualquier write ajeno que leyera la fila ANTES del save del HUD y la
escribiera DESPUÉS **descartaba** el 🪙/💊/💼 recién guardado. Y como el
HUD se sube **UNA sola vez** (no se re-pushea solo), ese clobber era
**PERMANENTE**: tras borrar datos de navegación, la rehidratación
(`_serverPull`) no encontraba nada en el server y el HUD caía a los
defaults hardcoded. La **FECHA** (`liverpool_preseason_v1`) SÍ sobrevive
porque su cursor tiene merge MONOTÓNICO dedicado **+ re-push frecuente**
(self-healing); el HUD no tenía ninguna de las dos cosas.

### Fix — mover el HUD a su PROPIA fila KV con merge por recencia

`bayern_hud_overrides_v1` pasa al patrón canónico de todos los demás
blobs «sobrevive al wipe» (bajas/sanciones, mensajes, CASH…):

- **Servidor** (`app.py`): la clave está en `_KV_ALLOWED_EXACT` **y** en
  `_KV_RECENCY_BLOB_KEYS`. `/api/kv/<key>` guarda **una fila por clave**
  → CERO contención con otros writers; `reset-liga` (que reescribe la
  fila principal) ni la toca. Merge por RECENCIA: el blob con `updatedAt`
  mayor gana ENTERO (un consumo legítimo de PI / suma de presupuesto no
  se revierte; un POST stale no pisa lo más nuevo).
- **Cliente** (`misc_body_1.html`, IIFE del HUD admin): `_serverPush`
  POSTea `/api/kv/bayern_hud_overrides_v1` con `{value:o}`; `_serverPull`
  hace GET del KV y adopta por recencia (`_adoptFromServer`). Si el KV
  está vacío, **fallback de migración** `_legacyStatePull` lee el blob
  legacy de `/api/state` UNA vez, lo adopta y lo re-sube al KV.

### Reglas a respetar

1. **PROHIBIDO** devolver `bayern_hud_overrides_v1` (ni ningún
   running-total / consumible del HUD) al blob top-level de `/api/state`.
   Vive en su fila `/api/kv` con merge por recencia.
2. **PROHIBIDO** quitar `bayern_hud_overrides_v1` de `_KV_ALLOWED_EXACT`
   o de `_KV_RECENCY_BLOB_KEYS`, o cambiar `_serverPush`/`_serverPull`
   para que vuelvan a `/api/state`. Reintroduce el clobber.
3. Todo store nuevo de running-total / consumible del hub hereda este
   patrón: fila KV propia + recencia, NUNCA el blob compartido de
   `/api/state` (que sufre read-modify-write races + `replace=True`).
4. `save()` SIEMPRE estampa `updatedAt` (ms) en el blob antes de subir —
   sin él la recencia del server no puede arbitrar.

### GATE de hidratación — el HUD no se sube antes de reconciliar (obligatorio, 2026-06-07)

**Bug (queja usuario 2026-06-07, «los iconos 💼🪙💊 que les da la
gana»)**: el admin editaba el HUD pero, tras borrar datos de navegación
o estar 3 días fuera, los valores volvían a los defaults. La recencia +
fila KV propia NO bastaban: faltaba el GATE de hidratación que ya es
obligatorio para todo store `_kvBlobSync` (bajas/sanciones, 2026-06-04).

**Causa raíz**: tras un wipe / en otro móvil, `_BAYERN_HUD_CACHE` está
vacío. Un writer AUTOMÁTICO de running-total —`_bayernHudCreditMoney`
(premio de torneo / coste de sim), `liverpoolObjEarnings` (objetivos)—
corría ANTES de que `_serverPull` reconciliara, leía un base vacío/stale
(money≈0) y hacía `save()` SELLADO con `updatedAt` FRESCO ⇒ ganaba la
recencia del server y, en el siguiente pull, el local "más nuevo" se
re-subía ⇒ **clobber PERMANENTE** de lo que el admin puso → defaults.

**Fix** (`misc_body_1.html`, IIFE del HUD admin):
- `_hudHydrated` (+ espejo `window._BAYERN_HUD_HYDRATED`) se marca SOLO
  al recibir una RESPUESTA HTTP del KV en `_serverPull` (no en fallo de
  red: si el server está caído, los créditos quedan EN COLA, nunca
  clobberean).
- `_serverPush(o, force)`: una escritura AUTOMÁTICA (`!force`) NO sale al
  server antes de hidratar.
- Writers automáticos DIFERIDOS: `_bayernHudCreditMoney` acumula su delta
  en `_pendingMoneyDelta` y se aplica de golpe en `_markHydrated` sobre
  el base ya reconciliado (ni se pierde ni clobberea); `_bayernHudMerge`
  automático y `liverpoolObjEarnings` se rearman vía
  `window._bayernHudOnHydrate`.
- La acción EXPLÍCITA del admin (✅ Guardar / ♻ Restablecer /
  📅 Reiniciar Temporada) pasa `force:true` + `_markHydrated()`: SIEMPRE
  persiste (su intención es autoritativa) y gana por recencia.
- `focus`/`pageshow`/`visibilitychange` re-pullean: recuperan un
  cold-start que falló las 3 ventanas de boot y CONVERGEN al volver tras
  estar fuera (la queja «3 días sin entrar»).

**Reglas a respetar**:
5. **PROHIBIDO** que un writer AUTOMÁTICO de running-total del HUD
   (`_bayernHudCreditMoney`, `_bayernHudMerge` sin `force`,
   `liverpoolObjEarnings`, o cualquiera nuevo) escriba al server antes de
   `_hudHydrated`. Debe diferirse (cola de delta / `_bayernHudOnHydrate`).
6. **PROHIBIDO** marcar `_hudHydrated` en un fallo de red (sólo con
   respuesta HTTP del KV). Marcarlo a ciegas reintroduce el clobber con
   base vacío cuando el server tarda en responder.
7. Toda acción EXPLÍCITA del admin que escriba el HUD pasa `force:true`
   (bypassa el gate). Todo writer automático nuevo hereda el gate.

### Escritura AUTORITATIVA + re-push self-heal + BD persistente (obligatorio, 2026-06-07)

**Bug (2 fotos usuario 2026-06-07)**: admin pone día 11 de mayo
💼/8.80 · 🪙 2350 · 💊 3, sale el toast verde **«✓ HUD guardado»** (el
POST devolvió 200), pero al **borrar datos de navegación** el HUD
**«vuelve a datos antiguos»** (la FECHA 11 May sí persiste).

**Dos causas combinadas**:
1. **Recencia rechazaba el guardado del admin por clock-skew**. En un
   parque de 6 móviles + PC, un dispositivo con el **reloj adelantado**
   dejaba en el server un valor viejo con `updatedAt` FUTURO. El guardado
   del admin (reloj correcto, ts menor) era **RECHAZADO** por el merge de
   recencia — aunque el POST devolvía 200 (el toast verde MENTÍA) — y al
   borrar datos el GET devolvía ese valor viejo.
2. **El server pierde el blob (SQLite EFÍMERO)** y otros dispositivos
   re-empujan valores VIEJOS, así que el móvil que borró datos recupera
   uno de ésos.

**Fix**:
- **Escritura AUTORITATIVA** (`misc_body_1.html` + `app.py`): la acción
  explícita del admin (✅/♻/📅) manda `authoritative:true` en el POST.
  El **servidor** (`api_kv_set`, blobs de `_KV_RECENCY_BLOB_KEYS`) la
  guarda GANANDO siempre y **sella `updatedAt` con SU PROPIO reloj** por
  encima de lo almacenado (`max(server_now, stored+1, client)`). Una
  sola fuente monotónica ⇒ el reloj adelantado de otro móvil ya no puede
  revivir un valor viejo. Los writers normales (re-push / running-total)
  siguen por recencia pura.
- **Re-push frecuente self-heal** (`_serverRepush`, cada 25s + al volver
  el foco): cada dispositivo con valores re-sube el blob TAL CUAL (sin
  re-sellar `updatedAt`), manteniendo el server poblado tras un reset de
  la BD efímera — igual que la FECHA.

**Regla a respetar**:
8. **PROHIBIDO** quitar el flag `authoritative` de la acción del admin ni
   el sello con reloj del SERVER en `api_kv_set` para los blobs de
   recencia: sin él, el reloj adelantado de otro dispositivo vuelve a
   rechazar/revertir el guardado del admin.
9. La BD del server DEBE ser persistente (Postgres vía `DATABASE_URL`, o
   volumen montado). Con SQLite efímero el re-push solo enmascara el
   problema mientras haya un dispositivo activo con el valor correcto.
   Verificable en `/api/debug` (`"postgresql"` = ✅ · `"sqlite"` = ⚠️).

### CAUSA RAÍZ REAL — el seed de PI del arranque borraba el HUD (obligatorio, 2026-06-08)

**Bug (captura `/api/kv/bayern_hud_overrides_v1` del usuario)**: con la
BD ya PERSISTENTE (Postgres, confirmado en `/api/debug`), el server tenía
guardado **SOLO** `{"pi":8,"updatedAt":...}` — sin `money`/`rating`/
`ratingTarget`/`moneyTarget`. Un escritor borraba TODO el HUD dejando
solo el PI por defecto.

**Causa raíz**: en `part2/misc_body_2.html` había, a +30 ms del arranque,
`setTimeout(function(){ athSetMedicalPI(athGetMedicalPI()); ... }, 30)`.
A los 30 ms el HUD AÚN NO ha hidratado del server, así que
`athGetMedicalPI()` devuelve el **default 8** (state legacy / DOM SSR) y
`athSetMedicalPI(8)` hace `_bayernHudMerge({pi:8})` sobre una base
VACÍA ⇒ `{pi:8}` se guarda en el server y BORRA money/rating/objetivos.
Y se repetía en CADA arranque (cada móvil), así que el `pi` volvía a 8
y el resto desaparecía. Era el clobber que ninguna capa anterior
(recencia, authoritative, re-push) podía evitar porque el propio seed
corría antes de hidratar.

**Fix**: el seed de PI del arranque se DIFIERE con
`window._bayernHudOnHydrate(...)`. Tras hidratar, `athGetMedicalPI()`
devuelve el PI REAL ya adoptado del server y el re-guardado es un no-op
que conserva los demás campos. Si el API del HUD no existe, NO persiste.

**Reglas a respetar**:
10. **PROHIBIDO** que NINGÚN seed/refresh del arranque
    (`athSetMedicalPI(athGetMedicalPI())` u otro) persista el HUD
    (`_bayernHudMerge`/`save`/`athSetMedicalPI`) antes de hidratar. Todo
    seed de arranque que escriba el HUD debe ir dentro de
    `window._bayernHudOnHydrate(...)`.
11. **PROHIBIDO** que un writer de un SOLO campo del HUD (p.ej. `{pi}`)
    corra sobre un `load()` vacío: el merge resultante (`{pi:8}`) borra
    el resto de campos. El gate de hidratación lo previene; no añadir
    writers de campo suelto fuera de ese gate.

### Defensa a prueba de balas en el SERVER — field-merge del HUD (obligatorio, 2026-06-08)

**Por qué**: con 6 móviles + PC, no se puede confiar en que TODOS tengan
desplegado el último cliente. Un móvil con código viejo puede mandar un
POST PARCIAL (`{pi:8}`) que borraba money/rating/objetivos del server
(captura usuario: el server tenía SOLO `{"pi":8}`). La defensa definitiva
va en el SERVER, donde un solo punto protege a todos los clientes.

**Fix** (`app.py`, `api_kv_set`, SOLO la clave `bayern_hud_overrides_v1`):
los writes NO-authoritative hacen **FIELD-MERGE que PRESERVA campos**: los
que el POST no trae se rellenan desde lo almacenado, así que un write de
un solo campo NUNCA vacía el resto. Recencia en los campos compartidos
(`new_ts >= old_ts` ⇒ el entrante actualiza sus campos; más viejo ⇒ se
conserva el almacenado entero). La acción AUTORITATIVA del admin sigue
siendo REEMPLAZO total (puede limpiar campos: ♻ Restablecer).

**Regla a respetar**:
12. **PROHIBIDO** que el HUD no-authoritative haga REEMPLAZO total en el
    server (volvería a permitir que un `{pi:8}` parcial borre el resto).
    Field-merge SIEMPRE para no-authoritative; replace SOLO para
    authoritative (intención explícita del admin de limpiar).

### El 💊 PI volvía a 8 — rechazo de POST parcial + boot sin seed (obligatorio, 2026-06-08)

**Bug (2 fotos usuario 2026-06-08)**: tras el field-merge, money/rating ya
SOBREVIVÍAN al borrado de datos, PERO el **💊 PI volvía SIEMPRE a 8**. El
field-merge preserva los campos que el POST NO trae, pero el seed de
arranque SÍ trae `pi` (=8 por defecto), así que ese campo se aplicaba.

**Causa**: (1) el seed de arranque `athSetMedicalPI(athGetMedicalPI())`
seguía mandando `pi=8` (en un móvil sin actualizar, o leído antes de
hidratar); (2) el server aplicaba ese `pi` aunque el POST fuera parcial.

**Fix**:
- **Cliente** (`part2/misc_body_2.html`): se ELIMINA por completo el seed
  de PI del arranque (no aporta nada — `apply()` ya pinta el PI desde la
  hidratación). El boot solo refresca la lista de lesionados y cablea el
  botón del menú médico; NO toca el PI ni persiste el HUD.
- **Server** (`app.py`, `api_kv_set`, `bayern_hud_overrides_v1`): un POST
  no-authoritative que NO trae NINGÚN campo ANCLA
  (`money`/`rating`/`ratingTarget`/`moneyTarget`) pero el almacenado SÍ
  los tiene, se RECHAZA ENTERO (no toca ni `pi`). Un blob legítimo
  siempre trae campos ancla (los writers reales mergean sobre el cache
  completo ya hidratado), así que solo el seed parcial cae aquí.

**Regla a respetar**:
13. **PROHIBIDO** reintroducir un seed/persistencia de PI en el arranque
    (`athSetMedicalPI` en boot) o quitar el rechazo de POST parcial sin
    campos ancla: cualquiera de los dos hace que el 💊 vuelva a 8.

### El HUD lleva un RELOJ LÓGICO `rev` monotónico (obligatorio, 2026-06-11)

**Bug (3 fotos usuario 2026-06-11, «Liverpool/Francia»)**: el admin tiene
🪙 4500 (PI 5), juega y el presupuesto baja a 4350 (running total) — la
FECHA avanza 01→15 May —, pero al **borrar datos de navegación** el HUD
entero vuelve a defaults (🪙 **0**, 💊 en blanco). La **FECHA (15 May)
SOBREVIVE al wipe** en la misma pantalla → la BD del server ES persistente;
es el blob del HUD el que se pierde, NO la fecha.

**Causa raíz**: el cursor de fecha (`liverpool_preseason_v1`,
`_STATE_CURSOR_KEYS`) sobrevive porque tiene un **monotónico** (`dayIdx`):
el server RECHAZA cualquier push con un `dayIdx` MENOR, así que ninguna
copia stale/clock-skew puede arrastrarlo hacia atrás. El HUD solo tenía
**recencia por reloj de pared** (`updatedAt`). En un parque de **6 móviles
+ PC**, un dispositivo con **JS viejo en caché** (otro móvil sin recargar,
aún con bugs de deflación), con el **reloj adelantado**, o con el blob en
**defaults**, re-empuja un HUD deflactado/vacío que **GANA por recencia** y
machaca el server para todos. Al borrar datos, el GET trae ese blob
machacado → 🪙 0.

**Fix — `rev` (reloj lógico, espejo del `dayIdx`)**:
- **Cliente** (`misc_body_1.html`, `save()`): cada cambio REAL incrementa
  `rev` sobre el máximo conocido (cache + localStorage). `_adoptFromServer`
  decide «local más nuevo» PRIMERO por `rev` (no por `updatedAt`): si el
  server trae un `rev` mayor lo ADOPTA aunque el `ts` local sea (falsamente)
  mayor; solo re-sube si el `rev` local es mayor. El re-push self-heal
  (`_serverPush` directo, sin `save()`) re-asserta el MISMO `rev`, no bumpea.
- **Servidor** (`app.py`, `api_kv_set`, `bayern_hud_overrides_v1`): un push
  no-authoritative con `rev` MENOR que el almacenado se **RECHAZA ENTERO**
  (cliente viejo sin `rev`=0, stale, o clock-skew). `rev` mayor ⇒ field-merge
  (preserva campos); `rev` igual ⇒ recencia por `ts` + field-merge. La acción
  **AUTORITATIVA** del admin (✅/♻/📅) bumpea `rev = max(old,new)+1` y GANA
  siempre — una vez el admin guarda desde un cliente actualizado, ningún
  móvil sin actualizar puede volver a pisar el HUD. Tests en
  `tests/test_api.py::TestBayernHudRevGuard`.

**Reglas a respetar**:
13b. **PROHIBIDO** quitar el `rev` del HUD ni volver a arbitrar el merge del
     server SOLO por `updatedAt`: sin el monotónico lógico, un cliente
     stale/viejo/clock-skew vuelve a machacar el 🪙 por recencia (el HUD es
     tan frágil como la fecha es robusta — la diferencia es el monotónico).
13c. **PROHIBIDO** que el re-push self-heal bumpee `rev` (debe re-assertar el
     mismo) ni que un writer automático lo decremente. Solo `save()` (cambio
     real) lo incrementa; la acción autoritativa del admin lo bumpea +1 para
     ganar a cualquier copia, incluidos clientes sin `rev`.

### El progreso de OBJETIVOS no se sube VACÍO tras un re-render (obligatorio, 2026-06-11)

**Bug (2 fotos usuario 2026-06-11, «Liverpool»)**: el admin edita el
🪙 presupuesto (5025) y cumple objetivos (1/68 ✅, 💼 0.28), pero al
**borrar datos de navegación** vuelve TODO a 0 (🪙 0 · 💼 0.00 ·
objetivos 0/68) — sólo los TARGETS (8.80 /1300€) sobreviven.

**Causa raíz**: `boot()` del editor de objetivos hace un pull aditivo de
`munich-obj-overrides-v1` (`_hydrateOverridesFromServer`). Cuando el
server trae overrides que el dispositivo no tiene (caso típico tras un
WIPE: local vacío, server con datos ⇒ `changed=true`) re-renderiza
`#ath-obj-club` con `renderAll`, dejando TODOS los ✅ DESMARCADOS (HTML
nuevo). Acto seguido llamaba a `athObjCount()` —que está ENVUELTO por
`patchAthObjCount`— ANTES de restaurar los ✅ con `loadObjState`
(`_munichObjAfterRender`). Ese `athObjCount` prematuro disparaba:
(1) `saveObjState` → subía un progreso VACÍO que MACHACABA
`munich-obj-state-v4` en el server (objetivos → 0/68), y (2)
`liverpoolObjEarnings` con `done=0` → hundía 🪙/💼, y el field-merge del
server los machacaba CONSERVANDO los targets (de ahí que sólo el target
sobreviva). Tras el wipe la hidratación recuperaba ese blob ya en blanco.

**Fix**:
- (`misc_body_1.html`, callback de `_hydrateOverridesFromServer`): tras
  `renderAll` se llama SIEMPRE a `_munichObjAfterRender` (que hace
  `loadObjState` → restaura los ✅ → `athObjCount`), NUNCA un
  `athObjCount` suelto sobre el DOM recién re-renderizado.
- (`liverpoolObjEarnings`): GATE de hidratación del PROGRESO (`_objStateSync.isHydrated()`),
  espejo del gate del HUD. No recalcula 🪙/💼 leyendo `done` del DOM
  hasta que `munich-obj-state-v4` haya reconciliado; se rearma vía el
  adopt del obj-state + un poll (cubre el caso local-autoritativo sin adopt).

**Reglas a respetar**:
14. **PROHIBIDO** contar/persistir objetivos (`athObjCount`/`saveObjState`/
    `liverpoolObjEarnings`) sobre un `#ath-obj-club` recién re-renderizado
    por `renderAll` SIN haber restaurado antes los ✅ con `loadObjState`
    (vía `_munichObjAfterRender`). Un conteo sobre el DOM desmarcado sube
    un progreso VACÍO que machaca el server.
15. **PROHIBIDO** que `liverpoolObjEarnings` recalcule 🪙/💼 desde `done`
    (DOM) antes de que el PROGRESO (`munich-obj-state-v4`) haya hidratado.
    Gate `_objStateSync.isHttpHydrated()` + rearme; igual que el gate del HUD.

### El gate del recálculo exige RESPUESTA HTTP, no la `isHydrated` genérica (obligatorio, 2026-06-11)

**Bug (queja usuario 2026-06-11, «añado presupuesto y guardo; al borrar
datos de navegación los contadores de presupuesto vuelven a 0»)**: el
guardado AUTORITATIVO del 🪙 llegaba bien al server y el GET tras el wipe lo
restauraba, pero acto seguido `liverpoolObjEarnings` lo PONÍA A 0.

**Causa raíz**: el gate de la regla 15 usaba `_objStateSync.isHydrated()`.
En `_kvBlobSync.hydrate` (`index.bundle.js`) `st.hydrated` se marca `true`
**también en el `.catch` de un FALLO DE RED** (es deliberado para poder
re-empujar la copia local al volver la conexión). Si tras el wipe el GET del
PROGRESO (`munich-obj-state-v4`) fallaba pero el del HUD NO (cold start de
Railway, un GET sí y otro no), `isHydrated()` daba `true` SIN haber
restaurado los ✅ → `done=0` aunque el server tuviera objetivos cumplidos.
`liverpoolObjEarnings` restaba TODO el aporte de objetivos
(`prevObjMoney` − 0, hasta 68×25 = 1700) a `money`, lo CLAMPEABA a 0 y
empujaba ese 0 al server (field-merge no-authoritative) → el presupuesto
«vuelve a 0».

**Fix**: `_kvBlobSync` expone `isHttpHydrated()` (true SOLO al recibir una
RESPUESTA HTTP del GET, jamás en el `.catch` de red). `liverpoolObjEarnings`
y su poll de rearme gatean con `isHttpHydrated()` en vez de `isHydrated()`:
un fallo de red deja el recálculo EN COLA hasta que el server responda (el
re-pull por focus/intervalo reintenta), nunca deflaciona sobre un progreso
sin reconciliar. Espejo de la regla HUD 6 («PROHIBIDO marcar hidratado en un
fallo de red» para los recálculos de running-total).

**Reglas a respetar**:
16. **PROHIBIDO** gatear un recálculo de running-total (que DEFLACIONA un
    valor leyendo el DOM/estado adoptado) con `_objStateSync.isHydrated()`:
    ésta es `true` en fallo de red. Usar `isHttpHydrated()` (solo respuesta
    HTTP). `isHydrated()` sigue siendo correcto para gatear el PUSH (re-subir
    la copia local al reconectar).
17. **PROHIBIDO** marcar `httpOk` en el `.catch` de `_kvBlobSync.hydrate`.
    Solo en la rama de respuesta HTTP recibida.

### Un objetivo NO se concede si su competición no ha empezado / no ha acabado (obligatorio, 2026-06-29)

**Bug (3 fotos usuario, «Liverpool 2/68 falsos»)**: la pantalla
**Objetivos del Club** marcaba como cumplidos «1 jugador entre los {9} máx
goleadores Liga» y «1 jugador marca en {3} partidos en UCL» (✅ verde) en
plena PRETEMPORADA (calendario 03 Jun, todo a 0). «La liga ni ha acabado y
Champions ni ha empezado.» Eran objetivos MANUALES (sin `data-auto`) que un
estado guardado / sync stale dejó marcados, y la auto-evaluación
(`_munichAutoEval`) nunca los corregía porque solo tocaba los `data-auto`.

**Fix** (`misc_body_1.html`, IIFE de objetivos del club):
- **«máx goleadores Liga» y «máx MVP Liga» son AUTO `data-auto`**
  (`liga-top-scorer` / `liga-top-mvp`), métricas de CLASIFICACIÓN **FINAL**:
  solo se conceden cuando la Liga ha TERMINADO (`ligaComplete`, 38 J) y un
  jugador del hub está en el Top N del ranking LIGA-WIDE
  (`_ligaWideRank` sobre `ef_player_stats_liga_only_v1`). Se quitó el
  marcador «(Si/No)» del texto por defecto para que `useAuto` los active.
- **GUARD «temporada NO empezada»**: `_munichAutoEval` calcula
  `_hubSeasonStarted()` (¿el hub jugó ≥1 partido competitivo? señales:
  clasificación Liga EA, Superliga, los 11 stores `ef_player_stats_*`, y la
  liga externa del hub no-legacy). Mientras NO haya arranque, DESMARCA todo
  ✅ falso (incluidos los manuales). SOLO desmarca, nunca marca, y SOLO sin
  arranque → en temporada en curso no toca nada (no pierde progreso real).
  Hub-aware → vale para las 6 cajas humanas.

**Reglas a respetar**:
18. **PROHIBIDO** conceder un objetivo de CLASIFICACIÓN FINAL (máx
    goleadores/MVP/posición/dif. goles de Liga) antes de que la competición
    termine (`ligaComplete`). Van en `LIGA_FINAL`; a mitad de temporada se
    mantienen SIN marcar aunque ahora mismo se cumplan.
19. **PROHIBIDO** que un objetivo de cualquier competición quede ✅ cuando el
    hub no ha empezado la temporada (`_hubSeasonStarted()` falso). El guard
    solo DESMARCA y solo sin arranque; nunca marca ni toca una temporada en
    curso (no clobberea progreso real ni el server — save no-authoritative).
20. **PROHIBIDO** que el guard haga un push AUTORITATIVO (bypassando el
    empty-guard cliente/server): una falsa «no empezada» transitoria
    (stores aún sin reconstruir al cargar) podría borrar progreso real. El
    display se corrige en cada `_munichAutoEval`; la persistencia sigue las
    reglas 14-17.

## La caja de CLUB nunca muestra bajas de SELECCIÓN ni de equipos ajenos al partido (obligatorio, 2026-06-28)

**Bug (foto usuario 2026-06-28, «Atlético Madrid · ISRA», torneo de
verano Joan Gamper)**: en la pantalla **«BAJAS PARA EL PARTIDO»** de un
partido de CLUB, la sección 🚑 LESIONADOS mostraba a **«Johan Manzambi ·
Suiza»** (un jugador de la SELECCIÓN de Suiza — ni Atlético Madrid ni la
selección humana del mister, Noruega). Regla del usuario: cada caja
muestra SOLO su equipo humano y su selección humana; **no pueden salir
otros lesionados, sancionados ni amonestados**.

### Causa raíz (doble)

1. **Contaminación del store de CLUB**: un partido del Mundial 2032 entre
   selecciones IA (Suiza vs X) registraba la lesión en `LESION_STORE`
   (store de CLUB). El override de `_registrarLesionesDesdeEventos` solo
   desvía a `LESION_STORE_SEL` las selecciones **humanas**
   (`esSelHumana`); las IA caían al motor de club (`_origReg`) →
   `LESION_STORE['Johan Manzambi'] = {equipo:'Suiza', …}`. Igual para
   sanciones (`calcularSancionesPartido` → `_origCalc` con teamName de
   selección IA).
2. **Filtro de display débil**: `_ppPlayerBelongsToMatch` (el filtro de
   la previa/overlay de CLUB) hacía `if (!teams) return true` («mostrar
   TODO») y su match por substring sufría el bug `nt.indexOf('')===0`
   (un equipo del partido VACÍO casaba con CUALQUIER jugador).

### Fix (`static/js/index.bundle.js`)

- **`window._isSeleccionName(name)`** — detector de selección nacional
  (humana o IA): `_esSelHumana` ∪ nombre EXACTO normalizado en
  `selecciones_squad_v1` (`_selSquadLoad`). Si la lista no hidrató,
  devuelve `false` (jamás borra/oculta un club por error).
- **`_ppPlayerBelongsToMatch` ESTRICTO**: (a) si el equipo del jugador es
  una selección → `false` (la caja de CLUB nunca muestra selecciones);
  (b) objetivo = los 2 equipos del partido, o el club del HUB si no hay
  contexto (NUNCA «mostrar todo»); (c) substring tolerante exigiendo
  AMBOS lados ≥ 3 chars (mata el bug de la cadena vacía).
- **Prevención en origen**: `_registrarLesionesDesdeEventos` (motor de
  club) DESCARTA eventos cuyo equipo sea selección; `calcularSancionesPartido`
  (motor de club) devuelve `[]` si `teamName` es selección.
- **Purga de contaminación existente**: `window._purgeSeleccionFromClubStores`
  elimina de `LESION_STORE`/`BAJA_STORE`/`SANCION_STORE.__global` toda
  entrada cuyo equipo sea selección (idempotente, persiste si cambia).
  Corre al hidratar (lesiones+sanciones del server), al abrir el overlay
  (`_refreshSancionInjList`) y diferida al arranque.

### Reglas a respetar

1. **PROHIBIDO** que `_ppPlayerBelongsToMatch` (o cualquier filtro de la
   caja de CLUB) vuelva a `return true` cuando no hay equipos del partido,
   ni a hacer substring sin exigir longitud mínima en ambos lados (el bug
   `indexOf('')` reintroduce el leak).
2. **PROHIBIDO** que un partido de SELECCIÓN (humana o IA) registre baja
   o sanción en el store de CLUB. Las humanas van al motor `_sel*`; las IA
   se DESCARTAN. Todo motor/ruta nueva de club hereda el gate
   `_isSeleccionName(teamName)`.
3. **PROHIBIDO** que la caja de un mister muestre bajas de OTRA caja
   humana o de una selección. El filtro resuelve el equipo del jugador y
   lo compara con los equipos del partido / club del hub.
4. Generaliza a las 6 cajas humanas (no hardcodea Atlético/Noruega): el
   detector y el filtro son genéricos por equipo/selección.

## El decremento de lesiones de CLUB es alias-tolerante (obligatorio, 2026-06-05)

**Bug (fotos usuario 2026-06-05, «Harvey Davies 4 · Kaide Gordon 6»)**:
dos lesionados del hub (Liverpool) salían en el 💉 MENÚ DE TRATAMIENTO
RÁPIDO con un nº FIJO de partidos restantes (4 y 6) que **nunca bajaba**
por más partidos que jugara el usuario. «Pasan los partidos y no se van
restando automáticamente.»

### Causa raíz

`decrementarPorPartido(teamName, compKey)` (`static/js/index.bundle.js`,
`LESION_STORE_UTILS`) — el único punto que resta 1 partido a las
lesiones de club cuando el equipo juega (lo llaman gm-modal `gmEndMatch`,
ml-card `_mlFinishMatchGen`, `simularJornadaIA`, copa-engine) — comparaba
el equipo de la baja con el del partido en **ESTRICTO**
(`if (eq !== target) return;`). El slot del hub se renombró
**Bayern→Liverpool** y los distintos resolutores del nombre del hub
NO coinciden entre sí (`_mkHubTeamName` / `_psHumanLogicName()` pueden
dar el lógico `"Bayern Munich"`, `_findBayernRow().name` da el display
`"Liverpool"`, y el partido puede llegar con cualquiera de los dos).
Así, una baja guardada como `"Liverpool"` no casaba con un partido que
llegaba como `"Bayern Munich"` (o al revés) y **jamás se decrementaba**.
La capa de DISPLAY ya era tolerante (`_hubTeamMatches`, bug 2026-06-05,
mismo Harvey Davies); la de DECREMENTO no.

### Fix

`decrementarPorPartido` resuelve la equivalencia por **MISTER del
registro canónico** (`window._mhSameMister`, alias-safe Bayern↔Liverpool),
**gateado a CLUBES humanos** (`window._isHumanClubCanonico` en AMBOS
lados) para no cruzar club↔selección del mismo mister. Una baja con
`equipo` vacío (que la UI asume del hub) la resta SOLO el partido del
propio hub (`_psHumanLogicName()`/`_mkHubTeamName`), nunca un partido de
otra caja humana ni de un IA. El match exacto previo se conserva.

### Reglas a respetar

1. **PROHIBIDO** volver al match ESTRICTO `eq !== target` en
   `decrementarPorPartido`. El equipo del partido y el `equipo` de la
   baja deben compararse con la MISMA tolerancia que el display
   (alias por mister + `equipo` vacío = hub).
2. **PROHIBIDO** ensanchar el match con substring crudo o `_mhSameMister`
   SIN el gate `_isHumanClubCanonico` en ambos lados: cruzaría las bajas
   de club con las de la selección del mismo mister (Liverpool↔Francia)
   o entre cajas con grafías parecidas.
3. Generaliza a las 6 cajas humanas (cada una resuelve su propio mister);
   no hardcodear Liverpool/Bayern en el decremento.

## Lesiones / sanciones (club + selección) se SINCRONIZAN al servidor — sobreviven al borrado de datos del navegador (obligatorio, 2026-06-04)

**Bug (fotos usuario 2026-06-04, «Kounde·Francia»)**: el usuario añade
a mano (editor azul 🖍 de la plantilla del hub, vista SELECCIÓN, PIN
7477) a **Jules Koundé (Francia) lesionado 1 partido**. El mensaje de
lesión aparece en la bandeja y la fila se marca. Pero al **borrar los
datos de navegación** TODO lo editado a mano de Kounde desaparece.

### Causa raíz

Los stores de baja/sanción vivían **SOLO en localStorage**, sin sync al
servidor:

- `ftbol_sel_sanciones_v1` — selecciones (`YELLOW_STORE_SEL` +
  `SANCION_STORE_SEL` + `LESION_STORE_SEL`).
- `ftbol_lesiones_v1` — club (`BAJA_STORE` + `LESION_STORE`).
- `ftbol_sanciones_v1` — club (`SANCION_STORE.__global`).

Al limpiar el navegador se vaciaba localStorage y, **sin copia en el
server**, no había de dónde recuperar. Mismo síntoma «se borra al
limpiar / cambiar de móvil» que ya resuelto para `selecciones_squad_v1`,
`menu_home_v1`, `munich-obj-overrides-v1`, etc.

### Fix — `_kvBlobSync` (localStorage = caché · server = fuente de verdad)

Helper genérico `window._kvBlobSync(key)` en `static/js/index.bundle.js`
(definido junto al store de lesiones de club). Cada uno de los 3 stores
lo usa con su `snapshot`/`adopt`/`isEmpty`:

- **`touch(updatedAt)`**: tras cada cambio real (lo llama el `_persist`
  del store), agenda un **POST debounced + 3 reintentos**. NO sube nada
  antes de hidratar (anti-wipe: un autosave temprano no debe pisar el
  server con un local recién vaciado).
- **`hydrate()`**: al arrancar, GET del server. Si el **local está
  vacío** (borrado de navegación) **o el server es más reciente**
  (`updatedAt`), **ADOPTA** el server y re-renderiza (plantilla del hub,
  lista de bajas, HUD). Si el **local es autoritativo** (no vacío y
  `updatedAt` >= server), lo **re-sube**. Recalcula el estado local
  DENTRO del `.then` (una edición hecha mientras volaba el GET no se
  pisa con el server viejo).
- **`seed(ts)`**: siembra el `updatedAt` cargado de localStorage ANTES
  de `hydrate` para que la comparación de recencia tras un reload normal
  sea correcta.

Cada blob persiste un `updatedAt` (ms). **Servidor** (`app.py`,
`api_kv_set`): las 3 claves están en `_KV_ALLOWED_EXACT` y en
`_KV_RECENCY_BLOB_KEYS` → **merge por RECENCIA**: el blob con
`updatedAt` mayor **gana ENTERO**. Un POST stale (otro móvil, request
perdido) nunca pisa una copia más nueva, y un **consumo legítimo**
(sanción decrementada, lesión cumplida) NO se resucita porque el blob
que lo decrementó tiene `updatedAt` mayor.

### El humano VE la baja al pulsar el jugador (vista selección incluida)

Segundo punto de la foto 2: al pulsar Kounde el humano debe ver **en
pantalla** que tiene 1 partido de lesión + el tipo. En `misc_body_1.html`
(IIFE de `#s-bayern-plantilla`):

- `_bedBajaDetail(name)` → `{state, n, reason}` leído de los stores
  REALES (cubre club **Y** selección; antes `_badges` solo leía
  `LESION_STORE` de club).
- `_bedBajaBadge(name)` pinta el badge `🩹/🟥/🟨 NP` en la fila (club +
  selección, uniforme). Se quitó el badge de lesión club-only de
  `_badges` para no duplicar.
- El panel `_bedOpenBaja` muestra «Baja actual: <tipo> · N partido(s) —
  <motivo>» y pre-rellena el contador con los partidos restantes.

### Reglas a respetar

1. **PROHIBIDO** que un store de baja/sanción (club o selección) viva
   SOLO en localStorage. Todo store nuevo de este tipo debe usar
   `_kvBlobSync` + estar en `_KV_ALLOWED_EXACT`/`_KV_RECENCY_BLOB_KEYS`.
2. **PROHIBIDO** sustituir el merge por recencia del server por una
   unión por-entrada: las sanciones/lesiones se CONSUMEN (se borran al
   cumplirse), y una unión las resucitaría. El blob `updatedAt` mayor
   gana entero.
3. **PROHIBIDO** subir al server antes de hidratar (`touch` lo gatea con
   `st.hydrated`). Sin ese gate, un autosave temprano tras un wipe
   pisaría el server con el local vacío.
4. **PROHIBIDO** que la baja deje de VERSE en la plantilla del hub. El
   badge sale de `_bedBajaDetail`/`_bedBajaBadge` (club + selección), no
   de `_badges` (que solo conoce el club).
5. Toda caja de humano nueva hereda esto automáticamente (los stores son
   genéricos por equipo/selección; el badge y la sync no hardcodean
   Liverpool/Francia).

## Un RE-SORTEO de torneo NO machaca un cuadro con partidos jugados — anti-clobber + recuperación (obligatorio, 2026-06-25)

**Bug (fotos usuario 2026-06-25, «Mundial 2032 Selecciones»)**: con el
**80% de la fase de grupos** jugada en 6 móviles + PC (Francia 3-1
Senegal, Inglaterra 0-2 Panamá, Iraq 0-4 Noruega…), de repente **se
borró TODO y aparecieron grupos DISTINTOS** (Grupo A pasó a
Camboya/EE.UU./India/Nepal, todo 0/6). «Estaba todo guardado, qué ha
pasado.»

### Causa raíz

El Mundial 2032 es un torneo `format='mundial-48'`: los 12 grupos de 4
salen de `cfg.teams` **EN ORDEN** (`teams.slice(g*4, g*4+4)`), y los
resultados se indexan por matchKey `g<g>_<jor>_<mi>`. Si el ORDEN de
`cfg.teams` cambia, cambian los grupos Y los matchKeys dejan de
corresponder. Un re-sorteo (manual roster editor `sr-ok`, `_drawTeams`,
o el split del Mundialito) genera un `cfg.teams` nuevo con `results={}`.

El clobber lo amplificaba la fusión: en `tour_cfg_merge`
(`sync_merge.py`), cuando las firmas de equipos diferían
(`new_sig != old_sig`) se devolvía SIEMPRE **la copia con `updatedAt`
más reciente**. Un cuadro vacío recién re-sorteado en UN dispositivo
(updatedAt fresco, sin `resetAt`) **GANABA** y machacaba el 80% jugado
en los otros 6. Y en el cliente, `_tourLoad` adoptaba ese cfg vacío del
server (su `updatedAt` era mayor) y **sobrescribía su propio
localStorage**, así que ni el dispositivo que conservaba el torneo lo
salvaba → pérdida total, irreversible.

### Fix — el progreso jugado es lo que manda; el descarte exige `resetAt`

- **Servidor** (`tour_cfg_merge`, rama `new_sig != old_sig`): ya NO gana
  el `updatedAt`. Decide así: (1) si un lado trae `resetAt` **mayor**
  (re-sorteo DELIBERADO sellado), gana ese; (2) si no, gana la copia con
  **más partidos jugados** (`_count_played`); (3) empate de progreso →
  `updatedAt`. Un cuadro vacío sin `resetAt` NUNCA borra una fase de
  grupos jugada.
- **Cliente** (`_tourLoad`, `misc_body_1.html`): tras el GET, si el
  server trae OTRO sorteo (`_tourTeamsSig` distinta) con MENOS jugados y
  sin `resetAt` mayor, **NO lo adopta**: conserva el local y lo
  **RE-SUBE** (`_tourSave`) para CURAR el servidor. Basta con que UN
  dispositivo conserve el torneo para restaurarlo en todos
  (recuperación automática).
- **Cliente** (los 3 re-sorteos destructivos: `sr-ok`, `_drawTeams`,
  split Mundialito): `_tourConfirmAndStampRedraw` pide CONFIRMACIÓN si ya
  hay partidos jugados y SELLA `cfg.resetAt = Date.now()` para que un
  re-sorteo INTENCIONADO sí gane la fusión.
- Tests en `tests/test_sync_merge.py` (re-sorteo accidental vacío NO
  borra · re-sorteo deliberato con `resetAt` sí · recuperación
  cross-device).

### Reglas a respetar

1. **PROHIBIDO** que `tour_cfg_merge` vuelva a arbitrar el caso
   `new_sig != old_sig` SOLO por `updatedAt`. El progreso (`_count_played`)
   gana salvo `resetAt` deliberado más reciente. Sin esto, un re-sorteo
   accidental/stale machaca el torneo de todos.
2. **PROHIBIDO** que `_tourLoad` adopte un cfg del server con OTRO sorteo
   y menos jugados sin `resetAt` mayor: debe conservar el local y
   re-subirlo (la recuperación depende de esto).
3. **PROHIBIDO** que un re-sorteo destructivo (borra `results`) corra sin
   `_tourConfirmAndStampRedraw` (confirma + sella `resetAt`). Todo flujo
   NUEVO que regenere `cfg.teams` + vacíe `results` hereda este guard.

### Los torneos tienen SNAPSHOT `_protected` igual que las ligas (obligatorio, 2026-06-25)

**Petición usuario 2026-06-25 («quiero que todo se guarde igual que
liga»)**: las ligas (`ligaExt_<slug>`) tienen un snapshot server-side
`liga_ext_<slug>_protected` MONOTÓNICO (nunca acepta menos jugadores) que
sobrevive aunque todos los dispositivos pierdan su copia. Los torneos NO lo
tenían → un cuadro machacado en el server era irrecuperable.

**Fix** (`app.py`, `_tour_protected_guard`): cada save de `tour_<id>_v1`
mantiene un high-water mark `tour_<id>_v1_protected` MONOTÓNICO por **nº de
partidos JUGADOS** (`_count_played`). Un guardado que REGRESA (menos jugados)
SIN un `resetAt` más reciente se **RESTAURA** automáticamente desde el
snapshot — el torneo NO se pierde aunque el main quede vacío. Un reinicio
DELIBERADO (`resetAt` mayor) reemplaza el snapshot (nueva baseline). Corre en
el chokepoint del merge KV (tras `tour_cfg_merge`), incluido el primer save
(siembra el snapshot). Diagnóstico: `GET /api/tour-protected/<id>`.

**Reglas a respetar**:
4. **PROHIBIDO** que un save de `tour_<id>_v1` salte `_tour_protected_guard`:
   es la red de último recurso (espejo del `_protected` de las ligas). El
   snapshot solo baja con un `resetAt` deliberato, nunca por una regresión.
5. **PROHIBIDO** permitir POST externo a `tour_<id>_v1_protected` (el regex
   `_KV_ALLOWED_REGEX` exige `_v1$`, así que ya queda fuera): el snapshot lo
   escribe SOLO el servidor, o un cliente malicioso/viejo podría rebajarlo.

## El `resetAt` de torneo NO debe descartar partidos jugados DESPUÉS del reinicio (obligatorio, 2026-06-05)

**Bug (fotos usuario 2026-06-05, «Ronda Previa 1»)**: el usuario tenía
la clasificación de la Ronda Previa 1 (slot `spv1`) con 6/10 jornadas
jugadas (Noruega 6, Vietnam 6, Francia 3…). Al volver a entrar estaba
**TODO a cero (0/10)**. La clasificación se borró sola.

### Causa raíz

El servidor fusiona cada `tour_<id>_v1` con `tour_cfg_merge`
(`sync_merge.py`). El sello `resetAt` (que «Reiniciar Temporada» / el
botón ↺ Reset siembran) hacía que **solo se conservaran los resultados
de la copia que PORTASE ese mismo `resetAt`** (`side_reset >=
eff_reset`). Pero el guardado normal de partidas (`_tourSave` →
`_tourSaveHumanResult` / sim IA) **NO porta `resetAt`**. Así, si en el
pasado hubo CUALQUIER reinicio (sello en el servidor), TODOS los
partidos jugados después se **descartaban silenciosamente** en la
fusión del servidor → al rehidratar desde el servidor (otro móvil /
datos borrados / otra sesión) la clasificación volvía a 0.

### Fix — una copia aporta resultados si porta el sello O es POSTERIOR al reset

`tour_cfg_merge` ahora incluye los resultados de una copia cuando:
- **(a)** porta el `resetAt` máximo (`side_reset >= eff_reset`; si no
  hubo reset, `eff_reset=0` ⇒ ambas lo «portan» ⇒ unión pura), **o**
- **(b)** NO porta el sello pero su `updatedAt` (convertido a ms,
  `_iso_ms`) es **posterior** al `updatedAt` de la copia que reinició
  (`reset_copy_ms`) ⇒ son partidos jugados TRAS el reset y NO se pueden
  perder.

Una copia stale **anterior/igual** al reinicio sin sello sigue sin
resucitar (sigue cubierto por los tests). Defensa en el cliente:
`_tourSave` **conserva el `resetAt` máximo** entre la cfg entrante y el
persistido en localStorage (nunca lo baja), para que toda partida
jugada tras un reinicio viaje con el sello correcto.

### Reglas a respetar

1. **PROHIBIDO** volver a la regla «solo cuentan los resultados de la
   copia que porta el sello `resetAt`». El guardado de partidas no
   porta el sello → eso descarta partidos legítimos post-reset. La
   condición es «porta el sello **O** `updatedAt` posterior al reset».
2. **PROHIBIDO** que `_tourSave` baje/pierda el `resetAt` ya conocido
   por el dispositivo. Toma el MÁXIMO (un reset recién pulsado, con
   sello mayor en la cfg entrante, sí gana).
3. Mantener los tests de `tests/test_sync_merge.py` (incluido el caso
   «partidos jugados TRAS un reset previo NO se pierden» y «copia stale
   anterior al reset sigue sin resucitar»).

## Auto-log de Derbys — HvH club + SELECCIÓN, nunca se pierden (obligatorio, 2026-06-13)

**Bug (fotos usuario 2026-06-13, «Histórico Derbys»)**: el HUB (caja
`s-munich-derbys`) mostraba PJ=3 (agregado de TODAS las temporadas) pero
al abrir la temporada actual (32-33 Liverpool 🇫🇷) los derbys de
Liverpool/Francia jugados NO aparecían. «No se están guardando los
partidos.»

### Causa raíz (auto-log)

`_munichDerbyAutoLog` (`misc_body_1.html`) tenía 3 bloqueos:
1. **Gate HvH solo con `esHumano`**: `esHumano` lee el flag `isHuman`
   de Liga EA (5 clubes legacy) → devuelve `false` para SELECCIONES
   (Francia) y puede no ver el alias Liverpool. Un derby Francia-vs-Brasil
   (o Liverpool-vs-Arsenal) nunca pasaba el gate.
2. **Match de temporada solo por nombre de CLUB** (`local !== t`): un
   derby de SELECCIÓN (Francia) no coincidía con la temporada cuyo
   `teamName` es «Liverpool».
3. **Solo lo llamaba el gm-modal**: el flujo de las cards del calendario
   (`_mlFinishMatchGen`) no auto-logueaba.

### Fix

- **Gate HvH ampliado** (`_derbyIsHuman`): humano si `esHumano` **o**
  `_isHumanClubCanonico` (alias Bayern↔Liverpool) **o** `_esSelHumana` /
  `_isHumanSeleccionCanonica`. Liverpool-vs-IA / Francia-vs-IA NO se
  registra.
- **Match de temporada por club O su selección**: el mismo mister dirige
  club Y selección (`_mhFindMister(teamName).seleccion`), así que un
  derby de Francia se registra en la temporada «Liverpool». Comparación
  TOLERANTE (`_mDerbyTeamMatch`).
- **comp 'seleccion' automático** cuando ambos lados son selecciones
  humanas (el caller pasa 'liga'/'torneo').
- **`_mlFinishMatchGen` llama también** a `_munichDerbyAutoLog`
  (best-effort comp desde `st`); el helper filtra HvH + involucra-
  temporada + dedup, así que es no-op para no-derbys.
- **Pull ADITIVO** (`_serverPullAll` → `_mergeMatchMaps`): unión por id
  de partido por temporada (server gana en conflicto de id, local-only
  se conserva) + re-push si la unión es mayor. Antes el pull SOBRESCRIBÍA
  ciegamente localStorage con el server → un partido recién auto-logueado
  (POST en vuelo) se perdía con un GET stale.

### Causa raíz (HUB 3 vs detalle 1 — «el resto no sale», 2ª foto)

Dos fuentes DISTINTAS pintaban el contador del HUB y discrepaban:
- El **polling de 1 s** (`refresh` del IIFE `__MUNICH_DERBYS_HUB_READY`)
  contaba SIN el filtro `_matchIsHvH` → contaba TODOS (3).
- El **detalle de cada temporada** (`_renderSeason`/`_summaryForSeason`) y
  el override del HUB usan `_matchIsHvH`, que mandaba al gate `esHumano`
  los partidos LEGACY (sin `isHvH:true`). Los derbys históricos de Toñín
  con OTROS clubes/selecciones (Ath Bilbao, etc., añadidos a mano ANTES
  del sello `isHvH:true` de 2026-06-11) NO son `esHumano` canónicos →
  se OCULTABAN (1 visible) aunque el HUB los contara (3).

**Fix**: (a) `_matchIsHvH` en LECTURA solo excluye `isHvH===false`; todo
lo demás (incluido legacy sin flag) es VISIBLE — el gate REAL es al
ESCRIBIR (manual + auto-log sellan `isHvH:true`). (b) el `refresh` del
polling DELEGA en `munichDerbyAggregateAll` (fuente única) → HUB y
detalle SIEMPRE cuadran.

### Reglas a respetar

1. **PROHIBIDO** volver a gatear el auto-log SOLO con `esHumano`: no ve
   selecciones ni el alias Liverpool. Usar `_derbyIsHuman` (3 fuentes).
2. **PROHIBIDO** matchear la temporada solo por nombre de club: un derby
   de selección del mismo mister debe registrarse en la temporada del
   club (`_mhFindMister(...).seleccion`).
3. **PROHIBIDO** que `_serverPullAll` vuelva al overwrite ciego de
   `bayern_derbys_matches_v1`. La hidratación es unión aditiva por id.
4. El HUB `s-munich-derbys` AGREGA todas las temporadas (PJ/G/E/P del
   histórico); cada temporada muestra solo los suyos — no es un bug.
5. **PROHIBIDO** que el contador del HUB y el detalle usen agregadores
   distintos: el polling de 1 s DEBE delegar en `munichDerbyAggregateAll`
   (fuente única) o volverá a discrepar.
6. **PROHIBIDO** que `_matchIsHvH` (LECTURA) vuelva a filtrar por
   `esHumano`: ocultaba los derbys históricos legacy de clubes/
   selecciones no-canónicos. El filtro HvH va al ESCRIBIR (sello
   `isHvH:true`); en lectura solo se excluye `isHvH===false`.

## La pantalla "🔥 DERBYS" (`s-derbys`) reconoce a LOS 7 clubes + LAS 7 selecciones en CUALQUIER competición (obligatorio, 2026-07-03)

**Bug (2 fotos usuario, «Inter-Portugal-Rubén»)**: en la pantalla
`s-derbys` (la caja "🔥 DERBYS" del home, distinta de "Histórico Derbys"
`s-munich-derbys`), la sección **LIGA EA SPORTS** mostraba los derbys de
los 5 humanos clásicos, pero **ningún partido del Inter (Rubén, 7º
mister) contra otro humano** aparecía en ninguna competición europea
(Champions/Europa/Conference "fase de liga", Copa del Rey, Supercopa de
España, Nations League). Petición usuario: además, **las selecciones
humanas** (Francia/Brasil/Inglaterra/Noruega/Argentina/España/Portugal)
**deben salir siempre que se enfrenten**, tanto en la fase de Ligas
(Selecciones J1-J10) como en Eliminatorias (Mundial fase final). Y los
**Torneos de Verano** (Trofeo Joan Gamper) con enfrentamientos humanos
son obligatorios también.

### Causa raíz (2 bugs independientes en `_scanAllDerbies`, `part2/misc_body_2.html`)

1. **`_normalizeHumanName`** (fuentes 1 y 3 del scanner: `.match-live-wrap`
   y `.mrow` dentro de contenedores `cal-*` — Copa, Supercopa España,
   Champions, Europa, Conference, Nations League, y CUALQUIER `cal-sel*`
   de Selecciones) solo reconocía los **5 humanos legacy de Liga EA
   Sports** (`DERBYS_HUMANOS`, poblado desde `ligaExt_liga-ea-sports`).
   Inter (Rubén) y PSG (Izan) viven en ligas externas (`ligaExt_<slug>`
   de Resto de Ligas), NO en `ligaExt_liga-ea-sports` → nunca se
   reconocían como humanos ahí, así que sus partidos de Champions/Europa/
   Conference/Copa/Supercopa/Nations League contra otro humano quedaban
   invisibles. Ninguna selección (Francia, Portugal, …) estaba en esa
   lista tampoco → los derbys de Selecciones J1-J10 y Mundial fase final
   quedaban igual de invisibles ahí. La fuente 6 (scan de `tour_<id>_v1`,
   añadida 2026-06-13) sí usaba el registro canónico completo
   (`_isHumanForDerby`), así que Mundialito/Selecciones/Verano YA
   funcionaban — el hueco estaba en las fuentes 1 y 3.
2. **`cfg.fixture` de un torneo `format:'league'`** (Trofeo Joan Gamper,
   liga de 63 equipos) se construye LAZY al renderizar la pantalla del
   torneo (regla 2026-06-27, "El índice key→{home,away}…"). El bloque
   "asegurar fixtures" de la fuente 6 solo reconstruía `cfg.groupFixtures`
   (`_tourEnsureGroupFixtures`/`_tourEnsureRoadFixtures`/
   `_mundialGroupState`) — NINGUNO de los 3 hace nada para
   `format==='league'` (`_tourEnsureGroupFixtures` retorna `false` de
   inmediato si el format no es `groups-ko`/`league-ko`/`swiss`). Si el
   usuario abría la caja Derbys SIN haber abierto antes la pantalla del
   Joan Gamper esa sesión, `cfg.fixture` seguía vacío y NINGÚN partido
   (humano o no) del torneo se detectaba como derby.

### Fix

- `_normalizeHumanName` ahora cae, tras el match exacto contra los 5
  legacy, al **registro canónico completo**: `window._isHumanClubCanonico`
  (7 clubes, alias-safe Bayern↔Liverpool/PSG/Inter) →
  `window._esSelHumana` / `window._isHumanSeleccionCanonica` (7
  selecciones, incluye Portugal). Mismas funciones que ya usaba la
  fuente 6 (`_isHumanForDerby`) — una sola fuente de verdad para "¿es
  humano?" en las 6 fuentes del scanner.
- Nuevo `window._tourEnsureLeagueFixture` (expone la función ya existente
  `_tourEnsureLeagueFixture` de `misc_body_1.html`, usada por
  `_tourBackfillActasFromResults`). El bloque "asegurar fixtures" de la
  fuente 6 ahora, para `cfg.format === 'league'`, llama a
  `window._tourEnsureLeagueFixture(cfg, teams)` si `cfg.fixture` está
  vacío — el mismo round-robin determinista que usa el render de la
  pantalla, así los derbys de Joan Gamper (y cualquier torneo de verano
  `format:'league'`) se detectan en un cold-open de la caja Derbys.

### Reglas a respetar

1. **PROHIBIDO** que `_normalizeHumanName` (o cualquier normalizador de
   nombre humano nuevo en el scanner de Derbys) reconozca SOLO los 5
   humanos de `ligaExt_liga-ea-sports`. Debe caer siempre al registro
   canónico completo (`_isHumanClubCanonico`/`_esSelHumana`/
   `_isHumanSeleccionCanonica`) para que un mister/selección NUEVO se
   reconozca automáticamente sin tocar este archivo.
2. **PROHIBIDO** que el bloque "asegurar fixtures" de la fuente 6 llame
   solo a builders de GRUPO (`_tourEnsureGroupFixtures`/
   `_tourEnsureRoadFixtures`/`_mundialGroupState`) sin cubrir
   `format==='league'` vía `_tourEnsureLeagueFixture`. Sin él, todo
   torneo de verano en formato liga (Joan Gamper y futuros) queda
   invisible en un cold-open de la caja Derbys.
3. Toda caja de mister/selección humana NUEVA hereda el reconocimiento
   automáticamente (el registro `MISTERS_HUMANOS` es la fuente única);
   no hardcodear nombres nuevos en `DERBYS_HUMANOS` ni en el scanner.

## «Reiniciar Temporada» NUNCA borra Derbys / Trofeos / Plantillas (obligatorio, 2026-06-04)

**Regla usuario 2026-06-04 (3 fotos)**: el botón **«Reiniciar
Temporada»** (`window._bayernEditValuesResetCal` en `misc_body_1.html`,
modal admin PIN 747) **JAMÁS** debe reiniciar/borrar:

1. **Histórico de Derbys** — `bayern_derbys_seasons_v1` +
   `bayern_derbys_matches_v1` (pantalla `s-bayern-derbys`).
2. **Vitrina de Trofeos** — `bayern_trofeos_v1` (pantalla
   `s-bayern-trofeos`). Es un registro PERSISTENTE aditivo gestionado
   por el admin, **NO** se recalcula desde `cfg.results`.
3. **Plantillas del CLUB y la SELECCIÓN** — el club vive dentro de
   `ligaExt_liga-ea-sports.teams[].players` (roster + medias + flags);
   la selección en `selecciones_squad_v1`. **Solo** cambian si el admin
   las edita a mano.

### Qué SÍ limpia el reset (correcto, no tocar su scope)

Cursor del día (`liverpool_preseason_v1`), objetivos del club, HUD
(💼/🪙 a 0), **resultados** de los slots de torneo (`tour_*_v1`:
`results`/`bracket`/`koBracket`/`groupFixtures`/`fixture`/cursores/
`_prizesPaid` — **conservando `teams`/`format`/`formatConfig`**),
`pend_hvh_deferred_v1` y **TODAS las bajas/sanciones/lesiones (club +
selección)** (petición usuario 2026-06-07: «cuando se reinicia una
temporada no hay ni lesionados ni expulsados ni amonestados»). NO toca
`ligaExt_*` ni las 4 claves protegidas.

**Bajas a CERO**: `ftbol_lesiones_v1` (`BAJA_STORE`+`LESION_STORE`),
`ftbol_sanciones_v1` (`SANCION_STORE.__global`), el contador club
`YELLOW_STORE.__global`, y `ftbol_sel_sanciones_v1`
(`YELLOW_STORE_SEL`+`SANCION_STORE_SEL`+`LESION_STORE_SEL`+
`_FORMA_MATCH_STATES_SEL`). Se vacían en memoria, localStorage Y
servidor: cada uno es un blob `_kvBlobSync` con merge por recencia, así
que tras vaciarlo el `_persist` sella `updatedAt` nuevo y el flush
(`_bajaFlushClubNow`/`_bajaFlushSelNow` → `pushNow`) sube el blob VACÍO
→ el server lo adopta en todos los dispositivos (sin esto la
hidratación resucitaba las bajas al recargar / cambiar de móvil). Como
`cfg.results` también se vacía, `_selReconcileSuspensions` tampoco las
regenera.

### Blindaje implementado

`_bayernEditValuesResetCal` hace **snapshot ANTES** del reset de
`_PRESERVE_KEYS` y los **restaura AL FINAL** (solo si cambiaron). Defensa
en profundidad: aunque un cambio futuro añada por error un borrado, estas
claves se devuelven a su valor previo.

**HUB MULTI-MISTER (2026-06-15)** — `_PRESERVE_KEYS` cubre los DATOS
HISTÓRICOS (Histórico Derbys + Vitrina Trofeos) de las **6 cajas de mister
humano**, NO solo la del hub ACTIVO. Se construye desde `_PRESERVE_BASES =
['bayern_derbys_seasons_v1','bayern_derbys_matches_v1','bayern_trofeos_v1']`
× `window._MISTERS_HUMANOS` (Toñín/Liverpool = clave BASE sin sufijo; el
resto → `..._<id>`: `_alvaro`/`_acsa`/`_isra`/`_angel`/`_izan`) + la
plantilla de selección común `selecciones_squad_v1`. Así «Reiniciar
Temporada» —se pulse desde la caja que se pulse— jamás borra el palmarés ni
los derbys de NINGUNA caja (son históricos, se guardan para SIEMPRE,
petición usuario 2026-06-15).

### Reglas a respetar

1. **PROHIBIDO** añadir al reset cualquier `removeItem`/vaciado de las 4
   claves protegidas o de `ligaExt_liga-ea-sports` (donde vive la
   plantilla del club). Si hay que limpiar algo nuevo de temporada, va
   en su propia clave `tour_*`/cursor, nunca en estas.
2. **PROHIBIDO** quitar el snapshot+restore de `_PRESERVE_KEYS`. Toda
   clave nueva que represente histórico/palmarés/plantilla del usuario
   debe AÑADIRSE a `_PRESERVE_KEYS`, no quedar expuesta al reset.
2b. **PROHIBIDO** reducir `_PRESERVE_KEYS` a SOLO el hub ACTIVO: los
   derbys/trofeos de las 6 cajas se preservan SIEMPRE (snapshot por-hub de
   TODOS los misters vía `_PRESERVE_BASES × _MISTERS_HUMANOS`). Toda caja de
   mister NUEVA hereda la protección automáticamente al estar en el registro.
3. La plantilla del CLUB NO se mete en `_PRESERVE_KEYS` (congelaría la
   clasificación de Liga); se protege porque el reset no toca
   `ligaExt_*`. Si algún día el reset SÍ debe limpiar resultados de Liga,
   hacerlo preservando `teams[].players` (roster) explícitamente.

## La card del hub muestra SOLO el club + selección de SU caja (obligatorio, 2026-06-04)

**Bug (foto usuario 2026-06-04, caja «Liverpool/Francia»)**: la card
«Próximo partido» del hub (`#ps-stage` en `s-munich`) mostraba en el
Trofeo Joan Gamper **`RB LEIPZIG vs REAL MADRID`** — el partido de OTRA
caja humana (Real Madrid = Acsa), no el del Liverpool.

### Causa raíz

Con **varias cajas de humano** (Liverpool, Real Madrid, Arsenal… los 6
del `MISTERS_REGISTRY`), un torneo marca a TODAS con `isHuman:true`. Dos
resolutores de la card del hub identificaban al humano con un check
PLANO de `isHuman` y cogían **al primero que tropezaban**, no al de la
caja:

1. **Club** — `_slotIsH(t)` en `_realPair` (`misc_body_1.html`):
   `if (t.isHuman) return true` matcheaba a Real Madrid antes que a
   Liverpool.
2. **Selección** — `_selPair` recolectaba a las 6 selecciones humanas
   como candidatas y devolvía la PRIMERA con partido real ese día →
   podía mostrar el partido de Brasil/España en la caja de Francia.

### Fix — filtrar por el MISTER de la caja (registro `MISTERS_HUMANOS`)

Cada caja = un mister (Toñín = Liverpool **+** Francia). La fuente para
saber «de quién es este slot» es el registro, NO el flag `isHuman`:

- **`_slotIsH(t)`**: el slot es del hub solo si su nombre = club del hub
  (`_psHumanLogicName()`, + aliases legacy Bayern→Liverpool) **o** lo
  dirige el MISMO mister (`window._mhSameMister(hubName, t.name)`).
  `t.isHuman` por sí solo YA NO basta: si es de OTRO mister → `false`.
  Fallback legacy (acepta `isHuman`) solo si el hub no es un humano
  canónico (`_mhFindMister(hubName)` null).
- **`_selPair`**: tras construir `_candidates`, **filtro ESTRICTO** a la
  selección del mismo mister que el club del hub
  (`_mhFindMister(_psHumanLogicName()).seleccion`). Si la selección del
  hub no está en ningún Mundial activo, `_candidates` queda vacío → card
  «sin partido»/JUGADORES FUERA (NUNCA la selección de otra caja).
- **`_scanForCanonicalMundialMatch`** (watchdog de `_psRender`): solo se
  dispara por la selección DEL HUB (mismo mister), no por cualquier
  humana canónica — si no, mostraría «RECUPERAR PARTIDO» en días que
  juega otra caja.
- **Healing de `d.tour`** en `_realPair`: usa `_slotIsH` (hub-específico)
  para no fijar `d.tour` a un torneo donde el hub ni juega.

### Reglas a respetar

1. **PROHIBIDO** identificar al humano de la card del hub con un check
   plano `t.isHuman` / «el primer humano que aparece». Cada caja resuelve
   SU club (`_psHumanLogicName`) y SU selección (mister del registro).
   El discriminador es el MISTER (`_mhSameMister`/`_mhFindMister`), no
   `isHuman`.
2. **PROHIBIDO** que la caja de un mister muestre el partido de otra
   caja (otro club u otra selección). El filtro de `_selPair` es
   estricto; `_slotIsH` excluye a los humanos de otros misters.
3. **Toda caja de humano nueva** hereda esto automáticamente vía el
   registro `MISTERS_HUMANOS` (club↔selección por mister). No hardcodear
   nombres concretos en estos resolutores.

## Interfaz ÚNICA estilizada para TODO torneo · color = el de su caja (obligatorio, 2026-06-03)

**Petición usuario 2026-06-03 (fotos «Road Copa África» vs «Road Copa
Asia»)**: al crear un torneo nuevo (Fase Previa, Fase Final o Torneo
amistoso/Verano) la interfaz debe ser SIEMPRE la misma «videojuego»
(cabecera con gradiente + tabla estilizada `_mundialClasTableHtml` +
jornadas desplegables con escudos grandes `_mundialMatchCardHtml`), como
la foto 2. **Lo único que cambia es el color = el de la caja del torneo**:
Rondas Previas → AZUL (`_SEL_BLUE`, `c-roadq`), Rondas Finales → ROSA
(`_SEL_PINK`, `c-road`), Verano → TURQUESA (`_SUM_TURQ`, `c-summer`).

### Causa raíz

El formato `'league'` (1 sola tabla, sin grupos) caía a `_renderLeague`,
que pintaba la versión PLANA (`_standingsTableHtml` + `_fixtureCardsHtml`
con cajas blancas `.tour-jor`) — foto 1. Los demás formatos
(`groups-ko`/`league-ko`/`swiss` vía `_renderGroupsKO`, y
`qualifier-route` vía `_renderQualifierRoute`) ya usaban la card grande.

### Fix (todo en `templates/partials/misc_body_1.html`)

- `_bigGroupCardHtml` acepta `TH.leagueMode`: el torneo se pinta como UN
  grupo titulado **CLASIFICACIÓN** y los botones SIM/AVANZAR usan claves
  de liga (botón ▶ SIM con `data-league="1"` en vez de `data-group`;
  prefijo de match-key vacío).
- `_selGroupCardHtml(...,leagueMode)` y `_veranoGroupCardHtml(...,leagueMode)`
  propagan `TH.leagueMode`.
- `_renderLeague` ya NO pinta plano: dispatcha por `_tvBoardOf(tourId)`
  (`verano` → `_veranoGroupCardHtml`, resto → `_selGroupCardHtml`) con
  `g=0, gKey='', fix=cfg.fixture, advancePerGroup=0, leagueMode=true`.
- Handler `tour-sim-grp-btn` (router de clicks): si trae `data-league`
  simula TODAS las jornadas de `cfg.fixture` (prefijo vacío) en vez de
  `groupFixtures[g]`.

### Reglas a respetar

1. **PROHIBIDO** que `_renderLeague` vuelva a pintar la versión plana
   (`_standingsTableHtml` + `_fixtureCardsHtml`). Toda liga usa la card
   grande coloreada por board.
2. **PROHIBIDO** hardcodear el color de la card: sale del board
   (`_tvBoardOf`) = el de la caja. Toda comp/board nuevo debe tener su
   tema en el dispatch de `_renderLeague` igual que en `_renderGroupsKO`.
3. El click de partido (`data-league-key`) y el ▶ SIMULAR JORNADA
   (`tour-sim-jor-btn`, `data-key-prefix=''`) YA soportan claves de liga
   sin prefijo de grupo — no romper ese parseo.

## Sedes por torneo en la PREVIA + self-heal anti-pantalla-negra (obligatorio, 2026-06-03)

**Bug 1 (foto usuario «Road Copa Asia/América»)**: un torneo de
Selecciones (Rondas Previas) tenía **4 sedes elegidas** en el editor
(`cfg.stadiums` = Estadio Banorte, El Volcán, Olímpico Universitario,
MorumbIS) pero la **PANTALLA DE PREVIA** mostraba «🏟️ eFootball
Stadium» — un estadio que NO estaba entre los 4.

### Causa raíz (sedes)

`_renderPreviaMeta` (en `static/js/index.bundle.js`) SÍ resolvía la
sede del torneo por hash del matchKey (rotación entre `cfg.stadiums`),
pero **`_mmInjectEnv`** —que **repinta `#pp-env` 60 ms después** con el
clima/fecha del calendario— **REconstruía el estadio sin la rama de
`cfg.stadiums`**: caía a `getTeamStadium(local)` y, como las
selecciones no tienen estadio, a `'eFootball Stadium'`. Así pisaba la
sede correcta que `_renderPreviaMeta` ya había puesto.

### Fix (sedes)

- Helper ÚNICO `window._previaTourStadium(fallbackKey)`: rota por hash
  del `tourKey`/matchKey entre `cfg.stadiums` no vacíos del torneo de
  la previa actual (`_ppPreviaTeams.tourId`). Lo usan **AMBOS**
  `_renderPreviaMeta` y `_mmInjectEnv`, con la **MISMA prioridad**:
  `sc/sc-final` → **sedes del torneo** → `sel_fin_stadiums_v1` →
  `getTeamStadium(local)` → `eFootball Stadium`.
- **PROHIBIDO** que `_mmInjectEnv` (o cualquier repintado del env)
  resuelva el estadio sin pasar por `_previaTourStadium` primero. Las
  sedes de `cfg.stadiums` GANAN sobre `sel_fin_stadiums_v1` y sobre el
  estadio del local (regla 2026-06-01).

### Fix (sedes) — el gm-modal usa la MISMA fuente (obligatorio, 2026-06-06)

**Bug (foto usuario 2026-06-06, «España vs Birmania · Road Copa
Asia»)**: la PREVIA mostraba la sede correcta del torneo (🏟️ Estadio
Banorte) pero al abrir el partido el **gm-modal** (la pantalla de la
simulación) mostraba `🏟️ eFootball Stadium` en la cabecera.

**Causa raíz**: el bloque de estadio del gm-modal
(`gmOpen`, `#gm-venue-stadium`, en `part2/misc_body_2.html`) tenía
ramas para Supercopa España (`_scStadium`) y Mundial-48
(`_selFinStadiumFor`), pero **NINGUNA rama para `cfg.stadiums`** del
torneo. Para un torneo de Selecciones (Rondas Previas/Finales) o de
Verano caía al `else` → `getTeamStadium(_gm.home)` → como las
selecciones no tienen estadio → `eFootball Stadium`.

**Fix**: `_previaTourStadium` se refactoriza para delegar en un helper
AUTÓNOMO `window._tourStadiumFor(tourId, hashKey)` (no depende de
`_ppPreviaTeams`). El gm-modal llama
`_tourStadiumFor(_gm._tourId, _gm._tourKey)` con la **MISMA prioridad**
que la previa: `_scStadium` → **sedes del torneo (cfg.stadiums)** →
`_selFinStadiumFor` → `getTeamStadium(local)` → `eFootball Stadium`.
Como `_gm._tourKey === _ppPreviaTeams.tourKey === matchKey`, el hash
coincide y la previa y el gm-modal muestran la **MISMA** sede.

- **PROHIBIDO** que el bloque de estadio del gm-modal (o cualquier
  pantalla de partido nueva) resuelva la sede sin consultar
  `_tourStadiumFor(_gm._tourId, _gm._tourKey)` ANTES de
  `_selFinStadiumFor`/`getTeamStadium`. Las sedes de `cfg.stadiums`
  GANAN (igual que en `_renderPreviaMeta`).
- **PROHIBIDO** desincronizar el hashKey: el gm-modal debe hashear con
  `_gm._tourKey` (= el `matchKey` que pasa `_tourOpenHumanMatch`), el
  mismo que usa la previa, o mostrarían sedes distintas del mismo torneo.

**Bug 2 (foto usuario, pantalla negra)**: al pulsar **cualquier
caja/card** de un torneo de Selecciones la pantalla destino aparecía en
**NEGRO** y había que pulsar «atrás» en el móvil para verla.

### Causa raíz (pantalla negra)

Un overlay modal fullscreen (PREVIA `#prepartido-overlay`, BAJAS
`#sancion-overlay`, alias `#_copaAliasOv`) quedaba con `.show` de un
flujo anterior; su fondo casi-opaco (`rgba(0,0,6,.97)`) tapaba la nueva
pantalla. El `_blackScreenSafetyNet` documentado SÓLO limpia en
page-load / `pageshow` — nunca en navegación SPA. Por eso «atrás» (que
re-renderiza / re-dispara el cleanup) era el único modo de recuperarla.

### Fix (pantalla negra)

`renderScreen` (router en `index.bundle.js`) hace **self-heal en CADA
navegación SPA real** (cambio de pantalla, no refresco in-place ni
`window._iaRefreshInPlace`): cierra los overlays modales huérfanos
(`prepartido-overlay`, `sancion-overlay`, `_copaAliasOv`) y garantiza
que SIEMPRE haya una `.screen.active`.

- **PROHIBIDO** cerrar en este self-heal los splash/intro
  (`ucl-intro`, `comp-flash`, celebración, `sc-champion-ov`) ni el
  `gm-modal` de un partido vivo: el primero lo muestra el propio `go()`
  con su temporizador; el segundo es un partido en curso. El cierre se
  limita a overlays modales que sólo se abren vía `showPrePartidoOverlay`
  / `showSancionOverlay` (nunca vía `go()`), así que cerrarlos al
  navegar a OTRA pantalla siempre es correcto.

## Registro de torneos (Rondas Previas/Finales) — FUSIÓN, NUNCA se pierden entre dispositivos (obligatorio, 2026-06-03)

**Bug (foto usuario 2026-06-03)**: en la pantalla `🌐 Selecciones`
(`s-selecciones`) habían desaparecido las cajas que el usuario tenía
en **🛉 RONDAS PREVIAS** y **🏆 RONDAS FINALES** (entre ellas «Road
Copa Asia» y «Mundial 2032») **más las cajas ocultas** — la pantalla
mostraba «Sin rondas previas/finales. Pulsa 🖍 para crear una.».

### Causa raíz

Qué cajas se ven lo dicta `tour_registry_v1.visible` (lista de slots
`spv1..spv10` = Rondas Previas, `sfn1..sfn10` = Rondas Finales,
`tx1..tx8` = Torneos de Verano custom). El **nombre** custom de cada
caja («Road Copa Asia»…) vive en su cfg `tour_<id>_v1`, NO en el
registro.

`_tvHydrateReg` (en `misc_body_1.html`) hacía un GET a
`/api/kv/tour_registry_v1` y **PISABA ciegamente** `localStorage` con
`j.value` (`localStorage.setItem(_TV_REG_KEY, JSON.stringify(j.value))`).
Si el server traía una copia **stale/más corta** (otro dispositivo, o
un GET previo al POST que añadió las cajas), el registro local se
quedaba con solo los built-in → las Rondas Previas/Finales
desaparecían. Mismo patrón anti-wipe que ya documentado para
`selecciones_squad_v1` y los escudos de `ligaExt_*`.

### Segundo bug (2026-06-03, foto usuario): lo OCULTO volvía a salir

Al **ocultar** (act `del`) una caja de Torneos de Verano o de
Selecciones, al recargar la web **volvía a aparecer**. Causa: el
anti-wipe anterior hacía que `visible` **jamás encogiera** ni en el
cliente (`_tvRegMerge` añadía el slot remoto aunque estuviera oculto
en local) ni en el server (`_tour_registry_merge` re-añadía el id desde
`old_vis` y, con `hid -= seen`, borraba el tombstone). El «visible gana
siempre» era **incompatible** con poder ocultar: cualquier copia stale
que tuviera la caja en `visible` la resucitaba. El tombstone `hidden`
sin sello no podía ganar a un `visible` stale.

### Fix — FUSIÓN POR RECENCIA (tombstones con timestamp)

El estado visible/oculto de cada slot lo decide la **ÚLTIMA acción
real** del admin, no un «visible gana siempre». Dos sellos por slot:
`hiddenAt[id]` (ocultar) y `shownAt[id]` (mostrar/crear/restaurar). El
mayor gana: `hiddenAt > shownAt` ⇒ oculto; si no ⇒ visible.

- **Cliente** (`misc_body_1.html`, IIFE del registro de torneos):
  - `_tvRegMerge(localReg, remoteVisible, remoteHidden, remoteHiddenAt,
    remoteShownAt)`: fusiona los mapas de timestamps (máx por id),
    aplica **baselines de presencia** (`visible` legacy sin sello ⇒
    `shownAt=1`; `hidden` legacy ⇒ `hiddenAt=1`; los ms reales ganan a
    estos `1`) y decide visible/oculto por recencia. Conserva el orden
    local. Si difiere del server, `_tvHydrateReg` **re-sube** (converge).
  - `_tvHydrateReg` FUSIONA (con timestamps) en vez de pisar.
    **PROHIBIDO** volver al `setItem(j.value)` ciego.
  - `_tvEffHidden(reg)`: conjunto EFECTIVO de ocultos resuelto por
    recencia (con fallback al array `hidden` para datos sin sello). Lo
    usa `_tvRegLoad` para filtrar `visible` y para gatear la
    recuperación.
  - **Recuperación anti-wipe** en `_tvRegLoad`: `_tvSlotHasContent(id)`
    detecta slots con DATOS REALES en `localStorage` (equipos,
    resultados, o nombre/bandera/color custom). Cualquier slot con
    contenido que NO esté visible y NO esté en `_tvEffHidden` se
    **restaura**. Devuelve las cajas perdidas aunque el registro se
    hubiera pisado, **sin** resucitar lo ocultado a propósito.
  - **Acciones**: `del` sella `hiddenAt[id]=Date.now()` (+ array
    `hidden`); `restore`/`new` sellan `shownAt[id]=Date.now()` (y
    quitan de `hidden`).
- **Servidor** (`app.py`, `api_kv_set` → `_tour_registry_merge`): misma
  lógica de recencia. `visible` **no encoge por una copia stale**
  (anti-wipe: slot sin `hiddenAt` en ningún sitio se conserva) PERO un
  `hiddenAt` reciente **SÍ** retira el slot de `visible` (ocultar
  persiste). Persiste `hiddenAt`/`shownAt` para que el cómputo sea
  cross-device y converja.

### Reglas a respetar

1. **PROHIBIDO** que `_tvHydrateReg` (o cualquier ruta nueva) pise
   `tour_registry_v1` local con el GET sin fusionar. La hidratación es
   SIEMPRE fusión por recencia (timestamps).
2. **PROHIBIDO** volver al «visible gana siempre» / «`visible` jamás
   encoge» en cliente o server. Eso reintroduce el bug de las cajas
   ocultas que vuelven a salir. El estado lo decide la recencia
   (`hiddenAt` vs `shownAt`). El anti-wipe se preserva con el **baseline
   de presencia** (un slot solo-`visible`, sin `hiddenAt`, nunca se
   pierde) + la recuperación por contenido.
3. **PROHIBIDO** que `del`/`restore`/`new` dejen de sellar
   `hiddenAt`/`shownAt`. Sin sello, un POST stale puede ganar y
   reaparece (o desaparece) la caja. El array `hidden` se mantiene solo
   por compatibilidad/legacy.
4. La recuperación por contenido (`_tvSlotHasContent`) es la red que
   devuelve cajas ya perdidas — no quitarla. Está gateada por
   `_tvEffHidden` (recencia), que es lo único que frena la
   resucitación de lo ocultado explícitamente.
5. El nombre custom de cada caja vive en `tour_<id>_v1` (cfg), el
   registro solo lista ids — toda ruta que añada/quite cajas debe tocar
   AMBOS de forma coherente (cfg vía `_tourSave`, registro vía
   `_tvRegSave`).

## Escudos de Resto de Ligas — backfill por nombre, NUNCA se pierden entre dispositivos (obligatorio, 2026-06-02)

**Bug (foto usuario 2026-06-02)**: el amigo puso TODOS los escudos de
la Liga Grecia (`ligaExt_grecia`, «Super League») desde su PC, pero en
el móvil del usuario **no salía ninguno** (círculos grises en la tabla
de clasificación `renderTable` / `s-liga-ext`).

### Causa raíz

El escudo de cada equipo vive en `team.shield` (URL o dataURI). La
sincronización multi-dispositivo de `ligaExt_<slug>` resuelve conflictos
a nivel de DOCUMENTO o de EQUIPO-completo, no de campo:

1. **Cliente (`fetchData`, `misc_body_1.html`)**: el anti-wipe es
   **todo-o-nada**. Si la copia LOCAL del usuario tiene rosters más
   ricos (más jugadores) que la del amigo, el anti-wipe **conserva la
   copia local entera e IGNORA la del servidor** — incluidos los
   escudos que el amigo acababa de subir.
2. **Servidor (`_lx_merge_teams`, `app.py`)**: la fusión por equipo
   elige al ganador por `updatedAt`. Si el ganador de un equipo no
   trae escudo (copia de otro dispositivo con plantilla más reciente
   pero sin el escudo), el escudo se perdía aunque existiera en la otra
   versión del MISMO equipo.

### Fix — el escudo es IDENTIDAD: backfill por nombre normalizado

El `shield` es un dato de identidad: una vez puesto en CUALQUIER
dispositivo, **no debe desaparecer nunca** y debe propagarse a todos,
independientemente de qué lado «gane» el roster.

- **Cliente**: helper `_lextBackfillShields(target, source)` (justo
  antes de `fetchData`). Rellena el `shield` de cada equipo de `target`
  que NO lo tenga, tomándolo del equipo del MISMO nombre normalizado
  (`_lextNormName`) en `source`. **NUNCA pisa** un escudo ya presente.
  Se llama en las **3 rutas** de adopción de `fetchData`: (a) adopción
  temprana «servidor tiene ≥ local+6 equipos», (b) rama anti-wipe
  (conserva local → backfill desde servidor + re-push), (c) rama de
  aceptar servidor (backfill desde local).
- **Servidor**: tras elegir ganadores en `_lx_merge_teams`, se rellena
  el `shield` de los `out_teams` que se quedaron sin él tomándolo de la
  versión (old o new) más reciente que SÍ tenía escudo. Defensa en
  profundidad: si un dispositivo re-sube una copia sin escudos, el
  servidor los reconstruye.

### Reglas a respetar

1. **PROHIBIDO** que el anti-wipe de rosters (teams/players/perTeam)
   descarte escudos del servidor. El backfill debe correr SIEMPRE que
   se conserve la copia local.
2. **PROHIBIDO** que `_lextBackfillShields` PISE un escudo ya presente
   en el target (la edición del propio dispositivo manda; solo se
   rellenan los vacíos).
3. El backfill es por **nombre normalizado** (`_lextNormName` en
   cliente, `_lx_norm_name` en servidor), no por id (los ids se
   regeneran al re-pegar listas).
4. Toda nueva ruta de sync de `ligaExt_*` que adopte una de las dos
   copias debe pasar por el backfill de escudos antes de cachear/render.

## Resto del Mundo — la PLANTILLA de jugadores es IDENTIDAD igual que el escudo, nunca se pierde (obligatorio, 2026-07-02)

**Bug (foto usuario 2026-07-02, «Resto Mundo»)**: la clasificación de
Resto del Mundo mostraba los 44 equipos con nombre real pero **escudo
gris (vacío) y 0 PJ** en TODOS — como si nunca se hubiera editado ni
simulado nada, pese a que el admin ya había pegado plantillas y escudos.

### Causa raíz

Toda la red de recuperación de las 4 ligas con seed automático (Resto
Mundo / Montenegro / N. Irlanda / Albania — `_ensureRestoMundoSeed`,
`_ensureExtraLeagueSeed`, `_lextIdbTopupIfEmpty`,
`_lextRecoverResultsFromBackups`, documentada en las secciones
2026-06-28/06-30/07-01/07-02 de más arriba) solo comprobaba si faltaban
**`results`** (la clasificación/PJ). Ninguna capa comprobaba si faltaban
**`players`** (la plantilla) o **`shield`** (el escudo):

1. El seed en blanco escribe `teams` con NOMBRE pero `players:[]` /
   `shield:''`. Una vez ese blanco queda escrito en el `main`,
   `hasTeams` (solo mira `teams.length > 0`) es **true para siempre**,
   así que el `return` temprano de `_ensureRestoMundoSeed`/
   `_ensureExtraLeagueSeed` saltaba TODA la cadena de recuperación
   (`_protected` → snapshots → servidor), aunque esas copias durables
   tuvieran la plantilla y los escudos reales.
2. `_lextIdbTopupIfEmpty` y `_lextRecoverResultsFromBackups` solo
   miraban `results` para decidir si había «algo que curar»; con
   `results` presente (o ausente pero sin roster) nunca intentaban
   restaurar `players`/`shield`.
3. Ni el merge del cliente (`fetchData`) ni el del servidor
   (`_lx_merge_teams`) rellenaban `players` de la versión perdedora — el
   backfill de identidad de 2026-06-02/06-11 cubría `shield` y
   `stadium`, pero nunca `players`.

### Fix — la plantilla de jugadores hereda el backfill de identidad

- **`window._lextHasRosterOrShield(d)`** (nuevo, junto a
  `_lextIdbTopupIfEmpty`): true si CUALQUIER equipo del documento tiene
  `players.length` o `shield` no vacío. Es el detector de «esto es un
  seed en blanco, no datos reales».
- **`_lextBackfillRoster(target, source)`** (nuevo, espejo EXACTO de
  `_lextBackfillShields`): rellena `players` de cada equipo de `target`
  que venga vacío, tomándolo del equipo del MISMO nombre normalizado en
  `source`. NUNCA pisa un roster ya presente.
- **`_ensureRestoMundoSeed` / `_ensureExtraLeagueSeed`**: el guard
  `hasTeams` ya NO basta por sí solo — `isBlank` detecta el estado
  «equipos con nombre pero sin plantilla/escudos/resultados» y, aunque
  `hasTeams` sea true, fuerza el MISMO intento de recuperación
  (`_protected` → snapshots → servidor) que si `hasTeams` fuera false.
  Si se encuentra una copia rica, se hace backfill de `players` +
  `shield` + `results` SOBRE el documento actual (preservando
  `config.zones` ya editadas), en vez de reemplazar el documento entero.
- **`_lextIdbTopupIfEmpty`**: el gate de «necesita top-up» ahora
  comprueba `results` **y** `_lextHasRosterOrShield`; el top-up desde
  IndexedDB hace backfill por nombre (`_lextBackfillShields`/
  `_lextBackfillResults`) en vez de reemplazo ciego.
- **`_lextRecoverResultsFromBackups`**: el hot-path también comprueba
  `_lextHasRosterOrShield`; el bucle de restauración llama además a
  `_lextBackfillRoster`/`_lextBackfillShields`, no solo a
  `_lextBackfillResults`.
- **`fetchData`** (las 3 rutas de adopción): añadido
  `_lextBackfillRoster(...)` junto a cada `_lextBackfillShields(...)`
  existente — la plantilla viaja con la misma garantía que el escudo en
  CUALQUIER sync cross-device, para las ~50 ligas normales también.
- **Servidor (`_lx_merge_teams`, `app.py`)**: nuevo bloque de backfill
  `best_roster_by_name`, espejo EXACTO del bucle `for _fld in ("shield",
  "stadium")` pero para `players[]` — el ganador de la fusión por
  `updatedAt` que se quede sin roster lo recupera de la versión (old o
  new) más reciente que sí lo tenga.

### Reglas a respetar

1. **PROHIBIDO** que cualquier guard de «¿hace falta recuperar/sembrar
   esta liga?» mire SOLO `teams.length` o SOLO `results`. Debe
   comprobar también `_lextHasRosterOrShield` (o el equivalente
   servidor) — si no, un seed en blanco que ya quedó escrito bloquea la
   recuperación PARA SIEMPRE aunque existan copias durables ricas.
2. **PROHIBIDO** que `_lextBackfillRoster` pise un roster ya presente en
   `target` (mismo contrato que `_lextBackfillShields`): solo rellena
   equipos con `players` vacío.
3. **PROHIBIDO** que el backfill de identidad del servidor
   (`_lx_merge_teams`) cubra `shield`/`stadium` pero no `players`. Toda
   fusión por-equipo nueva hereda los 3 campos.
4. Toda liga NUEVA con seed automático (una 5ª futura, si se añade)
   hereda `isBlank` + el backfill de roster/escudos automáticamente al
   reutilizar `_ensureExtraLeagueSeed`/`_lextIdbTopupIfEmpty`; no
   duplicar esta lógica en un guard ad-hoc.

## El ALIAS de eFootball de un equipo es IDENTIDAD igual que escudo/estadio/plantilla, nunca se pierde (obligatorio, 2026-07-04)

**Bug (fotos usuario 2026-07-04, «a mi amigo no le sale la ❓️ pero a mí
sí»)**: en la pantalla de PREVIA de un partido, bajo el nombre de un
equipo sin licencia real en eFootball (p.ej. Maccabi Tel Aviv), el
admin ve un botón **❓** que al pulsarlo muestra con qué equipo REAL de
eFootball hay que jugar (`t.efootballAlias`, editado a mano en el
editor de Resto de Ligas — campo `#lext-team-efootball-alias`). Ese
botón salía en el móvil del usuario pero NO en el de su amigo, para el
MISMO equipo de la MISMA liga.

### Causa raíz

`efootballAlias` es un campo de equipo dentro de `ligaExt_<slug>`,
exactamente del mismo tipo que `shield` (escudo, protegido desde
2026-06-02), `stadium` (estadio, protegido desde 2026-06-11) y
`players` (plantilla, protegida desde 2026-07-02) — un dato de
IDENTIDAD que el admin pone en UN dispositivo y que debe propagarse a
TODOS. Pero, a diferencia de esos 3, **nunca se incluyó en NINGÚN
backfill** — ni el cliente (`_lextBackfillShields`/`_lextBackfillRoster`/
`_lextBackfillLeagueLogo`) ni el servidor (`_lx_merge_teams`, bucle
`for _fld in ("shield", "stadium")`) lo cubrían. Así, cuando la fusión
por equipo (cliente o servidor) elige un ganador por `updatedAt` y ese
ganador viene de una copia que nunca tuvo el alias puesto (el
dispositivo del amigo, que no editó ese equipo), el alias desaparecía
para ese dispositivo sin que nada lo recuperase — exactamente el mismo
mecanismo que ya rompió escudos/estadios/plantillas antes de que se
les añadiera backfill.

### Fix

- **Cliente** (`misc_body_1.html`): nuevo `_lextBackfillAlias(target,
  source)`, espejo EXACTO de `_lextBackfillShields` pero para
  `efootballAlias`. Se invoca en LOS MISMOS 10 puntos donde ya se llama
  a `_lextBackfillShields` (las 3 rutas de adopción de `fetchData`, el
  top-up desde IndexedDB, y las 4 rutas de recuperación de seed —local
  y servidor— de Resto del Mundo + Montenegro/N.Irlanda/Albania).
  Invalida `_ALIAS_CACHE` (`_invalidateAliasCache`) cuando rellena algo,
  para que el ❓ aparezca sin esperar el TTL de 3 s.
- **Servidor** (`app.py`, `_lx_merge_teams`): `efootballAlias` se añade
  al bucle `for _fld in ("shield", "stadium", "efootballAlias")` —
  mismo backfill por nombre canónico, mismo criterio (NUNCA pisa un
  valor ya presente en el ganador). Tests en
  `tests/test_api.py::TestLigaExtMerge` (`test_alias_efootball_no_se_pierde_si_ganador_no_lo_trae`,
  `test_alias_efootball_viaja_entre_grafias_del_mismo_club`).

### Reglas a respetar

1. **PROHIBIDO** que el backfill de identidad (cliente o servidor)
   cubra escudo/estadio/plantilla pero no el alias de eFootball. Los 4
   son el mismo tipo de dato (campo de equipo puesto a mano por el
   admin en UN dispositivo) y viajan igual.
2. **PROHIBIDO** que `_lextBackfillAlias` pise un alias ya presente en
   `target` (mismo contrato que `_lextBackfillShields`/`_lextBackfillRoster`):
   solo rellena equipos con `efootballAlias` vacío.
3. Todo campo NUEVO de identidad por equipo que se añada en el futuro
   al editor de Resto de Ligas (junto a escudo/estadio/alias/plantilla)
   hereda este patrón: backfill cliente (`_lextBackfillXxx`, llamado en
   los mismos 10 puntos) + backfill servidor (añadido al bucle de
   `_lx_merge_teams` si es un campo string simple, o su propio bloque
   `best_*_by_name` si es más complejo como `players[]`).

### Refuerzo — el alias puede existir en el servidor SIN que el dispositivo lo tenga cacheado (obligatorio, 2026-07-05)

**Bug (fotos usuario 2026-07-05, «si tiene alias»)**: tras el fix de
backfill de arriba, el ❓ seguía sin mostrar el alias de Maccabi Tel
Aviv aunque el editor de "Resto de Ligas" (misma sesión) lo mostraba
guardado (`Sudamérica - 1🇦🇷 - Rosario AA - 1ª👕 - ⭐⭐⭐⭐`).

**Causa raíz — el escaneo de `_buildAliasCache` es SOLO LOCAL**:
`getTeamEfootballAlias` resuelve el alias escaneando `ligaExt_*` en
`localStorage` + `LIGA_CACHE` (memoria) del PROPIO dispositivo — nunca
pregunta al servidor. Resto de Ligas tiene ~54 ligas; si ESE
dispositivo nunca había abierto la liga concreta de Maccabi Tel Aviv,
esa liga no existía ni en `localStorage` ni en `LIGA_CACHE` todavía —
el escaneo no tenía NADA que mirar, aunque el servidor sí tuviera el
equipo con su alias. Abrir el editor de esa liga (como hizo el admin
para comprobarlo) es precisamente lo que la carga por primera vez —
por eso el editor SÍ lo mostraba justo después, sin que eso arregle la
consulta anterior de la previa.

**Fix** (`misc_body_1.html`): `window._efAliasServerSearch(teamName,
onDone)` — cuando el ❓ no encuentra nada en el cache local, busca en
el SERVIDOR liga por liga, **secuencial** (nunca en paralelo — mismo
patrón anti-thundering-herd que `_eurHydrateMissingLeagues`/
`_eurPickerLoadLeague`), parando en cuanto encuentra el equipo. Solo se
dispara BAJO DEMANDA al pulsar el ❓ (nunca en el arranque ni en el
render de la previa). `_copaShowAlias` (`copa-engine.js`) muestra
"🔄 Buscando en el servidor…" mientras busca y rellena el popup en
cuanto lo encuentra, además de sembrar `_ALIAS_CACHE` para que la
siguiente consulta de ese equipo sea instantánea. `_buildAliasCache`
también escanea `window._TOUR_CACHE` (cfgs de torneo ya cargados) como
fuente adicional, por si algún formato de torneo llega a copiar el
alias al roster del torneo.

**Reglas a respetar**:
4. **PROHIBIDO** asumir que "el alias no aparece" significa "el alias
   no existe" — puede significar simplemente que ESTE dispositivo nunca
   cargó la liga de ese equipo. Todo lookup de identidad por nombre
   (alias, y si se añade un campo similar en el futuro) que dependa de
   un escaneo LOCAL de `ligaExt_*` debe tener un fallback de búsqueda en
   servidor bajo demanda, no limitarse a devolver vacío.
5. **PROHIBIDO** que la búsqueda en servidor dispare las ~54 ligas TODAS
   de golpe (thundering herd real) NI una a una completamente en serie
   (demasiado lenta — ver refuerzo de abajo). Lotes acotados en
   paralelo (`BATCH=8`) con parada temprana en cuanto se encuentra el
   equipo, y siempre disparada por una acción EXPLÍCITA del usuario
   (pulsar el ❓), nunca automática en el arranque o en cada render de
   la previa.

### Refuerzo — búsqueda por lotes (no 1-a-1) + selector de portero a prueba de balas con `touchstart` (obligatorio, 2026-07-05)

**El fix anterior no bastó (2 quejas del mismo usuario)**:
1. «se tira mucho tiempo buscando el equipo, tendría que salir al
   momento, siempre ha sido así» — la búsqueda de `_efAliasServerSearch`
   recorría las ~54 ligas **una a una en serie**: cada peticion suma su
   latencia COMPLETA a la siguiente, así que en el peor caso (equipo en
   una liga tardía del recorrido, con Railway lento) podían pasar varios
   segundos. Fix: lotes de **8 peticiones en paralelo** por ronda en vez
   de 1 en serie — mismo espíritu anti-thundering-herd (no las 54 de
   golpe) pero con concurrencia acotada, típicamente 1-2 rondas en vez
   de hasta 54 peticiones en fila. El caso común (liga ya cacheada
   localmente) sigue sin disparar NINGUNA petición.
2. «la foto 2 no funciona para nada» (selector de portero, otra vez) —
   el respaldo `touchend` con comprobación de movimiento (refuerzo
   anterior) esperaba a que el gesto TERMINARA para decidir si era un
   tap o un scroll. Se endurece aún más: dispara en el propio
   `touchstart` (el instante exacto en que el dedo toca), sin esperar a
   ver qué pasa después. Esta lista es corta y no crítica para
   scrollear, así que el coste de un falso positivo (elegir portero por
   un roce accidental) es mucho menor que el de dejar al usuario
   COMPLETAMENTE bloqueado. Verificado con Playwright: un touchstart
   seguido de un touchmove GRANDE (200px, inequívocamente un scroll) YA
   NO cancela la selección porque esta se resuelve antes de que el
   touchmove llegue a evaluarse.

**Reglas a respetar**:
6. ~~PROHIBIDO que una búsqueda de respaldo en servidor sea secuencial
   1-a-1... usar lotes en paralelo acotados~~ — **SUPERADO por el
   refuerzo de abajo (2026-07-05 #2)**: ni siquiera por lotes, el
   cliente NO debe repetir peticiones HTTP (una por liga) para buscar
   un dato por nombre. La búsqueda de identidad por nombre (alias, o
   cualquier campo similar futuro) se hace con **UNA sola petición a un
   endpoint server-side dedicado** que recorre las ligas en la propia
   base de datos del servidor. Ver `/api/team-alias/<nombre>`.
7. **PROHIBIDO** que el respaldo táctil de un overlay OBLIGATORIO
   crítico (picker de porteros, MVP, o cualquier futuro) espere al
   `touchend`/gesto completo para decidir si actuar. Dispara en
   `touchstart` — el coste de un falso positivo ocasional es siempre
   menor que el de un usuario completamente bloqueado sin forma de
   avanzar ni cancelar.

### Refuerzo 2 — la búsqueda de identidad por nombre es SERVER-SIDE, una sola petición (obligatorio, 2026-07-05)

**El refuerzo anterior (lotes de 8) no bastó**: el usuario preguntó,
con toda la razón, «¿por qué tiene que buscar en el servidor si el
alias YA está ahí?», y además reportó que la búsqueda «no funciona, se
queda cargando» — nunca llegaba a completarse.

**Causa raíz**: el lote de 8 en paralelo seguía dependiendo de que el
PROPIO MÓVIL hiciera hasta ~54 peticiones HTTP (una por liga), solo que
agrupadas de 8 en 8. `fetch()` **no tiene timeout por defecto** — si
UNA sola petición de un lote se quedaba colgada por una red móvil
floja, el `Promise.all()` de ESE lote entero esperaba para siempre, y
la búsqueda jamás avanzaba ni concluía "no encontrado". Además, hacer
que el cliente escanee ~54 blobs JSON completos para encontrar UN
equipo por nombre es trabajo que el SERVIDOR puede hacer en una
fracción del tiempo (consultas a su propia base de datos) sin depender
en absoluto de la calidad de la conexión del móvil.

**Fix — nuevo endpoint `GET /api/team-alias/<nombre>`** (`app.py`):
recorre TODAS las filas `liga_ext_*` de `GlobalState` DIRECTAMENTE en
el servidor (excluyendo `_protected`/`_snap_*`), compara por nombre
CANÓNICO (`_lx_canon_name`, mismo criterio que `_lx_merge_teams`) y
devuelve `{ok:true, alias: "..."}` o `{alias: null}` en una ÚNICA
respuesta. `_efAliasServerSearch` (`misc_body_1.html`) pasa de hacer
hasta 54 fetches del cliente a hacer **UNA sola petición**, con
`AbortController` + timeout de 6 s para que, aunque la red falle, la
búsqueda NUNCA se quede "cargando" para siempre — se resuelve como "no
encontrado" pasado ese tiempo.

**Reglas a respetar**:
8. **PROHIBIDO** que una búsqueda de identidad por nombre (alias, o
   cualquier campo similar futuro) haga que el CLIENTE recorra las
   ligas una por una o por lotes vía HTTP. Esa búsqueda vive en el
   SERVIDOR (un endpoint dedicado que consulta su propia base de datos)
   y el cliente hace UNA sola petición.
9. **PROHIBIDO** que una petición `fetch()` de la que depende un
   resultado visible en pantalla (spinner "Buscando…") carezca de
   timeout. Sin `AbortController` (o equivalente), una petición colgada
   deja al usuario mirando un spinner infinito sin ninguna forma de
   saber que algo falló.
10. Todo endpoint server-side de búsqueda por nombre NUEVO hereda el
    mismo criterio de normalización (`_lx_canon_name`) y el mismo
    filtro anti-derivados (`_protected`/`_snap_*`) que `_lx_merge_teams`,
    para no duplicar lógica de canonicalización.

### Refuerzo 3 — la búsqueda cubre SELECCIONES + no se dispara si el equipo ya es conocido sin alias (obligatorio, 2026-07-05)

**Bug (fotos usuario, «Timor Oriental», foto "pero si es equipo real,
por qué sale ❓")**: en un partido de Selecciones (Road Copa Asia,
Inglaterra vs Timor Oriental), el ❓ bajo Timor Oriental se quedaba
`🔄 Buscando en el servidor…` sin resolver nunca.

**Causa raíz 1**: `/api/team-alias/<nombre>` (refuerzo 2 de arriba)
solo consultaba filas `liga_ext_*` — **nunca** `selecciones_squad_v1`.
Timor Oriental es una SELECCIÓN nacional, no un club de Resto de Ligas,
así que la búsqueda jamás podía encontrarla aunque tuviera alias
guardado en el sitio correcto.

**Causa raíz 2 (más de fondo)**: Timor Oriental **es un equipo real**
en el juego — el admin nunca configuró alias porque no hace falta.
Pero el código no distinguía "este equipo no está cacheado en este
dispositivo" (sí amerita preguntar al servidor) de "este equipo SÍ está
cacheado, simplemente no tiene alias porque no lo necesita" (una
respuesta ya definitiva, preguntar al servidor es tiempo perdido). Con
`selecciones_squad_v1` casi siempre cacheado localmente (es una sola
clave global, no 54 ligas fragmentadas), este caso iba a ser MUY común
para selecciones.

**Fix**:
- `/api/team-alias/<nombre>` (`app.py`) ahora también consulta la fila
  `selecciones_squad_v1` si no encontró nada en `liga_ext_*`.
- Nuevo `window._efAliasKnownLocally(teamName)` (`misc_body_1.html`):
  usa el flag `window.__aliasFoundInEditor` (ya lo pone
  `getTeamEfootballAlias` cuando encuentra el equipo en CUALQUIER
  fuente local, aunque el alias venga vacío) para saber si el equipo ya
  es conocido. `_copaShowAlias` (`copa-engine.js`) comprueba esto
  ANTES de disparar `_efAliasServerSearch`: si el equipo ya es
  conocido localmente (con o sin alias), muestra el aviso al instante
  sin preguntar al servidor. El aviso ahora también aclara "si el
  equipo SÍ existe tal cual en eFootball, no hace falta rellenar nada
  — este aviso es normal" para no sugerir un fallo cuando no lo hay.

**Reglas a respetar**:
11. **PROHIBIDO** que un endpoint de búsqueda de identidad por nombre
    cubra solo `liga_ext_*` cuando el dato (alias, o cualquier campo
    similar) también puede vivir en `selecciones_squad_v1` (selecciones
    nacionales) o cualquier otro store de equipos. Cubrir TODAS las
    fuentes donde ese campo pueda existir.
12. **PROHIBIDO** disparar la búsqueda en servidor para un equipo que
    YA está indexado localmente (`window.__aliasFoundInEditor`), aunque
    su alias venga vacío — un alias vacío de un equipo CONOCIDO es una
    respuesta definitiva ("no lo necesita"), no una señal de que falte
    sincronizar. Solo preguntar al servidor cuando el equipo no está
    indexado en ABSOLUTO localmente.
13. Todo aviso de "sin alias configurado" debe dejar claro que es un
    estado NORMAL para un equipo con licencia real en eFootball, no
    solo un error a corregir — para no generar la misma confusión.

## Resto de Ligas — las stats de COPA + LIGA se SUMAN por jugador y sobreviven al re-sim de liga (obligatorio, 2026-06-12)

**Bug (fotos usuario 2026-06-12, «Campionato Sammarinese»)**: un equipo
de una liga externa (CALUNGO) tenía la liga Y la copa jugadas (PJ 38 a
nivel de equipo) pero la caja de la plantilla salía «Máximo goleador:
sin registros · MVP: sin registros» con TODOS los jugadores a 0.

### Causa raíz

Para Resto de Ligas las stats per-jugador viven en `team.players[]`
(la sim NO guarda goleadores en `results[]`). `ligaExtSimular` hace
`resetPlayerStats` a TODOS los jugadores y re-aplica SOLO la liga. La
copa (`_lecRunAllAuto`/`_lecSimMatch`) suma su aportación ENCIMA. Pero
si la liga se vuelve a simular DESPUÉS de la copa (típico: el botón
global «Sim» que rejuega las 51 ligas), el reset BORRA la aportación de
copa de `team.players[]`. Como `data.copa` sigue con sus partidos
jugados, `_lextComputeRealStats` calcula `teamPJ = liga + copa` mientras
`p.pj` quedó en liga sola → el check anti-stale `ownPj === teamPJ` falla
y `_lextHydratePlayerStats` devuelve TODO a 0 → «sin registros».
Agravante: la cabecera (`_lextRenderSquadStatsHeader`) se pinta ANTES
que `renderSquadList` (el único que sincronizaba el cache desde
`team.players[]`), así que leía un `ef_player_stats_v1` que
`rebuildPlayerStatsStore` deja VACÍO de equipos de ligas externas.

### Fix — el 🎮 Sim simula LIGA + COPA (global e individual, 2026-06-12)

Petición usuario: «el botón 🎮 Sim simule tanto Liga como copa, tanto
global como individual». La raíz del «sin registros» era que la liga se
re-simulaba (reset) sin re-jugar la copa. Solución definitiva: cada Sim
deja la liga Y la copa jugadas, así `team.players[]` siempre = liga+copa.

- **`_lecSimCupOn(data, opts)`** (motor de copa reutilizable, SIN efectos
  colaterales: no usa `CURRENT_KEY`, no `saveData`, no render, no alert):
  ensura el cfg de copa según las REGLAS de esa copa (formato por nº de
  equipos + toggles), simula grupos + KO + final, aplica stats a las
  plantillas y proclama campeón. `opts.force=true` REDIBUJA la copa de
  cero (nuevo sorteo + sim). Devuelve false si la liga no llega a 12
  equipos. `_lecRunAllAuto` (botón Copa) y `ligaExtSimular._finishSim`
  comparten este motor.
- **`ligaExtSimular._finishSim`** llama `_lecSimCupOn(data,{force:true})`
  tras la sim de liga (que acaba de hacer `resetPlayerStats`): la copa se
  re-simula de cero ENCIMA de la liga fresca → stats = liga+copa, sin
  doble conteo (la copa siempre parte del reset de la liga). Como el Sim
  global (`_restoLigasSimAll`) llama a `ligaExtSimular` por liga, hereda
  liga+copa automáticamente.
- **Cabecera sincroniza primero**: `_lextRenderSquadStatsHeader` llama a
  `_lecSyncPlayerStatsCache(loadData(CURRENT_KEY))` ANTES de leer los
  líderes (espejo de lo que ya hacía `renderSquadList`).

### Pool de la Recopa — 54 campeones + 10 subcampeones = 64 (2026-06-12)

Petición usuario: el campeón de las 53 ligas externas + Liga EA Sports
(54) va a Recopa, MÁS el subcampeón de 10 copas concretas (EA Sport,
Inglaterra, Italia, Alemania, Francia, Portugal, Países Bajos, Bélgica,
Turquía, Dinamarca) = 64. `_buildPool` (IIFE `recopa_state_v1`):
- TODOS los campeones de ligas externas europeas (ya lo hacía).
- Subcampeón SOLO de la whitelist `RECOPA_SUBCAMPEON_SLUGS` (las 9
  externas: `inglaterra,italia,alemania,francia,portugal,p-bajos,belgica,
  turquia,dinamarca`). El toggle per-cup `recopaSubcampeon` puede
  DESACTIVAR una de las 9, nunca AÑADIR una fuera de la lista.
- EA Sports (campeón + subcampeón de la Copa del Rey, la 10ª copa con
  sub) entra por los MANUALES de «EA Sports → Europa» slug `recopa`
  (`_meaTeamsFor('recopa')`), porque `liga-ea-sports` está en
  `EUROPE_BLACKLIST`. El bracket de 64 rellena con BYE si faltan equipos.

### Reglas a respetar

1. **PROHIBIDO** que `ligaExtSimular` deje `team.players[]` con stats de
   liga sola cuando la liga tenga ≥12 equipos: tras el reset+liga debe
   re-simular la copa (`_lecSimCupOn(data,{force:true})`) para que la
   suma liga+copa sobreviva a cualquier re-sim (incluido el bulk global).
2. **PROHIBIDO** que `_lecSimCupOn` haga `saveData`/render/alert: es el
   motor puro, el caller persiste. `_lecRunAllAuto` y `_finishSim` son
   los únicos call sites (no duplicar el motor de copa en otra ruta).
3. Toda caja/cabecera que lea líderes de una liga externa debe
   sincronizar el cache desde `team.players[]` (`_lecSyncPlayerStatsCache`)
   ANTES de leer, no fiarse de `ef_player_stats_v1` (lo vacía
   `rebuildPlayerStatsStore` para los equipos no-EA).
4. **PROHIBIDO** que la Recopa vuelva al «subcampeón de TODAS las copas
   con toggle ON». Solo las 9 de `RECOPA_SUBCAMPEON_SLUGS` + EA manual.

## Resto de Ligas con 3 móviles + PC — dedup canónico, estadio y logo de liga NUNCA se pierden (obligatorio, 2026-06-11)

**Bug (petición usuario 2026-06-11, «3 móviles y cpus editando resto de
ligas errores graves»)**: con varios dispositivos editando a la vez
`ligaExt_<slug>`: (1) **se duplican equipos**, (2) **no se puede añadir
estadios a los equipos** (se borran al sincronizar), (3) **se borran
logos de ligas**.

### Causas raíz (todas en la fusión cross-device, chokepoint `_lx_merge_teams`)

1. **Duplicados**: el colapso final por nombre del servidor usaba
   `_lx_norm_name` (solo acentos/puntuación), MÁS DÉBIL que el dedup del
   cliente `_teamCanonKey`/`_canonTeamName` (que además quita afijos
   FC/CF/CD…). Re-pegar la lista regenera ids → «Olympiacos» (id A) y
   «Olympiacos FC» (id B) eran claves distintas, el `_lx_norm_name` no
   las colapsaba y AMBAS sobrevivían. Y el cliente no las re-colapsaba
   porque `_sanitizeLigaTeamNames` hace early-out si `d._sanV ===
   _SAN_VER` (sello persistido y sincronizado).
2. **Estadio**: `_lx_merge_teams` elegía al ganador por `updatedAt` y se
   quedaba con su dict ENTERO; si ese ganador no traía `stadium` (otra
   copia más reciente sin el estadio recién puesto), se perdía. El
   `shield` tenía backfill de identidad; el `stadium` NO.
3. **Logo de liga**: `config.logo`/`config.cupLogo` (logo PROPIO de la
   competición) viven en el config TOP-LEVEL del documento, que la
   fusión adopta VERBATIM del entrante (`result = dict(new_data)`). Como
   `ensureConfig` (cliente) fuerza `config.logo = ''` en TODO dispositivo
   que nunca lo puso, un POST de ese dispositivo BORRABA el logo que otro
   guardó (last-write-wins, sin arbitraje ni backfill).

### Fix

- **Servidor** (`app.py`, `_lx_merge_teams`):
  - `_lx_canon_name` (afijo-aware, espejo del `_canonTeamName` del
    cliente) se usa en el colapso final por nombre (`by_name`) y en los
    backfills de identidad. El `del_set`/`deletedTeamNames` sigue por
    `_lx_norm_name` (nombre del cliente).
  - Backfill de identidad GENERALIZADO a `shield` **y** `stadium`,
    indexado por nombre CANÓNICO (viaja entre grafías del mismo club).
    Nunca pisa un valor presente en el ganador.
  - Backfill del logo de liga: tras `dict(new_data)`, si el entrante
    trae `config.logo`/`cupLogo` VACÍO pero el almacenado SÍ lo tiene,
    se CONSERVA el almacenado. Un logo entrante NO vacío (edición real)
    gana.
- **Cliente** (`misc_body_1.html`): `_lextBackfillLeagueLogo(target,
  source)` (espejo de `_lextBackfillShields`) en las 3 rutas de adopción
  de `fetchData`. `_protected` empty-roster restore incluye `stadium`.
  `_SAN_VER` bump 1→2 (re-saneo único que colapsa dups EXISTENTES vía
  `_teamCanonKey` sin esperar a la próxima edición).
- Tests: `tests/test_api.py::TestLigaExtMerge`.

### Reglas a respetar

1. **PROHIBIDO** que el colapso por nombre del servidor vuelva a usar
   `_lx_norm_name` (débil). Usar `_lx_canon_name` (afijo-aware = cliente)
   o los duplicados por grafía/afijo vuelven.
2. **PROHIBIDO** que `stadium` o `config.logo`/`cupLogo` se pierdan en la
   fusión: ambos son IDENTIDAD con backfill (igual que `shield`). Un
   POST con el campo vacío NO borra el valor de otro dispositivo.
3. El backfill de logo es ADITIVO: solo restaura el campo VACÍO entrante
   desde el almacenado; nunca pisa un logo entrante no vacío.
4. Toda comp/campo de identidad NUEVO de `ligaExt_*` (que no viaje por
   equipo o que un ganador por recencia pueda no traer) hereda este
   patrón de backfill.

## La CLASIFICACIÓN simulada de una liga SEMBRADA se RECUPERA desde copias durables locales (obligatorio, 2026-06-28)

**Bug (fotos usuario «Abissnet Superiore / Albania»)**: se simula una liga
SEMBRADA (`_EXTRA_LEAGUE_SEEDS`: Albania, Montenegro, N. Irlanda), se ve la
clasificación con 38 PJ, se RECARGA la web y vuelve a **0 partidos** con el
roster del seed (mismos equipos, results vacíos). Pasa lo mismo en cualquier
liga de Resto de Ligas cuyo `main` pierda la clasificación.

### Causa raíz

El seed eager (`_ensureExtraLeagueSeed`) escribe `results: []`. Si el `main`
de `localStorage['ligaExt_<slug>']` pierde sus resultados (eviction agresiva
de localStorage en Android, un GET stale del servidor que se cacheó en main,
o un re-seed con la liga ya simulada) el `main` queda con los EQUIPOS del
seed pero SIN resultados. `loadData` solo restauraba desde `_protected`
cuando el main tenía **0 EQUIPOS** — un main re-sembrado (20 equipos,
`results:[]`) NO disparaba esa restauración. La clasificación simulada SÍ
vivía en las copias durables `_protected` / `_snap_*` (las escribe `saveData`
en CADA sim con `resultsStamp`), pero nada las consultaba → 0 PJ para
siempre.

### Fix — recuperar `results` desde `_protected`/snapshots por recencia

- **`_lextRecoverResultsFromBackups(k, data)`** (`misc_body_1.html`, junto a
  `_lextBackfillResults`): si el `main` viene SIN `results`, rellena la
  clasificación desde la copia durable local más reciente (`_protected` +
  snapshots) vía `_lextBackfillResults` (mismo arbitraje por `resultsStamp` +
  EMPTY-GUARD). Hot-path barato: **no-op si el main ya trae clasificación**.
  Lo llaman las DOS ramas de `loadData` (cache-hit + lectura de localStorage)
  y persisten el main curado.
- **`_ensureExtraLeagueSeed`**: ANTES de sembrar VACÍO, si existe una copia
  durable (`_protected`/`_snap_*`) con equipos — la liga YA se simuló y el
  main se perdió — RESTAURA esa copia (con sus resultados) en vez de pisar
  con el seed `results:[]`.

### Reglas a respetar

1. **PROHIBIDO** que el seed eager escriba `results:[]` encima de una liga
   YA simulada cuyo main se perdió: debe restaurar `_protected`/snapshot
   primero (la clasificación es durable, no se siembra vacía).
2. **PROHIBIDO** que la recuperación resucite un RESET deliberado: el reset
   (`ligaExtReiniciar`) pasa por `saveData`, que ACTUALIZA `_protected` con
   la clasificación VACÍA + sello fresco → `_protected` también está vacío y
   no hay nada que restaurar (cubierto por el arbitraje de `resultsStamp`).
3. La recuperación SOLO actúa cuando el main viene sin `results` (hot-path
   no-op si ya los tiene); la reconciliación fina cross-device la sigue
   haciendo `fetchData` con el servidor (empty-guard de `resultsStamp`).
4. Toda liga SEMBRADA nueva (`_EXTRA_LEAGUE_SEEDS`) hereda esto
   automáticamente; no hardcodear slugs en la recuperación.

### La clasificación durable se CURA en el SERVIDOR (PC→server), no solo en local (obligatorio, 2026-06-30)

**Bug (fotos usuario «Resto Mundo / N.Irlanda / Montenegro / Albania
simuladas en el PC, a 0 en el MÓVIL» + banner «Navegador sin espacio»)**:
el PC simula las ligas (clasificación visible, 380 partidos) pero al abrir
la web en el MÓVIL salen a 0 y el pool de Wild Card sale **16/72**. La
recuperación 2026-06-28 cura el LOCAL (`_protected`/snaps) pero un móvil
NUEVO no tiene copias durables locales — depende del SERVIDOR, y el
servidor estaba VACÍO.

**Causa raíz (combinada con `QuotaExceededError`)**: con localStorage
LLENO, las redes de seguridad basadas en localStorage quedan inutilizadas
(el set `liga_ext_pending_v1` de re-push en boot no se puede escribir, los
snapshots tampoco, y el XHR síncrono de `saveData` se SALTA en la sim
masiva por el gate anti-freeze). El ÚNICO camino al servidor durante la
sim es la ráfaga de POSTs async (x5) que, con Railway frío + thundering
herd (54 ligas a la vez), agota reintentos y se PIERDE. El espejo
IndexedDB (`_idbKV`) SÍ guarda la liga (por eso el PC la sigue mostrando
tras recargar), pero **NADA re-empujaba esa copia durable al servidor** →
el servidor se quedaba vacío para siempre → el móvil (que lee bien del
servidor vía `fetchData`) sacaba 0.

**Fix** (`misc_body_1.html`):
- **`window._lextReconcileResultsToServer(opts)`** (junto a `fetchData`):
  curado PROACTIVO e INDEPENDIENTE de la cuota. Para cada liga con
  clasificación durable LOCAL (LIGA_CACHE / localStorage main /
  `_protected` / IndexedDB vía `_lextBestLocalForReconcile`), GET del
  servidor y, si está VACÍO o ATRASADO, RE-EMPUJA la copia local
  confirmando (3 reintentos). Arbitraje = el MISMO `resultsStamp` +
  EMPTY-GUARD: sube SOLO si `localResults>0 && localStamp>=srvStamp &&
  localResults>srvResults`. Secuencial+pausado (mata el thundering herd
  que rompía la subida original). NO escribe localStorage (inmune a la
  cuota). Disparos: boot (diferido 9 s), `pageshow`/`focus`/`visibility`,
  fin de sim masiva (`_onDone`, force) y fin de sim individual
  (`_finishSim`).
- **`_eurHydrateMissingLeagues`** (botón «♻️ Re-cuadrar reparto europeo»):
  ahora también trae del servidor la CLASIFICACIÓN de las ligas que
  localmente tienen equipos pero `results` VACÍO (antes solo traía las que
  faltaban plantilla). Sin esto, recalcular el reparto en el móvil seguía
  saliendo corto (Wild Card 16/72) aunque el servidor ya estuviera curado.

**Reglas a respetar**:
5. **PROHIBIDO** confiar SOLO en la ráfaga de POSTs async de `saveData`
   para subir la sim: con localStorage lleno se pierde y nada la recupera.
   `_lextReconcileResultsToServer` es la red que cura el servidor desde la
   copia durable (IndexedDB/`_protected`/memoria), y DEBE seguir
   disparándose en boot + foco + fin de sim.
6. **PROHIBIDO** que la reconciliación pise un RESET o una sim más nueva de
   otro dispositivo: el guard `localStamp>=srvStamp && localResults>srvResults`
   (espejo del empty-guard server/cliente) lo impide. No relajarlo a
   last-write o a comparar solo por longitud sin el sello.
7. **PROHIBIDO** que el recálculo del reparto europeo (Wild Card / pools)
   compute sobre ligas con `results` vacío sin intentar traerlos del
   servidor primero (`_eurHydrateMissingLeagues` incluye ahora las ligas
   con equipos pero sin clasificación).

### El "ensure seed" de las 4 ligas auto-sembradas también recupera de `_protected`/IndexedDB en LOCAL (obligatorio, 2026-07-01)

**Bug (queja usuario 2026-07-01, «Montenegro / N.Irlanda / Albania / Resto
del Mundo — por más que las simulo no se quedan guardados los datos de
simulación y se resetean automáticamente»)**: estas 4 son las ÚNICAS ligas
de "Resto de Ligas" con un **seed automático de equipos** hardcodeado en
el código (`_EXTRA_LEAGUE_SEEDS` para Montenegro/N.Irlanda/Albania,
`RESTO_MUNDO_TEAMS` para Resto del Mundo). El resto de las ~50 ligas
dependen de que el admin pegue la plantilla a mano — nada las re-siembra
nunca. Estas 4 tienen una función `_ensureRestoMundoSeed`/
`_ensureExtraLeagueSeed` que corre en CADA boot **y en CADA apertura**
(`openLigaExt` envuelto) y que, si no encuentra equipos en el `main` crudo
de localStorage, escribe una plantilla fresca con `results:[]`.

**Causa raíz (asimetría entre las dos funciones)**: el fix 2026-06-28 le
dio a `_ensureExtraLeagueSeed` (Montenegro/N.Irlanda/Albania) la
recuperación desde `_protected`/`_snap_*` ANTES de sembrar vacío — pero
**`_ensureRestoMundoSeed` nunca recibió ese mismo fix**. Si el `main` de
`ligaExt_resto-mundo` se perdía (eviction agresiva de Android, o un
`QuotaExceededError` silencioso de `saveData` con esta liga tan grande —
44 equipos, hasta 903 partidos), la función sobreescribía DIRECTAMENTE con
la plantilla vacía sin mirar si `_protected`/snapshots aún tenían la
clasificación — perdiendo la sim en cada apertura si el `main` se había
evictado. Además, si localStorage se queda sin espacio, `_protected` y los
snapshots pueden perderse TAMBIÉN (viven en el mismo storage) — solo el
espejo IndexedDB (`_idbKV`, alta cuota) sobrevive, y ninguna de las dos
funciones lo consultaba antes de sembrar vacío.

**Fix** (`misc_body_1.html`):
- `_ensureRestoMundoSeed` gana la MISMA recuperación local
  (`_protected`/`_snap_*`) que ya tenía `_ensureExtraLeagueSeed` — deja de
  ser la única de las 4 sin esa red.
- **`window._lextIdbTopupIfEmpty(slug)`** (nuevo, compartido por las 4):
  si tras la recuperación local el `main` sigue sin `results`, hace un GET
  ASÍNCRONO a `_idbKV` (fire-and-forget, no bloquea el primer render) y,
  si IndexedDB trae una clasificación que localStorage no tiene, la
  adopta — releyendo el `main` justo antes de escribir para no pisar una
  sim concurrente que haya llegado mientras el GET volaba. Se llama desde
  las DOS ramas de ambas funciones (cuando ya hay equipos y cuando se
  acaba de sembrar vacío), así una liga con `main` intacto pero
  `results` vacíos también se cura.

**Reglas a respetar**:
8. **PROHIBIDO** que una liga con seed automático nuevo (si se añade una
   5ª en el futuro) tenga su propia función "ensure seed" SIN la
   recuperación `_protected`/`_snap_*` + `_lextIdbTopupIfEmpty` antes de
   escribir una plantilla vacía. Las 4 actuales son las únicas con este
   patrón — toda liga nueva de este tipo lo hereda.
9. **PROHIBIDO** que `_lextIdbTopupIfEmpty` sobreescriba una clasificación
   YA presente en localStorage (relee el `main` justo antes de escribir)
   ni que bloquee el render con una espera síncrona de IndexedDB — es
   fire-and-forget, complementa a `_lextReconcileResultsToServer`
   (2026-06-30) que cura el SERVIDOR; este fix cura el propio dispositivo.

### El "ensure seed" de las 4 ligas auto-sembradas pregunta al SERVIDOR antes de sembrar vacío (obligatorio, 2026-07-02)

**Bug (foto usuario 2026-07-02, «Abissnet Superiore / Albania», 20 equipos
a 0 PTS/0 PJ)**: pese a los fixes 2026-06-28/06-30/07-01, el usuario seguía
viendo la liga de Albania a 0 «por más que la simulo».

**Causa raíz remanente**: `_ensureExtraLeagueSeed`/`_ensureRestoMundoSeed`
(las 4 ligas con seed automático) solo recuperaban de copias durables
**LOCALES** (`_protected`/`_snap_*`) antes de sembrar vacío. Si esas
copias TAMBIÉN se habían perdido (eviction agresiva de Android que borra
localStorage entero, no solo el main — el mismo fenómeno que motivó el fix
de 2026-06-28), el seed escribía `results:[]` de inmediato y de forma
SÍNCRONA **sin preguntar nunca al servidor**. Esto es MENOS robusto que
`loadData()` (la función que usan las ~50 ligas normales), que sí hace un
XHR síncrono a `/api/liga-ext/<slug>` + `-protected` antes de rendirse a un
objeto vacío. Si justo después el `fetchData` asíncrono de `openLigaExt`
fallaba (red móvil intermitente, documentada por todo este proyecto), la
semilla vacía quedaba plantada en firme — sin que nada volviera a preguntar
al servidor — y el usuario veía 0 PJ aunque el servidor SÍ tuviera la
clasificación simulada de la última vez.

**Fix** (`misc_body_1.html`): nuevo helper compartido
`window._lextSeedRecoverFromServer(slug)` que replica el MISMO XHR síncrono
de `loadData()` (GET a `/api/liga-ext/<slug>`, con fallback a
`/api/liga-ext-protected/<slug>`). `_ensureExtraLeagueSeed` y
`_ensureRestoMundoSeed` lo consultan justo ANTES de sembrar vacío (después
de agotar `_protected`/`_snap_*` locales): si el servidor trae equipos
(con o sin resultados), se adoptan vía `_lextAdoptServerSeedRecovery`
en vez de sembrar la plantilla en blanco. Solo se ejecuta en el caso raro
«ni local ni sus copias durables tienen NADA» — en el caso normal
(`hasTeams===true`) el seed sigue devolviendo de inmediato sin tocar red.

**Reglas a respetar**:
10. **PROHIBIDO** que el "ensure seed" de una liga auto-sembrada (las 4
    actuales, o una 5ª futura) escriba una plantilla vacía sin antes
    intentar `_lextSeedRecoverFromServer(slug)` cuando local no tiene
    nada. Es la MISMA red que ya protege a las ~50 ligas normales vía
    `loadData()` — estas 4 no pueden tener una recuperación más débil.
11. **PROHIBIDO** que `_lextSeedRecoverFromServer` sea asíncrono/fire-and-
    forget: tiene que resolver ANTES de que el seed decida escribir vacío,
    igual que los XHR síncronos de `loadData()`. Solo corre en el caso
    raro de local totalmente vacío, así que el coste (1-2 XHR bloqueantes)
    es aceptable y no afecta el boot normal.

## Plantilla de selecciones — sync que NO pierde datos + sin «Pacífico» (obligatorio, 2026-06-02)

**Bug (foto usuario 2026-06-02)**: en «🌐 Plantilla de selecciones»
(editor en `misc_body_1.html`, IIFE `KEY='selecciones_squad_v1'`) las
selecciones, medias y jugadores que añadían el usuario **o su amigo
desde otro dispositivo** se BORRABAN al recargar. Además el picker de
continente seguía mostrando «🌎 Pacífico», un continente ya eliminado.

### Causa raíz (datos que «se borran»)

1. `_boot()` hacía un GET al servidor y **PISABA ciegamente**
   `localStorage` con `j.value` (`localStorage.setItem(KEY, …)`). Si el
   servidor venía con MENOS selecciones (POST anterior perdido en red
   móvil, GET stale anterior al POST, o edición concurrente del amigo),
   la plantilla local recién editada se perdía.
2. `_save()` era fire-and-forget sin reintentos: un POST perdido dejaba
   el servidor con datos viejos para siempre.

### Fix — FUSIÓN local∪servidor (nunca borra) + POST con reintentos

- **`_mergeTeamsForSync(localTeams, remoteTeams)`**: unión por nombre
  canónico (`_selCanon`). En conflicto (mismo nombre en ambos lados)
  gana `updatedAt` más reciente; a igualdad, el más «rico»
  (`_teamRichness`: nº de jugadores + datos). **NUNCA elimina una
  selección local.** Conserva el orden local y añade al final las
  selecciones que solo estaban en el servidor.
- **`_collect()`** sella `updatedAt: Date.now()` en cada selección al
  guardar → los conflictos se resuelven por recencia (la última
  edición gana, propagación correcta entre dispositivos).
- **`_boot()`** FUSIONA en vez de pisar; si la fusión añade algo que el
  servidor no tenía, re-sube (unión, nunca borra del servidor) para que
  el otro dispositivo lo reciba. Converge (no hace loop).
- **`_post(d, tries)`** reintenta el POST hasta 3× con backoff.
- **`_save` = push autoritativo** (respeta borrados en el mismo
  dispositivo). **`_boot` = pull aditivo** (nunca pierde lo local).

### Continentes — «Pacífico» ELIMINADO

Los 4 continentes del juego son `europa` 🇪🇺 · `america` 🌎 · `asia` 🌏
· `africa` 🌍 (`_SEL_CONTS`). El antiguo `pacifico` (unía América +
Asia + Oceanía) está **eliminado**: `_normCont(v)` lo migra a `''` (sin
continente) en carga (`_dedupeStored`/`_hydrate`), guardado
(`_collect`) y fusión. El usuario reasigna esas selecciones a 🌎 América
o 🌏 Asia a mano. Se borró `_SEL_CONT_LEGACY` y la rama `pacifico` de
`_contOrderIndex`.

### Reglas a respetar

1. **PROHIBIDO** volver a pisar `localStorage` con el GET del servidor
   en `_boot` sin fusionar. La hidratación de selecciones SIEMPRE es
   unión que conserva lo local (es lo que evita el «se borran»).
2. **PROHIBIDO** reintroducir `pacifico` (ni en `_SEL_CONTS`, ni en
   labels, ni en el picker). `_normCont` debe seguir mapeándolo a `''`.
3. **PROHIBIDO** dejar `_save` sin reintentos de POST (la red móvil
   pierde requests y eso reintroduce el bug).
4. Toda selección recolectada debe llevar `updatedAt` para que la
   fusión resuelva conflictos por recencia.

## Wild Card + Open Qualifier — FASE DE GRUPOS (obligatorio, 2026-05-30)

Petición usuario 2026-05-30: la **Wild Card** (`s-wild-card`,
"UCL · Wild Card") y el **Open Qualifier** (`s-open-qualifier-clas`)
dejan de ser eliminatorias y pasan a **fase de grupos**. La pantalla
muestra **SOLO las tablas de clasificación** (sin desplegar las
jornadas): al pulsar Simular se juega todo IA-vs-IA y se rellenan las
tablas.

### Wild Card (motor en `part2/misc_body_2.html`, IIFE `WC_*`)

- **72 equipos** (plazas ⚪️ por liga, puesto 12+, 1-2 cada una; zona
  `wildcard` de cada `ligaExt_*` vía `computeWildCardClassified` →
  `_computeQualifiedFromLeagues('wildcard')`, que ya emite `slots`
  equipos por liga). `POOL_TARGET=72`; se rellena con TBD si falta.
- **24 grupos de 3** (`WC_N_GROUPS=24`, `WC_PER_GROUP=3`). Reparto
  snake por poder + anti-mismo-país (`_distributeWcGroups`).
- Liguilla a **DOBLE ida y vuelta** (`WC_ROUND_TRIPS=2`): cada par
  juega 4 veces → **8 partidos por equipo, 12 por grupo**
  (`_simulateWcGroup`).
- Clasifica **solo el 1º de cada grupo** → **24 ganadores** →
  `wc_to_open_qualifier_v1` (`_persistWinners`, filtra TBD). El 2º y
  3º quedan eliminados.
- Botones: **🎲 Draw** sortea los 24 grupos (sin jugar), **🎮 Simular**
  juega las liguillas y rellena tablas, **♻️ Reset** limpia.

### Open Qualifier (motor en `misc_body_1.html`, IIFE `STORE_KEY='oq_simulation_v1'`)

- **112 equipos** = **88 directos** 🟡 (zonas `uclQual`) + **24** de la
  Wild Card. `computeOpenQualifierTeams` capa a 112, reserva
  `wcWinners.length`, `maxLeagues = 112 - reserved`.
- **28 grupos de 4** (`N_GROUPS=28`, `TEAMS_PER_GROUP=4`,
  `GROUP_LABELS` = A..Z, AA, AB). Round-robin ida+vuelta
  (`_simulateGroup`): **6 partidos por equipo, 12 por grupo**.
- Clasifica **solo el 1º** (`QUALIFY_TOP=1`) → **28** →
  `oq_to_previa_v1` (lo lee `computeUclPrevTeams`, count-agnóstico).

### Previa de Champions (motor en `part2/misc_body_2.html`, IIFE `WPREV_*`)

- **62 equipos** = **34 directos** 🟣 (zonas `uclPrev`) + **28** del
  Open Qualifier (vía `oq_to_previa_v1`). `computeUclPrevTeams` los
  une (dedupe). `POOL_TARGET=62`.
- **16 grupos** (`N_GROUPS=16` → 14 de 4 + 2 de 3, snake por poder +
  anti-mismo-país `_distributeGroups`). Liguilla a DOBLE ida y vuelta
  (`_simulateGroup`), IA-vs-IA. La UI muestra **SOLO tablas**.
- **CORTE GLOBAL** (`_globalRanking`): se ordena por **posición en su
  grupo → PTS → DG → GF → nombre** y se reparte:
  - **Top 12 → Champions** (`wprev_to_fase_grupos_v1`)
  - **13-34 → Europa** (22) (`wprev_to_europa_v1`)
  - **35-62 → Conference** (28) (`wprev_r1_to_conference_v1`)
  - Los 62 clasifican (12+22+28 = 62, ninguno eliminado). Los huecos
    TBD/placeholder NO se propagan a las fases finales.
- Botones: **🎲 Draw** sortea los 16 grupos, **🎮 Sim** juega las
  liguillas + aplica el corte, **♻️ Reset** limpia (`_resetEuropePoolFeeders('previa')`).
- **Sustituye** al formato R1 eliminatorias + Ronda Final + EXENTOS
  (ver sección "EXENTOS Previa Champions" más abajo, ya OBSOLETA).
- Las fases finales (UCL/UEL/UECL) consumen las 3 claves y rellenan a
  40 (`computeUcl/Uel/UeclClassified` + pad). Reparto emergente:
  28 directos + 12 Previa (UCL), 18 + 22 (UEL), 12 + 28 (UECL).
- Sin partidos humanos individuales: `_wprevPlayHumanMatch` /
  `_wprevSaveHumanResult` quedan como **no-ops** (compat con las
  llamadas `st.isWprev` del gm-modal/ml-card, que ya nunca se activan).

### Encaje global (objetivo del usuario)

`⚪️ WC 72→24 · 🟡 OQ 88+24=112→28 · 🟣 Previa 34+28=62 (12/22/28) ·
🔵 UCL 28+12=40 · 🟠 UEL 18+22=40 · 🟢 UECL 12+28=40`.

### Reglas a respetar

1. **PROHIBIDO** volver al bracket de Wild Card (4 semis + 18 RF), al
   OQ de 7×14 (top-5/35), ni a la Previa de R1 eliminatorias + Ronda
   Final + EXENTOS. Los tres son fases de grupos con SOLO tablas.
2. **PROHIBIDO** renderizar las jornadas/partidos individuales en
   `s-wild-card`, `s-open-qualifier-clas` ni `s-ucl-previa-clas`. Solo
   tablas de clasificación (petición explícita "sin que vengan las
   jornadas").
3. Los thresholds "done" de `s-champions` (`_wcDone` ≥20, `_oqDone`
   ≥24, `_wprevDone` = `phase==='done'`) son tolerantes a algún TBD;
   no subirlos a exactos.
4. Toda nueva edición debe mantener el cuadre
   72→24→112→28→62→(12/22/28); si cambia un número, actualizar el
   motor afectado + la leyenda visible.
5. **PROHIBIDO** que la Previa reparta menos de los 62 (todos
   clasifican). El corte es 12/22/28 sobre el ranking global, no por
   posición de grupo (un 1º de grupo puede caer a Europa si su
   ranking global es bajo).

### Tabla de coeficientes — plazas por defecto por liga (2026-05-30)

`window.LEAGUE_DEFAULT_ZONES` (en `misc_body_1.html`, justo tras
`DEFAULT_ZONES`) fija las plazas por defecto de cada liga según el
cuadro del usuario (🔵ucl 🟣uclPrev 🟠uel 🟢uecl 🟡uclQual ⚪️wildcard).
`window._zonesDefaultFor(slug)` = genérico `DEFAULT_ZONES` + override
de la liga.

- Lo consume `ensureConfig(data, slug)` (modal Reglas read + reset) y
  el seed `_seedLeagueDefaultZonesV1` (precarga las ligas ya sembradas
  que sigan en el genérico 1/1/1/1/1, sin pisar ediciones del admin).
- **España = `liga-ea-sports`** está en la tabla (🔵4 🟣1 🟠2 🟢1) pero
  sus plazas europeas entran por la pantalla manual "EA Sports → Europa"
  (está en `EUROPE_BLACKLIST` para el cómputo automático).
- Totales (incluida España): 🔵28 🟣34 🟠18 🟢12 🟡88 ⚪️72. Todo cuadra
  EXACTO: WC = 72 → 24 grupos de 3 sin hueco TBD.
  Aguas abajo: WC saca 24, OQ 88+24=112, Previa 34+28=62.
- `_fixupLeagueZonesV2` (flag `ftbol_league_zones_fix_v2`) re-aplica el
  cuadro CORREGIDO (Albania→🟣, Feroe/Malta→🟡3, Montenegro/Georgia→⚪️2,
  Bélgica/Turquía/Chequia/Grecia→🟣1) a navegadores que ya corrieron el
  seed v1 con los valores viejos — SOLO si la liga sigue en el valor
  viejo o genérico (nunca pisa edición manual). Idempotente.

  **⚠️ SUPERSEDE 2026-07-01 (tabla UNIFICADA, petición usuario, fotos
  "Wild Card 17/72" · "Open Qualifier 12/62 con TBD" · "Previa 12/62")**:
  el usuario entregó la lista completa y unificada de las 53 ligas +
  España (europa + ⚫ descenso). En esa lista **Bulgaria va en el bloque
  ⚪2** (medio, 17 ligas junto a Polonia/Noruega/Chipre/Austria/Escocia/
  Suecia/Croacia/Israel/Hungría/Ucrania/Serbia/Rumanía/Eslovenia/
  Azerbaiyán/Rusia/Eslovaquia) y **San Marino vuelve a ⚪1** (con Gales,
  bloque menor). El total de Wild Card se mantiene en 72 — Bulgaria pasa a
  ocupar el cupo extra que San Marino cubría desde 2026-06-13, no se
  reabre ningún hueco. **La prohibición "San Marino NUNCA vuelve a ⚪1"
  del párrafo anterior queda SUPERADA por esta reasignación** (San Marino
  ⚪1 + Bulgaria ⚪2 = mismo total 72 que San Marino ⚪2 + Bulgaria ⚪1).
  Además se añadió un ⚫ descenso PROPIO por liga (antes todas caían al
  genérico ⚫3 de `DEFAULT_ZONES`): la mayoría ⚫1, con ⚫2 en Inglaterra/
  Italia/Alemania/Francia/Portugal/Países Bajos/Bélgica/Turquía/
  Dinamarca/Suiza (y España ⚫2, manual). `_fixupLeagueZonesV3` (flag
  `ftbol_league_zones_fix_v3`) re-aplica Bulgaria/San Marino y siembra el
  ⚫ por liga en navegadores ya sembrados — SOLO si siguen en el valor
  VIEJO/genérico exacto (nunca pisa edición manual del admin). Idempotente.
  **PROHIBIDO** revertir este swap a la asignación 2026-06-13 (Bulgaria
  ⚪1 / San Marino ⚪2): es la MISMA suma total, pero la lista del usuario
  es la fuente de verdad por liga.
- **N. Irlanda + Montenegro — pre-seed de 20 equipos** (`_EXTRA_LEAGUE_SEEDS`,
  `_ensureExtraLeagueSeed`): sus zonas iniciales se leen de
  `_zonesDefaultFor(slug)` (= 🟡OQ2 ⚪️WC2). **PROHIBIDO** volver a
  hardcodear el genérico de liga menor (🟣1/🟡1/⚪️1, `desc:2`) en ese
  seed — descuadraba el bracket (Previa de más, OQ/WC de menos) y hacía
  que el usuario viera reglas "que no se guardaban" (los defaults del
  modal no coincidían con 'Restaurar por defecto'). Bug 2026-05-31, foto
  usuario. `_fixupExtraLeagueZonesV1` (flag
  `ftbol_extra_league_zones_fix_v1`) corrige navegadores ya sembrados con
  el valor malo — SOLO si la liga sigue en el valor mal-sembrado o
  genérico (nunca pisa edición manual). Idempotente.
- **PROHIBIDO** hardcodear plazas en builders nuevos: leer siempre de
  `data.config.zones` con fallback `window._zonesDefaultFor(slug)`.

### El reparto europeo se AUTO-hidrata — sin él, el admin tenía que añadir cada equipo a mano (obligatorio, 2026-07-02)

**Bug (fotos usuario 2026-07-02, "he tenido que añadir uno a uno
manualmente todos los equipos a competiciones europeas ya que no
funciona")**: las pantallas de Champions/Europa/Conference/Previa/Open
Qualifier/Wild Card/Recopa mostraban pools casi vacíos, así que el
admin acababa metiendo los 28+18+12+34+88+70+64 equipos a mano por el
inyector "EA Sports → Europa" (pensado SOLO para inyectar Liga EA
Sports, no como sustituto del cómputo automático de las ~50 ligas
externas).

**Causa raíz**: `_computeQualifiedFromLeagues` (fuente del reparto
automático) SOLO lee las `ligaExt_<slug>` que YA están en el
localStorage de ESE dispositivo — y esas solo se cargan al abrir cada
pantalla de liga una a una. El helper que ya existía para arreglar
esto (`_eurHydrateMissingLeagues`, trae del servidor las ligas que
faltan) estaba cableado ÚNICAMENTE a 2 botones manuales de admin
("📤 Enviar realidad de cada equipo a su Europa" / "♻️ Re-cuadrar
reparto europeo") — las pantallas reales (Open Qualifier, Wild Card,
UCL/UEL/UECL, Previa) nunca lo llamaban, así que sin pulsar esos
botones el pool automático seguía vacío.

**Fix** (`misc_body_1.html`, junto a `_eurHydrateMissingLeagues`):
`window._eurAutoHydrateAndRender()` llama a `_eurHydrateMissingLeagues`
en segundo plano — al boot (diferido 4 s) y al volver el foco a la
pestaña (throttle 5 min) — y, si trajo ligas nuevas, re-pinta
`buildOpenQualifierClas`/`_wcRender`/`buildUclGruposClas`/
`buildUelGruposClas`/`buildUeclGruposClas`/`buildUclPrevClas`. No toca
`europe_committed_v1` (si el admin congeló una snapshot manual, sigue
mandando); solo alimenta el cálculo EN VIVO. Idempotente y barato
cuando no falta nada.

**Reglas a respetar**:
1. **PROHIBIDO** que `_eurHydrateMissingLeagues` vuelva a estar cableado
   SOLO a botones manuales de admin. El reparto automático debe
   auto-sanarse sin que el usuario tenga que saber que ese botón existe.
2. **PROHIBIDO** que el auto-hidratado corra sin throttle (mínimo 5 min
   entre pasadas) — son hasta ~50 fetches, no debe dispararse en cada
   focus/render.
3. El inyector manual "EA Sports → Europa" sigue existiendo para su
   propósito original (Liga EA Sports, blacklisted del cómputo
   automático) — no es la vía para el resto de ligas.

### El informe de "Enviar realidad de cada equipo a su Europa" lista equipo + liga por competición (obligatorio, 2026-07-02)

**Petición usuario 2026-07-02**: tras simular todas las ligas y pulsar
"📤 Enviar realidad de cada equipo a su Europa", el admin solo veía un
`alert()` con TOTALES por competición (28/34/18/12/88/70). Sin los
NOMBRES no podía verificar el resultado contra la tabla oficial de
coeficientes (país → cuántas plazas 🔵🟣🟠🟢🟡⚪ le corresponden) para
detectar errores (un equipo mal clasificado, una liga con más/menos
plazas de las que le tocan).

**Fix** (`misc_body_1.html`, junto a `_doCommitEurope`):
`window._eurShowCommitReport(blob, recovered)` sustituye el `alert()`
por un overlay (`#eur-report-ov`) con las 6 zonas (Champions/Previa/
Europa League/Conference/Open Qualifier/Wild Card), cada una AGRUPADA
POR LIGA (`_eurLeagueLabel` resuelve el slug vía
`window.LEAGUE_DEFAULT_NAMES`, formato "País (Nombre liga)" — igual
formato que usa el admin al pegar la tabla de coeficientes) con el
conteo por país y el listado de equipos concretos debajo, para poder
comparar de un vistazo contra la tabla oficial. Fallback: si el overlay
falla por cualquier motivo, se conserva el `alert()` de totales
(catch), para no dejar al admin sin ningún feedback tras pulsar el
botón.

**Reglas a respetar**:
1. **PROHIBIDO** volver a un `alert()` de solo-totales como ÚNICA
   confirmación de "Enviar realidad…". El admin necesita ver equipo +
   liga para poder detectar errores, no solo el conteo.
2. **PROHIBIDO** que el informe oculte equipos: SIEMPRE lista TODOS los
   de cada zona (agrupados por liga), nunca trunca ni pagina.
3. Toda liga NUEVA que se añada a `LEAGUE_DEFAULT_NAMES` aparece
   automáticamente con su nombre bonito en el informe — no hardcodear
   nombres de liga en `_eurLeagueLabel`.

### El reset de pools europeos (WC/OQ/Previa) reintenta el POST al servidor (obligatorio, 2026-07-02)

**Bug (foto usuario 2026-07-02, "el Open Qualifier no funciona el
reset")**: `_resetEuropePoolFeeders` limpiaba localStorage al instante,
pero el POST que limpia el espejo del servidor (`/api/state` con las
claves a `''`, + `/api/kv/europe_committed_v1` a `null`) era
fire-and-forget con `.catch()` mudo, sin reintentos. En red móvil ese
POST se pierde con frecuencia; si se pierde, el server conserva el
blob viejo y el siguiente `hydrateFromServer()` — que dispara en CADA
`focus`/`pageshow`/`visibilitychange`, no solo al boot — lo restaura
sin más (no hay concepto de tombstone: `local===null` ⇒ "restaurar
siempre que el server tenga algo"). El reset se deshacía solo, en
silencio, en cuanto el usuario cambiaba de app o el móvil se bloqueaba.

**Fix**: `_postClearRetry(url, body, tries)` reintenta hasta 3 veces
con backoff exponencial (2 s/4 s/8 s, mismo patrón que
`_resetLigaServer`) tanto el clear de `/api/state` como el de
`/api/kv/europe_committed_v1`.

**Reglas a respetar**:
4. **PROHIBIDO** que un reset que limpia estado compartido (server)
   vuelva a un POST fire-and-forget sin reintentos. `hydrateFromServer`
   restaura ciegamente cualquier valor no vacío que el server conserve
   cuando el local está `null` — el POST de limpieza DEBE llegar.
5. Todo reset nuevo de pools europeos (o cualquier store en
   `SYNC_KEYS` de `misc_body_2.html`) que borre localStorage debe
   persistir el borrado en servidor con reintentos, no un fetch suelto.

### Open Qualifier y Wild Card NUNCA leen el inyector manual "EA Sports → Europa" (obligatorio, 2026-07-03)

**Bug (foto usuario 2026-07-03, "Wild Card 75/72")**: el admin había
metido a mano ~70 equipos en la sección Wild Card del inyector manual
"EA Sports → Europa" (workaround usado mientras el cómputo automático
estaba roto, ver sección "El reparto europeo se AUTO-hidrata" arriba).
Con el cómputo automático ya arreglado, la pantalla Wild Card mostraba
**75/72** — por encima del total oficial (72) — y el admin no sabía
qué equipos/países sobraban o faltaban.

**Causa raíz**: `computeWildCardClassified()` y
`computeOpenQualifierTeams()` llamaban a `_prependManualEa(arr, slug)`,
que prepone los equipos de `manual_ea_<slug>_v1` al pool automático con
dedupe SOLO por nombre EXACTO. Pero **España (Liga EA Sports) tiene
cupo 0 en ambas zonas** en la tabla oficial de coeficientes
(`LEAGUE_DEFAULT_ZONES['liga-ea-sports'].uclQual === 0` y
`.wildcard === 0`) — el cómputo automático YA cubre el 100% de las 88 /
72 plazas por sí solo. Los equipos manuales que sobrevivían de la época
en que el cómputo automático estaba vacío se SUMABAN encima (grafías
distintas para el mismo hueco de liga no dedupean) y el pool superaba
el total oficial — la Wild Card recorta silenciosamente a 72 por poder
(`_normalizePool`), así que el admin veía "75/72" sin saber cuáles 3
equipos se estaban descartando ni por qué.

**Fix** (`misc_body_1.html`): `computeWildCardClassified` y
`computeOpenQualifierTeams` YA NO llaman a `_prependManualEa` — ambas
zonas devuelven EXCLUSIVAMENTE `_computeQualifiedFromLeagues(...)`, que
por construcción nunca puede superar el total oficial (cada liga está
capada a su `zones.uclQual`/`zones.wildcard` exacto, que suman
88/72 respectivamente). La pantalla "EA Sports → Europa" ahora muestra
un aviso ámbar en las secciones Open Qualifier y Wild Card («España
tiene cupo 0 aquí — esta lista ya NO se usa en el cálculo») para que el
admin sepa que puede quitar esos equipos sin que afecte a nada — no se
borran automáticamente (son datos del usuario).

**Reglas a respetar**:
1. **PROHIBIDO** volver a llamar `_prependManualEa` desde
   `computeWildCardClassified`/`computeOpenQualifierTeams`. España
   tiene cupo 0 en ambas zonas por diseño — el inyector manual es SOLO
   para zonas donde España SÍ tiene plazas (`ucl`/`uclPrev`/`uel`/`uecl`).
2. **PROHIBIDO** quitar el aviso ámbar de la pantalla "EA Sports →
   Europa" en las secciones Open Qualifier/Wild Card mientras esas
   listas sigan existiendo en `manual_ea_uclQual_v1`/`manual_ea_wildcard_v1`
   — sin el aviso el admin no entiende por qué sus equipos "no hacen
   nada".
3. Si en el futuro España consigue plaza en Open Qualifier o Wild Card
   (cambio de la tabla de coeficientes), hay que revertir este fix
   (recuperar `_prependManualEa` ahí) Y quitar el aviso ámbar — no
   dejar el código a medias.

## Caja "Torneos de Verano · Estadísticas" — render no bloqueante + equipos vigentes (obligatorio, 2026-05-28)

**Bug (foto usuario 2026-05-28)**: con el Trofeo Joan Gamper a 46/48
partidos jugados, la pantalla `s-torneos-stats` ("Torneos de Verano ·
Estadísticas") se quedaba **congelada en el placeholder
"Calculando estadísticas…"** y nunca renderizaba.

### Causa raíz

El loop de `STATS_SCREENS` (IIFE en `misc_body_1.html` ~13180)
ejecutaba `syncLigaEaPlayerStats()` (= `rebuildPlayerStatsStore`,
**O(matches × events × competitions)**) de forma **SÍNCRONA ANTES**
de pintar el dashboard. Con muchos partidos el hilo se bloqueaba y
nunca se llegaba a `_lextBuildCompStatsDashboard`, así que la caja
seguía mostrando el HTML inicial "Calculando estadísticas…".

### Refuerzo (2026-05-28) — render-first + sync diferido

`_renderOne(cfg)` ahora:
1. **PINTA YA** desde el cache (`_paint(cfg)`, síncrono y rápido) ⇒ la
   caja JAMÁS se queda en "Calculando…".
2. **DIFIERE** el `syncLigaEaPlayerStats()` pesado a `setTimeout(0)` y
   **re-pinta** con datos frescos al terminar.

`_lextBuildCompStatsDashboard` envuelve `_lextStatsDashHtml` en
try/catch: si tira, pinta el estado vacío en vez de dejar el
placeholder. **PROHIBIDO** volver a ejecutar el sync pesado de forma
síncrona antes del primer paint de una pantalla de estadísticas.

### Equipos vigentes — la caja muestra SOLO los del torneo actual

Petición usuario: "las estadísticas de ese torneo solo con los
equipos que juegan ese torneo en ese momento". El store
`ef_player_stats_torneos_v1` ACUMULA jugadores de TODAS las ediciones
de torneos de verano jugadas alguna vez. La caja `s-torneos-stats`
ahora filtra (entrada `filterTeams:true` en `STATS_SCREENS`) a SOLO
los equipos presentes en los cfgs `tour_<id>_v1` de board `verano`
**vigentes** vía `window._torneosVeranoTeamSet()`:
- Escanea ids `{sct,pss,jg,asia,tx1..tx8}` (regex
  `/^tour_(sct|pss|jg|asia|tx\d+)_v1$/`) de `_TOUR_CACHE` + localStorage.
- EXCLUYE `mundial` (Mundialito Clubes → `s-mundial-stats`) y los
  slots de Selecciones `spv*`/`sfn*` (bucket `sel`).
- Si el set sale vacío (ningún cfg cargado todavía) NO filtra
  (preferimos mostrar algo a una caja en blanco).

`_lextBuildCompStatsDashboard(rootId, statsKey, teamFilterSet?)` acepta
un 3er arg opcional con el set de equipos; `_filterStatsByTeamSet`
hace el filtrado (match exacto + inclusión laxa de grafías). El
filtro refuerza además la regla CLUBES≠SELECCIONES (las selecciones
nunca están en `cfg.teams` de un torneo de verano).

### Reglas a respetar

1. **PROHIBIDO** revertir el render-first / sync diferido en
   `STATS_SCREENS._renderOne`. Es lo que evita el cuelgue.
2. **PROHIBIDO** quitar el try/catch de `_lextBuildCompStatsDashboard`
   que garantiza que el placeholder siempre se reemplaza.
3. **Toda nueva edición de torneo de verano** (nuevo slot, nuevo id)
   debe quedar capturada por `_torneosVeranoTeamSet` (añadir su id al
   regex / lista) para que sus equipos aparezcan en la caja.
4. El 3er arg de `_lextBuildCompStatsDashboard` es **opcional**: las
   demás pantallas (Recopa, USC, Inter, Mundial, SC, UCL, Superliga)
   lo llaman con 2 args y NO filtran. No cambiar esa firma.

### La caja `s-tour-stats` MERGEA SOLA — sin botón ▶️ manual (obligatorio, 2026-06-29)

**Bug (fotos usuario 2026-06-29, «Trofeo Joan Gamper · Estadísticas»)**:
una LIGA de 63 equipos (`format='league'`) con varios partidos jugados
(clasificación con PJ correctos) mostraba TODAS las categorías de
Estadísticas en «Sin datos todavía». El merge dependía de un botón ▶️
manual (PIN 747, `_tourStatsForceRefresh`, añadido 2026-06-08) que el
usuario no debería tener que pulsar.

**Fix**: el botón ▶️ se ELIMINÓ (`s-tour-stats-refresh` del markup). La
caja `s-tour-stats` AHORA MERGEA AUTOMÁTICAMENTE en cada apertura:
`_tourStatsPaint` ejecuta sola el pipeline completo que hacía el botón —
(1) `_selSquadHydrate` (nombres reales), (2)
`_tourBackfillActasFromResults(cfg, teams, true)` (regenera/MERGEA el
acta de cada partido solo-marcador desde su marcador + home/away;
RESPETA las actas con nombres reales que el humano jugó, no las pisa),
(3) `_tourCollectStatsForTour` (agrega los eventos por jugador/equipo de
TODAS las actas), y SOLO si eso vino vacío, (4) `syncLigaEaPlayerStats`
(rebuild del store persistido que lee el paso 6 del recolector) +
reintento. Todo DIFERIDO desde `_tourStatsOpen` (render no bloqueante:
skeleton primero, cómputo en `setTimeout`).

**Reglas a respetar**:
5. **PROHIBIDO** reintroducir un botón manual (▶️/PIN) para refrescar las
   estadísticas de `s-tour-stats`. La caja MERGEA SOLA en cada apertura
   vía `_tourStatsPaint`. `_tourStatsForceRefresh` queda como alias no-op
   (re-dispara el merge automático) por compat; no volver a gatearlo con
   `requireAdmin`.
6. **PROHIBIDO** que `_tourStatsPaint` salte el `_tourBackfillActasFromResults`
   con `force:true` en la apertura: es lo que rellena las actas de los
   partidos solo-marcador (IA-vs-IA simulados antes del motor de actas, o
   copias del servidor sin events) para que la liga grande no salga a 0.
   El backfill es ADITIVO (respeta los goleadores reales ya presentes).
7. El `syncLigaEaPlayerStats` (O(partidos × comps), pesado) solo corre
   como ÚLTIMO RECURSO cuando la lectura directa de `cfg.results` vino
   vacía — no en el camino común. No moverlo a incondicional (congelaría
   la apertura en torneos grandes).

### El backfill RE-HIDRATA el roster GENÉRICO numerado, no solo «Jugador A/B» (obligatorio, 2026-06-30)

**Bug (4 fotos usuario, «Trofeo Joan Gamper» liga 63 equipos)**: la caja
de Estadísticas mostraba a los equipos IA con nombres del roster genérico
(«Jugador 22 · ANTWERP», «Portero B · ARIS», «Jugador 10 · MACCABI»,
«Jugador 1 · GENK»…) en Goleadores / Portería imbatida / Tarjetas, aunque
esos equipos YA tenían su plantilla REAL. Los equipos cuya plantilla se
pegó antes de simular sí salían reales (Göztepe→Mateusz Lis,
Torino→Vlasic, Liverpool→Salah).

**Causa raíz**: el acta IA-vs-IA se persistió con el roster genérico de
`_lextBuildDefaultRoster` («Jugador 1..30» — dorsal NUMÉRICO) porque se
simuló ANTES de que el equipo tuviera plantilla real. El auto-backfill
(`_tourBackfillActasFromResults`, que `_tourStatsPaint` ejecuta con
`force` en cada apertura) DEBERÍA regenerar el acta vía
`genMatchEventsEnhanced` (resuelve la plantilla REAL desde `ligaExt_*`),
pero su detector `_bfIsRealName` usaba la regex `(?:jugador|portero)\s*[a-k]?$`
que SOLO reconocía las LETRAS A–K como placeholder — los números 1..30 del
roster por defecto se daban por «nombre real» → el acta nunca se
re-hidrataba.

**Fix** (`misc_body_1.html`, `_tourBackfillActasFromResults`):
- `_bfIsRealName` amplía la regex a `(?:[a-k]|ia|\d+)?$` → detecta TAMBIÉN
  «Jugador N» / «Portero N» (roster genérico) y «Jugador IA» como
  placeholder, sin marcar como placeholder ningún nombre real.
- El guard AUTO-HEAL deja de depender de `force`: un placeholder solo se
  pisa cuando la regeneración produce nombres REALES (`_bfActaHasReal`).
  Así un equipo que de verdad solo tiene el roster genérico NO churnea el
  acta/server (regeneraría otro placeholder); en cuanto la plantilla real
  está disponible, el acta se re-hidrata sola en la siguiente apertura.

**Reglas a respetar**:
8. **PROHIBIDO** que el detector de placeholder del backfill vuelva a
   reconocer SOLO las letras A–K: debe cubrir el roster genérico numerado
   («Jugador N» / «Portero N» de `_lextBuildDefaultRoster`) o las actas
   simuladas antes de tener plantilla real jamás se re-hidratan.
9. **PROHIBIDO** pisar un acta-placeholder con OTRO placeholder (ni
   siquiera en `force`): solo se re-hidrata si la regeneración da nombres
   REALES. Las actas VACÍAS (solo-marcador) sí se rellenan siempre.

## Mundial 2032 + cajas de stats que computan EN VIVO desde cfg.results (obligatorio, 2026-05-28)

**Bug (foto usuario 2026-05-28)**: el Mundial 2032 (Selecciones,
format `mundial-48`) TERMINADO (Egipto campeón, grupos 72/72, todas
las rondas KO jugadas) mostraba la caja `📊 ESTADÍSTICAS · TODAS LAS
FASES` con **"Estadísticas no disponibles."** — el mismo síntoma
(caja de stats vacía) que la de Torneos de Verano.

### Inventario de cajas de stats (auditoría 2026-05-28)

Dos familias según su fuente de datos:

| Familia | Cajas | Fuente | Render |
|---------|-------|--------|--------|
| **Cache** (`ef_player_stats_*_v1`) | Liga, Superliga, Copa, UCL/UEL/UECL, Recopa, USC, Inter, Mundialito Clubes, Torneos, SC | store en localStorage (lo rellena `rebuildPlayerStatsStore`) | `_lextBuildCompStatsDashboard` |
| **En vivo** (`cfg.results[].events`) | Mundial 2032 (`_mundialStatsHtml`), s-tour-stats per-torneo (`_tourCollectStatsForTour`), Segunda (`buildLigaStatsDashboard`) | eventos del propio cfg del torneo | agregador propio + `_lextStatsDashHtml` |

### Causas raíz de las cajas "en vivo" vacías

1. **`_mundialStatsHtml`**: usaba `_mundialAggregateStats`, que mapea
   el lado a/b del evento → nombre real vía `cfg.groupFixtures`. Si los
   fixtures no estaban construidos (se construyen lazy al render del
   torneo) Y el result no tenía `home`/`away`, hacía
   `if (!nameA || !nameB) return;` y **saltaba el partido entero** sin
   mirar `ev.realTeam`. Además, si `_lextStatsDashHtml` no estaba
   disponible mostraba el literal "Estadísticas no disponibles." en vez
   del mensaje vacío estándar, y NO tenía try/catch.
2. **`_tourCollectStatsForTour`** (caja `s-tour-stats`): leía SOLO
   `LIGA_PLAYER_MATCH_STORE` (memoria, NO se persiste) → **vacía tras
   recargar** la página aunque el torneo estuviera jugado.

### Refuerzo (2026-05-28)

Helpers nuevos (en el IIFE del motor `_tour*` de `misc_body_1.html`):
- **`_tourStatsFromCfgResults(cfg)`**: agregador GENÉRICO que usa los
  `home`/`away` que `_tourAttachActa`/`_tourSaveHumanResult` YA
  persisten en cada `cfg.results[mk]`, con fallback a `ev.realTeam`.
  Funciona para CUALQUIER formato y **sobrevive a recargas**. NO tiene
  el early-return que saltaba partidos.
- **`_statsFromStoreFilteredToTeams(storeKey, teams)`**: último recurso
  que lee el store persistido (`ef_player_stats_sel_v1` para mundial-48,
  `ef_player_stats_mundial_v1` para Mundialito) filtrado a los equipos
  del torneo.

`_mundialStatsHtml` ahora encadena fallbacks con try/catch:
`_mundialAggregateStats` → `_tourStatsFromCfgResults` →
`_statsFromStoreFilteredToTeams`, y si todo falla muestra el mensaje
vacío estándar ("Sin datos todavía"), nunca "no disponibles".

`_tourCollectStatsForTour` cae a `_tourStatsFromCfgResults(cfg)` cuando
el store en memoria está vacío (tras recarga).

### Reglas a respetar

1. **PROHIBIDO** que una caja de stats "en vivo" dependa de un único
   camino de agregación sin fallback. Toda caja que compute desde
   `cfg.results` debe encadenar `_tourStatsFromCfgResults` como red de
   seguridad (usa home/away + realTeam, sin early-return).
2. **PROHIBIDO** que `_tourCollectStatsForTour` u otra caja lea SOLO
   `LIGA_PLAYER_MATCH_STORE` (memoria volátil). Siempre con fallback a
   `cfg.results` persistido.
3. **PROHIBIDO** el literal "Estadísticas no disponibles." como
   estado vacío. Usar el mensaje estándar "Sin datos todavía — juega o
   simula partidos para ver estadísticas." y SIEMPRE envolver el render
   en try/catch para no dejar el placeholder colgado.
4. **Todo sim IA-vs-IA de torneo** debe adjuntar `events` +
   `home`/`away` al `cfg.results[mk]` vía `_tourAttachActa` (o
   `_tourSaveHumanResult` para humanos). Sin events no hay goleadores
   que mostrar — es la fuente única de las cajas "en vivo".
5. **El índice key→{home,away} de los agregadores DEBE reconstruir el
   fixture cuando falte** (bug Trofeo Joan Gamper 2026-06-27, foto
   usuario: torneo de verano `format='league'` con J1 jugada y la caja
   `s-tour-stats` en «Sin datos todavía»). `cfg.fixture` (liga) y
   `cfg.groupFixtures` (grupos) se construyen LAZY al renderizar la
   pantalla del torneo (`_renderLeague`/grupos). Si el usuario entra
   DIRECTO a Estadísticas, recarga, o el cfg llegó de otro dispositivo /
   del servidor con los resultados guardados SOLO-MARCADOR (sin
   `home`/`away`), no existen → sin ellos NINGÚN partido resuelve su
   equipo → caja VACÍA pese a haber partidos jugados. `groupFixtures` ya
   se reconstruía en `_tourBackfillActasFromResults`; faltaba reconstruir
   `cfg.fixture` (liga). Helper único `_tourEnsureLeagueFixture(cfg, tt)`
   (round-robin DETERMINISTA sobre el orden de `cfg.teams`, idéntico al
   de `_renderLeague` → las claves `<j>_<mi>` coinciden con `cfg.results`),
   usado por `_tourBackfillActasFromResults` Y `_mundialStatsRobustScan`.
   **PROHIBIDO** que un agregador de torneo lea `cfg.fixture`/
   `groupFixtures` SOLO si están presentes sin reconstruirlos: un cfg sin
   fixture (entrada directa, recarga, sync solo-marcador) vacía la caja.

### La caja `s-mundial-stats` (Mundialito Clubes) — RENDER-FIRST como el Mundial 2032 (obligatorio, 2026-06-09)

**Bug (fotos usuario 2026-06-09)**: con la fase de grupos del Mundialito
de Clubes jugada (goles visibles en la clasificación), la pantalla
`Mundialito Clubes · Estadísticas` (`s-mundial-stats`) se quedaba
**colgada en el placeholder "Calculando estadísticas…"** — no emergía
NI UNA estadística. La caja del **Mundial 2032** (Selecciones) sí
muestra todo al instante.

**Causa raíz — separate-screen vs inline**: el Mundial 2032 pinta su
caja de stats **INLINE y SÍNCRONA**: `_mundialGo('mundial','stats')`
llama a `_tourRender` DIRECTO (función plana) → `_mundialStatsHtml`
devuelve el HTML y se asigna `innerHTML` en el mismo tick. NUNCA
depende de timing. El Mundialito de Clubes usaba una pantalla SEPARADA
(`s-mundial-stats`) cuyo `_renderMundialitoStats` solo corría vía
disparos diferidos (`setTimeout` de `_mclSchedule`, wraps de
`window.go`, MutationObserver). El placeholder hardcoded
"Calculando estadísticas…" SOLO se reemplazaba si/cuando ese render
diferido llegaba a completar — y fallaba repetidamente (2026-06-01,
06-04, 06-09).

**Fix — copiar los 2 rasgos de fiabilidad del Mundial 2032**:
1. **RENDER-FIRST**: `_renderMundialitoStats` pinta el ESQUELETO de las
   11 cajas (`_mundialRenderStatsGrid({})`) de forma SÍNCRONA al entrar,
   antes de cualquier agregación. El placeholder "Calculando…" JAMÁS
   persiste, pase lo que pase con el cómputo. El cómputo PESADO
   (backfill + robustScan + fallbacks) se DIFIERE a `setTimeout(0)` en
   `_mclComputeAndPaint` (regla "render no bloqueante").
2. **INVOCACIÓN SÍNCRONA**: `_mclSchedule` llama a
   `_renderMundialitoStats()` SÍNCRONO en el mismo tick del clic (como
   `_mundialGo` → `_tourRender`), no solo vía `setTimeout`. + 2ª pasada
   a 260 ms tras la hidratación de plantillas.

**Reglas a respetar**:
5. **PROHIBIDO** que `s-mundial-stats` vuelva a depender SOLO de
   disparos diferidos (`setTimeout`/go-wrap) para matar el placeholder.
   `_renderMundialitoStats` debe pintar el esqueleto SÍNCRONO al entrar
   (render-first) y `_mclSchedule` invocarlo SÍNCRONO en el clic.
6. **PROHIBIDO** correr el cómputo pesado (`_mclComputeAndPaint`)
   síncrono ANTES del esqueleto: bloquea el hilo al abrir la caja. Va
   diferido a `setTimeout`, igual que `_tourStatsOpen` / `STATS_SCREENS`.

### TODA caja de stats tiene DOBLE DISPARO: observer + go-wrap (obligatorio, 2026-06-09)

**Petición usuario 2026-06-09**: «cada caja de estadísticas emergen con
los eventos de esa competición con doble disparo (observer + go-wrap /
render directo)». El síntoma "caja colgada en el placeholder"
(Mundialito) se debía a un ÚNICO disparo (MutationObserver) que, si no
saltaba, dejaba el placeholder para siempre. Las cajas que NUNCA
fallaron (Liga, Superliga) tienen DOS disparos independientes.

Inventario de disparos por caja (TODAS con doble disparo · auditado):

| Caja(s) | Render | Disparos |
|---|---|---|
| Liga EA (Liga+Copa+SC España) `s-liga-stats` | `buildLigaStatsDashboard` | go-wrap (3 pasadas) + DOMContentLoaded |
| Superliga `s-superliga-stats` | `build` | observer + go-wrap + DOMContentLoaded |
| Recopa · USC · Inter · Supercopa España (`STATS_SCREENS`) | `_lextBuildCompStatsDashboard` | observer + `_installStatsGoWrap` (go-wrap) + DOMContentLoaded |
| Champions · Europa · Conference | `_renderUcl/Uel/UeclStats` | observer + go-wrap (`_eurStatsWrap`) + DOMContentLoaded |
| Mundialito Clubes `s-mundial-stats` | `_renderMundialitoStats` | render-first + `_mclSchedule` síncrono + go-wrap + observer |
| Mundial 2032 (`mundial-48`) | `_mundialStatsHtml` | inline síncrono vía `_mundialGo`→`_tourRender` (render directo) |
| Selecciones ROAD / Rondas Finales (spv/sfn) + Torneos de Verano | `_tourCollectStatsForTour` | botón 📊 → `_tourStatsOpen` (render-first, render directo) |
| Segunda · 1ª RFEF | `renderStats` | render directo on-load + on-sim |

**Reglas a respetar**:
7. **PROHIBIDO** que una caja de stats dependa de UN SOLO disparo
   (solo observer, o solo go-wrap, o solo onclick). SIEMPRE observer de
   `.active` **+** wrap de `window.go` (o, si es inline, render directo
   vía `_tourRender`/`_tourStatsOpen`). El bundle re-define `window.go`
   tras evaluar el partial, así que el go-wrap se instala TAMBIÉN en
   `DOMContentLoaded` (no solo a parse-time).
8. Todo wrap de `window.go` lleva su FLAG propio (`_statsScreensWrap`,
   `_eurStatsWrap`, `_mclStatsGoWrap`…) para no re-envolverse y para
   COEXISTIR encadenando el `go` anterior. NUNCA pisar un wrap existente.
9. El render que dispara el wrap debe SIEMPRE asignar `innerHTML`
   (`_lextBuildCompStatsDashboard` lo hace con try/catch → estado vacío),
   nunca `return` antes de pintar dejando el placeholder.
10. **Toda comp NUEVA de SELECCIONES cuyo nombre empiece por «Road»**
    (Rondas Previas, board `sel-previa`) — y toda Ronda Final (board
    `sel-final`, salvo `mundial-48` que ya lo trae en su menú) — hereda
    AUTOMÁTICAMENTE el botón verde 📊 ESTADÍSTICAS vía `_tourStatsBtnHtml`
    en `_paintTourScreen`. No hardcodear por nombre; sale del board.

## Separación CLUBES vs SELECCIONES en estadísticas (obligatorio, 2026-05-27)

**REGLA BLOQUEANTE ABSOLUTA**: las **estadísticas de jugadores** del
**MUNDIALITO de CLUBES** (cfg.id `'mundial'`, slot built-in
`tour_mundial_v1`, format `groups-ko`) y las de los **Torneos de
Verano** (Trofeo Joan Gamper, Soccer Champions Tour, Premier Summer
Series, Asian Tournament, `tx1..tx8`) NO pueden contener jugadores
de SELECCIONES NACIONALES (Mundial 2032 / Rondas Previas /
amistosos de selección). Y viceversa.

### Por qué esta regla existe (bug 2026-05-27)

Captura usuario: `Torneos de Verano · Trofeo Joan Gamper ·
Estadísticas · Goleadores` mostraba:
1. Kylian Mbappe · FRANCIA — 4 goles
2. Jugador B · AL ITTIHAD CLUB — 3 goles
3. Rafael Borre · COLOMBIA — 3 goles
4. Moises Caicedo · ECUADOR — 3 goles
5. Inaki Williams · GHANA — 3 goles
6. Jugador B · HAITI — 3 goles

El leak ocurría porque `rebuildPlayerStatsStore` (Source 3, iteración
de `tour_*_v1`) clasificaba todo cfg con `id !== 'mundial'` al bucket
`torneos`. Los slots `spv1..spv10` (Rondas Previas) y `sfn1..sfn10`
(Rondas Finales) de Selecciones caían igual ahí.

### Reglas de clasificación canónica

| Cfg / matchKey                                  | Bucket          | Store                          | Pantalla            |
|-------------------------------------------------|-----------------|--------------------------------|---------------------|
| `cfg.id === 'mundial'` (Mundialito Clubes)      | `mundial`       | `ef_player_stats_mundial_v1`   | `s-mundial-stats`   |
| `cfg.id ∈ {sct,pss,jg,asia,tx1..tx8}`           | `torneos`       | `ef_player_stats_torneos_v1`   | `s-torneos-stats`   |
| `cfg.id ∈ {spv1..spv10,sfn1..sfn10}` o `format='mundial-48'` | `sel` | `ef_player_stats_sel_v1`       | (per-tour vía `s-tour-stats`) |
| matchKey con `tour_spv` / `tour_sfn`            | `sel`           | mismo                          | mismo               |
| matchKey con `cal-sel*` / `cal-mf-*`            | `sel`           | mismo                          | mismo               |

### Reglas a respetar

1. **PROHIBIDO** modificar el split de Source 3 en
   `rebuildPlayerStatsStore` para que vuelva a clasificar `spv*`/
   `sfn*` o cfgs `format='mundial-48'` al bucket `torneos`. La regla
   "Mundialito de Clubes = clubes / Mundial 2032 = selecciones, JAMÁS
   mezclar" es absoluta.
2. **PROHIBIDO** quitar el check temprano `tour_spv`/`tour_sfn` →
   `sel` de `_competitionFromMatchKey`. Sin él, los matches de
   Mundial 2032 abiertos vía `_tourOpenHumanMatch` (compKey
   `'torneo'` singular) y sus matchKeys (con `|torneos|`) caían a
   `torneos` por el match `tour_` o `|torneo|` de abajo.
3. **PROHIBIDO** dejar `if (!buckets[comp]) comp = 'liga';` sin
   normalización vía `_competitionFromMatchKey`. Los compKeys
   `'torneo'` (singular, Mundial 2032) y `'sel-fin'` (cal-mf-*)
   NO existen como bucket directo (`buckets.torneo` /
   `buckets['sel-fin']` son `undefined`) → caían a `liga`.
4. **Toda comp NUEVA** que añada un slot al motor `_tour*` con
   format de selecciones debe heredar la clasificación a `sel`
   (idealmente añadiendo su id al regex `^(spv|sfn|XXX)\d+$` y/o
   añadiendo su `format` a la detección por format).
5. La regla aplica igual al revés: las pantallas de Selecciones
   (s-tour-stats por cfg, o `s-sel-stats` si existe) NO deben
   recibir jugadores de clubes del Mundialito ni de Torneos de
   Verano. El mapeo es 1-a-1 por id de torneo.

## MISTERS_REGISTRY — fuente única canónica de humanos (obligatorio, 2026-05-27)

**Propuesta usuario 2026-05-27** (foto pantalla `👤 EQUIPOS` del menú
principal): cada caja del menú EQUIPOS mapea un **mister humano** a
**UN club** + **UNA selección**. Es la fuente de verdad para "quién
es humano esta temporada".

### Los 6 misters canónicos

| Pantalla (`screen`) | Club | Mister (emoji) | Selección |
|---------------------|------|----------------|-----------|
| `s-munich`   | Liverpool        | Toñín 💡  | Francia    |
| `s-arsenal`  | Arsenal          | Álvaro 🐭 | Brasil     |
| `s-madrid`   | Real Madrid      | Acsa 🔨   | Inglaterra |
| `s-atletico` | Atlético Madrid  | Isra ✏️   | Noruega    |
| `s-barca`    | FC Barcelona     | Ángel 😈  | Argentina  |
| `s-psg`      | PSG              | Izan 🦆   | España     |

Cada mister dirige **AMBOS** equipos: pulsando su caja del menú se
abre la pantalla con calendario + competiciones del club + la selección.

### Registry canónico

`window._MISTERS_HUMANOS` (definido en `misc_body_1.html`, IIFE
HUMANIDAD POR COMPETICIÓN, JUSTO antes de `SEL_COMPS`):

```js
var MISTERS_HUMANOS = [
  { id:'tonin',  emoji:'💡', mister:'Toñín',  club:'Liverpool',        seleccion:'Francia',    screen:'s-munich'   },
  { id:'alvaro', emoji:'🐭', mister:'Álvaro', club:'Arsenal',          seleccion:'Brasil',     screen:'s-arsenal'  },
  { id:'acsa',   emoji:'🔨', mister:'Acsa',   club:'Real Madrid',      seleccion:'Inglaterra', screen:'s-madrid'   },
  { id:'isra',   emoji:'✏️', mister:'Isra',   club:'Atlético Madrid',  seleccion:'Noruega',    screen:'s-atletico' },
  { id:'angel',  emoji:'😈', mister:'Ángel',  club:'FC Barcelona',     seleccion:'Argentina',  screen:'s-barca'    },
  { id:'izan',   emoji:'🦆', mister:'Izan',   club:'PSG',              seleccion:'España',     screen:'s-psg'      }
];
```

Es **HARDCODED**, **SÍNCRONO**, y NO depende de NADA externo:
- ❌ NO depende de hidratación de `selecciones_squad_v1`
- ❌ NO depende de flag `isHuman` en cfgs del torneo
- ❌ NO depende del DOM del menú EQUIPOS estar renderizado
- ❌ NO depende de fetch del servidor

### Helpers públicos (todos sync, todos infallible)

- `window._isHumanSeleccionCanonica(name)` → bool. ¿Es Francia/Brasil/…?
- `window._isHumanClubCanonico(name)` → bool. ¿Es Liverpool/Arsenal/…?
  Acepta alias legacy ("Bayern Munich" / "Bayern" / "LFC" → Liverpool).
- `window._mhFindMister(name)` → mister object o null. Útil para saber
  qué mister dirige al equipo.
- `window._mhSameMister(a, b)` → bool. ¿`a` y `b` los dirige el mismo
  mister? Ej: `_mhSameMister('Liverpool','Francia')` → true (Toñín).

### `isHumanInComp` consulta el registry primero

`isHumanInComp(name, comp)` ahora tiene una CAPA 0 antes que TODAS las
demás:

```js
window.isHumanInComp = function(name, comp){
  // CAPA 0 — MISTERS_REGISTRY (sync, hardcoded, infallible):
  if (SEL_COMPS[c] && _isHumanSeleccionCanonica(name)) return true;
  if ((EUR_COMPS[c] || DOM_COMPS[c] || c === 'superliga')
      && _isHumanClubCanonico(name)) return true;
  // CAPA 1+ — fallbacks asincrónicos (_esSelHumana, _hasHumanIcon, etc.)
  ...
};
```

Como TODOS los flujos del juego pasan por `isHumanInComp` (gracias a
las defensas previas), la CAPA 0 garantiza que el bug 2026-05-27
JAMÁS pueda reproducirse, incluso aunque el resto de capas estén
rotas.

## Detección de SELECCIONES humanas — fuente única `_esSelHumana` (obligatorio, 2026-05-27)

**REGLA BLOQUEANTE ABSOLUTA**: las **6 selecciones humanas canónicas**
(Francia 💡, Brasil 🐭, Inglaterra 🔨, Noruega ✏️, Argentina 😈,
España 🦆) DEBEN ser detectadas como humanas en TODOS los flujos del
proyecto que toquen partidos de selección, **independientemente de
cualquier estado asincrónico** (hidratación de `selecciones_squad_v1`,
flag `isHuman` en el cfg del torneo, fetch del servidor, etc.).

### Por qué esta regla existe (bug 2026-05-27)

El usuario reportó con captura "Liverpool/Francia · 03 May" que la
card "Próximo partido" del hub mostraba `🌍 SELECCIONES · JUGADORES
FUERA · CONTINUAR ▶` en lugar del partido real `Francia vs Rep.
Checa` (Mundial Grupo — J1). La causa raíz:

1. `_selPair` resolvía al humano con 2 pases: (1) `t.isHuman` flag, y
   (2) `isHumanInComp(name, 'mundial')`.
2. `isHumanInComp('Francia', 'mundial')` cae a `_hasHumanIcon` →
   `humanIcon('Francia')` → depende de `_SEL_HUMAN_ICONS` hidratado
   desde `selecciones_squad_v1`.
3. Si el admin no marcó Francia `isHuman:true` en el cfg del Mundial
   **Y** la hidratación async aún no había corrido al primer render,
   ambos pases fallaban → `_candidates` vacío → `_selPair` retornaba
   null → card del hub mostraba JUGADORES FUERA.
4. **Mismo bug afectaba a 6 sitios más en paralelo**: `_gmHumanInvolved`
   (cronómetro caía a IAIA 90s en vez de HvH 16.5min / HvIA 9.75min),
   `_mlTeamIsHumanEnd` (no se mostraba stats overlay obligatorio),
   `_mlTeamIsHuman` (sanciones mal aplicadas), `_mlPlayerValuationAjax`
   (auto-pick saltaba al jugador del rival), `athRivalIsHuman` (PI
   médicos incorrectos), `_psTeamIsHumanGeneric` (auto-sim fase previa).

### Fuente única canónica

`window._esSelHumana(name)` (definido en `static/js/index.bundle.js`
en el bloque IIFE SANCIONES + LESIONES — SELECCIONES NACIONALES):

```js
var SEL_HUMANAS = ['Francia','Brasil','Inglaterra','Noruega','Argentina','España'];
function esSelHumana(name){
  // Normaliza (sin tildes, lowercase) y compara contra SEL_HUMANAS.
  // Fallback: `_SEL_HUMAN_ICONS` si el usuario añadió otras humanas
  // vía editor (selecciones_squad_v1.teams[].icon).
}
window._esSelHumana = esSelHumana;
```

Es **SÍNCRONO**, **NO depende de hidratación**, y la lista es
**HARDCODED** en el bundle.

### Defensas en capas (todas obligatorias)

1. **`isHumanInComp` parchado** (`misc_body_1.html`, IIFE HUMANIDAD POR
   COMPETICIÓN): para los comps de selección (`SEL_COMPS = {sel,
   sel-fin, mundial, torneo, mundial-48, selecciones}`), `isHumanInComp`
   consulta `_esSelHumana` ANTES que `_hasHumanIcon`. Así CUALQUIER
   código que use `isHumanInComp(name, 'mundial')` queda inmunizado de
   una vez sin tocar el call site.
2. **Pase 3 explícito en `_selPair` y `_findHumanTeam`**: belt-and-
   suspenders. Si el código itera cfg.teams en busca de humanos, tras
   los pases `isHuman` + `isHumanInComp`, hace un Pase 3 con
   `_esSelHumana`. Garantiza detección incluso si alguien rompe
   `isHumanInComp` en el futuro.
3. **`_psTeamIsHumanGeneric` con Pase 3**: el helper que clasifica
   teams como humanos en `_psListPendingGroupMatches` /
   `_psListPendingKoMatches` también añade fallback `_esSelHumana`.
4. **Watchdog + AUTO-HEAL en `_psRender`** (2026-05-27 → upgrade
   2026-05-28): cuando la card cae a JUGADORES FUERA en un día Mundial
   Selecciones (`ag-sel` + label contiene 'mundial') PERO existe un
   cfg mundial-48 con una selección humana canónica en `cfg.teams`,
   ADEMÁS del `console.warn` diagnóstico, el watchdog **reconstruye
   automáticamente** todo el estado del Mundial vía
   `_psEnsureMundialStateRebuilt()` y **reintenta `_selPair` SOLO**,
   sin que el usuario tenga que pulsar 🔍 RECUPERAR PARTIDO. Esto hace
   que esta CLASE de fallo (card JUGADORES FUERA falsa con humana
   canónica) se arregle **para siempre de forma automática**, sin
   tocar código. Guard anti-bucle: `st._psAutoHealSig === sig` →
   auto-heal corre como mucho UNA vez por día. Si tras reconstruir
   `_selPair` sigue null, cae a `_cardRest` (con el botón manual de
   respaldo). **PROHIBIDO** degradar el watchdog a solo-warn otra vez:
   el auto-heal es lo que evita que el usuario tenga que reportar
   capturas y pagar código por cada regresión.
   - `_psEnsureMundialStateRebuilt()` (núcleo común, idempotente y
     barato): (1) `_selSquadHydrate`, (2) `_invalidateHumanTeamCache`,
     (3) `_tourLoadCachedSync` de todos los slots Mundial, (4)
     construye `cfg.groupFixtures` (vía `window._mundialGroupState`,
     el MISMO builder de la pantalla del torneo) + chain de brackets
     KO (`_psAutoChainBuildMundial`) en cada cfg mundial-48, y
     persiste lo que cambie. Lo usan el AUTO-HEAL del watchdog Y el
     botón manual `_recoverSuspiciousRest`.
   - **Root cause 2026-05-28**: `cfg.groupFixtures` solo se construía
     (lazy) al renderizar la pantalla del torneo (`_mundialGroupState`).
     La card del hub (`_selPair → _resolveForHuman`) los necesita para
     localizar el partido del humano; sin ellos devolvía null →
     JUGADORES FUERA. Fix: `_selPair` ahora los construye+persiste
     ANTES de resolver (mismo builder canónico), y el auto-heal los
     reconstruye si por cualquier vía futura faltaran.
5. **Botón `🔍 RECUPERAR PARTIDO` en `_cardRest`** (2026-05-27,
   propuesta usuario): si la card cae a JUGADORES FUERA pero el scan
   `_scanForCanonicalMundialMatch` detecta que SÍ hay cfg mundial-48
   con humana canónica, el botón `CONTINUAR ▶` se reemplaza por:
   - Aviso ámbar `⚠️ Hay partido programado para <Selección> pero la
     card no lo detectó`.
   - Botón principal `🔍 RECUPERAR PARTIDO` que dispara la cascada:
     (1) `_selSquadHydrate()` (re-cargar selecciones_squad_v1),
     (2) `_invalidateHumanTeamCache()` (limpiar caché),
     (3) `_tourLoadCachedSync` para TODOS los slots,
     (4) `_psAutoChainBuildMundial` (construir brackets KO pendientes),
     (5) scan diagnóstico loggeado en consola,
     (6) `_psRender()` forzado (limpia sig de idempotencia),
     (7) si tras 200ms sigue en JUGADORES FUERA, toast/alert con
         info diagnóstica al usuario.
   - Botón secundario pequeño `CONTINUAR ▶ (saltar día)` para mantener
     la opción legacy si el usuario decide ignorar la recuperación.

   Es la última línea de defensa USER-FACING: si todas las capas
   internas fallan, el usuario tiene un botón visible para forzar la
   recuperación sin recargar la página.

### Reglas a respetar (PROHIBICIONES)

1. **PROHIBIDO** crear código nuevo que detecte humanos de selección
   usando SOLO `t.isHuman` (flag del cfg). Siempre añadir fallback
   `_esSelHumana(t.name)`.
2. **PROHIBIDO** usar SOLO `isHumanInComp` sin entender que para SEL_COMPS
   YA incluye `_esSelHumana`. Para comps que NO están en SEL_COMPS pero
   donde pueden aparecer selecciones (eventos custom), añadir el fallback
   explícito en el call site.
3. **PROHIBIDO** quitar la lista hardcoded `SEL_HUMANAS` o eliminar
   `_esSelHumana` del bundle. Es la última línea de defensa.
4. **PROHIBIDO** añadir selecciones nuevas a `SEL_HUMANAS` sin avisar
   al usuario explícitamente. Las 6 son canónicas (2026-05-24). Si
   el admin marca otras como humanas vía editor, se reconocen vía
   `_SEL_HUMAN_ICONS` automáticamente.
5. **PROHIBIDO** quitar SEL_COMPS de `isHumanInComp` o reordenar el
   chequeo para que `_hasHumanIcon` se ejecute ANTES de `_esSelHumana`
   — eso reintroduce el race con la hidratación.
6. **PROHIBIDO** silenciar / borrar el watchdog en `_psRender`. Es la
   herramienta que descubrirá la próxima regresión sin que el usuario
   tenga que reportar otra captura.
6b. **PROHIBIDO** quitar el botón `🔍 RECUPERAR PARTIDO` de `_cardRest`
   o cambiar su keyword sin acuerdo con el usuario. La keyword
   "RECUPERAR PARTIDO" fue elegida por el usuario para que cuando vea
   la card JUGADORES FUERA en un día con partido, pulse el botón y la
   web auto-diagnostique + auto-recupere sin que él tenga que
   investigar manualmente.
7. **Toda comp NUEVA** donde puedan aparecer selecciones (Eurocopa,
   Copa América, Confederaciones, amistosos de selección, etc.) debe
   añadirse a `SEL_COMPS` Y, si tiene su propio flujo de detección de
   humanos, también heredar el Pase 3 `_esSelHumana`.

### Resumen visual

```
┌─────────────────────────────────────────────────────────────────┐
│ Hub Liverpool/Francia → card "Próximo partido" 03 May          │
│ ├─ day.cls = 'ag-sel'  +  label = 'Mundial Grupo — J1'         │
│ ├─ _selPair(day)                                                │
│ │   ├─ Pase 1: t.isHuman                          ← admin manual│
│ │   ├─ Pase 2: isHumanInComp(name,'mundial')      ← SEL_COMPS  │
│ │   │            → _esSelHumana   ← BLINDAJE 1   │              │
│ │   └─ Pase 3: _esSelHumana(t.name) directo       ← BLINDAJE 2  │
│ ├─ Si TODOS los pases fallan:                                   │
│ │   └─ Watchdog scan: ¿hay humana canónica en algún cfg?       │
│ │       → console.warn loud                       ← BLINDAJE 3  │
│ │   └─ _cardRest detecta SOSPECHA y muestra botón              │
│ │       🔍 RECUPERAR PARTIDO en vez de CONTINUAR ▶ ← BLINDAJE 4 │
│ └─ Render: Francia vs Rep. Checa  (NUNCA JUGADORES FUERA)      │
└─────────────────────────────────────────────────────────────────┘
```

## Jornada / ronda CUMPLIDA → cabecera GRIS (obligatorio, 2026-05-27)

Cuando una jornada de grupo o una ronda KO tiene **TODOS** sus
partidos jugados (con resultado `played === true`), el botón de
cabecera de esa jornada/ronda (`.jbtn` en `.jblock`) debe salir en
**color gris** para distinguirla de las que aún están pendientes.

Aplica a **todas** las competiciones que rinden con el patrón
`.jblock + .jbtn.c-<comp>`:

| comp class       | done style                  | dónde lo añade el JS                                                   |
|------------------|------------------------------|------------------------------------------------------------------------|
| `c-mundialito`   | gris (regla CSS bloqueante)  | _tour engine (Mundialito Clubes)                                       |
| `c-mundial`      | gris (regla CSS bloqueante)  | `_mundialGroupsHtml` (jornadas de grupo) + `row()` de `_mundialKoHtml` (rondas KO) en `misc_body_1.html` |
| `c-superliga`    | oro/trofeo (excepción)       | `s-superliga-clas.html` + `part2/misc_body_2.html` — color de campeón, NO se gris-ifica |

Las reglas CSS gris viven juntas en
`templates/partials/misc_body_1.html` (~líneas 12190-12215), bloque
"Jornada YA JUGADA → botón gris". La gradiente gris es:
```
linear-gradient(90deg,#1a1d22,#2a2e36,#3a3e48,#2a2e36,#1a1d22)
```
con borde `rgba(170,180,195,.45)`, `filter:grayscale(.5) brightness(.85)`
y `color:rgba(255,255,255,.55)`.

### Cómo detectar "todos los partidos jugados"

El JS construye el botón con la clase `done` cuando todos los partidos
de esa jornada / ronda están con resultado. Ejemplos canónicos:

```js
// _mundialGroupsHtml: jornada de grupo
var allDone = true;
jor.forEach(function(_, mi){
  var r = (cfg.results[gKey+ji+'_'+mi]||{});
  if (!r.played) allDone = false;
});
html += '<button class="jbtn c-mundial' + (allDone ? ' done' : '') + '" ...>';
```

### Reglas a respetar

1. **Toda nueva competición** que use el patrón `.jblock + .jbtn.c-<comp>`
   en una pantalla de torneo (`s-<comp>-clas`, `s-<comp>-stats`,
   pantalla del hub `_tour*`, etc.) DEBE:
   - Añadir la clase `done` al `.jbtn` cuando todos los partidos de la
     jornada/ronda estén jugados.
   - Tener su regla `.jbtn.c-<comp>.done` en el bloque CSS gris (o
     reutilizar las existentes si comparte gradient base).
2. **PROHIBIDO** dejar una jornada cumplida con la cabecera del color
   activo de la comp (rojo Liga, rosa Mundial-48, etc.). Eso confunde
   al usuario sobre qué jornadas siguen pendientes.
3. **PROHIBIDO** eliminar la regla `.jbtn.c-mundial.done` /
   `.jbtn.c-mundialito.done` sin reemplazo equivalente. El base color
   de `c-mundial` (`#5a0030 → #c8205a` en `static/css/index.bundle.css`)
   usa `!important`, así que la regla `.jbtn.c-mundial.done` también
   debe llevar `!important` para ganarle (especificidad 0,3,0 vs 0,1,0).
4. **Excepción documentada — Superliga**: el "done" de Superliga
   (`#s-superliga-clas .jbtn.c-superliga.done` en
   `part2/misc_body_2.html:873`) usa gradient **oro/trofeo** en lugar
   de gris. Es intencional (decisión de diseño previa, color trofeo
   `#F1C40F`). NO modificar sin acuerdo con el usuario.

### Histórico

- 2026-05-27: usuario reporta foto del Mundial 2032 (Grupo A:
  Filipinas/Senegal/Kuwait/Jordania) con J1 y J2 cumplidas saliendo
  en color rosa/magenta pese a tener todos los partidos con FIN. El
  JS ya añadía la clase `done` (líneas 20392 y 20643 de
  `misc_body_1.html`) pero faltaba la regla CSS
  `.jbtn.c-mundial.done`. Añadida al bloque junto a
  `.jbtn.c-mundialito.done` (líneas 12200-12215).

## Mundialito de Clubes — diseño AMARILLO + flujo Resto del Mundo (obligatorio, 2026-05-27)

El **Mundialito de Clubes** vive en el slot built-in `'mundial'` del
motor `_tour*` (NO confundir con `mundial-48`, que es Mundial 2032
de selecciones). Spec canónica (CLAUDE.md regla bloqueante):

- **32 equipos** = 16 europeos (admin elige MANUALMENTE) + 16 de la
  liga `ligaExt_resto-mundo` (TOP 16 automáticos tras los 42 partidos).
- **Format**: `'groups-ko'` con `formatConfig.groups=8`, `perGroup=4`,
  `advancePerGroup=2`, `koRounds=['Octavos','Cuartos','Semis','Final']`.
- **Top 2 de cada grupo** → Octavos (16 equipos). Octavos → Cuartos →
  Semis → Final, todo a **PARTIDO ÚNICO con ET + penaltis** (`koExtraTimePens:true`).
- **NO hay 3er/4º puesto.** Solo 4 rondas KO.
- **No excluye ligas**: cualquier equipo europeo (cualquier liga) puede
  ser elegido por el admin como uno de los 16 europeos.
- **Humanos**: los marca el admin manualmente al lanzar el torneo
  (igual que Superliga). Cualquier humano puede ser elegido para el
  Mundialito independientemente de los humanos canónicos de Liga EA.
- **Frecuencia**: lo lanza el admin desde la pantalla Resto del Mundo
  (`s-lext` con `slug==='resto-mundo'`) cuando los 42 partidos están
  completos. El motor NO lo arranca solo cada N temporadas — es
  bajo demanda.

### Color visual: AMARILLO `#ffd633` (no azul cobalto)

Petición usuario 2026-05-27. El Mundialito tiene **el mismo formato
visual que el Mundial 2032** (mismas cards `.mn-card`, mismo layout
de grupos + KO, mismas tablas de clasificación) **pero en amarillo**
en lugar de azul cobalto + dorado.

Ubicación de los overrides amarillo (`#ffd633`):

1. **`#s-mundial .tour-group-block`** (CSS scopeada): grupos en
   gradiente amarillo `#2a1f00 → #5a4408 → #1a0f00` con borde
   `rgba(255,214,51,.55)`.
2. **`.mn-card[data-tour="mundial"]`** (selector per-card via
   `data-tour` que `_koRowHtml` añade): cards KO en amarillo, sin
   afectar a Mundial 2032 (sfn*) ni a otros torneos (jg/asia/sct/pss).
3. **Hub `s-mundial-clubes`** (5 cajas): clase **`c-mundialito`**
   (NO `c-mundial`) con gradiente amarillo. La clase `c-mundial`
   sigue siendo cian/turquesa para Mundial 2032 calendar slots.
4. **gm-modal**: clase **`is-comp-mundialito`** con
   `--comp-color:#ffd633`. La detecta `_gmCompFromState` cuando
   `g._tourId === 'mundial'` (override ANTES de la rama 'torneo'
   genérica que daría violeta).

### Slots del calendario (calendario.json + s-calendario.html)

Las 7 fechas FIJAS del Mundialito en `calendario.json` (icon `🌐` →
clase `ag-inter`):

| Fecha     | event.name                      | Slot s-calendario.html |
|-----------|---------------------------------|------------------------|
| 04 Jul    | Mundialito Clubes - J1          | `cal-mc-g1`           |
| 08 Jul    | Mundialito Clubes - J2          | `cal-mc-g2`           |
| 12 Jul    | Mundialito Clubes - J3          | `cal-mc-g3` (🌧)       |
| 16 Jul    | Mundialito Clubes - Octavos     | `cal-mc-oct`          |
| 20 Jul    | Mundialito Clubes - Cuartos     | `cal-mc-cua`          |
| 24 Jul    | Mundialito Clubes - Semis       | `cal-mc-sf`           |
| 28 Jul    | Mundialito Clubes - FINAL       | `cal-mc-fin`          |

**Conflicto con Mundial 2032 selecciones**: las fechas 04 Jul, 08 Jul,
12 Jul, 20 Jul COINCIDEN con `cal-mf-g3`, `cal-mf-g4`, `cal-mf-rep`,
`cal-mf-fin` (Mundial 2032 grupos J3/J4 + Repesca + FINAL). Asumimos
que **NUNCA se juegan ambos torneos la misma temporada** (cada uno
ocupa una temporada distinta del ciclo de 4 años). Si en el futuro
sí coexisten, habrá que mover las fechas o desolapar.

### Mapeo en `_realPair` (regla bloqueante CLAUDE.md)

`_realPair` detecta los días del Mundialito por la clase `ag-inter`
+ etiqueta `Mundialito Clubes - ...`, fuerza `tid='mundial'`
LOCALMENTE (sin persistir en `d.tour`) y mapea la etiqueta a
`_dayPartidoN`:

- `Mundialito Clubes - J1/J2/J3` → `_dayPartidoN = 1/2/3` → cj=0/1/2
- `Mundialito Clubes - Octavos` → `_dayPartidoN = 4` → _dayInKo, koIdx=0
- `Mundialito Clubes - Cuartos` → `_dayPartidoN = 5` → koIdx=1
- `Mundialito Clubes - Semis`   → `_dayPartidoN = 6` → koIdx=2
- `Mundialito Clubes - FINAL`   → `_dayPartidoN = 7` → koIdx=3

(`grpJors=3` fijo: 4 equipos × round-robin single-leg = 3 jornadas.)

`_cardMatch` también reconoce `_isMundialitoCalDay` (mismo regex) y
fuerza `tourNm = 'Mundialito de Clubes'` en el título de la card.

### Reglas a respetar

1. **PROHIBIDO** renombrar el tourId built-in `'mundial'` o cambiar
   su `format` a algo distinto de `'groups-ko'`. El motor entero
   (CSS, `_realPair`, calendario, hub, gm-modal) depende de esto.
2. **PROHIBIDO** usar la clase `c-mundial` en cualquier card NUEVA
   del Mundialito de Clubes — usar `c-mundialito`. `c-mundial` está
   reservada para Mundial 2032 selecciones (cyan/turquesa).
3. **PROHIBIDO** modificar `data-tour="mundial"` en `_koRowHtml`. Es
   el marker que pinta las cards KO en amarillo via
   `.mn-card[data-tour="mundial"]`.
4. **PROHIBIDO** persistir `d.tour='mundial'` desde `_realPair` en
   días Mundialito. El override es LOCAL al call — el flag
   `_isMundialitoDay` gates el bloque de persistencia.
5. **PROHIBIDO** caer al placeholder `_cardNonTour` en días
   Mundialito. `_cardMatch` debe detectar `_isMundialitoCalDay` y
   rutear al flow de torneo igual que `ag-torneo`.
6. **Si el admin no ha lanzado el torneo** (cfg `mundial` con teams
   vacíos), `_realPair` devuelve null para días Mundialito → la card
   del hub muestra CONTINUAR ▶. NO se inventa partido fantasma.
7. **Toda comp NUEVA cuyas filas usen `ag-inter`** (icono 🌐) ya
   queda enrutada a `_realPair` automáticamente — solo necesita su
   propia rama de parseo de `_dayPartidoN` y override local de `tid`.

## Card "Próximo partido" del hub: el CALENDARIO INDIVIDUAL es la única fuente de verdad (obligatorio, 2026-05-27)

**Principio bloqueante**: la card "Próximo partido" del hub Liverpool
(`#ps-stage` en `s-munich`) SIEMPRE deriva el rival a partir de la fila
actual del CALENDARIO INDIVIDUAL del Liverpool-Francia
(`_calRows()[d.dayIdx]`, las filas `.ag-r` del `#ag-content`). El label
de esa fila (`Partido N`, `Liga — J N`, `Copa — Ronda X`,
`Mundial Octavos`, `Champions — J3`, etc.) dicta qué partido se debe
mostrar, sin excepción.

### Por qué esta regla existe

Los cursores manuales (`d.tour`, `cfg.currentJornadaByGroup`,
`cfg.koCurrentRound`, `currentRound`…) **solo avanzan al pulsar
botones específicos** en la pantalla de cada torneo (🏆 J{N+1},
🏆 Avanzar KO, etc.). El usuario juega su partido desde la card del
hub directamente y NUNCA visita la pantalla del torneo, así que esos
cursores se quedan congelados en 0 → la card mostraba el mismo J1 los
días 08 Jun, 12 Jun, 16 Jun… (bug 2026-05-27 con foto Tigres UANL 1-2
Liverpool repitiéndose).

### Mapeo canónico (en `_realPair`)

1. Leer `d.dayIdx` y `_calRows()[d.dayIdx]`.
2. Extraer el número de la etiqueta:
   - Torneos de verano (JG/SCT/PSS/Asia): regex `Partido\s+(\d+)`.
     `Partido N` mapea a:
     - **Fase de grupos**: jornada `N-1` (0-indexed) de
       `cfg.groupFixtures[gIdx]` (override de `currentJornadaByGroup`).
     - **Fase KO** (si `koBracket` existe): ronda
       `N - groupJors - 1` de `cfg.koBracket` (override de
       `koCurrentRound`).
   - Liga EA Sports: regex `Liga\s*[—\-]\s*J(\d+)` → jornada de liga.
   - Otras competiciones: añadir su rama al parseo y mapeo cuando se
     incorporen.
3. Los cursores manuales (`currentJornadaByGroup`, `koCurrentRound`,
   `currentRound`) son **advisory** — solo se usan como fallback si
   el día actual no se puede derivar del calendario.

### Reglas a respetar

1. **PROHIBIDO** usar `cfg.currentJornadaByGroup[gIdx]` /
   `cfg.koCurrentRound` / `cfg.currentRound` como fuente PRIMARIA
   en la card del hub. Solo fallback cuando no hay día parseable.
2. **PROHIBIDO** crear cursores nuevos que requieran pulsar un botón
   para avanzar y luego usarlos en la card. Si una comp nueva añade
   esa lógica, se vuelve a hardcodear el bug.
3. **Toda comp nueva** que entre por `_realPair` / `_selPair` debe
   tener su rama en el parseo de "Partido N" / "J N" / "Ronda X" del
   calendario individual, ANTES de leer cualquier cursor del cfg.
4. **PROHIBIDO** introducir "auto-avance del cursor al jugar el
   partido" como alternativa a esta regla — es decir, prohibido usar
   "¿ya se jugó el partido?" como sustituto de leer el calendario para
   decidir QUÉ partido corresponde a cada día. Es un parche frágil: si
   el usuario pospone un día, los cursores y el calendario se vuelven a
   desincronizar. La regla `calendario = fuente única` es robusta
   por construcción. **Matiz 2026-07-17** (ver sección "El cursor del
   calendario del hub AVANZA SOLO"): esto NO prohíbe que `d.dayIdx` (el
   puntero de qué día es HOY para el hub) se autocorrija hacia
   ADELANTE cuando un partido de selección quedó confirmado `played`
   sin que el usuario pasara por CONTINUAR — esa es una corrección
   distinta, acotada, aprobada explícitamente por el usuario, que NUNCA
   retrocede ni toca días de Descanso/Entrenamiento.
5. **Fix de saves antiguos**: cuando un cfg legacy tenga cursores
   apuntando a una jornada distinta a la que demanda el calendario,
   `_realPair` ignora el cursor y respeta el calendario. La pantalla
   del torneo seguirá pintando el cursor (UI inconsistente con el
   hub si el usuario no pulsa "🏆 J{N+1}"), pero la card del hub
   siempre es correcta. Esto es aceptable — la card es lo crítico,
   la UI del torneo solo afecta a quien entre a la pantalla.

### Beneficios

- Estado-drift IMPOSIBLE: el calendario es inmutable per-temporada y
  todas las cards mapean determinísticamente.
- Funciona en cualquier dispositivo / sesión / hidratación parcial.
- No requiere que el usuario visite pantallas auxiliares para que la
  card del hub avance correctamente.
- Si una temporada futura cambia las fechas del calendario, todas las
  cards se reajustan automáticamente.

## Card "RIVAL PENDIENTE" en eliminatorias (obligatorio, 2026-05-26)

Cuando la card "Próximo partido" del hub Liverpool (`#ps-stage` en
`s-munich`) llega a una ronda KO de una eliminatoria
(Mundial selecciones, Mundialito Clubes, fases finales Champions/EL/
UECL, Recopa, Supercopas, Intercontinental, Copas, torneos de verano
con KO, etc.) pero el rival aún es TBD porque **la FASE PREVIA no se
ha simulado** (grupos pendientes o ronda KO N-1 pendiente), la card
muestra un estado de BLOQUEO en vez del legacy "JUGADORES FUERA ·
CONTINUAR ▶".

### Estado de bloqueo

- Banner ámbar `⚠️ RIVAL PENDIENTE — El admin aún no ha simulado <fase
  previa>. Avísale, o pulsa el botón para auto-simular los IA vs IA
  pendientes y desbloquear el sorteo.`
- Botón 📌 Posponer (top-left, igual que en cards normales): salta el
  día (no añade a PARTIDOS PENDIENTES porque no hay matchKey real).
- Botón principal `🤖 SIMULAR FASE PREVIA · +10 🪙` (turquesa): auto-
  simula los partidos IA-vs-IA de la fase previa con el motor 4-ejes,
  construye el bracket de la siguiente fase y RECOMPENSA al usuario
  con +10 🪙. La recompensa solo se acredita si se simuló ≥1 partido
  (idempotente — re-pulsar sin progreso no da más oro).

### Detección + sim (`misc_body_1.html`)

Helpers canónicos (IIFE PRETEMPORADA, líneas ~4100-4600):

- `_psDetectPendingPrevPhase(cfg, opts)`: detecta si la fase previa
  tiene partidos sin jugar. Recursa hacia atrás si la ronda previa
  tampoco existe (kb[N] empty → kb[N-1] empty → ... → groups empty).
- `_psListPendingGroupMatches(cfg, compKey)`: iteración round-robin
  de groupFixtures, devuelve `[{matchKey, home, away, hHuman, aHuman}]`.
- `_psListPendingKoMatches(cfg, koRoundIdx, bracketProp, compKey)`:
  iteración de pares del bracket. Marca `is2Leg` cuando el formato es
  `ko-2leg` para que la auto-sim los SALTE (el sim batched no replica
  la lógica IDA+VUELTA con desempate por gol visitante / penaltis).
- `_psAutoSimPendingPhase(tourId, pendingInfo)`: itera matches, sim
  solo IA-vs-IA (humanos sin tocar — cada humano debe jugar / posponer
  el suyo), persiste cfg con UN solo `_tourSave` final (batch).
  Devuelve `{simmed, humanRemaining}`.
- `_psBuildNextBracket(cfg, pendingInfo)`: tras la sim, construye el
  bracket de la siguiente fase (grupos → koBracket[0] para
  mundial-48 vía `_mundialQualifiers`; KO N → KO N+1 con
  `_tourRebalanceHumans`). Idempotente: salta si la fase aún tiene
  partidos pendientes.
- `_psAutoChainBuildMundial(cfg, tourId)`: chain-construye TODOS los
  brackets KO que se puedan construir (grupos → kb[0] → kb[1] → ...).
  Se llama al entrar a `_selPair` para sincronizar el estado sin que
  el usuario tenga que visitar la pantalla del torneo.
- `_cardPendingPrevPhase(day, info)`: renderiza la card de bloqueo
  + wire-up de POSPONER y SIMULAR FASE PREVIA.

### Reglas a respetar

1. **Los humanos NUNCA se auto-simulan.** `_psAutoSimPendingPhase`
   los cuenta como `humanRemaining`. Si el grupo / ronda contiene
   partidos con otro humano (Brasil, Inglaterra, Noruega, Argentina,
   España, o cualquier humano de club en otra eliminatoria), el botón
   sigue activo solo si quedan IA-vs-IA; cuando solo restan humanos,
   el botón desaparece y la card muestra "⏳ Quedan N partidos con
   humanos sin jugar."
2. **+10 🪙 fijos por desbloqueo**, NO por partido. Evita farmeo en
   torneos con 70+ partidos previos.
3. **Solo se acredita si `simmed > 0`.** Re-pulsar sin progreso
   (todos sim'd o humanos pendientes) no da oro, solo toast neutro.
4. **No reintroducir el legacy CONTINUAR ▶** sobre "JUGADORES FUERA"
   en cards con rival TBD por fase previa pendiente — eso es el bug
   2026-05-26 que esta regla arregla (el usuario saltaba el día y
   nunca recuperaba su KO).
5. **ko-2leg está fuera de cobertura batch.** Esos torneos (rara vez
   los hay en el hub Liverpool) mantienen su flujo manual / pay-per-leg.
6. **Toda eliminatoria NUEVA** que se añada al juego con KO
   (custom torneo del admin, nueva comp europea, etc.) que vaya por
   `_realPair` o `_selPair` hereda el flujo automáticamente —
   bastará con que su cfg tenga `groupFixtures` (si hay grupos) y un
   `koBracket`/`bracket` con la estructura estándar de pares.

## Resto del Mundo — 1 vuelta + Intercontinental + Mundialito (obligatorio, 2026-05-27)

La liga `ligaExt_resto-mundo` (44 equipos top de América + Asia,
ver "Resto Mundo" seed en `misc_body_1.html`) es **el único caso
especial** del proyecto en estos 3 ejes:

### 1. Se juega a UNA SOLA VUELTA (no doble round-robin)

`ligaExtSimular` en `misc_body_1.html:~30894` añade un guard
`_singleRound = (slug === 'resto-mundo')`. El bucle de pares pasa de
`pj=0` a `pj=pi+1` solo en esta liga: N*(N-1)/2 cruces en vez de
N*(N-1). Con 43 equipos = 42 partidos por equipo (943 cruces totales).

### 2. Las 2 zonas custom de Reglas: Intercontinental + Mundialito

El modal "📜 Reglas de la competición" (`#lext-ov-reglas`) muestra,
SOLO cuando `CURRENT_KEY === 'resto-mundo'`:

- 🟠 **Equipos pasan a Copa Intercontinental**: default 6. Los 6
  primeros de la tabla quedan marcados para Copa Intercontinental
  (la conexión real al bracket de Intercontinental se hace cuando
  cada equipo haya jugado sus 42 partidos de liga — wiring pendiente
  de un cambio futuro). Esta zona NO alimenta a Recopa.
- 🏆 **Equipos clasifican a Mundialito Clubes**: default 16. El
  Mundialito se celebra cada 4 temporadas y el usuario rellena el
  roster a mano. Esta zona es **informativa + visual** (colorea
  los puestos 7–16 de la tabla en azul claro `#50a0dc`) pero NO
  alimenta ningún pool automático.

Las otras 7 zonas (UCL / Previa / Open / E.League / Conference /
WildCard / Descenso) **se ocultan** en Resto del Mundo (su modal y
su leyenda), porque la liga está en `EUROPE_BLACKLIST` (no clasifica
a competiciones europeas estándar).

Coloreo de la tabla (`zoneClass`):

- Posiciones 1–6 → `.lext-row.z-inter` (banda naranja `#ff9020`).
- Posiciones 7–16 → `.lext-row.z-mundial` (banda azul claro
  `#50a0dc`). El cómputo es
  `mundialDelta = max(0, mundialClubes - intercontinental)` para que
  `mundialClubes=16` represente los 16 mejores TOTALES, no 16 plazas
  adicionales tras las 6 de Intercontinental.

Storage: `data.config.zones = {ucl,uclPrev,uclQual,uel,uecl,wildcard,intercontinental,mundialClubes,desc}`.
Migración automática: `_upgradeRestoMundoZones()` parchea saves
antiguos:
- pre-2026-05-26: setea `intercontinental=6` + `mundialClubes=16`.
- 2026-05-26 → 2026-05-27: copia `z.recopa` (6) → `z.intercontinental`
  y borra `z.recopa`. Resto del Mundo dejó de alimentar Recopa.

Lectura legacy: `zoneClass` y el load del modal Reglas leen
`z.intercontinental`, cayendo a `z.recopa` solo si el primero está
ausente (saves nunca abiertos tras la migración).

### 3. La Copa Resto del Mundo NO clasifica a Recopa (2026-05-27)

El bloque "🛡 Recopa de Europa · Plazas" del modal Reglas de la copa
(`_lecRenderReglas` en `misc_body_1.html`) se OMITE cuando
`CURRENT_KEY === 'resto-mundo'`. En su lugar se muestra el texto:
"Esta copa no clasifica a ninguna competición europea — solo se
corona al campeón.". El resto de copas nacionales (FA Cup, Coppa,
etc.) mantienen el bloque clásico con Campeón=1 fijo y Subcampeón
toggle 0/1 hacia Recopa.

### 4. Motor Recopa de Europa — bracket de 64 (2026-06-02)

Rediseño implementado (petición usuario, fotos 2026-06-02). La Recopa
es un **bracket de 64 equipos a partido único** (prórroga + penaltis
si empate al 90'), con **6 rondas** que cuadran con las fechas fijas
del calendario (`calendario.json`):

```
1/64 → 1/32 → Octavos → Cuartos → Semifinales → FINAL
(32m)   (16m)   (8m)      (4m)      (2m)          (1m)
```

Motor en `misc_body_1.html` (IIFE `STORE_KEY='recopa_state_v1'`):
`PHASES = ['r64','r32','r16','r8','sf','fin']`. La pantalla
`s-recopa` muestra las **6 cajas** (`recopa-rd-<phase>-blk`) + sus 6
sub-pantallas `s-recopa-rd-<phase>`.

**Pool — 54 campeones + 10 subcampeones = 64** (`_buildPool`, regla
2026-06-12): TODOS los **campeones** de las copas nacionales europeas
(`ligaExt_<slug>.copa.champion`, motor `_lecCopa`) — 53 ligas externas —
+ el campeón de EA Sports (manual) = 54. + los **subcampeones** SOLO de
la whitelist `RECOPA_SUBCAMPEON_SLUGS` (9 externas: `inglaterra,italia,
alemania,francia,portugal,p-bajos,belgica,turquia,dinamarca`; el toggle
per-cup `recopaSubcampeon` puede desactivar una, nunca añadir fuera) + el
subcampeón de EA Sports (manual) = 10. Los **manuales** de "EA Sports →
Europa" slug 'recopa' (`_meaTeamsFor('recopa')`) aportan campeón+sub de la
Copa del Rey porque Liga EA está en `EUROPE_BLACKLIST`. Prioridad al capar
a 64: manuales → campeones → subcampeones. Se saltan las ligas NO europeas
(mismo `EUROPE_BLACKLIST`: `resto-mundo`, `liga-ea-sports`,
`liga-hypermotion`, `liga-primera-federacion`).

**Relleno con BYE**: si el pool < 64, el sorteo de 1/64
(`_drawFirstRound`) rellena con `BYE='__BYE__'` de forma que cada BYE
empareje con un equipo real (walkover → el real pasa directo,
`_resolveBye` marca el match `played` con `bye:true`). Nunca
BYE-vs-BYE mientras queden reales. De 1/32 en adelante los ganadores
ya son potencia de 2 limpia. `_winnerOf` resuelve el walkover (lado
BYE pierde).

### Reglas a respetar (Recopa)

- **PROHIBIDO** volver al bracket de 8 (Cuartos→Semis→Final) ni al
  pool de "solo 2 manuales". Son 6 rondas / 64 equipos.
- **PROHIBIDO** alimentar Recopa desde `ligaExt_resto-mundo` (sigue
  en `EUROPE_BLACKLIST`). El pool es copas europeas + manuales.
- **PROHIBIDO** hardcodear plazas: el subcampeón entra según el
  toggle `recopaSubcampeon` de cada copa.
- Todas las rondas son **partido único con ET + penaltis** (`_gm._isRecopa`
  / `comp==='recopa'` → `_isRecopaSL` en gm-modal). NO meter ida/vuelta.
- El previa-date sale del calendario vía `_mmCalLabel` (rama
  `recopa_<phase>_<idx>` → `Recopa Europa — 1/64 … FINAL RECOPA`).
  Toda ronda nueva debe tener su fila en `calendario.json` y su
  entrada en ese mapa.

### El Subcampeón de cada copa arranca en 0 (editable), el Campeón siempre 1 (obligatorio, 2026-07-03)

**Petición usuario 2026-07-03**: "las reglas de copa por defecto que
siempre ponga el campeón 1 y el Subcampeón 0, pudiendo editarlo
manualmente". Antes el toggle `data.config.recopaSubcampeon` (modal
📜 Reglas de cada copa nacional, `_lecRenderReglas`) arrancaba en
**TRUE** por defecto (`!(recopaSubcampeon === false)`) — cualquier
copa de la whitelist `RECOPA_SUBCAMPEON_SLUGS` que el admin NUNCA
tocara aportaba su subcampeón a la Recopa sin que él lo hubiera
decidido.

**Fix** (`misc_body_1.html`, `_buildPool` + `_lecRenderReglas` +
`_lecCopa.toggleSubcampeon`): el default se invierte a **FALSE** —
`subOn = (data.config.recopaSubcampeon === true)`. El Campeón sigue
`fijo, siempre 1` (no editable, sin cambios). El toggle sigue
funcionando igual (pulsar el chip 0/1 alterna), solo cambia el valor
de arranque cuando el admin nunca lo ha tocado.

**Reglas a respetar**:
- **PROHIBIDO** volver a que `recopaSubcampeon` sin definir cuente
  como `true`. Solo cuenta el subcampeón si el admin lo puso a `true`
  explícitamente desde el toggle.
- El Campeón (`fixed`, valor "1") sigue sin ser editable — solo el
  Subcampeón tiene toggle.
- `_buildPool` (Recopa) y `_lecRenderReglas` (display del toggle)
  DEBEN leer el mismo criterio (`=== true`) para no discrepar entre lo
  que se ve en Reglas y lo que realmente entra al pool.

### Reglas a respetar

1. **No reintroducir el feed `ligaExt_resto-mundo` → Recopa**.
   Resto del Mundo alimenta Copa Intercontinental (a futuro,
   cuando se complete la temporada de liga), no Recopa.
2. **No hardcodear `intercontinental:6` ni `mundialClubes:16`** en
   builders nuevos. Leer siempre de `data.config.zones`. Default
   6/16 lo aplica `_upgradeRestoMundoZones`.
3. **No reintroducir el bloque "Recopa de Europa · Plazas"** en la
   Copa Resto del Mundo. Ninguna copa de esta liga clasifica a
   competiciones europeas.
4. **No quitar `resto-mundo` de `EUROPE_BLACKLIST`**. La liga sigue
   sin clasificar a UCL/UEL/UECL/Open/WildCard/Recopa (esas plazas
   se resuelven SOLO desde las ligas europeas y manual EA Sports).
5. **Cualquier nueva liga que se juegue a UNA vuelta** debe
   replicar el guard `_singleRound` en `ligaExtSimular`. La regla
   por defecto sigue siendo doble round-robin.
6. **El storage key `z.recopa` queda deprecated** para Resto del
   Mundo. Cualquier código que necesite ese cupo debe leer
   `z.intercontinental` con fallback `z.recopa` (solo para saves
   pre-migración que aún no se hayan abierto).

## Hub del usuario: Liverpool (no Bayern) — obligatorio, 2026-05-25

El equipo HUMANO del hub (la pantalla `s-munich`, la card "Próximo
partido", el calendario, los entrenamientos, el menú médico de
inyecciones, las pretemporadas) **es el Liverpool 💡**, NO el
Bayern. Bayern es **IA** y vive en la Liga Alemana
(`ligaExt_resto-de-ligas-*`).

### ¿De dónde viene el nombre "Bayern" en el código?

El hub se construyó originalmente sobre el slot "Bayern Munich" de
Liga EA Sports — los identificadores internos (`s-munich`,
`munich-next-match`, `BAYERN_SHIELD`, `_bayernSquad`, etc.) son
legacy de esa época. El **2026-05-23 el usuario renombró el slot a
Liverpool** vía el editor de Liga EA Sports
(`_ligaEaSubName('Bayern Munich')` devuelve ahora `"Liverpool"`).
Los identificadores con "munich" / "bayern" en el nombre siguen ahí
por compatibilidad, pero el contenido es Liverpool.

### Helpers canónicos para el nombre / plantilla / escudo del hub

```
window._mkHubTeamName               // string canónico del hub humano
_psHumanName()                       // visual (menu_home_v1.ov o _ligaEaSubName)
_psHumanLogicName()                  // lógico (siempre _ligaEaSubName del slot Bayern)
_psHumanShield()                     // URL del escudo
_athHubTeam()                        // equivalente para el menú médico
```

### Reglas a respetar

1. **Nunca hardcodear `/bayern/i` o `'Bayern Munich'`** para resolver
   la plantilla / escudo del usuario. Usa los helpers de arriba.
   Si una función nueva necesita el equipo del hub, debe leer el
   nombre lógico (`_psHumanLogicName` o `_mkHubTeamName`) y resolver
   contra ese.
2. **`_bayernSquad()` ya está parcheado** para hacer 3 lookups en
   `ligaExt_liga-ea-sports`: (1) match exacto por nombre lógico,
   (2) primer team con `isHuman:true`, (3) fallback histórico
   `/bayern/i`. NO eliminar los fallbacks — cubren saves antiguos.
3. **El sistema de bajas / inyecciones / "Bajas — NO convocar" /
   plantilla del HUD / mensajes de la bandeja** se refiere SIEMPRE
   al equipo del hub (Liverpool actualmente). Los 4 emojis humanos
   restantes (🐭 Brasil, 🔨 Inglaterra, ✏️ Noruega, 😈 Argentina,
   🦆 España son SELECCIONES — no aplica) y los OTROS 4 humanos de
   Liga EA Sports (Real Madrid, Barcelona, Atlético, Arsenal — más
   el del slot Bayern que es Liverpool) tienen su propio sistema
   pero NO entran en el hub `s-munich`.
4. **Si un bug futuro reporta "no hay lesiones de entrenamiento" o
   "no aparecen jugadores del hub"**, lo primero es comprobar si
   se está usando `_bayernSquad()` u otra resolución hardcoded a
   Bayern. El usuario renombró el slot y todas las rutas que
   resuelvan el hub deben usar los helpers dinámicos.

### Probabilidades del entrenamiento (referencia, 2026-05-25)

`_rollInjuries()` en `misc_body_1.html:3217-3225`:

| Resultado                  | Probabilidad |
|----------------------------|--------------|
| 2 jugadores lesionados     | 2 %          |
| 1 jugador lesionado        | 5 %          |
| Ninguno (sin bajas)        | 93 %         |

Total: 7 % de los entrenamientos genera al menos una lesión. El
sorteo es **en el segundo 0** (al pulsar ENTRENAR), antes de que la
barra se rellene. Los lesionados se eligen de la plantilla del
**Liverpool** (resuelto vía `_bayernSquad()` que ahora hace lookup
dinámico) y se descartan los que ya tienen baja activa.

## Fecha de la PANTALLA DE PREVIA — fuente única calendario (obligatorio, 2026-05-25)

La fecha que muestra la PANTALLA DE PREVIA junto al icono 🗓️ (línea
`X de <Mes> | 🏆 <comp>`) NO se inventa ni se setea con `new Date()`.
**Fuente única**: el calendario global (filas `.ag-r` del DOM,
generadas por SSR desde `calendario.json`).

### Pipeline

1. `_mmAgDateMap()` lee TODAS las filas `.ag-r` de `#ag-content` y
   construye `{ <label>: {date, wx} }` indexado por el texto del
   `.ag-lbl`.
2. `_mmCalLabel(matchKey, compKey)` resuelve el `<label>` exacto
   que debe coincidir con la entrada del calendario:
   - Liga: `Liga — J<N>` (regex `^lj<N>m`).
   - Copa del Rey: `Copa del Rey — <ronda>` (regex `^copa_<r>_<i>_<l>`).
   - Mundial · 48 selecciones (compKey `'torneo'` + cfg.format
     === `'mundial-48'`): lee `_ppPreviaTeams.tourId/tourKey`, carga
     la cfg vía `_tourLoadCachedSync` / `_TOUR_CACHE` y mapea:
     - Grupo J<N> → `Mundial Grupo — J<N>` (regex `^g\d+_<jor>_`).
     - KO (`ko_<rIdx>_<mIdx>`) → ronda según
       `cfg.formatConfig.koRounds[rIdx]`:
       - `Dieciseisavos` → `Mundial - Dieciseisavos`
       - `Octavos`       → `Mundial Octavos`
       - `Cuartos`       → `Mundial Cuartos`
       - `Semis`         → `Mundial Semis`
       - `Tercer Puesto` → `Mundial Tercer Puesto`
       - `Final`         → `MUNDIAL GRAN FINAL 🏆`
   - Resto (inter/usc/ucl-fin/uel-fin/...): `MAP[compKey]`.
3. `_mmInjectEnv` mete `<dayNum> de <Mes>` en `#pp-env` usando el
   resultado anterior.

### Reglas a respetar

1. **PROHIBIDO hardcodear fechas en la previa** (`"31 de Mayo"`,
   `"25 de Mayo"`, etc.). Si una comp nueva no resuelve fecha, la
   solución es añadir su rama a `_mmCalLabel` para que mapee al
   `.ag-lbl` del calendario, NO escribir la fecha a mano.
2. **PROHIBIDO sustituir el calendario por `new Date()`** en el
   pipeline de la previa. El cálculo "hoy" SOLO se usa como
   fallback degradado cuando no hay match en el calendario.
3. **Toda comp NUEVA con humanos** que abra la previa
   (`showPrePartidoOverlay(matchKey, compKey, ...)`) DEBE tener su
   rama en `_mmCalLabel` para mapear matchKey → `.ag-lbl`.
4. **Toda nueva ronda de Mundial-48** (p. ej. si se añade una
   ronda extra) DEBE tener:
   - Su evento en `calendario.json` con `event.name` exacto.
   - Su entrada en `MUNDIAL_KO_LABELS` de `_mmCalLabel` mapeando
     el nombre de la ronda (tal como aparece en
     `cfg.formatConfig.koRounds`) al `event.name` del calendario.
5. **El `compLabel`** de la previa (después del icono 🏆) en
   partidos de Mundial-48 se construye como:
   - `Mundial 2032 · GRAN FINAL 🏆` para la última ronda.
   - `Mundial 2032 · <RoundName>` para semis/cuartos/octavos/...
   - `Mundial 2032 · Grupo J<N>` para fase de grupos.
   NO mostrar `'torneo'` crudo (bug 2026-05-25).

### Histórico

- 2026-05-25: bug Marruecos vs Francia (GRAN FINAL del Mundial
  2032). La card del hub mostraba `31 May` (correcto) pero la
  previa `25 de Mayo` (HOY) porque `_mmCalLabel` no tenía rama
  para `compKey === 'torneo'`. `_tourOpenHumanMatch` pasa
  `compKey='torneo'` para TODOS los formatos de torneo (mundial-48,
  ko, league, groups-ko, swiss...), así que el matchKey
  `tour_<tourId>_ko_5_0` caía a `MAP[compKey] || null` → null →
  fallback a `new Date()`. Fix: rama `compKey === 'torneo'` que
  usa `_ppPreviaTeams.tourId/tourKey` + `cfg.formatConfig.koRounds`
  para resolver la etiqueta del calendario.

## Tema del gm-modal por competición (obligatorio, 2026-05-24)

El gm-modal (la pantalla del partido HvH/HvIA que ve el usuario) lee
la comp activa vía `_gmCompFromState()` y le aplica la clase
`is-comp-<X>`. Esa clase fija las CSS vars `--comp-color` y
`--comp-color-soft` que pintan TODOS los bordes/glow del modal:
caja exterior `#gm-inner`, FINALIZAR (`.gm-end-moved`), PRÓRROGA
(`#gm-btn-et`) y la franja superior de `gm-finalizar-slot`.

### Mapa comp → tema (obligatorio)

| comp en `_gm.comp`                                | clase            | `--comp-color`  | Justificación                                |
|---------------------------------------------------|------------------|-----------------|-----------------------------------------------|
| `liga`/`ea-sports`/`''`/`null`                    | `is-comp-liga`   | `#ff5060` rojo  | Liga EA SIEMPRE roja (legacy)                |
| `copa`/`copa-fin` (o `_isCopa`)                   | `is-comp-copa`   | `#ffb050` ámbar |                                               |
| `sc`/`sc-final` (o `_isSc`)                       | `is-comp-super`  | `#f0c820` oro   |                                               |
| `recopa` (o `_isRecopa`)                          | `is-comp-recopa` | `#ff8060`       |                                               |
| `superliga` (o `_isSuperliga`)                    | (vacío)          | rojo default    | Sin tema explícito (los 6 humanos)            |
| `ucl`                                             | `is-comp-ucl`    | `#88aaff` azul  |                                               |
| `uel`                                             | `is-comp-uel`    | `#ffaa55`       |                                               |
| `uecl`                                            | `is-comp-uecl`   | `#5fe08a`       |                                               |
| `inter`                                           | `is-comp-inter`  | `#f0a040`       |                                               |
| `torneo`/`mundial`/`mundial-48`/`sel`/`sel-fin`/`selecciones` | `is-comp-mundial` | `#a875e8` violeta | Mundial-48 (compKey `torneo` vía `_tourOpenHumanMatch`) y Selecciones |
| `amistoso`/`wprev`/`mundialito`                   | `is-comp-amistoso` | `#7da7c8` azul grisáceo |                                       |
| `verano`/`sct`/`jg`/`pss`/`asia`                  | `is-comp-verano` | `#5fc6c8` turquesa |                                           |
| **cualquier otra (fallback)**                     | `is-comp-neutral` | `#88a0c0` gris azulado | **PROHIBIDO** caer al rojo de Liga       |

### Reglas a respetar

1. **Toda comp humana NUEVA** que se añada (custom o de un torneo
   nuevo) DEBE tener su rama en `_gmCompFromState()` (en
   `templates/partials/part2/misc_body_2.html`, cerca de la línea del
   bloque "GM-MODAL · tema + colores de equipo").
2. **PROHIBIDO** dejar el fallback en `'liga'`. Cualquier comp no
   reconocida debe caer a `'neutral'` para evitar el bug
   2026-05-24 (Mundial-48 con todos los bordes rojos — foto Francia vs
   RD Congo).
3. **PROHIBIDO hardcodear `border:1px solid red`** o `var(--comp-color)`
   en elementos nuevos del gm-modal sin antes verificar el tema actual.

## Card bicolor del gm-modal (obligatorio, 2026-05-24)

El fondo del gm-modal lleva un **tinte bicolor** según los colores
reales del escudo:

- **Mitad izquierda** = color dominante del escudo LOCAL
  (`--team-a-bg`, alpha 0.25).
- **Mitad derecha** = color dominante del escudo VISITANTE
  (`--team-b-bg`, alpha 0.25).

Las vars las setea `_gmPaint(pa, pb)` en
`templates/partials/part2/misc_body_2.html`. El paint corre 2 veces:
primero con el "seed" (color de `_teamColors` / `_hashColor` por
nombre) para que el bicolor NUNCA esté vacío, y luego repinta cuando
la extracción real del escudo (`_crestPrimary` → `extractColors`)
resuelve.

Si el escudo del rival no se ha cargado aún o no existe, las CSS
vars caen a defaults `rgba(40,60,120,.25)` (azul oscuro local) y
`rgba(60,40,90,.25)` (morado oscuro rival) — petición explícita del
usuario "si no hay escudo todavía del rival pon el color que más te
guste".

### Caja "+ AÑADIR EVENTO" bicolor (obligatorio)

La caja AÑADIR EVENTO (`#gm-add-btn`) usa el mismo bicolor pero a
alpha alto (0.82-0.95) para que sea bien visible. El borde es
`1px solid rgba(255,255,255,.22)` — **PROHIBIDO** usar
`var(--comp-color)` en este borde (creaba el aro rojo del bug
2026-05-24).

### Reglas a respetar

1. **No quitar `background-attachment:fixed`** del bicolor del modal
   — sin él, el degradado se descoloca al hacer scroll del modal.
2. **No subir el alpha por encima de 0.30** en `--team-a-bg`/`--team-b-bg`
   — el texto del modal deja de ser legible.
3. **No reintroducir `border:2px solid var(--comp-color)`** en el botón
   AÑADIR EVENTO — eso es lo que causaba el aro rojo cuando el comp
   caía al fallback liga.
4. Si añades un elemento nuevo dentro del gm-modal con borde, usa
   `var(--comp-color, #88a0c0)` con fallback neutro, NUNCA hardcodear
   rojo.

## Sanción de SELECCIÓN por tarjetas se RECONCILIA desde el acta — nunca se pierde (obligatorio, 2026-06-06)

**Bug (fotos usuario 2026-06-06, «Rabiot·Francia 2🟨»)**: Adrien Rabiot
(Francia) tenía **2 amarillas** en la columna 🟨 de la plantilla (vista
selección), el código obliga a perderse el próximo partido por
acumulación (ciclo de 2), pero: (1) NO salía marcado en
amarillo/rojo en la plantilla, (2) NO había mensaje en la bandeja, y
(3) NO aparecía en la card «BAJAS PARA EL PARTIDO» (AMONESTADOS /
EXPULSADOS / LESIONADOS).

### Causa raíz

El motor de sanciones de selección (`calcularSelMatch` /
`window.calcularSancionesPartido` / `_selCalcularSancionesPartido`)
**NUNCA se invocaba** en ningún fin-de-partido (`gmEndMatch`,
`_mlFinishMatchGen`, auto-sim de torneo). Es decir,
`YELLOW_STORE_SEL` / `SANCION_STORE_SEL` jamás se alimentaban → cero
suspensiones registradas (ni acumulación, ni roja, ni doble amarilla).
El "2" de la plantilla viene de OTRA fuente (las stats `ta`/`tr` que
agrega `_tourStatsFromCfgResults` desde `cfg.results[].events`), así
que el síntoma era "veo 2 amarillas pero el juego no sabe que está
sancionado".

### Fix — derivar la suspensión del ACTA (cfg.results), retroactivo

`window._selReconcileSuspensions(selName)` (IIFE de selecciones en
`static/js/index.bundle.js`) deriva las suspensiones de las TARJETAS
acumuladas en `cfg.results` (la MISMA fuente que pinta la columna 🟨),
de forma RETROACTIVA y self-healing cross-device. Por jugador:

- `count`     = total de 🟨 (monótono = stat `ta`). Lo lee
  `_checkFraYellowBrink` para el aviso/suspensión de la bandeja.
- `servedAcc` = nº de suspensiones por acumulación YA CUMPLIDAS.
- `servedRed` = nº de suspensiones por 🟥/doble-amarilla YA CUMPLIDAS.

`pendingAcc = max(0, floor(ta/2) − servedAcc)`; `pendingRed = max(0,
tr − servedRed)`. **AUTO-LIMPIANTE** (refuerzo 2026-06-07, foto usuario
«Doué con 1 🟨 salía suspendido»): en CADA pasada la cola se AJUSTA a
ese `pending` — añade/actualiza si falta y **RETIRA** la entrada
gestionada si ya no procede (stats bajaron por un reset/re-sim o se
cumplió). `served*` SOLO sube al consumir (`_selConsumirParaPartido`,
que distingue las entradas gestionadas vía `_isSelReconEntry`), así una
suspensión cumplida no se resucita y una que dejó de proceder
desaparece sola. Migración del primer deploy: en la 1ª pasada
`served* = max(0, issued_legacy − pendiente_en_cola)` para no
re-suspender lo ya cumplido ni perder lo aún vigente.

Las entradas gestionadas llevan `srcCardRecon:true` (las legacy del
primer deploy se reconocen por `reason`). Las MANUALES del editor
(`'…(manual)'`) NO se tocan (las quita el usuario con QUITAR BAJA).

Stats por jugador vía `window._selCardStatsFor(selName)` (en
`misc_body_1.html`, junto a `_selCtxFor`): devuelve la LISTA
`[{name,ta,tr}]` construida con el MISMO roster (`_selTeamObj`) y el
MISMO matching (`_selCtxFor().statsFor`) que las filas de la plantilla
→ reconciliación y display NUNCA discrepan (un jugador con 1 🟨 en la
tabla tendrá `ta=1` en la reconciliación, jamás 2).

### Dónde se dispara la reconciliación

- **Plantilla** (`_renderSelView`): reconcilia ANTES de pintar →
  badge 🟨/🟥 (`_bedBajaBadge`) + fila coloreada (`_bedBajaState`) +
  detalle al pulsar (`_bedBajaDetail`). NO dispara el mensaje aquí (era
  una ráfaga retroactiva de avisos al abrir la plantilla — 2026-06-07).
- **Overlay BAJAS** (`pendientesPara`, home+away): reconcilia antes de
  leer la cola → AMONESTADOS (`tipo:'acumulacion'`) / EXPULSADOS
  (`tipo:'roja'/'d-amarilla'`).
- **Fin de partido** (`_broadcastHumanMatchResult`, lado `fra`):
  reconcilia + `_checkFraYellowBrink` (mensaje en bandeja, contextual al
  partido recién jugado).

### Bug colateral arreglado: color del badge/fila

`_bedBajaState`/`_bedBajaDetail` (vista selección) decidían
amarillo/rojo con `tipo === 'amarilla'`, pero la acumulación usa
`tipo: 'acumulacion'` → salía ROJO. Corregido a la misma lógica que el
club: `roja`/`d-amarilla` → rojo, el resto → amarillo.

### Reglas a respetar

1. **PROHIBIDO** depender de que `calcularSelMatch` se llame en el
   fin-de-partido para registrar sanciones de selección. La fuente de
   verdad es `cfg.results` (acta) vía `_selReconcileSuspensions`. Toda
   pantalla que muestre la suspensión (plantilla, overlay, mensaje)
   debe reconciliar antes de leer.
2. **PROHIBIDO** que la reconciliación sea SOLO ADITIVA (bug 2026-06-07:
   una suspensión `issued` que nunca se retiraba quedaba STALE cuando
   las stats bajaban por un reset/re-sim → un jugador con 1 🟨 salía
   suspendido). Debe ser AUTO-LIMPIANTE: `pending = max(0, owed −
   served)` recalculado en cada pasada, AÑADE/ACTUALIZA y **RETIRA** la
   entrada gestionada (`_syncSelManagedSusp`).
3. **PROHIBIDO** que `_selReconcileSuspensions` y la plantilla usen
   fuentes de stats DISTINTAS. Ambas leen `window._selCardStatsFor`
   (mismo roster `_selTeamObj` + mismo `_selCtxFor`) → no pueden
   discrepar (no más "la tabla dice 1 🟨 pero lo suspende por 2").
4. **PROHIBIDO** resetear `count` a 0 al cumplir el ciclo: `count` es
   monótono (= `ta`) porque `_checkFraYellowBrink` espera un total
   creciente. La no-duplicación la garantiza `served*` (solo sube al
   consumir), NO el reset del contador.
5. **PROHIBIDO** que la reconciliación toque las bajas MANUALES del
   editor (`reason` `'…(manual)'`, sin `srcCardRecon`): solo gestiona
   las suyas (`_isSelReconEntry`). El consumo distingue ambas para
   contar `served*` solo en las gestionadas.
6. **PROHIBIDO** volver a usar `tipo === 'amarilla'` para colorear el
   badge/fila de selección: la acumulación es `tipo:'acumulacion'` (el
   editor manual también la guarda así, para que salga en AMONESTADOS).
7. **PROHIBIDO** disparar `_checkFraYellowBrink` en el render de la
   plantilla (suelta una ráfaga retroactiva de avisos al abrirla). El
   mensaje va al FIN del partido. Una caja de humano nueva hereda el
   badge/overlay (genéricos por selección); el mensaje sigue siendo lado
   `fra` (hub Liverpool/Francia) — `_checkFraYellowBrink` se autogatea
   con `_isFra`.

## Sanciones y lesiones — SELECCIONES NACIONALES (obligatorio, 2026-05-24)

Sistema PARALELO al de clubes (`calcularSancionesPartido` /
`YELLOW_STORE` / `SANCION_STORE` / `LESION_STORE`). **NO se cruzan**:
un jugador sancionado en su selección puede jugar con su club, y
viceversa. Cada selección tiene su propio contador.

### Selecciones humanas (6, canónicas)

Francia💡, Brasil🐭, Inglaterra🔨, Noruega✏️, Argentina😈, España🦆.

La lista vive en `SEL_HUMANAS` en el bloque IIFE
`SANCIONES + LESIONES — SELECCIONES NACIONALES` al final de
`static/js/index.bundle.js`. Helper canónico:
`window._esSelHumana(name)` (también acepta selecciones marcadas
como humanas en el editor vía `selecciones_squad_v1.teams[].icon` →
`_SEL_HUMAN_ICONS`).

### Detección de partido de selección

`window._esCompSel(compKey)` devuelve `true` para:
- `compKey === 'sel'` (clasificación J1-J10, calendario `cal-sel1..10`).
- `compKey === 'sel-fin'` (Mundial fase final, `cal-mf-*`).
- `compKey === 'torneo'` cuando el `_TOUR_CACHE[tourId].format` es
  `'mundial-48'` (partidos del Mundial 2032 abiertos desde el hub).

### Reglas (distintas a clubes)

| Evento                          | Selecciones humanas         | Clubes (referencia)       |
|---------------------------------|-----------------------------|---------------------------|
| Lesión "natural" del motor      | 1 partido (el siguiente)    | 1-7 según grado           |
| ⬇️ marcado por usuario          | 2 partidos (este + siguiente) | 2-10 según roll Mod/Grave |
| Doble amarilla (expulsión)      | **1 partido siguiente**     | SIEMPRE 2 partidos        |
| Roja directa                    | **1 partido siguiente** (2026-06-02) | 2-15 con buckets |
| Acumulación de amarillas        | **Cada 2 = 1 partido (ciclo 2)** | Cada 3 = 1 partido    |

Notas:
- **Sanciones simultáneas → solo se aplica la MAYOR** (no se suman
  como en clubes). Si llega una sanción menor mientras hay una mayor
  pendiente, se descarta.
- **SIN reset entre torneos — cuenta ÚNICA y continua (2026-06-02)**:
  todos los stores usan la key única `'sel'`. Amarillas sueltas, ciclos
  de 2, expulsiones (roja/doble amarilla) y lesiones **NUNCA** se
  resetean entre torneos: viajan al siguiente partido que juegue la
  selección, sea clasificación o Mundial. Ejemplo canónico: Francia
  eliminada en cuartos del Mundial 2032 con un expulsado / 2 amarillas
  acumuladas → la sanción se cumple en **Selecciones J1** (21 sep) de la
  siguiente clasificación (misma selección, mismos jugadores).
  `torneoKeyFor(compKey)` devuelve `'sel'` para `sel`/`sel-fin`/`torneo`
  (mundial-48). Migración `_migrateLegacyTorneoKeys` fusiona los buckets
  legacy `sel-clasif`+`sel-mundial` en `'sel'` (idempotente). Helper
  manual de borrado total: `window._selResetTorneo('sel')`.
- **No hay amistosos de selección** — el sistema solo aplica a
  partidos oficiales. Si en el futuro se añaden amistosos de
  selección, irán por `compKey='amistoso'` (ya excluido por
  `EXCLUDED_COMPS` del sistema de clubes), no sumarán nada.

### Stores y persistencia

- `window.YELLOW_STORE_SEL['sel'][selName][playerName] = { count }`
- `window.SANCION_STORE_SEL['sel'][selName] = [ { name, remaining, reason, tipo } ]`
  (key única `'sel'` desde 2026-06-02 — clasif + Mundial comparten bucket)
- `window.LESION_STORE_SEL[selName][playerName] = { remaining, reason, timestamp }`
  (NO se anida por torneo — una lesión "sobrevive" entre clasif y
  Mundial; se decrementa partido a partido independientemente).
- `window._FORMA_MATCH_STATES_SEL[selName::playerName] = '⬇️'`

Persistencia en `localStorage` clave `ftbol_sel_sanciones_v1`
(autosave cada 5 s + beforeunload) **+ sync al servidor** vía
`_kvBlobSync` (sobrevive al borrado de datos de navegación / cambio de
móvil — ver sección "Lesiones / sanciones … se SINCRONIZAN al servidor",
2026-06-04). Separada del store de clubes (`ftbol_lesiones_v1`, también
sincronizado).

### Helpers públicos

```
window._esSelHumana(name)
window._canonSelHumana(name)        // 'francia' → 'Francia'
window._esCompSel(compKey)
window._selTorneoKey(compKey)        // 'sel' (única) | null
window._selCalcularSancionesPartido(events, humanTeam, teamName, compKey)
window._selAddSancion(torneoKey, selName, playerName, reason, partidos, tipo)
window._selCumplirSancion(torneoKey, selName, playerName)
window._selAddLesion(selName, playerName, partidos, reason)
window._selCumplirLesion(selName, playerName)
window._selResetTorneo(torneoKey)
window._selPendientesPara(home, away, compKey)    // { sanciones, lesiones }
window._selConsumirParaPartido(home, away, compKey)
```

### Hooks instalados sobre el sistema de clubes

El bloque al final de `index.bundle.js` envuelve estas funciones del
sistema de clubes para enrutar al motor SEL cuando `esCompSel(comp)
&& esSelHumana(teamName)`:

- `window.calcularSancionesPartido` — delega a
  `_selCalcularSancionesPartido` en partidos de selección.
- `window._sancionConfirm` — además de la decrementación de clubes,
  llama a `_selConsumirParaPartido` (idempotente por
  `_sancionConsumedFor['SEL_' + mk]`).
- `window._formaToggle` — ⬇️ en selección registra 2 partidos en
  `LESION_STORE_SEL` (no en `LESION_STORE` global como hace en
  clubes), evitando contaminación al club del jugador.
- `window._renderFormaChecklist` — render propio en partidos de
  selección con los rosters de las 6 selecciones humanas.
- `window.showSancionOverlay` — render self-contained desde
  `SANCION_STORE_SEL` + `LESION_STORE_SEL` (el original hace
  early-return si los stores globales están vacíos, que SIEMPRE lo
  están en selección).
- `window._refreshSancionInjList` — en selección re-renderiza desde
  `LESION_STORE_SEL` para no pisar la lista con "Sin lesionados" al
  togglear ⬇️.
- `window._registrarLesionesDesdeEventos` — particiona los eventos
  por equipo: lesiones de selección humana → `LESION_STORE_SEL`
  (1 partido), resto → motor original.

### Reglas a respetar

1. **No mezclar stores de clubes y selecciones.** Las stores SEL son
   independientes. Cualquier código que añada/lea sanciones de
   selección debe usar `*_SEL` o los helpers `_sel*`.
2. **No hardcodear más selecciones en `SEL_HUMANAS`** sin avisar al
   usuario. Las 6 son canónicas (2026-05-24). Selecciones marcadas
   como humanas en el editor (`_SEL_HUMAN_ICONS`) se reconocen
   adicionalmente por el fallback en `esSelHumana`.
3. **No cambiar los partidos de sanción** (1 d-amarilla, 1 roja
   directa, ciclo 2 amarillas, 2 ⬇️, 1 lesión natural) sin acordarlo
   con el usuario. Reglas pedidas el 2026-05-24; roja directa pasó de
   2 → 1 partido el 2026-06-02 (petición usuario: roja directa y roja
   por doble amarilla se pierden SOLO el siguiente partido).
4. **No introducir amistosos de selección** sin acordarlo. El
   usuario explícitamente dijo "no hay amistosos de selecciones, y
   en el caso de haber no cuentan" — quedan excluidos del cómputo.
5. **PROHIBIDO reintroducir el reset/separación por torneo** (los
   antiguos `'sel-clasif'` / `'sel-mundial'`). La cuenta es ÚNICA y
   continua (`'sel'`): las sanciones/lesiones de una selección DEBEN
   viajar al siguiente partido que juegue, sea del torneo que sea
   (petición usuario 2026-06-02, "todo es acumulable siempre que juegue
   la selección"). Si se añade un torneo nuevo de selecciones (ej.
   Eurocopa), `_selTorneoKey` debe seguir devolviendo `'sel'` para él.

## Balón fijo Selecciones por jornada (obligatorio, 2026-05-24)

Regla "siempre" pedida por el usuario el 2026-05-24:

- **Selecciones J1 a J8** (`cal-sel1`..`cal-sel8`, fase clasificatoria
  africana, septiembre–marzo) → **`Orbita Africa`** SIEMPRE.
- **Selecciones J9 en adelante** (`cal-sel9`, `cal-sel10`, fase de
  mayo) → **`NIKE CONTROL CBF`** SIEMPRE.
- **Mundial fase final** (`cal-mf-g1`..`cal-mf-fin`, compKey
  `sel-fin`) → **`NIKE CONTROL CBF`** (default existente).

Esta regla GANA sobre el override del admin
(`ball_by_comp_v1['sel']`). Solo el balón de nieve
(`eFootball MAX VIS 26`) puede sobrescribirla, igual que para el
resto de comps.

### Resolución

En `_buildItems(matchKey, compKey, …)` de
`static/js/index.bundle.js`, después de aplicar el override del
admin sobre `COMP_BALL[compKey]`, se inyecta un bloque que detecta
`compKey === 'sel'` + jornada (vía `window._ppBlockId` con regex
`cal-sel(\d+)`, fallback al `matchKey`) y reescribe `balon` a
`'Orbita Africa'` o `'NIKE CONTROL CBF'` según la jornada.

**Mundial 2032 vía `_tourOpenHumanMatch`** (compKey `'torneo'`): el
flujo de torneo NO pasa `'sel'`, pasa `'torneo'`. Para que la regla
también se aplique a partidos de Selecciones lanzados desde la card
del hub (Francia-UAE en May, etc.), el bloque comprueba además
`window._TOUR_CACHE[_ppPreviaTeams.tourId].format === 'mundial-48'`
y, si coincide, fuerza `'NIKE CONTROL CBF'` (Mundial fase final).
Sin esto, `COMP_BALL['torneo']` no existe y `balon` caía al default
inicial `"Ligue 1 McDonald's"` (bug reportado por usuario 2026-05-24
con captura: Francia vs UAE mostraba balón de Liga EA).

En la pantalla `s-calendario.html`, los placeholders `<div class=
"minfo">⚽️ …</div>` de `cal-sel1`..`cal-sel8` muestran "Orbita
Africa"; los de `cal-sel9`..`cal-sel10` y `cal-mf-*` mantienen "NIKE
CONTROL CBF".

### Inventario

El balón `Orbita_Africa` está sembrado en `BALL_DB` (entrada
`{key:'sel-clasif', comp:'Selecciones · Clasif. (J1-J8)',
id:'Orbita_Africa'}` en `misc_body_2.html`), así que aparece en
"INVENTARIO DE BALONES" sin que el admin tenga que añadirlo a mano.
`NIKE_CONTROL_CBF` ya estaba sembrado por la entrada
`{key:'selecciones', comp:'Fase Final Selecciones'}`.

### Reglas a respetar

1. **No cambiar el balón hardcoded** sin acuerdo con el usuario:
   J1-J8 = `Orbita Africa`, J9+ = `NIKE CONTROL CBF`.
2. **No quitar el bloque jornada-aware** de `_buildItems`. Aunque
   el admin asigne otro balón vía `s-admin-balls`, esta regla
   debe ganar (es "siempre" por petición explícita).
3. **Si se añaden más jornadas de Selecciones** (J11, J12, …), la
   rama `_selJor >= 9` ya las cubre; no hay que tocar nada.
4. **No borrar `Orbita_Africa` de `BALL_DB`** — si desaparece de
   `BALL_DB` y el inventario no se ha sembrado nunca en el navegador
   del usuario, el picker del admin no lo tendrá disponible.

## Balón asignado por competición (obligatorio, 2026-05-24)

**Cuando el admin asigna un balón a una competición desde "INVENTARIO
DE BALONES" (pantalla `s-admin-balls`, override
`ball_by_comp_v1[compKey] = ballId`), ese balón DEBE aparecer en
TODAS las cards de partidos donde haya un humano implicado en esa
competición.** Aplica a CUALQUIER tipo de torneo: Liga EA Sports,
Copa del Rey, Supercopa de España, Champions League, Europa League,
Conference League, Recopa, Supercopa de Europa, Intercontinental,
Mundialito de Clubes, Selecciones, Superliga, Torneos de Verano,
amistosos, y cualquier competición custom que el admin añada vía
"+ AÑADIR COMPETICIÓN".

### Resolver canónico

El bundle resuelve el balón en `_buildItems(matchKey, compKey, …)`
de `static/js/index.bundle.js` con esta cadena (NO modificar el
orden):

1. `ball_by_comp_v1[compKey]` — **clave RAW del partido**. Cubre
   las 14 comps base + las 3 extras (`superliga`, `verano`,
   `mundialito`) + cualquier comp custom añadida por el admin.
2. `ball_by_comp_v1[_COMP_TO_BDB[compKey]]` — fallback al alias de
   `BALL_DB` (back-compat de las 14 comps base que históricamente
   se guardaban por la clave `champions`/`uel`/etc. en vez de
   `ucl`/`uel`).
3. `ball_by_comp_v1[_COMP_GROUP_ALIAS[compKey]]` — alias de GRUPO
   (2026-05-25): varios compKeys reales comparten una sola fila en
   Ball Storage. Los torneos de verano (Joan Gamper `jg`, Asian
   `asia`, Pre-Season Super `pss`, Soccer Champions Tour `sct` y
   los genéricos `torneo`/`torneos`) caen sobre la extra `verano`;
   `mundial` cae sobre `mundialito`.
4. `COMP_BALL[compKey]` — default hardcoded por comp (incluye
   defaults para `torneo`/`jg`/`asia`/`pss`/`sct`/`mundialito` para
   evitar que caigan al default genérico `Ligue 1 McDonald's`).
5. Override por clima: nieve → `eFootball MAX VIS 26`.
6. Fallback `ml-ball-name` del DOM (`ball-wrap-<matchKey>`).

### Reglas a respetar

1. **Toda card de partido humano** (HvH, HvIA, IAvH) DEBE construir
   sus items vía `_buildItems(matchKey, compKey, …)`. No reimplementar
   la resolución del balón en una nueva ruta.
2. **Toda nueva competición humana** que se añada al juego DEBE
   pasar su `compKey` real al builder de la card, para que el
   override del admin se aplique automáticamente sin tocar
   `_COMP_TO_BDB`.
3. **No hardcodear nombres de balón** en builders nuevos. El balón
   por defecto va en `COMP_BALL`; el override del usuario gana
   siempre.
4. **No romper `ball_by_comp_v1`** en wipes ni migraciones. La clave
   se persiste en localStorage + servidor (`/api/kv/ball_by_comp_v1`,
   ver sección "Inventario de Balones").
5. **El admin elige el balón con un picker ✅** (overlay) en
   `s-admin-balls`. Prohibido reintroducir `<select>` nativo para
   esta selección (bug 2026-05-24: en algunos móviles el `<select>`
   cancelaba la elección al primer toque).

### Persistencia del inventario

- Cache local: `localStorage` (3 claves: `ball_inventory_v1`,
  `ball_by_comp_v1`, `ball_comp_db_v1`).
- Fuente de verdad: servidor (`/api/kv/<key>` en `app.py`).
- Las escrituras locales se marcan con `_ballMarkLocalWrite(key)` y
  durante 5 min `_ballHydrateAll()` NO pisa la cache con la
  respuesta del servidor (evita race con un GET stale anterior al
  POST del usuario).
- Los flujos `adminBallAdd` / `adminBallAddComp` /
  `adminBallSetForComp` esperan la confirmación del POST y muestran
  toast distinto si el servidor no respondió.

## Sanciones por tarjetas (obligatorio, 2026-05-23)

Sistema único cross-competición en `static/js/index.bundle.js`:
`window.calcularSancionesPartido(events, humanTeam, teamName, compKey)`.

### Reglas

1. **Acumulación de amarillas**: **3 amarillas** → el jugador se
   pierde el próximo partido del calendario. El contador se acumula
   GLOBALMENTE entre TODAS las competiciones (Liga + Copa + UCL +
   UEL + UECL + Recopa + USC + Intercontinental + Mundialito Clubes
   + Selecciones + Superliga + …). Al alcanzar 3 → sanción y reset
   del contador a 0.
2. **Doble amarilla** (expulsión en el mismo partido) → **SIEMPRE 2
   partidos** de sanción. No suma al ciclo de amarillas.
3. **Roja directa** → sorteo 2-15 partidos con buckets:
   - 60% → 2–3 partidos (uniforme: 30%/30%)
   - 25% → 4–6 partidos (uniforme: 8.33%/×3)
   - 10% → 7–10 partidos (uniforme: 2.5%/×4)
   -  5% → 11–15 partidos (uniforme: 1%/×5)
4. **Cumplimiento**: la sanción se cumple en el **PRÓXIMO partido
   del calendario sea de la comp que sea** (excepto excluidas).
   `_sancionConfirm` descuenta 1 al confirmar el overlay BAJAS PARA
   EL PARTIDO; al llegar a 0, la entrada se elimina.
5. **Finales** no aplican acumulación de amarillas (se mantiene la
   regla antigua de no sancionar en una final por amarillas);
   expulsiones (d-amarilla, roja) sí.

### Competiciones EXCLUIDAS

Los **torneos de verano** (Soccer Champions Tour, Premier Summer
Series, Trofeo Joan Gamper, Asian Tournament) + amistosos NO suman
amarillas, NO generan sanción y NO consumen sanción. CompKeys:
`amistoso`, `torneo`, `torneos`, `sct`, `jg`, `pss`, `asia`,
`verano`. Set canónico: `EXCLUDED_COMPS` en `index.bundle.js`.

### Stores

- `window.YELLOW_STORE.__global[player::team] = { count }` —
  contador único cross-comp. Las claves legacy
  `YELLOW_STORE[compKey]` quedan ignoradas en escritura pero se leen
  para no romper save-games.
- `window.SANCION_STORE.__global = [ { name, team, reason, remaining,
  srcComp } ]` — cola única cross-comp. `_addSancion` suma a
  `remaining` si ya hay entrada del mismo jugador (acumulación de
  sanciones).

### Reglas a respetar

- Toda nueva ruta que genere amarillas/expulsiones para un humano
  debe pasar por `calcularSancionesPartido` (no escribir
  directamente en YELLOW_STORE / SANCION_STORE).
- Toda nueva competición HUMANA que se añada debe tener entrada en
  `COMP_CONFIG` con `ciclo:3` (o quedar en `EXCLUDED_COMPS` si es de
  verano/amistosa).
- No reintroducir sorteos `0.5 ? 1 : 2` o rangos 2-8 — están
  obsoletos desde 2026-05-23.

## Plantilla del hub (Liverpool-Francia) — stats SUMADAS + nota media por competición (obligatorio, 2026-06-03)

Petición usuario 2026-06-03 (foto caja Liverpool-Francia → 👕
PLANTILLA): las estadísticas de cada jugador de la plantilla del hub
deben ir **SINCRONIZADAS y SUMADAS** de TODAS las competiciones
OFICIALES del club, jugador a jugador, estadística a estadística. Lo
mismo para un jugador NUEVO que se añada a la plantilla (automático,
por nombre).

### Competiciones que cuentan (oficiales del club)

Liga EA Sports · Copa del Rey · Supercopa de España · Champions /
Europa / Conference (la que juegue) · Recopa de Europa · Supercopa de
Europa · Intercontinental · Mundialito de Clubes.

**EXCLUIDAS SIEMPRE** (van a parte): Superliga, amistosos, torneos de
verano. También fuera: Previa Champions / Open Qualifier / Wild Card
(no son "competición real").

### Implementación (todo en `templates/partials/misc_body_1.html`)

- **Render**: `renderBayernPlantillaScreen` → `_section` → `_rowFor` en
  el IIFE de `#s-bayern-plantilla` (host `bayern-plantilla-host`).
- **SUMA agregada** (`_buildStatsCache` → `_statsFor`): suma
  `_STATS_FIELDS` sobre `_STATS_STORES` = `[ef_player_stats_v1`
  (Liga+Copa+SC), `ucl_main, uel, uecl, recopa, usc, inter, mundial]`.
  Sin solape ⇒ sin doble conteo. La columna **GOLES** es un **total
  único** = `gol + pen + fk` sumado de todas las comps (no 3 columnas).
- **NOTA MEDIA (0.00-10.00)**: media de la nota del jugador por
  competición. `_notaFor(name, pos)` calcula la nota de cada comp con
  `window.computePlayerRating` (MISMA fórmula por posición del editor,
  expuesta en window) sobre el desglose por comp (`_NOTA_CACHE`, lleno
  por `_buildStatsCache` desde `_NOTA_STORES`), y **promedia solo las
  comps con `pj>0`**. Ejemplo:
  `(8.30+8.10+7.77+7.86+6.92+7.00)/6 = 7.64`.
- **Liga, Copa y Supercopa España van SEPARADAS** en la media. Como
  `ef_player_stats_v1` las funde, `rebuildPlayerStatsStore` persiste una
  copia **Liga SOLA** en `ef_player_stats_liga_only_v1` (snapshot
  profundo TOMADO ANTES de `_mergeBucketInto(stats, buckets.copa/sc)`).
  `_NOTA_STORES` la usa en vez de v1.
- **Nombre del club dinámico**: la agregación indexa por el nombre REAL
  del hub (`_hubTeamName()` → `_findBayernRow().name` → Liverpool), NO
  por `'Bayern Munich'` hardcodeado. Sin esto la agregación devuelve
  ceros tras renombrar el slot (bug raíz 2026-06-03).
- **CSS**: layout propio scopeado a `#s-bayern-plantilla` (9 col campo /
  10 portero) con columna GOLES única + columna NOTA (📈). NO toca el
  editor admin de Resto de Ligas (`renderSquadList`, mismas clases
  `lext-sq-*` pero otro scope).

### Reglas a respetar

1. **PROHIBIDO** volver a hardcodear `'Bayern Munich'` en
   `_buildStatsCache`/`_hubTeamName`. Resolver SIEMPRE el club del hub
   dinámicamente (`_findBayernRow` / `_psHumanLogicName`).
2. **PROHIBIDO** meter Superliga, amistosos o torneos de verano en
   `_STATS_STORES` / `_NOTA_STORES`. Van a parte por decisión del
   usuario.
3. **PROHIBIDO** que la nota media se calcule sobre los totales sumados
   (sería otra cifra). Es la MEDIA de las notas por competición
   (`computePlayerRating` por comp, promedio de las que tienen `pj>0`).
4. **PROHIBIDO** romper el snapshot Liga-sola: `_persistBucket` de
   `ef_player_stats_liga_only_v1` debe seguir TOMÁNDOSE ANTES de fundir
   Copa+SC en `buckets.liga`.
5. Un jugador NUEVO de la plantilla hereda todo automáticamente (lookup
   por nombre normalizado + fuzzy). No hay listas por jugador.
6. La nota usa `computePlayerRating` (expuesta en `window`); cualquier
   recalibración de la fórmula del editor se propaga sola a la
   plantilla del hub. No duplicar la fórmula.

### El filtro de equipo de la plantilla es ALIAS-tolerante Bayern↔Liverpool (obligatorio, 2026-06-08)

**Bug (fotos usuario 2026-06-08, Mundialito de Clubes)**: el Liverpool
jugó 3 partidos oficiales del Mundialito de Clubes (con goles, tarjetas,
MVP, portería imbatida visibles en la caja «Mundialito · Estadísticas»),
pero en `s-bayern-plantilla` (caja Liverpool-Francia → 👕 PLANTILLA)
NINGÚN jugador tenía una sola estadística — TODO a 0.

**Causa raíz**: la caja Estadísticas del Mundialito (`_mundialRenderStatsGrid`)
NO filtra por equipo, así que muestra los goles del Liverpool tal cual los
trae el escáner (`_mundialStatsRobustScan` → claves `liverpool::jugador`).
La plantilla SÍ filtra al equipo del hub, y lo hacía con un match ESTRICTO
de UN solo nombre: `_teamKeyMatches(t, _normForStats(_hubTeamName()))`. El
slot del hub resuelve su nombre LÓGICO a «Bayern Munich» (legacy, el dato
del slot de Liga EA NO se renombró físicamente — solo el display vía
`menu_home_v1`), mientras los partidos del Mundialito guardan el equipo
como «Liverpool» → `_teamKeyMatches('liverpool','bayern munich')` = false
→ se descartaban TODAS las stats del hub → plantilla a 0.

**Fix** (`misc_body_1.html`, IIFE de `#s-bayern-plantilla`): helper
`_hubTeamKeyMatch(t)` que, además del match alias previo (`_hubTeamMatches`),
ensancha a un CLUB HUMANO CANÓNICO dirigido por el MISMO mister que el hub
(`_isHumanClubCanonico(t) && _mhSameMister(_hubTeamName(), t)`). Cubre
Bayern↔Liverpool en AMBOS sentidos (dato «Bayern» / eventos «Liverpool» o
al revés) y cualquier otra caja humana. Se aplica al merge del Mundialito
EN VIVO **y** a los loops de SUMA (`_STATS_STORES`) y NOTA (`_NOTA_STORES`),
para que el mismo desajuste de nombre no vacíe tampoco Liga/Copa/UCL/etc.
cuando el hub empiece a jugarlas.

Reglas:
7. **PROHIBIDO** filtrar las stats de la plantilla del hub por UN solo
   nombre estricto (`_teamKeyMatches(t, teamNorm)`). Usar `_hubTeamKeyMatch`
   (alias + mismo mister gateado por `_isHumanClubCanonico`), que tolera el
   desajuste Bayern↔Liverpool venga del lado que venga.
8. **PROHIBIDO** ensanchar ese match SIN el gate `_isHumanClubCanonico` +
   `_mhSameMister`: sin él se colarían IA del torneo (Bayern Leverkusen,
   Al Hilal, Club Brugge…) o el club de OTRO mister. El gate restringe el
   ensanche al club humano del propio hub.

### Toggle escudo CLUB ↔ SELECCIÓN (2026-06-03)

La cabecera de `#s-bayern-plantilla` muestra **dos escudos** arriba a
la derecha (`#bplant-crest-toggle`): el del **club** del hub (Liverpool)
y el de su **selección** (Francia). Pulsando cada escudo emerge la
plantilla de ese equipo en el MISMO layout `lext-sq-*`.

- El mapa club→selección sale de `window._mhFindMister(_hubTeamName())`
  (`.seleccion`), así que **generaliza a cualquier caja de humano**
  (Arsenal→Brasil, Atlético→Noruega, …). Fallback `'Francia'`.
- **Escudo del club = mapa CANÓNICO autoritativo** (`_CANON_CLUB_CREST`
  en `misc_body_1.html`; gemelo `_PS_CANON_CREST` para la card del hub
  en `_psHumanShield`). Bug 2026-06-04 (foto usuario, "por error
  continuado seguía saliendo el Bayern"): el filtro por URL
  `_isStaleBayernShield` SOLO detecta el escudo stale del Bayern cuando
  es una RUTA con `bayern-munchen`; **no** puede detectar un data-URI
  del Bayern guardado en `shield`/`img`/override del menú. Fix:
  `_hubClubCrest()` y `_psHumanShield()` resuelven el escudo del hub
  desde `_CANON_CLUB_CREST[_normForStats(nombre)]` **ANTES** de mirar
  ningún `shield`/`img`/override. Mapea los 6 clubes humanos a su
  archivo bundleado (`/static/img/escudos-1/*`); incluye alias legacy
  `bayern munich`/`bayern`/`lfc`→Liverpool y `paris saint-germain`/
  `paris`→PSG. **PROHIBIDO** volver a confiar primero en
  `shield`/`img`/`getTeamLogoUrl` para el escudo de la plantilla de una
  caja de humano canónica: el mapa canónico gana siempre (es lo único
  inmune a data-URIs stale). Una caja de humano nueva hereda esto
  añadiendo su club al mapa.
- Estado en `window._bplantView` (`'club'` | `'sel'`), toggle vía
  `window._bplantSetView(v)`. Default `'club'`.
- La **vista selección** (`_renderSelView`) reutiliza `_section`/`_rowFor`
  con un **ctx** `{statsFor, notaFor}`. El layout (GOLES único + NOTA)
  es idéntico al del club por el grid scopeado a `#s-bayern-plantilla`.
- **Fuente de stats de selección — AUTO-DETECTA las competiciones
  ACTIVAS** (petición usuario 2026-06-03: "cada año juega 2
  competiciones distintas", p.ej. Mundial 2032 + Road Copa Asia; el año
  siguiente Fase Final Copa Asia + Road Copa América; etc.).
  `_buildSelStatsMap(selName)` **NO** usa el store unificado
  `ef_player_stats_sel_v1` (acumula TODAS las temporadas). En su lugar:
  - `_selActiveTourIds()` enumera las cajas de selección **VISIBLES**
    (`tour_registry_v1.visible` ∩ `/^(spv|sfn)\d+$/`; fallback: todos los
    slots `spv1..spv10`+`sfn1..sfn10`).
  - Para cada torneo donde la selección juega Y tiene partidos
    disputados, agrega los stats por jugador vía
    `window._tourStatsFromCfgResults(cfg)` (lee `cfg.results[].events`)
    y suma `pj += partidos de la selección en ese torneo` (PJ
    team-level, mismo criterio que el club; `_tourStatsFromCfgResults`
    NO cuenta pj por sí solo).
  - **GOLES = total único** (gol+pen+fk sumado). **NOTA = una sola
    global** (`computePlayerRating` sobre el agregado, NO media por
    competición — decisión usuario).
- **PROHIBIDO** volver a leer `ef_player_stats_sel_v1` para la plantilla
  del hub (mezcla temporadas pasadas). La fuente son los torneos de
  selección ACTIVOS. El store unificado sigue siendo para
  sanciones/lesiones (cuenta continua), no para esta caja.
- Escudo del club: `_findBayernRow().shield/img` → `getTeamLogoUrl`.
  Escudo de la selección: `t.img` del store `selecciones_squad_v1`
  (`_selSquadLoad`) → `getTeamLogoUrl` → bandera emoji (`_SEL_FLAGS`).
- **PROHIBIDO** duplicar el layout de fila: la vista selección usa el
  MISMO `_rowFor`/`_section` parametrizados por `ctx`. Toda columna
  nueva se añade una sola vez.

## Toda caja de humano nueva HEREDA los códigos de sanción/lesión (obligatorio, 2026-06-02)

Petición usuario 2026-06-02: cuando se cree una **caja de humano**
nueva (un club marcado como humano: Arsenal🇧🇷=Brasil, Atlético🇳🇴=
Noruega, etc., los 6 del `MISTERS_REGISTRY`), **TODOS los códigos de
sanción y lesión deben aplicarse también a esa plantilla**, igual que
al Liverpool, y de forma **acumulativa cross-competición** para ese club.

### El motor ya es genérico por equipo — NO hardcodear al Liverpool

- `calcularSancionesPartido(events, humanTeam, teamName, comp)` y
  `procesarSancionesPostPartido` trabajan con el **nombre de equipo que
  reciben**. Los contadores son **por jugador::equipo**
  (`YELLOW_STORE.__global`, `SANCION_STORE.__global`) → cada club acumula
  independientemente. Aplica a CUALQUIER club reconocido como humano.
- **Detección de club humano**: usar SIEMPRE `window._isHumanClubCanonico(name)`
  (alias-safe, registro `MISTERS_HUMANOS`) y/o el `isHuman` LIVE de
  `ligaExt_liga-ea-sports`. **PROHIBIDO** gatear con listas exactas
  cacheadas al load (rompen con grafías/alias y con cajas nuevas). El
  overlay de lesión de `_generarLesionHumano` ya combina ambos
  (`_EQUIPOS_HUMANOS` live ∪ `_isHumanClubCanonico`).

### El hub pivota sobre UN resolver de "club activo"

Todo el hub (`s-munich`) resuelve su club vía **una sola fuente**:
`window._mkHubTeamName` / `_psHumanLogicName()` (lógico) y
`_psHumanName()` / `_psHumanShield()` (visual). Helpers ya dinámicos
que NO están atados al Liverpool: `_bayernSquad()` (lee
`_psHumanLogicName()`), `_athHubTeam()` (lee `_mkHubTeamName`),
`_athInjuredForHub()`, el overlay BAJAS (`_ppGetCurrentMatchTeams` lee
el DOM del partido). Para dar a una caja nueva su **hub completo
propio** (calendario, card "Próximo partido", overlay BAJAS,
entrenamiento, menú médico), se alimenta ese resolver con el club de la
caja — NO se duplica lógica ni se hardcodea el nombre.

### Reglas a respetar

1. **PROHIBIDO** hardcodear `/bayern/i`, `'Liverpool'`, `'Bayern
   Munich'` (ni ningún club concreto) en código nuevo de sanción /
   lesión / hub. Resolver SIEMPRE vía `_psHumanLogicName()` /
   `_mkHubTeamName` (club del hub) o el `teamName` del partido.
2. **PROHIBIDO** gatear "¿es humano?" con una lista exacta cacheada.
   Usar `_isHumanClubCanonico` (alias-safe) ∪ `isHuman` live.
3. **Cada club acumula lo suyo**: las stores son por `jugador::equipo`,
   nunca globales-de-un-solo-club. No mezclar contadores entre cajas.
4. Las **selecciones** de cada caja (Francia/Brasil/Inglaterra/Noruega/
   Argentina/España) siguen su propio motor `_sel*` (cuenta única `'sel'`
   por selección, ver sección de Selecciones). Club y selección de un
   mismo mister NO comparten contador (sistemas paralelos).
5. Al construir el **hub propio** de una caja nueva, reutilizar los
   helpers existentes parametrizados por el resolver de club activo; no
   clonar `s-munich` con nombres hardcodeados.

## Humanidad por competición (obligatorio, 2026-05-10)

**Un equipo puede ser HUMANO en una competición y IA en otra.** No
hay una lista global de "equipos humanos del proyecto" — la humanidad
depende del contexto. Helper canónico:
`window.isHumanInComp(name, comp)` (definido en `misc_body_1.html`
arriba del IIFE de UCL/UEL/UECL fase de liga).

| Competición                                | Humanos                                                    |
|--------------------------------------------|------------------------------------------------------------|
| `liga` / `copa` / `sc`                     | Solo los **5 humanos canónicos** de Liga EA Sports         |
| `ucl` / `uel` / `uecl` / `recopa` / `usc` / `inter` / `mundial` / `wprev` / `amistoso` / `torneo` | Cualquier equipo con `humanIcon(name)` asignado (por el editor de plantilla) |
| `superliga`                                | Equipos seleccionados al configurar Superliga (los 6)      |

Los **5 humanos canónicos** son: Real Madrid, FC Barcelona, Atlético
Madrid, Arsenal, Bayern Munich. Vienen de `esHumano()` que lee
`ligaExt_liga-ea-sports.teams[].isHuman`.

Los **humanos extra** (PSG, Manchester United, Borussia Dortmund,
Manchester City, RB Leipzig, etc.) tienen un `humanEmoji` asignado
en el editor de plantilla (Resto de Ligas) que `humanIcon(name)`
devuelve. Estos equipos son humanos SOLO en eur/superliga (donde
juega un humano "secundario") y son IA en Liga doméstica.

Reglas obligatorias:
1. **No usar `esHumano(name)` directamente para flujos eur/superliga.**
   Usar `window.isHumanInComp(name, comp)`.
2. **No añadir teams a la lista global de Liga EA solo para forzarlos
   a humano en otras comps.** Añade `humanEmoji` a su plantilla en el
   editor — eso lo hace humano en eur/amistoso/torneo SIN romper Liga.
3. **No hardcodear listas tipo `EUROPEAN_HUMANS = [...]`.** Cualquier
   chequeo de humanidad va por `isHumanInComp`.
4. **Pantalla obligatoria de estadísticas (posesión/tiros/faltas) tras
   FINALIZAR**: en gm-modal usar `_gmHumanInvolved()` (que cubre
   selecciones nacionales vía `cfg.teams[].isHuman`); en ml-card usar
   el helper local `_mlTeamIsHuman*` que respeta `st.homeIsHuman /
   awayIsHuman` y cae a `isHumanInComp(name, st.comp)` → `esHumano`.
   Bug 2026-05-24: `gmEndMatch` y `mlEndMatchGen` usaban `esHumano()`
   directo → Francia (humano) vs UAE (IA) en el Mundial se finalizaba
   sin pedir las stats obligatorias.

## Límites de almacenamiento por carpeta (obligatorio, 2026-05-02)

Cada carpeta y subcarpeta del almacenamiento del navegador
(localStorage namespace) tiene un cap de **2 MB**. Esto aplica a:

- Cada `ligaExt_<slug>` y todas sus claves derivadas
  (`_protected`, `_snap_<ts>`, …) sumadas.
- Cada estado de competición persistido (`wprev_state_v1`,
  `oq_simulation_v1`, `comp_icons_v1`, …).

Reglas a respetar:

1. **No escribir más de 2 MB en una sola clave.** Si una plantilla,
   acta o snapshot pasa de ese tamaño, hay que recortar (truncar
   históricos, reducir JSON, mover datos al servidor).
2. **No acumular tantos derivados que la suma por carpeta supere
   2 MB.** Por eso `saveData` mantiene como mucho `main` +
   `_protected` + 1 snapshot por liga (drop de `_backup` legacy
    2026-05-02, recorte de 2→1 snapshot 2026-07-03 — ver sección de
    quota más abajo).
3. **Si añades una nueva clave**, calcula su tamaño máximo plausible
   y déjalo bajo 2 MB. Los datos masivos (miles de eventos, históricos
   largos) van al servidor (`GlobalState` row con su clave) o se
   compactan/agregan antes de persistir.

## Copa del Rey — sorteo de cruces (obligatorio, 2026-05-09)

Reglas del cuadro de la Copa del Rey (`static/js/copa-engine.js`,
función `_pairTeamsConstrained`):

1. **EA solo contra PF / Hyp hasta Dieciseisavos.** Cualquier equipo
   de Liga EA Sports (los 5 humanos + 15 EA-IA) debe enfrentarse a un
   equipo de Primera Federación o Hypermotion en r1, r2 y r16. Nunca
   EA-vs-EA antes de Octavos.
2. **EA-vs-EA permitido desde Octavos**, pero `_preferenceFor` prioriza
   rivales no-EA cuando el bombo aún tenga PF/Hyp disponibles para
   demorar el primer EA-vs-EA al máximo.
3. **Cuartos prefiere no-humano** (regla histórica conservada): el
   primer humano-vs-humano cae idealmente en Semifinales.
4. **Local / visitante por nivel** (no se modifica el sistema previo):
   - Single-leg (r1/r2/r16/fin): `hostIsLower=true` → el equipo de
     MENOR poder juega en su campo. El de mayor poder es visitante.
   - Two-leg (oct/cua/sf): `hostIsLower=false` → IDA en campo del de
     MAYOR poder. La VUELTA, vía el swap del engine
     (`esVuelta ? m.v : m.l`), cae siempre en el campo del de MENOR
     poder. Empate de power → desempate alfabético determinista.

Helpers asociados:
- `_isEa(t)` → considera EA a humanos + `liga-ea-sports` + TBDs cuyo
  posible ganador pueda ser EA (`tbdMayBeEa`).
- `_tbdMayBeEa(tbd)` → mira el partido pendiente de la ronda anterior
  y devuelve `true` si alguno de los 2 contendientes es humano o
  pertenece a `liga-ea-sports`.

Si el nº de equipos llega impar al sorteo, `_computeSorteoPayload`
descarta 1 IA respetando estas reglas:
- r1/r2/r16: drop EA-IA → Hyp → PF (último). Quitar un EA-IA reduce
  presión sobre el pool no-EA; quitar un PF/Hyp lo deja más justo.
- oct+: drop PF → Hyp → EA. Descartamos a los más débiles primero.
- NUNCA descartamos humanos ni TBDs (ganadores pendientes).

## Motor único de simulación IA-vs-IA (obligatorio, 2026-05-09)

**Toda simulación IA-vs-IA del proyecto** (independientemente de la
competición — Liga EA Sports, Copa del Rey, Champions League, Europa
League, Conference League, Recopa, Supercopa de Europa, Supercopa de
España, Intercontinental, Mundialito Clubes, Torneos de Verano,
amistosos, Liga Hypermotion, Primera Federación, ligas externas…)
**debe usar el motor 4-ejes de Liga EA Sports** (`_simIAvsIAWithContext`)
para que los resultados sean coherentes con los valores manuales que
el admin pone en el editor (GLOBAL/ATAQUE/MEDIO/DEFENSA + capitán).

Camino canónico:
1. **Live IA-vs-IA**: `iaSimLive(mk, home, away, j[, j1fn])` →
   internamente llama `_simIAvsIAWithContext(home, away, j)`.
2. **Batch IA-vs-IA Liga EA**: `simularJornadaIA(j)` →
   `_simIAvsIAWithContext`.
3. **Auto-sim IA-vs-IA en gm-modal** (amistosos & equivalents):
   `_gmAutoSimulateIAvsIA()` → `_simIAvsIAWithContext`.
4. **Fallback**: `_fallbackIAvsIAScore` (legacy `simSimple` sobre
   TEAM_RATINGS escalar) **solo** si el motor 4-ejes no está disponible
   en el arranque. Nunca llamar directamente a `simSimple` desde rutas
   nuevas.

Reglas a respetar:
- **Prohibido** añadir nuevos paths que llamen `simSimple(rA, rB)` con
  ratings escalares como motor primario. Usar `_simIAvsIAWithContext`
  o, en su defecto, el wrapper `iaSimLive`.
- Las cajas de Champions/EL/ECL/Recopa/USC/Inter cuando reciban su
  módulo de simulación deben hookear `iaSimLive` con prefijo `mk` y
  registrar el persistor en la cadena `__is*SimPersist` de
  `iaSimLive` (igual patrón que Recopa con `recopa_*` o Supercopa de
  España con `sc_*`).
- HvH y HvIA (con humano) NO se simulan — el humano juega en vivo en
  gm-modal o calendar cards. El AI pre-roll de HvIA en Liga EA usa
  `simSimple` (legacy, conservado por el comportamiento histórico
  documentado del flag `_pendingAIEvents`).

Helpers a reutilizar (todos en `window.*`):
- `_simIAvsIAWithContext(home, away, j)` → motor 4-ejes con
  rojas pre-roll, capitán ×1.05, localía variable seeded.
- `_teamOffense(name)` / `_teamDefense(name)` → 60% atk/def + 40%
  mid, leen `ligaExt_*` o `TEAM_RATINGS`.
- `_captainBonus(name)` → 1.05 si hay C titular, 1.0 si no.
- `_aggressivenessFactor(name)` → 0.5–1.49 para densidad de tarjetas.
- `genMatchEventsEnhanced(teamA, teamB, gh, ga, simCtx)` → eventos
  del acta (goles, tarjetas, lesiones, MVP) consistentes con el
  marcador resultante.

## Iconos del equipo y del jugador en la simulación (obligatorio, siempre)

Cada vez que se simule un partido (Liga, Copa, competiciones europeas,
amistosos o cualquier otro torneo), el motor **debe** leer y aplicar los
iconos definidos en la plantilla. Esto aplica tanto al motor Python
(`app.py`, `logica_liga.py`) como al motor JS (`static/js/*.js`,
`templates/partials/**`).

### 🛡 Nivel / valor del equipo (4 ejes manuales del admin, 2026-05-02)

Cada equipo tiene 4 valores numéricos que el admin define en el
editor de Resto de Ligas (Valor-Poder-Nivel equipo): GLOBAL, ATAQUE,
MEDIO y DEFENSA. Esos 4 números son la **fuente de verdad** y los
devuelve `computeLineStats(t)` en
`templates/partials/misc_body_1.html` tal cual — sin auto-derivar
nada de la plantilla de jugadores.

- **ATAQUE**: más ATQ → más goles marca el equipo.
- **MEDIO**: COMPENSA tanto ataque como defensa con peso `0.5` cada
  lado.
- **DEFENSA**: más DEF → menos goles encaja el equipo.
- **GLOBAL**: balance general. Inclina la probabilidad general del
  partido (peso `0.1` en `attackForce` / `defenseForce`).

Si una línea concreta está vacía o a 0, cae a GLOBAL (`t.power`)
como fallback. Si tampoco hay GLOBAL, default 50.

La plantilla de jugadores SIRVE para listar la nómina, marcar
capitán/lanzadores/goleadores y para el acta del partido. **NO** se
usa para recalcular el GLOBAL/ATQ/MED/DEF del equipo.

#### Historial de la regla (por qué llegamos aquí)

- 2026-04-28: se introdujo auto-cálculo desde la plantilla
  (`ATK = media delanteros`, etc.) para automatizar los valores en
  todas las ligas.
- 2026-05-02 (1ª iter.): el GLOBAL pasó a ser `(ATQ+MED+DEF)/3` en
  lugar de "media de top 11" porque incluir al portero inflaba la
  cifra respecto a los chips visibles.
- 2026-05-02 (2ª iter.): se añadió un toggle "🔒 Forzar valores
  manuales" para que el admin pudiera anular el auto-cálculo.
- 2026-05-02 (3ª iter., final): el usuario reportó que sus 87/88/87/86
  para el PSG bajaban a 81/78/80/84 al renderizar la clasificación —
  el toggle estaba desmarcado por defecto. Se eliminó el auto-cálculo
  por completo: `computeLineStats` devuelve siempre los valores
  manuales, sin checkbox ni opción.

El simulador `simulateMatch(tA, tB)` usa la fórmula:
```
attackForce = ATK + 0.5·MID + 0.1·GLOBAL
defenseForce = DEF + 0.5·MID + 0.1·GLOBAL
goles_A = Poisson(1.3 + 0.025·(attackForce_A − defenseForce_B))
```
Local recibe +3 al GLOBAL como ventaja de casa. Se mantiene el bonus
de capitán `×1.05` sobre el valor del equipo donde aplique.

### ⚾ Goleador nato (natGoal)

- Multiplicador `×1.8` al peso del jugador en la elección de goleador.
- El objetivo es que el goleador nato marque **≈30% de los goles del
  equipo** (ajustado 2026-04-26: antes era ×3 → ~50%).

### 🏀 Goleador estrella (natGoalPro) — prioridad máxima

- Multiplicador `×3.0` al peso del jugador en la elección de goleador.
- El objetivo es que el goleador estrella marque **≈48% de los goles
  del equipo** (rango 46-50%).
- **NO se acumula con ⚾**: si un jugador lleva 🏀, ⚾ se ignora — un
  jugador es "goleador estrella" O "goleador nato" a efectos del peso,
  no ambos. Esto evita que el peso se dispare por encima del 48%.

### P (lanzador de penaltis)

- Cuando se resuelve un penalti, el lanzador se elige preferentemente
  entre los jugadores con flag `penalty` antes de caer al algoritmo
  general.
- Además suma puntos fijos al peso de goleador cuando el gol proviene
  de penalti.

### F (lanzador de falta)

- Cuando el gol proviene de una falta directa, el ejecutante se elige
  preferentemente entre los jugadores con flag `freeKick`.
- Suma puntos fijos al peso de goleador en jugadas de falta.

### ⭐ Elite / estrella

- **NO** afecta al resultado del partido.
- Solo influye en premios individuales (MVP) y noticias.

### C (capitán) — modificador de soporte

- Si hay un capitán titular en el campo, el "valor" del equipo recibe
  un `×1.05` adicional.
- Bonus invisible: no se muestra como estadística, pero sí se aplica.

## Puntuación del MVP — realista élite (obligatorio, 2026-05-31)

**Bug (foto usuario 2026-05-31)**: el ranking de MVP de la Liga salía
LLENO de porteros (Robert Sánchez, Donnarumma, Henderson, Lammens,
Pope, Sommer… los 6 primeros porteros). Un portero NO puede ser MVP
el ~40% de los partidos — no es real.

### Causa raíz

El MVP de la simulación IA-vs-IA por lotes (`simularJornadaIA` →
`_simIAvsIAWithContext` → `genMatchEventsEnhanced` → `genMatchEvents`)
se elegía con un sorteo ponderado donde el **portero con portería a
cero pesaba +4.0** mientras cada jugador de campo sólo +0.5 y un gol
+3.0. Como las porterías a cero son MUY comunes en sims de pocos goles
(y un 0-0 da +4.0 a LOS DOS porteros), los metas ganaban ~40-44%.

### Modelo nuevo (en `genMatchEvents`, `part2/misc_body_2.html`)

Sorteo ponderado por jugador:

- **Base por posición** (todo jugador de campo entra): Delantero (F)
  **1.6** · Medio (M) **1.0** · Defensa (D) **0.55** · posición
  desconocida 0.8.
- **Gol marcado**: **+3.0** cada uno (doblete/hat-trick casi siempre
  se lleva el MVP).
- **Gol decisivo** (el `(golesPerdedor+1)`-ésimo gol del ganador, el
  que pone por delante para no devolver la ventaja): **+1.5** a su
  autor.
- **Portero con portería a cero**: **+2.0** (antes 4.0). **Sin**
  portería a cero el portero NO entra al sorteo.
- **Sesgo al equipo ganador**: base de campo **×1.15** al ganador,
  **×0.85** al perdedor (empate → ×1.0). El MotM casi nunca sale del
  equipo goleado.

Distribución resultante (Monte-Carlo 300 k partidos, marcador
Poisson λ≈1.35): **F 61% · M 21% · D 7% · Portero 7%** global, con
picos legítimos por marcador (0-0 ≈ 17% portero, partidos decididos
≈ 0%).

### Reglas a respetar

1. **PROHIBIDO** devolver el peso del portero con portería a cero a
   4.0 (ni nada que lo haga dominar el sorteo). El tope realista es
   ~+2.0 frente a un gol +3.0 y bases de campo por posición.
2. **PROHIBIDO** dar a un portero que ENCAJA peso de MVP. Sólo entra
   al sorteo con portería a cero (+ futuros bonus tipo penalti parado
   si se añaden).
3. El motor de partido EN VIVO (`index.bundle.js`, ticker IA-vs-IA) y
   el de Copa (`copa-engine.js`) ya son realistas (el portero sólo
   puntúa por `pen-parado`, sin bonus de portería a cero) — **no**
   reintroducir un bonus de clean-sheet ahí.
4. Toda comp/motor NUEVO que elija MVP debe mantener esta jerarquía:
   atacantes que marcan ≫ mediocampistas ≫ defensas > porteros.

## Propagación de flags al motor

Los flags viven en el editor de plantilla y se guardan en
`window._LIGA_EA_PLAYER_FLAGS` (JS). Toda función que construya entradas
de jugador para la simulación (`sqFromRegistry`, builders similares)
**debe** propagar los 6 flags (`captain`, `freeKick`, `penalty`,
`elite`, `natGoal`, `natGoalPro`) a cada entry. No basta con propagar
solo `elite`/`natGoal`.

## Qué NO hacer

- No cambies los pesos numéricos anteriores (×1.8 natGoal, ×3.0
  natGoalPro, ×1.05 capitán, etc.) sin acordarlo explícitamente con el
  usuario.
- No añadas simulación nueva sin que consuma estos flags.
- No borres flags al serializar/deserializar plantillas.


## Clasificación a competiciones europeas (obligatorio, 2026-05-02) ⚠️ MATIZADA por la sección "Una liga RECIÉN RESETEADA..." (2026-08-02 #2) más arriba

**Matiz 2026-08-02**: el ranking por poder para `rN === 0` de esta
sección (más abajo, "Si `rN === 0` → ranking por power") solo aplica a
una liga **VIRGEN** (`data.neverPlayed` ausente). Una liga con
`data.neverPlayed === true` (recién reseteada por
`ligaExtReiniciar`/`ligaExtReiniciarSlug`) aporta 0 equipos hasta que se
vuelva a simular — ver esa sección para el porqué.

Para que un equipo de Resto de Ligas vaya a una competición europea
**directa** (UCL fase de liga, Previa Champions, UEL, UECL) basta con
que haya jugado **al menos 1 partido** en su liga. El check per-team
es: `pj === 0` (cuando hay resultados parciales) → SKIP ese equipo y
avanzar al siguiente del ranking. Esto cubre exactamente el bug
original — equipos sin partido jugado que sorteaban al top por
desempate alfabético sobre `pts=0` tras una Sim batched/asíncrona.

Filosofía: una liga parcialmente simulada SÍ debe contribuir sus
equipos "reales" (los que han jugado al menos algo), no solo los
fully-played. Una liga sin simular nada (rN=0) usa `_rankByPower`
como siempre — todos los teams tienen pj=0 pero es la única señal
disponible.

Las zonas **feeder** (`uclQual` = Open Qualifier, `wildcard`) son
permisivas a propósito — alimentan al OQ y al pool de Previa
Champions, NO clasifican directo a una competición europea. Aceptan
teams con pj=0 sin filtro, para no dejar plazas TBD-OQ-XX.

Lógica en `_computeQualifiedFromLeagues(zoneKey)` (`misc_body_1.html`):

1. Para zonas directas (`ucl`/`uclPrev`/`uel`/`uecl`):
   - Si `rN === 0` → ranking por power (rank-by-power), sin filtro.
   - Si `rN > 0` → ranking por resultados (standings); descartamos
     SOLO los teams con `pj === 0` (race condition / data stale).
2. Para zonas feeder (`uclQual`/`wildcard`), no se aplica filtro.
   Aceptan rank-by-power y standings parciales tal cual.
3. Excepciones absolutas (cualquier zona):
   - **Liga EA Sports / Hypermotion / 1ª RFEF** → bloqueadas en
     `EUROPE_BLACKLIST` (manual-only vía pantalla "EA Sports → Europa").

Bug histórico que motivó el filtro per-team: tras pulsar Sim en una
liga, la escritura de resultados era batched/asíncrona. Durante esa
ventana el admin abría la pantalla de Europa y
`_computeQualifiedFromLeagues` veía `rN > 0` pero `pj === 0` para
varios equipos. Esos equipos empataban a `pts=0` y sorteaban a las
primeras posiciones por desempate alfabético sobre el nombre — el
código los enviaba a Europa con 0 partidos jugados. El check
`pj === 0 → continue` los descarta.

Por qué NO hay gate de liga (`rN < needed → skip whole league`) ni
gate per-team estricto (`pj < expectedPj`): ambos se intentaron en
los commits `c983a56` y `3fb9247` pero resultaron demasiado coarse —
descartaban ligas parciales enteras o teams legítimos que habían
jugado varios partidos pero la liga seguía a medias, dejando el pool
de Previa Champions con TBD-50..63 (reportado por el usuario con
fotos). El check `pj === 0` es exactamente la condición del bug
original sin destruir contribuciones legítimas.

## EXENTOS Previa Champions (OBSOLETO desde 2026-05-30)

> ⚠️ **OBSOLETO**: la Previa pasó a **fase de grupos pura + corte
> global** (ver sección "Wild Card + Open Qualifier — FASE DE GRUPOS"
> arriba). Ya **no hay** Ronda 1 eliminatorias, ni Ronda Final, ni
> EXENTOS, ni `splitByesAndR1`. Esta sección se conserva solo como
> histórico. **PROHIBIDO** reintroducir los EXENTOS / `splitByesAndR1`.

Los 3 EXENTOS — los equipos que pasan directos a la Ronda Final de la
Previa de Champions sin jugar la Ronda 1 de eliminatorias — siguen una
regla concreta del usuario, no "los 3 mejores por power":

1. **Bye fijo**: el 5º clasificado de Liga EA Sports. Entra al pool de
   Previa por la pantalla manual "EA Sports → Europa" (Liga EA está
   blacklisted del cómputo automático), así que en el pool tiene
   `league: 'ea-sports-manual'`. Si el admin añadió varios manuales
   para `uclPrev`, prevalece el de mayor power.
2. **2 byes aleatorios**: 2 elegidos al azar de entre los 2º
   clasificados de **Bélgica, Turquía, Suiza, Dinamarca y Escocia**.
   En el pool tienen `league` igual al slug del país. El sorteo se
   renueva en cada `Draw` (`splitByesAndR1` en `misc_body_2.html`).
   Una vez sorteados, los byes se persisten en `wprev_state_v1`, así
   que sobreviven a recargas hasta el próximo Draw.
3. **Fallback**: si faltan candidatos (admin no añadió el español o
   alguna de las 5 ligas no está simulada), se rellena con los
   siguientes equipos del pool por power para no dejar plazas vacías.

Los otros 60 equipos del pool (los no-bye) se dividen en CABEZAS de
serie (los 30 mejores por power) y NO CABEZAS (los 30 peores) y
forman las 30 eliminatorias de Ronda 1.

## Cronómetro del partido — BASE INMUTABLE (obligatorio, 2026-05-10)

**PRECEDENTE PERMANENTE**: el cronómetro de simulación tiene que
correr siempre del minuto 0 al minuto 90 (más descuento) en
**TODAS** las competiciones (Liga EA Sports, Superliga, Copa del
Rey, Champions League, Europa League, Conference League, Recopa,
Supercopa España, Supercopa Europa, Intercontinental, Mundialito
Clubes, Torneos de Verano, amistosos, Liga Hypermotion, Primera
Federación, fases finales de Selecciones, eliminatorias únicas, y
cualquier otra que se añada en el futuro), en los 3 modos:

- **IA vs IA** (1 game-min = 1 sec real, total 1m 30s)
- **HvH** (humano vs humano)
- **HvIA** (humano vs IA / IA vs humano)

Esta regla es **bloqueante absoluta** — ninguna PR puede dejar el
cronómetro clavado en 0' en ninguna competición ni modo. Si un
cambio rompe el avance del cronómetro, ese cambio se REVIERTE.

### Anti-patrones prohibidos (que rompieron el cronómetro en 2026-05-10)

1. **MutationObserver global sobre `document.body` con
   `subtree:true`** que dispara funciones costosas en CADA
   mutación del DOM. Crea bucles porque casi cualquier cosa
   modifica el DOM. → Usa polling con `setInterval` o un observer
   restringido a un nodo concreto.

2. **Bucles `observer → setProperty/classList → observer`**
   sin guard. Toda función que aplique estilos/clases debe ser
   IDEMPOTENTE: cachear una firma (`comp|home|away` o similar) en
   el elemento y `return` temprano si no cambió.

3. **Polling agresivo (< 100ms) competiendo con el setInterval
   del cronómetro**. El timer IAvsIA corre a 1 sec/min, HvH a
   ~875ms/tick. Un `setInterval(fn, 50)` que llama a funciones
   DOM-heavy puede bloquear el event loop y saltar ticks del
   cronómetro. Mínimo recomendado: **100ms para hints visuales,
   300ms para escaneos de cards**.

4. **MutationObserver sobre el propio elemento que el observer
   modifica** sin filtro de "cambió de verdad". Ejemplo: observer
   sobre `#gm-modal[attributes]` que dispara `_gmApplyTheme` →
   `_gmApplyTheme` hace `style.setProperty` → mutación → observer
   → loop. → Filtrar por `prevDisplay !== disp` antes de actuar.

### Patrón canónico para post-procesadores UI de las cards

```js
function _applyThing(el){
  if (!el) return;
  var sig = _computeSig();           // p.ej. comp|home|away
  if (el._lastSig === sig) return;   // GUARD — sin mutations
  el._lastSig = sig;
  // … aplicar estilos / clases / atributos …
}
// Observer SOLO de cambios de display:
var prevDisplay = el.style.display;
new MutationObserver(function(){
  if (el.style.display === prevDisplay) return;
  prevDisplay = el.style.display;
  if (el.style.display === 'none'){
    el._lastSig = null;              // reset al cerrar
    return;
  }
  _applyThing(el);
}).observe(el, { attributes:true, attributeFilter:['style'] });
// Polling de respaldo a ≥100ms con classList.contains() check
// antes de add/remove para evitar mutations innecesarias.
```

Las funciones helper deben usar `_setHintIfChanged(btn, want)` —
comprobar el estado actual antes de mutar.

### Histórico

- 2026-05-10: `MutationObserver` en `document.body[subtree:true]`
  + observer en `#gm-modal[attributes]` + `_gmApplyTheme`
  no-idempotente + polling 50/100ms bloquearon el thread JS y los
  cronómetros de TODAS las competiciones se quedaron clavados en
  0'. Fix: guards de idempotencia, observer restringido a `style`
  con filtro `prevDisplay`, eliminado el observer global, polling
  100/300ms con `_setHintIfChanged`. Documentado aquí como
  precedente permanente.

## Duración del cronómetro del partido (obligatorio, siempre)

**TIEMPOS OFICIALES** (definidos en
`templates/partials/part2/misc_body_2.html`, bloque `_MATCH_RULE`):

| Modo  | gameMin | realMin | displayMin (previa) | ms/tick (5s juego) | s/game-min |
|-------|---------|---------|---------------------|--------------------|------------|
| HvH         | 90 | 16.5  | 10 | ≈ 917 ms | 11 s  |
| HvH prórroga| 30 |  5    | —  | ≈ 833 ms | 10 s  |
| HvIA        | 90 | 9.75  |  8 | ≈ 542 ms |  6.5 s|
| IAIA        | 90 |  1.5  | "45 s/parte" | ≈ 83 ms | 1 s |

- HvH = humano vs humano → **16.5 min reales**. Previa: "10 min". 1 game-min = 11 s reales.
- HvIA = humano vs IA / IA vs humano → **9.75 min reales** (9 min
  45 s). Previa: "8 min". 1 game-min = 6.5 s reales.
- IAIA = IA vs IA → **1 min 30 s reales total** (45 s por parte). 1 game-min = 1 seg real.
- HvH_ET = prórroga humana → 5 min reales.

**REGLA DE ORO 2026-05-19**: `displayMin` (lo que la previa MUESTRA)
y `realMin` (lo que el cron REALMENTE dura) están **DESACOPLADOS** por
petición explícita del usuario. El cron va al ritmo eFootball (11 s/6.5 s
por game-min) mientras la previa muestra "10 min" / "8 min" porque ese
es el número "de referencia" en su memoria. La alineación display=real
del 2026-05-10 (HvH 6.67 s, HvIA 5.33 s) quedó rescindida porque el
cron iba más rápido que eFootball y la vida real.

Historial:
- Pre 2026-04-26: HvH 11 s, HvIA 9 s.
- 2026-04-26 (intermedio): HvH 10.5 s, HvIA 6.5 s.
- 2026-05-10 (alineación display=real): HvH 6.67 s, HvIA 5.33 s.
- 2026-05-19: vuelta al pre-mayo (HvH 11 s, HvIA 9 s) con display desacoplado.
- 2026-05-21: HvIA recalibrado a **7.4 s/game-min** (11.1 min reales).
  El usuario midió "min 45 del juego = min 37 del simulador" con el
  cron a 9 s/game-min → `9 × 37/45 = 7.4 s/game-min` es el ritmo real
  de su eFootball. Con web y juego al mismo ritmo, el minuto del cron
  coincide con el del juego. HvH se mantiene en 11 s. Display previa
  HvIA sigue en "8 min".
- 2026-05-22: HvIA recalibrado a **6.5 s/game-min** (9.75 min reales,
  9 min 45 s). El usuario pidió bajar el cron de la 1ª parte de
  "7 segundos con algo" a 6.5 s. Aplica a todo el partido (HvIA =
  IA vs Humano y Humano vs IA, ambos modos). HvH se mantiene en
  11 s. Display previa HvIA sigue en "8 min".

Estos valores los puede ajustar el usuario mediante petición explícita.
No cambiar sin acuerdo.

`realMin` controla el cronómetro real. `displayMin` / `displayLabel`
controlan SOLO el label visible en la pantalla de PREVIA — están
desacoplados a petición del usuario.

### Inicio de la 2ª parte (obligatorio)

Tras el descanso (HT), al pulsar ▶️ "continuar 2ª parte" el cronómetro
de juego debe arrancar SIEMPRE en `45:00` exacto, NO en `45+N` ni en
`46:00`/`47:00`/`48:00`. El descuento de la 1ª parte ya se mostró
durante "45+1, 45+2…" antes del descanso, así que se descarta al
reanudar. Se aplica tanto al flujo `_ml*` (calendar cards,
`_mlResumeFromDescanso`) como al gm-modal (`gmContinueSecondHalf`):
ambos hacen `timerSec = 2700` y re-anclan `_wallStart` /
`_secAtStart` antes de arrancar el interval.

### Descuento FIJO en regulación (obligatorio, 2026-05-19)

`gameMin = 90` significa que el reloj llega a 90:00 en "tiempo normal".
El descuento de cada parte está **FIJADO** (petición usuario
2026-05-19, no event-driven):

- **1ª parte**: SIEMPRE recorre `45+1, 45+2, 45+3, 45+4` y se **CONGELA
  en 45+4** hasta que el humano pulse `🛌 DESCANSO`.
- **2ª parte**: SIEMPRE recorre `90+1, 90+2, … 90+9` y se **CONGELA
  en 90+9** hasta que el humano pulse `🏁 FINALIZAR`.

El botón `🛌 DESCANSO` emerge en el **min 35** (umbral
`timerSec >= 2100`, petición usuario 2026-05-22; antes min 40).
El botón `🏁 FINALIZAR` cambia a **rojo
brillante pulsante** (clase `.is-near-end`) desde el **min 80**
(`timerSec >= 4800`) hasta que el humano la pulse — la fase
`matchOver` (timerSec ≥ fullMax con cron congelado) sigue mostrando
`🏁 VER RESUMEN` en verde-dorado (precedente 2026-05-17).

El botón `⏱ PRÓRROGA` (gm-modal, `gm-btn-et`) solo emerge desde el
**min 80** (`timerSec >= 4800`) y SOLO si el partido va en empate sin
resolver (`_shouldForceET` — contexto eliminatoria, marcador igualado,
ET/penaltis no jugados). Antes del min 80 la única acción es
`🏁 FINALIZAR`. Petición usuario 2026-05-22: "el botón de prórroga
tiene que emerger en el minuto 80 en el caso de que vayan empate, no
durante todo el partido".

Helper: `window._mlCountStoppageHalves(st)` →
- `{first: 4, second: 9}` para HvH/HvIA en regulación
  (`!st.etDone && !st.isIAvsIA`).
- Event-driven (cuenta eventos del acta) para IA vs IA
  (`st.isIAvsIA`) y para prórroga (`st.etDone`).

**HvIA — slowdown ×1.5 durante el descuento** (petición usuario
2026-05-24). En HvIA / IAvH (un humano contra IA), cada game-minute
del descuento dura **1.5× lo que duraría con el ritmo actual**:

- 1ª parte (`45+1..45+4`): rearm del interval al cruzar `timerSec
  >= 2700` con `tickMs *= 1.5`. Solo HvIA, no HvH ni IAIA.
- 2ª parte (`90+1..90+9`): rearm al cruzar `timerSec >= 5400` con
  `tickMs *= 1.5`. Se aplica **encima** del slowdown +0.5 s/min del
  min 65 (multiplicativo).

Flags persistidos en `st` (ml-card) / `_gm` (gm-modal):
`_stop1Applied`, `_stop2Applied`. Se setean al rearmar para evitar
re-arms en cada tick. La detección vive en `_mlResolveClock` cuando
recibe `timerSec`, `htDone`, `etDone`:
- `inStop1 = !htDone && timerSec >= 2700 && timerSec < 5400`
- `inStop2 = htDone && timerSec >= 5400 && timerSec < 7200`

HvH y IAIA NO se ralentizan en el descuento — solo HvIA.

**IA vs IA mantiene descuento event-driven** (petición usuario
2026-05-19): cada gol/tarjeta/lesión/etc. en una parte añade
+1 game-min al tope de esa parte. Los partidos IA-vs-IA no tienen
humano que pulse DESCANSO/FINALIZAR, así que el descuento "natural"
por eventos sigue siendo útil para que partidos con muchos goles
duren un poco más.

PRÓRROGA mantiene el modelo legacy event-driven (no tocado en
2026-05-19). HvH y HvIA en gm-modal: cuando `timerSec ≥ gmHalfMax`
con humano, el reloj se CONGELA en `gmHalfMax` (sin auto-halftime)
— el cron sólo avanza tras pulsar DESCANSO. Misma regla en
ml-cards. IA vs IA mantiene auto-descanso / auto-finalize.

Histórico:
- 2026-05-09: introducido descuento dinámico event-driven (+1
  game-min por evento, sin tope).
- 2026-05-19: usuario pide caps fijos +4 / +9 porque (a) partidos
  con muchos eventos producían descuentos absurdos (90+12, 90+15) y
  (b) partidos sin eventos no tenían descuento alguno. Ahora la
  ventana es predecible y siempre la misma.

### Fuente única

La velocidad del reloj (`tickMs`) SIEMPRE debe salir de
`window._mlResolveClock({ isHvH, etDone, home, away })` o su alias
`window._mlTickMs(st)`. El label visible SIEMPRE debe salir de
`window._mlRealDurationLabel({ isHvH, humanInvolved })`.

**PROHIBIDO**:
- Hardcodear `"15 min 45 s"`, `"9 min 45 s"`, `"10 min"`, `"8 min"` o
  cualquier duración.
- Cachear `tickMs` en variables de módulo al cargar (hay que leerlo en
  cada arranque del reloj porque el admin puede cambiar el override).
- Duplicar tablas `_MATCH_RULE` / `_MATCH_TICKS`.
- Añadir "campo mode" u otros atajos visuales que extiendan la duración
  real de IAIA por encima de 90 s.
- Reintroducir botones ⏪/⏩ de retrasar/adelantar tiempo en partidos
  HvH/HvIA. El usuario los retiró (2026-04-26) porque ocupaban
  demasiado espacio en el header del cronómetro y desplazaban los
  nombres de los equipos. Solo botón ▶ visible.

### Override admin (`_ppDurationMin`)

- Solo aplica a partidos con humano (HvH / HvIA). No toca IAIA.
- Se aplica reescalando `tickMs = realMs / totalTicks`, manteniendo el
  mismo número de ticks totales (no rompe la progresión de eventos).
- El helper `_mlResolveClock` ya lo consume. Cualquier ruta nueva debe
  usar el helper, no leer `_MATCH_TICKS` directamente.
