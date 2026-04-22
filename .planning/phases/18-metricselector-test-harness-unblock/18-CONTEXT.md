# Phase 18: metricSelector Test Harness Unblock - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Unskip the 5 `describe.skip` cases in `tests/metricSelector.test.tsx` (deep-link round-trip, default render, unknown-slug fallback, cohort-param preservation, back/forward nav) and extract a shared `tests/helpers/renderOutcomesView.tsx` factory consumed by both `tests/metricSelector.test.tsx` and `tests/OutcomesViewRouting.test.tsx`. Add one keyboard-navigation regression test for the ArrowRight/ArrowLeft handler at `src/components/outcomes/OutcomesView.tsx:211-219`. No behavior changes to `OutcomesView.tsx` or any production code.

</domain>

<decisions>
## Implementation Decisions

### Helper Design
- **D-01:** Helper extracts **mocks + render + defaults**. `tests/helpers/renderOutcomesView.tsx` exports:
  - vi.mock factory functions for the 7 modules: `settingsService` (partial, preserves actual + overrides `loadSettings`), `context/DataContext` (`useData`), `context/LanguageContext` (`useLanguage`), `services/fhirLoader` (`applyFilters`, LOINC/SNOMED consts, `getObservationsByCode`), `utils/cohortTrajectory` (`computeCohortTrajectory`), `services/outcomesAggregateService` (`postAggregate`), and `recharts` (ResponsiveContainer/ComposedChart/etc.).
  - `renderOutcomesView(url, options)` function.
  - Default mock state (5 cases via `buildCases(5)`, one saved search `{id: 'test-cohort'}`, `locale: 'en'`, threshold 1000 / cacheTtl 1800000 settings).
  - Because `vi.mock` is hoisted, each test file still declares `vi.mock('../src/services/...', () => helperFactoryFor...)` — the helper exports the factories; the mock calls live in the test file.

### Helper API Shape
- **D-02:** Signature: `renderOutcomesView(url: string, options?: { activeCases?, savedSearches?, locale?, settings?, postAggregate?, cohortTrajectoryResult? })`. Defaults applied when fields omitted. Callable multiple times per test file; each call mutates the shared mock state via the underlying `vi.fn().mockReturnValue(...)` before rendering.
- **D-03:** Always wrap in `<MemoryRouter initialEntries={[url]}><Routes><Route path="/analysis" element={<OutcomesView/>}/></Routes></MemoryRouter>`. No `withRoutes` flag — unified shape across both test files. This means `metricSelector.test.tsx` calls must use URLs starting with `/analysis?...` (current skipped tests already do).

### Keyboard Test Scope (MSEL-05)
- **D-04:** Single new test covering the existing handler at `OutcomesView.tsx:211-219`:
  - ArrowRight advances to next metric in `METRIC_TAB_ORDER`.
  - ArrowLeft goes to previous.
  - Wrap-around at both ends (end → start on ArrowRight, start → end on ArrowLeft).
  - URL `?metric=` param updates after each keypress (verifies `handleMetricChange` → `setSearchParams` round-trip).
- Home/End/Space/Enter/Tab intentionally out of scope — handler does not implement them, and adding them would be a production change (not in phase).

### Event Library
- **D-05:** Use `fireEvent` (from `@testing-library/react`) for both clicks and keyboard simulation. Consistent with existing `metricSelector.test.tsx` and `OutcomesViewRouting.test.tsx`. No new dependency on `@testing-library/user-event`.
- Keyboard events dispatched as `fireEvent.keyDown(tab, { key: 'ArrowRight' })`.

### Commit Sequence
- **D-06:** Two commits for bisect-friendly history:
  1. **Commit 1 — refactor-only:** Create `tests/helpers/renderOutcomesView.tsx`. Migrate `tests/OutcomesViewRouting.test.tsx` to use it. All existing tests remain green. No `describe.skip` changes.
  2. **Commit 2 — unskip + new test:** Remove `describe.skip` from `tests/metricSelector.test.tsx`, migrate its 5 cases onto the helper, add the MSEL-05 ArrowR/L keyboard test. All 5 + 1 new cases green in CI.

### Claude's Discretion
- Internal naming inside helper (factory fn names, default-builder fn names).
- Whether to export `buildCase`/`buildCases` from helper or duplicate small stubs — reuse-minded discretion.
- Precise `mockReturnValue` shape for `useData` (must include the full current shape: `activeCases`, `savedSearches`, `centers`, `addSavedSearch`, `removeSavedSearch`, `qualityFlags`, `excludedCases`, `reviewedCases`, `loading`, `error`, `bundles`, `cases`).
- Whether `fetchSpy` (audit beacon guard) lives in helper's `beforeEach` or each test's.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap / Requirements
- `.planning/ROADMAP.md` §Phase 18 — Goal, depends-on, success criteria (5 items).
- `.planning/REQUIREMENTS.md` MSEL-01 through MSEL-06 — acceptance criteria detail.

