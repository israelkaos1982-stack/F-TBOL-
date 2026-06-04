#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GUARDIÁN DE SINTAXIS JS  (F-TBOL)
=================================

Detecta la clase de error que rompe la web entera sin previo aviso:
un comentario mal cerrado / `*/` dentro de un comentario / una llave sin
cerrar dentro de un bloque <script>. Cuando eso pasa, el NAVEGADOR deja
de ejecutar TODO ese <script> (SyntaxError) y pantallas enteras del juego
se quedan en blanco (la card del hub, las estadísticas, etc.).

Qué hace:
  - Recorre los .html con bloques <script> y los .js del proyecto.
  - Extrae cada bloque <script>…</script> y lo pasa por `node --check`
    (el MISMO motor V8 del navegador), así que si node dice "error",
    el navegador también fallaría.
  - Reporta el ARCHIVO y la LÍNEA REAL del problema.

Uso manual (gratis, sin pagar nada):
    python3 tools/check_js_blocks.py

Devuelve código de salida != 0 si encuentra algún error (para que un
hook de git / Claude pueda bloquear el commit).
"""
import os, sys, subprocess, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Archivos a vigilar. Añade aquí cualquier .html/.js nuevo con JS.
TARGETS = [
    "templates/partials/misc_body_1.html",
    "templates/partials/part2/misc_body_2.html",
]
# Todos los .js de static/js/ (si existe la carpeta).
JS_DIR = os.path.join(ROOT, "static", "js")
if os.path.isdir(JS_DIR):
    for f in sorted(os.listdir(JS_DIR)):
        if f.endswith(".js"):
            TARGETS.append(os.path.join("static", "js", f))


def node_check(code, fake_line_offset=0):
    """Pasa `code` por node --check. Devuelve (ok, err_line, err_msg).
    `fake_line_offset` = nº de líneas en blanco que se anteponen para que
    la línea reportada por node coincida con la línea real del archivo."""
    payload = ("\n" * fake_line_offset) + code
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False,
                                     encoding="utf-8") as tf:
        tf.write(payload)
        path = tf.name
    try:
        r = subprocess.run(["node", "--check", path],
                           capture_output=True, text=True)
        if r.returncode == 0:
            return True, None, None
        # node imprime:  /tmp/xxx.js:LINEA  \n  <texto> \n ^ \n SyntaxError: ...
        line_no = None
        msg = ""
        for ln in r.stderr.splitlines():
            if ln.startswith(path + ":"):
                try:
                    line_no = int(ln.split(":", 2)[1])
                except Exception:
                    pass
            if "SyntaxError" in ln:
                msg = ln.strip()
        return False, line_no, (msg or r.stderr.strip().splitlines()[-1])
    finally:
        try:
            os.unlink(path)
        except Exception:
            pass


def extract_script_blocks(lines):
    """Devuelve [(start_line_idx0, end_line_idx0_exclusive, code)] de cada
    bloque <script>…</script> cuyas etiquetas están solas en su línea."""
    blocks = []
    open_idx = None
    for i, l in enumerate(lines):
        s = l.strip()
        if open_idx is None:
            if s == "<script>" or s.startswith("<script "):
                open_idx = i
        else:
            if s == "</script>":
                code = "\n".join(lines[open_idx + 1:i])
                blocks.append((open_idx + 1, i, code))
                open_idx = None
    return blocks


def check_file(rel):
    path = os.path.join(ROOT, rel)
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    lines = text.split("\n")
    problems = []
    if rel.endswith(".js"):
        ok, ln, msg = node_check(text)
        if not ok:
            problems.append((rel, ln, msg))
    else:
        for (start, end, code) in extract_script_blocks(lines):
            # start = nº de línea (1-indexed) de la 1ª línea de código.
            ok, ln, msg = node_check(code, fake_line_offset=start)
            if not ok:
                problems.append((rel, ln, msg))
    return problems


def main():
    all_problems = []
    for rel in TARGETS:
        all_problems += check_file(rel)
    if all_problems:
        print("\n❌ SINTAXIS JS ROTA — el navegador NO ejecutaría estos bloques:\n")
        for (rel, ln, msg) in all_problems:
            loc = "%s:%s" % (rel, ln if ln else "?")
            print("   • %s" % loc)
            print("     %s" % msg)
        print("\n   Pista habitual: un comentario /* … */ mal cerrado, o un")
        print("   '*/' que aparece DENTRO del texto de un comentario (p.ej.")
        print("   'spv*/sfn'), o un '/*' borrado. Busca cerca de esa línea.\n")
        return 1
    print("✅ Sintaxis JS OK — todos los bloques <script> y .js compilan.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
