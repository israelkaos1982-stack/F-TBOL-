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
        # El motor SQLAlchemy se vincula a la URI del fichero al
        # importar la app, así que el `:memory:` de arriba no surte
        # efecto: los tests COMPARTEN la fila live_state. Para que los
        # tests del merge backend partan de un estado limpio, reseteamos
        # explícitamente la fila a su valor por defecto al inicio de
        # cada test (no toca otras tablas/filas para no afectar al
        # resto de la suite ni a la BD de desarrollo).
        live_row = app_module.GlobalState.query.filter_by(
            clave=app_module.LIVE_STATE_KEY
        ).first()
        if live_row is not None:
            live_row.valor_json = json.dumps(app_module.DEFAULT_LIVE_STATE)
            live_row.updated_at = app_module.utc_now_iso()
            app_module.db.session.commit()
        # Mismo razonamiento para `global_state`: un test que escriba
        # {copa_state: {resultados: "foo"}} dejaba el string ahí para
        # el siguiente test, que esperaba lista y fallaba. Reseteamos
        # a DEFAULT_GLOBAL_STATE para garantizar aislamiento.
        gs_row = app_module.GlobalState.query.filter_by(
            clave=app_module.GLOBAL_STATE_KEY
        ).first()
        if gs_row is not None:
            gs_row.valor_json = json.dumps(app_module.DEFAULT_GLOBAL_STATE)
            gs_row.updated_at = app_module.utc_now_iso()
            app_module.db.session.commit()
        # El calendario también vive en GlobalState (clave
        # `calendario_global_v1`) para sobrevivir reinicios en Railway,
        # así que aplica el mismo aislamiento entre tests: borramos la
        # fila para que cada test re-siembre desde `calendario.json`.
        cal_row = app_module.GlobalState.query.filter_by(
            clave=app_module.CALENDARIO_GLOBAL_KEY
        ).first()
        if cal_row is not None:
            app_module.db.session.delete(cal_row)
            app_module.db.session.commit()

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
# Cursor del día del hub (liverpool_preseason_v1) — merge MONOTÓNICO
# Bug 2026-06-05: el usuario estaba en agosto y al volver le ponía 16 jun.
# ---------------------------------------------------------------------------

class TestHubCursorMonotonic:

    KEY = "liverpool_preseason_v1"

    def _post_cursor(self, client, blob):
        client.post(
            "/api/state",
            data=json.dumps({"state": {"competition_state": {self.KEY: json.dumps(blob)}}}),
            content_type="application/json",
        )

    def _get_cursor(self, client):
        rv = client.get("/api/state")
        raw = _json(rv)["state"]["competition_state"].get(self.KEY)
        return json.loads(raw) if raw else None

    def test_advance_is_accepted(self, client):
        self._post_cursor(client, {"dayIdx": 40, "ts": 1000})
        self._post_cursor(client, {"dayIdx": 41, "ts": 1001})
        assert self._get_cursor(client)["dayIdx"] == 41

    def test_stale_downgrade_is_rejected(self, client):
        # Usuario en agosto (dayIdx alto). Una pestaña congelada empuja
        # un cursor viejo (16 jun ~ dayIdx 46) con ts MÁS NUEVO.
        self._post_cursor(client, {"dayIdx": 90, "ts": 5000})
        self._post_cursor(client, {"dayIdx": 46, "ts": 9999})  # stale, ts fresco
        assert self._get_cursor(client)["dayIdx"] == 90

    def test_default_zero_does_not_wipe_progress(self, client):
        # Un dispositivo recién abierto empuja el estado por defecto
        # (dayIdx 0, SIN marca de reinicio) → no debe borrar el avance.
        self._post_cursor(client, {"dayIdx": 70, "ts": 5000})
        self._post_cursor(client, {"dayIdx": 0, "ts": 9999})
        assert self._get_cursor(client)["dayIdx"] == 70

    def test_explicit_reset_wins(self, client):
        # «Reiniciar Temporada» porta resetAt → gana por recencia.
        self._post_cursor(client, {"dayIdx": 70, "ts": 5000})
        self._post_cursor(client, {"dayIdx": 0, "ts": 9999, "resetAt": 9999})
        assert self._get_cursor(client)["dayIdx"] == 0

    def test_stale_reset_does_not_undo_progress(self, client):
        # Un reinicio VIEJO (ts menor) no debe deshacer un avance posterior.
        self._post_cursor(client, {"dayIdx": 80, "ts": 9000})
        self._post_cursor(client, {"dayIdx": 0, "ts": 100, "resetAt": 100})
        assert self._get_cursor(client)["dayIdx"] == 80

    def test_same_day_update_uses_recency(self, client):
        # Mismo día, se actualizan rivales/done → gana el ts mayor.
        self._post_cursor(client, {"dayIdx": 50, "ts": 1000, "done": {}})
        self._post_cursor(client, {"dayIdx": 50, "ts": 2000, "done": {"x": 1}})
        assert self._get_cursor(client)["done"] == {"x": 1}

    def test_other_competition_state_keys_unaffected(self, client):
        # El merge monotónico SOLO aplica al cursor; otras claves de
        # competition_state siguen con overwrite normal.
        client.post(
            "/api/state",
            data=json.dumps({"state": {"competition_state": {"sc_state_v1": "{\"a\":1}"}}}),
            content_type="application/json",
        )
        rv = client.get("/api/state")
        assert _json(rv)["state"]["competition_state"]["sc_state_v1"] == "{\"a\":1}"


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
# Reset forzado de Liga EA Sports  (/api/state/reset-liga)
# ---------------------------------------------------------------------------

