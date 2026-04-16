---
phase: 12
plan: 04
subsystem: client-routing
tags: [client, routing, react, i18n, ux, AGG-03]
dependency_graph:
  requires: [12-02, 12-03]
  provides: [AGG-03-client-routing]
  affects: [OutcomesView, settingsService, outcomesAggregateService, i18n]
tech_stack:
  added: [outcomesAggregateService.ts]
  patterns: [size-based-routing, server-error-fallback, parallel-fetch, loading-indicator]
key_files:
  created:
    - src/services/outcomesAggregateService.ts (54 lines)
    - tests/OutcomesViewRouting.test.tsx (316 lines)
  modified:
    - src/services/settingsService.ts (add outcomes? to AppSettings + DEFAULTS)
    - src/components/outcomes/OutcomesView.tsx (add routing logic, loading state, fallback)
    - src/i18n/translations.ts (add outcomesServerComputingLabel DE+EN)
    - tests/OutcomesPage.test.tsx (add settingsService + outcomesAggregateService mocks)
decisions:
  - "Server loading state renders as full early-return spinner (not inline indicator) when no prior aggregate exists; inline span in header only shown when aggregate is already present and a re-fetch fires. This ensures routeServerSide+serverLoading+!serverAggregate always shows the testid=outcomes-server-computing element."
  - "Three parallel POSTs (one per eye: od/os/combined) reassembled into TrajectoryResult for downstream panel compatibility — avoids any consumer changes."
  - "OutcomesPage.test.tsx patched with settingsService+outcomesAggregateService mocks to prevent extra fetch calls breaking beacon-count assertions (Rule 1 bug fix)."
metrics:
  duration: "~25 minutes"
  completed: "2026-04-16"
  tasks: 3
  files_modified: 6
---

# Phase 12 Plan 04: Client-Side Size-Based Routing (AGG-03) Summary

One-liner: Client-side cohort-size threshold routing to POST /api/outcomes/aggregate with 3-parallel-eye fetch, loading indicator, and client fallback on server error.

## What Was Built

### Task 1: outcomesAggregateService + settingsService extension + i18n

**`src/services/outcomesAggregateService.ts`** (54 lines, new)
- Exports `postAggregate(body: AggregateRequest): Promise<AggregateResponse>`
- Uses `authFetch('/api/outcomes/aggregate', { method: 'POST', ... })`
- On non-OK throws `Error('Server aggregate failed: <status>')`
- Exports `AggregateRequest` and `AggregateResponse` types

**`src/services/settingsService.ts`** (modified)
- `AppSettings` gains `outcomes?: { serverAggregationThresholdPatients?: number; aggregateCacheTtlMs?: number }`
- `DEFAULTS.outcomes` set to `{ serverAggregationThresholdPatients: 1000, aggregateCacheTtlMs: 1800000 }`
- Existing `merge()` helper handles nested object without code changes

**`src/i18n/translations.ts`** (modified)
- Added `outcomesServerComputingLabel: { de: 'Berechnung auf Server…', en: 'Computing on server…' }`
- All 3 outcomesI18n.test.ts checks pass

### Task 2: OutcomesView.tsx routing wiring

**`src/components/outcomes/OutcomesView.tsx`** (modified, +106 lines net)

New state variables:
- `threshold: number` (default 1000, updated from `loadSettings()` on mount)
- `serverAggregate: TrajectoryResult | null`
- `serverLoading: boolean`

New routing logic:
- `routeServerSide = Boolean(cohort && cohortId && cohort.cases.length > threshold)`
- When `routeServerSide=true`: fires 3 parallel `postAggregate` calls (od, os, combined), reassembles with `panelFromServer()` → sets `serverAggregate`
- On server error: `console.warn('[OutcomesView] Server aggregate failed — falling back to client compute', err)`, `setServerAggregate(null)` (client path activates)
- `aggregate` useMemo: returns `serverAggregate` if present, falls through to client `computeCohortTrajectory` otherwise

Loading indicator (D-14):
- Full early-return spinner at `routeServerSide && serverLoading && !serverAggregate` (initial load case) — renders `data-testid="outcomes-server-computing"`
- Inline `<span>` in header at `routeServerSide && serverLoading` (re-fetch case, prior aggregate already shown)
- Both carry `role="status"`, `aria-live="polite"` for accessibility

