---
phase: 26-synthetic-data-realism
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/services/terminology.ts
  - tests/terminology.test.ts
  - scripts/audit-bundle-codes.mjs
  - tests/audit-bundle-codes.test.ts
  - package.json
autonomous: true
requirements:
  - SYNTH-01

must_haves:
  truths:
    - "All 5 currently-unresolvable diagnosis codes in shipped synthetic and reference bundles resolve via _seedMap (label + fullText, de + en)"
    - "A standalone audit script enumerates every (system, code) pair in public/data/center-*.json and exits 1 on any unresolvable non-LOINC pair"
    - "npm run audit:bundles runs the audit script as a fast CI gate"
    - "test:ci grows by exactly the number of new tests added (5 seed assertions + audit test); baseline 642 → ~647"
  artifacts:
    - path: "src/services/terminology.ts"
      provides: "_seedMap with 5 new entries: SNOMED 312903003, SNOMED 362098006, ICD-10-GM E11, H43.1, T85.8"
      contains: "312903003"
    - path: "scripts/audit-bundle-codes.mjs"
      provides: "Audit script that scans bundles and asserts code resolvability"
    - path: "tests/audit-bundle-codes.test.ts"
      provides: "Vitest wrapper asserting 0 unresolvable codes against shipped bundles"
    - path: "tests/terminology.test.ts"
      provides: "Extended seed-map coverage tests for the 5 new entries"
    - path: "package.json"
      provides: "audit:bundles script invoking node scripts/audit-bundle-codes.mjs"
  key_links:
    - from: "scripts/audit-bundle-codes.mjs"
      to: "src/services/terminology.ts (_seedMap)"
      via: "dynamic import or duplicated code list — script must read the canonical seed"
      pattern: "_seedMap|seedMap|terminology"
    - from: "tests/audit-bundle-codes.test.ts"
      to: "scripts/audit-bundle-codes.mjs"
      via: "child_process spawn or direct require"
      pattern: "audit-bundle-codes"
---

<objective>
Close the terminology coverage gap (SYNTH-01) by extending `_seedMap` with the 5 codes audited as unresolvable in shipped bundles, add a standalone audit script that asserts zero unresolvable (system, code) pairs across `public/data/center-*.json`, and wire it as `npm run audit:bundles` so subsequent waves can rely on it as a safety-net gate.

Purpose: Restores per-D-01/D-02 byte-identical seed-string formatting and creates the gate that SYNTH-04 reuses.
Output: Updated terminology seed, audit script, audit test, package.json script, +6 tests.
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
@src/services/terminology.ts
@tests/terminology.test.ts
@public/data/center-aachen.json

<interfaces>
From src/services/terminology.ts:

```typescript
interface SeedEntry {
  label: { de: string; en: string };
  fullText: { de: string; en: string };
}
export const _seedMap: Map<string, SeedEntry>;
// Keys are `${system}|${code}`, where system is one of:
//   SYSTEM_SNOMED   = 'http://snomed.info/sct'
//   SYSTEM_ICD10_GM = 'http://fhir.de/CodeSystem/bfarm/icd-10-gm'
// fullText format (D-02): "<German label> (<code>)" / "<English label> (<code>)"
```

