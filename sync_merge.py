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
from datetime import datetime


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


def _iso_ms(v):
    """ISO-8601 (`updatedAt`) → epoch en milisegundos (float), comparable con
    `resetAt` (que el cliente sella con `Date.now()`). Ausente/inválido → 0."""
    if not isinstance(v, str) or not v:
        return 0.0
    s = v.strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(s).timestamp() * 1000.0
    except Exception:
        return 0.0


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


def _acta_len(r):
    """Nº de eventos del acta de un resultado (events/acta). 0 si no hay."""
    if not isinstance(r, dict):
        return 0
    for k in ("events", "acta"):
        v = r.get(k)
        if isinstance(v, list):
            return len(v)
    return 0


def _count_played(cfg):
    """Nº de partidos JUGADOS en la cfg de un torneo. Mide el "progreso" para
    arbitrar un re-sorteo (equipos distintos): un cuadro vacío recién sorteado
    nunca debe machacar uno con la fase de grupos ya jugada."""
    res = cfg.get("results") if isinstance(cfg, dict) else None
    if not isinstance(res, dict):
        return 0
    return sum(1 for r in res.values() if _result_is_played(r))


def _score_pair(r):
    """Marcador (local, visitante) de un resultado, o None si no es numérico.
    Tolera las dos convenciones del cliente (a/b y gh/ga)."""
    if not isinstance(r, dict):
        return None
    a, b = r.get("a"), r.get("b")
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return (a, b)
    gh, ga = r.get("gh"), r.get("ga")
    if isinstance(gh, (int, float)) and isinstance(ga, (int, float)):
        return (gh, ga)
    return None


def _acta_trimmed_wins(no_acta, has_acta, ua_field="ua"):
    """¿Gana el lado SIN acta porque es un RECORTE DELIBERADO de un partido
    IA-vs-IA ya completado (obligatorio, 2026-08-16), no una pérdida
    accidental? `trimmedAt` (ms epoch) SOLO lo sella el recorte automático
    de acta — nunca un guardado normal de partida — y únicamente DESPUÉS
    de haber sumado esos goles/tarjetas/MVP a la tabla permanente por
    jugador (`pm_tally_*`). Si `trimmedAt` es posterior (o igual) al sello
    de la copia que todavía trae el acta, el recorte se hizo CON esa
    acta ya vista — su aportación ya vive en la tabla permanente, así que
    resucitar el acta aquí no recupera nada, solo vuelve a inflar el
    almacenamiento. Sin `trimmedAt` (todo partido guardado hasta ahora),
    esta función es un no-op y el comportamiento previo (el acta SIEMPRE
    gana) queda intacto."""
    if not isinstance(no_acta, dict):
        return False
    trimmed_at = _num(no_acta.get("trimmedAt"))
    if trimmed_at <= 0:
        return False
    if not isinstance(has_acta, dict):
        return True
    other_ts = _num(has_acta.get(ua_field))
    if other_ts <= 0:
        other_ts = _iso_ms(has_acta.get("updatedAt"))
    return trimmed_at >= other_ts


