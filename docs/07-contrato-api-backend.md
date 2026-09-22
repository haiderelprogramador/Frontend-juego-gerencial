# Contrato de API para el backend (paso 7)

**Qué es:** el inventario de endpoints REST que el backend Spring Boot (aún sin
repo) tendrá que exponer para sostener el frontend que estamos construyendo.
Es un ejercicio de **diseño de contrato**, no de implementación: no hay que
escribir controladores todavía.

> **Actualizado tras `docs/08` (respuestas del cliente, ronda 2).** Esa ronda
> cerró varias preguntas abiertas: de los 5 endpoints que estaban ❓, 3 quedan
> ✅ (`cerrar período` → Docente; CRUD de casos → sí existe; `cambiar-contraseña`
> → existe pero opcional), 1 se elimina (CRUD del catálogo → no existe, catálogo
> fijo) y 1 baja a ⚠️ (escritura de parámetros). También se resolvieron D1, D3,
> D6, D9, D11. Los cambios están marcados con «(docs/08 §N)».

**De dónde sale cada cosa:**

- **Autenticación** y **Carga masiva de estudiantes** ya están implementadas en
  el frontend como *servicios mock contra el contrato real* (regla 8 de
  `docs/06`): `core/services/auth.service.ts`,
  `features/docente/gestion-estudiantes/services/estudiante.service.ts` y
  `core/api/api.config.ts`. Esos endpoints se **extraen** de ahí, no se inventan.
- El resto de pantallas (Toma de decisiones, Reportes financieros, Clasificación,
  Panel del docente) hoy usan **mocks locales dentro de cada componente**, sin
  servicio ni ruta. Sus endpoints son **inferencia/suposición**: lo que el
  dominio y esas pantallas van a necesitar, marcado como tal.

> Regla de oro del proyecto (`docs/00`): no inventar requisitos funcionales.
> Aquí nada se marca ✅ salvo que salga textualmente de `docs/02`, `docs/03` o
> `docs/08` (respuestas del cliente).

---

## Leyenda de etiquetas

| Etiqueta | Aquí significa |
|---|---|
| ✅ CONFIRMADO | El comportamiento del endpoint viene de algo que el cliente dijo (`docs/02`, `docs/03`, `docs/08`). La ruta exacta es diseño nuestro, pero el *qué hace* es requisito. |
| 🔎 INFERENCIA | Sale directo de un servicio mock ya implementado, pero es una necesidad técnica (no algo que el cliente pidió con esas palabras). |
| 🎨 PROPUESTA DEL EQUIPO | La pantalla que lo necesita viene del prototipo `docs/05`, no del cliente. |
| ⚠️ SUPOSICIÓN | El frontend todavía no lo llama, pero el dominio lo va a requerir. Propuesta razonable, a validar. |
| ❓ POR CONFIRMAR | La existencia del endpoint, o quién puede llamarlo, depende de una pregunta abierta sin resolver. Se cita, no se resuelve. |

---

## 1. Convenciones generales

| Tema | Definición |
|---|---|
| Prefijo base | `/api` (`API_CONFIG.baseUrl` en el front) |
| Formato | JSON en request y response; `Content-Type: application/json` |
| Autenticación | JWT en `Authorization: Bearer <token>` (lo adjunta `core/interceptors/auth.interceptor.ts`) |
| Roles | `DOCENTE`, `ESTUDIANTE`. ✅ "Admin" y "Docente" son **el mismo rol técnico** (docs/08 §1) — no se modelan por separado. |
| Fechas | ISO 8601 en UTC |
| CORS (dev) | Permitir origen `http://localhost:4200`, header `Authorization` |

**Cuerpo de error esperado** (el front muestra `message` en pantalla):

```json
{ "message": "Texto para el usuario", "codigo": "CREDENCIALES_INVALIDAS" }
```

