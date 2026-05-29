# Phase 41: Doc-Quality Correctness, Multi-Select Centers & UX - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning
**Mode:** Auto (D3 locked: multi-select centers IN)

<domain>
## Phase Boundary
Four quality-module fixes (QUAL-022/023/024/025), mostly on `QualityPage` + the quality components:
- **QUAL-022:** Grundgesamtheit (population denominator) reflects the active time-range filter (today: `cases.length`, no time state).
- **QUAL-023:** absolute counts discoverable on the overview (SummaryCards already render count+% — verify prominence/discoverability; the user "couldn't find" them).
- **QUAL-024 (D3):** multi-select center filter, shared by quality + analysis; server still restricts to the user's authorized centers (no privilege escalation).
- **QUAL-025:** approve/flag dropdown reachable without scrolling past all patient data.
</domain>

<decisions>
## Implementation Decisions
- **D3 multi-select centers:** replace the single-select center dropdown with a multi-select control. Build it as a SHARED component reused by QualityPage AND AnalysisPage (Phase 42 will consume it). The server center-restriction path (`filterBundlesByCenters` / center-scoped data) must INTERSECT the multi-selection with the user's authorized centers — selecting centers you aren't authorized for must NOT widen results (defense stays server-side).
- **QUAL-022 time filter:** add a time-range filter to QualityPage and make the Grundgesamtheit denominator + all summary counts respect it. Mirror any existing time-range pattern (e.g. DocQualityPage may already have one — reuse).
- **QUAL-023 discoverability:** the user reported they "cannot find the absolute values" though SummaryCards render count+%. Likely a prominence/labeling issue or they were on the wrong page. Make absolute counts visually clear (label + value) on the main Datenqualität overview. (Deferred UX nuance — default: increase prominence + clear labels; log Q for confirmation at Phase 45.)
- **QUAL-025:** move/duplicate the approve/flag status control so it's reachable near the top of the case detail (not only after the full values table).
- ### Claude's Discretion: exact multi-select widget (checkbox dropdown vs chips); time-range control style; SummaryCard layout tweaks.
</decisions>

<code_context>
## Existing Code Insights
- `src/pages/QualityPage.tsx` — single-select center dropdown (always visible per v1.10 QUAL-011 fix); SummaryCards render count+% (`QualityPage.tsx:27-40`); no time-range state; denominator `cases.length`.
- `src/components/quality/QualityCaseDetail.tsx` — approve/flag control currently after the values table (QUAL-025 target).
- `src/components/quality/QualityCaseList.tsx` — list + center filter prop.
- Server center restriction: `filterBundlesByCenters` (server enforces authorized centers regardless of client filter); user's authorized centers from auth.
- `DocQualityPage.tsx` — has time-range filtering (reuse pattern for QUAL-022).
- Analysis center filter (AnalysisPage / OutcomesView) — will consume the shared multi-select component in Phase 42.
</code_context>

<specifics>
## Specific Ideas
Build a shared `CenterMultiSelect` component (client filter), wire it into QualityPage; QualityPage time-range filter drives Grundgesamtheit + summary counts; ensure server still intersects center selection with authorized centers (add/confirm a server test). Reposition the approve dropdown. RTL no jest-dom.
</specifics>

<deferred>
## Deferred Ideas
QUAL-023 discoverability is partly a "which page were you on" question (Q logged for Phase 45). Imputation (QUAL-004) out of scope.
</deferred>
