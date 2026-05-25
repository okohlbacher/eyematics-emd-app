---
phase: 40-savedsearch-quality-config
plan: "01"
subsystem: api
tags: [security, saved-search, filter-sanitization, server-side-provenance, tdd]

# Dependency graph
requires:
  - phase: 36-phase
    provides: safePickCohortFilter whitelist pattern (cohortFilterSerialization.ts)
provides:
  - Server-safe CohortFilter whitelist (shared/savedSearchSanitize.ts) — server twin of safePickCohortFilter
  - POST /saved-searches generates id+createdAt server-side; ignores client-supplied values
  - Filter sanitization at API boundary before persistence (unknown keys stripped)
  - Client DataContext.addSavedSearch adopts server-returned canonical SavedSearch record
affects:
  - 40-02 (QUAL-020 qualityParams field flows through hardened sanitizer)
  - Any future SavedSearch shape change must update shared/savedSearchSanitize.ts

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-owned provenance: crypto.randomUUID() + new Date().toISOString() generated server-side on create; client values ignored"
    - "Shared whitelist sanitizer pattern (D-01): cross-boundary helper in shared/ operating on wire form (string[], not Set)"
    - "Center validation runs against raw filters before sanitization so caseId keys are checked even if not in CohortFilter whitelist"

key-files:
  created:
    - shared/savedSearchSanitize.ts
    - tests/savedSearchSanitize.test.ts
    - tests/dataApiSavedSearch.test.ts
  modified:
    - server/dataApi.ts
    - src/context/DataContext.tsx
    - src/pages/CohortBuilderPage.tsx

key-decisions:
  - "Center ownership check runs against raw filters before sanitization — ensures caseIds/selectedCases are validated even though they are not whitelisted CohortFilter keys"
  - "flaggedCaseIds stays as string[] in shared sanitizer (wire form) — server cannot construct Set; safePickCohortFilter (client) still builds Set for runtime use"
  - "DataContext.addSavedSearch changed from optimistic (append-before-POST) to adopt-after-response — ensures state always reflects server-generated id/createdAt"
  - "wireFilters conversion in CohortBuilderPage: flaggedCaseIds Set is Array.from'd before POST (existing pattern extended to the new call site)"

patterns-established:
  - "shared/savedSearchSanitize.ts is the canonical server-safe filter whitelist — must be updated when CohortFilter gains new fields"
  - "TDD RED/GREEN cycle used for both sanitizer unit tests and server contract tests"

requirements-completed: [SEC-06]

# Metrics
duration: 7min
completed: 2026-05-25
---

# Phase 40 Plan 01: SavedSearch Server Foundation Summary

**Server now owns SavedSearch provenance (crypto.randomUUID + ISO timestamp) and sanitizes incoming filters through a shared wire-form whitelist before persistence, eliminating client-spoofing and arbitrary-object-injection surfaces**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-25T23:05:00Z
- **Completed:** 2026-05-25T23:11:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Created `shared/savedSearchSanitize.ts` — server-safe twin of `safePickCohortFilter`; keeps `flaggedCaseIds` as `string[]` (wire form, no Set); strips every non-whitelisted key including `__proto__` / `constructor` (SEC-06, T-40-02/03)
- Hardened `POST /saved-searches`: server generates `id` via `crypto.randomUUID()` and `createdAt` via `new Date().toISOString()`; client-supplied values ignored; filters sanitized before persistence; size cap applied after sanitization; center ownership validated against raw filters before whitelist copy (T-40-01 through T-40-05)
- Updated client `DataContext.addSavedSearch` and `CohortBuilderPage.handleSave`: no longer generate `id`/`createdAt`; send `{ name, filters }` only; append server-returned canonical record to state after 201 response

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for sanitizeSavedSearchFilters** - `ed16cfb` (test)
2. **Task 1 GREEN: Implement sanitizeSavedSearchFilters** - `6d4c428` (feat)
3. **Task 2 RED: Failing contract tests for POST /saved-searches** - `cf71b55` (test)
4. **Task 2 GREEN: Harden POST /saved-searches** - `4ca83b5` (feat)
5. **Task 3: Client adopts server-returned SavedSearch** - `786efcf` (feat)

## Files Created/Modified

- `shared/savedSearchSanitize.ts` — Server-safe CohortFilter whitelist; flaggedCaseIds as string[]; D-01 cross-boundary helper
- `tests/savedSearchSanitize.test.ts` — 34 unit tests: non-object inputs, prototype pollution, all 13 known keys, preset/laterality literals, range tuple length guard
- `tests/dataApiSavedSearch.test.ts` — 6 contract tests: server ignores client id/createdAt, strips evil filter keys, 400 on missing/blank name, 403 on cross-center caseIds
- `server/dataApi.ts` — POST /saved-searches hardened; imports sanitizeSavedSearchFilters; import sort fixed
- `src/context/DataContext.tsx` — addSavedSearch signature changed to Pick<SavedSearch, 'name'|'filters'>; adopt-after-response pattern
- `src/pages/CohortBuilderPage.tsx` — handleSave sends {name, wireFilters} without id/createdAt; flaggedCaseIds Set→Array.from conversion

## Decisions Made

- Center ownership check runs against raw filters BEFORE sanitization. Rationale: `caseIds`/`selectedCases` are not whitelisted CohortFilter keys (they appear in legacy filter payloads) so running the check against sanitized filters would silently skip validation.
- `DataContext.addSavedSearch` changed from optimistic (append-before-POST) to adopt-after-response. Rationale: the optimistic pattern needed a server-generated id/createdAt to be correct; there is no meaningful temporary-id to display while the POST is in flight, so append-after is cleaner.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Center validation order: check caseIds against raw filters, not sanitized**
- **Found during:** Task 2 GREEN (writing the POST handler)
- **Issue:** Running `validateCaseCenters` against `safeFilters` would miss `caseIds`/`selectedCases` because they are not whitelisted CohortFilter keys and get stripped by sanitization before the center check
- **Fix:** Center ownership check runs on `rawFiltersObj` extracted from `req.body.filters` before calling `sanitizeSavedSearchFilters`
- **Files modified:** server/dataApi.ts
- **Verification:** Test (e) in dataApiSavedSearch.test.ts passes (403 on cross-center caseIds)
- **Committed in:** 4ca83b5

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in validation ordering)
**Impact on plan:** Necessary correctness fix. The plan correctly described the intent (center validation) but the naive implementation ordering would have silently broken it.

## Issues Encountered

None — all tasks completed cleanly on first attempt after the validation-ordering fix.

## Known Stubs

None — all wire-up is complete; server generates real ids; client adopts real server responses.

## Threat Flags

None — all STRIDE threats from the plan's threat model (T-40-01 through T-40-05) are mitigated. T-40-06 (corrupt old-row filters on GET) was accepted per plan.

## Next Phase Readiness

- Hardened SavedSearch path is ready for 40-02 (QUAL-020 qualityParams field)
- `shared/savedSearchSanitize.ts` must be updated when the new `qualityParams` field is added to CohortFilter
- Back-compat: existing rows (created before this change) load unchanged via GET (server never re-sanitizes on read)
- Test baseline: 975/975 (was 935; +40 from new test files)

## Self-Check: PASSED

- `shared/savedSearchSanitize.ts` — FOUND
- `tests/savedSearchSanitize.test.ts` — FOUND
- `tests/dataApiSavedSearch.test.ts` — FOUND
- Commits ed16cfb, 6d4c428, cf71b55, 4ca83b5, 786efcf — all confirmed in git log

---
*Phase: 40-savedsearch-quality-config*
*Completed: 2026-05-25*
