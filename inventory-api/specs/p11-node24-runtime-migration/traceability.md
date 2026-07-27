# Traceability

## P11 source traceability
| P11 source | Reconciled finding / evidence | This spec treatment | Current status |
|---|---|---|---|
| `specs/p11-audit-emergency-hardening/decisions.md` TASK-001 outcome 3 | P0-003 remains partial; Node.js 24 LTS migration stays approved | TASK-001 through TASK-005 | active |
| `specs/p11-audit-emergency-hardening/current-state.md` §17.4 | Explicit Node.js 24 migration route | TASK-002, TASK-004 | implemented in package/Docker/workflows; final validation pending |
| `specs/p11-audit-emergency-hardening/current-state.md` §17.4 evidence note | `tests/taxpayer-characterization.test.js` fails on Node 24 with `PrismaClient is not a constructor` from `src/lib/prisma.js` | TASK-003 | isolated as non-reproducible on clean Node 24 rerun |
| `specs/p11-audit-emergency-hardening/risks.md` §7 | Node 24 may expose Prisma, Playwright or validation incompatibilities | TASK-003, TASK-004 | browser E2E and Docker validated locally; hosted Windows Node 24 evidence still blocked pending a fresh updated-workflow run |
| `docs/tasks.md` TASK-004 | Migrate and validate repository baseline on Node.js 24 LTS | Canonicalized into this spec | blocked pending hosted Windows Node 24 evidence |

## Requirements to implementation matrix
| Requirement | Implemented files | Tests / evidence | Resolution status |
|---|---|---|---|
| FR-001 | `specs/p11-node24-runtime-migration/current-state.md`, `traceability.md`, `implementation-report.md` | spec/source review | Completed |
| FR-002 | `implementation-report.md`, `current-state.md` | reviewed `package.json`, `Dockerfile`, workflows, `src/lib/prisma.js`, Prisma scripts | Completed |
| FR-003 | `package.json` | `npm ci`, `npm run build` | Completed |
| FR-004 | `Dockerfile` | `docker build -t inventory-api:node24-smoke .` | Completed |
| FR-005 | `.github/workflows/*.yml`, `scripts/validate-workflow-baseline.js` | `npm run validate:workflow-baseline`, workflow characterization tests | Completed |
| FR-006 | `scripts/prisma-generate-safe-lib.js`, `implementation-report.md`, `decisions.md` | `npm run build`, `node --test tests/taxpayer-characterization.test.js`, `npm run test -- --silent` | Completed |
| FR-007 | `current-state.md`, `decisions.md`, `implementation-report.md` | focused rerun under Node `v24.16.0` | Completed |
| FR-008 | `scripts/prisma-generate-safe-lib.js`, `.github/workflows/windows-prisma-build.yml`, `risks.md`, `implementation-report.md` | local guarded build evidence + workflow characterization tests + public hosted workflow/artifact review | Blocked pending hosted Node 24 run |
| FR-009 | `implementation-report.md`, `tasks.md`, `risks.md` | local matrix executed including browser E2E and Docker; hosted Windows Node 24 trigger still unavailable | Blocked |
| FR-010 | `package.json`, workflows, report/decisions docs | build/tests/validators rerun on Node 24 | Completed |
| FR-011 | no API file changes required | `npm run test -- --silent` | Completed |
| FR-012 | `implementation-plan.md`, `implementation-report.md`, `risks.md` | documentation review | Implemented |
| FR-013 | `decisions.md`, `implementation-report.md` | dependency review shows no upgrade required | Completed |
| FR-014 | `current-state.md`, `implementation-report.md` | planning/source review | Completed |
| FR-015 | `traceability.md`, `tasks.md`, `implementation-report.md` | traceability review | Implemented |
| FR-016 | `tasks.md`, `risks.md`, `implementation-report.md` | task status review | Implemented |

## Validation matrix summary
| Surface | Current implemented state | Evidence |
|---|---|---|
| package runtime | `engines.node: >=24 <25` | `package.json` |
| Docker runtime | `node:24-bullseye-slim` | `Dockerfile` + successful `docker build -t inventory-api:node24-smoke .` |
| GitHub Actions | relevant workflows pin Node 24 | workflow YAML + `npm run validate:workflow-baseline` |
| Prisma runtime bootstrap | CommonJS singleton retained; constructor error not reproduced | `npm run build`, `tests/taxpayer-characterization.test.js` |
| Linux/local CI path | install/build/lint/typecheck/tests pass on Node 24 | command log in `implementation-report.md` |
| Browser E2E | workflow aligned to Node 24 | successful `npm run test:e2e:browser` |
| Docker build + smoke | workflow/config aligned to Node 24 | successful `docker build -t inventory-api:node24-smoke .` |
| Windows Prisma build | Node 24 workflow aligned; known rename-lock mitigation preserved | latest public hosted review is still Node 20, so updated Node 24 hosted evidence remains blocked |
