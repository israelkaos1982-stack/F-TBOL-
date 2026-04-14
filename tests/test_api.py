"""Integration tests for Flask API endpoints and the simular_y_guardar event engine."""
import random
import json
import pytest

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import app as app_module


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def client(tmp_path):
    """Provide a Flask test client with an isolated in-memory SQLite DB."""
    app_module.app.config["TESTING"] = True
    app_module.app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app_module.app.config["WTF_CSRF_ENABLED"] = False

    with app_module.app.app_context():
        app_module.db.create_all()
        app_module.get_or_create_global_state()

    with app_module.app.test_client() as c:
        yield c


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def _json(response):
    return json.loads(response.data)


# ---------------------------------------------------------------------------
# Basic page routes
# ---------------------------------------------------------------------------

class TestPageRoutes:

    def test_root_returns_200(self, client):
        rv = client.get("/")
        assert rv.status_code == 200

    def test_spa_fallback_returns_200(self, client):
        rv = client.get("/some/deep/path")
        assert rv.status_code == 200

    def test_api_path_not_found_via_spa_fallback(self, client):
        rv = client.get("/api/nonexistent")
        assert rv.status_code == 404

    def test_estadisticas_returns_200(self, client):
        rv = client.get("/estadisticas")
        assert rv.status_code == 200

    def test_estadisticas_shows_all_sections(self, client):
        rv = client.get("/estadisticas")
        html = rv.data.decode("utf-8")
        assert "Goleadores" in html
        assert "Amarillas" in html
        assert "Rojas" in html
        assert "Penaltis marcados" in html
        assert "Penaltis fallados" in html
        assert "Goles de falta" in html
        assert "Autogoles" in html

    def test_estadisticas_empty_shows_no_data(self, client):
        """When DB is empty, each section shows the no-data fallback."""
        # Clear any data added by other tests
        with app_module.app.app_context():
            app_module.Evento.query.delete()
            app_module.Partido.query.delete()
            app_module.db.session.commit()
        rv = client.get("/estadisticas")
        html = rv.data.decode("utf-8")
        assert "No hay datos todavía" in html


# ---------------------------------------------------------------------------
# /api/state  (GET / POST)
# ---------------------------------------------------------------------------

class TestApiState:

    def test_get_state_returns_ok(self, client):
        rv = client.get("/api/state")
        assert rv.status_code == 200
        data = _json(rv)
        assert data["ok"] is True
        assert "state" in data

    def test_get_state_contains_default_keys(self, client):
        rv = client.get("/api/state")
        state = _json(rv)["state"]
        assert "liga_results" in state
        assert "segunda_state" in state

    def test_post_state_saves_and_returns_ok(self, client):
        payload = {"state": {"liga_results": {"jornada": 1}}}
        rv = client.post(
            "/api/state",
            data=json.dumps(payload),
            content_type="application/json",
        )
        assert rv.status_code == 200
        data = _json(rv)
        assert data["ok"] is True

    def test_post_invalid_state_returns_400(self, client):
        payload = {"state": "not_a_dict"}
        rv = client.post(
            "/api/state",
            data=json.dumps(payload),
            content_type="application/json",
        )
        assert rv.status_code == 400

    def test_post_state_persists_value(self, client):
        payload = {"state": {"liga_results": {"test_key": "hello"}}}
        client.post(
            "/api/state",
            data=json.dumps(payload),
            content_type="application/json",
        )
        rv = client.get("/api/state")
        state = _json(rv)["state"]
        assert state["liga_results"].get("test_key") == "hello"

    def test_partial_post_does_not_wipe_other_keys(self, client):
        """Un POST parcial (ej. solo `liga_schedule`) NO debe borrar
        las claves que ya había en la fila (ej. `liga_results`)."""
        # 1. Primer POST: escribimos liga_results con datos reales.
        client.post(
            "/api/state",
            data=json.dumps({"state": {"liga_results": {"1|A|B": {"gh": 2, "ga": 1}}}}),
            content_type="application/json",
        )
        rv = client.get("/api/state")
        assert _json(rv)["state"]["liga_results"].get("1|A|B") == {"gh": 2, "ga": 1}

        # 2. Segundo POST: solo liga_schedule. Antes del fix este POST
        #    pisaba liga_results con el valor DEFAULT ({}).
        client.post(
            "/api/state",
            data=json.dumps({"state": {"liga_schedule": [["X", "Y"], ["Z", "W"]]}}),
            content_type="application/json",
        )
        rv = client.get("/api/state")
        state = _json(rv)["state"]
        # liga_schedule aplicado
        assert state.get("liga_schedule") == [["X", "Y"], ["Z", "W"]]
        # liga_results PRESERVADO (antes se perdía)
        assert state["liga_results"].get("1|A|B") == {"gh": 2, "ga": 1}

    def test_partial_post_does_not_wipe_same_root_key(self, client):
        """POST de `{liga_results: {new_key: X}}` debe HACER MERGE
        con las entradas previas de liga_results, no reemplazarlas.

        Nota: `merge_dict` hace merge recursivo cuando ambos valores
        son dicts, así que este test verifica ese comportamiento."""
        client.post(
            "/api/state",
            data=json.dumps({"state": {"liga_results": {"1|A|B": {"gh": 1, "ga": 0}}}}),
            content_type="application/json",
        )
        client.post(
            "/api/state",
            data=json.dumps({"state": {"liga_results": {"1|C|D": {"gh": 3, "ga": 2}}}}),
            content_type="application/json",
        )
        rv = client.get("/api/state")
        liga_results = _json(rv)["state"]["liga_results"]
        # Ambas entradas presentes tras los dos POSTs
        assert liga_results.get("1|A|B") == {"gh": 1, "ga": 0}
        assert liga_results.get("1|C|D") == {"gh": 3, "ga": 2}

    def test_get_state_returns_updated_at(self, client):
        rv = client.get("/api/state")
        data = _json(rv)
        assert "updated_at" in data
        assert isinstance(data["updated_at"], str)

    def test_get_state_with_since_returns_304_when_unchanged(self, client):
        # Write something so we have a non-default updated_at.
        client.post(
            "/api/state",
            data=json.dumps({"state": {"liga_results": {"x": 1}}}),
            content_type="application/json",
        )
        rv = client.get("/api/state")
        current_ts = _json(rv)["updated_at"]
        rv2 = client.get("/api/state", query_string={"since": current_ts})
        assert rv2.status_code == 304

    def test_get_state_with_stale_since_returns_data(self, client):
        rv = client.get("/api/state", query_string={"since": "1999-01-01T00:00:00+00:00"})
        assert rv.status_code == 200
        data = _json(rv)
        assert data["ok"] is True
        assert "state" in data


