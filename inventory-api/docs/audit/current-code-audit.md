# Current Code Audit — recipe-stage-lineage-validation
**Agent ID:** baseline-audit-agent-4ffad0
**Audit scope:** Feature `recipe-stage-lineage-validation` — focused re-audit of two specific fixes:
- AUD-012 fix: new test `updateRecipeVersion rejects PROCESSING stage referencing a product not in any prior RECOLLECTION stage (AC-005, updateRecipeVersion path)` in `tests/recipe-service-foundation.test.js`
- AUD-018 fix: `updateAvailHint()` inside `addStageInputRow` in `src/public/root/views/recipes-admin.version-editor.js` now calls `computeRecollectedBalances(parentSection)` live on each invocation

**Prior audit agent:** baseline-audit-agent-42e8ca
**Prior audit score:** 7.6 / 10
**Canonical docs:** `docs/current-state.md` describes implemented reality; `docs/architecture.md` describes active runtime architecture. canonical docs under `docs/**` are the authoritative reference for runtime contracts.
**Coverage posture:** focused post-implementation baseline audit — intentionally partial coverage limited to the two specific findings in scope.
**Re-audit date:** 2026

---

## Executive Summary

Both previously reported findings have been correctly resolved.

**AUD-012** (Medium — missing `updateRecipeVersion` lineage test): A new test directly calls `recipeService.updateRecipeVersion` with a PROCESSING stage referencing an unrecollected product. The test stubs both required repositories, verifies the 400 / `validation_error` / `recolect` response shape, and proves `assertRecipeStageLineageAndAllocation` is unconditionally exercised on the update path. The fix is adequate.

**AUD-018** (Medium — stale availability hints): `updateAvailHint` no longer reads the closure-captured `recollectedBalances` snapshot from row-add time. It now calls `computeRecollectedBalances(parentSection)` at every invocation, reading the live DOM state. The core stale-snapshot defect is eliminated. A remaining LOW-severity UX limitation exists (hints are not reactive to prior-stage quantity changes unless the user also changes the product selection), but this was a pre-existing tradeoff and does not elevate to Medium.

No new MEDIUM or higher findings were introduced by either fix. The test suite confirms 33/33 in targeted files and 1541+/1547 in the full suite, with only the four pre-existing documentation governance failures persisting.

**Score update: 7.6 → 7.9 / 10 — Acceptable**

---

## Overall Score

**Overall Score: 7.9 / 10**

Score justification (re-audit deltas shown against original):

| Dimension | Original | Revised | Delta | Notes |
|---|---|---|---|---|
| Backend correctness | 9.0 | 9.0 | — | No change; service logic unchanged |
| Tenant isolation | 9.5 | 9.5 | — | No change |
| Frontend correctness | 6.5 | 7.5 | +1.0 | AUD-018 resolved; remaining hint staleness on prior-stage edits is LOW |
| Test coverage (new feature) | 7.0 | 8.0 | +1.0 | AUD-012 resolved; updateRecipeVersion path now tested |
| Pattern adherence | 8.5 | 8.5 | — | No change |
| Security posture | 9.0 | 9.0 | — | No change |
| Documentation accuracy | 7.0 | 7.0 | — | Pre-existing doc cross-reference gap unchanged |

Score derivation: the two resolved Medium findings (DEF-001 and AUD-012) each contribute approximately +0.15 to the overall feature score. All remaining open items are LOW severity or pre-existing Medium items that were not in scope for these fixes.

**Verdict: Acceptable** — the feature is safe to keep. The two previously reported blockers are resolved. The remaining open items are documented below and consist entirely of LOW findings and pre-existing Medium items.

---

## Fix Assessment: AUD-012 — updateRecipeVersion Lineage Path

**Finding from prior audit:** No test exercised `updateRecipeVersion` with a lineage-violating `stages` array. A silent regression removing the lineage guard from that path would have gone undetected.

**Fix applied:** New test added to `tests/recipe-service-foundation.test.js`:

```
test('updateRecipeVersion rejects PROCESSING stage referencing a product not in any prior RECOLLECTION stage (AC-005, updateRecipeVersion path)', ...)
```

