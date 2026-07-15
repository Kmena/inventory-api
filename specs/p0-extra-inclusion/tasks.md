# Implementation Tasks

## TASK-P0X-001: Establish quality-gate baseline
**Status:** Completed
**Completed at:** 2026-07-13
**Implemented files:**
- specs/p0-extra-inclusion/implementation-report.md
- specs/p0-extra-inclusion/tasks.md
- specs/p0-extra-inclusion/traceability.md
- specs/p0-extra-inclusion/changelog.md
**Validation evidence:**
- npm test -- --silent
- npm run validate:agent-workspace
- npm run prisma:generate
- npm run lint
- npm run typecheck
- npm run build
- npm run start
- GET http://localhost:2500/health
**Priority:** P0
**Objective:** Identify and document the current lint, type-check, build and test capabilities with execution evidence and failure classification.
**Related requirements:**
- FR-QG-001
- FR-QG-002
- FR-QG-003
- FR-QG-004
- FR-QG-006
**Affected areas:**
- inventory-api/package.json
- inventory-api/README.md
- inventory-api/Dockerfile
- inventory-api/docker-compose.yml
- existing validation scripts
- CI configuration if introduced later
**Dependencies:**
- None
**Implementation notes:**
- Execute every discovered validation command.
- Record commands, results and exit codes.
- Separate missing gates from environment failures and code failures.
- Do not correct failures as part of this task unless separately specified.
**Tests and validation:**
- Confirm every discovered command can be invoked.
- Confirm missing commands are documented.
- Confirm failures are classified.
**Acceptance criteria:**
- [x] Lint capability is classified.
- [x] Type-check capability is classified.
- [x] Build capability is classified.
- [x] Test capability is classified.
- [x] Pre-existing failures are documented.
- [x] Environment failures are separated from code failures.

## TASK-P0X-002: Add or correct lint quality gate
**Status:** Completed
**Completed at:** 2026-07-13
**Implemented files:**
- inventory-api/package.json
- inventory-api/package-lock.json
- inventory-api/eslint.config.js
- inventory-api/README.md
- inventory-api/src/services/auth.service.js
- inventory-api/src/services/client.service.js
- inventory-api/src/services/order.service.js
- inventory-api/src/services/sales-route.service.js
- inventory-api/src/services/user.service.js
- inventory-api/scripts/validate-agent-workspace.js
- specs/p0-extra-inclusion/current-state.md
- specs/p0-extra-inclusion/implementation-report.md
- specs/p0-extra-inclusion/tasks.md
- specs/p0-extra-inclusion/traceability.md
- specs/p0-extra-inclusion/changelog.md
**Validation evidence:**
- npm run lint
- npm test -- --silent
**Priority:** P0
**Objective:** Provide a documented lint command with explicit scope, exclusions and correct non-zero failure behavior.
**Related requirements:**
- FR-QG-001
- FR-QG-005
- BR-QG-001
- AC-QG-001
**Affected areas:**
- inventory-api/package.json
- new lint configuration files
- optional ignore files
- documentation for source scope
**Dependencies:**
- TASK-P0X-001
**Implementation notes:**
- Choose the lint tool intentionally and justify any new dependency.
- Exclude generated outputs, lock files and documentation noise where appropriate.
- Do not suppress real failures silently.
**Tests and validation:**
- Run `npm run lint`.
- Verify non-zero exit on lint failure.
- Confirm intended file coverage.
**Acceptance criteria:**
- [x] A lint script exists.
- [x] Lint scope is documented.
- [x] Exclusions are explicit.
- [x] Lint returns non-zero on failure.

