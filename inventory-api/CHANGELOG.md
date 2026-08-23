# Changelog

## 2026-09-01 — recepciones-fiscales-workspace (spec)
- Creado paquete de especificación completo para la implementación de los placeholders `#recepciones` y `#referencias_fiscales` del root shell.
- Documentados 7 tasks en orden de ejecución óptimo: TASK-001 (backend endpoint GET /api/fiscal-references) → TASK-002 (adaptador browser) → TASK-003/004 (renderers y view de recepciones) → TASK-005/006 (renderers y view de referencias fiscales) → TASK-007 (wiring).
- Spec `status: approved` listo para ejecución por el agente implementador.

## 2026-08-25 — purchase-orders-workspace
- Implementado `TASK-001`: servicio `listPurchaseOrders`, repositorio `listPurchaseOrdersForCompany`, y ruta `GET /api/procurement/orders` con `procurement.view`; registrado en OpenAPI baseline y catálogo de endpoints.
- Implementado `TASK-002`: extraída la sección de comparación de cotizaciones en módulos dedicados `quotations-comparison.js` y `quotations-comparison.renderers.js` con tabla de comparación, diálogo de selección de proveedor y montado como extensión del workspace de cotizaciones.
- Implementado `TASK-003`: diálogo de creación de orden de compra desde selección aprobada (`quotations-create-po-dialog`), con resumen de ítems, campo de notas y llamada a `quotationsApi.createPurchaseOrder()`.
- Implementado `TASK-004`: vista `#solicitudes_compra` con layout de dos columnas (lista + panel de detalle), renderers XSS-safe, e indicador de "OC emitida"; `solicitudes_compra` promovida de `createAdminPendingEntry` a `createRouteItem` con `implemented: true`.
- Implementado `TASK-005`: vista `#ordenes_compra` con layout de dos columnas (lista + panel de detalle), módulo `purchase-orders-api.js` sobre `GET /api/procurement/orders`, renderers de estados `PENDING/CONFIRMED/RECEIVED`, y placeholder de comprobante fiscal Hacienda CR; `ordenes_compra` promovida de `createAdminPendingEntry` a `createRouteItem` con `implemented: true`.
- Implementado `TASK-006` (incluido en TASK-003): flujo de aprobación gerencial en comparación — banner de advertencia con botón "Aprobar selección" condicionado a `procurement.approve`, llamada a `quotationsApi.approveSelection()`, y apertura del diálogo de OC tras aprobación.
- Añadidos 22 tests de caracterización en `purchase-orders-workspace-views-characterization.test.js`; actualizados `root-shell-supply-manifest.test.js` y `root-shell-router-characterization.test.js`. Suite: 1011 tests, 1008 pass, 1 fallo pre-existente.

## 2026-08-04
- Implementado `bcrypt-supply-chain-closeout`: actualizado `bcrypt` a `^6.0.0`, eliminado el chain `@mapbox/node-pre-gyp`/`tar`, añadida caracterización de compatibilidad de hashes/login y convergida la gobernanza de `npm audit` a un baseline de 0 vulnerabilidades documentando el bloqueo local de Docker.
- Implementado `due-diligence-final-closeout`: capturada la baseline fresca de `npm audit`, separadas correcciones seguras frente al path breaking de `bcrypt`, sincronizada la gobernanza/documentación del lane `dependency-hygiene`, añadidos índices Prisma acotados para `User`, `OrderItem` e `Invoice`, y actualizado el cierre final en `docs/audit/current-code-audit.md`.

## 2025-08-16
- Revalidado `merge-readiness-regression-control` `TASK-004`: actualizada la definición de la matriz markdown de autorización con columna de patrón de ownership, ejemplos base por endpoints representativos y corrección del drift que todavía describía `agent.routes.js` como `authenticate`-only.
- Implementado `merge-readiness-regression-control` (ciclo TASK-001 a TASK-003): diferenciada la evidencia CI de Windows Prisma frente al baseline local gobernado, añadido reporte local mínimo de diagnóstico para `prisma-generate-safe`, y convergida la protección de `agent.routes.js` sobre `authorizeAccessPolicy('agent.workspace.access')` con cobertura de regresión actualizada.

## 2025-08-15
- Implementado `p38-root-shell-modularity-hardening`: agregado `src/public/root/registry.js`, migrado el shell root soportado a `window.RootShell` (`register/require/has`), mantenido el comportamiento de `/root/` y `410 Gone`, y actualizada la validación/documentación asociada.

## 2025-08-14
- Implementado `root-shell-follow-up-alignment`: alineadas las pruebas de gobernanza con `/root/` como runtime soportado, ampliado el allowlist acotado de `typecheck` al shell root aprobado, sincronizada la documentación de baseline y diferida explícitamente la modularidad del shell a un spec futuro.
- Implementado `p28-flexible-permission-governance-foundation`: añadida una foundation central de gobernanza de permisos en `src/security/**`, endurecida la creación de compañías para que solo un `root` global pueda ejecutarla desde backend y documentada la guía UX + secuencia futura para `roles_permissions` sin activar todavía enforcement adicional no aprobado.

## 2026-07-28
- Convergida la gobernanza contractual de runtime para que `docs/**` sea la fuente canónica revisada y `internal-docs/**` quede solo como soporte auxiliar no canónico.
- Añadido el lane obligatorio `redis-browser-session-tests` junto con el comando `npm run test:redis-path` para validar explícitamente la ruta Redis de browser sessions sin desestabilizar el suite agregado en memory mode.
- Endurecida la observabilidad operativa de browser sessions sobre Redis con readiness del store, cobertura de pruebas para `/health/ready` y guía de diagnóstico/recuperación en el runbook productivo.
- Cerrada `TASK-018` documentando que `legacy-public-runtime/` queda solo como respaldo/referencia transicional hasta que las secciones equivalentes estén implementadas y validadas en el SPA.
- Cerrada `TASK-019` documentando que el runtime público reducido y su baseline de `typecheck`/validación no pueden reexpandirse hacia páginas legacy retiradas sin un nuevo spec aprobado.
- Cerradas `TASK-023` y `TASK-024` definiendo que `/migration.html?mode=post-login-transition` sigue como landing temporal de “no implementado aún” con salida segura al login/logout, y que la mitigación aprobada para el ruido de auditoría en tests es separar suites DB-free de suites DB-backed antes de considerar supresión estrecha de logs.
- Implementado `p26-browser-runtime-db-free-suite-separation`: añadido `docs/test-suite-catalog.md`, estabilizado `tests/audit-instrumentation.test.js` como suite DB-free en memory mode y aislado el ruido incidental de persistencia de auditoría en `tests/browser-e2e.e2e.js` mediante un helper de seam compartido sin tocar la semántica productiva de auditoría.

## 2026-07-21
- Endurecido el store de throttling con modo por archivo compartible y soporte configurable `memory|file`.
- Unificada la validación de archivos sensibles para documentos de cliente y comprobantes de pago.
- Extendida la gobernanza central de autorización a rutas de clientes, geocoding y taxpayer.
- Eliminado riesgo monetario residual en cálculos derivados adicionales y añadidas pruebas de regresión focalizadas.
- Alineado `uploadClientDocumentSchema` con la gobernanza sensible compartida y actualizada la caracterización de payloads al contrato central de access policies.

## 2025-10-29
- Completed `p12-browser-session-closure`: moved supported browser flows from persisted bearer tokens to backend-owned browser sessions with cookie-backed bootstrap/logout, updated shared browser helpers, and added session-boundary/browser E2E coverage.
