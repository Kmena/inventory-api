# Traceability
## Requirements to architecture to tasks matrix
| Requirement | Architecture element | Tasks | Acceptance criteria / validation |
|---|---|---|---|
| FR-001 | PR impact analyzer specification | TASK-001, TASK-002, TASK-014 | AC-001, AC-010 |
| FR-002 | Pre-merge checklist classifier | TASK-003, TASK-013 | AC-002 |
| FR-003 | Authorization matrix generator | TASK-004 | AC-003 |
| FR-004 | Authorization matrix generator | TASK-005, TASK-013 | AC-004 |
| FR-005 | Hotspot risk assessor | TASK-002, TASK-006, TASK-013 | AC-005 |
| FR-006 | Hotspot risk assessor | TASK-007 | AC-005 |
| FR-007 | Contract impact classifier | TASK-008, TASK-009, TASK-014 | AC-006 |
| FR-008 | Contract impact classifier | TASK-009 | AC-006 |
| FR-009 | Operational consistency assessor | TASK-010, TASK-013 | AC-007 |
| FR-010 | Operational consistency assessor | TASK-011 | AC-008 |
| FR-011 | Operational consistency assessor | TASK-012, TASK-014 | AC-009 |
| FR-012 | Validation matrix | TASK-003, TASK-005, TASK-006, TASK-010, TASK-012, TASK-013 | AC-002, AC-004, AC-005, AC-007, AC-009 |
| FR-013 | PR impact analyzer specification | TASK-001, TASK-002, TASK-014 | AC-010 |

## Acceptance criteria to tests / validations
| Acceptance criterion | Validation |
|---|---|
| AC-001 | Manual verification using actual PR diff; hotspot path detection |
| AC-002 | Review command set against `inventory-api/package.json` and changed paths |
| AC-003 | Route/middleware/service audit using `src/routes/*`, `authenticate.js`, `authorize*.js`, `access-policies.js` |
| AC-004 | Auth characterization suite selection review (`auth-hardening`, `browser-session-auth-boundary`, `administrative-authorization`, `company-authorization`, `authorization-convergence`) |
| AC-005 | Hotspot-to-test mapping review and task fragmentation review |
| AC-006 | Contract classification review against runtime catalog, contract manifest, critical contract matrix and contract tests |
| AC-007 | DB+filesystem review against `client.service.js`, `payment.service.js`, `payment-receipt-evidence.service.js` and related security tests |
| AC-008 | Pagination and consumer-impact review against affected endpoints and `src/lib/pagination.js` |
| AC-009 | Operational/build review using `npm run validate:production-baseline`, `npm run validate:restore-readiness`, `npm run validate:operational-readiness` when applicable |
| AC-010 | Blocked-state review when diff or mandatory evidence is missing |

## User task mapping
| User task | Spec tasks |
|---|---|
| TASK-SDD-001 | TASK-001, TASK-002, TASK-014 |
| TASK-SDD-002 | TASK-003 |
| TASK-SDD-003 | TASK-004 |
| TASK-SDD-004 | TASK-005 |
| TASK-SDD-005 | TASK-006 |
| TASK-SDD-006 | TASK-007 |
| TASK-SDD-007 | TASK-008 |
| TASK-SDD-008 | TASK-009 |
| TASK-SDD-009 | TASK-010 |
| TASK-SDD-010 | TASK-011 |
| TASK-SDD-011 | TASK-012 |
| TASK-SDD-012 | TASK-012 |
| TASK-SDD-013 | TASK-013 |

