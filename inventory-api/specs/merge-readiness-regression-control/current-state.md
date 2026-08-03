# Current State Analysis
## 1. System overview
Confirmed behavior:
- The executable application lives in `inventory-api/` and is a layered Node.js + Express + Prisma monolith (`inventory-api/src/app.js`, `inventory-api/package.json`).
- The runtime serves both JSON APIs and embedded static UI from the same process via `express.static(publicRootDirectory)` (`inventory-api/src/app.js`).
- Authentication is centralized in `src/middlewares/authenticate.js`, but authorization is hybrid: role middleware, permission middleware, access-policy wrapper, and additional service checks coexist.

Confirmed behavior:
- A dedicated specification package now exists under `inventory-api/specs/merge-readiness-regression-control/`, but no PR-specific diff artifact is available yet to freeze the exact impact of a concrete merge candidate.

Missing information:
- No PR diff artifact was available in the repository inspection, so the exact impact of a concrete PR cannot be frozen yet.

## 2. Relevant repository structure
Relevant files and directories confirmed during inspection:
- `inventory-api/package.json`
- `inventory-api/src/app.js`
- `inventory-api/src/routes/*.routes.js`
- `inventory-api/src/middlewares/authenticate.js`
- `inventory-api/src/middlewares/authorize.js`
- `inventory-api/src/middlewares/authorizePermission.js`
- `inventory-api/src/security/access-policies.js`
- `inventory-api/src/services/inventory.service.js`
- `inventory-api/src/services/agent-workspace.service.js`
- `inventory-api/src/services/product.service.js`
- `inventory-api/src/services/payment.service.js`
- `inventory-api/src/services/client.service.js`
- `inventory-api/src/services/payment-receipt-evidence.service.js`
- `inventory-api/src/public/root/**`
- `inventory-api/src/public/styles.css`
- `inventory-api/tests/*.test.js`
- `inventory-api/docs/runtime-endpoint-catalog.md`
- `inventory-api/docs/runtime-contract-manifest.json`
- `inventory-api/docs/critical-contract-matrix.json`
- `inventory-api/docs/current-state.md`
- `inventory-api/docs/architecture.md`
- `inventory-api/docs/production-baseline.md`
- `inventory-api/docs/audit/current-code-audit.md`
- `../docs/audit/current-code-audit.md`

## 3. Current components
### 3.1 Runtime composition
Confirmed behavior:
- `src/app.js` mounts API routers for auth, companies, roles, users, clients, products, orders, invoices, payments, inventory, warehouses, regions, sales routes, agent workspace, taxpayer, geocoding and economic activities.
- `src/app.js` also serves `src/public` statically and has root-shell specific CSP and legacy-route handling for public UI.

### 3.2 Authorization building blocks
Confirmed behavior:
- `src/middlewares/authenticate.js` supports both bearer tokens and browser cookie sessions, reloads the user from DB on every authenticated request, and can reject by inactive user/role/company.
- `src/middlewares/authorize.js` enforces role-based checks only.
- `src/middlewares/authorizePermission.js` enforces permission-based checks only.
- `src/security/access-policies.js` wraps both mechanisms and adds actor-scope validation for policies such as `global-root`, `company-admin`, and `agent-workspace-user`.

### 3.3 Hotspots relevant to requested planning
Confirmed behavior:
- `src/services/inventory.service.js` is a large service file (25.5 KB in repository listing) used by `src/routes/inventory.routes.js` for entries, adjustments, stocks, movements and alerts.
- `src/services/agent-workspace.service.js` is a large service file (22.3 KB) used by `src/routes/agent.routes.js`; agent routes now use `authorizeAccessPolicy('agent.workspace.access')` and still rely on service-level actor and tenant checks for finer scope.
- `src/services/product.service.js` is a sizable service file (13.6 KB) used by `src/routes/product.routes.js`.
- `src/security/access-policies.js` is the stable access-policy facade/entrypoint, while `src/security/access-policy-registry.js` owns declarative policy definitions and `src/security/access-policy-actor-scope.js` owns actor-scope evaluation.
- `src/public/root/**` and `src/public/styles.css` represent the embedded root-shell/browser runtime.

