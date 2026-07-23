# Current Runtime State

## Overview
The repository serves an embedded public/browser runtime from `src/public/` as part of the supported application surface. The public login is not a demo page; it is a real runtime entry point governed by public-runtime validation, characterization tests and browser E2E.

## Public login runtime
### Entry files
- `src/public/index.html`
- `src/public/login.js`
- `src/public/styles.css`

### Current login behavior
- The login page keeps a framework-free HTML/CSS/JavaScript implementation.
- Authentication continues to use `POST /api/auth/login`.
- Authenticated session storage continues to use localStorage key `inventory-api-auth`.
- The login UI now includes:
  - semantic header structure
  - visible live message area
  - contextual help text
  - neutral support copy without visible bootstrap credentials
  - stronger focus and message styling

### Current login flow implementation
`src/public/login.js` is organized into small explicit functions for:
- reading stored session defensively
- clearing malformed stored session data
- building login payload
- requesting login
- safe JSON parsing
- persisting authenticated session
- resolving landing
- redirecting existing sessions
- setting message state
- setting submitting state

### Current submit UX behavior
- During submit, the page shows `Validando acceso...` in the message area.
- The submit button becomes disabled and changes to `Validando...`.
- On failure, the button returns to `Entrar` and the form becomes interactive again.
- Invalid credentials remain visible through the live message area.
- If `inventory-api-auth` contains malformed JSON, the page clears it safely and keeps the login form usable.

## Supported landing behavior
The approved landing policy remains unchanged:
- `root` -> `/root/index.html`
- `admin` with `companyId` -> `/root/dashboard.html`
- `sales_supervisor` -> `/root/routes.html`
- users with `warehouse.access` -> `/warehouse/products.html`
- operational sales-agent-compatible sessions -> `/agent/workspace.html`
- fallback -> `/no-access.html`

## Runtime governance evidence
### Build and seed baseline hardening
- `build` and `prisma:generate` now run through `scripts/prisma-generate-safe.js`.
- The wrapper delegates to `scripts/prisma-generate-safe-lib.js`, removes stale Windows Prisma engine temp files, classifies rename-lock failures, applies bounded retry delays and preserves real failures with actionable guidance.
- A dedicated CI gate now exists at `.github/workflows/windows-prisma-build.yml` with `windows-latest`, `npm ci` and `npm run build`.
- Bootstrap/demo passwords no longer live in tracked source; controlled seeding now requires private `SEED_*_PASSWORD` environment variables.
- `scripts/validate-agent-workspace.js` now reads private environment-based credentials instead of a tracked literal.

### Public-runtime validation
- `npm run lint:public-runtime`
- `npm run validate:public-runtime`

### Characterization coverage
- `tests/post-audit-baseline-hardening.test.js`
  - preserves guarded Prisma generate wrapper wiring
  - preserves absence of tracked explicit seed passwords
  - preserves validator phase 2 helper coverage
- `tests/public-surface-characterization.test.js`
  - preserves login storage key
  - preserves login endpoint contract
  - preserves approved landing route tokens
  - preserves absence of visible default credentials in the public login
  - preserves runtime public asset presence

### Browser E2E coverage
- `tests/browser-e2e.e2e.js`
  - successful admin login redirects to `/root/dashboard.html`
  - anonymous access to protected screen redirects to `/`
  - invalid credentials produce visible feedback and restore form state
  - corrupt stored session is cleared and falls back to usable login
  - existing compatible session redirects immediately to approved landing

## Current limitations
- Landing policy remains runtime code rather than a standalone documented policy artifact.
- The login remains an incremental hardening of the existing framework-free runtime, not a broad public-runtime redesign.
- Public-runtime validator checks are still source-shape aware in some places, though the login-specific checks and three additional critical runtime modules now use less shape-coupled stable helpers.
- Windows Prisma generate remains environment-sensitive, but the risk is now continuously monitored through a dedicated Windows CI gate and a more strongly characterized wrapper path.
