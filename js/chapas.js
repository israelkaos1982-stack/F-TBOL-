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
       r  rayas horizontales c1/c2
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
    "VPS Vaasa|VPS|v|#FFFFFF|#222222|#222|#FFFFFF",
    // ---- LIGA DE LETONIA ----
    "Auda|AUD|m|#2A2828|#2E9A40|#fff|#2A2828",
    "Daugavpils|DAU|s|#262B55||#fff",
    "Grobiņa|GRO|v|#1E2448|#4A5AA8|#fff|#1E2448",
    "Jelgava|JEL|s|#2A2828||#fff",
    "Liepāja|LIE|h|#139058|#FFFFFF|#111",
    "Ogre United|OGR|d|#0E1E30|#1A78C0|#fff",
    "RFS|RFS|s|#0A70D0||#fff",
    "Riga FC|RIG|s|#123A60||#fff",
    "Super Nova|SUP|m|#F8E818|#2E3060|#2E3060|#F8E818",
    "Tukums 2000|TUK|v|#1A8A50|#EEEEEE|#222|#EEEEEE",
    // ---- LIGA DE ISLANDIA ----
    "Breiðablik|BRE|s|#2C6A54||#fff",
    "FH|FH|m|#0D0D0D|#FFFFFF|#fff|#0D0D0D",
    "Fram|FRA|h|#0A78B8|#B88A38|#fff|#0A78B8",
    "ÍA Akranes|IAK|s|#F8CC30||#111",
    "ÍBV|IBV|s|#FFFFFF||#111",
    "KA Akureyri|KAA|m|#1A88C8|#E83A40|#111|#FFFFFF",
    "Keflavík|KEF|h|#0D1E40|#FFFFFF|#0D1E40",
    "KR Reykjavík|KRR|v|#FFFFFF|#111111|#fff|#111111",
    "Stjarnan|STJ|s|#1418A0||#fff",
    "Thór|THO|d|#C8183A|#FFFFFF|#fff",
    "Valur|VAL|s|#E04A3A||#111|#FFFFFF",
    "Víkingur Reykjavík|VIK|v|#D8302A|#222222|#fff|#222222",
    // ---- LIGA DE BOSNIA Y HERZEGOVINA ----
    "Borac Banja Luka|BOR|d|#2A5098|#D8302A|#fff",
    "BSK Banja Luka|BSK|s|#5E6AA0||#fff",
    "Čelik Zenica|CEL|v|#E0303A|#2A2828|#fff|#2A2828",
    "Radnik Bijeljina|RAD|m|#36389A|#FFFFFF|#fff|#36389A",
    "Sarajevo|SAR|s|#5E0A30||#fff",
    "Široki Brijeg|SIR|h|#2A55A0|#FFFFFF|#1E4A98",
    "Sloga Meridian|SLO|d|#1A1A98|#FFFFFF|#fff",
    "Velež Mostar|VEL|s|#E81010||#fff",
    "Zrinjski Mostar|ZRI|m|#D8202A|#FFFFFF|#fff|#D8202A",
    "Željezničar|ZEL|s|#1E4E90||#fff",
    // ---- LIGA DE IRLANDA ----
    "Bohemians|BOH|v|#E0202A|#0D0D0D|#fff|#0D0D0D",
    "Derry City|DER|v|#FFFFFF|#E01018|#fff|#E01018",
    "Drogheda United|DRO|m|#650A38|#A0C0E0|#A0C0E0|#650A38",
    "Dundalk|DUN|h|#2A2828|#D02A2A|#fff|#2A2828",
    "Galway United|GAL|s|#6A1E25||#A0C0E8",
    "Shamrock Rovers|SHA|h|#1E8A30|#FFFFFF|#111",
    "Shelbourne|SHE|s|#D8181E||#fff",
    "Sligo Rovers|SLI|d|#C8202A|#FFFFFF|#fff",
    "St Patrick's Athletic|SPA|m|#E82A30|#FFFFFF|#111|#FFFFFF",
    "Waterford|WAT|s|#0D1A88||#fff",
    // ---- LIGA DE MOLDAVIA ----
    "Dacia Buiucani|DAC|m|#2020D8|#E0E030|#E0E030|#2020D8",
    "FC Bălți|BAL|s|#2560B0||#fff",
    "Milsami Orhei|MIL|s|#E81E2E||#fff",
    "Petrocub Hîncești|PET|d|#0A5A2A|#FFFFFF|#fff",
    "Politehnica UTM|UTM|h|#0D2A4E|#FFFFFF|#0D2A4E",
    "Real Sireți|REA|s|#1E2E70||#C8B048",
    "Sheriff|SHE|v|#F8CC10|#1A1A1A|#111|#F8CC10",
    "Zimbru Chișinău|ZIM|m|#1A4A1A|#EEF020|#EEF020|#1A4A1A",
    // ---- LIGA DE RUSIA ----
    "Akhmat Grozny|AKH|s|#119A50||#111|#FFFFFF",
    "Akron Tolyatti|AKR|s|#E00A0A||#fff",
    "Baltika|BAL|h|#0A58A0|#FFFFFF|#0A58A0",
    "CSKA Moskva|CSK|m|#D8102A|#FFFFFF|#fff|#D8102A",
    "Dinamo Moscú|DMS|s|#0A5A90||#fff",
    "Dynamo Makhachkala|DMA|d|#1A10A8|#FFFFFF|#fff",
    "Fakel|FAK|m|#3555A0|#FFFFFF|#fff|#3555A0",
    "Krasnodar|KRA|v|#1A6A38|#111111|#fff|#1A6A38",
    "Krylia Sovetov|KRY|s|#2A4098||#fff",
    "Lokomotiv Moscú|LOK|h|#D8202A|#E8E8EA|#D8202A",
    "Orenburg|ORE|s|#0D2058||#fff",
    "Rodina|ROD|d|#0A1A28|#1AB0E0|#1AB0E0",
    "Rostov|ROS|m|#FFF010|#0A4AA0|#0A4AA0|#FFF010",
    "Rubin Kazán|RUB|s|#8A2035||#fff",
    "Spartak Moskva|SPA|d|#C8183A|#FFFFFF|#fff",
    "Zenit|ZEN|s|#12A0E0||#111",
    // ---- LIGA DE KAZAJISTAN ----
    "Aktobe|AKT|m|#E82A2A|#FFFFFF|#111|#FFFFFF",
    "Altay|ALT|s|#0A2A58||#fff",
    "Astana|AST|h|#20A0B8|#F8C010|#111",
    "Atyrau|ATY|v|#FFFFFF|#178A40|#fff|#178A40",
    "Irtysh|IRT|s|#2A3A98||#fff",
    "Kairat|KAI|v|#F0C830|#222222|#111|#F0C830",
    "Kaspiy|KAS|h|#5AA8E0|#FFFFFF|#111",
    "Kaysar|KAY|s|#E00A0A||#fff",
    "Kyzylzhar|KYZ|m|#283A70|#FFFFFF|#fff|#283A70",
    "Okzhetpes|OKZ|s|#4A5AA0||#fff",
    "Ordabasy|ORD|h|#2050A8|#FFFFFF|#2050A8",
    "Shakhter Karagandy|SHK|v|#F06020|#0D0D0D|#fff|#0D0D0D",
    "Tobol|TOB|m|#FFE810|#5AAA30|#111|#FFE810",
    "Ulytau|ULY|s|#1E2A5E||#30C0F0",
    "Yelimay|YEL|s|#106A48||#fff",
    "Zhenis|ZHE|v|#F8D820|#0D0D0D|#111|#F8D820",
    "Zhetysu|ZHT|d|#2A4458|#FFFFFF|#fff",
    // ---- LIGA DE AZERBAIYAN ----
    "Araz|ARA|s|#C81A20||#fff",
    "Kapaz|KAP|v|#4A4A98|#F8E810|#3A3A98|#F8E810",
    "Neftçi|NEF|v|#FFFFFF|#111111|#111|#FFFFFF",
    "Qabala|QAB|m|#E0303A|#FFFFFF|#fff|#E0303A",
    "Qarabağ|QAR|s|#2A1E60||#fff",
    "Sabah|SAB|s|#1A1A1A||#E050A0",
    "Safa|SAF|s|#0A30A0||#fff",
    "Shamakhi|SHA|d|#5A30A0|#FFFFFF|#fff",
    "Sumqayit|SUM|s|#8A5AA8||#fff",
    "Turan Tovuz|TUR|h|#3A90D8|#FFFFFF|#111",
    "Zira|ZIR|m|#0D2450|#88B0E0|#fff|#0D2450",
    "Imisli|IMI|s|#4E1028||#fff",
    // ---- LIGA DE BULGARIA ----
    "Arda Kardzhali|ARD|d|#90D4F0|#FFFFFF|#1E3A80|#FFFFFF",
    "Beroe|BER|s|#0A9A48||#fff",
    "Botev Plovdiv|BPL|v|#F8C818|#1A1818|#111|#F8C818",
    "Botev Vratsa|BVR|s|#126A30||#fff",
    "Cherno More|CHM|v|#FFFFFF|#5080B8|#1A3A90|#FFFFFF",
    "CSKA 1948|C48|s|#E00A0A||#fff",
    "CSKA Sofía|CSK|m|#E00A0A|#FFFFFF|#fff|#E00A0A",
    "Dunav Ruse|DUN|s|#2448F0||#fff",
    "Hebar|HEB|h|#2A9A50|#FFFFFF|#111",
    "Levski Sofía|LEV|s|#2A3A90||#fff",
    "Lokomotiv Plovdiv|LPL|s|#0D0D0D||#fff",
    "Lokomotiv Sofía|LSO|v|#D8183A|#333028|#fff|#333028",
    "Ludogorets|LUD|s|#106A38||#fff",
    "Septemvri Sofía|SEP|m|#1A78C8|#E0303A|#fff|#1A78C8",
    "Slavia Sofía|SLA|s|#FFFFFF||#222",
    "Spartak Varna|SPV|d|#1A80E0|#FFFFFF|#E00A0A|#FFFFFF",
    // ---- LIGA DE ESLOVAQUIA ----
    "DAC Dunajská Streda|DAC|s|#0D0D70||#F8C020",
    "Dukla Banská Bystrica|DBB|s|#C81A30||#F0C090",
    "Komárno|KOM|m|#5A30A0|#FFFFFF|#fff|#5A30A0",
    "Košice|KOS|v|#0D2840|#F8D020|#0D2840|#F8D020",
    "Podbrezová|POD|d|#C81A3A|#FFFFFF|#fff",
    "Ružomberok|RUZ|m|#FFFFFF|#1010A8|#1010A8|#FFFFFF",
    "Skalica|SKA|h|#128A60|#EEEEEE|#128A60",
    "Slovan Bratislava|SLO|h|#40B8E8|#FFFFFF|#0A60A0",
    "Spartak Trnava|TRN|v|#C8181E|#0D0D0D|#fff|#0D0D0D",
    "Trenčín|TRE|s|#C0102A||#fff",
    "Zemplín Michalovce|ZEM|h|#3A3A90|#F8D810|#2E2E90",
    "Žilina|ZIL|s|#0A7A3A||#F8D020",
    // ---- LIGA DE ESLOVENIA ----
    "Aluminij|ALU|s|#E82A35||#fff",
    "Bravo|BRA|s|#0A60A0||#F8D010",
    "Brinje Grosuplje|BRI|m|#FFE010|#0D2A58|#0D2A58|#FFE010",
    "Celje|CEL|s|#0D2058||#fff",
    "Domžale|DOM|v|#0D55A0|#FFF010|#0D55A0|#FFF010",
    "Koper|KOP|h|#F8E050|#1A90C8|#111|#F8E050",
    "Maribor|MAR|s|#4A2A80||#F8C010",
    "Mura|MUR|v|#FFFFFF|#111111|#fff|#111111",
    "Nafta Lendava|NAF|v|#FFFFFF|#3050A0|#fff|#3050A0",
    "Olimpija Ljubljana|OLI|s|#0A8A40||#fff",
    "Radomlje|RAD|d|#F8E040|#1A1A1A|#111",
    "Rogaška|ROG|m|#FFFFFF|#0D0D0D|#111|#FFFFFF",
    // ---- LIGA DE RUMANIA ----
    "Botoșani|BOT|m|#3A3A98|#E0303A|#fff|#3A3A98",
    "CFR Cluj|CFR|s|#8A2540||#fff",
    "Csíkszereda|CSI|v|#D8102A|#222222|#fff|#222222",
    "Dinamo București|DIN|s|#F00A0A||#fff",
    "Farul|FAR|s|#2A3468||#fff",
    "FCSB|FCSB|m|#0D2A58|#D8302A|#F8F010|#0D2A58",
    "Hunedoara|HUN|m|#2A88C8|#FFFFFF|#111|#FFFFFF",
    "Oțelul|OTE|v|#0A58A8|#E0303A|#fff|#0A58A8",
    "Petrolul|PET|s|#FFE820||#1E3A98",
    "Rapid|RAP|s|#7A2A30||#fff",
    "Sepsi|SEP|v|#FFFFFF|#E0284A|#fff|#E0284A",
    "U Cluj|UCL|s|#0D0D0D||#fff",
    "U Craiova|UCR|h|#0A70B8|#FFFFFF|#0A70B8",
    "UTA Arad|UTA|v|#FFFFFF|#E83A3A|#fff|#E83A3A",
    "Voluntari|VOL|m|#0D3A70|#60C8E0|#fff|#0D3A70",
    "Argeș|ARG|d|#5A1A90|#FFFFFF|#fff",
    // ---- LIGA DE HUNGRIA ----
    "Debrecen|DVS|s|#C8182A||#fff",
    "Diósgyőr|DIO|d|#E80A0A|#FFFFFF|#fff",
    "Fehérvár|FEH|v|#C8202A|#13284E|#fff|#13284E",
    "Ferencváros|FTC|v|#FFFFFF|#137A40|#fff|#137A40",
    "Győr ETO|ETO|d|#0D6A38|#FFFFFF|#fff",
    "Kecskemét|KTE|m|#6A4A98|#FFFFFF|#fff|#6A4A98",
    "Kisvárda|KIS|h|#E02A35|#FFFFFF|#E01A2A",
    "MTK|MTK|d|#0A4A88|#FFFFFF|#fff",
    "Nyíregyháza|NYI|m|#2A60B8|#E0283A|#fff|#2A60B8",
    "Paks|PAK|h|#40A048|#FFFFFF|#111",
    "Puskás Akadémia|PUA|s|#1A2838||#C8B890",
    "Újpest|UJP|s|#5A3A98||#fff",
    "Vasas|VAS|m|#2A60B8|#E0283A|#fff|#2A60B8",
    "Zalaegerszeg|ZTE|s|#2A60A8||#fff",
    // ---- LIGA DE UCRANIA ----
    "Chornomorets|CHO|h|#2A40A0|#FFFFFF|#1A3A90",
    "Dinamo Kiev|DYN|s|#1A70C0||#fff",
    "Epitsentr|EPI|s|#2A2640||#D090C0",
    "Karpaty|KAR|v|#FFFFFF|#13A050|#111|#FFFFFF",
    "Kharkiv|KHA|s|#4E1028||#F8B818",
    "Kolos|KOL|s|#0D1A10||#fff",
    "Kryvbas|KRY|m|#D82A2A|#444444|#fff|#444444",
    "Kudrivka|KUD|s|#1A4AA0||#fff",
    "Livyi Bereh|LIV|d|#0D3010|#F8C818|#F8C818",
    "Lnz Cherkasy|LNZ|h|#2A2260|#9A80C0|#fff|#2A2260",
    "Obolon|OBO|s|#1E5A38||#fff",
    "Polissya|POL|m|#0D0D0D|#40C040|#111|#40C040",
    "Shakhtar Donetsk|SHA|v|#F07820|#0D0D0D|#111|#F07820",
    "Veres Rivne|VER|m|#222222|#D8202A|#fff|#222222",
    "Zorya|ZOR|d|#FFFFFF|#D02A2A|#111",
    "Bukovyna|BUK|v|#0D0D0D|#F8E010|#F8E010|#0D0D0D",
    // ---- LIGA DE SERBIA ----
    "Čukarički|CUK|d|#FFFFFF|#0D0D0D|#111",
    "Estrella Roja|CZV|v|#FFFFFF|#F00A0A|#fff|#F00A0A",
    "IMT Novi Beograd|IMT|m|#FFFFFF|#0D0D0D|#F00A0A|#FFFFFF",
    "Javor|JAV|h|#E0504A|#FFFFFF|#111",
    "Mladost Lučani|MLA|m|#12A8E0|#FFFFFF|#111|#FFFFFF",
    "Napredak|NAP|s|#B01E30||#fff",
    "Novi Pazar|NPA|h|#FFFFFF|#2050A8|#fff",
    "OFK Beograd|OFK|v|#FFFFFF|#0A50A0|#fff|#0A50A0",
    "Partizan|PAR|v|#FFFFFF|#222222|#fff|#222222",
    "Radnički Kragujevac|RKG|s|#E02A30||#fff",
    "Radnički Niš|RNI|m|#FFFFFF|#E81010|#E81010|#FFFFFF",
    "Radnik Surdulica|RSU|m|#18B0E0|#183E90|#fff|#183E90",
    "Spartak Subotica|SPA|h|#3040A0|#FFFFFF|#3040A0",
    "Vojvodina|VOJ|m|#E02A30|#FFFFFF|#fff|#E02A30",
    "Železničar Pančevo|ZPA|h|#B8D8F0|#1E3260|#1E3260|#B8D8F0",
    // ---- LIGA DE CROACIA ----
    "Dinamo Zagreb|DIN|s|#0A4E98||#fff",
    "Gorica|GOR|m|#D02A2A|#0D0D0D|#fff|#0D0D0D",
    "Hajduk Split|HAJ|v|#FFFFFF|#D02A30|#0A4AA0|#FFFFFF",
    "Istra 1961|IST|m|#0A7A3A|#F0C810|#0A7A3A|#F0C810",
    "Lokomotiva|LOK|v|#FFFFFF|#0E4E90|#fff|#0E4E90",
    "Osijek|OSI|h|#6AB8E8|#FFFFFF|#333",
    "Rijeka|RIJ|d|#FFFFFF|#5AB4E0|#111",
    "Slaven Belupo|SLA|s|#2A4AA0||#fff",
    "Varaždin|VAR|s|#FFFFFF||#2A60A8",
    "Rudeš|RUD|v|#FFFFFF|#30308A|#fff|#30308A",
    // ---- LIGA DE SUECIA ----
    "AIK|AIK|d|#0D2840|#F8D010|#0D2840|#F8D810",
    "BK Häcken|HAC|v|#F0F010|#1A1A1A|#111|#F0F010",
    "Degerfors|DEG|s|#F01A15||#fff",
    "Djurgården|DJU|m|#1A70C0|#F8E820|#E0202A|#F8E820",
    "Elfsborg|ELF|s|#1A1A1A||#F8D010",
    "GAIS|GAI|m|#2E8A48|#C83A30|#111|#F0D030",
    "Halmstad|HBK|d|#0A5AA8|#FFFFFF|#fff",
    "Hammarby|HAM|r|#FFFFFF|#0A6A38|#0A6A38|#FFFFFF",
    "IFK Göteborg|GOT|d|#2A4A98|#FFFFFF|#2A4A98|#FFFFFF",
    "IFK Norrköping|NOR|m|#2A50A0|#FFFFFF|#fff|#2A50A0",
    "Kalmar|KAL|s|#C81A38||#fff",
    "Malmö FF|MFF|v|#FFFFFF|#1A90D0|#111|#FFFFFF",
    "Mjällby|MJA|h|#F8D010|#222222|#F8D010",
    "Sirius|SIR|v|#1A60B0|#0D0D0D|#eee|#0D0D0D",
    "Västerås|VSK|h|#0A7A48|#FFFFFF|#0A7A48",
    "Örgryte|OIS|m|#8A1A30|#2A3060|#fff|#2A3060",
    // ---- LIGA DE CHIPRE ----
    "AEK Larnaca|AEK|m|#FFE010|#0A8A40|#0A8A40|#FFE010",
    "AEL Limassol|AEL|s|#1E4A90||#F8B818",
    "Anorthosis|ANO|v|#FFFFFF|#2A58B0|#fff|#2A58B0",
    "APOEL|APO|d|#0A4A98|#F8C030|#0A4A98|#FFFFFF",
    "Apollon|APL|h|#0A68B8|#FFFFFF|#0A68B8",
    "Aris Limassol|ARI|h|#0AAA40|#FFFFFF|#111",
    "Doxa Katokopias|DOX|s|#0E6A30||#fff",
    "Enosis Neon Paralimni|ENP|m|#8A1A18|#5A98D0|#fff|#8A1A18",
    "Ethnikos Achna|ETH|d|#24306E|#FFFFFF|#fff",
    "Karmiotissa|KAR|s|#F05020||#111",
    "Nea Salamis|NEA|v|#FFFFFF|#E02A2A|#fff|#E02A2A",
    "Omonia Aradippou|OMA|h|#3A90D8|#FFFFFF|#111",
    "Omonia Nicosia|OMN|s|#1A5A2A||#fff",
    "Pafos|PAF|d|#0D3A68|#F8C818|#0D3A68|#FFFFFF",
    // ---- LIGA DE AUSTRIA ----
    "Austria Klagenfurt|KLA|s|#5A3058||#fff",
    "Austria Viena|AUS|d|#4A1A80|#FFFFFF|#fff",
    "Blau-Weiß Linz|BWL|h|#36409A|#FFFFFF|#36409A",
    "Grazer AK|GAK|s|#C81A20||#fff",
    "Hartberg|HAR|d|#1A88C0|#FFFFFF|#111|#FFFFFF",
    "LASK|LASK|v|#FFFFFF|#1A1A1A|#fff|#1A1A1A",
    "Rapid Viena|RAP|v|#FFFFFF|#0A8050|#fff|#0A8050",
    "Red Bull Salzburgo|RBS|m|#E01A4A|#FFFFFF|#0D1E40|#FFFFFF",
    "Rheindorf Altach|ALT|m|#0D0D0D|#FFFFFF|#fff|#0D0D0D",
    "Sturm Graz|STU|s|#0D0D0D||#fff",
    "Tirol|TIR|d|#0D0D0D|#FFFFFF|#fff",
    "Wolfsberger AC|WAC|h|#0D0D0D|#FFFFFF|#111",
    // ---- LIGA DE SUIZA ----
    "Basel|BAS|m|#E0102A|#1414D8|#F8E010|#1414D8",
    "Grasshopper|GCZ|m|#0A5A98|#FFFFFF|#fff|#0A5A98",
    "Lausanne|LAU|s|#262A60||#fff",
    "Lugano|LUG|s|#0D0D0D||#fff",
    "Luzern|LUZ|h|#0A58A8|#FFFFFF|#0A50A0",
    "Servette|SER|s|#5E2030||#fff",
    "Sion|SIO|m|#E82A2A|#FFFFFF|#fff|#E82A2A",
    "St. Gallen|SGA|s|#0A7A48||#fff",
    "Thun|THU|d|#E0102A|#FFFFFF|#fff",
    "Winterthur|WIN|d|#FFFFFF|#E0302A|#222",
    "Young Boys|YBO|v|#F8D020|#0D0D0D|#F8D020|#0D0D0D",
    "Zürich|FCZ|h|#1E2C58|#FFFFFF|#1E2C58"
  ];

  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ").trim();
  }

  // Prefijos/sufijos genéricos que no distinguen club ("FC Flora" = "Flora").
  var AFIJOS = { fc: 1, cf: 1, afc: 1, kf: 1, fk: 1, sc: 1, ac: 1, ue: 1, cd: 1, ud: 1, sd: 1, ce: 1, nk: 1,
    "if": 1, aif: 1, ik: 1, is: 1, ff: 1, sk: 1, bk: 1, pfk: 1, osk: 1, mfk: 1, msk: 1, kfc: 1, hnk: 1, ns: 1, tsv: 1, wsg: 1, as: 1 };
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
  alias("Breidablik", "Breiðablik");
  alias("FH Hafnarfjordur", "FH");
  alias("Valur Reykjavík", "Valur");
  alias("Bohemian FC", "Bohemians");
  alias("Araz Naxçıvan", "Araz");
  alias("Kəpəz PFK", "Kapaz");
  alias("Qəbələ FK", "Qabala");
  alias("Şəfa FK", "Safa");
  alias("Şamaxı FK", "Shamakhi");
  alias("Sumqayıt FK", "Sumqayit");
  alias("Neftçi PFK", "Neftçi");
  alias("Zira FK", "Zira");
  alias("Cherno More Varna", "Cherno More");
  alias("FC CSKA 1948 Sofia", "CSKA 1948");
  alias("CSKA Sofia", "CSKA Sofía");
  alias("CFR 1907 Cluj", "CFR Cluj");
  alias("FC Univ. Cluj", "U Cluj");
  alias("Univ. Craiova", "U Craiova");
  alias("Farul Constanța", "Farul");
  alias("SC Oțelul Galați", "Oțelul");
  alias("FC Rapid 1923", "Rapid");
  alias("Debreceni VSC", "Debrecen");
  alias("MTK Budapest", "MTK");
  alias("Nyíregyháza Spartacus", "Nyíregyháza");
  alias("Paksi FC", "Paks");
  alias("Budapesti Vasas", "Vasas");
  alias("Zalaegerszegi TE", "Zalaegerszeg");
  alias("Dynamo Kyiv", "Dinamo Kiev");
  alias("Crvena Zvezda", "Estrella Roja");
  alias("NK Lokomotiva Zagreb", "Lokomotiva");
  alias("Halmstads BK", "Halmstad");
  alias("Djurgårdens IF", "Djurgården");
  alias("Apollon Limassol", "Apollon");
  alias("Ethnikos Achnas", "Ethnikos Achna");
  alias("FK Austria Wien", "Austria Viena");
  alias("Rapid Wien", "Rapid Viena");
  alias("Red Bull Salzburg", "Red Bull Salzburgo");
  alias("SCR Altach", "Rheindorf Altach");
  alias("Lausanne-Sport", "Lausanne");
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
      case "r":
        o = '<rect width="80" height="80" fill="' + c1 + '"/>';
        for (var j = 1; j < 9; j += 2) o += '<rect y="' + (j * 80 / 9).toFixed(1) + '" width="80" height="8.89" fill="' + c2 + '"/>';
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
