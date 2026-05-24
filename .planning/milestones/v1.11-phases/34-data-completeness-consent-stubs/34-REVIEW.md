---
phase: 34-data-completeness-consent-stubs
reviewed: 2026-05-24T18:15:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - shared/types/fhir.ts
  - shared/patientCases.ts
  - src/services/fhirLoader.ts
  - src/pages/LandingPage.tsx
  - src/i18n/translations.ts
  - scripts/generate-center-bundle.ts
  - scripts/augment-reference-bundles.ts
  - scripts/audit-bundle-codes.mjs
  - scripts/verify-bundle-distributions.mjs
  - config/settings.yaml
  - tests/stubIsolation.test.ts
  - tests/datenvollstaendigkeitCard.test.tsx
  - tests/augmentReferenceBundles.test.ts
findings:
  critical: 0
  warning: 5
  info: 5
  total: 10
status: issues_found
---

# Phase 34: Code Review Report

**Reviewed:** 2026-05-24T18:15:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 34 adds FHIR Consent resources and zero-Observation stub Patients to both
synthetic (`generate-center-bundle.ts`) and curated (`augment-reference-bundles.ts`)
bundles, plus a Data Completeness card on the landing page driven by
`cases.length / countRawPatients(bundles)`.

The **central H2 stub-isolation invariant holds**. I verified end-to-end that:
stubs carry no Observations, `extractPatientCases` (the single chokepoint) filters
zero-Observation patients, no Observation references a stub, `extractCenters`
`patientCount` excludes stubs, stub `Encounter` resources never reach
`useCaseData.totalEncounters` (which is derived from per-case observations+procedures,
not FHIR Encounter resources), and the verifier classifies stubs as non-cohort so
they cannot pollute distribution priors. PRNG generation is byte-identical on
regeneration, and the synthetic-bundle distribution verifier passes. No duplicate
Patient IDs exist across bundles, so the completeness denominator is accurate.

No BLOCKER-class defects (no stub leak, no injection, no data-loss path) were found.
The findings below are robustness, idempotency-robustness, and stale-artifact
quality issues. The most material is the tight HbA1c-count margin (WR-01) and the
non-robust idempotency guard (WR-02).

## Warnings

### WR-01: DME HbA1c minimum count sits exactly on the verifier threshold

**File:** `scripts/generate-center-bundle.ts:261-308` (`emitHbA1c`)
**Issue:** `emitHbA1c` picks `target = seededRandInt(rand, 2, 5)` then
`readingCount = min(target, visitDates.length)`, and fills distinct visit indices
under a `guard < 200` cap. The distribution verifier asserts every DME patient has
`>= 2` HbA1c Observations (`THRESHOLDS.dmeHba1cMin = 2`). Measured across all four
synthetic seeds, the minimum produced is **exactly 2** — there is zero slack. Any
future change to seeds, patient counts, `ivi` ranges, or the `dme` cohort mix can
silently push a low-visit DME patient below 2 and break `npm run verify:bundles`.
The risk compounds because `readingCount` is capped by `visitDates.length`
(`ivomCount + 1`, and `ivomCount` can be as low as 1, giving only 2 visit dates),
so a single unlucky `target=2` with index collisions under the guard could yield 1.
**Fix:** Make the floor explicit and seed-independent instead of relying on the
sampled `target`:
```ts
// Guarantee the >=2 verifier invariant regardless of seed/visit count.
const target = seededRandInt(rand, 2, 5);
const readingCount = Math.min(Math.max(target, 2), Math.max(visitDates.length, 2));
// ...and ensure visitDates.length >= 2 for DME, or emit synthetic interim dates
// rather than depending on ivomCount producing enough visits.
```

### WR-02: Idempotency guard is not robust to partially-augmented bundles

