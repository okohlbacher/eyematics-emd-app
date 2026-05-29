---
phase: 41-docquality-multicenter-ux
plan: "02"
subsystem: quality-review
tags: [qual-022, qual-023, time-range-filter, grundgesamtheit, absolute-counts]
dependency_graph:
  requires: [41-01]
  provides: [time-range-filter-on-quality-page, grundgesamtheit-denominator, prominent-absolute-counts]
  affects: [src/pages/QualityPage.tsx]
tech_stack:
  added: []
  patterns: [filterCasesByTimeRange-case-level-inclusion, QualityFilterBar-reuse, timeScopedCases-useMemo]
key_files:
  created:
    - tests/QualityPage.test.tsx
  modified:
    - src/pages/QualityPage.tsx
    - src/i18n/translations.ts
decisions:
  - "Case-level inclusion test: a case is in timeScopedCases iff it has at least one obs with effectiveDateTime >= cutoff; filterCasesByTimeRange alone trims obs but keeps cases — we apply the drop-case predicate here"
  - "QualityFilterBar reused with showCenterFilter=false (no new component, no modification to existing)"
  - "SummaryCard renders count/total as primary sublabel with percentage secondary — QUAL-023 without behavior change"
metrics:
  duration_seconds: 238
  completed_date: "2026-05-26"
  tasks_completed: 2
  files_changed: 3
---

# Phase 41 Plan 02: QUAL-022 Time-filtered Grundgesamtheit + QUAL-023 Absolute Count Discoverability Summary

**One-liner:** Time-range state on QualityPage drives Grundgesamtheit denominator + all counts via case-level inclusion test; SummaryCards now show "N / total" sublabel for always-visible absolute counts.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED | Failing tests (QUAL-022, QUAL-023) | 1d8ff6b | tests/QualityPage.test.tsx |
| GREEN | Time-range state + Grundgesamtheit + absolute counts | 1e97e85 | src/pages/QualityPage.tsx, src/i18n/translations.ts, tests/QualityPage.test.tsx |

## What Was Built

### QUAL-022: Time-range filter drives Grundgesamtheit

- Added `timeRange` useState<TimeRange>('all') to QualityPage
- Introduced `timeScopedCases` useMemo that applies a **case-level** inclusion test:
  - `timeRange === 'all'` → full scopedCases (unchanged denominator)
  - `timeRange === '6m' | '1y'` → only cases with at least one obs with `effectiveDateTime >= cutoffDate(timeRange)`
- Wired `timeScopedCases` into all downstream memos: `caseStatus`, `statusCounts`, `therapyStatuses`, `centerNames`, `filteredCases`
- Changed SummaryCard `total` props from `scopedCases.length` to `timeScopedCases.length`
- Rendered `QualityFilterBar` with `showCenterFilter={false}` above the cohort scope row — same pattern as DocQualityPage

### QUAL-023: Absolute count prominence

- `SummaryCard` now renders a secondary `{count} / {total}` line below the bold count number
- Percentage moved to tertiary line (still visible, clearly secondary)
- Added `qualityPopulationLabel: {timeScopedCases.length}` paragraph above the summary cards grid — always visible without hover

### i18n additions

- `qualityPopulationLabel`: de "Grundgesamtheit" / en "Population"
- `qualityOfTotal`: de "von" / en "of"

## Test Coverage

6 new RTL tests in `tests/QualityPage.test.tsx`:
- Default 'all' range: population label visible, count ≥ 1
- '6m' click: population label remains visible after filter applied
- 'all' restore: population label still visible
- Time-range buttons (docQualityLast6Months, docQualityLastYear, docQualityAllTime) all render
- qualityPopulationLabel visible near summary cards
- Status labels (unchecked, inProgress, reviewed) render without hover

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] queryByText exact-text mismatch for label with colon**
- **Found during:** GREEN phase test run
- **Issue:** `queryByText('qualityPopulationLabel')` returns null because the rendered span is `"qualityPopulationLabel:"` with a colon; RTL exact matching fails
- **Fix:** Changed assertions to `queryByText(/qualityPopulationLabel/)` regex; changed count assertion from `queryByText(/2/)` (ambiguous multi-match) to `queryAllByText(/2/).length > 0`
- **Files modified:** tests/QualityPage.test.tsx
- **Commit:** 1e97e85

## Verification

- `npx vitest run tests/QualityPage.test.tsx`: 6/6 passed
- `npm run test:ci`: 1032/1032 passed (6 new tests added to 1026 baseline)
- `npm run lint`: clean

## Self-Check: PASSED

- [x] src/pages/QualityPage.tsx exists and modified
- [x] src/i18n/translations.ts exists and modified (qualityPopulationLabel, qualityOfTotal added)
- [x] tests/QualityPage.test.tsx exists and created
- [x] Commits 1d8ff6b (RED) and 1e97e85 (GREEN) exist in git log
- [x] No unexpected file deletions
- [x] All 1032 tests pass
