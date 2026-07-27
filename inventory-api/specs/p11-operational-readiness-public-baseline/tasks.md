# Implementation Tasks

## TASK-001: Converger validate:operational-readiness al baseline público
**Status:** Completed
**Completed at:** 2026-07-27
**Priority:** High
**Requirement:** FR-001, FR-002, FR-003, FR-004, FR-007
**Objective:** Hacer que `validate:operational-readiness` use artefactos públicos versionados en `docs/` y no dependa funcionalmente de `internal-docs/`.
**Affected files:**
- `inventory-api/scripts/validate-operational-readiness.js`
- `inventory-api/tests/production-baseline-characterization.test.js`
- `inventory-api/docs/production-baseline.md`
- `inventory-api/docs/production-operations-runbook.md`
- docs de arquitectura/spec relacionadas
**Implemented files:**
- `inventory-api/scripts/validate-operational-readiness.js`
- `inventory-api/tests/production-baseline-characterization.test.js`
- `inventory-api/docs/production-baseline.md`
- `inventory-api/docs/production-operations-runbook.md`
**Validation evidence:**
- `npm run validate:operational-readiness`
- `node --test tests/production-baseline-characterization.test.js tests/restore-readiness-characterization.test.js`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
**Required tests:**
- `npm run validate:operational-readiness`
- tests operativos relacionados

## TASK-002: Cerrar contrato y evidencia de `.env.production.example`
**Status:** Completed
**Completed at:** 2026-07-27
**Priority:** Medium
**Requirement:** FR-005, FR-006
**Objective:** Confirmar, documentar y/o validar explícitamente `.env.production.example` como artefacto contractual del baseline productivo.
**Affected files:**
- `inventory-api/.env.production.example`
- `inventory-api/docs/production-baseline.md`
- `inventory-api/docs/production-operations-runbook.md`
- `inventory-api/README.md`
- tests/validadores relacionados
**Implemented files:**
- `inventory-api/.gitignore`
- `inventory-api/.env.production.example`
- `inventory-api/scripts/validate-production-baseline.js`
- `inventory-api/tests/production-baseline-characterization.test.js`
- `inventory-api/docs/production-baseline.md`
- `inventory-api/docs/production-operations-runbook.md`
- `inventory-api/README.md`
**Validation evidence:**
- `git ls-files inventory-api/.env.production.example`
- `powershell ... npm run validate:production-baseline` with explicit production env values
- `node --test tests/production-baseline-characterization.test.js tests/restore-readiness-characterization.test.js`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- hosted `operational-smoke` run after tracking `.env.production.example`
**Required tests:**
- characterization/validator updates proving the artifact is present and referenced consistently

## TASK-003: Consolidar documentación, trazabilidad y evidencia final
**Status:** Completed
**Completed at:** 2026-07-27
**Priority:** Medium
**Requirement:** FR-009, FR-010
**Objective:** Refrescar docs/specs para reflejar el baseline operacional público final.
**Implemented files:**
- `inventory-api/docs/current-state.md`
- `inventory-api/docs/architecture.md`
- `inventory-api/docs/action-plan.md`
- `inventory-api/docs/tasks.md`
- `inventory-api/specs/p11-operational-readiness-public-baseline/*`
**Validation evidence:**
- documentation review
- `git diff --check`
