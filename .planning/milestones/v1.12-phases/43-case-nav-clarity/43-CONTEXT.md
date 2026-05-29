# Phase 43: Case Navigation, Reference & Chart Clarity - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning
**Mode:** Auto (UX defaults taken + logged in v1.12-deferred-questions.md Q-43; confirm at Phase 45)

<domain>
## Phase Boundary
Case-view improvements (FALL-010/011/012, CHART-01):
- **FALL-010:** drill from a chart data point in the trajectory ("Verläufe") plots to the corresponding case detail.
- **FALL-011:** show cohort reference values for comparison against the single case in the case view.
- **FALL-012:** self-explanatory case-detail chart labels — CRT legend label, Visus measurement-type (axis/legend), interpolation ("open circle") legend wording.
- **CHART-01:** chart polish — render missing axis ticks (A-06); place the responder "(i)" tooltip adjacent to the plot (ANL-002).
</domain>

<decisions>
## Implementation Decisions (defaults — logged Q-43, confirm at Phase 45)
- **FALL-010:** single-click a data point in the trajectory plot → navigate to that patient's case detail; add a pointer-cursor affordance + accessible activation (keyboard). Reuse existing routing to case detail.
- **FALL-011:** overlay the cohort reference (median + IQR band) on the single-case Visus/CRT trajectory as an optional toggle; reuse existing trajectory/aggregate stats (no new metric).
- **FALL-012 wording (defaults):** CRT legend "CRT (µm)"; Visus Y-axis "Visus (Dezimal, bestkorrigiert)"; interpolation legend "Offener Kreis = interpolierter Wert (keine Messung)". i18n DE+EN. (The Visus measurement method already comes dynamically from `method.coding[].display` — keep that; clarify the static axis label + interpolation note.)
- **CHART-01:** ensure axis ticks render on the affected case/analysis charts (A-06 — best-effort; needs user screenshot to confirm exact chart); move the responder info "(i)" closer to the plot (ANL-002).
- ### Claude's Discretion: exact drill-down affordance + reference-band styling; whether FALL-011 is a toggle or always-on; tick configuration specifics.
</decisions>

<code_context>
## Existing Code Insights
- `src/components/case-detail/VisusCrtChart.tsx` — CRT line `name="CRT (µm)"` hardcoded (FALL-012); Y-axis "Visus (dezimal)" hardcoded; interpolation hint via i18n `interpolatedHint`; Visus method from `visusObs[0].method.coding[0]?.display` (translateClinical).
- Trajectory/"Verläufe" plots in OutcomesView/components (FALL-010 drill-down source); navigation to case detail exists (CaseDetailPage route).
- Responder "(i)" tooltip — in ResponderView/OutcomesView (ANL-002 placement).
- Cohort aggregate stats (median/IQR) available from shared trajectory/aggregate helpers (FALL-011 reference).
- Phase 44 will decompose OutcomesView (F-10) — keep FALL-010 changes localized.
</code_context>

<specifics>
## Specific Ideas
Drill-down: clickable trajectory points → case detail. Reference overlay: cohort median/IQR band on case trajectory. Labels: fix CRT/Visus/interpolation wording (i18n). Polish: axis ticks + responder tooltip placement. RTL no jest-dom.
</specifics>

<deferred>
## Deferred Ideas
A-06 exact repro pending user screenshot (Q-43). FALL-006 deeper case-vs-cohort analytics beyond the reference overlay → backlog.
</deferred>
