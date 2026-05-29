---
phase: 43-case-nav-clarity
plan: "03"
subsystem: case-detail
tags: [FALL-011, cohort-reference, overlay, trajectory, iqr, percentile, visus, crt]
dependency_graph:
  requires: [43-01, 43-02]
  provides: [cohortReference series in useCaseData, showCohortReference toggle in VisusCrtChart]
  affects: [src/hooks/useCaseData.ts, src/components/case-detail/VisusCrtChart.tsx, src/pages/CaseDetailPage.tsx, src/i18n/translations.ts]
tech_stack:
  added: []
  patterns: [nearest-rank percentile, recharts Area IQR band, controlled checkbox toggle]
key_files:
  created:
    - tests/VisusCrtChartReference.test.tsx
  modified:
    - src/hooks/useCaseData.ts
    - src/components/case-detail/VisusCrtChart.tsx
    - src/pages/CaseDetailPage.tsx
    - src/i18n/translations.ts
decisions:
  - "Used nearest-rank percentile (sort + index) inline rather than importing a helper — same math used by cohortTrajectory, no new metric"
  - "showCohortReference defaults false — avoids visual clutter on first case load per plan discretion"
  - "Kept existing flat cohortAvg* ReferenceLine elements; new trajectory overlay is additive"
  - "IQR rendered as stacked Area pair (p75 with fill, p25 with white fill to mask) — same approach as Recharts IQR band pattern"
  - "cohortReference includes the current case in the per-date aggregate — aligns with the existing cohortAvgVisus/cohortAvgCrt approach"
metrics:
  duration: "~4 minutes"
  completed: "2026-05-25T23:08:34Z"
  tasks_completed: 2
  files_changed: 5
---

# Phase 43 Plan 03: FALL-011 Cohort Reference Overlay Summary

Overlays a date-aligned cohort median line and IQR (p25–p75) band on the single-case Visus/CRT trajectory chart, controlled by an accessible toggle that is off by default.

## What Was Built

### Task 1 — `useCaseData` cohortReference series

Added `CohortReferencePoint` interface and a `cohortReference` memoized computed array to `useCaseData`. For each date present in the current case's `combinedData`, the hook gathers all cohort Visus and CRT values (from `cases` via `getObservationsByCode`) measured on that date and computes:

- `visusMedian`, `visusP25`, `visusP75` via nearest-rank percentile (sort + index)
- `crtMedian`, `crtP25`, `crtP75` via the same method

Dates with no cohort observations are filtered out. The computation is O(n × d) for n cases and d distinct dates — bounded by the already-loaded in-memory cohort (T-43-06 accepted). `cohortAvgVisus` / `cohortAvgCrt` flat reference lines are preserved.

### Task 2 — `VisusCrtChart` overlay + `CaseDetailPage` toggle

- **VisusCrtChart**: new optional props `showCohortReference: boolean` (default `false`) and `cohortReference: CohortReferencePoint[]` (default `[]`). When both toggled on and data present, renders (before patient lines): Visus IQR band as two stacked `<Area>` elements, CRT IQR band the same way, a dashed Visus median `<Line dataKey="visusMedian">`, and a dashed CRT median `<Line dataKey="crtMedian">`. Uses muted green (#6ee7b7) and violet (#c4b5fd) tones matching the existing flat reference colours.
- **CaseDetailPage**: `useState(false)` for `showCohortReference`; a small `<label><input type="checkbox">` control above the chart card with `aria-label={t('cohortReferenceToggle')}`.
- **translations.ts**: three new i18n keys added — `cohortReferenceToggle`, `cohortReferenceMedian`, `cohortReferenceBand` (DE + EN).

## Tests

7 new tests in `tests/VisusCrtChartReference.test.tsx` (TDD RED → GREEN):

| Test | Assertion |
|------|-----------|
| visusMedian correct on shared date | median of [0.3, 0.5, 0.7] = 0.5 |
| empty-date safety | no crash, cohortReference is array |
| crtMedian / crtP25 / crtP75 | median of [280, 320, 360] = 320 |
| overlay renders when showCohortReference=true | visusMedian Line present |
| IQR Areas rendered when toggled on | areas.length > 0 |
| no overlay when showCohortReference=false | medianLine undefined, areas = 0 |
| no crash with empty cohortReference | patient lines still render |

Full suite: 1086/1086 pass. Lint: 0 errors, 0 warnings.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — `cohortReference` is computed from the live `cases` array already loaded into memory; no placeholder data.

## Threat Flags

None. The overlay aggregates over the already-authorized `cases` (server-restricted by center). Only median/p25/p75 values reach the DOM — no individual pseudonyms or cross-patient identities exposed. T-43-05 mitigation satisfied.

## Self-Check: PASSED

- `tests/VisusCrtChartReference.test.tsx` exists and passes
- `src/hooks/useCaseData.ts` modified (cohortReference)
- `src/components/case-detail/VisusCrtChart.tsx` modified (showCohortReference prop)
- `src/pages/CaseDetailPage.tsx` modified (toggle + prop wiring)
- `src/i18n/translations.ts` modified (3 new keys)
- Commits: `76a146c` (RED tests), `0f0cacc` (feat implementation)
