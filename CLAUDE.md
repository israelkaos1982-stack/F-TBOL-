# CLAUDE.md — Reglas obligatorias del proyecto F-TBOL

## Iconos del equipo y del jugador en la simulación (obligatorio, siempre)

Cada vez que se simule un partido (Liga, Copa, competiciones europeas,
amistosos o cualquier otro torneo), el motor **debe** leer y aplicar los
iconos definidos en la plantilla. Esto aplica tanto al motor Python
(`app.py`, `logica_liga.py`) como al motor JS (`static/js/*.js`,
`templates/partials/**`).

### 🛡 Nivel / valor del equipo (4 ejes — auto-derivados, 2026-04-28)

Cada equipo tiene 4 valores numéricos calculados automáticamente desde
la plantilla por `computeLineStats(t)` en
`templates/partials/misc_body_1.html`:

- **GLOBAL** = media de poder de los **11 mejores** jugadores (alineación
  ideal). Inclina la probabilidad general del partido.
- **ATAQUE** = media de poder de los **DELANTEROS**. Más ATQ → más goles
  marca el equipo.
- **MEDIO** = media de poder de los **CENTROCAMPISTAS**. **COMPENSA** tanto
  ataque como defensa con peso `0.5` cada lado.
- **DEFENSA** = media de poder de los **DEFENSAS**. Más DEF → menos goles
  encaja el equipo.

Si una posición no tiene jugadores, cae al GLOBAL como fallback. Si la
plantilla está vacía, usa los valores manuales guardados
(`t.atk/mid/def/power`) — esto preserva ligas con admin-overrides
explícitos del editor.

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
