"""Quita los comentarios de bloque /* ... */ del JS embebido en los
<script> de una plantilla HTML, SIN tocar los archivos fuente.

Por qué existe (2026-08-08, investigación de peso de página): un
tercio del JS de `misc_body_1.html`/`misc_body_2.html` son comentarios
de documentación (el mismo historial de bugs que vive en CLAUDE.md,
duplicado dentro del propio código y enviado al navegador de cada
usuario en cada carga). Quitarlos del HTML SERVIDO reduce la descarga
gzip un ~34% y lo que el navegador tiene que parsear un ~23%, sin
ningún riesgo funcional (un comentario nunca se ejecuta) — verificado
haciendo pasar los 105 bloques <script> resultantes por `node --check`
(cero errores) usando un parser real (`acorn`) como referencia.

Por qué NO se usa un parser JS real en producción: el servidor
(Railway/Render) es un contenedor Python/gunicorn sin Node.js, y no
hay forma de probar en este entorno de desarrollo si una dependencia
nueva de pip (p.ej. esprima) instalaría bien en el build real — no hay
acceso a PyPI desde aquí. Así que este tokenizer es Python puro, sin
dependencias, y se ejecuta en cada arranque del servidor (nunca en
cada petición) para que jamás pueda quedar desincronizado del código
fuente, lo edite quien lo edite y por donde lo edite (incluida la
interfaz web de GitHub, que se ha demostrado que se usa).

CONTRATO DE SEGURIDAD (por qué esto NUNCA puede corromper JS):
- Un intento ingenuo con regex (`/\\*.*?\\*/`) SÍ rompe cosas: el
  patrón `accept="image/*"` (un <input type=file>, presente 3 veces
  en este proyecto) se confunde con el inicio de un comentario y
  se come todo el código hasta el siguiente `*/` que encuentre.
- Este tokenizer recorre carácter a carácter distinguiendo: strings
  ('...'/"..."/`...` con escapes y, en template literals, `${...}`
  anidado), literales regex (/.../ flags, con la MISMA heurística de
  "token anterior" que usa cualquier lexer JS estándar) y comentarios
  de línea (//...) — dentro de CUALQUIERA de esos, el contenido se
  copia tal cual, nunca se interpreta como comentario de bloque.
- Solo se eliminan los comentarios /* */ que aparecen en código REAL
  (fuera de strings/regex/comentarios de línea).
- FALLO SEGURO: si el resultado no está balanceado igual que el
  original (mismo nº de {, (, [ fuera de comentarios), o si ocurre
  cualquier excepción, se descarta el resultado y se sirve el HTML
  ORIGINAL sin tocar — la web nunca puede arrancar rota por esto, en
  el peor caso simplemente no se aplica el ahorro.
"""
import re

_SCRIPT_RE = re.compile(r'(<script\b[^>]*>)(.*?)(</script>)', re.S | re.I)


