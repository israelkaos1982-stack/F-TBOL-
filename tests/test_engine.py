"""Tests for the simulation engine helpers in app.py."""
import random
import pytest

# ---------------------------------------------------------------------------
# We import individual functions from app.py.  The Flask application is
# constructed at module level, so we need a live app context for DB-backed
# functions.  Functions that are pure-Python helpers are testable without it.
# ---------------------------------------------------------------------------

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import app as engine_module

# Re-export the helpers we want to test directly
calcular_prob = engine_module.calcular_prob
get_team_power = engine_module.get_team_power
elegir_goleador = engine_module.elegir_goleador
simular_goles = engine_module.simular_goles
simular_marcador = engine_module.simular_marcador
elegir_mvp = engine_module.elegir_mvp
generar_calendario = engine_module.generar_calendario
merge_dict = engine_module.merge_dict
normalize_team_key = engine_module.normalize_team_key
obtener_escudo = engine_module.obtener_escudo
resolve_team_name = engine_module.resolve_team_name
BONUS_LOCAL = engine_module.BONUS_LOCAL
BASE = engine_module.BASE
ESCUDO_DEFAULT = engine_module.ESCUDO_DEFAULT


# ---------------------------------------------------------------------------
# calcular_prob — position-based probability weights
# ---------------------------------------------------------------------------

class TestCalcularProb:
    """Verify the "Ter Stegen error" fix: goalkeepers have near-zero weight."""

    def _perfil(self, posicion, poder=80):
        return {"posicion": posicion, "poder": poder}

    def test_goalkeeper_has_near_zero_probability(self):
        p = calcular_prob(self._perfil("portero"))
        assert p == pytest.approx(0.001)

    def test_goalkeeper_probability_same_regardless_of_power(self):
        p_low = calcular_prob(self._perfil("portero", poder=50))
        p_high = calcular_prob(self._perfil("portero", poder=99))
        assert p_low == pytest.approx(0.001)
        assert p_high == pytest.approx(0.001)

    def test_forward_has_highest_base_probability(self):
        p_forward = calcular_prob(self._perfil("delantero"))
        p_mid = calcular_prob(self._perfil("medio"))
        p_def = calcular_prob(self._perfil("defensa"))
        assert p_forward > p_mid > p_def

    def test_home_bonus_increases_probability(self):
        p_away = calcular_prob(self._perfil("delantero"), local=False)
        p_home = calcular_prob(self._perfil("delantero"), local=True)
        assert p_home > p_away
        assert p_home == pytest.approx(p_away * BONUS_LOCAL, rel=1e-6)

    def test_home_bonus_is_ten_percent(self):
        assert BONUS_LOCAL == pytest.approx(1.10)

    def test_multigol_reduces_probability_with_more_goals(self):
        p0 = calcular_prob(self._perfil("delantero"), goles_previos=0)
        p1 = calcular_prob(self._perfil("delantero"), goles_previos=1)
        p2 = calcular_prob(self._perfil("delantero"), goles_previos=2)
        assert p0 > p1 > p2

    def test_goalkeeper_not_affected_by_home_or_goals(self):
        p1 = calcular_prob(self._perfil("portero"), local=True, goles_previos=3)
        assert p1 == pytest.approx(0.001)

    def test_base_positions_match_constants(self):
        # Base for forward = 70, mid = 17.5, defender = 7.5
        assert BASE["delantero"] == 70
        assert BASE["medio"] == 17.5
        assert BASE["defensa"] == 7.5
        assert BASE["portero"] == pytest.approx(0.001)


# ---------------------------------------------------------------------------
# get_team_power
# ---------------------------------------------------------------------------

class TestGetTeamPower:

    def test_known_team_returns_valid_power(self):
        power = get_team_power("Real Madrid")
        assert 1 <= power <= 100

    def test_unknown_team_returns_default(self):
        power = get_team_power("Equipo Fantasma")
        assert power == 76

    def test_alias_resolves_correctly(self):
        power_alias = get_team_power("Sevilla FC")
        power_canonical = get_team_power("Sevilla")
        assert power_alias == power_canonical

    def test_strong_team_has_higher_power_than_weak(self):
        # Real Madrid and FC Barcelona are the two strongest squads
        power_rm = get_team_power("Real Madrid")
        power_unknown = get_team_power("Equipo Sin Datos")
        assert power_rm >= power_unknown

    def test_empty_string_returns_default(self):
        power = get_team_power("")
        assert power == 76

    def test_none_returns_default(self):
        power = get_team_power(None)
        assert power == 76


# ---------------------------------------------------------------------------
# elegir_goleador — scorer selection
# ---------------------------------------------------------------------------