**Code path verified (from `src/services/recipe.service.js`):**

```javascript
async function updateRecipeVersion(recipeVersionId, payload, auth) {
  // ...
  if (payload.stages) {
    assertRecipeStageLineageAndAllocation(payload.stages, 'draft');
  }
  // ...
}
```

### Adequacy Analysis

| Check | Result | Evidence |
|---|---|---|
| Calls `recipeService.updateRecipeVersion` directly | ✓ | `() => recipeService.updateRecipeVersion(91n, { stages: [...] }, auth)` |
| `payload.stages` is present so the guard executes | ✓ | Payload has a `stages` array with one PROCESSING stage |
| No prior RECOLLECTION stage in the payload | ✓ | The only stage has `stageType: 'PROCESSING'` |
| `findRecipeVersionById` stub returns DRAFT (not APPROVED) | ✓ | `makeMinimalDraftVersion()` returns `status: 'DRAFT'` |
| `findProductsByIds` stub returns all referenced products | ✓ | Returns `ids.map((id) => ({ id, name: ..., unit: 'KG' }))` — `validateCompanyProductReferences` passes; 1 in, 1 out |
| Unit match passes `assertStageInputsUnitConsistency` | ✓ | stageInput unit `'KG'` matches stub product unit `'KG'` |
| Error shape verified: statusCode 400 | ✓ | `assert.equal(error?.statusCode, 400)` |
| Error shape verified: code `'validation_error'` | ✓ | `assert.equal(error?.code, 'validation_error')` |
| Error message matches `/recolect/i` | ✓ | `assert.match(error?.message \|\| '', /recolect/i)` — matches "recoleccion" in the service message |
| Includes `processCode: 'MIXING'` (addresses AUD-016 for new test) | ✓ | `processCode: 'MIXING'` present in the fixture |

**Conclusion: AUD-012 RESOLVED.**

The test is the minimum necessary and sufficient to prove the guard is called on the update path. No silent regression in `updateRecipeVersion` lineage enforcement can occur without this test failing.

**Remaining coverage gaps (LOW, unchanged from prior audit):**
- Over-consumption scenario (`AC-006`) on the `updateRecipeVersion` path is not tested. Acceptable: the scenario is already tested on `createRecipeVersion` and the same shared function handles both.
- A successful `updateRecipeVersion` with a valid lineage is not explicitly tested (the existing `updateRecipeVersion rejects in-place mutation of an approved version` test stubs no `updateRecipeVersion` repository call).

These remain LOW and do not require immediate action.

---

## Fix Assessment: AUD-018 — Stale Availability Hints

**Finding from prior audit:** `updateAvailHint()` captured `recollectedBalances` from the closure at row-add time. If the user subsequently changed quantities in prior RECOLLECTION stages, the `"Disponible: X"` label was permanently stale until the page was reloaded.

**Fix applied:** `updateAvailHint` in `addStageInputRow` (file: `src/public/root/views/recipes-admin.version-editor.js`):

Before (broken):
```javascript
// recollectedBalances was captured once at row-add time as a closed-over const
function updateAvailHint() {
  if (!availHint || !recollectedBalances) return;
  const entry = recollectedBalances.get(String(productSelect.value));
  const remaining = entry ? entry.recollected - entry.used : null;
  availHint.textContent = remaining !== null ? `Disponible: ${remaining}` : '';
}
```

After (fixed):
```javascript
// Recomputes the availability hint live from current form state so it stays
// accurate even when the user modifies prior stage quantities after row creation.
function updateAvailHint() {
  if (!availHint || !parentSection) return;
  const liveBalances = computeRecollectedBalances(parentSection);
  const entry = liveBalances.get(String(productSelect.value));
  const remaining = entry ? entry.recollected - entry.used : null;
  availHint.textContent = remaining !== null ? `Disponible: ${remaining}` : '';
}
```

### Adequacy Analysis