## 4. Current data flow
### 4.1 Authorization flow
Confirmed behavior:
1. `src/app.js` mounts routers.
2. Protected routers call `authenticate` first.
3. Route-level authorization then happens through one of:
   - `authorize(...)`
   - `authorizePermission(...)`
   - `authorizeAccessPolicy(...)`
4. Some services perform additional company/actor validation, for example `scope(auth)` / `getAgentContext(auth)` in `src/services/agent-workspace.service.js` and `assertCompanyScope(auth)` in `src/services/payment.service.js`.

### 4.2 Contract governance flow
Confirmed behavior:
- `inventory-api/docs/runtime-endpoint-catalog.md` documents mounted endpoints and their observed route-level authorization.
- `inventory-api/docs/runtime-contract-manifest.json` records intentionally excluded runtime operations from the partial OpenAPI contract.
- `inventory-api/docs/critical-contract-matrix.json` documents a critical minimum contract slice.

### 4.3 DB + filesystem sensitive flows
Confirmed behavior:
- `src/services/client.service.js` writes client document metadata to DB and file bytes to private storage via `fs.mkdir` + `fs.writeFile`, then attempts DB cleanup if file persistence fails.
- `src/services/payment-receipt-evidence.service.js` writes payment receipt metadata and files, and attempts file cleanup if the combined operation fails.
- `src/services/payment.service.js` later validates receipt download access and file existence before download.

## 5. Current domain model
Confirmed behavior:
- Company/tenant scoping is pervasive in services such as `payment.service.js` and `agent-workspace.service.js`, but enforcement location varies.
- Product, inventory, order, payment and client flows each have route/service/repository layers.

Inferred behavior:
- Merge-risk analysis must treat authorization ownership and tenancy scope as domain-critical cross-cutting concerns rather than purely transport concerns.

## 6. Current APIs or interfaces
Confirmed behavior from `src/app.js` and `docs/runtime-endpoint-catalog.md`:
- API surface is broad and partially contract-governed.
- Some routes are fully guarded by access policies (`inventory`, `products`, `payments`, `companies`, `agent`), while others still use plain roles (`clients`, some `orders`, `regions`, `sales-routes`).
- The embedded browser runtime under `src/public` is intentionally outside partial OpenAPI and is governed separately by docs/tests referenced in `docs/runtime-contract-manifest.json`.

## 7. Current database behavior
Confirmed behavior:
- Prisma is the ORM (`inventory-api/package.json`, `inventory-api/prisma/schema.prisma`).
- No repository inspection revealed an atomic DB+filesystem transaction boundary; compensation is manual in file-backed flows.
- Pagination is implemented as optional query parsing in `src/lib/pagination.js` with `page`/`pageSize`, defaults and max page size 100 when requested.

Confirmed paginated route usage by search:
- `client.routes.js`
- `inventory.routes.js`
- `invoice.routes.js`
- `warehouse.routes.js`
- `payment.routes.js`
- `product.routes.js`
- `role.routes.js`
- `user.routes.js`

Current limitation:
- Not every route uses pagination, so list endpoints remain a surface to inspect per diff instead of assuming uniform segmentation.

## 8. Existing tests
Confirmed behavior from repository listing:
- The repository already contains extensive characterization/governance tests for auth, authorization, contracts, public runtime, payments, documents, inventory and root shell.
- Relevant test files include:
  - `tests/auth-hardening-characterization.test.js`
  - `tests/browser-session-auth-boundary.test.js`
  - `tests/administrative-authorization-characterization.test.js`
  - `tests/company-authorization-characterization.test.js`
  - `tests/authorization-convergence-characterization.test.js`
  - `tests/public-surface-characterization.test.js`
  - `tests/root-shell-route-governance.test.js`
  - `tests/root-shell-modularity-governance.test.js`
  - `tests/payment-receipt-security.test.js`
  - `tests/payment-tenant-scope.test.js`
  - `tests/client-document-security.test.js`
  - `tests/client-document-governance.test.js`
  - `tests/openapi-contract-consistency.test.js`
  - `tests/runtime-contract-governance.test.js`
  - `tests/governance-baseline-sync-guardrails.test.js`
  - `tests/inventory-alerts-tenant-scope.test.js`
  - `tests/order-lifecycle-contract-characterization.test.js`

