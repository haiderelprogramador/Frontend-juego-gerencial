# Hallazgos de la reunión con el cliente (paso 2)

**Fuente:** transcripción de audio de la reunión con el cliente, del 28 de agosto de 2026. ⚠️ Es un fragmento — arranca a mitad de una explicación (minuto 0:09) y cubre aproximadamente los primeros 10 minutos de un audio de ~30 minutos. ❓ POR CONFIRMAR: falta el resto de la transcripción.

A diferencia del documento anterior (`01-analisis-dominio.md`), acá casi todo lo que sigue **sí es ✅ REQUISITO OFICIAL** — son palabras textuales del cliente sobre cómo debe comportarse el sistema, no referencia de otros simuladores. Cito literal cuando es posible.

---

## 1. Mecánica central: no decidir también tiene efecto

✅ REQUISITO OFICIAL — El cliente es explícito: *"No se trata de penalizar la no acción, porque de por sí el no tomar ninguna acción va a tener una penalidad en el sentido de que los indicadores financieros se van a detener."* Y más adelante: *"si usted es una empresa, no toma ninguna decisión y deja que las cosas sigan pasando, el mundo sigue girando, el mercado sigue girando, las cosas pasan aunque usted no cambie nada."*

**Implicación directa para el sistema:** el motor de cálculo de cada período **no puede depender de que existan decisiones tomadas**. Tiene que tener un comportamiento por defecto definido para cada tipo de decisión cuando el participante no decide nada, y ese comportamiento por defecto tiene efecto real sobre los indicadores (no es neutro).

Esto **confirma y concreta** algo que en el documento 01 dejamos como 🔎 inferencia (la máquina de estados del Período: hay un cálculo automático al cierre, independiente de si hubo decisión).

## 2. Situación inicial y períodos

✅ REQUISITO OFICIAL — *"Se supone que es una situación inicial donde los indicadores financieros cierren un periodo contable. A partir de ese momento, ellos van a tener una información adicional a esos estados financieros."*

**Implicación:** existe un período 0 / situación inicial con estados financieros ya cerrados (un punto de partida fijo, igual para todos o por escenario), y a partir de ahí se van sumando períodos con información adicional. Esto confirma que **Período** es una entidad central con un valor inicial "sembrado" (seed), no solo un contador que arranca en 1.

## 3. Existen varios escenarios, y se están construyendo de forma iterativa

✅ REQUISITO OFICIAL — El cliente dice que el primer escenario que va a dar a los estudiantes es el de **"no se tomen decisiones"** (el más simple, para entender el caso), y que después viene el escenario donde sí se toman decisiones: *"el primer escenario va a ser que no se tomen decisiones... entonces, ¿qué sucede si se toman decisiones?"*. También cuenta que este contenido lo va refinando con observaciones: *"yo lo hago la primera vez, ustedes me hacen observaciones... entonces yo esta semana de invierno yo empiezo a darles el escenario."*

**Implicación:** esto **confirma la entidad "Escenario"** que en el documento 01 habíamos dejado como candidata débil (⚠️ suposición). No solo existe, sino que hay al menos dos variantes conocidas hasta ahora (sin decisiones / con decisiones), y el contenido de cada escenario (textos, reglas, efectos) es algo que el cliente sigue editando activamente — lo cual sugiere que esa configuración **no debería quedar fija en el código**, sino ser algo que un rol administrador pueda mantener/actualizar.

## 4. Existen categorías de decisión — confirmadas

✅ REQUISITO OFICIAL — Cita textual: *"Yo tengo que hacerle unas categorías de decisiones, decisiones operacionales, decisiones administrativas, decisiones comerciales, por ejemplo."*

**Esto resuelve una pregunta abierta del documento 01** (sección E punto 8 y la tabla de clasificación): "Área empresarial" **sí es un concepto real del dominio**, con al menos tres categorías conocidas hasta ahora: **operacionales, administrativas, comerciales**. (Dice "por ejemplo", así que ❓ POR CONFIRMAR si hay más categorías además de esas tres.)

## 5. Cada decisión tiene: información + opciones + efecto por opción

✅ REQUISITO OFICIAL — El cliente describe el patrón con el que se le va a presentar cada decisión al estudiante: *"Yo le tengo que decir, aquí está esta información. Las opciones son que no haga nada, que haga algo, y si no hace nada los efectos serían tales. Si hace algo los efectos serían tales otros."* Y más adelante, sobre la interfaz: *"yo lo voy a poner como una especie de... lista desplegable. ¿Cuál es la lista de decisiones que pueden tomar? ¿Y cuáles son los porcentajes?"*

**Esta es la pieza más importante para el modelo de datos de todo lo que ha salido hasta ahora.** Confirma algo que en el documento 01 dejamos como pregunta abierta de diseño (sección E, punto 7): hace falta distinguir dos cosas distintas, no una sola:

- Un **catálogo/menú de decisiones** (configurable): para cada decisión, un texto informativo, una lista de opciones posibles (incluida "no hacer nada" como opción explícita, no como ausencia de dato), y el efecto asociado a cada opción.
- La **decisión efectivamente tomada** por una empresa en un período: qué opción del catálogo eligió.

🔎 INFERENCIA: esto además sugiere que "no hacer nada" debería modelarse como **una opción más dentro del catálogo de cada decisión** (con su propio efecto), no como ausencia de registro — así el cálculo de período siempre tiene una opción elegida (la del catálogo) sobre la cual aplicar el efecto, se haya "decidido" activamente o no.

## 6. Los efectos no siempre son un valor fijo — son rangos con sorteo aleatorio

