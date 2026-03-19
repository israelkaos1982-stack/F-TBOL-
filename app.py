from flask import Flask, render_template, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
import random
import os

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
equipos_humanos = ["Real Madrid", "FC Barcelona", "Athletic Club", "Real Sociedad", "Betis"]

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

class Evento(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    partido_id = db.Column(db.Integer)
    tipo = db.Column(db.String(50))
    equipo = db.Column(db.String(100))
    jugador = db.Column(db.String(100))

# --- PROBABILIDADES ---
BASE = {
    "portero": 0.001,
    "defensa": 7.5,
    "medio": 17.5,
    "delantero": 70
}

MULTIGOL = [1, 0.37, 0.22, 0.12, 0.06]
BONUS_LOCAL = 1.08

# --- FUNCIONES MOTOR ---

def calcular_prob(perfil, local=False, goles_previos=0):
    base = BASE.get(perfil["posicion"], 10)
    prob = base + (perfil["poder"] / 100)

    if local:
        prob *= BONUS_LOCAL

    prob *= MULTIGOL[min(goles_previos, 4)]
    return prob


def elegir_goleador(equipo, local=False, conteo=None):
    if conteo is None:
        conteo = {}

    jugadores = jugadores_por_equipo[equipo]
    pesos = []

    for j in jugadores:
        goles_previos = conteo.get(j["nombre"], 0)
        p = calcular_prob(j, local, goles_previos)
        pesos.append(max(p, 0.001))

    elegido = random.choices(jugadores, weights=pesos, k=1)[0]
    return elegido["nombre"]


def simular_goles(equipo, local=False):
    jugadores = jugadores_por_equipo[equipo]

    media = sum([calcular_prob(j, local) for j in jugadores]) / len(jugadores)

    if media < 15:
        pesos = [45, 35, 15, 4, 1]
    elif media < 25:
        pesos = [30, 35, 22, 9, 4]
    elif media < 40:
        pesos = [20, 30, 25, 15, 10]
    else:
        pesos = [10, 25, 30, 20, 15]

    return random.choices([0,1,2,3,4], weights=pesos, k=1)[0]


def elegir_mvp(local, visitante, gl, gv, conteo_local, conteo_visitante):
    candidatos = []

    for j, g in conteo_local.items():
        candidatos.append((j, g, local))
    for j, g in conteo_visitante.items():
        candidatos.append((j, g, visitante))

    if candidatos:
        candidatos.sort(key=lambda x: x[1], reverse=True)
        return candidatos[0][0]

    return random.choice(jugadores_por_equipo[local])["nombre"]


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
            l, v = temp[i], temp[n-1-i]
            if l != "DESCANSA" and v != "DESCANSA":
                jornada.append((l, v))
        jornadas.append(jornada)
        temp.insert(1, temp.pop())

    vuelta = [[(v,l) for l,v in j] for j in jornadas]
    return jornadas + vuelta

calendario = generar_calendario(equipos)

# --- SIMULACIÓN ---
def simular_y_guardar(jornada, local, visitante):
    if Partido.query.filter_by(local=local, visitante=visitante).first():
        return

    gl = simular_goles(local, True)
    gv = simular_goles(visitante, False)

    conteo_local = {}
    conteo_visitante = {}
    eventos = []

    for _ in range(gl):
        g = elegir_goleador(local, True, conteo_local)
        conteo_local[g] = conteo_local.get(g, 0) + 1
        eventos.append((local, g))

    for _ in range(gv):
        g = elegir_goleador(visitante, False, conteo_visitante)
        conteo_visitante[g] = conteo_visitante.get(g, 0) + 1
        eventos.append((visitante, g))

    mvp = elegir_mvp(local, visitante, gl, gv, conteo_local, conteo_visitante)

    p = Partido(
        jornada=jornada,
        local=local,
        visitante=visitante,
        goles_local=gl,
        goles_visitante=gv,
        mvp=mvp
    )
    db.session.add(p)
    db.session.commit()

    for eq, jug in eventos:
        db.session.add(Evento(
            partido_id=p.id,
            tipo="gol",
            equipo=eq,
            jugador=jug
        ))
    db.session.commit()


# --- RUTAS ---
@app.route("/")
def inicio():
    return render_template("index.html")

@app.route("/calendario")
def calendario_view():
    for i, jornada in enumerate(calendario, 1):
        for l, v in jornada:
            if l not in equipos_humanos and v not in equipos_humanos:
                simular_y_guardar(i, l, v)

    partidos = Partido.query.all()
    res = {f"{p.local}-{p.visitante}": p for p in partidos}

    return render_template("calendario.html", jornadas=calendario, resultados=res)

@app.route("/clasificacion")
def clasificacion():
    partidos = Partido.query.all()
    tabla = calcular_tabla(equipos_primera, partidos)

    return render_template("clasificacion.html", tabla=tabla)

@app.route("/reiniciar")
def reiniciar():
    Evento.query.delete()
    Partido.query.delete()
    db.session.commit()
    return redirect(url_for("calendario_view"))

with app.app_context():
    db.create_all()

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)