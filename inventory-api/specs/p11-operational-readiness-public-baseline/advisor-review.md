# Advisor Review

## Findings
- The repository already moved restore readiness onto a public `docs/`-backed contract, so leaving operational readiness on optional `internal-docs/` creates unnecessary asymmetry and governance ambiguity.
- `.env.production.example` exists in the repository, so the remaining problem is not file absence but insufficiently codified evidence that it is part of the supported operational baseline.

## Accepted guidance
- Converge operational-readiness to public `docs/` artifacts.
- Preserve `.env.production.example` as an explicitly validated/documented baseline artifact if it remains part of the documented flow.
- Keep the change scoped to governance/docs/tests/scripts.

## Deferred guidance
- Broader convergence of other optional `internal-docs/`-based validators.

## Rejected guidance
- Leave operational-readiness partially private while the public docs imply a fully public baseline.
- Treat `.env.production.example` audit ambiguity as “good enough” without codifying it.
