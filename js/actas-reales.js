/* ============================================================
   ACTAS REALES — fuente de verdad de las estadísticas por jugador
   ============================================================
   Petición usuario 2026-10-03 (Atlético Madrid, "Estos son todos los
   partidos del Atlético Madrid tanto de copa como de liga / Automatiza las
   estadísticas jugador a jugador tanto en plantilla como en las
   estadísticas de los 15 máximos Pichichis, MVP, Amarillas, Rojas y Zamora
   tanto en copa como en Liga / Investiga al 100% y hazlo porque sigue
   estando todo mal").

   Las estadísticas de ese club arrastraban, temporada tras temporada,
   3 correcciones MANUALES congeladas que se pisaban entre sí (📌 de la
   Plantilla, 🧮 base de temporada, y las líneas pegadas a mano en los
   rankings de Hypermotion/Copa) más resúmenes de partido guardados
   incompletos en algunos dispositivos — cada parche se calculaba contra
   un estado distinto y ninguno se actualizaba solo. El usuario ha
   transcrito, partido a partido, el acta REAL de los 26 partidos ya
   jugados (20 de Hypermotion + 6 de Copa del Rey). Esa lista es AHORA la
   única fuente para esos 26 partidos — ver
   js/renderizadores.js::_partidosParaStats, que la aplica SOLO a los
   cálculos de estadísticas (Plantilla, Pichichi/MVP/Amarillas/Rojas/Zamora
   de Liga y de Copa), nunca al calendario ni a la clasificación.

   - `corte`: ms. Cualquier partido de Liga/Copa de este club guardado en
     el dispositivo ANTES de este instante que NO sea uno de los de esta
     lista se descarta de las estadísticas (copia vieja/duplicada — el
     usuario confirmó que la lista está completa). Todo partido jugado
     DESPUÉS suma solo, automáticamente, como siempre.
   - `comp`: "liga" = la liga del club (se resuelve a su división real,
     hoy Hypermotion) · "copa" = Copa del Rey.
   - `local`: true si el club jugó en casa (identifica el partido junto
     con el rival — ningún rival se repite en el mismo campo y competición).
   - `atl` / `riv`: [nombre, goles, mvp, amarillas, rojas] por jugador.
   ============================================================ */
