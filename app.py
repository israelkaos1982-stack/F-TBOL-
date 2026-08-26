from flask import Flask, render_template, redirect, url_for, request, jsonify, abort, session, make_response
from flask_sqlalchemy import SQLAlchemy
from flask_compress import Compress
import random
import os
import time
import json
import re
import unicodedata
import uuid
import socket
import ipaddress
import html as html_lib
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, timezone
from functools import wraps

from jinja2 import FileSystemLoader

from jugadores_data import jugadores_por_equipo
from logica_liga import calcular_tabla, obtener_resultados_ia
from sync_merge import (
    tour_cfg_merge, sel_squad_merge, copa_state_merge, bracket_state_merge,
    _pm_tally_merge,
    _count_played as _tour_count_played,
)
from strip_js_comments import strip_html_js_comments

app = Flask(__name__)

# ── PLANTILLAS SIN COMENTARIOS JS EN EL HTML SERVIDO ───────────────────────
# `misc_body_1.html`/`misc_body_2.html` llevan ~1/3 de su JS en comentarios
# de documentación (el mismo historial que vive en CLAUDE.md, duplicado en
# el propio código y descargado por CADA usuario en CADA carga). Este loader
# quita esos comentarios /* */ del texto fuente de esos DOS partials ANTES
# de que Jinja los compile — nunca toca los archivos en disco, nunca corre
# por request (Jinja cachea la plantilla ya compilada tras la 1ª vez que se
# usa; solo se re-ejecuta si el archivo cambia con auto-reload activo).
# Es 100% seguro: ninguna de las 2 plantillas tiene una etiqueta Jinja
# ({{ }} / {% %}) DENTRO de un <script> — verificado 2026-08-08 — así que
# quitar comentarios del texto fuente jamás puede alterar lo que Jinja
# renderiza. `strip_html_js_comments` además tiene su propio fail-safe: ante
# cualquier duda dentro de UN bloque <script>, deja ESE bloque intacto.
_STRIP_JS_COMMENTS_TEMPLATES = {
    "partials/misc_body_1.html",
    "partials/part2/misc_body_2.html",
}


class _CommentStrippingLoader(FileSystemLoader):
    def get_source(self, environment, template):
        source, filename, uptodate = super().get_source(environment, template)
        if template in _STRIP_JS_COMMENTS_TEMPLATES:
            try:
                source, _stats = strip_html_js_comments(source)
            except Exception:
                pass
        return source, filename, uptodate


app.jinja_env.loader = _CommentStrippingLoader(app.template_folder)

# ── COMPRESIÓN GZIP ────────────────────────────────────────────────────────
# El HTML renderizado (~6.5 MB inline) y los bundles JS/CSS (~900 KB) se
# comprimen automáticamente. En un Samsung S21 FE con datos móviles esto
# reduce la descarga inicial de ~7.5 MB a ~1.4 MB (≈80 % menos).
app.config['COMPRESS_MIMETYPES'] = [
    'text/html',
    'text/css',
    'application/javascript',
    'text/javascript',
    'application/json',
    'image/svg+xml',
    'text/plain',
]
app.config['COMPRESS_LEVEL'] = 6      # equilibrio compresión/CPU
app.config['COMPRESS_MIN_SIZE'] = 860  # no comprimir respuestas < 860 B
Compress(app)

# ── CACHÉ DE ESTÁTICOS VERSIONADOS ────────────────────────────────────────
# Los archivos JS/CSS llevan ?v=X.X → pueden cachearse 30 días.
# Las respuestas de API y el HTML principal ya llevan no-cache explícito;
# este hook no los toca.
@app.after_request
def _static_cache_headers(response):
    path = request.path
    if path.startswith('/static/js/') or path.startswith('/static/css/'):
        response.headers['Cache-Control'] = 'public, max-age=2592000'  # 30 días
        response.headers.pop('Pragma', None)
        response.headers.pop('Expires', None)
    # Imágenes (escudos, logos de competición): son archivos de
    # CONTENIDO FIJO (un escudo no cambia). Sin caché larga se
    # revalidaban en CADA navegación — y pesan ~8 MB en total
    # (escudos SVG de 100-600 KB). Con 30 días el navegador los
    # descarga UNA vez y nunca más, lo que quita el grueso de "la web
    # va lenta al abrir tablas". 2026-06-25. `immutable` evita incluso
    # la petición condicional 304 en navegadores que lo soportan.
    elif path.startswith('/static/img/'):
        response.headers['Cache-Control'] = 'public, max-age=2592000, immutable'
        response.headers.pop('Pragma', None)
        response.headers.pop('Expires', None)
    return response

basedir = os.path.abspath(os.path.dirname(__file__))


def _resolve_data_dir():
    """Devuelve el directorio donde guardamos SQLite + ficheros editables.

    Orden de preferencia:
      1. `LIGA_DATA_DIR` env var → cualquier ruta personalizada.
      2. `RAILWAY_VOLUME_MOUNT_PATH` env var → si el usuario montó un
         Volume en Railway (cualquier ruta), Railway pone esta variable.
      3. `/data` si existe y es escribible (convención Railway/Render).
      4. `instance/` (fallback local + Render con volumen ya mapeado).

    Las primeras 3 opciones permiten que Railway sin Postgres tenga
    persistencia: el usuario monta un Volume (e.g. en /data) y los
    `liga_ext_*` + el calendario sobreviven a deploys/restarts en el
    SQLite del volumen. Sin nada de esto, en Railway el SQLite es
    efímero y los cambios del admin se pierden — el bug histórico que
    el usuario reportaba con la AGENDA y con el editor de plantillas
    de Resto de Ligas (2026-05-02). """
    candidates = []
    env_dir = os.environ.get("LIGA_DATA_DIR", "").strip()
    if env_dir:
        candidates.append(env_dir)
    rwy_vol = os.environ.get("RAILWAY_VOLUME_MOUNT_PATH", "").strip()
    if rwy_vol:
        candidates.append(rwy_vol)
    candidates.append("/data")
    for cand in candidates:
        try:
            os.makedirs(cand, exist_ok=True)
            # Probar escritura — algunas plataformas montan /data como
            # read-only por defecto si el usuario no creó el Volume.
            probe = os.path.join(cand, ".liga_write_probe")
            with open(probe, "w") as f:
                f.write("ok")
            os.remove(probe)
            return cand
        except OSError:
            continue
    fallback = os.path.join(basedir, "instance")
    os.makedirs(fallback, exist_ok=True)
    return fallback


instance_dir = _resolve_data_dir()

# Selección de backend de base de datos:
#
# 1. Si la plataforma inyecta `DATABASE_URL` (Railway con plugin Postgres,
#    Heroku, Fly, etc.) → usarla. Así los datos persisten entre reinicios
#    del contenedor, que es el caso real en Railway donde el disco es
#    efímero por defecto y los SQLite se borran en cada deploy.
# 2. Si no, SQLite en `<instance_dir>/liga.db`. `_resolve_data_dir`
#    intenta montar primero un volumen persistente (Railway Volume,
#    /data, etc.) y solo cae a `instance/` si no hay nada disponible.
#    En desarrollo local y en Render esto es transparente.
#
# Normalización de prefijo: Railway/Heroku envían `postgres://` pero
# SQLAlchemy >= 1.4 requiere `postgresql://`. Sustituimos solo el prefijo.
_db_url = os.environ.get("DATABASE_URL", "").strip()
if _db_url.startswith("postgres://"):
    _db_url = "postgresql://" + _db_url[len("postgres://"):]
if not _db_url:
    _db_url = "sqlite:///" + os.path.join(instance_dir, "liga.db")

# Log diagnóstico al arranque: imprime el backend de almacenamiento
# detectado para que el deployer pueda confirmar en los logs si los
# datos del admin (calendario, plantillas Resto de Ligas, etc.) van a
# sobrevivir a un deploy/restart. Si dice "EPHEMERAL", los cambios
# del admin se perderán en el próximo deploy y hay que mover SQLite a
# un volumen persistente o configurar DATABASE_URL.
def _persistence_diagnostic():
    if _db_url.startswith("postgresql://") or _db_url.startswith("postgres://"):
        return "PERSISTENT (Postgres via DATABASE_URL)"
    if instance_dir.startswith("/data") or os.environ.get("LIGA_DATA_DIR") \
            or os.environ.get("RAILWAY_VOLUME_MOUNT_PATH"):
        return f"PERSISTENT (SQLite at {instance_dir}/liga.db — volumen montado)"
    if os.path.exists(os.path.join(basedir, ".render-volume-marker")):
        return f"PERSISTENT (SQLite at {instance_dir}/liga.db — Render volume)"
    return f"EPHEMERAL (SQLite at {instance_dir}/liga.db — los cambios se PERDERÁN en el próximo deploy/restart). Configura DATABASE_URL (Postgres) o monta un volumen y exporta LIGA_DATA_DIR/RAILWAY_VOLUME_MOUNT_PATH."

try:
    print(f"[ftbol] Persistencia: {_persistence_diagnostic()}", flush=True)
except Exception:
    pass

app.config["SQLALCHEMY_DATABASE_URI"] = _db_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# `secret_key` es obligatoria para que Flask pueda firmar las cookies
# de sesión (y por tanto para que la sesión admin sobreviva entre
# peticiones). Se puede sobreescribir con la env var `SECRET_KEY` en
# producción para que distintos deploys compartan sesiones si hace
# falta (normalmente no hace falta — cada deploy sale con una
# secret_key nueva generada en tiempo de import).
app.secret_key = os.environ.get("SECRET_KEY") or uuid.uuid4().hex
# Postgres en Railway cierra conexiones ociosas al cabo de unos minutos.
# `pool_pre_ping` evita errores "server closed the connection unexpectedly"
# haciendo un ping barato antes de cada consulta; `pool_recycle` recicla
# conexiones cada 5 min para mantenerlas frescas. No afecta a SQLite.
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_pre_ping": True,
    "pool_recycle": 300,
    # Resiliencia del pool (2026-07-23): sin `pool_timeout` una consulta
    # que tarde puede dejar a las demás esperando indefinidamente; con un
    # timeout corto, una petición atascada falla rápido en vez de colgar
    # la pestaña del usuario para siempre ("Comprobando…" eterno). Pool un
    # poco mayor para absorber los 8 hilos de gunicorn (2 workers × 4).
    "pool_size": 10,
    "max_overflow": 20,
    "pool_timeout": 10,
}

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
    "Como 1907": "Como",
    "Como Calcio": "Como",
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
    "Como": "https://commons.wikimedia.org/wiki/Special:FilePath/Como_1907.svg",
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
    "segunda_simple_state": {},
    # competition_state: espejo en servidor de las claves de localStorage
    # que el navegador puede perder (modo incógnito, cache clear, cuota
    # excedida, otro dispositivo). El cliente sincroniza:
    #   - wprev_state_v1            (Previa Champions, 4 rondas — Wild Card
    #                                 y Open Qualifier ANIQUILADOS 2026-08-14)
    #   - wprev_to_fase_grupos_v1   (12 → UCL, Previa R4 ganadores)
    #   - wprev_to_europa_v1        (24 → UEL, Previa R3+R4 perdedores)
    #   - wprev_to_conference_v1    (24 → UECL, Previa R1+R2 perdedores)
    #   - bayern_calendar_comps_v1, bayern_calendar_title_v1, bayern_cal_v2
    #                               (preferencias y eventos del calendario humano)
    #   - sc_state_v1, usc_state_v1
    #                               (Supercopas)
    #   - mundial_state_v1, mundialito_state_v1
    #   - seleccion_state_v1, selecciones_state_v1
    #   - ucl_ko_state_v1, uel_ko_state_v1, uecl_ko_state_v1
    #   - superliga_state_v1, superliga_teams_v1, superliga_calendar_v1,
    #     superliga_results_v1
    #   - partidos_aplazados        (array de aplazamientos)
    # Cada valor es el JSON crudo (string) tal como vive en localStorage.
    # La lista canónica vive en `SYNC_KEYS` de
    # `templates/partials/part2/misc_body_2.html` — añadir nuevas
    # competiciones allí.
    "competition_state": {}
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


# ── Anti-pérdida de acta en resultados de Liga (2026-06-06) ──────────
# `liga_results` (Liga EA Sports) es un dict matchKey→{gh,ga,events,mvp,…}.
# `merge_dict` ya hace UNIÓN a nivel de matchKey (un partido jugado en un
# móvil sobrevive aunque otro no lo tenga), pero a nivel de CAMPO un
# `events:[]` entrante (copia solo-marcador de otro dispositivo) vaciaría
# los goleadores/MVP que la copia base SÍ tenía para el MISMO partido →
# la pantalla de Estadísticas de Liga se quedaría sin datos. Misma clase
# de bug que «Road Copa Asia» (torneos) y Copa. Restauramos el acta desde
# base cuando el merge la perdió y el marcador coincide. Solo AÑADE de
# vuelta, NUNCA borra.
_ACTA_FIELDS = ("events", "scorers", "acta", "mvp", "mvpTeam")


def _acta_present(r):
    if not isinstance(r, dict):
        return False
    for k in ("events", "scorers", "acta"):
        v = r.get(k)
        if isinstance(v, list) and v:
            return True
    return False


def _same_match_score(a, b):
    if not isinstance(a, dict) or not isinstance(b, dict):
        return False
    return (a.get("gh"), a.get("ga"), a.get("et_gl"), a.get("et_gv")) == \
           (b.get("gh"), b.get("ga"), b.get("et_gl"), b.get("et_gv"))


def _preserve_results_acta(base_res, merged_res):
    """Restaura en `merged_res` el acta (events/scorers/mvp) que `base_res`
    tenía para un matchKey y que el merge field-a-field perdió (p.ej. un
    `events:[]` entrante), SIEMPRE que el marcador coincida. Aditivo: nunca
    borra ni cambia un acta ya presente en el merge."""
    if not isinstance(base_res, dict) or not isinstance(merged_res, dict):
        return
    for mk, b in base_res.items():
        if not _acta_present(b):
            continue
        m = merged_res.get(mk)
        if not isinstance(m, dict) or _acta_present(m):
            continue
        if not _same_match_score(b, m):
            continue
        for f in _ACTA_FIELDS:
            if f in b and not m.get(f):
                m[f] = b[f]


# ── Anti-resurrección del recorte de acta IA-vs-IA de Liga (2026-08-17) ──
# El recorte automático de acta (ver CLAUDE.md, "El acta de un partido
# IA-vs-IA ya completado se RECORTA...") sella `trimmedAt` en el partido
# y BORRA `events`/`mvp`/`mvpTeam` — su aportación YA se sumó a la tabla
# permanente `pm_tally_liga_v1` antes de vaciarlo, así que no hay nada
# que perder. El problema: `merge_dict` (usado para `liga_results` dentro
# de `competition_state`) SOLO puede COPIAR claves presentes en el lado
# entrante — nunca puede propagar un BORRADO de campo, porque construye
# `result = dict(base)` y solo sobreescribe las claves que `incoming` SÍ
# trae. Si el dispositivo que acaba de recortar hace POST con
# `{gh,ga,trimmedAt}` (sin `events`), el `result` para ese matchKey sigue
# siendo `dict(base)` con el `events` VIEJO todavía dentro — el recorte
# se resucita en el propio merge, ANTES incluso de que
# `_preserve_results_acta` (que protege el caso CONTRARIO, un borrado
# ACCIDENTAL) tenga ocasión de actuar — de hecho `_preserve_results_acta`
# ve el acta YA presente en `merged` y no hace nada, así que no hay
# ningún punto existente que evite esta resurrección.
def _enforce_liga_trim(base_res, incoming_res, merged_res):
    """Si CUALQUIERA de las 2 copias (`base_res` o `incoming_res`) trae
    `trimmedAt` para un matchKey cuyo marcador coincide con el de
    `merged_res`, el resultado final para ese matchKey se queda SIN acta
    (`events`/`scorers`/`acta`/`mvp`/`mvpTeam` fuera). El recorte es
    MONOTÓNICO — una vez que CUALQUIER dispositivo lo sella, ningún otro
    dispositivo (que aún no lo haya visto y siga posteando su copia vieja
    con acta completa) puede revertirlo. Esto es seguro sin necesidad de
    comparar timestamps: la aportación de CUALQUIER copia del partido ya
    está en la tabla permanente antes de sellar `trimmedAt` (el cliente
    acumula y borra en la MISMA llamada), así que preferir "recortado"
    nunca pierde ningún dato — solo evita que reaparezca el peso que el
    feature entero existe para ahorrar."""
    if not isinstance(merged_res, dict):
        return
    for src in (base_res, incoming_res):
        if not isinstance(src, dict):
            continue
        for mk, r in src.items():
            if not isinstance(r, dict) or not r.get("trimmedAt"):
                continue
            m = merged_res.get(mk)
            if not isinstance(m, dict):
                continue
            if not _same_match_score(r, m):
                continue
            for f in _ACTA_FIELDS:
                m.pop(f, None)
            if not m.get("trimmedAt") or m["trimmedAt"] < r["trimmedAt"]:
                m["trimmedAt"] = r["trimmedAt"]


# Claves de `/api/state` cuyo blob es un running total / consumible
# (HUD: 🪙 presupuesto · 💊 puntos de fisio · 💼 valoración). Para ellas
# NO vale el field-merge recursivo de `merge_dict`: dos dispositivos
# llevan totales DISTINTOS calculados localmente, así que un merge campo
# a campo mezclaría cifras de generaciones distintas y el resultado nunca
# converge (bug 🪙💊 fuera de sync entre PC y móvil). Igual que las
# claves de `_KV_RECENCY_BLOB_KEYS`: el blob con `updatedAt` mayor gana
# ENTERO. Un POST stale (otro dispositivo, request perdido) jamás pisa
# una copia más nueva.
_STATE_RECENCY_BLOB_KEYS = {"bayern_hud_overrides_v1"}


def _blob_updated_at(blob):
    """ms (float) del campo `updatedAt` de un blob, 0 si ausente."""
    if not isinstance(blob, dict):
        return 0.0
    try:
        return float(blob.get("updatedAt") or 0)
    except (TypeError, ValueError):
        return 0.0


def _recency_winner(old_blob, new_blob):
    """Devuelve el blob con `updatedAt` mayor, ENTERO (sin field-merge).
    En empate gana `new_blob` (el POST entrante = el escritor)."""
    if not isinstance(new_blob, dict):
        return old_blob
    if not isinstance(old_blob, dict):
        return new_blob
    return new_blob if _blob_updated_at(new_blob) >= _blob_updated_at(old_blob) else old_blob


# Claves de `competition_state` que son el CURSOR DEL DÍA del hub
# (liverpool_preseason_v1 + su legacy bayern_preseason_v2). Su `dayIdx`
# es MONOTÓNICO: solo avanza al siguiente día o se REINICIA a 0 vía el
# botón «Reiniciar Temporada» (que marca el blob con `resetAt`). NUNCA
# debe saltar a un día anterior > 0.
#
# Bug (foto usuario 2026-06-05): el usuario estaba en agosto y al volver
# a la web el cursor mostraba el 16 de junio. Causa: una pestaña de
# fondo congelada (tenía 2 abiertas) re-guardaba un cursor viejo con
# `ts` FRESCO y lo empujaba al server; el merge ciego de
# `competition_state` (campo a campo en `merge_dict`) lo aceptaba
# entero, pisando el avance real. Al purgarse luego el localStorage
# del móvil, la hidratación traía el cursor stale del server.
#
# Fix: merge dedicado por RECENCIA MONOTÓNICA — gana el `dayIdx` MAYOR;
# un reinicio explícito (marca `resetAt`/`_reset`) gana por `ts`; un
# downgrade a un día anterior > 0 SIN marca de reinicio se RECHAZA.
_STATE_CURSOR_KEYS = {"liverpool_preseason_v1", "bayern_preseason_v2"}
# Multi-hub (2026-06-13): cada caja de mister humano lleva su PROPIO
# cursor del calendario con sufijo `_<id>` (ej. liverpool_preseason_v1_alvaro
# para Arsenal). Heredan EL MISMO merge monotonico que el cursor base
# (un POST stale jamas devuelve el dia del hub a un dia anterior).
_STATE_CURSOR_PREFIXES = ("liverpool_preseason_v1_", "bayern_preseason_v2_")


def _is_cursor_key(k):
    try:
        if k in _STATE_CURSOR_KEYS:
            return True
        return any(str(k).startswith(p) for p in _STATE_CURSOR_PREFIXES)
    except Exception:
        return False


# Claves de `competition_state` que son un estado de BRACKET/FIXTURES de
# una competición europea/copa (obligatorio, 2026-07-17 — ver
# `bracket_state_merge` en sync_merge.py). Viajaban como JSON opaco: el
# merge de `competition_state` (campo a campo en `merge_dict`) las
# sobreescribía ENTERAS en cada POST, exactamente el mismo fallo ya
# corregido para `tour_<id>_v1` — un partido jugado en un dispositivo
# podía desaparecer si otro POST (de OTRA jornada/torneo) llegaba con un
# `competition_state` más completo pero sin ese partido.
_STATE_BRACKET_KEYS = {
    "wprev_state_v1",     # Previa Champions
    "sc_state_v1",        # Supercopa de España
    "usc_state_v1",       # Supercopa de Europa
    "ucl_ko_state_v1",    # Champions — fase eliminatoria
    "uel_ko_state_v1",    # Europa League — fase eliminatoria
    "uecl_ko_state_v1",   # Conference League — fase eliminatoria
    "inter_state_v1",     # Copa Intercontinental (obligatorio, 2026-08-08:
                           # esta clave nunca viajaba al servidor en absoluto
                           # hasta ahora — ver SYNC_KEYS en misc_body_2.html)
}


# Multi-hub (2026-06-13): el HUD (💼🪙💊), trofeos y objetivos de cada
# caja de mister humano viven en una variante POR HUB de su clave base,
# con sufijo `_<id>` (ej. bayern_hud_overrides_v1_alvaro = HUD de Arsenal).
# Cada variante HEREDA EXACTAMENTE el mismo merge/proteccion que su base
# (recencia, rev monotonico, field-merge, anchor-guard, empty-guard).
_KV_HUB_BASE_KEYS = (
    "bayern_hud_overrides_v1",
    "bayern_trofeos_v1",
    "munich-obj-overrides-v1",
    "munich-obj-state-v4",
    # v5 = rediseño de objetivos 2026-07-23 (2 por competición). El progreso
    # viejo (índices de los 68 objetivos) queda huérfano en v4; el cliente
    # ahora lee/escribe v5, así todos arrancan limpio en 0/23.
    "munich-obj-state-v5",
)


def _kv_hub_base(key):
    """Si `key` es una variante por-hub (`base_<id>`) de una clave base
    conocida, devuelve la clave BASE; si no, devuelve `key` tal cual.
    Permite que toda la logica especial keyed por la clave literal
    (recencia/rev/field-merge/empty-guard) cubra tambien las variantes
    por hub sin duplicarla."""
    try:
        for b in _KV_HUB_BASE_KEYS:
            if key == b or str(key).startswith(b + "_"):
                return b
    except Exception:
        pass
    return key


def _parse_json_blob(s):
    """Parsea un JSON STRING a dict, o None si no es un dict válido."""
    if not isinstance(s, str) or not s:
        return None
    try:
        o = json.loads(s)
        return o if isinstance(o, dict) else None
    except Exception:
        return None


def _safe_int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        try:
            return int(float(v))
        except (TypeError, ValueError):
            return 0


def _cursor_ts(blob):
    """ms (float) del campo `ts` del cursor, 0 si ausente."""
    if not isinstance(blob, dict):
        return 0.0
    try:
        return float(blob.get("ts") or blob.get("updatedAt") or 0)
    except (TypeError, ValueError):
        return 0.0


def _cursor_is_reset(blob):
    """¿El blob porta una marca de reinicio de temporada explícita?"""
    return bool(isinstance(blob, dict) and (blob.get("resetAt") or blob.get("_reset")))


def _cursor_winner(old_str, new_str):
    """Devuelve el JSON STRING ganador del cursor del día del hub.

    Regla monotónica anti-stale:
      * POST entrante ilegible → conservar lo que hubiera.
      * No había copia válida → aceptar el entrante.
      * Reinicio explícito (resetAt/_reset) → gana por recencia (ts).
      * `dayIdx` MAYOR → gana (avance de día normal).
      * Empate de `dayIdx` → gana el `ts` mayor (rivales/done del mismo
        día actualizados).
      * `dayIdx` MENOR sin marca de reinicio → DOWNGRADE STALE → se
        RECHAZA (conserva la copia del server). Esto cubre tanto el
        downgrade agosto→16 jun como un dispositivo recién abierto que
        empuja el estado por defecto (dayIdx 0 sin reset)."""
    new_blob = _parse_json_blob(new_str)
    if new_blob is None:
        return old_str
    old_blob = _parse_json_blob(old_str)
    if old_blob is None:
        return new_str
    old_idx = _safe_int(old_blob.get("dayIdx"))
    new_idx = _safe_int(new_blob.get("dayIdx"))
    old_ts = _cursor_ts(old_blob)
    new_ts = _cursor_ts(new_blob)
    if _cursor_is_reset(new_blob):
        return new_str if new_ts >= old_ts else old_str
    if new_idx > old_idx:
        return new_str
    if new_idx == old_idx:
        return new_str if new_ts >= old_ts else old_str
    return old_str

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

def save_global_state(new_state, replace=False):
    """Guarda una actualización del estado global.

    Dos modos:

    * `replace=False` (por defecto) — actualización **PARCIAL**: la
      fila existente se preserva y solo se sobreescriben las claves
      presentes en `new_state`. Así un POST con `{liga_results: X}`
      no borra `liga_schedule`, `copa_state`, etc. Es el comportamiento
      que espera `/api/state` cuando el frontend manda un patch.

    * `replace=True` — **REEMPLAZO TOTAL**: la fila se reconstruye
      desde `DEFAULT_GLOBAL_STATE + new_state`. Útil para rutas de
      reseteo (p.ej. `copa_reiniciar`) que necesitan limpiar claves
      que hayan quedado pobladas.

    Antes del fix, la única modalidad era `replace=True` y cualquier
    POST parcial desde el frontend perdía claves fuera de DEFAULT
    (y también claves que estaban en DEFAULT con valor vacío eran
    "reset" aunque el cliente no lo pidiera). Eso rompía la
    sincronización multi-dispositivo de Liga: un POST de
    `{liga_schedule: Y}` en un navegador pisaba `liga_results` del
    otro navegador, y al siguiente poll todos veían `0/10`.
    """
    row = get_or_create_global_state()
    incoming = new_state if isinstance(new_state, dict) else {}
    if replace:
        merged = merge_dict(DEFAULT_GLOBAL_STATE, incoming)
    else:
        try:
            existing = json.loads(row.valor_json or "{}")
        except Exception:
            existing = {}
        if not isinstance(existing, dict):
            existing = {}
        # Asegurar que la base tiene todas las claves DEFAULT (para
        # filas antiguas incompletas), pero sin pisar valores reales
        # del row.
        base = merge_dict(DEFAULT_GLOBAL_STATE, existing)
        merged = merge_dict(base, incoming)
        # Recency-merge de los blobs running-total / consumible (HUD
        # 🪙💊💼): el de `updatedAt` mayor gana ENTERO. `merge_dict`
        # ya los fundió campo a campo arriba; lo CORREGIMOS aquí cuando
        # el POST entrante porta la clave, para que un POST stale no
        # pueda pisar (ni mezclar con) una copia más nueva del server.
        for rk in list(incoming.keys()):
            if _kv_hub_base(rk) in _STATE_RECENCY_BLOB_KEYS:
                merged[rk] = _recency_winner(base.get(rk), incoming.get(rk))
        # Cursor del día del hub (liverpool_preseason_v1 + legacy):
        # merge MONOTÓNICO. `merge_dict` ya copió el string entrante en
        # merged['competition_state'][k] (overwrite ciego); lo CORREGIMOS
        # aquí para que un POST stale jamás devuelva el cursor a un día
        # anterior (bug agosto→16 jun, foto usuario 2026-06-05).
        inc_comp = incoming.get("competition_state")
        if isinstance(inc_comp, dict):
            merged_comp = merged.get("competition_state")
            base_comp = base.get("competition_state")
            if isinstance(merged_comp, dict):
                if not isinstance(base_comp, dict):
                    base_comp = {}
                for ck in list(inc_comp.keys()):
                    if _is_cursor_key(ck):
                        merged_comp[ck] = _cursor_winner(
                            base_comp.get(ck), inc_comp.get(ck))
                    elif ck in _STATE_BRACKET_KEYS:
                        # Bracket/fixtures de SC/USC/UCL-KO/UEL-KO/
                        # UECL-KO/Previa Champions: UNIÓN por partido, nunca
                        # sobreescritura ciega (ver `_STATE_BRACKET_KEYS`).
                        # `competition_state[ck]` es SIEMPRE un JSON string
                        # (espejo de localStorage) — hay que re-serializar.
                        try:
                            _bmerged = bracket_state_merge(
                                base_comp.get(ck), inc_comp.get(ck))
                            if _bmerged is not None:
                                merged_comp[ck] = json.dumps(_bmerged, ensure_ascii=False)
                        except Exception:
                            pass
        # Anti-pérdida de acta de Liga EA: si el POST entrante trae
        # liga_results, restaurar el acta (events/MVP) de los partidos cuyo
        # marcador coincide pero el merge dejó sin eventos (copia
        # solo-marcador de otro móvil). Nunca borra.
        if "liga_results" in incoming:
            try:
                _preserve_results_acta(base.get("liga_results"),
                                       merged.get("liga_results"))
            except Exception:
                pass
            # Recorte de acta IA-vs-IA (obligatorio, 2026-08-17): SIEMPRE
            # después de `_preserve_results_acta` — ese restaura un acta
            # perdida por ACCIDENTE, esta impone lo contrario (un acta
            # borrada A PROPÓSITO no puede resucitar). Ver
            # `_enforce_liga_trim` arriba para el porqué del orden.
            try:
                _enforce_liga_trim(base.get("liga_results"),
                                   incoming.get("liga_results"),
                                   merged.get("liga_results"))
            except Exception:
                pass
    row.valor_json = json.dumps(merged, ensure_ascii=False)
    row.updated_at = utc_now_iso()
    db.session.commit()
    return merged

