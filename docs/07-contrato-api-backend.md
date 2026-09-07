# Contrato de API para el backend — Autenticación y carga de estudiantes (paso 7)

**Fuente:** este documento describe lo que el **frontend ya construido espera** del backend Spring Boot (rutas, cuerpos JSON, códigos de estado). Sale de `src/app/core/api/api.config.ts` y de los modelos en `src/app/core/models/` y `src/app/features/docente/gestion-estudiantes/models/`. Mientras el backend no exista, el frontend responde con datos simulados (`API_CONFIG.demoMode = true`); al poner ese flag en `false` empieza a llamar a estas rutas reales.

Las etiquetas son las mismas de los documentos anteriores: ✅ requisito oficial (cliente), 🔎 inferencia de diseño, ⚠️ observación técnica, ❓ por confirmar.

---

## 1. Alcance de esta entrega

Solo cubre lo que ya tiene pantalla en el frontend:

1. **Login** único para docente y estudiante. ✅
2. **Registro de docente** (el estudiante no se autorregistra). ✅
3. **Carga masiva de estudiantes** desde Excel, hecha por el docente. ✅

El Excel se lee **en el navegador** (librería `xlsx`/SheetJS). El backend **no recibe el archivo**: recibe un JSON con las filas ya extraídas y validadas. 🔎 (Ver §6 si se quiere que el backend también acepte el archivo).

Todo lo demás del simulador (escenarios, catálogo de decisiones, períodos, resultados) queda fuera de este contrato.

---

## 2. Convenciones generales

| Tema | Definición |
|---|---|
| Prefijo base | `/api` (configurable; en el front es `API_CONFIG.baseUrl`) |
| Formato | JSON en request y response; `Content-Type: application/json` |
| Autenticación | JWT en header `Authorization: Bearer <token>` |
| Rehidratación de sesión | El front guarda el token y el usuario; al recargar puede revalidar con `GET /api/auth/sesion` |
| Zona horaria / fechas | ISO 8601 en UTC (ej. `2026-08-31T20:45:18.265Z`) |
| CORS (desarrollo) | Permitir origen `http://localhost:4200`, métodos `GET,POST,OPTIONS`, header `Authorization` |

### Formato de error esperado

Ante un error, devolver el **código HTTP correcto** y un cuerpo JSON:

```json
{ "message": "Texto para mostrar al usuario", "codigo": "CREDENCIALES_INVALIDAS" }
```

`message` es lo que el frontend muestra en pantalla. `codigo` es opcional (para i18n / lógica futura).

⚠️ **Pendiente en el frontend:** hoy el manejo de errores lee `err.message`; cuando se conecte `HttpClient` real habrá que leer `err.error?.message`. Es un ajuste de una línea por pantalla (`login.ts`, `registro-docente.ts`, `gestion-estudiantes.ts`), anotado aquí para no olvidarlo.

---

## 3. Modelos (DTOs)

### `Usuario`
```ts
{
  id: string;                    // identificador estable (UUID o Long serializado como string)
  nombre: string;
  correo: string;                // único en todo el sistema
  numeroIdentificacion: string;  // se maneja como TEXTO (puede tener ceros a la izquierda)
  rol: "DOCENTE" | "ESTUDIANTE"; // enum; ver ❓ Admin en §7
}
```
La contraseña (ni hash ni texto) **nunca** se devuelve al frontend.

### `AuthResponse`
```ts
{
  token: string;    // JWT firmado
  usuario: Usuario;
}
```

---

## 4. Endpoints de autenticación

### 4.1 `POST /api/auth/login`

Mismo endpoint para docente y estudiante. El backend decide el rol según las credenciales.

**Request**
```json
{ "correo": "docente@demo.com", "contrasena": "demo1234" }
```

