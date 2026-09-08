# Current Code Audit
**Agent ID:** `baseline-audit-agent-5c03f7` · `code-puppy-036e14`
**Date:** 2025-07-14
**Repository:** `inventory-api`
**Focus areas:** `companies-admin.js`, `feedback-admin.js`, `access-policy-registry.js` (recent changes)

> **Scope note:** This is a focused post-implementation baseline audit covering the bounded runtime governance changes introduced in this session. Canonical `docs/**` artifacts (current-state, architecture, action-plan) remain the source of truth for full system documentation. `docs/current-state.md` describes implemented state; `docs/architecture.md` describes active runtime architecture.

---

## Executive Summary

This audit covers the full repository with emphasis on the three files that received recent changes:

- `src/public/root/views/companies-admin.js` — added Hacienda taxpayer lookup, identification-type dropdown, economic-activity dropdown
- `src/public/root/views/feedback-admin.js` — added row-click detail modal, fixed `toLocaleDateString` → `toLocaleString`
- `src/security/access-policy-registry.js` — added `'root'` to `integration.taxpayer.lookup` roles array

The repository's baseline architecture is well-structured: layered Express monolith with clear routes → services → repositories separation, Zod validation, comprehensive audit instrumentation, multi-stage Docker, non-root container user, CSP headers, and an extensive automated test suite exceeding 230 test files.

**However, the recent changes introduced one confirmed functional defect**: the `companies-admin.js` view calls `clientsApi.listEconomicActivities()` which hits `GET /api/economic-activities`, but the `integration.economic-activities.list` policy was NOT updated to include `'root'`. Root users will always receive a 403 on this endpoint, and the economic-activity dropdown will silently show "No se pudieron cargar las actividades" on every page load. Additionally, the taxpayer policy change lacks a test assertion and carries a metadata inconsistency.

---

## Overall Score

**6.5 / 10**

| Factor | Assessment |
|---|---|
| Base architecture | Solid layered monolith, well-governed |
| Test coverage | Extensive characterization + contract tests |
| Docker / infrastructure | Production-grade multi-stage Dockerfile |
| Security | Strong (CSP, CSRF, non-root, audit log) |
| Documentation structure | Well-separated, update-log maintained |
| Recent change — `companies-admin.js` | Broken economic-activity dropdown for root (Critical) |
| Recent change — `feedback-admin.js` | Locale inconsistency, unescaped emoji fallback |
| Recent change — `access-policy-registry.js` | Missing test, policy metadata inconsistency |
| Documentation freshness | Recent changes not reflected in `docs/current-state.md` |

**Verdict: Needs Refactoring** (limited to the recent change slice; baseline is Acceptable)

---

## Repository Overview

| Item | Value |
|---|---|
| Runtime | Node.js 24, Express 4 |
| ORM | Prisma 5.22 |
| Database | PostgreSQL 16 |
| Session cache | Redis 7 |
| Validation | Zod 3 |
| Auth | JWT (Bearer) + Browser session (cookie + Redis) |
| Frontend delivery | Static files served from the same Express process |
| Test framework | `node:test` (native) |
| Container | Docker multi-stage, non-root user `inventory` |
| CI/CD | Not present in repository (no `.github/workflows/` or equivalent) |

---

## Current Architecture

### Architectural Style
Layered Express modular monolith with browser SPAs delivered from the same runtime.

### Layer Dependency Direction (observed)
```
HTTP (routes/) → Service layer (services/) → Repository layer (repositories/) → Prisma → PostgreSQL
Browser SPAs (public/) → REST API (routes/)
```

### Module Groupings
- **Identity & Access** — `src/middlewares/`, `src/security/`, `src/services/auth.service.js`
- **Company / Users / Roles** — `src/routes/company.routes.js`, `src/services/company.service.js`
- **Clients / Stores** — `src/routes/client.routes.js`, `src/services/client.service.js`
- **Products / Recipes** — `src/services/recipe.service.js`, `src/services/product.service.js`
- **Inventory / Lots** — `src/services/inventory*.js`
- **Production / QA** — `src/services/production*.js`, `src/services/quality*.js`
- **Procurement / Receipts** — `src/services/procurement*.js`, `src/services/receipt.service.js`
- **Sales / Orders / Billing / Payments** — `src/services/order.service.js`, `src/services/payment.service.js`
- **Integrations** — `taxpayer.service.js`, `geocoding.service.js`, `economic-activity.service.js`
- **Feedback** — `src/routes/feedback.routes.js`, `src/services/feedback.service.js`
- **Root-shell SPA** — `src/public/root/`
- **Warehouse SPA** — `src/public/warehouse/`
- **Agent SPA** — `src/public/agent/`

