# Risks
## Implementation risks
1. **Missing PR diff blocks exact analysis**
   - Impact: exact impacted modules/endpoints/contracts cannot be produced.
   - Mitigation: require diff or changed-file list before executing PR-specific tasks.

2. **Hybrid authorization hides real ownership**
   - Impact: route-only review may miss service-level authorization defects.
   - Mitigation: require matrix review across route middleware, access policies and service checks.

3. **Hotspot modification risk**
   - Impact: large services and root shell files may regress unrelated behavior.
   - Mitigation: force fragmentation, characterization-first approach and expanded tests.

## Migration / compatibility risks
4. **Contract drift between runtime and docs**
   - Impact: PR may change observable behavior without updating authoritative docs.
   - Mitigation: classify each touched route/surface against runtime catalog and contract manifest.

5. **Pagination or payload drift**
   - Impact: consumer breakage or performance regressions in list endpoints.
   - Mitigation: require explicit preserve/defer/block decision for affected list endpoints.
   - Baseline sensitive endpoints:
     - optional-pagination lists backed by `src/lib/pagination.js` and `buildPaginatedResponse(...)`, including clients, company clients, products, payments, invoices, inventory movements, inventory alerts, users, company users, company roles, and company warehouses;
     - unpaginated heavy reads such as `GET /api/inventory/stocks`, `GET /api/invoices/inconsistencies`, and agent collection endpoints like `GET /api/agent/stores`, `GET /api/agent/goals`, and `GET /api/agent/visits`;
     - payload-sensitive heavy detail reads cataloged in `src/lib/heavy-endpoint-governance.js`, especially `GET /api/agent/stores/:storeId`.
   - Required evidence when touched:
     - current response shape,
     - current pagination state,
     - explicit endpoint decision: preserve contract, harden in another PR, or block,
     - blocking triggers if payload depth or collection semantics change,
     - pagination and tenant/actor-scope tests when applicable,
     - heavy-endpoint baseline evidence when governed payload classes are touched.

## Regression risks
6. **Authorization regression in route or service**
   - Impact: unauthorized access, improper denial, or tenant leakage.
   - Mitigation: auth characterization suite and endpoint ownership matrix.

7. **Public runtime/root shell regression**
   - Impact: embedded UI drift outside OpenAPI governance.
   - Mitigation: require public-runtime lint/validation and root shell tests when `src/public/root/**` or `src/public/styles.css` changes.

8. **DB + filesystem partial failure**
   - Impact: orphaned DB records or orphaned private files in client-document or payment-receipt flows.
   - Mitigation: require compensation-path review and targeted characterization/security tests.
   - Baseline sensitive flows:
     - `src/services/client.service.js`: DB metadata is created before private file persistence; file-write failure triggers DB cleanup attempt; cleanup failure can leave stale metadata.
     - `src/services/payment-receipt-evidence.service.js`: DB receipt metadata and private file persistence are coordinated with transactional DB work plus best-effort file cleanup; cleanup failure can leave orphaned private files.
     - `src/services/payment.service.js`: protected payment-receipt access and receipt lifecycle changes depend on tenant/read-scope enforcement plus file-existence handling.
   - Required evidence when touched:
     - DB write path,
     - filesystem write path,
     - rollback/compensation path,
     - residual partial-failure mode,
     - tests for protected access and failure-path behavior,
     - any additional operational evidence if compensation semantics change.

## Security risks
9. **Tenant-scope regression**
   - Impact: cross-company access or mutation.
   - Mitigation: document expected tenancy scope per endpoint and require relevant tests.

10. **Actor-scope regression in root/global policies**
   - Impact: non-root or improperly scoped actors gain administrative access.
   - Mitigation: explicitly verify `authorizeAccessPolicy` actor scope for touched governance endpoints.

## Operational risks
11. **Windows/Prisma build instability remains unresolved**
   - Evidence: `inventory-api/docs/audit/current-code-audit.md` and `../docs/audit/current-code-audit.md` describe mitigation, not closure.
   - Impact: build regressions may escape Linux-only verification.
   - Mitigation: elevate risk when diff touches Prisma/build/scripts/dependencies; require additional evidence.
   - Baseline sensitive surfaces:
     - `prisma/**`
     - `package.json` script/engine/dependency changes
     - Prisma/build helper scripts such as `scripts/prisma-generate-safe.js`
     - Docker/build flows that execute Prisma generate or deploy steps
   - Required evidence when touched:
     - `npm run build`,
     - `npm run validate:production-baseline`,
     - `npm run validate:workflow-baseline`,
     - explicit note that Windows/Prisma risk remains open unless equivalent Windows evidence is provided.

12. **Workflow/documentation ownership mismatch**
   - Evidence: `docs/production-baseline.md` references workflows that are validated from the parent hosted-repository root `.github/workflows/`, while `inventory-api/.github/workflows/` remains empty in the inspected application root.
   - Impact: CI assumptions may be false if reviewers inspect only the application root.
   - Mitigation: treat workflow ownership as a fact to verify, not an assumption, and document the root-vs-application distinction in merge analysis.
   - Baseline sensitive surfaces:
     - `docs/production-baseline.md`
     - `docs/production-operations-runbook.md`
     - `docs/restore-readiness-baseline.md`
     - `scripts/validate-workflow-baseline.js`
     - `scripts/validate-production-baseline.js`
     - `scripts/validate-restore-readiness.js`
     - `scripts/validate-operational-readiness.js`
   - Required evidence when touched:
     - `npm run validate:workflow-baseline`,
     - `npm run validate:restore-readiness`,
     - `npm run validate:operational-readiness`,
     - explicit note that hosted workflow truth lives in parent-root `.github/workflows/` rather than `inventory-api/.github/workflows/`.

