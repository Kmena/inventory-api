# Risks Register

## Risk summary
This file isolates the primary risks of implementing `p4-closeout-hardening`.

## RISK-001: Documentation drift persists after partial correction
**Category:** Documentation / Auditability  
**Severity:** High  
**Current evidence:** repository docs currently reference missing `specs/p3-*` and `specs/p4-*` artifacts, including derived audit outputs.  
**Impact:** auditors and implementers may continue navigating broken or contradictory sources.  
**Mitigation:** correct active and derived versioned documents in the same implementation wave; validate with grep/script.  
**Residual risk:** Medium until all distributed artifacts are normalized.

## RISK-002: Monetary behavior changes expose hidden historical rounding assumptions
**Category:** Financial correctness  
**Severity:** High  
**Current evidence:** services convert `Decimal` to `Number` for derived calculations.  
**Impact:** tests or operational expectations may reveal differences once deterministic decimal math is introduced.  
**Mitigation:** add targeted edge-case tests, preserve explicit 2-decimal rounding semantics, refactor incrementally.  
**Residual risk:** Medium.

## RISK-003: Authorization migration widens access accidentally
**Category:** Security / Governance  
**Severity:** High  
**Current evidence:** routes use both role and permission guards, sometimes in related domains.  
**Impact:** unintended privilege expansion or inconsistent enforcement.  
**Mitigation:** central policy inventory, characterization tests, no big-bang rewrite, explicit transition labeling.  
**Residual risk:** Medium.

## RISK-004: CI workflow fails due to undocumented environment assumptions
**Category:** Operations / Quality  
**Severity:** Medium  
**Current evidence:** quality execution is currently local/manual.  
**Impact:** false-negative pipeline failures or blocked adoption of versioned CI.  
**Mitigation:** keep CI minimal, rely on existing `verify`, document preconditions, prefer environment-agnostic checks first.  
**Residual risk:** Medium.

## RISK-005: Test autodiscovery changes runner behavior unexpectedly
**Category:** Maintainability / Tooling  
**Severity:** Medium  
**Current evidence:** tests are manually enumerated now.  
**Impact:** ordering/output differences or inclusion of unexpected files.  
**Mitigation:** keep discovery constrained to supported patterns, validate against current suite and a newly added test file.  
**Residual risk:** Low to Medium.

## RISK-006: Build-and-publish workflow is misread as deploy capability
**Category:** Release management  
**Severity:** Medium  
**Current evidence:** no current workflow exists, so any new release automation may be overinterpreted.  
**Impact:** stakeholders may assume environment deployment is already solved.  
**Mitigation:** omit deploy steps entirely, require controlled triggers, document scope and prerequisites clearly.  
**Residual risk:** Low if documentation is explicit.

## RISK-007: Duplicate spec locations create confusion
**Category:** Repository hygiene  
**Severity:** Medium  
**Current evidence:** specs have existed in both repository root and nested app path during planning.  
**Impact:** implementers may update the wrong package or leave docs pointing to inconsistent locations.  
**Mitigation:** designate canonical location explicitly and normalize references during implementation.  
**Residual risk:** Medium until one canonical location is enforced.

## Recommended monitoring points
- grep-based check for stale `specs/p3-` and `specs/p4-runtime-surface-hardening` references
- regression results for invoice/payment tests
- authorization characterization tests before and after policy centralization
- CI dry-run output
- build-and-publish workflow trigger and artifact publication logs
