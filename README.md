# inventory-api

Base inicial para modernizar `Track_sys-master` con una ruta más mantenible y menos cursed.

## Enfoque

Este proyecto está orientado a:

- migración progresiva de MongoDB a PostgreSQL
- preparación para Docker y desarrollo local reproducible
- endurecimiento básico de seguridad
- separación por capas para evitar el acoplamiento del sistema viejo
- documentación de la transición y del modelo propuesto

## Estructura

- `README.md` -> visión general del proyecto
- `CHANGELOG.md` -> historial de versiones
- `docs/` -> documentación local de trabajo; en Git solo se versiona `docs/README.md` si existe
- `sql/schema_inicial_postgresql.sql` -> esquema relacional inicial sugerido
- `docker/docker-compose.dev.yml` -> ejemplo de compose para desarrollo
- `docker/Dockerfile.example` -> ejemplo base de Dockerfile
- `inventory-api/` -> backend funcional inicial con Node + Express + Prisma + PostgreSQL + Docker

## Nota sobre documentación local

Los archivos Markdown dentro de carpetas `docs/` se usan como documentación operativa local y están ignorados por Git, excepto `README.md` dentro de `docs/` si llegara a existir.

La carpeta `plan/` también está tratada como material local no publicado si está ignorada en el repositorio actual.

## Estado actual

La carpeta `inventory-api/` ya contiene una base funcional para arrancar la modernización con buenas prácticas mínimas:

- configuración con variables de entorno
- Prisma como capa de acceso a datos
- PostgreSQL como base relacional
- Dockerfile y docker-compose funcionales
- validación con Zod
- autenticación con JWT y bcrypt
- separación por `routes`, `services`, `repositories`, `schemas`, `middlewares` y `lib`
- migración inicial de Prisma versionada
- seed de datos demo para pruebas locales
- lógica inicial de inventario y flujo de pedidos

### Endpoints base del template

- `GET /health`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/companies`
- `POST /api/companies`
- `GET /api/users`
- `POST /api/users`

## Arranque rápido del backend

Desde `inventory-api/`:

1. Copiar `.env.example` a `.env`
2. Ejecutar `npm install`
3. Ejecutar `npx prisma generate`
4. Ejecutar `npx prisma migrate dev --name init`
5. Ejecutar `docker compose up --build`
6. En otra terminal, ejecutar `docker compose exec app npm run prisma:seed`

En Windows PowerShell puede usar `npm.cmd` y `npx.cmd` si la política de ejecución bloquea los wrappers de PowerShell.

## Objetivo

No es una copia del proyecto original. Es una carpeta de trabajo con recomendaciones concretas y una base funcional para ejecutar una transición ordenada.
