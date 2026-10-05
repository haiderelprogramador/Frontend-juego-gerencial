# Requisitos del backend (Spring Boot) — paso 9

**Qué es:** qué tiene que **hacer** el backend, no solo qué endpoints expone.
Sigue siendo diseño/documentación — **no hay código de backend todavía**.

**Fuentes** (leídas en este orden, sin inventar nada fuera de ellas):
`docs/00-resumen-proyecto.md` (regla de oro + resumen de lo confirmado),
`docs/02-hallazgos-reunion-cliente.md` (reglas de negocio originales),
`docs/08-respuestas-cliente-ronda-2.md` (segunda ronda de respuestas) y
`docs/07-contrato-api-backend.md` (endpoints ya propuestos, **con las 3
correcciones aplicadas**: cerrar período = Docente, CRUD de Casos sí existe,
CRUD de Catálogo no existe).

**Etiquetas** (las mismas del resto de `docs/`):
✅ CONFIRMADO · 🔎 INFERENCIA · 🎨 PROPUESTA DEL EQUIPO · ⚠️ SUPOSICIÓN · ❓ POR CONFIRMAR.

> Nota de archivo: en el repo el resumen está como `docs/00-resumen-proyecto_1.md`
> (con sufijo `_1`); conviven copias `_1` de `docs/03`, `docs/05` y `README`.
> Este documento se refiere al contenido de `docs/00`, no al nombre de archivo.

---

## Parte 1 — Endpoints finales (tabla consolidada)

Consolidación de `docs/07` §2 ya corregido. **`docs/07` sigue siendo la fuente**
para DTOs, códigos de error, etiqueta de confianza por endpoint y notas de
diseño; aquí solo se resume en un lugar. 31 endpoints, 0 marcados ❓.

### Autenticación

| # | Método + ruta | Quién | Qué hace |
|---|---|---|---|
| A1 | `POST /api/auth/login` | Ambos | Inicia sesión; el backend deduce el rol por las credenciales. ✅ |
| A2 | `POST /api/auth/registro-docente` | Público | Crea una cuenta de rol `DOCENTE` (el estudiante no se autorregistra). ✅ |
| A3 | `GET /api/auth/sesion` | Ambos (con token) | Devuelve el usuario del token; rehidrata la sesión al recargar. 🔎 |
| A4 | `POST /api/auth/cambiar-contrasena` | Cualquier autenticado | Cambia la propia contraseña desde el perfil. **Opcional**, no bloqueante en el primer login. ✅ |
| A5 | `POST /api/auth/logout` | Ambos | Invalida el token en servidor (solo si se quiere invalidación real). ⚠️ |

### Carga masiva de estudiantes (rol DOCENTE)

| # | Método + ruta | Quién | Qué hace |
|---|---|---|---|
| E1 | `POST /api/docente/estudiantes/carga-masiva` | Docente | Crea estudiantes de un lote; el backend asigna consecutivo, genera la contraseña y **la envía por correo**. Columnas: correo, nombre, identificación, edad, género. ✅ |
| E2 | `GET /api/docente/estudiantes` | Docente | Lista los estudiantes ya cargados. 🔎 |
| E3 | `POST /api/docente/estudiantes/carga-masiva` (multipart) | Docente | Opción B: el backend recibe el `.xlsx` y lo parsea. ⚠️ (solo si se decide) |

### Equipos (no hay concepto de "Curso")

| # | Método + ruta | Quién | Qué hace |
|---|---|---|---|
| Q1 | `GET /api/docente/equipos` | Docente | Lista los equipos con integrantes y estado. ⚠️ |
| Q2 | `POST /api/docente/equipos` | Docente | Crea un equipo y le asigna estudiantes (sin `nombre`: la empresa lo trae del caso). ⚠️ 🎨 |
| Q3 | `PUT /api/docente/equipos/{id}` | Docente | Cambia integrantes. ⚠️ |
| Q4 | `DELETE /api/docente/equipos/{id}` | Docente | Elimina un equipo (antes de abrir período). ⚠️ |
| Q5 | `GET /api/estudiante/equipo` | Estudiante | Consulta su propio equipo. ⚠️ |

### Casos (los configura el docente en el sistema)

| # | Método + ruta | Quién | Qué hace |
|---|---|---|---|
| C1 | `GET /api/casos` | Ambos | Lista los casos disponibles. ✅ concepto |
| C2 | `GET /api/casos/{id}` | Ambos | Detalle de un caso: texto informativo + estados financieros iniciales. ✅ concepto |
| C3 | `PUT /api/docente/simulacion/caso-activo` | Docente | Fija el caso activo de la simulación. ⚠️ |
| C4 | `POST/PUT/DELETE /api/casos/{id}` | Docente | **CRUD de casos**: el docente arma/edita el caso en el sistema. ✅ existe (docs/08 §7) |

