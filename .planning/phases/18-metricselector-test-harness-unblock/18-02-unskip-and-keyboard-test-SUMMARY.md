---
phase: 18-metricselector-test-harness-unblock
plan: "02"
subsystem: testing
tags: [vitest, react-testing-library, keyboard-a11y, test-infrastructure]

requires:
  - phase: 18-metricselector-test-harness-unblock
    plan: "01"
    provides: "tests/helpers/renderOutcomesView.tsx shared helper with async renderOutcomesView()"

provides:
  - "tests/metricSelector.test.tsx: 9 active tests (5 metric-selector URL round-trip + 4 keyboard navigation), all green"
  - "tests/metricSelector.test.ts: deleted (duplicate artifact)"

affects:
  - "MSEL-01..05: all requirements closed"
  - "tests/OutcomesViewRouting.test.tsx: unaffected (still 7 green tests)"

tech-stack:
  added: []
  patterns:
    - "vi.hoisted() + vi.mock() factories from helper for reliable mock isolation"
    - "getByTestId('metric-tab-{name}') instead of getByRole('tab', { name: ... }) to avoid i18n mock coupling"
    - "fireEvent.keyDown for keyboard navigation (not @testing-library/user-event — D-05 mandate)"
    - "aria-selected string assertion: .getAttribute('aria-selected') === 'true' (not boolean)"

key-files:
  created: []
  modified:
    - tests/metricSelector.test.tsx
  deleted:
    - tests/metricSelector.test.ts

key-decisions:
  - "getByTestId over getByRole for metric tabs: t() mock returns translation keys, not display strings, so getByRole('tab', { name: /Visus/i }) would fail"
  - "Static import from helper after vi.mock blocks: mirrors OutcomesViewRouting.test.tsx pattern exactly — vi.hoisted loads factories, static import gets fetchSpy + renderOutcomesView"
  - "fireEvent.keyDown dispatched on the starting tab element: handleMetricKeyDown receives the event via the tab's onKeyDown handler"

metrics:
  duration: "15min"
  completed: "2026-04-22"
  tasks: 2
  files_modified: 1
  files_deleted: 1
---

# Phase 18 Plan 02: Unskip and Keyboard Test Summary

**5 previously-skipped metric-selector tests unskipped + migrated onto shared helper; 4 new keyboard navigation tests added (MSEL-05); duplicate .ts file deleted; all 9 tests green**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-22T20:30:00Z
- **Completed:** 2026-04-22T20:45:00Z
- **Tasks:** 2
- **Files modified:** 1 (tests/metricSelector.test.tsx)
- **Files deleted:** 1 (tests/metricSelector.test.ts)

## Accomplishments

- Deleted `tests/metricSelector.test.ts` (byte-identical duplicate of `.tsx`; confirmed via `diff`)
- Rewrote `tests/metricSelector.test.tsx` end-to-end:
  - Added `// @vitest-environment jsdom` pragma (Pitfall #1)
  - Removed `describe.skip` → active `describe` block
  - Replaced per-test `await import('../src/components/outcomes/OutcomesView')` with shared helper
  - Replaced `getByRole('tab', { name: ... })` with `getByTestId('metric-tab-{name}')` to avoid i18n coupling
  - Added `vi.hoisted()` + 7 `vi.mock()` calls (identical pattern to `OutcomesViewRouting.test.tsx`)
  - Added static `import { fetchSpy, renderOutcomesView } from './helpers/renderOutcomesView'`
  - Added 4 MSEL-05 keyboard tests covering ArrowRight, ArrowLeft, and both wrap-around boundaries
- All 9 tests pass (`npx vitest run tests/metricSelector.test.tsx` exits 0)
- `OutcomesViewRouting.test.tsx` still green (7 tests, no regression)
- No production files modified (`git diff --name-only -- src/` is empty)

## Final Test Count

| File | Tests | Status |
|------|-------|--------|
| tests/metricSelector.test.tsx | 9 (5 migrated + 4 keyboard) | All green |
| tests/OutcomesViewRouting.test.tsx | 7 (AGG-03 + XCOHORT-04) | All green (regression check) |

## Task Commits

1. **Task 1: Delete tests/metricSelector.test.ts** - `fd99ae1` (chore)
2. **Task 2: Unskip + migrate + add MSEL-05** - `32c0e3c` (feat)

## Requirement Closure

| Requirement | Description | Status |
|-------------|-------------|--------|
| MSEL-01 | 5 previously-skipped cases all pass | Closed |
| MSEL-02 | Deep-link round-trip verified (test 2 + test 3) | Closed |
| MSEL-03 | ?metric=bogus → visus fallback verified (test 5) | Closed |
| MSEL-04 | MemoryRouter param preservation verified (test 4) | Closed |
| MSEL-05 | ArrowRight/Left + wrap-around at both boundaries (4 new tests) | Closed |
| MSEL-06 | Both test files consume shared helper | Closed (jointly with Plan 01) |

## Deviations from Plan

### Auto-resolved Issues

**1. [Rule 1 - Bug] `await import` inside vi.hoisted is unavoidable**
- **Found during:** Task 2 (acceptance criterion review)
- **Issue:** Plan criterion says `grep -c 'await import' == 0`. However, `vi.hoisted(async () => { await import('./helpers/renderOutcomesView') })` is the exact pattern established in Plan 01 (OutcomesViewRouting.test.tsx also has exactly 1 `await import`). The criterion was written intending to eliminate `await import('../src/components/outcomes/OutcomesView')` inside test bodies (Pitfall #2) — not the helper import in vi.hoisted.
- **Fix:** No code change needed — the 1 `await import` is the correct helper-loading pattern. The plan criterion was imprecisely worded. The spirit of Pitfall #2 is satisfied: no component is dynamically imported inside test bodies.
- **Committed in:** 32c0e3c (no separate fix commit needed)

**Total deviations:** 1 (documentation-only — no code change)

## Known Stubs

None — all 9 tests exercise real production component logic with properly mocked dependencies.

## Threat Flags

None — test-only changes; no new production endpoints, auth paths, or data access patterns introduced.

---

## Phase 18 Closure

All 6 MSEL requirements (MSEL-01..06) are closed across Plans 01 and 02:
- Plan 01: Created shared helper, migrated OutcomesViewRouting.test.tsx (MSEL-06)
- Plan 02: Unskipped all 5 metric selector tests, added 4 keyboard tests (MSEL-01..05), deleted duplicate

No production code was modified in either plan (`git diff --name-only -- src/` empty across both commits).

*Phase: 18-metricselector-test-harness-unblock*
*Completed: 2026-04-22*
