# Current State

<!-- MAINT-002: per-section update log — append a row when a section is materially changed -->
| Section | Last updated | Change summary |
|---|---|---|
| §7 Database and persistence | 2026-09-01 | Added Client.creditLimit/creditBalance and ClientStore credit fields |
| §8 APIs and integrations | 2026-09-01 | Added GET /api/clients/:id/ledger and TASK-015 credit lifecycle |
| §14 Known defects | 2026-09-01 | Removed DEF-PRD-001 (resolved); DEF-PRD-002 remains open |

## 1. System overview
The implemented system is a Node.js 24 + Express + Prisma modular monolith that serves both JSON APIs and browser-delivered SPAs from one runtime.

The repository currently supports:
- identity and permission-based access control
- company-scoped master data
- inventory, lots, receipts, and stock movements
- recipes and production orders
- QA inspection and rejection handling
- supplier/procurement workflows
- warehouse and root-shell browser UIs

The feature `qa-rejection-material-reconciliation-amendment` is implemented in the current codebase as an additive extension over the existing production + QA workflow. It adds broader QA relevant-input scope resolution, replacement-recovery support, lot-level recolection entry capture, same-lot usage validation, terminal reconciliation recording, and warehouse SPA support for those states.

## 2. Repository structure
Primary application root:
- `inventory-api/`

Observed relevant structure:
- `src/app.js`, `src/server.js` — Express bootstrap and runtime entrypoint
- `src/routes/` — HTTP route adapters grouped by feature area
- `src/services/` — application/service layer with most business orchestration and validation
- `src/repositories/` — Prisma-backed persistence helpers
- `src/schemas/` — Zod request validation
- `src/security/`, `src/middlewares/`, `src/lib/` — auth, permission, request, and infrastructure helpers
- `src/public/root/` — root/admin SPA assets
- `src/public/warehouse/` — warehouse SPA assets
- `prisma/schema.prisma` — canonical relational model
- `prisma/migrations/` — additive SQL migrations
- `tests/` — node:test characterization, contract, migration, governance, and service tests
- `docs/` — operational, architectural, and governance documentation
- `specs/qa-rejection-material-reconciliation-amendment/` — feature specification, traceability, risks, and implementation report

## 3. Current architecture
The implemented architecture is a layered monolith, not a full hexagonal architecture.

Observed dependency flow:
- Express routes call service functions directly.
- Services coordinate validation, authorization assumptions, business rules, persistence calls, and response serialization.
- Repositories encapsulate Prisma queries/includes and are reused across services.
- Browser SPAs call the same backend routes through in-repo API wrappers.

For the production + QA area, the active architecture is:
- `production.routes.js` exposes production order, execution, QA, recolection, and reconciliation endpoints
- `production.service.js` serializes production orders, including stage executions and recolection stages
- `production-execution.service.js` coordinates execution, inventory mutation, and same-lot validation gates
- `quality.service.js` coordinates QA inspections, rejection handling, relevant-input scope resolution, and optional replacement recovery creation
- `production-recolection.service.js` coordinates recolection confirmation, replacement recovery, reconciliation balance calculation, and outcome recording
- `production.repository.js` loads production orders with stage executions, recolection entries, and reconciliations for API and UI use

## 4. Existing domains and modules
### Identity and Access
Current code:
- `src/services/auth.service.js`
- `src/middlewares/authenticate.js`
- `src/security/access-policies.js`
- `src/security/access-policy-registry.js`

Responsibilities:
- login
- bearer-token authentication
- permission checks
- authenticated actor reloading from persistence

### Recipes and Product Definition
Current code:
- `src/services/recipe.service.js`
- `src/schemas/recipe.schema.js`
- root-shell recipe editor assets

Current production-related behavior:
- recipe stages support `stageType` = `RECOLLECTION | PROCESSING`
- processing stages require `processCode`
- `processLabel` is required only when `processCode = OTHER`
- legacy stages without `stageType` are treated as `PROCESSING` in serialization/service logic

