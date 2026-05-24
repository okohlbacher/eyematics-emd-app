---
phase: 29-home-panel-ux
plan: "03"
subsystem: QualityPage deep-link filter seeding
tags: [ux, deep-link, url-params, filter-state, react-router]
dependency_graph:
  requires: [29-01]
  provides: [QualityPage URL param seeding — receiving end of UX-01 Review buttons]
  affects: [src/pages/QualityPage.tsx]
tech_stack:
  added: []
  patterns: [useState lazy initializer for URL-seeded state, useSearchParams read-only destructure]
key_files:
  created: []
  modified:
    - src/pages/QualityPage.tsx
decisions:
  - "Use useState lazy initializer (not useEffect) to seed filter state from URL params — avoids double-render flash and infinite-loop risk (RESEARCH Pitfall 3)"
  - "Map ?status=flagged to 'in_progress' in state — 'flagged' is not a QualityStatus member; cases with open flags have caseStatus='in_progress' (RESEARCH Pitfall 1)"
  - "Auto-open filter panel (showFilters=true) when any URL param is present — makes seeded state immediately visible without requiring user to click the filter toggle"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-21"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 1
---

# Phase 29 Plan 03: QualityPage Deep-Link Filter Seeding Summary

**One-liner:** `useSearchParams` lazy initializers in QualityPage seed `filterTherapy`/`filterStatus` from URL params on mount, with `?status=flagged` mapped to `'in_progress'` and unknown values silently falling back to `'all'`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Seed filterTherapy / filterStatus from URL params on mount | f93c55d | src/pages/QualityPage.tsx |

## What Was Built

Extended `src/pages/QualityPage.tsx` to implement the receiving end of the UX-01 deep-link query contract:

- Added `useSearchParams` to the `react-router-dom` import (line 4)
- Added `const [searchParams] = useSearchParams()` at component top (after navigate/locale/t, before any conditional returns)
- Replaced `useState<QualityStatus | 'all'>('all')` with a lazy initializer that reads `searchParams.get('status')` and maps the literal `'flagged'` to `'in_progress'`
- Replaced `useState<string>('all')` for `filterTherapy` with a lazy initializer that reads `searchParams.get('therapy')` and allow-lists `'breaker'` and `'interrupter'`
- Added a lazy initializer for `showFilters` that auto-opens the filter panel when any URL param (`therapy` or `status`) is present — this ensures the seeded filter state is immediately visible to the user
- The filter `<select>` handlers are unchanged — filters remain fully user-mutable after mount

## Verification

- `tests/qualityPageDeepLink.test.tsx`: 3/3 GREEN
  - `?therapy=breaker` seeds `filterTherapy='breaker'`
  - `?status=flagged` seeds `filterStatus='in_progress'` (not `'flagged'`)
  - `?therapy=zzz` falls back to `'all'` silently
- `npm run build`: clean
- `npm run lint` on `src/pages/QualityPage.tsx`: clean (0 errors, 0 warnings)
- Full test suite: 732 passed / 3 pre-existing RED (from Plans 01, 04, 05 in this wave — not caused by this plan)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Filter panel auto-open when URL params present**
- **Found during:** Task 1 (test verification)
- **Issue:** The filter `<select>` elements are gated behind `showFilters` (default `false`). With `showFilters=false`, the selects are not rendered, so tests querying `queryAllByRole('combobox')` found zero elements and all 3 tests failed despite the lazy initializers being correct.
- **Fix:** Added a lazy initializer for `showFilters` that returns `true` when any URL param (`therapy` or `status`) is present. This both fixes the test (selects are rendered) and improves UX (the user sees which filter is active when deep-linking).
- **Files modified:** `src/pages/QualityPage.tsx`
- **Commit:** f93c55d

## Known Stubs

None.

## Threat Flags

None — T-29-07 (URL param allow-listing) is fully mitigated: therapy accepts only `'breaker'`/`'interrupter'`, status accepts only `'flagged'` (mapped to `'in_progress'`), all other values fall back to `'all'`. No raw param string is assigned to filter state.

## Self-Check: PASSED

- `src/pages/QualityPage.tsx` exists and is modified: FOUND
- Commit `f93c55d` exists: FOUND
- Tests 3/3 green: CONFIRMED
- Build clean: CONFIRMED
- Lint clean on modified file: CONFIRMED
