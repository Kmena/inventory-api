# Architectural Action Plan

## 1. Objective
Complete the remaining P11 hardening and validation work while preserving the now-implemented Node 24 runtime baseline and current runtime behavior.

## 2. Scope
In scope after completed P11 planning (`TASK-001` through `TASK-004`) and the completed implementation slices to date:
- preserve and extend the tenant-isolation hardening pattern already implemented at repository mutation boundaries
- preserve the completed root-bootstrap repository boundary and CI/typecheck governance slices
- complete the remaining closure evidence for the implemented Node.js 24 LTS baseline
- keep architecture-facing documentation synchronized with real repository state

## 3. Out of scope
- unrelated functional work blocked by the active P11 freeze policy
- broad architectural rewrites
- unapproved API redesign
- rewriting historical Prisma migrations

## 4. Requirements addressed
This action plan carries forward the P11 requirements that remain implementation work:
- FR-004, FR-005, FR-006, FR-007, FR-008
- FR-009, FR-010, FR-011, FR-012, FR-013, FR-014, FR-015
- BR-002, BR-003, BR-005
- AC-002, AC-003, AC-004, AC-006, AC-007

## 5. Current problems addressed
This plan addresses the problems confirmed by P11 that remain after the completed implementation slices to date:
- remaining typecheck coverage gaps beyond the approved first repository/schema expansion slice
- incomplete closure evidence for the implemented Node.js 24 baseline on the hosted Windows workflow review
- pre-existing Windows Prisma build instability on some Windows environments

## 6. Domains affected
- Identity and access
- Company administration
- Client management
- Orders, payments, and sales routes
- Multi-tenant data access across repositories
- Repository/platform governance
- CI/test governance
- Runtime platform baseline

## 7. Behavior to preserve
- current API and browser-runtime contracts
- current layered monolith structure unless later changed deliberately in approved work
- current Node 24 package/Docker/workflow baseline unless a critical pending validation failure forces rollback
- existing repository validation scripts and test entrypoints
- legitimate root-global flows such as root company administration

## 8. Defects to correct
### Critical
- no new critical defect was introduced by `p11-tenant-isolation-fixes`; the first approved tenant-isolation write slice is complete, but the broader P11 hardening program remains blocking until the remaining follow-up specs close

### High
- incomplete closure evidence for hosted Windows workflow execution on the implemented Node 24 baseline

### Medium
- remaining typecheck coverage gaps beyond the approved first expansion slice
- pre-existing Windows Prisma `EPERM` rename-lock build issue

## 9. Future architectural changes
Planned incremental changes:
1. preserve the completed repository-boundary tenant-write hardening pattern introduced by `p11-tenant-isolation-fixes`;
2. preserve the completed root-bootstrap repository-boundary extraction introduced by `p11-repository-boundary-root-bootstrap`;
3. preserve the completed static-analysis expansion and CI critical-controls mapping introduced by `p11-typecheck-ci-hardening`;
4. complete the remaining closure evidence for the already-implemented Node 24 runtime and governance baseline.

## 10. Database changes
No database change is currently approved.

Future database work should be introduced only if tenant-isolation or integrity fixes require new constraints or indexes. Existing applied migrations must remain unchanged; any schema change must use a new migration.

## 11. API and integration changes
No API change is currently planned as part of the first hardening stages.

If a future hardening fix requires contract changes, backward compatibility impact must be documented before implementation.

## 12. Container and deployment changes
Container and deployment baseline changes already implemented:
- `Dockerfile` now declares `node:24-bullseye-slim`
- relevant GitHub Actions workflows now pin Node 24

Remaining platform work in scope:
- review hosted Windows Prisma workflow evidence under the updated Node 24 workflow baseline

## 13. Security changes
Planned future security work:
- exhaustive remediation of confirmed tenant-isolation cases
- stronger CI evidence for important controls
- preserve and not weaken existing authorization behavior while hardening repositories

## 14. Test strategy
Implementation stages should follow this test order:
1. add characterization/regression coverage for each confirmed risky tenant write before changing behavior;
2. strengthen or add service/integration tests where current coverage is guard-only or optional;
3. expand CI gates for critical controls;
4. validate Node.js 24 compatibility across mainline, browser, Docker, and Windows workflow surfaces.

