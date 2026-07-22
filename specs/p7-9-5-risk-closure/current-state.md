# Current State Analysis
## 1. System overview
El sistema inspeccionado es un monolito Node.js/Express con capas de rutas, servicios y repositorios sobre Prisma. En el workspace actual, la aplicación vive bajo el subdirectorio `inventory-api/`. El montaje runtime central ocurre en `inventory-api/src/app.js`, donde se registran routers para auth, compañías, usuarios, clientes, productos, pedidos, facturas, pagos, inventario, bodegas, regiones, rutas comerciales, agente e integraciones externas. Confirmado en `inventory-api/src/app.js`.

## 2. Relevant repository structure
- `inventory-api/src/app.js`: montaje de routers, middlewares globales y manejo central de errores.
- `inventory-api/src/routes/*.routes.js`: superficie HTTP montada.
- `inventory-api/src/services/*.service.js`: lógica de aplicación y orquestación.
- `inventory-api/src/repositories/*.repository.js`: acceso a datos con Prisma.
- `inventory-api/src/lib/throttle-store.js`: store de throttling con variantes memory/file/prisma.
- `inventory-api/src/lib/logging.js`: logging request-level actual.
- `inventory-api/docs/openapi/runtime-baseline.openapi.json`: contrato OpenAPI factual parcial.
- `inventory-api/tests/*.test.js`: caracterización, seguridad, gobernanza y smoke tests.
- **Missing in current visible workspace:** no se observó `inventory-api/docs/runtime-endpoint-catalog.md` ni `inventory-api/docs/audit/p6-9_5-blockers.md`; cualquier referencia histórica a esos artefactos debe tratarse como drift documental y no como evidencia confirmada actual.

## 3. Current components
### 3.1 SQL raw inseguro actualmente observable
**Actualizado tras TASK-003:** ya no existen usos libres de `RawUnsafe` en runtime productivo bajo `inventory-api/src/`.
- `src/lib/throttle-store.js` ahora usa ejecución raw parametrizada gobernada y un allowlist cerrado para el identificador de tabla `throttle_entries`.
- `src/services/inventory.service.js` ahora encapsula `pg_advisory_xact_lock` en un helper de SQL fijo con ejecución raw parametrizada.

**Confirmado:** todavía existen usos de `RawUnsafe` en superficies no runtime directas.
- `scripts/apply-committed-migrations.js`
- `scripts/diagnose-hardening-constraints.js`
- `prisma/migration-instructions.md`
- `tests/p2-hardening-constraints.test.js`

**Compatibilidad documentada:** durante la implementación se detectó drift compatible respecto del análisis anterior: `tests/throttle-store.test.js` y `tests/lot-datetime-characterization.test.js` también exponían stubs/fakes con nombres `RawUnsafe`, pero ya fueron alineados al nuevo camino seguro durante el hardening runtime.

**Inferido:** el riesgo principal residual ya no está en el runtime productivo, sino en la gobernanza de scripts, fixtures de integración y documentación operativa que aún normalizan `RawUnsafe`.

### 3.2 Flujos con DB + filesystem
**Confirmado:** documentos privados de clientes combinan DB y filesystem.
- `src/services/client.service.js` crea primero el registro DB (`clientRepository.createClientDocument`), luego persiste archivo privado con `fs.writeFile`, y finalmente actualiza `fileUrl` en DB.
- Si falla la escritura del archivo, intenta borrar el registro DB (`clientRepository.deleteClientDocument`). Si también falla el cleanup, retorna `500` con mensaje específico.
- La descarga valida tenant y existencia física con `fs.access` en `getCompanyClientDocumentDownload`.

**Confirmado:** comprobantes de pago combinan DB y filesystem.
- `src/services/payment-receipt-evidence.service.js` persiste el archivo primero (`persistPaymentReceiptFile`) y luego crea/actualiza evidencia en DB.
- Si falla la persistencia DB posterior, intenta cleanup best-effort del archivo con `deletePaymentReceiptFileQuietly`.
- `src/services/payment.service.js` borra el pago si falla la creación de evidencia tras `createPayment`.
- `src/services/payment.service.js#getPaymentReceiptDownload` existe como superficie protegida según `src/routes/payment.routes.js`.

**Confirmado:** los archivos privados residen fuera de `src/public`.
- Clientes: `src/lib/client-document-storage.js`
- Pagos: `src/lib/payment-receipt-storage.js`

