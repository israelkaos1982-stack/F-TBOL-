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
    "Zürich|FCZ|h|#1E2C58|#FFFFFF|#1E2C58",
    // ---- LIGA EA SPORTS ----
    "Real Betis|BET|v|#0A9A4A|#FFFFFF|#fff|#0A9A4A",
    "Villarreal|VIL|s|#FFD83A||#0B2A5A",
    "Real Sociedad|RSO|h|#1E3E8C|#FFFFFF|#1E3E8C",
    "Athletic Club|ATH|v|#E02020|#FFFFFF|#111|#FFFFFF",
    "Celta|CEL|s|#78B4E6||#D2133A",
    "Valencia|VAL|v|#111111|#FFFFFF|#fff|#111111",
    "Getafe|GET|s|#1258B0||#fff",
    "Osasuna|OSA|m|#D02A2A|#2A1E60|#fff|#D02A2A",
    "Rayo Vallecano|RAY|d|#FFFFFF|#E03A20|#E03A20",
    "Sevilla|SEV|v|#D8172A|#FFFFFF|#fff|#D8172A",
    "Espanyol|ESP|v|#0A7AC4|#FFFFFF|#fff|#0A7AC4",
    "Elche|ELC|h|#FFFFFF|#0A6A30|#fff",
    "RC Deportivo|DEP|d|#FFFFFF|#B8D8EE|#5A1E5E",
    "Deportivo Alavés|ALA|v|#1238A8|#FFFFFF|#fff|#1238A8",
    "Levante|LEV|r|#1A5FA0|#B81848|#fff|#B81848",
    "Racing|RAC|v|#2E9A30|#FFFFFF|#111|#FFFFFF",
    // ---- LIGA HYPERMOTION ----
    "Girona FC|GIR|d|#D41A32|#FFFFFF|#fff",
    "Mallorca|MAL|s|#D8172A||#FFE400",
    "Leganés|LEG|v|#132A6E|#FFFFFF|#fff|#132A6E",
    "Almería|ALM|v|#E01020|#FFFFFF|#fff|#E01020",
    "Real Oviedo|OVI|s|#1A55A8||#fff",
    "UD Las Palmas|LPA|s|#FFE80A||#1A4CA8",
    "Cádiz|CAD|m|#FFE60A|#1A55A8|#1A4CA8|#FFE60A",
    "Granada|GRA|h|#C8203A|#FFFFFF|#C8203A",
    "Eibar|EIB|m|#1E3A70|#8A1E3A|#fff|#1E3A70",
    "Real Valladolid|VAD|v|#8A2A9A|#FFFFFF|#fff|#8A2A9A",
    "Real Sporting|SPO|v|#E01020|#FFFFFF|#fff|#E01020",
    "CD Castellón|CAS|v|#222222|#FFFFFF|#fff|#222222",
    "Albacete|ALB|s|#FFFFFF||#111",
    "Burgos CF|BUR|h|#111111|#FFFFFF|#111",
    "Córdoba CF|COR|v|#0E6A3A|#FFFFFF|#fff|#0E6A3A",
    "Eldense|ELD|v|#1238A0|#C81A2A|#fff|#1238A0",
    "Tenerife|TEN|d|#2A3290|#FFFFFF|#fff",
    "FC Andorra|AND|r|#1238A0|#F5B520|#fff|#1238A0",
    "Ceuta|CEU|m|#111111|#FFFFFF|#fff|#111111",
    "Real Sociedad B|RSB|h|#1E3E8C|#FFFFFF|#1E3E8C",
    "Celta Fortuna|CEB|s|#78B4E6||#D2133A",
    "Málaga|MLG|v|#B8DCF2|#FFFFFF|#1E3A8A|#B8DCF2",
    // ---- 1ª RFEF GRUPO A ----
    "Mirandés|MIR|d|#D8172A|#111111|#fff",
    "Cultural Leonesa|CUL|s|#FFFFFF||#D2133A",
    "Zamora CF|ZAM|v|#C02A20|#111111|#fff|#C02A20",
    "AD Mérida|MER|v|#111111|#FFFFFF|#fff|#111111",
    "Bilbao Athletic|ATHB|v|#E02020|#FFFFFF|#111|#FFFFFF",
    "CD Lugo|LUG|v|#E01828|#FFFFFF|#fff|#E01828",
    "Ponferradina|PON|v|#123A8A|#FFFFFF|#fff|#123A8A",
    "Barakaldo|BAR|v|#F5D000|#111111|#111|#F5D000",
    "Pontevedra|PTE|s|#D8A070||#111",
    "Racing Ferrol|FER|s|#0E6A4A||#fff",
    "UD Logroñés|LOG|v|#C8101A|#FFFFFF|#111|#FFFFFF",
    "Unionistas CF|UNI|m|#111111|#FFFFFF|#fff|#111111",
    "CP Cacereño|CAC|s|#0E8A4A||#fff",
    "Real Unión|RUN|h|#FFFFFF|#C89A2A|#111|#FFFFFF",
    "Arenas Club|ARE|d|#222222|#E01828|#fff",
    "Deportivo Fabril|DEPB|d|#FFFFFF|#B8D8EE|#5A1E5E",
    "Real Avilés|AVI|v|#1A1AE0|#FFFFFF|#fff|#1A1AE0",
    "Sabadell|SAB|m|#2A3AA0|#FFFFFF|#fff|#2A3AA0",
    "CD Extremadura|EXT|v|#14185A|#8A2A3A|#fff|#14185A",
    "CD Coria|COI|s|#20C0F0||#111",
    // ---- 1ª RFEF GRUPO B ----
    "Águilas FC|AGU|v|#125AA8|#FFFFFF|#fff|#125AA8",
    "AD Alcorcón|ALC|s|#F5D020||#14285A",
    "Algeciras CF|ALG|v|#E0183A|#FFFFFF|#fff|#E0183A",
    "Antequera CF|ANT|v|#0E8030|#FFFFFF|#fff|#0E8030",
    "Atlético Madrileño|ATMB|v|#E01828|#FFFFFF|#fff|#2A2E6A",
    "CD Teruel|TER|m|#D82A20|#1A3AE0|#fff|#D82A20",
    "CE Europa|EUR|d|#2A6AA8|#FFFFFF|#fff",
    "FC Cartagena|CAR|v|#111111|#FFFFFF|#fff|#111111",
    "Gimnàstic|GIM|v|#F5C84A|#D8202A|#111|#F5C84A",
    "Hércules|HER|s|#123A9A||#fff",
    "Huesca|HUE|d|#2A2E7A|#D8203A|#fff",
    "Juventud Torremolinos|JTO|v|#1A8A3A|#FFFFFF|#fff|#1A8A3A",
    "Rayo Majadahonda|RMAJ|h|#1A4CA8|#FFFFFF|#1A4CA8",
    "Real Jaén|JAE|h|#FFFFFF|#7A2A9A|#fff",
    "Real Murcia|MUR|s|#D02A20||#fff",
    "Real Zaragoza|ZAR|s|#E81A1A||#FFE400",
    "RM Castilla|RMCB|d|#FFFFFF|#1A5AA8|#1A4CA8",
    "UD Ibiza|IBI|s|#80C0EA||#1A55A8",
    "UE Sant Andreu|STA|v|#F5D000|#D8202A|#fff|#1A3A9A",
    "Villarreal B|VILB|s|#FFD83A||#0B2A5A",
    // ---- 2ª RFEF GRUPO A ----
    "Arosa|ARO|v|#D0103A|#FFFFFF|#fff|#D0103A",
    "Atl. Astorga|AST|v|#0E6A3A|#FFFFFF|#fff|#0E6A3A",
    "Bergantiños FC|BER|v|#F04A20|#FFFFFF|#fff|#F04A20",
    "CD Basconia|BAS|v|#F5E000|#111111|#111|#F5E000",
    "Coruxo FC|CRX|s|#0E7A4A||#fff",
    "Deportivo Alavés B|ALAB|v|#1238A8|#FFFFFF|#fff|#1238A8",
    "Eibar B|EIBB|m|#1E3A70|#8A1E3A|#fff|#1E3A70",
    "Gimnástica Torrelavega|GTO|v|#1A55B0|#FFFFFF|#fff|#1A55B0",
    "Marino de Luanco|MLU|s|#14186A||#fff",
    "Ourense CF|OCF|m|#1A4CE0|#FFFFFF|#fff|#1A4CE0",
    "Portugalete|POR|v|#F5E000|#111111|#111|#F5E000",
    "Rayo Cantabria|RACB|v|#2E9A30|#FFFFFF|#111|#FFFFFF",
    "Real Oviedo Vetusta|OVIB|s|#1A55A8||#fff",
    "SD Amorebieta|AMO|s|#2A3A6A||#fff",
    "SD Compostela|COM|d|#A8D8F2|#FFFFFF|#E01828",
    "SD Gernika|GER|v|#111111|#40D040|#fff|#111111",
    "Sestao River|SES|v|#1A6A3A|#111111|#fff|#1A6A3A",
    "UD Llanera|LLA|v|#D8101A|#111111|#fff|#D8101A",
    // ---- 2ª RFEF GRUPO B ----
    "Barbastro|BBA|v|#E0402A|#FFFFFF|#fff|#E0402A",
    "Barça Atlètic|FCBB|v|#8A1E4A|#1A3A9A|#F5C800",
    "Calamocha|CAL|m|#D02A20|#111111|#fff|#D02A20",
    "CD Ebro|EBR|v|#1A55B0|#FFFFFF|#fff|#1A55B0",
    "CE Manresa|MAN|h|#D02A20|#FFFFFF|#D02A20",
    "Espanyol B|ESPB|v|#0A7AC4|#FFFFFF|#fff|#0A7AC4",
    "Girona FC B|GIRB|d|#D41A32|#FFFFFF|#fff",
    "Náxara|NAX|v|#1A55B0|#FFFFFF|#fff|#1A55B0",
    "Osasuna Promesas|OSAB|m|#D02A2A|#2A1E60|#fff|#D02A2A",
    "Peña Sport|PES|s|#1A55A8||#fff",
    "Reus FC Reddis|REU|v|#D8101A|#111111|#fff|#D8101A",
    "SD Logroñés|SDL|v|#D8101A|#FFFFFF|#111|#FFFFFF",
    "Terrassa FC|TER|s|#D04030||#fff",
    "Tudelano|TUD|v|#111111|#FFFFFF|#fff|#111111",
    "UD Logroñés B|LOGB|v|#C8101A|#FFFFFF|#111|#FFFFFF",
    "UE Olot|OLO|m|#E01828|#1A2A8A|#fff|#E01828",
    "Utebo|UTE|v|#2A3A8A|#FFFFFF|#fff|#2A3A8A",
    "UD Ourense|UDO|v|#2A3A9A|#D02A3A|#fff|#2A3A9A",
    // ---- 2ª RFEF GRUPO C ----
    "CD Alcoyano|ALC|v|#1A55B0|#FFFFFF|#fff|#1A55B0",
    "Atlético Baleares|BAL|v|#1A55B0|#FFFFFF|#fff|#1A55B0",
    "CD Castellón B|CASB|v|#222222|#FFFFFF|#fff|#222222",
    "CD Cieza|CIE|s|#D8101A||#FFE070",
    "CF Intercity|INT|s|#111111||#C8B070",
    "CF La Nucía|NUC|s|#D8202A||#fff",
    "Deportiva Minera|MIN|v|#E01828|#FFFFFF|#14186A|#FFFFFF",
    "Elche Ilicitano|ELCB|h|#FFFFFF|#0A6A30|#fff",
    "Lorca Deportiva|LOR|v|#5AB0E8|#FFFFFF|#111|#FFFFFF",
    "Orihuela|ORI|v|#F0A020|#1A3AA0|#F5C800|#1A3AA0",
    "Peña Deportiva|PED|s|#FFFFFF||#111",
    "UD Poblense|POB|v|#1A3AA0|#A01A3A|#F5E000",
    "Mallorca B|MALB|s|#D8172A||#FFE400",
    "Real Murcia B|MURB|s|#D02A20||#fff",
    "UCAM Murcia|UCA|s|#1A1A40||#F0D070",
    "UD Castellonense|CSE|v|#111111|#FFFFFF|#fff|#111111",
    "Valencia B|VALB|v|#111111|#FFFFFF|#fff|#111111",
    "Yeclano Deportivo|YEC|v|#1A3A8A|#E05030|#fff|#1A3A8A",
    // ---- 2ª RFEF GRUPO D ----
    "At. Sanluqueño|SAN|v|#3A6A40|#FFFFFF|#fff|#3A6A40",
    "Atlético Antoniano|ANT|v|#E0302A|#FFFFFF|#fff|#E0302A",
    "Real Betis B|BETB|v|#0A9A4A|#FFFFFF|#fff|#0A9A4A",
    "CD Badajoz|BAD|v|#111111|#FFFFFF|#fff|#111111",
    "Don Benito|DON|m|#1A4CE0|#E05030|#fff|#1A4CE0",
    "CD Estepona|EST|v|#2A3A8A|#D02A3A|#fff|#D02A3A",
    "Ciudad de Lucena|LUC|h|#3AA0E8|#FFFFFF|#3AA0E8",
    "Atlético Central|CEN|d|#FFFFFF|#111111|#111",
    "CP Mijas-Las Lagunas|MIJ|s|#1A55B0||#fff",
    "Las Palmas At.|LPAB|s|#FFE80A||#1A4CA8",
    "Linares Deportivo|LIN|s|#1A3A9A||#fff",
    "Marbella FC|MAR|s|#FFFFFF||#2A3A6A",
    "Recreativo de Huelva|REC|s|#1A3A8A||#fff",
    "Salerm Puente Genil|PGE|d|#D0103A|#222222|#fff",
    "Sevilla At.|SEVB|v|#D8172A|#FFFFFF|#fff|#D8172A",
    "UD Tamaraceite|TAM|v|#3A2A8A|#FFFFFF|#fff|#3A2A8A",
    "Tenerife B|TENB|d|#2A3290|#FFFFFF|#fff",
    "Xerez CD|XER|h|#3AA0E8|#FFFFFF|#3AA0E8",
    // ---- 2ª RFEF GRUPO E ----
    "Atlético Albacete|ALBB|s|#FFFFFF||#111",
    "Atlético C|ATMC|v|#E01828|#FFFFFF|#fff|#2A2E6A",
    "Atlético Tordesillas|TOR|s|#1A7AC8||#fff",
    "CD Atlético Paso|PAS|v|#0E6A30|#111111|#fff|#0E6A30",
    "CD Guadalajara|GUA|s|#6A3AA8||#fff",
    "CDA Navalcarnero|NAV|v|#E01828|#FFFFFF|#2A3A8A|#FFFFFF",
    "CF Talavera|TAL|v|#30C0D0|#FFFFFF|#111|#FFFFFF",
    "CS Puertollano|CSP|s|#14186A||#fff",
    "Getafe B|GETB|s|#1258B0||#fff",
    "Gimnástica Segoviana|SEG|v|#2A2A6A|#8A1E3A|#fff|#2A2A6A",
    "Numancia|NUM|s|#D8101A||#fff",
    "Real Ávila|AVI|m|#D8101A|#2A2A5A|#fff|#D8101A",
    "Real Madrid C|RMCC|d|#FFFFFF|#1A5AA8|#1A4CA8",
    "Real Valladolid Promesas|VADB|v|#8A2A9A|#FFFFFF|#fff|#8A2A9A",
    "RSD Alcalá|ALQ|h|#FFFFFF|#D8101A|#D8101A|#FFFFFF",
    "Salamanca UDS|SAL|m|#222222|#FFFFFF|#fff|#222222",
    "UB Conquense|CON|v|#111111|#FFFFFF|#fff|#111111",
    "UD Sanse|SSR|s|#D02A20||#fff",
    // ---- PREMIER LEAGUE ----
    "Arsenal|ARS|s|#E81010||#fff",
    "Aston Villa|AVL|m|#5A0E2A|#A8CCEA|#fff|#5A0E2A",
    "Bournemouth|BOU|v|#D8202A|#111111|#fff|#D8202A",
    "Brentford|BRE|s|#E01A1A||#fff",
    "Brighton & Hove Albion|BHA|h|#1A6AB8|#FFFFFF|#1A55A8",
    "Chelsea|CHE|s|#1A2A8A||#fff",
    "Crystal Palace|CRY|v|#1A5AA8|#E03A30|#fff|#1A5AA8",
    "Everton|EVE|s|#0A0A9A||#fff",
    "Fulham|FUL|v|#111111|#FFFFFF|#C8101A|#FFFFFF",
    "Ipswich Town|IPS|m|#3A6AB0|#E03A40|#fff|#3A6AB0",
    "Leicester City|LEI|s|#0A55A8||#fff",
    "Manchester City|MCI|s|#78B4E6||#0B2A5A",
    "Manchester United|MUN|s|#E01A2A||#FFE400",
    "Newcastle United|NEW|v|#222222|#FFFFFF|#fff|#222222",
    "Nottingham Forest|NFO|s|#E0101A||#fff",
    "Southampton|SOU|v|#E0203A|#FFFFFF|#111|#FFFFFF",
    "Tottenham Hotspur|TOT|s|#14205A||#fff",
    "West Ham United|WHU|h|#7A2A3A|#38B0E0|#F5D040|#7A2A3A",
    "Wolverhampton Wanderers|WOL|s|#F5B820||#111",
    // ---- SERIE A ----
    "Atalanta|ATA|v|#1A6AC0|#111111|#fff|#1A6AC0",
    "Bologna|BOL|v|#1E2A3A|#B8203A|#fff|#1E2A3A",
    "Cagliari|CAG|m|#B8102A|#14205A|#fff|#B8102A",
    "Como|COM|s|#1A4A7A||#fff",
    "Empoli|EMP|s|#2A5AA8||#fff",
    "Fiorentina|FIO|s|#6A3A9A||#fff",
    "Genoa|GEN|m|#14205A|#A81A2A|#F5D000|#14205A",
    "Hellas Verona|VER|s|#FFD400||#111",
    "Inter|INT|v|#0A2AB0|#111111|#fff|#0A2AB0",
    "Juventus|JUV|v|#111111|#FFFFFF|#fff|#111111",
    "Lazio|LAZ|v|#FFFFFF|#88CCEA|#14306A|#FFFFFF",
    "Lecce|LEC|v|#F5E000|#E0202A|#14205A|#F5E000",
    "Milan|MIL|v|#E0101A|#222222|#fff|#E0101A",
    "Monza|MON|d|#E0203A|#FFFFFF|#fff",
    "Napoli|NAP|s|#18B0E8||#fff",
    "Parma|PAR|v|#F5C820|#2A3A9A|#fff|#2A3A9A",
    "Roma|ROM|h|#9A1A3A|#F0B010|#F5B820|#9A1A3A",
    "Torino|TOR|s|#8A2A20||#fff",
    "Udinese|UDI|d|#111111|#FFFFFF|#fff",
    "Venezia|VEN|r|#F07010|#1A7A3A|#fff|#111111",
    // ---- BUNDESLIGA ----
    "Augsburg|AUG|m|#C03030|#FFFFFF|#3A6A3A|#FFFFFF",
    "Bayer Leverkusen|B04|s|#E8101A||#fff",
    "Bayern Múnich|BAY|r|#E0103A|#2A5AE0|#fff|#E0103A",
    "Bochum|BOC|m|#1A5AA8|#FFFFFF|#fff|#1A5AA8",
    "Borussia Dortmund|DOR|s|#FFE000||#111",
    "Borussia Mönchengladbach|BMG|v|#111111|#FFFFFF|#fff|#111111",
    "Eintracht Frankfurt|FRA|s|#E0101A||#fff",
    "Freiburg|FRE|d|#111111|#FFFFFF|#fff",
    "Heidenheim|HEI|m|#14306A|#E0102A|#fff|#14306A",
    "Hoffenheim|HOF|d|#1A5AB0|#FFFFFF|#fff",
    "Holstein Kiel|KIE|h|#1A5AA0|#FFFFFF|#E0102A",
    "Mainz 05|M05|s|#B8101A||#fff",
    "RB Leipzig|RBL|h|#FFFFFF|#E0103A|#fff",
    "St. Pauli|STP|s|#6A4A3A||#fff",
    "Stuttgart|STU|h|#FFFFFF|#E0102A|#fff",
    "Union Berlin|UNI|h|#E0101A|#FFE000|#E0101A",
    "Werder Bremen|WER|s|#1A8A4A||#fff",
    "Wolfsburg|WOB|s|#0E5A30||#fff",
    // ---- LIGUE 1 ----
    "Angers|ANG|v|#111111|#FFFFFF|#fff|#111111",
    "Auxerre|AUX|s|#1A4CA0||#fff",
    "Brest|BRE|s|#E0202A||#fff",
    "Le Havre|HAC|m|#88C0EA|#14204A|#fff|#14204A",
    "Lens|LEN|v|#B8101A|#F5C820|#fff|#B8101A",
    "Lille|LIL|m|#E0201A|#2A2060|#fff|#E0201A",
    "Lyon|LYO|h|#1A2AA8|#E0102A|#fff|#1A2AA8",
    "Marsella|MAR|s|#FFFFFF||#1A5AA8",
    "Mónaco|MON|v|#E8102A|#FFFFFF|#fff|#E8102A",
    "Montpellier|MTP|v|#14306A|#F07A2A|#fff|#14306A",
    "Nantes|NAN|h|#F5E000|#1A9A40|#111|#F5E000",
    "Niza|NIC|v|#E0202A|#222222|#fff|#E0202A",
    "Reims|REI|s|#E8101A||#fff",
    "Rennes|REN|m|#D8302A|#111111|#fff|#D8302A",
    "Saint-Étienne|STE|s|#1A9A50||#fff",
    "Strasbourg|STR|d|#0A4AA0|#FFFFFF|#E0202A|#FFFFFF",
    "Toulouse|TOU|s|#6A4A9A||#fff",
    // ---- LIGA PORTUGAL ----
    "Arouca|ARO|s|#F5E040||#1A4CA0",
    "AVS|AVS|s|#FFFFFF||#B8202A",
    "Benfica|BEN|s|#E0102A||#fff",
    "Boavista|BOA|m|#111111|#FFFFFF|#fff|#111111",
    "Braga|BRA|h|#D8302A|#FFFFFF|#D8302A",
    "Casa Pia|CAS|s|#111111||#fff",
    "Estoril|EST|m|#FFE000|#2A55B0|#1A3AA0|#FFE000",
    "Estrela Amadora|AMA|v|#E03A30|#3A9A50|#E0302A|#FFFFFF",
    "Famalicão|FAM|m|#1A4A9A|#FFFFFF|#fff|#1A4A9A",
    "Farense|FAR|d|#222222|#FFFFFF|#fff",
    "Gil Vicente|GIL|d|#E0302A|#2A7AD0|#fff",
    "Moreirense|MOR|v|#0E6A30|#FFFFFF|#fff|#0E6A30",
    "Nacional|NAC|v|#111111|#FFFFFF|#fff|#111111",
    "Porto|POR|v|#1A4AA0|#FFFFFF|#fff|#1A4AA0",
    "Rio Ave|RIO|h|#1A9A40|#FFFFFF|#1A9A40",
    "Santa Clara|SCL|s|#D82A20||#fff",
    "Sporting CP|SPO|r|#FFFFFF|#0E8A5A|#fff|#0E8A5A",
    "Vitória de Guimarães|VIT|h|#FFFFFF|#111111|#fff",
    // ---- EREDIVISIE ----
    "Ajax|AJA|h|#D8202A|#FFFFFF|#111",
    "Almere City|ALM|s|#E0102A||#fff",
    "AZ Alkmaar|AZA|d|#C8101A|#FFFFFF|#111|#FFFFFF",
    "Feyenoord|FEY|m|#E8101A|#FFFFFF|#fff|#111111",
    "Fortuna Sittard|FOR|s|#1E4A3A||#F5E000",
    "Go Ahead Eagles|GAE|v|#C8103A|#FFD400|#111|#FFD400",
    "Groningen|GRO|s|#1A9A5A||#fff",
    "Heerenveen|HEE|d|#1A55B0|#FFFFFF|#E0101A|#FFFFFF",
    "Heracles Almelo|HER|v|#111111|#FFFFFF|#fff|#111111",
    "NAC Breda|NAC|d|#111111|#F5E000|#111|#F5E000",
    "NEC Nijmegen|NEC|m|#E0302A|#1A8A5A|#fff|#111111",
    "PEC Zwolle|PEC|h|#78C0EA|#1A55B0|#fff",
    "PSV Eindhoven|PSV|r|#FFFFFF|#E0202A|#111|#FFFFFF",
    "RKC Waalwijk|RKC|s|#FFE830||#2A5AB0",
    "Sparta Rotterdam|SPA|v|#E0203A|#FFFFFF|#111|#FFFFFF",
    "Twente|TWE|s|#E0102A||#fff",
    "Utrecht|UTR|d|#E0203A|#FFFFFF|#fff|#111111",
    "Willem II|WIL|r|#FFFFFF|#C8202A|#fff|#2A2E5A",
    // ---- PRO LEAGUE (BÉLGICA) ----
    "Anderlecht|AND|s|#6A3A9A||#fff",
    "Antwerp|ANT|h|#E0102A|#FFFFFF|#E0102A",
    "Beerschot|BEE|d|#5A3A8A|#FFFFFF|#fff",
    "Cercle Brugge|CER|s|#5AB030||#111",
    "Charleroi|CHA|v|#111111|#FFFFFF|#fff|#111111",
    "Club Brugge|CLU|v|#111111|#1A7AC8|#fff|#111111",
    "Dender|DEN|m|#E0202A|#2A3A9A|#fff|#E0202A",
    "Genk|GEN|h|#1A55B0|#FFFFFF|#1A4CA0",
    "Gent|GNT|s|#1E5AB8||#fff",
    "Kortrijk|KOR|s|#E0102A||#fff",
    "Mechelen|MEC|v|#E0302A|#F5E000|#111|#F5E000",
    "OH Leuven|OHL|d|#FFFFFF|#111111|#D0202A",
    "Sint-Truiden|STVV|s|#F5D840||#1A55B0",
    "Standard Liège|STA|s|#E8202A||#fff",
    "Union Saint-Gilloise|USG|h|#F5E000|#1A7AC8|#111|#F5E000",
    "Westerlo|WES|s|#14508A||#E8C030",
    "Zulte Waregem|ZUL|m|#D0103A|#1A8A4A|#fff|#D0103A",
    // ---- SÜPER LIG (TURQUÍA) ----
    "Adana Demirspor|ADA|s|#88C4EE||#14205A",
    "Alanyaspor|ALA|m|#F08A2A|#3A9A40|#111|#F08A2A",
    "Antalyaspor|ANT|s|#E0202A||#fff",
    "Başakşehir|IBB|v|#14305A|#F0601A|#fff|#14305A",
    "Beşiktaş|BJK|v|#111111|#FFFFFF|#E0101A|#FFFFFF",
    "Bodrum FK|BOD|m|#2A6A40|#FFFFFF|#fff|#2A6A40",
    "Çaykur Rizespor|RIZ|v|#2A3A9A|#3A8A3A|#fff|#2A3A9A",
    "Eyüpspor|EYU|d|#6A3AA8|#F5D000|#F5D000",
    "Fenerbahçe|FEN|v|#14306A|#F5E80A|#14306A|#F5E80A",
    "Galatasaray|GAL|m|#A8202A|#F0A030|#fff|#A8202A",
    "Gaziantep FK|GFK|v|#E0302A|#222222|#fff|#E0302A",
    "Göztepe|GOZ|v|#F5D800|#E0202A|#111|#F5D800",
    "Hatayspor|HAT|s|#7A3030||#fff",
    "Kasımpaşa|KAS|s|#3A55B0||#fff",
    "Kayserispor|KAY|m|#B8202A|#F5C030|#F5C030|#B8202A",
    "Konyaspor|KON|s|#0E7A4A||#fff",
    "Samsunspor|SAM|h|#E0202A|#FFFFFF|#111",
    "Sivasspor|SIV|s|#D8102A||#fff",
    "Trabzonspor|TRA|m|#5A1428|#88C0EA|#88C0EA|#5A1428",
    // ---- LIGA DE CHEQUIA ----
    "Baník Ostrava|OST|d|#1A6AA8|#E0202A|#fff",
    "Bohemians 1905|BOH|v|#0E9A4A|#FFFFFF|#fff|#0E9A4A",
    "České Budějovice|CBU|v|#222222|#FFFFFF|#fff|#222222",
    "Dukla Praha|DUK|h|#6A1A20|#F5C030|#F5C030|#6A1A20",
    "Hradec Králové|HRA|v|#333333|#FFFFFF|#fff|#333333",
    "Jablonec|JAB|s|#0E3A20||#fff",
    "Karviná|KAR|s|#0E8A40||#fff",
    "Mladá Boleslav|MLB|v|#14385A|#B8E0F2|#14385A|#FFFFFF",
    "Pardubice|PAR|s|#D8202A||#fff",
    "Sigma Olomouc|SIG|h|#1A5AA0|#FFFFFF|#1A55A8",
    "Slavia Praha|SLA|m|#D8303A|#FFFFFF|#111|#FFFFFF",
    "Slovan Liberec|LIB|m|#5A9AEA|#111111|#fff|#111111",
    "Sparta Praha|SPA|s|#111111||#fff",
    "Teplice|TEP|s|#F5C020||#1A3AB0",
    "Viktoria Plzeň|PLZ|v|#C8101A|#1A1AB0|#fff|#C8101A",
    "Zbrojovka Brno|BRN|d|#E01A2A|#FFFFFF|#1A3AA0|#FFFFFF",
    // ---- LIGA DE GRECIA ----
    "AEK Atenas|AEK|s|#F5D010||#222",
    "Aris|ARI|v|#222222|#F5D010|#222|#F5D010",
    "Asteras Tripolis|AST|s|#2A3E9A||#F5E000",
    "Atromitos|ATR|d|#FFFFFF|#3A6AC0|#14205A",
    "Kallithea|KAL|s|#C0A870||#111",
    "Lamia|LAM|s|#14208A||#fff",
    "Levadiakos|LEV|v|#3A55B0|#70C070|#3A55B0|#FFFFFF",
    "OFI|OFI|s|#111111||#fff",
    "Olympiacos|OLY|h|#E0303A|#FFFFFF|#E0303A",
    "Panathinaikos|PAO|s|#0E7A40||#fff",
    "Panetolikos|PAN|m|#F5D820|#1A4CC0|#1A3AB0|#F5D820",
    "PAOK|PAOK|v|#222222|#FFFFFF|#fff|#222222",
    "Panserraikos|PSR|s|#FFFFFF||#E0202A",
    "Volos|VOL|v|#2A3A8A|#E0102A|#fff|#E0102A",
    // ---- LIGA DE POLONIA ----
    "Cracovia|CRA|h|#D0203A|#FFFFFF|#D0203A",
    "GKS Katowice|GKS|v|#222222|#2A8A3A|#111|#F5D800",
    "Górnik Zabrze|GOR|m|#2A3AA0|#FFFFFF|#2A3AA0|#FFFFFF",
    "Jagiellonia|JAG|d|#F5F000|#E0202A|#111",
    "Korona Kielce|KOR|v|#F5E000|#E0302A|#111|#F5E000",
    "Lech Poznań|LPO|s|#1A4CA0||#fff",
    "Lechia Gdańsk|LGD|h|#2E7A3A|#FFFFFF|#2E7A3A",
    "Legia Varsovia|LEG|m|#0E8A3A|#FFFFFF|#111|#FFFFFF",
    "Motor Lublin|MOT|h|#3A4A9A|#F0E020|#2A3A9A",
    "Piast Gliwice|PIA|m|#1A4CA0|#E0102A|#fff|#1A4CA0",
    "Pogoń Szczecin|POG|v|#14205A|#8A1E2A|#F5D000|#14205A",
    "Radomiak Radom|RAD|h|#1A8A3A|#FFFFFF|#1A8A3A",
    "Raków|RAK|d|#1A4CB0|#E0102A|#fff",
    "Stal Mielec|STM|d|#1A90D8|#FFFFFF|#222|#FFFFFF",
    "Śląsk Wrocław|SLA|s|#0E4A3A||#fff",
    "Widzew Łódź|WID|d|#E8101A|#FFFFFF|#E8101A|#FFFFFF",
    "Wisła Płock|WPL|v|#3A70C0|#FFFFFF|#fff|#3A70C0",
    "Zagłębie Lubin|ZAG|v|#F07A1A|#1A9A4A|#111|#FFFFFF",
    // ---- LIGA DE DINAMARCA ----
    "AaB|AAB|s|#E8202A||#fff",
    "AGF|AGF|d|#FFFFFF|#E0402A|#E0402A",
    "Brøndby|BIF|s|#0A2A8A||#F5D000",
    "Copenhagen|FCK|s|#3A55A0||#fff",
    "Fredericia|FRE|h|#B8101A|#FFFFFF|#B8101A",
    "Horsens|HOR|s|#FFE000||#111",
    "Lyngby|LYN|s|#0E3A70||#fff",
    "Midtjylland|FCM|m|#111111|#B8102A|#fff|#111111",
    "Nordsjælland|FCN|s|#F5EE30||#E0202A",
    "Randers|RAN|s|#14205A||#fff",
    "SønderjyskE|SJE|h|#2A3A6A|#FFFFFF|#2A3A6A",
    "Vejle|VEJ|s|#D0103A||#fff",
    // ---- LIGA DE NORUEGA ----
    "Bodø/Glimt|BOD|s|#FFE000||#111",
    "Brann|BRA|h|#FFFFFF|#C0101A|#fff",
    "Bryne|BRY|h|#E8302A|#FFFFFF|#2A9A3A",
    "Fredrikstad|FFK|m|#D8303A|#FFFFFF|#fff|#D8303A",
    "HamKam|HAM|s|#2A8A3A||#fff",
    "Haugesund|HAU|s|#1E6AB0||#fff",
    "KFUM Oslo|KFU|h|#E0202A|#1E70C0|#fff",
    "Kristiansund|KBK|s|#14244A||#fff",
    "Molde|MOL|h|#1A70B8|#FFFFFF|#1A6AB0",
    "Rosenborg|RBK|v|#111111|#FFFFFF|#fff|#111111",
    "Sandefjord|SAN|m|#C0203A|#1A5A9A|#fff|#1A5A9A",
    "Sarpsborg 08|SAR|s|#2A4AA8||#fff",
    "Strømsgodset|STR|m|#E0303A|#2A3A7A|#F5C030|#2A3A7A",
    "Tromsø|TRO|d|#D8202A|#FFFFFF|#111|#FFFFFF",
    "Vålerenga|VIF|h|#1A4CA0|#FFFFFF|#E0202A",
    "Viking|VIK|s|#7A1A24||#E0C070",
    // ---- PREMIERSHIP (ESCOCIA) ----
    "Aberdeen|ABE|s|#E0101A||#fff",
    "Celtic|CEL|r|#FFFFFF|#0E9A50|#0E9A50|#FFFFFF",
    "Dundee|DUN|s|#FFFFFF||#14204A",
    "Dundee United|DUU|m|#FF6A10|#111111|#111|#FF6A10",
    "Hearts|HEA|s|#A02030||#F5C060",
    "Hibernian|HIB|s|#0E7A40||#fff",
    "Kilmarnock|KIL|v|#2A3060|#FFFFFF|#fff|#2A3060",
    "Motherwell|MOT|h|#F5B020|#7A1A3A|#7A1A3A|#F5B020",
    "Rangers|RAN|s|#0A2AA0||#fff",
    "Ross County|ROS|h|#2A2A5A|#FFFFFF|#2A2A5A",
    "St Johnstone|STJ|s|#1A5AA8||#C8B060",
    "St Mirren|STM|v|#111111|#FFFFFF|#fff|#111111"
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
  alias("Alcorcón", "AD Alcorcón");
  alias("Angers SCO", "Angers");
  alias("Arenas de Getxo", "Arenas Club");
  alias("AEK Athens", "AEK Atenas");
  alias("AGF Aarhus", "AGF");
  alias("Atromitos Athens", "Atromitos");
  alias("At. Sanlueño", "At. Sanluqueño");
  alias("B. Mönchengladbach", "Borussia Mönchengladbach");
  alias("Betis Deportivo", "Real Betis B");
  alias("Brighton", "Brighton & Hove Albion");
  alias("FC København", "Copenhagen");
  alias("FK Bodo Glimt", "Bodø/Glimt");
  alias("GFS Panetolikos", "Panetolikos");
  alias("Gimnàstic Tarragona", "Gimnàstic");
  alias("Heart of Midlothian", "Hearts");
  alias("Jagiellonia Białystok", "Jagiellonia");
  alias("KAA Gent", "Gent");
  alias("KFUM-Kameratene", "KFUM Oslo");
  alias("KM Westerlo", "Westerlo");
  alias("KRC Genk", "Genk");
  alias("KV Kortrijk", "Kortrijk");
  alias("KV Mechelen", "Mechelen");
  alias("Legia Warszawa", "Legia Varsovia");
  alias("Montpellier HSC", "Montpellier");
  alias("NPS Volos", "Volos");
  alias("Nice", "Niza");
  alias("OFI Crete", "OFI");
  alias("Olympique Lyonnais", "Lyon");
  alias("Olympique de Marsella", "Marsella");
  alias("PSV", "PSV Eindhoven");
  alias("RSC Anderlecht", "Anderlecht");
  alias("Raków Częstochowa", "Raków");
  alias("Rangers FC", "Rangers");
  alias("Real Avilés Industrial", "Real Avilés");
  alias("Real Unión Club", "Real Unión");
  alias("Recreativo", "Recreativo de Huelva");
  alias("SL Benfica", "Benfica");
  alias("Sint-Truidense VV", "Sint-Truiden");
  alias("Sporting Charleroi", "Charleroi");
  alias("Stade Brestois", "Brest");
  alias("Stade Rennais", "Rennes");
  alias("Stade de Reims", "Reims");
  alias("Standard de Lieja", "Standard Liège");
  alias("Tottenham", "Tottenham Hotspur");
  alias("Tromsø IL", "Tromsø");
  alias("VfL Wolfsburg", "Wolfsburg");
  alias("Vitória SC", "Vitória de Guimarães");
  alias("West Ham", "West Ham United");
  alias("Wolves", "Wolverhampton Wanderers");
  alias("Marino", "Marino de Luanco");
  alias("Ironi Kiryat Shmona", "Hapoel Kiryat Shmona");
  alias("Inter Club d'Escaldes", "Inter Escaldes");
  alias("GC Zürich", "Grasshopper");
  alias("Corvinul 1921", "Hunedoara");
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