LOINC codes (e.g., HbA1c `4548-4`, visus `79880-1`, CRT `LP267955-5`, IOP `56844-4`)
do NOT need seed entries — the audit script must whitelist `http://loinc.org`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend _seedMap with 5 new entries (SYNTH-01 / D-01, D-02)</name>
  <files>src/services/terminology.ts, tests/terminology.test.ts</files>
  <behavior>
    - Test 1: `_seedMap.get('http://snomed.info/sct|312903003')` returns `{label: {de: 'Diabetisches Makulaödem (DMÖ)', en: 'Diabetic macular edema'}, fullText: {de: 'Diabetisches Makulaödem (312903003)', en: 'Diabetic macular edema (312903003)'}}`
    - Test 2: `_seedMap.get('http://snomed.info/sct|362098006')` returns RVO label + fullText with `(362098006)` suffix
    - Test 3: `_seedMap.get('http://fhir.de/CodeSystem/bfarm/icd-10-gm|E11')` returns T2DM (parent code, distinct from existing E11.9 entry)
    - Test 4: `_seedMap.get('http://fhir.de/CodeSystem/bfarm/icd-10-gm|H43.1')` returns Vitreous hemorrhage
    - Test 5: `_seedMap.get('http://fhir.de/CodeSystem/bfarm/icd-10-gm|T85.8')` returns "Sonstige Komplikation durch Implantate" / "Other complication of internal prosthetic devices"
    - All fullText strings end with `(<code>)` per D-02
    - Existing 9 seed entries remain untouched (regression guard)
  </behavior>
  <action>
    Append 5 new entries to `_seedMap` in `src/services/terminology.ts` immediately after the existing `I25.1` entry (around line 117), preserving the comment style ("// SNOMED CT — DME", "// ICD-10-GM — Vitreous hemorrhage", etc.).

    Exact strings per D-01:
    - `${SYSTEM_SNOMED}|312903003` → label de "Diabetisches Makulaödem (DMÖ)", en "Diabetic macular edema"; fullText de "Diabetisches Makulaödem (312903003)", en "Diabetic macular edema (312903003)"
    - `${SYSTEM_SNOMED}|362098006` → label de "Retinaler Venenverschluss (RVV)", en "Retinal vein occlusion"; fullText de "Retinaler Venenverschluss (362098006)", en "Retinal vein occlusion (362098006)"
    - `${SYSTEM_ICD10_GM}|E11` → label de "E11", en "E11"; fullText de "Diabetes mellitus Typ 2 (E11)", en "Type 2 diabetes mellitus (E11)" (label preserves raw-code style consistent with the existing E11.9 entry pattern)
    - `${SYSTEM_ICD10_GM}|H43.1` → label de "H43.1", en "H43.1"; fullText de "Glaskörperblutung (H43.1)", en "Vitreous hemorrhage (H43.1)"
    - `${SYSTEM_ICD10_GM}|T85.8` → label de "T85.8", en "T85.8"; fullText de "Sonstige Komplikation durch Implantate (T85.8)", en "Other complication of internal prosthetic devices (T85.8)"

    In `tests/terminology.test.ts`, add a new `describe('Phase 26 SYNTH-01 seed extension', ...)` block with 5 `it` cases asserting label + fullText for both locales of each new key. Use existing test helpers (no new imports beyond what the file already uses).

    Per D-02: byte-identical formatting — fullText always wraps the code in parentheses at the end. Per CLAUDE.md conventions: throw-only, async/await, camelCase TS identifiers.
  </action>
  <verify>
    <automated>npm test -- --run tests/terminology.test.ts</automated>
  </verify>
  <done>5 new seed entries committed; tests/terminology.test.ts asserts all 5; existing terminology tests still pass; commit message `feat(26-01): extend _seedMap with 5 missing diagnosis codes (SYNTH-01)`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add audit-bundle-codes script + test + npm wiring (SYNTH-01 / D-03, D-13)</name>
  <files>scripts/audit-bundle-codes.mjs, tests/audit-bundle-codes.test.ts, package.json</files>
  <behavior>
    - Test 1: Running the audit script against shipped bundles (public/data/center-*.json) exits 0 and prints a summary line containing "0 unresolvable"
    - Test 2: Audit detects an unresolvable code when given a synthetic fixture bundle injecting an unknown SNOMED code (use a temp file or in-memory mock); exit code is 1, stderr lists the offending (system, code, file) tuple
    - Test 3: LOINC system (`http://loinc.org`) is whitelisted — codes under that system never count as unresolvable regardless of seed presence
    - Test 4: `npm run audit:bundles` invokes the script and propagates exit code
  </behavior>
  <action>
    Create `scripts/audit-bundle-codes.mjs` (ESM, .mjs so it runs without tsx). Logic:

    1. Read all files matching `public/data/center-*.json` (use `fs.globSync` or `fs.readdirSync` + filter).
    2. Parse each as JSON; walk `entry[].resource.code.coding[]` on `Condition`, `Observation`, `Procedure`, `MedicationStatement`. Also walk `reasonCode[].coding[]` and `bodySite[].coding[]`.
    3. Build a `Set<"system|code">` of all distinct pairs.
    4. Whitelist: `http://loinc.org` (D-03 — LOINC resolves locally), `http://snomed.info/sct|362503005` and `|362502000` (eye laterality, structural not diagnostic — but include them anyway since the seed will not cover them; treat any SNOMED bodySite as whitelisted). Also whitelist the SNOMED IVOM procedure code `36189003`, BCVA method `252886007`, and ATC system entirely (medications) — these are not diagnoses.
    5. Build the seed key set by reading `_seedMap` from the compiled or raw `src/services/terminology.ts`. Simplest path: import the module via dynamic `import()` after stripping/converting — instead, re-declare the canonical key list in a small JSON-ish constant at the top of the script and assert in Task 1's test that the script's list matches `_seedMap.keys()`. ALTERNATIVE (preferred): use `tsx`'s ability via `node --import tsx` — but `.mjs` cannot. Pragmatic choice: maintain a hand-mirrored `EXPECTED_SEED_KEYS` constant at the top of the script AND have the audit test (Test below) assert that `EXPECTED_SEED_KEYS` is a superset of the (system, code) pairs from `_seedMap` after dynamic import via vitest. This keeps the script dependency-free.
    6. For each (system, code) pair: pass if system is whitelisted OR seed-key set contains `${system}|${code}`. Else report.
    7. Print summary `[audit:bundles] scanned N bundles, M distinct codes, K unresolvable`. Exit 0 if K=0 else exit 1 (also write each unresolvable to stderr with originating file).

    Create `tests/audit-bundle-codes.test.ts`:
    - `it('reports 0 unresolvable across shipped bundles', ...)` — spawns the script via `node:child_process.spawnSync('node', ['scripts/audit-bundle-codes.mjs'])`, asserts `status === 0` and stdout contains `0 unresolvable`.
    - `it('exits 1 on injected unknown code', ...)` — copies one bundle to a temp file, mutates a Condition coding to use a fake code, runs the script with `BUNDLE_GLOB` env override (add this override path inside the script for testability), asserts exit 1.
    - `it('EXPECTED_SEED_KEYS in script mirrors _seedMap', ...)` — dynamic-imports `src/services/terminology.ts`, reads the script source as text, asserts every `_seedMap` key appears in the script's `EXPECTED_SEED_KEYS` array (drift guard).

    Add to `package.json` `scripts`: `"audit:bundles": "node scripts/audit-bundle-codes.mjs"`. Keep the existing `test:ci` chain unchanged in this task — D-16 wiring into CI happens in 26-04 once the safety net stabilizes.

    Throw-only error policy (CLAUDE.md): the script uses `process.exit(1)` for the audit failure mode (not a thrown error — exit code IS the contract); JSON parse failures throw and propagate.
  </action>
  <verify>
    <automated>npm run audit:bundles && npm test -- --run tests/audit-bundle-codes.test.ts</automated>
  </verify>
  <done>Script exits 0 against shipped bundles; tests pass; `npm run audit:bundles` is wired; commit message `feat(26-01): add audit-bundle-codes script + test gate (SYNTH-01)`.</done>
</task>

</tasks>

<verification>
- `npm test -- --run tests/terminology.test.ts` — all new + existing seed tests pass
- `npm run audit:bundles` — exits 0, prints "0 unresolvable"
- `npm run test:ci` — green at baseline + new tests (642 → ~648)
- `npm run build` — clean
- `npm run lint` — clean
- `npm run knip` — no new dead code
</verification>

<success_criteria>
1. All 5 new seed entries present in `_seedMap` with byte-identical D-01 formatting (label + fullText, de + en).
2. `scripts/audit-bundle-codes.mjs` exists, exits 0 against shipped bundles, exits 1 on injected unknown code.
3. `npm run audit:bundles` is wired and fast (<5s).
4. Test count grows by ~6 (5 seed + ~3 audit, minus any consolidation).
5. Atomic commits per task; commit messages follow `feat(26-01):` convention.
</success_criteria>

<output>
After completion, create `.planning/phases/26-synthetic-data-realism/26-01-SUMMARY.md`
</output>