Validation evidence already recorded by the completed P11 work:
- `npm run lint` passed
- `npm run typecheck` passed
- `node --test tests/company-root-bootstrap-boundary.test.js` passed
- `node --test tests/company-repository-bootstrap.test.js` passed
- `npm test -- --silent` initially passed with `274 pass, 2 skipped` during the planning baseline
- `npm test -- --silent` later passed with `281 pass, 2 skipped` after `p11-tenant-isolation-fixes`
- `npm test -- --silent` later passed with `290 pass, 2 skipped` after `p11-repository-boundary-root-bootstrap`
- `npm test -- --silent` later passed with `293 pass, 2 skipped` after `p11-typecheck-ci-hardening`
- during `p11-node24-runtime-migration`, `node -v` reported `v24.16.0`
- during `p11-node24-runtime-migration`, `npm ci`, `npm run build`, `npm run lint`, `npm run typecheck`, `node --test tests/taxpayer-characterization.test.js`, `npm run validate:workflow-baseline`, `node --test tests/workflow-baseline-characterization.test.js tests/prisma-windows-build-stabilization.test.js`, `npm run validate:public-runtime`, `npm run validate:operational-readiness`, `npm run validate:production-baseline` with required env vars, and `npm test -- --silent` all passed
- local Windows Prisma guarded build behavior still maps to the pre-existing `EPERM` rename-lock baseline when it occurs, with retry succeeding in the validated cycle
- browser E2E and Docker build evidence are now recorded on the Node 24 baseline
- the following surface remains pending: hosted `windows-prisma-build` workflow evidence review for the updated Node 24 workflow

## 15. Migration stages
### Stage 1 — Completed
- Reconcile external audit findings with current repository evidence
- Record planning decisions, hardening sequence, and active freeze policy in the P11 spec package
- Refresh architecture-facing docs to match completed P11 planning work

### Stage 2 — Completed
- Implement tenant-isolation fixes for confirmed and review-required repository writes with regression tests
- Preserve public API contracts while propagating `companyId` through affected service-to-repository calls
- Record evidence in `specs/p11-tenant-isolation-fixes/implementation-report.md`

### Stage 3 — Completed
- Remove the root company bootstrap repository-boundary violation and preserve current root-global behavior with tests
- Keep duplicate-user lookup and bootstrap transaction inside `company.repository.js` while preserving audit semantics from the service layer

### Stage 4 — Completed
- Expand typecheck coverage over the approved first slice (`src/schemas/**`, `sales-route.repository.js`, `order.repository.js`, `payment.repository.js`, `company.repository.js`)
- Formalize evidence categories in `docs/ci-critical-controls.md`
- Add the dedicated required workflow `.github/workflows/db-constraints-tests.yml` for `tests/p2-hardening-constraints.test.js`

### Stage 5 — Implemented
- Migrate runtime/tooling/workflows baseline from Node 20 to Node.js 24 LTS
- Validate the mainline local/Linux path without reproducing the historical `PrismaClient is not a constructor` failure
- Refresh architecture-facing documentation to reflect the implemented Node 24 baseline

### Stage 6 — Proposed
- Complete hosted Windows workflow closure evidence for the Node 24 baseline and capture a fresh hosted artifact/log for the updated workflow revision

### Stage 7 — Proposed
- Re-run final architecture/documentation synchronization after the remaining validation evidence is captured

## 16. Risks and mitigations
| Risk | Level | Mitigation |
|---|---|---|
| Breaking legitimate root-global or tenant-scoped flows while hardening repositories | High | preserve the new root-bootstrap regression tests and separate root-global exceptions explicitly |
| Underestimating remaining tenant-isolation exposure | High | start from the P11 inventory and review every affected write path during implementation |
| Assuming all green tests are equally strong evidence | Medium | preserve the explicit matrix in `docs/ci-critical-controls.md` and the dedicated DB-constraints workflow |
| Pending hosted Windows validation exposes a late Node 24 incompatibility | High | keep the baseline documented as implemented, isolate the failing surface, and decide rollback only if the issue is critical and reproducible |
| Windows Prisma build instability obscures migration signal | Medium | isolate known EPERM behavior and compare before/after results explicitly |

## 17. Rollback or recovery strategy
- Implement changes in small slices by repository/domain area.
- Keep characterization/regression tests as safety rails before tightening behavior.
- Do not rewrite historical migrations.
- If a hardening change breaks legitimate behavior, revert the slice and preserve evidence in docs/tasks before retrying.

## 18. Manual validation
For future approved implementation stages, manually confirm:
- every confirmed tenant-isolation case is covered by tests and code review
- root-global exceptions remain functional
- CI job mapping for critical controls is explicit
- pending Node 24 closure validation covers the hosted Windows workflow execution path

## 19. Approval status
**Status:** Partially implemented; remaining closure validation proposed

P11 planning/documentation is complete. The Node 24 baseline migration is implemented and reflected in current-state documentation, but full closure still requires the remaining validation evidence before the substream should be treated as finished.
