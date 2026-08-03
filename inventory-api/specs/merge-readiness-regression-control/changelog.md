# Changelog
## 2025-08-16
- Revalidated `TASK-004` by refreshing the authorization-matrix contract with an explicit ownership-pattern column, concrete baseline markdown rows for company/role/payment/inventory/agent families, and drift corrections for the now policy-guarded agent workspace routes.
- Updated specification current-state and hotspot-risk notes so agent workspace authorization is described as route-level access-policy plus service-strengthened actor/tenant scope rather than authenticate-only.
- Revalidated `TASK-001` by separating hosted Windows Prisma closeout from the governed local Windows baseline in canonical docs and by documenting remaining diagnostic gaps explicitly.
- Revalidated `TASK-002` by hardening `scripts/prisma-generate-safe-lib.js` with a minimal local diagnostics report (`logs/prisma-generate-last-run.json`), preserving bounded retries and the real failure exit, and aligning README/test evidence.
- Revalidated `TASK-003` by converging agent workspace route protection onto `authorizeAccessPolicy('agent.workspace.access')`, extending actor-scope coverage with `agent-workspace-user`, and updating authorization characterization coverage.
- Closed the follow-up audit warning by aligning `tests/access-policies.test.js` with the live access-policy registry and refreshing architecture/current-state wording for the new actor-scope seam.

## 2026-03-08
- Completed `TASK-001` by reconciling baseline-source drift for audit and workflow ownership.
- Completed `TASK-002` by documenting the PR impact-freezing procedure, path-to-surface mapping rules, baseline hotspot detection, required impact-map output, and low/medium/high merge-risk heuristics.
- Completed `TASK-003` by defining the mandatory minimum pre-merge checklist, the expanded validation matrix by changed surface, and the rule for direct `node --test` commands when no npm script exists.
- Completed `TASK-004` by defining the authorization-matrix columns, ownership derivation procedure, ownership categories, and baseline examples for access-policy, permission, role, and service-strengthened authorization.
- Completed `TASK-005` by defining explicit authorization-characterization activation criteria, reuse-first suite selection rules, required allowed/denied/tenant/actor/401/403/404 case families, and current coverage-gap handling guidance.
- Completed `TASK-006` by defining the hotspot risk map with per-hotspot functional risk, coupling risk, minimum validations, expanded validations, and fragmentation guidance while preserving no-op behavior for untouched hotspots.
- Completed `TASK-007` by defining large-service safe-change rules, prohibited broad rewrite shapes, fragment output requirements, characterization-first expectations, and service-specific fragmentation baselines for inventory, agent workspace, and product services.
- Completed `TASK-008` by defining explicit contract-impact classifications, authoritative source precedence, OpenAPI-covered versus intentionally excluded surface handling, decision heuristics, and required PR-review output fields for contractual analysis.
- Completed `TASK-009` by defining mandatory documentation-sync rules, a documentation update matrix by change type, artifact-purpose boundaries, and required PR-review output fields for documentation refresh obligations.
- Completed `TASK-010` by defining DB+filesystem activation criteria, a sensitive-flow review matrix for client documents and payment receipts, compensation-path review rules, and required evidence for partial-failure analysis.
- Completed `TASK-011` by defining list/pagination activation criteria, a sensitive endpoint matrix for optional-pagination and unpaginated heavy reads, explicit preserve/defer/block rules, and required evidence for payload-risk review.
- Completed `TASK-012` by defining multiplatform build/operational-baseline activation criteria, mandatory validator-backed gates, workflow-ownership handling, and explicit treatment of the open Windows/Prisma risk.
- Completed `TASK-013` by consolidating the minimum baseline checklist, the expanded test families by affected surface, and the PR-review rule that the expanded list is the diff-activated union of those families.
- Completed `TASK-014` by defining explicit analysis states, merge-readiness recommendations, hard blockers for missing evidence and unsafe change shapes, and required final review-output fields for approval/block decisions.
- Recorded repository-local audit availability at `inventory-api/docs/audit/current-code-audit.md` and clarified parent-root workflow validation ownership.
- Captured pre-implementation baseline command results and documented the pre-existing governance baseline test failure plus missing production env validation inputs.

## 2025-02-14
- Created initial specification package for `merge-readiness-regression-control`.
- Documented repository baseline, current authorization model, hotspot set, contract-governance inputs and operational/build discrepancies.
- Marked implementation readiness as blocked pending PR diff and initial clarification of workflow/automation expectations.
- Recorded user clarification: documentation and validation scripts may be updated, but workflows must not be created or modified in this scope; workflow drift must be documented.
- Recorded user clarification: PR-specific diff will be supplied via GitHub PR or changed-file list, and the authorization matrix output must be markdown-only with endpoint-level ownership and minimum test coverage.
- Marked the specification as approved by the user while preserving implementation blockers tied to missing PR diff and missing in-app audit artifacts.