### Code under test
- `src/components/outcomes/OutcomesView.tsx:203-219` — `handleMetricChange` and `handleMetricKeyDown` (the ArrowR/L handler MSEL-05 regression-tests).
- `src/components/outcomes/OutcomesView.tsx` — `METRIC_TAB_ORDER` constant and metric tab render (source of `aria-selected` asserts).

### Existing tests (patterns to mirror and the consumers of the new helper)
- `tests/OutcomesViewRouting.test.tsx` — canonical reference for the 7 `vi.mock` blocks, `renderView` shape, `buildCase`/`buildCases` stubs, fetchSpy audit beacon guard. Migrated in Commit 1.
- `tests/metricSelector.test.tsx` — the 5 `describe.skip` cases being unskipped in Commit 2.
- `tests/OutcomesPage.test.tsx` — secondary reference for `useData` / `useLanguage` mock shape at module boundary.

### Prior phase context (for test patterns + Recharts mock rationale)
- No prior `*-CONTEXT.md` exists in `.planning/phases/` — v1.8 roadmap just initialized. PROJECT.md, REQUIREMENTS.md, ROADMAP.md are the sole prior context.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`tests/OutcomesViewRouting.test.tsx` lines 26-109** — Contains exactly the 7 vi.mock blocks + MemoryRouter wrapper the helper must extract. Copy-paste source for the helper.
- **`tests/OutcomesViewRouting.test.tsx` lines 121-148** — `buildCase`/`buildCases` stub factories. Reusable from helper or duplicated.
- **`tests/OutcomesViewRouting.test.tsx` lines 156-197** — `renderView(activeCases, options)` — the existing shape the new helper generalizes.

### Established Patterns
- **vi.mock hoisting** — module mocks declared top-of-file; factories can be imported from helper but the `vi.mock(...)` call itself must live in the test file.
- **Partial-mock via importOriginal** — `settingsService` and `cohortTrajectory` use `async (importOriginal) => { const actual = await importOriginal(); return { ...actual, override }; }` to preserve non-mocked exports.
- **Hook mocking at module boundary** — `useData` / `useLanguage` mocked as `vi.fn()` and driven per-test with `.mockReturnValue(...)`. No React context provider tree.
- **fetchSpy in beforeEach** — keeps the audit beacon POSTs (`/api/audit/log`) from exploding; all test files install `global.fetch = fetchSpy`.
- **Recharts mock** — replace ResponsiveContainer/ComposedChart/axes with lightweight stubs to dodge jsdom ResizeObserver issues.

### Integration Points
- `tests/helpers/renderOutcomesView.tsx` — new file; the helpers directory does not exist yet (`ls tests/helpers` returns ENOENT). Create directory + file in Commit 1.
- Commit 1 touches: `tests/helpers/renderOutcomesView.tsx` (new), `tests/OutcomesViewRouting.test.tsx` (migrated).
- Commit 2 touches: `tests/metricSelector.test.tsx` (unskipped + migrated + new keyboard test).

</code_context>

<specifics>
## Specific Ideas

- Keyboard handler lives at `OutcomesView.tsx:211-219`. Test must exercise it via `fireEvent.keyDown(tab, { key: 'ArrowRight' })` and assert both (a) next tab has `aria-selected="true"` and (b) URL `?metric=` reflects the new metric.
- `METRIC_TAB_ORDER` defines wrap-around — test must cover both boundaries (last→first on ArrowRight from end, first→last on ArrowLeft from start).
- Unknown-slug behavior: `?metric=bogus` must fall back to `visus` (the default). Existing skipped test at `tests/metricSelector.test.tsx:57-66` already asserts this — just unskip.
- Test names can keep their current wording when unskipped; no need to rename.

</specifics>

<deferred>
## Deferred Ideas

- **userEvent migration** — moving the whole test suite from `fireEvent` to `@testing-library/user-event` for more realistic keyboard/pointer semantics. Out of scope for Phase 18; would be a standalone test-infra phase.
- **Home/End/Space/Enter/Tab keyboard support** — requires production changes to `OutcomesView.tsx` keyboard handler. Not a test-harness concern; belongs in a future a11y phase.
- **Provider-tree rendering** — switching from hook-level mocks to a real `<DataProvider>` / `<LanguageProvider>` wrap. Out of scope; current module-boundary mocking is the established pattern.

</deferred>

---

*Phase: 18-metricselector-test-harness-unblock*
*Context gathered: 2026-04-22*