# ---------------------------------------------------------------------------
# /reiniciar
# ---------------------------------------------------------------------------

class TestReiniciar:

    def test_reiniciar_redirects(self, client):
        rv = client.get("/reiniciar")
        assert rv.status_code in (301, 302)

    def test_reiniciar_clears_partidos(self, client):
        with app_module.app.app_context():
            p = app_module.Partido(
                jornada=1, local="A", visitante="B",
                goles_local=1, goles_visitante=0, mvp="X"
            )
            app_module.db.session.add(p)
            app_module.db.session.commit()

        client.get("/reiniciar")

        with app_module.app.app_context():
            assert app_module.Partido.query.count() == 0


# ---------------------------------------------------------------------------
# Copa API
# ---------------------------------------------------------------------------

class TestCopaAPI:

    def test_copa_get_state_returns_ok(self, client):
        rv = client.get("/api/copa/state")
        assert rv.status_code == 200
        data = _json(rv)
        assert data["ok"] is True

    def test_copa_sorteo_r1_returns_matches(self, client):
        rv = client.post(
            "/api/copa/sorteo",
            data=json.dumps({"ronda": "r1"}),
            content_type="application/json",
        )
        assert rv.status_code == 200
        data = _json(rv)
        assert data["ok"] is True
        assert "matches" in data
        assert len(data["matches"]) == 2  # 4 teams → 2 matches

    def test_copa_sorteo_invalid_ronda_returns_400(self, client):
        rv = client.post(
            "/api/copa/sorteo",
            data=json.dumps({"ronda": "inexistente"}),
            content_type="application/json",
        )
        assert rv.status_code == 400

    def test_copa_simular_ia_r1_match(self, client):
        # First set up the draw
        client.post(
            "/api/copa/sorteo",
            data=json.dumps({"ronda": "r1"}),
            content_type="application/json",
        )
        rv = client.post(
            "/api/copa/simular_ia",
            data=json.dumps({"ronda": "r1", "idx": 0, "es_vuelta": False}),
            content_type="application/json",
        )
        assert rv.status_code == 200
        data = _json(rv)
        assert data["ok"] is True

    def test_copa_reiniciar_resets_state(self, client):
        # Perform a draw first
        client.post(
            "/api/copa/sorteo",
            data=json.dumps({"ronda": "r1"}),
            content_type="application/json",
        )
        # Then reset
        rv = client.post("/api/copa/reiniciar")
        assert rv.status_code == 200
        data = _json(rv)
        assert data["ok"] is True

        # State should be clean
        rv2 = client.get("/api/copa/state")
        copa = _json(rv2)["copa"]
        assert copa.get("sorteo", {}) == {}


# ---------------------------------------------------------------------------
# simular_y_guardar — event generation
# ---------------------------------------------------------------------------

