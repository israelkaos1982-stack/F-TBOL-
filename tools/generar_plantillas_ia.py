#!/usr/bin/env python3
"""Genera data/plantillas_ia.json (compacto) a partir de los 3 textos de plantillas.
Uso: python3 tools/generar_plantillas_ia.py selecciones.txt clubes1.txt [clubes2.txt ...]
Formato de salida: {"_meta":..., "c": {clave_club: "P:a,b/D:c/M:d/L:e"}, "s": {clave_seleccion: ...}}
Códigos de posición: P=POR D=DEF M=MED L=DEL (se expanden en js/acta.js)."""
import json, re, sys, unicodedata

COD = {"Por": "P", "Def": "D", "Med": "M", "Del": "L", "?": "M"}   # posición desconocida -> Med (candidato a goleador)


# nombre del equipo EN EL JUEGO (data/rivales_reales.json, normalizado) -> clave del texto de plantillas.
# Solo parejas confirmadas a mano; el resto se resuelve por nombre exacto o coincidencia parcial segura en js/acta.js.
ALIAS = {
    "b. monchengladbach": "borussia monchengladbach", "sc freiburg": "friburgo", "hamburger sv": "hamburgo",
    "olympique lyonnais": "lyon", "strasbourg": "estrasburgo", "estrela amadora": "estrela da amadora",
    "vitoria sc": "vitoria guimaraes", "sint-truidense vv": "sint-truiden", "standard de lieja": "standard lieja",
    "union saint-gilloise": "union sg", "erzurum fk": "erzurumspor", "kas\u0131mpasa": "kasimpasa",
    "aek athens": "aek atenas", "legia warszawa": "legia varsovia", "fk bodo glimt": "bodø/glimt",
    "kfum-kameratene": "kfum oslo", "dundee united": "dundee utd", "heart of midlothian": "hearts",
    "fc zurich": "zurich", "fk austria wien": "austria viena", "rapid wien": "rapid viena",
    "beitar jerusalem": "beitar jerusalen", "hapoel jerusalem fc": "hapoel jerusalen",
    "djurgardens if": "djurgarden", "halmstads bk": "halmstad", "cska moskva": "cska moscu",
    "spartak moskva": "spartak moscu", "dynamo kyiv": "dinamo kiev", "debreceni vsc": "debrecen",
    "paksi fc": "paks", "zalaegerszegi te": "zalaegerszeg", "cfr 1907 cluj": "cfr cluj",
    "univ. craiova": "u craiova", "fc univ. cluj": "u cluj", "brinje-grosuplje": "brinje grosuplje",
    "sumqay\u0131t fk": "sumqayit", "st patrick's athletic": "st patrick's", "breidablik": "breiðablik",
    "vaprus parnu": "parnu jk vaprus", "narva trans": "trans narva", "cardiff mu": "cardiff met",
    "tefelin bgc": "trefelin bgc", "fc bruno's magpies": "fcb magpies", "st joseph's fc": "st. joseph's",
    "las palmas at.": "las palmas atletico", "pvo. el ejido": "poli ejido", "sevilla at.": "sevilla atletico",
    "at. sanlueño": "at. sanluqueno", "blau-weiß linz": "blau-weiss linz", "corvinul 1921": "corvinul 1921 hunedoara",
    "fc dinamo 1948": "fc dinamo 1948 bucarest",
    "ml vitebsk": "maxline vitebsk", "fc vitebsk": "vitebsk", "dynamo brest": "dinamo brest",
    "Bayern München": "bayern munich", "B. Leverkusen": "bayer leverkusen", "Colonia": "koln",
    "Stade Rennais": "rennes", "Nice": "niza", "Stade Brestois": "brest", "Crvena Zvezda": "estrella roja",
    "Red Bull Salzburg": "salzburgo", "SC Braga": "sporting braga", "FC Basel": "basilea", "Amed": "amedspor",
    "Bohemian FC": "bohemians", "FC Lustenau": "austria lustenau", "FH Hafnarfjordur": "fh",
    "Şamaxı FK": "shamakhi", "Kəpəz PFK": "kapaz", "Qəbələ FK": "qabala", "Şəfa FK": "safa",
}

def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn").strip()

def parsear(ruta):
    equipos, actual, seccion = [], None, ""
    for lin in open(ruta, encoding="utf-8"):
        lin = lin.strip()
        if not lin or lin == "---":
            continue
        if lin.startswith("########"):
            seccion = lin.strip("# ").strip()
            actual = None
            continue
        if seccion.startswith("SIN PLANTILLA") or seccion.startswith("RESTO DEL MUNDO"):
            continue
        m = re.match(r"^(.+?) - (\d+|\?|sin ELO|sin nivel)$", lin)
        if m:
            actual = {"n": m.group(1).strip(), "j": [], "nivel": int(m.group(2)) if m.group(2).isdigit() else None}
            equipos.append(actual)
            continue
        m = re.match(r"^(?:🧤)?\s*(.+?) \((Por|Def|Med|Del|\?)\)$", lin)
        if m and actual is not None:
            actual["j"].append((m.group(1).strip(), COD[m.group(2)]))
    return equipos

def codificar(jug):
    por = {}
    for nom, c in jug:
        por.setdefault(c, []).append(nom.replace(",", " "))
    return "/".join(c + ":" + ",".join(por[c]) for c in "PDML" if c in por)

def main(sel, *otros):
    out = {"_meta": {
        "descripcion": "Plantillas REALES de equipos IA (5 mejores por club/seleccion; 11 titulares en Liga EA Sports/Hypermotion). Solo las lee js/acta.js cuando un humano juega contra una IA (carga perezosa, jamás se sincroniza ni se guarda en localStorage). Regenerar con tools/generar_plantillas_ia.py.",
        "codigos": "P=POR D=DEF M=MED L=DEL", "a": "alias: nombre del equipo en el juego (normalizado) -> clave de c"}, "c": {}, "s": {}, "a": {}}
    for e in parsear(sel):
        if e["j"]: out["s"][norm(e["n"])] = codificar(e["j"])
    for ruta in otros:
        for e in parsear(ruta):
            k = norm(e["n"])
            if not e["j"]: continue          # "sin alineación": solo hay nivel, no plantilla
            if k in out["c"]:
                print("DUPLICADO", k, file=sys.stderr)
            out["c"][k] = codificar(e["j"])
    for juego, clave in ALIAS.items():
        if clave in out["c"]:
            out["a"][norm(juego)] = clave
        else:
            print("ALIAS sin plantilla:", juego, "->", clave, file=sys.stderr)
    txt = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    open("data/plantillas_ia.json", "w", encoding="utf-8").write(txt)
    print(len(out["c"]), "clubes,", len(out["s"]), "selecciones,", len(txt.encode()), "bytes")

if __name__ == "__main__":
    main(*sys.argv[1:])