# ── LIVE STATE COMPARTIDO ────────────────────────────────────────
# Estado de los partidos HvH/HvIA en curso, serializado por el
# frontend (window._liveStore) y compartido entre TODOS los navegadores
# que abran la app. Cada dispositivo hace POST /api/live/state cuando
# ocurre un cambio relevante (kickoff, gol, tarjeta, fin) y hace GET
# periódicamente para recibir los cambios de los otros dispositivos.
#
# Almacenamos una única fila en GlobalState con clave
# `live_state_shared_v1`. El valor es un blob JSON opaco desde el punto
# de vista del backend: no lo interpreta, solo lo persiste y devuelve
# tal cual, con un updated_at UTC que sirve de ETag básico.
LIVE_STATE_KEY = "live_state_shared_v1"
DEFAULT_LIVE_STATE = {"ml": {}, "gmLive": None, "gmBg": {}}

def _get_or_create_live_state_row():
    row = GlobalState.query.filter_by(clave=LIVE_STATE_KEY).first()
    if not row:
        row = GlobalState(
            clave=LIVE_STATE_KEY,
            valor_json=json.dumps(DEFAULT_LIVE_STATE, ensure_ascii=False),
            updated_at=utc_now_iso(),
        )
        db.session.add(row)
        db.session.commit()
    return row

def load_live_state():
    row = _get_or_create_live_state_row()
    try:
        data = json.loads(row.valor_json or "{}")
    except Exception:
        data = {}
    if not isinstance(data, dict):
        data = {}
    return {
        "state": data,
        "updated_at": row.updated_at or utc_now_iso(),
    }

_GOAL_TYPES_DIRECT = {"gol", "falta-gol", "pen-gol"}
_GOAL_TYPES_OWN = {"propia"}

def _legacy_evt_key(e):
    """Dedupe key para eventos antiguos sin id (clientes que aún no
    asignaban id). Identifica un evento por su contenido visible."""
    return (
        e.get("type"),
        e.get("min"),
        e.get("team"),
        e.get("num"),
        e.get("player") or e.get("name"),
    )

def _merge_events(existing_events, incoming_events):
    """Union de eventos por `id`. Conserva el orden cronológico:
    primero los existentes, luego los nuevos del incoming.

    Si un id aparece en ambos lados, el del incoming pisa al existente
    (permite editar etiqueta/jugador sin duplicar).

    Eventos sin id (legacy) se deduplican por contenido para que un
    cliente legacy reposteando su snapshot no genere duplicados."""
    existing = existing_events if isinstance(existing_events, list) else []
    incoming = incoming_events if isinstance(incoming_events, list) else []
    merged = []
    pos_by_id = {}
    legacy_seen = set()
    for src in (existing, incoming):
        for e in src:
            if not isinstance(e, dict):
                continue
            eid = e.get("id")
            if eid is not None and eid != "":
                if eid in pos_by_id:
                    merged[pos_by_id[eid]] = e
                else:
                    pos_by_id[eid] = len(merged)
                    merged.append(e)
            else:
                key = _legacy_evt_key(e)
                if key in legacy_seen:
                    continue
                legacy_seen.add(key)
                merged.append(e)
    return merged

def _merge_id_list(existing_list, incoming_list):
    """Union de un array tipo `varAnuladoIds` o ids de tarjetas rojas
    (set semantics, conserva orden de aparición)."""
    out = []
    seen = set()
    for src in (existing_list or [], incoming_list or []):
        if not isinstance(src, list):
            continue
        for v in src:
            try:
                key = json.dumps(v, sort_keys=True, ensure_ascii=False)
            except Exception:
                key = str(v)
            if key in seen:
                continue
            seen.add(key)
            out.append(v)
    return out

def _score_from_events(events, var_anulado_ids):
    """Recalcula el marcador a partir de los eventos, ignorando los
    goles anulados por VAR. Devuelve (a, b) o None si `events` no
    es una lista."""
    if not isinstance(events, list):
        return None
    cancelled = set()
    if isinstance(var_anulado_ids, list):
        for v in var_anulado_ids:
            cancelled.add(v)
    a, b = 0, 0
    for e in events:
        if not isinstance(e, dict):
            continue
        if e.get("id") in cancelled:
            continue
        t = e.get("type")
        team = e.get("team")
        if t in _GOAL_TYPES_DIRECT:
            if team == "a":
                a += 1
            elif team == "b":
                b += 1
        elif t in _GOAL_TYPES_OWN:
            if team == "a":
                b += 1
            elif team == "b":
                a += 1
    return (a, b)

_MONOTONIC_FLAGS = (
    "kickoffDone", "htDone", "stDone", "etDone", "et1Done",
    "finished", "aiEventsGenerated", "injuryScheduled", "injuryInjected",
)

def _merge_match(existing, incoming):
    """Merge per-partido: union de eventos por id, max de timerSec,
    OR de banderas monotónicas, recálculo de marcador a partir de
    eventos. Para el resto de campos, gana el incoming.

    Esto permite que dos humanos editen el mismo partido en paralelo
    sin que un POST le pise al otro los goles/tarjetas que añadió."""
    if not isinstance(existing, dict):
        return incoming if isinstance(incoming, dict) else {}
    if not isinstance(incoming, dict):
        return existing
    out = dict(existing)
    out.update(incoming)
    if "events" in existing or "events" in incoming:
        out["events"] = _merge_events(existing.get("events"), incoming.get("events"))
    out["varAnuladoIds"] = _merge_id_list(
        existing.get("varAnuladoIds"), incoming.get("varAnuladoIds")
    )
    out["redCards"] = _merge_id_list(
        existing.get("redCards"), incoming.get("redCards")
    )
    e_t = existing.get("timerSec")
    i_t = incoming.get("timerSec")
    if isinstance(e_t, (int, float)) and isinstance(i_t, (int, float)):
        out["timerSec"] = max(e_t, i_t)
    for flag in _MONOTONIC_FLAGS:
        if existing.get(flag) or incoming.get(flag):
            out[flag] = True
    sc = _score_from_events(out.get("events"), out.get("varAnuladoIds"))
    if sc is not None:
        out["sc"] = {"a": sc[0], "b": sc[1]}
    return out

def _merge_match_dict(existing_map, incoming_map):
    """Para `ml` y `gmBg`: para cada clave que esté en incoming, hacer
    `_merge_match` con la versión existente. Las claves que NO estén
    en incoming se eliminan (mantiene la semántica "el cliente que
    postea su snapshot completo es la fuente de verdad" para la
    EXISTENCIA del partido). Las claves que estén en ambos lados se
    fusionan a nivel de eventos."""
    if not isinstance(incoming_map, dict):
        return {}
    if not isinstance(existing_map, dict):
        existing_map = {}
    out = {}
    for k, inc in incoming_map.items():
        if k in existing_map:
            out[k] = _merge_match(existing_map[k], inc)
        else:
            out[k] = inc
    return out

def _merge_live_state(existing, incoming):
    """Merge de alto nivel del estado live compartido. Mantiene la
    semántica LWW para qué partidos existen, pero hace UNION de
    eventos cuando un partido aparece en ambos lados — así dos
    humanos pueden añadir eventos al mismo partido en paralelo sin
    que se pisen."""
    if not isinstance(existing, dict):
        existing = {}
    if not isinstance(incoming, dict):
        return existing
    out = dict(existing)
    out.update(incoming)
    if "ml" in incoming:
        out["ml"] = _merge_match_dict(existing.get("ml"), incoming.get("ml"))
    if "gmBg" in incoming:
        out["gmBg"] = _merge_match_dict(existing.get("gmBg"), incoming.get("gmBg"))
    if "gmLive" in incoming:
        inc_gl = incoming.get("gmLive")
        ex_gl = existing.get("gmLive")
        if inc_gl is None:
            out["gmLive"] = None
        elif isinstance(ex_gl, dict) and isinstance(inc_gl, dict) \
                and ex_gl.get("home") == inc_gl.get("home") \
                and ex_gl.get("away") == inc_gl.get("away") \
                and ex_gl.get("j") == inc_gl.get("j"):
            out["gmLive"] = _merge_match(ex_gl, inc_gl)
        else:
            out["gmLive"] = inc_gl
    return out

def save_live_state(new_state):
    row = _get_or_create_live_state_row()
    incoming = new_state if isinstance(new_state, dict) else {}
    try:
        existing = json.loads(row.valor_json or "{}")
    except Exception:
        existing = {}
    if not isinstance(existing, dict):
        existing = {}
    payload = _merge_live_state(existing, incoming)
    row.valor_json = json.dumps(payload, ensure_ascii=False)
    row.updated_at = utc_now_iso()
    db.session.commit()
    return {
        "state": payload,
        "updated_at": row.updated_at,
    }

# --- FUNCIONES MOTOR ---
def calcular_prob(perfil, local=False, goles_previos=0, flags=None):
    # Porteros casi nunca marcan: peso fijo 0.001 ignorando su poder de portería
    if perfil["posicion"] == "portero":
        return 0.001

    base = BASE.get(perfil["posicion"], 10)
    prob = base + (perfil["poder"] / 100)

    if local:
        prob *= BONUS_LOCAL

    prob *= MULTIGOL[min(goles_previos, 4)]

    # Flags obligatorios (CLAUDE.md): se aplican en TODOS los partidos.
    # NO se acumulan ⚾ y 🏀: si hay 🏀, ⚾ se ignora (un jugador es
    # goleador estrella O nato a efectos del peso, no ambos).
    if flags:
        if flags.get("natGoalPro"):
            prob *= 3.0      # 🏀 goleador estrella — ~48% de los goles
        elif flags.get("natGoal"):
            prob *= 1.8      # ⚾ goleador nato — ~30% de los goles
        if flags.get("penalty"):
            prob += 0.40     # P — bonus fijo al peso de goleador
        if flags.get("freeKick"):
            prob += 0.30     # F — bonus fijo al peso de goleador
        # ⭐ elite y C capitán no afectan a esta función (MVP / equipo)
    return prob

def resolve_team_name(team_name):
    clean = (team_name or "").strip()
    return TEAM_ALIASES.get(clean.lower(), clean)

"""Flags obligatorios por equipo (CLAUDE.md): capitan (C), freeKick (F),
penalti (P), elite (⭐), natGoal (⚾), natGoalPro (🏀). Estructura
opcional que, cuando está presente, el motor de simulación aplica en
TODOS los partidos (Liga, Copa, Europa, amistosos). Vacío por defecto
— los admins las marcan desde el editor web y se sincronizan aquí
cuando aplique."""
TEAM_PLAYER_FLAGS = {}


def get_player_flags(team_name, player_name):
    team_flags = TEAM_PLAYER_FLAGS.get(resolve_team_name(team_name)) or \
                 TEAM_PLAYER_FLAGS.get(team_name) or {}
    return team_flags.get(player_name, {}) or {}


def team_has_captain(team_name):
    team_flags = TEAM_PLAYER_FLAGS.get(resolve_team_name(team_name)) or \
                 TEAM_PLAYER_FLAGS.get(team_name) or {}
    return any(f.get("captain") for f in team_flags.values() if isinstance(f, dict))


def get_team_power(team_name):
    resolved = resolve_team_name(team_name)
    squad = jugadores_por_equipo.get(resolved) or jugadores_por_equipo.get(team_name) or []
    if squad:
        powers = [int(j.get("poder", 70) or 70) for j in squad]
        avg = sum(powers) / max(1, len(powers))
        # Capitán (C): +5% obligatorio al valor del equipo (CLAUDE.md)
        if team_has_captain(resolved):
            avg *= 1.05
        return max(1, min(100, round(avg)))
    return 76

def elegir_goleador(equipo, local=False, conteo=None):
    if conteo is None:
        conteo = {}

    resolved = resolve_team_name(equipo)
    jugadores = jugadores_por_equipo[resolved]
    pesos = []

    for j in jugadores:
        goles_previos = conteo.get(j["nombre"], 0)
        flags = get_player_flags(resolved, j["nombre"])
        p = calcular_prob(j, local, goles_previos, flags=flags)
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


@app.route("/api/forma_counter", methods=["GET"])
def forma_counter_get():
    """Contador persistente de estados ↘️ por jugador. Al llegar a 3 se
    dispara LESIÓN LEVE automática y se resetea a 0 (lo hace el cliente,
    esto solo almacena el contador)."""
    data = load_global_state()
    return jsonify({"ok": True, "counters": data.get("forma_down_counter") or {}})


@app.route("/api/forma_counter", methods=["POST"])
def forma_counter_save():
    payload = request.get_json(silent=True) or {}
    counters = payload.get("counters")
    if not isinstance(counters, dict):
        return jsonify({"ok": False, "error": "counters debe ser objeto"}), 400
    cleaned = {}
    for name, value in counters.items():
        try:
            n = int(value)
        except (TypeError, ValueError):
            continue
        if n > 0:
            cleaned[str(name)] = n
    data = load_global_state()
    data["forma_down_counter"] = cleaned
    save_global_state(data)
    return jsonify({"ok": True, "counters": cleaned})

COPA_TWO_LEG = ("oct", "cua", "sf")  # ida+vuelta. r1/r2/r16/fin = single-leg.
COPA_NEXT_PHASE = {"r1": "r2", "r2": "r16", "r16": "oct",
                   "oct": "cua", "cua": "sf", "sf": "fin", "fin": "campeon"}


def _copa_two_leg_winner(ida, vta, des, local, visit):
    """Decide el clasificado de una eliminatoria copera a doble partido
    (Octavos/Cuartos/Semis):
      1) GLOBAL (suma de ida + vuelta),
      2) GOLES FUERA DE CASA (cuentan doble: a igualdad de global, pasa
         quien marcó más como visitante),
      3) TERCER PARTIDO (desempate con prórroga+penaltis) si global y
         goles fuera están empatados.
    Devuelve el nombre del ganador, o None si el global y los goles fuera
    están empatados y el desempate aún no se ha jugado. Convención:
    ida = {gl,gv} con local en casa; vta = {gl,gv} con visit en casa.
    """
    ida = ida or {}
    vta = vta or {}
    total_l = (ida.get("gl") or 0) + (vta.get("gv") or 0)
    total_v = (ida.get("gv") or 0) + (vta.get("gl") or 0)
    if total_l > total_v:
        return local
    if total_v > total_l:
        return visit
    away_l = vta.get("gv") or 0   # local marcó fuera (en la vuelta)
    away_v = ida.get("gv") or 0   # visit marcó fuera (en la ida)
    if away_l > away_v:
        return local
    if away_v > away_l:
        return visit
    if des and des.get("jugado"):
        dl = (des.get("gl") or 0) + (des.get("et_gl") or 0)
        dv = (des.get("gv") or 0) + (des.get("et_gv") or 0)
        if dl > dv:
            return local
        if dv > dl:
            return visit
        return des.get("pen_winner") or None
    return None


@app.route("/api/copa/sorteo", methods=["POST"])
def copa_sorteo():
    """Sortear una ronda de Copa del Rey.

    Spec usuario (2026-05-04):
      - 82 equipos = Liga EA (20) + Hypermotion (22) + Primera Fed (40)
      - r1 (1ª Ronda): 36 equipos = 5 humanos + 31 random Primera Fed
        → 18 ties single-leg, local = MENOR nivel, ET+pen si empate.
      - r2 (2ª Ronda): 64 equipos = 18 ganadores r1 + 46 pre-clasificados
        → 32 ties single-leg, mismo formato.
      - r16/oct/cua/sf: ida+vuelta, vuelta SIEMPRE en campo del menor.
      - fin: partido único en sede neutral.

    El cliente (copa-engine.js) conoce los 82 equipos y sus niveles, así
    que envía `pairs` ya emparejados con local=menor (o local=mayor en
    two-leg para que la vuelta caiga en el menor). El backend solo
    persiste lo recibido. Para retrocompatibilidad, si `pairs` no viene,
    cae al COPA_SEEDING viejo.
    """
    payload = request.get_json(silent=True) or {}
    ronda = payload.get("ronda")
    if ronda not in ("r1", "r2", "r16", "oct", "cua", "sf", "fin"):
        return jsonify({"ok": False, "error": "Ronda inválida"}), 400
    data = load_global_state()
    copa = data.get("copa_state") or {"fase": "r1", "sorteo": {}, "resultados": {}, "clasificados": {}}
    sorteo = copa.get("sorteo", {})
    clasificados = copa.get("clasificados", {})

    pairs_in = payload.get("pairs")
    if isinstance(pairs_in, list) and pairs_in:
        # Cliente envía emparejamientos ya resueltos (camino nuevo).
        matches = []
        for p in pairs_in:
            if not isinstance(p, dict): continue
            l = str(p.get("l", "")).strip()
            v = str(p.get("v", "")).strip()
            if l and v:
                matches.append({"l": l, "v": v})
        if not matches:
            return jsonify({"ok": False, "error": "pairs vacío o inválido"}), 400
    else:
        # Fallback legacy: usa COPA_SEEDING hardcoded (estructura antigua).
        if ronda == "r1":
            teams = COPA_SEEDING["r1"][:]
            random.shuffle(teams)
        elif ronda == "r2":
            teams = clasificados.get("r1", []) + COPA_SEEDING["r2_direct"][:]
            random.shuffle(teams)
        elif ronda == "r16":
            teams = clasificados.get("r2", []) + COPA_SEEDING["r16_direct"][:]
            random.shuffle(teams)
        elif ronda in ("oct", "cua", "sf"):
            prev = {"oct": "r16", "cua": "oct", "sf": "cua"}[ronda]
            teams = clasificados.get(prev, [])[:]
            random.shuffle(teams)
        elif ronda == "fin":
            teams = clasificados.get("sf", []) or clasificados.get("cua", [])
            if len(teams) < 2:
                return jsonify({"ok": False, "error": "No hay 2 finalistas"}), 400
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
    two_leg = ronda in COPA_TWO_LEG
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
            winner = _copa_two_leg_winner(ida, resultados[key_vta][idx], None, local, visitante)
            if not winner:
                # Global + goles fuera empatados → TERCER PARTIDO. En IA se
                # juega automáticamente (prórroga+penaltis garantizan ganador).
                key_des = ronda + "_des"
                if key_des not in resultados:
                    resultados[key_des] = [None] * len(sorteo_ronda)
                des = copa_sim_partido(local, visitante, two_leg=False)
                resultados[key_des][idx] = des
                winner = _copa_two_leg_winner(ida, resultados[key_vta][idx], des, local, visitante)
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
    es_desempate = payload.get("es_desempate", False)
    is_ia = payload.get("ia", False)
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
    two_leg = ronda in COPA_TWO_LEG
    res = {"gl": gl, "gv": gv, "et_gl": et_gl, "et_gv": et_gv,
           "pen_winner": pen_winner, "pen_score": pen_score, "mvp": mvp,
           "events": events, "injuries": injuries, "summary": summary,
           "team_a": team_a or local_orig, "team_b": team_b or visit_orig,
           "jugado": True}
    # Init defensivo: en two-leg IDA `winner` no se calcula porque
    # aún no hay global. Sin este None, el bloque `if winner:` de
    # más abajo lanzaba NameError → endpoint 500 → frontend no
    # recibía d.copa → la IDA aparecía como "no jugada" tras volver
    # al bracket. Reportado 2026-05-07 (Atlético 3-1 Las Palmas IDA
    # octavos).
    winner = None
    needs_desempate = False
    if two_leg:
        key_ida = ronda + "_ida"
        key_vta = ronda + "_vta"
        key_des = ronda + "_des"
        if es_desempate:
            # TERCER PARTIDO (desempate, single-leg con prórroga+penaltis).
            if key_des not in resultados:
                resultados[key_des] = [None] * len(sorteo_ronda)
            resultados[key_des][idx] = res
            ida = (resultados.get(key_ida) or [None]*len(sorteo_ronda))[idx] or {}
            vta = (resultados.get(key_vta) or [None]*len(sorteo_ronda))[idx] or {}
            winner = _copa_two_leg_winner(ida, vta, res, local_orig, visit_orig)
            resultados[key_des][idx]["winner"] = winner
        else:
            key = ronda + ("_vta" if es_vuelta else "_ida")
            if key not in resultados:
                resultados[key] = [None] * len(sorteo_ronda)
            resultados[key][idx] = res
            if es_vuelta:
                ida = (resultados.get(key_ida) or [None]*len(sorteo_ronda))[idx] or {}
                winner = _copa_two_leg_winner(ida, res, None, local_orig, visit_orig)
                if winner:
                    resultados[key][idx]["winner"] = winner
                elif is_ia:
                    # IA: global + goles fuera empatados → desempate automático.
                    if key_des not in resultados:
                        resultados[key_des] = [None] * len(sorteo_ronda)
                    des = copa_sim_partido(local_orig, visit_orig, two_leg=False)
                    resultados[key_des][idx] = des
                    winner = _copa_two_leg_winner(ida, res, des, local_orig, visit_orig)
                    resultados[key_des][idx]["winner"] = winner
                else:
                    # Humano: hace falta TERCER PARTIDO (lo juega el usuario).
                    needs_desempate = True
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
    # Auto-resolución de TBDs (2026-05-06): si esta ronda tenía un
    # `@<ronda>#<idx>` referenciado en cualquier sorteo o clasificados
    # posterior, lo reemplazamos por el ganador real ahora. Sin esto
    # el cliente dependía de `_copaResolveTbdExternal` que hacía
    # state_set por separado — race conditions hacían que a veces el
    # TBD no se actualizara y los humanos "desaparecían" del bracket
    # de Dieciseisavos. Bug reportado: Atlético Madrid ganó r2 pero no
    # apareció en r16. El backend ahora garantiza la consistencia
    # transaccional (un solo save).
    if winner:
        tbd_key = "@" + ronda + "#" + str(idx)
        # 1) Reemplazar en clasificados de TODAS las rondas.
        for r_key, c_list in (copa.get("clasificados") or {}).items():
            if not isinstance(c_list, list): continue
            for ci, name in enumerate(c_list):
                if name == tbd_key:
                    c_list[ci] = winner
        # 2) Reemplazar en sorteo de TODAS las rondas.
        for r_key, m_list in (copa.get("sorteo") or {}).items():
            if not isinstance(m_list, list): continue
            for m in m_list:
                if not isinstance(m, dict): continue
                if m.get("l") == tbd_key: m["l"] = winner
                if m.get("v") == tbd_key: m["v"] = winner
        # 3) Si la final ha acabado, fijamos el campeón en el state.
        # Reportado 2026-05-07: tras ganar la final no se guardaba.
        if ronda == "fin":
            copa["campeon"] = winner
            loser = visit_orig if winner == local_orig else local_orig
            copa["subcampeon"] = loser
    data["copa_state"] = copa
    save_global_state(data)
    return jsonify({"ok": True, "copa": copa, "needs_desempate": needs_desempate})

@app.route("/api/copa/clasificar", methods=["POST"])
def copa_clasificar():
    """Calcula los `clasificados` de la ronda. Permite clasificación
    PARCIAL: para los partidos que aún no se han jugado, añade un
    placeholder TBD `@<ronda>#<idx>` que luego se reemplazará por el
    ganador real cuando ese partido finalice (vía /api/copa/state_set
    desde el cliente). Esto deja al usuario sortear la siguiente
    ronda aunque queden humanos pendientes de jugar la actual."""
    payload = request.get_json(silent=True) or {}
    ronda = payload.get("ronda")
    data = load_global_state()
    copa = data.get("copa_state") or {"sorteo": {}, "resultados": {}, "clasificados": {}}
    sorteo_ronda = copa.get("sorteo", {}).get(ronda, [])
    resultados = copa.get("resultados", {})
    clasificados = copa.get("clasificados", {})
    two_leg = ronda in COPA_TWO_LEG
    if two_leg:
        res_list = resultados.get(ronda + "_vta", [])
    else:
        res_list = resultados.get(ronda, [])
    winners = []
    for idx, match in enumerate(sorteo_ronda):
        res = res_list[idx] if (res_list and idx < len(res_list)) else None
        if res and res.get("winner"):
            winners.append(res["winner"])
        else:
            winners.append("@" + ronda + "#" + str(idx))
    clasificados[ronda] = winners
    if ronda == "fin" and winners and not winners[0].startswith("@"):
        clasificados["campeon"] = winners[0]
    copa["clasificados"] = clasificados
    copa["fase"] = COPA_NEXT_PHASE.get(ronda, copa.get("fase", "r1"))
    data["copa_state"] = copa
    save_global_state(data)
    return jsonify({"ok": True, "clasificados": winners, "copa": copa})


@app.route("/api/copa/state_set", methods=["POST"])
def copa_state_set():
    """Acepta el `copa_state` completo y lo persiste tal cual. Usado por
    el cliente cuando, tras finalizar un partido pendiente, reemplaza
    los TBD `@<ronda>#<idx>` por el ganador real en `sorteo` y
    `clasificados` para que la UI siga sincronizada. La validación
    delegada al cliente — esto es solo storage."""
    payload = request.get_json(silent=True) or {}
    new_state = payload.get("copa")
    if not isinstance(new_state, dict):
        return jsonify({"ok": False, "error": "payload.copa requerido"}), 400
    data = load_global_state()
    # Fusión anti-pérdida de acta (2026-06-06): un POST de otro móvil con
    # una copia stale / solo-marcador NO debe borrar los eventos de cruces
    # ya jugados (goleadores/tarjetas/MVP de la Copa). Unimos `resultados`
    # por ronda+idx conservando el acta; el resto (sorteo/clasificados/
    # fase/campeón) viene del entrante (es el que recalcula los TBD).
    try:
        merged = copa_state_merge(data.get("copa_state"), new_state)
        if isinstance(merged, dict):
            new_state = merged
    except Exception:
        pass
    data["copa_state"] = new_state
    save_global_state(data)
    return jsonify({"ok": True, "copa": new_state})


@app.route("/api/copa/reiniciar", methods=["POST"])
def copa_reiniciar():
    data = load_global_state()
    data["copa_state"] = {"fase": "r1", "sorteo": {}, "resultados": {}, "clasificados": {}}
    # replace=True para que el copa_state interno se borre por completo
    # (el merge por defecto es aditivo y no limpia claves anidadas).
    save_global_state(data, replace=True)
    return jsonify({"ok": True})

# Nombres de los 20 equipos de Liga EA Sports tal como los usa el
# cliente (misc_body_2.html). Se mantiene sincronizado a mano porque el
# Python de esta app tiene otros nombres (jugadores_data) que no valen
# para la Liga EA (p.ej. "Celta" vs "Celta de Vigo"). Si en el futuro
# se hace configurable desde el editor, sustitúyase por la lectura del
# estado; hoy basta con la constante.
# Debe coincidir EXACTAMENTE con la lista `TEAMS` del cliente
# (misc_body_2.html). Si el servidor genera un calendario con un equipo
# que el cliente no reconoce (p.ej. "Bayern Munich" cuando el cliente ya
# tiene "Liverpool"), `isValidLigaSchedule` lo rechaza y el calendario
# nuevo nunca se adopta — el bug del calendario que «no cambia».
LIGA_EA_TEAMS_DEFAULT = [
    "Real Madrid", "Athletic Club", "Real Sociedad", "Sevilla", "Villarreal",
    "Mallorca", "Valencia CF", "Espanyol", "Liverpool", "Celta de Vigo",
    "Deportivo Alavés", "Osasuna", "Getafe CF", "Arsenal", "Girona FC",
    "Elche CF", "Atlético Madrid", "Rayo Vallecano", "Real Betis", "FC Barcelona",
]


def _liga_extract_teams(schedule):
    """Extrae los nombres únicos de equipos de un schedule serializado."""
    if not isinstance(schedule, list):
        return []
    out = []
    seen = set()
    for jornada in schedule:
        if not isinstance(jornada, list):
            continue
        for match in jornada:
            if not isinstance(match, (list, tuple)) or len(match) < 2:
                continue
            for team in (match[0], match[1]):
                if isinstance(team, str) and team and team not in seen:
                    seen.add(team)
                    out.append(team)
    return out


def _liga_calendario_aleatorio(teams, distinto_a=None):
    """Genera un calendario de 38 jornadas con el orden de equipos
    aleatorizado. Si `distinto_a` se proporciona y el resultado coincide,
    vuelve a intentar; si tras 10 intentos sigue igual (probabilidad
    astronómicamente baja), rota el array no-trivialmente como garantía
    absoluta.
    """
    base = list(teams)
    for _ in range(10):
        random.shuffle(base)
        cal = generar_calendario(base)
        cal_lists = [[list(m) for m in jor] for jor in cal]
        if len(cal_lists) == 38 and cal_lists != distinto_a:
            return cal_lists
    # Fallback: rotar por un offset derivado del reloj — siempre
    # distinto entre dos llamadas consecutivas.
    ns = int(datetime.now(timezone.utc).timestamp() * 1_000_000)
    offset = 1 + (ns % (len(base) - 1))
    rotated = base[offset:] + base[:offset]
    cal = generar_calendario(rotated)
    return [[list(m) for m in jor] for jor in cal]


