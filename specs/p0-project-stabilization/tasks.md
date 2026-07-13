# Implementation Tasks

## TASK-001: Ajustar política de logging por ambiente
**Status:** Completed
**Completed at:** 2026-07-12
**Implemented files:**
- inventory-api/src/app.js
- inventory-api/src/config.js
- inventory-api/src/lib/logging.js
- inventory-api/tests/logging.test.js
**Validation evidence:**
- node --test tests/logging.test.js
- node -e "process.env.NODE_ENV='development'; require('./src/app'); console.log('app-loaded-development')"
- node -e "process.env.NODE_ENV='staging'; require('./src/app'); console.log('app-loaded-staging')"
**Objective:** Reducir logging sensible en ambientes no-dev sin perder capacidad básica de diagnóstico.
**Related requirements:**
- FR-009
- NFR-005
- BR-007
- AC-007
**Affected areas:**
- inventory-api/src/app.js
- inventory-api/src/config.js
**Dependencies:**
- None
**Implementation notes:**
- Hacer condicional el uso de `morgan` según `NODE_ENV`.
- Evitar `console.error(error)` completo fuera de `development`.
- Conservar detalle ampliado solo para desarrollo local.
**Tests:**
- Prueba de configuración/logging en `development`
- Prueba de configuración/logging en no-dev
- Verificación manual revisando salida de errores
**Acceptance criteria:**
- [x] `development` mantiene logging útil para depuración.
- [x] `test/staging/production` no registran errores completos por defecto.
- [x] La aplicación sigue respondiendo con errores HTTP correctos.

## TASK-002: Scopear lectura y mutación de clientes por tenant
**Status:** Completed
**Completed at:** 2026-07-12
**Implemented files:**
- inventory-api/src/routes/client.routes.js
- inventory-api/src/services/client.service.js
- inventory-api/src/repositories/client.repository.js
- inventory-api/tests/client-tenant-scope.test.js
**Validation evidence:**
- node --test tests/logging.test.js tests/client-tenant-scope.test.js
- node -e "process.env.NODE_ENV='test'; require('./src/routes/client.routes'); console.log('client-routes-loaded')"
**Objective:** Asegurar que clientes solo puedan listarse, obtenerse, actualizarse y eliminarse dentro de la empresa autenticada.
**Related requirements:**
- FR-001
- BR-001
- BR-002
- AC-001
**Affected areas:**
- inventory-api/src/routes/client.routes.js
- inventory-api/src/services/client.service.js
- inventory-api/src/repositories/client.repository.js
**Dependencies:**
- TASK-001
**Implementation notes:**
- Pasar `req.auth` a `list`, `get`, `update` y `remove`.
- Reemplazar búsquedas globales por búsquedas scopeadas con `companyId`.
- Rechazar explícitamente usuarios root sin `companyId` con `403` en estos flujos empresariales.
**Tests:**
- Prueba de listado de clientes por tenant
- Prueba de detalle de cliente de otro tenant
- Prueba de update/delete cross-tenant
**Acceptance criteria:**
- [x] Un usuario de empresa A no puede leer clientes de empresa B.
- [x] Un usuario de empresa A no puede actualizar o eliminar clientes de empresa B.
- [x] Los clientes válidos de la misma empresa siguen operando normalmente.