### Persistence Strategy
- Prisma ORM with BigInt PKs throughout (except `feedback.id` which is Int/serial by design decision DEC-004)
- Additive SQL migrations (no destructive migrations observed)
- No float money fields observed — money handled via integer/BigInt cents or locale-formatted strings

### Authentication
- Dual path: Bearer JWT (API/mobile) and browser-session cookie (SPA)
- `authenticate.js` middleware handles both paths
- Sessions stored in Redis (production) or memory (dev/test)
- CSRF protection via origin check for state-changing cookie-session requests

### Authorization
- Role-based and permission-based access via `access-policy-registry.js` + `access-policies.js`
- Actor-scope validation layer (`access-policy-actor-scope.js`) for company/global-root/agent scoping
- All denials recorded via `audit.recordAuditEventSafelyIfAvailable()`

---

## Documentation Findings

### Documentation Structure Evaluation

| File | Purpose | Separation Quality |
|---|---|---|
| `docs/current-state.md` | Observable current truth | ✅ Clear, well-maintained with per-section update log |
| `docs/architecture.md` | Active architecture decisions | ✅ Describes implemented state only |
| `docs/action-plan.md` | Future change planning | ✅ Clearly separated from current state |
| `docs/tasks.md` | Task tracking | ✅ Task-level; does not mix states |
| `docs/coding_standard.md` (canonical) | Coding standards | ✅ Properly owned |
| `docs/coding_standard.md` (bridge) | Compatibility bridge | ✅ Redirects to canonical |

Documentation separation is **excellent**. Future-state and current-state are clearly delimited. The action plan explicitly marks what is and isn't implemented. No penalty is assessed for the existence of `action-plan.md` or `tasks.md` — these are properly scoped to future work.

---

### AUD-DOC-001
- **ID:** AUD-DOC-001
- **Severity:** Medium
- **Category:** Documentation — Missing Update (current-state truth drift)
- **Location:** `docs/current-state.md` (update log table, §1 System overview, §4 Existing domains)
- **Evidence:** The update log's last entry is `2026-11-01`. The following code changes are not reflected:
  - `companies-admin.js`: Hacienda taxpayer lookup, identification-type `<select>`, economic-activity `<select>`
  - `feedback-admin.js`: row-click detail modal (`openDetailModal`), `toLocaleString` date fix
  - `access-policy-registry.js`: `'root'` added to `integration.taxpayer.lookup`
- **Impact:** `docs/current-state.md` no longer accurately describes current code truth for these three files. Downstream agents and developers relying on it will have incorrect information about root-user taxpayer-lookup behavior and the feedback admin view capabilities.
- **Recommendation:** Append a row to the MAINT-002 update log table and update §1 and §4 to reflect: (a) root can now call `GET /api/taxpayers/lookup`; (b) `companies-admin.js` wires Hacienda lookup and economic-activity dropdown via `clientsApi`; (c) `feedback-admin.js` includes a row-click detail modal.

---

## Main Modules

| Module | File(s) | Responsibility | Size |
|---|---|---|---|
| App bootstrap | `src/app.js` | Express setup, CSP, route mounting | 10.7 KB |
| Auth middleware | `src/middlewares/authenticate.js` | JWT + cookie-session dual auth | 5.6 KB |
| Access policy registry | `src/security/access-policy-registry.js` | Frozen policy map (role/permission mode) | 22.1 KB |
| Access policies engine | `src/security/access-policies.js` | Policy lookup + actor-scope guard | 1.7 KB |
| Companies admin view | `src/public/root/views/companies-admin.js` | Root-shell company CRUD + Hacienda lookup | 20.3 KB |
| Feedback admin view | `src/public/root/views/feedback-admin.js` | Root-shell feedback list + detail modal | 10.9 KB |
| Taxpayer service | `src/services/taxpayer.service.js` | Hacienda HTTP adapter + response normalization | 3.0 KB |
| Economic activity service | `src/services/economic-activity.service.js` | In-memory activity catalog (15 entries) | 1.5 KB |
| Clients API (browser) | `src/public/root/clients-api.js` | Browser wrapper for client + integration endpoints | 7.3 KB |
| Companies API (browser) | `src/public/root/companies-api.js` | Browser wrapper for company CRUD | 1.1 KB |
| Feedback API (browser) | `src/public/root/feedback-api.js` | Browser wrapper for feedback endpoints | 1.2 KB |

---

## Main Dependencies

| Package | Version | Role |
|---|---|---|
| `express` | ^4.22.2 | HTTP framework |
| `@prisma/client` | ^5.22.0 | ORM |
| `bcrypt` | ^6.0.0 | Password hashing |
| `jsonwebtoken` | ^9.0.2 | JWT signing/verification |
| `zod` | ^3.23.8 | Request validation |
| `cors` | ^2.8.5 | CORS handling |
| `morgan` | ^1.11.0 | Request logging |
| `dotenv` | ^16.6.1 | Env var loading |
| Redis client | Not declared in `package.json` | Session store (requires clarification) |

