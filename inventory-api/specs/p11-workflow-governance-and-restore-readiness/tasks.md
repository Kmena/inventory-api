# Implementation Tasks

## TASK-001: Converger workflow governance al árbol root oficial
**Status:** Completed
**Completed at:** 2026-07-27
**Priority:** High
**Domain:** CI/workflow governance
**Requirement:** FR-001, FR-002, FR-003, FR-004, FR-011
**Objective:** Dejar `/.github/workflows/` como única fuente oficial activa y retirar el árbol duplicado `inventory-api/.github/workflows/`.
**Reason:** El árbol duplicado ya no coincide con la ejecución hospedada real y aumenta riesgo de drift.
**Dependencies:** None
**Affected files:**
- `inventory-api/.github/workflows/*`
- `inventory-api/scripts/validate-workflow-baseline.js`
- `inventory-api/tests/workflow-baseline-characterization.test.js`
- `inventory-api/tests/prisma-windows-build-stabilization.test.js`
- `inventory-api/docs/current-state.md`
- `inventory-api/docs/architecture.md`
- `inventory-api/docs/action-plan.md`
- `inventory-api/docs/tasks.md`
- `inventory-api/specs/p11-workflow-governance-and-restore-readiness/*`
**Acceptance criteria:**
- Los validadores/tests dejan de usar fallback al árbol duplicado.
- El repositorio ya no mantiene YAML activos duplicados bajo `inventory-api/.github/workflows/`.
- La documentación declara explícitamente el modelo root-only.
- `npm run validate:workflow-baseline` sigue pasando.
**Implemented files:**
- `inventory-api/scripts/validate-workflow-baseline.js`
- `inventory-api/tests/workflow-baseline-characterization.test.js`
- `inventory-api/tests/prisma-windows-build-stabilization.test.js`
- `inventory-api/docs/current-state.md`
- `inventory-api/docs/architecture.md`
- `inventory-api/docs/action-plan.md`
- `inventory-api/docs/tasks.md`
- `inventory-api/docs/prisma-windows-stability-evidence.md`
- `inventory-api/.github/workflows/*` (removed)
**Validation evidence:**
- `npm run validate:workflow-baseline`
- `node --test tests/workflow-baseline-characterization.test.js tests/prisma-windows-build-stabilization.test.js`
- `git diff --check`
**Risk:** Medium

## TASK-002: Reparar el gate validate:restore-readiness y armonizar su contrato
**Status:** Implemented
**Completed at:** 2026-07-27
**Priority:** High
**Domain:** Operational governance
**Requirement:** FR-005, FR-006, FR-007, FR-008, FR-010
**Objective:** Corregir `operational-smoke` para que use un script npm válido y dejar consistente el contrato de restore readiness entre workflow, package, validador, tests y docs.
**Reason:** El workflow falla hoy por `Missing script: "validate:restore-readiness"` y el contrato documental está dividido entre `docs/` e `internal-docs/`.
**Dependencies:** TASK-001
**Affected files:**
- `inventory-api/package.json`
- `inventory-api/scripts/validate-restore-readiness.js`
- `inventory-api/tests/production-baseline-characterization.test.js`
- `inventory-api/tests/restore-readiness-characterization.test.js`
- `inventory-api/docs/production-baseline.md`
- `inventory-api/docs/production-operations-runbook.md`
- `inventory-api/docs/restore-readiness-baseline.md`
- `/.github/workflows/operational-smoke.yml`
- `inventory-api/specs/p11-workflow-governance-and-restore-readiness/*`
**Acceptance criteria:**
- `package.json` expone `validate:restore-readiness`.
- `npm run validate:restore-readiness` ejecuta el validador real.
- `operational-smoke` deja de fallar por script faltante.
- Docs/tests/validator usan el mismo contrato documental aprobado.
**Implemented files:**
- `inventory-api/package.json`
- `inventory-api/scripts/validate-restore-readiness.js`
- `inventory-api/scripts/validate-operational-readiness.js`
- `inventory-api/tests/workflow-baseline-characterization.test.js`
- `inventory-api/tests/production-baseline-characterization.test.js`
- `inventory-api/tests/restore-readiness-characterization.test.js`
- `inventory-api/docs/production-baseline.md`
- `inventory-api/docs/restore-readiness-baseline.md`
**Validation evidence:**
- `npm run validate:restore-readiness`
- `npm run validate:operational-readiness`
- `node --test tests/production-baseline-characterization.test.js tests/restore-readiness-characterization.test.js`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
**Pending validation to reach Completed:**
- hosted rerun/review of `operational-smoke`
**Risk:** Medium

## TASK-003: Consolidar documentación, trazabilidad y evidencia de cierre
**Status:** Implemented
**Completed at:** 2026-07-27
**Priority:** Medium
**Domain:** Architecture/documentation governance
**Requirement:** FR-009, FR-012, NFR-004, NFR-005
**Objective:** Actualizar documentos de arquitectura, current-state y spec package para que reflejen el estado real resultante sin referencias obsoletas al árbol duplicado ni al contrato roto de restore readiness.
**Reason:** Este follow-up existe precisamente para cerrar deuda documental y de gobernanza posterior a `p11-node24-runtime-migration`.
**Dependencies:** TASK-002
**Affected files:**
- `inventory-api/docs/current-state.md`
- `inventory-api/docs/architecture.md`
- `inventory-api/docs/action-plan.md`
- `inventory-api/docs/tasks.md`
- `inventory-api/specs/p11-workflow-governance-and-restore-readiness/*`
- `inventory-api/specs/p11-node24-runtime-migration/*` cuando la trazabilidad cruzada deba refrescarse
**Acceptance criteria:**
- La documentación declara root-only workflows y el contrato real de restore readiness.
- La trazabilidad hacia `p11-node24-runtime-migration` queda explícita.
- La evidencia local/hosted usada para cierre queda registrada.
**Implemented files:**
- `inventory-api/docs/current-state.md`
- `inventory-api/docs/architecture.md`
- `inventory-api/docs/action-plan.md`
- `inventory-api/docs/tasks.md`
- `inventory-api/docs/prisma-windows-stability-evidence.md`
- `inventory-api/specs/p11-workflow-governance-and-restore-readiness/*`
**Validation evidence:**
- documentation review
- `git diff --check`
**Pending validation to reach Completed:**
- hosted rerun/review of `operational-smoke` so final closure evidence matches the repaired contract
**Risk:** Low
