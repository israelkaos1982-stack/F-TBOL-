"""Fusiones de sincronización multi-dispositivo (stdlib pura, sin Flask).

Con 6 móviles + PC tocando los MISMOS torneos y plantillas, el patrón
"el último que escribe, gana" del KV store borraba datos: un móvil
jugaba un partido de "Road Copa Asia", otro guardaba el torneo sin ese
partido y lo machacaba. Este módulo fusiona en el servidor para que la
copia guardada sea SIEMPRE la unión (nunca encoge) y converja entre
dispositivos.

Es stdlib pura (solo `json`/`unicodedata`) para poder testearse sin
levantar Flask (ver tests/test_sync_merge.py).

Funciones públicas:
  · tour_cfg_merge(old_json, new_value)  → cfg de torneo (tour_*_v1)
  · sel_squad_merge(old_json, new_value) → plantilla de selecciones

Reglas (espejo de la fusión que ya hace el cliente):
  - Torneos: si los EQUIPOS (mismo sorteo) coinciden, se UNEN los
    `results` por matchKey (un partido jugado en CUALQUIER dispositivo
    sobrevive). En conflicto del mismo partido: gana el jugado sobre el
    no-jugado; si ambos jugados, gana el de `ua` (sello ms) más reciente
    y, a falta de sello, el entrante. Si los equipos DIFIEREN (re-sorteo
    / torneo recreado), gana el documento con `updatedAt` más reciente
    (anti-stale, nunca peor que el last-write actual).
  - Selecciones: unión por nombre canónico; en conflicto gana
    `updatedAt` (ms) más reciente y, a igualdad, la copia más "rica"
    (más jugadores + datos). NUNCA borra una selección.
"""

import json
import unicodedata


# ──────────────────────────────────────────────────────────────────
# Helpers comunes
# ──────────────────────────────────────────────────────────────────
def _loads(raw):
    if isinstance(raw, (dict, list)):
        return raw
    try:
        return json.loads(raw)
    except Exception:
        return None


def _norm_name(raw):
    """Normaliza un nombre para comparar identidad (sin tildes, minúsculas,
    espacios colapsados). Los nombres ya llegan canonicalizados desde el
    cliente (`_selCanon`), así que esta normalización ligera basta para
    casar la misma selección/equipo entre dispositivos."""
    if raw is None:
        return ""
    s = unicodedata.normalize("NFD", str(raw))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return " ".join(s.lower().split())


def _iso(v):
    """updatedAt de torneo: cadena ISO. Comparación lexicográfica válida
    para ISO-8601 con 'Z'. Ausente → '' (lo más antiguo)."""
    return v if isinstance(v, str) else ""


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


# ──────────────────────────────────────────────────────────────────
# Torneos (tour_*_v1)
# ──────────────────────────────────────────────────────────────────
def _teams_sig(cfg):
    """Firma del sorteo = nombres de equipos EN ORDEN. Mismo sorteo en
    dos dispositivos ⇒ misma firma ⇒ fusionamos resultados. Si difiere
    es otro sorteo/recreación ⇒ no se mezclan resultados."""
    teams = cfg.get("teams") if isinstance(cfg, dict) else None
    if not isinstance(teams, list):
        return None
    out = []
    for t in teams:
        if isinstance(t, dict):
            out.append(_norm_name(t.get("name")))
        else:
            out.append(_norm_name(t))
    return tuple(out)


def _result_is_played(r):
    if not isinstance(r, dict):
        return False
    if r.get("played"):
        return True
    for k in ("a", "b", "gh", "ga", "golesLocal", "golesVisitante"):
        if isinstance(r.get(k), (int, float)):
            return True
    return False


def _pick_result(ex, inc):
    """Elige el resultado ganador para un mismo matchKey presente en ambos
    lados. Jugado gana a no-jugado; entre dos jugados gana el `ua` mayor
    y, a falta de sello, el entrante (last-write a nivel de partido)."""
    if not isinstance(inc, dict):
        return ex
    if not isinstance(ex, dict):
        return inc
    ex_p, inc_p = _result_is_played(ex), _result_is_played(inc)
    if inc_p and not ex_p:
        return inc
    if ex_p and not inc_p:
        return ex
    ua_ex, ua_inc = _num(ex.get("ua")), _num(inc.get("ua"))
    if ua_inc >= ua_ex:
        return inc
    return ex