@app.route("/api/state/reset-liga", methods=["POST"])
def api_state_reset_liga():
    """Reset FORZADO de Liga EA Sports (clasificación + resultados).

    Por qué existe este endpoint: el POST normal a `/api/state` con
    patch `{liga_results: {}}` NO vacía `liga_results` porque
    `merge_dict` recursa y, al iterar un dict incoming vacío, no
    sobreescribe las claves anidadas del base. Eso provoca que al
    pulsar "Res" desde el móvil los resultados "reaparezcan" en el
    siguiente poll (el servidor devuelve el estado anterior).

    Este endpoint usa `replace=True` sobre una copia del estado con
    `liga_results` forzado a `{}`, así el servidor se queda con la
    versión vacía y la propaga a todos los dispositivos.

    Acepta opcionalmente un `liga_schedule` nuevo en el body para
    aplicar un calendario recién generado en el cliente en la misma
    operación atómica.

    GARANTÍA DE NUEVO CALENDARIO (server-side): si el body no trae un
    `liga_schedule` válido, o si el que trae es IDÉNTICO al actual
    (caso de clientes con JS cacheado o RNG con poca entropía en
    WebViews móviles), el servidor genera él mismo un calendario
    aleatorio distinto del actual. Así el usuario SIEMPRE ve un
    calendario nuevo tras pulsar Res, sin depender de la calidad
    del RNG del navegador."""
    body = request.get_json(silent=True) or {}
    data = load_global_state()
    data["liga_results"] = {}

    current_schedule = data.get("liga_schedule")
    client_schedule = body.get("liga_schedule")

    # Si el cliente manda un calendario válido (38 jornadas no vacías)
    # y DISTINTO del actual, lo aceptamos tal cual: así el dispositivo
    # que ha hecho el sorteo y el resto de dispositivos ven exactamente
    # el mismo cuadro, sin parpadeo. El recelo histórico al calendario
    # del cliente era por el JS cacheado que reenviaba SIEMPRE el mismo;
    # el chequeo «distinto del actual» ya cubre ese caso — si llega
    # idéntico, lo genera el servidor con su propia entropía.
    #
    # Si no llega calendario válido (o es idéntico al actual), lo genera
    # el servidor: barajamos los equipos con random.shuffle — entropía
    # del sistema, fresca en cada request.
    if (
        isinstance(client_schedule, list)
        and len(client_schedule) == 38
        and all(isinstance(j, list) and j for j in client_schedule)
        and client_schedule != current_schedule
    ):
        new_schedule = client_schedule
    else:
        teams = (
            _liga_extract_teams(current_schedule)
            or _liga_extract_teams(client_schedule)
            or list(LIGA_EA_TEAMS_DEFAULT)
        )
        if len(teams) != 20:
            teams = list(LIGA_EA_TEAMS_DEFAULT)
        new_schedule = _liga_calendario_aleatorio(teams, distinto_a=current_schedule)

    data["liga_schedule"] = new_schedule
    save_global_state(data, replace=True)
    row = get_or_create_global_state()
    resp = jsonify({
        "ok": True,
        "state": {
            "liga_results": data["liga_results"],
            "liga_schedule": data.get("liga_schedule"),
        },
        "updated_at": row.updated_at or "",
    })
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp

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
        # fallback: registrar el minuto base aunque se repita
        minutos_usados.add(min_base)
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
            campo = jugadores_por_equipo.get(resolved, [{"nombre": "Jugador", "poder": 70}])
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
            # Probabilidad de gol: lanzador vs portero, con factor azar (capped at 1.0)
            prob_gol_pen = min(1.0, (pen_poder / (pen_poder + gk_poder)) * PENALTY_BASE_WEIGHT + random.uniform(0, PENALTY_RANDOM_FACTOR))
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
    # mantenga todos sus goles. Cuando se descuenta un gol también se
    # elimina el último evento de gol del equipo del acta para mantener
    # consistencia entre el marcador y el registro de eventos.
    # ================================================================
    def _descontar_gol_acta(equipo):
        """Elimina el último evento de gol del equipo del acta y devuelve True si lo hizo."""
        for i in range(len(acta) - 1, -1, -1):
            if acta[i][1] == "gol" and acta[i][2] == equipo:
                acta.pop(i)
                return True
        return False

    if mod_local < 1.0 and goles_acta_local > 0:
        if random.random() > mod_local:
            if _descontar_gol_acta(local):
                goles_acta_local -= 1
    if mod_visit < 1.0 and goles_acta_visit > 0:
        if random.random() > mod_visit:
            if _descontar_gol_acta(visitante):
                goles_acta_visit -= 1

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
        if jug in expulsion_minuto and minuto >= expulsion_minuto[jug] and tipo not in ("roja", "doble-amarilla"):
            continue   # evento en el minuto de expulsión o posterior: descartado
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
    """Devuelve el estado compartido (Liga, Segunda, Primera, Copa, etc.).

    Soporta `?since=<iso>` para 304 Not Modified si el cliente ya tiene
    la versión más reciente, igual que /api/live/state. Esto permite
    al frontend hacer polling barato cada pocos segundos para que los
    resultados de Liga simulados en un dispositivo (ej. PC) se vean
    en otros (ej. móvil) sin tener que recargar la página."""
    row = get_or_create_global_state()
    data = load_global_state()
    since = request.args.get("since", "")
    if since and since == (row.updated_at or ""):
        return ("", 304)
    resp = jsonify({
        "ok": True,
        "state": data,
        "updated_at": row.updated_at or "",
    })
    # CRÍTICO: estado MUTABLE compartido — nunca debe cachearse en el
    # navegador ni en un proxy/CDN intermedio. Sin esto, tras pulsar
    # «Reiniciar Liga» la recarga volvía a recibir un /api/state
    # cacheado con el `liga_schedule` anterior y el usuario seguía
    # viendo los mismos enfrentamientos en cada jornada.
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp

@app.route("/api/state", methods=["POST"])
def api_save_state():
    payload = request.get_json(silent=True) or {}
    incoming_state = payload.get("state", payload)

    if not isinstance(incoming_state, dict):
        return jsonify({"ok": False, "error": "Estado no válido"}), 400

    saved = save_global_state(incoming_state)
    row = get_or_create_global_state()
    return jsonify({
        "ok": True,
        "state": saved,
        "updated_at": row.updated_at or "",
    })


@app.context_processor
def inject_shield_data():
    return {
        "escudos_resueltos": build_escudos_resueltos(),
        "escudos_aliases": ALIASES_ESCUDOS_RAW,
        "escudo_default": ESCUDO_DEFAULT,
    }


# ══════════════════════════════════════════════════════════════════
# ADMIN SESSION (PIN 747)
# ══════════════════════════════════════════════════════════════════
# Antes la comprobación del PIN 747 era puramente cliente-side
# (`window._adm` en JS). Ahora la duplicamos en servidor vía
# `session['admin']` para poder proteger endpoints de escritura
# (editar/añadir/borrar eventos del calendario). El cliente sigue
# controlando qué UI se muestra; el servidor controla qué
# peticiones acepta.
ADMIN_PIN = "747"

def _is_admin():
    """Devuelve True si la sesión Flask actual tiene el flag admin."""
    return bool(session.get("admin"))

def admin_required(fn):
    """Decorador: responde 403 si la sesión no es admin.
    Se usa en POST/DELETE del calendario; los GET son públicos."""
    @wraps(fn)
    def _wrap(*args, **kwargs):
        if not _is_admin():
            return jsonify({"ok": False, "error": "admin requerido"}), 403
        return fn(*args, **kwargs)
    return _wrap

@app.context_processor
def inject_admin_flag():
    """Expone `is_admin` en todas las plantillas para que el ✏️ del
    calendario (y cualquier otro control admin) se pinte solo cuando
    haya sesión activa."""
    return {"is_admin": _is_admin()}

@app.route("/api/admin/status", methods=["GET"])
def api_admin_status():
    """El cliente puede preguntar si está logueado como admin sin
    revelar el PIN."""
    return jsonify({"admin": _is_admin()})

@app.route("/api/admin/login", methods=["POST"])
def api_admin_login():
    """Valida el PIN 747. Si coincide, setea `session['admin']=True`
    y la cookie de sesión Flask firmada protege todas las peticiones
    siguientes. No hay rate-limiting (uso personal entre amigos)."""
    body = request.get_json(silent=True) or {}
    pin = str(body.get("pin") or "").strip()
    if pin != ADMIN_PIN:
        return jsonify({"ok": False, "error": "pin incorrecto"}), 401
    session["admin"] = True
    return jsonify({"ok": True, "admin": True})

@app.route("/api/admin/logout", methods=["POST"])
def api_admin_logout():
    """Limpia el flag admin de la sesión. No destruye la sesión
    entera para no romper otras posibles claves."""
    session.pop("admin", None)
    return jsonify({"ok": True, "admin": False})


# ══════════════════════════════════════════════════════════════════
# CALENDARIO EDITABLE (calendario.json en raíz del proyecto)
# ══════════════════════════════════════════════════════════════════
# El admin puede añadir, editar y borrar eventos desde la pantalla
# AGENDA 32-33 vía fetch a /api/calendario/*. La fuente de verdad es
# `calendario.json` en la raíz del proyecto; los cambios lo
# sobreescriben atómicamente (write tmp + rename) para evitar estados
# corruptos si el contenedor muere a mitad de escritura.
CALENDARIO_PATH = os.path.join(basedir, "calendario.json")
CALENDARIO_DEFAULT = {"version": 1, "season": "32-33", "sections": []}
# Iconos válidos para eventos (debe coincidir con el <select> del UI
# de edición). No impedimos otros iconos pero sí vetamos strings
# absurdamente largas.
CALENDARIO_VALID_ICONS = {"⚽", "🏆", "🇪🇺", "🌍", "🤝", "🔵", "🟤", "🔴", "🟡", "🌐", "🌞", "🏃", "💤", "⚫️", "🏁"}
CALENDARIO_VALID_WEATHERS = {"☀️", "🌧", "❄️"}

# Abreviaturas de mes en español → índice 0..11 (Ene=0). Usado para
# ordenar eventos por fecha ("15 Jul", "03 Ago", …) dentro de una
# sección. El orden real es "relativo al primer evento" — ver
# `_sort_section_events` — para soportar secciones que cruzan años
# (Sep→Feb, Jun→Jul).
_SPANISH_MONTH_NUM = {
    "ene": 0, "feb": 1, "mar": 2, "abr": 3, "may": 4, "jun": 5,
    "jul": 6, "ago": 7, "sep": 8, "oct": 9, "nov": 10, "dic": 11,
}

def _parse_event_date(date_str):
    """'15 Jul' → (6, 15). Devuelve None si no parseable."""
    parts = str(date_str or "").strip().split()
    if len(parts) < 2:
        return None
    try:
        day = int(parts[0])
    except ValueError:
        return None
    key = parts[1].strip().lower().rstrip(".")[:3]
    m = _SPANISH_MONTH_NUM.get(key)
    if m is None:
        return None
    return (m, day)

def _sort_section_events(section):
    """Ordena in-place los eventos de una sección cronológicamente.
    El ancla es el mes del primer evento existente para que secciones
    como INVIERNO (Sep→Feb) o FASE FINAL (Jun→Jul) mantengan su tramo
    lógico de temporada sin que enero/julio salten al principio."""
    evs = section.get("events")
    if not isinstance(evs, list) or len(evs) < 2:
        return
    anchor = None
    for ev in evs:
        parsed = _parse_event_date(ev.get("date"))
        if parsed is not None:
            anchor = parsed[0]
            break
    if anchor is None:
        return
    def key(ev):
        parsed = _parse_event_date(ev.get("date"))
        if parsed is None:
            return (99, 99)
        m, d = parsed
        return ((m - anchor) % 12, d)
    evs.sort(key=key)

CALENDARIO_GLOBAL_KEY = "calendario_global_v1"


