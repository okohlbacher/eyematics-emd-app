---
phase: 40-savedsearch-quality-config
plan: "02"
subsystem: api
tags: [security, saved-search, quality-params, tdd, back-compat, QUAL-021]

# Dependency graph
requires:
  - phase: 40-01
    provides: "Hardened POST /saved-searches (F-13); shared/savedSearchSanitize.ts"
provides:
  - "shared/qualityParams.ts — QUALITY_PARAM_KEYS, sanitizeQualityParams, resolveQualityParams"
  - "SavedSearch.qualityParams optional field (back-compat tri-state)"
  - "saved_searches.quality_params DB column + idempotent migration"
  - "POST /saved-searches sanitizes qualityParams on write; GET maps to client"
  - "Cohort builder save-flow checklist (6 checks, default all-checked)"
  - "resolveQualityParams fallback for old records (undefined ⇒ all)"
affects:
  - 40-03 (QUAL-022 quality review page can honor cohort-specific check set via resolveQualityParams)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tri-state semantics: undefined ⇒ all (back-compat); [] ⇒ none; subset ⇒ those — documented in shared/qualityParams.ts"
    - "sanitizeQualityParams: whitelist against QUALITY_PARAM_KEYS, dedupe, undefined→undefined for non-array input (T-40-07/08)"
    - "resolveQualityParams: selection ?? [...QUALITY_PARAM_KEYS] — consistent back-compat expansion for all consumers"
    - "Idempotent ALTER TABLE migration using table_info pragma (mirrors existing PK-migration guard)"
    - "send qualityParams: undefined when all are checked (canonical all ⇒ old-record indistinguishable)"

key-files:
  created:
    - shared/qualityParams.ts
    - tests/qualityParams.test.ts
    - tests/dataApiQualityParams.test.ts
  modified:
    - shared/types/fhir.ts
    - server/dataDb.ts
    - server/dataApi.ts
    - src/context/DataContext.tsx
    - src/pages/CohortBuilderPage.tsx
    - src/i18n/translations.ts

key-decisions:
  - "Send qualityParams: undefined on save when all six keys are checked — ensures all-checked records are indistinguishable from old records to resolveQualityParams(), preserving back-compat"
  - "sanitizeQualityParams returns undefined for non-array input (object/string/number) — treated as unset, not as an error"
  - "GET /saved-searches omits qualityParams key entirely when quality_params is NULL — JSON property absent means undefined to client, triggering all-checks fallback via resolveQualityParams"
  - "Idempotent migration via table_info check; mirrors existing PK migration guard at DB init"

# Metrics
duration: 6min
completed: 2026-05-25
---

# Phase 40 Plan 02: QUAL-021 Persisted qualityParams Summary

**Per-cohort quality-parameter selection (six check keys) persists with SavedSearch through the F-13 sanitized path; old records back-compat via tri-state undefined=all/[]=none/subset**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-25T21:13:29Z
- **Completed:** 2026-05-25T21:19:00Z
- **Tasks:** 3 (6 commits: 2 RED + 2 GREEN + 1 feat + 1 feat)
- **Files modified:** 8

## Accomplishments

- Created `shared/qualityParams.ts`: `QUALITY_PARAM_KEYS` (six canonical check keys, frozen), `QualityParamKey` type, `sanitizeQualityParams(raw: unknown): string[] | undefined` (whitelist + dedupe; non-array → undefined; T-40-07/08), `resolveQualityParams(selection): string[]` (tri-state expansion)
- Extended `shared/types/fhir.ts`: `SavedSearch.qualityParams?: string[]` with tri-state doc comment
- Extended `server/dataDb.ts`: `quality_params TEXT` column in CREATE TABLE; idempotent ALTER TABLE migration (table_info guard); `SavedSearchRow.quality_params?: string | null`; SELECT and INSERT updated
- Extended `server/dataApi.ts`: imports `sanitizeQualityParams`; POST sanitizes incoming qualityParams → quality_params JSON or NULL; GET parses quality_params → qualityParams array (omitted when NULL); POST 201 response includes qualityParams when defined
- Extended `src/context/DataContext.tsx`: `addSavedSearch` accepts optional `qualityParams?: string[]` in input type; forwarded in POST body
- Added quality-param checklist to `src/pages/CohortBuilderPage.tsx`: `selectedQualityParams` Set state (default all-checked); six-item checkbox list using QUALITY_PARAM_KEYS; handleSave sends `undefined` when all checked (back-compat), subset otherwise; handleLoadSearch restores checklist via `resolveQualityParams(s.qualityParams)`
- Added i18n keys to `src/i18n/translations.ts`: `qualityParamsLabel`, `qualityParamsHint`, `crtCritical`, `visusCritical` (de+en)

