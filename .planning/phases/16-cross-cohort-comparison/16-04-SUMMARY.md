---
phase: 16-cross-cohort-comparison
plan: "04"
subsystem: outcomes-view
tags: [routing, url-state, integration, cross-cohort]
dependency_graph:
  requires: ["16-02", "16-03"]
  provides: [cross-cohort-mode-integration, xcohort-url-state, compare-drawer-wiring]
  affects: [OutcomesView, OutcomesSettingsDrawer, OutcomesPanel]
tech_stack:
  added: []
  patterns: [useMemo-for-per-cohort-aggregation, url-as-state, react-router-searchParams]
key_files:
  created: []
  modified:
    - src/components/outcomes/OutcomesView.tsx
    - src/components/outcomes/OutcomesSettingsDrawer.tsx
    - tests/OutcomesViewRouting.test.tsx
decisions:
  - "Use isCrossMode flag derived from rawCohortsParam to gate all cross-cohort logic"
  - "crossCohortAggregates memo computes per-cohort trajectories client-side using applyFilters + computeCohortTrajectory/computeCrtTrajectory"
  - "routeServerSide bypassed in cross-cohort mode (Pitfall 6: server aggregation is performance, not security)"
  - "GitCompare button wrapped with Settings in flex div to avoid layout shift"
metrics:
  duration_minutes: 35
  completed_date: "2026-04-21"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 3
---

# Phase 16 Plan 04: Cross-Cohort Mode Integration Summary

End-to-end wire-up of cross-cohort comparison mode in OutcomesView: URL parsing, per-cohort aggregate computation via `crossCohortAggregates` memo, trigger button + drawer mount, panel `cohortSeries` prop threading, header subtitle update, server-routing bypass, and per-patient suppression note in OutcomesSettingsDrawer.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Cross-cohort mode in OutcomesView | d9fff6f | src/components/outcomes/OutcomesView.tsx |
| 2 | Hide perPatient checkbox when isCrossMode | 4efcbfe | src/components/outcomes/OutcomesSettingsDrawer.tsx |
| 3 | XCOHORT-04 deep-link restoration tests | 9fbf081 | tests/OutcomesViewRouting.test.tsx |

## What Was Built

**Task 1 (OutcomesView):**
- Added `GitCompare` import from lucide-react alongside existing `Settings` import
- Added `CohortCompareDrawer` and `CohortSeriesEntry` imports
- Added `COHORT_PALETTES` to the palette import
- `compareOpen` state for the drawer
- `rawCohortsParam` / `primaryCohortId` / `isCrossMode` derived from `useSearchParams` immediately after hook call (Pitfall 3 hook-order rule)
- `crossCohortIds` memo: parses `?cohorts=`, trims, filters to known savedSearch ids, ensures primary at index 0, caps at 4 via `.slice(0, 4)`
- `crossCohortAggregates` memo: computes per-cohort trajectories for od/os/combined using `computeCohortTrajectory` or `computeCrtTrajectory` based on `activeMetric`; assigns colors from `COHORT_PALETTES`
- `patientCounts` memo for drawer display
- `handleCompareChange`: writes `?cohorts=` to URL, keeps `?cohort=` as primary reference, caps at 4
- `handleCompareReset`: removes `?cohorts=`, sets `?cohort=primaryCohortId`, closes drawer
- `routeServerSide` short-circuited to `false` in cross-cohort mode (Pitfall 6)
- Header GitCompare trigger button rendered before Settings button in a flex wrapper
- Subtitle updated: in cross-cohort mode renders `outcomesCrossMode` key with count + cohort names (truncated at 50 chars)
- `cohortSeries` prop threaded to all 6 `OutcomesPanel` instances (3 visus + 3 CRT)
- `CohortCompareDrawer` mounted next to `OutcomesSettingsDrawer`
- `isCrossMode` passed to `OutcomesSettingsDrawer`

**Task 2 (OutcomesSettingsDrawer):**
- Added `isCrossMode?: boolean` (default false) to Props interface and function signature
- Added `.filter(([key]) => !(isCrossMode && key === 'perPatient'))` before the layer checkboxes `.map()`
- Added `{isCrossMode && <p data-testid="perpatient-suppressed-note">...}` suppressed note

**Task 3 (Tests):**
- Added `CROSS_COHORT_SAVED_SEARCHES` fixture with p1–p5
- Added `renderCrossView` helper that sets `initialEntries` to any URL
- Three new `it` blocks for XCOHORT-04 in `describe('OutcomesView — cross-cohort routing (Phase 16)')`
- All use `toBeDefined()` / assertion patterns consistent with existing test file (no `@testing-library/jest-dom` dependency)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test assertions used toBeInTheDocument() not available in this test file**
- **Found during:** Task 3 first run
- **Issue:** `toBeInTheDocument()` requires `@testing-library/jest-dom` matchers; the existing test file uses `toBeDefined()` and `toBeNull()` (Vitest built-ins)
- **Fix:** Changed all `toBeInTheDocument()` calls to `toBeDefined()`
- **Files modified:** tests/OutcomesViewRouting.test.tsx
- **Commit:** 9fbf081

## Known Pre-Existing Failures (Out of Scope)

Two test failures existed before this plan's changes and are not caused by Plan 04:

1. `tests/outcomesPanelCrt.test.tsx` (2 failures): Tests expect visus absolute y-domain `[0, 2]` but Plan 02 changed it to `[0, 1]` per admin feedback. These tests need updating in a future plan.
2. `tests/metricSelector.test.ts` (1 suite failure): Wrong file extension (`.ts` instead of `.tsx`) for a JSX-using test, causes parse error. Pre-existing from Phase 13.

Both logged to deferred-items.

## Threat Flags

None. No new network endpoints, auth paths, or server-side changes introduced. All data operations are client-side using the pre-authorized `savedSearches` + `activeCases` from `useData()`. URL param sanitized per T-16-08/09/10 mitigations (membership check + `.slice(0, 4)` cap).

## Verification

- `npx tsc --noEmit`: exits 0
- `npx vitest run tests/OutcomesPage.test.tsx tests/OutcomesPanel.test.tsx tests/OutcomesViewRouting.test.tsx`: 33 tests passed
- Full suite: 451 passed (pre-existing 2 CRT y-domain + 1 metricSelector failures excluded)

## Self-Check: PASSED
