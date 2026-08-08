"""Tests del motor de la Previa de Champions (champions_previa.py).

Stdlib pura: ejecutar con `python3 tests/test_champions_previa.py` (no
requiere pytest ni Flask). Sale con código !=0 si algo falla.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from champions_previa import (  # noqa: E402
    RONDA1_OQ_SLOTS, RONDA1_DIRECT_SLOTS, RONDA2_FIXED_SLOTS,
    CHAMPIONS_GROUP_STAGE_TOTAL, EUROPA_GROUP_STAGE_TOTAL,
    compute_standings, resolve_fixed_slot, validate_ronda2_fixed_slots,
    validar_antes_de_enviar, build_ronda1, build_ronda2,
    registrar_ida, registrar_vuelta, registrar_prorroga, registrar_penaltis,
    resolver_eliminatoria, resultados_ronda, perdedores_a_europa_league,
    ganadores_a_champions_league, assert_group_stage_totals,
)

_fails = []


def check(name, cond):
    print(("ok  " if cond else "FAIL") + " · " + name)
    if not cond:
        _fails.append(name)


def _team(name, tid=None):
    return {"id": tid or name, "name": name}


def _pool(n, prefix):
    return [_team("{} {}".format(prefix, i)) for i in range(n)]


# ──────────────────────────────────────────────────────────────────
# compute_standings — mismo criterio que _standingsFromResults (JS)
# ──────────────────────────────────────────────────────────────────
teams = [_team("A"), _team("B"), _team("C")]
results = [
    {"h": "A", "a": "B", "gh": 2, "ga": 0},
    {"h": "C", "a": "A", "gh": 1, "ga": 1},
    {"h": "B", "a": "C", "gh": 0, "ga": 3},
]
st = compute_standings(teams, results)
check("standings: orden por PTS/DG/GF", [s["name"] for s in st] == ["C", "A", "B"])
check("standings: C tiene 4 pts (1V+1E)", st[0]["pts"] == 4)
check("standings: partido con equipo desconocido se ignora",
      compute_standings(teams, [{"h": "A", "a": "ZZZ", "gh": 5, "ga": 0}])[0]["pj"] == 0)


# ──────────────────────────────────────────────────────────────────
# resolve_fixed_slot / validate_ronda2_fixed_slots — validación de
# "faltan datos en esta liga" ANTES de emparejar (réplica de "Enviar
# realidad de cada equipo a su Europa").
# ──────────────────────────────────────────────────────────────────
def _liga_20(slug, seed=0):
    """Liga de 20 equipos con 1 jornada completa, cada equipo con `pj=1`."""
    ts = [_team("{}-{}".format(slug, i), tid=i) for i in range(20)]
    res = []
    for i in range(0, 20, 2):
        res.append({"h": i, "a": i + 1, "gh": (i + seed) % 4, "ga": (i + 1) % 3})
    return {"teams": ts, "results": res}


LIGAS_OK = {slot["slug"]: _liga_20(slot["slug"]) for slot in RONDA2_FIXED_SLOTS}


def provider_full(slug):
    return LIGAS_OK.get(slug)


ok, resolved, missing = validate_ronda2_fixed_slots(provider_full)
check("ronda2 fixed slots: las 12 ligas completas resuelven OK", ok is True)
check("ronda2 fixed slots: resuelve los 12 equipos", len(resolved) == 12)
check("ronda2 fixed slots: sin ligas ausentes", missing == [])

team, miss = resolve_fixed_slot(RONDA2_FIXED_SLOTS[0], lambda slug: None)
check("resolve_fixed_slot: liga sin datos -> None + motivo",
      team is None and miss["motivo"] == "sin datos en este dispositivo")


def provider_missing_one(slug):
    if slug == "portugal":
        return None
    return LIGAS_OK.get(slug)


ok2, resolved2, missing2 = validate_ronda2_fixed_slots(provider_missing_one)
check("ronda2 fixed slots: 1 liga sin datos -> ok=False", ok2 is False)
check("ronda2 fixed slots: reporta EXACTAMENTE la liga que falta",
      len(missing2) == 1 and missing2[0]["slug"] == "portugal")
check("ronda2 fixed slots: las otras 11 SÍ resuelven pese al fallo de 1",
      len(resolved2) == 11)


def provider_empty_league(slug):
    if slug == "belgica":
        return {"teams": [_team("X", 1), _team("Y", 2)], "results": []}
    return LIGAS_OK.get(slug)


ok3, _, missing3 = validate_ronda2_fixed_slots(provider_empty_league)
check("ronda2 fixed slots: liga sin partidos jugados -> falta",
      ok3 is False and missing3[0]["motivo"] == "sin partidos jugados todavía")


# ──────────────────────────────────────────────────────────────────
# validar_antes_de_enviar — NO debe permitir generar cruces si falta
# CUALQUIER dato (pools de Ronda 1 o ligas fijas de Ronda 2).
# ──────────────────────────────────────────────────────────────────
oq_pool = _pool(RONDA1_OQ_SLOTS, "OQ")
direct_pool = _pool(RONDA1_DIRECT_SLOTS, "DIRECT")

ok_send, informe = validar_antes_de_enviar(oq_pool, direct_pool, provider_full)
check("validar_antes_de_enviar: todo completo -> ok=True", ok_send is True)
check("validar_antes_de_enviar: informe sin errores de pool", informe["errores_pools"] == [])

ok_send2, informe2 = validar_antes_de_enviar(oq_pool[:10], direct_pool, provider_full)
check("validar_antes_de_enviar: pool OQ incompleto -> ok=False", ok_send2 is False)
check("validar_antes_de_enviar: reporta el pool incompleto",
      any("Open Qualifier" in e for e in informe2["errores_pools"]))

ok_send3, informe3 = validar_antes_de_enviar(oq_pool, direct_pool, provider_missing_one)
check("validar_antes_de_enviar: liga fija sin datos -> ok=False", ok_send3 is False)
check("validar_antes_de_enviar: informe expone la liga concreta que falta",
      informe3["ligas_sin_datos"][0]["slug"] == "portugal")


# ──────────────────────────────────────────────────────────────────
# build_ronda1 — 12 OQ vs 12 directos, emparejamiento por índice
# (mejor OQ vs peor directo, para repartir nivel).
# ──────────────────────────────────────────────────────────────────
ties1, err1 = build_ronda1(oq_pool, direct_pool)
check("build_ronda1: genera EXACTAMENTE 12 eliminatorias", len(ties1) == 12)
check("build_ronda1: sin errores con pools completos", err1 == [])
check("build_ronda1: empareja mejor-OQ (idx0) con peor-directo (último)",
      ties1[0]["equipo_a"]["name"] == "OQ 0"
      and ties1[0]["equipo_b"]["name"] == "DIRECT {}".format(RONDA1_DIRECT_SLOTS - 1))

ties1_bad, err1_bad = build_ronda1(oq_pool[:11], direct_pool)
check("build_ronda1: pool OQ incompleto reporta error", len(err1_bad) == 1)
check("build_ronda1: cuadro incompleto tiene menos de 12 eliminatorias",
      len(ties1_bad) == 11)


# ──────────────────────────────────────────────────────────────────
# resolver_eliminatoria — criterio de desempate completo.
# ──────────────────────────────────────────────────────────────────
A, B = _team("A"), _team("B")


def _tie():
    from champions_previa import _new_tie
    return _new_tie("t", "ronda1", A, B)


# 1) decide por agregado (sin empate)
t = _tie()
registrar_ida(t, 2, 0)
registrar_vuelta(t, 1, 2)   # agregado A=3 B=2
check("desempate: agregado NO empatado decide sin más criterios",
      t["jugado"] and t["ganador"] == A and t["criterio"] == "global")

# 2) empate global -> gol de visitante vale doble
t = _tie()
registrar_ida(t, 1, 1)      # A local marca 1, B (visitante en ida) marca 1
registrar_vuelta(t, 0, 0)   # B local marca 0, A (visitante en vuelta) marca 0
# agregado 1-1 empatado; fuera_a (vuelta.a)=0, fuera_b (ida.b)=1 -> gana B
check("desempate: agregado empatado decide por gol de visitante (doble)",
      t["jugado"] and t["ganador"] == B and t["criterio"] == "gol_visitante_doble")

# 3) empate global Y empate de visitante -> prórroga
t = _tie()
registrar_ida(t, 1, 0)
registrar_vuelta(t, 0, 1)   # agregado 1-1, fuera_a=0 fuera_b=0 -> sigue empatado
check("desempate: tras ida+vuelta sigue pendiente si falta la prórroga",
      t["jugado"] is False)
registrar_prorroga(t, 1, 0)
check("desempate: la prórroga decide si desempata",
      t["jugado"] and t["ganador"] == A and t["criterio"] == "prorroga")

# 4) empate total incluida la prórroga -> penaltis
t = _tie()
registrar_ida(t, 1, 0)
registrar_vuelta(t, 0, 1)
registrar_prorroga(t, 1, 1)
check("desempate: tras prórroga empatada sigue pendiente sin penaltis",
      t["jugado"] is False)
registrar_penaltis(t, 3, 4)
check("desempate: los penaltis deciden en último término",
      t["jugado"] and t["ganador"] == B and t["criterio"] == "penaltis")

try:
    registrar_penaltis(_tie(), 3, 3)
    check("registrar_penaltis: rechaza un empate en la tanda", False)
except ValueError:
    check("registrar_penaltis: rechaza un empate en la tanda", True)


# ──────────────────────────────────────────────────────────────────
# resultados_ronda + reparto a Europa League / Champions League.
# ──────────────────────────────────────────────────────────────────
ties_full = []
for i in range(12):
    tt = _tie()
    tt["id"] = "r_{}".format(i)
    registrar_ida(tt, 2, 0)
    registrar_vuelta(tt, 0, 0)
    ties_full.append(tt)

ganadores, perdedores, pendientes = resultados_ronda(ties_full)
check("resultados_ronda: 12 ganadores + 12 perdedores, 0 pendientes",
      len(ganadores) == 12 and len(perdedores) == 12 and pendientes == [])

# build_ronda2 con ganadores de Ronda 1 (los 12 de arriba) + los 12 fijos.
ties2, err2 = build_ronda2(ganadores, provider_full)
check("build_ronda2: genera 12 eliminatorias con datos completos",
      len(ties2) == 12 and err2 == [])
check("build_ronda2: cada eliminatoria empareja un ganador R1 con un equipo fijo",
      all(t["equipo_a"] in ganadores for t in ties2))

ties2_missing, err2_missing = build_ronda2(ganadores, provider_missing_one)
check("build_ronda2: liga fija sin datos reduce el cuadro a 11 y reporta error",
      len(ties2_missing) == 11 and len(err2_missing) == 1)

for t in ties2:
    registrar_ida(t, 1, 0)
    registrar_vuelta(t, 0, 0)
gan2, per2, pend2 = resultados_ronda(ties2)
check("ronda2: 12 ganadores, 12 perdedores", len(gan2) == 12 and len(per2) == 12)

europa = perdedores_a_europa_league(perdedores, per2)
champions_previa = ganadores_a_champions_league(gan2)
check("previa: 24 equipos eliminados van a Europa League (12+12)", len(europa) == 24)
check("previa: 12 ganadores de Ronda 2 van a Champions League", len(champions_previa) == 12)

champions_directos = _pool(28, "CL-DIRECT")
europa_directos = _pool(16, "EL-DIRECT")  # 16 directos + 24 de la previa (12+12) = 40
errores_totales = assert_group_stage_totals(
    champions_directos, champions_previa, europa_directos, europa, conference_total=40)
check("totales: Champions 28+12=40, Europa 16+24=40 sin errores",
      errores_totales == [])
check("totales globales declarados coinciden con CHAMPIONS/EUROPA_GROUP_STAGE_TOTAL",
      CHAMPIONS_GROUP_STAGE_TOTAL == 40 and EUROPA_GROUP_STAGE_TOTAL == 40)

errores_mal = assert_group_stage_totals(
    champions_directos, champions_previa[:11], europa_directos, europa, conference_total=39)
check("totales: detecta un reparto mal cuadrado (39 en vez de 40)",
      len(errores_mal) == 2)


print()
if _fails:
    print("FALLOS:", len(_fails))
    sys.exit(1)
print("TODOS OK")