---

## Database Findings

### Schema Quality (general)
- BigInt PKs throughout (consistent)
- Additive migrations only; no destructive migrations observed in `prisma/migrations/`
- Indexes on filtered columns (`feedback_resolved_idx`, `feedback_created_at_idx`, `feedback_company_id_idx`)
- `feedback` table uses denormalized user info (no FK to User or Company) — documented design decision (DEC-004) for audit resilience
- No float money columns observed
- `created_at` / `updated_at` audit columns on main entities

### AUD-DB-001
- **ID:** AUD-DB-001
- **Severity:** Low
- **Category:** Schema — Type Mismatch
- **Location:** `prisma/migrations/20261015000000_add_feedback_table/migration.sql`, `company_id INTEGER`
- **Evidence:** `company_id INTEGER` in `feedback` — intentionally denormalized without FK. Company PKs elsewhere are BigInt. If company IDs ever exceed `Integer.MAX_VALUE` (~2.1 billion), the `company_id` column would overflow.
- **Impact:** Low for current scale, but a latent type inconsistency.
- **Recommendation:** Document the expected ID range for this column or change to `BIGINT` if consistency is preferred.

---

## API Findings

### AUD-001 — CRITICAL
- **ID:** AUD-001
- **Severity:** Critical
- **Category:** Authorization — Broken Endpoint Access for Recent Feature
- **Location:** `src/security/access-policy-registry.js` (line ~396, `integration.economic-activities.list`); `src/public/root/views/companies-admin.js` (EA select population block in `mount()`)
- **Evidence:**
  ```js
  // access-policy-registry.js
  'integration.economic-activities.list': {
    mode: 'role',
    roles: ['admin', 'sales'],   // ← 'root' NOT added
    boundary: 'tenant-operational',
    transition: 'documented-legacy-role',
  },

  // companies-admin.js mount()
  clientsApi.listEconomicActivities(session)   // ← called by root users
    .then((activities) => { /* populate eaSelect */ })
    .catch(() => {
      eaSelect.innerHTML = '<option value="">No se pudieron cargar las actividades</option>';
    });
  ```
  - `companies-admin.js` is exclusively accessible to `root` users (its route is protected by `company.root-companies.list` with `actorScope: 'global-root'`).
  - `clientsApi.listEconomicActivities()` calls `GET /api/economic-activities`.
  - That route is guarded by `authorizeAccessPolicy('integration.economic-activities.list')` which calls `authorize('admin', 'sales')`.
  - Root users always fail this check with 403.
  - The `.catch()` swallows the error silently.
- **Impact:** The economic-activity dropdown in the company creation form is **permanently broken for all root users**. No error is surfaced to the user. The update to `integration.taxpayer.lookup` (adding `'root'`) was applied but the parallel update to `integration.economic-activities.list` was not.
- **Recommendation:** Add `'root'` to `roles` in `integration.economic-activities.list` in `access-policy-registry.js`. This is a one-line change that mirrors the fix already applied to `integration.taxpayer.lookup`.

---

### AUD-002
- **ID:** AUD-002
- **Severity:** Medium
- **Category:** Policy Metadata — Boundary Inconsistency
- **Location:** `src/security/access-policy-registry.js` line ~390, `integration.taxpayer.lookup`
- **Evidence:**
  ```js
  'integration.taxpayer.lookup': {
    mode: 'role',
    roles: ['root', 'admin', 'sales'],
    boundary: 'tenant-operational',      // ← misleading after adding 'root'
    transition: 'documented-legacy-role',
  },
  ```
  `'root'` is a platform-global actor (`companyId = null`). `boundary: 'tenant-operational'` indicates this policy applies only to actors inside a company tenant. Adding `'root'` without updating `boundary` creates a metadata inconsistency.
- **Impact:** Any tooling or documentation that relies on the `boundary` field to classify endpoint scope will misclassify this endpoint as company-scoped only.
- **Recommendation:** Update `boundary` to `'multi-scope'` or split the policy into a platform variant and a tenant variant. At minimum, add a JSDoc comment clarifying that root access is permitted for the company-creation workflow.

---

### AUD-003
- **ID:** AUD-003
- **Severity:** Medium
- **Category:** Cross-Domain Coupling
- **Location:** `src/public/root/views/companies-admin.js` lines 2–3
- **Evidence:**
  ```js
  const companiesApi = rootShell.require('companiesApi');
  const clientsApi = rootShell.require('clientsApi');  // ← cross-domain dependency
  ```
  `companies-admin.js` (platform-global root view) depends on `clientsApi` (designed for company-scoped client management) to call `lookupTaxpayer` and `listEconomicActivities`. These are integration utilities first introduced in the clients-admin context and reused here for convenience.
