# Architectural Action Plan

## 1. Objective
Define the post-implementation improvement roadmap after the completed Product + Inventory Master Plan (6 waves, MASTER-001 through MASTER-031). The master plan is fully implemented and validated. This plan identifies remaining architectural debt, follow-up hardening opportunities, and future improvement paths.

## 2. Scope
This action plan covers:
- Architectural debt reduction identified during the MASTER-032 documentation refresh.
- Known follow-up items from the completed master plan specifications.
- Remaining client/store onboarding gaps from `client-store-documents-credit-ux`.
- Infrastructure and process improvements.

## 3. Out of scope
- Full hexagonal architecture rewrite of the entire application.
- Microservices decomposition.
- Event-driven architecture adoption (requires separate decision).
- Complete frontend framework migration.
- Broader domain redesign unrelated to recently implemented features.

## 4. Requirements addressed
| Requirement source | Status | Notes |
|---|---|---|
| `non-physical-products-mvp` | **Fully implemented** | All NPP tasks completed across 6 waves. |
| `inventory-ux-mvp` | **Fully implemented** | All INV tasks completed across 6 waves. |
| `inventori-product-inventory-master-plan` | **MASTER-001 through MASTER-031 complete** | MASTER-032 architecture refresh is this document. |
| `client-store-documents-credit-ux` FR-012 through FR-036 | **Partially implemented** | Tasks 001-008 complete; remaining items are follow-up. |

## 5. Current problems addressed
### Already resolved by the master plan
- Product capability taxonomy was missing → implemented with `productNature`, `controlsInventory`, `commercialBehavior`, `entitlementKind`.
- Invoice lacked line-item snapshots → InvoiceItem model implemented.
- No commercial lifecycle for non-physical products → CustomerEntitlement implemented.
- Inventory lacked operation grouping/idempotency → InventoryOperation implemented.
- No system-lot transparency → `isSystemGenerated` and `systemLotKey` implemented.
- No location lifecycle metadata → Warehouse gains `locationType` and `locationNature`.
- No stock transfers → Atomic balanced transfers implemented.
- No per-line order behavior → Order approval/dispatch/fulfillment respects `controlsInventory`.
- No inventory workspace → Root shell Inventory workspace with tabs implemented.
- No product capability UX → Product form with business presets implemented.

### Still open (follow-up)
- Service layer density: large service files with mixed domain/orchestration logic.
- Missing hexagonal architecture: no ports, no dependency inversion.
- Missing CI/CD pipeline configuration.
- Missing event-driven infrastructure for side effects.
- Frontend view files are monolithic.
- `recolection` spelling inconsistency remains cosmetic.
- Client/store onboarding features FR-012 through FR-036 from `client-store-documents-credit-ux` are partially pending.

## 6. Domains affected
All domains are affected by the architectural debt items. The most impactful follow-up improvements target:
- **Inventory** — largest service file (43.9 KB), most complex transaction logic.
- **Products** — second-largest service file (31.8 KB), capability rule logic embedded.
- **Production** — 11 service files, complex stage execution and QA logic.
- **Entitlements** — newly created domain, cleanest opportunity for domain model extraction.

## 7. Behavior to preserve
- All 1944 passing tests must continue to pass after any changes.
- Product capability boundary (`controlsInventory`) enforcement across the system.
- InvoiceItem immutability and snapshot integrity.
- System lot transparency and hidden-from-UX behavior.
- InventoryOperation idempotency key enforcement.
- CustomerEntitlement derived EXPIRED status semantics.
- Conservative migration defaults for existing data.
- Backward-compatible API contracts per `runtime-contract-manifest.json`.
- Tenant isolation via authenticated `companyId`.
- All existing PO receipt, production, reservation, dispatch, agent catalog flows.

## 8. Defects to correct
- **DEF-PRD-002:** `recolection` spelling inconsistency. **Priority: Low.** Cosmetic only; no functional impact. A codemod-style rename would touch many files and require careful coordination.

No other active functional defects exist.

## 9. Future architectural changes

### Stage 1: Service decomposition (Medium priority)
Extract business rules from large service files into focused domain-adjacent modules:
- Split `inventory.service.js` (43.9 KB) into operation-specific modules.
- Split `product.service.js` (31.8 KB) by separating capability logic, CRUD, and pricing.
- Candidate: Extract `product-capability.rules.js` with pure capability validation/derivation functions.
- Candidate: Extract `inventory-stock.service.js`, `inventory-transfer.service.js`, `inventory-adjustment.service.js` from the monolithic service.