### Inventory and Lots
Current code:
- `src/services/inventory.service.js`
- `src/services/inventory-transaction-support.service.js`
- `src/repositories/inventory.repository.js`

Responsibilities:
- warehouse stock and lot stock mutation
- lot creation/update
- stock movement recording
- transactional inventory adjustments used by production and receiving flows

### Production Execution
Current code:
- `src/services/production.service.js`
- `src/services/production-execution.service.js`
- `src/services/production-stage-validation.service.js`
- `src/repositories/production.repository.js`
- `src/routes/production.routes.js`

Responsibilities:
- production order lifecycle
- stage execution and material consumption
- loss declaration, returns, completion
- gating of re-execution after QA rejection
- lot-bound same-stage/recovery consumption validation when recolection entries exist

### Quality / QA Rejection Handling
Current code:
- `src/services/quality.service.js`
- `src/services/quality-rejection-disposition.service.js`
- `src/services/quality-relevant-input-scope.service.js`

Current behavior:
- QA inspections can reject an executed stage
- relevant-input scope is resolved with Option A: all consumptions from prior executed stages up to and including the failed stage, excluding `INVALIDATED` executions
- rejection flow can request a posterior `REPLACEMENT_RECOVERY` recolection stage
- backward-compatible legacy behavior without replacement recovery remains in place

### Recolection / Recovery / Reconciliation
Current code:
- `src/services/production-recolection.service.js`
- `src/repositories/production.repository.js`
- warehouse SPA production state/renderers/controllers

Current behavior:
- recolection stages now have `recoveryType`
- `VIRTUAL_RECOLECTION` remains the default compatibility mode
- `REPLACEMENT_RECOVERY` is used for QA-driven replacement of damaged or missing inputs
- confirmation can persist lot-level recolection entries
- reconciliation outcomes are recorded per product + lot with `USED | RETURNED | DISCARDED`
- remaining unreconciled balances are computed from recolected minus reconciled quantities

## 5. Main use cases
Implemented and observable from code:
- create/update recipe versions with stage typing and process definition
- create and read production orders with serialized stage executions and recolection stages
- execute a production stage with lot-bound consumptions and wastes
- inspect a stage in QA and optionally reject it
- resolve relevant-input scope for a rejected stage, including failed-stage-without-direct-consumption scenarios
- create a replacement-recovery stage when rejection requires material replacement
- confirm a recolection/recovery stage and optionally capture product/lot/quantity entries
- block stage re-execution while required losses or pending recovery/recolection remain unresolved
- record reconciliation outcomes for recovered material
- compute order-level stage status in the warehouse SPA, including replacement recovery pending/completed states

## 6. Current data flows
### QA rejection with relevant-input scope
1. Warehouse or QA client submits `POST /api/production/orders/:id/stages/:stageId/inspections`.
2. `quality.service.js` loads the company-scoped production order and latest stage execution.
3. If the result is `REJECTED`, the service resolves `relevantInputScope` through `resolveOptionARelevantInputs`.
4. The response envelope may include `inspection`, `dispositionsSummary`, and `relevantInputScope`.
5. If `requiresReplacementStage === true`, the service can create a posterior replacement-recovery stage.

### Replacement recovery confirmation
1. Warehouse client calls `POST /api/production/orders/:id/recolections/:recolectionId/confirm`.
2. `production-recolection.service.js` validates order scope, stage ownership, and status.
3. The stage is marked `COMPLETED`.
4. If entries were provided, lot-level `production_recolection_entries` rows are created.

### Same-lot consumption gate after recovery
1. Stage execution is submitted through `POST /api/production/orders/:id/stages/:stageId/execute`.
2. `production-execution.service.js` loads the order and related completed recolection stage for that recipe stage.
3. When recolection entries exist, `assertRecolectionCoverageForConsumption` validates that proposed usage is tied to previously recolected product + lot pairs and does not exceed recovered balance.
4. Inventory reductions and movement recording continue transactionally if validation succeeds.

