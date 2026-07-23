# Architecture

## 1. Architectural goals
### Proposed
- keep the repository as a single deployable modular monolith
- preserve the current verified runtime/build contracts
- reduce shared Prisma build fragility on Windows without changing production behavior casually
- keep protected evidence-download behavior for payment receipts
- continue moving architecture-facing docs to evidence-backed, repository-local sources

## 2. Current architecture summary
The current system is an Express + Prisma layered monolith with a growing repository-governance layer around it.

Current verified governance components include:
- local aggregated verification through `npm run verify`
- workflow baseline validation through `scripts/validate-workflow-baseline.js`
- a dedicated Windows Prisma workflow in `.github/workflows/windows-prisma-build.yml`
- guarded Prisma generation through `scripts/prisma-generate-safe.js` and `scripts/prisma-generate-safe-lib.js`
- automated characterization tests covering Windows Prisma workflow shape, wrapper behavior and Prisma-client import-chain regressions

## 3. Architectural problems
- local Windows Prisma generation is still environment-sensitive
- Prisma client generation remains a shared single point of build/test friction
- architecture-facing docs previously referenced spec packages not present in the inspected repository state
- the broader application is still layered rather than fully hexagonal

## 4. Target architecture proposal
### Proposed
Short-term target for this scope:
- keep current application architecture stable
- treat Prisma generation and workflow governance as explicit infrastructure adapters
- preserve a characterization-first approach for build/runtime regressions
- keep architecture docs synchronized with the repository and with externally supplied implementation evidence only when clearly marked

Longer-term target:
- domain-oriented modular monolith with explicit application/domain/infrastructure boundaries
- Prisma and workflow/tooling concerns isolated behind infrastructure contracts and repository-governance policies

## 5. Domain map
### Proposed
| Domain | Classification | Responsibility |
|---|---|---|
| Identity & Access | Generic | authentication and authorization |
| Customer Management | Core | client/store data and documents |
| Product Catalog | Core | products and prices |
| Inventory | Core | lots, warehouses, stock and movements |
| Sales Routing / Agent Workspace | Core | routes, assignments, visits and agent visibility |
| Billing & Collections | Core | invoices, payments and receipt evidence |
| Platform Runtime Governance | Supporting | workflows, build wrapper, verification gates and runtime contracts |

## 6. Bounded contexts
### Proposed
Affected and relevant bounded contexts for this refresh:
- `PlatformRuntimeGovernance`
- `BillingCollections`
- `Inventory` only as a repository-wide Prisma dependency consumer

## 7. Ubiquitous language
### Proposed
- **Guarded Prisma Build**: repository-supported Prisma client generation path through wrapper scripts
- **Windows Rename-Lock Failure**: retryable Prisma generate failure characterized by `EPERM` and temporary engine rename artifacts
- **Workflow Baseline**: the required set of versioned GitHub Actions workflows validated by repository script
- **Protected Receipt Download URL**: authenticated API path used to access payment receipt evidence
- **Prisma Client Baseline Characterization**: anti-regression test proving the historical missing `.prisma/client/default` symptom does not reproduce in the current repo state

## 8. Domain models
### Proposed
Within the current scope, the most relevant model candidates are governance-oriented:
- **WorkflowBaseline** value object candidate
  - versioned set of required workflow files and shape constraints
- **PrismaGenerateFailureClassification** value object candidate
  - kind, retryable flag, temp-file evidence and combined output
- **PaymentReceiptEvidence** existing business concept
  - protected receipt metadata and download path generation

## 9. Aggregates and consistency boundaries
### Proposed
- `PlatformRuntimeGovernance` consistency boundary should keep workflow-shape validation, build-wrapper behavior and aggregated verification coherent
- `PaymentReceiptEvidence` behavior should remain internally consistent with protected access semantics and serialization contract

## 10. Application use cases
### Proposed
Relevant implemented or characterized use cases:
- RunGuardedPrismaBuild
- ValidateWorkflowBaseline
- VerifyRepositoryBaseline
- SerializePaymentReceiptEvidence
- DetectPrismaClientImportChainRegression

