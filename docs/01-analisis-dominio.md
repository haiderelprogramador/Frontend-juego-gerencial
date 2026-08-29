# Análisis de Dominio — Simulador de Juego Gerencial

**Paso 1 de 15** (según el orden que definiste en el punto 15 de tu contexto). Este documento cubre los puntos A–H que pediste. Es un documento vivo: lo iremos ampliando en los siguientes pasos (reglas de negocio, atributos, claves, ER, normalización, modelo físico).

---

## 0. Nota metodológica — cómo leer las etiquetas

Antes de empezar, dos aclaraciones importantes:

**Aún no tenemos documentación oficial del proyecto en esta conversación.** No se ha compartido ningún enunciado, guía del profesor, rúbrica ni especificación propia. Esto significa que **ningún elemento de este documento lleva la etiqueta ✅ REQUISITO OFICIAL** — sería inventar. Todo lo que sigue es análisis de dominio preparatorio, construido con las cinco fuentes que tú mismo señalaste. En cuanto compartas el documento oficial, este análisis se revisa y se promueven (o se descartan) los elementos que correspondan.

**Sobre las etiquetas.** Tú definiste cuatro categorías de información (oficial, referencia, inferencia, suposición) pero solo diste emoji explícito para tres de ellas (📚 referencia, ⚠️ suposición, ✅ oficial) más ❓ por confirmar. Para la categoría 3 ("inferencias → conclusiones razonables del análisis") voy a usar **🔎 INFERENCIA**, ya que no diste un símbolo para ella y la necesito para distinguir "esto lo dice literalmente una fuente" de "esto lo deduzco razonando sobre varias fuentes". Dime si prefieres otro símbolo y lo cambio desde ya.

Resumen de etiquetas usadas de aquí en adelante:

| Etiqueta | Significa |
|---|---|
| ✅ REQUISITO OFICIAL | Viene explícitamente de la documentación oficial de *tu* proyecto (todavía no existe ninguna instancia de esto) |
| 📚 REFERENCIA | Está respaldado textualmente por una de las fuentes académicas que citaste |
| 🔎 INFERENCIA | Conclusión razonable derivada de cruzar varias referencias — no es un requisito, es razonamiento |
| ⚠️ SUPOSICIÓN | Algo que propongo sin respaldo directo, para que lo evalúes |
| ❓ POR CONFIRMAR | Falta información — no se puede decidir todavía |

**Sobre las fuentes que sí pude leer a fondo.** De las cinco referencias que diste, dos tenían documentos con texto accesible y las leí completas:

1. **UNAB (2004)** — tesis *"Implementación de un simulador gerencial para el desarrollo de habilidades en estudiantes de administración"*, sistema llamado *"Ant's Business Game"*. PDF: `repository.unab.edu.co/bitstream/handle/20.500.12749/1320/2004_Tesis_Julie_Piedad_Vera_Quiroz.pdf`
2. **Univalle** — *Manual del Simulador de Gestión Estratégica* (CUSE). PDF: `cuse.univalle.edu.co/images/TUTORIALES/Manual-Gestin-Estratgica.pdf`

La página de repositorio de la **UNAL** (`repositorio.unal.edu.co/handle/unal/52026`) solo expuso metadatos (autor: Edgar Van den Berghe Romero, 1997, editorial U. Nacional) sin el texto completo del libro. **Millennium** e **Implexa** no arrojaron documentación textual accesible por búsqueda — de esas dos solo tengo lo que tú mismo resumiste en tu contexto, así que las cito como "según tu resumen", no como fuente verificada por mí directamente. Esto es relevante: la profundidad de la sección 📚 REFERENCIA es desigual entre fuentes, no porque unas importen menos, sino porque no todas tenían texto público accesible.

---

## A. ¿Qué es el dominio del juego gerencial?

El dominio, tal como lo planteaste, es un ciclo cerrado:

```
EMPRESA SIMULADA → INFORMACIÓN DEL ENTORNO → TOMA DE DECISIONES →
PROCESAMIENTO/SIMULACIÓN → RESULTADOS → NUEVAS DECISIONES → …
```

📚 REFERENCIA — Las dos fuentes que leí completas confirman y afinan este ciclo:

