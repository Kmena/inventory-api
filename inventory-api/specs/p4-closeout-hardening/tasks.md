# Implementation Tasks
## TASK-001: Consolidar el paquete canónico de cierre P4
**Status:** Completed
**Completed at:** 2026-07-21
**Implemented files:**
- specs/p4-closeout-hardening/implementation-report.md
- specs/p4-closeout-hardening/tasks.md
- specs/p4-closeout-hardening/traceability.md
- ../CHANGELOG.md
**Validation evidence:**
- Manual directory verification of `specs/p4-closeout-hardening/`
- npm run typecheck
- npm run lint
- npm test -- --silent
- node src/server.js

**Objective:** Dejar versionado el paquete de especificación `p4-*` que actuará como fuente canónica del cierre.
**Affected areas:**
- `specs/p4-closeout-hardening/requirements.md`
- `specs/p4-closeout-hardening/current-state.md`
- `specs/p4-closeout-hardening/architecture.md`
- `specs/p4-closeout-hardening/implementation-plan.md`
- `specs/p4-closeout-hardening/tasks.md`
**Dependencies:**
- None
**Implementation notes:**
- El nombre canónico aprobado para el paquete es `p4-closeout-hardening`.
- Mantener trazabilidad entre requisitos, arquitectura, plan y tareas.
- Related requirements:
  - FR-001
  - AC-006
**Tests:**
- Manual verification of directory structure
- Manual review of traceability completeness
**Acceptance criteria:**
- [x] Existe un directorio `specs/p4-closeout-hardening/` con los 5 documentos requeridos.
- [x] Los documentos describen el cierre solicitado sin depender de artefactos externos ausentes.
- [x] La trazabilidad básica entre requisitos, plan y tareas está presente.

## TASK-002: Corregir referencias documentales rotas de P4 y P3
**Status:** Completed
**Completed at:** 2026-07-21
**Implemented files:**
- docs/architecture.md
- docs/runtime-scope-baseline.md
- docs/audit/current-code-audit.md
- docs/audit/current-code-audit.html
- specs/p4-closeout-hardening/current-state.md
- specs/p4-closeout-hardening/implementation-report.md
- specs/p4-closeout-hardening/tasks.md
- specs/p4-closeout-hardening/traceability.md
- ../CHANGELOG.md
**Validation evidence:**
- findstr /n /s /i "p4-audit-hardening p3-access-scope-hardening p4-runtime-surface-hardening" docs\*
- npm run typecheck
- npm run lint
- npm run build

**Objective:** Alinear la documentación activa para que no apunte a specs inexistentes y use una única referencia canónica para P4.
**Objective:** Alinear la documentación activa para que no apunte a specs inexistentes y use una única referencia canónica para P4.
**Affected areas:**
- `docs/architecture.md`
- `docs/runtime-scope-baseline.md`
- `docs/audit/current-code-audit.md`
- `docs/audit/current-code-audit.html`
- otros `docs/*` versionados que contengan referencias activas a `specs/p3-*` o `specs/p4-*`
**Dependencies:**
- TASK-001
**Implementation notes:**
- Reemplazar referencias a `specs/p4-runtime-surface-hardening` por el paquete canónico aprobado o declarar explícitamente una nota de sustitución.
- Eliminar o sustituir la referencia rota a `specs/p3-access-scope-hardening/current-state.md`.
- Corregir también artefactos derivados versionados que sigan distribuyéndose en el repositorio, incluyendo HTML de auditoría si mantienen referencias rotas.
- Related requirements:
  - FR-002
  - FR-008
  - BR-001
  - BR-007
  - AC-001
  - AC-007
**Tests:**
- Manual link verification
- Optional documentation grep check for `specs/p3-` and stale `specs/p4-` references
**Acceptance criteria:**
- [x] `docs/architecture.md` apunta a archivos existentes.
- [x] `docs/runtime-scope-baseline.md` ya no referencia specs inexistentes.
- [x] El nombre de paquete P4 queda unificado en la documentación activa y derivada versionada.

## TASK-003: Sustituir cálculos monetarios derivados inseguros por utilidades decimales
**Status:** Completed
**Completed at:** 2026-07-21
**Implemented files:**
- src/lib/money.js
- src/services/invoice-financial-state.js
- src/services/payment.service.js
- tests/invoice-payment-sync-characterization.test.js
- tests/money.test.js
- specs/p4-closeout-hardening/current-state.md
- specs/p4-closeout-hardening/implementation-report.md
- specs/p4-closeout-hardening/tasks.md
- specs/p4-closeout-hardening/traceability.md
**Validation evidence:**
- node --test tests/money.test.js tests/invoice-payment-sync-characterization.test.js tests/client-document-governance.test.js tests/payment-receipt-security.test.js tests/throttle-store.test.js
- npm run lint
- npm run typecheck
- npm test -- --silent

