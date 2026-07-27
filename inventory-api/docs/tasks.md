# Tasks

## TASK-001: Implement confirmed tenant-isolation fixes from P11 inventory
**Status:** Completed
**Completed at:** 2026-07-27
**Evidence:** `specs/p11-tenant-isolation-fixes/implementation-report.md`
**Priority:** Critical
**Domain:** Multi-tenant repository governance
**Requirement:** P11 FR-004, FR-005, FR-006, FR-007, FR-008, BR-002, BR-003, AC-002, AC-004
**Reason:** P11 planning already completed the repository-wide inventory and confirmed write paths that remain unsafe or need hardening review.
**Current problem:** Confirmed and review-required mutations still rely on `id`-only writes or derived context instead of preserving company scope at the repository mutation boundary.
**Proposed change:** Harden the confirmed P11 inventory cases first (`client.repository.js`, `order.repository.js`, `sales-route.repository.js`) and resolve review-required cases (`findOrCreateLegalEntity`, payment-receipt replacement, dormant product helper) with explicit tenant-safe behavior.
**Affected files:** `src/repositories/client.repository.js`, `src/repositories/order.repository.js`, `src/repositories/sales-route.repository.js`, `src/repositories/payment.repository.js`, `src/repositories/product.repository.js`, related services and tests, `specs/p11-audit-emergency-hardening/*`, `docs/current-state.md`, `docs/architecture.md`
**Dependencies:** None
**Database impact:** None expected initially; new migration only if an approved integrity constraint becomes necessary
**API impact:** None expected if current contracts are preserved
**Container impact:** None
**Security impact:** Critical positive impact
**Acceptance criteria:**
- Confirmed unsafe repository writes are tenant-safe at the mutation boundary.
- Review-required write paths are either hardened or documented as legitimate exceptions with evidence.
- Legitimate root-global flows remain functional.
**Required tests:** Cross-tenant regression tests for client documents, orders, routes, legal entities, and payment receipt replacement
**Migration considerations:** Preserve current public behavior while tightening internal write scoping.
**Rollback or mitigation:** Revert affected repository/service slice if a legitimate flow breaks; keep regression evidence.
**Risk:** High

## TASK-002: Remove direct Prisma usage from root company bootstrap flow
**Status:** Completed
**Completed at:** 2026-07-27
**Evidence:** `specs/p11-repository-boundary-root-bootstrap/implementation-report.md`
**Priority:** High
**Domain:** Company administration / Architecture governance
**Requirement:** P11 FR-004, FR-005, FR-007, BR-002, AC-003
**Reason:** P11 confirmed a repository-boundary violation in `src/services/company.service.js#registerRootCompany`.
**Current problem:** The service layer performs direct `prisma.user.findUnique(...)` and `prisma.$transaction(...)` operations instead of delegating persistence ownership to repositories.
**Proposed change:** Introduce repository-owned persistence orchestration for root company bootstrap while preserving current transaction semantics, audit behavior, and root-global authorization constraints.
**Affected files:** `src/services/company.service.js`, `src/repositories/company.repository.js`, possible supporting repositories, related tests, `docs/current-state.md`, `docs/architecture.md`, `specs/p11-audit-emergency-hardening/*`
**Dependencies:** TASK-001
**Database impact:** None
**API impact:** None expected
**Container impact:** None
**Security impact:** Medium positive impact through cleaner boundary enforcement
**Acceptance criteria:**
- `company.service.js` no longer uses Prisma directly in the root bootstrap flow.
- Transaction behavior and audit logging remain functionally equivalent.
- Root-global company creation behavior is preserved.
**Required tests:** Service/repository regression tests for root company bootstrap and duplicate-admin conflict handling
**Migration considerations:** Preserve root-global exception behavior while moving persistence responsibilities.
**Rollback or mitigation:** Revert repository extraction slice if bootstrap semantics drift.
**Risk:** Medium

## TASK-003: Expand typecheck coverage and enforce stronger CI evidence for critical controls
**Status:** Completed
**Completed at:** 2026-07-27
**Evidence:** `specs/p11-typecheck-ci-hardening/implementation-report.md`
**Priority:** High
**Domain:** Platform / CI governance
**Requirement:** P11 FR-005, FR-011, FR-012, FR-013, FR-014, FR-015, BR-005, AC-003, AC-006, AC-007
**Reason:** P11 completed the evidence classification work but the repository still implements only partial typecheck coverage and incomplete mandatory CI mapping.
**Current problem:** `tsconfig.typecheck.json` excludes relevant repository/schema areas, some important controls rely on characterization or optional evidence, and at least one strong DB-constraint test is not confirmed as a mandatory CI gate.
**Proposed change:** Expand `tsconfig.typecheck.json` incrementally, classify critical tests in repository docs/workflows, and ensure important security, business-logic, and data-quality controls are covered by required GitHub Actions jobs or documented exceptions.
**Affected files:** `tsconfig.typecheck.json`, `.github/workflows/*`, `tests/*.test.js`, `scripts/run-tests.js`, related governance scripts/docs, `specs/p11-audit-emergency-hardening/*`, `docs/action-plan.md`
**Dependencies:** TASK-001, TASK-002
**Database impact:** None directly
**API impact:** None
**Container impact:** Possible CI/runtime image alignment later
**Security impact:** High positive impact through stronger verification
**Acceptance criteria:**
- Typecheck coverage is expanded over approved repository/schema surfaces.
- Critical controls have required CI jobs or approved documented exceptions.
- Characterization-only and optional tests are not treated as sole closure evidence for critical controls.
**Required tests:** Updated static checks, workflow validation, and any new CI-governance tests
**Migration considerations:** Expand coverage incrementally to keep signal actionable.
**Rollback or mitigation:** Revert the last coverage expansion slice if it blocks unrelated work without clear remediation path.
**Risk:** High