### Catálogo de decisiones (fijo/precargado — sin CRUD)

| # | Método + ruta | Quién | Qué hace |
|---|---|---|---|
| K1 | `GET /api/casos/{id}/catalogo-decisiones` | Ambos | Menú de decisiones del caso: por decisión → texto, categoría, tipo de control, opciones con su efecto (rango). ✅ concepto |
| — | *(sin endpoint de escritura)* | — | El catálogo **no es editable por el docente** (docs/08 §3). |

### Períodos y decisiones tomadas

| # | Método + ruta | Quién | Qué hace |
|---|---|---|---|
| P1 | `GET /api/simulacion/periodo-actual` | Ambos | Estado del período vigente (número, caso, abierto/cerrado, fecha de cierre, recibiendo decisiones). ✅ concepto |
| P2 | `POST /api/docente/periodos` | Docente | Configura y **abre** el siguiente período. ⚠️ 🎨 |
| P3 | `PATCH /api/docente/periodos/{id}` | Docente | Enciende/apaga "recibiendo decisiones". ⚠️ 🎨 |
| P4 | `PUT /api/estudiante/periodos/{id}/decisiones` | Estudiante | El equipo **guarda/envía** sus decisiones (borrador o envío). **No cierra el período.** ✅ concepto |
| P5 | `GET /api/estudiante/periodos/{id}/decisiones` | Estudiante | Carga las decisiones guardadas del equipo. ⚠️ |
| P6 | `POST /api/docente/periodos/{id}/cerrar` | **Docente** | Cierra el período y dispara el cálculo por lote. ✅ actor confirmado (docs/08 §4) |
| P7 | `POST /api/docente/periodos/{id}/recordatorio` | Docente | Notifica a los equipos que no enviaron. ⚠️ 🎨 |

### Resultados / Reportes financieros

| # | Método + ruta | Quién | Qué hace |
|---|---|---|---|
| R1 | `GET /api/estudiante/periodos/{id}/resultados` | Estudiante (su equipo) / Docente (cualquiera) | Resultados del período: KPIs con variación, estado de resultados por líneas, estado "publicado". ✅ concepto |
| R2 | `GET /api/estudiante/resultados/historico` | Estudiante / Docente | Serie de los últimos N períodos (ingresos vs. costos). ⚠️ 🎨 |

### Clasificación

| # | Método + ruta | Quién | Qué hace |
|---|---|---|---|
| L1 | `GET /api/clasificacion` | Ambos (misma vista) | Ranking de equipos (posición, tendencia, ingresos, margen, puntaje). Vacío hasta cerrar el primer período. ⚠️ 🎨 — **fórmula de puntaje ❓ pospuesta** (docs/08 §6) |

### Parámetros

| # | Método + ruta | Quién | Qué hace |
|---|---|---|---|
| M1 | `GET /api/docente/parametros` | Docente | Lee los parámetros de mercado/escenario (crecimiento del sector, rango mín–máx por efecto). ⚠️ |
| M2 | `PUT /api/docente/parametros` | Docente | Actualiza esos parámetros (modelo de rango `{min,max}`, no valor fijo). ⚠️ (ver D14 en docs/07) |
| M3 | `POST /api/docente/casos/{id}/estados-iniciales` | Docente | Carga por Excel los estados financieros iniciales del caso. 🎨 ⚠️ |

---

## Parte 2 — Qué tiene que hacer el motor de cálculo

Derivado **estrictamente** de reglas confirmadas. Cada punto lleva su etiqueta;
lo que no está resuelto queda ❓ y **no se propone solución propia**.

### 1. Cerrar un período procesa TODO el mercado a la vez, no equipo por equipo

✅ CONFIRMADO (`docs/02` §7; `docs/08` §4 confirma que lo dispara el Docente vía
**P6**).

El motor **no puede** calcular los resultados de un equipo de forma aislada. Al
cerrar el período tiene que:

- Tomar **todas las empresas del mismo mercado en ese período** y procesarlas
  **en un solo lote / transacción**.
- Calcular primero la demanda y la **participación de mercado** del conjunto,
  porque lo que un equipo pierde de participación **se reparte entre los demás**
  (ver punto 9), y recién después derivar el estado financiero de cada empresa.