def _pick_result(ex, inc):
    """Elige el resultado ganador para un mismo matchKey presente en ambos
    lados. Jugado gana a no-jugado; entre dos jugados gana el `ua` mayor
    y, a falta de sello, el entrante (last-write a nivel de partido).

    EXCEPCIÓN ANTI-PÉRDIDA DE ACTA (2026-06-06): si ambos tienen el MISMO
    marcador pero una copia trae el acta (`events`/`acta`) y la otra es
    solo-marcador, gana SIEMPRE la que tiene acta — aunque su `ua` sea menor.
    Sin esto, un dispositivo que guardó el partido antes de cargar el motor
    de actas (o que re-guardó solo el marcador) MACHACABA los eventos ya
    generados en otro móvil: el partido sobrevivía (marcador → clasificación
    OK) pero los goleadores/tarjetas/MVP desaparecían y la caja de
    Estadísticas del torneo salía «Sin datos todavía» (bug «Road Copa Asia»,
    fotos usuario 2026-06-06). Un marcador DISTINTO sí decide por `ua` (una
    corrección legítima del resultado no se revierte)."""
    if not isinstance(inc, dict):
        return ex
    if not isinstance(ex, dict):
        return inc
    ex_p, inc_p = _result_is_played(ex), _result_is_played(inc)
    if inc_p and not ex_p:
        return inc
    if ex_p and not inc_p:
        return ex
    # Mismo marcador + solo una copia trae acta → conservar el acta, SALVO
    # que la copia sin acta sea un recorte deliberado posterior (ver
    # `_acta_trimmed_wins`).
    ex_a, inc_a = _acta_len(ex), _acta_len(inc)
    if (ex_a > 0) != (inc_a > 0):
        s_ex, s_inc = _score_pair(ex), _score_pair(inc)
        if s_ex is not None and s_ex == s_inc:
            no_acta, has_acta = (ex, inc) if ex_a == 0 else (inc, ex)
            if _acta_trimmed_wins(no_acta, has_acta):
                return no_acta
            return ex if ex_a > inc_a else inc
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

    # Sorteo distinto (re-sorteo / torneo recreado). No se pueden mezclar
    # resultados de fixtures que ya no existen, así que gana UNA copia entera.
    # PERO un re-sorteo ACCIDENTAL o un cfg STALE con otro orden de equipos
    # NUNCA debe machacar un torneo con partidos ya jugados solo por ser
    # "más nuevo" por reloj de pared (bug 2026-06-25, «Mundial 2032: el 80%
    # de la fase de grupos se borró y salen grupos distintos» — un dispositivo
    # re-sorteó/recreó el cuadro con results={} y, al tener un updatedAt mayor,
    # clobbereó el progreso jugado en los otros 6 dispositivos).
    #
    # El re-sorteo DELIBERADO sella `resetAt` (Date.now()): ESE sello —no la
    # hora de pared— es lo que autoriza a descartar el progreso anterior. Sin
    # sello, gana la copia con MÁS partidos jugados; así un cuadro vacío sin
    # `resetAt` no borra nada y cualquier dispositivo que aún conserve el
    # torneo lo CURA en el servidor al re-sincronizar (recuperación automática).
    if new_sig != old_sig:
        new_reset = _num(new_value.get("resetAt"))
        old_reset = _num(old.get("resetAt"))
        if new_reset != old_reset:
            return new_value if new_reset > old_reset else old
        new_pl = _count_played(new_value)
        old_pl = _count_played(old)
        if new_pl != old_pl:
            return new_value if new_pl > old_pl else old
        # Empate de progreso (ambos vacíos / ambos iguales) → last-write por
        # updatedAt, como antes (no hay nada que proteger).
        return new_value if _iso(new_value.get("updatedAt")) >= _iso(old.get("updatedAt")) else old

    # Reinicio deliberado (tombstone con sello ms). El usuario que pulsa
    # "RESET" del torneo sella `resetAt = Date.now()` y sube results={}.
    # El reinicio DEBE ganar al anti-wipe: si no, la unión devolvía los
    # resultados viejos y el torneo "no se reiniciaba" (bug 2026-06-04,
    # "Road Copa América/Asia").
    new_reset = _num(new_value.get("resetAt"))
    old_reset = _num(old.get("resetAt"))
    eff_reset = max(new_reset, old_reset)

    old_res = old.get("results") if isinstance(old.get("results"), dict) else {}
    new_res = new_value.get("results") if isinstance(new_value.get("results"), dict) else {}

    # Momento del reinicio MÁS reciente = `updatedAt` (ms) de la copia que
    # porta el sello `resetAt` máximo (el reset se sella a la vez que el
    # updatedAt, así que ambos marcan "el instante del reinicio").
    new_upd_ms = _iso_ms(new_value.get("updatedAt"))
    old_upd_ms = _iso_ms(old.get("updatedAt"))
    reset_copy_ms = 0.0
    if new_reset >= eff_reset:
        reset_copy_ms = max(reset_copy_ms, new_upd_ms)
    if old_reset >= eff_reset:
        reset_copy_ms = max(reset_copy_ms, old_upd_ms)

    # Una copia aporta sus resultados si:
    #   (a) porta el sello `resetAt` más reciente (o no hubo reset:
    #       eff_reset=0 ⇒ ambas copias lo "portan" ⇒ unión pura), O
    #   (b) NO porta el sello, pero fue modificada DESPUÉS del reinicio
    #       (su `updatedAt` es posterior al de la copia que reinició) ⇒ son
    #       partidos jugados TRAS el reset y NO se pueden perder.
    # Una copia stale ANTERIOR/IGUAL al reinicio sin sello → pre-reset → se
    # descarta (no resucita). Esto arregla la pérdida de la clasificación
    # (bug 2026-06-05, "Ronda Previa 1 a cero"): el guardado normal de
    # partidas NO porta `resetAt`, así que con la regla anterior ("solo si
    # porta el sello") los partidos jugados tras un reset previo se
    # descartaban SIEMPRE en el servidor → la clasificación volvía a 0.
    def _included(side_reset, side_upd_ms):
        if side_reset >= eff_reset:
            return True
        return side_upd_ms > reset_copy_ms

    # Mismo sorteo → UNIÓN de resultados (nadie pierde su partido), salvo
    # los de una copia anterior a un reset más reciente.
    merged = {}
    if _included(old_reset, old_upd_ms):
        merged.update(old_res)
    if _included(new_reset, new_upd_ms):
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
    # Persistimos el sello de reset máximo para que el reinicio converja
    # cross-device (cualquier copia stale futura lo respeta y no resucita).
    if eff_reset > 0:
        out["resetAt"] = int(eff_reset)
    return out


