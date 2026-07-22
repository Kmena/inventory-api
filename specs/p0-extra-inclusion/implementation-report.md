# Implementation Report

## 1. Report status
This document is preserved as **historical implementation and validation evidence** for `specs/p0-extra-inclusion/`.

It is **not** the final closure report for the audited revision of this package.

Current authoritative closure interpretation is:
- `planning_status: completed`
- `implementation_status: implemented`
- `validation_status: failed`
- `closure_status: failed`

The audited revision introduced a new task model (`TASK-P0X-001` through `TASK-P0X-012`) focused on truthful closure. Therefore, this report must be read as evidence input for those tasks, not as proof that the audited closure work is complete.

## 2. Historical implementation scope already present in the repository
Repository inspection confirms the following technical elements already exist:
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test`
- `npm run verify`
- `.github/workflows/p0-quality-gates.yml`
- explicit Node runtime contract in:
  - `inventory-api/package.json`
  - `inventory-api/README.md`
  - `inventory-api/Dockerfile`
  - `.github/workflows/p0-quality-gates.yml`
- replay documentation in `inventory-api/prisma/migration-instructions.md`

These elements are technically implemented, but their presence does not establish audited closure by itself.

## 3. Historical execution evidence preserved from prior implementation work
### 3.1 Local quality-gate evidence previously recorded
The historical report preserved evidence of the following supported-runtime local executions:
- `npm run lint` → passed under Node 20
- `npm run typecheck` → passed under Node 20
- `npm run build` → passed under Node 20
- `npm run test` → passed under Node 20
- `npm run verify` → passed under Node 20

### 3.2 Optional diagnostic evidence preserved
- `npm run validate:agent-workspace` → failed and remains classified as an optional diagnostic check rather than a mandatory P0 closure gate.

### 3.3 Runtime drift evidence preserved
Historical evidence also recorded local runtime drift outside the supported Node 20 contract:
- Node 24 environment showed tool/runtime failures after `npm ci`
- these failures were classified as environment drift, not as canonical closure validation

## 4. Real GitHub Actions evidence preserved
Historical evidence preserved a real GitHub Actions run:
- **Run URL:** `https://github.com/Kmena/inventory-api/actions/runs/29287056129`
- **Job URL:** `https://github.com/Kmena/inventory-api/actions/runs/29287056129/job/86942014049?pr=20`
- **Observed outcome:** `failure`
- **Recorded failure point:** `npm run lint`

Follow-up execution later captured a newer real GitHub Actions run:
- **Run URL:** `https://github.com/Kmena/inventory-api/actions/runs/29288885694`
- **Job URL:** `https://github.com/Kmena/inventory-api/actions/runs/29288885694/job/86947744464`
- **Branch:** `19-p0-extra-quality-gates-inclusion`
- **Commit:** `b86f09ec289b470d0ef8fbde46bfec7b2da3b79b`
- **Observed outcome:** `failure`
- **Job conclusion:** `quality-gates` → `failure`

A later real GitHub Actions run now provides successful CI evidence:
- **Run URL:** `https://github.com/Kmena/inventory-api/actions/runs/29383737072`
- **Job URL:** `https://github.com/Kmena/inventory-api/actions/runs/29383737072/job/87252601412?pr=22`
- **Branch:** `19-p0-extra-quality-gates-inclusion`
- **Commit:** `5c16b2c91e22b49085e1cb7f72a3ae58bd1bf50f`
- **Observed outcome:** `success`
- **Job conclusion:** `quality-gates` → `success`

Earlier failed runs remain preserved and must not be deleted or hidden by later successes.

## 5. Clean database replay evidence preserved
Historical evidence preserved two replay attempts:

### 5.1 Host-local replay attempt
- Classification: **Inconclusive**
- Summary: host-local replay against `localhost:5432` showed environment drift and could not be treated as canonical closure evidence.

### 5.2 Compose-aligned replay attempt
- Migration invocation using committed Docker/Prisma artifacts reported success.
- Seed/bootstrap attempt failed because the target database did not exist for the inspected server state.
- Classification: **Failed / Environment blocked**

