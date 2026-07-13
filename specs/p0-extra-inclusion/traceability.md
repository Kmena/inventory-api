# Traceability Matrix

| Requirement | Current gap | Architecture response | Task | Validation | Closure evidence |
| ----------- | ----------- | --------------------- | ---- | ---------- | ---------------- |
| FR-QG-001 | No lint command or config found | Add lint script and config with explicit scope/exclusions | TASK-P0X-002 | `npm run lint` | Implemented in `inventory-api/package.json` and `inventory-api/eslint.config.js`; validated with passing `npm run lint` |
| FR-QG-002 | No typecheck command or config found | Add no-emit static type-check strategy | TASK-P0X-003 | `npm run typecheck` | Implemented in `inventory-api/package.json` and `inventory-api/tsconfig.typecheck.json`; validated with passing `npm run typecheck` |
| FR-QG-003 | No repository build gate exists | Define production build/packaging script | TASK-P0X-004 | `npm run build` | Implemented in `inventory-api/package.json`; validated with passing `npm run build` |
| FR-QG-004 | Test command exists but closure scope is not fully formalized | Preserve/refine mandatory automated test gate | TASK-P0X-005 | `npm test` | Implemented as documented mandatory gate in README; optional `validate:agent-workspace` kept separate |
| FR-QG-005 | No aggregate verification path exists | Add `verify` or equivalent fail-fast sequence | TASK-P0X-006 | `npm run verify` or approved equivalent | Implemented as `npm run verify`; validated with passing fail-fast sequence |
| FR-QG-006 | No standard evidence format exists | Define evidence convention and final execution recording | TASK-P0X-001, TASK-P0X-006, TASK-P0X-008 | Execution log + evidence artifact | TASK-P0X-001 baseline recorded in `specs/p0-extra-inclusion/implementation-report.md` |
| FR-QG-007 | Original P0 cannot be closed with missing gates or missing operational evidence | CI enforcement + final closure validation + original P0 update | TASK-P0X-007, TASK-P0X-008, TASK-P0X-010, TASK-P0X-011, TASK-P0X-012, TASK-P0X-013 | CI run + final validation review | Completed with original P0 back-propagation docs updated, while preserving recorded CI failure and replay inconsistency as operational facts |
| FR-QG-008 | Original P0 implementation report still says closure is incomplete due to missing gates | Link quality-gate package back to original P0 closure docs | TASK-P0X-013 | Updated original P0 docs | Completed via updates to original `current-state.md`, `traceability.md`, `implementation-report.md`, `changelog.md`, and new `closure-report.md` |
| FR-QG-009 | No clean database replay evidence is linked in the package | Add replay validation flow using committed Prisma artifacts | TASK-P0X-010 | Clean DB replay execution | Implemented with documented canonical sequence; migration invocation passed but seed/bootstrap remained blocked by target-environment inconsistency |
| FR-QG-010 | Workflow YAML exists but real GitHub Actions run evidence is missing | Capture actual GitHub Actions execution evidence | TASK-P0X-011 | GitHub Actions run record | Completed with run URL `https://github.com/Kmena/inventory-api/actions/runs/29287056129`, job URL `https://github.com/Kmena/inventory-api/actions/runs/29287056129/job/86942014049?pr=20`, and recorded `failure` outcome at the lint gate |
| FR-QG-011 | Node 20 is configured in CI but supported runtime is not explicitly declared as repository contract | Add explicit runtime support declaration aligned with CI | TASK-P0X-012 | Version consistency review + gate run | Implemented with `package.json` engines, README runtime contract, and existing CI/Docker alignment |
| AC-QG-001 | Missing lint gate | Lint command and scope | TASK-P0X-002 | `npm run lint` exit behavior | Passed in TASK-P0X-002; non-zero failure behavior confirmed during baseline when script was absent |
| AC-QG-002 | Missing type-check gate | Static no-emit type-check command | TASK-P0X-003 | `npm run typecheck` exit behavior | Passed in TASK-P0X-003; non-zero failure behavior confirmed during baseline when script was absent |
| AC-QG-003 | Missing build gate | Approved build script and artifact definition | TASK-P0X-004 | `npm run build` | Passed in TASK-P0X-004; build output documented as Prisma Client generation |
| AC-QG-004 | Tests not yet linked to full closure policy | Mandatory test-gate scope definition | TASK-P0X-005 | `npm test` | Passed in TASK-P0X-005; mandatory suite documented and optional validation separated |
| AC-QG-005 | No aggregate gate | Fail-fast orchestration | TASK-P0X-006 | Aggregate command/sequence | Passed in TASK-P0X-006 with documented gate order |
| AC-QG-006 | Evidence not standardized | Evidence collection convention | TASK-P0X-008 | Recorded command/date/result/exit code | Passed in TASK-P0X-008 with final clean-environment evidence recorded |
| AC-QG-007 | P0 closure remains incomplete | CI + final closure review | TASK-P0X-007, TASK-P0X-008, TASK-P0X-013 | Final closure package update | Completed as documentation back-propagation, without converting the captured CI failure or replay inconsistency into false success claims |
| AC-QG-008 | No clean database replay evidence exists | Database replay validation flow | TASK-P0X-010 | Executed migration/bootstrap evidence | Passed by evidence classification: canonical sequence documented, migration invocation recorded, seed/bootstrap failure classified |
| AC-QG-009 | No real workflow execution evidence exists | GitHub Actions run evidence capture | TASK-P0X-011 | Workflow run reference | Completed with durable run and job references plus recorded workflow failure outcome |
| AC-QG-010 | Runtime support contract is implicit only | Explicit Node.js support declaration | TASK-P0X-012 | README/package/CI alignment review | Implemented; Node 20.x declared and aligned with CI |

## Notes
- Original P0 reviewed: `requirements.md`, `current-state.md`, `implementation-plan.md`, `tasks.md`, `implementation-report.md`, `traceability.md`, `decisions.md`.
- Confirmed current automated test command: `npm test` in `inventory-api/package.json`.
- Earlier baseline missing commands (`lint`, `typecheck`, `build`) have now been implemented.
- Additional operational closure gaps were added to scope: clean DB replay, real GitHub Actions execution evidence, and explicit Node.js support declaration.
- TASK-P0X-001 execution evidence:
  - `npm test -- --silent` → pass, exit `0`
  - `npm run validate:agent-workspace` → fail, exit `1`, pre-existing baseline failure to classify in later tasks
  - `npm run prisma:generate` → pass, exit `0`
  - `npm run lint` / `typecheck` / `build` → fail, exit `1`, missing scripts
  - `npm run start` + `/health` → pass
- TASK-P0X-008 final evidence confirms mandatory gates in a supported Node 20 runtime after `npm ci`.
- Original P0 document back-propagation must be revalidated in TASK-P0X-013 after the added operational evidence is completed.
