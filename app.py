from flask import Flask, render_template, redirect, url_for, request, jsonify, abort
from flask_sqlalchemy import SQLAlchemy
import random
import os
import json
import unicodedata
from datetime import datetime, timezone

from jugadores_data import jugadores_por_equipo
from logica_liga import calcular_tabla, obtener_resultados_ia

app = Flask(__name__)

basedir = os.path.abspath(os.path.dirname(__file__))
instance_dir = os.path.join(basedir, "instance")
os.makedirs(instance_dir, exist_ok=True)

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + os.path.join(instance_dir, "liga.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

# --- CONFIG ---
equipos_humanos = ["Real Madrid", "FC Barcelona", "Bayern Munich", "Arsenal", "Sporting CP"]

equipos_primera = list(jugadores_por_equipo.keys())
equipos = list(jugadores_por_equipo.keys())

# --- MODELOS ---
class Partido(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    jornada = db.Column(db.Integer)
    local = db.Column(db.String(100))
    visitante = db.Column(db.String(100))
    goles_local = db.Column(db.Integer)
    goles_visitante = db.Column(db.Integer)
    mvp = db.Column(db.String(100))
    porteria_imbatida = db.Column(db.String(100), nullable=True)

class Evento(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    partido_id = db.Column(db.Integer)
    tipo = db.Column(db.String(50))
    equipo = db.Column(db.String(100))
    jugador = db.Column(db.String(100))
    minuto = db.Column(db.Integer, nullable=True)

class GlobalState(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    clave = db.Column(db.String(100), unique=True, nullable=False)
    valor_json = db.Column(db.Text, nullable=False, default="{}")
    updated_at = db.Column(db.String(50), nullable=True)

# --- PROBABILIDADES ---
BASE = {
    "portero": 0.001,
    "defensa": 7.5,
    "medio": 17.5,
    "delantero": 70
}

MULTIGOL = [1, 0.37, 0.22, 0.12, 0.06]

# Penalti: pesos de la fórmula probabilística (Módulo 2)
PENALTY_BASE_WEIGHT = 0.85        # peso del atributo lanzador vs portero
PENALTY_RANDOM_FACTOR = 0.15      # factor de azar máximo
PENALTY_SAVE_PROBABILITY = 0.60   # prob. de parada efectiva cuando falla el penalti
PENALTY_FOUL_CARD_PROBABILITY = 0.30  # prob. de tarjeta al defensor que provoca el penalti
BONUS_LOCAL = 1.10

TEAM_ALIASES = {
    "sevilla fc": "Sevilla",
    "villarreal cf": "Villarreal",
    "valencia cf": "Valencia",
    "getafe cf": "Getafe",
    "elche cf": "Elche",
    "córdoba cf": "Córdoba",
    "levante ud": "Levante",
    "villarreal": "Villarreal",
    "sevilla": "Sevilla",
    "valencia": "Valencia",
    "getafe": "Getafe",
    "elche": "Elche",
    "córdoba": "Córdoba",
    "levante": "Levante",
}

ALIASES_ESCUDOS_RAW = {
    "FC Barcelona": "Barcelona",
    "Barça": "Barcelona",
    "Bayern Munich": "Bayern de Múnich",
    "Atletico de Madrid": "Atlético de Madrid",
    "Sporting CP": "Sporting de Portugal",
}

ESCUDOS = {
    "Real Madrid": "/static/img/escudos-1/spain_real-madrid.football-logos.cc.svg",
    "Barcelona": "/static/img/escudos-1/spain_barcelona.football-logos.cc.svg",
    "Arsenal": "/static/img/escudos-1/england_arsenal.football-logos.cc.svg",
    "Bayern de Múnich": "/static/img/escudos-1/germany_bayern-munchen.football-logos.cc.svg",
    "Villarreal": "/static/img/escudos-1/spain_villarreal.football-logos.cc.svg",
    "Elche": "/static/img/escudos-1/spain_elche.football-logos.cc.svg",
    "Sporting de Portugal": "/static/img/escudos-1/portugal_sporting-cp.football-logos.cc.svg",
    "Atlético de Madrid": "/static/img/escudos-1/spain_atletico-madrid.football-logos.cc.svg",
}

ESCUDO_DEFAULT = "/static/img/escudos-fallback/estepona.svg"


def normalize_team_key(nombre):
    clean = str(nombre or "").strip().lower()
    normalized = unicodedata.normalize("NFD", clean)
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


ALIASES_ESCUDOS = {
    normalize_team_key(alias): canonical
    for alias, canonical in ALIASES_ESCUDOS_RAW.items()
}


def obtener_escudo(nombre):
    clean = str(nombre or "").strip()
    if not clean:
        return ESCUDO_DEFAULT
    canonical = ALIASES_ESCUDOS.get(normalize_team_key(clean), clean)
    return ESCUDOS.get(canonical, ESCUDO_DEFAULT)


def build_escudos_resueltos():
    teams = set(jugadores_por_equipo.keys()) | set(equipos_humanos) | set(ESCUDOS.keys())
    return {team: obtener_escudo(team) for team in sorted(teams)}

# --- ESTADO GLOBAL COMPARTIDO ---
GLOBAL_STATE_KEY = "global_state"

DEFAULT_GLOBAL_STATE = {
    "liga_results": {},
    "segunda_state": {"table": [], "players": []},
    "segunda_teams": [],
    "primera_state": {
        "g1": {"table": [], "players": []},
        "g2": {"table": [], "players": []}
    },
    "primera_teams": {
        "g1": [],
        "g2": []
    },
    "transition_preview": None,
    "segunda_simple_state": {}
}

def utc_now_iso():
    return datetime.now(timezone.utc).isoformat()

def merge_dict(base, incoming):
    if not isinstance(base, dict):
        return incoming
    if not isinstance(incoming, dict):
        return base

    result = dict(base)
    for k, v in incoming.items():
        if k in result and isinstance(result[k], dict) and isinstance(v, dict):
            result[k] = merge_dict(result[k], v)
        else:
            result[k] = v
    return result

def get_or_create_global_state():
    row = GlobalState.query.filter_by(clave=GLOBAL_STATE_KEY).first()
    if not row:
        row = GlobalState(
            clave=GLOBAL_STATE_KEY,
            valor_json=json.dumps(DEFAULT_GLOBAL_STATE, ensure_ascii=False),
            updated_at=utc_now_iso()
        )
        db.session.add(row)
        db.session.commit()
    return row

def load_global_state():
    row = get_or_create_global_state()
    try:
        data = json.loads(row.valor_json or "{}")
    except Exception:
        data = {}

    if not isinstance(data, dict):
        data = {}

    return merge_dict(DEFAULT_GLOBAL_STATE, data)

def save_global_state(new_state):
    row = get_or_create_global_state()
    merged = merge_dict(DEFAULT_GLOBAL_STATE, new_state if isinstance(new_state, dict) else {})
    row.valor_json = json.dumps(merged, ensure_ascii=False)
    row.updated_at = utc_now_iso()
    db.session.commit()
    return merged

# --- FUNCIONES MOTOR ---
def calcular_prob(perfil, local=False, goles_previos=0):
    # Porteros casi nunca marcan: peso fijo 0.001 ignorando su poder de portería
    if perfil["posicion"] == "portero":
        return 0.001

    base = BASE.get(perfil["posicion"], 10)
    prob = base + (perfil["poder"] / 100)

    if local:
        prob *= BONUS_LOCAL

    prob *= MULTIGOL[min(goles_previos, 4)]
    return prob

def resolve_team_name(team_name):
    clean = (team_name or "").strip()
    return TEAM_ALIASES.get(clean.lower(), clean)

def get_team_power(team_name):
    resolved = resolve_team_name(team_name)
    squad = jugadores_por_equipo.get(resolved) or jugadores_por_equipo.get(team_name) or []
    if squad:
        powers = [int(j.get("poder", 70) or 70) for j in squad]
        return max(1, min(100, round(sum(powers) / max(1, len(powers)))))
    return 76

def elegir_goleador(equipo, local=False, conteo=None):
    if conteo is None:
        conteo = {}

    resolved = resolve_team_name(equipo)
    jugadores = jugadores_por_equipo[resolved]
    pesos = []

    for j in jugadores:
        goles_previos = conteo.get(j["nombre"], 0)
        p = calcular_prob(j, local, goles_previos)
        pesos.append(max(p, 0.001))

    elegido = random.choices(jugadores, weights=pesos, k=1)[0]
    return elegido["nombre"]

def simular_goles(equipo, local=False, oponente=None):
    # Aplicar ventaja local directamente al poder del equipo (+10%)
    own_power = get_team_power(equipo) * (1.10 if local else 1.0)
    if oponente:
        opp_power = get_team_power(oponente)
    else:
        opp_candidates = [name for name in jugadores_por_equipo.keys() if name != resolve_team_name(equipo)]
        opp_power = sum(get_team_power(name) for name in opp_candidates[:6]) / max(1, min(len(opp_candidates), 6))
        if not opp_candidates:
            opp_power = 76
    base_prob = own_power / max(1, (own_power + opp_power))

    if base_prob < 0.42:
        pesos = [46, 33, 14, 5, 2, 0]
    elif base_prob < 0.50:
        pesos = [34, 33, 20, 9, 3, 1]
    elif base_prob < 0.58:
        pesos = [24, 32, 25, 13, 5, 1]
    else:
        pesos = [16, 27, 28, 19, 8, 2]

    return random.choices([0, 1, 2, 3, 4, 5], weights=pesos, k=1)[0]

def simular_marcador(local, visitante):
    # PowerLocal = MediaEquipo * 1.10 (ventaja de localía del 10%)
    r_local = get_team_power(local) * 1.10
    r_visit = get_team_power(visitante)
    base_local = r_local / max(1, (r_local + r_visit))
    prob_local = min(0.82, base_local)

    def sample(prob):
        if prob < 0.42:
            pesos = [46, 33, 14, 5, 2, 0]
        elif prob < 0.50:
            pesos = [34, 33, 20, 9, 3, 1]
        elif prob < 0.58:
            pesos = [24, 32, 25, 13, 5, 1]
        else:
            pesos = [16, 27, 28, 19, 8, 2]
        return random.choices([0, 1, 2, 3, 4, 5], weights=pesos, k=1)[0]

    return sample(prob_local), sample(1 - prob_local)

def elegir_mvp(local, visitante, gl, gv, conteo_local, conteo_visitante):
    candidatos = []

    for j, g in conteo_local.items():
        candidatos.append((j, g, local))
    for j, g in conteo_visitante.items():
        candidatos.append((j, g, visitante))

    if candidatos:
        candidatos.sort(key=lambda x: x[1], reverse=True)
        return candidatos[0][0]

    fallback_team = resolve_team_name(local)
    return random.choice(jugadores_por_equipo[fallback_team])["nombre"]

# --- CALENDARIO ---
def generar_calendario(lista):
    temp = lista[:]
    if len(temp) % 2 != 0:
        temp.append("DESCANSA")

    n = len(temp)
    jornadas = []

    for _ in range(n - 1):
        jornada = []
        for i in range(n // 2):
            l, v = temp[i], temp[n - 1 - i]
            if l != "DESCANSA" and v != "DESCANSA":
                jornada.append((l, v))
        jornadas.append(jornada)
        temp.insert(1, temp.pop())

    vuelta = [[(v, l) for l, v in j] for j in jornadas]
    return jornadas + vuelta

calendario = generar_calendario(equipos)

# --- COPA DEL REY ---
COPA_SEEDING = {
    "r1":  ["Albacete BP", "Levante UD", "Real Oviedo", "Deportivo Alavés"],
    "r2_direct":  ["Elche CF", "Córdoba CF", "Getafe CF", "Sevilla FC", "Mallorca", "Valencia CF"],
    "r16_direct": ["Celta de Vigo", "Espanyol", "Rayo Vallecano", "Osasuna", "Girona FC",
                   "Athletic Club", "Real Betis", "Real Sociedad", "Villarreal CF",
                   "Atlético Madrid", "Real Madrid", "FC Barcelona"]
}

def copa_sim_partido(local, visitante, two_leg=False):
    gl, gv = simular_marcador(local, visitante)
    conteo_l, conteo_v = {}, {}
    for _ in range(gl):
        g = elegir_goleador(local, True, conteo_l)
        conteo_l[g] = conteo_l.get(g, 0) + 1
    for _ in range(gv):
        g = elegir_goleador(visitante, False, conteo_v)
        conteo_v[g] = conteo_v.get(g, 0) + 1
    mvp = elegir_mvp(local, visitante, gl, gv, conteo_l, conteo_v)
    et_gl, et_gv, pen_winner, winner = 0, 0, None, None
    if not two_leg and gl == gv:
        et_gl = random.choices([0, 1, 2], weights=[55, 35, 10])[0]
        et_gv = random.choices([0, 1, 2], weights=[55, 35, 10])[0]
        total_l = gl + et_gl
        total_v = gv + et_gv
        if total_l > total_v:
            winner = local
        elif total_v > total_l:
            winner = visitante
        else:
            pen_winner = random.choice([local, visitante])
            winner = pen_winner
    elif not two_leg:
        winner = local if gl > gv else visitante
    return {"gl": gl, "gv": gv, "et_gl": et_gl, "et_gv": et_gv,
            "pen_winner": pen_winner, "winner": winner, "mvp": mvp, "jugado": True}

@app.route("/api/copa/state", methods=["GET"])
def copa_get_state():
    data = load_global_state()
    return jsonify({"ok": True, "copa": data.get("copa_state") or {}})

@app.route("/api/copa/sorteo", methods=["POST"])
def copa_sorteo():
    payload = request.get_json(silent=True) or {}
    ronda = payload.get("ronda")
    data = load_global_state()
    copa = data.get("copa_state") or {"fase": "r1", "sorteo": {}, "resultados": {}, "clasificados": {}}
    sorteo = copa.get("sorteo", {})
    clasificados = copa.get("clasificados", {})
    if ronda == "r1":
        teams = COPA_SEEDING["r1"][:]
        random.shuffle(teams)
    elif ronda == "r2":
        teams = clasificados.get("r1", []) + COPA_SEEDING["r2_direct"][:]
        random.shuffle(teams)
    elif ronda == "r16":
        teams = clasificados.get("r2", []) + COPA_SEEDING["r16_direct"][:]
        random.shuffle(teams)
    elif ronda in ("oct", "cua"):
        prev = {"oct": "r16", "cua": "oct"}[ronda]
        teams = clasificados.get(prev, [])[:]
        random.shuffle(teams)
    elif ronda == "fin":
        teams = clasificados.get("cua", [])
        if len(teams) < 2:
            return jsonify({"ok": False, "error": "No hay 2 finalistas"}), 400
    else:
        return jsonify({"ok": False, "error": "Ronda inválida"}), 400
    if len(teams) % 2 != 0:
        return jsonify({"ok": False, "error": f"Número impar de equipos ({len(teams)})"}), 400
    matches = [{"l": teams[i], "v": teams[i+1]} for i in range(0, len(teams), 2)]
    sorteo[ronda] = matches
    copa["sorteo"] = sorteo
    copa["fase"] = ronda
    data["copa_state"] = copa
    save_global_state(data)
    return jsonify({"ok": True, "matches": matches, "copa": copa})

@app.route("/api/copa/simular_ia", methods=["POST"])
def copa_simular_ia():
    payload = request.get_json(silent=True) or {}
    ronda = payload.get("ronda")
    idx = int(payload.get("idx", 0))
    es_vuelta = payload.get("es_vuelta", False)
    data = load_global_state()
    copa = data.get("copa_state") or {"sorteo": {}, "resultados": {}, "clasificados": {}}
    sorteo_ronda = copa.get("sorteo", {}).get(ronda, [])
    if idx >= len(sorteo_ronda):
        return jsonify({"ok": False, "error": "Partido no encontrado"}), 400
    match = sorteo_ronda[idx]
    local, visitante = match["l"], match["v"]
    resultados = copa.get("resultados", {})
    two_leg = ronda in ("oct", "cua")
    if two_leg:
        key_ida = ronda + "_ida"
        key_vta = ronda + "_vta"
        if not es_vuelta:
            res = copa_sim_partido(local, visitante, two_leg=True)
            if key_ida not in resultados:
                resultados[key_ida] = [None] * len(sorteo_ronda)
            resultados[key_ida][idx] = res
        else:
            res = copa_sim_partido(visitante, local, two_leg=True)
            if key_vta not in resultados:
                resultados[key_vta] = [None] * len(sorteo_ronda)
            resultados[key_vta][idx] = res
            ida = (resultados.get(key_ida) or [None]*len(sorteo_ronda))[idx] or {}
            total_l = ida.get("gl", 0) + res["gv"]
            total_v = ida.get("gv", 0) + res["gl"]
            if total_l > total_v:
                winner = local
            elif total_v > total_l:
                winner = visitante
            else:
                winner = random.choice([local, visitante])
                resultados[key_vta][idx]["pen_winner"] = winner
            resultados[key_vta][idx]["winner"] = winner
    else:
        res = copa_sim_partido(local, visitante, two_leg=False)
        if ronda not in resultados:
            resultados[ronda] = [None] * len(sorteo_ronda)
        resultados[ronda][idx] = res
    copa["resultados"] = resultados
    data["copa_state"] = copa
    save_global_state(data)
    return jsonify({"ok": True, "copa": copa})

@app.route("/api/copa/guardar_resultado", methods=["POST"])
def copa_guardar_resultado():
    payload = request.get_json(silent=True) or {}
    ronda = payload.get("ronda")
    idx = int(payload.get("idx", 0))
    es_vuelta = payload.get("es_vuelta", False)
    gl = int(payload.get("gl", 0))
    gv = int(payload.get("gv", 0))
    et_gl = int(payload.get("et_gl", 0))
    et_gv = int(payload.get("et_gv", 0))
    pen_winner = payload.get("pen_winner")
    pen_score = payload.get("pen_score", "")
    mvp = payload.get("mvp", "")
    events = payload.get("events") or []
    injuries = payload.get("injuries") or []
    summary = payload.get("summary", "")
    team_a = payload.get("team_a", "")
    team_b = payload.get("team_b", "")
    data = load_global_state()
    copa = data.get("copa_state") or {"sorteo": {}, "resultados": {}, "clasificados": {}}
    sorteo_ronda = copa.get("sorteo", {}).get(ronda, [])
    match = sorteo_ronda[idx] if idx < len(sorteo_ronda) else {}
    local_orig, visit_orig = match.get("l", ""), match.get("v", "")
    resultados = copa.get("resultados", {})
    two_leg = ronda in ("oct", "cua")
    res = {"gl": gl, "gv": gv, "et_gl": et_gl, "et_gv": et_gv,
           "pen_winner": pen_winner, "pen_score": pen_score, "mvp": mvp,
           "events": events, "injuries": injuries, "summary": summary,
           "team_a": team_a or local_orig, "team_b": team_b or visit_orig,
           "jugado": True}
    if two_leg:
        key = ronda + ("_vta" if es_vuelta else "_ida")
        if key not in resultados:
            resultados[key] = [None] * len(sorteo_ronda)
        resultados[key][idx] = res
        if es_vuelta:
            key_ida = ronda + "_ida"
            ida = (resultados.get(key_ida) or [None]*len(sorteo_ronda))[idx] or {}
            total_l = ida.get("gl", 0) + gv
            total_v = ida.get("gv", 0) + gl
            if total_l > total_v:
                winner = local_orig
            elif total_v > total_l:
                winner = visit_orig
            else:
                winner = pen_winner or local_orig
            resultados[key][idx]["winner"] = winner
    else:
        total_l = gl + et_gl
        total_v = gv + et_gv
        if total_l > total_v:
            winner = local_orig if not es_vuelta else visit_orig
        elif total_v > total_l:
            winner = visit_orig if not es_vuelta else local_orig
        else:
            winner = pen_winner or local_orig
        res["winner"] = winner
        if ronda not in resultados:
            resultados[ronda] = [None] * len(sorteo_ronda)
        resultados[ronda][idx] = res
    copa["resultados"] = resultados
    data["copa_state"] = copa
    save_global_state(data)
    return jsonify({"ok": True, "copa": copa})

@app.route("/api/copa/clasificar", methods=["POST"])
def copa_clasificar():
    payload = request.get_json(silent=True) or {}
    ronda = payload.get("ronda")
    data = load_global_state()
    copa = data.get("copa_state") or {"sorteo": {}, "resultados": {}, "clasificados": {}}
    resultados = copa.get("resultados", {})
    clasificados = copa.get("clasificados", {})
    two_leg = ronda in ("oct", "cua")
    if two_leg:
        res_list = resultados.get(ronda + "_vta", [])
    else:
        res_list = resultados.get(ronda, [])
    winners = [r.get("winner") for r in (res_list or []) if r and r.get("winner")]
    clasificados[ronda] = winners
    if ronda == "fin" and winners:
        clasificados["campeon"] = winners[0]
    copa["clasificados"] = clasificados
    next_phase = {"r1": "r2", "r2": "r16", "r16": "oct", "oct": "cua", "cua": "fin", "fin": "campeon"}
    copa["fase"] = next_phase.get(ronda, copa.get("fase", "r1"))
    data["copa_state"] = copa
    save_global_state(data)
    return jsonify({"ok": True, "clasificados": winners, "copa": copa})

@app.route("/api/copa/reiniciar", methods=["POST"])
def copa_reiniciar():
    data = load_global_state()
    data["copa_state"] = {"fase": "r1", "sorteo": {}, "resultados": {}, "clasificados": {}}
    save_global_state(data)
    return jsonify({"ok": True})

# --- SIMULACIÓN ---
def _elegir_jugador_campo(equipo, es_local=False):
    """Elige un jugador de campo aleatorio (no portero) ponderado por poder."""
    resolved = resolve_team_name(equipo)
    jugadores = jugadores_por_equipo.get(resolved, [])
    campo = [j for j in jugadores if j.get("posicion") != "portero"]
    if not campo:
        campo = jugadores
    if not campo:
        return "Jugador"
    pesos = [max(1, int(j.get("poder", 70) or 70)) for j in campo]
    return random.choices(campo, weights=pesos, k=1)[0]["nombre"]



# --- MÓDULO DE DISCIPLINA: Modificador de probabilidad tras tarjeta roja ---

# Impacto según el minuto de la expulsión (Módulo 4)
def _modificador_expulsion(minuto):
    """Devuelve el modificador de probabilidad de goles para el equipo con 10 jugadores.

    Basado en el Módulo 4 del documento de arquitectura (rangos semiabiertos [start, end)):
    [00, 30) Crítico:   reducción del 40% → multiplicador 0.60.
    [30, 70) Grave:     reducción del 30% → multiplicador 0.70.
    [70, 90] Defensivo: reducción del 20% → multiplicador 0.80.
    """
    if minuto < 30:
        return 0.60   # 40% de reducción
    elif minuto < 70:
        return 0.70   # 30% de reducción
    else:
        return 0.80   # 20% de reducción


def simular_y_guardar(jornada, local, visitante):
    """Motor de simulación IA vs IA (Módulo 6 del documento de arquitectura).

    Implementa:
    - Módulo 1: Gol estándar, falta, penalti, autogol → Score +1 con equipo correcto.
    - Módulo 2: Flujo de penalti: provocado → probabilidad lanzador vs portero → resultado.
    - Módulo 3: Filtro de expulsiones con bloqueo de ID del jugador (amarilla → doble → roja).
    - Módulo 4: Probabilidades dinámicas tras expulsión según minuto.
    - Módulo 5: Acta cronológica con minuto asignado a cada evento.
    """
    if Partido.query.filter_by(local=local, visitante=visitante).first():
        return

    # ---- Estado interno del partido ----
    # tarjetas: {jugador_nombre: count_amarillas}
    tarjetas = {}
    # expulsados: set de nombres bloqueados
    expulsados = set()
    # modificador de goles para el equipo con 10 hombres (1.0 = sin penalización)
    mod_local = 1.0
    mod_visit = 1.0

    # Acta cronológica: lista de (minuto, tipo, equipo, jugador)
    acta = []

    # ---- Minutos usados para garantizar unicidad cronológica ----
    minutos_usados = set()

    def _minuto_unico(min_base, rango=3):
        """Genera un minuto único dentro de [min_base, min_base+rango]."""
        for delta in range(rango + 1):
            m = min(90, min_base + delta)
            if m not in minutos_usados:
                minutos_usados.add(m)
                return m
        # fallback: permitir duplicado si no hay opción
        return min_base

    def _jugador_disponible(equipo, es_local=False):
        """Elige un jugador de campo que NO esté expulsado."""
        resolved = resolve_team_name(equipo)
        jugadores = jugadores_por_equipo.get(resolved, [])
        campo = [j for j in jugadores
                 if j.get("posicion") != "portero" and j["nombre"] not in expulsados]
        if not campo:
            campo = [j for j in jugadores if j["nombre"] not in expulsados]
        if not campo:
            # Todos expulsados (situación extrema): usa cualquiera
            campo = jugadores_por_equipo.get(resolved, [{"nombre": "Jugador"}])
        pesos = [max(1, int(j.get("poder", 70) or 70)) for j in campo]
        return random.choices(campo, weights=pesos, k=1)[0]["nombre"]

    def _check_status(jugador_nombre):
        """Devuelve False si el jugador está expulsado (Check_Status del Módulo 6)."""
        return jugador_nombre not in expulsados

    def _procesar_tarjeta(equipo, jugador, minuto, tipo_inicial="amarilla"):
        """Módulo 3: lógica de disciplina con bloqueo de ID tras expulsión."""
        nonlocal mod_local, mod_visit

        if not _check_status(jugador):
            return  # ID bloqueado: abortar

        if tipo_inicial == "roja":
            expulsados.add(jugador)
            acta.append((minuto, "roja", equipo, jugador))
        else:
            # Tarjeta amarilla
            tarjetas[jugador] = tarjetas.get(jugador, 0) + 1
            if tarjetas[jugador] >= 2:
                # Doble amarilla → expulsión
                acta.append((minuto, "doble-amarilla", equipo, jugador))
                expulsados.add(jugador)
            else:
                acta.append((minuto, "amarilla", equipo, jugador))
                return  # Solo amarilla, sin expulsión

        # El jugador queda expulsado: actualizar modificadores (Módulo 4)
        mod = _modificador_expulsion(minuto)
        if equipo == local:
            mod_local = min(mod_local, mod)
        else:
            mod_visit = min(mod_visit, mod)

    # ================================================================
    # Módulo 1+4: Simular goles con modificador dinámico
    # ================================================================
    gl_base = simular_goles(local, True, oponente=visitante)
    gv_base = simular_goles(visitante, False, oponente=local)

    # Los modificadores se aplican después de generar las rojas (lógica secuencial).
    # En la práctica la expulsión ocurre durante el partido, por lo que re-simulamos
    # sólo si hubo rojas en la fase de tarjetas, usando los modificadores resultantes.
    # Para preservar la lógica de flujo, primero registramos todos los eventos de
    # goles/penaltis/faltas con su minuto, y luego las tarjetas.

    # ---- Asignar minutos a goles ----
    # Distribuimos los goles del local a lo largo de 90 minutos
    minutos_goles_local = sorted(random.sample(range(1, 91), min(gl_base, 90)))
    minutos_goles_visit = sorted(random.sample(range(1, 91), min(gv_base, 90)))

    conteo_local = {}
    conteo_visitante = {}
    goles_acta_local = 0
    goles_acta_visit = 0

    for minuto in minutos_goles_local:
        g = elegir_goleador(local, True, conteo_local)
        conteo_local[g] = conteo_local.get(g, 0) + 1
        m = _minuto_unico(minuto)
        acta.append((m, "gol", local, g))
        goles_acta_local += 1

    for minuto in minutos_goles_visit:
        g = elegir_goleador(visitante, False, conteo_visitante)
        conteo_visitante[g] = conteo_visitante.get(g, 0) + 1
        m = _minuto_unico(minuto)
        acta.append((m, "gol", visitante, g))
        goles_acta_visit += 1

    # ================================================================
    # Módulo 2: Flujo de penalti (Activación → Resolución → Resultado)
    # ================================================================
    if random.random() < 0.08:
        pen_minuto = _minuto_unico(random.randint(10, 85))
        pen_equipo = random.choice([local, visitante])
        pen_es_local = (pen_equipo == local)
        foul_equipo = visitante if pen_es_local else local

        # Activación: pen-prov (el jugador atacante que provoca la pena máxima)
        pen_jugador = _jugador_disponible(pen_equipo, pen_es_local)
        if _check_status(pen_jugador):
            acta.append((pen_minuto, "pen-prov", pen_equipo, pen_jugador))

            # El defensor que comete la falta puede recibir tarjeta
            foul_jugador = _jugador_disponible(foul_equipo)
            if _check_status(foul_jugador):
                m_foul = _minuto_unico(pen_minuto)
                if random.random() < PENALTY_FOUL_CARD_PROBABILITY:
                    _procesar_tarjeta(foul_equipo, foul_jugador, m_foul)
                else:
                    acta.append((m_foul, "pen-prov", foul_equipo, foul_jugador))

            # Resolución: atributo del lanzador vs reflejos del portero + azar
            resolved_foul = resolve_team_name(foul_equipo)
            gks = [j for j in jugadores_por_equipo.get(resolved_foul, [])
                   if j.get("posicion") == "portero"]
            gk_poder = gks[0].get("poder", 80) if gks else 80
            pen_poder = next(
                (j.get("poder", 80) for j in jugadores_por_equipo.get(
                    resolve_team_name(pen_equipo), []) if j["nombre"] == pen_jugador),
                80
            )
            # Probabilidad de gol: lanzador vs portero, con factor azar
            prob_gol_pen = (pen_poder / (pen_poder + gk_poder)) * PENALTY_BASE_WEIGHT + random.uniform(0, PENALTY_RANDOM_FACTOR)
            if prob_gol_pen > 0.50:
                # Penalti convertido → el portero no para (no se añade pen-parado)
                acta.append((_minuto_unico(pen_minuto), "pen-gol", pen_equipo, pen_jugador))
                if pen_equipo == local:
                    goles_acta_local += 1
                else:
                    goles_acta_visit += 1
            else:
                # Penalti fallado: parada efectiva o fuera
                if gks and random.random() < PENALTY_SAVE_PROBABILITY:
                    acta.append((_minuto_unico(pen_minuto), "pen-parado", foul_equipo, gks[0]["nombre"]))
                else:
                    acta.append((_minuto_unico(pen_minuto), "pen-fallo", pen_equipo, pen_jugador))

    # ================================================================
    # Gol de falta (5% por partido)
    # ================================================================
    if random.random() < 0.05:
        fk_minuto = _minuto_unico(random.randint(5, 88))
        fk_equipo = random.choice([local, visitante])
        fk_jugador = _jugador_disponible(fk_equipo, fk_equipo == local)
        if _check_status(fk_jugador):
            acta.append((fk_minuto, "falta-gol", fk_equipo, fk_jugador))
            if fk_equipo == local:
                goles_acta_local += 1
            else:
                goles_acta_visit += 1

    # ================================================================
    # Módulo 1: Autogol (1% por partido) → suma al equipo CONTRARIO
    # ================================================================
    if random.random() < 0.01:
        og_minuto = _minuto_unico(random.randint(5, 88))
        og_equipo = random.choice([local, visitante])
        og_jugador = _jugador_disponible(og_equipo, og_equipo == local)
        if _check_status(og_jugador):
            acta.append((og_minuto, "propia", og_equipo, og_jugador))
            # El autogol suma al equipo contrario
            if og_equipo == local:
                goles_acta_visit += 1
            else:
                goles_acta_local += 1

    # ================================================================
    # Módulo 3: Tarjetas (2-4 por partido) con lógica de doble amarilla
    # ================================================================
    num_amarillas = random.choices([2, 3, 4], weights=[40, 40, 20])[0]
    for _ in range(num_amarillas):
        am_minuto = _minuto_unico(random.randint(5, 89))
        am_equipo = random.choice([local, visitante])
        am_jugador = _jugador_disponible(am_equipo, am_equipo == local)
        if _check_status(am_jugador):
            _procesar_tarjeta(am_equipo, am_jugador, am_minuto)

    # Roja directa (3% por partido)
    if random.random() < 0.03:
        roja_minuto = _minuto_unico(random.randint(5, 89))
        roja_equipo = random.choice([local, visitante])
        roja_jugador = _jugador_disponible(roja_equipo, roja_equipo == local)
        if _check_status(roja_jugador):
            _procesar_tarjeta(roja_equipo, roja_jugador, roja_minuto, tipo_inicial="roja")

    # ================================================================
    # Módulo 4: Aplicar modificadores dinámicos si hubo expulsiones.
    # El modificador reduce la probabilidad de que el equipo mermado
    # mantenga sus goles (aproximación estocástica de la ventaja numérica).
    # ================================================================
    if mod_local < 1.0 and goles_acta_local > 0:
        if random.random() > mod_local:
            goles_acta_local = max(0, goles_acta_local - 1)
    if mod_visit < 1.0 and goles_acta_visit > 0:
        if random.random() > mod_visit:
            goles_acta_visit = max(0, goles_acta_visit - 1)

    # ================================================================
    # Módulo 5 + 6: Ordenar acta cronológicamente y calcular premios finales
    # ================================================================
    acta.sort(key=lambda x: x[0])

    # Post-proceso: garantizar consistencia cronológica de expulsiones.
    # Si un evento de expulsión tiene un minuto menor que un evento previo
    # del mismo jugador, eliminamos los eventos anteriores incoherentes.
    expulsion_minuto = {}  # jugador → minuto de expulsión
    for minuto, tipo, eq, jug in acta:
        if tipo in ("roja", "doble-amarilla"):
            expulsion_minuto[jug] = minuto

    acta_filtrada = []
    for minuto, tipo, eq, jug in acta:
        if jug in expulsion_minuto and minuto > expulsion_minuto[jug]:
            continue   # evento posterior a la expulsión: descartado
        acta_filtrada.append((minuto, tipo, eq, jug))
    acta = acta_filtrada

    # MVP: jugador con más goles; si empate, el primero de la lista
    mvp = elegir_mvp(local, visitante, goles_acta_local, goles_acta_visit,
                     conteo_local, conteo_visitante)

    # Portería imbatida: equipo cuyo portero no recibió goles
    porteria_imbatida = None
    if goles_acta_visit == 0:
        porteria_imbatida = local
    elif goles_acta_local == 0:
        porteria_imbatida = visitante

    # ================================================================
    # Persistencia en BD
    # ================================================================
    p = Partido(
        jornada=jornada,
        local=local,
        visitante=visitante,
        goles_local=goles_acta_local,
        goles_visitante=goles_acta_visit,
        mvp=mvp,
        porteria_imbatida=porteria_imbatida,
    )
    db.session.add(p)
    db.session.commit()

    for minuto, tipo, eq, jug in acta:
        db.session.add(Evento(
            partido_id=p.id,
            tipo=tipo,
            equipo=eq,
            jugador=jug,
            minuto=minuto,
        ))
    db.session.commit()


# --- API ESTADO COMPARTIDO ---
@app.route("/api/state", methods=["GET"])
def api_get_state():
    data = load_global_state()
    return jsonify({
        "ok": True,
        "state": data
    })

@app.route("/api/state", methods=["POST"])
def api_save_state():
    payload = request.get_json(silent=True) or {}
    incoming_state = payload.get("state", payload)

    if not isinstance(incoming_state, dict):
        return jsonify({"ok": False, "error": "Estado no válido"}), 400

    saved = save_global_state(incoming_state)
    return jsonify({
        "ok": True,
        "state": saved
    })


@app.context_processor
def inject_shield_data():
    return {
        "escudos_resueltos": build_escudos_resueltos(),
        "escudos_aliases": ALIASES_ESCUDOS_RAW,
        "escudo_default": ESCUDO_DEFAULT,
    }

# --- RUTAS ---
@app.route("/")
def inicio():
    return render_template("index.html")

@app.route("/calendario")
def calendario_view():
    return redirect("/espana/liga-ea-sports/clasificacion", code=302)

@app.route("/clasificacion")
def clasificacion():
    return render_template("index.html")

@app.route("/reiniciar")
def reiniciar():
    Evento.query.delete()
    Partido.query.delete()
    save_global_state(DEFAULT_GLOBAL_STATE)
    db.session.commit()
    return redirect(url_for("clasificacion"))

@app.route("/<path:path>")
def spa_fallback(path):
    if path.startswith("api/"):
        abort(404)
    return render_template("index.html")

with app.app_context():
    db.create_all()
    get_or_create_global_state()

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
