---
phase: 26-synthetic-data-realism
plan: 03
subsystem: synthetic-data-generator
tags: [synth, fhir, hba1c, age-coupling, templates, bilateral]
requires:
  - 26-02 (comorbidity model — same file)
  - scripts/generate-center-bundle.ts
  - scripts/prng.ts
provides:
  - truncNormal helper (Box-Muller via Mulberry32, rejection sampling)
  - sampleAge helper (cohort-specific truncated-normal age distributions)
  - emitHbA1c helper (DME-only LOINC 4548-4 random walk with drift)
  - TEMPLATES constant (per-cohort IVI / CRT base / drug CDF / bilateralProb / visus base)
  - FARICIMAB + DEXAMETHASONE medication constants
  - per-eye emitter inside generateCenterBundle (bilateral support)
affects:
  - tests/generateCenterBundle.test.ts (+19 tests across age/HbA1c/templates/bilateral)
  - public/data/center-{chemnitz,leipzig,greifswald,muenster}.json
    (NOT regenerated here — bundles stay stale until 26-04)
tech-stack:
  added:
    - Box-Muller transform on top of existing Mulberry32 PRNG
  patterns:
    - CDF-table drug-mix sampling (sorted ascending probabilities)
    - per-eye emitter closure for bilateral / unilateral parity
    - rand-call ordering preserved across cohorts (deterministic regeneration)
key-files:
  created: []
  modified:
    - scripts/generate-center-bundle.ts
    - tests/generateCenterBundle.test.ts
decisions:
  - D-07 implemented: HbA1c LOINC 4548-4, baseline 7.5–10.5%, ±1.5% step cap, clamp 5.0–13.0%, UCUM `%`
  - D-08 implemented: AMD N(75,8)[60,95]; DME N(65,8)[50,80]; RVO N(68,10)[55,85]
  - D-09 implemented: AMD/DME/RVO templates differ in IVI / CRT base / drug mix / bilateral / visus base
  - D-09 (drug ATC): Faricimab=S01LA09; Dexamethasone defaulted to S01BA01 (kept ATC pattern)
  - bilateral resources use '-bilat' id suffix; CRT clamp widened to [200,700] for RVO ceiling
metrics:
  duration_seconds: 599
  completed: 2026-04-30
  tasks: 3
  commits: 6
  files_modified: 2
  tests_added: 19
  tests_passing: 675
---

# Phase 26 Plan 03: HbA1c & Template Differentiation Summary

Adds disease-conditional realism to `scripts/generate-center-bundle.ts`: HbA1c
emission for DME patients (LOINC 4548-4 random walk drifting toward 7%),
age-disease-coupled birthdates via cohort-specific truncated-normal sampling,
and AMD/DME/RVO template differentiation (IVI count, CRT/visus baselines,
drug mix with Faricimab + Dexamethasone, bilateral preference).

## What Changed

### `scripts/generate-center-bundle.ts`

- **`truncNormal(rand, mean, sd, lo, hi)`** — Box-Muller via Mulberry32 with
  rejection sampling, defensive clamp after 50 retries.
- **`sampleAge(primary, rand)`** — cohort-specific truncated normals per D-08:
  - amd: N(75, 8) ∩ [60, 95]
  - dme: N(65, 8) ∩ [50, 80]
  - rvo: N(68, 10) ∩ [55, 85]
- **Per-patient loop reordered** so cohort + baselineDate are sampled BEFORE
  demographics; birthDate now derives from `baselineDate − sampledAge years`.
  rand() call order intentionally changed; bundles regenerate atomically in 26-04.
- **`emitHbA1c({ ref, patIdSuffix, visitDates, rand })`** — emits 2–5 LOINC
  4548-4 Observations; first value in [7.5, 10.5]; subsequent drift via
  `prev + (rand() − 0.6) * 1.5` clamped to [5.0, 13.0]; rounded to 1dp;
  valueQuantity carries unit/code `%` and UCUM system per D-07.
- **`TEMPLATES`** constant codifies D-09 per-cohort parameters.
- **`pickDrugFromCdf`** — sorted-CDF sampler: pick first entry where rand() ≤ p.
- **Per-eye emitter** (`emitEye`) refactor inside the patient loop — emits
  Condition, visus Observations, CRT Observations and Procedures for one eye.
  Called once for `primaryEye` and again with `'-bilat'` suffix for the second
  eye when `rand() < tmpl.bilateralProb`. IOP / HbA1c / comorbidities remain
  patient-level (no per-eye duplication).
- **`FARICIMAB` (ATC S01LA09)** and **`DEXAMETHASONE` (ATC S01BA01)**
  constants added; CLI header comment updated.

### `tests/generateCenterBundle.test.ts` (+19 tests)