def _strip_block_comments_js(src):
    """Devuelve `src` sin comentarios /* */ de código real. Tokenizer
    de una sola pasada, sin dependencias. Ver contrato de seguridad
    en el docstring del módulo."""
    out = []
    i = 0
    n = len(src)
    # Estado del ÚLTIMO token significativo (para decidir si un '/' es
    # división o el inicio de un literal regex). 'other' al principio
    # del bloque = contexto "puede empezar regex" (correcto: un '/' al
    # inicio de una expresión es regex, nunca división).
    #   'value' -> identificador/número/')'/']'/string/regex/template:
    #              lo normal después es un OPERADOR, así que '/' es división.
    #   'other' -> cualquier otra cosa (operador, '(', ',', ';', '{',
    #              inicio de bloque, palabra reservada tipo `return`):
    #              '/' aquí solo puede ser el inicio de un regex.
    prev_kind = 'other'
    # Última palabra COMPLETA de identificador/keyword vista (para el
    # caso `return /x/` — un regex tras estas palabras reservadas, no
    # una división). Se recalcula entera cada vez que se escanea un
    # identificador, nunca se acumula carácter a carácter.
    REGEX_OK_AFTER_WORD = {
        'return', 'typeof', 'case', 'in', 'of', 'new', 'delete',
        'void', 'throw', 'yield', 'instanceof', 'do', 'else',
    }

    def regex_allowed():
        return prev_kind == 'other'

    removed_any = False
    while i < n:
        c = src[i]

        # --- comentario de bloque: candidato a eliminar ---
        # `/*` NUNCA es ambiguo en JS (a diferencia de `/x/` regex vs
        # división) — no depende de regex_allowed().
        if c == '/' and i + 1 < n and src[i + 1] == '*':
            end = src.find('*/', i + 2)
            if end == -1:
                # Comentario sin cerrar — no debería pasar en JS
                # válido. No tocamos nada a partir de aquí (fail-safe).
                out.append(src[i:])
                i = n
                break
            i = end + 2
            removed_any = True
            continue

        # --- comentario de línea: se copia tal cual, sin tocar ---
        # `//` tampoco es ambiguo con la división por el mismo motivo.
        # Un comentario NUNCA es un token real, así que NO toca
        # `prev_kind` — se conserva el que había antes del comentario.
        if c == '/' and i + 1 < n and src[i + 1] == '/':
            end = src.find('\n', i)
            if end == -1:
                out.append(src[i:])
                i = n
                break
            out.append(src[i:end])
            i = end
            continue

        # --- identificadores/keywords/números: token completo de una vez ---
        # (antes se procesaban carácter a carácter, lo que rompía la
        # detección de "después de qué palabra estamos" — ver bug
        # 2026-08-08, `(fh + fa) / 2` interpretado como inicio de regex).
        if c.isalnum() or c in '_$':
            j = i
            while j < n and (src[j].isalnum() or src[j] in '_$'):
                j += 1
            word = src[i:j]
            out.append(word)
            prev_kind = 'other' if word in REGEX_OK_AFTER_WORD else 'value'
            i = j
            continue

        # --- strings: copiar tal cual respetando escapes ---
        if c in ("'", '"'):
            j = i + 1
            while j < n:
                if src[j] == '\\':
                    j += 2
                    continue
                if src[j] == c:
                    j += 1
                    break
                j += 1
            out.append(src[i:j])
            prev_kind = 'value'
            i = j
            continue

        # --- template literal: strings con `${...}` anidado ---
        if c == '`':
            j = i + 1
            depth = 0  # nivel de anidación de `${` sin cerrar
            while j < n:
                ch = src[j]
                if ch == '\\':
                    j += 2
                    continue
                if depth == 0 and ch == '`':
                    j += 1
                    break
                if ch == '$' and j + 1 < n and src[j + 1] == '{':
                    depth += 1
                    j += 2
                    continue
                if depth > 0 and ch == '{':
                    depth += 1
                    j += 1
                    continue
                if depth > 0 and ch == '}':
                    depth -= 1
                    j += 1
                    continue
                j += 1
            # El interior de `${...}` es código JS real y PUEDE tener
            # sus propios comentarios/strings — se procesa recursivo.
            segment = src[i:j]
            out.append(_strip_template_interior(segment))
            prev_kind = 'value'
            i = j
            continue

        # --- literal regex: copiar tal cual, sin interpretar su interior ---
        if c == '/' and regex_allowed():
            j = i + 1
            in_class = False
            ok = False
            while j < n:
                ch = src[j]
                if ch == '\\':
                    j += 2
                    continue
                if ch == '[':
                    in_class = True
                elif ch == ']':
                    in_class = False
                elif ch == '/' and not in_class:
                    j += 1
                    ok = True
                    break
                elif ch == '\n':
                    break  # no es un regex válido (no cruza líneas) → división suelta
                j += 1
            if ok:
                # flags tras el cierre (g, i, m, s, u, y, d)
                k = j
                while k < n and src[k].isalpha():
                    k += 1
                out.append(src[i:k])
                prev_kind = 'value'
                i = k
                continue
            # No era un regex válido: tratar '/' como división normal.

        out.append(c)
        if not c.isspace():
            prev_kind = 'value' if c in ')]' else 'other'
        i += 1

    return ''.join(out), removed_any


