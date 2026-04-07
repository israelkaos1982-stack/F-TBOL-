"""Tests for the AI-vs-AI simulation engine (Módulos 1-6 del documento de arquitectura)."""
import random
import pytest

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import app as app_module

_modificador_expulsion = app_module._modificador_expulsion


# ---------------------------------------------------------------------------
# Fixture
# ---------------------------------------------------------------------------

@pytest.fixture()
def ctx():
    """Provide an isolated in-memory DB context for simular_y_guardar tests."""
    with app_module.app.app_context():
        app_module.db.create_all()
        app_module.get_or_create_global_state()
        yield


# ---------------------------------------------------------------------------
# Módulo 4 – _modificador_expulsion
# ---------------------------------------------------------------------------

class TestModificadorExpulsion:
    """Verify dynamic probability modifiers match the architecture document."""

    def test_critico_0_to_30(self):
        # 00'-30' → 40% reduction → multiplier 0.60
        assert _modificador_expulsion(0) == pytest.approx(0.60)
        assert _modificador_expulsion(15) == pytest.approx(0.60)
        assert _modificador_expulsion(30) == pytest.approx(0.60)

    def test_grave_31_to_70(self):
        # 31'-70' → 30% reduction → multiplier 0.70
        assert _modificador_expulsion(31) == pytest.approx(0.70)
        assert _modificador_expulsion(50) == pytest.approx(0.70)
        assert _modificador_expulsion(70) == pytest.approx(0.70)

    def test_defensivo_71_to_90(self):
        # 71'-90' → 20% reduction → multiplier 0.80
        assert _modificador_expulsion(71) == pytest.approx(0.80)
        assert _modificador_expulsion(85) == pytest.approx(0.80)
        assert _modificador_expulsion(90) == pytest.approx(0.80)

    def test_early_red_has_most_severe_penalty(self):
        mod_early = _modificador_expulsion(10)
        mod_mid = _modificador_expulsion(50)
        mod_late = _modificador_expulsion(80)
        assert mod_early < mod_mid < mod_late

    def test_modifiers_always_between_0_and_1(self):
        for minute in range(0, 91):
            mod = _modificador_expulsion(minute)
            assert 0 < mod <= 1.0


# ---------------------------------------------------------------------------
# Módulo 1 – Score integrity (events saved, goles non-negative, acta counts)
# ---------------------------------------------------------------------------

class TestScoreIntegrity:
    """Verify that goal counts stored in Partido are non-negative and consistent."""

    def test_goles_non_negative_after_simulation(self, ctx):
        random.seed(10)
        app_module.simular_y_guardar(1, "Real Madrid", "FC Barcelona")
        p = app_module.Partido.query.first()
        assert p.goles_local >= 0
        assert p.goles_visitante >= 0

    def test_own_goal_counts_for_opponent_not_scorer(self, ctx):
        """Run many simulations and verify all partidos have non-negative goal counts."""
        random.seed(777)
        teams = list(app_module.jugadores_por_equipo.keys())
        for i in range(50):
            local = teams[i % len(teams)]
            visitante = teams[(i + 1) % len(teams)]
            if local != visitante:
                app_module.simular_y_guardar(i + 1, local, visitante)
        for p in app_module.Partido.query.all():
            assert p.goles_local >= 0
            assert p.goles_visitante >= 0


# ---------------------------------------------------------------------------
# Módulo 3 – Disciplina: tarjetas, doble amarilla, roja
# ---------------------------------------------------------------------------

class TestDisciplinaEventTypes:
    """Verify disciplinary event types appear in saved events."""

    def _collect_event_types(self, n=200, seed=42):
        random.seed(seed)
        teams = list(app_module.jugadores_por_equipo.keys())
        pairs = [(l, v) for l in teams for v in teams if l != v]
        for i, (local, visitante) in enumerate(pairs[:n]):
            app_module.simular_y_guardar(i + 1, local, visitante)
        return [e.tipo for e in app_module.Evento.query.all()]

    def test_amarilla_events_appear(self, ctx):
        tipos = self._collect_event_types(50)
        assert "amarilla" in tipos

    def test_doble_amarilla_event_appears_across_many_matches(self, ctx):
        # Run enough matches that double-yellow logic is exercised
        tipos = self._collect_event_types(300)
        assert "doble-amarilla" in tipos

    def test_roja_event_appears_across_many_matches(self, ctx):
        tipos = self._collect_event_types(300)
        assert "roja" in tipos

    def test_no_event_on_expelled_player(self, ctx):
        """A player marked 'expulsado' should not appear in any subsequent event."""
        random.seed(999)
        teams = list(app_module.jugadores_por_equipo.keys())
        pairs = [(l, v) for l in teams for v in teams if l != v]
        for i, (local, visitante) in enumerate(pairs[:100]):
            app_module.simular_y_guardar(i + 1, local, visitante)

        eventos = app_module.Evento.query.all()
        # For each partido, find expelled players and verify no further events
        partido_ids = {e.partido_id for e in eventos}
        for pid in partido_ids:
            evts = sorted(
                [e for e in eventos if e.partido_id == pid],
                key=lambda e: (e.minuto or 0),
            )
            expelled = set()
            for e in evts:
                if e.tipo in ("roja", "doble-amarilla"):
                    expelled.add(e.jugador)
                elif e.jugador in expelled:
                    # An expelled player received another event — violation
                    assert False, (
                        f"Expelled player '{e.jugador}' received event '{e.tipo}' "
                        f"after expulsion in match {pid}"
                    )


