# Decisions Log

## DEC-001: Use `p4-closeout-hardening` as the canonical feature name
**Status:** Approved  
**Rationale:** the user explicitly accepted this name and it resolves prior ambiguity between `p4-audit-hardening` and `p4-runtime-surface-hardening`.  
**Consequences:** all active and derived references should converge on this name.

## DEC-002: Correct documentation comprehensively, not only active Markdown
**Status:** Approved  
**Rationale:** the user explicitly requested that all distributed documentation artifacts be corrected.  
**Consequences:** implementation must include Markdown and derived versioned files such as audit HTML where relevant.

## DEC-003: Keep monetary hardening incremental and application-level
**Status:** Approved  
**Rationale:** current schema already uses Prisma `Decimal`; risk comes from conversion to `Number` in services.  
**Consequences:** prioritize helper-based refactor in services before considering any schema changes.

## DEC-004: Evolve authorization progressively toward permissions
**Status:** Approved  
**Rationale:** the user accepted a progressive move to permissions instead of a big-bang rewrite.  
**Consequences:** maintain current role-based platform/legacy boundaries while inventorying transition candidates.

## DEC-005: Add versioned CI to the repository
**Status:** Approved  
**Rationale:** no `.github/workflows/` currently exists and manual verification is an explicit risk.  
**Consequences:** create a minimal quality-gates workflow around existing `verify` behavior.

## DEC-006: Replace manual test enumeration with autodiscovery
**Status:** Approved  
**Rationale:** current `package.json` test script can silently omit new tests.  
**Consequences:** standard test command must discover new supported test files automatically.

## DEC-007: Choose CD option B
**Status:** Approved  
**Rationale:** the user explicitly selected the option that advances beyond a placeholder without reaching deploy automation.  
**Consequences:** implementation should create build/version/publish automation without adding deploy steps.

## DEC-008: Stop CD scope before environment deployment
**Status:** Approved  
**Rationale:** repository evidence does not define deployment infrastructure, secrets, or rollback automation sufficiently.  
**Consequences:** any deploy capability remains out of scope and must be planned separately.

## DEC-009: Preserve production behavior while hardening internals
**Status:** Approved  
**Rationale:** the request is a closeout/hardening package, not a product redesign.  
**Consequences:** preserve HTTP contracts, existing supported runtime behavior, and validated domain flows unless a separate approval changes scope.
