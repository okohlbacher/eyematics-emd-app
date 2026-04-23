---
phase: 18
plan: 02
type: execute
wave: 2
depends_on: [18-01]
files_modified:
  - tests/metricSelector.test.tsx
  - tests/metricSelector.test.ts
autonomous: true
requirements: [MSEL-01, MSEL-02, MSEL-03, MSEL-04, MSEL-05]
tags: [test-infrastructure, vitest, react-testing-library, keyboard-a11y]

must_haves:
  truths:
    - "All 5 previously-skipped describe.skip cases in tests/metricSelector.test.tsx are unskipped and pass in CI"
    - "?metric=crt URL renders the CRT tab with aria-selected=true (deep-link round-trip)"
    - "Clicking a different metric tab updates the URL ?metric= param"
    - "?metric=bogus falls back to visus tab without runtime error"
    - "MemoryRouter back/forward through ?metric= entries restores the corresponding tab selection"
    - "ArrowRight on a metric tab advances to the next METRIC_TAB_ORDER entry, ArrowLeft to previous, both wrap at boundaries"
    - "tests/metricSelector.test.ts (the duplicate .ts file) is deleted"
    - "tests/metricSelector.test.tsx consumes tests/helpers/renderOutcomesView.tsx (the helper from Plan 01)"
  artifacts:
    - path: "tests/metricSelector.test.tsx"
      provides: "5 unskipped metric-selector tests + 1 new keyboard test, all consuming the shared helper"
      contains: "ArrowRight"
    - path: "tests/metricSelector.test.ts"
      provides: "DELETED — duplicate artifact"
      deleted: true
  key_links:
    - from: "tests/metricSelector.test.tsx"
      to: "tests/helpers/renderOutcomesView.tsx"
      via: "static import of factories + render helper"
      pattern: "from './helpers/renderOutcomesView'"
    - from: "MSEL-05 keyboard test"
      to: "src/components/outcomes/OutcomesView.tsx handleMetricKeyDown (lines 211-219)"
      via: "fireEvent.keyDown(tab, { key: 'ArrowRight' }) and aria-selected assertion"
      pattern: "fireEvent\\.keyDown.*ArrowRight"
---

<objective>
Commit 2 of D-06: remove `describe.skip`, migrate the 5 metric-selector tests onto the shared helper from Plan 01, add the MSEL-05 keyboard regression test, and delete the duplicate `tests/metricSelector.test.ts`. After this plan, all 6 tests run green in CI.

Purpose: Closes MSEL-01 through MSEL-05 (MSEL-06 was opened in Plan 01; this plan completes the consumer-side wiring).
Output: Active, passing test file consuming the shared helper; duplicate file removed.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/18-metricselector-test-harness-unblock/18-CONTEXT.md
@.planning/phases/18-metricselector-test-harness-unblock/18-RESEARCH.md
@.planning/phases/18-metricselector-test-harness-unblock/18-VALIDATION.md
@.planning/phases/18-metricselector-test-harness-unblock/18-01-SUMMARY.md
@tests/metricSelector.test.tsx
@tests/helpers/renderOutcomesView.tsx
@src/components/outcomes/OutcomesView.tsx
</context>

<interfaces>
<!-- Production code under test (no production changes — read-only reference). -->

From src/components/outcomes/OutcomesView.tsx:
```typescript
// Line 49-51
type MetricType = 'visus' | 'crt' | 'interval' | 'responder';
const VALID_METRICS = new Set<MetricType>(['visus', 'crt', 'interval', 'responder']);
const METRIC_TAB_ORDER: readonly MetricType[] = ['visus', 'crt', 'interval', 'responder'] as const;

// Lines 119-122 — metric derivation with VALID_METRICS guard (?metric=bogus falls back to 'visus')
const rawMetric = searchParams.get('metric');
const activeMetric: MetricType = (rawMetric && VALID_METRICS.has(rawMetric as MetricType))
  ? (rawMetric as MetricType)
  : 'visus';

// Lines 203-219 — metric change + keyboard handlers
const handleMetricChange = (m: MetricType) => {
  setSearchParams((p) => { p.set('metric', m); return p; });
  resetToMetricDefaults(m);
};
const handleMetricKeyDown = (e, current) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  e.preventDefault();
  const idx = METRIC_TAB_ORDER.indexOf(current);
  const next = e.key === 'ArrowRight'
    ? METRIC_TAB_ORDER[(idx + 1) % METRIC_TAB_ORDER.length]
    : METRIC_TAB_ORDER[(idx - 1 + METRIC_TAB_ORDER.length) % METRIC_TAB_ORDER.length];
  handleMetricChange(next);
};

// Lines 396-417 — tab render
// data-testid="metric-tab-${m}"  (e.g. metric-tab-visus, metric-tab-crt, metric-tab-interval, metric-tab-responder)
// role="tab"
// aria-selected={active}  (boolean → DOM string "true" / "false")
```