### Reconciliation flow
1. Warehouse client calls `POST /api/production/orders/:id/recolections/:recolectionId/reconciliation`.
2. `production-recolection.service.js` validates scope, stage state, allowed outcome catalog, and quantity limits against recolection entries.
3. Reconciliation rows are created.
4. The response includes a computed balance with `complete` and `remainingBalances`.

## 7. Database and persistence
Primary persistence stack:
- PostgreSQL via Prisma
- `prisma/schema.prisma`
- additive migrations under `prisma/migrations/`

Feature-relevant current schema elements:
- `RecipeStage.stageType`
- `RecipeStage.processCode`
- `RecipeStage.processLabel`
- `ProductionRecolectionStage.recoveryType`
- `ProductionRecolectionEntry`
- `ProductionRecolectionReconciliation`
- `Client.creditLimit` — aggregate credit limit at client level (migration `20260924020000_add_credit_fields_to_client`)
- `Client.creditBalance` — aggregate credit balance at client level (same migration)
- `ClientStore.creditLimit` — per-store credit limit
- `ClientStore.creditBalance` — per-store credit balance

Feature-relevant migration observed:
- `20260923001000_recolection_entry_and_reconciliation/`
  - adds `production_recolection_stages.recovery_type`
  - creates `production_recolection_entries`
  - creates `production_recolection_reconciliations`

Current persistence behavior:
- production orders are loaded with stage executions, lot references, QA inspections, losses, recolection stages, recolection entries, and reconciliations
- company scoping is applied in production order lookups used by production/quality services
- inventory mutation still occurs in explicit Prisma transactions

## 8. APIs and integrations
Feature-relevant API endpoints currently implemented:
- `POST /api/production/orders/:id/stages/:stageId/inspections`
- `POST /api/production/orders/:id/recolections/:recolectionId/confirm`
- `POST /api/production/orders/:id/recolections/:recolectionId/reconciliation`
- `GET /api/production/orders/:id`
- `GET /api/production/orders`
- `GET /api/clients/:id/ledger` — exposes `client.creditLimit` and `client.creditBalance` (TASK-015 cycle)

Credit balance lifecycle (TASK-015):
- `paymentService.approvePayment` decrements `Client.creditBalance` via `tx.client.update` inside the Prisma transaction
- `paymentService.reversePayment` increments `Client.creditBalance` symmetrically
- Per-store `ClientStore.creditBalance` is also updated when the invoice is linked to an order with a `clientStoreId`

Current contract behavior:
- production routes are authenticated and permission-guarded through `authorizeAccessPolicy`
- production order serialization includes `recolectionStages`, each with `entries` and `reconciliations`
- QA inspection route preserves backward compatibility: when no disposition summary and no relevant-input scope exist, the route returns the inspection object; otherwise it returns the richer envelope

External integration posture in this feature area:
- none added; this amendment stays within production, quality, inventory, Prisma, and warehouse/root-shell UI layers

## 9. Authentication and authorization
Observed current behavior:
- production and quality endpoints require authenticated actors
- access is permission-based, for example `production.execute`, `production.view`, `production.manage`, `quality.inspect`, and `quality.view`
- production/quality services derive company scope from `auth.companyId`
- feature-relevant writes reject access when the actor lacks company association

## 10. Events and background processing
Observed current implementation:
- no domain-event bus
- no async worker or broker for this feature
- replacement recovery and reconciliation are handled synchronously during request/response

## 11. Containers and deployment
Observed runtime/container baseline:
- `Dockerfile` is multi-stage
- runtime image uses `node:24-bullseye-slim`
- runtime switches to non-root user `inventory`
- healthcheck targets `/health/ready`
- dev compose file is explicitly marked dev-only and includes Postgres and Redis health checks

## 12. Current testing strategy
Observed automated testing baseline:
- extensive `node:test` suite under `tests/`
- migration, schema, service, SPA characterization, governance, and runtime contract tests exist
- `package.json` includes `test`, `lint`, `typecheck`, `build`, and `verify` scripts

Feature-specific tests present:
- `tests/quality-relevant-input-scope.service.test.js`
- `tests/qa-rejection-material-reconciliation-migration.test.js`
- `tests/production-same-lot-validation.service.test.js`
- `tests/production-replacement-recovery-gate.test.js`
- `tests/production-reconciliation-outcomes.service.test.js`

