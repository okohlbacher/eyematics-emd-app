---
phase: 42-analysis-comparison
plan: "01"
subsystem: outcomes-compare
tags: [anl-010, cross-cohort, interval-histogram, responder-view, legend, palette]
dependency_graph:
  requires: []
  provides: [cohort-labeled-interval-histogram, cohort-labeled-responder-view]
  affects: [OutcomesView, IntervalHistogram, ResponderView]
tech_stack:
  added: []
  patterns: [IntervalCohortSeries interface, cross-cohort small-multiples layout]
key_files:
  created: []
  modified:
    - src/components/outcomes/IntervalHistogram.tsx
    - src/components/outcomes/ResponderView.tsx
    - src/components/outcomes/OutcomesView.tsx
    - src/i18n/translations.ts
    - tests/intervalHistogram.test.tsx
decisions:
  - "IntervalCohortSeries carries raw cases (not PanelResult) so histogram can re-compute per-eye distributions when the eye toggle changes in cross mode"
  - "Cohort names rendered as plain DOM text spans (not only Recharts Legend SVG) so RTL queryByText assertions work without jest-dom"
  - "ResponderView cross mode uses labeled small-multiples (one headed bar chart per cohort) rather than a single grouped chart — 3 buckets x N cohorts x 3 eyes would be too dense"
  - "BUCKET_COLORS kept unexported to avoid react-refresh/only-export-components lint error"
metrics:
  duration: "~6 minutes"
  completed: "2026-05-26"
  tasks_completed: 3
  files_changed: 5
---

# Phase 42 Plan 01: ANL-010 Cohort Labels on Compare Plots Summary

**One-liner:** Per-cohort palette-colored labels and legend on interval histogram and responder view in cross-cohort compare mode, using COHORT_PALETTES consistent with Visus/CRT panels.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 3 | Add legend/cohort-label translation keys | 2a4ed32 | translations.ts |
| 1 RED | Failing tests for cross-cohort interval histogram | c38bfb7 | tests/intervalHistogram.test.tsx |
| 1 GREEN | Cross-cohort labeled interval histogram | c1d898b | IntervalHistogram.tsx |
| 2 | Wire cohort series + responder view | fe82463 | OutcomesView.tsx, ResponderView.tsx, test |

## What Was Built

**IntervalHistogram (cross mode):**
- New optional `cohortSeries?: IntervalCohortSeries[]` prop (exported interface)
- When `>=2` entries: activates cross mode — groups bins by cohort, one `<Bar>` per cohort colored by `series.color` (COHORT_PALETTES)
- Recharts `<Legend>` shows cohort name + color chip automatically via `Bar name=`
- Per-cohort median annotation row: color swatch + cohort name as plain DOM text (RTL-queryable) + median day value
- Eye toggle preserved — re-computes all series distributions on toggle
- Single-cohort mode: byte-for-byte unchanged

**ResponderView (cross mode):**
- New optional `cohortSeries?: IntervalCohortSeries[]` prop (reuses IntervalCohortSeries type)
- Cross mode: labeled small-multiples — one `CohortResponderPanel` per cohort with colored heading (color swatch + cohort name) and bucket bar chart
- Single-cohort mode: unchanged

**OutcomesView:**
- New `crossCohortCaseSeries` memo builds `IntervalCohortSeries[]` with same COHORT_PALETTES index order as `crossCohortAggregates` — guarantees color consistency across all four metric tabs
- `interval` branch: passes `cohortSeries` when `isCrossMode && length>=2`
- `responder` branch: passes `cohortSeries` when `isCrossMode && length>=2`
- Visus/CRT/non-cross paths: unchanged

**Translations (3 new keys):**
- `metricsIntervalCohortLegendAriaLabel` (de/en)
- `metricsIntervalMedianLineCohort` (de: 'Median {name}: {days} Tage', en: 'Median {name}: {days} days')
- `metricsResponderCohortLegendAriaLabel` (de/en)

## Test Results

- `npm run test:ci`: **1037/1037 passed** (baseline was 1032; +5 net from new cross-cohort tests)
- TDD RED commit: c38bfb7 (2 failing, 6 passing)
- TDD GREEN commit: c1d898b (8 passing)

## Deviations from Plan

**1. [Rule 2 - Improvement] Task 3 executed before Tasks 1-2**
- Tasks 1-2 reference translation keys from Task 3
- Executed Task 3 first so keys were available during RED/GREEN phases
- No behavioral change — plan order is advisory not mandatory for dependencies

**2. [Rule 1 - Bug] Recharts Legend SVG not queryable by RTL queryByText**
- Found during GREEN: cohort names in Recharts `<Legend>` are SVG text not DOM text; RTL `queryByText` returns null
- Fix: render cohort name as plain `<span>` inside the per-cohort median annotation row
- Commit: part of c1d898b

## Known Stubs

None — all cohort series are fully wired from `activeCases` via `applyFilters` (same path as `crossCohortAggregates`).

## Self-Check: PASSED

All 4 source files exist. All 4 task commits verified in git log. 1037/1037 tests green.
