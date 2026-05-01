---
phase: 26-synthetic-data-realism
plan: 04
type: execute
wave: 3
depends_on: ['26-02', '26-03']
files_modified:
  - public/data/center-chemnitz.json
  - public/data/center-leipzig.json
  - public/data/center-greifswald.json
  - public/data/center-muenster.json
  - scripts/verify-bundle-distributions.mjs
  - tests/synthBundleDistributions.test.ts
  - package.json
autonomous: true
requirements:
  - SYNTH-04

must_haves:
  truths:
    - "npm run generate-bundles regenerates the 4 synthetic site bundles (Chemnitz, Leipzig, Greifswald, Münster) deterministically"
    - "All 4 regenerated bundles parse as valid FHIR R4 and pass npm run audit:bundles (zero unresolvable codes)"
    - "verify-bundle-distributions.mjs asserts: AMD median age ≥70, DME diabetes-comorbidity rate = 100%, AMD comorbidity rate ≥60%, DME HbA1c emission ≥2 per case"
    - "npm run audit:bundles is wired into the safety net alongside test:ci, build, lint, knip"
    - "Test suite stays green at 645–650 (642 baseline + new tests from 26-01..03 + verification tests; ±5 churn allowance)"
    - "Reference bundles (center-aachen.json, center-tuebingen.json) are NOT modified"
  artifacts:
    - path: "scripts/verify-bundle-distributions.mjs"
      provides: "Distribution-prior assertion script invoked by npm run verify:bundles (or audit:bundles extension)"
    - path: "tests/synthBundleDistributions.test.ts"
      provides: "Vitest wrapper running verification script + sampled assertions against shipped bundles"
    - path: "public/data/center-{chemnitz,leipzig,greifswald,muenster}.json"
      provides: "Regenerated synthetic bundles encoding comorbidities, HbA1c, age coupling, differentiated templates"
  key_links:
    - from: "verify-bundle-distributions.mjs"
      to: "public/data/center-*.json (4 synthetic only)"
      via: "fs.readFile + JSON.parse + walking entries"
      pattern: "center-(chemnitz|leipzig|greifswald|muenster)"
    - from: "package.json scripts.audit:bundles"
      to: "verify-bundle-distributions.mjs + audit-bundle-codes.mjs"
      via: "shell chain"
      pattern: "verify-bundle-distributions"
---

<objective>
Implement SYNTH-04: regenerate the 4 synthetic site bundles atomically using the upgraded generator from 26-02 + 26-03, add `scripts/verify-bundle-distributions.mjs` to assert aggregate priors, wire it as a safety-net gate, and update tests to reflect the new fixture shape (allowing ±5 churn per D-14).

Purpose: This is the publishing step — the script changes from 26-02/26-03 only take effect once bundles are regenerated. Atomic commit covers all 4 bundles to prevent the partial-regeneration hazard called out in CONTEXT §code_context.
Output: 4 regenerated bundles (atomic commit) + verification script + verification tests + safety-net wiring.
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
@.planning/phases/26-synthetic-data-realism/26-03-hba1c-and-template-differentiation-PLAN.md
@.planning/phases/26-synthetic-data-realism/26-01-seed-extension-and-audit-PLAN.md
@scripts/generate-all-bundles.ts
@scripts/audit-bundle-codes.mjs

<interfaces>
Generator entry point: `scripts/generate-all-bundles.ts` (already lists the 4 synthetic sites with fixed seeds 70103/70107/70112/70114, 45 patients each).

Audit script (from 26-01): `node scripts/audit-bundle-codes.mjs` exits 0 / 1.

