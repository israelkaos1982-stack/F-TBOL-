from flask import Flask, render_template, redirect, url_for, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import random
import os

# --- IMPORTANTE: Importamos datos y lógica externa ---
from jugadores_data import jugadores_por_equipo
from logica_liga import calcular_tabla, obtener_resultados_ia

app = Flask(__name__)

# Configuración de base de datos
basedir = os.path.abspath(os.path.dirname(__file__))
instance_dir = os.path.join(basedir, "instance")
os.makedirs(instance_dir, exist_ok=True)

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + os.path.join(instance_dir, "liga.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

# --- CONFIGURACIÓN DE LIGA ---
equipos_humanos = ["Real Madrid", "FC Barcelona", "Athletic Club", "Real Sociedad", "Betis"]

equipos_primera = [
    "FC Barcelona", "Real Madrid", "Atletico Madrid", "Villarreal", "Betis", 
    "Celta", "Real Sociedad", "Espanyol", "Getafe", "Athletic Club", 
    "Osasuna", "Girona", "Valencia", "Rayo Vallecano", "Sevilla", 
    "Mallorca", "Deportivo Alavés", "Elche", "Levante", "Real Oviedo"
]

# Sacamos la lista de nombres de equipos del diccionario importado
equipos = list(jugadores_por_equipo.keys())

# --- MODELOS ---
class Partido(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    jornada = db.Column(db.Integer, nullable=False)
    local = db.Column(db.String(100), nullable=False)
    visitante = db.Column(db.String(100), nullable=False)
    goles_local = db.Column(db.Integer, nullable=False)
    goles_visitante = db.Column(db.Integer, nullable=False)
    mvp = db.Column(db.String(100), nullable=True)

class Evento(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    partido_id = db.Column(db.Integer, db.ForeignKey("partido.id"), nullable=False)
    tipo = db.Column(db.String(50), nullable=False)
    equipo = db.Column(db.String(100), nullable=False)
    jugador = db.Column(db.String(100), nullable=False)

# --- LÓGICA DE MOTOR ---
def elegir_jugador(equipo):
    if equipo in jugadores_por_equipo:
        return random.choice(jugadores_por_equipo[equipo])
    return "Jugador Genérico"

def generar_calendario(lista_equipos):
    temp_list = lista_equipos[:]
    if len(temp_list) % 2 != 0: temp_list.append("DESCANSA")
    n = len(temp_list)
    jornadas = []
    for j in range(n - 1):
        p = []
        for i in range(n // 2):
            local, visitante = temp_list[i], temp_list[n - 1 - i]
            if local != "DESCANSA" and visitante != "DESCANSA":
                p.append((local, visitante))
        jornadas.append(p)
        temp_list.insert(1, temp_list.pop())
    
    vuelta = []
    for j in jornadas:
        vuelta.append([(v, l) for l, v in j])
    return jornadas + vuelta

calendario = generar_calendario(equipos)

def simular_y_guardar_partido(jornada_num, local, visitante):
    if Partido.query.filter_by(local=local, visitante=visitante).first(): return
    
    gl, gv = random.randint(0, 4), random.randint(0, 4)
    eventos = []
    
    for _ in range(gl): eventos.append({"tipo": "gol", "equipo": local, "jugador": elegir_jugador(local)})
    for _ in range(gv): eventos.append({"tipo": "gol", "equipo": visitante, "jugador": elegir_jugador(visitante)})
    
    mvp = elegir_jugador(local if gl >= gv else visitante)
    
    partido = Partido(jornada=jornada_num, local=local, visitante=visitante, goles_local=gl, goles_visitante=gv, mvp=mvp)
    db.session.add(partido)
    db.session.commit()
    
    for ev in eventos:
        db.session.add(Evento(partido_id=partido.id, tipo=ev["tipo"], equipo=ev["equipo"], jugador=ev["jugador"]))
    db.session.commit()

# --- RUTAS ---
@app.route("/")
def inicio(): 
    return render_template("index.html")

@app.route("/calendario")
def ver_calendario():
    # 1. Simulación automática de IA vs IA
    for idx, jornada in enumerate(calendario, 1):
        for loc, vis in jornada:
            if loc in equipos_primera and vis in equipos_primera:
                if loc not in equipos_humanos and vis not in equipos_humanos:
                    simular_y_guardar_partido(idx, loc, vis)

    # 2. Filtrar solo partidos de Humanos para la vista
    cal_visible = [[p for p in j if p[0] in equipos_humanos or p[1] in equipos_humanos] for j in calendario]
    
    # 3. Obtener resultados para pintar en el HTML
    partidos = Partido.query.all()
    res = {f"{p.local}-{p.visitante}": p for p in partidos}
    
    return render_template("calendario.html", jornadas=cal_visible, resultados=res, humanos=equipos_humanos)

@app.route("/clasificacion")
def ver_clasificacion():
    # Traemos todos los partidos de la base de datos
    todos_los_partidos = Partido.query.all()
    
    # Usamos las funciones de logica_liga.py
    tabla = calcular_tabla(equipos_primera, todos_los_partidos)
    jornadas_ia = obtener_resultados_ia(todos_los_partidos, equipos_primera, equipos_humanos)
    
    return render_template("clasificacion.html", 
                           tabla=tabla, 
                           jornadas_ia=jornadas_ia, 
                           humanos=equipos_humanos)

@app.route("/reiniciar")
def reiniciar():
    Evento.query.delete()
    Partido.query.delete()
    db.session.commit()
    return redirect(url_for("ver_calendario"))

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(host="0.0.0.0", port=5000, debug=True)
