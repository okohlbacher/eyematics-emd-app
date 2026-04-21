# Phase 16: Cross-Cohort Comparison - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Add cross-cohort comparison to the Trajectories / Outcomes view: a researcher can select up to 4 saved cohorts and overlay their trajectory charts in a single view. Each cohort renders as a median line + IQR band in a distinct color from a new 4-color `COHORT_PALETTES`. Per-patient lines are suppressed (locked off) in cross-cohort mode. View state is encoded as `?cohorts=id1,id2,...` in the URL.

Additionally: improve single-cohort spaghetti-plot visual hierarchy (VIS-04) — per-patient lines desaturated to neutral gray at low opacity, median line at full eye-color saturation with heavier stroke weight.

This phase does NOT change the existing metric tabs (visus/crt/interval/responder), the settings drawer controls, or the single-cohort cohort resolution via `?cohort=id`.

</domain>

<decisions>
## Implementation Decisions

### Cohort Selector Trigger & Mechanism
- **D-01:** A GitCompare/Layers icon button sits beside the existing ⚙ gear icon in the outcomes header top-right. Clicking it opens the cohort comparison drawer.
- **D-02:** Mechanism is a slide-over drawer (same pattern as `OutcomesSettingsDrawer`). Lists all `savedSearches` with checkboxes — max 4 selectable. Shows cohort name + patient count per entry. Primary cohort (from `?cohort=`) is pre-checked and cannot be unchecked (it's the baseline). Additional cohorts are added/removed from the drawer.

### Chart Layout in Cross-Cohort Mode
- **D-03:** Keep the 3-panel grid (OD / OS / combined). Each `OutcomesPanel` renders all selected cohorts as overlaid series using `COHORT_PALETTES` colors. The OD/OS/combined distinction is preserved — the COHORT_PALETTES colors replace the per-eye colors for cross-cohort series (each cohort gets one color, used in all 3 panels).
- **D-04:** Legend in each panel shows cohort display name + `(N=X patients)` per cohort, per XCOHORT-03.

### URL & Mode Detection
- **D-05:** `?cohorts=id1,id2` encodes cross-cohort state. When this param is present, `OutcomesView` enters cross-cohort mode. `?cohort=id` (single-cohort) continues to work unchanged. Both params are mutually exclusive — `?cohorts=` takes precedence when present.
- **D-06:** Cohort palette colors in `COHORT_PALETTES` (4 WCAG-compliant colors, distinct from EYE_COLORS). Planner/researcher pick specific values; they must pass 3:1 contrast on white.

### Per-Patient Lines & Layer Control
- **D-07:** In cross-cohort mode, per-patient lines are **locked off** — not toggleable via the settings drawer. 4 cohorts × per-patient spaghetti would overwhelm the chart. The layers toggle is hidden or disabled for the per-patient row when `?cohorts=` is active.
- **D-08:** The existing axisMode, yMetric, gridPoints settings apply globally to all cohorts in cross-cohort mode (same settings drawer, no per-cohort overrides).

### VIS-04: Single-Cohort Spaghetti Hierarchy
- **D-09:** Per-patient lines desaturated **and** low-opacity: render as a neutral gray tone (e.g., `#9ca3af` — Tailwind gray-400) at ~20-25% opacity. This replaces the current per-patient stroke color (which is the full eye color). Median line stays full-saturation `EYE_COLORS[eye]` at stroke-width 4px (up from 3px).
- **D-10:** VIS-04 applies to the visus and CRT metric tabs only (the two that use `OutcomesPanel`). Interval (histogram) and Responder (bar charts) are not affected.

### Claude's Discretion
- Exact `COHORT_PALETTES` hex values — pick 4 WCAG 3:1 compliant distinct colors
- Whether the compare drawer shows a "Clear all" / "Reset" button
- How the header subtitle changes in cross-cohort mode (e.g., "4 cohorts compared")
- Whether a "you're comparing X cohorts" summary bar appears above the charts

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core View & Chart Components
- `src/components/outcomes/OutcomesView.tsx` — Main view; cohort resolution (?cohort= URL); memoized aggregate; where cross-cohort mode detection + multi-cohort rendering must land
- `src/components/outcomes/OutcomesPanel.tsx` — Chart rendering (median/perPatient/scatter/IQR); receives `panel: PanelResult` + `color` prop — must be extended for multi-series
- `src/components/outcomes/palette.ts` — `EYE_COLORS`, `SERIES_STYLES`; add `COHORT_PALETTES` here; VIS-04 changes `SERIES_STYLES.perPatient`

### Drawer Pattern to Replicate
- `src/components/outcomes/OutcomesSettingsDrawer.tsx` — Slide-over drawer pattern; cohort comparison drawer should follow this structure

### Data Layer
- `src/context/DataContext.tsx` — `savedSearches: SavedSearch[]` from `useData()` — the list of cohorts to compare
- `shared/types/fhir.ts` §SavedSearch (line 168) — `{ id, name, createdAt, filters }` — the cohort object shape
- `src/utils/cohortTrajectory.ts` + `shared/cohortTrajectory.ts` — `computeCohortTrajectory` / `computeCrtTrajectory`; must be called once per cohort in cross-cohort mode

### Requirements
- `.planning/REQUIREMENTS.md` — XCOHORT-01 (cohort selector, max 4), XCOHORT-02 (per-patient suppressed), XCOHORT-03 (legend N=), XCOHORT-04 (?cohorts= URL), VIS-04 (spaghetti hierarchy)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `OutcomesSettingsDrawer.tsx` — Slide-over drawer component; CohortCompareDrawer should clone this layout (fixed right panel, overlay backdrop, close button)
- `useData().savedSearches` — Already available in `OutcomesView` context; no new data fetching needed
- `computeCohortTrajectory` / `computeCrtTrajectory` — Call once per selected cohort; results aggregated into an array of `TrajectoryResult` objects
- `applyFilters(activeCases, saved.filters)` — Same filter application used for single cohort; reuse per cohort in comparison

### Established Patterns
- **URL param parsing in OutcomesView**: existing `searchParams.get('cohort')` pattern; extend with `searchParams.get('cohorts')?.split(',')` for multi-cohort
- **Settings drawer trigger**: existing gear icon button in `OutcomesView` header; add compare icon alongside it
- **OutcomesPanel `color` prop**: currently receives a single hex string (`EYE_COLORS[eye]`); in cross-cohort mode the panel needs an array of colors or a different prop shape — researcher/planner should decide whether to extend the existing component or create a new CrossCohortPanel

### Integration Points
- `OutcomesView` header — Add CohortCompareDrawer trigger icon alongside existing settings gear
- `OutcomesPanel.tsx` — Either extend or wrap to support multiple `PanelResult[]` with per-cohort colors
- `palette.ts` — Add `COHORT_PALETTES: readonly string[]` with 4 colors
- `OutcomesView` URL effect — Add `?cohorts=` serialization when compare drawer selection changes

</code_context>

<specifics>
## Specific Ideas

- The compare icon trigger should use `GitCompare` or `Layers` from lucide-react (already a dep)
- `COHORT_PALETTES` must not overlap with `EYE_COLORS` (blue/red/violet) — researcher should pick from amber, emerald, cyan, teal, or similar orthogonal palette
- Per-patient desaturation (VIS-04): `#9ca3af` (Tailwind gray-400) is a neutral mid-tone; actual color can be decided by planner to match design language
- Cross-cohort mode changes the header subtitle from "N patients" to something like "4 cohorts · Cohort A, B, C, D"

</specifics>

<deferred>
## Deferred Ideas

- Chart layout: single-chart or eye-selector tabs — user chose 3-panel grid, so these options are deferred
- Per-patient line toggle in cross-cohort mode — locked off (not configurable)
- Per-cohort axis mode / yMetric overrides — deferred; single global setting applies to all cohorts
- Phase 17 (dark mode) will need `COHORT_PALETTES` dark-mode variants — note for Phase 17 planner

</deferred>

---

*Phase: 16-cross-cohort-comparison*
*Context gathered: 2026-04-21*
