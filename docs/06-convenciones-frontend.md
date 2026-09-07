# Convenciones de estructura — Frontend Angular (paso 6)

Esto no es análisis de dominio, es una **convención de organización de código** para que el proyecto no se desordene a medida que varias personas (o varias sesiones de Claude) le vayan agregando pantallas. Todo lo que se construya de aquí en adelante en el frontend debería seguir esta estructura.

## Estructura de carpetas

```
src/app/
├── core/                     Cosas únicas/globales de la app: guards, interceptores, el servicio de autenticación
│   ├── guards/
│   │   ├── auth.guard.ts         → bloquea rutas si no hay sesión iniciada
│   │   └── role.guard.ts         → bloquea rutas según el rol (ej. solo Docente)
│   ├── interceptors/
│   │   └── auth.interceptor.ts   → adjunta el token a las peticiones (cuando exista backend real)
│   ├── services/
│   │   └── auth.service.ts       → login, registro de docente, sesión actual, logout
│   └── models/
│       ├── usuario.model.ts
│       └── rol.enum.ts
│
├── shared/                   Piezas reutilizables sin lógica de negocio propia (botones, tablas, spinners, etc.)
│   ├── components/
│   ├── pipes/
│   └── directives/
│
├── layout/                   Estructura visual de la app (navbar, sidebar, layout con sesión vs. sin sesión)
│   ├── main-layout/
│   └── auth-layout/
│
├── features/                 Una carpeta por área funcional del negocio — aquí vive casi todo
│   ├── auth/
│   │   ├── login/
│   │   ├── registro-docente/
│   │   └── auth.routes.ts
│   ├── docente/
│   │   ├── gestion-estudiantes/      (carga masiva por Excel)
│   │   │   ├── services/
│   │   │   └── models/
│   │   └── docente.routes.ts
│   ├── estudiante/            (a futuro: pantalla de toma de decisiones)
│   └── simulacion/            (a futuro: períodos, resultados, catálogo de decisiones)
│
├── app.routes.ts              Composición de rutas de alto nivel (carga perezosa de cada feature)
├── app.config.ts
└── app.ts / app.html / app.scss
```

## Reglas de la convención

1. **Un componente = una carpeta**, con su `.ts`, `.html`, `.scss` y `.spec.ts` juntos. Nombre de carpeta y de archivos en kebab-case (`registro-docente`, no `RegistroDocente`).
2. **`core/` es singleton**: solo cosas que existen una sola vez en toda la app (sesión, guards, interceptores). Si algo se puede repetir o instanciar más de una vez, no va aquí.
3. **`shared/` no sabe nada del negocio**: un componente ahí no debería importar nada de `features/`. Si un componente necesita saber qué es un "Estudiante" o una "Decisión", no es shared, es de una feature.
4. **`features/` se organiza por área del negocio, no por tipo de archivo.** Nunca una carpeta `components/` o `services/` a nivel raíz con todo mezclado — cada feature tiene sus propios componentes, servicios y modelos adentro.
5. **Cada feature expone sus rutas en su propio archivo `*.routes.ts`**, y `app.routes.ts` solo las importa con carga perezosa (`loadChildren` / `loadComponent`). Así ninguna feature se carga si el usuario no la visita.
6. **Servicios que llaman al backend van con `providedIn: 'root'`** salvo que exista una razón real para que sean de una sola feature.
7. **Formularios con validación (login, registro) usan Reactive Forms**, no template-driven — es más fácil de testear y de mantener cuando crezcan.
8. Mientras el backend de Spring Boot no exista, los servicios se escriben **contra el contrato de API real** (mismas rutas y forma de los datos que se espera tener después), pero con una implementación mock por dentro, dejada explícita con un comentario, para no tener que reescribir el servicio completo cuando el backend esté listo — solo cambiar la implementación interna.

## Por qué esto importa para el proyecto académico

Cuando lleguen a la sustentación, una estructura así deja ver de un vistazo qué hace cada parte del sistema y por qué existe — que es exactamente el mismo principio de trazabilidad que hemos venido usando en el análisis (`docs/01` a `docs/05`): cada carpeta debe poder justificar su existencia igual que cada entidad del modelo de datos.