Verification thresholds (D-12):
- AMD median age ≥70
- DME diabetes-comorbidity rate = 100% (every DME patient has E11.9 OR E10.9 Condition)
- AMD comorbidity rate ≥60% (≥1 comorbidity from {I10, E78.0, I25.1})
- DME HbA1c emission ≥2 per case (every DME patient has ≥2 LOINC 4548-4 Observations)
- 0 unresolvable codes (delegated to audit:bundles)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add verify-bundle-distributions script + tests + safety-net wiring (SYNTH-04 / D-12, D-13)</name>
  <files>scripts/verify-bundle-distributions.mjs, tests/synthBundleDistributions.test.ts, package.json</files>
  <behavior>
    - Test 1: Running the verifier against an in-memory bundle that satisfies all thresholds exits 0
    - Test 2: Verifier exits 1 when AMD median age <70 (inject a mutated copy)
    - Test 3: Verifier exits 1 when any DME patient lacks a diabetes Condition
    - Test 4: Verifier exits 1 when any DME patient has <2 HbA1c Observations
    - Test 5: Verifier exits 1 when AMD comorbidity rate <60%
    - Test 6: `npm run audit:bundles` runs BOTH audit-bundle-codes.mjs AND verify-bundle-distributions.mjs (script chain)
  </behavior>
  <action>
    1. Create `scripts/verify-bundle-distributions.mjs` (ESM, dependency-free):
       - Read `public/data/center-{chemnitz,leipzig,greifswald,muenster}.json` (skip reference bundles per D-06)
       - For each bundle, walk entries; for each Patient build a record `{patientId, cohort, ageAtBaseline, comorbidities: Set<code>, hba1cCount: number}`. Determine cohort from the primary Condition (the SNOMED `267718000` / `312903003` / `362098006` coding). Determine `ageAtBaseline` from `Patient.birthDate` and the primary Condition's `onsetDateTime`.
       - Aggregate across all 4 bundles into per-cohort buckets.
       - Assert:
         - `median(amdPatients.ageAtBaseline) >= 70`
         - For every DME patient: `comorbidities.has('E11.9') || comorbidities.has('E10.9')`
         - `amdPatients.filter(p => p.comorbidities.size >= 1 && hasOneOf(p.comorbidities, ['I10', 'E78.0', 'I25.1'])).length / amdPatients.length >= 0.60`
         - For every DME patient: `hba1cCount >= 2`
       - On failure: print which assertion failed with the offending counts/medians; exit 1. On success: print summary line and exit 0.
       - Support env override `BUNDLE_GLOB` for the test path injection (mirror 26-01 audit script pattern).

    2. Create `tests/synthBundleDistributions.test.ts` with the 6 behaviors. For mutation tests, deep-clone a real bundle in-memory, mutate, write to a temp file, point the verifier via `BUNDLE_GLOB`, spawn via `child_process.spawnSync`.

    3. Update `package.json` scripts:
       - `"verify:bundles": "node scripts/verify-bundle-distributions.mjs"`
       - `"audit:bundles": "node scripts/audit-bundle-codes.mjs && node scripts/verify-bundle-distributions.mjs"` (chain — supersedes the 26-01 single-script version)
       - Verify the chain still exits 0 against the SHIPPED (un-regenerated) bundles BEFORE Task 2 runs — it WILL fail the distribution checks because shipped bundles are pre-regeneration. So: in this task, ONLY assert that the script and tests work in isolation against synthesized fixtures. Real bundles fail; that's expected and resolved in Task 2.
       - To avoid breaking CI mid-plan, do NOT yet wire `audit:bundles` into `test:ci` in this task.

    Conventions: dependency-free .mjs, throw-only for parse errors, exit code for assertion failures, deterministic.
  </action>
  <verify>
    <automated>npm test -- --run tests/synthBundleDistributions.test.ts</automated>
  </verify>
  <done>Verifier script + tests exist and pass against synthesized fixtures; `npm run verify:bundles` against shipped bundles is EXPECTED to fail until Task 2 regenerates; commit `feat(26-04): add verify-bundle-distributions script + chained audit:bundles (SYNTH-04 D-12, D-13)`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Regenerate 4 synthetic bundles atomically + update affected tests (SYNTH-04 / D-11, D-14, D-15)</name>
  <files>public/data/center-chemnitz.json, public/data/center-leipzig.json, public/data/center-greifswald.json, public/data/center-muenster.json, tests/synthBundleDistributions.test.ts</files>
  <behavior>
    - Test 1: All 4 regenerated bundles parse as valid JSON
    - Test 2: `npm run audit:bundles` exits 0 against the regenerated bundles (both audit-bundle-codes AND verify-bundle-distributions pass)
    - Test 3: Across the 4 bundles aggregated: AMD median age ≥70
    - Test 4: 100% DME patients have a diabetes Condition (E11.9 or E10.9)
    - Test 5: 100% DME patients have ≥2 HbA1c Observations
    - Test 6: ≥60% AMD patients have ≥1 comorbidity from {I10, E78.0, I25.1}
    - Test 7: Existing test suite remains within the ±5 churn budget (D-14): expected ~642 → 645–650 final
  </behavior>
  <action>
    1. Run `npm run generate-bundles`. This overwrites the 4 synthetic bundle JSONs.
    2. Verify each file is valid JSON: `for f in chemnitz leipzig greifswald muenster; do node -e "JSON.parse(require('fs').readFileSync('public/data/center-$f.json','utf8'))"; done`
    3. Run `npm run audit:bundles` — MUST exit 0. If unresolvable codes → seed gap; loop back to 26-01. If distribution failure → tune generator constants in 26-02/26-03; loop back.
    4. Run `npm run test:ci`. Expect some test churn:
       - Tests reading specific patient counts or specific Condition counts per site MAY break. Per D-14 allow ±5 churn. For each broken test:
         - If it asserts a stable invariant (e.g., "every Patient has a Condition") → leave assertion, the regenerated bundle still satisfies it
         - If it hard-codes a specific count (e.g., "Aachen has 30 patients with AMD") → that test reads a REFERENCE bundle (Aachen/Tübingen) which is NOT regenerated; should still pass
         - If it hard-codes a synthetic-site count → update fixture or relax assertion. Comment with `// fixture refreshed in Phase 26 / SYNTH-04`.
       - Tests touching `getDiagnosisLabel`-style behaviour around the 5 new seed codes may now resolve where they previously fell through to raw code. Update assertions accordingly.
    5. Add the verification tests already created in Task 1 to the SHIPPED-bundle assertion path (they were synthesized-fixture-only in Task 1; now add `it('shipped bundles satisfy distribution priors', ...)` that runs the verifier against `public/data/`).
    6. Wire `npm run audit:bundles` into `test:ci`:
       ```json
       "test:ci": "npm run test:check-skips && npm test && npm run audit:bundles"
       ```
    7. Run the full safety net: `npm run test:ci && npm run build && npm run lint && npm run knip && npm run audit:bundles`. All must pass.
    8. Commit ATOMICALLY (D-11, single commit covering all 4 bundles + test edits + package.json):
       ```
       git add public/data/center-chemnitz.json public/data/center-leipzig.json public/data/center-greifswald.json public/data/center-muenster.json tests/synthBundleDistributions.test.ts package.json [any updated tests]
       git commit -m "chore(26-04): regenerate synthetic bundles + wire audit:bundles into test:ci (SYNTH-04 D-11)"
       ```
       The `chore` prefix per D-11 / Phase 22-25 convention. Do NOT split the 4 JSONs across multiple commits (CONTEXT §code_context "Bundle-edit hazard").

    Conventions: ≤±5 test churn per D-14; reference bundles untouched per D-06.
  </action>
  <verify>
    <automated>npm run test:ci && npm run build && npm run lint && npm run knip && npm run audit:bundles</automated>
  </verify>
  <done>4 synthetic bundles regenerated atomically; verify:bundles + audit:bundles green; test:ci 645–650; build + lint + knip clean; single chore(26-04) commit; commit covers exactly 4 JSON + tests + package.json.</done>
