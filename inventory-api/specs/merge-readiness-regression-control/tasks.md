# Implementation Tasks
## TASK-001: Consolidar baseline e insumos obligatorios
**Status:** Completed
**Completed at:** 2026-03-08
**Revalidated at:** 2025-08-16
**Implemented files:**
- docs/prisma-windows-stability-evidence.md
- docs/current-state.md
- docs/architecture.md
- specs/merge-readiness-regression-control/tasks.md
- specs/merge-readiness-regression-control/traceability.md
- specs/merge-readiness-regression-control/changelog.md
- specs/merge-readiness-regression-control/implementation-report.md
**Validation evidence:**
- node --test tests/prisma-windows-build-stabilization.test.js
- node --test tests/workflow-baseline-characterization.test.js
- npm run validate:workflow-baseline
- npm run lint
- npm run typecheck
**Objective:** Confirmar las fuentes reales del baseline y registrar artefactos faltantes antes de cualquier automatización o guía adicional.
**Affected areas:**
- specs/merge-readiness-regression-control/current-state.md
- specs/merge-readiness-regression-control/decisions.md
- specs/merge-readiness-regression-control/risks.md
**Dependencies:**
- None
**Implementation notes:**
- Verificar el uso de `inventory-api/docs/audit/current-code-audit.md` como baseline local efectivo y conservar `../docs/audit/current-code-audit.md` como evidencia histórica de apoyo.
- Registrar que `inventory-api/.github/workflows/` está vacío en el estado inspeccionado, mientras `scripts/validate-workflow-baseline.js` resuelve workflows desde el root hospedado padre.
- No asumir disponibilidad de diff del PR.
**Tests:**
- Manual verification of referenced files
**Acceptance criteria:**
- [x] Todas las fuentes usadas por el plan están confirmadas o marcadas como faltantes.
- [x] Los bloqueos por falta de diff o workflows quedan documentados.
- [x] No se inventa evidencia inexistente.
**Related requirements:**
- FR-001
- FR-013

## TASK-002: Definir mapa de impacto del PR y heurística de riesgo
**Status:** Completed
**Completed at:** 2026-03-08
**Revalidated at:** 2025-08-16
**Implemented files:**
- scripts/prisma-generate-safe-lib.js
- README.md
- docs/prisma-windows-stability-evidence.md
- docs/current-state.md
- docs/architecture.md
- tests/prisma-windows-build-stabilization.test.js
- specs/merge-readiness-regression-control/tasks.md
- specs/merge-readiness-regression-control/traceability.md
- specs/merge-readiness-regression-control/changelog.md
- specs/merge-readiness-regression-control/implementation-report.md
**Validation evidence:**
- node --test tests/prisma-windows-build-stabilization.test.js
- npm run validate:workflow-baseline
- npm run lint
- npm run typecheck
**Objective:** Establecer el procedimiento para congelar el alcance exacto del PR y clasificar riesgo bajo/medio/alto.
**Affected areas:**
- specs/merge-readiness-regression-control/architecture.md
- specs/merge-readiness-regression-control/traceability.md
**Dependencies:**
- TASK-001
**Implementation notes:**
- Mapear changed files -> módulos -> rutas/endpoints -> contratos -> hotspots.
- Incluir detección explícita de `inventory.service.js`, `agent-workspace.service.js`, `product.service.js`, `access-policies.js`, `src/public/root/**`, `src/public/styles.css`.
- Bloquear salida exacta si el diff no está disponible.
**Tests:**
- Manual verification with sample PR diff or changed-file list
**Acceptance criteria:**
- [x] Existe criterio documentado para riesgo bajo/medio/alto.
- [x] Los hotspots baseline quedan incluidos en la heurística.
- [x] El procedimiento distingue impacto confirmado vs no disponible por falta de diff.
**Related requirements:**
- FR-001
- FR-005
- FR-013

