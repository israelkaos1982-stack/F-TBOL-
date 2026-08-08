"""champions_previa.py — Motor de la Previa de Champions League (Ronda 1 + Ronda 2).

Recalibración estricta del reglamento (36 equipos, 2 rondas eliminatorias
a ida/vuelta) pedida para reemplazar el cruce automático que estaba
generando emparejamientos incorrectos.

Estructura obligatoria del reglamento:

  RONDA 1 — 24 equipos
    12 procedentes del Open Qualifier  vs.  12 clasificados directos vía
    ligas  →  12 eliminatorias a ida y vuelta.
      · Ganadores (12) → pasan a la Ronda 2.
      · Perdedores (12) → eliminados a la Fase de Grupos de Europa League.

  RONDA 2 — 24 equipos
    12 ganadores de la Ronda 1  vs.  12 equipos FIJOS (ver
    `RONDA2_FIXED_SLOTS`)  →  12 eliminatorias a ida y vuelta.
      · Ganadores (12) → Fase de Grupos de Champions League (junto a los
        28 clasificados directos = 40 equipos totales).
      · Perdedores (12) → Fase de Grupos de Europa League (junto a los 12
        perdedores de Ronda 1 = 24 eliminados totales de la previa).

  Participantes totales de la previa: 12 (Open Qualifier) + 12
  (directos de Ronda 1) + 12 (fijos de Ronda 2) = 36.

Criterio de desempate en cada eliminatoria (ida y vuelta):
  1. Marcador global (agregado de las 2 vueltas).
  2. Si el agregado empata → el gol de visitante vale DOBLE.
  3. Si persiste el empate → prórroga de 30 minutos.
  4. Si sigue empatado tras la prórroga → tanda de penaltis.

Este módulo es stdlib pura (sin Flask/SQLAlchemy) para poder testearse
sin levantar el servidor (ver `tests/test_champions_previa.py`, mismo
patrón que `sync_merge.py`). Trabaja con dicts simples (JSON-friendly):
recibe los datos de las ligas ya cargados (equipos + resultados, el
mismo shape que `ligaExt_<slug>` en `app.py`: `{"teams": [...],
"results": [...]}`) y devuelve estructuras listas para persistir.

Integración con el resto del proyecto:
  · `validar_antes_de_enviar(...)` es la réplica backend de "Enviar
    realidad de cada equipo a su Europa" — valida que no falten datos de
    ninguna liga ANTES de ejecutar los emparejamientos automáticos (en
    vez de generar cruces con equipos placeholder en silencio).
  · `build_ronda1` / `build_ronda2` generan los cuadros.
  · `resolver_eliminatoria` aplica el criterio de desempate anterior.
  · `perdedores_a_europa_league` / `ganadores_a_champions_league`
    reparten los equipos a su competición de destino.
"""

import unicodedata


# ──────────────────────────────────────────────────────────────────
# Constantes del reglamento (obligatorias — no hardcodear otros valores
# sin acordarlo explícitamente, ver cabecera del módulo).
# ──────────────────────────────────────────────────────────────────

RONDA1_OQ_SLOTS = 12          # Open Qualifier → Ronda 1
RONDA1_DIRECT_SLOTS = 12      # Clasificados directos vía ligas → Ronda 1
RONDA2_FIXED_COUNT = 12       # Equipos fijos → Ronda 2
PREVIA_TOTAL_PARTICIPANTS = RONDA1_OQ_SLOTS + RONDA1_DIRECT_SLOTS + RONDA2_FIXED_COUNT  # 36

CHAMPIONS_DIRECT_QUALIFIERS = 28   # + 12 ganadores de Ronda 2 = 40
CHAMPIONS_GROUP_STAGE_TOTAL = 40
EUROPA_GROUP_STAGE_TOTAL = 40
CONFERENCE_GROUP_STAGE_TOTAL = 40
PREVIA_ELIMINATED_TOTAL = 24       # 12 (perdedores R1) + 12 (perdedores R2) → Europa League