**Follow-up hardening completed at:** 2026-07-21
**Follow-up implemented files:**
- src/lib/throttle-store.js
- src/lib/sensitive-file-governance.js
- src/middlewares/login-throttle.js
- src/middlewares/request-throttle.js
- src/services/client.service.js
- src/services/payment.service.js
- src/services/invoice-financial-state.js
- src/services/invoice.service.js
- src/services/agent-workspace.service.js
- src/schemas/payment.schema.js
- src/schemas/client.schema.js
- tests/money.test.js
- tests/invoice-payment-sync-characterization.test.js
- tests/payment-receipt-security.test.js
- tests/client-document-governance.test.js
- tests/client-document-schema-governance.test.js
- tests/throttle-store.test.js
**Objective:** Eliminar el uso inseguro de `Number` en cálculos críticos de montos derivados y validación de sobrepago.
**Affected areas:**
- `src/lib/money.js` o equivalente
- `src/services/invoice-financial-state.js`
- `src/services/payment.service.js`
- posiblemente `src/services/agent-workspace.service.js`
- `tests/invoice-payment-sync-characterization.test.js`
- nuevas pruebas monetarias en `tests/`
**Dependencies:**
- TASK-001
**Implementation notes:**
- Reutilizar `Decimal` expuesto por Prisma en vez de agregar dependencias nuevas, salvo necesidad justificada.
- Preservar redondeo a 2 decimales en montos monetarios.
- Revisar explícitamente `getAppliedAmount`, `getPendingAmount`, `getPaidAtFromApprovedPayments` y `assertNoApprovalOverpayment`.
- Related requirements:
  - FR-003
  - FR-007
  - BR-002
  - AC-002
**Tests:**
- Unit tests for decimal helper
- Regression tests for invoice/payment synchronization
- Edge cases for exact decimal addition and overpayment boundaries
**Acceptance criteria:**
- [x] Los cálculos monetarios críticos ya no dependen de sumas/comparaciones intermedias en `Number`.
- [x] La validación de sobrepago usa comparación decimal explícita.
- [x] Las pruebas de regresión financieras permanecen verdes.

## TASK-004: Centralizar la política de autorización y documentar fronteras por rol/permisos
**Status:** Completed
**Completed at:** 2026-07-21
**Implemented files:**
- src/security/access-policies.js
- src/routes/company.routes.js
- src/routes/payment.routes.js
- src/routes/product.routes.js
- src/routes/order.routes.js
- src/routes/inventory.routes.js
- src/routes/user.routes.js
- tests/access-policies.test.js
- tests/administrative-authorization-characterization.test.js
- tests/company-authorization-characterization.test.js
- tests/public-surface-characterization.test.js
- tests/payload-segmentation-characterization.test.js
- specs/p4-closeout-hardening/current-state.md
- specs/p4-closeout-hardening/implementation-report.md
- specs/p4-closeout-hardening/tasks.md
- specs/p4-closeout-hardening/traceability.md
**Validation evidence:**
- node --test tests/access-policies.test.js tests/administrative-authorization-characterization.test.js tests/company-authorization-characterization.test.js
- npm run lint
- npm run typecheck
- npm test -- --silent

**Follow-up hardening completed at:** 2026-07-21
**Follow-up implemented files:**
- src/security/access-policies.js
- src/routes/client.routes.js
- src/routes/geocoding.routes.js
- src/routes/taxpayer.routes.js
- tests/access-policies.test.js
- tests/payload-segmentation-characterization.test.js
**Objective:** Hacer explícita y comprobable la gobernanza de acceso sin cambiar la semántica efectiva aprobada.
**Affected areas:**
- `src/security/access-policies.js` o equivalente
- `src/middlewares/authorize.js`
- `src/middlewares/authorizePermission.js`
- `src/routes/company.routes.js`
- `src/routes/user.routes.js`
- `src/routes/order.routes.js`
- `src/routes/payment.routes.js`
- `src/routes/product.routes.js`
- `src/routes/inventory.routes.js`
- pruebas de autorización en `tests/`
**Dependencies:**
- TASK-001
**Implementation notes:**
- No reescribir todo RBAC; centralizar primero la definición.
- Mantener compatibilidad con endpoints root/globales y administrativos legados.
- Planificar una migración progresiva hacia permisos en superficies operativas, sin expansión accidental de acceso.
- Justificar cualquier endpoint que permanezca híbrido.
- Related requirements:
  - FR-004
  - FR-007
  - BR-003
  - BR-004
  - AC-003
**Tests:**
- Existing authorization characterization tests
- New tests for policy mapping or guard wrappers
- Manual review of endpoint-to-policy inventory
**Acceptance criteria:**
- [x] Existe una fuente central que identifica la regla de acceso por dominio o endpoint.
- [x] Los endpoints en transición progresiva hacia permisos quedan identificados.
- [x] Las pruebas de autorización actuales siguen pasando.
- [x] No se amplía el acceso efectivo respecto al baseline actual.