# ──────────────────────────────────────────────────────────────────
# Copa del Rey (copa_state) — unión de resultados que NUNCA pierde el acta
# ──────────────────────────────────────────────────────────────────
def _copa_played(r):
    """¿Cruce de Copa jugado? Acepta el flag `jugado` y el marcador gl/gv."""
    if not isinstance(r, dict):
        return False
    if r.get("jugado") or r.get("winner"):
        return True
    for k in ("gl", "gv", "et_gl", "et_gv"):
        if isinstance(r.get(k), (int, float)):
            return True
    return False


def _copa_score(r):
    """Marcador de un cruce (gl, gv, et_gl, et_gv) para comparar identidad."""
    if not isinstance(r, dict):
        return None
    return (r.get("gl"), r.get("gv"), r.get("et_gl"), r.get("et_gv"))


def _copa_pick_result(ex, inc):
    """Reconciliación de UN cruce `resultados[rondaKey][idx]` de Copa.
    Jugado gana a no-jugado; entre dos jugados con el MISMO marcador la
    copia con acta (`events`) gana aunque sea la "vieja"; en cualquier otro
    caso gana el entrante (last-write del cliente que acaba de recalcular).
    Espejo de `_pick_result` de torneos: el objetivo es que un guardado
    solo-marcador de otro móvil NUNCA borre los goleadores/tarjetas/MVP."""
    if not isinstance(inc, dict):
        return ex
    if not isinstance(ex, dict):
        return inc
    ex_p, inc_p = _copa_played(ex), _copa_played(inc)
    if inc_p and not ex_p:
        return inc
    if ex_p and not inc_p:
        return ex
    ex_a, inc_a = _acta_len(ex), _acta_len(inc)
    if (ex_a > 0) != (inc_a > 0) and _copa_score(ex) == _copa_score(inc):
        no_acta, has_acta = (ex, inc) if ex_a == 0 else (inc, ex)
        if _acta_trimmed_wins(no_acta, has_acta):
            return no_acta
        return ex if ex_a > inc_a else inc
    return inc


def copa_state_merge(old_json, new_value):
    """Fusiona el `copa_state` entrante con el guardado SIN perder el acta de
    ningún cruce ya jugado. Estructura: `resultados[<rondaKey>]` = lista
    indexada por idx de cruces `{gl,gv,events,injuries,summary,winner,...}`.

    - `resultados`: UNIÓN por rondaKey + idx; cada cruce se reconcilia con
      `_copa_pick_result` (jugado gana a no-jugado; a igualdad de marcador,
      la copia con acta gana). Así un POST stale/solo-marcador de otro móvil
      no borra los eventos → la pantalla de Estadísticas de la Copa no se
      vacía (misma clase de bug que «Road Copa Asia», 2026-06-06).
    - Resto de campos (sorteo/clasificados/fase/campeón…): del entrante (es
      el que acaba de recalcular los TBD). Nunca produce algo peor que el
      last-write actual."""
    new_value = _loads(new_value)
    if not isinstance(new_value, dict):
        return new_value
    old = _loads(old_json)
    if not isinstance(old, dict):
        return new_value
    old_res = old.get("resultados") if isinstance(old.get("resultados"), dict) else {}
    new_res = new_value.get("resultados") if isinstance(new_value.get("resultados"), dict) else {}
    merged = {}
    for rk in set(old_res.keys()) | set(new_res.keys()):
        o_list = old_res.get(rk) if isinstance(old_res.get(rk), list) else []
        n_list = new_res.get(rk) if isinstance(new_res.get(rk), list) else []
        n = max(len(o_list), len(n_list))
        out_list = []
        for i in range(n):
            o = o_list[i] if i < len(o_list) else None
            inc = n_list[i] if i < len(n_list) else None
            if o is None:
                out_list.append(inc)
            elif inc is None:
                out_list.append(o)
            else:
                out_list.append(_copa_pick_result(o, inc))
        out_list.extend(n_list[n:])
        merged[rk] = out_list
    out = dict(new_value)
    out["resultados"] = merged
    return out


