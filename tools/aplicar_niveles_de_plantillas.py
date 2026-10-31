#!/usr/bin/env python3
"""Los textos de plantillas llevan el NIVEL del equipo en la cabecera ("MÁLAGA - 78").
Este script lo aplica a valoracionPoder de data/rivales_reales.json y data/equipos_ia.json.
Uso: python3 tools/aplicar_niveles_de_plantillas.py f1.txt f2.txt ... [--aplicar]"""
import json, sys, re, importlib.util, collections, unicodedata
spec = importlib.util.spec_from_file_location("ap", "tools/aplicar_niveles_colores.py")
ap = importlib.util.module_from_spec(spec); spec.loader.exec_module(ap)
norm, nucleo, parcial = ap.norm, ap.nucleo, ap.parcial

def leer_niveles(ruta):
    out, sec = [], ""
    for lin in open(ruta, encoding="utf-8"):
        lin = lin.strip()
        if lin.startswith("########"): sec = lin.strip("# ").strip(); continue
        if sec.startswith("SIN PLANTILLA") or sec.startswith("RESTO DEL MUNDO") or sec.startswith("SELECCIONES"): continue
        m = re.match(r"^(.+?) - (\d+)$", lin)
        if m: out.append((m.group(1).strip(), int(m.group(2))))
    return out

def main(rutas, aplicar):
    R = json.load(open("data/rivales_reales.json", encoding="utf-8"))
    IA = json.load(open("data/equipos_ia.json", encoding="utf-8"))
    equipos = R["rivales"] + [t for b in IA["bloques"].values() for t in b["equipos"]]
    idx = collections.defaultdict(list)
    for t in equipos:
        for n in [t["nombre"]] + list(t.get("nombresAlt", [])): idx[norm(n)].append(t)
    textos = {}
    for ruta in rutas:
        for n, niv in leer_niveles(ruta): textos[norm(n)] = (n, niv)
    cambios, sin, difs = 0, [], []
    for k, (n, niv) in textos.items():
        c = list(idx.get(k, []))
        for a in ap.ALIAS_INV.get(k, ()): c += idx.get(a, [])
        if not c:
            mejor, md, emp = [], 1e9, False
            for kk, ts in idx.items():
                if parcial(kk, k) and k not in ap.RECHAZAR:
                    d = abs(len(kk) - len(k))
                    if d < md: md, mejor, emp = d, ts, False
                    elif d == md and ts != mejor: emp = True
            c = [] if emp else list(mejor)
        c = list({id(x): x for x in c}.values())
        if not c: sin.append(n); continue
        for t in c:
            if t["valoracionPoder"] != niv:
                difs.append((t["nombre"], t["valoracionPoder"], niv))
                t["valoracionPoder"] = niv; cambios += 1
    print("textos con nivel:", len(textos), "| fichas con nivel distinto (cambiadas):", cambios, "| sin equipo en el juego:", len(sin))
    print("EJEMPLOS:", difs[:25]); print("SIN EQUIPO:", " | ".join(sin))
    if aplicar:
        json.dump(R, open("data/rivales_reales.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        json.dump(IA, open("data/equipos_ia.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print("ESCRITO")

if __name__ == "__main__":
    main([a for a in sys.argv[1:] if not a.startswith("--")], "--aplicar" in sys.argv)