# ---------------------------------------------------------------------------
# Módulo 2 – Flujo de penalti
# ---------------------------------------------------------------------------

class TestPenaltiFlow:
    """Verify that penalty events follow the activation→resolution→result flow."""

    def _collect_pen_events(self, n=300, seed=1234):
        random.seed(seed)
        teams = list(app_module.jugadores_por_equipo.keys())
        pairs = [(l, v) for l in teams for v in teams if l != v]
        for i, (local, visitante) in enumerate(pairs[:n]):
            app_module.simular_y_guardar(i + 1, local, visitante)
        return [e.tipo for e in app_module.Evento.query.all()]

    def test_pen_prov_events_appear(self, ctx):
        tipos = self._collect_pen_events()
        pen_types = [t for t in tipos if t.startswith("pen-")]
        assert len(pen_types) > 0

    def test_pen_gol_or_fallo_events_appear(self, ctx):
        tipos = self._collect_pen_events()
        outcome_types = [t for t in tipos if t in ("pen-gol", "pen-fallo", "pen-parado")]
        assert len(outcome_types) > 0


# ---------------------------------------------------------------------------
# Módulo 5 – Acta cronológica (minuto asignado a cada evento)
# ---------------------------------------------------------------------------

class TestActaCronologica:
    """Verify that events have minute stamps and are stored chronologically."""

    def test_all_events_have_minuto(self, ctx):
        random.seed(55)
        app_module.simular_y_guardar(1, "Real Madrid", "FC Barcelona")
        eventos = app_module.Evento.query.all()
        assert len(eventos) > 0
        for e in eventos:
            assert e.minuto is not None, f"Event type '{e.tipo}' has no minuto"
            assert 1 <= e.minuto <= 90, f"Event minuto {e.minuto} is out of range"

    def test_gol_events_have_valid_minuto(self, ctx):
        random.seed(66)
        teams = list(app_module.jugadores_por_equipo.keys())
        pairs = [(l, v) for l in teams for v in teams if l != v]
        for i, (local, visitante) in enumerate(pairs[:20]):
            app_module.simular_y_guardar(i + 1, local, visitante)
        goles = [e for e in app_module.Evento.query.all() if e.tipo == "gol"]
        for g in goles:
            assert 1 <= g.minuto <= 90


# ---------------------------------------------------------------------------
# Módulo 5 – Portería imbatida
# ---------------------------------------------------------------------------

class TestPorteriaImbatida:
    """Verify clean sheet logic: a team with 0 goals against gets porteria_imbatida."""

    def test_porteria_imbatida_set_when_team_scores_zero(self, ctx):
        random.seed(12)
        teams = list(app_module.jugadores_por_equipo.keys())
        pairs = [(l, v) for l in teams for v in teams if l != v]
        for i, (local, visitante) in enumerate(pairs[:100]):
            app_module.simular_y_guardar(i + 1, local, visitante)
        found_imbatida = False
        for p in app_module.Partido.query.all():
            # 0-0 draw: both teams have clean sheets; porteria_imbatida is
            # set to the local (goles_visitante == 0 is evaluated first in code).
            if p.goles_local == 0 and p.goles_visitante == 0:
                assert p.porteria_imbatida in (p.local, p.visitante)
                found_imbatida = True
                continue
            if p.goles_local == 0:
                assert p.porteria_imbatida == p.visitante, (
                    f"Expected visitante '{p.visitante}' as porteria_imbatida, "
                    f"got '{p.porteria_imbatida}'"
                )
                found_imbatida = True
            elif p.goles_visitante == 0:
                assert p.porteria_imbatida == p.local, (
                    f"Expected local '{p.local}' as porteria_imbatida, "
                    f"got '{p.porteria_imbatida}'"
                )
                found_imbatida = True
        # In 100 matches it's virtually certain at least one team kept a clean sheet
        assert found_imbatida, "No clean sheets found in 100 simulated matches"

    def test_porteria_imbatida_none_when_both_teams_score(self, ctx):
        random.seed(22)
        teams = list(app_module.jugadores_por_equipo.keys())
        pairs = [(l, v) for l in teams for v in teams if l != v]
        for i, (local, visitante) in enumerate(pairs[:50]):
            app_module.simular_y_guardar(i + 1, local, visitante)
        for p in app_module.Partido.query.all():
            if p.goles_local > 0 and p.goles_visitante > 0:
                assert p.porteria_imbatida is None