- UNAB: el flujo se describe como *"Entrada → Decisiones → Mercado → Nuevo estado → Informes periódicos"*, y el ciclo temporal es explícito: *"Los participantes del Programa del Juego Gerencial tomarán decisiones semanalmente, en donde simularán cada trimestre el manejo directivo de una empresa."*
- Univalle: *"la gestión ha de realizarse de manera periódica, es decir, el análisis y las decisiones a tomar se realizan siempre al comienzo del periodo, y se ejecutarán a lo largo de los meses siguientes."*

🔎 INFERENCIA — Cruzando ambas fuentes con tu modelo conceptual y con lo que resumiste de la UNAL, el Manual de Gestión Estratégica (UNAD/Studocu) y Gestionet (Univalle), el dominio tiene tres características estructurales que se repiten independientemente del simulador concreto:

1. **Es discreto en el tiempo, no continuo.** La simulación avanza por unidades (llamadas "período", "ronda" o "ciclo") y no en tiempo real. Esto es estructural para el modelo de datos: hay una entidad temporal que actúa como eje de todo lo demás.
2. **Es un sistema multi-agente con recursos compartidos.** Varias empresas (equipos) compiten dentro del mismo entorno (mercado), y las decisiones de una afectan los resultados de las otras — UNAB: *"el comportamiento de los competidores afecta los resultados de la compañía"*; Univalle: *"la competencia estará formada por empresas 'reales' manejadas por otras personas, pero también por empresas de funcionamiento automático."*
3. **Tiene una capa de configuración/escenario separada de la capa de ejecución.** Antes de que empiece el juego alguien (administrador/tutor) define parámetros (mercados, productos, reglas, duración) que luego se instancian y ejecutan. UNAB documenta explícitamente un rol que *"define periodo, define mercado, parametriza mercado, crea empresa"* — es decir, configuración y ejecución son procesos distintos con dueños distintos.

⚠️ SUPOSICIÓN — No sabemos todavía si *tu* proyecto tiene estas tres características (multi-equipo, multi-período, configuración separada de ejecución) o si es una versión más simple (un solo período, una sola empresa, sin competencia). Esto es exactamente el tipo de cosa que la documentación oficial debe confirmar o descartar.

❓ POR CONFIRMAR — Alcance real de tu proyecto: ¿la simulación es multijugador/por equipos o de un solo jugador contra el sistema? ¿cuántos períodos contempla? ¿hay una fase de configuración administrable o los parámetros vienen fijos en el sistema?

---

## B. ¿Cuáles son los actores posibles?

📚 REFERENCIA — Actores encontrados literalmente en las dos fuentes leídas a fondo:

**De UNAB ("Ant's Business Game"):**
- **Super Administrador** — según los diagramas de caso de uso, tiene capacidad de *"crear administrador"* y *"crea juego"*.
- **Administrador del juego** — *"establece las reglas y da la información necesaria sobre los recursos y limitaciones"*; en el módulo administrativo *"define periodo, define mercado, parametriza mercado, crea empresa, modifica juego"*.
- **Docente** — participa en la supervisión del juego (rol de acompañamiento, distinto del administrador técnico).
- **Participante (estudiante)** organizado en **Equipo** — *"Los estudiantes se organizan en equipos de máximo cinco personas para manejar una empresa"*; cada equipo presenta *"mediante un informe escrito en la primera Junta Directiva la misión, la visión, la imagen corporativa"*.

**De Univalle (Gestión Estratégica):**
- **Participante/alumnado** — *"el alumnado puede ser diferente en función del escenario utilizado y de los requerimientos del profesorado"*.
- **Tutor** — *"Cuando todos los participantes hayan llevado a cabo la gestión oportuna del periodo en curso, el tutor de la simulación podrá proceder al paso al siguiente periodo"* — es decir, el tutor tiene un rol activo de control de flujo, no solo de observación.
- **Empresa automática** — un actor no humano: *"empresas de funcionamiento automático"* que compiten sin ser manejadas por una persona.