# Los 12 equipos FIJOS de la Ronda 2 (obligatorio, reglamento explícito).
# `posicion` es 1-indexed (posicion=3 → 3er clasificado de esa liga).
# Los slugs son los mismos que usa el resto del proyecto para
# `ligaExt_<slug>` / `LEAGUE_DEFAULT_NAMES` (misc_body_1.html) — no
# inventar slugs nuevos para estas ligas.
RONDA2_FIXED_SLOTS = [
    {"slug": "p-bajos",        "posicion": 3, "liga": "Países Bajos"},
    {"slug": "portugal",       "posicion": 3, "liga": "Portugal"},
    {"slug": "belgica",        "posicion": 2, "liga": "Bélgica"},
    {"slug": "turquia",        "posicion": 2, "liga": "Turquía"},
    {"slug": "dinamarca",      "posicion": 2, "liga": "Dinamarca"},
    {"slug": "suiza",          "posicion": 2, "liga": "Suiza"},
    {"slug": "escocia",        "posicion": 2, "liga": "Escocia"},
    {"slug": "liga-ea-sports", "posicion": 5, "liga": "España"},
    {"slug": "liga-mixta-1",   "posicion": 4, "liga": "Liga Mixta 1"},
    {"slug": "liga-mixta-2",   "posicion": 4, "liga": "Liga Mixta 2"},
    {"slug": "liga-mixta-3",   "posicion": 4, "liga": "Liga Mixta 3"},
    {"slug": "liga-mixta-4",   "posicion": 4, "liga": "Liga Mixta 4"},
]
assert len(RONDA2_FIXED_SLOTS) == RONDA2_FIXED_COUNT


# ──────────────────────────────────────────────────────────────────
# Clasificación de liga (réplica EXACTA de `_standingsFromResults`,
# misc_body_1.html — mismo criterio de orden: PTS desc, DG desc, GF
# desc, nombre asc) para poder resolver "el 3º de Países Bajos" etc.
# desde los mismos datos {"teams":[...], "results":[...]} que persiste
# `_liga_ext_load` en app.py.
# ──────────────────────────────────────────────────────────────────

def _norm_name(raw):
    s = unicodedata.normalize("NFD", str(raw or ""))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return " ".join(s.lower().split())


def compute_standings(teams, results):
    """Tabla de clasificación a partir de `teams` (lista de dicts con
    `id`/`name`) y `results` (lista de dicts con `h`, `a`, `gh`, `ga`).
    Partidos que referencian un equipo desconocido se ignoran (mismo
    comportamiento que el cliente)."""
    by_id = {}
    for t in (teams or []):
        if not isinstance(t, dict):
            continue
        tid = t.get("id")
        name = t.get("name")
        if tid is None or not name:
            continue
        by_id[tid] = {"id": tid, "name": name, "pts": 0, "pj": 0, "gf": 0, "gc": 0}
    for r in (results or []):
        if not isinstance(r, dict):
            continue
        h = by_id.get(r.get("h"))
        a = by_id.get(r.get("a"))
        if not h or not a:
            continue
        try:
            gh = int(r.get("gh") or 0)
            ga = int(r.get("ga") or 0)
        except (TypeError, ValueError):
            continue
        h["pj"] += 1
        a["pj"] += 1
        h["gf"] += gh
        h["gc"] += ga
        a["gf"] += ga
        a["gc"] += gh
        if gh > ga:
            h["pts"] += 3
        elif gh < ga:
            a["pts"] += 3
        else:
            h["pts"] += 1
            a["pts"] += 1
    rows = list(by_id.values())
    for s in rows:
        s["dg"] = s["gf"] - s["gc"]
    rows.sort(key=lambda s: (-s["pts"], -s["dg"], -s["gf"], _norm_name(s["name"])))
    return rows


# ──────────────────────────────────────────────────────────────────
# Validación de datos ANTES de ejecutar los emparejamientos
# automáticos — réplica backend de "Enviar realidad de cada equipo a
# su Europa". El botón NUNCA debe generar cruces con huecos en
# silencio: si a una liga le falta el dato, se avisa igual que el
# banner ámbar "N liga(s) SIN datos todavía" que ya usa la app.
# ──────────────────────────────────────────────────────────────────

def _missing(slot, motivo):
    return {
        "slug": slot["slug"],
        "liga": slot["liga"],
        "posicion": slot["posicion"],
        "motivo": motivo,
    }