## TASK-003: Eliminar inyección libre de `companyId` en clientes
**Status:** Completed
**Completed at:** 2026-07-12
**Implemented files:**
- inventory-api/src/routes/client.routes.js
- inventory-api/src/services/client.service.js
- inventory-api/src/schemas/client.schema.js
- inventory-api/tests/client-tenant-scope.test.js
**Validation evidence:**
- node --test tests/logging.test.js tests/client-tenant-scope.test.js
- node -e "process.env.NODE_ENV='test'; require('./src/routes/client.routes'); console.log('client-routes-loaded')"
**Objective:** Impedir que el payload del cliente decida la empresa cuando esta debe venir del contexto autenticado.
**Related requirements:**
- FR-004
- FR-010
- BR-003
- AC-002
**Affected areas:**
- inventory-api/src/routes/client.routes.js
- inventory-api/src/services/client.service.js
- inventory-api/src/schemas/client.schema.js
**Dependencies:**
- TASK-002
**Implementation notes:**
- Mantener `POST /api/clients` únicamente si fuerza `companyId` desde `req.auth` para usuarios empresariales.
- `createCompanyClientSchema` debe ser la referencia para operaciones empresariales o el endpoint legacy debe alinearse con ese contrato.
- Validar impacto sobre consumidores existentes.
**Tests:**
- Prueba de creación con `companyId` arbitrario
- Prueba de actualización con `companyId` arbitrario
- Verificación manual de compatibilidad de frontend
**Acceptance criteria:**
- [x] El backend no persiste `companyId` arbitrario enviado por usuarios empresariales.
- [x] El flujo normal de creación de cliente usa la empresa autenticada.
- [x] El comportamiento final queda documentado para el endpoint legacy.

## TASK-004: Scopear consulta de facturas por tenant
**Status:** Completed
**Completed at:** 2026-07-12
**Implemented files:**
- inventory-api/src/routes/invoice.routes.js
- inventory-api/src/services/invoice.service.js
- inventory-api/src/repositories/invoice.repository.js
- inventory-api/tests/invoice-tenant-scope.test.js
**Validation evidence:**
- node --test tests/logging.test.js tests/client-tenant-scope.test.js tests/invoice-tenant-scope.test.js
- node -e "process.env.NODE_ENV='test'; require('./src/routes/invoice.routes'); console.log('invoice-routes-loaded')"
**Objective:** Asegurar que listados y detalle de facturas respeten aislamiento por empresa.
**Related requirements:**
- FR-002
- BR-001
- BR-004
- AC-003
**Affected areas:**
- inventory-api/src/routes/invoice.routes.js
- inventory-api/src/services/invoice.service.js
- inventory-api/src/repositories/invoice.repository.js
**Dependencies:**
- TASK-001
**Implementation notes:**
- Propagar `req.auth` a todos los métodos.
- Derivar tenant vía `client.companyId`.
- Preservar el endpoint de inconsistencias ya scopeado.
**Tests:**
- Prueba de listado cross-tenant de facturas
- Prueba de detalle cross-tenant de facturas
**Acceptance criteria:**
- [x] Un usuario solo puede listar facturas de su empresa.
- [x] Un usuario no puede consultar el detalle de facturas de otra empresa.
- [x] El endpoint de inconsistencias sigue funcionando para el mismo tenant.

## TASK-005: Validar referencias y mutación de facturas por tenant
**Status:** Completed
**Completed at:** 2026-07-12
**Implemented files:**
- inventory-api/src/routes/invoice.routes.js
- inventory-api/src/services/invoice.service.js
- inventory-api/src/repositories/invoice.repository.js
- inventory-api/tests/invoice-tenant-scope.test.js
**Validation evidence:**
- node --test tests/logging.test.js tests/client-tenant-scope.test.js tests/invoice-tenant-scope.test.js
- node -e "process.env.NODE_ENV='test'; require('./src/routes/invoice.routes'); console.log('invoice-routes-loaded')"
**Objective:** Impedir creación, actualización y eliminación de facturas fuera del tenant o con referencias inconsistentes.
**Related requirements:**
- FR-002
- FR-004
- FR-005
- BR-004
- AC-003
**Affected areas:**
- inventory-api/src/services/invoice.service.js
- inventory-api/src/repositories/invoice.repository.js
- inventory-api/src/schemas/invoice.schema.js
**Dependencies:**
- TASK-004
**Implementation notes:**
- Validar `clientId` dentro de la empresa autenticada.
- Validar `orderId` dentro de la empresa autenticada cuando exista.
- Definir si delete fuera de tenant debe responder `404` o `403` según convención elegida.
**Tests:**
- Prueba de creación con cliente de otro tenant
- Prueba de creación con pedido de otro tenant
- Prueba de update/delete cross-tenant
**Acceptance criteria:**
- [x] No se crean facturas con cliente de otra empresa.
- [x] No se crean facturas con pedido de otra empresa.
- [x] No se actualizan o eliminan facturas fuera del tenant visible.

