---
phase: 33-cohort-builder-ux-advanced-filters
plan: 02
subsystem: cohort-builder-ux
tags: [validation, persistence, sessionStorage, safe-pick, thresholds]
dependency_graph:
  requires: [33-01]
  provides: [COH-01, COH-02]
  affects: [CohortBuilderPage, AuthContext, AnalysisPage, OutcomesView]
tech_stack:
  added: []
  patterns:
    - IIFE-derived validation (no useState for errors)
    - sessionStorage lazy-initializer with safePickCohortFilter whitelist
    - useEffect write-on-change with empty-filter removal
    - getSettings() filterOptions passed to all applyFilters call sites
key_files:
  created:
    - tests/cohortBuilderValidation.test.tsx
    - tests/cohortFilterPersistence.test.tsx
  modified:
    - src/pages/CohortBuilderPage.tsx
    - src/context/AuthContext.tsx
    - src/pages/AnalysisPage.tsx
    - src/components/outcomes/OutcomesView.tsx
decisions:
  - "Empty filter object removes sessionStorage key rather than writing {} — keeps Reset clean"
  - "validFilters memo excludes invalid fields so live results update from remaining valid filters (D-03)"
  - "filterOptions useMemo with [] deps in OutcomesView — getSettings() is a stable singleton"
  - "flaggedCaseIds Set serialized as string[] in useEffect before JSON.stringify"
metrics:
  duration: ~20 minutes
  completed: "2026-05-22T08:33:00Z"
  tasks_completed: 3
  files_changed: 6
---

# Phase 33 Plan 02: Inline Validation, Filter Persistence, and Consumer Updates Summary

COH-01 inline numeric validation blocks Save on invalid age/Visus/CRT inputs; COH-02 sessionStorage persistence survives navigation with logout-clear (D-05); AnalysisPage and OutcomesView safe-pick Phase 33 CohortFilter fields and pass getSettings() thresholds to applyFilters.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | COH-01 inline numeric validation | 088d169 | CohortBuilderPage.tsx, tests/cohortBuilderValidation.test.tsx |
| 2 | COH-02 sessionStorage persistence + Reset + logout clear | 5d7a7f2 | CohortBuilderPage.tsx, AuthContext.tsx, tests/cohortFilterPersistence.test.tsx |
| 3 | Safe-pick + threshold-passing in AnalysisPage + OutcomesView | f9768d0 | AnalysisPage.tsx, OutcomesView.tsx |

## What Was Built

### Task 1: COH-01 Inline Validation

Removed four `Math.max(0, Number(...))` silent-clamp expressions from the age-min, age-max, CRT-min, CRT-max `onChange` handlers. Replaced with raw numeric value setting (skips `setFilters` on NaN to avoid live results freezing, per D-03).

Added three render-time IIFE-derived validation values:
- `ageError`: checks `isNaN`, `< 0`, and lower-exceeds-upper for `filters.ageRange`
- `visusError`: parses `visusMinText`/`visusMaxText` strings directly (NOT `filters.visusRange`) — checks `> 1` and lower-exceeds-upper
- `crtError`: checks `isNaN`, `< 0`, and lower-exceeds-upper for `filters.crtRange`

`hasAnyFilterError = !!(ageError || visusError || crtError)` extends the Save disabled gate.

`validFilters` memo excludes the field with the error from `applyFilters` so live results continue updating from valid filters (D-03 non-interference).

Each error renders as `<p role="alert" className="mt-1 text-xs px-2 py-1.5 rounded border bg-red-50 ...">` directly below the min-max pair.

### Task 2: COH-02 Persistence

`filters` useState converted to lazy initializer that reads `sessionStorage.getItem('emd-cohort-filters')` inside try/catch, JSON.parses, and passes through `safePickCohortFilter` (whitelist for all Phase 33 fields; `flaggedCaseIds` reconstructed as `Set` from `string[]`; `preset` validated against four literals; corrupt/wrong-shape values return `{}`).