Evidence available in repository docs:
- `specs/qa-rejection-material-reconciliation-amendment/implementation-report.md` records command results for targeted tests and a full suite pass after implementation
- the user request also reports `npm run test -- --silent` as 1531/1531 pass and `node --test tests/governance-baseline-sync-guardrails.test.js` as pass

This document records that evidence as repository/user-reported validation. It does not independently re-execute the test suite.

## 13. Behavior to preserve
- company-scoped production and QA lookups
- additive compatibility with legacy `VIRTUAL_RECOLECTION`
- QA rejection handling that can continue returning the legacy simple inspection object when no enriched envelope is needed
- stage re-execution gating on losses acknowledgment and pending recovery/recolection resolution
- transactional inventory reductions and movement recording during production execution
- same-lot validation only when actual recolection entries exist, preserving legacy compatibility for older flows
- production order read model including recolection stages, entries, and reconciliations

## 14. Known defects
### DEF-PRD-002 Manual end-to-end evidence gap for amended warehouse flow — Medium
Observed in repository evidence:
- implementation report lists manual validation as pending for replacement recovery, reconciliation, and recipe-editor UX
- automated service and migration tests exist, but the repository does not include completed manual evidence for the full operator flow

Impact:
- implementation is test-backed but operational completeness should not be overstated

## 15. Architectural debt
- service layer still mixes orchestration, business rules, persistence, and response shaping
- production, quality, recipe, and inventory concerns are logically separated but not isolated as explicit ports/adapters or domain modules
- `recolection` legacy spelling remains in routes, schema, services, and persistence for compatibility
- relevant-input scope is computed on demand rather than stored as a persisted immutable rejection snapshot
- warehouse and root-shell UIs remain large browser scripts coupled to backend DTOs

## 16. Security risks
### Medium
- the amended production flow is company-scoped and permission-gated, but the broader application still depends heavily on service-layer scope enforcement rather than explicit domain/application boundaries
- manual validation evidence for the QA rejection/replacement workflow is incomplete in repository documentation

### Low
- no new external integration or async surface was introduced by this feature, limiting incremental attack surface in this amendment

## 17. Unknowns and assumptions
Unknown from repository inspection alone:
- whether warehouse operators have completed live/manual validation of the full rejected-stage replacement and reconciliation workflow
- whether all existing client consumers are already adapted to the enriched QA inspection envelope in real deployments
- whether relevant-input scope should remain computed dynamically or eventually be persisted for audit replay stability

Assumptions used in this refresh:
- implementation status is taken from the checked-in specification docs and the user-provided validation summary
- documentation intentionally avoids claiming full operational completeness beyond the automated and recorded evidence currently present

## 18. Documentation governance
The canonical runtime-contract governance lives under `docs/**`. This includes `docs/current-state.md`, `docs/architecture.md`, `docs/action-plan.md`, and `docs/audit/`. Documentation ownership boundaries are defined in `docs/documentation-ownership-map.md`. CI workflow definitions live under `../.github/workflows/**` and are the authoritative hosted source consumed by workflow-baseline validators.

authoritative hosted workflow location for local validators/tests: `../.github/workflows/`. Governance and characterization tests read CI workflow truth from that parent-root directory.

Runtime company-role update flow now exists. The `PUT /api/roles/company/:roleId` endpoint and the full company-role list/create/update flows are implemented and documented.

This feature area reflects bounded coverage of QA rejection flows. partial coverage of edge cases may remain pending future integration tests. Documentation operates under the p34-bounded-governance-coverage-expansion posture.

## 19. Cross-cutting security follow-up
Browser session security hardening (HTTPS enforcement, secure-cookie transport, token-over-HTTPS) is tracked as a residual risk and follow-up dependency under `specs/p11-https-browser-session-migration/`. This is not an in-slice blocker for the currently implemented feature and must be addressed separately when HTTPS infrastructure is fully in place.