- **Impact:** The company management view is tightly coupled to the client management API module. Changes to `clientsApi`'s public interface could silently break `companies-admin.js`. This coupling is invisible from the module manifest.
- **Recommendation:** In the long term, extract `lookupTaxpayer` and `listEconomicActivities` to a shared `integrationApi` module accessible from both workspaces. In the short term, add a comment in `companies-admin.js` explaining why these specific functions from `clientsApi` are reused here.

---

### AUD-004
- **ID:** AUD-004
- **Severity:** Low
- **Category:** DRY Violation — Duplicated UX Logic
- **Location:** `src/public/root/views/companies-admin.js` (lines 224–278), `src/public/root/views/clients-admin.js` (taxpayer lookup block)
- **Evidence:** Both views implement a function named `runTaxpayerLookup()` with identical structure: disable button, call `clientsApi.lookupTaxpayer()`, auto-populate form fields, handle errors, re-enable button. The blur-trigger and click-trigger wiring is structurally identical in both views.
- **Impact:** Any bug fix or UX improvement to the taxpayer lookup flow must be applied in two separate places.
- **Recommendation:** Extract the taxpayer lookup UX pattern into a shared helper (e.g., `integrationHelpers.attachTaxpayerLookup(container, clientsApi, session, { fieldMapping })`) reusable from both views.

---

## Security Findings

### AUD-005
- **ID:** AUD-005
- **Severity:** Low
- **Category:** XSS — Defense in Depth Gap
- **Location:** `src/public/root/views/feedback-admin.js`, `renderRatingEmoji()` function (and its call sites in `renderFeedbackRow` and `openDetailModal`)
- **Evidence:**
  ```js
  const RATING_EMOJI = { 1: '😞', 2: '😐', 3: '😊', 4: '😄', 5: '🤩' };

  function renderRatingEmoji(rating) {
    return RATING_EMOJI[rating] || String(rating);  // ← String(rating) not escaped
  }
  // Called as:
  `<td>${renderRatingEmoji(item.rating)}</td>`
  `<h2 ...>${renderRatingEmoji(item.rating)} ${renderCategoryLabel(item.category)}</h2>`
  ```
  The fallback `String(rating)` is injected directly into the HTML template without `ui.escapeHtml()`. By contrast, `renderCategoryLabel()` correctly uses `ui.escapeHtml(String(category))` on its fallback path.
- **Impact:** If `rating` is outside 1–5 (data corruption, future schema change, direct DB insert), the raw value enters the DOM unescaped. The `createFeedbackSchema` validates `z.number().int().min(1).max(5)` at submission time, which significantly reduces practical risk. However, the defense-in-depth gap is inconsistent with the rest of the file.
- **Recommendation:** Change the fallback to `ui.escapeHtml(String(rating))`. Negligible cost, eliminates the risk.

---

### AUD-006
- **ID:** AUD-006
- **Severity:** Suggestion
- **Category:** Security — Inline Styles in Modal
- **Location:** `src/public/root/views/feedback-admin.js`, `openDetailModal()` function
- **Evidence:** The feedback detail modal is constructed with extensive inline CSS (`style="..."` attributes):
  ```js
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:10000', ...
  ].join(';');
  // And in innerHTML:
  style="background:#fff;color:#1e293b;border-radius:12px;padding:24px;..."
  ```
- **Impact:** Not a direct security vulnerability, but inline styles increase `style-src` attack surface if the CSP ever needs tightening. The rest of the SPA uses `styles.css` for presentation. This modal is an outlier that is harder to restyle globally.
- **Recommendation:** Extract modal styles to `styles.css` using CSS classes. This is consistent with how other overlays and dialogs are styled in the SPA.

---

## Container Findings

### Dockerfile Assessment

| Check | Status |
|---|---|
| Multi-stage build | ✅ `base → build → runtime` |
| Non-root user | ✅ `USER inventory` (created in runtime stage) |
| Node.js image (major version pinned) | ✅ `node:24-bullseye-slim` |
| Dev dependencies excluded | ✅ `npm prune --omit=dev` in build stage |
| Health check present | ✅ `HEALTHCHECK` with `/health/ready` endpoint |
| Port exposed | ✅ `EXPOSE 2500` |
| Secrets in image | ✅ Not present; only `.env.example` copied |
| Image digest pinned | ⚠️ No digest hash — floating tag `24-bullseye-slim` |