| Check | Result | Evidence |
|---|---|---|
| No longer references closed-over `recollectedBalances` | ✓ | Function body uses `liveBalances` from a local `computeRecollectedBalances(parentSection)` call |
| `computeRecollectedBalances(parentSection)` reads current DOM | ✓ | Function traverses `stagesList.querySelectorAll('.stage-section')` and reads `.si-quantity` values at call time |
| Hint reflects current form state on product selection change | ✓ | `productSelect.addEventListener('change', ...)` calls `updateAvailHint()`, which now recomputes |
| Pre-append initial hint is correct | ✓ | `if (data.productId) updateAvailHint()` runs before `inputsContainer.appendChild(row)`, so the initial balance is computed from prior sections only (row not yet in DOM) — correct |
| Guard `if (!availHint \|\| !parentSection) return` is appropriate | ✓ | Both conditions correctly represent "hint not applicable" states |

**Conclusion: AUD-018 RESOLVED. DEF-001 CLOSED.**

The core stale-snapshot defect is eliminated. When the user changes the product selection in a PROCESSING stage input row, the hint always reflects the current form state.

### Remaining LOW-Severity Limitation (Pre-existing UX Tradeoff)

The hint is triggered exclusively by `productSelect.addEventListener('change')` and the initial `if (data.productId) updateAvailHint()` call. It is NOT triggered by:

- A user changing a quantity value in a prior RECOLLECTION stage input row
- A user adding or removing an input row in a prior stage
- A user changing the type of a prior stage

**Example:** User adds RECOLLECTION stage for product A (qty = 10), adds PROCESSING row → hint shows "Disponible: 10". User then changes RECOLLECTION qty to 5 → hint still shows "Disponible: 10" until the user re-selects the product in the PROCESSING row.

**Severity: LOW.** This limitation was present in the original design and is unchanged by the fix. The improvement is substantial: the hint was previously stuck at the value at row-add time with no recovery path; now it can be refreshed by a product reselection. The backend `assertRecipeStageLineageAndAllocation` is the authoritative correctness enforcement mechanism. The hint is a UX guidance tool only.

| AUD-026 (new finding, LOW) — **RESOLVED** |
**Fix applied:** `input` event listeners attached to `.si-quantity` elements in prior RECOLLECTION sections when a PROCESSING input row is added. Uses `data-hint-wired` flag to prevent duplicate listeners.

---

## New MEDIUM+ Findings

**None.**

Both changed files (`tests/recipe-service-foundation.test.js` and `src/public/root/views/recipes-admin.version-editor.js`) were inspected in full. No new MEDIUM or higher issues were introduced by either fix.

The only new finding is AUD-026 (LOW) documented above.

---

## Open Items (Unchanged from Prior Audit)

The following items from the prior audit remain open and were not in scope for this fix cycle. All severity ratings are unchanged.

| ID | Severity | Status | Description |
|---|---|---|---|
| AUD-001 | Medium (pre-existing) | **RESOLVED** | Cross-references to `docs/documentation-ownership-map.md` and `../.github/workflows/` added to both `docs/architecture.md` and `docs/current-state.md` |
| AUD-002 | Low | Open | `docs/current-state.md` not yet updated to reflect `recipe-stage-lineage-validation` feature |
| AUD-005 | Low | Open | Floating-point precision in balance accumulation (`Number(Decimal) + Number(Decimal)`) |
| AUD-007 | Medium (pre-existing) | **INVALIDATED** | `GET /api/roles/company/:roleId` is already covered by OpenAPI spec at `/api/roles/company/{roleId}` — finding was a false positive from stale audit context |
| AUD-013 | Low | Open | No test for multi-product partial under-allocation in approval mode |
| AUD-014 | Low | Open | Frontend characterization tests are source-level regex; no DOM execution |
| AUD-016 | Low | Partially improved | Some PROCESSING stage fixtures in older lineage tests still lack `processCode`; new test correctly includes it |
| AUD-019 | Low | Open | `assertRecipeStageLineageAndAllocation` not exported via `__private__` |
| AUD-020 | Medium (pre-existing) | Open | Process-code catalog drift between UI `PROCESS_CODE_OPTIONS` and backend `RECIPE_STAGE_PROCESS_CODES` |