def _build_june_pretemp_section():
    """Bloque de PRETEMPORADA de JUNIO al inicio de la temporada.
    Mismo patrón EXACTO que la parte de Julio (3 entrenamientos, 1
    Torneo, 1 descanso, repetido), 01–30 Jun. Días 8 y 24 con lluvia,
    el resto soleado. Petición usuario 2026-05-19."""
    events = []
    for day in range(1, 31):
        date = "%02d Jun" % day
        # 01-03: 3 entrenamientos. Desde el día 4 el ciclo es de 4
        # días: Torneo (día%4==0) · Descanso (día%4==1) · Entreno ·
        # Entreno. Idéntico al bloque de Julio.
        if day <= 3:
            icon, name = "🏃", "Entrenamiento"
        elif day % 4 == 0:
            icon, name = "🌞", ("Torneo Verano - 1 Partido"
                                if day == 4 else
                                "Torneo Verano - Partido %d" % (day // 4))
        elif day % 4 == 1:
            icon, name = "💤", "Descanso"
        else:
            icon, name = "🏃", "Entrenamiento"
        weather = "🌧" if day in (8, 24) else "☀️"
        events.append({
            "id": "jun-%03d" % day,
            "date": date, "icon": icon, "name": name, "weather": weather,
        })
    return {
        "id": "verano-jun", "name": "VERANO · PARTE 1",
        "icon": "☀️", "variant": "verano", "events": events,
    }


def _ensure_june_pretemp(data):
    """Inserta (una sola vez, idempotente) el bloque de Junio al inicio
    del calendario. Si ya existe una sección con id 'verano-jun' no
    hace nada (respeta ediciones del admin sobre ese bloque)."""
    if not isinstance(data, dict):
        return data
    secs = data.get("sections")
    if not isinstance(secs, list):
        return data
    if any(isinstance(s, dict) and s.get("id") == "verano-jun" for s in secs):
        return data
    # Idempotente vs CONTENIDO: si alguna sección ya trae eventos de
    # Junio (p.ej. el 'verano-p1' del calendario.json, que ahora incluye
    # la pretemporada de Junio + los Torneos de Verano), NO insertamos un
    # segundo bloque de Junio — eso causaba el "Junio repetido 2 veces".
    for s in secs:
        if not isinstance(s, dict):
            continue
        for ev in (s.get("events") or []):
            p = _parse_event_date((ev or {}).get("date"))
            if p is not None and p[0] == 5:  # Junio (0-indexed)
                return data
    secs.insert(0, _build_june_pretemp_section())
    return data


# Mundialito de Clubes — 7 eventos (fechas corregidas por el usuario
# 2026-05-19): J1 04 Jul, J2 08, J3 12, Octavos 16, Cuartos 20,
# Semis 24, FINAL 28. icono 🌐. El editor no dejaba ponerlos → se
# inyectan en el calendario global (y de ahí a las cajas de equipo).
# Son SERVER-MANAGED (id 'mun-*'): se reescriben siempre a estos
# valores para poder corregir fechas en sucesivos despliegues.
_MUNDIALITO_EVENTS = [
    ("mun-001", "04 Jul", "Mundialito- J1"),
    ("mun-002", "08 Jul", "Mundialito- J2"),
    ("mun-003", "12 Jul", "Mundialito- J3"),
    ("mun-004", "16 Jul", "Mundialito- Octavos"),
    ("mun-005", "20 Jul", "Mundialito- Cuartos"),
    ("mun-006", "24 Jul", "Mundialito- Semis"),
    ("mun-007", "28 Jul", "Mundialito- FINAL"),
]


def _mun_sig(data):
    """Firma de los eventos Mundialito server-managed (id 'mun-*')
    presentes: lista ordenada de (id, date, name)."""
    out = []
    if isinstance(data, dict):
        for s in (data.get("sections") or []):
            if not isinstance(s, dict):
                continue
            for ev in (s.get("events") or []):
                if isinstance(ev, dict) and str(ev.get("id", "")).startswith("mun-"):
                    out.append((ev.get("id"), ev.get("date"), ev.get("name")))
    return sorted(out)


def _ensure_mundialito(data):
    """Reescribe (idempotente y autoritativo) los 7 eventos del
    Mundialito de Clubes con sus fechas correctas. Elimina cualquier
    evento server-managed previo (id 'mun-*') y reinserta el set
    canónico en la sección que contiene Julio."""
    if not isinstance(data, dict):
        return data
    secs = data.get("sections")
    if not isinstance(secs, list) or not secs:
        return data
    # 1. Purga los mun-* antiguos (corrige fechas mal puestas antes).
    for s in secs:
        if isinstance(s, dict) and isinstance(s.get("events"), list):
            s["events"] = [
                ev for ev in s["events"]
                if not (isinstance(ev, dict) and str(ev.get("id", "")).startswith("mun-"))
            ]
    # 1b. Idempotente vs CONTENIDO: si el calendario.json ya trae los
    #     eventos canónicos 'Mundialito Clubes - JX' (icon 🌐), NO
    #     inyectamos los 'mun-*' ('Mundialito- JX') — eso duplicaba el
    #     Mundialito en el mismo día (foto usuario 2026-05-31).
    has_canon_mundialito = any(
        isinstance(ev, dict) and "Mundialito Clubes" in str(ev.get("name", ""))
        for s in secs if isinstance(s, dict)
        for ev in (s.get("events") or [])
    )
    if has_canon_mundialito:
        return data
    # 2. Sección destino: la que tenga eventos de Julio (mes 6); si
    #    no, la primera con eventos; si no, la primera.
    target = None
    for s in secs:
        if not isinstance(s, dict):
            continue
        for ev in (s.get("events") or []):
            p = _parse_event_date((ev or {}).get("date"))
            if p is not None and p[0] == 6:  # Julio
                target = s
                break
        if target is not None:
            break
    if target is None:
        target = next((s for s in secs if isinstance(s, dict) and s.get("events")), None)
    if target is None:
        target = secs[0] if isinstance(secs[0], dict) else None
    if target is None:
        return data
    target.setdefault("events", [])
    for ev_id, date, name in _MUNDIALITO_EVENTS:
        target["events"].append({
            "id": ev_id, "date": date, "icon": "🌐",
            "name": name, "weather": "☀️",
        })
    _sort_section_events(target)
    return data


def _purge_pre_june(data):
    """La temporada arranca el 1 de Junio (regla del usuario, repetida
    en varias iteraciones). Elimina del calendario CUALQUIER evento
    cuya fecha parseable caiga antes de Junio (Ene–May). Idempotente."""
    if not isinstance(data, dict):
        return data
    secs = data.get("sections")
    if not isinstance(secs, list):
        return data
    for s in secs:
        if not isinstance(s, dict):
            continue
        evs = s.get("events")
        if not isinstance(evs, list):
            continue
        kept = []
        for ev in evs:
            if not isinstance(ev, dict):
                continue
            p = _parse_event_date(ev.get("date"))
            # Si no parsea, lo mantenemos (no podemos saber el mes).
            if p is None or p[0] >= 5:
                kept.append(ev)
        s["events"] = kept
    return data


# PRE-VERANO en MAYO (01–31). Mundial de Selecciones: 9 partidos
# (J1/J2/J3/Dieciseisavos/Octavos/Cuartos/Semis/Tercer Puesto/Final) +
# 23 descansos. Petición usuario 2026-05-20. 2026-05-24: renombrado
# "Repesca J3" → "Dieciseisavos" (la ronda es Dieciseisavos = 1/32 =
# 32 selecciones según _mundialFormatConfig en misc_body_1.html).
# 2026-05-29: el 31 May se disputan DOS partidos el mismo día — el
# "Mundial Tercer Puesto" (3º/4º puesto) Y la "MUNDIAL GRAN FINAL".
# Por eso el mapa es day → LISTA de partidos (en orden de render): el
# Tercer Puesto va PRIMERO para que la card del hub de la selección
# humana (Francia, perdedora de semis) resuelva su partido del 3er
# puesto antes que la Final (en la que no juega). Los nombres deben
# coincidir EXACTAMENTE con MUNDIAL_KO_LABELS de misc_body_1.html para
# que la fecha de la PANTALLA DE PREVIA salga del calendario (31 May)
# y no del fallback new Date().
_PREVERANO_MAY_MATCHES = {
    3:  [("Mundial Grupo — J1",      "☀️")],
    7:  [("Mundial Grupo — J2",      "🌧")],
    11: [("Mundial Grupo — J3",      "☀️")],
    15: [("Mundial - Dieciseisavos", "☀️")],
    19: [("Mundial Octavos",         "☀️")],
    23: [("Mundial Cuartos",         "☀️")],
    27: [("Mundial Semis",           "☀️")],
    31: [("Mundial Tercer Puesto",   "☀️"),
         ("MUNDIAL GRAN FINAL 🏆",    "☀️")],
}
def _build_preverano_may_events():
    out = []
    for day in range(1, 32):
        date = "%02d May" % day
        ms = _PREVERANO_MAY_MATCHES.get(day)
        if ms:
            for i, (n, w) in enumerate(ms):
                eid = "pvm-%02d" % day if i == 0 else "pvm-%02d-%d" % (day, i)
                out.append({"id": eid, "date": date,
                            "icon": "🌍", "name": n, "weather": w})
        else:
            out.append({"id": "pvm-%02d" % day, "date": date,
                        "icon": "💤", "name": "Descanso", "weather": "☀️"})
    return out


def _ensure_preverano_may(data):
    """Garantiza la sección 'preverano' con los 31 días de Mayo
    (Mundial de Selecciones + descansos) colocada antes del bloque
    de Junio. Idempotente. Además depura eventos de Mayo (mes 4)
    en CUALQUIER otra sección para evitar duplicación."""
    if not isinstance(data, dict):
        return data
    secs = data.get("sections")
    if not isinstance(secs, list):
        return data
    # 1) Depura cualquier evento "* May" en secciones que NO sean preverano.
    for s in secs:
        if not isinstance(s, dict):
            continue
        if s.get("id") == "preverano":
            continue
        evs = s.get("events")
        if not isinstance(evs, list):
            continue
        kept = []
        for ev in evs:
            if not isinstance(ev, dict):
                continue
            p = _parse_event_date(ev.get("date"))
            if p is None or p[0] != 4:
                kept.append(ev)
        s["events"] = kept
    # 2) Localiza / crea la sección preverano.
    target = None; idx = -1
    for i, s in enumerate(secs):
        if isinstance(s, dict) and s.get("id") == "preverano":
            target = s; idx = i; break
    if target is None:
        target = {"id": "preverano",
                  "name": "PRE-VERANO",
                  "icon": "🌍", "variant": "preverano", "events": []}
        secs.insert(0, target); idx = 0
    canon = _build_preverano_may_events()
    cur = target.get("events") or []
    same = (len(cur) == len(canon) and all(
        isinstance(a, dict) and a.get("date") == b["date"]
        and a.get("name") == b["name"] and a.get("weather") == b["weather"]
        for a, b in zip(cur, canon)))
    if not same:
        target["events"] = canon
        target["name"] = "PRE-VERANO"
        target["icon"] = "🌍"
        target.setdefault("variant", "preverano")
    if idx != 0:
        secs.pop(idx)
        secs.insert(0, target)
    return data


# Fase Final SELECCIONES en MAYO (01–31). 9 partidos + 22 descansos
# (sin entrenamientos). Petición usuario 2026-05-20: como Mayo no se
# elimina del calendario, lo rellenamos con las fases finales de
# selecciones. Días de partido cada 2 (01,03,05,…,17 May).
_FASE_FINAL_MAY_MATCHES = [
    (1,  "Grupo — J1",                 "🌧"),
    (3,  "Grupo — J2",                 "☀️"),
    (5,  "Grupo — J3",                 "☀️"),
    (7,  "Grupo — J4",                 "☀️"),
    (9,  "Repesca",                    "🌧"),
    (11, "Octavos",                    "☀️"),
    (13, "Cuartos",                    "☀️"),
    (15, "Semifinal",                  "☀️"),
    (17, "GRAN FINAL SELECCIONES 🏆",   "☀️"),
]
def _build_fase_final_may_events():
    matches = {d: (n, w) for d, n, w in _FASE_FINAL_MAY_MATCHES}
    out = []
    for day in range(1, 32):
        date = "%02d May" % day
        if day in matches:
            n, w = matches[day]
            out.append({"id": "ffm-%02d" % day, "date": date,
                        "icon": "🌍", "name": n, "weather": w})
        else:
            out.append({"id": "ffm-%02d" % day, "date": date,
                        "icon": "💤", "name": "Descanso", "weather": "☀️"})
    return out


def _ensure_fase_final_may(data):
    """Garantiza que la sección 'fase-final-sel' contiene EXACTAMENTE
    los 31 eventos de Mayo (matches + descansos, sin entrenamientos)
    y la coloca antes del bloque de Junio para que renderice primero
    en el calendario. Idempotente."""
    if not isinstance(data, dict):
        return data
    secs = data.get("sections")
    if not isinstance(secs, list):
        return data
    target = None; idx = -1
    for i, s in enumerate(secs):
        if isinstance(s, dict) and s.get("id") == "fase-final-sel":
            target = s; idx = i; break
    if target is None:
        target = {"id": "fase-final-sel",
                  "name": "FASE FINAL SELECCIONES",
                  "icon": "🌍", "variant": "selecciones", "events": []}
        secs.insert(0, target); idx = 0
    # Garantiza el set canónico de Mayo (idempotente por firma).
    cur = target.get("events") or []
    canon = _build_fase_final_may_events()
    same = (len(cur) == len(canon) and all(
        isinstance(a, dict) and a.get("date") == b["date"]
        and a.get("name") == b["name"] for a, b in zip(cur, canon)))
    if not same:
        target["events"] = canon
        target["name"] = "FASE FINAL SELECCIONES"
        target["icon"] = "🌍"
        target.setdefault("variant", "selecciones")
    # Mueve la sección al inicio (antes de Junio) para orden cronológico.
    if idx != 0:
        secs.pop(idx)
        secs.insert(0, target)
    return data


def _dedupe_calendario(data):
    """Elimina duplicados que los inyectores antiguos pudieran haber
    persistido en BD antes de hacerlos idempotentes:

    1. Mundialito: si existen los canónicos 'Mundialito Clubes - JX'
       (del calendario.json), purga los server-managed 'mun-*'
       ('Mundialito- JX').
    2. Junio: elimina el bloque inyectado 'verano-jun' cuando OTRA
       sección (p.ej. 'verano-p1' del calendario.json) ya cubre Junio.

    Corre SIEMPRE (no gated por `_normalized_v`) para sanear cargas
    ya contaminadas sin requerir reset manual. Idempotente."""
    if not isinstance(data, dict):
        return data
    secs = data.get("sections")
    if not isinstance(secs, list):
        return data

    # 1. Mundialito duplicado: prioriza los 'Mundialito Clubes' y purga 'mun-*'.
    has_canon_mundialito = any(
        isinstance(ev, dict) and "Mundialito Clubes" in str(ev.get("name", ""))
        for s in secs if isinstance(s, dict)
        for ev in (s.get("events") or [])
    )
    if has_canon_mundialito:
        for s in secs:
            if isinstance(s, dict) and isinstance(s.get("events"), list):
                s["events"] = [
                    ev for ev in s["events"]
                    if not (isinstance(ev, dict)
                            and str(ev.get("id", "")).startswith("mun-"))
                ]

    # 2. Junio duplicado: si una sección que NO es 'verano-jun' ya trae
    #    Junio, la 'verano-jun' inyectada es redundante → la eliminamos.
    other_has_june = any(
        isinstance(s, dict) and s.get("id") != "verano-jun"
        and any(
            (_parse_event_date((ev or {}).get("date")) or (None,))[0] == 5
            for ev in (s.get("events") or [])
        )
        for s in secs
    )
    if other_has_june:
        data["sections"] = [
            s for s in secs
            if not (isinstance(s, dict) and s.get("id") == "verano-jun")
        ]
    return data


def _calendario_normalize(data):
    """Asegura el esqueleto mínimo y los defaults de un dict de calendario.

    Las inyecciones `_ensure_*` (Junio, Preverano, Mundialito) crean
    secciones SEMILLA pero NO machacan ediciones del usuario: solo
    corren cuando `_normalized_v < version`. Una vez normalizado para
    la versión actual, las cargas siguientes pasan por aquí sin tocar
    las secciones — los renombrados, añadidos o borrados del editor
    persisten para siempre."""
    if not isinstance(data, dict):
        return json.loads(json.dumps(CALENDARIO_DEFAULT))
    data.setdefault("version", 1)
    data.setdefault("season", "32-33")
    if not isinstance(data.get("sections"), list):
        data["sections"] = []
    cur_ver = data.get("version") or 1
    norm_ver = data.get("_normalized_v") or 0
    if norm_ver < cur_ver:
        _ensure_june_pretemp(data)
        _ensure_preverano_may(data)
        _ensure_mundialito(data)
        data["_normalized_v"] = cur_ver
    # Saneado SIEMPRE: aunque ya estuviera normalizado, limpia los
    # duplicados de Junio / Mundialito que inyectores antiguos pudieran
    # haber dejado persistidos en BD.
    _dedupe_calendario(data)
    return data


def _calendario_load_from_file():
    """Carga el calendario semilla del fichero git-baked (`calendario.json`).
    Esta es la fuente de verdad SOLO la primera vez (cuando GlobalState aún no
    tiene la clave). Después de cualquier edición el calendario se persiste en
    GlobalState y este fichero queda como semilla inmutable."""
    try:
        with open(CALENDARIO_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return json.loads(json.dumps(CALENDARIO_DEFAULT))
    return _calendario_normalize(data)


def load_calendario():
    """Carga el calendario priorizando la BD (GlobalState) sobre el fichero.

    En Render el fichero está en un volumen persistente, en Railway no — el
    disco es efímero y `calendario.json` se reescribe a su versión git-baked
    en cada deploy. Para que los add/edit/delete del admin sobrevivan a un
    reinicio del contenedor en Railway (DATABASE_URL → Postgres), guardamos
    el calendario en `GlobalState` igual que `liga_ext_*` y la liga global.

    La primera vez que se llama y la fila de GlobalState aún no existe, se
    siembra desde `calendario.json` (la versión inicial empaquetada con el
    repo). A partir de ahí, todas las mutaciones van a la BD y el fichero
    queda como semilla — nunca se sobreescribe."""
    try:
        row = GlobalState.query.filter_by(clave=CALENDARIO_GLOBAL_KEY).first()
    except Exception:
        # Si la BD aún no está lista (boot temprano), caemos al fichero.
        return _calendario_load_from_file()
    if row and row.valor_json:
        try:
            data = json.loads(row.valor_json)
        except (TypeError, ValueError):
            data = None
        if isinstance(data, dict):
            # Migración por schema-version: si el fichero git-baked declara
            # una versión > que la persistida en BD, la BD está vieja y la
            # reemplazamos por la semilla. Permite restaurar eventos
            # borrados (Ene–May en v2) sin requerir reset manual.
            db_ver = data.get("version") or 0
            seed = _calendario_load_from_file()
            seed_ver = seed.get("version") or 0
            if seed_ver > db_ver:
                try:
                    _calendario_save_to_db(seed)
                except Exception:
                    pass
                return seed
            _secs0 = data.get("sections") or []
            # ¿Hay ya contenido de Junio? (cualquier sección con un
            # evento de Junio, no solo el bloque inyectado 'verano-jun').
            # Si NO lo hay, hay que persistir tras inyectarlo.
            had_june = any(
                isinstance(s, dict)
                and any(
                    (_parse_event_date((ev or {}).get("date")) or (None,))[0] == 5
                    for ev in (s.get("events") or [])
                )
                for s in _secs0
            )
            _mun_before = _mun_sig(data)
            _evs_before = sum(
                len((s.get("events") or [])) for s in _secs0 if isinstance(s, dict)
            )
            data = _calendario_normalize(data)
            _evs_after = sum(
                len((s.get("events") or []))
                for s in (data.get("sections") or []) if isinstance(s, dict)
            )
            if (not had_june
                    or _mun_before != _mun_sig(data)
                    or _evs_before != _evs_after):
                try:
                    _calendario_save_to_db(data)
                except Exception:
                    pass
            return data
    # No hay fila aún → sembramos desde el fichero y persistimos.
    seed = _calendario_load_from_file()
    try:
        _calendario_save_to_db(seed)
    except Exception:
        pass
    return seed


def _calendario_save_to_db(data):
    """Persiste el calendario en GlobalState. Usa el mismo patrón que
    `_liga_ext_save`: upsert por clave, commit transaccional.

    Marca `_normalized_v = version` en cada write para que las cargas
    posteriores NO re-inyecten secciones semilla por encima de las
    ediciones del usuario (renombres / borrados / añadidos persistentes)."""
    if isinstance(data, dict):
        ver = data.get("version") or 1
        if (data.get("_normalized_v") or 0) < ver:
            data["_normalized_v"] = ver
    payload = json.dumps(data or {}, ensure_ascii=False)
    now = utc_now_iso()
    row = GlobalState.query.filter_by(clave=CALENDARIO_GLOBAL_KEY).first()
    if row:
        row.valor_json = payload
        row.updated_at = now
    else:
        row = GlobalState(clave=CALENDARIO_GLOBAL_KEY, valor_json=payload, updated_at=now)
        db.session.add(row)
    db.session.commit()


def save_calendario(data):
    """Escribe el calendario en BD (fuente de verdad) y, en paralelo,
    intenta volcarlo al fichero local. La escritura al fichero es
    best-effort: en Railway el disco es efímero pero seguir escribiéndolo
    facilita el desarrollo local (volcado JSON legible) y no rompe Render
    (donde sí persiste). El error de fichero NUNCA hace fallar la
    operación — la BD es lo único obligatorio."""
    _calendario_save_to_db(data)
    try:
        payload = json.dumps(data, ensure_ascii=False, indent=2)
        tmp = CALENDARIO_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            f.write(payload)
            try:
                f.flush()
                os.fsync(f.fileno())
            except OSError:
                pass
        os.replace(tmp, CALENDARIO_PATH)
    except OSError:
        pass

def _find_section(data, section_id):
    for s in data.get("sections") or []:
        if s.get("id") == section_id:
            return s
    return None

def _find_event(data, event_id):
    """Devuelve `(section, event, index)` o `(None, None, -1)`."""
    for s in data.get("sections") or []:
        evs = s.get("events") or []
        for i, ev in enumerate(evs):
            if ev.get("id") == event_id:
                return s, ev, i
    return None, None, -1

def _next_event_id(data):
    """Genera un id `ev-XXX` único incrementando el máximo existente."""
    max_n = 0
    for s in data.get("sections") or []:
        for ev in s.get("events") or []:
            eid = str(ev.get("id") or "")
            if eid.startswith("ev-"):
                try:
                    n = int(eid.split("-", 1)[1])
                    if n > max_n:
                        max_n = n
                except ValueError:
                    pass
    return "ev-" + str(max_n + 1).zfill(3)

def _normalize_event_fields(body):
    """Sanea y valida los campos del body de una petición add/edit.
    Devuelve `(fields_dict, error_msg)`."""
    date = str(body.get("date") or "").strip()
    name = str(body.get("name") or "").strip()
    icon = str(body.get("icon") or "").strip()
    weather = str(body.get("weather") or "").strip()
    if not date:
        return None, "falta fecha"
    if not name:
        return None, "falta nombre"
    if not icon:
        return None, "falta icono"
    if not weather:
        return None, "falta clima"
    # Cap de longitud anti-abuso.
    if len(date) > 20 or len(name) > 120 or len(icon) > 16 or len(weather) > 16:
        return None, "campos demasiado largos"
    return {"date": date, "name": name, "icon": icon, "weather": weather}, None

@app.route("/api/calendario", methods=["GET"])
def api_calendario_get():
    """Público: devuelve el calendario entero. El GET se usa tanto
    desde la UI pública como desde el modo edición admin para
    refrescar tras un cambio."""
    return jsonify({"ok": True, "calendario": load_calendario()})

@app.route("/api/calendario/add", methods=["POST"])
@admin_required
def api_calendario_add():
    """Añade un evento a una sección. Body:
    `{section_id, date, icon, name, weather}`. Devuelve el evento
    creado con el id asignado."""
    body = request.get_json(silent=True) or {}
    section_id = str(body.get("section_id") or "").strip()
    if not section_id:
        return jsonify({"ok": False, "error": "falta section_id"}), 400
    fields, err = _normalize_event_fields(body)
    if err:
        return jsonify({"ok": False, "error": err}), 400
    data = load_calendario()
    sec = _find_section(data, section_id)
    if sec is None:
        return jsonify({"ok": False, "error": "sección no encontrada"}), 404
    new_evt = {"id": _next_event_id(data)}
    new_evt.update(fields)
    sec.setdefault("events", []).append(new_evt)
    _sort_section_events(sec)
    save_calendario(data)
    return jsonify({"ok": True, "event": new_evt, "section_id": section_id})

@app.route("/api/calendario/edit", methods=["POST"])
@admin_required
def api_calendario_edit():
    """Edita un evento existente in-place. Body:
    `{event_id, date, icon, name, weather}`."""
    body = request.get_json(silent=True) or {}
    event_id = str(body.get("event_id") or "").strip()
    if not event_id:
        return jsonify({"ok": False, "error": "falta event_id"}), 400
    fields, err = _normalize_event_fields(body)
    if err:
        return jsonify({"ok": False, "error": err}), 400
    data = load_calendario()
    sec, ev, _idx = _find_event(data, event_id)
    if ev is None:
        return jsonify({"ok": False, "error": "evento no encontrado"}), 404
    ev.update(fields)
    _sort_section_events(sec)
    save_calendario(data)
    return jsonify({"ok": True, "event": ev, "section_id": sec.get("id")})

@app.route("/api/calendario/delete", methods=["POST"])
@admin_required
def api_calendario_delete():
    """Elimina un evento por id. Body: `{event_id}`.
    Se hace POST (no DELETE) por sencillez del cliente (fetch sin
    necesidad de métodos extra ni preflight CORS)."""
    body = request.get_json(silent=True) or {}
    event_id = str(body.get("event_id") or "").strip()
    if not event_id:
        return jsonify({"ok": False, "error": "falta event_id"}), 400
    data = load_calendario()
    sec, ev, idx = _find_event(data, event_id)
    if ev is None:
        return jsonify({"ok": False, "error": "evento no encontrado"}), 404
    sec["events"].pop(idx)
    save_calendario(data)
    return jsonify({"ok": True, "event_id": event_id, "section_id": sec.get("id")})


@app.context_processor
def inject_calendario():
    """Expone el calendario en las plantillas para el render SSR de
    la pantalla AGENDA 32-33 (mismo HTML que antes estaba hardcoded,
    ahora se genera con un loop Jinja a partir del JSON)."""
    return {
        "calendario_data": load_calendario(),
        "CALENDARIO_VALID_ICONS": sorted(CALENDARIO_VALID_ICONS),
        "CALENDARIO_VALID_WEATHERS": sorted(CALENDARIO_VALID_WEATHERS),
    }


# Mapas icon→clase y clima→clase usados en el render de la agenda y
# también desde el cliente para recomputar la fila tras un add/edit.
_AGENDA_ICON_CLASS_MAP = {
    "⚽": "ag-liga",
    "🏆": "ag-copa",
    "🇪🇺": "ag-eur",
    "🔵": "ag-eur",
    "🌍": "ag-sel",
    "🤝": "ag-amist",
    "🟡": "ag-inter",
    "🌐": "ag-inter",
    "🌞": "ag-torneo",
    "🏃": "ag-train",
    "💤": "ag-rest",
}
_AGENDA_WEATHER_CLASS_MAP = {
    "🌧": "ag-rain",
    "❄️": "ag-snow",
}

@app.template_filter("agenda_row_class")
def agenda_row_class(event):
    """Devuelve las clases CSS para un evento del calendario, p.ej.
    `ag-r ag-liga ag-rain`. Usado por Jinja al pintar cada fila y
    también por el filtro `tojson` en el bootstrap JS para que el
    cliente pueda reconstruir la misma clase al editar sin recargar."""
    if not isinstance(event, dict):
        return "ag-r"
    parts = ["ag-r"]
    icon = (event.get("icon") or "").strip()
    if icon in _AGENDA_ICON_CLASS_MAP:
        parts.append(_AGENDA_ICON_CLASS_MAP[icon])
    wx = (event.get("weather") or "").strip()
    if wx in _AGENDA_WEATHER_CLASS_MAP:
        parts.append(_AGENDA_WEATHER_CLASS_MAP[wx])
    return " ".join(parts)

# --- RUTAS ---
# ── LIVE STATE API (compartido entre dispositivos) ──────────────
@app.route("/api/live/state", methods=["GET"])
def api_live_state_get():
    """Devuelve el estado live compartido (parcial si el cliente manda
    `if_updated_after` y el servidor no tiene nada nuevo, devolvemos 304)."""
    data = load_live_state()
    since = request.args.get("since", "")
    if since and since == data["updated_at"]:
        # El cliente ya tiene la última versión, ahorramos ancho de banda.
        return ("", 304)
    return jsonify(data)

@app.route("/api/live/state", methods=["POST"])
def api_live_state_post():
    """Guarda el estado live compartido. Body JSON: {state: {...}}.
    Devuelve {state, updated_at}. No hay auth ni conflict detection:
    last-write-wins, suficiente para uso casual entre amigos."""
    body = request.get_json(silent=True) or {}
    incoming = body.get("state")
    if incoming is None:
        incoming = body  # aceptar también el body plano
    if not isinstance(incoming, dict):
        incoming = {}
    result = save_live_state(incoming)
    return jsonify(result)

# ── Ligas externas (Resto de Ligas — 51 países) ────────────────────
# Persistencia compartida entre dispositivos. Una fila de GlobalState
# por cada liga, con clave "liga_ext_<slug>". Cada liga guarda su
# propio {teams, results}.

import re as _re_liga_ext

def _liga_ext_slug(raw):
    s = unicodedata.normalize("NFD", str(raw or "")).encode("ascii", "ignore").decode("ascii")
    s = s.lower()
    s = _re_liga_ext.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "liga"

def _liga_ext_key(slug):
    return "liga_ext_" + _liga_ext_slug(slug)

def _liga_ext_load(slug):
    key = _liga_ext_key(slug)
    row = GlobalState.query.filter_by(clave=key).first()
    if not row:
        return {"teams": [], "results": []}
    try:
        data = json.loads(row.valor_json or "{}")
    except Exception:
        data = {}
    if not isinstance(data, dict):
        data = {}
    data.setdefault("teams", [])
    data.setdefault("results", [])
    return data

def _lx_norm_name(raw):
    """Normaliza un nombre de equipo para key/deletedTeamNames: sin
    acentos, minúsculas, solo alfanumérico+espacio, espacios colapsados."""
    s = unicodedata.normalize("NFD", str(raw or "")).encode("ascii", "ignore").decode("ascii")
    s = s.lower()
    s = _re_liga_ext.sub(r"[^a-z0-9]+", " ", s).strip()
    s = _re_liga_ext.sub(r"\s+", " ", s)
    return s


# Afijos de club que el CLIENTE (`_canonTeamName`, misc_body_1.html) elimina
# para colapsar "Europa FC" / "CE Europa" / "Europa" al mismo canónico. El
# servidor — chokepoint por el que pasan los 3 móviles + PC — DEBE usar la
# MISMA canonicalización en el colapso por nombre; si no, dos grafías del
# mismo club (id distinto por re-pegar la lista) SOBREVIVEN como filas
# duplicadas tras la fusión cross-device (bug 2026-06-11: "se duplican
# equipos"). NO toca "real"/"atletico" (parte semántica del nombre).
_LX_AFFIX_RE = _re_liga_ext.compile(
    r"\b(?:fc|cf|cd|sd|ud|ad|ce|sc|rc|cp|ac|club|football|deportivo|deportiva)\b")


def _lx_canon_name(raw):
    """Como `_lx_norm_name` pero además elimina afijos de club (FC, CF,
    CD…) — espejo del `_canonTeamName` del cliente. Se usa SOLO para el
    colapso/dedup por nombre y los backfills de identidad (escudo/estadio),
    nunca para `deletedTeamNames` (que viaja por nombre normalizado del
    cliente)."""
    s = _lx_norm_name(raw)
    if not s:
        return s
    s = _LX_AFFIX_RE.sub("", s)
    s = _re_liga_ext.sub(r"\s+", " ", s).strip()
    # Si quitar afijos vacía el nombre (p.ej. "FC"), conserva el normalizado.
    return s or _lx_norm_name(raw)


def _lx_team_key(t):
    """Clave estable de un equipo: id si existe, si no nombre normalizado."""
    if not isinstance(t, dict):
        return None
    tid = t.get("id")
    if isinstance(tid, str) and tid.strip():
        return "id:" + tid.strip()
    nm = _lx_norm_name(t.get("name"))
    return ("nm:" + nm) if nm else None


def _lx_updated_at(t):
    """`updatedAt` del equipo (ms epoch) o None si no está sellado."""
    if not isinstance(t, dict):
        return None
    v = t.get("updatedAt")
    try:
        return int(v) if v is not None and str(v) != "" else None
    except Exception:
        return None


def _lx_merge_teams(old_data, new_data):
    """Fusión POR EQUIPO (regla del usuario 2026-05-18: "última edición
    de cada equipo gana, venga del dispositivo que venga").

    Modelo: la liga es UN documento con los N equipos juntos. Con
    "admin + ayudantes" en varios móviles/PC, un POST de documento
    entero pisaba lo que otro acababa de editar (el anti-wipe del
    dispositivo del admin re-subía su copia completa). Aquí, en el
    ÚNICO chokepoint por el que pasan todos los dispositivos (el save
    del servidor), fusionamos `teams[]` por equipo quedándonos con la
    versión de mayor `updatedAt`:
      · ambos con updatedAt  → gana el más reciente
      · solo el entrante     → gana el entrante (edición explícita en
                               cliente nuevo)
      · solo el almacenado   → gana el almacenado (un cliente viejo /
                               sin sellar NO debe pisar una edición
                               sellada de otro)
      · ninguno con updatedAt → gana el entrante (comportamiento
                               actual; no regresiona single-user)
    Los equipos que un dispositivo NO mandó se CONSERVAN (no encoge el
    documento). Las bajas se propagan vía `deletedTeamNames` (unión) y
    se eliminan del resultado para que la fusión no resucite equipos
    borrados. Solo afecta a `teams`/`deletedTeamNames`; el resto de
    claves (results, config…) se mantiene como en el entrante."""
    if not isinstance(new_data, dict):
        return new_data
    new_teams = new_data.get("teams")
    if not isinstance(new_teams, list):
        return new_data
    old_teams = old_data.get("teams") if isinstance(old_data, dict) else []
    if not isinstance(old_teams, list):
        old_teams = []

    merged = {}      # key -> team dict
    order = []        # keys en orden (entrantes primero, luego solo-viejos)
    meta = {}         # key -> is_incoming de la versión ganadora

    def _consider(team, is_incoming):
        key = _lx_team_key(team)
        if not key:
            # Sin id ni nombre: lo dejamos pasar tal cual (no se puede
            # fusionar de forma fiable) usando una clave única.
            key = "anon:%d" % len(order)
        if key not in merged:
            merged[key] = team
            meta[key] = is_incoming
            order.append(key)
            return
        cur = merged[key]
        cu = _lx_updated_at(cur)
        nu = _lx_updated_at(team)
        if cu is not None and nu is not None:
            if nu >= cu:
                merged[key] = team
                meta[key] = is_incoming
        elif nu is not None and cu is None:
            merged[key] = team
            meta[key] = is_incoming
        elif nu is None and cu is None:
            # Ninguno sellado: gana el entrante (comportamiento previo).
            if is_incoming:
                merged[key] = team
                meta[key] = is_incoming
        # (cu set, nu None) → conservamos el almacenado/sellado.

    # Primero los viejos (base), luego los entrantes (pueden ganar).
    for t in old_teams:
        if isinstance(t, dict):
            _consider(t, False)
    for t in new_teams:
        if isinstance(t, dict):
            _consider(t, True)

    # Unión de deletedTeamNames y poda de equipos borrados.
    #
    # Regla "add trumps delete" (2026-05-20, petición usuario "fuerza
    # que un equipo creado se hidrate y se quede para siempre excepto
    # cuando lo elimine manualmente"): si un equipo aparece en el
    # `teams` ENTRANTE, ese add explícito gana sobre cualquier registro
    # de borrado previo. El cliente ya limpia `deletedTeamNames` al
    # guardar un equipo (lextSaveTeam → `data.deletedTeamNames =
    # ...filter(...)`), pero el servidor unía ambas listas y volvía a
    # podar el equipo, haciéndolo desaparecer en cada sync — bug visto
    # con Coventry City e Ipswich Town en la liga inglesa.
    incoming_names = set()
    if isinstance(new_teams, list):
        for t in new_teams:
            if isinstance(t, dict):
                nm = _lx_norm_name(t.get("name"))
                if nm:
                    incoming_names.add(nm)
    del_set = set()
    for src in (old_data if isinstance(old_data, dict) else {},
                new_data):
        dn = src.get("deletedTeamNames") if isinstance(src, dict) else None
        if isinstance(dn, list):
            for nm in dn:
                n = _lx_norm_name(nm)
                if n and n not in incoming_names:
                    del_set.add(n)

    # Colapso final POR NOMBRE NORMALIZADO (fix duplicados/triplicados
    # 2026-05-28). La fusión de arriba indexa por `id`, pero el editor
    # crea un `id` NUEVO cada vez que se re-pega la lista de equipos
    # (lextBulkAddTeams → uid()). Resultado: el viejo "Beerschot"(id:A)
    # y el re-pegado "Beerschot"(id:X) eran claves distintas y AMBOS
    # sobrevivían; con la regla "add trumps delete" el borrado por
    # nombre no los podaba → la liga se duplicaba/triplicaba en cada
    # ciclo borrar+repegar (foto usuario: Beerschot VA ×3, Charleroi
    # ×3, etc.). Aquí dos equipos que comparten nombre normalizado son
    # el MISMO equipo: nos quedamos con la versión más reciente por
    # `updatedAt` (empate → gana la entrante, p.ej. la lista recién
    # pegada con valoraciones nuevas).
    out_teams = []
    out_incoming = []
    by_name = {}     # nombre CANÓNICO (afijo-aware) -> índice en out_teams
    for key in order:
        t = merged[key]
        nm = _lx_norm_name(t.get("name"))
        if nm in del_set:
            continue
        inc = bool(meta.get(key))
        # Clave de dedup AFIJO-AWARE (= cliente `_teamCanonKey`): colapsa
        # "Europa"/"Europa FC"/"CE Europa" (y acentos/case) a una fila, que
        # `_lx_norm_name` (solo acentos/puntuación) dejaba escapar → dupes.
        cnm = _lx_canon_name(t.get("name"))
        if not cnm:
            out_teams.append(t)
            out_incoming.append(inc)
            continue
        if cnm not in by_name:
            by_name[cnm] = len(out_teams)
            out_teams.append(t)
            out_incoming.append(inc)
            continue
        # Colisión de nombre: mismo equipo con id distinto. Elegimos
        # ganador igual que en la fusión por id (updatedAt; empate sin
        # sellar → la entrante).
        idx = by_name[cnm]
        cur = out_teams[idx]
        cu = _lx_updated_at(cur)
        tu = _lx_updated_at(t)
        if tu is not None and cu is not None:
            take = tu >= cu
        elif tu is not None and cu is None:
            take = True
        elif tu is None and cu is None:
            take = inc and not out_incoming[idx]
        else:  # tu None, cu set → conservamos el sellado existente
            take = False
        if take:
            out_teams[idx] = t
            out_incoming[idx] = inc

    # BACKFILL DE IDENTIDAD POR NOMBRE — ESCUDO + ESTADIO + ALIAS eFOOTBALL
    # (2026-06-02 / 2026-06-11 / 2026-07-04) ────────────────────────────
    # Bug escudo (2026-06-02): "mi amigo puso todos los escudos de la Liga
    # Grecia desde su PC pero no sale ninguno". Bug estadio (2026-06-11):
    # "no se puede añadir estadios a los equipos" — un dispositivo con
    # `updatedAt` mayor pero sin estadio pisaba el que otro acababa de
    # poner. Bug alias eFootball (2026-07-04): "a mi amigo no le sale la
    # ❓️ pero a mí sí" — mismo mecanismo exacto, el campo que faltaba por
    # cubrir. La fusión por equipo elige al ganador por `updatedAt`; si ese
    # ganador NO trae escudo/estadio/alias (copia de otro dispositivo con
    # plantilla más reciente pero sin ese campo), el dato se perdía aunque
    # existiera en otra versión del MISMO equipo. Los 3 son datos de
    # IDENTIDAD: una vez puestos en CUALQUIER dispositivo no deben
    # desaparecer. Tras elegir ganadores rellenamos el campo de los
    # equipos que se quedaron sin él tomándolo de la versión más reciente
    # (old o new) que SÍ lo tenía. Indexado por nombre CANÓNICO
    # (afijo-aware) para que la identidad viaje también entre grafías del
    # mismo club. NUNCA pisa un valor ya presente en el ganador.
    def _lx_str_field(t, fld):
        if not isinstance(t, dict):
            return ""
        s = t.get(fld)
        return s.strip() if isinstance(s, str) and s.strip() else ""

    for _fld in ("shield", "stadium", "efootballAlias"):
        best_by_name = {}   # nombre canónico -> (ts, valor)
        for t in (old_teams + new_teams):
            if not isinstance(t, dict):
                continue
            nm = _lx_canon_name(t.get("name"))
            val = _lx_str_field(t, _fld)
            if not nm or not val:
                continue
            ts = _lx_updated_at(t) or 0
            cur = best_by_name.get(nm)
            if cur is None or ts >= cur[0]:
                best_by_name[nm] = (ts, val)
        if best_by_name:
            for t in out_teams:
                if not isinstance(t, dict) or _lx_str_field(t, _fld):
                    continue
                nm = _lx_canon_name(t.get("name"))
                best = best_by_name.get(nm) if nm else None
                if best:
                    t[_fld] = best[1]

    # BACKFILL DE IDENTIDAD — PLANTILLA DE JUGADORES (2026-07-02) ───────
    # Bug usuario ("Resto del Mundo no guarda plantillas ni escudos"):
    # espejo EXACTO del backfill de escudo/estadio de arriba, pero para
    # `players[]`. El ganador por `updatedAt` de un equipo puede venir de
    # un dispositivo/simulación que tocó solo el nivel/power (sin roster
    # todavía) mientras OTRA copia del MISMO equipo sí tiene la plantilla
    # completa — sin este backfill esa plantilla se perdía en cuanto la
    # copia sin jugadores ganaba la fusión por ser más reciente. NUNCA
    # pisa un roster ya presente en el ganador (gana la edición real).
    #
    # GENÉRICO NUNCA GANA A REAL (2026-07-29): bug usuario — "Simular
    # todas las ligas" (bulk sim) fabricaba, para equipos cuyo SQUAD_REGISTRY
    # no resolvía a tiempo, una plantilla placeholder de 30 "Jugador N"
    # (`_lextEnsureDefaultRoster`) y la guardaba. Como ni esa plantilla
    # genérica NI la real anterior llevan `updatedAt` sellado, la entrante
    # (genérica) ganaba la fusión por-equipo de arriba y BORRABA para
    # siempre la plantilla real de TODOS los dispositivos (Inglaterra,
    # Alemania, Italia, Francia, Países Bajos, Portugal y la mayoría de
    # clasificados a Champions, reportado 2026-07-29). El backfill de
    # arriba NO lo cubría porque solo mira "vacío vs no-vacío" — un roster
    # genérico SÍ tiene 30 entradas, así que nunca disparaba. Aquí
    # detectamos el roster placeholder por su firma exacta (nombres
    # "Jugador N") y, si existe una copia REAL del mismo equipo en
    # cualquiera de las dos versiones (old o new), esa real SIEMPRE gana,
    # sin importar antigüedad ni cuál ganó la fusión por-equipo de arriba.
    def _lx_roster_is_generic(players):
        if not isinstance(players, list) or not players:
            return False
        names = [p.get("name") for p in players if isinstance(p, dict)]
        if not names:
            return False
        generic_re = re.compile(r"^jugador\s*\d+$", re.IGNORECASE)
        generic_n = sum(1 for n in names if isinstance(n, str) and generic_re.match(n.strip()))
        if generic_n >= max(1, int(len(names) * 0.8)):
            return True
        # FIRMA "APLANADA" (2026-08-17) — bug real Betis, liga-ea-sports:
        # nombres REALES pero TODOS los jugadores con power/pos puestos
        # EXPLÍCITAMENTE al placeholder genérico (power == 70, pos ==
        # 'MED'). Es la firma exacta del rebuild stats-only (Fuentes
        # C/E/F del click handler cliente,
        # `document.addEventListener('click', ...)` en misc_body_1.html)
        # cuando llegaba a persistirse — el cliente ya NO lo persiste
        # desde este mismo commit, pero esta es la red de seguridad
        # server-side por si CUALQUIER otra vía llega a mandar este
        # patrón. IMPORTANTE: solo cuenta si el campo está PRESENTE y
        # coincide con el valor exacto del placeholder — un jugador sin
        # `power`/`pos` (dato real recién creado, aún sin rellenar) NO
        # cuenta como genérico. Tratar "ausente" igual que "70"/"MED"
        # (como sí hace el heurístico de DISPLAY `_hubRowLooksGeneric`
        # en JS) causaba falsos positivos aquí: un roster real minimalista
        # (sin pos/power todavía) podía perder la fusión frente a una
        # copia vieja de OTRO dispositivo — justo lo que este backfill
        # existe para evitar.
        total = 0
        flat_n = 0
        for p in players:
            if not isinstance(p, dict) or not p.get("name"):
                continue
            total += 1
            pw_raw = p.get("power")
            try:
                pw = float(pw_raw) if pw_raw not in (None, "") else None
            except (TypeError, ValueError):
                pw = None
            is_generic_pw = (pw == 70)
            pos_raw = p.get("pos")
            is_generic_pos = isinstance(pos_raw, str) and pos_raw.strip().upper() == "MED"
            if is_generic_pw and is_generic_pos:
                flat_n += 1
        if total >= 2 and (flat_n / total) >= 0.9:
            return True
        return False

    best_roster_by_name = {}   # nombre canónico -> (ts, players, is_generic)
    for t in (old_teams + new_teams):
        if not isinstance(t, dict):
            continue
        nm = _lx_canon_name(t.get("name"))
        players = t.get("players")
        if not nm or not isinstance(players, list) or not players:
            continue
        ts = _lx_updated_at(t) or 0
        is_gen = _lx_roster_is_generic(players)
        cur = best_roster_by_name.get(nm)
        if cur is None:
            best_roster_by_name[nm] = (ts, players, is_gen)
            continue
        cur_ts, cur_players, cur_gen = cur
        if cur_gen and not is_gen:
            # Lo real SIEMPRE desplaza a lo genérico, sin mirar el sello.
            best_roster_by_name[nm] = (ts, players, is_gen)
        elif is_gen and not cur_gen:
            pass  # ya tenemos una versión real guardada; se conserva
        elif ts >= cur_ts:
            best_roster_by_name[nm] = (ts, players, is_gen)
    if best_roster_by_name:
        for t in out_teams:
            if not isinstance(t, dict):
                continue
            players = t.get("players")
            nm = _lx_canon_name(t.get("name"))
            best = best_roster_by_name.get(nm) if nm else None
            if not best:
                continue
            best_ts, best_players, best_gen = best
            has_players = isinstance(players, list) and bool(players)
            if not has_players:
                t["players"] = best_players
                continue
            if _lx_roster_is_generic(players) and not best_gen:
                t["players"] = best_players

    result = dict(new_data)
    result["teams"] = out_teams
    if del_set:
        result["deletedTeamNames"] = sorted(del_set)

    # BACKFILL DEL LOGO DE LA LIGA (2026-06-11) ───────────────────────
    # Bug usuario: "se borran logos de ligas". El logo PROPIO de la
    # competición vive en `config.logo`/`config.cupLogo` (top-level del
    # documento), que esta fusión adopta VERBATIM del entrante
    # (`dict(new_data)`). Como `ensureConfig` (cliente) fuerza
    # `config.logo = ''` en TODO dispositivo que nunca lo puso, un POST de
    # ese dispositivo BORRABA el logo que otro había guardado
    # (last-write-wins, sin arbitraje). El logo es IDENTIDAD (igual que el
    # escudo): si el entrante no lo trae pero el almacenado SÍ, lo
    # CONSERVAMOS. Nunca pisa un logo entrante no vacío (edición real del
    # admin manda).
    try:
        old_cfg = old_data.get("config") if isinstance(old_data, dict) else None
        if isinstance(old_cfg, dict):
            new_cfg = result.get("config")
            new_cfg = dict(new_cfg) if isinstance(new_cfg, dict) else {}
            changed_cfg = False
            for _lf in ("logo", "cupLogo"):
                nv = new_cfg.get(_lf)
                ov = old_cfg.get(_lf)
                nv_ok = isinstance(nv, str) and nv.strip()
                ov_ok = isinstance(ov, str) and ov.strip()
                if (not nv_ok) and ov_ok:
                    new_cfg[_lf] = ov
                    changed_cfg = True
            if changed_cfg:
                result["config"] = new_cfg
    except Exception:
        pass

    # PRESERVAR LA CLASIFICACIÓN POR RECENCIA — `results`/`resultsStamp`
    # (2026-06-12) ─────────────────────────────────────────────────────
    # Bug usuario ("simulo las ligas de Resto de Ligas una a una y al
    # abrirlas no se guarda"): la clasificación se calcula 100% desde
    # `data.results`, pero la fusión adoptaba `results` VERBATIM del
    # entrante (`dict(new_data)`). Un POST stale de otro dispositivo (que
    # nunca simuló esa liga, o aún tiene la temporada vieja) vaciaba los
    # resultados recién simulados por otro. Es el mismo principio que el
    # acta de la Liga EA (`_preserve_results_acta`): los `results` NO se
    # pierden por una copia más vieja. Cada sim/reset del cliente sella
    # `resultsStamp` (ms); preservamos los `results` de la copia con el
    # sello MAYOR. Un reset legítimo (sello fresco) sí limpia; un POST con
    # sello menor o ausente nunca pisa una clasificación más nueva.
    #
    # EMPTY-GUARD (2026-06-18) ──────────────────────────────────────────
    # Bug usuario ("simulo Montenegro e Irlanda del Norte y al volver están
    # a cero"): estas DOS ligas son las únicas SEMBRADAS en el cliente
    # (`_ensureExtraLeagueSeed`), y la semilla escribe `results: []` SIN
    # `resultsStamp` (sello 0). El guard de recencia de arriba solo
    # preservaba cuando `old_stamp > new_stamp` (estricto): si un
    # dispositivo que SOLO sembró la liga (nunca la simuló) empuja su
    # semilla vacía y los sellos EMPATAN a 0 (o el almacenado no tiene
    # sello), el `results: []` entrante MACHACABA la clasificación simulada
    # por otro dispositivo. Espejo de la regla del acta: una clasificación
    # NO vacía nunca se pierde por una copia VACÍA salvo que ésta porte un
    # sello ESTRICTAMENTE mayor (un reset legítimo). Así un seed/stale vacío
    # (sello ≤ almacenado) jamás vacía una liga simulada, aunque ambos
    # sellos sean 0.
    try:
        new_stamp = float(new_data.get("resultsStamp") or 0)
        old_stamp = float(old_data.get("resultsStamp") or 0) if isinstance(old_data, dict) else 0.0
        old_results = old_data.get("results") if isinstance(old_data, dict) else None
        new_results = new_data.get("results")
        old_nonempty = isinstance(old_results, list) and len(old_results) > 0
        new_empty = (not isinstance(new_results, list)) or len(new_results) == 0
        if old_stamp > new_stamp and isinstance(old_results, list):
            # El almacenado es ESTRICTAMENTE más reciente → se conserva entero.
            result["results"] = old_results
            result["resultsStamp"] = old_stamp
        elif old_nonempty and new_empty and new_stamp <= old_stamp:
            # El entrante viene VACÍO sin un sello mayor (seed/stale): NO
            # puede vaciar una clasificación ya simulada. Solo un reset
            # (vacío + sello estrictamente mayor) cae en la rama de arriba.
            result["results"] = old_results
            result["resultsStamp"] = old_stamp
    except Exception:
        pass

    return result


def _liga_ext_save(slug, data):
    key = _liga_ext_key(slug)
    row = GlobalState.query.filter_by(clave=key).first()
    # Fusión por equipo contra lo ya almacenado para no perder las
    # ediciones de otros dispositivos (admin + ayudantes).
    try:
        old = _liga_ext_load(slug)
        data = _lx_merge_teams(old, data)
    except Exception:
        pass
    payload = json.dumps(data or {}, ensure_ascii=False)
    now = utc_now_iso()
    if row:
        row.valor_json = payload
        row.updated_at = now
    else:
        row = GlobalState(clave=key, valor_json=payload, updated_at=now)
        db.session.add(row)
    db.session.commit()
    # Propagar a la tabla en memoria que consume la simulación Python.
    try:
        _refresh_player_flags_from_liga_ext(data)
    except Exception:
        pass
    return row


def _refresh_player_flags_from_liga_ext(data):
    """Reconstruye TEAM_PLAYER_FLAGS leyendo team.players[].{captain,freeKick,
    penalty,elite,natGoal,natGoalPro} del blob de ligaExt recién guardado. Es
    la vía por la que las marcas asignadas en el editor se aplican para
    SIEMPRE al motor de simulación Python — sin esto los flags vivían solo en
    el JS y las simulaciones del servidor (calendario IA) los ignoraban."""
    if not isinstance(data, dict):
        return
    teams = data.get("teams") or []
    if not isinstance(teams, list):
        return
    for team in teams:
        if not isinstance(team, dict):
            continue
        team_name = team.get("name") or team.get("shortName") or ""
        if not team_name:
            continue
        players = team.get("players") or []
        if not isinstance(players, list):
            continue
        team_flags = {}
        for p in players:
            if not isinstance(p, dict):
                continue
            player_name = p.get("name") or p.get("nombre") or ""
            if not player_name:
                continue
            flags = {}
            for key, src in (
                ("captain",    "captain"),
                ("freeKick",   "freeKick"),
                ("penalty",    "penalty"),
                ("elite",      "elite"),
                ("natGoal",    "natGoal"),
                ("natGoalPro", "natGoalPro"),
            ):
                if bool(p.get(src)):
                    flags[key] = True
            if flags:
                team_flags[player_name] = flags
        if team_flags:
            TEAM_PLAYER_FLAGS[team_name] = team_flags
            resolved = resolve_team_name(team_name)
            if resolved and resolved != team_name:
                TEAM_PLAYER_FLAGS[resolved] = team_flags


def _load_player_flags_on_startup():
    """Carga TEAM_PLAYER_FLAGS desde GlobalState al arrancar el servidor.
    Lee todas las filas liga_ext_* y extrae los flags. Así los flags sobre-
    viven a reinicios del contenedor (Railway) sin que el cliente tenga que
    tocar nada."""
    try:
        rows = GlobalState.query.filter(GlobalState.clave.like("liga_ext_%")).all()
    except Exception:
        return
    for row in rows or []:
        try:
            data = json.loads(row.valor_json or "{}")
        except Exception:
            continue
        try:
            _refresh_player_flags_from_liga_ext(data)
        except Exception:
            continue


@app.route("/api/liga-ext", methods=["GET"])
def api_liga_ext_index():
    """Índice de TODAS las ligas externas guardadas en el servidor.
    Devuelve los slugs EXACTOS (tal cual están en GlobalState) + nombre
    y nº de equipos. Lo usa el editor de torneos para prefetchear las
    51 Resto de Ligas (+ EA/Hypermotion/1ªRFEF) sin tener que adivinar
    el slug desde la etiqueta en español. 2026-05-17."""
    out = []
    try:
        rows = GlobalState.query.filter(GlobalState.clave.like("liga_ext_%")).all()
    except Exception:
        rows = []
    for row in rows or []:
        clave = row.clave or ""
        if not clave.startswith("liga_ext_"):
            continue
        rest = clave[len("liga_ext_"):]
        # Excluir derivados (protected). Las claves canónicas son
        # exactamente `liga_ext_<slug>`.
        if not rest or rest.endswith("_protected"):
            continue
        # 2026-08-10: las 43 ligas ya fusionadas en liga-mixta-1..9 nunca
        # deben aparecer aquí — este índice alimenta el picker "AÑADIR
        # POR LIGA" del editor de torneos; mostrarlas confundiría al
        # admin con países que ya no existen como liga independiente.
        if _is_dead_merged_league_slug(rest):
            continue
        try:
            data = json.loads(row.valor_json or "{}")
        except Exception:
            continue
        if not isinstance(data, dict):
            continue
        teams = data.get("teams")
        count = 0
        if isinstance(teams, list):
            count = sum(1 for t in teams if isinstance(t, dict) and t.get("name"))
        if count == 0:
            continue
        out.append({
            "slug": rest,
            "name": data.get("name") or rest,
            "count": count,
        })
    out.sort(key=lambda x: x["slug"])
    return jsonify({"ok": True, "leagues": out})


@app.route("/api/liga-ext/<slug>", methods=["GET"])
def api_liga_ext_get(slug):
    if _is_dead_merged_league_slug(_liga_ext_slug(slug)):
        return jsonify(_dead_league_empty_get(slug))
    data = _liga_ext_load(slug)
    row = GlobalState.query.filter_by(clave=_liga_ext_key(slug)).first()
    updated_at = row.updated_at if row else ""
    since = request.args.get("since", "")
    if since and since == (updated_at or ""):
        return ("", 304)
    return jsonify({
        "ok": True,
        "slug": _liga_ext_slug(slug),
        "data": data,
        "updated_at": updated_at or "",
    })

@app.route("/api/liga-ext-any/<slug>", methods=["GET"])
def api_liga_ext_any_get(slug):
    """Como `/api/liga-ext/<slug>` pero con el fallback a `_protected`
    resuelto EN EL SERVIDOR (una sola petición del cliente). Antes el
    picker "AÑADIR POR LIGA" (`_eurPickerLoadLeague`) hacía 2 fetches
    CLIENT-SIDE secuenciales (main, y si viene vacío, protected), cada
    uno con sus propios reintentos — hasta 5 round-trips en cadena
    (60 s de espera en el peor caso) para una liga menor nunca tocada
    en este dispositivo. Mismo principio que `/api/team-alias/<nombre>`
    (2026-07-05): la búsqueda con fallback vive en el servidor, el
    cliente hace UNA sola petición."""
    if _is_dead_merged_league_slug(_liga_ext_slug(slug)):
        return jsonify(_dead_league_empty_get(slug, {"source": "main"}))
    data = _liga_ext_load(slug)
    source = "main"
    if not (isinstance(data.get("teams"), list) and len(data["teams"]) >= 2):
        prow = GlobalState.query.filter_by(clave=_protected_key(slug)).first()
        if prow and prow.valor_json:
            try:
                pdata = json.loads(prow.valor_json)
            except Exception:
                pdata = None
            if isinstance(pdata, dict) and isinstance(pdata.get("teams"), list) and len(pdata["teams"]) >= 2:
                data = pdata
                source = "protected"
    return jsonify({
        "ok": True,
        "slug": _liga_ext_slug(slug),
        "data": data,
        "source": source,
    })

@app.route("/api/liga-ext-bulk", methods=["GET"])
def api_liga_ext_bulk_get():
    """Restaura TODAS las ligas externas en UNA sola petición.

    Motivo (2026-07-23, «el 90% de las ligas sale sin equipos… incluso
    República Checa ya no merge»): tras un borrado de datos de
    navegación el `localStorage` del dispositivo queda VACÍO, así que
    CADA liga de "Resto de Ligas" tiene que descargarse del servidor al
    abrirla. Descargarlas de una en una (o peor, las ~50 de golpe en el
    boot) es frágil — la tormenta de peticiones satura los 2 workers de
    gunicorn y solo las primeras que ganan la carrera aparecen; el resto
    se quedan "sin equipos" para siempre en ese arranque. Este endpoint
    resuelve el main→`_protected` de TODAS las ligas EN EL SERVIDOR con
    UNA sola query a la BD y devuelve el roster completo de cada una en
    UNA sola respuesta, para que el cliente restaure el 100% de las
    ligas de golpe sin ninguna carrera ni tormenta de red.

    Cada liga se resuelve igual que `/api/liga-ext-any/<slug>`: si el
    `main` viene VACÍO (<2 equipos) se cae a su snapshot `_protected`
    (monotónico, nunca encoge). Solo se incluyen ligas con ≥2 equipos
    reales — las verdaderamente vacías no se envían (no hay nada que
    restaurar y no hay que confundirlas con un fallo de carga)."""
    try:
        rows = GlobalState.query.filter(GlobalState.clave.like("liga_ext_%")).all()
    except Exception:
        rows = []
    mains = {}
    prots = {}
    for row in rows or []:
        clave = row.clave or ""
        if not clave.startswith("liga_ext_"):
            continue
        rest = clave[len("liga_ext_"):]
        if not rest:
            continue
        if _is_dead_merged_league_slug(rest):
            continue
        try:
            data = json.loads(row.valor_json or "{}")
        except Exception:
            continue
        if not isinstance(data, dict):
            continue
        if rest.endswith("_protected"):
            prots[rest[:-len("_protected")]] = data
        else:
            mains[rest] = data

    def _team_count(d):
        t = (d or {}).get("teams")
        if not isinstance(t, list):
            return 0
        return sum(1 for x in t if isinstance(x, dict) and x.get("name"))

    def _light_team(t):
        """Copia LIGERA de un equipo para la tabla de clasificación: sin
        `players[]` (el 90% del peso — rosters con stats/escudos por
        jugador). La pantalla de clasificación NO necesita la plantilla;
        al ABRIR la liga, `fetchData` trae el documento COMPLETO por-liga.
        Así el bulk no carga decenas de MB en memoria ni satura la BD."""
        if not isinstance(t, dict):
            return t
        out = {}
        for kk, vv in t.items():
            if kk == "players":
                continue
            out[kk] = vv
        return out

    leagues = {}
    slugs = set(mains.keys()) | set(prots.keys())
    for slug in slugs:
        try:
            main = mains.get(slug) or {}
            chosen = main
            if _team_count(main) < 2:
                prot = prots.get(slug)
                if prot and _team_count(prot) >= 2:
                    chosen = prot
            if _team_count(chosen) < 2:
                continue
            if not isinstance(chosen, dict):
                continue
            light = {}
            for kk, vv in chosen.items():
                if kk == "teams":
                    continue
                light[kk] = vv
            light["teams"] = [_light_team(t) for t in (chosen.get("teams") or [])]
            light.setdefault("results", [])
            light["_lightBulk"] = True  # marca: rosters incompletos, re-fetch al abrir
            leagues[slug] = light
        except Exception:
            continue

    return jsonify({"ok": True, "count": len(leagues), "leagues": leagues})


# Las 43 ligas menores que se fusionaron en liga-mixta-1..9 (2026-07-30/31,
# ver templates/partials/misc_body_1.html LEAGUE_DEFAULT_NAMES) MÁS las
# propias liga-mixta-1..9 (ANIQUILADAS por completo el 2026-08-15, petición
# usuario — ya no son ligas jugables; el feeder de la Previa pasó a
# germanika/hellas-slavia/danubio-nordica/adriatico-oriental/balkanica/
# eurasia). Sus slugs ya NO existen en LEAGUE_DEFAULT_ZONES/NAMES ni en
# ninguna menu-card de "Resto de Ligas" — el cliente ya purga su copia
# LOCAL (localStorage) con los flags `ftbol_merged_leagues_purge_v1..v13`,
# pero esa purga nunca tocó el servidor a propósito ("solo local, nunca
# toca el servidor"). Las filas `liga_ext_<slug>` (+ `_protected`/
# `_snap_*`/`_backup`) de estas ligas seguirían en la base de datos para
# siempre si no se filtran/borran aquí, y `/api/liga-ext-bulk` (y otros
# endpoints que hacen `clave LIKE 'liga_ext_%'`) las seguiría devolviendo
# sin filtrar — un dispositivo que purgó su copia local puede volver a
# adoptarlas del servidor en el siguiente bulk-restore, resucitando la
# purga. Petición usuario 2026-08-08 (ampliada 2026-08-15): "quiero que
# las elimines para siempre y liberes espacio" / "aniquila cualquier
# resto".
DEAD_MERGED_LEAGUE_SLUGS = [
    # liga-mixta-1
    "rep-checa", "grecia", "san-marino", "gales", "georgia",
    # liga-mixta-2
    "polonia", "noruega", "montenegro", "luxembgo", "bielorrsa",
    # liga-mixta-3
    "chipre", "austria", "andorra", "gibraltar", "n-irlanda",
    # liga-mixta-4
    "suecia", "croacia", "lituania", "n-maced", "albania",
    # liga-mixta-5
    "israel", "hungria", "ucrania", "estonia", "malta",
    # liga-mixta-6 (Alemania se elimina como liga propia; solo 6 de sus
    # equipos migraron a mano a liga-mixta-6, el resto no migra a ningún
    # sitio)
    "alemania", "serbia", "rumania", "is-feroe", "letonia",
    # liga-mixta-7
    "eslovenia", "bulgaria", "bosnia", "kazajst", "kosovo",
    # liga-mixta-8
    "rusia", "armenia", "finlandia", "moldavia", "azerbayan",
    # liga-mixta-9
    "eslovaquia", "irlanda", "islandia",
    # Las 9 "Ligas Mixtas" viejas EN SÍ (2026-08-15, ANIQUILADAS por
    # completo junto con las 43 de arriba)
    "liga-mixta-1", "liga-mixta-2", "liga-mixta-3", "liga-mixta-4",
    "liga-mixta-5", "liga-mixta-6", "liga-mixta-7", "liga-mixta-8",
    "liga-mixta-9",
    # "null" (2026-08-18): artefacto de guardados con slug sin fijar
    # (`CURRENT_KEY` arrancaba en `null`), nunca fue una liga real.
    # `saveData` bloquea escrituras NUEVAS desde 2026-08-15, pero filas
    # ya existentes de antes de ese guard necesitan el mismo tratamiento
    # que una liga fusionada para desaparecer de /api/liga-ext-bulk.
    "null",
    # Reconstrucción mínima del proyecto (petición usuario: "elimina por
    # completo toda la web... solo deja la simulación de partidos ia vs
    # ia, y la simulación de partidos humano contra humano"). Todas las
    # pantallas de navegación de estas ligas ya se borraron del cliente,
    # pero sus filas seguían vivas en el servidor y accesibles por una
    # puerta trasera (el panel Admin > "Espacio del navegador" abre el
    # editor compartido de plantilla directo por slug). Se tratan igual
    # que las ligas fusionadas de arriba: nunca se sirven, se purgan de
    # la base de datos para siempre. `liga-ea-sports` NUNCA entra aquí —
    # es la única competición que sobrevive.
    # Las 10 ligas-país "sueltas" del catálogo cerrado de Resto de Ligas:
    "inglaterra", "italia", "francia", "portugal", "p-bajos", "belgica",
    "turquia", "dinamarca", "suiza", "escocia",
    # Las 6 "Ligas Mixtas" NUEVAS (feeder de la Previa, 2026-08-14):
    "germanika", "hellas-slavia", "danubio-nordica", "adriatico-oriental",
    "balkanica", "eurasia",
    # Resto del Mundo + las 2 ligas fijas que NO son Liga EA Sports:
    "resto-mundo", "liga-hypermotion", "liga-primera-federacion",
]


def _is_dead_merged_league_slug(rest):
    """¿`rest` (la parte de la clave tras `liga_ext_`) pertenece a una de
    las 43 ligas menores ya fusionadas en liga-mixta-1..9, o a las propias
    liga-mixta-1..9 (ANIQUILADAS por completo)? Match exacto o con sufijo
    `_algo` (cubre `_protected`/`_snap_<ts>`/`_backup`), mismo criterio
    que ya usaba (duplicado inline) el purgado admin de abajo.

    FIX 2026-08-10 (screenshots usuario, "📊 Espacio del navegador" con
    decenas de KB de `-backup`/`-snap-<ts>`/`-protected` de países ya
    fusionados — Alemania, Chipre, Estonia, Bielorrusia, Gales, etc.):
    el comentario de arriba YA avisaba de este riesgo exacto ("un
    dispositivo que purgó su copia local puede volver a adoptarlas del
    servidor en el siguiente bulk-restore") pero NUNCA se implementó el
    filtro — `/api/liga-ext-bulk` y `/api/liga-ext` seguían devolviendo
    las 43 ligas muertas sin filtrar mientras el admin no pulsara
    `/api/admin/purge-dead-leagues` a mano. Cualquier bulk-restore normal
    (se dispara solo al abrir CUALQUIER liga real que esté vacía en
    local, o con el botón "🔄 RECUPERAR TODAS LAS LIGAS") las traía de
    vuelta a `localStorage` + IndexedDB, deshaciendo la purga local v9
    silenciosamente. Filtrar aquí, en el ORIGEN, hace que esto ya no
    dependa de que el admin recuerde pulsar el botón de borrado
    permanente — las 43 ligas quedan invisibles para cualquier cliente
    desde YA, aunque sus filas sigan físicamente en la base de datos
    hasta que se borren de verdad."""
    if not rest:
        return False
    for slug in DEAD_MERGED_LEAGUE_SLUGS:
        if rest == slug:
            return True
        # El sufijo derivado (_protected/_snap_<ts>/_backup) puede llevar
        # "_" (convención actual del escritor) O "-" (restos de una
        # convención anterior, confirmados en datos reales de producción:
        # `liga_ext_grecia-backup`, `liga_ext_alemania-snap-<ts>`). Sin
        # aceptar ambos, estas filas seguían sirviéndose en cada
        # bulk-restore y sobrevivían INTACTAS al botón "eliminar del
        # servidor" (2026-08-16, petición usuario — llevaban regresando
        # pese a purgarlas "no sé cuántas veces").
        if rest.startswith(slug + "_") or rest.startswith(slug + "-"):
            return True
    return False


def _dead_league_empty_get(slug, extra=None):
    """Respuesta GET para un slug de liga MUERTA: se comporta EXACTAMENTE
    como si esa liga nunca hubiera existido — mismo shape que devuelven
    `_liga_ext_load`/`/api/liga-ext-protected` para un slug realmente
    inexistente. Cierra el hueco que `/api/liga-ext/<slug>`,
    `/api/liga-ext-any/<slug>` y `/api/liga-ext-protected/<slug>`
    dejaban abierto: el filtro de `_is_dead_merged_league_slug` ya
    protegía `/api/liga-ext` (index) y `/api/liga-ext-bulk`, pero
    CUALQUIER cliente (viejo, nuevo, o una herramienta de recuperación
    como `lextDeepRecoverSlug`) que pidiera el slug UNO A UNO seguía
    recibiendo los datos reales — resucitando en local lo que el
    usuario ya había purgado."""
    out = {"ok": True, "slug": _liga_ext_slug(slug), "data": {"teams": [], "results": []}, "updated_at": ""}
    if extra:
        out.update(extra)
    return out


def _purge_dead_merged_leagues():
    """Borra PERMANENTEMENTE de la base de datos las filas de las 43
    ligas menores que se fusionaron en liga-mixta-1..9, MÁS las propias
    liga-mixta-1..9 (ANIQUILADAS por completo, ver `DEAD_MERGED_LEAGUE_SLUGS`).
    Incluye el `main` de cada una (`liga_ext_<slug>`) y todos sus derivados
    (`_protected`, `_snap_<ts>`, `_backup`, cualquier sufijo futuro, con
    separador `_` o `-`).

    Idempotente: si ya se borraron (o nunca existieron), no hace nada y
    devuelve `[]` — se puede llamar tantas veces como haga falta sin
    riesgo. Devuelve la lista de claves borradas.

    Extraída (2026-08-16, petición usuario "no quiero tener que eliminar
    ligas antiguas que ya debías haber eliminado") del endpoint admin
    para poder llamarla TAMBIÉN automáticamente en cada arranque del
    servidor, sin depender de que nadie pulse un botón con PIN — las
    filas quedan borradas de la BD en cuanto el fix se despliega, para
    los 6 dispositivos, sin acción humana."""
    try:
        rows = GlobalState.query.filter(GlobalState.clave.like("liga_ext_%")).all()
    except Exception:
        rows = []
    deleted_keys = []
    for row in rows or []:
        clave = row.clave or ""
        if not clave.startswith("liga_ext_"):
            continue
        rest = clave[len("liga_ext_"):]
        if not _is_dead_merged_league_slug(rest):
            continue
        deleted_keys.append(clave)
        db.session.delete(row)
    if deleted_keys:
        db.session.commit()
    return deleted_keys


@app.route("/api/admin/wipe-everything", methods=["POST"])
@admin_required
def api_admin_wipe_everything():
    """Borrado TOTAL e IRREVERSIBLE de todos los datos guardados en el
    servidor (petición explícita del usuario, 2026-08-26, confirmada vía
    AskUserQuestion antes de implementar este endpoint): TODAS las filas
    de `GlobalState` (ligas, calendario, lesiones, sanciones, torneos,
    HUD, trofeos, snapshots, absolutamente todo lo guardado por clave) +
    las tablas legacy `Partido`/`Evento`. NO hay backup ni papelera — una
    vez ejecutado, no hay forma de recuperar los datos borrados.

    Es una herramienta de UN SOLO USO para esta limpieza puntual — NO
    dejar un botón permanente en la UI que la dispare sin fricción; se
    retira del código en cuanto el usuario confirme que ya la usó."""
    n_global = GlobalState.query.delete()
    n_partidos = Partido.query.delete()
    n_eventos = Evento.query.delete()
    db.session.commit()
    return jsonify({
        "ok": True,
        "deleted": {
            "global_state_rows": n_global,
            "partidos_rows": n_partidos,
            "eventos_rows": n_eventos,
        },
    })


@app.route("/api/admin/purge-dead-leagues", methods=["POST"])
@admin_required
def api_admin_purge_dead_leagues():
    """Endpoint manual (PIN 747) que envuelve `_purge_dead_merged_leagues`
    — se conserva para poder disparar el purgado a mano si en el futuro
    se añaden nuevas ligas a `DEAD_MERGED_LEAGUE_SLUGS` sin esperar al
    próximo despliegue/reinicio. El purgado AUTOMÁTICO de arranque (ver
    `with app.app_context()` más abajo) ya cubre el caso normal."""
    deleted_keys = _purge_dead_merged_leagues()
    return jsonify({
        "ok": True,
        "deleted_count": len(deleted_keys),
        "deleted_keys": sorted(deleted_keys),
    })


@app.route("/api/liga-ext/<slug>", methods=["POST"])
def api_liga_ext_post(slug):
    norm_slug = _liga_ext_slug(slug)
    if _is_dead_merged_league_slug(norm_slug):
        # Liga fusionada en liga-mixta-*: no-op silencioso (nunca 4xx/5xx,
        # para no disparar reintentos en los callers fire-and-forget). El
        # write NUNCA toca la BD — si se persistiera, resucitaría la fila
        # que el usuario ya purgó localmente.
        return jsonify({"ok": True, "slug": norm_slug, "updated_at": ""})
    payload = request.get_json(silent=True) or {}
    incoming = payload.get("data", payload)
    if not isinstance(incoming, dict):
        return jsonify({"ok": False, "error": "data inválida"}), 400
    incoming.setdefault("teams", [])
    incoming.setdefault("results", [])
    if not isinstance(incoming["teams"], list) or not isinstance(incoming["results"], list):
        return jsonify({"ok": False, "error": "teams/results deben ser listas"}), 400
    row = _liga_ext_save(slug, incoming)
    return jsonify({
        "ok": True,
        "slug": _liga_ext_slug(slug),
        "updated_at": row.updated_at or "",
    })


def _liga_ext_protected_scan(rows, target, scan_fn):
    """Segunda pasada sobre los snapshots `liga_ext_<slug>_protected`
    (2026-07-13, «siguen sin salir los escudos/alias/plantilla del
    Maccabi Haifa» pese a que el admin ya los configuró): el escaneo
    normal de `/api/team-alias|team-shield|team-squad` SOLO mira el
    `main` de cada liga (`rest.endswith('_protected')` se salta a
    propósito para no leer snapshots viejos en el camino feliz). Pero
    si el `main` de la liga de origen se quedó ATRÁS de su propio
    `_protected` — un guardado concurrente de OTRO dispositivo lo
    regresó a una copia más pobre, y el guard anti-wipe de
    `/api/liga-ext-protected/<slug>` (monotónico por nº de jugadores)
    conservó la edición rica SOLO en el snapshot — el dato de identidad
    (escudo/alias/plantilla) puede vivir EXCLUSIVAMENTE en `_protected`
    y nunca reflejarse en `main`. Se usa como ÚLTIMO recurso, tras
    fallar el escaneo de `main` en TODAS las ligas, reutilizando la
    MISMA lista de filas ya consultada (sin una 2ª query a la BD)."""
    for row in rows or []:
        clave = row.clave or ""
        rest = clave[len("liga_ext_"):] if clave.startswith("liga_ext_") else ""
        if not rest.endswith("_protected"):
            continue
        try:
            data = json.loads(row.valor_json or "{}")
        except Exception:
            continue
        teams = data.get("teams") if isinstance(data, dict) else None
        found = scan_fn(teams, target)
        if found:
            return found
    return None


def _team_alias_scan_teams(teams, target):
    if not isinstance(teams, list):
        return None
    for t in teams:
        if not isinstance(t, dict) or not t.get("name"):
            continue
        if _lx_canon_name(t.get("name")) != target:
            continue
        alias = t.get("efootballAlias")
        if isinstance(alias, str) and alias.strip():
            return alias.strip()
    return None


@app.route("/api/team-alias/<name>", methods=["GET"])
def api_team_alias(name):
    """Busca el alias de eFootball de un equipo por NOMBRE en TODAS las
    ligas + selecciones nacionales del servidor de una sola vez
    (búsqueda server-side).

    Sustituye a la búsqueda client-side por lotes (2026-07-05): el
    cliente hacía hasta ~54 peticiones HTTP (una por liga) desde el
    propio móvil para encontrar un equipo — lento y frágil en redes
    móviles (una sola petición que se cuelga bloqueaba toda la
    búsqueda, "se queda cargando"). Aquí es UNA sola petición: el
    servidor consulta su propia base de datos directamente (rápido,
    sin depender de la red del cliente para cada liga) y devuelve el
    alias ya resuelto. Match por nombre canónico (afijo-aware, mismo
    criterio que `_lx_merge_teams`) para tolerar variantes de grafía.

    Cubre TAMBIÉN `selecciones_squad_v1` (2026-07-05, bug "Timor
    Oriental" — una SELECCIÓN nacional, no un club de Resto de Ligas;
    el primer endpoint solo miraba `liga_ext_*` y nunca podía
    encontrarla aunque tuviera alias configurado).
    """
    target = _lx_canon_name(name)
    if not target:
        return jsonify({"ok": True, "alias": None})
    try:
        rows = GlobalState.query.filter(GlobalState.clave.like("liga_ext_%")).all()
    except Exception:
        rows = []
    for row in rows or []:
        clave = row.clave or ""
        rest = clave[len("liga_ext_"):] if clave.startswith("liga_ext_") else ""
        if not rest or rest.endswith("_protected") or "_snap_" in rest:
            continue
        try:
            data = json.loads(row.valor_json or "{}")
        except Exception:
            continue
        teams = data.get("teams") if isinstance(data, dict) else None
        found = _team_alias_scan_teams(teams, target)
        if found:
            return jsonify({"ok": True, "alias": found})
    found = _liga_ext_protected_scan(rows, target, _team_alias_scan_teams)
    if found:
        return jsonify({"ok": True, "alias": found})
    try:
        selrow = GlobalState.query.filter_by(clave="selecciones_squad_v1").first()
        if selrow and selrow.valor_json:
            seldata = json.loads(selrow.valor_json)
            selval = seldata.get("value") if isinstance(seldata, dict) and "value" in seldata else seldata
            selteams = selval.get("teams") if isinstance(selval, dict) else None
            found = _team_alias_scan_teams(selteams, target)
            if found:
                return jsonify({"ok": True, "alias": found})
    except Exception:
        pass
    return jsonify({"ok": True, "alias": None})


def _team_shield_scan_teams(teams, target):
    if not isinstance(teams, list):
        return None
    for t in teams:
        if not isinstance(t, dict) or not t.get("name"):
            continue
        if _lx_canon_name(t.get("name")) != target:
            continue
        shield = t.get("shield") or t.get("escudo") or t.get("img") or t.get("src")
        if isinstance(shield, str) and shield.strip():
            return shield.strip()
    return None


@app.route("/api/team-shield/<name>", methods=["GET"])
def api_team_shield(name):
    """Busca el escudo de un equipo por NOMBRE en TODAS las ligas del
    servidor de una sola vez (búsqueda server-side) — mismo patrón que
    `/api/team-alias/<name>` (2026-07-05).

    2026-07-12 #7: `_eurResolveTeamLogo` (el resolutor cross-liga de la
    Previa de Champions) SOLO escaneaba `localStorage`/`LIGA_CACHE` de
    ESTE dispositivo — a diferencia del alias, nunca tuvo un fallback en
    servidor. Un dispositivo cuyo `localStorage` está lleno (banner
    "Navegador sin espacio") puede fallar al persistir un escudo recién
    editado; ese dispositivo (o cualquier OTRO que no haya abierto esa
    liga concreta) se queda con el placeholder genérico para siempre sin
    este endpoint, aunque el servidor SÍ tenga el escudo guardado.
    """
    target = _lx_canon_name(name)
    if not target:
        return jsonify({"ok": True, "shield": None})
    try:
        rows = GlobalState.query.filter(GlobalState.clave.like("liga_ext_%")).all()
    except Exception:
        rows = []
    for row in rows or []:
        clave = row.clave or ""
        rest = clave[len("liga_ext_"):] if clave.startswith("liga_ext_") else ""
        if not rest or rest.endswith("_protected") or "_snap_" in rest:
            continue
        try:
            data = json.loads(row.valor_json or "{}")
        except Exception:
            continue
        teams = data.get("teams") if isinstance(data, dict) else None
        found = _team_shield_scan_teams(teams, target)
        if found:
            return jsonify({"ok": True, "shield": found})
    found = _liga_ext_protected_scan(rows, target, _team_shield_scan_teams)
    if found:
        return jsonify({"ok": True, "shield": found})
    try:
        selrow = GlobalState.query.filter_by(clave="selecciones_squad_v1").first()
        if selrow and selrow.valor_json:
            seldata = json.loads(selrow.valor_json)
            selval = seldata.get("value") if isinstance(seldata, dict) and "value" in seldata else seldata
            selteams = selval.get("teams") if isinstance(selval, dict) else None
            found = _team_shield_scan_teams(selteams, target)
            if found:
                return jsonify({"ok": True, "shield": found})
    except Exception:
        pass
    return jsonify({"ok": True, "shield": None})


def _team_squad_scan_teams(teams, target):
    if not isinstance(teams, list):
        return None
    for t in teams:
        if not isinstance(t, dict) or not t.get("name"):
            continue
        if _lx_canon_name(t.get("name")) != target:
            continue
        players = t.get("players")
        if isinstance(players, list) and players:
            return {"name": t.get("name"), "players": players}
    return None


@app.route("/api/team-squad/<name>", methods=["GET"])
def api_team_squad(name):
    """Busca la PLANTILLA (players[]) de un equipo por NOMBRE en TODAS
    las ligas del servidor de una sola vez — mismo patrón que
    `/api/team-alias/<name>`/`/api/team-shield/<name>` (2026-07-12 #7).

    Cierra el mismo hueco que esos 2 endpoints pero para el picker de
    eventos (+ AÑADIR EVENTO): si `sqFromRegistry` no encuentra la
    plantilla en `localStorage`/`LIGA_CACHE` de ESTE dispositivo (p.ej.
    porque su `localStorage` está lleno y el guardado reciente del
    admin se quedó solo en el servidor), el picker caía al roster
    genérico "Jugador A/B/C…" pese a que la plantilla real SÍ existe en
    el servidor.
    """
    target = _lx_canon_name(name)
    if not target:
        return jsonify({"ok": True, "team": None})
    try:
        rows = GlobalState.query.filter(GlobalState.clave.like("liga_ext_%")).all()
    except Exception:
        rows = []
    for row in rows or []:
        clave = row.clave or ""
        rest = clave[len("liga_ext_"):] if clave.startswith("liga_ext_") else ""
        if not rest or rest.endswith("_protected") or "_snap_" in rest:
            continue
        try:
            data = json.loads(row.valor_json or "{}")
        except Exception:
            continue
        teams = data.get("teams") if isinstance(data, dict) else None
        found = _team_squad_scan_teams(teams, target)
        if found:
            return jsonify({"ok": True, "team": found})
    found = _liga_ext_protected_scan(rows, target, _team_squad_scan_teams)
    if found:
        return jsonify({"ok": True, "team": found})
    try:
        selrow = GlobalState.query.filter_by(clave="selecciones_squad_v1").first()
        if selrow and selrow.valor_json:
            seldata = json.loads(selrow.valor_json)
            selval = seldata.get("value") if isinstance(seldata, dict) and "value" in seldata else seldata
            selteams = selval.get("teams") if isinstance(selval, dict) else None
            found = _team_squad_scan_teams(selteams, target)
            if found:
                return jsonify({"ok": True, "team": found})
    except Exception:
        pass
    return jsonify({"ok": True, "team": None})

# ══════════════════════════════════════════════════════════════════
# PROTECTED snapshot (server-side, monotónico) — 2026-05-08
# ══════════════════════════════════════════════════════════════════
# Bug reportado: al actualizar plantillas de equipos humanos un día y
# recargar al siguiente, las ediciones se perdieron — el server tenía
# una versión pre-edit y la cache cliente coincidía con ella, así que
# el anti-wipe del cliente no detectó el wipe.
#
# Defensa de último recurso: además de `liga_ext_<slug>` (que el cliente
# puede sobrescribir libremente), guardamos `liga_ext_<slug>_protected`
# que SOLO acepta payloads cuyo total de `players` sea ≥ que el
# protected actual. Es decir, un POST con menos jugadores que la
# versión protegida se RECHAZA con 409, salvaguardando las ediciones
# del admin contra cualquier flujo que intente "limpiar" el server.
#
# Cliente:
#  - En cada saveData (con teams.length > 0), POSTea aquí (best-effort).
#  - En loadData / anti-wipe, si las fuentes locales fallan, hace GET
#    aquí como fallback final.

_PROTECTED_KEY_FMT = "liga_ext_{}_protected"


def _protected_key(slug):
    return _PROTECTED_KEY_FMT.format(_liga_ext_slug(slug))


def _count_players_payload(data):
    """Total de players[] sumado entre todos los teams[] del payload."""
    if not isinstance(data, dict):
        return 0
    teams = data.get("teams")
    if not isinstance(teams, list):
        return 0
    total = 0
    for t in teams:
        if not isinstance(t, dict):
            continue
        players = t.get("players")
        if isinstance(players, list):
            total += len(players)
    return total


@app.route("/api/liga-ext-protected/<slug>", methods=["GET"])
def api_liga_ext_protected_get(slug):
    if _is_dead_merged_league_slug(_liga_ext_slug(slug)):
        return jsonify({"ok": True, "slug": _liga_ext_slug(slug),
                        "data": None, "players": 0, "updated_at": ""})
    key = _protected_key(slug)
    row = GlobalState.query.filter_by(clave=key).first()
    if not row or not row.valor_json:
        return jsonify({"ok": True, "slug": _liga_ext_slug(slug),
                        "data": None, "players": 0, "updated_at": ""})
    try:
        data = json.loads(row.valor_json)
    except Exception:
        data = None
    return jsonify({
        "ok": True,
        "slug": _liga_ext_slug(slug),
        "data": data,
        "players": _count_players_payload(data) if data else 0,
        "updated_at": row.updated_at or "",
    })


@app.route("/api/liga-ext-protected/<slug>", methods=["POST"])
def api_liga_ext_protected_post(slug):
    norm_slug = _liga_ext_slug(slug)
    if _is_dead_merged_league_slug(norm_slug):
        # Mismo no-op silencioso que el POST de /api/liga-ext/<slug>:
        # una liga fusionada nunca vuelve a tener snapshot protected.
        return jsonify({"ok": True, "slug": norm_slug, "players": 0, "updated_at": ""})
    payload = request.get_json(silent=True) or {}
    incoming = payload.get("data", payload)
    force = bool(payload.get("force"))
    if not isinstance(incoming, dict):
        return jsonify({"ok": False, "error": "data inválida"}), 400
    teams = incoming.get("teams")
    if not isinstance(teams, list) or not teams:
        return jsonify({"ok": False, "error": "teams vacío — no se sobreescribe protected"}), 400
    new_pc = _count_players_payload(incoming)
    body = json.dumps(incoming, ensure_ascii=False)
    if len(body.encode("utf-8")) > 2 * 1024 * 1024:
        return jsonify({"ok": False, "error": "payload supera 2 MB"}), 413
    key = _protected_key(slug)
    row = GlobalState.query.filter_by(clave=key).first()
    if row and not force:
        try:
            cur = json.loads(row.valor_json or "{}")
            cur_pc = _count_players_payload(cur)
        except Exception:
            cur_pc = 0
        # Anti-wipe monotónico: rechazamos cualquier POST con MENOS
        # jugadores totales que el protected actual. El admin siempre
        # puede forzar con force=true (p.ej. para corregir un guardado
        # incorrecto que se quedó pegado en protected).
        if new_pc < cur_pc:
            return jsonify({
                "ok": False,
                "error": "payload con menos jugadores que protected — rechazado",
                "current_players": cur_pc,
                "new_players": new_pc,
            }), 409
    now = utc_now_iso()
    if row:
        row.valor_json = body
        row.updated_at = now
    else:
        row = GlobalState(clave=key, valor_json=body, updated_at=now)
        db.session.add(row)
    db.session.commit()
    return jsonify({
        "ok": True,
        "slug": _liga_ext_slug(slug),
        "players": new_pc,
        "updated_at": now,
    })


@app.route("/api/liga-ext-restore/<slug>", methods=["POST"])
def api_liga_ext_restore(slug):
    """Promociona el snapshot `_protected` al main `liga_ext_<slug>`.

    Reportado 2026-05-09 (corrupción cross-liga): tras un rescate
    cross-slug bugged, Hypermotion acumuló 61 equipos (de 22) y
    Primera Federación quedó con 1 (de 40). Para recuperar, este
    endpoint copia el `_protected` (que el cliente SOLO acepta
    POSTs con MÁS jugadores → preserva la versión "buena") al main
    sobreescribiendo la versión corrupta.

    Devuelve {restored, players_in_protected, current_main_players}.
    Si no hay protected → 404.
    """
    if _is_dead_merged_league_slug(_liga_ext_slug(slug)):
        return jsonify({
            "ok": False,
            "error": "no hay snapshot protected para este slug",
            "slug": _liga_ext_slug(slug),
        }), 404
    pkey = _protected_key(slug)
    prow = GlobalState.query.filter_by(clave=pkey).first()
    if not prow or not prow.valor_json:
        return jsonify({
            "ok": False,
            "error": "no hay snapshot protected para este slug",
            "slug": _liga_ext_slug(slug),
        }), 404
    try:
        pdata = json.loads(prow.valor_json)
    except Exception:
        return jsonify({"ok": False, "error": "protected corrupto"}), 500
    if not isinstance(pdata, dict) or not isinstance(pdata.get("teams"), list):
        return jsonify({"ok": False, "error": "protected sin teams"}), 500
    # Backup del main actual antes de sobreescribir (por si el admin
    # quiere undo manual).
    mkey = _liga_ext_key(slug)
    mrow = GlobalState.query.filter_by(clave=mkey).first()
    cur_pc = 0
    if mrow and mrow.valor_json:
        try:
            cur_pc = _count_players_payload(json.loads(mrow.valor_json))
        except Exception:
            cur_pc = 0
    new_pc = _count_players_payload(pdata)
    pdata.setdefault("results", [])
    _liga_ext_save(slug, pdata)
    return jsonify({
        "ok": True,
        "slug": _liga_ext_slug(slug),
        "restored": True,
        "players_in_protected": new_pc,
        "current_main_players": cur_pc,
        "teams_in_protected": len(pdata.get("teams", [])),
    })


# ══════════════════════════════════════════════════════════════════
# KV genérico (estado del cliente que debe sobrevivir al navegador)
# ══════════════════════════════════════════════════════════════════
# Reportado 2026-05-02 con foto: el usuario perdió tanto los iconos
# personalizados de Competiciones (`comp_icons_v1`) como las
# inyecciones manuales de Liga EA Sports → Europa
# (`manual_ea_<slug>_v1`). Ambos vivían SOLO en localStorage del
# navegador y se perdían si el browser limpiaba caché o si el usuario
# cambiaba de dispositivo. Con este endpoint sincronizamos esos
# blobs al servidor (GlobalState) — localStorage sigue siendo cache
# rápido de primera lectura, pero el server es la fuente de verdad
# que sobrevive entre sesiones.
#
# Whitelist (no permitimos escribir cualquier clave arbitraria):
#   - comp_icons_v1
#   - europe_committed_v1   (snapshot manual de pools europeos —
#                            usuario pulsa "📤 Enviar a Europa" cuando
#                            todas las 51 ligas están terminadas)
#   - manual_ea_<slug>_v1   con slug ∈ {ucl, uclPrev, prevR3, prevR2,
#                                       prevR1, uel, uecl,
#                                       supercopa,
#                                       intercontinental, superliga,
#                                       verano}
#   - tour_<slug>_v1        config editable de cada torneo de verano
#                           con slug ∈ {sct, pss, jg, asia} —
#                           compartido entre dispositivos (2026-05-08)
#   - bayern_trofeos_v1     vitrina de trofeos del hub Bayern (la
#                           edición de cada título incluye un icono
#                           que el usuario sube y compromete persistir
#                           contra wipes de localStorage — 2026-05-08)
# Cualquier otra clave devuelve 400.
_KV_ALLOWED_EXACT = {
    "comp_icons_v1", "comp_cards_v1",
    "europe_committed_v1", "bayern_trofeos_v1",
    "ucl_phase_v1", "uel_phase_v1", "uecl_phase_v1",
    # Extras manuales del reparto europeo (equipo añadido a mano por el
    # admin a cualquiera de las 7 zonas — ucl/uclPrev/prevR3/prevR2/
    # prevR1/uel/uecl — cuando una liga no consigue hidratarse
    # automáticamente. Independiente de manual_ea_<slug>_v1 (ese es solo
    # para España). localStorage es solo cache; el server es la fuente de
    # verdad para que sobreviva al borrado de datos / cambio de móvil.
    # 2026-07-03.
    "eur_manual_extra_v1",
    # MODO MANUAL por zona del reparto europeo: flags booleanas
    # {ucl,uclPrev,prevR3,prevR2,prevR1,uel,uecl} — cuando el admin activa
    # una, esa zona ignora el cómputo automático y usa SOLO
    # eur_manual_extra_v1. Edición rara/admin, recencia simple basta.
    "eur_manual_override_v1",
    # Registro de torneos visibles (añadir/eliminar · 2026-05-16 #5).
    "tour_registry_v1",
    # Ball Storage: inventario de balones, balón-por-competición y
    # competiciones custom añadidas por el admin. localStorage es solo
    # cache rápida — el server es la fuente de verdad para que
    # sobrevivan a wipes de navegador / cambio de móvil (mismo patrón
    # que comp_icons_v1 / bayern_trofeos_v1). 2026-05-17.
    "ball_inventory_v1", "ball_by_comp_v1", "ball_comp_db_v1",
    # Info card EDITABLE por torneo (la «I» de cada caja de torneo · 6
    # campos: Participación/Humanos/Nivel/Formato/Información/Dinero).
    # Editable por el admin (PIN 747) desde el panel; localStorage es
    # solo cache, el server es la fuente de verdad para que sobreviva al
    # borrado de datos de navegación / cambio de móvil. 2026-06-13.
    "tour_info_cards_v1",
    # Editor del menú principal: cajas creadas/editadas/eliminadas
    # (overrides + added + removed). localStorage es solo cache; el
    # server es la fuente de verdad para que sobrevivan a wipes de
    # navegador / cambio de móvil (mismo patrón que comp_cards_v1).
    "menu_home_v1",
    # Plantilla de selecciones nacionales (nombre + escudo + 4 ejes).
    # Es el pool del que tiran los torneos de Selecciones. localStorage
    # es solo cache; el server es la fuente de verdad para que la
    # plantilla creada en PC aparezca en el móvil (2026-05-22).
    "selecciones_squad_v1",
    # 4 estadios sede del Mundial · 48 selecciones (fase final). El
    # admin los elige desde el editor del torneo Mundial · 48
    # selecciones; cada partido se juega en uno de los 4 (rotación por
    # hash). Sync server para que las sedes elegidas en PC aparezcan
    # en el móvil (2026-05-24).
    "sel_fin_stadiums_v1",
    # Editor de Objetivos del Club (cantidades + textos custom de las
    # ~68 misiones). localStorage es solo cache; el server es la fuente
    # de verdad para que lo editado sobreviva a un reinicio de la web /
    # cambio de móvil / evicción de caché (foto usuario 2026-06-04: "al
    # reiniciar la web no se guarda lo editado"). Patrón "_save = push
    # autoritativo · _boot = pull aditivo" como selecciones_squad_v1.
    "munich-obj-overrides-v1",
    # PROGRESO de los Objetivos del Club: ✅ marcados + contadores MANUALES
    # (p.ej. "Marcar 5 goles en 3 partidos" del Mundialito, que el usuario
    # avanza con ➖/➕). Vivía SOLO en localStorage → al borrar datos de
    # navegación / cambiar de móvil el progreso volvía a 0 (foto usuario
    # 2026-06-10: "añadí en global 1/3, borro datos y al volver pone 0/3").
    # localStorage es solo caché; el server es la fuente de verdad. Merge por
    # RECENCIA (updatedAt): un avance/reset legítimo no se revierte y un POST
    # stale no pisa una copia más nueva. Es el PROGRESO (separado de
    # munich-obj-overrides-v1, que son las CANTIDADES/textos de cada misión).
    "munich-obj-state-v4",
    "munich-obj-state-v5",   # rediseño 2026-07-23 (2 objetivos por competición)
    # Lesiones / sanciones del CLUB del hub y de las SELECCIONES. Vivían
    # SOLO en localStorage → al borrar datos de navegación / cambiar de
    # móvil se perdía TODO lo editado a mano (foto usuario 2026-06-04:
    # Kounde·Francia lesionado 1 partido manualmente → desaparecía al
    # limpiar el navegador). localStorage es solo caché; el server es la
    # fuente de verdad. Merge por RECENCIA (updatedAt): un consumo
    # legítimo (sanción decrementada) no se resucita y un POST stale no
    # pisa una copia más nueva. Mismo patrón "_save = push autoritativo ·
    # _boot = pull aditivo" que selecciones_squad_v1.
    "ftbol_sel_sanciones_v1",   # selecciones (amarillas + sanciones + lesiones)
    "ftbol_lesiones_v1",        # club: BAJA_STORE + LESION_STORE
    "ftbol_sanciones_v1",       # club: SANCION_STORE.__global
    # Ajustes MANUALES de estadísticas de la plantilla del hub (editor azul
    # 🖍): deltas por jugador y campo (club + selección). Vivían SOLO en
    # localStorage → al borrar datos de navegación se perdía la corrección
    # (foto usuario 2026-06-05: amarilla editada a mano que "volvía a salir"
    # al recargar). localStorage es solo caché; el server es la fuente de
    # verdad. Merge por RECENCIA, igual que las bajas/sanciones.
    "bplant_stat_adjust_v1",
    # Acumulador de 🚪 tiros / ⚠️ faltas / ⛳️ córners por partido del hub
    # (Liverpool + selección), para la BANDA DE TOTALES de la plantilla.
    # Estos 3 datos NO se persisten en ninguna competición oficial (solo
    # Superliga, que va excluida), así que se acumulan aquí going-forward.
    # localStorage es solo caché; el server es la fuente de verdad para que
    # sobrevivan al borrado de navegación / cambio de móvil. Merge por
    # RECENCIA (updatedAt), igual que las bajas/sanciones (2026-06-05).
    "bplant_match_stats_v1",
    # HUD del hub (🪙 presupuesto · 💊 puntos de fisio · 💼 valoración +
    # objetivos). ANTES vivía en el blob TOP-LEVEL de /api/state, compartido
    # por decenas de writers concurrentes (poll de Liga/comp-state + el
    # `reset-liga` con replace=True full-state): un read-modify-write ajeno o
    # el replace del reset DESCARTABA el 🪙/💊/💼 recién guardado y, como el
    # HUD se sube UNA sola vez, ese clobber era PERMANENTE → tras borrar datos
    # de navegación la rehidratación no encontraba nada y el HUD volvía a los
    # defaults (foto usuario 2026-06-06: "pongo los valores, borro datos y al
    # volver no se han cambiado"; la fecha SÍ sobrevivía porque su cursor tiene
    # merge dedicado + re-push frecuente). Ahora vive en su PROPIA fila KV —
    # sin contención con otros writers — con merge por RECENCIA (updatedAt): un
    # POST stale (otro móvil, request perdido) nunca pisa una copia más nueva.
    "bayern_hud_overrides_v1",
    # Etiqueta de TEMPORADA de la cabecera del home ("Temporada 32-33").
    # El admin la edita tocando el texto (prompt). localStorage es solo
    # caché; el server es la fuente de verdad para que la edición viaje a
    # los 6 móviles + PC y sobreviva al borrado de datos (2026-07-10).
    "season_label_v1",
    # Marca de qué cajas de mister ya recibieron el recálculo RETROACTIVO
    # de ganancias por partido (2026-07-29, botón admin "💰 Ganancias
    # históricas", acción ÚNICA por hub). localStorage es solo caché; el
    # server evita que se re-acredite dos veces desde otro dispositivo.
    "retro_earnings_applied_v1",
    # Nº de clubes humanos configurado para la Superliga (botón admin
    # "⚙️ Nº de clubes" en Superliga · Clasificación, 2026-08-10). Antes
    # el nº de equipos estaba hardcodeado a 7 — con solo 6 clubes humanos
    # añadidos en "EA Sports → Europa" la Superliga nunca arrancaba. El
    # admin ahora elige cuántos de los ya añadidos entran a jugar (p.ej.
    # 6 → 20 partidos/equipo, 4 veces cada rival, mismas reglas de
    # siempre). localStorage es solo caché; el server es la fuente de
    # verdad para que la elección sobreviva al borrado de datos / cambio
    # de móvil.
    "superliga_num_teams_v1",
    # Tabla PERMANENTE de estadísticas por jugador (recorte automático de
    # acta de partidos IA-vs-IA ya completados, obligatorio 2026-08-16):
    # una por familia de competición (Torneos de Verano/Selecciones/
    # Mundialito de Clubes/Copa del Rey/Intercontinental). Merge ADITIVO
    # por clave de partido (nunca por recencia entera) — ver
    # `_pm_tally_merge` en sync_merge.py, dispatchado más abajo.
    "pm_tally_torneos_v1", "pm_tally_sel_v1", "pm_tally_mundial_v1",
    "pm_tally_copa_v1", "pm_tally_inter_v1", "pm_tally_liga_v1",
    # Champions/Europa/Conference League (fase de liga + eliminatoria,
    # ambas comparten bucket "Grupos + Playoffs" — obligatorio 2026-08-22).
    "pm_tally_ucl_v1", "pm_tally_uel_v1", "pm_tally_uecl_v1",
    # Supercopa de España / Supercopa de Europa (obligatorio, 2026-08-22).
    "pm_tally_sc_v1", "pm_tally_usc_v1",
}
# Claves baja/sanción que se fusionan por RECENCIA en el server (espejo
# del cliente `_kvBlobSync`): el blob con `updatedAt` mayor gana entero,
# así un POST stale (otro móvil, request perdido) nunca pisa lo más
# nuevo y un consumo (decremento) tampoco se revierte.
_KV_RECENCY_BLOB_KEYS = {
    "ftbol_sel_sanciones_v1", "ftbol_lesiones_v1", "ftbol_sanciones_v1",
    "bplant_stat_adjust_v1", "bplant_match_stats_v1",
    # Progreso de los Objetivos del Club (✅ + contadores manuales): el blob
    # con `updatedAt` mayor gana entero (avance/reset no se revierte; POST
    # stale no pisa lo más nuevo).
    "munich-obj-state-v4",
    "munich-obj-state-v5",   # rediseño 2026-07-23 (2 objetivos por competición)
    # CONFIG editable de los Objetivos del Club (textos/cantidades/recompensas
    # + objetivos personalizados por competición). Antes era last-write-wins en
    # el server + POST fire-and-forget sin reintentos en el cliente → en red
    # móvil floja el POST de una edición se perdía y, tras una evicción de
    # localStorage, el pull re-adoptaba la copia stale del server: la edición
    # "no se quedaba guardada" y revertía al default (foto usuario 2026-07-24).
    # Ahora RECENCIA + authoritative (edición explícita del admin sella el reloj
    # del server y gana pese al clock-skew), igual que menu_home_v1.
    "munich-obj-overrides-v1",
    # Modo manual por zona del reparto europeo: la última edición del
    # admin (toggle 🔒/🔓) gana entera.
    "eur_manual_override_v1",
    # HUD del hub (🪙💊💼 + objetivos): running total / consumible. El blob
    # con `updatedAt` mayor gana ENTERO — un consumo legítimo (PI gastado,
    # presupuesto sumado) no se revierte y un POST stale no pisa lo más nuevo.
    "bayern_hud_overrides_v1",
    # Info card editable por torneo: la última edición del admin gana entera.
    "tour_info_cards_v1",
    # Menú principal editable (cajas del home: crear/editar/eliminar). Merge
    # por RECENCIA: el blob con `updatedAt` mayor gana ENTERO. La edición
    # EXPLÍCITA del admin va `authoritative` (sella reloj del server, gana
    # siempre) → un navegador con un menú stale ya no puede pisar el nuevo,
    # y al borrar datos / cambiar de móvil se recupera la última versión.
    "menu_home_v1",
    # Etiqueta de temporada de la cabecera del home: la última edición del
    # admin gana entera (va `authoritative` → sella reloj del server).
    "season_label_v1",
    # Marca de qué cajas de mister ya recibieron el recálculo retroactivo
    # de ganancias por partido: el blob con `updatedAt` mayor gana entero.
    "retro_earnings_applied_v1",
    # Nº de clubes humanos de la Superliga: el blob con `updatedAt` mayor
    # gana ENTERO — la elección explícita del admin (authoritative) nunca
    # la pisa un POST stale de otro dispositivo/pestaña.
    "superliga_num_teams_v1",
}
_KV_ALLOWED_REGEX = re.compile(
    r"^("
    r"manual_ea_(ucl|uclPrev|prevR3|prevR2|prevR1|uel|uecl|supercopa|intercontinental|superliga|verano)"
    # tx1..tx8 = 8 huecos pre-cableados para torneos añadidos por el admin.
    # spv1..spv10 / sfn1..sfn10 = Rondas Previas / Finales de Selecciones
    # (mismo motor de torneos; sync server para que el Mundial creado en
    # PC aparezca en el móvil — 2026-05-22).
    r"|tour_(sct|pss|jg|asia|mundial|tx[1-8]|spv(10|[1-9])|sfn(10|[1-9]))"
    r")_v1$"
)
_KV_MAX_BYTES = 2 * 1024 * 1024  # 2 MB por clave (alineado con CLAUDE.md)


def _kv_is_allowed(key):
    if not key:
        return False
    if key in _KV_ALLOWED_EXACT:
        return True
    # Multi-hub: variantes por hub (`base_<id>`) de las claves base de
    # HUD/trofeos/objetivos quedan permitidas igual que su base.
    if _kv_hub_base(key) in _KV_ALLOWED_EXACT:
        return True
    return bool(_KV_ALLOWED_REGEX.match(key))


def _obj_state_is_empty(d):
    """True si el blob de PROGRESO de objetivos del club no tiene NINGÚN
    ✅ marcado ni contador con valor real (0 / - / vacío = sin progreso).
    Espejo del cliente `_objStateIsEmpty`. Lo usa `api_kv_set` como defensa
    a prueba de balas: un POST VACÍO no-autoritativo NUNCA machaca un
    progreso real almacenado (bug 2026-06-11: marco ✅, borro datos de
    navegación y vuelve a 0 porque un autosave de arranque subía el estado
    en blanco)."""
    if not isinstance(d, dict):
        return True
    checks = d.get("checks") or {}
    counters = d.get("counters") or {}
    if isinstance(checks, dict):
        for v in checks.values():
            if v:
                return False
    if isinstance(counters, dict):
        for v in counters.values():
            s = str("" if v is None else v).strip().replace("%", "").replace("+", "")
            if s and s != "0" and s != "-":
                return False
    return True


def _trofeos_unwrap(v):
    """Normaliza un blob de vitrina de trofeos a `(items, updatedAt)`.

    Acepta DOS formatos para back-compat: el LEGACY (array crudo de
    trofeos, sin sello) y el NUEVO (`{updatedAt, items}`). El array crudo
    se trata como `updatedAt=0` (lo más viejo posible) para que cualquier
    copia sellada gane por recencia."""
    if isinstance(v, dict):
        items = v.get("items")
        items = items if isinstance(items, list) else []
        try:
            ts = float(v.get("updatedAt") or 0)
        except (TypeError, ValueError):
            ts = 0.0
        return items, ts
    if isinstance(v, list):
        return v, 0.0
    return [], 0.0


def _trofeos_merge(old_json, new_value, authoritative):
    """Fusión de la VITRINA DE TROFEOS (`bayern_trofeos_v1` + variantes por
    hub `_<id>`) — RECENCIA + EMPTY-GUARD.

    Mismo patrón «sobrevive al wipe / cambio de móvil» que el HUD/derbys:
    la vitrina es un registro PERSISTENTE aditivo del admin que NO se
    recalcula. Como hay 6 móviles + PC y no todos tienen el último cliente,
    la defensa va en el SERVER:

    - **EMPTY-GUARD**: un POST con la lista VACÍA NUNCA machaca una vitrina
      no vacía almacenada (un cliente que arranca con localStorage limpio
      —tras un wipe / hub nuevo— no debe borrar los trofeos que otro
      dispositivo ya subió). La acción AUTORITATIVA del admin (vaciar la
      vitrina a mano) SÍ puede dejarla vacía.
    - **RECENCIA**: a igualdad de no-vacío, gana el `updatedAt` mayor; un
      POST stale (reloj viejo) no pisa una edición más nueva.

    Devuelve SIEMPRE el formato sellado `{updatedAt, items}` para que el
    siguiente merge pueda arbitrar por recencia."""
    old_items, old_ts = _trofeos_unwrap(_safe_json_load(old_json))
    new_items, new_ts = _trofeos_unwrap(new_value)

    # EMPTY-GUARD: lista entrante vacía no borra una almacenada con datos,
    # salvo acción autoritativa explícita del admin.
    if not new_items and old_items and not authoritative:
        return {"updatedAt": old_ts, "items": old_items}

    # RECENCIA: el sello mayor gana; empate / entrante autoritativo → entrante.
    if not authoritative and new_ts < old_ts and old_items:
        return {"updatedAt": old_ts, "items": old_items}

    ts = max(new_ts, old_ts) if not authoritative else max(new_ts, old_ts + 1.0)
    return {"updatedAt": ts, "items": new_items}


def _safe_json_load(s):
    try:
        return json.loads(s) if s else None
    except Exception:
        return None


# 2026-08-14: "uclQual" (Open Qualifier) y "wildcard" (Wild Card) quedan
# ANIQUILADOS junto con esas 2 competiciones — sustituidos por las 3 zonas
# de la Previa de Champions de 4 rondas que faltaban ("prevR3"/"prevR2"/
# "prevR1"; "uclPrev" ya existía y ahora es la Ronda 4).
_EUR_MANUAL_EXTRA_ZONES = (
    "ucl", "uclPrev", "prevR3", "prevR2", "prevR1", "uel", "uecl",
    # Extendido 2026-07-07: el admin puede añadir equipos a mano también a
    # Supercopa de Europa, Intercontinental y Mundialito de Clubes
    # desde el mismo overlay "Equipos por competición". Debe ir SIEMPRE
    # sincronizada con `EUR_MANUAL_ZONES` del cliente (misc_body_1.html) —
    # si una zona nueva falta aquí, el merge aditivo la descarta en
    # silencio en cada guardado (ver CLAUDE.md).
    "usc", "inter", "mundial",
)


def _eur_manual_extra_merge(old_json, new_value):
    """Fusión ADITIVA (unión) de `eur_manual_extra_v1` — equipos que el
    admin añade a mano a cualquiera de las 6 zonas europeas cuando una
    liga no consigue hidratarse automáticamente (ver CLAUDE.md 2026-07-03).

    Con 6 móviles + PC, dos dispositivos pueden añadir equipos DISTINTOS a
    la MISMA zona (o a zonas distintas) sin haberse sincronizado entre
    ellos todavía. Un merge por RECENCIA (blob más nuevo gana ENTERO)
    perdería silenciosamente la adición del dispositivo más lento — por
    eso aquí la fusión es UNIÓN por (zona, nombre), nunca reemplazo total.
    Si el mismo nombre aparece en ambos lados con distinta `league`, gana
    la versión que trae más información (una `league` no vacía).

    Compromiso aceptado: un ✕ (borrado) hecho en un dispositivo puede
    resucitar si otro dispositivo, que aún no vio ese borrado, hace un
    POST después — mismo trade-off que el resto de listas aditivas del
    proyecto (derbys): preferimos nunca perder una adición legítima
    antes que hacer desaparecer un borrado al instante.

    EXCEPCIÓN — "🗑 Vaciar lista" (2026-07-07): el botón que vacía TODA
    una zona de golpe necesita que su borrado SÍ persista (petición
    usuario: "que ese borrado se guarde hasta que vuelva a añadir
    equipos"), cosa que la unión pura de arriba no puede garantizar por
    sí sola (un POST de otro dispositivo con la zona aún llena
    resucitaría el vaciado al instante). Cada entrada lleva un sello
    `addedAt` (cuándo se añadió) y cada zona puede llevar un
    `clearedAt` (cuándo se vació por última vez, tombstone). Tras la
    unión por nombre, se descarta cualquier entrada cuyo `addedAt` sea
    ANTERIOR o igual al `clearedAt` vigente de esa zona — un equipo
    añadido DESPUÉS del vaciado (addedAt > clearedAt) sobrevive con
    normalidad. Entradas legacy sin `addedAt` (anteriores a esta regla)
    se tratan como `addedAt=0` — un vaciado las descarta también, que es
    el comportamiento esperado por el usuario ("limpiar la lista
    ENTERA")."""
    old = _safe_json_load(old_json)
    if not isinstance(old, dict):
        old = {}
    new = new_value if isinstance(new_value, dict) else {}
    old_cleared = old.get("clearedAt") if isinstance(old.get("clearedAt"), dict) else {}
    new_cleared = new.get("clearedAt") if isinstance(new.get("clearedAt"), dict) else {}
    out = {}
    out_cleared = {}
    for zone in _EUR_MANUAL_EXTRA_ZONES:
        try:
            cleared_at = max(float(old_cleared.get(zone) or 0), float(new_cleared.get(zone) or 0))
        except (TypeError, ValueError):
            cleared_at = 0.0
        if cleared_at:
            out_cleared[zone] = cleared_at
        by_name = {}
        for src in (old.get(zone), new.get(zone)):
            if not isinstance(src, list):
                continue
            for t in src:
                if not isinstance(t, dict):
                    continue
                name = str(t.get("name") or "").strip()
                if not name:
                    continue
                try:
                    added_at = float(t.get("addedAt") or 0)
                except (TypeError, ValueError):
                    added_at = 0.0
                if cleared_at and added_at <= cleared_at:
                    continue
                prev = by_name.get(name)
                if prev is None or (not prev.get("league") and t.get("league")):
                    by_name[name] = t
        out[zone] = list(by_name.values())
    if out_cleared:
        out["clearedAt"] = out_cleared
    try:
        old_ts = float(old.get("updatedAt") or 0)
    except (TypeError, ValueError):
        old_ts = 0.0
    try:
        new_ts = float(new.get("updatedAt") or 0)
    except (TypeError, ValueError):
        new_ts = 0.0
    out["updatedAt"] = max(old_ts, new_ts)
    return out


def _tour_registry_merge(old_json, new_value):
    """Fusión local∪server del registro de torneos RESUELTA POR RECENCIA.

    El estado visible/oculto de cada slot lo decide la ÚLTIMA acción
    real del admin (sello `hiddenAt`/`shownAt`), NO un "visible gana
    siempre". Esto reconcilia dos requisitos opuestos:

    · ANTI-WIPE: un slot nunca visto-como-oculto en ningún sitio (solo
      presente en `visible`) se conserva — la lista visible no encoge
      por un POST stale/corto (otro móvil, POST perdido tras un GET
      viejo). Las cajas de Rondas Previas/Finales ("Road Copa Asia",
      "Mundial 2032"…) NUNCA desaparecen por sync.
    · OCULTAR PERSISTE: un slot con `hiddenAt` reciente GANA frente a
      una copia stale que lo siga teniendo en `visible` (baseline
      shownAt=1 « hiddenAt now). Antes el server lo re-añadía a
      `visible` desde `old_vis` y borraba el tombstone, así que las
      cajas ocultas volvían a salir al recargar (bug 2026-06-03).
    · MOSTRAR de nuevo gana si es más reciente que el ocultado
      (cross-device correcto).
    """
    try:
        old_value = json.loads(old_json)
    except Exception:
        old_value = None
    if not isinstance(new_value, dict) or not isinstance(new_value.get("visible"), list):
        # El entrante no es un registro válido → no fusionamos, que el
        # validador / last-write de arriba decida.
        return new_value
    if not isinstance(old_value, dict):
        old_value = {}
    old_vis = old_value.get("visible")
    if not isinstance(old_vis, list):
        old_vis = []

    def _str_list(v):
        return [x for x in v if isinstance(x, str)] if isinstance(v, list) else []

    n_vis = _str_list(new_value.get("visible"))
    o_vis = _str_list(old_vis)
    n_hid = _str_list(new_value.get("hidden"))
    o_hid = _str_list(old_value.get("hidden"))

    hidden_at, shown_at = {}, {}

    def _merge_ts(dst, m):
        if not isinstance(m, dict):
            return
        for _id, v in m.items():
            if not isinstance(_id, str):
                continue
            try:
                v = float(v)
            except (TypeError, ValueError):
                continue
            if v > dst.get(_id, 0):
                dst[_id] = v

    _merge_ts(hidden_at, new_value.get("hiddenAt"))
    _merge_ts(hidden_at, old_value.get("hiddenAt"))
    _merge_ts(shown_at, new_value.get("shownAt"))
    _merge_ts(shown_at, old_value.get("shownAt"))
    # Baselines de presencia (datos legacy sin timestamps).
    for _id in n_vis + o_vis:
        shown_at.setdefault(_id, 1)
    for _id in n_hid + o_hid:
        hidden_at.setdefault(_id, 1)

    order, seen = [], set()
    for _id in n_vis + o_vis + list(shown_at.keys()) + list(hidden_at.keys()):
        if isinstance(_id, str) and _id not in seen:
            seen.add(_id)
            order.append(_id)

    visible, hidden = [], []
    for _id in order:
        if hidden_at.get(_id, 0) > shown_at.get(_id, 0):
            hidden.append(_id)
        else:
            visible.append(_id)

    out = dict(new_value)
    out["visible"] = visible
    out["hidden"] = hidden
    out["hiddenAt"] = {k: int(v) for k, v in hidden_at.items()}
    out["shownAt"] = {k: int(v) for k, v in shown_at.items()}
    return out


_OG_IMAGE_PATTERNS = [
    re.compile(r'<meta[^>]+property=["\']og:image(?::secure_url)?["\'][^>]+content=["\']([^"\']+)["\']', re.IGNORECASE),
    re.compile(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image(?::secure_url)?["\']', re.IGNORECASE),
    re.compile(r'<meta[^>]+name=["\']twitter:image(?::src)?["\'][^>]+content=["\']([^"\']+)["\']', re.IGNORECASE),
    re.compile(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']twitter:image(?::src)?["\']', re.IGNORECASE),
]


def _url_resolves_to_public_ip(url):
    """SSRF guard: rechaza URLs que no sean http(s) o que resuelvan a una IP
    privada/loopback/link-local (localhost, red interna del propio servidor,
    metadata de la nube, etc). No es a prueba de DNS-rebinding perfecto (el
    check y la conexión real no están atómicamente pineados), pero cubre el
    caso común de SSRF hacia recursos internos — proporcional para un
    endpoint de conveniencia de admin, no una superficie pública de alto
    valor."""
    try:
        parsed = urllib.parse.urlparse(url)
    except Exception:
        return False
    if parsed.scheme not in ("http", "https"):
        return False
    host = parsed.hostname
    if not host:
        return False
    try:
        infos = socket.getaddrinfo(host, None)
    except Exception:
        return False
    if not infos:
        return False
    for info in infos:
        ip_str = info[4][0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            return False
        if (ip.is_private or ip.is_loopback or ip.is_link_local
                or ip.is_multicast or ip.is_reserved or ip.is_unspecified):
            return False
    return True


@app.route("/api/extract-page-image", methods=["GET"])
def api_extract_page_image():
    """Dado el link a una página (p.ej. una ficha de competición de
    besoccer.com), visita la página EN EL SERVIDOR (sin CORS, a diferencia
    de un fetch desde el navegador) y devuelve la imagen representativa
    (og:image / twitter:image) para usarla como icono — petición usuario
    2026-07-03 ("quiero que merga enlaces así [link de una página, no de
    una imagen directa]"). Usado por `_pickIconFromUrl` en
    misc_body_1.html como fallback cuando la URL pegada no es ya
    directamente una imagen."""
    url = (request.args.get("url") or "").strip()
    if not url:
        return jsonify({"ok": False, "error": "falta url"}), 400
    if not _url_resolves_to_public_ip(url):
        return jsonify({"ok": False, "error": "esa URL no es accesible o no está permitida"}), 400
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                           "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"),
            "Accept": "text/html,application/xhtml+xml",
        })
        with urllib.request.urlopen(req, timeout=6) as resp:
            content_type = resp.headers.get("Content-Type", "") or ""
            if "html" not in content_type.lower() and "xml" not in content_type.lower():
                return jsonify({"ok": False, "error": "esa URL no devolvió una página web"}), 400
            raw = resp.read(1_500_000)
    except urllib.error.HTTPError as e:
        return jsonify({"ok": False, "error": "el servidor de esa página respondió con error " + str(e.code)}), 502
    except Exception:
        return jsonify({"ok": False, "error": "no se pudo acceder a esa URL"}), 502

    charset = "utf-8"
    m_charset = re.search(r"charset=([\w-]+)", content_type)
    if m_charset:
        charset = m_charset.group(1)
    try:
        page_html = raw.decode(charset, errors="ignore")
    except Exception:
        page_html = raw.decode("utf-8", errors="ignore")

    img_url = None
    for pattern in _OG_IMAGE_PATTERNS:
        m = pattern.search(page_html)
        if m:
            img_url = html_lib.unescape(m.group(1)).strip()
            break
    if not img_url:
        return jsonify({"ok": False, "error": "no se encontró ninguna imagen representativa en esa página"}), 404

    abs_url = urllib.parse.urljoin(url, img_url)
    if not _url_resolves_to_public_ip(abs_url):
        return jsonify({"ok": False, "error": "la imagen encontrada no es una URL válida"}), 400
    return jsonify({"ok": True, "image": abs_url})


@app.route("/api/kv/<key>", methods=["GET"])
def api_kv_get(key):
    if not _kv_is_allowed(key):
        return jsonify({"ok": False, "error": "key no permitida"}), 400
    row = GlobalState.query.filter_by(clave=key).first()
    if not row or not row.valor_json:
        resp = jsonify({"ok": True, "key": key, "value": None, "updated_at": ""})
        resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        return resp
    try:
        value = json.loads(row.valor_json)
    except Exception:
        value = None
    resp = jsonify({
        "ok": True,
        "key": key,
        "value": value,
        "updated_at": row.updated_at or "",
    })
    # Sin cabecera anti-caché explícita, un navegador puede servir una
    # copia guardada de esta respuesta al reabrir la MISMA URL (visto en
    # depuración 2026-08-08: dos peticiones separadas, minutos aparte,
    # devolvieron un "updated_at" IDÉNTICO al microsegundo — imposible
    # salvo que la segunda fuera una copia cacheada de la primera, no una
    # lectura fresca del servidor). Este endpoint se usa para diagnóstico
    # en vivo (pegar la URL en el navegador) — DEBE devolver siempre el
    # estado real, nunca una copia vieja.
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    return resp


def _tour_reset_ms(data):
    """`resetAt` (ms) de una cfg de torneo. Ausente/inválido → 0."""
    try:
        return float(data.get("resetAt") or 0) if isinstance(data, dict) else 0.0
    except (TypeError, ValueError):
        return 0.0


def _tour_protected_guard(base_key, value, now):
    """RED DE SEGURIDAD server-side para las cfgs de torneo — espejo del
    snapshot `_protected` de las ligas, pero MONOTÓNICO por nº de partidos
    JUGADOS (`_count_played`) en vez de por jugadores.

    Mantiene un high-water mark `tour_<id>_v1_protected` con el cuadro de MÁS
    progreso visto. Si un guardado REGRESA (menos partidos jugados) SIN un
    `resetAt` más reciente — el síntoma del bug 2026-06-25 «Mundial 2032: el
    80% de la fase de grupos se borró y salen grupos distintos» — se RESTAURA
    el snapshot (auto-recuperación), aunque TODOS los dispositivos hayan
    perdido su copia local. Un reinicio DELIBERADO (`resetAt` mayor) reemplaza
    el snapshot (nueva baseline). Devuelve el dict que se debe guardar en el
    main. No lanza."""
    if not isinstance(value, dict):
        return value
    pkey = base_key + "_protected"
    prow = GlobalState.query.filter_by(clave=pkey).first()
    prot = None
    if prow and prow.valor_json:
        try:
            prot = json.loads(prow.valor_json)
        except Exception:
            prot = None
    if isinstance(prot, dict):
        deliberate = _tour_reset_ms(value) > _tour_reset_ms(prot)
        if not deliberate and _tour_count_played(value) < _tour_count_played(prot):
            # Regresión sin reinicio deliberado → restaurar el snapshot. El
            # high-water mark NO baja (sigue protegiendo el progreso).
            return prot
    # value progresa, es un reinicio deliberado, o no había snapshot →
    # actualizar el high-water mark al valor entrante.
    try:
        pbody = json.dumps(value, ensure_ascii=False)
        if len(pbody.encode("utf-8")) <= _KV_MAX_BYTES:
            if prow:
                prow.valor_json = pbody
                prow.updated_at = now
            else:
                db.session.add(GlobalState(clave=pkey, valor_json=pbody, updated_at=now))
    except Exception:
        pass
    return value


@app.route("/api/tour-protected/<tid>", methods=["GET"])
def api_tour_protected_get(tid):
    """Diagnóstico/recuperación del high-water mark de un torneo (espejo del
    GET de `liga_ext_<slug>_protected`). Devuelve el snapshot protegido y su
    nº de partidos jugados. Útil para verificar que el cuadro está a salvo
    aunque el main se haya quedado vacío."""
    base = "tour_" + tid + "_v1"
    row = GlobalState.query.filter_by(clave=base + "_protected").first()
    if not row or not row.valor_json:
        return jsonify({"ok": True, "tour": tid, "data": None, "played": 0, "updated_at": ""})
    try:
        data = json.loads(row.valor_json)
    except Exception:
        data = None
    return jsonify({
        "ok": True,
        "tour": tid,
        "data": data,
        "played": _tour_count_played(data) if isinstance(data, dict) else 0,
        "updated_at": row.updated_at or "",
    })


@app.route("/api/tour-wipe/<tid>", methods=["POST"])
def api_tour_wipe(tid):
    """Borra PERMANENTEMENTE (DELETE de verdad, no un reset a vacío) las
    filas `tour_<tid>_v1` y `tour_<tid>_v1_protected` de la base de
    datos. Un guardado con `resetAt` fresco (el mecanismo que ya usaba
    "🗑 Borrar para siempre" en el cliente) deja el torneo vacío pero
    la fila SIGUE existiendo en la BD — petición explícita del usuario
    ("aniquilalo", 2026-08-10) de que el borrado sea TOTAL, sin ningún
    residuo server-side, para los torneos que ya ha decidido no volver
    a usar nunca.

    Solo acepta ids que casen con `_KV_ALLOWED_REGEX` (los mismos
    `tour_<id>_v1` que el resto del proyecto reconoce) — no es un
    DELETE genérico de cualquier clave arbitraria."""
    base_key = "tour_" + tid + "_v1"
    if not _KV_ALLOWED_REGEX.match(base_key):
        return jsonify({"ok": False, "error": "id de torneo no reconocido"}), 400
    deleted = []
    for clave in (base_key, base_key + "_protected"):
        row = GlobalState.query.filter_by(clave=clave).first()
        if row:
            db.session.delete(row)
            deleted.append(clave)
    if deleted:
        db.session.commit()
    return jsonify({"ok": True, "tid": tid, "deleted": deleted})


@app.route("/api/kv/<key>", methods=["POST"])
def api_kv_set(key):
    if not _kv_is_allowed(key):
        return jsonify({"ok": False, "error": "key no permitida"}), 400
    body = request.get_json(silent=True) or {}
    if "value" not in body:
        return jsonify({"ok": False, "error": "falta `value`"}), 400
    value = body.get("value")
    # Flag de escritura AUTORITATIVA (acción explícita del admin): para los
    # blobs de recencia hace que el valor gane SIEMPRE con sello del reloj
    # del servidor (defeat clock-skew de otros dispositivos). Ver el merge
    # de `_KV_RECENCY_BLOB_KEYS` abajo.
    authoritative = bool(body.get("authoritative"))
    try:
        payload = json.dumps(value, ensure_ascii=False)
    except (TypeError, ValueError):
        return jsonify({"ok": False, "error": "value no serializable"}), 400
    if len(payload.encode("utf-8")) > _KV_MAX_BYTES:
        return jsonify({"ok": False, "error": "payload supera 2 MB"}), 413
    now = utc_now_iso()
    row = GlobalState.query.filter_by(clave=key).first()
    # Defensa en profundidad para el registro de torneos visibles
    # (tour_registry_v1): FUSIÓN POR RECENCIA. La lista `visible` no
    # encoge por una copia stale/corta (otro móvil, POST perdido tras un
    # GET viejo) — anti-wipe de las cajas de Rondas Previas/Finales
    # ("Road Copa Asia", "Mundial 2032"…). PERO un ocultado EXPLÍCITO
    # del admin (sello `hiddenAt` reciente) SÍ retira el slot de
    # `visible`: si no, las cajas ocultas volvían a salir al recargar
    # (bug 2026-06-03). Lo decide la última acción real (hiddenAt vs
    # shownAt), no un "visible gana siempre".
    if key == "tour_registry_v1" and row and row.valor_json:
        try:
            value = _tour_registry_merge(row.valor_json, value)
            payload = json.dumps(value, ensure_ascii=False)
        except Exception:
            pass
    # FUSIÓN multi-dispositivo de las cfg de torneo (tour_<id>_v1, p.ej.
    # tour_asia_v1 = "Road Copa Asia"): se UNEN los resultados por matchKey
    # para que un partido jugado en CUALQUIER móvil sobreviva, en vez de que
    # el último POST borre los de los demás (bug 2026-06-03, 6 móviles + PC).
    elif (key.startswith("tour_") and key.endswith("_v1")
          and key != "tour_registry_v1" and not key.endswith("_v1_protected")):
        try:
            merged = tour_cfg_merge(row.valor_json, value) if (row and row.valor_json) else value
            # RED DE SEGURIDAD: high-water mark por partidos jugados (espejo
            # del _protected de las ligas). Un guardado que regresa sin
            # `resetAt` se restaura desde el snapshot → el torneo NO se pierde
            # aunque TODOS los dispositivos pierdan su copia local (bug
            # 2026-06-25 «Mundial 2032»). Corre también en el primer save (sin
            # `row`) para sembrar el snapshot.
            guarded = _tour_protected_guard(key, merged, now)
            cand = json.dumps(guarded, ensure_ascii=False)
            # La unión nunca debería pasar de 2 MB (resultados acotados por
            # el tamaño del torneo), pero si lo hiciera, conservamos el
            # entrante sin fusionar para no rebotar el guardado.
            if len(cand.encode("utf-8")) <= _KV_MAX_BYTES:
                value, payload = guarded, cand
        except Exception:
            pass
    # FUSIÓN de la plantilla de selecciones (selecciones_squad_v1): unión por
    # nombre canónico, NUNCA borra una selección (espejo de la fusión que ya
    # hace el cliente, ahora también en el servidor).
    elif key == "selecciones_squad_v1" and row and row.valor_json:
        try:
            merged = sel_squad_merge(row.valor_json, value)
            cand = json.dumps(merged, ensure_ascii=False)
            if len(cand.encode("utf-8")) <= _KV_MAX_BYTES:
                value, payload = merged, cand
        except Exception:
            pass
    # Blobs de baja/sanción (club + selecciones) + HUD: merge por RECENCIA.
    # El blob con `updatedAt` mayor gana ENTERO. Anti-wipe: un POST stale no
    # pisa una copia más nueva; respeta consumos (no resucita sanciones
    # decrementadas porque el blob que las decrementó es más reciente).
    #
    # MODO AUTHORITATIVE (admin pulsó ✅ Guardar / ♻ / 📅 en el HUD): el
    # valor GANA SIEMPRE y el SERVIDOR SELLA `updatedAt` con SU PROPIO reloj
    # por encima de lo almacenado (`max(server_now, stored+1, client)`). Sin
    # esto, en un parque de 6 móviles + PC un dispositivo con el RELOJ
    # ADELANTADO dejaba en el server un valor viejo con un `updatedAt`
    # FUTURO; el guardado legítimo del admin (reloj correcto, ts menor) era
    # RECHAZADO por recencia aunque el POST devolvía 200 ("✓ HUD guardado"
    # mentía) y, al borrar datos, el GET devolvía ese valor viejo
    # ("vuelven a datos antiguos", foto usuario 2026-06-07). Sellar con el
    # reloj del server (única fuente monotónica) hace que la acción
    # explícita del admin domine y converja en todos los dispositivos.
    elif _kv_hub_base(key) in _KV_RECENCY_BLOB_KEYS:
        try:
            old = json.loads(row.valor_json) if (row and row.valor_json) else None
        except Exception:
            old = None
        old_ts = float((old or {}).get("updatedAt") or 0) if isinstance(old, dict) else 0.0
        new_ts = float((value or {}).get("updatedAt") or 0) if isinstance(value, dict) else 0.0
        if authoritative and isinstance(value, dict):
            srv_now = time.time() * 1000.0
            value["updatedAt"] = max(new_ts, old_ts + 1.0, srv_now)
            # REV MONOTÓNICO (reloj LÓGICO): la acción AUTORITATIVA del admin
            # (✅ Guardar / ♻ / 📅) SIEMPRE gana y deja el `rev` por ENCIMA de
            # cualquier copia — incluidos los clientes VIEJOS (sin `rev`, =0).
            # Así, una vez el admin guarda desde un cliente actualizado, ningún
            # móvil sin actualizar ni con el reloj adelantado puede volver a
            # pisar el HUD por recencia (causa raíz «el 🪙 vuelve a 0 al borrar
            # datos» en un parque de 6 móviles + PC, foto usuario 2026-06-11).
            if _kv_hub_base(key) in ("bayern_hud_overrides_v1", "tour_info_cards_v1", "menu_home_v1"):
                _old_rev = 0
                if isinstance(old, dict):
                    try:
                        _old_rev = int(old.get("rev") or 0)
                    except (TypeError, ValueError):
                        _old_rev = 0
                try:
                    _new_rev = int(value.get("rev") or 0)
                except (TypeError, ValueError):
                    _new_rev = 0
                value["rev"] = max(_old_rev, _new_rev) + 1
            # MERGE POR ID DE TORNEO (tour_info_cards_v1): un save autoritativo
            # desde un dispositivo con localStorage vacío (tras wipe) solo contiene
            # los IDs que editó; sin merge, borra el resto. Preserva los IDs del
            # server que el cliente NO trae; el cliente SIEMPRE gana en los suyos.
            if _kv_hub_base(key) == "tour_info_cards_v1" and isinstance(old, dict):
                _META_K = {"rev", "updatedAt"}
                _merged = {k: v for k, v in old.items() if k not in _META_K}
                for k, v in value.items():
                    if k not in _META_K:
                        _merged[k] = v  # el save del cliente gana por cada ID
                _merged["rev"] = value["rev"]
                _merged["updatedAt"] = value["updatedAt"]
                value = _merged
            # MERGE POR OID (munich-obj-state-v4/v5): un push AUTORITATIVO
            # (cada ✅/➕/➖ del usuario) reemplazaba el `checks`/`counters`
            # ENTERO por lo que el cliente traía en ESE instante. Si el DOM
            # que generó ese push no tenía TODOS los objetivos renderizados
            # (carrera con la hidratación de `munich-obj-overrides-v1`, o
            # cualquier re-render parcial), los oids AUSENTES de ese push
            # perdían su ✅ PARA SIEMPRE — un objetivo ya marcado desaparecía
            # sin que el usuario lo tocara (bug 2026-08-02: "marco varios en
            # verde, salgo y vuelvo a abrir y desaparece el verde de la
            # mayoría"). Se une por CLAVE (oid): el entrante gana en las
            # claves que trae, se CONSERVAN las que solo estaban en lo
            # almacenado. El cliente ya hace el mismo merge al guardar
            # localmente (defensa en profundidad, doble capa).
            # `reset:true` (ver cliente, `_munichObjReset`) marca un vaciado
            # INTENCIONAL (Reiniciar Temporada): debe ganar ENTERO, nunca
            # rellenarse con los oids del `old` o el reset no borraría nada.
            if (_kv_hub_base(key) in ("munich-obj-state-v4", "munich-obj-state-v5")
                    and isinstance(old, dict) and not value.get("reset")):
                for _sub in ("checks", "counters"):
                    _old_sub = old.get(_sub)
                    _new_sub = value.get(_sub)
                    if isinstance(_old_sub, dict) and isinstance(_new_sub, dict):
                        _merged_sub = dict(_old_sub)
                        _merged_sub.update(_new_sub)
                        value[_sub] = _merged_sub
            payload = json.dumps(value, ensure_ascii=False)
        elif _kv_hub_base(key) == "bayern_hud_overrides_v1" and isinstance(old, dict) and isinstance(value, dict):
            # HUD no-authoritative: defensa a prueba de balas.
            #
            # (0) REV MONOTÓNICO (2026-06-11). El blob lleva un reloj LÓGICO
            #     `rev` que SOLO crece en cada cambio real (espejo del `dayIdx`
            #     del cursor de fecha, que por eso SÍ sobrevive al wipe). Un
            #     push con `rev` MENOR que el almacenado es STALE — un cliente
            #     VIEJO sin actualizar (no manda `rev`, =0), un dispositivo con
            #     el RELOJ ADELANTADO, o una copia con defaults — y se RECHAZA
            #     ENTERO, NUNCA pisa el valor más nuevo por recencia. Es lo que
            #     hacía que la FECHA sobreviviera y el 🪙 no (recencia por reloj
            #     de pared, vulnerable a clock-skew + clientes stale).
            # (A) RECHAZO de POST PARCIAL sin campos ANCLA. El seed de
            #     arranque de un móvil con código viejo manda
            #     `{pi:8, updatedAt}` (el PI por defecto leído antes de
            #     hidratar) SIN money/rating/targets. Un blob legítimo
            #     SIEMPRE trae los campos ancla (los writers reales hacen
            #     merge sobre el cache COMPLETO ya hidratado). Por eso, si el
            #     almacenado tiene campos ancla y el entrante NO trae
            #     NINGUNO, el entrante NO es de fiar para NINGÚN campo (ni
            #     `pi`): se conserva lo almacenado ENTERO. Esto evita que el
            #     💊 vuelva a 8 (foto usuario 2026-06-08) aunque un móvil sin
            #     actualizar siga mandando el seed viejo.
            # (B) FIELD-MERGE que PRESERVA campos: los que el POST no trae se
            #     rellenan desde lo almacenado, así un write de un solo campo
            #     jamás vacía el resto. Recencia en los compartidos.
            try:
                old_rev = int(old.get("rev") or 0)
            except (TypeError, ValueError):
                old_rev = 0
            try:
                new_rev = int(value.get("rev") or 0)
            except (TypeError, ValueError):
                new_rev = 0
            _ANCHOR = ("money", "rating", "ratingTarget", "moneyTarget")
            inc_has_anchor = any(k in value for k in _ANCHOR)
            old_has_anchor = any(k in old for k in _ANCHOR)
            if new_rev < old_rev:
                # (0) STALE por reloj lógico (cliente viejo/stale/clock-skew):
                # conserva lo almacenado ENTERO.
                value, payload = old, row.valor_json
            elif old_has_anchor and not inc_has_anchor:
                # POST parcial (seed `{pi:8}`): conserva lo almacenado entero.
                value, payload = old, row.valor_json
            elif new_rev > old_rev or new_ts >= old_ts:
                merged = dict(old)
                merged.update(value)
                merged["rev"] = max(old_rev, new_rev)
                value, payload = merged, json.dumps(merged, ensure_ascii=False)
            else:
                value, payload = old, row.valor_json
        elif _kv_hub_base(key) in ("munich-obj-state-v4", "munich-obj-state-v5") and isinstance(old, dict) and isinstance(value, dict):
            # PROGRESO de objetivos del club: defensa a prueba de balas
            # (2026-06-11). Un cliente que arranca / auto-evalúa ANTES de
            # hidratar puede mandar un blob VACÍO (sin ✅ ni contadores)
            # sellado con ts fresco; sin esto MACHACABA el progreso real →
            # al borrar datos de navegación el ✅ marcado volvía a 0 (foto
            # usuario: "marco un objetivo, borro datos y se borra"). Si el
            # entrante está VACÍO y el almacenado NO, se CONSERVA lo
            # almacenado ENTERO. Un borrado LEGÍTIMO (Reiniciar Temporada /
            # ♻) va por authoritative=true → rama de arriba (gana + sella
            # reloj del server). Si no, recencia normal.
            if value.get("reset"):
                # Reset intencional (Reiniciar Temporada) re-llegando por el
                # timer NO-autoritativo de `_kvBlobSync.touch` tras el push
                # autoritativo inicial: debe ganar entero, ANTES incluso del
                # guard anti-vacío de abajo (que si no, lo rechazaría por
                # "vacío sospechoso" y resucitaría el progreso ya borrado).
                payload = json.dumps(value, ensure_ascii=False)
            elif _obj_state_is_empty(value) and not _obj_state_is_empty(old):
                value, payload = old, row.valor_json
            elif old_ts > new_ts:
                value, payload = old, row.valor_json
            else:
                # UNIÓN por oid (checks/counters), mismo principio que el
                # bloque AUTORITATIVO de arriba: el entrante gana en las
                # claves que trae, se CONSERVAN las que solo tenía lo
                # almacenado. Sin esto, un push de auto-sanado (SIN el flag
                # `authoritative` — p.ej. el timer interno de
                # `_kvBlobSync.touch`, o el re-push de `hydrate()`) también
                # podía borrar objetivos ausentes de esa pasada del DOM.
                for _sub in ("checks", "counters"):
                    _old_sub = old.get(_sub)
                    _new_sub = value.get(_sub)
                    if isinstance(_old_sub, dict) and isinstance(_new_sub, dict):
                        _merged_sub = dict(_old_sub)
                        _merged_sub.update(_new_sub)
                        value[_sub] = _merged_sub
                payload = json.dumps(value, ensure_ascii=False)
        elif _kv_hub_base(key) == "tour_info_cards_v1" and isinstance(old, dict) and isinstance(value, dict):
            # Info card editable por torneo, NO-authoritative (re-push
            # self-heal del cliente): REV MONOTÓNICO igual que el HUD. Un push
            # con `rev` MENOR que el almacenado es STALE (cliente viejo sin
            # `rev`=0, o copia atrasada) y se RECHAZA ENTERO; a igualdad de
            # `rev`, recencia por `updatedAt`. El ✅ Guardar del admin va por
            # authoritative=true (rama de arriba: sella reloj + bumpea rev y
            # gana siempre), así un reloj adelantado de otro móvil ya no puede
            # revivir un valor viejo (causa raíz «no se guarda ninguno»,
            # 2026-06-14).
            try:
                _old_rev = int(old.get("rev") or 0)
            except (TypeError, ValueError):
                _old_rev = 0
            try:
                _new_rev = int(value.get("rev") or 0)
            except (TypeError, ValueError):
                _new_rev = 0
            if _new_rev < _old_rev:
                value, payload = old, row.valor_json
            elif _new_rev == _old_rev and old_ts > new_ts:
                value, payload = old, row.valor_json
            else:
                # Merge por ID de torneo (mismo principio que en el save
                # autoritativo): el re-push solo trae los IDs que el
                # cliente conoce; conservar los del server que falten.
                _META_K = {"rev", "updatedAt"}
                _merged = {k: v for k, v in old.items() if k not in _META_K}
                for k, v in value.items():
                    if k not in _META_K:
                        _merged[k] = v
                _merged["rev"] = max(_old_rev, _new_rev)
                _merged["updatedAt"] = max(old_ts, new_ts)
                value, payload = _merged, json.dumps(_merged, ensure_ascii=False)
        elif _kv_hub_base(key) == "menu_home_v1" and isinstance(old, dict) and isinstance(value, dict):
            # MENÚ del home (cajas EQUIPOS): REV MONOTÓNICO (2026-06-27). El
            # re-push self-heal de un dispositivo NO-authoritative no puede
            # RESUCITAR una caja borrada: un push con `rev` MENOR que el
            # almacenado es STALE (copia vieja / reloj adelantado) y se RECHAZA
            # ENTERO; a igualdad de `rev`, recencia por `updatedAt`. La acción
            # del admin (añadir/editar/eliminar) va por authoritative=true (rama
            # de arriba: sella reloj + bumpea rev y gana siempre). Sin esto, en
            # un parque de varios móviles + PC un dispositivo con copia stale
            # revivía la caja borrada por recencia de reloj de pared (causa raíz
            # «el borrar desde el editor no funciona»).
            try:
                _old_rev = int(old.get("rev") or 0)
            except (TypeError, ValueError):
                _old_rev = 0
            try:
                _new_rev = int(value.get("rev") or 0)
            except (TypeError, ValueError):
                _new_rev = 0
            if _new_rev < _old_rev:
                value, payload = old, row.valor_json
            elif _new_rev == _old_rev and old_ts > new_ts:
                value, payload = old, row.valor_json
        elif row and row.valor_json and old_ts > new_ts:
            value, payload = old, row.valor_json
    # EXTRAS MANUALES del reparto europeo (eur_manual_extra_v1): el admin
    # añade equipos a mano desde varios dispositivos (móvil A añade un
    # equipo a la Previa R1, móvil B añade otro a la Previa R2) para
    # rellenar huecos de ligas que no consiguieron hidratarse. Merge por
    # UNIÓN por (zona, nombre) — NUNCA se pierde una adición legítima de
    # otro dispositivo por un POST que aún no la conoce (mismo principio
    # aditivo que el histórico de derbys). 2026-07-03.
    elif key == "eur_manual_extra_v1" and row and row.valor_json:
        try:
            merged = _eur_manual_extra_merge(row.valor_json, value)
            cand = json.dumps(merged, ensure_ascii=False)
            if len(cand.encode("utf-8")) <= _KV_MAX_BYTES:
                value, payload = merged, cand
        except Exception:
            pass
    # VITRINA DE TROFEOS (bayern_trofeos_v1 + variantes por hub _<id>):
    # RECENCIA + EMPTY-GUARD. Es un registro PERSISTENTE del admin que debe
    # SOBREVIVIR al borrado de datos / cambio de móvil de cualquiera de las 6
    # cajas de mister humano. Un POST vacío de un cliente recién wipeado NO
    # borra la vitrina que otro dispositivo ya subió (bug usuario 2026-06-27:
    # «tenía toda la vitrina del Arsenal-Álvaro y del Real Madrid-Acsa y no se
    # han guardado»). Corre también en el primer save (sin `row`) para sellar.
    elif _kv_hub_base(key) == "bayern_trofeos_v1":
        try:
            merged = _trofeos_merge(
                row.valor_json if row else None, value, authoritative)
            cand = json.dumps(merged, ensure_ascii=False)
            if len(cand.encode("utf-8")) <= _KV_MAX_BYTES:
                value, payload = merged, cand
        except Exception:
            pass
    # Fase de grupos de Champions/Europa/Conference (ucl_phase_v1/
    # uel_phase_v1/uecl_phase_v1): UNIÓN por partido, mismo criterio que
    # `_STATE_BRACKET_KEYS` (obligatorio, 2026-07-17). Estas 3 viajan por
    # `/api/kv/<key>` (whitelist `_KV_ALLOWED_EXACT`), no por
    # `competition_state` — de ahí el branch separado aquí en vez de en
    # `save_global_state`.
    elif key in ("ucl_phase_v1", "uel_phase_v1", "uecl_phase_v1") and row and row.valor_json:
        try:
            merged = bracket_state_merge(row.valor_json, value)
            cand = json.dumps(merged, ensure_ascii=False)
            if len(cand.encode("utf-8")) <= _KV_MAX_BYTES:
                value, payload = merged, cand
        except Exception:
            pass
    # Tabla PERMANENTE de estadísticas (pm_tally_<familia>_v1, obligatorio
    # 2026-08-16): UNIÓN por clave de partido, nunca recencia entera — dos
    # dispositivos pueden recortar jornadas DISTINTAS sin haberse
    # sincronizado, y ninguna de las dos aportaciones se puede perder.
    elif key.startswith("pm_tally_") and row and row.valor_json:
        try:
            merged = _pm_tally_merge(row.valor_json, value)
            cand = json.dumps(merged, ensure_ascii=False)
            if len(cand.encode("utf-8")) <= _KV_MAX_BYTES:
                value, payload = merged, cand
        except Exception:
            pass
    if row:
        row.valor_json = payload
        row.updated_at = now
    else:
        row = GlobalState(clave=key, valor_json=payload, updated_at=now)
        db.session.add(row)
    db.session.commit()
    return jsonify({"ok": True, "key": key, "updated_at": now})

# ══════════════════════════════════════════════════════════════════
# JUGADORES HARDCODED — fuente de última recuperación
# ══════════════════════════════════════════════════════════════════
# El frontend usa esto cuando el editor (ligaExt_*) y el resto de
# fuentes están vacíos pero la simulación sí tiene jugadores. La
# data viene del Python (`jugadores_data.py` — generada de
# SQUAD_REGISTRY original del bundle), así que es EXACTAMENTE la
# plantilla por defecto del simulador. Convertimos formato
# Python (numero/nombre/posicion/poder) → editor
# (num/name/pos/power).
@app.route("/api/jugadores-hardcoded", methods=["GET"])
def api_jugadores_hardcoded():
    POS_MAP = {
        "portero": "POR",
        "defensa": "DEF",
        "medio": "MED",
        "delantero": "DEL",
    }
    out = {}
    for team_name, players in jugadores_por_equipo.items():
        out_players = []
        for p in (players or []):
            out_players.append({
                "num": p.get("numero", "") or "",
                "name": p.get("nombre", "") or "",
                "pos": POS_MAP.get(p.get("posicion", "medio"), "MED"),
                "power": int(p.get("poder", 70) or 70),
            })
        out[team_name] = out_players
    return jsonify({"ok": True, "teams": out})


# ══════════════════════════════════════════════════════════════════
# LIVE MATCH — Sistema de partidos en tiempo real compartidos
# ══════════════════════════════════════════════════════════════════
# Permite que el admin publique eventos de un partido live (goles,
# tarjetas, etc.) y que otros dispositivos los vean en tiempo real
# vía polling cada 2-3 segundos.
#
# Modelo: GlobalState con clave 'live_match_<id>' + JSON con:
#   { id, home, away, comp, events:[], score:{a,b}, status:'playing'|'finished', updatedAt }
#
# Endpoints:
#   POST /api/live-match/<match_id>   → crear/actualizar partido
#   GET  /api/live-match/<match_id>   → leer estado actual (poll)
#   GET  /api/live-match              → listar partidos activos
#   DELETE /api/live-match/<match_id> → cerrar/borrar partido
# ══════════════════════════════════════════════════════════════════

def _live_key(match_id):
    return "live_match_" + str(match_id or "default")

@app.route("/api/live-match", methods=["GET"])
def api_live_match_list():
    """Lista todos los partidos live activos."""
    rows = GlobalState.query.filter(GlobalState.clave.like("live_match_%")).all()
    matches = []
    for row in rows:
        try:
            data = json.loads(row.valor_json or "{}")
            if data.get("status") != "finished":
                matches.append(data)
        except Exception:
            pass
    return jsonify({"ok": True, "matches": matches})

@app.route("/api/live-match/<match_id>", methods=["GET"])
def api_live_match_get(match_id):
    """Lee el estado actual de un partido (para polling de espectadores)."""
    key = _live_key(match_id)
    row = GlobalState.query.filter_by(clave=key).first()
    if not row:
        return jsonify({"ok": False, "error": "Partido no encontrado"}), 404
    since = request.args.get("since", "")
    if since and since == (row.updated_at or ""):
        return ("", 304)
    try:
        data = json.loads(row.valor_json or "{}")
    except Exception:
        data = {}
    return jsonify({
        "ok": True,
        "match": data,
        "updated_at": row.updated_at or ""
    })

@app.route("/api/live-match/<match_id>", methods=["POST"])
def api_live_match_post(match_id):
    """Crear o actualizar un partido live (llamado por el admin)."""
    payload = request.get_json(silent=True) or {}
    key = _live_key(match_id)
    now = utc_now_iso()
    payload["updatedAt"] = now
    payload.setdefault("id", match_id)
    payload.setdefault("events", [])
    payload.setdefault("score", {"a": 0, "b": 0})
    payload.setdefault("status", "playing")
    json_str = json.dumps(payload, ensure_ascii=False)
    row = GlobalState.query.filter_by(clave=key).first()
    if row:
        row.valor_json = json_str
        row.updated_at = now
    else:
        row = GlobalState(clave=key, valor_json=json_str, updated_at=now)
        db.session.add(row)
    db.session.commit()
    return jsonify({"ok": True, "updated_at": now})

@app.route("/api/live-match/<match_id>", methods=["DELETE"])
def api_live_match_delete(match_id):
    """Cerrar/borrar un partido live."""
    key = _live_key(match_id)
    row = GlobalState.query.filter_by(clave=key).first()
    if row:
        db.session.delete(row)
        db.session.commit()
    return jsonify({"ok": True})

@app.route("/api/debug", methods=["GET"])
def api_debug():
    """Endpoint de diagnóstico: revela qué backend de base de datos se
    está usando y cuántas filas hay en las tablas clave. Sirve para
    saber en 2 segundos si la app corre con SQLite efímera (Railway
    sin plugin Postgres → datos que se pierden en cada deploy) o con
    Postgres persistente (DATABASE_URL inyectada por el plugin).

    No expone credenciales: solo el backend (`sqlite`/`postgresql`) y,
    en el caso de Postgres, el host sin contraseña."""
    try:
        engine_url = str(db.engine.url)
    except Exception:
        engine_url = app.config.get("SQLALCHEMY_DATABASE_URI", "")
    backend = "sqlite" if engine_url.startswith("sqlite") else (
        "postgresql" if engine_url.startswith("postgresql") else "unknown"
    )
    # Sanitizar la URL: ocultar contraseña si viene en la URI.
    sanitized = engine_url
    if "@" in sanitized and "://" in sanitized:
        try:
            scheme, rest = sanitized.split("://", 1)
            if "@" in rest:
                creds, host = rest.split("@", 1)
                user = creds.split(":", 1)[0]
                sanitized = scheme + "://" + user + ":***@" + host
        except Exception:
            pass
    # No basta con mirar si el backend es Postgres: en Render, el SQLite
    # sobre el disco persistente montado por render.yaml (ver
    # `.render-volume-marker` y `_persistence_diagnostic()`) TAMBIÉN es
    # durable. Reutilizamos ese diagnóstico (fuente única) en vez de
    # repetir aquí la comprobación "backend == postgresql" a secas —
    # eso hacía que el banner de aviso saltara en falso en Render con el
    # disco correctamente montado, con instrucciones que además
    # apuntaban a Railway (plataforma que este deploy ya no usa).
    _diag = _persistence_diagnostic()
    is_persistent = _diag.startswith("PERSISTENT")
    persistence_note = (
        ("PERSISTENTE ✅ — " + _diag) if is_persistent
        else ("EFÍMERA ⚠️ — " + _diag)
    )
    # Contar filas para ver qué hay guardado.
    try:
        global_rows = GlobalState.query.count()
        liga_ext_rows = GlobalState.query.filter(
            GlobalState.clave.like("liga_ext_%")
        ).count()
        live_match_rows = GlobalState.query.filter(
            GlobalState.clave.like("live_match_%")
        ).count()
        partidos_rows = Partido.query.count()
        eventos_rows = Evento.query.count()
    except Exception as e:
        return jsonify({
            "ok": False,
            "backend": backend,
            "persistent": is_persistent,
            "db_url_sanitized": sanitized,
            "error": str(e),
        }), 500
    # Listar las ligas externas que tienen datos (nombres + tamaño JSON).
    ligas_ext = []
    try:
        for row in GlobalState.query.filter(GlobalState.clave.like("liga_ext_%")).all():
            try:
                data = json.loads(row.valor_json or "{}")
                n_teams = len((data or {}).get("teams") or [])
            except Exception:
                n_teams = None
            ligas_ext.append({
                "clave": row.clave,
                "teams": n_teams,
                "updated_at": row.updated_at or "",
            })
    except Exception:
        pass
    # Diagnóstico de TAMAÑO — las 25 filas más pesadas de todo GlobalState
    # (bytes UTF-8 de valor_json), con aviso si alguna se acerca o supera
    # el límite de _KV_MAX_BYTES (2 MB) que aplica a todo guardado nuevo.
    # Objetivo: ver de un vistazo si queda algún `tour_*`/`liga_ext_*` ya
    # inflado desde ANTES de que existiera ese límite (guardados legacy no
    # pasan por el chequeo de tamaño, así que pueden seguir viviendo en la
    # base de datos aunque hoy ya no se puedan volver a escribir así).
    biggest_rows = []
    try:
        near_limit = int(_KV_MAX_BYTES * 0.5)
        rows_all = GlobalState.query.with_entities(
            GlobalState.clave, GlobalState.valor_json, GlobalState.updated_at
        ).all()
        sized = []
        for clave, valor_json, updated_at in rows_all:
            try:
                nbytes = len((valor_json or "").encode("utf-8"))
            except Exception:
                nbytes = 0
            sized.append((nbytes, clave, updated_at))
        sized.sort(key=lambda t: t[0], reverse=True)
        for nbytes, clave, updated_at in sized[:25]:
            flag = "🔴 SUPERA el límite de guardado (2 MB)" if nbytes > _KV_MAX_BYTES else (
                "⚠️ cerca del límite" if nbytes > near_limit else ""
            )
            biggest_rows.append({
                "clave": clave,
                "bytes": nbytes,
                "mb": round(nbytes / 1048576, 3),
                "updated_at": updated_at or "",
                "aviso": flag,
            })
    except Exception as e:
        biggest_rows = [{"error": str(e)}]
    return jsonify({
        "ok": True,
        "backend": backend,
        "persistent": is_persistent,
        "db_url_sanitized": sanitized,
        "persistence": persistence_note,
        "counts": {
            "global_state_rows": global_rows,
            "liga_ext_rows": liga_ext_rows,
            "live_match_rows": live_match_rows,
            "partidos_rows": partidos_rows,
            "eventos_rows": eventos_rows,
        },
        "ligas_ext": ligas_ext,
        "biggest_rows": biggest_rows,
        "kv_max_bytes": _KV_MAX_BYTES,
        "database_url_env_set": bool(os.environ.get("DATABASE_URL")),
    })

@app.route("/sw.js")
def service_worker():
    sw_path = os.path.join(app.static_folder, 'js', 'sw.js')
    with open(sw_path, 'r', encoding='utf-8') as f:
        content = f.read()
    resp = make_response(content)
    resp.headers['Content-Type'] = 'application/javascript; charset=utf-8'
    resp.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    resp.headers['Service-Worker-Allowed'] = '/'
    return resp

@app.route("/")
def inicio():
    resp = make_response(render_template("index.html"))
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp

@app.route("/calendario")
def calendario_view():
    return redirect("/espana/liga-ea-sports/clasificacion", code=302)

@app.route("/clasificacion")
def clasificacion():
    resp = make_response(render_template("index.html"))
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp

@app.route("/estadisticas")
def estadisticas():
    from collections import Counter

    eventos = Evento.query.all()

    goles_counter = Counter()
    amarillas_counter = Counter()
    rojas_counter = Counter()
    penaltis_marcados_counter = Counter()
    penaltis_fallados_counter = Counter()
    faltas_gol_counter = Counter()
    autogoles_counter = Counter()

    for ev in eventos:
        tipo = ev.tipo or ""
        jug = ev.jugador or "Desconocido"
        if tipo == "gol":
            goles_counter[jug] += 1
        elif tipo == "pen-gol":
            goles_counter[jug] += 1
            penaltis_marcados_counter[jug] += 1
        elif tipo == "falta-gol":
            goles_counter[jug] += 1
            faltas_gol_counter[jug] += 1
        elif tipo == "propia":
            autogoles_counter[jug] += 1
        elif tipo == "amarilla":
            amarillas_counter[jug] += 1
        elif tipo in ("roja", "doble-amarilla"):
            rojas_counter[jug] += 1
        elif tipo == "pen-fallo":
            penaltis_fallados_counter[jug] += 1

    def top(counter):
        return sorted(counter.items(), key=lambda x: x[1], reverse=True)

    resp = make_response(render_template(
        "estadisticas.html",
        goles=top(goles_counter),
        amarillas=top(amarillas_counter),
        rojas=top(rojas_counter),
        penaltis_marcados=top(penaltis_marcados_counter),
        penaltis_fallados=top(penaltis_fallados_counter),
        faltas_gol=top(faltas_gol_counter),
        autogoles=top(autogoles_counter),
    ))
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp


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
    # CRÍTICO 2026-05-18: este catch-all sirve la SPA en CUALQUIER ruta
    # (p.ej. /ligas/inglaterra). Antes NO mandaba cabeceras no-cache,
    # así que el navegador/CDN servía un index.html CACHEADO con el JS
    # VIEJO — ninguno de los fixes (watchdog, tope round-robin, sello
    # _sanV…) llegaba al usuario y la sim seguía "rota" idéntica. El
    # index.html incrusta server-side misc_body_1/2, así que DEBE ir
    # siempre fresco.
    resp = make_response(render_template("index.html"))
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp

with app.app_context():
    # AMBOS envueltos en try/except (2026-08-18, "la Web no funciona" —
    # el usuario reportó la app COMPLETAMENTE inalcanzable, sin ningún
    # error de JS/HTML detectable en el cliente). Estas 2 líneas eran
    # las ÚNICAS de todo este bloque de arranque SIN blindar, pese a
    # que el resto del bloque (más abajo) ya declara explícitamente la
    # regla "envuelta en try/except para que un fallo aquí NUNCA impida
    # arrancar el servidor". Si la BD (Postgres de Railway) no responde
    # en el instante exacto del boot del contenedor —un blip transitorio
    # de red, el plugin de BD arrancando un pelín más tarde que la app,
    # credenciales rotando— `db.create_all()`/`get_or_create_global_state()`
    # LANZABAN a nivel de MÓDULO: el objeto Flask nunca terminaba de
    # inicializarse, gunicorn no podía levantar NINGÚN worker, y Railway
    # servía un contenedor caído en bucle — exactamente "no carga nada",
    # para CUALQUIER ruta, incluida `/` (que ni siquiera toca la BD:
    # `inicio()` solo hace `render_template("index.html")`). Con el
    # try/except, un blip de BD deja la home + los assets estáticos
    # sirviendo con normalidad (todo el juego es client-side/localStorage
    # primero) mientras solo fallan los endpoints `/api/*` hasta que la
    # BD se recupere — en vez de tirar site entero.
    try:
        db.create_all()
        get_or_create_global_state()
    except Exception as _e:
        print(f"[boot] BD no disponible al arrancar (se reintentará por petición): {_e}")
    # Cargar flags de jugadores (C/F/P/⭐/⚾) desde la BD a memoria para que
    # el motor de simulación Python los aplique desde el primer partido.
    try:
        _load_player_flags_on_startup()
    except Exception:
        pass
    # Purga AUTOMÁTICA de ligas fantasma en cada arranque (2026-08-16,
    # petición usuario: "no quiero tener que eliminar ligas antiguas que
    # ya debías haber eliminado"). Antes esto exigía que el admin pulsara
    # un botón con PIN — ahora se ejecuta sola en cuanto el servidor
    # arranca, sin que ningún humano tenga que hacer nada. Idempotente y
    # barata (no-op si ya no queda nada que borrar), envuelta en
    # try/except para que un fallo aquí NUNCA impida arrancar el servidor.
    try:
        _deleted = _purge_dead_merged_leagues()
        if _deleted:
            print(f"[purga-arranque] {len(_deleted)} filas de ligas fantasma eliminadas: {sorted(_deleted)}")
    except Exception as _e:
        print(f"[purga-arranque] fallo no crítico: {_e}")

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