## TASK-006: Scopear consulta de pagos por tenant
**Status:** Completed
**Completed at:** 2026-07-12
**Implemented files:**
- inventory-api/src/routes/payment.routes.js
- inventory-api/src/services/payment.service.js
- inventory-api/src/repositories/payment.repository.js
- inventory-api/tests/payment-tenant-scope.test.js
**Validation evidence:**
- node --test tests/logging.test.js tests/client-tenant-scope.test.js tests/invoice-tenant-scope.test.js tests/payment-tenant-scope.test.js
- node -e "process.env.NODE_ENV='test'; require('./src/routes/payment.routes'); console.log('payment-routes-loaded')"
- node -e "process.env.NODE_ENV='test'; require('./src/services/payment.service'); console.log('payment-service-loaded')"
**Objective:** Asegurar que listados y detalle de pagos respeten aislamiento por empresa.
**Related requirements:**
- FR-003
- BR-001
- BR-005
- AC-004
**Affected areas:**
- inventory-api/src/routes/payment.routes.js
- inventory-api/src/services/payment.service.js
- inventory-api/src/repositories/payment.repository.js
**Dependencies:**
- TASK-001
**Implementation notes:**
- Derivar tenant vía `payment.invoice.client.companyId`.
- Propagar `req.auth` a todas las operaciones.
**Tests:**
- Prueba de listado cross-tenant de pagos
- Prueba de detalle cross-tenant de pagos
**Acceptance criteria:**
- [x] Un usuario solo puede listar pagos de su empresa.
- [x] Un usuario no puede consultar pagos de otra empresa.
- [x] Los pagos válidos del tenant correcto siguen accesibles.

## TASK-007: Validar referencias y mutación de pagos por tenant
**Status:** Completed
**Completed at:** 2026-07-12
**Implemented files:**
- inventory-api/src/routes/payment.routes.js
- inventory-api/src/services/payment.service.js
- inventory-api/src/repositories/payment.repository.js
- inventory-api/tests/payment-tenant-scope.test.js
**Validation evidence:**
- node --test tests/logging.test.js tests/client-tenant-scope.test.js tests/invoice-tenant-scope.test.js tests/payment-tenant-scope.test.js
- node -e "process.env.NODE_ENV='test'; require('./src/routes/payment.routes'); console.log('payment-routes-loaded')"
- node -e "process.env.NODE_ENV='test'; require('./src/services/payment.service'); console.log('payment-service-loaded')"
**Objective:** Impedir creación, actualización y eliminación de pagos fuera del tenant o ligados a facturas ajenas.
**Related requirements:**
- FR-003
- FR-004
- FR-005
- BR-005
- AC-004
**Affected areas:**
- inventory-api/src/services/payment.service.js
- inventory-api/src/repositories/payment.repository.js
- inventory-api/src/schemas/payment.schema.js
**Dependencies:**
- TASK-006
**Implementation notes:**
- Validar `invoiceId` antes de crear o actualizar.
- Asegurar que delete/update solo afecten pagos del tenant visible.
**Tests:**
- Prueba de creación con factura de otro tenant
- Prueba de update/delete cross-tenant
**Acceptance criteria:**
- [x] No se crean pagos con facturas de otra empresa.
- [x] No se actualizan o eliminan pagos fuera del tenant visible.
- [x] Se mantiene el flujo válido de pagos del mismo tenant.