### 5.3 Follow-up compose replay attempt
The approved follow-up package executed a fresh canonical replay using disposable database `tracksys_replay_followup_20260713` and recorded:
- service `db` initially listed the new database successfully;
- `docker compose run --rm -e DATABASE_URL=postgresql://tracksys:tracksys@db:5432/tracksys_replay_followup_20260713?schema=public app npx prisma migrate deploy` reported success and claimed all 22 migrations were applied;
- immediate inspection from service `db` then failed with `FATAL:  database "tracksys_replay_followup_20260713" does not exist`;
- `npm run prisma:seed` failed because the same database did not exist;
- final listing from service `db` confirmed the disposable target was absent.

Classification: **Failed / Environment blocked**

This means clean replay remains unresolved for closure purposes.

## 6. Current audited interpretation of the preserved evidence
The preserved historical evidence supports these facts:
- mandatory gate scripts exist;
- local supported-runtime pass evidence exists for the mandatory gates;
- explicit runtime contract exists and points to Node 20;
- CI workflow exists and uses repository-owned scripts;
- real CI success evidence now exists;
- replay documentation exists.

The same preserved evidence also proves closure remains open because:
- historical real CI failures existed and remain preserved;
- clean replay did not achieve a full passed result;
- documentation drift existed between technical implementation and truthful closure status.

## 7. Mapping historical evidence to current audited tasks
| Current task | How this report supports it | Current interpretation |
|---|---|---|
| TASK-P0X-001 | Provides historical implementation facts, CI failure evidence, replay incompleteness and drift inputs | Evidence source only |
| TASK-P0X-002 | Provides historical command/config execution context for lint, typecheck, build, test and verify | Evidence source only |
| TASK-P0X-003 | Provides runtime-alignment evidence for Node 20 contract | Evidence source only |
| TASK-P0X-004 | Provides real failed and successful GitHub Actions evidence | Evidence source only |
| TASK-P0X-005 | Provides canonical replay context and replay-problem history | Evidence source only |
| TASK-P0X-006 | Provides prior replay attempts that must be preserved | Evidence source only |
| TASK-P0X-007 | Provides examples of documentation drift requiring reconciliation | Evidence source only |
| TASK-P0X-008 | Provides initial evidence items that must be registered and preserved | Evidence source only |
| TASK-P0X-009 | Provides historical local gate-pass evidence but does not replace required final execution records | Evidence source only |
| TASK-P0X-010 | Provides known failed CI evidence and the later successful CI run that must remain linked together | Evidence source only |
| TASK-P0X-011 | Provides extension evidence that must be back-propagated truthfully to the parent P0 | Evidence source only |
| TASK-P0X-012 | Provides part of the final closure inputs, but not a passing closure result | Evidence source only |

## 8. Evidence identifiers aligned with the current audited package
- `EVID-CI-001` → real failed GitHub Actions run
- `EVID-CI-002` → newer real failed GitHub Actions run
- `EVID-CI-003` → successful real GitHub Actions run
- `EVID-DB-001` → host-local replay attempt, inconclusive
- `EVID-DB-002` → compose-aligned replay attempt, failed / blocked
- `EVID-DB-003` → fresh compose-aligned replay attempt, failed / blocked
- `EVID-TEST-001` → historical supported-runtime local test pass
- `EVID-VERIFY-001` → historical supported-runtime local verify pass
- `EVID-RUNTIME-001` → aligned Node 20 runtime contract across package metadata, README, Docker and CI

## 9. What this report does not prove
This report does **not** prove:
- that the current audited task set is complete;
- that clean replay has passed successfully;
- that replay-related closure blockers are resolved;
- that the extension package may be marked closed;
- that the parent P0 may be marked closed.

## 10. Next required documents for closure work
The audited closure workflow now depends on:
- `specs/p0-extra-inclusion/tasks.md`
- `specs/p0-extra-inclusion/traceability.md`
- `specs/p0-extra-inclusion/validation-evidence.md`
- `specs/p0-extra-inclusion/current-state.md`
- `specs/p0-project-stabilization/closure-report.md`

