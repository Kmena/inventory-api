# Implementation Tasks
## TASK-001: Inventariar usos de RawUnsafe y clasificarlos
**Status:** Completed
**Completed at:** 2026-07-22
**Implemented files:**
- `specs/p7-9-5-risk-closure/rawunsafe-inventory.md`
- `inventory-api/tests/rawunsafe-inventory-governance.test.js`
**Validation evidence:**
- `node --test tests/rawunsafe-inventory-governance.test.js`
- `npm run test -- --silent`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
**Objective:** Producir un inventario exhaustivo de todos los usos observables de `RawUnsafe` en runtime, scripts y pruebas, con criticidad y estrategia de cierre.
**Affected areas:**
- `inventory-api/src/lib/throttle-store.js`
- `inventory-api/src/services/inventory.service.js`
- `inventory-api/scripts/apply-committed-migrations.js`
- `inventory-api/scripts/diagnose-hardening-constraints.js`
- `inventory-api/tests/p2-hardening-constraints.test.js`
- `inventory-api/tests/throttle-store.test.js`
- `inventory-api/prisma/migration-instructions.md`
**Dependencies:**
- None
**Related requirements:**
- FR-001
- AC-001
**Implementation notes:**
- Distinguir runtime productivo, scripts operativos y pruebas.
- Registrar para cada caso: query, origen de parámetros, motivo técnico y estrategia de endurecimiento/eliminación.
- No asumir que todos los casos tienen la misma severidad.
**Tests:**
- Verificación manual del inventario contra búsqueda repo-wide
- Prueba o script opcional que detecte nuevos usos `RawUnsafe`
**Acceptance criteria:**
- [ ] Todo uso de `RawUnsafe` queda listado por archivo y contexto.
- [ ] Cada uso queda clasificado por criticidad y superficie.
- [ ] El inventario distingue casos a eliminar, encapsular o solo gobernar.

## TASK-002: Diseñar la estrategia segura para cada caso RawUnsafe
**Status:** Completed
**Completed at:** 2026-07-22
**Implemented files:**
- `specs/p7-9-5-risk-closure/rawunsafe-remediation-strategy.md`
- `specs/p7-9-5-risk-closure/rawunsafe-inventory.md`
**Validation evidence:**
- manual strategy review against `inventory-api/src/lib/throttle-store.js`
- manual strategy review against `inventory-api/src/services/inventory.service.js`
- `node --test tests/throttle-store.test.js tests/lot-datetime-characterization.test.js tests/rawunsafe-inventory-governance.test.js`
**Objective:** Definir la estrategia técnica detallada para sustituir o encapsular cada uso runtime de `RawUnsafe` sin romper comportamiento.
**Affected areas:**
- `inventory-api/src/lib/throttle-store.js`
- `inventory-api/src/services/inventory.service.js`
- documentación técnica P7
**Dependencies:**
- TASK-001
**Related requirements:**
- FR-001
- FR-002
- BR-004
**Implementation notes:**
- Priorizar tagged templates Prisma, SQL fijo parametrizado o allowlist cerrada de identificadores.
- Documentar explícitamente cómo preservar advisory locks y upserts de throttling.
- Si algún caso no puede eliminarse, justificar la excepción y su control compensatorio.
**Tests:**
- Revisión técnica del diseño
- Casos de prueba previstos para throttling y locking
**Acceptance criteria:**
- [ ] Existe una estrategia segura por cada caso runtime.
- [ ] La estrategia preserva semántica funcional y tenant-aware.
- [ ] Las excepciones, si existen, quedan justificadas y acotadas.

## TASK-003: Endurecer el runtime frente a RawUnsafe y actualizar pruebas asociadas
**Status:** Completed
**Completed at:** 2026-07-22
**Implemented files:**
- `inventory-api/src/lib/throttle-store.js`
- `inventory-api/src/services/inventory.service.js`
- `inventory-api/tests/throttle-store.test.js`
- `inventory-api/tests/lot-datetime-characterization.test.js`
- `inventory-api/tests/rawunsafe-inventory-governance.test.js`
- `specs/p7-9-5-risk-closure/rawunsafe-inventory.md`
**Validation evidence:**
- `node --test tests/throttle-store.test.js tests/lot-datetime-characterization.test.js tests/rawunsafe-inventory-governance.test.js`
- `npm run test -- --silent`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
**Objective:** Aplicar el endurecimiento acordado en código runtime y validar que throttling e inventario mantienen su comportamiento actual.
**Affected areas:**
- `inventory-api/src/lib/throttle-store.js`
- `inventory-api/src/services/inventory.service.js`
- `inventory-api/tests/throttle-store.test.js`
- pruebas nuevas o ajustadas de inventario/locking
**Dependencies:**
- TASK-002
**Related requirements:**
- FR-002
- NFR-001
- NFR-002
- AC-001
- AC-005
**Implementation notes:**
- Mantener el cambio pequeño y localizado.
- Añadir pruebas para cualquier helper o allowlist nuevo.
- Evitar refactorización amplia de servicios/repositorios.
**Tests:**
- `tests/throttle-store.test.js`
- pruebas de inventario relacionadas con advisory lock
- regresión manual mínima sobre rutas dependientes
**Acceptance criteria:**
- [ ] El runtime ya no depende de `RawUnsafe` no gobernado en superficies productivas priorizadas.
- [ ] Las pruebas relevantes siguen pasando.
- [ ] No se observan cambios funcionales no deseados en throttling o inventario.

