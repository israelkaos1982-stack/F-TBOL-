from flask import Flask, render_template, redirect, url_for, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import random
import os

app = Flask(__name__)

# Configuración de base de datos
basedir = os.path.abspath(os.path.dirname(__file__))
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + os.path.join(basedir, "instance", "liga.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

if not os.path.exists("instance"):
    os.makedirs("instance")

db = SQLAlchemy(app)

# Lista de equipos y jugadores
equipos = ["Deportivo Alavés", "Athletic Club", "Atletico Madrid", "FC Barcelona", "Betis", "Celta", "Elche", "Espanyol", "Getafe", "Girona", "Levante", "Mallorca", "Osasuna", "Rayo Vallecano", "Real Madrid", "Real Oviedo", "Real Sociedad", "Sevilla", "Valencia", "Villarreal"]
equipos_humanos = ["Real Madrid", "FC Barcelona", "Athletic Club", "Real Sociedad", "Betis"]

jugadores_por_equipo = {
    "Deportivo Alavés": ["Mariano Díaz", "Lucas Boyé", "Toni Martínez", "Ibrahim Diabaté", "Aitor Mañas", "Diego Morcillo", "Youssef Enriquez Lekhedim", "Antonio Blanco", "Carles Aleñá", "Denis Suárez", "Abderrahman Rebbach", "Calebe Gonçalves", "Carlos Benavídez", "Pablo Ibáñez", "Jon Guridi", "Ander Guevara", "Facundo Garcés", "Nahuel Tenaglia", "Jonny Otto", "Jon Pacheco", "Ville Koski", "Victor Parada", "Ángel Pérez", "Antonio Sivera", "Raúl Fernández", "Grégoire Swiderski"],
    "Athletic Club": ["Maroan Sannadi", "Gorka Guruzeta", "Urko Izeta", "Asier Hierro", "Nico Williams", "Iñaki Williams", "Oihan Sancet", "Álex Berenguer", "Mikel Jauregizar", "Iñigo Ruiz de Galarreta", "Robert Navarro", "Unai Gómez", "Beñat Prados", "Alejandro Rego", "Selton Sanchez", "Mikel Vesga", "Nico Serrano", "Eder Garcia", "Aymeric Laporte", "Daniel Vivian", "Adama Boiro", "Yuri Berchiche", "Aitor Paredes", "Yeray Álvarez", "Jesús Areso", "Andoni Gorosabel", "Íñigo Lekue", "Unai Eguíluz", "Iker Monreal Agundez", "Unai Simón", "Alex Padilla"],
    "Atletico Madrid": ["Julián Alvarez", "Antoine Griezmann", "Ademola Lookman", "Alexander Sørloth", "Thiago Almada", "Nicolás González", "Giuliano Simeone", "Alejandro Baena", "Johnny Cardoso", "Pablo Barrios", "Koke", "Obed Vargas", "Rodrigo Mendoza", "Nahuel Molina", "Marcos Llorente", "Clément Lenglet", "Robin Le Normand", "José María Giménez", "Dávid Hancko", "Marc Pubill", "Matteo Ruggeri", "Jan Oblak", "Juan Musso"],
    "FC Barcelona": ["Robert Lewandowski", "Ferran Torres", "Roony Bardghji", "Lamine Yamal", "Raphinha", "Pedri", "Marcus Rashford", "Pablo Gavi", "Frenkie de Jong", "Dani Olmo", "Fermín López", "Marc Bernal", "Marc Casadó", "Tomás Marqués", "Pau Cubarsí", "Jules Koundé", "Ronald Araújo", "Alejandro Balde", "João Cancelo", "Andreas Christensen", "Eric García", "Gerard Martín", "Xavi Espart", "Álvaro Cortés", "Joan García", "Wojciech Szczęsny", "Diego Kochen"],
    "Betis": ["Cédric Bakambu", "Cucho Hernández", "Chimy Ávila", "Antony", "Abdessamad Ezzalzouli", "Sofyan Amrabat", "Isco", "Giovani Lo Celso", "Rodrigo Riquelme", "Nelson Deossa", "Álvaro Fidalgo", "Pablo Fornals", "Marc Roca", "Sergi Altimira", "Héctor Bellerín", "Natan", "Junior Firpo", "Valentín Gómez", "Marc Bartra", "Ricardo Rodríguez", "Diego Llorente", "Aitor Ruibal", "Angel Ortiz", "Adrián", "Pau López", "Álvaro Valles"],
    "Celta": ["Iago Aspas", "Borja Iglesias", "Ferran Jutglà", "Jones El-Abdellaoui", "Pablo Durán", "Ilaix Moriba", "Williot Swedberg", "Óscar Mingueza", "Matías Vecino", "Fer López", "Franco Cervi", "Hugo Álvarez", "Hugo Sotelo", "Sergio Carreira", "Miguel Román", "Marcos Alonso", "Joseph Aidoo", "Carl Starfelt", "Javi Rodríguez", "Mihailo Ristić", "Alvaro Núñez", "Javier Rueda", "Carlos Domínguez", "Yoel Lago", "Manu Fernández", "Ionuț Radu", "Iván Villar", "Marc Vidal"],
    "Elche": ["Álvaro Rodriguez", "André Silva", "Rafa Mir", "Adam Boayar", "Tete Morente", "Lucas Cepeda", "Federico Redondo", "Grady Diangana", "Aleix Febas", "Gonzalo Villar", "Germán Valera", "Martim Neto", "Marc Aguado", "Yago Santiago", "Josan", "Hector Fort", "David Affengruber", "Buba Sangare", "Adrià Pedrosa", "Víctor Chust", "Pedro Bigas", "Léo Pétrot", "John Donald", "Iñaki Peña", "Matías Dituro", "Alejandro Iturbe"],
    "Espanyol": ["Roberto Fernández", "Cyril Ngonge", "Kike García", "Charles Pickel", "Javi Puado", "Edu Expósito", "Pere Milla", "Tyrhys Dolan", "Pol Lozano", "Ramón Terrats", "Urko González", "Jofre Carreras", "Antoniu Roca", "Omar El Hilali", "Carlos Romero", "Leandro Cabrera", "Clemens Riedel", "Fernando Calero", "Jose Salinas", "Miguel Rubio", "Rubén Sánchez", "Marko Dmitrović", "Angel Fortuno"],
    "Getafe": ["Martín Satriano", "Borja Mayoral", "Luis Vázquez", "Veljko Birmančević", "Adrian Liso", "Juanmi", "Mario Martín", "Luis Milla", "Mauro Arambarri", "Abu Kamara", "Javier Muñoz", "Álex Sancris", "Hugo Solozábal", "Adrián Riquelme", "Abdelkabir Abqar", "Djené", "Ismael Bekhoucha", "Sebastián Boselli", "Zaid Romero", "Diego Rico", "Allan Nyom", "Domingos Duarte", "Juan Iglesias", "Kiko Femenía", "Davinchi", "Jorge Montes", "David Soria", "Jiří Letáček"],
    "Girona": ["Vladyslav Vanat", "Cristhian Stuani", "Abel Ruíz", "Portu", "Claudio Echeverri", "Azzedine Ounahi", "Axel Witsel", "Donny van de Beek", "Thomas Lemar", "Viktor Tsygankov", "Bryan Gil", "Iván Martín", "Fran Beltrán", "Lass Kourouma", "Joel Roca", "Vitor Reis", "Daley Blind", "Arnau Martínez", "Álex Moreno", "Alejandro Francés", "David López", "Hugo Rincón", "Marc-André Ter Stegen", "Paulo Gazzaniga", "Vladyslav Krapyvtsov", "Rubén Blanco", "Juan Carlos"],
    "Levante": ["Etta Eyong", "José Luis Morales", "Iván Romero", "Carlos Espí", "Kareem Tunde", "Paco Cortés", "Carlos Álvarez", "Kervin Arriaga", "Tai Abed", "Oriol Rey", "Iker Losada", "Ugo Raghouber", "Jon Ander Olasagasti", "Pablo Martínez", "Unai Vencedor", "Roger Brugué", "Víctor García", "Alan Matturro", "Matias Moreno", "Manuel Sánchez", "Adrián de la Fuente", "Jeremy Toljan", "Unai Elgezabal", "Diego Pampín", "Mathew Ryan", "Pablo Cuñat"],
    "Mallorca": ["Vedat Muriqi", "Zito Luvumbo", "Mateo Joseph", "Abdón Prats", "Pablo Torre", "Jan Virgili", "Takuma Asano", "Samú Costa", "Sergi Darder", "Omar Mascarell", "Manu Morlanes", "Antonio Sánchez", "Justin-Noel Kalumba", "Javi Llabrés", "Jan Salas", "Johan Mojica", "Pablo Maffeo", "Marash Kumbulla", "Antonio Raíllo", "Martin Valjent", "Mateu Morey", "Toni Lato", "David López", "Lucas Bergström", "Leo Román", "Iván Cuéllar"],
    "Osasuna": ["Victor Muñoz", "Ante Budimir", "Raúl García de Haro", "Iker Benito", "Kike Barja", "Raúl Moro", "Aimar Oroz", "Rubén García", "Jon Moncayola", "Lucas Torró", "Moi Gómez", "Iker Muñoz", "Asier Osambela", "Flavien Boyomo", "Javi Galán", "Alejandro Catena", "Valentin Rosier", "Abel Bretones", "Jorge Herrando", "Juan Cruz", "Iñigo Arguibide", "Sergio Herrera", "Aitor Fernández"],
    "Rayo Vallecano": ["Jorge de Frutos", "Alemão", "Carlos Martín", "Sergio Camello", "Randy Nteka", "Ilias Akhomach", "Pathé Ismaël Ciss", "Isi Palazón", "Álvaro García", "Pedro Díaz", "Óscar Trejo", "Unai López", "Fran Pérez", "Óscar Valentín", "Gerard Gumbau", "Diego Mendez", "Samu Becerra", "Andrei Rațiu", "Nobel Mendy", "Abdul Mumin", "Florian Lejeune", "Luiz Felipe", "Iván Balliu", "Alfonso Espino", "Josep Chavarría", "Jozhua Vertrouwd", "Augusto Batalla", "Dani Cárdenas", "Adrián Molina"],
    "Real Madrid": ["Kylian Mbappé", "Vinicius Júnior", "Rodrygo", "Franco Mastantuono", "Gonzalo García", "Jude Bellingham", "Arda Güler", "Federico Valverde", "Brahim Díaz", "Eduardo Camavinga", "Aurélien Tchouaméni", "Dani Ceballos", "Jorge Cestero", "César Palacios", "Manuel Ángel Morán", "Trent Alexander-Arnold", "Antonio Rüdiger", "Dean Huijsen", "Daniel Carvajal", "Éder Militão", "Raúl Asencio", "David Alaba", "Álvaro Carreras", "Ferland Mendy", "Fran García", "Diego Aguado", "Lamini Fati", "Thibaut Courtois", "Andriy Lunin", "Fran González", "Sergio Mestre"],
    "Real Oviedo": ["Federico Viñas", "Thiago Borbas", "Álex Forés", "Santi Cazorla", "Haissem Hassan", "Kwasi Sibo", "Ilyas Chaira", "Leander Dendoncker", "Thiago Fernández", "Luka Ilić", "Santiago Colombatto", "Nicolas Fonseca", "Ovie Ejaria", "Alberto Reina", "Pablo Agudín", "Eric Bailly", "Abdel Rahim", "David Carmo", "Javi López", "Nacho Vidal", "David Costas", "Dani Calvo", "Lucas Ahijado", "Diego Espinosa", "Horațiu Moldovan", "Aarón Escandell"],
    "Real Sociedad": ["Mikel Oyarzabal", "Orri Steinn Óskarsson", "Ander Barrenetxea", "Jon Karrikaburu", "Takefusa Kubo", "Wesley", "Luka Sučić", "Arsen Zakharyan", "Sergio Gómez", "Yangel Herrera", "Carlos Soler", "Gonçalo Guedes", "Brais Méndez", "Beñat Turrientes", "Jon Gorrotxategi", "Pablo Marín", "Jon Aramburu", "Duje Ćaleta-Car", "Álvaro Odriozola", "Jon Martin", "Igor Zubeldia", "Aihen Muñoz", "Aritz Elustondo", "Álex Remiro", "Unai Marrero"],
    "Sevilla": ["Alexis Sánchez", "Akor Adams", "Chidera Ejuke", "Neal Maupay", "Isaac Romero", "Gabriel Suazo", "Ruben Vargas", "Lucien Agoumé", "Djibril Sow", "Nemanja Gudelj", "Adnan Januzaj", "Batista Mendy", "Juanlu Sánchez", "Peque Fernández", "Joan Jordán", "Manu Bueno", "Oso", "Miguel Sierra", "César Azpilicueta", "Tanguy Nianzou", "Marcão", "José Ángel Carmona", "Kike Salas", "Federico Gattoni", "Fábio Cardoso", "Andres Castrin", "Odysseas Vlachodimos", "Ørjan Nyland"],
    "Valencia": ["Lucas Beltrán", "Arnaut Danjuma", "Umar Sadiq", "Hugo Duro", "Largie Ramazani", "Dani Raba", "Guido Rodríguez", "Javier Guerra", "Pepelu", "Diego López", "André Almeida", "Luis Rioja", "Filip Ugrinić", "Baptiste Santamaria", "Mouctar Diakhaby", "José Luis Gayà", "Renzo Saravia", "César Tárrega", "Thierry Correia", "Unai Núñez", "Eray Cömert", "Dimitri Foulquier", "José Copete", "Jesús Vázquez", "Julen Agirrezabala", "Stole Dimitrievski", "Cristian Rivero"],
    "Villarreal": ["Georges Mikautadze", "Nicolas Pépé", "Gerard Moreno", "Ayoze Pérez", "Tani Oluwaseyi", "Alfon González", "Pau Cabanes", "Thomas Partey", "Pape Gueye", "Tajon Buchanan", "Alberto Moleiro", "Dani Parejo", "Santi Comesaña", "Carlos Maciá", "Hugo Lopez", "Renato Veiga", "Juan Foyth", "Santiago Mouriño", "Rafa Marín", "Willy Kambwala", "Sergi Cardona", "Alexander Freeman", "Logan Costa", "Alfonso Pedraza", "Pau Navarro", "Arnau Tenas", "Luiz Júnior", "Diego Conde"],
}

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

def generar_calendario(lista_equipos):
    equipos_local = lista_equipos[:]
    if len(equipos_local) % 2 != 0:
        equipos_local.append("DESCANSA")
    num_equipos = len(equipos_local)
    num_jornadas = num_equipos - 1
    mitad = num_equipos // 2
    jornadas_ida = []
    equipos_rotacion = equipos_local[:]
    for _ in range(num_jornadas):
        partidos = []
        for i in range(mitad):
            local = equipos_rotacion[i]
            visitante = equipos_rotacion[num_equipos - 1 - i]
            if local != "DESCANSA" and visitante != "DESCANSA":
                partidos.append((local, visitante))
        jornadas_ida.append(partidos)
        fijo = [equipos_rotacion[0]]
        rotan = equipos_rotacion[1:]
        rotan = [rotan[-1]] + rotan[:-1]
        equipos_rotacion = fijo + rotan
    jornadas_vuelta = []
    for jornada in jornadas_ida:
        vuelta = []
        for local, visitante in jornada:
            vuelta.append((visitante, local))
        jornadas_vuelta.append(vuelta)
    return jornadas_ida + jornadas_vuelta

calendario = generar_calendario(equipos)

def elegir_jugador(equipo):
    return random.choice(jugadores_por_equipo[equipo])

def partido_ya_jugado(local, visitante):
    return Partido.query.filter_by(local=local, visitante=visitante).first() is not None

def simular_resultado_con_eventos(local, visitante):
    goles_local = random.randint(0, 4)
    goles_visitante = random.randint(0, 4)
    eventos = []
    for _ in range(goles_local):
        tipo = random.choices(["gol", "gol_penalti", "gol_propia"], weights=[80, 15, 5], k=1)[0]
        if tipo == "gol": eventos.append({"tipo": "gol", "equipo": local, "jugador": elegir_jugador(local)})
        elif tipo == "gol_penalti": eventos.append({"tipo": "gol_penalti", "equipo": local, "jugador": elegir_jugador(local)})
        else: eventos.append({"tipo": "gol_propia", "equipo": local, "jugador": elegir_jugador(visitante)})
    for _ in range(goles_visitante):
        tipo = random.choices(["gol", "gol_penalti", "gol_propia"], weights=[80, 15, 5], k=1)[0]
        if tipo == "gol": eventos.append({"tipo": "gol", "equipo": visitante, "jugador": elegir_jugador(visitante)})
        elif tipo == "gol_penalti": eventos.append({"tipo": "gol_penalti", "equipo": visitante, "jugador": elegir_jugador(visitante)})
        else: eventos.append({"tipo": "gol_propia", "equipo": visitante, "jugador": elegir_jugador(local)})
    if random.random() < 0.20: eventos.append({"tipo": "penalti_fallado", "equipo": local, "jugador": elegir_jugador(local)})
    if random.random() < 0.20: eventos.append({"tipo": "penalti_fallado", "equipo": visitante, "jugador": elegir_jugador(visitante)})
    for _ in range(random.randint(0, 3)): eventos.append({"tipo": "amarilla", "equipo": local, "jugador": elegir_jugador(local)})
    for _ in range(random.randint(0, 3)): eventos.append({"tipo": "amarilla", "equipo": visitante, "jugador": elegir_jugador(visitante)})
    if random.random() < 0.12: eventos.append({"tipo": "roja", "equipo": local, "jugador": elegir_jugador(local)})
    if random.random() < 0.12: eventos.append({"tipo": "roja", "equipo": visitante, "jugador": elegir_jugador(visitante)})
    return goles_local, goles_visitante, eventos

def calcular_mvp(eventos, local, visitante):
    contador = {}
    for ev in eventos:
        jugador = ev["jugador"]
        if jugador not in contador: contador[jugador] = 0
        if ev["tipo"] == "gol": contador[jugador] += 5
        elif ev["tipo"] == "gol_penalti": contador[jugador] += 4
        elif ev["tipo"] == "gol_propia": contador[jugador] -= 3
        elif ev["tipo"] == "penalti_fallado": contador[jugador] -= 2
        elif ev["tipo"] == "amarilla": contador[jugador] -= 1
        elif ev["tipo"] == "roja": contador[jugador] -= 3
    if contador: return max(contador, key=contador.get)
    return random.choice(jugadores_por_equipo[local] + jugadores_por_equipo[visitante])

def simular_y_guardar_partido(jornada_num, local, visitante):
    if partido_ya_jugado(local, visitante): return
    goles_local, goles_visitante, eventos = simular_resultado_con_eventos(local, visitante)
    mvp = calcular_mvp(eventos, local, visitante)
    partido = Partido(jornada=jornada_num, local=local, visitante=visitante, goles_local=goles_local, goles_visitante=goles_visitante, mvp=mvp)
    db.session.add(partido)
    db.session.commit()
    for ev in eventos:
        evento = Evento(partido_id=partido.id, tipo=ev["tipo"], equipo=ev["equipo"], jugador=ev["jugador"])
        db.session.add(evento)
    db.session.commit()

def obtener_resultados():
    partidos = Partido.query.order_by(Partido.jornada, Partido.id).all()
    resultados = []
    for partido in partidos:
        eventos_db = Evento.query.filter_by(partido_id=partido.id).all()
        eventos = [{"tipo": ev.tipo, "equipo": ev.equipo, "jugador": ev.jugador} for ev in eventos_db]
        resultados.append({"id": partido.id, "jornada": partido.jornada, "local": partido.local, "visitante": partido.visitante, "goles_local": partido.goles_local, "goles_visitante": partido.goles_visitante, "mvp": partido.mvp, "eventos": eventos})
    return resultados

# --- RUTAS ---

@app.route("/")
def inicio(): return render_template("index.html")

@app.route("/calendario")
def ver_calendario():
    resultados = obtener_resultados()
    return render_template("calendario.html", jornadas=calendario, resultados=resultados, humanos=equipos_humanos)

@app.route("/guardar_partido_manual", methods=["POST"])
def guardar_partido_manual():
    data = request.json
    if partido_ya_jugado(data['local'], data['visitante']):
        return jsonify({"status": "error", "msg": "Ya existe"})
    
    nuevo_p = Partido(jornada=data['jornada'], local=data['local'], visitante=data['visitante'], 
                      goles_local=data['goles_l'], goles_visitante=data['goles_v'], mvp=data['mvp'])
    db.session.add(nuevo_p)
    db.session.commit()
    
    for e in data['eventos']:
        nuevo_e = Evento(partido_id=nuevo_p.id, tipo=e['tipo'], equipo=e['equipo'], jugador=e['jugador'])
        db.session.add(nuevo_e)
    db.session.commit()
    return jsonify({"status": "ok"})

@app.route("/clasificacion")
def ver_clasificacion():
    # Lógica de clasificación simplificada para el ejemplo
    return render_template("clasificacion.html")

@app.route("/reiniciar")
def reiniciar():
    Evento.query.delete()
    Partido.query.delete()
    db.session.commit()
    return redirect(url_for("ver_calendario"))

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)