## 11. Current truthful status
- Technical implementation elements: **present**
- Local supported-runtime gate evidence: **present historically and rerun in follow-up package `specs/p0-extra-closure-followup/`**
- Real CI success evidence: **present** (`29383737072`)
- Real CI failure evidence: **present and preserved across multiple runs**
- Clean replay passed evidence: **not present**
- Clean replay failed/blocked evidence: **present across multiple preserved attempts**
- Extension closure: **open**
- Parent-P0 closure through this extension: **open**

## 12. Follow-up rerun evidence recorded after audited revision
The approved follow-up package `specs/p0-extra-closure-followup/` reran the mandatory local quality gates in the supported Node 20 runtime and recorded:
- `npx -y node@20 -v` → `v20.20.2`
- `npx -y node@20 "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run lint` → pass, exit `0`
- `npx -y node@20 "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run typecheck` → pass, exit `0`
- `npx -y node@20 "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run build` → pass, exit `0`
- `npx -y node@20 "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run test` → pass, exit `0`
- `npx -y node@20 "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run verify` → pass, exit `0`
- `node -e "const pkg=require('./package.json'); console.log(pkg.scripts.verify)"` → confirmed fail-fast chain `npm run lint && npm run typecheck && npm run build && npm run test`

These reruns strengthen local supported-runtime evidence, but they do not close the extension because clean replay evidence remains unresolved.

## 13. Follow-up real CI rerun evidence
The approved follow-up package `specs/p0-extra-closure-followup/` captured a failed real GitHub Actions workflow run:
- workflow: `p0-quality-gates`
- event: `pull_request`
- run ID: `29288885694`
- branch: `19-p0-extra-quality-gates-inclusion`
- commit: `b86f09ec289b470d0ef8fbde46bfec7b2da3b79b`
- status: `completed`
- conclusion: `failure`
- job ID: `86947744464`
- job name: `quality-gates`
- job conclusion: `failure`

This preserved run remains part of the negative evidence set, but it is now superseded by a later successful real CI run rather than representing the latest CI truth state.

## 14. Follow-up fresh clean replay evidence
The approved follow-up package also executed a fresh clean replay attempt under the repository-owned compose stack:
- app runtime: `Node v20.20.2`
- database engine: `PostgreSQL 16.14`
- disposable database: `tracksys_replay_followup_20260713`
- create database step: passed
- migrate deploy step: passed and reported 22 migrations applied
- post-migration inspection from service `db`: failed because the target database did not exist
- seed step: failed because the target database did not exist
- final database listing from service `db`: target absent

This reproduces the same operational inconsistency already preserved historically. Therefore the replay is no longer merely incomplete; it now has a fresh, reproducible, compose-aligned **failed / environment blocked** classification that still prevents truthful closure even after CI succeeded.

## 15. Task closure update for TASK-P0X-001 through TASK-P0X-003
### Tasks completed
- `TASK-P0X-001` — Reconcile the audited current state
- `TASK-P0X-002` — Formalize the quality-gate contract
- `TASK-P0X-003` — Align runtime contract
- `TASK-P0X-004` — Validate and correct CI quality-gate integration
- `TASK-P0X-005` — Define the canonical clean database replay
- `TASK-P0X-006` — Execute and record a clean database replay
- `TASK-P0X-007` — Resolve documentation drift
- `TASK-P0X-008` — Establish validation evidence registry
- `TASK-P0X-009` — Run all mandatory quality gates
- `TASK-P0X-010` — Obtain a real CI validation result

