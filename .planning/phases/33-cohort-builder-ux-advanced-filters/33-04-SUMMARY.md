---
phase: 33-cohort-builder-ux-advanced-filters
plan: "04"
subsystem: quality-review-dashboard
tags: [dash-02, routing, deep-link, filter-seeding, tdd, crt]
dependency_graph:
  requires: [33-01]
  provides: [quality-crt-filter, crt-deep-link, corrected-crt-review-button]
  affects: [src/pages/QualityPage.tsx, src/components/quality/QualityCaseList.tsx, src/pages/LandingPage.tsx]
tech_stack:
  added: []
  patterns: [lazy-useState-url-seeding, filteredCases-memo-extension, props-interface-extension]
key_files:
  created: []
  modified:
    - src/pages/QualityPage.tsx
    - src/components/quality/QualityCaseList.tsx
    - src/pages/LandingPage.tsx
    - tests/qualityPageDeepLink.test.tsx
    - tests/landingPageAlerts.test.tsx
    - tests/LandingPage.test.tsx
decisions:
  - "filterCrt uses lazy useState seeding from searchParams.get('crt') — same pattern as filterStatus/filterTherapy to avoid double-render flash"
  - "showFilters includes crt param check per RESEARCH Pitfall 6 — panel must auto-open on CRT deep-link"
  - "filteredCases CRT clause uses val <= threshold (not <) so threshold value is excluded as implausible boundary"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-22T08:30:22Z"
  tasks_completed: 2
  files_changed: 6
---

# Phase 33 Plan 04: DASH-02 CRT Review Routing Fix Summary

**One-liner:** CRT Review button re-routed from wrong `/quality?status=flagged` to `/quality?crt=implausible`; QualityPage seeds and applies the CRT filter from URL param via lazy useState + filteredCases memo clause.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | QualityPage CRT URL-param seeding + filter clause | 088d169 | QualityPage.tsx, QualityCaseList.tsx, tests/qualityPageDeepLink.test.tsx |
| 2 | LandingPage CRT Review button route + aria-label fix | 202e560, 7648726 | LandingPage.tsx, tests/landingPageAlerts.test.tsx, tests/LandingPage.test.tsx |

## Acceptance Criteria Verification

- [x] LandingPage CRT button navigates to `/quality?crt=implausible` with `aria-label={t('reviewImplausibleCrt')}`
- [x] `grep -c "status=flagged" src/pages/LandingPage.tsx` returns 0
- [x] Therapie-Abbrecher button unchanged (`/quality?therapy=breaker`)
- [x] QualityPage.tsx contains `filterCrt` lazy useState reading `searchParams.get('crt')`
- [x] `showFilters` initializer includes `searchParams.get('crt') !== null`
- [x] `filteredCases` memo has a `filterCrt` clause using `getSettings().crtImplausibleThresholdUm` and `LOINC_CRT`
- [x] QualityCaseList props include `filterCrt` and `onFilterCrtChange`; CRT select rendered in filter panel
- [x] `npm run test -- qualityPageDeepLink --run` exits 0 (8/8)
- [x] `npm run test -- landingPageAlerts --run` exits 0 (3/3)
- [x] Full suite: 870/871 tests pass (1 unrelated failure in cohortFilterPersistence from parallel plan 33-02)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PatientCase test fixtures missing `procedures` field**
- **Found during:** Task 1 RED phase
- **Issue:** `getTherapyStatus` in `shared/qualityPredicates.ts` accesses `pc.procedures.filter(...)` — the minimal test-case fixtures did not include a `procedures: []` array, causing `TypeError: Cannot read properties of undefined (reading 'filter')`
- **Fix:** Added `procedures: []` to both `highCrtCase` and `lowCrtCase` fixtures in `qualityPageDeepLink.test.tsx`
- **Files modified:** `tests/qualityPageDeepLink.test.tsx`
- **Commit:** 088d169

**2. [Rule 1 - Bug] Second LandingPage test file also asserted old CRT route**
- **Found during:** Task 2 GREEN phase (full suite run)
- **Issue:** `tests/LandingPage.test.tsx` (a separate test file from `tests/landingPageAlerts.test.tsx`) also contained 3 assertions using `translate('reviewFlaggedCases', 'en')` — the old aria-label — which broke after the LandingPage fix
- **Fix:** Updated 3 occurrences in `tests/LandingPage.test.tsx` from `reviewFlaggedCases` to `reviewImplausibleCrt`; updated test title to reflect corrected route
- **Files modified:** `tests/LandingPage.test.tsx`
- **Commit:** 7648726

## Threat Model Compliance

| Threat ID | Mitigation | Status |
|-----------|------------|--------|
| T-33-08 | `filterCrt` set ONLY to literal `'implausible'` when param exactly equals `'implausible'`, else `'all'` — no other value reflected to DOM | Applied |
| T-33-09 | Navigate targets are hard-coded literal paths; no user input interpolated | Applied |

## Known Stubs

None — all CRT filter functionality is fully wired.

## Self-Check: PASSED

- `src/pages/QualityPage.tsx` — modified with `filterCrt` state and memo clause
- `src/components/quality/QualityCaseList.tsx` — modified with `filterCrt` prop and CRT select
- `src/pages/LandingPage.tsx` — modified with corrected CRT button route
- Commits 088d169, 202e560, 7648726 verified in git log