# ──────────────────────────────────────────────────────────────────
# Fusión GENÉRICA de estados de bracket/fixtures — Recopa, Supercopa de
# España, Supercopa de Europa, Champions/Europa/Conference (fase de
# grupos Y eliminatoria), Previa de Champions (obligatorio, 2026-07-17)
# ──────────────────────────────────────────────────────────────────
# Bug (petición usuario, «Arsenal-Brasil-Álvaro», Mundial 2032): un
# partido jugado y confirmado (acta compartida) desapareció de la
# clasificación — el POST del guardado se perdió en red móvil y una
# hidratación posterior con un `updatedAt` más reciente (de OTRO
# guardado de la MISMA jornada) sustituyó la copia local ENTERA, que
# nunca llegó a tener ese partido. Ese bug ya estaba cubierto para
# `tour_<id>_v1` (torneos: Mundial 2032, Mundialito, Torneos de Verano,
# Rondas Previas/Finales de Selecciones) por `tour_cfg_merge` — pero
# `wprev_state_v1` (Previa Champions), `sc_state_v1` (Supercopa España),
# `usc_state_v1` (Supercopa Europa), `recopa_state_v1`,
# `ucl_ko_state_v1`/`uel_ko_state_v1`/`uecl_ko_state_v1` (fase KO) y
# `ucl_phase_v1`/`uel_phase_v1`/`uecl_phase_v1` (fase de grupos) NO
# tenían NINGÚN merge — viajan como JSON opaco y el servidor los
# sobreescribe enteros en cada POST (ver `merge_dict`, que solo recursa
# en dicts anidados, nunca en un string). El MISMO fallo que ya se
# arregló para Mundial 2032 podía reproducirse en CUALQUIERA de estas
# 10 competiciones, para CUALQUIERA de los 7 misters humanos.
#
# En vez de escribir un merge a medida para cada una de las 10 (7
# esquemas distintos: `sorteo:{ronda:[m,...]}` en Recopa,
# `semis:[m,m], final:m` en Supercopa España/Europa, brackets propios de
# KO europea, fase de grupos con `results{matchKey}`, y la estructura
# compuesta de la Previa con `prelim.ties[].legs[]` + `groups[]` +
# `fixtures[gi][jornada][idx]`), `bracket_state_merge` recorre la
# estructura ESTRUCTURALMENTE: en cualquier punto donde encuentra un
# dict con pinta de "resultado de un partido concreto" (`_looks_like_match`,
# misma señal que `_result_is_played`: `played`/`jugado`, o marcador
# numérico en los campos ya usados en todo el proyecto), decide con el
# MISMO criterio que `_pick_result`/`_copa_pick_result` (jugado > no
# jugado; a igualdad de marcador gana el acta; si no, `ua`/`updatedAt`
# mayor o el entrante). El resto de la estructura (dicts/listas
# "normales": pool, sorteo, clasificados, cursores…) se UNE
# recursivamente sin perder ninguna clave de ningún lado; un escalar
# suelto lo decide el entrante (last-write, igual que el resto del
# proyecto para campos que no son resultado de partido).
def _looks_like_match(d):
    """¿Es `d` un dict que representa el resultado de UN partido
    concreto (y no, p. ej., una fila de clasificación o un equipo)?"""
    if not isinstance(d, dict):
        return False
    if "played" in d or "jugado" in d:
        return True
    for k in ("a", "b", "gh", "ga", "gl", "gv"):
        if isinstance(d.get(k), (int, float)):
            return True
    return False


def _match_is_played(d):
    if not isinstance(d, dict):
        return False
    if d.get("played") or d.get("jugado") or d.get("winner"):
        return True
    for k in ("a", "b", "gh", "ga", "gl", "gv", "etGh", "etGa", "et_gl", "et_gv"):
        if isinstance(d.get(k), (int, float)):
            return True
    return False


