---
phase: 09
plan: 09-02
subsystem: outcomes-page-ui
one_liner: "Three ComposedChart panels + summary cards + settings drawer wired via single computeCohortTrajectory useMemo (IQR band: single-Area baseLine approach)"
tags:
  - recharts
  - outcomes
  - tdd
  - trajectory
  - iqr-band
  - drawer
dependency_graph:
  requires:
    - 09-01 (OutcomesPage scaffold, OutcomesEmptyState, /outcomes route, tests 1-7)
    - 08-01 (computeCohortTrajectory, TrajectoryResult, PanelResult, GridPoint types)
    - 08-04 (71 outcomes* i18n keys in translations.ts)
  provides:
    - OutcomesSummaryCards (4 summary cards keyed from aggregate)
    - OutcomesPanel (single ComposedChart with IQR band, per-patient lines, scatter, median)
    - OutcomesTooltip (5-line Recharts custom tooltip)
    - OutcomesSettingsDrawer (fixed aside, 4 sections, Escape key, slider 20-300)
    - OutcomesPage extended (cards row + 3-panel grid + drawer wired)
  affects:
    - 09-03 (receives aggregate as single source of truth for data preview rows)
tech_stack:
  added: []
  patterns:
    - "Single useMemo keyed on (cohort, axisMode, yMetric, gridPoints, spreadMode) → feeds both cards and panels (D-26)"
    - "IQR band: <Area dataKey=iqrHigh baseLine=iqrLow> against iqrData projection of medianGrid"
    - "Recharts mocked in tests via vi.mock('recharts') for jsdom SVG rendering"
    - "computeCohortTrajectory mocked in tests to control aggregate shape directly"
key_files:
  created:
    - src/components/outcomes/OutcomesSummaryCards.tsx
    - src/components/outcomes/OutcomesPanel.tsx
    - src/components/outcomes/OutcomesTooltip.tsx
    - src/components/outcomes/OutcomesSettingsDrawer.tsx
  modified:
    - src/pages/OutcomesPage.tsx (adds computeCohortTrajectory memo, cards/panels/drawer wire, locale prop threading)
    - tests/OutcomesPage.test.tsx (adds tests 8-12, Recharts mock, trajectory mock with default return value)
decisions:
  - "IQR band: single-Area with baseLine=iqrLow confirmed working in Recharts 3.8.1 — no two-area fallback needed"
  - "IQR marker testid: hidden <div data-testid=outcomes-panel-{eye}-iqr> as sibling div (not <g> inside ComposedChart which Recharts rejects as non-standard child)"
  - "OS/OD excluded-count hint for 0-observation cohorts: osCount===0 && patients>0 → hint shows patient count (not summary.excludedCount which only tracks sparse/outlier exclusions)"
  - "Recharts mocked in tests via vi.mock('recharts') so ResponsiveContainer + ComposedChart render a predictable SVG in jsdom without ResizeObserver"
  - "computeCohortTrajectory mock given default return value (valid minimal TrajectoryResult) so existing tests 1-7 continue to pass after OutcomesPage now calls it"
metrics:
  duration_minutes: 40
  completed_date: "2026-04-15"
  completed_tasks: 4
  files_created: 4
  files_modified: 2
  tests_passing: 12
  tests_total_phase: 17
requirements_addressed:
  - OUTCOME-02 (3 ComposedChart panels with CHART_COLORS[0/2/4]; median strokeWidth=3 > perPatient strokeWidth=1.5)
  - OUTCOME-03 (axisMode toggle via drawer radio redraw all panels through memo re-run)
  - OUTCOME-04 (yMetric toggle via drawer radio redraw all panels)
  - OUTCOME-05 (4 layer checkboxes: median, perPatient, scatter, spreadBand independently toggle chart elements)
  - OUTCOME-06 (gridPoints slider range 20..300 default 120 triggers memo re-run on change)
  - OUTCOME-07 (4 summary cards read from same memoized aggregate: patients, total, OD, OS with excluded hint)
---

# Phase 09 Plan 02: Summary — Chart Panels, Cards, Tooltip, Drawer

## What Was Built

Three `OutcomesPanel` ComposedChart panels (OD/OS/combined), a four-card `OutcomesSummaryCards` row, a `OutcomesTooltip` custom Recharts tooltip, and an `OutcomesSettingsDrawer` fixed aside were created and wired into the `OutcomesPage` scaffold from 09-01.

The page now computes a single `TrajectoryResult` via one `useMemo` call to `computeCohortTrajectory` keyed on five inputs (`cohort`, `axisMode`, `yMetric`, `gridPoints`, `spreadMode`). Both the summary cards and all three panels consume this same memoized object — no double-aggregation (D-26).

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `src/components/outcomes/OutcomesSummaryCards.tsx` | 85 | 4 summary cards with testids `outcomes-card-{patients,total,od,os}` |
| `src/components/outcomes/OutcomesPanel.tsx` | 155 | ComposedChart: IQR Area, per-patient Lines, Scatter, median Line |
| `src/components/outcomes/OutcomesTooltip.tsx` | 100 | 5-line custom tooltip: pseudonym / eye / x / logMAR+Snellen / flags |
| `src/components/outcomes/OutcomesSettingsDrawer.tsx` | 165 | Fixed aside, 4 sections, Escape key, slider 20-300, reset button |