### 3.3 Observabilidad y gobernanza de payload/respuesta
**Actualizado tras TASK-006:** el logging request-level en producción y test sigue registrando `method`, `path`, `statusCode`, `durationMs` y `errorCode`, y ahora puede añadir métricas agregadas para un set explícito de endpoints pesados gobernados.
- Campos adicionales para endpoints priorizados: `endpointKey`, `routePattern`, `payloadClass`, `responseShape`, `responseBytes` y `resultCount`.
- La captura es best-effort y se activa desde `src/middlewares/heavy-endpoint-metrics.js` antes del logger Morgan en `src/lib/logging.js`.

**Actualizado tras TASK-006:** ya existe un artefacto versionado que gobierna el baseline inicial de endpoints pesados.
- Baseline machine-readable: `inventory-api/docs/heavy-endpoints-baseline.json`.
- Documento explicativo: `inventory-api/docs/heavy-endpoints-baseline.md`.
- Validación de drift: `inventory-api/tests/heavy-endpoint-governance.test.js`.

**Compatibilidad documentada:** esta primera fase sigue siendo representativa, no una captura productiva completa.
- El baseline usa fixtures representativas y métricas lógicas versionadas.
- Aún no existe un catálogo runtime exhaustivo equivalente a `runtime-endpoint-catalog.md`; la gobernanza pesada se apoya en el baseline explícito de endpoints priorizados.

**Confirmado:** ya existe gobernanza de payload de entrada por clases.
- `src/middlewares/request-payload.js` define límites `256kb`, `1mb` y `25mb`.
- `README.md` documenta esas clases y excepciones para `POST /api/clients/:clientId/documents`, `POST /api/products/import`, `POST /api/payments` y `PUT /api/payments/:id`.

### 3.4 Contrato runtime vs OpenAPI
**Actualizado tras TASK-007:** OpenAPI sigue siendo explícitamente parcial, pero ahora está acompañado por un manifiesto contractual exhaustivo de exclusiones.
- `inventory-api/docs/openapi/runtime-baseline.openapi.json` declara `x-coverage-scope.coverage = "partial"`.
- El mismo artefacto ahora referencia explícitamente:
  - `docs/runtime-contract-manifest.json` como fuente de exclusiones intencionales;
  - `docs/runtime-endpoint-catalog.md` como catálogo humano del runtime y del criterio de clasificación.
- `inventory-api/tests/openapi-contract-consistency.test.js` valida que cada operación documentada tenga `x-runtime-source` y coincida con `inventory-api/src/app.js` + su archivo de rutas.

**Actualizado tras TASK-007:** toda ruta montada en routers ya queda clasificada contractualmente.
- Operaciones cubiertas: viven en OpenAPI mediante `x-runtime-source`.
- Operaciones excluidas: viven en `inventory-api/docs/runtime-contract-manifest.json` con `reasonCode` y justificación explícita.
- La superficie `express.static(src/public)` queda registrada como runtime soportado pero intencionalmente fuera de OpenAPI parcial.

**Confirmado:** OpenAPI sigue siendo más estrecho que el runtime montado visible, por decisión aprobada.
- La diferencia ya no es implícita: quedó gobernada por el manifiesto contractual y el catálogo runtime.
- `inventory-api/README.md` sigue declarando que el OpenAPI es parcial y factual.

## 4. Current data flow
### 4.1 Cliente document upload
`POST /api/clients/:clientId/documents` (`inventory-api/src/routes/client.routes.js`) -> `clientService.createCompanyClientDocument` (`inventory-api/src/services/client.service.js`) -> validación base64/MIME -> `clientRepository.createClientDocument` -> persistencia de archivo privado -> `clientRepository.updateClientDocument` con URL protegida.

### 4.2 Payment receipt upload
`POST /api/payments` o `PUT /api/payments/:id` (`inventory-api/src/routes/payment.routes.js`) -> `paymentService` -> `payment-receipt-evidence.service` -> persistencia de archivo privado -> escritura de evidencia en DB/tx -> serialización con URL protegida.

### 4.3 OpenAPI consistency actual
`inventory-api/tests/openapi-contract-consistency.test.js` lee `inventory-api/docs/openapi/runtime-baseline.openapi.json`, `inventory-api/src/app.js` y cada `routeFile` declarado en `x-runtime-source`; valida únicamente operaciones ya cubiertas por OpenAPI.