**File:** `scripts/augment-reference-bundles.ts:152-159, 184-198, 201`
**Issue:** The idempotency guard skips augmentation if *any* `Consent` entry exists.
Consents and stubs are appended in the same in-memory `bundle.entry` array and
flushed in one `writeFileSync`. If a prior run is interrupted after the array is
mutated but the process is killed before the single write completes, the file on
disk is unchanged (acceptable). But the guard keys solely on Consent presence: if a
bundle ever reaches a state with stubs but no Consents (e.g. hand-edited fixture,
or a future refactor that writes in two passes), a re-run will append a **second**
full set of stubs while the Consent count looks like a fresh bundle, silently
doubling stub Patients/Encounters and corrupting the documented `[2,8]` stub ratio.
**Fix:** Guard on the union of augmentation markers, not just Consent:
```ts
const alreadyAugmented = bundle.entry.some(
  (e) =>
    e.resource.resourceType === 'Consent' ||
    (e.resource.resourceType === 'Patient' && e.resource.id?.includes('-stub-')),
);
```

### WR-03: Stub generation reads hardcoded factor range, not config/settings.yaml

**File:** `scripts/generate-center-bundle.ts:640-643`, `scripts/augment-reference-bundles.ts:191`, `config/settings.yaml:4-6`
**Issue:** Both generators draw the stub factor with `seededRandInt(rand, 2, 8)`,
the bounds inlined as magic numbers. The comments explicitly claim the values are
"sourced from config/settings.yaml stubs section (D-11)" / "mirror
config/settings.yaml stubs.factorMin / stubs.factorMax", but neither script reads
`config/settings.yaml` — the `stubs.factorMin/factorMax` keys exist but are never
loaded. CLAUDE.md states `config/settings.yaml` is the single config source. The
comment asserts a coupling that does not exist in code, so editing the YAML has no
effect and the two scripts plus the verifier (`verify-bundle-distributions.mjs:51-52`)
can drift apart silently.
**Fix:** Either load the bounds from `config/settings.yaml` at script start
(preferred per CLAUDE.md), or, if intentionally decoupled for the build-time
generators, replace the misleading "sourced from / mirror config" comments with an
honest "must be kept in sync manually with config/settings.yaml stubs.* and
verify-bundle-distributions.mjs THRESHOLDS" note and extract a single shared
constant module both scripts import.

### WR-04: `pickDrugFromCdf` and CDF templates can silently drop the last bucket

**File:** `scripts/generate-center-bundle.ts:240-246, 209-237`
**Issue:** `pickDrugFromCdf` returns the first entry where `r <= entry.p` and falls
back to the last entry. The CDF tables end at `p: 1.00`, so the loop always matches.
However the fallback masks a class of authoring bugs: if a future edit makes the
final entry `p < 1.0` (e.g. a typo `0.99`), draws in `(0.99, 1.0]` would silently
fall through to the `cdf[length-1]` fallback rather than failing — making the
intended probabilities wrong with no error. There is no assertion that the CDF
terminates at 1.0 (compare the explicit `cohortMix` sum check at line 330-333).
**Fix:** Add a one-time invariant check that each `drugs` CDF ends at `p === 1`,
mirroring the cohortMix guard:
```ts
for (const [k, t] of Object.entries(TEMPLATES)) {
  if (Math.abs(t.drugs[t.drugs.length - 1]!.p - 1) > 1e-9) {
    throw new Error(`TEMPLATES.${k}.drugs CDF must end at p=1.0`);
  }
}
```

### WR-05: `extractCenters.lastUpdated` mis-resolves for multi-Organization bundles