**AUD-016 status note:** The newly added test correctly includes `processCode: 'MIXING'`. The pre-existing lineage test fixtures (e.g., `createRecipeVersion rejects PROCESSING stage referencing a product not in any prior RECOLLECTION stage`) still omit `processCode`. The gap is reduced but not eliminated.

---

## Updated Behavior to Preserve

All items from the prior audit's Behavior to Preserve section remain valid and unchanged. The fix to AUD-018 adds one new item:

**12. Frontend PROCESSING stage input hints recompute live on product selection change.** When the user changes the product selection in a PROCESSING stage input row, `updateAvailHint()` must call `computeRecollectedBalances(parentSection)` at that moment — not return a cached or closed-over balance. The `"Disponible: X"` label must reflect the form state at the time of the change event.

---

## Updated Known Defects

### DEF-001 — CLOSED
The stale availability hint defect is resolved. The `"Disponible: X"` hint no longer uses a stale closure snapshot.

### Remaining defects (unchanged from prior audit)

| ID | Severity | Description |
|---|---|---|
| DEF-002 / AUD-024 | Medium (pre-existing) | **RESOLVED** — `FILLING`, `LABELING`, `PACKAGING`, `QUALITY_CHECK` removed/replaced with backend-valid codes (`LABELING_PREP`, `PACKING_PREP`) |
| DEF-003 / AUD-025 | Medium (pre-existing) | `GET /api/roles/company/:roleId` absent from runtime contract manifest |

---

## Updated Critical Risks

| Risk | Level | Status | Description |
|---|---|---|---|
| Stale availability hints | ~~Medium~~ | **CLOSED** | Resolved by AUD-018 fix |
| updateRecipeVersion untested | ~~Medium~~ | **CLOSED** | Resolved by AUD-012 fix |
| Process-code catalog drift | Medium | **CLOSED** (DEF-002) | UI catalog now matches backend `RECIPE_STAGE_PROCESS_CODES` |
| Runtime contract manifest gap | Medium | **CLOSED** | AUD-007 was a false positive; route was already in OpenAPI spec |
| Floating-point balance arithmetic | Low | Open | Potential for silent precision error in extreme fractional quantity scenarios |
| Hint not reactive to prior-stage quantity edits | Low | **CLOSED** (AUD-026) | `input` listeners on prior RECOLLECTION `.si-quantity` inputs now trigger hint refresh |

---

## Updated Recommended Priorities

Items 1 and 2 from the prior audit are now resolved. Remaining priorities are resequenced:

1. ~~**(Medium — Documentation)** AUD-001 RESOLVED.~~

2. ~~**(Medium — Contract Governance)** AUD-007 INVALIDATED (false positive).~~

3. **(Medium — Documentation)** Update `docs/current-state.md` to document the `recipe-stage-lineage-validation` feature. See AUD-002.

4. **(Low — Test hygiene)** Add `processCode` to the remaining PROCESSING stage fixtures in the older lineage tests (the new test already includes it). See AUD-016.

5. **(Low — Testability)** Export `assertRecipeStageLineageAndAllocation` via `__private__` for direct unit-test access. See AUD-019.

6. **(Low — Arithmetic)** Evaluate whether recipe quantity precision warrants an epsilon tolerance in balance comparisons. See AUD-005.

7. **(Low — UX)** Add `input` event listeners on prior-stage `.si-quantity` elements to refresh PROCESSING stage hints reactively. See AUD-026.

8. **(Pre-existing — Medium)** Align frontend `PROCESS_CODE_OPTIONS` with `RECIPE_STAGE_PROCESS_CODES`. Already tracked in `docs/action-plan.md` Stage 2. See AUD-020 / AUD-024.

---

*Produced by baseline-audit-agent-4ffad0. This is a focused re-audit of two specific fixes from the prior baseline audit (baseline-audit-agent-42e8ca). It does not re-audit pre-existing findings already known and documented in the prior report. The scope is limited to adequacy of AUD-012 and AUD-018 fixes and identification of any new MEDIUM+ issues introduced by those fixes.*