### AUD-CONT-001
- **ID:** AUD-CONT-001
- **Severity:** Low
- **Category:** Container — Floating Image Tag
- **Location:** `Dockerfile` line 1
- **Evidence:** `FROM node:24-bullseye-slim AS base` — no digest hash pinning.
- **Impact:** A base image update could introduce unexpected behavior in production builds.
- **Recommendation:** Pin to a specific digest (e.g., `node:24-bullseye-slim@sha256:...`) for production stability.

---

## Testing Findings

### Test Suite Quality

The test suite is extensive: 230+ test files using Node's native `node:test` runner. Test categories observed: characterization, contract, migration validation, governance, service unit, and browser E2E (Playwright). Coverage is broad across the main domain areas.

### AUD-TEST-001
- **ID:** AUD-TEST-001
- **Severity:** High
- **Category:** Testing — Missing Assertion for New Policy Change
- **Location:** `tests/taxpayer-characterization.test.js`, test named "taxpayer lookup route keeps admin and sales role restrictions"
- **Evidence:**
  ```js
  test('taxpayer lookup route keeps admin and sales role restrictions', async () => {
    // Verifies: warehouse role → 403 ✅
    // Verifies: admin role → allowed ✅
    // Verifies: sales role → allowed ✅
    // Missing: root role → allowed ← NOT TESTED after policy change
  });
  ```
  The `integration.taxpayer.lookup` policy was recently updated to `roles: ['root', 'admin', 'sales']`. No existing test verifies that `root` is now allowed. The test label ("keeps admin and sales role restrictions") is now incorrect — it omits `root`.
- **Impact:** If the policy change is accidentally reverted, no test would catch it. The test provides false confidence about the complete set of authorized roles.
- **Recommendation:** Add:
  ```js
  const rootAllowedError = await runGuard(guard, { role: 'root', companyId: null });
  assert.equal(rootAllowedError, undefined);
  ```
  Update the test name to: `'taxpayer lookup route allows root, admin and sales; denies all others'`.

---

### AUD-TEST-002
- **ID:** AUD-TEST-002
- **Severity:** Medium
- **Category:** Testing — Missing Feature Coverage
- **Location:** `tests/` (no characterization file for the new `companies-admin.js` features)
- **Evidence:** Searching for `companiesAdmin` in tests yields only surface/smoke/router registration references. No test characterizes: (a) the `runTaxpayerLookup()` flow, (b) the EA dropdown population via `clientsApi.listEconomicActivities`, (c) the identification-type select structure. The critical defect (AUD-001) would have been detectable via a test that verifies EA endpoint access under a root session.
- **Impact:** New companies-admin features are fully uncharacterized. Regressions in the lookup or dropdown behavior will not be caught by the automated test suite.
- **Recommendation:** Create `tests/companies-admin-view-characterization.test.js` covering:
  1. Registration of `views.companiesAdmin`
  2. Render HTML structure (form fields, EA select, lookup button)
  3. Source contract: `clientsApi.lookupTaxpayer` and `clientsApi.listEconomicActivities` are called
  4. Source contract: identification-type select contains the 4 CR options
  5. Static check: EA select has `id="companies-ea-select"` to confirm wiring

---

### AUD-TEST-003
- **ID:** AUD-TEST-003
- **Severity:** Low
- **Category:** Testing — Missing Detail Modal Coverage
- **Location:** `tests/feedback-admin-view-characterization.test.js`
- **Evidence:** The 10 existing tests for `feedback-admin.js` cover registration, render structure, and static source contracts. None characterizes `openDetailModal()` behavior, `data-feedback-id` row attribute presence, or the `formatDate()` locale.
- **Impact:** The detail modal — the main behavioral addition in this change — is untested. The locale bug (AUD-MAINT-001) would be caught by a test that calls `formatDate()` and inspects the locale string.
- **Recommendation:** Add tests for:
  1. `renderFeedbackRow()` output includes `data-feedback-id` attribute
  2. Source contains `openDetailModal` reference (static contract)
  3. Source uses `toLocaleString` (not just `toLocaleDateString`) after the fix

---

## Maintainability Findings

### AUD-MAINT-001
- **ID:** AUD-MAINT-001
- **Severity:** Medium
- **Category:** Inconsistent Locale
- **Location:** `src/public/root/views/feedback-admin.js`, `formatDate()` function (line 26)
- **Evidence:**
  ```js
  function formatDate(dateStr, opts) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('es', opts);  // ← 'es' (generic Spanish)
  }
  ```
  All other date/time formatting in the repository consistently uses `'es-CR'` (Costa Rican Spanish):
  - `src/public/root/ui.js`: `toLocaleDateString('es-CR', ...)`
  - `src/public/root/views/billing-admin.helpers.js`: `toLocaleDateString('es-CR', ...)`
  - `src/public/root/views/lots-admin.helpers.js`: `toLocaleDateString('es-CR', ...)`
  - `src/public/warehouse/views/inventory.js`: `toLocaleDateString('es-CR', ...)`
  - `src/public/root/views/movements-admin.helpers.js`: `toLocaleString('es-CR', ...)`

  The fix from `toLocaleDateString` → `toLocaleString` was correct (to include time), but the locale was not corrected from `'es'` to `'es-CR'`.