## TASK-003: Definir checklist obligatorio de pre-merge
**Status:** Completed
**Completed at:** 2026-03-08
**Revalidated at:** 2025-08-16
**Implemented files:**
- src/security/access-policy-actor-scope.js
- src/security/access-policy-registry.js
- src/routes/agent.routes.js
- tests/access-policies.test.js
- tests/authorization-convergence-characterization.test.js
- docs/current-state.md
- docs/architecture.md
- specs/merge-readiness-regression-control/tasks.md
- specs/merge-readiness-regression-control/traceability.md
- specs/merge-readiness-regression-control/changelog.md
- specs/merge-readiness-regression-control/implementation-report.md
**Validation evidence:**
- node --test tests/access-policies.test.js
- node --test tests/authorization-convergence-characterization.test.js
- npm run lint
- npm run typecheck
**Objective:** Establecer validaciones mínimas y ampliadas trazadas al diff real del PR.
**Affected areas:**
- specs/merge-readiness-regression-control/architecture.md
- specs/merge-readiness-regression-control/tasks.md
**Dependencies:**
- TASK-001
- TASK-002
**Implementation notes:**
- Mínimas: `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test`.
- Ampliadas según superficie: `npm run lint:public-runtime`, `npm run validate:public-runtime`, `npm run validate:workflow-baseline` y tests específicos.
- Validar que los comandos existan realmente en `package.json`.
**Tests:**
- Manual verification against package.json
**Acceptance criteria:**
- [x] El checklist separa mínimo vs ampliado.
- [x] Cada comando referenciado existe o se documenta como ejecución directa de test.
- [x] La selección queda condicionada a archivos modificados.
**Related requirements:**
- FR-002
- FR-012

## TASK-004: Definir matriz de autorización por endpoint afectado
**Status:** Completed
**Completed at:** 2026-03-08
**Revalidated at:** 2025-08-16
**Implemented files:**
- specs/merge-readiness-regression-control/architecture.md
- specs/merge-readiness-regression-control/current-state.md
- specs/merge-readiness-regression-control/risks.md
- specs/merge-readiness-regression-control/tasks.md
- specs/merge-readiness-regression-control/traceability.md
- specs/merge-readiness-regression-control/changelog.md
- specs/merge-readiness-regression-control/implementation-report.md
**Validation evidence:**
- Manual review against src/middlewares/authenticate.js
- Manual review against src/middlewares/authorize.js
- Manual review against src/middlewares/authorizePermission.js
- Manual review against src/security/access-policies.js
- Manual review against src/security/access-policy-registry.js
- Manual review against src/routes/company.routes.js
- Manual review against src/routes/role.routes.js
- Manual review against src/routes/payment.routes.js
- Manual review against src/routes/inventory.routes.js
- Manual review against src/routes/agent.routes.js
- Manual review against src/services/payment.service.js
- Manual review against src/services/agent-workspace.service.js
- set BROWSER_SESSION_STORE_MODE=memory&& node --test tests/access-policies.test.js
- set BROWSER_SESSION_STORE_MODE=memory&& node --test tests/authorization-convergence-characterization.test.js
- npm run lint
- npm run typecheck
- npm run build
**Objective:** Formalizar cómo se documenta ownership de autorización para cada endpoint tocado.
**Affected areas:**
- specs/merge-readiness-regression-control/architecture.md
- specs/merge-readiness-regression-control/traceability.md
**Dependencies:**
- TASK-001
- TASK-002
**Implementation notes:**
- Registrar middleware `authenticate`, `authorize`, `authorizePermission`, `authorizeAccessPolicy`.
- Registrar policy/roles/permisos y checks de servicio adicionales.
- Incluir tenancy scope esperado.
- Tener en cuenta que `src/routes/agent.routes.js` depende fuertemente de service checks.
**Tests:**
- Manual review against auth middleware, access-policies.js, route files and affected services
**Acceptance criteria:**
- [x] Ningún endpoint modificado queda sin dueño de autorización documentado.
- [x] Se diferencia seguridad en ruta, middleware o servicio.
- [x] Se documenta tenancy scope esperado por endpoint.
**Related requirements:**
- FR-003