class TestResetLiga:

    def test_reset_liga_vacia_resultados_aunque_merge_parcial_no_lo_haga(self, client):
        """Regresión: el POST parcial a /api/state con {liga_results:{}}
        no vacía liga_results porque merge_dict preserva sub-claves.
        El endpoint /api/state/reset-liga debe SÍ vaciarlo siempre,
        usando replace=True en el servidor."""
        # 1) Simular que hay resultados acumulados de una temporada.
        client.post("/api/state", json={
            "liga_results": {
                "1|Real Madrid|FC Barcelona": {"gl": 2, "gv": 1},
                "1|Athletic Club|Alavés": {"gl": 0, "gv": 0},
            }
        })
        # 2) Confirmar que efectivamente se guardaron.
        state = _json(client.get("/api/state"))["state"]
        assert "1|Real Madrid|FC Barcelona" in (state.get("liga_results") or {})

        # 3) El patch parcial con {} NO los limpia (este es el bug
        # que motiva el endpoint nuevo).
        client.post("/api/state", json={"liga_results": {}})
        state_after_patch = _json(client.get("/api/state"))["state"]
        assert "1|Real Madrid|FC Barcelona" in (state_after_patch.get("liga_results") or {}), \
            "merge_dict con incoming vacío NO debería limpiar — comportamiento esperado que motiva /api/state/reset-liga"

        # 4) El endpoint de reset sí los limpia.
        rv = client.post("/api/state/reset-liga")
        assert rv.status_code == 200
        assert _json(rv)["ok"] is True
        state_after_reset = _json(client.get("/api/state"))["state"]
        assert (state_after_reset.get("liga_results") or {}) == {}

    def test_reset_liga_acepta_nuevo_schedule_atomico(self, client):
        """El endpoint puede recibir un schedule nuevo en el body para
        aplicarlo a la vez que vacía los resultados (evita una ronda
        extra de POST desde el cliente tras reiniciar)."""
        # Schedule mínimamente válido: 38 jornadas con listas no vacías.
        fake_schedule = [[["Equipo A", "Equipo B"]] for _ in range(38)]
        rv = client.post("/api/state/reset-liga",
                         json={"liga_schedule": fake_schedule})
        assert rv.status_code == 200
        state = _json(client.get("/api/state"))["state"]
        assert (state.get("liga_results") or {}) == {}
        # El schedule debe haberse aplicado.
        assert state.get("liga_schedule") == fake_schedule

    def test_reset_liga_no_toca_copa_ni_otros_estados(self, client):
        """El reset de liga NO debe borrar copa_state, segunda_state,
        etc. (sólo liga_results / liga_schedule)."""
        # copa_state con formato válido (fase + sorteo como dict) para
        # no contaminar el estado compartido con el resto de tests que
        # asumen que `resultados` es dict-de-listas.
        client.post("/api/state", json={
            "liga_results": {"k": {"gl": 1, "gv": 0}},
            "copa_state": {"fase": "oct", "sorteo": {"oct": [["A", "B"]]}},
        })
        client.post("/api/state/reset-liga")
        state = _json(client.get("/api/state"))["state"]
        assert (state.get("liga_results") or {}) == {}
        # copa_state intacto
        copa = state.get("copa_state") or {}
        assert copa.get("fase") == "oct"
        assert copa.get("sorteo") == {"oct": [["A", "B"]]}


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
        # Last-write-wins a nivel de qué partidos existen: m1 desaparece
        # porque el segundo POST no lo incluye en su snapshot.
        assert "m1" not in fetched["state"]["ml"]
        assert "m2" in fetched["state"]["ml"]

    # ── COEDICIÓN HUMANO vs HUMANO ──────────────────────────────────
    # Los siguientes tests verifican que dos dispositivos pueden añadir
    # eventos al MISMO partido sin que un POST le pise los eventos al
    # otro (escenario: dos humanos jugando un partido HvH live, cada uno
    # marcando goles/tarjetas desde su propio móvil).

    def test_events_are_unioned_by_id_across_posts(self, client):
        """Dos clientes añaden eventos distintos al mismo partido. Tras
        el segundo POST, el servidor debe contener AMBOS eventos."""
        match = {"home": "Real Madrid", "away": "Barcelona", "kickoffDone": True}
        # Cliente A postea con el evento E_A
        ev_a = {"id": "evt-a-001", "type": "gol", "team": "a", "min": 23,
                "player": "Jugador A", "num": "9"}
        client.post("/api/live/state", json={"state": {
            "ml": {"hvh-1": dict(match, events=[ev_a])}
        }})
        # Cliente B postea con el evento E_B (no conoce E_A todavía)
        ev_b = {"id": "evt-b-002", "type": "gol", "team": "b", "min": 31,
                "player": "Jugador B", "num": "10"}
        client.post("/api/live/state", json={"state": {
            "ml": {"hvh-1": dict(match, events=[ev_b])}
        }})
        fetched = _json(client.get("/api/live/state"))
        merged = fetched["state"]["ml"]["hvh-1"]["events"]
        ids = sorted(e["id"] for e in merged)
        assert ids == ["evt-a-001", "evt-b-002"]
        # Y el marcador se recalcula a partir de los eventos: 1-1
        assert fetched["state"]["ml"]["hvh-1"]["sc"] == {"a": 1, "b": 1}

    def test_event_with_same_id_does_not_duplicate(self, client):
        """Un cliente reposteando su snapshot con el mismo id no debe
        crear duplicados (debounce + flush periódico repostea seguido)."""
        ev = {"id": "evt-x", "type": "gol", "team": "a", "min": 10}
        match = {"home": "A", "away": "B", "kickoffDone": True, "events": [ev]}
        for _ in range(3):
            client.post("/api/live/state", json={"state": {"ml": {"m": match}}})
        fetched = _json(client.get("/api/live/state"))
        assert len(fetched["state"]["ml"]["m"]["events"]) == 1

    def test_event_update_with_same_id_overwrites(self, client):
        """Editar un evento existente (mismo id, distinto contenido)
        debe reemplazarlo en su sitio, no añadir uno nuevo."""
        ev_v1 = {"id": "evt-1", "type": "amarilla", "team": "a", "min": 12,
                 "player": "Pepe"}
        client.post("/api/live/state", json={"state": {
            "ml": {"m": {"home": "A", "away": "B", "kickoffDone": True,
                          "events": [ev_v1]}}
        }})
        ev_v2 = dict(ev_v1, type="d-amarilla", min=45)
        client.post("/api/live/state", json={"state": {
            "ml": {"m": {"home": "A", "away": "B", "kickoffDone": True,
                          "events": [ev_v2]}}
        }})
        fetched = _json(client.get("/api/live/state"))
        evs = fetched["state"]["ml"]["m"]["events"]
        assert len(evs) == 1
        assert evs[0]["type"] == "d-amarilla"
        assert evs[0]["min"] == 45

    def test_legacy_events_without_id_dedup_by_content(self, client):
        """Eventos sin id (clientes legacy) se deduplican por contenido
        para que reposteos seguidos no creen duplicados."""
        ev = {"type": "gol", "team": "a", "min": 7, "player": "X", "num": "11"}
        match = {"home": "A", "away": "B", "kickoffDone": True, "events": [ev]}
        client.post("/api/live/state", json={"state": {"ml": {"m": match}}})
        client.post("/api/live/state", json={"state": {"ml": {"m": match}}})
        fetched = _json(client.get("/api/live/state"))
        assert len(fetched["state"]["ml"]["m"]["events"]) == 1

    def test_timer_takes_max_across_posts(self, client):
        """El cronómetro es monotónico: gana el valor más alto entre
        dos snapshots concurrentes (no LWW que podría retroceder)."""
        client.post("/api/live/state", json={"state": {
            "ml": {"m": {"home": "A", "away": "B", "kickoffDone": True,
                          "events": [], "timerSec": 600}}
        }})
        # Snapshot "atrasado" llega después; no debe pisar el timer.
        client.post("/api/live/state", json={"state": {
            "ml": {"m": {"home": "A", "away": "B", "kickoffDone": True,
                          "events": [], "timerSec": 540}}
        }})
        fetched = _json(client.get("/api/live/state"))
        assert fetched["state"]["ml"]["m"]["timerSec"] == 600

    def test_monotonic_flags_latch_true(self, client):
        """Las banderas como `finished`, `htDone`, `etDone` son
        monotónicas: una vez en True, ningún snapshot posterior con
        False puede revertirlas."""
        client.post("/api/live/state", json={"state": {
            "ml": {"m": {"home": "A", "away": "B", "kickoffDone": True,
                          "htDone": True, "events": []}}
        }})
        client.post("/api/live/state", json={"state": {
            "ml": {"m": {"home": "A", "away": "B", "kickoffDone": True,
                          "htDone": False, "events": []}}
        }})
        fetched = _json(client.get("/api/live/state"))
        assert fetched["state"]["ml"]["m"]["htDone"] is True

    def test_score_recomputed_from_merged_events(self, client):
        """El marcador se recalcula a partir de los eventos fusionados,
        ignorando goles anulados por VAR."""
        match = {"home": "A", "away": "B", "kickoffDone": True}
        client.post("/api/live/state", json={"state": {
            "ml": {"m": dict(match, events=[
                {"id": "g1", "type": "gol", "team": "a", "min": 10},
                {"id": "g2", "type": "gol", "team": "a", "min": 20},
            ], varAnuladoIds=["g2"])}
        }})
        client.post("/api/live/state", json={"state": {
            "ml": {"m": dict(match, events=[
                {"id": "g3", "type": "propia", "team": "a", "min": 30},
            ])}
        }})
        fetched = _json(client.get("/api/live/state"))
        m = fetched["state"]["ml"]["m"]
        assert sorted(e["id"] for e in m["events"]) == ["g1", "g2", "g3"]
        # g1 cuenta para A. g2 anulado por VAR. g3 propia → cuenta para B.
        assert m["sc"] == {"a": 1, "b": 1}

    def test_var_anulado_ids_are_unioned(self, client):
        """varAnuladoIds y redCards también se fusionan (set semantics)
        para que dos dispositivos puedan anular distintos goles."""
        match = {"home": "A", "away": "B", "kickoffDone": True, "events": [
            {"id": "g1", "type": "gol", "team": "a", "min": 10},
            {"id": "g2", "type": "gol", "team": "b", "min": 20},
        ]}
        client.post("/api/live/state", json={"state": {
            "ml": {"m": dict(match, varAnuladoIds=["g1"])}
        }})
        client.post("/api/live/state", json={"state": {
            "ml": {"m": dict(match, varAnuladoIds=["g2"])}
        }})
        fetched = _json(client.get("/api/live/state"))
        anulados = fetched["state"]["ml"]["m"]["varAnuladoIds"]
        assert sorted(anulados) == ["g1", "g2"]
        # Ambos goles anulados → 0-0
        assert fetched["state"]["ml"]["m"]["sc"] == {"a": 0, "b": 0}

    def test_gm_live_merges_events_when_same_match(self, client):
        """gmLive (modal de partido genérico) también une eventos cuando
        el partido es el mismo (mismo j/home/away)."""
        gm_a = {"j": 1, "home": "RM", "away": "FCB", "kickoffDone": True,
                "events": [{"id": "e1", "type": "gol", "team": "a", "min": 5}]}
        client.post("/api/live/state", json={"state": {"gmLive": gm_a}})
        gm_b = dict(gm_a, events=[
            {"id": "e2", "type": "gol", "team": "b", "min": 8}
        ])
        client.post("/api/live/state", json={"state": {"gmLive": gm_b}})
        fetched = _json(client.get("/api/live/state"))
        ids = sorted(e["id"] for e in fetched["state"]["gmLive"]["events"])
        assert ids == ["e1", "e2"]

    def test_gm_live_replaces_when_different_match(self, client):
        """Si el `gmLive` cambia a OTRO partido (otro j/home/away), se
        reemplaza por completo (no se mezclan eventos de partidos
        distintos)."""
        gm_a = {"j": 1, "home": "RM", "away": "FCB", "kickoffDone": True,
                "events": [{"id": "e1", "type": "gol", "team": "a", "min": 5}]}
        client.post("/api/live/state", json={"state": {"gmLive": gm_a}})
        gm_b = {"j": 2, "home": "Atletico", "away": "Sevilla", "kickoffDone": True,
                "events": [{"id": "z9", "type": "gol", "team": "a", "min": 10}]}
        client.post("/api/live/state", json={"state": {"gmLive": gm_b}})
        fetched = _json(client.get("/api/live/state"))
        gl = fetched["state"]["gmLive"]
        assert gl["home"] == "Atletico"
        assert [e["id"] for e in gl["events"]] == ["z9"]


# ---------------------------------------------------------------------------
# Admin session (PIN 747) + CRUD del calendario editable
# ---------------------------------------------------------------------------

class TestAdminSession:

    def test_status_anonymous_is_false(self, client):
        rv = client.get("/api/admin/status")
        assert rv.status_code == 200
        assert _json(rv)["admin"] is False

    def test_login_wrong_pin_returns_401(self, client):
        rv = client.post("/api/admin/login", json={"pin": "000"})
        assert rv.status_code == 401
        assert _json(rv)["ok"] is False

    def test_login_right_pin_sets_session(self, client):
        rv = client.post("/api/admin/login", json={"pin": "747"})
        assert rv.status_code == 200
        assert _json(rv) == {"ok": True, "admin": True}
        # La sesión persiste entre peticiones del mismo test_client
        rv2 = client.get("/api/admin/status")
        assert _json(rv2)["admin"] is True

    def test_logout_clears_admin(self, client):
        client.post("/api/admin/login", json={"pin": "747"})
        rv = client.post("/api/admin/logout")
        assert _json(rv) == {"ok": True, "admin": False}
        rv2 = client.get("/api/admin/status")
        assert _json(rv2)["admin"] is False


