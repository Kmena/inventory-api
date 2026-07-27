# Risks

## 1. Governance risks
- **Residual risk:** A maintainer could still assume the subproject owns workflow definitions.
  - **Impact:** future edits may target the wrong path.
  - **Mitigation:** updated docs/specs/tasks now make root-only ownership explicit.

## 2. Operational-readiness risks
- **Resolved risk:** `validate:restore-readiness` previously relied on optional `internal-docs/` assumptions while the public workflow expected a package command.
  - **Outcome:** resolved by exposing the npm script and validating public `docs/` artifacts directly.

- **Residual risk:** operational readiness still uses some optional `internal-docs/` overlays while restore readiness is now public.
  - **Impact:** the broader operational contract is not yet fully uniform.
  - **Mitigation:** keep the difference documented and, if approved later, converge `validate:operational-readiness` onto public docs as a separate slice.

## 3. Validation risks
- **Risk:** Hosted `operational-smoke` may fail for a second reason after the missing script repair.
  - **Impact:** the first defect could have masked an additional baseline problem.
  - **Mitigation:** treat the repaired missing-script defect as only the first unblocker; classify any later hosted failure separately.

## 4. Scope risks
- **Risk:** Converging docs/tests from `internal-docs/` to `docs/` may grow into broader operational-document redesign.
  - **Impact:** scope expansion beyond the requested two tasks.
  - **Mitigation:** limit the implementation to the minimal contract required for the existing restore-readiness gate and its explicit documentation.
