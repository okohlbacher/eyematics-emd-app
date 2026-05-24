---
phase: 33-cohort-builder-ux-advanced-filters
plan: "01"
subsystem: shared-cohort-foundation
tags: [shared, filter, tdd, settings, i18n, cohort]
dependency_graph:
  requires: []
  provides:
    - shared/qualityPredicates.ts (getTherapyStatus)
    - shared/types/fhir.ts (CohortFilter with preset + advanced fields)
    - shared/patientCases.ts (applyFilters with options param + 9 new predicates)
    - config/settings.yaml (crtImplausibleThresholdUm)
    - src/i18n/translations.ts (25 Phase 33 keys)
  affects:
    - src/pages/QualityPage.tsx (import replaced)
    - src/services/settingsService.ts (AppSettings + DEFAULTS extended)
tech_stack:
  added: []
  patterns:
    - guard-clause filter chain (shared/patientCases.ts)
    - options param for cross-boundary threshold injection (no getSettings in shared/)
    - lift-out module (qualityPredicates.ts)
key_files:
  created:
    - shared/qualityPredicates.ts
    - tests/cohortPresets.test.ts
  modified:
    - shared/types/fhir.ts
    - shared/patientCases.ts
    - src/pages/QualityPage.tsx
    - config/settings.yaml
    - src/services/settingsService.ts
    - src/i18n/translations.ts
decisions:
  - implausibleVisus predicate keeps null-visus cases (val != null guard inverted vs PATTERNS draft — null visus is a quality issue, should be visible)
  - therapyBreaker test data uses 2026-03-01/2026-05-01 dates to keep lastToNow < interrupterDays threshold
metrics:
  duration: "6 minutes"
  completed: "2026-05-22T08:20:47Z"
  tasks_completed: 4
  files_changed: 7
---

# Phase 33 Plan 01: Shared Foundation (qualityPredicates, CohortFilter, applyFilters, settings, i18n) Summary

**One-liner:** Lifted getTherapyStatus to shared/, extended CohortFilter with 9 new fields, extended applyFilters with 4 preset + 5 advanced predicates via options param, added crtImplausibleThresholdUm to settings.yaml + AppSettings, and registered all 25 Phase 33 i18n keys.

## What Was Built

This plan delivers the shared foundation that every downstream Phase 33 plan depends on:

1. **shared/qualityPredicates.ts** — New module containing `export function getTherapyStatus` lifted verbatim from QualityPage.tsx, enabling shared/patientCases.ts to use it without a cross-boundary import.

2. **Extended CohortFilter** — `shared/types/fhir.ts` CohortFilter gains: `preset` (union of 4 literal values), `flaggedCaseIds` (Set<string>), `diagnosisSubtype`, `hasComorbidity`, `hba1cRange`, `medicationCodes`, `laterality` (OD/OS/OU).

3. **Extended applyFilters** — `shared/patientCases.ts` applyFilters gains an optional `options` parameter (therapyInterrupterDays, therapyBreakerDays, crtImplausibleThresholdUm) with safe fallbacks; adds 4 preset guard-clauses and 5 advanced-attribute guard-clauses. No import from `../src` — cross-boundary clean.

4. **Settings** — `config/settings.yaml` carries `crtImplausibleThresholdUm: 400`; `AppSettings` interface + DEFAULTS updated.

5. **i18n** — 25 Phase 33 keys registered in translations.ts (6 cohortValidation, 5 cohortPresets, 14 advancedFilters, 1 reviewImplausibleCrt).

6. **Tests** — `tests/cohortPresets.test.ts` — 20 pure-function Vitest tests covering all 4 preset behaviors + no-preset passthrough + all 5 advanced-attribute behaviors.

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Lift getTherapyStatus | 58a6d37 | shared/qualityPredicates.ts, src/pages/QualityPage.tsx |
| 2a RED | Failing preset/advanced tests | c04668e | tests/cohortPresets.test.ts |
| 2a+2b GREEN | Preset + advanced predicates | decd006 | shared/patientCases.ts, shared/types/fhir.ts, tests/cohortPresets.test.ts |
| 4 | Settings + i18n | 40c042f | config/settings.yaml, src/services/settingsService.ts, src/i18n/translations.ts |

## Verification

- `npm run build` — green (no cross-boundary import errors)
- `npm run test -- cohortPresets --run` — 20/20 pass
- `npm run test:ci` — 848/848 pass (828 baseline + 20 new)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] implausibleVisus predicate logic corrected**
- **Found during:** Task 2a GREEN
- **Issue:** PATTERNS draft had `if (val == null || (val >= 0 && val <= 1)) return false` — this would EXCLUDE null-visus cases (returning false when val is null), but the spec says "returns cases whose latest Visus is null OR outside 0-1". Null visus is a quality concern and should be returned.
- **Fix:** Changed to `if (val != null && val >= 0 && val <= 1) return false` — keeps null-visus cases in the filtered set.
- **Files modified:** shared/patientCases.ts
- **Commit:** decd006

**2. [Rule 1 - Bug] therapyBreaker test fixture used stale injection dates**
- **Found during:** Task 2a GREEN (test failure analysis)
- **Issue:** `activeCase2` used `2024-03-01` as the last injection date. The `lastToNow` calculation in getTherapyStatus uses `Date.now()` — as of 2026-05-22, that last injection is ~812 days ago, making the case a breaker rather than an active case as intended.
- **Fix:** Updated test fixture to use `2026-03-01` / `2026-05-01` so lastToNow is ~21 days, well within the 120-day interrupter threshold.
- **Files modified:** tests/cohortPresets.test.ts
- **Commit:** decd006

## Decisions Made

- **options param over getSettings injection:** shared/ cannot import src/ services. Threshold values (therapyInterrupterDays, therapyBreakerDays, crtImplausibleThresholdUm) are passed as an optional third parameter to applyFilters. Callers in src/ supply `getSettings()` values; callers in tests supply inline values. Safe fallbacks (120, 365, 400) prevent crashes when options is omitted.
- **Full CohortFilter type in Task 2a:** Both the 4 preset fields (preset, flaggedCaseIds) and 5 advanced fields (diagnosisSubtype, hasComorbidity, hba1cRange, medicationCodes, laterality) were added to the type in a single edit to avoid a second type-file touch in Task 2b, per plan instruction.

## Known Stubs

None — this plan is interface/logic only with no UI rendering surfaces.

## Threat Flags

No new network endpoints, auth paths, or file access patterns introduced. T-33-01 and T-33-02 from the plan's threat model are both accepted: preset is a TypeScript literal union (non-matching values fall through unfiltered), and crtImplausibleThresholdUm is a clinical integer (not a secret).

## Self-Check: PASSED

All 9 created/modified files found on disk. All 4 task commits verified in git log.
