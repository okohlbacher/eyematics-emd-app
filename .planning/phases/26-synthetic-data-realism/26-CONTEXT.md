# Phase 26: Synthetic Data Realism — Context

**Gathered:** 2026-04-30
**Status:** Ready for planning
**Mode:** architecture pre-decided in post-v1.9.4 audit (no `--auto` discuss needed)
**Scope trigger:** Two findings from audit (a) terminology seed has 5 coverage gaps; (b) synthetic bundles materially diverge from German AMD/DR epidemiology and have systemic structural flaws (zero comorbidities, no HbA1c, no age-disease coupling).

<domain>
## Phase Boundary

Address two intertwined data-quality problems:

1. **Terminology coverage** — Add 5 currently-unresolvable diagnosis codes to `_seedMap` in `src/services/terminology.ts` so they render as proper display names instead of raw codes.
2. **Synthetic bundle realism** — Rewrite `scripts/generate-center-bundle.ts` to:
   - Emit disease-conditional comorbidities (currently zero in synth bundles)
   - Generate HbA1c observations for DR/DME patients (currently absent)
   - Restrict AMD onset to age ≥60 (currently uniform 1935–1970)
   - Differentiate AMD / DME / RVO templates (currently identical)
   Then regenerate the 4 synthetic site bundles and verify aggregate distributions against published priors.

**Out of scope:**
- Wiring up an external terminology server (already shipped as proxy in Phase 25; opt-in)
- LOINC / Observation-code seed extension — kept as-is (those resolve via local LOINC handling, not the terminology server path)
- Reference-bundle (Aachen / Tübingen) modifications — those represent curated real-clinic baseline data and stay untouched
- New chart types or UI changes
- Probabilistic disease modeling beyond the simple comorbidity-frequency targets in success criteria
- Synthetic OCT image generation (separate concern; not affected here)
- Fundus image / retinopathy-grade synthesis

</domain>

<decisions>
## Implementation Decisions

### SYNTH-01 — Seed extension

- **D-01:** Add 5 entries to `_seedMap` in `src/services/terminology.ts` keyed by the project's existing `system|code` convention. New entries:
  - SNOMED `267018000` → wait, double-check; the audit reports `312903003` for DME — use that.
  - SNOMED `312903003` — DE: "Diabetisches Makulaödem (DMÖ)", EN: "Diabetic macular edema"; full text: "Diabetic macular edema (312903003)" / "Diabetisches Makulaödem (312903003)"
  - SNOMED `362098006` — DE: "Retinaler Venenverschluss (RVV)", EN: "Retinal vein occlusion"
  - ICD-10-GM `E11` — DE: "Diabetes mellitus Typ 2 (E11)", EN: "Type 2 diabetes mellitus (E11)" — note the parent code without `.9` is also valid in ICD-10-GM; treat as separate seed entry.
  - ICD-10-GM `H43.1` — DE: "Glaskörperblutung (H43.1)", EN: "Vitreous hemorrhage (H43.1)"
  - ICD-10-GM `T85.8` — DE: "Sonstige Komplikation durch Implantate (T85.8)", EN: "Other complication of internal prosthetic devices (T85.8)"
- **D-02:** Re-use the 4-tuple structure already in `_seedMap` (de-label, en-label, de-fullText, en-fullText). Byte-identical formatting (parenthesised code suffix in fullText) per Phase 25 D-08.
- **D-03:** Add a one-shot audit script `scripts/audit-bundle-codes.mjs` that scans `public/data/center-*.json`, builds the `(system, code)` inventory, and asserts every pair is in `_seedMap` (or is LOINC). Exit 1 if any unresolvable. Wire into `npm run test:ci` as a check OR keep it as a standalone `npm run audit:codes` — Claude's discretion.

### SYNTH-02 — Comorbidity model

- **D-04:** Comorbidity sampling lives in `scripts/generate-center-bundle.ts`. Add a `sampleComorbidities(primary, age)` helper:
  - **AMD primary** → ≥60% chance of ≥1 from `{I10, E78.0, I25.1}`. Sample with age-correlated probability:
    - age <70: 30% chance of any comorbidity
    - age 70–80: 60% chance, often 1 condition
    - age >80: 80% chance, often 1–2 conditions
  - **DR / DME primary** → ALWAYS add a diabetes Condition (`E11.9` 80% / `E10.9` 20%); 40% chance of additional `I10`.
  - **RVO primary** → 50% chance of `I10`, 30% chance of `E78.0`. Diabetes is plausible but not required.