`useEffect([filters])` writes `JSON.stringify` to the key; converts `flaggedCaseIds` Set to array first; removes key entirely when `filters` is empty (so Reset leaves no residue).

Reset button updated: `setFilters({})` + `setVisusMinText('')` + `setVisusMaxText('')` + `sessionStorage.removeItem('emd-cohort-filters')`.

`AuthContext.performLogout`: `sessionStorage.removeItem('emd-cohort-filters')` added immediately after `removeItem('emd-token')` (D-05 / T-33-03).

### Task 3: AnalysisPage + OutcomesView Consumer Updates

**AnalysisPage**: imported `getSettings`; extended inline safe-pick (lines 100-118) with all Phase 33 fields (same whitelist pattern); applyFilters call now passes `{ therapyInterrupterDays, therapyBreakerDays, crtImplausibleThresholdUm }` from `getSettings()`.

**OutcomesView**: added `getSettings` to import; extended `safePickFilter` function with Phase 33 fields; added `filterOptions` useMemo computed once from `getSettings()`; all four `applyFilters` call sites (lines 172, 177, 385, 407) pass `filterOptions`.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

### Minor Adjustments

**1. [Rule 2 - Critical Correctness] useEffect removes key when filters empty**
- **Found during:** Task 2 implementation
- **Issue:** After Reset, `setFilters({})` triggers the write useEffect, which would write `{}` back — making `sessionStorage.getItem(STORAGE_KEY)` return `"{}"` instead of `null`, breaking the test assertion and the plan requirement
- **Fix:** useEffect checks `Object.keys(filters).length === 0` and calls `removeItem` instead of `setItem` when filters is empty
- **Files modified:** src/pages/CohortBuilderPage.tsx
- **Commit:** 5d7a7f2

**2. [Rule 2 - useMemo deps] Added filterOptions to OutcomesView memo dependency arrays**
- **Found during:** Task 3 implementation
- **Issue:** Three memos that now use `filterOptions` were missing it from their dependency arrays
- **Fix:** Added `filterOptions` to deps of `cohort` memo, `crossCohortData` memo, and `patientCounts` memo
- **Files modified:** src/components/outcomes/OutcomesView.tsx
- **Commit:** f9768d0

## Test Results

| Test File | Tests | Status |
|-----------|-------|--------|
| cohortBuilderValidation.test.tsx | 10 | GREEN |
| cohortFilterPersistence.test.tsx | 8 | GREEN |
| Full suite (npm run test:ci) | 871 | GREEN |

## Known Stubs

None — all functionality wired end-to-end.

## Threat Surface Scan

No new network endpoints or auth paths introduced. sessionStorage access is bounded to the existing emd-* key namespace. T-33-03 and T-33-04 mitigations implemented as planned:
- T-33-03: logout clear in AuthContext (D-05)
- T-33-04: safePickCohortFilter whitelist + JSON.parse try/catch on read

## Self-Check: PASSED

Files confirmed:
- tests/cohortBuilderValidation.test.tsx — FOUND
- tests/cohortFilterPersistence.test.tsx — FOUND
- src/pages/CohortBuilderPage.tsx — modified (safePickCohortFilter, lazy useState, useEffect, validation, Reset)
- src/context/AuthContext.tsx — modified (removeItem emd-cohort-filters in performLogout)
- src/pages/AnalysisPage.tsx — modified (getSettings import, safe-pick extended, filterOptions)
- src/components/outcomes/OutcomesView.tsx — modified (getSettings import, safePickFilter extended, filterOptions)

Commits confirmed:
- 088d169 — feat(33-02): COH-01 inline numeric validation blocking Save
- 5d7a7f2 — feat(33-02): COH-02 sessionStorage filter persistence + Reset + logout clear
- f9768d0 — feat(33-02): safe-pick Phase 33 fields + getSettings() thresholds in AnalysisPage and OutcomesView