### Basis for completion
- `TASK-P0X-001` is satisfied because the package now explicitly distinguishes technical implementation from validated closure, lists documentation drift, preserves failed CI evidence, and classifies replay truthfully as failed / environment blocked.
- `TASK-P0X-002` is satisfied because `specs/p0-extra-inclusion/quality-gates-analysis.md` defines command purpose, configuration source, scope, exclusions, required environment, expected exit behavior, mandatory/optional classification, and required evidence for lint, typecheck, build, test, and verify.
- `TASK-P0X-003` is satisfied because the supported Node runtime is identified from repository evidence, `engines.node` is defined as `>=20 <21`, README documents Node 20.x, Docker uses Node 20, CI uses Node 20, and historical runtime drift remains preserved rather than hidden.
- `TASK-P0X-004` is satisfied because the workflow path, triggers, runtime, install command, executed scripts, cache behavior, and absence of database services are documented; failed CI runs remain preserved; and a later successful real workflow run now exists as closure-satisfying CI evidence.
- `TASK-P0X-005` is satisfied because the canonical replay path now explicitly defines disposable database creation, committed migration application using repository-owned tooling, committed seed execution, startup or `/health` smoke validation, cleanup/reset behavior, and truthful result classifications.
- `TASK-P0X-006` is satisfied because a real replay attempt was executed end to end from disposable-database creation through migration attempt, seed attempt, smoke validation, and cleanup, with every command and exit code preserved and the final failed/environment-blocked classification recorded.
- `TASK-P0X-007` is satisfied because README, current-state analysis, quality-gates analysis, replay instructions, traceability, and changelog language now match the actual repository commands, Node 20 runtime contract, CI workflow behavior, and preserved replay classification rather than implying replay success.
- `TASK-P0X-008` is satisfied because the evidence registry now defines identifiers, statuses, required fields, and durable links from evidence items to tasks and requirements while preserving failed and superseded attempts.
- `TASK-P0X-009` is satisfied because `lint`, `typecheck`, `build`, `test`, and `verify` were executed again in supported runtime `Node v20.20.2`, each exit code was recorded, a failed `verify` run preserved fail-fast propagation from a mandatory child command, and a later passing rerun was preserved without hiding the earlier failure.
- `TASK-P0X-010` is satisfied because preserved real GitHub Actions evidence already exists for current HEAD commit `5c16b2c91e22b49085e1cb7f72a3ae58bd1bf50f`: workflow run `29383737072` passed under Node 20 while earlier failed runs `29287056129` and `29288885694` remain preserved and linked.

### Validation approach used for these task closures
- Repository/specification document comparison
- Runtime-source comparison across `package.json`, README, Dockerfile, and GitHub Actions workflow
- Workflow-to-script comparison against `.github/workflows/p0-quality-gates.yml`
- Replay-documentation review against `inventory-api/prisma/migration-instructions.md`, `inventory-api/docker-compose.yml`, `inventory-api/Dockerfile`, `inventory-api/package.json`, `inventory-api/prisma/seed.js`, `inventory-api/scripts/apply-committed-migrations.js`, and `/health` route implementation
- Traceability and evidence review against `specs/p0-extra-inclusion/traceability.md` and `specs/p0-extra-inclusion/validation-evidence.md`

### Outcome
These task completions do not change the overall closure result of the extension package. Clean replay remains unresolved, so the package closure remains failed.

## 19. TASK-P0X-010 execution record
### Selected task
- `TASK-P0X-010` — Obtain a real CI validation result

### Remote-execution capability check
- `gh --version` → exit `1` (`gh` not installed in this environment)
- `gh auth status` → exit `1` (`gh` not installed in this environment)
- This environment therefore could not dispatch or inspect a new workflow run interactively.

### Authoritative real CI evidence used
- Workflow: `.github/workflows/p0-quality-gates.yml`
- Successful run: `29383737072`
- Job: `87252601412`
- Commit: `5c16b2c91e22b49085e1cb7f72a3ae58bd1bf50f`
- Branch: `19-p0-extra-quality-gates-inclusion`
- Runtime: Node `20`
- Install command: `npm ci`
- Executed scripts: `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test`
- Final status: `success`

### Preserved negative CI evidence
- Failed run `29287056129` remained preserved as `EVID-CI-001`
- Failed run `29288885694` remained preserved as `EVID-CI-002`
- Successful run `29383737072` remained preserved as `EVID-CI-003`

### Acceptance-criteria assessment
- Workflow execution is linked to a commit.
- Node version is recorded.
- Mandatory scripts executed in the real workflow.
- Final workflow status is recorded.
- Failed jobs remain visible.
- Closure continues to require a successful run or explicit approved exception; in this case, the successful run already exists.