def tour_cfg_merge(old_json, new_value):
    """Fusiona la cfg de un torneo (tour_<id>_v1) entrante con la guardada.

    Devuelve siempre un dict listo para serializar. Es seguro: nunca
    produce un resultado peor que el last-write actual (si no puede
    fusionar, devuelve el entrante)."""
    new_value = _loads(new_value)
    if not isinstance(new_value, dict):
        return new_value
    old = _loads(old_json)
    if not isinstance(old, dict):
        return new_value

    new_sig = _teams_sig(new_value)
    old_sig = _teams_sig(old)

    # Sorteo distinto (re-sorteo / torneo recreado) → gana el documento
    # más reciente por updatedAt. Nunca mezclamos resultados de fixtures
    # que ya no existen.
    if new_sig != old_sig:
        return new_value if _iso(new_value.get("updatedAt")) >= _iso(old.get("updatedAt")) else old

    # Mismo sorteo → UNIÓN de resultados (nadie pierde su partido).
    old_res = old.get("results") if isinstance(old.get("results"), dict) else {}
    new_res = new_value.get("results") if isinstance(new_value.get("results"), dict) else {}
    merged = dict(old_res)
    for mk, r in new_res.items():
        if mk in merged:
            merged[mk] = _pick_result(merged[mk], r)
        else:
            merged[mk] = r

    # Base = el documento más reciente (para cursores/flags/colores), pero
    # con los resultados UNIDOS y el updatedAt máximo.
    new_up, old_up = _iso(new_value.get("updatedAt")), _iso(old.get("updatedAt"))
    base = new_value if new_up >= old_up else old
    out = dict(base)
    out["results"] = merged
    out["updatedAt"] = new_up if new_up >= old_up else old_up
    return out


# ──────────────────────────────────────────────────────────────────
# Plantilla de selecciones (selecciones_squad_v1)
# ──────────────────────────────────────────────────────────────────
def _team_richness(t):
    if not isinstance(t, dict):
        return 0
    pl = len(t.get("players")) if isinstance(t.get("players"), list) else 0
    info = 0
    for k in ("img", "icon", "efootballAlias", "continent"):
        if t.get(k):
            info += 1
    return pl * 10 + info


def sel_squad_merge(old_json, new_value):
    """Fusiona la plantilla de selecciones entrante con la guardada.

    Unión por nombre canónico. NUNCA borra una selección. En conflicto
    gana `updatedAt` (ms) más reciente; a igualdad, la copia más rica.
    Mantiene el orden del dispositivo que guarda (entrante primero) y
    añade al final las que solo están en el servidor."""
    new_value = _loads(new_value)
    if not isinstance(new_value, dict) or not isinstance(new_value.get("teams"), list):
        return new_value
    old = _loads(old_json)
    if not isinstance(old, dict):
        return new_value
    old_teams = old.get("teams") if isinstance(old.get("teams"), list) else []

    order, by_key = [], {}

    def _add(t):
        if not isinstance(t, dict) or not t.get("name"):
            return
        k = _norm_name(t.get("name"))
        if not k:
            return
        if k not in by_key:
            by_key[k] = t
            order.append(k)
            return
        prev = by_key[k]
        tu, pu = _num(t.get("updatedAt")), _num(prev.get("updatedAt"))
        if tu > pu:
            by_key[k] = t
        elif tu == pu and _team_richness(t) > _team_richness(prev):
            by_key[k] = t

    for t in new_value.get("teams"):   # entrante primero (conserva su orden)
        _add(t)
    for t in old_teams:                # selecciones solo-servidor al final
        _add(t)

    out = dict(new_value)
    out["teams"] = [by_key[k] for k in order]
    return out
