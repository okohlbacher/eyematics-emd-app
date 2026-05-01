---
phase: 26-synthetic-data-realism
verified: 2026-05-01T19:12:00Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
---

# Phase 26: Synthetic Data Realism Verification Report

**Phase Goal:** All (system, code) pairs present in shipped FHIR bundles resolve via the terminology seed. Synthetic bundles encode disease-conditional comorbidities, HbA1c readings for diabetic patients, age-restricted AMD onset, and differentiated AMD/DME/RVO templates — distributions consistent with published German AMD prevalence (Pham 2024) and DR HbA1c norms.
**Verified:** 2026-05-01T19:12:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All 5 unresolvable codes added to `_seedMap` (SNOMED 312903003, 362098006; ICD-10-GM E11, H43.1, T85.8) with German+English labels and full text | ✓ VERIFIED | `src/services/terminology.ts` lines 119–160 contain all 5 entries with correct D-02 `(code)` suffix formatting |
| 2 | Audit script exits 0, reporting 0 unresolvable codes across all 6 bundles | ✓ VERIFIED | `npm run audit:bundles` output: `scanned 6 bundles, 31 distinct codes, 0 unresolvable` |
| 3 | `npm run audit:bundles` is wired as a CI gate inside `test:ci` | ✓ VERIFIED | `package.json` `test:ci`: `npm run test:check-skips && npm test && npm run audit:bundles` |
| 4 | AMD synthetic patients receive age-correlated comorbidities from {I10, E78.0, I25.1} | ✓ VERIFIED | `sampleComorbidities` helper in `generate-center-bundle.ts:141`; verifier reports 65% AMD comorbidity rate (threshold 60%) |
| 5 | DME patients always receive a diabetes Condition (E11.9 80% / E10.9 20%) + 40% I10 | ✓ VERIFIED | `sampleComorbidities` helper; Chemnitz bundle has 21 HbA1c Observations and 35 comorbidity Conditions; verifier: DME diabetes 100% |
| 6 | DME patients receive 2–5 HbA1c (LOINC 4548-4) Observations per case | ✓ VERIFIED | `emitHbA1c` helper in `generate-center-bundle.ts:261`; verifier: all DME patients have ≥2 HbA1c Observations |
| 7 | AMD birthdate sampling restricts age at diagnosis to ≥60 (truncated normal mean=75, sd=8, lower=60, upper=95) | ✓ VERIFIED | `sampleAge` helper in `generate-center-bundle.ts:90`; tests assert min ≥60, max ≤95, median ≥70; verifier: AMD median age 74.0 |
| 8 | AMD/DME/RVO templates differ in IVI count, CRT baseline, drug mix, bilateral preference, visus baseline; Faricimab and Dexamethasone present | ✓ VERIFIED | `TEMPLATES` constant at line 205; `FARICIMAB` (ATC S01LA09) and `DEXAMETHASONE` (ATC S01BA01) at lines 192–193; 8 template differentiation tests pass |
| 9 | 4 synthetic site bundles regenerated atomically (Chemnitz, Leipzig, Greifswald, Münster) — reference bundles untouched | ✓ VERIFIED | Commit `5bdd89a` covers exactly the 4 synthetic JSONs; `center-aachen.json` and `center-tuebingen.json` last touched only in the initial commit `4e07e21` |
| 10 | Test suite green at ≥640; `scripts/verify-bundle-distributions.mjs` asserts all 4 distribution priors | ✓ VERIFIED | `npm run test:ci`: 682/682 tests pass; `verify-bundle-distributions.mjs` enforces AMD median age ≥70, DME diabetes 100%, AMD comorbidity ≥60%, DME HbA1c ≥2 per patient |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `src/services/terminology.ts` | `_seedMap` with 5 new entries: SNOMED 312903003, 362098006; ICD-10-GM E11, H43.1, T85.8 | ✓ VERIFIED | Lines 119–160; all 5 entries present, byte-identical D-02 formatting |
| `scripts/audit-bundle-codes.mjs` | Audit script scanning all center-*.json bundles; exits 0/1 on clean/unresolvable | ✓ VERIFIED | File exists; exits 0 against shipped bundles with `0 unresolvable`; BUNDLE_GLOB override for testability |
| `tests/audit-bundle-codes.test.ts` | Vitest wrapper: 0-unresolvable assertion, injected-code failure, EXPECTED_SEED_KEYS drift guard | ✓ VERIFIED | File exists; 3 tests pass in `test:ci` |
| `tests/terminology.test.ts` | Extended seed-map coverage tests for 5 new entries | ✓ VERIFIED | Extended with Phase 26 SYNTH-01 describe block |
| `scripts/generate-center-bundle.ts` | `sampleComorbidities`, `truncNormal`, `sampleAge`, `emitHbA1c`, `TEMPLATES`, `FARICIMAB`, `DEXAMETHASONE` | ✓ VERIFIED | All helpers confirmed at expected line numbers; wired into per-patient loop |
| `tests/generateCenterBundle.test.ts` | 35 tests covering SYNTH-02 (comorbidities), SYNTH-03 (age/HbA1c/templates) | ✓ VERIFIED | 35 tests pass; covers all 3 cohorts with statistical thresholds |
| `scripts/verify-bundle-distributions.mjs` | Distribution-prior assertion script for 4 synthetic sites; exits 0/1 | ✓ VERIFIED | Asserts AMD median age ≥70, DME diabetes 100%, AMD comorbidity ≥60%, DME HbA1c ≥2; exits 0 |
| `tests/synthBundleDistributions.test.ts` | Vitest wrapper: 6 behaviors including mutation tests + shipped-bundle integration | ✓ VERIFIED | File exists; 6 tests pass |
| `public/data/center-{chemnitz,leipzig,greifswald,muenster}.json` | 4 regenerated synthetic bundles with comorbidities, HbA1c, age coupling, differentiated templates | ✓ VERIFIED | All four files present (1.5–1.8 MB each, timestamped 2026-05-01); Chemnitz spot-check: 35 comorbidity Conditions, 21 HbA1c Observations |
| `package.json` | `audit:bundles` chains both scripts; `verify:bundles` standalone; `test:ci` includes `audit:bundles` | ✓ VERIFIED | `audit:bundles`: `node scripts/audit-bundle-codes.mjs && node scripts/verify-bundle-distributions.mjs`; chained into `test:ci` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `audit-bundle-codes.mjs` | `_seedMap` / `EXPECTED_SEED_KEYS` | Hand-mirrored constant + drift-guard test in `audit-bundle-codes.test.ts` | ✓ WIRED | Drift guard asserts every `_seedMap` key appears in script's constant |
| `tests/audit-bundle-codes.test.ts` | `scripts/audit-bundle-codes.mjs` | `child_process.spawnSync` | ✓ WIRED | Spawns script as a subprocess |
| `generateCenterBundle` per-patient loop | `sampleComorbidities` | Direct function call at line 400 | ✓ WIRED | Called after primary Condition push |
| `generateCenterBundle` per-patient loop | `emitHbA1c` | Conditional call when `cohortKey === 'dme'` at line 560 | ✓ WIRED | Confirmed in grep output |
| `generateCenterBundle` per-patient loop | `TEMPLATES[cohortKey]` | Direct template lookup driving IVI/CRT/drug/bilateral | ✓ WIRED | Line 419 |
| `verify-bundle-distributions.mjs` | `public/data/center-(chemnitz\|leipzig\|greifswald\|muenster).json` | `SYNTHETIC_PATTERN` regex + `expandGlob` | ✓ WIRED | Skips reference bundles by regex; reads 4 synthetic files |
| `package.json` `audit:bundles` | `verify-bundle-distributions.mjs` | Shell chain `&&` | ✓ WIRED | Confirmed in `package.json` scripts |
| `package.json` `test:ci` | `audit:bundles` | Chained after `npm test` | ✓ WIRED | `test:ci` ends with `npm run audit:bundles` |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `audit:bundles` exits 0 with 0 unresolvable codes | `npm run audit:bundles` | `scanned 6 bundles, 31 distinct codes, 0 unresolvable` + `scanned 4 bundles, 103 AMD (median age 74.0, comorbidity rate 65.0%), 53 DME — all priors pass` | ✓ PASS |
| Full test suite green | `npm run test:ci` | `682 passed (682)` — 63 test files | ✓ PASS |
| Build clean | `npm run build` | Clean, 2377 modules transformed | ✓ PASS |
| Chemnitz bundle contains comorbidities and HbA1c | Node spot-check | 35 comorbidity Conditions, 21 HbA1c Observations with LOINC `4548-4` | ✓ PASS |
| Reference bundles untouched | `git log -- center-aachen.json center-tuebingen.json` | Both files only in `4e07e21` (initial commit); no Phase 26 commits | ✓ PASS |