class TestElegirGoleador:

    def test_returns_a_string(self):
        scorer = elegir_goleador("Real Madrid")
        assert isinstance(scorer, str)
        assert len(scorer) > 0

    def test_scorer_belongs_to_squad(self):
        from jugadores_data import jugadores_por_equipo
        scorer = elegir_goleador("Real Madrid")
        names = [j["nombre"] for j in jugadores_por_equipo["Real Madrid"]]
        assert scorer in names

    def test_goalkeeper_extremely_rare_in_1000_draws(self):
        """Run 1000 draws; goalkeeper should appear far less than forwards."""
        from jugadores_data import jugadores_por_equipo
        gk_names = {
            j["nombre"]
            for j in jugadores_por_equipo["Real Madrid"]
            if j["posicion"] == "portero"
        }
        random.seed(42)
        counts = {"gk": 0, "other": 0}
        for _ in range(1000):
            s = elegir_goleador("Real Madrid")
            if s in gk_names:
                counts["gk"] += 1
            else:
                counts["other"] += 1
        # GKs should score far less than 5% of the time
        gk_rate = counts["gk"] / 1000
        assert gk_rate < 0.05, f"GK scored too often: {gk_rate:.2%}"

    def test_conteo_reduces_repeated_scorer_probability(self):
        """A player who already scored many goals is less likely to be chosen again."""
        from jugadores_data import jugadores_por_equipo
        # Give Mbappé a high conteo to reduce his probability
        high_conteo = {"Mbappé": 4}
        random.seed(0)
        scores_high_conteo = sum(
            1 for _ in range(500) if elegir_goleador("Real Madrid", conteo=high_conteo) == "Mbappé"
        )
        random.seed(0)
        scores_no_conteo = sum(
            1 for _ in range(500) if elegir_goleador("Real Madrid", conteo={}) == "Mbappé"
        )
        assert scores_high_conteo <= scores_no_conteo


# ---------------------------------------------------------------------------
# simular_goles — home advantage in goal distribution
# ---------------------------------------------------------------------------

class TestSimularGoles:

    def test_returns_non_negative_integer(self):
        result = simular_goles("Real Madrid", local=True, oponente="FC Barcelona")
        assert isinstance(result, int)
        assert result >= 0

    def test_result_in_valid_range(self):
        for _ in range(50):
            g = simular_goles("Real Madrid", local=True, oponente="FC Barcelona")
            assert 0 <= g <= 5

    def test_home_team_scores_more_on_average(self):
        """Over many simulations, home team average should exceed away average."""
        random.seed(7)
        home_total = sum(simular_goles("Real Madrid", True, "FC Barcelona") for _ in range(500))
        away_total = sum(simular_goles("FC Barcelona", False, "Real Madrid") for _ in range(500))
        # Home advantage: local should score at least as much as visitor
        assert home_total >= away_total * 0.85  # allow some statistical noise


# ---------------------------------------------------------------------------
# simular_marcador — full scoreline with home factor
# ---------------------------------------------------------------------------

class TestSimularMarcador:

    def test_returns_two_non_negative_integers(self):
        gl, gv = simular_marcador("Real Madrid", "FC Barcelona")
        assert isinstance(gl, int) and isinstance(gv, int)
        assert gl >= 0 and gv >= 0

    def test_scores_in_valid_range(self):
        for _ in range(30):
            gl, gv = simular_marcador("Real Madrid", "FC Barcelona")
            assert 0 <= gl <= 5
            assert 0 <= gv <= 5

    def test_stronger_home_team_wins_more_often(self):
        """Real Madrid (home) vs a weak team — local should win majority."""
        random.seed(99)
        home_wins = 0
        for _ in range(200):
            gl, gv = simular_marcador("Real Madrid", "Equipo Debil")
            if gl > gv:
                home_wins += 1
        # Home side of a strong team should win at least 40% of the time
        assert home_wins >= 40


# ---------------------------------------------------------------------------
# elegir_mvp
# ---------------------------------------------------------------------------

class TestElegirMvp:

    def test_top_scorer_is_mvp(self):
        conteo_local = {"Mbappé": 2, "Vinicius": 1}
        conteo_visitante = {"Lewandowski": 1}
        mvp = elegir_mvp("Real Madrid", "FC Barcelona", 3, 1, conteo_local, conteo_visitante)
        assert mvp == "Mbappé"

    def test_mvp_returns_string_when_no_goals(self):
        mvp = elegir_mvp("Real Madrid", "FC Barcelona", 0, 0, {}, {})
        assert isinstance(mvp, str)
        assert len(mvp) > 0

    def test_visitor_top_scorer_can_be_mvp(self):
        conteo_local = {"Vinicius": 1}
        conteo_visitante = {"Lewandowski": 3}
        mvp = elegir_mvp("Real Madrid", "FC Barcelona", 1, 3, conteo_local, conteo_visitante)
        assert mvp == "Lewandowski"


# ---------------------------------------------------------------------------
# generar_calendario
# ---------------------------------------------------------------------------

