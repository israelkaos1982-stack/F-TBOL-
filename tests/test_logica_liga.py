"""Tests for logica_liga.py — table calculation and IA results filtering."""
import types
import pytest

from logica_liga import calcular_tabla, obtener_resultados_ia


# ---------------------------------------------------------------------------
# Helpers — lightweight fake Partido objects
# ---------------------------------------------------------------------------

def _partido(local, visitante, goles_local, goles_visitante, jornada=1):
    p = types.SimpleNamespace(
        local=local,
        visitante=visitante,
        goles_local=goles_local,
        goles_visitante=goles_visitante,
        jornada=jornada,
    )
    return p


# ---------------------------------------------------------------------------
# calcular_tabla
# ---------------------------------------------------------------------------

class TestCalcularTabla:

    def test_empty_lista_equipos_returns_empty(self):
        result = calcular_tabla([], [_partido("A", "B", 1, 0)])
        assert result == []

    def test_empty_partidos_all_zeros(self):
        result = calcular_tabla(["A", "B", "C"], [])
        for row in result:
            assert row["pj"] == 0
            assert row["pts"] == 0
            assert row["gf"] == 0
            assert row["gc"] == 0

    def test_win_gives_three_points_to_winner(self):
        partidos = [_partido("A", "B", 3, 1)]
        tabla = calcular_tabla(["A", "B"], partidos)
        by_name = {r["nombre"]: r for r in tabla}
        assert by_name["A"]["pts"] == 3
        assert by_name["B"]["pts"] == 0

    def test_loss_gives_zero_points_to_loser(self):
        partidos = [_partido("A", "B", 0, 2)]
        tabla = calcular_tabla(["A", "B"], partidos)
        by_name = {r["nombre"]: r for r in tabla}
        assert by_name["A"]["pts"] == 0
        assert by_name["B"]["pts"] == 3

    def test_draw_gives_one_point_each(self):
        partidos = [_partido("A", "B", 1, 1)]
        tabla = calcular_tabla(["A", "B"], partidos)
        by_name = {r["nombre"]: r for r in tabla}
        assert by_name["A"]["pts"] == 1
        assert by_name["B"]["pts"] == 1

    def test_goals_for_and_against_recorded_correctly(self):
        partidos = [_partido("A", "B", 3, 1)]
        tabla = calcular_tabla(["A", "B"], partidos)
        by_name = {r["nombre"]: r for r in tabla}
        assert by_name["A"]["gf"] == 3
        assert by_name["A"]["gc"] == 1
        assert by_name["B"]["gf"] == 1
        assert by_name["B"]["gc"] == 3

    def test_goal_difference_calculated(self):
        partidos = [_partido("A", "B", 4, 1)]
        tabla = calcular_tabla(["A", "B"], partidos)
        by_name = {r["nombre"]: r for r in tabla}
        assert by_name["A"]["dg"] == 3
        assert by_name["B"]["dg"] == -3

    def test_matches_played_incremented(self):
        partidos = [
            _partido("A", "B", 1, 0),
            _partido("A", "C", 0, 0),
        ]
        tabla = calcular_tabla(["A", "B", "C"], partidos)
        by_name = {r["nombre"]: r for r in tabla}
        assert by_name["A"]["pj"] == 2
        assert by_name["B"]["pj"] == 1
        assert by_name["C"]["pj"] == 1

    def test_wins_draws_losses_counters(self):
        partidos = [
            _partido("A", "B", 2, 0),  # A wins
            _partido("A", "C", 1, 1),  # draw
            _partido("B", "C", 0, 1),  # C wins
        ]
        tabla = calcular_tabla(["A", "B", "C"], partidos)
        by_name = {r["nombre"]: r for r in tabla}
        assert by_name["A"]["pg"] == 1
        assert by_name["A"]["pe"] == 1
        assert by_name["A"]["pp"] == 0
        assert by_name["C"]["pg"] == 1
        assert by_name["C"]["pe"] == 1
        assert by_name["C"]["pp"] == 0
        assert by_name["B"]["pg"] == 0
        assert by_name["B"]["pp"] == 2

    def test_sorted_by_points_desc(self):
        partidos = [
            _partido("A", "B", 1, 0),
            _partido("C", "D", 2, 0),
        ]
        tabla = calcular_tabla(["A", "B", "C", "D"], partidos)
        pts = [r["pts"] for r in tabla]
        assert pts == sorted(pts, reverse=True)

    def test_tiebreak_by_goal_difference(self):
        partidos = [
            _partido("A", "B", 3, 0),  # A: +3 GD, 3 pts
            _partido("C", "D", 1, 0),  # C: +1 GD, 3 pts
        ]
        tabla = calcular_tabla(["A", "B", "C", "D"], partidos)
        top_two = [r["nombre"] for r in tabla[:2]]
        assert top_two[0] == "A"
        assert top_two[1] == "C"

    def test_partido_with_unknown_team_ignored(self):
        partidos = [_partido("X", "Y", 2, 1)]
        tabla = calcular_tabla(["A", "B"], partidos)
        by_name = {r["nombre"]: r for r in tabla}
        assert by_name["A"]["pj"] == 0
        assert by_name["B"]["pj"] == 0

    def test_partido_where_one_team_unknown_ignored(self):
        partidos = [_partido("A", "UNKNOWN", 2, 0)]
        tabla = calcular_tabla(["A", "B"], partidos)
        by_name = {r["nombre"]: r for r in tabla}
        assert by_name["A"]["pj"] == 0

    def test_multiple_jornadas_accumulate(self):
        partidos = [
            _partido("A", "B", 2, 1, jornada=1),
            _partido("B", "A", 0, 1, jornada=2),
        ]
        tabla = calcular_tabla(["A", "B"], partidos)
        by_name = {r["nombre"]: r for r in tabla}
        assert by_name["A"]["pts"] == 6
        assert by_name["A"]["pj"] == 2


# ---------------------------------------------------------------------------
# obtener_resultados_ia
# ---------------------------------------------------------------------------

class TestObtenerResultadosIA:

    def test_returns_empty_when_no_partidos(self):
        result = obtener_resultados_ia([], ["A", "B"], [])
        assert result == {}

    def test_includes_ia_vs_ia_partidos(self):
        partidos = [_partido("A", "B", 1, 0, jornada=1)]
        result = obtener_resultados_ia(partidos, ["A", "B"], [])
        assert 1 in result
        assert len(result[1]) == 1

    def test_excludes_human_team_partidos(self):
        partidos = [_partido("A", "B", 1, 0, jornada=1)]
        result = obtener_resultados_ia(partidos, ["A", "B"], ["A"])
        assert result == {}

    def test_excludes_team_not_in_primera(self):
        partidos = [_partido("A", "X", 1, 0, jornada=1)]
        result = obtener_resultados_ia(partidos, ["A", "B"], [])
        assert result == {}

    def test_groups_by_jornada(self):
        partidos = [
            _partido("A", "B", 1, 0, jornada=1),
            _partido("A", "B", 2, 1, jornada=2),
        ]
        result = obtener_resultados_ia(partidos, ["A", "B"], [])
        assert sorted(result.keys()) == [1, 2]

    def test_multiple_matches_same_jornada(self):
        partidos = [
            _partido("A", "B", 1, 0, jornada=1),
            _partido("C", "D", 2, 2, jornada=1),
        ]
        result = obtener_resultados_ia(partidos, ["A", "B", "C", "D"], [])
        assert len(result[1]) == 2