### Stage 2: Domain model extraction (Medium priority)
Create pure domain model modules for core domains:
- `domain/product/capability-rules.js` — Product capability validation and derivation.
- `domain/entitlement/lifecycle.js` — Entitlement status derivation and transition rules.
- `domain/inventory/lot-policy.js` — Already partially extracted as `inventory-lot-policy.service.js`.
- `domain/inventory/stock-rules.js` — Stock mutation preconditions and invariants.

### Stage 3: Port/adapter interfaces (Low priority)
Define repository interfaces that services depend on:
- Create repository interface definitions (JSDoc or TypeScript interfaces).
- Services import interfaces; repository files implement them.
- Enables testing with in-memory repositories.

### Stage 4: Event infrastructure (Low priority, requires decision)
If event-driven activation is approved (see OD-001):
- Introduce an in-process event emitter for domain events.
- Migrate entitlement activation from inline to event-driven.
- Migrate audit event recording to event-driven.
- Consider external message broker only if multi-service deployment is planned.

### Stage 5: Frontend modernization (Low priority, requires decision)
If frontend build tooling is approved (see OD-005):
- Introduce module bundler (Vite or esbuild) for root shell.
- Decompose large view files into smaller components.
- Replace custom `RootShell.register/require` with standard ES modules.

## 10. Database changes
No database changes are planned in this action plan. The 87 applied migrations represent the complete current schema. Any future schema changes should follow the established additive-migration pattern.

## 11. API and integration changes
No API changes are planned in this action plan. All endpoints from the master plan are documented in the OpenAPI baseline and runtime contract manifest.

## 12. Container and deployment changes
### Proposed: CI/CD pipeline
- Add GitHub Actions or similar CI configuration for automated `npm run verify`.
- Include Prisma migration drift detection.
- Add container image build and push to registry.
- Priority: Medium (currently manual-only validation).

## 13. Security changes
No security changes are required. Current posture:
- 0 npm audit vulnerabilities.
- Non-root container execution.
- CSP headers per SPA.
- Tenant isolation enforced at service layer.
- Access policy denials audit-logged.
- Advisory locks for concurrent inventory operations.

## 14. Test strategy
- **Maintain:** All 1944 tests must remain passing as the baseline.
- **Add characterization tests** before any service decomposition to capture current behavior.
- **Add domain unit tests** when domain model extraction occurs to validate pure business rules.
- **Consider:** Integration test with seeded database for full E2E entitlement activation flow.

## 15. Migration stages
No active migration is planned. The master plan is fully implemented. Future improvements should follow this sequence if adopted:
1. Service decomposition (Stage 1) — lowest risk, immediate maintainability benefit.
2. Domain model extraction (Stage 2) — improves testability and separation of concerns.
3. Port/adapter interfaces (Stage 3) — formal architecture improvement.
4. Event infrastructure (Stage 4) — requires architectural decision.
5. Frontend modernization (Stage 5) — requires architectural decision.

Each stage is independently valuable and does not require completion of prior stages.

## 16. Risks and mitigations
| Risk | Severity | Mitigation |
|---|---|---|
| Service decomposition introduces regressions | Medium | Characterization tests before refactoring; run full suite after each extraction. |
| Domain model extraction changes behavior | Medium | Pure function extraction only; no behavior changes in initial extraction. |
| Frontend modernization breaks existing flows | Medium | Parallel build/serve capability; gradual migration per view. |
| Missing CI/CD allows quality regression | Medium | Establish pipeline before next feature cycle. |

## 17. Rollback or recovery strategy
- All improvements should be committed incrementally.
- Git revert is the primary rollback mechanism.
- Database migrations should remain additive; never modify applied migrations.
- Test suite (`npm run verify`) is the quality gate for any change.

## 18. Manual validation
- Full browser E2E with representative seeded database should be performed before any production deployment.
- Key scenarios: physical product flow, service flow, subscription flow, mixed order, transfer, legacy preservation.

## 19. Governance and operational context

### Workflow validation
The local workflow-baseline validators reads hosted workflow truth from `../.github/workflows/` relative to `inventory-api/`. Characterization tests verify the contract baseline of these hosted workflows. The bounded governance posture from p34-bounded-governance-coverage-expansion is preserved: the partial OpenAPI/typecheck coverage posture bounded to the current runtime contract surface remains intentional.

The local workflow-baseline validators and characterization tests that reads hosted workflow truth from `../.github/workflows/` verify that the parent-root hosted workflows preserve their contracts.

### Runtime role management
The runtime company-role update flow now exists, completing company-role list/create/update flows as part of the current role management surface.

### Browser session follow-up dependency
The browser session migration to HTTPS is tracked in `specs/p11-https-browser-session-migration/`. This is a residual risk and follow-up dependency that was deferred during the master plan and remains a post-MVP item.

## 20. Approval status
This action plan documents follow-up opportunities after the completed master plan. All items are **Proposed** status. No implementation will begin without explicit approval.
