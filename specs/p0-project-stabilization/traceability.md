# Traceability Matrix

## 1. Requirements to tasks

| Requirement | Description | Tasks | Status |
|---|---|---|---|
| FR-001 | Scoping tenant en clientes | TASK-002, TASK-003 | Completed |
| FR-002 | Scoping tenant en facturas | TASK-004, TASK-005 | Completed |
| FR-003 | Scoping tenant en pagos | TASK-006, TASK-007 | Completed |
| FR-004 | No aceptar `companyId` arbitrario | TASK-003, TASK-005, TASK-007 | Completed |
| FR-005 | Validar relaciones dentro del tenant | TASK-005, TASK-007 | Completed |
| FR-006 | Guardar documentos fuera de directorio público | TASK-008 | Completed |
| FR-007 | Exponer documentos solo por acceso autenticado y scopeado | TASK-008, TASK-009 | Completed |
| FR-008 | Pruebas mínimas automatizadas | TASK-009 | Completed |
| FR-009 | Reducir logging sensible en no-dev | TASK-001 | Completed |
| FR-010 | Mantener compatibilidad same-tenant | TASK-002 a TASK-009 | Completed |

## 2. Acceptance criteria to tasks

| Acceptance Criteria | Tasks | Planned evidence |
|---|---|---|
| AC-001 | TASK-002 | pruebas de clientes cross-tenant |
| AC-002 | TASK-003 | pruebas de create/update cliente con `companyId` arbitrario |
| AC-003 | TASK-004, TASK-005 | pruebas de facturas cross-tenant |
| AC-004 | TASK-006, TASK-007 | pruebas de pagos cross-tenant |
| AC-005 | TASK-008 | verificación de no exposición pública |
| AC-006 | TASK-008, TASK-009 | pruebas de descarga protegida |
| AC-007 | TASK-001 | validación de logging por ambiente |
| AC-008 | TASK-009 | `npm test` |

## 3. Architecture decisions to tasks

| Decision | Tasks |
|---|---|
| DEC-002 | TASK-002, TASK-004, TASK-006 |
| DEC-002A | TASK-002, TASK-004, TASK-006 |
| DEC-003 | TASK-004, TASK-005, TASK-006, TASK-007 |
| DEC-004 | TASK-008 |
| DEC-004A | TASK-008 |
| DEC-004B | TASK-008 |
| DEC-004C | TASK-008 |
| DEC-005 | TASK-009 |
| DEC-006 | TASK-001 |

## 4. Implementation evidence
> Actualizar esta sección durante la implementación.