### 4.4 Request logging actual
`inventory-api/src/app.js` registra `createHeavyEndpointMetricsMiddleware()` antes de `createRequestLogger(nodeEnv)`. `inventory-api/src/lib/logging.js` usa Morgan para emitir duración y, cuando aplica, serializa también la metadata agregada del endpoint pesado gobernado sin incluir cuerpos sensibles.

## 5. Current domain model
### 5.1 Endpoints pesados observables
**Actualizado tras TASK-006:** el set inicial priorizado ya está versionado y medido de forma representativa.
- `GET /api/agent/stores`
- `GET /api/agent/stores/:storeId`
- `GET /api/clients`
- `GET /api/clients/company`
- `GET /api/invoices/inconsistencies`
- `GET /api/inventory/stocks`
- `GET /api/payments`
- `POST /api/products/import`

**Confirmado por código y baseline representativa:** estos endpoints tienen señales de alto costo estructural.
- `GET /api/agent/stores` y `GET /api/agent/stores/:storeId` cargan includes profundos en `src/repositories/agent-workspace.repository.js`: cliente, entidad legal, subregión/región/rutas, representantes, órdenes, facturas, pagos, items, productos y visitas. No exponen paginación de lectura.
- `GET /api/clients` y `GET /api/clients/company` usan `clientInclude()` con stores, representantes, contactos, referencias, documentos y `_count` en `src/repositories/client.repository.js`; la paginación es opcional, no obligatoria.
- `GET /api/invoices/inconsistencies` usa `findInvoicesForDebtReview` con `client`, `order.clientStore` y `payments` sin paginación en `src/repositories/invoice.repository.js`.
- `GET /api/payments` carga `invoice.client` y `receipts` en `src/repositories/payment.repository.js`; sí soporta paginación opcional.
- `GET /api/inventory/stocks` en `src/repositories/inventory.repository.js` consulta `warehouseStock` y `warehouseLotStock` sin paginación.
- `POST /api/products/import` acepta payload alto de hasta `25mb` (`src/routes/product.routes.js`, `src/middlewares/request-payload.js`).

### 5.2 Seguridad y tenancy relacionadas
- Descargas privadas de clientes y pagos dependen de validación tenant-aware en servicios/repositorios (`client.service.js`, `payment.service.js`, `payment.repository.js`).
- Varias superficies de alto costo dependen de filtros tenant/joins profundos en repositorios, no solo del middleware de autenticación.

## 6. Current APIs or interfaces
**Confirmado:** el runtime expone routers montados en:
- `/api/auth`
- `/api/companies`
- `/api/roles`
- `/api/users`
- `/api/clients`
- `/api/products`
- `/api/orders`
- `/api/invoices`
- `/api/payments`
- `/api/inventory`
- `/api/warehouses`
- `/api/regions`
- `/api/sales-routes`
- `/api/agent`
- `/api/taxpayers`
- `/api/geocoding`
- `/api/economic-activities`
- `/health`

Confirmado en `inventory-api/src/app.js`. Tras TASK-007, el workspace visible ya incluye artefactos complementarios versionados bajo `inventory-api/docs/`:
- `runtime-endpoint-catalog.md`
- `runtime-contract-manifest.json`

## 7. Current database behavior
- Prisma es el acceso principal de datos (`src/lib/prisma.js`, repositorios).
- El throttling distribuido se apoya en tabla `throttle_entries` y ejecución raw parametrizada gobernada en `src/lib/throttle-store.js`.
- El inventario usa un advisory lock SQL explícito encapsulado en helper de SQL fijo en `src/services/inventory.service.js`.
- La paginación existente usa `parsePaginationQuery` y `buildPaginatedResponse` (`src/lib/pagination.js`) con `MAX_PAGE_SIZE = 100`, pero su aplicación depende de cada ruta/servicio.

## 8. Existing tests
### Confirmed relevant coverage
- `tests/openapi-contract-consistency.test.js`: consistencia OpenAPI -> runtime cubierto y presencia del manifiesto contractual complementario.
- `tests/runtime-contract-governance.test.js`: clasificación exhaustiva de rutas montadas entre OpenAPI cubierto y exclusiones intencionales.
- `tests/throttle-store.test.js`: comportamiento de stores de throttling, incluyendo fake Prisma con `RawUnsafe`.
- `tests/client-document-security.test.js`: almacenamiento privado, tenant scope, descarga segura y caracterización de fallos parciales de documentos de cliente.
- `tests/payment-receipt-security.test.js`: almacenamiento privado, validación MIME/extensión, descarga protegida y caracterización de fallos parciales de comprobantes.
- `tests/public-surface-characterization.test.js`: contratos de UI embebida y rutas críticas públicas.

