# Architecture
## 1. Purpose and scope
This document describes the architecture currently implemented in the repository, with emphasis on the active production, QA, recipe, and warehouse-browser flows after the `qa-rejection-material-reconciliation-amendment` implementation.

It documents current reality only: active runtime components, current boundaries, dependency rules in effect, and architectural limitations still present.

## 2. Current active architecture summary
The application is an Express + Prisma modular monolith with browser SPAs served from the same runtime.

Active production/quality architecture is layered:
- HTTP input adapters in `src/routes/production.routes.js`
- request validation with Zod in `src/schemas/production.schema.js` and `src/schemas/quality.schema.js`
- application/service orchestration in `src/services/production.service.js`, `production-execution.service.js`, `quality.service.js`, and `production-recolection.service.js`
- persistence adapters in `src/repositories/production.repository.js` and `inventory.repository.js`
- browser input adapters in `src/public/warehouse/` and `src/public/root/`

The amendment did not introduce a full hexagonal module split. It extended the existing layering with clearer service-level seams:
- a dedicated relevant-input scope resolver
- dedicated recolection/reconciliation service logic
- repository includes for recolection entries and reconciliations
- SPA state/rendering support for replacement recovery and reconciliation

## 3. Active architectural style and module boundaries
### Runtime style
- single deployable monolith
- Express routes per feature area
- service layer as primary business orchestration boundary
- Prisma repositories as data-access layer
- static/browser assets delivered from the same process

### Active module boundaries in practice
Logical module groupings currently in effect:
- Identity & Access
- Customer / Company / Roles / Users
- Products / Recipes
- Inventory / Warehouses / Lots
- Production / QA
- Procurement / Receipts
- Sales / Orders / Billing / Payments

For the amended feature, the most relevant boundary is the Production + QA cluster:
- recipe definitions provide stage contract metadata
- production execution consumes inventory and records stage facts
- QA rejection evaluates completed executions
- recolection/recovery closes the loop before re-execution

These are separate files and services, but still part of one tightly-coupled application layer rather than isolated bounded-context packages.

## 4. Current domain map
| Domain | Current responsibility | Main code locations |
|---|---|---|
| Identity & Access | authentication, actor reload, permission enforcement | `src/services/auth.service.js`, `src/middlewares/`, `src/security/` |
| Recipes | recipe versions, stage contracts, stage typing, process-code validation | `src/services/recipe.service.js`, `src/schemas/recipe.schema.js`, root-shell recipe editor |
| Inventory | lots, warehouse balances, stock mutation, movement audit | `src/services/inventory*.js`, `src/repositories/inventory.repository.js` |
| Production | orders, stage executions, losses, returns, completion | `src/services/production*.js`, `src/routes/production.routes.js` |
| Quality | inspections, rejection handling, relevant-input scope, continuation rules | `src/services/quality*.js` |
| Recolection / Recovery | pending recovery gates, lot-level entry capture, reconciliation outcomes | `src/services/production-recolection.service.js`, `src/repositories/production.repository.js` |
| Warehouse UI | operator-facing rendering and controller wiring for execution, QA, recovery, reconciliation | `src/public/warehouse/` |

## 5. Current runtime components and responsibilities
### `production.routes.js`
Responsibilities:
- mounts production order lifecycle endpoints
- mounts stage execution, losses, returns, inspections, recolection confirm, and reconciliation endpoints
- enforces authentication, access policy, and payload validation before delegating to services

### `quality.service.js`
Responsibilities:
- creates QA inspection records
- branches approved vs rejected flow
- resolves Option A relevant-input scope for rejected stages
- coordinates continuation and invalidation logic
- optionally triggers creation of a `REPLACEMENT_RECOVERY` stage

### `quality-relevant-input-scope.service.js`
Responsibilities:
- pure resolver for relevant-input material scope
- includes all non-invalidated prior executed-stage consumptions up to the failed stage
- reports whether the failed stage had direct consumptions