## TASK-P0X-003: Add or correct type-check quality gate
**Status:** Completed
**Completed at:** 2026-07-13
**Implemented files:**
- inventory-api/package.json
- inventory-api/package-lock.json
- inventory-api/tsconfig.typecheck.json
- inventory-api/README.md
- inventory-api/src/lib/errors.js
- inventory-api/src/services/auth.service.js
- inventory-api/src/repositories/client.repository.js
- inventory-api/src/repositories/product.repository.js
- inventory-api/src/repositories/sales-route.repository.js
- inventory-api/src/schemas/client.schema.js
- inventory-api/src/schemas/warehouse.schema.js
- specs/p0-extra-inclusion/current-state.md
- specs/p0-extra-inclusion/implementation-report.md
- specs/p0-extra-inclusion/tasks.md
- specs/p0-extra-inclusion/traceability.md
- specs/p0-extra-inclusion/changelog.md
**Validation evidence:**
- npm run typecheck
- npm run lint
- npm test -- --silent
**Priority:** P0
**Objective:** Provide a meaningful no-emit static type-check command appropriate to the current repository.
**Related requirements:**
- FR-QG-002
- FR-QG-005
- BR-QG-001
- AC-QG-002
**Affected areas:**
- inventory-api/package.json
- new `tsconfig*.json` or equivalent static-check configuration
- optional helper typings/config files
**Dependencies:**
- TASK-P0X-001
**Implementation notes:**
- Prefer the smallest safe strategy, likely `tsc --noEmit` if approved.
- Define whether JavaScript files, tests and scripts are included.
- Avoid generating runtime artifacts unless explicitly required.
**Tests and validation:**
- Run `npm run typecheck`.
- Verify non-zero exit on configuration/type failure.
- Confirm the scope matches the documented intent.
**Acceptance criteria:**
- [x] A type-check script exists.
- [x] The type-check strategy is documented.
- [x] Runtime artifacts are not produced unless explicitly intended.
- [x] The command returns non-zero on failure.

## TASK-P0X-004: Add or correct build quality gate
**Status:** Completed
**Completed at:** 2026-07-13
**Implemented files:**
- inventory-api/package.json
- inventory-api/README.md
- specs/p0-extra-inclusion/current-state.md
- specs/p0-extra-inclusion/implementation-report.md
- specs/p0-extra-inclusion/tasks.md
- specs/p0-extra-inclusion/traceability.md
- specs/p0-extra-inclusion/changelog.md
**Validation evidence:**
- npm run build
- npm run typecheck
- npm run lint
- npm test -- --silent
**Priority:** P0
**Objective:** Define and implement the official build command required for P0 closure.
**Related requirements:**
- FR-QG-003
- FR-QG-005
- AC-QG-003
**Affected areas:**
- inventory-api/package.json
- optional build helper scripts
- inventory-api/README.md
- Docker-related documentation/configuration if part of build definition
**Dependencies:**
- TASK-P0X-001
**Implementation notes:**
- Decide whether build means packaging, Docker image build, Prisma generation, startup sanity, or an approved combination.
- Document artifact/output expectations.
- Ensure the command is reproducible and non-interactive.
**Tests and validation:**
- Run `npm run build`.
- Verify expected output exists or expected packaging flow completes.
- Verify non-zero exit on failure.
**Acceptance criteria:**
- [x] A build script exists.
- [x] Build outputs/expectations are documented.
- [x] The command is reproducible in a clean environment.
- [x] The command returns non-zero on failure.

## TASK-P0X-005: Stabilize mandatory automated test gate
**Status:** Completed
**Completed at:** 2026-07-13
**Implemented files:**
- inventory-api/README.md
- specs/p0-extra-inclusion/current-state.md
- specs/p0-extra-inclusion/implementation-report.md
- specs/p0-extra-inclusion/tasks.md
- specs/p0-extra-inclusion/traceability.md
- specs/p0-extra-inclusion/changelog.md
**Validation evidence:**
- npm test -- --silent
- npm run validate:agent-workspace
**Priority:** P0
**Objective:** Confirm and, if needed, refine the mandatory P0 automated test command and required suite scope.
**Related requirements:**
- FR-QG-004
- FR-QG-005
- AC-QG-004
**Affected areas:**
- inventory-api/package.json
- inventory-api/tests/
- optional test helpers/setup
- documentation for required vs optional suites
**Dependencies:**
- TASK-P0X-001
**Implementation notes:**
- Preserve the current `npm test` baseline unless a justified change is needed.
- Decide whether `validate:agent-workspace` is optional or mandatory.
- Confirm exit-code behavior and supported environment setup.
**Tests and validation:**
- Run `npm test`.
- Validate failure behavior.
- Validate clean-environment execution.
**Acceptance criteria:**
- [x] Mandatory test suites are documented.
- [x] `npm test` is confirmed or corrected as the mandatory command.
- [x] The command returns non-zero on failure.
- [x] Optional validation suites are clearly separated.