### Missing or weak coverage related to request
- La clasificación exhaustiva ya existe para routers montados, pero todavía depende de regex simples sobre `src/app.js` y `src/routes/*.routes.js`; si el estilo de definición de rutas cambia de forma drástica, el guard deberá evolucionar también.
- La cobertura contractual de browser/runtime público sigue gobernada fuera de OpenAPI mediante pruebas HTTP/browser y documentación separada.

## 9. Current limitations
- Persisten usos `RawUnsafe` fuera del runtime crítico, principalmente en scripts operativos, una suite de constraints física y documentación de migraciones.
- El OpenAPI parcial ya no opera aislado: el universo de rutas montadas queda clasificado junto con `docs/runtime-contract-manifest.json`. Sigue siendo parcial por decisión aprobada.
- El sistema ya gobierna un baseline inicial de endpoints pesados, pero la primera fase sigue siendo representativa y no impone budgets rígidos ni captura productiva exhaustiva.
- Existen flujos DB/filesystem con cleanup best-effort o multi-step rollback sin caracterización suficiente de todos los fallos parciales.
- Varias rutas de alto costo continúan sin paginación obligatoria.

## 10. Technical debt related to the change
- Alias legacy y superficies históricas siguen activos en contratos (`inventory-api/docs/openapi/runtime-baseline.openapi.json`).
- El catálogo runtime y el manifiesto contractual ya existen, pero introducen una nueva responsabilidad de mantener sincronizados tres artefactos: `src/app.js`/rutas, OpenAPI parcial y manifiesto de exclusiones.
- `src/public` y ciertos servicios/repositorios son grandes, lo que complica medir impacto de endpoints sin una capa fina de observabilidad.
- `throttle-store` mezcla varias estrategias de persistencia; el identificador SQL dinámico ya quedó acotado por allowlist cerrada, pero la coexistencia de modos memory/file/prisma sigue elevando la complejidad de cambio.

## 11. Risks
- Cambiar SQL raw sin conservar semántica de locking o de upsert compartido puede degradar throttling o consistencia de inventario.
- Añadir instrumentación ingenua de respuestas puede aumentar costo en endpoints ya pesados o filtrar datos sensibles.
- Formalizar el alcance contractual sin una fuente canónica única puede duplicar gobernanza entre OpenAPI y catálogo runtime.
- Endurecer fallos parciales puede revelar deuda previa de compensaciones incompletas.

## 12. Relevant files
- `inventory-api/src/app.js`
- `inventory-api/src/lib/throttle-store.js`
- `inventory-api/src/services/inventory.service.js`
- `inventory-api/src/services/client.service.js`
- `inventory-api/src/services/payment.service.js`
- `inventory-api/src/services/payment-receipt-evidence.service.js`
- `inventory-api/src/lib/client-document-storage.js`
- `inventory-api/src/lib/payment-receipt-storage.js`
- `inventory-api/src/lib/logging.js`
- `inventory-api/src/lib/pagination.js`
- `inventory-api/src/middlewares/request-payload.js`
- `inventory-api/src/repositories/agent-workspace.repository.js`
- `inventory-api/src/repositories/client.repository.js`
- `inventory-api/src/repositories/invoice.repository.js`
- `inventory-api/src/repositories/payment.repository.js`
- `inventory-api/src/repositories/inventory.repository.js`
- `inventory-api/src/routes/client.routes.js`
- `inventory-api/src/routes/payment.routes.js`
- `inventory-api/src/routes/product.routes.js`
- `inventory-api/src/routes/agent.routes.js`
- `inventory-api/docs/openapi/runtime-baseline.openapi.json`
- `inventory-api/README.md`
- `inventory-api/tests/openapi-contract-consistency.test.js`
- `inventory-api/tests/throttle-store.test.js`
- `inventory-api/tests/client-document-security.test.js`
- `inventory-api/tests/payment-receipt-security.test.js`
- `inventory-api/tests/public-surface-characterization.test.js`
- **Missing in current workspace but historically referenced:** `inventory-api/docs/runtime-endpoint-catalog.md`, `inventory-api/docs/audit/p6-9_5-blockers.md`