- **Impact:** Dates in the feedback admin view may display with a different format (month name style, separator characters) than the rest of the UI. Minor but visible inconsistency for end users.
- **Recommendation:** Change `'es'` to `'es-CR'` in `feedback-admin.js` `formatDate()`.

---

### AUD-MAINT-002
- **ID:** AUD-MAINT-002
- **Severity:** Low
- **Category:** Hardcoded Domain Values in HTML Template
- **Location:** `src/public/root/views/companies-admin.js`, `render()` function (fiscalConfig fieldset)
- **Evidence:**
  ```html
  <select name="fiscalConfig.identificationType" required>
    <option value="">Selecciona</option>
    <option value="01">01 — Cédula Física</option>
    <option value="02">02 — Cédula Jurídica</option>
    <option value="03">03 — DIMEX</option>
    <option value="04">04 — NITE</option>
  </select>
  ```
  These Costa Rica-specific identification type codes are hardcoded in the view's `render()` function. A similar pattern exists in `clients-admin.js` (observed via the `canLookupTaxpayer` / economic-activity wiring context).
- **Impact:** Any change to the catalog requires changes in multiple view files. Low risk for a single-country deployment, but creates duplication.
- **Recommendation:** Extract CR identification types to a shared constant (e.g., `src/public/root/constants.js`) and render options dynamically. This avoids the same values appearing in multiple views.

---

### AUD-MAINT-003
- **ID:** AUD-MAINT-003
- **Severity:** Low
- **Category:** Fragile Reset Logic
- **Location:** `src/public/root/views/companies-admin.js`, form submit handler (post-success block)
- **Evidence:**
  ```js
  form.reset();
  form.querySelector('[name="fiscalConfig.defaultBranchCode"]').value = '001';
  form.querySelector('[name="fiscalConfig.defaultTerminalCode"]').value = '00001';
  form.querySelector('[name="fiscalConfig.haciendaEnvironment"]').value = 'STAGING';
  ```
  After `form.reset()`, three fields are manually re-seeded. The `<input>` elements already have `value="001"` and `value="00001"` in the HTML template, so `form.reset()` should restore them via `defaultValue`. The `<select>` for `haciendaEnvironment` does need manual restoration if the user changed it. The duplication is partially redundant and partially necessary, but not clearly documented.
- **Impact:** If new default-valued fields are added to the form, developers may forget to include them in this reset block.
- **Recommendation:** Consolidate post-reset restoration into a named `resetFormToDefaults()` function with a comment explaining which fields require manual reset (only `<select>` elements where `defaultValue` is not `form.reset()`-restored by all browsers).

---

### AUD-MAINT-004
- **ID:** AUD-MAINT-004
- **Severity:** Suggestion
- **Category:** Hardcoded Static Catalog (Architectural Debt)
- **Location:** `src/services/economic-activity.service.js`
- **Evidence:**
  ```js
  const ACTIVITIES = [
    { code: '471101', name: 'Venta al por menor en supermercados' },
    // ... 14 more entries — total: 15
  ];
  ```
  Costa Rica's CIIU-4 classification has several hundred codes. The current list is a minimal subset used as a placeholder.
- **Impact:** Users creating companies or clients can only see 15 activities in the dropdown. If the taxpayer lookup returns a code not in the list, the fallback `new Option(...)` path is used in both `companies-admin.js` and `clients-admin.js`. The dropdown's primary usefulness is limited.
- **Recommendation:** Either expand the catalog from the official CIIU-4 source, load it from the Hacienda API at startup, or store it in the database via a seeded reference table.

---

### AUD-MAINT-005
- **ID:** AUD-MAINT-005
- **Severity:** Suggestion
- **Category:** Authorization Model Ambiguity
- **Location:** `src/security/access-policy-registry.js` (mode: 'role' policies), `prisma/migrations/20261010000000_backfill_integration_taxpayer_permissions/migration.sql`
- **Evidence:** The route `GET /api/taxpayers/lookup` uses `mode: 'role'` (checks `req.auth.role`). The database also has a permission named `integration.taxpayer.lookup` (assigned to root/admin/sales via backfill migration). Because the route's policy uses `mode: 'role'`, the DB permission has no effect on access control for this route. However, the permission name mirrors the policy ID exactly, creating an apparent dual authorization system.
- **Impact:** Developers may incorrectly assume that granting the `integration.taxpayer.lookup` DB permission to a new role is sufficient to enable access. In practice, only the policy registry `roles` array controls access for role-mode policies.
- **Recommendation:** Add a comment in `access-policy-registry.js` clarifying that `mode: 'role'` checks `req.auth.role` (not DB permissions) and that DB permissions govern UI-level permission gating only.