### Truthful outcome
- Real CI validation is satisfied for the current HEAD commit through preserved authoritative evidence.
- No new remote run was executed from this environment because GitHub CLI access is unavailable here.
- Overall package closure remains failed because replay is still the blocking condition.

## 18. TASK-P0X-009 execution record
### Selected task
- `TASK-P0X-009` — Run all mandatory quality gates

### Supported runtime
- `npx -y node@20 -v` → `v20.20.2` (exit `0`)
- Branch: `19-p0-extra-quality-gates-inclusion`
- Commit: `5c16b2c91e22b49085e1cb7f72a3ae58bd1bf50f`

### Commands executed
1. `npx -y node@20 "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run lint` → exit `0`
2. `npx -y node@20 "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run typecheck` → exit `0`
3. `npx -y node@20 "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run build` → exit `0`
4. `npx -y node@20 "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run test -- --silent` → exit `1`
5. `npx -y node@20 "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run test` → exit `0`
6. `node -e "const pkg=require('./package.json'); console.log(pkg.scripts.verify)"` → exit `0`
7. `npx -y node@20 "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run verify` → exit `1`
8. `npx -y node@20 "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run test -- tests/client-document-security.test.js` → exit `0`
9. `npx -y node@20 "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run test` → exit `0`
10. `npx -y node@20 "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run verify` → exit `0`

### Classification notes
- Command 4 is **not** classified as a repository gate failure. The repository `test` script uses explicit `node --test` file arguments, and the appended `--silent` became an invalid path-like argument (`--silent`) for this script shape.
- Command 7 is classified as a real failed `verify` run. `verify` executed `lint`, `typecheck`, and `build`, then failed when child command `test` failed one assertion in `tests/client-document-security.test.js`.
- Commands 8, 9, and 10 show that the same suite and the aggregate `verify` command passed on rerun in the same supported runtime, so the preserved failed run is treated as intermittent/flaky evidence rather than a deterministic persistent failure.

### Acceptance-criteria assessment
- Every mandatory command was executed in the supported environment.
- Every exit code was recorded.
- Scope and exclusions remained those defined by `package.json`, `eslint.config.js`, and `tsconfig.typecheck.json`.
- Failures were classified truthfully and not reported as passes.
- `verify` fail-fast propagation was evidenced by the failed run that stopped with non-zero exit after child `test` failed.
- Fresh evidence records were created in `validation-evidence.md`.

### Truthful outcome
- Local mandatory quality gates are evidenced under supported runtime.
- A preserved intermittent failed `verify` run exists and is superseded by a later passing rerun.
- Overall package closure remains failed because replay is still the blocking condition.

## 17. TASK-P0X-007 execution record
### Selected task
- `TASK-P0X-007` — Resolve documentation drift

### Related requirements
- `FR-P0X-007` Runtime alignment
- `FR-P0X-010` Original P0 propagation
- `FR-P0X-011` Negative evidence preservation
- `FR-P0X-012` Truthful closure classification

### Files reviewed and aligned
- `inventory-api/package.json`
- `inventory-api/README.md`
- `.github/workflows/p0-quality-gates.yml`
- `inventory-api/Dockerfile`
- `inventory-api/prisma/migration-instructions.md`
- `specs/p0-extra-inclusion/current-state.md`
- `specs/p0-extra-inclusion/quality-gates-analysis.md`
- `specs/p0-extra-inclusion/traceability.md`
- `specs/p0-extra-inclusion/changelog.md`

### Drift reconciled
- README runtime and quality-gate commands remain aligned with `package.json` and the Node 20 contract.
- CI documentation remains aligned with the actual workflow, which runs `lint`, `typecheck`, `build`, and `test`, but not `verify` directly.
- Replay documentation now states the actual baseline behavior observed in `EVID-DB-004`: the committed `app` image does not include `scripts/apply-committed-migrations.js`, so the canonical compose migration step currently fails.
- Package-level documents now distinguish clearly between aligned documentation and unresolved operational closure blockers.

### Validation approach
- document-to-document comparison against `package.json`, `Dockerfile`, workflow YAML, and replay evidence
- evidence-to-document consistency review using `EVID-RUNTIME-001` and `EVID-DB-004`
- post-edit consistency review across README, current-state analysis, and replay instructions

