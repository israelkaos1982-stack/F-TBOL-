#!/usr/bin/env python3
"""Añade/actualiza plantillas en data/plantillas_ia.json SIN regenerarlo entero, a partir de un
texto "sin plantilla" (bloques separados por "==========", cabecera "NOMBRE - nivel" y 11 jugadores
"Nombre (Por|Def|Med|Del)"). Las selecciones van hasta el primer encabezado de país (GALES, ESPAÑA...);
lo demás son clubes. También aplica el nivel a data/selecciones_ia.json (selecciones).
Uso: python3 tools/anadir_plantillas.py texto.txt [--aplicar]"""
import json, re, sys, importlib.util
spec = importlib.util.spec_from_file_location("g", "tools/generar_plantillas_ia.py")
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)

def leer(ruta):
    sel, actual, out = True, None, []
    for lin in open(ruta, encoding="utf-8"):
        lin = lin.strip()
        if not lin or lin in ("---", "==========", "SELECCIONES"): continue
        m = re.match(r"^(.+?) - (\d+|N/D)$", lin)
        if m:
            actual = {"n": m.group(1).strip(), "sel": sel, "nivel": int(m.group(2)) if m.group(2).isdigit() else None, "j": []}
            out.append(actual); continue
        m = re.match(r"^(?:🧤)?\s*(.+?) \((Por|Def|Med|Del)\)$", lin)
        if m and actual is not None:
            actual["j"].append((m.group(1).strip(), g.COD[m.group(2)])); continue
        if actual is not None or not sel: sel = False   # encabezado de país (clubes)
        actual = None if not m else actual
    return out

def main(ruta, aplicar):
    P = json.load(open("data/plantillas_ia.json", encoding="utf-8"))
    S = json.load(open("data/selecciones_ia.json", encoding="utf-8"))
    ns = nc = 0
    for e in leer(ruta):
        if not e["j"]: continue
        k = g.norm(e["n"])
        if e["sel"]:
            P["s"][k] = g.codificar(e["j"]); ns += 1
            if e["nivel"] is not None and k in S: S[k][0] = e["nivel"]
        else:
            P["c"][k] = g.codificar(e["j"]); nc += 1
        print(("SEL " if e["sel"] else "CLUB"), e["n"], e["nivel"], len(e["j"]), "jug.")
    print("selecciones:", ns, "clubes:", nc)
    if aplicar:
        json.dump(P, open("data/plantillas_ia.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        json.dump(S, open("data/selecciones_ia.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        print("ESCRITO")

if __name__ == "__main__":
    main([a for a in sys.argv[1:] if not a.startswith("--")][0], "--aplicar" in sys.argv)