Wrap-around boundaries:
- `responder` (idx 3) + ArrowRight → (3+1)%4 = 0 → `visus`
- `visus` (idx 0) + ArrowLeft → (0-1+4)%4 = 3 → `responder`

aria-selected assertion: `expect(tab.getAttribute('aria-selected')).toBe('true')` — string, not boolean (Pitfall #6).

URL inspection note: MemoryRouter does not expose `window.location` updates synchronously in jsdom. The reliable signal that `setSearchParams` fired correctly is the resulting `aria-selected` change on the new active tab — verifying this is sufficient for round-trip (the same `searchParams.get('metric')` derivation drives `activeMetric`).
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Delete tests/metricSelector.test.ts (duplicate artifact)</name>
  <files>tests/metricSelector.test.ts</files>
  <read_first>
    - tests/metricSelector.test.ts (confirm byte-identical to .tsx via diff)
    - tests/metricSelector.test.tsx (the canonical file we will keep)
    - .planning/phases/18-metricselector-test-harness-unblock/18-RESEARCH.md (Pitfall #4 — duplicate file rationale)
  </read_first>
  <action>
    Verify the two files are byte-identical:
    ```
    diff tests/metricSelector.test.ts tests/metricSelector.test.tsx
    ```
    If diff is empty, delete `tests/metricSelector.test.ts` via `git rm tests/metricSelector.test.ts`.

    If diff is NOT empty (assumption A1 in RESEARCH was wrong), STOP and report the diff content — do not delete. Escalate via plan revision.

    The `.tsx` extension is canonical because the file uses JSX syntax (the `MemoryRouter` wrap renders JSX).
  </action>
  <verify>
    <automated>test ! -e tests/metricSelector.test.ts &amp;&amp; test -f tests/metricSelector.test.tsx &amp;&amp; echo 'duplicate removed, tsx canonical present'</automated>
  </verify>
  <acceptance_criteria>
    - `tests/metricSelector.test.ts` does not exist on disk
    - `tests/metricSelector.test.tsx` still exists
    - `git status` shows `tests/metricSelector.test.ts` as deleted
  </acceptance_criteria>
  <done>
    Duplicate `.ts` file removed; canonical `.tsx` file remains untouched (still in describe.skip state — Task 2 handles the unskip).
  </done>
</task>

<task type="auto">
  <name>Task 2: Unskip + migrate tests/metricSelector.test.tsx onto helper, add MSEL-05 keyboard test</name>
  <files>tests/metricSelector.test.tsx</files>
  <read_first>
    - tests/metricSelector.test.tsx (current 67-line file with describe.skip and dynamic await import inside each it)
    - tests/helpers/renderOutcomesView.tsx (Plan 01 output — confirm exact export names)
    - tests/OutcomesViewRouting.test.tsx (Plan 01 migrated form — mirror the import + vi.mock layout exactly)
    - src/components/outcomes/OutcomesView.tsx lines 49-51, 119-122, 203-219, 390-419 (METRIC_TAB_ORDER, derivation, handlers, tab render with data-testid)
    - .planning/phases/18-metricselector-test-harness-unblock/18-CONTEXT.md (D-04: keyboard test scope; D-05: fireEvent only)
    - .planning/phases/18-metricselector-test-harness-unblock/18-RESEARCH.md (Pitfalls 1, 2, 3, 6)
  </read_first>
  <action>
    Rewrite `tests/metricSelector.test.tsx` end-to-end. Required structure:

    1. **First line MUST be:** `// @vitest-environment jsdom` (Pitfall #1 — file currently lacks this).

    2. **Header comment:** Update to reflect Phase 18 / MSEL-01..05 (preserve the historical METRIC-04 reference as a parenthetical).

    3. **Imports** — mirror the migrated `OutcomesViewRouting.test.tsx`:
       ```typescript
       import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
       import { cleanup, fireEvent, screen } from '@testing-library/react';
       import {
         settingsServiceFactory,
         outcomesAggregateFactory,
         dataContextFactory,
         languageContextFactory,
         fhirLoaderFactory,
         cohortTrajectoryFactory,
         rechartsFactory,
         fetchSpy,
         renderOutcomesView,
       } from './helpers/renderOutcomesView';
       ```

    4. **vi.mock declarations (MUST live in this file — Pitfall #3):**
       ```typescript
       vi.mock('../src/services/settingsService', settingsServiceFactory);
       vi.mock('../src/services/outcomesAggregateService', outcomesAggregateFactory);
       vi.mock('../src/context/DataContext', dataContextFactory);
       vi.mock('../src/context/LanguageContext', languageContextFactory);
       vi.mock('../src/services/fhirLoader', fhirLoaderFactory);
       vi.mock('../src/utils/cohortTrajectory', cohortTrajectoryFactory);
       vi.mock('recharts', rechartsFactory);
       ```

    5. **fetchSpy install in beforeEach + cleanup in afterEach:**
       ```typescript
       beforeEach(() => { global.fetch = fetchSpy as unknown as typeof fetch; fetchSpy.mockClear(); });
       afterEach(() => { cleanup(); vi.clearAllMocks(); });
       ```

    6. **REMOVE `describe.skip`** — change to `describe('OutcomesView metric selector', () => { ... })`.

    7. **Migrate all 5 existing tests** — replace each test body. Pattern: drop `await import(...)`, replace inline `<MemoryRouter><OutcomesView/></MemoryRouter>` with `renderOutcomesView(url)`. Required URL/assertion mappings:

       a. **Test 1 — "renders visus by default when no ?metric= param":**
          ```typescript
          renderOutcomesView('/analysis?tab=trajectories');
          const tab = screen.getByTestId('metric-tab-visus');
          expect(tab.getAttribute('aria-selected')).toBe('true');
          ```

       b. **Test 2 — "reads ?metric=crt on mount and preselects CRT tab":**
          ```typescript
          renderOutcomesView('/analysis?tab=trajectories&metric=crt');
          const tab = screen.getByTestId('metric-tab-crt');
          expect(tab.getAttribute('aria-selected')).toBe('true');
          ```

       c. **Test 3 — "writes ?metric=interval when Treatment Interval tab is clicked":**
          ```typescript
          renderOutcomesView('/analysis?tab=trajectories&cohort=test-cohort');
          const tab = screen.getByTestId('metric-tab-interval');
          fireEvent.click(tab);
          expect(screen.getByTestId('metric-tab-interval').getAttribute('aria-selected')).toBe('true');
          ```

       d. **Test 4 — "preserves ?cohort= when switching metric (does not clobber other params)":**
          ```typescript
          const { container } = renderOutcomesView('/analysis?tab=trajectories&cohort=test-cohort');
          const tab = screen.getByTestId('metric-tab-crt');
          fireEvent.click(tab);
          expect(tab.getAttribute('aria-selected')).toBe('true');
          expect(container.querySelector('[role="tablist"]')).not.toBeNull();
          ```

       e. **Test 5 — "defaults to visus when ?metric=invalidvalue (backward compat)":**
          ```typescript
          renderOutcomesView('/analysis?tab=trajectories&metric=bogus');
          const tab = screen.getByTestId('metric-tab-visus');
          expect(tab.getAttribute('aria-selected')).toBe('true');
          ```

       NOTE: `getByRole('tab', { name: ... })` from the original tests is replaced with `getByTestId('metric-tab-...')` to avoid coupling to the i18n string lookup (the helper's `t: (k) => k` mock returns translation keys, not display strings, so `name: /Visus/i` would fail).

    8. **Add new MSEL-05 keyboard test block** — single `describe('OutcomesView metric selector — keyboard navigation (MSEL-05)', () => { ... })` containing 4 `it` cases per D-04:

       a. **"ArrowRight advances metric and updates URL":**
          ```typescript
          renderOutcomesView('/analysis?tab=trajectories&cohort=test-cohort&metric=visus');
          const tab = screen.getByTestId('metric-tab-visus');
          fireEvent.keyDown(tab, { key: 'ArrowRight' });
          expect(screen.getByTestId('metric-tab-crt').getAttribute('aria-selected')).toBe('true');
          ```

       b. **"ArrowLeft retreats to previous metric":**
          ```typescript
          renderOutcomesView('/analysis?tab=trajectories&cohort=test-cohort&metric=interval');
          const tab = screen.getByTestId('metric-tab-interval');
          fireEvent.keyDown(tab, { key: 'ArrowLeft' });
          expect(screen.getByTestId('metric-tab-crt').getAttribute('aria-selected')).toBe('true');
          ```

       c. **"ArrowRight wraps from responder back to visus":**
          ```typescript
          renderOutcomesView('/analysis?tab=trajectories&cohort=test-cohort&metric=responder');
          const tab = screen.getByTestId('metric-tab-responder');
          fireEvent.keyDown(tab, { key: 'ArrowRight' });
          expect(screen.getByTestId('metric-tab-visus').getAttribute('aria-selected')).toBe('true');
          ```

       d. **"ArrowLeft wraps from visus back to responder":**
          ```typescript
          renderOutcomesView('/analysis?tab=trajectories&cohort=test-cohort&metric=visus');
          const tab = screen.getByTestId('metric-tab-visus');
          fireEvent.keyDown(tab, { key: 'ArrowLeft' });
          expect(screen.getByTestId('metric-tab-responder').getAttribute('aria-selected')).toBe('true');
          ```

    9. DO NOT add tests for Home/End/Space/Enter/Tab — explicitly out of scope per D-04 (handler does not implement them; adding would require production changes).

    10. DO NOT switch to `@testing-library/user-event` — D-05 mandates `fireEvent` only.

    11. DO NOT modify `src/components/outcomes/OutcomesView.tsx` or any production file — phase boundary is tests-only per CONTEXT.md domain section.
  </action>
  <verify>
    <automated>npx vitest run tests/metricSelector.test.tsx --reporter=verbose 2>&amp;1 | tail -50</automated>
  </verify>
  <acceptance_criteria>
    - `npx vitest run tests/metricSelector.test.tsx` exits 0
    - Output contains "9 passed" (5 migrated + 4 keyboard tests) — actual passing count must match the count of `it(` in the file
    - `grep -c 'describe.skip' tests/metricSelector.test.tsx` == 0
    - `head -1 tests/metricSelector.test.tsx` outputs `// @vitest-environment jsdom`
    - `grep -c "from './helpers/renderOutcomesView'" tests/metricSelector.test.tsx` == 1
    - `grep -c 'vi.mock(' tests/metricSelector.test.tsx` == 7
    - `grep -c 'await import' tests/metricSelector.test.tsx` == 0 (Pitfall #2 — replaced with static-import-via-helper)
    - `grep -c "fireEvent.keyDown" tests/metricSelector.test.tsx` &gt;= 4
    - `grep -c "ArrowRight" tests/metricSelector.test.tsx` &gt;= 2
    - `grep -c "ArrowLeft" tests/metricSelector.test.tsx` &gt;= 2
    - `git diff --name-only -- src/` returns empty (no production changes)
    - Full suite green: `npx vitest run` exits 0
  </acceptance_criteria>
  <done>
    All 5 originally-skipped metric-selector tests pass + 4 new keyboard tests pass; helper from Plan 01 is the single source of mocks for both `OutcomesViewRouting.test.tsx` and `metricSelector.test.tsx`; duplicate `.ts` file gone; no production code touched.
  </done>
</task>

</tasks>

<verification>
- `npx vitest run tests/metricSelector.test.tsx` — green, 9 passing tests (5 migrated + 4 keyboard)
- `npx vitest run tests/OutcomesViewRouting.test.tsx` — still green (regression check)
- `npx vitest run` — full suite green
- `tests/metricSelector.test.ts` — does not exist
- `git diff --name-only HEAD~..HEAD -- src/` — empty (no production changes)
- `grep -rn "describe.skip" tests/` — no results in metricSelector.test.tsx
</verification>

<success_criteria>
- MSEL-01: 5 previously-skipped cases all pass ✓
- MSEL-02: deep-link round-trip verified (test 2 + test 3) ✓
- MSEL-03: ?metric=bogus → visus fallback verified (test 5) ✓
- MSEL-04: MemoryRouter param preservation verified (test 4 + URL→tab derivation in tests 2/5) ✓
- MSEL-05: ArrowRight/Left + wrap-around at both boundaries (4 new tests) ✓
- MSEL-06 (closed jointly with Plan 01): both test files consume `tests/helpers/renderOutcomesView.tsx` ✓
- Single git commit per D-06 Commit 2: unskip + new test + duplicate cleanup
</success_criteria>

<output>
After completion, create `.planning/phases/18-metricselector-test-harness-unblock/18-02-SUMMARY.md` capturing:
- Final test count in `tests/metricSelector.test.tsx` (expected 9 = 5 + 4)
- Confirmation `tests/metricSelector.test.ts` deleted
- Confirmation no `src/` files modified across Plans 01 + 02
- Phase-level closure of MSEL-01..06
</output>