(function () {
  "use strict";

  window.ACTAS_REALES = {
    "atletico-madrid": {
      corte: 1791016596000, // 2026-10-03 08:36 UTC
      divisionLiga: "hypermotion",
      partidos: [
        { comp: "liga", rival: "Leganés", local: true, gf: 3, gc: 4,
          atl: [["Kang-In Lee", 1, 0, 0, 0], ["Álex Baena", 1, 0, 0, 0], ["Dávid Hancko", 0, 0, 1, 0],
                ["J. David", 1, 0, 0, 0], ["R. Le Normand", 0, 0, 1, 1], ["Cristian Romero", 0, 0, 1, 0]],
          riv: [["Z. Buurmeester", 2, 0, 0, 0], ["Miguel Atienza", 2, 0, 0, 0], ["Y. Kechta", 0, 1, 0, 0]] },
        { comp: "liga", rival: "Castellón", local: true, gf: 1, gc: 1,
          atl: [["A. Sørloth", 1, 0, 0, 0]],
          riv: [["Fer Cuadrado", 1, 1, 0, 0]] },
        { comp: "liga", rival: "Las Palmas", local: false, gf: 4, gc: 2,
          atl: [["A. Sørloth", 2, 1, 0, 0], ["Pablo Barrios", 1, 0, 0, 0], ["Dávid Hancko", 0, 0, 1, 0], ["J. David", 1, 0, 0, 0]],
          riv: [["Jefte", 1, 0, 0, 0], ["T. Miyashiro", 1, 0, 0, 0]] },
        { comp: "copa", rival: "Unionistas", local: false, gf: 3, gc: 2,
          atl: [["M. Llorente", 0, 0, 1, 1], ["Álex Baena", 2, 1, 0, 0], ["A. Lookman", 1, 0, 0, 0]],
          riv: [["Luis Alcalde", 2, 0, 0, 0]] },
        { comp: "liga", rival: "Levante", local: true, gf: 1, gc: 2,
          atl: [["Koke", 0, 0, 1, 0], ["A. Sørloth", 1, 0, 0, 0], ["A. Grimaldo", 0, 0, 1, 0], ["Giuliano", 0, 0, 1, 0]],
          riv: [["E. Bardeli", 1, 0, 0, 0], ["Thiago Fernández", 1, 1, 0, 0]] },
        { comp: "liga", rival: "Almería", local: true, gf: 2, gc: 3,
          atl: [["M. Llorente", 1, 0, 0, 0], ["Álex Baena", 1, 0, 0, 0]],
          riv: [["Adrià Bosch", 1, 0, 0, 0], ["Sergi Camps", 2, 1, 0, 0]] },
        { comp: "copa", rival: "Racing", local: false, gf: 3, gc: 2,
          atl: [["A. Sørloth", 1, 0, 1, 0], ["M. Hjulmand", 0, 0, 1, 0], ["J. David", 2, 1, 0, 0],
                ["M. Llorente", 0, 0, 1, 0], ["R. Le Normand", 0, 0, 1, 0]],
          riv: [["Sergio Canales", 1, 0, 0, 0], ["Iván Martín", 1, 0, 0, 0]] },
        { comp: "liga", rival: "Valladolid", local: false, gf: 2, gc: 0,
          atl: [["Johnny Cardoso", 1, 0, 0, 0], ["M. Llorente", 0, 0, 0, 1], ["A. Sørloth", 1, 1, 0, 0]],
          riv: [] },
        { comp: "liga", rival: "Eibar", local: true, gf: 3, gc: 1,
          atl: [["M. Llorente", 1, 1, 0, 0], ["J. David", 1, 0, 0, 0], ["A. Lookman", 1, 0, 0, 0], ["R. Le Normand", 0, 0, 1, 0]],
          riv: [["Mario Casas", 0, 0, 0, 1], ["Hugo Prieto", 1, 0, 0, 0]] },
        { comp: "copa", rival: "Unionistas", local: true, gf: 1, gc: 0,
          atl: [["Koke", 1, 1, 0, 0]],
          riv: [] },
        { comp: "liga", rival: "Pontevedra", local: true, gf: 3, gc: 0,
          atl: [["Álex Baena", 1, 1, 0, 0], ["Giuliano", 1, 0, 0, 0], ["Dávid Hancko", 0, 0, 1, 0], ["J. David", 1, 0, 0, 0]],
          riv: [] },
        { comp: "liga", rival: "Córdoba", local: true, gf: 3, gc: 2,
          atl: [["J. David", 1, 0, 0, 0], ["A. Sørloth", 2, 1, 0, 0], ["Dávid Hancko", 0, 0, 1, 0], ["A. Grimaldo", 0, 0, 1, 0]],
          riv: [["Yussi Diarra", 1, 0, 0, 0], ["Eder García", 1, 0, 0, 0]] },
        { comp: "copa", rival: "Racing", local: true, gf: 0, gc: 1,
          atl: [],
          riv: [["Yassir Zabiri", 1, 0, 0, 0], ["Sergio Canales", 0, 1, 0, 0]] },
        { comp: "liga", rival: "Levante", local: false, gf: 2, gc: 1,
          atl: [["Julián Álvarez", 1, 0, 0, 0], ["Koke", 1, 1, 0, 0], ["Johnny Cardoso", 0, 0, 1, 0],
                ["Cristian Romero", 0, 0, 1, 0], ["M. Llorente", 0, 0, 0, 1]],
          riv: [["Thiago Fernández", 1, 0, 0, 0]] },
        { comp: "liga", rival: "Castellón", local: false, gf: 0, gc: 1,
          atl: [["Cristian Romero", 0, 0, 1, 1]],
          riv: [["Fer Cuadrado", 1, 0, 0, 0], ["Cristian Nova", 0, 1, 0, 0]] },
        { comp: "liga", rival: "Barakaldo", local: true, gf: 4, gc: 3,
          atl: [["A. Lookman", 1, 0, 0, 0], ["Koke", 1, 1, 0, 0], ["Marc Pubill", 0, 0, 0, 1],
                ["Kang-In Lee", 1, 0, 0, 0], ["Obed Vargas", 1, 0, 0, 0]],
          riv: [["Álvaro Peña", 1, 0, 0, 0], ["Unai Naveira", 1, 0, 0, 0], ["Xavier Sola", 0, 0, 0, 1]] },
        { comp: "liga", rival: "Almería", local: false, gf: 0, gc: 2,
          atl: [["Pablo Barrios", 0, 0, 1, 0], ["Dávid Hancko", 0, 0, 1, 0]],
          riv: [["Adrià Bosch", 1, 0, 0, 0], ["Sergi Camps", 1, 1, 0, 0]] },
        { comp: "liga", rival: "Cádiz", local: false, gf: 2, gc: 0,
          atl: [["Julián Álvarez", 1, 1, 0, 0], ["Álex Baena", 0, 0, 1, 0], ["Giuliano", 1, 0, 0, 0]],
          riv: [] },
        { comp: "liga", rival: "Málaga", local: true, gf: 1, gc: 1,
          atl: [["Marc Pubill", 0, 0, 1, 0], ["Álex Baena", 1, 1, 0, 0], ["Dávid Hancko", 0, 0, 1, 0]],
          riv: [["Juan Cruz", 1, 0, 0, 0]] },
        { comp: "liga", rival: "Zaragoza", local: false, gf: 2, gc: 1,
          atl: [["A. Sørloth", 1, 0, 0, 0], ["A. Lookman", 1, 1, 0, 0]],
          riv: [["Edu Espiau", 1, 0, 0, 0]] },
        { comp: "liga", rival: "Elche", local: false, gf: 0, gc: 1,
          atl: [["Johnny Cardoso", 0, 0, 1, 0]],
          riv: [["F. Redondo", 1, 0, 0, 0], ["Ali Houary", 0, 1, 0, 0]] },
        { comp: "liga", rival: "Sporting", local: true, gf: 4, gc: 2,
          atl: [["M. Llorente", 1, 0, 0, 0], ["A. Sørloth", 1, 1, 0, 0], ["Cristian Romero", 0, 0, 1, 0],
                ["A. Lookman", 1, 0, 0, 0], ["Álex Baena", 1, 0, 0, 0]],
          riv: [["Juan Otero", 2, 0, 0, 0]] },
        { comp: "copa", rival: "Mallorca", local: true, gf: 2, gc: 0,
          atl: [["A. Lookman", 1, 1, 0, 0], ["Julián Álvarez", 1, 0, 0, 0], ["Álex Baena", 0, 0, 1, 0]],
          riv: [] },
        { comp: "copa", rival: "Mallorca", local: false, gf: 3, gc: 0,
          atl: [["A. Sørloth", 1, 0, 0, 1], ["Kang-In Lee", 1, 1, 0, 0], ["A. Grimaldo", 0, 0, 1, 0], ["M. Llorente", 1, 0, 0, 0]],
          riv: [] },
        { comp: "liga", rival: "Elche", local: true, gf: 5, gc: 0,
          atl: [["A. Sørloth", 1, 0, 0, 0], ["Koke", 1, 0, 0, 0], ["Dávid Hancko", 0, 0, 1, 0],
                ["Julián Álvarez", 2, 1, 0, 0], ["Kang-In Lee", 1, 0, 0, 0]],
          riv: [] },
        { comp: "liga", rival: "Leganés", local: false, gf: 4, gc: 3,
          atl: [["Kang-In Lee", 1, 1, 0, 0], ["A. Sørloth", 0, 0, 1, 0], ["Álex Baena", 1, 0, 0, 0],
                ["Giuliano", 1, 0, 0, 0], ["Julián Álvarez", 1, 0, 0, 0], ["Cristian Romero", 0, 0, 1, 0]],
          riv: [["Álvaro Morata", 2, 0, 0, 0], ["Z. Buurmeester", 1, 0, 0, 0]] }
      ]
    }
  };
})();
