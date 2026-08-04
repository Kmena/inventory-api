# CI Critical Controls

## 1. Purpose
This document defines the current repository policy for translating test evidence quality into mandatory GitHub Actions gates.

## 1.1 Workflow ownership boundary
For the current repository layout, the authoritative hosted workflow definitions live in the parent repository root under `../.github/workflows/` relative to `inventory-api/`.

This means:
- `inventory-api/.github/workflows/` is not the current authoritative workflow source;
- local validators and characterization tests intentionally read workflow truth from the parent-root hosted repository; and
- docs in `inventory-api/` must describe that parent-root ownership explicitly instead of implying that the app root owns the workflow files.

Operational rule:
- when parent-root workflow files are absent from a local checkout, validator failures must point maintainers back to `../.github/workflows/` ownership instead of implying that app-root workflow YAML is missing by mistake.

It exists to close the P11 governance gap where a green aggregate suite could still mix:
- strong evidence,
- partial characterization,
- optional or skipped evidence.

## 2. Evidence categories
### Strong evidence
Strong evidence can close a critical control when it is executed by a required GitHub Actions job.

Current examples:
- `npm run typecheck` over the approved expanded scope
- `tests/client-document-security.test.js`
- `tests/payment-tenant-scope.test.js`
- `tests/payment-receipt-security.test.js`
- `tests/p2-hardening-constraints.test.js` when it runs against a real database
- dedicated workflow validators and browser E2E critical flows

### Partial characterization
Characterization tests are valuable for regression context, guard wiring, and contract awareness, but they do not close a critical control by themselves.

Current examples:
- `*characterization*.test.js`
- authorization and workflow characterization suites

### Optional or skipped evidence
Optional or skipped evidence is informative only.
It cannot be the sole closure signal for a critical control.

Current examples:
- `tests/openapi-contract-consistency.test.js` when optional internal artifacts are missing
- `tests/p2-hardening-constraints.test.js` when `P2_CONSTRAINTS_DATABASE_URL` is absent

## 3. Critical controls matrix
| Critical control | Domain | Evidence class required for closure | Required GitHub Actions job | Notes |
|---|---|---|---|---|
| Expanded typecheck over approved contracts and persistence surfaces | quality / architecture | Strong | `static-checks` | Covers `src/schemas/**`, `sales-route.repository.js`, `order.repository.js`, `payment.repository.js`, `company.repository.js`, `invoice.repository.js`, `inventory.repository.js`, `src/security/access-policies.js`, the versioned baseline validators in the current approved slice, and the approved bounded public-runtime allowlist (`src/public/shared/session.js`, `src/public/shared/auth.js`, `src/public/login.js`, plus the explicit `src/public/root/**` shell file set). |
| Tenant, document, and payment security regressions | security | Strong | `repository-tests` | Strong runtime regressions remain inside the aggregate mandatory suite. |
| Authorization and route-guard characterization | security / business logic | Partial characterization only | Supportive, not sufficient alone | Useful context, not closure by itself. |
| Runtime, workflow, and operational contract validation | governance / business logic | Strong | `contract-validations` and `operational-smoke` | Explicit validator-based governance evidence. |
| Dependency vulnerability baseline drift detection | security / supply chain | Strong | `dependency-hygiene` | Captures `npm audit` evidence, validates the approved residual package set, and publishes the audit artifact/summary. |
| Browser critical flows | business logic / embedded runtime | Strong | `browser-e2e` | Critical browser-first regression gate. |
| Redis-backed browser-session non-default path | security / embedded runtime | Strong | `redis-browser-session-tests` | Dedicated mandatory lane for the supported Redis-backed browser-session path outside the default memory-mode aggregate suite. |
| Windows Prisma build stability | platform | Strong | `windows-prisma-build` | Dedicated operational evidence, not replaced by aggregate verify. |
| Database constraints on payments, orders, products, and warehouse stocks | data quality / business logic | Strong | `db-constraints-tests` | Focused PostgreSQL-backed gate using committed migrations and seed fixtures. |
| Release aggregate quality | release governance | Strong for release flow only | `build-and-publish` | Release gate; not a replacement for PR-time mandatory controls. |
| Optional OpenAPI partial baseline consistency | documentation | Optional / skipped | No critical-control closure claim | Useful when artifacts exist, but not a mandatory critical-control gate; current bounded coverage includes the selected company/company-role admin governance surfaces clarified by `p33`. |

## 4. Policy consequences
- A green `repository-tests` result does not mean every critical control has strong evidence.
- A skipped optional suite does not close a critical control.
- A characterization-only suite cannot be the only closure evidence for a critical control.
- Every critical control must map to a required workflow or to an explicit approved exception.

## 5. Repo-verifiable required-job baseline
The current repository can prove the following expected required-job baseline from versioned parent-root workflows and local validators:
- `static-checks`
- `contract-validations`
- `repository-tests`
- `dependency-hygiene`
- `db-constraints-tests`
- `windows-prisma-build`
- `browser-e2e`
- `redis-browser-session-tests`
- `operational-smoke`

In practice, successful branches and pull requests already rely on passing the published workflow/contracts baseline above, even though the repository cannot by itself prove the hosted branch-protection configuration that marks those checks as required.

## 6. Manual hosted verification checklist
The following final closeout evidence still requires manual verification in GitHub hosted settings because it is not stored in versioned repository contents:
- confirm branch protection is enabled for the primary integration branch;
- confirm the hosted required status checks include the approved repo-verifiable baseline jobs, including `dependency-hygiene`;
- confirm the hosted check names exactly match the versioned workflow job names listed above;
- confirm no obsolete Node 20 or superseded workflow names remain configured as required checks;
- record the verification date, reviewer, and hosted evidence location used for closeout approval.

## 7. Current status
Current P11 status after the implemented Node 24, workflow-governance, and closeout hardening slices:
- Node 24 is the active supported baseline across package metadata, Docker, and the official root-hosted workflows;
- typecheck scope is incrementally expanded over the approved high-value surfaces, including the scoped repository and baseline-validator additions from `p11-hardening-closeout-95`, the bounded governance seam file `src/security/access-policies.js`, the first public-runtime allowlist from `p19-public-runtime-typecheck-expansion` (`src/public/shared/session.js`, `src/public/shared/auth.js`, `src/public/login.js`), and the approved bounded root-shell follow-up allowlist for `src/public/root/**` shell files;
- the constraints gap is no longer implicit because `db-constraints-tests` is now the dedicated required workflow for `tests/p2-hardening-constraints.test.js`;
- hosted branch-protection / required-status-check enforcement still requires separate manual verification because it is not provable from versioned repository contents alone.
