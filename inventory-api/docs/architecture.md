# Runtime Architecture Reference

## Purpose
This document is the formal repository-level pointer for the currently approved hardening baseline reflected by the inspected repository.

## Canonical architecture source for the current change
The current inspected runtime/build governance is reflected directly in this document plus the approved p8 follow-up specifications stored under the repository root `specs/` directory.

Relevant recent specification packages include:
- `../specs/p8-login-guidelines-alignment/`
- `../specs/p8-login-hardening-followup/`
- `../specs/p8-post-audit-baseline-hardening/`
- `../specs/p8-prisma-windows-build-stabilization/`

The historical internal runtime-hardening baseline that remains preserved for traceability is:
- `../specs/p4-closeout-hardening/`

## Supporting specification documents
For the current runtime/governance context, read together with the documents inside the relevant approved p8 specification package(s):
- `metadata.yaml`
- `requirements.md`
- `current-state.md`
- `domain-analysis.md`
- `architecture.md`
- `implementation-plan.md`
- `tasks.md`
- `traceability.md`
- `risks.md`
- `decisions.md`

For the historical internal runtime-hardening baseline preserved under the application tree, read together with:
- `../specs/p4-closeout-hardening/requirements.md`
- `../specs/p4-closeout-hardening/current-state.md`
- `../specs/p4-closeout-hardening/domain-analysis.md`
- `../specs/p4-closeout-hardening/implementation-plan.md`
- `../specs/p4-closeout-hardening/tasks.md`
- `../specs/p4-closeout-hardening/traceability.md`
- `../specs/p4-closeout-hardening/risks.md`
- `../specs/p4-closeout-hardening/decisions.md`

## Current runtime architecture summary
The runtime application currently follows this structure:
- Express application bootstrap in `src/app.js`
- JWT authentication in `src/middlewares/authenticate.js`
- Distributed runtime hardening via `src/middlewares/login-throttle.js`, `src/middlewares/request-throttle.js` and `src/middlewares/request-payload.js`
- Role and permission enforcement in `src/middlewares/authorize.js` and `src/middlewares/authorizePermission.js`
- Route -> service -> repository -> Prisma flow across business modules
- Persistence via Prisma schema in `prisma/schema.prisma`
- Embedded UI served from `src/public/` as part of the supported runtime
- Browser-first public-runtime gates via `eslint.config.js`, `scripts/validate-public-runtime.js` and `package.json`
- Automated tests with `node --test` configured in `package.json`

## Scope clarifications relevant to the current baseline
- `GET /api/companies/company/dashboard` is the semantic company-admin dashboard path.
- `GET /api/companies/root/dashboard` is a legacy misleading compatibility alias for the same company-admin dashboard behavior; it is not a root-global dashboard.
- `internal-docs/openapi/runtime-baseline.openapi.json` remains a partial factual contract, now expanded to additional verified runtime domains, not a complete monolith-wide OpenAPI description.
- `internal-docs/production-baseline.md` documents a minimal verifiable production baseline, not a fully hardened final production architecture.
- `src/public/` remains a real runtime surface and is governed incrementally without introducing a separate frontend build pipeline.
- The embedded public login (`src/public/index.html`, `src/public/login.js`) was first refreshed in-place through `p8-login-guidelines-alignment` and then hardened through `p8-login-hardening-followup` while preserving `/api/auth/login`, the `inventory-api-auth` session key and the existing landing policy.
- The login hardening removed visible default credentials from the public UI, added defensive cleanup of malformed stored sessions and kept the browser-first runtime framework-free.
- The embedded browser/runtime boundary is governed explicitly through characterization tests, HTTP smoke coverage, browser E2E, `scripts/validate-public-runtime.js` and `npm run lint:public-runtime`.
- Login runtime evidence now explicitly includes browser E2E for successful admin login, invalid credentials feedback, corrupt-session recovery and existing-session redirect behavior.
- Post-audit baseline hardening added `scripts/prisma-generate-safe.js` as an operational build-governance adapter for Windows Prisma generate instability.
- Prisma Windows build stabilization now supplements that adapter with `scripts/prisma-generate-safe-lib.js`, bounded retry delays, explicit failure classification and a dedicated `windows-prisma-build.yml` GitHub Actions gate.
- Post-audit baseline hardening also moved bootstrap credentials out of tracked source into private `SEED_*_PASSWORD` environment variables and updated runtime validation tooling to avoid tracked credential literals.
- `scripts/validate-public-runtime.js` remains incremental, but its login-specific checks and the phase-2 checks for `root/dashboard.js`, `warehouse/products.js` and `agent/workspace.js` now rely on more stable contract signals.
- Residual note: Windows Prisma engine rename-lock behavior remains environment-sensitive; the wrapper and Windows CI gate improve reproducibility and governance, but do not claim universal root-cause elimination across every workstation.
- `src/public/root/**` is the primary extract-later candidate, but extraction is deferred to a separate approved specification.

## Formal substitution note
If another process expects `inventory-api/docs/architecture.md`, this file is the repository-level substitute and should be read together with the approved p8 specification packages present under `../specs/`.

The nested `inventory-api/specs/p4-closeout-hardening/` package remains preserved as the historical internal runtime-hardening baseline, not as the primary canonical current-governance source.

## Status
- Repository architecture pointer: Present
- Active approved governance baseline: reflected by current code plus approved p8 specification packages under `../specs/`
- Historical internal runtime-hardening baseline: `inventory-api/specs/p4-closeout-hardening`
- Production code impact: Reflected in runtime hardening, quality gates, Windows Prisma build governance, browser E2E, contract documentation and audit evidence
