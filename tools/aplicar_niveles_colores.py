#!/usr/bin/env python3
"""Aplica NIVELES (valoracionPoder) y COLORES de un texto 'NOMBRE|nivel|colores' a data/rivales_reales.json.
Uso: python3 tools/aplicar_niveles_colores.py niveles.txt [--aplicar]
Sin --aplicar solo informa (no escribe)."""
import json, re, sys, unicodedata, importlib.util, collections

def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn").strip()

spec = importlib.util.spec_from_file_location("gen", "tools/generar_plantillas_ia.py")
gen = importlib.util.module_from_spec(spec); spec.loader.exec_module(gen)
ALIAS_INV = collections.defaultdict(set)   # clave del texto -> nombres del juego (normalizados)
for juego, clave in gen.ALIAS.items():
    ALIAS_INV[norm(clave)].add(norm(juego))

HEX = {
    "rojo": "#D7191F", "amarillo": "#F7C600", "azul": "#1F5FBF", "azul oscuro": "#0B2A5B", "azul marino": "#0B2A5B",
    "azul celeste": "#5FB0EA", "azul real": "#2A4FD0", "azul saboya": "#0A4AA6", "azul francia": "#0055A4",
    "blanco": "#FFFFFF", "negro": "#111111", "verde": "#1B8A3A", "verde claro": "#7ED957", "verde pistacho": "#A8C686",
    "naranja": "#F28C1C", "granate": "#7A1230", "burdeos": "#7A1230", "morado": "#6A2C91", "violeta": "#6A2C91",
    "purpura": "#6A2C91", "malva": "#B48CC8", "dorado": "#C9A227", "gris": "#8A8F98", "rosa": "#E86FA5",
    "marron": "#6B3F1D", "marron oxido": "#8B4513", "beige": "#D8C7A3", "cobre": "#B87333",
}

def colores(txt):
    txt = norm(txt)
    if "sin confirmar" in txt: return None
    partes = [p.strip() for p in re.split(r",| y ", txt) if p.strip()]
    # "azul celeste y blanco" -> re-une colores de dos palabras
    out = []
    for p in partes:
        if p in HEX: out.append(HEX[p])
        else:
            print("  COLOR DESCONOCIDO:", p, file=sys.stderr)
    return out or None

FIL = re.compile(r"\s(b|c|d|ii|iii|at\.?|promesas|castilla|fortuna|vetusta|cantabria)$")
def _suf(n):
    m = FIL.search(n); return m.group(1) if m else ""
def parcial(a, b):
    """Misma idea que _coincideParcialSeguro de js/renderizadores.js: palabras completas, nunca filiales."""
    if a == b: return True
    if _suf(a) != _suf(b): return False
    c, l = (a, b) if len(a) <= len(b) else (b, a)
    if len(c) <= 2 or not re.search(r"(^|[^a-z0-9])" + re.escape(c) + r"($|[^a-z0-9])", l): return False
    resto = l.replace(c, " ", 1).strip()
    return not re.match(r"^(b|c|d|ii|iii|at\.?|promesas|castilla|fortuna|vetusta|cantabria|ilicitano|juvenil|sub-?\d+)$", resto) and not re.match(r"^(atletico|athletic)\b", resto)

def leer(ruta):
    sec, out = None, []
    for lin in open(ruta, encoding="utf-8"):
        lin = lin.strip()
        if lin in ("@S", "@C"): sec = lin[1]; continue
        if not lin: continue
        n, niv, col = lin.split("|")
        out.append((sec, n, None if niv == "-" else int(niv), colores(col)))
    return out

# Parciales que el emparejador propone pero son OTRO club (verificado a mano) -> se crean como equipo nuevo.
RECHAZAR = {"aris", "arsenal dzyarzhynsk", "arsenal tivat", "inter escaldes", "san marino academy", "racing union", "fc rangers"}
NO_CREAR = {"fc rangers"}   # chocaría con "Rangers FC" (Escocia) al escribir "Rangers" a secas
MULTI = {"bayer leverkusen"}      # el juego lo tiene con 2 grafías: se aplica a las dos
ACR = {"fc","fk","sk","nk","kf","ac","ab","hb","ki","nsi","ia","ibv","kr","ka","fh","rfs","cska","lnz","ofk","imt","mtk","ifk","vps",
       "sjk","tps","ff","hjk","us","utm","bkma","dac","fcsb","gks","uta","fcb","jk","ue","ce","pfk","gais","aik","sc","rb","bsk","af","ml","dg"}
FORMATOS = ["rayas", "solido", "mitad", "rombo", "cuartos", "diana", "rayas-h", "mitad-v"]