- Ser **idempotente / atómico**: si falla a mitad, ningún equipo queda con
  resultado parcial.

❓ POR CONFIRMAR — **qué agrupa a las empresas como "un mismo mercado"**. No
existe el concepto de "Curso" (`docs/08` §5), así que 🔎 la unidad de lote es
*todos los equipos de la misma simulación*; falta que el cliente lo confirme
explícitamente.

### 2. "No tomar una decisión" nunca es un vacío: siempre se aplica una opción del catálogo

✅ CONFIRMADO (`docs/02` §1 "no decidir también tiene efecto"; `docs/02` §5 y
`docs/00` punto 4: "no hacer nada" es una **opción explícita** del catálogo, con
su propio efecto).

- El catálogo de **cada** decisión incluye una opción "no hacer nada" con efecto
  propio (a veces negativo).
- Si un equipo no registró decisión para un ítem (o no envió nada), el motor
  **sustituye por esa opción "no hacer nada"** y calcula con ella.
- El motor **siempre** opera sobre una opción del catálogo — nunca sobre
  ausencia de dato ni sobre un `null`.

### 3. Efectos por rango aleatorio: se sortea una vez y el valor se guarda para siempre

✅ CONFIRMADO (`docs/02` §6: los efectos son rangos, a propósito para que dos
empresas iguales no obtengan lo mismo; `docs/08` §4 y `docs/00` punto 10: **el
valor sorteado se guarda de forma permanente, no se recalcula**).

- Para cada efecto configurado como rango `{min, max}`, el motor **sortea un
  valor por equipo y por período**.
- Ese valor se **persiste** (p. ej. `ResultadoDecisionPeriodo`), asociado a
  equipo + período + decisión.
- Consultas posteriores del mismo período **devuelven el valor guardado**, nunca
  vuelven a sortear. Esto hace los resultados **reproducibles y auditables**: el
  docente puede justificar por qué a dos equipos les fue distinto.

🔎 INFERENCIA — el sorteo ocurre **durante el cálculo de cierre** (P6), no al
abrir el período; `docs/02` §6 dice "el sistema le genera automáticamente" sin
fijar el momento. A confirmar si importa.

### 4. Empresa base compartida ⇒ una copia de los datos financieros por equipo

🔎 INFERENCIA sobre ✅ CONFIRMADO. `docs/08` §5 / `docs/00` punto 14: **todos los
equipos de una simulación comparten la misma "empresa" base**, con **nombre
predefinido** (no lo elige el equipo). La lectura del equipo (marcada 🔎 en
`docs/00` y `docs/08`) es: cada equipo gestiona **su propia instancia** de esa
empresa, que **diverge** con sus decisiones.

Implicación para el motor y el modelo de datos:

- Los estados financieros de cada equipo son **una fila/instancia propia por
  equipo**, inicializada como copia de la situación inicial del caso — **no** una
  fila compartida que todos los equipos editan.
- El nombre (y la situación inicial) vienen del **caso**, iguales para todos; los
  **números divergen** período a período.