- **SYNTH-03 — age-disease coupling (D-08)** — 5 tests for AMD/DME/RVO age
  distributions, determinism, and birthDate derivation.
- **SYNTH-03 — HbA1c emission (D-07)** — 6 tests: count [2,5], value bounds /
  step cap / drift, UCUM unit, date window, AMD/RVO zero, determinism.
- **SYNTH-03 — template differentiation (D-09)** — 8 tests: per-cohort IVI /
  CRT / visus / drug mix bounds (±10% slack at n=200), Faricimab/Dexamethasone
  ATC system, bilateral rate ~30/60/5%, unilateral count, `cond-*-bilat` ids,
  full-bundle determinism.
- **DATA-GEN-01..04 legacy assertions** updated for new bounds:
  - procedure count cap 20 → 44 (max IVI 22 × 2 eyes)
  - drug mix accepts S01LA05 / L01XC07 / S01LA09 / S01BA01

## Test Counts

| Stage          | Count |
| -------------- | ----- |
| Pre-26-03      | 656   |
| Post-Task 1    | 661   |
| Post-Task 2    | 667   |
| Post-Task 3    | 675   |

## Commits

| Step | Hash    | Message                                                                                            |
| ---- | ------- | -------------------------------------------------------------------------------------------------- |
| RED  | 18890d8 | test(26-03): failing age-distribution tests for sampleAge (SYNTH-03 D-08)                          |
| GREEN| 4f6a518 | feat(26-03): age-disease coupling via truncated-normal sampling (SYNTH-03 D-08)                    |
| RED  | 43b9827 | test(26-03): failing HbA1c emission tests for DME (SYNTH-03 D-07)                                  |
| GREEN| a57fa7e | feat(26-03): HbA1c observations for DME patients (SYNTH-03 D-07)                                   |
| RED  | aea4946 | test(26-03): failing template-differentiation tests (SYNTH-03 D-09)                                |
| GREEN| 7a238bb | feat(26-03): AMD/DME/RVO template differentiation + faricimab + dexamethasone (SYNTH-03 D-09)      |

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 1 — Bug-fix in test bounds] DATA-GEN-01..04 procedure-count assertion**
   - **Found during:** Task 3
   - **Issue:** legacy assertion `ivoms.length ≤ 20` no longer holds after AMD
     IVI cap raised to 22 and bilateral support multiplied procedure count.
   - **Fix:** raised cap to 44, kept ascending-date check per eye-stream.
   - **Files modified:** `tests/generateCenterBundle.test.ts`
   - **Commit:** `7a238bb`

2. **[Rule 1 — Bug-fix in test bounds] DATA-GEN drug-mix assertion**
   - **Found during:** Task 3
   - **Issue:** legacy `S01LA05 || L01XC07` assertion fails when DME picks
     Faricimab or RVO picks Dexamethasone.
   - **Fix:** broadened the OR to include S01LA09 + S01BA01.
   - **Commit:** `7a238bb`

3. **[Rule 3 — Blocking] CRT clamp widened from [200,600] to [200,700]**
   - **Found during:** Task 3
   - **Issue:** RVO cohort CRT base ranges up to 650 µm per D-09; the prior
     hard ceiling of 600 µm clipped legitimate baseline values.
   - **Fix:** widened the runtime clamp to [200, 700] inside `emitEye`.
   - **Commit:** `7a238bb`

4. **[Rule 3 — Blocking] Age-arithmetic precision**
   - **Found during:** Task 1
   - **Issue:** Initially used 365-day years for `birthDate` derivation;
     downstream age check uses 365.25 days, producing computed ages 0.03 yr
     below the cohort lower bound (e.g., RVO sampledAge=55 → measured 54.97).
   - **Fix:** switched birthDate offset to `Math.round(sampledAge * 365.25)`.
   - **Commit:** `4f6a518`

## Authentication Gates

None — fully autonomous.

## Verification

- `npm test -- --run tests/generateCenterBundle.test.ts` — 35 / 35 pass
- `npm run test:ci` — 675 / 675 pass (656 baseline + 19 new)
- `npm run build` — clean
- `npm run lint` — clean (autofix applied to tests import-sort warning)
- `npm run knip` — no new dead code (4 pre-existing config hints)
- `npm run audit:bundles` — 6 bundles / 30 codes / 0 unresolvable

## Known Stubs

None — generator changes are complete; bundles stay stale by design until
plan 26-04 regenerates them.

## Self-Check: PASSED

- scripts/generate-center-bundle.ts — FOUND, contains FARICIMAB|DEXAMETHASONE|sampleAge|HBA1C_CODE
- tests/generateCenterBundle.test.ts — FOUND, 35 tests
- commits 18890d8, 4f6a518, 43b9827, a57fa7e, aea4946, 7a238bb — FOUND in `git log`