## Files Modified

- `src/pages/OutcomesPage.tsx`: Added full state setters, `computeCohortTrajectory` useMemo, `OutcomesSummaryCards` + 3×`OutcomesPanel` + `OutcomesSettingsDrawer` in layout, `CHART_COLORS` imports, locale threading.
- `tests/OutcomesPage.test.tsx`: Added tests 8-12 (panels render, axis toggle, IQR layer toggle, scatter-off at 31, card parity), plus Recharts mock and default trajectory mock return value.

## Tests

12 of 17 phase tests pass (tests 1-12). Tests 13-17 (data preview, CSV export) land in 09-03.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 8cbc45d | test(09-02) | RED tests 8-12: panels, summary cards, drawer toggles |
| a9440e9 | feat(09-02) | OutcomesSummaryCards + OutcomesTooltip components |
| 6194cdf | test(09-02) | Recharts mock + default trajectory mock for GREEN |
| 5867cb6 | feat(09-02) | Wire OutcomesPanel + SettingsDrawer + summary cards into page |

## Key Decisions

### IQR Band: Single-Area with baseLine (Locked Decision 2)

`<Area dataKey="iqrHigh" baseLine="iqrLow" fill={color} fillOpacity={0.15} stroke="none" isAnimationActive={false} />` against `iqrData = panel.medianGrid.map(g => ({ x: g.x, iqrLow: g.p25, iqrHigh: g.p75 }))`. Recharts 3.8.1 accepts the `baseLine` prop without TypeScript errors. No two-area mask fallback was needed.

### IQR Testid Marker Strategy

`<g data-testid="...">` inside `ComposedChart` is rejected by Recharts as a non-standard child and does not render. Instead, a `<div data-testid={outcomes-panel-{eye}-iqr} hidden />` is rendered as a sibling to the `ResponsiveContainer` when `layers.spreadBand` is true. Test 10 asserts presence/absence of this div — visibility is irrelevant for the test.

### OS/OD Excluded-Count Hint for 0-Observation Cohorts

`summary.excludedCount` in `PanelResult` only counts patients excluded for sparsity or outlier reasons — not patients who simply have no measurements for an eye. For an all-OD cohort (OS `measurementCount === 0`), the OS card hint is computed as the patient count: `osCount === 0 && patients > 0 → t('outcomesCardExcluded').replace('{count}', patients)`. This satisfies test 12's assertion that the OS card shows an excluded hint.

### Recharts Mock in Tests

`vi.mock('recharts')` overrides `ResponsiveContainer` with a `<div>...<svg>...</svg>` wrapper and `ComposedChart` with a plain `<g>`. This lets jsdom render the chart tree without ResizeObserver, making SVG presence assertions reliable. The real Recharts exports (types, constants) are preserved via `importOriginal`.

## Deviations from Plan

### [Rule 2 - Missing] Recharts mock required for jsdom test reliability

- **Found during:** Task 2.2b (GREEN) — SVG not rendering in jsdom without ResizeObserver
- **Issue:** `ResponsiveContainer` in Recharts requires a browser layout context to compute dimensions and render. In jsdom, `querySelector('svg')` on the panel always returned `null`.
- **Fix:** Added `vi.mock('recharts')` with stub implementations of the 9 Recharts components used by `OutcomesPanel`. Also added a default return value to the `computeCohortTrajectory` mock so tests 1-7 (which now see the mocked `computeCohortTrajectory` import) continue to pass.
- **Files modified:** `tests/OutcomesPage.test.tsx`
- **Extra commit:** `6194cdf` (test(09-02)) — staged only `tests/OutcomesPage.test.tsx`, within fence.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. All data flows through the existing `computeCohortTrajectory` pure function and `useData()` context.

## Handoff to 09-03

`aggregate` (the `TrajectoryResult` from the single `useMemo`) is the source of truth for table rows. `OutcomesDataPreview.tsx` (09-03) must compute `daysSinceBaseline` and `treatmentIndex` locally via a `flattenToRows(cases)` helper that iterates `cohort.cases` directly — NOT by calling `computeCohortTrajectory` a second time, and NOT by modifying `cohortTrajectory.ts` (which remains frozen from Phase 8).

## Self-Check

- [x] `src/components/outcomes/OutcomesSummaryCards.tsx` exists
- [x] `src/components/outcomes/OutcomesPanel.tsx` exists with `baseLine="iqrLow"` (1 match)
- [x] `src/components/outcomes/OutcomesTooltip.tsx` exists
- [x] `src/components/outcomes/OutcomesSettingsDrawer.tsx` exists
- [x] `src/pages/OutcomesPage.tsx` contains `computeCohortTrajectory` (2 matches) and `CHART_COLORS[0/2/4]` (3 matches)
- [x] `tests/OutcomesPage.test.tsx` has 12+ `it(` blocks
- [x] Zero matches for `two-area|twoArea|mask` in `OutcomesPanel.tsx`
- [x] 12/12 tests pass
- [x] 4 commits with `(09-02)` prefix exist
