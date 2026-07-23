# Runtime Architecture Reference

## Purpose
This document is the formal repository-level pointer for the currently approved hardening baseline reflected by the inspected repository.

## Canonical architecture source for the current change
The canonical architecture and audit-governance source for the current approved closeout work is:

- `../specs/p6-audit-excellence-program/architecture.md`

The historical runtime-hardening baseline that remains preserved for traceability is:

- `../specs/p4-closeout-hardening/architecture.md`

## Supporting specification documents
For the current closeout/audit-governance context, read together with:
- `../specs/p6-audit-excellence-program/requirements.md`
- `../specs/p6-audit-excellence-program/current-state.md`
- `../specs/p6-audit-excellence-program/domain-analysis.md`
- `../specs/p6-audit-excellence-program/implementation-plan.md`
- `../specs/p6-audit-excellence-program/tasks.md`
- `../specs/p6-audit-excellence-program/traceability.md`
- `../specs/p6-audit-excellence-program/risks.md`
- `../specs/p6-audit-excellence-program/decisions.md`

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
- The embedded browser/runtime boundary is governed explicitly through characterization tests, HTTP smoke coverage, browser E2E, `scripts/validate-public-runtime.js` and `npm run lint:public-runtime`.
- `src/public/root/**` is the primary extract-later candidate, but extraction is deferred to a separate approved specification.

## Formal substitution note
If another process expects `inventory-api/docs/architecture.md`, this file is the repository-level substitute and points to the approved closeout/audit-governance feature architecture in:

- `../specs/p6-audit-excellence-program/architecture.md`

The nested `inventory-api/specs/p4-closeout-hardening/` package remains preserved as the historical internal runtime-hardening baseline, not as the primary canonical closeout source.

## Status
- Repository architecture pointer: Present
- Primary canonical closeout/audit-governance baseline: `specs/p6-audit-excellence-program`
- Historical internal runtime-hardening baseline: `inventory-api/specs/p4-closeout-hardening`
- Production code impact: Reflected in runtime hardening, quality gates, browser E2E, contract documentation and audit evidence
