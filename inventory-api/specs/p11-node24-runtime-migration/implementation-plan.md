# Implementation Plan
## 1. Objective
Migrar y validar el baseline real del repositorio a Node.js 24 LTS, resolviendo o aislando incompatibilidades de Prisma/runtime y alineando package, Docker, scripts y GitHub Actions.

## 2. Scope
Incluye:
- actualización de `package.json`, `Dockerfile` y workflows a Node 24
- revisión y ajuste de scripts/build Prisma relevantes
- investigación y remediación/aislamiento del error `PrismaClient is not a constructor`
- validación mínima Linux/Windows/Docker bajo Node 24
- documentación de rollback y evidencia

Excluye:
- rediseño de módulos de aplicación
- cierre de otros workstreams P11 no relacionados
- upgrades amplios de dependencias no ligados a compatibilidad Node 24

## 3. Preconditions
- `specs/p11-audit-emergency-hardening` aprobado y vigente como fuente principal.
- El baseline actual en Node 20 sigue siendo el punto de comparación.
- Se mantiene la distinción entre problemas baseline Windows y regresiones nuevas de Node 24.

## 4. Implementation sequence
### Step 1
- Purpose
  - Delimitar el baseline actual vs target state y preparar el cambio coordinado de versión.
- Changes
  - Actualizar `package.json` engines.
  - Actualizar `Dockerfile` base image.
  - Actualizar workflows GitHub Actions a Node 24.
  - Identificar scripts/mensajes que siguen asumiendo Node 20.
- Files
  - `package.json`
  - `Dockerfile`
  - `.github/workflows/*.yml`
  - `scripts/prisma-generate-safe-lib.js`
- Tests
  - revisión estática
  - workflow baseline validation
- Validation
  - El baseline declarado y automatizado queda alineado a Node 24, aún antes de cerrar compatibilidad completa.

### Step 2
- Purpose
  - Resolver o aislar la incompatibilidad Prisma/runtime observada en Node 24.
- Changes
  - Revisar `src/lib/prisma.js` y scripts que instancian Prisma.
  - Ajustar bootstrap/import pattern o dependencias Prisma mínimas si es necesario.
  - Si se requiere upgrade de `prisma`/`@prisma/client`, acotarlo y documentarlo.
- Files
  - `src/lib/prisma.js`
  - `package.json`
  - lockfile si cambia dependencia
  - scripts/tests afectados por bootstrap Prisma
- Tests
  - `npm run build`
  - focused rerun de `tests/taxpayer-characterization.test.js`
  - `npm run test`
- Validation
  - El error `PrismaClient is not a constructor` deja de bloquear o queda explícitamente aislado con decisión aprobada.

### Step 3
- Purpose
  - Revalidar el baseline operativo y de CI bajo Node 24.
- Validation gate
  - Si `npm run test`, `npm run build`, los validadores mínimos, browser E2E o Docker build fallan por una regresión nueva asociada a Node 24, la migración no se considera cerrada.
  - Se debe corregir, aislar con aprobación explícita o revertir el último cambio antes de continuar.
- Changes
  - Ejecutar lint, typecheck, tests, browser E2E, Docker build y smoke/validators aplicables.
  - Revalidar el workflow Windows Prisma build diferenciando rename-lock baseline vs regresiones nuevas.
- Files
  - `.github/workflows/*`
  - docs/specs de evidencia
- Tests
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
- Validation
  - La matriz mínima de validación Node 24 queda evidenciada por plataforma/flujo.

### Step 4
- Purpose
  - Consolidar rollback, desviaciones y trazabilidad a P0-003.
- Changes
  - Documentar resultados, dependencias actualizadas, excepciones y recovery path.
  - Actualizar docs/specs activos relacionados.
- Files
  - `specs/p11-node24-runtime-migration/*`
  - `docs/current-state.md`
  - `docs/architecture.md`
  - `docs/tasks.md`
- Tests
  - review final de evidencia