## TASK-008: Mover documentos de clientes a almacenamiento privado y exponer descarga protegida
**Status:** Completed
**Completed at:** 2026-07-12
**Implemented files:**
- inventory-api/src/lib/client-document-storage.js
- inventory-api/src/routes/client.routes.js
- inventory-api/src/services/client.service.js
- inventory-api/src/repositories/client.repository.js
- inventory-api/src/public/root/clients.js
- inventory-api/src/public/root/client-detail.js
- inventory-api/scripts/migrate-client-documents-to-private-storage.js
- inventory-api/tests/client-document-security.test.js
**Validation evidence:**
- node --test tests/logging.test.js tests/client-tenant-scope.test.js tests/invoice-tenant-scope.test.js tests/payment-tenant-scope.test.js tests/client-document-security.test.js
- node -e "process.env.NODE_ENV='test'; require('./src/routes/client.routes'); console.log('client-routes-loaded')"
- node -e "process.env.NODE_ENV='test'; require('./src/services/client.service'); console.log('client-service-loaded')"
- node --check src/public/root/clients.js
- node --check src/public/root/client-detail.js
- node --check scripts/migrate-client-documents-to-private-storage.js
- node scripts/migrate-client-documents-to-private-storage.js
- npm run prisma:generate
**Objective:** Eliminar exposición pública de documentos de clientes y reemplazarla por acceso autenticado y scopeado.
**Related requirements:**
- FR-006
- FR-007
- FR-010
- BR-006
- AC-005
- AC-006
**Affected areas:**
- inventory-api/src/services/client.service.js
- inventory-api/src/routes/client.routes.js
- inventory-api/src/app.js
- inventory-api/prisma/schema.prisma
- inventory-api/src/public/root/client-detail.js
- inventory-api/src/public/root/clients.js
**Dependencies:**
- TASK-002
- TASK-003
**Implementation notes:**
- Definir ruta privada de almacenamiento fuera de `src/public`.
- Agregar endpoint de descarga autenticado.
- Reutilizar `fileUrl` como ruta protegida y evaluar agregar `storagePath` para ubicación física privada.
- Incluir migración sistemática de documentos históricos y validación de consistencia post-migración.
**Tests:**
- Prueba de acceso no autenticado a descarga
- Prueba de acceso cross-tenant a descarga
- Prueba de acceso exitoso dentro del tenant
- Verificación manual de UI
**Acceptance criteria:**
- [x] Los documentos nuevos no se guardan bajo `src/public/uploads`.
- [x] No existe acceso directo público sin autenticación.
- [x] Usuarios válidos del tenant correcto pueden descargar el archivo.

## TASK-009: Agregar suite mínima de pruebas automatizadas de estabilización
**Status:** Completed
**Completed at:** 2026-07-13
**Implemented files:**
- inventory-api/package.json
**Validation evidence:**
- npm test --silent
- node -e "const pkg=require('./package.json'); console.log(pkg.scripts.test)"
**Objective:** Incorporar una red mínima reproducible para detectar regresiones de tenant isolation y autorización.
**Related requirements:**
- FR-008
- NFR-004
- AC-008
**Affected areas:**
- inventory-api/package.json
- inventory-api/tests/
- opcional: fixtures o helpers de pruebas
**Dependencies:**
- TASK-001
- TASK-002
- TASK-005
- TASK-007
- TASK-008
**Implementation notes:**
- Usar `node:test` como base mínima aprobada para minimizar dependencias.
- Cubrir al menos clientes, facturas, pagos y documentos.
- Agregar instrucción de ejecución en documentación si aplica.
**Tests:**
- `npm test`
- Verificación de casos críticos definidos en esta especificación
**Acceptance criteria:**
- [x] El repositorio dispone de un comando reproducible para ejecutar pruebas.
- [x] Existen pruebas mínimas para clientes, facturas, pagos y documentos.
- [x] Los criterios críticos de autorización y tenant isolation quedan cubiertos.
