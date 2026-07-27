# Traceability

## P11 source traceability
| P11 source | Reconciled finding / evidence | This spec treatment | Current status |
|---|---|---|---|
| `specs/p11-audit-emergency-hardening/decisions.md` TASK-001 outcome 3 | P0-003 remains partial; Node.js 24 LTS migration stays approved | TASK-001 through TASK-005 | completed |
| `specs/p11-audit-emergency-hardening/current-state.md` §17.4 | Explicit Node.js 24 migration route | TASK-002, TASK-004, TASK-005 | completed |
| `specs/p11-audit-emergency-hardening/current-state.md` §17.4 evidence note | `tests/taxpayer-characterization.test.js` fails on Node 24 with `PrismaClient is not a constructor` from `src/lib/prisma.js` | TASK-003 | isolated as non-reproducible on clean Node 24 rerun |
| `specs/p11-audit-emergency-hardening/risks.md` §7 | Node 24 may expose Prisma, Playwright or validation incompatibilities | TASK-003, TASK-004, TASK-005 | local/mainline, Docker, and hosted root-workflow evidence completed successfully |
| `docs/tasks.md` TASK-004 | Migrate and validate repository baseline on Node.js 24 LTS | Canonicalized into this spec | completed |

## Requirements to implementation matrix
| Requirement | Implemented files | Tests / evidence | Resolution status |
|---|---|---|---|
| FR-001 | `current-state.md`, `traceability.md`, `implementation-report.md` | spec/source review | Completed |
| FR-002 | `implementation-report.md`, `current-state.md` | reviewed package, Docker, workflows, Prisma bootstrap, Prisma scripts | Completed |
| FR-003 | `package.json` | install/build evidence | Completed |
| FR-004 | `Dockerfile` | Docker build evidence | Completed |
| FR-005 | `/.github/workflows/*.yml`, `inventory-api/.github/workflows/*.yml`, `scripts/validate-workflow-baseline.js` | validator + hosted workflow evidence | Completed |
| FR-006 | `scripts/prisma-generate-safe-lib.js`, `implementation-report.md`, `decisions.md` | build + focused reruns + aggregate tests | Completed |
| FR-007 | `current-state.md`, `decisions.md`, `implementation-report.md` | focused rerun under Node `v24.16.0` | Completed |
| FR-008 | Windows workflow, workflow evidence docs, risks/report docs | hosted run `30281935398` plus local classification tests | Completed |
| FR-009 | report/tasks/risks/workflows | local validation matrix + hosted runs `30281932831`, `30281933453`, `30281933525`, `30281935485`, `30281937000`, `30281935398` | Completed |
| FR-010 | package/workflows/report/decisions docs | build/tests/validators rerun on Node 24 | Completed |
| FR-011 | no API file changes required | aggregate regression evidence | Completed |
| FR-012 | implementation plan/report/risks | documentation review | Completed |
| FR-013 | decisions/report | dependency review shows no upgrade required | Completed |
| FR-014 | current-state/report | planning/source review | Completed |
| FR-015 | traceability/tasks/report/decisions | traceability review | Completed |
| FR-016 | tasks/risks/report/decisions | task status review | Completed |

## Validation matrix summary
| Surface | Current implemented state | Evidence |
|---|---|---|
| package runtime | `engines.node: >=24 <25` | `package.json` |
| Docker runtime | `node:24-bullseye-slim` | `Dockerfile` + successful Docker evidence |
| GitHub Actions official path | root workflows pin Node 24 and execute in `inventory-api/` | `/.github/workflows/*.yml` |
| GitHub Actions local validator path | application-local workflow copies pin Node 24 | `inventory-api/.github/workflows/*.yml` + validator/tests |
| Prisma runtime bootstrap | CommonJS singleton retained; constructor error not reproduced | build + `tests/taxpayer-characterization.test.js` |
| Linux/local CI path | install/build/lint/typecheck/tests pass on Node 24 | implementation report |
| Browser E2E | local and hosted Node 24 evidence recorded | `npm run test:e2e:browser` + run `30281937000` |
| DB constraints gate | hosted dedicated workflow aligned to Node 24 | run `30281933453` |
| Windows Prisma build | hosted official Node 24 workflow aligned; known rename-lock mitigation preserved | run `30281935398`, job `90030223669`, artifact path documented |