**Response 200** → `AuthResponse`
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "usuario": {
    "id": "a3f1...",
    "nombre": "Docente Demo",
    "correo": "docente@demo.com",
    "numeroIdentificacion": "00000000",
    "rol": "DOCENTE"
  }
}
```

**Errores**
| Código | Cuándo |
|---|---|
| 400 | Falta `correo` o `contrasena`, o `correo` con formato inválido |
| 401 | Credenciales incorrectas (mismo mensaje para "no existe" y "clave mala") |

Validación que ya hace el frontend (el backend debe volver a validar): `correo` con formato de email, `contrasena` no vacía.

---

### 4.2 `POST /api/auth/registro-docente`

Solo crea usuarios con rol `DOCENTE`. ✅

**Request** → `RegistroDocenteRequest`
```json
{
  "nombre": "Ana Docente",
  "correo": "ana@universidad.edu",
  "numeroIdentificacion": "1094567890",
  "contrasena": "claveSegura1"
}
```

**Response 201** → `AuthResponse` (queda logueado tras registrarse).

**Errores**
| Código | Cuándo |
|---|---|
| 400 | Validación fallida (ver reglas abajo) |
| 409 | Ya existe un usuario con ese `correo` |

Reglas de validación que aplica el frontend hoy (el backend debe reforzarlas con Bean Validation):
- `nombre`: obligatorio, mínimo 3 caracteres.
- `correo`: formato email, único.
- `numeroIdentificacion`: `^[0-9]{5,15}$` (solo dígitos, 5 a 15). ❓ Confirmar rango real con el cliente.
- `contrasena`: mínimo 8 caracteres. ❓ Confirmar política de contraseñas del cliente.

---

### 4.3 `GET /api/auth/sesion`

Devuelve el usuario del token actual. El frontend lo usaría para revalidar la sesión al recargar la página.

**Headers:** `Authorization: Bearer <token>`

**Response 200**
```json
{ "usuario": { "id": "...", "nombre": "...", "correo": "...", "numeroIdentificacion": "...", "rol": "DOCENTE" } }
```

**Errores:** 401 si el token falta, expiró o es inválido.

---

## 5. Endpoints de gestión de estudiantes (rol DOCENTE)

Todos requieren `Authorization: Bearer <token>` y que el token sea de un `DOCENTE` (si no → 403).

### 5.1 `POST /api/docente/estudiantes/carga-masiva`

Crea varios estudiantes de una vez a partir de las filas extraídas del Excel.

**Request** → `CargaMasivaRequest`
```json
{
  "estudiantes": [
    {
      "nombre": "Juan Pérez",
      "correo": "juan.perez@uni.edu",
      "numeroIdentificacion": "1094567890",
      "columnasAdicionales": { "Programa": "Administración", "Grupo": "A" }
    },
    {
      "nombre": "María Gómez",
      "correo": "maria.gomez@uni.edu",
      "numeroIdentificacion": "1032654987",
      "columnasAdicionales": { "Programa": "Administración", "Grupo": "B" }
    }
  ]
}
```

- ✅ **Decidido:** el frontend envía **solo los datos del Excel**. El `consecutivo` y la `contrasenaGenerada` los asigna el **backend** (regla del patrón en §6). El frontend no los calcula ni los manda — así nadie puede inyectar una contraseña arbitraria.
- `columnasAdicionales`: mapa `texto → texto` con las columnas del Excel que no son correo/nombre/identificación. ❓ No se sabe todavía cuáles son ni si deben tener columna propia en la BD.

**Response 200** → `CargaMasivaResponse`
```json
{
  "creados": [
    {
      "id": "e91c...",
      "nombre": "Juan Pérez",
      "correo": "juan.perez@uni.edu",
      "numeroIdentificacion": "1094567890",
      "contrasenaGenerada": "USU-001-1094567890",
      "cargadoEn": "2026-08-31T20:45:18.265Z"
    }
  ],
  "errores": [
    { "correo": "maria.gomez@uni.edu", "motivo": "Ya existe un estudiante con ese correo." }
  ]
}
```

- Carga **parcial permitida**: se crean los que se puedan; los que fallen van en `errores` (no se aborta todo el lote). 🔎
- `contrasenaGenerada` se devuelve en claro **una sola vez**, aquí, para que el docente pueda entregársela a cada estudiante. Después ya no se puede volver a consultar (solo queda el hash). 🔎

**Errores**
| Código | Cuándo |
|---|---|
| 400 | Lista vacía o filas sin los campos mínimos |
| 401 / 403 | Sin token / token que no es de docente |

### 5.2 `GET /api/docente/estudiantes`

Lista los estudiantes cargados (para mostrarlos y para saber por dónde va el consecutivo).

**Response 200** → `EstudianteCargado[]` (mismo objeto que `creados` de §5.1).

❓ Confirmar si esta lista es "los estudiantes de este docente", "los de un curso" o "todos". Depende de la respuesta a §7.3.

---

## 6. Regla de la contraseña generada

✅ Patrón confirmado por el cliente (docs/03), ejemplo textual: `USU-001-NUMERO DE IDENTIFICACION`.

✅ **La genera el BACKEND**, no el frontend. El frontend solo la recibe en la
respuesta y la muestra al docente. Mientras no haya Spring Boot, el servicio
mock (`estudiante.service.ts` en modo demo) la simula con el helper
`generar-contrasena.ts` — ese helper **desaparece del flujo real**.

```
USU-<consecutivo>-<numeroIdentificacion>
     |            |
     |            └── número de identificación tal cual, sin espacios
     └── consecutivo con ceros a la izquierda, 3 dígitos: 001, 002, ... 042 ... 500
