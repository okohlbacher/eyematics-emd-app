---
phase: 25-terminology-resolver
plan: 01
subsystem: api
tags: [terminology, fhir, snomed, icd-10-gm, react-hooks, cache, vitest]

# Dependency graph
requires:
  - phase: 24-feedback-fixes
    provides: stable v1.9.3 baseline (619 tests green) for the safety net
provides:
  - "src/services/terminology.ts — browser-side resolver module with _seedMap, collectCodings, getCachedDisplay, resolveDisplay, useDiagnosisDisplay (D-04)"
  - "tests/fixtures/terminologyBundle.ts — FHIR bundle fixture covering Condition / Observation / Procedure / Patient (skipped) / no-system coding"
  - "tests/terminology.test.ts — 7 unit tests covering all 5 module export surfaces"
affects: [25-03-caller-migration, 25-04-settings-and-docs]

# Tech tracking
tech-stack:
  added: []  # uses already-installed react + @testing-library/react + vitest
  patterns:
    - "Module-private mutable cache state (Map/Set) with `_resetForTests()` helper for vitest isolation"
    - "Module-level Set<() => void> listener pattern for cross-component re-render on cache writes"
    - "Fire-and-forget async lookup from sync sync helpers; dedupe via _pendingLookups Set"
    - "Cache-raw-on-genuine-miss to suppress repeat fetches for unmapped codes (D-09 note)"

key-files:
  created:
    - src/services/terminology.ts
    - tests/terminology.test.ts
    - tests/fixtures/terminologyBundle.ts
  modified: []

key-decisions:
  - "Seed map carries 10 entries (2 SNOMED + 8 ICD-10-GM), not 9 as plan-text said — legacy `getDiagnosisFullText` covers 10 cases and byte-identical migration (D-08) requires preserving all of them. Tracked as plan-text deviation."
  - "ICD-10 system URL = 'http://fhir.de/CodeSystem/bfarm/icd-10-gm' (BfArM canonical) per D-07 first option."
  - "ICD-10-GM seed entries keep label = raw code (e.g. 'E11.9'), preserving the existing `getDiagnosisLabel` default-branch behavior so the 25-03 caller migration is byte-identical."
  - "Hook test runs in jsdom via per-file `// @vitest-environment jsdom` docblock (default test env is node — see vitest.config.ts)."

patterns-established:
  - "3-tier resolver: L1 cache → server proxy → seed → raw code, with raw-code caching to suppress repeat fetches"
  - "Underscore-prefixed test-only exports (`_seedMap`, `_resetForTests`) per D-04"

requirements-completed: [TERM-01, TERM-05]

# Metrics
duration: 16min
completed: 2026-04-29
---

# Phase 25 Plan 01: Terminology Module Summary

**Browser-side terminology resolver landed at `src/services/terminology.ts` with seed map, collectCodings, 3-tier resolveDisplay/getCachedDisplay, and React hook — module-only landing, no callers wired yet (D-26 wave 1).**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-04-29T19:35:00Z
- **Completed:** 2026-04-29T19:51:00Z
- **Tasks:** 3 (all atomic-committed)
- **Files modified:** 3 created, 0 modified

## Accomplishments

- `src/services/terminology.ts` — full 5-export public surface per D-04 (`collectCodings`, `resolveDisplay`, `getCachedDisplay`, `useDiagnosisDisplay`, `_seedMap`)
- 10-entry seed map keyed `system|code`, strings byte-identical to legacy `fhirLoader.ts:112-170`, ready for the 25-03 byte-identical migration
- 3-tier sync `getCachedDisplay`: L1 → seed → raw code with fire-and-forget async lookup; dedupe via `_pendingLookups`
- 3-tier async `resolveDisplay`: L1 → POST `/api/terminology/lookup` → seed fallback → raw-code cache (suppress repeat fetches)
- `useDiagnosisDisplay` React hook subscribes to a module-level listener Set so any cache write re-renders all mounted hooks
- 7 unit tests cover collectCodings shape, seed byte-identity, sync seed hit (no fetch), sync miss + dedupe, resolveDisplay 200/503 paths, hook re-render

## Task Commits

1. **Task 1: terminology module + seedMap + collectCodings** — `869a3dd` (feat)
2. **Task 2: 3-tier resolveDisplay + getCachedDisplay** — `f8d7835` (feat)
3. **Task 3: useDiagnosisDisplay hook** — `7b00fd1` (feat)

## Files Created/Modified

