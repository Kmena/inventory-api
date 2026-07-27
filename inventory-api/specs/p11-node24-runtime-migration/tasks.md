# Implementation Tasks
## TASK-001: Delimitar baseline actual Node 20 vs target state Node.js 24 LTS
**Status:** Completed
**Completed at:** 2025-08-11
**Implemented files:**
- `specs/p11-node24-runtime-migration/current-state.md`
- `specs/p11-node24-runtime-migration/implementation-report.md`
**Validation evidence:**
- Source review of `package.json`, `Dockerfile`, `.github/workflows/*`, `src/lib/prisma.js`, `scripts/prisma-generate-safe-lib.js`
- `node -v` -> `v24.16.0`
- `npm ci`
- `npm run build`
- `node --test tests/taxpayer-characterization.test.js`
**Objective:** Confirmar y documentar el baseline actual de package, Docker, workflows, Prisma bootstrap y validaciones frente al target state de Node 24.
**Affected areas:**
- `package.json`
- `Dockerfile`
- `.github/workflows/*`
- `src/lib/prisma.js`
- `scripts/prisma-generate-safe.js`
- `scripts/prisma-generate-safe-lib.js`
- `specs/p11-node24-runtime-migration/current-state.md`
**Dependencies:**
- None
**Implementation notes:**
- Relacionar explícitamente este substream con P0-003 reconciliado por P11.
- Enumerar los archivos esperados a tocar antes de cambiar el baseline.
- Related requirements:
  - FR-001
  - FR-002
  - FR-014
  - FR-015
**Tests:**
- Source review
- Planning review
**Acceptance criteria:**
- [x] Queda documentado el baseline actual Node 20 vs target Node 24.
- [x] Los archivos esperados a tocar quedan explícitos.
- [x] La relación con P0-003 queda clara.

## TASK-002: Alinear package, Docker y GitHub Actions al baseline Node.js 24 LTS
**Status:** Completed
**Completed at:** 2025-08-11
**Implemented files:**
- `package.json`
- `Dockerfile`
- `.github/workflows/static-checks.yml`
- `.github/workflows/repository-tests.yml`
- `.github/workflows/contract-validations.yml`
- `.github/workflows/browser-e2e.yml`
- `.github/workflows/operational-smoke.yml`
- `.github/workflows/windows-prisma-build.yml`
- `.github/workflows/build-and-publish.yml`
- `.github/workflows/db-constraints-tests.yml`
- `scripts/prisma-generate-safe-lib.js`
- `scripts/validate-workflow-baseline.js`
- `README.md`
**Validation evidence:**
- `npm run build`
- `npm run validate:workflow-baseline`
- `node --test tests/workflow-baseline-characterization.test.js tests/prisma-windows-build-stabilization.test.js`
**Objective:** Actualizar coordinadamente los puntos declarativos y automatizados que hoy fijan Node 20.
**Affected areas:**
- `package.json`
- `Dockerfile`
- `.github/workflows/static-checks.yml`
- `.github/workflows/repository-tests.yml`
- `.github/workflows/contract-validations.yml`
- `.github/workflows/browser-e2e.yml`
- `.github/workflows/operational-smoke.yml`
- `.github/workflows/windows-prisma-build.yml`
- `.github/workflows/build-and-publish.yml`
- `scripts/prisma-generate-safe-lib.js`
**Dependencies:**
- TASK-001
**Implementation notes:**
- No dejar baseline mixto Node 24/Node 20 entre package, Docker y CI.
- Ajustar cualquier mensaje hardcoded que siga recomendando Node 20 como baseline.
- Related requirements:
  - FR-003
  - FR-004
  - FR-005
  - AC-001
**Tests:**
- Workflow baseline validation
- Docker static review
**Acceptance criteria:**
- [x] `package.json` apunta al baseline Node.js 24 LTS.
- [x] `Dockerfile` usa imagen base Node.js 24 compatible.
- [x] Los workflows relevantes quedan actualizados a Node 24.
- [x] Los mensajes/scripts de baseline no siguen recomendando Node 20 salvo en contextos históricos documentados.

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
**Affected areas:**
- `src/lib/prisma.js`
- `package.json`
- lockfile si aplica
- scripts/tests que instancian Prisma (`scripts/apply-committed-migrations.js`, `scripts/diagnose-hardening-constraints.js`, `tests/p2-hardening-constraints.test.js`, `prisma/seed.js`, etc.)
**Dependencies:**
- TASK-002
**Implementation notes:**
- Determinar si el problema se resuelve con upgrade mínimo de `prisma` / `@prisma/client`, con regeneración o con ajuste de bootstrap CommonJS.
- No abrir upgrades amplios sin control.
- Related requirements:
  - FR-006
  - FR-007
  - FR-010
  - FR-011
  - FR-013
  - AC-002
  - AC-005