```

Ejemplo: consecutivo 1 + identificación `1094567890` → **`USU-001-1094567890`**.

Supuestos que tomó el **mock** y **hay que confirmar** con el cliente (§7):
- El consecutivo **continúa** desde la cantidad de estudiantes ya cargados.
- 3 dígitos de consecutivo.
- El número de identificación va sin espacios ni guiones.

Si el backend parsea Excel también (opción B): usar **Apache POI**; el flujo cambiaría a `POST multipart/form-data` con el archivo, y el backend haría la extracción + validación + generación. La opción A (la actual, el navegador lee el Excel y manda JSON de filas) ya está lista en el frontend.

---

## 7. Preguntas abiertas antes de cerrar el modelo de datos

Estas son las mismas `// TODO: confirmar con el cliente` que quedaron en el código:

1. **¿`Admin` es un rol técnico aparte de `Docente`?** (docs/03: el cliente los llama "casi lo mismo"). Hoy el enum solo tiene `DOCENTE` y `ESTUDIANTE`. Si Admin existe, definir sus permisos extra.
2. **¿Qué columnas exactas trae el Excel de estudiantes** además de correo, nombre e identificación? (¿programa, grupo, equipo, curso?). Mientras no se sepa, van a `columnasAdicionales` (bolsa genérica).
3. **Alcance del consecutivo de la contraseña:** ¿es global de todo el sistema, o reinicia por curso / por docente / por archivo cargado? De esto depende si hace falta una entidad "Curso" o "Lote de carga".
4. **¿La contraseña generada se debe cambiar obligatoriamente en el primer ingreso?** (⚠️ el número de identificación no es secreto). Si sí → agregar `debeCambiarContrasena: boolean` al `Usuario` y un endpoint `POST /api/auth/cambiar-contrasena`.
5. ~~¿La generación de contraseña es responsabilidad del backend?~~ ✅ **Resuelto: sí, la genera el backend.** El frontend no la calcula ni la envía.
6. **Política del token:** tiempo de expiración, si hay refresh token, claims que debe llevar (mínimo: `sub` = id de usuario, `rol`, `exp`).
7. **A dónde entra el estudiante después del login:** todavía no existe el panel del estudiante; hoy el front lo deja en login con un aviso.
8. **Excel con varias hojas:** hoy el frontend toma la primera hoja. ❓ Confirmar si el archivo de estudiantes puede traer más de una.

---

## 8. Entidades mínimas sugeridas (borrador, a ajustar con §7)

| Entidad | Atributos mínimos |
|---|---|
| `Usuario` | `id` (PK), `nombre`, `correo` (único), `numeroIdentificacion`, `hashContrasena`, `rol`, `fechaCreacion`, `debeCambiarContrasena?` (❓ #4) |
| `Estudiante` *(o atributos en `Usuario`)* | además: `consecutivo`, `cargadoEn`, `datosAdicionales` (JSON o tabla clave-valor, ❓ #2), `cargadoPor` → FK a `Usuario` docente (❓ #3) |
| `LoteCarga` *(opcional, ❓ #3)* | `id`, `docenteId`, `fecha`, `totalCreados`, `totalErrores` — solo si el consecutivo se numera por carga o si se quiere trazabilidad de quién cargó qué |

El registro de docente y la carga de estudiantes escriben en la misma tabla `Usuario`, cambiando `rol`.

---

## 9. Stack sugerido (recomendación técnica, no requisito del cliente)

- Spring Boot 3.x, Java 17+.
- `spring-boot-starter-web`, `spring-boot-starter-validation` (Bean Validation para replicar las reglas de §4).
- `spring-boot-starter-security` + JWT (`spring-security-oauth2-resource-server` con `jwt`, o `io.jsonwebtoken:jjwt`).
- `spring-boot-starter-data-jpa` + PostgreSQL (H2 para pruebas locales).
- Migraciones con Flyway o Liquibase.
- Apache POI **solo** si se elige la opción B de §6 (backend recibe el archivo).
- Configuración CORS para `http://localhost:4200` en desarrollo.

---

## 10. Cómo conectar el frontend cuando el backend esté arriba

1. En `src/app/core/api/api.config.ts`: `demoMode: false` y `baseUrl` apuntando al backend (idealmente moverlo a `src/environments/`).
2. Ajustar la lectura de errores a `err.error?.message` en `login.ts`, `registro-docente.ts` y `gestion-estudiantes.ts` (ver ⚠️ en §2).
3. Verificar CORS y que el token se esté adjuntando (ya lo hace `core/interceptors/auth.interceptor.ts`).
4. El resto de los servicios (`AuthService`, `EstudianteService`) **no cambia**: cada método ya tiene la rama `if (!API_CONFIG.demoMode) { http... }` escrita contra estas rutas.
