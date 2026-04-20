# CLAUDE.md — Reglas obligatorias del proyecto F-TBOL

## Iconos del equipo y del jugador en la simulación (obligatorio, siempre)

Cada vez que se simule un partido (Liga, Copa, competiciones europeas,
amistosos o cualquier otro torneo), el motor **debe** leer y aplicar los
iconos definidos en la plantilla. Esto aplica tanto al motor Python
(`app.py`, `logica_liga.py`) como al motor JS (`static/js/*.js`,
`templates/partials/**`).

### 🛡 Nivel / valor del equipo

- El "valor" del equipo es la **suma** de los `poder` de los jugadores
  titulares (no la media).
- La simulación debe usar este valor numérico como peso del equipo al
  calcular goles, dominio y resultado.
- Se mantiene el bonus de localía `×1.10` sobre el valor resultante.

### ⚾ Goleador nato (natGoal) — prioridad máxima

- Multiplicador `×3` al peso del jugador en la elección de goleador.
- El objetivo es que el goleador nato marque ≈50% de los goles del
  equipo.

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
**debe** propagar los 5 flags (`captain`, `freeKick`, `penalty`,
`elite`, `natGoal`) a cada entry. No basta con propagar solo
`elite`/`natGoal`.

## Qué NO hacer

- No cambies los pesos numéricos anteriores (×3 natGoal, ×1.05 capitán,
  etc.) sin acordarlo explícitamente con el usuario.
- No añadas simulación nueva sin que consuma estos flags.
- No borres flags al serializar/deserializar plantillas.


## Duración del cronómetro del partido (obligatorio, siempre)

**TIEMPOS OFICIALES — FIJADOS PARA SIEMPRE** (definidos en
`templates/partials/part2/misc_body_2.html`, bloque `_MATCH_RULE`):

| Modo  | gameMin | realMin | displayMin (previa) | ms/tick (5s juego) |
|-------|---------|---------|---------------------|--------------------|
| HvH         | 94 | 16    | 10  | ≈ 851 ms |
| HvH prórroga| 30 |  5    | —   | ≈ 833 ms |
| HvIA        | 94 | 13.5  |  8  | ≈ 718 ms |
| IAIA        | 90 |  1    | "30 s/parte" | ≈ 56 ms |

- HvH = humano vs humano → **16 min reales**. La previa muestra "10 min".
- HvIA = humano vs IA → **13.5 min reales** (13 min 30 seg). La previa muestra "8 min".
- IAIA = IA vs IA → **1 min real total** (30 s por parte).
- HvH_ET = prórroga humana → **5 min reales**.

`realMin` controla el cronómetro real. `displayMin` / `displayLabel`
controlan SOLO el label visible en la pantalla de PREVIA — están
desacoplados a petición del usuario.

### Fuente única

La velocidad del reloj (`tickMs`) SIEMPRE debe salir de
`window._mlResolveClock({ isHvH, etDone, home, away })` o su alias
`window._mlTickMs(st)`. El label visible SIEMPRE debe salir de
`window._mlRealDurationLabel({ isHvH, humanInvolved })`.

**PROHIBIDO**:
- Hardcodear `"16 min"`, `"10 min"`, `"8 min"` o cualquier duración.
- Cachear `tickMs` en variables de módulo al cargar (hay que leerlo en
  cada arranque del reloj porque el admin puede cambiar el override).
- Duplicar tablas `_MATCH_RULE` / `_MATCH_TICKS`.
- Añadir "campo mode" u otros atajos visuales que extiendan la duración
  real de IAIA por encima de 30 s.

### Override admin (`_ppDurationMin`)

- Solo aplica a partidos con humano (HvH / HvIA). No toca IAIA.
- Se aplica reescalando `tickMs = realMs / totalTicks`, manteniendo el
  mismo número de ticks totales (no rompe la progresión de eventos).
- El helper `_mlResolveClock` ya lo consume. Cualquier ruta nueva debe
  usar el helper, no leer `_MATCH_TICKS` directamente.
