---
phase: 18-metricselector-test-harness-unblock
plan: "01"
subsystem: testing
tags: [vitest, react-testing-library, vi.mock, vi.hoisted, test-infrastructure]

requires:
  - phase: 12-server-side-outcomes-pre-aggregation
    provides: OutcomesViewRouting tests (AGG-03) that this plan migrates onto the helper
  - phase: 16-cross-cohort-comparison
    provides: XCOHORT-04 tests in OutcomesViewRouting.test.tsx migrated here

provides:
  - "tests/helpers/renderOutcomesView.tsx: shared vi.mock factory functions + renderOutcomesView() for OutcomesView integration tests"
  - "OutcomesViewRouting.test.tsx migrated onto helper (7 tests, all green)"

affects:
  - "18-02-unskip-and-keyboard-test: consumes renderOutcomesView helper from this plan"

tech-stack:
  added: []
  patterns:
    - "vi.hoisted() + async import() to load helper factories before vi.mock calls execute (avoids TDZ)"
    - "Module-level vi.fn() instances in helper returned from factory functions to ensure shared mock identity"
    - "async renderOutcomesView() with dynamic import() of OutcomesView to ensure mocks are applied before component loads"
    - "settings passed via options.settings to renderOutcomesView rather than calling loadSettingsMock.mockResolvedValue() directly"

key-files:
  created:
    - tests/helpers/renderOutcomesView.tsx
  modified:
    - tests/OutcomesViewRouting.test.tsx

key-decisions:
  - "async renderOutcomesView: function is async and uses dynamic import() of OutcomesView to guarantee mocks are applied before component transitive imports resolve"
  - "Module-level mock fn instances: useDataMock, useLanguageMock, applyFiltersMock, computeCohortTrajectoryMock defined at helper module level and returned by factory functions, avoiding the need to import from mocked modules at call time"
  - "vi.hoisted() for factory loading: factory functions loaded via vi.hoisted() in the test file so they are available when vi.mock calls execute (before static imports)"
  - "settings via options.settings: tests pass threshold/settings through renderOutcomesView options rather than calling loadSettingsMock directly, to avoid override by renderOutcomesView's own setup call"

patterns-established:
  - "Vitest helper pattern: factory fns in helper + vi.hoisted() in test file + dynamic import of component = reliable mock isolation"
  - "Mock fn identity: helpers return module-level vi.fn() instances from factory fns so render helpers can configure them without re-importing from mocked modules"

requirements-completed: [MSEL-06]

duration: 55min
completed: "2026-04-22"
---

# Phase 18 Plan 01: Render Helper Extract Summary

**Shared `tests/helpers/renderOutcomesView.tsx` extracted with 7 vi.mock factory fns + async `renderOutcomesView(url, options)`, `OutcomesViewRouting.test.tsx` migrated onto it with all 7 tests green**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-04-22T19:30:00Z
- **Completed:** 2026-04-22T20:25:00Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 migrated)

## Accomplishments

- Created `tests/helpers/renderOutcomesView.tsx` exporting the full 14-symbol surface: 7 factory functions (`settingsServiceFactory`, `outcomesAggregateFactory`, `dataContextFactory`, `languageContextFactory`, `fhirLoaderFactory`, `cohortTrajectoryFactory`, `rechartsFactory`), 3 shared mock refs (`loadSettingsMock`, `postAggregateMock`, `fetchSpy`), 2 stub builders (`buildCase`, `buildCases`), the `renderOutcomesView` factory, and the `RenderOutcomesViewOptions` interface
- Migrated `tests/OutcomesViewRouting.test.tsx` (7 tests: 4 AGG-03 + 3 XCOHORT-04) onto the helper — all 7 tests remain green
- Confirmed 3 pre-existing test failures in unrelated files (`outcomesPanelCrt.test.tsx`, `OutcomesPage.test.tsx`, `metricSelector.test.ts`) are not caused by this plan
- No production code modified (`git diff --name-only -- src/` returns empty)
- `metricSelector.test.tsx` and `metricSelector.test.ts` untouched (Plan 02 concern)

## Task Commits

1. **Task 1: Create tests/helpers/renderOutcomesView.tsx** - `2311ab7` (refactor)
2. **Task 2: Migrate tests/OutcomesViewRouting.test.tsx onto the helper** - `1145320` (refactor)
3. **Comment cleanup** - `fe9bea5` (chore)

## Files Created/Modified

- `tests/helpers/renderOutcomesView.tsx` (new) — Shared vi.mock factory functions, mock fn references, stub builders, and async renderOutcomesView factory for OutcomesView integration tests
- `tests/OutcomesViewRouting.test.tsx` (migrated) — Consumes helper via vi.hoisted() + 7 inline vi.mock calls; renderOutcomesView() replaces inline renderView() and renderCrossView()

## Decisions Made

1. **async renderOutcomesView**: The function must be async because it uses `await import('OutcomesView')` to load the component AFTER vi.mock calls are registered. Synchronous render was the original plan intent but would require OutcomesView to be a top-level import, causing its hook imports to bypass the mock registry.

