---
phase: 14-security-quick-wins-performance
plan: 02
subsystem: performance
tags: [typescript, fhir, map, performance, cache, startup]

requires:
  - phase: 12-server-side-outcomes-pre-aggregation
    provides: shared/patientCases.ts extracted as shared module; getCachedBundles exported from server/fhirApi.ts
provides:
  - groupBySubject<T> helper reducing extractPatientCases from O(N×M) to O(N+M)
  - FHIR bundle cache warm IIFE at server startup eliminating cold-start latency spike
affects:
  - shared/patientCases.ts users (server aggregation, client fhirLoader)
  - server startup sequencing

tech-stack:
  added: []
  patterns:
    - "Map pre-grouping pattern: build Map<subject.reference, T[]> once before patients.map() for O(1) per-patient lookups"
    - "Non-fatal startup IIFE: void (async () => { try { await warmCache() } catch { warn } })() for optional pre-warming"

key-files:
  created:
    - tests/patientCases.test.ts
  modified:
    - shared/patientCases.ts
    - server/index.ts

key-decisions:
  - "Map pre-grouping over Array.prototype.find — Map.get is O(1) vs O(M) per patient, avoids reference closure issues"
  - "Non-fatal IIFE for cache warm — void cast ensures no floating promise; server starts regardless of Blaze availability"
  - "groupBySubject as private function (not exported) — pure internal optimization, same output contract"

patterns-established:
  - "groupBySubject<T extends { subject: { reference: string } }>: reusable pattern for any FHIR resource with .subject.reference"
  - "Non-fatal startup task: void (async () => { try { await task() } catch { warn } })() — does not block app.listen()"

requirements-completed: [PERF-01, PERF-02]

duration: 5min
completed: 2026-04-17
---

# Phase 14 Plan 02: Performance Quick Wins Summary

**O(N+M) Map pre-grouping in extractPatientCases + non-fatal FHIR cache warm IIFE at server startup**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-17T10:18:09Z
- **Completed:** 2026-04-17T10:22:37Z
- **Tasks:** 2
- **Files modified:** 3 (shared/patientCases.ts, server/index.ts, tests/patientCases.test.ts)

## Accomplishments

- Eliminated 5 O(M) `.filter()` loops inside `patients.map()` by pre-building 5 `Map<string, T[]>` before the map iteration — reduces multi-center bundle processing from O(N×M) to O(N+M)
- Added `groupBySubject<T>` private helper accepting any FHIR resource with `.subject.reference`, reusable for future resource types
- Inserted non-fatal cache warm IIFE in `server/index.ts` after `startPurgeInterval()` — first request after deployment no longer pays the FHIR bundle load cost
- Created 4 parity tests in `tests/patientCases.test.ts` verifying cross-contamination guard, empty resource arrays, per-patient isolation, and multi-bundle scenarios

## Task Commits

Each task was committed atomically:

1. **Task 1 (test/RED): parity tests** - `75ca26c` (test)
2. **Task 1 (feat/GREEN): O(N+M) refactor** - `8744c0e` (perf)
3. **Task 2: cache warm IIFE** - included in `6bc57dd` (server/index.ts committed alongside 14-01 index.ts change due to stash pop timing)

## Files Created/Modified

- `shared/patientCases.ts` - Added `groupBySubject<T>` helper + 5 pre-built Maps before `patients.map()`; replaced 5 `.filter()` calls with `Map.get() ?? []`
- `server/index.ts` - Added `getCachedBundles` to fhirApi import + non-fatal IIFE after `startPurgeInterval()`
- `tests/patientCases.test.ts` - New file: 4 parity tests for extractPatientCases Map correctness

## Decisions Made

- Used private (non-exported) `groupBySubject` — the optimization is internal; output contract is identical
- `?? []` (nullish coalescing) over `.get(ref) || []` — correct handling if Map contains an empty array (edge case)
- IIFE fired with `void` cast — avoids unhandled promise rejection while keeping the non-blocking async pattern

## Deviations from Plan

None - plan executed exactly as written.

Note: The PERF-02 `server/index.ts` changes ended up in the 14-01 commit (`6bc57dd`) due to a stash pop timing interaction during parallel plan execution. The changes are correct and committed — only the commit attribution differs from the expected per-task commit.

## Issues Encountered

Pre-existing test failures (40 tests in hashCohortId.test.ts, auditApi.test.ts, outcomesAggregateApi.test.ts, outcomesAggregateParity.test.ts) caused by the 14-01 `initHashCohortId` signature change from `(settings)` to `(dataDir, settings)`. These failures were present before 14-02 work began and are out of scope for this plan — the 14-01 fix commit `90b650e` addresses them.

Tests directly in scope for 14-02 all pass:
- `tests/patientCases.test.ts` — 4/4 pass
- `tests/fhirApi.test.ts` — all pass
- `tests/fhirApiPlugin.test.ts` — all pass

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 14-02 complete: PERF-01 and PERF-02 requirements met
- Ready for 14-03 (ARIA accessibility labels for trajectory chart containers)
- Pre-existing test failures from 14-01 should be resolved before full `npm test` is used as a gate

---
*Phase: 14-security-quick-wins-performance*
*Completed: 2026-04-17*

## Self-Check

Verifying key artifacts:

- shared/patientCases.ts contains groupBySubject: FOUND
- shared/patientCases.ts has no .filter() inside patients.map(): CONFIRMED (remaining filters are in resourcesOfType and applyFilters)
- server/index.ts contains getCachedBundles import: FOUND (line 44)
- server/index.ts contains FHIR bundle cache warmed log: FOUND (line 149)
- tests/patientCases.test.ts exists: FOUND (created in this plan)
- Commits 75ca26c and 8744c0e exist: CONFIRMED (git log shows both)

## Self-Check: PASSED