- Validation
  - El cierre o bloqueo residual queda claramente justificado y trazado a P0-003.

## 5. Database migration plan
No se prevén migraciones de schema. Solo regeneración/compatibilidad del cliente Prisma si aplica.

## 6. Testing plan
- Validar primero `npm ci` y `npm run build` bajo Node 24.
- Reproducir y resolver/aislar `tests/taxpayer-characterization.test.js`.
- Ejecutar `npm run lint`, `npm run typecheck`, `npm run test`.
- Ejecutar browser E2E y validadores/Smoke si el baseline actual ya los considera obligatorios.
- Ejecutar `docker build` y revisar health/smoke contractual disponible.
- Confirmar clasificación Windows build como baseline rename-lock o nueva regresión.

## 7. Deployment considerations
El cambio modifica el baseline de plataforma. Debe aterrizar coordinadamente para evitar divergencia entre desarrollo local, CI y contenedor de producción. No debe liberarse parcialmente con Node 24 en un sitio y Node 20 en otro.

## 8. Rollback plan
- Revertir `package.json`, `Dockerfile`, workflows y ajustes Prisma si la migración crítica no queda estable.
- Si una dependencia fue actualizada, revertirla conjuntamente con lockfile y regeneración asociada.
- Mantener documentado cualquier aislamiento temporal aprobado para evitar falsas conclusiones de cierre.

## 9. Risks
- Incompatibilidades adicionales de Prisma/tooling bajo Node 24.
- Divergencia entre Linux, Windows y Docker.
- Aumento del alcance si el fix requiere upgrade mínimo de dependencias.
- Falsa atribución de fallos al rename-lock Windows cuando son regresiones nuevas.

## 10. Definition of done
- Baseline package/Docker/workflows actualizado a Node.js 24 LTS.
- Problema `PrismaClient is not a constructor` resuelto o aislado explícitamente.
- Validaciones mínimas Node 24 ejecutadas con evidencia.
- No existen regresiones no aprobadas en tests, build, runtime, CI ni comportamiento externo respecto del baseline Node 20.
- Distinción explícita entre baseline Windows rename-lock y fallos nuevos de migración.
- Trazabilidad completa al P0-003 reconciliado por P11.

## Requirements traceability
| Requirement | Architecture component | Task | Test |
|---|---|---|---|
| FR-001 | P11 source dependency | TASK-001 | Spec review |
| FR-002 | Baseline current-state grounding | TASK-001 | Source review |
| FR-003 | package baseline alignment | TASK-002 | Static review + install/build |
| FR-004 | Docker baseline alignment | TASK-002 | Docker build |
| FR-005 | Workflow baseline alignment | TASK-002 | Workflow validation |
| FR-006 | Prisma/build script compatibility | TASK-003 | Build + focused reruns |
| FR-007 | Node 24 incompatibility evidence handling | TASK-003 | Focused `taxpayer-characterization` rerun |
| FR-008 | Windows baseline vs new regression separation | TASK-004 | Windows workflow evidence review |
| FR-009 | Minimum validation matrix | TASK-004 | Full validation suite |
| FR-010 | Real compatibility beyond version bump | TASK-003, TASK-004 | Build/tests/Docker |
| FR-011 | External behavior preservation | TASK-003, TASK-004 | Regression review |
| FR-012 | Rollback/recovery plan | TASK-005 | Plan review |
| FR-013 | Dependency update delimitation | TASK-003 | Dependency review |
| FR-014 | Expected files inventory | TASK-001 | Planning review |
| FR-015 | P0-003 traceability | TASK-005 | Traceability review |
| FR-016 | Blocking governance continuity | TASK-005 | Governance review |
| NFR-006 | No-regression migration rule | TASK-003, TASK-004, TASK-005 | Build/tests/Docker regression review |
| AC-008 | No unapproved regressions vs Node 20 baseline | TASK-004, TASK-005 | Full validation suite + governance review |