### Truthful outcome
- Documentation drift for the audited package is now resolved.
- Overall package closure remains failed because replay execution is still failed / environment blocked.

## 16. TASK-P0X-006 execution record
### Selected task
- `TASK-P0X-006` — Execute and record a clean database replay

### Environment baseline
- Supported runtime probe: `npx -y node@20 -v` → `v20.20.2` (exit `0`)
- Docker: `docker version` → client/server `27.3.1` (exit `0`)
- Docker Compose: `docker compose version` → `v2.29.7-desktop.1` (exit `0`)
- Compose services: `docker compose config --services` → `db`, `app` (exit `0`)
- Database engine: `PostgreSQL 16.14` from service `db` (exit `0`)

### Commands executed
1. `docker compose build app` → exit `0`
2. `docker compose up -d db` → exit `0`
3. `docker compose exec -T db sh -lc "psql -U tracksys -d postgres -Atc 'SELECT version();'"` → exit `0`
4. `docker compose exec -T db sh -lc "psql -U tracksys -d postgres -c 'DROP DATABASE IF EXISTS tracksys_replay_validation;' && psql -U tracksys -d postgres -c 'CREATE DATABASE tracksys_replay_validation;'"` → exit `0`
5. `docker compose exec -T db sh -lc "psql -U tracksys -d postgres -Atc \"SELECT datname FROM pg_database WHERE datname='tracksys_replay_validation';\""` → exit `0`, empty stdout on this specific probe
6. `docker compose exec -T db sh -lc "psql -U tracksys -d postgres -Atc 'SELECT datname FROM pg_database ORDER BY datname;'"` → exit `0`, disposable DB visible in full listing
7. `docker compose run --rm -e DATABASE_URL=postgresql://tracksys:tracksys@db:5432/tracksys_replay_validation?schema=public app npm run prisma:apply-committed-migrations` → exit `1`
8. `docker compose exec -T db sh -lc "psql -U tracksys -d tracksys_replay_validation -Atc \"SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;\""` → exit `0`, empty stdout
9. `docker compose run --rm -e DATABASE_URL=postgresql://tracksys:tracksys@db:5432/tracksys_replay_validation?schema=public app npm run prisma:seed` → exit `1`
10. `docker compose run --rm -e DATABASE_URL=postgresql://tracksys:tracksys@db:5432/tracksys_replay_validation?schema=public -e PORT=2500 app node -e "const http=require('http'); const app=require('./src/app'); const server=app.listen(2500,()=>{ http.get('http://127.0.0.1:2500/health',res=>{ console.log('health-status', res.statusCode); server.close(()=>process.exit(res.statusCode===200?0:1)); }).on('error',err=>{ console.error(err); server.close(()=>process.exit(1)); }); });"` → exit `0`
11. `docker compose exec -T db sh -lc "psql -U tracksys -d postgres -c 'DROP DATABASE IF EXISTS tracksys_replay_validation;'"` → exit `0`

### Observed results
- The disposable database was created successfully.
- A direct single-database existence probe returned empty stdout even though the subsequent full listing showed `tracksys_replay_validation` present.
- The canonical migration step failed immediately because the committed app image did not contain `/app/scripts/apply-committed-migrations.js`.
- Physical table inspection after the failed migration step returned no tables in `public`.
- Seed failed with Prisma error `P2021` because table `public.Role` did not exist.
- `/health` smoke validation returned `200`, proving the process can start even though replayed schema initialization failed.

### Truthful classification
- Latest replay run classification: **Failed / Environment blocked**
- Reason:
  - the repository-owned canonical migration step could not execute successfully inside the committed `app` image;
  - no physical schema was created in the disposable target;
  - seed failed due missing tables;
  - startup smoke alone is insufficient to treat replay as passed.

### Evidence linkage
- Recorded as `EVID-DB-004` in `specs/p0-extra-inclusion/validation-evidence.md`
- Preserves and supersedes earlier replay attempts `EVID-DB-001`, `EVID-DB-002`, and `EVID-DB-003` without deleting them