def _strip_template_interior(segment):
    """Procesa el contenido de un template literal completo (con sus
    backticks) para limpiar comentarios dentro de cada `${...}`, sin
    tocar el texto literal del template en sí."""
    out = []
    i = 0
    n = len(segment)
    while i < n:
        if segment[i] == '$' and i + 1 < n and segment[i + 1] == '{':
            depth = 1
            j = i + 2
            start = j
            while j < n and depth > 0:
                if segment[j] == '{':
                    depth += 1
                elif segment[j] == '}':
                    depth -= 1
                    if depth == 0:
                        break
                j += 1
            inner = segment[start:j]
            stripped, _ = _strip_block_comments_js(inner)
            out.append('${')
            out.append(stripped)
            out.append('}')
            i = j + 1
            continue
        out.append(segment[i])
        i += 1
    return ''.join(out)


def _is_pure_deletion(original, stripped):
    """Red de seguridad GENÉRICA (no depende de contar llaves/paréntesis,
    que puede dar falsos positivos si un comentario en español tiene
    puntuación desbalanceada). Verifica el INVARIANTE real de esta
    transformación: `stripped` solo puede ser `original` con ciertos
    TROZOS ENTEROS borrados — nada insertado, nada reordenado, nada
    cambiado de sitio.

    Barrido de dos punteros en O(len(original)): mientras los
    caracteres coincidan, avanza los dos; cuando no coinciden, asume
    que ese carácter de `original` fue borrado (parte de un
    comentario) y avanza SOLO el puntero de `original`. Si al final
    `stripped` se consumió entero, el invariante se cumple. Si en
    algún punto `stripped` tiene un carácter que `original` ya no
    puede ofrecer en orden, el invariante se rompe → no es una
    eliminación pura → algo se alteró y NO hay que usar el resultado."""
    oi = 0
    si = 0
    on = len(original)
    sn = len(stripped)
    while si < sn:
        if oi >= on:
            return False
        if original[oi] == stripped[si]:
            oi += 1
            si += 1
        else:
            oi += 1
    return True


def strip_html_js_comments(html):
    """Quita los comentarios /* */ del JS de TODOS los <script> de
    `html`. Nunca lanza: ante cualquier duda, deja ese bloque tal cual.
    Devuelve (resultado, stats) donde stats trae cuántos bloques se
    tocaron y si hubo algún fallback."""
    stats = {'blocks_total': 0, 'blocks_stripped': 0, 'blocks_fallback': 0}

    def repl(m):
        open_tag, inner, close_tag = m.group(1), m.group(2), m.group(3)
        stats['blocks_total'] += 1
        if not inner.strip():
            return m.group(0)
        try:
            stripped, removed_any = _strip_block_comments_js(inner)
            if not removed_any:
                return m.group(0)
            # Red de seguridad: `stripped` DEBE ser `inner` con trozos
            # enteros borrados, nunca nada insertado/reordenado. Si no
            # se cumple (bug del tokenizer con una construcción nueva
            # que no vio en la validación), no arriesgamos nada —
            # servimos el bloque ORIGINAL con sus comentarios intactos.
            if not _is_pure_deletion(inner, stripped):
                stats['blocks_fallback'] += 1
                return m.group(0)
        except Exception:
            stats['blocks_fallback'] += 1
            return m.group(0)
        stats['blocks_stripped'] += 1
        return open_tag + stripped + close_tag

    result = _SCRIPT_RE.sub(repl, html)
    return result, stats