## TASK-P0X-006: Add aggregated verification command
**Status:** Completed
**Completed at:** 2026-07-13
**Implemented files:**
- inventory-api/package.json
- inventory-api/README.md
- specs/p0-extra-inclusion/current-state.md
- specs/p0-extra-inclusion/implementation-report.md
- specs/p0-extra-inclusion/tasks.md
- specs/p0-extra-inclusion/traceability.md
- specs/p0-extra-inclusion/changelog.md
**Validation evidence:**
- npm run verify
**Priority:** P0
**Objective:** Provide a single command or documented fail-fast sequence that runs all mandatory gates.
**Related requirements:**
- FR-QG-005
- FR-QG-006
- AC-QG-005
- AC-QG-006
**Affected areas:**
- inventory-api/package.json
- validation documentation
- evidence template/report location
**Dependencies:**
- TASK-P0X-002
- TASK-P0X-003
- TASK-P0X-004
- TASK-P0X-005
**Implementation notes:**
- Prefer a repository-level script such as `npm run verify` if consistent with current conventions.
- Ensure execution stops or fails clearly on the first gate failure, or captures equivalent failure state explicitly.
**Tests and validation:**
- Run aggregate command.
- Force one child gate failure during validation if practical.
- Confirm aggregate exit code propagates failure.
**Acceptance criteria:**
- [x] A full mandatory verification path exists.
- [x] Gate order is documented.
- [x] Failure propagation is correct.
- [x] Evidence collection is defined.

## TASK-P0X-007: Integrate mandatory quality gates into CI
**Status:** Completed
**Completed at:** 2026-07-13
**Implemented files:**
- .github/workflows/p0-quality-gates.yml
- specs/p0-extra-inclusion/current-state.md
- specs/p0-extra-inclusion/implementation-report.md
- specs/p0-extra-inclusion/tasks.md
- specs/p0-extra-inclusion/traceability.md
- specs/p0-extra-inclusion/changelog.md
**Validation evidence:**
- npx -y js-yaml .github/workflows/p0-quality-gates.yml > NUL
- npm run verify
**Priority:** P0
**Objective:** Ensure mandatory quality gates run automatically in CI and can block merge/release when they fail.
**Related requirements:**
- FR-QG-005
- FR-QG-007
- NFR-QG-003
- AC-QG-007
**Affected areas:**
- new CI configuration files
- repository documentation
**Dependencies:**
- TASK-P0X-006
**Implementation notes:**
- Reuse the same commands defined for local execution.
- Keep required and optional checks separate.
- Avoid CI-only hidden behavior.
**Tests and validation:**
- Validate workflow syntax/configuration.
- Validate CI references the same scripts as local usage.
- Confirm failures block the mandatory pipeline path.
**Acceptance criteria:**
- [x] CI configuration exists.
- [x] CI runs lint, typecheck, build and tests.
- [x] CI fails on mandatory gate failure.
- [x] Local and CI commands stay aligned.

## TASK-P0X-008: Execute final P0 extra validation from a clean environment
**Status:** Completed
**Completed at:** 2026-07-13
**Implemented files:**
- inventory-api/package.json
- inventory-api/README.md
- .github/workflows/p0-quality-gates.yml
- specs/p0-extra-inclusion/current-state.md
- specs/p0-extra-inclusion/implementation-report.md
- specs/p0-extra-inclusion/tasks.md
- specs/p0-extra-inclusion/traceability.md
- specs/p0-extra-inclusion/changelog.md
**Validation evidence:**
- npm ci
- node -v && npm -v
- npx -y node@20 -v
- npx -y node@20 "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run lint
- npx -y node@20 "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run typecheck
- npx -y node@20 "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run build
- npx -y node@20 "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run test
- npx -y node@20 "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run verify
**Priority:** P0
**Objective:** Produce final execution evidence for all mandatory quality gates using the approved scripts and environment setup.
**Related requirements:**
- FR-QG-006
- FR-QG-007
- AC-QG-006
- AC-QG-007
**Affected areas:**
- validation evidence artifacts
- original P0 package updates
**Dependencies:**
- TASK-P0X-007
**Implementation notes:**
- Use a clean supported environment.
- Record command, date, result, exit code, failures and affected modules.
- Distinguish pre-existing failures from new failures.
**Tests and validation:**
- Execute lint, typecheck, build, test and aggregate verification.
- Validate evidence completeness.
**Acceptance criteria:**
- [x] All mandatory gates were executed.
- [x] Results and exit codes are documented.
- [x] Failure classification is documented.
- [x] Clean-environment reproducibility is evidenced.