class TestCalendario:

    def _login(self, client):
        client.post("/api/admin/login", json={"pin": "747"})

    def test_get_calendario_shape(self, client):
        rv = client.get("/api/calendario")
        assert rv.status_code == 200
        data = _json(rv)
        assert data["ok"] is True
        cal = data["calendario"]
        assert isinstance(cal.get("sections"), list)
        # El seed tiene 4 secciones y cubre la temporada día a día
        # (partidos + Descanso tras cada partido + Entrenamiento el
        # resto), así que el total es > 300. Sólo validamos orden de
        # magnitud para que pequeños ajustes del seed no rompan el test.
        assert len(cal["sections"]) == 4
        total = sum(len(s["events"]) for s in cal["sections"])
        assert total > 300

    def test_add_edit_delete_require_admin(self, client):
        """Sin login, los 3 POST de mutación devuelven 403."""
        for path, body in [
            ("/api/calendario/add", {"section_id": "verano-p1", "date": "X", "icon": "🤝", "name": "X", "weather": "☀️"}),
            ("/api/calendario/edit", {"event_id": "ev-001", "date": "X", "icon": "🤝", "name": "X", "weather": "☀️"}),
            ("/api/calendario/delete", {"event_id": "ev-001"}),
        ]:
            rv = client.post(path, json=body)
            assert rv.status_code == 403, f"{path} debería requerir admin"

    def test_add_event_generates_id_and_persists(self, client, tmp_path, monkeypatch):
        """El add genera un id `ev-NNN` único y guarda el evento en
        la sección indicada."""
        # Redirige el archivo a un tmp para no manchar el del repo.
        fake = tmp_path / "calendario.json"
        fake.write_text(open(app_module.CALENDARIO_PATH).read(), encoding="utf-8")
        monkeypatch.setattr(app_module, "CALENDARIO_PATH", str(fake))
        self._login(client)
        rv = client.post("/api/calendario/add", json={
            "section_id": "verano-p1",
            "date": "16 Jul",
            "icon": "🤝",
            "name": "Amistoso EXTRA",
            "weather": "☀️",
        })
        assert rv.status_code == 200
        j = _json(rv)
        assert j["ok"] is True
        assert j["event"]["id"].startswith("ev-")
        assert j["event"]["name"] == "Amistoso EXTRA"
        # El nuevo id no debe colisionar con uno existente.
        cal = _json(client.get("/api/calendario"))["calendario"]
        all_ids = [e["id"] for s in cal["sections"] for e in s["events"]]
        assert len(all_ids) == len(set(all_ids))
        # Y el evento se encuentra en verano-p1.
        verano_events = next(s["events"] for s in cal["sections"] if s["id"] == "verano-p1")
        assert any(e["name"] == "Amistoso EXTRA" for e in verano_events)

    def test_add_rejects_missing_fields(self, client, tmp_path, monkeypatch):
        fake = tmp_path / "calendario.json"
        fake.write_text(open(app_module.CALENDARIO_PATH).read(), encoding="utf-8")
        monkeypatch.setattr(app_module, "CALENDARIO_PATH", str(fake))
        self._login(client)
        # Falta `name`
        rv = client.post("/api/calendario/add", json={
            "section_id": "verano-p1", "date": "X", "icon": "🤝", "weather": "☀️"
        })
        assert rv.status_code == 400
        assert _json(rv)["error"] == "falta nombre"

    def test_add_rejects_unknown_section(self, client, tmp_path, monkeypatch):
        fake = tmp_path / "calendario.json"
        fake.write_text(open(app_module.CALENDARIO_PATH).read(), encoding="utf-8")
        monkeypatch.setattr(app_module, "CALENDARIO_PATH", str(fake))
        self._login(client)
        rv = client.post("/api/calendario/add", json={
            "section_id": "no-existe", "date": "X", "icon": "🤝",
            "name": "Y", "weather": "☀️"
        })
        assert rv.status_code == 404

    def test_edit_updates_fields_in_place(self, client, tmp_path, monkeypatch):
        fake = tmp_path / "calendario.json"
        fake.write_text(open(app_module.CALENDARIO_PATH).read(), encoding="utf-8")
        monkeypatch.setattr(app_module, "CALENDARIO_PATH", str(fake))
        self._login(client)
        rv = client.post("/api/calendario/edit", json={
            "event_id": "ev-001",
            "date": "16 Jul",
            "icon": "🤝",
            "name": "Amistoso editado",
            "weather": "🌧",
        })
        assert rv.status_code == 200
        j = _json(rv)
        assert j["event"]["name"] == "Amistoso editado"
        assert j["event"]["weather"] == "🌧"
        assert j["event"]["id"] == "ev-001"  # id conservado

    def test_edit_rejects_unknown_event(self, client, tmp_path, monkeypatch):
        fake = tmp_path / "calendario.json"
        fake.write_text(open(app_module.CALENDARIO_PATH).read(), encoding="utf-8")
        monkeypatch.setattr(app_module, "CALENDARIO_PATH", str(fake))
        self._login(client)
        rv = client.post("/api/calendario/edit", json={
            "event_id": "ev-zzz",
            "date": "X", "icon": "🤝", "name": "X", "weather": "☀️"
        })
        assert rv.status_code == 404

    def test_delete_removes_event(self, client, tmp_path, monkeypatch):
        fake = tmp_path / "calendario.json"
        fake.write_text(open(app_module.CALENDARIO_PATH).read(), encoding="utf-8")
        monkeypatch.setattr(app_module, "CALENDARIO_PATH", str(fake))
        self._login(client)
        rv = client.post("/api/calendario/delete", json={"event_id": "ev-005"})
        assert rv.status_code == 200
        assert _json(rv)["ok"] is True
        # Ya no debe aparecer en el GET.
        cal = _json(client.get("/api/calendario"))["calendario"]
        all_ids = [e["id"] for s in cal["sections"] for e in s["events"]]
        assert "ev-005" not in all_ids

    def test_delete_rejects_unknown_event(self, client, tmp_path, monkeypatch):
        fake = tmp_path / "calendario.json"
        fake.write_text(open(app_module.CALENDARIO_PATH).read(), encoding="utf-8")
        monkeypatch.setattr(app_module, "CALENDARIO_PATH", str(fake))
        self._login(client)
        rv = client.post("/api/calendario/delete", json={"event_id": "ev-zzz"})
        assert rv.status_code == 404


class TestBayernHudRevGuard:
    """El HUD del hub (bayern_hud_overrides_v1) lleva un reloj LÓGICO `rev`
    monotónico: un push con `rev` MENOR (cliente viejo sin actualizar, copia
    stale, o dispositivo con el reloj adelantado) NUNCA debe pisar el valor
    más nuevo por recencia de reloj de pared. Causa raíz del bug «el 🪙
    presupuesto vuelve a 0 al borrar datos de navegación» en un parque de
    6 móviles + PC (foto usuario 2026-06-11)."""

    KEY = "/api/kv/bayern_hud_overrides_v1"

    def _get(self, client):
        return _json(client.get(self.KEY)).get("value")

    def test_authoritative_save_sets_rev_above_old(self, client):
        client.post(self.KEY, json={"value": {"money": 4500, "pi": 5,
                    "ratingTarget": 8.8, "moneyTarget": 1300, "updatedAt": 1000,
                    "rev": 1}, "authoritative": True})
        v = self._get(client)
        assert v["money"] == 4500
        assert v["rev"] >= 2  # el server bumpea por encima del entrante

    def test_stale_old_client_future_ts_money_zero_rejected(self, client):
        # Admin guarda 4500 (autoritativo) y un running-total legítimo baja a 4350.
        client.post(self.KEY, json={"value": {"money": 4500, "pi": 5,
                    "ratingTarget": 8.8, "moneyTarget": 1300, "updatedAt": 1000,
                    "rev": 1}, "authoritative": True})
        cur = self._get(client)["rev"]
        client.post(self.KEY, json={"value": {"money": 4350, "pi": 5,
                    "ratingTarget": 8.8, "moneyTarget": 1300, "objMoney": 0,
                    "updatedAt": 2000, "rev": cur + 1}})
        assert self._get(client)["money"] == 4350
        # Cliente VIEJO (sin `rev` => 0) con el RELOJ ADELANTADO empuja money=0.
        client.post(self.KEY, json={"value": {"money": 0, "pi": 8,
                    "ratingTarget": 8.8, "moneyTarget": 1300,
                    "updatedAt": 9_999_999}})
        assert self._get(client)["money"] == 4350  # RECHAZADO, no clobber

    def test_higher_rev_running_total_applies(self, client):
        client.post(self.KEY, json={"value": {"money": 4500, "pi": 5,
                    "ratingTarget": 8.8, "moneyTarget": 1300, "updatedAt": 1000,
                    "rev": 1}, "authoritative": True})
        cur = self._get(client)["rev"]
        client.post(self.KEY, json={"value": {"money": 4600, "pi": 5,
                    "ratingTarget": 8.8, "moneyTarget": 1300, "updatedAt": 3000,
                    "rev": cur + 1}})
        v = self._get(client)
        assert v["money"] == 4600 and v["pi"] == 5

    def test_admin_reset_authoritative_still_wins(self, client):
        client.post(self.KEY, json={"value": {"money": 4500, "rev": 1,
                    "updatedAt": 1000}, "authoritative": True})
        # ♻ Restablecer: blob autoritativo "vacío" — debe ganar (intención admin).
        client.post(self.KEY, json={"value": {"updatedAt": 2000},
                    "authoritative": True})
        v = self._get(client)
        assert "money" not in v or v.get("money") in (None, 0)


