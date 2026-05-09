# CLAUDE.md — Reglas obligatorias del proyecto F-TBOL

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

## Duración del cronómetro del partido (obligatorio, siempre)

**TIEMPOS OFICIALES** (definidos en
`templates/partials/part2/misc_body_2.html`, bloque `_MATCH_RULE`):

| Modo  | gameMin | realMin | displayMin (previa) | ms/tick (5s juego) | s/game-min |
|-------|---------|---------|---------------------|--------------------|------------|
| HvH         | 90 | 15.75 | 10 | ≈ 875 ms | 10.5 s |
| HvH prórroga| 30 |  5    | —  | ≈ 833 ms | — |
| HvIA        | 90 |  9.75 |  8 | ≈ 542 ms |  6.5 s |
| IAIA        | 90 |  1.5  | "45 s/parte" | ≈ 83 ms | 1 s |

- HvH = humano vs humano → **15 min 45 s reales**. Previa: "10 min". 1 game-min = 10.5 s reales.
- HvIA = humano vs IA → **9 min 45 s reales**. Previa: "8 min". 1 game-min = 6.5 s reales.
- IAIA = IA vs IA → **1 min 30 s reales total** (45 s por parte). 1 game-min = 1 seg real.
- HvH_ET = prórroga humana → 5 min reales.

Estos valores los puede ajustar el usuario mediante petición explícita
(historial: 2026-04-26 bajada de HvH 11→10.5 s y HvIA 9→6.5 s). No
cambiar sin acuerdo.

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

### Descuento dinámico por eventos (obligatorio)

`gameMin = 90` significa que el reloj llega a 90:00 en "tiempo normal".
El descuento NO se pre-calcula: cada evento del acta (gol, autogol,
penalti provocado/gol/parado/fallado, gol de falta, amarilla, doble
amarilla, roja, lesión) añade **1 game-minute** al tope de SU parte:

- Evento en min < 45 → prolonga la 1ª parte. El reloj muestra `45+1`,
  `45+2`, …, hasta `45+N` (N = eventos en 1ª parte) antes del descanso.
- Evento en min ∈ [45, 90) → prolonga la 2ª parte. Reloj: `90+1`,
  `90+2`, …, `90+N`.
- Eventos con min ≥ 90 (ya en stoppage) no cuentan — no se pueden
  prolongar a sí mismos.

En tiempo REAL, 1 game-minute de descuento equivale a:
- HvH → 10.5 segundos reales por evento.
- HvIA → 6.5 segundos reales por evento.
- IAIA → 1 segundo real por evento.

Helper: `window._mlCountStoppageHalves(st)` → `{first, second}`.
Se invoca en el tick del cronómetro y en cada render. NO cachear los
valores — cambian con cada evento nuevo.

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
