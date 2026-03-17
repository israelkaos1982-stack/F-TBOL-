from flask import Flask, render_template, redirect, url_for, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import random
import os
from collections import defaultdict

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



# ---------------- SEGUNDA DIVISIÓN ----------------

equipos_segunda = [{'nombre': 'Real Racing Club', 'media': 74, 'color': 'Verde'},
 {'nombre': 'Deportivo La Coruña', 'media': 72, 'color': 'Azul'},
 {'nombre': 'Almería', 'media': 72, 'color': 'Rojo'},
 {'nombre': 'Málaga', 'media': 72, 'color': 'Celeste'},
 {'nombre': 'CD Castellón', 'media': 71, 'color': 'Negro'},
 {'nombre': 'Las Palmas', 'media': 71, 'color': 'Amarillo'},
 {'nombre': 'Burgos Club de Fútbol', 'media': 70, 'color': 'Blanco'},
 {'nombre': 'Sporting Gijón', 'media': 70, 'color': 'Rojiblanco'},
 {'nombre': 'AD Ceuta', 'media': 69, 'color': 'Blanco'},
 {'nombre': 'Eibar', 'media': 69, 'color': 'Azulgrana'},
 {'nombre': 'Córdoba', 'media': 68, 'color': 'Verdiblanco'},
 {'nombre': 'Real Sociedad B U21', 'media': 68, 'color': 'Txuri-urdin'},
 {'nombre': 'FC Andorra', 'media': 68, 'color': 'Tricolor'},
 {'nombre': 'Cádiz', 'media': 67, 'color': 'Amarillo'},
 {'nombre': 'Granada', 'media': 67, 'color': 'Rojiblanco'},
 {'nombre': 'Albacete Balompié', 'media': 67, 'color': 'Blanco'},
 {'nombre': 'Real Valladolid', 'media': 67, 'color': 'Violeta'},
 {'nombre': 'Leganés', 'media': 66, 'color': 'Pepineros'},
 {'nombre': 'Huesca', 'media': 66, 'color': 'Azulgrana'},
 {'nombre': 'Real Zaragoza', 'media': 65, 'color': 'Blanquillo'},
 {'nombre': 'Cultural Leonesa', 'media': 64, 'color': 'Blanco'},
 {'nombre': 'Mirandés', 'media': 64, 'color': 'Rojillo'}]