class TestTourInfoCardsRevGuard:
    """La info card editable por torneo (tour_info_cards_v1) es UN blob
    compartido sincronizado por recencia. Antes (2026-06-13) no llevaba ni
    `authoritative` ni `rev`: en un parque de 6 móviles + PC, un dispositivo
    con el reloj ADELANTADO dejaba un valor con `updatedAt` FUTURO que RECHAZABA
    por recencia el guardado legítimo del admin (el POST devolvía 200 pero el
    valor se descartaba) → al recargar «no se guarda ninguno» (foto usuario
    2026-06-14). Ahora el ✅ Guardar va authoritative (sella reloj + bumpea rev)
    y gana SIEMPRE; el re-push self-heal no-authoritative lleva rev-guard."""

    KEY = "/api/kv/tour_info_cards_v1"

    def _get(self, client):
        return _json(client.get(self.KEY)).get("value")

    def test_key_is_allowed(self):
        assert app_module._kv_is_allowed("tour_info_cards_v1")

    def test_authoritative_save_seals_clock_and_bumps_rev(self, client):
        # El admin guarda con un updatedAt PEQUEÑO (reloj correcto/lento).
        client.post(self.KEY, json={"value": {
            "competiciones-superliga": {"informacion": "texto A"},
            "updatedAt": 1000, "rev": 1}, "authoritative": True})
        v = self._get(client)
        assert v["competiciones-superliga"]["informacion"] == "texto A"
        # El server sella updatedAt con SU reloj (>> 1000) y bumpea rev.
        assert v["updatedAt"] > 1000
        assert v["rev"] >= 2

    def test_future_ts_stale_does_not_reject_admin_save(self, client):
        # Un móvil con el RELOJ ADELANTADO deja un valor FUTURO (sin rev).
        client.post(self.KEY, json={"value": {
            "competiciones-superliga": {"informacion": "viejo"},
            "updatedAt": 9_999_999_999}})
        # El admin (reloj correcto, ts MUCHO menor) edita autoritativamente.
        client.post(self.KEY, json={"value": {
            "competiciones-superliga": {"informacion": "EDITADO"},
            "updatedAt": 1000, "rev": 1}, "authoritative": True})
        # Antes del fix esto se RECHAZABA por recencia; ahora GANA.
        assert self._get(client)["competiciones-superliga"]["informacion"] == "EDITADO"

    def test_repush_lower_rev_is_rejected(self, client):
        client.post(self.KEY, json={"value": {
            "asia": {"informacion": "B"}, "updatedAt": 5000, "rev": 1},
            "authoritative": True})
        cur = self._get(client)["rev"]
        # Re-push self-heal NO-authoritative con rev MENOR (cliente atrasado):
        # rechazado entero, no pisa lo guardado.
        client.post(self.KEY, json={"value": {
            "asia": {"informacion": "viejo"}, "updatedAt": 9_999_999, "rev": 0}})
        v = self._get(client)
        assert v["asia"]["informacion"] == "B"
        assert v["rev"] == cur

    def test_authoritative_merge_preserves_other_ids(self, client):
        """Un save autoritativo desde un dispositivo con localStorage parcial
        (solo sfn1) NO borra los datos de otros IDs ya en el server (spv1).
        Causa raíz del bug 2026-06-16: wipe → save solo con los IDs editados
        → reemplazaba el blob entero → otros torneos perdían su info."""
        # Dispositivo A guarda sfn1 (autoritative, datos completos).
        client.post(self.KEY, json={"value": {
            "sfn1": {"informacion": "mundial-info"},
            "spv1": {"informacion": "previa-info"},
            "updatedAt": 1000, "rev": 1}, "authoritative": True})
        # Dispositivo B (wipe/fresco) solo conoce spv2 y lo guarda autoritativamente.
        client.post(self.KEY, json={"value": {
            "spv2": {"informacion": "nueva-previa"},
            "updatedAt": 2000, "rev": 1}, "authoritative": True})
        v = self._get(client)
        # spv2 (del save de B) EXISTE.
        assert v["spv2"]["informacion"] == "nueva-previa"
        # sfn1 y spv1 (del save anterior de A) NO se han borrado.
        assert v["sfn1"]["informacion"] == "mundial-info"
        assert v["spv1"]["informacion"] == "previa-info"

    def test_authoritative_client_wins_same_id(self, client):
        """Cuando el cliente edita un ID que ya existe en el server, su valor
        gana (el merge no bloquea actualizaciones legítimas del mismo ID)."""
        client.post(self.KEY, json={"value": {
            "sfn1": {"informacion": "texto viejo"},
            "updatedAt": 1000, "rev": 1}, "authoritative": True})
        client.post(self.KEY, json={"value": {
            "sfn1": {"informacion": "texto nuevo"},
            "updatedAt": 2000, "rev": 1}, "authoritative": True})
        v = self._get(client)
        assert v["sfn1"]["informacion"] == "texto nuevo"

    def test_repush_merge_preserves_other_ids(self, client):
        """El re-push non-authoritative (self-heal) también hace merge por ID:
        no borra los IDs del server que el cliente no trae."""
        # Estado inicial: sfn1 en el server con rev=3.
        client.post(self.KEY, json={"value": {
            "sfn1": {"informacion": "sfn1-data"},
            "updatedAt": 1000, "rev": 3}, "authoritative": True})
        cur_rev = self._get(client)["rev"]  # server bumpeó a 4
        # Re-push non-auth con solo spv1, rev=4 (igual al server → merge por ts).
        client.post(self.KEY, json={"value": {
            "spv1": {"informacion": "spv1-data"},
            "updatedAt": 9999, "rev": cur_rev}})
        v = self._get(client)
        # spv1 del re-push presente.
        assert v["spv1"]["informacion"] == "spv1-data"
        # sfn1 del estado anterior NO borrado.
        assert v["sfn1"]["informacion"] == "sfn1-data"


class TestMunichObjStateMerge:
    """Progreso de Objetivos del Club (munich-obj-state-v5). Bug 2026-08-02
    (foto usuario: "he creado varios y los marco en verde, cuando salgo y
    vuelvo a abrirlos desaparecen el verde de la mayoría"): un push (con o
    sin `authoritative`) reemplazaba el `checks`/`counters` ENTERO por lo que
    el cliente traía en ESE instante. Si ese push no incluía TODOS los oids
    conocidos (p.ej. un render puntual sin todos los objetivos personalizados
    todavía cargados), los oids AUSENTES perdían su ✅ para siempre. Ahora se
    fusiona por CLAVE (oid): el entrante gana en lo que trae, se conserva lo
    que solo estaba en el server. `reset:true` (Reiniciar Temporada) sigue
    ganando entero, sin fusión."""

    KEY = "/api/kv/munich-obj-state-v5"

    def _get(self, client):
        return _json(client.get(self.KEY)).get("value")

    def test_partial_authoritative_push_preserves_other_oids(self, client):
        # El usuario marca 2 objetivos por defecto + custom en una pasada.
        client.post(self.KEY, json={"value": {
            "checks": {"liga-0": True, "copa-1": True, "verano__xabc": True},
            "counters": {}, "updatedAt": 1000}, "authoritative": True})
        # Un render posterior solo tenía "europa-0" en el DOM (p.ej. el resto
        # de secciones estaba colapsado/no se pintó en esa pasada concreta) y
        # el usuario marca ESE — el push autoritativo solo trae ese oid.
        client.post(self.KEY, json={"value": {
            "checks": {"europa-0": True},
            "counters": {}, "updatedAt": 2000}, "authoritative": True})
        v = self._get(client)
        # El nuevo oid entra...
        assert v["checks"]["europa-0"] is True
        # ...pero los 3 ✅ anteriores NO desaparecen.
        assert v["checks"]["liga-0"] is True
        assert v["checks"]["copa-1"] is True
        assert v["checks"]["verano__xabc"] is True

    def test_explicit_uncheck_still_works(self, client):
        client.post(self.KEY, json={"value": {
            "checks": {"liga-0": True, "copa-1": True},
            "counters": {}, "updatedAt": 1000}, "authoritative": True})
        # El usuario desmarca liga-0 explícitamente (el oid SIGUE presente en
        # el push, solo que ahora en `false` — un uncheck real).
        client.post(self.KEY, json={"value": {
            "checks": {"liga-0": False, "copa-1": True},
            "counters": {}, "updatedAt": 2000}, "authoritative": True})
        v = self._get(client)
        assert v["checks"]["liga-0"] is False
        assert v["checks"]["copa-1"] is True

    def test_non_authoritative_repush_also_merges(self, client):
        client.post(self.KEY, json={"value": {
            "checks": {"liga-0": True}, "counters": {},
            "updatedAt": 1000}, "authoritative": True})
        # El push autoritativo anterior sella `updatedAt` con el reloj REAL
        # del server (`srv_now`), así que el siguiente `updatedAt` debe ser
        # posterior a ese sello (no a los 1000 ms "de mentira" que mandó el
        # cliente) para tomar la rama de recencia normal en vez de "stale".
        cur_ts = self._get(client)["updatedAt"]
        # Re-push self-heal (timer interno de _kvBlobSync.touch, SIN el flag
        # authoritative) con un subconjunto distinto de oids.
        client.post(self.KEY, json={"value": {
            "checks": {"copa-1": True}, "counters": {},
            "updatedAt": cur_ts + 1000}})
        v = self._get(client)
        assert v["checks"]["liga-0"] is True
        assert v["checks"]["copa-1"] is True

    def test_reset_wins_whole_and_clears_everything(self, client):
        client.post(self.KEY, json={"value": {
            "checks": {"liga-0": True, "copa-1": True},
            "counters": {}, "updatedAt": 1000}, "authoritative": True})
        # Reiniciar Temporada: blob vacío marcado como reset intencional.
        client.post(self.KEY, json={"value": {
            "checks": {}, "counters": {}, "updatedAt": 2000, "reset": True},
            "authoritative": True})
        v = self._get(client)
        assert v["checks"] == {}

    def test_reset_via_non_authoritative_repush_also_wins(self, client):
        """El re-push que agenda `touch()` tras `pushNow(true)` (1200 ms
        después, SIN `authoritative`) también lleva `reset:true` y debe
        seguir ganando entero, no resucitar lo borrado."""
        client.post(self.KEY, json={"value": {
            "checks": {"liga-0": True}, "counters": {},
            "updatedAt": 1000}, "authoritative": True})
        client.post(self.KEY, json={"value": {
            "checks": {}, "counters": {}, "updatedAt": 2000, "reset": True},
            "authoritative": True})
        client.post(self.KEY, json={"value": {
            "checks": {}, "counters": {}, "updatedAt": 2000, "reset": True}})
        v = self._get(client)
        assert v["checks"] == {}


