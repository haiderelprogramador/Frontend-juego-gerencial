# Respuestas del cliente — ronda 2 (paso 8)

**Fuente:** respuestas del cliente a las 14 preguntas del documento *"Preguntas pendientes para el cliente"* (armado a partir de `docs/00`, `docs/02`, `docs/03`, `docs/05` y el contrato de API borrador). Recibidas y transcritas por el usuario, no es cita textual grabada — se marcan igual como ✅ requisito oficial porque vienen directo del cliente, con la misma salvedad de siempre: si aparece luego una fuente más formal (transcripción, documento del cliente) con más detalle, esa versión manda sobre esta.

Se numeran igual que las preguntas originales, por tema.

---

## 1. Roles y acceso

✅ REQUISITO OFICIAL — **Docente y Admin son el mismo rol técnico.** No hay que modelar dos roles con permisos distintos — un solo rol cubre ambos casos.

**Esto cierra la pregunta abierta #7 de `docs/00` y la de `docs/03`.**

## 2. Autenticación y carga de usuarios

✅ REQUISITO OFICIAL — El Excel de carga masiva trae, como mínimo: **correo, nombre, número de identificación, edad y género.**

✅ REQUISITO OFICIAL — La contraseña generada automáticamente **se envía al correo del estudiante** (el que viene en el Excel). El estudiante **puede cambiarla si quiere, pero no está obligado** — no es un cambio forzoso en el primer login.

⚠️ **Inconsistencia a aclarar antes de programar el generador de contraseñas:** el cliente describió el patrón como *"número de identificación + USU"*, lo cual **invierte el orden** documentado en `docs/03` a partir de tu resumen anterior (`USU-001-NUMERODEIDENTIFICACION`, con "USU" primero). No es una contradicción grave, pero sí hace falta un **ejemplo literal** de un caso real (ej. ¿es `12345678USU`? ¿`USU-12345678`? ¿lleva guiones o el `001` de antes?) antes de implementar el generador — no se debe asumir un formato exacto con dos descripciones distintas sobre la mesa. 🔎 Recomendación: pedir al cliente un ejemplo concreto con un número de identificación de prueba.

## 3. Categorías y catálogo de decisiones

✅ REQUISITO OFICIAL — Quedan **cerradas exactamente las tres categorías** ya conocidas: operacionales, administrativas, comerciales. No hay una cuarta.

✅ REQUISITO OFICIAL — El **catálogo de decisiones no es editable por el docente** desde el sistema. Viene precargado/fijo (queda por definir, en otro momento, quién y cómo lo carga — pero no es una pantalla de edición para el docente).

**Esto cierra la pregunta abierta "¿son 2 o 3 categorías?" de `docs/00` y de `docs/05` punto 2.**

## 4. Períodos y cálculo de resultados

✅ REQUISITO OFICIAL — **El Docente es quien cierra el período** / decide cuándo termina la simulación. No es una acción que el Estudiante pueda hacer.

**Esto cierra la pregunta abierta #1 de `docs/00` y `docs/05` punto 1** — confirma la duda que ya se tenía sobre el prototipo del compañero (que lo ponía en manos del estudiante).

✅ REQUISITO OFICIAL — **El valor sorteado dentro de un rango se guarda de forma permanente** (no se recalcula). Esto confirma la recomendación técnica que ya se había dejado en `docs/02` punto 6.

## 5. Equipos y estructura del curso

✅ REQUISITO OFICIAL — **No existe el concepto de "Curso"** agrupando equipos (el cliente lo aclara con la salvedad "que yo sepa" — no se cierra al 100%, pero no se debe modelar como entidad por ahora).

✅ REQUISITO OFICIAL, con una lectura que conviene confirmar con un ejemplo — **todos los equipos de una misma simulación comparten la misma "empresa" base**: el cliente lo describe como *"un equipo estará en una empresa, pero diferentes equipos estarán en la simulación con la misma empresa"*. 🔎 Interpretación: cada simulación arranca con una sola empresa "molde" (nombre y situación inicial predefinidos por el caso), y cada equipo gestiona su propia copia/instancia de esa empresa, divergiendo con el tiempo según sus decisiones — no es que varios equipos administren literalmente la misma empresa a la vez. Esta lectura es consistente con la siguiente respuesta (el nombre de la empresa viene predefinido) y con lo que ya traía el prototipo (`docs/05`: "TechStart S.A." como nombre genérico, pero cada equipo mostrado con resultados distintos). ❓ Vale la pena confirmarlo con un ejemplo concreto en la próxima reunión (ej. "el Equipo A y el Equipo B, ¿son dos 'TechStart S.A.' independientes, cada una con sus propios números?").

✅ REQUISITO OFICIAL — El **nombre de la empresa viene predefinido** (no lo elige el equipo/estudiante).

## 6. Clasificación (ranking)

✅ REQUISITO OFICIAL (de alcance, no de diseño) — **El ranking/Clasificación no es prioridad ahora** — el cliente lo deja para más adelante. No se define todavía la fórmula de puntaje.

🔎 Implicación práctica: la pantalla de Clasificación puede seguir construyéndose a nivel visual (ya está en el diseño), pero **no hay que invertir tiempo ahora en definir la lógica real del cálculo del puntaje** — eso queda pendiente para una ronda posterior con el cliente.

## 7. Documentación pendiente

✅ REQUISITO OFICIAL — **No existe un documento de "caso de negocio" fijo.** El caso lo **configura el docente directamente en el sistema, en el momento**. Esto confirma y le da sentido a la pestaña "Casos" que ya estaba contemplada dentro del Panel del Docente en el diseño visual — es justo donde el docente arma el caso, no una pantalla de solo lectura de un documento externo.

❓ **Sin responder todavía** — quedan pendientes para una próxima ronda:
- ¿Hay más transcripción disponible de la reunión original?
- ¿El diagrama de carriles (swimlane) es un entregable formal pedido por el profesor, con fecha y formato definidos?

---

## Resumen de impacto en lo ya construido

Estas respuestas afectan directamente al diseño visual y al contrato de API que ya se armaron antes de esta ronda:

- **Pantalla "Toma de Decisiones" (Estudiante):** el botón "Cerrar periodo" del pie de página **no debería estar ahí** — esa acción es exclusiva del Docente. El estudiante solo debería tener "Guardar borrador" (o un equivalente de "enviar mis decisiones", distinto de cerrar el período completo).
- **`docs/07-contrato-api-backend.md`** (contrato de API): de los 5 endpoints marcados ❓, esta ronda resuelve 3 directamente —
  - `POST /periodos/{id}/cerrar` → actor autorizado: **Docente**, no Estudiante.
  - CRUD de Casos → **sí existe** (el docente configura el caso en el sistema), pero el CRUD del **catálogo de decisiones no** (queda fijo/precargado).
  - `POST /auth/cambiar-contrasena` → existe, pero es **opcional**, no forzoso en el primer login; falta el patrón exacto de la contraseña generada para poder implementar el generador (ver punto 2 arriba).
  - Quedan sin resolver todavía: la fórmula de puntaje de Clasificación (se pospuso, no se resolvió) y si el valor de decisiones administrativas/operacionales tiene alguna particularidad adicional no cubierta aquí.
- **Modelo de datos (Equipos/Empresa):** si la lectura de la sección 5 es correcta, no hace falta una entidad "Curso", y "Empresa" probablemente deba modelarse como **una instancia por equipo** (con un nombre predefinido compartido entre equipos de la misma simulación, no una fila compartida en base de datos) — pero esto **no se debe programar todavía como definitivo** sin el ejemplo de confirmación pedido arriba.
