"""Tests de `strip_js_comments.py` (comentarios + indentación).

Stdlib pura: ejecutar con `python3 tests/test_strip_js_comments.py` (no
requiere pytest ni Flask, igual que `test_sync_merge.py`).
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from strip_js_comments import strip_html_js_comments  # noqa: E402

_fails = []


def check(name, cond):
    print(("ok  " if cond else "FAIL") + " · " + name)
    if not cond:
        _fails.append(name)


def _strip(js_body):
    html = "<script>" + js_body + "</script>"
    out, stats = strip_html_js_comments(html)
    inner = out[len("<script>"):-len("</script>")]
    return inner, stats


# ──────────────────────────────────────────────────────────────────
# La indentación de línea desaparece del código real, el \n se conserva
# ──────────────────────────────────────────────────────────────────
inner, stats = _strip("function f(){\n    var x = 1;\n        return x;\n}\n")
check("indentación quitada", inner == "function f(){\nvar x = 1;\nreturn x;\n}\n")
check("bloque marcado como stripped", stats["blocks_stripped"] == 1)

# ──────────────────────────────────────────────────────────────────
# El interior de un string NUNCA se toca, aunque tenga saltos de línea
# reales (string ilegal en JS de una línea, pero probamos el caso con
# \n escapado y con espacios AL PRINCIPIO del string, que sí es legal)
# ──────────────────────────────────────────────────────────────────
inner, _ = _strip("var s = '   indent inside string   ';\n    var t = 2;\n")
check(
    "espacios DENTRO de un string sobreviven",
    "'   indent inside string   '" in inner,
)
check("indentación FUERA del string sí se quita", "\nvar t = 2;" in inner)

# ──────────────────────────────────────────────────────────────────
# Template literal multilínea — la indentación DEL TEXTO LITERAL es
# significativa (puede construir HTML/CSS con formato) y debe sobrevivir
# BYTE A BYTE, aunque el código de fuera sí se desindente.
# ──────────────────────────────────────────────────────────────────
tpl_js = (
    "function build(){\n"
    "    var html = `\n"
    "        <div>\n"
    "            <span>x</span>\n"
    "        </div>\n"
    "    `;\n"
    "    return html;\n"
    "}\n"
)
inner, _ = _strip(tpl_js)
check(
    "el template literal completo sobrevive intacto",
    "`\n        <div>\n            <span>x</span>\n        </div>\n    `" in inner,
)
check("el código FUERA del template sí se desindenta", "function build(){\nvar html" in inner)

# ──────────────────────────────────────────────────────────────────
# Interpolación ${...} dentro de un template — su código no se toca
# (se mantiene el comportamiento previo, no se amplía el strip ahí)
# ──────────────────────────────────────────────────────────────────
tpl_interp = "var s = `a ${   1 + 2   } b`;\n    var t = 3;\n"
inner, _ = _strip(tpl_interp)
check("interpolación ${...} intacta", "${   1 + 2   }" in inner)

# ──────────────────────────────────────────────────────────────────
# Regex con comillas dentro de una clase de caracteres — no debe
# confundirse con el inicio de un string ni perder su indentación
# interna (los regex no tienen indentación real, pero el código
# ALREDEDOR sí debe desindentarse con normalidad).
# ──────────────────────────────────────────────────────────────────
regex_js = "function esc(s){\n    return s.replace(/['\"]/g, '');\n}\n"
inner, _ = _strip(regex_js)
check("regex con comillas dentro sobrevive intacto", "/['\"]/g" in inner)
check("código alrededor del regex se desindenta", "function esc(s){\nreturn s.replace" in inner)

# ──────────────────────────────────────────────────────────────────
# Comentarios de bloque siguen quitándose (regresión del comportamiento
# ya existente, ahora combinado con el strip de indentación)
# ──────────────────────────────────────────────────────────────────
inner, _ = _strip("var a = 1; /* comentario */\n    var b = 2;\n")
check("comentario de bloque desaparece", "comentario" not in inner)
check("código tras el comentario se desindenta", "\nvar b = 2;" in inner)

# ──────────────────────────────────────────────────────────────────
# `accept="image/*"` (el caso que rompía un regex ingenuo) sigue
# funcionando: no es un <script>, así que no debe tocarse en absoluto.
# ──────────────────────────────────────────────────────────────────
html_with_input = '<input type="file" accept="image/*">\n<script>\n    var x = 1;\n</script>\n'
out, _ = strip_html_js_comments(html_with_input)
check("el atributo accept=\"image/*\" no se toca", 'accept="image/*"' in out)
check("el <script> sí se desindenta", "<script>\nvar x = 1;\n</script>" in out)

# ──────────────────────────────────────────────────────────────────
# strip_leading_ws=False sigue disponible para quien solo quiera el
# comportamiento legacy (solo comentarios, indentación intacta).
# ──────────────────────────────────────────────────────────────────
html = "<script>function f(){\n    var x = 1; /* c */\n}\n</script>"
out, _ = strip_html_js_comments(html, strip_leading_ws=False)
check("strip_leading_ws=False conserva la indentación", "\n    var x = 1;" in out)
check("strip_leading_ws=False sigue quitando comentarios", "/* c */" not in out)


if _fails:
    print("\n%d test(s) fallidos: %s" % (len(_fails), ", ".join(_fails)))
    sys.exit(1)
print("\nTodos los tests de strip_js_comments pasaron.")
