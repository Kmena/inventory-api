# Tasks

## TASK-001: Implement confirmed tenant-isolation fixes from P11 inventory
**Status:** Completed
**Priority:** Critical
**Domain:** Multi-tenant repository governance
**Requirement:** P11 FR-004, FR-005, FR-006, FR-007, FR-008, BR-002, BR-003, AC-002, AC-004
**Reason:** P11 planning identified unsafe or review-required tenant-owned repository writes.
**Current problem:** Confirmed and review-required mutations relied on `id`-only writes or derived context instead of preserving company scope at the repository mutation boundary.
**Proposed change:** Harden the confirmed P11 inventory cases and resolve review-required cases with explicit tenant-safe behavior.
**Affected files:** `src/repositories/client.repository.js`, `src/repositories/order.repository.js`, `src/repositories/sales-route.repository.js`, `src/repositories/payment.repository.js`, `src/repositories/product.repository.js`, related services/tests/docs/specs
**Dependencies:** None
**Database impact:** None expected initially; new migration only if an approved integrity constraint becomes necessary
**API impact:** None expected
**Container impact:** None
**Security impact:** Critical positive impact
**Acceptance criteria:** Confirmed unsafe repository writes are tenant-safe at the mutation boundary; legitimate root-global flows remain functional.
**Required tests:** Cross-tenant regression tests for client documents, orders, routes, legal entities, and payment receipt replacement
**Migration considerations:** Preserve current public behavior while tightening internal write scoping.
**Rollback or mitigation:** Revert affected repository/service slice if a legitimate flow breaks; keep regression evidence.
**Risk:** High

## TASK-002: Remove direct Prisma usage from root company bootstrap flow
**Status:** Completed
**Priority:** High
**Domain:** Company administration / Architecture governance
**Requirement:** P11 FR-004, FR-005, FR-007, BR-002, AC-003
**Reason:** P11 confirmed a repository-boundary violation in `src/services/company.service.js#registerRootCompany`.
**Current problem:** The service layer performed direct Prisma reads and transaction orchestration instead of delegating persistence ownership to repositories.
**Proposed change:** Introduce repository-owned persistence orchestration for root company bootstrap while preserving transaction semantics, audit behavior, and root-global authorization constraints.
**Affected files:** `src/services/company.service.js`, `src/repositories/company.repository.js`, related tests/docs/specs
**Dependencies:** TASK-001
**Database impact:** None
**API impact:** None expected
**Container impact:** None
**Security impact:** Medium positive impact through cleaner boundary enforcement
**Acceptance criteria:** `company.service.js` no longer uses Prisma directly in the root bootstrap flow; transaction and audit behavior remain functionally equivalent.
**Required tests:** Service/repository regression tests for root company bootstrap and duplicate-admin conflict handling
**Migration considerations:** Preserve root-global exception behavior while moving persistence responsibilities.
**Rollback or mitigation:** Revert repository extraction slice if bootstrap semantics drift.
**Risk:** Medium

## TASK-003: Expand typecheck coverage and enforce stronger CI evidence for critical controls
**Status:** Completed
**Priority:** High
**Domain:** Platform / CI governance
**Requirement:** P11 FR-005, FR-011, FR-012, FR-013, FR-014, FR-015, BR-005, AC-003, AC-006, AC-007
**Reason:** P11 classified evidence strength but the repository needed stronger mandatory CI mapping and incremental static coverage.
**Current problem:** Relevant repository/schema areas were excluded from typecheck and some important controls lacked a dedicated required CI gate.
**Proposed change:** Expand approved typecheck coverage incrementally, classify critical tests in repository docs/workflows, and ensure important controls are covered by required jobs or documented exceptions.
**Affected files:** `tsconfig.typecheck.json`, `.github/workflows/*`, `tests/*.test.js`, `scripts/run-tests.js`, governance docs/specs
**Dependencies:** TASK-001, TASK-002
**Database impact:** None directly
**API impact:** None
**Container impact:** Possible CI/runtime image alignment later
**Security impact:** High positive impact through stronger verification
**Acceptance criteria:** Typecheck coverage expands over approved surfaces; critical controls have required CI jobs or approved documented exceptions.
**Required tests:** Updated static checks, workflow validation, and CI-governance tests
**Migration considerations:** Expand coverage incrementally to keep signal actionable.
**Rollback or mitigation:** Revert the last coverage expansion slice if it blocks unrelated work without clear remediation path.
**Risk:** High

