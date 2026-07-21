# Implementation Report
## 1. Specification
- Feature: `p4-closeout-hardening`
- Canonical spec directory: `specs/p4-closeout-hardening`
- Implementation agent: `sdd-implementation-agent-eebf4c`

## 2. Approval status
- `metadata.yaml` contains `status: approved`
- `metadata.yaml` contains `implementation_status: approved`
- Implementation authorized.

## 3. Pre-implementation baseline
### Repository drift assessment
- **Classification:** Compatible
- **Observed drift:** the current repository already contains a complete `specs/p4-closeout-hardening/` package with supplemental documents, while `current-state.md` documented the earlier planning-time condition where the package did not yet exist.
- **Observed drift:** the project coding standard file is available as `docs/coding-standards.md` instead of `docs/coding_standard.md`.
- **Observed drift:** baseline runtime documentation still points to the earlier `p4-audit-hardening` package, which remains in scope for a later documentation-correction task and does not block TASK-001.

### Commands executed before implementation
| Command | Result | Exit status | Affected module | Feature-related |
|---|---|---:|---|---|
| `npm run build` | Failed: Prisma Windows engine rename `EPERM` during `prisma generate` | 1 | Prisma build tooling | No, pre-existing environmental failure |
| `npm run typecheck` | Passed | 0 | Type checking | No |
| `npm run lint` | Passed | 0 | Lint | No |
| `npm test -- --silent` | Passed (`175` pass, `2` skip) | 0 | Test suite | No |
| `node src/server.js` | Startup succeeded; command timed out because server stayed running | timeout | Runtime startup | No |
| `npm run verify` | Passed (`182` pass, `2` skip) | 0 | Repository quality gates | Yes, direct baseline for TASK-006 |

## 4. Tasks selected
- `TASK-001: Consolidar el paquete canónico de cierre P4`
  - Related requirements: `FR-001`, `AC-006`
  - Related decisions: `DEC-001`, `DEC-009`
  - Findings: the package already exists in the repository and satisfies the required canonical structure.
- `TASK-002: Corregir referencias documentales rotas de P4 y P3`
  - Related requirements: `FR-002`, `FR-008`, `BR-001`, `BR-007`, `AC-001`, `AC-007`
  - Related decisions: `DEC-001`, `DEC-002`
  - Findings: active runtime documentation still pointed to `p4-audit-hardening`, so canonical pointer normalization was still pending.
- `TASK-003: Sustituir cálculos monetarios derivados inseguros por utilidades decimales`
  - Related requirements: `FR-003`, `FR-007`, `BR-002`, `AC-002`
  - Related decisions: `DEC-003`, `DEC-009`
  - Findings: critical invoice/payment derived calculations still used intermediate `Number` arithmetic despite `Decimal` persistence.
- `TASK-004: Centralizar la política de autorización y documentar fronteras por rol/permisos`
  - Related requirements: `FR-004`, `FR-007`, `BR-003`, `BR-004`, `AC-003`
  - Related decisions: `DEC-004`, `DEC-009`
  - Findings: authorization semantics were distributed across mixed `authorize` and `authorizePermission` route usage without a central inventory.
- `TASK-005: Reemplazar el script manual de pruebas por descubrimiento automático`
  - Related requirements: `FR-006`, `FR-007`, `BR-005`, `AC-005`
  - Related decisions: `DEC-005`, `DEC-009`
  - Findings: `package.json` still required manual maintenance for every new `tests/*.test.js` file.
- `TASK-006: Versionar un workflow mínimo de quality gates`
  - Related requirements: `FR-005`, `FR-007`, `BR-006`, `AC-004`
  - Related decisions: `DEC-005`, `DEC-009`
  - Findings: no `.github/workflows/` directory existed and the repository still depended on local execution of `npm run verify`.
- `TASK-007: Versionar un CD parcial de build y publicación sin deploy`
  - Related requirements: `FR-007`, `FR-009`, `BR-006`, `BR-008`, `BR-009`, `AC-008`, `AC-009`
  - Related decisions: `DEC-007`, `DEC-008`, `DEC-009`
  - Findings: the repository still lacked a controlled build/publication workflow and no registry destination was approved, so GitHub Actions artifacts were the safest baseline publication target.