## TASK-005: Reemplazar el script manual de pruebas por descubrimiento automático
**Status:** Completed
**Completed at:** 2026-07-21
**Implemented files:**
- package.json
- scripts/run-tests.js
- tests/access-policies.test.js
- tests/money.test.js
- specs/p4-closeout-hardening/current-state.md
- specs/p4-closeout-hardening/implementation-report.md
- specs/p4-closeout-hardening/tasks.md
- specs/p4-closeout-hardening/traceability.md
**Validation evidence:**
- npm test -- --silent
- npm run lint
- npm run typecheck
- npm run build
**Objective:** Garantizar que toda nueva prueba compatible bajo `tests/` sea ejecutada por el comando estándar sin mantenimiento manual.
**Affected areas:**
- `package.json`
- opcionalmente `scripts/run-tests.js`
- `tests/`
**Dependencies:**
- TASK-001
**Implementation notes:**
- Priorizar una solución portable para Node 20 en Windows/Linux.
- Si se usa script propio, mantenerlo pequeño y determinista.
- Verificar que el runner preserve salida y códigos de error útiles para CI.
- Related requirements:
  - FR-006
  - FR-007
  - BR-005
  - AC-005
**Tests:**
- Full test suite execution
- Verification with a newly added test file
**Acceptance criteria:**
- [x] `npm test` ya no depende de una lista manual de archivos.
- [x] Una prueba nueva bajo `tests/` es detectada automáticamente.
- [x] La suite actual sigue ejecutándose correctamente.

## TASK-006: Versionar un workflow mínimo de quality gates
**Status:** Completed
**Completed at:** 2026-07-21
**Implemented files:**
- .github/workflows/quality-gates.yml
- README.md
- specs/p4-closeout-hardening/current-state.md
- specs/p4-closeout-hardening/implementation-report.md
- specs/p4-closeout-hardening/tasks.md
- specs/p4-closeout-hardening/traceability.md
- ../CHANGELOG.md
**Validation evidence:**
- npm run verify
- npm run build
- npm run typecheck
- npm run lint
- Manual static review of `.github/workflows/quality-gates.yml`
- Attempted local YAML parser validation via Python/Ruby/PowerShell built-ins (not available in environment)
**Objective:** Incorporar una automatización CI reproducible desde el repositorio para validar calidad básica en cada cambio.
**Affected areas:**
- `.github/workflows/quality-gates.yml`
- opcionalmente `README.md`
- opcionalmente `docs/production-baseline.md`
**Dependencies:**
- TASK-005
**Implementation notes:**
- Ejecutar al menos `npm ci`, `npm run build`/`prisma generate` y `npm run verify`.
- No asumir secretos ni despliegue productivo.
- Si CD queda fuera, documentarlo explícitamente.
- Related requirements:
  - FR-005
  - FR-007
  - BR-006
  - AC-004
**Tests:**
- Static YAML validation
- Local equivalent run of CI commands
**Acceptance criteria:**
- [x] Existe un workflow versionado bajo `.github/workflows/`.
- [x] El workflow ejecuta los gates mínimos acordados.
- [x] La automatización no depende de secretos no documentados para el baseline de CI.

## TASK-007: Versionar un CD parcial de build y publicación sin deploy
**Status:** Completed
**Completed at:** 2026-07-21
**Implemented files:**
- .github/workflows/build-and-publish.yml
- README.md
- docs/production-baseline.md
- specs/p4-closeout-hardening/current-state.md
- specs/p4-closeout-hardening/implementation-report.md
- specs/p4-closeout-hardening/tasks.md
- specs/p4-closeout-hardening/traceability.md
- ../CHANGELOG.md
**Validation evidence:**
- npm run verify
- Controlled local dry run of Docker build/version/package without deploy
- Manual static review of `.github/workflows/build-and-publish.yml`
**Objective:** Incorporar un workflow de release controlado que construya, versione y publique artefactos o imágenes sin realizar despliegue automático a ambientes.
**Affected areas:**
- `.github/workflows/build-and-publish.yml` o equivalente
- opcionalmente `README.md`
- opcionalmente `docs/production-baseline.md`
**Dependencies:**
- TASK-006
**Implementation notes:**
- El workflow debe usar triggers controlados: tag, disparo manual o ambos.
- Debe poder construir artefactos reproducibles y/o imagen Docker versionada.
- Si se publica a registry, documentar claramente prerequisitos y secretos requeridos; el flujo no debe incluir deploy.
- Related requirements:
  - FR-007
  - FR-009
  - BR-006
  - BR-008
  - BR-009
  - AC-008
  - AC-009
**Tests:**
- Static YAML validation
- Manual review of workflow triggers and publication guards
- Controlled build/publication dry run when environment allows
**Acceptance criteria:**
- [x] Existe un workflow versionado de build/publicación.
- [x] El workflow construye y versiona artefactos o imágenes sin ejecutar deploy.
- [x] Los triggers y guardrails de publicación quedan documentados claramente.
