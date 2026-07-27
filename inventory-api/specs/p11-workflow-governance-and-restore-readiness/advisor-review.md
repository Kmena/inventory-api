# Advisor Review

## Findings
- The repository already established `/.github/workflows/` as the real hosted source of truth, so continuing to version a second active tree under `inventory-api/.github/workflows/` adds drift risk without functional value.
- The immediate `operational-smoke` failure is not caused by Node 24 or Prisma; it is a workflow-to-package contract defect: the workflow invokes `npm run validate:restore-readiness`, but `package.json` does not define that script.
- The restore-readiness capability appears partially implemented already because the Node validator script, tests, and runbooks exist, but the public contract is inconsistent across `docs/` and optional `internal-docs/` artifacts.

## Accepted guidance
- Converge to a single official workflow tree in the repository root.
- Preserve the restore-readiness gate instead of removing it, because a real validator script already exists and operational docs already treat the gate as part of the baseline.
- Harmonize documentation, tests, and validator inputs so they describe the same supported artifact set.

## Deferred guidance
- Broader CI redesign beyond root-only convergence.
- Additional operational hardening not already implied by the current restore-readiness baseline.

## Rejected guidance
- Keep both workflow trees and rely only on parity conventions.
- Silence the `operational-smoke` failure by removing the step without first checking whether the capability already exists.
- Leave public docs referencing artifacts that are absent from the versioned repository state.

## Requires clarification
- Whether the final canonical restore-readiness evidence should live exclusively in public `docs/` or whether optional `internal-docs/` should remain supported as a secondary private overlay.
