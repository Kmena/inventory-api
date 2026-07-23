# Changelog

- se completaron `TASK-001`, `TASK-002`, `TASK-003`, `TASK-004`, `TASK-005`, `TASK-006`, `TASK-007` y `TASK-008` de `specs/p7-9-5-risk-closure` con inventario y estrategia de remediación de `RawUnsafe`, eliminación del patrón libre en runtime (`throttle-store` e inventory advisory lock), caracterización automatizada de fallos parciales en documentos privados y comprobantes, instrumentación/baseline gobernada para endpoints pesados priorizados, formalización contractual exhaustiva entre rutas montadas y OpenAPI parcial, y consolidación final de evidencia P7 audit-ready en README y documentación dedicada.

- se explicitó la canonicidad documental de P6 apuntando `inventory-api/docs/architecture.md` al paquete raíz `specs/p6-audit-excellence-program`, se alineó el baseline HTML del audit y se documentó formalmente que `TASK-006` de P6 no puede cerrarse porque la evidencia actual sostiene `9.2/10`, no `9.5/10`.

- se alineó `inventory-api/tests/p2-hardening-constraints.test.js` con el lifecycle vigente de pagos (`ACTIVE -> APPROVED`), preservando el runtime actual y registrando la trazabilidad canónica en `specs/p2-payment-lifecycle-test-alignment/`.

- se completó `TASK-001` de `specs/p5-audit-score-hardening` consolidando el paquete canónico P5, registrando baseline pre-implementación y actualizando la trazabilidad documental del programa.
- se completó `TASK-002` de `specs/p5-audit-score-hardening` construyendo la matriz por rubro del audit con score objetivo, deuda principal, tareas planificadas y evidencia requerida para la re-auditoría.
- se completó `TASK-003` de `specs/p5-audit-score-hardening` documentando y validando el hardening transversal ya presente de throttling compartido, gobernanza sensible de uploads, dinero decimal seguro y políticas centralizadas, además de alinear `payment.schema.js` con la gobernanza compartida.
- se completó `TASK-004` de `specs/p5-audit-score-hardening` descomponiendo servicios críticos de pagos, pedidos e inventario en módulos auxiliares probados para reducir mezcla de responsabilidades y mejorar mantenibilidad.
- se completó `TASK-005` de `specs/p5-audit-score-hardening` agregando smoke runtime HTTP para `src/public`, gobernanza local de workflows y un workflow operativo versionado `operational-smoke.yml` sin deploy.
- se completó `TASK-006` de `specs/p5-audit-score-hardening` generando la re-auditoría paralela `inventory-api/docs/audit/p5-final-reaudit.md` con breakdown >= 8.5 por rubro y evidencia trazable de cierre.
- se corrigió el workflow `inventory-api/.github/workflows/operational-smoke.yml` para materializar un `.env.production` temporal antes del smoke de `docker compose`, evitando el fallo por `env_file` ausente en CI.

- se completó `TASK-001` de `specs/p6-audit-excellence-program` consolidando el paquete canónico P6, verificando su aprobación y registrando el baseline pre-implementación hacia la meta 9.5.
- se completó `TASK-002` de `specs/p6-audit-excellence-program` construyendo la matriz por rubro hacia 9.5 con fortalezas consolidadas, brechas residuales, evidencia requerida y condición de cierre.
- se completó `TASK-003` de `specs/p6-audit-excellence-program` con throttling distribuido respaldado por Prisma, convergencia adicional de autorización sobre superficies administrativas/operativas críticas e inventario explícito de compatibilidad legacy.
- se completó `TASK-004` de `specs/p6-audit-excellence-program` con una suite browser/E2E real basada en Playwright para login, navegación protegida, dashboard ejecutivo y runtime warehouse con logout por 401, integrada al workflow `quality-gates`.
- se completó `TASK-005` de `specs/p6-audit-excellence-program` ampliando OpenAPI factual sobre superficies críticas adicionales, formalizando metadatos de compatibilidad legacy y agregando un runbook operativo versionado con validación automatizada de readiness operativa y restore documentado.

Todos los cambios relevantes de este proyecto se documentan en este archivo.

El formato se inspira en Keep a Changelog y el versionado sigue Semantic Versioning.

## [Unreleased]

