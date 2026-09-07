# Prototipo del equipo — "BizSim" (paso 4)

**Fuente:** capturas de pantalla de un prototipo hecho por un compañero de equipo, compartidas por ti. Es una idea visual de cómo podría verse el sistema — **no es documentación del cliente**, es trabajo propio del equipo.

## Nueva etiqueta

Hasta ahora veníamos usando ✅ requisito oficial (cliente), 📚 referencia (otros simuladores), 🔎 inferencia (mi razonamiento), ⚠️ suposición, ❓ por confirmar. Esto no encaja en ninguna — es una propuesta de diseño hecha por ustedes mismos. La marco como:

**🎨 PROPUESTA DEL EQUIPO — útil como idea de diseño, pero necesita validarse contra lo que realmente pidió el cliente antes de tratarse como requisito.**

Esto importa especialmente en tu proyecto porque el profesor fue explícito: no inventar requisitos. Una propuesta de un compañero, por buena que sea, corre el mismo riesgo que copiar de otro simulador si se trata como si fuera un requisito confirmado.

---

## ⚠️ Hallazgo importante: hay una contradicción directa con el cliente

En la pantalla "Parametrización del Mercado" (vista Admin/Docente), "Caída de ventas sin publicidad" está modelada como **un valor fijo configurable: -5%**.

Pero el cliente, en la reunión (documento 02), fue explícito en lo contrario: *"Usted le puede colocar una regla de decisión como aleatorio entre el 1 y el 3%... para que no se les caiga igual a ambos [equipos]... no lo hago como un valor fijo... sino un rango que el sistema lo asigne."*

**Esto es justo el tipo de cosa que hay que atrapar antes de que se convierta en código.** El prototipo de tu compañero simplificó a un valor fijo (probablemente para tener algo visual rápido, es válido para un mockup), pero si eso pasa al sistema real tal cual, contradice una instrucción textual del cliente. Te recomiendo mencionárselo a tu compañero: la "Parametrización del Mercado" necesita **un rango (mínimo y máximo)**, no un solo número, para ese tipo de efecto.

---

## Otras cosas del prototipo que vale la pena revisar con el cliente (no las resuelvo yo, solo las señalo)

1. **¿Quién cierra el período?** El botón "Cerrar Periodo y Simular Impacto Financiero" aparece en la pantalla de la **estudiante** (María Rodríguez). Pero las referencias que revisamos en el documento 01 (Univalle) muestran que en simuladores similares es el **tutor/docente** quien avanza el período, no cada estudiante por su cuenta — tiene sentido, porque si un estudiante pudiera cerrar el período solo, podría cerrarlo antes de que su equipo termine de decidir, o antes que los demás equipos, lo cual rompe la lógica de "todos deciden, luego se calcula en conjunto" que confirmamos en la regla de redistribución de mercado (doc 02). ❓ Esto hay que preguntárselo al cliente directamente.

2. **Categorías de decisión: 2 en el prototipo, 3 en lo que dijo el cliente.** El cliente mencionó tres categorías (operacionales, administrativas, comerciales — doc 02). El prototipo agrupa todo en solo dos secciones visibles: "Área Comercial/Marketing" y "Área Admin. Financiera/Producción" (mezclando administrativas y operacionales/producción en una sola). ❓ Por confirmar si esa fusión es intencional o solo simplificación del mockup.

3. **Nombre de la empresa: ambigüedad.** El encabezado dice "TechStart S.A. · Caso 1 · ADMON-301", pero la tabla de Clasificación muestra empresas con nombres distintos por equipo (Alpha Ventures, Beta Corp, Gamma Group...). ❓ No queda claro si "TechStart S.A." es el nombre genérico del caso/escenario (y cada equipo le pone su propio nombre a su empresa) o si es un error de inconsistencia del mockup. Vale la pena aclarar si el nombre de la empresa lo define el estudiante/equipo o viene fijo en el caso.

---

## Lo que sí es útil y coherente — nueva información concreta

Independientemente de las dudas de arriba, el prototipo aporta **estructura concreta** que antes no teníamos, coherente con lo ya confirmado:

**Confirma/operacionaliza la carga inicial de estados financieros (doc 02, punto 2 — la "situación inicial"):** pantalla "Cargar Estados Financieros — Importación masiva desde Excel", con nota: *"El archivo debe contener hojas: Balance, P&G, Parámetros."* Esto le da forma concreta a algo que el cliente solo había descrito en palabras.

**Confirma que falta la carga de estudiantes vía Excel** (tú mismo lo señalaste) — coherente con el documento 03: ese proceso existe como requisito del cliente, pero el prototipo todavía no lo modela.

**Estructura de estado de resultados**, con las líneas: Ventas Netas, (–) Costos de Ventas, (–) Gastos Administrativos, (–) Gastos Laborales, Utilidad Neta — y KPIs adicionales: Activo Total, Patrimonio, ratio Pasivo/Activo.

**Estructura de "Curso"**: aparece un código tipo "ADMON-301" asociado al caso — sugiere que además de Juego/Escenario/Período, probablemente existe un concepto de **Curso** (grupo de clase) que agrupa varios equipos compitiendo entre sí. Esto encaja con el "6 equipos · Curso ADMON-301" de la pantalla de Clasificación.

**Estructura de Clasificación/leaderboard**: por equipo se muestra utilidad neta, una "decisión clave" (resumen automático de la estrategia dominante del equipo) y variación de activos (%) — nos da una idea de qué indicadores importan para comparar equipos entre sí.

**Catálogo de decisiones con tipos de control concretos** (aunque los números específicos son inventados para el mockup, no vienen del cliente):
- Contratar Personal Comercial — interruptor on/off
- Inversión en Publicidad — control deslizante (0–35%)
- Estrategia de Precios — 3 opciones (Agresivo / Estándar / Premium)
- Inversión en I+D — control deslizante (0–15%)
- Política de Crédito a Clientes — 3 opciones (30/45/60 días)
- Capacidad de Producción — 3 opciones (Mantener / Optimizar / Ampliar)

Esto es coherente con el patrón que confirmamos en el documento 02 (catálogo de opciones por decisión, con "no hacer nada" como opción explícita) — el prototipo ya lo está aplicando, solo que con controles visuales distintos según el tipo de decisión (interruptor, deslizador, selección de 3 opciones).

---

## Cómo sigue esto

No voy a tocar el modelo de entidades del documento 01 todavía con esto — primero porque es una propuesta del equipo, no un requisito, y segundo porque ya tienes tres preguntas concretas para resolver con el cliente o con tu compañero antes de que esto se convierta en "verdad" del proyecto. Cuando tengas esas respuestas, actualizo el modelo de una vez con todo junto (esto + el resto de la transcripción + "el caso" si lo consigues).