jugadores_por_equipo_segunda = {'Real Racing Club': {'porteros': [{'nombre': 'Ezkieta', 'media': 72},
                                   {'nombre': 'Parera', 'media': 68},
                                   {'nombre': 'Atanes', 'media': 58}],
                      'defensas': [{'nombre': 'J. Castro', 'media': 70},
                                   {'nombre': 'Manu Hernando', 'media': 70},
                                   {'nombre': 'Mantilla', 'media': 68},
                                   {'nombre': 'P. Ramón', 'media': 66},
                                   {'nombre': 'Mario García', 'media': 66},
                                   {'nombre': 'J. Salinas', 'media': 63},
                                   {'nombre': 'Carrascal', 'media': 62}],
                      'medios': [{'nombre': 'Grenier', 'media': 71},
                                 {'nombre': 'Aldasoro', 'media': 70},
                                 {'nombre': 'Lago Junior', 'media': 69},
                                 {'nombre': 'P. Canales', 'media': 68},
                                 {'nombre': 'Íñigo Sainz-Maza', 'media': 67},
                                 {'nombre': 'Sangalli', 'media': 67},
                                 {'nombre': 'Yeray', 'media': 66}],
                      'delanteros': [{'nombre': 'Andrés Martín', 'media': 75},
                                     {'nombre': 'I. Vicente', 'media': 75},
                                     {'nombre': 'Villalibre', 'media': 73},
                                     {'nombre': 'Arana', 'media': 70},
                                     {'nombre': 'Ekain', 'media': 66},
                                     {'nombre': 'Suleiman', 'media': 65},
                                     {'nombre': 'Jeremy', 'media': 62}]},
 'Deportivo La Coruña': {'porteros': [{'nombre': 'Á. Ferrón', 'media': 72},
                                      {'nombre': 'Germán Parreño', 'media': 69},
                                      {'nombre': 'Eric Puerto', 'media': 64}],
                         'defensas': [{'nombre': 'Alti', 'media': 72},
                                      {'nombre': 'Loureiro', 'media': 72},
                                      {'nombre': 'P. Vázquez', 'media': 70},
                                      {'nombre': 'Ximo Navarro', 'media': 69},
                                      {'nombre': 'Jaime Sánchez', 'media': 68},
                                      {'nombre': 'L. Noubi', 'media': 67},
                                      {'nombre': 'Barcia', 'media': 65},
                                      {'nombre': 'Iano Simão', 'media': 64}],
                         'medios': [{'nombre': 'M. Soriano', 'media': 73},
                                    {'nombre': 'Villares', 'media': 72},
                                    {'nombre': 'J. Gragera', 'media': 70},
                                    {'nombre': 'José Ángel', 'media': 69},
                                    {'nombre': 'Hugo Rama', 'media': 68},
                                    {'nombre': 'Rubén López', 'media': 63},
                                    {'nombre': 'Mario Nájera', 'media': 62}],
                         'delanteros': [{'nombre': 'Lucas Pérez', 'media': 77},
                                        {'nombre': 'Yeremay', 'media': 76},
                                        {'nombre': 'L. Chacón', 'media': 72},
                                        {'nombre': 'Stoichkov', 'media': 71},
                                        {'nombre': 'Mella', 'media': 71},
                                        {'nombre': 'Z. Eddahchouri', 'media': 70},
                                        {'nombre': 'Barbero', 'media': 68},
                                        {'nombre': 'Davo', 'media': 67},
                                        {'nombre': 'Alcaina', 'media': 65},
                                        {'nombre': 'Valcarce', 'media': 64}]},
 'Real Valladolid': {'porteros': [{'nombre': 'André Ferreira', 'media': 71},
                                  {'nombre': 'G. Fernandes', 'media': 69},
                                  {'nombre': 'Arnau Rafús', 'media': 62}],
                     'defensas': [{'nombre': 'Boyomo', 'media': 72},
                                  {'nombre': 'Luis Pérez', 'media': 72},
                                  {'nombre': 'P. Tormo', 'media': 71},
                                  {'nombre': 'Javi Sánchez', 'media': 71},
                                  {'nombre': 'L. Alejo', 'media': 70},
                                  {'nombre': 'Lucas Rosa', 'media': 69},
                                  {'nombre': 'G. Bueno', 'media': 68},
                                  {'nombre': 'David Torres', 'media': 68},
                                  {'nombre': 'D. Torres', 'media': 67}],
                     'medios': [{'nombre': 'Selim Amallah', 'media': 73},
                                {'nombre': 'Kike Pérez', 'media': 71},
                                {'nombre': 'S. Jurić', 'media': 70},
                                {'nombre': 'Anuar', 'media': 69},
                                {'nombre': 'Meseguer', 'media': 69},
                                {'nombre': 'De la Hoz', 'media': 68},
                                {'nombre': 'Tuto', 'media': 64},
                                {'nombre': 'Chuki', 'media': 64}],
                     'delanteros': [{'nombre': 'Amath Ndiaye', 'media': 72},
                                    {'nombre': 'Peter', 'media': 71},
                                    {'nombre': 'Machis', 'media': 71},
                                    {'nombre': 'Mamadou Sylla', 'media': 70},
                                    {'nombre': 'Kenedy', 'media': 70},
                                    {'nombre': 'M. André', 'media': 69},
                                    {'nombre': 'Moro', 'media': 68},
                                    {'nombre': 'Latasa', 'media': 68},
                                    {'nombre': 'S. Biuk', 'media': 67},
                                    {'nombre': 'Iván Cédric', 'media': 65}]},
 'Granada': {'porteros': [{'nombre': 'L. Zidane', 'media': 69}, {'nombre': 'Marc Martínez', 'media': 66}],
             'defensas': [{'nombre': 'Ricard Sánchez', 'media': 72},
                          {'nombre': 'Ignasi Miquel', 'media': 71},
                          {'nombre': 'Carlos Neva', 'media': 71},
                          {'nombre': 'L. Williams', 'media': 69},
                          {'nombre': 'M. Lama', 'media': 68},
                          {'nombre': 'R. Sánchez', 'media': 68},
                          {'nombre': 'O. Naasei', 'media': 65},
                          {'nombre': 'Brau', 'media': 63},
                          {'nombre': 'P. Haro', 'media': 59}],
             'medios': [{'nombre': 'Sergio Ruiz', 'media': 73},
                        {'nombre': 'Gonzalo Villar', 'media': 73},
                        {'nombre': 'Martin Hongla', 'media': 72},
                        {'nombre': 'Reinier', 'media': 72},
                        {'nombre': 'Perea', 'media': 66},
                        {'nombre': 'Mario', 'media': 62}],
             'delanteros': [{'nombre': 'Lucas Boyé', 'media': 75},
                            {'nombre': 'Myrto Uzuni', 'media': 75},
                            {'nombre': 'Á. Sola', 'media': 72},
                            {'nombre': 'J. Pascual', 'media': 70},
                            {'nombre': 'J. Arnáiz', 'media': 70},
                            {'nombre': 'Kamil Jóźwiak', 'media': 70},
                            {'nombre': 'Shon Weissman', 'media': 69},
                            {'nombre': 'Corbeanu', 'media': 68},
                            {'nombre': 'Famara Diedhiou', 'media': 67},
                            {'nombre': 'Oppong', 'media': 60}]},
 'Huesca': {'porteros': [{'nombre': 'D. Jiménez', 'media': 73}, {'nombre': 'Juan Pérez', 'media': 65}],
            'defensas': [{'nombre': 'Jorge Pulido', 'media': 70},
                         {'nombre': 'Loureiro', 'media': 69},
                         {'nombre': 'Blasco', 'media': 67},
                         {'nombre': 'Vilarrasa', 'media': 67},
                         {'nombre': 'Toni Abad', 'media': 66},
                         {'nombre': 'Á. Carrillo', 'media': 66},
                         {'nombre': 'R. Abajas', 'media': 64}],
            'medios': [{'nombre': 'Óscar Sielva', 'media': 70},
                       {'nombre': 'Gerard Valentín', 'media': 68},
                       {'nombre': 'Kento Hashimoto', 'media': 68},
                       {'nombre': 'Portillo', 'media': 67},
                       {'nombre': 'Javi Mier', 'media': 66},
                       {'nombre': 'Javi Álvarez', 'media': 66},
                       {'nombre': 'Kortajarena', 'media': 65},
                       {'nombre': 'Rico', 'media': 65}],
            'delanteros': [{'nombre': 'Dani Ojeda', 'media': 68},
                           {'nombre': 'Sergi Enrich', 'media': 68},
                           {'nombre': 'Joaquín Muñoz', 'media': 67},
                           {'nombre': 'Samuele Longo', 'media': 67},
                           {'nombre': 'Samuel Obeng', 'media': 67},
                           {'nombre': 'Soko', 'media': 66},
                           {'nombre': 'Bolívar', 'media': 64},
                           {'nombre': 'Ayman', 'media': 62}]},
 'Cultural Leonesa': {'porteros': [{'nombre': 'Edgar Badía', 'media': 73}, {'nombre': 'Miguel Bañuz', 'media': 65}],
                      'defensas': [{'nombre': 'Barzić', 'media': 67},
                                   {'nombre': 'Rodri Suárez', 'media': 67},
                                   {'nombre': 'Hinojo', 'media': 67},
                                   {'nombre': 'Quique Fornos', 'media': 66},
                                   {'nombre': 'Aleix Coch', 'media': 65},
                                   {'nombre': 'Muguruza', 'media': 65},
                                   {'nombre': 'Víctor García', 'media': 64},
                                   {'nombre': 'Castañeda', 'media': 64}],
                      'medios': [{'nombre': 'Manu Justo', 'media': 70},
                                 {'nombre': 'T. Ojeda', 'media': 67},
                                 {'nombre': 'Bicho', 'media': 66},
                                 {'nombre': 'Barri', 'media': 65},
                                 {'nombre': 'Solar', 'media': 64},
                                 {'nombre': 'Samanes', 'media': 65},
                                 {'nombre': 'S. Maestre', 'media': 62}],
                      'delanteros': [{'nombre': 'Rubén Sobrino', 'media': 69},
                                     {'nombre': 'Tresa', 'media': 67},
                                     {'nombre': 'Escudero', 'media': 66},
                                     {'nombre': 'Artola', 'media': 64},
                                     {'nombre': 'Dorian', 'media': 64},
                                     {'nombre': 'Calderón', 'media': 63}]},
 'Albacete Balompié': {'porteros': [{'nombre': 'R. Lizoain', 'media': 69},
                                    {'nombre': 'D. Mariño', 'media': 67},
                                    {'nombre': 'M. Ramos', 'media': 58}],
                       'defensas': [{'nombre': 'C. Neva', 'media': 71},
                                    {'nombre': 'Vallejo', 'media': 72},
                                    {'nombre': 'P. Sánchez', 'media': 68},
                                    {'nombre': 'F. Gámez', 'media': 69},
                                    {'nombre': 'J. López', 'media': 68},
                                    {'nombre': 'I. Moreno', 'media': 64},
                                    {'nombre': 'J. Germán Gó...', 'media': 64},
                                    {'nombre': 'D. Bernabéu', 'media': 60}],
                       'medios': [{'nombre': 'A. Medina', 'media': 71},
                                  {'nombre': 'Meléndez', 'media': 65},
                                  {'nombre': 'Pacheco', 'media': 64},
                                  {'nombre': 'M. Fernández', 'media': 69},
                                  {'nombre': 'F. Cedeño', 'media': 66},
                                  {'nombre': 'I. Villar', 'media': 65},
                                  {'nombre': 'V. Valverde', 'media': 64},
                                  {'nombre': 'Capi', 'media': 60}],
                       'delanteros': [{'nombre': 'Jefté', 'media': 70},
                                      {'nombre': 'Puertas', 'media': 72},
                                      {'nombre': 'Lazo', 'media': 68},
                                      {'nombre': 'Higinio', 'media': 68},
                                      {'nombre': 'S. Obeng', 'media': 67},
                                      {'nombre': 'Jota', 'media': 59},
                                      {'nombre': 'Lorenzo', 'media': 64},
                                      {'nombre': 'Morientes', 'media': 58}]},
 'AD Ceuta': {'porteros': [{'nombre': 'G. Vallejo', 'media': 67},
                           {'nombre': 'P. López', 'media': 65},
                           {'nombre': 'Y. Cantero', 'media': 64}],
              'defensas': [{'nombre': 'J. Matos', 'media': 68},
                           {'nombre': 'D. González', 'media': 67},
                           {'nombre': 'Hernández', 'media': 66},
                           {'nombre': 'Anuar', 'media': 69},
                           {'nombre': 'M. Sánchez', 'media': 63},
                           {'nombre': 'Almenara', 'media': 64},
                           {'nombre': 'Redru', 'media': 65},
                           {'nombre': 'A. Caparrós', 'media': 62}],
              'medios': [{'nombre': 'Y. Lachhab', 'media': 66},
                         {'nombre': 'K. Zalazar', 'media': 65},
                         {'nombre': 'R. Díez', 'media': 65},
                         {'nombre': 'Campaña', 'media': 72},
                         {'nombre': 'S. Sánchez', 'media': 68},
                         {'nombre': 'Cristian', 'media': 66},
                         {'nombre': 'A. Bassinga', 'media': 63},
                         {'nombre': 'M. Illescas', 'media': 67},
                         {'nombre': 'Y. Bodiger', 'media': 67},
                         {'nombre': 'Josema', 'media': 60},
                         {'nombre': 'M. Domènech', 'media': 64}],
              'delanteros': [{'nombre': 'M. Fernández', 'media': 67},
                             {'nombre': 'K. Abdoul Koné', 'media': 66},
                             {'nombre': 'Aisar', 'media': 67},
                             {'nombre': 'K. de la Fuente', 'media': 66}]},
 'CD Castellón': {'porteros': [{'nombre': 'R. Matthys', 'media': 65},
                               {'nombre': 'A. Abedzadeh', 'media': 68},
                               {'nombre': 'S. Torner', 'media': 57}],
                  'defensas': [{'nombre': 'F. Brignani', 'media': 69},
                               {'nombre': 'A. Jiménez', 'media': 67},
                               {'nombre': 'S. Ruiz', 'media': 64},
                               {'nombre': 'J. Mellot', 'media': 69},
                               {'nombre': 'A. Sierra', 'media': 63},
                               {'nombre': 'M. Willmann', 'media': 65},
                               {'nombre': 'C. Wehbe', 'media': 63},
                               {'nombre': 'Tincho', 'media': 60}],
                  'medios': [{'nombre': 'Á. Calatrava', 'media': 71},
                             {'nombre': 'D. Barri', 'media': 65},
                             {'nombre': 'B. Cipenga', 'media': 67},
                             {'nombre': 'A. Mabil', 'media': 67},
                             {'nombre': 'R. Sánchez', 'media': 70},
                             {'nombre': 'Gerenabarrena', 'media': 65},
                             {'nombre': 'I. Alcázar', 'media': 64},
                             {'nombre': 'M. Doué', 'media': 64},
                             {'nombre': 'T. De Nipoti', 'media': 59}],
                  'delanteros': [{'nombre': 'A. Jakobsen', 'media': 67},
                                 {'nombre': 'O. Camara', 'media': 65},
                                 {'nombre': 'J. Suero', 'media': 69},
                                 {'nombre': 'Á. García', 'media': 63},
                                 {'nombre': 'D. Aurélio', 'media': 67},
                                 {'nombre': 'P. Santiago', 'media': 61}]},
 'Cádiz': {'porteros': [{'nombre': 'V. Aznar', 'media': 68}, {'nombre': 'D. Gil', 'media': 70}, {'nombre': 'F. Pérez', 'media': 63}],
           'defensas': [{'nombre': 'I. Recio', 'media': 67},
                        {'nombre': 'B. Kovačević', 'media': 68},
                        {'nombre': 'Climent', 'media': 68},
                        {'nombre': 'I. Carcelén', 'media': 70},
                        {'nombre': 'J. Moreno', 'media': 67},
                        {'nombre': 'Pelayo', 'media': 65},
                        {'nombre': 'A. Caicedo', 'media': 61},
                        {'nombre': 'R. Pereira', 'media': 62},
                        {'nombre': 'J. Díaz', 'media': 59}],
           'medios': [{'nombre': 'M. Diakité', 'media': 67},
                      {'nombre': 'S. Ortuño', 'media': 69},
                      {'nombre': 'Ontiveros', 'media': 72},
                      {'nombre': 'Suso', 'media': 75},
                      {'nombre': 'A. Fernández', 'media': 70},
                      {'nombre': 'B. Ocampo', 'media': 70},
                      {'nombre': 'Y. Diarra', 'media': 68},
                      {'nombre': 'J. González', 'media': 64},
                      {'nombre': 'S. Arribas', 'media': 65},
                      {'nombre': 'A. Cordero', 'media': 69}],
           'delanteros': [{'nombre': 'Á. Miguel Gar...', 'media': 66},
                          {'nombre': 'R. Martí', 'media': 68},
                          {'nombre': 'J. Domina', 'media': 68},
                          {'nombre': 'D. Camara', 'media': 66},
                          {'nombre': 'D. la Rosa', 'media': 66}]},
 'Real Sociedad B U21': {'porteros': [{'nombre': 'Fraga', 'media': 64}, {'nombre': 'Arana', 'media': 63}],
                         'defensas': [{'nombre': 'L. Beitia', 'media': 65},
                                      {'nombre': 'K. Kita', 'media': 63},
                                      {'nombre': 'J. Balda', 'media': 63},
                                      {'nombre': 'Dadie', 'media': 64},
                                      {'nombre': 'Astigarraga', 'media': 60},
                                      {'nombre': 'Rupérez', 'media': 64},
                                      {'nombre': 'J. Garro', 'media': 60},
                                      {'nombre': 'I. Calderon', 'media': 60},
                                      {'nombre': 'U. Ayo', 'media': 60}],
                         'medios': [{'nombre': 'M. Rodríguez', 'media': 65},
                                    {'nombre': 'T. Carbonell', 'media': 63},
                                    {'nombre': 'A. Lebarbier', 'media': 61},
                                    {'nombre': 'D. Díaz', 'media': 64},
                                    {'nombre': 'Mariezkurrena', 'media': 65},
                                    {'nombre': 'I. Aguirre', 'media': 61},
                                    {'nombre': 'J. Ezeizabarre...', 'media': 60},
                                    {'nombre': 'J. Oleaga', 'media': 60}],
                         'delanteros': [{'nombre': 'G. Carrera', 'media': 63},
                                        {'nombre': 'Orobengoa', 'media': 63},
                                        {'nombre': 'Astiazarán', 'media': 63},
                                        {'nombre': 'J. Balda', 'media': 63},
                                        {'nombre': 'J. Nuñez', 'media': 63},
                                        {'nombre': 'A. Marchal', 'media': 62},
                                        {'nombre': 'I. Gorosabel', 'media': 62},
                                        {'nombre': 'D. Ramírez', 'media': 61},
                                        {'nombre': 'U. Agote', 'media': 60},
                                        {'nombre': 'A. Adjabeng', 'media': 60}]},
 'Eibar': {'porteros': [{'nombre': 'J. López', 'media': 63}, {'nombre': 'U. Ayala', 'media': 56}],
           'defensas': [{'nombre': 'Arbilla', 'media': 69},
                        {'nombre': 'J. Berrocal', 'media': 70},
                        {'nombre': 'H. Vidales', 'media': 65},
                        {'nombre': 'C. Isaac', 'media': 69},
                        {'nombre': 'I. Amador', 'media': 67},
                        {'nombre': 'J. Martínez', 'media': 69},
                        {'nombre': 'Arambarri', 'media': 68},
                        {'nombre': 'E. Redondo', 'media': 59},
                        {'nombre': 'O. Llorente', 'media': 58}],
           'medios': [{'nombre': 'Nolaskoain', 'media': 71},
                      {'nombre': 'A. Garrido', 'media': 68},
                      {'nombre': 'Magunazelaia', 'media': 67},
                      {'nombre': 'Alkain', 'media': 68},
                      {'nombre': 'Corpas', 'media': 70},
                      {'nombre': 'S. Álvarez', 'media': 70},
                      {'nombre': 'Guruzeta', 'media': 68},
                      {'nombre': 'Matheus', 'media': 68},
                      {'nombre': 'I. Martínez', 'media': 67},
                      {'nombre': 'Madari', 'media': 67},
                      {'nombre': 'T. Villa', 'media': 67},
                      {'nombre': 'A. Ares', 'media': 66},
                      {'nombre': 'M. Delgado', 'media': 60},
                      {'nombre': 'Sarasketa', 'media': 57},
                      {'nombre': 'H. García', 'media': 59}],
           'delanteros': [{'nombre': 'J. Bautista', 'media': 69}, {'nombre': 'A. Rodríguez', 'media': 66}]},
 'Leganés': {'porteros': [{'nombre': 'J. Soriano', 'media': 73},
                          {'nombre': 'S. Román', 'media': 68},
                          {'nombre': 'J. Garrido', 'media': 59}],
             'defensas': [{'nombre': 'Jorge Sáenz', 'media': 71},
                          {'nombre': 'L. Aguilar', 'media': 71},
                          {'nombre': 'R. Peña', 'media': 71},
                          {'nombre': 'Franquesa', 'media': 71},
                          {'nombre': 'I. Miquel', 'media': 67},
                          {'nombre': 'R. Pulido', 'media': 67},
                          {'nombre': 'Figueredo', 'media': 65},
                          {'nombre': 'D. Gueye', 'media': 60}],
             'medios': [{'nombre': 'Seydouba Cisse', 'media': 71},
                        {'nombre': 'Melero', 'media': 70},
                        {'nombre': 'R. López', 'media': 68},
                        {'nombre': 'N. García', 'media': 68},
                        {'nombre': 'Guirao', 'media': 65},
                        {'nombre': 'A. Campos', 'media': 64},
                        {'nombre': 'M. Leiva', 'media': 60},
                        {'nombre': 'G. Siame', 'media': 59},
                        {'nombre': 'D. Rodríguez', 'media': 74}],
             'delanteros': [{'nombre': 'A. Millán', 'media': 68},
                            {'nombre': 'D. García', 'media': 67},
                            {'nombre': 'Ó. Plano', 'media': 68},
                            {'nombre': 'L. Alsué', 'media': 67},
                            {'nombre': 'S. Imigene', 'media': 57}]},
 'Las Palmas': {'porteros': [{'nombre': 'D. Horcaś', 'media': 71},
                             {'nombre': 'L. Gil', 'media': 71},
                             {'nombre': 'Caro', 'media': 72},
                             {'nombre': 'Nicolau', 'media': 61}],
                'defensas': [{'nombre': 'M. Mármol', 'media': 73},
                             {'nombre': 'S. Barcia', 'media': 72},
                             {'nombre': 'Marvin', 'media': 72},
                             {'nombre': 'Á. Suárez', 'media': 72},
                             {'nombre': 'Herzog', 'media': 71},
                             {'nombre': 'C. Gutiérrez', 'media': 70},
                             {'nombre': 'V. Pezzolesi', 'media': 64},
                             {'nombre': 'C. Navarro', 'media': 62}],
                'medios': [{'nombre': 'M. Fuster', 'media': 74},
                           {'nombre': 'Manu Fuster', 'media': 73},
                           {'nombre': 'Kirian', 'media': 76},
                           {'nombre': 'T. Miyashiro', 'media': 72},
                           {'nombre': 'L. González', 'media': 68},
                           {'nombre': 'J. Recoba', 'media': 70},
                           {'nombre': 'S. Viera', 'media': 62}],
                'delanteros': [{'nombre': 'J. Viera', 'media': 71},
                               {'nombre': 'Jesé', 'media': 69},
                               {'nombre': 'I. Bravo', 'media': 67},
                               {'nombre': 'Sandro', 'media': 75},
                               {'nombre': 'N. Benedetti', 'media': 73},
                               {'nombre': 'Pejiño', 'media': 69},
                               {'nombre': 'Killane', 'media': 61},
                               {'nombre': 'E. Pedrola', 'media': 69},
                               {'nombre': 'Arturo', 'media': 61}]},
 'Córdoba': {'porteros': [{'nombre': 'C. Marín', 'media': 69},
                          {'nombre': 'A. Arévalo', 'media': 56},
                          {'nombre': 'I. Álvarez', 'media': 70}],
             'defensas': [{'nombre': 'Gil Fomeyam', 'media': 68},
                          {'nombre': 'Albarrán', 'media': 69},
                          {'nombre': 'X. Sintes', 'media': 69},
                          {'nombre': 'Villarasa', 'media': 68},
                          {'nombre': 'R. Alves', 'media': 69},
                          {'nombre': 'Trilli', 'media': 64},
                          {'nombre': 'Á. Martín', 'media': 66},
                          {'nombre': 'M. Timorán', 'media': 60}],
             'medios': [{'nombre': 'I. Ruiz', 'media': 71},
                        {'nombre': 'P. Ortiz', 'media': 69},
                        {'nombre': 'D. Requena', 'media': 67},
                        {'nombre': 'A. del Moral', 'media': 65},
                        {'nombre': 'Dalisson', 'media': 66},
                        {'nombre': 'M. Goti', 'media': 67},
                        {'nombre': 'Théo', 'media': 66}],
             'delanteros': [{'nombre': 'N. Obolskii', 'media': 64},
                            {'nombre': 'Adilson', 'media': 67},
                            {'nombre': 'D. Bri', 'media': 62},
                            {'nombre': 'K. Medina', 'media': 67},
                            {'nombre': 'S. Guardiola', 'media': 67},
                            {'nombre': 'D. Percan', 'media': 60}]},
 'Mirandés': {'porteros': [{'nombre': 'I. Nikic', 'media': 70}, {'nombre': 'Juanpa', 'media': 64}],
              'defensas': [{'nombre': 'Postigo', 'media': 67},
                           {'nombre': 'J. Gutiérrez', 'media': 71},
                           {'nombre': 'L. Córdoba', 'media': 65},
                           {'nombre': 'Medrano', 'media': 65},
                           {'nombre': 'H. Novoa', 'media': 66},
                           {'nombre': 'Pica', 'media': 67},
                           {'nombre': 'M. Pascual', 'media': 67},
                           {'nombre': 'Cabello', 'media': 66},
                           {'nombre': 'E. Coniac', 'media': 54}],
              'medios': [{'nombre': 'R. Bauza', 'media': 65},
                         {'nombre': 'T. Helguera', 'media': 66},
                         {'nombre': 'I. Barea', 'media': 65},
                         {'nombre': 'I. Hernández', 'media': 68},
                         {'nombre': 'A. Martín', 'media': 66},
                         {'nombre': 'Zárate', 'media': 58},
                         {'nombre': 'A. Houary', 'media': 65},
                         {'nombre': 'Selvi', 'media': 65}],
              'delanteros': [{'nombre': 'C. Fernández', 'media': 71},
                             {'nombre': 'A. Marí', 'media': 64},
                             {'nombre': 'S. El Jebari', 'media': 64},
                             {'nombre': 'Gabri', 'media': 58},
                             {'nombre': 'P. Pérez', 'media': 64},
                             {'nombre': 'Arriola', 'media': 57},
                             {'nombre': 'T. Tamarit', 'media': 62},
                             {'nombre': 'I. Varela', 'media': 63},
                             {'nombre': 'P. López', 'media': 63},
                             {'nombre': 'S. Diao', 'media': 64},
                             {'nombre': 'D. Sia', 'media': 59}]},
 'FC Andorra': {'porteros': [{'nombre': 'Bomba', 'media': 68}, {'nombre': 'Owono', 'media': 66}, {'nombre': 'N. Ratti', 'media': 68}],
                'defensas': [{'nombre': 'G. Alonso', 'media': 66},
                             {'nombre': 'T. Carrique', 'media': 65},
                             {'nombre': 'Imanol', 'media': 70},
                             {'nombre': 'Frignar', 'media': 71},
                             {'nombre': 'D. Alende', 'media': 66},
                             {'nombre': 'Á. Petxa', 'media': 66}],
                'medios': [{'nombre': 'S. Molina', 'media': 66},
                           {'nombre': 'Á. Martín', 'media': 64},
                           {'nombre': 'Villahermosa', 'media': 66},
                           {'nombre': 'M. Domènech', 'media': 64},
                           {'nombre': 'T. Le Normand', 'media': 62},
                           {'nombre': 'E. Akman', 'media': 62}],
                'delanteros': [{'nombre': 'Lautaro', 'media': 67},
                               {'nombre': 'K. Min Su', 'media': 70},
                               {'nombre': 'Olabarrieta', 'media': 67},
                               {'nombre': 'M. Nieto', 'media': 67},
                               {'nombre': 'Iastin', 'media': 66},
                               {'nombre': 'M. Vilà', 'media': 66},
                               {'nombre': 'M. Cardona', 'media': 67},
                               {'nombre': 'Á. Calvo', 'media': 66},
                               {'nombre': 'J. Cerdà', 'media': 62},
                               {'nombre': 'Yeray', 'media': 65}]},
 'Burgos Club de Fútbol': {'porteros': [{'nombre': 'Cantero', 'media': 70},
                                        {'nombre': 'L. Ruiz', 'media': 71},
                                        {'nombre': 'Monedero', 'media': 62}],
                           'defensas': [{'nombre': 'S. González', 'media': 69},
                                        {'nombre': 'G. Sierra', 'media': 67},
                                        {'nombre': 'F. Miguel', 'media': 70},
                                        {'nombre': 'A. Lizancos', 'media': 65},
                                        {'nombre': 'Q. Luengo', 'media': 69},
                                        {'nombre': 'A. Buñuel', 'media': 66},
                                        {'nombre': 'D. González', 'media': 57}],
                           'medios': [{'nombre': 'I. Morante', 'media': 68},
                                      {'nombre': 'Atienza', 'media': 71},
                                      {'nombre': 'C. Sánchez', 'media': 70},
                                      {'nombre': 'K. Appin', 'media': 69},
                                      {'nombre': 'Marcelo', 'media': 61},
                                      {'nombre': 'M. Cantero', 'media': 63},
                                      {'nombre': 'Ethan', 'media': 58},
                                      {'nombre': 'd. Gerro', 'media': 63},
                                      {'nombre': 'P. Galdames', 'media': 69}],
                           'delanteros': [{'nombre': 'F. Niño', 'media': 70},
                                          {'nombre': 'I. Córdoba', 'media': 72},
                                          {'nombre': 'D. González', 'media': 67},
                                          {'nombre': 'M. González', 'media': 69},
                                          {'nombre': 'M. Mejía', 'media': 66},
                                          {'nombre': 'R. Martínez', 'media': 66},
                                          {'nombre': 'Mollejo', 'media': 69},
                                          {'nombre': 'F. García', 'media': 60},
                                          {'nombre': 'H. Cuenca', 'media': 62}]},
 'Málaga': {'porteros': [{'nombre': 'Á. Herrero', 'media': 72}, {'nombre': 'L. López', 'media': 68}, {'nombre': 'C. López', 'media': 62}],
            'defensas': [{'nombre': 'Nelson Monte', 'media': 68},
                         {'nombre': 'Á. Esmorís', 'media': 68},
                         {'nombre': 'Jaimito', 'media': 66},
                         {'nombre': 'Galilea', 'media': 68},
                         {'nombre': 'Víctor', 'media': 67},
                         {'nombre': 'D. Murillo', 'media': 63},
                         {'nombre': 'Izan Merino', 'media': 63},
                         {'nombre': 'Gabilondo', 'media': 67}],
            'medios': [{'nombre': 'Manu Molina', 'media': 70},
                       {'nombre': 'Luismi', 'media': 69},
                       {'nombre': 'Larrubia', 'media': 67},
                       {'nombre': 'Sangalli', 'media': 68},
                       {'nombre': 'Juanpe', 'media': 67},
                       {'nombre': 'A. Cordero', 'media': 69},
                       {'nombre': 'Kevin Medina', 'media': 67},
                       {'nombre': 'Dani Lorenzo', 'media': 67},
                       {'nombre': 'Ramón', 'media': 66},
                       {'nombre': 'Haitam', 'media': 65}],
            'delanteros': [{'nombre': 'Roko Baturina', 'media': 68},
                           {'nombre': 'Dioni', 'media': 67},
                           {'nombre': 'Castel', 'media': 67},
                           {'nombre': 'Chupete', 'media': 60}]},
 'Real Zaragoza': {'porteros': [{'nombre': 'Gaetan Poussin', 'media': 68},
                                {'nombre': 'C. Álvarez', 'media': 70},
                                {'nombre': 'J. Femenías', 'media': 69},
                                {'nombre': 'Acín', 'media': 62}],
                   'defensas': [{'nombre': 'Lluís López', 'media': 69},
                                {'nombre': 'Bernardo Vital', 'media': 69},
                                {'nombre': 'Dani Tasende', 'media': 68},
                                {'nombre': 'Iván Calero', 'media': 69},
                                {'nombre': 'Jair', 'media': 68},
                                {'nombre': 'S. Kostić', 'media': 66},
                                {'nombre': 'Clemente', 'media': 67},
                                {'nombre': 'Luna', 'media': 65},
                                {'nombre': 'Nieto', 'media': 67},
                                {'nombre': 'Borge', 'media': 64}],
                   'medios': [{'nombre': 'Keidi Bare', 'media': 71},
                              {'nombre': 'Francho', 'media': 71},
                              {'nombre': 'Marc Aguado', 'media': 69},
                              {'nombre': 'Toni Moya', 'media': 70},
                              {'nombre': 'Gori', 'media': 65},
                              {'nombre': 'Adu Ares', 'media': 66},
                              {'nombre': 'Aketxe', 'media': 72},
                              {'nombre': 'Bermejo', 'media': 68}],
                   'delanteros': [{'nombre': 'Iván Azón', 'media': 69},
                                  {'nombre': 'Samed Baždar', 'media': 70},
                                  {'nombre': 'Mario Soberón', 'media': 69},
                                  {'nombre': 'Alberto Marí', 'media': 67},
                                  {'nombre': 'Pau Sans', 'media': 62}]},
 'Sporting Gijón': {'porteros': [{'nombre': 'Rubén Yáñez', 'media': 72}, {'nombre': 'C. Sánchez', 'media': 65}],
                    'defensas': [{'nombre': 'Rober Pier', 'media': 71},
                                 {'nombre': 'Eric Curbelo', 'media': 70},
                                 {'nombre': 'Cote', 'media': 70},
                                 {'nombre': 'Guille Rosas', 'media': 70},
                                 {'nombre': 'Diego Sánchez', 'media': 67},
                                 {'nombre': 'J. Álex Kembo', 'media': 62},
                                 {'nombre': 'Maras', 'media': 69},
                                 {'nombre': 'Enol Coto', 'media': 63}],
                    'medios': [{'nombre': 'Nacho Méndez', 'media': 71},
                               {'nombre': 'Lander Olaetxea', 'media': 70},
                               {'nombre': 'Jesús Bernal', 'media': 69},
                               {'nombre': 'Nacho Martín', 'media': 67},
                               {'nombre': 'Gelabert', 'media': 71},
                               {'nombre': 'Kevin Vázquez', 'media': 68}],
                    'delanteros': [{'nombre': 'Gaspar Campos', 'media': 72},
                                   {'nombre': 'J. J. Dubasin', 'media': 70},
                                   {'nombre': 'Juan Otero', 'media': 71},
                                   {'nombre': 'Víctor Campuzano', 'media': 67},
                                   {'nombre': 'Jordy Caicedo', 'media': 69},
                                   {'nombre': 'Dani Queipo', 'media': 67}]},
 'Almería': {'porteros': [{'nombre': 'Fernando', 'media': 71}, {'nombre': 'Maximiano', 'media': 75}],
             'defensas': [{'nombre': 'Edgar González', 'media': 73},
                          {'nombre': 'Chumi', 'media': 71},
                          {'nombre': 'Bruno Langa', 'media': 71},
                          {'nombre': 'Marc Pubill', 'media': 73},
                          {'nombre': 'Radovanović', 'media': 70},
                          {'nombre': 'Kaiky', 'media': 70},
                          {'nombre': 'Centelles', 'media': 70},
                          {'nombre': 'Pozo', 'media': 70}],
             'medios': [{'nombre': 'Dion Lopy', 'media': 74},
                        {'nombre': 'Lucas Robertone', 'media': 76},
                        {'nombre': 'Melero', 'media': 74},
                        {'nombre': 'Baba', 'media': 72},
                        {'nombre': 'Gui Guedes', 'media': 68},
                        {'nombre': 'Sergio Arribas', 'media': 75},
                        {'nombre': 'Nico Melamed', 'media': 75}],
             'delanteros': [{'nombre': 'Luis Suárez', 'media': 76},
                            {'nombre': 'Leo Baptistão', 'media': 74},
                            {'nombre': 'Arnau Puigmal', 'media': 71},
                            {'nombre': 'Marezi', 'media': 66},
                            {'nombre': 'Rachad', 'media': 62}]}}