## TASK-004: Caracterizar fallos parciales en documentos privados de cliente
**Status:** Completed
**Completed at:** 2026-07-22
**Implemented files:**
- `inventory-api/tests/client-document-security.test.js`
**Validation evidence:**
- `node --test tests/client-document-security.test.js`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test -- --silent`
**Objective:** Cubrir con pruebas los escenarios de fallo parcial DB/filesystem del flujo de documentos privados de cliente.
**Affected areas:**
- `inventory-api/src/services/client.service.js`
- `inventory-api/tests/client-document-security.test.js`
- posible test nuevo dedicado a partial failures de cliente
**Dependencies:**
- None
**Related requirements:**
- FR-003
- BR-003
- AC-002
**Implementation notes:**
- Simular al menos: fallo de escritura de archivo, fallo de cleanup DB tras fallo de escritura, y fallo de update final si se endurece el flujo.
- Verificar mensajes/error codes y estado esperado de artefactos.
- Documentar claramente si algún comportamiento actual es defectuoso pero preservado inicialmente.
**Tests:**
- `tests/client-document-security.test.js`
- prueba nueva de rollback/cleanup si se separa
**Acceptance criteria:**
- [ ] Los escenarios críticos de fallo parcial del flujo de cliente están cubiertos.
- [ ] Cada prueba declara el resultado esperado sobre DB y filesystem.
- [ ] La suite permite detectar regresiones de cleanup/rollback.

## TASK-005: Caracterizar fallos parciales en comprobantes privados de pago
**Status:** Completed
**Completed at:** 2026-07-22
**Implemented files:**
- `inventory-api/tests/payment-receipt-security.test.js`
**Validation evidence:**
- `node --test tests/payment-receipt-security.test.js`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test -- --silent`
**Objective:** Cubrir con pruebas los escenarios de fallo parcial DB/filesystem del flujo de comprobantes de pago.
**Affected areas:**
- `inventory-api/src/services/payment.service.js`
- `inventory-api/src/services/payment-receipt-evidence.service.js`
- `inventory-api/tests/payment-receipt-security.test.js`
- posible test nuevo dedicado a partial failures de pagos
**Dependencies:**
- None
**Related requirements:**
- FR-003
- BR-003
- AC-002
**Implementation notes:**
- Simular al menos: fallo DB después de guardar archivo, cleanup exitoso del archivo, cleanup fallido best-effort y efecto sobre el pago creado.
- Cubrir también replace/update de evidencia si aplica.
- Alinear expectativas con el comportamiento actual o con el endurecimiento acordado.
**Tests:**
- `tests/payment-receipt-security.test.js`
- pruebas nuevas de `payment-receipt-evidence.service`
**Acceptance criteria:**
- [ ] Los fallos parciales críticos de comprobantes están caracterizados.
- [ ] Se valida el comportamiento de compensación/cleanup.
- [ ] Las pruebas hacen visible cualquier orfandad residual aceptada o no aceptada.

