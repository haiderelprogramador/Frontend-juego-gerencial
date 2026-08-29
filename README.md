# Frontend — Juego Gerencial

Frontend en Angular del proyecto académico **Simulador de Juego Gerencial**: un sistema donde los participantes gestionan una empresa simulada, toman decisiones por período y el sistema procesa los resultados de su gestión.

> ⚠️ Estado actual: proyecto en fase de **análisis de dominio y requisitos**. Todavía no hay funcionalidades definitivas — ver [`docs/`](./docs) para el detalle y las cosas marcadas como pendientes de confirmar.

## Stack

- **Frontend** (este repo): Angular 21, TypeScript, SCSS.
- **Backend**: Spring Boot (Java) — repositorio separado. ❓ *Falta confirmar el nombre/URL del repo de backend; si aún no existe, deberíamos crearlo con el mismo criterio que este.*
- **Base de datos**: por definir — depende del modelo de datos que estamos construyendo en [`docs/01-analisis-dominio.md`](./docs/01-analisis-dominio.md).

## Estructura del repositorio

```
.
├── docs/            # Análisis del proyecto: dominio, requisitos, modelo de datos (se va ampliando por pasos)
├── src/             # Código fuente de la aplicación Angular
├── public/          # Assets estáticos
├── angular.json
├── package.json
└── README.md
```

## Cómo correr el proyecto

Requisitos: Node.js 22.22.3+ (o 24.15+) y npm.

```bash
npm install
npm start        # levanta el servidor de desarrollo
npm run build     # build de producción
```

## Documentación del proyecto

Toda la documentación de análisis (dominio, actores, procesos, entidades candidatas, modelo de datos, etc.) vive en [`docs/`](./docs), numerada en el orden en que se va construyendo. Es un documento vivo — se actualiza a medida que se confirman los requisitos oficiales con el cliente.

## Flujo de trabajo sugerido

- `main` se mantiene siempre desplegable/estable.
- El trabajo nuevo va en ramas del tipo `feature/nombre-corto` o `docs/nombre-corto`, con Pull Request hacia `main` antes de fusionar.
- Evitar hacer commit de `node_modules/`, `dist/` o archivos de build (ya cubierto por `.gitignore`).