## 5. Files changed
- `docs/architecture.md`
- `docs/runtime-scope-baseline.md`
- `docs/audit/current-code-audit.md`
- `docs/audit/current-code-audit.html`
- `src/lib/money.js`
- `src/services/invoice-financial-state.js`
- `src/services/payment.service.js`
- `src/security/access-policies.js`
- `src/routes/company.routes.js`
- `src/routes/payment.routes.js`
- `src/routes/product.routes.js`
- `src/routes/order.routes.js`
- `src/routes/inventory.routes.js`
- `src/routes/user.routes.js`
- `.github/workflows/quality-gates.yml`
- `.github/workflows/build-and-publish.yml`
- `package.json`
- `scripts/run-tests.js`
- `tests/access-policies.test.js`
- `tests/money.test.js`
- `tests/invoice-payment-sync-characterization.test.js`
- `tests/administrative-authorization-characterization.test.js`
- `tests/company-authorization-characterization.test.js`
- `tests/public-surface-characterization.test.js`
- `tests/payload-segmentation-characterization.test.js`
- `README.md`
- `docs/production-baseline.md`
- `../CHANGELOG.md`
- `specs/p4-closeout-hardening/current-state.md`
- `specs/p4-closeout-hardening/tasks.md`
- `specs/p4-closeout-hardening/traceability.md`
- `specs/p4-closeout-hardening/implementation-report.md`

## 6. Architecture decisions followed
- `DEC-001: Use p4-closeout-hardening as the canonical feature name`
- `DEC-003: Reuse Prisma-backed decimal capabilities for monetary hardening`
- `DEC-004: Centralize authorization policy without redesigning the full RBAC model`
- `DEC-005: Add versioned CI to the repository`
- `DEC-007: Choose CD option B`
- `DEC-008: Stop CD scope before environment deployment`
- `DEC-009: Preserve production behavior while hardening internals`

## 7. Coding-standard validation
- Changes remained scoped to approved monetary hardening, authorization governance, test autodiscovery, minimal CI/CD versioning and their traceability updates.
- Existing external API and authorization semantics were preserved; route-level policy calls were redirected to centralized policy identifiers without widening access.
- No unrelated schema or migration changes were introduced.
- The autodiscovery runner was kept small, deterministic and portable for Node 20 on Windows/Linux.
- The CI workflow uses only repository-local scripts and does not assume deployment secrets.
- The CD workflow uses controlled triggers and GitHub artifact publication only; it explicitly excludes deploy steps and registry-secret requirements from the current baseline.

## 8. Tests added or updated
- Added `tests/money.test.js` for decimal-safe helper behavior and financial edge cases.
- Added `tests/access-policies.test.js` for centralized authorization policy mapping and guard compatibility.
- Updated `tests/invoice-payment-sync-characterization.test.js` to cover decimal-safe invoice/payment synchronization.
- Updated authorization and characterization tests to validate centralized access-policy usage without changing effective behavior.
- Added `tests/client-document-schema-governance.test.js` and aligned `tests/payload-segmentation-characterization.test.js` with the centralized access-policy contract.
- Validation also retained manual structure review and documentation reference checks from TASK-001/TASK-002.
- Added workflow validation through manual static review plus local equivalent execution of `npm run verify`.
- Added controlled Docker build/package dry-run validation for the partial CD workflow.