---

## Technical Debt

### Summary of Active Debt

| ID | Severity | Description |
|---|---|---|
| AUD-001 | Critical | `integration.economic-activities.list` missing `'root'` → EA dropdown broken for root |
| AUD-002 | Medium | `integration.taxpayer.lookup` boundary metadata inconsistent after adding root |
| AUD-003 | Medium | `companies-admin.js` depends on `clientsApi` (cross-domain coupling) |
| AUD-004 | Low | Taxpayer lookup UX duplicated between `companies-admin.js` and `clients-admin.js` |
| AUD-MAINT-004 | Suggestion | Hardcoded 15-entry economic activity catalog (incomplete CIIU-4) |
| AUD-MAINT-005 | Suggestion | Dual authorization signal: DB permission + role-mode policy for same resource |

---

## Behavior to Preserve

| # | Behavior | Location |
|---|---|---|
| BP-001 | Taxpayer lookup normalizes Hacienda responses (`name`, `email`, `phone`, `economicActivityCode`, `economicActivityName`) | `src/services/taxpayer.service.js` |
| BP-002 | Lookup auto-populates `legalName`, `company.name`, `email`, `phone` on company create form | `src/public/root/views/companies-admin.js` `runTaxpayerLookup()` |
| BP-003 | Lookup fires on field blur (if non-empty) and on explicit button click | `src/public/root/views/companies-admin.js` event listeners |
| BP-004 | On successful lookup, economic activity option is added as a new `<option>` if the code is not already in the select | `src/public/root/views/companies-admin.js` `runTaxpayerLookup()` |
| BP-005 | Lookup button is disabled during in-flight request and re-enabled when complete (success or error) | `src/public/root/views/companies-admin.js` `runTaxpayerLookup()` |
| BP-006 | Feedback row click opens the detail modal; resolve button click resolves the item WITHOUT opening the modal (close-first-check pattern) | `src/public/root/views/feedback-admin.js` delegated click handler |
| BP-007 | Detail modal is dismissed on Escape key, backdrop click, or close-button click | `src/public/root/views/feedback-admin.js` `openDetailModal()` |
| BP-008 | `currentItems` (in-memory list) is the source of truth for modal data — no extra API call on row click | `src/public/root/views/feedback-admin.js` `mount()` |
| BP-009 | `root` role is now permitted to call `GET /api/taxpayers/lookup` | `src/security/access-policy-registry.js` |
| BP-010 | `feedback.list-global` and `feedback.resolve` policies allow `root` only (not admin, not sales) | `src/security/access-policy-registry.js` |
| BP-011 | Taxpayer lookup is rate-limited per user via `taxpayerLookupThrottle` | `src/routes/taxpayer.routes.js` |
| BP-012 | Identification number is stripped of non-digits before the Hacienda HTTP call | `src/services/taxpayer.service.js` |
| BP-013 | Only one feedback detail overlay can exist at a time (existing overlay removed before creating a new one) | `src/public/root/views/feedback-admin.js` `openDetailModal()` |

---

## Known Defects

### DEF-001 — CRITICAL
**Economic activity dropdown always broken for root users**

`companies-admin.js` calls `clientsApi.listEconomicActivities(session)` → `GET /api/economic-activities`. The route requires `integration.economic-activities.list` policy, which has `roles: ['admin', 'sales']`. Root users always receive 403. The `.catch()` block swallows the error silently; the dropdown shows "No se pudieron cargar las actividades." This is a direct consequence of updating `integration.taxpayer.lookup` to include `'root'` but not applying the same change to `integration.economic-activities.list`.

**Workaround:** If the taxpayer lookup returns an economic activity code, the code is manually added as an `<option>` in the select via `runTaxpayerLookup()`. This partially compensates but only when a successful lookup occurs.

---

### DEF-002 — MEDIUM
**Feedback date formatting uses generic `'es'` locale instead of `'es-CR'`**

`formatDate()` in `feedback-admin.js` uses `new Date(dateStr).toLocaleString('es', opts)`. All other views use `'es-CR'`. The date fix (`toLocaleDateString` → `toLocaleString`) was correct, but the locale was not updated.

---

### DEF-003 — LOW
**`renderRatingEmoji()` fallback not HTML-escaped**

`String(rating)` is injected without `ui.escapeHtml()` when rating is outside {1,2,3,4,5}. Schema validation limits ratings to 1–5, making practical exploitation unlikely, but the defense-in-depth gap exists.