## TASK-005: Definir plan de characterization tests para autorización
**Status:** Completed
**Completed at:** 2026-03-08
**Implemented files:**
- specs/merge-readiness-regression-control/architecture.md
- specs/merge-readiness-regression-control/tasks.md
- specs/merge-readiness-regression-control/traceability.md
- specs/merge-readiness-regression-control/changelog.md
- specs/merge-readiness-regression-control/implementation-report.md
**Validation evidence:**
- Manual review against tests/auth-hardening-characterization.test.js
- Manual review against tests/browser-session-auth-boundary.test.js
- Manual review against tests/administrative-authorization-characterization.test.js
- Manual review against tests/company-authorization-characterization.test.js
- Manual review against tests/authorization-convergence-characterization.test.js
- npm run lint
- npm run typecheck
- npm run build
**Objective:** Activar una red de seguridad cuando el diff toque seguridad, auth middleware, rutas protegidas o checks de actor/tenant.
**Affected areas:**
- specs/merge-readiness-regression-control/tasks.md
- specs/merge-readiness-regression-control/architecture.md
**Dependencies:**
- TASK-003
- TASK-004
**Implementation notes:**
- Incluir acceso permitido, acceso denegado, tenant scope, actor scope, respuestas 401/403/404.
- Priorizar tests existentes de auth/authorization antes de proponer nuevos.
**Tests:**
- tests/auth-hardening-characterization.test.js
- tests/browser-session-auth-boundary.test.js
- tests/administrative-authorization-characterization.test.js
- tests/company-authorization-characterization.test.js
- tests/authorization-convergence-characterization.test.js
**Acceptance criteria:**
- [x] Existe criterio explícito de activación.
- [x] La lista cubre casos permitidos y denegados.
- [x] Se reutilizan primero los tests ya existentes en el repositorio.
**Related requirements:**
- FR-004
- FR-012

## TASK-006: Crear mapa de riesgo por hotspots
**Status:** Completed
**Completed at:** 2026-03-08
**Implemented files:**
- specs/merge-readiness-regression-control/risks.md
- specs/merge-readiness-regression-control/tasks.md
- specs/merge-readiness-regression-control/traceability.md
- specs/merge-readiness-regression-control/changelog.md
- specs/merge-readiness-regression-control/implementation-report.md
**Validation evidence:**
- Manual review of hotspot-to-test mapping in specs/merge-readiness-regression-control/risks.md
- Manual review against specs/merge-readiness-regression-control/architecture.md hotspot set
- Manual review against specs/merge-readiness-regression-control/current-state.md hotspot descriptions
- npm run lint
- npm run typecheck
- npm run build
**Objective:** Definir para cada hotspot tocado el riesgo funcional, de acoplamiento y el set mínimo/ampliado de pruebas.
**Affected areas:**
- specs/merge-readiness-regression-control/risks.md
- specs/merge-readiness-regression-control/tasks.md
**Dependencies:**
- TASK-002
- TASK-003
**Implementation notes:**
- Si un hotspot no es tocado por el diff, debe quedar fuera del alcance.
- Incluir hotspots backend y UI root shell.
**Tests:**
- Manual review of hotspot-to-test mapping
**Acceptance criteria:**
- [x] Cada hotspot tiene riesgo funcional y de acoplamiento documentados.
- [x] Cada hotspot tiene pruebas mínimas y recomendadas.
- [x] Los hotspots no tocados no se expanden innecesariamente.
**Related requirements:**
- FR-005
- FR-012