## TASK-006: Medir endpoints pesados y crear baseline gobernada
**Status:** Completed
**Completed at:** 2026-07-22
**Implemented files:**
- `inventory-api/src/lib/heavy-endpoint-governance.js`
- `inventory-api/src/middlewares/heavy-endpoint-metrics.js`
- `inventory-api/src/lib/logging.js`
- `inventory-api/src/app.js`
- `inventory-api/docs/heavy-endpoints-baseline.json`
- `inventory-api/docs/heavy-endpoints-baseline.md`
- `inventory-api/tests/heavy-endpoint-governance.test.js`
- `inventory-api/tests/logging.test.js`
**Validation evidence:**
- `node --test tests/heavy-endpoint-governance.test.js tests/logging.test.js`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test -- --silent`
**Objective:** Incorporar medición factual y artefacto versionado para endpoints pesados priorizados.
**Affected areas:**
- `inventory-api/src/lib/logging.js`
- `inventory-api/src/app.js`
- `inventory-api/docs/` artefacto baseline de endpoints pesados
- tests/scripts nuevos de medición y drift
- endpoints priorizados en `inventory-api/src/routes/agent.routes.js`, `inventory-api/src/routes/client.routes.js`, `inventory-api/src/routes/invoice.routes.js`, `inventory-api/src/routes/payment.routes.js`, `inventory-api/src/routes/inventory.routes.js`, `inventory-api/src/routes/product.routes.js`
**Dependencies:**
- TASK-001
**Related requirements:**
- FR-004
- FR-005
- FR-007
- NFR-004
- AC-003
**Implementation notes:**
- Priorizar estos endpoints iniciales: `GET /api/agent/stores`, `GET /api/agent/stores/:storeId`, `GET /api/clients`, `GET /api/clients/company`, `GET /api/invoices/inconsistencies`, `GET /api/inventory/stocks`, `GET /api/payments` y `POST /api/products/import`.
- Capturar métricas agregadas, no cuerpos sensibles.
- Definir cómo generar baseline reproducible con fixtures/stubs o datos controlados.
- La primera fase debe detectar drift, no imponer budgets rígidos todavía.
**Tests:**
- pruebas de logging/metrics
- script/test de baseline de endpoints pesados
- validación manual del artefacto generado
**Acceptance criteria:**
- [ ] Existe un conjunto explícito de endpoints pesados priorizados.
- [ ] Se generan datos versionados de latencia/tamaño/respuesta o equivalente lógico.
- [ ] Hay validación de drift para cambios relevantes en esos endpoints.

## TASK-007: Formalizar el alcance contractual entre runtime y OpenAPI parcial
**Status:** Completed
**Completed at:** 2026-07-22
**Implemented files:**
- `inventory-api/docs/openapi/runtime-baseline.openapi.json`
- `inventory-api/docs/runtime-contract-manifest.json`
- `inventory-api/docs/runtime-endpoint-catalog.md`
- `inventory-api/tests/openapi-contract-consistency.test.js`
- `inventory-api/tests/runtime-contract-governance.test.js`
**Validation evidence:**
- `node --test tests/openapi-contract-consistency.test.js tests/runtime-contract-governance.test.js`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test -- --silent`
**Objective:** Definir y versionar la clasificación contractual de todas las rutas montadas respecto al OpenAPI factual parcial.
**Affected areas:**
- `inventory-api/docs/openapi/runtime-baseline.openapi.json`
- manifiesto contractual nuevo bajo `inventory-api/docs/` si aplica
- `inventory-api/src/app.js`
- `inventory-api/src/routes/*.routes.js`
**Dependencies:**
- TASK-001
**Related requirements:**
- FR-006
- FR-007
- BR-001
- BR-002
- AC-004
**Implementation notes:**
- Mantener OpenAPI factual y parcial como contrato de lo cubierto.
- Toda ruta montada debe quedar clasificada en un manifiesto complementario como cubierta o excluida con razón.
- Preservar metadata de compatibilidad legacy ya existente.
**Tests:**
- ampliación de `tests/openapi-contract-consistency.test.js`
- test nuevo de clasificación exhaustiva del runtime
**Acceptance criteria:**
- [ ] Existe una clasificación contractual exhaustiva de rutas montadas.
- [ ] Las exclusiones están justificadas y son explícitas.
- [ ] OpenAPI sigue siendo factual, no aspiracional.

## TASK-008: Consolidar documentación y evidencia P7 para auditoría
**Status:** Completed
**Completed at:** 2026-07-22
**Implemented files:**
- `inventory-api/README.md`
- `inventory-api/docs/p7-risk-closure-evidence.md`
- `inventory-api/tests/p7-risk-closure-evidence.test.js`
- `specs/p7-9-5-risk-closure/tasks.md`
- `specs/p7-9-5-risk-closure/traceability.md`
- `specs/p7-9-5-risk-closure/implementation-report.md`
- `CHANGELOG.md`
**Validation evidence:**
- `node --test tests/p7-risk-closure-evidence.test.js tests/openapi-contract-consistency.test.js tests/runtime-contract-governance.test.js tests/heavy-endpoint-governance.test.js tests/logging.test.js`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test -- --silent`
**Objective:** Dejar evidencia final trazable para revisión humana y futura re-auditoría 9.5.
**Affected areas:**
- `inventory-api/README.md`
- `inventory-api/docs/*` o artefacto P7 equivalente
- `inventory-api/docs/openapi/*`
- baseline de endpoints pesados
- documentación/spec P7
**Dependencies:**
- TASK-003
- TASK-004
- TASK-005
- TASK-006
- TASK-007
**Related requirements:**
- FR-005
- FR-006
- FR-007
- AC-005
**Implementation notes:**
- Resumir qué riesgos quedaron cerrados, cuáles siguen abiertos y con qué evidencia.
- Incluir instrucciones de ejecución para pruebas y validadores nuevos.
- Asegurar consistencia entre README, docs y resultados de tests.
**Tests:**
- Ejecución completa de la suite relevante
- Revisión manual de trazabilidad documental
**Acceptance criteria:**
- [ ] La evidencia P7 queda centralizada y auditable.
- [ ] Las instrucciones de validación son claras para otro agente o revisor.
- [ ] La documentación refleja exactamente el comportamiento implementado.