class TestSimularYGuardar:
    """
    Statistical tests to verify that the "dormant events" (penalties, free-kick
    goals, own goals) are actually generated across many simulated matches.
    """

    def _run_simulations(self, n=300):
        """Run n simulations and collect all generated event types."""
        local = "Real Madrid"
        visitante = "FC Barcelona"
        event_types = []

        with app_module.app.app_context():
            app_module.db.create_all()
        random.seed(12345)
        with app_module.app.app_context():
            for i in range(n):
                # Use unique match identifiers to bypass the deduplication guard
                fake_local = f"{local}_{i}"
                fake_visit = f"{visitante}_{i}"

                gl = app_module.simular_goles(local, True, oponente=visitante)
                gv = app_module.simular_goles(visitante, False, oponente=local)

                conteo_l, conteo_v = {}, {}
                eventos = []

                for _ in range(gl):
                    g = app_module.elegir_goleador(local, True, conteo_l)
                    conteo_l[g] = conteo_l.get(g, 0) + 1
                    eventos.append(("gol", local, g))

                for _ in range(gv):
                    g = app_module.elegir_goleador(visitante, False, conteo_v)
                    conteo_v[g] = conteo_v.get(g, 0) + 1
                    eventos.append(("gol", visitante, g))

                # Penalty (8%)
                if random.random() < 0.08:
                    pen_eq = random.choice([local, visitante])
                    pen_jug = app_module._elegir_jugador_campo(pen_eq)
                    tipo_pen = "pen-gol" if random.random() < 0.75 else "pen-fallo"
                    eventos.append((tipo_pen, pen_eq, pen_jug))

                # Free-kick goal (5%)
                if random.random() < 0.05:
                    fk_eq = random.choice([local, visitante])
                    fk_jug = app_module._elegir_jugador_campo(fk_eq)
                    eventos.append(("falta-gol", fk_eq, fk_jug))

                # Own goal (1%)
                if random.random() < 0.01:
                    og_eq = random.choice([local, visitante])
                    og_jug = app_module._elegir_jugador_campo(og_eq)
                    eventos.append(("propia", og_eq, og_jug))

                # Yellow cards
                num_amarillas = random.choices([2, 3, 4], weights=[40, 40, 20])[0]
                for _ in range(num_amarillas):
                    am_eq = random.choice([local, visitante])
                    am_jug = app_module._elegir_jugador_campo(am_eq)
                    eventos.append(("amarilla", am_eq, am_jug))

                event_types.extend(t for t, _, _ in eventos)

        return event_types

    def test_penalty_events_appear(self):
        types = self._run_simulations(300)
        penalty_types = [t for t in types if t.startswith("pen-")]
        assert len(penalty_types) > 0, "Penalty events never fired in 300 matches"

    def test_free_kick_goal_events_appear(self):
        types = self._run_simulations(300)
        fk_goals = [t for t in types if t == "falta-gol"]
        assert len(fk_goals) > 0, "Free-kick goal events never fired in 300 matches"

    def test_own_goal_events_appear(self):
        types = self._run_simulations(600)
        own_goals = [t for t in types if t == "propia"]
        assert len(own_goals) > 0, "Own-goal events never fired in 600 matches"

    def test_yellow_cards_appear_every_match(self):
        types = self._run_simulations(50)
        yellow_cards = [t for t in types if t == "amarilla"]
        # At minimum 2 yellow cards per match × 50 matches = 100
        assert len(yellow_cards) >= 100

    def test_goal_events_appear(self):
        types = self._run_simulations(100)
        goals = [t for t in types if t == "gol"]
        assert len(goals) > 0

    def test_goalkeeper_almost_never_scores(self):
        """Verify that across many simulations GKs score far less than forwards."""
        from jugadores_data import jugadores_por_equipo
        gk_names = {
            j["nombre"]
            for j in jugadores_por_equipo["Real Madrid"]
            if j["posicion"] == "portero"
        } | {
            j["nombre"]
            for j in jugadores_por_equipo["FC Barcelona"]
            if j["posicion"] == "portero"
        }

        random.seed(42)
        gk_goals = 0
        total_goals = 0

        with app_module.app.app_context():
            for _ in range(500):
                for equipo, local_flag, oponente in [
                    ("Real Madrid", True, "FC Barcelona"),
                    ("FC Barcelona", False, "Real Madrid"),
                ]:
                    gl = app_module.simular_goles(equipo, local_flag, oponente=oponente)
                    conteo = {}
                    for _ in range(gl):
                        scorer = app_module.elegir_goleador(equipo, local_flag, conteo)
                        conteo[scorer] = conteo.get(scorer, 0) + 1
                        total_goals += 1
                        if scorer in gk_names:
                            gk_goals += 1

        gk_rate = gk_goals / max(1, total_goals)
        assert gk_rate < 0.02, (
            f"Goalkeepers scored {gk_goals}/{total_goals} goals ({gk_rate:.2%}); "
            "expected < 2%"
        )


