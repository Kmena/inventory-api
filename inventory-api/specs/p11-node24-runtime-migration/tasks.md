# Implementation Tasks
## TASK-001: Delimitar baseline actual Node 20 vs target state Node.js 24 LTS
**Status:** Completed
**Completed at:** 2025-08-11
**Implemented files:**
- `specs/p11-node24-runtime-migration/current-state.md`
- `specs/p11-node24-runtime-migration/implementation-report.md`
**Validation evidence:**
- Source review of `package.json`, `Dockerfile`, workflows, `src/lib/prisma.js`, `scripts/prisma-generate-safe-lib.js`
- `node -v` -> `v24.16.0`
- `npm ci`
- `npm run build`
- `node --test tests/taxpayer-characterization.test.js`
**Objective:** Confirmar y documentar el baseline actual de package, Docker, workflows, Prisma bootstrap y validaciones frente al target state de Node 24.

## TASK-002: Alinear package, Docker y GitHub Actions al baseline Node.js 24 LTS
**Status:** Completed
**Completed at:** 2025-08-11
**Implemented files:**
- `package.json`
- `Dockerfile`
- `inventory-api/.github/workflows/*`
- `scripts/prisma-generate-safe-lib.js`
- `scripts/validate-workflow-baseline.js`
- `README.md`
**Validation evidence:**
- `npm run build`
- `npm run validate:workflow-baseline`
- `node --test tests/workflow-baseline-characterization.test.js tests/prisma-windows-build-stabilization.test.js`
**Objective:** Actualizar coordinadamente los puntos declarativos y automatizados que fijaban Node 20.

## TASK-003: Resolver o aislar la incompatibilidad Prisma/runtime observada bajo Node 24
**Status:** Completed
**Completed at:** 2025-08-11
**Implemented files:**
- `specs/p11-node24-runtime-migration/current-state.md`
- `specs/p11-node24-runtime-migration/decisions.md`
- `specs/p11-node24-runtime-migration/implementation-report.md`
**Validation evidence:**
- `npm ci`
- `npm run build`
- `node --test tests/taxpayer-characterization.test.js`
- `npm run test -- --silent`
**Objective:** Cerrar el error `TypeError: PrismaClient is not a constructor` o aislarlo explícitamente con alcance y causa controlados.

## TASK-004: Validar el baseline Node 24 en Linux, Windows y Docker según aplique
**Status:** Completed
**Completed at:** 2026-07-27
**Implemented files:**
- `/.github/workflows/windows-prisma-build.yml`
- `/.github/workflows/static-checks.yml`
- `/.github/workflows/repository-tests.yml`
- `/.github/workflows/contract-validations.yml`
- `/.github/workflows/browser-e2e.yml`
- `/.github/workflows/operational-smoke.yml`
- `/.github/workflows/build-and-publish.yml`
- `/.github/workflows/db-constraints-tests.yml`
- `/.github/workflows/p0-quality-gates.yml`
- `specs/p11-node24-runtime-migration/implementation-report.md`
- `specs/p11-node24-runtime-migration/traceability.md`
- `specs/p11-node24-runtime-migration/risks.md`
**Validation evidence executed:**
- local Node 24 validation matrix already recorded in the implementation report
- hosted `windows-prisma-build` run `30281935398` success, job `90030223669`
- hosted `static-checks` run `30281932831` success
- hosted `db-constraints-tests` run `30281933453` success
- hosted `contract-validations` run `30281933525` success
- hosted `repository-tests` run `30281935485` success
- hosted `browser-e2e` run `30281937000` success
**Objective:** Demostrar que el baseline Node 24 funciona en las rutas mínimas obligatorias y distinguir claramente fallos baseline vs fallos nuevos.

## TASK-005: Consolidar rollback, riesgos y trazabilidad de cierre a P0-003
**Status:** Completed
**Completed at:** 2026-07-27
**Implemented files:**
- `specs/p11-node24-runtime-migration/traceability.md`
- `specs/p11-node24-runtime-migration/decisions.md`
- `specs/p11-node24-runtime-migration/implementation-report.md`
- `specs/p11-node24-runtime-migration/risks.md`
- `docs/current-state.md`
- `docs/architecture.md`
- `docs/tasks.md`
**Validation evidence:**
- traceability review
- hosted workflow evidence review
- documentation refresh review
**Objective:** Dejar listo el paquete de implementación con recovery path, decisiones, evidencia y gobierno de bloqueo.
