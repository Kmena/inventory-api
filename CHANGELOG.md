# Changelog

Todos los cambios relevantes de este proyecto se documentan en este archivo.

El formato se inspira en Keep a Changelog y el versionado sigue Semantic Versioning.

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