- `src/services/terminology.ts` (348 lines) — Browser-side resolver module; module-only, no callers wired
- `tests/terminology.test.ts` (176 lines) — 7 unit tests; uses `// @vitest-environment jsdom` for the hook test
- `tests/fixtures/terminologyBundle.ts` (83 lines) — FHIR bundle fixture for collectCodings tests

## Decisions Made

- **Seed has 10 entries, not 9** — plan-text says "9" but legacy `getDiagnosisFullText` covers 10 cases (2 SNOMED + 8 ICD-10-GM). Byte-identical migration (D-08) requires all 10. Tests assert `_seedMap.size === 10` with a code comment explaining the deviation. The 25-03 caller migration depends on this.
- **`_listeners` event fan-out lives in the resolver, not in a separate emitter.** Cache writes call `_notifyAll()` directly. Hook subscribes via `useEffect`. Avoids over-engineering — the 5 callers in scope (per D-19) all read through the hook or `getCachedDisplay`, so a one-file emitter is sufficient.
- **`getCachedFullText` is exported but undocumented in plan.** Plan only lists `getCachedDisplay` in the public API but the hook needs `fullText`. Added as a sibling helper with the same 3-tier shape; same fire-and-forget on miss. Plan 25-03 may import it for tooltip-only contexts that don't need React.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan Inconsistency] Seed entry count: 9 vs 10**
- **Found during:** Task 1
- **Issue:** Plan task 1 says "_seedMap contains exactly 9 entries" but the legacy `getDiagnosisFullText` switch in `fhirLoader.ts:112-170` covers 10 codes (2 SNOMED + 8 ICD-10-GM). D-08 mandates byte-identical strings — dropping any case would break the 25-03 migration.
- **Fix:** Created seed with all 10 entries; test asserts `_seedMap.size === 10` with inline comment documenting the plan-text discrepancy.
- **Files modified:** `src/services/terminology.ts`, `tests/terminology.test.ts`
- **Verification:** All 7 unit tests pass; `npm run test:ci` 642/642 green.
- **Committed in:** `869a3dd`

**2. [Rule 3 - Test Env] jsdom docblock for hook test**
- **Found during:** Task 3
- **Issue:** `vitest.config.ts` defaults to `environment: 'node'`. The RTL `renderHook` call needs DOM globals (`document`, `window`).
- **Fix:** Added `// @vitest-environment jsdom` as line 1 of `tests/terminology.test.ts` (existing pattern — see `tests/authFetchRefreshSuite.test.ts`).
- **Files modified:** `tests/terminology.test.ts`
- **Verification:** Test E now passes; node-env tests still pass since they don't touch DOM.
- **Committed in:** `7b00fd1`

---

**Total deviations:** 2 auto-fixed (1 plan inconsistency, 1 test-env config)
**Impact on plan:** Both deviations preserve plan intent (byte-identical migration; hook re-renders correctly). No scope creep.

## Issues Encountered

- **Worktree had pre-existing uncommitted Plan 25-02 work** (`server/terminologyApi.ts`, `tests/terminologyApi.test.ts`, `server/index.ts` mod) ahead of the user-stated `Base commit: 97f8e4e`. These are from an earlier 25-02 execution and were committed before this 25-01 run started (`d5f6b90`, `bb2d630`). They inflate the test-count delta from "+~5" to "+~23" but are out-of-scope for 25-01. Left untouched.

## User Setup Required

None — no external service configuration required. Plan 25-04 will document `terminology.*` settings keys.

## Next Phase Readiness

- Plan 25-02 (server proxy) is already committed in this worktree (pre-existing).
- Plan 25-03 (caller migration) can proceed: 5 callers will swap `getDiagnosisLabel(code, locale)` for `getCachedDisplay(coding.system, coding.code, locale)` or `useDiagnosisDisplay(...)` per D-19. Byte-identical seed strings guarantee no UI diff.
- Plan 25-04 will document the three new `terminology.*` settings keys (D-16).

## Self-Check

Files exist:
- FOUND: `src/services/terminology.ts`
- FOUND: `tests/terminology.test.ts`
- FOUND: `tests/fixtures/terminologyBundle.ts`

Commits exist:
- FOUND: `869a3dd` (Task 1)
- FOUND: `f8d7835` (Task 2)
- FOUND: `7b00fd1` (Task 3)

Safety net at end of plan:
- `npm run test:ci` — 642/642 passing (61 test files)
- `npm run build` — green
- `npm run lint` — green (0 errors, 0 warnings)
- `npm run knip` — green (no new dead exports)

## Self-Check: PASSED

---
*Phase: 25-terminology-resolver*
*Completed: 2026-04-29*