❓ POR CONFIRMAR — esta interpretación depende del **ejemplo concreto que sigue
pendiente en `docs/00`** ("el Equipo A y el Equipo B, ¿son dos instancias
independientes de la misma empresa, cada una con sus propios números?"). **No
cerrar el modelo Empresa/Equipo hasta tener esa respuesta.**

### 5. Catálogo y Caso se administran distinto — son dos mecanismos, no uno

✅ CONFIRMADO (`docs/08` §3 y §7; `docs/00` puntos 12 y 13).

| | **Catálogo de decisiones** | **Caso** |
|---|---|---|
| Editable por el docente | **No** — fijo/precargado | **Sí** — lo configura en el sistema, en el momento |
| Endpoint de escritura | **Ninguno** (no hay CRUD) | **C4** (`POST/PUT/DELETE /api/casos/{id}`) |
| Quién lo carga | ❓ por definir en otra ronda (no es pantalla del docente) | El docente, desde la pestaña "Casos" |

El motor no debe asumir que el catálogo llega por la misma vía que el caso: el
catálogo es **datos de referencia del sistema**; el caso es **contenido que crea
el docente**.

### 6. Situación inicial: el motor arranca de un período 0 sembrado

✅ CONFIRMADO (`docs/02` §2; `docs/00` punto 1).

- Existe un **período base** con estados financieros **ya cerrados**, definido
  por el caso (vía configuración del docente y/o carga de estados iniciales — M3
  🎨).
- El cálculo del período 1 parte de esos estados; cada período siguiente parte
  del cierre del anterior.

### 7. Flujo contable: estado de resultados → utilidad neta → flujo de caja → usos

✅ CONFIRMADO (`docs/02` §9).

El motor debe producir, por equipo y período:

- El **estado de resultados** hasta **utilidad neta**.
- A partir de la utilidad neta, el **flujo de caja**.
- El **disponible** resultante se destina a: reposición de capital de trabajo,
  pago de obligaciones y, si sobra, reparto de utilidades.

❓ POR CONFIRMAR — el cliente menciona que **capitalizar utilidades "tiene
efecto"** pero **no explica cuál** (`docs/02` §9). No modelar ese efecto todavía.

### 8. Algunos efectos son proporcionales a lo invertido, no una opción discreta

✅ CONFIRMADO (`docs/02` §8: "en la proporción que invierta va a tener un nivel
mayor de productividad… puede traducirse en incremento de ventas"; ejemplo de
marketing en `docs/02` §6).

- Para decisiones de tipo monto/porcentaje (p. ej. inversión en capacitación,
  publicidad, I+D), el efecto **escala con la cantidad invertida** — encadena
  indicadores (inversión → productividad → ventas).
- El catálogo, por tanto, debe soportar opciones con **parámetro numérico**, no
  solo opciones fijas.

❓ POR CONFIRMAR — las **funciones/coeficientes exactos** (¿lineal? ¿con
retornos decrecientes? ¿en qué período impacta?) no están en los docs. El
prototipo (`docs/05`) inventó números para el mockup; **no usarlos**.

### 9. Redistribución de participación de mercado — la mecánica

✅ CONFIRMADO en su forma general (`docs/02` §7, cita textual): si el sector
crece y una empresa **pierde** participación frente a la competencia, sus ventas
crecen menos que el sector, y **ese diferencial se reparte entre las demás
empresas del mercado** según su participación.

- El cálculo de demanda/ventas de cada empresa **depende de las decisiones de
  las demás** en el mismo período (por eso el punto 1: lote, no aislado).
- Suma cero dentro del mercado en cuanto a puntos de participación
  redistribuidos.

❓ POR CONFIRMAR — el cliente dio **un ejemplo** ("sector 8%, pierde 2%…"), no un
**algoritmo general** (cómo se calcula cuánto pierde/gana cada empresa a partir
de sus decisiones). Falta esa regla para poder implementar el reparto.

### 10. Publicación de resultados

⚠️ SUPOSICIÓN — el prototipo (`docs/05`) muestra un estado "Resultados
publicados". 🔎 Lectura: los resultados de un período son visibles para el
estudiante **solo después** de que el Docente cierra y calcula (P6). No es una
regla que el cliente haya enunciado; a confirmar como estado del período.

### 11. Puntaje del ranking / Clasificación

❓ POR CONFIRMAR — **el cliente lo pospuso explícitamente** (`docs/08` §6;
`docs/00` punto 15). No se define fórmula aquí. El endpoint L1 existe a nivel de
contrato y la pantalla se construye visual, pero el motor **no calcula puntaje**
hasta que el cliente dé la regla en una ronda posterior.

---

## Resumen

**Parte 1:** 31 endpoints consolidados de `docs/07` (5 auth · 3 carga de
estudiantes · 5 equipos · 4 casos · 1 catálogo · 7 períodos · 2 resultados ·
1 clasificación · 3 parámetros). Ninguno marcado ❓ a nivel de endpoint.

**Parte 2:** **11 puntos** sobre el motor de cálculo.

- **Núcleo confirmado (✅), sin ❓ pendientes:** puntos **2** (opción "no hacer
  nada" siempre), **5** (catálogo fijo vs. caso editable), **6** (situación
  inicial sembrada).
- **Confirmado en lo esencial pero con un ❓ de detalle:** puntos **1** (❓ qué
  agrupa "un mercado"), **3** (🔎 momento del sorteo), **7** (❓ efecto de
  capitalizar utilidades), **8** (❓ funciones/coeficientes), **9** (❓ algoritmo
  general del reparto).
- **Depende de un ejemplo aún pendiente del cliente:** punto **4**
  (instancia de empresa por equipo).
- **Sin resolver / no se propone nada:** punto **10** (⚠️ publicación de
  resultados) y punto **11** (❓ fórmula de puntaje — pospuesta por el cliente).

**Total de puntos con ❓ vivo:** 7 (puntos 1, 4, 7, 8, 9, 10, 11) — más el 3 con
una 🔎 menor. Ninguna fórmula ni algoritmo se inventó: todo lo no confirmado
queda citado como pendiente.