## TASK-007: Definir estrategia de cambios seguros en servicios grandes
**Status:** Completed
**Completed at:** 2026-03-08
**Implemented files:**
- specs/merge-readiness-regression-control/architecture.md
- specs/merge-readiness-regression-control/decisions.md
- specs/merge-readiness-regression-control/tasks.md
- specs/merge-readiness-regression-control/traceability.md
- specs/merge-readiness-regression-control/changelog.md
- specs/merge-readiness-regression-control/implementation-report.md
**Validation evidence:**
- Manual review of large-service fragmentation rules in specs/merge-readiness-regression-control/architecture.md
- Manual review against specs/merge-readiness-regression-control/risks.md hotspot map
- Manual review against specs/merge-readiness-regression-control/requirements.md FR-006
- npm run lint
- npm run typecheck
- npm run build
**Objective:** Evitar propuestas de cambios masivos en servicios grandes sin characterization y sin fragmentación revisable.
**Affected areas:**
- specs/merge-readiness-regression-control/architecture.md
- specs/merge-readiness-regression-control/decisions.md
**Dependencies:**
- TASK-006
**Implementation notes:**
- Aplicar reglas: cambios pequeños, preservar comportamiento, characterization antes que reinterpretación, no mezclar cambios funcionales y estructurales.
- Fragmentar por caso de uso y asociar una validación por fragmento.
**Tests:**
- Manual review of task granularity
**Acceptance criteria:**
- [x] La estrategia prohíbe cambios masivos no justificados en servicios grandes.
- [x] Cada fragmento de cambio tiene validación asociada.
- [x] La guía es aplicable a inventory, agent-workspace y product service.
**Related requirements:**
- FR-006

## TASK-008: Definir clasificación de impacto contractual
**Status:** Completed
**Completed at:** 2026-03-08
**Implemented files:**
- specs/merge-readiness-regression-control/architecture.md
- specs/merge-readiness-regression-control/tasks.md
- specs/merge-readiness-regression-control/traceability.md
- specs/merge-readiness-regression-control/changelog.md
- specs/merge-readiness-regression-control/implementation-report.md
**Validation evidence:**
- Manual review of contract-classification rules in specs/merge-readiness-regression-control/architecture.md
- Manual review against docs/runtime-endpoint-catalog.md
- Manual review against docs/runtime-contract-manifest.json
- Manual review against docs/critical-contract-matrix.json
- node --test tests/openapi-contract-consistency.test.js
- node --test tests/runtime-contract-governance.test.js
- npm run lint
- npm run typecheck
- npm run build
**Objective:** Formalizar cómo decidir si un cambio es no contractual, contractual interno u observable.
**Affected areas:**
- specs/merge-readiness-regression-control/architecture.md
- specs/merge-readiness-regression-control/traceability.md
**Dependencies:**
- TASK-002
**Implementation notes:**
- Usar runtime endpoint catalog, contract manifest, critical contract matrix y docs de estado/arquitectura actuales.
- Considerar también la UI embebida fuera de OpenAPI.
**Tests:**
- tests/openapi-contract-consistency.test.js
- tests/runtime-contract-governance.test.js
**Acceptance criteria:**
- [x] La clasificación contractual está definida con fuentes explícitas.
- [x] Se contempla OpenAPI y superficies runtime intencionalmente excluidas.
- [x] Se distinguen cambios internos y observables.
**Related requirements:**
- FR-007

