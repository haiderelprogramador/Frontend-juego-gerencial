# Documentación — Simulador de Juego Gerencial

**Empieza por [`00-resumen-proyecto.md`](./00-resumen-proyecto.md)** — es el resumen para ponerse al día rápido (útil para una persona nueva o para una sesión de Claude sin memoria del proyecto).

Índice de los documentos de análisis. Se numeran en el orden en que se van construyendo. Convención de etiquetas usada en todos: ✅/[CONFIRMADO] = requisito oficial del cliente, 🔎/[INFERENCIA] = conclusión razonable derivada del análisis, ⚠️ = suposición sin respaldo directo, ❓/[POR CONFIRMAR] = falta información.

| # | Documento | Contenido | Estado |
|---|---|---|---|
| 01 | [`01-analisis-dominio.md`](./01-analisis-dominio.md) | Dominio, actores, procesos, entidades candidatas, relaciones, qué almacenar vs. qué calcular (basado en referencias académicas, previo a la reunión con el cliente) | Borrador inicial |
| 02 | [`02-hallazgos-reunion-cliente.md`](./02-hallazgos-reunion-cliente.md) | Extracción de requisitos oficiales del fragmento de transcripción de la reunión con el cliente (28/08/2026): categorías de decisión, catálogo vs. decisión tomada, reglas de "no decisión", rangos aleatorios, redistribución de mercado | Parcial — falta el resto de la transcripción |
| 03 | [`03-login-y-formato-entregable.md`](./03-login-y-formato-entregable.md) | Requisitos de login/carga masiva de usuarios, y plantilla de formato para el diagrama de carriles (a partir de un ejemplo de otro proyecto) | Parcial |
| 04 | [`04-diagrama-carriles-borrador.docx`](./04-diagrama-carriles-borrador.docx) | Diagrama de carriles (swimlane) del sistema: Estudiante / Docente-Admin / Sistema × 4 fases, con reglas de negocio clave | Borrador v1 — varias celdas marcadas [POR CONFIRMAR] |
| 05 | [`05-prototipo-equipo.md`](./05-prototipo-equipo.md) | Análisis del prototipo visual "BizSim" hecho por un compañero: qué coincide con lo confirmado, qué lo contradice (ej. valor fijo vs. rango aleatorio) y qué aporta de nuevo (Curso, estructura de estados financieros, catálogo de decisiones con controles) | 🎨 Propuesta del equipo — pendiente de validar contra el cliente |
| 06 | [`06-convenciones-frontend.md`](./06-convenciones-frontend.md) | Convención de estructura de carpetas y organización del código Angular, para que todo el equipo (y cualquier sesión de Claude) construya de forma consistente | Vigente — seguirla desde el primer componente |
| 07 | `07-contrato-api-backend.md` | Propuesta de endpoints REST que necesitará el backend (Spring Boot), extraída de los servicios mock ya implementados en el frontend, con etiquetas de confianza por endpoint (32 endpoints, 5 marcados ❓) | ⚠️ Generado en otra sesión de trabajo sobre este mismo repo — **si estás leyendo esto y el archivo no aparece en esta carpeta, pídele al usuario que lo agregue aquí** (mismo caso que pasó con `docs/02` a `docs/06`, ver `docs/00`) |
| 08 | [`08-respuestas-cliente-ronda-2.md`](./08-respuestas-cliente-ronda-2.md) | Segunda ronda de respuestas del cliente (roles, carga de estudiantes, contraseña generada, categorías cerradas, catálogo no editable, quién cierra el período, Curso/Empresa, ranking pospuesto, caso configurado en el sistema) y su impacto en lo ya construido | Vigente — resuelve 5 de las 5 preguntas abiertas originales de `docs/00`, deja 5 nuevas |

Próximos documentos: resto de reglas de negocio, atributos por entidad, claves primarias/foráneas, relaciones y cardinalidades definitivas, modelo entidad-relación, normalización, diagrama ER, modelo físico de base de datos.