def _cap(w):
    if norm(w) in ACR and w.isupper(): return w
    partes = re.split(r"([-'])", w)
    return "".join(x if x in "-'" else (x.lower() if (x.lower() == "s" and i > 0 and partes[i-1] == "'") else x.capitalize()) for i, x in enumerate(partes))

def titulo(n):
    return " ".join(_cap(w) if not re.search(r"\d", w) or len(w) > 3 else w.upper() for w in n.split())

def siglas(n):
    # 3 primeras letras de la primera palabra con significado (se saltan FC/FK/SK/NK...)
    ws = [w for w in re.split(r"[^a-z0-9]+", norm(n)) if w and w not in ACR]
    return (ws[0] if ws else norm(n))[:3].upper()

def hashstr(s):
    h = 0
    for ch in s: h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return h

def main(ruta, aplicar):
    datos = json.load(open("data/rivales_reales.json", encoding="utf-8"))
    R = datos["rivales"]
    idx = collections.defaultdict(list)
    for r in R:
        for n in [r["nombre"]] + list(r.get("nombresAlt", [])) + list(r.get("alias", []) if isinstance(r.get("alias"), list) else []):
            idx[norm(n)].append(r)
    toca = collections.OrderedDict()
    sin = []
    for sec, n, niv, col in leer(ruta):
        if sec == "S": continue
        k = norm(n)
        c = list(idx.get(k, []))
        for a in ALIAS_INV.get(k, ()):
            c += idx.get(a, [])
        c = list({id(x): x for x in c}.values())
        if len(c) > 1 and k in MULTI:
            for r in c: toca[id(r)] = (n, r, niv, col)
            continue
        if len(c) == 1:
            r = c[0]
            if id(r) in toca: print("  DOBLE:", n, "->", r["nombre"], "ya tocado por", toca[id(r)][0])
            toca[id(r)] = (n, r, niv, col)
        elif len(c) > 1:
            print("  AMBIGUO:", n, [x["nombre"] for x in c])
        else:
            mejor, md, emp = None, 1e9, False
            for kk, rs in idx.items():
                if parcial(kk, k):
                    d = abs(len(kk) - len(k))
                    if d < md: md, mejor, emp = d, rs, False
                    elif d == md and rs != mejor: emp = True
            if mejor and not emp and len(mejor) == 1 and k not in RECHAZAR:
                r = mejor[0]
                print("  PARCIAL:", n, "->", r["nombre"])
                toca[id(r)] = (n, r, niv, col)
            else:
                sin.append(n)
    print(len(toca), "equipos del juego emparejados;", len(sin), "del texto sin equipo en el juego")
    print("SIN EQUIPO:", " | ".join(sin))
    cambios = 0
    for _, (n, r, niv, col) in toca.items():
        if niv is not None and r.get("valoracionPoder") != niv:
            r["valoracionPoder"] = niv; cambios += 1
        if col:
            r["colorPrimario"] = col[0]
            r["colorSecundario"] = col[1] if len(col) > 1 else ("#FFFFFF" if col[0].upper() != "#FFFFFF" else "#111111")
            if len(col) > 2: r["colorTerciario"] = col[2]
            else: r.pop("colorTerciario", None)
    print("cambios de nivel:", cambios)
    # equipos del texto que el juego no tiene: se AÑADEN como ficha nueva (así el color/nivel les llega en cualquier pantalla)
    nuevos = 0
    existentes = {r["clave"] for r in R}
    for sec, n, niv, col in leer(ruta):
        if sec == "S" or n not in sin or not col or niv is None or norm(n) in NO_CREAR: continue
        clave = norm(n)
        if clave in existentes: continue
        ficha = {"clave": clave, "nombre": titulo(n), "siglas": siglas(n), "colorPrimario": col[0],
                 "colorSecundario": col[1] if len(col) > 1 else "#FFFFFF",
                 "escudoFormato": FORMATOS[hashstr(clave) % len(FORMATOS)], "valoracionPoder": niv}
        if len(col) > 2: ficha["colorTerciario"] = col[2]
        R.append(ficha); existentes.add(clave); nuevos += 1
    print("fichas nuevas:", nuevos)
    # selecciones: fichero aparte, muy pequeño ({clave: [nivel, color1, color2(, color3)]})
    sels = {}
    for sec, n, niv, col in leer(ruta):
        if sec != "S" or not col: continue
        sels[norm(n)] = [niv if niv is not None else 75] + [c for c in col[:3]] + ([] if len(col) > 1 else ["#FFFFFF"])
    print("selecciones:", len(sels))
    if aplicar:
        open("data/selecciones_ia.json", "w", encoding="utf-8").write(json.dumps(sels, ensure_ascii=False, separators=(",", ":")))
        json.dump(datos, open("data/rivales_reales.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print("ESCRITO")

if __name__ == "__main__":
    main(sys.argv[1], "--aplicar" in sys.argv)