**Tests:**
- `npm run build`
- focused `node --test tests/taxpayer-characterization.test.js`
- `npm run test`
**Acceptance criteria:**
- [x] El error `PrismaClient is not a constructor` deja de reproducirse o queda aislado con decisión aprobada.
- [x] Cualquier actualización de dependencia queda delimitada y justificada.
- [x] El comportamiento externo no cambia salvo ajuste técnico mínimo documentado.

## TASK-004: Validar el baseline Node 24 en Linux, Windows y Docker según aplique
**Status:** Blocked
**Updated at:** 2025-08-11
**Implemented files:**
- `specs/p11-node24-runtime-migration/implementation-report.md`
- `specs/p11-node24-runtime-migration/traceability.md`
- `specs/p11-node24-runtime-migration/risks.md`
**Validation evidence executed:**
- `npm ci`
- `npm run build`
- `npm run lint`
- `npm run typecheck`
- `npm run test -- --silent`
- `node --test tests/taxpayer-characterization.test.js`
- `npm run validate:public-runtime`
- `npm run validate:workflow-baseline`
- `npm run validate:operational-readiness`
- `set NODE_ENV=production&& ... && npm run validate:production-baseline`
- `npm run test:e2e:browser`
- `docker build -t inventory-api:node24-smoke .`
- GitHub Actions API review of the latest available `windows-prisma-build` hosted runs and artifacts
**Blocking condition before completion:**
- no hosted Node 24 `windows-prisma-build` run exists yet for the current updated workflow revision from this environment, so the only available hosted artifact review still reflects the historical Node 20 workflow baseline
**Objective:** Demostrar que el baseline Node 24 funciona en las rutas mínimas obligatorias y distinguir claramente fallos baseline vs fallos nuevos.
**Affected areas:**
- `.github/workflows/*`
- `Dockerfile`
- evidencia/documentación operativa relacionada
- `specs/p11-node24-runtime-migration/implementation-report.md`
**Dependencies:**
- TASK-003
**Implementation notes:**
- Separar evidencia del rename-lock Windows preexistente de cualquier nuevo fallo Node 24.
- Incluir browser E2E y smoke/health checks cuando los workflows actuales ya los hacen obligatorios.
- Related requirements:
  - FR-008
  - FR-009
  - FR-010
  - AC-003
  - AC-004
**Tests:**
- `npm ci`
- `npm run build`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:e2e:browser`
- `docker build`
- `npm run validate:public-runtime`
- `npm run validate:workflow-baseline`
- `npm run validate:operational-readiness`
- `npm run validate:production-baseline`
**Acceptance criteria:**
- [x] Existe evidencia mínima de validación bajo Node 24 para Linux/CI principal.
- [ ] Windows Prisma build queda clasificado como baseline conocido o regresión nueva con evidencia Node 24 hospedada para este baseline implementado.
- [x] Docker build y validaciones smoke/contractuales aplicables quedan ejecutados y documentados.

## TASK-005: Consolidar rollback, riesgos y trazabilidad de cierre a P0-003
**Status:** Pending
**Objective:** Dejar listo el paquete de implementación con recovery path, decisiones, evidencia y gobierno de bloqueo.
**Affected areas:**
- `specs/p11-node24-runtime-migration/traceability.md`
- `specs/p11-node24-runtime-migration/decisions.md`
- `specs/p11-node24-runtime-migration/implementation-report.md`
- `specs/p11-node24-runtime-migration/risks.md`
- `docs/current-state.md`
- `docs/architecture.md`
- `docs/tasks.md`
**Dependencies:**
- TASK-004
**Implementation notes:**
- Si queda una excepción abierta, no declarar el substream como cerrado sin approval explícita.
- Related requirements:
  - FR-012
  - FR-015
  - FR-016
  - AC-006
  - AC-007
**Tests:**
- Traceability review
- Governance review
**Acceptance criteria:**
- [ ] Existe rollback o recovery path explícito.
- [ ] La evidencia y decisiones quedan trazadas a P0-003.
- [ ] El paquete queda listo para ejecución y revisión segura por el SDD Implementation Agent.