## TASK-004: Migrate the repository baseline to Node.js 24 LTS and record mainline validation
**Status:** Completed
**Priority:** High
**Domain:** Runtime platform baseline
**Requirement:** P11 FR-003, FR-004, FR-005, FR-006, FR-007, FR-009, FR-010, FR-013, FR-015, AC-001, AC-002, AC-003, AC-005, AC-007
**Reason:** P11 required the real repository baseline to move from Node 20 to Node.js 24 LTS with compatibility evidence rather than a documentation-only version bump.
**Current problem:** The repository previously declared Node 20 in package, Docker, and workflows, and historical Node 24 evidence had reported Prisma/runtime uncertainty.
**Proposed change:** Align package/runtime/workflow Node baselines to Node 24, preserve the existing Prisma bootstrap when compatible, and revalidate the mainline path.
**Affected files:** `package.json`, `Dockerfile`, `.github/workflows/*`, `scripts/prisma-generate-safe-lib.js`, `scripts/validate-workflow-baseline.js`, workflow characterization tests, `README.md`, relevant specs/docs
**Dependencies:** TASK-003
**Database impact:** None
**API impact:** None
**Container impact:** Runtime/build image updated to Node 24 and validated through Docker build evidence
**Security impact:** Medium positive impact through supported-platform alignment
**Acceptance criteria:** Repository baseline targets Node.js 24 in package/runtime/workflow configuration and the previously reported Prisma constructor incompatibility is no longer reproduced on the validated clean path.
**Required tests:** `npm ci`, `npm run build`, `npm run lint`, `npm run typecheck`, `node --test tests/taxpayer-characterization.test.js`, `npm run validate:workflow-baseline`, workflow characterization tests, validators, and aggregate tests
**Migration considerations:** Keep the Windows Prisma rename-lock behavior classified as a pre-existing baseline issue unless new evidence proves otherwise.
**Rollback or mitigation:** Revert Node baseline declarations only if a later critical incompatibility is reproduced and cannot be isolated safely.
**Risk:** Medium

## TASK-005: Complete cross-surface closure evidence for the Node.js 24 baseline
**Status:** Completed
**Priority:** High
**Domain:** Runtime platform baseline / CI evidence
**Requirement:** P11 FR-008, FR-009, FR-012, FR-016, AC-003, AC-004, AC-006, AC-008
**Reason:** The Node 24 baseline needed evidence across local/mainline, Docker, and hosted workflow surfaces before the feature could be treated as closed.
**Current problem:** Closure previously lacked hosted root-workflow evidence after the official workflow location changed to repository root.
**Proposed change:** Align the root official workflows, preserve `working-directory: inventory-api`, and record hosted success evidence for the Node 24 baseline.
**Affected files:** `/.github/workflows/windows-prisma-build.yml`, `/.github/workflows/p0-quality-gates.yml`, `/.github/workflows/static-checks.yml`, `/.github/workflows/repository-tests.yml`, `/.github/workflows/contract-validations.yml`, `/.github/workflows/browser-e2e.yml`, `/.github/workflows/operational-smoke.yml`, `/.github/workflows/build-and-publish.yml`, `/.github/workflows/db-constraints-tests.yml`, `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, `specs/p11-node24-runtime-migration/*`
**Dependencies:** TASK-004
**Database impact:** None
**API impact:** None
**Container impact:** None beyond preserving the implemented Node 24 image baseline
**Security impact:** Low direct impact; medium governance impact through stronger release evidence
**Acceptance criteria:** Browser E2E and Docker evidence are recorded; a hosted Node 24 Windows workflow run is reviewed successfully; documentation distinguishes the root official workflow location from application-local workflow copies.
**Required tests:** Local `npm run validate:workflow-baseline`; `node --test tests/workflow-baseline-characterization.test.js tests/prisma-windows-build-stabilization.test.js`; hosted runs `30281932831`, `30281933453`, `30281933525`, `30281935485`, `30281937000`, `30281935398`
**Migration considerations:** Treat any future hosted Windows failure signature separately from the historical rename-lock path.
**Rollback or mitigation:** If a future surface fails, reopen the compatibility task instead of rolling back documented evidence.
**Risk:** Medium

## TASK-006: Reduce workflow-governance drift between root official workflows and application-local copies
**Status:** Proposed
**Priority:** High
**Domain:** CI/workflow governance
**Requirement:** Architectural objective AO-001 workflow source-of-truth governance after root alignment
**Reason:** The repository now has a correct official root workflow location, but governance is duplicated across root workflows and application-local copies.
**Current problem:** Local validators/tests now resolve the official root workflow tree first, but the repository still keeps a duplicated `inventory-api/.github/workflows/` mirror. A future edit could change only one tree and leave the other stale.
**Proposed change:** Introduce a parity guard or converge to one authoritative workflow source so local workflow validation and hosted automation cannot drift silently.
**Affected files:** `scripts/validate-workflow-baseline.js`, `tests/workflow-baseline-characterization.test.js`, `inventory-api/.github/workflows/*`, `/.github/workflows/*`, `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`
**Dependencies:** TASK-005
**Database impact:** None
**API impact:** None
**Container impact:** None
**Security impact:** Medium positive impact through stronger governance integrity
**Acceptance criteria:** A documented and tested mechanism exists that either validates parity between root and application-local workflows or replaces the duplicate-tree model with a single approved source-of-truth pattern.
**Required tests:** Updated workflow baseline validation plus characterization or parity coverage proving duplicated workflow trees cannot drift silently while root-first workflow resolution remains intact
**Migration considerations:** Preserve current root hosted workflow behavior while changing governance internals.
**Rollback or mitigation:** Revert only the governance slice if parity enforcement creates false positives or blocks normal workflow changes.
**Risk:** High