## PR-surface test-matrix contract
### Minimum list
Always include:
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test`

### Expanded list families selected from the real diff
| Surface family | Expanded commands/tests | Traceability source |
|---|---|---|
| Public runtime / root shell | `npm run lint:public-runtime`; `npm run validate:public-runtime`; `node --test tests/public-surface-characterization.test.js tests/root-shell-route-governance.test.js`; `node --test tests/root-shell-modularity-governance.test.js`; `node --test tests/browser-e2e.e2e.js` | `FR-002`, `FR-012`, `TASK-003`, `TASK-013` |
| Auth / authorization / protected routes | `node --test tests/auth-hardening-characterization.test.js`; `node --test tests/browser-session-auth-boundary.test.js`; `node --test tests/administrative-authorization-characterization.test.js`; `node --test tests/company-authorization-characterization.test.js`; `node --test tests/authorization-convergence-characterization.test.js` | `FR-004`, `FR-012`, `TASK-005`, `TASK-013` |
| DB + filesystem file-backed flows | `node --test tests/payment-receipt-security.test.js tests/payment-tenant-scope.test.js`; `node --test tests/client-document-security.test.js tests/client-document-governance.test.js` | `FR-009`, `FR-012`, `TASK-010`, `TASK-013` |
| List / pagination / heavy reads | `node --test tests/pagination.test.js`; `node --test tests/heavy-endpoint-governance.test.js`; `node --test tests/client-tenant-scope.test.js`; `node --test tests/payment-tenant-scope.test.js`; `node --test tests/invoice-tenant-scope.test.js`; `node --test tests/inventory-alerts-tenant-scope.test.js`; `node --test tests/agent-workspace-tenant-scope.test.js` | `FR-010`, `FR-012`, `TASK-011`, `TASK-013` |
| Contract / governance docs | `npm run validate:workflow-baseline`; `node --test tests/openapi-contract-consistency.test.js tests/runtime-contract-governance.test.js tests/governance-baseline-sync-guardrails.test.js` | `FR-007`, `FR-008`, `FR-012`, `TASK-008`, `TASK-009`, `TASK-013` |
| Inventory / order hotspot flows | `node --test tests/inventory-alerts-tenant-scope.test.js`; `node --test tests/order-lifecycle-contract-characterization.test.js` | `FR-005`, `FR-012`, `TASK-006`, `TASK-013` |
| Build / schema / Docker / readiness / session baseline | `npm run validate:production-baseline`; `npm run validate:restore-readiness`; `npm run validate:operational-readiness`; `npm run validate:workflow-baseline` | `FR-011`, `FR-012`, `TASK-012`, `TASK-013` |

### Selection rule
- The expanded list is the union of all surface families activated by the real changed-file set.
- If the diff is missing, the matrix structure can be documented but the PR-specific minimum/expanded output remains blocked.
- When a command has a known local prerequisite, the review output must record it instead of silently dropping the command.

## Implementation evidence
### TASK-001
- **Resolution status:** Completed
- **Implemented files:**
  - `docs/prisma-windows-stability-evidence.md`
  - `docs/current-state.md`
  - `docs/architecture.md`
  - `specs/merge-readiness-regression-control/tasks.md`
  - `specs/merge-readiness-regression-control/traceability.md`
  - `specs/merge-readiness-regression-control/implementation-report.md`
  - `specs/merge-readiness-regression-control/changelog.md`
- **Validation evidence:**
  - `node --test tests/prisma-windows-build-stabilization.test.js`
  - `node --test tests/workflow-baseline-characterization.test.js`
  - `npm run validate:workflow-baseline`
  - `npm run lint`
  - `npm run typecheck`
- **Related requirements:** `FR-001`, `FR-013`

### TASK-002
- **Resolution status:** Completed
- **Implemented files:**
  - `scripts/prisma-generate-safe-lib.js`
  - `README.md`
  - `docs/prisma-windows-stability-evidence.md`
  - `docs/current-state.md`
  - `docs/architecture.md`
  - `tests/prisma-windows-build-stabilization.test.js`
  - `specs/merge-readiness-regression-control/tasks.md`
  - `specs/merge-readiness-regression-control/traceability.md`
  - `specs/merge-readiness-regression-control/changelog.md`
  - `specs/merge-readiness-regression-control/implementation-report.md`
- **Validation evidence:**
  - `node --test tests/prisma-windows-build-stabilization.test.js`
  - `npm run validate:workflow-baseline`
  - `npm run lint`
  - `npm run typecheck`
- **Related requirements:** `FR-001`, `FR-005`, `FR-013`

### TASK-003
- **Resolution status:** Completed
- **Implemented files:**
  - `src/security/access-policy-actor-scope.js`
  - `src/security/access-policy-registry.js`
  - `src/routes/agent.routes.js`
  - `tests/access-policies.test.js`
  - `tests/authorization-convergence-characterization.test.js`
  - `docs/current-state.md`
  - `docs/architecture.md`
  - `specs/merge-readiness-regression-control/tasks.md`
  - `specs/merge-readiness-regression-control/traceability.md`
  - `specs/merge-readiness-regression-control/changelog.md`
  - `specs/merge-readiness-regression-control/implementation-report.md`
- **Validation evidence:**
  - `node --test tests/access-policies.test.js`
  - `node --test tests/authorization-convergence-characterization.test.js`
  - `npm run lint`
  - `npm run typecheck`
- **Related requirements:** `FR-002`, `FR-012`

### TASK-004
- **Resolution status:** Completed
- **Implemented files:**
  - `specs/merge-readiness-regression-control/architecture.md`
  - `specs/merge-readiness-regression-control/current-state.md`
  - `specs/merge-readiness-regression-control/risks.md`
  - `specs/merge-readiness-regression-control/tasks.md`
  - `specs/merge-readiness-regression-control/traceability.md`
  - `specs/merge-readiness-regression-control/changelog.md`
  - `specs/merge-readiness-regression-control/implementation-report.md`
- **Validation evidence:**
  - manual review against `src/middlewares/authenticate.js`
  - manual review against `src/middlewares/authorize.js`
  - manual review against `src/middlewares/authorizePermission.js`
  - manual review against `src/security/access-policies.js`
  - manual review against `src/security/access-policy-registry.js`
  - manual review against `src/routes/company.routes.js`
  - manual review against `src/routes/role.routes.js`
  - manual review against `src/routes/payment.routes.js`
  - manual review against `src/routes/inventory.routes.js`
  - manual review against `src/routes/agent.routes.js`
  - manual review against `src/services/payment.service.js`
  - manual review against `src/services/agent-workspace.service.js`
  - `set BROWSER_SESSION_STORE_MODE=memory&& node --test tests/access-policies.test.js`
  - `set BROWSER_SESSION_STORE_MODE=memory&& node --test tests/authorization-convergence-characterization.test.js`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
- **Related requirements:** `FR-003`

### TASK-005
- **Resolution status:** Completed
- **Implemented files:**
  - `specs/merge-readiness-regression-control/architecture.md`
  - `specs/merge-readiness-regression-control/tasks.md`
  - `specs/merge-readiness-regression-control/traceability.md`
  - `specs/merge-readiness-regression-control/changelog.md`
  - `specs/merge-readiness-regression-control/implementation-report.md`
- **Validation evidence:**
  - manual review against `tests/auth-hardening-characterization.test.js`
  - manual review against `tests/browser-session-auth-boundary.test.js`
  - manual review against `tests/administrative-authorization-characterization.test.js`
  - manual review against `tests/company-authorization-characterization.test.js`
  - manual review against `tests/authorization-convergence-characterization.test.js`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
- **Related requirements:** `FR-004`, `FR-012`

### TASK-006
- **Resolution status:** Completed
- **Implemented files:**
  - `specs/merge-readiness-regression-control/risks.md`
  - `specs/merge-readiness-regression-control/tasks.md`
  - `specs/merge-readiness-regression-control/traceability.md`
  - `specs/merge-readiness-regression-control/changelog.md`
  - `specs/merge-readiness-regression-control/implementation-report.md`
- **Validation evidence:**
  - manual review of hotspot-to-test mapping in `specs/merge-readiness-regression-control/risks.md`
  - manual review against `specs/merge-readiness-regression-control/architecture.md`
  - manual review against `specs/merge-readiness-regression-control/current-state.md`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
- **Related requirements:** `FR-005`, `FR-012`

### TASK-007
- **Resolution status:** Completed
- **Implemented files:**
  - `specs/merge-readiness-regression-control/architecture.md`
  - `specs/merge-readiness-regression-control/decisions.md`
  - `specs/merge-readiness-regression-control/tasks.md`
  - `specs/merge-readiness-regression-control/traceability.md`
  - `specs/merge-readiness-regression-control/changelog.md`
  - `specs/merge-readiness-regression-control/implementation-report.md`
- **Validation evidence:**
  - manual review of large-service fragmentation rules in `specs/merge-readiness-regression-control/architecture.md`
  - manual review against `specs/merge-readiness-regression-control/risks.md`
  - manual review against `specs/merge-readiness-regression-control/requirements.md`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
- **Related requirements:** `FR-006`

### TASK-008
- **Resolution status:** Completed
- **Implemented files:**
  - `specs/merge-readiness-regression-control/architecture.md`
  - `specs/merge-readiness-regression-control/tasks.md`
  - `specs/merge-readiness-regression-control/traceability.md`
  - `specs/merge-readiness-regression-control/changelog.md`
  - `specs/merge-readiness-regression-control/implementation-report.md`
- **Validation evidence:**
  - manual review of contract-classification rules in `specs/merge-readiness-regression-control/architecture.md`
  - manual review against `docs/runtime-endpoint-catalog.md`
  - manual review against `docs/runtime-contract-manifest.json`
  - manual review against `docs/critical-contract-matrix.json`
  - `node --test tests/openapi-contract-consistency.test.js`
  - `node --test tests/runtime-contract-governance.test.js`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
- **Related requirements:** `FR-007`

### TASK-009
- **Resolution status:** Completed
- **Implemented files:**
  - `specs/merge-readiness-regression-control/architecture.md`
  - `specs/merge-readiness-regression-control/tasks.md`
  - `specs/merge-readiness-regression-control/traceability.md`
  - `specs/merge-readiness-regression-control/changelog.md`
  - `specs/merge-readiness-regression-control/implementation-report.md`
- **Validation evidence:**
  - manual review of documentation-sync rules in `specs/merge-readiness-regression-control/architecture.md`
  - `node --test tests/governance-baseline-sync-guardrails.test.js`
  - `node --test tests/openapi-contract-consistency.test.js`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
- **Related requirements:** `FR-008`, `FR-007`

### TASK-010
- **Resolution status:** Completed
- **Implemented files:**
  - `specs/merge-readiness-regression-control/architecture.md`
  - `specs/merge-readiness-regression-control/risks.md`
  - `specs/merge-readiness-regression-control/tasks.md`
  - `specs/merge-readiness-regression-control/traceability.md`
  - `specs/merge-readiness-regression-control/changelog.md`
  - `specs/merge-readiness-regression-control/implementation-report.md`
- **Validation evidence:**
  - manual review of DB+filesystem rules in `specs/merge-readiness-regression-control/architecture.md`
  - manual review against `src/services/client.service.js`
  - manual review against `src/services/payment.service.js`
  - manual review against `src/services/payment-receipt-evidence.service.js`
  - `node --test tests/payment-receipt-security.test.js`
  - `node --test tests/payment-tenant-scope.test.js`
  - `node --test tests/client-document-security.test.js`
  - `node --test tests/client-document-governance.test.js`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
- **Related requirements:** `FR-009`, `FR-012`

### TASK-011
- **Resolution status:** Completed
- **Implemented files:**
  - `specs/merge-readiness-regression-control/architecture.md`
  - `specs/merge-readiness-regression-control/risks.md`
  - `specs/merge-readiness-regression-control/tasks.md`
  - `specs/merge-readiness-regression-control/traceability.md`
  - `specs/merge-readiness-regression-control/changelog.md`
  - `specs/merge-readiness-regression-control/implementation-report.md`
- **Validation evidence:**
  - manual review of list/pagination rules in `specs/merge-readiness-regression-control/architecture.md`
  - manual review against `src/lib/pagination.js`
  - manual review against `src/lib/heavy-endpoint-governance.js`
  - manual review against `src/routes/client.routes.js`
  - manual review against `src/routes/payment.routes.js`
  - manual review against `src/routes/invoice.routes.js`
  - manual review against `src/routes/inventory.routes.js`
  - manual review against `src/routes/user.routes.js`
  - manual review against `src/routes/role.routes.js`
  - manual review against `src/routes/warehouse.routes.js`
  - manual review against `src/routes/agent.routes.js`
  - manual review against `src/services/client.service.js`
  - manual review against `src/services/payment.service.js`
  - manual review against `src/services/invoice.service.js`
  - manual review against `src/services/inventory.service.js`
  - manual review against `src/services/product.service.js`
  - manual review against `src/services/agent-workspace.service.js`
  - `node --test tests/pagination.test.js`
  - `node --test tests/heavy-endpoint-governance.test.js`
  - `node --test tests/client-tenant-scope.test.js`
  - `node --test tests/payment-tenant-scope.test.js`
  - `node --test tests/invoice-tenant-scope.test.js`
  - `node --test tests/inventory-alerts-tenant-scope.test.js`
  - `node --test tests/agent-workspace-tenant-scope.test.js`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
- **Related requirements:** `FR-010`

### TASK-012
- **Resolution status:** Completed
- **Implemented files:**
  - `specs/merge-readiness-regression-control/architecture.md`
  - `specs/merge-readiness-regression-control/risks.md`
  - `specs/merge-readiness-regression-control/decisions.md`
  - `specs/merge-readiness-regression-control/tasks.md`
  - `specs/merge-readiness-regression-control/traceability.md`
  - `specs/merge-readiness-regression-control/changelog.md`
  - `specs/merge-readiness-regression-control/implementation-report.md`
- **Validation evidence:**
  - manual review of build/operational baseline rules in `specs/merge-readiness-regression-control/architecture.md`
  - manual review against `docs/production-baseline.md`
  - manual review against `docs/audit/current-code-audit.md`
  - manual review against `package.json`
  - manual review against `scripts/validate-production-baseline.js`
  - manual review against `scripts/validate-restore-readiness.js`
  - manual review against `scripts/validate-operational-readiness.js`
  - manual review against `scripts/validate-workflow-baseline.js`
  - manual review of `inventory-api/.github/workflows/` emptiness
  - manual review of parent-root `.github/workflows/` hosted workflow ownership
  - `npm run validate:production-baseline`
  - `npm run validate:restore-readiness`
  - `npm run validate:operational-readiness`
  - `npm run validate:workflow-baseline`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
- **Related requirements:** `FR-011`, `FR-012`

### TASK-013
- **Resolution status:** Completed
- **Implemented files:**
  - `specs/merge-readiness-regression-control/architecture.md`
  - `specs/merge-readiness-regression-control/tasks.md`
  - `specs/merge-readiness-regression-control/traceability.md`
  - `specs/merge-readiness-regression-control/changelog.md`
  - `specs/merge-readiness-regression-control/implementation-report.md`
- **Validation evidence:**
  - manual review of checklist matrix in `specs/merge-readiness-regression-control/architecture.md`
  - manual review of PR-surface test-matrix contract in `specs/merge-readiness-regression-control/traceability.md`
  - manual review against `package.json`
  - manual review against `docs/test-suite-catalog.md`
  - `node --test tests/public-surface-characterization.test.js`
  - `set BROWSER_SESSION_STORE_MODE=memory && node --test tests/authorization-convergence-characterization.test.js`
  - `node --test tests/payment-receipt-security.test.js`
  - `node --test tests/pagination.test.js`
  - `node --test tests/inventory-alerts-tenant-scope.test.js`
  - `npm run validate:production-baseline`
  - `npm run validate:restore-readiness`
  - `npm run validate:operational-readiness`
  - `npm run validate:workflow-baseline`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
- **Related requirements:** `FR-002`, `FR-004`, `FR-005`, `FR-009`, `FR-011`, `FR-012`

### TASK-014
- **Resolution status:** Completed
- **Implemented files:**
  - `specs/merge-readiness-regression-control/decisions.md`
  - `specs/merge-readiness-regression-control/advisor-review.md`
  - `specs/merge-readiness-regression-control/tasks.md`
  - `specs/merge-readiness-regression-control/traceability.md`
  - `specs/merge-readiness-regression-control/changelog.md`
  - `specs/merge-readiness-regression-control/implementation-report.md`
- **Validation evidence:**
  - manual review of decision rules in `specs/merge-readiness-regression-control/decisions.md`
  - manual review of accepted guidance in `specs/merge-readiness-regression-control/advisor-review.md`
  - manual review against `requirements.md` for `FR-001`, `FR-007`, `FR-011`, `FR-013`, `BR-001`, `BR-003`, `BR-006`, and `BR-007`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
- **Related requirements:** `FR-001`, `FR-007`, `FR-011`, `FR-013`

## Coverage notes
- Every functional requirement is covered by at least one task.
- Exact PR-scoped outputs remain blocked until the diff is provided.
- This spec intentionally preserves a distinction between repository facts and future implementation recommendations.
