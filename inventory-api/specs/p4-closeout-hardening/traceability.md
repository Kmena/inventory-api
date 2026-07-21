# Traceability

## Requirements to architecture to tasks matrix
| Requirement | Architecture component | Implementation plan step | Task | Validation/Test |
|---|---|---|---|---|
| FR-001 | Spec package | Step 1 | TASK-001 | Manual structure review |
| FR-002 | Documentation pointers | Step 1 | TASK-002 | Reference verification / grep |
| FR-003 | Decimal money utility | Step 2 | TASK-003 | Monetary unit tests + financial regression |
| FR-004 | Access policy + governed guards | Step 3 | TASK-004 | Authorization characterization tests |
| FR-005 | CI workflow | Step 5 | TASK-006 | YAML validation + local `verify` |
| FR-006 | Test autodiscovery | Step 4 | TASK-005 | New `tests/*.test.js` discovery check |
| FR-007 | Compatibility safeguards | Steps 2-6 | TASK-003, TASK-004, TASK-005, TASK-006, TASK-007 | Regression suite |
| FR-008 | Full documentation remediation | Step 1 | TASK-002 | Active + derived doc reference validation |
| FR-009 | Build-and-publish CD | Step 6 | TASK-007 | YAML validation + controlled build/publication dry run |
| AC-001 | Documentation pointers | Step 1 | TASK-002 | Link/reference check |
| AC-002 | Decimal money utility | Step 2 | TASK-003 | Edge-case monetary tests |
| AC-003 | Access policy inventory | Step 3 | TASK-004 | Endpoint policy review + tests |
| AC-004 | CI workflow | Step 5 | TASK-006 | Pipeline run |
| AC-005 | Test autodiscovery | Step 4 | TASK-005 | New test detected automatically |
| AC-006 | Spec package | Step 1 | TASK-001 | Package completeness review |
| AC-007 | Derived-document correction | Step 1 | TASK-002 | Validation of Markdown + HTML references |
| AC-008 | No automatic deploy | Step 6 | TASK-007 | Workflow review confirms no deploy steps |
| AC-009 | Controlled build/publication | Step 6 | TASK-007 | Manual/tag-trigger build publication validation |

## Requirement coverage check
### Functional requirements
- FR-001 covered by TASK-001
- FR-002 covered by TASK-002
- FR-003 covered by TASK-003
- FR-004 covered by TASK-004
- FR-005 covered by TASK-006
- FR-006 covered by TASK-005
- FR-007 covered by TASK-003, TASK-004, TASK-005, TASK-006, TASK-007
- FR-008 covered by TASK-002
- FR-009 covered by TASK-007

### Business rules
- BR-001 covered by TASK-002
- BR-002 covered by TASK-003
- BR-003 covered by TASK-004
- BR-004 covered by TASK-004
- BR-005 covered by TASK-005
- BR-006 covered by TASK-006 and TASK-007
- BR-007 covered by TASK-002
- BR-008 covered by TASK-007
- BR-009 covered by TASK-007

## File-level traceability
- `requirements.md`: user intent and acceptance criteria
- `current-state.md`: evidence-backed repository analysis
- `domain-analysis.md`: cross-cutting domain framing
- `architecture.md`: target solution shape
- `implementation-plan.md`: ordered execution path
- `tasks.md`: executable work packages and task status lifecycle
- `risks.md`: focused risk register
- `decisions.md`: approved planning decisions
- `advisor-review.md`: readiness review summary
- `metadata.yaml`: package inventory and status
- `implementation-report.md`: baseline evidence and implementation status for executed tasks