Phase 11 audit beacon: UNCHANGED (verified via `grep '/api/audit/events/view-open'`).

### Task 3: tests/OutcomesViewRouting.test.tsx (AGG-03)

**4 tests, all green:**

1. **below threshold → no server call**: threshold=1000, 5 cases → `postAggregate` not called
2. **above threshold → 3x server calls**: threshold=5, 10 cases → `postAggregate` called 3x with eyes `['combined', 'od', 'os']`
3. **loading indicator visible**: threshold=5, 10 cases, never-resolving mock → `data-testid="outcomes-server-computing"` found
4. **server error → client fallback**: threshold=5, 10 cases, mock rejects → `console.warn` spy captures `'[OutcomesView] Server aggregate failed — falling back to client compute'`, no empty state rendered

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Extra fetch call broke OutcomesPage beacon tests**
- **Found during:** Task 2 verification (`npx vitest run tests/OutcomesPage.test.tsx`)
- **Issue:** `loadSettings()` calls `authFetch('/api/settings')`, which hits the test's `fetchSpy`. Tests 6/6b/6c/6d assert `fetchSpy.toHaveBeenCalledTimes(1)` (beacon only), but with the new settings-load effect the count became 2.
- **Fix:** Added `vi.mock('../src/services/settingsService', ...)` and `vi.mock('../src/services/outcomesAggregateService', ...)` at the top of `tests/OutcomesPage.test.tsx`
- **Files modified:** `tests/OutcomesPage.test.tsx`

**2. [Rule 1 - Bug] Loading indicator unreachable — aggregate guard returned empty state first**
- **Found during:** Task 3 test run (Test 3 failed with "Unable to find outcomes-server-computing")
- **Issue:** When `routeServerSide=true` and `serverLoading=true`, `aggregate=null`, and the component hit `if (!aggregate) return <OutcomesEmptyState>` before the loading indicator rendered.
- **Fix:** Added a dedicated early-return path before the `!aggregate` guard: `if (routeServerSide && serverLoading && !serverAggregate)` renders a full-page loading span with `data-testid="outcomes-server-computing"`.
- **Files modified:** `src/components/outcomes/OutcomesView.tsx`

**3. [Rule 2 - Missing] RTL test used `toBeInTheDocument` without jest-dom**
- **Found during:** Task 3 test run (Test 3 assertion error)
- **Issue:** `@testing-library/jest-dom` matchers not set up in this project's test environment (tests/OutcomesPage.test.tsx uses `toBeDefined()` / `.toBeNull()`).
- **Fix:** Changed `toBeInTheDocument()` → `toBeDefined()` and adjusted fallback test to check `queryByText('outcomesEmptyCohortTitle').toBeNull()`.
- **Files modified:** `tests/OutcomesViewRouting.test.tsx`

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| tests/OutcomesViewRouting.test.tsx | 4/4 | green |
| tests/OutcomesPage.test.tsx | 20/20 | green |
| tests/outcomesI18n.test.ts | 3/3 | green |
| Full suite (npm test -- --run) | 399/399 | green |

**Baseline before plan:** 395 tests (post-Phase-11 close + Plans 12-01/02/03)
**After plan:** 399 tests (+4 new AGG-03 routing tests)

## Commits

| Hash | Message |
|------|---------|
| `17f78f4` | feat(12-04): add outcomesAggregateService, extend settingsService with outcomes, add i18n keys |
| `784790e` | feat(12-04): wire size-based routing + loading state + server-error fallback into OutcomesView |
| `6ee5391` | test(12-04): add AGG-03 routing tests + fix OutcomesView server-loading early return |

## Known Stubs

None. The routing logic is fully wired: threshold is read from `loadSettings()`, server fetch uses real `postAggregate`, fallback activates on rejection.

## Threat Flags

No new threat surface introduced beyond what was already modelled in the plan's threat register (T-12-client-01 through T-12-client-05).

## Self-Check: PASSED

- `src/services/outcomesAggregateService.ts` — FOUND
- `tests/OutcomesViewRouting.test.tsx` — FOUND
- Commits `17f78f4`, `784790e`, `6ee5391` — FOUND (3 of 3)
- Full suite 399/399 — VERIFIED