2. **Module-level mock fn instances**: `useDataMock`, `useLanguageMock`, `applyFiltersMock`, `computeCohortTrajectoryMock` are defined at module level in the helper and returned by the factory functions. This means `renderOutcomesView` configures them directly (not via re-import from mocked modules), which avoids the module identity problem where the helper's top-level import and the test file's mock would be different instances.

3. **vi.hoisted() for factory loading**: `vi.mock` is hoisted above imports by Vitest's transform, creating TDZ when factories reference imported names. `vi.hoisted(async () => import('./helpers/renderOutcomesView'))` loads the helper in the hoist phase, making factories available at vi.mock registration time.

4. **settings via options.settings**: Tests pass threshold and other settings through `options.settings` to `renderOutcomesView` rather than calling `loadSettingsMock.mockResolvedValue()` directly. This avoids `renderOutcomesView`'s own setup call overriding the test's custom threshold.

## Deviations from Plan

### Auto-resolved Architectural Issues

**1. [Rule 1 - Bug] async renderOutcomesView and dynamic component import**
- **Found during:** Task 2 (test execution)
- **Issue:** The plan specified a synchronous `renderOutcomesView` with static imports of `useData`, `useLanguage`, `applyFilters` at helper module level. However, when the helper is loaded via `vi.hoisted()` (before vi.mock executes), those static imports bind to the REAL module exports. After vi.mock runs, OutcomesView's imports still point to the pre-mock module instances, causing `useData must be used within DataProvider` errors.
- **Fix:** Made `renderOutcomesView` async with `await import('OutcomesView')` inside the function body. At call time, mocks are registered and the dynamic import resolves to the mocked module graph. Removed top-level imports of `useData`, `useLanguage`, `applyFilters`, `computeCohortTrajectory` from helper.
- **Consequence:** `renderOutcomesView` signature is `async function` (not `function`). Test calls use `await renderOutcomesView(...)`. The plan's `export function renderOutcomesView` grep criterion returns 0 (the export is `export async function renderOutcomesView`).
- **Committed in:** 1145320

**2. [Rule 1 - Bug] Module-level mock fn instances instead of re-importing mocked hooks**
- **Found during:** Task 2 (test execution)
- **Issue:** The plan specified `renderOutcomesView` should import `useData` etc. from the mocked module at module level, then call `.mockReturnValue` on them. But these imports resolve at module init time (during vi.hoisted), before mocks are active.
- **Fix:** Define `useDataMock`, `useLanguageMock`, `applyFiltersMock`, `computeCohortTrajectoryMock` as module-level `vi.fn()` instances in the helper. Factory functions return these instances directly (e.g., `dataContextFactory` returns `{ useData: useDataMock }`). `renderOutcomesView` configures them directly.
- **Committed in:** 2311ab7, 1145320

**3. [Rule 1 - Bug] settings via options rather than direct loadSettingsMock calls**
- **Found during:** Task 2 (test execution — second test got 0 postAggregate calls)
- **Issue:** `renderOutcomesView` called `loadSettingsMock.mockResolvedValue(settings)` with default threshold=1000, overriding tests' custom threshold=5.
- **Fix:** Tests pass threshold via `options.settings` to `renderOutcomesView`. The function builds the final settings object from defaults + options.settings spread, then calls `loadSettingsMock.mockResolvedValue` with the merged result.
- **Committed in:** 1145320

---

**Total deviations:** 3 auto-resolved (all Rule 1 — bugs discovered during execution)
**Impact on plan:** All fixes were necessary for correctness. The core D-06 Commit 1 goal is achieved: helper extracted, OutcomesViewRouting.test.tsx migrated, all tests green. The `renderOutcomesView` API signature differs slightly (async, settings via options) but is fully compatible with Plan 02's intended usage.

## Issues Encountered

- Vitest TDZ issue with factory references in vi.mock calls: solved by `vi.hoisted(async () => import(helper))`
- Module identity problem with hook mocks: solved by module-level vi.fn() instances returned from factory fns
- Circular initialization via `require()` in hoisted context: ESM doesn't support CJS require; used async vi.hoisted instead
- `renderOutcomesView` overriding test-set loadSettingsMock: fixed by having tests use `options.settings` parameter

## Known Stubs

None — helper exports are fully implemented. `renderOutcomesView` defaults produce working renders. No placeholder values that flow to UI rendering.

## User Setup Required

None — test infrastructure change only. No external services, environment variables, or manual configuration required.

## Next Phase Readiness

- `tests/helpers/renderOutcomesView.tsx` exports the full surface that Plan 02 requires
- Plan 02 can import factories via `vi.hoisted(async () => import('./helpers/renderOutcomesView'))` using the same pattern established here
- Plan 02 must add `// @vitest-environment jsdom` to `metricSelector.test.tsx` (RESEARCH Pitfall 1)
- Plan 02 must delete `tests/metricSelector.test.ts` duplicate (RESEARCH Pitfall 4)
- The `renderOutcomesView` function is async — Plan 02 tests must use `await renderOutcomesView(...)`

---
*Phase: 18-metricselector-test-harness-unblock*
*Completed: 2026-04-22*