## Implementation status
| Task | Status | Implementation files | Tests / validation | Evidence |
|---|---|---|---|---|
| TASK-001 | Completed | `specs/p4-closeout-hardening/implementation-report.md`, `specs/p4-closeout-hardening/tasks.md`, `specs/p4-closeout-hardening/traceability.md`, `../CHANGELOG.md` | Manual structure review, `npm run typecheck`, `npm run lint`, `npm test -- --silent`, `node src/server.js` | `specs/p4-closeout-hardening/implementation-report.md` |
| TASK-002 | Completed | `docs/architecture.md`, `docs/runtime-scope-baseline.md`, `docs/audit/current-code-audit.md`, `docs/audit/current-code-audit.html`, `specs/p4-closeout-hardening/current-state.md`, `specs/p4-closeout-hardening/implementation-report.md`, `specs/p4-closeout-hardening/tasks.md`, `specs/p4-closeout-hardening/traceability.md`, `../CHANGELOG.md` | `findstr /n /s /i "p4-audit-hardening p3-access-scope-hardening p4-runtime-surface-hardening" docs\*`, `npm run typecheck`, `npm run lint`, `npm run build` | `specs/p4-closeout-hardening/implementation-report.md` |
| TASK-003 | Completed | `src/lib/money.js`, `src/lib/throttle-store.js`, `src/lib/sensitive-file-governance.js`, `src/middlewares/login-throttle.js`, `src/middlewares/request-throttle.js`, `src/services/invoice-financial-state.js`, `src/services/payment.service.js`, `src/services/client.service.js`, `src/services/invoice.service.js`, `src/services/agent-workspace.service.js`, `src/schemas/payment.schema.js`, `src/schemas/client.schema.js`, `tests/invoice-payment-sync-characterization.test.js`, `tests/money.test.js`, `tests/payment-receipt-security.test.js`, `tests/client-document-governance.test.js`, `tests/client-document-schema-governance.test.js`, `tests/throttle-store.test.js`, `specs/p4-closeout-hardening/current-state.md`, `specs/p4-closeout-hardening/implementation-report.md`, `specs/p4-closeout-hardening/tasks.md`, `specs/p4-closeout-hardening/traceability.md`, `CHANGELOG.md` | `node --test tests/client-document-schema-governance.test.js tests/client-document-governance.test.js tests/payment-receipt-security.test.js tests/throttle-store.test.js tests/access-policies.test.js tests/money.test.js tests/invoice-payment-sync-characterization.test.js tests/payload-segmentation-characterization.test.js`, `npm run lint`, `npm run typecheck`, `npm test -- --silent` | `specs/p4-closeout-hardening/implementation-report.md` |
| TASK-004 | Completed | `src/security/access-policies.js`, `src/routes/company.routes.js`, `src/routes/payment.routes.js`, `src/routes/product.routes.js`, `src/routes/order.routes.js`, `src/routes/inventory.routes.js`, `src/routes/user.routes.js`, `src/routes/client.routes.js`, `src/routes/geocoding.routes.js`, `src/routes/taxpayer.routes.js`, `tests/access-policies.test.js`, `tests/administrative-authorization-characterization.test.js`, `tests/company-authorization-characterization.test.js`, `tests/public-surface-characterization.test.js`, `tests/payload-segmentation-characterization.test.js`, `specs/p4-closeout-hardening/current-state.md`, `specs/p4-closeout-hardening/implementation-report.md`, `specs/p4-closeout-hardening/tasks.md`, `specs/p4-closeout-hardening/traceability.md`, `CHANGELOG.md` | `node --test tests/access-policies.test.js tests/administrative-authorization-characterization.test.js tests/company-authorization-characterization.test.js tests/payload-segmentation-characterization.test.js`, `npm run lint`, `npm run typecheck`, `npm test -- --silent` | `specs/p4-closeout-hardening/implementation-report.md` |
| TASK-005 | Completed | `package.json`, `scripts/run-tests.js`, `tests/access-policies.test.js`, `tests/money.test.js`, `specs/p4-closeout-hardening/current-state.md`, `specs/p4-closeout-hardening/implementation-report.md`, `specs/p4-closeout-hardening/tasks.md`, `specs/p4-closeout-hardening/traceability.md` | `npm test -- --silent`, `npm run lint`, `npm run typecheck`, `npm run build` | `specs/p4-closeout-hardening/implementation-report.md` |
| TASK-006 | Completed | `.github/workflows/quality-gates.yml`, `README.md`, `specs/p4-closeout-hardening/current-state.md`, `specs/p4-closeout-hardening/implementation-report.md`, `specs/p4-closeout-hardening/tasks.md`, `specs/p4-closeout-hardening/traceability.md`, `../CHANGELOG.md` | `npm run verify`, `npm run build`, `npm run typecheck`, `npm run lint`, manual static review of workflow YAML | `specs/p4-closeout-hardening/implementation-report.md` |
| TASK-007 | Completed | `.github/workflows/build-and-publish.yml`, `README.md`, `docs/production-baseline.md`, `specs/p4-closeout-hardening/current-state.md`, `specs/p4-closeout-hardening/implementation-report.md`, `specs/p4-closeout-hardening/tasks.md`, `specs/p4-closeout-hardening/traceability.md`, `../CHANGELOG.md` | `npm run verify`, controlled local Docker build/version/package dry run, manual static review of workflow YAML | `specs/p4-closeout-hardening/implementation-report.md` |

## Notes
- `docs/architecture.md` currently references several supplemental docs (`domain-analysis.md`, `traceability.md`, `risks.md`, `decisions.md`), so their presence in this package is required for repository consistency.