</task>

</tasks>

<verification>
- `npm run test:ci` — green at 645–650 tests
- `npm run build` — clean
- `npm run lint` — clean
- `npm run knip` — no new dead code
- `npm run audit:bundles` — exits 0 (both audit-bundle-codes AND verify-bundle-distributions pass)
- Reference bundles (center-aachen.json, center-tuebingen.json) byte-identical to pre-phase state (`git diff --stat HEAD~ public/data/center-aachen.json public/data/center-tuebingen.json` should report no changes touching them in this plan's commits)
- All 4 ROADMAP §Phase 26 success criteria true: SYNTH-01 (audit 0 unresolvable), SYNTH-02 (comorbidity rates), SYNTH-03 (HbA1c + age + templates), SYNTH-04 (regenerated + verified)
</verification>

<success_criteria>
1. 4 synthetic bundles regenerated in a single atomic commit per D-11.
2. `scripts/verify-bundle-distributions.mjs` enforces all D-12 thresholds.
3. `npm run audit:bundles` chains both audit + verify and is wired into `test:ci`.
4. Test suite at 645–650 (642 baseline + ~3–8 new tests, within D-14 ±5 churn).
5. Build + lint + knip + audit all green.
6. Reference bundles untouched.
</success_criteria>

<output>
After completion, create `.planning/phases/26-synthetic-data-realism/26-04-SUMMARY.md`
</output>
