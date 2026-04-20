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
