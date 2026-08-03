# Documentation Ownership Map

## Purpose
This map classifies repository-facing documentation and workflow artifacts so humans, tests, and validators can rely on the same source-of-truth boundaries.

## Ownership classes
- **Canonical:** primary reviewed source that should be updated when the implemented state changes.
- **Auxiliary:** supporting material that may help operations or internal review, but is not the primary authority for active repository governance.
- **Historical / compatibility:** preserved bridge or archived material kept to avoid breaking legacy references or to retain prior evidence.
- **Auto-validated:** artifact whose expected content/location is enforced directly by repository tests or validators.

## Current ownership matrix
| Artifact or area | Class | Notes |
|---|---|---|
| `docs/current-state.md` | Canonical | Observable implemented-state reference for the repository. |
| `docs/architecture.md` | Canonical | Active architecture description aligned to the implemented layered monolith. |
| `docs/action-plan.md` | Canonical | Forward-looking architecture/documentation action ledger. |
| `docs/tasks.md` | Canonical | Architecture-facing task ledger for proposed and completed repository work. |
| `docs/audit/current-code-audit.md` | Canonical | Current reviewed repository audit baseline used as an architecture-facing reference and governance input. |
| `docs/coding_standard.md` | Canonical + Auto-validated | Authoritative coding standards path guarded by `tests/coding-standard-path-alignment.test.js`. |
| `docs/runtime-contract-manifest.json` | Canonical + Auto-validated | Consumed by repository governance validators. |
| `docs/openapi/runtime-baseline.openapi.json` | Canonical + Auto-validated | Reviewed runtime baseline for bounded governance checks. |
| `docs/runtime-endpoint-catalog.md` | Canonical | Human-readable endpoint catalog aligned to reviewed runtime contracts. |
| `docs/production-baseline.md` | Canonical | Public production/operational baseline reference. |
| `internal-docs/**` | Auxiliary | Support material only; not the primary authority for active runtime-contract governance. |
| Legacy hyphenated coding-standards compatibility notice | Historical / compatibility | Compatibility-only bridge that points readers to the canonical `docs/coding_standard.md` path. |
| `legacy-public-runtime/**` | Historical / compatibility | Preserved runtime archive outside the active served surface. |
| `../.github/workflows/**` relative to `inventory-api/` | Canonical + Auto-validated | Hosted workflow source of truth validated by `scripts/validate-workflow-baseline.js` and related characterization tests. |
| `inventory-api/.github/workflows/**` | Historical / compatibility | Not the active hosted source of truth for current governance checks. |

## Ownership split by layer-sensitive seams
- **Auth / access-policy seams**
  - Route-facing policy registry ownership lives in `src/security/access-policy-registry.js`.
  - Actor-scope evaluation ownership lives in `src/security/access-policy-actor-scope.js`.
  - Denial-audit ownership lives in `src/security/access-policy-audit.js`.
  - Route modules remain consumers of the stable facade `src/security/access-policies.js`.
- **Service seams**
  - `src/services/inventory-alerts.service.js` owns inventory-alert permission, serialization, transition, and audit coordination.
  - `src/services/agent-workspace-store-state.service.js` owns agent store-state, invoice/debt visibility, and purchase-history shaping helpers.
  - `src/services/product-permission-shaping.service.js` owns permission-aware product serialization.
  - `src/services/product-pricing.service.js` owns general-price synchronization.
- **Repository ownership**
  - Prisma repositories remain the persistence boundary; service seams coordinate repository calls and preserve tenant/auth context above them.

## Validation hooks
- `tests/coding-standard-path-alignment.test.js`
- `tests/p36-doc-validator-ownership.test.js`
- `tests/workflow-baseline-characterization.test.js`
- `scripts/validate-workflow-baseline.js`

## Rules
- Update canonical artifacts when implemented behavior changes.
- Do not promote `internal-docs/**` copies to canonical authority without an approved specification.
- Do not treat `inventory-api/.github/workflows/**` as the active hosted workflow source of truth while validators target `../.github/workflows/**`.
