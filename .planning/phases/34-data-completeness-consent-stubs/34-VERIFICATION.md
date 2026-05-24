---
phase: 34-data-completeness-consent-stubs
verified: 2026-05-24T18:26:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 34: Data Completeness — Consent + Stubs Verification Report

**Phase Goal:** The dashboard surfaces the fraction of patients with research consent (Datenvollzähligkeit) via a consent + patient-stub model, with stubs strictly isolated from all clinical surfaces.
**Verified:** 2026-05-24T18:26:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Synthetic bundles contain FHIR Consent resources for all full patients; reference bundles (Aachen, Tübingen) have consent added WITHOUT regeneration (D-06) | VERIFIED | All 4 synthetic sites: 45 Consents each (one per patient). Aachen: 35 Consents / 35 full patients. Tübingen: 30 Consents / 30 full patients. Consent `status: 'active'`, full D-07 shape confirmed. Reference bundles verified via `augmentReferenceBundles.test.ts` byte-equality assertion (3/3 green). |
| 2 | Each synthetic site generates a configurable number of patient stubs (default ~4–5×, range [2,8]×) containing only encounter date, gender, and birth year — no clinical detail | VERIFIED | Chemnitz: 270 stubs (6×), Greifswald: 360 stubs (8×), Leipzig: 135 stubs (3×), Münster: 315 stubs (7×). Stub patient keys confirmed: `resourceType, id, meta, gender, birthDate` only — no `identifier`. Zero Observations/Conditions/Medications reference any stub. `config/settings.yaml` carries `stubs.factorMin: 2 / stubs.factorMax: 8`. Seeded via `seededRandInt(rand, stubFactorMin, stubFactorMax)` in `generate-center-bundle.ts`. |
| 3 | The dashboard shows total patient count (consented + stubs), consented count, and the Datenvollzähligkeit fraction; the metric updates correctly when the site filter changes | VERIFIED | `LandingPage.tsx` imports `countRawPatients` from `../services/fhirLoader`; computes `totalRawPatients = countRawPatients(bundles)` (denominator, stub-inclusive), `consentedPatients = cases.length` (numerator, stub-free via D-03), `completenessFraction = totalRawPatients > 0 ? consentedPatients / totalRawPatients : 0`. Card renders `{completenessPercent} %` and `{n} / {m} patients` sub-label. Existing `totalPatients = cases.length` line unchanged. 4 i18n keys present. `tests/datenvollstaendigkeitCard.test.tsx`: 7/7 green. |
| 4 | Stub isolation (H2): stubs do NOT appear in cohort building, outcomes/trajectories, quality review, case detail, or charts; stubs are site-attributed; FHIR load + >1000-patient aggregation routing show no regression | VERIFIED | Single-chokepoint filter at `extractPatientCases` (line 85 of `shared/patientCases.ts`): `clinicalPatients = patients.filter(pat => (observationsByRef.get(...) ?? []).length > 0)`. No tag/profile/extension check — absence of Observations = stub (D-01). All clinical consumers flow through this single function. `countRawPatients` takes no center-filter parameter — server-filtered bundles are the argument (Pitfall 3). Stub `meta.source = centerId` ensures site attribution. `tests/stubIsolation.test.ts`: 4/4 green. `npm run test:ci`: 901/901 green (no regression). |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/types/fhir.ts` | Consent and Encounter interfaces | VERIFIED | Both interfaces present, both extending `FhirResource`. Consent has `provision`, `scope`, `category`, `patient`, `organization`, `dateTime`, `policyRule`. Encounter has `serviceProvider`, `period`, `subject`. Neither wired into `PatientCase` or `extractPatientCases`. |
| `shared/patientCases.ts` | stub-exclusion filter at `extractPatientCases` (D-03) | VERIFIED | `clinicalPatients` filter at line 85, using `observationsByRef.get()` — purely structural, no tag/extension. Map iterates `clinicalPatients` not `patients`. |
| `src/services/fhirLoader.ts` | stub-excluding `patientCount` (D-04) + `countRawPatients` (D-09) | VERIFIED | `patientCount` now uses `orgPatients.filter(p => observations.some(o => o.subject.reference === 'Patient/'+p.id)).length`. `export function countRawPatients(bundles)` present, takes only `bundles`. |
| `scripts/augment-reference-bundles.ts` | Idempotent append-only Consent + stub augmentation for Aachen + Tübingen | VERIFIED | Idempotency guard at line 160: `alreadyAugmented = bundle.entry.some(...)`. Append-only: new entries pushed, pre-existing entries untouched. Seeds 70101 (Aachen) / 70116 (Tübingen). |
| `scripts/generate-center-bundle.ts` | Consent + stub emission for synthetic sites | VERIFIED | `stubFactor = seededRandInt(rand, stubFactorMin, stubFactorMax)` at line 675; `stubCount = Math.round(patients * stubFactor)`. All new rand() calls after full-patient loop. |
| `config/settings.yaml` | `stubs.factorMin` / `stubs.factorMax` | VERIFIED | `stubs: factorMin: 2, factorMax: 8` present. |
| `src/i18n/translations.ts` | 4 DE/EN i18n keys for the card | VERIFIED | `datenvollstaendigkeitCaption`, `datenvollstaendigkeitLabel`, `datenvollstaendigkeitPatients`, `datenvollstaendigkeitAriaLabel` — all 4 present with DE + EN. |
| `src/pages/LandingPage.tsx` | Datenvollzähligkeit summary card (D-08/D-09/D-10) | VERIFIED | `countRawPatients(bundles)` called; `completenessColor` uses CSS token variables (`var(--color-sage/amber/coral)`). Progress bar `role="progressbar"` with `aria-valuenow/min/max`. `ShieldCheck` with `aria-hidden="true"`. Card placed between KPI tiles and Centers row. |
| `tests/stubIsolation.test.ts` | D-03 + D-04 + D-09 regression tests | VERIFIED | 4/4 tests green. D-03: `pat-stub-001` excluded; D-04: `patientCount === 1`; D-09: `countRawPatients([bundle]) === 2`. |
| `tests/datenvollstaendigkeitCard.test.tsx` | completeness card render + site-filter tests | VERIFIED | 7/7 tests green, 0 `it.skip`, no `toBeInTheDocument`. |
| `tests/augmentReferenceBundles.test.ts` | D-13 byte-equality + idempotency | VERIFIED | 3/3 tests green, 0 `it.skip`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/types/fhir.ts` | `shared/types/fhir.ts` | `export *` barrel | VERIFIED | Consent and Encounter auto-flow through the existing barrel. |
| `extractPatientCases` | `observationsByRef` | filter patients with >0 observations | VERIFIED | `clinicalPatients` filter uses `observationsByRef.get()` at line 87. |
| `src/pages/LandingPage.tsx` | `countRawPatients` | `import from ../services/fhirLoader` + `countRawPatients(bundles)` call | VERIFIED | Import on line 19; call on line 67. |
| `src/pages/LandingPage.tsx` | `src/i18n/translations.ts` | `t('datenvollstaendigkeit...')` | VERIFIED | Four `t('datenvollstaendigkeit...')` calls present in card JSX. |
| `scripts/generate-center-bundle.ts` | `scripts/prng.ts` | `seededRandInt(rand, stubFactorMin, stubFactorMax)` | VERIFIED | `seededRandInt(rand, stubFactorMin, stubFactorMax)` at line 675. |
| `scripts/augment-reference-bundles.ts` | `public/data/center-aachen.json` | append-only write, `JSON.stringify(bundle, null, 2) + '\n'` | VERIFIED | Idempotency guard confirmed; `alreadyAugmented` check at line 160. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `src/pages/LandingPage.tsx` | `totalRawPatients` | `countRawPatients(bundles)` ← `useData().bundles` ← actual FHIR bundle JSON | Yes — `bundles.reduce(...)` counts all Patient entries | FLOWING |
| `src/pages/LandingPage.tsx` | `consentedPatients` | `cases.length` ← `useData().cases` ← `extractPatientCases(bundles)` (stub-filtered) | Yes — filtered real patient cases | FLOWING |
| `src/pages/LandingPage.tsx` | `completenessPercent` | Computed from `consentedPatients / totalRawPatients` | Yes — live ratio, updates with site filter | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Stub isolation: extractPatientCases excludes zero-Obs patients | `npx vitest run tests/stubIsolation.test.ts` | 4/4 passed | PASS |
| Completeness card renders correct fraction | `npx vitest run tests/datenvollstaendigkeitCard.test.tsx` | 7/7 passed | PASS |
| Reference bundle augmentation byte-identical + idempotent | `npx vitest run tests/augmentReferenceBundles.test.ts` | 3/3 passed | PASS |
| Synthetic bundle regeneration byte-stable (double-run) | `md5` on all 4 synthetic bundles before/after second `npm run generate-bundles` | Identical checksums | PASS |
| All 6 bundles: Consent count = full-patient count | Node inline check | Chemnitz 45/45, Greifswald 45/45, Leipzig 45/45, Münster 45/45, Aachen 35/35, Tübingen 30/30 | PASS |
| Stub ratio [2,8]× per synthetic site | Node inline check | Chemnitz 6×, Greifswald 8×, Leipzig 3×, Münster 7× | PASS |
| Stubs carry no clinical data (zero Obs/Cond/Med refs) | Node inline check | 0 Observations/Conditions/Medications reference stubs in Chemnitz | PASS |
| CI gates pass | `npm run audit:bundles` | 6 bundles, 31 codes, 0 unresolvable; all priors pass | PASS |
| Full test suite | `npm run test:ci` | 901/901 passing | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| DASH-01 | Plans 01–04 | Patient-stub + consent model for Datenvollzähligkeit, with H2 stub isolation | SATISFIED | All sub-bullets implemented: Consent for consented cohort, configurable stubs, dashboard fraction metric, stub exclusion from all clinical surfaces, site attribution, no performance regression. 901/901 tests green. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No `TBD`, `FIXME`, or `XXX` markers in any file modified by this phase. No stub implementations, placeholder returns, or empty handlers found in phase deliverables.

### Human Verification Required

None — all assertions are verifiable programmatically and the test suite is fully green.

### Gaps Summary

No gaps. All four ROADMAP success criteria are VERIFIED with direct codebase evidence.

---

_Verified: 2026-05-24T18:26:00Z_
_Verifier: Claude (gsd-verifier)_
