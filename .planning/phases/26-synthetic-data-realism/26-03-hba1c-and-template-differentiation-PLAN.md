---
phase: 26-synthetic-data-realism
plan: 03
type: execute
wave: 2
depends_on: ['26-02']
files_modified:
  - scripts/generate-center-bundle.ts
  - tests/generateCenterBundle.test.ts
autonomous: true
requirements:
  - SYNTH-03

must_haves:
  truths:
    - "DME synthetic patients receive 2–5 HbA1c (LOINC 4548-4) Observations per case with baseline 7.5–10.5% and bounded random walk drifting toward 7%"
    - "AMD birthdate sampling restricts age at primary diagnosis to ≥60 (truncated normal mean=75, sd=8, lower=60, upper=95)"
    - "DME age range 50–80 (truncated normal mean=65, sd=8); RVO age range 55–85 (truncated normal mean=68, sd=10)"
    - "AMD/DME/RVO templates differ in IVI count distribution, CRT baseline, drug mix, bilateral preference, and visus baseline per D-09"
    - "Faricimab and Dexamethasone medication entries exist as new constants and are sampled per D-09 mix"
    - "Generator remains deterministic"
  artifacts:
    - path: "scripts/generate-center-bundle.ts"
      provides: "sampleAge(primary, rand) helper, emitHbA1c(visitDates, rand) helper, per-cohort template constants for IVI count / CRT / drug mix / bilateral / visus"
      contains: "FARICIMAB|DEXAMETHASONE|sampleAge|HBA1C_CODE"
    - path: "tests/generateCenterBundle.test.ts"
      provides: "Tests for HbA1c emission, age distributions, template differentiation"
  key_links:
    - from: "DME patient generation"
      to: "HbA1c emission helper"
      via: "function call inside per-patient loop when cohortKey === 'dme'"
      pattern: "emitHbA1c|HBA1C"
    - from: "sampleAge"
      to: "patient birthDate computation"
      via: "replaces the hardcoded 1935–1970 birth-offset"
      pattern: "sampleAge\\("
---

<objective>
Implement SYNTH-03: add HbA1c emission for DME patients, age-disease coupling via truncated-normal sampling, and AMD/DME/RVO template differentiation (IVI count, CRT baseline, drug mix, bilateral preference, visus baseline) per D-07/D-08/D-09. Sequential within Wave 2 — depends on 26-02 because both edit `scripts/generate-center-bundle.ts`.

Purpose: Brings synthetic bundles into rough alignment with published priors (Pham 2024 AOK PLUS for AMD age, German DR HbA1c norms, IRIS Registry IVI patterns, RVO unilateral majority).
Output: Modified generator with three new helpers + extended template constants. Bundles NOT yet regenerated (26-04 owns regeneration).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/26-synthetic-data-realism/26-CONTEXT.md
@.planning/phases/26-synthetic-data-realism/26-02-comorbidity-model-PLAN.md
@scripts/generate-center-bundle.ts
@scripts/prng.ts

<interfaces>
HbA1c FHIR Observation shape (LOINC 4548-4):
```json
{
  "resourceType": "Observation",
  "id": "obs-<sh>-<patNum>-hba1c-<k>",
  "status": "final",
  "subject": { "reference": "Patient/<patId>" },
  "code": { "coding": [{ "system": "http://loinc.org", "code": "4548-4", "display": "Hemoglobin A1c/Hemoglobin.total" }] },
  "effectiveDateTime": "<ISO date>",
  "valueQuantity": { "value": 8.2, "unit": "%", "code": "%", "system": "http://unitsofmeasure.org" }
}
```
Note: per D-07, valueQuantity includes both `unit` and `code` set to `%`, plus `system` UCUM URL.

ATC codes for new drugs (per D-09):
- Faricimab: ATC `S01LA09` (anti-VEGF/Ang2 bispecific)
- Dexamethasone intravitreal implant: ATC `S01BA01` — NOTE: ATC for dexamethasone systemic is S01BA01 (ophthalmic). The intravitreal implant Ozurdex is sometimes coded SNOMED `424425001`. Default to ATC `S01BA01` for consistency with the existing ATC pattern; document choice in code comment.