class TestMultiHubKeys:
    """Multi-hub (2026-06-13): cada caja de mister humano (Arsenal-Brasil,
    etc.) tiene datos INDEPENDIENTES en variantes POR HUB de las claves base
    (`bayern_hud_overrides_v1_<id>`, `munich-obj-state-v4_<id>`,
    `liverpool_preseason_v1_<id>`). Cada variante HEREDA EXACTAMENTE el mismo
    merge/proteccion que su base; Liverpool (clave base, sin sufijo) jamas se
    ve afectado por la caja de otro mister."""

    HUD_BASE = "/api/kv/bayern_hud_overrides_v1"
    HUD_ALV = "/api/kv/bayern_hud_overrides_v1_alvaro"
    CUR = "liverpool_preseason_v1"
    CUR_ALV = "liverpool_preseason_v1_alvaro"

    def _kv(self, client, url):
        return _json(client.get(url)).get("value")

    def _post_cursor(self, client, key, blob):
        client.post(
            "/api/state",
            data=json.dumps({"state": {"competition_state": {key: json.dumps(blob)}}}),
            content_type="application/json",
        )

    def _get_cursor(self, client, key):
        raw = _json(client.get("/api/state"))["state"]["competition_state"].get(key)
        return json.loads(raw) if raw else None

    # ── allow-list ──────────────────────────────────────────────────
    def test_suffixed_hud_key_is_allowed(self):
        assert app_module._kv_is_allowed("bayern_hud_overrides_v1_alvaro")
        assert app_module._kv_is_allowed("munich-obj-state-v4_alvaro")
        assert app_module._kv_is_allowed("bayern_trofeos_v1_alvaro")
        # Una clave arbitraria con sufijo NO listada sigue rechazada.
        assert not app_module._kv_is_allowed("totally_made_up_key_alvaro")

    def test_hub_base_maps_variants(self):
        assert app_module._kv_hub_base("bayern_hud_overrides_v1_alvaro") == "bayern_hud_overrides_v1"
        assert app_module._kv_hub_base("bayern_hud_overrides_v1") == "bayern_hud_overrides_v1"
        # No-variante se devuelve tal cual.
        assert app_module._kv_hub_base("cash_ledger_v1") == "cash_ledger_v1"

    # ── HUD por hub: misma proteccion rev/field-merge que la base ────
    def test_suffixed_hud_rev_guard(self, client):
        client.post(self.HUD_ALV, json={"value": {"money": 999, "pi": 5,
                    "ratingTarget": 8.8, "moneyTarget": 1300, "updatedAt": 1000,
                    "rev": 1}, "authoritative": True})
        cur = self._kv(client, self.HUD_ALV)["rev"]
        assert self._kv(client, self.HUD_ALV)["money"] == 999
        # Cliente VIEJO (sin rev=0) con reloj adelantado NO clobberea.
        client.post(self.HUD_ALV, json={"value": {"money": 0, "pi": 8,
                    "ratingTarget": 8.8, "moneyTarget": 1300,
                    "updatedAt": 9_999_999}})
        assert self._kv(client, self.HUD_ALV)["money"] == 999
        assert self._kv(client, self.HUD_ALV)["rev"] == cur

    def test_hud_hubs_are_independent(self, client):
        client.post(self.HUD_BASE, json={"value": {"money": 100, "pi": 5,
                    "ratingTarget": 8.8, "moneyTarget": 1300, "updatedAt": 1000,
                    "rev": 1}, "authoritative": True})
        client.post(self.HUD_ALV, json={"value": {"money": 777, "pi": 3,
                    "ratingTarget": 8.8, "moneyTarget": 1300, "updatedAt": 1000,
                    "rev": 1}, "authoritative": True})
        assert self._kv(client, self.HUD_BASE)["money"] == 100
        assert self._kv(client, self.HUD_ALV)["money"] == 777

    # ── cursor por hub: merge monotonico + independencia ─────────────
    def test_suffixed_cursor_monotonic(self, client):
        self._post_cursor(client, self.CUR_ALV, {"dayIdx": 40, "ts": 1000})
        self._post_cursor(client, self.CUR_ALV, {"dayIdx": 20, "ts": 9999})  # stale
        assert self._get_cursor(client, self.CUR_ALV)["dayIdx"] == 40

    def test_cursor_hubs_are_independent(self, client):
        self._post_cursor(client, self.CUR, {"dayIdx": 70, "ts": 1000})
        self._post_cursor(client, self.CUR_ALV, {"dayIdx": 5, "ts": 1000})
        assert self._get_cursor(client, self.CUR)["dayIdx"] == 70
        assert self._get_cursor(client, self.CUR_ALV)["dayIdx"] == 5


class TestTrofeosMerge:
    """Vitrina de trofeos (bayern_trofeos_v1 + variantes por hub) — RECENCIA
    + EMPTY-GUARD (bug usuario 2026-06-27: «tenía toda la vitrina del
    Arsenal-Álvaro y del Real Madrid-Acsa y no se han guardado»). La vitrina
    es un registro PERSISTENTE del admin que debe sobrevivir al wipe / cambio
    de móvil de CUALQUIERA de las 6 cajas humanas; un POST vacío de un
    dispositivo recién wipeado no puede borrar lo que otro ya subió."""

    BASE = "/api/kv/bayern_trofeos_v1"
    ALV = "/api/kv/bayern_trofeos_v1_alvaro"
    ACSA = "/api/kv/bayern_trofeos_v1_acsa"

    def _items(self, client, url):
        v = _json(client.get(url)).get("value")
        if isinstance(v, dict):
            return v.get("items")
        return v

    def _trof(self, n, count=1):
        return {"id": "tr-" + str(n), "icon": "/static/x.svg",
                "title": "TÍTULO " + str(n), "count": count}

    def test_first_save_persists(self, client):
        client.post(self.ALV, json={"value": {"updatedAt": 1000,
                    "items": [self._trof(1), self._trof(2)]}})
        items = self._items(client, self.ALV)
        assert isinstance(items, list) and len(items) == 2

    def test_empty_does_not_clobber_non_empty(self, client):
        client.post(self.ALV, json={"value": {"updatedAt": 1000,
                    "items": [self._trof(1)]}})
        # Otro móvil recién wipeado sube la vitrina VACÍA (no autoritativo).
        client.post(self.ALV, json={"value": {"updatedAt": 2000, "items": []}})
        assert len(self._items(client, self.ALV)) == 1

    def test_legacy_empty_array_does_not_clobber(self, client):
        client.post(self.ALV, json={"value": {"updatedAt": 1000,
                    "items": [self._trof(1)]}})
        # Cliente VIEJO que aún manda el array crudo vacío.
        client.post(self.ALV, json={"value": []})
        assert len(self._items(client, self.ALV)) == 1

    def test_authoritative_can_clear(self, client):
        client.post(self.ALV, json={"value": {"updatedAt": 1000,
                    "items": [self._trof(1)]}})
        # El admin vacía la vitrina a mano → acción AUTORITATIVA.
        client.post(self.ALV, json={"value": {"updatedAt": 2000, "items": []},
                    "authoritative": True})
        assert self._items(client, self.ALV) == []

    def test_stale_does_not_overwrite_newer(self, client):
        client.post(self.ALV, json={"value": {"updatedAt": 5000,
                    "items": [self._trof(1), self._trof(2)]}})
        # POST stale (reloj viejo) con OTRA lista no pisa la más nueva.
        client.post(self.ALV, json={"value": {"updatedAt": 1000,
                    "items": [self._trof(9)]}})
        items = self._items(client, self.ALV)
        assert len(items) == 2

    def test_newer_overwrites_older(self, client):
        client.post(self.ALV, json={"value": {"updatedAt": 1000,
                    "items": [self._trof(1)]}})
        client.post(self.ALV, json={"value": {"updatedAt": 9000,
                    "items": [self._trof(1), self._trof(2), self._trof(3)]}})
        assert len(self._items(client, self.ALV)) == 3

    def test_legacy_array_with_items_is_accepted(self, client):
        # Un cliente viejo que manda el array crudo (sin sello) se acepta.
        client.post(self.ALV, json={"value": [self._trof(1), self._trof(2)]})
        assert len(self._items(client, self.ALV)) == 2

    def test_hubs_are_independent(self, client):
        client.post(self.ALV, json={"value": {"updatedAt": 1000,
                    "items": [self._trof(1)]}})
        client.post(self.ACSA, json={"value": {"updatedAt": 1000,
                    "items": [self._trof(2), self._trof(3)]}})
        client.post(self.BASE, json={"value": {"updatedAt": 1000,
                    "items": [self._trof(4), self._trof(5), self._trof(6)]}})
        assert len(self._items(client, self.ALV)) == 1
        assert len(self._items(client, self.ACSA)) == 2
        assert len(self._items(client, self.BASE)) == 3