def _match_identity(d):
    """Pareja (local, visitante) de un partido, normalizada. `None` si el
    dict no lleva `home`/`away` (nada que comparar → no se puede detectar
    un re-sorteo en esta posición, se trata como compatible)."""
    if not isinstance(d, dict):
        return None
    h, a = d.get("home"), d.get("away")
    if h is None and a is None:
        return None
    return (
        _norm_name(h) if isinstance(h, str) else h,
        _norm_name(a) if isinstance(a, str) else a,
    )


def _pick_match(ex, inc):
    """Reconcilia dos versiones del MISMO slot de un bracket/fixture.
    Espejo de `_pick_result` (torneos) y `_copa_pick_result` (Copa),
    generalizado a cualquier dict de partido detectado estructuralmente.

    ANTI-FRANKENSTEIN: si `home`/`away` difieren entre las dos copias en
    la MISMA posición, NO es el mismo partido — es un re-sorteo/rebuild
    del bracket (p. ej. semis re-generadas tras cambiar el ganador
    previo). En ese caso NO se intenta fusionar: gana el entrante
    (last-write), igual que si esta posición nunca hubiera tenido merge
    — así un re-sorteo que resetea un slot a `played:false` nunca
    resucita el resultado JUGADO del emparejamiento anterior."""
    if not isinstance(inc, dict):
        return ex
    if not isinstance(ex, dict):
        return inc
    ex_id, inc_id = _match_identity(ex), _match_identity(inc)
    if ex_id is not None and inc_id is not None and ex_id != inc_id:
        return inc
    ex_p, inc_p = _match_is_played(ex), _match_is_played(inc)
    if inc_p and not ex_p:
        return inc
    if ex_p and not inc_p:
        return ex
    ex_a, inc_a = _acta_len(ex), _acta_len(inc)
    if (ex_a > 0) != (inc_a > 0):
        no_acta, has_acta = (ex, inc) if ex_a == 0 else (inc, ex)
        if _acta_trimmed_wins(no_acta, has_acta):
            return no_acta
        return ex if ex_a > inc_a else inc
    ua_ex = _num(ex.get("ua") if ex.get("ua") is not None else ex.get("updatedAt"))
    ua_inc = _num(inc.get("ua") if inc.get("ua") is not None else inc.get("updatedAt"))
    if ua_inc >= ua_ex:
        return inc
    return ex


def _bracket_merge_value(old_v, new_v, depth=0):
    if depth > 14:  # tope defensivo — estas estructuras no anidan tanto
        return new_v if new_v is not None else old_v
    if _looks_like_match(new_v) or _looks_like_match(old_v):
        return _pick_match(old_v, new_v)
    if isinstance(new_v, dict) and isinstance(old_v, dict):
        out = dict(old_v)
        for k, v in new_v.items():
            out[k] = _bracket_merge_value(old_v.get(k), v, depth + 1)
        return out
    if isinstance(new_v, list) and isinstance(old_v, list):
        n = max(len(old_v), len(new_v))
        out = []
        for i in range(n):
            ov = old_v[i] if i < len(old_v) else None
            nv = new_v[i] if i < len(new_v) else None
            if ov is None:
                out.append(nv)
            elif nv is None:
                out.append(ov)
            else:
                out.append(_bracket_merge_value(ov, nv, depth + 1))
        return out
    # Escalar / tipos distintos / uno de los dos ausente → entrante gana
    # (last-write), salvo que el entrante sea None y el viejo no (un
    # patch parcial no debe borrar un dato que el viejo sí tenía).
    return new_v if new_v is not None else old_v


def bracket_state_merge(old_json, new_value):
    """Punto de entrada: fusiona el JSON de un estado de bracket/fixtures
    (Recopa/SC/USC/UCL-KO/UEL-KO/UECL-KO/UCL-fase/UEL-fase/UECL-fase/
    Previa Champions) sin perder NINGÚN partido jugado en NINGÚN
    dispositivo. Nunca produce algo peor que el last-write actual: si
    `old_json` no es legible, devuelve `new_value` tal cual."""
    new_value = _loads(new_value)
    if not isinstance(new_value, dict):
        return new_value
    old = _loads(old_json)
    if not isinstance(old, dict):
        return new_value
    return _bracket_merge_value(old, new_value)


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