equipos_humanos_segunda = []

class PartidoSegunda(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    jornada = db.Column(db.Integer, nullable=False)
    local = db.Column(db.String(100), nullable=False)
    visitante = db.Column(db.String(100), nullable=False)
    goles_local = db.Column(db.Integer, nullable=False)
    goles_visitante = db.Column(db.Integer, nullable=False)
    mvp = db.Column(db.String(100), nullable=True)

class EventoSegunda(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    partido_id = db.Column(db.Integer, db.ForeignKey("partido_segunda.id"), nullable=False)
    tipo = db.Column(db.String(50), nullable=False)
    equipo = db.Column(db.String(100), nullable=False)
    jugador = db.Column(db.String(100), nullable=False)

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
calendario_segunda = generar_calendario([equipo["nombre"] for equipo in equipos_segunda])

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


def elegir_jugador_segunda(equipo):
    plantilla = jugadores_por_equipo_segunda[equipo]
    todos = plantilla["porteros"] + plantilla["defensas"] + plantilla["medios"] + plantilla["delanteros"]
    return random.choice(todos)["nombre"]

def partido_segunda_ya_jugado(local, visitante):
    return PartidoSegunda.query.filter_by(local=local, visitante=visitante).first() is not None

def simular_resultado_con_eventos_segunda(local, visitante):
    goles_local = random.randint(0, 4)
    goles_visitante = random.randint(0, 4)
    eventos = []
    for _ in range(goles_local):
        tipo = random.choices(["gol", "gol_penalti", "gol_propia"], weights=[80, 15, 5], k=1)[0]
        if tipo == "gol":
            eventos.append({"tipo": "gol", "equipo": local, "jugador": elegir_jugador_segunda(local)})
        elif tipo == "gol_penalti":
            eventos.append({"tipo": "gol_penalti", "equipo": local, "jugador": elegir_jugador_segunda(local)})
        else:
            eventos.append({"tipo": "gol_propia", "equipo": local, "jugador": elegir_jugador_segunda(visitante)})
    for _ in range(goles_visitante):
        tipo = random.choices(["gol", "gol_penalti", "gol_propia"], weights=[80, 15, 5], k=1)[0]
        if tipo == "gol":
            eventos.append({"tipo": "gol", "equipo": visitante, "jugador": elegir_jugador_segunda(visitante)})
        elif tipo == "gol_penalti":
            eventos.append({"tipo": "gol_penalti", "equipo": visitante, "jugador": elegir_jugador_segunda(visitante)})
        else:
            eventos.append({"tipo": "gol_propia", "equipo": visitante, "jugador": elegir_jugador_segunda(local)})
    if random.random() < 0.20:
        eventos.append({"tipo": "penalti_fallado", "equipo": local, "jugador": elegir_jugador_segunda(local)})
    if random.random() < 0.20:
        eventos.append({"tipo": "penalti_fallado", "equipo": visitante, "jugador": elegir_jugador_segunda(visitante)})
    for _ in range(random.randint(0, 3)):
        eventos.append({"tipo": "amarilla", "equipo": local, "jugador": elegir_jugador_segunda(local)})
    for _ in range(random.randint(0, 3)):
        eventos.append({"tipo": "amarilla", "equipo": visitante, "jugador": elegir_jugador_segunda(visitante)})
    if random.random() < 0.12:
        eventos.append({"tipo": "roja", "equipo": local, "jugador": elegir_jugador_segunda(local)})
    if random.random() < 0.12:
        eventos.append({"tipo": "roja", "equipo": visitante, "jugador": elegir_jugador_segunda(visitante)})
    return goles_local, goles_visitante, eventos

def calcular_mvp_segunda(eventos, local, visitante):
    contador = {}
    for ev in eventos:
        jugador = ev["jugador"]
        if jugador not in contador:
            contador[jugador] = 0
        if ev["tipo"] == "gol":
            contador[jugador] += 5
        elif ev["tipo"] == "gol_penalti":
            contador[jugador] += 4
        elif ev["tipo"] == "gol_propia":
            contador[jugador] -= 3
        elif ev["tipo"] == "penalti_fallado":
            contador[jugador] -= 2
        elif ev["tipo"] == "amarilla":
            contador[jugador] -= 1
        elif ev["tipo"] == "roja":
            contador[jugador] -= 3
    if contador:
        return max(contador, key=contador.get)
    plantilla_local = jugadores_por_equipo_segunda[local]
    plantilla_visit = jugadores_por_equipo_segunda[visitante]
    jugadores_local = plantilla_local["porteros"] + plantilla_local["defensas"] + plantilla_local["medios"] + plantilla_local["delanteros"]
    jugadores_visit = plantilla_visit["porteros"] + plantilla_visit["defensas"] + plantilla_visit["medios"] + plantilla_visit["delanteros"]
    return random.choice(jugadores_local + jugadores_visit)["nombre"]

def simular_y_guardar_partido_segunda(jornada_num, local, visitante):
    if partido_segunda_ya_jugado(local, visitante):
        return
    goles_local, goles_visitante, eventos = simular_resultado_con_eventos_segunda(local, visitante)
    mvp = calcular_mvp_segunda(eventos, local, visitante)
    partido = PartidoSegunda(jornada=jornada_num, local=local, visitante=visitante, goles_local=goles_local, goles_visitante=goles_visitante, mvp=mvp)
    db.session.add(partido)
    db.session.commit()
    for ev in eventos:
        evento = EventoSegunda(partido_id=partido.id, tipo=ev["tipo"], equipo=ev["equipo"], jugador=ev["jugador"])
        db.session.add(evento)
    db.session.commit()

def obtener_resultados_segunda():
    partidos = PartidoSegunda.query.order_by(PartidoSegunda.jornada, PartidoSegunda.id).all()
    resultados = []
    for partido in partidos:
        eventos_db = EventoSegunda.query.filter_by(partido_id=partido.id).all()
        eventos = [{"tipo": ev.tipo, "equipo": ev.equipo, "jugador": ev.jugador} for ev in eventos_db]
        resultados.append({"id": partido.id, "jornada": partido.jornada, "local": partido.local, "visitante": partido.visitante, "goles_local": partido.goles_local, "goles_visitante": partido.goles_visitante, "mvp": partido.mvp, "eventos": eventos})
    return resultados



def calcular_clasificacion_segunda():
    tabla = {}
    for equipo in equipos_segunda:
        tabla[equipo["nombre"]] = {
            "nombre": equipo["nombre"], "pts": 0, "pj": 0, "v": 0, "e": 0, "p": 0,
            "gf": 0, "gc": 0, "dg": 0, "ta": 0, "tr": 0, "mvp": 0, "pct": 0,
            "ult5": []
        }

    partidos = PartidoSegunda.query.order_by(PartidoSegunda.jornada, PartidoSegunda.id).all()
    for partido in partidos:
        local = tabla[partido.local]
        visitante = tabla[partido.visitante]

        local["pj"] += 1
        visitante["pj"] += 1
        local["gf"] += partido.goles_local
        local["gc"] += partido.goles_visitante
        visitante["gf"] += partido.goles_visitante
        visitante["gc"] += partido.goles_local

        if partido.goles_local > partido.goles_visitante:
            local["v"] += 1
            local["pts"] += 3
            visitante["p"] += 1
            local["ult5"].append("W")
            visitante["ult5"].append("L")
        elif partido.goles_local < partido.goles_visitante:
            visitante["v"] += 1
            visitante["pts"] += 3
            local["p"] += 1
            local["ult5"].append("L")
            visitante["ult5"].append("W")
        else:
            local["e"] += 1
            visitante["e"] += 1
            local["pts"] += 1
            visitante["pts"] += 1
            local["ult5"].append("D")
            visitante["ult5"].append("D")

        eventos = EventoSegunda.query.filter_by(partido_id=partido.id).all()
        for ev in eventos:
            if ev.equipo in tabla:
                if ev.tipo == "amarilla":
                    tabla[ev.equipo]["ta"] += 1
                elif ev.tipo == "roja":
                    tabla[ev.equipo]["tr"] += 1

        if partido.mvp:
            for equipo_nombre, plantilla in jugadores_por_equipo_segunda.items():
                encontrado = False
                for grupo in plantilla.values():
                    for jugador in grupo:
                        if jugador["nombre"] == partido.mvp:
                            tabla[equipo_nombre]["mvp"] += 1
                            encontrado = True
                            break
                    if encontrado:
                        break
                if encontrado:
                    break

    for equipo in tabla.values():
        equipo["dg"] = equipo["gf"] - equipo["gc"]
        equipo["ult5"] = equipo["ult5"][-5:]
        equipo["pct"] = round((equipo["pts"] / (equipo["pj"] * 3)) * 100) if equipo["pj"] else 0

    return sorted(tabla.values(), key=lambda x: (x["pts"], x["dg"], x["gf"]), reverse=True)




def obtener_estadisticas_segunda():
    partidos = PartidoSegunda.query.all()
    ids = [p.id for p in partidos]
    eventos = EventoSegunda.query.filter(EventoSegunda.partido_id.in_(ids)).all() if ids else []

    def localizar_equipo_jugador(nombre_jugador):
        for equipo_nombre, plantilla in jugadores_por_equipo_segunda.items():
            for grupo in plantilla.values():
                for jugador in grupo:
                    if jugador["nombre"] == nombre_jugador:
                        return equipo_nombre
        return ""

    def top_por_tipo(tipo, limit=5):
        conteo = defaultdict(int)
        equipo_jugador = {}
        for ev in eventos:
            if ev.tipo == tipo:
                conteo[ev.jugador] += 1
                if ev.jugador not in equipo_jugador:
                    equipo_jugador[ev.jugador] = ev.equipo or localizar_equipo_jugador(ev.jugador)
        items = sorted(conteo.items(), key=lambda x: (-x[1], x[0]))[:limit]
        return [{"jugador": nombre, "total": total, "equipo": equipo_jugador.get(nombre, "")} for nombre, total in items]

    def top_goleadores(limit=5):
        conteo = defaultdict(int)
        equipo_jugador = {}
        for ev in eventos:
            if ev.tipo in ("gol", "gol_penalti"):
                conteo[ev.jugador] += 1
                if ev.jugador not in equipo_jugador:
                    equipo_jugador[ev.jugador] = ev.equipo or localizar_equipo_jugador(ev.jugador)
        items = sorted(conteo.items(), key=lambda x: (-x[1], x[0]))[:limit]
        return [{"jugador": nombre, "total": total, "equipo": equipo_jugador.get(nombre, "")} for nombre, total in items]

    def top_mvp(limit=5):
        conteo = defaultdict(int)
        for partido in partidos:
            if partido.mvp:
                conteo[partido.mvp] += 1
        items = sorted(conteo.items(), key=lambda x: (-x[1], x[0]))[:limit]
        return [{"jugador": nombre, "total": total, "equipo": localizar_equipo_jugador(nombre)} for nombre, total in items]

    return {
        "goles": top_goleadores(),
        "amarillas": top_por_tipo("amarilla"),
        "rojas": top_por_tipo("roja"),
        "penaltis_provocados": [],
        "goles_penalti": top_por_tipo("gol_penalti"),
        "penaltis_fallados": top_por_tipo("penalti_fallado"),
        "penaltis_parados": [],
        "goles_falta": [],
        "autogoles": top_por_tipo("gol_propia"),
        "mvp": top_mvp(),
    }


def simular_liga_segunda_completa():
    for jornada_num, partidos in enumerate(calendario_segunda, start=1):
        for local, visitante in partidos:
            simular_y_guardar_partido_segunda(jornada_num, local, visitante)


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


@app.route("/segunda")
def ver_segunda():
    return render_template("segunda.html")

@app.route("/segunda/simular", methods=["POST"])
def simular_liga_segunda():
    simular_liga_segunda_completa()
    return redirect(url_for("ver_clasificacion_segunda"))

@app.route("/segunda/calendario")
def ver_calendario_segunda():
    resultados = obtener_resultados_segunda()
    return render_template("segunda_calendario.html", jornadas=calendario_segunda, resultados=resultados)

@app.route("/segunda/clasificacion")
def ver_clasificacion_segunda():
    tabla = calcular_clasificacion_segunda()
    total_partidos = len(calendario_segunda) * (len(calendario_segunda[0]) if calendario_segunda else 0)
    jugados = PartidoSegunda.query.count()
    simulada = total_partidos > 0 and jugados >= total_partidos
    return render_template("segunda_clasificacion.html", tabla=tabla, jugados=jugados, total_partidos=total_partidos, simulada=simulada)


@app.route("/segunda/estadisticas")
def ver_estadisticas_segunda():
    stats = obtener_estadisticas_segunda()
    return render_template("segunda_estadisticas.html", **stats)

@app.route("/segunda/equipo/<path:nombre_equipo>")
def ver_equipo_segunda(nombre_equipo):
    equipo = next((e for e in equipos_segunda if e["nombre"] == nombre_equipo), None)
    plantilla = jugadores_por_equipo_segunda.get(nombre_equipo)
    if not equipo or not plantilla:
        return redirect(url_for("ver_segunda"))
    return render_template("segunda_equipo.html", equipo=equipo, plantilla=plantilla)

@app.route("/segunda/reiniciar")
def reiniciar_segunda():
    EventoSegunda.query.delete()
    PartidoSegunda.query.delete()
    db.session.commit()
    return redirect(url_for("ver_clasificacion_segunda"))


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