class TestEurManualExtraMerge:
    """Extras manuales del reparto europeo (eur_manual_extra_v1) — UNIÓN
    por (zona, nombre) (bug usuario 2026-07-03: tras el fix de hidratación
    secuencial el pool de Wild Card seguía muy por debajo de 72, el admin
    pidió poder añadir equipos a mano desde varios dispositivos sin que
    uno se coma la adición del otro)."""

    URL = "/api/kv/eur_manual_extra_v1"

    def _zone(self, client, zone):
        v = _json(client.get(self.URL)).get("value") or {}
        return v.get(zone) or []

    def test_first_save_persists(self, client):
        client.post(self.URL, json={"value": {"wildcard": [
            {"name": "Equipo A", "league": "Bulgaria"}], "updatedAt": 1000}})
        assert len(self._zone(client, "wildcard")) == 1

    def test_additions_from_two_devices_are_unioned(self, client):
        # Móvil A añade un equipo a Wild Card.
        client.post(self.URL, json={"value": {"wildcard": [
            {"name": "Equipo A", "league": "Bulgaria"}], "updatedAt": 1000}})
        # Móvil B, que aún no vio la adición de A, añade OTRO equipo distinto
        # (su copia local solo trae el suyo) — un merge por recencia pura
        # perdería "Equipo A" porque el blob de B no lo incluye.
        client.post(self.URL, json={"value": {"wildcard": [
            {"name": "Equipo B", "league": "Albania"}], "updatedAt": 2000}})
        names = sorted(t["name"] for t in self._zone(client, "wildcard"))
        assert names == ["Equipo A", "Equipo B"]

    def test_zones_are_independent(self, client):
        client.post(self.URL, json={"value": {
            "wildcard": [{"name": "Equipo A", "league": "Bulgaria"}],
            "uclQual": [{"name": "Equipo C", "league": "Chipre"}],
            "updatedAt": 1000}})
        assert len(self._zone(client, "wildcard")) == 1
        assert len(self._zone(client, "uclQual")) == 1
        assert len(self._zone(client, "ucl")) == 0

    def test_duplicate_name_not_duplicated(self, client):
        client.post(self.URL, json={"value": {"wildcard": [
            {"name": "Equipo A", "league": ""}], "updatedAt": 1000}})
        # Mismo nombre re-enviado con más información (league) — no duplica,
        # y conserva la versión con más datos.
        client.post(self.URL, json={"value": {"wildcard": [
            {"name": "Equipo A", "league": "Bulgaria"}], "updatedAt": 2000}})
        zone = self._zone(client, "wildcard")
        assert len(zone) == 1
        assert zone[0]["league"] == "Bulgaria"

    def test_vaciar_lista_persiste_aunque_otro_dispositivo_la_reenvie_llena(self, client):
        # Bug 2026-07-07 ("quiero un botón para limpiar la lista entera de
        # equipos... que ese borrado se guarde"): sin el tombstone
        # `clearedAt`, la unión aditiva resucitaría al instante los equipos
        # borrados en cuanto CUALQUIER dispositivo (incluso el mismo, con
        # una copia local vieja) reenviara la zona con esos nombres.
        client.post(self.URL, json={"value": {"wildcard": [
            {"name": "Equipo A", "league": "Bulgaria", "addedAt": 1000},
            {"name": "Equipo B", "league": "Albania", "addedAt": 1000},
        ], "updatedAt": 1000}})
        assert len(self._zone(client, "wildcard")) == 2
        # El admin pulsa "🗑 Vaciar lista" — vacía el array y sella clearedAt.
        client.post(self.URL, json={"value": {
            "wildcard": [], "clearedAt": {"wildcard": 2000}, "updatedAt": 2000}})
        assert self._zone(client, "wildcard") == []
        # Otro dispositivo (o el mismo, con una copia local stale) reenvía
        # la zona TAL COMO estaba antes de vaciar — el vaciado debe ganar.
        client.post(self.URL, json={"value": {"wildcard": [
            {"name": "Equipo A", "league": "Bulgaria", "addedAt": 1000},
        ], "updatedAt": 1500}})
        assert self._zone(client, "wildcard") == []

    def test_vaciar_lista_no_bloquea_altas_posteriores(self, client):
        client.post(self.URL, json={"value": {"wildcard": [
            {"name": "Equipo A", "league": "Bulgaria", "addedAt": 1000},
        ], "updatedAt": 1000}})
        client.post(self.URL, json={"value": {
            "wildcard": [], "clearedAt": {"wildcard": 2000}, "updatedAt": 2000}})
        # Un equipo NUEVO añadido DESPUÉS del vaciado (addedAt > clearedAt)
        # sí debe sobrevivir con normalidad.
        client.post(self.URL, json={"value": {"wildcard": [
            {"name": "Equipo C", "league": "Chipre", "addedAt": 3000},
        ], "updatedAt": 3000}})
        names = [t["name"] for t in self._zone(client, "wildcard")]
        assert names == ["Equipo C"]

    def test_vaciar_lista_no_afecta_otras_zonas(self, client):
        client.post(self.URL, json={"value": {
            "wildcard": [{"name": "Equipo A", "league": "Bulgaria", "addedAt": 1000}],
            "uclQual": [{"name": "Equipo C", "league": "Chipre", "addedAt": 1000}],
            "updatedAt": 1000}})
        client.post(self.URL, json={"value": {
            "wildcard": [], "clearedAt": {"wildcard": 2000}, "updatedAt": 2000}})
        assert self._zone(client, "wildcard") == []
        assert len(self._zone(client, "uclQual")) == 1


