/* script block 1 */

// ══ MVP OBLIGATORIO — funciones globales ══════════════════════
window._mvpForceCallback = null;

window.showMvpForce = function(mid, teamA, teamB, sqA, sqB, scoreA, scoreB, onConfirm) {
  window._mvpForceCallback = onConfirm;

  var scoreEl = document.getElementById('mvp-ov-score-' + mid);
  if (scoreEl) scoreEl.textContent = scoreA + ' - ' + scoreB;

  function renderList(listId, sq, team) {
    var el = document.getElementById(listId);
    if (!el) return;
    var html = '';
    sq.forEach(function(p) {
      if (p.h) { html += '<div class="mvp-pl-sec">' + p.h + '</div>'; return; }
      var num = String(p[0]);
      var name = String(p[1]);
      html += '<button class="mvp-pl-btn" data-mid="' + mid + '" data-team="' + team
            + '" data-num="' + num + '" data-name="' + name.replace(/"/g, '&quot;')
            + '" onclick="window.confirmMvpForce(this)">'
            + '<span class="mvp-pl-num">' + num + '</span>'
            + '<span class="mvp-pl-name">' + name + '</span>'
            + '</button>';
    });
    el.innerHTML = html;
  }

  renderList('mvp-list-a-' + mid, sqA, 'a');
  renderList('mvp-list-b-' + mid, sqB, 'b');

  var ov = document.getElementById('mvp-ov-' + mid);
  if (ov) ov.classList.add('show');
};

window.confirmMvpForce = function(btn) {
  var mid  = btn.getAttribute('data-mid');
  var team = btn.getAttribute('data-team');
  var num  = btn.getAttribute('data-num');
  var name = btn.getAttribute('data-name');
  var ov = document.getElementById('mvp-ov-' + mid);
  if (ov) ov.classList.remove('show');
  if (window._mvpForceCallback) {
    window._mvpForceCallback(team, num, name);
    window._mvpForceCallback = null;
  }
};
// ══════════════════════════════════════════════════════════════


/* script block 2 */
(function(){
var _sc={a:0,b:0};var _rojas={a:0,b:0};var _events=[];var _timerSec=0;var _timerInterval=null;var _timerRunning=false;
var _htDone=false;var _etDone=false;var _et1Done=false;var _matchFinished=false;var _pendingEvt=null;
var _etPhase=false;
// ═══ REGISTRO GLOBAL DE PLANTILLAS ═══
window.TEAM_RATINGS={
  'Real Madrid':85,
  'FC Barcelona':85,
  'Atlético Madrid':83,
  'Real Sociedad':79,
  'Real Betis':79,
  'Sevilla FC':75,'Sevilla':75,
  'Villarreal CF':80,'Villarreal':80,
  'Athletic Club':79,
  'Girona FC':77,
  'Osasuna':77,
  'Rayo Vallecano':77,
  'Valencia CF':76,
  'Mallorca':76,
  'Getafe CF':75,
  'Celta de Vigo':76,
  'Espanyol':76,
  'Bayern Munich':85,
  'Arsenal':85,
  'Deportivo Alavés':74,
  'Elche CF':74,
  'Levante UD':73,
  'Real Oviedo':73,
  'Real Madrid Castilla':67,
  'RM Castilla':67,
  'Ponferradina':66,
  'Cultural Leonesa':66,
  'CD Lugo':65,
  'Celta Fortuna':65,
  'Racing Ferrol':65,
  'Gimnàstic Tarragona':64,
  'Osasuna Promesas':63,
  'Bilbao Ath.':62,
  'Unionistas CF':61,
  'AD Mérida':60,
  'Mérida AD':60,
  'Barakaldo':59,
  'Arenteiro':58,
  'Zamora CF':57,
  'Ourense CF':56,
  'CF Talavera':55,
  'CD Guadalajara':54,
  'CP Cacereño':53,
  'Arenas de Getxo':51,
  'Real Avilés Industrial':50,
  'UD Ibiza':67,
  'Real Murcia':66,
  'Eldense':66,
  'Hércules CF':65,
  'Hércules':65,
  'AD Alcorcón':65,
  'Alcorcón':65,
  'FC Cartagena':64,
  'Villarreal B':64,
  'Marbella FC':63,
  'CE Sabadell':62,
  'Betis Deportivo':62,
  'Antequera CF':61,
  'Sevilla At.':60,
  'Sevilla Atlético':60,
  'Algeciras CF':59,
  'Atlético Madrileño':58,
  'At. Sanluqueño':57,
  'Atlético Sanluqueño':57,
  'CE Europa':56,
  'SD Tarazona':55,
  'Tarazona':55,
  'CD Teruel':54,
  'Juventud Torremolinos':52,
  'Estepona':50,
};
window.SQUAD_REGISTRY={
  'Real Madrid':[
    {h:'🧤 PORTEROS'},
    ['1','Courtois',89],
    ['13','Lunin',80],
    ['26','Fran González',64],
    ['25','Mestre',60],
    {h:'🛡 DEFENSAS'},
    ['12','Trent',86],
    ['2','Carvajal',85],
    ['22','Rüdiger',85],
    ['3','Militão',84],
    ['24','Huijsen',82],
    ['4','Alaba',80],
    ['23','Mendy',81],
    ['18','Carreras',80],
    ['15','Asencio',78],
    ['20','Fran García',77],
    ['27','Aguado',59],
    {h:'⚙️ MEDIOS'},
    ['5','Bellingham',89],
    ['8','Valverde',88],
    ['14','Tchouaméni',84],
    ['6','Camavinga',82],
    ['10','Arda Güler',82],
    ['21','Brahim',81],
    ['19','Ceballos',80],
    ['16','Gonzalo',73],
    ['30','Mastantuono',77],
    ['45','Pitarch',60],
    ['28','Cestero',63],
    {h:'⚡ DELANTEROS'},
    ['9','Mbappé',91],
    ['7','Vinicius',89],
    ['11','Rodrygo',84],
  ],
  'FC Barcelona':[
    {h:'🧤 PORTEROS'},
    ['1','Joan García',85],
    ['13','Szczęsny',83],
    ['25','Kochen',61],
    {h:'🛡 DEFENSAS'},
    ['23','Koundé',86],
    ['2','Cancelo',84],
    ['3','Balde',83],
    ['24','Eric García',83],
    ['4','Araújo',82],
    ['5','Cubarsí',82],
    ['18','G. Martín',76],
    ['15','Christensen',80],
    {h:'⚙️ MEDIOS'},
    ['8','Pedri',90],
    ['21','F. de Jong',87],
    ['20','Dani Olmo',84],
    ['6','Gavi',83],
    ['16','Fermín',83],
    ['14','Rashford',81],
    ['17','Casadó',79],
    ['22','Bernal',74],
    ['35','T. Fernández',64],
    ['40','Jofre',61],
    ['34','G. Fernández',60],
    ['43','Marqués',59],
    {h:'⚡ DELANTEROS'},
    ['10','Lamine Yamal',89],
    ['11','Raphinha',89],
    ['9','Lewandowski',87],
    ['7','Ferran Torres',84],
    ['28','Bardghji',74],
  ],
  'Athletic Club':[
    {h:'🧤 PORTEROS'},
    ['1','Unai Simón',84],
    ['13','Padilla',69],
    ['25','Manex',63],
    {h:'🛡 DEFENSAS'},
    ['4','Laporte',82],
    ['5','Vivian',83],
    ['6','Yeray',82],
    ['17','Berchiche',79],
    ['19','Gorosabel',76],
    ['18','Areso',77],
    ['20','Lekue',73],
    ['7','Paredes',78],
    ['27','Maroan',73],
    ['24','A. Hierro',60],
    ['21','Monreal',70],
    ['14','Egiluz',70],
    {h:'⚙️ MEDIOS'},
    ['9','Sancet',83],
    ['22','B. Prados',78],
    ['10','Galarreta',80],
    ['23','Jauregizar',80],
    ['15','Vesga',73],
    ['16','U. Gómez',73],
    ['26','N. Serrano',70],
    ['25','Boiro',73],
    ['11','Rego',71],
    ['29','Selton',62],
    {h:'⚡ DELANTEROS'},
    ['11','Nico Williams',86],
    ['12','Iñaki Williams',82],
    ['3','Berenguer',81],
    ['2','Guruzeta',78],
    ['28','Izeta',71],
  ],
  'Atlético Madrid':[
    {h:'🧤 PORTEROS'},
    ['1','Oblak',88],
    ['13','Musso',79],
    ['26','Esquivel',63],
    {h:'🛡 DEFENSAS'},
    ['3','Marcos Llorente',84],
    ['2','Hancko',83],
    ['5','Giménez',83],
    ['4','Le Normand',81],
    ['6','Lenglet',78],
    ['12','Pubill',78],
    ['20','N. Molina',77],
    ['23','Ruggeri',76],
    ['36','Kostis',68],
    {h:'⚙️ MEDIOS'},
    ['7','Griezmann',84],
    ['14','P. Barrios',83],
    ['8','Koke',81],
    ['10','Cardoso',80],
    ['18','G. Simeone',81],
    ['17','De Paul',79],
    ['22','Mendoza',71],
    ['27','Monserrate',58],
    ['19','Almada',79],
    ['24','Rayane',61],
    {h:'⚡ DELANTEROS'},
    ['9','Julián Álvarez',87],
    ['11','Sørloth',83],
    ['15','Lookman',83],
    ['16','Álex Baena',83],
    ['25','N. González',79],
  ],
  'Real Betis':[
    {h:'🧤 PORTEROS'},
    ['1','Valles',78],
    ['13','Pau López',78],
    ['25','Adrián',72],
    ['30','Ó. González',62],
    ['16','Gavin',57],
    {h:'🛡 DEFENSAS'},
    ['5','Bartra',79],
    ['4','Natan',79],
    ['24','Ruibal',77],
    ['23','Llorente',76],
    ['3','Junior Firpo',75],
    ['40','Á. Ortiz',70],
    ['2','Chimy',73],
    {h:'⚙️ MEDIOS'},
    ['22','Isco',84],
    ['15','Lo Celso',81],
    ['8','Fornals',81],
    ['7','Antony',81],
    ['17','Fidalgo',78],
    ['21','M. Roca',78],
    ['6','Altimira',77],
    ['14','Amrabat',79],
    ['18','Deossa',76],
    ['10','Riquelme',59],
    ['11','Corralejo',59],
    ['20','D. Pérez',63],
    {h:'⚡ DELANTEROS'},
    ['19','Cucho',79],
    ['9','Abde',79],
    ['26','P. García',70],
    ['28','V. Gómez',76],
  ],
  'Real Sociedad':[
    {h:'🧤 PORTEROS'},
    ['1','Remiro',82],
    ['13','U. Marrero',69],
    {h:'🛡 DEFENSAS'},
    ['5','Zubeldia',77],
    ['31','Jon Martín',75],
    ['6','Elustondo',74],
    ['16','Ćaleta-Car',74],
    ['20','Odriozola',73],
    ['2','Jon Aramburu',77],
    ['3','S. Gómez',79],
    {h:'⚙️ MEDIOS'},
    ['17','Brais Méndez',80],
    ['14','Kubo',81],
    ['21','Zakharyan',73],
    ['4','Gorrotxa',75],
    ['12','Y. Herrera',81],
    ['8','Turrientes',73],
    ['11','Guedes',75],
    ['18','C. Soler',77],
    ['24','Sučić',75],
    ['15','P. Marín',73],
    ['22','Wesley',69],
    {h:'⚡ DELANTEROS'},
    ['10','Oyarzabal',82],
    ['7','Barrenetxea',78],
    ['9','Óskarsson',74],
    ['19','Karrikaburu',67],
  ],
  'Sevilla FC':[
    {h:'🧤 PORTEROS'},
    ['1','Vlachodimos',78],
    ['13','Nyland',75],
    ['25','A. Flores',65],
    ['30','R. Romero',62],
    {h:'🛡 DEFENSAS'},
    ['3','Azpilicueta',78],
    ['22','Gudelj',76],
    ['15','Babá Mendy',76],
    ['4','Kike Salas',75],
    ['12','Suazo',75],
    ['16','Juanlu',75],
    ['23','Marcão',74],
    ['5','Nianzou',72],
    ['18','Castrín',67],
    {h:'⚙️ MEDIOS'},
    ['6','Agoumé',75],
    ['17','D. Sow',76],
    ['8','Joan Jordán',74],
    ['19','Cardoso',74],
    ['24','Januzaj',74],
    ['10','Peque',74],
    ['11','Carmona',77],
    ['20','Sierra',64],
    ['21','Bueno',65],
    ['22','Altozano',58],
    {h:'⚡ DELANTEROS'},
    ['7','R. Vargas',78],
    ['9','Ejuke',77],
    ['14','Á. Sánchez',76],
    ['28','Maupay',74],
    ['26','Akor Adams',74],
    ['15','Isaac Romero',74],
    ['29','Gattoni',71],
  ],
  'Villarreal CF':[
    {h:'🧤 PORTEROS'},
    ['1','Luís Júnior',78],
    ['13','Tenas',75],
    ['25','Conde',76],
    ['30','R. Gómez',63],
    {h:'🛡 DEFENSAS'},
    ['12','R. Veiga',77],
    ['23','Cardona',79],
    ['26','Pau Navarro',69],
    ['24','Pedraza',76],
    ['2','Logan Costa',77],
    ['15','Mouriño',78],
    ['4','Rafa Marín',76],
    ['5','Kambwala',72],
    ['8','Foyth',79],
    ['14','Cabanes',65],
    {h:'⚙️ MEDIOS'},
    ['18','P. Gueye',79],
    ['11','Comesaña',78],
    ['10','Moleiro',81],
    ['17','Buchanan',75],
    ['16','Partey',80],
    ['6','Maciá',62],
    ['9','H. López',60],
    ['22','Diatta',62],
    {h:'⚡ DELANTEROS'},
    ['7','Gerard Moreno',81],
    ['27','Ayoze',82],
    ['19','Pépé',81],
    ['21','Oluwaseyi',70],
    ['28','Mikautadze',78],
    ['20','Freeman',73],
    ['33','J.Y. Valou',62],
    ['29','Alfon',75],
  ],
  'Espanyol':[
    {h:'🧤 PORTEROS'},
    ['1','Dmitrović',80],
    ['13','Fortuño',65],
    ['25','Tristán',64],
    {h:'🛡 DEFENSAS'},
    ['3','L. Cabrera',79],
    ['5','C. Romero',78],
    ['2','El Hilali',77],
    ['23','Calero',75],
    ['6','Riedel',72],
    ['15','M. Rubio',70],
    ['18','Salinas',72],
    {h:'⚙️ MEDIOS'},
    ['10','Edu Expósito',78],
    ['8','P. Lozano',76],
    ['11','P. Milla',76],
    ['14','U. González',75],
    ['7','T. Dolan',75],
    ['4','Terrats',75],
    ['17','Jofre',74],
    ['20','A. Roca',73],
    ['22','Noonge',72],
    ['21','R. Sánchez',70],
    ['19','Pickel',71],
    ['24','Puado',77],
    {h:'⚡ DELANTEROS'},
    ['9','R. Fernández',75],
    ['16','Tristán',64],
  ],
  'Getafe CF':[
    {h:'🧤 PORTEROS'},
    ['1','David Soria',80],
    ['13','Letáček',69],
    ['25','J. Benito',58],
    ['31','J. Pérez',56],
    {h:'🛡 DEFENSAS'},
    ['21','Femenía',74],
    ['3','Djené',77],
    ['22','D. Duarte',74],
    ['4','Z. Romero',72],
    ['2','D. Rico',77],
    ['6','Abqar',74],
    ['26','Boselli',72],
    ['23','J. Iglesias',74],
    ['28','Davinchi',67],
    ['27','Mayoral',77],
    {h:'⚙️ MEDIOS'},
    ['8','Arambarri',80],
    ['5','Luis Milla',81],
    ['10','M. Martín',72],
    ['14','J. Muñoz',74],
    ['17','Sancris',73],
    ['20','Nvom',71],
    ['16','Birmančević',77],
    ['9','Mestanza',59],
    ['11','Risco',62],
    ['12','J. Montes',57],
    ['29','Kamara',68],
    ['24','Solozábal',59],
    ['18','Bekhoucha',64],
    {h:'⚡ DELANTEROS'},
    ['7','Satriano',74],
    ['15','L. Vázquez',70],
    ['19','A. Liso',72],
    ['30','Juanmi',73],
  ],
  'Albacete BP':[
    {h:'🧤 PORTEROS'},
    ['1','Mariño',67],
    ['13','Lizoain',69],
    ['25','M. Ramos',58],
    {h:'🛡 DEFENSAS'},
    ['21','C. Neva',71],
    ['23','P. Sánchez',68],
    ['22','L. López',68],
    ['24','Vallejo',72],
    ['5','J. Moreno',64],
    ['2','Lorenzo',64],
    ['15','J. Germán',64],
    ['16','F. Gámez',69],
    ['3','Bernabéu',60],
    ['14','Jota',59],
    ['26','Á. Rubio',65],
    {h:'⚙️ MEDIOS'},
    ['4','Agus Medina',71],
    ['8','Pacheco',64],
    ['6','Meléndez',65],
    ['12','Cedeño',66],
    ['17','M. Fernández',69],
    ['9','Obeng',67],
    ['11','J. Villar',65],
    ['7','Valverde',65],
    ['20','Capi',61],
    ['10','Bartolomé',65],
    ['29','Morientes',58],
    {h:'⚡ DELANTEROS'},
    ['27','Puertas',72],
    ['18','Jefté',70],
    ['19','Higinio',68],
    ['28','Lazo',68],
  ],
  'Celta de Vigo':[
    {h:'🧤 PORTEROS'},
    ['1','Iván Villar',78],
    ['13','Andrei Radu',76],
    ['30','M. Vidal',75],
    ['25','El-Abdellaoui',72],
    {h:'🛡 DEFENSAS'},
    ['22','Á. Núñez',76],
    ['4','Jutglà',76],
    ['26','Aidoo',76],
    ['2','Carreira',75],
    ['3','Marcos Alonso',79],
    ['5','Starfelt',78],
    ['6','J. Rodríguez',76],
    ['28','Durán',74],
    ['33','Domínguez',73],
    ['27','Y. Lago',71],
    ['12','Ristić',73],
    ['21','M. Fernández',70],
    {h:'⚙️ MEDIOS'},
    ['18','H. Álvarez',75],
    ['15','Vecino',76],
    ['20','Sotelo',74],
    ['7','Mingueza',80],
    ['10','M. Román',72],
    ['8','Moriba',76],
    {h:'⚡ DELANTEROS'},
    ['11','Swedberg',75],
    ['9','Borja Iglesias',80],
    ['17','F. López',73],
    ['14','Iago Aspas',82],
  ],
  'Osasuna':[
    {h:'🧤 PORTEROS'},
    ['1','S. Herrera',79],
    ['13','A. Fernández',77],
    ['28','Stamatakis',62],
    {h:'🛡 DEFENSAS'},
    ['22','R. García',73],
    ['5','Boyomo',78],
    ['4','Catena',78],
    ['2','Rosier',77],
    ['3','Galán',77],
    ['23','Bretones',75],
    ['24','J. Cruz',73],
    ['15','Herrando',75],
    {h:'⚙️ MEDIOS'},
    ['7','V. Muñoz',76],
    ['11','R. García',78],
    ['17','R. Moro',75],
    ['8','Moncayola',78],
    ['6','Torró',78],
    ['20','Baria',73],
    ['16','Í. Muñoz',75],
    ['10','Aimar Oroz',78],
    ['27','Mauro',64],
    ['29','I. Benito',71],
    ['14','M. Gómez',77],
    {h:'⚡ DELANTEROS'},
    ['9','Budimir',81],
    ['18','Arnau',73],
  ],
  'Deportivo Alavés':[
    {h:'🧤 PORTEROS'},
    ['1','Sivera',77],
    ['13','R. Fernández',72],
    ['28','Swiderski',61],
    {h:'🛡 DEFENSAS'},
    ['23','Parada',70],
    ['5','Garcés',72],
    ['24','Yusi',68],
    ['25','Mariano',70],
    ['22','Diabate',72],
    ['26','Koski',66],
    ['2','Tenaglia',77],
    ['4','Pacheco',74],
    ['3','Jonny',75],
    ['30','Mañas',63],
    ['29','Morcillo',59],
    {h:'⚙️ MEDIOS'},
    ['10','Aleñá',74],
    ['14','D. Suárez',74],
    ['18','Guridi',74],
    ['19','Protesoni',73],
    ['6','P. Ibáñez',73],
    ['27','Á. Pérez',64],
    ['8','A. Blanco',75],
    ['15','Guevara',74],
    ['17','Rebbach',72],
    ['31','Pinillos',70],
    ['11','Calebe',71],
    {h:'⚡ DELANTEROS'},
    ['9','Boyé',74],
    ['16','T. Martínez',75],
  ],
  'Girona FC':[
    {h:'🧤 PORTEROS'},
    ['13','Gazzaniga',78],
    ['1','R. Blanco',73],
    ['25','J. Carlos',71],
    ['30','Krapyvtsov',64],
    {h:'🛡 DEFENSAS'},
    ['3','A. Moreno',77],
    ['5','V. Reis',75],
    ['4','Blind',76],
    ['2','A. Martínez',78],
    ['23','Rincón',73],
    ['27','A. Ruiz',72],
    ['24','Witsel',76],
    ['22','Francés',75],
    ['26','D. López',76],
    {h:'⚙️ MEDIOS'},
    ['10','Lemar',77],
    ['7','Bryan Gil',77],
    ['6','Beltrán',77],
    ['8','I. Martín',77],
    ['11','Tsygankov',78],
    ['14','Echeverri',73],
    ['15','J. Roca',72],
    ['28','Ounahi',78],
    ['16','Van de Beek',75],
    ['18','Portu',75],
    ['20','Kourouma',65],
    ['21','J. Arango',61],
    ['29','Dame Ba',62],
    {h:'⚡ DELANTEROS'},
    ['9','Vanat',77],
    ['17','Stuani',76],
    ['31','ter Stegen',85],
  ],
  'Real Oviedo':[
    {h:'🧤 PORTEROS'},
    ['1','Escandell',78],
    ['13','Moldovan',71],
    ['32','Narváez',63],
    {h:'🛡 DEFENSAS'},
    ['2','N. Vidal',72],
    ['3','J. López',72],
    ['4','D. Carmo',75],
    ['5','Costas',74],
    ['22','Borbas',72],
    ['23','Bailly',73],
    ['24','D. Calvo',72],
    ['25','Alhassane',71],
    ['26','Forés',70],
    ['31','M. Esteban',64],
    {h:'⚙️ MEDIOS'},
    ['6','Colombatto',73],
    ['8','Sibo',68],
    ['10','A. Reina',73],
    ['7','Chairá',72],
    ['11','H. Hassan',74],
    ['14','Cazorla',75],
    ['17','T. Fernández',74],
    ['16','Ahiado',68],
    ['18','Dendoncker',74],
    ['19','Fonseca',73],
    ['27','Ilić',69],
    ['28','Ejaria',66],
    ['30','Agudín',63],
    {h:'⚡ DELANTEROS'},
    ['9','F. Viñas',72],
  ],
  'Levante UD':[
    {h:'🧤 PORTEROS'},
    ['1','M. Ryan',79],
    ['13','Campos',69],
    ['30','Primo',60],
    {h:'🛡 DEFENSAS'},
    ['2','Toljan',74],
    ['3','M. Sánchez',75],
    ['4','M. Moreno',70],
    ['5','Dela',73],
    ['23','Floezabal',71],
    ['24','Matturro',68],
    ['25','Morales',74],
    ['19','Pampín',69],
    ['26','Espí',68],
    ['31','N. Pérez',63],
    ['33','Brugui',73],
    {h:'⚙️ MEDIOS'},
    ['6','P. Martínez',74],
    ['8','Raghouber',69],
    ['10','C. Álvarez',77],
    ['7','I. Romero',74],
    ['11','Tunde',66],
    ['22','Arriaga',74],
    ['14','Olasagasti',73],
    ['15','Vencedor',72],
    ['17','Losada',71],
    ['16','V. García',70],
    ['27','O. Rey',73],
    ['28','Abed',65],
    {h:'⚡ DELANTEROS'},
    ['9','K. Edouard',74],
    ['32','P. Cortés',66],
  ],
  'Mallorca':[
    {h:'🧤 PORTEROS'},
    ['1','Leo Román',77],
    ['20','Bergström',67],
    ['32','Cuéllar',67],
    {h:'🛡 DEFENSAS'},
    ['3','Mojica',78],
    ['4','Raillo',80],
    ['5','Valjent',77],
    ['22','Maffeo',78],
    ['2','Kumbulla',77],
    ['19','Morev',73],
    ['16','T. Lato',73],
    ['30','D. López',68],
    ['25','Salhi',60],
    ['28','Á. Prats',72],
    {h:'⚙️ MEDIOS'},
    ['8','Mascarell',75],
    ['6','Samú Costa',78],
    ['11','Virgilí',75],
    ['10','Darder',80],
    ['21','M. Joseph',72],
    ['7','Morlanes',77],
    ['14','Asano',74],
    ['17','Pablo Torre',74],
    ['23','A. Sánchez',73],
    ['29','Salas',62],
    ['31','Kalumba',65],
    ['27','Llabrés',69],
    {h:'⚡ DELANTEROS'},
    ['9','Muriqi',80],
    ['24','Luvumbo',70],
  ],
  'Elche CF':[
    {h:'🧤 PORTEROS'},
    ['1','Iván Peña',77],
    ['12','Dituro',75],
    ['31','Iturbe',66],
    {h:'🛡 DEFENSAS'},
    ['5','Bigas',76],
    ['4','Affengruber',76],
    ['3','V. Chust',73],
    ['17','Ceneda',72],
    ['2','Pedrosa',75],
    ['22','Pétrot',70],
    ['20','Donald',69],
    ['26','Boayar',62],
    ['27','Albert',58],
    ['29','Sangaré',63],
    ['32','H. Fort',71],
    {h:'⚙️ MEDIOS'},
    ['6','M. Aguado',73],
    ['11','Valera',75],
    ['8','Álex Febas',78],
    ['10','M. Neto',72],
    ['21','Josan',72],
    ['14','G. Villar',72],
    ['15','Yaw Santiago',70],
    ['19','Diangana',70],
    ['24','F. Redondo',70],
    ['28','Tete Morente',71],
    ['30','Á. Sánchez',62],
    ['25','A. Martínez',59],
    {h:'⚡ DELANTEROS'},
    ['9','Álex Rodríguez',71],
    ['7','André da Silva',76],
    ['13','Rafa Mir',75],
  ],
  'Valencia CF':[
    {h:'🧤 PORTEROS'},
    ['1','Dimitrievski',77],
    ['2','C. Rivero',65],
    ['31','Agirrezabala',77],
    {h:'🛡 DEFENSAS'},
    ['12','Gayà',78],
    ['5','Copete',74],
    ['6','Tárrega',75],
    ['23','T. Correia',75],
    ['4','U. Sadiq',75],
    ['3','J. Vázquez',71],
    ['22','Cömert',72],
    ['27','Iranzo',64],
    ['29','Foulquier',73],
    ['32','Diakhaby',76],
    {h:'⚙️ MEDIOS'},
    ['8','Pepelu',76],
    ['14','Ugrinič',74],
    ['11','D. López',77],
    ['10','L. Beltrán',75],
    ['7','Luis Rioja',77],
    ['20','Javi Guerra',77],
    ['15','G. Rodríguez',75],
    ['16','Daniuma',75],
    ['17','Santamaría',75],
    ['18','A. Almeida',74],
    ['24','D. Raba',75],
    ['25','Ramazani',74],
    ['28','L. Núñez',61],
    ['30','Otorbi',63],
    {h:'⚡ DELANTEROS'},
    ['9','Hugo Duro',77],
    ['13','U. Sadio',76],
    ['26','Blázquez',62],
  ],
  'Rayo Vallecano':[
    {h:'🧤 PORTEROS'},
    ['1','Batalla',79],
    ['13','Cárdenas',73],
    ['31','J. Gil',58],
    ['32','A. Molina',54],
    {h:'🛡 DEFENSAS'},
    ['12','Chavarría',78],
    ['5','N. Mendy',73],
    ['4','Lejeune',78],
    ['23','Ratiu',79],
    ['3','Balliu',75],
    ['2','Feline',75],
    ['17','Espino',72],
    ['27','Vertrouwd',67],
    ['33','Mumín',77],
    {h:'⚙️ MEDIOS'},
    ['6','U. López',76],
    ['8','P. Ciss',78],
    ['11','Á. García',81],
    ['10','Isi',81],
    ['7','Akhomach',74],
    ['15','Ó. Valentín',77],
    ['16','Gumbau',72],
    ['18','P. Díaz',75],
    ['26','F. Pérez',71],
    ['28','Trejo',70],
    ['29','Becerra',60],
    ['34','D. Méndez',64],
    {h:'⚡ DELANTEROS'},
    ['9','D. Frutos',80],
    ['14','Alemão',73],
    ['20','C. Martín',69],
    ['24','Nteka',70],
    ['25','Camello',72],
  ],
    'Córdoba CF':[
    {h:'🧤 PORTEROS'},
    ['1','F. Palatsí',75],
    ['13','T. Fernández',70],
    {h:'🛡 DEFENSAS'},
    ['2','L. Calderón',74],
    ['5','M. Valenzuela',73],
    ['6','P. Gutiérrez',74],
    ['3','A. Baidoo',73],
    ['22','C. Ángel',72],
    ['14','C. Boselli',72],
    ['23','A. Lolo',70],
    {h:'⚙️ MEDIOS'},
    ['4','A. Romero',75],
    ['8','J. Andrés Prieto',74],
    ['10','A. Carvalho',76],
    ['20','A. Vallejo',74],
    ['7','C. Isidoro',74],
    ['17','L. Arezo',73],
    ['11','K. Mfulu',72],
    ['16','C. Bañuls',72],
    {h:'⚡ DELANTEROS'},
    ['9','C. Zaldua',76],
    ['19','J. Sebas Moyano',74],
    ['21','A. Cruz',73],
    ['18','D. Casado',72],
  ],
  'Bayern Munich':[
    {h:'🧤 PORTEROS'},
    ['1','Manuel Neuer',83],
    ['26','J. Urbía',75],
    ['27','S. Ulreich',73],
    ['35','J. Bärtl',58],
    ['40','L. Klanac',56],
    {h:'🛡 DEFENSAS'},
    ['4','Jonathan Tah',87],
    ['2','Dayot Upamecano',86],
    ['19','Alphonso Davies',84],
    ['27','Konrad Laimer',83],
    ['3','Kim Min Jae',82],
    ['22','Raphaël Guerreiro',80],
    ['44','Josip Stanišić',78],
    ['21','Hiroki Ito',78],
    ['23','Sacha Boey',77],
    ['40','C. Kiala',58],
    ['36','V. Manuba',61],
    ['38','D. Offli',60],
    {h:'⚙️ MEDIOS'},
    ['6','Joshua Kimmich',89],
    ['42','Jamal Musiala',88],
    ['7','Serge Gnabry',83],
    ['8','Leon Goretzka',81],
    ['45','Aleksandar Pavlović',81],
    ['20','Tom Bischof',78],
    ['39','L. Karl',73],
    ['32','S. Daiber',59],
    {h:'⚡ DELANTEROS'},
    ['9','Harry Kane',89],
    ['17','Michael Olise',88],
    ['14','Luis Díaz',86],
    ['11','Nicolas Jackson',79],
    ['30','W. Mike',61],
  ],
  'Arsenal':[
    {h:'🧤 PORTEROS'},
    ['22','David Raya',87],
    ['13','Kepa',79],
    {h:'🛡 DEFENSAS'},
    ['6','Gabriel',89],
    ['2','William Saliba',88],
    ['12','Jurriën Timber',84],
    ['4','Ben White',83],
    ['33','Piero Hincapié',83],
    ['15','Riccardo Calafiori',81],
    ['49','M. Lewis-Skelly',78],
    ['3','Cristhian Mosquera',77],
    {h:'⚙️ MEDIOS'},
    ['41','Declan Rice',88],
    ['8','Martin Ødegaard',86],
    ['36','Martín Zubimendi',85],
    ['10','Eberechi Eze',84],
    ['23','Mikel Merino',83],
    ['16','Christian Nørgaard',80],
    {h:'⚡ DELANTEROS'},
    ['7','Bukayo Saka',88],
    ['14','Viktor Gyökeres',86],
    ['19','Leandro Trossard',83],
    ['29','Kai Havertz',82],
    ['11','Gabriel Martinelli',81],
    ['9','Gabriel Jesus',80],
    ['20','Noni Madueke',80],
  ],
  'Sporting CP':[
    {h:'🧤 PORTEROS'},
    ['1','R. Silva',81],
    ['12','J. Virginia',72],
    ['13','D. Calai',68],
    ['25','F. Silva',64],
    {h:'🛡 DEFENSAS'},
    ['25','G. Inácio',81],
    ['26','O. Diomande',80],
    ['6','Z. Debast',78],
    ['2','M. Araújo',77],
    ['72','E. Quaresma',77],
    ['3','M. Reis',76],
    ['24','G. Vagiannidis',75],
    ['22','Fresneda',74],
    ['44','Rômulo',63],
    {h:'⚙️ MEDIOS'},
    ['42','M. Hjulmand',83],
    ['5','H. Morita',78],
    ['11','N. Santos',78],
    ['23','D. Bragança',77],
    ['14','G. Kochorash',74],
    ['52','J. Simões',70],
    ['60','R. Lucas',67],
    ['81','F. Gonçalves',65],
    {h:'⚡ DELANTEROS'},
    ['8','P. Gonçalves',83],
    ['17','Trincão',82],
    ['9','Javier Suár',79],
    ['21','G. Catamo',78],
    ['19','F. Ioannidis',77],
    ['57','G. Quenda',76],
    ['77','R. Mangas',74],
    ['20','L. Guilherme',71],
    ['73','S. Faye',68],
    ['79','S. Blopa',67],
    ['91','L. Anjos',66],
  ],
}
// ═══ ALIASES GLOBALES DE EQUIPOS ═══
window.TEAM_ALIASES = {
  'real madrid':'Real Madrid',
  'real madrid cf':'Real Madrid',
  'fc barcelona':'FC Barcelona',
  'barcelona':'FC Barcelona',
  'barca':'FC Barcelona',
  'barça':'FC Barcelona',
  'athletic club':'Athletic Club',
  'athletic':'Athletic Club',
  'real betis':'Real Betis',
  'betis':'Real Betis',
  'real sociedad':'Real Sociedad',
  'sociedad':'Real Sociedad',
  'atletico madrid':'Atlético Madrid',
  'atlético madrid':'Atlético Madrid',
  'atletico de madrid':'Atlético Madrid',
  'atlético de madrid':'Atlético Madrid',
  'atletico':'Atlético Madrid',
  'atlético':'Atlético Madrid',
  'albacete bp':'Albacete BP',
  'albacete':'Albacete BP',
  'villarreal':'Villarreal CF',
  'villarreal cf':'Villarreal CF',
  'sevilla':'Sevilla FC',
  'sevilla fc':'Sevilla FC',
  'espanyol':'Espanyol',
  'getafe':'Getafe CF',
  'getafe cf':'Getafe CF',
  'rc celta':'Celta de Vigo',
  'celta de vigo':'Celta de Vigo',
  'celta':'Celta de Vigo',
  'ca osasuna':'Osasuna',
  'osasuna':'Osasuna',
  'deportivo alaves':'Deportivo Alavés',
  'deportivo alavés':'Deportivo Alavés',
  'alaves':'Deportivo Alavés',
  'alavés':'Deportivo Alavés',
  'girona':'Girona FC',
  'girona fc':'Girona FC',
  'mallorca':'Mallorca',
  'rcd mallorca':'Mallorca',
  'elche':'Elche CF',
  'elche cf':'Elche CF',
  'valencia':'Valencia CF',
  'valencia cf':'Valencia CF',
  'rayo vallecano':'Rayo Vallecano',
  'rayo':'Rayo Vallecano',
  'arsenal':'Arsenal',
  'arsenal fc':'Arsenal',
  'bayern munich':'Bayern Munich',
  'bayern de munich':'Bayern Munich',
  'bayern de múnich':'Bayern Munich',
  'fc bayern munich':'Bayern Munich',
  'fc bayern':'Bayern Munich',
  'bayern':'Bayern Munich',
  'sporting cp':'Sporting CP',
  'sporting de portugal':'Sporting CP',
  'sporting lisboa':'Sporting CP',
  'sporting de lisboa':'Sporting CP',
  'sporting':'Sporting CP',
  'córdoba cf':'Córdoba CF',
  'cordoba cf':'Córdoba CF',
  'cordoba':'Córdoba CF',
  'córdoba':'Córdoba CF'
};
window.sqFromRegistry = function(teamName, opts) {
  // opts: { excluded: ['NombreJugador',...] }  ← lesionados/sancionados
  // Resolver alias (ej: 'Sevilla' → 'Sevilla FC', 'Villarreal' → 'Villarreal CF')
  var aliases = window.TEAM_ALIASES || {};
  var trimmed = (teamName || '').trim();
  var resolved = aliases[trimmed.toLowerCase()] || trimmed;
  var reg = window.SQUAD_REGISTRY[resolved] || window.SQUAD_REGISTRY[trimmed] || window.SQUAD_REGISTRY[teamName];
  if (!reg) {
    console.warn('sqFromRegistry: equipo no encontrado:', teamName, '(resolved:', resolved, ')');
    return [];
  }
  var posMap = {'🧤 PORTEROS':'P','🛡 DEFENSAS':'D','⚙️ MEDIOS':'M','⚡ DELANTEROS':'F',
                '⚙️CENTROCAMPISTAS':'M','⚙️ CENTROCAMPISTAS':'M'};
  var excluded = (opts && opts.excluded) ? opts.excluded : [];

  // 1. Parsear plantilla completa con posición y poder
  var full = []; var curPos = 'M';
  for (var i = 0; i < reg.length; i++) {
    var e = reg[i];
    if (e.h) { curPos = posMap[e.h] || 'M'; }
    else {
      var poder = (e.length >= 3) ? (e[2] || 70) : 70;
      var nombre = e[1];
      // Saltar lesionados/sancionados
      if (excluded.indexOf(nombre) !== -1) continue;
      full.push([e[0], nombre, curPos, poder]);
    }
  }

  // 2. Separar porteros y de campo, ordenar por poder desc
  var gks      = full.filter(function(p){ return p[2]==='P'; })
                     .sort(function(a,b){ return b[3]-a[3]; });
  var outfield = full.filter(function(p){ return p[2]!=='P'; })
                     .sort(function(a,b){ return b[3]-a[3]; });

  // 3. Convocatoria de 18: 2 porteros + 16 de campo (11 titulares + 7 banquillo, mínimo 1 portero siempre)
  var conv = [];
  // Portero titular + 1 suplente portero (si hay)
  var gk1 = gks[0] || null;
  var gk2 = gks[1] || null;
  if (gk1) conv.push(gk1);
  if (gk2) conv.push(gk2);
  // Top 16 de campo por poder
  var fieldSlots = 18 - conv.length; // 16 si hay 2 porteros
  for (var fi = 0; fi < outfield.length && conv.length < 18; fi++) {
    conv.push(outfield[fi]);
  }
  // Si hay menos de 18 disponibles, usamos los que hay
  // Si hay más de 18, ya está limitado por el bucle

  // 4. Marcar titulares (pos 0-10) y suplentes (pos 11-17)
  //    Los primeros 11 son: portero titular + los 10 de campo de más poder
  //    El resto son banquillo
  for (var ci = 0; ci < conv.length; ci++) {
    conv[ci] = [conv[ci][0], conv[ci][1], conv[ci][2], conv[ci][3], ci < 11 ? 'titular' : 'suplente'];
  }

  return conv;
};

// Versión SIN límite de 18 — para partidos manuales (humano)
window.sqFromRegistryFull = function(teamName) {
  var aliases = window.TEAM_ALIASES || {};
  var trimmed = (teamName || '').trim();
  var resolved = aliases[trimmed.toLowerCase()] || trimmed;
  var reg = window.SQUAD_REGISTRY[resolved] || window.SQUAD_REGISTRY[trimmed] || window.SQUAD_REGISTRY[teamName];
  if (!reg) {
    console.warn('sqFromRegistry: equipo no encontrado:', teamName, '(resolved:', resolved, ')');
    return [];
  }
  var posMap = {'🧤 PORTEROS':'P','🛡 DEFENSAS':'D','⚙️ MEDIOS':'M','⚡ DELANTEROS':'F',
                '⚙️CENTROCAMPISTAS':'M','⚙️ CENTROCAMPISTAS':'M'};
  var full = []; var curPos = 'M';
  for (var i = 0; i < reg.length; i++) {
    var e = reg[i];
    if (e.h) { curPos = posMap[e.h] || 'M'; }
    else { full.push([e[0], e[1], curPos, (e.length>=3 ? e[2] : 70)]); }
  }
  return full;
};
// ════════════════════════════════════
var TEAM_A_NAME="Real Madrid";var TEAM_B_NAME="FC Barcelona";
var TEAM_A_OPTS='<option value="1|Thibaut Courtois">1. Thibaut Courtois</option><option value="13|Andriy Lunin">13. Andriy Lunin</option><option value="26|Fran González">26. Fran González</option><option value="43|Sergio Mestre">43. Sergio Mestre</option><option value="9|Kylian Mbappé">9. Kylian Mbappé</option><option value="38|César Palacios">38. César Palacios</option><option value="5|Jude Bellingham">5. Jude Bellingham</option><option value="7|Vinicius Júnior">7. Vinicius Júnior</option><option value="8|Federico Valverde">8. Federico Valverde</option><option value="12|Trent Alexander-Arnold">12. Trent Alexander-Arnold</option><option value="2|Daniel Carvajal">2. Daniel Carvajal</option><option value="22|Antonio Rüdiger">22. Antonio Rüdiger</option><option value="3|Éder Militão">3. Éder Militão</option><option value="14|Aurélien Tchouaméni">14. Aurélien Tchouaméni</option><option value="11|Rodrygo">11. Rodrygo</option><option value="24|Dean Huijsen">24. Dean Huijsen</option><option value="6|Eduardo Camavinga">6. Eduardo Camavinga</option><option value="15|Arda Güler">15. Arda Güler</option><option value="28|Jorge Cestero">28. Jorge Cestero</option><option value="4|David Alaba">4. David Alaba</option><option value="23|Ferland Mendy">23. Ferland Mendy</option><option value="21|Brahim Díaz">21. Brahim Díaz</option><option value="18|Álvaro Carreras">18. Álvaro Carreras</option><option value="19|Dani Ceballos">19. Dani Ceballos</option><option value="17|Raúl Asencio">17. Raúl Asencio</option><option value="20|Fran García">20. Fran García</option><option value="30|Franco Mastantuono">30. Franco Mastantuono</option><option value="16|Gonzalo García">16. Gonzalo García</option><option value="37|Manuel Ángel Morán">37. Manuel Ángel Morán</option><option value="48|Lamini Fati">48. Lamini Fati</option><option value="45|Thiago Pitarch">45. Thiago Pitarch</option><option value="27|Diego Aguado">27. Diego Aguado</option>';var TEAM_B_OPTS='<option value="13|Joan García">13. Joan García</option><option value="31|Diego Kochen">31. Diego Kochen</option><option value="25|Wojciech Szczęsny">25. Wojciech Szczęsny</option><option value="8|Pedri">8. Pedri</option><option value="10|Lamine Yamal">10. Lamine Yamal</option><option value="11|Raphinha">11. Raphinha</option><option value="21|Frenkie de Jong">21. Frenkie de Jong</option><option value="9|Robert Lewandowski">9. Robert Lewandowski</option><option value="23|Jules Koundé">23. Jules Koundé</option><option value="2|João Cancelo">2. João Cancelo</option><option value="36|Álvaro Cortés">36. Álvaro Cortés</option><option value="20|Dani Olmo">20. Dani Olmo</option><option value="7|Ferran Torres">7. Ferran Torres</option><option value="3|Alejandro Balde">3. Alejandro Balde</option><option value="24|Eric García">24. Eric García</option><option value="6|Pablo Gavi">6. Pablo Gavi</option><option value="16|Fermín López">16. Fermín López</option><option value="43|Tomás Marqués">43. Tomás Marqués</option><option value="4|Ronald Araújo">4. Ronald Araújo</option><option value="5|Pau Cubarsí">5. Pau Cubarsí</option><option value="14|Marcus Rashford">14. Marcus Rashford</option><option value="15|Andreas Christensen">15. Andreas Christensen</option><option value="17|Marc Casadó">17. Marc Casadó</option><option value="18|Gerard Martín">18. Gerard Martín</option><option value="22|Marc Bernal">22. Marc Bernal</option><option value="28|Roony Bardghji">28. Roony Bardghji</option><option value="42|Xavi Espart">42. Xavi Espart</option>';
var MAX_NORMAL=5400;var MAX_ET=7200;
var NORMAL_SPEED=944;var ET_SPEED=833;
window.mlTimerClick_j1m1=function(){if(_matchFinished)return;if(_timerRunning){clearInterval(_timerInterval);_timerRunning=false;_renderTimer_j1m1();}else{_timerRunning=true;_startInterval_j1m1();}};
function _startInterval_j1m1(){var spd=_etPhase?ET_SPEED:NORMAL_SPEED;_timerInterval=setInterval(function(){_timerSec+=5;var maxSec=_etDone?MAX_ET:MAX_NORMAL;if(!_htDone&&_timerSec>=2700){_htDone=true;_addMarker_j1m1("— DESCANSO (45 min) —");}if(_etDone&&!_et1Done&&_timerSec>=6300){_et1Done=true;_addMarker_j1m1("— DESCANSO PRÓRROGA (105 min) —");}if(_timerSec>=maxSec){_timerSec=maxSec;clearInterval(_timerInterval);_timerRunning=false;if(_etDone){_checkPenalties_j1m1();}} _renderTimer_j1m1();},spd);};
function _renderTimer_j1m1(){var btn=document.getElementById('ml-timer-j1m1');if(!btn)return;var totalMin=Math.floor(_timerSec/60);if(_matchFinished){btn.textContent='🏁 FIN';btn.className='ml-timer finished';if(window._setScoreState)window._setScoreState('j1m1','finished');return;}var label=_timerRunning?'⏸ ':(_timerSec>=(_etDone?MAX_ET:MAX_NORMAL)?'🔁 ':'▶ ');btn.textContent=label+totalMin+"'";btn.className='ml-timer'+(_timerRunning?' running':'');if(window._setScoreState)window._setScoreState('j1m1',_timerRunning?'playing':'pending');var _bl=document.getElementById('ball-j1m1');if(_bl){if(_timerRunning){_bl.classList.remove('spinning');_bl.classList.add('static');}else{_bl.classList.remove('static');_bl.classList.add('spinning');}}};
function _currentMin_j1m1(){return Math.min(_etDone?120:90,Math.floor(_timerSec/60));};
function _addMarker_j1m1(txt){var list=document.getElementById('ml-acta-list-j1m1');var div=document.createElement('div');div.className='ml-ht';div.textContent=txt;list.appendChild(div);_removeEmpty_j1m1();};
window.mlActivateET_j1m1=function(){if(_etDone||_matchFinished)return;_etDone=true;_etPhase=true;if(_timerRunning){clearInterval(_timerInterval);_startInterval_j1m1();}if(_timerSec<MAX_NORMAL)_timerSec=MAX_NORMAL;_addMarker_j1m1('— PRÓRROGA —');var btn=document.getElementById('ml-btn-et-j1m1');if(btn){btn.disabled=true;btn.style.opacity='0.35';}var penBtn=document.getElementById('ml-btn-pen-j1m1');if(penBtn)penBtn.style.display='';_renderTimer_j1m1();};
window.mlShowPenPanel_j1m1=function(){var pp=document.getElementById('ml-pen-panel-j1m1');if(pp)pp.classList.add('show');var penBtn=document.getElementById('ml-btn-pen-j1m1');if(penBtn){penBtn.disabled=true;penBtn.style.opacity='0.35';}var addBtn=document.getElementById('ml-add-btn-j1m1');if(addBtn){addBtn.disabled=true;addBtn.style.opacity='0.35';}};
window.mlEndMatch_j1m1=function(winner){if(_matchFinished)return;if(!winner&&_sc.a===_sc.b){alert("⚠️ El partido está empatado. Debes ir a PRÓRROGA y luego a PENALTIS.");return;}
  // ── MVP obligatorio ──
  var hasMvp=_events.some(function(e){return e.type==='mvp';});
  if(!hasMvp){
    var sqA_=_sqA_j1m1;
    var sqB_=_sqB_j1m1;
    window.showMvpForce('j1m1','Real Madrid','FC Barcelona',sqA_,sqB_,_sc.a,_sc.b,function(team,num,name){
      var icons={gol:'⚽',propia:'⚽🚫','pen-gol':'⚽🥅','pen-fallo':'❌🥅','pen-prov':'🤦🥅','pen-parado':'🖐🥅','falta-gol':'⚽🎯',amarilla:'🟨','d-amarilla':'🟨🟥',roja:'🟥',lesion:'🩹',mvp:'⭐'};
      _events.push({min:90,label:'MVP del Partido',type:'mvp',team:team,num:num,name:name,ico:'⭐',id:Date.now()});
      _renderActa_j1m1();
      window.mlEndMatch_j1m1(winner);
    });
    return;
  }
clearInterval(_timerInterval);_timerRunning=false;_matchFinished=true;var penWinner=null;if(winner==='a'||winner==='b'){if(_sc.a===_sc.b)penWinner=winner;}if(!winner){if(_sc.a>_sc.b)winner='a';else if(_sc.b>_sc.a)winner='b';else winner='draw';}var btn=document.getElementById('ml-btn-end-j1m1');if(btn){btn.disabled=true;btn.style.opacity='0.35';}var etBtn=document.getElementById('ml-btn-et-j1m1');if(etBtn){etBtn.disabled=true;etBtn.style.opacity='0.35';}var penBtn=document.getElementById('ml-btn-pen-j1m1');if(penBtn){penBtn.disabled=true;penBtn.style.opacity='0.35';}var _ta_a=_events.filter(function(e){return e.team==='a'&&e.type==='amarilla';}).length;var _tr_a=_events.filter(function(e){return e.team==='a'&&(e.type==='roja'||e.type==='d-amarilla');}).length;var _ta_b=_events.filter(function(e){return e.team==='b'&&e.type==='amarilla';}).length;var _tr_b=_events.filter(function(e){return e.team==='b'&&(e.type==='roja'||e.type==='d-amarilla');}).length;var _mvp_a=_events.filter(function(e){return e.team==='a'&&e.type==='mvp';}).length;var _mvp_b=_events.filter(function(e){return e.team==='b'&&e.type==='mvp';}).length;if(typeof window.registrarResultadoLiga==='function')window.registrarResultadoLiga('j1m1',TEAM_A_NAME,TEAM_B_NAME,_sc.a,_sc.b,_ta_a,_tr_a,_ta_b,_tr_b,_mvp_a,_mvp_b,penWinner); if(typeof window.registrarLigaPlayerStats==='function')window.registrarLigaPlayerStats('j1m1',TEAM_A_NAME,TEAM_B_NAME,_events.map(function(ev){return {type:(ev.type==='amarilla'||ev.type==='roja'||ev.type==='d-amarilla')?'card':ev.type,ico:ev.ico,team:ev.team,player:[ev.num,ev.name]};}),(_events.find(function(e){return e.type==='mvp';})||{}).name||'',(_events.find(function(e){return e.type==='mvp';})||{}).team==='a'?TEAM_A_NAME:((_events.find(function(e){return e.type==='mvp';})||{}).team==='b'?TEAM_B_NAME:'')); _renderTimer_j1m1(); if(typeof window._generarLesionHumano==='function')window._generarLesionHumano(TEAM_A_NAME,TEAM_B_NAME); if(typeof window.procesarSancionesPostPartido==='function')window.procesarSancionesPostPartido(_events,'a',TEAM_A_NAME,'liga');};
function _checkPenalties_j1m1(){if(_sc.a===_sc.b){_addMarker_j1m1("— EMPATE AL 120' —");var pp=document.getElementById("ml-pen-panel-j1m1");if(pp)pp.classList.add("show");var addBtn=document.getElementById("ml-add-btn-j1m1");if(addBtn){addBtn.disabled=true;addBtn.style.opacity="0.35";}}else{mlEndMatch_j1m1();}};window.mlConfirmPen_j1m1=function(){var pa=parseInt(document.getElementById("ml-pen-a-j1m1").value)||0;var pb=parseInt(document.getElementById("ml-pen-b-j1m1").value)||0;if(pa===pb){alert("⚠️ Los penaltis no pueden terminar en empate. Introduce un resultado válido.");return;}var penWinner=pa>pb?"a":"b";var psEl=document.getElementById("pen-score-j1m1");if(psEl){psEl.textContent=pa+"–"+pb;psEl.classList.add("show");}var pp=document.getElementById("ml-pen-panel-j1m1");if(pp)pp.classList.remove("show");mlEndMatch_j1m1(penWinner);};
window.mlShowEvOv_j1m1=function(){document.getElementById("ml-ev-overlay-j1m1").classList.add("show");};window.mlHideEvOv_j1m1=function(){document.getElementById("ml-ev-overlay-j1m1").classList.remove("show");};window.mlEvPick_j1m1=function(label,type){document.getElementById("ml-ev-overlay-j1m1").classList.remove("show");mlShowTP_j1m1(label,type);};window.mlShowTP_j1m1=function(label,type){_pendingEvt={label:label,type:type};document.getElementById("ml-tp-ov-evt-j1m1").textContent=label;document.getElementById("ml-tp-overlay-j1m1").classList.add("show");};window.mlHideTP_j1m1=function(){document.getElementById("ml-tp-overlay-j1m1").classList.remove("show");_pendingEvt=null;};window.mlTPSelect_j1m1=function(team){document.getElementById("ml-tp-overlay-j1m1").classList.remove("show");mlDirectPick_j1m1(_pendingEvt.label,_pendingEvt.type,team);};window.mlTogglePanel_j1m1=function(){mlShowEvOv_j1m1();};
var _sqA_j1m1=[];var _sqB_j1m1=[];(function(){  var regA=window.sqFromRegistryFull('Real Madrid');  var regB=window.sqFromRegistryFull('FC Barcelona');  function toOverlayFmt(sq){    if(!sq||!sq.length)return [];    var out=[];    var posLabels={P:'🧤 PORTEROS',D:'🛡 DEFENSAS',M:'⚙️ MEDIOS',F:'⚡ DELANTEROS'};    var curPos=null;    sq.forEach(function(p){      if(p[2]!==curPos){curPos=p[2];out.push({h:posLabels[curPos]||curPos});}       out.push([p[0],p[1]]);    });    return out;  }  if(regA){var fmt=toOverlayFmt(regA);fmt.forEach(function(p){_sqA_j1m1.push(p);});}  if(regB){var fmt2=toOverlayFmt(regB);fmt2.forEach(function(p){_sqB_j1m1.push(p);});}})();window._sqA_j1m1=_sqA_j1m1;window._sqB_j1m1=_sqB_j1m1;window.mlShowPl_j1m1=function(){var ov=document.getElementById("ml-pl-overlay-j1m1");var e=_pendingEvt;var sq=(e.team==="a")?(_sqA_j1m1):(_sqB_j1m1);var tname=(e.team==="a")?TEAM_A_NAME:TEAM_B_NAME;document.getElementById("ml-pl-ov-evt-j1m1").textContent=e.label;document.getElementById("ml-pl-ov-team-j1m1").textContent=tname;var list=document.getElementById("ml-pl-ov-list-j1m1");list.innerHTML=sq.map(function(p){if(p.h)return '<div class="ml-pl-ov-sec">'+p.h+'</div>';return '<button class="ml-pl-ov-btn" onclick="mlPlConfirm_j1m1(\''+p[0]+'\',\''+p[1].replace(/\'/g,"\\'")+ '\')">'+'<span class="ml-pl-ov-num">'+p[0]+'</span>'+'<span class="ml-pl-ov-name">'+p[1]+'</span>'+'</button>';}).join("");ov.classList.add("show");};window.mlHidePl_j1m1=function(){document.getElementById("ml-pl-overlay-j1m1").classList.remove("show");};window.mlPlConfirm_j1m1=function(num,name){document.getElementById("ml-pl-overlay-j1m1").classList.remove("show");if(!_pendingEvt)return;var e=_pendingEvt;var min=_currentMin_j1m1();if(e.type==="d-amarilla"){var hasYellow=_events.some(function(ev){return ev.type==="amarilla"&&ev.team===e.team&&ev.num===num;});if(!hasYellow){_pendingEvt=null;return;}}var scoringTypes=["gol","propia","pen-gol","falta-gol"];if(scoringTypes.indexOf(e.type)!==-1){var st=(e.type==="propia")?(e.team==="a"?"b":"a"):e.team;_sc[st]++;document.getElementById("sc-j1m1-a").textContent=_sc.a;document.getElementById("sc-j1m1-b").textContent=_sc.b;}if((e.type==="d-amarilla"||e.type==="roja")&&(e.type!=="roja"||_events.filter(function(ev){return(ev.type==="roja"||ev.type==="d-amarilla")&&ev.team===e.team;}).length===0)){_rojas=_rojas||{};_rojas[e.team]=(_rojas[e.team]||0)+1;}var icons={gol:"⚽",propia:"⚽🚫","pen-gol":"⚽🥅","pen-fallo":"❌🥅","pen-prov":"🤦🥅","pen-parado":"🖐🥅","falta-gol":"⚽🎯",amarilla:"🟨","d-amarilla":"🟨🟥",roja:"🟥",lesion:"🩹",mvp:"⭐"};_events.push({min:min,label:e.label,type:e.type,team:e.team,num:num,name:name,ico:icons[e.type]||"•",id:Date.now()});_renderActa_j1m1();  _pendingEvt=null;};window.mlDirectPick_j1m1=function(label,type,team){_pendingEvt={label:label,type:type,team:team};mlShowPl_j1m1();};
window.mlCloseModal_j1m1=function(){document.getElementById('ml-modal-j1m1').classList.remove('show');_pendingEvt=null;};
var _evtToStat={gol:'gol',amarilla:'yel','d-amarilla':'yel',roja:'red',mvp:'mvp','pen-prov':'pen-prov','pen-parado':'pen-parado','pen-gol':'pen-gol','falta-gol':'falta-gol',propia:'propia'};
function _removeEmpty_j1m1(){var emp=document.querySelector('#ml-acta-list-j1m1 .ml-acta-empty');if(emp)emp.remove();};
window.mlConfirmEvt_j1m1=function(){if(!_pendingEvt)return;var sel=document.getElementById('ml-modal-sel-j1m1');var parts=sel.value.split('|');var num=parts[0],name=parts[1];var e=_pendingEvt;var min=_currentMin_j1m1();var scoringTypes=['gol','propia','pen-gol','falta-gol'];if(scoringTypes.indexOf(e.type)!==-1){var st=(e.type==='propia')?(e.team==='a'?'b':'a'):e.team;_sc[st]++;document.getElementById('sc-j1m1-a').textContent=_sc.a;document.getElementById('sc-j1m1-b').textContent=_sc.b;}var icons={gol:'⚽',propia:'⚽🚫','pen-gol':'⚽🥅','pen-fallo':'❌🥅','pen-prov':'🤦🥅','pen-parado':'🖐🥅','falta-gol':'⚽🎯',amarilla:'🟨','d-amarilla':'🟨🟥',roja:'🟥',lesion:'🩹',mvp:'⭐'};_events.push({min:min,label:e.label,type:e.type,team:e.team,num:num,name:name,ico:icons[e.type]||'•',id:Date.now()});_renderActa_j1m1();  mlCloseModal_j1m1();};
function _renderActa_j1m1(){var list=document.getElementById('ml-acta-list-j1m1');var sorted=_events.slice().sort(function(a,b){return a.min-b.min;});list.innerHTML='';if(sorted.length===0){list.innerHTML='<div class="ml-acta-empty">Sin eventos registrados</div>';return;}sorted.forEach(function(ev){var row=document.createElement('div');row.className='ml-evt-item';row.setAttribute('data-team',ev.team);row.setAttribute('data-type',ev.type);var tl=(ev.team==='a')?TEAM_A_NAME:TEAM_B_NAME;var _penFalloExtra='';if(ev.type==='pen-parado'){var _contrario=ev.team==='a'?'b':'a';var _fallado=sorted.find(function(e){return e.type==='pen-fallo'&&e.team===_contrario&&e.min===ev.min;});if(_fallado){_penFalloExtra='<span class="ml-evt-pen-fallo">❌ '+_fallado.num+'. '+_fallado.name+'</span>';}}row.innerHTML='<span class="ml-evt-min">'+ev.min+"'</span>"+'<span class="ml-evt-ico">'+ev.ico+'</span>'+'<span class="ml-evt-name">'+ev.num+'. '+ev.name+'</span>'+_penFalloExtra+'<span class="ml-evt-team">'+tl+'</span>'+'<button class="ml-evt-edit" onclick="window._openEditModal(\'j1m1\','+ev.id+')" title="Editar">✏️</button>'+'<button class="ml-evt-del" onclick="mlDelEvt_j1m1('+ev.id+')">✕</button>';list.appendChild(row);});};
window.mlDelEvt_j1m1=function(id){var ev=_events.find(function(e){return e.id===id;});if(!ev)return;var scoringTypes=['gol','propia','pen-gol','falta-gol'];if(scoringTypes.indexOf(ev.type)!==-1){var st=(ev.type==='propia')?(ev.team==='a'?'b':'a'):ev.team;_sc[st]=Math.max(0,_sc[st]-1);document.getElementById('sc-j1m1-a').textContent=_sc.a;document.getElementById('sc-j1m1-b').textContent=_sc.b;}_events=_events.filter(function(e){return e.id!==id;});_renderActa_j1m1();};
})();

/* ══ ESCUDOS EN JORNADAS — tamaño unificado + aliases sólidos ═══════ */
(function(){
  function getCleanTeamName(el){
    if(!el) return '';
    var txt = (el.getAttribute('data-team-name') || el.textContent || '').trim();
    return txt.replace(/\s+\d+\s*\/\s*100$/,'').trim();
  }

  function upsertShield(el){
    if(!el) return;
    var teamName = getCleanTeamName(el);
    if(!teamName || teamName === 'Por definir') return;
    var logoUrl = window.getTeamLogoUrl ? window.getTeamLogoUrl(teamName) : '';
    if(!logoUrl) return;

    var textEl = el.querySelector('.jornada-team-text');
    if(!textEl){
      textEl = document.createElement('span');
      textEl.className = 'jornada-team-text';
    }
    textEl.textContent = teamName;

    var logoEl = el.querySelector('img.escudo-jornada');
    if(!logoEl){
      logoEl = document.createElement('img');
      logoEl.className = 'escudo-jornada';
      logoEl.loading = 'lazy';
      logoEl.decoding = 'async';
    }
    logoEl.src = logoUrl;
    logoEl.alt = 'Escudo de ' + teamName;
    logoEl.onerror = function(){ this.style.display = 'none'; };
    logoEl.style.display = '';

    el.setAttribute('data-team-name', teamName);
    el.textContent = '';
    el.appendChild(logoEl);
    el.appendChild(textEl);
  }

  function injectJornadaShields(){
    document.querySelectorAll('.mrow .mn').forEach(upsertShield);
  }

  window.injectJornadaShields = injectJornadaShields;

  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(injectJornadaShields, 120);
  });

  var _origGoShields = window.go;
  window.go = function(id){
    if(_origGoShields) _origGoShields.apply(this, arguments);
    setTimeout(injectJornadaShields, 120);
  };

  if (typeof MutationObserver !== 'undefined') {
    var obs = new MutationObserver(function(){
      setTimeout(injectJornadaShields, 40);
    });
    document.addEventListener('DOMContentLoaded', function(){
      obs.observe(document.body, { childList:true, subtree:true });
    });
  }
})();

/* script block 3 */
(function(){
var _sc={a:0,b:0};var _rojas={a:0,b:0};var _events=[];var _timerSec=0;var _timerInterval=null;var _timerRunning=false;
var _htDone=false;var _etDone=false;var _et1Done=false;var _matchFinished=false;var _pendingEvt=null;
var _etPhase=false;
var TEAM_A_NAME="Bayern Munich";var TEAM_B_NAME="Arsenal";
var TEAM_A_OPTS='<option value="1|Unai Simón">1. Unai Simón</option><option value="13|Alex Padilla">13. Alex Padilla</option><option value="11|Nico Williams">11. Nico Williams</option><option value="28|Maroan Sannadi">28. Maroan Sannadi</option><option value="7|Aitor Paredes">7. Aitor Paredes</option><option value="4|Aymeric Laporte">4. Aymeric Laporte</option><option value="5|Daniel Vivian">5. Daniel Vivian</option><option value="9|Oihan Sancet">9. Oihan Sancet</option><option value="22|Beñat Prados">22. Beñat Prados</option><option value="6|Yeray Álvarez">6. Yeray Álvarez</option><option value="12|Iñaki Williams">12. Iñaki Williams</option><option value="10|Iñigo R. Galarreta">10. Iñigo R. Galarreta</option><option value="23|Mikel Jauregizar">23. Mikel Jauregizar</option><option value="17|Yuri Berchiche">17. Yuri Berchiche</option><option value="21|Iker Monreal">21. Iker Monreal</option><option value="2|Gorka Guruzeta">2. Gorka Guruzeta</option><option value="19|Andoni Gorosabel">19. Andoni Gorosabel</option><option value="3|Álex Berenguer">3. Álex Berenguer</option><option value="8|Adama Boiro">8. Adama Boiro</option><option value="18|Jesús Areso">18. Jesús Areso</option><option value="20|Íñigo Lekue">20. Íñigo Lekue</option><option value="14|Mikel Vesga">14. Mikel Vesga</option><option value="15|Robert Navarro">15. Robert Navarro</option><option value="16|Unai Gómez">16. Unai Gómez</option><option value="29|Urko Izeta">29. Urko Izeta</option><option value="31|Alejandro Rego">31. Alejandro Rego</option><option value="24|Nico Serrano">24. Nico Serrano</option><option value="25|Eder Garcia">25. Eder Garcia</option><option value="27|Unai Eguíluz">27. Unai Eguíluz</option><option value="26|Selton Sanchez">26. Selton Sanchez</option><option value="30|Asier Hierro">30. Asier Hierro</option>';var TEAM_B_OPTS='<option value="1|Álvaro Valles">1. Álvaro Valles</option><option value="25|Pau López">25. Pau López</option><option value="13|Adrián">13. Adrián</option><option value="22|Isco">22. Isco</option><option value="8|Pablo Fornals">8. Pablo Fornals</option><option value="15|Álvaro Fidalgo">15. Álvaro Fidalgo</option><option value="20|Giovani Lo Celso">20. Giovani Lo Celso</option><option value="7|Antony">7. Antony</option><option value="23|Diego Llorente">23. Diego Llorente</option><option value="40|Angel Ortiz">40. Angel Ortiz</option><option value="5|Marc Bartra">5. Marc Bartra</option><option value="14|Sofyan Amrabat">14. Sofyan Amrabat</option><option value="19|Cucho Hernández">19. Cucho Hernández</option><option value="4|Natan">4. Natan</option><option value="24|Aitor Ruibal">24. Aitor Ruibal</option><option value="6|Sergi Altimira">6. Sergi Altimira</option><option value="17|Rodrigo Riquelme">17. Rodrigo Riquelme</option><option value="21|Marc Roca">21. Marc Roca</option><option value="2|Héctor Bellerín">2. Héctor Bellerín</option><option value="16|Valentín Gómez">16. Valentín Gómez</option><option value="10|Abdessamad Ezzalzouli">10. Abdessamad Ezzalzouli</option><option value="3|Junior Firpo">3. Junior Firpo</option><option value="18|Nelson Deossa">18. Nelson Deossa</option><option value="9|Chimy Ávila">9. Chimy Ávila</option><option value="11|Cédric Bakambu">11. Cédric Bakambu</option><option value="12|Ricardo Rodríguez">12. Ricardo Rodríguez</option>';
var MAX_NORMAL=5400;var MAX_ET=7200;
var NORMAL_SPEED=944;var ET_SPEED=833;
window.mlTimerClick_j1m2=function(){if(_matchFinished)return;if(_timerRunning){clearInterval(_timerInterval);_timerRunning=false;_renderTimer_j1m2();}else{_timerRunning=true;_startInterval_j1m2();}};
function _startInterval_j1m2(){var spd=_etPhase?ET_SPEED:NORMAL_SPEED;_timerInterval=setInterval(function(){_timerSec+=5;var maxSec=_etDone?MAX_ET:MAX_NORMAL;if(!_htDone&&_timerSec>=2700){_htDone=true;_addMarker_j1m2("— DESCANSO (45 min) —");}if(_etDone&&!_et1Done&&_timerSec>=6300){_et1Done=true;_addMarker_j1m2("— DESCANSO PRÓRROGA (105 min) —");}if(_timerSec>=maxSec){_timerSec=maxSec;clearInterval(_timerInterval);_timerRunning=false;if(_etDone){_checkPenalties_j1m2();}} _renderTimer_j1m2();},spd);};
function _renderTimer_j1m2(){var btn=document.getElementById('ml-timer-j1m2');if(!btn)return;var totalMin=Math.floor(_timerSec/60);if(_matchFinished){btn.textContent='🏁 FIN';btn.className='ml-timer finished';if(window._setScoreState)window._setScoreState('j1m2','finished');return;}var label=_timerRunning?'⏸ ':(_timerSec>=(_etDone?MAX_ET:MAX_NORMAL)?'🔁 ':'▶ ');btn.textContent=label+totalMin+"'";btn.className='ml-timer'+(_timerRunning?' running':'');if(window._setScoreState)window._setScoreState('j1m2',_timerRunning?'playing':'pending');var _bl=document.getElementById('ball-j1m2');if(_bl){if(_timerRunning){_bl.classList.remove('spinning');_bl.classList.add('static');}else{_bl.classList.remove('static');_bl.classList.add('spinning');}}};
function _currentMin_j1m2(){return Math.min(_etDone?120:90,Math.floor(_timerSec/60));};
function _addMarker_j1m2(txt){var list=document.getElementById('ml-acta-list-j1m2');var div=document.createElement('div');div.className='ml-ht';div.textContent=txt;list.appendChild(div);_removeEmpty_j1m2();};
window.mlActivateET_j1m2=function(){if(_etDone||_matchFinished)return;_etDone=true;_etPhase=true;if(_timerRunning){clearInterval(_timerInterval);_startInterval_j1m2();}if(_timerSec<MAX_NORMAL)_timerSec=MAX_NORMAL;_addMarker_j1m2('— PRÓRROGA —');var btn=document.getElementById('ml-btn-et-j1m2');if(btn){btn.disabled=true;btn.style.opacity='0.35';}var penBtn=document.getElementById('ml-btn-pen-j1m2');if(penBtn)penBtn.style.display='';_renderTimer_j1m2();};
window.mlShowPenPanel_j1m2=function(){var pp=document.getElementById('ml-pen-panel-j1m2');if(pp)pp.classList.add('show');var penBtn=document.getElementById('ml-btn-pen-j1m2');if(penBtn){penBtn.disabled=true;penBtn.style.opacity='0.35';}var addBtn=document.getElementById('ml-add-btn-j1m2');if(addBtn){addBtn.disabled=true;addBtn.style.opacity='0.35';}};
window.mlEndMatch_j1m2=function(winner){if(_matchFinished)return;if(!winner&&_sc.a===_sc.b){alert("⚠️ El partido está empatado. Debes ir a PRÓRROGA y luego a PENALTIS.");return;}
  // ── MVP obligatorio ──
  var hasMvp=_events.some(function(e){return e.type==='mvp';});
  if(!hasMvp){
    var sqA_=_sqA_j1m2;
    var sqB_=_sqB_j1m2;
    window.showMvpForce('j1m2','Bayern Munich','Arsenal',sqA_,sqB_,_sc.a,_sc.b,function(team,num,name){
      var icons={gol:'⚽',propia:'⚽🚫','pen-gol':'⚽🥅','pen-fallo':'❌🥅','pen-prov':'🤦🥅','pen-parado':'🖐🥅','falta-gol':'⚽🎯',amarilla:'🟨','d-amarilla':'🟨🟥',roja:'🟥',lesion:'🩹',mvp:'⭐'};
      _events.push({min:90,label:'MVP del Partido',type:'mvp',team:team,num:num,name:name,ico:'⭐',id:Date.now()});
      _renderActa_j1m2();
      window.mlEndMatch_j1m2(winner);
    });
    return;
  }
clearInterval(_timerInterval);_timerRunning=false;_matchFinished=true;var penWinner=null;if(winner==='a'||winner==='b'){if(_sc.a===_sc.b)penWinner=winner;}if(!winner){if(_sc.a>_sc.b)winner='a';else if(_sc.b>_sc.a)winner='b';else winner='draw';}var btn=document.getElementById('ml-btn-end-j1m2');if(btn){btn.disabled=true;btn.style.opacity='0.35';}var etBtn=document.getElementById('ml-btn-et-j1m2');if(etBtn){etBtn.disabled=true;etBtn.style.opacity='0.35';}var penBtn=document.getElementById('ml-btn-pen-j1m2');if(penBtn){penBtn.disabled=true;penBtn.style.opacity='0.35';}var _ta_a=_events.filter(function(e){return e.team==='a'&&e.type==='amarilla';}).length;var _tr_a=_events.filter(function(e){return e.team==='a'&&(e.type==='roja'||e.type==='d-amarilla');}).length;var _ta_b=_events.filter(function(e){return e.team==='b'&&e.type==='amarilla';}).length;var _tr_b=_events.filter(function(e){return e.team==='b'&&(e.type==='roja'||e.type==='d-amarilla');}).length;var _mvp_a=_events.filter(function(e){return e.team==='a'&&e.type==='mvp';}).length;var _mvp_b=_events.filter(function(e){return e.team==='b'&&e.type==='mvp';}).length;if(typeof window.registrarResultadoLiga==='function')window.registrarResultadoLiga('j1m2',TEAM_A_NAME,TEAM_B_NAME,_sc.a,_sc.b,_ta_a,_tr_a,_ta_b,_tr_b,_mvp_a,_mvp_b,penWinner); if(typeof window.registrarLigaPlayerStats==='function')window.registrarLigaPlayerStats('j1m2',TEAM_A_NAME,TEAM_B_NAME,_events.map(function(ev){return {type:(ev.type==='amarilla'||ev.type==='roja'||ev.type==='d-amarilla')?'card':ev.type,ico:ev.ico,team:ev.team,player:[ev.num,ev.name]};}),(_events.find(function(e){return e.type==='mvp';})||{}).name||'',(_events.find(function(e){return e.type==='mvp';})||{}).team==='a'?TEAM_A_NAME:((_events.find(function(e){return e.type==='mvp';})||{}).team==='b'?TEAM_B_NAME:'')); _renderTimer_j1m2(); if(typeof window._generarLesionHumano==='function')window._generarLesionHumano(TEAM_A_NAME,TEAM_B_NAME); if(typeof window.procesarSancionesPostPartido==='function')window.procesarSancionesPostPartido(_events,'a',TEAM_A_NAME,'liga');};
function _checkPenalties_j1m2(){if(_sc.a===_sc.b){_addMarker_j1m2("— EMPATE AL 120' —");var pp=document.getElementById("ml-pen-panel-j1m2");if(pp)pp.classList.add("show");var addBtn=document.getElementById("ml-add-btn-j1m2");if(addBtn){addBtn.disabled=true;addBtn.style.opacity="0.35";}}else{mlEndMatch_j1m2();}};window.mlConfirmPen_j1m2=function(){var pa=parseInt(document.getElementById("ml-pen-a-j1m2").value)||0;var pb=parseInt(document.getElementById("ml-pen-b-j1m2").value)||0;if(pa===pb){alert("⚠️ Los penaltis no pueden terminar en empate. Introduce un resultado válido.");return;}var penWinner=pa>pb?"a":"b";var psEl=document.getElementById("pen-score-j1m2");if(psEl){psEl.textContent=pa+"–"+pb;psEl.classList.add("show");}var pp=document.getElementById("ml-pen-panel-j1m2");if(pp)pp.classList.remove("show");mlEndMatch_j1m2(penWinner);};
window.mlShowEvOv_j1m2=function(){document.getElementById("ml-ev-overlay-j1m2").classList.add("show");};window.mlHideEvOv_j1m2=function(){document.getElementById("ml-ev-overlay-j1m2").classList.remove("show");};window.mlEvPick_j1m2=function(label,type){document.getElementById("ml-ev-overlay-j1m2").classList.remove("show");mlShowTP_j1m2(label,type);};window.mlShowTP_j1m2=function(label,type){_pendingEvt={label:label,type:type};document.getElementById("ml-tp-ov-evt-j1m2").textContent=label;document.getElementById("ml-tp-overlay-j1m2").classList.add("show");};window.mlHideTP_j1m2=function(){document.getElementById("ml-tp-overlay-j1m2").classList.remove("show");_pendingEvt=null;};window.mlTPSelect_j1m2=function(team){document.getElementById("ml-tp-overlay-j1m2").classList.remove("show");mlDirectPick_j1m2(_pendingEvt.label,_pendingEvt.type,team);};window.mlTogglePanel_j1m2=function(){mlShowEvOv_j1m2();};
var _sqA_j1m2=[];var _sqB_j1m2=[];(function(){  var regA=window.sqFromRegistryFull('Bayern Munich');  var regB=window.sqFromRegistryFull('Arsenal');  function toOverlayFmt(sq){    if(!sq||!sq.length)return [];    var out=[];    var posLabels={P:'🧤 PORTEROS',D:'🛡 DEFENSAS',M:'⚙️ MEDIOS',F:'⚡ DELANTEROS'};    var curPos=null;    sq.forEach(function(p){      if(p[2]!==curPos){curPos=p[2];out.push({h:posLabels[curPos]||curPos});}       out.push([p[0],p[1]]);    });    return out;  }  if(regA){var fmt=toOverlayFmt(regA);fmt.forEach(function(p){_sqA_j1m2.push(p);});}  if(regB){var fmt2=toOverlayFmt(regB);fmt2.forEach(function(p){_sqB_j1m2.push(p);});}})();window._sqA_j1m2=_sqA_j1m2;window._sqB_j1m2=_sqB_j1m2;window.mlShowPl_j1m2=function(){var ov=document.getElementById("ml-pl-overlay-j1m2");var e=_pendingEvt;var sq=(e.team==="a")?(_sqA_j1m2):(_sqB_j1m2);var tname=(e.team==="a")?TEAM_A_NAME:TEAM_B_NAME;document.getElementById("ml-pl-ov-evt-j1m2").textContent=e.label;document.getElementById("ml-pl-ov-team-j1m2").textContent=tname;var list=document.getElementById("ml-pl-ov-list-j1m2");list.innerHTML=sq.map(function(p){if(p.h)return '<div class="ml-pl-ov-sec">'+p.h+'</div>';return '<button class="ml-pl-ov-btn" onclick="mlPlConfirm_j1m2(\''+p[0]+'\',\''+p[1].replace(/\'/g,"\\'")+ '\')">'+'<span class="ml-pl-ov-num">'+p[0]+'</span>'+'<span class="ml-pl-ov-name">'+p[1]+'</span>'+'</button>';}).join("");ov.classList.add("show");};window.mlHidePl_j1m2=function(){document.getElementById("ml-pl-overlay-j1m2").classList.remove("show");};window.mlPlConfirm_j1m2=function(num,name){document.getElementById("ml-pl-overlay-j1m2").classList.remove("show");if(!_pendingEvt)return;var e=_pendingEvt;var min=_currentMin_j1m2();if(e.type==="d-amarilla"){var hasYellow=_events.some(function(ev){return ev.type==="amarilla"&&ev.team===e.team&&ev.num===num;});if(!hasYellow){_pendingEvt=null;return;}}var scoringTypes=["gol","propia","pen-gol","falta-gol"];if(scoringTypes.indexOf(e.type)!==-1){var st=(e.type==="propia")?(e.team==="a"?"b":"a"):e.team;_sc[st]++;document.getElementById("sc-j1m2-a").textContent=_sc.a;document.getElementById("sc-j1m2-b").textContent=_sc.b;}if((e.type==="d-amarilla"||e.type==="roja")&&(e.type!=="roja"||_events.filter(function(ev){return(ev.type==="roja"||ev.type==="d-amarilla")&&ev.team===e.team;}).length===0)){_rojas=_rojas||{};_rojas[e.team]=(_rojas[e.team]||0)+1;}var icons={gol:"⚽",propia:"⚽🚫","pen-gol":"⚽🥅","pen-fallo":"❌🥅","pen-prov":"🤦🥅","pen-parado":"🖐🥅","falta-gol":"⚽🎯",amarilla:"🟨","d-amarilla":"🟨🟥",roja:"🟥",lesion:"🩹",mvp:"⭐"};_events.push({min:min,label:e.label,type:e.type,team:e.team,num:num,name:name,ico:icons[e.type]||"•",id:Date.now()});_renderActa_j1m2();  _pendingEvt=null;};window.mlDirectPick_j1m2=function(label,type,team){_pendingEvt={label:label,type:type,team:team};mlShowPl_j1m2();};
window.mlCloseModal_j1m2=function(){document.getElementById('ml-modal-j1m2').classList.remove('show');_pendingEvt=null;};
var _evtToStat={gol:'gol',amarilla:'yel','d-amarilla':'yel',roja:'red',mvp:'mvp','pen-prov':'pen-prov','pen-parado':'pen-parado','pen-gol':'pen-gol','falta-gol':'falta-gol',propia:'propia'};
function _removeEmpty_j1m2(){var emp=document.querySelector('#ml-acta-list-j1m2 .ml-acta-empty');if(emp)emp.remove();};
window.mlConfirmEvt_j1m2=function(){if(!_pendingEvt)return;var sel=document.getElementById('ml-modal-sel-j1m2');var parts=sel.value.split('|');var num=parts[0],name=parts[1];var e=_pendingEvt;var min=_currentMin_j1m2();var scoringTypes=['gol','propia','pen-gol','falta-gol'];if(scoringTypes.indexOf(e.type)!==-1){var st=(e.type==='propia')?(e.team==='a'?'b':'a'):e.team;_sc[st]++;document.getElementById('sc-j1m2-a').textContent=_sc.a;document.getElementById('sc-j1m2-b').textContent=_sc.b;}var icons={gol:'⚽',propia:'⚽🚫','pen-gol':'⚽🥅','pen-fallo':'❌🥅','pen-prov':'🤦🥅','pen-parado':'🖐🥅','falta-gol':'⚽🎯',amarilla:'🟨','d-amarilla':'🟨🟥',roja:'🟥',lesion:'🩹',mvp:'⭐'};_events.push({min:min,label:e.label,type:e.type,team:e.team,num:num,name:name,ico:icons[e.type]||'•',id:Date.now()});_renderActa_j1m2();  mlCloseModal_j1m2();};
function _renderActa_j1m2(){var list=document.getElementById('ml-acta-list-j1m2');var sorted=_events.slice().sort(function(a,b){return a.min-b.min;});list.innerHTML='';if(sorted.length===0){list.innerHTML='<div class="ml-acta-empty">Sin eventos registrados</div>';return;}sorted.forEach(function(ev){var row=document.createElement('div');row.className='ml-evt-item';row.setAttribute('data-team',ev.team);row.setAttribute('data-type',ev.type);var tl=(ev.team==='a')?TEAM_A_NAME:TEAM_B_NAME;var _penFalloExtra='';if(ev.type==='pen-parado'){var _contrario=ev.team==='a'?'b':'a';var _fallado=sorted.find(function(e){return e.type==='pen-fallo'&&e.team===_contrario&&e.min===ev.min;});if(_fallado){_penFalloExtra='<span class="ml-evt-pen-fallo">❌ '+_fallado.num+'. '+_fallado.name+'</span>';}}row.innerHTML='<span class="ml-evt-min">'+ev.min+"'</span>"+'<span class="ml-evt-ico">'+ev.ico+'</span>'+'<span class="ml-evt-name">'+ev.num+'. '+ev.name+'</span>'+_penFalloExtra+'<span class="ml-evt-team">'+tl+'</span>'+'<button class="ml-evt-edit" onclick="window._openEditModal(\'j1m2\','+ev.id+')" title="Editar">✏️</button>'+'<button class="ml-evt-del" onclick="mlDelEvt_j1m2('+ev.id+')">✕</button>';list.appendChild(row);});};
window.mlDelEvt_j1m2=function(id){var ev=_events.find(function(e){return e.id===id;});if(!ev)return;var scoringTypes=['gol','propia','pen-gol','falta-gol'];if(scoringTypes.indexOf(ev.type)!==-1){var st=(ev.type==='propia')?(ev.team==='a'?'b':'a'):ev.team;_sc[st]=Math.max(0,_sc[st]-1);document.getElementById('sc-j1m2-a').textContent=_sc.a;document.getElementById('sc-j1m2-b').textContent=_sc.b;}_events=_events.filter(function(e){return e.id!==id;});_renderActa_j1m2();};
})();

/* script block 4 */
(function(){
var _sc={a:0,b:0};var _rojas={a:0,b:0};var _events=[];var _timerSec=0;var _timerInterval=null;var _timerRunning=false;
var _htDone=false;var _matchFinished=false;var _pendingEvt=null;
var TEAM_A_NAME="Deportivo Alavés";var TEAM_B_NAME="Rayo Vallecano";
var TEAM_A_OPTS='<option value="1|Sivera">1. Sivera</option><option value="13|R. Fernández">13. R. Fernández</option><option value="28|Swiderski">28. Swiderski</option><option value="23|Parada">23. Parada</option><option value="5|Garcés">5. Garcés</option><option value="24|Yusi">24. Yusi</option><option value="25|Mariano">25. Mariano</option><option value="22|Diabate">22. Diabate</option><option value="26|Koski">26. Koski</option><option value="2|Tenaglia">2. Tenaglia</option><option value="4|Pacheco">4. Pacheco</option><option value="3|Jonny">3. Jonny</option><option value="30|Mañas">30. Mañas</option><option value="29|Morcillo">29. Morcillo</option><option value="10|Aleñá">10. Aleñá</option><option value="14|D. Suárez">14. D. Suárez</option><option value="18|Guridi">18. Guridi</option><option value="19|Protesoni">19. Protesoni</option><option value="6|P. Ibáñez">6. P. Ibáñez</option><option value="27|Á. Pérez">27. Á. Pérez</option><option value="8|A. Blanco">8. A. Blanco</option><option value="15|Guevara">15. Guevara</option><option value="17|Rebbach">17. Rebbach</option><option value="31|Pinillos">31. Pinillos</option><option value="11|Calebe">11. Calebe</option><option value="9|Boyé">9. Boyé</option><option value="16|T. Martínez">16. T. Martínez</option>';var TEAM_B_OPTS='<option value="1|A. Batalla">1. A. Batalla</option><option value="13|D. Cárdenas">13. D. Cárdenas</option><option value="32|A. Molina">32. A. Molina</option><option value="10|Isi">10. Isi</option><option value="11|Á. García">11. Á. García</option><option value="9|D. Frutos">9. D. Frutos</option><option value="23|A. Ratiu">23. A. Ratiu</option><option value="4|F. Lejeune">4. F. Lejeune</option><option value="12|P. Chavarría">12. P. Chavarría</option><option value="8|P. Ciss">8. P. Ciss</option><option value="33|A. Mumín">33. A. Mumín</option><option value="15|Ó. Valentín">15. Ó. Valentín</option><option value="26|U. López">26. U. López</option><option value="6|L. Feline">6. L. Feline</option><option value="5|I. Balliu">5. I. Balliu</option><option value="18|P. Díaz">18. P. Díaz</option><option value="7|I. Akhomach">7. I. Akhomach</option><option value="3|N. Mendy">3. N. Mendy</option><option value="14|Alemão">14. Alemão</option><option value="17|P. Espino">17. P. Espino</option><option value="16|Gumbau">16. Gumbau</option><option value="25|S. Camello">25. S. Camello</option><option value="34|Ó. Trejo">34. Ó. Trejo</option><option value="24|R. Nteka">24. R. Nteka</option><option value="29|C. Martín">29. C. Martín</option><option value="19|J. Vertrouwd">19. J. Vertrouwd</option><option value="36|D. Méndez">36. D. Méndez</option><option value="35|S. Becerra">35. S. Becerra</option><option value="30|D. las Sías">30. D. las Sías</option>';
var MAX_NORMAL=5400;var TICK_MS=944;
window.mlTimerClick_j1m3=function(){if(_matchFinished)return;if(_timerRunning){clearInterval(_timerInterval);_timerRunning=false;_renderTimer_j1m3();}else{_timerRunning=true;_timerInterval=setInterval(function(){_timerSec+=5;if(!_htDone&&_timerSec>=2700){_htDone=true;_addMarker_j1m3("— DESCANSO (45 min) —");}if(_timerSec>=MAX_NORMAL){_timerSec=MAX_NORMAL;clearInterval(_timerInterval);_timerRunning=false;} _renderTimer_j1m3();},TICK_MS);}};
function _renderTimer_j1m3(){var btn=document.getElementById('ml-timer-j1m3');if(!btn)return;var min=Math.floor(_timerSec/60);if(_matchFinished){btn.textContent='🏁 FIN';btn.className='ml-timer finished';if(window._setScoreState)window._setScoreState('j1m3','finished');return;}var label=_timerRunning?'⏸ ':(_timerSec>=MAX_NORMAL?'🔁 ':'▶ ');btn.textContent=label+min+"'";btn.className='ml-timer'+(_timerRunning?' running':'');if(window._setScoreState)window._setScoreState('j1m3',_timerRunning?'playing':'pending');var _bl=document.getElementById('ball-j1m3');if(_bl){if(_timerRunning){_bl.classList.remove('spinning');_bl.classList.add('static');}else{_bl.classList.remove('static');_bl.classList.add('spinning');}}};
function _currentMin_j1m3(){return Math.min(90,Math.floor(_timerSec/60));};
function _addMarker_j1m3(txt){var list=document.getElementById('ml-acta-list-j1m3');var div=document.createElement('div');div.className='ml-ht';div.textContent=txt;list.appendChild(div);_removeEmpty_j1m3();};
window.mlEndMatch_j1m3=function(){if(_matchFinished)return;
  // ── MVP obligatorio ──
  var hasMvp=_events.some(function(e){return e.type==='mvp';});
  if(!hasMvp){
    var sqA_=window.SQUAD_REGISTRY['Deportivo Alavés']||_sqA_j1m3;
    var sqB_=window.SQUAD_REGISTRY['Rayo Vallecano']||_sqB_j1m3;
    window.showMvpForce('j1m3','Deportivo Alavés','Rayo Vallecano',sqA_,sqB_,_sc.a,_sc.b,function(team,num,name){
      _events.push({min:90,label:'MVP del Partido',type:'mvp',team:team,num:num,name:name,ico:'⭐',id:Date.now()});
      _renderActa_j1m3();
      window.mlEndMatch_j1m3();
    });
    return;
  }
  clearInterval(_timerInterval);_timerRunning=false;_matchFinished=true;var winner;if(_sc.a>_sc.b)winner='a';else if(_sc.b>_sc.a)winner='b';else winner='draw';var btn=document.getElementById('ml-btn-end-j1m3');if(btn){btn.disabled=true;btn.style.opacity='0.35';}var _ta_a=_events.filter(function(e){return e.team==='a'&&e.type==='amarilla';}).length;var _tr_a=_events.filter(function(e){return e.team==='a'&&(e.type==='roja'||e.type==='d-amarilla');}).length;var _ta_b=_events.filter(function(e){return e.team==='b'&&e.type==='amarilla';}).length;var _tr_b=_events.filter(function(e){return e.team==='b'&&(e.type==='roja'||e.type==='d-amarilla');}).length;var _mvp_a=_events.filter(function(e){return e.team==='a'&&e.type==='mvp';}).length;var _mvp_b=_events.filter(function(e){return e.team==='b'&&e.type==='mvp';}).length;if(typeof window.registrarResultadoLiga==='function')window.registrarResultadoLiga('j1m3',TEAM_A_NAME,TEAM_B_NAME,_sc.a,_sc.b,_ta_a,_tr_a,_ta_b,_tr_b,_mvp_a,_mvp_b); if(typeof window.registrarLigaPlayerStats==='function')window.registrarLigaPlayerStats('j1m3',TEAM_A_NAME,TEAM_B_NAME,_events.map(function(ev){return {type:(ev.type==='amarilla'||ev.type==='roja'||ev.type==='d-amarilla')?'card':ev.type,ico:ev.ico,team:ev.team,player:[ev.num,ev.name]};}),(_events.find(function(e){return e.type==='mvp';})||{}).name||'',(_events.find(function(e){return e.type==='mvp';})||{}).team==='a'?TEAM_A_NAME:((_events.find(function(e){return e.type==='mvp';})||{}).team==='b'?TEAM_B_NAME:'')); _renderTimer_j1m3(); if(typeof window._generarLesionHumano==='function')window._generarLesionHumano(TEAM_A_NAME,TEAM_B_NAME); if(typeof window.procesarSancionesPostPartido==='function')window.procesarSancionesPostPartido(_events,'a',TEAM_A_NAME,'liga');};
window.mlShowEvOv_j1m3=function(){document.getElementById("ml-ev-overlay-j1m3").classList.add("show");};window.mlHideEvOv_j1m3=function(){document.getElementById("ml-ev-overlay-j1m3").classList.remove("show");};window.mlEvPick_j1m3=function(label,type){document.getElementById("ml-ev-overlay-j1m3").classList.remove("show");mlShowTP_j1m3(label,type);};window.mlShowTP_j1m3=function(label,type){_pendingEvt={label:label,type:type};document.getElementById("ml-tp-ov-evt-j1m3").textContent=label;document.getElementById("ml-tp-overlay-j1m3").classList.add("show");};window.mlHideTP_j1m3=function(){document.getElementById("ml-tp-overlay-j1m3").classList.remove("show");_pendingEvt=null;};window.mlTPSelect_j1m3=function(team){document.getElementById("ml-tp-overlay-j1m3").classList.remove("show");mlDirectPick_j1m3(_pendingEvt.label,_pendingEvt.type,team);};window.mlTogglePanel_j1m3=function(){mlShowEvOv_j1m3();};
var _sqA_j1m3=[];var _sqB_j1m3=[];(function(){  var regA=window.sqFromRegistryFull('Deportivo Alavés');  var regB=window.sqFromRegistryFull('Rayo Vallecano');  function toOverlayFmt(sq){    if(!sq||!sq.length)return [];    var out=[];    var posLabels={P:'🧤 PORTEROS',D:'🛡 DEFENSAS',M:'⚙️ MEDIOS',F:'⚡ DELANTEROS'};    var curPos=null;    sq.forEach(function(p){      if(p[2]!==curPos){curPos=p[2];out.push({h:posLabels[curPos]||curPos});}       out.push([p[0],p[1]]);    });    return out;  }  if(regA){var fmt=toOverlayFmt(regA);fmt.forEach(function(p){_sqA_j1m3.push(p);});}  if(regB){var fmt2=toOverlayFmt(regB);fmt2.forEach(function(p){_sqB_j1m3.push(p);});}})();window._sqA_j1m3=_sqA_j1m3;window._sqB_j1m3=_sqB_j1m3;window.mlShowPl_j1m3=function(){var ov=document.getElementById("ml-pl-overlay-j1m3");var e=_pendingEvt;var sq=(e.team==="a")?(_sqA_j1m3):(_sqB_j1m3);var tname=(e.team==="a")?TEAM_A_NAME:TEAM_B_NAME;document.getElementById("ml-pl-ov-evt-j1m3").textContent=e.label;document.getElementById("ml-pl-ov-team-j1m3").textContent=tname;var list=document.getElementById("ml-pl-ov-list-j1m3");list.innerHTML=sq.map(function(p){if(p.h)return '<div class="ml-pl-ov-sec">'+p.h+'</div>';return '<button class="ml-pl-ov-btn" onclick="mlPlConfirm_j1m3(\''+p[0]+'\',\''+p[1].replace(/\'/g,"\\'")+ '\')">'+'<span class="ml-pl-ov-num">'+p[0]+'</span>'+'<span class="ml-pl-ov-name">'+p[1]+'</span>'+'</button>';}).join("");ov.classList.add("show");};window.mlHidePl_j1m3=function(){document.getElementById("ml-pl-overlay-j1m3").classList.remove("show");};window.mlPlConfirm_j1m3=function(num,name){document.getElementById("ml-pl-overlay-j1m3").classList.remove("show");if(!_pendingEvt)return;var e=_pendingEvt;var min=_currentMin_j1m3();if(e.type==="d-amarilla"){var hasYellow=_events.some(function(ev){return ev.type==="amarilla"&&ev.team===e.team&&ev.num===num;});if(!hasYellow){_pendingEvt=null;return;}}var scoringTypes=["gol","propia","pen-gol","falta-gol"];if(scoringTypes.indexOf(e.type)!==-1){var st=(e.type==="propia")?(e.team==="a"?"b":"a"):e.team;_sc[st]++;document.getElementById("sc-j1m3-a").textContent=_sc.a;document.getElementById("sc-j1m3-b").textContent=_sc.b;}if((e.type==="d-amarilla"||e.type==="roja")&&(e.type!=="roja"||_events.filter(function(ev){return(ev.type==="roja"||ev.type==="d-amarilla")&&ev.team===e.team;}).length===0)){_rojas=_rojas||{};_rojas[e.team]=(_rojas[e.team]||0)+1;}var icons={gol:"⚽",propia:"⚽🚫","pen-gol":"⚽🥅","pen-fallo":"❌🥅","pen-prov":"🤦🥅","pen-parado":"🖐🥅","falta-gol":"⚽🎯",amarilla:"🟨","d-amarilla":"🟨🟥",roja:"🟥",lesion:"🩹",mvp:"⭐"};_events.push({min:min,label:e.label,type:e.type,team:e.team,num:num,name:name,ico:icons[e.type]||"•",id:Date.now()});_renderActa_j1m3();  _pendingEvt=null;};window.mlDirectPick_j1m3=function(label,type,team){_pendingEvt={label:label,type:type,team:team};mlShowPl_j1m3();};
window.mlCloseModal_j1m3=function(){document.getElementById('ml-modal-j1m3').classList.remove('show');_pendingEvt=null;};
function _removeEmpty_j1m3(){var emp=document.querySelector('#ml-acta-list-j1m3 .ml-acta-empty');if(emp)emp.remove();};
window.mlConfirmEvt_j1m3=function(){if(!_pendingEvt)return;var sel=document.getElementById('ml-modal-sel-j1m3');var parts=sel.value.split('|');var num=parts[0],name=parts[1];var e=_pendingEvt;var min=_currentMin_j1m3();var scoringTypes=['gol','propia','pen-gol','falta-gol'];if(scoringTypes.indexOf(e.type)!==-1){var st=(e.type==='propia')?(e.team==='a'?'b':'a'):e.team;_sc[st]++;document.getElementById('sc-j1m3-a').textContent=_sc.a;document.getElementById('sc-j1m3-b').textContent=_sc.b;}var icons={gol:'⚽',propia:'⚽🚫','pen-gol':'⚽🥅','pen-fallo':'❌🥅','pen-prov':'🤦🥅','pen-parado':'🖐🥅','falta-gol':'⚽🎯',amarilla:'🟨','d-amarilla':'🟨🟥',roja:'🟥',lesion:'🩹',mvp:'⭐'};_events.push({min:min,label:e.label,type:e.type,team:e.team,num:num,name:name,ico:icons[e.type]||'•',id:Date.now()});_renderActa_j1m3();  mlCloseModal_j1m3();};
function _renderActa_j1m3(){var list=document.getElementById('ml-acta-list-j1m3');var sorted=_events.slice().sort(function(a,b){return a.min-b.min;});list.innerHTML='';if(sorted.length===0){list.innerHTML='<div class="ml-acta-empty">Sin eventos registrados</div>';return;}sorted.forEach(function(ev){var row=document.createElement('div');row.className='ml-evt-item';row.setAttribute('data-team',ev.team);row.setAttribute('data-type',ev.type);var tl=(ev.team==='a')?TEAM_A_NAME:TEAM_B_NAME;var _penFalloExtra='';if(ev.type==='pen-parado'){var _contrario=ev.team==='a'?'b':'a';var _fallado=sorted.find(function(e){return e.type==='pen-fallo'&&e.team===_contrario&&e.min===ev.min;});if(_fallado){_penFalloExtra='<span class="ml-evt-pen-fallo">❌ '+_fallado.num+'. '+_fallado.name+'</span>';}}row.innerHTML='<span class="ml-evt-min">'+ev.min+"'</span>"+'<span class="ml-evt-ico">'+ev.ico+'</span>'+'<span class="ml-evt-name">'+ev.num+'. '+ev.name+'</span>'+_penFalloExtra+'<span class="ml-evt-team">'+tl+'</span>'+'<button class="ml-evt-edit" onclick="window._openEditModal(\'j1m3\','+ev.id+')" title="Editar">✏️</button>'+'<button class="ml-evt-del" onclick="mlDelEvt_j1m3('+ev.id+')">✕</button>';list.appendChild(row);});};
window.mlDelEvt_j1m3=function(id){var ev=_events.find(function(e){return e.id===id;});if(!ev)return;var scoringTypes=['gol','propia','pen-gol','falta-gol'];if(scoringTypes.indexOf(ev.type)!==-1){var st=(ev.type==='propia')?(ev.team==='a'?'b':'a'):ev.team;_sc[st]=Math.max(0,_sc[st]-1);document.getElementById('sc-j1m3-a').textContent=_sc.a;document.getElementById('sc-j1m3-b').textContent=_sc.b;}_events=_events.filter(function(e){return e.id!==id;});_renderActa_j1m3();};
})();

/* script block 5 */
(function(){
var _simDone=false;
window.mlSimulate_j1m4=function(){
  if(_simDone)return;_simDone=true;
  window.mlSimEngine({
    matchKey:'j1m4',
    teamA:'Sevilla',
    teamB:'Atlético Madrid',
    sqA:window.sqFromRegistry('Sevilla'),
    sqB:window.sqFromRegistry('Atlético Madrid'),
    btnId:'ml-timer-j1m4',
    listId:'ml-acta-list-j1m4',
    scAId:'sc-j1m4-a',
    scBId:'sc-j1m4-b',
    gfId:'gf-j1m4'
  });
};
})();

/* script block 6 */
(function(){
var _simDone=false;
window.mlSimulate_j1m5=function(){
  if(_simDone)return;_simDone=true;
  window.mlSimEngine({
    matchKey:'j1m5',
    teamA:'Villarreal',
    teamB:'Elche CF',
    sqA:window.sqFromRegistry('Villarreal'),
    sqB:window.sqFromRegistry('Elche CF'),
    btnId:'ml-timer-j1m5',
    listId:'ml-acta-list-j1m5',
    scAId:'sc-j1m5-a',
    scBId:'sc-j1m5-b',
    gfId:'gf-j1m5'
  });
};
})();

/* script block 7 */
(function(){
var _simDone=false;
window.mlSimulate_j1m6=function(){
  if(_simDone)return;_simDone=true;
  window.mlSimEngine({
    matchKey:'j1m6',
    teamA:'Mallorca',
    teamB:'Girona FC',
    sqA:window.sqFromRegistry('Mallorca'),
    sqB:window.sqFromRegistry('Girona FC'),
    btnId:'ml-timer-j1m6',
    listId:'ml-acta-list-j1m6',
    scAId:'sc-j1m6-a',
    scBId:'sc-j1m6-b',
    gfId:'gf-j1m6'
  });
};
})();

/* script block 8 */
(function(){
var _simDone=false;
window.mlSimulate_j1m7=function(){
  if(_simDone)return;_simDone=true;
  window.mlSimEngine({
    matchKey:'j1m7',
    teamA:'Valencia CF',
    teamB:'Arsenal',
    sqA:window.sqFromRegistry('Valencia CF'),
    sqB:window.sqFromRegistry('Arsenal'),
    btnId:'ml-timer-j1m7',
    listId:'ml-acta-list-j1m7',
    scAId:'sc-j1m7-a',
    scBId:'sc-j1m7-b',
    gfId:'gf-j1m7'
  });
};
})();

/* script block 9 */
(function(){
var _simDone=false;
window.mlSimulate_j1m8=function(){
  if(_simDone)return;_simDone=true;
  window.mlSimEngine({
    matchKey:'j1m8',
    teamA:'Espanyol',
    teamB:'Getafe CF',
    sqA:window.sqFromRegistry('Espanyol'),
    sqB:window.sqFromRegistry('Getafe CF'),
    btnId:'ml-timer-j1m8',
    listId:'ml-acta-list-j1m8',
    scAId:'sc-j1m8-a',
    scBId:'sc-j1m8-b',
    gfId:'gf-j1m8'
  });
};
})();

/* script block 10 */
(function(){
var _simDone=false;
window.mlSimulate_j1m9=function(){
  if(_simDone)return;_simDone=true;
  window.mlSimEngine({
    matchKey:'j1m9',
    teamA:'Bayern Munich',
    teamB:'Osasuna',
    sqA:window.sqFromRegistry('Bayern Munich'),
    sqB:window.sqFromRegistry('Osasuna'),
    btnId:'ml-timer-j1m9',
    listId:'ml-acta-list-j1m9',
    scAId:'sc-j1m9-a',
    scBId:'sc-j1m9-b',
    gfId:'gf-j1m9'
  });
};
})();

/* script block 11 */
(function(){
var _simDone=false;
window.mlSimulate_j1m10=function(){
  if(_simDone)return;_simDone=true;
  window.mlSimEngine({
    matchKey:'j1m10',
    teamA:'Celta de Vigo',
    teamB:'Deportivo Alavés',
    sqA:window.sqFromRegistry('Celta de Vigo'),
    sqB:window.sqFromRegistry('Deportivo Alavés'),
    btnId:'ml-timer-j1m10',
    listId:'ml-acta-list-j1m10',
    scAId:'sc-j1m10-a',
    scBId:'sc-j1m10-b',
    gfId:'gf-j1m10'
  });
};
})();

/* script block 12 */

(function(){
  var LIGA_TEAMS = [
    'Arsenal','Athatic__TEMP__', 'Athletic Club','Atlético Madrid','Bayern Munich','Celta de Vigo','Deportivo Alavés','Elche CF','Espanyol','FC Barcelona','Getafe CF','Girona FC','Mallorca','Osasuna','Rayo Vallecano','Real Betis','Real Madrid','Real Sociedad','Sevilla','Valencia CF','Villarreal'
  ].filter(function(t){ return t !== 'Athatic__TEMP__'; }).sort(function(a,b){ return a.localeCompare(b,'es'); });

  var LIGA_EXTRAS = {};
  window.LIGA_EXTRAS = LIGA_EXTRAS;

  // Almacén directo de resultados simulados por jornada
  var LIGA_J1_RESULTS = [];
  window.LIGA_J1_RESULTS = LIGA_J1_RESULTS;

  // Registra resultado de un partido y actualiza clasificación en tiempo real
  window.registrarResultadoLiga = function(matchKey, teamA, teamB, ga, gb, ta_a, tr_a, ta_b, tr_b, mvp_a, mvp_b, penWinner){
    // Guardar resultado directo (sin depender del calendario DOM)
    // Si ya existe este matchKey, actualizarlo; si no, añadirlo
    var existing = -1;
    for(var i=0;i<LIGA_J1_RESULTS.length;i++){
      if(LIGA_J1_RESULTS[i].key===matchKey){existing=i;break;}
    }
    var result = {key:matchKey, home:teamA, away:teamB, gh:ga, ga_:gb, ta_h:ta_a, tr_h:tr_a, ta_a_:ta_b, tr_a_:tr_b, mvp_h:mvp_a, mvp_a:mvp_b, penWinner:penWinner||null};
    if(existing>=0)LIGA_J1_RESULTS[existing]=result; else LIGA_J1_RESULTS.push(result);
    // También actualizar LIGA_EXTRAS (TA, TR, MVP)
    function addEx(t,ta,tr,mvp){
      if(!LIGA_EXTRAS[t])LIGA_EXTRAS[t]={};
      LIGA_EXTRAS[t].ta=(Number(LIGA_EXTRAS[t].ta)||0)+ta;
      LIGA_EXTRAS[t].tr=(Number(LIGA_EXTRAS[t].tr)||0)+tr;
      LIGA_EXTRAS[t].mvp=(Number(LIGA_EXTRAS[t].mvp)||0)+mvp;
    }
    // Reset extras for ALL teams before recalculating to avoid double-counting on re-simulations
    Object.keys(LIGA_EXTRAS).forEach(function(t){ LIGA_EXTRAS[t]={ta:0,tr:0,mvp:0}; });
    // Recalculate extras from all stored results
    LIGA_J1_RESULTS.forEach(function(r){
      if(!LIGA_EXTRAS[r.home])LIGA_EXTRAS[r.home]={ta:0,tr:0,mvp:0};
      if(!LIGA_EXTRAS[r.away])LIGA_EXTRAS[r.away]={ta:0,tr:0,mvp:0};
      LIGA_EXTRAS[r.home].ta=(LIGA_EXTRAS[r.home].ta||0)+r.ta_h;
      LIGA_EXTRAS[r.home].tr=(LIGA_EXTRAS[r.home].tr||0)+r.tr_h;
      LIGA_EXTRAS[r.home].mvp=(LIGA_EXTRAS[r.home].mvp||0)+r.mvp_h;
      LIGA_EXTRAS[r.away].ta=(LIGA_EXTRAS[r.away].ta||0)+r.ta_a_;
      LIGA_EXTRAS[r.away].tr=(LIGA_EXTRAS[r.away].tr||0)+r.tr_a_;
      LIGA_EXTRAS[r.away].mvp=(LIGA_EXTRAS[r.away].mvp||0)+r.mvp_a;
    });
    if(typeof buildLigaClas==='function')buildLigaClas();
  };

  function ensureTeam(store, name){
    if(!name || name === 'Por definir') return null;
    name = String(name).trim();
    if(!store[name]){
      store[name] = {name:name, pts:0, pj:0, v:0, e:0, p:0, gf:0, gc:0, dg:0, ta:0, tr:0, mvp:0, form:[]};
    }
    return store[name];
  }

  function parseScore(scoreText){
    if(!scoreText) return null;
    var clean = String(scoreText).replace(/–/g,'-').replace(/\s+/g,'');
    var m = clean.match(/^(\d+)-(\d+)$/);
    if(!m) return null;
    return {home:parseInt(m[1],10), away:parseInt(m[2],10)};
  }

  function addForm(team, result){
    team.form.push(result);
    if(team.form.length > 5) team.form = team.form.slice(team.form.length - 5);
  }

  function getExtrasForTeam(name){
    var ex = LIGA_EXTRAS[name] || {};
    return {
      ta: Number(ex.ta || 0),
      tr: Number(ex.tr || 0),
      mvp: Number(ex.mvp || 0)
    };
  }

  function collectStandings(){
    var teams = {};
    LIGA_TEAMS.forEach(function(name){ ensureTeam(teams, name); });

    // Leer resultados directos del almacén (simulados en esta sesión)
    var j1SimPairs = {};
    LIGA_J1_RESULTS.forEach(function(r){
      j1SimPairs[r.home+'·'+r.away] = true;
      var home = ensureTeam(teams, r.home);
      var away = ensureTeam(teams, r.away);
      if(!home || !away) return;
      home.pj++; away.pj++;
      home.gf += r.gh; home.gc += r.ga_;
      away.gf += r.ga_; away.gc += r.gh;
      if(r.penWinner){
        // Victoria en penaltis: 3pts ganador, 0pts perdedor
        if(r.penWinner==='a'){
          home.v++; home.pts += 3; away.p++;
          addForm(home,'W'); addForm(away,'L');
        }else{
          away.v++; away.pts += 3; home.p++;
          addForm(home,'L'); addForm(away,'W');
        }
      }else if(r.gh > r.ga_){
        home.v++; home.pts += 3; away.p++;
        addForm(home,'W'); addForm(away,'L');
      }else if(r.gh < r.ga_){
        away.v++; away.pts += 3; home.p++;
        addForm(home,'L'); addForm(away,'W');
      }else{
        home.e++; away.e++; home.pts++; away.pts++;
        addForm(home,'D'); addForm(away,'D');
      }
    });

    // Leer del calendario DOM (jornadas 2-38, y J1 solo si no está ya en el almacén)
    for(var j=1;j<=38;j++){
      var round = document.getElementById('l-j' + j);
      if(!round) continue;
      var rows = round.querySelectorAll('.mrow');
      rows.forEach(function(row){
        var homeEl = row.querySelector('.mn:not(.r)');
        var awayEl = row.querySelector('.mn.r');
        var scoreEl = row.querySelector('.ms');
        if(!homeEl || !awayEl || !scoreEl || scoreEl.classList.contains('p')) return;
        var homeName = homeEl.textContent.trim();
        var awayName = awayEl.textContent.trim();
        // Si ya fue procesado desde el almacén directo, omitir para no duplicar
        if(j===1 && j1SimPairs[homeName+'·'+awayName]) return;
        var home = ensureTeam(teams, homeName);
        var away = ensureTeam(teams, awayName);
        var score = parseScore(scoreEl.textContent);
        if(!home || !away || !score) return;
        home.pj++; away.pj++;
        home.gf += score.home; home.gc += score.away;
        away.gf += score.away; away.gc += score.home;
        if(score.home > score.away){
          home.v++; home.pts += 3; away.p++;
          addForm(home,'W'); addForm(away,'L');
        }else if(score.home < score.away){
          away.v++; away.pts += 3; home.p++;
          addForm(home,'L'); addForm(away,'W');
        }else{
          home.e++; away.e++; home.pts++; away.pts++;
          addForm(home,'D'); addForm(away,'D');
        }
      });
    }

    Object.keys(teams).forEach(function(name){
      var team = teams[name];
      team.dg = team.gf - team.gc;
      var extras = getExtrasForTeam(name);
      team.ta = extras.ta;
      team.tr = extras.tr;
      team.mvp = extras.mvp;
    });

    return Object.keys(teams).map(function(name){ return teams[name]; }).sort(function(a,b){
      if(b.pts !== a.pts) return b.pts - a.pts;
      if(b.dg !== a.dg) return b.dg - a.dg;
      if(b.gf !== a.gf) return b.gf - a.gf;
      return a.name.localeCompare(b.name,'es');
    });
  }

  function formHtml(form){
    var last = form.slice(-5);
    if(!last.length){
      return '<span class="clas-dot pending" title="Sin resultados"></span>';
    }
    return last.map(function(r){
      if(r === 'W') return '<span class="clas-dot win" title="Victoria"></span>';
      if(r === 'D') return '<span class="clas-dot draw" title="Empate"></span>';
      return '<span class="clas-dot loss" title="Derrota"></span>';
    }).join('');
  }

  function rowZoneClass(pos){
    if(pos >= 1 && pos <= 4) return 'zone-ucl';
    if(pos === 5) return 'zone-ucl-prev';
    if(pos === 6 || pos === 7) return 'zone-uel';
    if(pos === 8) return 'zone-conf';
    if(pos >= 17) return 'zone-desc';
    return '';
  }

  var TEAM_DATA = {
    'Arsenal':          {abbr:'ARS', bg:'#ef0107', fg:'#ffffff'},
    'Athletic Club':    {abbr:'ATH', bg:'#cc1010', fg:'#ffffff'},
    'Atlético Madrid':  {abbr:'ATM', bg:'#c50f1f', fg:'#ffffff'},
    'Bayern Munich':    {abbr:'FCB', bg:'#dc052d', fg:'#ffffff'},
    'Celta de Vigo':    {abbr:'CEL', bg:'#6fc6e2', fg:'#003da5'},
    'Elche CF':         {abbr:'ELC', bg:'#006633', fg:'#ffffff'},
    'Espanyol':         {abbr:'ESP', bg:'#003da5', fg:'#ffffff'},
    'FC Barcelona':     {abbr:'BAR', bg:'#a50044', fg:'#edbb00'},
    'Getafe CF':        {abbr:'GET', bg:'#003da5', fg:'#ffffff'},
    'Girona FC':        {abbr:'GIR', bg:'#c8102e', fg:'#ffffff'},
    'Mallorca':         {abbr:'MAL', bg:'#c8102e', fg:'#ffcc00'},
    'Osasuna':          {abbr:'OSA', bg:'#c8102e', fg:'#ffffff'},
    'Rayo Vallecano':   {abbr:'RAY', bg:'#e8000d', fg:'#ffffff'},
    'Real Betis':       {abbr:'BET', bg:'#00a650', fg:'#ffd700'},
    'Real Madrid':      {abbr:'RMA', bg:'#003087', fg:'#f0c040'},
    'Real Sociedad':    {abbr:'RSO', bg:'#003f8a', fg:'#d0dcf4'},
    'Sevilla':          {abbr:'SEV', bg:'#c60b1e', fg:'#ffffff'},
    'Deportivo Alavés': {abbr:'AVS', bg:'#0052a3', fg:'#ffffff'},
    'Valencia CF':      {abbr:'VAL', bg:'#ef7d00', fg:'#ffffff'},
    'Villarreal':       {abbr:'VIL', bg:'#ffd700', fg:'#1a1a1a'}
  };

  // Team logo URLs — rutas locales explícitas (evita fallos por nombres/tildes/espacios)
  window.TEAM_LOGOS = {
    // ── La Liga 1ª ──────────────────────────────────────────
    'Real Madrid':        '/static/img/escudos-1/spain_real-madrid.football-logos.cc.svg',
    'Real Madrid CF':     '/static/img/escudos-1/spain_real-madrid.football-logos.cc.svg',
    'FC Barcelona':       '/static/img/escudos-1/spain_barcelona.football-logos.cc.svg',
    'Barcelona':          '/static/img/escudos-1/spain_barcelona.football-logos.cc.svg',
    'Barça':              '/static/img/escudos-1/spain_barcelona.football-logos.cc.svg',
    'Athletic Club':      '/static/img/escudos-1/spain_athletic-club.football-logos.cc.svg',
    'Real Betis':         '/static/img/escudos-1/spain_real-betis.football-logos.cc.svg',
    'Real Sociedad':      '/static/img/escudos-1/spain_real-sociedad.football-logos.cc.svg',
    'Atlético Madrid':    '/static/img/escudos-1/spain_atletico-madrid.football-logos.cc.svg',
    'Atlético de Madrid': '/static/img/escudos-1/spain_atletico-madrid.football-logos.cc.svg',
    'Atletico de Madrid': '/static/img/escudos-1/spain_atletico-madrid.football-logos.cc.svg',
    'Villarreal':         '/static/img/escudos-1/spain_villarreal.football-logos.cc.svg',
    'Villarreal CF':      '/static/img/escudos-1/spain_villarreal.football-logos.cc.svg',
    'Sevilla':            '/static/img/escudos-1/sevilla-fc.svg',
    'Sevilla FC':         '/static/img/escudos-1/sevilla-fc.svg',
    'Valencia CF':        '/static/img/escudos-1/spain_valencia.football-logos.cc.svg',
    'Girona FC':          '/static/img/escudos-1/spain_girona.football-logos.cc.svg',
    'Rayo Vallecano':     '/static/img/escudos-1/spain_rayo-vallecano.football-logos.cc.svg',
    'Rayo':               '/static/img/escudos-1/spain_rayo-vallecano.football-logos.cc.svg',
    'Getafe CF':          '/static/img/escudos-1/spain_getafe.football-logos.cc.svg',
    'Mallorca':           '/static/img/escudos-1/spain_mallorca.football-logos.cc.svg',
    'Osasuna':            '/static/img/escudos-1/spain_osasuna.football-logos.cc.svg',
    'Espanyol':           '/static/img/escudos-1/spain_espanyol.football-logos.cc.svg',
    'Celta de Vigo':      '/static/img/escudos-1/spain_celta.football-logos.cc.svg',
    'Bayern Munich':      '/static/img/escudos-1/germany_bayern-munchen.football-logos.cc.svg',
    'Bayern de Múnich':   '/static/img/escudos-1/germany_bayern-munchen.football-logos.cc.svg',
    'Arsenal':            '/static/img/escudos-1/england_arsenal.football-logos.cc.svg',
    'Deportivo Alavés': '/static/img/escudos-1/spain_deportivo-alaves.svg',
    'Sporting de Portugal':'/static/img/escudos-1/portugal_sporting-cp.football-logos.cc.svg',
    'PSG':                '/static/img/escudos-1/france_paris-saint-germain.svg',
    'Paris Saint-Germain':'/static/img/escudos-1/france_paris-saint-germain.svg',
    'Elche CF':           '/static/img/escudos-1/spain_elche.football-logos.cc.svg',
    'Elche':              '/static/img/escudos-1/spain_elche.football-logos.cc.svg',
    // ── Liga Hypermotion (2ª) ───────────────────────────────
    'Real Racing Club':   '/static/img/escudos-2/spain_racing.football-logos.cc.svg',
    'RC Deportivo':       '/static/img/escudos-2/spain_deportivo-la-coruna.football-logos.cc.svg',
    'UD Almería':         '/static/img/escudos-2/spain_almeria.football-logos.cc.svg',
    'Málaga CF':          '/static/img/escudos-2/spain_malaga.football-logos.cc.svg',
    'CD Castellón':       '/static/img/escudos-2/spain_castellon.football-logos.cc.svg',
    'UD Las Palmas':      '/static/img/escudos-2/spain_las-palmas.football-logos.cc.svg',
    'Burgos CF':          '/static/img/escudos-2/spain_burgos.football-logos.cc.svg',
    'Real Sporting de Gijón': '/static/img/escudos-2/spain_sporting-gijon.football-logos.cc.svg',
    'Ceuta':              '/static/img/escudos-2/spain_ceuta.football-logos.cc.svg',
    'SD Eibar':           '/static/img/escudos-2/spain_eibar.football-logos.cc.svg',
    'Córdoba CF':         'https://commons.wikimedia.org/wiki/Special:FilePath/C%C3%B3rdoba_CF.svg',
    'Real Sociedad B':    '/static/img/escudos-1/spain_real-sociedad.football-logos.cc.svg',
    'FC Andorra':         '/static/img/escudos-2/spain_fc-andorra.football-logos.cc.svg',
    'Cádiz CF':           '/static/img/escudos-2/spain_cadiz.football-logos.cc.svg',
    'Granada':            '/static/img/escudos-2/spain_granada.football-logos.cc.svg',
    'Albacete BP':        '/static/img/escudos-2/spain_albacete.football-logos.cc.svg',
    'Real Valladolid':    '/static/img/escudos-2/spain_valladolid.football-logos.cc.svg',
    'Leganés':            '/static/img/escudos-2/spain_leganes.football-logos.cc.svg',
    'Huesca':             '/static/img/escudos-2/spain_huesca.football-logos.cc.svg',
    'Deportivo Alavés':   '/static/img/escudos-1/spain_deportivo-alaves.svg',
    'Real Zaragoza':      '/static/img/escudos-2/spain_zaragoza.football-logos.cc.svg',
    'Cultural Leonesa':   '/static/img/escudos-2/spain_cultural-leonesa.football-logos.cc.svg',
    'Mirandés':           '/static/img/escudos-3/spain_mirandes.football-logos.cc.svg',
    // ── Primera Federación ──────────────────────────────────
    'Real Madrid Castilla': '/static/img/escudos-1/spain_real-madrid.football-logos.cc.svg',
    'Ponferradina':       '/static/img/escudos-3/spain_ponferradina.football-logos.cc.svg',
    'CD Lugo':            '/static/img/escudos-2/spain_lugo.football-logos.cc.svg',
    'Celta Fortuna':      '/static/img/escudos-1/spain_celta.football-logos.cc.svg',
    'Cultural Leonesa':   '/static/img/escudos-2/spain_cultural-leonesa.football-logos.cc.svg',
    'Racing Ferrol':      '/static/img/escudos-3/spain_racing-club-ferrol.football-logos.cc.svg',
    'Gimnàstic Tarragona': '/static/img/escudos-3/spain_gimnastic-de-tarragona.football-logos.cc.svg',
    'Osasuna Promesas':   '/static/img/escudos-1/spain_osasuna.football-logos.cc.svg',
    'Bilbao Ath.':        '/static/img/escudos-1/spain_athletic-club.football-logos.cc.svg',
    'Unionistas CF':      '/static/img/escudos-3/spain_unionistas-de-salamanca.football-logos.cc.svg',
    'AD Mérida':          '/static/img/escudos-3/spain_ad-merida.football-logos.cc.svg',
    'Barakaldo':          '/static/img/escudos-3/spain_barakaldo.football-logos.cc.svg',
    'Arenteiro':          '/static/img/escudos-2/spain_cd-arenteiro.football-logos.cc.svg',
    'Zamora CF':          '/static/img/escudos-3/spain_zamora.football-logos.cc.svg',
    'Ourense CF':         '/static/img/escudos-3/spain_ourense-cf.football-logos.cc.svg',
    'CF Talavera':        '/static/img/escudos-3/spain_cf-talavera-de-la-reina.football-logos.cc.svg',
    'CD Guadalajara':     '/static/img/escudos-3/spain_cd-guadalajara.football-logos.cc.svg',
    'CP Cacereño':        '/static/img/escudos-3/spain_cacereno.football-logos.cc.svg',
    'Arenas de Getxo':    '/static/img/escudos-3/spain_arenas-club.football-logos.cc.svg',
    'Real Avilés Industrial': '/static/img/escudos-3/spain_real-aviles-industrial.football-logos.cc.svg',
    'Real Unión':         '/static/img/escudos-3/spain_real-union.football-logos.cc.svg',
    'UD Ibiza':           '/static/img/escudos-2/spain_ud-ibiza.football-logos.cc.svg',
    'Real Murcia':        '/static/img/escudos-3/spain_murcia.football-logos.cc.svg',
    'Eldense':            '/static/img/escudos-3/spain_eldense.football-logos.cc.svg',
    'Hércules CF':        '/static/img/escudos-3/spain_hercules.football-logos.cc.svg',
    'AD Alcorcón':        '/static/img/escudos-3/spain_alcorcon.football-logos.cc.svg',
    'FC Cartagena':       '/static/img/escudos-2/spain_fc-cartagena.football-logos.cc.svg',
    'Villarreal B':       '/static/img/escudos-1/spain_villarreal.football-logos.cc.svg',
    'Marbella FC':        '/static/img/escudos-2/spain_ud-marbella.football-logos.cc.svg',
    'CE Sabadell':        '/static/img/escudos-3/spain_sabadell.football-logos.cc.svg',
    'Betis Deportivo':    '/static/img/escudos-1/spain_real-betis.football-logos.cc.svg',
    'Antequera CF':       '/static/img/escudos-3/spain_antequera.football-logos.cc.svg',
    'Sevilla At.':        '/static/img/escudos-1/sevilla-fc.svg',
    'Sevilla Atlético':   '/static/img/escudos-1/sevilla-fc.svg',
    'Algeciras CF':       '/static/img/escudos-3/spain_algeciras.football-logos.cc.svg',
    'Atlético Madrileño': '/static/img/escudos-1/spain_atletico-madrid.football-logos.cc.svg',
    'At. Sanluqueño':     '/static/img/escudos-3/spain_atletico-sanluqueno.football-logos.cc.svg',
    'CE Europa':          '/static/img/escudos-3/spain_ce-europa.football-logos.cc.svg',
    'SD Tarazona':        '/static/img/escudos-2/spain_tarazona.football-logos.cc.svg',
    'CD Teruel':          '/static/img/escudos-3/spain_teruel.football-logos.cc.svg',
    'Juventud Torremolinos': '/static/img/escudos-2/spain_juventud-torremolinos.football-logos.cc.svg',
    'Estepona':           '/static/img/escudos-fallback/estepona.svg',
    'Recreativo de Huelva': 'https://commons.wikimedia.org/wiki/Special:FilePath/Recreativo_de_Huelva.svg',
    'Mérida AD':          '/static/img/escudos-3/spain_ad-merida.football-logos.cc.svg',
    'Algeciras CF':       '/static/img/escudos-3/spain_algeciras.football-logos.cc.svg',
  };

  function normalizeTeamKey(name){
    return String(name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  var TEAM_LOGOS_NORMALIZED = {};
  Object.keys(window.TEAM_LOGOS || {}).forEach(function(teamName){
    TEAM_LOGOS_NORMALIZED[normalizeTeamKey(teamName)] = window.TEAM_LOGOS[teamName];
  });

  window.getTeamLogoUrl = function(name){
    var aliases = window.TEAM_ALIASES || {};
    var clean = String(name || '').trim();
    var normalizedClean = normalizeTeamKey(clean);
    var canonical = aliases[normalizedClean] || aliases[clean.toLowerCase()] || clean;
    var logos = window.TEAM_LOGOS || {};
    if (logos[canonical]) return logos[canonical];
    if (logos[clean]) return logos[clean];
    if (TEAM_LOGOS_NORMALIZED[normalizeTeamKey(canonical)]) return TEAM_LOGOS_NORMALIZED[normalizeTeamKey(canonical)];
    if (TEAM_LOGOS_NORMALIZED[normalizedClean]) return TEAM_LOGOS_NORMALIZED[normalizedClean];
    var ratings = window.TEAM_RATINGS || {};
    var meta = ratings[canonical] || ratings[clean];
    if (meta && typeof meta === 'object' && meta.shield) return meta.shield;
    return '';
  };

  function getTeamBadgeLabel(name){
    return String(name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9 ]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map(function(part){ return part.charAt(0).toUpperCase(); })
      .join('') || 'CLB';
  }

  window.getTeamBadgeHtml = function(name){
    var logoUrl = window.getTeamLogoUrl ? window.getTeamLogoUrl(name) : '';
    var safeName = String(name || '').trim();
    var fallbackName = safeName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    if (logoUrl) {
      return '<img class="clas-team-logo" src="' + logoUrl + '" onerror="this.outerHTML=window.getTeamBadgeHtml(\'' + fallbackName + '\')" alt="Escudo de ' + safeName.replace(/"/g, '&quot;') + '"/>';
    }
    var aliases = window.TEAM_ALIASES || {};
    var ratings = window.TEAM_RATINGS || {};
    var canonical = aliases[safeName.toLowerCase()] || safeName;
    var meta = ratings[canonical] || ratings[safeName] || {};
    var bg = (meta && meta.color) || '#24324a';
    return '<span class="clas-team-logo clas-team-logo-fallback" role="img" aria-label="Escudo de ' + safeName.replace(/"/g, '&quot;') + '" style="background:' + bg + ';">' + getTeamBadgeLabel(safeName) + '</span>';
  };

  var SHORT_NAMES = {
    'Bayern Munich':    'Bayern',
    'Atlético Madrid':  'Atl Madrid',
    'Celta de Vigo':    'Celta',
    'Elche CF':         'Elche',
    'Rayo Vallecano':   'Rayo',
    'Deportivo Alavés': 'Alavés',
    'Valencia CF':      'Valencia'
  };
  var HUMAN_TEAMS = {
    'Bayern Munich':    '💡',
    'Arsenal':          '🐭',
    'Atlético Madrid':  '✏️',
    'Real Madrid':      '🔨',
    'FC Barcelona':     '👿'
  };

  function buildLigaClas(){
    var list = collectStandings();
    var el = document.getElementById('clas-liga-content');
    if(!el) return;

  var html = ''
      + '<div class="clas-legend">'
      +   '<span class="clas-legend-item"><span class="clas-legend-dot" style="background:#3160ff"></span>🔵 Champions</span>'
      +   '<span class="clas-legend-item"><span class="clas-legend-dot" style="background:#a855f7"></span>🟣 Previa Ch.</span>'
      +   '<span class="clas-legend-item"><span class="clas-legend-dot" style="background:#ff8214"></span>🟠 E.League</span>'
      +   '<span class="clas-legend-item"><span class="clas-legend-dot" style="background:#3cc878"></span>🟢 Conference</span>'
      +   '<span class="clas-legend-item"><span class="clas-legend-dot" style="background:#e03c3c"></span>🔴 Descenso</span>'
      + '</div>'
      + '<div class="clas-scroll-outer">'
      +   '<div class="clas-hdr-scroll" id="clas-hdr-scroll">'
      +     '<div class="clas-table">'
      +       '<div class="clas-hdr">'
      +         '<span class="clas-hdr-team">Equipo</span><span>PTS</span><span>PJ</span><span>V</span><span>E</span><span>P</span><span>GF</span><span>GC</span><span>DG</span><span>TA</span><span>TR</span><span>MVP</span><span>%</span><span>Últ. 5</span>'
      +       '</div>'
      +     '</div>'
      +   '</div>'
      +   '<div class="clas-scroll" id="clas-body-scroll">'
      +     '<div class="clas-table">';

    list.forEach(function(team, idx){
      var pos = idx + 1;
      var zone = rowZoneClass(pos);
      var dgClass = 'clas-val dg ' + (team.dg > 0 ? 'pos' : team.dg < 0 ? 'neg' : 'zer');
      html += ''
        + '<div class="clas-row ' + zone + '">'
        +   '<div class="clas-team-cell">'
        +     '<span class="clas-pos-n">' + pos + '</span>'
        +     '<span class="clas-team-name">' + (HUMAN_TEAMS[team.name] ? '<span class="human-prefix">' + HUMAN_TEAMS[team.name] + '</span>' : '') + (SHORT_NAMES[team.name] || team.name) + '</span>'
        +   '</div>'
        +   '<div class="clas-pts">' + team.pts + '</div>'
        +   '<div class="clas-pj">' + team.pj + '</div>'
        +   '<div class="clas-val">' + team.v + '</div>'
        +   '<div class="clas-val">' + team.e + '</div>'
        +   '<div class="clas-val">' + team.p + '</div>'
        +   '<div class="clas-val gf">' + team.gf + '</div>'
        +   '<div class="clas-val gc">' + team.gc + '</div>'
        +   '<div class="' + dgClass + '">' + (team.dg > 0 ? '+' : '') + team.dg + '</div>'
        +   '<div class="clas-val ta">' + team.ta + '</div>'
        +   '<div class="clas-val tr">' + team.tr + '</div>'
        +   '<div class="clas-mvp">' + team.mvp + '</div>'
        +   '<div class="clas-pct">' + (team.pj > 0 ? Math.round((team.v / team.pj) * 100) : 0) + '%</div>'
        +   '<div class="clas-form">' + formHtml(team.form) + '</div>'
        + '</div>';
    });

    html += '    </div>'   // clas-table
      +   '</div>'         // clas-scroll
      + '</div>';          // clas-scroll-outer

    el.innerHTML = html;

    // Sincronizar scroll horizontal header <-> body
    var hdrScroll = document.getElementById('clas-hdr-scroll');
    var bodyScroll = document.getElementById('clas-body-scroll');
    if(hdrScroll && bodyScroll){
      bodyScroll.addEventListener('scroll', function(){ hdrScroll.scrollLeft = bodyScroll.scrollLeft; });
    }
  }

  window.buildLigaClas = buildLigaClas;
  window.collectStandings = collectStandings;
  document.addEventListener('DOMContentLoaded', buildLigaClas);

  var leagueObserverBound = false;
  function bindLeagueObserver(){
    if(leagueObserverBound || typeof MutationObserver === 'undefined') return;
    var root = document.getElementById('s-liga-cal');
    if(!root) return;
    var observer = new MutationObserver(function(){ buildLigaClas(); });
    observer.observe(root, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['class']});
    leagueObserverBound = true;
  }
  bindLeagueObserver();
})();


/* script block 13 */

(function(){
  var SCREEN_TEAM_FALLBACK = {
    's-munich': 'Bayern Munich',
    's-arsenal': 'Arsenal',
    's-sporting': 'Sporting CP',
    's-madrid': 'Real Madrid',
    's-barca': 'FC Barcelona',
    's-atletico': 'Atlético Madrid',
    's-albacete': 'Albacete BP',
    's-villarreal': 'Villarreal CF',
    's-sevilla': 'Sevilla FC',
    's-espanyol': 'Espanyol',
    's-getafe': 'Getafe CF',
    'celta-screen': 'Celta de Vigo',
    'osasuna-screen': 'Osasuna',
    'alaves-screen': 'Deportivo Alavés',
    'girona-screen': 'Girona FC',
    'oviedo-screen': 'Real Oviedo',
    'levante-screen': 'Levante UD',
    'mallorca-screen': 'Mallorca',
    'elche-screen': 'Elche CF',
    'valencia-screen': 'Valencia CF',
    'rayo-screen': 'Rayo Vallecano',
    'athletic-screen': 'Athletic Club',
    'betis-screen': 'Real Betis',
    'sociedad-screen': 'Real Sociedad'
  };



var STAT_CLASS_MAP = {
    'gol': 'ps-gol',
    'yel': 'ps-yel',
    'red': 'ps-red',
    'mvp': 'ps-mvp',
    'pen-prov': 'ps-pen-prov',
    'pen-parado': 'ps-pen-parado',
    'pen-gol': 'ps-pen-gol',
    'falta-gol': 'ps-falta-gol',
    'propia': 'ps-propia',
    'pen-fallado': 'ps-pen-fallado'
  };

  var LIGA_STAT_CATEGORIES = [
    { key:'goles-total', title:'Goleadores',            icon:'⚽️', top:6 },
    { key:'yel',         title:'Tarjetas amarillas',    icon:'🟨', top:6 },
    { key:'red',         title:'Tarjetas rojas',        icon:'🟥', top:6 },
    { key:'pen-prov',    title:'Penaltis provocados',   icon:'🤦‍♂️🥅', top:6 },
    { key:'pen-gol',     title:'Goles de penalti',      icon:'⚽🥅', top:6 },
    { key:'pen-fallado', title:'Penaltis fallados',     icon:'❌️🥅', top:6 },
    { key:'pen-parado',  title:'Penaltis parados',      icon:'🖐🥅', top:6 },
    { key:'falta-gol',   title:'Goles de falta',        icon:'⚽🎯', top:6 },
    { key:'propia',      title:'Autogoles',             icon:'⚽🚫', top:6 },
    { key:'mvp',         title:'MVP',                   icon:'⭐️', top:6 }
  ];

  function normalizeText(str){
    return String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function canonicalTeamName(name){
    var key = normalizeText(name);
    return (window.TEAM_ALIASES||{})[key] || String(name || '').trim();
  }

  function ensureExtraStatSpans(){
    document.querySelectorAll('.plant-row').forEach(function(row){
      ['ps-pen-fallado'].forEach(function(cls){
        if(row.querySelector('.' + cls)) return;
        var span = document.createElement('span');
        span.className = cls;
        span.hidden = true;
        span.setAttribute('data-global', '0');
        span.setAttribute('data-liga', '0');
        span.setAttribute('data-copa', '0');
        span.setAttribute('data-ucl', '0');
        span.setAttribute('data-uecl', '0');
        span.setAttribute('data-europa', '0');
        span.setAttribute('data-super', '0');
        row.appendChild(span);
      });
    });
  }

  function getPlantillaScreens(){
    ensureExtraStatSpans();
    var out = [];
    document.querySelectorAll('.screen[id]').forEach(function(screen){
      var rows = screen.querySelectorAll('.plant-row');
      if(!rows.length) return;
      var team = SCREEN_TEAM_FALLBACK[screen.id] || '';
      if(!team){
        var h2 = screen.querySelector('.sec-hdr h2');
        if(h2) team = h2.textContent.trim();
      }
      team = canonicalTeamName(team);
      out.push({ id: screen.id, team: team, rows: rows });
    });
    return out;
  }

  function getRosterIndex(){
    var idx = {};
    getPlantillaScreens().forEach(function(screen){
      Array.prototype.forEach.call(screen.rows, function(row){
        var nameEl = row.querySelector('.plant-name');
        if(!nameEl) return;
        var key = canonicalTeamName(screen.team) + '::' + normalizeText(nameEl.textContent);
        idx[key] = row;
      });
    });
    return idx;
  }

  function ensureStatSpan(row, key){
    var cls = STAT_CLASS_MAP[key];
    if(!cls) return null;
    var span = row.querySelector('.' + cls);
    if(!span){
      span = document.createElement('span');
      span.className = cls;
      span.hidden = true;
      span.setAttribute('data-global', '0');
      span.setAttribute('data-liga', '0');
      row.appendChild(span);
    }
    return span;
  }

  function setLigaStat(row, key, amount){
    amount = Number(amount || 0);
    if(!amount) return;
    var span = ensureStatSpan(row, key);
    if(!span) return;
    var liga = Number(span.getAttribute('data-liga') || 0);
    span.setAttribute('data-liga', String(liga + amount));

    if(key === 'pen-gol' || key === 'pen-fallado'){
      var penSpan = ensureStatSpan(row, 'pen-gol');
      var tirado = Number(penSpan.getAttribute('data-tirado') || 0);
      penSpan.setAttribute('data-tirado', String(tirado + amount));
    }
    if(key === 'pen-parado'){
      var stopSpan = ensureStatSpan(row, 'pen-parado');
      var faced = Number(stopSpan.getAttribute('data-tirado') || 0);
      stopSpan.setAttribute('data-tirado', String(faced + amount));
    }
  }

  function resetLigaPlayerStats(){
    ensureExtraStatSpans();
    document.querySelectorAll('.plant-row').forEach(function(row){
      Object.keys(STAT_CLASS_MAP).forEach(function(key){
        var span = row.querySelector('.' + STAT_CLASS_MAP[key]);
        if(span) span.setAttribute('data-liga', '0');
      });
      var penGoal = row.querySelector('.ps-pen-gol');
      var penStop = row.querySelector('.ps-pen-parado');
      if(penGoal) penGoal.setAttribute('data-tirado', '0');
      if(penStop) penStop.setAttribute('data-tirado', '0');
    });
  }

  var LIGA_PLAYER_MATCH_STORE = window.LIGA_PLAYER_MATCH_STORE || {};
  window.LIGA_PLAYER_MATCH_STORE = LIGA_PLAYER_MATCH_STORE;

  function applyEventToRoster(roster, teamName, playerName, type, ico){
    teamName = canonicalTeamName(teamName);
    playerName = String(playerName || '').replace(/^\s*\d+\.?\s*/, '').trim();
    if(!teamName || !playerName) return;
    var row = roster[teamName + '::' + normalizeText(playerName)];
    if(!row) return;

    if(type === 'gol') setLigaStat(row, 'gol', 1);
    else if(type === 'falta-gol') setLigaStat(row, 'falta-gol', 1);
    else if(type === 'pen-gol') setLigaStat(row, 'pen-gol', 1);
    else if(type === 'pen-fallo') setLigaStat(row, 'pen-fallado', 1);
    else if(type === 'pen-parado') setLigaStat(row, 'pen-parado', 1);
    else if(type === 'pen-prov') setLigaStat(row, 'pen-prov', 1);
    else if(type === 'propia') setLigaStat(row, 'propia', 1);
    else if(type === 'mvp') setLigaStat(row, 'mvp', 1);
    else if(type === 'card'){
      if(ico === '🟨') setLigaStat(row, 'yel', 1);
      else if(ico === '🟥') setLigaStat(row, 'red', 1);
      else if(ico === '🟨🟥'){
        // Doble amarilla: la amarilla previa del jugador en este partido ya fue contada como yel.
        // Se cancela restando 1 yel, y se registra solo como expulsión (red).
        setLigaStat(row, 'yel', -1);
        setLigaStat(row, 'red', 1);
      }
    }
  }

  function rebuildLigaPlayerStats(){
    resetLigaPlayerStats();
    var roster = getRosterIndex();
    var processedMatches = {};

    function normalizeIcon(ico){
      return String(ico || '').replace(/️/g, '').trim();
    }

    function parseEventTypeFromIcon(ico){
      ico = normalizeIcon(ico);
      if(ico === '⚽' || ico === '⚽️') return 'gol';
      if(ico === '🟨' || ico === '🟥' || ico === '🟨🟥') return 'card';
      if(ico === '🤦🥅' || ico === '🤦‍♂🥅' || ico === '🤦‍♂️🥅') return 'pen-prov';
      if(ico === '⚽🥅') return 'pen-gol';
      if(ico === '❌🥅' || ico === '❌️🥅') return 'pen-fallo';
      if(ico === '🖐🥅') return 'pen-parado';
      if(ico === '⚽🎯') return 'falta-gol';
      if(ico === '⚽🚫') return 'propia';
      if(ico === '⭐' || ico === '⭐️') return 'mvp';
      return null;
    }

    function applyStoredMatch(matchKey, data){
      if(!data || processedMatches[matchKey]) return;
      processedMatches[matchKey] = true;
      (data.evts || []).forEach(function(ev){
        var ico = normalizeIcon(ev && ev.ico);
        var type = ev && ev.type ? ev.type : parseEventTypeFromIcon(ico);
        if(type === 'amarilla' || type === 'roja' || type === 'd-amarilla') type = 'card';
        if(type === 'pen-fallado') type = 'pen-fallo';
        if(!type) type = parseEventTypeFromIcon(ico);
        if(!type) return;

        var playerName = '';
        if(Array.isArray(ev && ev.player)) playerName = ev.player[1] || ev.player[0] || '';
        else playerName = (ev && (ev.name || ev.playerName || ev.jugador)) || '';
        playerName = String(playerName || '').replace(/^\s*\d+\.?\s*/, '').trim();
        if(!playerName) return;

        var teamName = canonicalTeamName((ev && (ev.realTeam || ev.teamName || ev.team_label)) || '');
        if(!teamName){
          if(ev && ev.team === 'a') teamName = canonicalTeamName(data.teamA || '');
          else if(ev && ev.team === 'b') teamName = canonicalTeamName(data.teamB || '');
          else teamName = canonicalTeamName(ev && ev.team || '');
        }
        if(!teamName) return;
        applyEventToRoster(roster, teamName, playerName, type, ico);
      });

      // MVP ya viene dentro de data.evts como type:'mvp' — NO aplicar de nuevo desde mvpName/mvpTeam
      // para evitar doble conteo
    }

    Object.keys(LIGA_PLAYER_MATCH_STORE).forEach(function(matchKey){
      applyStoredMatch(matchKey, LIGA_PLAYER_MATCH_STORE[matchKey]);
    });

    document.querySelectorAll('[id^="ml-acta-list-j"]').forEach(function(list){
      var wrap = list.closest('.match-live-wrap');
      var matchKey = '';
      if(wrap && wrap.id) matchKey = wrap.id.replace(/^mlw-/, '');
      if(matchKey && processedMatches[matchKey]) return;

      var teamA = '';
      var teamB = '';
      if(matchKey){
        var aEl = document.getElementById('ml-team-a-' + matchKey);
        var bEl = document.getElementById('ml-team-b-' + matchKey);
        if(aEl) teamA = canonicalTeamName(aEl.textContent.trim());
        if(bEl) teamB = canonicalTeamName(bEl.textContent.trim());
      }

      list.querySelectorAll('.ml-evt-item').forEach(function(item){
        var icoEl = item.querySelector('.ml-evt-ico');
        var nameEl = item.querySelector('.ml-evt-name');
        var teamEl = item.querySelector('.ml-evt-team');
        if(!icoEl || !nameEl) return;

        var ico = normalizeIcon(icoEl.textContent);
        var type = parseEventTypeFromIcon(ico);
        if(!type) return;

        var playerName = String(nameEl.textContent || '')
          .replace(/^\s*\d+\.?\s*/, '')
          .replace(/\s*\(\d+⚽\)\s*$/, '')
          .trim();

        var teamName = canonicalTeamName(teamEl ? teamEl.textContent.trim() : '');
        if(!teamName){
          var keyA = teamA + '::' + normalizeText(playerName);
          var keyB = teamB + '::' + normalizeText(playerName);
          if(teamA && roster[keyA]) teamName = teamA;
          else if(teamB && roster[keyB]) teamName = teamB;
        }

        if(!teamName) return;
        applyEventToRoster(roster, teamName, playerName, type, ico);
      });
    });

    buildLigaStatsDashboard();
  }

  window.registrarLigaPlayerStats = function(matchKey, teamA, teamB, evts, mvpName, mvpTeam){
    LIGA_PLAYER_MATCH_STORE[matchKey] = {
      teamA: canonicalTeamName(teamA),
      teamB: canonicalTeamName(teamB),
      evts: (evts || []).map(function(ev){
        var copy = {};
        Object.keys(ev || {}).forEach(function(k){ copy[k] = ev[k]; });
        copy.realTeam = canonicalTeamName(ev && ev.team === 'a' ? teamA : ev && ev.team === 'b' ? teamB : (ev && ev.realTeam) || '');
        return copy;
      }),
      mvpName: mvpName || '',
      mvpTeam: canonicalTeamName(mvpTeam || '')
    };
    rebuildLigaPlayerStats();
    // Also run the fixed version (block 24) for individual player stats
    if (typeof window.rebuildLigaPlayerStatsFixed === 'function') {
      window.rebuildLigaPlayerStatsFixed();
    }
  };

  function getLigaStatFromRow(row, key){
    function valueFor(statKey){
      var cls = STAT_CLASS_MAP[statKey];
      var statEl = cls ? row.querySelector('.' + cls) : null;
      return statEl ? Number(statEl.getAttribute('data-liga') || 0) : 0;
    }
    if(key === 'goles-total'){
      return valueFor('gol') + valueFor('pen-gol') + valueFor('falta-gol');
    }
    return valueFor(key);
  }

  function collectLigaPlayerStats(){
    var players = [];
    getPlantillaScreens().forEach(function(screen){
      Array.prototype.forEach.call(screen.rows, function(row){
        var nameEl = row.querySelector('.plant-name');
        if(!nameEl) return;
        var stats = {};
        LIGA_STAT_CATEGORIES.forEach(function(cat){
          stats[cat.key] = getLigaStatFromRow(row, cat.key);
        });
        players.push({
          team: canonicalTeamName(screen.team),
          name: nameEl.textContent.trim(),
          stats: stats
        });
      });
    });
    return players;
  }

  function topPlayersByStat(players, key, limit){
    return players
      .map(function(p){
        return { name: p.name, team: p.team, value: Number(p.stats[key] || 0) };
      })
      .filter(function(p){ return p.value > 0; })
      .sort(function(a,b){
        if(b.value !== a.value) return b.value - a.value;
        if(a.team !== b.team) return a.team.localeCompare(b.team, 'es');
        return a.name.localeCompare(b.name, 'es');
      })
      .slice(0, limit);
  }

  function buildLigaStatsDashboard(){
    var root = document.getElementById('liga-stats-dashboard');
    if(!root) return;
    var players = collectLigaPlayerStats();
    var html = '';

    function escapeHtml(str){
      return String(str == null ? '' : str)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;');
    }

    function renderRows(rows, startIndex){
      return rows.map(function(item, idx){
        return '<div class="liga-stat-row"><div class="liga-stat-rank">' + (startIndex + idx) + '</div><div class="liga-stat-player"><div class="liga-stat-name">' + escapeHtml(item.name) + '</div><div class="liga-stat-team">' + escapeHtml(item.team) + '</div></div><div class="liga-stat-value">' + item.value + '</div></div>';
      }).join('');
    }

    LIGA_STAT_CATEGORIES.forEach(function(cat){
      var allRows = topPlayersByStat(players, cat.key, 9999);
      var top = allRows.slice(0, 6);
      var rest = allRows.slice(6);
      html += '<div class="liga-stat-card"><div class="liga-stat-head"><div class="liga-stat-ico">' + cat.icon + '</div><div class="liga-stat-title">' + cat.title + '</div></div><div class="liga-stat-body">';
      if(!allRows.length){
        html += '<div class="liga-stat-empty">Sin datos todavía</div>';
      } else {
        html += renderRows(top, 1);
        if(rest.length){
          html += '<details class="liga-stat-more"><summary>Ver todos (' + allRows.length + ')</summary><div class="liga-stat-more-list">' + renderRows(rest, 7) + '</div></details>';
        }
      }
      html += '</div></div>';
    });
    root.innerHTML = html;
  }

  window.buildLigaStatsDashboard = buildLigaStatsDashboard;
  document.addEventListener('DOMContentLoaded', function(){
    ensureExtraStatSpans();
    buildLigaStatsDashboard();
  });

  var ligaStatsObserverBound = false;
  function bindLigaStatsObserver(){
    if(ligaStatsObserverBound || typeof MutationObserver === 'undefined') return;
    var targets = [document.getElementById('s-liga-cal')].concat(
      getPlantillaScreens().map(function(x){ return document.getElementById(x.id); })
    ).filter(Boolean);

    if(!targets.length) return;

    var observer = new MutationObserver(function(){
      buildLigaStatsDashboard();
    });

    targets.forEach(function(t){
      observer.observe(t, { childList:true, subtree:true, characterData:true, attributes:true });
    });
    ligaStatsObserverBound = true;
  }

  bindLigaStatsObserver();
})();


/* script block 14 */
function go(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); var el = document.getElementById(id); if (el) { el.classList.add('active'); window.scrollTo(0,0); } } function entTog(id) { var body = document.getElementById(id); var arr = document.getElementById(id + '-arr'); if (!body) return; var isOpen = body.classList.contains('open'); body.classList.toggle('open'); if (arr) arr.classList.toggle('open', !isOpen); } function subTog(id) { var body = document.getElementById(id); var arr = document.getElementById(id + '-arr'); if (!body) return; body.classList.toggle('open'); if (arr) arr.classList.toggle('open'); } function derbyTog(id) { var body = document.getElementById(id); var arr = document.getElementById(id + '-arr'); var btn = document.getElementById(id + '-btn'); if (!body) return; body.classList.toggle('open'); if (arr) arr.classList.toggle('open'); if (btn) btn.classList.toggle('open'); } var athPrevSuperado = false; function athObjCount() { var items = document.querySelectorAll('#ath-obj-club .obj-item'); var total = items.length; var done = 0; items.forEach(function(lbl) { var cb = lbl.querySelector('input[type=checkbox]'); if (cb && cb.checked) { done++; lbl.classList.add('done'); } else { lbl.classList.remove('done'); } }); var countEl = document.getElementById('ath-obj-count'); if (countEl) countEl.textContent = done + ' / ' + total; var PTS_POR_OBJ = 0.40; var MONEY_POR_OBJ = 40; var MAX_PTS = 8.50; var MAX_MONEY = 850; var pts = parseFloat((done * PTS_POR_OBJ).toFixed(2)); var money = done * MONEY_POR_OBJ; var pctPts = Math.min(100, (pts / MAX_PTS) * 100); var pctMoney = Math.min(100, (money / MAX_MONEY) * 100); var superadoPts = pts >= MAX_PTS; var superadoMoney = money >= MAX_MONEY; var superadoAmbos = superadoPts && superadoMoney; var ptsEl = document.getElementById('ath-pts-val'); var moneyEl = document.getElementById('ath-money-val'); if (ptsEl) { ptsEl.textContent = pts.toFixed(2); ptsEl.classList.remove('pulse'); void ptsEl.offsetWidth; ptsEl.classList.add('pulse'); ptsEl.classList.toggle('superado', superadoPts); } if (moneyEl) { moneyEl.textContent = money; moneyEl.classList.remove('pulse'); void moneyEl.offsetWidth; moneyEl.classList.add('pulse'); moneyEl.classList.toggle('superado', superadoMoney); } var tPts = document.getElementById('ath-pts-target'); var tMoney = document.getElementById('ath-money-target'); if (tPts) tPts.classList.toggle('superado', superadoPts); if (tMoney) tMoney.classList.toggle('superado', superadoMoney); var barPts = document.getElementById('ath-bar-pts'); var barMoney = document.getElementById('ath-bar-money'); if (barPts) { barPts.style.width = pctPts + '%'; barPts.classList.toggle('superado', superadoPts); } if (barMoney) { barMoney.style.width = pctMoney + '%'; barMoney.classList.toggle('superado', superadoMoney); } if (superadoAmbos) { if (!athPrevSuperado) { athPrevSuperado = true; setTimeout(function() { if (typeof lanzarFuegos === 'function') lanzarFuegos(3500); }, 300); } else { setTimeout(function() { if (typeof lanzarFuegos === 'function') lanzarFuegos(2500); }, 150); } } else { athPrevSuperado = false; } } var athPlantComp = 'global'; function athSetComp(comp) { athPlantComp = comp; document.querySelectorAll('.plant-filter-btn').forEach(function(b) { b.classList.toggle('active', b.dataset.comp === comp); }); document.querySelectorAll('.plant-row').forEach(function(row) { var tipos = row.classList.contains('por') ? ['gol','yel','red','mvp','poder','pen-parado','pen-prov','pen-gol','falta-gol','propia'] : ['gol','yel','red','mvp','poder','pen-gol','pen-prov','pen-parado','falta-gol','propia']; var cols = row.querySelectorAll('.plant-stat'); tipos.forEach(function(tipo, i) { var el = row.querySelector('.ps-' + tipo); if (!el || !cols[i]) return; var v = parseInt(el.getAttribute('data-' + comp) || el.getAttribute('data-global') || '0'); cols[i].textContent = v; cols[i].className = 'plant-stat' + (v > 0 ? (' ' + tipo) : ' zero'); if (el) el.setAttribute('data-' + comp, v); }); var anyActive = Array.from(row.querySelectorAll('.plant-stat')).some(function(c){ return !c.classList.contains('zero'); }); row.classList.toggle('has-stat', anyActive); }); } function tog(id) { var el = document.getElementById(id); if (!el) return; if (id === 'comp-box') { var isOpen = el.style.display !== 'none' && el.style.display !== ''; el.style.display = isOpen ? 'none' : 'block'; var arr = document.getElementById('comp-arr'); if (arr) arr.style.transform = isOpen ? '' : 'rotate(180deg)'; } else { el.classList.toggle('open'); } }

/* script block 15 */

var atmPrevSuperado = false;
function atmSetComp(comp) {
  document.querySelectorAll('#s-atletico .plant-row').forEach(function(row){
    var tipos = row.classList.contains('por') ? ['gol','yel','red','mvp','poder','pen-parado','pen-prov','pen-gol','falta-gol','propia'] : ['gol','yel','red','mvp','poder','pen-gol','pen-prov','pen-parado','falta-gol','propia'];
    tipos.forEach(function(tipo){
      var el = row.querySelector('.ps-'+tipo);
      if(!el) return;
      var col = el.closest('.plant-stat');
      if(!col) return;
      var v = parseInt(el.getAttribute('data-'+comp)||el.getAttribute('data-global')||'0');
      col.textContent = (tipo === 'pen-parado' || tipo === 'pen-gol') ? v+'/'+parseInt(el.getAttribute('data-tirado')||'0') : v;
      col.className = 'plant-stat'+(v>0?(' '+tipo):' zero');
    });
  });
}
var atmPlantComp = 'global';


/* script block 16 */
var fwCanvas = document.getElementById('fireworks-canvas'); var fwCtx = fwCanvas ? fwCanvas.getContext('2d') : null; var fwParticles = []; var fwRunning = false; var fwTimer = null; function fwResize() { if (!fwCanvas) return; fwCanvas.width = window.innerWidth; fwCanvas.height = window.innerHeight; } window.addEventListener('resize', fwResize); function fwCreateBurst(x, y) { var colors = ['#f0c040','#4fc86a','#ff6060','#60b0ff','#ff80ff','#ffffff','#ffaa20']; for (var i = 0; i < 60; i++) { var angle = (Math.PI * 2 / 60) * i + Math.random() * 0.3; var speed = 2 + Math.random() * 5; fwParticles.push({ x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, alpha: 1, size: 2 + Math.random() * 3, color: colors[Math.floor(Math.random() * colors.length)], decay: 0.012 + Math.random() * 0.012 }); } } function fwLoop() { if (!fwRunning || !fwCtx) return; fwCtx.clearRect(0, 0, fwCanvas.width, fwCanvas.height); fwParticles = fwParticles.filter(function(p) { return p.alpha > 0.02; }); fwParticles.forEach(function(p) { p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.vx *= 0.99; p.alpha -= p.decay; fwCtx.save(); fwCtx.globalAlpha = Math.max(0, p.alpha); fwCtx.fillStyle = p.color; fwCtx.shadowBlur = 6; fwCtx.shadowColor = p.color; fwCtx.beginPath(); fwCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2); fwCtx.fill(); fwCtx.restore(); }); requestAnimationFrame(fwLoop); } var fwBurstInterval = null; function lanzarFuegos(duracion) { if (!fwCanvas || !fwCtx) return; fwResize(); fwCanvas.style.display = 'block'; var overlay = document.getElementById('celebracion-overlay'); if (overlay) { overlay.style.display = 'flex'; } fwRunning = true; fwParticles = []; fwLoop(); var w = fwCanvas.width; var h = fwCanvas.height; fwBurstInterval = setInterval(function() { var x = 0.15 * w + Math.random() * 0.7 * w; var y = 0.1 * h + Math.random() * 0.6 * h; fwCreateBurst(x, y); }, 220); setTimeout(function() { clearInterval(fwBurstInterval); fwRunning = false; setTimeout(function() { fwCanvas.style.display = 'none'; if (overlay) overlay.style.display = 'none'; }, 1200); }, duracion || 3000); }
function triggerShootingBall(gf, team) {
  var ball = gf.querySelector('.ml-shooting-ball');
  if (!ball) return;
  // Direction: team 'a' = left side → ball goes LEFT (right-to-left)
  // team 'b' = right side → ball goes RIGHT (left-to-right, default)
  ball.classList.remove('shoot','shoot-left','shoot-right');
  ball.style.animation = 'none';
  void ball.offsetWidth;
  var goLeft = (team === 'a');
  ball.style.animation = '';
  if (goLeft) {
    ball.style.cssText = 'position:absolute;font-size:28px;opacity:0;filter:drop-shadow(0 0 8px rgba(255,220,50,0.9)) drop-shadow(0 0 20px rgba(255,180,0,0.7));pointer-events:none;animation:shootBallLeft 2.8s cubic-bezier(.18,.7,.42,.98) forwards;right:-80px;left:auto;top:-40%;';
  } else {
    ball.style.cssText = 'position:absolute;font-size:28px;opacity:0;filter:drop-shadow(0 0 8px rgba(255,220,50,0.9)) drop-shadow(0 0 20px rgba(255,180,0,0.7));pointer-events:none;animation:shootBallRight 2.8s cubic-bezier(.18,.7,.42,.98) forwards;left:-80px;top:110%;';
  }
  setTimeout(function(){
    ball.style.cssText = 'position:absolute;font-size:28px;opacity:0;filter:drop-shadow(0 0 8px rgba(255,220,50,0.9)) drop-shadow(0 0 20px rgba(255,180,0,0.7));pointer-events:none;';
  }, 3100);
}

/* script block 17 */
window.addEventListener('scroll',function(){ var b=document.getElementById('goto-top'); if(window.scrollY>300)b.classList.add('show'); else b.classList.remove('show'); }); var _origGo=window.go; window.go=function(id){ if(_origGo)_origGo(id); else{document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');}); var el=document.getElementById(id);if(el)el.classList.add('active');} if(id==='s-liga-clas' && typeof window.buildLigaClas==='function'){ window.buildLigaClas(); } if(id==='s-liga-stats' && typeof window.buildLigaStatsDashboard==='function'){ window.buildLigaStatsDashboard(); } };

/* script block 18 */
function showChampionsIntro() { var overlay = document.getElementById('ucl-intro'); if (!overlay) return; overlay.classList.add('show'); setTimeout(function(){ overlay.classList.remove('show'); }, 1300); } var _origGoChamp = window.go; window.go = function(id) { if (id === 's-champions') { showChampionsIntro(); } if (_origGoChamp) _origGoChamp(id); else { document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');}); var el = document.getElementById(id); if(el) el.classList.add('active'); } };

/* script block 19 */
var _compSoundMap = { 's-champions': { snd:'snd-ucl', flash:'flash-ucl' }, 's-superliga': { snd:'snd-kdb', flash:'flash-kdb' } }; var _lastCompScreen = null; function playCompSound(targetId) { var cfg = _compSoundMap[targetId]; if (!cfg) return; var snd = document.getElementById(cfg.snd); if (snd) { snd.currentTime = 0; snd.play().catch(function(){}); } var fl = document.getElementById('comp-flash'); if (fl) { fl.className = ''; fl.style.display = 'block'; fl.offsetWidth; fl.className = cfg.flash; setTimeout(function(){ fl.style.display='none'; fl.className=''; }, 950); } } function goWithSound(id, sndKey) { var fromId = _lastCompScreen; _lastCompScreen = id; if (fromId !== id) { var cfg = _compSoundMap[id]; if (cfg) playCompSound(id); } go(id); } var _prevGoFn = window.go; window.go = function(id) { var prev = _lastCompScreen; if (_compSoundMap[id]) { if (prev !== id) { playCompSound(id); } } _lastCompScreen = id; if (_prevGoFn) _prevGoFn(id); else { document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');}); var el=document.getElementById(id); if(el)el.classList.add('active'); } };

/* script block 20 */

(function(){
  var LIGA_TEAMS_EQ = [
    {name:"Real Madrid",     ico:"⚪",  screen:"s-madrid"},
    {name:"FC Barcelona",    ico:"🔵",  screen:"s-barca"},
    {name:"Athletic Club",   ico:"🔴",  screen:"athletic-screen"},
    {name:"Atlético Madrid", ico:"🔴",  screen:"s-atletico"},
    {name:"Real Betis",      ico:"🟢",  screen:"betis-screen"},
    {name:"Real Sociedad",   ico:"🔵",  screen:"sociedad-screen"},
    {name:"Sevilla FC",      ico:"⚪",  screen:"s-sevilla"},
    {name:"Villarreal CF",   ico:"🟡",  screen:"s-villarreal"},
    {name:"Getafe CF",       ico:"🔵",  screen:"s-getafe"},
    {name:"Osasuna",         ico:"🔴",  screen:"osasuna-screen"},
    {name:"Valencia CF",     ico:"🦇",  screen:"valencia-screen"},
    {name:"Celta de Vigo",   ico:"🔵",  screen:"celta-screen"},
    {name:"Mallorca",        ico:"🔴",  screen:"mallorca-screen"},
    {name:"Girona FC",       ico:"🔴",  screen:"girona-screen"},
    {name:"Espanyol",        ico:"🔵",  screen:"s-espanyol"},
    {name:"Arsenal",         ico:"🔴",  screen:"s-arsenal"},
    {name:"Rayo Vallecano",  ico:"⚪",  screen:"rayo-screen"},
    {name:"Elche CF",        ico:"🟢",  screen:"elche-screen"},
    {name:"Bayern Munich",   ico:"🔴",  screen:"s-munich"},
    {name:"Deportivo Alavés",ico:"🔵",  screen:"alaves-screen"}
  ];

  var grid = document.getElementById('equipos-grid');
  LIGA_TEAMS_EQ.forEach(function(t){
    var card = document.createElement('div');
    card.className = 'eq-ov-card';
    if(t.screen){
      card.style.borderColor = 'rgba(240,192,64,.2)';
    }
    var logo = window.getTeamLogoUrl ? window.getTeamLogoUrl(t.name) : ((window.TEAM_LOGOS && window.TEAM_LOGOS[t.name]) || '');
    var rating = window.TEAM_RATINGS && window.TEAM_RATINGS[t.name];
    card.innerHTML = (logo ? '<img class="eq-ov-logo" src="'+logo+'" alt="'+t.name+'" onerror="this.style.display=\'none\'">' : '<span class="eq-ov-ico">'+t.ico+'</span>')
      + '<span class="eq-ov-name">'+t.name+(rating?'<br><span class="eq-ov-rating">★ '+rating+'</span>':'')+(t.screen?'<br><span style="font-size:9px;color:rgba(240,192,64,.6);letter-spacing:2px;">VER PLANTILLA ▶</span>':'')+'</span>';
    card.onclick = function(){
      document.getElementById('equipos-overlay').classList.remove('show');
      if(t.screen && typeof go === 'function') go(t.screen);
    };
    grid.appendChild(card);
  });
})();


/* script block 21 */

(function(){

  /* ── PROBABILIDADES CANÓNICAS ──────────────────────────────────────
     Estas son las únicas probabilidades válidas para TODOS los
     partidos IA vs IA de CUALQUIER competición.
     NUNCA cambiar estos valores sin actualizar este bloque único.

     🟥  1 roja directa          → 15% de los partidos
     🟨🟥 Doble amarilla          → 10% (jugador con amarilla previa)
     🟥🟥 2+ rojas directas       →  5% de los partidos
     🤦  Penalti provocado        → 30% de los partidos
         └ 🟨 al que provoca      → 65% de esas veces
         └ 🟥 al que provoca      → 10% de esas veces
         └ ⚽🥅 Gol del penalti     → 70% de los penaltis tirados
         └ 🖐🥅 Parado por portero  → 20% de los penaltis fallados
         └ ⚽❌ Fallado             → 10% de los penaltis fallados
     ⚽🎯  Gol de falta             →  8% de los partidos
     ⚽🚫  Autogol                  →  8% de los partidos

     ── PUNTUACIÓN MVP ──────────────────────────────────────────────
     ⚽  Gol normal        → 3 pts
     ⚽🎯  Gol de falta      → 4 pts
     ⚽🥅  Penalti gol       → 2 pts
     🖐🥅  Penalti parado    → 3 pts
     ⚽🚫  Autogol           → -1 pt (penaliza al que lo mete)
     🏆  Gol decisivo      → +2 pts extra
     Hat-trick o más: se muestra en acta → Mbappé (3⚽)
     Sin goles/paradas: MVP aleatorio de campo del equipo ganador.
  ────────────────────────────────────────────────────────────────── */

  window.mlSimEngine = function(cfg) {
    var TEAM_A  = (cfg.teamA || '').trim();
    var TEAM_B  = (cfg.teamB || '').trim();
    var sqA     = cfg.sqA;
    var sqB     = cfg.sqB;
    var matchKey= cfg.matchKey;
    var btn     = document.getElementById(cfg.btnId);
    var list    = document.getElementById(cfg.listId);

    if (!btn || !list) return;
    btn.textContent = "0'"; btn.className = 'ml-timer running';

    // ── Guardia null: si sqFromRegistry no encuentra el equipo ────────
    if (!sqA || !sqA.length) {
      btn.textContent = '⚠️ ERROR'; btn.className = 'ml-timer';
      var errDiv = document.createElement('div'); errDiv.className = 'ml-ht';
      errDiv.textContent = '⚠️ Plantilla no encontrada: ' + TEAM_A;
      list.appendChild(errDiv);
      return;
    }
    if (!sqB || !sqB.length) {
      btn.textContent = '⚠️ ERROR'; btn.className = 'ml-timer';
      var errDiv2 = document.createElement('div'); errDiv2.className = 'ml-ht';
      errDiv2.textContent = '⚠️ Plantilla no encontrada: ' + TEAM_B;
      list.appendChild(errDiv2);
      return;
    }

    // ── CONVOCATORIA 18: split titulares / banquillo ─────────────────
    // sqFromRegistry ya devuelve p[4]='titular'|'suplente'
    var activeA = sqA.filter(function(p){ return !p[4]||p[4]==='titular'; });
    var benA    = sqA.filter(function(p){ return p[4]==='suplente'; });
    var activeB = sqB.filter(function(p){ return !p[4]||p[4]==='titular'; });
    var benB    = sqB.filter(function(p){ return p[4]==='suplente'; });
    if(!activeA.length) activeA = sqA.slice();
    if(!activeB.length) activeB = sqB.slice();
    // Índices para sustituciones (hasta 4 por equipo desde min 46)
    var subIdxA=0, subIdxB=0;
    var subMinsA=(function(n){var m=[];for(var i=0;i<n;i++)m.push(46+Math.floor(Math.random()*44));return m.sort(function(a,b){return a-b;});})(Math.min(4,benA.length));
    var subMinsB=(function(n){var m=[];for(var i=0;i<n;i++)m.push(46+Math.floor(Math.random()*44));return m.sort(function(a,b){return a-b;});})(Math.min(4,benB.length));
    function applySubsUpTo(min){
      while(subIdxA<subMinsA.length&&subMinsA[subIdxA]<=min){
        var outfA=activeA.filter(function(p){return p[2]!=='P';});
        if(outfA.length&&subIdxA<benA.length){
          var wA=outfA.reduce(function(a,b){return(a[3]||70)<(b[3]||70)?a:b;});
          var iA=activeA.indexOf(wA); if(iA>=0) activeA.splice(iA,1);
          activeA.push(benA[subIdxA]);
        }
        subIdxA++;
      }
      while(subIdxB<subMinsB.length&&subMinsB[subIdxB]<=min){
        var outfB=activeB.filter(function(p){return p[2]!=='P';});
        if(outfB.length&&subIdxB<benB.length){
          var wB=outfB.reduce(function(a,b){return(a[3]||70)<(b[3]||70)?a:b;});
          var iB=activeB.indexOf(wB); if(iB>=0) activeB.splice(iB,1);
          activeB.push(benB[subIdxB]);
        }
        subIdxB++;
      }
    }

    // ── helpers ──────────────────────────────────────────────────────
    // ── PODER BASADO EN RATINGS REALES ─────────────────────────────
    var _teamAliases = window.TEAM_ALIASES || {};
    var _resolvedA = _teamAliases[TEAM_A.toLowerCase()] || TEAM_A;
    var _resolvedB = _teamAliases[TEAM_B.toLowerCase()] || TEAM_B;
    var rA = window.TEAM_RATINGS ? (window.TEAM_RATINGS[_resolvedA] || window.TEAM_RATINGS[TEAM_A] || 76) : 76;
    var rB = window.TEAM_RATINGS ? (window.TEAM_RATINGS[_resolvedB] || window.TEAM_RATINGS[TEAM_B] || 76) : 76;
    // También calcular poder medio de la plantilla si no hay rating global
    if (!window.TEAM_RATINGS || (!window.TEAM_RATINGS[TEAM_A] && !window.TEAM_RATINGS[_resolvedA])) {
      var sumA=0,cntA=0; sqA.forEach(function(p){if(p[3]&&p[2]!=='P'){sumA+=p[3];cntA++;}});
      if(cntA>0) rA=Math.round(sumA/cntA);
    }
    if (!window.TEAM_RATINGS || (!window.TEAM_RATINGS[TEAM_B] && !window.TEAM_RATINGS[_resolvedB])) {
      var sumB=0,cntB=0; sqB.forEach(function(p){if(p[3]&&p[2]!=='P'){sumB+=p[3];cntB++;}});
      if(cntB>0) rB=Math.round(sumB/cntB);
    }
    // probA = probabilidad de que marque equipo A en cada evento de gol
    // ── VENTAJA LOCAL: equipo A es siempre el local (bonus pequeño ~3%) ──
    var _localBonus = 0.05; // bonus discreto de localía (mejor refleja ventaja local)
    var _baseA = rA / (rA + rB);
    var probA = Math.min(0.82, _baseA + _localBonus * (1 - _baseA));
    function rndSq(sq){
      var hasW=sq.some(function(p){return p[3]!==undefined;});
      if(!hasW) return sq[Math.floor(Math.random()*sq.length)];
      var tot=sq.reduce(function(s,p){return s+(p[3]||30);},0);
      var r=Math.random()*tot; var c=0;
      for(var wi=0;wi<sq.length;wi++){c+=(sq[wi][3]||30);if(r<c)return sq[wi];}
      return sq[sq.length-1];
    }
    // Usa activeA/activeB (jugadores en campo en ese momento)
    function rndActive(team){return team==='a'?activeA:activeB;}
    // Peso de gol por posición (basado en estadísticas LaLiga)
    function _posGoalWeight(pos, poder) {
      var base;
      if (pos === 'P') base = 0.001;       // Portero: 0.1%
      else if (pos === 'D') base = 0.075;   // Defensa: 5-10% → media 7.5%
      else if (pos === 'M') base = 0.175;   // Medio: 15-20% → media 17.5%
      else base = 0.70;                      // Delantero: 65-75% → media 70%
      // Boost por poder del jugador (normalizado: poder 70=base, 90=+15%)
      var poderBoost = ((poder || 70) - 70) / 20 * 0.15;
      return Math.max(0.001, base + poderBoost);
    }
    function rndSqNonGK(sq){
      var active=sq===sqA?activeA:(sq===sqB?activeB:sq);
      if(!active||!active.length) return ['0','Jugador','M',70];
      var f=active.filter(function(p){return p[2]!=='P';});
      if(!f.length)f=active;
      // Usar peso combinado: poder × peso_posición
      var tot=f.reduce(function(s,p){
        return s + (p[3]||70) * _posGoalWeight(p[2], p[3]);
      },0);
      if(!tot)return f[Math.floor(Math.random()*f.length)];
      var r=Math.random()*tot;var c=0;
      for(var wi=0;wi<f.length;wi++){
        c+=(f[wi][3]||70)*_posGoalWeight(f[wi][2],f[wi][3]);
        if(r<c)return f[wi];
      }
      return f[f.length-1];
    }
    function rndGK(sq){
      var active=sq===sqA?activeA:(sq===sqB?activeB:sq);
      if(!active||!active.length) return ['1','Portero','P',70];
      var g=active.filter(function(p){return p[2]==='P';});
      return g.length?g[0]:rndSq(active);
    }
    function rndTeam(){return Math.random()<probA?'a':'b';}
    var extraA = Math.floor(Math.random()*4)+1;
    var extraB = Math.floor(Math.random()*8)+1;
    var ht45   = 45+extraA;
    var ft90   = 90+extraB;
    function rndMin(){return Math.floor(Math.random()*ft90)+1;}
    function rndMinAfter(m){var r=m+Math.floor(Math.random()*2)+1;return r>ft90?ft90:r;}

    var sa=0, sb=0, evts=[];
    var yellowLog={a:[],b:[]};
    var expelledLog={a:[],b:[]};
    var usedYellow=[];
    var redCardTeam=null, redCardMin=999;

    // ── AMARILLAS SIMPLES (1-4) ───────────────────────────────────────
    var numYellow = Math.floor(Math.random()*4)+1;
    for(var j=0;j<numYellow;j++){
      var ct=rndTeam(); var csq=ct==='a'?sqA:sqB;
      applySubsUpTo(rndMin()); // actualizar activos antes de elegir jugador
      var cp=rndSqNonGK(csq);
      var key=ct+cp[1];
      if(usedYellow.indexOf(key)!==-1)continue;
      usedYellow.push(key);
      yellowLog[ct].push(cp[1]);
      evts.push({min:rndMin(),ico:'🟨',team:ct,player:cp,type:'card'});
    }

    // ── EXPULSIONES (dado único, mutuamente excluyentes) ─────────────
    // 2% → 2+ rojas | 5% → 1 roja directa | 5% → doble amarilla | 88% → sin expulsión
    var cardRoll = Math.random();
    if(cardRoll < 0.02){
      // 2+ rojas directas
      var rt=rndTeam(); var rsq=rt==='a'?sqA:sqB; var rp=rndSqNonGK(rsq);
      redCardMin=rndMin(); redCardTeam=rt;
      evts.push({min:redCardMin,ico:'🟥',team:rt,player:rp,type:'card'});
      expelledLog[rt].push(rp[1]);
      var rt2=rndTeam(); var rsq2=rt2==='a'?sqA:sqB; var rp2=rndSqNonGK(rsq2);
      if(expelledLog[rt2].indexOf(rp2[1])===-1){
        evts.push({min:rndMin(),ico:'🟥',team:rt2,player:rp2,type:'card'});
        expelledLog[rt2].push(rp2[1]);
      }
    } else if(cardRoll < 0.07){
      // 1 roja directa (5%)
      var rt=rndTeam(); var rsq=rt==='a'?sqA:sqB; var rp=rndSqNonGK(rsq);
      redCardMin=rndMin(); redCardTeam=rt;
      evts.push({min:redCardMin,ico:'🟥',team:rt,player:rp,type:'card'});
      expelledLog[rt].push(rp[1]);
    } else if(cardRoll < 0.12){
      // Doble amarilla (5%) — el jugador DEBE tener amarilla previa
      var daTeam=null, daPlayer=null;
      var teams2=['a','b'];
      for(var ti=0;ti<2;ti++){if(yellowLog[teams2[ti]].length>0){daTeam=teams2[ti];break;}}
      if(!daTeam) daTeam=rndTeam();
      var dasq=daTeam==='a'?sqA:sqB;
      if(yellowLog[daTeam].length>0){
        var ynm=yellowLog[daTeam][Math.floor(Math.random()*yellowLog[daTeam].length)];
        daPlayer=dasq.find(function(p){return p[1]===ynm;})||rndSqNonGK(dasq);
      } else {
        daPlayer=rndSqNonGK(dasq);
        if(daPlayer){
          // Generar la 🟨 en un minuto temprano, la 🟨🟥 vendrá después
          var firstYellowMin=1+Math.floor(Math.random()*44); // min 1-44
          yellowLog[daTeam].push(daPlayer[1]);
          evts.push({min:firstYellowMin,ico:'🟨',team:daTeam,player:daPlayer,type:'card'});
        }
      }
      if(daPlayer){
        // Garantizar que 🟨🟥 va DESPUÉS de la 🟨 existente
        // Buscar el minuto de la amarilla previa de este jugador
        var prevYellowEvt=evts.find(function(e){return e.type==='card'&&e.ico==='🟨'&&e.team===daTeam&&e.player&&e.player[1]===daPlayer[1];});
        var daMinStart=prevYellowEvt?prevYellowEvt.min+1:1;
        var daMin2=daMinStart+Math.floor(Math.random()*(90-daMinStart));
        if(daMin2>90)daMin2=90;
        evts.push({min:daMin2,ico:'🟨🟥',team:daTeam,player:daPlayer,type:'card'});
        yellowLog[daTeam].splice(yellowLog[daTeam].indexOf(daPlayer[1]),1);
        expelledLog[daTeam].push(daPlayer[1]);
        redCardTeam=daTeam; redCardMin=daMin2;
      }
    }
    // 70% restante: sin expulsiones

    // ── PENALTI (30% de los partidos) ─────────────────────────────────
    if(Math.random()<0.30){
      var foul_t  = rndTeam();               // equipo que COMETE la falta
      var prov_t  = foul_t==='a'?'b':'a';   // equipo que RECIBE y TIRA
      var foul_sq = foul_t==='a'?sqA:sqB;
      var prov_sq = prov_t==='a'?sqA:sqB;
      var foul_p  = rndSqNonGK(foul_sq);
      var kick_p  = rndSqNonGK(prov_sq);
      var pen_min = rndMin();
      // Tarjeta al que comete la falta
      var r2=Math.random();
      if(r2<0.65){
        if(expelledLog[foul_t].indexOf(foul_p[1])===-1){
          if(yellowLog[foul_t].indexOf(foul_p[1])!==-1){
            evts.push({min:pen_min,ico:'🟨🟥',team:foul_t,player:foul_p,type:'card'});
            yellowLog[foul_t].splice(yellowLog[foul_t].indexOf(foul_p[1]),1);
            expelledLog[foul_t].push(foul_p[1]);
            if(!redCardTeam){redCardTeam=foul_t;redCardMin=pen_min;}
          } else {
            evts.push({min:pen_min,ico:'🟨',team:foul_t,player:foul_p,type:'card'});
            yellowLog[foul_t].push(foul_p[1]);
          }
        }
      } else if(r2<0.75){
        if(expelledLog[foul_t].indexOf(foul_p[1])===-1){
          evts.push({min:pen_min,ico:'🟥',team:foul_t,player:foul_p,type:'card'});
          expelledLog[foul_t].push(foul_p[1]);
          if(!redCardTeam){redCardTeam=foul_t;redCardMin=pen_min;}
        }
      }
      evts.push({min:pen_min,ico:'🤦🥅',team:foul_t,player:foul_p,type:'pen-prov'});
      // Resultado del penalti: equipo RIVAL (prov_t) tira
      var pen_kick_min = rndMinAfter(pen_min);
      var pr=Math.random();
      if(pr<0.70){
        // ⚽🥅 Gol — suma al equipo que tira (prov_t)
        if(prov_t==='a')sa++;else sb++;
        evts.push({min:pen_kick_min,ico:'⚽🥅',team:prov_t,player:kick_p,type:'pen-gol'});
      } else if(pr<0.90){
        // 🖐🥅 Parado por portero del equipo que cometió la falta (foul_t)
        var gk=rndGK(foul_t==='a'?sqA:sqB);
        evts.push({min:pen_kick_min,ico:'🖐🥅',team:foul_t,player:gk,type:'pen-parado'});
      } else {
        // ❌🥅 Fuera/poste — lo tira el equipo rival (prov_t)
        evts.push({min:pen_kick_min,ico:'❌🥅',team:prov_t,player:kick_p,type:'pen-fallo'});
      }
    }

    // ── GOL DE FALTA (8%) ────────────────────────────────────────────
    if(Math.random()<0.08){
      var fgt=rndTeam(); var fgsq=fgt==='a'?sqA:sqB; var fgp=rndSqNonGK(fgsq);
      if(fgt==='a')sa++;else sb++;
      evts.push({min:rndMin(),ico:'⚽🎯',team:fgt,player:fgp,type:'falta-gol'});
    }

    // ── AUTOGOL (8%) ─────────────────────────────────────────────────
    if(Math.random()<0.08){
      var agt=rndTeam(); var agsq=agt==='a'?sqA:sqB; var agp=rndSqNonGK(agsq);
      if(agt==='a')sb++;else sa++;
      evts.push({min:rndMin(),ico:'⚽🚫',team:agt,player:agp,type:'propia'});
    }

    // ── GOLES NORMALES con influencia real del rating ───────────────
    // Antes solo se repartían los goles con probA; ahora también cambia
    // la CANTIDAD esperada de goles de cada equipo según nivel.
    function _clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
    function _poisson(lambda){
      lambda = Math.max(0.05, lambda || 0.05);
      var L = Math.exp(-lambda), k = 0, p = 1;
      do { k++; p *= Math.random(); } while (p > L && k < 12);
      return k - 1;
    }
    function _avgOutfieldPower(sq){
      var pool=(sq||[]).filter(function(p){ return p && p[2] !== 'P'; });
      if(!pool.length) return 70;
      var sum=pool.reduce(function(acc,p){ return acc + (p[3] || 70); }, 0);
      return sum / pool.length;
    }
    var _powA = _avgOutfieldPower(activeA.length ? activeA : sqA);
    var _powB = _avgOutfieldPower(activeB.length ? activeB : sqB);
    var _strengthA = rA + ((_powA - 75) * 0.35) + 1.5; // bonus local
    var _strengthB = rB + ((_powB - 75) * 0.35);
    var _shareA = _clamp(_strengthA / Math.max(1, (_strengthA + _strengthB)), 0.22, 0.78);
    var _baseTotalGoals = 1.7 + (((rA + rB) / 2) - 74) * 0.05;
    var _gapBoost = Math.abs(rA - rB) * 0.035;
    var _expectedA = _clamp(_baseTotalGoals * _shareA + Math.max(0, rA - rB) * 0.018 + 0.10, 0.15, 3.8);
    var _expectedB = _clamp(_baseTotalGoals * (1 - _shareA) + Math.max(0, rB - rA) * 0.018, 0.10, 3.3);
    if (Math.abs(rA - rB) >= 8) {
      if (rA > rB) _expectedA += _gapBoost * 0.35;
      else _expectedB += _gapBoost * 0.35;
    }
    var _maxGoals = (rA >= 88 || rB >= 88) ? 7 : (rA >= 84 || rB >= 84) ? 6 : 5;
    var goalsA = Math.min(_maxGoals, _poisson(_expectedA));
    var goalsB = Math.min(_maxGoals, _poisson(_expectedB));
    var _normalGoalTeams = [];
    for (var ga = 0; ga < goalsA; ga++) _normalGoalTeams.push('a');
    for (var gb = 0; gb < goalsB; gb++) _normalGoalTeams.push('b');
    _normalGoalTeams.sort(function(){ return Math.random() - 0.5; });
    var _goalScorers = {}; // tracking goles por jugador
    for(var i=0;i<_normalGoalTeams.length;i++){
      var gt=_normalGoalTeams[i]; var gsq=gt==='a'?sqA:sqB;
      var gMin=rndMin(); applySubsUpTo(gMin);
      // Elegir goleador: puede repetir con prob decreciente (Poisson)
      var gp;
      // ¿Hay ya un goleador de este equipo que pueda repetir?
      var prevScorers = Object.keys(_goalScorers).filter(function(k){ return _goalScorers[k].team===gt; });
      var reusePlayer = false;
      if (prevScorers.length) {
        var topScorer = prevScorers.reduce(function(a,b){ return _goalScorers[a].count > _goalScorers[b].count ? a : b; });
        var prevCount = _goalScorers[topScorer].count;
        // Prob de doblete: 1.5% | hat-trick: 0.2% | póker: 0.01% | repóker: 0.001%
        var reuseProb = prevCount === 1 ? 0.015 : prevCount === 2 ? 0.002 : prevCount === 3 ? 0.0001 : prevCount >= 4 ? 0.00001 : 0;
        // Boost por poder del jugador
        var scorer = _goalScorers[topScorer].player;
        var poderBonus = ((scorer[3]||70) - 70) / 20 * 0.005;
        reuseProb += poderBonus;
        if (Math.random() < reuseProb) {
          gp = scorer;
          reusePlayer = true;
        }
      }
      if (!reusePlayer) gp = rndSqNonGK(gsq);
      // Registrar goleador
      var gpKey = gt + '::' + gp[1];
      if (!_goalScorers[gpKey]) _goalScorers[gpKey] = { player: gp, team: gt, count: 0 };
      _goalScorers[gpKey].count++;
      if(gt==='a')sa++;else sb++;
      evts.push({min:gMin,ico:'⚽',team:gt,player:gp,type:'gol'});
    }

    // ── LESIONES EN PARTIDO IA vs IA ────────────────────────────────
    if (typeof window.generarLesionesPartido === 'function') {
      var _lesionesIA = window.generarLesionesPartido(TEAM_A, TEAM_B, activeA, activeB, benA, benB, ft90);
      _lesionesIA.forEach(function(les) {
        if (typeof window.aplicarLesionEnSimulacion === 'function') {
          var evLes = window.aplicarLesionEnSimulacion(les, activeA, activeB);
          evts.push(evLes);
        }
      });
    }

    // ── EFECTO ROJA: reduce goles del equipo sancionado tras la roja ─
    if(redCardTeam){
      evts.sort(function(a,b){return a.min-b.min;});
      var adjEvts=[];
      for(var ri=0;ri<evts.length;ri++){
        var rev=evts[ri];
        var isGoalByRed=(rev.team===redCardTeam&&rev.min>redCardMin&&
          (rev.type==='gol'||rev.type==='falta-gol'||rev.type==='pen-gol'));
        if(isGoalByRed&&Math.random()<0.55)continue; // 55% chance goal removed
        adjEvts.push(rev);
      }
      evts=adjEvts;
      sa=0;sb=0;
      evts.forEach(function(ev){
        if(ev.type==='gol'||ev.type==='falta-gol'||ev.type==='pen-gol'){if(ev.team==='a')sa++;else sb++;}
        if(ev.type==='propia'){if(ev.team==='a')sb++;else sa++;}
      });
    }

    // ── Sustituciones gestionadas al inicio del engine ─────────────

    evts.sort(function(a,b){return a.min-b.min;});

    // ── MVP ───────────────────────────────────────────────────────────
    // Sistema de puntuación:
    //   ⚽ gol=3 | ⚽🎯 falta-gol=4 | ⚽🥅 pen-gol=2 | 🖐🥅 pen-parado=3 | ⚽🚫 propia=-1
    //   🏆 gol decisivo +2 extra
    var mvpName='', mvpTeam='';
    var mvpScores={}, mvpTeams={}, mvpGoals={};
    evts.forEach(function(e){
      if(!e.player)return;
      var k=e.player[1]; var w=0;
      if(e.type==='gol'){w=3;mvpGoals[k]=(mvpGoals[k]||0)+1;}
      else if(e.type==='falta-gol'){w=4;mvpGoals[k]=(mvpGoals[k]||0)+1;}
      else if(e.type==='pen-gol'){w=2;mvpGoals[k]=(mvpGoals[k]||0)+1;}
      else if(e.type==='pen-parado'){w=3;}
      else if(e.type==='propia'){w=-1;}
      if(w!==0){
        mvpScores[k]=(mvpScores[k]||0)+w;
        mvpTeams[k]=(e.team==='a'?TEAM_A:TEAM_B);
      }
    });
    // Bonus +2 al gol decisivo
    var diff=sa-sb;
    if(diff!==0){
      var winTeam=diff>0?'a':'b';
      var runA=0,runB=0,decisivePlayer=null;
      var goalEvts=evts.filter(function(e){
        return(e.type==='gol'||e.type==='falta-gol'||e.type==='pen-gol'||e.type==='propia')&&e.player;
      });
      goalEvts.forEach(function(e){
        if(e.type==='propia'){if(e.team==='a')runB++;else runA++;}
        else{if(e.team==='a')runA++;else runB++;}
        var curDiff=winTeam==='a'?runA-runB:runB-runA;
        if(curDiff===1&&!decisivePlayer){
          decisivePlayer=(e.type==='propia')?null:e.player[1];
        }
      });
      if(decisivePlayer){
        if(mvpScores[decisivePlayer]!==undefined){mvpScores[decisivePlayer]+=2;}
        else{mvpScores[decisivePlayer]=2; mvpTeams[decisivePlayer]=(winTeam==='a'?TEAM_A:TEAM_B);}
      }
    }
    // Elegir MVP: 90% del equipo ganador
    var winnerTeam=sa>sb?'a':(sb>sa?'b':null);
    var forceWinnerMVP=(winnerTeam&&Math.random()<0.90);
    Object.keys(mvpScores).forEach(function(k){
      if(mvpScores[k]<=0)return;
      var kIsWinner=winnerTeam&&mvpTeams[k]===(winnerTeam==='a'?TEAM_A:TEAM_B);
      if(!mvpName){mvpName=k;return;}
      var curIsWinner=mvpTeams[mvpName]===(winnerTeam==='a'?TEAM_A:TEAM_B);
      if(forceWinnerMVP){
        if(kIsWinner&&!curIsWinner){mvpName=k;return;}
        if(!kIsWinner&&curIsWinner){return;}
      }
      if(mvpScores[k]>mvpScores[mvpName]){mvpName=k;}
    });
    mvpTeam=mvpTeams[mvpName]||'';
    // Fallback: sin goles/paradas → jugador de campo aleatorio del ganador
    if(!mvpName){
      var winner0=sa>sb?'a':(sb>sa?'b':'draw');
      var mvpSq=winner0==='b'?sqB:(winner0==='a'?sqA:(Math.random()<0.5?sqA:sqB));
      var outfieldMvp=mvpSq.filter(function(p){return p[2]!=='P';});
      var pool=outfieldMvp.length?outfieldMvp:mvpSq;
      var mvpP=pool[Math.floor(Math.random()*pool.length)];
      mvpName=mvpP[1]; mvpTeam=mvpSq===sqA?TEAM_A:TEAM_B;
    }
    var mvpGoalCount=mvpGoals[mvpName]||0;
    var mvpGoalStr=mvpGoalCount>1?' ('+mvpGoalCount+'⚽)':'';

    // ── LIVE TICKER ───────────────────────────────────────────────────
    // Si ambos equipos ≥79 → 45s por parte (campo activo), sino 15s
    var _campoMode = (rA >= 79 && rB >= 79);
    var _halfDuration = _campoMode ? 45000 : 15000;
    var _tickTotal = _campoMode ? 90 : 30;
    var _tickMs = _campoMode ? 3000 : 1000;
    var msPerMinFH = _halfDuration / ht45;
    var msPerMinSH = _halfDuration / (ft90-45);
    list.innerHTML='';

    var _tick=0;
    var _tickInterval=setInterval(function(){
      _tick++;
      var _half = Math.floor(_tickTotal / 3);
      if(_tick<=_half){
        var dm=Math.round(_tick*ht45/_half); if(dm>ht45)dm=ht45;
        btn.textContent=(_tick<_half?dm:ht45+'+'+extraA)+"'";
      } else if(_tick<=_tickTotal){
        var t2=_tick-_half; var dm2=45+Math.round(t2*(ft90-45)/_half); if(dm2>ft90)dm2=ft90;
        btn.textContent=(dm2<=90?dm2:'90+'+extraB)+"'";
      }
      if(_tick>=_tickTotal)clearInterval(_tickInterval);
    },_tickMs);

    function renderEvtEl(ev){
      if(ev.type==='ht'||ev.type==='sub')return;
      // Lesión grave: STOP en timer
      if(ev.type==='lesion'&&ev.grave){
        var _btnTimer=document.getElementById(cfg.btnId);
        if(_btnTimer){_btnTimer.textContent='🛑 STOP';_btnTimer.classList.add('grave-stop');}
        setTimeout(function(){
          var _btnT2=document.getElementById(cfg.btnId);
          if(_btnT2){_btnT2.classList.remove('grave-stop');}
        },4000);
      }
      var d=document.createElement('div'); d.className='ml-evt-item';
      d.setAttribute('data-team', ev.team);
      d.setAttribute('data-type', ev.type);
      var teamName=ev.team==='a'?TEAM_A:TEAM_B;
      var _iaFalloExtra='';
      if(ev.type==='pen-parado'){var _iaContrario=ev.team==='a'?'b':'a';var _iaFallado=evts.find(function(e){return e.type==='pen-fallo'&&e.team===_iaContrario&&e.min===ev.min;});if(_iaFallado){_iaFalloExtra='<span class="ml-evt-pen-fallo">❌ '+_iaFallado.player[1]+'</span>';}}
      // Lesión: mostrar grado y partidos de baja
      if(ev.type==='lesion'){
        var _lColor=ev.grave?'#ff4444':(ev.tipo&&ev.tipo.grado===2?'#ff8c00':'#ffd700');
        d.innerHTML='<span class="ml-evt-min">'+ev.min+"'</span>"
          +'<span class="ml-evt-ico">🩹</span>'
          +'<span class="ml-evt-name" style="color:'+_lColor+'">'+ev.player[1]
          +'<span style="font-size:10px;color:rgba(255,255,255,0.5);margin-left:6px;">'+ev.gradoNombre+' · '+ev.partidos+'P</span></span>'
          +'<span class="ml-evt-team">'+teamName+'</span>';
        list.appendChild(d);
        return;
      }
      d.innerHTML='<span class="ml-evt-min">'+ev.min+"'</span>"
        +'<span class="ml-evt-ico">'+ev.ico+'</span>'
        +'<span class="ml-evt-name">'+ev.player[1]+'</span>'
        +_iaFalloExtra
        +'<span class="ml-evt-team">'+teamName+'</span>';
      list.appendChild(d);
    }

    evts.forEach(function(ev){
      var ms;
      if(ev.type==='ht'){ms=_halfDuration;}
      else if(ev.min<=ht45){ms=Math.round(ev.min*msPerMinFH);}
      else{ms=_halfDuration+Math.round((ev.min-45)*msPerMinSH);}
      ms=Math.min(ms,_halfDuration*2-500);
      setTimeout(function(){renderEvtEl(ev);},ms);
      if(ev.type==='gol'||ev.type==='falta-gol'||ev.type==='pen-gol'||ev.type==='propia'){
        setTimeout(function(){
          var scAEl=document.getElementById(cfg.scAId);
          var scBEl=document.getElementById(cfg.scBId);
          if(scAEl) scAEl.textContent=evts.filter(function(e){return(e.type==='gol'||e.type==='falta-gol'||e.type==='pen-gol')&&e.team==='a'&&e.min<=ev.min;}).length+evts.filter(function(e){return e.type==='propia'&&e.team==='b'&&e.min<=ev.min;}).length;
          if(scBEl) scBEl.textContent=evts.filter(function(e){return(e.type==='gol'||e.type==='falta-gol'||e.type==='pen-gol')&&e.team==='b'&&e.min<=ev.min;}).length+evts.filter(function(e){return e.type==='propia'&&e.team==='a'&&e.min<=ev.min;}).length;
          var gf=document.getElementById(cfg.gfId);
          if(gf){gf.classList.add('show');if(typeof triggerShootingBall==='function')triggerShootingBall(gf,(ev.type==='propia'?(ev.team==='a'?'b':'a'):ev.team));setTimeout(function(){gf.classList.remove('show');},3000);}
        },ms+50);
      }
      if(ev.ico==='🟥'||ev.ico==='🟨🟥'){
        (function(evCopy,msDelay){
          setTimeout(function(){
            
          }, msDelay+80);
        })(ev, ms);
      }
    });

    // Descanso
    setTimeout(function(){
      btn.textContent=ht45+"'+"; btn.className='ml-timer';
    },_halfDuration);

    // Tiempo reglamentario
    setTimeout(function(){
      var scAEl=document.getElementById(cfg.scAId);
      var scBEl=document.getElementById(cfg.scBId);
      if(scAEl) scAEl.textContent=sa;
      if(scBEl) scBEl.textContent=sb;
      btn.textContent='🏁 FIN'; btn.className='ml-timer finished';
      // MVP
      var mvpDiv=document.createElement('div'); mvpDiv.className='ml-evt-item';
      mvpDiv.innerHTML='<span class="ml-evt-min">FIN</span><span class="ml-evt-ico">⭐</span>'
        +'<span class="ml-evt-name">'+mvpName+mvpGoalStr+'</span>'
        +'<span class="ml-evt-team">'+mvpTeam+'</span>';
      list.appendChild(mvpDiv);
      // Resultado final
      var winner=sa>sb?TEAM_A:(sb>sa?TEAM_B:'Empate');
      var r=document.createElement('div'); r.className='ml-ht ml-ht-fin';
      r.textContent='🏁 FIN · '+TEAM_A+' '+sa+' – '+sb+' '+TEAM_B
        +(winner==='Empate'?' · EMPATE':' · 🏆 '+winner.toUpperCase()+' GANA');
      // Añadir MVP a evts para que se contabilice en estadísticas igual que en partidos manuales
      if(mvpName){
        var mvpTeamKey = mvpTeam===TEAM_A?'a':'b';
        evts.push({min:90,ico:'⭐',team:mvpTeamKey,player:['',mvpName],type:'mvp'});
      }
      // Conteo tarjetas/MVP para clasificación
      var _ta_a=evts.filter(function(e){return e.team==='a'&&e.ico==='🟨';}).length;
      var _tr_a=evts.filter(function(e){return e.team==='a'&&(e.ico==='🟥'||e.ico==='🟨🟥');}).length;
      var _ta_b=evts.filter(function(e){return e.team==='b'&&e.ico==='🟨';}).length;
      var _tr_b=evts.filter(function(e){return e.team==='b'&&(e.ico==='🟥'||e.ico==='🟨🟥');}).length;
      var _mvp_a=mvpTeam===TEAM_A?1:0;
      var _mvp_b=mvpTeam===TEAM_B?1:0;
      if(typeof window.registrarResultadoLiga==='function')
        window.registrarResultadoLiga(matchKey,TEAM_A,TEAM_B,sa,sb,_ta_a,_tr_a,_ta_b,_tr_b,_mvp_a,_mvp_b);
      if(typeof window.registrarLigaPlayerStats==='function')
        window.registrarLigaPlayerStats(matchKey,TEAM_A,TEAM_B,evts,mvpName,mvpTeam);
      list.appendChild(r);
      if(typeof cfg.onEnd==='function') cfg.onEnd(sa,sb,evts,mvpName,mvpTeam);
      // Mostrar overlay de lesiones post-partido IA
      var _lesEvts = evts.filter(function(ev){ return ev.type === 'lesion'; });
      if(_lesEvts.length && typeof window.showLesionPostOverlay === 'function'){
        var _lesData = _lesEvts.map(function(ev){
          return {
            nombre: ev.player ? ev.player[1] : '',
            equipo: ev.team === 'a' ? TEAM_A : TEAM_B,
            grado: ev.grado || 1,
            gradoNombre: ev.gradoNombre || 'Leve',
            gradoEmoji: ev.gradoEmoji || '🟡',
            descripcion: ev.descripcion || '',
            partidos: ev.partidos || 1
          };
        });
        setTimeout(function(){ window.showLesionPostOverlay(_lesData, null); }, 800);
      }
    },_halfDuration*2);
  };

})();


/* script block 22 */

function actaTog(matchKey) {
  var toggle = document.getElementById('acta-toggle-' + matchKey);
  var body   = document.getElementById('acta-body-'   + matchKey);
  if (!toggle || !body) return;
  var open = body.classList.contains('open');
  body.classList.toggle('open', !open);
  toggle.classList.toggle('open', !open);
}

// ── Botón CONFIGURACIÓN: cuestionario pre-partido → sanciones ──
function mlPreviaClick(matchKey) {
  if (typeof window._mlEnsureLegacyPreMatchStructure === 'function') {
    window._mlEnsureLegacyPreMatchStructure(matchKey);
  }
  var wrap = document.getElementById('mlw-' + matchKey);
  var compKey = 'liga';
  var isHvH = wrap && wrap.classList.contains('hvh');
  window._ppBlockId = null;
  if (wrap) {
    var jm = wrap.closest('.jmatches');
    if (jm && jm.id) {
      var jid = jm.id;
      window._ppBlockId = jid;
      if (jid === 'cal-copa-fin')          compKey = 'copa-fin';
      else if (jid === 'sc-final')         compKey = 'sc-final';
      else if (jid === 'cal-usc-f')        compKey = 'usc-fin';
      else if (jid === 'ucl-fin')          compKey = 'ucl-fin';
      else if (jid === 'uel-fin')          compKey = 'uel-fin';
      else if (jid === 'uecl-fin')         compKey = 'uecl-fin';
      else if (jid === 'cal-inter-f')      compKey = 'inter-fin';
      else if (jid === 'sc-semis')         compKey = 'sc';
      else if (jid.startsWith('cal-sc-'))  compKey = 'sc';
      else if (jid.startsWith('cal-usc-')) compKey = 'usc';
      else if (jid.startsWith('cal-copa-'))compKey = 'copa';
      else if (jid.startsWith('cal-l'))    compKey = 'liga';
      else if (jid.startsWith('ucl-'))     compKey = 'ucl';
      else if (jid.startsWith('uel-'))     compKey = 'uel';
      else if (jid.startsWith('uecl-'))    compKey = 'uecl';
      else if (jid.startsWith('cal-sl'))   compKey = 'superliga';
      else if (jid.startsWith('cal-inter-'))compKey = 'inter';
    }
  }
  // Determinar prórroga automática según reglas
  // HvH: siempre hay prórroga y penaltis
  // HvIA: Copa 1r/2r/dieciseisavos, USC, SC, Inter, Fases finales selecciones → sí
  // HvIA: Liga y fase de grupos europeos → NO
  var prorroga;
  if (isHvH) {
    prorroga = 'Sí';
  } else {
    var conProrroga = ['copa','copa-fin','sc','sc-final','usc','usc-fin','inter','inter-fin','ucl-fin','uel-fin','uecl-fin'];
    prorroga = (conProrroga.indexOf(compKey) !== -1) ? 'Sí' : 'No';
  }
  // Duración según HvH o HvIA
  var duracion = isHvH ? '10 min' : '8 min';
  // Mostrar cuestionario
  if (typeof window.showPrePartidoOverlay === 'function') {
    window.showPrePartidoOverlay(matchKey, compKey, prorroga, duracion, isHvH);
  }
}

// ── Compatibilidad: restaurar flujo antiguo CONFIGURACIÓN → ajustes → partido ──
(function() {
  function _resolveWrap(matchKey) {
    return document.getElementById('mlw-' + matchKey);
  }

  function _ensureIds(matchKey) {
    var wrap = _resolveWrap(matchKey);
    if (!wrap) return;
    var venue = wrap.querySelector('.ml-venue-bar');
    if (venue && !venue.id) venue.id = 'venue-bar-' + matchKey;
    var ballWrap = wrap.querySelector('.ml-score-wrap');
    if (ballWrap && !ballWrap.id) ballWrap.id = 'ball-wrap-' + matchKey;
  }

  function _setPreMatchStage(matchKey, unlocked) {
    var wrap = _resolveWrap(matchKey);
    if (!wrap) return;
    _ensureIds(matchKey);
    var timerBtn = document.getElementById('ml-timer-' + matchKey);
    var addBtn = document.getElementById('ml-add-btn-' + matchKey);
    var actBar = document.getElementById('ml-actions-bar-' + matchKey);
    var previaBtn = document.getElementById('ml-previa-' + matchKey);
    if (previaBtn) previaBtn.style.display = unlocked ? 'none' : '';
    if (timerBtn) {
      timerBtn.style.display = unlocked ? '' : 'none';
      timerBtn.disabled = !unlocked;
    }
    if (addBtn) addBtn.style.visibility = unlocked ? '' : 'hidden';
    if (actBar) actBar.style.visibility = unlocked ? '' : 'hidden';
    if (unlocked) wrap.setAttribute('data-prepartido-ready', '1');
  }

  window._mlEnsureLegacyPreMatchStructure = function(matchKey) {
    var wrap = _resolveWrap(matchKey);
    if (!wrap) return;
    _ensureIds(matchKey);
    var scoreWrap = wrap.querySelector('.ml-score-wrap');
    var timerBtn = document.getElementById('ml-timer-' + matchKey);
    if (scoreWrap && timerBtn && !document.getElementById('ml-previa-' + matchKey)) {
      var previaBtn = document.createElement('button');
      previaBtn.id = 'ml-previa-' + matchKey;
      previaBtn.className = 'ml-previa-btn';
      previaBtn.innerHTML = '⚙️ CONFIGURACIÓN';
      previaBtn.onclick = function() { mlPreviaClick(matchKey); };
      if (timerBtn.nextSibling) scoreWrap.insertBefore(previaBtn, timerBtn.nextSibling);
      else scoreWrap.appendChild(previaBtn);
    }
    var unlocked = wrap.getAttribute('data-prepartido-ready') === '1';
    _setPreMatchStage(matchKey, unlocked);
  };

  function _initAllPreviaButtons() {
    document.querySelectorAll('.match-live-wrap.hvh[id^="mlw-"]').forEach(function(wrap) {
      var matchKey = wrap.id.replace('mlw-', '');
      window._mlEnsureLegacyPreMatchStructure(matchKey);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initAllPreviaButtons);
  } else {
    _initAllPreviaButtons();
  }
})();

function _renderSancionBanner(matchKey, bodyEl) {
  var humanKeys = ['j1m1','j1m2','j1m3'];
  if (humanKeys.indexOf(matchKey) === -1) return;
  if (!window.SANCION_STORE) return;
  // j1m1/j1m2/j1m3 son todos Liga en Jornada 1
  var compKey = 'liga';
  var sancionCompConfig = {
    liga:{ label:'Liga EA Sports', esFinal:false },
    copa:{ label:'Copa del Rey', esFinal:false },'copa-fin':{ label:'Copa del Rey · Final', esFinal:true },
    sc:{ label:'Supercopa de España', esFinal:false },'sc-final':{ label:'Supercopa · Final', esFinal:true },
    usc:{ label:'UEFA Super Cup', esFinal:false },'usc-fin':{ label:'UEFA Super Cup · Final', esFinal:true },
    ucl:{ label:'Champions League', esFinal:false },'ucl-fin':{ label:'Champions League · Final', esFinal:true },
    uel:{ label:'Europa League', esFinal:false },'uel-fin':{ label:'Europa League · Final', esFinal:true },
    uecl:{ label:'Conference League', esFinal:false },'uecl-fin':{ label:'Conference League · Final', esFinal:true },
    superliga:{ label:'Superliga', esFinal:false },
    inter:{ label:'Copa Intercontinental', esFinal:false },'inter-fin':{ label:'Intercontinental · Final', esFinal:true }
  };
  var cfg = sancionCompConfig[compKey] || { label: compKey, esFinal: false };
  var sanciones = (!cfg.esFinal && window.SANCION_STORE[compKey]) ? window.SANCION_STORE[compKey] : [];
  // Eliminar banner anterior
  var prev = bodyEl.querySelector('.sancion-acta-banner');
  if (prev) prev.remove();
  if (!sanciones || !sanciones.length) return;
  var banner = document.createElement('div');
  banner.className = 'sancion-acta-banner';
  banner.innerHTML =
    '<div class="sab-header"><span class="sab-icon">🚫</span><span class="sab-title">JUGADORES SANCIONADOS · ' + cfg.label.toUpperCase() + '</span></div>' +
    sanciones.map(function(s) {
      return '<div class="sab-row">'
        + '<span class="sab-name">' + s.name + '</span>'
        + '<span class="sab-sep">·</span>'
        + '<span class="sab-team">' + s.team + '</span>'
        + '<span class="sab-reason">' + s.reason + '</span>'
        + '</div>';
    }).join('');
  var list = document.getElementById('ml-acta-list-' + matchKey);
  if (list) bodyEl.insertBefore(banner, list);
  else bodyEl.appendChild(banner);
}
// Acta observers
(function() {
  var humanKeys = ['j1m1','j1m2','j1m3'];
  var iaKeys    = ['j1m4','j1m5','j1m6','j1m7','j1m8','j1m9','j1m10'];

  // Human matches: auto-open on first event, stay open
  humanKeys.forEach(function(mk) {
    var listEl = document.getElementById('ml-acta-list-' + mk);
    if (!listEl) return;
    var obs = new MutationObserver(function() {
      var body   = document.getElementById('acta-body-'   + mk);
      var toggle = document.getElementById('acta-toggle-' + mk);
      var hasContent = listEl.querySelector('.ml-evt-item, .ml-ht, .ml-ht-fin');
      if (hasContent && body && !body.classList.contains('open')) {
        body.classList.add('open');
        if (toggle) toggle.classList.add('open');
      }
    });
    obs.observe(listEl, { childList: true, subtree: true });
  });

  // IA matches: open while simulating, auto-close when FIN banner appears
  iaKeys.forEach(function(mk) {
    var listEl = document.getElementById('ml-acta-list-' + mk);
    if (!listEl) return;
    var obs = new MutationObserver(function() {
      var body   = document.getElementById('acta-body-'   + mk);
      var toggle = document.getElementById('acta-toggle-' + mk);
      if (!body) return;
      var hasFin = listEl.querySelector('.ml-ht-fin');
      if (hasFin) {
        // Partido terminado → plegar
        body.classList.remove('open');
        if (toggle) toggle.classList.remove('open');
      } else {
        // Simulando → abrir para ver eventos en vivo
        var hasContent = listEl.querySelector('.ml-evt-item, .ml-ht');
        if (hasContent && !body.classList.contains('open')) {
          body.classList.add('open');
          if (toggle) toggle.classList.add('open');
        }
      }
    });
    obs.observe(listEl, { childList: true, subtree: true });
  });
})();


/* script block 23 */

// --- FIX v6: collect stats from all acta events (manual + simulated) ---
(function(){
const ICON_MAP = {
"⚽":"gol",
"🟨":"amarilla",
"🟥":"roja",
"🤦‍♂️🥅":"pen-prov",
"⚽🥅":"pen-gol",
"❌🥅":"pen-fallado",
"🖐🥅":"pen-parado",
"⚽🎯":"falta-gol",
"⚽🚫":"autogol",
"⭐":"mvp"
};

function normal(n){
 return (n||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
}

function getAllActaEvents(){
 const events=[];
 document.querySelectorAll('[id^="ml-acta-list"]').forEach(list=>{
   list.querySelectorAll("li").forEach(li=>{
     const txt=li.innerText.trim();
     const icon=Object.keys(ICON_MAP).find(i=>txt.startsWith(i));
     if(!icon) return;
     const player=txt.replace(icon,"").trim();
     events.push({type:ICON_MAP[icon],player});
   });
 });
 return events;
}

function rebuildLigaStats(){
 if(!window.LIGA_STATS) window.LIGA_STATS={};
 const ev=getAllActaEvents();
 const map={};

 ev.forEach(e=>{
   const p=normal(e.player);
   if(!map[p]) map[p]={name:e.player,stats:{}};
   map[p].stats[e.type]=(map[p].stats[e.type]||0)+1;
 });

 window.LIGA_STATS=map;
 if(window.buildLigaStatsDashboard) window.buildLigaStatsDashboard();
}

window.rebuildLigaStats=rebuildLigaStats;

document.addEventListener("click",function(e){
 if(e.target.closest(".simulate-btn") || e.target.closest(".guardar-acta")){
   setTimeout(rebuildLigaStats,300);
 }
});

document.addEventListener("DOMContentLoaded",rebuildLigaStats);
})();


/* script block 24 */

// --- FIX v8: ligar estadísticas por equipo + dorsal (y nombre como apoyo) ---
(function(){
  function norm(str){
    return String(str || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g,'')
      .replace(/[^\w\s]/g,' ')
      .replace(/\s+/g,' ')
      .trim()
      .toLowerCase();
  }

  var TEAM_ALIASES = {
    'real madrid':'Real Madrid',
    'fc barcelona':'FC Barcelona',
    'barcelona':'FC Barcelona',
    'athletic club':'Athletic Club',
    'real betis':'Real Betis',
    'betis':'Real Betis',
    'real sociedad':'Real Sociedad',
    'atletico madrid':'Atlético Madrid',
    'atlético madrid':'Atlético Madrid',
    'albacete bp':'Albacete BP',
    'villarreal':'Villarreal CF',
    'villarreal cf':'Villarreal CF',
    'sevilla':'Sevilla FC',
    'sevilla fc':'Sevilla FC',
    'espanyol':'Espanyol',
    'getafe':'Getafe CF',
    'getafe cf':'Getafe CF',
    'rc celta':'Celta de Vigo',
    'celta de vigo':'Celta de Vigo',
    'celta':'Celta de Vigo',
    'ca osasuna':'Osasuna',
    'osasuna':'Osasuna',
    'deportivo alaves':'Deportivo Alavés',
    'deportivo alavés':'Deportivo Alavés',
    'girona':'Girona FC',
    'girona fc':'Girona FC',
    'real oviedo':'Real Oviedo',
    'levante ud':'Levante UD',
    'rcd mallorca':'Mallorca',
    'mallorca':'Mallorca',
    'elche':'Elche CF',
    'elche cf':'Elche CF',
    'valencia':'Valencia CF',
    'valencia cf':'Valencia CF',
    'rayo vallecano':'Rayo Vallecano'
  };

  var SCREEN_TEAM_FALLBACK = {
    's-munich': 'Bayern Munich',
    's-arsenal': 'Arsenal',
    's-sporting': 'Sporting CP',
    's-madrid': 'Real Madrid',
    's-barca': 'FC Barcelona',
    's-atletico': 'Atlético Madrid',
    's-albacete': 'Albacete BP',
    's-villarreal': 'Villarreal CF',
    's-sevilla': 'Sevilla FC',
    's-espanyol': 'Espanyol',
    's-getafe': 'Getafe CF',
    'celta-screen': 'Celta de Vigo',
    'osasuna-screen': 'Osasuna',
    'alaves-screen': 'Deportivo Alavés',
    'girona-screen': 'Girona FC',
    'oviedo-screen': 'Real Oviedo',
    'levante-screen': 'Levante UD',
    'mallorca-screen': 'Mallorca',
    'elche-screen': 'Elche CF',
    'valencia-screen': 'Valencia CF',
    'rayo-screen': 'Rayo Vallecano',
    'athletic-screen': 'Athletic Club',
    'betis-screen': 'Real Betis',
    'sociedad-screen': 'Real Sociedad'
  };

  var STAT_CLASS_MAP = {
    'gol': 'ps-gol',
    'yel': 'ps-yel',
    'red': 'ps-red',
    'mvp': 'ps-mvp',
    'pen-prov': 'ps-pen-prov',
    'pen-parado': 'ps-pen-parado',
    'pen-gol': 'ps-pen-gol',
    'falta-gol': 'ps-falta-gol',
    'propia': 'ps-propia',
    'pen-fallado': 'ps-pen-fallado'
  };

  function canonicalTeamName(name){
    var key = norm(name);
    return (window.TEAM_ALIASES||{})[key] || String(name || '').trim();
  }

  function ensureSpan(row, cls){
    var span = row.querySelector('.' + cls);
    if(!span){
      span = document.createElement('span');
      span.className = cls;
      span.hidden = true;
      span.setAttribute('data-global', '0');
      span.setAttribute('data-liga', '0');
      row.appendChild(span);
    }
    if(!span.hasAttribute('data-liga')) span.setAttribute('data-liga','0');
    return span;
  }

  function getPlantillaRows(){
    var rows = [];
    document.querySelectorAll('.screen[id]').forEach(function(screen){
      var team = SCREEN_TEAM_FALLBACK[screen.id] || '';
      if(!team){
        var h2 = screen.querySelector('.sec-hdr h2');
        if(h2) team = h2.textContent.trim();
      }
      team = canonicalTeamName(team);
      screen.querySelectorAll('.plant-row').forEach(function(row){
        var nameEl = row.querySelector('.plant-name');
        var numEl = row.querySelector('.plant-num');
        if(!nameEl) return;
        Object.keys(STAT_CLASS_MAP).forEach(function(k){ ensureSpan(row, STAT_CLASS_MAP[k]); });
        rows.push({
          team: team,
          num: numEl ? String(numEl.textContent || '').trim() : '',
          name: String(nameEl.textContent || '').trim(),
          row: row
        });
      });
    });
    return rows;
  }

  function buildRosterIndex(){
    var byNum = {};
    var byName = {};
    getPlantillaRows().forEach(function(p){
      if(p.team && p.num) byNum[p.team + '::' + p.num] = p.row;
      if(p.team && p.name) byName[p.team + '::' + norm(p.name)] = p.row;
    });
    return { byNum: byNum, byName: byName };
  }

  function resetLigaStats(){
    document.querySelectorAll('.plant-row').forEach(function(row){
      Object.keys(STAT_CLASS_MAP).forEach(function(k){
        ensureSpan(row, STAT_CLASS_MAP[k]).setAttribute('data-liga','0');
      });
    });
  }

  function inc(row, key, amount){
    amount = Number(amount || 1);
    if(!row || !STAT_CLASS_MAP[key]) return;
    var span = ensureSpan(row, STAT_CLASS_MAP[key]);
    span.setAttribute('data-liga', String((Number(span.getAttribute('data-liga') || 0)) + amount));
  }

  function parseType(ev){
    var type = String((ev && ev.type) || '').trim();
    var ico = String((ev && ev.ico) || '').replace(/️/g,'').trim();
    if(type === 'amarilla' || type === 'roja' || type === 'd-amarilla' || type === 'card') return 'card';
    if(type === 'pen-fallo' || type === 'pen-fallado') return 'pen-fallado';
    if(type) return type;
    if(ico === '⚽') return 'gol';
    if(ico === '🟨' || ico === '🟥' || ico === '🟨🟥') return 'card';
    if(ico === '🤦🥅' || ico === '🤦‍♂🥅' || ico === '🤦‍♂️🥅') return 'pen-prov';
    if(ico === '⚽🥅') return 'pen-gol';
    if(ico === '⚽❌') return 'pen-fallado';
    if(ico === '🖐🥅') return 'pen-parado';
    if(ico === '⚽🎯') return 'falta-gol';
    if(ico === '⚽🚫') return 'propia';
    if(ico === '⭐') return 'mvp';
    return '';
  }

  function applyEvent(index, teamName, ev){
    var canonicalTeam = canonicalTeamName(teamName);
    if(!canonicalTeam) return;
    var num = '';
    var name = '';
    if(Array.isArray(ev && ev.player)){
      num = String(ev.player[0] || '').trim();
      name = String(ev.player[1] || '').trim();
    } else {
      num = String((ev && (ev.num || ev.dorsal)) || '').trim();
      name = String((ev && (ev.name || ev.playerName || ev.jugador || ev.player)) || '').trim();
    }
    var row = null;
    if(num) row = index.byNum[canonicalTeam + '::' + num] || null;
    if(!row && name) row = index.byName[canonicalTeam + '::' + norm(name)] || null;
    if(!row) return;

    var type = parseType(ev);
    var ico = String((ev && ev.ico) || '').replace(/️/g,'').trim();
    if(type === 'gol') inc(row, 'gol', 1);
    else if(type === 'falta-gol') inc(row, 'falta-gol', 1);
    else if(type === 'pen-gol') inc(row, 'pen-gol', 1);
    else if(type === 'pen-fallado') inc(row, 'pen-fallado', 1);
    else if(type === 'pen-parado') inc(row, 'pen-parado', 1);
    else if(type === 'pen-prov') inc(row, 'pen-prov', 1);
    else if(type === 'propia') inc(row, 'propia', 1);
    else if(type === 'mvp') inc(row, 'mvp', 1);
    else if(type === 'card'){
      if(ico === '🟨') inc(row, 'yel', 1);
      else if(ico === '🟥') inc(row, 'red', 1);
      else if(ico === '🟨🟥') { inc(row, 'yel', 1); inc(row, 'red', 1); }
    }
  }

  function extractDomFallbackEvents(){
    var out = [];
    document.querySelectorAll('[id^="ml-acta-list-j"] .ml-evt-item').forEach(function(item){
      var list = item.closest('[id^="ml-acta-list-j"]');
      var matchKey = list ? String(list.id).replace('ml-acta-list-','') : '';
      var wrap = list ? list.closest('.match-live-wrap') : null;
      var teamA = '';
      var teamB = '';
      if(matchKey){
        var aEl = document.getElementById('ml-team-a-' + matchKey);
        var bEl = document.getElementById('ml-team-b-' + matchKey);
        if(aEl) teamA = aEl.textContent.trim();
        if(bEl) teamB = bEl.textContent.trim();
      }
      var teamTxt = item.querySelector('.ml-evt-team');
      var icoEl = item.querySelector('.ml-evt-ico');
      var nameEl = item.querySelector('.ml-evt-name');
      if(!icoEl || !nameEl) return;
      var raw = String(nameEl.textContent || '').trim();
      var m = raw.match(/^(\d+)\.\s*(.*)$/);
      out.push({
        matchKey: matchKey,
        teamName: teamTxt ? teamTxt.textContent.trim() : '',
        ev: {
          ico: icoEl.textContent.trim(),
          player: [m ? m[1] : '', m ? m[2] : raw]
        }
      });
    });
    return out;
  }

  function rebuildLigaPlayerStatsFixed(){
    resetLigaStats();
    var index = buildRosterIndex();
    var done = {};
    var store = window.LIGA_PLAYER_MATCH_STORE || {};

    Object.keys(store).forEach(function(matchKey){
      var data = store[matchKey] || {};
      done[matchKey] = true;
      (data.evts || []).forEach(function(ev){
        var teamName = canonicalTeamName(ev && (ev.realTeam || ev.teamName || ev.team_label || (ev.team === 'a' ? data.teamA : ev.team === 'b' ? data.teamB : ev.team)) || '');
        applyEvent(index, teamName, ev);
      });
      // MVP ya viene dentro de data.evts — NO aplicar de nuevo para evitar doble conteo
    });

    extractDomFallbackEvents().forEach(function(x){
      if(x.matchKey && done[x.matchKey]) return;
      applyEvent(index, x.teamName, x.ev);
    });

    if(typeof window.buildLigaStatsDashboard === 'function') window.buildLigaStatsDashboard();
    // Refresh visible plant-stat columns for the active competition filter
    _refreshVisiblePlantStats();
  }

  function _refreshVisiblePlantStats() {
    // Update visible cell text from data-liga attributes
    var comp = 'liga';
    document.querySelectorAll('.plant-row').forEach(function(row) {
      var isPor = row.classList.contains('por');
      var tipos = isPor
        ? ['gol','yel','red','mvp','poder','pen-parado','pen-prov','pen-gol','falta-gol','propia']
        : ['gol','yel','red','mvp','poder','pen-gol','pen-prov','pen-parado','falta-gol','propia'];
      var cols = row.querySelectorAll('.plant-stat');
      tipos.forEach(function(tipo, i) {
        if (!cols[i]) return;
        if (tipo === 'poder') return; // poder is static
        var span = row.querySelector('.ps-' + tipo);
        if (!span) return;
        var v = parseInt(span.getAttribute('data-' + comp) || span.getAttribute('data-global') || '0');
        cols[i].textContent = v;
        cols[i].className = 'plant-stat' + (v > 0 ? (' ' + tipo) : ' zero');
      });
      var anyActive = Array.from(row.querySelectorAll('.plant-stat'))
        .some(function(c){ return !c.classList.contains('zero'); });
      row.classList.toggle('has-stat', anyActive);
    });
  }
  window._refreshVisiblePlantStats = _refreshVisiblePlantStats;

  window.rebuildLigaPlayerStatsFixed = rebuildLigaPlayerStatsFixed;

  // No se envuelve registrarLigaPlayerStats para evitar doble reconstrucción al editar MVP

  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(function(){ (window.rebuildLigaPlayerStatsFixed || rebuildLigaPlayerStatsFixed)(); }, 150);
  });

  var _origGo2 = window.go;
  if(typeof _origGo2 === 'function'){
    window.go = function(id){
      var res = _origGo2.apply(this, arguments);
      if(id === 's-liga-stats') setTimeout(rebuildLigaPlayerStatsFixed, 0);
      // Also refresh visible plant stats when visiting any team screen
      var teamScreens = ['s-madrid','s-barca','s-munich','s-atletico','s-arsenal','alaves-screen',
        's-sevilla','s-villarreal','s-getafe','s-espanyol','s-albacete',
        'celta-screen','osasuna-screen','alaves-screen','girona-screen',
        'oviedo-screen','levante-screen','mallorca-screen','elche-screen','valencia-screen','rayo-screen'];
      if (teamScreens.indexOf(id) !== -1) {
        setTimeout(function() {
          if (typeof window._refreshVisiblePlantStats === 'function') window._refreshVisiblePlantStats();
        }, 300);
      }
      return res;
    };
  }
})();


/* script block 25 */

(function(){

  /* ─────────────────────────────────────────────────
     1. ESTADO DEL MARCADOR: GRIS / ROJO / AMARILLO
     ─────────────────────────────────────────────── */
  var ALL_MIDS = ['j1m1','j1m2','j1m3','j1m4','j1m5','j1m6','j1m7','j1m8','j1m9','j1m10'];

  function getScoreEl(mid) {
    var a = document.getElementById('sc-' + mid + '-a');
    return a ? a.closest('.ml-score') : null;
  }

  function setScoreState(mid, state) {
    var el = getScoreEl(mid);
    if (!el) return;
    el.classList.remove('state-pending','state-playing','state-finished');
    el.classList.add('state-' + state);
  }
  // Expose globally so _renderTimer functions can call it directly
  window._setScoreState = setScoreState;

  // Init all to pending
  function initStates() {
    ALL_MIDS.forEach(function(mid) { setScoreState(mid, 'pending'); });
  }

  /* Patch human match timers (j1m1-j1m3) */
  function patchHumanTimers() {
    ['j1m1','j1m2','j1m3'].forEach(function(mid) {
      var clickName = 'mlTimerClick_' + mid;
      var origClick = window[clickName];
      if (typeof origClick !== 'function') return; // safe guard
      window[clickName] = function() {
        var res;
        try { res = origClick.apply(this, arguments); } catch(e) {}
        setTimeout(function() { syncHumanState(mid); }, 50);
        return res;
      };
    });
  }

  function syncHumanState(mid) {
    var btn = document.getElementById('ml-timer-' + mid);
    if (!btn) return;
    if (btn.classList.contains('finished') || btn.textContent.indexOf('FIN') !== -1) {
      setScoreState(mid, 'finished');
    } else if (btn.classList.contains('running')) {
      setScoreState(mid, 'playing');
    } else {
      // If timer has been started at least once (seconds > 0), keep as pending
      // We use a data attribute to track "ever started"
      var ever = btn.getAttribute('data-ever-started');
      if (ever) {
        setScoreState(mid, 'pending'); // paused but not finished
      }
    }
  }

  /* Patch IA simulate functions (j1m4-j1m10) */
  function patchIASimulate() {
    ['j1m4','j1m5','j1m6','j1m7','j1m8','j1m9','j1m10'].forEach(function(mid) {
      var simName = 'mlSimulate_' + mid;
      var origSim = window[simName];
      if (typeof origSim !== 'function') return;
      window[simName] = function() {
        setScoreState(mid, 'playing');
        var res = origSim.apply(this, arguments);
        // After ~30s simulation finishes (max sim time is ~30500ms)
        setTimeout(function() { setScoreState(mid, 'finished'); }, 31000);
        return res;
      };
    });
  }

  /* Watch timer buttons for human matches via MutationObserver */
  function watchTimerBtns() {
    ['j1m1','j1m2','j1m3'].forEach(function(mid) {
      var btn = document.getElementById('ml-timer-' + mid);
      if (!btn) return;
      var obs = new MutationObserver(function() {
        if (btn.classList.contains('finished') || btn.textContent.indexOf('FIN') !== -1) {
          setScoreState(mid, 'finished');
        } else if (btn.classList.contains('running')) {
          btn.setAttribute('data-ever-started','1');
          setScoreState(mid, 'playing');
        } else {
          var ever = btn.getAttribute('data-ever-started');
          if (!ever) setScoreState(mid, 'pending');
          // If paused, keep current (playing→paused still shows red is fine,
          // but let's keep grey until first start)
        }
      });
      obs.observe(btn, { attributes: true, characterData: true, subtree: true, childList: true });
    });
  }

  /* Watch IA timer btn text for "FIN" */
  function watchIATimers() {
    ['j1m4','j1m5','j1m6','j1m7','j1m8','j1m9','j1m10'].forEach(function(mid) {
      var btn = document.getElementById('ml-timer-' + mid);
      if (!btn) return;
      var obs = new MutationObserver(function() {
        var txt = btn.textContent || '';
        if (txt.indexOf('FIN') !== -1 || btn.classList.contains('finished')) {
          setScoreState(mid, 'finished');
        } else if (txt.indexOf('SIMULAR') === -1 && txt !== '') {
          // Simulation running
          setScoreState(mid, 'playing');
        }
      });
      obs.observe(btn, { attributes: true, characterData: true, subtree: true, childList: true });
    });
  }

  /* ─────────────────────────────────────────────────
     2. MODAL DE EDICIÓN DE EVENTOS
     ─────────────────────────────────────────────── */
  var _editState = { mid: null, evId: null };

  var ICONS = {
    gol:'⚽', propia:'⚽🚫', 'pen-gol':'⚽🥅', 'pen-fallo':'❌🥅',
    'pen-prov':'🤦🥅', 'pen-parado':'🖐🥅', 'falta-gol':'⚽🎯',
    amarilla:'🟨', 'd-amarilla':'🟨🟥', roja:'🟥', lesion:'🩹', mvp:'⭐'
  };
  var SCORING = ['gol','propia','pen-gol','falta-gol'];

  /* Get _events array for a given match (they live in separate scopes,
     but are exposed on the match's HTML via a registry we build) */
  function getEventsRegistry() {
    if (!window._matchEventsRegistry) window._matchEventsRegistry = {};
    return window._matchEventsRegistry;
  }

  /* ─────────────────────────────────────────────────
     REGISTRY: captura referencias vivas a _events y _sc
     de cada partido humano parcheando sus funciones
     ─────────────────────────────────────────────── */
  window.__eventsRegistry = {};

  function buildEventsRegistry() {
    ['j1m1','j1m2','j1m3'].forEach(function(mid) {

      // Patch mlPlConfirm (player-picker confirm) to register live refs
      var origConfirm = window['mlPlConfirm_' + mid];
      if (typeof origConfirm === 'function') {
        window['mlPlConfirm_' + mid] = function(num, name) {
          origConfirm.apply(this, arguments);
          // After push, snapshot the live arrays via the del function closure trick
          _captureRegistry(mid);
        };
      }

      // Patch mlDelEvt to register live refs (it has access to _events/_sc in closure)
      var origDel = window['mlDelEvt_' + mid];
      if (typeof origDel === 'function') {
        window['mlDelEvt_' + mid] = function(id) {
          origDel.apply(this, arguments);
          _captureRegistry(mid);
        };
      }

      // Also patch _renderActa to expose it globally for the save function
      var origRender = window['_renderActa_' + mid];
      if (typeof origRender === 'function') {
        window['_renderActa_' + mid] = function() {
          var res = origRender.apply(this, arguments);
          _captureRegistry(mid);
          return res;
        };
      }
    });
  }

  /* Capture the live _events array and _sc object by reading from the DOM
     and keeping a registry that _saveEditModal can mutate directly.
     Since we can't access the IIFE vars, we maintain a PARALLEL registry
     that stays in sync via patched functions. */
  function _captureRegistry(mid) {
    // Read current state from DOM
    var list = document.getElementById('ml-acta-list-' + mid);
    if (!list) return;
    var items = list.querySelectorAll('.ml-evt-item');
    var events = [];
    items.forEach(function(item) {
      var delBtn = item.querySelector('.ml-evt-del');
      var idMatch = delBtn ? (delBtn.getAttribute('onclick')||'').match(/\((\d+)\)/) : null;
      var id = idMatch ? parseInt(idMatch[1]) : null;
      if (!id) return;
      var minEl  = item.querySelector('.ml-evt-min');
      var icoEl  = item.querySelector('.ml-evt-ico');
      var nameEl = item.querySelector('.ml-evt-name');
      var minTxt = minEl ? minEl.textContent.replace("'",'').trim() : '0';
      var nameTxt = nameEl ? nameEl.textContent.trim() : '';
      var dotPos = nameTxt.indexOf('. ');
      var num  = dotPos !== -1 ? nameTxt.slice(0, dotPos).trim() : '';
      var name = dotPos !== -1 ? nameTxt.slice(dotPos + 2).trim() : nameTxt;
      var scAEl = document.getElementById('sc-' + mid + '-a');
      var scBEl = document.getElementById('sc-' + mid + '-b');
      events.push({
        id: id,
        min: parseInt(minTxt) || 0,
        type: item.getAttribute('data-type') || '',
        team: item.getAttribute('data-team') || 'a',
        ico: icoEl ? icoEl.textContent.trim() : '',
        num: num,
        name: name
      });
      if (!window.__eventsRegistry[mid]) {
        window.__eventsRegistry[mid] = { events: events, sc: {a:0,b:0}, renderActa: null };
      }
    });
    // Recalculate score from events
    var sa = 0, sb = 0;
    events.forEach(function(ev) {
      var scoring = ['gol','propia','pen-gol','falta-gol'];
      if (scoring.indexOf(ev.type) !== -1) {
        var st = ev.type === 'propia' ? (ev.team === 'a' ? 'b' : 'a') : ev.team;
        if (st === 'a') sa++; else sb++;
      }
    });
    if (!window.__eventsRegistry[mid]) {
      window.__eventsRegistry[mid] = { events: [], sc: {a:0,b:0}, renderActa: null };
    }
    window.__eventsRegistry[mid].events = events;
    window.__eventsRegistry[mid].sc = {a: sa, b: sb};
    window.__eventsRegistry[mid].renderActa = window['_renderActa_' + mid];
  }

  /* Read events from DOM (data-team, data-type already set + we need id from onclick) */
  function getEventsFromDOM(mid) {
    var list = document.getElementById('ml-acta-list-' + mid);
    if (!list) return [];
    var items = list.querySelectorAll('.ml-evt-item');
    var evs = [];
    items.forEach(function(item) {
      var editBtn = item.querySelector('.ml-evt-edit');
      var delBtn  = item.querySelector('.ml-evt-del');
      if (!editBtn && !delBtn) return;
      // extract id from onclick of del button: mlDelEvt_jXmX(ID)
      var idMatch = delBtn ? (delBtn.getAttribute('onclick')||'').match(/\((\d+)\)/) : null;
      var id = idMatch ? parseInt(idMatch[1]) : null;
      var minEl   = item.querySelector('.ml-evt-min');
      var icoEl   = item.querySelector('.ml-evt-ico');
      var nameEl  = item.querySelector('.ml-evt-name');
      var teamEl  = item.querySelector('.ml-evt-team');
      var minTxt  = minEl ? minEl.textContent.replace("'",'').trim() : '0';
      var nameTxt = nameEl ? nameEl.textContent.trim() : '';
      var numPart = nameTxt.split('.')[0] || '';
      var namePart = nameTxt.indexOf('. ') !== -1 ? nameTxt.split('. ').slice(1).join('. ') : nameTxt;
      evs.push({
        id: id,
        min: parseInt(minTxt)||0,
        type: item.getAttribute('data-type') || '',
        team: item.getAttribute('data-team') || 'a',
        ico: icoEl ? icoEl.textContent.trim() : '',
        num: numPart.trim(),
        name: namePart.trim(),
        teamLabel: teamEl ? teamEl.textContent.trim() : ''
      });
    });
    return evs;
  }

  /* Get squads for a match */
  function getSquadsForMatch(mid) {
    var sqA = [], sqB = [], nameA = '', nameB = '';
    var scA = document.getElementById('sc-' + mid + '-a');
    if (scA) {
      var header = scA.closest('.ml-header');
      if (header) {
        var names = header.querySelectorAll('.ml-team-name');
        if (names[0]) nameA = names[0].textContent.trim();
        if (names[1]) nameB = names[1].textContent.trim();
      }
    }
    // Try SQUAD_REGISTRY first
    if (nameA && window.SQUAD_REGISTRY && window.SQUAD_REGISTRY[nameA]) sqA = window.SQUAD_REGISTRY[nameA];
    else if (window['_sqA_' + mid]) sqA = window['_sqA_' + mid];
    if (nameB && window.SQUAD_REGISTRY && window.SQUAD_REGISTRY[nameB]) sqB = window.SQUAD_REGISTRY[nameB];
    else if (window['_sqB_' + mid]) sqB = window['_sqB_' + mid];
    return { sqA: sqA, sqB: sqB, nameA: nameA, nameB: nameB };
  }

  /* Build optgroup options for a squad array */
  function buildSquadOptions(sq, teamName) {
    var html = '<optgroup label="——  ' + teamName + '  ——">';
    sq.forEach(function(p) {
      if (p.h) {
        html += '</optgroup><optgroup label="' + p.h + '">';
      } else {
        html += '<option value="' + p[0] + '|' + p[1].replace(/"/g,'&quot;') + '">' + p[0] + '. ' + p[1] + '</option>';
      }
    });
    html += '</optgroup>';
    return html;
  }

  /* When player selected from selector, fill manual field */
  window._onEditPlayerSel = function(val) {
    if (!val) return;
    var parts = val.split('|');
    var num = parts[0] || '';
    var name = parts.slice(1).join('|') || '';
    document.getElementById('_editManual').value = num + '. ' + name;
  };

  window._openEditModal = function(mid, evId) {
    var evs = getEventsFromDOM(mid);
    var ev  = evs.find(function(e){ return e.id === evId; });
    if (!ev) return;

    _editState.mid  = mid;
    _editState.evId = evId;

    // Set type, team, min
    document.getElementById('_editType').value = ev.type || 'gol';
    document.getElementById('_editMin').value  = ev.min  || 1;

    // Update team labels
    var sq = getSquadsForMatch(mid);
    var selTeam = document.getElementById('_editTeam');
    selTeam.options[0].text = (sq.nameA || 'Local') + ' (local)';
    selTeam.options[1].text = (sq.nameB || 'Visitante') + ' (visitante)';
    selTeam.value = ev.team || 'a';

    // Populate squad selector
    var selPl = document.getElementById('_editPlayerSel');
    var optHTML = '<option value="">— seleccionar jugador —</option>';
    optHTML += buildSquadOptions(sq.sqA, sq.nameA || 'Local');
    optHTML += buildSquadOptions(sq.sqB, sq.nameB || 'Visitante');
    selPl.innerHTML = optHTML;
    selPl.value = '';

    // Fill manual field with current num. name
    var manual = ev.num ? (ev.num + '. ' + ev.name) : ev.name;
    document.getElementById('_editManual').value = manual || '';

    var m = document.getElementById('_editModal');
    m.style.display = '';
    m.classList.add('show');
  };

  function updateTeamLabels(mid) {
    // kept for compatibility but now handled in _openEditModal
  }

  window._closeEditModal = function() {
    var m = document.getElementById('_editModal');
    if (m) { m.classList.remove('show'); m.style.display = 'none'; }
    _editState.mid  = null;
    _editState.evId = null;
  };

  window._saveEditModal = function() {
    var mid   = _editState.mid;
    var evId  = _editState.evId;
    if (!mid || !evId) return;

    var newType   = document.getElementById('_editType').value;
    var newTeam   = document.getElementById('_editTeam').value;
    var newMin    = parseInt(document.getElementById('_editMin').value) || 1;
    var manualVal = document.getElementById('_editManual').value.trim();

    if (!manualVal) { alert('⚠️ Escribe el jugador manualmente o selecciónalo de la plantilla.'); return; }

    var newNum = '', newName = '';
    var dotIdx = manualVal.indexOf('. ');
    if (dotIdx !== -1) {
      newNum  = manualVal.slice(0, dotIdx).trim();
      newName = manualVal.slice(dotIdx + 2).trim();
    } else {
      newName = manualVal;
    }
    if (!newName) { alert('⚠️ El nombre del jugador es obligatorio.'); return; }

    var humanMids = ['j1m1','j1m2','j1m3'];
    if (humanMids.indexOf(mid) !== -1) {
      // Step 1: delete old event — correctly updates internal _events[] and _sc{}
      var delFn = window['mlDelEvt_' + mid];
      if (typeof delFn === 'function') delFn(evId);

      // Step 2: inject the new event directly using mlPlConfirm after setting _pendingEvt
      // via mlDirectPick (which sets the IIFE-scoped _pendingEvt), then suppress the UI.
      // We temporarily replace mlShowPl to be a no-op so no picker overlay opens,
      // and replace _currentMin to return our desired minute.
      var origShowPl   = window['mlShowPl_' + mid];
      var origMinFn    = window['_currentMin_' + mid];

      window['mlShowPl_' + mid]    = function() {}; // suppress picker UI
      window['_currentMin_' + mid] = function() { return newMin; };

      // mlDirectPick sets scoped _pendingEvt then calls mlShowPl (now no-op)
      var directPickFn = window['mlDirectPick_' + mid];
      if (typeof directPickFn === 'function') directPickFn(ICONS[newType] || newType, newType, newTeam);

      // mlPlConfirm reads the scoped _pendingEvt and pushes to _events[]
      var confirmFn = window['mlPlConfirm_' + mid];
      if (typeof confirmFn === 'function') confirmFn(newNum || '0', newName);

      // Restore patched functions
      window['mlShowPl_' + mid]    = origShowPl;
      window['_currentMin_' + mid] = origMinFn;

      window._closeEditModal();
      return;
    }

    // Fallback for IA matches
    var delFnIA = window['mlDelEvt_' + mid];
    if (typeof delFnIA === 'function') delFnIA(evId);
    injectEventDOM(mid, newType, newTeam, newMin, newNum, newName);
    window._closeEditModal();
  };

  /* Inject event directly into DOM as fallback */
  function injectEventDOM(mid, type, team, min, num, name) {
    var list = document.getElementById('ml-acta-list-' + mid);
    if (!list) return;
    var emp = list.querySelector('.ml-acta-empty');
    if (emp) emp.remove();
    var ico = ICONS[type] || '•';
    var scA = document.getElementById('sc-' + mid + '-a');
    var header = scA ? scA.closest('.ml-header') : null;
    var names = header ? header.querySelectorAll('.ml-team-name') : [];
    var teamLabel = team === 'a' ? (names[0] ? names[0].textContent : 'Local') : (names[1] ? names[1].textContent : 'Visitante');
    var newId = Date.now();
    var row = document.createElement('div');
    row.className = 'ml-evt-item';
    row.setAttribute('data-team', team);
    row.setAttribute('data-type', type);
    row.innerHTML = '<span class="ml-evt-min">'+min+"'</span>"
      + '<span class="ml-evt-ico">'+ico+'</span>'
      + '<span class="ml-evt-name">'+num+'. '+name+'</span>'
      + '<span class="ml-evt-team">'+teamLabel+'</span>'
      + '<button class="ml-evt-edit" onclick="window._openEditModal(\''+mid+'\','+newId+')" title="Editar">✏️</button>'
      + '<button class="ml-evt-del" onclick="mlDelEvt_'+mid+'('+newId+')">✕</button>';
    // Insert in sorted position
    var items = list.querySelectorAll('.ml-evt-item');
    var inserted = false;
    for (var i = 0; i < items.length; i++) {
      var m = parseInt((items[i].querySelector('.ml-evt-min')||{}).textContent||'999');
      if (min < m) { list.insertBefore(row, items[i]); inserted = true; break; }
    }
    if (!inserted) list.appendChild(row);
  }

  /* Expose _pushEvent_jXmX for each human match so saveEditModal can use it.
     This function needs to access the match's closed-scope _events and _sc.
     We do this by patching the existing render function which is in scope. */
  function exposePushEvent(mid) {
    /* We intercept _renderActa to capture the events reference.
       But since _events is a var in IIFE scope, we need another trick:
       We parse the current acta DOM to reconstruct score deltas. */

    /* The cleanest way without touching the original IIFE is to:
       1. Count current score from acta DOM
       2. After delFn removes the event, recalculate score from remaining events
       3. Push new event by calling the existing add pathway (mlDirectPick + mlPlConfirm) */

    window['_pushEvent_' + mid] = function(type, team, min, num, name) {
      /* Recalculate scores from DOM after deletion */
      setTimeout(function() {
        var list = document.getElementById('ml-acta-list-' + mid);
        if (!list) return;
        var items = list.querySelectorAll('.ml-evt-item');
        var sa = 0, sb = 0;
        items.forEach(function(item) {
          var t = item.getAttribute('data-type');
          var te = item.getAttribute('data-team');
          if (t === 'gol' || t === 'falta-gol' || t === 'pen-gol') {
            if (te === 'a') sa++; else sb++;
          } else if (t === 'propia') {
            if (te === 'a') sb++; else sa++;
          }
        });

        /* Now add the new event score contribution */
        var scoringTypes = ['gol','propia','pen-gol','falta-gol'];
        if (scoringTypes.indexOf(type) !== -1) {
          var st = (type === 'propia') ? (team === 'a' ? 'b' : 'a') : team;
          if (st === 'a') sa++; else sb++;
        }

        /* Update score display */
        var scAEl = document.getElementById('sc-' + mid + '-a');
        var scBEl = document.getElementById('sc-' + mid + '-b');
        if (scAEl) scAEl.textContent = sa;
        if (scBEl) scBEl.textContent = sb;

        /* Inject the event row */
        injectEventDOM(mid, type, team, min, num, name);

      }, 60);
    };
  }

  /* ─────────────────────────────────────────────────
     INIT — compatible con archivos locales (content://)
     ─────────────────────────────────────────────── */
  function _doInit() {
    initStates();
    patchIASimulate();
    watchIATimers();
    buildEventsRegistry();
    ['j1m1','j1m2','j1m3'].forEach(exposePushEvent);
  }

  // Ejecutar con múltiples estrategias para garantizar que funcione
  // en Android con content:// o file://
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(_doInit, 100);
    });
  } else {
    // Ya cargado (inline script ejecutado después del DOM)
    setTimeout(_doInit, 100);
  }

  // Close Twitch menus on outside click
  document.addEventListener('click', function() {
    document.querySelectorAll('.ml-twitch-menu.open').forEach(function(m){ m.classList.remove('open'); });
  });

  // Close modal on backdrop click
  document.getElementById('_editModal').addEventListener('click', function(e) {
    if (e.target === this) window._closeEditModal();
  });

})();


/* script block 26 */

(function(){

  // ══ STORES GLOBALES ══════════════════════════════════════════
  window.YELLOW_STORE   = window.YELLOW_STORE   || {};  // acumulación amarillas
  window.SANCION_STORE  = window.SANCION_STORE  || {};  // sanciones pendientes pre-partido
  window._sancionShownFor = window._sancionShownFor || {};
  window._sancionCallback = null;
  window._spostCallback   = null;

  // ══ CONFIG CICLOS POR COMPETICIÓN ════════════════════════════
  var COMP_CONFIG = {
    'liga':       { label:'Liga EA Sports',            ciclo:3, esFinal:false },
    'copa':       { label:'Copa del Rey',              ciclo:2, esFinal:false },
    'copa-fin':   { label:'Copa del Rey · Final',      ciclo:2, esFinal:true  },
    'sc':         { label:'Supercopa de España',       ciclo:2, esFinal:false },
    'sc-final':   { label:'Supercopa · Final',         ciclo:2, esFinal:true  },
    'usc':        { label:'UEFA Super Cup',            ciclo:2, esFinal:false },
    'usc-fin':    { label:'UEFA Super Cup · Final',    ciclo:2, esFinal:true  },
    'ucl':        { label:'Champions League',          ciclo:2, esFinal:false },
    'ucl-fin':    { label:'Champions League · Final',  ciclo:2, esFinal:true  },
    'uel':        { label:'Europa League',             ciclo:2, esFinal:false },
    'uel-fin':    { label:'Europa League · Final',     ciclo:2, esFinal:true  },
    'uecl':       { label:'Conference League',         ciclo:2, esFinal:false },
    'uecl-fin':   { label:'Conference League · Final', ciclo:2, esFinal:true  },
    'superliga':  { label:'Superliga',                 ciclo:2, esFinal:false },
    'inter':      { label:'Copa Intercontinental',     ciclo:2, esFinal:false },
    'inter-fin':  { label:'Intercontinental · Final',  ciclo:2, esFinal:true  },
  };

  // ══ MAPEO BLOQUE-ID → COMP KEY ═══════════════════════════════
  function getCompFromBlockId(id) {
    if (!id) return null;
    if (id === 'cal-copa-fin')     return 'copa-fin';
    if (id === 'sc-final')         return 'sc-final';
    if (id === 'cal-usc-f')        return 'usc-fin';
    if (id === 'ucl-fin')          return 'ucl-fin';
    if (id === 'uel-fin')          return 'uel-fin';
    if (id === 'uecl-fin')         return 'uecl-fin';
    if (id === 'cal-inter-f')      return 'inter-fin';
    if (id === 'sc-semis')         return 'sc';
    if (id.startsWith('cal-sc-'))  return 'sc';
    if (id.startsWith('cal-usc-')) return 'usc';
    if (id.startsWith('cal-copa-'))return 'copa';
    if (id.startsWith('cal-l'))    return 'liga';
    if (id.startsWith('ucl-'))     return 'ucl';
    if (id.startsWith('uel-'))     return 'uel';
    if (id.startsWith('uecl-'))    return 'uecl';
    if (id.startsWith('cal-sl'))   return 'superliga';
    if (id.startsWith('cal-inter-'))return 'inter';
    return null;
  }

  // ══ SORTEO DE PARTIDOS DE SUSPENSIÓN ════════════════════════
  // Doble amarilla → 1 o 2 partidos (50/50)
  function sorteoDobleAmarilla() {
    return Math.random() < 0.5 ? 1 : 2;
  }
  // Roja directa → 2-8 partidos con pesos decrecientes
  // 2:35% | 3:25% | 4:17% | 5:10% | 6:7% | 7:4% | 8:2%
  function sorteoRojaDirecta() {
    var r = Math.random();
    if (r < 0.35) return 2;
    if (r < 0.60) return 3;
    if (r < 0.77) return 4;
    if (r < 0.87) return 5;
    if (r < 0.94) return 6;
    if (r < 0.98) return 7;
    return 8;
  }

  // ══ MOTOR: calcular sanciones de un partido ══════════════════
  // events: array de eventos del partido
  // humanTeam: 'a' o 'b' (el equipo humano)
  // teamName: nombre del equipo humano
  // compKey: clave de competición
  // Devuelve array de { name, team, reason, partidos, tipo }
  window.calcularSancionesPartido = function(events, humanTeam, teamName, compKey) {
    var cfg   = COMP_CONFIG[compKey] || { label: compKey, ciclo: 3, esFinal: false };
    var result = [];
    if (!events || !events.length) return result;

    // Yellows acumulados de este partido por jugador (solo equipo humano)
    var yellowsEnPartido = {};
    var processedExpulsion = {};

    events.forEach(function(ev) {
      if (ev.team !== humanTeam) return;
      var key = ev.num + '::' + ev.name;

      // ── Amarilla simple ──
      if (ev.type === 'amarilla') {
        // Acumular en YELLOW_STORE para ciclo
        var compStore = window.YELLOW_STORE[compKey] = window.YELLOW_STORE[compKey] || {};
        var playerKey = ev.name + '::' + teamName;
        if (!compStore[playerKey]) compStore[playerKey] = { name: ev.name, team: teamName, count: 0 };
        compStore[playerKey].count++;

        // Comprobar si alcanzó ciclo
        if (compStore[playerKey].count >= cfg.ciclo) {
          compStore[playerKey].count = 0; // reset ciclo
          // Calcular sorteo (acumulación = 1 partido siempre según reglamento)
          if (!processedExpulsion[key]) {
            processedExpulsion[key] = true;
            result.push({
              name: ev.name,
              team: teamName,
              tipo: 'acumulacion',
              reason: cfg.ciclo + ' 🟨 acumuladas (ciclo completado)',
              partidos: 1
            });
            // Añadir a SANCION_STORE para próxima apertura de partido
            _addSancion(ev.name, teamName, compKey, 'Ciclo de amarillas — 1 partido');
          }
        }
      }

      // ── Doble amarilla (expulsión, NO suma ciclo) ──
      else if (ev.type === 'd-amarilla') {
        if (!processedExpulsion[key]) {
          processedExpulsion[key] = true;
          var partidos = sorteoDobleAmarilla();
          result.push({
            name: ev.name,
            team: teamName,
            tipo: 'd-amarilla',
            reason: 'Doble amarilla — expulsión',
            partidos: partidos
          });
          _addSancion(ev.name, teamName, compKey, 'Doble amarilla — ' + partidos + (partidos === 1 ? ' partido' : ' partidos'));
        }
      }

      // ── Roja directa ──
      else if (ev.type === 'roja') {
        if (!processedExpulsion[key]) {
          processedExpulsion[key] = true;
          var pts = sorteoRojaDirecta();
          result.push({
            name: ev.name,
            team: teamName,
            tipo: 'roja',
            reason: 'Roja directa',
            partidos: pts
          });
          _addSancion(ev.name, teamName, compKey, 'Roja directa — ' + pts + ' partido' + (pts > 1 ? 's' : ''));
        }
      }
    });

    return result;
  };

  function _addSancion(playerName, teamName, comp, reason) {
    if (!window.SANCION_STORE[comp]) window.SANCION_STORE[comp] = [];
    var exists = window.SANCION_STORE[comp].some(function(s) {
      return s.name === playerName && s.team === teamName;
    });
    if (!exists) {
      window.SANCION_STORE[comp].push({ name: playerName, team: teamName, reason: reason });
    }
  }

  window.cumplirSancion = function(playerName, teamName, compKey) {
    var comp = compKey || 'liga';
    if (!window.SANCION_STORE[comp]) return;
    window.SANCION_STORE[comp] = window.SANCION_STORE[comp].filter(function(s) {
      return !(s.name === playerName && s.team === teamName);
    });
  };

  // ══ OVERLAY PRE-PARTIDO ══════════════════════════════════════
  window.showSancionOverlay = function(compKey, blockId, onConfirm) {
    var cfg = COMP_CONFIG[compKey] || { label: compKey, esFinal: false };
    var sanciones = (!cfg.esFinal && window.SANCION_STORE[compKey]) ? window.SANCION_STORE[compKey] : [];
    var compLbl = document.getElementById('sancion-ov-comp-lbl');
    var warnEl  = document.getElementById('sancion-ov-warn');
    var listYel = document.getElementById('sancion-ov-list-yel');
    var listRed = document.getElementById('sancion-ov-list-red');
    var listInj = document.getElementById('sancion-ov-list-inj');
    if (!listYel) { if (onConfirm) onConfirm(); return; }

    // Añadir jornada/ronda al label de competición
    var ROUND_MAP = {
      'cal-l1':'J1','cal-l2':'J2','cal-l3':'J3','cal-l4':'J4',
      'cal-l5':'J5','cal-l6':'J6','cal-l7':'J7','cal-l8':'J8',
      'cal-l9':'J9','cal-l10':'J10','cal-l11':'J11','cal-l12':'J12',
      'cal-eu1':'Grupo J1','cal-eu2':'Grupo J2','cal-eu3':'Grupo J3','cal-eu4':'Grupo J4',
      'cal-copa-1r':'1ª Ronda','cal-copa-2r':'2ª Ronda','cal-copa-16':'Dieciseisavos',
      'cal-copa-8':'Octavos','cal-copa-4':'Cuartos','cal-copa-sf':'Semis','cal-copa-fin':'Final',
      'cal-sc-s':'Semis','sc-semis':'Semis','sc-final':'Final',
      'cal-usc-s':'Semis','cal-usc-f':'Final',
      'cal-rm1':'J1','cal-rm2':'J2','cal-rm3':'J3',
      'cal-sl1':'J1','cal-sl2':'J2','cal-sl3':'J3',
      'ucl-fin':'Final','uel-fin':'Final','uecl-fin':'Final','cal-inter-f':'Final'
    };
    var resolvedBlockId = blockId || window._ppBlockId || null;
    var compLabel = cfg.label;
    if (resolvedBlockId && ROUND_MAP[resolvedBlockId]) {
      compLabel += ' · ' + ROUND_MAP[resolvedBlockId];
    }
    if (compLbl) compLbl.textContent = compLabel;
    window._sancionCallback = onConfirm || null;

    // Separar sanciones por tipo
    var san = sanciones.filter(function(s){ return s.tipo === 'amarilla' || !s.tipo; });
    var exp = sanciones.filter(function(s){ return s.tipo === 'roja' || s.tipo === 'd-amarilla'; });


    function renderCard(s, ico) {
      var partidos = s.partidos ? s.partidos : null;
      return '<div class="sancion-card">'
        + '<div class="sancion-card-icon">' + ico + '</div>'
        + '<div class="sancion-card-info">'
        + '<div class="sancion-card-name">' + s.name + '</div>'
        + '<div class="sancion-card-team">' + s.team + '</div>'
        + '<div class="sancion-card-reason">' + s.reason + '</div>'
        + '</div>'
        + (partidos ? '<div class="sancion-card-partidos"><span class="sancion-card-pnum">' + partidos + '</span><span class="sancion-card-plbl">PARTIDO' + (partidos > 1 ? 'S' : '') + '</span></div>' : '')
        + '</div>';
    }
    function renderEmpty(txt) {
      return '<div class="sancion-empty">' + txt + '</div>';
    }

    // Lesionados desde LESION_STORE
    var injList = window.LESION_STORE ? Object.keys(window.LESION_STORE) : [];

    listYel.innerHTML = san.length ? san.map(function(s){ return renderCard(s,'🟨'); }).join('') : renderEmpty('✅ Sin sancionados');
    listRed.innerHTML = exp.length ? exp.map(function(s){ return renderCard(s,'🟥'); }).join('') : renderEmpty('✅ Sin expulsados');

    if (injList.length) {
      listInj.innerHTML = injList.map(function(nombre) {
        var l = window.LESION_STORE[nombre];
        var p = window.BAJA_STORE && window.BAJA_STORE[nombre] ? window.BAJA_STORE[nombre] : {};
        var colorGrado = l.grado === 3 ? '#ff4444' : l.grado === 2 ? '#ff8c00' : '#ffd700';
        var partsTxt = '';
        if (p.liga > 0)   partsTxt += '<span style="margin-right:8px">🇪🇸 ' + p.liga + 'P</span>';
        if (p.copa > 0)   partsTxt += '<span style="margin-right:8px">🏆 ' + p.copa + 'P</span>';
        if (p.europa > 0) partsTxt += '<span>🌍 ' + p.europa + 'P</span>';
        return '<div class="sancion-card">'
          + '<div class="sancion-card-icon">🩹</div>'
          + '<div class="sancion-card-info">'
          + '<div class="sancion-card-name">' + nombre + '</div>'
          + '<div class="sancion-card-team">' + l.equipo + '</div>'
          + '<div class="sancion-card-reason" style="color:' + colorGrado + '">' + l.gradoEmoji + ' ' + l.gradoNombre + ' — ' + l.descripcion + '</div>'
          + (partsTxt ? '<div style="font-family:Oswald,sans-serif;font-size:11px;color:#f0c040;margin-top:3px;">' + partsTxt + '</div>' : '')
          + '</div>'
          + '</div>';
      }).join('');
    } else {
      listInj.innerHTML = renderEmpty('🚑 Sin lesionados');
    }

    var hayBajas = san.length || exp.length || injList.length;
    // ── SOLO mostrar el overlay si hay algo que informar ──────────
    if (!hayBajas) {
      if (onConfirm) onConfirm();
      return;
    }
    if (warnEl) warnEl.style.display = hayBajas ? 'block' : 'none';

    document.getElementById('sancion-overlay').classList.add('show');
    window.scrollTo(0, 0);
  };

  window._sancionConfirm = function() {
    document.getElementById('sancion-overlay').classList.remove('show');
    if (window._sancionCallback) { window._sancionCallback(); window._sancionCallback = null; }
  };

  // ══ OVERLAY POST-PARTIDO ═════════════════════════════════════
  window.showSancionPostOverlay = function(sanciones, compKey, onConfirm) {
    var cfg = COMP_CONFIG[compKey] || { label: compKey };
    var listEl  = document.getElementById('spost-list');
    var compLbl = document.getElementById('spost-comp-lbl');
    var subEl   = document.getElementById('spost-sub');
    var iconEl  = document.getElementById('spost-icon');
    if (!listEl) { if (onConfirm) onConfirm(); return; }

    window._spostCallback = onConfirm || null;
    compLbl.textContent = cfg.label;

    if (!sanciones || !sanciones.length) {
      // Sin sanciones — no mostrar overlay
      if (onConfirm) onConfirm();
      return;
    }

    // Icono según tipo de sanción más grave
    var tieneRoja = sanciones.some(function(s){ return s.tipo === 'roja'; });
    var tieneDAmr = sanciones.some(function(s){ return s.tipo === 'd-amarilla'; });
    iconEl.textContent = tieneRoja ? '🟥' : tieneDAmr ? '🟨🟥' : '🟨';
    subEl.textContent  = sanciones.length === 1 ? 'UN JUGADOR SANCIONADO' : sanciones.length + ' JUGADORES SANCIONADOS';

    listEl.innerHTML = sanciones.map(function(s) {
      var tipoLabel = s.tipo === 'roja'         ? 'ROJA DIRECTA'
                    : s.tipo === 'd-amarilla'    ? 'DOBLE AMARILLA'
                    : 'ACUMULACIÓN DE AMARILLAS';
      return '<div class="spost-card">'
        + '<div class="spost-card-badge">' + tipoLabel + '</div>'
        + '<div class="spost-card-ico">' + (s.tipo==='roja'?'🟥': s.tipo==='d-amarilla'?'🟨🟥':'🟨') + '</div>'
        + '<div class="spost-card-info">'
        + '<div class="spost-card-name">' + s.name + '</div>'
        + '<div class="spost-card-team">' + s.team + '</div>'
        + '<div class="spost-card-reason">' + s.reason + '</div>'
        + '</div>'
        + '<div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">'
        + '<div class="spost-card-partidos">' + s.partidos + '</div>'
        + '<div class="spost-card-partidos-lbl">PARTIDO' + (s.partidos > 1 ? 'S' : '') + '</div>'
        + '</div>'
        + '</div>';
    }).join('');

    document.getElementById('sancion-post-overlay').classList.add('show');
    window.scrollTo(0, 0);
  };

  window._spostConfirm = function() {
    document.getElementById('sancion-post-overlay').classList.remove('show');
    if (window._spostCallback) { window._spostCallback(); window._spostCallback = null; }
  };

  // tog() sin intercepción de sanciones — los desplegables abren directamente
  // (el overlay de sanciones solo se muestra desde el botón PREVIA)

  // ══ HOOK EN mlEndMatch: llamar tras registrar resultado ══════
  // Se llama como: window.procesarSancionesPostPartido(events, humanTeam, teamName, compKey)
  window.procesarSancionesPostPartido = function(events, humanTeam, teamName, compKey) {
    var sanciones = window.calcularSancionesPartido(events, humanTeam, teamName, compKey);
    window.showSancionPostOverlay(sanciones, compKey, null);
  };

})();


/* script block 27 */

(function(){

  // ── PRE-PARTIDO OVERLAY ──────────────────────────────────────────
  var _ppMatchKey = null;
  var _ppCompKey  = null;
  var _ppChecked  = {};
  var _ppItems    = [];

  function _buildItems(matchKey, compKey, prorroga, duracion, isHvH) {
    // Fixed items for Liga Jornada 1
    var estadio  = 'eFootball Stadium';
    var estacion = 'Verano';
    var tiempo   = 'Soleado';
    var balon    = "Ligue 1 McDonald's";
    var nivel    = 'Crack';
    var formaT   = 'Excelente';
    var formaR   = 'Normal';
    var sust     = '6';
    var ventanas = '6';

    // Get real values from venue-bar if possible
    var vbar = document.getElementById('venue-bar-' + matchKey);
    if (vbar) {
      var nm = vbar.querySelector('.ml-venue-name');
      var wt = vbar.querySelector('.ml-venue-weather');
      if (nm) estadio = nm.textContent.trim();
      if (wt) {
        var wtext = wt.textContent.replace(/\s+/g,' ').trim();
        // format: "☀️ Soleado · Verano"
        var parts = wtext.replace(/[\u2600-\u27FF\uFE0F]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDFFF]/g,'').trim().split('\u00B7');
        if (parts.length >= 2) {
          tiempo   = parts[0].trim();
          estacion = parts[1].trim();
        }
      }
    }
    // Ball name
    var bwrap = document.getElementById('ball-wrap-' + matchKey);
    if (bwrap) {
      var bn = bwrap.querySelector('.ml-ball-name');
      if (bn) balon = bn.textContent.trim();
    }

    var items = [
      { id:'nivel',   ico:'🎮', lbl:'Nivel CRACK',   val:nivel },
      { id:'formaT',  ico:'⬆️', lbl:'Tu Forma',      val:formaT },
      { id:'formaR',  ico:'➡️', lbl:'Rival Forma',   val:formaR },
      { id:'duracion',ico:'⏱️', lbl:'Duración',      val:duracion + (isHvH ? ' (H)' : ' (IA)') },
      { id:'balon',   ico:'⚽️', lbl:'Balón',         val:balon }
    ];
    return items;
  }

  function _ppClickSfx() { try { var Ctx=window.AudioContext||window.webkitAudioContext; if(!Ctx) return; var ctx=window.__ppAudio||(window.__ppAudio=new Ctx()); var o=ctx.createOscillator(); var g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); var t=ctx.currentTime; o.frequency.setValueAtTime(1180,t); g.gain.setValueAtTime(0.05,t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.05); o.start(t); o.stop(t+0.05);} catch(_){} }

  function _renderPreviaMeta(matchKey, isHvH) {
    var wrap = document.getElementById('mlw-' + matchKey);
    if (!wrap) return;
    var home = ((wrap.querySelectorAll('.ml-team-name')[0]||{}).textContent||'LOCAL').replace(/^[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+\s*/, '').trim();
    var away = ((wrap.querySelectorAll('.ml-team-name')[1]||{}).textContent||'VISITANTE').replace(/^[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+\s*/, '').trim();
    var vbar = document.getElementById('venue-bar-' + matchKey);
    var estadio='eFootball Stadium', clima='Soleado', temporada='Verano';
    if (vbar) {
      var nm=vbar.querySelector('.ml-venue-name'); if(nm) estadio = nm.textContent.trim();
      var wt=vbar.querySelector('.ml-venue-weather');
      if (wt) { var txt=wt.textContent.replace(/\s+/g,' ').trim(); var parts=txt.split('·'); if(parts[0]) clima=parts[0].replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]/g,'').trim()||clima; if(parts[1]) temporada=parts[1].replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]/g,'').trim()||temporada; }
    }
    var seasonIco = /invierno/i.test(temporada) ? '🌚' : '🌝';
    var climaIco = /lluv/i.test(clima) ? '🌧️' : (/nieve/i.test(clima) ? '❄️' : '☀️');
    var env = document.getElementById('pp-env');
    if (env) env.innerHTML = '🏟️ <b>Estadio:</b> '+estadio+' · '+seasonIco+' <b>Temporada:</b> '+temporada+' · '+climaIco+' <b>Clima:</b> '+clima;
    var vs = document.getElementById('pp-vs');
    if (vs) {
      var lA=(typeof getLogoEquipo==='function'&&getLogoEquipo(home))||''; var lB=(typeof getLogoEquipo==='function'&&getLogoEquipo(away))||'';
      vs.innerHTML = '<img src="'+lA+'" alt="'+home+'"/><div class="pp-vs-mid">'+home.toUpperCase()+' VS '+away.toUpperCase()+'</div><img src="'+lB+'" alt="'+away+'"/>';
    }
    var alerts = document.getElementById('pp-alerts');
    if (alerts) {
      var bajas = window.BAJA_STORE || {};
      var lesion = window.LESION_STORE || {};
      function listBy(tipo, ico, title) {
        var rows = Object.keys(bajas).filter(function(n){ return (bajas[n]&&bajas[n].tipo)===tipo; }).slice(0,6);
        if (!rows.length) return '<div class="pp-alert-row">'+ico+' <b>'+title+':</b> Sin registros</div>';
        return '<div class="pp-alert-row">'+ico+' <b>'+title+':</b> '+rows.map(function(n){ var b=bajas[n]||{}; var rest=(b.liga||0)+(b.copa||0)+(b.europa||0); return n+' ('+rest+'P)'; }).join(' · ')+'</div>';
      }
      var lesionRows = Object.keys(lesion).slice(0,6);
      var lesionHtml = lesionRows.length
        ? '<div class="pp-alert-row">🚑 <b>JUGADORES LESIONADOS:</b> '+lesionRows.map(function(n){ var l=lesion[n]||{}; return (l.gradoEmoji||'🩹')+' '+n+' ('+(l.partidos||1)+'P)'; }).join(' · ')+'</div>'
        : '<div class="pp-alert-row">🚑 <b>JUGADORES LESIONADOS:</b> Sin registros</div>';
      alerts.innerHTML = listBy('sancion','🟨','SANCIONADOS') + listBy('expulsion','🟥','EXPULSADOS') + lesionHtml;
    }
  }

  function _renderList(items) {
    var list = document.getElementById('pp-list');
    if (!list) return;
    list.innerHTML = items.map(function(item) {
      var checked = _ppChecked[item.id];
      return '<div class="pp-item' + (checked ? ' checked' : '') + '" data-ppid="' + item.id + '">'
        + '<span class="pp-item-lbl"><span class="pp-ico">' + item.ico + '</span>' + item.lbl + '</span>'
        + '<span class="pp-item-val">' + item.val + '</span>'
        + '<span class="pp-check">' + (checked ? '\u2705' : '\u{1F533}') + '</span>'
        + '</div>';
    }).join('');
    var divs = list.querySelectorAll('.pp-item');
    for (var i = 0; i < divs.length; i++) {
      (function(d) {
        d.addEventListener('click', function() {
          window._ppToggle(d.getAttribute('data-ppid'));
        });
      })(divs[i]);
    }
  }

  function _checkAllDone() {
    return _ppItems.every(function(item) { return _ppChecked[item.id]; });
  }

  function _updateBtn() {
    var btn = document.getElementById('pp-confirm-btn');
    if (!btn) return;
    var done = _checkAllDone();
    btn.disabled = !done;
    btn.textContent = done ? '🎮 CONFIRMAR CONFIGURACIÓN' : '🔒 COMPLETA LAS 5 CASILLAS';
  }

  window._ppToggle = function(id) {
    _ppChecked[id] = !_ppChecked[id];
    _ppClickSfx();
    if (_ppMatchKey) _renderPreviaMeta(_ppMatchKey, false);
    _renderList(_ppItems);
    _updateBtn();
    // If all done, reveal venue-bar and ball immediately
    if (_checkAllDone() && _ppMatchKey) {
      var vbar = document.getElementById('venue-bar-' + _ppMatchKey);
      var bwrap = document.getElementById('ball-wrap-' + _ppMatchKey);
      if (vbar) vbar.classList.remove('pre-hidden');
      if (bwrap) bwrap.classList.remove('pre-hidden');
    }
  };

  window.showPrePartidoOverlay = function(matchKey, compKey, prorroga, duracion, isHvH) {
    _ppMatchKey = matchKey;
    _ppCompKey  = compKey;
    _ppChecked  = {};
    _ppItems    = _buildItems(matchKey, compKey, prorroga, duracion, isHvH);

    var COMP_LABELS = {
      'liga':'Liga EA Sports','copa':'Copa del Rey','copa-fin':'Copa del Rey · Final',
      'sc':'Supercopa de España','sc-final':'Supercopa · Final',
      'usc':'UEFA Super Cup','usc-fin':'UEFA Super Cup · Final',
      'ucl':'Champions League','ucl-fin':'Champions League · Final',
      'uel':'Europa League','uel-fin':'Europa League · Final',
      'uecl':'Conference League','uecl-fin':'Conference League · Final',
      'superliga':'Superliga','inter':'Copa Intercontinental','inter-fin':'Intercontinental · Final'
    };

    var sub = document.getElementById('pp-subtitle');
    if (sub) sub.textContent = (COMP_LABELS[compKey] || compKey).toUpperCase();

    _renderPreviaMeta(matchKey, isHvH);
    _renderList(_ppItems);
    _updateBtn();
    var ppOv = document.getElementById('prepartido-overlay');
    if (ppOv) ppOv.classList.add('show');
    window.scrollTo(0, 0);
  };

  window._ppConfirm = function() {
    if (!_checkAllDone()) return;
    // Reveal venue-bar and ball (in case not yet revealed)
    if (_ppMatchKey) {
      if (typeof window._mlEnsureLegacyPreMatchStructure === 'function') {
        window._mlEnsureLegacyPreMatchStructure(_ppMatchKey);
      }
      var vbar = document.getElementById('venue-bar-' + _ppMatchKey);
      var bwrap = document.getElementById('ball-wrap-' + _ppMatchKey);
      if (vbar) vbar.classList.remove('pre-hidden');
      if (bwrap) bwrap.classList.remove('pre-hidden');
      // Ocultar botón de configuración, dejar solo el timer
      var previaBtn = document.getElementById('ml-previa-' + _ppMatchKey);
      if (previaBtn) previaBtn.style.display = 'none';
    }
    var ppOvClose = document.getElementById('prepartido-overlay');
    if (ppOvClose) ppOvClose.classList.remove('show');
    // Mostrar overlay de sancionados; al confirmar, revelar el timer
    var mk = _ppMatchKey;
    if (typeof window.showSancionOverlay === 'function') {
      window.showSancionOverlay(_ppCompKey, null, function() {
        var timerBtn = document.getElementById('ml-timer-' + mk);
        if (timerBtn) { timerBtn.style.display = ''; timerBtn.disabled = false; }
        var addBtn = document.getElementById('ml-add-btn-' + mk);
        if (addBtn) addBtn.style.visibility = '';
        var actBar = document.getElementById('ml-actions-bar-' + mk);
        if (actBar) actBar.style.visibility = '';
        var wrap = document.getElementById('mlw-' + mk);
        if (wrap) wrap.setAttribute('data-prepartido-ready', '1');
      });
    } else {
      var timerBtn = document.getElementById('ml-timer-' + mk);
      if (timerBtn) { timerBtn.style.display = ''; timerBtn.disabled = false; }
      var addBtn = document.getElementById('ml-add-btn-' + mk);
      if (addBtn) addBtn.style.visibility = '';
      var actBar = document.getElementById('ml-actions-bar-' + mk);
      if (actBar) actBar.style.visibility = '';
      var wrap = document.getElementById('mlw-' + mk);
      if (wrap) wrap.setAttribute('data-prepartido-ready', '1');
    }
  };

})();


/* script block 28 */

(function(){
  // ── Enhance submenu-cards with background icon ──────────────────
  document.querySelectorAll('.submenu-card').forEach(function(card){
    // Skip already enhanced
    if(card.querySelector('[data-bg-enhanced]')) return;
    card.style.position='relative';
    card.style.overflow='hidden';

    var emojiEl=card.querySelector('.sc-emoji');
    var imgEl=card.querySelector('.sc-img');
    var txt=emojiEl?emojiEl.textContent:'';

    // Choose better icon by label
    var label=(card.querySelector('.sc-label')||{}).textContent||'';
    var ico={
      'Liga EA Sports':'⚽','Copa del Rey':'🏆','Supercopa de España':'👑','Estadísticas':'📊',
      'Clasificación':'📊','Champions League':'⭐','Europa League':'🔶',
      'Conference League':'🟢','UEFA Supercup':'🥇','Intercontinental':'🌎',
      'Superliga':'⭐','Fase de Liga':'⭐','Fase Grupos':'🏆','Playoffs / Final':'🥇',
      'Fase Previa':'🔶','Playoffs Final':'🥇','Cuadro de Eliminatorias':'🗂️',
      'Calendario':'📅'
    }[label.trim()]||txt||'⚽';

    // Background element
    if(imgEl&&imgEl.src){
      var bg=document.createElement('img');
      bg.src=imgEl.src;
      bg.setAttribute('aria-hidden','true');
      bg.setAttribute('data-bg-enhanced','1');
      bg.style.cssText='position:absolute;right:-12px;top:50%;transform:translateY(-50%);height:175%;width:auto;object-fit:contain;opacity:0.22;pointer-events:none;z-index:0;';
      card.insertBefore(bg,card.firstChild);
    } else {
      var bg=document.createElement('span');
      bg.textContent=ico;
      bg.setAttribute('aria-hidden','true');
      bg.setAttribute('data-bg-enhanced','1');
      bg.style.cssText='position:absolute;right:-10px;top:50%;transform:translateY(-50%);font-size:70px;opacity:0.2;pointer-events:none;line-height:1;z-index:0;';
      card.insertBefore(bg,card.firstChild);
    }

    // Overlay
    var ov=document.createElement('div');
    ov.setAttribute('aria-hidden','true');
    ov.style.cssText='position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,0.52) 0%,rgba(0,0,0,0.15) 55%,rgba(0,0,0,0) 100%);pointer-events:none;z-index:1;';
    card.insertBefore(ov,card.children[1]);

    // Lift content above overlay
    Array.from(card.children).forEach(function(c){
      if(!c.getAttribute('data-bg-enhanced')&&!c.style.cssText.includes('inset')){
        c.style.position='relative';
        c.style.zIndex='2';
      }
    });
  });

  // ── Enhance Resto de Ligas flag cards ───────────────────────────
  var ligasEl=document.getElementById('s-ligas');
  if(!ligasEl)return;
  ligasEl.querySelectorAll('.menu-card').forEach(function(card){
    if(card.querySelector('[data-flag-bg]')) return;
    // Skip already enhanced team/main cards
    if(card.querySelector('.mc-equipo-badge-bg,.mc-main-bg')) return;
    card.style.position='relative';
    card.style.overflow='hidden';

    var emojiEl=card.querySelector('.mc-emoji');
    if(!emojiEl)return;

    var bg=document.createElement('span');
    bg.textContent=emojiEl.textContent;
    bg.setAttribute('aria-hidden','true');
    bg.setAttribute('data-flag-bg','1');
    bg.style.cssText='position:absolute;right:-10px;top:50%;transform:translateY(-50%);font-size:54px;opacity:0.38;pointer-events:none;line-height:1;z-index:0;';
    card.insertBefore(bg,card.firstChild);

    var ov=document.createElement('div');
    ov.setAttribute('aria-hidden','true');
    ov.style.cssText='position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,0.48) 0%,rgba(0,0,0,0.12) 55%,rgba(0,0,0,0) 100%);pointer-events:none;z-index:1;';
    card.insertBefore(ov,card.children[1]);

    Array.from(card.children).forEach(function(c){
      if(!c.getAttribute('data-flag-bg')&&!c.style.cssText.includes('inset')){
        c.style.position='relative';
        c.style.zIndex='2';
      }
    });
  });
})();


/* script block 29 */

(function() {
'use strict';

// ══════════════════════════════════════════════════════════
// 1. BAJA STORE — persiste en sesión
// ══════════════════════════════════════════════════════════
// Estructura: { 'Nombre Jugador': { tipo:'lesion'|'sancion'|'expulsion', liga:N, copa:N, europa:N } }
window.BAJA_STORE = window.BAJA_STORE || {};

// Helper: obtener tipo de baja
function _bajaTipo(nombre) {
  var b = window.BAJA_STORE[nombre];
  if (!b) return null;
  return (typeof b === 'string') ? b : b.tipo;
}
// Helper: obtener partidos restantes
function _bajaPartidos(nombre) {
  var b = window.BAJA_STORE[nombre];
  if (!b) return {liga:0,copa:0,europa:0};
  if (typeof b === 'string') return {liga:0,copa:0,europa:0};
  return { liga: b.liga||0, copa: b.copa||0, europa: b.europa||0 };
}
// Helper: texto resumen de partidos restantes para mostrar en la fila
function _bajaBadgeText(nombre) {
  var p = _bajaPartidos(nombre);
  var parts = [];
  if (p.liga > 0)   parts.push('L' + p.liga);
  if (p.copa > 0)   parts.push('C' + p.copa);
  if (p.europa > 0) parts.push('E' + p.europa);
  return parts.join(' ');
}

// ══════════════════════════════════════════════════════════
// 2. MODAL DE BAJA
// ══════════════════════════════════════════════════════════
var _bajaRow   = null;
var _bajaName  = null;

window.openBajaModal = function(row, nombre) {
  _bajaRow  = row;
  _bajaName = nombre;
  document.getElementById('baja-modal-name').textContent = nombre.toUpperCase();

  // Mostrar panel de partidos si hay baja activa
  var tipo = _bajaTipo(nombre);
  var panel = document.getElementById('baja-partidos-panel');
  if (tipo) {
    panel.style.display = 'block';
    var p = _bajaPartidos(nombre);
    document.getElementById('baja-p-liga').textContent   = p.liga;
    document.getElementById('baja-p-copa').textContent   = p.copa;
    document.getElementById('baja-p-europa').textContent = p.europa;
  } else {
    panel.style.display = 'none';
  }
  document.getElementById('baja-modal').classList.add('show');
};

// Ajuste de partidos restantes desde los botones +/-
window._bajaPartidosAdj = function(comp, delta) {
  if (!_bajaName) return;
  var b = window.BAJA_STORE[_bajaName];
  if (!b || typeof b === 'string') {
    // Convertir a objeto si era string antiguo
    var tipo = (typeof b === 'string') ? b : 'lesion';
    b = window.BAJA_STORE[_bajaName] = { tipo: tipo, liga:0, copa:0, europa:0 };
  }
  b[comp] = Math.max(0, (b[comp]||0) + delta);
  document.getElementById('baja-p-' + comp).textContent = b[comp];
  // Actualizar badge en la fila
  _updateBajaBadge(_bajaRow, _bajaName);
  if (typeof window._refreshSancionInjList === 'function') window._refreshSancionInjList();
};

function _updateBajaBadge(row, nombre) {
  if (!row) return;
  var badge = row.querySelector('.plant-baja-badge');
  var txt = _bajaBadgeText(nombre);
  if (badge) {
    badge.textContent = txt;
    badge.style.display = txt ? 'inline' : 'none';
  }
}

window._bajaClose = function() {
  document.getElementById('baja-modal').classList.remove('show');
  document.querySelectorAll('.plant-row.row-longpress').forEach(function(r){
    r.classList.remove('row-longpress');
  });
  _bajaRow = null; _bajaName = null;
};

window._bajaPick = function(tipo) {
  if (!_bajaRow || !_bajaName) { window._bajaClose(); return; }
  if (tipo === 'clear') {
    delete window.BAJA_STORE[_bajaName];
    _bajaRow.classList.remove('baja-lesion','baja-sancion','baja-expulsion');
    var btn = _bajaRow.querySelector('.plant-baja-btn');
    if (btn) { btn.textContent = ''; btn.className = 'plant-baja-btn'; }
    var badge = _bajaRow.querySelector('.plant-baja-badge');
    if (badge) { badge.textContent = ''; badge.style.display = 'none'; }
  } else {
    // Preservar partidos si ya existía la baja
    var prev = window.BAJA_STORE[_bajaName];
    var prevPartidos = (prev && typeof prev === 'object') ? { liga: prev.liga||0, copa: prev.copa||0, europa: prev.europa||0 } : { liga:0, copa:0, europa:0 };
    window.BAJA_STORE[_bajaName] = { tipo: tipo, liga: prevPartidos.liga, copa: prevPartidos.copa, europa: prevPartidos.europa };
    _bajaRow.classList.remove('baja-lesion','baja-sancion','baja-expulsion');
    _bajaRow.classList.add('baja-' + tipo);
    var btn = _bajaRow.querySelector('.plant-baja-btn');
    var ico = tipo === 'lesion' ? '🚑' : tipo === 'sancion' ? '🟨' : '🟥';
    if (btn) { btn.textContent = ico; btn.className = 'plant-baja-btn ' + tipo; }
    // Mostrar panel de partidos inmediatamente
    document.getElementById('baja-partidos-panel').style.display = 'block';
    document.getElementById('baja-p-liga').textContent   = prevPartidos.liga;
    document.getElementById('baja-p-copa').textContent   = prevPartidos.copa;
    document.getElementById('baja-p-europa').textContent = prevPartidos.europa;
    _updateBajaBadge(_bajaRow, _bajaName);
    // NO cerrar el modal — dejar al usuario ajustar partidos
    if (typeof window._refreshSancionInjList === 'function') window._refreshSancionInjList();
    return; // no cerrar
  }
  window._bajaClose();
  if (typeof window._refreshSancionInjList === 'function') window._refreshSancionInjList();
};

// ══════════════════════════════════════════════════════════
// 3. SINCRONIZAR PLANT-ROWS DESDE SQUAD_REGISTRY
//    — actualiza nombre, valor 🛡, y añade botón baja
// ══════════════════════════════════════════════════════════
var POS_MAP_H = {
  '🧤 PORTEROS': 'por',
  '🛡 DEFENSAS': 'def',
  '⚙️ MEDIOS':   'med',
  '⚡ DELANTEROS':'del'
};
var POS_LABEL = {
  'por': '🧤 PORTEROS',
  'def': '🛡 DEFENSAS',
  'med': '⚙️ MEDIOS',
  'del': '⚡ DELANTEROS'
};

function makePlantRow(num, nombre, posClass, poder) {
  var baja = _bajaTipo(nombre) || '';
  var bajaClass = baja ? ' baja-' + baja : '';
  var bajaIco   = baja === 'lesion' ? '🚑' : baja === 'sancion' ? '🟨' : baja === 'expulsion' ? '🟥' : '';
  var btnClass  = 'plant-baja-btn' + (baja ? ' ' + baja : '');
  var badgeTxt  = _bajaBadgeText(nombre);
  var span = function(cls, content) {
    return '<span class="plant-stat zero"><span class="' + cls + '" data-global="0" data-liga="0" data-copa="0" data-uecl="0" data-super="0" hidden></span>' + content + '</span>';
  };
  return '<div class="plant-row ' + posClass + bajaClass + '" data-player="' + nombre.replace(/"/g,'&quot;') + '">'
    + '<span class="plant-num">' + num + '</span>'
    + '<span class="plant-name">' + nombre
      + (badgeTxt ? ' <span class="plant-baja-badge">' + badgeTxt + '</span>' : '<span class="plant-baja-badge" style="display:none"></span>')
    + '</span>'
    + span('ps-gol','0')
    + span('ps-yel','0')
    + span('ps-red','0')
    + span('ps-mvp','0')
    + '<span class="plant-stat poder zero">' + (poder || 70) + '</span>'
    + '<span class="plant-stat zero frac"><span class="ps-pen-gol" data-global="0" data-liga="0" data-copa="0" data-uecl="0" data-super="0" data-tirado="0" hidden></span>0/0</span>'
    + span('ps-pen-prov','0')
    + span('ps-pen-parado','0')
    + span('ps-falta-gol','0')
    + span('ps-propia','0')
    + '<button class="' + btnClass + '" title="Marcar baja" onclick="window.openBajaModal(this.closest(\'.plant-row\'),\'' + nombre.replace(/'/g,"\\'") + '\')">' + bajaIco + '</button>'
    + '</div>';
}

function makePosHdr(posClass, screenEl) {
  // Intentar detectar color del equipo desde el screen
  var hdrStyle = '';
  var h2 = screenEl ? screenEl.querySelector('.sec-hdr h2') : null;
  return '<div class="plant-pos-hdr"><i class="ico">' + POS_LABEL[posClass].split(' ')[0] + '</i> '
    + POS_LABEL[posClass].replace(/^[^\s]+\s/,'').toUpperCase() + '</div>';
}

function syncSquadToScreen(screenId, teamName) {
  var reg = window.SQUAD_REGISTRY && window.SQUAD_REGISTRY[teamName];
  if (!reg || !reg.length) return;

  // Buscar el contenedor de la plantilla en este screen
  var screen = document.getElementById(screenId);
  if (!screen) return;
  var plantBody = screen.querySelector('.ent-body[id$="-plantilla"], .ent-body[id*="plantilla"], .ent-body[class*="body-plantilla"]');
  if (!plantBody) {
    // Fallback seguro para pantallas dedicadas tipo "s-xxx-plantilla"
    // (evitar capturar contenedores genéricos como ".ath-box-plantilla").
    var secHdr = screen.querySelector('.sec-hdr');
    if (secHdr && secHdr.nextElementSibling && secHdr.nextElementSibling.tagName === 'DIV') {
      plantBody = secHdr.nextElementSibling;
    }
  }
  if (!plantBody) return;

  // Construir HTML desde registry
  var posMap = {
    '🧤 PORTEROS':'por', '🛡 DEFENSAS':'def',
    '⚙️ MEDIOS':'med',   '⚡ DELANTEROS':'del',
    '⚙️CENTROCAMPISTAS':'med','⚙️ CENTROCAMPISTAS':'med'
  };
  var html = '';
  var curPos = 'med';
  var prevPos = null;
  for (var i = 0; i < reg.length; i++) {
    var e = reg[i];
    if (e.h) {
      curPos = posMap[e.h] || 'med';
      if (curPos !== prevPos) {
        html += makePosHdr(curPos, screen);
        html += '<div class="pos-mini-hdr ' + curPos + '"><span>#</span><span>Jugador</span><span>⚽</span><span>🟨</span><span>🟥</span><span>⭐</span><span>🛡</span></div>';
        prevPos = curPos;
      }
    } else {
      html += makePlantRow(e[0], e[1], curPos, e[2] || 70);
    }
  }

  // Preservar el filter-bar y col-hdr si existen, reemplazar solo las rows+headers de posición
  var filterBar = plantBody.querySelector('.plant-filter-bar');
  var colHdr    = plantBody.querySelector('.plant-col-hdr');
  var badge     = plantBody.querySelector('.badge-total,[class*="badge-total"]');

  // Limpiar solo filas de jugadores y headers de posición
  var toRemove = plantBody.querySelectorAll('.plant-row, .plant-pos-hdr, .pos-mini-hdr');
  toRemove.forEach(function(el) { el.parentNode.removeChild(el); });

  // Insertar nuevo HTML
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  while (tmp.firstChild) {
    plantBody.appendChild(tmp.firstChild);
  }

  // Actualizar badge total
  var totalBadge = plantBody.querySelector('[class*="badge-total"]');
  var total = reg.filter(function(e){ return !e.h; }).length;
  if (totalBadge) totalBadge.textContent = total;

  // Restaurar bajas visuales
  plantBody.querySelectorAll('.plant-row[data-player]').forEach(function(row) {
    var nombre = row.getAttribute('data-player');
    var baja = nombre && window.BAJA_STORE[nombre];
    if (baja) {
      row.classList.add('baja-' + baja);
      var btn = row.querySelector('.plant-baja-btn');
      var ico = baja === 'lesion' ? '🚑' : baja === 'sancion' ? '🟨' : '🟥';
      if (btn) { btn.textContent = ico; btn.className = 'plant-baja-btn ' + baja; }
    }
  });
}

// Mapa screenId → teamName
var SCREEN_SQUAD_MAP = {
  's-munich':        'Bayern Munich',
  's-arsenal':       'Arsenal',
  's-sporting':      'Sporting CP',
  's-madrid':        'Real Madrid',
  's-barca':         'FC Barcelona',
  's-atletico':      'Atlético Madrid',
  's-albacete':      'Albacete BP',
  's-villarreal':    'Villarreal CF',
  's-sevilla':       'Sevilla FC',
  's-espanyol':      'Espanyol',
  's-getafe':        'Getafe CF',
  'celta-screen':    'Celta de Vigo',
  'osasuna-screen':  'Osasuna',
  'alaves-screen':   'Deportivo Alavés',
  'girona-screen':   'Girona FC',
  'oviedo-screen':   'Real Oviedo',
  'levante-screen':  'Levante UD',
  'mallorca-screen': 'Mallorca',
  'elche-screen':    'Elche CF',
  'valencia-screen': 'Valencia CF',
  'rayo-screen':     'Rayo Vallecano',
  'athletic-screen': 'Athletic Club',
  'betis-screen':    'Real Betis',
  'sociedad-screen': 'Real Sociedad'
};

// Sincronizar al abrir cada pantalla de equipo
var _syncedScreens = {};
var _origGo = window.go;
window.go = function(screenId) {
  if (_origGo) _origGo(screenId);
  if (SCREEN_SQUAD_MAP[screenId] && !_syncedScreens[screenId]) {
    _syncedScreens[screenId] = true;
    // Pequeño delay para asegurar que la pantalla es visible
    setTimeout(function() {
      syncSquadToScreen(screenId, SCREEN_SQUAD_MAP[screenId]);
    }, 80);
  }
};

// También sincronizar en DOMContentLoaded para la pantalla activa inicial
document.addEventListener('DOMContentLoaded', function() {
  var active = document.querySelector('.screen.active');
  if (active && SCREEN_SQUAD_MAP[active.id] && !_syncedScreens[active.id]) {
    _syncedScreens[active.id] = true;
    syncSquadToScreen(active.id, SCREEN_SQUAD_MAP[active.id]);
  }
});

// ══════════════════════════════════════════════════════════
// 4. sqFromRegistry RESPETA BAJA_STORE
//    — parcha la función existente para excluir bajas
// ══════════════════════════════════════════════════════════
var _origSqFromRegistry = window.sqFromRegistry;
window.sqFromRegistry = function(teamName, opts) {
  // Obtener bajas del BAJA_STORE para este equipo
  var reg = window.SQUAD_REGISTRY && (
    window.SQUAD_REGISTRY[teamName] ||
    window.SQUAD_REGISTRY[(window.TEAM_ALIASES||{})[teamName]] 
  );
  var bajaNames = [];
  if (reg) {
    reg.forEach(function(e) {
      if (!e.h && window.BAJA_STORE[e[1]]) {
        bajaNames.push(e[1]);
      }
    });
  }
  // Fusionar con excluded recibido
  var existingExcluded = (opts && opts.excluded) ? opts.excluded : [];
  var allExcluded = existingExcluded.concat(bajaNames);
  var newOpts = { excluded: allExcluded };
  if (opts) {
    for (var k in opts) {
      if (k !== 'excluded') newOpts[k] = opts[k];
    }
  }
  return _origSqFromRegistry ? _origSqFromRegistry(teamName, newOpts) : [];
};

// sqFromRegistryFull también respeta bajas (devuelve todos pero marca los que están de baja)
var _origSqFromRegistryFull = window.sqFromRegistryFull;
window.sqFromRegistryFull = function(teamName) {
  var result = _origSqFromRegistryFull ? _origSqFromRegistryFull(teamName) : [];
  // Marcar jugadores en baja — los mantiene en la lista (humano ve todos)
  // pero con una propiedad 'baja' para que el overlay los muestre tachados
  result.forEach(function(p) {
    var baja = window.BAJA_STORE[p[1]];
    if (baja) p[5] = baja; // p[5] = tipo de baja
  });
  return result;
};

// ══════════════════════════════════════════════════════════
// 5. CONECTAR LESIONADOS AL OVERLAY PRE-PARTIDO
// ══════════════════════════════════════════════════════════
window._refreshSancionInjList = function() {
  var listInj = document.getElementById('sancion-ov-list-inj');
  if (!listInj) return;
  var bajas = Object.keys(window.BAJA_STORE);
  if (!bajas.length) {
    listInj.innerHTML = '<div class="sancion-empty">🚑 Sin lesionados</div>';
    return;
  }
  listInj.innerHTML = bajas.map(function(nombre) {
    var b    = window.BAJA_STORE[nombre];
    var tipo = (typeof b === 'string') ? b : b.tipo;
    var ico  = tipo === 'lesion' ? '🚑' : tipo === 'sancion' ? '🟨' : '🟥';
    var lbl  = tipo === 'lesion' ? 'LESIONADO' : tipo === 'sancion' ? 'SANCIONADO' : 'EXPULSADO';
    var p    = (typeof b === 'object') ? b : {liga:0,copa:0,europa:0};
    var partsTxt = '';
    if (p.liga > 0)   partsTxt += '<span style="margin-right:8px">🇪🇸 ' + p.liga + 'P</span>';
    if (p.copa > 0)   partsTxt += '<span style="margin-right:8px">🏆 ' + p.copa + 'P</span>';
    if (p.europa > 0) partsTxt += '<span>🌍 ' + p.europa + 'P</span>';
    return '<div class="sancion-card">'
      + '<div class="sancion-card-icon">' + ico + '</div>'
      + '<div class="sancion-card-info">'
      + '<div class="sancion-card-name">' + nombre + '</div>'
      + '<div class="sancion-card-reason">' + lbl + '</div>'
      + (partsTxt ? '<div style="font-family:Oswald,sans-serif;font-size:11px;color:#f0c040;margin-top:3px;letter-spacing:1px;">' + partsTxt + '</div>' : '')
      + '</div></div>';
  }).join('');
  var warnEl = document.getElementById('sancion-ov-warn');
  if (warnEl) warnEl.style.display = 'block';
};

// Parchar showSancionOverlay para incluir bajas reales
var _origShowSancionOverlay = window.showSancionOverlay;
window.showSancionOverlay = function(compKey, blockId, onConfirm) {
  if (_origShowSancionOverlay) _origShowSancionOverlay(compKey, blockId, onConfirm);
  // Actualizar lista de lesionados/bajas
  window._refreshSancionInjList();
};

// ══════════════════════════════════════════════════════════
// 6. SUSTITUCIÓN EXTRA EN PRÓRROGA — IA vs IA
//    Se aplica al simulador global (window.simularPartido)
//    La 5ª sustitución ocurre entre min 91-120, invisible en acta
// ══════════════════════════════════════════════════════════
// Parcheamos la función de simulación para añadir sub extra en ET
// La lógica está en window.runIASimulation o en el bloque inline
// Como está inline, parcheamos applySubsUpTo via el evento global

// Añadir un hook post-simulación que, si hubo prórroga, aplica sub extra
// Esto se hace extendiendo el cfg.onEnd
var _origRunSimulation = window.runIASimulation;
if (_origRunSimulation) {
  window.runIASimulation = function(cfg) {
    var _origOnEnd = cfg.onEnd;
    cfg.onEnd = function(sa, sb, evts, mvpName, mvpTeam) {
      // La prórroga extra ya está gestionada internamente; solo llamar original
      if (_origOnEnd) _origOnEnd(sa, sb, evts, mvpName, mvpTeam);
    };
    return _origRunSimulation(cfg);
  };
}

// Para los simuladores inline (que ya tienen applySubsUpTo),
// extendemos la lógica de sustituciones para agregar la 5ª en prórroga
// Esto se aplica directamente al bloque de código inline del simulador IA vs IA
// que ya usa benA/benB. Añadimos la función global para ser llamada si hay ET:
window.applyETSub = function(activeA, activeB, benA, benB, subIdxA, subIdxB) {
  // Sub extra equipo A en prórroga (min 91-120)
  if (subIdxA < benA.length) {
    var outfA = activeA.filter(function(p){ return p[2] !== 'P'; });
    if (outfA.length) {
      var wA = outfA.reduce(function(a,b){ return (a[3]||70)<(b[3]||70)?a:b; });
      var iA = activeA.indexOf(wA);
      if (iA >= 0) activeA.splice(iA, 1);
      activeA.push(benA[subIdxA]);
    }
  }
  // Sub extra equipo B en prórroga
  if (subIdxB < benB.length) {
    var outfB = activeB.filter(function(p){ return p[2] !== 'P'; });
    if (outfB.length) {
      var wB = outfB.reduce(function(a,b){ return (a[3]||70)<(b[3]||70)?a:b; });
      var iB = activeB.indexOf(wB);
      if (iB >= 0) activeB.splice(iB, 1);
      activeB.push(benB[subIdxB]);
    }
  }
};

// ══════════════════════════════════════════════════════════
// 7. MOSTRAR CONVOCATORIA EN OVERLAY DE PARTIDO (HvH / HvIA)
//    — Jugadores en baja aparecen tachados y no son seleccionables
// ══════════════════════════════════════════════════════════
// Parchar el renderizado del overlay de selección de jugador
// para mostrar bajas visualmente
var _styleOverlay = document.createElement('style');
_styleOverlay.textContent =
  '.ml-pl-ov-btn.jugador-baja { opacity:.4; text-decoration:line-through; pointer-events:none; cursor:not-allowed; }'
  + '.ml-pl-ov-btn.jugador-baja::after { content:" ⚽🚫"; font-size:10px; }';
document.head.appendChild(_styleOverlay);

// Parchar mlShowPl_* para marcar bajas en overlay de jugadores
// Usamos MutationObserver en los overlays de selección de jugador
document.addEventListener('click', function(e) {
  // Detectar cuando se abre un overlay de plantilla
  setTimeout(function() {
    document.querySelectorAll('.ml-pl-ov-list').forEach(function(list) {
      list.querySelectorAll('.ml-pl-ov-btn').forEach(function(btn) {
        var nameEl = btn.querySelector('.ml-pl-ov-name');
        if (!nameEl) return;
        var nombre = nameEl.textContent.trim();
        if (window.BAJA_STORE[nombre]) {
          btn.classList.add('jugador-baja');
          btn.disabled = true;
          btn.title = 'Jugador no disponible (' + window.BAJA_STORE[nombre] + ')';
        }
      });
    });
  }, 100);
}, true);

// ══════════════════════════════════════════════════════════
// 8. INTEGRAR SUSTITUCIÓN EXTRA ET EN LOS SIMULADORES INLINE
//    Esto se inyecta en el contexto del simulador IA via
//    la variable global _etSubApplied
// ══════════════════════════════════════════════════════════
// Los simuladores inline ya calculan ft90/ht45/sa/sb
// Cuando sa===sb al ft90 en competiciones con prórroga,
// el sistema existente maneja ET. Aquí añadimos la sub extra:
window._etSubApplied = window._etSubApplied || {};
// La sub extra se aplica automáticamente a través del hook
// window.applyETSub que es llamado por el simulador si detecta ET

// ══════════════════════════════════════════════════════════
// 9. FORZAR SINCRONIZACIÓN DE PLANTILLAS AL HACER go()
//    para equipos que ya tienen plant-rows en el HTML
// ══════════════════════════════════════════════════════════
// Re-sincronizar al volver a entrar en una pantalla de equipo
// (el _syncedScreens evita re-renderizar innecesariamente,
//  pero si se actualizó BAJA_STORE sí debe refrescar el visual)
window.refreshPlantBajas = function(screenId) {
  var screen = document.getElementById(screenId);
  if (!screen) return;
  screen.querySelectorAll('.plant-row[data-player]').forEach(function(row) {
    var nombre = row.getAttribute('data-player');
    if (!nombre) {
      // Intentar obtener desde plant-name
      var nameEl = row.querySelector('.plant-name');
      if (nameEl) nombre = nameEl.textContent.trim();
    }
    if (!nombre) return;
    var baja = window.BAJA_STORE[nombre];
    row.classList.remove('baja-lesion','baja-sancion','baja-expulsion');
    var btn = row.querySelector('.plant-baja-btn');
    if (baja) {
      row.classList.add('baja-' + baja);
      var ico = baja === 'lesion' ? '🚑' : baja === 'sancion' ? '🟨' : '🟥';
      if (btn) { btn.textContent = ico; btn.className = 'plant-baja-btn ' + baja; }
    } else {
      if (btn) { btn.textContent = ''; btn.className = 'plant-baja-btn'; }
    }
  });
};

// ══════════════════════════════════════════════════════════
// 10. AÑADIR BOTÓN BAJA A PLANT-ROWS EXISTENTES (HTML FIJO)
//     + LONG PRESS para mostrar el botón
// ══════════════════════════════════════════════════════════
var _lpTimer = null;
var _lpRow   = null;

function addLongPressToRow(row) {
  if (row._lpBound) return;
  row._lpBound = true;
  function onStart(e) {
    _lpRow = row;
    _lpTimer = setTimeout(function() {
      row.classList.add('row-longpress');
      // Auto-quitar el highlight tras 3s si no se pulsa el botón
      setTimeout(function() {
        if (!document.getElementById('baja-modal') || !document.getElementById('baja-modal').classList.contains('show')) {
          row.classList.remove('row-longpress');
        }
      }, 3000);
    }, 500);
  }
  function onEnd() {
    clearTimeout(_lpTimer);
    _lpTimer = null;
  }
  row.addEventListener('touchstart', onStart, {passive:true});
  row.addEventListener('touchend',   onEnd,   {passive:true});
  row.addEventListener('touchmove',  onEnd,   {passive:true});
  row.addEventListener('mousedown',  onStart);
  row.addEventListener('mouseup',    onEnd);
  row.addEventListener('mouseleave', onEnd);
}

// Limpiar longpress al cerrar modal
var _origBajaClose = window._bajaClose;
window._bajaClose = function() {
  if (_origBajaClose) _origBajaClose();
  document.querySelectorAll('.plant-row.row-longpress').forEach(function(r){
    r.classList.remove('row-longpress');
  });
};
function addBajaButtonsToExistingRows() {
  document.querySelectorAll('.plant-row').forEach(function(row) {
    // Añadir long press a todas las filas
    addLongPressToRow(row);
    if (row.querySelector('.plant-baja-btn')) return; // ya tiene botón
    var nameEl = row.querySelector('.plant-name');
    if (!nameEl) return;
    var nombre = nameEl.textContent.trim();
    if (!nombre) return;
    row.setAttribute('data-player', nombre);
    var baja = _bajaTipo(nombre);
    var bajaIco = baja === 'lesion' ? '🚑' : baja === 'sancion' ? '🟨' : baja === 'expulsion' ? '🟥' : '';
    var btnClass = 'plant-baja-btn' + (baja ? ' ' + baja : '');
    if (baja) {
      row.classList.remove('baja-lesion','baja-sancion','baja-expulsion');
      row.classList.add('baja-' + baja);
    }
    // Añadir badge de partidos si no existe
    if (!nameEl.querySelector('.plant-baja-badge')) {
      var badge = document.createElement('span');
      badge.className = 'plant-baja-badge';
      var badgeTxt = _bajaBadgeText(nombre);
      badge.textContent = badgeTxt;
      badge.style.display = badgeTxt ? 'inline' : 'none';
      nameEl.appendChild(badge);
    }
    var btn = document.createElement('button');
    btn.className = btnClass;
    btn.textContent = bajaIco;
    btn.title = 'Marcar baja';
    btn.setAttribute('onclick', "window.openBajaModal(this.closest('.plant-row'),'" + nombre.replace(/'/g,"\\'") + "')");
    row.appendChild(btn);
  });
}

// Ejecutar al cargar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addBajaButtonsToExistingRows);
} else {
  addBajaButtonsToExistingRows();
}

// También ejecutar después de cada go() para asegurar rows de nuevas pantallas
var _origGo2 = window.go;
window.go = function(screenId) {
  if (_origGo2) _origGo2(screenId);
  setTimeout(addBajaButtonsToExistingRows, 150);
  if (SCREEN_SQUAD_MAP[screenId]) {
    setTimeout(function() {
      syncSquadToScreen(screenId, SCREEN_SQUAD_MAP[screenId]);
    }, 200);
  }
};

console.log('[eFootball] Sistema de Bajas + Sincronización de Plantillas + ET Sub activado ✓');

})();


/* ══════════════════════════════════════════════════════════════════════
   SISTEMA DE LESIONES — Motor completo
   ══════════════════════════════════════════════════════════════════════ */
(function(){

  // ── STORE global ──────────────────────────────────────────────────
  window.LESION_STORE = window.LESION_STORE || {};
  // Estructura: { 'NombreJugador': { equipo, grado, partidos, descripcion, timestamp } }

  // ── Tipos de lesión ───────────────────────────────────────────────
  var LESION_TIPOS = [
    { grado:1, nombre:'Leve',     emoji:'🟡', prob:0.42,
      ejemplos:['Sobrecarga muscular','Contusión leve','Molestias musculares'],
      minPartidos:1, maxPartidos:2 },
    { grado:2, nombre:'Moderada', emoji:'🟠', prob:0.55,
      ejemplos:['Rotura fibrilar','Esguince de tobillo Grado II','Distensión isquiotibial'],
      minPartidos:2, maxPartidos:5 },
    { grado:3, nombre:'Grave',    emoji:'🔴', prob:0.03,
      ejemplos:['Rotura LCA','Fractura tibia/peroné','Rotura de menisco'],
      minPartidos:6, maxPartidos:24 }
  ];

  // Probabilidad base de lesión por partido por equipo: ~6%
  // Sube a ~9% si el equipo juega en competición europea
  var PROB_LESION_BASE = 0.06;
  var PROB_LESION_EURO = 0.09; // fatiga acumulada

  var EQUIPOS_EUROPEOS = [
    'Real Madrid','FC Barcelona','Atlético Madrid','Real Sociedad','Athletic Club',
    'Villarreal CF','Real Betis','Sevilla FC','Girona FC'
  ];

  function tieneEuropa(teamName) {
    return EQUIPOS_EUROPEOS.indexOf(teamName) !== -1;
  }

  function sortearGrado() {
    var r = Math.random();
    if (r < 0.42) return LESION_TIPOS[0]; // Leve
    if (r < 0.97) return LESION_TIPOS[1]; // Moderada
    return LESION_TIPOS[2];               // Grave
  }

  function sortearPartidos(tipo) {
    var min = tipo.minPartidos;
    var max = tipo.maxPartidos;
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function sortearEjemplo(tipo) {
    return tipo.ejemplos[Math.floor(Math.random() * tipo.ejemplos.length)];
  }

  // ── Registrar lesión en BAJA_STORE + LESION_STORE ─────────────────
  function registrarLesion(nombreJugador, equipoNombre, partidos, tipo) {
    // BAJA_STORE: partidos en todas las competiciones = partidos totales
    window.BAJA_STORE[nombreJugador] = {
      tipo: 'lesion',
      liga:   partidos,
      copa:   partidos,
      europa: partidos
    };
    // LESION_STORE: detalle
    window.LESION_STORE[nombreJugador] = {
      equipo:      equipoNombre,
      grado:       tipo.grado,
      gradoNombre: tipo.nombre,
      gradoEmoji:  tipo.emoji,
      descripcion: sortearEjemplo(tipo),
      partidos:    partidos,
      timestamp:   Date.now()
    };
    // Actualizar visual en plantilla
    _actualizarPlantillaLesion(nombreJugador, partidos, tipo);
  }

  function _actualizarPlantillaLesion(nombre, partidos, tipo) {
    document.querySelectorAll('.plant-row[data-player="' + nombre.replace(/"/g,'&quot;') + '"]').forEach(function(row) {
      row.classList.remove('baja-lesion','baja-sancion','baja-expulsion');
      row.classList.add('baja-lesion');
      var btn = row.querySelector('.plant-baja-btn');
      if (btn) {
        btn.textContent = '🩹';
        btn.className = 'plant-baja-btn lesion';
        btn.title = tipo.gradoNombre + ' · ' + partidos + ' partidos';
      }
      var badge = row.querySelector('.plant-baja-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'plant-baja-badge';
        var nameEl = row.querySelector('.plant-name');
        if (nameEl) nameEl.appendChild(badge);
      }
      badge.textContent = tipo.emoji + ' +' + partidos;
      badge.style.display = 'inline';
      badge.style.color = tipo.grado === 3 ? '#ff4444' : tipo.grado === 2 ? '#ff8c00' : '#ffd700';
    });
    if (typeof window._refreshSancionInjList === 'function') window._refreshSancionInjList();
  }

  // ── Motor de lesiones para IA vs IA ───────────────────────────────
  // Llamado desde mlSimEngine al generar eventos
  window.generarLesionesPartido = function(TEAM_A, TEAM_B, activeA, activeB, benA, benB, ft90) {
    var lesiones = [];

    function intentarLesion(equipo, teamName, active, ben, subIdx) {
      var probBase = tieneEuropa(teamName) ? PROB_LESION_EURO : PROB_LESION_BASE;
      if (Math.random() > probBase) return null;

      // Solo jugadores de campo titulares activos no ya lesionados
      var candidatos = active.filter(function(p) {
        return p[2] !== 'P' && !window.BAJA_STORE[p[1]];
      });
      if (!candidatos.length) return null;

      var lesionado = candidatos[Math.floor(Math.random() * candidatos.length)];
      var tipo = sortearGrado();
      var partidos = sortearPartidos(tipo);
      var minLesion = 5 + Math.floor(Math.random() * (ft90 - 10));

      // Sustituto: el mejor disponible del banquillo
      var sustituto = null;
      for (var i = subIdx; i < ben.length; i++) {
        if (!window.BAJA_STORE[ben[i][1]]) { sustituto = ben[i]; break; }
      }

      return {
        equipo: equipo, teamName: teamName,
        jugador: lesionado, sustituto: sustituto,
        tipo: tipo, partidos: partidos, min: minLesion
      };
    }

    var lesA = intentarLesion('a', TEAM_A, activeA, benA, 0);
    var lesB = intentarLesion('b', TEAM_B, activeB, benB, 0);
    if (lesA) lesiones.push(lesA);
    if (lesB) lesiones.push(lesB);
    return lesiones;
  };

  // ── Aplicar lesión en el simulador ─────────────────────────────────
  // Devuelve evento para insertar en evts[]
  window.aplicarLesionEnSimulacion = function(lesion, activeA, activeB) {
    var active = lesion.equipo === 'a' ? activeA : activeB;

    // Quitar al lesionado del campo
    var idx = active.indexOf(lesion.jugador);
    if (idx >= 0) active.splice(idx, 1);

    // Añadir sustituto si hay
    if (lesion.sustituto) active.push(lesion.sustituto);

    // Registrar en BAJA_STORE
    registrarLesion(lesion.jugador[1], lesion.teamName, lesion.partidos, lesion.tipo);

    // Crear evento para el acta (SIN sustitución visible)
    var _lesDesc = (window.LESION_STORE && window.LESION_STORE[lesion.jugador[1]]) ? window.LESION_STORE[lesion.jugador[1]].descripcion : '';
    return {
      min: lesion.min,
      ico: '🩹',
      team: lesion.equipo,
      player: lesion.jugador,
      type: 'lesion',
      grado: lesion.tipo.grado,
      gradoNombre: lesion.tipo.nombre,
      gradoEmoji: lesion.tipo.emoji,
      partidos: lesion.partidos,
      descripcion: _lesDesc,
      grave: lesion.tipo.grado === 3
    };
  };

  // ── Overlay de lesiones post-partido (HvH / IA vs H) ──────────────
  window.LESIONES_PARTIDO_ACTUAL = [];

  window.showLesionPostOverlay = function(lesiones, onConfirm) {
    var el = document.getElementById('lesion-post-overlay');
    if (!el) {
      // Crear el overlay si no existe en el HTML
      el = document.createElement('div');
      el.id = 'lesion-post-overlay';
      el.className = 'lesion-post-ov';
      el.innerHTML = _buildLesionOverlayHTML();
      document.body.appendChild(el);
    }

    // Rellenar contenido
    var listEl = document.getElementById('lpost-list');
    var subEl  = document.getElementById('lpost-sub');
    var iconEl = document.getElementById('lpost-icon');

    if (!lesiones || !lesiones.length) {
      if (onConfirm) onConfirm();
      return;
    }

    window._lesionPostCallback = onConfirm || null;

    var hayGrave = lesiones.some(function(l) { return l.grado === 3 || (l.tipo && l.tipo.grado === 3); });
    iconEl.textContent = hayGrave ? '🔴' : '🩹';
    subEl.textContent  = lesiones.length === 1 ? 'UN JUGADOR LESIONADO' : lesiones.length + ' JUGADORES LESIONADOS';

    listEl.innerHTML = lesiones.map(function(l) {
      var grado   = l.grado || (l.tipo && l.tipo.grado) || 1;
      var gradoNm = l.gradoNombre || (l.tipo && l.tipo.nombre) || 'Leve';
      var gradoEm = l.gradoEmoji  || (l.tipo && l.tipo.emoji) || '🟡';
      var nombre  = l.jugador ? l.jugador[1] : (l.nombre || '');
      var equipo  = l.teamName || l.equipo || '';
      var desc    = l.descripcion || (l.tipo && sortearEjemplo(l.tipo)) || '';
      var parts   = l.partidos || 1;
      var colorGrado = grado === 3 ? '#ff4444' : grado === 2 ? '#ff8c00' : '#ffd700';
      return '<div class="lpost-card">'
        + '<div class="lpost-card-badge" style="background:' + colorGrado + '22;color:' + colorGrado + ';border-color:' + colorGrado + '44">' + gradoEm + ' LESIÓN ' + gradoNm.toUpperCase() + '</div>'
        + '<div class="lpost-card-body">'
        + '<div class="lpost-card-name">' + nombre + '</div>'
        + '<div class="lpost-card-team">' + equipo + '</div>'
        + '<div class="lpost-card-desc">' + desc + '</div>'
        + '</div>'
        + '<div class="lpost-card-partidos">'
        + '<div class="lpost-partidos-num" style="color:' + colorGrado + '">' + parts + '</div>'
        + '<div class="lpost-partidos-lbl">PARTIDO' + (parts > 1 ? 'S' : '') + '</div>'
        + '</div>'
        + '</div>';
    }).join('');

    el.classList.add('show');
    window.scrollTo(0, 0);
  };

  window._lesionPostConfirm = function() {
    var el = document.getElementById('lesion-post-overlay');
    if (el) el.classList.remove('show');
    if (window._lesionPostCallback) { window._lesionPostCallback(); window._lesionPostCallback = null; }
  };

  function _buildLesionOverlayHTML() {
    return '<div class="lpost-inner">'
      + '<div class="lpost-icons"><span id="lpost-icon">🩹</span></div>'
      + '<div class="lpost-title">PARTE MÉDICO</div>'
      + '<div class="lpost-sub" id="lpost-sub">JUGADORES LESIONADOS</div>'
      + '<div class="lpost-list" id="lpost-list"></div>'
      + '<button class="lpost-btn" onclick="window._lesionPostConfirm()">✓ ENTENDIDO</button>'
      + '</div>';
  }

  // ── CSS inline para el overlay ────────────────────────────────────
  var _lesionStyle = document.createElement('style');
  _lesionStyle.textContent = [
    '.lesion-post-ov{display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.92);',
    'overflow-y:auto;padding:20px 16px 40px;}',
    '.lesion-post-ov.show{display:flex;flex-direction:column;align-items:center;}',
    '.lpost-inner{width:100%;max-width:420px;display:flex;flex-direction:column;align-items:center;gap:8px;}',
    '.lpost-icons{font-size:48px;margin-bottom:4px;filter:drop-shadow(0 0 12px rgba(255,100,100,0.6));}',
    '.lpost-title{font-family:Oswald,sans-serif;font-size:26px;font-weight:700;letter-spacing:4px;',
    'color:#fff;text-transform:uppercase;margin-bottom:2px;}',
    '.lpost-sub{font-family:Oswald,sans-serif;font-size:11px;letter-spacing:3px;color:rgba(255,255,255,0.5);',
    'text-transform:uppercase;margin-bottom:12px;}',
    '.lpost-list{width:100%;display:flex;flex-direction:column;gap:10px;margin-bottom:20px;}',
    '.lpost-card{width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);',
    'border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:12px;}',
    '.lpost-card-badge{font-family:Oswald,sans-serif;font-size:9px;letter-spacing:2px;padding:3px 8px;',
    'border-radius:4px;border:1px solid;text-align:center;white-space:nowrap;flex-shrink:0;}',
    '.lpost-card-body{flex:1;min-width:0;}',
    '.lpost-card-name{font-family:Oswald,sans-serif;font-size:15px;font-weight:600;color:#fff;}',
    '.lpost-card-team{font-size:11px;color:rgba(255,255,255,0.4);margin-bottom:3px;}',
    '.lpost-card-desc{font-size:12px;color:rgba(255,255,255,0.6);font-style:italic;}',
    '.lpost-card-partidos{display:flex;flex-direction:column;align-items:center;flex-shrink:0;min-width:40px;}',
    '.lpost-partidos-num{font-family:Oswald,sans-serif;font-size:28px;font-weight:700;line-height:1;}',
    '.lpost-partidos-lbl{font-family:Oswald,sans-serif;font-size:8px;letter-spacing:1px;color:rgba(255,255,255,0.4);}',
    '.lpost-btn{width:100%;max-width:340px;padding:16px;background:#e03c3c;border:none;border-radius:10px;',
    'color:#fff;font-family:Oswald,sans-serif;font-size:16px;font-weight:700;letter-spacing:3px;',
    'cursor:pointer;text-transform:uppercase;}',
    '.lpost-btn:active{opacity:0.8;}',
    // Grave: animación STOP en timer
    '.ml-timer.grave-stop{animation:grave-pulse 0.8s ease-in-out infinite;color:#ff4444 !important;}',
    '@keyframes grave-pulse{0%,100%{opacity:1;}50%{opacity:0.3;}}'
  ].join('');
  document.head.appendChild(_lesionStyle);

  // ── Conectar con procesarSancionesPostPartido ─────────────────────
  // Después de sanciones → mostrar lesiones si las hay
  var _origProcesarSanciones = window.procesarSancionesPostPartido;
  window.procesarSancionesPostPartido = function(events, humanTeam, teamName, compKey) {
    var sanciones = window.calcularSancionesPartido(events, humanTeam, teamName, compKey);
    // Lesiones registradas en este partido (HvH / IA vs H)
    var lesiones = window.LESIONES_PARTIDO_ACTUAL || [];
    window.LESIONES_PARTIDO_ACTUAL = []; // reset para el siguiente partido

    if (sanciones && sanciones.length) {
      // Primero sanciones, luego lesiones
      window.showSancionPostOverlay(sanciones, compKey, function() {
        if (lesiones.length) {
          window.showLesionPostOverlay(lesiones, null);
        }
      });
    } else if (lesiones.length) {
      // Solo lesiones
      window.showLesionPostOverlay(lesiones, null);
    }
    // Si nada, no mostrar nada (no llamar al original)
  };

  // ── Actualizar _refreshSancionInjList con LESION_STORE ────────────
  var _origRefresh = window._refreshSancionInjList;
  window._refreshSancionInjList = function() {
    var listInj = document.getElementById('sancion-ov-list-inj');
    if (!listInj) return;
    var lesiones = Object.keys(window.LESION_STORE);
    if (!lesiones.length) {
      listInj.innerHTML = '<div class="sancion-empty">🚑 Sin lesionados</div>';
      return;
    }
    listInj.innerHTML = lesiones.map(function(nombre) {
      var l = window.LESION_STORE[nombre];
      var colorGrado = l.grado === 3 ? '#ff4444' : l.grado === 2 ? '#ff8c00' : '#ffd700';
      var p = window.BAJA_STORE[nombre] || {};
      var partsTxt = '';
      if (p.liga > 0) partsTxt += '<span style="margin-right:8px">🇪🇸 ' + p.liga + 'P</span>';
      if (p.copa > 0) partsTxt += '<span style="margin-right:8px">🏆 ' + p.copa + 'P</span>';
      if (p.europa > 0) partsTxt += '<span>🌍 ' + p.europa + 'P</span>';
      return '<div class="sancion-card">'
        + '<div class="sancion-card-icon">🩹</div>'
        + '<div class="sancion-card-info">'
        + '<div class="sancion-card-name">' + nombre + '</div>'
        + '<div class="sancion-card-team">' + l.equipo + '</div>'
        + '<div class="sancion-card-reason" style="color:' + colorGrado + '">' + l.gradoEmoji + ' ' + l.gradoNombre + ' — ' + l.descripcion + '</div>'
        + (partsTxt ? '<div style="font-family:Oswald,sans-serif;font-size:11px;color:#f0c040;margin-top:3px;letter-spacing:1px;">' + partsTxt + '</div>' : '')
        + '</div>'
        + '<div class="sancion-card-partidos"><span class="sancion-card-pnum" style="color:' + colorGrado + '">' + (p.liga || 0) + '</span><span class="sancion-card-plbl">PARTIDOS</span></div>'
        + '</div>';
    }).join('');
    var warnEl = document.getElementById('sancion-ov-warn');
    if (warnEl) warnEl.style.display = 'block';
  };

  // ── Generar lesión para partidos HvH / IA vs H ──────────────────
  // Se llama al terminar el partido, genera 0 o 1 lesión por equipo
  // y las guarda en LESIONES_PARTIDO_ACTUAL para mostrar en el overlay
  var _EQUIPOS_HUMANOS = ['Real Madrid','FC Barcelona','Bayern Munich','Arsenal','Atlético Madrid','PSG'];

  window._generarLesionHumano = function(teamA, teamB) {
    window.LESIONES_PARTIDO_ACTUAL = [];
    [teamA, teamB].forEach(function(teamName, idx) {
      var probBase = tieneEuropa(teamName) ? PROB_LESION_EURO : PROB_LESION_BASE;
      if (Math.random() > probBase) return;
      // Buscar jugadores del equipo en la plantilla DOM
      var reg = window.SQUAD_REGISTRY && window.SQUAD_REGISTRY[teamName];
      if (!reg) return;
      var disponibles = reg.filter(function(p) {
        return !p.h && !window.BAJA_STORE[p[1]];
      });
      if (!disponibles.length) return;
      var lesionado = disponibles[Math.floor(Math.random() * disponibles.length)];
      var tipo = sortearGrado();
      var partidos = sortearPartidos(tipo);
      // Registrar siempre (actualiza estado del equipo IA también)
      registrarLesion(lesionado[1], teamName, partidos, tipo);
      // Solo mostrar overlay para equipos humanos
      if (_EQUIPOS_HUMANOS.indexOf(teamName) !== -1) {
        window.LESIONES_PARTIDO_ACTUAL.push({
          jugador: [lesionado[0], lesionado[1]],
          teamName: teamName,
          tipo: tipo,
          grado: tipo.grado,
          gradoNombre: tipo.nombre,
          gradoEmoji: tipo.emoji,
          descripcion: sortearEjemplo(tipo),
          partidos: partidos
        });
      }
    });
  };

  window.LESION_STORE_UTILS = {
    registrar: registrarLesion,
    sortearGrado: sortearGrado,
    sortearPartidos: sortearPartidos,
    sortearEjemplo: sortearEjemplo,
    tiposLesion: LESION_TIPOS
  };

  console.log('[eFootball] Sistema de Lesiones activado ✓');
})();



/* ══ FIX SCROLL — Restaurar posición tras añadir evento ══════════════
   Cuando se confirma un jugador en el picker overlay, el DOM cambia
   y el navegador pierde la posición de scroll. Este bloque guarda la
   posición antes de abrir el overlay y la restaura al cerrarlo.
   ══════════════════════════════════════════════════════════════════ */
(function(){
  var _savedScrollY = 0;

  // Guardar scroll al abrir cualquier overlay de selección de jugador
  var _origShowPl = {};
  ['j1m1','j1m2','j1m3'].forEach(function(mid) {
    var showFnName = 'mlShowPl_' + mid;
    var hideFnName = 'mlHidePl_' + mid;
    var confirmFnName = 'mlPlConfirm_' + mid;

    // Parchear mlShowPl para guardar scroll
    (function(fn) {
      window[showFnName] = function() {
        _savedScrollY = window.scrollY || window.pageYOffset || 0;
        if (fn) fn.apply(this, arguments);
      };
    })(window[showFnName]);

    // Parchear mlHidePl para restaurar scroll
    (function(fn) {
      window[hideFnName] = function() {
        if (fn) fn.apply(this, arguments);
        setTimeout(function() {
          window.scrollTo({ top: _savedScrollY, behavior: 'instant' });
        }, 0);
      };
    })(window[hideFnName]);

    // Parchear mlPlConfirm para restaurar scroll tras confirmar
    (function(fn) {
      window[confirmFnName] = function(num, name) {
        if (fn) fn.apply(this, arguments);
        setTimeout(function() {
          window.scrollTo({ top: _savedScrollY, behavior: 'instant' });
        }, 30);
      };
    })(window[confirmFnName]);
  });

  // También aplicar a los overlays de selección de equipo (mlTPOverlay)
  var _origTPSelect = {};
  ['j1m1','j1m2','j1m3'].forEach(function(mid) {
    var showTPName = 'mlShowTP_' + mid;
    var hideTPName = 'mlHideTP_' + mid;

    (function(fn) {
      window[showTPName] = function() {
        _savedScrollY = window.scrollY || window.pageYOffset || 0;
        if (fn) fn.apply(this, arguments);
      };
    })(window[showTPName]);

    (function(fn) {
      window[hideTPName] = function() {
        if (fn) fn.apply(this, arguments);
        setTimeout(function() {
          window.scrollTo({ top: _savedScrollY, behavior: 'instant' });
        }, 0);
      };
    })(window[hideTPName]);
  });

  // También guardar scroll al abrir el overlay de eventos (mlShowEvOv)
  ['j1m1','j1m2','j1m3'].forEach(function(mid) {
    var showEvName = 'mlShowEvOv_' + mid;
    var hideEvName = 'mlHideEvOv_' + mid;

    (function(fn) {
      window[showEvName] = function() {
        _savedScrollY = window.scrollY || window.pageYOffset || 0;
        if (fn) fn.apply(this, arguments);
      };
    })(window[showEvName]);

    (function(fn) {
      window[hideEvName] = function() {
        if (fn) fn.apply(this, arguments);
        setTimeout(function() {
          window.scrollTo({ top: _savedScrollY, behavior: 'instant' });
        }, 0);
      };
    })(window[hideEvName]);
  });

  console.log('[eFootball] Fix scroll overlay activado ✓');
})();


/* ══ PODER DE EQUIPO — Valor visible junto al escudo ════════════════
   Muestra el poder/valor del equipo (sobre 100) discretamente
   junto al nombre del equipo en marcadores, previas y calendario,
   sin contaminar textContent (usa data-attributes + ::after).
   ══════════════════════════════════════════════════════════════════ */
(function(){

  function getPoderEquipo(teamName) {
    var aliases = window.TEAM_ALIASES || {};
    var clean = (teamName || '').replace(/\s+\d+\s*\/\s*100$/,'').trim();
    var resolved = aliases[clean.toLowerCase()] || clean;
    var r = window.TEAM_RATINGS && (window.TEAM_RATINGS[resolved] || window.TEAM_RATINGS[clean]);
    if (!r) return null;
    return Math.max(1, Math.min(100, Math.round(r)));
  }

  function poderTone(val) {
    if (val >= 84) return 'elite';
    if (val >= 79) return 'alto';
    if (val >= 74) return 'medio';
    return 'base';
  }

  var _style = document.createElement('style');
  _style.textContent = [
    '[data-team-power]{position:relative;}',
    '[data-team-power]::after{',
    '  content:attr(data-team-power);',
    '  display:inline-flex;',
    '  align-items:center;',
    '  justify-content:center;',
    '  min-width:22px;',
    '  margin-left:6px;',
    '  padding:1px 6px;',
    '  border-radius:999px;',
    '  font-family:Oswald,sans-serif;',
    '  font-size:10px;',
    '  font-weight:700;',
    '  letter-spacing:.35px;',
    '  line-height:1.35;',
    '  vertical-align:middle;',
    '  background:rgba(255,255,255,.07);',
    '  border:1px solid rgba(255,255,255,.12);',
    '  color:rgba(255,255,255,.82);',
    '  box-sizing:border-box;',
    '}',
    '[data-team-power-tone="elite"]::after{color:rgba(255,215,130,.92);}',
    '[data-team-power-tone="alto"]::after{color:rgba(193,229,255,.88);}',
    '[data-team-power-tone="medio"]::after{color:rgba(222,222,222,.82);}',
    '[data-team-power-tone="base"]::after{color:rgba(255,182,151,.78);}',
    '.ml-team-name[data-team-power]::after{font-size:9px;padding:1px 5px;margin-left:5px;}',
    '.mn[data-team-power]::after{font-size:9px;padding:1px 5px;margin-left:4px;opacity:.78;}',
    '@media (max-width:768px){',
    '  [data-team-power]::after{font-size:9px;padding:1px 5px;min-width:20px;margin-left:4px;}',
    '}'
  ].join('');
  document.head.appendChild(_style);

  function cleanVisibleTeamName(el) {
    if (!el) return '';
    var txt = (el.getAttribute('data-team-name') || el.textContent || '').trim();
    txt = txt.replace(/\s+\d+\s*\/\s*100$/,'').trim();
    return txt;
  }

  function decorateTeamEl(el, explicitName) {
    if (!el) return;
    var teamName = (explicitName || cleanVisibleTeamName(el) || '').trim();
    if (!teamName || teamName === 'Por definir') return;
    var poder = getPoderEquipo(teamName);
    if (!poder) return;
    el.setAttribute('data-team-name', teamName);
    el.setAttribute('data-team-power', String(poder));
    el.setAttribute('data-team-power-tone', poderTone(poder));
    el.title = teamName + ' · Poder ' + poder + '/100';
  }

  function injectCalendarPower() {
    document.querySelectorAll('.mrow .mn').forEach(function(el) {
      decorateTeamEl(el);
      var oldBadge = el.querySelector('.team-poder-badge');
      if (oldBadge) oldBadge.remove();
    });
  }

  function injectLiveHeaderPower() {
    document.querySelectorAll('.ml-header').forEach(function(header) {
      var names = header.querySelectorAll('.ml-team-name');
      if (names[0]) decorateTeamEl(names[0]);
      if (names[1]) decorateTeamEl(names[1]);
    });
  }

  function injectGenericPower() {
    document.querySelectorAll('[data-team-a],[data-team-b]').forEach(function(box) {
      var aName = box.getAttribute('data-team-a');
      var bName = box.getAttribute('data-team-b');
      var names = box.querySelectorAll('.ml-team-name,.mn,.team-name');
      if (names[0] && aName) decorateTeamEl(names[0], aName);
      if (names[1] && bName) decorateTeamEl(names[1], bName);
    });
  }

  function injectAllTeamPower() {
    injectCalendarPower();
    injectLiveHeaderPower();
    injectGenericPower();
  }

  window.getPoderEquipoVisible = getPoderEquipo;
  window.injectAllTeamPower = injectAllTeamPower;

  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(injectAllTeamPower, 180);
  });

  var _origGoPoder = window.go;
  window.go = function(id) {
    if (_origGoPoder) _origGoPoder.apply(this, arguments);
    setTimeout(injectAllTeamPower, 180);
  };

  if (typeof MutationObserver !== 'undefined') {
    var _obs = new MutationObserver(function() {
      setTimeout(injectAllTeamPower, 60);
    });
    document.addEventListener('DOMContentLoaded', function() {
      _obs.observe(document.body, { childList:true, subtree:true });
    });
  }

  console.log('[eFootball] Poder de equipos activado ✓');
})();


/* ══════════════════════════════════════════════════════════════════════
   CAMPO DE CHAPAS — Visualización táctica en tiempo real
   Aparece en partidos IA vs IA cuando ambos equipos tienen rating ≥ 79
   ══════════════════════════════════════════════════════════════════════ */
(function(){

  // ── Colores de equipos ────────────────────────────────────────────
  var CAMPO_TEAM_COLORS = {
    'Real Madrid':      { bg:'#ffffff', fg:'#003087', border:'#d4af37' },
    'FC Barcelona':     { bg:'#a50044', fg:'#edbb00', border:'#003da5' },
    'Atlético Madrid':  { bg:'#c50f1f', fg:'#ffffff', border:'#ffffff' },
    'Athletic Club':    { bg:'#cc1010', fg:'#ffffff', border:'#000000' },
    'Real Betis':       { bg:'#00a650', fg:'#ffffff', border:'#ffd700' },
    'Real Sociedad':    { bg:'#003f8a', fg:'#d0dcf4', border:'#d0dcf4' },
    'Sevilla FC':       { bg:'#ffffff', fg:'#c60b1e', border:'#c60b1e' },
    'Villarreal CF':    { bg:'#ffd700', fg:'#1a1a1a', border:'#1a1a1a' },
    'Celta de Vigo':    { bg:'#6fc6e2', fg:'#003da5', border:'#003da5' },
    'Girona FC':        { bg:'#c8102e', fg:'#ffffff', border:'#ffffff' },
    'Osasuna':          { bg:'#c8102e', fg:'#ffffff', border:'#000000' },
    'Deportivo Alavés': { bg:'#003da5', fg:'#ffffff', border:'#ffffff' },
    'Mallorca':         { bg:'#c8102e', fg:'#ffcc00', border:'#000000' },
    'Rayo Vallecano':   { bg:'#ffffff', fg:'#e8000d', border:'#e8000d' },
    'Valencia CF':      { bg:'#ffffff', fg:'#ef7d00', border:'#000000' },
    'Espanyol':         { bg:'#003da5', fg:'#ffffff', border:'#ffffff' },
    'Getafe CF':        { bg:'#003da5', fg:'#ffffff', border:'#a0a0a0' },
    'Elche CF':         { bg:'#006633', fg:'#ffffff', border:'#ffffff' },
    'Córdoba CF':       { bg:'#2a7e43', fg:'#ffffff', border:'#ffffff' },
    'Albacete BP':      { bg:'#8b0000', fg:'#fff200', border:'#fff200' },
    'Levante UD':       { bg:'#c8102e', fg:'#0057a8', border:'#0057a8' },
    'Real Oviedo':      { bg:'#003da5', fg:'#ffffff', border:'#ffffff' },
    'Sevilla':          { bg:'#ffffff', fg:'#c60b1e', border:'#c60b1e' },
    'Villarreal':       { bg:'#ffd700', fg:'#1a1a1a', border:'#1a1a1a' },
  };

  function getTeamColors(name) {
    var aliases = window.TEAM_ALIASES || {};
    var resolved = aliases[(name||'').trim().toLowerCase()] || name;
    return CAMPO_TEAM_COLORS[resolved] || CAMPO_TEAM_COLORS[name] || { bg:'#888', fg:'#fff', border:'#fff' };
  }
  window.getTeamColors = getTeamColors;

  // ── Formaciones 4-3-3 ────────────────────────────────────────────
  // Posiciones normalizadas [x%, y%] — campo horizontal, equipo A ataca →
  var FORMATION_A = [
    // Portero
    [8, 50],
    // Defensas (4)
    [22, 20], [22, 40], [22, 60], [22, 80],
    // Medios (3)
    [42, 25], [42, 50], [42, 75],
    // Delanteros (3)
    [65, 20], [65, 50], [65, 80]
  ];
  var FORMATION_B = [
    // Portero
    [92, 50],
    // Defensas (4)
    [78, 20], [78, 40], [78, 60], [78, 80],
    // Medios (3)
    [58, 25], [58, 50], [58, 75],
    // Delanteros (3)
    [35, 20], [35, 50], [35, 80]
  ];

  // ── Crear canvas del campo ────────────────────────────────────────
  function createCampoElement(matchKey, teamA, teamB) {
    var wrap = document.createElement('div');
    wrap.id = 'campo-wrap-' + matchKey;
    wrap.className = 'campo-wrap';
    wrap.innerHTML =
      '<div class="campo-header">'
      + '<span class="campo-lbl">⚽ CAMPO EN VIVO</span>'
      + '</div>'
      + '<div class="campo-field" id="campo-field-' + matchKey + '">'
      + '<canvas id="campo-canvas-' + matchKey + '" class="campo-canvas"></canvas>'
      + '</div>';
    return wrap;
  }

  // ── Dibujar campo ────────────────────────────────────────────────
  function drawField(ctx, W, H) {
    // Fondo verde
    ctx.fillStyle = '#2d7a2d';
    ctx.fillRect(0, 0, W, H);

    // Líneas del campo
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;

    // Borde
    ctx.strokeRect(8, 8, W-16, H-16);

    // Línea central
    ctx.beginPath();
    ctx.moveTo(W/2, 8);
    ctx.lineTo(W/2, H-8);
    ctx.stroke();

    // Círculo central
    ctx.beginPath();
    ctx.arc(W/2, H/2, H*0.12, 0, Math.PI*2);
    ctx.stroke();

    // Punto central
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(W/2, H/2, 3, 0, Math.PI*2);
    ctx.fill();

    // Área grande izquierda
    var aW = W*0.12, aH = H*0.44;
    ctx.strokeRect(8, H/2 - aH/2, aW, aH);

    // Área pequeña izquierda
    var saW = W*0.05, saH = H*0.22;
    ctx.strokeRect(8, H/2 - saH/2, saW, saH);

    // Área grande derecha
    ctx.strokeRect(W-8-aW, H/2 - aH/2, aW, aH);

    // Área pequeña derecha
    ctx.strokeRect(W-8-saW, H/2 - saH/2, saW, saH);

    // Punto de penalti izquierdo
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(W*0.13, H/2, 2.5, 0, Math.PI*2);
    ctx.fill();

    // Punto de penalti derecho
    ctx.beginPath();
    ctx.arc(W*0.87, H/2, 2.5, 0, Math.PI*2);
    ctx.fill();

    // Franjas de césped (decorativas)
    for (var s = 0; s < 8; s++) {
      if (s % 2 === 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fillRect(8 + s * (W-16)/8, 8, (W-16)/8, H-16);
      }
    }
  }

  // ── Estado de las chapas ─────────────────────────────────────────
  var _campoStates = {};

  function initCampoState(matchKey, teamA, teamB) {
    var colA = getTeamColors(teamA);
    var colB = getTeamColors(teamB);

    var players = [];
    // Equipo A (11 jugadores)
    for (var i = 0; i < 11; i++) {
      players.push({
        team: 'a', idx: i,
        x: FORMATION_A[i][0], y: FORMATION_A[i][1],
        tx: FORMATION_A[i][0], ty: FORMATION_A[i][1], // target
        bg: colA.bg, fg: colA.fg, border: colA.border,
        num: i + 1, highlighted: false, expelled: false
      });
    }
    // Equipo B (11 jugadores)
    for (var j = 0; j < 11; j++) {
      players.push({
        team: 'b', idx: j,
        x: FORMATION_B[j][0], y: FORMATION_B[j][1],
        tx: FORMATION_B[j][0], ty: FORMATION_B[j][1],
        bg: colB.bg, fg: colB.fg, border: colB.border,
        num: j + 1, highlighted: false, expelled: false
      });
    }

    // Balón
    var ball = { x: 50, y: 50, tx: 50, ty: 50, visible: true };

    _campoStates[matchKey] = {
      players: players,
      ball: ball,
      teamA: teamA,
      teamB: teamB,
      animFrame: null,
      lastEvent: null,
      phase: 'idle' // idle | attack-a | attack-b | goal-a | goal-b
    };
    return _campoStates[matchKey];
  }

  // ── Animación suave de chapas ────────────────────────────────────
  function animateCampo(matchKey) {
    var state = _campoStates[matchKey];
    if (!state) return;
    var canvas = document.getElementById('campo-canvas-' + matchKey);
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;

    // Mover chapas hacia target (lerp)
    state.players.forEach(function(p) {
      if (p.expelled) return;
      p.x += (p.tx - p.x) * 0.08;
      p.y += (p.ty - p.y) * 0.08;
    });
    // Mover balón
    state.ball.x += (state.ball.tx - state.ball.x) * 0.10;
    state.ball.y += (state.ball.ty - state.ball.y) * 0.10;

    // Movimiento aleatorio sutil (breathing)
    if (Math.random() < 0.02) {
      randomMicroMove(state);
    }

    drawField(ctx, W, H);
    drawPlayers(ctx, W, H, state);
    drawBall(ctx, W, H, state.ball);

    state.animFrame = requestAnimationFrame(function() { animateCampo(matchKey); });
  }

  function randomMicroMove(state) {
    state.players.forEach(function(p) {
      if (p.expelled) return;
      var base = p.team === 'a' ? FORMATION_A[p.idx] : FORMATION_B[p.idx];
      p.tx = base[0] + (Math.random() - 0.5) * 6;
      p.ty = base[1] + (Math.random() - 0.5) * 6;
      // Mantener en campo
      p.tx = Math.max(5, Math.min(95, p.tx));
      p.ty = Math.max(5, Math.min(95, p.ty));
    });
  }

  function drawPlayers(ctx, W, H, state) {
    state.players.forEach(function(p) {
      if (p.expelled) return;
      var px = p.x / 100 * W;
      var py = p.y / 100 * H;
      var r = Math.min(W, H) * 0.038;

      // Sombra
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;

      // Círculo principal
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI*2);
      ctx.fillStyle = p.bg;
      ctx.fill();

      // Borde
      ctx.strokeStyle = p.highlighted ? '#ffff00' : p.border;
      ctx.lineWidth = p.highlighted ? 3 : 1.5;
      ctx.stroke();
      ctx.restore();

      // Número
      ctx.font = 'bold ' + Math.round(r * 0.85) + 'px Oswald,sans-serif';
      ctx.fillStyle = p.fg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.num, px, py + 0.5);
    });
  }

  function drawBall(ctx, W, H, ball) {
    if (!ball.visible) return;
    var bx = ball.x / 100 * W;
    var by = ball.y / 100 * H;
    var br = Math.min(W, H) * 0.022;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI*2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Manchas del balón
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(bx - br*0.25, by - br*0.25, br*0.28, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  // ── Reaccionar a eventos del acta ────────────────────────────────
  function procesarEventoCampo(matchKey, evType, evTeam, evMin) {
    var state = _campoStates[matchKey];
    if (!state) return;

    if (evType === 'gol' || evType === 'pen-gol' || evType === 'falta-gol') {
      reactionGol(state, evTeam);
    } else if (evType === 'pen-parado') {
      reactionPenParado(state, evTeam);
    } else if (evType === 'card' || evType === 'roja' || evType === 'd-amarilla') {
      reactionTarjeta(state, evTeam, evType);
    } else if (evType === 'pen-prov') {
      reactionPenalti(state, evTeam);
    } else {
      // Movimiento genérico de ataque
      reactionAtaque(state, evTeam);
    }
  }

  function reactionGol(state, team) {
    // Atacantes del equipo que marca se juntan en el centro
    var isA = team === 'a';
    state.players.forEach(function(p) {
      if (p.expelled) return;
      if (p.team === team && p.idx >= 8) { // delanteros
        p.tx = isA ? 50 + Math.random()*10 : 50 - Math.random()*10;
        p.ty = 45 + Math.random()*10;
        p.highlighted = true;
        setTimeout(function() { p.highlighted = false; }, 3000);
      }
    });
    // Balón va a la portería
    state.ball.tx = isA ? 95 : 5;
    state.ball.ty = 50;
    setTimeout(function() {
      // Vuelta al centro
      state.ball.tx = 50; state.ball.ty = 50;
      resetFormations(state);
    }, 4000);
  }

  function reactionPenParado(state, gkTeam) {
    // GK se desplaza al poste
    var gk = state.players.find(function(p) { return p.team === gkTeam && p.idx === 0; });
    if (gk) {
      gk.tx = gkTeam === 'a' ? 5 : 95;
      gk.ty = 35 + Math.random() * 30;
      gk.highlighted = true;
      setTimeout(function() { gk.highlighted = false; resetFormations(state); }, 3500);
    }
    // Balón rebota
    state.ball.tx = gkTeam === 'a' ? 15 : 85;
    state.ball.ty = 50;
  }

  function reactionTarjeta(state, team, type) {
    if (type === 'roja' || type === 'd-amarilla') {
      // Buscar un jugador del equipo para expulsar (no el portero)
      var candidates = state.players.filter(function(p) {
        return p.team === team && p.idx > 0 && !p.expelled;
      });
      if (candidates.length) {
        var expelled = candidates[Math.floor(Math.random() * candidates.length)];
        expelled.expelled = true;
        expelled.tx = expelled.team === 'a' ? -5 : 105;
      }
    } else {
      // Amarilla: jugador se detiene
      reactionAtaque(state, team === 'a' ? 'b' : 'a');
    }
  }

  function reactionPenalti(state, foulTeam) {
    // Rival va al punto de penalti
    var shootTeam = foulTeam === 'a' ? 'b' : 'a';
    var striker = state.players.find(function(p) { return p.team === shootTeam && p.idx >= 8; });
    if (striker) {
      striker.tx = foulTeam === 'a' ? 13 : 87;
      striker.ty = 50;
    }
    state.ball.tx = foulTeam === 'a' ? 13 : 87;
    state.ball.ty = 50;
  }

  function reactionAtaque(state, team) {
    var isA = team === 'a';
    // Medios y delanteros avanzan
    state.players.forEach(function(p) {
      if (p.expelled) return;
      if (p.team === team && p.idx >= 4) {
        var base = isA ? FORMATION_A[p.idx] : FORMATION_B[p.idx];
        var advance = isA ? 8 : -8;
        p.tx = Math.max(5, Math.min(95, base[0] + advance));
        p.ty = base[1] + (Math.random()-0.5)*8;
      }
    });
    // Balón avanza
    state.ball.tx = isA ? state.ball.x + 15 : state.ball.x - 15;
    state.ball.tx = Math.max(5, Math.min(95, state.ball.tx));
    setTimeout(resetFormations.bind(null, state), 3000);
  }

  function resetFormations(state) {
    state.players.forEach(function(p) {
      if (p.expelled) return;
      var base = p.team === 'a' ? FORMATION_A[p.idx] : FORMATION_B[p.idx];
      p.tx = base[0]; p.ty = base[1];
    });
  }

  // ── CSS ──────────────────────────────────────────────────────────
  var _campoStyle = document.createElement('style');
  _campoStyle.textContent = [
    '.campo-wrap{',
    '  margin-top:12px;',
    '  background:rgba(0,0,0,0.25);',
    '  border:1px solid rgba(255,255,255,0.08);',
    '  border-radius:10px;',
    '  overflow:hidden;',
    '}',
    '.campo-header{',
    '  padding:6px 12px;',
    '  background:rgba(255,255,255,0.04);',
    '  border-bottom:1px solid rgba(255,255,255,0.07);',
    '  display:flex;align-items:center;gap:6px;',
    '}',
    '.campo-lbl{',
    '  font-family:Oswald,sans-serif;',
    '  font-size:10px;letter-spacing:2px;',
    '  color:rgba(255,255,255,0.5);',
    '  text-transform:uppercase;',
    '}',
    '.campo-field{',
    '  padding:8px;',
    '  display:flex;justify-content:center;',
    '}',
    '.campo-canvas{',
    '  width:100%;',
    '  max-width:440px;',
    '  height:auto;',
    '  border-radius:6px;',
    '  display:block;',
    '}'
  ].join('');
  document.head.appendChild(_campoStyle);

  // ── Hook en mlSimEngine ──────────────────────────────────────────
  // Detectar partidos ≥79 e inyectar el campo
  var _origSimEngine = window.mlSimEngine;
  window.mlSimEngine = function(cfg) {
    var TEAM_A = (cfg.teamA || '').trim();
    var TEAM_B = (cfg.teamB || '').trim();

    // Resolver aliases
    var aliases = window.TEAM_ALIASES || {};
    var resolvedA = aliases[TEAM_A.toLowerCase()] || TEAM_A;
    var resolvedB = aliases[TEAM_B.toLowerCase()] || TEAM_B;

    var rA = window.TEAM_RATINGS && (window.TEAM_RATINGS[resolvedA] || window.TEAM_RATINGS[TEAM_A]) || 0;
    var rB = window.TEAM_RATINGS && (window.TEAM_RATINGS[resolvedB] || window.TEAM_RATINGS[TEAM_B]) || 0;

    var usarCampo = rA >= 79 && rB >= 79;

    if (usarCampo) {
      // Cambiar velocidad: 45s por parte (total ~90s)
      var cfgMod = {};
      Object.keys(cfg).forEach(function(k){ cfgMod[k] = cfg[k]; });
      cfgMod._usarCampo = true;
      cfgMod._teamAResolved = resolvedA;
      cfgMod._teamBResolved = resolvedB;

      // Inyectar canvas ANTES de simular
      setTimeout(function() {
        var listEl = document.getElementById(cfg.listId);
        if (!listEl) return;
        var matchWrap = listEl.closest('.match-live-wrap') || listEl.parentElement;
        if (!matchWrap) return;

        // Buscar o crear contenedor del campo
        var existing = document.getElementById('campo-wrap-' + cfg.matchKey);
        if (existing) existing.remove();

        var campoEl = createCampoElement(cfg.matchKey, resolvedA, resolvedB);

        // Insertar ENTRE el marcador y el acta
        // El acta tiene id="acta-body-MATCHKEY" o está justo antes de ml-acta-list
        var actaBody = matchWrap.querySelector('[id^="acta-body-"]') ||
                       matchWrap.querySelector('[id^="acta-toggle-"]') ||
                       document.getElementById(cfg.listId);
        if (actaBody) {
          // Insertar antes del bloque del acta
          var actaParent = actaBody.parentElement || matchWrap;
          actaParent.insertBefore(campoEl, actaBody);
        } else {
          matchWrap.appendChild(campoEl);
        }

        // Inicializar canvas con tamaño correcto
        var canvas = document.getElementById('campo-canvas-' + cfg.matchKey);
        if (canvas) {
          canvas.width = 440;
          canvas.height = 280;
          var state = initCampoState(cfg.matchKey, resolvedA, resolvedB);
          animateCampo(cfg.matchKey);
        }

        // Observar el acta para reaccionar a eventos
        var actaList = document.getElementById(cfg.listId);
        if (actaList) {
          var _obs = new MutationObserver(function(mutations) {
            mutations.forEach(function(m) {
              m.addedNodes.forEach(function(node) {
                if (!node.classList || !node.classList.contains('ml-evt-item')) return;
                var type = node.getAttribute('data-type') || '';
                var team = node.getAttribute('data-team') || 'a';
                procesarEventoCampo(cfg.matchKey, type, team, 0);
              });
            });
          });
          _obs.observe(actaList, { childList: true });
        }
      }, 200);
    }

    // Llamar al engine original (con velocidad aumentada si procede)
    if (usarCampo) {
      // Guardar velocidades originales y aumentar a 45s por parte
      var origNS = window._CAMPO_NORMAL_SPEED_ORIG || 944;
      var origES = window._CAMPO_ET_SPEED_ORIG || 833;
      // 45s por parte = cada minuto dura 45000/45 = 1000ms → ya es 1000
      // Para 45s queremos que 45 mins pasen en 45s: speed=1000 está bien
      // Pero necesitamos que el ticker de 30 ticks (cada 1s) dure 90s
      // El ticker actual usa 1000ms/tick, 30 ticks = 30s total
      // Para 90s necesitamos 3000ms/tick → multiplicamos ×3
      window._CAMPO_ACTIVE = true;
      window._CAMPO_MATCH_KEY = cfg.matchKey;
    }

    return _origSimEngine ? _origSimEngine.apply(this, arguments) : undefined;
  };

  // ── Parchar el ticker de animación del simulador para 45s por parte ──
  // El ticker original usa setInterval de 1000ms con 30 ticks = 30s
  // Para 45s por parte queremos 45000ms / 15 ticks = 3000ms/tick
  var _origSetInterval = window.setInterval;
  // Parcheamos dentro de mlSimEngine extendiendo el cfg
  // La forma más limpia: extender el onEnd para limpiar el campo
  var _origGoCampo = window.go;
  window.go = function(id) {
    if (_origGoCampo) _origGoCampo.apply(this, arguments);
    // Limpiar animaciones de campos al cambiar de pantalla
    Object.keys(_campoStates).forEach(function(key) {
      var s = _campoStates[key];
      if (s && s.animFrame) {
        cancelAnimationFrame(s.animFrame);
        s.animFrame = null;
      }
    });
    // Re-arrancar si volvemos a la misma pantalla
    setTimeout(function() {
      Object.keys(_campoStates).forEach(function(key) {
        var canvas = document.getElementById('campo-canvas-' + key);
        if (canvas && canvas.closest('.screen.active')) {
          animateCampo(key);
        }
      });
    }, 100);
  };

  console.log('[eFootball] Campo de chapas activado ✓');
})();

/* ============================================================
   AUTO-EVAL OBJECTIVES ENGINE
   ============================================================ */
(function(){

  // Generic team objective counter (mirrors athObjCount logic)
  function teamObjCount(cfg) {
    var container = document.getElementById(cfg.containerId);
    if (!container) return;
    var items = container.querySelectorAll('.obj-item');
    var total = items.length;
    var done = 0;
    items.forEach(function(lbl) {
      var cb = lbl.querySelector('input[type=checkbox]');
      if (cb && cb.checked) { done++; lbl.classList.add('done'); }
      else { lbl.classList.remove('done'); }
    });
    var countEl = document.getElementById(cfg.countId);
    if (countEl) countEl.textContent = done + ' / ' + total;
    var PTS_POR_OBJ = 0.40, MONEY_POR_OBJ = 40, MAX_PTS = 7.00, MAX_MONEY = 750;
    var pts = parseFloat((done * PTS_POR_OBJ).toFixed(2));
    var money = done * MONEY_POR_OBJ;
    var pctPts = Math.min(100, (pts / MAX_PTS) * 100);
    var pctMoney = Math.min(100, (money / MAX_MONEY) * 100);
    var superadoPts = pts >= MAX_PTS, superadoMoney = money >= MAX_MONEY;
    var ptsEl = document.getElementById(cfg.ptsValId);
    var moneyEl = document.getElementById(cfg.moneyValId);
    if (ptsEl) { ptsEl.textContent = pts.toFixed(2); ptsEl.classList.remove('pulse'); void ptsEl.offsetWidth; ptsEl.classList.add('pulse'); ptsEl.classList.toggle('superado', superadoPts); }
    if (moneyEl) { moneyEl.textContent = money; moneyEl.classList.remove('pulse'); void moneyEl.offsetWidth; moneyEl.classList.add('pulse'); moneyEl.classList.toggle('superado', superadoMoney); }
    var tPts = document.getElementById(cfg.ptsTgtId), tMoney = document.getElementById(cfg.moneyTgtId);
    if (tPts) tPts.classList.toggle('superado', superadoPts);
    if (tMoney) tMoney.classList.toggle('superado', superadoMoney);
    var barPts = document.getElementById(cfg.barPtsId), barMoney = document.getElementById(cfg.barMoneyId);
    if (barPts) { barPts.style.width = pctPts + '%'; barPts.classList.toggle('superado', superadoPts); }
    if (barMoney) { barMoney.style.width = pctMoney + '%'; barMoney.classList.toggle('superado', superadoMoney); }
    if (superadoPts && superadoMoney) {
      setTimeout(function() { if (typeof lanzarFuegos === 'function') lanzarFuegos(3000); }, 300);
    }
  }

  window.betObjCount = function() {
    teamObjCount({ containerId:'bet-obj', countId:'bet-obj-prog', ptsValId:'bet-pts-val', moneyValId:'bet-money-val', ptsTgtId:'bet-pts-target', moneyTgtId:'bet-money-target', barPtsId:'bet-bar-pts', barMoneyId:'bet-bar-money' });
  };
  window.socObjCount = function() {
    teamObjCount({ containerId:'soc-obj', countId:'soc-obj-prog', ptsValId:'soc-pts-val', moneyValId:'soc-money-val', ptsTgtId:'soc-pts-target', moneyTgtId:'soc-money-target', barPtsId:'soc-bar-pts', barMoneyId:'soc-bar-money' });
  };
  window.madObjCount = function() {
    teamObjCount({ containerId:'mad-obj', countId:'mad-obj-prog', ptsValId:'mad-pts-val', moneyValId:'mad-money-val', ptsTgtId:'mad-pts-target', moneyTgtId:'mad-money-target', barPtsId:'mad-bar-pts', barMoneyId:'mad-bar-money' });
  };
  window.barObjCount = function() {
    teamObjCount({ containerId:'bar-obj', countId:'bar-obj-prog', ptsValId:'bar-pts-val', moneyValId:'bar-money-val', ptsTgtId:'bar-pts-target', moneyTgtId:'bar-money-target', barPtsId:'bar-bar-pts', barMoneyId:'bar-bar-money' });
  };

  // Auto-evaluate objectives with data-auto attribute
  function autoEvalObjetivos(teamName, containerId, countFn) {
    var standings = window.collectStandings ? window.collectStandings() : [];
    var teamRow = null, teamPos = null;
    standings.forEach(function(row, i) {
      if (row.name === teamName) { teamRow = row; teamPos = i + 1; }
    });

    var container = document.getElementById(containerId);
    if (!container) return;

    var autoCbs = container.querySelectorAll('input[data-auto]');
    autoCbs.forEach(function(cb) {
      var key = cb.getAttribute('data-auto');
      var shouldCheck = false;

      if (key.startsWith('liga-pos-')) {
        var N = parseInt(key.split('-')[2]);
        shouldCheck = teamPos !== null && teamPos <= N;

      } else if (key.startsWith('liga-imbatido-')) {
        var N = parseInt(key.split('-')[2]);
        var form = teamRow ? (teamRow.form || []) : [];
        var consecutive = 0;
        for (var i = form.length - 1; i >= 0; i--) {
          if (form[i] === 'V' || form[i] === 'E') consecutive++;
          else break;
        }
        // Update counter display
        var lbl0 = cb.closest('.obj-item');
        if (lbl0) { var ctr = lbl0.querySelector('.obj-counter'); if (ctr) { var mx = ctr.querySelector('.obj-counter-max'); if (mx) { var mxH = mx.outerHTML; ctr.innerHTML = consecutive + mxH; } } }
        shouldCheck = teamRow !== null && consecutive >= N;

      } else if (key.startsWith('liga-pct-')) {
        var N = parseInt(key.split('-')[2]);
        var pct = teamRow && teamRow.pj > 0 ? Math.round((teamRow.v / teamRow.pj) * 100) : 0;
        var lbl0 = cb.closest('.obj-item');
        if (lbl0) { var ctr = lbl0.querySelector('.obj-counter'); if (ctr) { var mx = ctr.querySelector('.obj-counter-max'); if (mx) { var mxH = mx.outerHTML; ctr.innerHTML = pct + '%' + mxH; } } }
        shouldCheck = teamRow !== null && pct >= N;

      } else if (key.startsWith('liga-delante-')) {
        var rivalName = key.replace('liga-delante-', '');
        var rivalPos = null;
        standings.forEach(function(row, i) { if (row.name === rivalName) rivalPos = i + 1; });
        shouldCheck = teamPos !== null && rivalPos !== null && teamPos < rivalPos;

      } else if (key.startsWith('liga-gf-')) {
        var N = parseInt(key.split('-')[2]);
        var gf = teamRow ? (teamRow.gf || 0) : 0;
        var lbl0 = cb.closest('.obj-item');
        if (lbl0) { var ctr = lbl0.querySelector('.obj-counter'); if (ctr) { var mx = ctr.querySelector('.obj-counter-max'); if (mx) { var mxH = mx.outerHTML; ctr.innerHTML = gf + mxH; } } }
        shouldCheck = teamRow !== null && gf >= N;

      } else if (key.startsWith('liga-dg-')) {
        var N = parseInt(key.split('-')[2]);
        var dg = teamRow ? (teamRow.dg || 0) : 0;
        var lbl0 = cb.closest('.obj-item');
        if (lbl0) { var ctr = lbl0.querySelector('.obj-counter'); if (ctr) { var mx = ctr.querySelector('.obj-counter-max'); if (mx) { var mxH = mx.outerHTML; ctr.innerHTML = (dg >= 0 ? '+' : '') + dg + mxH; } } }
        shouldCheck = teamRow !== null && dg >= N;

      } else if (key.startsWith('liga-max-goles-')) {
        var N = parseInt(key.split('-').pop());
        var maxG = 0;
        (window.LIGA_J1_RESULTS || []).forEach(function(r) {
          if (r.home === teamName) maxG = Math.max(maxG, parseInt(r.gh) || 0);
          if (r.away === teamName) maxG = Math.max(maxG, parseInt(r['ga_']) || 0);
        });
        var lbl0 = cb.closest('.obj-item');
        if (lbl0) { var ctr = lbl0.querySelector('.obj-counter'); if (ctr) { var mx = ctr.querySelector('.obj-counter-max'); if (mx) { var mxH = mx.outerHTML; ctr.innerHTML = maxG + mxH; } } }
        shouldCheck = maxG >= N;

      } else if (key.startsWith('liga-wins-casa-')) {
        var N = parseInt(key.split('-').pop());
        var homeWins = 0;
        (window.LIGA_J1_RESULTS || []).forEach(function(r) {
          if (r.home === teamName && (parseInt(r.gh) || 0) > (parseInt(r['ga_']) || 0)) homeWins++;
        });
        var lbl0 = cb.closest('.obj-item');
        if (lbl0) { var ctr = lbl0.querySelector('.obj-counter'); if (ctr) { var mx = ctr.querySelector('.obj-counter-max'); if (mx) { var mxH = mx.outerHTML; ctr.innerHTML = homeWins + mxH; } } }
        shouldCheck = homeWins >= N;

      } else if (key === 'global-penalti-falta') {
        var screen = container.closest('.screen');
        if (screen) {
          var total = 0;
          screen.querySelectorAll('.ps-pen-gol, .ps-falta-gol').forEach(function(el) {
            ['liga','copa','europa','uecl','global'].forEach(function(comp) {
              total += parseInt(el.getAttribute('data-' + comp) || '0');
            });
          });
          var lbl0 = cb.closest('.obj-item');
          if (lbl0) { var ctr = lbl0.querySelector('.obj-counter'); if (ctr) { var mx = ctr.querySelector('.obj-counter-max'); if (mx) { var mxH = mx.outerHTML; ctr.innerHTML = total + mxH; } } }
          shouldCheck = total > 0;
        } else { return; }

      } else if (key.startsWith('derby-wins-')) {
        var N = parseInt(key.split('-').pop());
        var screen = container.closest('.screen');
        if (screen) {
          var wins = screen.querySelectorAll('.derby-match-row.derby-v').length;
          var lbl0 = cb.closest('.obj-item');
          if (lbl0) { var ctr = lbl0.querySelector('.obj-counter'); if (ctr) { var mx = ctr.querySelector('.obj-counter-max'); if (mx) { var mxH = mx.outerHTML; ctr.innerHTML = wins + mxH; } } }
          shouldCheck = wins >= N;
        } else { return; }

      } else if (key.startsWith('derby-imbatido-')) {
        var N = parseInt(key.split('-').pop());
        var screen = container.closest('.screen');
        if (screen) {
          var rows = Array.from(screen.querySelectorAll('.derby-match-row')).reverse();
          var consecutive = 0;
          for (var i = 0; i < rows.length; i++) {
            if (rows[i].classList.contains('derby-p')) break;
            consecutive++;
          }
          var lbl0 = cb.closest('.obj-item');
          if (lbl0) { var ctr = lbl0.querySelector('.obj-counter'); if (ctr) { var mx = ctr.querySelector('.obj-counter-max'); if (mx) { var mxH = mx.outerHTML; ctr.innerHTML = consecutive + mxH; } } }
          shouldCheck = consecutive >= N;
        } else { return; }

      } else if (key.startsWith('derby-goles-')) {
        var N = parseInt(key.split('-').pop());
        var screen = container.closest('.screen');
        if (screen) {
          var maxDG = 0;
          screen.querySelectorAll('.derby-match-row .derby-score').forEach(function(s) {
            var parts = s.textContent.trim().split('-');
            maxDG = Math.max(maxDG, parseInt(parts[0]) || 0);
          });
          var lbl0 = cb.closest('.obj-item');
          if (lbl0) { var ctr = lbl0.querySelector('.obj-counter'); if (ctr) { var mx = ctr.querySelector('.obj-counter-max'); if (mx) { var mxH = mx.outerHTML; ctr.innerHTML = maxDG + mxH; } } }
          shouldCheck = maxDG >= N;
        } else { return; }

      } else if (key === 'derby-mas-goleador' || key === 'derby-menos-goleado') {
        return; // requires cross-team comparison, leave manual
      }

      cb.checked = shouldCheck;
      var lbl = cb.closest('.obj-item');
      if (lbl) lbl.classList.toggle('done', shouldCheck);
    });

    if (typeof countFn === 'function') countFn();
  }

  // Auto-eval all 5 human teams
  window.autoEvalAllTeams = function() {
    autoEvalObjetivos('Athletic Club', 'ath-obj-club', function(){ if(typeof athObjCount==='function') athObjCount(); });
    autoEvalObjetivos('Real Betis', 'bet-obj', window.betObjCount);
    autoEvalObjetivos('Real Sociedad', 'soc-obj', window.socObjCount);
    autoEvalObjetivos('Real Madrid', 'mad-obj', window.madObjCount);
    autoEvalObjetivos('FC Barcelona', 'bar-obj', window.barObjCount);
  };

  // Hook into buildLigaClas
  if (window.buildLigaClas) {
    var _orig = window.buildLigaClas;
    window.buildLigaClas = function() {
      _orig.apply(this, arguments);
      setTimeout(window.autoEvalAllTeams, 50);
    };
  }

  // Run on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(window.autoEvalAllTeams, 500);
  });

  console.log('[eFootball] Auto-eval objetivos activado ✓');
})();



/* script block ea sports persistence fix */
(function(){
  var LS_KEY = 'ef_liga38_v4';
  var TEAM_ORDER = [
    'Arsenal','Athletic Club','Atlético Madrid','Bayern Munich','Celta de Vigo','Deportivo Alavés','Elche CF','Espanyol','FC Barcelona','Getafe CF','Girona FC','Mallorca','Osasuna','Rayo Vallecano','Real Betis','Real Madrid','Real Sociedad','Sevilla','Valencia CF','Villarreal'
  ];
  var SHORT_NAMES = {
    'Bayern Munich':'Bayern',
    'Atlético Madrid':'Atl Madrid',
    'Celta de Vigo':'Celta',
    'Deportivo Alavés':'Alavés',
    'Elche CF':'Elche',
    'Rayo Vallecano':'Rayo',
    'Valencia CF':'Valencia'
  };
  var HUMAN_TEAMS = {
    'Bayern Munich':    '💡',
    'Arsenal':          '🐭',
    'Atlético Madrid':  '✏️',
    'Real Madrid':      '🔨',
    'FC Barcelona':     '👿'
  };
  var TEAM_ALIAS = {
    'sevilla fc':'Sevilla','sevilla':'Sevilla',
    'villarreal cf':'Villarreal','villarreal':'Villarreal',
    'rc celta':'Celta de Vigo','celta':'Celta de Vigo','celta de vigo':'Celta de Vigo',
    'ca osasuna':'Osasuna','osasuna':'Osasuna',
    'mallorca':'Mallorca','rcd mallorca':'Mallorca',
    'getafe':'Getafe CF','getafe cf':'Getafe CF',
    'girona':'Girona FC','girona fc':'Girona FC',
    'elche':'Elche CF','elche cf':'Elche CF',
    'deportivo alaves':'Deportivo Alavés','deportivo alavés':'Deportivo Alavés',
    'alaves':'Deportivo Alavés','alavés':'Deportivo Alavés',
    'valencia':'Valencia CF','valencia cf':'Valencia CF',
    'rayo':'Rayo Vallecano','rayo vallecano':'Rayo Vallecano',
    'betis':'Real Betis','real betis':'Real Betis',
    'real madrid':'Real Madrid','fc barcelona':'FC Barcelona','barcelona':'FC Barcelona',
    'athletic club':'Athletic Club',
    'atletico madrid':'Atlético Madrid','atlético madrid':'Atlético Madrid',
    'arsenal':'Arsenal','arsenal fc':'Arsenal',
    'bayern munich':'Bayern Munich','fc bayern munich':'Bayern Munich','fc bayern':'Bayern Munich','bayern':'Bayern Munich',
    'sporting cp':'Sporting CP','sporting de portugal':'Sporting CP','sporting':'Sporting CP'
  };

  function normalizeText(str){
    return String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
  function canonicalTeamName(name){
    var clean = String(name || '').trim();
    var key = normalizeText(clean);
    return TEAM_ALIAS[key] || clean;
  }
  function parseSavedResults(){
    try {
      var data = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      return data && typeof data === 'object' ? data : {};
    } catch(e){
      return {};
    }
  }
  function ensureTeam(store, name){
    name = canonicalTeamName(name);
    if(!name || name === 'Por definir') return null;
    if(!store[name]){
      store[name] = {name:name, pts:0, pj:0, v:0, e:0, p:0, gf:0, gc:0, dg:0, ta:0, tr:0, mvp:0, formLog:[]};
    }
    return store[name];
  }
  function addForm(team, jornada, result){
    team.formLog.push({j:jornada, r:result});
  }
  function applyMatch(teams, jornada, homeName, awayName, gh, ga, penWinner, extra){
    var home = ensureTeam(teams, homeName), away = ensureTeam(teams, awayName);
    if(!home || !away) return;
    gh = Number(gh || 0); ga = Number(ga || 0);
    home.pj++; away.pj++;
    home.gf += gh; home.gc += ga;
    away.gf += ga; away.gc += gh;
    if(extra){
      home.ta += Number(extra.homeTA || 0);
      home.tr += Number(extra.homeTR || 0);
      away.ta += Number(extra.awayTA || 0);
      away.tr += Number(extra.awayTR || 0);
      home.mvp += Number(extra.homeMVP || 0);
      away.mvp += Number(extra.awayMVP || 0);
    }
    if(penWinner){
      if(penWinner === 'a'){
        home.v++; home.pts += 3; away.p++;
        addForm(home, jornada, 'W'); addForm(away, jornada, 'L');
      } else {
        away.v++; away.pts += 3; home.p++;
        addForm(home, jornada, 'L'); addForm(away, jornada, 'W');
      }
    } else if(gh > ga){
      home.v++; home.pts += 3; away.p++;
      addForm(home, jornada, 'W'); addForm(away, jornada, 'L');
    } else if(gh < ga){
      away.v++; away.pts += 3; home.p++;
      addForm(home, jornada, 'L'); addForm(away, jornada, 'W');
    } else {
      home.e++; away.e++; home.pts++; away.pts++;
      addForm(home, jornada, 'D'); addForm(away, jornada, 'D');
    }
  }
  function parseResultKey(key){
    var m = String(key || '').match(/^(\d+)\|([^|]+)\|(.+)$/);
    if(!m) return null;
    return {jornada: parseInt(m[1],10), home: canonicalTeamName(m[2]), away: canonicalTeamName(m[3])};
  }
  function countEventExtras(home, away, data){
    var out = {homeTA:0,homeTR:0,awayTA:0,awayTR:0,homeMVP:0,awayMVP:0};
    var evts = (data && data.events) || [];
    evts.forEach(function(ev){
      var side = ev && ev.team;
      if(side !== 'a' && side !== 'b'){
        var t = canonicalTeamName((ev && (ev.realTeam || ev.teamName || ev.team_label || ev.team)) || '');
        if(t === home) side = 'a';
        else if(t === away) side = 'b';
      }
      if(side !== 'a' && side !== 'b') return;
      var type = String((ev && ev.type) || '').trim().toLowerCase();
      var target = side === 'a' ? 'home' : 'away';
      if(type === 'amarilla') out[target+'TA'] += 1;
      else if(type === 'roja') out[target+'TR'] += 1;
      else if(type === 'd-amarilla'){ out[target+'TA'] += 1; out[target+'TR'] += 1; }
    });
    var mvpTeam = canonicalTeamName(data && data.mvpTeam || '');
    if(mvpTeam === home) out.homeMVP += 1;
    else if(mvpTeam === away) out.awayMVP += 1;
    return out;
  }
  function getSavedLigaTable(){
    var teams = {};
    TEAM_ORDER.forEach(function(name){ ensureTeam(teams, name); });
    var results = parseSavedResults();
    Object.keys(results).forEach(function(key){
      var meta = parseResultKey(key);
      var data = results[key] || {};
      if(!meta || typeof data !== 'object') return;
      if(data.gh == null || data.ga == null) return;
      var extra = countEventExtras(meta.home, meta.away, data);
      applyMatch(teams, meta.jornada, meta.home, meta.away, data.gh, data.ga, data.penWinner || null, extra);
    });
    return Object.keys(teams).map(function(name){
      var team = teams[name];
      team.dg = team.gf - team.gc;
      team.formLog.sort(function(a,b){ return a.j - b.j; });
      team.form = team.formLog.slice(-5).map(function(x){ return x.r; });
      delete team.formLog;
      return team;
    }).sort(function(a,b){
      if(b.pts !== a.pts) return b.pts - a.pts;
      if(b.dg !== a.dg) return b.dg - a.dg;
      if(b.gf !== a.gf) return b.gf - a.gf;
      return a.name.localeCompare(b.name,'es');
    });
  }
  function formHtml(form){
    var last = (form || []).slice(-5);
    if(!last.length) return '<span class="clas-dot pending" title="Sin resultados"></span>';
    return last.map(function(r){
      if(r === 'W') return '<span class="clas-dot win" title="Victoria"></span>';
      if(r === 'D') return '<span class="clas-dot draw" title="Empate"></span>';
      return '<span class="clas-dot loss" title="Derrota"></span>';
    }).join('');
  }
  function rowZoneClass(pos){
    if(pos >= 1 && pos <= 4) return 'zone-ucl';
    if(pos === 5) return 'zone-ucl-prev';
    if(pos === 6 || pos === 7) return 'zone-uel';
    if(pos === 8) return 'zone-conf';
    if(pos >= 17) return 'zone-desc';
    return '';
  }
  function renderSavedLigaClas(){
    var list = getSavedLigaTable();
    var el = document.getElementById('clas-liga-content');
    if(!el) return;
    var html = ''
      + '<div class="clas-legend">'
      +   '<span class="clas-legend-item"><span class="clas-legend-dot" style="background:#3160ff"></span>🔵 Champions</span>'
      +   '<span class="clas-legend-item"><span class="clas-legend-dot" style="background:#a855f7"></span>🟣 Previa Ch.</span>'
      +   '<span class="clas-legend-item"><span class="clas-legend-dot" style="background:#ff8214"></span>🟠 E.League</span>'
      +   '<span class="clas-legend-item"><span class="clas-legend-dot" style="background:#3cc878"></span>🟢 Conference</span>'
      +   '<span class="clas-legend-item"><span class="clas-legend-dot" style="background:#e03c3c"></span>🔴 Descenso</span>'
      + '</div>'
      + '<div class="clas-scroll-outer">'
      +   '<div class="clas-hdr-scroll" id="clas-hdr-scroll">'
      +     '<div class="clas-table">'
      +       '<div class="clas-hdr">'
      +         '<span class="clas-hdr-team">Equipo</span><span>PTS</span><span>PJ</span><span>V</span><span>E</span><span>P</span><span>GF</span><span>GC</span><span>DG</span><span>TA</span><span>TR</span><span>MVP</span><span>%</span><span>Últ. 5</span>'
      +       '</div>'
      +     '</div>'
      +   '</div>'
      +   '<div class="clas-scroll" id="clas-body-scroll">'
      +     '<div class="clas-table">';
    list.forEach(function(team, idx){
      var pos = idx + 1;
      var zone = rowZoneClass(pos);
      var dgClass = 'clas-val dg ' + (team.dg > 0 ? 'pos' : team.dg < 0 ? 'neg' : 'zer');
      html += ''
        + '<div class="clas-row ' + zone + '">'
        +   '<div class="clas-team-cell">'
        +     '<span class="clas-pos-n">' + pos + '</span>'
        +     '<span class="clas-team-name">' + (HUMAN_TEAMS[team.name] ? '<span class="human-prefix">' + HUMAN_TEAMS[team.name] + '</span>' : '') + (SHORT_NAMES[team.name] || team.name) + '</span>'
        +   '</div>'
        +   '<div class="clas-pts">' + team.pts + '</div>'
        +   '<div class="clas-pj">' + team.pj + '</div>'
        +   '<div class="clas-val">' + team.v + '</div>'
        +   '<div class="clas-val">' + team.e + '</div>'
        +   '<div class="clas-val">' + team.p + '</div>'
        +   '<div class="clas-val gf">' + team.gf + '</div>'
        +   '<div class="clas-val gc">' + team.gc + '</div>'
        +   '<div class="' + dgClass + '">' + (team.dg > 0 ? '+' : '') + team.dg + '</div>'
        +   '<div class="clas-val ta">' + team.ta + '</div>'
        +   '<div class="clas-val tr">' + team.tr + '</div>'
        +   '<div class="clas-mvp">' + team.mvp + '</div>'
        +   '<div class="clas-pct">' + (team.pj > 0 ? Math.round((team.v / team.pj) * 100) : 0) + '%</div>'
        +   '<div class="clas-form">' + formHtml(team.form) + '</div>'
        + '</div>';
    });
    html += '    </div></div></div>';
    el.innerHTML = html;
    var hdrScroll = document.getElementById('clas-hdr-scroll');
    var bodyScroll = document.getElementById('clas-body-scroll');
    if(hdrScroll && bodyScroll){
      bodyScroll.addEventListener('scroll', function(){ hdrScroll.scrollLeft = bodyScroll.scrollLeft; });
    }
    if(typeof window.autoEvalAllTeams === 'function') setTimeout(window.autoEvalAllTeams, 50);
  }

  window.buildLigaClas = renderSavedLigaClas;
  window.collectStandings = getSavedLigaTable;

  function hydrateStoreFromSavedResults(){
    var results = parseSavedResults();
    var store = window.LIGA_PLAYER_MATCH_STORE = window.LIGA_PLAYER_MATCH_STORE || {};
    Object.keys(results).forEach(function(key){
      var meta = parseResultKey(key);
      var data = results[key] || {};
      if(!meta || !data || !Array.isArray(data.events)) return;
      store[key] = {
        teamA: meta.home,
        teamB: meta.away,
        evts: data.events.map(function(ev){
          var copy = {};
          Object.keys(ev || {}).forEach(function(k){ copy[k] = ev[k]; });
          if(!copy.realTeam){
            if(copy.team === 'a') copy.realTeam = meta.home;
            else if(copy.team === 'b') copy.realTeam = meta.away;
          }
          return copy;
        }),
        mvpName: data.mvp || '',
        mvpTeam: canonicalTeamName(data.mvpTeam || '')
      };
    });
  }
  var _origRebuildFixed = window.rebuildLigaPlayerStatsFixed;
  if(typeof _origRebuildFixed === 'function'){
    window.rebuildLigaPlayerStatsFixed = function(){
      hydrateStoreFromSavedResults();
      return _origRebuildFixed.apply(this, arguments);
    };
  }
  var _origBuildIAresults = window.buildIAresults;
  if(typeof _origBuildIAresults === 'function'){
    window.buildIAresults = function(){
      var out = _origBuildIAresults.apply(this, arguments);
      if(typeof window.buildLigaClas === 'function') window.buildLigaClas();
      if(typeof window.rebuildLigaPlayerStatsFixed === 'function') setTimeout(window.rebuildLigaPlayerStatsFixed, 0);
      return out;
    };
  }
  var _origSimAll = window.simularTodasJornadasIA;
  if(typeof _origSimAll === 'function'){
    window.simularTodasJornadasIA = function(){
      var out = _origSimAll.apply(this, arguments);
      if(typeof window.buildLigaClas === 'function') window.buildLigaClas();
      if(typeof window.rebuildLigaPlayerStatsFixed === 'function') setTimeout(window.rebuildLigaPlayerStatsFixed, 0);
      if(typeof window.buildLigaStatsDashboard === 'function') setTimeout(window.buildLigaStatsDashboard, 0);
      return out;
    };
  }
  window.reiniciarLigaEA = function(){
    if(!confirm('⚠️ ¿Reiniciar Liga EA Sports?\nSe eliminarán resultados, estado de jornadas y se generará una temporada nueva (38 jornadas).')) return;
    try { localStorage.removeItem(LS_KEY); } catch(e){}

    window.LIGA_J1_RESULTS = [];
    window.LIGA_PLAYER_MATCH_STORE = {};
    if(window.LIGA_EXTRAS && typeof window.LIGA_EXTRAS === 'object'){
      Object.keys(window.LIGA_EXTRAS).forEach(function(k){ delete window.LIGA_EXTRAS[k]; });
    }

    try {
      var table = (typeof window.collectStandings === 'function' ? window.collectStandings() : []) || [];
      var teamOrder = table.map(function(t){ return t && t.name ? t.name : ''; }).filter(Boolean);
      if(!teamOrder.length) teamOrder = TEAM_ORDER.slice();
      for(var i = teamOrder.length - 1; i > 0; i--){
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = teamOrder[i]; teamOrder[i] = teamOrder[j]; teamOrder[j] = tmp;
      }
      if(typeof window.generateLigaScheduleFromTeams === 'function' && typeof window.setLigaSchedule === 'function'){
        window.setLigaSchedule(window.generateLigaScheduleFromTeams(teamOrder));
      }
    } catch(err){}

    if(typeof window.populateLigaCal === 'function') window.populateLigaCal();
    if(typeof window.populateCalendar === 'function') window.populateCalendar();
    if(typeof window.renderLigaClasCalendar === 'function') window.renderLigaClasCalendar();
    if(typeof window.buildIAresults === 'function') window.buildIAresults();
    if(typeof window.buildLigaClas === 'function') window.buildLigaClas();
    if(typeof window.buildLigaStatsDashboard === 'function') window.buildLigaStatsDashboard();
    if(typeof window.rebuildLigaPlayerStatsFixed === 'function') window.rebuildLigaPlayerStatsFixed();
  };

  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(function(){
      if(typeof window.buildLigaClas === 'function') window.buildLigaClas();
      if(typeof window.rebuildLigaPlayerStatsFixed === 'function') window.rebuildLigaPlayerStatsFixed();
    }, 100);
  });
})();


/* script block router */
(function(){
  var ROUTE_EXPLICIT = {
    's-home': '/',
    's-calendario': '/calendario',
    's-espana': '/espana',
    's-liga': '/espana/liga-ea-sports',
    's-liga-cal': '/espana/liga-ea-sports/calendario',
    's-liga-clas': '/espana/liga-ea-sports/clasificacion',
    's-liga-stats': '/espana/liga-ea-sports/estadisticas',
    's-segunda': '/espana/liga-hypermotion',
    's-segunda-clas': '/espana/liga-hypermotion/clasificacion',
    's-segunda-stats': '/espana/liga-hypermotion/estadisticas',
    's-primf': '/espana/primera-federacion',
    's-primf-clas': '/espana/primera-federacion/clasificacion',
    's-primf-stats': '/espana/primera-federacion/estadisticas',
    's-primf-mov': '/espana/primera-federacion/ascensos-y-descensos',
    's-copa': '/espana/copa-del-rey',
    's-copa-cuadro': '/espana/copa-del-rey/cuadro',
    's-supercopa': '/espana/supercopa',
    's-competiciones': '/competiciones',
    's-champions': '/competiciones/champions',
    's-ucl-previa': '/competiciones/champions/previa',
    's-ucl-grupos': '/competiciones/champions/grupos',
    's-ucl-playoffs': '/competiciones/champions/playoffs',
    's-uel': '/competiciones/europa-league',
    's-uel-previa': '/competiciones/europa-league/previa',
    's-uel-grupos': '/competiciones/europa-league/grupos',
    's-uel-playoffs': '/competiciones/europa-league/playoffs',
    's-uecl': '/competiciones/conference-league',
    's-uecl-previa': '/competiciones/conference-league/previa',
    's-uecl-grupos': '/competiciones/conference-league/grupos',
    's-uecl-playoffs': '/competiciones/conference-league/playoffs',
    's-usc': '/competiciones/supercopa-europa',
    's-intercontinental': '/competiciones/intercontinental',
    's-superliga': '/competiciones/superliga',
    's-superliga-cal': '/competiciones/superliga/calendario',
    's-superliga-clas': '/competiciones/superliga/clasificacion',
    's-superliga-stats': '/competiciones/superliga/estadisticas',
    's-selecciones': '/selecciones',
    's-sel-cal': '/selecciones/calendario',
    's-sel-clas': '/selecciones/clasificacion',
    's-sel-stats': '/selecciones/estadisticas',
    's-ligas': '/ligas'
  };
  var routerState = { initialized: false, screenToPath: {}, pathToScreen: {}, backTarget: {}, activeScreenId: null };
  var originalGo = typeof window.go === 'function' ? window.go : function(id){
    document.querySelectorAll('.screen').forEach(function(s){ s.classList.remove('active'); });
    var el = document.getElementById(id);
    if(el){ el.classList.add('active'); window.scrollTo(0,0); }
  };

  function normalizePath(path){
    var clean = String(path || '/').split('?')[0].split('#')[0];
    if(!clean) clean = '/';
    clean = clean.replace(/\/+/g, '/');
    if(clean.length > 1 && clean.endsWith('/')) clean = clean.slice(0, -1);
    return clean || '/';
  }

  function slugify(value){
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/&/g, ' y ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'seccion';
  }

  function getScreens(){
    return Array.prototype.slice.call(document.querySelectorAll('.screen[id]'));
  }

  function detectBackTarget(screenEl){
    var btn = screenEl ? screenEl.querySelector('.back-btn[onclick*="go("]') : null;
    if(!btn) return 's-home';
    var raw = btn.getAttribute('onclick') || '';
    var match = raw.match(/go\('([^']+)'\)/);
    return match ? match[1] : 's-home';
  }

  function detectLabel(screenEl, screenId){
    if(!screenEl) return screenId.replace(/^s-/, '');
    var titleEl = screenEl.querySelector('.sec-hdr h2, .sec-hdr .sc-label, h1, h2, .ml-team-name');
    if(titleEl && titleEl.textContent.trim()) return titleEl.textContent.trim();
    return screenId.replace(/^s-/, '').replace(/-/g, ' ');
  }

  function rebuildRoutes(){
    var usedPaths = {};
    routerState.screenToPath = {};
    routerState.pathToScreen = {};
    routerState.backTarget = routerState.backTarget || {};

    getScreens().forEach(function(screenEl){
      var id = screenEl.id;
      routerState.backTarget[id] = detectBackTarget(screenEl);
    });

    function uniquePath(screenId, candidate){
      var path = normalizePath(candidate);
      if(!usedPaths[path] || usedPaths[path] === screenId) return path;
      var suffix = slugify(screenId.replace(/^s-/, ''));
      var next = path === '/' ? '/' + suffix : path + '-' + suffix;
      var i = 2;
      while(usedPaths[next] && usedPaths[next] !== screenId){
        next = (path === '/' ? '/' + suffix : path + '-' + suffix) + '-' + i;
        i += 1;
      }
      return next;
    }

    function computePath(screenId, trail){
      if(routerState.screenToPath[screenId]) return routerState.screenToPath[screenId];
      if(ROUTE_EXPLICIT[screenId]){
        var explicitPath = uniquePath(screenId, ROUTE_EXPLICIT[screenId]);
        usedPaths[explicitPath] = screenId;
        routerState.screenToPath[screenId] = explicitPath;
        routerState.pathToScreen[explicitPath] = screenId;
        return explicitPath;
      }
      trail = trail || {};
      if(trail[screenId]) return '/';
      trail[screenId] = true;
      var screenEl = document.getElementById(screenId);
      var parentId = routerState.backTarget[screenId] || 's-home';
      if(parentId === screenId) parentId = 's-home';
      var base = parentId ? computePath(parentId, trail) : '/';
      var label = detectLabel(screenEl, screenId);
      var slug = slugify(label);
      var candidate = (base === '/' ? '' : base) + '/' + slug;
      var path = uniquePath(screenId, candidate);
      usedPaths[path] = screenId;
      routerState.screenToPath[screenId] = path;
      routerState.pathToScreen[path] = screenId;
      return path;
    }

    Object.keys(ROUTE_EXPLICIT).forEach(function(screenId){ computePath(screenId, {}); });
    getScreens().forEach(function(screenEl){ computePath(screenEl.id, {}); });
    routerState.initialized = true;
  }

  function resolveScreenId(path){
    rebuildRoutes();
    var normalized = normalizePath(path);
    return routerState.pathToScreen[normalized] || 's-home';
  }

  function syncHistory(screenId, replace){
    rebuildRoutes();
    var targetPath = routerState.screenToPath[screenId] || '/';
    var currentPath = normalizePath(window.location.pathname);
    var state = { screenId: screenId };
    if(replace || currentPath === targetPath){
      window.history.replaceState(state, '', targetPath);
      return;
    }
    window.history.pushState(state, '', targetPath);
  }

  function renderScreen(screenId, opts){
    opts = opts || {};
    rebuildRoutes();
    routerState.activeScreenId = screenId;
    originalGo(screenId);
    if(opts.updateHistory !== false){
      syncHistory(screenId, !!opts.replaceHistory);
    }
  }

  function navigateWithRetry(screenId, opts, retriesLeft){
    retriesLeft = typeof retriesLeft === 'number' ? retriesLeft : 8;
    if(document.getElementById(screenId)){
      renderScreen(screenId, opts);
      return;
    }
    if(retriesLeft <= 0){
      renderScreen('s-home', opts);
      return;
    }
    window.setTimeout(function(){ navigateWithRetry(screenId, opts, retriesLeft - 1); }, 80);
  }

  window.go = function(screenId, opts){
    navigateWithRetry(screenId, opts || {}, 8);
  };

  document.addEventListener('click', function(ev){
    var backBtn = ev.target.closest('.back-btn');
    if(!backBtn) return;
    var screenEl = backBtn.closest('.screen[id]');
    if(!screenEl) return;
    ev.preventDefault();
    ev.stopPropagation();
    if(typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
    rebuildRoutes();
    var parentId = routerState.backTarget[screenEl.id] || 's-home';
    window.go(parentId);
  }, true);

  window.addEventListener('popstate', function(ev){
    var screenId = (ev.state && ev.state.screenId) || resolveScreenId(window.location.pathname);
    navigateWithRetry(screenId, { updateHistory: false }, 8);
  });

  function bootRouter(){
    var initialScreenId = resolveScreenId(window.location.pathname);
    navigateWithRetry(initialScreenId, { updateHistory: true, replaceHistory: true }, 8);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bootRouter, { once: true });
  } else {
    bootRouter();
  }
})();

/* main menu calendar ownership filter (5 equipos principales) */
(function(){
  var MAIN_CAL_TEAMS = {
    'Real Madrid': true,
    'FC Barcelona': true,
    'Bayern Munich': true,
    'Arsenal': true,
    'Atlético Madrid': true
  };

  var MAIN_CAL_ALIAS = {
    'real madrid': 'Real Madrid',
    'fc barcelona': 'FC Barcelona',
    'barcelona': 'FC Barcelona',
    'barca': 'FC Barcelona',
    'bayern munich': 'Bayern Munich',
    'fc bayern munich': 'Bayern Munich',
    'bayern': 'Bayern Munich',
    'arsenal': 'Arsenal',
    'arsenal fc': 'Arsenal',
    'atletico madrid': 'Atlético Madrid',
    'atletico': 'Atlético Madrid',
    'at. madrid': 'Atlético Madrid'
  };

  function _normTeamName(name){
    var raw = String(name || '').trim();
    var key = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return MAIN_CAL_ALIAS[key] || raw;
  }

  function _isMainCalTeam(name){
    return !!MAIN_CAL_TEAMS[_normTeamName(name)];
  }

  function _paintRow(row, isMainVsMain){
    row.style.background = isMainVsMain
      ? 'linear-gradient(90deg, rgba(84,32,120,.36), rgba(126,59,168,.36))'
      : 'linear-gradient(90deg, rgba(20,120,66,.30), rgba(41,162,93,.30))';
    row.style.borderLeft = isMainVsMain
      ? '3px solid rgba(186,113,255,.85)'
      : '3px solid rgba(106,224,141,.85)';
  }

  function applyMainMenuCalendarLogic(){
    var screen = document.getElementById('s-calendario');
    if(!screen) return;

    var blocks = screen.querySelectorAll('.jmatches');
    blocks.forEach(function(block){
      var seen = {};
      var rows = block.querySelectorAll('.mrow');

      rows.forEach(function(row){
        var homeEl = row.querySelector('.mn:not(.r)');
        var awayEl = row.querySelector('.mn.r');
        if(!homeEl || !awayEl) return;

        var home = _normTeamName(homeEl.textContent);
        var away = _normTeamName(awayEl.textContent);
        var include = _isMainCalTeam(home) || _isMainCalTeam(away);

        if(!include){
          row.style.display = 'none';
          return;
        }

        var key = [home, away].sort().join('::');
        if(seen[key]){
          row.style.display = 'none';
          return;
        }
        seen[key] = true;

        row.style.display = '';
        _paintRow(row, _isMainCalTeam(home) && _isMainCalTeam(away));
      });

      var visibleRows = Array.from(block.querySelectorAll('.mrow')).filter(function(r){
        return r.style.display !== 'none';
      });
      var oldEmpty = block.querySelector('.main-cal-empty');
      if(!visibleRows.length){
        if(!oldEmpty){
          var empty = document.createElement('div');
          empty.className = 'empty-ph main-cal-empty';
          empty.textContent = 'SIN PARTIDOS DE NUESTROS EQUIPOS';
          block.appendChild(empty);
        }
      } else if(oldEmpty){
        oldEmpty.remove();
      }
    });
  }

  window.applyMainMenuCalendarLogic = applyMainMenuCalendarLogic;

  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(applyMainMenuCalendarLogic, 0);
    setTimeout(applyMainMenuCalendarLogic, 400);
  });

  var _calendarObserverTimer = null;
  function _queueMainMenuCalendarLogic(){
    if(_calendarObserverTimer) return;
    _calendarObserverTimer = window.setTimeout(function(){
      _calendarObserverTimer = null;
      applyMainMenuCalendarLogic();
    }, 120);
  }

  var _obs = new MutationObserver(function(){
    _queueMainMenuCalendarLogic();
  });

  function _attachCalendarObserver(){
    var screen = document.getElementById('s-calendario');
    if(!screen) return;
    _obs.observe(screen, {childList:true, subtree:true});
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', _attachCalendarObserver, { once:true });
  } else {
    _attachCalendarObserver();
  }
})();