def resolve_fixed_slot(slot, league_data_provider):
    """Resuelve un slot fijo de Ronda 2 contra los datos reales de su
    liga. `league_data_provider(slug)` debe devolver
    `{"teams": [...], "results": [...]}` (o `None`/falsy si esa liga no
    tiene datos en absoluto — el mismo shape que `_liga_ext_load(slug)`
    en app.py).

    Devuelve `(equipo_o_None, missing_o_None)`.
    """
    slug = slot["slug"]
    data = None
    try:
        data = league_data_provider(slug)
    except Exception:
        data = None
    teams = (data or {}).get("teams") if isinstance(data, dict) else None
    if not teams:
        return None, _missing(slot, "sin datos en este dispositivo")
    standings = compute_standings(teams, (data or {}).get("results"))
    pos = slot["posicion"]
    if len(standings) < pos:
        return None, _missing(
            slot, "la liga solo tiene {} equipo(s), se necesita el puesto {}".format(
                len(standings), pos))
    row = standings[pos - 1]
    if row["pj"] == 0:
        return None, _missing(slot, "sin partidos jugados todavía")
    return row, None


def validate_ronda2_fixed_slots(league_data_provider):
    """Valida las 12 ligas fijas de la Ronda 2.

    Devuelve `(ok, resolved, missing)`:
      · `ok`      → True si las 12 se resolvieron.
      · `resolved`→ lista de equipos encontrados (dict con
                     `slug`/`liga`/`posicion` añadidos, más los campos
                     de `compute_standings`).
      · `missing` → lista de dicts (ver `_missing`) para mostrar el
                     mismo aviso ámbar que la app ya usa.
    """
    resolved = []
    missing = []
    for slot in RONDA2_FIXED_SLOTS:
        team, miss = resolve_fixed_slot(slot, league_data_provider)
        if miss:
            missing.append(miss)
        else:
            resolved.append(dict(team, slug=slot["slug"], liga=slot["liga"],
                                  posicion=slot["posicion"]))
    return (len(missing) == 0), resolved, missing


def _validar_pool(pool, nombre, esperado):
    """Valida que `pool` tenga `esperado` equipos reales (dicts con
    `name`). Devuelve `(pool_limpio, errores)` — `pool_limpio` puede
    venir truncado/incompleto si `errores` no está vacío; el caller
    decide si aborta."""
    limpio = [t for t in (pool or []) if isinstance(t, dict) and t.get("name")]
    errores = []
    if len(limpio) < esperado:
        errores.append(
            "{}: solo hay {} equipo(s) válido(s), se necesitan {}".format(
                nombre, len(limpio), esperado))
    return limpio[:esperado], errores


def validar_antes_de_enviar(open_qualifier_pool, direct_pool, league_data_provider):
    """Réplica backend de "Enviar realidad de cada equipo a su Europa"
    para la Previa de Champions: comprueba que NO falten datos antes de
    generar ningún cruce automático.

    Comprueba:
      1. El pool de 12 del Open Qualifier está completo.
      2. El pool de 12 de clasificados directos está completo.
      3. Las 12 ligas de los equipos FIJOS de Ronda 2 tienen datos y el
         puesto exigido existe y ha jugado partidos.

    Devuelve `(ok, informe)`. Si `ok` es False, `build_ronda1`/
    `build_ronda2` NO deben ejecutarse — el caller debe mostrar
    `informe["ligas_sin_datos"]` / `informe["errores_pools"]` al admin,
    igual que el banner ámbar "N liga(s) SIN datos todavía".
    """
    _, err_oq = _validar_pool(open_qualifier_pool, "Open Qualifier", RONDA1_OQ_SLOTS)
    _, err_dir = _validar_pool(direct_pool, "Clasificados directos", RONDA1_DIRECT_SLOTS)
    ok_fixed, resolved_fixed, missing_fixed = validate_ronda2_fixed_slots(league_data_provider)
    errores_pools = err_oq + err_dir
    ok = (len(errores_pools) == 0) and ok_fixed
    informe = {
        "ok": ok,
        "errores_pools": errores_pools,
        "ligas_sin_datos": missing_fixed,
        "equipos_fijos_resueltos": resolved_fixed,
    }
    return ok, informe


# ──────────────────────────────────────────────────────────────────
# Construcción de los cuadros (Ronda 1 / Ronda 2)
# ──────────────────────────────────────────────────────────────────

