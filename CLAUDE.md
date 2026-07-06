# CLAUDE.md — Reglas obligatorias del proyecto F-TBOL

## El alias eFootball VIAJA DENTRO de la cfg del torneo — el ❓ ya no depende de que el dispositivo tenga la liga origen (obligatorio, 2026-07-06)

**Bug (2 fotos usuario 2026-07-06, «Maccabi Tel Aviv vs Liverpool» y
«FK Bodø Glimt vs Arsenal», Trofeo Joan Gamper — «vez número 15», «de
repente la ❓ ya no emerge»)**: en la PANTALLA DE PREVIA de un torneo de
verano, bajo el equipo IA ficticio (Maccabi Tel Aviv, que SÍ tiene alias
configurado) NO aparecía el botón ❓ que indica con qué equipo real de
eFootball hay que jugar.

### Causa raíz — el alias es IDENTIDAD pero NO viajaba con el torneo

`efootballAlias` es un dato de identidad por equipo (igual que escudo/
estadio/plantilla, regla 2026-07-04) que vive en `ligaExt_<slug>`. PERO
los equipos de un torneo (`cfg.teams[]`) se añaden copiando SOLO
`name/shield/power` (el roster editor, `sr-ok` y equivalentes) — **NUNCA
copiaban `efootballAlias`**. Así, la resolución del alias en la previa
(`getTeamEfootballAlias` → `_buildAliasCache`) dependía de que ESE
dispositivo tuviera cacheada la liga origen del equipo ficticio en
`ligaExt_*`/`LIGA_CACHE`. Un dispositivo que nunca abrió esa liga (el
móvil del amigo, o el propio tras un borrado de datos / eviction) no
podía resolverlo y el ❓ quedaba dependiendo por completo de una búsqueda
ASÍNCRONA en servidor (`/api/team-alias/<nombre>`) — frágil en red móvil
/ cold-start / deploy reciente, y EFÍMERA (el backfill de `_ALIAS_CACHE`
se reconstruye al expirar el TTL de 3 s y se pierde porque la liga no
está local). Resultado: el ❓ "de repente ya no emerge".

### Fix — bake del alias DENTRO de `cfg.teams[]` (identity-propagation)

`window._tourBackfillEfootballAlias(cfg)` (`misc_body_1.html`, junto a
`_tourLoadCachedSync`): al cargar un torneo, RESUELVE desde el cache
LOCAL (`getTeamEfootballAlias`, que escanea ligaExt_/LIGA_CACHE/
selecciones/TOUR_CACHE) el alias de cada equipo del torneo que aún no lo
lleve y lo GRABA en el propio `cfg.teams[].efootballAlias`. Al cambiar
algo, `_tourSave` lo sincroniza → todos los dispositivos reciben el alias
DENTRO de la cfg del torneo. Como `_buildAliasCache` YA escanea
`window._TOUR_CACHE`, a partir de ahí `getTeamEfootballAlias` lo resuelve
de forma SÍNCRONA en la previa (❓ instantáneo, sin round-trip). Se llama
en las 3 rutas de carga (`_tourLoadCachedSync` cache-hit + lectura de
localStorage, y `_tourLoad` tras adoptar el server). Throttle de 4 s por
cfg (no flag permanente) para permitir re-intentar tras cargar la liga
origen. NUNCA pisa un alias ya presente.

`window._efAliasBakeIntoTours(teamName, alias)`: cuando `_efAliasServerSearch`
resuelve un alias POR SERVIDOR (dispositivo sin la liga local), lo graba
en las cfgs de torneo cacheadas que tengan ese equipo → permanente +
propagado. Así el PRIMER acierto de servidor en CUALQUIER dispositivo
cura el ❓ para toda la flota, sin depender de repetir la búsqueda.

### Reglas a respetar

1. **PROHIBIDO** que un equipo de torneo (`cfg.teams[]`) dependa SOLO de
   que el dispositivo tenga la `ligaExt_<slug>` origen cacheada para
   resolver su alias eFootball. El alias es IDENTIDAD y debe VIAJAR
   dentro de la cfg del torneo vía `_tourBackfillEfootballAlias` (bake
   local) + `_efAliasBakeIntoTours` (bake del acierto de servidor).
2. **PROHIBIDO** que el bake pise un alias ya presente en `cfg.teams[]`
   (mismo contrato que `_lextBackfillAlias`/`_lextBackfillShields`): solo
   rellena huecos.
3. **PROHIBIDO** que el bake sea síncrono-bloqueante o entre en bucle de
   guardado: solo `_tourSave` (diferido) cuando algo CAMBIÓ; tras bakear,
   el siguiente escaneo no cambia nada (throttle + guard de "ya lo lleva").
4. Todo campo de identidad por equipo que en el futuro deba verse en la
   previa de un torneo (no solo el alias) hereda este patrón: bakearlo en
   `cfg.teams[]` al cargar el torneo, no resolverlo solo desde la liga
   origen local.

## La pantalla FINAL (`_gmShowFinalOv`) NUNCA se queda sin mostrar tras `_gm.finished=true` (obligatorio, 2026-07-05)

**Bug (foto usuario 2026-07-05, mismo partido «Maccabi Tel Aviv vs
Liverpool», Trofeo Joan Gamper)**: tras los 2 fixes anteriores (auto-pick
del portero IA + `_gmHumanInvolved` con registro canónico), el partido
avanzó más — la portería imbatida de AMBOS lados y el MVP («Jugador A»,
placeholder porque el roster de Maccabi no resuelve nombres reales)
quedaron registrados en el acta — pero el partido volvió a quedarse
igual: FINALIZAR deshabilitado, sin pantalla de resumen ni de WhatsApp.

### Causa raíz

`gmEndMatch()` marca `_gm.finished = true` y hace
`setTimeout(function(){ _gmShowFinalOv(); }, 80)` para abrir la pantalla
FINAL (marcador + acta completa + MVP + botón compartir). `_gmShowFinalOv`
rellenaba TODO su contenido (cabecera, escudos, MVP, acta completa vía
`_gmEvtRow`) en línea recta, SIN try/catch, y solo al FINAL hacía
`ov.style.display = 'flex'`. Si CUALQUIER paso de ese relleno lanzaba una
excepción (un dato inesperado en un evento del acta, un helper de
escudo/humanIcon fallando, etc.), la función abortaba ANTES de llegar a
esa línea — el overlay JAMÁS se hacía visible. Como `_gm.finished` ya es
`true` en ese punto, `gmEndMatch()` no vuelve a hacer nada
(`if (_gm.finished) return;`) y el watchdog de `_mlConfirmEnd` (sección
de arriba) explícitamente SALTA la reactivación cuando el partido está
`finished` — así que el usuario se quedaba mirando el gm-modal congelado
sin NINGUNA pantalla ni forma de recuperar el partido, aunque el
resultado ya estuviera guardado internamente.

### Fix

1. `_gmShowFinalOv` envuelve cada bloque de relleno (cabecera/escudos,
   MVP, acta, botones) en su propio try/catch — un fallo parcial se
   loguea pero NUNCA impide llegar a `ov.style.display = 'flex'`, que
   ahora es INCONDICIONAL al final de la función.
2. El `setTimeout` que llama a `_gmShowFinalOv()` desde `gmEndMatch`
   también va envuelto: si pese al blindaje interno algo revienta,
   se avisa con `alert()` (el resultado ya está guardado) y se llama a
   `gmVolver()` para no dejar al usuario atrapado en el modal.
3. El watchdog de `_mlConfirmEnd` (9 s) ya NO ignora los partidos
   `finished`: si el partido está `finished` pero NINGÚN overlay
   terminal (`gm-fin-ov` incluido en la lista vigilada, junto con
   `gm-mvp-share-gate` que faltaba en la lista) está visible, avisa que
   el resultado ya se guardó y ofrece `gmVolver()` en vez de dejar la
   pantalla congelada silenciosamente para siempre.

### Reglas a respetar

1. **PROHIBIDO** que `_gmShowFinalOv` (o cualquier pantalla terminal
   obligatoria equivalente: descanso, prórroga, penaltis…) rellene su
   contenido SIN try/catch antes de hacerse visible. El `display=flex`
   (o `.show`) que revela el overlay debe ser INCONDICIONAL — un dato
   inesperado en un solo evento del acta no puede impedir que el
   usuario vea NINGUNA pantalla tras finalizar.
2. **PROHIBIDO** que un watchdog anti-bloqueo (el de `_mlConfirmEnd`, o
   cualquier futuro) descarte por completo los partidos `finished`. Un
   partido puede quedar `finished=true` internamente y aun así no haber
   mostrado NINGUNA pantalla al usuario si el paso que la muestra
   falló — el watchdog debe cubrir también ese caso (ofreciendo salir,
   ya que el resultado está guardado, en vez de reactivar un botón que
   ya no sirve de nada).
3. Toda lista de "overlays terminales conocidos" que use un watchdog o
   un observer de UI (spinner, watchdog de finalizar, etc.) debe incluir
   TODOS los overlays reales del flujo — `gm-mvp-share-gate` faltaba en
   la lista del watchdog anterior. Al añadir un overlay obligatorio
   nuevo a la cadena, añadirlo también a estas listas.

## `_gmHumanInvolved` reconoce al humano por el registro canónico + watchdog anti-bloqueo-silencioso tras FINALIZAR (obligatorio, 2026-07-05)

**Bug (foto usuario 2026-07-05, mismo partido «Maccabi Tel Aviv (IA) vs
Liverpool (humano)», Trofeo Joan Gamper)**: tras el fix del auto-pick de
portero de arriba, el acta ya registraba las 2 porterías imbatidas
(Maccabi automático + Alisson elegido), pero el partido "sigue igual,
no deja finalizar" — el botón FINALIZAR seguía deshabilitado sin que
apareciera la pantalla obligatoria de Estadísticas, ni MVP, ni WhatsApp.

### Causa raíz

`_gmHumanInvolved()` (`part2/misc_body_2.html`) — la función que decide
si `gmEndMatch()` debe abrir la pantalla OBLIGATORIA de Estadísticas
antes del MVP — solo reconocía al humano por 3 vías: (1) `cfg.teams[].
isHuman` del torneo con match EXACTO de nombre, (2) `isHumanInComp`, (3)
`esHumano()` (los 5 humanos legacy de Liga EA Sports por su nombre
crudo). Ninguna de las 3 usa el registro canónico `MISTERS_HUMANOS`
(`_isHumanClubCanonico`/`_esSelHumana`, alias-safe Bayern↔Liverpool)
que SÍ usa `_ensureImbatEvents` (por eso el picker de Alisson SÍ se
mostró: esa función usa el fallback correcto). Con el slot de Liga EA
Sports renombrado Bayern→Liverpool y un torneo de 63 equipos
(`format:'league'`) donde el nombre guardado en `cfg.teams[]` o el
`humanIcon` puede no coincidir exactamente, `_gmHumanInvolved()` podía
devolver `false` mientras `_ensureImbatEvents` (con el fallback
correcto) sí reconocía a Liverpool como humano — inconsistencia entre
dos detectores de "¿es humano?" para el MISMO partido, saltándose en
silencio el gate de Estadísticas.

### Fix

1. `_gmHumanInvolved()` añade la MISMA capa 0 de refuerzo que ya usa
   `_ensureImbatEvents` (`esH`): fallback a `window._isHumanClubCanonico`
   y `window._esSelHumana` tras agotar las 3 vías anteriores. Ahora
   AMBOS detectores usan la fuente canónica como última red, así que no
   pueden discrepar sobre el mismo partido.
2. **Watchdog anti-bloqueo-silencioso** en `_mlConfirmEnd` (el handler
   de "SÍ" de la confirmación de FINALIZAR): 9 s después de confirmar,
   si `#gm-btn-end` sigue deshabilitado, el partido no está `finished`,
   y NINGÚN overlay obligatorio conocido (imbatida, stats, MVP, team/
   player pick, post-partido, loading…) está visible, se asume que la
   cadena se atascó por CUALQUIER motivo no previsto y se reactiva el
   botón con un aviso, para que el usuario pueda reintentar en vez de
   quedarse mirando el marcador sin ninguna pista ni forma de avanzar.
   `gmEndMatch`/`mlEndMatchGen` son idempotentes (retoman desde el
   primer gate pendiente), así que reintentar es seguro.

### Reglas a respetar

1. **PROHIBIDO** que un detector nuevo de "¿hay un humano en este
   partido?" (para gatear Estadísticas, MVP, cronómetro, sanciones,
   etc.) omita el fallback al registro canónico
   (`_isHumanClubCanonico`/`_esSelHumana`) cuando OTRO detector del
   MISMO flujo (p.ej. `_ensureImbatEvents`) ya lo usa. Dos detectores
   de humanidad para el mismo partido que puedan discrepar reintroducen
   gates obligatorios que se saltan en silencio para unos partidos sí y
   para otros no.
2. **PROHIBIDO** que la confirmación de FINALIZAR (`_mlConfirmEnd`)
   deshabilite el botón sin un watchdog de resolución acotada. La
   cadena de gates automáticos (imbatida→stats→MVP→WhatsApp) se
   re-dispara sola sin interacción del usuario en la ventana normal,
   pero CUALQUIER gate que falle en silencio (ahora o en el futuro) deja
   al usuario sin ninguna salida si no hay un timeout que reactive el
   botón. Todo gate NUEVO que se añada a esta cadena hereda esta red de
   seguridad automáticamente (el watchdog es genérico, no por-gate).

## La inyección diferida del ❓ REINTENTA — un fallo de red no debe dejar el botón sin aparecer para siempre (obligatorio, 2026-07-05)

**Bug (foto usuario 2026-07-05, «Maccabi Tel Aviv vs Liverpool», misma
previa que ya se había confirmado con alias guardado en servidor)**:
tras el fix "el ❓ solo sale si el equipo tiene alias" (sección
siguiente), el usuario reportó "otra vez no sale la ❓" para un partido
donde el alias SÍ existía (confirmado vía `/api/debug` — la liga de
Israel estaba guardada en el servidor con `updated_at` de ese mismo
día).

### Causa raíz

`_ppAliasDeferredCheck` (`static/js/index.bundle.js`) hacía **UNA sola**
llamada a `window._efAliasServerSearch` para el lado candidato sin alias
local. Esa función no distingue, de cara al caller, entre "el servidor
respondió: no hay alias" y "la petición falló" (red móvil, timeout de
6 s, o el servidor recién desplegado tras el merge de este mismo fix
aún arrancando) — en ambos casos `onDone(null)`. Sin reintento, un
único fallo transitorio (muy probable justo después de un deploy,
cuando Railway está reiniciando el proceso) dejaba el botón **sin
inyectar para siempre**, indistinguible de "el equipo es real y no
necesita alias" — exactamente el síntoma reportado.

Verificado en aislado (simulación Node con DOM falso): la lógica de
inyección en sí es correcta cuando el servidor responde — el bug es la
falta de reintento ante un fallo transitorio de la ÚNICA petición.

### Fix

`_ppAliasDeferredCheck` reintenta hasta 3 veces con backoff (0 ms,
1.5 s, 3.5 s) antes de rendirse. Cada intento sigue siendo una única
petición ligera (`_efAliasServerSearch`); el tope de intentos evita un
bucle infinito. Solo se dispara para el lado candidato sin alias local
(nunca para equipos ya resueltos ni para HvH/IAvIA).

### Reglas a respetar

1. **PROHIBIDO** que una comprobación diferida en servidor (la de este
   botón, o cualquier otra que dependa de una única petición para
   decidir "mostrar algo o no") se rinda tras el PRIMER fallo sin
   reintentar. Un fallo de red o un cold-start del servidor (típico
   justo tras un deploy) es indistinguible, desde el cliente, de "el
   dato no existe" — sin reintento, ambos casos producen el mismo
   síntoma silencioso.
2. **PROHIBIDO** subir el tope de reintentos sin límite (bucle
   infinito): 3 intentos con backoff corto es suficiente para cubrir un
   cold-start o un blip de red sin machacar al servidor.

## El auto-pick de portero IA en la portería imbatida SIEMPRE registra un evento — nunca deja `needsImbat` en true para siempre (obligatorio, 2026-07-05)

**Bug (fotos usuario 2026-07-05, «Maccabi Tel Aviv (IA) vs Liverpool
(humano)», 0-0, Trofeo Joan Gamper)**: tras elegir Alisson en el picker
de portería imbatida, el acta registraba SOLO ese evento («90' Portería
Imbatida — Alisson · Liverpool») y el partido se quedaba congelado ahí
para siempre — sin el evento automático de portero del Maccabi (equipo
IA), sin la pantalla obligatoria de Estadísticas, sin MVP, sin
WhatsApp y sin FINALIZAR. El botón FINALIZAR permanecía deshabilitado
sin ningún error visible.

### Causa raíz

En `_ensureImbatEvents` (`static/js/index.bundle.js`), la rama IA
(auto-pick, sin overlay) de `_step(side)` hacía:
```js
var gk = window._getTopGk(teamName);
if (gk.name) { opts.pushEv({...}); }   // ← si gk.name viene vacío, NO se llama pushEv
return Promise.resolve();
```
Si `_getTopGk` no lograba resolver un portero del equipo IA (roster
aún no indexado en `SQUAD_REGISTRY`/`ligaExt_*` en ese instante —
Maccabi Tel Aviv es un equipo con alias/roster de "Resto de Ligas"),
`pushEv` NUNCA se llamaba para ese lado. Como `gmEndMatch()` recalcula
`needsImbat` en CADA invocación comprobando si existe un evento
`imbat` para ese lado, la ausencia PERPETUA de ese evento hacía que
`needsImbat` siguiera `true` para siempre. La cadena
`gmEndMatch → _ensureImbatEvents → onDone (gmEndMatch) → needsImbat
sigue true → ...` se repetía en un bucle SILENCIOSO e invisible (todo
"resuelve" con éxito, no hay excepción que capturar ni alertar) — el
usuario veía el acta congelada con un solo evento y el botón FINALIZAR
deshabilitado sin explicación, indistinguible de "se atasca".

### Fix

La rama auto-IA de `_step` ahora GARANTIZA que `pushEv` se llama
siempre: si `_getTopGk` no resuelve un portero real, cae a un
fallback genérico `{num:'1', name:'Portero'}` (mismo patrón que ya
usaba `showImbatForce` cuando el picker humano no encuentra porteros).
Así el evento `imbat` de ese lado SIEMPRE queda registrado y
`needsImbat` puede volver a `false`, permitiendo que la cadena
continúe a Estadísticas → MVP → WhatsApp → FINALIZAR tal como está
diseñada en `gmEndMatch`.

### Reglas a respetar

1. **PROHIBIDO** que la rama auto-IA de `_ensureImbatEvents._step`
   condicione la llamada a `pushEv` a que `_getTopGk` haya resuelto un
   nombre real. `pushEv` debe llamarse SIEMPRE (con fallback genérico
   si no hay portero resuelto) — de lo contrario `needsImbat` puede
   quedar perpetuamente `true` y `gmEndMatch` entra en un bucle
   silencioso indistinguible de un partido bloqueado.
2. **PROHIBIDO** que un gate obligatorio de `gmEndMatch` (imbatida,
   stats, MVP, WhatsApp) dependa de una condición que pueda no
   cumplirse NUNCA (como "encontrar un portero real") sin un fallback
   que garantice progreso. Todo gate nuevo de este tipo hereda el
   patrón: fallback genérico que desbloquea la cadena en vez de dejarla
   pendiente para siempre.
3. Bump `index.bundle.js` 9.19 → 9.20 en `templates/index.html` y el
   `PRECACHE` de `static/js/sw.js` (regla obligatoria de versión de
   assets estáticos).

## El ❓ de alias eFootball SOLO sale si el equipo TIENE alias — «ficticio» = «tiene alias», nunca al revés (obligatorio, 2026-07-05)

**Bug (fotos + grabación usuario 2026-07-05, «Torino»/«Timor Oriental»/
«Maccabi Tel Aviv»)**: el diseño de 2026-07-04 («TIENE QUE SALIR SI O SI
LA ❓») hacía que el botón ❓ apareciera SIEMPRE bajo cualquier equipo IA
que se enfrentara a un humano, tuviera o no alias configurado. Resultado:
**Torino** (equipo real con licencia en eFootball) y **Timor Oriental**
(selección real) mostraban el ❓ como si fueran equipos ficticios sin
licencia — al pulsarlo, el aviso "sin alias configurado" confundía al
usuario haciéndole creer que algo estaba mal configurado cuando en
realidad esos equipos simplemente no necesitan alias. El usuario corrigió
la regla explícitamente: **"Los equipos ficticios son unicamente los que
en su liga tienen un ALIAS"**.

Por separado, **Maccabi Tel Aviv** (SÍ tiene alias configurado —
"Sudamérica - 1🇦🇷 - Rosario AA - 1ª👕 - ⭐⭐⭐⭐", visible en el editor de
Resto de Ligas) seguía mostrando "no tiene alias" al pulsar el ❓, pese a
la búsqueda en servidor de la sección anterior.

### Fix 1 — visibilidad del ❓ gobernada por la existencia real del alias

`static/js/index.bundle.js` (bloque de la previa, ~línea 6930): antes,
`_ppHomeAliasShow`/`_ppAwayAliasShow` dependían SOLO de quién es humano
(`_humAwayAlias && !_humHomeAlias`). Ahora esa condición (`_humCandidateHome`/
`_humCandidateAway`) es NECESARIA pero YA NO SUFICIENTE: el botón solo se
pinta si además `_aliasFor(team)` (resolución LOCAL, síncrona) devuelve
texto no vacío. Un equipo real (sin alias en ningún lado) nunca muestra
nada — ni botón, ni aviso.

**Comprobación DIFERIDA para el caso "alias existe pero no está cacheado
en ESTE dispositivo"** (el bug real de Maccabi): cuando el lado candidato
no tiene alias resuelto localmente, se pinta un placeholder VACÍO con id
(`pp-alias-home`/`pp-alias-away`) y, tras insertar la previa en el DOM, se
llama a `_ppAliasDeferredCheck(side, team, isCandidate, txt)` — si `txt`
viene vacío, pregunta a `window._efAliasServerSearch` (servidor, una sola
petición) y, si encuentra alias, INYECTA el botón ❓ en el placeholder. Si
el servidor tampoco lo tiene, no se inyecta nada — el equipo es real de
verdad.

### Fix 2 — `_copaShowAlias` deja de fiarse de "conocido localmente sin alias" como respuesta definitiva

`static/js/copa-engine.js`: se eliminó el atajo que devolvía "sin alias
configurado" en cuanto `window._efAliasKnownLocally(team)` era true, SIN
preguntar nunca al servidor. Ese atajo asumía que si el equipo estaba
indexado localmente (en `ligaExt_<slug>`, `LIGA_CACHE` o
`selecciones_squad_v1`) con alias vacío, la respuesta era definitiva —
pero la copia LOCAL de ese dispositivo puede ser ANTERIOR a la edición
del admin (guardada en otro dispositivo, o en una sesión previa de este
mismo dispositivo antes de refrescar `ligaExt_<slug>`). Un escaneo local
que no encuentra el alias **no prueba que no exista**, solo prueba que
este dispositivo no lo tiene todavía. Ahora `_copaShowAlias` **SIEMPRE**
pregunta al servidor (`/api/team-alias/<nombre>`, una sola petición
rápida con timeout de 6 s) cuando el botón no trae ya el alias resuelto —
sin excepción, ya no hay atajo local.

### Reglas a respetar

1. **PROHIBIDO** que el ❓ (o cualquier indicador de "equipo ficticio")
   se muestre basándose SOLO en "el rival es humano". La condición
   necesaria es esa, pero la SUFICIENTE es que el alias exista de verdad
   (local o, si no está cacheado, confirmado por el servidor). Un equipo
   real (Torino, Timor Oriental, o cualquier otro con licencia) JAMÁS
   debe mostrar el botón ni ningún aviso.
2. **PROHIBIDO** que la ausencia de alias en el escaneo LOCAL se trate
   como respuesta definitiva de "no tiene". Solo el servidor (fuente de
   verdad, recibe los guardados de TODOS los dispositivos) puede
   confirmar "no tiene alias" — el cliente pregunta siempre que su copia
   local venga vacía, sin atajos por "ya lo conozco sin alias".
3. Toda pantalla NUEVA que muestre el ❓/alias hereda el patrón: mostrar
   solo si hay alias YA resuelto (local o servidor), placeholder vacío +
   comprobación diferida si no está cacheado localmente, nunca mostrar
   basándose solo en la condición de humanidad del rival.

## FINALIZAR no se queda en bucle — el botón se deshabilita mientras la cadena de gates automáticos corre sola (obligatorio, 2026-07-05)

**Bug (grabación usuario 2026-07-05, «Maccabi Tel Aviv vs Liverpool»)**:
tras elegir el portero de la portería imbatida (Alisson), el partido "no
continúa al finalizar" — debería encadenar Estadísticas + MVP obligatorio
pero en vez de eso "se queda en bucle y jamás se cierra ese partido".

### Causa raíz

`gmEndMatch()` encadena varios gates OBLIGATORIOS que se re-disparan SOLOS
sin que el usuario tenga que volver a pulsar nada: portería imbatida →
estadísticas → MVP → compartir por WhatsApp → fin real. Cada gate hace
`return` tras mostrar su overlay, y el propio overlay (al confirmarse)
vuelve a llamar a `gmEndMatch()` internamente. El botón `#gm-btn-end`
(FINALIZAR) **seguía activo** durante toda esta cadena — solo se
deshabilitaba al terminar de verdad (`_gm.finished = true`). Entre el
cierre de un overlay (p.ej. el picker de portero, cerrado por
`confirmImbatForce`) y la apertura del siguiente (estadísticas), el
`onDone()` que continúa la cadena está DIFERIDO a
`requestAnimationFrame + setTimeout(0)` (fix 2026-07-05 anterior, para
forzar un repintado) — durante esa breve ventana el gm-modal queda
visible SIN ningún overlay tapando el botón. Un usuario que no ve
progreso inmediato podía volver a pulsar FINALIZAR, disparando una
**segunda invocación de `gmEndMatch()` en PARALELO** con la primera
cadena aún en curso — dos cadenas compitiendo por los mismos overlays es
indistinguible, desde fuera, de "se queda en bucle y jamás se cierra".

### Fix

- `window._mlConfirmEnd` (`part2/misc_body_2.html`) deshabilita
  `#gm-btn-end` (`disabled=true` + opacidad reducida) INMEDIATAMENTE
  al confirmar "SÍ", antes de llamar a `yesCb()` (`gmEndMatch`). Ninguna
  segunda pulsación puede volver a disparar la cadena mientras la
  primera sigue en curso.
- Nuevo helper `_gmReenableEndBtn()` (expuesto como
  `window._gmReenableEndBtn`) — lo llaman los ÚNICOS 3 puntos donde
  `gmEndMatch()` hace `return` esperando que el usuario haga algo FUERA
  de la cadena automática antes de poder reintentar (forzar prórroga,
  bloqueo defensivo antes del min 110 de la prórroga, puerta pre-penaltis):
  ahí SÍ hace falta reactivar el botón, porque el siguiente paso depende
  de una acción del usuario (reanudar el cronómetro), no de un gate que
  se resuelve solo.
- La cancelación del picker de portero (`imbat_cancelled` en el `.catch`
  de `_ensureImbatEvents`, `static/js/index.bundle.js`) y cualquier error
  de la cadena (`onDone` fallando, o el `.catch` genérico) también llaman
  a `window._gmReenableEndBtn()` — si el usuario cancela o algo revienta,
  el botón vuelve a estar disponible para reintentar en vez de quedar
  permanentemente bloqueado.

### Reglas a respetar

4. **PROHIBIDO** que `#gm-btn-end` (o cualquier botón FINALIZAR
   equivalente) permanezca activo mientras una cadena de gates
   automáticos (imbatida/stats/MVP/WhatsApp) está en curso. Se
   deshabilita al confirmar "SÍ" en `_mlConfirmEnd` y solo se reactiva:
   (a) en los puntos de `gmEndMatch()` que exigen una acción del usuario
   fuera de la cadena (prórroga, min 110), vía `_gmReenableEndBtn()`; o
   (b) si el usuario cancela un picker obligatorio o la cadena revienta.
5. **PROHIBIDO** añadir un gate automático nuevo a `gmEndMatch()`
   (que haga `return` y se re-dispare solo al confirmarse) sin mantener
   el botón deshabilitado durante su espera — heredarlo es automático
   mientras el gate no llame a `_gmReenableEndBtn()`.

## Todo cambio en `index.bundle.js`/`.css` (o cualquier asset del Service Worker) DEBE bumpear su `?v=X.X` — si no, no llega NUNCA a dispositivos con caché (obligatorio, 2026-07-04)

**Bug (foto usuario 2026-07-04, «Maccabi vs Liverpool», portería imbatida
— tocar cualquiera de los 5 porteros de la lista «no funciona»)**: un
amigo terminó un partido de Trofeo Joan Gamper y, al abrirse el overlay
obligatorio «🧤 PORTERÍA IMBATIDA» (elegir qué portero mantuvo la
portería a 0), pulsar CUALQUIERA de los 5 nombres (Alisson, Mamardashvili,
Woodman, Pecsi, Davies) no hacía nada — el overlay se quedaba fijo.

### Investigación — el código en sí es correcto

`showImbatForce`/`confirmImbatForce`/`_ensureImbatEvents`
(`static/js/index.bundle.js`) se reprodujeron de forma aislada
(Playwright + harness mínimo) con el roster exacto de la foto: el click
en cualquier botón SÍ dispara `confirmImbatForce` → resuelve la promesa
→ cierra el overlay correctamente. El código servido HOY no tiene el bug.

### Causa raíz real — caché de 30 días + Service Worker "cache-first" sin versión bumpeada

- **`app.py`** (`_static_cache_headers`): toda respuesta bajo
  `/static/js/` o `/static/css/` lleva `Cache-Control: public,
  max-age=2592000` (30 DÍAS). El comentario del propio código lo dice:
  «Los archivos JS/CSS llevan `?v=X.X` → pueden cachearse 30 días» — la
  estrategia ENTERA depende de que el número de versión se incremente
  cada vez que el contenido cambia.
- **`static/js/sw.js`** (Service Worker): además del caché HTTP, el SW
  precachea `index.bundle.js?v=9.10` (junto a `index.bundle.css`,
  `copa-engine.js`, `goal-notification-*`, `var-system.js`) en el
  `install`, y sirve TODO `/static/` con estrategia **cache-first**
  (`cache.match(e.request)` — si hay un HIT, se devuelve la copia
  cacheada **sin comprobar la red jamás**, para esa URL exacta).
- **El número de versión llevaba en `9.10` sin tocarse** pese a que
  `static/js/index.bundle.js` — donde vive literalmente
  `showImbatForce`/`confirmImbatForce`/`_ensureImbatEvents` — se ha
  modificado varias veces en el historial visible del repo. Cualquier
  dispositivo (móvil, PC, portátil) que instaló el Service Worker o
  cacheó el bundle ANTES de una de esas modificaciones se queda
  **ATRAPADO PARA SIEMPRE** con esa copia vieja — el navegador no tiene
  ningún motivo para volver a pedir `index.bundle.js?v=9.10`: la URL no
  cambió, así que ni el caché HTTP ni el Service Worker la consideran
  stale. Esto explica el patrón «funciona en mi móvil, no en el de mi
  amigo»: quien recargó/reinstaló recientemente obtiene el bundle
  actual; quien no, se queda con el que tenía cacheado desde hace
  semanas, con bugs ya corregidos en el servidor pero invisibles para
  ese dispositivo.
- **Los partials `misc_body_1.html`/`misc_body_2.html` NO sufren esto**:
  se sirven inline dentro del HTML de navegación (`network-first` en el
  SW, `no-cache` en las rutas dinámicas) — por eso la inmensa mayoría de
  fixes de este CLAUDE.md (que viven en esos partials) SÍ llegan a todos
  los dispositivos de inmediato. El problema es exclusivo de los assets
  bajo `/static/js/` y `/static/css/` referenciados por `?v=`.

### Fix

Bump de `9.10` → `9.11` en **AMBOS** sitios donde aparece la URL
(`templates/index.html` y el array `PRECACHE` de `static/js/sw.js`,
que deben coincidir siempre) — fuerza a todo dispositivo, tenga la
caché que tenga, a descargar el bundle actual en su próxima carga.

### Reglas a respetar

1. **PROHIBIDO** modificar `static/js/index.bundle.js`,
   `static/css/index.bundle.css`, `static/js/copa-engine.js`,
   `static/js/var-system.js`, `static/js/goal-notification-improved.js`,
   `static/js/goal-notification-improved.css` o
   `static/js/goal-notification-patch.js` sin **incrementar su `?v=X.X`
   en LOS DOS sitios donde vive**: la etiqueta `<script>`/`<link>` de
   `templates/index.html` Y la entrada correspondiente del array
   `PRECACHE` de `static/js/sw.js`. Si solo se bumpea uno de los dos
   sitios, quedan desincronizados (el HTML pide una URL que el SW no
   tiene precacheada con ese número, o viceversa) — deben ir SIEMPRE
   juntos.
2. **PROHIBIDO** asumir que un fix en `index.bundle.js`/`.css` "ya está
   arreglado" solo porque el código fuente en el repo es correcto: sin
   el bump de versión, los dispositivos con caché (HTTP de 30 días +
   Service Worker cache-first) NUNCA reciben el cambio. Todo bug
   reportado en algo que vive en estos archivos debe hacer sospechar
   PRIMERO si el dispositivo que falla tiene una versión vieja cacheada
   (pedir al usuario recargar forzado / borrar caché del navegador como
   diagnóstico, y bumpear la versión como fix).
3. Todo asset NUEVO que se añada al array `PRECACHE` de `sw.js` hereda
   esta regla: su URL debe llevar `?v=` y esa versión debe bumpearse en
   ambos sitios cada vez que su contenido cambie.
4. Los partials `misc_body_1.html`/`misc_body_2.html` (inline en el HTML
   de navegación, `network-first`) NO necesitan este bump — solo los
   archivos servidos como `<script src>`/`<link href>` bajo `/static/`.

### Refuerzo — el propio picker se blinda además del bump de versión (obligatorio, 2026-07-04)

**El bump de versión (9.10→9.11) no bastó**: el amigo repitió la prueba
(mismo partido Maccabi vs Liverpool) y la portería imbatida seguía sin
responder a ningún portero. En vez de seguir asumiendo caché, se
blindó el propio código de `showImbatForce`/`confirmImbatForce`/
`_ensureImbatEvents` (`static/js/index.bundle.js`) contra TODOS los
fallos silenciosos posibles, en vez de depender de una única teoría:

1. **Cierre determinístico del spinner "Procesando partido…"**
   (`#ml-loading-ov`, z-index 100020): `showImbatForce` llama
   `window._mlHideLoading()` de inmediato al abrirse, en vez de confiar
   en el `MutationObserver` que lo auto-cierra — ese observer NUNCA
   detecta este overlay concreto porque se crea con la clase `show` YA
   puesta antes de insertarse en el DOM (no genera una mutación de
   atributo observable; solo lo salvaban 3 temporizadores de hasta
   4.5 s, confirmado con un test de `MutationObserver` aislado).
2. **z-index inline 100050** en el propio overlay del picker — por
   encima de CUALQUIER spinner/overlay de proceso — como red de
   seguridad adicional aunque el cierre determinístico fallara por
   cualquier motivo no previsto.
3. **`confirmImbatForce` envuelto en try/catch con `alert()` visible
   en caso de error**: antes, si algo dentro de la función reventaba
   (p.ej. un dato inesperado en la plantilla), el fallo era
   COMPLETAMENTE SILENCIOSO — exactamente el síntoma "no funciona el
   elegir ninguno de los porteros". Ahora cualquier excepción se
   muestra al usuario en vez de dejar el overlay atascado sin
   explicación.
4. **Resolución de plantilla por el registro CANÓNICO del mister**
   (`_humanClubSlotName`, si existe) antes de caer al nombre crudo en
   `_getTopGk`/`showImbatForce` — estos dos eran los ÚNICOS pickers de
   plantilla humana que aún resolvían por nombre crudo (regla
   2026-06-28 "El picker de eventos de una caja humana muestra SIEMPRE
   la plantilla de SU mister" solo cubría `_gmGetSquad`/`genTpSelect`).
5. **Detección de humano con capas** (`_isHumanClubCanonico`/
   `_esSelHumana` como fallback de `esHumano`) en `_ensureImbatEvents`:
   `esHumano()` solo reconoce los 5 humanos legacy de Liga EA Sports;
   sin el fallback, un club/selección humano nuevo (PSG, Inter, o
   cualquier selección canónica) caía al auto-pick silencioso de IA en
   vez de mostrar el picker al humano.

Verificado con un harness Playwright aislado que reproduce exactamente
la cadena `_ensureImbatEvents → showImbatForce → confirmImbatForce`
con el roster real de la foto (Alisson, Mamardashvili, Woodman, Pecsi,
Davies): tras el fix, el cierre del spinner es determinístico (no
depende del observer), el z-index del picker queda por encima de
cualquier overlay de proceso, y el click resuelve la cadena
correctamente.

**Reglas a respetar (además de las 4 de arriba)**:
5. **PROHIBIDO** que un overlay obligatorio nuevo (picker de un solo
   uso creado con `document.createElement` + `className` puesto ANTES
   de insertarse en el DOM) dependa SOLO del `MutationObserver` de
   `misc_body_2.html` (`obs2`, TARGETS/TARGET_CLASSES) para cerrar el
   spinner "Procesando partido…". Ese observer solo detecta cambios de
   atributo en nodos YA insertados (`classList.add` posterior, como
   hace `showMvpForce` reutilizando un div ya en el DOM) — un nodo
   nuevo con la clase ya puesta es invisible para él. Todo picker
   nuevo de este tipo debe llamar `window._mlHideLoading()`
   explícitamente al abrirse.
6. **PROHIBIDO** que un handler de confirmación de un overlay
   obligatorio (imbatida, MVP, sanciones…) falle en silencio. Envolver
   siempre en try/catch con un aviso VISIBLE (`alert`/toast) — un fallo
   silencioso en un flujo obligatorio dejaba al usuario sin ninguna
   pista de qué había pasado.
7. **PROHIBIDO** que `_getTopGk`/`showImbatForce` (o cualquier picker
   de plantilla humana nuevo) resuelvan el roster por nombre crudo sin
   pasar antes por `_humanClubSlotName`. Toda caja de humano nueva lo
   hereda automáticamente en cuanto esté en el registro `MISTERS_HUMANOS`.

### Refuerzo 2 — el tap real seguía sin responder + el ❓ desaparecía sin alias (obligatorio, 2026-07-04)

**El refuerzo 1 no bastó**: el amigo repitió la prueba y el botón
"Alisson" se quedaba resaltado (color `:active`) al tocarlo pero el
partido seguía bloqueado — ni elegir portero ni "Cancelar (no
finalizar)" hacían nada, sin forma de avanzar ni de salir. A la vez, en
la PANTALLA DE PREVIA del mismo partido, el botón **❓** (alias
eFootball, bajo el equipo IA cuando el rival es humano) había
desaparecido por completo.

**Causa raíz 1 — ambigüedad táctil real, invisible para tests con `.click()`**:
un tap dentro de un contenedor `overflow-y:auto` anidado
(`.mvp-pl-list` dentro de `.mvp-force-overlay`) puede ser reinterpretado
por el navegador como intento de scroll si detecta el mínimo movimiento
del dedo entre `touchstart`/`touchend` — en ese caso el evento `click`
sintético **NUNCA se dispara**, aunque el botón SÍ muestra su estado
`:active` (que depende solo del `touchstart`, no del click). Un test
automatizado con `.click()` directo no lo reproduce porque no simula
touchstart→touchmove→touchend con micro-movimiento real. Verificado
con Playwright + `Input.dispatchTouchEvent` (CDP) disparando la
secuencia táctil SIN click sintético: reproduce el bloqueo exacto.
Afecta IGUAL al botón "Cancelar" (misma clase de contenedor), por eso
tampoco dejaba salir del overlay.

**Fix 1**: `showImbatForce` cablea un respaldo `touchend` (con
comprobación de que el dedo no se movió >12px desde el `touchstart`,
para no confundir un scroll real con un tap) en CADA botón del overlay
— porteros y "Cancelar" por igual. `confirmImbatForce`/`cancelImbatForce`
son idempotentes (el overlay ya se removió, `_imbatForceCallback` ya es
null), así que si el `click` normal SÍ llega después no hay doble
confirmación.

**Causa raíz 2 — el ❓ solo se dibujaba SI ya había un alias configurado**:
`_ppAliasHtml(txt)` hacía `if(!txt) return ''` — el botón entero
desaparecía (no solo su contenido) cuando `getTeamEfootballAlias(team)`
venía vacío. Un equipo IA sin alias configurado (nunca editado, o
perdido) se quedaba sin NINGÚN botón, sin pista de que la función
existe ni forma de comprobarlo/configurarlo desde la previa.

**Fix 2**: el ❓ se muestra SIEMPRE que el rival sea humano y este lado
no lo sea (misma condición de siempre, `_ppHomeAliasShow`/
`_ppAwayAliasShow`, ya independiente del texto). Si el alias viene
vacío, `window._copaShowAlias` (`copa-engine.js`) ya no hace `return`
en silencio — muestra un aviso "⚠️ Sin alias eFootball configurado para
`<equipo>` — ve al editor de Resto de Ligas…" en vez de no responder al
pulsar.

**Reglas a respetar**:
8. **PROHIBIDO** que un botón crítico dentro de un contenedor
   `overflow-y:auto` (picker de porteros, MVP, jugador de evento, o
   cualquier overlay obligatorio nuevo) dependa ÚNICAMENTE del evento
   `click` sintético. Todo botón así DEBE cablear también un respaldo
   `touchend` con comprobación de movimiento (patrón
   `_imbatWireTapFallback` en `showImbatForce`), para que un tap real en
   móvil con la mínima ambigüedad de scroll no deje al usuario sin
   forma de avanzar NI de cancelar/salir.
9. **PROHIBIDO** que el botón ❓ (alias eFootball) desaparezca por no
   haber alias configurado. La condición de mostrarlo depende SOLO de
   quién es humano (`_ppHomeAliasShow`/`_ppAwayAliasShow`); el texto
   vacío se gestiona dentro del popup (`_copaShowAlias`), nunca
   ocultando el botón entero.
10. **PROHIBIDO** que `_copaShowAlias` (o cualquier popup de alias
    nuevo) haga `return` en silencio cuando el alias viene vacío — debe
    informar al usuario qué hacer (dónde configurarlo) en vez de no
    responder al pulsar.

## El picker de portería imbatida y el popup de alias NUNCA se quedan colgados en silencio — la continuación tras confirmar también va blindada (obligatorio, 2026-07-05)

**Bug (4 fotos usuario, «Maccabi Tel Aviv vs Liverpool», 0-0, 12
intentos para terminar el partido)**: pese a los refuerzos anteriores
(touchstart inmediato en el picker, búsqueda de alias server-side de
una sola petición), el usuario seguía reportando: (1) el popup ❓ se
quedaba en «🔄 Buscando en el servidor…» varios MINUTOS sin resolver
nunca, y (2) pulsar cualquiera de los 5 porteros del picker «PORTERÍA
IMBATIDA» no hacía avanzar el partido — «imposible continuar».

### Causa raíz — los fixes anteriores blindaban el TAP, no lo que pasa DESPUÉS

Investigación exhaustiva confirmó que el código de `showImbatForce` /
`confirmImbatForce` / `_efAliasServerSearch` / `/api/team-alias/<name>`
ya estaba correctamente implementado y mergeado a `main` (verificado
con `git log`, `py_compile` y un parser JS sobre cada bloque
`<script>`). El hueco real estaba en la CONTINUACIÓN, no en la
detección del toque:

1. **`_ensureImbatEvents`**: `opts.pushEv(...)` se llamaba SIN
   try/catch dentro del executor de una `new Promise(...)` — si algo
   en el pintado del acta (`document.getElementById('gm-acta-list')`,
   construcción del `<li>`, etc.) lanzaba, la excepción se convertía
   automáticamente en un **rechazo silencioso** de la promesa. Peor
   aún: la llamada a `onDone()` (el `gmEndMatch()`/`mlEndMatch()` que
   debe reanudar el partido tras registrar la portería) vivía FUERA de
   cualquier try/catch — si `onDone()` reventaba por cualquier motivo
   posterior (stats, MVP, guardado…), el picker YA se había cerrado
   (parecía que el tap "funcionó") pero el partido se quedaba
   congelado sin overlay siguiente ni ninguna explicación. El `.catch`
   final solo hacía `console.warn` — invisible para el usuario,
   violando la propia regla de este archivo ("un handler de
   confirmación de un overlay obligatorio NUNCA falla en silencio").
2. **`_copaShowAlias`**: el timeout de 6 s vivía DENTRO de
   `_efAliasServerSearch`, protegiendo solo la promesa del `fetch`. Si
   algo ANTES de esa promesa reventaba de forma SÍNCRONA (`fetch`/
   `AbortController` no definidos en un WebView viejo, o
   `_aliasNormName` lanzando), `onDone` nunca llegaba a invocarse y el
   overlay se quedaba en «Buscando…» para siempre — sin más salida que
   pulsar CERRAR a ciegas, sin saber si alguna vez iba a resolver.

### Fix

- **`_ensureImbatEvents`** (`static/js/index.bundle.js`): las dos
  llamadas a `opts.pushEv(...)` (humano y auto-pick IA) van envueltas
  en try/catch — un fallo al pintar el acta ya NUNCA bloquea el
  registro del evento ni el avance del partido. La llamada a
  `onDone()` va envuelta en try/catch con `alert()` visible si falla.
  El `.catch` final de la cadena de promesas también avisa con
  `alert()` (antes solo `console.warn`) para cualquier error que no
  sea la cancelación explícita del usuario.
- **`_copaShowAlias`** (`static/js/copa-engine.js`): watchdog
  `setTimeout` de 7 s **independiente** del timeout interno de
  `_efAliasServerSearch` — resuelve el overlay a «sin alias
  configurado» pase lo que pase, aunque algo reviente antes de que el
  timeout interno llegue a arrancar. La llamada a
  `window._efAliasServerSearch` va envuelta en try/catch. Guardia
  `settled` para que solo el primero en llegar (respuesta real o
  watchdog) escriba el resultado.
- **`_efAliasServerSearch`** (`templates/partials/misc_body_1.html`):
  todo el cuerpo envuelto en try/catch — un fallo síncrono (p.ej.
  `fetch` no definido) se resuelve como "no encontrado" en vez de
  dejar `onDone` sin invocar nunca.
- Bump `index.bundle.js` 9.15 → 9.16 y `copa-engine.js` 1.4 → 1.5 en
  `templates/index.html` y el `PRECACHE` de `static/js/sw.js`.

### Reglas a respetar

11. **PROHIBIDO** que `opts.pushEv(...)` dentro de `_ensureImbatEvents`
    (o cualquier callback de un overlay obligatorio que registre un
    evento en el acta) se llame sin try/catch cuando vive dentro del
    executor de una `new Promise(...)`: una excepción ahí se convierte
    en un rechazo silencioso indistinguible de una cancelación real.
12. **PROHIBIDO** que la llamada a `onDone()` (o cualquier callback de
    "continuar tras confirmar" de un overlay obligatorio) viva fuera de
    un try/catch con aviso visible. El picker puede cerrarse
    correctamente y aun así dejar al usuario bloqueado si lo que viene
    DESPUÉS falla en silencio — el `alert()` es lo único que distingue
    "tap no detectado" de "tap detectado pero la continuación reventó".
13. **PROHIBIDO** que un watchdog de timeout para un overlay de
    "buscando…" viva SOLO dentro de la función que hace la petición de
    red. Debe existir un watchdog independiente en el CALLER (quien
    pinta el "Buscando…") que garantice una resolución acotada aunque
    la función interna falle antes de llegar a su propio timeout.
14. Antes de asumir que un bug "ya arreglado" sigue reproduciéndose por
    una regresión de código, comprobar primero con `git log`/`git
    fetch origin main` si el fix realmente llegó a `main` y cuánto
    tiempo llevaba desplegado en el momento de la prueba — un fix
    mergeado minutos antes de la prueba puede no haber terminado de
    desplegarse/activarse (Service Worker `skipWaiting`+`clients.claim`
    necesita una recarga real de la pestaña, no solo el merge).

## Extras manuales del reparto europeo — rellenar huecos cuando la hidratación automática no basta (obligatorio, 2026-07-03)

**Contexto (fotos usuario 2026-07-03, «ahora van menos», Wild Card 8/72
→ 11/72 tras el fix de hidratación secuencial)**: incluso con
`_eurHydrateMissingLeagues` arreglado (secuencial + pausado + reintentos,
ver sección anterior), el pool puede seguir muy por debajo del objetivo
si el SERVIDOR simplemente no tiene guardada la clasificación de esa
liga todavía (dato, no código — p.ej. una liga que solo se ha simulado
en un móvil que nunca llegó a sincronizar). El admin pidió: (1) un botón
que le muestre qué equipos van a cada competición SIN tener que pulsar
"Enviar realidad" (que congela una snapshot), y (2) poder añadir un
equipo a mano, rápido, a CUALQUIER zona — no solo a las que ya cubría el
inyector "EA Sports → Europa" (que es solo para España).

### Fix — nuevo botón + store genérico, independiente de "EA Sports → Europa"

- **`window._eurManualOverlayOpen()`** (`misc_body_1.html`, botón "👁 Ver
  / Añadir equipos por competición (admin)" bajo Resto de Ligas, ANTES
  de "Enviar realidad"): overlay de consulta + edición INMEDIATA.
  Calcula el pool **EN VIVO** (`_eurLiveBlob`, bypass de
  `europe_committed_v1` vía `_europeIgnoreFrozen`) cada vez que se abre
  o se añade/quita un equipo — el admin ve el estado real sin congelar
  nada. Muestra el conteo real vs el objetivo oficial por zona
  (`_EUR_ZONE_TARGET`), un formulario para añadir un equipo (nombre +
  país/liga opcional + chip de zona) y la lista de extras manuales ya
  añadidos con botón ✕ para quitarlos. El listado completo agrupado por
  liga reutiliza `_eurZoneSectionHtml`/`_EUR_REPORT_ZONES` (los mismos
  que ya pintaba `_eurShowCommitReport`).
- **`eur_manual_extra_v1`** (nuevo store, `misc_body_1.html` junto a
  `_prependManualEa`): `{ucl:[],uclPrev:[],uel:[],uecl:[],uclQual:[],
  wildcard:[]}`, cada entrada `{name,league,logo}`.
  **INDEPENDIENTE** de `manual_ea_<slug>_v1` (el inyector "EA Sports →
  Europa", solo para las plazas manuales de España). Los 6
  `compute*Classified()` lo consumen vía `_appendManualExtra(arr,zone)`
  **AL FINAL** (tras `_prependManualEa` + el cómputo automático,
  dedupe por nombre) — incluidas `uclQual`/`wildcard`, que desde
  2026-07-03 NO leen `_prependManualEa` (España tiene cupo 0 ahí) pero
  SÍ deben poder recibir extras genéricos de CUALQUIER país para tapar
  huecos.
- **Servidor** (`app.py`): `eur_manual_extra_v1` en `_KV_ALLOWED_EXACT`
  + merge dedicado `_eur_manual_extra_merge` — **UNIÓN por (zona,
  nombre)**, NUNCA reemplazo por recencia. Con 6 móviles + PC, dos
  dispositivos pueden añadir equipos DISTINTOS sin haberse sincronizado
  entre ellos; un merge por recencia pura (`_KV_RECENCY_BLOB_KEYS`)
  perdería la adición del dispositivo más lento. Compromiso aceptado:
  un ✕ (borrado) puede resucitar si otro dispositivo con una copia sin
  ese borrado hace POST después — mismo trade-off que el resto de listas
  aditivas del proyecto (derbys, `cash_ledger_v1`). Tests en
  `tests/test_api.py::TestEurManualExtraMerge`.

### Reglas a respetar

1. **PROHIBIDO** mezclar `eur_manual_extra_v1` con `manual_ea_<slug>_v1`.
   El inyector EA es SOLO para las plazas manuales de España (limitado a
   `ucl`/`uclPrev`/`uel`/`uecl`, cupo 0 en `uclQual`/`wildcard` — regla
   2026-07-03 "Open Qualifier y Wild Card NUNCA leen el inyector
   manual"). `eur_manual_extra_v1` es agnóstico de liga y SÍ se lee en
   las 6 zonas — son mecanismos distintos con propósitos distintos.
2. **PROHIBIDO** que el merge del servidor de `eur_manual_extra_v1`
   vuelva a un reemplazo por recencia (`_KV_RECENCY_BLOB_KEYS`): es una
   lista ADITIVA multi-dispositivo, la fusión es SIEMPRE unión por
   (zona, nombre).
3. **PROHIBIDO** que `_eurManualOverlayOpen`/`_eurLiveBlob` escriban en
   `europe_committed_v1`: es una vista EN VIVO, de solo-lectura respecto
   a la snapshot. Solo "Enviar realidad de cada equipo a su Europa"
   congela.
4. Toda zona nueva que se añada al reparto europeo (si en el futuro hay
   una 7ª) hereda el patrón añadiendo su key a `EUR_MANUAL_ZONES`
   (cliente) y `_EUR_MANUAL_EXTRA_ZONES` (servidor) — deben ir siempre
   sincronizadas entre sí.

### El overlay se AUTO-hidrata al abrirse — no depende de otros botones (obligatorio, 2026-07-03)

**Refuerzo (mismo día, fotos usuario "no me cuadra nada" — Wild Card
9/72 al abrir el overlay recién publicado)**: el overlay inicial solo
LEÍA lo que ya hubiera en `localStorage`; si el admin abría "👁 Ver /
Añadir equipos" sin haber pulsado antes "♻️ Re-cuadrar" o
"📤 Enviar realidad", veía un conteo bajo que no reflejaba lo que el
servidor realmente tiene guardado.

- **`_eurManualOverlayOpen`** ahora dispara `_eurManualTriggerHydrate()`
  (= `_eurHydrateMissingLeagues` + re-render) automáticamente al abrirse
  (throttle 2 min), con un estado visible en el header: `⏳ Cargando
  ligas del servidor…` mientras hidrata, `✅ Actualizado — <hora>` al
  terminar. Botón `🔄 Cargar del servidor` para forzar un refresco manual
  en cualquier momento sin cerrar/reabrir el overlay.
- **`_eurMissingLeaguesList()`**: lista, por NOMBRE de país/liga (vía
  `LEAGUE_DEFAULT_NAMES`), las ligas de `LEAGUE_DEFAULT_ZONES` que en
  ESTE dispositivo siguen sin plantilla (≥2 equipos) tras la hidratación
  — convierte "el número no cuadra" en "estas ligas concretas faltan":
  el admin sabe exactamente cuáles abrir/simular en algún dispositivo
  que sí las tenga, o rellenar a mano con el formulario de arriba.

**Regla a respetar**: **PROHIBIDO** que el overlay vuelva a depender de
que el admin haya pulsado "Re-cuadrar"/"Enviar realidad" ANTES de
abrirlo para mostrar un conteo fiable — debe auto-hidratarse él solo.
Si tras una hidratación COMPLETA (`✅ Actualizado`) una zona sigue por
debajo del objetivo, la lista de "LIGAS SIN DATOS" debe explicar por qué
(dato ausente en el servidor, no un fallo de red) — no dejar al admin
adivinando.

### El objetivo de ucl/uel/uecl en el overlay es 40, NO 28/18/12 (bug propio, 2026-07-03)

**Bug (fotos usuario "no me cuadra nada", Champions 38/28 · Europa
38/18 · Conference 40/12, las 3 en VERDE)**: el overlay mostraba las 3
zonas directas como si tuvieran DEMASIADOS equipos (verde = "por
encima del objetivo"), haciendo creer al admin que algo estaba
sobrecargado, cuando en realidad `computeUclClassified()` /
`computeUelClassified()` / `computeUeclClassified()` YA suman el corte
de la Previa de Champions (12/22/28) a las plazas directas por liga
(28/18/12) — el pool final de esas 3 pantallas es **40/40/40** (ver
sección "Wild Card + Open Qualifier — FASE DE GRUPOS": «🔵 UCL 28+12=40
· 🟠 UEL 18+22=40 · 🟢 UECL 12+28=40»). `_EUR_ZONE_TARGET` usaba por
error las plazas DIRECTAS (28/18/12) como si fueran el total.

**Fix**: `_EUR_ZONE_TARGET = { ucl:40, uclPrev:34, uel:40, uecl:40,
uclQual:88, wildcard:72 }`. **PROHIBIDO** volver a poner 28/18/12 como
objetivo de ucl/uel/uecl en este overlay (ni en ningún diagnóstico
nuevo) — esas son solo las plazas DIRECTAS de liga, el objetivo real
del pool completo de la pantalla es 40 en las 3.

### Añadir por liga — clasificación completa + buscador + quitar (obligatorio, 2026-07-03)

**Petición usuario** (fotos "no me cuadra nada"): el añadido manual
equipo-a-equipo escribiendo el nombre a mano es lento y propenso a
error. Pidió: (1) un buscador al escribir el nombre, (2) poder elegir
una liga y ver su clasificación completa para saber qué equipo va a
cada competición según su posición, añadiendo varios de golpe, y
(3) poder quitar un equipo ya añadido.

- **Buscador typeahead** (`#eur-manual-name` + `_eurSearchAllTeams`):
  al escribir 2+ letras, busca por substring en TODAS las
  `ligaExt_<slug>` YA cacheadas en este dispositivo (best-effort — no
  trae del servidor, para eso está el picker por liga) y muestra un
  dropdown clicable que rellena nombre + liga.
- **📋 Añadir por liga** (`_eurPickerSectionHtml`/`_eurPickerLoadLeague`/
  `_eurPickerRows`): un `<select>` con las 54 ligas
  (`_eurAllLeagueSlugsSorted`, vía `LEAGUE_DEFAULT_ZONES`/
  `LEAGUE_DEFAULT_NAMES`). Al elegir una, trae ESA liga SOLA (local si
  ya está cacheada, si no 1 sola petición al servidor — nunca las 53 de
  golpe, así es rápido y fiable) y pinta su clasificación completa
  (posición, nombre, PJ) con la **zona SUGERIDA por posición** — misma
  lógica de rangos ("skip") que `_computeQualifiedFromLeagues`: ucl →
  uclPrev → uclQual → uel → uecl → wildcard, en ese orden, según
  `zones.<zona>` de la liga. Cada fila tiene un botón "➕ Añadir" (pasa a
  "✓ Añadido" si ya está) y hay un botón "✅ AÑADIR TODOS LOS SUGERIDOS"
  para volcar de golpe todas las filas con zona.
- **Quitar equipo añadido**: ya existía (botón ✕ junto a cada entrada en
  la lista de "extras manuales" agrupada por zona, sección justo debajo
  del formulario) — se mantiene sin cambios, solo se hace más visible
  al quedar bajo las dos formas de añadir.

**Reglas a respetar**:
1. `_eurPickerLoadLeague` **NUNCA** dispara una hidratación masiva de
   las 53 ligas — es SIEMPRE 1 sola liga (local o 1 fetch). Si se
   necesita traer todas, existe `_eurManualTriggerHydrate` (botón
   "🔄 Cargar del servidor" / auto-hidrata al abrir) — son mecanismos
   DISTINTOS y complementarios, no fusionar.
2. El orden de rangos por posición (`ORDER = ['ucl','uclPrev','uclQual',
   'uel','uecl','wildcard']`) en `_eurPickerRows` **DEBE** coincidir
   exactamente con el orden de `skip` de `_computeQualifiedFromLeagues`
   — si ese orden cambia algún día, cambiar aquí también o la zona
   sugerida por posición dejará de coincidir con el cómputo automático.
3. El buscador (`_eurSearchAllTeams`) es de solo LECTURA de lo que ya
   hay en localStorage — **PROHIBIDO** que dispare peticiones de red
   (eso lo hace el picker por liga, con 1 fetch explícito por selección
   del admin, nunca en cada tecla escrita).

### Modo MANUAL por zona — "elimina los equipos automáticos, lo hago yo" (obligatorio, 2026-07-03)

**Petición usuario** (fotos "Champions League — 31 equipos" con
mezcolanza de países, "Previa de Champions — 9 equipos"): "todos esos
equipos que están automáticamente en las competiciones elimínalos, lo
hago yo manualmente". El cómputo automático sigue siendo útil para
otras zonas, así que el modo manual es **POR ZONA**, no global.

- **`eur_manual_override_v1`** (nuevo store, junto a
  `eur_manual_extra_v1`): `{ucl,uclPrev,uel,uecl,uclQual,wildcard}`
  booleanos. `window._eurManualOnly(zone)` / `window._eurManualOverrideSet(zone,bool)`.
- Cada uno de los 6 `compute*Classified()` comprueba
  `window._eurManualOnly(zone)` **AL PRINCIPIO**, ANTES incluso de mirar
  `_europeFrozenFor` (una snapshot congelada previa NO debe resucitar
  los automáticos si el admin activó manual): si está activo, devuelve
  `_appendManualExtra([], zone)` — SOLO lo que el admin haya añadido a
  mano (formulario / picker por liga), cero automático.
- **UI**: cada tarjeta de conteo del overlay lleva un botón
  `🔓 Auto` / `🔒 Manual` que alterna el flag (con `confirm()` al
  ACTIVAR, para que no sea un toque accidental). El conteo, la lista
  agrupada por liga (`_eurZoneSectionHtml`) y el picker por liga siguen
  funcionando igual — simplemente `blob[zone]` pasa a ser 100% manual.
- Servidor: `eur_manual_override_v1` en `_KV_ALLOWED_EXACT` +
  `_KV_RECENCY_BLOB_KEYS` (edición rara de admin, recencia simple).

**Reglas a respetar**:
4. **PROHIBIDO** que el check de `_eurManualOnly(zone)` se coloque
   DESPUÉS de `_europeFrozenFor` en cualquiera de los 6 compute
   functions — si no, una snapshot congelada antigua seguiría
   devolviendo los equipos automáticos aunque el admin haya activado
   modo manual para esa zona.
5. El modo manual NUNCA borra `eur_manual_extra_v1` ni
   `europe_committed_v1` — solo cambia qué fuente se LEE. Desactivar el
   modo manual (volver a 🔓 Auto) restaura el cómputo automático tal
   cual sin perder nada.
6. Toda zona nueva que se añada al reparto (7ª futura) hereda el modo
   manual automáticamente en cuanto se añada a `EUR_MANUAL_ZONES` +
   tenga su propio check `_eurManualOnly` al principio de su función de
   cómputo.

**Refuerzo (mismo día, fotos usuario "siguen saliendo los equipos,
elimínalos, los añado yo manualmente" — el toggle opt-in de arriba no
bastó)**: el admin pidió DOS VECES que los equipos automáticos
desaparezcan de las 6 competiciones, no que exista un botón que hay
que ir a pulsar zona por zona. **El DEFAULT de `_eurManualOverrideLoad`
pasa a ser `true` (manual) en las 6 zonas** — antes era `false`
(automático) y el admin tenía que activar el candado 🔒 uno a uno.
Cualquier elección EXPLÍCITA previa del admin (guardada en
`eur_manual_override_v1`) sigue ganando sobre este default — si en
algún momento vuelve a poner una zona en 🔓 Auto, esa elección se
respeta y persiste.

**Regla a respetar**: **PROHIBIDO** volver a poner `false` (automático)
como default de `_eurManualOverrideLoad` sin acuerdo explícito del
usuario — es la 2ª vez que pide esto y la 1ª implementación (opt-in vía
toggle) no fue suficiente porque requería una acción por zona que el
admin no había hecho.

### El picker de liga es un botón/lista PROPIO, no un `<select>` nativo (obligatorio, 2026-07-03)

**Petición usuario** (foto del `<select>` nativo de Android abierto a
pantalla completa con radios ⭕): "mejor para seleccionar liga que sea
marcar ✅". El `<select>` nativo rompe el look de la app (picker gris
del sistema operativo) y usa radios genéricos.

**Fix**: `_eurPickerButtonHtml()` sustituye el `<select>` por un botón
`#eur-pick-league-btn` que despliega una lista propia
`#eur-pick-league-list` (mismo estilo oscuro que el resto del overlay),
con un ✅ junto a la liga seleccionada en vez de un radio. Estado
`_eurPickerListOpen` controla la visibilidad; clicar una fila cierra la
lista y dispara `_eurPickerLoadLeague` igual que antes.

**Regla a respetar**: **PROHIBIDO** volver a un `<select>` nativo para
selecciones dentro de overlays de admin de esta pantalla — usar el
patrón botón + lista propia con ✅ (mismo que otros pickers custom del
proyecto, p.ej. `.mea-drop` de "EA Sports → Europa").

## La hidratación de ligas para el reparto europeo es SECUENCIAL + PAUSADA, nunca thundering herd (obligatorio, 2026-07-03)

**Bug (fotos usuario 2026-07-03, «solo detecta 8 en Wild Card, tienen
que ser 72»)**: tras pulsar «♻️ Re-cuadrar reparto europeo (canónico)»
y «📤 Enviar realidad de cada equipo a su Europa», el diagnóstico de la
Wild Card mostraba **«Pool real detectado: 8 / 72»** con **«LIGAS QUE
APORTAN (0)»**, y las pantallas de Open Qualifier / Previa de Champions
se quedaban llenas de placeholders `TBD-OQ-XX` (6/62 · 12/62).

### Causa raíz (2 bugs)

1. **`_eurHydrateMissingLeagues`** (`misc_body_1.html`) — la función que
   trae del servidor las `ligaExt_<slug>` que faltan en el dispositivo
   ANTES de recalcular el reparto europeo — disparaba **TODOS** los
   `fetch('/api/liga-ext/<slug>')` de golpe con `toFetch.forEach(...)`:
   un **thundering herd** de hasta ~53 GETs simultáneos contra Railway.
   En frío (o bajo carga) la mayoría fallaba/timeaba en silencio
   (`.catch(function(){})`, sin reintento) y el timer fijo de 25 s
   cortaba el resto aunque siguieran en vuelo. Solo las ~8 ligas que
   respondían a tiempo hidrataban `localStorage` → el cómputo en vivo
   (`_computeQualifiedFromLeagues`) solo veía esas 8. Es el MISMO patrón
   ya identificado y arreglado para la subida PC→servidor
   (`_lextReconcileResultsToServer`, «Secuencial+pausado (mata el
   thundering herd que rompía la subida original)») — aquí faltaba
   aplicar el mismo remedio al lado PULL (servidor→dispositivo).
2. **`window._wcDebugPool`** (`part2/misc_body_2.html`) — el diagnóstico
   🔍 llamaba a `computeWildCardClassified()`, que si existe un snapshot
   congelado (`europe_committed_v1`) lo devuelve TAL CUAL sin llamar a
   `_computeQualifiedFromLeagues` → `window._lastQualDiag` queda
   obsoleto (de otra pantalla, o vacío) → el diagnóstico mostraba un
   `poolReal` (del snapshot) y un `contributing` (de un cálculo viejo)
   que NO correspondían entre sí — «8/72 pero 0 ligas aportan» no tiene
   sentido y no ayuda a depurar.

### Fix

- `_eurHydrateMissingLeagues` hidrata las ligas **una a una** (`step()`
  secuencial), con **2 reintentos** en fallo de red/HTTP (nunca cuando
  el servidor responde OK pero sin esa liga — eso no es un fallo) y una
  pausa corta entre pasos. Timer de seguridad subido de 25 s a 90 s
  (una pasada secuencial completa tarda más que una ráfaga paralela,
  pero AHORA SÍ completa en vez de cortarse a los 25 s con la mayoría
  sin intentar). `_eurToast(...)` da feedback visual mientras tanto —
  antes el admin no tenía ninguna señal de que el botón seguía
  trabajando tras el `confirm()`.
- `window._wcDebugPool` fuerza el cálculo **EN VIVO** (bypass del
  snapshot vía `window._europeIgnoreFrozen`) para el diagnóstico —
  SIEMPRE refleja el desglose real por liga — e informa APARTE si hay
  un snapshot congelado con un recuento distinto, indicando que hay que
  volver a pulsar «Enviar realidad…» para refrescarlo.

### Reglas a respetar

1. **PROHIBIDO** que `_eurHydrateMissingLeagues` (o cualquier hidratador
   nuevo que traiga N recursos del servidor en un mismo golpe) dispare
   los `fetch` en paralelo sin cap de concurrencia. Contra Railway, un
   thundering herd de decenas de requests simultáneos falla en silencio
   para la mayoría. Todo fetch masivo nuevo hereda el patrón secuencial
   + pausado + reintentos de `_lextReconcileResultsToServer` /
   `_eurHydrateMissingLeagues`.
2. **PROHIBIDO** que una herramienta de diagnóstico (`_wcDebugPool` o
   cualquier futura) lea `window._lastQualDiag` sin garantizar que se
   acaba de poblar para la MISMA zona que está reportando. Si la
   función que lo puebla puede quedar short-circuited por un snapshot
   congelado (`_europeFrozenFor`), el diagnóstico debe forzar el cálculo
   en vivo (`_europeIgnoreFrozen=true`) para no mostrar cifras
   contradictorias.
3. Si el diagnóstico detecta un snapshot congelado con un recuento
   distinto del cálculo en vivo, debe decírselo EXPLÍCITAMENTE al admin
   (qué botón pulsar para refrescarlo) en vez de dejarle adivinar por
   qué el número de la pantalla no coincide con el del diagnóstico.

## El picker de eventos de una caja humana muestra SIEMPRE la plantilla de SU mister (obligatorio, 2026-06-28)

**Los 7 misters canónicos (club ↔ selección) — fuente de verdad, NUNCA mezclar**:

| Mister | Club | Selección |
|---|---|---|
| Toñín 💡 | Liverpool | Francia |
| Álvaro 🐭 | Arsenal | Brasil |
| Acsa 🔨 | Real Madrid | Inglaterra |
| Isra ✏️ | Atlético Madrid | Noruega |
| Ángel 😈 | FC Barcelona | Argentina |
| Izan 🦆 | PSG | España |
| Rubén 🐲 | Inter | Portugal |

**Bug (fotos usuario 2026-06-28, «Liverpool-Francia-Toñín»)**: al jugar la
card del Liverpool y pulsar **+ AÑADIR EVENTO**, el selector de jugador
(«GOL · LIVERPOOL») mostraba la plantilla del **INTER** (Sommer, Bastoni,
Lautaro, Thuram…) en vez de la del Liverpool. Coincidió con la alta del 7º
mister **Rubén = Inter** (2026-06-26). Causa raíz combinada: (1) el slot
«Liverpool» de `ligaExt_liga-ea-sports` tenía guardada físicamente la
plantilla del Inter (corrupción de datos del save del usuario — se resuelve
re-metiendo la plantilla del Liverpool en el editor); (2) los resolutores
del hub (`_bayernSquad`, `_findBayernRow`, `_lextFindHubTeamRow`, el
`_resolve` del header) llevaban listas `OTHER`/`others`/`o` de «clubes
humanos a excluir para encontrar MI slot» que **NO se actualizaron** al
añadir Inter/PSG → el fallback de un hub podía coger el slot del Inter.

**Fix (código, permanente)**:
- **`window._humanClubSlotName(teamName)`** (`misc_body_1.html`, junto a
  `_mhSameMister`): para un CLUB humano canónico, devuelve el NOMBRE del
  slot de `ligaExt_liga-ea-sports` que pertenece a SU MISTER (exacto si el
  slot se llama igual que el club — preserva byte-for-byte Liverpool/Toñín;
  si no, el slot del MISMO mister vía `_mhSameMister`, gateado a clubes
  humanos con `_isHumanClubCanonico` para NUNCA cruzar a otro mister).
  No-op para IA / selecciones / nombres no canónicos.
- **El event picker lo usa SIEMPRE**: gm-modal `_gmGetSquad` y ml-card
  `genTpSelect` resuelven el nombre por `_humanClubSlotName` ANTES de
  `sqFromRegistryFull`. Así cada caja humana muestra SU plantilla y jamás
  la de otro club humano.
- **Listas de exclusión completadas** con Inter (+ PSG donde faltaba) en
  los 4 resolutores del hub (`_bayernSquad` OTHER, `_findBayernRow` others,
  `_lextFindHubTeamRow` others, `_resolve` o): ningún hub humano puede
  coger por fallback el slot de OTRO mister.

**Reglas a respetar**:
1. **PROHIBIDO** que el event picker (gm-modal o ml-card) resuelva la
   plantilla de un club humano por nombre crudo sin pasar por
   `_humanClubSlotName`. Cada caja humana = la plantilla de SU mister.
2. **PROHIBIDO** añadir un mister nuevo sin meter su club (todos los alias)
   en las 4 listas de exclusión del hub (`OTHER`/`others`/`o`) y en
   `_MISTERS_HUMANOS`. El registro es la fuente única; toda caja nueva
   hereda `_humanClubSlotName` automáticamente.
3. La plantilla VIVE en `ligaExt_liga-ea-sports.teams[].players`. Si está
   corrupta (un club humano con la plantilla de otro), el código no puede
   inventarla: se restaura en el editor. El fix garantiza que, con datos
   correctos, cada caja muestre SIEMPRE su plantilla y nunca la cruce.

### La CABECERA del hub no se contamina con el override de OTRO mister — `_slot` también gateado (obligatorio, 2026-06-29)

**Bug (foto usuario «caja PSG → Inter»)**: al abrir la caja del **PSG**
(Izan 🦆🇪🇸) la cabecera del hub mostraba **«Inter · RUBÉN · GIUSEPPE
MEAZZA»** con el escudo del Inter, aunque el hub activo era Izan/PSG.

**Causa raíz**: el override del menú de la caja del PSG
(`menu_home_v1.ov['go:s-psg']`) había quedado con `label/escudo/estadio`
del **Inter** (contaminación del save). El guard anti-contaminación vivía
SOLO en `_resolve()` (descarta la identidad del override si apunta a OTRO
club humano canónico), pero **`_slot()` leía `_boxOv().label` por su
cuenta** y lo metía como PRIMERA pista de búsqueda → encontraba el slot
del «Inter» y lo devolvía; `_resolve` tomaba entonces `name=t.name=
"Inter"`. Como el míster y el tema se derivan del club RESUELTO `r.name`
(commit «el míster SIGUE al club mostrado»), la cabecera mostraba Rubén +
Giuseppe Meazza pese a estar en la caja de Izan.

**Fix** (`misc_body_1.html`, `_slot()`): el `label` del override SOLO
entra en `wants` si NO apunta a otro mister (`_mhFindMister(canon).id ===
_mhFindMister(ov.label).id`). Mismo guard que `_resolve()`. Así la caja
del PSG localiza SIEMPRE el slot del PSG por su nombre canónico, jamás el
del Inter por el label contaminado.

**Reglas a respetar**:
4. **PROHIBIDO** que `_slot()` (o cualquier resolutor de identidad del hub)
   use `_boxOv().label`/`escudo`/`stadium` SIN el guard anti-contaminación
   (`_mhFindMister(canon).id !== _mhFindMister(label).id` ⇒ descartar). El
   guard de `_resolve` no basta si `_slot` reintroduce el label por su lado.

## HUB MULTI-MISTER — el hub `s-munich` es GENÉRICO, datos por hub (obligatorio, 2026-06-13)

**Petición usuario 2026-06-13 («al pulsar la caja del Arsenal-Brasil sea
exactamente igual que la del Liverpool-Francia pero con los datos del
Arsenal: plantilla, histórico derbys, calendario, todo correspondiente al
Arsenal»)**: el hub rico (`s-munich`) deja de ser exclusivo de Liverpool y
pasa a ser un hub GENÉRICO que sirve a CUALQUIER caja de mister humano del
`MISTERS_HUMANOS`. Empezando por **Arsenal-Brasil** (Álvaro 🐭🇧🇷).

### Arquitectura: 1 pantalla parametrizada + datos POR HUB (NO duplicar)

- `window._ACTIVE_HUB` (en el IIFE de `MISTERS_HUMANOS`, `misc_body_1.html`)
  apunta al mister cuya caja se pulsó. Default = Toñín/Liverpool. Se
  persiste en `active_hub_v1` (cliente). Setter `window.setActiveHub(id)`
  (dispara `_mkHubResync` + evento `hubchange`). Accesores
  `window._activeHub()`, `window._activeHubIsLegacy()`.
- **Clave de almacenamiento POR HUB**: `window._hubKey(base)` devuelve la
  clave BASE sin sufijo para Liverpool/Toñín (datos + sync EXISTENTES
  intactos) y `base+'_'+id` para el resto (Arsenal → `..._alvaro`).
- **PROHIBIDO duplicar la pantalla** `s-munich` ni clonar sus IIFEs por
  hub: se REUTILIZA parametrizada. La caja Arsenal navega a `s-arsenal`,
  que tiene un MutationObserver que (pre-paint) hace
  `setActiveHub('alvaro'); go('s-munich')`. La caja Liverpool y la grid de
  EQUIPOS fijan el hub vía `data-hub` (handler del grid) + onclick inline.

### Resolutores hub-aware (default = Liverpool, byte-for-byte intacto)

`_psHumanName`, `_psHumanLogicName`, `_psHumanShield`/`_psCanonCrest`,
`_hubTeamName` (wallet + calendario misc_body_2), `_hubSelName`, el header
`_boxOv/_canonHubName/_slot` (+ `_mkHubResync`), `_bayernSquad` (exclusión
ya no descarta el club activo), los `_hubName` de las cajas de partidos, y
los prefill/save de Nivel/Forma del modal HUD: TODOS leen el HUB ACTIVO
(`_activeHub().screen/club`) ANTES de los fallbacks legacy. Si el hub es
Toñín, devuelven EXACTAMENTE lo de antes (Liverpool).

### Stores namespaced por hub (cada uno re-resuelve en `hubchange`)

| Dato | Clave base | Re-resolución |
|---|---|---|
| Cursor calendario | `liverpool_preseason_v1` (+cookie `livps`) | IIFE pretemporada: reasigna KEY + `_psInvalidateCache` |
| HUD 💼🪙💊 | `bayern_hud_overrides_v1` (+cookie `bayhud`, IDB row) | IIFE HUD: reasigna KEY/KV_URL, RESET gate hidratación + cache, re-pull |
| Trofeos | `bayern_trofeos_v1` | IIFE trofeos: reasigna + re-hidrata + render (no-Liverpool arranca VACÍO). Sync RECENCIA + EMPTY-GUARD por hub (ver abajo) |
| Objetivos config | `munich-obj-overrides-v1` | IIFE config: render DIFERIDO (tras reasignar progreso) |
| Objetivos progreso | `munich-obj-state-v4` | IIFE progreso: reasigna LS_OBJ SÍNCRONO + re-crea `_kvBlobSync` |
| Derbys temporadas/partidos | `bayern_derbys_seasons_v1` / `bayern_derbys_matches_v1` | 3 IIFEs (render/seasons/matches): reasignan + re-pull + render |

- Plantilla (`s-bayern-plantilla`) y card "Próximo partido" NO necesitan
  clave propia: resuelven el club/selección por los resolutores hub-aware
  (Arsenal = roster real de `ligaExt_liga-ea-sports` + selección Brasil).

### Servidor (app.py) — heredar TODAS las protecciones, sin duplicarlas

`_kv_hub_base(key)` mapea una variante `base_<id>` a su BASE, y se usa en
`_kv_is_allowed`, el branch `_KV_RECENCY_BLOB_KEYS`, los special-cases
`bayern_hud_overrides_v1` (rev guard + field-merge + anchor-guard) y
`munich-obj-state-v4` (empty-guard), y el merge de `_STATE_RECENCY_BLOB_KEYS`.
El cursor: `_is_cursor_key(k)` cubre `liverpool_preseason_v1_<id>` con el
MISMO merge monotónico (`_cursor_winner`). Derbys: viajan por `/api/state`
(merge_dict genérico acepta claves arbitrarias) + unión cliente. Tests en
`tests/test_api.py::TestMultiHubKeys`.

### Vitrina de trofeos POR HUB — RECENCIA + EMPTY-GUARD (obligatorio, 2026-06-27)

**Bug (fotos usuario 2026-06-27, «Arsenal-Álvaro» + «Real Madrid-Acsa»)**:
el admin tenía la vitrina de trofeos llena para esas cajas de mister y al
volver salían a **0** («no se han guardado»). El sync de `bayern_trofeos_v1`
(+ variantes por hub) era frágil: `save()` era fire-and-forget SIN sello ni
reintentos, el server hacía **last-write-wins** (un POST vacío de un móvil
recién wipeado borraba la vitrina de toda la red), y la hidratación usaba una
heurística que podía saltar el GET. Mismo patrón «se pierde al borrar datos»
que el HUD/derbys/sanciones.

**Fix** — la vitrina hereda la durabilidad documentada:
- **Cliente** (`misc_body_1.html`, IIFE trofeos): cada `save()` (acción
  EXPLÍCITA del admin tras PIN 747) sella `updatedAt` en `<STORE_KEY>_ts`,
  POSTea el formato `{updatedAt, items}` con **3 reintentos** y marca
  `authoritative:true` (gana por recencia, puede vaciar a mano).
  `_hydrateTrofFromServer` SIEMPRE hace GET y resuelve por recencia: adopta
  el server si es más nuevo (o el local solo trae defaults), o RE-EMPUJA el
  local autoritativo para CURAR el server (basta un dispositivo con la
  vitrina para restaurarla en todos). Acepta el formato legacy (array crudo).
- **Servidor** (`app.py`, `_trofeos_merge` en `api_kv_set`, vía
  `_kv_hub_base == 'bayern_trofeos_v1'`): **EMPTY-GUARD** (un POST vacío
  NO-autoritativo nunca borra una vitrina almacenada con datos) +
  **RECENCIA** (sello mayor gana; stale no pisa lo nuevo). La acción
  autoritativa del admin SÍ puede vaciar. Acepta legacy bare-array. Tests en
  `tests/test_api.py::TestTrofeosMerge`.

**Reglas a respetar**:
- **PROHIBIDO** que el sync de la vitrina vuelva al fire-and-forget sin
  sello / al last-write-wins del server. Toda variante por hub
  (`bayern_trofeos_v1_<id>`) hereda RECENCIA + EMPTY-GUARD vía `_kv_hub_base`.
- **PROHIBIDO** que un POST vacío NO-autoritativo borre la vitrina: solo la
  acción autoritativa del admin (✏️/🗑 tras PIN) puede vaciarla.
- La importación de backup (V2) re-sube TODAS las variantes
  `bayern_trofeos_v1_<id>` (no solo la base) autoritativas, para restaurar el
  palmarés de las 6 cajas.

### Reglas a respetar

1. **PROHIBIDO** romper el camino Liverpool: si `_ACTIVE_HUB` es Toñín,
   `_hubKey` devuelve la clave BASE y TODO resuelve como antes. Cualquier
   refactor debe preservar esto (los tests del HUD/cursor base no bajan).
2. **PROHIBIDO** duplicar físicamente la pantalla `s-munich` o sus IIFEs por
   hub. Se parametriza por `_ACTIVE_HUB` + `_hubKey`. Toda caja de mister
   nueva se habilita igual que Arsenal (registro + `data-hub` + redirect).
3. **PROHIBIDO** que un store de hub NUEVO use la clave base cruda: debe
   pasar por `_hubKey(base)`, re-resolverse en `hubchange`, y —si va a KV—
   añadir su base a `_KV_HUB_BASE_KEYS` (servidor) para heredar el merge.
4. **PROHIBIDO** que un writer AUTOMÁTICO del HUD escriba antes de hidratar
   tras un `hubchange`: el listener resetea el gate (`_hudHydrated=false`)
   y re-pull; trátalo como cold-start (reglas 5-7 del HUD siguen vigentes).
5. El gate de objetivos (reglas 14-17) sobrevive: al cambiar de hub se
   re-crea `_objStateSync` ligado a la nueva clave; `liverpoolObjEarnings`
   no deflacta hasta que el nuevo progreso HTTP-hidrate.

## El ACTA de un partido NUNCA se pierde en la fusión cross-device — TODA competición (obligatorio, 2026-06-06)

**Regla general (petición usuario 2026-06-06, «que no vuelva a pasar con
las estadísticas de NINGÚN torneo, Copa, Liga, competición»)**: en un
juego con 6 móviles + PC tocando los mismos datos, una copia
**solo-marcador** (un dispositivo que guardó el partido ANTES de cargar
el motor de actas `genMatchEventsEnhanced`, o re-guardó solo el resultado)
NUNCA debe machacar los `events`/goleadores/MVP que otro dispositivo ya
generó para el MISMO partido. Es la causa raíz de «el partido se jugó
(marcador OK) pero las Estadísticas salen vacías».

### Principio único (espejo en TODAS las fusiones de resultados)

A igualdad de MARCADOR, entre dos copias de un mismo partido la que trae
el acta (`events`/`acta`/`scorers`) GANA, aunque su sello (`ua`/updatedAt)
sea menor. Un marcador DISTINTO sí decide por recencia (una corrección
legítima del resultado no se revierte). Es ADITIVO: nunca borra un acta
ya presente.

### Dónde está implementado (cada fuente de eventos del juego)

| Competición(es) | Fuente de eventos | Fusión protegida |
|---|---|---|
| Torneos: Selecciones (`spv*`/`sfn*`), Mundial 2032 (`mundial-48`), Mundialito (`tour_mundial_v1`), Verano (`jg/asia/sct/pss/tx*`) | `tour_<id>_v1.cfg.results[mk].events` | **Servidor** `sync_merge.py::_pick_result` (a igualdad de marcador gana el acta) + **cliente** `_tourLoad`→`_tourBackfillActaFromLocal` |
| Copa del Rey | `copa_state.resultados[ronda][idx].events` | **Servidor** `sync_merge.py::copa_state_merge` (unión por ronda+idx, `_copa_pick_result`) en `/api/copa/state_set` |
| Liga EA Sports | `liga_results[<j\|home\|away>].events` (= `ef_liga38_v4`) | **Servidor** `app.py::_preserve_results_acta` tras el `merge_dict` de `/api/state` (restaura el acta que un `events:[]` entrante vaciaría) |
| Resto de Ligas / Hypermotion / 1ªRFEF / Superliga / Resto del Mundo | stats per-jugador en `team.players[]` (NO en `results[].events`; `ligaExtSimular` solo guarda `{h,a,gh,ga,tah,...}`) | `_lx_merge_teams` fusiona por equipo por `updatedAt` (las stats viajan en el equipo, no en el acta) |
| Europeas KO (UCL/UEL/UECL fase final, Recopa, USC, Inter) | bracket en `recopa_state_v1`/`inter_state_v1`/etc. + `cfg.results` en vivo | `rebuildPlayerStatsStore` las reconstruye EN VIVO desde su estado; sin fusión KV propia (estado local) |

### Las estadísticas SOBREVIVEN al borrado de datos / cambio de móvil

No basta con que el acta no se pierda en la fusión: tras un borrado de
datos de navegación (o en un móvil nuevo) el cliente debe poder
RECONSTRUIR las estadísticas desde el servidor. Para cada fuente:

- **Torneos** (`tour_*_v1`): la cfg (con `results[].events`) está en KV
  y se rehidrata en `_tourLoad`; `rebuildPlayerStatsStore` Source 3 +
  `_tourCollectStatsForTour` leen `cfg.results` en vivo.
- **Liga EA Sports**: `liga_results` (con events) viaja en `/api/state`;
  el poll global (`hydrateLigaStateFromBackend`) lo escribe en
  `ef_liga38_v4` y Source 2 reconstruye.
- **Copa del Rey**: `copa_state` (con `resultados[].events`) viaja en
  `/api/state`; el poll global Y la pantalla de la Copa lo espejan a
  `localStorage['copa_state_v1']`, y **`rebuildPlayerStatsStore` Source 5**
  lo itera → bucket `copa` (dedup `copa|`+`_mkPJ` compartido con Source 1).
- **Intercontinental**: `inter_state_v1` (Source 4), ya durable.

**PROHIBIDO** que una caja de stats dependa SOLO de `LIGA_PLAYER_MATCH_STORE`
(memoria volátil): toda comp cuyos events no viajen ya en `tour_*_v1`/
`ef_liga38_v4` necesita su propia Source durable en `rebuildPlayerStatsStore`
leyendo el estado persistido (como Source 4 inter / Source 5 copa).

### Reglas a respetar

1. **PROHIBIDO** que CUALQUIER fusión de resultados (servidor o cliente,
   actual o futura) decida solo por recencia/last-write ignorando el acta.
   A igualdad de marcador, la copia con `events` gana SIEMPRE.
2. **Toda competición/fuente NUEVA** que guarde `events` de partido debe
   heredar este principio en su punto de fusión (añadir el guard como en
   `_pick_result`/`copa_state_merge`/`_preserve_results_acta`) Y, si sus
   events no viven ya en una fuente durable que el rebuild lea, añadir su
   Source en `rebuildPlayerStatsStore`.
3. Tests obligatorios en `tests/test_sync_merge.py` (torneos + Copa) y la
   verificación del helper de Liga. No bajarlos.
4. El guard es ADITIVO: nunca borra ni cambia un acta ya presente, solo
   restaura la que el merge habría perdido con el mismo marcador.
5. **PROHIBIDO** quitar el mirror `copa_state_v1` (poll global + pantalla
   Copa) o la Source 5: sin ellos la caja Estadísticas de la Copa se
   vacía tras un borrado de datos / cambio de móvil.

## El ACTA de un partido de torneo NUNCA se pierde en la fusión cross-device (obligatorio, 2026-06-06)

**Bug (fotos usuario 2026-06-06, «Road Copa Asia»)**: un torneo de
Selecciones (Rondas Previas, slot `spv*`, formato `qualifier-route`)
tenía partidos JUGADOS y con 📋 ACTA visible (España 1-2 Líbano,
Birmania 1-0 Vietnam, España 4-2 Hong Kong…), pero la pantalla
**«Road Copa Asia - Estadísticas»** (`s-tour-stats`) salía «Sin datos
todavía» en TODAS las categorías (Goleadores, Portería imbatida,
Tarjetas).

### Causa raíz

La card del torneo y la caja de Estadísticas leen el MISMO cfg
(`_TOUR_CACHE[tourId]` / `_tourLoadCachedSync`). El botón 📋 ACTA solo
se pinta si `res.events` es un array no vacío (`_tourActaPanelHtml`),
así que ver ACTA demuestra que los eventos SÍ estaban en `cfg.results`.
La caja de stats salía vacía porque, entre ver la card y abrir las
stats, el `_tourLoad` ASÍNCRONO traía del servidor una copia del cfg
con los partidos SOLO-MARCADOR (sin `events`) y machacaba la cache:

- **Servidor** (`sync_merge.py`, `_pick_result`): al reconciliar un
  mismo `matchKey` presente en dos dispositivos, decidía SOLO por
  `played` + `ua` (sello ms por partido). Como los resultados de torneo
  **no estampan `ua`**, ganaba el último que escribió — y si esa copia
  era solo-marcador (un móvil que guardó el partido ANTES de cargar el
  motor de actas `genMatchEventsEnhanced`, o re-guardó solo el marcador),
  **descartaba los `events` ya generados en otro móvil**. El partido
  sobrevivía (marcador → clasificación OK) pero el acta/goleadores/MVP
  desaparecían → caja de stats vacía.

### Fix — el acta es dato que NO se pierde (espejo de la regla de escudos)

- **Servidor** (`_pick_result`): si dos copias jugadas tienen el MISMO
  marcador pero una trae acta (`events`/`acta`) y la otra es
  solo-marcador, **gana SIEMPRE la que tiene acta**, aunque su `ua` sea
  menor. Un marcador DISTINTO sigue decidiendo por `ua` (una corrección
  legítima del resultado no se revierte). Tests en
  `tests/test_sync_merge.py`.
- **Cliente** (`_tourLoad` → `_tourBackfillActaFromLocal`): al adoptar
  el cfg del servidor, rellena el acta de cada partido que el server
  trajo solo-marcador desde la copia LOCAL que sí la tiene, SIEMPRE que
  el marcador coincida. Nunca pisa un acta que el server ya traiga ni
  toca partidos con marcador distinto. Defensa en profundidad: la caja
  de stats no se vacía al sincronizar aunque el server tarde en
  converger.

### Reglas a respetar

1. **PROHIBIDO** que `_pick_result` vuelva a decidir SOLO por
   `played`+`ua` ignorando el acta: a igualdad de marcador, la copia con
   `events` gana. Eso evita que un guardado solo-marcador borre los
   goleadores.
2. **PROHIBIDO** que `_tourLoad` adopte el cfg del servidor sin pasar
   por `_tourBackfillActaFromLocal` (rellena el acta perdida desde el
   local con el mismo marcador).
3. Todo result de torneo debe llevar `events`+`home`+`away` (lo estampan
   `_tourAttachActa` para IA y `_tourSaveHumanResult` para humanos). La
   caja `s-tour-stats` los agrega vía `_tourCollectStatsForTour`
   (`_mundialStatsRobustScan` → `_tourStatsFromCfgResults`), que ya tiene
   backfill por si faltaran — pero la fuente NO debe perderlos en el sync.

## El HUD del hub (🪙💊💼) se SINCRONIZA por `/api/kv` (recencia), NUNCA por `/api/state` (obligatorio, 2026-06-06)

**Bug (fotos usuario 2026-06-06, «Liverpool-Francia»)**: el usuario
reinicia la temporada, abre el editor 🖍 EDITAR HUD y pone 🪙 2500 ·
💊 4 · valoración objetivo 8.80. **Borra los datos de navegación** y al
volver la FECHA (01 May) está bien pero los **valores del HUD vuelven a
los defaults** (🪙 0 · 💊 8 · /9.10). «Los valores no se han cambiado.»

### Causa raíz

`bayern_hud_overrides_v1` (🪙 presupuesto · 💊 puntos de fisio · 💼
valoración + objetivos) era el ÚNICO blob de running-total que aún vivía
en el blob **TOP-LEVEL de `/api/state`**, compartido por DECENAS de
writers concurrentes:

- El poll de Liga / `competition_state` POSTea `/api/state` cada pocos
  segundos (read-modify-write del estado completo).
- `/api/state/reset-liga` («Reiniciar Temporada») hace
  `save_global_state(data, replace=True)` con el estado ENTERO cargado
  — y la rama `replace=True` **NO aplica la corrección por recencia**
  (esa solo está en la rama `replace=False`).

Cualquier write ajeno que leyera la fila ANTES del save del HUD y la
escribiera DESPUÉS **descartaba** el 🪙/💊/💼 recién guardado. Y como el
HUD se sube **UNA sola vez** (no se re-pushea solo), ese clobber era
**PERMANENTE**: tras borrar datos de navegación, la rehidratación
(`_serverPull`) no encontraba nada en el server y el HUD caía a los
defaults hardcoded. La **FECHA** (`liverpool_preseason_v1`) SÍ sobrevive
porque su cursor tiene merge MONOTÓNICO dedicado **+ re-push frecuente**
(self-healing); el HUD no tenía ninguna de las dos cosas.

### Fix — mover el HUD a su PROPIA fila KV con merge por recencia

`bayern_hud_overrides_v1` pasa al patrón canónico de todos los demás
blobs «sobrevive al wipe» (bajas/sanciones, mensajes, CASH…):

- **Servidor** (`app.py`): la clave está en `_KV_ALLOWED_EXACT` **y** en
  `_KV_RECENCY_BLOB_KEYS`. `/api/kv/<key>` guarda **una fila por clave**
  → CERO contención con otros writers; `reset-liga` (que reescribe la
  fila principal) ni la toca. Merge por RECENCIA: el blob con `updatedAt`
  mayor gana ENTERO (un consumo legítimo de PI / suma de presupuesto no
  se revierte; un POST stale no pisa lo más nuevo).
- **Cliente** (`misc_body_1.html`, IIFE del HUD admin): `_serverPush`
  POSTea `/api/kv/bayern_hud_overrides_v1` con `{value:o}`; `_serverPull`
  hace GET del KV y adopta por recencia (`_adoptFromServer`). Si el KV
  está vacío, **fallback de migración** `_legacyStatePull` lee el blob
  legacy de `/api/state` UNA vez, lo adopta y lo re-sube al KV.

### Reglas a respetar

1. **PROHIBIDO** devolver `bayern_hud_overrides_v1` (ni ningún
   running-total / consumible del HUD) al blob top-level de `/api/state`.
   Vive en su fila `/api/kv` con merge por recencia.
2. **PROHIBIDO** quitar `bayern_hud_overrides_v1` de `_KV_ALLOWED_EXACT`
   o de `_KV_RECENCY_BLOB_KEYS`, o cambiar `_serverPush`/`_serverPull`
   para que vuelvan a `/api/state`. Reintroduce el clobber.
3. Todo store nuevo de running-total / consumible del hub hereda este
   patrón: fila KV propia + recencia, NUNCA el blob compartido de
   `/api/state` (que sufre read-modify-write races + `replace=True`).
4. `save()` SIEMPRE estampa `updatedAt` (ms) en el blob antes de subir —
   sin él la recencia del server no puede arbitrar.

### GATE de hidratación — el HUD no se sube antes de reconciliar (obligatorio, 2026-06-07)

**Bug (queja usuario 2026-06-07, «los iconos 💼🪙💊 que les da la
gana»)**: el admin editaba el HUD pero, tras borrar datos de navegación
o estar 3 días fuera, los valores volvían a los defaults. La recencia +
fila KV propia NO bastaban: faltaba el GATE de hidratación que ya es
obligatorio para todo store `_kvBlobSync` (bajas/sanciones, 2026-06-04).

**Causa raíz**: tras un wipe / en otro móvil, `_BAYERN_HUD_CACHE` está
vacío. Un writer AUTOMÁTICO de running-total —`_bayernHudCreditMoney`
(premio de torneo / coste de sim), `liverpoolObjEarnings` (objetivos)—
corría ANTES de que `_serverPull` reconciliara, leía un base vacío/stale
(money≈0) y hacía `save()` SELLADO con `updatedAt` FRESCO ⇒ ganaba la
recencia del server y, en el siguiente pull, el local "más nuevo" se
re-subía ⇒ **clobber PERMANENTE** de lo que el admin puso → defaults.

**Fix** (`misc_body_1.html`, IIFE del HUD admin):
- `_hudHydrated` (+ espejo `window._BAYERN_HUD_HYDRATED`) se marca SOLO
  al recibir una RESPUESTA HTTP del KV en `_serverPull` (no en fallo de
  red: si el server está caído, los créditos quedan EN COLA, nunca
  clobberean).
- `_serverPush(o, force)`: una escritura AUTOMÁTICA (`!force`) NO sale al
  server antes de hidratar.
- Writers automáticos DIFERIDOS: `_bayernHudCreditMoney` acumula su delta
  en `_pendingMoneyDelta` y se aplica de golpe en `_markHydrated` sobre
  el base ya reconciliado (ni se pierde ni clobberea); `_bayernHudMerge`
  automático y `liverpoolObjEarnings` se rearman vía
  `window._bayernHudOnHydrate`.
- La acción EXPLÍCITA del admin (✅ Guardar / ♻ Restablecer /
  📅 Reiniciar Temporada) pasa `force:true` + `_markHydrated()`: SIEMPRE
  persiste (su intención es autoritativa) y gana por recencia.
- `focus`/`pageshow`/`visibilitychange` re-pullean: recuperan un
  cold-start que falló las 3 ventanas de boot y CONVERGEN al volver tras
  estar fuera (la queja «3 días sin entrar»).

**Reglas a respetar**:
5. **PROHIBIDO** que un writer AUTOMÁTICO de running-total del HUD
   (`_bayernHudCreditMoney`, `_bayernHudMerge` sin `force`,
   `liverpoolObjEarnings`, o cualquiera nuevo) escriba al server antes de
   `_hudHydrated`. Debe diferirse (cola de delta / `_bayernHudOnHydrate`).
6. **PROHIBIDO** marcar `_hudHydrated` en un fallo de red (sólo con
   respuesta HTTP del KV). Marcarlo a ciegas reintroduce el clobber con
   base vacío cuando el server tarda en responder.
7. Toda acción EXPLÍCITA del admin que escriba el HUD pasa `force:true`
   (bypassa el gate). Todo writer automático nuevo hereda el gate.

### Escritura AUTORITATIVA + re-push self-heal + BD persistente (obligatorio, 2026-06-07)

**Bug (2 fotos usuario 2026-06-07)**: admin pone día 11 de mayo
💼/8.80 · 🪙 2350 · 💊 3, sale el toast verde **«✓ HUD guardado»** (el
POST devolvió 200), pero al **borrar datos de navegación** el HUD
**«vuelve a datos antiguos»** (la FECHA 11 May sí persiste).

**Dos causas combinadas**:
1. **Recencia rechazaba el guardado del admin por clock-skew**. En un
   parque de 6 móviles + PC, un dispositivo con el **reloj adelantado**
   dejaba en el server un valor viejo con `updatedAt` FUTURO. El guardado
   del admin (reloj correcto, ts menor) era **RECHAZADO** por el merge de
   recencia — aunque el POST devolvía 200 (el toast verde MENTÍA) — y al
   borrar datos el GET devolvía ese valor viejo.
2. **El server pierde el blob (SQLite EFÍMERO)** y otros dispositivos
   re-empujan valores VIEJOS, así que el móvil que borró datos recupera
   uno de ésos.

**Fix**:
- **Escritura AUTORITATIVA** (`misc_body_1.html` + `app.py`): la acción
  explícita del admin (✅/♻/📅) manda `authoritative:true` en el POST.
  El **servidor** (`api_kv_set`, blobs de `_KV_RECENCY_BLOB_KEYS`) la
  guarda GANANDO siempre y **sella `updatedAt` con SU PROPIO reloj** por
  encima de lo almacenado (`max(server_now, stored+1, client)`). Una
  sola fuente monotónica ⇒ el reloj adelantado de otro móvil ya no puede
  revivir un valor viejo. Los writers normales (re-push / running-total)
  siguen por recencia pura.
- **Re-push frecuente self-heal** (`_serverRepush`, cada 25s + al volver
  el foco): cada dispositivo con valores re-sube el blob TAL CUAL (sin
  re-sellar `updatedAt`), manteniendo el server poblado tras un reset de
  la BD efímera — igual que la FECHA.

**Regla a respetar**:
8. **PROHIBIDO** quitar el flag `authoritative` de la acción del admin ni
   el sello con reloj del SERVER en `api_kv_set` para los blobs de
   recencia: sin él, el reloj adelantado de otro dispositivo vuelve a
   rechazar/revertir el guardado del admin.
9. La BD del server DEBE ser persistente (Postgres vía `DATABASE_URL`, o
   volumen montado). Con SQLite efímero el re-push solo enmascara el
   problema mientras haya un dispositivo activo con el valor correcto.
   Verificable en `/api/debug` (`"postgresql"` = ✅ · `"sqlite"` = ⚠️).

### CAUSA RAÍZ REAL — el seed de PI del arranque borraba el HUD (obligatorio, 2026-06-08)

**Bug (captura `/api/kv/bayern_hud_overrides_v1` del usuario)**: con la
BD ya PERSISTENTE (Postgres, confirmado en `/api/debug`), el server tenía
guardado **SOLO** `{"pi":8,"updatedAt":...}` — sin `money`/`rating`/
`ratingTarget`/`moneyTarget`. Un escritor borraba TODO el HUD dejando
solo el PI por defecto.

**Causa raíz**: en `part2/misc_body_2.html` había, a +30 ms del arranque,
`setTimeout(function(){ athSetMedicalPI(athGetMedicalPI()); ... }, 30)`.
A los 30 ms el HUD AÚN NO ha hidratado del server, así que
`athGetMedicalPI()` devuelve el **default 8** (state legacy / DOM SSR) y
`athSetMedicalPI(8)` hace `_bayernHudMerge({pi:8})` sobre una base
VACÍA ⇒ `{pi:8}` se guarda en el server y BORRA money/rating/objetivos.
Y se repetía en CADA arranque (cada móvil), así que el `pi` volvía a 8
y el resto desaparecía. Era el clobber que ninguna capa anterior
(recencia, authoritative, re-push) podía evitar porque el propio seed
corría antes de hidratar.

**Fix**: el seed de PI del arranque se DIFIERE con
`window._bayernHudOnHydrate(...)`. Tras hidratar, `athGetMedicalPI()`
devuelve el PI REAL ya adoptado del server y el re-guardado es un no-op
que conserva los demás campos. Si el API del HUD no existe, NO persiste.

**Reglas a respetar**:
10. **PROHIBIDO** que NINGÚN seed/refresh del arranque
    (`athSetMedicalPI(athGetMedicalPI())` u otro) persista el HUD
    (`_bayernHudMerge`/`save`/`athSetMedicalPI`) antes de hidratar. Todo
    seed de arranque que escriba el HUD debe ir dentro de
    `window._bayernHudOnHydrate(...)`.
11. **PROHIBIDO** que un writer de un SOLO campo del HUD (p.ej. `{pi}`)
    corra sobre un `load()` vacío: el merge resultante (`{pi:8}`) borra
    el resto de campos. El gate de hidratación lo previene; no añadir
    writers de campo suelto fuera de ese gate.

### Defensa a prueba de balas en el SERVER — field-merge del HUD (obligatorio, 2026-06-08)

**Por qué**: con 6 móviles + PC, no se puede confiar en que TODOS tengan
desplegado el último cliente. Un móvil con código viejo puede mandar un
POST PARCIAL (`{pi:8}`) que borraba money/rating/objetivos del server
(captura usuario: el server tenía SOLO `{"pi":8}`). La defensa definitiva
va en el SERVER, donde un solo punto protege a todos los clientes.

**Fix** (`app.py`, `api_kv_set`, SOLO la clave `bayern_hud_overrides_v1`):
los writes NO-authoritative hacen **FIELD-MERGE que PRESERVA campos**: los
que el POST no trae se rellenan desde lo almacenado, así que un write de
un solo campo NUNCA vacía el resto. Recencia en los campos compartidos
(`new_ts >= old_ts` ⇒ el entrante actualiza sus campos; más viejo ⇒ se
conserva el almacenado entero). La acción AUTORITATIVA del admin sigue
siendo REEMPLAZO total (puede limpiar campos: ♻ Restablecer).

**Regla a respetar**:
12. **PROHIBIDO** que el HUD no-authoritative haga REEMPLAZO total en el
    server (volvería a permitir que un `{pi:8}` parcial borre el resto).
    Field-merge SIEMPRE para no-authoritative; replace SOLO para
    authoritative (intención explícita del admin de limpiar).

### El 💊 PI volvía a 8 — rechazo de POST parcial + boot sin seed (obligatorio, 2026-06-08)

**Bug (2 fotos usuario 2026-06-08)**: tras el field-merge, money/rating ya
SOBREVIVÍAN al borrado de datos, PERO el **💊 PI volvía SIEMPRE a 8**. El
field-merge preserva los campos que el POST NO trae, pero el seed de
arranque SÍ trae `pi` (=8 por defecto), así que ese campo se aplicaba.

**Causa**: (1) el seed de arranque `athSetMedicalPI(athGetMedicalPI())`
seguía mandando `pi=8` (en un móvil sin actualizar, o leído antes de
hidratar); (2) el server aplicaba ese `pi` aunque el POST fuera parcial.

**Fix**:
- **Cliente** (`part2/misc_body_2.html`): se ELIMINA por completo el seed
  de PI del arranque (no aporta nada — `apply()` ya pinta el PI desde la
  hidratación). El boot solo refresca la lista de lesionados y cablea el
  botón del menú médico; NO toca el PI ni persiste el HUD.
- **Server** (`app.py`, `api_kv_set`, `bayern_hud_overrides_v1`): un POST
  no-authoritative que NO trae NINGÚN campo ANCLA
  (`money`/`rating`/`ratingTarget`/`moneyTarget`) pero el almacenado SÍ
  los tiene, se RECHAZA ENTERO (no toca ni `pi`). Un blob legítimo
  siempre trae campos ancla (los writers reales mergean sobre el cache
  completo ya hidratado), así que solo el seed parcial cae aquí.

**Regla a respetar**:
13. **PROHIBIDO** reintroducir un seed/persistencia de PI en el arranque
    (`athSetMedicalPI` en boot) o quitar el rechazo de POST parcial sin
    campos ancla: cualquiera de los dos hace que el 💊 vuelva a 8.

### El HUD lleva un RELOJ LÓGICO `rev` monotónico (obligatorio, 2026-06-11)

**Bug (3 fotos usuario 2026-06-11, «Liverpool/Francia»)**: el admin tiene
🪙 4500 (PI 5), juega y el presupuesto baja a 4350 (running total) — la
FECHA avanza 01→15 May —, pero al **borrar datos de navegación** el HUD
entero vuelve a defaults (🪙 **0**, 💊 en blanco). La **FECHA (15 May)
SOBREVIVE al wipe** en la misma pantalla → la BD del server ES persistente;
es el blob del HUD el que se pierde, NO la fecha.

**Causa raíz**: el cursor de fecha (`liverpool_preseason_v1`,
`_STATE_CURSOR_KEYS`) sobrevive porque tiene un **monotónico** (`dayIdx`):
el server RECHAZA cualquier push con un `dayIdx` MENOR, así que ninguna
copia stale/clock-skew puede arrastrarlo hacia atrás. El HUD solo tenía
**recencia por reloj de pared** (`updatedAt`). En un parque de **6 móviles
+ PC**, un dispositivo con **JS viejo en caché** (otro móvil sin recargar,
aún con bugs de deflación), con el **reloj adelantado**, o con el blob en
**defaults**, re-empuja un HUD deflactado/vacío que **GANA por recencia** y
machaca el server para todos. Al borrar datos, el GET trae ese blob
machacado → 🪙 0.

**Fix — `rev` (reloj lógico, espejo del `dayIdx`)**:
- **Cliente** (`misc_body_1.html`, `save()`): cada cambio REAL incrementa
  `rev` sobre el máximo conocido (cache + localStorage). `_adoptFromServer`
  decide «local más nuevo» PRIMERO por `rev` (no por `updatedAt`): si el
  server trae un `rev` mayor lo ADOPTA aunque el `ts` local sea (falsamente)
  mayor; solo re-sube si el `rev` local es mayor. El re-push self-heal
  (`_serverPush` directo, sin `save()`) re-asserta el MISMO `rev`, no bumpea.
- **Servidor** (`app.py`, `api_kv_set`, `bayern_hud_overrides_v1`): un push
  no-authoritative con `rev` MENOR que el almacenado se **RECHAZA ENTERO**
  (cliente viejo sin `rev`=0, stale, o clock-skew). `rev` mayor ⇒ field-merge
  (preserva campos); `rev` igual ⇒ recencia por `ts` + field-merge. La acción
  **AUTORITATIVA** del admin (✅/♻/📅) bumpea `rev = max(old,new)+1` y GANA
  siempre — una vez el admin guarda desde un cliente actualizado, ningún
  móvil sin actualizar puede volver a pisar el HUD. Tests en
  `tests/test_api.py::TestBayernHudRevGuard`.

**Reglas a respetar**:
13b. **PROHIBIDO** quitar el `rev` del HUD ni volver a arbitrar el merge del
     server SOLO por `updatedAt`: sin el monotónico lógico, un cliente
     stale/viejo/clock-skew vuelve a machacar el 🪙 por recencia (el HUD es
     tan frágil como la fecha es robusta — la diferencia es el monotónico).
13c. **PROHIBIDO** que el re-push self-heal bumpee `rev` (debe re-assertar el
     mismo) ni que un writer automático lo decremente. Solo `save()` (cambio
     real) lo incrementa; la acción autoritativa del admin lo bumpea +1 para
     ganar a cualquier copia, incluidos clientes sin `rev`.

### El progreso de OBJETIVOS no se sube VACÍO tras un re-render (obligatorio, 2026-06-11)

**Bug (2 fotos usuario 2026-06-11, «Liverpool»)**: el admin edita el
🪙 presupuesto (5025) y cumple objetivos (1/68 ✅, 💼 0.28), pero al
**borrar datos de navegación** vuelve TODO a 0 (🪙 0 · 💼 0.00 ·
objetivos 0/68) — sólo los TARGETS (8.80 /1300€) sobreviven.

**Causa raíz**: `boot()` del editor de objetivos hace un pull aditivo de
`munich-obj-overrides-v1` (`_hydrateOverridesFromServer`). Cuando el
server trae overrides que el dispositivo no tiene (caso típico tras un
WIPE: local vacío, server con datos ⇒ `changed=true`) re-renderiza
`#ath-obj-club` con `renderAll`, dejando TODOS los ✅ DESMARCADOS (HTML
nuevo). Acto seguido llamaba a `athObjCount()` —que está ENVUELTO por
`patchAthObjCount`— ANTES de restaurar los ✅ con `loadObjState`
(`_munichObjAfterRender`). Ese `athObjCount` prematuro disparaba:
(1) `saveObjState` → subía un progreso VACÍO que MACHACABA
`munich-obj-state-v4` en el server (objetivos → 0/68), y (2)
`liverpoolObjEarnings` con `done=0` → hundía 🪙/💼, y el field-merge del
server los machacaba CONSERVANDO los targets (de ahí que sólo el target
sobreviva). Tras el wipe la hidratación recuperaba ese blob ya en blanco.

**Fix**:
- (`misc_body_1.html`, callback de `_hydrateOverridesFromServer`): tras
  `renderAll` se llama SIEMPRE a `_munichObjAfterRender` (que hace
  `loadObjState` → restaura los ✅ → `athObjCount`), NUNCA un
  `athObjCount` suelto sobre el DOM recién re-renderizado.
- (`liverpoolObjEarnings`): GATE de hidratación del PROGRESO (`_objStateSync.isHydrated()`),
  espejo del gate del HUD. No recalcula 🪙/💼 leyendo `done` del DOM
  hasta que `munich-obj-state-v4` haya reconciliado; se rearma vía el
  adopt del obj-state + un poll (cubre el caso local-autoritativo sin adopt).

**Reglas a respetar**:
14. **PROHIBIDO** contar/persistir objetivos (`athObjCount`/`saveObjState`/
    `liverpoolObjEarnings`) sobre un `#ath-obj-club` recién re-renderizado
    por `renderAll` SIN haber restaurado antes los ✅ con `loadObjState`
    (vía `_munichObjAfterRender`). Un conteo sobre el DOM desmarcado sube
    un progreso VACÍO que machaca el server.
15. **PROHIBIDO** que `liverpoolObjEarnings` recalcule 🪙/💼 desde `done`
    (DOM) antes de que el PROGRESO (`munich-obj-state-v4`) haya hidratado.
    Gate `_objStateSync.isHttpHydrated()` + rearme; igual que el gate del HUD.

### El gate del recálculo exige RESPUESTA HTTP, no la `isHydrated` genérica (obligatorio, 2026-06-11)

**Bug (queja usuario 2026-06-11, «añado presupuesto y guardo; al borrar
datos de navegación los contadores de presupuesto vuelven a 0»)**: el
guardado AUTORITATIVO del 🪙 llegaba bien al server y el GET tras el wipe lo
restauraba, pero acto seguido `liverpoolObjEarnings` lo PONÍA A 0.

**Causa raíz**: el gate de la regla 15 usaba `_objStateSync.isHydrated()`.
En `_kvBlobSync.hydrate` (`index.bundle.js`) `st.hydrated` se marca `true`
**también en el `.catch` de un FALLO DE RED** (es deliberado para poder
re-empujar la copia local al volver la conexión). Si tras el wipe el GET del
PROGRESO (`munich-obj-state-v4`) fallaba pero el del HUD NO (cold start de
Railway, un GET sí y otro no), `isHydrated()` daba `true` SIN haber
restaurado los ✅ → `done=0` aunque el server tuviera objetivos cumplidos.
`liverpoolObjEarnings` restaba TODO el aporte de objetivos
(`prevObjMoney` − 0, hasta 68×25 = 1700) a `money`, lo CLAMPEABA a 0 y
empujaba ese 0 al server (field-merge no-authoritative) → el presupuesto
«vuelve a 0».

**Fix**: `_kvBlobSync` expone `isHttpHydrated()` (true SOLO al recibir una
RESPUESTA HTTP del GET, jamás en el `.catch` de red). `liverpoolObjEarnings`
y su poll de rearme gatean con `isHttpHydrated()` en vez de `isHydrated()`:
un fallo de red deja el recálculo EN COLA hasta que el server responda (el
re-pull por focus/intervalo reintenta), nunca deflaciona sobre un progreso
sin reconciliar. Espejo de la regla HUD 6 («PROHIBIDO marcar hidratado en un
fallo de red» para los recálculos de running-total).

**Reglas a respetar**:
16. **PROHIBIDO** gatear un recálculo de running-total (que DEFLACIONA un
    valor leyendo el DOM/estado adoptado) con `_objStateSync.isHydrated()`:
    ésta es `true` en fallo de red. Usar `isHttpHydrated()` (solo respuesta
    HTTP). `isHydrated()` sigue siendo correcto para gatear el PUSH (re-subir
    la copia local al reconectar).
17. **PROHIBIDO** marcar `httpOk` en el `.catch` de `_kvBlobSync.hydrate`.
    Solo en la rama de respuesta HTTP recibida.

### Un objetivo NO se concede si su competición no ha empezado / no ha acabado (obligatorio, 2026-06-29)

**Bug (3 fotos usuario, «Liverpool 2/68 falsos»)**: la pantalla
**Objetivos del Club** marcaba como cumplidos «1 jugador entre los {9} máx
goleadores Liga» y «1 jugador marca en {3} partidos en UCL» (✅ verde) en
plena PRETEMPORADA (calendario 03 Jun, todo a 0). «La liga ni ha acabado y
Champions ni ha empezado.» Eran objetivos MANUALES (sin `data-auto`) que un
estado guardado / sync stale dejó marcados, y la auto-evaluación
(`_munichAutoEval`) nunca los corregía porque solo tocaba los `data-auto`.

**Fix** (`misc_body_1.html`, IIFE de objetivos del club):
- **«máx goleadores Liga» y «máx MVP Liga» son AUTO `data-auto`**
  (`liga-top-scorer` / `liga-top-mvp`), métricas de CLASIFICACIÓN **FINAL**:
  solo se conceden cuando la Liga ha TERMINADO (`ligaComplete`, 38 J) y un
  jugador del hub está en el Top N del ranking LIGA-WIDE
  (`_ligaWideRank` sobre `ef_player_stats_liga_only_v1`). Se quitó el
  marcador «(Si/No)» del texto por defecto para que `useAuto` los active.
- **GUARD «temporada NO empezada»**: `_munichAutoEval` calcula
  `_hubSeasonStarted()` (¿el hub jugó ≥1 partido competitivo? señales:
  clasificación Liga EA, Superliga, los 11 stores `ef_player_stats_*`, y la
  liga externa del hub no-legacy). Mientras NO haya arranque, DESMARCA todo
  ✅ falso (incluidos los manuales). SOLO desmarca, nunca marca, y SOLO sin
  arranque → en temporada en curso no toca nada (no pierde progreso real).
  Hub-aware → vale para las 6 cajas humanas.

**Reglas a respetar**:
18. **PROHIBIDO** conceder un objetivo de CLASIFICACIÓN FINAL (máx
    goleadores/MVP/posición/dif. goles de Liga) antes de que la competición
    termine (`ligaComplete`). Van en `LIGA_FINAL`; a mitad de temporada se
    mantienen SIN marcar aunque ahora mismo se cumplan.
19. **PROHIBIDO** que un objetivo de cualquier competición quede ✅ cuando el
    hub no ha empezado la temporada (`_hubSeasonStarted()` falso). El guard
    solo DESMARCA y solo sin arranque; nunca marca ni toca una temporada en
    curso (no clobberea progreso real ni el server — save no-authoritative).
20. **PROHIBIDO** que el guard haga un push AUTORITATIVO (bypassando el
    empty-guard cliente/server): una falsa «no empezada» transitoria
    (stores aún sin reconstruir al cargar) podría borrar progreso real. El
    display se corrige en cada `_munichAutoEval`; la persistencia sigue las
    reglas 14-17.

## La caja de CLUB nunca muestra bajas de SELECCIÓN ni de equipos ajenos al partido (obligatorio, 2026-06-28)

**Bug (foto usuario 2026-06-28, «Atlético Madrid · ISRA», torneo de
verano Joan Gamper)**: en la pantalla **«BAJAS PARA EL PARTIDO»** de un
partido de CLUB, la sección 🚑 LESIONADOS mostraba a **«Johan Manzambi ·
Suiza»** (un jugador de la SELECCIÓN de Suiza — ni Atlético Madrid ni la
selección humana del mister, Noruega). Regla del usuario: cada caja
muestra SOLO su equipo humano y su selección humana; **no pueden salir
otros lesionados, sancionados ni amonestados**.

### Causa raíz (doble)

1. **Contaminación del store de CLUB**: un partido del Mundial 2032 entre
   selecciones IA (Suiza vs X) registraba la lesión en `LESION_STORE`
   (store de CLUB). El override de `_registrarLesionesDesdeEventos` solo
   desvía a `LESION_STORE_SEL` las selecciones **humanas**
   (`esSelHumana`); las IA caían al motor de club (`_origReg`) →
   `LESION_STORE['Johan Manzambi'] = {equipo:'Suiza', …}`. Igual para
   sanciones (`calcularSancionesPartido` → `_origCalc` con teamName de
   selección IA).
2. **Filtro de display débil**: `_ppPlayerBelongsToMatch` (el filtro de
   la previa/overlay de CLUB) hacía `if (!teams) return true` («mostrar
   TODO») y su match por substring sufría el bug `nt.indexOf('')===0`
   (un equipo del partido VACÍO casaba con CUALQUIER jugador).

### Fix (`static/js/index.bundle.js`)

- **`window._isSeleccionName(name)`** — detector de selección nacional
  (humana o IA): `_esSelHumana` ∪ nombre EXACTO normalizado en
  `selecciones_squad_v1` (`_selSquadLoad`). Si la lista no hidrató,
  devuelve `false` (jamás borra/oculta un club por error).
- **`_ppPlayerBelongsToMatch` ESTRICTO**: (a) si el equipo del jugador es
  una selección → `false` (la caja de CLUB nunca muestra selecciones);
  (b) objetivo = los 2 equipos del partido, o el club del HUB si no hay
  contexto (NUNCA «mostrar todo»); (c) substring tolerante exigiendo
  AMBOS lados ≥ 3 chars (mata el bug de la cadena vacía).
- **Prevención en origen**: `_registrarLesionesDesdeEventos` (motor de
  club) DESCARTA eventos cuyo equipo sea selección; `calcularSancionesPartido`
  (motor de club) devuelve `[]` si `teamName` es selección.
- **Purga de contaminación existente**: `window._purgeSeleccionFromClubStores`
  elimina de `LESION_STORE`/`BAJA_STORE`/`SANCION_STORE.__global` toda
  entrada cuyo equipo sea selección (idempotente, persiste si cambia).
  Corre al hidratar (lesiones+sanciones del server), al abrir el overlay
  (`_refreshSancionInjList`) y diferida al arranque.

### Reglas a respetar

1. **PROHIBIDO** que `_ppPlayerBelongsToMatch` (o cualquier filtro de la
   caja de CLUB) vuelva a `return true` cuando no hay equipos del partido,
   ni a hacer substring sin exigir longitud mínima en ambos lados (el bug
   `indexOf('')` reintroduce el leak).
2. **PROHIBIDO** que un partido de SELECCIÓN (humana o IA) registre baja
   o sanción en el store de CLUB. Las humanas van al motor `_sel*`; las IA
   se DESCARTAN. Todo motor/ruta nueva de club hereda el gate
   `_isSeleccionName(teamName)`.
3. **PROHIBIDO** que la caja de un mister muestre bajas de OTRA caja
   humana o de una selección. El filtro resuelve el equipo del jugador y
   lo compara con los equipos del partido / club del hub.
4. Generaliza a las 6 cajas humanas (no hardcodea Atlético/Noruega): el
   detector y el filtro son genéricos por equipo/selección.

## El decremento de lesiones de CLUB es alias-tolerante (obligatorio, 2026-06-05)

**Bug (fotos usuario 2026-06-05, «Harvey Davies 4 · Kaide Gordon 6»)**:
dos lesionados del hub (Liverpool) salían en el 💉 MENÚ DE TRATAMIENTO
RÁPIDO con un nº FIJO de partidos restantes (4 y 6) que **nunca bajaba**
por más partidos que jugara el usuario. «Pasan los partidos y no se van
restando automáticamente.»

### Causa raíz

`decrementarPorPartido(teamName, compKey)` (`static/js/index.bundle.js`,
`LESION_STORE_UTILS`) — el único punto que resta 1 partido a las
lesiones de club cuando el equipo juega (lo llaman gm-modal `gmEndMatch`,
ml-card `_mlFinishMatchGen`, `simularJornadaIA`, copa-engine) — comparaba
el equipo de la baja con el del partido en **ESTRICTO**
(`if (eq !== target) return;`). El slot del hub se renombró
**Bayern→Liverpool** y los distintos resolutores del nombre del hub
NO coinciden entre sí (`_mkHubTeamName` / `_psHumanLogicName()` pueden
dar el lógico `"Bayern Munich"`, `_findBayernRow().name` da el display
`"Liverpool"`, y el partido puede llegar con cualquiera de los dos).
Así, una baja guardada como `"Liverpool"` no casaba con un partido que
llegaba como `"Bayern Munich"` (o al revés) y **jamás se decrementaba**.
La capa de DISPLAY ya era tolerante (`_hubTeamMatches`, bug 2026-06-05,
mismo Harvey Davies); la de DECREMENTO no.

### Fix

`decrementarPorPartido` resuelve la equivalencia por **MISTER del
registro canónico** (`window._mhSameMister`, alias-safe Bayern↔Liverpool),
**gateado a CLUBES humanos** (`window._isHumanClubCanonico` en AMBOS
lados) para no cruzar club↔selección del mismo mister. Una baja con
`equipo` vacío (que la UI asume del hub) la resta SOLO el partido del
propio hub (`_psHumanLogicName()`/`_mkHubTeamName`), nunca un partido de
otra caja humana ni de un IA. El match exacto previo se conserva.

### Reglas a respetar

1. **PROHIBIDO** volver al match ESTRICTO `eq !== target` en
   `decrementarPorPartido`. El equipo del partido y el `equipo` de la
   baja deben compararse con la MISMA tolerancia que el display
   (alias por mister + `equipo` vacío = hub).
2. **PROHIBIDO** ensanchar el match con substring crudo o `_mhSameMister`
   SIN el gate `_isHumanClubCanonico` en ambos lados: cruzaría las bajas
   de club con las de la selección del mismo mister (Liverpool↔Francia)
   o entre cajas con grafías parecidas.
3. Generaliza a las 6 cajas humanas (cada una resuelve su propio mister);
   no hardcodear Liverpool/Bayern en el decremento.

## Lesiones / sanciones (club + selección) se SINCRONIZAN al servidor — sobreviven al borrado de datos del navegador (obligatorio, 2026-06-04)

**Bug (fotos usuario 2026-06-04, «Kounde·Francia»)**: el usuario añade
a mano (editor azul 🖍 de la plantilla del hub, vista SELECCIÓN, PIN
7477) a **Jules Koundé (Francia) lesionado 1 partido**. El mensaje de
lesión aparece en la bandeja y la fila se marca. Pero al **borrar los
datos de navegación** TODO lo editado a mano de Kounde desaparece.

### Causa raíz

Los stores de baja/sanción vivían **SOLO en localStorage**, sin sync al
servidor:

- `ftbol_sel_sanciones_v1` — selecciones (`YELLOW_STORE_SEL` +
  `SANCION_STORE_SEL` + `LESION_STORE_SEL`).
- `ftbol_lesiones_v1` — club (`BAJA_STORE` + `LESION_STORE`).
- `ftbol_sanciones_v1` — club (`SANCION_STORE.__global`).

Al limpiar el navegador se vaciaba localStorage y, **sin copia en el
server**, no había de dónde recuperar. Mismo síntoma «se borra al
limpiar / cambiar de móvil» que ya resuelto para `selecciones_squad_v1`,
`menu_home_v1`, `munich-obj-overrides-v1`, etc.

### Fix — `_kvBlobSync` (localStorage = caché · server = fuente de verdad)

Helper genérico `window._kvBlobSync(key)` en `static/js/index.bundle.js`
(definido junto al store de lesiones de club). Cada uno de los 3 stores
lo usa con su `snapshot`/`adopt`/`isEmpty`:

- **`touch(updatedAt)`**: tras cada cambio real (lo llama el `_persist`
  del store), agenda un **POST debounced + 3 reintentos**. NO sube nada
  antes de hidratar (anti-wipe: un autosave temprano no debe pisar el
  server con un local recién vaciado).
- **`hydrate()`**: al arrancar, GET del server. Si el **local está
  vacío** (borrado de navegación) **o el server es más reciente**
  (`updatedAt`), **ADOPTA** el server y re-renderiza (plantilla del hub,
  lista de bajas, HUD). Si el **local es autoritativo** (no vacío y
  `updatedAt` >= server), lo **re-sube**. Recalcula el estado local
  DENTRO del `.then` (una edición hecha mientras volaba el GET no se
  pisa con el server viejo).
- **`seed(ts)`**: siembra el `updatedAt` cargado de localStorage ANTES
  de `hydrate` para que la comparación de recencia tras un reload normal
  sea correcta.

Cada blob persiste un `updatedAt` (ms). **Servidor** (`app.py`,
`api_kv_set`): las 3 claves están en `_KV_ALLOWED_EXACT` y en
`_KV_RECENCY_BLOB_KEYS` → **merge por RECENCIA**: el blob con
`updatedAt` mayor **gana ENTERO**. Un POST stale (otro móvil, request
perdido) nunca pisa una copia más nueva, y un **consumo legítimo**
(sanción decrementada, lesión cumplida) NO se resucita porque el blob
que lo decrementó tiene `updatedAt` mayor.

### El humano VE la baja al pulsar el jugador (vista selección incluida)

Segundo punto de la foto 2: al pulsar Kounde el humano debe ver **en
pantalla** que tiene 1 partido de lesión + el tipo. En `misc_body_1.html`
(IIFE de `#s-bayern-plantilla`):

- `_bedBajaDetail(name)` → `{state, n, reason}` leído de los stores
  REALES (cubre club **Y** selección; antes `_badges` solo leía
  `LESION_STORE` de club).
- `_bedBajaBadge(name)` pinta el badge `🩹/🟥/🟨 NP` en la fila (club +
  selección, uniforme). Se quitó el badge de lesión club-only de
  `_badges` para no duplicar.
- El panel `_bedOpenBaja` muestra «Baja actual: <tipo> · N partido(s) —
  <motivo>» y pre-rellena el contador con los partidos restantes.

### Reglas a respetar

1. **PROHIBIDO** que un store de baja/sanción (club o selección) viva
   SOLO en localStorage. Todo store nuevo de este tipo debe usar
   `_kvBlobSync` + estar en `_KV_ALLOWED_EXACT`/`_KV_RECENCY_BLOB_KEYS`.
2. **PROHIBIDO** sustituir el merge por recencia del server por una
   unión por-entrada: las sanciones/lesiones se CONSUMEN (se borran al
   cumplirse), y una unión las resucitaría. El blob `updatedAt` mayor
   gana entero.
3. **PROHIBIDO** subir al server antes de hidratar (`touch` lo gatea con
   `st.hydrated`). Sin ese gate, un autosave temprano tras un wipe
   pisaría el server con el local vacío.
4. **PROHIBIDO** que la baja deje de VERSE en la plantilla del hub. El
   badge sale de `_bedBajaDetail`/`_bedBajaBadge` (club + selección), no
   de `_badges` (que solo conoce el club).
5. Toda caja de humano nueva hereda esto automáticamente (los stores son
   genéricos por equipo/selección; el badge y la sync no hardcodean
   Liverpool/Francia).

## Un RE-SORTEO de torneo NO machaca un cuadro con partidos jugados — anti-clobber + recuperación (obligatorio, 2026-06-25)

**Bug (fotos usuario 2026-06-25, «Mundial 2032 Selecciones»)**: con el
**80% de la fase de grupos** jugada en 6 móviles + PC (Francia 3-1
Senegal, Inglaterra 0-2 Panamá, Iraq 0-4 Noruega…), de repente **se
borró TODO y aparecieron grupos DISTINTOS** (Grupo A pasó a
Camboya/EE.UU./India/Nepal, todo 0/6). «Estaba todo guardado, qué ha
pasado.»

### Causa raíz

El Mundial 2032 es un torneo `format='mundial-48'`: los 12 grupos de 4
salen de `cfg.teams` **EN ORDEN** (`teams.slice(g*4, g*4+4)`), y los
resultados se indexan por matchKey `g<g>_<jor>_<mi>`. Si el ORDEN de
`cfg.teams` cambia, cambian los grupos Y los matchKeys dejan de
corresponder. Un re-sorteo (manual roster editor `sr-ok`, `_drawTeams`,
o el split del Mundialito) genera un `cfg.teams` nuevo con `results={}`.

El clobber lo amplificaba la fusión: en `tour_cfg_merge`
(`sync_merge.py`), cuando las firmas de equipos diferían
(`new_sig != old_sig`) se devolvía SIEMPRE **la copia con `updatedAt`
más reciente**. Un cuadro vacío recién re-sorteado en UN dispositivo
(updatedAt fresco, sin `resetAt`) **GANABA** y machacaba el 80% jugado
en los otros 6. Y en el cliente, `_tourLoad` adoptaba ese cfg vacío del
server (su `updatedAt` era mayor) y **sobrescribía su propio
localStorage**, así que ni el dispositivo que conservaba el torneo lo
salvaba → pérdida total, irreversible.

### Fix — el progreso jugado es lo que manda; el descarte exige `resetAt`

- **Servidor** (`tour_cfg_merge`, rama `new_sig != old_sig`): ya NO gana
  el `updatedAt`. Decide así: (1) si un lado trae `resetAt` **mayor**
  (re-sorteo DELIBERADO sellado), gana ese; (2) si no, gana la copia con
  **más partidos jugados** (`_count_played`); (3) empate de progreso →
  `updatedAt`. Un cuadro vacío sin `resetAt` NUNCA borra una fase de
  grupos jugada.
- **Cliente** (`_tourLoad`, `misc_body_1.html`): tras el GET, si el
  server trae OTRO sorteo (`_tourTeamsSig` distinta) con MENOS jugados y
  sin `resetAt` mayor, **NO lo adopta**: conserva el local y lo
  **RE-SUBE** (`_tourSave`) para CURAR el servidor. Basta con que UN
  dispositivo conserve el torneo para restaurarlo en todos
  (recuperación automática).
- **Cliente** (los 3 re-sorteos destructivos: `sr-ok`, `_drawTeams`,
  split Mundialito): `_tourConfirmAndStampRedraw` pide CONFIRMACIÓN si ya
  hay partidos jugados y SELLA `cfg.resetAt = Date.now()` para que un
  re-sorteo INTENCIONADO sí gane la fusión.
- Tests en `tests/test_sync_merge.py` (re-sorteo accidental vacío NO
  borra · re-sorteo deliberato con `resetAt` sí · recuperación
  cross-device).

### Reglas a respetar

1. **PROHIBIDO** que `tour_cfg_merge` vuelva a arbitrar el caso
   `new_sig != old_sig` SOLO por `updatedAt`. El progreso (`_count_played`)
   gana salvo `resetAt` deliberado más reciente. Sin esto, un re-sorteo
   accidental/stale machaca el torneo de todos.
2. **PROHIBIDO** que `_tourLoad` adopte un cfg del server con OTRO sorteo
   y menos jugados sin `resetAt` mayor: debe conservar el local y
   re-subirlo (la recuperación depende de esto).
3. **PROHIBIDO** que un re-sorteo destructivo (borra `results`) corra sin
   `_tourConfirmAndStampRedraw` (confirma + sella `resetAt`). Todo flujo
   NUEVO que regenere `cfg.teams` + vacíe `results` hereda este guard.

### Los torneos tienen SNAPSHOT `_protected` igual que las ligas (obligatorio, 2026-06-25)

**Petición usuario 2026-06-25 («quiero que todo se guarde igual que
liga»)**: las ligas (`ligaExt_<slug>`) tienen un snapshot server-side
`liga_ext_<slug>_protected` MONOTÓNICO (nunca acepta menos jugadores) que
sobrevive aunque todos los dispositivos pierdan su copia. Los torneos NO lo
tenían → un cuadro machacado en el server era irrecuperable.

**Fix** (`app.py`, `_tour_protected_guard`): cada save de `tour_<id>_v1`
mantiene un high-water mark `tour_<id>_v1_protected` MONOTÓNICO por **nº de
partidos JUGADOS** (`_count_played`). Un guardado que REGRESA (menos jugados)
SIN un `resetAt` más reciente se **RESTAURA** automáticamente desde el
snapshot — el torneo NO se pierde aunque el main quede vacío. Un reinicio
DELIBERADO (`resetAt` mayor) reemplaza el snapshot (nueva baseline). Corre en
el chokepoint del merge KV (tras `tour_cfg_merge`), incluido el primer save
(siembra el snapshot). Diagnóstico: `GET /api/tour-protected/<id>`.

**Reglas a respetar**:
4. **PROHIBIDO** que un save de `tour_<id>_v1` salte `_tour_protected_guard`:
   es la red de último recurso (espejo del `_protected` de las ligas). El
   snapshot solo baja con un `resetAt` deliberato, nunca por una regresión.
5. **PROHIBIDO** permitir POST externo a `tour_<id>_v1_protected` (el regex
   `_KV_ALLOWED_REGEX` exige `_v1$`, así que ya queda fuera): el snapshot lo
   escribe SOLO el servidor, o un cliente malicioso/viejo podría rebajarlo.

## El `resetAt` de torneo NO debe descartar partidos jugados DESPUÉS del reinicio (obligatorio, 2026-06-05)

**Bug (fotos usuario 2026-06-05, «Ronda Previa 1»)**: el usuario tenía
la clasificación de la Ronda Previa 1 (slot `spv1`) con 6/10 jornadas
jugadas (Noruega 6, Vietnam 6, Francia 3…). Al volver a entrar estaba
**TODO a cero (0/10)**. La clasificación se borró sola.

### Causa raíz

El servidor fusiona cada `tour_<id>_v1` con `tour_cfg_merge`
(`sync_merge.py`). El sello `resetAt` (que «Reiniciar Temporada» / el
botón ↺ Reset siembran) hacía que **solo se conservaran los resultados
de la copia que PORTASE ese mismo `resetAt`** (`side_reset >=
eff_reset`). Pero el guardado normal de partidas (`_tourSave` →
`_tourSaveHumanResult` / sim IA) **NO porta `resetAt`**. Así, si en el
pasado hubo CUALQUIER reinicio (sello en el servidor), TODOS los
partidos jugados después se **descartaban silenciosamente** en la
fusión del servidor → al rehidratar desde el servidor (otro móvil /
datos borrados / otra sesión) la clasificación volvía a 0.

### Fix — una copia aporta resultados si porta el sello O es POSTERIOR al reset

`tour_cfg_merge` ahora incluye los resultados de una copia cuando:
- **(a)** porta el `resetAt` máximo (`side_reset >= eff_reset`; si no
  hubo reset, `eff_reset=0` ⇒ ambas lo «portan» ⇒ unión pura), **o**
- **(b)** NO porta el sello pero su `updatedAt` (convertido a ms,
  `_iso_ms`) es **posterior** al `updatedAt` de la copia que reinició
  (`reset_copy_ms`) ⇒ son partidos jugados TRAS el reset y NO se pueden
  perder.

Una copia stale **anterior/igual** al reinicio sin sello sigue sin
resucitar (sigue cubierto por los tests). Defensa en el cliente:
`_tourSave` **conserva el `resetAt` máximo** entre la cfg entrante y el
persistido en localStorage (nunca lo baja), para que toda partida
jugada tras un reinicio viaje con el sello correcto.

### Reglas a respetar

1. **PROHIBIDO** volver a la regla «solo cuentan los resultados de la
   copia que porta el sello `resetAt`». El guardado de partidas no
   porta el sello → eso descarta partidos legítimos post-reset. La
   condición es «porta el sello **O** `updatedAt` posterior al reset».
2. **PROHIBIDO** que `_tourSave` baje/pierda el `resetAt` ya conocido
   por el dispositivo. Toma el MÁXIMO (un reset recién pulsado, con
   sello mayor en la cfg entrante, sí gana).
3. Mantener los tests de `tests/test_sync_merge.py` (incluido el caso
   «partidos jugados TRAS un reset previo NO se pierden» y «copia stale
   anterior al reset sigue sin resucitar»).

## Auto-log de Derbys — HvH club + SELECCIÓN, nunca se pierden (obligatorio, 2026-06-13)

**Bug (fotos usuario 2026-06-13, «Histórico Derbys»)**: el HUB (caja
`s-munich-derbys`) mostraba PJ=3 (agregado de TODAS las temporadas) pero
al abrir la temporada actual (32-33 Liverpool 🇫🇷) los derbys de
Liverpool/Francia jugados NO aparecían. «No se están guardando los
partidos.»

### Causa raíz (auto-log)

`_munichDerbyAutoLog` (`misc_body_1.html`) tenía 3 bloqueos:
1. **Gate HvH solo con `esHumano`**: `esHumano` lee el flag `isHuman`
   de Liga EA (5 clubes legacy) → devuelve `false` para SELECCIONES
   (Francia) y puede no ver el alias Liverpool. Un derby Francia-vs-Brasil
   (o Liverpool-vs-Arsenal) nunca pasaba el gate.
2. **Match de temporada solo por nombre de CLUB** (`local !== t`): un
   derby de SELECCIÓN (Francia) no coincidía con la temporada cuyo
   `teamName` es «Liverpool».
3. **Solo lo llamaba el gm-modal**: el flujo de las cards del calendario
   (`_mlFinishMatchGen`) no auto-logueaba.

### Fix

- **Gate HvH ampliado** (`_derbyIsHuman`): humano si `esHumano` **o**
  `_isHumanClubCanonico` (alias Bayern↔Liverpool) **o** `_esSelHumana` /
  `_isHumanSeleccionCanonica`. Liverpool-vs-IA / Francia-vs-IA NO se
  registra.
- **Match de temporada por club O su selección**: el mismo mister dirige
  club Y selección (`_mhFindMister(teamName).seleccion`), así que un
  derby de Francia se registra en la temporada «Liverpool». Comparación
  TOLERANTE (`_mDerbyTeamMatch`).
- **comp 'seleccion' automático** cuando ambos lados son selecciones
  humanas (el caller pasa 'liga'/'torneo').
- **`_mlFinishMatchGen` llama también** a `_munichDerbyAutoLog`
  (best-effort comp desde `st`); el helper filtra HvH + involucra-
  temporada + dedup, así que es no-op para no-derbys.
- **Pull ADITIVO** (`_serverPullAll` → `_mergeMatchMaps`): unión por id
  de partido por temporada (server gana en conflicto de id, local-only
  se conserva) + re-push si la unión es mayor. Antes el pull SOBRESCRIBÍA
  ciegamente localStorage con el server → un partido recién auto-logueado
  (POST en vuelo) se perdía con un GET stale.

### Causa raíz (HUB 3 vs detalle 1 — «el resto no sale», 2ª foto)

Dos fuentes DISTINTAS pintaban el contador del HUB y discrepaban:
- El **polling de 1 s** (`refresh` del IIFE `__MUNICH_DERBYS_HUB_READY`)
  contaba SIN el filtro `_matchIsHvH` → contaba TODOS (3).
- El **detalle de cada temporada** (`_renderSeason`/`_summaryForSeason`) y
  el override del HUB usan `_matchIsHvH`, que mandaba al gate `esHumano`
  los partidos LEGACY (sin `isHvH:true`). Los derbys históricos de Toñín
  con OTROS clubes/selecciones (Ath Bilbao, etc., añadidos a mano ANTES
  del sello `isHvH:true` de 2026-06-11) NO son `esHumano` canónicos →
  se OCULTABAN (1 visible) aunque el HUB los contara (3).

**Fix**: (a) `_matchIsHvH` en LECTURA solo excluye `isHvH===false`; todo
lo demás (incluido legacy sin flag) es VISIBLE — el gate REAL es al
ESCRIBIR (manual + auto-log sellan `isHvH:true`). (b) el `refresh` del
polling DELEGA en `munichDerbyAggregateAll` (fuente única) → HUB y
detalle SIEMPRE cuadran.

### Reglas a respetar

1. **PROHIBIDO** volver a gatear el auto-log SOLO con `esHumano`: no ve
   selecciones ni el alias Liverpool. Usar `_derbyIsHuman` (3 fuentes).
2. **PROHIBIDO** matchear la temporada solo por nombre de club: un derby
   de selección del mismo mister debe registrarse en la temporada del
   club (`_mhFindMister(...).seleccion`).
3. **PROHIBIDO** que `_serverPullAll` vuelva al overwrite ciego de
   `bayern_derbys_matches_v1`. La hidratación es unión aditiva por id.
4. El HUB `s-munich-derbys` AGREGA todas las temporadas (PJ/G/E/P del
   histórico); cada temporada muestra solo los suyos — no es un bug.
5. **PROHIBIDO** que el contador del HUB y el detalle usen agregadores
   distintos: el polling de 1 s DEBE delegar en `munichDerbyAggregateAll`
   (fuente única) o volverá a discrepar.
6. **PROHIBIDO** que `_matchIsHvH` (LECTURA) vuelva a filtrar por
   `esHumano`: ocultaba los derbys históricos legacy de clubes/
   selecciones no-canónicos. El filtro HvH va al ESCRIBIR (sello
   `isHvH:true`); en lectura solo se excluye `isHvH===false`.

## La pantalla "🔥 DERBYS" (`s-derbys`) reconoce a LOS 7 clubes + LAS 7 selecciones en CUALQUIER competición (obligatorio, 2026-07-03)

**Bug (2 fotos usuario, «Inter-Portugal-Rubén»)**: en la pantalla
`s-derbys` (la caja "🔥 DERBYS" del home, distinta de "Histórico Derbys"
`s-munich-derbys`), la sección **LIGA EA SPORTS** mostraba los derbys de
los 5 humanos clásicos, pero **ningún partido del Inter (Rubén, 7º
mister) contra otro humano** aparecía en ninguna competición europea
(Champions/Europa/Conference "fase de liga", Copa del Rey, Supercopa de
España, Nations League). Petición usuario: además, **las selecciones
humanas** (Francia/Brasil/Inglaterra/Noruega/Argentina/España/Portugal)
**deben salir siempre que se enfrenten**, tanto en la fase de Ligas
(Selecciones J1-J10) como en Eliminatorias (Mundial fase final). Y los
**Torneos de Verano** (Trofeo Joan Gamper) con enfrentamientos humanos
son obligatorios también.

### Causa raíz (2 bugs independientes en `_scanAllDerbies`, `part2/misc_body_2.html`)

1. **`_normalizeHumanName`** (fuentes 1 y 3 del scanner: `.match-live-wrap`
   y `.mrow` dentro de contenedores `cal-*` — Copa, Supercopa España,
   Champions, Europa, Conference, Nations League, y CUALQUIER `cal-sel*`
   de Selecciones) solo reconocía los **5 humanos legacy de Liga EA
   Sports** (`DERBYS_HUMANOS`, poblado desde `ligaExt_liga-ea-sports`).
   Inter (Rubén) y PSG (Izan) viven en ligas externas (`ligaExt_<slug>`
   de Resto de Ligas), NO en `ligaExt_liga-ea-sports` → nunca se
   reconocían como humanos ahí, así que sus partidos de Champions/Europa/
   Conference/Copa/Supercopa/Nations League contra otro humano quedaban
   invisibles. Ninguna selección (Francia, Portugal, …) estaba en esa
   lista tampoco → los derbys de Selecciones J1-J10 y Mundial fase final
   quedaban igual de invisibles ahí. La fuente 6 (scan de `tour_<id>_v1`,
   añadida 2026-06-13) sí usaba el registro canónico completo
   (`_isHumanForDerby`), así que Mundialito/Selecciones/Verano YA
   funcionaban — el hueco estaba en las fuentes 1 y 3.
2. **`cfg.fixture` de un torneo `format:'league'`** (Trofeo Joan Gamper,
   liga de 63 equipos) se construye LAZY al renderizar la pantalla del
   torneo (regla 2026-06-27, "El índice key→{home,away}…"). El bloque
   "asegurar fixtures" de la fuente 6 solo reconstruía `cfg.groupFixtures`
   (`_tourEnsureGroupFixtures`/`_tourEnsureRoadFixtures`/
   `_mundialGroupState`) — NINGUNO de los 3 hace nada para
   `format==='league'` (`_tourEnsureGroupFixtures` retorna `false` de
   inmediato si el format no es `groups-ko`/`league-ko`/`swiss`). Si el
   usuario abría la caja Derbys SIN haber abierto antes la pantalla del
   Joan Gamper esa sesión, `cfg.fixture` seguía vacío y NINGÚN partido
   (humano o no) del torneo se detectaba como derby.

### Fix

- `_normalizeHumanName` ahora cae, tras el match exacto contra los 5
  legacy, al **registro canónico completo**: `window._isHumanClubCanonico`
  (7 clubes, alias-safe Bayern↔Liverpool/PSG/Inter) →
  `window._esSelHumana` / `window._isHumanSeleccionCanonica` (7
  selecciones, incluye Portugal). Mismas funciones que ya usaba la
  fuente 6 (`_isHumanForDerby`) — una sola fuente de verdad para "¿es
  humano?" en las 6 fuentes del scanner.
- Nuevo `window._tourEnsureLeagueFixture` (expone la función ya existente
  `_tourEnsureLeagueFixture` de `misc_body_1.html`, usada por
  `_tourBackfillActasFromResults`). El bloque "asegurar fixtures" de la
  fuente 6 ahora, para `cfg.format === 'league'`, llama a
  `window._tourEnsureLeagueFixture(cfg, teams)` si `cfg.fixture` está
  vacío — el mismo round-robin determinista que usa el render de la
  pantalla, así los derbys de Joan Gamper (y cualquier torneo de verano
  `format:'league'`) se detectan en un cold-open de la caja Derbys.

### Reglas a respetar

1. **PROHIBIDO** que `_normalizeHumanName` (o cualquier normalizador de
   nombre humano nuevo en el scanner de Derbys) reconozca SOLO los 5
   humanos de `ligaExt_liga-ea-sports`. Debe caer siempre al registro
   canónico completo (`_isHumanClubCanonico`/`_esSelHumana`/
   `_isHumanSeleccionCanonica`) para que un mister/selección NUEVO se
   reconozca automáticamente sin tocar este archivo.
2. **PROHIBIDO** que el bloque "asegurar fixtures" de la fuente 6 llame
   solo a builders de GRUPO (`_tourEnsureGroupFixtures`/
   `_tourEnsureRoadFixtures`/`_mundialGroupState`) sin cubrir
   `format==='league'` vía `_tourEnsureLeagueFixture`. Sin él, todo
   torneo de verano en formato liga (Joan Gamper y futuros) queda
   invisible en un cold-open de la caja Derbys.
3. Toda caja de mister/selección humana NUEVA hereda el reconocimiento
   automáticamente (el registro `MISTERS_HUMANOS` es la fuente única);
   no hardcodear nombres nuevos en `DERBYS_HUMANOS` ni en el scanner.

## «Reiniciar Temporada» NUNCA borra Derbys / Trofeos / Plantillas (obligatorio, 2026-06-04)

**Regla usuario 2026-06-04 (3 fotos)**: el botón **«Reiniciar
Temporada»** (`window._bayernEditValuesResetCal` en `misc_body_1.html`,
modal admin PIN 747) **JAMÁS** debe reiniciar/borrar:

1. **Histórico de Derbys** — `bayern_derbys_seasons_v1` +
   `bayern_derbys_matches_v1` (pantalla `s-bayern-derbys`).
2. **Vitrina de Trofeos** — `bayern_trofeos_v1` (pantalla
   `s-bayern-trofeos`). Es un registro PERSISTENTE aditivo gestionado
   por el admin, **NO** se recalcula desde `cfg.results`.
3. **Plantillas del CLUB y la SELECCIÓN** — el club vive dentro de
   `ligaExt_liga-ea-sports.teams[].players` (roster + medias + flags);
   la selección en `selecciones_squad_v1`. **Solo** cambian si el admin
   las edita a mano.

### Qué SÍ limpia el reset (correcto, no tocar su scope)

Cursor del día (`liverpool_preseason_v1`), objetivos del club, HUD
(💼/🪙 a 0), **resultados** de los slots de torneo (`tour_*_v1`:
`results`/`bracket`/`koBracket`/`groupFixtures`/`fixture`/cursores/
`_prizesPaid` — **conservando `teams`/`format`/`formatConfig`**),
`pend_hvh_deferred_v1` y **TODAS las bajas/sanciones/lesiones (club +
selección)** (petición usuario 2026-06-07: «cuando se reinicia una
temporada no hay ni lesionados ni expulsados ni amonestados»). NO toca
`ligaExt_*` ni las 4 claves protegidas.

**Bajas a CERO**: `ftbol_lesiones_v1` (`BAJA_STORE`+`LESION_STORE`),
`ftbol_sanciones_v1` (`SANCION_STORE.__global`), el contador club
`YELLOW_STORE.__global`, y `ftbol_sel_sanciones_v1`
(`YELLOW_STORE_SEL`+`SANCION_STORE_SEL`+`LESION_STORE_SEL`+
`_FORMA_MATCH_STATES_SEL`). Se vacían en memoria, localStorage Y
servidor: cada uno es un blob `_kvBlobSync` con merge por recencia, así
que tras vaciarlo el `_persist` sella `updatedAt` nuevo y el flush
(`_bajaFlushClubNow`/`_bajaFlushSelNow` → `pushNow`) sube el blob VACÍO
→ el server lo adopta en todos los dispositivos (sin esto la
hidratación resucitaba las bajas al recargar / cambiar de móvil). Como
`cfg.results` también se vacía, `_selReconcileSuspensions` tampoco las
regenera.

### Blindaje implementado

`_bayernEditValuesResetCal` hace **snapshot ANTES** del reset de
`_PRESERVE_KEYS` y los **restaura AL FINAL** (solo si cambiaron). Defensa
en profundidad: aunque un cambio futuro añada por error un borrado, estas
claves se devuelven a su valor previo.

**HUB MULTI-MISTER (2026-06-15)** — `_PRESERVE_KEYS` cubre los DATOS
HISTÓRICOS (Histórico Derbys + Vitrina Trofeos) de las **6 cajas de mister
humano**, NO solo la del hub ACTIVO. Se construye desde `_PRESERVE_BASES =
['bayern_derbys_seasons_v1','bayern_derbys_matches_v1','bayern_trofeos_v1']`
× `window._MISTERS_HUMANOS` (Toñín/Liverpool = clave BASE sin sufijo; el
resto → `..._<id>`: `_alvaro`/`_acsa`/`_isra`/`_angel`/`_izan`) + la
plantilla de selección común `selecciones_squad_v1`. Así «Reiniciar
Temporada» —se pulse desde la caja que se pulse— jamás borra el palmarés ni
los derbys de NINGUNA caja (son históricos, se guardan para SIEMPRE,
petición usuario 2026-06-15).

### Reglas a respetar

1. **PROHIBIDO** añadir al reset cualquier `removeItem`/vaciado de las 4
   claves protegidas o de `ligaExt_liga-ea-sports` (donde vive la
   plantilla del club). Si hay que limpiar algo nuevo de temporada, va
   en su propia clave `tour_*`/cursor, nunca en estas.
2. **PROHIBIDO** quitar el snapshot+restore de `_PRESERVE_KEYS`. Toda
   clave nueva que represente histórico/palmarés/plantilla del usuario
   debe AÑADIRSE a `_PRESERVE_KEYS`, no quedar expuesta al reset.
2b. **PROHIBIDO** reducir `_PRESERVE_KEYS` a SOLO el hub ACTIVO: los
   derbys/trofeos de las 6 cajas se preservan SIEMPRE (snapshot por-hub de
   TODOS los misters vía `_PRESERVE_BASES × _MISTERS_HUMANOS`). Toda caja de
   mister NUEVA hereda la protección automáticamente al estar en el registro.
3. La plantilla del CLUB NO se mete en `_PRESERVE_KEYS` (congelaría la
   clasificación de Liga); se protege porque el reset no toca
   `ligaExt_*`. Si algún día el reset SÍ debe limpiar resultados de Liga,
   hacerlo preservando `teams[].players` (roster) explícitamente.

## La card del hub muestra SOLO el club + selección de SU caja (obligatorio, 2026-06-04)

**Bug (foto usuario 2026-06-04, caja «Liverpool/Francia»)**: la card
«Próximo partido» del hub (`#ps-stage` en `s-munich`) mostraba en el
Trofeo Joan Gamper **`RB LEIPZIG vs REAL MADRID`** — el partido de OTRA
caja humana (Real Madrid = Acsa), no el del Liverpool.

### Causa raíz

Con **varias cajas de humano** (Liverpool, Real Madrid, Arsenal… los 6
del `MISTERS_REGISTRY`), un torneo marca a TODAS con `isHuman:true`. Dos
resolutores de la card del hub identificaban al humano con un check
PLANO de `isHuman` y cogían **al primero que tropezaban**, no al de la
caja:

1. **Club** — `_slotIsH(t)` en `_realPair` (`misc_body_1.html`):
   `if (t.isHuman) return true` matcheaba a Real Madrid antes que a
   Liverpool.
2. **Selección** — `_selPair` recolectaba a las 6 selecciones humanas
   como candidatas y devolvía la PRIMERA con partido real ese día →
   podía mostrar el partido de Brasil/España en la caja de Francia.

### Fix — filtrar por el MISTER de la caja (registro `MISTERS_HUMANOS`)

Cada caja = un mister (Toñín = Liverpool **+** Francia). La fuente para
saber «de quién es este slot» es el registro, NO el flag `isHuman`:

- **`_slotIsH(t)`**: el slot es del hub solo si su nombre = club del hub
  (`_psHumanLogicName()`, + aliases legacy Bayern→Liverpool) **o** lo
  dirige el MISMO mister (`window._mhSameMister(hubName, t.name)`).
  `t.isHuman` por sí solo YA NO basta: si es de OTRO mister → `false`.
  Fallback legacy (acepta `isHuman`) solo si el hub no es un humano
  canónico (`_mhFindMister(hubName)` null).
- **`_selPair`**: tras construir `_candidates`, **filtro ESTRICTO** a la
  selección del mismo mister que el club del hub
  (`_mhFindMister(_psHumanLogicName()).seleccion`). Si la selección del
  hub no está en ningún Mundial activo, `_candidates` queda vacío → card
  «sin partido»/JUGADORES FUERA (NUNCA la selección de otra caja).
- **`_scanForCanonicalMundialMatch`** (watchdog de `_psRender`): solo se
  dispara por la selección DEL HUB (mismo mister), no por cualquier
  humana canónica — si no, mostraría «RECUPERAR PARTIDO» en días que
  juega otra caja.
- **Healing de `d.tour`** en `_realPair`: usa `_slotIsH` (hub-específico)
  para no fijar `d.tour` a un torneo donde el hub ni juega.

### Reglas a respetar

1. **PROHIBIDO** identificar al humano de la card del hub con un check
   plano `t.isHuman` / «el primer humano que aparece». Cada caja resuelve
   SU club (`_psHumanLogicName`) y SU selección (mister del registro).
   El discriminador es el MISTER (`_mhSameMister`/`_mhFindMister`), no
   `isHuman`.
2. **PROHIBIDO** que la caja de un mister muestre el partido de otra
   caja (otro club u otra selección). El filtro de `_selPair` es
   estricto; `_slotIsH` excluye a los humanos de otros misters.
3. **Toda caja de humano nueva** hereda esto automáticamente vía el
   registro `MISTERS_HUMANOS` (club↔selección por mister). No hardcodear
   nombres concretos en estos resolutores.

## Interfaz ÚNICA estilizada para TODO torneo · color = el de su caja (obligatorio, 2026-06-03)

**Petición usuario 2026-06-03 (fotos «Road Copa África» vs «Road Copa
Asia»)**: al crear un torneo nuevo (Fase Previa, Fase Final o Torneo
amistoso/Verano) la interfaz debe ser SIEMPRE la misma «videojuego»
(cabecera con gradiente + tabla estilizada `_mundialClasTableHtml` +
jornadas desplegables con escudos grandes `_mundialMatchCardHtml`), como
la foto 2. **Lo único que cambia es el color = el de la caja del torneo**:
Rondas Previas → AZUL (`_SEL_BLUE`, `c-roadq`), Rondas Finales → ROSA
(`_SEL_PINK`, `c-road`), Verano → TURQUESA (`_SUM_TURQ`, `c-summer`).

### Causa raíz

El formato `'league'` (1 sola tabla, sin grupos) caía a `_renderLeague`,
que pintaba la versión PLANA (`_standingsTableHtml` + `_fixtureCardsHtml`
con cajas blancas `.tour-jor`) — foto 1. Los demás formatos
(`groups-ko`/`league-ko`/`swiss` vía `_renderGroupsKO`, y
`qualifier-route` vía `_renderQualifierRoute`) ya usaban la card grande.

### Fix (todo en `templates/partials/misc_body_1.html`)

- `_bigGroupCardHtml` acepta `TH.leagueMode`: el torneo se pinta como UN
  grupo titulado **CLASIFICACIÓN** y los botones SIM/AVANZAR usan claves
  de liga (botón ▶ SIM con `data-league="1"` en vez de `data-group`;
  prefijo de match-key vacío).
- `_selGroupCardHtml(...,leagueMode)` y `_veranoGroupCardHtml(...,leagueMode)`
  propagan `TH.leagueMode`.
- `_renderLeague` ya NO pinta plano: dispatcha por `_tvBoardOf(tourId)`
  (`verano` → `_veranoGroupCardHtml`, resto → `_selGroupCardHtml`) con
  `g=0, gKey='', fix=cfg.fixture, advancePerGroup=0, leagueMode=true`.
- Handler `tour-sim-grp-btn` (router de clicks): si trae `data-league`
  simula TODAS las jornadas de `cfg.fixture` (prefijo vacío) en vez de
  `groupFixtures[g]`.

### Reglas a respetar

1. **PROHIBIDO** que `_renderLeague` vuelva a pintar la versión plana
   (`_standingsTableHtml` + `_fixtureCardsHtml`). Toda liga usa la card
   grande coloreada por board.
2. **PROHIBIDO** hardcodear el color de la card: sale del board
   (`_tvBoardOf`) = el de la caja. Toda comp/board nuevo debe tener su
   tema en el dispatch de `_renderLeague` igual que en `_renderGroupsKO`.
3. El click de partido (`data-league-key`) y el ▶ SIMULAR JORNADA
   (`tour-sim-jor-btn`, `data-key-prefix=''`) YA soportan claves de liga
   sin prefijo de grupo — no romper ese parseo.

## Sedes por torneo en la PREVIA + self-heal anti-pantalla-negra (obligatorio, 2026-06-03)

**Bug 1 (foto usuario «Road Copa Asia/América»)**: un torneo de
Selecciones (Rondas Previas) tenía **4 sedes elegidas** en el editor
(`cfg.stadiums` = Estadio Banorte, El Volcán, Olímpico Universitario,
MorumbIS) pero la **PANTALLA DE PREVIA** mostraba «🏟️ eFootball
Stadium» — un estadio que NO estaba entre los 4.

### Causa raíz (sedes)

`_renderPreviaMeta` (en `static/js/index.bundle.js`) SÍ resolvía la
sede del torneo por hash del matchKey (rotación entre `cfg.stadiums`),
pero **`_mmInjectEnv`** —que **repinta `#pp-env` 60 ms después** con el
clima/fecha del calendario— **REconstruía el estadio sin la rama de
`cfg.stadiums`**: caía a `getTeamStadium(local)` y, como las
selecciones no tienen estadio, a `'eFootball Stadium'`. Así pisaba la
sede correcta que `_renderPreviaMeta` ya había puesto.

### Fix (sedes)

- Helper ÚNICO `window._previaTourStadium(fallbackKey)`: rota por hash
  del `tourKey`/matchKey entre `cfg.stadiums` no vacíos del torneo de
  la previa actual (`_ppPreviaTeams.tourId`). Lo usan **AMBOS**
  `_renderPreviaMeta` y `_mmInjectEnv`, con la **MISMA prioridad**:
  `sc/sc-final` → **sedes del torneo** → `sel_fin_stadiums_v1` →
  `getTeamStadium(local)` → `eFootball Stadium`.
- **PROHIBIDO** que `_mmInjectEnv` (o cualquier repintado del env)
  resuelva el estadio sin pasar por `_previaTourStadium` primero. Las
  sedes de `cfg.stadiums` GANAN sobre `sel_fin_stadiums_v1` y sobre el
  estadio del local (regla 2026-06-01).

### Fix (sedes) — el gm-modal usa la MISMA fuente (obligatorio, 2026-06-06)

**Bug (foto usuario 2026-06-06, «España vs Birmania · Road Copa
Asia»)**: la PREVIA mostraba la sede correcta del torneo (🏟️ Estadio
Banorte) pero al abrir el partido el **gm-modal** (la pantalla de la
simulación) mostraba `🏟️ eFootball Stadium` en la cabecera.

**Causa raíz**: el bloque de estadio del gm-modal
(`gmOpen`, `#gm-venue-stadium`, en `part2/misc_body_2.html`) tenía
ramas para Supercopa España (`_scStadium`) y Mundial-48
(`_selFinStadiumFor`), pero **NINGUNA rama para `cfg.stadiums`** del
torneo. Para un torneo de Selecciones (Rondas Previas/Finales) o de
Verano caía al `else` → `getTeamStadium(_gm.home)` → como las
selecciones no tienen estadio → `eFootball Stadium`.

**Fix**: `_previaTourStadium` se refactoriza para delegar en un helper
AUTÓNOMO `window._tourStadiumFor(tourId, hashKey)` (no depende de
`_ppPreviaTeams`). El gm-modal llama
`_tourStadiumFor(_gm._tourId, _gm._tourKey)` con la **MISMA prioridad**
que la previa: `_scStadium` → **sedes del torneo (cfg.stadiums)** →
`_selFinStadiumFor` → `getTeamStadium(local)` → `eFootball Stadium`.
Como `_gm._tourKey === _ppPreviaTeams.tourKey === matchKey`, el hash
coincide y la previa y el gm-modal muestran la **MISMA** sede.

- **PROHIBIDO** que el bloque de estadio del gm-modal (o cualquier
  pantalla de partido nueva) resuelva la sede sin consultar
  `_tourStadiumFor(_gm._tourId, _gm._tourKey)` ANTES de
  `_selFinStadiumFor`/`getTeamStadium`. Las sedes de `cfg.stadiums`
  GANAN (igual que en `_renderPreviaMeta`).
- **PROHIBIDO** desincronizar el hashKey: el gm-modal debe hashear con
  `_gm._tourKey` (= el `matchKey` que pasa `_tourOpenHumanMatch`), el
  mismo que usa la previa, o mostrarían sedes distintas del mismo torneo.

**Bug 2 (foto usuario, pantalla negra)**: al pulsar **cualquier
caja/card** de un torneo de Selecciones la pantalla destino aparecía en
**NEGRO** y había que pulsar «atrás» en el móvil para verla.

### Causa raíz (pantalla negra)

Un overlay modal fullscreen (PREVIA `#prepartido-overlay`, BAJAS
`#sancion-overlay`, alias `#_copaAliasOv`) quedaba con `.show` de un
flujo anterior; su fondo casi-opaco (`rgba(0,0,6,.97)`) tapaba la nueva
pantalla. El `_blackScreenSafetyNet` documentado SÓLO limpia en
page-load / `pageshow` — nunca en navegación SPA. Por eso «atrás» (que
re-renderiza / re-dispara el cleanup) era el único modo de recuperarla.

### Fix (pantalla negra)

`renderScreen` (router en `index.bundle.js`) hace **self-heal en CADA
navegación SPA real** (cambio de pantalla, no refresco in-place ni
`window._iaRefreshInPlace`): cierra los overlays modales huérfanos
(`prepartido-overlay`, `sancion-overlay`, `_copaAliasOv`) y garantiza
que SIEMPRE haya una `.screen.active`.

- **PROHIBIDO** cerrar en este self-heal los splash/intro
  (`ucl-intro`, `comp-flash`, celebración, `sc-champion-ov`) ni el
  `gm-modal` de un partido vivo: el primero lo muestra el propio `go()`
  con su temporizador; el segundo es un partido en curso. El cierre se
  limita a overlays modales que sólo se abren vía `showPrePartidoOverlay`
  / `showSancionOverlay` (nunca vía `go()`), así que cerrarlos al
  navegar a OTRA pantalla siempre es correcto.

## Registro de torneos (Rondas Previas/Finales) — FUSIÓN, NUNCA se pierden entre dispositivos (obligatorio, 2026-06-03)

**Bug (foto usuario 2026-06-03)**: en la pantalla `🌐 Selecciones`
(`s-selecciones`) habían desaparecido las cajas que el usuario tenía
en **🛉 RONDAS PREVIAS** y **🏆 RONDAS FINALES** (entre ellas «Road
Copa Asia» y «Mundial 2032») **más las cajas ocultas** — la pantalla
mostraba «Sin rondas previas/finales. Pulsa 🖍 para crear una.».

### Causa raíz

Qué cajas se ven lo dicta `tour_registry_v1.visible` (lista de slots
`spv1..spv10` = Rondas Previas, `sfn1..sfn10` = Rondas Finales,
`tx1..tx8` = Torneos de Verano custom). El **nombre** custom de cada
caja («Road Copa Asia»…) vive en su cfg `tour_<id>_v1`, NO en el
registro.

`_tvHydrateReg` (en `misc_body_1.html`) hacía un GET a
`/api/kv/tour_registry_v1` y **PISABA ciegamente** `localStorage` con
`j.value` (`localStorage.setItem(_TV_REG_KEY, JSON.stringify(j.value))`).
Si el server traía una copia **stale/más corta** (otro dispositivo, o
un GET previo al POST que añadió las cajas), el registro local se
quedaba con solo los built-in → las Rondas Previas/Finales
desaparecían. Mismo patrón anti-wipe que ya documentado para
`selecciones_squad_v1` y los escudos de `ligaExt_*`.

### Segundo bug (2026-06-03, foto usuario): lo OCULTO volvía a salir

Al **ocultar** (act `del`) una caja de Torneos de Verano o de
Selecciones, al recargar la web **volvía a aparecer**. Causa: el
anti-wipe anterior hacía que `visible` **jamás encogiera** ni en el
cliente (`_tvRegMerge` añadía el slot remoto aunque estuviera oculto
en local) ni en el server (`_tour_registry_merge` re-añadía el id desde
`old_vis` y, con `hid -= seen`, borraba el tombstone). El «visible gana
siempre» era **incompatible** con poder ocultar: cualquier copia stale
que tuviera la caja en `visible` la resucitaba. El tombstone `hidden`
sin sello no podía ganar a un `visible` stale.

### Fix — FUSIÓN POR RECENCIA (tombstones con timestamp)

El estado visible/oculto de cada slot lo decide la **ÚLTIMA acción
real** del admin, no un «visible gana siempre». Dos sellos por slot:
`hiddenAt[id]` (ocultar) y `shownAt[id]` (mostrar/crear/restaurar). El
mayor gana: `hiddenAt > shownAt` ⇒ oculto; si no ⇒ visible.

- **Cliente** (`misc_body_1.html`, IIFE del registro de torneos):
  - `_tvRegMerge(localReg, remoteVisible, remoteHidden, remoteHiddenAt,
    remoteShownAt)`: fusiona los mapas de timestamps (máx por id),
    aplica **baselines de presencia** (`visible` legacy sin sello ⇒
    `shownAt=1`; `hidden` legacy ⇒ `hiddenAt=1`; los ms reales ganan a
    estos `1`) y decide visible/oculto por recencia. Conserva el orden
    local. Si difiere del server, `_tvHydrateReg` **re-sube** (converge).
  - `_tvHydrateReg` FUSIONA (con timestamps) en vez de pisar.
    **PROHIBIDO** volver al `setItem(j.value)` ciego.
  - `_tvEffHidden(reg)`: conjunto EFECTIVO de ocultos resuelto por
    recencia (con fallback al array `hidden` para datos sin sello). Lo
    usa `_tvRegLoad` para filtrar `visible` y para gatear la
    recuperación.
  - **Recuperación anti-wipe** en `_tvRegLoad`: `_tvSlotHasContent(id)`
    detecta slots con DATOS REALES en `localStorage` (equipos,
    resultados, o nombre/bandera/color custom). Cualquier slot con
    contenido que NO esté visible y NO esté en `_tvEffHidden` se
    **restaura**. Devuelve las cajas perdidas aunque el registro se
    hubiera pisado, **sin** resucitar lo ocultado a propósito.
  - **Acciones**: `del` sella `hiddenAt[id]=Date.now()` (+ array
    `hidden`); `restore`/`new` sellan `shownAt[id]=Date.now()` (y
    quitan de `hidden`).
- **Servidor** (`app.py`, `api_kv_set` → `_tour_registry_merge`): misma
  lógica de recencia. `visible` **no encoge por una copia stale**
  (anti-wipe: slot sin `hiddenAt` en ningún sitio se conserva) PERO un
  `hiddenAt` reciente **SÍ** retira el slot de `visible` (ocultar
  persiste). Persiste `hiddenAt`/`shownAt` para que el cómputo sea
  cross-device y converja.

### Reglas a respetar

1. **PROHIBIDO** que `_tvHydrateReg` (o cualquier ruta nueva) pise
   `tour_registry_v1` local con el GET sin fusionar. La hidratación es
   SIEMPRE fusión por recencia (timestamps).
2. **PROHIBIDO** volver al «visible gana siempre» / «`visible` jamás
   encoge» en cliente o server. Eso reintroduce el bug de las cajas
   ocultas que vuelven a salir. El estado lo decide la recencia
   (`hiddenAt` vs `shownAt`). El anti-wipe se preserva con el **baseline
   de presencia** (un slot solo-`visible`, sin `hiddenAt`, nunca se
   pierde) + la recuperación por contenido.
3. **PROHIBIDO** que `del`/`restore`/`new` dejen de sellar
   `hiddenAt`/`shownAt`. Sin sello, un POST stale puede ganar y
   reaparece (o desaparece) la caja. El array `hidden` se mantiene solo
   por compatibilidad/legacy.
4. La recuperación por contenido (`_tvSlotHasContent`) es la red que
   devuelve cajas ya perdidas — no quitarla. Está gateada por
   `_tvEffHidden` (recencia), que es lo único que frena la
   resucitación de lo ocultado explícitamente.
5. El nombre custom de cada caja vive en `tour_<id>_v1` (cfg), el
   registro solo lista ids — toda ruta que añada/quite cajas debe tocar
   AMBOS de forma coherente (cfg vía `_tourSave`, registro vía
   `_tvRegSave`).

## Escudos de Resto de Ligas — backfill por nombre, NUNCA se pierden entre dispositivos (obligatorio, 2026-06-02)

**Bug (foto usuario 2026-06-02)**: el amigo puso TODOS los escudos de
la Liga Grecia (`ligaExt_grecia`, «Super League») desde su PC, pero en
el móvil del usuario **no salía ninguno** (círculos grises en la tabla
de clasificación `renderTable` / `s-liga-ext`).

### Causa raíz

El escudo de cada equipo vive en `team.shield` (URL o dataURI). La
sincronización multi-dispositivo de `ligaExt_<slug>` resuelve conflictos
a nivel de DOCUMENTO o de EQUIPO-completo, no de campo:

1. **Cliente (`fetchData`, `misc_body_1.html`)**: el anti-wipe es
   **todo-o-nada**. Si la copia LOCAL del usuario tiene rosters más
   ricos (más jugadores) que la del amigo, el anti-wipe **conserva la
   copia local entera e IGNORA la del servidor** — incluidos los
   escudos que el amigo acababa de subir.
2. **Servidor (`_lx_merge_teams`, `app.py`)**: la fusión por equipo
   elige al ganador por `updatedAt`. Si el ganador de un equipo no
   trae escudo (copia de otro dispositivo con plantilla más reciente
   pero sin el escudo), el escudo se perdía aunque existiera en la otra
   versión del MISMO equipo.

### Fix — el escudo es IDENTIDAD: backfill por nombre normalizado

El `shield` es un dato de identidad: una vez puesto en CUALQUIER
dispositivo, **no debe desaparecer nunca** y debe propagarse a todos,
independientemente de qué lado «gane» el roster.

- **Cliente**: helper `_lextBackfillShields(target, source)` (justo
  antes de `fetchData`). Rellena el `shield` de cada equipo de `target`
  que NO lo tenga, tomándolo del equipo del MISMO nombre normalizado
  (`_lextNormName`) en `source`. **NUNCA pisa** un escudo ya presente.
  Se llama en las **3 rutas** de adopción de `fetchData`: (a) adopción
  temprana «servidor tiene ≥ local+6 equipos», (b) rama anti-wipe
  (conserva local → backfill desde servidor + re-push), (c) rama de
  aceptar servidor (backfill desde local).
- **Servidor**: tras elegir ganadores en `_lx_merge_teams`, se rellena
  el `shield` de los `out_teams` que se quedaron sin él tomándolo de la
  versión (old o new) más reciente que SÍ tenía escudo. Defensa en
  profundidad: si un dispositivo re-sube una copia sin escudos, el
  servidor los reconstruye.

### Reglas a respetar

1. **PROHIBIDO** que el anti-wipe de rosters (teams/players/perTeam)
   descarte escudos del servidor. El backfill debe correr SIEMPRE que
   se conserve la copia local.
2. **PROHIBIDO** que `_lextBackfillShields` PISE un escudo ya presente
   en el target (la edición del propio dispositivo manda; solo se
   rellenan los vacíos).
3. El backfill es por **nombre normalizado** (`_lextNormName` en
   cliente, `_lx_norm_name` en servidor), no por id (los ids se
   regeneran al re-pegar listas).
4. Toda nueva ruta de sync de `ligaExt_*` que adopte una de las dos
   copias debe pasar por el backfill de escudos antes de cachear/render.

## Resto del Mundo — la PLANTILLA de jugadores es IDENTIDAD igual que el escudo, nunca se pierde (obligatorio, 2026-07-02)

**Bug (foto usuario 2026-07-02, «Resto Mundo»)**: la clasificación de
Resto del Mundo mostraba los 44 equipos con nombre real pero **escudo
gris (vacío) y 0 PJ** en TODOS — como si nunca se hubiera editado ni
simulado nada, pese a que el admin ya había pegado plantillas y escudos.

### Causa raíz

Toda la red de recuperación de las 4 ligas con seed automático (Resto
Mundo / Montenegro / N. Irlanda / Albania — `_ensureRestoMundoSeed`,
`_ensureExtraLeagueSeed`, `_lextIdbTopupIfEmpty`,
`_lextRecoverResultsFromBackups`, documentada en las secciones
2026-06-28/06-30/07-01/07-02 de más arriba) solo comprobaba si faltaban
**`results`** (la clasificación/PJ). Ninguna capa comprobaba si faltaban
**`players`** (la plantilla) o **`shield`** (el escudo):

1. El seed en blanco escribe `teams` con NOMBRE pero `players:[]` /
   `shield:''`. Una vez ese blanco queda escrito en el `main`,
   `hasTeams` (solo mira `teams.length > 0`) es **true para siempre**,
   así que el `return` temprano de `_ensureRestoMundoSeed`/
   `_ensureExtraLeagueSeed` saltaba TODA la cadena de recuperación
   (`_protected` → snapshots → servidor), aunque esas copias durables
   tuvieran la plantilla y los escudos reales.
2. `_lextIdbTopupIfEmpty` y `_lextRecoverResultsFromBackups` solo
   miraban `results` para decidir si había «algo que curar»; con
   `results` presente (o ausente pero sin roster) nunca intentaban
   restaurar `players`/`shield`.
3. Ni el merge del cliente (`fetchData`) ni el del servidor
   (`_lx_merge_teams`) rellenaban `players` de la versión perdedora — el
   backfill de identidad de 2026-06-02/06-11 cubría `shield` y
   `stadium`, pero nunca `players`.

### Fix — la plantilla de jugadores hereda el backfill de identidad

- **`window._lextHasRosterOrShield(d)`** (nuevo, junto a
  `_lextIdbTopupIfEmpty`): true si CUALQUIER equipo del documento tiene
  `players.length` o `shield` no vacío. Es el detector de «esto es un
  seed en blanco, no datos reales».
- **`_lextBackfillRoster(target, source)`** (nuevo, espejo EXACTO de
  `_lextBackfillShields`): rellena `players` de cada equipo de `target`
  que venga vacío, tomándolo del equipo del MISMO nombre normalizado en
  `source`. NUNCA pisa un roster ya presente.
- **`_ensureRestoMundoSeed` / `_ensureExtraLeagueSeed`**: el guard
  `hasTeams` ya NO basta por sí solo — `isBlank` detecta el estado
  «equipos con nombre pero sin plantilla/escudos/resultados» y, aunque
  `hasTeams` sea true, fuerza el MISMO intento de recuperación
  (`_protected` → snapshots → servidor) que si `hasTeams` fuera false.
  Si se encuentra una copia rica, se hace backfill de `players` +
  `shield` + `results` SOBRE el documento actual (preservando
  `config.zones` ya editadas), en vez de reemplazar el documento entero.
- **`_lextIdbTopupIfEmpty`**: el gate de «necesita top-up» ahora
  comprueba `results` **y** `_lextHasRosterOrShield`; el top-up desde
  IndexedDB hace backfill por nombre (`_lextBackfillShields`/
  `_lextBackfillResults`) en vez de reemplazo ciego.
- **`_lextRecoverResultsFromBackups`**: el hot-path también comprueba
  `_lextHasRosterOrShield`; el bucle de restauración llama además a
  `_lextBackfillRoster`/`_lextBackfillShields`, no solo a
  `_lextBackfillResults`.
- **`fetchData`** (las 3 rutas de adopción): añadido
  `_lextBackfillRoster(...)` junto a cada `_lextBackfillShields(...)`
  existente — la plantilla viaja con la misma garantía que el escudo en
  CUALQUIER sync cross-device, para las ~50 ligas normales también.
- **Servidor (`_lx_merge_teams`, `app.py`)**: nuevo bloque de backfill
  `best_roster_by_name`, espejo EXACTO del bucle `for _fld in ("shield",
  "stadium")` pero para `players[]` — el ganador de la fusión por
  `updatedAt` que se quede sin roster lo recupera de la versión (old o
  new) más reciente que sí lo tenga.

### Reglas a respetar

1. **PROHIBIDO** que cualquier guard de «¿hace falta recuperar/sembrar
   esta liga?» mire SOLO `teams.length` o SOLO `results`. Debe
   comprobar también `_lextHasRosterOrShield` (o el equivalente
   servidor) — si no, un seed en blanco que ya quedó escrito bloquea la
   recuperación PARA SIEMPRE aunque existan copias durables ricas.
2. **PROHIBIDO** que `_lextBackfillRoster` pise un roster ya presente en
   `target` (mismo contrato que `_lextBackfillShields`): solo rellena
   equipos con `players` vacío.
3. **PROHIBIDO** que el backfill de identidad del servidor
   (`_lx_merge_teams`) cubra `shield`/`stadium` pero no `players`. Toda
   fusión por-equipo nueva hereda los 3 campos.
4. Toda liga NUEVA con seed automático (una 5ª futura, si se añade)
   hereda `isBlank` + el backfill de roster/escudos automáticamente al
   reutilizar `_ensureExtraLeagueSeed`/`_lextIdbTopupIfEmpty`; no
   duplicar esta lógica en un guard ad-hoc.

## El ALIAS de eFootball de un equipo es IDENTIDAD igual que escudo/estadio/plantilla, nunca se pierde (obligatorio, 2026-07-04)

**Bug (fotos usuario 2026-07-04, «a mi amigo no le sale la ❓️ pero a mí
sí»)**: en la pantalla de PREVIA de un partido, bajo el nombre de un
equipo sin licencia real en eFootball (p.ej. Maccabi Tel Aviv), el
admin ve un botón **❓** que al pulsarlo muestra con qué equipo REAL de
eFootball hay que jugar (`t.efootballAlias`, editado a mano en el
editor de Resto de Ligas — campo `#lext-team-efootball-alias`). Ese
botón salía en el móvil del usuario pero NO en el de su amigo, para el
MISMO equipo de la MISMA liga.

### Causa raíz

`efootballAlias` es un campo de equipo dentro de `ligaExt_<slug>`,
exactamente del mismo tipo que `shield` (escudo, protegido desde
2026-06-02), `stadium` (estadio, protegido desde 2026-06-11) y
`players` (plantilla, protegida desde 2026-07-02) — un dato de
IDENTIDAD que el admin pone en UN dispositivo y que debe propagarse a
TODOS. Pero, a diferencia de esos 3, **nunca se incluyó en NINGÚN
backfill** — ni el cliente (`_lextBackfillShields`/`_lextBackfillRoster`/
`_lextBackfillLeagueLogo`) ni el servidor (`_lx_merge_teams`, bucle
`for _fld in ("shield", "stadium")`) lo cubrían. Así, cuando la fusión
por equipo (cliente o servidor) elige un ganador por `updatedAt` y ese
ganador viene de una copia que nunca tuvo el alias puesto (el
dispositivo del amigo, que no editó ese equipo), el alias desaparecía
para ese dispositivo sin que nada lo recuperase — exactamente el mismo
mecanismo que ya rompió escudos/estadios/plantillas antes de que se
les añadiera backfill.

### Fix

- **Cliente** (`misc_body_1.html`): nuevo `_lextBackfillAlias(target,
  source)`, espejo EXACTO de `_lextBackfillShields` pero para
  `efootballAlias`. Se invoca en LOS MISMOS 10 puntos donde ya se llama
  a `_lextBackfillShields` (las 3 rutas de adopción de `fetchData`, el
  top-up desde IndexedDB, y las 4 rutas de recuperación de seed —local
  y servidor— de Resto del Mundo + Montenegro/N.Irlanda/Albania).
  Invalida `_ALIAS_CACHE` (`_invalidateAliasCache`) cuando rellena algo,
  para que el ❓ aparezca sin esperar el TTL de 3 s.
- **Servidor** (`app.py`, `_lx_merge_teams`): `efootballAlias` se añade
  al bucle `for _fld in ("shield", "stadium", "efootballAlias")` —
  mismo backfill por nombre canónico, mismo criterio (NUNCA pisa un
  valor ya presente en el ganador). Tests en
  `tests/test_api.py::TestLigaExtMerge` (`test_alias_efootball_no_se_pierde_si_ganador_no_lo_trae`,
  `test_alias_efootball_viaja_entre_grafias_del_mismo_club`).

### Reglas a respetar

1. **PROHIBIDO** que el backfill de identidad (cliente o servidor)
   cubra escudo/estadio/plantilla pero no el alias de eFootball. Los 4
   son el mismo tipo de dato (campo de equipo puesto a mano por el
   admin en UN dispositivo) y viajan igual.
2. **PROHIBIDO** que `_lextBackfillAlias` pise un alias ya presente en
   `target` (mismo contrato que `_lextBackfillShields`/`_lextBackfillRoster`):
   solo rellena equipos con `efootballAlias` vacío.
3. Todo campo NUEVO de identidad por equipo que se añada en el futuro
   al editor de Resto de Ligas (junto a escudo/estadio/alias/plantilla)
   hereda este patrón: backfill cliente (`_lextBackfillXxx`, llamado en
   los mismos 10 puntos) + backfill servidor (añadido al bucle de
   `_lx_merge_teams` si es un campo string simple, o su propio bloque
   `best_*_by_name` si es más complejo como `players[]`).

### Refuerzo — el alias puede existir en el servidor SIN que el dispositivo lo tenga cacheado (obligatorio, 2026-07-05)

**Bug (fotos usuario 2026-07-05, «si tiene alias»)**: tras el fix de
backfill de arriba, el ❓ seguía sin mostrar el alias de Maccabi Tel
Aviv aunque el editor de "Resto de Ligas" (misma sesión) lo mostraba
guardado (`Sudamérica - 1🇦🇷 - Rosario AA - 1ª👕 - ⭐⭐⭐⭐`).

**Causa raíz — el escaneo de `_buildAliasCache` es SOLO LOCAL**:
`getTeamEfootballAlias` resuelve el alias escaneando `ligaExt_*` en
`localStorage` + `LIGA_CACHE` (memoria) del PROPIO dispositivo — nunca
pregunta al servidor. Resto de Ligas tiene ~54 ligas; si ESE
dispositivo nunca había abierto la liga concreta de Maccabi Tel Aviv,
esa liga no existía ni en `localStorage` ni en `LIGA_CACHE` todavía —
el escaneo no tenía NADA que mirar, aunque el servidor sí tuviera el
equipo con su alias. Abrir el editor de esa liga (como hizo el admin
para comprobarlo) es precisamente lo que la carga por primera vez —
por eso el editor SÍ lo mostraba justo después, sin que eso arregle la
consulta anterior de la previa.

**Fix** (`misc_body_1.html`): `window._efAliasServerSearch(teamName,
onDone)` — cuando el ❓ no encuentra nada en el cache local, busca en
el SERVIDOR liga por liga, **secuencial** (nunca en paralelo — mismo
patrón anti-thundering-herd que `_eurHydrateMissingLeagues`/
`_eurPickerLoadLeague`), parando en cuanto encuentra el equipo. Solo se
dispara BAJO DEMANDA al pulsar el ❓ (nunca en el arranque ni en el
render de la previa). `_copaShowAlias` (`copa-engine.js`) muestra
"🔄 Buscando en el servidor…" mientras busca y rellena el popup en
cuanto lo encuentra, además de sembrar `_ALIAS_CACHE` para que la
siguiente consulta de ese equipo sea instantánea. `_buildAliasCache`
también escanea `window._TOUR_CACHE` (cfgs de torneo ya cargados) como
fuente adicional, por si algún formato de torneo llega a copiar el
alias al roster del torneo.

**Reglas a respetar**:
4. **PROHIBIDO** asumir que "el alias no aparece" significa "el alias
   no existe" — puede significar simplemente que ESTE dispositivo nunca
   cargó la liga de ese equipo. Todo lookup de identidad por nombre
   (alias, y si se añade un campo similar en el futuro) que dependa de
   un escaneo LOCAL de `ligaExt_*` debe tener un fallback de búsqueda en
   servidor bajo demanda, no limitarse a devolver vacío.
5. **PROHIBIDO** que la búsqueda en servidor dispare las ~54 ligas TODAS
   de golpe (thundering herd real) NI una a una completamente en serie
   (demasiado lenta — ver refuerzo de abajo). Lotes acotados en
   paralelo (`BATCH=8`) con parada temprana en cuanto se encuentra el
   equipo, y siempre disparada por una acción EXPLÍCITA del usuario
   (pulsar el ❓), nunca automática en el arranque o en cada render de
   la previa.

### Refuerzo — búsqueda por lotes (no 1-a-1) + selector de portero a prueba de balas con `touchstart` (obligatorio, 2026-07-05)

**El fix anterior no bastó (2 quejas del mismo usuario)**:
1. «se tira mucho tiempo buscando el equipo, tendría que salir al
   momento, siempre ha sido así» — la búsqueda de `_efAliasServerSearch`
   recorría las ~54 ligas **una a una en serie**: cada peticion suma su
   latencia COMPLETA a la siguiente, así que en el peor caso (equipo en
   una liga tardía del recorrido, con Railway lento) podían pasar varios
   segundos. Fix: lotes de **8 peticiones en paralelo** por ronda en vez
   de 1 en serie — mismo espíritu anti-thundering-herd (no las 54 de
   golpe) pero con concurrencia acotada, típicamente 1-2 rondas en vez
   de hasta 54 peticiones en fila. El caso común (liga ya cacheada
   localmente) sigue sin disparar NINGUNA petición.
2. «la foto 2 no funciona para nada» (selector de portero, otra vez) —
   el respaldo `touchend` con comprobación de movimiento (refuerzo
   anterior) esperaba a que el gesto TERMINARA para decidir si era un
   tap o un scroll. Se endurece aún más: dispara en el propio
   `touchstart` (el instante exacto en que el dedo toca), sin esperar a
   ver qué pasa después. Esta lista es corta y no crítica para
   scrollear, así que el coste de un falso positivo (elegir portero por
   un roce accidental) es mucho menor que el de dejar al usuario
   COMPLETAMENTE bloqueado. Verificado con Playwright: un touchstart
   seguido de un touchmove GRANDE (200px, inequívocamente un scroll) YA
   NO cancela la selección porque esta se resuelve antes de que el
   touchmove llegue a evaluarse.

**Reglas a respetar**:
6. ~~PROHIBIDO que una búsqueda de respaldo en servidor sea secuencial
   1-a-1... usar lotes en paralelo acotados~~ — **SUPERADO por el
   refuerzo de abajo (2026-07-05 #2)**: ni siquiera por lotes, el
   cliente NO debe repetir peticiones HTTP (una por liga) para buscar
   un dato por nombre. La búsqueda de identidad por nombre (alias, o
   cualquier campo similar futuro) se hace con **UNA sola petición a un
   endpoint server-side dedicado** que recorre las ligas en la propia
   base de datos del servidor. Ver `/api/team-alias/<nombre>`.
7. **PROHIBIDO** que el respaldo táctil de un overlay OBLIGATORIO
   crítico (picker de porteros, MVP, o cualquier futuro) espere al
   `touchend`/gesto completo para decidir si actuar. Dispara en
   `touchstart` — el coste de un falso positivo ocasional es siempre
   menor que el de un usuario completamente bloqueado sin forma de
   avanzar ni cancelar.

### Refuerzo 2 — la búsqueda de identidad por nombre es SERVER-SIDE, una sola petición (obligatorio, 2026-07-05)

**El refuerzo anterior (lotes de 8) no bastó**: el usuario preguntó,
con toda la razón, «¿por qué tiene que buscar en el servidor si el
alias YA está ahí?», y además reportó que la búsqueda «no funciona, se
queda cargando» — nunca llegaba a completarse.

**Causa raíz**: el lote de 8 en paralelo seguía dependiendo de que el
PROPIO MÓVIL hiciera hasta ~54 peticiones HTTP (una por liga), solo que
agrupadas de 8 en 8. `fetch()` **no tiene timeout por defecto** — si
UNA sola petición de un lote se quedaba colgada por una red móvil
floja, el `Promise.all()` de ESE lote entero esperaba para siempre, y
la búsqueda jamás avanzaba ni concluía "no encontrado". Además, hacer
que el cliente escanee ~54 blobs JSON completos para encontrar UN
equipo por nombre es trabajo que el SERVIDOR puede hacer en una
fracción del tiempo (consultas a su propia base de datos) sin depender
en absoluto de la calidad de la conexión del móvil.

**Fix — nuevo endpoint `GET /api/team-alias/<nombre>`** (`app.py`):
recorre TODAS las filas `liga_ext_*` de `GlobalState` DIRECTAMENTE en
el servidor (excluyendo `_protected`/`_snap_*`), compara por nombre
CANÓNICO (`_lx_canon_name`, mismo criterio que `_lx_merge_teams`) y
devuelve `{ok:true, alias: "..."}` o `{alias: null}` en una ÚNICA
respuesta. `_efAliasServerSearch` (`misc_body_1.html`) pasa de hacer
hasta 54 fetches del cliente a hacer **UNA sola petición**, con
`AbortController` + timeout de 6 s para que, aunque la red falle, la
búsqueda NUNCA se quede "cargando" para siempre — se resuelve como "no
encontrado" pasado ese tiempo.

**Reglas a respetar**:
8. **PROHIBIDO** que una búsqueda de identidad por nombre (alias, o
   cualquier campo similar futuro) haga que el CLIENTE recorra las
   ligas una por una o por lotes vía HTTP. Esa búsqueda vive en el
   SERVIDOR (un endpoint dedicado que consulta su propia base de datos)
   y el cliente hace UNA sola petición.
9. **PROHIBIDO** que una petición `fetch()` de la que depende un
   resultado visible en pantalla (spinner "Buscando…") carezca de
   timeout. Sin `AbortController` (o equivalente), una petición colgada
   deja al usuario mirando un spinner infinito sin ninguna forma de
   saber que algo falló.
10. Todo endpoint server-side de búsqueda por nombre NUEVO hereda el
    mismo criterio de normalización (`_lx_canon_name`) y el mismo
    filtro anti-derivados (`_protected`/`_snap_*`) que `_lx_merge_teams`,
    para no duplicar lógica de canonicalización.

### Refuerzo 3 — la búsqueda cubre SELECCIONES + no se dispara si el equipo ya es conocido sin alias (obligatorio, 2026-07-05)

**Bug (fotos usuario, «Timor Oriental», foto "pero si es equipo real,
por qué sale ❓")**: en un partido de Selecciones (Road Copa Asia,
Inglaterra vs Timor Oriental), el ❓ bajo Timor Oriental se quedaba
`🔄 Buscando en el servidor…` sin resolver nunca.

**Causa raíz 1**: `/api/team-alias/<nombre>` (refuerzo 2 de arriba)
solo consultaba filas `liga_ext_*` — **nunca** `selecciones_squad_v1`.
Timor Oriental es una SELECCIÓN nacional, no un club de Resto de Ligas,
así que la búsqueda jamás podía encontrarla aunque tuviera alias
guardado en el sitio correcto.

**Causa raíz 2 (más de fondo)**: Timor Oriental **es un equipo real**
en el juego — el admin nunca configuró alias porque no hace falta.
Pero el código no distinguía "este equipo no está cacheado en este
dispositivo" (sí amerita preguntar al servidor) de "este equipo SÍ está
cacheado, simplemente no tiene alias porque no lo necesita" (una
respuesta ya definitiva, preguntar al servidor es tiempo perdido). Con
`selecciones_squad_v1` casi siempre cacheado localmente (es una sola
clave global, no 54 ligas fragmentadas), este caso iba a ser MUY común
para selecciones.

**Fix**:
- `/api/team-alias/<nombre>` (`app.py`) ahora también consulta la fila
  `selecciones_squad_v1` si no encontró nada en `liga_ext_*`.
- Nuevo `window._efAliasKnownLocally(teamName)` (`misc_body_1.html`):
  usa el flag `window.__aliasFoundInEditor` (ya lo pone
  `getTeamEfootballAlias` cuando encuentra el equipo en CUALQUIER
  fuente local, aunque el alias venga vacío) para saber si el equipo ya
  es conocido. `_copaShowAlias` (`copa-engine.js`) comprueba esto
  ANTES de disparar `_efAliasServerSearch`: si el equipo ya es
  conocido localmente (con o sin alias), muestra el aviso al instante
  sin preguntar al servidor. El aviso ahora también aclara "si el
  equipo SÍ existe tal cual en eFootball, no hace falta rellenar nada
  — este aviso es normal" para no sugerir un fallo cuando no lo hay.

**Reglas a respetar**:
11. **PROHIBIDO** que un endpoint de búsqueda de identidad por nombre
    cubra solo `liga_ext_*` cuando el dato (alias, o cualquier campo
    similar) también puede vivir en `selecciones_squad_v1` (selecciones
    nacionales) o cualquier otro store de equipos. Cubrir TODAS las
    fuentes donde ese campo pueda existir.
12. **PROHIBIDO** disparar la búsqueda en servidor para un equipo que
    YA está indexado localmente (`window.__aliasFoundInEditor`), aunque
    su alias venga vacío — un alias vacío de un equipo CONOCIDO es una
    respuesta definitiva ("no lo necesita"), no una señal de que falte
    sincronizar. Solo preguntar al servidor cuando el equipo no está
    indexado en ABSOLUTO localmente.
13. Todo aviso de "sin alias configurado" debe dejar claro que es un
    estado NORMAL para un equipo con licencia real en eFootball, no
    solo un error a corregir — para no generar la misma confusión.

## Resto de Ligas — las stats de COPA + LIGA se SUMAN por jugador y sobreviven al re-sim de liga (obligatorio, 2026-06-12)

**Bug (fotos usuario 2026-06-12, «Campionato Sammarinese»)**: un equipo
de una liga externa (CALUNGO) tenía la liga Y la copa jugadas (PJ 38 a
nivel de equipo) pero la caja de la plantilla salía «Máximo goleador:
sin registros · MVP: sin registros» con TODOS los jugadores a 0.

### Causa raíz

Para Resto de Ligas las stats per-jugador viven en `team.players[]`
(la sim NO guarda goleadores en `results[]`). `ligaExtSimular` hace
`resetPlayerStats` a TODOS los jugadores y re-aplica SOLO la liga. La
copa (`_lecRunAllAuto`/`_lecSimMatch`) suma su aportación ENCIMA. Pero
si la liga se vuelve a simular DESPUÉS de la copa (típico: el botón
global «Sim» que rejuega las 51 ligas), el reset BORRA la aportación de
copa de `team.players[]`. Como `data.copa` sigue con sus partidos
jugados, `_lextComputeRealStats` calcula `teamPJ = liga + copa` mientras
`p.pj` quedó en liga sola → el check anti-stale `ownPj === teamPJ` falla
y `_lextHydratePlayerStats` devuelve TODO a 0 → «sin registros».
Agravante: la cabecera (`_lextRenderSquadStatsHeader`) se pinta ANTES
que `renderSquadList` (el único que sincronizaba el cache desde
`team.players[]`), así que leía un `ef_player_stats_v1` que
`rebuildPlayerStatsStore` deja VACÍO de equipos de ligas externas.

### Fix — el 🎮 Sim simula LIGA + COPA (global e individual, 2026-06-12)

Petición usuario: «el botón 🎮 Sim simule tanto Liga como copa, tanto
global como individual». La raíz del «sin registros» era que la liga se
re-simulaba (reset) sin re-jugar la copa. Solución definitiva: cada Sim
deja la liga Y la copa jugadas, así `team.players[]` siempre = liga+copa.

- **`_lecSimCupOn(data, opts)`** (motor de copa reutilizable, SIN efectos
  colaterales: no usa `CURRENT_KEY`, no `saveData`, no render, no alert):
  ensura el cfg de copa según las REGLAS de esa copa (formato por nº de
  equipos + toggles), simula grupos + KO + final, aplica stats a las
  plantillas y proclama campeón. `opts.force=true` REDIBUJA la copa de
  cero (nuevo sorteo + sim). Devuelve false si la liga no llega a 12
  equipos. `_lecRunAllAuto` (botón Copa) y `ligaExtSimular._finishSim`
  comparten este motor.
- **`ligaExtSimular._finishSim`** llama `_lecSimCupOn(data,{force:true})`
  tras la sim de liga (que acaba de hacer `resetPlayerStats`): la copa se
  re-simula de cero ENCIMA de la liga fresca → stats = liga+copa, sin
  doble conteo (la copa siempre parte del reset de la liga). Como el Sim
  global (`_restoLigasSimAll`) llama a `ligaExtSimular` por liga, hereda
  liga+copa automáticamente.
- **Cabecera sincroniza primero**: `_lextRenderSquadStatsHeader` llama a
  `_lecSyncPlayerStatsCache(loadData(CURRENT_KEY))` ANTES de leer los
  líderes (espejo de lo que ya hacía `renderSquadList`).

### Pool de la Recopa — 54 campeones + 10 subcampeones = 64 (2026-06-12)

Petición usuario: el campeón de las 53 ligas externas + Liga EA Sports
(54) va a Recopa, MÁS el subcampeón de 10 copas concretas (EA Sport,
Inglaterra, Italia, Alemania, Francia, Portugal, Países Bajos, Bélgica,
Turquía, Dinamarca) = 64. `_buildPool` (IIFE `recopa_state_v1`):
- TODOS los campeones de ligas externas europeas (ya lo hacía).
- Subcampeón SOLO de la whitelist `RECOPA_SUBCAMPEON_SLUGS` (las 9
  externas: `inglaterra,italia,alemania,francia,portugal,p-bajos,belgica,
  turquia,dinamarca`). El toggle per-cup `recopaSubcampeon` puede
  DESACTIVAR una de las 9, nunca AÑADIR una fuera de la lista.
- EA Sports (campeón + subcampeón de la Copa del Rey, la 10ª copa con
  sub) entra por los MANUALES de «EA Sports → Europa» slug `recopa`
  (`_meaTeamsFor('recopa')`), porque `liga-ea-sports` está en
  `EUROPE_BLACKLIST`. El bracket de 64 rellena con BYE si faltan equipos.

### Reglas a respetar

1. **PROHIBIDO** que `ligaExtSimular` deje `team.players[]` con stats de
   liga sola cuando la liga tenga ≥12 equipos: tras el reset+liga debe
   re-simular la copa (`_lecSimCupOn(data,{force:true})`) para que la
   suma liga+copa sobreviva a cualquier re-sim (incluido el bulk global).
2. **PROHIBIDO** que `_lecSimCupOn` haga `saveData`/render/alert: es el
   motor puro, el caller persiste. `_lecRunAllAuto` y `_finishSim` son
   los únicos call sites (no duplicar el motor de copa en otra ruta).
3. Toda caja/cabecera que lea líderes de una liga externa debe
   sincronizar el cache desde `team.players[]` (`_lecSyncPlayerStatsCache`)
   ANTES de leer, no fiarse de `ef_player_stats_v1` (lo vacía
   `rebuildPlayerStatsStore` para los equipos no-EA).
4. **PROHIBIDO** que la Recopa vuelva al «subcampeón de TODAS las copas
   con toggle ON». Solo las 9 de `RECOPA_SUBCAMPEON_SLUGS` + EA manual.

## Resto de Ligas con 3 móviles + PC — dedup canónico, estadio y logo de liga NUNCA se pierden (obligatorio, 2026-06-11)

**Bug (petición usuario 2026-06-11, «3 móviles y cpus editando resto de
ligas errores graves»)**: con varios dispositivos editando a la vez
`ligaExt_<slug>`: (1) **se duplican equipos**, (2) **no se puede añadir
estadios a los equipos** (se borran al sincronizar), (3) **se borran
logos de ligas**.

### Causas raíz (todas en la fusión cross-device, chokepoint `_lx_merge_teams`)

1. **Duplicados**: el colapso final por nombre del servidor usaba
   `_lx_norm_name` (solo acentos/puntuación), MÁS DÉBIL que el dedup del
   cliente `_teamCanonKey`/`_canonTeamName` (que además quita afijos
   FC/CF/CD…). Re-pegar la lista regenera ids → «Olympiacos» (id A) y
   «Olympiacos FC» (id B) eran claves distintas, el `_lx_norm_name` no
   las colapsaba y AMBAS sobrevivían. Y el cliente no las re-colapsaba
   porque `_sanitizeLigaTeamNames` hace early-out si `d._sanV ===
   _SAN_VER` (sello persistido y sincronizado).
2. **Estadio**: `_lx_merge_teams` elegía al ganador por `updatedAt` y se
   quedaba con su dict ENTERO; si ese ganador no traía `stadium` (otra
   copia más reciente sin el estadio recién puesto), se perdía. El
   `shield` tenía backfill de identidad; el `stadium` NO.
3. **Logo de liga**: `config.logo`/`config.cupLogo` (logo PROPIO de la
   competición) viven en el config TOP-LEVEL del documento, que la
   fusión adopta VERBATIM del entrante (`result = dict(new_data)`). Como
   `ensureConfig` (cliente) fuerza `config.logo = ''` en TODO dispositivo
   que nunca lo puso, un POST de ese dispositivo BORRABA el logo que otro
   guardó (last-write-wins, sin arbitraje ni backfill).

### Fix

- **Servidor** (`app.py`, `_lx_merge_teams`):
  - `_lx_canon_name` (afijo-aware, espejo del `_canonTeamName` del
    cliente) se usa en el colapso final por nombre (`by_name`) y en los
    backfills de identidad. El `del_set`/`deletedTeamNames` sigue por
    `_lx_norm_name` (nombre del cliente).
  - Backfill de identidad GENERALIZADO a `shield` **y** `stadium`,
    indexado por nombre CANÓNICO (viaja entre grafías del mismo club).
    Nunca pisa un valor presente en el ganador.
  - Backfill del logo de liga: tras `dict(new_data)`, si el entrante
    trae `config.logo`/`cupLogo` VACÍO pero el almacenado SÍ lo tiene,
    se CONSERVA el almacenado. Un logo entrante NO vacío (edición real)
    gana.
- **Cliente** (`misc_body_1.html`): `_lextBackfillLeagueLogo(target,
  source)` (espejo de `_lextBackfillShields`) en las 3 rutas de adopción
  de `fetchData`. `_protected` empty-roster restore incluye `stadium`.
  `_SAN_VER` bump 1→2 (re-saneo único que colapsa dups EXISTENTES vía
  `_teamCanonKey` sin esperar a la próxima edición).
- Tests: `tests/test_api.py::TestLigaExtMerge`.

### Reglas a respetar

1. **PROHIBIDO** que el colapso por nombre del servidor vuelva a usar
   `_lx_norm_name` (débil). Usar `_lx_canon_name` (afijo-aware = cliente)
   o los duplicados por grafía/afijo vuelven.
2. **PROHIBIDO** que `stadium` o `config.logo`/`cupLogo` se pierdan en la
   fusión: ambos son IDENTIDAD con backfill (igual que `shield`). Un
   POST con el campo vacío NO borra el valor de otro dispositivo.
3. El backfill de logo es ADITIVO: solo restaura el campo VACÍO entrante
   desde el almacenado; nunca pisa un logo entrante no vacío.
4. Toda comp/campo de identidad NUEVO de `ligaExt_*` (que no viaje por
   equipo o que un ganador por recencia pueda no traer) hereda este
   patrón de backfill.

## La CLASIFICACIÓN simulada de una liga SEMBRADA se RECUPERA desde copias durables locales (obligatorio, 2026-06-28)

**Bug (fotos usuario «Abissnet Superiore / Albania»)**: se simula una liga
SEMBRADA (`_EXTRA_LEAGUE_SEEDS`: Albania, Montenegro, N. Irlanda), se ve la
clasificación con 38 PJ, se RECARGA la web y vuelve a **0 partidos** con el
roster del seed (mismos equipos, results vacíos). Pasa lo mismo en cualquier
liga de Resto de Ligas cuyo `main` pierda la clasificación.

### Causa raíz

El seed eager (`_ensureExtraLeagueSeed`) escribe `results: []`. Si el `main`
de `localStorage['ligaExt_<slug>']` pierde sus resultados (eviction agresiva
de localStorage en Android, un GET stale del servidor que se cacheó en main,
o un re-seed con la liga ya simulada) el `main` queda con los EQUIPOS del
seed pero SIN resultados. `loadData` solo restauraba desde `_protected`
cuando el main tenía **0 EQUIPOS** — un main re-sembrado (20 equipos,
`results:[]`) NO disparaba esa restauración. La clasificación simulada SÍ
vivía en las copias durables `_protected` / `_snap_*` (las escribe `saveData`
en CADA sim con `resultsStamp`), pero nada las consultaba → 0 PJ para
siempre.

### Fix — recuperar `results` desde `_protected`/snapshots por recencia

- **`_lextRecoverResultsFromBackups(k, data)`** (`misc_body_1.html`, junto a
  `_lextBackfillResults`): si el `main` viene SIN `results`, rellena la
  clasificación desde la copia durable local más reciente (`_protected` +
  snapshots) vía `_lextBackfillResults` (mismo arbitraje por `resultsStamp` +
  EMPTY-GUARD). Hot-path barato: **no-op si el main ya trae clasificación**.
  Lo llaman las DOS ramas de `loadData` (cache-hit + lectura de localStorage)
  y persisten el main curado.
- **`_ensureExtraLeagueSeed`**: ANTES de sembrar VACÍO, si existe una copia
  durable (`_protected`/`_snap_*`) con equipos — la liga YA se simuló y el
  main se perdió — RESTAURA esa copia (con sus resultados) en vez de pisar
  con el seed `results:[]`.

### Reglas a respetar

1. **PROHIBIDO** que el seed eager escriba `results:[]` encima de una liga
   YA simulada cuyo main se perdió: debe restaurar `_protected`/snapshot
   primero (la clasificación es durable, no se siembra vacía).
2. **PROHIBIDO** que la recuperación resucite un RESET deliberado: el reset
   (`ligaExtReiniciar`) pasa por `saveData`, que ACTUALIZA `_protected` con
   la clasificación VACÍA + sello fresco → `_protected` también está vacío y
   no hay nada que restaurar (cubierto por el arbitraje de `resultsStamp`).
3. La recuperación SOLO actúa cuando el main viene sin `results` (hot-path
   no-op si ya los tiene); la reconciliación fina cross-device la sigue
   haciendo `fetchData` con el servidor (empty-guard de `resultsStamp`).
4. Toda liga SEMBRADA nueva (`_EXTRA_LEAGUE_SEEDS`) hereda esto
   automáticamente; no hardcodear slugs en la recuperación.

### La clasificación durable se CURA en el SERVIDOR (PC→server), no solo en local (obligatorio, 2026-06-30)

**Bug (fotos usuario «Resto Mundo / N.Irlanda / Montenegro / Albania
simuladas en el PC, a 0 en el MÓVIL» + banner «Navegador sin espacio»)**:
el PC simula las ligas (clasificación visible, 380 partidos) pero al abrir
la web en el MÓVIL salen a 0 y el pool de Wild Card sale **16/72**. La
recuperación 2026-06-28 cura el LOCAL (`_protected`/snaps) pero un móvil
NUEVO no tiene copias durables locales — depende del SERVIDOR, y el
servidor estaba VACÍO.

**Causa raíz (combinada con `QuotaExceededError`)**: con localStorage
LLENO, las redes de seguridad basadas en localStorage quedan inutilizadas
(el set `liga_ext_pending_v1` de re-push en boot no se puede escribir, los
snapshots tampoco, y el XHR síncrono de `saveData` se SALTA en la sim
masiva por el gate anti-freeze). El ÚNICO camino al servidor durante la
sim es la ráfaga de POSTs async (x5) que, con Railway frío + thundering
herd (54 ligas a la vez), agota reintentos y se PIERDE. El espejo
IndexedDB (`_idbKV`) SÍ guarda la liga (por eso el PC la sigue mostrando
tras recargar), pero **NADA re-empujaba esa copia durable al servidor** →
el servidor se quedaba vacío para siempre → el móvil (que lee bien del
servidor vía `fetchData`) sacaba 0.

**Fix** (`misc_body_1.html`):
- **`window._lextReconcileResultsToServer(opts)`** (junto a `fetchData`):
  curado PROACTIVO e INDEPENDIENTE de la cuota. Para cada liga con
  clasificación durable LOCAL (LIGA_CACHE / localStorage main /
  `_protected` / IndexedDB vía `_lextBestLocalForReconcile`), GET del
  servidor y, si está VACÍO o ATRASADO, RE-EMPUJA la copia local
  confirmando (3 reintentos). Arbitraje = el MISMO `resultsStamp` +
  EMPTY-GUARD: sube SOLO si `localResults>0 && localStamp>=srvStamp &&
  localResults>srvResults`. Secuencial+pausado (mata el thundering herd
  que rompía la subida original). NO escribe localStorage (inmune a la
  cuota). Disparos: boot (diferido 9 s), `pageshow`/`focus`/`visibility`,
  fin de sim masiva (`_onDone`, force) y fin de sim individual
  (`_finishSim`).
- **`_eurHydrateMissingLeagues`** (botón «♻️ Re-cuadrar reparto europeo»):
  ahora también trae del servidor la CLASIFICACIÓN de las ligas que
  localmente tienen equipos pero `results` VACÍO (antes solo traía las que
  faltaban plantilla). Sin esto, recalcular el reparto en el móvil seguía
  saliendo corto (Wild Card 16/72) aunque el servidor ya estuviera curado.

**Reglas a respetar**:
5. **PROHIBIDO** confiar SOLO en la ráfaga de POSTs async de `saveData`
   para subir la sim: con localStorage lleno se pierde y nada la recupera.
   `_lextReconcileResultsToServer` es la red que cura el servidor desde la
   copia durable (IndexedDB/`_protected`/memoria), y DEBE seguir
   disparándose en boot + foco + fin de sim.
6. **PROHIBIDO** que la reconciliación pise un RESET o una sim más nueva de
   otro dispositivo: el guard `localStamp>=srvStamp && localResults>srvResults`
   (espejo del empty-guard server/cliente) lo impide. No relajarlo a
   last-write o a comparar solo por longitud sin el sello.
7. **PROHIBIDO** que el recálculo del reparto europeo (Wild Card / pools)
   compute sobre ligas con `results` vacío sin intentar traerlos del
   servidor primero (`_eurHydrateMissingLeagues` incluye ahora las ligas
   con equipos pero sin clasificación).

### El "ensure seed" de las 4 ligas auto-sembradas también recupera de `_protected`/IndexedDB en LOCAL (obligatorio, 2026-07-01)

**Bug (queja usuario 2026-07-01, «Montenegro / N.Irlanda / Albania / Resto
del Mundo — por más que las simulo no se quedan guardados los datos de
simulación y se resetean automáticamente»)**: estas 4 son las ÚNICAS ligas
de "Resto de Ligas" con un **seed automático de equipos** hardcodeado en
el código (`_EXTRA_LEAGUE_SEEDS` para Montenegro/N.Irlanda/Albania,
`RESTO_MUNDO_TEAMS` para Resto del Mundo). El resto de las ~50 ligas
dependen de que el admin pegue la plantilla a mano — nada las re-siembra
nunca. Estas 4 tienen una función `_ensureRestoMundoSeed`/
`_ensureExtraLeagueSeed` que corre en CADA boot **y en CADA apertura**
(`openLigaExt` envuelto) y que, si no encuentra equipos en el `main` crudo
de localStorage, escribe una plantilla fresca con `results:[]`.

**Causa raíz (asimetría entre las dos funciones)**: el fix 2026-06-28 le
dio a `_ensureExtraLeagueSeed` (Montenegro/N.Irlanda/Albania) la
recuperación desde `_protected`/`_snap_*` ANTES de sembrar vacío — pero
**`_ensureRestoMundoSeed` nunca recibió ese mismo fix**. Si el `main` de
`ligaExt_resto-mundo` se perdía (eviction agresiva de Android, o un
`QuotaExceededError` silencioso de `saveData` con esta liga tan grande —
44 equipos, hasta 903 partidos), la función sobreescribía DIRECTAMENTE con
la plantilla vacía sin mirar si `_protected`/snapshots aún tenían la
clasificación — perdiendo la sim en cada apertura si el `main` se había
evictado. Además, si localStorage se queda sin espacio, `_protected` y los
snapshots pueden perderse TAMBIÉN (viven en el mismo storage) — solo el
espejo IndexedDB (`_idbKV`, alta cuota) sobrevive, y ninguna de las dos
funciones lo consultaba antes de sembrar vacío.

**Fix** (`misc_body_1.html`):
- `_ensureRestoMundoSeed` gana la MISMA recuperación local
  (`_protected`/`_snap_*`) que ya tenía `_ensureExtraLeagueSeed` — deja de
  ser la única de las 4 sin esa red.
- **`window._lextIdbTopupIfEmpty(slug)`** (nuevo, compartido por las 4):
  si tras la recuperación local el `main` sigue sin `results`, hace un GET
  ASÍNCRONO a `_idbKV` (fire-and-forget, no bloquea el primer render) y,
  si IndexedDB trae una clasificación que localStorage no tiene, la
  adopta — releyendo el `main` justo antes de escribir para no pisar una
  sim concurrente que haya llegado mientras el GET volaba. Se llama desde
  las DOS ramas de ambas funciones (cuando ya hay equipos y cuando se
  acaba de sembrar vacío), así una liga con `main` intacto pero
  `results` vacíos también se cura.

**Reglas a respetar**:
8. **PROHIBIDO** que una liga con seed automático nuevo (si se añade una
   5ª en el futuro) tenga su propia función "ensure seed" SIN la
   recuperación `_protected`/`_snap_*` + `_lextIdbTopupIfEmpty` antes de
   escribir una plantilla vacía. Las 4 actuales son las únicas con este
   patrón — toda liga nueva de este tipo lo hereda.
9. **PROHIBIDO** que `_lextIdbTopupIfEmpty` sobreescriba una clasificación
   YA presente en localStorage (relee el `main` justo antes de escribir)
   ni que bloquee el render con una espera síncrona de IndexedDB — es
   fire-and-forget, complementa a `_lextReconcileResultsToServer`
   (2026-06-30) que cura el SERVIDOR; este fix cura el propio dispositivo.

### El "ensure seed" de las 4 ligas auto-sembradas pregunta al SERVIDOR antes de sembrar vacío (obligatorio, 2026-07-02)

**Bug (foto usuario 2026-07-02, «Abissnet Superiore / Albania», 20 equipos
a 0 PTS/0 PJ)**: pese a los fixes 2026-06-28/06-30/07-01, el usuario seguía
viendo la liga de Albania a 0 «por más que la simulo».

**Causa raíz remanente**: `_ensureExtraLeagueSeed`/`_ensureRestoMundoSeed`
(las 4 ligas con seed automático) solo recuperaban de copias durables
**LOCALES** (`_protected`/`_snap_*`) antes de sembrar vacío. Si esas
copias TAMBIÉN se habían perdido (eviction agresiva de Android que borra
localStorage entero, no solo el main — el mismo fenómeno que motivó el fix
de 2026-06-28), el seed escribía `results:[]` de inmediato y de forma
SÍNCRONA **sin preguntar nunca al servidor**. Esto es MENOS robusto que
`loadData()` (la función que usan las ~50 ligas normales), que sí hace un
XHR síncrono a `/api/liga-ext/<slug>` + `-protected` antes de rendirse a un
objeto vacío. Si justo después el `fetchData` asíncrono de `openLigaExt`
fallaba (red móvil intermitente, documentada por todo este proyecto), la
semilla vacía quedaba plantada en firme — sin que nada volviera a preguntar
al servidor — y el usuario veía 0 PJ aunque el servidor SÍ tuviera la
clasificación simulada de la última vez.

**Fix** (`misc_body_1.html`): nuevo helper compartido
`window._lextSeedRecoverFromServer(slug)` que replica el MISMO XHR síncrono
de `loadData()` (GET a `/api/liga-ext/<slug>`, con fallback a
`/api/liga-ext-protected/<slug>`). `_ensureExtraLeagueSeed` y
`_ensureRestoMundoSeed` lo consultan justo ANTES de sembrar vacío (después
de agotar `_protected`/`_snap_*` locales): si el servidor trae equipos
(con o sin resultados), se adoptan vía `_lextAdoptServerSeedRecovery`
en vez de sembrar la plantilla en blanco. Solo se ejecuta en el caso raro
«ni local ni sus copias durables tienen NADA» — en el caso normal
(`hasTeams===true`) el seed sigue devolviendo de inmediato sin tocar red.

**Reglas a respetar**:
10. **PROHIBIDO** que el "ensure seed" de una liga auto-sembrada (las 4
    actuales, o una 5ª futura) escriba una plantilla vacía sin antes
    intentar `_lextSeedRecoverFromServer(slug)` cuando local no tiene
    nada. Es la MISMA red que ya protege a las ~50 ligas normales vía
    `loadData()` — estas 4 no pueden tener una recuperación más débil.
11. **PROHIBIDO** que `_lextSeedRecoverFromServer` sea asíncrono/fire-and-
    forget: tiene que resolver ANTES de que el seed decida escribir vacío,
    igual que los XHR síncronos de `loadData()`. Solo corre en el caso
    raro de local totalmente vacío, así que el coste (1-2 XHR bloqueantes)
    es aceptable y no afecta el boot normal.

## Plantilla de selecciones — sync que NO pierde datos + sin «Pacífico» (obligatorio, 2026-06-02)

**Bug (foto usuario 2026-06-02)**: en «🌐 Plantilla de selecciones»
(editor en `misc_body_1.html`, IIFE `KEY='selecciones_squad_v1'`) las
selecciones, medias y jugadores que añadían el usuario **o su amigo
desde otro dispositivo** se BORRABAN al recargar. Además el picker de
continente seguía mostrando «🌎 Pacífico», un continente ya eliminado.

### Causa raíz (datos que «se borran»)

1. `_boot()` hacía un GET al servidor y **PISABA ciegamente**
   `localStorage` con `j.value` (`localStorage.setItem(KEY, …)`). Si el
   servidor venía con MENOS selecciones (POST anterior perdido en red
   móvil, GET stale anterior al POST, o edición concurrente del amigo),
   la plantilla local recién editada se perdía.
2. `_save()` era fire-and-forget sin reintentos: un POST perdido dejaba
   el servidor con datos viejos para siempre.

### Fix — FUSIÓN local∪servidor (nunca borra) + POST con reintentos

- **`_mergeTeamsForSync(localTeams, remoteTeams)`**: unión por nombre
  canónico (`_selCanon`). En conflicto (mismo nombre en ambos lados)
  gana `updatedAt` más reciente; a igualdad, el más «rico»
  (`_teamRichness`: nº de jugadores + datos). **NUNCA elimina una
  selección local.** Conserva el orden local y añade al final las
  selecciones que solo estaban en el servidor.
- **`_collect()`** sella `updatedAt: Date.now()` en cada selección al
  guardar → los conflictos se resuelven por recencia (la última
  edición gana, propagación correcta entre dispositivos).
- **`_boot()`** FUSIONA en vez de pisar; si la fusión añade algo que el
  servidor no tenía, re-sube (unión, nunca borra del servidor) para que
  el otro dispositivo lo reciba. Converge (no hace loop).
- **`_post(d, tries)`** reintenta el POST hasta 3× con backoff.
- **`_save` = push autoritativo** (respeta borrados en el mismo
  dispositivo). **`_boot` = pull aditivo** (nunca pierde lo local).

### Continentes — «Pacífico» ELIMINADO

Los 4 continentes del juego son `europa` 🇪🇺 · `america` 🌎 · `asia` 🌏
· `africa` 🌍 (`_SEL_CONTS`). El antiguo `pacifico` (unía América +
Asia + Oceanía) está **eliminado**: `_normCont(v)` lo migra a `''` (sin
continente) en carga (`_dedupeStored`/`_hydrate`), guardado
(`_collect`) y fusión. El usuario reasigna esas selecciones a 🌎 América
o 🌏 Asia a mano. Se borró `_SEL_CONT_LEGACY` y la rama `pacifico` de
`_contOrderIndex`.

### Reglas a respetar

1. **PROHIBIDO** volver a pisar `localStorage` con el GET del servidor
   en `_boot` sin fusionar. La hidratación de selecciones SIEMPRE es
   unión que conserva lo local (es lo que evita el «se borran»).
2. **PROHIBIDO** reintroducir `pacifico` (ni en `_SEL_CONTS`, ni en
   labels, ni en el picker). `_normCont` debe seguir mapeándolo a `''`.
3. **PROHIBIDO** dejar `_save` sin reintentos de POST (la red móvil
   pierde requests y eso reintroduce el bug).
4. Toda selección recolectada debe llevar `updatedAt` para que la
   fusión resuelva conflictos por recencia.

## Wild Card + Open Qualifier — FASE DE GRUPOS (obligatorio, 2026-05-30)

Petición usuario 2026-05-30: la **Wild Card** (`s-wild-card`,
"UCL · Wild Card") y el **Open Qualifier** (`s-open-qualifier-clas`)
dejan de ser eliminatorias y pasan a **fase de grupos**. La pantalla
muestra **SOLO las tablas de clasificación** (sin desplegar las
jornadas): al pulsar Simular se juega todo IA-vs-IA y se rellenan las
tablas.

### Wild Card (motor en `part2/misc_body_2.html`, IIFE `WC_*`)

- **72 equipos** (plazas ⚪️ por liga, puesto 12+, 1-2 cada una; zona
  `wildcard` de cada `ligaExt_*` vía `computeWildCardClassified` →
  `_computeQualifiedFromLeagues('wildcard')`, que ya emite `slots`
  equipos por liga). `POOL_TARGET=72`; se rellena con TBD si falta.
- **24 grupos de 3** (`WC_N_GROUPS=24`, `WC_PER_GROUP=3`). Reparto
  snake por poder + anti-mismo-país (`_distributeWcGroups`).
- Liguilla a **DOBLE ida y vuelta** (`WC_ROUND_TRIPS=2`): cada par
  juega 4 veces → **8 partidos por equipo, 12 por grupo**
  (`_simulateWcGroup`).
- Clasifica **solo el 1º de cada grupo** → **24 ganadores** →
  `wc_to_open_qualifier_v1` (`_persistWinners`, filtra TBD). El 2º y
  3º quedan eliminados.
- Botones: **🎲 Draw** sortea los 24 grupos (sin jugar), **🎮 Simular**
  juega las liguillas y rellena tablas, **♻️ Reset** limpia.

### Open Qualifier (motor en `misc_body_1.html`, IIFE `STORE_KEY='oq_simulation_v1'`)

- **112 equipos** = **88 directos** 🟡 (zonas `uclQual`) + **24** de la
  Wild Card. `computeOpenQualifierTeams` capa a 112, reserva
  `wcWinners.length`, `maxLeagues = 112 - reserved`.
- **28 grupos de 4** (`N_GROUPS=28`, `TEAMS_PER_GROUP=4`,
  `GROUP_LABELS` = A..Z, AA, AB). Round-robin ida+vuelta
  (`_simulateGroup`): **6 partidos por equipo, 12 por grupo**.
- Clasifica **solo el 1º** (`QUALIFY_TOP=1`) → **28** →
  `oq_to_previa_v1` (lo lee `computeUclPrevTeams`, count-agnóstico).

### Previa de Champions (motor en `part2/misc_body_2.html`, IIFE `WPREV_*`)

- **62 equipos** = **34 directos** 🟣 (zonas `uclPrev`) + **28** del
  Open Qualifier (vía `oq_to_previa_v1`). `computeUclPrevTeams` los
  une (dedupe). `POOL_TARGET=62`.
- **16 grupos** (`N_GROUPS=16` → 14 de 4 + 2 de 3, snake por poder +
  anti-mismo-país `_distributeGroups`). Liguilla a DOBLE ida y vuelta
  (`_simulateGroup`), IA-vs-IA. La UI muestra **SOLO tablas**.
- **CORTE GLOBAL** (`_globalRanking`): se ordena por **posición en su
  grupo → PTS → DG → GF → nombre** y se reparte:
  - **Top 12 → Champions** (`wprev_to_fase_grupos_v1`)
  - **13-34 → Europa** (22) (`wprev_to_europa_v1`)
  - **35-62 → Conference** (28) (`wprev_r1_to_conference_v1`)
  - Los 62 clasifican (12+22+28 = 62, ninguno eliminado). Los huecos
    TBD/placeholder NO se propagan a las fases finales.
- Botones: **🎲 Draw** sortea los 16 grupos, **🎮 Sim** juega las
  liguillas + aplica el corte, **♻️ Reset** limpia (`_resetEuropePoolFeeders('previa')`).
- **Sustituye** al formato R1 eliminatorias + Ronda Final + EXENTOS
  (ver sección "EXENTOS Previa Champions" más abajo, ya OBSOLETA).
- Las fases finales (UCL/UEL/UECL) consumen las 3 claves y rellenan a
  40 (`computeUcl/Uel/UeclClassified` + pad). Reparto emergente:
  28 directos + 12 Previa (UCL), 18 + 22 (UEL), 12 + 28 (UECL).
- Sin partidos humanos individuales: `_wprevPlayHumanMatch` /
  `_wprevSaveHumanResult` quedan como **no-ops** (compat con las
  llamadas `st.isWprev` del gm-modal/ml-card, que ya nunca se activan).

### Encaje global (objetivo del usuario)

`⚪️ WC 72→24 · 🟡 OQ 88+24=112→28 · 🟣 Previa 34+28=62 (12/22/28) ·
🔵 UCL 28+12=40 · 🟠 UEL 18+22=40 · 🟢 UECL 12+28=40`.

### Reglas a respetar

1. **PROHIBIDO** volver al bracket de Wild Card (4 semis + 18 RF), al
   OQ de 7×14 (top-5/35), ni a la Previa de R1 eliminatorias + Ronda
   Final + EXENTOS. Los tres son fases de grupos con SOLO tablas.
2. **PROHIBIDO** renderizar las jornadas/partidos individuales en
   `s-wild-card`, `s-open-qualifier-clas` ni `s-ucl-previa-clas`. Solo
   tablas de clasificación (petición explícita "sin que vengan las
   jornadas").
3. Los thresholds "done" de `s-champions` (`_wcDone` ≥20, `_oqDone`
   ≥24, `_wprevDone` = `phase==='done'`) son tolerantes a algún TBD;
   no subirlos a exactos.
4. Toda nueva edición debe mantener el cuadre
   72→24→112→28→62→(12/22/28); si cambia un número, actualizar el
   motor afectado + la leyenda visible.
5. **PROHIBIDO** que la Previa reparta menos de los 62 (todos
   clasifican). El corte es 12/22/28 sobre el ranking global, no por
   posición de grupo (un 1º de grupo puede caer a Europa si su
   ranking global es bajo).

### Tabla de coeficientes — plazas por defecto por liga (2026-05-30)

`window.LEAGUE_DEFAULT_ZONES` (en `misc_body_1.html`, justo tras
`DEFAULT_ZONES`) fija las plazas por defecto de cada liga según el
cuadro del usuario (🔵ucl 🟣uclPrev 🟠uel 🟢uecl 🟡uclQual ⚪️wildcard).
`window._zonesDefaultFor(slug)` = genérico `DEFAULT_ZONES` + override
de la liga.

- Lo consume `ensureConfig(data, slug)` (modal Reglas read + reset) y
  el seed `_seedLeagueDefaultZonesV1` (precarga las ligas ya sembradas
  que sigan en el genérico 1/1/1/1/1, sin pisar ediciones del admin).
- **España = `liga-ea-sports`** está en la tabla (🔵4 🟣1 🟠2 🟢1) pero
  sus plazas europeas entran por la pantalla manual "EA Sports → Europa"
  (está en `EUROPE_BLACKLIST` para el cómputo automático).
- Totales (incluida España): 🔵28 🟣34 🟠18 🟢12 🟡88 ⚪️72. Todo cuadra
  EXACTO: WC = 72 → 24 grupos de 3 sin hueco TBD.
  Aguas abajo: WC saca 24, OQ 88+24=112, Previa 34+28=62.
- `_fixupLeagueZonesV2` (flag `ftbol_league_zones_fix_v2`) re-aplica el
  cuadro CORREGIDO (Albania→🟣, Feroe/Malta→🟡3, Montenegro/Georgia→⚪️2,
  Bélgica/Turquía/Chequia/Grecia→🟣1) a navegadores que ya corrieron el
  seed v1 con los valores viejos — SOLO si la liga sigue en el valor
  viejo o genérico (nunca pisa edición manual). Idempotente.

  **⚠️ SUPERSEDE 2026-07-01 (tabla UNIFICADA, petición usuario, fotos
  "Wild Card 17/72" · "Open Qualifier 12/62 con TBD" · "Previa 12/62")**:
  el usuario entregó la lista completa y unificada de las 53 ligas +
  España (europa + ⚫ descenso). En esa lista **Bulgaria va en el bloque
  ⚪2** (medio, 17 ligas junto a Polonia/Noruega/Chipre/Austria/Escocia/
  Suecia/Croacia/Israel/Hungría/Ucrania/Serbia/Rumanía/Eslovenia/
  Azerbaiyán/Rusia/Eslovaquia) y **San Marino vuelve a ⚪1** (con Gales,
  bloque menor). El total de Wild Card se mantiene en 72 — Bulgaria pasa a
  ocupar el cupo extra que San Marino cubría desde 2026-06-13, no se
  reabre ningún hueco. **La prohibición "San Marino NUNCA vuelve a ⚪1"
  del párrafo anterior queda SUPERADA por esta reasignación** (San Marino
  ⚪1 + Bulgaria ⚪2 = mismo total 72 que San Marino ⚪2 + Bulgaria ⚪1).
  Además se añadió un ⚫ descenso PROPIO por liga (antes todas caían al
  genérico ⚫3 de `DEFAULT_ZONES`): la mayoría ⚫1, con ⚫2 en Inglaterra/
  Italia/Alemania/Francia/Portugal/Países Bajos/Bélgica/Turquía/
  Dinamarca/Suiza (y España ⚫2, manual). `_fixupLeagueZonesV3` (flag
  `ftbol_league_zones_fix_v3`) re-aplica Bulgaria/San Marino y siembra el
  ⚫ por liga en navegadores ya sembrados — SOLO si siguen en el valor
  VIEJO/genérico exacto (nunca pisa edición manual del admin). Idempotente.
  **PROHIBIDO** revertir este swap a la asignación 2026-06-13 (Bulgaria
  ⚪1 / San Marino ⚪2): es la MISMA suma total, pero la lista del usuario
  es la fuente de verdad por liga.
- **N. Irlanda + Montenegro — pre-seed de 20 equipos** (`_EXTRA_LEAGUE_SEEDS`,
  `_ensureExtraLeagueSeed`): sus zonas iniciales se leen de
  `_zonesDefaultFor(slug)` (= 🟡OQ2 ⚪️WC2). **PROHIBIDO** volver a
  hardcodear el genérico de liga menor (🟣1/🟡1/⚪️1, `desc:2`) en ese
  seed — descuadraba el bracket (Previa de más, OQ/WC de menos) y hacía
  que el usuario viera reglas "que no se guardaban" (los defaults del
  modal no coincidían con 'Restaurar por defecto'). Bug 2026-05-31, foto
  usuario. `_fixupExtraLeagueZonesV1` (flag
  `ftbol_extra_league_zones_fix_v1`) corrige navegadores ya sembrados con
  el valor malo — SOLO si la liga sigue en el valor mal-sembrado o
  genérico (nunca pisa edición manual). Idempotente.
- **PROHIBIDO** hardcodear plazas en builders nuevos: leer siempre de
  `data.config.zones` con fallback `window._zonesDefaultFor(slug)`.

### El reparto europeo se AUTO-hidrata — sin él, el admin tenía que añadir cada equipo a mano (obligatorio, 2026-07-02)

**Bug (fotos usuario 2026-07-02, "he tenido que añadir uno a uno
manualmente todos los equipos a competiciones europeas ya que no
funciona")**: las pantallas de Champions/Europa/Conference/Previa/Open
Qualifier/Wild Card/Recopa mostraban pools casi vacíos, así que el
admin acababa metiendo los 28+18+12+34+88+70+64 equipos a mano por el
inyector "EA Sports → Europa" (pensado SOLO para inyectar Liga EA
Sports, no como sustituto del cómputo automático de las ~50 ligas
externas).

**Causa raíz**: `_computeQualifiedFromLeagues` (fuente del reparto
automático) SOLO lee las `ligaExt_<slug>` que YA están en el
localStorage de ESE dispositivo — y esas solo se cargan al abrir cada
pantalla de liga una a una. El helper que ya existía para arreglar
esto (`_eurHydrateMissingLeagues`, trae del servidor las ligas que
faltan) estaba cableado ÚNICAMENTE a 2 botones manuales de admin
("📤 Enviar realidad de cada equipo a su Europa" / "♻️ Re-cuadrar
reparto europeo") — las pantallas reales (Open Qualifier, Wild Card,
UCL/UEL/UECL, Previa) nunca lo llamaban, así que sin pulsar esos
botones el pool automático seguía vacío.

**Fix** (`misc_body_1.html`, junto a `_eurHydrateMissingLeagues`):
`window._eurAutoHydrateAndRender()` llama a `_eurHydrateMissingLeagues`
en segundo plano — al boot (diferido 4 s) y al volver el foco a la
pestaña (throttle 5 min) — y, si trajo ligas nuevas, re-pinta
`buildOpenQualifierClas`/`_wcRender`/`buildUclGruposClas`/
`buildUelGruposClas`/`buildUeclGruposClas`/`buildUclPrevClas`. No toca
`europe_committed_v1` (si el admin congeló una snapshot manual, sigue
mandando); solo alimenta el cálculo EN VIVO. Idempotente y barato
cuando no falta nada.

**Reglas a respetar**:
1. **PROHIBIDO** que `_eurHydrateMissingLeagues` vuelva a estar cableado
   SOLO a botones manuales de admin. El reparto automático debe
   auto-sanarse sin que el usuario tenga que saber que ese botón existe.
2. **PROHIBIDO** que el auto-hidratado corra sin throttle (mínimo 5 min
   entre pasadas) — son hasta ~50 fetches, no debe dispararse en cada
   focus/render.
3. El inyector manual "EA Sports → Europa" sigue existiendo para su
   propósito original (Liga EA Sports, blacklisted del cómputo
   automático) — no es la vía para el resto de ligas.

### El informe de "Enviar realidad de cada equipo a su Europa" lista equipo + liga por competición (obligatorio, 2026-07-02)

**Petición usuario 2026-07-02**: tras simular todas las ligas y pulsar
"📤 Enviar realidad de cada equipo a su Europa", el admin solo veía un
`alert()` con TOTALES por competición (28/34/18/12/88/70). Sin los
NOMBRES no podía verificar el resultado contra la tabla oficial de
coeficientes (país → cuántas plazas 🔵🟣🟠🟢🟡⚪ le corresponden) para
detectar errores (un equipo mal clasificado, una liga con más/menos
plazas de las que le tocan).

**Fix** (`misc_body_1.html`, junto a `_doCommitEurope`):
`window._eurShowCommitReport(blob, recovered)` sustituye el `alert()`
por un overlay (`#eur-report-ov`) con las 6 zonas (Champions/Previa/
Europa League/Conference/Open Qualifier/Wild Card), cada una AGRUPADA
POR LIGA (`_eurLeagueLabel` resuelve el slug vía
`window.LEAGUE_DEFAULT_NAMES`, formato "País (Nombre liga)" — igual
formato que usa el admin al pegar la tabla de coeficientes) con el
conteo por país y el listado de equipos concretos debajo, para poder
comparar de un vistazo contra la tabla oficial. Fallback: si el overlay
falla por cualquier motivo, se conserva el `alert()` de totales
(catch), para no dejar al admin sin ningún feedback tras pulsar el
botón.

**Reglas a respetar**:
1. **PROHIBIDO** volver a un `alert()` de solo-totales como ÚNICA
   confirmación de "Enviar realidad…". El admin necesita ver equipo +
   liga para poder detectar errores, no solo el conteo.
2. **PROHIBIDO** que el informe oculte equipos: SIEMPRE lista TODOS los
   de cada zona (agrupados por liga), nunca trunca ni pagina.
3. Toda liga NUEVA que se añada a `LEAGUE_DEFAULT_NAMES` aparece
   automáticamente con su nombre bonito en el informe — no hardcodear
   nombres de liga en `_eurLeagueLabel`.

### El reset de pools europeos (WC/OQ/Previa) reintenta el POST al servidor (obligatorio, 2026-07-02)

**Bug (foto usuario 2026-07-02, "el Open Qualifier no funciona el
reset")**: `_resetEuropePoolFeeders` limpiaba localStorage al instante,
pero el POST que limpia el espejo del servidor (`/api/state` con las
claves a `''`, + `/api/kv/europe_committed_v1` a `null`) era
fire-and-forget con `.catch()` mudo, sin reintentos. En red móvil ese
POST se pierde con frecuencia; si se pierde, el server conserva el
blob viejo y el siguiente `hydrateFromServer()` — que dispara en CADA
`focus`/`pageshow`/`visibilitychange`, no solo al boot — lo restaura
sin más (no hay concepto de tombstone: `local===null` ⇒ "restaurar
siempre que el server tenga algo"). El reset se deshacía solo, en
silencio, en cuanto el usuario cambiaba de app o el móvil se bloqueaba.

**Fix**: `_postClearRetry(url, body, tries)` reintenta hasta 3 veces
con backoff exponencial (2 s/4 s/8 s, mismo patrón que
`_resetLigaServer`) tanto el clear de `/api/state` como el de
`/api/kv/europe_committed_v1`.

**Reglas a respetar**:
4. **PROHIBIDO** que un reset que limpia estado compartido (server)
   vuelva a un POST fire-and-forget sin reintentos. `hydrateFromServer`
   restaura ciegamente cualquier valor no vacío que el server conserve
   cuando el local está `null` — el POST de limpieza DEBE llegar.
5. Todo reset nuevo de pools europeos (o cualquier store en
   `SYNC_KEYS` de `misc_body_2.html`) que borre localStorage debe
   persistir el borrado en servidor con reintentos, no un fetch suelto.

### Open Qualifier y Wild Card NUNCA leen el inyector manual "EA Sports → Europa" (obligatorio, 2026-07-03)

**Bug (foto usuario 2026-07-03, "Wild Card 75/72")**: el admin había
metido a mano ~70 equipos en la sección Wild Card del inyector manual
"EA Sports → Europa" (workaround usado mientras el cómputo automático
estaba roto, ver sección "El reparto europeo se AUTO-hidrata" arriba).
Con el cómputo automático ya arreglado, la pantalla Wild Card mostraba
**75/72** — por encima del total oficial (72) — y el admin no sabía
qué equipos/países sobraban o faltaban.

**Causa raíz**: `computeWildCardClassified()` y
`computeOpenQualifierTeams()` llamaban a `_prependManualEa(arr, slug)`,
que prepone los equipos de `manual_ea_<slug>_v1` al pool automático con
dedupe SOLO por nombre EXACTO. Pero **España (Liga EA Sports) tiene
cupo 0 en ambas zonas** en la tabla oficial de coeficientes
(`LEAGUE_DEFAULT_ZONES['liga-ea-sports'].uclQual === 0` y
`.wildcard === 0`) — el cómputo automático YA cubre el 100% de las 88 /
72 plazas por sí solo. Los equipos manuales que sobrevivían de la época
en que el cómputo automático estaba vacío se SUMABAN encima (grafías
distintas para el mismo hueco de liga no dedupean) y el pool superaba
el total oficial — la Wild Card recorta silenciosamente a 72 por poder
(`_normalizePool`), así que el admin veía "75/72" sin saber cuáles 3
equipos se estaban descartando ni por qué.

**Fix** (`misc_body_1.html`): `computeWildCardClassified` y
`computeOpenQualifierTeams` YA NO llaman a `_prependManualEa` — ambas
zonas devuelven EXCLUSIVAMENTE `_computeQualifiedFromLeagues(...)`, que
por construcción nunca puede superar el total oficial (cada liga está
capada a su `zones.uclQual`/`zones.wildcard` exacto, que suman
88/72 respectivamente). La pantalla "EA Sports → Europa" ahora muestra
un aviso ámbar en las secciones Open Qualifier y Wild Card («España
tiene cupo 0 aquí — esta lista ya NO se usa en el cálculo») para que el
admin sepa que puede quitar esos equipos sin que afecte a nada — no se
borran automáticamente (son datos del usuario).

**Reglas a respetar**:
1. **PROHIBIDO** volver a llamar `_prependManualEa` desde
   `computeWildCardClassified`/`computeOpenQualifierTeams`. España
   tiene cupo 0 en ambas zonas por diseño — el inyector manual es SOLO
   para zonas donde España SÍ tiene plazas (`ucl`/`uclPrev`/`uel`/`uecl`).
2. **PROHIBIDO** quitar el aviso ámbar de la pantalla "EA Sports →
   Europa" en las secciones Open Qualifier/Wild Card mientras esas
   listas sigan existiendo en `manual_ea_uclQual_v1`/`manual_ea_wildcard_v1`
   — sin el aviso el admin no entiende por qué sus equipos "no hacen
   nada".
3. Si en el futuro España consigue plaza en Open Qualifier o Wild Card
   (cambio de la tabla de coeficientes), hay que revertir este fix
   (recuperar `_prependManualEa` ahí) Y quitar el aviso ámbar — no
   dejar el código a medias.

## Caja "Torneos de Verano · Estadísticas" — render no bloqueante + equipos vigentes (obligatorio, 2026-05-28)

**Bug (foto usuario 2026-05-28)**: con el Trofeo Joan Gamper a 46/48
partidos jugados, la pantalla `s-torneos-stats` ("Torneos de Verano ·
Estadísticas") se quedaba **congelada en el placeholder
"Calculando estadísticas…"** y nunca renderizaba.

### Causa raíz

El loop de `STATS_SCREENS` (IIFE en `misc_body_1.html` ~13180)
ejecutaba `syncLigaEaPlayerStats()` (= `rebuildPlayerStatsStore`,
**O(matches × events × competitions)**) de forma **SÍNCRONA ANTES**
de pintar el dashboard. Con muchos partidos el hilo se bloqueaba y
nunca se llegaba a `_lextBuildCompStatsDashboard`, así que la caja
seguía mostrando el HTML inicial "Calculando estadísticas…".

### Refuerzo (2026-05-28) — render-first + sync diferido

`_renderOne(cfg)` ahora:
1. **PINTA YA** desde el cache (`_paint(cfg)`, síncrono y rápido) ⇒ la
   caja JAMÁS se queda en "Calculando…".
2. **DIFIERE** el `syncLigaEaPlayerStats()` pesado a `setTimeout(0)` y
   **re-pinta** con datos frescos al terminar.

`_lextBuildCompStatsDashboard` envuelve `_lextStatsDashHtml` en
try/catch: si tira, pinta el estado vacío en vez de dejar el
placeholder. **PROHIBIDO** volver a ejecutar el sync pesado de forma
síncrona antes del primer paint de una pantalla de estadísticas.

### Equipos vigentes — la caja muestra SOLO los del torneo actual

Petición usuario: "las estadísticas de ese torneo solo con los
equipos que juegan ese torneo en ese momento". El store
`ef_player_stats_torneos_v1` ACUMULA jugadores de TODAS las ediciones
de torneos de verano jugadas alguna vez. La caja `s-torneos-stats`
ahora filtra (entrada `filterTeams:true` en `STATS_SCREENS`) a SOLO
los equipos presentes en los cfgs `tour_<id>_v1` de board `verano`
**vigentes** vía `window._torneosVeranoTeamSet()`:
- Escanea ids `{sct,pss,jg,asia,tx1..tx8}` (regex
  `/^tour_(sct|pss|jg|asia|tx\d+)_v1$/`) de `_TOUR_CACHE` + localStorage.
- EXCLUYE `mundial` (Mundialito Clubes → `s-mundial-stats`) y los
  slots de Selecciones `spv*`/`sfn*` (bucket `sel`).
- Si el set sale vacío (ningún cfg cargado todavía) NO filtra
  (preferimos mostrar algo a una caja en blanco).

`_lextBuildCompStatsDashboard(rootId, statsKey, teamFilterSet?)` acepta
un 3er arg opcional con el set de equipos; `_filterStatsByTeamSet`
hace el filtrado (match exacto + inclusión laxa de grafías). El
filtro refuerza además la regla CLUBES≠SELECCIONES (las selecciones
nunca están en `cfg.teams` de un torneo de verano).

### Reglas a respetar

1. **PROHIBIDO** revertir el render-first / sync diferido en
   `STATS_SCREENS._renderOne`. Es lo que evita el cuelgue.
2. **PROHIBIDO** quitar el try/catch de `_lextBuildCompStatsDashboard`
   que garantiza que el placeholder siempre se reemplaza.
3. **Toda nueva edición de torneo de verano** (nuevo slot, nuevo id)
   debe quedar capturada por `_torneosVeranoTeamSet` (añadir su id al
   regex / lista) para que sus equipos aparezcan en la caja.
4. El 3er arg de `_lextBuildCompStatsDashboard` es **opcional**: las
   demás pantallas (Recopa, USC, Inter, Mundial, SC, UCL, Superliga)
   lo llaman con 2 args y NO filtran. No cambiar esa firma.

### La caja `s-tour-stats` MERGEA SOLA — sin botón ▶️ manual (obligatorio, 2026-06-29)

**Bug (fotos usuario 2026-06-29, «Trofeo Joan Gamper · Estadísticas»)**:
una LIGA de 63 equipos (`format='league'`) con varios partidos jugados
(clasificación con PJ correctos) mostraba TODAS las categorías de
Estadísticas en «Sin datos todavía». El merge dependía de un botón ▶️
manual (PIN 747, `_tourStatsForceRefresh`, añadido 2026-06-08) que el
usuario no debería tener que pulsar.

**Fix**: el botón ▶️ se ELIMINÓ (`s-tour-stats-refresh` del markup). La
caja `s-tour-stats` AHORA MERGEA AUTOMÁTICAMENTE en cada apertura:
`_tourStatsPaint` ejecuta sola el pipeline completo que hacía el botón —
(1) `_selSquadHydrate` (nombres reales), (2)
`_tourBackfillActasFromResults(cfg, teams, true)` (regenera/MERGEA el
acta de cada partido solo-marcador desde su marcador + home/away;
RESPETA las actas con nombres reales que el humano jugó, no las pisa),
(3) `_tourCollectStatsForTour` (agrega los eventos por jugador/equipo de
TODAS las actas), y SOLO si eso vino vacío, (4) `syncLigaEaPlayerStats`
(rebuild del store persistido que lee el paso 6 del recolector) +
reintento. Todo DIFERIDO desde `_tourStatsOpen` (render no bloqueante:
skeleton primero, cómputo en `setTimeout`).

**Reglas a respetar**:
5. **PROHIBIDO** reintroducir un botón manual (▶️/PIN) para refrescar las
   estadísticas de `s-tour-stats`. La caja MERGEA SOLA en cada apertura
   vía `_tourStatsPaint`. `_tourStatsForceRefresh` queda como alias no-op
   (re-dispara el merge automático) por compat; no volver a gatearlo con
   `requireAdmin`.
6. **PROHIBIDO** que `_tourStatsPaint` salte el `_tourBackfillActasFromResults`
   con `force:true` en la apertura: es lo que rellena las actas de los
   partidos solo-marcador (IA-vs-IA simulados antes del motor de actas, o
   copias del servidor sin events) para que la liga grande no salga a 0.
   El backfill es ADITIVO (respeta los goleadores reales ya presentes).
7. El `syncLigaEaPlayerStats` (O(partidos × comps), pesado) solo corre
   como ÚLTIMO RECURSO cuando la lectura directa de `cfg.results` vino
   vacía — no en el camino común. No moverlo a incondicional (congelaría
   la apertura en torneos grandes).

### El backfill RE-HIDRATA el roster GENÉRICO numerado, no solo «Jugador A/B» (obligatorio, 2026-06-30)

**Bug (4 fotos usuario, «Trofeo Joan Gamper» liga 63 equipos)**: la caja
de Estadísticas mostraba a los equipos IA con nombres del roster genérico
(«Jugador 22 · ANTWERP», «Portero B · ARIS», «Jugador 10 · MACCABI»,
«Jugador 1 · GENK»…) en Goleadores / Portería imbatida / Tarjetas, aunque
esos equipos YA tenían su plantilla REAL. Los equipos cuya plantilla se
pegó antes de simular sí salían reales (Göztepe→Mateusz Lis,
Torino→Vlasic, Liverpool→Salah).

**Causa raíz**: el acta IA-vs-IA se persistió con el roster genérico de
`_lextBuildDefaultRoster` («Jugador 1..30» — dorsal NUMÉRICO) porque se
simuló ANTES de que el equipo tuviera plantilla real. El auto-backfill
(`_tourBackfillActasFromResults`, que `_tourStatsPaint` ejecuta con
`force` en cada apertura) DEBERÍA regenerar el acta vía
`genMatchEventsEnhanced` (resuelve la plantilla REAL desde `ligaExt_*`),
pero su detector `_bfIsRealName` usaba la regex `(?:jugador|portero)\s*[a-k]?$`
que SOLO reconocía las LETRAS A–K como placeholder — los números 1..30 del
roster por defecto se daban por «nombre real» → el acta nunca se
re-hidrataba.

**Fix** (`misc_body_1.html`, `_tourBackfillActasFromResults`):
- `_bfIsRealName` amplía la regex a `(?:[a-k]|ia|\d+)?$` → detecta TAMBIÉN
  «Jugador N» / «Portero N» (roster genérico) y «Jugador IA» como
  placeholder, sin marcar como placeholder ningún nombre real.
- El guard AUTO-HEAL deja de depender de `force`: un placeholder solo se
  pisa cuando la regeneración produce nombres REALES (`_bfActaHasReal`).
  Así un equipo que de verdad solo tiene el roster genérico NO churnea el
  acta/server (regeneraría otro placeholder); en cuanto la plantilla real
  está disponible, el acta se re-hidrata sola en la siguiente apertura.

**Reglas a respetar**:
8. **PROHIBIDO** que el detector de placeholder del backfill vuelva a
   reconocer SOLO las letras A–K: debe cubrir el roster genérico numerado
   («Jugador N» / «Portero N» de `_lextBuildDefaultRoster`) o las actas
   simuladas antes de tener plantilla real jamás se re-hidratan.
9. **PROHIBIDO** pisar un acta-placeholder con OTRO placeholder (ni
   siquiera en `force`): solo se re-hidrata si la regeneración da nombres
   REALES. Las actas VACÍAS (solo-marcador) sí se rellenan siempre.

## Mundial 2032 + cajas de stats que computan EN VIVO desde cfg.results (obligatorio, 2026-05-28)

**Bug (foto usuario 2026-05-28)**: el Mundial 2032 (Selecciones,
format `mundial-48`) TERMINADO (Egipto campeón, grupos 72/72, todas
las rondas KO jugadas) mostraba la caja `📊 ESTADÍSTICAS · TODAS LAS
FASES` con **"Estadísticas no disponibles."** — el mismo síntoma
(caja de stats vacía) que la de Torneos de Verano.

### Inventario de cajas de stats (auditoría 2026-05-28)

Dos familias según su fuente de datos:

| Familia | Cajas | Fuente | Render |
|---------|-------|--------|--------|
| **Cache** (`ef_player_stats_*_v1`) | Liga, Superliga, Copa, UCL/UEL/UECL, Recopa, USC, Inter, Mundialito Clubes, Torneos, SC | store en localStorage (lo rellena `rebuildPlayerStatsStore`) | `_lextBuildCompStatsDashboard` |
| **En vivo** (`cfg.results[].events`) | Mundial 2032 (`_mundialStatsHtml`), s-tour-stats per-torneo (`_tourCollectStatsForTour`), Segunda (`buildLigaStatsDashboard`) | eventos del propio cfg del torneo | agregador propio + `_lextStatsDashHtml` |

### Causas raíz de las cajas "en vivo" vacías

1. **`_mundialStatsHtml`**: usaba `_mundialAggregateStats`, que mapea
   el lado a/b del evento → nombre real vía `cfg.groupFixtures`. Si los
   fixtures no estaban construidos (se construyen lazy al render del
   torneo) Y el result no tenía `home`/`away`, hacía
   `if (!nameA || !nameB) return;` y **saltaba el partido entero** sin
   mirar `ev.realTeam`. Además, si `_lextStatsDashHtml` no estaba
   disponible mostraba el literal "Estadísticas no disponibles." en vez
   del mensaje vacío estándar, y NO tenía try/catch.
2. **`_tourCollectStatsForTour`** (caja `s-tour-stats`): leía SOLO
   `LIGA_PLAYER_MATCH_STORE` (memoria, NO se persiste) → **vacía tras
   recargar** la página aunque el torneo estuviera jugado.

### Refuerzo (2026-05-28)

Helpers nuevos (en el IIFE del motor `_tour*` de `misc_body_1.html`):
- **`_tourStatsFromCfgResults(cfg)`**: agregador GENÉRICO que usa los
  `home`/`away` que `_tourAttachActa`/`_tourSaveHumanResult` YA
  persisten en cada `cfg.results[mk]`, con fallback a `ev.realTeam`.
  Funciona para CUALQUIER formato y **sobrevive a recargas**. NO tiene
  el early-return que saltaba partidos.
- **`_statsFromStoreFilteredToTeams(storeKey, teams)`**: último recurso
  que lee el store persistido (`ef_player_stats_sel_v1` para mundial-48,
  `ef_player_stats_mundial_v1` para Mundialito) filtrado a los equipos
  del torneo.

`_mundialStatsHtml` ahora encadena fallbacks con try/catch:
`_mundialAggregateStats` → `_tourStatsFromCfgResults` →
`_statsFromStoreFilteredToTeams`, y si todo falla muestra el mensaje
vacío estándar ("Sin datos todavía"), nunca "no disponibles".

`_tourCollectStatsForTour` cae a `_tourStatsFromCfgResults(cfg)` cuando
el store en memoria está vacío (tras recarga).

### Reglas a respetar

1. **PROHIBIDO** que una caja de stats "en vivo" dependa de un único
   camino de agregación sin fallback. Toda caja que compute desde
   `cfg.results` debe encadenar `_tourStatsFromCfgResults` como red de
   seguridad (usa home/away + realTeam, sin early-return).
2. **PROHIBIDO** que `_tourCollectStatsForTour` u otra caja lea SOLO
   `LIGA_PLAYER_MATCH_STORE` (memoria volátil). Siempre con fallback a
   `cfg.results` persistido.
3. **PROHIBIDO** el literal "Estadísticas no disponibles." como
   estado vacío. Usar el mensaje estándar "Sin datos todavía — juega o
   simula partidos para ver estadísticas." y SIEMPRE envolver el render
   en try/catch para no dejar el placeholder colgado.
4. **Todo sim IA-vs-IA de torneo** debe adjuntar `events` +
   `home`/`away` al `cfg.results[mk]` vía `_tourAttachActa` (o
   `_tourSaveHumanResult` para humanos). Sin events no hay goleadores
   que mostrar — es la fuente única de las cajas "en vivo".
5. **El índice key→{home,away} de los agregadores DEBE reconstruir el
   fixture cuando falte** (bug Trofeo Joan Gamper 2026-06-27, foto
   usuario: torneo de verano `format='league'` con J1 jugada y la caja
   `s-tour-stats` en «Sin datos todavía»). `cfg.fixture` (liga) y
   `cfg.groupFixtures` (grupos) se construyen LAZY al renderizar la
   pantalla del torneo (`_renderLeague`/grupos). Si el usuario entra
   DIRECTO a Estadísticas, recarga, o el cfg llegó de otro dispositivo /
   del servidor con los resultados guardados SOLO-MARCADOR (sin
   `home`/`away`), no existen → sin ellos NINGÚN partido resuelve su
   equipo → caja VACÍA pese a haber partidos jugados. `groupFixtures` ya
   se reconstruía en `_tourBackfillActasFromResults`; faltaba reconstruir
   `cfg.fixture` (liga). Helper único `_tourEnsureLeagueFixture(cfg, tt)`
   (round-robin DETERMINISTA sobre el orden de `cfg.teams`, idéntico al
   de `_renderLeague` → las claves `<j>_<mi>` coinciden con `cfg.results`),
   usado por `_tourBackfillActasFromResults` Y `_mundialStatsRobustScan`.
   **PROHIBIDO** que un agregador de torneo lea `cfg.fixture`/
   `groupFixtures` SOLO si están presentes sin reconstruirlos: un cfg sin
   fixture (entrada directa, recarga, sync solo-marcador) vacía la caja.

### La caja `s-mundial-stats` (Mundialito Clubes) — RENDER-FIRST como el Mundial 2032 (obligatorio, 2026-06-09)

**Bug (fotos usuario 2026-06-09)**: con la fase de grupos del Mundialito
de Clubes jugada (goles visibles en la clasificación), la pantalla
`Mundialito Clubes · Estadísticas` (`s-mundial-stats`) se quedaba
**colgada en el placeholder "Calculando estadísticas…"** — no emergía
NI UNA estadística. La caja del **Mundial 2032** (Selecciones) sí
muestra todo al instante.

**Causa raíz — separate-screen vs inline**: el Mundial 2032 pinta su
caja de stats **INLINE y SÍNCRONA**: `_mundialGo('mundial','stats')`
llama a `_tourRender` DIRECTO (función plana) → `_mundialStatsHtml`
devuelve el HTML y se asigna `innerHTML` en el mismo tick. NUNCA
depende de timing. El Mundialito de Clubes usaba una pantalla SEPARADA
(`s-mundial-stats`) cuyo `_renderMundialitoStats` solo corría vía
disparos diferidos (`setTimeout` de `_mclSchedule`, wraps de
`window.go`, MutationObserver). El placeholder hardcoded
"Calculando estadísticas…" SOLO se reemplazaba si/cuando ese render
diferido llegaba a completar — y fallaba repetidamente (2026-06-01,
06-04, 06-09).

**Fix — copiar los 2 rasgos de fiabilidad del Mundial 2032**:
1. **RENDER-FIRST**: `_renderMundialitoStats` pinta el ESQUELETO de las
   11 cajas (`_mundialRenderStatsGrid({})`) de forma SÍNCRONA al entrar,
   antes de cualquier agregación. El placeholder "Calculando…" JAMÁS
   persiste, pase lo que pase con el cómputo. El cómputo PESADO
   (backfill + robustScan + fallbacks) se DIFIERE a `setTimeout(0)` en
   `_mclComputeAndPaint` (regla "render no bloqueante").
2. **INVOCACIÓN SÍNCRONA**: `_mclSchedule` llama a
   `_renderMundialitoStats()` SÍNCRONO en el mismo tick del clic (como
   `_mundialGo` → `_tourRender`), no solo vía `setTimeout`. + 2ª pasada
   a 260 ms tras la hidratación de plantillas.

**Reglas a respetar**:
5. **PROHIBIDO** que `s-mundial-stats` vuelva a depender SOLO de
   disparos diferidos (`setTimeout`/go-wrap) para matar el placeholder.
   `_renderMundialitoStats` debe pintar el esqueleto SÍNCRONO al entrar
   (render-first) y `_mclSchedule` invocarlo SÍNCRONO en el clic.
6. **PROHIBIDO** correr el cómputo pesado (`_mclComputeAndPaint`)
   síncrono ANTES del esqueleto: bloquea el hilo al abrir la caja. Va
   diferido a `setTimeout`, igual que `_tourStatsOpen` / `STATS_SCREENS`.

### TODA caja de stats tiene DOBLE DISPARO: observer + go-wrap (obligatorio, 2026-06-09)

**Petición usuario 2026-06-09**: «cada caja de estadísticas emergen con
los eventos de esa competición con doble disparo (observer + go-wrap /
render directo)». El síntoma "caja colgada en el placeholder"
(Mundialito) se debía a un ÚNICO disparo (MutationObserver) que, si no
saltaba, dejaba el placeholder para siempre. Las cajas que NUNCA
fallaron (Liga, Superliga) tienen DOS disparos independientes.

Inventario de disparos por caja (TODAS con doble disparo · auditado):

| Caja(s) | Render | Disparos |
|---|---|---|
| Liga EA (Liga+Copa+SC España) `s-liga-stats` | `buildLigaStatsDashboard` | go-wrap (3 pasadas) + DOMContentLoaded |
| Superliga `s-superliga-stats` | `build` | observer + go-wrap + DOMContentLoaded |
| Recopa · USC · Inter · Supercopa España (`STATS_SCREENS`) | `_lextBuildCompStatsDashboard` | observer + `_installStatsGoWrap` (go-wrap) + DOMContentLoaded |
| Champions · Europa · Conference | `_renderUcl/Uel/UeclStats` | observer + go-wrap (`_eurStatsWrap`) + DOMContentLoaded |
| Mundialito Clubes `s-mundial-stats` | `_renderMundialitoStats` | render-first + `_mclSchedule` síncrono + go-wrap + observer |
| Mundial 2032 (`mundial-48`) | `_mundialStatsHtml` | inline síncrono vía `_mundialGo`→`_tourRender` (render directo) |
| Selecciones ROAD / Rondas Finales (spv/sfn) + Torneos de Verano | `_tourCollectStatsForTour` | botón 📊 → `_tourStatsOpen` (render-first, render directo) |
| Segunda · 1ª RFEF | `renderStats` | render directo on-load + on-sim |

**Reglas a respetar**:
7. **PROHIBIDO** que una caja de stats dependa de UN SOLO disparo
   (solo observer, o solo go-wrap, o solo onclick). SIEMPRE observer de
   `.active` **+** wrap de `window.go` (o, si es inline, render directo
   vía `_tourRender`/`_tourStatsOpen`). El bundle re-define `window.go`
   tras evaluar el partial, así que el go-wrap se instala TAMBIÉN en
   `DOMContentLoaded` (no solo a parse-time).
8. Todo wrap de `window.go` lleva su FLAG propio (`_statsScreensWrap`,
   `_eurStatsWrap`, `_mclStatsGoWrap`…) para no re-envolverse y para
   COEXISTIR encadenando el `go` anterior. NUNCA pisar un wrap existente.
9. El render que dispara el wrap debe SIEMPRE asignar `innerHTML`
   (`_lextBuildCompStatsDashboard` lo hace con try/catch → estado vacío),
   nunca `return` antes de pintar dejando el placeholder.
10. **Toda comp NUEVA de SELECCIONES cuyo nombre empiece por «Road»**
    (Rondas Previas, board `sel-previa`) — y toda Ronda Final (board
    `sel-final`, salvo `mundial-48` que ya lo trae en su menú) — hereda
    AUTOMÁTICAMENTE el botón verde 📊 ESTADÍSTICAS vía `_tourStatsBtnHtml`
    en `_paintTourScreen`. No hardcodear por nombre; sale del board.

## Separación CLUBES vs SELECCIONES en estadísticas (obligatorio, 2026-05-27)

**REGLA BLOQUEANTE ABSOLUTA**: las **estadísticas de jugadores** del
**MUNDIALITO de CLUBES** (cfg.id `'mundial'`, slot built-in
`tour_mundial_v1`, format `groups-ko`) y las de los **Torneos de
Verano** (Trofeo Joan Gamper, Soccer Champions Tour, Premier Summer
Series, Asian Tournament, `tx1..tx8`) NO pueden contener jugadores
de SELECCIONES NACIONALES (Mundial 2032 / Rondas Previas /
amistosos de selección). Y viceversa.

### Por qué esta regla existe (bug 2026-05-27)

Captura usuario: `Torneos de Verano · Trofeo Joan Gamper ·
Estadísticas · Goleadores` mostraba:
1. Kylian Mbappe · FRANCIA — 4 goles
2. Jugador B · AL ITTIHAD CLUB — 3 goles
3. Rafael Borre · COLOMBIA — 3 goles
4. Moises Caicedo · ECUADOR — 3 goles
5. Inaki Williams · GHANA — 3 goles
6. Jugador B · HAITI — 3 goles

El leak ocurría porque `rebuildPlayerStatsStore` (Source 3, iteración
de `tour_*_v1`) clasificaba todo cfg con `id !== 'mundial'` al bucket
`torneos`. Los slots `spv1..spv10` (Rondas Previas) y `sfn1..sfn10`
(Rondas Finales) de Selecciones caían igual ahí.

### Reglas de clasificación canónica

| Cfg / matchKey                                  | Bucket          | Store                          | Pantalla            |
|-------------------------------------------------|-----------------|--------------------------------|---------------------|
| `cfg.id === 'mundial'` (Mundialito Clubes)      | `mundial`       | `ef_player_stats_mundial_v1`   | `s-mundial-stats`   |
| `cfg.id ∈ {sct,pss,jg,asia,tx1..tx8}`           | `torneos`       | `ef_player_stats_torneos_v1`   | `s-torneos-stats`   |
| `cfg.id ∈ {spv1..spv10,sfn1..sfn10}` o `format='mundial-48'` | `sel` | `ef_player_stats_sel_v1`       | (per-tour vía `s-tour-stats`) |
| matchKey con `tour_spv` / `tour_sfn`            | `sel`           | mismo                          | mismo               |
| matchKey con `cal-sel*` / `cal-mf-*`            | `sel`           | mismo                          | mismo               |

### Reglas a respetar

1. **PROHIBIDO** modificar el split de Source 3 en
   `rebuildPlayerStatsStore` para que vuelva a clasificar `spv*`/
   `sfn*` o cfgs `format='mundial-48'` al bucket `torneos`. La regla
   "Mundialito de Clubes = clubes / Mundial 2032 = selecciones, JAMÁS
   mezclar" es absoluta.
2. **PROHIBIDO** quitar el check temprano `tour_spv`/`tour_sfn` →
   `sel` de `_competitionFromMatchKey`. Sin él, los matches de
   Mundial 2032 abiertos vía `_tourOpenHumanMatch` (compKey
   `'torneo'` singular) y sus matchKeys (con `|torneos|`) caían a
   `torneos` por el match `tour_` o `|torneo|` de abajo.
3. **PROHIBIDO** dejar `if (!buckets[comp]) comp = 'liga';` sin
   normalización vía `_competitionFromMatchKey`. Los compKeys
   `'torneo'` (singular, Mundial 2032) y `'sel-fin'` (cal-mf-*)
   NO existen como bucket directo (`buckets.torneo` /
   `buckets['sel-fin']` son `undefined`) → caían a `liga`.
4. **Toda comp NUEVA** que añada un slot al motor `_tour*` con
   format de selecciones debe heredar la clasificación a `sel`
   (idealmente añadiendo su id al regex `^(spv|sfn|XXX)\d+$` y/o
   añadiendo su `format` a la detección por format).
5. La regla aplica igual al revés: las pantallas de Selecciones
   (s-tour-stats por cfg, o `s-sel-stats` si existe) NO deben
   recibir jugadores de clubes del Mundialito ni de Torneos de
   Verano. El mapeo es 1-a-1 por id de torneo.

## MISTERS_REGISTRY — fuente única canónica de humanos (obligatorio, 2026-05-27)

**Propuesta usuario 2026-05-27** (foto pantalla `👤 EQUIPOS` del menú
principal): cada caja del menú EQUIPOS mapea un **mister humano** a
**UN club** + **UNA selección**. Es la fuente de verdad para "quién
es humano esta temporada".

### Los 6 misters canónicos

| Pantalla (`screen`) | Club | Mister (emoji) | Selección |
|---------------------|------|----------------|-----------|
| `s-munich`   | Liverpool        | Toñín 💡  | Francia    |
| `s-arsenal`  | Arsenal          | Álvaro 🐭 | Brasil     |
| `s-madrid`   | Real Madrid      | Acsa 🔨   | Inglaterra |
| `s-atletico` | Atlético Madrid  | Isra ✏️   | Noruega    |
| `s-barca`    | FC Barcelona     | Ángel 😈  | Argentina  |
| `s-psg`      | PSG              | Izan 🦆   | España     |

Cada mister dirige **AMBOS** equipos: pulsando su caja del menú se
abre la pantalla con calendario + competiciones del club + la selección.

### Registry canónico

`window._MISTERS_HUMANOS` (definido en `misc_body_1.html`, IIFE
HUMANIDAD POR COMPETICIÓN, JUSTO antes de `SEL_COMPS`):

```js
var MISTERS_HUMANOS = [
  { id:'tonin',  emoji:'💡', mister:'Toñín',  club:'Liverpool',        seleccion:'Francia',    screen:'s-munich'   },
  { id:'alvaro', emoji:'🐭', mister:'Álvaro', club:'Arsenal',          seleccion:'Brasil',     screen:'s-arsenal'  },
  { id:'acsa',   emoji:'🔨', mister:'Acsa',   club:'Real Madrid',      seleccion:'Inglaterra', screen:'s-madrid'   },
  { id:'isra',   emoji:'✏️', mister:'Isra',   club:'Atlético Madrid',  seleccion:'Noruega',    screen:'s-atletico' },
  { id:'angel',  emoji:'😈', mister:'Ángel',  club:'FC Barcelona',     seleccion:'Argentina',  screen:'s-barca'    },
  { id:'izan',   emoji:'🦆', mister:'Izan',   club:'PSG',              seleccion:'España',     screen:'s-psg'      }
];
```

Es **HARDCODED**, **SÍNCRONO**, y NO depende de NADA externo:
- ❌ NO depende de hidratación de `selecciones_squad_v1`
- ❌ NO depende de flag `isHuman` en cfgs del torneo
- ❌ NO depende del DOM del menú EQUIPOS estar renderizado
- ❌ NO depende de fetch del servidor

### Helpers públicos (todos sync, todos infallible)

- `window._isHumanSeleccionCanonica(name)` → bool. ¿Es Francia/Brasil/…?
- `window._isHumanClubCanonico(name)` → bool. ¿Es Liverpool/Arsenal/…?
  Acepta alias legacy ("Bayern Munich" / "Bayern" / "LFC" → Liverpool).
- `window._mhFindMister(name)` → mister object o null. Útil para saber
  qué mister dirige al equipo.
- `window._mhSameMister(a, b)` → bool. ¿`a` y `b` los dirige el mismo
  mister? Ej: `_mhSameMister('Liverpool','Francia')` → true (Toñín).

### `isHumanInComp` consulta el registry primero

`isHumanInComp(name, comp)` ahora tiene una CAPA 0 antes que TODAS las
demás:

```js
window.isHumanInComp = function(name, comp){
  // CAPA 0 — MISTERS_REGISTRY (sync, hardcoded, infallible):
  if (SEL_COMPS[c] && _isHumanSeleccionCanonica(name)) return true;
  if ((EUR_COMPS[c] || DOM_COMPS[c] || c === 'superliga')
      && _isHumanClubCanonico(name)) return true;
  // CAPA 1+ — fallbacks asincrónicos (_esSelHumana, _hasHumanIcon, etc.)
  ...
};
```

Como TODOS los flujos del juego pasan por `isHumanInComp` (gracias a
las defensas previas), la CAPA 0 garantiza que el bug 2026-05-27
JAMÁS pueda reproducirse, incluso aunque el resto de capas estén
rotas.

## Detección de SELECCIONES humanas — fuente única `_esSelHumana` (obligatorio, 2026-05-27)

**REGLA BLOQUEANTE ABSOLUTA**: las **6 selecciones humanas canónicas**
(Francia 💡, Brasil 🐭, Inglaterra 🔨, Noruega ✏️, Argentina 😈,
España 🦆) DEBEN ser detectadas como humanas en TODOS los flujos del
proyecto que toquen partidos de selección, **independientemente de
cualquier estado asincrónico** (hidratación de `selecciones_squad_v1`,
flag `isHuman` en el cfg del torneo, fetch del servidor, etc.).

### Por qué esta regla existe (bug 2026-05-27)

El usuario reportó con captura "Liverpool/Francia · 03 May" que la
card "Próximo partido" del hub mostraba `🌍 SELECCIONES · JUGADORES
FUERA · CONTINUAR ▶` en lugar del partido real `Francia vs Rep.
Checa` (Mundial Grupo — J1). La causa raíz:

1. `_selPair` resolvía al humano con 2 pases: (1) `t.isHuman` flag, y
   (2) `isHumanInComp(name, 'mundial')`.
2. `isHumanInComp('Francia', 'mundial')` cae a `_hasHumanIcon` →
   `humanIcon('Francia')` → depende de `_SEL_HUMAN_ICONS` hidratado
   desde `selecciones_squad_v1`.
3. Si el admin no marcó Francia `isHuman:true` en el cfg del Mundial
   **Y** la hidratación async aún no había corrido al primer render,
   ambos pases fallaban → `_candidates` vacío → `_selPair` retornaba
   null → card del hub mostraba JUGADORES FUERA.
4. **Mismo bug afectaba a 6 sitios más en paralelo**: `_gmHumanInvolved`
   (cronómetro caía a IAIA 90s en vez de HvH 16.5min / HvIA 9.75min),
   `_mlTeamIsHumanEnd` (no se mostraba stats overlay obligatorio),
   `_mlTeamIsHuman` (sanciones mal aplicadas), `_mlPlayerValuationAjax`
   (auto-pick saltaba al jugador del rival), `athRivalIsHuman` (PI
   médicos incorrectos), `_psTeamIsHumanGeneric` (auto-sim fase previa).

### Fuente única canónica

`window._esSelHumana(name)` (definido en `static/js/index.bundle.js`
en el bloque IIFE SANCIONES + LESIONES — SELECCIONES NACIONALES):

```js
var SEL_HUMANAS = ['Francia','Brasil','Inglaterra','Noruega','Argentina','España'];
function esSelHumana(name){
  // Normaliza (sin tildes, lowercase) y compara contra SEL_HUMANAS.
  // Fallback: `_SEL_HUMAN_ICONS` si el usuario añadió otras humanas
  // vía editor (selecciones_squad_v1.teams[].icon).
}
window._esSelHumana = esSelHumana;
```

Es **SÍNCRONO**, **NO depende de hidratación**, y la lista es
**HARDCODED** en el bundle.

### Defensas en capas (todas obligatorias)

1. **`isHumanInComp` parchado** (`misc_body_1.html`, IIFE HUMANIDAD POR
   COMPETICIÓN): para los comps de selección (`SEL_COMPS = {sel,
   sel-fin, mundial, torneo, mundial-48, selecciones}`), `isHumanInComp`
   consulta `_esSelHumana` ANTES que `_hasHumanIcon`. Así CUALQUIER
   código que use `isHumanInComp(name, 'mundial')` queda inmunizado de
   una vez sin tocar el call site.
2. **Pase 3 explícito en `_selPair` y `_findHumanTeam`**: belt-and-
   suspenders. Si el código itera cfg.teams en busca de humanos, tras
   los pases `isHuman` + `isHumanInComp`, hace un Pase 3 con
   `_esSelHumana`. Garantiza detección incluso si alguien rompe
   `isHumanInComp` en el futuro.
3. **`_psTeamIsHumanGeneric` con Pase 3**: el helper que clasifica
   teams como humanos en `_psListPendingGroupMatches` /
   `_psListPendingKoMatches` también añade fallback `_esSelHumana`.
4. **Watchdog + AUTO-HEAL en `_psRender`** (2026-05-27 → upgrade
   2026-05-28): cuando la card cae a JUGADORES FUERA en un día Mundial
   Selecciones (`ag-sel` + label contiene 'mundial') PERO existe un
   cfg mundial-48 con una selección humana canónica en `cfg.teams`,
   ADEMÁS del `console.warn` diagnóstico, el watchdog **reconstruye
   automáticamente** todo el estado del Mundial vía
   `_psEnsureMundialStateRebuilt()` y **reintenta `_selPair` SOLO**,
   sin que el usuario tenga que pulsar 🔍 RECUPERAR PARTIDO. Esto hace
   que esta CLASE de fallo (card JUGADORES FUERA falsa con humana
   canónica) se arregle **para siempre de forma automática**, sin
   tocar código. Guard anti-bucle: `st._psAutoHealSig === sig` →
   auto-heal corre como mucho UNA vez por día. Si tras reconstruir
   `_selPair` sigue null, cae a `_cardRest` (con el botón manual de
   respaldo). **PROHIBIDO** degradar el watchdog a solo-warn otra vez:
   el auto-heal es lo que evita que el usuario tenga que reportar
   capturas y pagar código por cada regresión.
   - `_psEnsureMundialStateRebuilt()` (núcleo común, idempotente y
     barato): (1) `_selSquadHydrate`, (2) `_invalidateHumanTeamCache`,
     (3) `_tourLoadCachedSync` de todos los slots Mundial, (4)
     construye `cfg.groupFixtures` (vía `window._mundialGroupState`,
     el MISMO builder de la pantalla del torneo) + chain de brackets
     KO (`_psAutoChainBuildMundial`) en cada cfg mundial-48, y
     persiste lo que cambie. Lo usan el AUTO-HEAL del watchdog Y el
     botón manual `_recoverSuspiciousRest`.
   - **Root cause 2026-05-28**: `cfg.groupFixtures` solo se construía
     (lazy) al renderizar la pantalla del torneo (`_mundialGroupState`).
     La card del hub (`_selPair → _resolveForHuman`) los necesita para
     localizar el partido del humano; sin ellos devolvía null →
     JUGADORES FUERA. Fix: `_selPair` ahora los construye+persiste
     ANTES de resolver (mismo builder canónico), y el auto-heal los
     reconstruye si por cualquier vía futura faltaran.
5. **Botón `🔍 RECUPERAR PARTIDO` en `_cardRest`** (2026-05-27,
   propuesta usuario): si la card cae a JUGADORES FUERA pero el scan
   `_scanForCanonicalMundialMatch` detecta que SÍ hay cfg mundial-48
   con humana canónica, el botón `CONTINUAR ▶` se reemplaza por:
   - Aviso ámbar `⚠️ Hay partido programado para <Selección> pero la
     card no lo detectó`.
   - Botón principal `🔍 RECUPERAR PARTIDO` que dispara la cascada:
     (1) `_selSquadHydrate()` (re-cargar selecciones_squad_v1),
     (2) `_invalidateHumanTeamCache()` (limpiar caché),
     (3) `_tourLoadCachedSync` para TODOS los slots,
     (4) `_psAutoChainBuildMundial` (construir brackets KO pendientes),
     (5) scan diagnóstico loggeado en consola,
     (6) `_psRender()` forzado (limpia sig de idempotencia),
     (7) si tras 200ms sigue en JUGADORES FUERA, toast/alert con
         info diagnóstica al usuario.
   - Botón secundario pequeño `CONTINUAR ▶ (saltar día)` para mantener
     la opción legacy si el usuario decide ignorar la recuperación.

   Es la última línea de defensa USER-FACING: si todas las capas
   internas fallan, el usuario tiene un botón visible para forzar la
   recuperación sin recargar la página.

### Reglas a respetar (PROHIBICIONES)

1. **PROHIBIDO** crear código nuevo que detecte humanos de selección
   usando SOLO `t.isHuman` (flag del cfg). Siempre añadir fallback
   `_esSelHumana(t.name)`.
2. **PROHIBIDO** usar SOLO `isHumanInComp` sin entender que para SEL_COMPS
   YA incluye `_esSelHumana`. Para comps que NO están en SEL_COMPS pero
   donde pueden aparecer selecciones (eventos custom), añadir el fallback
   explícito en el call site.
3. **PROHIBIDO** quitar la lista hardcoded `SEL_HUMANAS` o eliminar
   `_esSelHumana` del bundle. Es la última línea de defensa.
4. **PROHIBIDO** añadir selecciones nuevas a `SEL_HUMANAS` sin avisar
   al usuario explícitamente. Las 6 son canónicas (2026-05-24). Si
   el admin marca otras como humanas vía editor, se reconocen vía
   `_SEL_HUMAN_ICONS` automáticamente.
5. **PROHIBIDO** quitar SEL_COMPS de `isHumanInComp` o reordenar el
   chequeo para que `_hasHumanIcon` se ejecute ANTES de `_esSelHumana`
   — eso reintroduce el race con la hidratación.
6. **PROHIBIDO** silenciar / borrar el watchdog en `_psRender`. Es la
   herramienta que descubrirá la próxima regresión sin que el usuario
   tenga que reportar otra captura.
6b. **PROHIBIDO** quitar el botón `🔍 RECUPERAR PARTIDO` de `_cardRest`
   o cambiar su keyword sin acuerdo con el usuario. La keyword
   "RECUPERAR PARTIDO" fue elegida por el usuario para que cuando vea
   la card JUGADORES FUERA en un día con partido, pulse el botón y la
   web auto-diagnostique + auto-recupere sin que él tenga que
   investigar manualmente.
7. **Toda comp NUEVA** donde puedan aparecer selecciones (Eurocopa,
   Copa América, Confederaciones, amistosos de selección, etc.) debe
   añadirse a `SEL_COMPS` Y, si tiene su propio flujo de detección de
   humanos, también heredar el Pase 3 `_esSelHumana`.

### Resumen visual

```
┌─────────────────────────────────────────────────────────────────┐
│ Hub Liverpool/Francia → card "Próximo partido" 03 May          │
│ ├─ day.cls = 'ag-sel'  +  label = 'Mundial Grupo — J1'         │
│ ├─ _selPair(day)                                                │
│ │   ├─ Pase 1: t.isHuman                          ← admin manual│
│ │   ├─ Pase 2: isHumanInComp(name,'mundial')      ← SEL_COMPS  │
│ │   │            → _esSelHumana   ← BLINDAJE 1   │              │
│ │   └─ Pase 3: _esSelHumana(t.name) directo       ← BLINDAJE 2  │
│ ├─ Si TODOS los pases fallan:                                   │
│ │   └─ Watchdog scan: ¿hay humana canónica en algún cfg?       │
│ │       → console.warn loud                       ← BLINDAJE 3  │
│ │   └─ _cardRest detecta SOSPECHA y muestra botón              │
│ │       🔍 RECUPERAR PARTIDO en vez de CONTINUAR ▶ ← BLINDAJE 4 │
│ └─ Render: Francia vs Rep. Checa  (NUNCA JUGADORES FUERA)      │
└─────────────────────────────────────────────────────────────────┘
```

## Jornada / ronda CUMPLIDA → cabecera GRIS (obligatorio, 2026-05-27)

Cuando una jornada de grupo o una ronda KO tiene **TODOS** sus
partidos jugados (con resultado `played === true`), el botón de
cabecera de esa jornada/ronda (`.jbtn` en `.jblock`) debe salir en
**color gris** para distinguirla de las que aún están pendientes.

Aplica a **todas** las competiciones que rinden con el patrón
`.jblock + .jbtn.c-<comp>`:

| comp class       | done style                  | dónde lo añade el JS                                                   |
|------------------|------------------------------|------------------------------------------------------------------------|
| `c-mundialito`   | gris (regla CSS bloqueante)  | _tour engine (Mundialito Clubes)                                       |
| `c-mundial`      | gris (regla CSS bloqueante)  | `_mundialGroupsHtml` (jornadas de grupo) + `row()` de `_mundialKoHtml` (rondas KO) en `misc_body_1.html` |
| `c-superliga`    | oro/trofeo (excepción)       | `s-superliga-clas.html` + `part2/misc_body_2.html` — color de campeón, NO se gris-ifica |

Las reglas CSS gris viven juntas en
`templates/partials/misc_body_1.html` (~líneas 12190-12215), bloque
"Jornada YA JUGADA → botón gris". La gradiente gris es:
```
linear-gradient(90deg,#1a1d22,#2a2e36,#3a3e48,#2a2e36,#1a1d22)
```
con borde `rgba(170,180,195,.45)`, `filter:grayscale(.5) brightness(.85)`
y `color:rgba(255,255,255,.55)`.

### Cómo detectar "todos los partidos jugados"

El JS construye el botón con la clase `done` cuando todos los partidos
de esa jornada / ronda están con resultado. Ejemplos canónicos:

```js
// _mundialGroupsHtml: jornada de grupo
var allDone = true;
jor.forEach(function(_, mi){
  var r = (cfg.results[gKey+ji+'_'+mi]||{});
  if (!r.played) allDone = false;
});
html += '<button class="jbtn c-mundial' + (allDone ? ' done' : '') + '" ...>';
```

### Reglas a respetar

1. **Toda nueva competición** que use el patrón `.jblock + .jbtn.c-<comp>`
   en una pantalla de torneo (`s-<comp>-clas`, `s-<comp>-stats`,
   pantalla del hub `_tour*`, etc.) DEBE:
   - Añadir la clase `done` al `.jbtn` cuando todos los partidos de la
     jornada/ronda estén jugados.
   - Tener su regla `.jbtn.c-<comp>.done` en el bloque CSS gris (o
     reutilizar las existentes si comparte gradient base).
2. **PROHIBIDO** dejar una jornada cumplida con la cabecera del color
   activo de la comp (rojo Liga, rosa Mundial-48, etc.). Eso confunde
   al usuario sobre qué jornadas siguen pendientes.
3. **PROHIBIDO** eliminar la regla `.jbtn.c-mundial.done` /
   `.jbtn.c-mundialito.done` sin reemplazo equivalente. El base color
   de `c-mundial` (`#5a0030 → #c8205a` en `static/css/index.bundle.css`)
   usa `!important`, así que la regla `.jbtn.c-mundial.done` también
   debe llevar `!important` para ganarle (especificidad 0,3,0 vs 0,1,0).
4. **Excepción documentada — Superliga**: el "done" de Superliga
   (`#s-superliga-clas .jbtn.c-superliga.done` en
   `part2/misc_body_2.html:873`) usa gradient **oro/trofeo** en lugar
   de gris. Es intencional (decisión de diseño previa, color trofeo
   `#F1C40F`). NO modificar sin acuerdo con el usuario.

### Histórico

- 2026-05-27: usuario reporta foto del Mundial 2032 (Grupo A:
  Filipinas/Senegal/Kuwait/Jordania) con J1 y J2 cumplidas saliendo
  en color rosa/magenta pese a tener todos los partidos con FIN. El
  JS ya añadía la clase `done` (líneas 20392 y 20643 de
  `misc_body_1.html`) pero faltaba la regla CSS
  `.jbtn.c-mundial.done`. Añadida al bloque junto a
  `.jbtn.c-mundialito.done` (líneas 12200-12215).

## Mundialito de Clubes — diseño AMARILLO + flujo Resto del Mundo (obligatorio, 2026-05-27)

El **Mundialito de Clubes** vive en el slot built-in `'mundial'` del
motor `_tour*` (NO confundir con `mundial-48`, que es Mundial 2032
de selecciones). Spec canónica (CLAUDE.md regla bloqueante):

- **32 equipos** = 16 europeos (admin elige MANUALMENTE) + 16 de la
  liga `ligaExt_resto-mundo` (TOP 16 automáticos tras los 42 partidos).
- **Format**: `'groups-ko'` con `formatConfig.groups=8`, `perGroup=4`,
  `advancePerGroup=2`, `koRounds=['Octavos','Cuartos','Semis','Final']`.
- **Top 2 de cada grupo** → Octavos (16 equipos). Octavos → Cuartos →
  Semis → Final, todo a **PARTIDO ÚNICO con ET + penaltis** (`koExtraTimePens:true`).
- **NO hay 3er/4º puesto.** Solo 4 rondas KO.
- **No excluye ligas**: cualquier equipo europeo (cualquier liga) puede
  ser elegido por el admin como uno de los 16 europeos.
- **Humanos**: los marca el admin manualmente al lanzar el torneo
  (igual que Superliga). Cualquier humano puede ser elegido para el
  Mundialito independientemente de los humanos canónicos de Liga EA.
- **Frecuencia**: lo lanza el admin desde la pantalla Resto del Mundo
  (`s-lext` con `slug==='resto-mundo'`) cuando los 42 partidos están
  completos. El motor NO lo arranca solo cada N temporadas — es
  bajo demanda.

### Color visual: AMARILLO `#ffd633` (no azul cobalto)

Petición usuario 2026-05-27. El Mundialito tiene **el mismo formato
visual que el Mundial 2032** (mismas cards `.mn-card`, mismo layout
de grupos + KO, mismas tablas de clasificación) **pero en amarillo**
en lugar de azul cobalto + dorado.

Ubicación de los overrides amarillo (`#ffd633`):

1. **`#s-mundial .tour-group-block`** (CSS scopeada): grupos en
   gradiente amarillo `#2a1f00 → #5a4408 → #1a0f00` con borde
   `rgba(255,214,51,.55)`.
2. **`.mn-card[data-tour="mundial"]`** (selector per-card via
   `data-tour` que `_koRowHtml` añade): cards KO en amarillo, sin
   afectar a Mundial 2032 (sfn*) ni a otros torneos (jg/asia/sct/pss).
3. **Hub `s-mundial-clubes`** (5 cajas): clase **`c-mundialito`**
   (NO `c-mundial`) con gradiente amarillo. La clase `c-mundial`
   sigue siendo cian/turquesa para Mundial 2032 calendar slots.
4. **gm-modal**: clase **`is-comp-mundialito`** con
   `--comp-color:#ffd633`. La detecta `_gmCompFromState` cuando
   `g._tourId === 'mundial'` (override ANTES de la rama 'torneo'
   genérica que daría violeta).

### Slots del calendario (calendario.json + s-calendario.html)

Las 7 fechas FIJAS del Mundialito en `calendario.json` (icon `🌐` →
clase `ag-inter`):

| Fecha     | event.name                      | Slot s-calendario.html |
|-----------|---------------------------------|------------------------|
| 04 Jul    | Mundialito Clubes - J1          | `cal-mc-g1`           |
| 08 Jul    | Mundialito Clubes - J2          | `cal-mc-g2`           |
| 12 Jul    | Mundialito Clubes - J3          | `cal-mc-g3` (🌧)       |
| 16 Jul    | Mundialito Clubes - Octavos     | `cal-mc-oct`          |
| 20 Jul    | Mundialito Clubes - Cuartos     | `cal-mc-cua`          |
| 24 Jul    | Mundialito Clubes - Semis       | `cal-mc-sf`           |
| 28 Jul    | Mundialito Clubes - FINAL       | `cal-mc-fin`          |

**Conflicto con Mundial 2032 selecciones**: las fechas 04 Jul, 08 Jul,
12 Jul, 20 Jul COINCIDEN con `cal-mf-g3`, `cal-mf-g4`, `cal-mf-rep`,
`cal-mf-fin` (Mundial 2032 grupos J3/J4 + Repesca + FINAL). Asumimos
que **NUNCA se juegan ambos torneos la misma temporada** (cada uno
ocupa una temporada distinta del ciclo de 4 años). Si en el futuro
sí coexisten, habrá que mover las fechas o desolapar.

### Mapeo en `_realPair` (regla bloqueante CLAUDE.md)

`_realPair` detecta los días del Mundialito por la clase `ag-inter`
+ etiqueta `Mundialito Clubes - ...`, fuerza `tid='mundial'`
LOCALMENTE (sin persistir en `d.tour`) y mapea la etiqueta a
`_dayPartidoN`:

- `Mundialito Clubes - J1/J2/J3` → `_dayPartidoN = 1/2/3` → cj=0/1/2
- `Mundialito Clubes - Octavos` → `_dayPartidoN = 4` → _dayInKo, koIdx=0
- `Mundialito Clubes - Cuartos` → `_dayPartidoN = 5` → koIdx=1
- `Mundialito Clubes - Semis`   → `_dayPartidoN = 6` → koIdx=2
- `Mundialito Clubes - FINAL`   → `_dayPartidoN = 7` → koIdx=3

(`grpJors=3` fijo: 4 equipos × round-robin single-leg = 3 jornadas.)

`_cardMatch` también reconoce `_isMundialitoCalDay` (mismo regex) y
fuerza `tourNm = 'Mundialito de Clubes'` en el título de la card.

### Reglas a respetar

1. **PROHIBIDO** renombrar el tourId built-in `'mundial'` o cambiar
   su `format` a algo distinto de `'groups-ko'`. El motor entero
   (CSS, `_realPair`, calendario, hub, gm-modal) depende de esto.
2. **PROHIBIDO** usar la clase `c-mundial` en cualquier card NUEVA
   del Mundialito de Clubes — usar `c-mundialito`. `c-mundial` está
   reservada para Mundial 2032 selecciones (cyan/turquesa).
3. **PROHIBIDO** modificar `data-tour="mundial"` en `_koRowHtml`. Es
   el marker que pinta las cards KO en amarillo via
   `.mn-card[data-tour="mundial"]`.
4. **PROHIBIDO** persistir `d.tour='mundial'` desde `_realPair` en
   días Mundialito. El override es LOCAL al call — el flag
   `_isMundialitoDay` gates el bloque de persistencia.
5. **PROHIBIDO** caer al placeholder `_cardNonTour` en días
   Mundialito. `_cardMatch` debe detectar `_isMundialitoCalDay` y
   rutear al flow de torneo igual que `ag-torneo`.
6. **Si el admin no ha lanzado el torneo** (cfg `mundial` con teams
   vacíos), `_realPair` devuelve null para días Mundialito → la card
   del hub muestra CONTINUAR ▶. NO se inventa partido fantasma.
7. **Toda comp NUEVA cuyas filas usen `ag-inter`** (icono 🌐) ya
   queda enrutada a `_realPair` automáticamente — solo necesita su
   propia rama de parseo de `_dayPartidoN` y override local de `tid`.

## Card "Próximo partido" del hub: el CALENDARIO INDIVIDUAL es la única fuente de verdad (obligatorio, 2026-05-27)

**Principio bloqueante**: la card "Próximo partido" del hub Liverpool
(`#ps-stage` en `s-munich`) SIEMPRE deriva el rival a partir de la fila
actual del CALENDARIO INDIVIDUAL del Liverpool-Francia
(`_calRows()[d.dayIdx]`, las filas `.ag-r` del `#ag-content`). El label
de esa fila (`Partido N`, `Liga — J N`, `Copa — Ronda X`,
`Mundial Octavos`, `Champions — J3`, etc.) dicta qué partido se debe
mostrar, sin excepción.

### Por qué esta regla existe

Los cursores manuales (`d.tour`, `cfg.currentJornadaByGroup`,
`cfg.koCurrentRound`, `currentRound`…) **solo avanzan al pulsar
botones específicos** en la pantalla de cada torneo (🏆 J{N+1},
🏆 Avanzar KO, etc.). El usuario juega su partido desde la card del
hub directamente y NUNCA visita la pantalla del torneo, así que esos
cursores se quedan congelados en 0 → la card mostraba el mismo J1 los
días 08 Jun, 12 Jun, 16 Jun… (bug 2026-05-27 con foto Tigres UANL 1-2
Liverpool repitiéndose).

### Mapeo canónico (en `_realPair`)

1. Leer `d.dayIdx` y `_calRows()[d.dayIdx]`.
2. Extraer el número de la etiqueta:
   - Torneos de verano (JG/SCT/PSS/Asia): regex `Partido\s+(\d+)`.
     `Partido N` mapea a:
     - **Fase de grupos**: jornada `N-1` (0-indexed) de
       `cfg.groupFixtures[gIdx]` (override de `currentJornadaByGroup`).
     - **Fase KO** (si `koBracket` existe): ronda
       `N - groupJors - 1` de `cfg.koBracket` (override de
       `koCurrentRound`).
   - Liga EA Sports: regex `Liga\s*[—\-]\s*J(\d+)` → jornada de liga.
   - Otras competiciones: añadir su rama al parseo y mapeo cuando se
     incorporen.
3. Los cursores manuales (`currentJornadaByGroup`, `koCurrentRound`,
   `currentRound`) son **advisory** — solo se usan como fallback si
   el día actual no se puede derivar del calendario.

### Reglas a respetar

1. **PROHIBIDO** usar `cfg.currentJornadaByGroup[gIdx]` /
   `cfg.koCurrentRound` / `cfg.currentRound` como fuente PRIMARIA
   en la card del hub. Solo fallback cuando no hay día parseable.
2. **PROHIBIDO** crear cursores nuevos que requieran pulsar un botón
   para avanzar y luego usarlos en la card. Si una comp nueva añade
   esa lógica, se vuelve a hardcodear el bug.
3. **Toda comp nueva** que entre por `_realPair` / `_selPair` debe
   tener su rama en el parseo de "Partido N" / "J N" / "Ronda X" del
   calendario individual, ANTES de leer cualquier cursor del cfg.
4. **PROHIBIDO** introducir "auto-avance del cursor al jugar el
   partido" como alternativa a esta regla. Es un parche frágil: si el
   usuario pospone un día, los cursores y el calendario se vuelven a
   desincronizar. La regla `calendario = fuente única` es robusta
   por construcción.
5. **Fix de saves antiguos**: cuando un cfg legacy tenga cursores
   apuntando a una jornada distinta a la que demanda el calendario,
   `_realPair` ignora el cursor y respeta el calendario. La pantalla
   del torneo seguirá pintando el cursor (UI inconsistente con el
   hub si el usuario no pulsa "🏆 J{N+1}"), pero la card del hub
   siempre es correcta. Esto es aceptable — la card es lo crítico,
   la UI del torneo solo afecta a quien entre a la pantalla.

### Beneficios

- Estado-drift IMPOSIBLE: el calendario es inmutable per-temporada y
  todas las cards mapean determinísticamente.
- Funciona en cualquier dispositivo / sesión / hidratación parcial.
- No requiere que el usuario visite pantallas auxiliares para que la
  card del hub avance correctamente.
- Si una temporada futura cambia las fechas del calendario, todas las
  cards se reajustan automáticamente.

## Card "RIVAL PENDIENTE" en eliminatorias (obligatorio, 2026-05-26)

Cuando la card "Próximo partido" del hub Liverpool (`#ps-stage` en
`s-munich`) llega a una ronda KO de una eliminatoria
(Mundial selecciones, Mundialito Clubes, fases finales Champions/EL/
UECL, Recopa, Supercopas, Intercontinental, Copas, torneos de verano
con KO, etc.) pero el rival aún es TBD porque **la FASE PREVIA no se
ha simulado** (grupos pendientes o ronda KO N-1 pendiente), la card
muestra un estado de BLOQUEO en vez del legacy "JUGADORES FUERA ·
CONTINUAR ▶".

### Estado de bloqueo

- Banner ámbar `⚠️ RIVAL PENDIENTE — El admin aún no ha simulado <fase
  previa>. Avísale, o pulsa el botón para auto-simular los IA vs IA
  pendientes y desbloquear el sorteo.`
- Botón 📌 Posponer (top-left, igual que en cards normales): salta el
  día (no añade a PARTIDOS PENDIENTES porque no hay matchKey real).
- Botón principal `🤖 SIMULAR FASE PREVIA · +10 🪙` (turquesa): auto-
  simula los partidos IA-vs-IA de la fase previa con el motor 4-ejes,
  construye el bracket de la siguiente fase y RECOMPENSA al usuario
  con +10 🪙. La recompensa solo se acredita si se simuló ≥1 partido
  (idempotente — re-pulsar sin progreso no da más oro).

### Detección + sim (`misc_body_1.html`)

Helpers canónicos (IIFE PRETEMPORADA, líneas ~4100-4600):

- `_psDetectPendingPrevPhase(cfg, opts)`: detecta si la fase previa
  tiene partidos sin jugar. Recursa hacia atrás si la ronda previa
  tampoco existe (kb[N] empty → kb[N-1] empty → ... → groups empty).
- `_psListPendingGroupMatches(cfg, compKey)`: iteración round-robin
  de groupFixtures, devuelve `[{matchKey, home, away, hHuman, aHuman}]`.
- `_psListPendingKoMatches(cfg, koRoundIdx, bracketProp, compKey)`:
  iteración de pares del bracket. Marca `is2Leg` cuando el formato es
  `ko-2leg` para que la auto-sim los SALTE (el sim batched no replica
  la lógica IDA+VUELTA con desempate por gol visitante / penaltis).
- `_psAutoSimPendingPhase(tourId, pendingInfo)`: itera matches, sim
  solo IA-vs-IA (humanos sin tocar — cada humano debe jugar / posponer
  el suyo), persiste cfg con UN solo `_tourSave` final (batch).
  Devuelve `{simmed, humanRemaining}`.
- `_psBuildNextBracket(cfg, pendingInfo)`: tras la sim, construye el
  bracket de la siguiente fase (grupos → koBracket[0] para
  mundial-48 vía `_mundialQualifiers`; KO N → KO N+1 con
  `_tourRebalanceHumans`). Idempotente: salta si la fase aún tiene
  partidos pendientes.
- `_psAutoChainBuildMundial(cfg, tourId)`: chain-construye TODOS los
  brackets KO que se puedan construir (grupos → kb[0] → kb[1] → ...).
  Se llama al entrar a `_selPair` para sincronizar el estado sin que
  el usuario tenga que visitar la pantalla del torneo.
- `_cardPendingPrevPhase(day, info)`: renderiza la card de bloqueo
  + wire-up de POSPONER y SIMULAR FASE PREVIA.

### Reglas a respetar

1. **Los humanos NUNCA se auto-simulan.** `_psAutoSimPendingPhase`
   los cuenta como `humanRemaining`. Si el grupo / ronda contiene
   partidos con otro humano (Brasil, Inglaterra, Noruega, Argentina,
   España, o cualquier humano de club en otra eliminatoria), el botón
   sigue activo solo si quedan IA-vs-IA; cuando solo restan humanos,
   el botón desaparece y la card muestra "⏳ Quedan N partidos con
   humanos sin jugar."
2. **+10 🪙 fijos por desbloqueo**, NO por partido. Evita farmeo en
   torneos con 70+ partidos previos.
3. **Solo se acredita si `simmed > 0`.** Re-pulsar sin progreso
   (todos sim'd o humanos pendientes) no da oro, solo toast neutro.
4. **No reintroducir el legacy CONTINUAR ▶** sobre "JUGADORES FUERA"
   en cards con rival TBD por fase previa pendiente — eso es el bug
   2026-05-26 que esta regla arregla (el usuario saltaba el día y
   nunca recuperaba su KO).
5. **ko-2leg está fuera de cobertura batch.** Esos torneos (rara vez
   los hay en el hub Liverpool) mantienen su flujo manual / pay-per-leg.
6. **Toda eliminatoria NUEVA** que se añada al juego con KO
   (custom torneo del admin, nueva comp europea, etc.) que vaya por
   `_realPair` o `_selPair` hereda el flujo automáticamente —
   bastará con que su cfg tenga `groupFixtures` (si hay grupos) y un
   `koBracket`/`bracket` con la estructura estándar de pares.

## Resto del Mundo — 1 vuelta + Intercontinental + Mundialito (obligatorio, 2026-05-27)

La liga `ligaExt_resto-mundo` (44 equipos top de América + Asia,
ver "Resto Mundo" seed en `misc_body_1.html`) es **el único caso
especial** del proyecto en estos 3 ejes:

### 1. Se juega a UNA SOLA VUELTA (no doble round-robin)

`ligaExtSimular` en `misc_body_1.html:~30894` añade un guard
`_singleRound = (slug === 'resto-mundo')`. El bucle de pares pasa de
`pj=0` a `pj=pi+1` solo en esta liga: N*(N-1)/2 cruces en vez de
N*(N-1). Con 43 equipos = 42 partidos por equipo (943 cruces totales).

### 2. Las 2 zonas custom de Reglas: Intercontinental + Mundialito

El modal "📜 Reglas de la competición" (`#lext-ov-reglas`) muestra,
SOLO cuando `CURRENT_KEY === 'resto-mundo'`:

- 🟠 **Equipos pasan a Copa Intercontinental**: default 6. Los 6
  primeros de la tabla quedan marcados para Copa Intercontinental
  (la conexión real al bracket de Intercontinental se hace cuando
  cada equipo haya jugado sus 42 partidos de liga — wiring pendiente
  de un cambio futuro). Esta zona NO alimenta a Recopa.
- 🏆 **Equipos clasifican a Mundialito Clubes**: default 16. El
  Mundialito se celebra cada 4 temporadas y el usuario rellena el
  roster a mano. Esta zona es **informativa + visual** (colorea
  los puestos 7–16 de la tabla en azul claro `#50a0dc`) pero NO
  alimenta ningún pool automático.

Las otras 7 zonas (UCL / Previa / Open / E.League / Conference /
WildCard / Descenso) **se ocultan** en Resto del Mundo (su modal y
su leyenda), porque la liga está en `EUROPE_BLACKLIST` (no clasifica
a competiciones europeas estándar).

Coloreo de la tabla (`zoneClass`):

- Posiciones 1–6 → `.lext-row.z-inter` (banda naranja `#ff9020`).
- Posiciones 7–16 → `.lext-row.z-mundial` (banda azul claro
  `#50a0dc`). El cómputo es
  `mundialDelta = max(0, mundialClubes - intercontinental)` para que
  `mundialClubes=16` represente los 16 mejores TOTALES, no 16 plazas
  adicionales tras las 6 de Intercontinental.

Storage: `data.config.zones = {ucl,uclPrev,uclQual,uel,uecl,wildcard,intercontinental,mundialClubes,desc}`.
Migración automática: `_upgradeRestoMundoZones()` parchea saves
antiguos:
- pre-2026-05-26: setea `intercontinental=6` + `mundialClubes=16`.
- 2026-05-26 → 2026-05-27: copia `z.recopa` (6) → `z.intercontinental`
  y borra `z.recopa`. Resto del Mundo dejó de alimentar Recopa.

Lectura legacy: `zoneClass` y el load del modal Reglas leen
`z.intercontinental`, cayendo a `z.recopa` solo si el primero está
ausente (saves nunca abiertos tras la migración).

### 3. La Copa Resto del Mundo NO clasifica a Recopa (2026-05-27)

El bloque "🛡 Recopa de Europa · Plazas" del modal Reglas de la copa
(`_lecRenderReglas` en `misc_body_1.html`) se OMITE cuando
`CURRENT_KEY === 'resto-mundo'`. En su lugar se muestra el texto:
"Esta copa no clasifica a ninguna competición europea — solo se
corona al campeón.". El resto de copas nacionales (FA Cup, Coppa,
etc.) mantienen el bloque clásico con Campeón=1 fijo y Subcampeón
toggle 0/1 hacia Recopa.

### 4. Motor Recopa de Europa — bracket de 64 (2026-06-02)

Rediseño implementado (petición usuario, fotos 2026-06-02). La Recopa
es un **bracket de 64 equipos a partido único** (prórroga + penaltis
si empate al 90'), con **6 rondas** que cuadran con las fechas fijas
del calendario (`calendario.json`):

```
1/64 → 1/32 → Octavos → Cuartos → Semifinales → FINAL
(32m)   (16m)   (8m)      (4m)      (2m)          (1m)
```

Motor en `misc_body_1.html` (IIFE `STORE_KEY='recopa_state_v1'`):
`PHASES = ['r64','r32','r16','r8','sf','fin']`. La pantalla
`s-recopa` muestra las **6 cajas** (`recopa-rd-<phase>-blk`) + sus 6
sub-pantallas `s-recopa-rd-<phase>`.

**Pool — 54 campeones + 10 subcampeones = 64** (`_buildPool`, regla
2026-06-12): TODOS los **campeones** de las copas nacionales europeas
(`ligaExt_<slug>.copa.champion`, motor `_lecCopa`) — 53 ligas externas —
+ el campeón de EA Sports (manual) = 54. + los **subcampeones** SOLO de
la whitelist `RECOPA_SUBCAMPEON_SLUGS` (9 externas: `inglaterra,italia,
alemania,francia,portugal,p-bajos,belgica,turquia,dinamarca`; el toggle
per-cup `recopaSubcampeon` puede desactivar una, nunca añadir fuera) + el
subcampeón de EA Sports (manual) = 10. Los **manuales** de "EA Sports →
Europa" slug 'recopa' (`_meaTeamsFor('recopa')`) aportan campeón+sub de la
Copa del Rey porque Liga EA está en `EUROPE_BLACKLIST`. Prioridad al capar
a 64: manuales → campeones → subcampeones. Se saltan las ligas NO europeas
(mismo `EUROPE_BLACKLIST`: `resto-mundo`, `liga-ea-sports`,
`liga-hypermotion`, `liga-primera-federacion`).

**Relleno con BYE**: si el pool < 64, el sorteo de 1/64
(`_drawFirstRound`) rellena con `BYE='__BYE__'` de forma que cada BYE
empareje con un equipo real (walkover → el real pasa directo,
`_resolveBye` marca el match `played` con `bye:true`). Nunca
BYE-vs-BYE mientras queden reales. De 1/32 en adelante los ganadores
ya son potencia de 2 limpia. `_winnerOf` resuelve el walkover (lado
BYE pierde).

### Reglas a respetar (Recopa)

- **PROHIBIDO** volver al bracket de 8 (Cuartos→Semis→Final) ni al
  pool de "solo 2 manuales". Son 6 rondas / 64 equipos.
- **PROHIBIDO** alimentar Recopa desde `ligaExt_resto-mundo` (sigue
  en `EUROPE_BLACKLIST`). El pool es copas europeas + manuales.
- **PROHIBIDO** hardcodear plazas: el subcampeón entra según el
  toggle `recopaSubcampeon` de cada copa.
- Todas las rondas son **partido único con ET + penaltis** (`_gm._isRecopa`
  / `comp==='recopa'` → `_isRecopaSL` en gm-modal). NO meter ida/vuelta.
- El previa-date sale del calendario vía `_mmCalLabel` (rama
  `recopa_<phase>_<idx>` → `Recopa Europa — 1/64 … FINAL RECOPA`).
  Toda ronda nueva debe tener su fila en `calendario.json` y su
  entrada en ese mapa.

### El Subcampeón de cada copa arranca en 0 (editable), el Campeón siempre 1 (obligatorio, 2026-07-03)

**Petición usuario 2026-07-03**: "las reglas de copa por defecto que
siempre ponga el campeón 1 y el Subcampeón 0, pudiendo editarlo
manualmente". Antes el toggle `data.config.recopaSubcampeon` (modal
📜 Reglas de cada copa nacional, `_lecRenderReglas`) arrancaba en
**TRUE** por defecto (`!(recopaSubcampeon === false)`) — cualquier
copa de la whitelist `RECOPA_SUBCAMPEON_SLUGS` que el admin NUNCA
tocara aportaba su subcampeón a la Recopa sin que él lo hubiera
decidido.

**Fix** (`misc_body_1.html`, `_buildPool` + `_lecRenderReglas` +
`_lecCopa.toggleSubcampeon`): el default se invierte a **FALSE** —
`subOn = (data.config.recopaSubcampeon === true)`. El Campeón sigue
`fijo, siempre 1` (no editable, sin cambios). El toggle sigue
funcionando igual (pulsar el chip 0/1 alterna), solo cambia el valor
de arranque cuando el admin nunca lo ha tocado.

**Reglas a respetar**:
- **PROHIBIDO** volver a que `recopaSubcampeon` sin definir cuente
  como `true`. Solo cuenta el subcampeón si el admin lo puso a `true`
  explícitamente desde el toggle.
- El Campeón (`fixed`, valor "1") sigue sin ser editable — solo el
  Subcampeón tiene toggle.
- `_buildPool` (Recopa) y `_lecRenderReglas` (display del toggle)
  DEBEN leer el mismo criterio (`=== true`) para no discrepar entre lo
  que se ve en Reglas y lo que realmente entra al pool.

### Reglas a respetar

1. **No reintroducir el feed `ligaExt_resto-mundo` → Recopa**.
   Resto del Mundo alimenta Copa Intercontinental (a futuro,
   cuando se complete la temporada de liga), no Recopa.
2. **No hardcodear `intercontinental:6` ni `mundialClubes:16`** en
   builders nuevos. Leer siempre de `data.config.zones`. Default
   6/16 lo aplica `_upgradeRestoMundoZones`.
3. **No reintroducir el bloque "Recopa de Europa · Plazas"** en la
   Copa Resto del Mundo. Ninguna copa de esta liga clasifica a
   competiciones europeas.
4. **No quitar `resto-mundo` de `EUROPE_BLACKLIST`**. La liga sigue
   sin clasificar a UCL/UEL/UECL/Open/WildCard/Recopa (esas plazas
   se resuelven SOLO desde las ligas europeas y manual EA Sports).
5. **Cualquier nueva liga que se juegue a UNA vuelta** debe
   replicar el guard `_singleRound` en `ligaExtSimular`. La regla
   por defecto sigue siendo doble round-robin.
6. **El storage key `z.recopa` queda deprecated** para Resto del
   Mundo. Cualquier código que necesite ese cupo debe leer
   `z.intercontinental` con fallback `z.recopa` (solo para saves
   pre-migración que aún no se hayan abierto).

## Hub del usuario: Liverpool (no Bayern) — obligatorio, 2026-05-25

El equipo HUMANO del hub (la pantalla `s-munich`, la card "Próximo
partido", el calendario, los entrenamientos, el menú médico de
inyecciones, las pretemporadas) **es el Liverpool 💡**, NO el
Bayern. Bayern es **IA** y vive en la Liga Alemana
(`ligaExt_resto-de-ligas-*`).

### ¿De dónde viene el nombre "Bayern" en el código?

El hub se construyó originalmente sobre el slot "Bayern Munich" de
Liga EA Sports — los identificadores internos (`s-munich`,
`munich-next-match`, `BAYERN_SHIELD`, `_bayernSquad`, etc.) son
legacy de esa época. El **2026-05-23 el usuario renombró el slot a
Liverpool** vía el editor de Liga EA Sports
(`_ligaEaSubName('Bayern Munich')` devuelve ahora `"Liverpool"`).
Los identificadores con "munich" / "bayern" en el nombre siguen ahí
por compatibilidad, pero el contenido es Liverpool.

### Helpers canónicos para el nombre / plantilla / escudo del hub

```
window._mkHubTeamName               // string canónico del hub humano
_psHumanName()                       // visual (menu_home_v1.ov o _ligaEaSubName)
_psHumanLogicName()                  // lógico (siempre _ligaEaSubName del slot Bayern)
_psHumanShield()                     // URL del escudo
_athHubTeam()                        // equivalente para el menú médico
```

### Reglas a respetar

1. **Nunca hardcodear `/bayern/i` o `'Bayern Munich'`** para resolver
   la plantilla / escudo del usuario. Usa los helpers de arriba.
   Si una función nueva necesita el equipo del hub, debe leer el
   nombre lógico (`_psHumanLogicName` o `_mkHubTeamName`) y resolver
   contra ese.
2. **`_bayernSquad()` ya está parcheado** para hacer 3 lookups en
   `ligaExt_liga-ea-sports`: (1) match exacto por nombre lógico,
   (2) primer team con `isHuman:true`, (3) fallback histórico
   `/bayern/i`. NO eliminar los fallbacks — cubren saves antiguos.
3. **El sistema de bajas / inyecciones / "Bajas — NO convocar" /
   plantilla del HUD / mensajes de la bandeja** se refiere SIEMPRE
   al equipo del hub (Liverpool actualmente). Los 4 emojis humanos
   restantes (🐭 Brasil, 🔨 Inglaterra, ✏️ Noruega, 😈 Argentina,
   🦆 España son SELECCIONES — no aplica) y los OTROS 4 humanos de
   Liga EA Sports (Real Madrid, Barcelona, Atlético, Arsenal — más
   el del slot Bayern que es Liverpool) tienen su propio sistema
   pero NO entran en el hub `s-munich`.
4. **Si un bug futuro reporta "no hay lesiones de entrenamiento" o
   "no aparecen jugadores del hub"**, lo primero es comprobar si
   se está usando `_bayernSquad()` u otra resolución hardcoded a
   Bayern. El usuario renombró el slot y todas las rutas que
   resuelvan el hub deben usar los helpers dinámicos.

### Probabilidades del entrenamiento (referencia, 2026-05-25)

`_rollInjuries()` en `misc_body_1.html:3217-3225`:

| Resultado                  | Probabilidad |
|----------------------------|--------------|
| 2 jugadores lesionados     | 2 %          |
| 1 jugador lesionado        | 5 %          |
| Ninguno (sin bajas)        | 93 %         |

Total: 7 % de los entrenamientos genera al menos una lesión. El
sorteo es **en el segundo 0** (al pulsar ENTRENAR), antes de que la
barra se rellene. Los lesionados se eligen de la plantilla del
**Liverpool** (resuelto vía `_bayernSquad()` que ahora hace lookup
dinámico) y se descartan los que ya tienen baja activa.

## Fecha de la PANTALLA DE PREVIA — fuente única calendario (obligatorio, 2026-05-25)

La fecha que muestra la PANTALLA DE PREVIA junto al icono 🗓️ (línea
`X de <Mes> | 🏆 <comp>`) NO se inventa ni se setea con `new Date()`.
**Fuente única**: el calendario global (filas `.ag-r` del DOM,
generadas por SSR desde `calendario.json`).

### Pipeline

1. `_mmAgDateMap()` lee TODAS las filas `.ag-r` de `#ag-content` y
   construye `{ <label>: {date, wx} }` indexado por el texto del
   `.ag-lbl`.
2. `_mmCalLabel(matchKey, compKey)` resuelve el `<label>` exacto
   que debe coincidir con la entrada del calendario:
   - Liga: `Liga — J<N>` (regex `^lj<N>m`).
   - Copa del Rey: `Copa del Rey — <ronda>` (regex `^copa_<r>_<i>_<l>`).
   - Mundial · 48 selecciones (compKey `'torneo'` + cfg.format
     === `'mundial-48'`): lee `_ppPreviaTeams.tourId/tourKey`, carga
     la cfg vía `_tourLoadCachedSync` / `_TOUR_CACHE` y mapea:
     - Grupo J<N> → `Mundial Grupo — J<N>` (regex `^g\d+_<jor>_`).
     - KO (`ko_<rIdx>_<mIdx>`) → ronda según
       `cfg.formatConfig.koRounds[rIdx]`:
       - `Dieciseisavos` → `Mundial - Dieciseisavos`
       - `Octavos`       → `Mundial Octavos`
       - `Cuartos`       → `Mundial Cuartos`
       - `Semis`         → `Mundial Semis`
       - `Tercer Puesto` → `Mundial Tercer Puesto`
       - `Final`         → `MUNDIAL GRAN FINAL 🏆`
   - Resto (inter/usc/ucl-fin/uel-fin/...): `MAP[compKey]`.
3. `_mmInjectEnv` mete `<dayNum> de <Mes>` en `#pp-env` usando el
   resultado anterior.

### Reglas a respetar

1. **PROHIBIDO hardcodear fechas en la previa** (`"31 de Mayo"`,
   `"25 de Mayo"`, etc.). Si una comp nueva no resuelve fecha, la
   solución es añadir su rama a `_mmCalLabel` para que mapee al
   `.ag-lbl` del calendario, NO escribir la fecha a mano.
2. **PROHIBIDO sustituir el calendario por `new Date()`** en el
   pipeline de la previa. El cálculo "hoy" SOLO se usa como
   fallback degradado cuando no hay match en el calendario.
3. **Toda comp NUEVA con humanos** que abra la previa
   (`showPrePartidoOverlay(matchKey, compKey, ...)`) DEBE tener su
   rama en `_mmCalLabel` para mapear matchKey → `.ag-lbl`.
4. **Toda nueva ronda de Mundial-48** (p. ej. si se añade una
   ronda extra) DEBE tener:
   - Su evento en `calendario.json` con `event.name` exacto.
   - Su entrada en `MUNDIAL_KO_LABELS` de `_mmCalLabel` mapeando
     el nombre de la ronda (tal como aparece en
     `cfg.formatConfig.koRounds`) al `event.name` del calendario.
5. **El `compLabel`** de la previa (después del icono 🏆) en
   partidos de Mundial-48 se construye como:
   - `Mundial 2032 · GRAN FINAL 🏆` para la última ronda.
   - `Mundial 2032 · <RoundName>` para semis/cuartos/octavos/...
   - `Mundial 2032 · Grupo J<N>` para fase de grupos.
   NO mostrar `'torneo'` crudo (bug 2026-05-25).

### Histórico

- 2026-05-25: bug Marruecos vs Francia (GRAN FINAL del Mundial
  2032). La card del hub mostraba `31 May` (correcto) pero la
  previa `25 de Mayo` (HOY) porque `_mmCalLabel` no tenía rama
  para `compKey === 'torneo'`. `_tourOpenHumanMatch` pasa
  `compKey='torneo'` para TODOS los formatos de torneo (mundial-48,
  ko, league, groups-ko, swiss...), así que el matchKey
  `tour_<tourId>_ko_5_0` caía a `MAP[compKey] || null` → null →
  fallback a `new Date()`. Fix: rama `compKey === 'torneo'` que
  usa `_ppPreviaTeams.tourId/tourKey` + `cfg.formatConfig.koRounds`
  para resolver la etiqueta del calendario.

## Tema del gm-modal por competición (obligatorio, 2026-05-24)

El gm-modal (la pantalla del partido HvH/HvIA que ve el usuario) lee
la comp activa vía `_gmCompFromState()` y le aplica la clase
`is-comp-<X>`. Esa clase fija las CSS vars `--comp-color` y
`--comp-color-soft` que pintan TODOS los bordes/glow del modal:
caja exterior `#gm-inner`, FINALIZAR (`.gm-end-moved`), PRÓRROGA
(`#gm-btn-et`) y la franja superior de `gm-finalizar-slot`.

### Mapa comp → tema (obligatorio)

| comp en `_gm.comp`                                | clase            | `--comp-color`  | Justificación                                |
|---------------------------------------------------|------------------|-----------------|-----------------------------------------------|
| `liga`/`ea-sports`/`''`/`null`                    | `is-comp-liga`   | `#ff5060` rojo  | Liga EA SIEMPRE roja (legacy)                |
| `copa`/`copa-fin` (o `_isCopa`)                   | `is-comp-copa`   | `#ffb050` ámbar |                                               |
| `sc`/`sc-final` (o `_isSc`)                       | `is-comp-super`  | `#f0c820` oro   |                                               |
| `recopa` (o `_isRecopa`)                          | `is-comp-recopa` | `#ff8060`       |                                               |
| `superliga` (o `_isSuperliga`)                    | (vacío)          | rojo default    | Sin tema explícito (los 6 humanos)            |
| `ucl`                                             | `is-comp-ucl`    | `#88aaff` azul  |                                               |
| `uel`                                             | `is-comp-uel`    | `#ffaa55`       |                                               |
| `uecl`                                            | `is-comp-uecl`   | `#5fe08a`       |                                               |
| `inter`                                           | `is-comp-inter`  | `#f0a040`       |                                               |
| `torneo`/`mundial`/`mundial-48`/`sel`/`sel-fin`/`selecciones` | `is-comp-mundial` | `#a875e8` violeta | Mundial-48 (compKey `torneo` vía `_tourOpenHumanMatch`) y Selecciones |
| `amistoso`/`wprev`/`mundialito`                   | `is-comp-amistoso` | `#7da7c8` azul grisáceo |                                       |
| `verano`/`sct`/`jg`/`pss`/`asia`                  | `is-comp-verano` | `#5fc6c8` turquesa |                                           |
| **cualquier otra (fallback)**                     | `is-comp-neutral` | `#88a0c0` gris azulado | **PROHIBIDO** caer al rojo de Liga       |

### Reglas a respetar

1. **Toda comp humana NUEVA** que se añada (custom o de un torneo
   nuevo) DEBE tener su rama en `_gmCompFromState()` (en
   `templates/partials/part2/misc_body_2.html`, cerca de la línea del
   bloque "GM-MODAL · tema + colores de equipo").
2. **PROHIBIDO** dejar el fallback en `'liga'`. Cualquier comp no
   reconocida debe caer a `'neutral'` para evitar el bug
   2026-05-24 (Mundial-48 con todos los bordes rojos — foto Francia vs
   RD Congo).
3. **PROHIBIDO hardcodear `border:1px solid red`** o `var(--comp-color)`
   en elementos nuevos del gm-modal sin antes verificar el tema actual.

## Card bicolor del gm-modal (obligatorio, 2026-05-24)

El fondo del gm-modal lleva un **tinte bicolor** según los colores
reales del escudo:

- **Mitad izquierda** = color dominante del escudo LOCAL
  (`--team-a-bg`, alpha 0.25).
- **Mitad derecha** = color dominante del escudo VISITANTE
  (`--team-b-bg`, alpha 0.25).

Las vars las setea `_gmPaint(pa, pb)` en
`templates/partials/part2/misc_body_2.html`. El paint corre 2 veces:
primero con el "seed" (color de `_teamColors` / `_hashColor` por
nombre) para que el bicolor NUNCA esté vacío, y luego repinta cuando
la extracción real del escudo (`_crestPrimary` → `extractColors`)
resuelve.

Si el escudo del rival no se ha cargado aún o no existe, las CSS
vars caen a defaults `rgba(40,60,120,.25)` (azul oscuro local) y
`rgba(60,40,90,.25)` (morado oscuro rival) — petición explícita del
usuario "si no hay escudo todavía del rival pon el color que más te
guste".

### Caja "+ AÑADIR EVENTO" bicolor (obligatorio)

La caja AÑADIR EVENTO (`#gm-add-btn`) usa el mismo bicolor pero a
alpha alto (0.82-0.95) para que sea bien visible. El borde es
`1px solid rgba(255,255,255,.22)` — **PROHIBIDO** usar
`var(--comp-color)` en este borde (creaba el aro rojo del bug
2026-05-24).

### Reglas a respetar

1. **No quitar `background-attachment:fixed`** del bicolor del modal
   — sin él, el degradado se descoloca al hacer scroll del modal.
2. **No subir el alpha por encima de 0.30** en `--team-a-bg`/`--team-b-bg`
   — el texto del modal deja de ser legible.
3. **No reintroducir `border:2px solid var(--comp-color)`** en el botón
   AÑADIR EVENTO — eso es lo que causaba el aro rojo cuando el comp
   caía al fallback liga.
4. Si añades un elemento nuevo dentro del gm-modal con borde, usa
   `var(--comp-color, #88a0c0)` con fallback neutro, NUNCA hardcodear
   rojo.

## Sanción de SELECCIÓN por tarjetas se RECONCILIA desde el acta — nunca se pierde (obligatorio, 2026-06-06)

**Bug (fotos usuario 2026-06-06, «Rabiot·Francia 2🟨»)**: Adrien Rabiot
(Francia) tenía **2 amarillas** en la columna 🟨 de la plantilla (vista
selección), el código obliga a perderse el próximo partido por
acumulación (ciclo de 2), pero: (1) NO salía marcado en
amarillo/rojo en la plantilla, (2) NO había mensaje en la bandeja, y
(3) NO aparecía en la card «BAJAS PARA EL PARTIDO» (AMONESTADOS /
EXPULSADOS / LESIONADOS).

### Causa raíz

El motor de sanciones de selección (`calcularSelMatch` /
`window.calcularSancionesPartido` / `_selCalcularSancionesPartido`)
**NUNCA se invocaba** en ningún fin-de-partido (`gmEndMatch`,
`_mlFinishMatchGen`, auto-sim de torneo). Es decir,
`YELLOW_STORE_SEL` / `SANCION_STORE_SEL` jamás se alimentaban → cero
suspensiones registradas (ni acumulación, ni roja, ni doble amarilla).
El "2" de la plantilla viene de OTRA fuente (las stats `ta`/`tr` que
agrega `_tourStatsFromCfgResults` desde `cfg.results[].events`), así
que el síntoma era "veo 2 amarillas pero el juego no sabe que está
sancionado".

### Fix — derivar la suspensión del ACTA (cfg.results), retroactivo

`window._selReconcileSuspensions(selName)` (IIFE de selecciones en
`static/js/index.bundle.js`) deriva las suspensiones de las TARJETAS
acumuladas en `cfg.results` (la MISMA fuente que pinta la columna 🟨),
de forma RETROACTIVA y self-healing cross-device. Por jugador:

- `count`     = total de 🟨 (monótono = stat `ta`). Lo lee
  `_checkFraYellowBrink` para el aviso/suspensión de la bandeja.
- `servedAcc` = nº de suspensiones por acumulación YA CUMPLIDAS.
- `servedRed` = nº de suspensiones por 🟥/doble-amarilla YA CUMPLIDAS.

`pendingAcc = max(0, floor(ta/2) − servedAcc)`; `pendingRed = max(0,
tr − servedRed)`. **AUTO-LIMPIANTE** (refuerzo 2026-06-07, foto usuario
«Doué con 1 🟨 salía suspendido»): en CADA pasada la cola se AJUSTA a
ese `pending` — añade/actualiza si falta y **RETIRA** la entrada
gestionada si ya no procede (stats bajaron por un reset/re-sim o se
cumplió). `served*` SOLO sube al consumir (`_selConsumirParaPartido`,
que distingue las entradas gestionadas vía `_isSelReconEntry`), así una
suspensión cumplida no se resucita y una que dejó de proceder
desaparece sola. Migración del primer deploy: en la 1ª pasada
`served* = max(0, issued_legacy − pendiente_en_cola)` para no
re-suspender lo ya cumplido ni perder lo aún vigente.

Las entradas gestionadas llevan `srcCardRecon:true` (las legacy del
primer deploy se reconocen por `reason`). Las MANUALES del editor
(`'…(manual)'`) NO se tocan (las quita el usuario con QUITAR BAJA).

Stats por jugador vía `window._selCardStatsFor(selName)` (en
`misc_body_1.html`, junto a `_selCtxFor`): devuelve la LISTA
`[{name,ta,tr}]` construida con el MISMO roster (`_selTeamObj`) y el
MISMO matching (`_selCtxFor().statsFor`) que las filas de la plantilla
→ reconciliación y display NUNCA discrepan (un jugador con 1 🟨 en la
tabla tendrá `ta=1` en la reconciliación, jamás 2).

### Dónde se dispara la reconciliación

- **Plantilla** (`_renderSelView`): reconcilia ANTES de pintar →
  badge 🟨/🟥 (`_bedBajaBadge`) + fila coloreada (`_bedBajaState`) +
  detalle al pulsar (`_bedBajaDetail`). NO dispara el mensaje aquí (era
  una ráfaga retroactiva de avisos al abrir la plantilla — 2026-06-07).
- **Overlay BAJAS** (`pendientesPara`, home+away): reconcilia antes de
  leer la cola → AMONESTADOS (`tipo:'acumulacion'`) / EXPULSADOS
  (`tipo:'roja'/'d-amarilla'`).
- **Fin de partido** (`_broadcastHumanMatchResult`, lado `fra`):
  reconcilia + `_checkFraYellowBrink` (mensaje en bandeja, contextual al
  partido recién jugado).

### Bug colateral arreglado: color del badge/fila

`_bedBajaState`/`_bedBajaDetail` (vista selección) decidían
amarillo/rojo con `tipo === 'amarilla'`, pero la acumulación usa
`tipo: 'acumulacion'` → salía ROJO. Corregido a la misma lógica que el
club: `roja`/`d-amarilla` → rojo, el resto → amarillo.

### Reglas a respetar

1. **PROHIBIDO** depender de que `calcularSelMatch` se llame en el
   fin-de-partido para registrar sanciones de selección. La fuente de
   verdad es `cfg.results` (acta) vía `_selReconcileSuspensions`. Toda
   pantalla que muestre la suspensión (plantilla, overlay, mensaje)
   debe reconciliar antes de leer.
2. **PROHIBIDO** que la reconciliación sea SOLO ADITIVA (bug 2026-06-07:
   una suspensión `issued` que nunca se retiraba quedaba STALE cuando
   las stats bajaban por un reset/re-sim → un jugador con 1 🟨 salía
   suspendido). Debe ser AUTO-LIMPIANTE: `pending = max(0, owed −
   served)` recalculado en cada pasada, AÑADE/ACTUALIZA y **RETIRA** la
   entrada gestionada (`_syncSelManagedSusp`).
3. **PROHIBIDO** que `_selReconcileSuspensions` y la plantilla usen
   fuentes de stats DISTINTAS. Ambas leen `window._selCardStatsFor`
   (mismo roster `_selTeamObj` + mismo `_selCtxFor`) → no pueden
   discrepar (no más "la tabla dice 1 🟨 pero lo suspende por 2").
4. **PROHIBIDO** resetear `count` a 0 al cumplir el ciclo: `count` es
   monótono (= `ta`) porque `_checkFraYellowBrink` espera un total
   creciente. La no-duplicación la garantiza `served*` (solo sube al
   consumir), NO el reset del contador.
5. **PROHIBIDO** que la reconciliación toque las bajas MANUALES del
   editor (`reason` `'…(manual)'`, sin `srcCardRecon`): solo gestiona
   las suyas (`_isSelReconEntry`). El consumo distingue ambas para
   contar `served*` solo en las gestionadas.
6. **PROHIBIDO** volver a usar `tipo === 'amarilla'` para colorear el
   badge/fila de selección: la acumulación es `tipo:'acumulacion'` (el
   editor manual también la guarda así, para que salga en AMONESTADOS).
7. **PROHIBIDO** disparar `_checkFraYellowBrink` en el render de la
   plantilla (suelta una ráfaga retroactiva de avisos al abrirla). El
   mensaje va al FIN del partido. Una caja de humano nueva hereda el
   badge/overlay (genéricos por selección); el mensaje sigue siendo lado
   `fra` (hub Liverpool/Francia) — `_checkFraYellowBrink` se autogatea
   con `_isFra`.

## Sanciones y lesiones — SELECCIONES NACIONALES (obligatorio, 2026-05-24)

Sistema PARALELO al de clubes (`calcularSancionesPartido` /
`YELLOW_STORE` / `SANCION_STORE` / `LESION_STORE`). **NO se cruzan**:
un jugador sancionado en su selección puede jugar con su club, y
viceversa. Cada selección tiene su propio contador.

### Selecciones humanas (6, canónicas)

Francia💡, Brasil🐭, Inglaterra🔨, Noruega✏️, Argentina😈, España🦆.

La lista vive en `SEL_HUMANAS` en el bloque IIFE
`SANCIONES + LESIONES — SELECCIONES NACIONALES` al final de
`static/js/index.bundle.js`. Helper canónico:
`window._esSelHumana(name)` (también acepta selecciones marcadas
como humanas en el editor vía `selecciones_squad_v1.teams[].icon` →
`_SEL_HUMAN_ICONS`).

### Detección de partido de selección

`window._esCompSel(compKey)` devuelve `true` para:
- `compKey === 'sel'` (clasificación J1-J10, calendario `cal-sel1..10`).
- `compKey === 'sel-fin'` (Mundial fase final, `cal-mf-*`).
- `compKey === 'torneo'` cuando el `_TOUR_CACHE[tourId].format` es
  `'mundial-48'` (partidos del Mundial 2032 abiertos desde el hub).

### Reglas (distintas a clubes)

| Evento                          | Selecciones humanas         | Clubes (referencia)       |
|---------------------------------|-----------------------------|---------------------------|
| Lesión "natural" del motor      | 1 partido (el siguiente)    | 1-7 según grado           |
| ⬇️ marcado por usuario          | 2 partidos (este + siguiente) | 2-10 según roll Mod/Grave |
| Doble amarilla (expulsión)      | **1 partido siguiente**     | SIEMPRE 2 partidos        |
| Roja directa                    | **1 partido siguiente** (2026-06-02) | 2-15 con buckets |
| Acumulación de amarillas        | **Cada 2 = 1 partido (ciclo 2)** | Cada 3 = 1 partido    |

Notas:
- **Sanciones simultáneas → solo se aplica la MAYOR** (no se suman
  como en clubes). Si llega una sanción menor mientras hay una mayor
  pendiente, se descarta.
- **SIN reset entre torneos — cuenta ÚNICA y continua (2026-06-02)**:
  todos los stores usan la key única `'sel'`. Amarillas sueltas, ciclos
  de 2, expulsiones (roja/doble amarilla) y lesiones **NUNCA** se
  resetean entre torneos: viajan al siguiente partido que juegue la
  selección, sea clasificación o Mundial. Ejemplo canónico: Francia
  eliminada en cuartos del Mundial 2032 con un expulsado / 2 amarillas
  acumuladas → la sanción se cumple en **Selecciones J1** (21 sep) de la
  siguiente clasificación (misma selección, mismos jugadores).
  `torneoKeyFor(compKey)` devuelve `'sel'` para `sel`/`sel-fin`/`torneo`
  (mundial-48). Migración `_migrateLegacyTorneoKeys` fusiona los buckets
  legacy `sel-clasif`+`sel-mundial` en `'sel'` (idempotente). Helper
  manual de borrado total: `window._selResetTorneo('sel')`.
- **No hay amistosos de selección** — el sistema solo aplica a
  partidos oficiales. Si en el futuro se añaden amistosos de
  selección, irán por `compKey='amistoso'` (ya excluido por
  `EXCLUDED_COMPS` del sistema de clubes), no sumarán nada.

### Stores y persistencia

- `window.YELLOW_STORE_SEL['sel'][selName][playerName] = { count }`
- `window.SANCION_STORE_SEL['sel'][selName] = [ { name, remaining, reason, tipo } ]`
  (key única `'sel'` desde 2026-06-02 — clasif + Mundial comparten bucket)
- `window.LESION_STORE_SEL[selName][playerName] = { remaining, reason, timestamp }`
  (NO se anida por torneo — una lesión "sobrevive" entre clasif y
  Mundial; se decrementa partido a partido independientemente).
- `window._FORMA_MATCH_STATES_SEL[selName::playerName] = '⬇️'`

Persistencia en `localStorage` clave `ftbol_sel_sanciones_v1`
(autosave cada 5 s + beforeunload) **+ sync al servidor** vía
`_kvBlobSync` (sobrevive al borrado de datos de navegación / cambio de
móvil — ver sección "Lesiones / sanciones … se SINCRONIZAN al servidor",
2026-06-04). Separada del store de clubes (`ftbol_lesiones_v1`, también
sincronizado).

### Helpers públicos

```
window._esSelHumana(name)
window._canonSelHumana(name)        // 'francia' → 'Francia'
window._esCompSel(compKey)
window._selTorneoKey(compKey)        // 'sel' (única) | null
window._selCalcularSancionesPartido(events, humanTeam, teamName, compKey)
window._selAddSancion(torneoKey, selName, playerName, reason, partidos, tipo)
window._selCumplirSancion(torneoKey, selName, playerName)
window._selAddLesion(selName, playerName, partidos, reason)
window._selCumplirLesion(selName, playerName)
window._selResetTorneo(torneoKey)
window._selPendientesPara(home, away, compKey)    // { sanciones, lesiones }
window._selConsumirParaPartido(home, away, compKey)
```

### Hooks instalados sobre el sistema de clubes

El bloque al final de `index.bundle.js` envuelve estas funciones del
sistema de clubes para enrutar al motor SEL cuando `esCompSel(comp)
&& esSelHumana(teamName)`:

- `window.calcularSancionesPartido` — delega a
  `_selCalcularSancionesPartido` en partidos de selección.
- `window._sancionConfirm` — además de la decrementación de clubes,
  llama a `_selConsumirParaPartido` (idempotente por
  `_sancionConsumedFor['SEL_' + mk]`).
- `window._formaToggle` — ⬇️ en selección registra 2 partidos en
  `LESION_STORE_SEL` (no en `LESION_STORE` global como hace en
  clubes), evitando contaminación al club del jugador.
- `window._renderFormaChecklist` — render propio en partidos de
  selección con los rosters de las 6 selecciones humanas.
- `window.showSancionOverlay` — render self-contained desde
  `SANCION_STORE_SEL` + `LESION_STORE_SEL` (el original hace
  early-return si los stores globales están vacíos, que SIEMPRE lo
  están en selección).
- `window._refreshSancionInjList` — en selección re-renderiza desde
  `LESION_STORE_SEL` para no pisar la lista con "Sin lesionados" al
  togglear ⬇️.
- `window._registrarLesionesDesdeEventos` — particiona los eventos
  por equipo: lesiones de selección humana → `LESION_STORE_SEL`
  (1 partido), resto → motor original.

### Reglas a respetar

1. **No mezclar stores de clubes y selecciones.** Las stores SEL son
   independientes. Cualquier código que añada/lea sanciones de
   selección debe usar `*_SEL` o los helpers `_sel*`.
2. **No hardcodear más selecciones en `SEL_HUMANAS`** sin avisar al
   usuario. Las 6 son canónicas (2026-05-24). Selecciones marcadas
   como humanas en el editor (`_SEL_HUMAN_ICONS`) se reconocen
   adicionalmente por el fallback en `esSelHumana`.
3. **No cambiar los partidos de sanción** (1 d-amarilla, 1 roja
   directa, ciclo 2 amarillas, 2 ⬇️, 1 lesión natural) sin acordarlo
   con el usuario. Reglas pedidas el 2026-05-24; roja directa pasó de
   2 → 1 partido el 2026-06-02 (petición usuario: roja directa y roja
   por doble amarilla se pierden SOLO el siguiente partido).
4. **No introducir amistosos de selección** sin acordarlo. El
   usuario explícitamente dijo "no hay amistosos de selecciones, y
   en el caso de haber no cuentan" — quedan excluidos del cómputo.
5. **PROHIBIDO reintroducir el reset/separación por torneo** (los
   antiguos `'sel-clasif'` / `'sel-mundial'`). La cuenta es ÚNICA y
   continua (`'sel'`): las sanciones/lesiones de una selección DEBEN
   viajar al siguiente partido que juegue, sea del torneo que sea
   (petición usuario 2026-06-02, "todo es acumulable siempre que juegue
   la selección"). Si se añade un torneo nuevo de selecciones (ej.
   Eurocopa), `_selTorneoKey` debe seguir devolviendo `'sel'` para él.

## Balón fijo Selecciones por jornada (obligatorio, 2026-05-24)

Regla "siempre" pedida por el usuario el 2026-05-24:

- **Selecciones J1 a J8** (`cal-sel1`..`cal-sel8`, fase clasificatoria
  africana, septiembre–marzo) → **`Orbita Africa`** SIEMPRE.
- **Selecciones J9 en adelante** (`cal-sel9`, `cal-sel10`, fase de
  mayo) → **`NIKE CONTROL CBF`** SIEMPRE.
- **Mundial fase final** (`cal-mf-g1`..`cal-mf-fin`, compKey
  `sel-fin`) → **`NIKE CONTROL CBF`** (default existente).

Esta regla GANA sobre el override del admin
(`ball_by_comp_v1['sel']`). Solo el balón de nieve
(`eFootball MAX VIS 26`) puede sobrescribirla, igual que para el
resto de comps.

### Resolución

En `_buildItems(matchKey, compKey, …)` de
`static/js/index.bundle.js`, después de aplicar el override del
admin sobre `COMP_BALL[compKey]`, se inyecta un bloque que detecta
`compKey === 'sel'` + jornada (vía `window._ppBlockId` con regex
`cal-sel(\d+)`, fallback al `matchKey`) y reescribe `balon` a
`'Orbita Africa'` o `'NIKE CONTROL CBF'` según la jornada.

**Mundial 2032 vía `_tourOpenHumanMatch`** (compKey `'torneo'`): el
flujo de torneo NO pasa `'sel'`, pasa `'torneo'`. Para que la regla
también se aplique a partidos de Selecciones lanzados desde la card
del hub (Francia-UAE en May, etc.), el bloque comprueba además
`window._TOUR_CACHE[_ppPreviaTeams.tourId].format === 'mundial-48'`
y, si coincide, fuerza `'NIKE CONTROL CBF'` (Mundial fase final).
Sin esto, `COMP_BALL['torneo']` no existe y `balon` caía al default
inicial `"Ligue 1 McDonald's"` (bug reportado por usuario 2026-05-24
con captura: Francia vs UAE mostraba balón de Liga EA).

En la pantalla `s-calendario.html`, los placeholders `<div class=
"minfo">⚽️ …</div>` de `cal-sel1`..`cal-sel8` muestran "Orbita
Africa"; los de `cal-sel9`..`cal-sel10` y `cal-mf-*` mantienen "NIKE
CONTROL CBF".

### Inventario

El balón `Orbita_Africa` está sembrado en `BALL_DB` (entrada
`{key:'sel-clasif', comp:'Selecciones · Clasif. (J1-J8)',
id:'Orbita_Africa'}` en `misc_body_2.html`), así que aparece en
"INVENTARIO DE BALONES" sin que el admin tenga que añadirlo a mano.
`NIKE_CONTROL_CBF` ya estaba sembrado por la entrada
`{key:'selecciones', comp:'Fase Final Selecciones'}`.

### Reglas a respetar

1. **No cambiar el balón hardcoded** sin acuerdo con el usuario:
   J1-J8 = `Orbita Africa`, J9+ = `NIKE CONTROL CBF`.
2. **No quitar el bloque jornada-aware** de `_buildItems`. Aunque
   el admin asigne otro balón vía `s-admin-balls`, esta regla
   debe ganar (es "siempre" por petición explícita).
3. **Si se añaden más jornadas de Selecciones** (J11, J12, …), la
   rama `_selJor >= 9` ya las cubre; no hay que tocar nada.
4. **No borrar `Orbita_Africa` de `BALL_DB`** — si desaparece de
   `BALL_DB` y el inventario no se ha sembrado nunca en el navegador
   del usuario, el picker del admin no lo tendrá disponible.

## Balón asignado por competición (obligatorio, 2026-05-24)

**Cuando el admin asigna un balón a una competición desde "INVENTARIO
DE BALONES" (pantalla `s-admin-balls`, override
`ball_by_comp_v1[compKey] = ballId`), ese balón DEBE aparecer en
TODAS las cards de partidos donde haya un humano implicado en esa
competición.** Aplica a CUALQUIER tipo de torneo: Liga EA Sports,
Copa del Rey, Supercopa de España, Champions League, Europa League,
Conference League, Recopa, Supercopa de Europa, Intercontinental,
Mundialito de Clubes, Selecciones, Superliga, Torneos de Verano,
amistosos, y cualquier competición custom que el admin añada vía
"+ AÑADIR COMPETICIÓN".

### Resolver canónico

El bundle resuelve el balón en `_buildItems(matchKey, compKey, …)`
de `static/js/index.bundle.js` con esta cadena (NO modificar el
orden):

1. `ball_by_comp_v1[compKey]` — **clave RAW del partido**. Cubre
   las 14 comps base + las 3 extras (`superliga`, `verano`,
   `mundialito`) + cualquier comp custom añadida por el admin.
2. `ball_by_comp_v1[_COMP_TO_BDB[compKey]]` — fallback al alias de
   `BALL_DB` (back-compat de las 14 comps base que históricamente
   se guardaban por la clave `champions`/`uel`/etc. en vez de
   `ucl`/`uel`).
3. `ball_by_comp_v1[_COMP_GROUP_ALIAS[compKey]]` — alias de GRUPO
   (2026-05-25): varios compKeys reales comparten una sola fila en
   Ball Storage. Los torneos de verano (Joan Gamper `jg`, Asian
   `asia`, Pre-Season Super `pss`, Soccer Champions Tour `sct` y
   los genéricos `torneo`/`torneos`) caen sobre la extra `verano`;
   `mundial` cae sobre `mundialito`.
4. `COMP_BALL[compKey]` — default hardcoded por comp (incluye
   defaults para `torneo`/`jg`/`asia`/`pss`/`sct`/`mundialito` para
   evitar que caigan al default genérico `Ligue 1 McDonald's`).
5. Override por clima: nieve → `eFootball MAX VIS 26`.
6. Fallback `ml-ball-name` del DOM (`ball-wrap-<matchKey>`).

### Reglas a respetar

1. **Toda card de partido humano** (HvH, HvIA, IAvH) DEBE construir
   sus items vía `_buildItems(matchKey, compKey, …)`. No reimplementar
   la resolución del balón en una nueva ruta.
2. **Toda nueva competición humana** que se añada al juego DEBE
   pasar su `compKey` real al builder de la card, para que el
   override del admin se aplique automáticamente sin tocar
   `_COMP_TO_BDB`.
3. **No hardcodear nombres de balón** en builders nuevos. El balón
   por defecto va en `COMP_BALL`; el override del usuario gana
   siempre.
4. **No romper `ball_by_comp_v1`** en wipes ni migraciones. La clave
   se persiste en localStorage + servidor (`/api/kv/ball_by_comp_v1`,
   ver sección "Inventario de Balones").
5. **El admin elige el balón con un picker ✅** (overlay) en
   `s-admin-balls`. Prohibido reintroducir `<select>` nativo para
   esta selección (bug 2026-05-24: en algunos móviles el `<select>`
   cancelaba la elección al primer toque).

### Persistencia del inventario

- Cache local: `localStorage` (3 claves: `ball_inventory_v1`,
  `ball_by_comp_v1`, `ball_comp_db_v1`).
- Fuente de verdad: servidor (`/api/kv/<key>` en `app.py`).
- Las escrituras locales se marcan con `_ballMarkLocalWrite(key)` y
  durante 5 min `_ballHydrateAll()` NO pisa la cache con la
  respuesta del servidor (evita race con un GET stale anterior al
  POST del usuario).
- Los flujos `adminBallAdd` / `adminBallAddComp` /
  `adminBallSetForComp` esperan la confirmación del POST y muestran
  toast distinto si el servidor no respondió.

## Sanciones por tarjetas (obligatorio, 2026-05-23)

Sistema único cross-competición en `static/js/index.bundle.js`:
`window.calcularSancionesPartido(events, humanTeam, teamName, compKey)`.

### Reglas

1. **Acumulación de amarillas**: **3 amarillas** → el jugador se
   pierde el próximo partido del calendario. El contador se acumula
   GLOBALMENTE entre TODAS las competiciones (Liga + Copa + UCL +
   UEL + UECL + Recopa + USC + Intercontinental + Mundialito Clubes
   + Selecciones + Superliga + …). Al alcanzar 3 → sanción y reset
   del contador a 0.
2. **Doble amarilla** (expulsión en el mismo partido) → **SIEMPRE 2
   partidos** de sanción. No suma al ciclo de amarillas.
3. **Roja directa** → sorteo 2-15 partidos con buckets:
   - 60% → 2–3 partidos (uniforme: 30%/30%)
   - 25% → 4–6 partidos (uniforme: 8.33%/×3)
   - 10% → 7–10 partidos (uniforme: 2.5%/×4)
   -  5% → 11–15 partidos (uniforme: 1%/×5)
4. **Cumplimiento**: la sanción se cumple en el **PRÓXIMO partido
   del calendario sea de la comp que sea** (excepto excluidas).
   `_sancionConfirm` descuenta 1 al confirmar el overlay BAJAS PARA
   EL PARTIDO; al llegar a 0, la entrada se elimina.
5. **Finales** no aplican acumulación de amarillas (se mantiene la
   regla antigua de no sancionar en una final por amarillas);
   expulsiones (d-amarilla, roja) sí.

### Competiciones EXCLUIDAS

Los **torneos de verano** (Soccer Champions Tour, Premier Summer
Series, Trofeo Joan Gamper, Asian Tournament) + amistosos NO suman
amarillas, NO generan sanción y NO consumen sanción. CompKeys:
`amistoso`, `torneo`, `torneos`, `sct`, `jg`, `pss`, `asia`,
`verano`. Set canónico: `EXCLUDED_COMPS` en `index.bundle.js`.

### Stores

- `window.YELLOW_STORE.__global[player::team] = { count }` —
  contador único cross-comp. Las claves legacy
  `YELLOW_STORE[compKey]` quedan ignoradas en escritura pero se leen
  para no romper save-games.
- `window.SANCION_STORE.__global = [ { name, team, reason, remaining,
  srcComp } ]` — cola única cross-comp. `_addSancion` suma a
  `remaining` si ya hay entrada del mismo jugador (acumulación de
  sanciones).

### Reglas a respetar

- Toda nueva ruta que genere amarillas/expulsiones para un humano
  debe pasar por `calcularSancionesPartido` (no escribir
  directamente en YELLOW_STORE / SANCION_STORE).
- Toda nueva competición HUMANA que se añada debe tener entrada en
  `COMP_CONFIG` con `ciclo:3` (o quedar en `EXCLUDED_COMPS` si es de
  verano/amistosa).
- No reintroducir sorteos `0.5 ? 1 : 2` o rangos 2-8 — están
  obsoletos desde 2026-05-23.

## Plantilla del hub (Liverpool-Francia) — stats SUMADAS + nota media por competición (obligatorio, 2026-06-03)

Petición usuario 2026-06-03 (foto caja Liverpool-Francia → 👕
PLANTILLA): las estadísticas de cada jugador de la plantilla del hub
deben ir **SINCRONIZADAS y SUMADAS** de TODAS las competiciones
OFICIALES del club, jugador a jugador, estadística a estadística. Lo
mismo para un jugador NUEVO que se añada a la plantilla (automático,
por nombre).

### Competiciones que cuentan (oficiales del club)

Liga EA Sports · Copa del Rey · Supercopa de España · Champions /
Europa / Conference (la que juegue) · Recopa de Europa · Supercopa de
Europa · Intercontinental · Mundialito de Clubes.

**EXCLUIDAS SIEMPRE** (van a parte): Superliga, amistosos, torneos de
verano. También fuera: Previa Champions / Open Qualifier / Wild Card
(no son "competición real").

### Implementación (todo en `templates/partials/misc_body_1.html`)

- **Render**: `renderBayernPlantillaScreen` → `_section` → `_rowFor` en
  el IIFE de `#s-bayern-plantilla` (host `bayern-plantilla-host`).
- **SUMA agregada** (`_buildStatsCache` → `_statsFor`): suma
  `_STATS_FIELDS` sobre `_STATS_STORES` = `[ef_player_stats_v1`
  (Liga+Copa+SC), `ucl_main, uel, uecl, recopa, usc, inter, mundial]`.
  Sin solape ⇒ sin doble conteo. La columna **GOLES** es un **total
  único** = `gol + pen + fk` sumado de todas las comps (no 3 columnas).
- **NOTA MEDIA (0.00-10.00)**: media de la nota del jugador por
  competición. `_notaFor(name, pos)` calcula la nota de cada comp con
  `window.computePlayerRating` (MISMA fórmula por posición del editor,
  expuesta en window) sobre el desglose por comp (`_NOTA_CACHE`, lleno
  por `_buildStatsCache` desde `_NOTA_STORES`), y **promedia solo las
  comps con `pj>0`**. Ejemplo:
  `(8.30+8.10+7.77+7.86+6.92+7.00)/6 = 7.64`.
- **Liga, Copa y Supercopa España van SEPARADAS** en la media. Como
  `ef_player_stats_v1` las funde, `rebuildPlayerStatsStore` persiste una
  copia **Liga SOLA** en `ef_player_stats_liga_only_v1` (snapshot
  profundo TOMADO ANTES de `_mergeBucketInto(stats, buckets.copa/sc)`).
  `_NOTA_STORES` la usa en vez de v1.
- **Nombre del club dinámico**: la agregación indexa por el nombre REAL
  del hub (`_hubTeamName()` → `_findBayernRow().name` → Liverpool), NO
  por `'Bayern Munich'` hardcodeado. Sin esto la agregación devuelve
  ceros tras renombrar el slot (bug raíz 2026-06-03).
- **CSS**: layout propio scopeado a `#s-bayern-plantilla` (9 col campo /
  10 portero) con columna GOLES única + columna NOTA (📈). NO toca el
  editor admin de Resto de Ligas (`renderSquadList`, mismas clases
  `lext-sq-*` pero otro scope).

### Reglas a respetar

1. **PROHIBIDO** volver a hardcodear `'Bayern Munich'` en
   `_buildStatsCache`/`_hubTeamName`. Resolver SIEMPRE el club del hub
   dinámicamente (`_findBayernRow` / `_psHumanLogicName`).
2. **PROHIBIDO** meter Superliga, amistosos o torneos de verano en
   `_STATS_STORES` / `_NOTA_STORES`. Van a parte por decisión del
   usuario.
3. **PROHIBIDO** que la nota media se calcule sobre los totales sumados
   (sería otra cifra). Es la MEDIA de las notas por competición
   (`computePlayerRating` por comp, promedio de las que tienen `pj>0`).
4. **PROHIBIDO** romper el snapshot Liga-sola: `_persistBucket` de
   `ef_player_stats_liga_only_v1` debe seguir TOMÁNDOSE ANTES de fundir
   Copa+SC en `buckets.liga`.
5. Un jugador NUEVO de la plantilla hereda todo automáticamente (lookup
   por nombre normalizado + fuzzy). No hay listas por jugador.
6. La nota usa `computePlayerRating` (expuesta en `window`); cualquier
   recalibración de la fórmula del editor se propaga sola a la
   plantilla del hub. No duplicar la fórmula.

### El filtro de equipo de la plantilla es ALIAS-tolerante Bayern↔Liverpool (obligatorio, 2026-06-08)

**Bug (fotos usuario 2026-06-08, Mundialito de Clubes)**: el Liverpool
jugó 3 partidos oficiales del Mundialito de Clubes (con goles, tarjetas,
MVP, portería imbatida visibles en la caja «Mundialito · Estadísticas»),
pero en `s-bayern-plantilla` (caja Liverpool-Francia → 👕 PLANTILLA)
NINGÚN jugador tenía una sola estadística — TODO a 0.

**Causa raíz**: la caja Estadísticas del Mundialito (`_mundialRenderStatsGrid`)
NO filtra por equipo, así que muestra los goles del Liverpool tal cual los
trae el escáner (`_mundialStatsRobustScan` → claves `liverpool::jugador`).
La plantilla SÍ filtra al equipo del hub, y lo hacía con un match ESTRICTO
de UN solo nombre: `_teamKeyMatches(t, _normForStats(_hubTeamName()))`. El
slot del hub resuelve su nombre LÓGICO a «Bayern Munich» (legacy, el dato
del slot de Liga EA NO se renombró físicamente — solo el display vía
`menu_home_v1`), mientras los partidos del Mundialito guardan el equipo
como «Liverpool» → `_teamKeyMatches('liverpool','bayern munich')` = false
→ se descartaban TODAS las stats del hub → plantilla a 0.

**Fix** (`misc_body_1.html`, IIFE de `#s-bayern-plantilla`): helper
`_hubTeamKeyMatch(t)` que, además del match alias previo (`_hubTeamMatches`),
ensancha a un CLUB HUMANO CANÓNICO dirigido por el MISMO mister que el hub
(`_isHumanClubCanonico(t) && _mhSameMister(_hubTeamName(), t)`). Cubre
Bayern↔Liverpool en AMBOS sentidos (dato «Bayern» / eventos «Liverpool» o
al revés) y cualquier otra caja humana. Se aplica al merge del Mundialito
EN VIVO **y** a los loops de SUMA (`_STATS_STORES`) y NOTA (`_NOTA_STORES`),
para que el mismo desajuste de nombre no vacíe tampoco Liga/Copa/UCL/etc.
cuando el hub empiece a jugarlas.

Reglas:
7. **PROHIBIDO** filtrar las stats de la plantilla del hub por UN solo
   nombre estricto (`_teamKeyMatches(t, teamNorm)`). Usar `_hubTeamKeyMatch`
   (alias + mismo mister gateado por `_isHumanClubCanonico`), que tolera el
   desajuste Bayern↔Liverpool venga del lado que venga.
8. **PROHIBIDO** ensanchar ese match SIN el gate `_isHumanClubCanonico` +
   `_mhSameMister`: sin él se colarían IA del torneo (Bayern Leverkusen,
   Al Hilal, Club Brugge…) o el club de OTRO mister. El gate restringe el
   ensanche al club humano del propio hub.

### Toggle escudo CLUB ↔ SELECCIÓN (2026-06-03)

La cabecera de `#s-bayern-plantilla` muestra **dos escudos** arriba a
la derecha (`#bplant-crest-toggle`): el del **club** del hub (Liverpool)
y el de su **selección** (Francia). Pulsando cada escudo emerge la
plantilla de ese equipo en el MISMO layout `lext-sq-*`.

- El mapa club→selección sale de `window._mhFindMister(_hubTeamName())`
  (`.seleccion`), así que **generaliza a cualquier caja de humano**
  (Arsenal→Brasil, Atlético→Noruega, …). Fallback `'Francia'`.
- **Escudo del club = mapa CANÓNICO autoritativo** (`_CANON_CLUB_CREST`
  en `misc_body_1.html`; gemelo `_PS_CANON_CREST` para la card del hub
  en `_psHumanShield`). Bug 2026-06-04 (foto usuario, "por error
  continuado seguía saliendo el Bayern"): el filtro por URL
  `_isStaleBayernShield` SOLO detecta el escudo stale del Bayern cuando
  es una RUTA con `bayern-munchen`; **no** puede detectar un data-URI
  del Bayern guardado en `shield`/`img`/override del menú. Fix:
  `_hubClubCrest()` y `_psHumanShield()` resuelven el escudo del hub
  desde `_CANON_CLUB_CREST[_normForStats(nombre)]` **ANTES** de mirar
  ningún `shield`/`img`/override. Mapea los 6 clubes humanos a su
  archivo bundleado (`/static/img/escudos-1/*`); incluye alias legacy
  `bayern munich`/`bayern`/`lfc`→Liverpool y `paris saint-germain`/
  `paris`→PSG. **PROHIBIDO** volver a confiar primero en
  `shield`/`img`/`getTeamLogoUrl` para el escudo de la plantilla de una
  caja de humano canónica: el mapa canónico gana siempre (es lo único
  inmune a data-URIs stale). Una caja de humano nueva hereda esto
  añadiendo su club al mapa.
- Estado en `window._bplantView` (`'club'` | `'sel'`), toggle vía
  `window._bplantSetView(v)`. Default `'club'`.
- La **vista selección** (`_renderSelView`) reutiliza `_section`/`_rowFor`
  con un **ctx** `{statsFor, notaFor}`. El layout (GOLES único + NOTA)
  es idéntico al del club por el grid scopeado a `#s-bayern-plantilla`.
- **Fuente de stats de selección — AUTO-DETECTA las competiciones
  ACTIVAS** (petición usuario 2026-06-03: "cada año juega 2
  competiciones distintas", p.ej. Mundial 2032 + Road Copa Asia; el año
  siguiente Fase Final Copa Asia + Road Copa América; etc.).
  `_buildSelStatsMap(selName)` **NO** usa el store unificado
  `ef_player_stats_sel_v1` (acumula TODAS las temporadas). En su lugar:
  - `_selActiveTourIds()` enumera las cajas de selección **VISIBLES**
    (`tour_registry_v1.visible` ∩ `/^(spv|sfn)\d+$/`; fallback: todos los
    slots `spv1..spv10`+`sfn1..sfn10`).
  - Para cada torneo donde la selección juega Y tiene partidos
    disputados, agrega los stats por jugador vía
    `window._tourStatsFromCfgResults(cfg)` (lee `cfg.results[].events`)
    y suma `pj += partidos de la selección en ese torneo` (PJ
    team-level, mismo criterio que el club; `_tourStatsFromCfgResults`
    NO cuenta pj por sí solo).
  - **GOLES = total único** (gol+pen+fk sumado). **NOTA = una sola
    global** (`computePlayerRating` sobre el agregado, NO media por
    competición — decisión usuario).
- **PROHIBIDO** volver a leer `ef_player_stats_sel_v1` para la plantilla
  del hub (mezcla temporadas pasadas). La fuente son los torneos de
  selección ACTIVOS. El store unificado sigue siendo para
  sanciones/lesiones (cuenta continua), no para esta caja.
- Escudo del club: `_findBayernRow().shield/img` → `getTeamLogoUrl`.
  Escudo de la selección: `t.img` del store `selecciones_squad_v1`
  (`_selSquadLoad`) → `getTeamLogoUrl` → bandera emoji (`_SEL_FLAGS`).
- **PROHIBIDO** duplicar el layout de fila: la vista selección usa el
  MISMO `_rowFor`/`_section` parametrizados por `ctx`. Toda columna
  nueva se añade una sola vez.

## Toda caja de humano nueva HEREDA los códigos de sanción/lesión (obligatorio, 2026-06-02)

Petición usuario 2026-06-02: cuando se cree una **caja de humano**
nueva (un club marcado como humano: Arsenal🇧🇷=Brasil, Atlético🇳🇴=
Noruega, etc., los 6 del `MISTERS_REGISTRY`), **TODOS los códigos de
sanción y lesión deben aplicarse también a esa plantilla**, igual que
al Liverpool, y de forma **acumulativa cross-competición** para ese club.

### El motor ya es genérico por equipo — NO hardcodear al Liverpool

- `calcularSancionesPartido(events, humanTeam, teamName, comp)` y
  `procesarSancionesPostPartido` trabajan con el **nombre de equipo que
  reciben**. Los contadores son **por jugador::equipo**
  (`YELLOW_STORE.__global`, `SANCION_STORE.__global`) → cada club acumula
  independientemente. Aplica a CUALQUIER club reconocido como humano.
- **Detección de club humano**: usar SIEMPRE `window._isHumanClubCanonico(name)`
  (alias-safe, registro `MISTERS_HUMANOS`) y/o el `isHuman` LIVE de
  `ligaExt_liga-ea-sports`. **PROHIBIDO** gatear con listas exactas
  cacheadas al load (rompen con grafías/alias y con cajas nuevas). El
  overlay de lesión de `_generarLesionHumano` ya combina ambos
  (`_EQUIPOS_HUMANOS` live ∪ `_isHumanClubCanonico`).

### El hub pivota sobre UN resolver de "club activo"

Todo el hub (`s-munich`) resuelve su club vía **una sola fuente**:
`window._mkHubTeamName` / `_psHumanLogicName()` (lógico) y
`_psHumanName()` / `_psHumanShield()` (visual). Helpers ya dinámicos
que NO están atados al Liverpool: `_bayernSquad()` (lee
`_psHumanLogicName()`), `_athHubTeam()` (lee `_mkHubTeamName`),
`_athInjuredForHub()`, el overlay BAJAS (`_ppGetCurrentMatchTeams` lee
el DOM del partido). Para dar a una caja nueva su **hub completo
propio** (calendario, card "Próximo partido", overlay BAJAS,
entrenamiento, menú médico), se alimenta ese resolver con el club de la
caja — NO se duplica lógica ni se hardcodea el nombre.

### Reglas a respetar

1. **PROHIBIDO** hardcodear `/bayern/i`, `'Liverpool'`, `'Bayern
   Munich'` (ni ningún club concreto) en código nuevo de sanción /
   lesión / hub. Resolver SIEMPRE vía `_psHumanLogicName()` /
   `_mkHubTeamName` (club del hub) o el `teamName` del partido.
2. **PROHIBIDO** gatear "¿es humano?" con una lista exacta cacheada.
   Usar `_isHumanClubCanonico` (alias-safe) ∪ `isHuman` live.
3. **Cada club acumula lo suyo**: las stores son por `jugador::equipo`,
   nunca globales-de-un-solo-club. No mezclar contadores entre cajas.
4. Las **selecciones** de cada caja (Francia/Brasil/Inglaterra/Noruega/
   Argentina/España) siguen su propio motor `_sel*` (cuenta única `'sel'`
   por selección, ver sección de Selecciones). Club y selección de un
   mismo mister NO comparten contador (sistemas paralelos).
5. Al construir el **hub propio** de una caja nueva, reutilizar los
   helpers existentes parametrizados por el resolver de club activo; no
   clonar `s-munich` con nombres hardcodeados.

## Humanidad por competición (obligatorio, 2026-05-10)

**Un equipo puede ser HUMANO en una competición y IA en otra.** No
hay una lista global de "equipos humanos del proyecto" — la humanidad
depende del contexto. Helper canónico:
`window.isHumanInComp(name, comp)` (definido en `misc_body_1.html`
arriba del IIFE de UCL/UEL/UECL fase de liga).

| Competición                                | Humanos                                                    |
|--------------------------------------------|------------------------------------------------------------|
| `liga` / `copa` / `sc`                     | Solo los **5 humanos canónicos** de Liga EA Sports         |
| `ucl` / `uel` / `uecl` / `recopa` / `usc` / `inter` / `mundial` / `wprev` / `amistoso` / `torneo` | Cualquier equipo con `humanIcon(name)` asignado (por el editor de plantilla) |
| `superliga`                                | Equipos seleccionados al configurar Superliga (los 6)      |

Los **5 humanos canónicos** son: Real Madrid, FC Barcelona, Atlético
Madrid, Arsenal, Bayern Munich. Vienen de `esHumano()` que lee
`ligaExt_liga-ea-sports.teams[].isHuman`.

Los **humanos extra** (PSG, Manchester United, Borussia Dortmund,
Manchester City, RB Leipzig, etc.) tienen un `humanEmoji` asignado
en el editor de plantilla (Resto de Ligas) que `humanIcon(name)`
devuelve. Estos equipos son humanos SOLO en eur/superliga (donde
juega un humano "secundario") y son IA en Liga doméstica.

Reglas obligatorias:
1. **No usar `esHumano(name)` directamente para flujos eur/superliga.**
   Usar `window.isHumanInComp(name, comp)`.
2. **No añadir teams a la lista global de Liga EA solo para forzarlos
   a humano en otras comps.** Añade `humanEmoji` a su plantilla en el
   editor — eso lo hace humano en eur/amistoso/torneo SIN romper Liga.
3. **No hardcodear listas tipo `EUROPEAN_HUMANS = [...]`.** Cualquier
   chequeo de humanidad va por `isHumanInComp`.
4. **Pantalla obligatoria de estadísticas (posesión/tiros/faltas) tras
   FINALIZAR**: en gm-modal usar `_gmHumanInvolved()` (que cubre
   selecciones nacionales vía `cfg.teams[].isHuman`); en ml-card usar
   el helper local `_mlTeamIsHuman*` que respeta `st.homeIsHuman /
   awayIsHuman` y cae a `isHumanInComp(name, st.comp)` → `esHumano`.
   Bug 2026-05-24: `gmEndMatch` y `mlEndMatchGen` usaban `esHumano()`
   directo → Francia (humano) vs UAE (IA) en el Mundial se finalizaba
   sin pedir las stats obligatorias.

## Límites de almacenamiento por carpeta (obligatorio, 2026-05-02)

Cada carpeta y subcarpeta del almacenamiento del navegador
(localStorage namespace) tiene un cap de **2 MB**. Esto aplica a:

- Cada `ligaExt_<slug>` y todas sus claves derivadas
  (`_protected`, `_snap_<ts>`, …) sumadas.
- Cada estado de competición persistido (`wprev_state_v1`,
  `oq_simulation_v1`, `comp_icons_v1`, …).

Reglas a respetar:

1. **No escribir más de 2 MB en una sola clave.** Si una plantilla,
   acta o snapshot pasa de ese tamaño, hay que recortar (truncar
   históricos, reducir JSON, mover datos al servidor).
2. **No acumular tantos derivados que la suma por carpeta supere
   2 MB.** Por eso `saveData` mantiene como mucho `main` +
   `_protected` + 1 snapshot por liga (drop de `_backup` legacy
    2026-05-02, recorte de 2→1 snapshot 2026-07-03 — ver sección de
    quota más abajo).
3. **Si añades una nueva clave**, calcula su tamaño máximo plausible
   y déjalo bajo 2 MB. Los datos masivos (miles de eventos, históricos
   largos) van al servidor (`GlobalState` row con su clave) o se
   compactan/agregan antes de persistir.

## Copa del Rey — sorteo de cruces (obligatorio, 2026-05-09)

Reglas del cuadro de la Copa del Rey (`static/js/copa-engine.js`,
función `_pairTeamsConstrained`):

1. **EA solo contra PF / Hyp hasta Dieciseisavos.** Cualquier equipo
   de Liga EA Sports (los 5 humanos + 15 EA-IA) debe enfrentarse a un
   equipo de Primera Federación o Hypermotion en r1, r2 y r16. Nunca
   EA-vs-EA antes de Octavos.
2. **EA-vs-EA permitido desde Octavos**, pero `_preferenceFor` prioriza
   rivales no-EA cuando el bombo aún tenga PF/Hyp disponibles para
   demorar el primer EA-vs-EA al máximo.
3. **Cuartos prefiere no-humano** (regla histórica conservada): el
   primer humano-vs-humano cae idealmente en Semifinales.
4. **Local / visitante por nivel** (no se modifica el sistema previo):
   - Single-leg (r1/r2/r16/fin): `hostIsLower=true` → el equipo de
     MENOR poder juega en su campo. El de mayor poder es visitante.
   - Two-leg (oct/cua/sf): `hostIsLower=false` → IDA en campo del de
     MAYOR poder. La VUELTA, vía el swap del engine
     (`esVuelta ? m.v : m.l`), cae siempre en el campo del de MENOR
     poder. Empate de power → desempate alfabético determinista.

Helpers asociados:
- `_isEa(t)` → considera EA a humanos + `liga-ea-sports` + TBDs cuyo
  posible ganador pueda ser EA (`tbdMayBeEa`).
- `_tbdMayBeEa(tbd)` → mira el partido pendiente de la ronda anterior
  y devuelve `true` si alguno de los 2 contendientes es humano o
  pertenece a `liga-ea-sports`.

Si el nº de equipos llega impar al sorteo, `_computeSorteoPayload`
descarta 1 IA respetando estas reglas:
- r1/r2/r16: drop EA-IA → Hyp → PF (último). Quitar un EA-IA reduce
  presión sobre el pool no-EA; quitar un PF/Hyp lo deja más justo.
- oct+: drop PF → Hyp → EA. Descartamos a los más débiles primero.
- NUNCA descartamos humanos ni TBDs (ganadores pendientes).

## Motor único de simulación IA-vs-IA (obligatorio, 2026-05-09)

**Toda simulación IA-vs-IA del proyecto** (independientemente de la
competición — Liga EA Sports, Copa del Rey, Champions League, Europa
League, Conference League, Recopa, Supercopa de Europa, Supercopa de
España, Intercontinental, Mundialito Clubes, Torneos de Verano,
amistosos, Liga Hypermotion, Primera Federación, ligas externas…)
**debe usar el motor 4-ejes de Liga EA Sports** (`_simIAvsIAWithContext`)
para que los resultados sean coherentes con los valores manuales que
el admin pone en el editor (GLOBAL/ATAQUE/MEDIO/DEFENSA + capitán).

Camino canónico:
1. **Live IA-vs-IA**: `iaSimLive(mk, home, away, j[, j1fn])` →
   internamente llama `_simIAvsIAWithContext(home, away, j)`.
2. **Batch IA-vs-IA Liga EA**: `simularJornadaIA(j)` →
   `_simIAvsIAWithContext`.
3. **Auto-sim IA-vs-IA en gm-modal** (amistosos & equivalents):
   `_gmAutoSimulateIAvsIA()` → `_simIAvsIAWithContext`.
4. **Fallback**: `_fallbackIAvsIAScore` (legacy `simSimple` sobre
   TEAM_RATINGS escalar) **solo** si el motor 4-ejes no está disponible
   en el arranque. Nunca llamar directamente a `simSimple` desde rutas
   nuevas.

Reglas a respetar:
- **Prohibido** añadir nuevos paths que llamen `simSimple(rA, rB)` con
  ratings escalares como motor primario. Usar `_simIAvsIAWithContext`
  o, en su defecto, el wrapper `iaSimLive`.
- Las cajas de Champions/EL/ECL/Recopa/USC/Inter cuando reciban su
  módulo de simulación deben hookear `iaSimLive` con prefijo `mk` y
  registrar el persistor en la cadena `__is*SimPersist` de
  `iaSimLive` (igual patrón que Recopa con `recopa_*` o Supercopa de
  España con `sc_*`).
- HvH y HvIA (con humano) NO se simulan — el humano juega en vivo en
  gm-modal o calendar cards. El AI pre-roll de HvIA en Liga EA usa
  `simSimple` (legacy, conservado por el comportamiento histórico
  documentado del flag `_pendingAIEvents`).

Helpers a reutilizar (todos en `window.*`):
- `_simIAvsIAWithContext(home, away, j)` → motor 4-ejes con
  rojas pre-roll, capitán ×1.05, localía variable seeded.
- `_teamOffense(name)` / `_teamDefense(name)` → 60% atk/def + 40%
  mid, leen `ligaExt_*` o `TEAM_RATINGS`.
- `_captainBonus(name)` → 1.05 si hay C titular, 1.0 si no.
- `_aggressivenessFactor(name)` → 0.5–1.49 para densidad de tarjetas.
- `genMatchEventsEnhanced(teamA, teamB, gh, ga, simCtx)` → eventos
  del acta (goles, tarjetas, lesiones, MVP) consistentes con el
  marcador resultante.

## Iconos del equipo y del jugador en la simulación (obligatorio, siempre)

Cada vez que se simule un partido (Liga, Copa, competiciones europeas,
amistosos o cualquier otro torneo), el motor **debe** leer y aplicar los
iconos definidos en la plantilla. Esto aplica tanto al motor Python
(`app.py`, `logica_liga.py`) como al motor JS (`static/js/*.js`,
`templates/partials/**`).

### 🛡 Nivel / valor del equipo (4 ejes manuales del admin, 2026-05-02)

Cada equipo tiene 4 valores numéricos que el admin define en el
editor de Resto de Ligas (Valor-Poder-Nivel equipo): GLOBAL, ATAQUE,
MEDIO y DEFENSA. Esos 4 números son la **fuente de verdad** y los
devuelve `computeLineStats(t)` en
`templates/partials/misc_body_1.html` tal cual — sin auto-derivar
nada de la plantilla de jugadores.

- **ATAQUE**: más ATQ → más goles marca el equipo.
- **MEDIO**: COMPENSA tanto ataque como defensa con peso `0.5` cada
  lado.
- **DEFENSA**: más DEF → menos goles encaja el equipo.
- **GLOBAL**: balance general. Inclina la probabilidad general del
  partido (peso `0.1` en `attackForce` / `defenseForce`).

Si una línea concreta está vacía o a 0, cae a GLOBAL (`t.power`)
como fallback. Si tampoco hay GLOBAL, default 50.

La plantilla de jugadores SIRVE para listar la nómina, marcar
capitán/lanzadores/goleadores y para el acta del partido. **NO** se
usa para recalcular el GLOBAL/ATQ/MED/DEF del equipo.

#### Historial de la regla (por qué llegamos aquí)

- 2026-04-28: se introdujo auto-cálculo desde la plantilla
  (`ATK = media delanteros`, etc.) para automatizar los valores en
  todas las ligas.
- 2026-05-02 (1ª iter.): el GLOBAL pasó a ser `(ATQ+MED+DEF)/3` en
  lugar de "media de top 11" porque incluir al portero inflaba la
  cifra respecto a los chips visibles.
- 2026-05-02 (2ª iter.): se añadió un toggle "🔒 Forzar valores
  manuales" para que el admin pudiera anular el auto-cálculo.
- 2026-05-02 (3ª iter., final): el usuario reportó que sus 87/88/87/86
  para el PSG bajaban a 81/78/80/84 al renderizar la clasificación —
  el toggle estaba desmarcado por defecto. Se eliminó el auto-cálculo
  por completo: `computeLineStats` devuelve siempre los valores
  manuales, sin checkbox ni opción.

El simulador `simulateMatch(tA, tB)` usa la fórmula:
```
attackForce = ATK + 0.5·MID + 0.1·GLOBAL
defenseForce = DEF + 0.5·MID + 0.1·GLOBAL
goles_A = Poisson(1.3 + 0.025·(attackForce_A − defenseForce_B))
```
Local recibe +3 al GLOBAL como ventaja de casa. Se mantiene el bonus
de capitán `×1.05` sobre el valor del equipo donde aplique.

### ⚾ Goleador nato (natGoal)

- Multiplicador `×1.8` al peso del jugador en la elección de goleador.
- El objetivo es que el goleador nato marque **≈30% de los goles del
  equipo** (ajustado 2026-04-26: antes era ×3 → ~50%).

### 🏀 Goleador estrella (natGoalPro) — prioridad máxima

- Multiplicador `×3.0` al peso del jugador en la elección de goleador.
- El objetivo es que el goleador estrella marque **≈48% de los goles
  del equipo** (rango 46-50%).
- **NO se acumula con ⚾**: si un jugador lleva 🏀, ⚾ se ignora — un
  jugador es "goleador estrella" O "goleador nato" a efectos del peso,
  no ambos. Esto evita que el peso se dispare por encima del 48%.

### P (lanzador de penaltis)

- Cuando se resuelve un penalti, el lanzador se elige preferentemente
  entre los jugadores con flag `penalty` antes de caer al algoritmo
  general.
- Además suma puntos fijos al peso de goleador cuando el gol proviene
  de penalti.

### F (lanzador de falta)

- Cuando el gol proviene de una falta directa, el ejecutante se elige
  preferentemente entre los jugadores con flag `freeKick`.
- Suma puntos fijos al peso de goleador en jugadas de falta.

### ⭐ Elite / estrella

- **NO** afecta al resultado del partido.
- Solo influye en premios individuales (MVP) y noticias.

### C (capitán) — modificador de soporte

- Si hay un capitán titular en el campo, el "valor" del equipo recibe
  un `×1.05` adicional.
- Bonus invisible: no se muestra como estadística, pero sí se aplica.

## Puntuación del MVP — realista élite (obligatorio, 2026-05-31)

**Bug (foto usuario 2026-05-31)**: el ranking de MVP de la Liga salía
LLENO de porteros (Robert Sánchez, Donnarumma, Henderson, Lammens,
Pope, Sommer… los 6 primeros porteros). Un portero NO puede ser MVP
el ~40% de los partidos — no es real.

### Causa raíz

El MVP de la simulación IA-vs-IA por lotes (`simularJornadaIA` →
`_simIAvsIAWithContext` → `genMatchEventsEnhanced` → `genMatchEvents`)
se elegía con un sorteo ponderado donde el **portero con portería a
cero pesaba +4.0** mientras cada jugador de campo sólo +0.5 y un gol
+3.0. Como las porterías a cero son MUY comunes en sims de pocos goles
(y un 0-0 da +4.0 a LOS DOS porteros), los metas ganaban ~40-44%.

### Modelo nuevo (en `genMatchEvents`, `part2/misc_body_2.html`)

Sorteo ponderado por jugador:

- **Base por posición** (todo jugador de campo entra): Delantero (F)
  **1.6** · Medio (M) **1.0** · Defensa (D) **0.55** · posición
  desconocida 0.8.
- **Gol marcado**: **+3.0** cada uno (doblete/hat-trick casi siempre
  se lleva el MVP).
- **Gol decisivo** (el `(golesPerdedor+1)`-ésimo gol del ganador, el
  que pone por delante para no devolver la ventaja): **+1.5** a su
  autor.
- **Portero con portería a cero**: **+2.0** (antes 4.0). **Sin**
  portería a cero el portero NO entra al sorteo.
- **Sesgo al equipo ganador**: base de campo **×1.15** al ganador,
  **×0.85** al perdedor (empate → ×1.0). El MotM casi nunca sale del
  equipo goleado.

Distribución resultante (Monte-Carlo 300 k partidos, marcador
Poisson λ≈1.35): **F 61% · M 21% · D 7% · Portero 7%** global, con
picos legítimos por marcador (0-0 ≈ 17% portero, partidos decididos
≈ 0%).

### Reglas a respetar

1. **PROHIBIDO** devolver el peso del portero con portería a cero a
   4.0 (ni nada que lo haga dominar el sorteo). El tope realista es
   ~+2.0 frente a un gol +3.0 y bases de campo por posición.
2. **PROHIBIDO** dar a un portero que ENCAJA peso de MVP. Sólo entra
   al sorteo con portería a cero (+ futuros bonus tipo penalti parado
   si se añaden).
3. El motor de partido EN VIVO (`index.bundle.js`, ticker IA-vs-IA) y
   el de Copa (`copa-engine.js`) ya son realistas (el portero sólo
   puntúa por `pen-parado`, sin bonus de portería a cero) — **no**
   reintroducir un bonus de clean-sheet ahí.
4. Toda comp/motor NUEVO que elija MVP debe mantener esta jerarquía:
   atacantes que marcan ≫ mediocampistas ≫ defensas > porteros.

## Propagación de flags al motor

Los flags viven en el editor de plantilla y se guardan en
`window._LIGA_EA_PLAYER_FLAGS` (JS). Toda función que construya entradas
de jugador para la simulación (`sqFromRegistry`, builders similares)
**debe** propagar los 6 flags (`captain`, `freeKick`, `penalty`,
`elite`, `natGoal`, `natGoalPro`) a cada entry. No basta con propagar
solo `elite`/`natGoal`.

## Qué NO hacer

- No cambies los pesos numéricos anteriores (×1.8 natGoal, ×3.0
  natGoalPro, ×1.05 capitán, etc.) sin acordarlo explícitamente con el
  usuario.
- No añadas simulación nueva sin que consuma estos flags.
- No borres flags al serializar/deserializar plantillas.


## Clasificación a competiciones europeas (obligatorio, 2026-05-02)

Para que un equipo de Resto de Ligas vaya a una competición europea
**directa** (UCL fase de liga, Previa Champions, UEL, UECL) basta con
que haya jugado **al menos 1 partido** en su liga. El check per-team
es: `pj === 0` (cuando hay resultados parciales) → SKIP ese equipo y
avanzar al siguiente del ranking. Esto cubre exactamente el bug
original — equipos sin partido jugado que sorteaban al top por
desempate alfabético sobre `pts=0` tras una Sim batched/asíncrona.

Filosofía: una liga parcialmente simulada SÍ debe contribuir sus
equipos "reales" (los que han jugado al menos algo), no solo los
fully-played. Una liga sin simular nada (rN=0) usa `_rankByPower`
como siempre — todos los teams tienen pj=0 pero es la única señal
disponible.

Las zonas **feeder** (`uclQual` = Open Qualifier, `wildcard`) son
permisivas a propósito — alimentan al OQ y al pool de Previa
Champions, NO clasifican directo a una competición europea. Aceptan
teams con pj=0 sin filtro, para no dejar plazas TBD-OQ-XX.

Lógica en `_computeQualifiedFromLeagues(zoneKey)` (`misc_body_1.html`):

1. Para zonas directas (`ucl`/`uclPrev`/`uel`/`uecl`):
   - Si `rN === 0` → ranking por power (rank-by-power), sin filtro.
   - Si `rN > 0` → ranking por resultados (standings); descartamos
     SOLO los teams con `pj === 0` (race condition / data stale).
2. Para zonas feeder (`uclQual`/`wildcard`), no se aplica filtro.
   Aceptan rank-by-power y standings parciales tal cual.
3. Excepciones absolutas (cualquier zona):
   - **Liga EA Sports / Hypermotion / 1ª RFEF** → bloqueadas en
     `EUROPE_BLACKLIST` (manual-only vía pantalla "EA Sports → Europa").

Bug histórico que motivó el filtro per-team: tras pulsar Sim en una
liga, la escritura de resultados era batched/asíncrona. Durante esa
ventana el admin abría la pantalla de Europa y
`_computeQualifiedFromLeagues` veía `rN > 0` pero `pj === 0` para
varios equipos. Esos equipos empataban a `pts=0` y sorteaban a las
primeras posiciones por desempate alfabético sobre el nombre — el
código los enviaba a Europa con 0 partidos jugados. El check
`pj === 0 → continue` los descarta.

Por qué NO hay gate de liga (`rN < needed → skip whole league`) ni
gate per-team estricto (`pj < expectedPj`): ambos se intentaron en
los commits `c983a56` y `3fb9247` pero resultaron demasiado coarse —
descartaban ligas parciales enteras o teams legítimos que habían
jugado varios partidos pero la liga seguía a medias, dejando el pool
de Previa Champions con TBD-50..63 (reportado por el usuario con
fotos). El check `pj === 0` es exactamente la condición del bug
original sin destruir contribuciones legítimas.

## EXENTOS Previa Champions (OBSOLETO desde 2026-05-30)

> ⚠️ **OBSOLETO**: la Previa pasó a **fase de grupos pura + corte
> global** (ver sección "Wild Card + Open Qualifier — FASE DE GRUPOS"
> arriba). Ya **no hay** Ronda 1 eliminatorias, ni Ronda Final, ni
> EXENTOS, ni `splitByesAndR1`. Esta sección se conserva solo como
> histórico. **PROHIBIDO** reintroducir los EXENTOS / `splitByesAndR1`.

Los 3 EXENTOS — los equipos que pasan directos a la Ronda Final de la
Previa de Champions sin jugar la Ronda 1 de eliminatorias — siguen una
regla concreta del usuario, no "los 3 mejores por power":

1. **Bye fijo**: el 5º clasificado de Liga EA Sports. Entra al pool de
   Previa por la pantalla manual "EA Sports → Europa" (Liga EA está
   blacklisted del cómputo automático), así que en el pool tiene
   `league: 'ea-sports-manual'`. Si el admin añadió varios manuales
   para `uclPrev`, prevalece el de mayor power.
2. **2 byes aleatorios**: 2 elegidos al azar de entre los 2º
   clasificados de **Bélgica, Turquía, Suiza, Dinamarca y Escocia**.
   En el pool tienen `league` igual al slug del país. El sorteo se
   renueva en cada `Draw` (`splitByesAndR1` en `misc_body_2.html`).
   Una vez sorteados, los byes se persisten en `wprev_state_v1`, así
   que sobreviven a recargas hasta el próximo Draw.
3. **Fallback**: si faltan candidatos (admin no añadió el español o
   alguna de las 5 ligas no está simulada), se rellena con los
   siguientes equipos del pool por power para no dejar plazas vacías.

Los otros 60 equipos del pool (los no-bye) se dividen en CABEZAS de
serie (los 30 mejores por power) y NO CABEZAS (los 30 peores) y
forman las 30 eliminatorias de Ronda 1.

## Cronómetro del partido — BASE INMUTABLE (obligatorio, 2026-05-10)

**PRECEDENTE PERMANENTE**: el cronómetro de simulación tiene que
correr siempre del minuto 0 al minuto 90 (más descuento) en
**TODAS** las competiciones (Liga EA Sports, Superliga, Copa del
Rey, Champions League, Europa League, Conference League, Recopa,
Supercopa España, Supercopa Europa, Intercontinental, Mundialito
Clubes, Torneos de Verano, amistosos, Liga Hypermotion, Primera
Federación, fases finales de Selecciones, eliminatorias únicas, y
cualquier otra que se añada en el futuro), en los 3 modos:

- **IA vs IA** (1 game-min = 1 sec real, total 1m 30s)
- **HvH** (humano vs humano)
- **HvIA** (humano vs IA / IA vs humano)

Esta regla es **bloqueante absoluta** — ninguna PR puede dejar el
cronómetro clavado en 0' en ninguna competición ni modo. Si un
cambio rompe el avance del cronómetro, ese cambio se REVIERTE.

### Anti-patrones prohibidos (que rompieron el cronómetro en 2026-05-10)

1. **MutationObserver global sobre `document.body` con
   `subtree:true`** que dispara funciones costosas en CADA
   mutación del DOM. Crea bucles porque casi cualquier cosa
   modifica el DOM. → Usa polling con `setInterval` o un observer
   restringido a un nodo concreto.

2. **Bucles `observer → setProperty/classList → observer`**
   sin guard. Toda función que aplique estilos/clases debe ser
   IDEMPOTENTE: cachear una firma (`comp|home|away` o similar) en
   el elemento y `return` temprano si no cambió.

3. **Polling agresivo (< 100ms) competiendo con el setInterval
   del cronómetro**. El timer IAvsIA corre a 1 sec/min, HvH a
   ~875ms/tick. Un `setInterval(fn, 50)` que llama a funciones
   DOM-heavy puede bloquear el event loop y saltar ticks del
   cronómetro. Mínimo recomendado: **100ms para hints visuales,
   300ms para escaneos de cards**.

4. **MutationObserver sobre el propio elemento que el observer
   modifica** sin filtro de "cambió de verdad". Ejemplo: observer
   sobre `#gm-modal[attributes]` que dispara `_gmApplyTheme` →
   `_gmApplyTheme` hace `style.setProperty` → mutación → observer
   → loop. → Filtrar por `prevDisplay !== disp` antes de actuar.

### Patrón canónico para post-procesadores UI de las cards

```js
function _applyThing(el){
  if (!el) return;
  var sig = _computeSig();           // p.ej. comp|home|away
  if (el._lastSig === sig) return;   // GUARD — sin mutations
  el._lastSig = sig;
  // … aplicar estilos / clases / atributos …
}
// Observer SOLO de cambios de display:
var prevDisplay = el.style.display;
new MutationObserver(function(){
  if (el.style.display === prevDisplay) return;
  prevDisplay = el.style.display;
  if (el.style.display === 'none'){
    el._lastSig = null;              // reset al cerrar
    return;
  }
  _applyThing(el);
}).observe(el, { attributes:true, attributeFilter:['style'] });
// Polling de respaldo a ≥100ms con classList.contains() check
// antes de add/remove para evitar mutations innecesarias.
```

Las funciones helper deben usar `_setHintIfChanged(btn, want)` —
comprobar el estado actual antes de mutar.

### Histórico

- 2026-05-10: `MutationObserver` en `document.body[subtree:true]`
  + observer en `#gm-modal[attributes]` + `_gmApplyTheme`
  no-idempotente + polling 50/100ms bloquearon el thread JS y los
  cronómetros de TODAS las competiciones se quedaron clavados en
  0'. Fix: guards de idempotencia, observer restringido a `style`
  con filtro `prevDisplay`, eliminado el observer global, polling
  100/300ms con `_setHintIfChanged`. Documentado aquí como
  precedente permanente.

## Duración del cronómetro del partido (obligatorio, siempre)

**TIEMPOS OFICIALES** (definidos en
`templates/partials/part2/misc_body_2.html`, bloque `_MATCH_RULE`):

| Modo  | gameMin | realMin | displayMin (previa) | ms/tick (5s juego) | s/game-min |
|-------|---------|---------|---------------------|--------------------|------------|
| HvH         | 90 | 16.5  | 10 | ≈ 917 ms | 11 s  |
| HvH prórroga| 30 |  5    | —  | ≈ 833 ms | 10 s  |
| HvIA        | 90 | 9.75  |  8 | ≈ 542 ms |  6.5 s|
| IAIA        | 90 |  1.5  | "45 s/parte" | ≈ 83 ms | 1 s |

- HvH = humano vs humano → **16.5 min reales**. Previa: "10 min". 1 game-min = 11 s reales.
- HvIA = humano vs IA / IA vs humano → **9.75 min reales** (9 min
  45 s). Previa: "8 min". 1 game-min = 6.5 s reales.
- IAIA = IA vs IA → **1 min 30 s reales total** (45 s por parte). 1 game-min = 1 seg real.
- HvH_ET = prórroga humana → 5 min reales.

**REGLA DE ORO 2026-05-19**: `displayMin` (lo que la previa MUESTRA)
y `realMin` (lo que el cron REALMENTE dura) están **DESACOPLADOS** por
petición explícita del usuario. El cron va al ritmo eFootball (11 s/6.5 s
por game-min) mientras la previa muestra "10 min" / "8 min" porque ese
es el número "de referencia" en su memoria. La alineación display=real
del 2026-05-10 (HvH 6.67 s, HvIA 5.33 s) quedó rescindida porque el
cron iba más rápido que eFootball y la vida real.

Historial:
- Pre 2026-04-26: HvH 11 s, HvIA 9 s.
- 2026-04-26 (intermedio): HvH 10.5 s, HvIA 6.5 s.
- 2026-05-10 (alineación display=real): HvH 6.67 s, HvIA 5.33 s.
- 2026-05-19: vuelta al pre-mayo (HvH 11 s, HvIA 9 s) con display desacoplado.
- 2026-05-21: HvIA recalibrado a **7.4 s/game-min** (11.1 min reales).
  El usuario midió "min 45 del juego = min 37 del simulador" con el
  cron a 9 s/game-min → `9 × 37/45 = 7.4 s/game-min` es el ritmo real
  de su eFootball. Con web y juego al mismo ritmo, el minuto del cron
  coincide con el del juego. HvH se mantiene en 11 s. Display previa
  HvIA sigue en "8 min".
- 2026-05-22: HvIA recalibrado a **6.5 s/game-min** (9.75 min reales,
  9 min 45 s). El usuario pidió bajar el cron de la 1ª parte de
  "7 segundos con algo" a 6.5 s. Aplica a todo el partido (HvIA =
  IA vs Humano y Humano vs IA, ambos modos). HvH se mantiene en
  11 s. Display previa HvIA sigue en "8 min".

Estos valores los puede ajustar el usuario mediante petición explícita.
No cambiar sin acuerdo.

`realMin` controla el cronómetro real. `displayMin` / `displayLabel`
controlan SOLO el label visible en la pantalla de PREVIA — están
desacoplados a petición del usuario.

### Inicio de la 2ª parte (obligatorio)

Tras el descanso (HT), al pulsar ▶️ "continuar 2ª parte" el cronómetro
de juego debe arrancar SIEMPRE en `45:00` exacto, NO en `45+N` ni en
`46:00`/`47:00`/`48:00`. El descuento de la 1ª parte ya se mostró
durante "45+1, 45+2…" antes del descanso, así que se descarta al
reanudar. Se aplica tanto al flujo `_ml*` (calendar cards,
`_mlResumeFromDescanso`) como al gm-modal (`gmContinueSecondHalf`):
ambos hacen `timerSec = 2700` y re-anclan `_wallStart` /
`_secAtStart` antes de arrancar el interval.

### Descuento FIJO en regulación (obligatorio, 2026-05-19)

`gameMin = 90` significa que el reloj llega a 90:00 en "tiempo normal".
El descuento de cada parte está **FIJADO** (petición usuario
2026-05-19, no event-driven):

- **1ª parte**: SIEMPRE recorre `45+1, 45+2, 45+3, 45+4` y se **CONGELA
  en 45+4** hasta que el humano pulse `🛌 DESCANSO`.
- **2ª parte**: SIEMPRE recorre `90+1, 90+2, … 90+9` y se **CONGELA
  en 90+9** hasta que el humano pulse `🏁 FINALIZAR`.

El botón `🛌 DESCANSO` emerge en el **min 35** (umbral
`timerSec >= 2100`, petición usuario 2026-05-22; antes min 40).
El botón `🏁 FINALIZAR` cambia a **rojo
brillante pulsante** (clase `.is-near-end`) desde el **min 80**
(`timerSec >= 4800`) hasta que el humano la pulse — la fase
`matchOver` (timerSec ≥ fullMax con cron congelado) sigue mostrando
`🏁 VER RESUMEN` en verde-dorado (precedente 2026-05-17).

El botón `⏱ PRÓRROGA` (gm-modal, `gm-btn-et`) solo emerge desde el
**min 80** (`timerSec >= 4800`) y SOLO si el partido va en empate sin
resolver (`_shouldForceET` — contexto eliminatoria, marcador igualado,
ET/penaltis no jugados). Antes del min 80 la única acción es
`🏁 FINALIZAR`. Petición usuario 2026-05-22: "el botón de prórroga
tiene que emerger en el minuto 80 en el caso de que vayan empate, no
durante todo el partido".

Helper: `window._mlCountStoppageHalves(st)` →
- `{first: 4, second: 9}` para HvH/HvIA en regulación
  (`!st.etDone && !st.isIAvsIA`).
- Event-driven (cuenta eventos del acta) para IA vs IA
  (`st.isIAvsIA`) y para prórroga (`st.etDone`).

**HvIA — slowdown ×1.5 durante el descuento** (petición usuario
2026-05-24). En HvIA / IAvH (un humano contra IA), cada game-minute
del descuento dura **1.5× lo que duraría con el ritmo actual**:

- 1ª parte (`45+1..45+4`): rearm del interval al cruzar `timerSec
  >= 2700` con `tickMs *= 1.5`. Solo HvIA, no HvH ni IAIA.
- 2ª parte (`90+1..90+9`): rearm al cruzar `timerSec >= 5400` con
  `tickMs *= 1.5`. Se aplica **encima** del slowdown +0.5 s/min del
  min 65 (multiplicativo).

Flags persistidos en `st` (ml-card) / `_gm` (gm-modal):
`_stop1Applied`, `_stop2Applied`. Se setean al rearmar para evitar
re-arms en cada tick. La detección vive en `_mlResolveClock` cuando
recibe `timerSec`, `htDone`, `etDone`:
- `inStop1 = !htDone && timerSec >= 2700 && timerSec < 5400`
- `inStop2 = htDone && timerSec >= 5400 && timerSec < 7200`

HvH y IAIA NO se ralentizan en el descuento — solo HvIA.

**IA vs IA mantiene descuento event-driven** (petición usuario
2026-05-19): cada gol/tarjeta/lesión/etc. en una parte añade
+1 game-min al tope de esa parte. Los partidos IA-vs-IA no tienen
humano que pulse DESCANSO/FINALIZAR, así que el descuento "natural"
por eventos sigue siendo útil para que partidos con muchos goles
duren un poco más.

PRÓRROGA mantiene el modelo legacy event-driven (no tocado en
2026-05-19). HvH y HvIA en gm-modal: cuando `timerSec ≥ gmHalfMax`
con humano, el reloj se CONGELA en `gmHalfMax` (sin auto-halftime)
— el cron sólo avanza tras pulsar DESCANSO. Misma regla en
ml-cards. IA vs IA mantiene auto-descanso / auto-finalize.

Histórico:
- 2026-05-09: introducido descuento dinámico event-driven (+1
  game-min por evento, sin tope).
- 2026-05-19: usuario pide caps fijos +4 / +9 porque (a) partidos
  con muchos eventos producían descuentos absurdos (90+12, 90+15) y
  (b) partidos sin eventos no tenían descuento alguno. Ahora la
  ventana es predecible y siempre la misma.

### Fuente única

La velocidad del reloj (`tickMs`) SIEMPRE debe salir de
`window._mlResolveClock({ isHvH, etDone, home, away })` o su alias
`window._mlTickMs(st)`. El label visible SIEMPRE debe salir de
`window._mlRealDurationLabel({ isHvH, humanInvolved })`.

**PROHIBIDO**:
- Hardcodear `"15 min 45 s"`, `"9 min 45 s"`, `"10 min"`, `"8 min"` o
  cualquier duración.
- Cachear `tickMs` en variables de módulo al cargar (hay que leerlo en
  cada arranque del reloj porque el admin puede cambiar el override).
- Duplicar tablas `_MATCH_RULE` / `_MATCH_TICKS`.
- Añadir "campo mode" u otros atajos visuales que extiendan la duración
  real de IAIA por encima de 90 s.
- Reintroducir botones ⏪/⏩ de retrasar/adelantar tiempo en partidos
  HvH/HvIA. El usuario los retiró (2026-04-26) porque ocupaban
  demasiado espacio en el header del cronómetro y desplazaban los
  nombres de los equipos. Solo botón ▶ visible.

### Override admin (`_ppDurationMin`)

- Solo aplica a partidos con humano (HvH / HvIA). No toca IAIA.
- Se aplica reescalando `tickMs = realMs / totalTicks`, manteniendo el
  mismo número de ticks totales (no rompe la progresión de eventos).
- El helper `_mlResolveClock` ya lo consume. Cualquier ruta nueva debe
  usar el helper, no leer `_MATCH_TICKS` directamente.
