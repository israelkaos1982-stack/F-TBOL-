
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


(function(){
var _sc={a:0,b:0};var _rojas={a:0,b:0};var _events=[];var _timerSec=0;var _timerInterval=null;var _timerRunning=false;
var _htDone=false;var _etDone=false;var _et1Done=false;var _matchFinished=false;var _pendingEvt=null;
var _etPhase=false;
// ═══ REGISTRO GLOBAL DE PLANTILLAS ═══
window.TEAM_RATINGS={
  'Real Madrid':91,
  'FC Barcelona':89,
  'Atlético Madrid':87,
  'Real Sociedad':85,
  'Real Betis':84,
  'Sevilla FC':83,
  'Villarreal CF':83,
  'Athletic Club':83,
  'Girona FC':77,
  'Osasuna':77,
  'Rayo Vallecano':77,
  'Valencia CF':76,
  'Mallorca':76,
  'Getafe CF':75,
  'Celta de Vigo':76,
  'Espanyol':77,
  'Deportivo Alavés':74,
  'Elche CF':74,
  'Córdoba CF':74,
  'Albacete BP':74
};
window.SQUAD_REGISTRY={
  'Real Madrid':[
    {h:'🧤 PORTEROS'},
    ['1','T. Courtois',90],
    ['13','A. Lunin',82],
    ['26','F. González',65],
    {h:'🛡 DEFENSAS'},
    ['23','F. Mendy',84],
    ['22','A. Rüdiger',87],
    ['3','É. Militão',87],
    ['12','T. Alexander-Arnold',87],
    ['20','F. García',78],
    ['4','D. Alaba',80],
    ['17','R. Asencio',78],
    ['18','Á. Carreras',76],
    ['24','D. Huijsen',78],
    {h:'⚙️ MEDIOS'},
    ['5','J. Bellingham',91],
    ['14','A. Tchouaméni',85],
    ['8','F. Valverde',88],
    ['6','E. Camavinga',84],
    ['15','A. Güler',82],
    ['19','D. Ceballos',80],
    ['21','B. Díaz',84],
    ['7','L. Modric',82],
    {h:'⚡ DELANTEROS'},
    ['11','V. Júnior',92],
    ['9','K. Mbappé',92],
    ['10','R. Goes',86],
    ['30','F. Mastantuono',79],
  ],
  'FC Barcelona':[
    {h:'🧤 PORTEROS'},
    ['25','W. Szczęsny',84],
    ['13','J. García',80],
    ['1','I. Peña',72],
    {h:'🛡 DEFENSAS'},
    ['3','A. Balde',84],
    ['5','P. Cubarsí',83],
    ['4','R. Araújo',87],
    ['23','J. Koundé',86],
    ['2','H. Fort',74],
    ['24','É. García',78],
    ['6','G. Christensen',78],
    {h:'⚙️ MEDIOS'},
    ['8','P. Gavi',85],
    ['21','F. de Jong',86],
    ['16','F. Pedri',88],
    ['17','D. Olmo',86],
    ['14','M. Casadó',80],
    ['20','M. Bernal',79],
    ['15','A. Fermín',81],
    ['22','P. Torre',79],
    {h:'⚡ DELANTEROS'},
    ['10','A. Lewandowski',88],
    ['11','R. Ferran',86],
    ['19','L. Yamal',88],
    ['9','V. Guiu',78],
    ['7','F. López',76],
  ],
  'Atlético Madrid':[
    {h:'🧤 PORTEROS'},
    ['1','J. Oblak',90],
    ['13','A. Grbić',76],
    {h:'🛡 DEFENSAS'},
    ['2','N. Molina',82],
    ['3','J. Giménez',85],
    ['15','C. Lenglet',80],
    ['23','R. Lodi',80],
    ['20','A. Witsel',80],
    ['14','A. Azpilicueta',76],
    ['12','J. Nehuen',76],
    ['4','M. Hermoso',75],
    {h:'⚙️ MEDIOS'},
    ['5','R. De Paul',84],
    ['8','K. Koke',83],
    ['6','M. Llorente',82],
    ['11','T. Lemar',80],
    ['16','P. Barrios',81],
    ['7','S. Riquelme',80],
    ['17','A. Galán',79],
    ['22','J. Serrano',76],
    {h:'⚡ DELANTEROS'},
    ['19','Á. Morata',84],
    ['9','J. Correa',79],
    ['10','J. Griezmann',88],
    ['21','A. Sørloth',83],
    ['18','S. Memphis',80],
  ],
  'Real Sociedad':[
    {h:'🧤 PORTEROS'},
    ['1','A. Remiro',85],
    ['13','M. Zubikarai',74],
    {h:'🛡 DEFENSAS'},
    ['2','A. Gorosabel',78],
    ['5','I. Zubeldia',80],
    ['6','A. Le Normand',83],
    ['3','D. Rico',79],
    ['22','Aihen',77],
    ['14','J. Pacheco',76],
    ['16','H. Aramburu',74],
    ['15','J. Elustondo',76],
    {h:'⚙️ MEDIOS'},
    ['4','M. Merino',84],
    ['24','M. Zubimendi',87],
    ['8','T. Kubo',85],
    ['20','B. Turrientes',80],
    ['10','D. Oyarzabal',86],
    ['7','D. Silva',88],
    ['11','U. Marín',78],
    ['17','G. Aguerd',78],
    {h:'⚡ DELANTEROS'},
    ['9','A. Barrenetxea',82],
    ['19','I. Sadiq',79],
    ['21','I. Karrikaburu',78],
    ['18','M. Navarro',77],
  ],
  'Real Betis':[
    {h:'🧤 PORTEROS'},
    ['1','R. Silva',84],
    ['13','F. Pacheco',80],
    {h:'🛡 DEFENSAS'},
    ['2','E. Sabaly',80],
    ['5','M. Bartra',79],
    ['6','G. Pezzella',79],
    ['3','A. Cornejo',77],
    ['23','R. Perraud',78],
    ['15','Pablo Fornals',77],
    ['22','C. Akouokou',76],
    ['14','A. Ruibal',76],
    {h:'⚙️ MEDIOS'},
    ['4','W. Carvalho',84],
    ['8','G. Rodríguez',82],
    ['10','Isco',86],
    ['20','J. Roca',81],
    ['7','A. Fekir',84],
    ['17','M. Hermoso',78],
    ['11','R. Iglesias',79],
    ['16','J. Miranda',78],
    {h:'⚡ DELANTEROS'},
    ['9','B. Iglesias',84],
    ['19','A. Ayoze',82],
    ['21','J. Abner',79],
    ['18','M. Bakambu',80],
  ],
  'Sevilla FC':[
    {h:'🧤 PORTEROS'},
    ['1','Y. Bounou',86],
    ['13','M. Dmitrović',80],
    {h:'🛡 DEFENSAS'},
    ['2','J. Navas',79],
    ['4','L. Badé',82],
    ['5','M. Gudelj',80],
    ['3','A. Acuña',80],
    ['23','M. Carmona',78],
    ['15','M. Nianzou',80],
    ['22','L. Juanlu',78],
    ['6','G. Rekik',75],
    {h:'⚙️ MEDIOS'},
    ['8','I. Rakitić',83],
    ['17','J. Navas',78],
    ['10','E. Ocampos',83],
    ['20','D. Sow',79],
    ['7','L. Agoumé',78],
    ['16','A. González',79],
    ['11','J. Jordán',81],
    ['14','R. Gil',78],
    {h:'⚡ DELANTEROS'},
    ['9','Y. En-Nesyri',84],
    ['19','I. Romero',81],
    ['21','A. Sánchez',80],
    ['18','A. Adams',78],
  ],
  'Villarreal CF':[
    {h:'🧤 PORTEROS'},
    ['1','G. Rulli',84],
    ['13','F. Maresca',76],
    {h:'🛡 DEFENSAS'},
    ['2','J. Foyth',82],
    ['5','P. Torres',85],
    ['6','R. Albiol',82],
    ['3','A. Pedraza',81],
    ['23','C. Pino',79],
    ['15','E. Bailly',79],
    ['22','A. Moreno',80],
    ['14','J. Cuenca',77],
    {h:'⚙️ MEDIOS'},
    ['4','E. Lo Celso',84],
    ['8','D. Parejo',85],
    ['10','S. Baena',82],
    ['20','A. Capoue',80],
    ['7','N. Jackson',81],
    ['17','G. Moreno',84],
    ['11','S. Chukwueze',82],
    ['16','Y. Brereton',78],
    {h:'⚡ DELANTEROS'},
    ['9','G. Moreno',83],
    ['19','G. Pedrosa',80],
    ['21','J. Danjuma',81],
    ['18','C. Pino',80],
  ],
  'Athletic Club':[
    {h:'🧤 PORTEROS'},
    ['1','U. Simón',87],
    ['13','J. Agirrezabala',79],
    {h:'🛡 DEFENSAS'},
    ['2','A. De Marcos',80],
    ['5','D. Vivian',81],
    ['6','A. Yeray',82],
    ['3','Y. Berchiche',80],
    ['22','J. Lekue',78],
    ['15','O. Sancet',81],
    ['23','K. García',78],
    ['14','I. Ruiz de Galarreta',79],
    {h:'⚙️ MEDIOS'},
    ['4','M. Vesga',82],
    ['8','U. Nico Williams',88],
    ['10','O. Sancet',84],
    ['20','A. Vencedor',81],
    ['7','I. Williams',86],
    ['17','A. Berenguer',80],
    ['11','J. Muniain',82],
    ['16','J. Djaló',79],
    {h:'⚡ DELANTEROS'},
    ['9','G. Uriarte',81],
    ['19','O. Sancet',82],
    ['21','R. Morcillo',78],
    ['18','A. Villalibre',80],
  ],
  'Girona FC':[
    {h:'🧤 PORTEROS'},
    ['1','P. Gazzaniga',78],
    ['13','R. Blanco',73],
    {h:'🛡 DEFENSAS'},
    ['2','A. Martínez',78],
    ['5','D. Blind',76],
    ['6','V. Reis',75],
    ['3','A. Moreno',77],
    ['22','Francés',75],
    ['14','H. Rincón',73],
    ['23','D. López',76],
    {h:'⚙️ MEDIOS'},
    ['4','F. Beltrán',77],
    ['8','I. Martín',77],
    ['10','T. Lemar',77],
    ['20','J. Roca',72],
    ['7','B. Gil',77],
    ['17','V. Tsygankov',78],
    ['11','C. Echeverri',73],
    ['16','A. Witsel',76],
    {h:'⚡ DELANTEROS'},
    ['9','V. Vanat',77],
    ['19','C. Stuani',76],
    ['21','A. Ruiz',72],
    ['18','D. van de Beek',75],
    ['15','Portu',75],
  ],
  'Osasuna':[
    {h:'🧤 PORTEROS'},
    ['1','S. Herrera',79],
    ['13','A. Fernández',77],
    {h:'🛡 DEFENSAS'},
    ['2','V. Rosier',77],
    ['5','Catena',78],
    ['6','F. Boyomo',78],
    ['3','J. Galán',77],
    ['22','K. Baria',73],
    ['14','A. Bretones',75],
    ['23','Herrando',75],
    {h:'⚙️ MEDIOS'},
    ['4','L. Torró',78],
    ['8','Moncayola',78],
    ['10','A. Oroz',78],
    ['20','M. Gómez',77],
    ['7','V. Muñoz',76],
    ['17','R. García',78],
    ['11','R. Moro',75],
    ['16','I. Muñoz',71],
    {h:'⚡ DELANTEROS'},
    ['9','A. Budimir',81],
    ['19','R. García',73],
    ['21','Osambela',65],
  ],
  'Celta de Vigo':[
    {h:'🧤 PORTEROS'},
    ['1','I. A. Radu',78],
    ['13','I. Villar',72],
    {h:'🛡 DEFENSAS'},
    ['2','M. Alonso',79],
    ['5','C. Starfelt',78],
    ['6','J. Rodríguez',76],
    ['3','Carreira',75],
    ['22','Á. Núñez',76],
    ['14','J. Rueda',73],
    ['23','M. Fernández',70],
    {h:'⚙️ MEDIOS'},
    ['4','Mingueza',80],
    ['8','I. Moriba',76],
    ['10','M. Román',72],
    ['20','H. Álvarez',75],
    ['7','H. Sotelo',74],
    ['17','F. Cervi',70],
    ['11','M. Vecino',72],
    {h:'⚡ DELANTEROS'},
    ['9','B. Iglesias',80],
    ['19','W. Swedberg',75],
    ['21','F. López',73],
    ['18','I. Aspas',82],
    ['15','P. Durán',74],
    ['16','F. Jutglà',72],
  ],
  'Deportivo Alavés':[
    {h:'🧤 PORTEROS'},
    ['1','Sivera',77],
    ['13','R. Fernández',72],
    {h:'🛡 DEFENSAS'},
    ['2','N. Tenaglia',77],
    ['5','Pacheco',74],
    ['6','F. Garcés',72],
    ['3','Jonny',75],
    ['22','V. Parada',70],
    ['14','A. Rebbach',72],
    ['23','Yusi',68],
    {h:'⚙️ MEDIOS'},
    ['4','P. Ibáñez',73],
    ['8','A. Blanco',75],
    ['10','Aleñá',74],
    ['20','D. Suárez',74],
    ['7','A. Guevara',74],
    ['17','Guridi',74],
    ['11','Calebe',71],
    {h:'⚡ DELANTEROS'},
    ['9','L. Boyé',74],
    ['19','T. Martínez',75],
    ['21','I. Diabate',72],
    ['18','Mariano',70],
    ['15','G. Swiderski',72],
  ],
  'Mallorca':[
    {h:'🧤 PORTEROS'},
    ['1','L. Román',77],
    ['13','Á. Prats',72],
    ['20','L. Bergström',67],
    {h:'🛡 DEFENSAS'},
    ['3','J. Mojica',78],
    ['4','Raillo',80],
    ['5','M. Valjent',77],
    ['22','Maffeo',78],
    ['19','M. Morev',73],
    ['16','T. Lato',73],
    ['2','M. Kumbulla',77],
    ['25','I. Salhi',60],
    {h:'⚙️ MEDIOS'},
    ['8','O. Mascarell',75],
    ['6','S. Costa',78],
    ['11','J. Virgilí',75],
    ['10','S. Darder',80],
    ['21','M. Joseph',72],
    ['7','M. Morlanes',77],
    ['14','T. Asano',74],
    ['17','P. Torre',74],
    ['23','A. Sánchez',73],
    {h:'⚡ DELANTEROS'},
    ['9','V. Muriqi',80],
    ['13','Á. Prats',72],
    ['18','A. Sánchez',73],
  ],
  'Elche CF':[
    {h:'🧤 PORTEROS'},
    ['1','I. Peña',77],
    ['12','M. Dituro',75],
    ['31','Iturbe',66],
    {h:'🛡 DEFENSAS'},
    ['5','Bigas',76],
    ['4','D. Affengruber',76],
    ['3','V. Chust',73],
    ['2','A. Pedrosa',75],
    ['22','L. Pétrot',70],
    ['20','J. Donald',69],
    ['27','Albert',58],
    ['29','B. Sangaré',63],
    ['32','H. Fort',71],
    {h:'⚙️ MEDIOS'},
    ['6','M. Aguado',73],
    ['11','Valera',75],
    ['8','A. Febas',78],
    ['10','M. Neto',72],
    ['21','Josan',72],
    ['13','R. Mir',75],
    ['17','L. Ceneda',72],
    ['14','G. Villar',72],
    ['15','Y. Santiago',70],
    ['19','G. Diangana',70],
    {h:'⚡ DELANTEROS'},
    ['9','A. Rodríguez',71],
    ['7','A. da Silva',76],
    ['24','F. Redondo',70],
    ['28','T. Morente',71],
  ],
  'Valencia CF':[
    {h:'🧤 PORTEROS'},
    ['1','S. Dimitrievski',77],
    ['31','Agirrezabala',77],
    ['2','C. Rivero',65],
    {h:'🛡 DEFENSAS'},
    ['12','Gayà',78],
    ['5','Copete',74],
    ['6','C. Tárrega',75],
    ['23','T. Correia',75],
    ['3','J. Vázquez',71],
    ['4','U. Núñez',75],
    ['22','E. Cömert',72],
    ['29','D. Foulquier',73],
    ['32','M. Diakhaby',76],
    {h:'⚙️ MEDIOS'},
    ['8','Pepelu',76],
    ['14','F. Ugrinič',74],
    ['11','D. López',77],
    ['10','L. Beltrán',75],
    ['7','L. Rioja',77],
    ['20','J. Guerra',77],
    ['15','G. Rodríguez',75],
    ['16','A. Daniuma',75],
    ['17','B. Santamaría',75],
    ['18','A. Almeida',74],
    ['24','D. Raba',75],
    ['25','L. Ramazani',74],
    {h:'⚡ DELANTEROS'},
    ['9','H. Duro',77],
    ['13','U. Sadio',76],
    ['26','A. Blázquez',62],
    ['30','D. Otorbi',63],
  ],
  'Rayo Vallecano':[
    {h:'🧤 PORTEROS'},
    ['1','A. Batalla',79],
    ['13','D. Cárdenas',73],
    ['32','A. Molina',54],
    {h:'🛡 DEFENSAS'},
    ['12','P. Chavarría',78],
    ['5','N. Mendy',73],
    ['4','F. Lejeune',78],
    ['23','A. Ratiu',79],
    ['3','I. Balliu',75],
    ['2','L. Feline',75],
    ['17','P. Espino',72],
    ['33','A. Mumín',77],
    {h:'⚙️ MEDIOS'},
    ['6','U. López',76],
    ['8','P. Ciss',78],
    ['11','Á. García',81],
    ['10','Isi',81],
    ['7','I. Akhomach',74],
    ['15','Ó. Valentín',77],
    ['16','Gumbau',72],
    ['18','P. Díaz',75],
    ['25','S. Camello',72],
    {h:'⚡ DELANTEROS'},
    ['9','D. Frutos',80],
    ['14','Alemão',73],
    ['24','R. Nteka',70],
    ['26','F. Pérez',71],
  ],
  'Getafe CF':[
    {h:'🧤 PORTEROS'},
    ['13','D. Soria',86],
    ['1','J. Letáček',69],
    ['34','J. Benito',58],
    {h:'🛡 DEFENSAS'},
    ['16','D. Rico',77],
    ['5','Z. Romero',72],
    ['4','D. Duarte',74],
    ['22','D. Djené',77],
    ['17','K. Femenía',74],
    ['3','A. Abqar',74],
    ['21','J. Iglesias',74],
    ['36','Davinchi',67],
    {h:'⚙️ MEDIOS'},
    ['8','M. Arambarri',80],
    ['5','L. Milla',81],
    ['7','M. Martín',72],
    ['10','J. Muñoz',74],
    ['18','Á. Sancris',73],
    ['19','V. Birmančević',77],
    ['29','A. Kamara',68],
    ['31','A. Risco',62],
    {h:'⚡ DELANTEROS'},
    ['9','M. Satriano',74],
    ['20','L. Vázquez',70],
    ['37','B. Mayoral',77],
    ['14','A. Liso',72],
  ],
  'Espanyol':[
    {h:'🧤 PORTEROS'},
    ['1','J. Lecomte',79],
    ['13','D. Fortuño',72],
    {h:'🛡 DEFENSAS'},
    ['2','E. Óscar',78],
    ['5','L. Cabrera',80],
    ['6','J. Calero',79],
    ['3','N. Ontiveros',78],
    ['22','B. Alarcón',76],
    ['14','B. Cornet',77],
    ['23','R. Oliván',75],
    ['15','A. Javi López',74],
    {h:'⚙️ MEDIOS'},
    ['4','O. Granell',78],
    ['8','A. Darder',81],
    ['10','J. Puado',79],
    ['20','E. Expósito',79],
    ['7','L. De la Torre',78],
    ['17','J. Pol Lozano',77],
    ['11','C. Braithwaite',77],
    ['16','P. Milla',77],
    {h:'⚡ DELANTEROS'},
    ['9','R. Fernández',81],
    ['19','M. Myrto Uzuni',79],
    ['21','B. Alarcón',76],
    ['18','Salinas',74],
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
  'Albacete BP':[
    {h:'🧤 PORTEROS'},
    ['1','D. Mariño',76],
    ['13','R. Lizoain',70],
    {h:'🛡 DEFENSAS'},
    ['2','J. G. González',75],
    ['5','P. Sánchez',74],
    ['6','Vallejo',74],
    ['3','F. Gámez',73],
    ['22','J. Roca',73],
    ['14','J. Delmás',72],
    ['23','Á. Vega',71],
    {h:'⚙️ MEDIOS'},
    ['4','M. Tejero',75],
    ['8','A. Prieto',74],
    ['10','A. Djetei',75],
    ['20','C. Romero',74],
    ['7','G. Valles',73],
    ['17','J. Álvaro',73],
    ['11','B. Ruiz',72],
    ['16','R. Expósito',72],
    {h:'⚡ DELANTEROS'},
    ['9','R. Pina',76],
    ['19','J. Santos',74],
    ['21','G. Sintes',73],
    ['18','N. Kone',72],
  ]
}

window.sqFromRegistry = function(teamName) {
  var reg = window.SQUAD_REGISTRY[teamName];
  if (!reg) return null;
  var posMap = {'🧤 PORTEROS':'P','🛡 DEFENSAS':'D','⚙️ MEDIOS':'M','⚡ DELANTEROS':'F',
                '⚙️CENTROCAMPISTAS':'M','⚙️ CENTROCAMPISTAS':'M'};
  var result = []; var curPos = 'M';
  for (var i = 0; i < reg.length; i++) {
    var e = reg[i];
    if (e.h) { curPos = posMap[e.h] || 'M'; }
    else {
      // e[2] puede ser peso explícito si está definido, sino usar posición en array
      var w = (e.length >= 3) ? e[2] : undefined;
      result.push([e[0], e[1], curPos, w]);
    }
  }
  // Si no hay pesos explícitos, asignar por posición en array (primero=titular)
  var hasExplicit = result.some(function(p){ return p[3] !== undefined; });
  if (!hasExplicit) {
    var gkSeen = 0, outfieldSeen = 0;
    for (var j = 0; j < result.length; j++) {
      if (result[j][2] === 'P') { result[j][3] = (gkSeen++ === 0) ? 70 : 8; }
      else { result[j][3] = (outfieldSeen++ < 10) ? 90 : 12; }
    }
  }
  return result;
};
// ════════════════════════════════════
var TEAM_A_NAME="Real Madrid";var TEAM_B_NAME="FC Barcelona";
var TEAM_A_OPTS='<option value="1|Thibaut Courtois">1. Thibaut Courtois</option><option value="13|Andriy Lunin">13. Andriy Lunin</option><option value="2|Daniel Carvajal">2. Daniel Carvajal</option><option value="3|Éder Militão">3. Éder Militão</option><option value="4|David Alaba">4. David Alaba</option><option value="5|Jude Bellingham">5. Jude Bellingham</option><option value="6|Eduardo Camavinga">6. Eduardo Camavinga</option><option value="7|Vinicius Júnior">7. Vinicius Júnior</option><option value="8|Federico Valverde">8. Federico Valverde</option><option value="9|Kylian Mbappé">9. Kylian Mbappé</option><option value="11|Rodrygo">11. Rodrygo</option><option value="12|Trent Alexander-Arnold">12. Trent Alexander-Arnold</option><option value="14|Aurélien Tchouaméni">14. Aurélien Tchouaméni</option><option value="15|Arda Güler">15. Arda Güler</option><option value="17|Raúl Asencio">17. Raúl Asencio</option><option value="18|Álvaro Carreras">18. Álvaro Carreras</option><option value="19|Dani Ceballos">19. Dani Ceballos</option><option value="20|Fran García">20. Fran García</option><option value="21|Brahim Díaz">21. Brahim Díaz</option><option value="22|Antonio Rüdiger">22. Antonio Rüdiger</option><option value="23|Ferland Mendy">23. Ferland Mendy</option><option value="24|Dean Huijsen">24. Dean Huijsen</option><option value="30|Franco Mastantuono">30. Franco Mastantuono</option>';var TEAM_B_OPTS='<option value="13|Joan García">13. Joan García</option><option value="25|Wojciech Szczęsny">25. Wojciech Szczęsny</option><option value="2|João Cancelo">2. João Cancelo</option><option value="3|Alejandro Balde">3. Alejandro Balde</option><option value="4|Ronald Araújo">4. Ronald Araújo</option><option value="5|Pau Cubarsí">5. Pau Cubarsí</option><option value="6|Pablo Gavi">6. Pablo Gavi</option><option value="7|Ferran Torres">7. Ferran Torres</option><option value="8|Pedri">8. Pedri</option><option value="9|Robert Lewandowski">9. Robert Lewandowski</option><option value="10|Lamine Yamal">10. Lamine Yamal</option><option value="11|Raphinha">11. Raphinha</option><option value="14|Marcus Rashford">14. Marcus Rashford</option><option value="15|Andreas Christensen">15. Andreas Christensen</option><option value="16|Fermín López">16. Fermín López</option><option value="17|Marc Casadó">17. Marc Casadó</option><option value="18|Gerard Martín">18. Gerard Martín</option><option value="20|Dani Olmo">20. Dani Olmo</option><option value="21|Frenkie de Jong">21. Frenkie de Jong</option><option value="23|Jules Koundé">23. Jules Koundé</option><option value="24|Eric García">24. Eric García</option><option value="28|Roony Bardghji">28. Roony Bardghji</option>';
var MAX_NORMAL=5400;var MAX_ET=7200;
var NORMAL_SPEED=1000;var ET_SPEED=233;
window.mlTimerClick_j1m1=function(){if(_matchFinished)return;if(_timerRunning){clearInterval(_timerInterval);_timerRunning=false;_renderTimer_j1m1();}else{_timerRunning=true;_startInterval_j1m1();}};
function _startInterval_j1m1(){var spd=_etPhase?ET_SPEED:NORMAL_SPEED;_timerInterval=setInterval(function(){_timerSec+=5;var maxSec=_etDone?MAX_ET:MAX_NORMAL;if(!_htDone&&_timerSec>=2700){_htDone=true;_addMarker_j1m1("— DESCANSO (45 min) —");}if(_etDone&&!_et1Done&&_timerSec>=6300){_et1Done=true;_addMarker_j1m1("— DESCANSO PRÓRROGA (105 min) —");}if(_timerSec>=maxSec){_timerSec=maxSec;clearInterval(_timerInterval);_timerRunning=false;if(_etDone){_checkPenalties_j1m1();}} _renderTimer_j1m1();},spd);};
function _renderTimer_j1m1(){var btn=document.getElementById('ml-timer-j1m1');if(!btn)return;var totalMin=Math.floor(_timerSec/60);if(_matchFinished){btn.textContent='🏁 FIN';btn.className='ml-timer finished';return;}var label=_timerRunning?'⏸ ':(_timerSec>=(_etDone?MAX_ET:MAX_NORMAL)?'🔁 ':'▶ ');btn.textContent=label+totalMin+"'";btn.className='ml-timer'+(_timerRunning?' running':'');};
function _currentMin_j1m1(){return Math.min(_etDone?120:90,Math.floor(_timerSec/60));};
function _addMarker_j1m1(txt){var list=document.getElementById('ml-acta-list-j1m1');var div=document.createElement('div');div.className='ml-ht';div.textContent=txt;list.appendChild(div);_removeEmpty_j1m1();};
window.mlActivateET_j1m1=function(){if(_etDone||_matchFinished)return;_etDone=true;_etPhase=true;if(_timerRunning){clearInterval(_timerInterval);_startInterval_j1m1();}if(_timerSec<MAX_NORMAL)_timerSec=MAX_NORMAL;_addMarker_j1m1('— PRÓRROGA —');var btn=document.getElementById('ml-btn-et-j1m1');if(btn){btn.disabled=true;btn.style.opacity='0.35';}var penBtn=document.getElementById('ml-btn-pen-j1m1');if(penBtn)penBtn.style.display='';_renderTimer_j1m1();};
window.mlShowPenPanel_j1m1=function(){var pp=document.getElementById('ml-pen-panel-j1m1');if(pp)pp.classList.add('show');var penBtn=document.getElementById('ml-btn-pen-j1m1');if(penBtn){penBtn.disabled=true;penBtn.style.opacity='0.35';}var addBtn=document.getElementById('ml-add-btn-j1m1');if(addBtn){addBtn.disabled=true;addBtn.style.opacity='0.35';}};
window.mlEndMatch_j1m1=function(winner){if(_matchFinished)return;if(!winner&&_sc.a===_sc.b){alert("⚠️ El partido está empatado. Debes ir a PRÓRROGA y luego a PENALTIS.");return;}
  // ── MVP obligatorio ──
  var hasMvp=_events.some(function(e){return e.type==='mvp';});
  if(!hasMvp){
    var sqA_=window.SQUAD_REGISTRY['Real Madrid']||_sqA_j1m1;
    var sqB_=window.SQUAD_REGISTRY['FC Barcelona']||_sqB_j1m1;
    window.showMvpForce('j1m1','Real Madrid','FC Barcelona',sqA_,sqB_,_sc.a,_sc.b,function(team,num,name){
      var icons={gol:'⚽',propia:'🚫','pen-gol':'🥅','pen-fallo':'❌','pen-prov':'🤦','pen-parado':'🖐','falta-gol':'🎯',amarilla:'🟨','d-amarilla':'🟨🟥',roja:'🟥',mvp:'⭐'};
      _events.push({min:90,label:'MVP del Partido',type:'mvp',team:team,num:num,name:name,ico:'⭐',id:Date.now()});
      _renderActa_j1m1();
      window.mlEndMatch_j1m1(winner);
    });
    return;
  }
clearInterval(_timerInterval);_timerRunning=false;_matchFinished=true;var penWinner=null;if(winner==='a'||winner==='b'){if(_sc.a===_sc.b)penWinner=winner;}if(!winner){if(_sc.a>_sc.b)winner='a';else if(_sc.b>_sc.a)winner='b';else winner='draw';}var btn=document.getElementById('ml-btn-end-j1m1');if(btn){btn.disabled=true;btn.style.opacity='0.35';}var etBtn=document.getElementById('ml-btn-et-j1m1');if(etBtn){etBtn.disabled=true;etBtn.style.opacity='0.35';}var penBtn=document.getElementById('ml-btn-pen-j1m1');if(penBtn){penBtn.disabled=true;penBtn.style.opacity='0.35';}var _ta_a=_events.filter(function(e){return e.team==='a'&&(e.type==='amarilla'||e.type==='d-amarilla');}).length;var _tr_a=_events.filter(function(e){return e.team==='a'&&(e.type==='roja'||e.type==='d-amarilla');}).length;var _ta_b=_events.filter(function(e){return e.team==='b'&&(e.type==='amarilla'||e.type==='d-amarilla');}).length;var _tr_b=_events.filter(function(e){return e.team==='b'&&(e.type==='roja'||e.type==='d-amarilla');}).length;var _mvp_a=_events.filter(function(e){return e.team==='a'&&e.type==='mvp';}).length;var _mvp_b=_events.filter(function(e){return e.team==='b'&&e.type==='mvp';}).length;if(typeof window.registrarResultadoLiga==='function')window.registrarResultadoLiga('j1m1',TEAM_A_NAME,TEAM_B_NAME,_sc.a,_sc.b,_ta_a,_tr_a,_ta_b,_tr_b,_mvp_a,_mvp_b,penWinner); if(typeof window.registrarLigaPlayerStats==='function')window.registrarLigaPlayerStats('j1m1',TEAM_A_NAME,TEAM_B_NAME,_events.map(function(ev){return {type:(ev.type==='amarilla'||ev.type==='roja'||ev.type==='d-amarilla')?'card':ev.type,ico:ev.ico,team:ev.team,player:[ev.num,ev.name]};}),(_events.find(function(e){return e.type==='mvp';})||{}).name||'',(_events.find(function(e){return e.type==='mvp';})||{}).team==='a'?TEAM_A_NAME:((_events.find(function(e){return e.type==='mvp';})||{}).team==='b'?TEAM_B_NAME:'')); _renderTimer_j1m1();};
function _checkPenalties_j1m1(){if(_sc.a===_sc.b){_addMarker_j1m1("— EMPATE AL 120' —");var pp=document.getElementById("ml-pen-panel-j1m1");if(pp)pp.classList.add("show");var addBtn=document.getElementById("ml-add-btn-j1m1");if(addBtn){addBtn.disabled=true;addBtn.style.opacity="0.35";}}else{mlEndMatch_j1m1();}};window.mlConfirmPen_j1m1=function(){var pa=parseInt(document.getElementById("ml-pen-a-j1m1").value)||0;var pb=parseInt(document.getElementById("ml-pen-b-j1m1").value)||0;if(pa===pb){alert("⚠️ Los penaltis no pueden terminar en empate. Introduce un resultado válido.");return;}var penWinner=pa>pb?"a":"b";var psEl=document.getElementById("pen-score-j1m1");if(psEl){psEl.textContent=pa+"–"+pb;psEl.classList.add("show");}var pp=document.getElementById("ml-pen-panel-j1m1");if(pp)pp.classList.remove("show");mlEndMatch_j1m1(penWinner);};
window.mlShowEvOv_j1m1=function(){document.getElementById("ml-ev-overlay-j1m1").classList.add("show");};window.mlHideEvOv_j1m1=function(){document.getElementById("ml-ev-overlay-j1m1").classList.remove("show");};window.mlEvPick_j1m1=function(label,type){document.getElementById("ml-ev-overlay-j1m1").classList.remove("show");mlShowTP_j1m1(label,type);};window.mlShowTP_j1m1=function(label,type){_pendingEvt={label:label,type:type};document.getElementById("ml-tp-ov-evt-j1m1").textContent=label;document.getElementById("ml-tp-overlay-j1m1").classList.add("show");};window.mlHideTP_j1m1=function(){document.getElementById("ml-tp-overlay-j1m1").classList.remove("show");_pendingEvt=null;};window.mlTPSelect_j1m1=function(team){document.getElementById("ml-tp-overlay-j1m1").classList.remove("show");mlDirectPick_j1m1(_pendingEvt.label,_pendingEvt.type,team);};window.mlTogglePanel_j1m1=function(){mlShowEvOv_j1m1();};
var _sqA_j1m1=[{'h':'🧤 PORTEROS'},['1','Thibaut Courtois'],['13','Andriy Lunin'],{'h':'🛡 DEFENSAS'},['23','Ferland Mendy'],['22','Antonio Rüdiger'],['3','Éder Militão'],['12','Trent Alexander-Arnold'],['20','Fran García'],['4','David Alaba'],['17','Raúl Asencio'],['18','Álvaro Carreras'],['24','Dean Huijsen'],{'h':'⚙️ MEDIOS'},['5','Jude Bellingham'],['14','Aurélien Tchouaméni'],['8','Federico Valverde'],['6','Eduardo Camavinga'],['15','Arda Güler'],['19','Dani Ceballos'],['21','Brahim Díaz'],{'h':'⚡ DELANTEROS'},['7','Vinicius Júnior'],['9','Kylian Mbappé'],['11','Rodrygo'],['30','Franco Mastantuono']];var _sqB_j1m1=[{'h':'🧤 PORTEROS'},['25','Wojciech Szczęsny'],['13','Joan García'],{'h':'🛡 DEFENSAS'},['3','Alejandro Balde'],['5','Pau Cubarsí'],['4','Ronald Araújo'],['23','Jules Koundé'],['2','João Cancelo'],['15','Andreas Christensen'],['24','Eric García'],['18','Gerard Martín'],{'h':'⚙️ MEDIOS'},['8','Pedri'],['17','Marc Casadó'],['6','Pablo Gavi'],['21','Frenkie de Jong'],['20','Dani Olmo'],['16','Fermín López'],['22','Marc Bernal'],{'h':'⚡ DELANTEROS'},['10','Lamine Yamal'],['9','Robert Lewandowski'],['11','Raphinha'],['7','Ferran Torres'],['14','Marcus Rashford'],['28','Roony Bardghji']];window.mlShowPl_j1m1=function(){var ov=document.getElementById("ml-pl-overlay-j1m1");var e=_pendingEvt;var sq=(e.team==="a")?(window.SQUAD_REGISTRY[TEAM_A_NAME]||_sqA_j1m1):(window.SQUAD_REGISTRY[TEAM_B_NAME]||_sqB_j1m1);var tname=(e.team==="a")?TEAM_A_NAME:TEAM_B_NAME;document.getElementById("ml-pl-ov-evt-j1m1").textContent=e.label;document.getElementById("ml-pl-ov-team-j1m1").textContent=tname;var list=document.getElementById("ml-pl-ov-list-j1m1");list.innerHTML=sq.map(function(p){if(p.h)return '<div class="ml-pl-ov-sec">'+p.h+'</div>';return '<button class="ml-pl-ov-btn" onclick="mlPlConfirm_j1m1(\''+p[0]+'\',\''+p[1].replace(/\'/g,"\\'")+ '\')">'+'<span class="ml-pl-ov-num">'+p[0]+'</span>'+'<span class="ml-pl-ov-name">'+p[1]+'</span>'+'</button>';}).join("");ov.classList.add("show");};window.mlHidePl_j1m1=function(){document.getElementById("ml-pl-overlay-j1m1").classList.remove("show");};window.mlPlConfirm_j1m1=function(num,name){document.getElementById("ml-pl-overlay-j1m1").classList.remove("show");if(!_pendingEvt)return;var e=_pendingEvt;var min=_currentMin_j1m1();if(e.type==="d-amarilla"){var hasYellow=_events.some(function(ev){return ev.type==="amarilla"&&ev.team===e.team&&ev.num===num;});if(!hasYellow){alert("⚠️ "+name+" no tiene amarilla previa. No se puede mostrar doble amarilla.");_pendingEvt=null;return;}}var scoringTypes=["gol","propia","pen-gol","falta-gol"];if(scoringTypes.indexOf(e.type)!==-1){var st=(e.type==="propia")?(e.team==="a"?"b":"a"):e.team;_sc[st]++;document.getElementById("sc-j1m1-a").textContent=_sc.a;document.getElementById("sc-j1m1-b").textContent=_sc.b;}if((e.type==="d-amarilla"||e.type==="roja")&&(e.type!=="roja"||_events.filter(function(ev){return(ev.type==="roja"||ev.type==="d-amarilla")&&ev.team===e.team;}).length===0)){_rojas=_rojas||{};_rojas[e.team]=(_rojas[e.team]||0)+1;}var icons={gol:"⚽",propia:"🚫","pen-gol":"🥅","pen-fallo":"❌","pen-prov":"🤦","pen-parado":"🖐","falta-gol":"🎯",amarilla:"🟨","d-amarilla":"🟨🟥",roja:"🟥",mvp:"⭐"};_events.push({min:min,label:e.label,type:e.type,team:e.team,num:num,name:name,ico:icons[e.type]||"•",id:Date.now()});_renderActa_j1m1();_pendingEvt=null;};window.mlDirectPick_j1m1=function(label,type,team){_pendingEvt={label:label,type:type,team:team};mlShowPl_j1m1();};
window.mlCloseModal_j1m1=function(){document.getElementById('ml-modal-j1m1').classList.remove('show');_pendingEvt=null;};
var _evtToStat={gol:'gol',amarilla:'yel','d-amarilla':'yel',roja:'red',mvp:'mvp','pen-prov':'pen-prov','pen-parado':'pen-parado','pen-gol':'pen-gol','falta-gol':'falta-gol',propia:'propia'};
function _removeEmpty_j1m1(){var emp=document.querySelector('#ml-acta-list-j1m1 .ml-acta-empty');if(emp)emp.remove();};
window.mlConfirmEvt_j1m1=function(){if(!_pendingEvt)return;var sel=document.getElementById('ml-modal-sel-j1m1');var parts=sel.value.split('|');var num=parts[0],name=parts[1];var e=_pendingEvt;var min=_currentMin_j1m1();var scoringTypes=['gol','propia','pen-gol','falta-gol'];if(scoringTypes.indexOf(e.type)!==-1){var st=(e.type==='propia')?(e.team==='a'?'b':'a'):e.team;_sc[st]++;document.getElementById('sc-j1m1-a').textContent=_sc.a;document.getElementById('sc-j1m1-b').textContent=_sc.b;}var icons={gol:'⚽',propia:'🚫','pen-gol':'🥅','pen-fallo':'❌','pen-prov':'🤦','pen-parado':'🖐','falta-gol':'🎯',amarilla:'🟨','d-amarilla':'🟨🟥',roja:'🟥',mvp:'⭐'};_events.push({min:min,label:e.label,type:e.type,team:e.team,num:num,name:name,ico:icons[e.type]||'•',id:Date.now()});_renderActa_j1m1();mlCloseModal_j1m1();};
function _renderActa_j1m1(){var list=document.getElementById('ml-acta-list-j1m1');var sorted=_events.slice().sort(function(a,b){return a.min-b.min;});list.innerHTML='';if(sorted.length===0){list.innerHTML='<div class="ml-acta-empty">Sin eventos registrados</div>';return;}sorted.forEach(function(ev){var row=document.createElement('div');row.className='ml-evt-item';var tl=(ev.team==='a')?TEAM_A_NAME:TEAM_B_NAME;row.innerHTML='<span class="ml-evt-min">'+ev.min+"'</span>"+'<span class="ml-evt-ico">'+ev.ico+'</span>'+'<span class="ml-evt-name">'+ev.num+'. '+ev.name+'</span>'+'<span class="ml-evt-team">'+tl+'</span>'+'<button class="ml-evt-del" onclick="mlDelEvt_j1m1('+ev.id+')">✕</button>';list.appendChild(row);});};
window.mlDelEvt_j1m1=function(id){var ev=_events.find(function(e){return e.id===id;});if(!ev)return;var scoringTypes=['gol','propia','pen-gol','falta-gol'];if(scoringTypes.indexOf(ev.type)!==-1){var st=(ev.type==='propia')?(ev.team==='a'?'b':'a'):ev.team;_sc[st]=Math.max(0,_sc[st]-1);document.getElementById('sc-j1m1-a').textContent=_sc.a;document.getElementById('sc-j1m1-b').textContent=_sc.b;}_events=_events.filter(function(e){return e.id!==id;});_renderActa_j1m1();};
})();

(function(){
var _sc={a:0,b:0};var _rojas={a:0,b:0};var _events=[];var _timerSec=0;var _timerInterval=null;var _timerRunning=false;
var _htDone=false;var _etDone=false;var _et1Done=false;var _matchFinished=false;var _pendingEvt=null;
var _etPhase=false;
var TEAM_A_NAME="Athletic Club";var TEAM_B_NAME="Real Betis";
var TEAM_A_OPTS='<option value="1|Unai Simón">1. Unai Simón</option><option value="2|De Marcos">2. De Marcos</option><option value="3|Yuri Berchiche">3. Yuri Berchiche</option><option value="4|Aitor Paredes">4. Aitor Paredes</option><option value="5|Dani Vivian">5. Dani Vivian</option><option value="6|Yeray Álvarez">6. Yeray Álvarez</option><option value="7|Iñaki Williams">7. Iñaki Williams</option><option value="8|Beñat Turrientes">8. Beñat Turrientes</option><option value="9|Gorka Guruzeta">9. Gorka Guruzeta</option><option value="10|Oihan Sancet">10. Oihan Sancet</option><option value="11|Nico Williams">11. Nico Williams</option><option value="14|Javier Martínez">14. Javier Martínez</option><option value="16|Mikel Vesga">16. Mikel Vesga</option><option value="17|Unai Gómez">17. Unai Gómez</option><option value="18|Dani García">18. Dani García</option><option value="22|Mikel Prados">22. Mikel Prados</option><option value="24|Marcelino Prados">24. Marcelino Prados</option>';var TEAM_B_OPTS='<option value="1|Rui Silva">1. Rui Silva</option><option value="2|Héctor Bellerín">2. Héctor Bellerín</option><option value="3|Álex Moreno">3. Álex Moreno</option><option value="4|Germán Pezzella">4. Germán Pezzella</option><option value="5|Marc Bartra">5. Marc Bartra</option><option value="7|Juanmi">7. Juanmi</option><option value="8|Guido Rodríguez">8. Guido Rodríguez</option><option value="9|Borja Iglesias">9. Borja Iglesias</option><option value="10|Nabil Fekir">10. Nabil Fekir</option><option value="11|Isco">11. Isco</option><option value="14|Carvalho">14. Carvalho</option><option value="15|Ricardo Rodríguez">15. Ricardo Rodríguez</option><option value="16|Ayoze Pérez">16. Ayoze Pérez</option><option value="18|Riad">18. Riad</option><option value="22|Youssouf Sabaly">22. Youssouf Sabaly</option><option value="28|Assane Diao">28. Assane Diao</option>';
var MAX_NORMAL=5400;var MAX_ET=7200;
var NORMAL_SPEED=1000;var ET_SPEED=233;
window.mlTimerClick_j1m2=function(){if(_matchFinished)return;if(_timerRunning){clearInterval(_timerInterval);_timerRunning=false;_renderTimer_j1m2();}else{_timerRunning=true;_startInterval_j1m2();}};
function _startInterval_j1m2(){var spd=_etPhase?ET_SPEED:NORMAL_SPEED;_timerInterval=setInterval(function(){_timerSec+=5;var maxSec=_etDone?MAX_ET:MAX_NORMAL;if(!_htDone&&_timerSec>=2700){_htDone=true;_addMarker_j1m2("— DESCANSO (45 min) —");}if(_etDone&&!_et1Done&&_timerSec>=6300){_et1Done=true;_addMarker_j1m2("— DESCANSO PRÓRROGA (105 min) —");}if(_timerSec>=maxSec){_timerSec=maxSec;clearInterval(_timerInterval);_timerRunning=false;if(_etDone){_checkPenalties_j1m2();}} _renderTimer_j1m2();},spd);};
function _renderTimer_j1m2(){var btn=document.getElementById('ml-timer-j1m2');if(!btn)return;var totalMin=Math.floor(_timerSec/60);if(_matchFinished){btn.textContent='🏁 FIN';btn.className='ml-timer finished';return;}var label=_timerRunning?'⏸ ':(_timerSec>=(_etDone?MAX_ET:MAX_NORMAL)?'🔁 ':'▶ ');btn.textContent=label+totalMin+"'";btn.className='ml-timer'+(_timerRunning?' running':'');};
function _currentMin_j1m2(){return Math.min(_etDone?120:90,Math.floor(_timerSec/60));};
function _addMarker_j1m2(txt){var list=document.getElementById('ml-acta-list-j1m2');var div=document.createElement('div');div.className='ml-ht';div.textContent=txt;list.appendChild(div);_removeEmpty_j1m2();};
window.mlActivateET_j1m2=function(){if(_etDone||_matchFinished)return;_etDone=true;_etPhase=true;if(_timerRunning){clearInterval(_timerInterval);_startInterval_j1m2();}if(_timerSec<MAX_NORMAL)_timerSec=MAX_NORMAL;_addMarker_j1m2('— PRÓRROGA —');var btn=document.getElementById('ml-btn-et-j1m2');if(btn){btn.disabled=true;btn.style.opacity='0.35';}var penBtn=document.getElementById('ml-btn-pen-j1m2');if(penBtn)penBtn.style.display='';_renderTimer_j1m2();};
window.mlShowPenPanel_j1m2=function(){var pp=document.getElementById('ml-pen-panel-j1m2');if(pp)pp.classList.add('show');var penBtn=document.getElementById('ml-btn-pen-j1m2');if(penBtn){penBtn.disabled=true;penBtn.style.opacity='0.35';}var addBtn=document.getElementById('ml-add-btn-j1m2');if(addBtn){addBtn.disabled=true;addBtn.style.opacity='0.35';}};
window.mlEndMatch_j1m2=function(winner){if(_matchFinished)return;if(!winner&&_sc.a===_sc.b){alert("⚠️ El partido está empatado. Debes ir a PRÓRROGA y luego a PENALTIS.");return;}
  // ── MVP obligatorio ──
  var hasMvp=_events.some(function(e){return e.type==='mvp';});
  if(!hasMvp){
    var sqA_=window.SQUAD_REGISTRY['Athletic Club']||_sqA_j1m2;
    var sqB_=window.SQUAD_REGISTRY['Real Betis']||_sqB_j1m2;
    window.showMvpForce('j1m2','Athletic Club','Real Betis',sqA_,sqB_,_sc.a,_sc.b,function(team,num,name){
      var icons={gol:'⚽',propia:'🚫','pen-gol':'🥅','pen-fallo':'❌','pen-prov':'🤦','pen-parado':'🖐','falta-gol':'🎯',amarilla:'🟨','d-amarilla':'🟨🟥',roja:'🟥',mvp:'⭐'};
      _events.push({min:90,label:'MVP del Partido',type:'mvp',team:team,num:num,name:name,ico:'⭐',id:Date.now()});
      _renderActa_j1m2();
      window.mlEndMatch_j1m2(winner);
    });
    return;
  }
clearInterval(_timerInterval);_timerRunning=false;_matchFinished=true;var penWinner=null;if(winner==='a'||winner==='b'){if(_sc.a===_sc.b)penWinner=winner;}if(!winner){if(_sc.a>_sc.b)winner='a';else if(_sc.b>_sc.a)winner='b';else winner='draw';}var btn=document.getElementById('ml-btn-end-j1m2');if(btn){btn.disabled=true;btn.style.opacity='0.35';}var etBtn=document.getElementById('ml-btn-et-j1m2');if(etBtn){etBtn.disabled=true;etBtn.style.opacity='0.35';}var penBtn=document.getElementById('ml-btn-pen-j1m2');if(penBtn){penBtn.disabled=true;penBtn.style.opacity='0.35';}var _ta_a=_events.filter(function(e){return e.team==='a'&&(e.type==='amarilla'||e.type==='d-amarilla');}).length;var _tr_a=_events.filter(function(e){return e.team==='a'&&(e.type==='roja'||e.type==='d-amarilla');}).length;var _ta_b=_events.filter(function(e){return e.team==='b'&&(e.type==='amarilla'||e.type==='d-amarilla');}).length;var _tr_b=_events.filter(function(e){return e.team==='b'&&(e.type==='roja'||e.type==='d-amarilla');}).length;var _mvp_a=_events.filter(function(e){return e.team==='a'&&e.type==='mvp';}).length;var _mvp_b=_events.filter(function(e){return e.team==='b'&&e.type==='mvp';}).length;if(typeof window.registrarResultadoLiga==='function')window.registrarResultadoLiga('j1m2',TEAM_A_NAME,TEAM_B_NAME,_sc.a,_sc.b,_ta_a,_tr_a,_ta_b,_tr_b,_mvp_a,_mvp_b,penWinner); if(typeof window.registrarLigaPlayerStats==='function')window.registrarLigaPlayerStats('j1m2',TEAM_A_NAME,TEAM_B_NAME,_events.map(function(ev){return {type:(ev.type==='amarilla'||ev.type==='roja'||ev.type==='d-amarilla')?'card':ev.type,ico:ev.ico,team:ev.team,player:[ev.num,ev.name]};}),(_events.find(function(e){return e.type==='mvp';})||{}).name||'',(_events.find(function(e){return e.type==='mvp';})||{}).team==='a'?TEAM_A_NAME:((_events.find(function(e){return e.type==='mvp';})||{}).team==='b'?TEAM_B_NAME:'')); _renderTimer_j1m2();};
function _checkPenalties_j1m2(){if(_sc.a===_sc.b){_addMarker_j1m2("— EMPATE AL 120' —");var pp=document.getElementById("ml-pen-panel-j1m2");if(pp)pp.classList.add("show");var addBtn=document.getElementById("ml-add-btn-j1m2");if(addBtn){addBtn.disabled=true;addBtn.style.opacity="0.35";}}else{mlEndMatch_j1m2();}};window.mlConfirmPen_j1m2=function(){var pa=parseInt(document.getElementById("ml-pen-a-j1m2").value)||0;var pb=parseInt(document.getElementById("ml-pen-b-j1m2").value)||0;if(pa===pb){alert("⚠️ Los penaltis no pueden terminar en empate. Introduce un resultado válido.");return;}var penWinner=pa>pb?"a":"b";var psEl=document.getElementById("pen-score-j1m2");if(psEl){psEl.textContent=pa+"–"+pb;psEl.classList.add("show");}var pp=document.getElementById("ml-pen-panel-j1m2");if(pp)pp.classList.remove("show");mlEndMatch_j1m2(penWinner);};
window.mlShowEvOv_j1m2=function(){document.getElementById("ml-ev-overlay-j1m2").classList.add("show");};window.mlHideEvOv_j1m2=function(){document.getElementById("ml-ev-overlay-j1m2").classList.remove("show");};window.mlEvPick_j1m2=function(label,type){document.getElementById("ml-ev-overlay-j1m2").classList.remove("show");mlShowTP_j1m2(label,type);};window.mlShowTP_j1m2=function(label,type){_pendingEvt={label:label,type:type};document.getElementById("ml-tp-ov-evt-j1m2").textContent=label;document.getElementById("ml-tp-overlay-j1m2").classList.add("show");};window.mlHideTP_j1m2=function(){document.getElementById("ml-tp-overlay-j1m2").classList.remove("show");_pendingEvt=null;};window.mlTPSelect_j1m2=function(team){document.getElementById("ml-tp-overlay-j1m2").classList.remove("show");mlDirectPick_j1m2(_pendingEvt.label,_pendingEvt.type,team);};window.mlTogglePanel_j1m2=function(){mlShowEvOv_j1m2();};
var _sqA_j1m2=[{'h':'🧤 PORTEROS'},['1','Unai Simón'],['13','Alex Padilla'],{'h':'🛡 DEFENSAS'},['17','Yuri Berchiche'],['6','Yeray Álvarez'],['4','Aymeric Laporte'],['19','Andoni Gorosabel'],['5','Daniel Vivian'],['18','Jesús Areso'],['20','Íñigo Lekue'],{'h':'⚙️ MEDIOS'},['9','Oihan Sancet'],['10','Iñigo R. Galarreta'],['14','Mikel Vesga'],['15','Robert Navarro'],['16','Unai Gómez'],{'h':'⚡ DELANTEROS'},['11','Nico Williams'],['12','Iñaki Williams'],['2','Gorka Guruzeta'],['3','Álex Berenguer']];var _sqB_j1m2=[{'h':'🧤 PORTEROS'},['1','Álvaro Valles'],['13','Adrián'],{'h':'🛡 DEFENSAS'},['3','Junior Firpo'],['23','Diego Llorente'],['5','Marc Bartra'],['24','Aitor Ruibal'],['2','Héctor Bellerín'],['4','Natan'],['12','Ricardo Rodríguez'],{'h':'⚙️ MEDIOS'},['22','Isco'],['14','Sofyan Amrabat'],['8','Pablo Fornals'],['10','Abdessamad Ezzalzouli'],['17','Rodrigo Riquelme'],['18','Nelson Deossa'],['20','Giovani Lo Celso'],{'h':'⚡ DELANTEROS'},['7','Antony'],['19','Cucho Hernández'],['11','Cédric Bakambu'],['9','Chimy Ávila']];window.mlShowPl_j1m2=function(){var ov=document.getElementById("ml-pl-overlay-j1m2");var e=_pendingEvt;var sq=(e.team==="a")?(window.SQUAD_REGISTRY[TEAM_A_NAME]||_sqA_j1m2):(window.SQUAD_REGISTRY[TEAM_B_NAME]||_sqB_j1m2);var tname=(e.team==="a")?TEAM_A_NAME:TEAM_B_NAME;document.getElementById("ml-pl-ov-evt-j1m2").textContent=e.label;document.getElementById("ml-pl-ov-team-j1m2").textContent=tname;var list=document.getElementById("ml-pl-ov-list-j1m2");list.innerHTML=sq.map(function(p){if(p.h)return '<div class="ml-pl-ov-sec">'+p.h+'</div>';return '<button class="ml-pl-ov-btn" onclick="mlPlConfirm_j1m2(\''+p[0]+'\',\''+p[1].replace(/\'/g,"\\'")+ '\')">'+'<span class="ml-pl-ov-num">'+p[0]+'</span>'+'<span class="ml-pl-ov-name">'+p[1]+'</span>'+'</button>';}).join("");ov.classList.add("show");};window.mlHidePl_j1m2=function(){document.getElementById("ml-pl-overlay-j1m2").classList.remove("show");};window.mlPlConfirm_j1m2=function(num,name){document.getElementById("ml-pl-overlay-j1m2").classList.remove("show");if(!_pendingEvt)return;var e=_pendingEvt;var min=_currentMin_j1m2();if(e.type==="d-amarilla"){var hasYellow=_events.some(function(ev){return ev.type==="amarilla"&&ev.team===e.team&&ev.num===num;});if(!hasYellow){alert("⚠️ "+name+" no tiene amarilla previa. No se puede mostrar doble amarilla.");_pendingEvt=null;return;}}var scoringTypes=["gol","propia","pen-gol","falta-gol"];if(scoringTypes.indexOf(e.type)!==-1){var st=(e.type==="propia")?(e.team==="a"?"b":"a"):e.team;_sc[st]++;document.getElementById("sc-j1m2-a").textContent=_sc.a;document.getElementById("sc-j1m2-b").textContent=_sc.b;}if((e.type==="d-amarilla"||e.type==="roja")&&(e.type!=="roja"||_events.filter(function(ev){return(ev.type==="roja"||ev.type==="d-amarilla")&&ev.team===e.team;}).length===0)){_rojas=_rojas||{};_rojas[e.team]=(_rojas[e.team]||0)+1;}var icons={gol:"⚽",propia:"🚫","pen-gol":"🥅","pen-fallo":"❌","pen-prov":"🤦","pen-parado":"🖐","falta-gol":"🎯",amarilla:"🟨","d-amarilla":"🟨🟥",roja:"🟥",mvp:"⭐"};_events.push({min:min,label:e.label,type:e.type,team:e.team,num:num,name:name,ico:icons[e.type]||"•",id:Date.now()});_renderActa_j1m2();_pendingEvt=null;};window.mlDirectPick_j1m2=function(label,type,team){_pendingEvt={label:label,type:type,team:team};mlShowPl_j1m2();};
window.mlCloseModal_j1m2=function(){document.getElementById('ml-modal-j1m2').classList.remove('show');_pendingEvt=null;};
var _evtToStat={gol:'gol',amarilla:'yel','d-amarilla':'yel',roja:'red',mvp:'mvp','pen-prov':'pen-prov','pen-parado':'pen-parado','pen-gol':'pen-gol','falta-gol':'falta-gol',propia:'propia'};
function _removeEmpty_j1m2(){var emp=document.querySelector('#ml-acta-list-j1m2 .ml-acta-empty');if(emp)emp.remove();};
window.mlConfirmEvt_j1m2=function(){if(!_pendingEvt)return;var sel=document.getElementById('ml-modal-sel-j1m2');var parts=sel.value.split('|');var num=parts[0],name=parts[1];var e=_pendingEvt;var min=_currentMin_j1m2();var scoringTypes=['gol','propia','pen-gol','falta-gol'];if(scoringTypes.indexOf(e.type)!==-1){var st=(e.type==='propia')?(e.team==='a'?'b':'a'):e.team;_sc[st]++;document.getElementById('sc-j1m2-a').textContent=_sc.a;document.getElementById('sc-j1m2-b').textContent=_sc.b;}var icons={gol:'⚽',propia:'🚫','pen-gol':'🥅','pen-fallo':'❌','pen-prov':'🤦','pen-parado':'🖐','falta-gol':'🎯',amarilla:'🟨','d-amarilla':'🟨🟥',roja:'🟥',mvp:'⭐'};_events.push({min:min,label:e.label,type:e.type,team:e.team,num:num,name:name,ico:icons[e.type]||'•',id:Date.now()});_renderActa_j1m2();mlCloseModal_j1m2();};
function _renderActa_j1m2(){var list=document.getElementById('ml-acta-list-j1m2');var sorted=_events.slice().sort(function(a,b){return a.min-b.min;});list.innerHTML='';if(sorted.length===0){list.innerHTML='<div class="ml-acta-empty">Sin eventos registrados</div>';return;}sorted.forEach(function(ev){var row=document.createElement('div');row.className='ml-evt-item';var tl=(ev.team==='a')?TEAM_A_NAME:TEAM_B_NAME;row.innerHTML='<span class="ml-evt-min">'+ev.min+"'</span>"+'<span class="ml-evt-ico">'+ev.ico+'</span>'+'<span class="ml-evt-name">'+ev.num+'. '+ev.name+'</span>'+'<span class="ml-evt-team">'+tl+'</span>'+'<button class="ml-evt-del" onclick="mlDelEvt_j1m2('+ev.id+')">✕</button>';list.appendChild(row);});};
window.mlDelEvt_j1m2=function(id){var ev=_events.find(function(e){return e.id===id;});if(!ev)return;var scoringTypes=['gol','propia','pen-gol','falta-gol'];if(scoringTypes.indexOf(ev.type)!==-1){var st=(ev.type==='propia')?(ev.team==='a'?'b':'a'):ev.team;_sc[st]=Math.max(0,_sc[st]-1);document.getElementById('sc-j1m2-a').textContent=_sc.a;document.getElementById('sc-j1m2-b').textContent=_sc.b;}_events=_events.filter(function(e){return e.id!==id;});_renderActa_j1m2();};
})();

(function(){
var _sc={a:0,b:0};var _rojas={a:0,b:0};var _events=[];var _timerSec=0;var _timerInterval=null;var _timerRunning=false;
var _htDone=false;var _matchFinished=false;var _pendingEvt=null;
var TEAM_A_NAME="Real Sociedad";var TEAM_B_NAME="Rayo Vallecano";
var TEAM_A_OPTS='<option value="1|Alex Remiro">1. Alex Remiro</option><option value="2|Aritz Zaldua">2. Aritz Zaldua</option><option value="3|Aihen Muñoz">3. Aihen Muñoz</option><option value="5|Igor Zubeldia">5. Igor Zubeldia</option><option value="6|Jon Pacheco">6. Jon Pacheco</option><option value="8|Mikel Merino">8. Mikel Merino</option><option value="10|David Silva">10. David Silva</option><option value="11|Carlos Fernández">11. Carlos Fernández</option><option value="14|Brais Méndez">14. Brais Méndez</option><option value="15|Mikel Oyarzabal">15. Mikel Oyarzabal</option><option value="17|Zakharyan">17. Zakharyan</option><option value="18|Takefusa Kubo">18. Takefusa Kubo</option><option value="19|Cho">19. Cho</option><option value="21|Hamari Traoré">21. Hamari Traoré</option><option value="22|Martin Zubimendi">22. Martin Zubimendi</option><option value="24|Ander Barrenetxea">24. Ander Barrenetxea</option>';var TEAM_B_OPTS='<option value="0|Jugador IA">Jugador IA</option>';
var MAX_NORMAL=5400;var TICK_MS=667;
window.mlTimerClick_j1m3=function(){if(_matchFinished)return;if(_timerRunning){clearInterval(_timerInterval);_timerRunning=false;_renderTimer_j1m3();}else{_timerRunning=true;_timerInterval=setInterval(function(){_timerSec+=5;if(!_htDone&&_timerSec>=2700){_htDone=true;_addMarker_j1m3("— DESCANSO (45 min) —");}if(_timerSec>=MAX_NORMAL){_timerSec=MAX_NORMAL;clearInterval(_timerInterval);_timerRunning=false;} _renderTimer_j1m3();},TICK_MS);}};
function _renderTimer_j1m3(){var btn=document.getElementById('ml-timer-j1m3');if(!btn)return;var min=Math.floor(_timerSec/60);if(_matchFinished){btn.textContent='🏁 FIN';btn.className='ml-timer finished';return;}var label=_timerRunning?'⏸ ':(_timerSec>=MAX_NORMAL?'🔁 ':'▶ ');btn.textContent=label+min+"'";btn.className='ml-timer'+(_timerRunning?' running':'');};
function _currentMin_j1m3(){return Math.min(90,Math.floor(_timerSec/60));};
function _addMarker_j1m3(txt){var list=document.getElementById('ml-acta-list-j1m3');var div=document.createElement('div');div.className='ml-ht';div.textContent=txt;list.appendChild(div);_removeEmpty_j1m3();};
window.mlEndMatch_j1m3=function(){if(_matchFinished)return;
  // ── MVP obligatorio ──
  var hasMvp=_events.some(function(e){return e.type==='mvp';});
  if(!hasMvp){
    var sqA_=window.SQUAD_REGISTRY['Real Sociedad']||_sqA_j1m3;
    var sqB_=window.SQUAD_REGISTRY['Rayo Vallecano']||_sqB_j1m3;
    window.showMvpForce('j1m3','Real Sociedad','Rayo Vallecano',sqA_,sqB_,_sc.a,_sc.b,function(team,num,name){
      _events.push({min:90,label:'MVP del Partido',type:'mvp',team:team,num:num,name:name,ico:'⭐',id:Date.now()});
      _renderActa_j1m3();
      window.mlEndMatch_j1m3();
    });
    return;
  }
  clearInterval(_timerInterval);_timerRunning=false;_matchFinished=true;var winner;if(_sc.a>_sc.b)winner='a';else if(_sc.b>_sc.a)winner='b';else winner='draw';var btn=document.getElementById('ml-btn-end-j1m3');if(btn){btn.disabled=true;btn.style.opacity='0.35';}var _ta_a=_events.filter(function(e){return e.team==='a'&&(e.type==='amarilla'||e.type==='d-amarilla');}).length;var _tr_a=_events.filter(function(e){return e.team==='a'&&(e.type==='roja'||e.type==='d-amarilla');}).length;var _ta_b=_events.filter(function(e){return e.team==='b'&&(e.type==='amarilla'||e.type==='d-amarilla');}).length;var _tr_b=_events.filter(function(e){return e.team==='b'&&(e.type==='roja'||e.type==='d-amarilla');}).length;var _mvp_a=_events.filter(function(e){return e.team==='a'&&e.type==='mvp';}).length;var _mvp_b=_events.filter(function(e){return e.team==='b'&&e.type==='mvp';}).length;if(typeof window.registrarResultadoLiga==='function')window.registrarResultadoLiga('j1m3',TEAM_A_NAME,TEAM_B_NAME,_sc.a,_sc.b,_ta_a,_tr_a,_ta_b,_tr_b,_mvp_a,_mvp_b); if(typeof window.registrarLigaPlayerStats==='function')window.registrarLigaPlayerStats('j1m3',TEAM_A_NAME,TEAM_B_NAME,_events.map(function(ev){return {type:(ev.type==='amarilla'||ev.type==='roja'||ev.type==='d-amarilla')?'card':ev.type,ico:ev.ico,team:ev.team,player:[ev.num,ev.name]};}),(_events.find(function(e){return e.type==='mvp';})||{}).name||'',(_events.find(function(e){return e.type==='mvp';})||{}).team==='a'?TEAM_A_NAME:((_events.find(function(e){return e.type==='mvp';})||{}).team==='b'?TEAM_B_NAME:'')); _renderTimer_j1m3();};
window.mlShowEvOv_j1m3=function(){document.getElementById("ml-ev-overlay-j1m3").classList.add("show");};window.mlHideEvOv_j1m3=function(){document.getElementById("ml-ev-overlay-j1m3").classList.remove("show");};window.mlEvPick_j1m3=function(label,type){document.getElementById("ml-ev-overlay-j1m3").classList.remove("show");mlShowTP_j1m3(label,type);};window.mlShowTP_j1m3=function(label,type){_pendingEvt={label:label,type:type};document.getElementById("ml-tp-ov-evt-j1m3").textContent=label;document.getElementById("ml-tp-overlay-j1m3").classList.add("show");};window.mlHideTP_j1m3=function(){document.getElementById("ml-tp-overlay-j1m3").classList.remove("show");_pendingEvt=null;};window.mlTPSelect_j1m3=function(team){document.getElementById("ml-tp-overlay-j1m3").classList.remove("show");mlDirectPick_j1m3(_pendingEvt.label,_pendingEvt.type,team);};window.mlTogglePanel_j1m3=function(){mlShowEvOv_j1m3();};
var _sqA_j1m3=[{'h':'🧤 PORTEROS'},['1','Álex Remiro'],['13','Unai Marrero'],{'h':'🛡 DEFENSAS'},['3','Aihen Muñoz'],['16','Duje Ćaleta-Car'],['5','Igor Zubeldia'],['2','Jon Aramburu'],['6','Aritz Elustondo'],['20','Álvaro Odriozola'],{'h':'⚙️ MEDIOS'},['23','Brais Méndez'],['4','Jon Gorrotxategi'],['8','Beñat Turrientes'],['14','Takefusa Kubo'],['17','Sergio Gómez'],['18','Carlos Soler'],['21','Arsen Zakharyan'],['24','Luka Sučić'],{'h':'⚡ DELANTEROS'},['10','Mikel Oyarzabal'],['7','Ander Barrenetxea'],['9','Orri Steinn Óskarsson'],['19','Jon Karrikaburu']];var _sqB_j1m3=[{'h':'🧤 PORTEROS'},['0','Jugador IA']];window.mlShowPl_j1m3=function(){var ov=document.getElementById("ml-pl-overlay-j1m3");var e=_pendingEvt;var sq=(e.team==="a")?(window.SQUAD_REGISTRY[TEAM_A_NAME]||_sqA_j1m3):(window.SQUAD_REGISTRY[TEAM_B_NAME]||_sqB_j1m3);var tname=(e.team==="a")?TEAM_A_NAME:TEAM_B_NAME;document.getElementById("ml-pl-ov-evt-j1m3").textContent=e.label;document.getElementById("ml-pl-ov-team-j1m3").textContent=tname;var list=document.getElementById("ml-pl-ov-list-j1m3");list.innerHTML=sq.map(function(p){if(p.h)return '<div class="ml-pl-ov-sec">'+p.h+'</div>';return '<button class="ml-pl-ov-btn" onclick="mlPlConfirm_j1m3(\''+p[0]+'\',\''+p[1].replace(/\'/g,"\\'")+ '\')">'+'<span class="ml-pl-ov-num">'+p[0]+'</span>'+'<span class="ml-pl-ov-name">'+p[1]+'</span>'+'</button>';}).join("");ov.classList.add("show");};window.mlHidePl_j1m3=function(){document.getElementById("ml-pl-overlay-j1m3").classList.remove("show");};window.mlPlConfirm_j1m3=function(num,name){document.getElementById("ml-pl-overlay-j1m3").classList.remove("show");if(!_pendingEvt)return;var e=_pendingEvt;var min=_currentMin_j1m3();if(e.type==="d-amarilla"){var hasYellow=_events.some(function(ev){return ev.type==="amarilla"&&ev.team===e.team&&ev.num===num;});if(!hasYellow){alert("⚠️ "+name+" no tiene amarilla previa. No se puede mostrar doble amarilla.");_pendingEvt=null;return;}}var scoringTypes=["gol","propia","pen-gol","falta-gol"];if(scoringTypes.indexOf(e.type)!==-1){var st=(e.type==="propia")?(e.team==="a"?"b":"a"):e.team;_sc[st]++;document.getElementById("sc-j1m3-a").textContent=_sc.a;document.getElementById("sc-j1m3-b").textContent=_sc.b;}if((e.type==="d-amarilla"||e.type==="roja")&&(e.type!=="roja"||_events.filter(function(ev){return(ev.type==="roja"||ev.type==="d-amarilla")&&ev.team===e.team;}).length===0)){_rojas=_rojas||{};_rojas[e.team]=(_rojas[e.team]||0)+1;}var icons={gol:"⚽",propia:"🚫","pen-gol":"🥅","pen-fallo":"❌","pen-prov":"🤦","pen-parado":"🖐","falta-gol":"🎯",amarilla:"🟨","d-amarilla":"🟨🟥",roja:"🟥",mvp:"⭐"};_events.push({min:min,label:e.label,type:e.type,team:e.team,num:num,name:name,ico:icons[e.type]||"•",id:Date.now()});_renderActa_j1m3();_pendingEvt=null;};window.mlDirectPick_j1m3=function(label,type,team){_pendingEvt={label:label,type:type,team:team};mlShowPl_j1m3();};
window.mlCloseModal_j1m3=function(){document.getElementById('ml-modal-j1m3').classList.remove('show');_pendingEvt=null;};
function _removeEmpty_j1m3(){var emp=document.querySelector('#ml-acta-list-j1m3 .ml-acta-empty');if(emp)emp.remove();};
window.mlConfirmEvt_j1m3=function(){if(!_pendingEvt)return;var sel=document.getElementById('ml-modal-sel-j1m3');var parts=sel.value.split('|');var num=parts[0],name=parts[1];var e=_pendingEvt;var min=_currentMin_j1m3();var scoringTypes=['gol','propia','pen-gol','falta-gol'];if(scoringTypes.indexOf(e.type)!==-1){var st=(e.type==='propia')?(e.team==='a'?'b':'a'):e.team;_sc[st]++;document.getElementById('sc-j1m3-a').textContent=_sc.a;document.getElementById('sc-j1m3-b').textContent=_sc.b;}var icons={gol:'⚽',propia:'🚫','pen-gol':'🥅','pen-fallo':'❌','pen-prov':'🤦','pen-parado':'🖐','falta-gol':'🎯',amarilla:'🟨','d-amarilla':'🟨🟥',roja:'🟥',mvp:'⭐'};_events.push({min:min,label:e.label,type:e.type,team:e.team,num:num,name:name,ico:icons[e.type]||'•',id:Date.now()});_renderActa_j1m3();mlCloseModal_j1m3();};
function _renderActa_j1m3(){var list=document.getElementById('ml-acta-list-j1m3');var sorted=_events.slice().sort(function(a,b){return a.min-b.min;});list.innerHTML='';if(sorted.length===0){list.innerHTML='<div class="ml-acta-empty">Sin eventos registrados</div>';return;}sorted.forEach(function(ev){var row=document.createElement('div');row.className='ml-evt-item';var tl=(ev.team==='a')?TEAM_A_NAME:TEAM_B_NAME;row.innerHTML='<span class="ml-evt-min">'+ev.min+"'</span>"+'<span class="ml-evt-ico">'+ev.ico+'</span>'+'<span class="ml-evt-name">'+ev.num+'. '+ev.name+'</span>'+'<span class="ml-evt-team">'+tl+'</span>'+'<button class="ml-evt-del" onclick="mlDelEvt_j1m3('+ev.id+')">✕</button>';list.appendChild(row);});};
window.mlDelEvt_j1m3=function(id){var ev=_events.find(function(e){return e.id===id;});if(!ev)return;var scoringTypes=['gol','propia','pen-gol','falta-gol'];if(scoringTypes.indexOf(ev.type)!==-1){var st=(ev.type==='propia')?(ev.team==='a'?'b':'a'):ev.team;_sc[st]=Math.max(0,_sc[st]-1);document.getElementById('sc-j1m3-a').textContent=_sc.a;document.getElementById('sc-j1m3-b').textContent=_sc.b;}_events=_events.filter(function(e){return e.id!==id;});_renderActa_j1m3();};
})();

(function(){
var _simDone=false;
window.mlSimulate_j1m4=function(){
  if(_simDone)return;_simDone=true;
  window.mlSimEngine({
    matchKey:'j1m4',
    teamA:'Sevilla',
    teamB:'Atlético Madrid',
    sqA:window.sqFromRegistry('Sevilla FC')||[['1','Vlachodimos','P'],['13','Dmitrovic','P'],['3','Azpilicueta','D'],['4','Kike Salas','D'],['5','Nianzou','D'],['16','Juanlu','D'],['22','Loic Badé','D'],['6','N. Gudelj','M'],['8','Joan Jordán','M'],['17','Alfon González','M'],['18','L. Agoumé','M'],['20','D. Sow','M'],['7','Isaac Romero','F'],['9','Akor Adams','F'],['10','A. Sánchez','F'],['11','R. Vargas','F'],['21','C. Ejuke','F']],
    sqB:window.sqFromRegistry('Atlético Madrid')||[['1','Oblak','P'],['13','Musso','P'],['2','Hancko','D'],['3','M. Llorente','D'],['4','Le Normand','D'],['5','Giménez','D'],['20','Molina','D'],['7','Griezmann','M'],['8','Koke','M'],['14','P. Barrios','M'],['10','J. Cardoso','M'],['17','O. Vargas','M'],['9','Julián Álvarez','F'],['11','Sørloth','F'],['15','Lookman','F'],['16','Nico González','F'],['18','Álex Baena','F']],
    btnId:'ml-timer-j1m4',
    listId:'ml-acta-list-j1m4',
    scAId:'sc-j1m4-a',
    scBId:'sc-j1m4-b',
    gfId:'gf-j1m4'
  });
};
})();

(function(){
var _simDone=false;
window.mlSimulate_j1m5=function(){
  if(_simDone)return;_simDone=true;
  window.mlSimEngine({
    matchKey:'j1m5',
    teamA:'Villarreal',
    teamB:'Elche CF',
    sqA:window.sqFromRegistry('Villarreal CF')||[['1','Pepe Reina','P'],['25','F. Civitanova','P'],['2','Logan Costa','D'],['4','Rafa Marín','D'],['5','W. Kambwala','D'],['8','Juan Foyth','D'],['24','A. Pedraza','D'],['10','Dani Parejo','M'],['14','S. Comesaña','M'],['16','T. Partey','M'],['17','T. Buchanan','M'],['18','Pape Gueye','M'],['7','G. Moreno','F'],['9','G. Mikautadze','F'],['11','I. Akhomach','F'],['20','A. Moleiro','F'],['22','Ayoze Pérez','F']],
    sqB:[['1','Werner','P'],['13','Badía','P'],['2','Barragán','D'],['3','Clerc','D'],['5','Bigas','D'],['6','Dani Calvo','D'],['23','Mojica','D'],['4','Guti','M'],['8','Marcone','M'],['10','Raúl Guti','M'],['14','Fidel','M'],['16','Mascarell','M'],['7','Lucas Boyé','F'],['9','Pere Milla','F'],['11','Rigoni','F'],['17','Benedetto','F'],['22','Tete Morente','F']],
    btnId:'ml-timer-j1m5',
    listId:'ml-acta-list-j1m5',
    scAId:'sc-j1m5-a',
    scBId:'sc-j1m5-b',
    gfId:'gf-j1m5'
  });
};
})();

(function(){
var _simDone=false;
window.mlSimulate_j1m6=function(){
  if(_simDone)return;_simDone=true;
  window.mlSimEngine({
    matchKey:'j1m6',
    teamA:'Mallorca',
    teamB:'Girona FC',
    sqA:[['1','Rajkovic','P'],['13','Reina','P'],['2','Maffeo','D'],['3','Copete','D'],['5','Valjent','D'],['6','Russo','D'],['23','Jaume Costa','D'],['4','Baba','M'],['8','Battaglia','M'],['10','Dani Rodríguez','M'],['14','Morlanes','M'],['16','Muriqi','M'],['7','Abdon','F'],['9','Budimir','F'],['11','Grenier','F'],['17','Lee Kang-in','F'],['22','Lago Junior','F']],
    sqB:[['1','Gazzaniga','P'],['13','Juan Carlos','P'],['2','Yan Couto','D'],['3','Blind','D'],['5','Juanpe','D'],['6','Santi Bueno','D'],['23','Miguel Gutiérrez','D'],['4','Aleix García','M'],['8','Herrera','M'],['10','Romeu','M'],['14','Tsygankov','M'],['16','Martín','M'],['7','Stuani','F'],['9','Castellanos','F'],['11','Sávio','F'],['17','Taty Castellanos','F'],['22','Iván Martín','F']],
    btnId:'ml-timer-j1m6',
    listId:'ml-acta-list-j1m6',
    scAId:'sc-j1m6-a',
    scBId:'sc-j1m6-b',
    gfId:'gf-j1m6'
  });
};
})();

(function(){
var _simDone=false;
window.mlSimulate_j1m7=function(){
  if(_simDone)return;_simDone=true;
  window.mlSimEngine({
    matchKey:'j1m7',
    teamA:'Valencia CF',
    teamB:'Córdoba CF',
    sqA:[['1','Mamardashvili','P'],['13','Cillessen','P'],['2','Correia','D'],['3','Gayà','D'],['5','Paulista','D'],['6','Diakhaby','D'],['23','Tárrega','D'],['4','Almeida','M'],['8','Guillamón','M'],['10','Pepelu','M'],['14','Wass','M'],['16','Musah','M'],['7','Guedes','F'],['9','Duro','F'],['11','Lato','F'],['17','Marcos André','F'],['22','Díaz','F']],
    sqB:[['1','Felipe Ramos','P'],['13','Caro','P'],['2','Moutinho','D'],['3','Calero','D'],['5','Willy','D'],['6','Ekanem','D'],['23','Caballero','D'],['4','Bernal','M'],['8','De las Cuevas','M'],['10','Xavi Molina','M'],['14','Álex Sala','M'],['16','Isma Ruiz','M'],['7','Adilson','F'],['9','Diarra','F'],['11','Kuki Zalazar','F'],['17','Carracedo','F'],['22','Jacobo','F']],
    btnId:'ml-timer-j1m7',
    listId:'ml-acta-list-j1m7',
    scAId:'sc-j1m7-a',
    scBId:'sc-j1m7-b',
    gfId:'gf-j1m7'
  });
};
})();

(function(){
var _simDone=false;
window.mlSimulate_j1m8=function(){
  if(_simDone)return;_simDone=true;
  window.mlSimEngine({
    matchKey:'j1m8',
    teamA:'Espanyol',
    teamB:'Getafe CF',
    sqA:window.sqFromRegistry('Espanyol')||[['1','M. Dmitrović','P'],['13','Fortuño','P'],['3','C. Romero','D'],['5','L. Cabrera','D'],['25','Calero','D'],['2','O. El Hilali','D'],['10','E. Expósito','M'],['8','P. Lozano','M'],['14','U. González','M'],['11','P. Milla','M'],['7','T. Dolan','M'],['9','R. Fernández','F'],['16','Puado','F'],['4','Terrats','M'],['18','C. Pickel','M'],['6','C. Riedel','D'],['19','Tristán','F']],
    sqB:window.sqFromRegistry('Getafe CF')||[['1','J. Letáček','P'],['13','David Soria','P'],['2','Djené','D'],['3','A. Abqar','D'],['12','A. Nyom','D'],['16','Diego Rico','D'],['17','Kiko Femenía','D'],['4','Y. Neyou','M'],['5','Luis Milla','M'],['6','Mario Martín','M'],['8','M. Arambarri','M'],['14','Javi Muñoz','M'],['7','Juanmi','F'],['9','B. Mayoral','F'],['10','M. Satriano','F'],['18','Á. Sancris','F'],['20','Coba da Costa','F']],
    btnId:'ml-timer-j1m8',
    listId:'ml-acta-list-j1m8',
    scAId:'sc-j1m8-a',
    scBId:'sc-j1m8-b',
    gfId:'gf-j1m8'
  });
};
})();

(function(){
var _simDone=false;
window.mlSimulate_j1m9=function(){
  if(_simDone)return;_simDone=true;
  window.mlSimEngine({
    matchKey:'j1m9',
    teamA:'Albacete BP',
    teamB:'Osasuna',
    sqA:window.sqFromRegistry('Albacete BP')||[['1','Diego Mariño','P'],['13','Raúl Lizoain','P'],['2','Lorenzo','D'],['3','JoGo','D'],['5','Javi Moreno','D'],['15','Fran Gámez','D'],['21','C. Neva','D'],['4','Agus Medina','M'],['6','Pacheco','M'],['8','Martín Fernández','M'],['12','Edward Cedeño','M'],['17','Ale Meléndez','M'],['7','Puertas','F'],['9','Higinio','F'],['10','Jefté','F'],['11','Valverde','F'],['16','Lazo','F']],
    sqB:[['1','Herrera','P'],['13','Sergio Herrera','P'],['2','Nacho Vidal','D'],['3','Cruz','D'],['5','Unai García','D'],['6','David García','D'],['23','Moncayola','D'],['4','Torró','M'],['8','Darko','M'],['10','Ruben García','M'],['14','Brasanac','M'],['16','Budimir','M'],['7','Kike García','F'],['9','Chimy Ávila','F'],['11','Ezequiel','F'],['17','Torres','F'],['22','Arnaiz','F']],
    btnId:'ml-timer-j1m9',
    listId:'ml-acta-list-j1m9',
    scAId:'sc-j1m9-a',
    scBId:'sc-j1m9-b',
    gfId:'gf-j1m9'
  });
};
})();

(function(){
var _simDone=false;
window.mlSimulate_j1m10=function(){
  if(_simDone)return;_simDone=true;
  window.mlSimEngine({
    matchKey:'j1m10',
    teamA:'Celta de Vigo',
    teamB:'Deportivo Alavés',
    sqA:[['1','Dituro','P'],['13','Marchesín','P'],['2','Kevin Vázquez','D'],['3','Jailson','D'],['5','Aidoo','D'],['6','Araujo','D'],['23','Mingueza','D'],['4','Tapia','M'],['8','Beltrán','M'],['10','Fran Beltrán','M'],['14','Cervi','M'],['16','Solari','M'],['7','Aspas','F'],['9','Larsen','F'],['11','Carles Pérez','F'],['17','Williot','F'],['22','Bamba','F']],
    sqB:[['1','Pacheco','P'],['13','Sivera','P'],['2','Tenaglia','D'],['3','Duarte','D'],['5','Laguardia','D'],['6','Lejeune','D'],['23','Rubén Alcaraz','D'],['4','Pina','M'],['8','Battaglia','M'],['10','Luis Rioja','M'],['14','Manu García','M'],['16','Guridi','M'],['7','Joselu','F'],['9','Deyverson','F'],['11','Edgar Méndez','F'],['17','Florian Miguel','F'],['22','Toni Moya','F']],
    btnId:'ml-timer-j1m10',
    listId:'ml-acta-list-j1m10',
    scAId:'sc-j1m10-a',
    scBId:'sc-j1m10-b',
    gfId:'gf-j1m10'
  });
};
})();


(function(){
  var LIGA_TEAMS = [
    'Albacete BP','Athatic__TEMP__', 'Athletic Club','Atlético Madrid','Celta de Vigo','Córdoba CF','Deportivo Alavés','Elche CF','Espanyol','FC Barcelona','Getafe CF','Girona FC','Mallorca','Osasuna','Rayo Vallecano','Real Betis','Real Madrid','Real Sociedad','Sevilla','Valencia CF','Villarreal'
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
    if(pos === 5 || pos === 6) return 'zone-uel';
    if(pos === 7 || pos === 8) return 'zone-conf';
    if(pos >= 17) return 'zone-desc';
    return '';
  }

  var TEAM_DATA = {
    'Albacete BP':      {abbr:'ALB', bg:'#8b0000', fg:'#fff200'},
    'Athletic Club':    {abbr:'ATH', bg:'#cc1010', fg:'#ffffff'},
    'Atlético Madrid':  {abbr:'ATM', bg:'#c50f1f', fg:'#ffffff'},
    'Celta de Vigo':    {abbr:'CEL', bg:'#6fc6e2', fg:'#003da5'},
    'Córdoba CF':       {abbr:'COR', bg:'#2a7e43', fg:'#ffffff'},
    'Deportivo Alavés': {abbr:'ALA', bg:'#003da5', fg:'#ffffff'},
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
    'Valencia CF':      {abbr:'VAL', bg:'#ef7d00', fg:'#ffffff'},
    'Villarreal':       {abbr:'VIL', bg:'#ffd700', fg:'#1a1a1a'}
  };

  var SHORT_NAMES = {
    'Albacete BP':      'Albacete',
    'Atlético Madrid':  'Atl Madrid',
    'Celta de Vigo':    'Celta',
    'Córdoba CF':       'Córdoba',
    'Deportivo Alavés': 'Alavés',
    'Elche CF':         'Elche',
    'Rayo Vallecano':   'Rayo',
    'Valencia CF':      'Valencia'
  };

  function buildLigaClas(){
    var list = collectStandings();
    var el = document.getElementById('clas-liga-content');
    if(!el) return;

  var html = ''
      + '<div class="clas-legend">'
      +   '<span class="clas-legend-item"><span class="clas-legend-dot" style="background:#3160ff"></span>🔵 Champions</span>'
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
        +     '<span class="clas-team-name">' + (SHORT_NAMES[team.name] || team.name) + '</span>'
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



(function(){
  var SCREEN_TEAM_FALLBACK = {
    's-athletic': 'Athletic Club',
    's-betis': 'Real Betis',
    's-sociedad': 'Real Sociedad',
    's-madrid': 'Real Madrid',
    's-barca': 'FC Barcelona',
    's-atletico': 'Atlético Madrid',
    's-albacete': 'Albacete BP',
    's-villarreal': 'Villarreal CF',
    's-sevilla': 'Sevilla FC',
    's-espanyol': 'Espanyol',
    's-getafe': 'Getafe CF',
    'celta-screen': 'RC Celta',
    'osasuna-screen': 'CA Osasuna',
    'alaves-screen': 'Deportivo Alavés',
    'girona-screen': 'Girona FC',
    'oviedo-screen': 'Real Oviedo',
    'levante-screen': 'Levante UD',
    'mallorca-screen': 'RCD Mallorca',
    'elche-screen': 'Elche CF',
    'valencia-screen': 'Valencia CF',
    'rayo-screen': 'Rayo Vallecano'
  };

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
    'rc celta':'RC Celta',
    'celta de vigo':'RC Celta',
    'celta':'RC Celta',
    'ca osasuna':'CA Osasuna',
    'osasuna':'CA Osasuna',
    'deportivo alaves':'Deportivo Alavés',
    'deportivo alavés':'Deportivo Alavés',
    'd alaves':'Deportivo Alavés',
    'd alavés':'Deportivo Alavés',
    'girona':'Girona FC',
    'girona fc':'Girona FC',
    'real oviedo':'Real Oviedo',
    'r oviedo':'Real Oviedo',
    'levante ud':'Levante UD',
    'rcd mallorca':'RCD Mallorca',
    'mallorca':'RCD Mallorca',
    'elche':'Elche CF',
    'elche cf':'Elche CF',
    'valencia':'Valencia CF',
    'valencia cf':'Valencia CF',
    'rayo vallecano':'Rayo Vallecano'
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
    { key:'pen-prov',    title:'Penaltis provocados',   icon:'🤦‍♂️', top:6 },
    { key:'pen-gol',     title:'Goles de penalti',      icon:'🥅', top:6 },
    { key:'pen-fallado', title:'Penaltis fallados',     icon:'❌️', top:6 },
    { key:'pen-parado',  title:'Penaltis parados',      icon:'🖐', top:6 },
    { key:'falta-gol',   title:'Goles de falta',        icon:'🎯', top:6 },
    { key:'propia',      title:'Autogoles',             icon:'🚫', top:6 },
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
    return TEAM_ALIASES[key] || String(name || '').trim();
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
        setLigaStat(row, 'yel', 1);
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
      if(ico === '🤦' || ico === '🤦‍♂' || ico === '🤦‍♂️') return 'pen-prov';
      if(ico === '🥅') return 'pen-gol';
      if(ico === '❌' || ico === '❌️') return 'pen-fallo';
      if(ico === '🖐') return 'pen-parado';
      if(ico === '🎯') return 'falta-gol';
      if(ico === '🚫') return 'propia';
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

      if(data.mvpName && data.mvpTeam){
        applyEventToRoster(roster, data.mvpTeam, data.mvpName, 'mvp', '⭐');
      }
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


function go(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); var el = document.getElementById(id); if (el) { el.classList.add('active'); window.scrollTo(0,0); } } function entTog(id) { var body = document.getElementById(id); var arr = document.getElementById(id + '-arr'); if (!body) return; var isOpen = body.classList.contains('open'); body.classList.toggle('open'); if (arr) arr.classList.toggle('open', !isOpen); } function subTog(id) { var body = document.getElementById(id); var arr = document.getElementById(id + '-arr'); if (!body) return; body.classList.toggle('open'); if (arr) arr.classList.toggle('open'); } function derbyTog(id) { var body = document.getElementById(id); var arr = document.getElementById(id + '-arr'); var btn = document.getElementById(id + '-btn'); if (!body) return; body.classList.toggle('open'); if (arr) arr.classList.toggle('open'); if (btn) btn.classList.toggle('open'); } var athPrevSuperado = false; function athObjCount() { var items = document.querySelectorAll('#ath-obj-club .obj-item'); var total = items.length; var done = 0; items.forEach(function(lbl) { var cb = lbl.querySelector('input[type=checkbox]'); if (cb && cb.checked) { done++; lbl.classList.add('done'); } else { lbl.classList.remove('done'); } }); var countEl = document.getElementById('ath-obj-count'); if (countEl) countEl.textContent = done + ' / ' + total; var PTS_POR_OBJ = 0.40; var MONEY_POR_OBJ = 40; var MAX_PTS = 7.00; var MAX_MONEY = 750; var pts = parseFloat((done * PTS_POR_OBJ).toFixed(2)); var money = done * MONEY_POR_OBJ; var pctPts = Math.min(100, (pts / MAX_PTS) * 100); var pctMoney = Math.min(100, (money / MAX_MONEY) * 100); var superadoPts = pts >= MAX_PTS; var superadoMoney = money >= MAX_MONEY; var superadoAmbos = superadoPts && superadoMoney; var ptsEl = document.getElementById('ath-pts-val'); var moneyEl = document.getElementById('ath-money-val'); if (ptsEl) { ptsEl.textContent = pts.toFixed(2); ptsEl.classList.remove('pulse'); void ptsEl.offsetWidth; ptsEl.classList.add('pulse'); ptsEl.classList.toggle('superado', superadoPts); } if (moneyEl) { moneyEl.textContent = money; moneyEl.classList.remove('pulse'); void moneyEl.offsetWidth; moneyEl.classList.add('pulse'); moneyEl.classList.toggle('superado', superadoMoney); } var tPts = document.getElementById('ath-pts-target'); var tMoney = document.getElementById('ath-money-target'); if (tPts) tPts.classList.toggle('superado', superadoPts); if (tMoney) tMoney.classList.toggle('superado', superadoMoney); var barPts = document.getElementById('ath-bar-pts'); var barMoney = document.getElementById('ath-bar-money'); if (barPts) { barPts.style.width = pctPts + '%'; barPts.classList.toggle('superado', superadoPts); } if (barMoney) { barMoney.style.width = pctMoney + '%'; barMoney.classList.toggle('superado', superadoMoney); } if (superadoAmbos) { if (!athPrevSuperado) { athPrevSuperado = true; setTimeout(function() { if (typeof lanzarFuegos === 'function') lanzarFuegos(3500); }, 300); } else { setTimeout(function() { if (typeof lanzarFuegos === 'function') lanzarFuegos(2500); }, 150); } } else { athPrevSuperado = false; } } var athPlantComp = 'global'; function athSetComp(comp) { athPlantComp = comp; document.querySelectorAll('.plant-filter-btn').forEach(function(b) { b.classList.toggle('active', b.dataset.comp === comp); }); document.querySelectorAll('.plant-row').forEach(function(row) { var tipos = row.classList.contains('por') ? ['gol','yel','red','mvp','poder','pen-parado','pen-prov','pen-gol','falta-gol','propia'] : ['gol','yel','red','mvp','poder','pen-gol','pen-prov','pen-parado','falta-gol','propia']; var cols = row.querySelectorAll('.plant-stat'); tipos.forEach(function(tipo, i) { var el = row.querySelector('.ps-' + tipo); if (!el || !cols[i]) return; var v = parseInt(el.getAttribute('data-' + comp) || el.getAttribute('data-global') || '0'); cols[i].textContent = v; cols[i].className = 'plant-stat' + (v > 0 ? (' ' + tipo) : ' zero'); if (el) el.setAttribute('data-' + comp, v); }); var anyActive = Array.from(row.querySelectorAll('.plant-stat')).some(function(c){ return !c.classList.contains('zero'); }); row.classList.toggle('has-stat', anyActive); }); } function tog(id) { var el = document.getElementById(id); if (!el) return; if (id === 'comp-box') { var isOpen = el.style.display !== 'none' && el.style.display !== ''; el.style.display = isOpen ? 'none' : 'block'; var arr = document.getElementById('comp-arr'); if (arr) arr.style.transform = isOpen ? '' : 'rotate(180deg)'; } else { el.classList.toggle('open'); } }


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

window.addEventListener('scroll',function(){ var b=document.getElementById('goto-top'); if(window.scrollY>300)b.classList.add('show'); else b.classList.remove('show'); }); var _origGo=window.go; window.go=function(id){ if(_origGo)_origGo(id); else{document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');}); var el=document.getElementById(id);if(el)el.classList.add('active');} if(id==='s-liga-clas' && typeof window.buildLigaClas==='function'){ window.buildLigaClas(); } if(id==='s-liga-stats' && typeof window.buildLigaStatsDashboard==='function'){ window.buildLigaStatsDashboard(); } setTimeout(function(){window.scrollTo({top:0,behavior:'smooth'});},50); };

function showChampionsIntro() { var overlay = document.getElementById('ucl-intro'); if (!overlay) return; overlay.classList.add('show'); setTimeout(function(){ overlay.classList.remove('show'); }, 1300); } var _origGoChamp = window.go; window.go = function(id) { if (id === 's-champions') { showChampionsIntro(); } if (_origGoChamp) _origGoChamp(id); else { document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');}); var el = document.getElementById(id); if(el) el.classList.add('active'); } setTimeout(function(){window.scrollTo({top:0,behavior:'smooth'});},50); };

var _compSoundMap = { 's-champions': { snd:'snd-ucl', flash:'flash-ucl' }, 's-superliga': { snd:'snd-kdb', flash:'flash-kdb' } }; var _lastCompScreen = null; function playCompSound(targetId) { var cfg = _compSoundMap[targetId]; if (!cfg) return; var snd = document.getElementById(cfg.snd); if (snd) { snd.currentTime = 0; snd.play().catch(function(){}); } var fl = document.getElementById('comp-flash'); if (fl) { fl.className = ''; fl.style.display = 'block'; fl.offsetWidth; fl.className = cfg.flash; setTimeout(function(){ fl.style.display='none'; fl.className=''; }, 950); } } function goWithSound(id, sndKey) { var fromId = _lastCompScreen; _lastCompScreen = id; if (fromId !== id) { var cfg = _compSoundMap[id]; if (cfg) playCompSound(id); } go(id); } var _prevGoFn = window.go; window.go = function(id) { var prev = _lastCompScreen; if (_compSoundMap[id]) { if (prev !== id) { playCompSound(id); } } _lastCompScreen = id; if (_prevGoFn) _prevGoFn(id); else { document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');}); var el=document.getElementById(id); if(el)el.classList.add('active'); } };


(function(){
  var LIGA_TEAMS_EQ = [
    {name:"Real Madrid",     ico:"⚪",  screen:"s-madrid"},
    {name:"FC Barcelona",    ico:"🔵",  screen:"s-barca"},
    {name:"Athletic Club",   ico:"🔴",  screen:"s-athletic"},
    {name:"Atlético Madrid", ico:"🔴",  screen:"s-atletico"},
    {name:"Real Betis",      ico:"🟢",  screen:"s-betis"},
    {name:"Real Sociedad",   ico:"🔵",  screen:"s-sociedad"},
    {name:"Sevilla FC",      ico:"⚪",  screen:"s-sevilla"},
    {name:"Villarreal CF",   ico:"🟡",  screen:"s-villarreal"},
    {name:"Getafe CF",       ico:"🔵",  screen:"s-getafe"},
    {name:"Osasuna",         ico:"🔴",  screen:"osasuna-screen"},
    {name:"Valencia CF",     ico:"🦇",  screen:"valencia-screen"},
    {name:"Celta de Vigo",   ico:"🔵",  screen:"celta-screen"},
    {name:"Mallorca",        ico:"🔴",  screen:"mallorca-screen"},
    {name:"Girona FC",       ico:"🔴",  screen:"girona-screen"},
    {name:"Espanyol",        ico:"🔵",  screen:"s-espanyol"},
    {name:"Deportivo Alavés",ico:"🔵",  screen:"alaves-screen"},
    {name:"Rayo Vallecano",  ico:"⚪",  screen:"rayo-screen"},
    {name:"Levante UD",      ico:"🔴",  screen:"levante-screen"},
    {name:"Elche CF",        ico:"🟢",  screen:"elche-screen"},
    {name:"Córdoba CF",      ico:"🔴",  screen:null},
    {name:"Real Oviedo",     ico:"🔵",  screen:"oviedo-screen"},
    {name:"Albacete BP",     ico:"🟡",  screen:"s-albacete"}
  ];

  var grid = document.getElementById('equipos-grid');
  LIGA_TEAMS_EQ.forEach(function(t){
    var card = document.createElement('div');
    card.className = 'eq-ov-card';
    if(t.screen){
      card.style.borderColor = 'rgba(240,192,64,.2)';
    }
    card.innerHTML = '<span class="eq-ov-ico">'+t.ico+'</span>'
      + '<span class="eq-ov-name">'+t.name+(t.screen?'<br><span style="font-size:9px;color:rgba(240,192,64,.6);letter-spacing:2px;">VER PLANTILLA ▶</span>':'')+'</span>';
    card.onclick = function(){
      document.getElementById('equipos-overlay').classList.remove('show');
      if(t.screen && typeof go === 'function') go(t.screen);
    };
    grid.appendChild(card);
  });
})();



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
         └ 🥅 Gol del penalti     → 70% de los penaltis tirados
         └ 🖐 Parado por portero  → 20% de los penaltis fallados
         └ ❌ Fallado             → 10% de los penaltis fallados
     🎯  Gol de falta             →  8% de los partidos
     🚫  Autogol                  →  8% de los partidos

     ── PUNTUACIÓN MVP ──────────────────────────────────────────────
     ⚽  Gol normal        → 3 pts
     🎯  Gol de falta      → 4 pts
     🥅  Penalti gol       → 2 pts
     🖐  Penalti parado    → 3 pts
     🚫  Autogol           → -1 pt (penaliza al que lo mete)
     🏆  Gol decisivo      → +2 pts extra
     Hat-trick o más: se muestra en acta → Mbappé (3⚽)
     Sin goles/paradas: MVP aleatorio de campo del equipo ganador.
  ────────────────────────────────────────────────────────────────── */

  window.mlSimEngine = function(cfg) {
    var TEAM_A  = cfg.teamA;
    var TEAM_B  = cfg.teamB;
    var sqA     = cfg.sqA;
    var sqB     = cfg.sqB;
    var matchKey= cfg.matchKey;
    var btn     = document.getElementById(cfg.btnId);
    var list    = document.getElementById(cfg.listId);

    if (!btn || !list) return;
    btn.textContent = "0'"; btn.className = 'ml-timer running';

    // ── helpers ──────────────────────────────────────────────────────
    // ── PODER BASADO EN RATINGS REALES ─────────────────────────────
    var rA = window.TEAM_RATINGS ? (window.TEAM_RATINGS[TEAM_A] || 76) : 76;
    var rB = window.TEAM_RATINGS ? (window.TEAM_RATINGS[TEAM_B] || 76) : 76;
    // También calcular poder medio de la plantilla si no hay rating global
    if (!window.TEAM_RATINGS || !window.TEAM_RATINGS[TEAM_A]) {
      var sumA=0,cntA=0; sqA.forEach(function(p){if(p[3]&&p[2]!=='P'){sumA+=p[3];cntA++;}});
      if(cntA>0) rA=Math.round(sumA/cntA);
    }
    if (!window.TEAM_RATINGS || !window.TEAM_RATINGS[TEAM_B]) {
      var sumB=0,cntB=0; sqB.forEach(function(p){if(p[3]&&p[2]!=='P'){sumB+=p[3];cntB++;}});
      if(cntB>0) rB=Math.round(sumB/cntB);
    }
    // probA = probabilidad de que marque equipo A en cada evento de gol
    var probA = rA / (rA + rB);
    function rndSq(sq){
      var hasW=sq.some(function(p){return p[3]!==undefined;});
      if(!hasW) return sq[Math.floor(Math.random()*sq.length)];
      var tot=sq.reduce(function(s,p){return s+(p[3]||30);},0);
      var r=Math.random()*tot; var c=0;
      for(var wi=0;wi<sq.length;wi++){c+=(sq[wi][3]||30);if(r<c)return sq[wi];}
      return sq[sq.length-1];
    }
    function rndSqNonGK(sq){var f=sq.filter(function(p){return p[2]!=='P';});if(!f.length)return rndSq(sq);var hasW=f.some(function(p){return p[3]!==undefined;});if(!hasW)return f[Math.floor(Math.random()*f.length)];var tot=f.reduce(function(s,p){return s+(p[3]||30);},0);var r=Math.random()*tot;var c=0;for(var wi=0;wi<f.length;wi++){c+=(f[wi][3]||30);if(r<c)return f[wi];}return f[f.length-1];}
    function rndGK(sq){var g=sq.filter(function(p){return p[2]==='P';});return g.length?g[0]:rndSq(sq);}
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
      var ct=rndTeam(); var csq=ct==='a'?sqA:sqB; var cp=rndSqNonGK(csq);
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
      evts.push({min:pen_min,ico:'🤦',team:foul_t,player:foul_p,type:'pen-prov'});
      // Resultado del penalti: equipo RIVAL (prov_t) tira
      var pen_kick_min = rndMinAfter(pen_min);
      var pr=Math.random();
      if(pr<0.70){
        // 🥅 Gol — suma al equipo que tira (prov_t)
        if(prov_t==='a')sa++;else sb++;
        evts.push({min:pen_kick_min,ico:'🥅',team:prov_t,player:kick_p,type:'pen-gol'});
      } else if(pr<0.90){
        // 🖐 Parado por portero del equipo que cometió la falta (foul_t)
        var gk=rndGK(foul_t==='a'?sqA:sqB);
        evts.push({min:pen_kick_min,ico:'🖐',team:foul_t,player:gk,type:'pen-parado'});
      } else {
        // ❌ Fuera/poste — lo tira el equipo rival (prov_t)
        evts.push({min:pen_kick_min,ico:'❌',team:prov_t,player:kick_p,type:'pen-fallo'});
      }
    }

    // ── GOL DE FALTA (8%) ────────────────────────────────────────────
    if(Math.random()<0.08){
      var fgt=rndTeam(); var fgsq=fgt==='a'?sqA:sqB; var fgp=rndSqNonGK(fgsq);
      if(fgt==='a')sa++;else sb++;
      evts.push({min:rndMin(),ico:'🎯',team:fgt,player:fgp,type:'falta-gol'});
    }

    // ── AUTOGOL (8%) ─────────────────────────────────────────────────
    if(Math.random()<0.08){
      var agt=rndTeam(); var agsq=agt==='a'?sqA:sqB; var agp=rndSqNonGK(agsq);
      if(agt==='a')sb++;else sa++;
      evts.push({min:rndMin(),ico:'🚫',team:agt,player:agp,type:'propia'});
    }

    // ── GOLES NORMALES (0-5) ─────────────────────────────────────────
    var _maxGoals = (rA >= 88 || rB >= 88) ? 7 : (rA >= 84 || rB >= 84) ? 6 : 5;
    var numGoals=Math.floor(Math.random()*(_maxGoals+1));
    for(var i=0;i<numGoals;i++){
      var gt=rndTeam(); var gsq=gt==='a'?sqA:sqB; var gp=rndSqNonGK(gsq);
      if(gt==='a')sa++;else sb++;
      evts.push({min:rndMin(),ico:'⚽',team:gt,player:gp,type:'gol'});
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

    // ── SUSTITUCIONES (2-4, desde el min 55) ─────────────────────────
    var numSubs=Math.floor(Math.random()*3)+2;
    for(var s=0;s<numSubs;s++){
      var smin=55+Math.floor(Math.random()*30);
      var st=Math.random()<0.5?'a':'b';
      var ssq=st==='a'?sqA:sqB;
      var si1=Math.floor(Math.random()*ssq.length);
      var si2; do{si2=Math.floor(Math.random()*ssq.length);}while(si2===si1);
      evts.push({min:smin,ico:'🔄',team:st,playerOut:ssq[si1],playerIn:ssq[si2],type:'sub'});
    }

    evts.sort(function(a,b){return a.min-b.min;});

    // ── MVP ───────────────────────────────────────────────────────────
    // Sistema de puntuación:
    //   ⚽ gol=3 | 🎯 falta-gol=4 | 🥅 pen-gol=2 | 🖐 pen-parado=3 | 🚫 propia=-1
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
    var msPerMinFH=15000/ht45;
    var msPerMinSH=15000/(ft90-45);
    list.innerHTML='';

    var _tick=0;
    var _tickInterval=setInterval(function(){
      _tick++;
      if(_tick<=15){
        var dm=Math.round(_tick*ht45/15); if(dm>ht45)dm=ht45;
        btn.textContent=(_tick<15?dm:ht45+'+'+extraA)+"'";
      } else if(_tick<=30){
        var t2=_tick-15; var dm2=45+Math.round(t2*(ft90-45)/15); if(dm2>ft90)dm2=ft90;
        btn.textContent=(dm2<=90?dm2:'90+'+extraB)+"'";
      }
      if(_tick>=30)clearInterval(_tickInterval);
    },1000);

    function renderEvtEl(ev){
      if(ev.type==='ht'||ev.type==='sub')return;
      var d=document.createElement('div'); d.className='ml-evt-item';
      var teamName=ev.team==='a'?TEAM_A:TEAM_B;
      d.innerHTML='<span class="ml-evt-min">'+ev.min+"'</span>"
        +'<span class="ml-evt-ico">'+ev.ico+'</span>'
        +'<span class="ml-evt-name">'+ev.player[1]+'</span>'
        +'<span class="ml-evt-team">'+teamName+'</span>';
      list.appendChild(d);
    }

    evts.forEach(function(ev){
      var ms;
      if(ev.type==='ht'){ms=15000;}
      else if(ev.min<=ht45){ms=Math.round(ev.min*msPerMinFH);}
      else{ms=15000+Math.round((ev.min-45)*msPerMinSH);}
      ms=Math.min(ms,29500);
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
    });

    // Descanso
    setTimeout(function(){
      btn.textContent=ht45+"'+"; btn.className='ml-timer';
    },15000);

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
      // Conteo tarjetas/MVP para clasificación
      var _ta_a=evts.filter(function(e){return e.team==='a'&&(e.ico==='🟨'||e.ico==='🟨🟥');}).length;
      var _tr_a=evts.filter(function(e){return e.team==='a'&&(e.ico==='🟥'||e.ico==='🟨🟥');}).length;
      var _ta_b=evts.filter(function(e){return e.team==='b'&&(e.ico==='🟨'||e.ico==='🟨🟥');}).length;
      var _tr_b=evts.filter(function(e){return e.team==='b'&&(e.ico==='🟥'||e.ico==='🟨🟥');}).length;
      var _mvp_a=mvpTeam===TEAM_A?1:0;
      var _mvp_b=mvpTeam===TEAM_B?1:0;
      if(typeof window.registrarResultadoLiga==='function')
        window.registrarResultadoLiga(matchKey,TEAM_A,TEAM_B,sa,sb,_ta_a,_tr_a,_ta_b,_tr_b,_mvp_a,_mvp_b);
      if(typeof window.registrarLigaPlayerStats==='function')
        window.registrarLigaPlayerStats(matchKey,TEAM_A,TEAM_B,evts,mvpName,mvpTeam);
      list.appendChild(r);
      if(typeof cfg.onEnd==='function') cfg.onEnd(sa,sb,evts,mvpName,mvpTeam);
    },30000);
  };

})();



function actaTog(matchKey) {
  var toggle = document.getElementById('acta-toggle-' + matchKey);
  var body   = document.getElementById('acta-body-'   + matchKey);
  if (!toggle || !body) return;
  var open = body.classList.contains('open');
  body.classList.toggle('open', !open);
  toggle.classList.toggle('open', !open);
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



// --- FIX v6: collect stats from all acta events (manual + simulated) ---
(function(){
const ICON_MAP = {
"⚽":"gol",
"🟨":"amarilla",
"🟥":"roja",
"🤦‍♂️":"pen-prov",
"🥅":"pen-gol",
"❌":"pen-fallado",
"🖐":"pen-parado",
"🎯":"falta-gol",
"🚫":"autogol",
"⭐":"mvp"
};

function normal(n){
 return (n||"").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"").trim();
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
    'rc celta':'RC Celta',
    'celta de vigo':'RC Celta',
    'celta':'RC Celta',
    'ca osasuna':'CA Osasuna',
    'osasuna':'CA Osasuna',
    'deportivo alaves':'Deportivo Alavés',
    'deportivo alavés':'Deportivo Alavés',
    'girona':'Girona FC',
    'girona fc':'Girona FC',
    'real oviedo':'Real Oviedo',
    'levante ud':'Levante UD',
    'rcd mallorca':'RCD Mallorca',
    'mallorca':'RCD Mallorca',
    'elche':'Elche CF',
    'elche cf':'Elche CF',
    'valencia':'Valencia CF',
    'valencia cf':'Valencia CF',
    'rayo vallecano':'Rayo Vallecano'
  };

  var SCREEN_TEAM_FALLBACK = {
    's-athletic': 'Athletic Club',
    's-betis': 'Real Betis',
    's-sociedad': 'Real Sociedad',
    's-madrid': 'Real Madrid',
    's-barca': 'FC Barcelona',
    's-atletico': 'Atlético Madrid',
    's-albacete': 'Albacete BP',
    's-villarreal': 'Villarreal CF',
    's-sevilla': 'Sevilla FC',
    's-espanyol': 'Espanyol',
    's-getafe': 'Getafe CF',
    'celta-screen': 'RC Celta',
    'osasuna-screen': 'CA Osasuna',
    'alaves-screen': 'Deportivo Alavés',
    'girona-screen': 'Girona FC',
    'oviedo-screen': 'Real Oviedo',
    'levante-screen': 'Levante UD',
    'mallorca-screen': 'RCD Mallorca',
    'elche-screen': 'Elche CF',
    'valencia-screen': 'Valencia CF',
    'rayo-screen': 'Rayo Vallecano'
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
    return TEAM_ALIASES[key] || String(name || '').trim();
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
    if(ico === '🤦' || ico === '🤦‍♂' || ico === '🤦‍♂️') return 'pen-prov';
    if(ico === '🥅') return 'pen-gol';
    if(ico === '❌') return 'pen-fallado';
    if(ico === '🖐') return 'pen-parado';
    if(ico === '🎯') return 'falta-gol';
    if(ico === '🚫') return 'propia';
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
      if(data.mvpName && data.mvpTeam){
        applyEvent(index, data.mvpTeam, { type:'mvp', ico:'⭐', player:['', data.mvpName] });
      }
    });

    extractDomFallbackEvents().forEach(function(x){
      if(x.matchKey && done[x.matchKey]) return;
      applyEvent(index, x.teamName, x.ev);
    });

    if(typeof window.buildLigaStatsDashboard === 'function') window.buildLigaStatsDashboard();
  }

  window.rebuildLigaPlayerStatsFixed = rebuildLigaPlayerStatsFixed;

  var originalRegistrar = window.registrarLigaPlayerStats;
  if(typeof originalRegistrar === 'function'){
    window.registrarLigaPlayerStats = function(){
      var res = originalRegistrar.apply(this, arguments);
      try { rebuildLigaPlayerStatsFixed(); } catch(e) {}
      return res;
    };
  }

  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(rebuildLigaPlayerStatsFixed, 50);
  });

  var _origGo2 = window.go;
  if(typeof _origGo2 === 'function'){
    window.go = function(id){
      var res = _origGo2.apply(this, arguments);
      if(id === 's-liga-stats') setTimeout(rebuildLigaPlayerStatsFixed, 0);
      return res;
    };
  }
})();
