---
phase: 26-synthetic-data-realism
reviewed: 2026-05-01T10:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - package.json
  - scripts/audit-bundle-codes.mjs
  - scripts/generate-center-bundle.ts
  - scripts/verify-bundle-distributions.mjs
  - src/services/terminology.ts
  - tests/audit-bundle-codes.test.ts
  - tests/generateCenterBundle.test.ts
  - tests/generatedBundles.test.ts
  - tests/synthBundleDistributions.test.ts
  - tests/terminology.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 26: Code Review Report

**Reviewed:** 2026-05-01T10:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 26 added five missing SNOMED/ICD-10-GM terminology seed entries, a disease-conditional comorbidity model, HbA1c emission for DME patients, age-disease coupling via truncated-normal sampling, per-cohort FHIR bundle templates (AMD/DME/RVO), and a distribution-prior verification script. The overall implementation is structurally sound and the clinical coding choices are defensible. Two warnings were found: a systematic off-by-one in the test fixture birthday calculation (unit tests pass by coincidence of the generous threshold), and an unguarded sampling loop in the AMD comorbidity picker (terminates with probability 1 but is theoretically unbounded). Three info-level items cover dead code, a Box-Muller waste, and a test assertion that could be tightened.

## Warnings

### WR-01: Off-by-one in synthBundleDistributions fixture birthday derivation

**File:** `tests/synthBundleDistributions.test.ts:44-48`

**Issue:** The fixture builder computes `birthDate` as `${onsetYear - spec.age}-06-15` (June 15) while `onset` is fixed at `'2024-01-15'` (January 15). The `ageAtDate` function in `verify-bundle-distributions.mjs` subtracts 1 year whenever the birth month is later than the onset month (June > January), so every patient appears one year younger than `spec.age`. For the happy-path AMD roster (`ages: 70..79`), computed ages are actually `69..78` — the median is 73.5 which still clears the ≥70 threshold, so all tests pass, but the fixture does not faithfully represent the intended ages. If the threshold is ever raised (e.g., to ≥74 to match the generator's mean of 75), tests could start failing with a misleading roster.

**Fix:** Use a January birthday so month arithmetic does not subtract a year, or use an onset date that is clearly past the birth anniversary:

```javascript
// Option A: birth month before onset month (January onset → use January or earlier birth month)
const birthDate = `${birthYear}-01-01`; // always before the Jan-15 onset
```

Or change the onset anchor to a mid-year date that stays after a June birthday:

```javascript
const onset = '2024-07-15'; // July — June birthday is before July, so no subtraction
```

---

### WR-02: Unbounded while loop in AMD comorbidity picker

**File:** `scripts/generate-center-bundle.ts:157-159`

**Issue:** The AMD comorbidity selection loop has no iteration guard:

```typescript
while (chosen.size < targetCount && chosen.size < pool.length) {
  chosen.add(pool[Math.floor(rand() * pool.length)]!);
}
```

With `pool.length = 3` and `targetCount ∈ {1, 2}`, the loop terminates with probability 1 (the set must eventually fill). In practice this is fine. However, the pattern is inconsistent with the guarded `emitHbA1c` loop (200-iteration guard) and with the defensive 50-retry `truncNormal` loop in the same file. If `pool` is ever extended or the logic is copied to a context where `targetCount > pool.length`, the loop could spin indefinitely.

**Fix:** Add a guard consistent with the other loops in the file:

```typescript
let guard = 0;
while (chosen.size < targetCount && chosen.size < pool.length && guard < 100) {
  chosen.add(pool[Math.floor(rand() * pool.length)]!);
  guard++;
}
```

---

## Info

### IN-01: Dead variable `root` in audit-bundle-codes.mjs

**File:** `scripts/audit-bundle-codes.mjs:144-167`

**Issue:** `root` is assigned (`const root = resolve(process.cwd())`) but never used. The `void root` on line 167 is a linter-silencer for a variable that serves no purpose. The comment reads "Silence unused root in stricter linters" — but a simpler fix is to remove the assignment entirely.

**Fix:** Delete lines 144 and 166-167:

```javascript
// Remove:
// const root = resolve(process.cwd());
// ...
// void root;
```

---

### IN-02: Box-Muller generates two normals but only uses one per call

**File:** `scripts/generate-center-bundle.ts:71` and `scripts/generate-center-bundle.ts:78`

**Issue:** Both invocations of Box-Muller inside `truncNormal` compute `z` using only `Math.cos`, discarding the equally valid `Math.sin` normal. Each rejection attempt consumes 2 PRNG draws but produces only 1 sample. This is not incorrect (cos and sin are independent normals), but it halves the statistical efficiency of the PRNG budget and means the rejection-sampling loop can consume up to 100 draws for a single age sample in the worst case. The discarded sin value is also correlated with cos through `u2`, and discarding it breaks no invariants.

This matters here because PRNG call count directly determines output determinism: adding a second consumer of the sin branch would shift all subsequent rand() draws and invalidate all generated bundles. So the current approach is intentionally conservative. No change is needed unless PRNG call budget becomes a concern.

**Fix (optional):** If PRNG efficiency becomes important, implement a paired Box-Muller that caches the sin sample for the next call. Only do this if you can regenerate all bundles atomically.

---

### IN-03: ATC code S01BA01 for Dexamethasone intravitreal implant is a class-level approximation

**File:** `scripts/generate-center-bundle.ts:193`

**Issue:** `S01BA01` is the ATC class code for ophthalmic corticosteroid preparations (eye drops), not specifically for the intravitreal dexamethasone implant (Ozurdex). The correct product-level ATC for Ozurdex is S01BA01 as well (same class), but clinically, the display string `'Dexamethasone (intravitreal implant)'` overstates precision — this code also covers topical dexamethasone eye drops. This is acknowledged in the generator comment and documented in D-09, so it is a known, accepted approximation. The audit whitelist correctly whitelists the ATC system entirely.

If higher clinical accuracy is required in future phases, consider using the SNOMED procedure code `424425001` (administration of dexamethasone into vitreous body) or a product-level identifier. No action required in Phase 26.

---

_Reviewed: 2026-05-01T10:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
