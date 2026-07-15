# Changelog

Todos los cambios relevantes de este proyecto se documentan en este archivo.

El formato se inspira en Keep a Changelog y el versionado sigue Semantic Versioning.

## [0.2.0] - 2026-06-09

### Added
- dashboard root para crear, listar, activar y deshabilitar empresas
- dashboard ejecutivo para administradores de empresa
- sidebar de administracion para dashboard ejecutivo, usuarios y roles
- pagina de usuarios de empresa para que el admin cree usuarios dentro de su propia empresa
- pagina de roles y permisos para crear variaciones de roles por empresa
- soporte Prisma para roles asociados a empresa mediante `Role.companyId`
- endpoints `GET /api/roles/permissions`, `GET /api/roles/company` y `POST /api/roles/company`
- endpoints `GET /api/users/company` y `POST /api/users/company`
- middleware `authorizePermission` para proteger acciones por permiso
- permisos finos `warehouse.access`, `products.view`, `products.import`, `products.manage`, `inventory.view` e `inventory.manage`
- migracion para hacer la configuracion fiscal de empresa uno-a-uno

### Changed
- el usuario `root` principal queda sin empresa y administra empresas
- los usuarios admin de empresa entran al dashboard ejecutivo
- la creacion de empresas ahora crea un administrador de empresa
- la creacion de usuarios de empresa asigna roles base o roles personalizados
- el login puede redirigir a bodega por permiso `warehouse.access`
- el dashboard de bodega oculta importacion si el usuario no tiene permiso de importacion o gestion de productos
- productos e inventario empezaron a validar permisos finos en lugar de depender solo del codigo de rol

### Notes
- las migraciones se aplicaron localmente usando la base Docker publicada en `localhost:5432`
- se regenero Prisma Client despues de agregar `Role.companyId`

## [0.1.1] - 2026-05-26

### Added
- frontend demo mínimo servido desde `inventory-api/src/public`
- pantalla de login sencilla para redirección al flujo de bodega
- página de bodega para listar productos existentes
- importación de productos desde Excel en la interfaz de bodega
- preview de filas importables con selección manual por producto
- endpoint `POST /api/products/import` para creación y actualización masiva de productos

### Changed
- la carga masiva de productos ahora puede trabajar por `id` único y pedir confirmación antes de actualizar existentes
- la importación desde frontend ahora se envía en chunks para evitar requests demasiado grandes y dejar mejor control a futuro
- se actualizó la memoria operativa de la sesión con el nuevo flujo de frontend e importación
- se ajustó el nombre visible del servidor a `Inventory API`

### Notes
- el seed sigue siendo útil para credenciales y datos demo, pero el flujo objetivo de productos ya empezó a migrar hacia carga por Excel desde bodega
- `docker compose down` conserva la base de datos mientras no se use `-v`

## [0.1.0] - 2026-05-26

### Added
- estructura base del proyecto `inventory-api` para la modernización de `Track_sys`
- documentación ejecutiva y memoria de trabajo en `docs/`
- plan de migración por fases en `plan/`
- esquema SQL inicial sugerido en `sql/`
- ejemplos de Docker para desarrollo en `docker/`
- backend funcional inicial en `inventory-api/` con Node.js, Express, Prisma y PostgreSQL
- arquitectura por capas con `routes`, `services`, `repositories`, `schemas`, `middlewares` y `lib`
- autenticación base con JWT y hash de contraseñas con bcrypt
- validación de payloads con Zod
- CRUD base para empresas, usuarios, clientes, productos, pedidos, facturas y pagos
- lógica inicial de inventario para entradas, ajustes, reservas, liberación y despacho
- endpoints de inventario y flujo de pedidos
- migración inicial de Prisma versionada
- seed con datos demo para pruebas locales
- soporte Docker funcional para desarrollo en localhost

### Changed
- ajuste de compatibilidad Docker/Prisma para entorno local de desarrollo en Windows
- configuración de arranque del contenedor enfocada en desarrollo, evitando migraciones automáticas al inicio

### Notes
- esta versión representa una base inicial funcional para la transición del sistema viejo hacia una arquitectura más mantenible
- todavía no incluye pruebas automatizadas completas, frontend de prueba ni lógica avanzada de producción/FIFO/FEFO