## TASK-P0X-010: Produce clean database replay evidence
**Status:** Completed
**Completed at:** 2026-07-13
**Implemented files:**
- inventory-api/prisma/migration-instructions.md
- specs/p0-extra-inclusion/current-state.md
- specs/p0-extra-inclusion/implementation-report.md
- specs/p0-extra-inclusion/tasks.md
- specs/p0-extra-inclusion/traceability.md
- specs/p0-extra-inclusion/changelog.md
**Validation evidence:**
- docker compose ps
- powershell -Command "$env:DATABASE_URL='postgresql://tracksys:tracksys@localhost:5432/tracksys_p0x_replay_seq?schema=public'; npx prisma migrate deploy"
- docker exec inventory-api-db-1 sh -lc "psql -U tracksys -d postgres -c 'DROP DATABASE IF EXISTS tracksys_p0x_replay_seq;' && psql -U tracksys -d postgres -c 'CREATE DATABASE tracksys_p0x_replay_seq;' && psql -U tracksys -d postgres -c '\l tracksys_p0x_replay_seq'"
- docker compose exec -T db sh -lc "psql -U tracksys -d postgres -c 'DROP DATABASE IF EXISTS tracksys_p0x_replay_run;' && psql -U tracksys -d postgres -c 'CREATE DATABASE tracksys_p0x_replay_run;' && psql -U tracksys -d postgres -c '\l tracksys_p0x_replay_run'"
- docker compose run --rm -e DATABASE_URL=postgresql://tracksys:tracksys@db:5432/tracksys_p0x_replay_run?schema=public app npx prisma migrate deploy
- docker compose run --rm -e DATABASE_URL=postgresql://tracksys:tracksys@db:5432/tracksys_p0x_replay_run?schema=public app npm run prisma:seed
**Priority:** P0
**Objective:** Prove that the committed Prisma migration history and seed/bootstrap flow can create a usable database from a clean state.
**Related requirements:**
- FR-QG-009
- NFR-QG-010
- BR-QG-007
- AC-QG-008
**Affected areas:**
- inventory-api/prisma/migration-instructions.md
- inventory-api/prisma/migrations/
- inventory-api/prisma/seed.js
- inventory-api/package.json
- validation evidence artifacts
**Dependencies:**
- TASK-P0X-008
**Implementation notes:**
- Use a disposable empty database.
- Prefer committed migration commands over manual schema preparation.
- Record exact commands, environment prerequisites and final result.
- Distinguish migration failures from seed/data issues.
**Tests and validation:**
- Execute the documented migration sequence from an empty database.
- Execute seed/bootstrap if required by the documented flow.
- Verify resulting schema and baseline access are usable.
**Acceptance criteria:**
- [x] A canonical clean replay sequence is documented.
- [x] Replay succeeds from an empty database or the failure is classified with evidence.
- [x] Seed/bootstrap outcome is recorded.
- [x] Evidence references committed repository artifacts only.

## TASK-P0X-011: Capture real GitHub Actions workflow execution evidence
**Status:** Completed
**Completed at:** 2026-07-13
**Implemented files:**
- specs/p0-extra-inclusion/tasks.md
- specs/p0-extra-inclusion/traceability.md
- specs/p0-extra-inclusion/implementation-report.md
- specs/p0-extra-inclusion/changelog.md
**Validation evidence:**
- public GitHub API queries against `actions/workflows` and `actions/runs`
- real GitHub Actions runner log showing `Run npm run lint`
- CI failure output with lint violations in `src/services/auth.service.js`, `src/services/client.service.js`, `src/services/order.service.js`, and `src/services/user.service.js`
- Run URL: `https://github.com/Kmena/inventory-api/actions/runs/29287056129`
- Run ID: `29287056129`
- Job URL: `https://github.com/Kmena/inventory-api/actions/runs/29287056129/job/86942014049?pr=20`
- Job ID: `86942014049`
- Outcome recorded: `failure`
**Priority:** P0
**Objective:** Capture evidence of a real run of the mandatory GitHub Actions workflow for the P0 quality gates.
**Related requirements:
**Priority:** P0
**Objective:** Capture evidence of a real run of the mandatory GitHub Actions workflow for the P0 quality gates.
**Related requirements:**
- FR-QG-010
- NFR-QG-003
- BR-QG-008
- AC-QG-009
**Affected areas:**
- .github/workflows/p0-quality-gates.yml
- validation evidence artifacts
- repository documentation if needed
**Dependencies:**
- TASK-P0X-007
- TASK-P0X-008
**Implementation notes:**
- Evidence must come from an actual GitHub Actions run, not just YAML parsing or local simulation.
- Record revision reference, workflow name, jobs executed and final status.
- If permissions or external access block execution, document that explicitly as an open blocker.
**Tests and validation:**
- Trigger or reference a real GitHub Actions run.
- Verify the run executed the mandatory jobs.
- Preserve run URL, identifier or equivalent durable reference.
**Acceptance criteria:**
- [x] A real workflow run reference is recorded.
- [x] Mandatory jobs executed are identified.
- [x] Final workflow status is documented.
- [x] Evidence is linked from the closure package.

