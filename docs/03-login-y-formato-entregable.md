# Autenticación (nueva info del cliente) + formato de entregable de referencia (paso 3)

## Parte 1 — Inicio de sesión y gestión de usuarios

**Fuente:** lo que me cuentas de memoria de la reunión de ayer (no es cita textual de la transcripción, es tu resumen — lo marco igual como ✅ requisito oficial porque viene del cliente, pero ten en cuenta que si luego aparece en la transcripción completa con más detalle, esa versión manda sobre esta).

✅ REQUISITO OFICIAL — Hay al menos dos roles con acceso al sistema: **Admin** y **Docente**, que el cliente describe como "casi lo mismo". Ambos se pueden **registrar o loguear** — es decir, a diferencia de los estudiantes, ellos sí tienen un flujo de registro propio.

✅ REQUISITO OFICIAL — Existe un **proceso de carga masiva de estudiantes**: el Admin/Docente obtiene un listado de usuarios/estudiantes mediante un archivo Excel, del cual se extrae: correo, nombre, y "otra información" (❓ por confirmar qué más — ¿número de identificación va aparte o es parte de esa "otra información"? ¿programa académico, grupo, equipo asignado?).

✅ REQUISITO OFICIAL — A cada usuario (estudiante) se le asigna automáticamente una **contraseña generada por el sistema**, con un patrón de siglas. Ejemplo textual que diste: `USU-001-NUMERO DE IDENTIFICACION`. Con esa contraseña generada, el estudiante puede loguearse — es decir, **el estudiante no elige su propia contraseña ni se autorregistra**, la recibe ya asignada.

### Implicación para el modelo de datos

Esto amplía bastante la entidad **Usuario** del documento 01, que hasta ahora era genérica. Ahora sabemos que necesita, como mínimo: nombre, correo, número de identificación, contraseña (generada), y rol (Admin / Docente / Estudiante). También confirma un **proceso de importación masiva** (leer Excel → crear usuarios → generar credenciales) como funcionalidad real del sistema, no solo un alta manual uno por uno.

⚠️ Una observación técnica honesta, no una objeción al requisito: usar el número de identificación como parte de la contraseña generada es un patrón común en proyectos académicos, pero vale la pena que ustedes le pregunten al cliente si esa contraseña se debe cambiar obligatoriamente en el primer login — porque el número de identificación de una persona no es información realmente secreta (puede ser bastante adivinable). No estoy inventando un requisito nuevo, solo señalo algo que probablemente valga la pena preguntar.

### ❓ Por confirmar
- ¿Admin y Docente son el mismo rol técnico (una sola tabla/permiso) o dos roles separados con permisos parecidos pero no idénticos?
- ¿Qué información exacta trae el Excel además de correo y nombre?
- ¿La contraseña generada se puede/debe cambiar después del primer ingreso?

---

## Parte 2 — La imagen: formato de entregable de referencia (NO contenido de nuestro sistema)

Lo que enviaste es un **"Diagrama de Carriles (Swimlane Diagram)"** de un proyecto distinto — un software de psicología (roles: Paciente, Sistema, Psicólogo; fases: Agenda y Registro, Evaluación Previa, Consulta y Diagnóstico, Seguimiento Diario). Como dijiste, esto es algo que **también tienen que entregar ustedes** para el simulador gerencial — pero la plantilla, no el contenido.

📚 REFERENCIA DE FORMATO, NO DE CONTENIDO — dejo esto explícito porque es justo el tipo de mezcla que tu profesor advirtió que no hiciéramos: **nada de "Paciente", "Psicólogo", "PHQ-9/GAD-7" o esas fases aplica a nuestro proyecto.** Lo único que tomo de aquí es la **estructura del entregable**:

- Una tabla con **Rol/Actor en filas** (en el ejemplo: Paciente, Sistema, Psicólogo) y **fases del proceso en columnas** (en el ejemplo: 4 fases), donde cada celda describe las acciones de ese rol en esa fase.
- Debajo, una sección de **"Reglas de Negocio Clave e Interacción entre Roles"**, con reglas nombradas y explicadas — por ejemplo, en el documento de referencia aparecen reglas como "Aislamiento de Recomendaciones", "Dependencia de Fase", "Flujo de Alerta Temprana", "Sincronización Atómica de Agenda" — cada una describiendo una dependencia o restricción entre lo que hace un rol y lo que puede/no puede hacer otro.

**Por qué esto nos sirve ahora:** nos anticipa el formato exacto que probablemente nos van a pedir cuando lleguemos al paso de "Reglas de Negocio" (tarea #5 de nuestra lista) — y ya con lo que sacamos de la transcripción (categorías de decisión, catálogo de decisiones vs. decisión tomada, participación de mercado redistribuida, etc.) tenemos material real para empezar a armar nuestra propia versión de esta tabla, con nuestros roles (Estudiante/Participante, Docente, Admin, Sistema) y nuestras fases (que probablemente sean algo como: Registro/Login → Configuración del período → Toma de decisiones → Procesamiento → Resultados).

### ❓ Por confirmar
¿Este diagrama de carriles es un entregable explícitamente pedido para tu proyecto (con fecha/formato definido por el profesor), o es solo un ejemplo que te mostraron para que entiendas la idea? Si es entregable formal, dime qué se espera exactamente (¿mismas 4 fases tipo, o las fases las definimos nosotros según nuestro propio proceso?).

---

## Seguimos pendientes de (sin cambios):
1. Resto de la transcripción (se corta como a la mitad).
2. El documento del "caso" de negocio que mencionan en la reunión.
3. El documento que el cliente generó con IA.
