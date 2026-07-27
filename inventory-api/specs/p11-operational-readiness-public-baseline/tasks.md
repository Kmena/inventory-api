# Implementation Tasks

## TASK-001: Converger validate:operational-readiness al baseline público
**Status:** Pending
**Priority:** High
**Requirement:** FR-001, FR-002, FR-003, FR-004, FR-007
**Objective:** Hacer que `validate:operational-readiness` use artefactos públicos versionados en `docs/` y no dependa funcionalmente de `internal-docs/`.
**Affected files:**
- `inventory-api/scripts/validate-operational-readiness.js`
- `inventory-api/tests/production-baseline-characterization.test.js`
- `inventory-api/docs/production-baseline.md`
- `inventory-api/docs/production-operations-runbook.md`
- docs de arquitectura/spec relacionadas
**Required tests:**
- `npm run validate:operational-readiness`
- tests operativos relacionados

## TASK-002: Cerrar contrato y evidencia de `.env.production.example`
**Status:** Pending
**Priority:** Medium
**Requirement:** FR-005, FR-006
**Objective:** Confirmar, documentar y/o validar explícitamente `.env.production.example` como artefacto contractual del baseline productivo.
**Affected files:**
- `inventory-api/.env.production.example`
- `inventory-api/docs/production-baseline.md`
- `inventory-api/docs/production-operations-runbook.md`
- `inventory-api/README.md`
- tests/validadores relacionados
**Required tests:**
- characterization/validator updates proving the artifact is present and referenced consistently

## TASK-003: Consolidar documentación, trazabilidad y evidencia final
**Status:** Pending
**Priority:** Medium
**Requirement:** FR-009, FR-010
**Objective:** Refrescar docs/specs para reflejar el baseline operacional público final.