---

## Architectural Debt

### ARCH-001 — Cross-domain module dependency
`companies-admin.js` (platform-global root view) depends on `clientsApi` (company-scoped client management module) for `lookupTaxpayer` and `listEconomicActivities`. See AUD-003.

### ARCH-002 — Policy boundary metadata inconsistency
`integration.taxpayer.lookup` has `boundary: 'tenant-operational'` but now includes `'root'` (platform-global actor). See AUD-002.

### ARCH-003 — Hardcoded incomplete economic activity catalog
`economic-activity.service.js` has 15 hardcoded CIIU-4 entries. The full catalog has hundreds. See AUD-MAINT-004.

### ARCH-004 — Dual authorization signal for role-mode policies
DB-level permissions for `integration.taxpayer.lookup` / `integration.economic-activities.list` have no runtime effect because the routes use `mode: 'role'`. See AUD-MAINT-005.

### ARCH-005 — Inline styles in feedback detail modal
`openDetailModal()` constructs the modal entirely with inline CSS, inconsistent with the SPA's `styles.css` pattern. See AUD-006.

---

## Unknown Behavior

### UNK-001
**Redis client package not declared in `package.json`**
`src/services/browser-session-redis.store.js` uses Redis but no Redis client package (`ioredis`, `redis`) appears in `package.json`. The actual package and its version are unknown without inspecting the lockfile.
**Status: Requires clarification.**

### UNK-002
**Race condition between EA select population and taxpayer lookup auto-select**
In `companies-admin.js`, `clientsApi.listEconomicActivities()` is fire-and-forget (not awaited). `runTaxpayerLookup()` checks `!eaSelect.value` before adding the activity option. If the lookup resolves before the EA list loads, `eaSelect.value` is empty and the code adds the option. If after, the outcome depends on timing and user interaction. The actual UX behavior under load or slow network conditions is unknown without browser testing.
**Status: Requires browser validation.**

### UNK-003
**Focus behavior when feedback detail modal is closed**
`openDetailModal()` focuses `#feedback-detail-close` on open. On close/Escape, no focus-return logic returns focus to the triggering row. Whether this causes accessibility (keyboard navigation) issues is unknown without browser testing.
**Status: Requires browser validation.**

---

## Critical Risks

| Risk | Severity | Finding |
|---|---|---|
| Economic-activity dropdown permanently broken for root users | Critical | AUD-001, DEF-001 |
| New 'root' taxpayer-access is untested — silent regression risk | High | AUD-TEST-001 |
| companies-admin new features are entirely uncharacterized | Medium | AUD-TEST-002 |
| docs/current-state.md diverges from code | Medium | AUD-DOC-001 |

---

## Recommended Priorities

### Immediate (before next production deployment)

1. **[AUD-001] Fix broken EA dropdown for root users.**
   Add `'root'` to `integration.economic-activities.list` roles in `access-policy-registry.js`. One-line change.

2. **[AUD-MAINT-001] Fix locale inconsistency in `feedback-admin.js`.**
   Change `toLocaleString('es', opts)` → `toLocaleString('es-CR', opts)` in `formatDate()`.

3. **[AUD-005] Fix unescaped emoji fallback.**
   Change `String(rating)` → `ui.escapeHtml(String(rating))` in `renderRatingEmoji()`.

### Short-term (next sprint)

4. **[AUD-TEST-001] Add root role assertion to taxpayer characterization test.**
   Add root-allowed scenario and update test name.

5. **[AUD-002] Update `integration.taxpayer.lookup` boundary metadata.**
   Change to `'multi-scope'` or add a clarifying comment.

6. **[AUD-TEST-002] Add `companies-admin-view-characterization.test.js`.**
   Cover render structure, lookup wiring, and EA dropdown source contract.

7. **[AUD-TEST-003] Add detail modal coverage to `feedback-admin-view-characterization.test.js`.**
   Cover `data-feedback-id`, modal call site, and `formatDate` locale.

8. **[AUD-DOC-001] Update `docs/current-state.md`.**
   Add update-log entries and §1/§4 text for: root taxpayer policy change, companies-admin Hacienda lookup, feedback-admin detail modal.

### Medium-term

9. **[AUD-004] Extract shared taxpayer-lookup UX helper.**
   Reduce DRY violation between `companies-admin.js` and `clients-admin.js`.

10. **[AUD-MAINT-002] Extract identification types to a shared constant.**

11. **[AUD-006] Move feedback modal styles to `styles.css`.**

12. **[AUD-MAINT-004] Expand economic activity catalog beyond 15 entries.**

---

*Produced by `baseline-audit-agent-5c03f7` — inspection only, no production code was modified.*