🔎 INFERENCIA — Comparando los dos sistemas, hay un patrón de **tres niveles de actor** que se repite: (1) alguien que administra la plataforma en general (super admin / admin técnico), (2) alguien que administra o acompaña *una instancia* del juego — un curso, un grupo, un semestre (docente/tutor), y (3) quien juega (participante, individualmente o en equipo). Además, ambos sistemas contemplan la posibilidad de un **competidor no humano** (empresa automática / manejada por el computador), lo cual es relevante porque sugiere que "competidor" no es necesariamente una persona.

⚠️ SUPOSICIÓN — Es razonable pensar que un simulador académico típico necesita al menos dos niveles de actor humano (quien administra/configura y quien juega), pero no puedo asumir que tu proyecto separa "super admin" de "admin" como lo hace UNAB — puede que tu proyecto tenga un solo rol administrativo, o que ni siquiera tenga rol docente si es un proyecto centrado solo en la mecánica de juego.

❓ POR CONFIRMAR — Lista de actores exacta para tu proyecto: ¿existe rol docente/tutor? ¿existe un rol administrativo separado del docente? ¿los participantes juegan individualmente o en equipo? ¿el sistema contempla "empresas automáticas" (bots/IA) como competencia, o toda la competencia es entre participantes reales?

---

## C. ¿Cuáles son los procesos principales?

📚 REFERENCIA — Procesos concretos documentados en las fuentes:

1. **Configuración del juego** (UNAB): definir período, definir mercado, parametrizar mercado, crear empresa, modificar juego, validar usuario (autenticación).
2. **Toma de decisiones por período**, organizada por áreas. UNAB documenta decisiones de Marketing (publicidad, precio, mejoras de producto, promoción, estudios de mercado) y Producción (producción interna, tecnología, clase de producción, maquila, traslado de materia prima/producto terminado, solicitud de materia prima, precio de venta por región). Univalle documenta un espectro más amplio: Estrategia corporativa, Estrategias competitivas, Operaciones, Compras, RRHH (comerciales y operarios), Marketing (precios, distribución, producto, campañas, medios), Finanzas (préstamos, inversiones) e I+D+i.
3. **Cierre de período / avance de ronda**, controlado por un actor humano: *"el tutor de la simulación podrá proceder al paso al siguiente periodo"* (Univalle) — es decir, el avance de período no es automático por tiempo, sino un evento disparado deliberadamente.
4. **Procesamiento/cálculo de resultados.** UNAB describe procesos matemáticos explícitos: *"Multiplicación de la matriz de costos de traslado de producto por la matriz cantidad de productos terminados trasladados"*, *"Multiplicación del número de Pautas por su costo"*, etc. — decisiones (cantidades) se combinan con parámetros/costos (matrices) para producir resultados.
5. **Determinación de mercado/competencia**: la demanda y los resultados de una empresa dependen de las decisiones de las demás — Univalle: *"La demanda se verá afectada... por políticas de precios, campañas publicitarias, comerciales contratados y promociones."*
6. **Generación de informes/reportes periódicos** — UNAB: *"Los informes periódicos... serán entregados en fechas y horas suministradas por el administrador del juego."* Univalle presenta esto como pantallas de información: Balance, PyG (pérdidas y ganancias), EFE (estado de flujo de efectivo), Competencia.
7. **Evaluación/valoración de la gestión** (más elaborado en Univalle): valoración por objetivos, coherencia estratégica, responsabilidad social, innovación, RRHH, marketing, financiera y producción, calculada *"tras cada periodo"*.
8. **Previsión/proyección** (Univalle): una pantalla de *"Previsión contable"* que proyecta el período siguiente sin haberlo ejecutado aún, distinta del cálculo real de cierre de período.

🔎 INFERENCIA — El proceso raíz es siempre el mismo ciclo de tu punto A (decisión → procesamiento → resultado → nueva decisión), pero las dos fuentes muestran que ese ciclo tiene **sub-procesos con dueños distintos**: el participante dispara "tomar decisión", el tutor/administrador dispara "avanzar período", y el sistema dispara "calcular resultados" y "determinar mercado" de forma automática al cierre. Esto importa para el modelo de datos porque sugiere que el "período" tiene una máquina de estados (abierto para decisiones → cerrado/procesado → resultados publicados), no es solo un contador.