## TASK-P0X-012: Define explicit supported Node.js version contract
**Status:** Completed
**Completed at:** 2026-07-13
**Implemented files:**
- inventory-api/package.json
- inventory-api/package-lock.json
- inventory-api/README.md
- specs/p0-extra-inclusion/current-state.md
- specs/p0-extra-inclusion/implementation-report.md
- specs/p0-extra-inclusion/tasks.md
- specs/p0-extra-inclusion/traceability.md
- specs/p0-extra-inclusion/changelog.md
**Validation evidence:**
- node -e "const pkg=require('./package.json'); console.log(JSON.stringify(pkg.engines))"
- node -e "const fs=require('fs'); const pkg=require('./package.json'); const readme=fs.readFileSync('README.md','utf8'); console.log(JSON.stringify({engines:pkg.engines, readmeHasNode20:readme.includes('Node.js `20.x`'), dockerHasNode20:fs.readFileSync('Dockerfile','utf8').includes('node:20-bullseye-slim')}))"
- npx -y node@20 "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run verify
- grep `node-version: 20` in `.github/workflows/p0-quality-gates.yml`
**Priority:** P0
**Objective:** Make the supported Node.js runtime explicit and align local documentation, package metadata and CI.
**Related requirements:**
- FR-QG-011
- NFR-QG-011
- BR-QG-009
- AC-QG-010
**Affected areas:**
- inventory-api/package.json
- inventory-api/README.md
- .github/workflows/p0-quality-gates.yml
- optional runtime version files if approved
**Dependencies:**
- TASK-P0X-008
**Implementation notes:**
- Prefer the smallest clear contract, such as README plus `engines`, if approved.
- Keep the declared version aligned with the workflow `node-version`.
- Avoid adding multiple conflicting version declarations.
**Tests and validation:**
- Review repository artifacts for version consistency.
- Run mandatory gates with the declared supported version.
- Confirm CI uses the same declared version.
**Acceptance criteria:**
- [x] Supported Node.js version is explicitly declared.
- [x] CI configuration matches the declared version.
- [x] Repository documentation reflects the same runtime contract.
- [x] No conflicting version declarations remain in scope.

## TASK-P0X-013: Update original P0 closure documentation
**Status:** Completed
**Completed at:** 2026-07-13
**Implemented files:**
- specs/p0-project-stabilization/current-state.md
- specs/p0-project-stabilization/traceability.md
- specs/p0-project-stabilization/implementation-report.md
- specs/p0-project-stabilization/changelog.md
- specs/p0-project-stabilization/closure-report.md
- specs/p0-extra-inclusion/tasks.md
- specs/p0-extra-inclusion/traceability.md
- specs/p0-extra-inclusion/implementation-report.md
- specs/p0-extra-inclusion/changelog.md
**Validation evidence:**
- consistency review of original P0 docs against `specs/p0-extra-inclusion/`
- linked real GitHub Actions run `29287056129`
- linked Node runtime contract evidence (`package.json`, README, CI, Docker)
- linked clean replay evidence classification from `TASK-P0X-010`
**Priority:** P0
**Objective:** Reflect the extra quality-gate results back into the original P0 package without prematurely declaring closure.
**Related requirements:**
- FR-QG-007
- FR-QG-008
- FR-QG-009
- FR-QG-010
- FR-QG-011
- BR-QG-006
**Affected areas:**
- specs/p0-project-stabilization/current-state.md
- specs/p0-project-stabilization/traceability.md
- specs/p0-project-stabilization/implementation-report.md
- post-implementation closure report (to be created after implementation)
**Dependencies:**
- TASK-P0X-010
- TASK-P0X-011
- TASK-P0X-012
**Implementation notes:**
- Do not create `closure-report.md` during planning.
- Only update original P0 closure documents after final gate execution evidence exists.
- Preserve history of the earlier incomplete closure interpretation.
**Tests and validation:**
- Review original P0 package for consistency.
- Confirm extra quality-gate evidence is linked.
**Acceptance criteria:**
- [x] Original P0 documents reference the extra quality-gate package.
- [x] Original P0 traceability is updated.
- [x] Original P0 current state is updated.
- [x] Closure interpretation reflects the additional operational evidence scope.