def _new_tie(tie_id, ronda, equipo_a, equipo_b):
    """`equipo_a` juega la IDA en casa (la VUELTA fuera); `equipo_b` al
    revés. Los goles de cada leg se guardan siempre bajo las claves
    `a`/`b` (el equipo que los marcó), nunca `home`/`away`, para que el
    cálculo del agregado no dependa de quién jugaba en casa esa vuelta."""
    return {
        "id": tie_id,
        "ronda": ronda,
        "equipo_a": equipo_a,
        "equipo_b": equipo_b,
        "ida": None,
        "vuelta": None,
        "prorroga": None,
        "penaltis": None,
        "jugado": False,
        "ganador": None,
        "perdedor": None,
        "criterio": None,
    }


def build_ronda1(open_qualifier_pool, direct_pool):
    """12 equipos del Open Qualifier vs. 12 clasificados directos vía
    ligas → 12 eliminatorias a ida y vuelta.

    Ambos pools deben venir YA ordenados por ranking/clasificación
    (mejor primero) — el emparejamiento es por índice tras invertir el
    segundo pool (mejor del Open Qualifier vs. peor de los directos, y
    así sucesivamente), para repartir el nivel entre las 12
    eliminatorias en vez de agrupar a los favoritos entre sí.

    Devuelve `(ties, errores)`. Si `errores` no está vacío, el cuadro
    puede venir incompleto (menos de 12 eliminatorias) — el caller NO
    debe persistir un cuadro incompleto sin avisar (ver
    `validar_antes_de_enviar`).
    """
    oq, err_oq = _validar_pool(open_qualifier_pool, "Open Qualifier", RONDA1_OQ_SLOTS)
    direct, err_dir = _validar_pool(direct_pool, "Clasificados directos", RONDA1_DIRECT_SLOTS)
    errores = err_oq + err_dir
    direct_debil_a_fuerte = list(reversed(direct))
    n = min(len(oq), len(direct_debil_a_fuerte))
    ties = [
        _new_tie("ronda1_{}".format(i), "ronda1", oq[i], direct_debil_a_fuerte[i])
        for i in range(n)
    ]
    return ties, errores


def build_ronda2(ronda1_winners, league_data_provider):
    """12 ganadores de la Ronda 1 vs. los 12 equipos FIJOS del
    reglamento (`RONDA2_FIXED_SLOTS`, resueltos aquí mismo contra los
    datos reales de cada liga).

    Devuelve `(ties, errores)`. Igual que `build_ronda1`: si `errores`
    no está vacío (falta algún ganador de Ronda 1 o alguna liga fija
    sin datos), el cuadro puede venir incompleto.
    """
    winners, err_w = _validar_pool(ronda1_winners, "Ganadores Ronda 1", RONDA1_OQ_SLOTS)
    ok_fixed, fixed, missing_fixed = validate_ronda2_fixed_slots(league_data_provider)
    errores = list(err_w)
    if not ok_fixed:
        errores.extend(
            "{} ({}): {}".format(m["liga"], m["slug"], m["motivo"]) for m in missing_fixed)
    n = min(len(winners), len(fixed))
    ties = [
        _new_tie("ronda2_{}".format(i), "ronda2", winners[i], fixed[i])
        for i in range(n)
    ]
    return ties, errores


# ──────────────────────────────────────────────────────────────────
# Registro de resultados + criterio de desempate
# ──────────────────────────────────────────────────────────────────

def registrar_ida(tie, goles_a, goles_b):
    tie["ida"] = {"a": int(goles_a), "b": int(goles_b)}
    return resolver_eliminatoria(tie)


def registrar_vuelta(tie, goles_a, goles_b):
    tie["vuelta"] = {"a": int(goles_a), "b": int(goles_b)}
    return resolver_eliminatoria(tie)


def registrar_prorroga(tie, goles_a, goles_b):
    tie["prorroga"] = {"a": int(goles_a), "b": int(goles_b)}
    return resolver_eliminatoria(tie)


def registrar_penaltis(tie, penaltis_a, penaltis_b):
    if int(penaltis_a) == int(penaltis_b):
        raise ValueError("Una tanda de penaltis no puede terminar en empate")
    tie["penaltis"] = {"a": int(penaltis_a), "b": int(penaltis_b)}
    return resolver_eliminatoria(tie)