# ---------------------------------------------------------------------------
# Fusión cross-device de Resto de Ligas (_lx_merge_teams) — bugs 2026-06-11:
# "se duplican equipos", "no se puede añadir estadios", "se borran logos".
# Stdlib pura (no necesita el `client`); solo llama la función de merge.
# ---------------------------------------------------------------------------
class TestLigaExtMerge:
    def _merge(self, old, new):
        return app_module._lx_merge_teams(old, new)

    def _names(self, res):
        return [t.get("name") for t in res.get("teams", [])]

    def test_no_duplica_por_afijo_id_distinto(self):
        # Mismo club re-pegado (id nuevo) con afijo de grafía distinta:
        # "Olympiacos FC" (server) vs "Olympiacos" (entrante). El colapso
        # por nombre canónico afijo-aware debe dejar UNA sola fila.
        old = {"teams": [{"id": "a1", "name": "Olympiacos FC", "updatedAt": 100}]}
        new = {"teams": [{"id": "b2", "name": "Olympiacos", "updatedAt": 200}]}
        res = self._merge(old, new)
        names = self._names(res)
        assert len(names) == 1, names
        # Gana la edición más reciente (entrante, updatedAt 200).
        assert names[0] == "Olympiacos"

    def test_no_duplica_por_acento_y_afijo(self):
        old = {"teams": [{"id": "x", "name": "Atlético Madrid", "updatedAt": 50}]}
        new = {"teams": [{"id": "y", "name": "Atletico Madrid CF", "updatedAt": 10}]}
        res = self._merge(old, new)
        assert len(self._names(res)) == 1, self._names(res)
        # Empate decidido por updatedAt → gana el almacenado (más reciente).
        assert self._names(res)[0] == "Atlético Madrid"

    def test_no_colapsa_clubes_distintos(self):
        # Afijo-stripping NUNCA debe fusionar dos clubes distintos.
        old = {"teams": [{"id": "1", "name": "Real Madrid", "updatedAt": 1}]}
        new = {"teams": [{"id": "2", "name": "Real Sociedad", "updatedAt": 1}]}
        res = self._merge(old, new)
        assert len(self._names(res)) == 2, self._names(res)

    def test_estadio_no_se_pierde_si_ganador_no_lo_trae(self):
        # Una copia con updatedAt MAYOR pero SIN estadio no debe borrar el
        # estadio que otra copia (más vieja) sí puso. (Bug "no se pueden
        # añadir estadios": el ganador por recencia lo machacaba.)
        old = {"teams": [{"id": "z", "name": "PAOK", "stadium": "Toumba", "updatedAt": 100}]}
        new = {"teams": [{"id": "z", "name": "PAOK", "updatedAt": 200}]}
        res = self._merge(old, new)
        assert len(res["teams"]) == 1
        assert res["teams"][0].get("stadium") == "Toumba", res["teams"][0]

    def test_estadio_viaja_entre_grafias_del_mismo_club(self):
        old = {"teams": [{"id": "z", "name": "PAOK FC", "stadium": "Toumba", "updatedAt": 100}]}
        new = {"teams": [{"id": "w", "name": "PAOK", "updatedAt": 200}]}
        res = self._merge(old, new)
        assert len(res["teams"]) == 1
        assert res["teams"][0].get("stadium") == "Toumba", res["teams"][0]

    def test_escudo_no_se_pierde_si_ganador_no_lo_trae(self):
        old = {"teams": [{"id": "z", "name": "AEK", "shield": "data:img", "updatedAt": 100}]}
        new = {"teams": [{"id": "z", "name": "AEK", "updatedAt": 200}]}
        res = self._merge(old, new)
        assert res["teams"][0].get("shield") == "data:img"

    def test_alias_efootball_no_se_pierde_si_ganador_no_lo_trae(self):
        # Bug 2026-07-04: "a mi amigo no le sale la ❓️ pero a mí sí". Una
        # copia con updatedAt MAYOR pero SIN alias no debe borrar el alias
        # que otra copia (más vieja) sí puso — mismo mecanismo que
        # escudo/estadio.
        old = {"teams": [{"id": "z", "name": "Maccabi Tel Aviv",
                           "efootballAlias": "Rosario Central", "updatedAt": 100}]}
        new = {"teams": [{"id": "z", "name": "Maccabi Tel Aviv", "updatedAt": 200}]}
        res = self._merge(old, new)
        assert res["teams"][0].get("efootballAlias") == "Rosario Central", res["teams"][0]

    def test_alias_efootball_viaja_entre_grafias_del_mismo_club(self):
        old = {"teams": [{"id": "z", "name": "Maccabi Tel Aviv FC",
                           "efootballAlias": "Rosario Central", "updatedAt": 100}]}
        new = {"teams": [{"id": "w", "name": "Maccabi Tel Aviv", "updatedAt": 200}]}
        res = self._merge(old, new)
        assert len(res["teams"]) == 1
        assert res["teams"][0].get("efootballAlias") == "Rosario Central", res["teams"][0]

    def test_roster_no_se_pierde_si_ganador_no_lo_trae(self):
        # Espejo de escudo/estadio/alias: un ganador por updatedAt sin
        # plantilla no debe borrar la plantilla real de una copia más vieja.
        old = {"teams": [{"id": "z", "name": "Villarreal",
                           "players": [{"name": "Yeremy Pino"}], "updatedAt": 100}]}
        new = {"teams": [{"id": "z", "name": "Villarreal", "updatedAt": 200}]}
        res = self._merge(old, new)
        assert res["teams"][0].get("players") == [{"name": "Yeremy Pino"}], res["teams"][0]

    def test_roster_generico_nunca_gana_a_real(self):
        # Bug 2026-07-29: "Simular todas las ligas" (bulk) fabricaba un
        # roster placeholder de 30 "Jugador N" para equipos cuyo
        # SQUAD_REGISTRY no resolvió a tiempo, y lo guardaba SIN sello.
        # Si el servidor ya tenía la plantilla REAL (también sin sello, o
        # con un sello MENOR), la genérica NO puede ganar solo por venir
        # en el documento entrante / tener updatedAt mayor.
        real_roster = [{"name": "Kevin De Bruyne"}, {"name": "Erling Haaland"}]
        generic_roster = [{"name": "Jugador " + str(i)} for i in range(1, 31)]
        old = {"teams": [{"id": "1", "name": "Manchester City",
                           "players": real_roster, "updatedAt": 100}]}
        new = {"teams": [{"id": "1", "name": "Manchester City",
                           "players": generic_roster, "updatedAt": 999}]}
        res = self._merge(old, new)
        assert res["teams"][0]["players"] == real_roster, res["teams"][0]["players"]

    def test_roster_generico_se_reemplaza_por_real_de_otra_grafia(self):
        # La plantilla real puede vivir en OTRA versión del mismo club
        # (afijo distinto) presente en el propio POST entrante.
        real_roster = [{"name": "N'Golo Kanté"}]
        generic_roster = [{"name": "Jugador " + str(i)} for i in range(1, 31)]
        old = {"teams": [{"id": "1", "name": "Chelsea",
                           "players": generic_roster, "updatedAt": 500}]}
        new = {"teams": [{"id": "2", "name": "Chelsea FC",
                           "players": real_roster, "updatedAt": 10}]}
        res = self._merge(old, new)
        assert len(res["teams"]) == 1
        assert res["teams"][0]["players"] == real_roster, res["teams"][0]["players"]

    def test_roster_real_no_se_toca_si_ya_gano_la_fusion(self):
        # Caso normal (sin genéricos de por medio): no reintroducir ningún
        # comportamiento nuevo cuando ambas plantillas son reales.
        r1 = [{"name": "Jugador Real Uno"}]
        r2 = [{"name": "Jugador Real Dos"}]
        old = {"teams": [{"id": "1", "name": "Ajax", "players": r1, "updatedAt": 1}]}
        new = {"teams": [{"id": "1", "name": "Ajax", "players": r2, "updatedAt": 2}]}
        res = self._merge(old, new)
        assert res["teams"][0]["players"] == r2

    def test_logo_liga_no_se_borra_por_post_vacio(self):
        # Un dispositivo que nunca puso el logo POSTea config.logo='' →
        # el servidor debe CONSERVAR el logo almacenado (identidad).
        old = {"teams": [{"id": "1", "name": "A", "updatedAt": 1}],
               "config": {"logo": "http://logo.png", "cupLogo": "http://cup.png"}}
        new = {"teams": [{"id": "1", "name": "A", "updatedAt": 2}],
               "config": {"logo": "", "cupLogo": ""}}
        res = self._merge(old, new)
        assert res["config"]["logo"] == "http://logo.png", res["config"]
        assert res["config"]["cupLogo"] == "http://cup.png", res["config"]

    def test_logo_liga_edicion_real_gana(self):
        # Si el entrante trae un logo NUEVO no vacío, ese gana (edición
        # explícita del admin, no se revierte al viejo).
        old = {"teams": [], "config": {"logo": "http://old.png"}}
        new = {"teams": [], "config": {"logo": "http://new.png"}}
        res = self._merge(old, new)
        assert res["config"]["logo"] == "http://new.png"

    # ── Preservación de la CLASIFICACIÓN por recencia (resultsStamp) ──────
    # Bug usuario 2026-06-12: "simulo las ligas una a una y al abrirlas no se
    # guarda". La clasificación se calcula desde `data.results`; un POST/GET
    # stale sin esos resultados los vaciaba en el servidor.
    def test_results_stale_no_machaca_clasificacion_simulada(self):
        # Servidor con la liga ya simulada (resultsStamp fresco). Un POST de
        # otro dispositivo que nunca simuló (results vacío, sin sello) NO debe
        # vaciar la clasificación.
        old = {"teams": [{"id": "1", "name": "A", "updatedAt": 1}],
               "results": [{"h": "1", "a": "2", "gh": 2, "ga": 0}],
               "resultsStamp": 5000}
        new = {"teams": [{"id": "1", "name": "A", "updatedAt": 2}],
               "results": []}
        res = self._merge(old, new)
        assert res["results"] == old["results"], res.get("results")
        assert res["resultsStamp"] == 5000

    def test_results_sim_mas_reciente_gana(self):
        # Una sim con sello MAYOR sí adopta sus resultados (no se revierte a
        # la copia vieja).
        old = {"teams": [{"id": "1", "name": "A"}],
               "results": [{"h": "1", "a": "2", "gh": 1, "ga": 1}],
               "resultsStamp": 1000}
        new = {"teams": [{"id": "1", "name": "A"}],
               "results": [{"h": "1", "a": "2", "gh": 3, "ga": 0}],
               "resultsStamp": 2000}
        res = self._merge(old, new)
        assert res["results"] == new["results"]
        assert res["resultsStamp"] == 2000

    def test_results_reset_deliberado_limpia(self):
        # Un reset (results=[] con sello fresco) SÍ debe vaciar la
        # clasificación almacenada (sello mayor gana).
        old = {"teams": [{"id": "1", "name": "A"}],
               "results": [{"h": "1", "a": "2", "gh": 2, "ga": 0}],
               "resultsStamp": 1000}
        new = {"teams": [{"id": "1", "name": "A"}],
               "results": [], "resultsStamp": 2000}
        res = self._merge(old, new)
        assert res["results"] == []
        assert res["resultsStamp"] == 2000

    # ── EMPTY-GUARD (2026-06-18): seed vacío SIN sello no machaca ──────────
    # Bug usuario "Montenegro e Irlanda del Norte se ponen a cero": son las
    # únicas ligas SEMBRADAS en el cliente; la semilla escribe results=[] sin
    # resultsStamp (sello 0). Si un dispositivo que solo sembró empuja esa
    # semilla y los sellos EMPATAN a 0, el results vacío vaciaba la liga.
    def test_results_seed_vacio_sin_sello_no_machaca_sim_sin_sello(self):
        # Ambos SIN sello (0). El almacenado tiene clasificación simulada, el
        # entrante (seed de otro móvil) viene vacío → se CONSERVA la sim.
        old = {"teams": [{"id": "1", "name": "A"}],
               "results": [{"h": "1", "a": "2", "gh": 2, "ga": 0}]}
        new = {"teams": [{"id": "1", "name": "A"}], "results": []}
        res = self._merge(old, new)
        assert res["results"] == old["results"], res.get("results")

    def test_results_seed_vacio_no_machaca_sim_con_sello(self):
        # El almacenado tiene sello, el seed entrante viene sin sello (0) y
        # vacío → la clasificación simulada se conserva.
        old = {"teams": [{"id": "1", "name": "A"}],
               "results": [{"h": "1", "a": "2", "gh": 3, "ga": 1}],
               "resultsStamp": 7000}
        new = {"teams": [{"id": "1", "name": "A"}], "results": []}
        res = self._merge(old, new)
        assert res["results"] == old["results"]
        assert res["resultsStamp"] == 7000

    def test_results_reset_sin_sello_previo_si_limpia_con_sello_fresco(self):
        # Defensa: un reset legítimo (vacío + sello fresco) SÍ limpia aunque
        # el almacenado no tuviera sello (estrictamente mayor gana).
        old = {"teams": [{"id": "1", "name": "A"}],
               "results": [{"h": "1", "a": "2", "gh": 2, "ga": 0}]}
        new = {"teams": [{"id": "1", "name": "A"}],
               "results": [], "resultsStamp": 1}
        res = self._merge(old, new)
        assert res["results"] == []
        assert res["resultsStamp"] == 1

    def test_results_sim_entrante_no_vacia_gana_siempre(self):
        # Un POST con clasificación (no vacía) y sello igual/mayor adopta sus
        # resultados con normalidad (el empty-guard no estorba al caso real).
        old = {"teams": [{"id": "1", "name": "A"}],
               "results": [{"h": "1", "a": "2", "gh": 1, "ga": 1}],
               "resultsStamp": 100}
        new = {"teams": [{"id": "1", "name": "A"}],
               "results": [{"h": "1", "a": "2", "gh": 4, "ga": 0}],
               "resultsStamp": 100}
        res = self._merge(old, new)
        assert res["results"] == new["results"]


