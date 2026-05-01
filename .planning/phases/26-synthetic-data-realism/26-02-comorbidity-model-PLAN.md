---
phase: 26-synthetic-data-realism
plan: 02
type: execute
wave: 2
depends_on: ['26-01']
files_modified:
  - scripts/generate-center-bundle.ts
  - tests/generateCenterBundle.test.ts
autonomous: true
requirements:
  - SYNTH-02

must_haves:
  truths:
    - "AMD synthetic patients receive 1+ comorbidity from {I10, E78.0, I25.1} with age-correlated probability per D-04"
    - "DR/DME synthetic patients always receive a diabetes Condition (E11.9 80% / E10.9 20%) and 40% chance of additional I10"
    - "RVO synthetic patients receive I10 50%, E78.0 30%; diabetes optional"
    - "Comorbidity Conditions use clinicalStatus active, BfArM ICD-10-GM system URL, no bodySite, onset 1–10 years before primary diagnosis"
    - "Generator remains deterministic (Mulberry32 seeded; same seed → byte-identical output)"
  artifacts:
    - path: "scripts/generate-center-bundle.ts"
      provides: "sampleComorbidities(primary, age, rand, baselineDate) helper + integration into the per-patient loop emitting comorbidity Conditions"
      contains: "sampleComorbidities"
    - path: "tests/generateCenterBundle.test.ts"
      provides: "Unit tests asserting comorbidity-rate thresholds across a generated synthetic bundle"
  key_links:
    - from: "generateCenterBundle (per-patient loop)"
      to: "sampleComorbidities helper"
      via: "function call after primary Condition emission"
      pattern: "sampleComorbidities\\("
    - from: "comorbidity Conditions"
      to: "BfArM ICD-10-GM system URL"
      via: "system: 'http://fhir.de/CodeSystem/bfarm/icd-10-gm'"
      pattern: "fhir.de/CodeSystem/bfarm/icd-10-gm"
---

<objective>
Implement SYNTH-02: extend `scripts/generate-center-bundle.ts` with a deterministic `sampleComorbidities(primary, age, rand, baselineDate)` helper and wire it into the per-patient loop so generated synthetic bundles encode disease-conditional comorbidities matching the D-04 thresholds.

Purpose: Brings synthetic bundles into rough alignment with German AMD/DR epidemiology (Pham 2024, AOK PLUS). HbA1c, age coupling, and template differentiation land in 26-03 (parallel-safe within Wave 2 only by file split — same file → sequential).
Output: Modified generator script + unit tests asserting per-cohort comorbidity rates. Bundles are NOT yet regenerated (26-04 owns regeneration).
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
@.planning/phases/26-synthetic-data-realism/26-01-seed-extension-and-audit-PLAN.md
@scripts/generate-center-bundle.ts
@scripts/prng.ts
@public/data/center-aachen.json

<interfaces>
From scripts/generate-center-bundle.ts:

```typescript
// Existing constants
const SNOMED = 'http://snomed.info/sct';
const ICD10_GM = 'http://fhir.de/CodeSystem/bfarm/icd-10-gm'; // ADD this constant
// Existing helpers in scripts/prng.ts: mulberry32(seed), seededRandInt(rand, lo, hi), addDays(date, n)
// Per-patient loop (lines 125–275) emits Condition entries; insertion point for comorbidities is immediately after the primary Condition push (~line 176).
```

