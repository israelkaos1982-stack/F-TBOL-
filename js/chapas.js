/* ============================================================
   chapas.js — Escudos de TODOS los clubes IA (2026-11-08)
   ------------------------------------------------------------
   Petición usuario: se borran todos los escudos anteriores de los
   equipos IA y se sustituyen por "chapas" exactamente como las
   láminas de referencia (siglas + colores + dibujo), sin imágenes:
   cada club ocupa ~40 bytes. Los 5 humanos (Liverpool, Real Madrid,
   Atlético Madrid, FC Barcelona, PSG) conservan su escudo real (crest)
   y las selecciones su bandera — este archivo NO los toca.

   Formato de cada línea:  Nombre|SIG|dibujo|c1|c2|texto|placa
     dibujo:
       s  liso c1 (c2 ignorado)
       h  fondo c1 + franja horizontal central c2
       v  rayas verticales c1/c2
       m  mitad izquierda c1 / derecha c2
       d  fondo c1 + banda diagonal c2 (esquina sup-izq e inf-der)
     texto: color de las siglas
     placa: (opcional) rectángulo redondeado detrás de las siglas
   ============================================================ */
(function () {
  "use strict";

  var DATOS = [
    // ---- LIGA DE ISRAEL ----
    "Beitar Jerusalén|BEI|s|#FFE000||#1a1a1a",
    "Hapoel Beer Sheva|HBS|s|#D0202E||#fff",
    "Hapoel Tel Aviv|HTA|s|#E8141E||#fff",
    "Maccabi Tel Aviv|MTA|s|#1F2550||#F0B800",
    "Maccabi Haifa|MHA|s|#0E6B3A||#fff",
    "Maccabi Netanya|MNE|v|#F5D000|#111111|#F5D000|#111111",
    "Hapoel Kiryat Shmona|IKS|m|#1A0F5C|#FFFFFF|#fff|#1A0F5C",
    "Hapoel Haifa|HHF|m|#D81E2C|#1F4A8A|#fff|#1F4A8A",
    "Ironi Tiberias|TIB|h|#1F4F8A|#FFFFFF|#1F4F8A",
    "Bnei Sakhnin|SAK|h|#FFFFFF|#D9232A|#fff",
    "Hapoel Petah Tikva|HPT|h|#263D80|#FFFFFF|#263D80",
    "Maccabi Petah Tikva|MPT|d|#FFFFFF|#1C2E55|#1C2E55",
    "Hapoel Jerusalén|HJE|v|#D8202A|#222222|#fff|#222222",
    "Hapoel Ramat Gan|HRG|s|#D8202A||#fff",
    // ---- LIGA DE SAN MARINO ----
    "Cailungo|CAI|m|#0E8A5F|#C0101A|#fff|#0E8A5F",
    "Cosmos|COS|s|#255A30||#E8F030",
    "Domagnano|DOM|s|#FFF000||#111",
    "Faetano|FAE|m|#FFE000|#2A4AA8|#2A4AA8|#FFE000",
    "Fiorentino|FIO|v|#3A65B5|#D8202A|#fff|#3A65B5",
    "Folgore|FOL|v|#FFF000|#111111|#111|#FFF000",
    "Juvenes-Dogana|JUV|h|#0D57A8|#FFFFFF|#0D57A8",
    "La Fiorita|LAF|s|#0D3F8A||#FFD400",
    "Libertas|LIB|h|#14A0E0|#F08000|#111",
    "Murata|MUR|s|#FFFFFF||#111",
    "Pennarossa|PER|m|#E02020|#FFFFFF|#111|#FFFFFF",
    "San Giovanni|SGI|v|#E0202A|#222222|#fff|#222222",
    "San Marino Academy|SMA|m|#3330A0|#20C0F0|#fff|#3330A0",
    "Tre Fiori|TRF|s|#23305E||#FFC820",
    "Tre Penne|TRP|h|#3AA0E0|#FFFFFF|#111",
    "Virtus|VIR|d|#108A20|#FFFFFF|#fff",
    // ---- LIGA DE ANDORRA ----
    "Atlètic Escaldes|ATL|s|#0D6AD0||#fff",
    "Carroi|CAR|v|#6A3570|#FFFFFF|#fff|#6A3570",
    "Casa de Portugal|CDP|m|#0F5A2A|#D01010|#fff|#0F5A2A",
    "Esperança|ESP|d|#0D0D0D|#FFFFFF|#fff",
    "FC Rangers|RAN|s|#1A2558||#FFE020",
    "Inter Escaldes|INT|v|#1565C0|#333333|#fff|#333333",
    "Ordino|ORD|h|#0D4FA0|#FFFFFF|#0D4FA0",
    "Penya Encarnada|PEN|s|#2A2A2A||#F0A818",
    "Santa Coloma|SCO|m|#3530A0|#F5E020|#F5E020|#3530A0",
    "Sporting Escaldes|SPO|h|#2F9A50|#FFFFFF|#111",
    // ---- LIGA DE GIBRALTAR ----
    "College 1975|COL|s|#2A5AAA||#fff",
    "Europa FC|EUR|v|#4AAA4A|#222222|#fff|#222222",
    "Europa Point|EUP|h|#34348F|#FFFFFF|#2C2C90",
    "FCB Magpies|MAG|m|#111111|#FFFFFF|#fff|#111111",
    "Glacis United|GLA|s|#8A2A80||#fff",
    "Hound Dogs|HOU|s|#CFE8C8||#111",
    "Lincoln Red Imps|LIN|v|#E02020|#111111|#fff|#111111",
    "Lions Gibraltar|LIO|m|#E84A2A|#FFFFFF|#111|#FFFFFF",
    "Lynx|LYN|s|#F5E020||#222",
    "Mons Calpe|MON|d|#E02A30|#222222|#fff|#222222",
    "St. Joseph's|SJO|s|#2A4A9A||#fff",
    // ---- LIGA DE GALES ----
    "Airbus UK|AIR|s|#0A70B8||#fff",
    "Ammanford|AMM|m|#111111|#FFFFFF|#fff|#111111",
    "Barry Town|BAR|h|#E2CFA0|#3A78C0|#111|#E2CFA0",
    "Briton Ferry|BRI|s|#C0202A||#fff",
    "Caernarfon Town|CAE|m|#F8D010|#127530|#127530|#F8D010",
    "Cambrian United|CAM|s|#2C4A68||#A0D0F0",
    "Cardiff Met|MET|s|#C03530||#fff",
    "Colwyn Bay|COL|v|#A0D4F0|#A8153A|#A8153A|#A0D4F0",
    "Connah's Quay|CON|d|#C82020|#FFFFFF|#fff",
    "Flint Town United|FLI|v|#FFFFFF|#111111|#fff|#111111",
    "Haverfordwest County|HAV|s|#2A6AB0||#fff",
    "Holywell Town|HOL|m|#E03A30|#FFFFFF|#111|#FFFFFF",
    "Llandudno|LLA|d|#222222|#8A8A8A|#fff",
    "Penybont|PEN|h|#1E1E5A|#FFFFFF|#1E1E5A",
    "The New Saints|TNS|h|#35A050|#FFFFFF|#111",
    "Trefelin BGC|TRE|v|#E0202A|#333333|#fff|#333333",
    // ---- LIGA DE ESTONIA ----
    "Flora|FLO|s|#0F9A4A||#fff",
    "Harju JK|HAR|m|#E03035|#FFFFFF|#333|#FFFFFF",
    "Kuressaare|KUR|s|#EBA530||#0D4FA0",
    "Levadia|LEV|v|#FFFFFF|#3AB06A|#222|#FFFFFF",
    "Nõmme Kalju|KAL|d|#0D0D0D|#FFFFFF|#fff",
    "Nõmme United|NOU|m|#111111|#8A1515|#D89A18|#111111",
    "Paide|PAI|v|#3A78C0|#D8202A|#fff|#3A78C0",
    "Pärnu JK Vaprus|VAP|s|#F5CC18||#111",
    "Tammeka|TAM|s|#1438D8||#fff",
    "Trans Narva|NAR|h|#0D68A8|#FFFFFF|#0D68A8",
    // ---- LIGA DE MONTENEGRO ----
    "Arsenal Tivat|ARS|s|#0D5EAA||#fff",
    "Bokelj|BOK|h|#0D55A0|#FFFFFF|#0D55A0",
    "Budućnost|BUD|v|#FFFFFF|#3A4A90|#fff|#3A4A90",
    "Dečić|DEC|m|#2A3A98|#FFFFFF|#fff|#2A3A98",
    "Jezero|JEZ|s|#34587E||#fff",
    "Mladost DG|MDG|s|#E52028||#FFD400",
    "Mornar|MOR|s|#5A3A88||#fff",
    "Otrant Ulcinj|OTR|h|#2A98C8|#FFFFFF|#111",
    "Petrovac|PET|m|#3A90D0|#FFFFFF|#222|#FFFFFF",
    "Sutjeska|SUT|d|#2A5AAA|#FFFFFF|#fff",
    // ---- LIGA DE ISLAS FEROE ----
    "AB Argir|ARG|s|#962035||#fff",
    "B36 Tórshavn|B36|v|#FFFFFF|#222222|#fff|#222222",
    "B68 Toftir|B68|m|#E03025|#222222|#fff|#222222",
    "EB/Streymur|EBS|h|#1A6AB0|#E8E8EA|#333",
    "HB Tórshavn|HBT|v|#E02A30|#333333|#fff|#333333",
    "KÍ Klaksvík|KIK|s|#2A3478||#fff",
    "NSÍ Runavík|NSI|m|#F8CC10|#222222|#222|#F8CC10",
    "Skála ÍF|SKA|s|#F09A30||#222",
    "Víkingur|VIK|s|#0D0D0D||#9ABCE0",
    // ---- LIGA DE MACEDONIA DEL NORTE ----
    "Arsimi 1973|ARS|m|#F5E020|#0D0D0D|#111|#F5E020",
    "Bashkimi|BAS|v|#4AAA4A|#333333|#fff|#333333",
    "Bregalnica Štip|BRE|h|#3AB0E0|#FFFFFF|#111",
    "FK Skopje|SKO|s|#182060||#fff",
    "Shkendija Haracine|SHH|v|#E0202A|#111111|#fff|#111111",
    "Shkëndija|SHK|m|#2A2A2A|#E03030|#fff|#2A2A2A",
    "Sileks|SIL|h|#1A2E90|#E81010|#fff|#1A2E90",
    "Struga|STR|d|#D02A3A|#FFFFFF|#fff",
    "Tikvesh|TIK|s|#E0102A||#fff",
    "Vardar|VAR|v|#C0202A|#1A1A1A|#FFD400|#1A1A1A",
    // ---- LIGA DE LUXEMBURGO ----
    "Differdange 03|DIF|v|#E0202A|#111111|#fff|#111111",
    "Etzella Ettelbruck|ETZ|h|#3A8AD0|#FFFFFF|#111",
    "F91 Dudelange|F91|s|#F8EA30||#111",
    "Jeunesse d'Esch|JEU|v|#FFFFFF|#111111|#fff|#111111",
    "Käerjéng 97|KAE|m|#2E2A80|#D8102A|#fff|#2E2A80",
    "Progrès Niederkorn|PRO|s|#1A2018||#FFE800",
    "Racing Union|RAC|m|#22308A|#FFFFFF|#fff|#22308A",
    "Résidence Walferdange|RES|h|#3A8AD0|#FFFFFF|#111",
    "Rumelange|RUM|s|#1A5AAA||#fff",
    "Swift Hesperange|SWI|d|#E8253F|#FFFFFF|#fff",
    "UN Atert Bissen|ATE|v|#F0E020|#111111|#111|#F0E020",
    "UNA Strassen|UNA|m|#E81018|#0D0D0D|#fff|#0D0D0D",
    "US Hostert|HOS|s|#1A3A2A||#fff",
    "US Mondorf|MON|h|#28C040|#FFFFFF|#111",
    "Victoria Rosport|ROS|s|#C8202A||#fff",
    "Wiltz 71|WIL|v|#E81018|#FFFFFF|#111|#FFFFFF",
    // ---- LIGA DE GEORGIA ----
    "Dila Gori|DIL|v|#3A3AA0|#D8202A|#fff|#3A3AA0",
    "Dinamo Batumi|DBA|h|#2E4AA0|#FFFFFF|#2E4AA0",
    "Dinamo Tiflis|DTI|s|#14244E||#fff",
    "Gagra|GAG|s|#1A2E58||#fff",
    "Iberia 1999|IBE|s|#D0183A||#fff",
    "Meshakhte|MES|s|#1A1A1A||#F5D888",
    "Rustavi|RUS|s|#E82A25||#fff",
    "Samgurali|SAM|h|#4AAA5A|#FFFFFF|#222",
    "Spaeri|SPA|m|#0D1A40|#3A70F0|#F0D850|#0D1A40",
    "Torpedo Kutaisi|TKU|s|#0D0D0D||#fff",
    // ---- LIGA DE BIELORRUSIA ----
    "Arsenal Dzyarzhynsk|ARS|s|#E81818||#fff",
    "Baranovichi|BAR|m|#3A48A0|#E0303A|#fff|#3A48A0",
    "BATE Borisov|BAT|s|#FFE000||#1030A0",
    "Belshina|BEL|d|#C8202A|#222222|#fff",
    "Dinamo Brest|DBR|s|#1A3A68||#fff",
    "Dinamo Minsk|DMI|h|#1A62B0|#FFFFFF|#1A62B0",
    "Dnepr Mogilev|DNE|s|#183080||#fff",
    "Gomel|GOM|m|#129A40|#FFFFFF|#111|#FFFFFF",
    "Isloch|ISL|d|#2A2A2A|#8A8A8A|#fff",
    "Maxline Vitebsk|MAX|s|#142810||#FFFF10",
    "Minsk|MIN|m|#1A1A4E|#D0102A|#fff|#1A1A4E",
    "Naftan|NAF|v|#1A7AC0|#FFFFFF|#fff|#1A7AC0",
    "Neman Grodno|NEM|m|#1A9A30|#F5D010|#111|#F5D010",
    "Slavia Mozyr|SLA|v|#D8202A|#222222|#fff|#222222",
    "Torpedo-BelAZ|TOR|s|#1A1A1A||#fff",
    "Vitebsk|VIT|s|#2A4AA8||#fff",
    // ---- LIGA DE IRLANDA DEL NORTE ----
    "Ballymena United|BAL|h|#6AB4E8|#FFFFFF|#111",
    "Bangor|BAN|m|#1A70B8|#F5E010|#F5E010|#1A70B8",
    "Carrick Rangers|CAR|s|#2A2A2A||#F8B040",
    "Cliftonville|CLI|s|#EE1010||#111|#FFFFFF",
    "Coleraine|COL|h|#2E40A0|#FFFFFF|#2E40A0",
    "Crusaders|CRU|v|#E03035|#111111|#fff|#111111",
    "Dungannon Swifts|DUN|m|#2E45A8|#F5B820|#F5B820|#2E45A8",
    "Glentoran|GLE|d|#225A20|#B01A1A|#fff",
    "Larne|LAR|s|#D8202A||#fff",
    "Limavady United|LIM|m|#0D1478|#FFFFFF|#fff|#0D1478",
    "Linfield|LIN|h|#4A98D8|#F8E820|#111",
    "Portadown|POR|v|#D8102A|#FFFFFF|#fff|#D8102A",
    // ---- LIGA DE MALTA ----
    "Balzan|BAL|m|#EE2A20|#FFFFFF|#111|#FFFFFF",
    "Birkirkara|BIR|v|#FFE000|#D8202A|#111|#FFE000",
    "Birzebbuga St. Peters|BSP|s|#2A3A80||#fff",
    "Floriana|FLO|v|#12A050|#F5E030|#111|#F5E030",
    "Gzira United|GZI|v|#9AD4F0|#8A1515|#8A1515|#9AD4F0",
    "Hamrun Spartans|HAM|v|#E03040|#111111|#fff|#111111",
    "Hibernians|HIB|m|#0D0D0D|#FFFFFF|#fff|#111111",
    "Marsaxlokk|MAR|h|#3A50A8|#F0C850|#2E45A8",
    "Mosta|MOS|v|#FFFFFF|#0D4AA0|#fff|#0D4AA0",
    "Sliema Wanderers|SLI|v|#6AB8E8|#2E3080|#2E3080|#6AB8E8",
    "Valletta|VAL|s|#C8202A||#F0C818",
    "Zabbar St. Patrick|ZAB|v|#FFF000|#111111|#111|#FFF000",
    // ---- LIGA DE LIECHTENSTEIN ----
    "Balzers|BAL|s|#2E3478||#FFD000",
    "Eschen/Mauren|ESM|h|#0D70B8|#FFFFFF|#0D70B8",
    "Gambarogno-Contone|GAC|v|#E81010|#111111|#fff|#111111",
    "Ruggell|RUG|m|#2AAA5A|#FFFFFF|#111|#FFFFFF",
    "Schaan|SCH|h|#1A80C0|#F8D010|#111",
    "Triesen|TRI|s|#1414A0||#fff",
    "Triesenberg|TRB|s|#2A2A78||#FFF010",
    "Vaduz|VAD|d|#E01A3A|#FFFFFF|#fff",
    "Malcantone|MAL|m|#0D0D0D|#E81A3A|#fff|#111111",
    "Seefeld|SEE|s|#FFFFFF||#111",
    "Dornach|DOR|s|#F8B010||#111",
    "Uzwil|UZW|m|#2040A8|#F5E020|#F5E020|#2040A8",
    // ---- LIGA DE ALBANIA ----
    "AF Elbasani|ELB|v|#1A4A98|#F0D060|#1A4A98|#F0D060",
    "Dinamo City|DIN|s|#183478||#fff",
    "Egnatia|EGN|d|#1A3020|#3AA050|#fff",
    "Laçi|LAC|v|#FFFFFF|#111111|#fff|#111111",
    "Partizani|PAR|s|#E82A30||#fff",
    "Skënderbeu|SKE|m|#E81010|#FFFFFF|#111|#FFFFFF",
    "Teuta|TEU|s|#233A80||#fff",
    "Tirana|TIR|v|#FFFFFF|#4060B0|#fff|#4060B0",
    "Vllaznia|VLL|m|#1A4A90|#D0203A|#fff|#1A4A90",
    "Vora|VOR|s|#1048B8||#fff",
    // ---- LIGA DE ARMENIA ----
    "Alashkert|ALA|s|#2A2828||#E8E050",
    "Ararat Yerevan|ARY|h|#2E2EA0|#FFFFFF|#2E2EA0",
    "Ararat-Armenia|ARA|s|#FFFFFF||#222",
    "BKMA|BKM|m|#1E2458|#3A88C8|#fff|#1E2458",
    "Gandzasar|GAN|s|#133E90||#fff",
    "Noah|NOA|d|#2A2828|#FFFFFF|#fff",
    "Pyunik|PYU|m|#1A2070|#B01040|#fff|#1A2070",
    "Sardarapat|SAR|s|#A0300A||#EADCC8",
    "Shirak|SHI|v|#F08020|#111111|#111|#F08020",
    "Syunik|SYU|h|#1A2850|#FFFFFF|#1A2850",
    "Urartu|URA|d|#5A2E98|#FFFFFF|#fff",
    "Van|VAN|s|#283898||#fff",
    // ---- LIGA DE KOSOVO ----
    "Ballkani|BAL|v|#FF6A10|#111111|#111|#FF6A10",
    "Drenica|DRE|m|#D83030|#F0F070|#F0F070|#D83030",
    "Drita|DRI|s|#3E3E90||#fff",
    "Dukagjini|DUK|h|#3AAA80|#FFFFFF|#222",
    "Feronikeli|FER|v|#4AAA4A|#222222|#fff|#222222",
    "Gjilani|GJI|s|#C01015||#fff",
    "Llapi|LLA|s|#1A4A98||#fff",
    "Malisheva|MAL|m|#12A8E0|#FFFFFF|#111|#FFFFFF",
    "Prishtina|PRI|h|#0D70B8|#FFFFFF|#0D70B8",
    "Vushtrria|VUS|d|#0D70A8|#FFFFFF|#fff",
    // ---- LIGA DE LITUANIA ----
    "Banga|BAN|m|#F08A10|#13205E|#13205E|#F08A10",
    "Džiugas Telšiai|DZI|s|#702528||#fff",
    "Hegelmann|HEG|h|#0D4590|#FFFFFF|#0D4590",
    "Kauno Žalgiris|KAZ|m|#0D8040|#FFFFFF|#fff|#0D8040",
    "Panevėžys|PAN|s|#DC1A2A||#fff",
    "Sūduva|SUD|h|#EE1010|#FFFFFF|#111",
    "Šiauliai|SIA|s|#F8CC10||#222",
    "Transinvest|TRI|v|#1A3A90|#FFE010|#1A3A90|#FFE010",
    "Trakai|TRA|s|#0D0D0D||#D8FF10",
    "Žalgiris Vilnius|ZAL|v|#FFFFFF|#0D6650|#fff|#0D6650",
    // ---- LIGA DE FINLANDIA ----
    "AC Oulu|OUL|s|#0E2A40||#fff",
    "FC Lahti|LAH|s|#1A1818||#fff",
    "FF Jaro|JAR|d|#E83A40|#FFFFFF|#111|#FFFFFF",
    "Gnistan|GNI|s|#0A3AA8||#FFE800",
    "HJK Helsinki|HJK|v|#FFFFFF|#0D3AA8|#fff|#0D3AA8",
    "IFK Mariehamn|MAR|m|#1A4AA0|#FFFFFF|#fff|#1A4AA0",
    "Ilves|ILV|s|#F5C410||#222",
    "Inter Turku|INT|v|#2A5AB8|#222222|#fff|#222222",
    "KuPS|KUP|m|#F8E010|#222222|#222|#F8E010",
    "SJK|SJK|s|#1A1A1A||#C8B050",
    "TPS Turku|TPS|s|#0D0D0D||#fff",
    "VPS Vaasa|VPS|v|#FFFFFF|#222222|#222|#FFFFFF"
  ];

  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ").trim();
  }

  // Prefijos/sufijos genéricos que no distinguen club ("FC Flora" = "Flora").
  var AFIJOS = { fc: 1, cf: 1, afc: 1, kf: 1, fk: 1, sc: 1, ac: 1, ue: 1, cd: 1, ud: 1, sd: 1, ce: 1, nk: 1 };
  function canon(s) {
    return norm(s).split(" ").filter(function (t) { return t && !AFIJOS[t]; }).join(" ");
  }

  var MAPA = {}, MAPA_CANON = {};
  DATOS.forEach(function (l) {
    var p = l.split("|");
    var def = { nombre: p[0], sig: p[1], dib: p[2], c1: p[3], c2: p[4] || p[3], txt: p[5] || "#fff", placa: p[6] || "" };
    MAPA[norm(p[0])] = def;
    var c = canon(p[0]);
    MAPA_CANON[c] = MAPA_CANON.hasOwnProperty(c) ? null : def; // null = ambiguo
  });

  // Alias: nombre del equipo en el juego (normalizado) -> nombre de la lámina.
  var ALIAS = {};
  function alias(juego, lamina) { ALIAS[norm(juego)] = norm(lamina); }

  alias("Beitar Jerusalem", "Beitar Jerusalén");
  alias("Hapoel Jerusalem FC", "Hapoel Jerusalén");
  alias("Hapoel Jerusalem", "Hapoel Jerusalén");
  alias("Penya Encarnada d'Andorra", "Penya Encarnada");
  alias("FC Bruno's Magpies", "FCB Magpies");
  alias("Cardiff MU", "Cardiff Met");
  alias("Haverfordwest", "Haverfordwest County");
  alias("Tefelin BGC", "Trefelin BGC");
  alias("Flora Tallinn", "Flora");
  alias("Harju JK Laagri", "Harju JK");
  alias("Paide Linnameeskond", "Paide");
  alias("Narva Trans", "Trans Narva");
  alias("Víkingur Gøta", "Víkingur");
  alias("Atert Bissen", "UN Atert Bissen");
  alias("Dinamo Tbilisi", "Dinamo Tiflis");
  alias("Meshakhte Tkibuli", "Meshakhte");
  alias("FC Samgurali Tskhaltubo", "Samgurali");
  alias("Belshina Bobruisk", "Belshina");
  alias("Dynamo Brest", "Dinamo Brest");
  alias("FC Isloch Minsk Region", "Isloch");
  alias("ML Vitebsk", "Maxline Vitebsk");
  alias("FC Vitebsk", "Vitebsk");
  alias("Naftan Novopolotsk", "Naftan");
  alias("KF Teuta Durrës", "Teuta");
  alias("KF Vllaznia Shkodër", "Vllaznia");
  alias("BKMA Yerevan", "BKMA");
  alias("KuPS Kuopio", "KuPS");
  alias("Dynamo Minsk", "Dinamo Minsk");
  alias("Neman", "Neman Grodno");
  alias("Slavia", "Slavia Mozyr");
  alias("Vaprus Pärnu", "Pärnu JK Vaprus");
  alias("TPS", "TPS Turku");
  // Homónimos que NO son el mismo club (ver CLAUDE.md): nunca por prefijo.
  var DISTINTOS = {};
  ["CE Europa", "Rangers FC", "Rangers"].forEach(function (n) { DISTINTOS[norm(n)] = 1; });

  function buscar(nombre) {
    var k = norm(nombre);
    if (!k) return null;
    if (MAPA[k]) return MAPA[k];
    if (ALIAS[k] && MAPA[ALIAS[k]]) return MAPA[ALIAS[k]];
    if (DISTINTOS[k]) return null;
    var c = canon(nombre);
    if (ALIAS[c] && MAPA[ALIAS[c]]) return MAPA[ALIAS[c]];
    return MAPA_CANON[c] || null;
  }

  // SVG (viewBox 80x80) de la cara de la chapa. El aro plateado y el
  // brillo los pone la CSS de .escudo--chapa (compartida por todos).
  function svg(def) {
    var c1 = def.c1, c2 = def.c2, o = "";
    switch (def.dib) {
      case "h": o = '<rect width="80" height="80" fill="' + c1 + '"/><rect y="27" width="80" height="26" fill="' + c2 + '"/>'; break;
      case "v":
        o = '<rect width="80" height="80" fill="' + c1 + '"/>';
        for (var i = 1; i < 7; i += 2) o += '<rect x="' + (i * 80 / 7).toFixed(1) + '" width="11.43" height="80" fill="' + c2 + '"/>';
        break;
      case "m": o = '<rect width="80" height="80" fill="' + c1 + '"/><rect x="40" width="40" height="80" fill="' + c2 + '"/>'; break;
      case "d":
        o = '<rect width="80" height="80" fill="' + c1 + '"/>' +
          '<polygon points="0,12 12,0 36,24 24,36" fill="' + c2 + '"/>' +
          '<polygon points="44,56 56,44 80,68 68,80" fill="' + c2 + '"/>';
        break;
      default: o = '<rect width="80" height="80" fill="' + c1 + '"/>';
    }
    if (def.placa) o += '<rect x="11" y="27" width="58" height="26" rx="5" fill="' + def.placa + '"/>';
    o += '<text x="40" y="51.5" text-anchor="middle" font-family="Impact,\'Arial Narrow\',\'Helvetica Neue\',Arial,sans-serif" font-weight="900" font-size="31" textLength="' + (def.sig.length > 3 ? 52 : 44) + '" lengthAdjust="spacingAndGlyphs" fill="' + def.txt + '">' + def.sig + '</text>';
    return o;
  }

  // Chapa neutra (club sin lámina todavía): gris con sus siglas.
  function neutra(siglas) {
    return svg({ dib: "s", c1: "#3a3f47", c2: "#3a3f47", txt: "#e8eaed", sig: String(siglas || "?").slice(0, 3).toUpperCase() });
  }

  window.Chapas = { buscar: buscar, svg: svg, neutra: neutra, alias: alias, _mapa: MAPA, _norm: norm };
})();
