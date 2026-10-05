# Resumen del proyecto — léelo primero

Este documento existe para que cualquiera (persona o sesión de Claude) que entre nueva a este proyecto se ponga al día rápido, sin tener que leer toda la conversación original. Si eres una sesión de Claude sin memoria de este proyecto: lee esto completo antes de tocar código o de proponer requisitos.

## Qué es el proyecto

Proyecto académico de software: un **simulador de juego gerencial**. Los participantes (estudiantes) gestionan una empresa simulada, toman decisiones por período, y el sistema procesa esas decisiones y genera resultados que alimentan el período siguiente. Nombre de trabajo: **Estratego** (usado en el README y los docs; no está 100% cerrado, se puede cambiar).

## Regla de oro de este proyecto (no negociable)

El profesor fue explícito: **no se deben inventar los requisitos funcionales**. Todo el análisis distingue siempre entre:

- ✅ **REQUISITO OFICIAL** — dicho literalmente por el cliente (reunión, "el caso", documentos que él mismo comparta).
- 📚 **REFERENCIA** — de otros simuladores académicos (UNAB, Univalle, UNAL, etc.), sirve para entender el dominio, **nunca** se copia como requisito propio.
- 🔎 **INFERENCIA** — conclusión razonable derivada de cruzar varias fuentes.
- 🎨 **PROPUESTA DEL EQUIPO** — ideas o prototipos hechos por el equipo (ej. el mockup "BizSim" de un compañero) — útiles como idea, pero no son requisito hasta validarse con el cliente.
- ⚠️ **SUPOSICIÓN** — sin respaldo directo.
- ❓ **POR CONFIRMAR** — falta información, no se decide solo.

Cualquier documento nuevo que se agregue al proyecto debería seguir usando estas mismas etiquetas.

## Stack técnico

- **Frontend**: Angular 21, TypeScript, SCSS. Repo: `https://github.com/haiderelprogramador/Frontend-juego-gerencial` (rama `main`).
- **Backend**: Spring Boot (Java). ❓ Repo aparte, todavía no confirmado si existe o cómo se llama.
- **Base de datos**: por definir — depende del modelo de datos, que todavía está en construcción.

## Estado actual del repositorio frontend

- Scaffold de Angular 21 ya creado, compila (`ng build` verificado) y está pusheado a GitHub.
- `docs/01-analisis-dominio.md` ya está pusheado.
- `docs/02` a `docs/06` (este incluido) fueron generados en la conversación con Claude (Cowork) pero **hay que confirmar que ya se copiaron y subieron a la carpeta `docs/` del repo real** — si estás leyendo esto desde el repo, ya están; si no aparecen, pídele al usuario que los agregue.
- Convención de estructura de código del frontend: ver `docs/06-convenciones-frontend.md` — **síguela siempre** (carpetas `core/`, `shared/`, `layout/`, `features/`).

## Lo que el cliente SÍ confirmó hasta ahora (resumen — el detalle con citas está en docs/02 y docs/03)

