# inventory-api

Backend inicial de `inventory-api` para arrancar la modernización de `Track_sys` con una arquitectura más mantenible usando:

- Node.js
- Express
- Prisma
- PostgreSQL
- Docker

## Estructura

- `src/` -> aplicación HTTP
- `prisma/` -> esquema, migraciones y seed
- `docs/` -> documentación local de apoyo; en Git solo se versiona `docs/README.md` si existe
- `Dockerfile` -> imagen base
- `docker-compose.yml` -> app + postgres

## Arranque local

1. Copiar `.env.example` a `.env`
2. Ejecutar `npm install`
3. Ejecutar `npx prisma generate`
4. Ejecutar `npx prisma migrate dev --name init`
5. Ejecutar `npm run prisma:seed`
6. Ejecutar `npm run dev`

### Nota para Windows

Si PowerShell bloquea `npm` o `npx` por políticas de ejecución, use:

```powershell
npm.cmd install
npx.cmd prisma generate
npx.cmd prisma migrate dev --name init
```

## Arranque con Docker

Si ya creó la migración inicial con Prisma desde su máquina local, puede levantar el proyecto con:

```bash
docker compose up --build
```

Nota: en esta plantilla de desarrollo el contenedor de la app no ejecuta migraciones automáticamente al arrancar. Primero cree/aplique migraciones con Prisma y luego levante Docker.

Si cambia la imagen base, Prisma o dependencias del contenedor, use reconstrucción completa:

```bash
docker compose down
docker compose build --no-cache
docker compose up
```

### Flujo recomendado de primera ejecución

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
docker compose up --build
```

En otra terminal:

```bash
docker compose exec app npm run prisma:seed
```

## Endpoints

### Públicos
- `GET /health`
- `POST /api/auth/login`

### Protegidos con JWT
- `GET /api/auth/me`
- `GET /api/companies`
- `POST /api/companies`
- `GET /api/users`
- `POST /api/users`
- `GET /api/clients`
- `GET /api/clients/:id`
- `POST /api/clients`
- `PUT /api/clients/:id`
- `DELETE /api/clients/:id`
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`
- `GET /api/orders`
- `GET /api/orders/:id`
- `POST /api/orders`
- `PUT /api/orders/:id`
- `POST /api/orders/:id/approve`
- `POST /api/orders/:id/cancel`
- `POST /api/orders/:id/dispatch`
- `DELETE /api/orders/:id`
- `GET /api/invoices`
- `GET /api/invoices/:id`
- `POST /api/invoices`
- `PUT /api/invoices/:id`
- `DELETE /api/invoices/:id`
- `GET /api/payments`
- `GET /api/payments/:id`
- `POST /api/payments`
- `PUT /api/payments/:id`
- `DELETE /api/payments/:id`
- `GET /api/inventory/movements`
- `POST /api/inventory/entries`
- `POST /api/inventory/adjustments`

## Base montada desde cero

Esta plantilla ya deja definida una estructura inicial de negocio para:

- empresas
- usuarios y roles
- regiones
- clientes y contactos
- inventario y categorías
- productos, proveedores y lotes
- recetas
- pedidos y detalle
- facturas y pagos
- producción
- movimientos de stock

## Documentación útil

- `prisma/migration-instructions.md`
- `docs/README.md` si existe como índice público/versionado

### Nota sobre `docs/`

Los archivos Markdown dentro de `docs/` se consideran documentación operativa/local y no se versionan en Git, excepto `README.md` dentro de esa carpeta si llegara a usarse como índice visible del directorio.

## Credenciales demo iniciales

- admin -> `admin` / `admin123`
- ventas -> `ventas` / `ventas123`
- bodega -> `bodega` / `bodega123`

Use esas credenciales para hacer login y probar permisos por rol con JWT.

## Nota

Esta plantilla no intenta portar todo `Track_sys` al 100% de una sola vez. Lo que sí hace es dejar una base sana, relacional y ampliable para arrancar sin repetir el caos original con esteroides.
