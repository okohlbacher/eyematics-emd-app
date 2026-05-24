---
phase: 34-data-completeness-consent-stubs
plan: 03
subsystem: data-generation
tags: [fhir, consent, stubs, bundle-generation, ci-gates, byte-stability]
dependency_graph:
  requires: [34-01, 34-02]
  provides: [full-bundle-data-with-consent-and-stubs, ci-gates-extended]
  affects: [public/data/center-*.json, scripts/generate-center-bundle.ts, scripts/augment-reference-bundles.ts, scripts/audit-bundle-codes.mjs, scripts/verify-bundle-distributions.mjs]
tech_stack:
  added: []
  patterns: [mulberry32-prng-append-after-patient-loop, idempotent-append-only-augmentation, per-bundle-stub-ratio-assertion]
key_files:
  created:
    - scripts/augment-reference-bundles.ts
  modified:
    - scripts/generate-center-bundle.ts
    - scripts/audit-bundle-codes.mjs
    - scripts/verify-bundle-distributions.mjs
    - config/settings.yaml
    - package.json
    - public/data/center-chemnitz.json
    - public/data/center-greifswald.json
    - public/data/center-leipzig.json
    - public/data/center-muenster.json
    - public/data/center-aachen.json
    - public/data/center-tuebingen.json
    - tests/augmentReferenceBundles.test.ts
    - tests/generateCenterBundle.test.ts
    - tests/datenvollstaendigkeitCard.test.tsx
decisions:
  - "New rand() calls placed strictly after full-patient loop (Pitfall 2 guard for byte-stability)"
  - "Stub birthDate uses YYYY-01-01 form (year-only, Claude's Discretion, D-02 minimal demographic)"
  - "Augmentation script uses fixed seeds 70101 (Aachen) / 70116 (Tübingen), distinct from synthetic seeds"
  - "generateCenterBundle.test.ts gains fullPatients() helper to exclude stubs from all clinical assertions"
  - "datenvollstaendigkeitCard.test.tsx smoke-test mock gains full PatientCase shape (observations/imagingStudies)"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-24"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 14
  files_created: 1
---

# Phase 34 Plan 03: Consent + Stub Generation Summary

Materialized FHIR Consent resources and patient stubs across all 6 site bundles — byte-stable synthetic regeneration and append-only reference augmentation — and extended both CI gates to cover the new resources.

## What Was Built

**Task 1 — Synthetic bundle generator extended (D-06/D-11/D-12)**

`scripts/generate-center-bundle.ts` extended to emit, after the full-patient loop:
- One active research `Consent` per full patient (45 per synthetic site) with D-07 shape
- A seeded stub factor `seededRandInt(rand, 2, 8)` → `stubCount = Math.round(patients * factor)` stub Patients + Encounters
- All new `rand()` calls placed AFTER the existing full-patient loop (Pitfall 2 guard; byte-identical regen verified by double-run diff)

Results per synthetic site: Chemnitz/Greifswald/Leipzig/Münster each have 45 Consents + seeded stubs (e.g. Chemnitz: factor=6, 270 stubs).

`config/settings.yaml` gains a `stubs:` section with `factorMin: 2` / `factorMax: 8` (D-11).

**Task 2 — Reference bundle augmentation script + green test (D-12/D-13)**

New `scripts/augment-reference-bundles.ts`:
- Idempotency guard: checks for any existing `Consent` entry before augmenting
- Append-only: pushes new entries, never mutates or reorders pre-existing curated resources
- Seeds: Aachen=70101, Tübingen=70116 (distinct from synthetic seeds 70103/70107/70112/70114)
- Results: Aachen 35 Consents + 210 stubs (factor=6), Tübingen 30 Consents + 240 stubs (factor=8)

`tests/augmentReferenceBundles.test.ts`: all 3 `.skip` removed; all 3 assertions pass (byte-identity, new-entries-appended, idempotency).

`package.json` gains `augment-reference-bundles` script.

**Task 3 — CI gates extended (D-14)**

`scripts/audit-bundle-codes.mjs`: added 3 Consent coding systems to `WHITELIST_SYSTEMS` (consentscope, v3-ActCode, v3-ActReason) — Pitfall 4 guard. Consent/Encounter not added to `interesting` set (correct: structural, not diagnosis resources).