## 9. Current limitations
Confirmed behavior:
- Exact PR impact cannot be determined because no diff artifact was available.
- `inventory-api/specs/merge-readiness-regression-control/` now exists as the governance package for this feature.
- `inventory-api/docs/audit/current-code-audit.md` is now present locally, and the broader audit archive also exists at `../docs/audit/current-code-audit.md`.
- `inventory-api/.github/workflows/` remains empty, while repository-hosted workflow contracts are validated from the parent root `.github/workflows/` by `scripts/validate-workflow-baseline.js`.

Implication:
- Tasks that depend on the real changed-file set remain blocked by the missing PR diff, and workflow-related analysis must distinguish application-root emptiness from hosted-repository workflow ownership.

## 10. Technical debt related to the change
Confirmed behavior:
- Authorization is intentionally hybrid and not fully converged (`authenticate`, `authorize`, `authorizePermission`, `authorizeAccessPolicy`, service checks).
- Agent routes now expose explicit route-level access-policy guards, but still rely heavily on service-level authorization checks for company, actor-profile, and assigned-route scope (`src/routes/agent.routes.js`, `src/services/agent-workspace.service.js`).
- Contract governance is partial by design: some runtime operations are outside OpenAPI and tracked via manifest exceptions.
- DB+filesystem flows rely on manual compensation logic, not atomic distributed transactions.
- Documentation and validator ownership still require path discipline: audit evidence now exists both in `inventory-api/docs/audit/` and `../docs/audit/`, while workflow validation resolves against the parent hosted-repository root rather than `inventory-api/.github/workflows/`.

## 11. Risks
- Regression risk is high when touching hybrid authorization or service-level scope checks because ownership is distributed.
- Contract drift risk is non-trivial because runtime includes both OpenAPI-covered and intentionally excluded surfaces.
- UI/runtime drift risk exists because `src/public` is governed outside OpenAPI.
- Operational/build risk remains notable around Prisma/Windows according to both `inventory-api/docs/audit/current-code-audit.md` and `../docs/audit/current-code-audit.md`.
- File-backed persistence flows carry partial-failure risk.

## 12. Relevant files
- `inventory-api/package.json`
- `inventory-api/src/app.js`
- `inventory-api/src/middlewares/authenticate.js`
- `inventory-api/src/middlewares/authorize.js`
- `inventory-api/src/middlewares/authorizePermission.js`
- `inventory-api/src/security/access-policies.js`
- `inventory-api/src/routes/inventory.routes.js`
- `inventory-api/src/routes/agent.routes.js`
- `inventory-api/src/routes/product.routes.js`
- `inventory-api/src/routes/company.routes.js`
- `inventory-api/src/routes/payment.routes.js`
- `inventory-api/src/services/agent-workspace.service.js`
- `inventory-api/src/services/inventory.service.js`
- `inventory-api/src/services/product.service.js`
- `inventory-api/src/services/client.service.js`
- `inventory-api/src/services/payment.service.js`
- `inventory-api/src/services/payment-receipt-evidence.service.js`
- `inventory-api/src/lib/pagination.js`
- `inventory-api/docs/runtime-endpoint-catalog.md`
- `inventory-api/docs/runtime-contract-manifest.json`
- `inventory-api/docs/critical-contract-matrix.json`
- `inventory-api/docs/production-baseline.md`
- `inventory-api/docs/audit/current-code-audit.md`
- `../docs/audit/current-code-audit.md`
