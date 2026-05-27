---
phase: "45"
plan: "01"
subsystem: "doc-quality, charts"
tags: [uat-fix, display, charts, tick-config]
key-files:
  modified:
    - src/pages/DocQualityPage.tsx
    - src/components/doc-quality/MetricCard.tsx
    - src/components/doc-quality/CenterComparisonChart.tsx
    - src/components/doc-quality/CenterDetailPanel.tsx
    - src/components/case-detail/DistributionCharts.tsx
    - src/components/case-detail/ClinicalParametersRow.tsx
    - src/components/outcomes/OutcomesPanel.tsx
    - src/components/outcomes/IntervalHistogram.tsx
    - src/components/outcomes/ResponderView.tsx
decisions:
  - "Reuse existing qualityPopulationLabel i18n key (DE: Grundgesamtheit) for DocQualityPage population label — no new key needed"
  - "tickCount={5} applied uniformly across all charts; kept XAxis hide where intentional (CenterDetailPanel)"
metrics:
  completed: "2026-05-27"
  tasks: 2
  files_modified: 9
---

# Phase 45 Plan 01: UAT Fixes (QUAL-023 + A-06) Summary

Two UAT fixes applied and verified: absolute counts made prominent on DocQualityPage; explicit axis tick config added across all charts.

## FIX 1 — QUAL-023: Prominent absolute counts on DocQualityPage

**Commits:** fcf756d

**What changed:**

- `src/components/doc-quality/MetricCard.tsx`: Patient count moved from a 10px opacity-60 footnote to a `text-sm font-medium` line directly below the `%` score value. This mirrors the SummaryCard pattern used in QualityPage where the absolute count is shown prominently alongside the percentage.

- `src/pages/DocQualityPage.tsx`: Added a "Grundgesamtheit" population label above the metric card grid (line inserted between the filter bar and the summary cards section). Reuses the existing `qualityPopulationLabel` i18n key (DE: "Grundgesamtheit", EN: "Population"). Sum of `patientCount` across all centerMetrics for the active time range is displayed inline, mirroring QualityPage lines 327-331.

## FIX 2 — A-06: Explicit axis tick config across charts

**Commits:** 6b606a9

`tickCount={5}` added to numeric axes in the following files:

| File | Axes updated |
|------|-------------|
| `CenterComparisonChart.tsx` | YAxis (domain [0,100]) |
| `CenterDetailPanel.tsx` | YAxis (domain [0,100]); XAxis intentionally remains `hide` |
| `DistributionCharts.tsx` | Visus histogram YAxis; CRT histogram YAxis; scatter XAxis + YAxis |
| `ClinicalParametersRow.tsx` | IOP BarChart YAxis (domain [0,30]) |
| `OutcomesPanel.tsx` | ComposedChart XAxis (days/treatment-index, continuous) + YAxis |
| `IntervalHistogram.tsx` | Cross-cohort BarChart YAxis; single-cohort BarChart YAxis |
| `ResponderView.tsx` | CohortResponderPanel YAxis; single-cohort bar YAxis; trajectory ComposedChart XAxis + YAxis |

Pattern mirrors `VisusCrtChart.tsx` which already had `tickCount={5}` on both axes since an earlier fix.

## Gates

- `npm run build`: PASSED (tsc -b + vite, 0 errors)
- `npm run test:ci`: PASSED (1086/1086)
- `npm run lint`: PASSED (0 errors)

## Deviations from Plan

None — plan executed exactly as written.