## Task Commits

Each task committed atomically (TDD RED → GREEN):

1. **Task 1 RED — Failing tests for qualityParams module** — `8ee63e7` (test)
2. **Task 1 GREEN — Implement shared/qualityParams.ts + SavedSearch type** — `bcc2b6a` (feat)
3. **Task 2 RED — Failing contract tests for API qualityParams persistence** — `cd4f60a` (test)
4. **Task 2 GREEN — DB column, migration, API sanitize/map** — `3f5e841` (feat)
5. **Task 3 — Cohort builder checklist + i18n + DataContext wire-up** — `07b42f4` (feat)

## Files Created/Modified

- `shared/qualityParams.ts` — QUALITY_PARAM_KEYS, sanitizeQualityParams, resolveQualityParams; tri-state semantics documented
- `shared/types/fhir.ts` — SavedSearch.qualityParams optional field
- `tests/qualityParams.test.ts` — 18 tests: all keys, frozen, undefined→undefined, []→[], strip-unknown, dedupe, non-array→undefined, resolveQualityParams fallback
- `tests/dataApiQualityParams.test.ts` — 7 tests: strip-unknown POST, null-on-missing POST, non-array POST, response includes qualityParams, GET JSON→array, GET null→absent
- `server/dataDb.ts` — quality_params column, ALTER TABLE migration, SavedSearchRow, SELECT, INSERT
- `server/dataApi.ts` — import sanitizeQualityParams; POST write path; GET map path
- `src/context/DataContext.tsx` — addSavedSearch type extended with qualityParams
- `src/pages/CohortBuilderPage.tsx` — selectedQualityParams state, checklist UI, handleSave payload, handleLoadSearch restore
- `src/i18n/translations.ts` — qualityParamsLabel, qualityParamsHint, crtCritical, visusCritical (de+en)

## Decisions Made

- **All-checked → send undefined:** When all six keys are checked, send `qualityParams: undefined` (not the explicit full array). This keeps "all default checks" records indistinguishable from old records to `resolveQualityParams()`, preserving back-compat semantics and avoiding unnecessary storage.
- **Non-array qualityParams → undefined (not error):** A non-array value passed as qualityParams (object, string, number) is treated as unset — consistent with the sanitizer contract (D-03 throw-only applies to runtime failures, not to external-input sanitization).
- **GET: omit qualityParams key when NULL:** Rather than sending `qualityParams: null`, the GET handler omits the property entirely. This means the client sees `undefined` (JSON property absent), which correctly triggers the `resolveQualityParams` fallback to all checks.

## Deviations from Plan

None — plan executed exactly as written. All tasks completed cleanly on first attempt.

## Known Stubs

None — qualityParams flows end-to-end: POST persists → GET returns → handleLoadSearch restores. The 40-03 plan will consume `resolveQualityParams` to drive actual check behavior in the quality review page.

## Threat Flags

None — all STRIDE threats from the plan's threat model mitigated or accepted per plan:
- T-40-07/08: sanitizeQualityParams whitelist (mitigated — Tasks 1+2)
- T-40-09: GET parse try/catch + warn (accepted — per plan)
- T-40-10: qualityParams is user preference, not provenance (accepted — per plan)

## TDD Gate Compliance

- RED gate: `test(40-02)` commits `8ee63e7` (Task 1), `cd4f60a` (Task 2) — both confirmed
- GREEN gate: `feat(40-02)` commits `bcc2b6a` (Task 1), `3f5e841` (Task 2) — both confirmed

## Self-Check: PASSED

- `shared/qualityParams.ts` — FOUND
- `tests/qualityParams.test.ts` — FOUND
- `tests/dataApiQualityParams.test.ts` — FOUND
- Commits 8ee63e7, bcc2b6a, cd4f60a, 3f5e841, 07b42f4 — confirmed in git log
- `npm run test:ci` — 999/999 passed

---
*Phase: 40-savedsearch-quality-config*
*Completed: 2026-05-25*