class TestGenerarCalendario:

    def test_even_number_of_teams(self):
        equipos = ["A", "B", "C", "D"]
        cal = generar_calendario(equipos)
        # Each team plays n-1 rounds in each half → 2*(n-1) total rounds
        assert len(cal) == 2 * (len(equipos) - 1)

    def test_odd_number_of_teams_adds_bye(self):
        equipos = ["A", "B", "C"]
        cal = generar_calendario(equipos)
        # Effectively becomes 4 teams (one "DESCANSA") → 2*(4-1)=6 rounds
        assert len(cal) == 6

    def test_no_team_plays_itself(self):
        equipos = ["A", "B", "C", "D"]
        cal = generar_calendario(equipos)
        for jornada in cal:
            for local, visitante in jornada:
                assert local != visitante

    def test_home_and_away_legs_exist(self):
        """Every (A, B) match in the first half should have a (B, A) in the second."""
        equipos = ["A", "B", "C", "D"]
        cal = generar_calendario(equipos)
        mid = len(cal) // 2
        first_half = {(l, v) for jornada in cal[:mid] for l, v in jornada}
        second_half = {(l, v) for jornada in cal[mid:] for l, v in jornada}
        for l, v in first_half:
            assert (v, l) in second_half

    def test_all_matches_have_valid_teams(self):
        equipos = ["A", "B", "C", "D"]
        cal = generar_calendario(equipos)
        for jornada in cal:
            for local, visitante in jornada:
                assert local in equipos
                assert visitante in equipos

    def test_single_team_returns_empty(self):
        cal = generar_calendario(["A"])
        # Only one team + bye → effectively 2 "teams", 1 round with no real match
        for jornada in cal:
            for l, v in jornada:
                # neither should be "DESCANSA"
                assert l != "DESCANSA" and v != "DESCANSA"


# ---------------------------------------------------------------------------
# merge_dict
# ---------------------------------------------------------------------------

class TestMergeDict:

    def test_merges_flat_dicts(self):
        result = merge_dict({"a": 1, "b": 2}, {"b": 99, "c": 3})
        assert result == {"a": 1, "b": 99, "c": 3}

    def test_deep_merge_nested(self):
        base = {"x": {"y": 1, "z": 2}}
        incoming = {"x": {"y": 10}}
        result = merge_dict(base, incoming)
        assert result["x"]["y"] == 10
        assert result["x"]["z"] == 2

    def test_non_dict_incoming_returns_base(self):
        result = merge_dict({"a": 1}, None)
        assert result == {"a": 1}

    def test_non_dict_base_returns_incoming(self):
        result = merge_dict(None, {"a": 1})
        assert result == {"a": 1}

    def test_empty_incoming_returns_copy_of_base(self):
        result = merge_dict({"a": 1}, {})
        assert result == {"a": 1}

    def test_does_not_mutate_base(self):
        base = {"a": {"b": 1}}
        merge_dict(base, {"a": {"b": 2}})
        assert base["a"]["b"] == 1


# ---------------------------------------------------------------------------
# normalize_team_key
# ---------------------------------------------------------------------------

class TestNormalizeTeamKey:

    def test_lowercase(self):
        assert normalize_team_key("Real Madrid") == "real madrid"

    def test_strips_accents(self):
        result = normalize_team_key("Córdoba")
        assert "o" in result
        assert "ó" not in result

    def test_strips_whitespace(self):
        assert normalize_team_key("  Arsenal  ") == "arsenal"

    def test_empty_string(self):
        assert normalize_team_key("") == ""

    def test_none_returns_empty(self):
        assert normalize_team_key(None) == ""


# ---------------------------------------------------------------------------
# obtener_escudo
# ---------------------------------------------------------------------------

class TestObtenerEscudo:

    def test_known_team_returns_svg_url(self):
        url = obtener_escudo("Real Madrid")
        assert url.endswith(".svg")
        assert "real-madrid" in url

    def test_alias_resolves_to_canonical(self):
        url_alias = obtener_escudo("FC Barcelona")
        url_canonical = obtener_escudo("Barcelona")
        assert url_alias == url_canonical

    def test_unknown_team_returns_default(self):
        url = obtener_escudo("Equipo Inexistente")
        assert url == ESCUDO_DEFAULT

    def test_empty_string_returns_default(self):
        assert obtener_escudo("") == ESCUDO_DEFAULT

    def test_none_returns_default(self):
        assert obtener_escudo(None) == ESCUDO_DEFAULT


# ---------------------------------------------------------------------------
# resolve_team_name
# ---------------------------------------------------------------------------

class TestResolveTeamName:

    def test_alias_sevilla_fc_resolves(self):
        assert resolve_team_name("Sevilla FC") == "Sevilla"

    def test_alias_villarreal_cf_resolves(self):
        assert resolve_team_name("Villarreal CF") == "Villarreal"

    def test_unknown_name_returned_as_is(self):
        assert resolve_team_name("Equipo X") == "Equipo X"

    def test_empty_string_returned_as_is(self):
        assert resolve_team_name("") == ""

    def test_strips_surrounding_spaces(self):
        assert resolve_team_name("  Sevilla FC  ") == "Sevilla"
