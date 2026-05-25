---
phase: 42-analysis-comparison
plan: "02"
subsystem: analysis-aggregated
tags: [anl-011, cross-cohort, aggregated-tab, diagnosis-distribution, age-vs-visus, palette]
dependency_graph:
  requires: [42-01]
  provides: [cross-cohort-aggregated-comparison]
  affects: [AnalysisPage, translations]
tech_stack:
  added: []
  patterns: [small-multiple pies per cohort, single ScatterChart multi-series, COHORT_PALETTES by index, queryAllByText for multi-occurrence RTL assertions]
key_files:
  created:
    - tests/AnalysisPage.test.tsx
  modified:
    - src/pages/AnalysisPage.tsx
    - src/i18n/translations.ts
decisions:
  - "Small-multiple pies (one per cohort) chosen over grouped bars for diagnosis distribution — shows intra-cohort proportions cleanly and scales to 2–4 cohorts without crowding"
  - "Single ScatterChart with one Scatter series per cohort for age-vs-Visus — allows direct visual overlay and leverages built-in Recharts Legend"
  - "Plain DOM text spans (not Recharts SVG Legend) in cohort color legend — required for RTL queryAllByText assertions"
  - "queryAllByText used instead of queryByText for cohort names that appear in multiple places (page subtitle, legend span, chart h4 heading)"
  - "crossCohorts memo placed after existing cohort/filterOptions memos to reuse same getSettings() call pattern"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-26"
  tasks_completed: 2
  files_changed: 3
---

# Phase 42 Plan 02: ANL-011 Aggregated Tab Cross-Cohort Comparison Summary

**One-liner:** Per-cohort palette-colored comparison of diagnosis distribution (small-multiple pies) and age-vs-Visus scatter in the Aggregated tab, using COHORT_PALETTES consistent with the Trajectories compare plots.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 RED | Failing tests for cross-cohort aggregated comparison | b6d87b4 | tests/AnalysisPage.test.tsx |
| 1+2 GREEN | Implement cross-cohort parsing + comparison rendering | c87cf4a | AnalysisPage.tsx, translations.ts, tests |

## What Was Built

**AnalysisPage.tsx cross-cohort parsing (Task 1):**
- `rawCohortsParam`, `isCrossMode`, `primaryCohortId` read from URL above any early return (Rules of Hooks)
- `crossCohortIds` memo: parses `?cohorts=`, filters to known savedSearch ids, prepends primary if absent, caps at 4
- `crossCohorts` memo: for each id, resolves cases via `applyFilters(activeCases, saved.filters, filterOptions)`, assigns `COHORT_PALETTES[idx % 4]` color — primary always index 0, matching OutcomesView's index order

**AnalysisPage.tsx comparison rendering (Task 2):**
- When `isCrossMode && crossCohorts.length >= 2`: renders comparison layout:
  1. Cohort color legend: `<ul>` with plain `<span>` text per cohort name + color swatch (RTL-queryable)
  2. `data-testid="compare-diagnosis"`: small-multiple `<PieChart>` per cohort, each headed by `<h4>` in the cohort color
  3. `data-testid="compare-age-visus"`: single `<ScatterChart>` with one `<Scatter>` series per cohort in palette color + Recharts `<Legend>`
- When not cross mode (or only 1 cohort resolved): original 5 charts render unchanged (center dist, diagnosis dist, visus trend, CRT dist, age-vs-Visus)

**translations.ts (3 new keys):**
- `analysisCompareDiagnosisTitle` (de: 'Diagnoseverteilung nach Kohorte', en: 'Diagnosis Distribution by Cohort')
- `analysisCompareAgeVisusTitle` (de: 'Alter vs. Visus nach Kohorte', en: 'Age vs. Visual Acuity by Cohort')
- `analysisCompareLegendAriaLabel` (de: 'Kohortenlegende (Farbe → Name)', en: 'Cohort legend (color → name)')

**tests/AnalysisPage.test.tsx (7 tests, all green):**
- single-cohort: aggregate tab renders, no compare-* testids
- cross-mode: compare-diagnosis + compare-age-visus present when ≥2 known ids
- cross-mode: cohort names visible (queryAllByText)
- cross-mode: unknown ids silently dropped (only 1 resolves → not cross mode)
- cross-mode: primary prepended when absent from ?cohorts=
- cross-mode: capped at 4 (Cohort 5 absent)
- single-cohort: falls back when ?cohorts= has only 1 known id

## Test Results

- `npm run test:ci`: **1044/1044 passed** (baseline was 1037; +7 from new AnalysisPage tests)
- TDD RED commit: b6d87b4 (4 failing, 3 passing)
- TDD GREEN commit: c87cf4a (7 passing)
- `npx tsc --noEmit`: clean

## Deviations from Plan

**1. [Rule 1 - Bug] queryByText fails for cohort names appearing in multiple DOM locations**
- Found during GREEN: cohort name "AMD Cohort" appears in page subtitle `<p>`, legend `<span>`, and chart `<h4>` — RTL's `queryByText` throws "Found multiple elements"
- Fix: switched to `queryAllByText(...).length > 0` / `.toBe(0)` pattern; all 3 assertions updated
- No behavior change in production code

## Known Stubs

None — all cohort series are fully wired from `activeCases` via `applyFilters` using the same settings-derived filterOptions as the single-cohort path.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes. Cross-cohort resolution uses existing `savedSearches` and `activeCases` (server-restricted to the user's authorized centers). T-42-03 and T-42-04 from the plan's threat model are satisfied by the `savedSearches.find(s.id===id)` filter (unknown ids dropped) and read-only rendering.

## Self-Check: PASSED

- tests/AnalysisPage.test.tsx: EXISTS
- src/pages/AnalysisPage.tsx: EXISTS (modified)
- src/i18n/translations.ts: EXISTS (modified, 3 keys added)
- RED commit b6d87b4: verified in git log
- GREEN commit c87cf4a: verified in git log
- 1044/1044 tests green