1. Existe una **situación inicial**: un período base con estados financieros ya cerrados, sobre el cual arrancan las decisiones.
2. **No tomar ninguna decisión no es neutro** — el sistema igual aplica un efecto (a veces negativo) sobre los indicadores. El motor de cálculo siempre corre, haya o no decisión.
3. Existen (al menos) **tres categorías de decisión**: operacionales, administrativas, comerciales.
4. Para cada decisión hace falta un **catálogo configurable** (texto informativo + opciones + efecto de cada opción, incluyendo "no hacer nada" como opción explícita), **separado** del registro de qué opción eligió cada empresa en cada período.
5. Muchos efectos son **rangos con sorteo aleatorio** (ej. "cae entre 1% y 3%"), no un valor fijo — a propósito, para que dos empresas con la misma situación no obtengan el mismo resultado exacto. ❓ Pendiente: si el valor sorteado se debe guardar (para que sea reproducible) o se puede recalcular.
6. La **participación de mercado se redistribuye** entre todas las empresas de un mismo mercado en un mismo período — el cálculo no puede hacerse empresa por empresa de forma aislada.
7. Hay dos roles con acceso: **Docente** y **Admin**, y son **el mismo rol técnico** (mismos permisos) — ya confirmado, ver `docs/08`.
8. **Login**: Docente y Estudiante inician sesión desde la misma pantalla. El **registro** en la pantalla principal es **solo para Docente**. El Docente tiene, dentro de su panel, una sección para **cargar estudiantes de forma masiva vía Excel** (se extrae correo, nombre, número de identificación, edad y género). A cada estudiante se le **genera automáticamente una contraseña** (patrón exacto ❓ por confirmar con un ejemplo — ver `docs/08`) que se le **envía por correo**; el estudiante **puede cambiarla si quiere, no es obligatorio**.
9. **El Docente es quien cierra el período** / decide cuándo termina la simulación — el Estudiante no tiene esa acción.
10. El **valor sorteado** dentro de un rango aleatorio **se guarda de forma permanente** (no se recalcula).
11. Las **tres categorías de decisión** (operacionales, administrativas, comerciales) quedan **cerradas** — no hay una cuarta.
12. El **catálogo de decisiones no es editable por el docente** desde el sistema (viene precargado/fijo).
13. **No existe un documento de "caso de negocio" fijo** — el caso lo **configura el docente directamente en el sistema**, en el momento.
14. **No existe el concepto de "Curso"** agrupando equipos (según el cliente, "que yo sepa" — no cerrado al 100%). Todos los equipos de una misma simulación comparten la misma **"empresa" base**, con **nombre predefinido** (no lo elige el equipo) — 🔎 interpretación: cada equipo gestiona su propia instancia de esa empresa, divergiendo según sus decisiones; ❓ pendiente confirmar con un ejemplo concreto.
15. El **ranking/Clasificación no es prioridad ahora** — la fórmula de puntaje queda para una ronda posterior con el cliente.

Detalle completo de esta segunda tanda de respuestas, con citas y las implicaciones sobre lo ya construido (diseño visual y contrato de API), en `docs/08-respuestas-cliente-ronda-2.md`.

## Lo que viene de un prototipo de un compañero (🎨 propuesta del equipo, NO confirmado por el cliente)

Un compañero armó un mockup llamado "BizSim" (nombre no relacionado al del proyecto). Aporta ideas útiles (pantalla de carga de estados financieros iniciales por Excel con hojas Balance/P&G/Parámetros, estructura de estado de resultados, posible entidad "Curso" agrupando equipos, catálogo de decisiones con controles tipo slider/toggle/opciones), pero también tiene **contradicciones detectadas contra el cliente** — la más importante: modela la caída de ventas sin publicidad como un **valor fijo (-5%)**, cuando el cliente pidió explícitamente un **rango aleatorio**. Detalle completo en `docs/05-prototipo-equipo.md`.

## Preguntas abiertas más importantes (llevar al cliente)

Las cinco preguntas originales de esta lista ya se resolvieron — ver `docs/08-respuestas-cliente-ronda-2.md`. Lo que queda pendiente ahora:

- ¿Cuál es el **patrón exacto** de la contraseña generada? (el cliente dio dos descripciones distintas en momentos distintos — pedir un ejemplo literal con un número de identificación de prueba).
- ¿La lectura de "todos los equipos comparten la misma empresa base, cada uno con su propia instancia" es correcta? (pedir un ejemplo concreto de dos equipos en la misma simulación).
- ¿Hay más transcripción disponible de la reunión original?
- ¿El diagrama de carriles (swimlane) es un entregable formal pedido por el profesor, con fecha y formato definidos?
- ¿Cuándo se retoma la definición de la fórmula de puntaje del ranking/Clasificación?

## Qué se está construyendo ahora mismo

Login (Docente + Estudiante) y registro (solo Docente, con sección aparte para carga masiva de estudiantes por Excel), siguiendo la convención de `docs/06`. El backend de Spring Boot todavía no existe, así que el frontend se está armando contra un contrato de API definido pero con una implementación mock por dentro.

## Índice completo de documentación

Ver `docs/README.md` para la lista numerada completa (01 a 06) con el detalle de cada uno.