## 11. Input ports
### Proposed
- `RunBuildVerificationPort`
- `ValidateWorkflowBaselinePort`
- `SerializePaymentReceiptEvidencePort`

## 12. Output ports
### Proposed
- `PrismaGeneratePort`
- `WorkflowRepositoryPort`
- `ReceiptEvidencePersistencePort`

## 13. Input adapters
### Proposed
- npm scripts in `package.json`
- GitHub Actions workflow jobs under `.github/workflows/`
- test runners under `node --test`
- Express routes for payment receipt evidence download behavior

## 14. Output adapters
### Proposed
- Prisma CLI execution via wrapper scripts
- filesystem/workflow YAML inspection via validation scripts
- Prisma bootstrap in `src/lib/prisma.js`

## 15. Dependency rules
### Proposed
- tests may characterize wrappers, workflows and import chains, but should not replace actual production behavior
- services needing Prisma access must continue resolving through the shared Prisma bootstrap instead of ad hoc generated-client paths
- workflow baseline validation must remain repository-local and static-analysis driven

## 16. Database ownership
### Proposed
No database ownership change is proposed by this refresh. Prisma schema ownership remains unchanged.

## 17. Transaction boundaries
### Proposed
No application transaction-boundary change is proposed by this refresh.

## 18. Event strategy
### Proposed
No event architecture change is proposed by this refresh.

## 19. API and integration contracts
### Proposed
- payment receipt evidence must keep protected download URL serialization semantics
- `npm run verify` remains the repository-level integration contract for combined validation
- `windows-prisma-build.yml` remains a focused Windows build contract for `npm ci` + `npm run build`, not the full verification suite

## 20. Security boundaries
### Proposed
- receipt evidence access remains behind authenticated API paths
- workflow/build governance must discourage local unsafe workarounds when Windows Prisma failures appear
- documentation must distinguish verified repository facts from externally supplied CI evidence

## 21. Container and deployment architecture
### Proposed
No container architecture change is proposed by this refresh. Current workflows and docs should continue reflecting that Windows Prisma stabilization evidence is primarily a CI/build-governance concern.

## 22. Testing strategy
### Proposed
Preserve and extend the current test pyramid for this scope:
- characterization tests for wrapper behavior and import-chain regression
- contract-style tests for workflow shape and receipt evidence serialization
- repository-wide aggregated verification through `npm run verify`

## 23. Context map
### Proposed
- `PlatformRuntimeGovernance -> Inventory/Prisma` because build/test/runtime all depend on generated Prisma client availability
- `BillingCollections -> Prisma bootstrap` because payment receipt evidence import chain resolves through `src/lib/prisma.js`

## 24. Migration strategy
### Proposed
1. keep the current guarded Prisma build path as the only supported build baseline
2. preserve anti-regression tests for the resolved import-chain failure
3. document residual Windows local risk explicitly instead of overstating stabilization
4. collect additional Windows reproducibility evidence before claiming full stabilization certainty

## 25. Forbidden dependencies
### Proposed
- direct service/repository dependence on alternative generated Prisma client entry points outside `src/lib/prisma.js`
- documentation references to non-present spec packages without an explicit clarification note
- claiming universal Windows stabilization based only on one successful CI run or one passing local suite

## 26. Architectural decisions
### Proposed
- **ADR-P01**: `npm run build` remains backed by the guarded Prisma wrapper scripts
- **ADR-P02**: `windows-prisma-build.yml` is accepted as minimum CI evidence for the Windows Prisma baseline
- **ADR-P03**: the historical `.prisma/client/default` failure is treated as resolved in current repository state, but protected by anti-regression characterization rather than assumed impossible
- **ADR-P04**: residual local Windows Prisma rename-lock risk remains open until stronger stabilization evidence exists

## 27. Open decisions
### Proposed
- Should additional repository automation be added to measure repeated Windows build stability over time, or is the current minimum CI evidence sufficient for now?
- Is any repository-local diagnostic artifact needed to capture local Windows Prisma rename-lock conditions when they reappear?
- Should broader architecture docs later be expanded from runtime/build governance into full bounded-context documentation for the whole monolith?