### Changed
- se validaron y cerraron `TASK-001` y `TASK-002` de `inventory-api/specs/p4-closeout-hardening`, dejando trazabilidad del paquete canónico y corrigiendo los punteros documentales activos/derivados hacia `specs/p4-closeout-hardening`
- se realinearon los punteros documentales residuales hacia `specs/p4-audit-hardening`, incluyendo `inventory-api/docs/architecture.md`, `inventory-api/docs/runtime-scope-baseline.md` y el baseline auditado actual
- se endureció el acceso legacy de `GET /api/companies` y `POST /api/companies` para que queden restringidos a `root`, con validación adicional de root global en `company.service`
- se documentó una matriz operativa explícita de root global vs admin de empresa y se aclaró la semántica real del path legacy `GET /api/companies/root/dashboard`
- se actualizó `inventory-api/docs/audit/current-code-audit.md` para reflejar el hardening ya aplicado en companies y preservar las notas de compatibilidad administrativa
- se caracterizó el drift actual entre `payments` e `invoices`, incluyendo la ausencia de sincronización persistida de `invoice.status` y `invoice.paidAt`, y se documentó su diferimiento explícito
- se congeló el alcance runtime verificable en `inventory-api/docs/runtime-scope-baseline.md` y se distinguieron capacidades implementadas, parciales, documentadas-only y legacy
- se ajustó `inventory-api/README.md` para evitar interpretar entidades del schema como módulos runtime automáticamente soportados
- se alineó `inventory-api/docs/audit/current-code-audit.md` con el baseline de alcance y con el estado resuelto del hardening de companies
- se expandió la cobertura de caracterización hacia users/roles, órdenes y agent workspace para detectar regresiones de autorización y tenant scope en módulos sensibles adicionales
- se agregaron pruebas de caracterización para evitar regresiones de autorización en companies y se incorporaron a la suite `npm test`
- se consolidó `inventory-api/docker-compose.dev.yml` como flujo Compose canónico dev-only y se dejó `inventory-api/docker-compose.yml` como alias transicional documentado
- se externalizaron credenciales del stack de desarrollo hacia variables de entorno documentadas en `inventory-api/.env.example`
- se marcó `docker/docker-compose.dev.yml` y `docker/Dockerfile.example` como artefactos de compatibilidad/deprecados para reducir ambigüedad operativa
- se actualizó `inventory-api/README.md` con el comando oficial `docker compose -f docker-compose.dev.yml up --build`
- se endureció `inventory-api/Dockerfile` con build multi-stage, `npm ci` y runtime non-root
- se redujo el contexto de build de Docker mediante exclusiones adicionales en `inventory-api/.dockerignore`
- se agregó `GET /health/ready` con verificación mínima de base de datos y se mantuvo `GET /health` como liveness compatible
- la imagen Docker ahora declara `HEALTHCHECK` basado en `/health/ready`
- se añadieron pruebas automatizadas para liveness/readiness y documentación operativa actualizada
- se agregó `inventory-api/scripts/diagnose-hardening-constraints.js` para validar pagos, pedidos y cantidades antes de aplicar constraints P2
- se documentó la ruta canónica secuencial para replay y validación de `TASK-005` usando `docker-compose.dev.yml` y una base disposable verificada con `psql`
- `inventory-api/tests/p2-hardening-constraints.test.js` ahora crea sus fixtures mínimas (`products` e `invoices`) sobre la DB validada para no depender de contenido implícito del seed
- se agregó la capacidad base de auditoría transversal con tabla `audit_events`, middleware de `requestId`, encabezado `X-Request-Id` y logging correlacionado
- se incorporó un redactor centralizado para evitar persistir secretos en `before_state`, `after_state` y `metadata` de auditoría
- se añadieron pruebas automatizadas para sanitización de auditoría, contexto de request y persistencia real básica de `audit_events`
- se instrumentaron eventos de auditoría para login exitoso/rechazado, denegaciones de autenticación/autorización y operaciones sensibles prioritarias de pedidos, pagos, facturas, inventario y administración
- las rutas sensibles ahora propagan `req` a los servicios auditados para correlacionar `requestId`, actor y recurso en `audit_events`
- las denegaciones de seguridad usan registro de auditoría fail-open defensivo para no bloquear respuestas 401/403 si la infraestructura de auditoría no está disponible
- se agregaron pruebas de instrumentación de auditoría para auth, middlewares, pagos, facturas, pedidos, administración e inventario
- se cerró la documentación operativa P2 con guía canónica de Compose dev-only, readiness, replay de constraints y validación de auditoría inicial
- se agregó una línea base de caracterización para deuda residual del runtime: drift financiero actual, integraciones `geocoding`/`taxpayer` y superficie pública embebida `src/public/`
- se amplió el schema Prisma de `payments` con lifecycle administrativo, metadatos de aprobación/rechazo/revisión/cancelación y tabla `payment_receipts` para evidencia privada, junto con migración/backfill explícitos `ACTIVE -> APPROVED`
- se implementó el runtime del Modelo B para pagos con endpoints dedicados de lifecycle (`under-review`, `approve`, `reject`, `reverse`), sincronización derivada de `invoice.status`/`invoice.paidAt`, permisos efectivos `collections.payments.*`, evidencia privada descargable y bloqueo de mutabilidad manual de `status`/`paidAt` en invoices
- se agregó el alias semántico `GET /api/companies/company/dashboard`, se migró la UI embebida del dashboard administrativo a ese path y se preservó `GET /api/companies/root/dashboard` como compatibilidad legacy
- se fortaleció la caracterización de `src/public/` con smoke/contract checks adicionales para módulos root administrativos, helpers de descarga protegida y flujo warehouse/import, sin introducir framework E2E nuevo
- se elevó la cobertura de `geocoding` y `taxpayer` con casos de validación, normalización, fallos remotos y JSON inválido, y se aclaró documentalmente que inventory alerts siguen siendo una capacidad parcial interna sin API/UI operable de gestión
- se documentaron mitigaciones operativas para Prisma en Windows, incluyendo uso de `.cmd`, cierre de procesos que retienen el engine, limpieza de `node_modules/.prisma/client`, reruns seguras y criterios para clasificar `EPERM` como falla ambiental
- se formalizó un catálogo documental de endpoints runtime por dominios y un mapa inicial de contratos UI/API de la UI embebida servida desde `src/public/`, incluyendo compatibilidad legacy observada
- se documentó explícitamente la frontera real entre backend Express y UI embebida, y se creó `inventory-api/docs/ui-guidelines.md` con reglas operables de navegación, fetch autenticado, errores, descargas protegidas y límites de lógica de negocio en frontend
- se congeló la realidad de despliegue del repositorio en `inventory-api/docs/runtime-deployment-reality.md`, separando soporte Docker/Compose de desarrollo local de una estrategia productiva que sigue no verificada por evidencia del repo
- se agregó `inventory-api/docs/domain-evolution-baseline.md` y se reforzó el baseline/audit para clasificar por dominio inventory alerts, aprobaciones, producción, reportes/exportaciones y la evolución recomendada sin mezclar roadmap con runtime confirmado
- se consolidó la trazabilidad del paquete `runtime-contract-governance`, actualizando `current-state.md`, `tasks.md`, `traceability.md` e `implementation-report.md` para que el baseline documental pueda retomarse sin redescubrir el repositorio
- se implementó el baseline API de `inventory alerts` con rutas operables de listado, detalle y transición de estado, más pruebas de tenant scope/autorización en `inventory-api`
- se integró una superficie UI embebida en `warehouse/products` para consultar, revisar detalle y atender alertas de inventario desde el runtime real
- se introdujo una capa reusable mínima de approvals aplicada a lifecycle de pagos y a la prevalidación de aprobación de pedidos, preservando compatibilidad con las rutas actuales
- se versionó un baseline OpenAPI parcial y factual con tests automáticos de consistencia entre contrato, mounts de `app.js` y routers cubiertos
- se agregó un baseline productivo verificable con `docker-compose.prod.yml`, validación automatizada de variables críticas, servicio de migración y documentación operativa mínima
- se consolidaron los baselines runtime y la trazabilidad de `runtime-operability-and-contract-hardening` para reflejar alerts operables, approvals mínimos, OpenAPI parcial y despliegue productivo mínimo verificable
- se endureció transaccionalmente el flujo `payment -> invoice financial sync` en approve/reject/reverse, con pruebas de rollback y preservación del lifecycle observable
- se corrigió la deriva documental de `README.md`, `inventory-api/docs/architecture.md` y el baseline OpenAPI para clasificar explícitamente `/api/companies/root/dashboard` como alias legacy engañoso preservado
- se agregó un gate incremental `npm run validate:public-runtime` para gobernar `src/public/` como runtime soportado, integrado en `npm run verify`, y se corrigió una falla real de sintaxis expuesta por ese gate
- se implementó throttle mínimo backend para `POST /api/auth/login` y se documentaron los límites actuales del hardening anti-brute-force y del payload global `25mb`
- se extendió el hardening distribuido de auth hacia `GET /api/geocoding/search` y `GET /api/taxpayers/lookup` con throttling autenticado segmentado por superficie
- se reemplazó el límite global indiscriminado de payload por clases explícitas `256kb` / `1mb` / `25mb` aplicadas por surface mount, preservando excepciones justificadas en `clients`, `products` y `payments`
- `src/public/` pasó a tener lint browser-first explícito, validación incremental de assets HTML locales y correcciones menores descubiertas por esos nuevos gates
- el baseline OpenAPI parcial se expandió hacia `auth`, `companies/users/roles`, `clients`, `agent workspace` e integraciones externas, manteniendo validación automática de consistencia contra `src/app.js` y `src/routes/`
- se completaron `TASK-003`, `TASK-004` y `TASK-005` de `inventory-api/specs/p4-closeout-hardening` con utilidades monetarias decimales seguras, inventario centralizado de políticas de acceso y autodiscovery portable de `tests/**/*.test.js`
- se completó `TASK-006` de `inventory-api/specs/p4-closeout-hardening` con un workflow mínimo `.github/workflows/quality-gates.yml` basado en `npm ci`, `npm run build` y `npm run verify`, sin requerir secretos de despliegue
- se completó `TASK-007` de `inventory-api/specs/p4-closeout-hardening` con `.github/workflows/build-and-publish.yml`, tags/manual triggers controlados y publicación de artefactos Docker versionados en GitHub Actions sin deploy automático

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