## TASK-004: Migrate the repository baseline to Node.js 24 LTS and record mainline validation
**Status:** Implemented
**Updated at:** 2025-08-11
**Evidence:** `specs/p11-node24-runtime-migration/implementation-report.md`
**Priority:** High
**Domain:** Runtime platform baseline
**Requirement:** P11 FR-003, FR-004, FR-005, FR-006, FR-007, FR-009, FR-010, FR-013, FR-015, AC-001, AC-002, AC-003, AC-005, AC-007
**Reason:** P11 required the real repository baseline to move from Node 20 to Node.js 24 LTS with actual compatibility evidence rather than a documentation-only version bump.
**Current problem:** The repository previously declared Node 20 in `package.json`, `Dockerfile`, and relevant workflows, and a historical Node 24 rerun had reported `PrismaClient is not a constructor`.
**Proposed change:** Align package/runtime/workflow Node baselines to Node 24, preserve the existing Prisma bootstrap when compatible, and revalidate the mainline local/Linux path.
**Affected files:** `package.json`, `Dockerfile`, `.github/workflows/*`, `scripts/prisma-generate-safe-lib.js`, `scripts/validate-workflow-baseline.js`, workflow characterization tests, `README.md`, `specs/p11-node24-runtime-migration/*`, `docs/current-state.md`, `docs/architecture.md`
**Dependencies:** TASK-003
**Database impact:** None
**API impact:** None
**Container impact:** Declarative runtime/build image updated to Node 24; local `docker build -t inventory-api:node24-smoke .` evidence is now recorded
**Security impact:** Medium positive impact through supported-platform alignment
**Acceptance criteria:**
- Repository baseline targets Node.js 24 LTS in package/runtime/workflow configuration.
- The previously reported Prisma constructor incompatibility is no longer reproduced on the validated clean Node 24 path.
- Mainline validation evidence is recorded for install, build, lint, typecheck, focused Prisma regression, workflow baseline, public runtime, operational readiness, production baseline, and aggregate tests.
**Required tests:** `npm ci`, `npm run build`, `npm run lint`, `npm run typecheck`, `node --test tests/taxpayer-characterization.test.js`, `npm run validate:workflow-baseline`, `node --test tests/workflow-baseline-characterization.test.js tests/prisma-windows-build-stabilization.test.js`, `npm run validate:public-runtime`, `npm run validate:operational-readiness`, `npm run validate:production-baseline`, `npm test -- --silent`
**Migration considerations:** Keep the Windows Prisma rename-lock behavior classified as a pre-existing baseline issue unless hosted evidence proves a new regression.
**Rollback or mitigation:** Revert Node baseline declarations only if pending cross-surface validation reveals a critical incompatibility that cannot be isolated safely.
**Risk:** Medium

## TASK-005: Complete cross-surface closure evidence for the Node.js 24 baseline
**Status:** Proposed
**Priority:** High
**Domain:** Runtime platform baseline / CI evidence
**Requirement:** P11 FR-008, FR-009, FR-012, FR-016, AC-003, AC-004, AC-006, AC-008
**Reason:** The Node 24 baseline is implemented and strongly validated on the local/mainline path, but the feature should not be claimed fully finished until the remaining required surfaces are evidenced.
**Current problem:** `npm run test:e2e:browser` and `docker build` now pass locally on the Node 24 baseline, but the available public hosted `windows-prisma-build` review still reflects the historical Node 20 workflow, so full closure evidence is still incomplete.
**Proposed change:** Push the updated workflow and execute a fresh hosted `windows-prisma-build` run on the Node 24 baseline; then refresh closure status and rollback notes if the evidence remains green.
**Affected files:** `specs/p11-node24-runtime-migration/implementation-report.md`, `specs/p11-node24-runtime-migration/traceability.md`, `specs/p11-node24-runtime-migration/risks.md`, `docs/action-plan.md`, `docs/tasks.md`, any evidence docs required by the workflow run review
**Dependencies:** TASK-004
**Database impact:** None expected
**API impact:** None expected
**Container impact:** No new container change required; Docker build evidence is already recorded for the implemented Node 24 baseline
**Security impact:** Low direct impact; medium governance impact through stronger release evidence
**Acceptance criteria:**
- `npm run test:e2e:browser` is executed on the Node 24 baseline and its result is recorded. ✅
- `docker build` is executed against the Node 24 Dockerfile and its result is recorded. ✅
- A hosted `windows-prisma-build` Node 24 workflow run is reviewed and classified against the known rename-lock baseline.
- Documentation clearly distinguishes implemented Node 24 baseline from any still-open validation exception.
**Required tests:** hosted `.github/workflows/windows-prisma-build.yml` run review on the updated Node 24 workflow
**Migration considerations:** Treat any new hosted Windows failure signature separately from the historical rename-lock path.
**Rollback or mitigation:** If one pending surface fails, keep Node 24 baseline documented as implemented but reopen the relevant compatibility task instead of claiming full closure.
**Risk:** High