`scripts/verify-bundle-distributions.mjs`: added `stubFactorMin: 2` / `stubFactorMax: 8` to `THRESHOLDS`; extended `aggregateBundle` to track full-vs-stub patient counts per bundle; added `verifyStubRatios()` with per-bundle assertion that `stubCount / fullCount` falls in `[2, 8]`.

Test suite fixes (deviation Rule 1):
- `tests/generateCenterBundle.test.ts`: added `fullPatients()` helper to exclude stubs (no `identifier`) from all clinical assertions; fixed `getPatients()` to use it
- `tests/datenvollstaendigkeitCard.test.tsx`: fixed mock `cases` to include `observations: []` / `imagingStudies: []` fields needed by LandingPage's existing reduce calls

## Verification Results

```
npm run audit:bundles → [audit:bundles] scanned 6 bundles, 31 distinct codes, 0 unresolvable
                      → [verify:bundles] scanned 4 bundles, 103 AMD (median age 74.0, comorbidity rate 65.0%), 53 DME — all priors pass
npm run test:ci       → 83 test files, 896 tests passed | 5 skipped
```

Double-run byte-stability: confirmed via `diff` on all 4 synthetic bundles.

Curated data integrity: `augmentReferenceBundles.test.ts` assertion 1 verifies all pre-existing entry IDs are byte-identical after augmentation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] generateCenterBundle.test.ts clinical assertions broke after stubs added**
- **Found during:** Task 3 (npm run test:ci)
- **Issue:** Tests filtering `resourceType === 'Patient'` now included stub patients (no Observations/Conditions/Medications referencing them), causing counts and clinical-property assertions to fail
- **Fix:** Added `fullPatients()` helper (excludes patients with no `identifier` array); updated `getPatients()` and all direct Patient filters in clinical tests to use it
- **Files modified:** tests/generateCenterBundle.test.ts
- **Commit:** d13816d

**2. [Rule 1 - Bug] datenvollstaendigkeitCard.test.tsx smoke test crashed LandingPage**
- **Found during:** Task 3 (npm run test:ci)
- **Issue:** Mock `cases` objects lacked `observations` and `imagingStudies` fields; LandingPage's existing reduce calls at lines 46-55 threw TypeError
- **Fix:** Added minimal `observations: []`, `imagingStudies: []`, and other PatientCase fields to the mock factory in `setupMocks()`
- **Files modified:** tests/datenvollstaendigkeitCard.test.tsx
- **Commit:** d13816d

**3. [Rule 1 - Bug] augmentReferenceBundles.test.ts "new entries" test failed on already-augmented source**
- **Found during:** Task 2 (after augmenting real bundles, test reads augmented file as source)
- **Issue:** Test 2 read the already-augmented `center-aachen.json`, captured ALL entry IDs as `curatedIds` (including Consent/stubs), then ran augmentation (which correctly skipped via idempotency guard), and found zero `newEntries`
- **Fix:** Added code to strip Consent/Encounter/stub Patient entries from the temp copy before running augmentation, so the test always starts from the original curated state
- **Files modified:** tests/augmentReferenceBundles.test.ts
- **Commit:** 8c0d5f0

## Known Stubs

None — all stub resources are intentional FHIR Patient/Encounter stubs as defined by D-02. They appear in bundles as designed. Stub isolation at `extractPatientCases` (D-03, Plan 02) ensures they never surface in clinical consumers.

## Threat Flags

No new security-relevant surface introduced. All mitigations from the plan's threat model implemented:
- T-34-06: append-only + idempotency guard + byte-equality test (D-13)
- T-34-07: stubs carry only gender + year-of-birth + one Encounter date (D-02)
- T-34-08: all PRNG draws seeded after patient loop; double-run byte-stability confirmed
- T-34-09: stub Patients carry `meta.source = centerId` for server-side center restriction

## Self-Check: PASSED

Files verified to exist:
- scripts/augment-reference-bundles.ts: FOUND
- public/data/center-aachen.json (augmented): FOUND
- public/data/center-tuebingen.json (augmented): FOUND

Commits verified:
- 536804b (Task 1): FOUND
- 8c0d5f0 (Task 2): FOUND
- d13816d (Task 3): FOUND
