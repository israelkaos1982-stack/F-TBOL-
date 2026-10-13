# Sistema de puntuación del Ranking (fórmula v2)

**Puntos = Puntos base (por puesto / ronda) × Multiplicador de la competición.**
Cada competición se redondea a entero (el .5 hacia arriba).

## Escala A — eliminatorias
Campeón 200 · Subcampeón 175 · Semifinales 150 / 125 · Cuartos 100 / 90 ·
Octavos 80 / 70 · Dieciseisavos o fase de grupos / primera ronda 60.
("mejor / 2.º": entre los eliminados de la ronda, la mitad con mejor
diferencia de goles cobra el primer valor.)

## Escala B — ligas
Puestos 1.º-17.º: 200, 175, 150, 125, 100, 90, 80, 75, 70, 65, 61, 57, 53, 49, 45, 41, 37.
Del 18.º en adelante baja de 2 en 2 desde 35: 35, 33, 31, 29, 27… (sea cual sea
el nº de equipos).

## Multiplicadores
| Competición | Mult. |
|---|---|
| Copa Mundial FIFA | ×5,0 (no implementada: sin competición en la app) |
| Eurocopa / Copa América (Nations Cup en la app) | ×4,0 |
| Champions League | ×3,0 |
| Mundial de Clubes / Mundialito | ×2,8 |
| Liga de 1.ª División (EA Sports, Ligue 1, Premier, Serie A) | ×2,5 |
| Copa Intercontinental | ×2,0 |
| Recopa de Europa | ×1,5 |
| Europa League | ×1,2 |
| Copa del Rey y copas nacionales | ×1,0 |
| Supercopa de Europa | ×0,8 |
| Conference League | ×0,7 |
| Supercopas nacionales | ×0,6 |
| **LaLiga Hypermotion (2.ª)** | **×0,5** (antes ×1,5: el campeón de 2.ª ganaba más que el 8.º de 1.ª) |
| 1ª REF (3.ª) | ×0,3 |
| 2ª REF (4.ª) | ×0,15 |
| Finalissima | ×0,5 (no implementada) |

Comparación: 8.º de Primera = 75 × 2,5 = 187,5 · campeón de Segunda = 200 × 0,5 = 100 ·
17.º de Primera = 37 × 2,5 = 92,5.

Sin puntos: Superliga, Torneos de Verano, promociones de ascenso/descenso.

Código: `js/renderizadores.js` (RANK_ESCALA_A, RANK_ESCALA_B, RANK_MULT_LIGA, RANK_MULT_COMP).