- **D-05:** Comorbidity Conditions use `clinicalStatus.coding[0].code = 'active'`. Onset 1–10 years before primary diagnosis (pre-existing). Codes use BfArM ICD-10-GM system URL `http://fhir.de/CodeSystem/bfarm/icd-10-gm` (matching existing pattern). No `bodySite` for systemic conditions.
- **D-06:** Reference bundles (Aachen `center-aachen.json`, Tübingen `center-tuebingen.json`) are NOT regenerated. Only the 4 synth sites in `SITES` array of `scripts/generate-all-bundles.ts`.

### SYNTH-03 — HbA1c + age-disease coupling + template differentiation

- **D-07:** HbA1c (LOINC `4548-4`) emission for DR/DME patients only. 2–5 readings per case across the visit timeline (sample dates uniformly between baseline and final visit). Values:
  - Baseline: 7.5–10.5% (poorly controlled, justifies presence in DR cohort)
  - Subsequent: random walk with drift toward 7% (treatment effect); cap step size at ±1.5% per visit (no >2% swings)
  - Unit: `%` (FHIR `valueQuantity.unit` = `%`, code = `%`, system = `http://unitsofmeasure.org`)
- **D-08:** Age-disease coupling for AMD: birthdate sampled such that age at primary-diagnosis date is ≥60, with peak in 70–85 (truncated normal mean=75, sd=8, lower=60, upper=95). Source: AOK PLUS prevalence (Pham 2024) — exudative AMD 6.9% at 85+ vs 0.49% at <65. DR/DME age range 50–80 (truncated normal mean=65, sd=8). RVO age range 55–85 (truncated normal mean=68, sd=10).
- **D-09:** Template differentiation (replace identical templates):
  - **AMD**: 1–22 IVI per case (current behavior keeps); CRT baseline 280–500 µm; 80% Aflibercept / 20% Bevacizumab; bilateral 30% (asymmetric); visus baseline 0.05–0.45.
  - **DME**: 1–12 IVI per case (smaller); CRT baseline 350–600 µm (higher than AMD); 60% Aflibercept / 40% Bevacizumab + 5% Faricimab; bilateral 60% (DM is systemic, often bilateral); visus baseline 0.1–0.5.
  - **RVO**: 1–8 IVI per case; CRT baseline 350–650 µm; 70% Aflibercept / 20% Bevacizumab / 10% Dexamethasone implant; bilateral 5% (vascular event almost always unilateral); visus baseline 0.05–0.35.
- **D-10:** All thresholds chosen to be defensible from public sources cited in §canonical_refs but kept simple — this is a research demonstrator, not a clinical simulator. Generator stays deterministic via Mulberry32 PRNG (current pattern preserved).

### SYNTH-04 — Regeneration + verification

- **D-11:** Run `npm run generate-bundles` after script changes are committed. The 4 synthetic bundles overwrite. Atomic commit: "regenerate synthetic bundles" with explicit byte-diff acknowledgement.
- **D-12:** Add `scripts/verify-bundle-distributions.mjs` (or extend `audit-bundle-codes.mjs`) that asserts:
  - AMD median age ≥70
  - DR/DME diabetes-comorbidity rate = 100%
  - AMD comorbidity rate ≥60%
  - DR/DME HbA1c emission ≥2 observations per case
  - All bundles parse + pass FHIR R4 schema (re-use any existing validator if present)
  - 0 unresolvable codes (reuses SYNTH-01 audit)
- **D-13:** Wire `npm run audit:bundles` (or similar) and call it from CI / safety net. Fast (<5 s expected). Exit 1 on assertion failure.

### Test impact

- **D-14:** Existing tests that hard-code site-specific patient counts may break. Allow ±5 test churn (currently 642 → expected 640–647). If a test depends on a synthetic bundle's exact patient list, update fixture or mark with comment "fixture refreshed in Phase 26 / SYNTH-04".
- **D-15:** Add new tests:
  - `tests/audit-bundle-codes.test.ts` — assert all bundle codes resolve via `_seedMap` or LOINC
  - `tests/synthBundleDistributions.test.ts` — sample assertions: AMD age median, DR HbA1c presence, comorbidity rates
  - `tests/terminology.test.ts` — extend with the 5 new seed entries
  Net: +5–8 tests, target final 645–650.

### Cross-cutting

- **D-16:** Atomic commits per task. Safety net per commit: `npm run test:ci` + `npm run build` + `npm run lint` + `npm run knip` + `npm run audit:bundles` (new gate).
- **D-17:** Wave grouping: Wave 1 = SYNTH-01 (seed extension, parallel-safe with anything). Wave 2 = SYNTH-02 + SYNTH-03 (generator script changes; same file, sequential within wave). Wave 3 = SYNTH-04 (regenerate + verify; depends on 02+03).

### Claude's Discretion