✅ REQUISITO OFICIAL — Ejemplo de marketing: *"Usted le puede colocar una regla de decisión como aleatorio entre el 1 y el 3%, y el sistema le genera automáticamente una caída entre el 1 y el 3%."* Y explícitamente pide que no sea el mismo valor para todos: *"de pronto, dos grupos no hicieron nada, y la idea es que no se les caiga igual a ambos. A uno se le cae un porcentaje, a otro otro. Y eso tiene que ver con que yo no lo hago como un valor fijo... sino un rango que el sistema, el programa, lo asigne a la empresa."*

**Esto es una regla de negocio explícita, no una inferencia mía.** Implicación de modelo de datos, y acá sí tengo que marcar algo como pendiente de decidir con el cliente:

❓ POR CONFIRMAR (pregunta de diseño que yo NO puedo resolver solo): cuando el sistema "sortea" un valor dentro de un rango (ej. 1%–3%) para una empresa en un período, **¿ese valor sorteado se debe guardar** (para que si alguien vuelve a consultar ese período, o el profesor necesita revisar/justificar por qué a un equipo le fue distinto que a otro, el número siga siendo el mismo), **o se puede recalcular cada vez**? Mi recomendación técnica es guardarlo — si no se guarda, dos consultas del mismo período podrían dar valores distintos (no sería reproducible), y en un contexto académico donde los estudiantes van a cuestionar sus resultados, eso es un problema serio. Pero esto hay que confirmarlo explícitamente con el cliente, no asumirlo.

## 7. Participación de mercado: se redistribuye entre competidores

✅ REQUISITO OFICIAL — *"Si el sector crece al 8% anual, sus ventas van a crecer al 8% descontando ese 2%. Pero ese 2% se distribuye entre las otras empresas del sector que tienen otro porcentaje de participación... el sector crece al 8% pero él pierde mercado con respecto a la competencia."*

**Implicación:** confirma con detalle mecánico algo que en el documento 01 (sección C, proceso 5) habíamos anotado como inferencia — la demanda/participación de una empresa **no se calcula de forma aislada**: el cálculo de un período tiene que procesar todas las empresas de un mismo mercado juntas, porque lo que uno pierde, otro lo gana. Esto refuerza que el cálculo de resultados es un proceso por lote (todas las empresas de un mercado, de un período, a la vez), no una operación empresa-por-empresa independiente.

## 8. Ejemplo de RRHH: capacitación → productividad → ventas

✅ REQUISITO OFICIAL — *"El efecto de campañas o programas de formación y desarrollo del talento humano logran aumentar la productividad... si la persona invierte, en la proporción que invierta va a tener un nivel mayor de productividad. Entonces eso puede traducirse también en un incremento de ventas."*

Segundo ejemplo concreto del mismo patrón (información → decisión → efecto proporcional a lo invertido → impacto en otro indicador). Refuerza el patrón de catálogo de decisiones de la sección 5.

## 9. Flujo contable y decisiones financieras/administrativas

✅ REQUISITO OFICIAL — *"Cuando uno tiene el estado de resultado, al final queda de utilidad neta. De esa utilidad neta... se determina el flujo de caja. Y a partir del flujo de caja... esto es lo que tiene disponible la empresa para reposición de capital de trabajo, para pago de obligaciones, y si queda, ya queda para reparación de utilidad."*

Decisiones concretas mencionadas en esta línea (categoría "administrativas", según el punto 4): cuánto capital de trabajo reponer, cuánto repartir de utilidad, o si las utilidades se capitalizan — *"pero si las utilidades se capitalizan, eso tiene efecto"* (no se explica cuál todavía).

---

## Cómo esto actualiza las entidades candidatas del documento 01

| Entidad (doc. 01) | Estado antes | Estado ahora |
|---|---|---|
| Período | Candidata, con estado abierto/cerrado (🔎 inferencia) | ✅ Confirmada como eje central; confirmado que existe un período inicial "sembrado" con estados financieros cerrados |
| Escenario | Candidata débil (⚠️ suposición) | ✅ Confirmada — existen al menos 2 variantes conocidas, en construcción activa por el cliente |
| Área empresarial / categoría de decisión | "Probablemente atributo, no entidad" (⚠️ suposición) | ✅ Confirmada como concepto real: operacionales, administrativas, comerciales (mínimo) |
| Decisión | Candidata única (dudas sobre tabla genérica vs. especializada) | ✅ Se confirma que hace falta **dos entidades**, no una: catálogo de opciones de decisión (config) + decisión tomada (transaccional) |
| Empresa / Mercado | Candidatas, relación N a N vía "oferta producto-mercado" | ✅ Confirmado que el cálculo de participación de mercado es por lote, entre todas las empresas de un mismo mercado en un mismo período |
| Resultado / Indicador (¿se guarda o se calcula?) | Pregunta abierta (sección H) | Sigue abierta, pero ahora con un caso concreto: el valor "sorteado" dentro de un rango — ❓ por confirmar si se almacena |

---

## Preguntas para seguir (antes de pasar a reglas de negocio formales)

1. ¿Tienes el resto de la transcripción (después del minuto 10)? Claramente la conversación sigue — se corta a mitad de la explicación de decisiones comerciales.
2. Mencionan varias veces **"el caso"** como documento aparte (ej. *"eso no está todavía en el caso"*) — ¿existe ese documento del caso de negocio base? Sería la fuente más concreta de números y reglas exactas.
3. Todavía tienes pendiente el documento que el cliente generó con IA — ¿lo compartes también? Así lo cruzamos contra esto y marcamos qué coincide y qué no.
4. ¿El profesor/cliente va a ser también un usuario del sistema (rol administrador/docente que configura escenarios y catálogos de decisión), o esta reunión es solo para que ustedes entiendan la mecánica y la carguen ya definida? Esto cambia bastante el modelo — si él necesita editar el catálogo desde el sistema, hace falta una pantalla/entidad de configuración; si no, puede ir precargado.
