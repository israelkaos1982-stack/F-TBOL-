# CLAUDE.md — Reglas obligatorias del proyecto F-TBOL

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
3. `COMP_BALL[compKey]` — default hardcoded por comp.
4. Override por clima: nieve → `eFootball MAX VIS 26`.
5. Fallback `ml-ball-name` del DOM (`ball-wrap-<matchKey>`).

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
   `_protected` + 2 snapshots por liga (drop de `_backup` legacy
    2026-05-02 — ver sección de quota más abajo).
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


## Clasificación a competiciones europeas (obligatorio, 2026-05-02)

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

## EXENTOS Previa Champions (obligatorio, 2026-05-02)

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