| Task | Files | Tests | Command evidence | Status |
|---|---|---|---|---|
| TASK-001 | `inventory-api/src/app.js`, `inventory-api/src/config.js`, `inventory-api/src/lib/logging.js`, `inventory-api/tests/logging.test.js` | `node --test tests/logging.test.js` | `node --test tests/logging.test.js`; `node -e "process.env.NODE_ENV='development'; require('./src/app'); console.log('app-loaded-development')"`; `node -e "process.env.NODE_ENV='staging'; require('./src/app'); console.log('app-loaded-staging')"` | Completed |
| TASK-002 | `inventory-api/src/routes/client.routes.js`, `inventory-api/src/services/client.service.js`, `inventory-api/src/repositories/client.repository.js`, `inventory-api/tests/client-tenant-scope.test.js` | `node --test tests/logging.test.js tests/client-tenant-scope.test.js` | `node --test tests/logging.test.js tests/client-tenant-scope.test.js`; `node -e "process.env.NODE_ENV='test'; require('./src/routes/client.routes'); console.log('client-routes-loaded')"` | Completed |
| TASK-003 | `inventory-api/src/routes/client.routes.js`, `inventory-api/src/services/client.service.js`, `inventory-api/src/schemas/client.schema.js`, `inventory-api/tests/client-tenant-scope.test.js` | `node --test tests/logging.test.js tests/client-tenant-scope.test.js` | `node --test tests/logging.test.js tests/client-tenant-scope.test.js`; `node -e "process.env.NODE_ENV='test'; require('./src/routes/client.routes'); console.log('client-routes-loaded')"` | Completed |
| TASK-004 | `inventory-api/src/routes/invoice.routes.js`, `inventory-api/src/services/invoice.service.js`, `inventory-api/src/repositories/invoice.repository.js`, `inventory-api/tests/invoice-tenant-scope.test.js` | `node --test tests/logging.test.js tests/client-tenant-scope.test.js tests/invoice-tenant-scope.test.js` | `node --test tests/logging.test.js tests/client-tenant-scope.test.js tests/invoice-tenant-scope.test.js`; `node -e "process.env.NODE_ENV='test'; require('./src/routes/invoice.routes'); console.log('invoice-routes-loaded')"` | Completed |
| TASK-005 | `inventory-api/src/routes/invoice.routes.js`, `inventory-api/src/services/invoice.service.js`, `inventory-api/src/repositories/invoice.repository.js`, `inventory-api/tests/invoice-tenant-scope.test.js` | `node --test tests/logging.test.js tests/client-tenant-scope.test.js tests/invoice-tenant-scope.test.js` | `node --test tests/logging.test.js tests/client-tenant-scope.test.js tests/invoice-tenant-scope.test.js`; `node -e "process.env.NODE_ENV='test'; require('./src/routes/invoice.routes'); console.log('invoice-routes-loaded')"` | Completed |
| TASK-006 | `inventory-api/src/routes/payment.routes.js`, `inventory-api/src/services/payment.service.js`, `inventory-api/src/repositories/payment.repository.js`, `inventory-api/tests/payment-tenant-scope.test.js` | `node --test tests/logging.test.js tests/client-tenant-scope.test.js tests/invoice-tenant-scope.test.js tests/payment-tenant-scope.test.js` | `node --test tests/logging.test.js tests/client-tenant-scope.test.js tests/invoice-tenant-scope.test.js tests/payment-tenant-scope.test.js`; `node -e "process.env.NODE_ENV='test'; require('./src/routes/payment.routes'); console.log('payment-routes-loaded')"`; `node -e "process.env.NODE_ENV='test'; require('./src/services/payment.service'); console.log('payment-service-loaded')"` | Completed |
| TASK-007 | `inventory-api/src/routes/payment.routes.js`, `inventory-api/src/services/payment.service.js`, `inventory-api/src/repositories/payment.repository.js`, `inventory-api/tests/payment-tenant-scope.test.js` | `node --test tests/logging.test.js tests/client-tenant-scope.test.js tests/invoice-tenant-scope.test.js tests/payment-tenant-scope.test.js` | `node --test tests/logging.test.js tests/client-tenant-scope.test.js tests/invoice-tenant-scope.test.js tests/payment-tenant-scope.test.js`; `node -e "process.env.NODE_ENV='test'; require('./src/routes/payment.routes'); console.log('payment-routes-loaded')"`; `node -e "process.env.NODE_ENV='test'; require('./src/services/payment.service'); console.log('payment-service-loaded')"` | Completed |
| TASK-008 | `inventory-api/src/lib/client-document-storage.js`, `inventory-api/src/routes/client.routes.js`, `inventory-api/src/services/client.service.js`, `inventory-api/src/repositories/client.repository.js`, `inventory-api/src/public/root/clients.js`, `inventory-api/src/public/root/client-detail.js`, `inventory-api/scripts/migrate-client-documents-to-private-storage.js`, `inventory-api/tests/client-document-security.test.js` | `node --test tests/logging.test.js tests/client-tenant-scope.test.js tests/invoice-tenant-scope.test.js tests/payment-tenant-scope.test.js tests/client-document-security.test.js` | `node --test tests/logging.test.js tests/client-tenant-scope.test.js tests/invoice-tenant-scope.test.js tests/payment-tenant-scope.test.js tests/client-document-security.test.js`; `node -e "process.env.NODE_ENV='test'; require('./src/routes/client.routes'); console.log('client-routes-loaded')"`; `node -e "process.env.NODE_ENV='test'; require('./src/services/client.service'); console.log('client-service-loaded')"`; `node --check src/public/root/clients.js`; `node --check src/public/root/client-detail.js`; `node --check scripts/migrate-client-documents-to-private-storage.js`; `node scripts/migrate-client-documents-to-private-storage.js`; `npm run prisma:generate` | Completed |
| TASK-009 | `inventory-api/package.json` | `npm test --silent` | `npm test --silent`; `node -e "const pkg=require('./package.json'); console.log(pkg.scripts.test)"` | Completed |

## 5. Auditor finding linkage

| Finding | Description | Decision | Tasks |
|---|---|---|---|
| AUD-001 | Tenant isolation en clientes | Accepted | TASK-002, TASK-003 |
| AUD-002 | Tenant isolation en facturas | Accepted | TASK-004, TASK-005 |
| AUD-003 | Tenant isolation en pagos | Accepted | TASK-006, TASK-007 |
| AUD-012 | Exposición pública de documentos | Accepted | TASK-008 |
| AUD-013 | Logging sensible | Accepted | TASK-001 |