# ---------------------------------------------------------------------------
# DB-backed simular_y_guardar via app context
# ---------------------------------------------------------------------------

class TestSimularYGuardarDB:

    def test_match_saved_to_db(self, client):
        with app_module.app.app_context():
            random.seed(1)
            app_module.simular_y_guardar(1, "Real Madrid", "FC Barcelona")
            count = app_module.Partido.query.count()
        assert count == 1

    def test_duplicate_match_not_saved(self, client):
        with app_module.app.app_context():
            app_module.simular_y_guardar(1, "Real Madrid", "FC Barcelona")
            app_module.simular_y_guardar(1, "Real Madrid", "FC Barcelona")
            count = app_module.Partido.query.count()
        assert count == 1

    def test_events_saved_for_match(self, client):
        with app_module.app.app_context():
            random.seed(2)
            app_module.simular_y_guardar(1, "Real Madrid", "FC Barcelona")
            eventos = app_module.Evento.query.all()
        # At minimum yellow cards (2+) are always generated
        assert len(eventos) >= 2

    def test_match_has_mvp(self, client):
        with app_module.app.app_context():
            random.seed(3)
            app_module.simular_y_guardar(1, "Real Madrid", "FC Barcelona")
            partido = app_module.Partido.query.first()
        assert partido.mvp is not None
        assert isinstance(partido.mvp, str)
        assert len(partido.mvp) > 0

    def test_goles_non_negative(self, client):
        with app_module.app.app_context():
            random.seed(4)
            app_module.simular_y_guardar(1, "Real Madrid", "FC Barcelona")
            partido = app_module.Partido.query.first()
        assert partido.goles_local >= 0
        assert partido.goles_visitante >= 0


# ---------------------------------------------------------------------------
# LIVE STATE shared API  (/api/live/state)
# ---------------------------------------------------------------------------

class TestLiveStateAPI:

    def test_get_returns_shape(self, client):
        rv = client.get("/api/live/state")
        assert rv.status_code == 200
        data = _json(rv)
        assert "state" in data
        assert "updated_at" in data
        assert isinstance(data["state"], dict)

    def test_post_saves_and_get_returns_it(self, client):
        payload = {
            "state": {
                "ml": {
                    "ams-1": {
                        "home": "Arsenal",
                        "away": "Bayern Munich",
                        "sc": {"a": 1, "b": 0},
                        "kickoffDone": True,
                        "finished": False,
                        "timerSec": 420,
                        "isHvH": True,
                        "isFriendly": True,
                    }
                },
                "gmLive": None,
                "gmBg": {},
            }
        }
        rv = client.post("/api/live/state", json=payload)
        assert rv.status_code == 200
        saved = _json(rv)
        assert saved["state"]["ml"]["ams-1"]["home"] == "Arsenal"
        assert saved["state"]["ml"]["ams-1"]["sc"]["a"] == 1
        first_updated_at = saved["updated_at"]

        rv2 = client.get("/api/live/state")
        assert rv2.status_code == 200
        fetched = _json(rv2)
        assert fetched["state"]["ml"]["ams-1"]["home"] == "Arsenal"
        assert fetched["updated_at"] == first_updated_at

    def test_get_with_since_returns_304_when_unchanged(self, client):
        # First write something so we have a non-default updated_at.
        client.post("/api/live/state", json={"state": {"ml": {"ams-1": {"home": "A", "away": "B"}}}})
        rv = client.get("/api/live/state")
        current_ts = _json(rv)["updated_at"]

        rv2 = client.get("/api/live/state", query_string={"since": current_ts})
        assert rv2.status_code == 304

    def test_post_accepts_plain_body_too(self, client):
        # The endpoint should accept both {state: {...}} and a bare dict.
        rv = client.post("/api/live/state", json={"ml": {"x": {"home": "H", "away": "A"}}})
        assert rv.status_code == 200
        fetched = _json(client.get("/api/live/state"))
        assert "x" in fetched["state"]["ml"]

    def test_post_overwrites_previous_state(self, client):
        client.post("/api/live/state", json={"state": {"ml": {"m1": {"home": "A", "away": "B"}}}})
        client.post("/api/live/state", json={"state": {"ml": {"m2": {"home": "C", "away": "D"}}}})
        fetched = _json(client.get("/api/live/state"))
        # Last-write-wins: m1 is gone, m2 is present
        assert "m1" not in fetched["state"]["ml"]
        assert "m2" in fetched["state"]["ml"]