⚠️ Pendiente en el front: hoy el `catch` lee `err.message`; con `HttpClient` real
será `err.error?.message` (ajuste de una línea en `login.ts`,
`registro-docente.ts`, `gestion-estudiantes.ts`).

---

## 2. Endpoints por área funcional

Para cada uno: **método + ruta**, qué hace, quién puede llamarlo, forma general
de entrada → salida (alto nivel), y etiqueta de confianza.

### 2.1 Autenticación

| # | Método + ruta | Qué hace | Quién | Entrada → Salida | Etiqueta |
|---|---|---|---|---|---|
| A1 | `POST /api/auth/login` | Inicia sesión. El backend decide el rol por las credenciales. | Ambos (misma pantalla) | `{correo, contrasena}` → `{token, usuario}` · 401 si falla | ✅ (docs/03: "ambos inician sesión desde la misma pantalla") |
| A2 | `POST /api/auth/registro-docente` | Crea una cuenta de rol `DOCENTE`. | Público (sin sesión) | `{nombre, correo, numeroIdentificacion, contrasena}` → `{token, usuario}` · 409 si el correo existe | ✅ (docs/03: "el estudiante no se autorregistra"; docente/admin sí) |
| A3 | `GET /api/auth/sesion` | Devuelve el usuario del token; rehidrata la sesión al recargar. | Ambos (con token) | — → `{usuario}` · 401 si el token no vale | 🔎 (rama `!demoMode` de `auth.service.ts`; necesidad técnica) |
| A4 | `POST /api/auth/cambiar-contrasena` | Cambia la contraseña del propio usuario, desde su perfil. | Cualquier usuario autenticado | `{contrasenaActual, contrasenaNueva}` → 204 | ✅ Existe, pero el cambio es **opcional** — el estudiante puede cambiar la clave generada si quiere, **no es un paso obligatorio ni bloqueante en el primer login** (docs/08 §2). No hace falta un flag `debeCambiarContrasena` ni una pantalla intermedia. |
| A5 | `POST /api/auth/logout` | Invalida el token en servidor (lista negra / rotación). | Ambos | — → 204 | ⚠️ Hoy el `logout()` del front es 100% local (borra `localStorage`). Solo hace falta si se quiere invalidación real del JWT. |

**DTO `Usuario`** (sale de `core/models/usuario.model.ts`):
`{ id, nombre, correo, numeroIdentificacion, rol }`. La contraseña/hash **nunca**
viaja al frontend.

Validaciones que el front ya aplica y el backend debe repetir (Bean Validation):
`nombre` ≥ 3, `correo` formato email + único, `numeroIdentificacion` `^[0-9]{5,15}$`
(❓ rango real), `contrasena` ≥ 8 (❓ política real).

---

### 2.2 Carga masiva de estudiantes

Todos requieren token de rol `DOCENTE` (si no → 403). El Excel se lee **en el
navegador** (`xlsx`/SheetJS); el backend recibe JSON de filas, no el archivo.

| # | Método + ruta | Qué hace | Quién | Entrada → Salida | Etiqueta |
|---|---|---|---|---|---|
| E1 | `POST /api/docente/estudiantes/carga-masiva` | Crea varios estudiantes de un lote. El **backend** asigna consecutivo, genera la contraseña y **la envía por correo al estudiante** (docs/08 §2). Carga parcial permitida. | Docente | `{estudiantes: [{nombre, correo, numeroIdentificacion, edad, genero, columnasAdicionales}]}` → `{creados: [{...Usuario, contrasenaGenerada, cargadoEn}], errores: [{correo, motivo}]}` | ✅ (docs/03 + docs/08 §2: proceso de carga masiva + contraseña generada y enviada por correo) |
| E2 | `GET /api/docente/estudiantes` | Lista los estudiantes ya cargados. | Docente | — → `EstudianteCargado[]` (sin contraseña) | 🔎 (implementado en `estudiante.service.ts` `listar()`) |
| E3 | `POST /api/docente/estudiantes/carga-masiva` **(multipart)** | Alternativa "opción B": el backend recibe el `.xlsx`, lo parsea (Apache POI), valida y crea. | Docente | `multipart/form-data` archivo → misma salida que E1 | ⚠️ Solo si se decide mover el parseo al backend. El front ya hace la opción A. |