Truncated-normal sampling (deterministic via Box-Muller using Mulberry32 rand):
```ts
function truncNormal(rand: () => number, mean: number, sd: number, lo: number, hi: number): number {
  // Box-Muller; reject samples outside [lo, hi], cap retries at 50 then clamp
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add age-disease coupling via sampleAge helper (SYNTH-03 / D-08)</name>
  <files>scripts/generate-center-bundle.ts, tests/generateCenterBundle.test.ts</files>
  <behavior>
    - Test 1: Generating 200 AMD patients yields ageAtBaseline distribution with median ≥70, min ≥60, max ≤95
    - Test 2: Generating 200 DME patients yields ageAtBaseline median in [60, 70], min ≥50, max ≤80
    - Test 3: Generating 200 RVO patients yields ageAtBaseline median in [63, 73], min ≥55, max ≤85
    - Test 4: Determinism — same seed → identical age sequence across runs
    - Test 5: birthDate is computed as `baselineDate − ageAtBaseline years`, NOT the prior uniform 1935–1970 offset
  </behavior>
  <action>
    1. Add `truncNormal` helper at top of `scripts/generate-center-bundle.ts` (after imports, before public types). Use Box-Muller transform driven by `rand()`; reject samples outside `[lo, hi]`; on >50 rejections, clamp to nearest bound (defensive). All randomness via `rand`.

    2. Add `sampleAge(primary: 'amd' | 'dme' | 'rvo', rand: () => number): number` helper. Per D-08:
       - amd: truncNormal(75, 8, 60, 95)
       - dme: truncNormal(65, 8, 50, 80)
       - rvo: truncNormal(68, 10, 55, 85)
       Returns integer (Math.floor).

    3. RESTRUCTURE per-patient loop ordering:
       - The current code samples `birthDate` BEFORE `cohortKey`. Move `cohortKey` selection to happen FIRST (before demographics), then call `sampleAge(cohortKey, rand)` to compute `ageAtBaseline`, then derive `birthDate = addDays(baselineDate, -ageAtBaseline * 365 + seededRandInt(rand, 0, 364))` so birthdate keeps day-level variation.
       - This means `baselineDate` must also move BEFORE `birthDate`. Move the `baselineOffset`/`baselineDate` block above demographics.
       - Ensure determinism: any reordering of `rand()` calls changes the output sequence — that IS expected (this is a generator rewrite, bundles are regenerated in 26-04). Document this in a code comment: "Phase 26 SYNTH-03: rand() call order intentionally changed; bundles regenerated atomically in plan 26-04."

    4. Update test file with the 5 behaviors. Use cohort-isolated mixes (e.g., `{amd: 1, dme: 0, rvo: 0}`) and patient counts of 200 for statistical stability.

    Conventions: deterministic (no Math.random), throw-only, camelCase.
  </action>
  <verify>
    <automated>npm test -- --run tests/generateCenterBundle.test.ts</automated>
  </verify>
  <done>truncNormal + sampleAge helpers added; per-patient loop reordered; age-distribution tests pass; commit `feat(26-03): age-disease coupling via truncated-normal sampling (SYNTH-03 D-08)`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: HbA1c emission for DME patients (SYNTH-03 / D-07)</name>
  <files>scripts/generate-center-bundle.ts, tests/generateCenterBundle.test.ts</files>
  <behavior>
    - Test 1: Generating 50 DME patients, every patient has 2–5 HbA1c Observations with LOINC 4548-4
    - Test 2: First HbA1c value per patient is in [7.5, 10.5]; subsequent values within ±1.5% of previous; trend (last − first) skews negative on average across the cohort (drift toward 7%)
    - Test 3: HbA1c valueQuantity has `unit === '%' && code === '%' && system === 'http://unitsofmeasure.org'`
    - Test 4: HbA1c effectiveDateTime falls within [baselineDate, finalVisitDate] inclusive
    - Test 5: AMD and RVO patients have ZERO HbA1c Observations
    - Test 6: Determinism preserved
  </behavior>
  <action>
    1. Add HbA1c constants:
       ```ts
       const HBA1C_CODE = { system: LOINC, code: '4548-4', display: 'Hemoglobin A1c/Hemoglobin.total' };
       const UCUM = 'http://unitsofmeasure.org';
       ```

    2. Add helper `emitHbA1c(args: { ref: string; patIdSuffix: string; visitDates: string[]; rand: () => number }): unknown[]`:
       - Sample readingCount = seededRandInt(rand, 2, 5)
       - Pick readingCount distinct visit indices uniformly across `visitDates`
       - First value: 7.5 + rand() * 3.0 (→ [7.5, 10.5])
       - Subsequent: prev + (rand() − 0.6) * 1.5; clamp to [5.0, 13.0]; if step magnitude >1.5, clip to ±1.5
       - Build Observation entries with the shape in `<interfaces>`. Round value to 1 decimal place.

    3. Inside per-patient loop, after CRT/IOP emission, if `cohortKey === 'dme'`, call helper and push results into `observationEntries`.

    4. Tests as listed.

    Conventions: deterministic, throw-only, camelCase.
  </action>
  <verify>
    <automated>npm test -- --run tests/generateCenterBundle.test.ts</automated>
  </verify>
  <done>HbA1c emission integrated; tests pass; commit `feat(26-03): HbA1c observations for DME patients (SYNTH-03 D-07)`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: AMD/DME/RVO template differentiation + Faricimab/Dexamethasone (SYNTH-03 / D-09)</name>
  <files>scripts/generate-center-bundle.ts, tests/generateCenterBundle.test.ts</files>
  <behavior>
    - Test 1: AMD patients have IVI count in [1, 22], CRT baseline in [280, 500], drug mix Aflibercept ~80% / Bevacizumab ~20% (±10% slack at n=200), bilateral rate ~30%, visus baseline in [0.05, 0.45]
    - Test 2: DME patients have IVI count in [1, 12], CRT baseline in [350, 600], drug mix Aflibercept ~60% / Bevacizumab ~40% / Faricimab ~5% (slack), bilateral rate ~60%, visus baseline in [0.1, 0.5]
    - Test 3: RVO patients have IVI count in [1, 8], CRT baseline in [350, 650], drug mix Aflibercept ~70% / Bevacizumab ~20% / Dexamethasone ~10% (slack), bilateral rate ~5%, visus baseline in [0.05, 0.35]
    - Test 4: Faricimab MedicationStatement uses ATC `S01LA09`; Dexamethasone uses ATC `S01BA01`
    - Test 5: When bilateral, the patient has TWO eyes' worth of Conditions/Observations/Procedures (asymmetric baseline allowed); when unilateral, exactly one eye
    - Test 6: Determinism preserved
  </behavior>
  <action>
    1. Add medication constants:
       ```ts
       const FARICIMAB     = { system: ATC, code: 'S01LA09', display: 'Faricimab' };
       const DEXAMETHASONE = { system: ATC, code: 'S01BA01', display: 'Dexamethasone (intravitreal implant)' };
       ```

    2. Add per-cohort `TEMPLATES` constant:
       ```ts
       const TEMPLATES = {
         amd: { ivi: [1, 22], crtBase: [280, 500], drugs: [{p: 0.80, drug: AFLIBERCEPT}, {p: 1.00, drug: BEVACIZUMAB}], bilateralProb: 0.30, visusBase: [0.05, 0.45] },
         dme: { ivi: [1, 12], crtBase: [350, 600], drugs: [{p: 0.60, drug: AFLIBERCEPT}, {p: 0.95, drug: BEVACIZUMAB}, {p: 1.00, drug: FARICIMAB}], bilateralProb: 0.60, visusBase: [0.10, 0.50] },
         rvo: { ivi: [1, 8],  crtBase: [350, 650], drugs: [{p: 0.70, drug: AFLIBERCEPT}, {p: 0.90, drug: BEVACIZUMAB}, {p: 1.00, drug: DEXAMETHASONE}], bilateralProb: 0.05, visusBase: [0.05, 0.35] },
       } as const;
       ```
       Note: `drugs` is a CDF table — sample by `r = rand(); pick first entry where r ≤ p`.

    3. REPLACE existing inline IVI count, CRT baseline, drug pick, visus baseline literals in the per-patient loop with `TEMPLATES[cohortKey]` reads.

    4. Implement bilateral support:
       - After the existing `eye` selection, sample `isBilateral = rand() < TEMPLATES[cohortKey].bilateralProb`
       - If bilateral: emit Conditions/Observations/Procedures for BOTH eyes. Use the existing `eye` as primary; the other eye gets an asymmetric independent baseline (different visus/CRT trajectories driven by additional rand() draws). Use suffix `-l`/`-r` on observation IDs to keep them distinct.
       - If unilateral: existing single-eye behavior.
       - Document the Condition id scheme: `cond-<sh>-<patNum>` (primary eye) and `cond-<sh>-<patNum>-bilat` (second eye) when bilateral.

    5. Tests for the 6 behaviors. For drug-mix assertions use n=200 per cohort and ±10% absolute slack. For bilateral, count distinct `bodySite.coding[].code` per patient.

    6. Update CLI help comment block at top of file to mention Faricimab + Dexamethasone are now in the drug mix.

    Conventions: deterministic, throw-only, camelCase. All randomness through `rand`.
  </action>
  <verify>
    <automated>npm test -- --run tests/generateCenterBundle.test.ts</automated>
  </verify>
  <done>Templates differentiate AMD/DME/RVO per D-09; Faricimab + Dexamethasone in drug mix; bilateral support; tests pass; commit `feat(26-03): AMD/DME/RVO template differentiation + faricimab + dexamethasone (SYNTH-03 D-09)`.</done>
</task>

</tasks>

<verification>
- `npm test -- --run tests/generateCenterBundle.test.ts` — all template / HbA1c / age tests pass
- `npm run test:ci` — full suite green (bundles still un-regenerated)
- `npm run build` — clean
- `npm run lint` — clean
- `npm run knip` — no new dead code
- `npm run audit:bundles` — still passes (no bundle changes yet)
</verification>

<success_criteria>
1. truncNormal + sampleAge implement D-08 distributions deterministically.
2. emitHbA1c implements D-07 — 2–5 readings per DME case, value bounds, UCUM unit.
3. TEMPLATES constants implement D-09 differentiation; Faricimab + Dexamethasone present.
4. Bilateral support: AMD ~30%, DME ~60%, RVO ~5%.
5. No regression in existing tests (against shipped bundles).
6. Three atomic commits, each tied to one D-XX cluster.
</success_criteria>

<output>
After completion, create `.planning/phases/26-synthetic-data-realism/26-03-SUMMARY.md`
</output>