**File:** `src/services/fhirLoader.ts:57-74`
**Issue:** `extractCenters` maps each `Organization` to a center, resolving
`lastUpdated` via `bundles.find((b) => b.entry.some((e) => e.resource.id === org.id))`.
The match is by `resource.id === org.id`, but a synthetic Blaze bundle (filtered
server-side by `Patient.meta.source`) can contain Patients from multiple centers
while carrying a single bundle-level `meta.lastUpdated`. If two Organizations live
in one bundle, both resolve to the *same* bundle `lastUpdated`, and if an Org id
collides with any other resource id the `.find` could match the wrong bundle. For
the current one-Org-per-file layout this is benign, but the code silently assumes
a 1:1 org-to-bundle relationship that the rest of the codebase
(`filterBundlesByCenters`, `buildCaseIndex`) explicitly does not.
**Fix:** Resolve the bundle by Organization membership, not raw id equality, and
document the 1-Org-per-bundle assumption — or derive `lastUpdated` from the bundle
that actually contains the Org resource:
```ts
const bundle = bundles.find((b) =>
  b.entry.some((e) => e.resource.resourceType === 'Organization' && e.resource.id === org.id),
);
```

## Info

### IN-01: Stale "SKIPPED / RED" header and comments in active passing tests

**File:** `tests/datenvollstaendigkeitCard.test.tsx:5-9, 152-189`; `tests/stubIsolation.test.ts:4-11, 75-76`
**Issue:** The file headers and inline `SKIP_REASON:` comments describe these tests
as "INTENTIONALLY RED until Plan 02/04 lands" and "SKIPPED until Plan 04". The tests
are no longer `.skip`-ped and all pass (verified: 7/7 and 7/7). The comments now
actively misdescribe the test state and will mislead future readers debugging
failures.
**Fix:** Remove or update the obsolete "RED/SKIPPED until Plan NN" header blocks and
the per-test `SKIP_REASON:` lines now that the features have landed.

### IN-02: Unused `_MOCK_CASES` fixture

**File:** `tests/datenvollstaendigkeitCard.test.tsx:58-62`
**Issue:** `_MOCK_CASES` is declared (underscore-prefixed to dodge unused-var lint)
but never referenced; `setupMocks` builds its own case array inline. Dead fixture.
**Fix:** Delete `_MOCK_CASES`.

### IN-03: Unreachable code after `process.exit`

**File:** `scripts/audit-bundle-codes.mjs:169-171`
**Issue:** `void root;` follows `process.exit(...)` and is unreachable. The comment
"Silence unused root in stricter linters" indicates `root` (line 148) is computed
but never used.
**Fix:** Remove the unused `root` declaration and the trailing `void root;` /
unreachable lines.

### IN-04: Cross-script stub/consent ID zero-padding inconsistency

**File:** `scripts/generate-center-bundle.ts:354, 648` vs `scripts/augment-reference-bundles.ts:53, 102`
**Issue:** The generator pads patient/stub numbers to 4 digits
(`pat-uka-0001`, `consent-uka-0001`), while `augment-reference-bundles.ts` derives
`patNum` from existing curated IDs (3-digit `pat-uka-001` → `consent-uka-001`) and
pads stub indices to 4 digits. The reference bundles are internally consistent and
the synthetic bundles are internally consistent, so there is no collision today,
but the two id schemes diverge and any future code that joins consents across both
bundle families by id pattern will need to handle both widths.
**Fix:** Document the intentional divergence, or normalize both scripts to a shared
id-formatting helper.

### IN-05: `birthDate`-to-`age` derivation uses two different year conventions

**File:** `scripts/generate-center-bundle.ts:379, 396-399` and `shared/patientCases.ts:110-119`
**Issue:** Generation computes `birthDate` via `addDays(baselineDate, -round(age*365.25) - jitter)`
and re-derives `ageAtBaseline` with a `365.25`-day divisor, while runtime `getAge`
uses calendar-field arithmetic (`getFullYear` diff with month/day correction). The
365.25 fudge plus `dayJitter` is a deliberate guard so computed age stays `>= sampledAge`,
but it couples the generator to an assumption about the runtime age function that is
not asserted anywhere. A change to `getAge` could quietly shift cohort age
distributions below verifier thresholds (AMD median `>= 70`).
**Fix:** Add a comment in `getAge` noting the generator depends on its
floor-at-or-above-sampled-age behavior, or add a generator self-check that
`getAge(birthDate)` on a fixed reference date equals the sampled age.

---

_Reviewed: 2026-05-24T18:15:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