- Whether to combine SYNTH-02 + SYNTH-03 into a single PLAN.md (same file, similar concerns) — Claude judges during planning. Default: separate plans for reviewability, single wave.
- Exact age-distribution truncated-normal parameters within the bounds in D-08 — Claude can refine using the Pham 2024 / GHS data when planning.
- Whether to add CSP/server-side enforcement around generation — out of scope (script is offline tooling).
- Whether to materialize the verification thresholds as constants or env-overrideable — Claude's call; constants are simpler.

</decisions>

<specifics>
## Specific Ideas

- The 5 missing seed codes have already-known display strings — extract from existing bundle `Condition.code.coding[].display` where present (the bundles already supply display, just the seed didn't have them).
- The Mulberry32 PRNG already lives in `scripts/generate-center-bundle.ts`. Add new helper functions; do NOT introduce a new RNG library.
- Faricimab and Dexamethasone (referenced in D-09) need product entries in `MedicationStatement` template. Use SNOMED for medication coding where the existing pattern uses SNOMED; otherwise ATC if the existing pattern is ATC.
- Reference (curated) bundles already encode multi-comorbidity patterns — D-04 thresholds approximate that pattern but stay calibrated to the four target priors in the success criteria.

</specifics>

<canonical_refs>
**Downstream agents MUST read these before planning or implementing.**

### ROADMAP & requirements
- `.planning/ROADMAP.md` §Phase 26 — phase goal + success criteria
- `.planning/REQUIREMENTS.md` SYNTH-01..SYNTH-04 — binding requirement text

### Existing code (to be modified)
- `src/services/terminology.ts` — `_seedMap` to extend (SYNTH-01)
- `scripts/generate-center-bundle.ts` — comorbidity, HbA1c, age, template differentiation (SYNTH-02 / SYNTH-03)
- `scripts/generate-all-bundles.ts` — site list, no changes expected (verifies regeneration scope)
- `public/data/center-{chemnitz,leipzig,greifswald,muenster}.json` — regenerated artifacts (SYNTH-04)
- `tests/terminology.test.ts` — extend with new seed coverage

### Public data anchors (for SYNTH-02 / SYNTH-03 calibration)
- **AOK PLUS claims study (Pham et al. 2024)** — German AMD prevalence by age:
  https://pmc.ncbi.nlm.nih.gov/articles/PMC10912065/
- **KORA Study — German AMD by age, sex, smoking**:
  https://pmc.ncbi.nlm.nih.gov/articles/PMC5125704/
- **AugUR Study — AMD classification (Bavarian elderly cohort)**:
  https://www.nature.com/articles/s41598-018-26629-5
- **Gutenberg Health Study — 5-yr AMD incidence**:
  https://link.springer.com/article/10.1007/s00417-021-05312-y
- **AAO IRIS Registry — PDR treatment trends**:
  https://pmc.ncbi.nlm.nih.gov/articles/PMC9560578/
- **DRCR Retina Network — public manuscripts**:
  https://public.jaeb.org/drcrnet/pubs
- **mBRSET — handheld DR dataset metadata**:
  https://www.nature.com/articles/s41597-025-04627-3

### Phase history (pattern references)
- Phase 25 — terminology service module pattern; seed-map extension idiom
- Phase 24 — bundle / data layer changes (FB-01 site removal); test-impact handling

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- The existing `_seedMap` already has 9 entries with the `{de, en, deFullText, enFullText}` shape — extend in place.
- `Mulberry32` deterministic PRNG already drives the generator; new sampling logic must use it (do not introduce `Math.random()`).
- Reference bundles (Aachen, Tübingen) demonstrate the multi-comorbidity pattern that synthetic bundles will start to approximate.

### Known pitfalls (carried forward)
- **Pitfall 3 (Phase 22):** `npm run build` catches Vite/rolldown dynamic-import breakage tests miss. Run after every commit.
- **Pitfall 6 (Phase 24):** Worktree Edit/Write tools may silently fail; fall back to `git apply` heredoc patches.
- **Bundle-edit hazard (new):** Regenerated bundles are 4 large JSON files; do not commit one without the other three. Use a single "regenerate" commit covering all 4 synthetic site bundles.

</code_context>

<deferred_ideas>
## Deferred Ideas

- **Smoking history** for AMD (KORA finding) — out of scope; would need a new `Observation` template
- **Retinopathy grading** (DR severity NPDR/PDR) — out of scope; needs a new SNOMED dimension
- **Fundus image / OCT image synthesis** — outside the data layer
- **Real-time terminology lookup** for the 5 new seed codes — would require enabling the Phase 25 server proxy with a real Ontoserver-style endpoint
- **Bundle-level FHIR profile validation** (MII KDS / ISiK) — large undertaking; defer to a v2.0 milestone
- **More than 4 synthetic sites** — out of scope (Phase 24 reduced roster intentionally)

</deferred_ideas>