❓ POR CONFIRMAR — ¿Tu proyecto necesita todas estas fases (configuración, decisión, cierre manual, cálculo, mercado competitivo, reportes, evaluación, previsión) o solo un subconjunto? Esto depende directamente de los requisitos oficiales.

---

## D. ¿Qué información necesita manejar un simulador gerencial? (a nivel de dominio general)

📚 REFERENCIA + 🔎 INFERENCIA — Agrupando lo que documentan ambas fuentes, la información se organiza en cuatro capas:

1. **Información de configuración/catálogo** (se define antes de jugar y cambia poco): productos, mercados/regiones, tecnologías, materias primas, tipos de publicidad, escenario, reglas del juego, duración en períodos.
2. **Información de identidad/participación**: usuarios, participantes, equipos, qué empresa gestiona cada equipo, en qué juego/simulación están inscritos.
3. **Información transaccional (decisiones)**: qué decidió cada empresa, en qué período, en qué área, con qué valores — esto es el corazón del sistema, es lo único que el usuario *ingresa* activamente en cada ciclo.
4. **Información derivada/resultado**: todo lo que el sistema *calcula* a partir de las decisiones y el catálogo — ventas, cuota de mercado, indicadores financieros (ROA, liquidez, crecimiento), valoraciones, reportes.

Esta separación (catálogo / participación / decisión / resultado) es la que más nos va a servir más adelante para distinguir qué se almacena directamente (secciones G y H).

❓ POR CONFIRMAR — El detalle exacto de cada capa depende enteramente de las áreas de negocio que tu proyecto decida cubrir (¿solo producción y marketing como UNAB? ¿el espectro completo de Univalle: estrategia, operaciones, compras, RRHH, marketing, finanzas, I+D? ¿algo distinto y más simple?).

---

## E. Entidades candidatas (con trazabilidad)

Aplicando tu esquema de trazabilidad (Requisito → Proceso → Información → Entidad → Atributos → Relaciones), y usando por ahora el **dominio general** como sustituto temporal del requisito oficial (que todavía no existe), estas son las entidades candidatas. **Ninguna es definitiva.** Todas están sujetas a validación cuando tengamos documentación oficial.

Para cada una respondo: por qué existe, qué información representa, qué proceso la necesita, con qué se relaciona, y cardinalidad tentativa.

### 1. Usuario / Participante
- **Por qué existiría:** alguien debe autenticarse y ser identificado como responsable de las decisiones de una empresa. UNAB documenta explícitamente un proceso de *"Validar usuario"*.
- **Qué representa:** datos de identidad y credenciales de acceso; posiblemente separado en dos conceptos — *Usuario* (cuenta de acceso al sistema) y *Participante* (rol de ese usuario dentro de un juego concreto, asociado a una empresa).
- **Proceso que la necesita:** autenticación, toma de decisiones (¿quién decidió?), reportes (¿a quién se le entrega?).
- **Relación tentativa:** un Usuario puede participar en varios Juegos/Simulaciones (si el sistema es multi-curso); un Participante pertenece a un Equipo o directamente a una Empresa.
- **Cardinalidad tentativa:** Usuario (1) — Participante (N), si un mismo usuario puede participar en varias simulaciones a lo largo del tiempo. ❓ POR CONFIRMAR si esto aplica a tu proyecto o si es de un solo uso.
- 🔎 INFERENCIA: separar "Usuario" de "Participante" evita duplicar credenciales si la misma persona juega en más de un semestre/curso — pero es una decisión de diseño, no un hecho confirmado por ninguna fuente.

### 2. Equipo
- **Por qué existiría:** en ambas fuentes, una empresa puede ser gestionada por más de una persona. UNAB: *"equipos de máximo cinco personas para manejar una empresa"*.
- **Qué representa:** agrupación de participantes que comparten la responsabilidad de una empresa.
- **Proceso que la necesita:** asignación de empresa, reparto de decisiones dentro del equipo.
- **Relación tentativa:** Equipo (1) — Participante (N); Equipo (1) — Empresa (1).
- **Cardinalidad tentativa:** 1 a N y 1 a 1 respectivamente.
- ❓ POR CONFIRMAR: si tu proyecto es de un solo jugador por empresa, esta entidad probablemente no se necesita (el Participante sería directamente dueño de la Empresa, sin capa de Equipo).