---

### Requirements Coverage

| Requirement | Plans | Description | Status | Evidence |
|-------------|-------|-------------|--------|----------|
| SYNTH-01 | 26-01 | _seedMap covers 5 missing codes; audit script reports 0 unresolvable | ✓ SATISFIED | 15 entries in `_seedMap`; `audit:bundles` exits 0 |
| SYNTH-02 | 26-02 | Disease-conditional comorbidity model: ≥60% AMD + 100% DME diabetes + ≥40% DME I10 | ✓ SATISFIED | AMD 65% (shipped bundles via verifier); DME 100% diabetes; generator tests verify thresholds |
| SYNTH-03 | 26-03 | HbA1c 2–5 obs/DME case; AMD age ≥60; AMD/DME/RVO template differentiation | ✓ SATISFIED | `emitHbA1c`, `sampleAge`, `TEMPLATES`; 35 generator tests; verifier confirms |
| SYNTH-04 | 26-04 | 4 bundles regenerated; quick-check priors pass; test:ci ≥640 | ✓ SATISFIED | 4 synthetic JSONs regenerated atomically in `5bdd89a`; verifier exits 0; 682 tests (well above 640 floor) |

**Note:** `REQUIREMENTS.md` still shows `[ ]` for SYNTH-04 (not marked `[x]`). This is a documentation tracking inconsistency only — all code evidence confirms the requirement is fully met. The checkbox should be updated to `[x]`.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `tests/generateCenterBundle.test.ts` | 219 | AMD comorbidity unit-test asserts ≥45%, not ≥60% | ℹ️ Info | Not a blocker — the unit test was intentionally lowered during 26-02 because age coupling (added in 26-03) was needed to reach 60%. The shipped-bundle verifier (`verify-bundle-distributions.mjs`) enforces the real 60% gate. This is a deliberate and documented two-layer design. |
| `scripts/generate-center-bundle.ts` | 283 | HbA1c first value range `[7.5, 10.5]` — ROADMAP SC says `6.5–10.5%` | ℹ️ Info | The generator implements 7.5 as the minimum (tighter than the 6.5 lower bound in the ROADMAP SC). Values are still within clinically realistic poorly-controlled diabetes range. The ROADMAP wording "baseline 6.5–10.5%" was permissive; the implementation narrowed the lower bound. Not a functional gap. |

No blockers found.

---

### Human Verification Required

None — all must-haves are programmatically verifiable and confirmed.

---

## Gaps Summary

No gaps. All 10 observable truths verified, all artifacts substantive and wired, all key links confirmed, behavioral spot-checks pass. The one documentation item (SYNTH-04 checkbox in REQUIREMENTS.md) does not affect code correctness.

---

_Verified: 2026-05-01T19:12:00Z_
_Verifier: Claude (gsd-verifier)_