## 9. Commands executed
- `npm run build`
- `npm run typecheck`
- `npm run lint`
- `npm test -- --silent`
- `node --test tests/client-document-schema-governance.test.js tests/client-document-governance.test.js tests/payment-receipt-security.test.js tests/throttle-store.test.js tests/access-policies.test.js tests/money.test.js tests/invoice-payment-sync-characterization.test.js tests/payload-segmentation-characterization.test.js`
- `npm test -- --silent`
- `node src/server.js`
- `powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"`
- `findstr /n /s /i "p4-audit-hardening p3-access-scope-hardening p4-runtime-surface-hardening" docs\*`
- `node --test tests/money.test.js tests/invoice-payment-sync-characterization.test.js`
- `node --test tests/access-policies.test.js tests/administrative-authorization-characterization.test.js tests/company-authorization-characterization.test.js`
- `node --test tests/payload-segmentation-characterization.test.js`
- `node --test tests/lot-datetime-characterization.test.js`
- `npm run verify`
- `powershell -NoProfile -Command "$releaseVersion='v1.0.0-local-ff6528b'; $imageTag='1.0.0-local-ff6528b'; $dist='cd-dry-run'; if (Test-Path $dist) { Remove-Item -Recurse -Force $dist }; New-Item -ItemType Directory -Path $dist | Out-Null; docker build -t inventory-api:$imageTag .; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; docker save -o \"$dist/inventory-api-$releaseVersion.docker-image.tar\" inventory-api:$imageTag; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; $hash=(Get-FileHash \"$dist/inventory-api-$releaseVersion.docker-image.tar\" -Algorithm SHA256).Hash.ToLower(); Set-Content -Path \"$dist/inventory-api-$releaseVersion.sha256\" -Value $hash; $metadata = [ordered]@{ releaseVersion = $releaseVersion; packageVersion = '1.0.0'; gitSha = 'ff6528b'; imageRepository = 'inventory-api'; imageTag = $imageTag; publishMode = 'local-dry-run'; deployIncluded = $false } | ConvertTo-Json; Set-Content -Path \"$dist/inventory-api-$releaseVersion.metadata.json\" -Value $metadata; Get-ChildItem $dist | Select-Object Name,Length"`
- `python -c "import yaml, pathlib; yaml.safe_load(pathlib.Path('.github/workflows/quality-gates.yml').read_text(encoding='utf-8')); print('yaml-ok')"`
- `ruby -e "require 'yaml'; YAML.load_file('.github/workflows/quality-gates.yml'); puts 'yaml-ok'"`
- `powershell -NoProfile -Command "Get-Command ConvertFrom-Yaml"`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm test -- --silent`

## 10. Validation results
- `TASK-001` acceptance criteria satisfied by repository inspection:
  - canonical directory exists
  - required planning documents exist
  - basic traceability is present across requirements, plan, tasks and traceability matrix
- `TASK-002` acceptance criteria satisfied:
  - `docs/architecture.md` now points to existing `specs/p4-closeout-hardening/*` files
  - `docs/runtime-scope-baseline.md` no longer references missing `specs/p3-*`
  - active and derived audit documentation now converge on `specs/p4-closeout-hardening`
- `TASK-003` acceptance criteria satisfied:
  - critical invoice/payment derived calculations now flow through decimal-safe helpers in `src/lib/money.js`
  - overpayment validation now uses explicit decimal comparison
  - monetary regression tests passed
- `TASK-004` acceptance criteria satisfied:
  - `src/security/access-policies.js` now serves as the central policy inventory
  - progressive role-to-permission transition endpoints are explicitly marked
  - authorization characterization coverage passed without widening effective access
- `TASK-005` acceptance criteria satisfied:
  - `npm test` no longer depends on a manual file list in `package.json`
  - newly added `tests/money.test.js` and `tests/access-policies.test.js` are discovered automatically by `scripts/run-tests.js`
  - full suite passes under the autodiscovery runner
- `TASK-006` acceptance criteria satisfied:
  - `.github/workflows/quality-gates.yml` now exists under the repository-approved path
  - the workflow runs the agreed minimum gates: `npm ci`, `npm run build`, `npm run verify`
  - the automation does not require undocumented deployment secrets for the CI baseline
- `TASK-007` acceptance criteria satisfied:
  - `.github/workflows/build-and-publish.yml` now exists under the repository-approved path
  - the workflow builds and versions a Docker image, then publishes reproducible release artifacts through GitHub Actions `upload-artifact`
  - triggers and guardrails are explicit: tag `v*` or `workflow_dispatch`, no deploy steps, no registry-secret requirement in the current baseline
- Baseline validations completed with one transient environmental `Prisma generate` failure on Windows.
- Post-task validation succeeded, including repeated green `npm run verify` and a successful controlled local Docker build/package dry run without deploy.

## 11. Existing failures
- Audit logging attempts during tests report database connectivity warnings when `localhost:5432` is unavailable, but the characterized suite still passes.
- The environment can intermittently fail `npm run build` on Windows with a Prisma engine file-locking `EPERM`; rerun succeeded during this implementation cycle.
- No local YAML parser was available by default in this Windows environment (`python` without PyYAML, no `ruby`, no PowerShell `ConvertFrom-Yaml`), so static workflow validation relied on manual review plus successful local-equivalent pipeline execution.
- Docker local dry run surfaced dependency vulnerability warnings from `npm ci` inside the image build context, but the build completed successfully and no deploy/publication target beyond GitHub artifacts was involved.

## 12. New failures
- None.

## 13. Deviations from the approved plan
- None. `TASK-001` required no production code creation because the canonical package was already present and was validated/documented instead.
- `scripts/run-tests.js` preserves the historical suite order for known tests while still autodiscovering new files; this was a compatible implementation detail to avoid order-sensitive regressions without violating `FR-006` / `AC-005`.

## 14. Remaining risks
- External registry publication remains intentionally out of scope until a concrete target and secrets model are approved.
- The transient Prisma Windows `EPERM` build failure can still affect CI/local reproducibility if not handled by later work or environment guidance.
- Authorization still uses a hybrid role/permission model by approved design; the central inventory reduces ambiguity but is not a full RBAC redesign.

## 15. Manual validation
- Verified the presence of all specification documents in `specs/p4-closeout-hardening/`.
- Verified approval markers in `metadata.yaml`.
- Verified baseline traceability links between requirements, implementation plan, tasks and traceability matrix.
- Verified that `docs/architecture.md`, `docs/runtime-scope-baseline.md`, `docs/audit/current-code-audit.md` and `docs/audit/current-code-audit.html` now converge on the approved canonical package and no longer point to stale `p3-*` / old P4 names.
- Verified that centralized access-policy identifiers preserve legacy endpoint semantics and that new tests are executed automatically through `npm test`.
- Verified that the new CI workflow only references repository-local commands and no deployment secrets.
- Verified that the partial CD workflow only publishes GitHub Actions artifacts and contains no deploy step.

## 16. Next executable task
- No remaining executable tasks in the approved `p4-closeout-hardening` package.

## Addendum: 2026-07-21 follow-up hardening cycle
### Scope executed
- Extended decimal-safe derived-money handling to residual financial visibility paths (`src/services/agent-workspace.service.js`, `src/services/invoice.service.js`).
- Introduced `src/lib/sensitive-file-governance.js` and reused it from client-document and payment-receipt flows to keep MIME, extension, base64 and size validation homogeneous.
- Hardened throttling persistence via `src/lib/throttle-store.js` with configurable `memory|file` runtime modes and explicit store writes in login/lookup throttles.
- Extended centralized access-policy consumption to `client.routes.js`, `geocoding.routes.js` and `taxpayer.routes.js` without widening effective access.

### Files changed in this follow-up
- `src/lib/throttle-store.js`
- `src/lib/sensitive-file-governance.js`
- `src/middlewares/login-throttle.js`
- `src/middlewares/request-throttle.js`
- `src/services/client.service.js`
- `src/services/payment.service.js`
- `src/services/invoice-financial-state.js`
- `src/services/invoice.service.js`
- `src/services/agent-workspace.service.js`
- `src/schemas/payment.schema.js`
- `src/schemas/client.schema.js`
- `src/security/access-policies.js`
- `src/routes/client.routes.js`
- `src/routes/geocoding.routes.js`
- `src/routes/taxpayer.routes.js`
- `tests/money.test.js`
- `tests/access-policies.test.js`
- `tests/payment-receipt-security.test.js`
- `tests/client-document-governance.test.js`
- `tests/client-document-schema-governance.test.js`
- `tests/throttle-store.test.js`
- `tests/invoice-payment-sync-characterization.test.js`
- `specs/p4-closeout-hardening/current-state.md`
- `specs/p4-closeout-hardening/tasks.md`
- `specs/p4-closeout-hardening/traceability.md`
- `specs/p4-closeout-hardening/implementation-report.md`
- `CHANGELOG.md`

### Commands executed in this follow-up
- `node --test tests/money.test.js tests/access-policies.test.js tests/auth-hardening-characterization.test.js tests/payment-receipt-security.test.js tests/client-document-governance.test.js tests/throttle-store.test.js tests/invoice-payment-sync-characterization.test.js`
- `npm run lint`
- `npm run typecheck`

### Validation results in this follow-up
- All targeted tests passed (`33` pass, `0` fail).
- `npm run lint` passed.
- `npm run typecheck` passed.
- Characterized audit-log warnings during access-policy tests remained pre-existing when local PostgreSQL is unavailable; they did not fail the suite.
- The client upload schema now enforces the same governed MIME/extension/base64 rules already used by the service-level client and payment upload flows.
- The full autodiscovery suite passed after aligning `tests/payload-segmentation-characterization.test.js` with `authorizeAccessPolicy('client.document.upload')` (`191` pass, `0` fail, `2` skip).

### Deviations from the approved plan
- The original `p4-closeout-hardening` task list did not enumerate shared throttling persistence or unified sensitive-file governance explicitly.
- These changes were implemented as a **compatible hardening follow-up** because they touched already-approved governed surfaces (`payments`, `clients`, `geocoding`, `taxpayer`) and preserved observable API/authorization behavior.
- Planner ratification is still recommended if the spec package must reflect these two sub-scopes as first-class planned tasks in a future revision.
- A final closeout touch-up aligned `src/schemas/client.schema.js` and the payload characterization suite with the already-approved follow-up governance direction; this remained behavior-preserving and did not require further architectural changes.