### 3. Empresa
- **Por qué existiría:** es el objeto central del dominio — todo el juego gira en torno a gestionar una empresa simulada.
- **Qué representa:** la organización que un equipo/participante dirige: nombre, misión/visión (UNAB menciona esto explícitamente), tipo (real vs. automática — ver Univalle), estado financiero acumulado.
- **Proceso que la necesita:** prácticamente todos — decisiones, cálculo de resultados, competencia de mercado, reportes.
- **Relación tentativa:** Empresa (1) — Decisión (N); Empresa (N) — Mercado (N, si participa en varios mercados/productos); Empresa (1) — Equipo o Participante (1).
- **Cardinalidad tentativa:** ver arriba.
- 🔎 INFERENCIA importante: Univalle deja claro que un "competidor" no es una entidad distinta de "Empresa" — es la misma entidad con un atributo que indica si es manejada por una persona o es *"de funcionamiento automático"*. Esto sugiere que **"Competidor" probablemente NO debería ser una entidad separada**, sino un atributo/tipo de Empresa. Lo marco como hallazgo relevante para cuando definamos entidades finales.

### 4. Juego / Simulación
- **Por qué existiría:** UNAB documenta un proceso explícito de *"crea juego"* separado de la creación de empresas — es decir, "el juego" (una instancia del simulador: un curso, un grupo, una corrida) es distinto de "una empresa dentro del juego".
- **Qué representa:** una instancia configurable del simulador — quién la administra, cuántos períodos dura, qué escenario usa, qué empresas/equipos participan.
- **Proceso que la necesita:** configuración inicial, control de acceso (¿quién puede unirse?), cierre general.
- **Relación tentativa:** Juego (1) — Empresa (N); Juego (1) — Período (N); Juego (1) — Administrador/Docente (1 o N).
- **Cardinalidad tentativa:** 1 a N en ambos casos.
- ❓ POR CONFIRMAR: si tu proyecto solo va a tener *una* instancia de simulación corriendo a la vez (por ejemplo, un solo salón de clase, un solo semestre), esta entidad podría no ser necesaria como tabla separada — sería una suposición implícita del sistema. Esto es una decisión de alcance, no algo que se pueda inferir del dominio.

### 5. Escenario
- **Por qué existiría:** Univalle: *"el alumnado puede ser diferente en función del escenario utilizado"* — el escenario parece ser una plantilla de configuración reutilizable (parámetros iniciales, mercados disponibles, productos disponibles) que luego se instancia en un Juego concreto.
- **Qué representa:** conjunto de parámetros iniciales/plantilla del entorno de simulación.
- **Proceso que la necesita:** configuración del juego.
- **Relación tentativa:** Escenario (1) — Juego (N), si un mismo escenario se reutiliza en varias corridas.
- ⚠️ SUPOSICIÓN: es igualmente posible que en tu proyecto "escenario" y "juego" sean el mismo concepto (sin reutilización de plantillas). Necesita confirmación.

### 6. Período
- **Por qué existiría:** es el eje temporal del dominio — ambas fuentes coinciden en que la simulación avanza por ciclos discretos, no en tiempo real.
- **Qué representa:** un número/ciclo dentro de un Juego, con un estado (abierto para decisiones / cerrado / procesado).
- **Proceso que la necesita:** toma de decisiones (¿en qué período se tomó?), cálculo de resultados, avance de ronda.
- **Relación tentativa:** Juego (1) — Período (N); Período (1) — Decisión (N); Período (1) — Resultado (N, si los resultados se historizan — ver sección H).
- **Cardinalidad tentativa:** 1 a N en todos los casos.
- 🔎 INFERENCIA: el Período necesita un **estado** (no solo un número consecutivo), porque Univalle documenta que el avance depende de una acción del tutor, no del calendario — es decir, hay un momento en que el período está "en curso" y otro en que está "cerrado y calculado".