✅ **Columnas mínimas del Excel** (docs/08 §2): correo, nombre, número de
identificación, **edad** y **género**. Cualquier otra columna va en
`columnasAdicionales` (mapa texto→texto).

⚠️ **El patrón exacto de la contraseña generada NO está definido.** `docs/03` lo
resumió como `USU-001-<numeroIdentificacion>` (prefijo primero), pero en
`docs/08` §2 el cliente lo describió como *"número de identificación + USU"*
(orden inverso) y **no dio un ejemplo literal** (¿`12345678USU`? ¿`USU-12345678`?
¿lleva el `001`? ¿guiones?). **No se debe implementar el generador con un formato
supuesto** — hace falta pedir al cliente un ejemplo concreto. El mock del front
(`generar-contrasena.ts`) usa `USU-###-<id>` solo como placeholder de demo.

El backend **envía la contraseña por correo al estudiante** (docs/08 §2). Además
la devuelve en `creados[].contrasenaGenerada` **una sola vez** (la pantalla de
carga la muestra al docente como respaldo si el correo no llega); después solo
queda el hash.

---

### 2.3 Equipos

No implementado en el front. Lo necesitan: el checklist del Panel del docente
(paso "Formar equipos"), la Clasificación (filas por equipo) y Toma de decisiones
("tu equipo"). `docs/01` ya lista **Equipo** como entidad candidata.

✅ **No existe el concepto de "Curso"** que agrupe equipos (docs/08 §5, con la
salvedad del cliente "que yo sepa"). Los endpoints **no** se scopean a
`/api/cursos/{id}/...` — cuelgan directo de la simulación activa.

| # | Método + ruta | Qué hace | Quién | Entrada → Salida | Etiqueta |
|---|---|---|---|---|---|
| Q1 | `GET /api/docente/equipos` | Lista los equipos (con integrantes y estado de configuración). | Docente | — → `Equipo[]` | ⚠️ |
| Q2 | `POST /api/docente/equipos` | Crea un equipo y le asigna estudiantes. | Docente | `{integrantes: [estudianteId]}` → `Equipo` | ⚠️ 🎨 (checklist del panel) |
| Q3 | `PUT /api/docente/equipos/{id}` | Cambia integrantes. | Docente | `{integrantes?}` → `Equipo` | ⚠️ |
| Q4 | `DELETE /api/docente/equipos/{id}` | Elimina un equipo (antes de abrir período). | Docente | — → 204 | ⚠️ |
| Q5 | `GET /api/estudiante/equipo` | El estudiante consulta su propio equipo. | Estudiante | — → `Equipo` | ⚠️ (Toma de decisiones muestra "Equipo Cóndor") |

**Sobre el nombre del equipo/empresa** (docs/08 §5): el **nombre de la empresa
viene predefinido** por el caso, **no lo elige el equipo** — por eso Q2/Q3 no
reciben `nombre`. 🔎 Interpretación a confirmar con un ejemplo: cada equipo
gestiona **su propia instancia** de una empresa "molde" común (mismo nombre y
situación inicial que el caso define), que va divergiendo según sus decisiones —
no es una empresa compartida en BD. ❓ Pendiente confirmar con el cliente con un
caso concreto (docs/08 §5 lo deja marcado así).

---

### 2.4 Casos

