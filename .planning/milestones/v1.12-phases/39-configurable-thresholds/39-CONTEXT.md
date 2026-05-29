# Phase 39: Configurable Clinical Thresholds + Server/Client Parity - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning
**Mode:** Auto (decisions D1/D1b/F-01 locked)

<domain>
## Phase Boundary
Make clinical thresholds configurable (CFG-01/02/03). Two threshold categories, both moved to `config/settings.yaml` and admin-editable in the existing `SettingsPage`; server outcome aggregation must use the same settings-derived values as the client.
</domain>

<decisions>
## Implementation Decisions (locked)
- **D1 — global scope:** one global set of thresholds (no per-site/per-cohort). Admin-editable.
- **D1b — taxonomy, both editable:**
  - *Critical/action thresholds* (today in `src/config/clinicalThresholds.ts`): CRT critical, Visus critical, IOP critical, Visus-jump, therapy interrupter days, therapy breaker days, CRT-implausible (already partly in settings). → move to `settings.yaml` (`thresholds.*`), admin-editable.
  - *Plausibility ranges* (today hardcoded in `qualityMetrics.ts`: Visus 0..2.0, CRT 100..800, IOP 5..40 min/max) → `settings.yaml` (`plausibility.*`), admin-editable.
- **F-01 — parity:** `server/outcomesAggregateApi.ts` must inject settings-derived threshold options into `applyFilters(cases, filters, options)` (today omits options → falls back to hardcoded defaults in `shared/patientCases.ts`). Server-aggregate cache key must include the threshold values (or invalidate on change) so cached results don't go stale after a threshold edit.
- **Config single source:** `config/settings.yaml` only (no env vars); follow the existing `settingsService` + `AppSettings` + `DEFAULTS` pattern established for `auth.*` TTL config (v1.10 Phase 28). Reuse the `SettingsPage` form patterns (validation, persist, success banner) and `validateTtl`-style validation.
- Non-admin GET /api/settings must not leak anything secret — thresholds are operational params (like the auth TTLs), so they may be returned to non-admins (parity with existing W5 decision).
- ### Claude's Discretion: exact YAML key names + field grouping in the Settings UI; validation bounds (e.g. Visus 0–2, CRT/IOP positive); whether to keep thin re-export shims in `clinicalThresholds.ts`/`qualityMetrics.ts` that read from settings (recommended to minimize call-site churn).
</decisions>

<code_context>
## Existing Code Insights
- `src/config/clinicalThresholds.ts` — `CRITICAL_CRT_THRESHOLD`, `CRITICAL_VISUS_THRESHOLD`, `CRITICAL_IOP_THRESHOLD`, `VISUS_JUMP_THRESHOLD`; consumed by `useCaseData.ts`, `QualityCaseDetail.tsx`, `VisusCrtChart.tsx`, `QualityPage.tsx`.
- `src/utils/qualityMetrics.ts` — hardcoded plausibility bands (Visus 0..2.0, CRT 100..800, IOP 5..40).
- `shared/patientCases.ts` — `applyFilters(cases, filters, options?)`; option fields incl. `crtImplausibleThresholdUm`, `therapyInterrupterDays`, `therapyBreakerDays` (added in v1.11 Phase 33). Server omits the options arg today.
- `server/outcomesAggregateApi.ts` — calls `applyFilters(cases, filters)` (no options); has a TTL/result cache.
- `src/services/settingsService.ts` + `AppSettings` + `DEFAULTS` — established config pattern; `SettingsPage.tsx` has the admin form (TTL config from v1.10) to extend.
- `config/settings.yaml` — has `auth.*`, `crtImplausibleThresholdUm`, `stubs.*` already.
- settingsService loads server-side from settings.yaml and is also read client-side via getSettings().
</code_context>

<specifics>
## Specific Ideas
Centralize via settings.yaml + settingsService; keep call sites reading through a settings-backed accessor (replace the hardcoded constants with getters that read AppSettings). Add SettingsPage form sections "Clinical thresholds" and "Plausibility ranges" mirroring the TTL form. Add a server parity test: a preset cohort (e.g. implausibleCrt) aggregates the same case set server-side and client-side after a threshold change.
</specifics>

<deferred>
## Deferred Ideas
Per-site / per-cohort thresholds (D1 deferred to future milestone).
</deferred>
