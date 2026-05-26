# Phase 42: Analysis Cohort Comparison & Labeling - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning
**Mode:** Auto

<domain>
## Phase Boundary
Three analysis-view improvements (ANL-010/011/012), on AnalysisPage / OutcomesView and the comparison plots:
- **ANL-010:** when comparing cohorts, every plot (incl. the interval histogram) clearly labels which cohort each series represents (user couldn't tell which cohort was which in compare mode).
- **ANL-011:** the Aggregated tab supports between-cohort comparison (e.g. diagnosis distribution, age-vs-Visus) — currently the aggregated tab shows single-cohort info not comparable across cohorts.
- **ANL-012:** the active cohort/filter name is shown in Analysis when a filter is loaded directly (`?filters=`), not only via the saved-search path.
</domain>

<decisions>
## Implementation Decisions
- Reuse the existing cross-cohort comparison infrastructure (v1.7 Phase 16: `COHORT_PALETTES`, `?cohorts=` deep-link, CohortCompareDrawer from v1.10) — extend labeling, don't reinvent.
- **ANL-010:** ensure series in interval histogram + all compare plots carry a visible cohort label/legend (color + name), consistent with the existing palette. The interval histogram is the specific gap the user flagged.
- **ANL-011:** add comparable aggregate views across the active cohorts in the Aggregated tab — at minimum diagnosis distribution and an age-vs-Visus comparison; render per-cohort using the same palette. Scope: comparison rendering of existing aggregate data, not new metrics.
- **ANL-012:** show the active cohort/filter name on the direct `?filters=` load path. Per the earlier code recon, `AnalysisPage.tsx:~215` only displays the name when `activeSavedSearch` exists; derive a display name for the direct-filters path (e.g. a synthesized "Gefilterte Kohorte" / filter summary or the `name` query param if present).
- Reuses the shared `CenterMultiSelect` (Phase 41) for the analysis center filter where applicable.
- ### Claude's Discretion: exact aggregated-comparison chart types + layout; how to label/derive the direct-filter cohort name; whether ANL-011 is a new sub-tab or augments the existing Aggregated tab.
</decisions>

<code_context>
## Existing Code Insights
- `src/components/outcomes/OutcomesView.tsx` — 771-line view (cross-cohort overlay, metric tabs, aggregated routing); consumes `?cohorts=`/`?filters=`; uses `COHORT_PALETTES`.
- `src/pages/AnalysisPage.tsx:~215` — displays cohort name only when `activeSavedSearch` set (ANL-012 gap on direct `?filters=` load).
- Interval histogram + responder/CRT/Visus compare plots — labeling target (ANL-010).
- Aggregated tab — single-cohort aggregate display today (ANL-011 target).
- `src/utils/cohortFilterSerialization.ts` (`safePickCohortFilter`), `shared/cohortNames.ts` (subcohort naming), `COHORT_PALETTES` (per-cohort colors).
- Phase 44 will decompose OutcomesView (F-10) — keep 42 changes cohesive to ease that.
</code_context>

<specifics>
## Specific Ideas
Add cohort labels/legends to all compare plots (esp. interval histogram); add between-cohort aggregate comparison (diagnosis distribution + age-vs-Visus) in the Aggregated tab using COHORT_PALETTES; show a derived cohort/filter name on direct `?filters=` load. RTL no jest-dom. Keep changes cohesive to not fight Phase 44's OutcomesView decomposition.
</specifics>

<deferred>
## Deferred Ideas
ANL-002 responder-tooltip placement + A-06 axis ticks → Phase 43 chart-polish (CHART-01). New aggregate metrics beyond comparison rendering → backlog.
</deferred>