No implementado. Lo necesitan: el checklist del panel ("Seleccionar el caso
activo") y el encabezado de Toma de decisiones ("Caso: Expansión regional").
`docs/02` §3 confirma que existen escenarios y que el cliente los edita
activamente. ✅ **No hay un documento de "caso de negocio" externo: el docente
configura el caso directamente en el sistema, en el momento** (docs/08 §7) — la
pestaña "Casos" del Panel del docente es esa pantalla de configuración, no una
vista de solo lectura.

| # | Método + ruta | Qué hace | Quién | Entrada → Salida | Etiqueta |
|---|---|---|---|---|---|
| C1 | `GET /api/casos` | Lista los casos disponibles. | Ambos (lectura) | — → `Caso[]` (id, nombre, resumen, tipo) | ✅ concepto (docs/02 §3, docs/08 §7) · ⚠️ forma |
| C2 | `GET /api/casos/{id}` | Detalle de un caso: texto informativo para el estudiante, estados financieros iniciales. | Ambos | — → `Caso` completo | ✅ concepto · ⚠️ forma |
| C3 | `PUT /api/docente/simulacion/caso-activo` | Fija el caso activo de la simulación. | Docente | `{casoId}` → 200 | ⚠️ (checklist paso 3) |
| C4 | `POST /api/casos` · `PUT /api/casos/{id}` · `DELETE /api/casos/{id}` | CRUD de casos: el docente arma/edita el caso en el sistema. | Docente | `Caso` → `Caso` | ✅ **Existe** — el docente configura el caso directamente en el sistema, no hay documento externo (docs/08 §7). Forma del DTO ⚠️. |

**Pregunta abierta citada:**
- El cliente distingue un escenario "sin decisiones" y otro "con decisiones"
  (`docs/02` §3): ¿es un flag/tipo en `Caso`? (sin resolver).

---

### 2.5 Catálogo de decisiones

No implementado como servicio (Toma de decisiones tiene las opciones
hardcodeadas). `docs/02` §5 **confirma el patrón** textualmente: por cada
decisión hay *información + lista de opciones + efecto por opción*, y **"no hacer
nada" es una opción explícita del catálogo**, no ausencia de dato. `docs/05` da
tipos de control (interruptor / deslizador / 3 opciones).

| # | Método + ruta | Qué hace | Quién | Entrada → Salida | Etiqueta |
|---|---|---|---|---|---|
| K1 | `GET /api/casos/{id}/catalogo-decisiones` | Devuelve el menú de decisiones del caso: por decisión → texto informativo, categoría, tipo de control, y opciones con su efecto (rango). | Ambos (el estudiante para decidir, el docente para revisar) | — → `Decision[]` con `opciones[]` | ✅ concepto (docs/02 §5) · ⚠️ forma exacta |

**No aplica: no hay CRUD del catálogo de decisiones.** ✅ El catálogo **no es
editable por el docente** — viene precargado/fijo (docs/08 §3). Queda pendiente
—en otra ronda— definir quién y cómo lo carga, pero **no** es una pantalla de
edición ni un endpoint de escritura.

✅ **Categorías de decisión: exactamente tres, cerradas** — operacionales,
administrativas, comerciales. No hay una cuarta (docs/08 §3). El enum de
categoría en `Decision` es cerrado.

✅ Los efectos son **rangos (mín–máx) con sorteo aleatorio por empresa**, no
valores fijos (`docs/02` §6; contradice el "-5% fijo" del prototipo `docs/05`).
El valor sorteado **se guarda de forma permanente**, no se recalcula (docs/08
§4 — ver D1).

---

### 2.6 Períodos y decisiones tomadas

No implementado. Lo necesitan: el "Control de periodos" del Panel del docente
(abrir/cerrar período, toggle "Recibiendo decisiones", "Cerrar periodo y
calcular", "Enviar recordatorio") y Toma de decisiones del estudiante
("Guardar borrador" / "Enviar decisiones", autoguardado).
`docs/02` §1–2 confirma: el Período es central, hay un **cálculo automático al
cierre aunque no haya decisiones**, y existe un **período 0 sembrado** con
estados financieros ya cerrados.

✅ **El Docente es quien cierra el período** / decide cuándo termina la
simulación — no es una acción del Estudiante (docs/08 §4). El botón "Cerrar
período" que el prototipo ponía en la pantalla del estudiante **ya se quitó** del
frontend; el estudiante solo guarda/envía las decisiones de su equipo.

| # | Método + ruta | Qué hace | Quién | Entrada → Salida | Etiqueta |
|---|---|---|---|---|---|
| P1 | `GET /api/simulacion/periodo-actual` | Estado del período vigente: número/trimestre, caso activo, abierto/cerrado, fecha de cierre, si está "recibiendo decisiones". | Ambos | — → `Periodo` | ✅ concepto (docs/02 §2) · ⚠️ forma |
| P2 | `POST /api/docente/periodos` | Configura y **abre** el primer/siguiente período (define fecha de cierre). | Docente | `{casoId?, fechaCierre}` → `Periodo` | ⚠️ 🎨 (checklist paso 4) |
| P3 | `PATCH /api/docente/periodos/{id}` | Enciende/apaga "Recibiendo decisiones". | Docente | `{recibiendoDecisiones: boolean}` → `Periodo` | ⚠️ 🎨 (toggle del panel) |
| P4 | `PUT /api/estudiante/periodos/{id}/decisiones` | El equipo guarda/envía sus decisiones tomadas (opción elegida por cada decisión del catálogo). Soporta **borrador** y **envío**. NO cierra el período. | Estudiante | `{estado: "BORRADOR"\|"ENVIADO", decisiones: [{decisionId, opcionId, valor?}]}` → 200 | ✅ concepto ("decisión efectivamente tomada", docs/02 §5) · ⚠️ forma |
| P5 | `GET /api/estudiante/periodos/{id}/decisiones` | Carga las decisiones guardadas del equipo (para rehidratar la pantalla / autoguardado). | Estudiante | — → mismo cuerpo que P4 | ⚠️ |
| P6 | `POST /api/docente/periodos/{id}/cerrar` | Cierra el período y dispara el **cálculo por lote** de todas las empresas del mercado (docs/02 §7). | **Docente** | — → `{resumenCalculo}` o 202 | ✅ **Actor confirmado: el Docente** (docs/08 §4). No lo puede llamar el Estudiante — `roleGuard(DOCENTE)`. Ruta bajo `/api/docente/...` como el resto de acciones del docente sobre períodos. Forma de la respuesta ⚠️. |
| P7 | `POST /api/docente/periodos/{id}/recordatorio` | Notifica a los equipos que aún no enviaron. | Docente | — → 202 | ⚠️ 🎨 ("Enviar recordatorio") |

⚠️ Constraint de diseño (no es endpoint): P6 **procesa toda la cohorte junta**,
no equipo por equipo — la participación de mercado se redistribuye entre
competidores (`docs/02` §7). Y corre **aunque un equipo no haya enviado nada**:
"no decidir también tiene efecto" (`docs/02` §1), aplicando la opción por defecto
del catálogo.

---

### 2.7 Resultados / Reportes financieros

No implementado (el componente `reportes-financieros` tiene KPIs y tablas
hardcodeadas). `docs/02` §7 y §9 confirman que los resultados **se calculan** al
cierre (estado de resultados → utilidad neta → flujo de caja). `docs/05` aporta
la estructura del estado de resultados y KPIs (Activo Total, Patrimonio, ratio
Pasivo/Activo).

| # | Método + ruta | Qué hace | Quién | Entrada → Salida | Etiqueta |
|---|---|---|---|---|---|
| R1 | `GET /api/estudiante/periodos/{id}/resultados` | Resultados financieros del equipo para un período: KPIs con variación vs. período anterior (Ingresos, Utilidad neta, Margen bruto, Cuota de mercado), estado de resultados por líneas, y si están "publicados". | Estudiante (su equipo); Docente (cualquier equipo) | — → `ResultadoPeriodo` | ✅ concepto (docs/02: los resultados existen y se calculan) · ⚠️/🎨 forma (docs/05) |
| R2 | `GET /api/estudiante/resultados/historico` | Serie de los últimos N trimestres (ingresos vs. costos) para el gráfico de tendencia. | Estudiante; Docente | `?equipoId=` → `PuntoTrimestre[]` | ⚠️ 🎨 |

⚠️ "Resultados publicados" (badge del prototipo): sugiere que los resultados de
un período solo son visibles para el estudiante **después** de que el docente
cierra y calcula. A confirmar como estado del `Periodo`/`ResultadoPeriodo`.

✅ El valor sorteado dentro de un rango **se guarda de forma permanente, no se
recalcula** (docs/08 §4). Los resultados de un período son, por tanto,
reproducibles. Ver D1.

---

### 2.8 Clasificación

No implementado como servicio. La ve **estudiante y docente con la misma vista**
(`features/clasificacion/`, una sola feature). `docs/05` describe el leaderboard:
por equipo, utilidad neta / "decisión clave" / variación de activos.

| # | Método + ruta | Qué hace | Quién | Entrada → Salida | Etiqueta |
|---|---|---|---|---|---|
| L1 | `GET /api/clasificacion` | Ranking de equipos: posición, equipo, nº integrantes, tendencia vs. período anterior, ingresos, margen, puntaje; marca cuál es el equipo del que llama. Estado vacío hasta que se cierre el primer período. | Ambos (misma respuesta) | `?periodo=` → `FilaClasificacion[]` | ⚠️ forma (del componente) · 🎨 concepto (leaderboard es del prototipo; la competencia entre equipos sí se deduce de docs/02 §7) |

⚠️ **La Clasificación no es prioridad ahora y la fórmula del `puntaje` NO se
define todavía** — el cliente lo dejó explícitamente para una ronda posterior
(docs/08 §6). La pantalla se sigue construyendo a nivel visual, pero no hay que
invertir tiempo ahora en la lógica del cálculo. Ver D8.

---

### 2.9 Parámetros

No implementado — la pestaña "Parámetros" del panel es un placeholder ("todavía
no está definida con el cliente"). `docs/05` tiene una pantalla "Parametrización
del Mercado" que es **justo donde está la contradicción con el cliente**: modeló
"caída de ventas sin publicidad" como valor fijo -5%, cuando el cliente pidió
**un rango aleatorio** (`docs/02` §6).

| # | Método + ruta | Qué hace | Quién | Entrada → Salida | Etiqueta |
|---|---|---|---|---|---|
| M1 | `GET /api/docente/parametros` | Lee los parámetros de mercado/escenario: crecimiento del sector, y por cada decisión el **rango (mín–máx)** de su efecto. | Docente | `?casoId=` → `Parametros` | ⚠️ |
| M2 | `PUT /api/docente/parametros` | Actualiza esos parámetros. | Docente | `Parametros` (con rangos `{min, max}` por efecto, **no valores fijos**) → 200 | ⚠️ El docente configura el caso en el sistema (docs/08 §7), así que los parámetros de mercado son parte de esa configuración — pero `docs/08` no lo detalla explícitamente. El modelo **debe** ser rango `{min, max}`, no un número (docs/02 §6). |
| M3 | `POST /api/docente/casos/{id}/estados-iniciales` | Carga por Excel los estados financieros iniciales del caso (hojas Balance / P&G / Parámetros). | Docente | `multipart/form-data` → resumen | 🎨 ⚠️ (pantalla del prototipo `docs/05`; encaja con el "período 0 sembrado" de docs/02 §2, pero el mecanismo Excel es propuesta del equipo) |

---

## 3. Decisiones de diseño

Estado tras `docs/08`. Las **resueltas** se dejan como registro; las **abiertas**
son lo que el equipo de backend todavía tiene que cerrar con el cliente.

### Resueltas en docs/08

| # | Decisión | Resolución |
|---|---|---|
| D1 | ¿El valor sorteado de un rango aleatorio se guarda o se recalcula? | ✅ **Se guarda de forma permanente**, no se recalcula (docs/08 §4). Confirma la recomendación técnica de `docs/02` §6. Hace falta una tabla tipo `ResultadoDecisionPeriodo` con el valor sorteado. |
| D3 | ¿"Admin" y "Docente" son el mismo rol técnico o dos? | ✅ **El mismo rol** (docs/08 §1). Enum de roles: `DOCENTE`, `ESTUDIANTE`. |
| D4 | ¿La contraseña generada se cambia obligatoriamente en el primer ingreso? | ✅ **No.** El cambio es opcional, desde el perfil (docs/08 §2). Sin flag `debeCambiarContrasena`, sin pantalla bloqueante. |
| D6 | ¿Existe "Curso" como agrupación sobre los equipos? | ✅ **No** (docs/08 §5, con salvedad "que yo sepa"). No se modela como entidad; los endpoints no se scopean a `/cursos/{id}`. |
| D7 (parcial) | ¿La configuración se edita en el sistema o va precargada? | ✅ **Casos:** los edita el docente en el sistema (docs/08 §7) → CRUD de casos existe (C4). ✅ **Catálogo de decisiones:** no editable, precargado/fijo (docs/08 §3) → sin CRUD (K2 eliminado). ❓ **Parámetros de mercado:** sin detallar (ver abajo). |
| D9 | ¿Quién cierra el período? | ✅ **El Docente** (docs/08 §4). `roleGuard(DOCENTE)` en P6. El botón del estudiante ya se quitó del frontend. |
| D11 | ¿Cuántas categorías de decisión hay? | ✅ **Exactamente tres, cerradas:** operacionales, administrativas, comerciales (docs/08 §3). Enum cerrado. |

### Abiertas

| # | Decisión abierta | Fuente | Impacto |
|---|---|---|---|
| D2 | **¿Todos los indicadores del resultado se materializan o se derivan on-demand?** (D1 ya resolvió que el sorteo se persiste; queda el resto del estado financiero calculado). | `docs/01` §H | Si se calculan, R1 necesita el motor en cada request; si se guardan, hace falta invalidación al recalcular un período. |
| D5 | **Patrón exacto de la contraseña generada** — dos descripciones del cliente que no coinciden (`USU` primero vs. identificación primero), sin ejemplo literal. Y el **alcance del consecutivo** (¿global? ¿por docente? ¿por carga?). | `docs/03` vs `docs/08` §2 | El generador del backend. **No implementar con formato supuesto** — pedir al cliente un ejemplo concreto. |
| D8 | **¿Cómo se calcula el `puntaje` de la clasificación?** | `docs/05` + `docs/08` §6 | Fórmula del ranking en L1. **El cliente lo pospuso explícitamente** (docs/08 §6) — no dedicarle tiempo ahora. |
| D10 | **¿Cómo se modela "Empresa"?** `docs/08` §5: el nombre viene predefinido por el caso y varios equipos comparten la misma empresa "molde". 🔎 Interpretación: una instancia de empresa por equipo, no una fila compartida. | `docs/05` punto 3 + `docs/08` §5 | Modelo Equipo/Empresa. ❓ Confirmar con un ejemplo concreto (docs/08 §5 lo pide). |
| D12 | **Política del JWT**: expiración, refresh token, claims (mínimo `sub`, `rol`, `exp`). | `auth.service.ts` TODO | A1–A5, interceptor, A5 (logout server-side) si se quiere invalidación real. |
| D13 | **¿El Excel de estudiantes puede traer varias hojas?** (las columnas ya están: correo, nombre, identificación, edad, género — docs/08 §2). | `docs/03` / `docs/08` §2 | Menor: hoy el front toma la primera hoja. |
| D14 | **Parámetros de mercado editables desde el sistema (M2)** — `docs/08` §7 dice que el docente configura el caso, pero no menciona explícitamente los parámetros de mercado. | `docs/08` §7 | Existencia y forma de M1/M2. |

---

## 4. Resumen de conteo

**Endpoints propuestos por área** (31 en total; las líneas con CRUD agrupado se
cuentan como 1). Tras `docs/08`, **ningún endpoint queda ❓**:

| Área | Endpoints | ❓ | Cambio en esta ronda |
|---|---|---|---|
| Autenticación | 5 (A1–A5) | 0 | A4 `cambiar-contrasena` ❓→✅ (existe, opcional) |
| Carga masiva de estudiantes | 3 (E1–E3) | 0 | E1: se añaden `edad`/`genero`; contraseña por correo; patrón sigue sin definir (D5) |
| Equipos | 5 (Q1–Q5) | 0 | se quita `cursoId` (no hay Curso, docs/08 §5) |
| Casos | 4 (C1–C4) | 0 | C4 CRUD de casos ❓→✅ (docs/08 §7) |
| Catálogo de decisiones | 1 (K1) | 0 | **K2 eliminado** — catálogo fijo, sin CRUD (docs/08 §3) |
| Períodos y decisiones tomadas | 7 (P1–P7) | 0 | P6 `cerrar` ❓→✅, actor = **Docente** (docs/08 §4) |
| Resultados / Reportes financieros | 2 (R1–R2) | 0 | D1 resuelto: el sorteo se persiste |
| Clasificación | 1 (L1) | 0 | puntaje: el cliente lo pospuso (docs/08 §6) |
| Parámetros | 3 (M1–M3) | 0 | M2 ❓→⚠️ (pendiente D14) |
| **Total** | **31** | **0** | de los 5 ❓ previos: 3 → ✅, 1 → eliminado, 1 → ⚠️ |

**Por etiqueta:**

- ✅ CONFIRMADO: A1, A2, A4, E1, C4, P6, y el *concepto* de C1/C2, K1, P1, P4,
  R1 (categorías, "no hacer nada", sorteo como rango, quién cierra…).
- 🔎 INFERENCIA (de servicio mock ya implementado): A3, E2.
- ⚠️ SUPOSICIÓN (dominio lo requiere, front aún no lo llama): la mayoría de
  Equipos, Casos (forma), Períodos, Resultados, Parámetros.
- 🎨 PROPUESTA DEL EQUIPO (pantalla viene del prototipo): Q2, P2, P3, P7, R1/R2,
  L1, M3.
- ❓ POR CONFIRMAR: **0 endpoints**; 7 decisiones de diseño abiertas (§3:
  D2, D5, D8, D10, D12, D13, D14).

---

## 5. Cómo se conecta el frontend cuando exista el backend

1. `core/api/api.config.ts`: `demoMode: false` y `baseUrl` al backend real
   (idealmente moverlo a `src/environments/`). Añadir las rutas nuevas a
   `endpoints`.
2. Cambiar `err.message` → `err.error?.message` en el manejo de error de las
   pantallas de auth y carga de estudiantes.
3. `AuthService` y `EstudianteService` **no cambian**: cada método ya tiene la
   rama `if (!API_CONFIG.demoMode) { http... }` escrita contra A1–A3 / E1–E2.
   El helper `generar-contrasena.ts` es un **placeholder de demo** — no se porta
   al backend (D5: el patrón real no está definido).
4. El resto de features todavía **no tienen servicio**: al construirlos, seguir
   la regla 8 de `docs/06` (servicio contra el contrato de arriba + mock por
   dentro) en `features/estudiante/services/`, `features/docente/services/`,
   `features/clasificacion/services/`.
5. En "Toma de decisiones" el estudiante llama a **P4** (guardar/enviar sus
   decisiones); **no** existe acción de cerrar período en esa pantalla (P6 es
   solo del Docente).