## TASK-009: Definir sincronización documental obligatoria
**Status:** Completed
**Completed at:** 2026-03-08
**Implemented files:**
- specs/merge-readiness-regression-control/architecture.md
- specs/merge-readiness-regression-control/tasks.md
- specs/merge-readiness-regression-control/traceability.md
- specs/merge-readiness-regression-control/changelog.md
- specs/merge-readiness-regression-control/implementation-report.md
**Validation evidence:**
- Manual review of documentation-sync rules in specs/merge-readiness-regression-control/architecture.md
- node --test tests/governance-baseline-sync-guardrails.test.js
- node --test tests/openapi-contract-consistency.test.js
- npm run lint
- npm run typecheck
- npm run build
**Objective:** Precisar qué documentación debe actualizarse según la superficie tocada por el PR.
**Affected areas:**
- specs/merge-readiness-regression-control/tasks.md
- specs/merge-readiness-regression-control/traceability.md
**Dependencies:**
- TASK-008
**Implementation notes:**
- Considerar `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, OpenAPI/contract artifacts si aplica.
- No mezclar estado actual con estado futuro deseado.
**Tests:**
- tests/governance-baseline-sync-guardrails.test.js
- tests/openapi-contract-consistency.test.js
**Acceptance criteria:**
- [x] La guía indica exactamente qué docs cambian por tipo de cambio.
- [x] Los cambios observables exigen actualización documental.
- [x] La guía evita documentar como implementado lo que aún es roadmap.
**Related requirements:**
- FR-008
- FR-007

## TASK-010: Definir evaluación de flujos DB + filesystem
**Status:** Completed
**Completed at:** 2026-03-08
**Implemented files:**
- specs/merge-readiness-regression-control/architecture.md
- specs/merge-readiness-regression-control/risks.md
- specs/merge-readiness-regression-control/tasks.md
- specs/merge-readiness-regression-control/traceability.md
- specs/merge-readiness-regression-control/changelog.md
- specs/merge-readiness-regression-control/implementation-report.md
**Validation evidence:**
- Manual review of DB+filesystem rules in specs/merge-readiness-regression-control/architecture.md
- Manual review against src/services/client.service.js
- Manual review against src/services/payment.service.js
- Manual review against src/services/payment-receipt-evidence.service.js
- node --test tests/payment-receipt-security.test.js
- node --test tests/payment-tenant-scope.test.js
- node --test tests/client-document-security.test.js
- node --test tests/client-document-governance.test.js
- npm run lint
- npm run typecheck
- npm run build
**Objective:** Incorporar revisión obligatoria para documentos de clientes y comprobantes de pago u otros flujos equivalentes.
**Affected areas:**
- specs/merge-readiness-regression-control/architecture.md
- specs/merge-readiness-regression-control/risks.md
**Dependencies:**
- TASK-002
- TASK-003
**Implementation notes:**
- Documentar escrituras DB, escrituras disco, rollback y fallas parciales posibles.
- Basarse en `client.service.js`, `payment.service.js` y `payment-receipt-evidence.service.js`.
**Tests:**
- tests/payment-receipt-security.test.js
- tests/payment-tenant-scope.test.js
- tests/client-document-security.test.js
- tests/client-document-governance.test.js
**Acceptance criteria:**
- [x] Cada flujo sensible tiene matriz DB/disco/rollback/falla parcial.
- [x] El plan exige characterization o prueba de fallo parcial equivalente cuando aplique.
- [x] Se documenta si hace falta evidencia operativa adicional.
**Related requirements:**
- FR-009
- FR-012

## TASK-011: Definir revisión de listados y paginación sensibles
**Status:** Completed
**Completed at:** 2026-03-08
**Implemented files:**
- specs/merge-readiness-regression-control/architecture.md
- specs/merge-readiness-regression-control/risks.md
- specs/merge-readiness-regression-control/tasks.md
- specs/merge-readiness-regression-control/traceability.md
- specs/merge-readiness-regression-control/changelog.md
- specs/merge-readiness-regression-control/implementation-report.md
**Validation evidence:**
- Manual review against src/lib/pagination.js
- Manual review against src/lib/heavy-endpoint-governance.js
- Manual review against src/routes/client.routes.js
- Manual review against src/routes/payment.routes.js
- Manual review against src/routes/invoice.routes.js
- Manual review against src/routes/inventory.routes.js
- Manual review against src/routes/user.routes.js
- Manual review against src/routes/role.routes.js
- Manual review against src/routes/warehouse.routes.js
- Manual review against src/routes/agent.routes.js
- Manual review against src/services/client.service.js
- Manual review against src/services/payment.service.js
- Manual review against src/services/invoice.service.js
- Manual review against src/services/inventory.service.js
- Manual review against src/services/product.service.js
- Manual review against src/services/agent-workspace.service.js
- node --test tests/pagination.test.js
- node --test tests/heavy-endpoint-governance.test.js
- node --test tests/client-tenant-scope.test.js
- node --test tests/payment-tenant-scope.test.js
- node --test tests/invoice-tenant-scope.test.js
- node --test tests/inventory-alerts-tenant-scope.test.js
- node --test tests/agent-workspace-tenant-scope.test.js
- npm run lint
- npm run typecheck
- npm run build
**Objective:** Evitar cambios que agraven payloads o listados sensibles sin análisis de contrato consumidor.
**Affected areas:**
- specs/merge-readiness-regression-control/architecture.md
- specs/merge-readiness-regression-control/risks.md
**Dependencies:**
- TASK-002
- TASK-008
**Implementation notes:**
- Identificar endpoints modificados con o sin paginación.
- Registrar decisión: preservar contrato, endurecer en otro PR o bloquear.
**Tests:**
- Manual review against affected route/service list and pagination helper usage
**Acceptance criteria:**
- [x] El plan no cambia paginación sin analizar consumidores.
- [x] Los aumentos de payload en listados completos quedan marcados como riesgo.
- [x] Existe una decisión explícita por endpoint sensible afectado.
**Related requirements:**
- FR-010

## TASK-012: Definir gates de build multiplataforma y baseline operativo
**Status:** Completed
**Completed at:** 2026-03-08
**Implemented files:**
- specs/merge-readiness-regression-control/architecture.md
- specs/merge-readiness-regression-control/risks.md
- specs/merge-readiness-regression-control/decisions.md
- specs/merge-readiness-regression-control/tasks.md
- specs/merge-readiness-regression-control/traceability.md
- specs/merge-readiness-regression-control/changelog.md
- specs/merge-readiness-regression-control/implementation-report.md
**Validation evidence:**
- Manual review against docs/production-baseline.md
- Manual review against docs/audit/current-code-audit.md
- Manual review against package.json
- Manual review against scripts/validate-production-baseline.js
- Manual review against scripts/validate-restore-readiness.js
- Manual review against scripts/validate-operational-readiness.js
- Manual review against scripts/validate-workflow-baseline.js
- Manual review of inventory-api/.github/workflows/ emptiness
- Manual review of parent-root .github/workflows/ hosted workflow ownership
- npm run validate:production-baseline
- npm run validate:restore-readiness
- npm run validate:operational-readiness
- npm run validate:workflow-baseline
- npm run lint
- npm run typecheck
- npm run build
**Objective:** Elevar el nivel de evidencia cuando el diff toca Prisma, scripts, build, Docker, env, health, readiness, sessions o despliegue.
**Affected areas:**
- specs/merge-readiness-regression-control/tasks.md
- specs/merge-readiness-regression-control/risks.md
- specs/merge-readiness-regression-control/decisions.md
**Dependencies:**
- TASK-003
**Implementation notes:**
- Exigir `npm run validate:production-baseline`, `npm run validate:restore-readiness`, `npm run validate:operational-readiness` cuando corresponda.
- Documentar la discrepancia entre `docs/production-baseline.md` y la ausencia de `.github/workflows/`.
- Tratar el riesgo Windows/Prisma como abierto según `../docs/audit/current-code-audit.md`.
**Tests:**
- npm run validate:production-baseline
- npm run validate:restore-readiness
- npm run validate:operational-readiness
**Acceptance criteria:**
- [x] Los cambios de build/schema/scripts elevan riesgo explícitamente.
- [x] Los cambios de baseline operativo activan validaciones obligatorias.
- [x] La falta de workflows no se oculta ni se asume resuelta.
**Related requirements:**
- FR-011

## TASK-013: Construir matriz de pruebas por superficie afectada
**Status:** Completed
**Completed at:** 2026-03-08
**Implemented files:**
- specs/merge-readiness-regression-control/architecture.md
- specs/merge-readiness-regression-control/tasks.md
- specs/merge-readiness-regression-control/traceability.md
- specs/merge-readiness-regression-control/changelog.md
- specs/merge-readiness-regression-control/implementation-report.md
**Validation evidence:**
- Manual review of checklist matrix in specs/merge-readiness-regression-control/architecture.md
- Manual review of PR-surface test-matrix contract in specs/merge-readiness-regression-control/traceability.md
- Manual review against package.json
- Manual review against docs/test-suite-catalog.md
- node --test tests/public-surface-characterization.test.js
- set BROWSER_SESSION_STORE_MODE=memory && node --test tests/authorization-convergence-characterization.test.js
- node --test tests/payment-receipt-security.test.js
- node --test tests/pagination.test.js
- node --test tests/inventory-alerts-tenant-scope.test.js
- npm run validate:production-baseline
- npm run validate:restore-readiness
- npm run validate:operational-readiness
- npm run validate:workflow-baseline
- npm run lint
- npm run typecheck
- npm run build
**Objective:** Consolidar una lista mínima y otra ampliada de pruebas según el diff real.
**Affected areas:**
- specs/merge-readiness-regression-control/tasks.md
- specs/merge-readiness-regression-control/traceability.md
**Dependencies:**
- TASK-003
- TASK-005
- TASK-006
- TASK-008
- TASK-010
- TASK-011
- TASK-012
**Implementation notes:**
- Reutilizar la matriz propuesta por el usuario y adaptarla a superficies reales del diff.
- Mantener trazabilidad entre superficie afectada y comandos/tests concretos.
**Tests:**
- Minimum checklist review
- Expanded checklist review by surface
**Acceptance criteria:**
- [x] Existe una lista mínima de pruebas.
- [x] Existe una lista ampliada de pruebas.
- [x] Ambas dependen del diff real del PR.
**Related requirements:**
- FR-002
- FR-004
- FR-005
- FR-009
- FR-011
- FR-012

## TASK-014: Definir criterio de bloqueo y salida de aprobación
**Status:** Completed
**Completed at:** 2026-03-08
**Implemented files:**
- specs/merge-readiness-regression-control/decisions.md
- specs/merge-readiness-regression-control/advisor-review.md
- specs/merge-readiness-regression-control/tasks.md
- specs/merge-readiness-regression-control/traceability.md
- specs/merge-readiness-regression-control/changelog.md
- specs/merge-readiness-regression-control/implementation-report.md
**Validation evidence:**
- Manual review of decision rules in specs/merge-readiness-regression-control/decisions.md
- Manual review of accepted guidance in specs/merge-readiness-regression-control/advisor-review.md
- Manual review against requirements.md FR-001 FR-007 FR-011 FR-013 and BR-001 BR-003 BR-006 BR-007
- npm run lint
- npm run typecheck
- npm run build
**Objective:** Formalizar cuándo el planning puede recomendar aprobar o bloquear merge según evidencia disponible.
**Affected areas:**
- specs/merge-readiness-regression-control/decisions.md
- specs/merge-readiness-regression-control/advisor-review.md
- specs/merge-readiness-regression-control/implementation-report.md
**Dependencies:**
- TASK-002
- TASK-003
- TASK-004
- TASK-008
- TASK-012
- TASK-013
**Implementation notes:**
- Incluir bloqueos por falta de diff, cambio contractual observable sin docs/tests, endpoint sin dueño de autorización y baseline operativo no validado cuando aplica.
- Distinguir estado complete/partial/blocked.
**Tests:**
- Manual review of decision rules
**Acceptance criteria:**
- [x] Existen criterios explícitos para aprobar o bloquear merge.
- [x] Los bloqueos por evidencia faltante están definidos.
- [x] La salida final distingue claramente riesgo y readiness.
**Related requirements:**
- FR-001
- FR-007
- FR-011
- FR-013
