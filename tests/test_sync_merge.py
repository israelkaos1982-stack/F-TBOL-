"""Tests de fusión multi-dispositivo (sync_merge.py).

Stdlib pura: ejecutar con `python3 tests/test_sync_merge.py` (no requiere
pytest ni Flask). Sale con código !=0 si algo falla.
"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sync_merge import tour_cfg_merge, sel_squad_merge  # noqa: E402

_fails = []


def check(name, cond):
    print(("ok  " if cond else "FAIL") + " · " + name)
    if not cond:
        _fails.append(name)


# ──────────────────────────────────────────────────────────────────
# TORNEOS — unión de resultados (el bug de "Road Copa Asia")
# ──────────────────────────────────────────────────────────────────
def _cfg(results, updated="2026-06-03T10:00:00.000Z", teams=None):
    return {
        "id": "asia",
        "teams": teams if teams is not None else [{"name": "Francia"}, {"name": "Vietnam"}],
        "results": results,
        "updatedAt": updated,
    }


# Móvil A juega M1; móvil B (sin ver M1) juega M2 y guarda DESPUÉS.
old = _cfg({"g0_0_0": {"played": True, "a": 1, "b": 0}}, "2026-06-03T10:00:00.000Z")
new = _cfg({"g0_0_1": {"played": True, "a": 2, "b": 2}}, "2026-06-03T10:05:00.000Z")
m = tour_cfg_merge(json.dumps(old), new)
check("torneo: une resultados de 2 dispositivos (M1 sobrevive)",
      "g0_0_0" in m["results"] and "g0_0_1" in m["results"])
check("torneo: updatedAt = el más reciente", m["updatedAt"] == "2026-06-03T10:05:00.000Z")

# El partido jugado gana al no-jugado para el MISMO matchKey.
old = _cfg({"g0_0_0": {"played": True, "a": 3, "b": 1}})
new = _cfg({"g0_0_0": {"played": False}}, "2026-06-03T11:00:00.000Z")
m = tour_cfg_merge(json.dumps(old), new)
check("torneo: jugado gana a no-jugado (no se pierde el resultado)",
      m["results"]["g0_0_0"].get("played") is True and m["results"]["g0_0_0"].get("a") == 3)

# Entre dos jugados del mismo partido, gana el `ua` más reciente.
old = _cfg({"k": {"played": True, "a": 1, "b": 1, "ua": 100}})
new = _cfg({"k": {"played": True, "a": 2, "b": 0, "ua": 200}}, "2026-06-03T12:00:00.000Z")
m = tour_cfg_merge(json.dumps(old), new)
check("torneo: entre 2 jugados gana el ua mayor", m["results"]["k"]["a"] == 2)

# Un POST stale (más viejo) NO borra el resultado que ya estaba.
old = _cfg({"a1": {"played": True, "a": 1, "b": 0}}, "2026-06-03T13:00:00.000Z")
new = _cfg({}, "2026-06-03T12:00:00.000Z")  # entrante viejo y vacío
m = tour_cfg_merge(json.dumps(old), new)
check("torneo: POST stale/vacío NO borra resultados existentes",
      "a1" in m["results"])

# Re-sorteo (equipos distintos) → gana el documento más reciente, sin
# mezclar resultados de fixtures que ya no existen.
old = _cfg({"x": {"played": True, "a": 1, "b": 0}},
           "2026-06-03T10:00:00.000Z", teams=[{"name": "Francia"}, {"name": "Vietnam"}])
new = _cfg({}, "2026-06-03T14:00:00.000Z",
           teams=[{"name": "Brasil"}, {"name": "Japon"}])
m = tour_cfg_merge(json.dumps(old), new)
check("torneo: re-sorteo (equipos distintos) toma el más reciente",
      _norm := [t["name"] for t in m["teams"]] == ["Brasil", "Japon"] and m["results"] == {})

# Re-sorteo pero el entrante es MÁS VIEJO → se conserva el del servidor
# (anti-stale; mejor que el last-write actual).
old = _cfg({"x": {"played": True, "a": 1, "b": 0}},
           "2026-06-03T15:00:00.000Z", teams=[{"name": "Brasil"}, {"name": "Japon"}])
new = _cfg({}, "2026-06-03T09:00:00.000Z",
           teams=[{"name": "Francia"}, {"name": "Vietnam"}])
m = tour_cfg_merge(json.dumps(old), new)
check("torneo: entrante stale con otro sorteo NO machaca al servidor",
      [t["name"] for t in m["teams"]] == ["Brasil", "Japon"])

# RESET deliberado: el usuario reinicia (results={} + resetAt) → el
# reinicio GANA al anti-wipe (bug "Road Copa América/Asia" 2026-06-04).
old = _cfg({"g0_0_0": {"played": True, "a": 1, "b": 0},
            "g0_0_1": {"played": True, "a": 2, "b": 2}},
           "2026-06-03T10:00:00.000Z")
new = _cfg({}, "2026-06-04T10:00:00.000Z")
new["resetAt"] = 1759000000000
m = tour_cfg_merge(json.dumps(old), new)
check("torneo: RESET deliberado borra los resultados viejos (no resucitan)",
      m["results"] == {} and m.get("resetAt") == 1759000000000)

# Tras el reset, un partido NUEVO se conserva; los viejos (copia stale sin
# resetAt) NO resucitan.
old = _cfg({"g0_0_0": {"played": True, "a": 9, "b": 9}}, "2026-06-04T09:00:00.000Z")
new = _cfg({"g0_0_0": {"played": True, "a": 1, "b": 0}}, "2026-06-04T11:00:00.000Z")
new["resetAt"] = 1759000000000
m = tour_cfg_merge(json.dumps(old), new)
check("torneo: post-reset gana la copia con resetAt (partido nuevo)",
      m["results"]["g0_0_0"]["a"] == 1 and m.get("resetAt") == 1759000000000)

# Copia STALE (con resetAt viejo) tras un reset más reciente del servidor:
# sus partidos no vuelven.
old = _cfg({}, "2026-06-04T11:00:00.000Z")
old["resetAt"] = 1759000000000  # servidor ya reiniciado
new = _cfg({"g0_0_0": {"played": True, "a": 5, "b": 5}}, "2026-06-04T08:00:00.000Z")  # stale sin reset
m = tour_cfg_merge(json.dumps(old), new)
check("torneo: copia stale NO resucita partidos tras un reset del servidor",
      m["results"] == {})

# Sin copia previa en servidor → devuelve el entrante tal cual.
m = tour_cfg_merge(None, _cfg({"k": {"played": True}}))
check("torneo: sin old devuelve el entrante", "k" in m["results"])

# Entrante inválido → se devuelve tal cual (no rompe).
check("torneo: entrante no-dict pasa de largo", tour_cfg_merge("{}", None) is None)


# ──────────────────────────────────────────────────────────────────
# SELECCIONES — unión, nunca borra
# ──────────────────────────────────────────────────────────────────
def _sq(teams):
    return {"teams": teams}


# Móvil A tiene Francia+Brasil; móvil B guarda solo Francia+Argentina.
old = _sq([
    {"name": "Francia", "updatedAt": 100, "players": [1, 2, 3]},
    {"name": "Brasil", "updatedAt": 100, "players": [1]},
])
new = _sq([
    {"name": "Francia", "updatedAt": 200, "players": [1, 2, 3, 4]},
    {"name": "Argentina", "updatedAt": 150, "players": [1, 2]},
])
m = sel_squad_merge(json.dumps(old), new)
names = [t["name"] for t in m["teams"]]
check("selecciones: une las 3 (Brasil NO se borra)",
      set(names) == {"Francia", "Brasil", "Argentina"})
fr = [t for t in m["teams"] if t["name"] == "Francia"][0]
check("selecciones: conflicto → gana updatedAt más reciente (4 jugadores)",
      len(fr["players"]) == 4)

# A igualdad de updatedAt gana la copia más rica.
old = _sq([{"name": "Italia", "updatedAt": 50, "players": [1, 2, 3, 4, 5]}])
new = _sq([{"name": "Italia", "updatedAt": 50, "players": [1]}])
m = sel_squad_merge(json.dumps(old), new)
it = [t for t in m["teams"] if t["name"] == "Italia"][0]
check("selecciones: empate de tiempo → gana la más rica", len(it["players"]) == 5)

# Nombre con tildes/grafía equivalente NO duplica.
old = _sq([{"name": "España", "updatedAt": 100, "players": [1]}])
new = _sq([{"name": "Espana", "updatedAt": 90, "players": [1, 2]}])
m = sel_squad_merge(json.dumps(old), new)
check("selecciones: España/Espana no duplica", len(m["teams"]) == 1)

# Entrante sin teams válido → pasa de largo.
check("selecciones: entrante inválido pasa de largo",
      sel_squad_merge(json.dumps(old), {"teams": "x"}) == {"teams": "x"})


print()
if _fails:
    print("FALLOS:", len(_fails))
    sys.exit(1)
print("TODOS OK")