### 7. Decisión
- **Por qué existiría:** es la entrada activa del usuario en cada ciclo — el ejemplo metodológico que tú mismo diste en el punto 12 la usa como caso base.
- **Qué representa:** qué decidió una Empresa, en qué Período, en qué área, con qué valor(es). UNAB muestra que el valor no siempre es un solo número — puede ser una combinación (cantidad + tecnología + región, por ejemplo, en producción).
- **Proceso que la necesita:** captura de decisiones, cálculo de resultados (las decisiones son el insumo de las fórmulas).
- **Relación tentativa:** Empresa (1) — Decisión (N); Período (1) — Decisión (N); Decisión (N) — Área/Producto/Mercado (según el tipo de decisión).
- **Cardinalidad tentativa:** 1 a N en ambos casos.
- 🔎 INFERENCIA importante: dado que UNAB modela tablas separadas por tipo de decisión (`DecisionAM` para marketing, `DecisionAP` para producción, cada una con sub-tablas específicas como `MejorasProducto`, `PublicidadE`, `ProduccionInterna`), hay dos caminos de diseño posibles: (a) una tabla genérica "Decisión" con un atributo de tipo/área y un valor flexible, o (b) una tabla especializada por cada tipo de decisión, como hace UNAB. **Esto es una decisión de diseño que depende de cuántas y cuáles áreas de decisión tenga tu proyecto — no se puede resolver sin esa información.** ❓ POR CONFIRMAR.

### 8. Área empresarial / Categoría de decisión
- **Por qué podría existir:** ambas fuentes agrupan decisiones en áreas (Marketing, Producción, Finanzas, RRHH, I+D, Compras, Estrategia).
- **Qué representa:** una clasificación de las decisiones.
- ⚠️ SUPOSICIÓN — Esto probablemente **no es una entidad con datos propios**, sino un atributo tipo catálogo/enum de la entidad Decisión (o, como en UNAB, se resuelve con tablas de decisión separadas por área en vez de un catálogo). Lo incluyo como candidata débil, marcada explícitamente como la más dudosa de la lista.
- ❓ POR CONFIRMAR.

### 9. Producto
- **Por qué existiría:** ambas fuentes lo usan como unidad sobre la que se toman decisiones de precio, producción y marketing.
- **Qué representa:** un bien/servicio que la empresa fabrica y comercializa, con costos y características propias (costo de materia prima, tiempos de fabricación — Univalle).
- **Proceso que la necesita:** decisiones de producción, precio, marketing; cálculo de ventas.
- **Relación tentativa:** Producto (N) — Mercado (N, relación muchos-a-muchos vía una entidad intermedia "Producto en Mercado", ya que Univalle maneja datos *por combinación* producto-mercado: precio, unidades vendidas, cuota de mercado); Producto (N) — Empresa (si cada empresa define sus propios productos) o Producto (1) — Juego/Escenario (si el catálogo de productos es fijo y compartido).
- ❓ POR CONFIRMAR: si el catálogo de productos es fijo (definido por el escenario, igual para todas las empresas) o si cada empresa/equipo puede crear los suyos.

### 10. Mercado
- **Por qué existiría:** unidad geográfica/segmento sobre la que se compite — Univalle documenta atributos ricos por mercado: moneda, tamaño (población), sensibilidad a precio/calidad, estacionalidad, número de empresas presentes.
- **Qué representa:** un entorno de demanda con reglas propias.
- **Proceso que la necesita:** decisiones de distribución/precio por mercado, cálculo de demanda y cuota de mercado.
- **Relación tentativa:** ver Producto arriba (relación N a N vía combinación producto-mercado).

### 11. Resultado / Indicador (candidata débil, ver sección H)
- **Por qué podría existir:** si el sistema necesita mostrar histórico de desempeño (no solo el estado actual), entonces los resultados calculados de cada período deben *guardarse*, no solo calcularse al vuelo.
- ❓ POR CONFIRMAR — ver el análisis completo en la sección H, porque esta es precisamente la pregunta "qué se calcula vs. qué se almacena" que pediste separar.

---

## F. ¿Qué relaciones existen entre esas entidades? (borrador textual, no diagrama todavía)

🔎 INFERENCIA — Con las entidades candidatas de la sección E, el mapa de relaciones tentativo es:

- Usuario (1) — (N) Participante
- Juego (1) — (N) Empresa
- Juego (1) — (N) Período
- Juego (0..1) — se instancia desde — (1) Escenario
- Equipo (1) — (N) Participante ; Equipo (1) — (1) Empresa
- Empresa (1) — (N) Decisión
- Período (1) — (N) Decisión
- Decisión (N) — (1) Área/tipo de decisión (si se modela como catálogo)
- Producto (N) — (N) Mercado, resuelta mediante una entidad asociativa (p. ej. "OfertaProductoMercado") que en Univalle guarda precio, unidades vendidas y cuota de mercado por combinación
- Empresa (N) — (N) Producto (si cada empresa decide qué productos fabricar) o Producto (N) — (1) Juego/Escenario (si el catálogo es compartido)
- Período (1) — (N) Resultado, y Empresa (1) — (N) Resultado (si se decide historizar resultados — pendiente de la sección H)

⚠️ SUPOSICIÓN — Este mapa es plausible pero **no está confirmado por ninguna fuente específica de tu proyecto**; es una combinación razonada de lo que documentan UNAB y Univalle. No debe usarse todavía para construir un diagrama ER formal (eso es el paso 12 de tu lista, y depende de validar primero las entidades).

---

## G. ¿Qué información debe almacenarse?

🔎 INFERENCIA — Con base en la distinción de capas de la sección D, lo que casi con seguridad debe persistirse (independientemente del alcance final) es:

- **Identidad y acceso:** usuarios, credenciales, roles.
- **Configuración/catálogo:** productos, mercados, tecnologías u otros parámetros que definan las "reglas del mundo" (esto no cambia solo, alguien lo captura).
- **Estructura de participación:** qué empresa existe, quién la gestiona (equipo/participante), a qué juego/simulación pertenece.
- **Decisiones tomadas:** esta es la más innegociable — es la única información que el sistema no puede reconstruir de ninguna otra forma, porque es la que el usuario decide activamente. Si se pierde, se pierde la partida.
- **Estado del período** (abierto/cerrado) — necesario para controlar el flujo del juego.

❓ POR CONFIRMAR — El resto depende del alcance oficial: si el proyecto requiere una fase de "escenario reutilizable" o basta con configuración fija embebida en el sistema; si hay multi-juego o una sola instancia.

---

## H. ¿Qué información probablemente debería calcularse en vez de almacenarse?

Esta es la pregunta que más impacto tiene en el diseño de base de datos, así que la desarrollo con cuidado.

🔎 INFERENCIA — Los siguientes datos, en principio, **son derivables matemáticamente a partir de las Decisiones y el Catálogo**, y por regla general de diseño de bases de datos no deberían almacenarse como fuente de verdad (para evitar inconsistencias entre el dato guardado y el dato recalculado):

- Indicadores financieros como ROA, liquidez, crecimiento de ventas — Univalle da las fórmulas explícitas (p. ej. *"ROA (Resultado de explotación / ((Activo total + Activo total anterior)/2))"*), lo que confirma que son fórmulas aplicadas sobre datos base, no datos capturados directamente.
- Demanda de mercado y cuota de mercado — se calculan combinando las decisiones de *todas* las empresas de un mercado en un período (por eso dependen de más de una empresa a la vez, no se pueden simplemente "guardar" al momento de decidir).
- Valoraciones/evaluaciones de gestión (objetivos, coherencia, innovación, etc. en Univalle) — son agregaciones sobre decisiones y resultados.

⚠️ SUPOSICIÓN — Sin embargo, hay una tensión de diseño real, no una regla absoluta: **muchos simuladores sí *historizan* (guardan) los resultados calculados de cada período**, aunque técnicamente sean derivables, por dos razones prácticas que aparecen implícitas en las fuentes: (1) rendimiento — recalcular toda la historia cada vez que alguien quiere ver un reporte del período 3 de una simulación que ya lleva 10 períodos es costoso; y (2) trazabilidad/auditoría — si cambian las fórmulas del sistema con el tiempo, los resultados históricos deben quedar "congelados" tal como se calcularon entonces, no recalculados con la fórmula nueva. UNAB apunta en esta dirección al mencionar informes periódicos entregados en fechas fijas (sugiere un snapshot guardado, no un cálculo bajo demanda) y Univalle explícitamente distingue una pantalla de *"Previsión contable"* (proyección, calculada al vuelo, explícitamente hipotética) de los resultados reales de cierre de período (que se presentan como hecho consumado, no como proyección).