### `production-stage-validation.service.js`
Responsibilities:
- prerequisite gates for stage execution and re-execution
- pending recolection vs replacement-recovery blocking logic
- override-related validation
- same-lot recolection-before-use coverage validation when lot-level entries exist

### `production-execution.service.js`
Responsibilities:
- transactional execution of stage consumptions/waste
- reads completed recolection stages and applies same-lot gate before inventory mutation
- records stage execution facts and stock movements

### `production-recolection.service.js`
Responsibilities:
- confirms recolection stages
- persists lot-level entries when supplied
- creates replacement recovery stages idempotently
- records reconciliation outcomes
- computes unreconciled balances
- serializes recolection stages for API responses

### `production.repository.js`
Responsibilities:
- company-scoped production order lookup
- eager loading of stage executions, recolection stages, entries, reconciliations, QA inspections, and lot references
- persistence helpers for recolection entries and reconciliation rows

### Warehouse SPA components
Relevant files:
- `src/public/warehouse/api/warehouse-api.js`
- `src/public/warehouse/views/production.state.js`
- `src/public/warehouse/views/production.renderers.js`
- `src/public/warehouse/views/production.renderers.rejection.js`
- `src/public/warehouse/views/production.controllers.js`

Responsibilities:
- render stage cards and recovery/reconciliation UI
- call QA inspection, recolection confirmation, and reconciliation endpoints
- derive replacement-recovery pending/completed states in browser state logic

## 6. Current dependency rules
Implemented dependency direction is mostly:
- route → service → repository → Prisma
- browser UI → browser API wrapper → HTTP route → service

Current rules actually followed in the amended area:
- controllers/routes do not contain the main recovery/reconciliation business rules
- services derive company scope from authenticated actor, not from client payload
- repositories own Prisma include graphs and row creation for production aggregates
- browser renderers/controllers remain presentation adapters and do not access Prisma directly

Current violations still present:
- services still hold substantial business logic instead of a separate domain layer
- service modules call repositories directly without explicit ports
- serialization logic and business rules are mixed in service files
- root-shell recipe editor currently embeds a process-code catalog that can diverge from backend validation

## 7. Current database ownership and transaction boundaries
### Logical ownership
- Recipes own recipe versions and stage contracts
- Production owns orders, stage executions, losses, returns, and recolection stages
- Inventory owns lots, warehouse stock, lot stock, and stock movements
- Quality owns inspection records but coordinates with Production state

### Active transaction boundaries
- stage execution inventory reductions occur in Prisma transactions coordinated by `production-execution.service.js`
- order completion inventory ingress occurs transactionally
- QA rejection handling is synchronous and may coordinate additional writes, but no evented outbox exists
- reconciliation recording is validated and persisted through production repository helpers

### Feature-specific persistence ownership
- `production_recolection_entries` and `production_recolection_reconciliations` are currently part of the production persistence model and loaded with the production order aggregate read model

## 8. Current API and integration contracts
### Current API contracts in effect
- `POST /api/production/orders/:id/stages/:stageId/inspections`
  - accepts QA inspection payloads, including rejection metadata, optional `requiresReplacementStage`, and `replacementItems`
  - may return a plain inspection object or an enriched envelope depending on rejection/disposition scope
- `POST /api/production/orders/:id/recolections/:recolectionId/confirm`
  - confirms a recolection/recovery stage
  - may accept lot-level `entries`
- `POST /api/production/orders/:id/recolections/:recolectionId/reconciliation`
  - records terminal reconciliation outcomes
  - returns computed remaining balance data
- `GET /api/production/orders/:id`
  - currently includes `recolectionStages`, each serialized with `recoveryType`, `entries`, and `reconciliations`

### Current integration model
- no new external integration was added by this amendment
- the flow remains internal to Express, Prisma, and browser SPA clients

## 9. Current security boundaries
Active security boundaries:
- bearer-authenticated actor context
- permission-based route protection through access policies
- company scoping in production and QA service entrypoints
- server-side validation of lot linkage and quantity limits for recovery/reconciliation operations