Existing reference (Aachen) Condition shape for comorbidity (extracted from public/data/center-aachen.json):
```json
{
  "resourceType": "Condition",
  "id": "cond-uka-001-como-1",
  "subject": { "reference": "Patient/pat-uka-001" },
  "code": { "coding": [{ "system": "http://fhir.de/CodeSystem/bfarm/icd-10-gm", "code": "I10", "display": "Essential hypertension" }] },
  "clinicalStatus": { "coding": [{ "code": "active" }] },
  "onsetDateTime": "2011-05-24",
  "category": [{ "coding": [{ "code": "non-ophthalmic", "display": "Non-ophthalmic" }] }]
}
```
No `bodySite` (D-05 — systemic).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add sampleComorbidities helper + per-patient age tracking (SYNTH-02 / D-04, D-05)</name>
  <files>scripts/generate-center-bundle.ts, tests/generateCenterBundle.test.ts</files>
  <behavior>
    - Test 1: Calling `generateCenterBundle({ patients: 200, seed: 42, cohortMix: {amd: 1, dme: 0, rvo: 0}, ... })` produces ≥60% AMD patients with at least one comorbidity Condition coded I10/E78.0/I25.1
    - Test 2: With cohortMix `{amd: 0, dme: 1, rvo: 0}` and patients=100, 100% of patients have a diabetes Condition (E11.9 or E10.9), with E11.9 frequency in [0.7, 0.9] band; ≥35% also have I10
    - Test 3: With cohortMix `{amd: 0, dme: 0, rvo: 1}` and patients=100, ≥40% have I10, ≥20% have E78.0; diabetes is allowed but not required (no assertion)
    - Test 4: AMD comorbidity rate is age-correlated — generating 200 AMD patients then bucketing by age <70/70–80/>80, the >80 bucket has strictly higher mean comorbidity count than <70 (sanity check, allow ±10% slack)
    - Test 5: All comorbidity Conditions use `clinicalStatus.coding[0].code === 'active'`, system === 'http://fhir.de/CodeSystem/bfarm/icd-10-gm', NO `bodySite`, and `onsetDateTime` is between 1 and 10 years before the primary `baselineDate`
    - Test 6: Determinism — same seed → identical comorbidity emission (run generator twice, deep-equal Condition arrays)
  </behavior>
  <action>
    In `scripts/generate-center-bundle.ts`:

    1. Add constant near the top with other system URLs:
       ```ts
       const ICD10_GM = 'http://fhir.de/CodeSystem/bfarm/icd-10-gm';
       ```

    2. Add comorbidity code dictionary near `COHORT_CODES`:
       ```ts
       const COMORBIDITY_CODES = {
         I10:   { system: ICD10_GM, code: 'I10',   display: 'Essential hypertension' },
         E78_0: { system: ICD10_GM, code: 'E78.0', display: 'Hypercholesterolemia' },
         I25_1: { system: ICD10_GM, code: 'I25.1', display: 'Coronary artery disease' },
         E11_9: { system: ICD10_GM, code: 'E11.9', display: 'Type 2 diabetes mellitus' },
         E10_9: { system: ICD10_GM, code: 'E10.9', display: 'Type 1 diabetes mellitus' },
       } as const;
       const NON_OPHTHALMIC = { code: 'non-ophthalmic', display: 'Non-ophthalmic' };
       ```

    3. Add helper `sampleComorbidities` BEFORE the `generateCenterBundle` function (around line 86):
       ```ts
       interface ComorbidityPick { codeKey: keyof typeof COMORBIDITY_CODES; }
       function sampleComorbidities(
         primary: 'amd' | 'dme' | 'rvo',
         ageAtBaseline: number,
         rand: () => number,
       ): ComorbidityPick[] {
         const picks: ComorbidityPick[] = [];
         if (primary === 'amd') {
           // Age-correlated probability per D-04
           const probAny = ageAtBaseline < 70 ? 0.30 : ageAtBaseline <= 80 ? 0.60 : 0.80;
           const targetCount = ageAtBaseline > 80 ? (rand() < 0.5 ? 2 : 1) : 1;
           if (rand() < probAny) {
             const pool: Array<keyof typeof COMORBIDITY_CODES> = ['I10', 'E78_0', 'I25_1'];
             const chosen = new Set<keyof typeof COMORBIDITY_CODES>();
             while (chosen.size < targetCount && chosen.size < pool.length) {
               chosen.add(pool[Math.floor(rand() * pool.length)]!);
             }
             for (const k of chosen) picks.push({ codeKey: k });
           }
         } else if (primary === 'dme') {
           // 100% diabetes, 80/20 T2/T1
           picks.push({ codeKey: rand() < 0.8 ? 'E11_9' : 'E10_9' });
           if (rand() < 0.4) picks.push({ codeKey: 'I10' });
         } else if (primary === 'rvo') {
           if (rand() < 0.5) picks.push({ codeKey: 'I10' });
           if (rand() < 0.3) picks.push({ codeKey: 'E78_0' });
         }
         return picks;
       }
       ```

    4. Inside the per-patient loop (immediately after the primary Condition push, ~line 176), compute `ageAtBaseline` from `birthDate` and `baselineDate`:
       ```ts
       const ageAtBaseline = Math.floor((new Date(baselineDate).getTime() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000));
       const comorbidityPicks = sampleComorbidities(cohortKey, ageAtBaseline, rand);
       comorbidityPicks.forEach((pick, idx) => {
         const yearsBefore = seededRandInt(rand, 1, 10);
         const onsetDate = addDays(baselineDate, -yearsBefore * 365);
         const c = COMORBIDITY_CODES[pick.codeKey];
         conditionEntries.push({
           resource: {
             resourceType: 'Condition',
             id: `cond-${sh}-${patNum}-como-${idx + 1}`,
             subject: { reference: ref },
             code: { coding: [{ system: c.system, code: c.code, display: c.display }] },
             clinicalStatus: { coding: [{ code: 'active' }] },
             onsetDateTime: onsetDate,
             category: [{ coding: [NON_OPHTHALMIC] }],
           },
         });
       });
       ```

       NOTE: D-04 says DR (E11/E10 primary) AND DME both get diabetes. The current generator does NOT have a 'dr' cohort key — only `amd`, `dme`, `rvo` exist (see `COHORT_CODES`). DME → diabetes is correct; the bundles' E11 codes (DR-style) are out of scope for this generator (those live only in the curated Aachen/Tübingen reference bundles which we do NOT regenerate per D-06). Add a code comment recording this scope decision.

    5. Verify `addDays` accepts negative offsets (read `scripts/prng.ts` if unsure); if not, compute the onset via `new Date` arithmetic in line.

    6. Create `tests/generateCenterBundle.test.ts` (or extend if it exists — check first) with the 6 behaviors above. Use `generateCenterBundle` directly with controlled cohort mixes and large patient counts (200) for statistical stability. Bound assertions with the slack ranges given.

    Conventions (CLAUDE.md): camelCase identifiers, async/await unused (this is sync), throw-only error handling, no Result types. Determinism: ALL randomness flows through the `rand` parameter (Mulberry32) — never `Math.random()`.
  </action>
  <verify>
    <automated>npm test -- --run tests/generateCenterBundle.test.ts</automated>
  </verify>
  <done>sampleComorbidities helper added; per-patient loop emits comorbidity Conditions matching D-04/D-05 thresholds; new test file passes; commit message `feat(26-02): add disease-conditional comorbidity model to bundle generator (SYNTH-02)`.</done>
</task>

</tasks>

<verification>
- `npm test -- --run tests/generateCenterBundle.test.ts` — comorbidity-rate assertions pass
- `npm run test:ci` — full suite green (existing tests reading shipped bundles unaffected; bundles not yet regenerated)
- `npm run build` — clean
- `npm run lint` — clean
- `npm run audit:bundles` — still passes (no bundle changes yet)
- `npm run knip` — no new dead code
</verification>

<success_criteria>
1. `sampleComorbidities` helper exists, deterministic, matches D-04 probability table.
2. Generator emits comorbidity Conditions with correct shape (D-05): clinicalStatus active, ICD-10-GM system, no bodySite, onset 1–10 years before primary.
3. Statistical thresholds verified by tests against in-memory generated bundles (NOT shipped bundles).
4. No regression in existing test suite.
5. Atomic commit with message `feat(26-02):`.
</success_criteria>

<output>
After completion, create `.planning/phases/26-synthetic-data-realism/26-02-SUMMARY.md`
</output>