❓ POR CONFIRMAR — Esta es una de las decisiones de diseño más importantes que vamos a tener que tomar, y **no se puede resolver por dominio general — depende de si tu proyecto necesita historial/reportes de períodos anteriores, o si solo importa el estado actual**. Te lo marco como pregunta explícita para cuando tengamos (o definamos) los requisitos oficiales:

> ¿El sistema debe poder mostrar/consultar el resultado de períodos anteriores tal como se calcularon en su momento (→ se debe historizar/almacenar), o solo interesa el estado más reciente de la empresa (→ se puede calcular bajo demanda y no hace falta guardar resultados históricos)?

---

## Clasificación: entidad vs. atributo/concepto/proceso/regla (tu punto 8)

Con la lista de conceptos comunes que propusiste, esta es la clasificación preliminar:

| Concepto | Clasificación tentativa | Nota |
|---|---|---|
| Usuario | Entidad candidata | Identidad/acceso |
| Participante | Entidad candidata (o rol de Usuario) | ❓ podría fusionarse con Usuario |
| Equipo | Entidad candidata | Solo si hay multi-jugador por empresa |
| Empresa | Entidad candidata (núcleo del dominio) | — |
| Simulación / Juego | Entidad candidata | Solo si hay multi-instancia |
| Escenario | Entidad candidata débil | Podría fusionarse con Juego |
| Período | Entidad candidata (núcleo del dominio) | Necesita estado, no solo número |
| Decisión | Entidad candidata (núcleo del dominio) | La entrada activa del sistema |
| Área empresarial | Probablemente **atributo/catálogo**, no entidad con datos propios | ❓ por confirmar |
| Producto | Entidad candidata | — |
| Mercado | Entidad candidata | — |
| Competidor | **No es entidad separada** — es un atributo/tipo de Empresa | 🔎 inferencia de Univalle |
| Resultado | Depende del historial (sección H) | Podría ser entidad o ser solo cálculo |
| Indicador | Probablemente **cálculo**, no entidad | Es una fórmula sobre Resultado/Decisión |
| Reporte | Probablemente **proceso/vista**, no entidad | Se arma con datos de otras entidades |
| Regla de negocio | **No es entidad** — es lógica del sistema o, si se quiere parametrizar, configuración del Escenario/Juego | — |

---

## Preguntas para la documentación oficial (o para tu profesor)

Para poder avanzar de "candidatas" a "confirmadas" necesitamos respuestas a esto, en orden de impacto sobre el modelo de datos:

1. ¿El proyecto es multi-instancia (varios juegos/cursos corriendo con configuraciones distintas) o una sola simulación fija?
2. ¿Juego individual (un participante = una empresa) o por equipos?
3. ¿Qué áreas de decisión cubre exactamente? (¿solo una o dos áreas simples, o el espectro completo estilo Univalle: estrategia, producción, compras, RRHH, marketing, finanzas, I+D?)
4. ¿Hay competencia entre empresas dentro del mismo mercado, o cada empresa se simula de forma aislada?
5. ¿El sistema necesita mostrar historial de períodos anteriores, o solo el estado actual? (Esta es la pregunta clave de la sección H.)
6. ¿Los productos/mercados son un catálogo fijo del sistema, o son configurables por quien administra el juego?
7. ¿Existen roles docente/administrador separados, o el proyecto se enfoca solo en la mecánica del jugador?

---

## Próximos pasos

Según tu lista del punto 15, ya tenemos un primer borrador de: (1) descripción del dominio, (2) actores, (3) procesos, (6) entidades candidatas, (10) relaciones — todo marcado como candidato/referencia, nada como oficial. Lo que sigue, en tu orden, es reglas de negocio y luego atributos — pero ambos dependen mucho de las respuestas a las 7 preguntas de arriba. Dime cómo quieres seguir: si tienes ya el enunciado oficial o la guía del profesor, compártelo y reviso este documento completo contra eso antes de seguir; si todavía no lo tienes, podemos avanzar asumiendo explícitamente un alcance de trabajo (todo marcado ⚠️ SUPOSICIÓN) para no quedar bloqueados, y lo ajustamos después.
