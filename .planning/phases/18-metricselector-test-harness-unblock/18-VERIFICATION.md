---
phase: 18-metricselector-test-harness-unblock
verified: 2026-04-22T22:38:00Z
status: human_needed
score: 4/5
overrides_applied: 0
human_verification:
  - test: "Manual browser back/forward through metric tab history"
    expected: "Navigating back after clicking CRT tab restores the previous metric (e.g. visus) — ?metric= param in URL reflects the restored selection"
    why_human: "MemoryRouter in jsdom does not expose history.go(-1) / window.location updates synchronously; no automated test for navigate(-1) exists in the suite; platform constraint documented in 18-02 PLAN interfaces section"
---

# Phase 18: metricSelector Test Harness Unblock — Verification Report

**Phase Goal:** Developers can rely on automated coverage for the metric selector's deep-link, fallback, and keyboard-navigation behavior
**Verified:** 2026-04-22T22:38:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All 5 previously `describe.skip` cases in `tests/metricSelector.test.tsx` are active and passing in CI | VERIFIED | `grep -c "describe.skip" tests/metricSelector.test.tsx` → 0; `npx vitest run tests/metricSelector.test.tsx` → 9 passed (5 migrated + 4 keyboard); no `describe.skip` present |
| 2 | `?metric=X` URL renders matching tab selected; clicking a different tab updates the URL (round-trip verified) | VERIFIED | Test "reads ?metric=crt on mount and preselects CRT tab" and "writes ?metric=interval when Treatment Interval tab is clicked" both pass; aria-selected assertions confirm round-trip |
| 3 | Unknown metric slugs (e.g. `?metric=bogus`) render the default metric without runtime errors | VERIFIED | Test "defaults to visus when ?metric=invalidvalue (backward compat)" passes; `OutcomesView` VALID_METRICS guard falls back to 'visus' |
| 4 | Browser back/forward navigation through MemoryRouter restores the previous metric selection; keyboard arrow-key tab cycling is regression-tested | PARTIAL | Keyboard cycling (ArrowRight/Left + both wrap-around boundaries) fully covered by 4 MSEL-05 tests, all passing. Literal browser back/forward (navigate(-1)) has NO automated test — platform constraint: MemoryRouter in jsdom does not expose history.go() synchronously. Param preservation (test 4) is the closest automated proxy. Human verification required for the back/forward half. |
| 5 | Both `OutcomesViewRouting.test.tsx` and `metricSelector.test.tsx` consume a single shared `tests/helpers/renderOutcomesView.tsx` factory | VERIFIED | Both files import from `./helpers/renderOutcomesView`; helper exports all 14 symbols; `vi.mock()` calls remain in each test file (Vitest hoisting constraint respected); helper contains 0 actual `vi.mock()` call invocations |