class TestLigaExtAnyEndpoint:
    """`/api/liga-ext-any/<slug>` resuelve main→protected EN EL SERVIDOR,
    para que el picker "AÑADIR POR LIGA" (`_eurPickerLoadLeague`) haga
    UNA sola petición en vez de 2 fetches secuenciales cliente-side."""

    def test_devuelve_main_cuando_tiene_equipos(self, client):
        c = client
        c.post("/api/liga-ext/testliga", json={"data": {
            "teams": [{"id": "1", "name": "A"}, {"id": "2", "name": "B"}],
            "results": [],
        }})
        r = c.get("/api/liga-ext-any/testliga")
        j = r.get_json()
        assert j["ok"] is True
        assert j["source"] == "main"
        assert len(j["data"]["teams"]) == 2

    def test_cae_a_protected_cuando_main_esta_vacio(self, client):
        c = client
        # main vacío (nunca se guardó), protected con clasificación real.
        c.post("/api/liga-ext-protected/testliga2", json={"data": {
            "teams": [{"id": "1", "name": "A"}, {"id": "2", "name": "B"}],
            "results": [{"h": "1", "a": "2", "gh": 1, "ga": 0}],
        }})
        r = c.get("/api/liga-ext-any/testliga2")
        j = r.get_json()
        assert j["ok"] is True
        assert j["source"] == "protected"
        assert len(j["data"]["teams"]) == 2

    def test_sin_datos_en_ningun_lado_no_revienta(self, client):
        c = client
        r = c.get("/api/liga-ext-any/liga-nunca-tocada")
        assert r.status_code == 200
        j = r.get_json()
        assert j["ok"] is True
        assert j["data"]["teams"] == []
        assert j["source"] == "main"


class TestDeadMergedLeagueFiltering:
    """Las 43 ligas menores ya fusionadas en liga-mixta-1..9 (Alemania,
    Chipre, Estonia, Bielorrusia, Gales, Albania, ...) NUNCA deben volver
    a aparecer en `/api/liga-ext` (índice) ni en `/api/liga-ext-bulk`
    (restauración masiva) — aunque sus filas SIGAN en la base de datos
    porque el admin nunca pulsó el botón de borrado permanente.

    Bug (2026-08-10, screenshots usuario "📊 Espacio del navegador" con
    `-backup`/`-snap-<ts>`/`-protected` de decenas de países fusionados):
    la purga local (v1-v9) borraba `localStorage`, pero cualquier
    bulk-restore posterior (se dispara solo, con solo abrir cualquier
    liga real vacía en local) las traía de vuelta desde el servidor
    porque ninguno de los 2 endpoints las filtraba."""

    def test_bulk_no_incluye_liga_muerta(self, client):
        c = client
        c.post("/api/liga-ext/alemania", json={"data": {
            "teams": [{"id": "1", "name": "A"}, {"id": "2", "name": "B"}],
            "results": [],
        }})
        r = c.get("/api/liga-ext-bulk")
        j = r.get_json()
        assert j["ok"] is True
        assert "alemania" not in j["leagues"]

    def test_bulk_no_incluye_protected_de_liga_muerta(self, client):
        c = client
        c.post("/api/liga-ext-protected/albania", json={"data": {
            "teams": [{"id": "1", "name": "X"}, {"id": "2", "name": "Y"}],
            "results": [],
        }})
        r = c.get("/api/liga-ext-bulk")
        j = r.get_json()
        assert "albania" not in j["leagues"]

    def test_bulk_sigue_incluyendo_liga_viva(self, client):
        c = client
        c.post("/api/liga-ext/italia", json={"data": {
            "teams": [{"id": "1", "name": "A"}, {"id": "2", "name": "B"}],
            "results": [],
        }})
        r = c.get("/api/liga-ext-bulk")
        j = r.get_json()
        assert "italia" in j["leagues"]

    def test_indice_no_incluye_liga_muerta(self, client):
        c = client
        c.post("/api/liga-ext/gales", json={"data": {
            "teams": [{"id": "1", "name": "A"}, {"id": "2", "name": "B"}],
            "results": [],
        }})
        r = c.get("/api/liga-ext")
        j = r.get_json()
        slugs = [x["slug"] for x in j["leagues"]]
        assert "gales" not in slugs

    def test_indice_sigue_incluyendo_liga_viva(self, client):
        c = client
        c.post("/api/liga-ext/francia", json={"data": {
            "teams": [{"id": "1", "name": "A"}, {"id": "2", "name": "B"}],
            "results": [],
        }})
        r = c.get("/api/liga-ext")
        j = r.get_json()
        slugs = [x["slug"] for x in j["leagues"]]
        assert "francia" in slugs


class TestTeamIdentityProtectedFallback:
    """/api/team-shield, /api/team-alias y /api/team-squad también miran
    el snapshot `_protected` de cada liga cuando el `main` no trae el
    dato (bug 2026-07-13, «siguen sin salir los escudos/alias/plantilla
    del Maccabi Haifa»): si una escritura concurrente de OTRO dispositivo
    regresó el `main` a una copia más pobre, el escudo/alias/plantilla
    que el admin configuró puede sobrevivir SOLO en `_protected` — antes
    estos 3 endpoints la excluían siempre del escaneo."""

    def test_shield_cae_a_protected_si_main_no_lo_trae(self, client):
        c = client
        c.post("/api/liga-ext-protected/testligax", json={"data": {
            "teams": [{"id": "1", "name": "Maccabi Haifa", "shield": "https://cdn/x.png"}],
            "results": [],
        }})
        c.post("/api/liga-ext/testligax", json={"data": {
            "teams": [{"id": "1", "name": "Maccabi Haifa"}],
            "results": [],
        }})
        r = c.get("/api/team-shield/Maccabi Haifa")
        j = r.get_json()
        assert j["ok"] is True
        assert j["shield"] == "https://cdn/x.png"

    def test_alias_cae_a_protected_si_main_no_lo_trae(self, client):
        c = client
        c.post("/api/liga-ext-protected/testligay", json={"data": {
            "teams": [{"id": "1", "name": "Maccabi Haifa", "efootballAlias": "Rosario AA"}],
            "results": [],
        }})
        c.post("/api/liga-ext/testligay", json={"data": {
            "teams": [{"id": "1", "name": "Maccabi Haifa"}],
            "results": [],
        }})
        r = c.get("/api/team-alias/Maccabi Haifa")
        j = r.get_json()
        assert j["ok"] is True
        assert j["alias"] == "Rosario AA"

    def test_squad_cae_a_protected_si_main_no_lo_trae(self, client):
        c = client
        c.post("/api/liga-ext-protected/testligaz", json={"data": {
            "teams": [{"id": "1", "name": "Maccabi Haifa", "players": [{"name": "Jugador X"}]}],
            "results": [],
        }})
        c.post("/api/liga-ext/testligaz", json={"data": {
            "teams": [{"id": "1", "name": "Maccabi Haifa", "players": []}],
            "results": [],
        }})
        r = c.get("/api/team-squad/Maccabi Haifa")
        j = r.get_json()
        assert j["ok"] is True
        assert j["team"]["players"][0]["name"] == "Jugador X"

    def test_main_gana_sobre_protected_si_ya_lo_trae(self, client):
        c = client
        c.post("/api/liga-ext-protected/testligaw", json={"data": {
            "teams": [{"id": "1", "name": "Maccabi Haifa", "shield": "old.png"}],
            "results": [],
        }})
        c.post("/api/liga-ext/testligaw", json={"data": {
            "teams": [{"id": "1", "name": "Maccabi Haifa", "shield": "new.png"}],
            "results": [],
        }})
        r = c.get("/api/team-shield/Maccabi Haifa")
        j = r.get_json()
        assert j["ok"] is True
        assert j["shield"] == "new.png"

    def test_sin_datos_en_ningun_lado_devuelve_none(self, client):
        c = client
        r = c.get("/api/team-shield/Equipo Que No Existe En Ningun Lado")
        j = r.get_json()
        assert j["ok"] is True
        assert j["shield"] is None
