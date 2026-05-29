---
phase: 43-case-nav-clarity
plan: "01"
subsystem: case-detail-chart
tags: [i18n, chart-labels, ux, tdd]
dependency_graph:
  requires: []
  provides: [locked-i18n-chart-labels, visus-crt-axis-ticks, responder-info-affordance]
  affects: [43-03-cohort-reference-overlay]
tech_stack:
  added: []
  patterns: [recharts-mock-test, tdd-red-green]
key_files:
  created:
    - tests/VisusCrtChartLabels.test.tsx
    - tests/ResponderTooltipPlacement.test.tsx
  modified:
    - src/i18n/translations.ts
    - src/components/case-detail/VisusCrtChart.tsx
    - src/components/outcomes/ResponderView.tsx
decisions:
  - "CRT YAxis label reuses t('crtLegendLabel') (same key as line name) for consistency"
  - "ℹ rendered as HTML entity &#x2139; inside a <span> with title+aria-label for accessibility"
  - "tickCount=5 added to both YAxes as best-effort A-06 fix; allowDecimals=true for Visus, false for CRT"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-26"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 43 Plan 01: FALL-012 + CHART-01 Chart Clarity/Polish Summary

**One-liner:** i18n-driven CRT/Visus/interpolation labels with explicit Y-axis tick counts and plot-adjacent responder info affordance.

## Tasks

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Add i18n keys + failing test | c3f6fea | translations.ts, tests/VisusCrtChartLabels.test.tsx |
| 2 | Wire labels + responder affordance | 98d1479 | VisusCrtChart.tsx, ResponderView.tsx, tests/ResponderTooltipPlacement.test.tsx |

## What Was Built

### i18n Keys (translations.ts)
- `crtLegendLabel`: `{ de: 'CRT (µm)', en: 'CRT (µm)' }` — new key
- `visusYAxisLabel`: `{ de: 'Visus (Dezimal, bestkorrigiert)', en: 'Visual acuity (decimal, best-corrected)' }` — new key
- `interpolatedHint`: updated to locked FALL-012 wording: `de 'Offener Kreis = interpolierter Wert (keine Messung)'` / `en 'Open circle = interpolated value (no measurement)'`

### VisusCrtChart.tsx (FALL-012 + CHART-01 A-06)
- Visus YAxis `label.value` replaced with `t('visusYAxisLabel')`
- CRT Line `name` replaced with `t('crtLegendLabel')`
- CRT YAxis `label.value` replaced with `t('crtLegendLabel')` (consistent with line legend)
- Both YAxes: `tickCount={5}` added; Visus `allowDecimals`, CRT `allowDecimals={false}`

### ResponderView.tsx (CHART-01 ANL-002)
- Single-cohort heading now renders a `<span title={t('metricsResponderTooltip')} aria-label={...}>ℹ</span>` adjacent to the section title
- Existing OutcomesView tab affordance left untouched (no regression)

## Test Results
- 1070 tests pass (`npm run test:ci`) — +5 new tests over 1065 baseline
- `npm run lint` — 0 warnings

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. Labels are static i18n constants (T-43-01 / T-43-02 accepted per plan threat model).

## Self-Check: PASSED

- `src/components/case-detail/VisusCrtChart.tsx` — FOUND
- `src/components/outcomes/ResponderView.tsx` — FOUND
- `src/i18n/translations.ts` — FOUND
- `tests/VisusCrtChartLabels.test.tsx` — FOUND
- `tests/ResponderTooltipPlacement.test.tsx` — FOUND
- commit c3f6fea — FOUND
- commit 98d1479 — FOUND
