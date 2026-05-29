---
phase: 40-savedsearch-quality-config
plan: "03"
subsystem: quality-review
tags: [quality, cohort-scope, qualityParams, QUAL-020, tdd]

# Dependency graph
requires:
  - phase: 40-02
    provides: "shared/qualityParams.ts — resolveQualityParams; SavedSearch.qualityParams optional field"
provides:
  - "QualityCaseDetail.activeQualityParams prop — gates anomaly checks via resolveQualityParams (fallback all)"
  - "QualityPage cohort-scope selector — applyFilters scoped cases + activeQualityParams threaded to detail"
  - "i18n: qualityCohortScopeLabel, qualityCohortScopeAll (de+en)"
  - "tests/qualityCohortScope.test.tsx — 9 behavior tests (scope restriction + qualityParams gating)"
affects:
  - "Quality review UX: reviewer can focus on a single cohort; checks match cohort's persisted selection"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cohort scope as a page-level useMemo (scopedCases) feeding the full filteredCases pipeline — no useEffect"
    - "activeQualityParams derived from selectedCohortId via useMemo — tri-state pass-through to child"
    - "Cohort selector placed on-page (not in QualityCaseList) to minimize prop churn"
    - "resolveQualityParams(activeQualityParams) in anomalies useMemo — Set membership guard per check"
    - "TDD: implementation-then-test order (Tasks 1+2 implemented first; Task 3 verified behavior)"

key-files:
  created:
    - tests/qualityCohortScope.test.tsx
  modified:
    - src/components/quality/QualityCaseDetail.tsx
    - src/pages/QualityPage.tsx
    - src/i18n/translations.ts

key-decisions:
  - "On-page cohort select (not threaded through QualityCaseList): minimizes QualityCaseList prop surface; select placed above summary cards for visibility"
  - "scopedCases feeds caseStatus, statusCounts, therapyStatuses, centerNames, filteredCases — summary counts reflect scope-relative percentages"
  - "activeQualityParams passes raw qualityParams from the SavedSearch; resolveQualityParams() called inside QualityCaseDetail's useMemo — keeps the tri-state logic in the canonical location"
  - "Selecting a cohort resets selectedCase to null — prevents a previously-selected case from showing in the detail panel when it's outside the new scope"

# Metrics
duration: ~7min
completed: 2026-05-25
---

# Phase 40 Plan 03: QUAL-020 Cohort-Scoped Quality Review Summary

**QualityPage can scope the review to a selected cohort/subcohort (via applyFilters) and honor that cohort's qualityParams (resolveQualityParams; fallback all when absent). Live Phase 39 thresholds reused unchanged.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-25T21:22:30Z
- **Completed:** 2026-05-25T21:29:09Z
- **Tasks:** 3 (3 commits)
- **Files modified:** 3, created: 1

## Accomplishments

- Extended `src/components/quality/QualityCaseDetail.tsx`: added optional `activeQualityParams?: string[]` prop; imported `resolveQualityParams` from `shared/qualityParams`; rewrote anomalies useMemo to resolve effective key set via `resolveQualityParams(activeQualityParams)` then gate each of the six checks with `activeKeys.has(key)`. `activeQualityParams` added to useMemo dependency array. Phase 39 threshold accessors untouched.

- Extended `src/pages/QualityPage.tsx`: destructured `savedSearches` from useData; added `selectedCohortId` state (default `'all'`); added `scopedCases` useMemo (applyFilters with getSettings() options when cohort selected, else full `cases`); added `activeQualityParams` useMemo (raw qualityParams from selected SavedSearch or undefined); re-wired `caseStatus`, `statusCounts`, `therapyStatuses`, `centerNames`, `filteredCases` to consume `scopedCases`; updated `QualityCaseList` `cases` prop to `scopedCases`; added `activeQualityParams` to `QualityCaseDetail`; rendered cohort select above summary cards with reset of selectedCase on scope change.

- Added i18n keys `qualityCohortScopeLabel` + `qualityCohortScopeAll` (de+en) to `src/i18n/translations.ts`.

- Created `tests/qualityCohortScope.test.tsx`: 9 vitest/RTL tests, no jest-dom. Covers: qualityParams=['missingVisus'] suppresses crtCritical+missingInjections; qualityParams=undefined runs all applicable checks; qualityParams=[] suppresses all; subset ['crtCritical','missingVisus'] gates exactly those two; cohort scope restricts visible case list; 'all' restores global view; selector shows saved search names as options.

## Task Commits

1. **Task 1 — QualityCaseDetail activeQualityParams** — `90be06a` (feat)
2. **Task 2 — QualityPage cohort-scope selector + i18n** — `99673e1` (feat)
3. **Task 3 — Behavior tests** — `8282944` (test)

## Files Created/Modified

- `src/components/quality/QualityCaseDetail.tsx` — activeQualityParams prop; resolveQualityParams import; six gated anomaly checks
- `src/pages/QualityPage.tsx` — savedSearches destructure; scopedCases/activeQualityParams useMemos; cohort select; summary + list use scoped set
- `src/i18n/translations.ts` — qualityCohortScopeLabel, qualityCohortScopeAll (de+en)
- `tests/qualityCohortScope.test.tsx` — 9 behavior tests (QUAL-020)

## Decisions Made

- **On-page cohort select:** Placed on QualityPage directly (not in QualityCaseList) to avoid adding 3 new props to QualityCaseList. Comment in source documents this choice.
- **scopedCases drives all derivations:** caseStatus, statusCounts, therapyStatuses, centerNames, filteredCases all consume scopedCases — summary card percentages reflect scoped set, not global total.
- **selectedCase reset on scope change:** Prevents showing a case in the detail panel that's no longer in the scoped set. Uses `setSelectedCase(null)` in the onChange handler.

## Deviations from Plan

- **[Rule 1 - Bug] Test fixture used wrong LOINC_VISUS code ('79893-4' instead of '79880-1'):** Caught during test execution; corrected the fixture constant to match shared/fhirCodes.ts. No production code affected.

- **Test fixture simplified:** The plan described "a case with no Visus obs but a critical CRT and a Visus jump" — a Visus jump requires Visus observations, which contradicts "no Visus obs". The fixture was designed as: no Visus (triggers missingVisus), critical CRT (triggers crtCritical), no IVOM (triggers missingInjections). This covers the key assertion that qualityParams gating suppresses non-selected checks. The `visusJump` check is exercised via the `qualityParams=undefined` fallback path.

## Known Stubs

None — qualityParams flows end-to-end: SavedSearch.qualityParams → QualityPage.activeQualityParams → QualityCaseDetail → resolveQualityParams → gated anomaly checks.

## Threat Flags

None — all STRIDE threats from the plan's threat model accepted per plan:
- T-40-11: resolveQualityParams only matches known keys — stray values cannot enable unknown checks
- T-40-12: applyFilters only narrows the already-center-scoped DataContext cases — cannot widen access
- T-40-13: savedSearches are per-user scoped at the API

## Self-Check: PASSED

- `src/components/quality/QualityCaseDetail.tsx` — FOUND (contains activeQualityParams, resolveQualityParams)
- `src/pages/QualityPage.tsx` — FOUND (contains scopedCases, activeQualityParams, qualityCohortScopeLabel)
- `src/i18n/translations.ts` — FOUND (contains qualityCohortScopeLabel, qualityCohortScopeAll)
- `tests/qualityCohortScope.test.tsx` — FOUND
- Commits 90be06a, 99673e1, 8282944 — confirmed in git log
- `npm run test:ci` — 1008/1008 passed

---
*Phase: 40-savedsearch-quality-config*
*Completed: 2026-05-25*