Security-relevant architectural choice in effect now:
- same-lot validation is enforced server-side in `production-execution.service.js`, not delegated to the warehouse SPA

Current security limitation:
- enforcement still depends on service-layer orchestration rather than explicit domain policy modules or cross-cutting tenant-boundary abstractions

## 10. Current container and deployment architecture
Current deployment architecture:
- single Node runtime container
- multi-stage Docker build
- production runtime runs as non-root user
- healthcheck probes `/health/ready`
- dev compose includes app, Postgres, and Redis with health checks

This is an active hardened baseline compared with earlier repository states, but it is still a single-process monolith deployment.

## 11. Current testing strategy
Current strategy includes:
- node:test-based unit/service tests
- migration/schema governance tests
- runtime contract and documentation governance tests
- browser/runtime characterization tests for the SPAs
- repo-level `verify` script chaining lint, typecheck, validations, build, and test

Feature-specific coverage currently present:
- relevant-input scope resolver tests
- migration/schema tests for recoveryType, recolection entries, and reconciliation rows
- same-lot validation tests
- replacement-recovery gate tests
- reconciliation balance and validation tests

Current limitation:
- manual end-to-end evidence for the warehouse operator flow is still weaker than the automated service-level evidence

## 12. Active architectural decisions
- Production and QA remain inside the current layered monolith; no microservice split is active.
- Company scope is enforced from authenticated actor context in production and quality services.
- Legacy `recolection` naming remains part of the public/internal contract for compatibility.
- `VIRTUAL_RECOLECTION` remains supported as compatibility behavior.
- `REPLACEMENT_RECOVERY` is the active additive recovery type for QA-driven replacement stages.
- Same-lot validation is enforced only when a completed recovery/recolection stage has persisted lot-level entries, preserving backward compatibility for older data/flows.
- Reconciliation outcomes are currently limited to `USED`, `RETURNED`, and `DISCARDED`.
- Production order read models now expose recolection stages with entries and reconciliations to support warehouse UI state and server-side validation.

## 13. Known architectural limitations
- no explicit domain layer for Production, Quality, or Inventory
- no formal input/output port abstraction
- production order aggregate loading uses broad include graphs and service-level serialization
- QA relevant-input scope is computed dynamically rather than persisted as an immutable rejection snapshot
- browser UIs remain tightly coupled to server DTO structure
- root-shell recipe editor process-code option set is not centrally derived from the backend schema catalog

## 14. Open decisions requiring clarification
- Should relevant-input scope remain computed on demand, or be stored as a persisted audit snapshot per rejection event?
- Should the root-shell recipe editor derive its process-code catalog from a shared backend-owned contract to eliminate drift?
- Is stronger end-to-end evidence required before the amended warehouse flow is treated as operationally complete?
- Should legacy `recolection` path names remain indefinitely, or should a versioned rename strategy be planned later?

## 15. Documentation governance
The canonical reviewed artifacts under `docs/**` represent implemented reality and are the authoritative reference for runtime contracts. The workflow-baseline validators and characterization tests intentionally read hosted workflow truth from that parent-root workflow tree.

Documentation ownership boundaries are defined in `docs/documentation-ownership-map.md`. CI workflow definitions live under `../.github/workflows/` and are the authoritative hosted source for workflow-baseline validators.

Supported runtime company-role update flow now exists. Company-role list/create/update operations are implemented and tracked in current-state docs.

This feature operates under a p34-bounded-governance-coverage-expansion posture: partial OpenAPI baseline coverage is intentional for this amendment scope. bounded governance evidence is preserved through characterization tests and contract docs rather than full integration-test suites.

## 16. Cross-cutting security follow-up
Browser session HTTPS security (secure-cookie enforcement, HTTPS-only transport) is tracked as a residual risk and follow-up dependency under `specs/p11-https-browser-session-migration/`. This is not an in-slice blocker for the current amendment and must be handled as a separate initiative when HTTPS infrastructure is available.