## UX / review-process risks
13. **Manual process inconsistency**
   - Impact: reviewers may apply gates unevenly.
   - Mitigation: provide explicit minimum and expanded matrices plus blocking criteria.

## Hotspot risk map
This map is the baseline catalog to apply only when the real PR diff touches the hotspot. It must not be expanded into mandatory work for untouched hotspots.

| Hotspot | Why it is a hotspot | Functional risk | Coupling risk | Minimum validation when touched | Expanded/recommended validation when touched | Fragmentation guidance |
|---|---|---|---|---|---|---|
| `src/services/inventory.service.js` | Large inventory application flow with tenant-owned stock, movements, alerts, lots, and adjustments | Stock corruption, alert regressions, tenant-scope leakage, order/inventory behavior drift | High coupling to `src/routes/inventory.routes.js`, inventory repositories, order flows, and tenant-sensitive persistence | `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test`, `node --test tests/inventory-alerts-tenant-scope.test.js` | `node --test tests/order-lifecycle-contract-characterization.test.js`; related route/tenant tests for the touched inventory flow; characterization before broad refactor | Split by inventory capability such as alerts, stocks, movements, entries, QA, or adjustments; avoid mixing structural cleanup with behavior changes |
| `src/services/agent-workspace.service.js` | Large service with route-level access-policy guard plus service-owned actor/tenant checks | Agent visibility leaks, incorrect store/route debt exposure, actor-scope regressions | High coupling to `src/routes/agent.routes.js`, `agent.workspace.access`, sales-route data shape, invoice/payment summaries, and service-owned authorization | `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test`; run closest existing auth suites from TASK-005 when actor scope is touched | `node --test tests/access-policies.test.js`; `node --test tests/authorization-convergence-characterization.test.js`; `node --test tests/auth-hardening-characterization.test.js`; `node --test tests/browser-session-auth-boundary.test.js` when auth/session edges change | Split by endpoint family or actor-scope rule; require characterization-first change notes because route middleware alone still does not show the full effective authorization |
| `src/services/product.service.js` | Sizable service behind product and inventory-adjacent catalog behavior | Product visibility, mutation, or tenant-scope regressions that can cascade into inventory/order flows | Medium-high coupling to product routes, repositories, and downstream inventory consumers | `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test` | Add product-route, tenant-scope, and adjacent inventory regression tests relevant to the touched behavior; if public/runtime contracts move, add contract validations | Split by bounded product use case; do not combine catalog refactor, pricing behavior, and inventory side effects in one uncontrolled change |
| `src/security/access-policies.js` | Stable access-policy facade over a split authorization seam used by many protected routes | Authorization widening/narrowing, actor-scope mistakes, forbidden/allow regressions across multiple route families | Very high coupling to protected route modules, `authorizeAccessPolicy(...)`, `src/security/access-policy-registry.js`, service-level scope checks, and audit expectations | `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test`, `node --test tests/authorization-convergence-characterization.test.js` | `node --test tests/administrative-authorization-characterization.test.js`; `node --test tests/company-authorization-characterization.test.js`; `node --test tests/auth-hardening-characterization.test.js` when auth boundaries also move | Split by policy family or actor-scope boundary; never batch unrelated policy rewrites across many domains without per-family validation |
| `src/public/root/**` | Supported embedded root shell outside OpenAPI-only governance | Browser runtime breakage, route/view regressions, actor-visibility drift, UX flow regressions | High coupling across manifest, router, view modules, session bootstrap, and runtime validators | `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test`, `npm run lint:public-runtime`, `npm run validate:public-runtime`, `node --test tests/public-surface-characterization.test.js tests/root-shell-route-governance.test.js` | `node --test tests/root-shell-modularity-governance.test.js`; `node --test tests/browser-e2e.e2e.js`; view-specific characterization suites when the touched module already has them | Split by shell seam such as manifest, router, shared UI, or one bounded view; avoid sweeping multi-view rewrites in a single PR |
| `src/public/styles.css` | Shared browser presentation contract for login, fallback pages, and root shell | Visual regressions, overflow/layout drift, hidden route affordance breakage in the supported browser runtime | Medium-high coupling to root shell markup, public runtime validator assumptions, and browser E2E expectations | `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test`, `npm run lint:public-runtime`, `npm run validate:public-runtime`, `node --test tests/public-surface-characterization.test.js` | `node --test tests/root-shell-route-governance.test.js`; `node --test tests/browser-e2e.e2e.js`; any affected view/shell characterization tests for layout-sensitive modules | Split by bounded visual surface such as sidebar, shell layout, or one page family; avoid unrelated style churn across the whole runtime |

## PR-review usage rule
1. Detect whether any baseline hotspot is present in the real changed-file set.
2. For each touched hotspot only, record:
   - hotspot path;
   - functional risk;
   - coupling risk;
   - minimum validation;
   - expanded/recommended validation;
   - fragmentation expectation.
3. If no hotspot is touched, do not add hotspot-triggered expanded tests or hotspot-driven fragmentation requirements.
4. If multiple hotspots are touched together, elevate the PR to at least high risk and document the cross-hotspot coupling explicitly.
