# Phase 40: SavedSearch Hardening + Quality Check Configuration - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning
**Mode:** Auto (D2 locked: QUAL-001 persists with SavedSearch)

<domain>
## Phase Boundary
Two coupled workstreams on the SavedSearch persistence path:
1. **SEC-06 / F-13 (server foundation):** the server owns SavedSearch provenance — generates `id` + `createdAt` server-side and sanitizes incoming `filters` at the API boundary (today the client generates them and the server persists a generic object).
2. **QUAL-020 / QUAL-021:** a user can run the quality review scoped to a selected cohort/subcohort, and can select WHICH parameters are checked for that subcohort; the selection persists with the saved cohort (D2). Built ON TOP of the hardened SavedSearch path so the new field flows through sanitization from the start.
</domain>

<decisions>
## Implementation Decisions (locked)
- **D2:** the per-subcohort check-parameter selection PERSISTS as a field on `SavedSearch` (changes its shape). Reuse the existing `safePickCohortFilter`/serialization pattern (v1.11 Phase 36 F-04) for the new field's sanitization.
- **F-13 design:** server generates `id` (e.g. crypto.randomUUID) + `createdAt` ISO timestamp on create; client no longer trusts/sends them (or server overwrites). Server sanitizes `filters` via the shared safe-pick whitelist at the `server/dataApi.ts` save endpoint before persistence. Existing saved searches migrate cleanly (back-compat: tolerate old records lacking the new field; treat missing param-selection as "all default checks").
- **Threshold snapshot:** NO — saved cohorts evaluate against live global thresholds (Phase 39). The persisted field is only the parameter selection, not threshold values. (Deferred Q-40-1; default logged.)
- **Quality checks reuse Phase 39 settings:** the configurable parameters map to the existing anomaly checks (missing Visus/CRT/injection, critical values, jumps) which now read settings-derived thresholds.
- ### Claude's Discretion: exact SavedSearch field name (e.g. `qualityParams` / `checkParams`); UI placement of the parameter checklist (in cohort builder save flow and/or QualityPage when a cohort is selected); whether cohort-scoped quality is a filter on QualityPage or a dedicated entry.
</decisions>

<code_context>
## Existing Code Insights
- `SavedSearch` type + `DataContext` (`savedSearches`, `addSavedSearch`, `removeSavedSearch`); loaded from `/api/data/saved-searches`.
- `src/pages/CohortBuilderPage.tsx` creates SavedSearch (currently client-side id/createdAt — F-13 target).
- `server/dataApi.ts` (~:173, :210) persists saved searches — accepts generic `filters`; add server-side id/createdAt + filter sanitization here.
- `src/utils/cohortFilterSerialization.ts` — shared `safePickCohortFilter` (v1.11 F-04) to reuse for sanitization.
- `src/pages/QualityPage.tsx` — anomaly detection over `cases` (fixed param set today); QUAL-020 scopes it to a cohort; QUAL-021 makes the param set configurable.
- `shared/cohortNames.ts` — subcohort convention (`Parent:Sub`).
- Quality anomaly checks read thresholds via accessors after Phase 39.
</code_context>

<specifics>
## Specific Ideas
Do F-13 server hardening FIRST (id/createdAt server-owned + filter sanitization + migration tolerance + contract tests), THEN add the persisted `qualityParams` selection field through the hardened path, THEN wire QualityPage to (a) scope to a selected cohort and (b) honor the cohort's parameter selection (fallback to all checks when absent). Server-side filter sanitization must reject/strip unknown filter keys (security: no arbitrary object persistence).
</specifics>

<deferred>
## Deferred Ideas
Threshold-snapshot-with-cohort (Q-40-1, default: no snapshot). Per-cohort thresholds (D1 deferred).
</deferred>