def resolver_eliminatoria(tie):
    """Aplica el criterio de desempate del reglamento, EN ORDEN:

      1. Marcador global (agregado de ida + vuelta).
      2. Empate global → gol de visitante vale DOBLE (el equipo con más
         goles marcados como visitante en la eliminatoria avanza).
      3. Sigue empatado → prórroga de 30 minutos (se suma al agregado).
      4. Sigue empatado tras la prórroga → tanda de penaltis (decide
         sin posibilidad de empate).

    Es IDEMPOTENTE y se puede llamar en cualquier punto — si no hay
    datos suficientes para decidir todavía, deja `tie["jugado"]=False`
    y no toca `ganador`/`perdedor`. No lanza excepción por datos
    incompletos (solo `registrar_penaltis` valida que no haya empate).
    """
    ida = tie.get("ida")
    vuelta = tie.get("vuelta")
    if not ida or not vuelta:
        return tie

    total_a = ida["a"] + vuelta["a"]
    total_b = ida["b"] + vuelta["b"]

    winner_key = None
    criterio = None

    if total_a != total_b:
        winner_key = "a" if total_a > total_b else "b"
        criterio = "global"
    else:
        # Gol de visitante vale doble: A jugó de visitante en la vuelta,
        # B jugó de visitante en la ida.
        fuera_a = vuelta["a"]
        fuera_b = ida["b"]
        if fuera_a != fuera_b:
            winner_key = "a" if fuera_a > fuera_b else "b"
            criterio = "gol_visitante_doble"
        else:
            prorroga = tie.get("prorroga")
            if not prorroga:
                return tie  # necesita jugarse la prórroga
            pa = total_a + prorroga["a"]
            pb = total_b + prorroga["b"]
            if pa != pb:
                winner_key = "a" if pa > pb else "b"
                criterio = "prorroga"
            else:
                penaltis = tie.get("penaltis")
                if not penaltis:
                    return tie  # necesita tanda de penaltis
                winner_key = "a" if penaltis["a"] > penaltis["b"] else "b"
                criterio = "penaltis"

    tie["jugado"] = True
    tie["criterio"] = criterio
    tie["ganador"] = tie["equipo_a"] if winner_key == "a" else tie["equipo_b"]
    tie["perdedor"] = tie["equipo_b"] if winner_key == "a" else tie["equipo_a"]
    return tie


def resultados_ronda(ties):
    """(ganadores, perdedores, pendientes) de una lista de eliminatorias
    ya resueltas (o parcialmente resueltas)."""
    ganadores, perdedores, pendientes = [], [], []
    for t in ties:
        if t.get("jugado"):
            ganadores.append(t["ganador"])
            perdedores.append(t["perdedor"])
        else:
            pendientes.append(t)
    return ganadores, perdedores, pendientes


# ──────────────────────────────────────────────────────────────────
# Reparto a las fases de grupos de destino
# ──────────────────────────────────────────────────────────────────

def perdedores_a_europa_league(perdedores_ronda1, perdedores_ronda2):
    """Los 24 equipos eliminados de la previa (12 de Ronda 1 + 12 de
    Ronda 2) pasan a la Fase de Grupos de Europa League."""
    return list(perdedores_ronda1) + list(perdedores_ronda2)


def ganadores_a_champions_league(ganadores_ronda2):
    """Los 12 ganadores de la Ronda 2 pasan a la Fase de Grupos de
    Champions League (junto a los 28 clasificados directos = 40)."""
    return list(ganadores_ronda2)


def assert_group_stage_totals(champions_directos, champions_previa,
                               europa_directos, europa_previa,
                               conference_total):
    """Sanity-check de los totales oficiales de cada fase de grupos
    (Champions 40 / Europa League 40 / Conference League 40). Devuelve
    una lista de errores (vacía si todo cuadra) — nunca lanza, para que
    el caller pueda decidir si bloquea el envío o solo avisa."""
    errores = []
    champions_total = len(champions_directos) + len(champions_previa)
    europa_total = len(europa_directos) + len(europa_previa)
    if champions_total != CHAMPIONS_GROUP_STAGE_TOTAL:
        errores.append(
            "Champions League: {} equipos (se esperaban {})".format(
                champions_total, CHAMPIONS_GROUP_STAGE_TOTAL))
    if europa_total != EUROPA_GROUP_STAGE_TOTAL:
        errores.append(
            "Europa League: {} equipos (se esperaban {})".format(
                europa_total, EUROPA_GROUP_STAGE_TOTAL))
    if conference_total != CONFERENCE_GROUP_STAGE_TOTAL:
        errores.append(
            "Conference League: {} equipos (se esperaban {})".format(
                conference_total, CONFERENCE_GROUP_STAGE_TOTAL))
    return errores