**Score:** 4/5 truths fully verified (Truth 4 is partial — keyboard half verified, back/forward half needs human)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/helpers/renderOutcomesView.tsx` | Shared vi.mock factories + `renderOutcomesView(url, options)` factory | VERIFIED | Exists; 14 exports confirmed: 7 factory fns, 3 shared mock refs (loadSettingsMock, postAggregateMock, fetchSpy), 2 builders (buildCase, buildCases), renderOutcomesView, RenderOutcomesViewOptions interface |
| `tests/metricSelector.test.tsx` | 5 unskipped metric-selector tests + 4 keyboard tests, consuming shared helper | VERIFIED | 9 tests active; `// @vitest-environment jsdom` pragma present; imports from `./helpers/renderOutcomesView`; 7 `vi.mock()` calls; 0 `describe.skip`; 4 `fireEvent.keyDown` calls |
| `tests/metricSelector.test.ts` | DELETED — duplicate artifact | VERIFIED | File does not exist on disk; deleted in commit `fd99ae1` |
| `tests/OutcomesViewRouting.test.tsx` | Migrated to consume shared helper | VERIFIED | Imports from `./helpers/renderOutcomesView`; 7 `vi.mock()` calls retained in test file; 7 tests all passing |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tests/metricSelector.test.tsx` | `tests/helpers/renderOutcomesView.tsx` | `vi.hoisted()` async import + static import of `fetchSpy`, `renderOutcomesView` | WIRED | `grep -c "from './helpers/renderOutcomesView'"` → 1; factories loaded via `vi.hoisted()` before mock registration |
| `tests/OutcomesViewRouting.test.tsx` | `tests/helpers/renderOutcomesView.tsx` | `vi.hoisted()` async import + static import of 5 symbols | WIRED | `grep -c "from './helpers/renderOutcomesView'"` → 1 |
| MSEL-05 keyboard tests | `src/components/outcomes/OutcomesView.tsx handleMetricKeyDown` | `fireEvent.keyDown(tab, { key: 'ArrowRight' })` + aria-selected assertions | WIRED | 4 keyboard tests fire events and assert aria-selected state change; production handler at lines 211-219 confirmed present |
| `tests/helpers/renderOutcomesView.tsx` | `src/components/outcomes/OutcomesView` | Dynamic `await import('../../src/components/outcomes/OutcomesView')` inside `renderOutcomesView()` | WIRED | Import is deferred to call time so mocks are registered before component loads; no circular TDZ issues |

---

### Data-Flow Trace (Level 4)

Not applicable — phase produces test infrastructure only; no dynamic data rendering. `renderOutcomesView` sets up mock return values (useDataMock, loadSettingsMock) which are verified to produce non-empty DOM state by all 9 passing tests.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 9 metricSelector tests pass | `npx vitest run tests/metricSelector.test.tsx --reporter=verbose` | 9 passed, 0 failed | PASS |
| OutcomesViewRouting.test.tsx regression check | `npx vitest run tests/OutcomesViewRouting.test.tsx --reporter=verbose` | 7 passed, 0 failed | PASS |
| Combined target suite | `npx vitest run tests/metricSelector.test.tsx tests/OutcomesViewRouting.test.tsx` | 16 passed, 2 test files, 809ms | PASS |
| No `describe.skip` in metricSelector.test.tsx | `grep -c "describe.skip" tests/metricSelector.test.tsx` | 0 | PASS |
| Duplicate .ts file absent | `test ! -e tests/metricSelector.test.ts` | exits 0 | PASS |
| No vi.mock() calls in helper (actual invocations) | All 3 `vi.mock(` occurrences in helper are in comments | 0 actual calls | PASS |
| No production src changes | `git show 2311ab7 32c0e3c fd99ae1 1145320 128fd7e --name-only \| grep "^src/"` | (empty) | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| MSEL-01 | 18-02 | 5 previously-skipped cases all active and passing | SATISFIED | 5 tests in `describe('OutcomesView metric selector')` all pass; `describe.skip` removed |
| MSEL-02 | 18-02 | `?metric=X` deep-link renders matching tab; clicking different tab updates URL | SATISFIED | Tests 2 and 3 cover mount-time rendering and click-driven state change with aria-selected assertions |
| MSEL-03 | 18-02 | Unknown metric slugs render default without runtime errors | SATISFIED | Test 5 (`?metric=bogus`) passes; VALID_METRICS guard in OutcomesView confirmed at lines 119-122 |
| MSEL-04 | 18-02 | MemoryRouter param preservation / back-forward restoration | PARTIAL | Param preservation verified (test 4 — `?cohort=` not clobbered); literal back/forward navigation untestable in jsdom MemoryRouter — human verification required |
| MSEL-05 | 18-02 | Keyboard ArrowRight/Left cycling + wrap-around at boundaries | SATISFIED | 4 keyboard tests: ArrowRight advance, ArrowLeft retreat, wrap-right (responder→visus), wrap-left (visus→responder) — all pass |
| MSEL-06 | 18-01 | Both test files consume single shared `tests/helpers/renderOutcomesView.tsx` | SATISFIED | Both files import from `./helpers/renderOutcomesView`; helper has 14 export symbols; no inline mock factory bodies in either test file |

**Note:** MSEL requirements are defined via ROADMAP.md success criteria only — no separate REQUIREMENTS.md file exists for this milestone. All 6 MSEL IDs map to Phase 18 per the Coverage Map.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `tests/metricSelector.test.tsx` line 30 | `await import('./helpers/renderOutcomesView')` inside `vi.hoisted()` | Info | This is 1 `await import` that the plan criterion said should be 0. SUMMARY documents this as an auto-resolved deviation: the plan intended to eliminate `await import('../src/components/outcomes/OutcomesView')` inside test bodies (Pitfall #2); the remaining import is the correct `vi.hoisted()` factory-loading pattern established in Plan 01. Not a real anti-pattern. |

No blockers. No stubs. No placeholder returns in test infrastructure.

---

### Human Verification Required

#### 1. MemoryRouter Browser Back/Forward Restoration

**Test:** In a real browser (or Playwright/Cypress integration test), navigate to `/analysis?tab=trajectories&metric=crt`, then click another metric tab to change to `?metric=interval`, then press the browser back button.

**Expected:** The metric selector returns to the CRT tab (`aria-selected="true"` on `metric-tab-crt`); the URL shows `?metric=crt`.

**Why human:** MemoryRouter in jsdom does not expose `history.go(-1)` / `window.location` updates synchronously. The PLAN INTERFACES section (line 107) explicitly documents this as a jsdom platform constraint and accepts `aria-selected` state change as the automated proxy. The literal back/forward behavior requires either a real browser environment or Playwright/Cypress — neither is in scope for this vitest-only phase.

---

### Gaps Summary

No blocking gaps found. The sole partial truth (back/forward restoration) reflects a documented platform constraint in the plan and has an adequate automated proxy (param preservation test + URL-derived state tests). The behavior remains testable by humans and is feasible to add as a Playwright test in a future phase.

---

## Phase 18 Summary

Phase 18 delivers a complete automated test harness for the metric selector:

- **9 tests active** in `tests/metricSelector.test.tsx` (5 URL round-trip + 4 keyboard), all green
- **7 tests stable** in `tests/OutcomesViewRouting.test.tsx`, unaffected by refactor
- **Shared helper** `tests/helpers/renderOutcomesView.tsx` with 14 exports is the single source of mock factories for both test files
- **Duplicate** `tests/metricSelector.test.ts` deleted
- **No production code modified** across both plans

The phase goal is substantially achieved. The one human verification item (MemoryRouter back/forward) is a documented limitation of jsdom that does not block developer confidence in the automated suite.

---

_Verified: 2026-04-22T22:38:00Z_
_Verifier: Claude (gsd-verifier)_
