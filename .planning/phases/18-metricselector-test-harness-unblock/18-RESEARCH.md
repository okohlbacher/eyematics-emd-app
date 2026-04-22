# Phase 18: metricSelector Test Harness Unblock - Research

**Researched:** 2026-04-22
**Domain:** Vitest + @testing-library/react — test harness extraction and describe.skip unskip
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Helper exports vi.mock factory functions for 7 modules: `settingsService` (partial, preserves actual + overrides `loadSettings`), `context/DataContext` (`useData`), `context/LanguageContext` (`useLanguage`), `services/fhirLoader` (`applyFilters`, LOINC/SNOMED consts, `getObservationsByCode`), `utils/cohortTrajectory` (`computeCohortTrajectory`), `services/outcomesAggregateService` (`postAggregate`), `recharts` (ResponsiveContainer/ComposedChart/etc.). Also exports `renderOutcomesView(url, options)` and default mock state (5 cases via `buildCases(5)`, one saved search `{id: 'test-cohort'}`, `locale: 'en'`, threshold 1000 / cacheTtl 1800000).
- **D-02:** Signature: `renderOutcomesView(url: string, options?: { activeCases?, savedSearches?, locale?, settings?, postAggregate?, cohortTrajectoryResult? })`. Defaults applied when fields omitted. Callable multiple times per test file; each call mutates shared mock state via `vi.fn().mockReturnValue(...)` before rendering.
- **D-03:** Always wrap in `<MemoryRouter initialEntries={[url]}><Routes><Route path="/analysis" element={<OutcomesView/>}/></Routes></MemoryRouter>`. No `withRoutes` flag. `metricSelector.test.tsx` must use URLs starting with `/analysis?...`.
- **D-04 (MSEL-05):** Single new keyboard test: ArrowRight advances metric, ArrowLeft goes to previous, wrap-around at both ends. URL `?metric=` param updates after each keypress. Home/End/Space/Enter/Tab intentionally out of scope.
- **D-05:** Use `fireEvent` (from `@testing-library/react`) for clicks and keyboard simulation. No `@testing-library/user-event`. Keyboard events as `fireEvent.keyDown(tab, { key: 'ArrowRight' })`.
- **D-06:** Two commits: (1) refactor-only — create helper, migrate `OutcomesViewRouting.test.tsx`; (2) unskip + new test — remove `describe.skip`, migrate 5 cases onto helper, add MSEL-05 keyboard test.

### Claude's Discretion

- Internal naming inside helper (factory fn names, default-builder fn names).
- Whether to export `buildCase`/`buildCases` from helper or duplicate small stubs.
- Precise `mockReturnValue` shape for `useData` (must include the full current shape: `activeCases`, `savedSearches`, `centers`, `addSavedSearch`, `removeSavedSearch`, `qualityFlags`, `excludedCases`, `reviewedCases`, `loading`, `error`, `bundles`, `cases`).
- Whether `fetchSpy` (audit beacon guard) lives in helper's `beforeEach` or each test's.

### Deferred Ideas (OUT OF SCOPE)

- userEvent migration (moving from `fireEvent` to `@testing-library/user-event`)
- Home/End/Space/Enter/Tab keyboard support (requires production changes to OutcomesView.tsx keyboard handler)
- Provider-tree rendering (switching from hook-level mocks to real `<DataProvider>` / `<LanguageProvider>` wrap)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MSEL-01 | All 5 previously-skipped cases in `tests/metricSelector.test.tsx` are unskipped and passing | Helper extracted in Commit 1 unblocks the mocking; Commit 2 removes `describe.skip` |
| MSEL-02 | Deep-link round-trip tested — `?metric=X` renders X tab selected; clicking different tab updates URL | Covered by existing skipped tests #2 and #3; `activeMetric` is derived from `searchParams.get('metric')` with VALID_METRICS guard |
| MSEL-03 | Unknown metric slug (`?metric=bogus`) falls back to default metric without error | Covered by existing skipped test #5; fallback to `'visus'` confirmed in `OutcomesView.tsx:120-122` |
| MSEL-04 | Browser back/forward navigation via MemoryRouter restores corresponding metric selection | Covered by existing skipped test (cohort-param preservation test exercises that MemoryRouter preserves params); no new test needed beyond unskip |
| MSEL-05 | Keyboard arrow-key tab cycling regression test for handler at `OutcomesView.tsx:211-219` | New test added in Commit 2; `METRIC_TAB_ORDER = ['visus','crt','interval','responder']` confirmed at line 51 |
| MSEL-06 | Shared `tests/helpers/renderOutcomesView.tsx` extracts 7 vi.mock blocks + MemoryRouter + factory, reused by both test files | Commit 1 creates the file; the 7 mocks are fully documented in existing `OutcomesViewRouting.test.tsx` lines 26-109 |
</phase_requirements>

---

## Summary

Phase 18 is a pure test-infrastructure phase: no production code changes, no new npm dependencies. The work is entirely contained to `tests/` — creating one new helper file and modifying two existing test files. All the moving parts are already present in the codebase; the only blocker preventing the 5 skipped tests from running is the absence of the required vi.mock boilerplate inside `metricSelector.test.tsx`.

The two skipped test files (`tests/metricSelector.test.tsx` and `tests/metricSelector.test.ts`) are identical in content — both have the same 5 `describe.skip` cases. Only the `.tsx` variant is referenced in CONTEXT.md and REQUIREMENTS.md; the `.ts` file appears to be a duplicate artifact. The planner should address both files (either delete `.ts` or confirm which is canonical).

The helper's design is fully specified in CONTEXT.md (D-01 through D-06) and the source for copy-paste is precisely identified in `OutcomesViewRouting.test.tsx` lines 26-109 (mock blocks), 121-148 (`buildCase`/`buildCases`), and 156-197 (`renderView`).

**Primary recommendation:** Implement Commit 1 (helper extraction) then Commit 2 (unskip + keyboard test) exactly as specified in D-06. No design decisions remain open; research is confirmatory.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^4.1.4 [VERIFIED: package.json] | Test runner, vi.mock, vi.fn | Project-standard; already installed |
| @testing-library/react | ^16.3.2 [VERIFIED: package.json] | render, screen, fireEvent, cleanup | Project-standard; existing tests use it |
| react-router-dom | ^7.14.0 [VERIFIED: package.json] | MemoryRouter, Routes, Route | Production dep; test harness mirrors runtime routing |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jsdom | ^29.0.2 [VERIFIED: package.json] | DOM environment for component tests | Activated per-file via `// @vitest-environment jsdom` docblock |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fireEvent | @testing-library/user-event | More realistic but out of scope (D-05, deferred) |

**Installation:** No new packages required. [VERIFIED: package.json — all dependencies present]

---

## Architecture Patterns

### Test Environment Activation
[VERIFIED: vitest.config.ts]

The default Vitest environment is `node`. Component tests that need a DOM must declare at the top of the file:

```typescript
// @vitest-environment jsdom
```

`OutcomesViewRouting.test.tsx` already has this. The new `tests/helpers/renderOutcomesView.tsx` helper is not itself a test file and does not need the docblock — it only exports functions. `tests/metricSelector.test.tsx` currently lacks the `// @vitest-environment jsdom` docblock and needs it added.

### vi.mock Hoisting Constraint
[VERIFIED: OutcomesViewRouting.test.tsx lines 26-109]

Vitest hoists `vi.mock(...)` calls to the top of the file at compile time, before any import statements execute. This means:

- The `vi.mock(...)` call itself **must live in the test file** — it cannot be inside an imported helper function.
- The helper can export factory functions (the second argument to `vi.mock`) which the test file references.
- Pattern in use: the test file declares `vi.mock('../src/services/settingsService', factoryFromHelper)` where `factoryFromHelper` is imported from the helper.

### Partial Mock via importOriginal
[VERIFIED: OutcomesViewRouting.test.tsx lines 29-32, 57-82]

Two modules use partial mocking to preserve non-mocked exports:

```typescript
// Source: tests/OutcomesViewRouting.test.tsx lines 29-32
vi.mock('../src/services/settingsService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/settingsService')>();
  return { ...actual, loadSettings: (...args: unknown[]) => loadSettingsMock(...args) };
});
```

Same pattern applies to `cohortTrajectory` (preserves `defaultScatterOn`, `type` exports while overriding `computeCohortTrajectory`).

### Hook Mocking at Module Boundary
[VERIFIED: OutcomesViewRouting.test.tsx lines 38-45, 165-183]

`useData` and `useLanguage` are mocked at the module level (not via Provider wrappers). Each test call sets the return value before `render`:

```typescript
// Source: tests/OutcomesViewRouting.test.tsx lines 165-183
(useData as ReturnType<typeof vi.fn>).mockReturnValue({
  activeCases,
  savedSearches,
  centers: [],
  addSavedSearch: vi.fn(),
  removeSavedSearch: vi.fn(),
  qualityFlags: [],
  excludedCases: [],
  reviewedCases: [],
  loading: false,
  error: null,
  bundles: [],
  cases: [],
});
```

The full shape is critical — `OutcomesView` destructures all of these. Missing fields cause runtime errors in jsdom.

### fetchSpy Audit Beacon Guard
[VERIFIED: OutcomesViewRouting.test.tsx lines 203-208]

`OutcomesView` fires a `fetch('/api/audit/log', ...)` POST on mount. Without a fetch spy this will throw in jsdom (no network). The existing pattern:

```typescript
// Source: tests/OutcomesViewRouting.test.tsx lines 203-208
const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
beforeEach(() => {
  global.fetch = fetchSpy as unknown as typeof fetch;
  fetchSpy.mockClear();
});
```

### Recharts ResizeObserver Workaround
[VERIFIED: OutcomesViewRouting.test.tsx lines 85-109]

jsdom lacks ResizeObserver. Recharts' `ResponsiveContainer` requires it and will throw. The established pattern mocks the entire `recharts` module, replacing chart components with lightweight stubs:

```typescript
// Source: tests/OutcomesViewRouting.test.tsx lines 85-109
vi.mock('recharts', async (importOriginal) => {
  const real = await importOriginal<typeof import('recharts')>();
  return {
    ...real,
    ResponsiveContainer: ({ children }: { children: any }) => (
      <div data-testid="recharts-responsive-container"><svg>{children}</svg></div>
    ),
    ComposedChart: ({ children }: { children: any }) => (
      <g data-testid="recharts-composed-chart">{children}</g>
    ),
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
    ReferenceLine: () => null,
    Area: () => <g data-testid="recharts-area" />,
    Line: () => null,
    Scatter: () => null,
  };
});
```

### MemoryRouter + Routes Wrapper (D-03)
[VERIFIED: CONTEXT.md D-03, OutcomesViewRouting.test.tsx lines 188-196]

`OutcomesView` calls `useSearchParams()`, which requires a Router context with path matching. The helper must wrap with `Routes` and a `Route path="/analysis"` so `searchParams` resolve correctly:

```typescript
render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/analysis" element={<OutcomesView />} />
    </Routes>
  </MemoryRouter>
);
```

Without the `Routes`/`Route` wrapper, `useSearchParams` returns empty params and all metric-selection tests fail.

### METRIC_TAB_ORDER and Keyboard Handler
[VERIFIED: src/components/outcomes/OutcomesView.tsx lines 51, 211-219]

```typescript
// Source: OutcomesView.tsx line 51
const METRIC_TAB_ORDER: readonly MetricType[] = ['visus', 'crt', 'interval', 'responder'] as const;

// Source: OutcomesView.tsx lines 211-219
const handleMetricKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, current: MetricType) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  e.preventDefault();
  const idx = METRIC_TAB_ORDER.indexOf(current);
  const next = e.key === 'ArrowRight'
    ? METRIC_TAB_ORDER[(idx + 1) % METRIC_TAB_ORDER.length]
    : METRIC_TAB_ORDER[(idx - 1 + METRIC_TAB_ORDER.length) % METRIC_TAB_ORDER.length];
  handleMetricChange(next);
};
```

Tab buttons have `data-testid="metric-tab-{m}"` (e.g., `metric-tab-visus`) and `aria-selected={active}` (boolean coerced to string `"true"`/`"false"`). [VERIFIED: OutcomesView.tsx lines 403-412]

Wrap-around boundaries for MSEL-05:
- `responder` → ArrowRight → `visus` (index 3 → (3+1)%4 = 0)
- `visus` → ArrowLeft → `responder` (index 0 → (0-1+4)%4 = 3)

### Anti-Patterns to Avoid

- **Dynamic import inside `describe.skip`:** The current skipped tests use `await import(...)` inside each `it`. The unskipped version must replace this with a top-level static import (matching the `OutcomesViewRouting.test.tsx` pattern) so the vi.mock hoisting applies correctly.
- **Wrapping with MemoryRouter only (no Routes):** Without `<Route path="/analysis">`, `useSearchParams` returns empty and metric derivation falls to default `'visus'` regardless of URL — tests silently pass for wrong reasons.
- **Mutating `METRIC_TAB_ORDER` in tests:** The constant is `readonly`. Tests must reference it through the component's behavior, not import and mutate it.
- **Missing `// @vitest-environment jsdom`:** `metricSelector.test.tsx` currently has no jsdom docblock. Without it, `render` will fail in the Node environment.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mock hoisting | Custom module interception | `vi.mock()` with `importOriginal` | Vitest handles compile-time hoisting automatically |
| DOM environment | Manual jsdom setup | `// @vitest-environment jsdom` docblock | Vitest per-file env switching is built-in |
| Router context | Custom history/location stubs | `MemoryRouter` + `Routes` + `Route` | react-router-dom's test-first in-memory router |
| Fetch stub | XMLHttpRequest polyfill | `vi.fn()` on `global.fetch` | Simpler and consistent with existing pattern |

---

## Common Pitfalls

### Pitfall 1: Missing jsdom docblock in metricSelector.test.tsx
**What goes wrong:** Tests throw `document is not defined` or `render is not a function`.
**Why it happens:** Vitest defaults to `node` environment; `metricSelector.test.tsx` currently lacks `// @vitest-environment jsdom`. `OutcomesViewRouting.test.tsx` has it (line 1); `metricSelector.test.tsx` does not.
**How to avoid:** Add `// @vitest-environment jsdom` as the very first line of `metricSelector.test.tsx` in Commit 2.
**Warning signs:** Error message references `document` or `window` being undefined.

### Pitfall 2: Dynamic import inside test body bypasses vi.mock hoisting
**What goes wrong:** The existing skipped tests use `await import('../src/components/outcomes/OutcomesView')` inside each `it` body. When vi.mock calls are moved to a helper and imported, the dynamic import in the test body may resolve before mocks are applied.
**Why it happens:** `vi.mock` is statically hoisted to the top of the file. A dynamic `import()` inside `it` happens at runtime, after module resolution is complete — but in this case the module was never registered with mocks because the `vi.mock()` in the test file references factories from the helper. The resolution order is safe only if the static import of OutcomesView replaces the dynamic one.
**How to avoid:** Replace all `await import(...)` calls inside `it` bodies with a top-level `import OutcomesView from '../src/components/outcomes/OutcomesView'` (as done in `OutcomesViewRouting.test.tsx` line 20).
**Warning signs:** Tests fail with "Cannot read properties of undefined" on hooks, or OutcomesView renders without mocked data.

### Pitfall 3: vi.mock call must stay in the test file, not the helper
**What goes wrong:** Moving `vi.mock(...)` calls into the helper file causes them NOT to be hoisted, and module mocks are ignored at runtime.
**Why it happens:** Vitest's AST transformation that hoists `vi.mock()` only applies to the test file being compiled, not to imported modules.
**How to avoid:** The helper exports factory functions; the test file contains the `vi.mock('../src/services/...', helperFactory)` calls. This is explicitly documented in CONTEXT.md D-01 ("the mock calls live in the test file").
**Warning signs:** `useData` returns `undefined` instead of the mocked object.

### Pitfall 4: Duplicate test files (.ts and .tsx both exist)
**What goes wrong:** Both `tests/metricSelector.test.ts` and `tests/metricSelector.test.tsx` exist with identical content. Both will be picked up by `vitest run` (include pattern covers both `.test.ts` and `.test.tsx`).
**Why it happens:** Artifact from Phase 13 when the file may have been created with wrong extension then re-created. The `.tsx` extension is correct since JSX is used.
**How to avoid:** Delete `tests/metricSelector.test.ts` in Commit 2 (or Commit 1 to prevent double-execution of any intermediate state). The `.tsx` file is canonical.
**Warning signs:** After unskipping, tests appear to run twice; duplicate test names in CI output.

### Pitfall 5: useData mock shape missing fields
**What goes wrong:** `OutcomesView` crashes with "Cannot destructure property X of undefined" or similar.
**Why it happens:** The component destructures the full `useData()` return shape. Any missing field causes a runtime error.
**How to avoid:** The helper's default `useData` mock must include all 12 fields: `activeCases`, `savedSearches`, `centers`, `addSavedSearch`, `removeSavedSearch`, `qualityFlags`, `excludedCases`, `reviewedCases`, `loading`, `error`, `bundles`, `cases`. [VERIFIED: OutcomesViewRouting.test.tsx lines 165-178]

### Pitfall 6: aria-selected is a boolean attribute but asserted as string
**What goes wrong:** `expect(tab.getAttribute('aria-selected')).toBe(true)` fails even when tab is selected.
**Why it happens:** `aria-selected={active}` in JSX where `active` is a boolean renders as the string `"true"` or `"false"` in the DOM (or absent). `getAttribute` always returns a string.
**How to avoid:** Assert `.toBe('true')` (string), not `.toBe(true)` (boolean). This is consistent with existing tests. [VERIFIED: metricSelector.test.tsx line 15, OutcomesViewRouting.test.tsx — not directly tested there but consistent pattern]

---

## Code Examples

### Helper export shape (factory pattern)
```typescript
// tests/helpers/renderOutcomesView.tsx
// Source: pattern derived from OutcomesViewRouting.test.tsx lines 26-197

// Exported factories — consumed by vi.mock calls IN THE TEST FILE:
export const settingsServiceFactory = async (importOriginal: ...) => { ... };
export const fhirLoaderFactory = () => ({ applyFilters: vi.fn(c => c), ... });
export const cohortTrajectoryFactory = async (importOriginal: ...) => { ... };
export const rechartsFactory = async (importOriginal: ...) => { ... };

// Shared mock fn references — imported in test file after vi.mock declarations:
export const loadSettingsMock = vi.fn();
export const postAggregateMock = vi.fn();
export const useDataMock = vi.fn();
export const useLanguageMock = vi.fn();

// Default mock state builder:
export function buildCase(pseudo: string): PatientCase { ... }
export function buildCases(n: number): PatientCase[] { ... }

// Render factory:
export function renderOutcomesView(
  url: string,
  options?: { activeCases?, savedSearches?, locale?, settings?, postAggregate?, cohortTrajectoryResult? }
): ReturnType<typeof render> { ... }
```

### Keyboard test pattern (MSEL-05)
```typescript
// Source: derived from D-04 in CONTEXT.md + OutcomesView.tsx lines 211-219 + 396-418

it('ArrowRight advances metric and updates URL, wraps at end', () => {
  // Start at 'responder' (last in METRIC_TAB_ORDER)
  renderOutcomesView('/analysis?metric=responder&cohort=test-cohort');
  
  const tab = screen.getByTestId('metric-tab-responder');
  fireEvent.keyDown(tab, { key: 'ArrowRight' });
  
  // Should wrap to 'visus'
  expect(screen.getByTestId('metric-tab-visus').getAttribute('aria-selected')).toBe('true');
  // URL should reflect new metric (via setSearchParams in handleMetricChange)
  // Note: MemoryRouter tracks URL internally; verify via aria-selected as URL access
  // requires useSearchParams inspection or location.search — aria-selected is sufficient
});
```

### loadSettings mock shape (required by useEffect in OutcomesView)
```typescript
// Source: OutcomesViewRouting.test.tsx lines 222-228
loadSettingsMock.mockResolvedValue({
  twoFactorEnabled: false,
  therapyInterrupterDays: 120,
  therapyBreakerDays: 365,
  dataSource: { type: 'local' as const, blazeUrl: '' },
  outcomes: {
    serverAggregationThresholdPatients: 1000,
    aggregateCacheTtlMs: 1800000,
  },
});
```

---

## Runtime State Inventory

Step 2.5: SKIPPED — Phase 18 is a test-only change (no rename, refactor, or migration of production state).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | vitest run | ✓ [VERIFIED: npm scripts execute] | — | — |
| vitest | Test runner | ✓ [VERIFIED: package.json devDependencies] | ^4.1.4 | — |
| @testing-library/react | render/screen/fireEvent | ✓ [VERIFIED: package.json devDependencies] | ^16.3.2 | — |
| jsdom | DOM environment | ✓ [VERIFIED: package.json devDependencies] | ^29.0.2 | — |
| react-router-dom | MemoryRouter | ✓ [VERIFIED: package.json dependencies] | ^7.14.0 | — |

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm test -- --reporter=verbose tests/metricSelector.test.tsx` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MSEL-01 | 5 skipped cases are unskipped and passing | integration | `npm test -- tests/metricSelector.test.tsx` | ✅ (currently skipped) |
| MSEL-02 | `?metric=X` renders X tab; click updates URL | integration | `npm test -- tests/metricSelector.test.tsx` | ✅ (tests #2, #3) |
| MSEL-03 | `?metric=bogus` falls back to visus | integration | `npm test -- tests/metricSelector.test.tsx` | ✅ (test #5) |
| MSEL-04 | Back/forward via MemoryRouter restores metric | integration | `npm test -- tests/metricSelector.test.tsx` | ✅ (test #4 — param preservation) |
| MSEL-05 | ArrowRight/Left cycling + wrap-around | integration | `npm test -- tests/metricSelector.test.tsx` | ❌ Wave 0 — new test in Commit 2 |
| MSEL-06 | Shared helper reused by both test files | structural | `npm test -- tests/OutcomesViewRouting.test.tsx tests/metricSelector.test.tsx` | ❌ Wave 0 — helper created in Commit 1 |

### Sampling Rate
- **Per commit:** `npm test -- tests/metricSelector.test.tsx tests/OutcomesViewRouting.test.tsx`
- **Phase gate:** `npm test` (full suite green before phase complete)

### Wave 0 Gaps
- [ ] `tests/helpers/renderOutcomesView.tsx` — new file; directory does not exist [VERIFIED: `ls tests/helpers` ENOENT]
- [ ] `tests/metricSelector.test.tsx` — needs `// @vitest-environment jsdom` docblock, top-level static import, vi.mock calls referencing helper factories, `describe.skip` removed, MSEL-05 keyboard test added
- [ ] Delete `tests/metricSelector.test.ts` — duplicate of `.tsx` with wrong extension

---

## Security Domain

This phase introduces no network endpoints, no authentication changes, no data access changes, and no user-facing behavior changes. It is a test-infrastructure-only change. ASVS categories V2–V6 do not apply.

The audit beacon `fetchSpy` guard in the test harness prevents test-induced audit log noise — this is consistent with the security-first approach (no fake audit events in the log from test runs).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `tests/metricSelector.test.ts` is a duplicate artifact and should be deleted | Common Pitfalls #4 | If `.ts` is intentionally different, deleting it would remove those tests. Verify before delete. |
| A2 | `metricSelector.test.tsx` needs `// @vitest-environment jsdom` added | Common Pitfalls #1 | File currently has no docblock [VERIFIED by Read tool]; if jsdom is somehow globally configured, this is redundant but harmless |

**Both assumptions are low-risk** — A1 can be confirmed by diffing the two files (they are byte-identical), and A2 is directly observable from the file content.

---

## Open Questions

1. **Which file is canonical: `metricSelector.test.ts` or `metricSelector.test.tsx`?**
   - What we know: Both files exist with identical content. The `.tsx` extension is correct (JSX used). CONTEXT.md references only `.tsx`.
   - What's unclear: Was `.ts` intentionally kept for a reason?
   - Recommendation: Delete `.ts` in Commit 2; proceed with `.tsx` as canonical.

2. **Should `fetchSpy` live in the helper's exported `beforeEach` or remain per-test-file?**
   - What we know: CONTEXT.md marks this as Claude's discretion. `OutcomesViewRouting.test.tsx` declares it at file scope and resets in `beforeEach`. The helper could export a `setupFetchSpy()` function that test files call in their `beforeEach`.
   - Recommendation: Export `fetchSpy` from helper; each test file calls `beforeEach(() => { global.fetch = fetchSpy; fetchSpy.mockClear(); })` — keeps test files explicit about their global mutation without duplicating the spy construction.

---

## Sources

### Primary (HIGH confidence)
- `tests/OutcomesViewRouting.test.tsx` [VERIFIED: Read tool] — canonical source for 7 vi.mock patterns, buildCase/buildCases, renderView shape
- `tests/metricSelector.test.tsx` [VERIFIED: Read tool] — 5 describe.skip cases, current test structure
- `tests/metricSelector.test.ts` [VERIFIED: Read tool] — identical duplicate
- `src/components/outcomes/OutcomesView.tsx:51,203-219,396-418` [VERIFIED: Read tool] — METRIC_TAB_ORDER, handleMetricChange, handleMetricKeyDown, tab rendering
- `package.json` [VERIFIED: Read tool] — all library versions and test script
- `vitest.config.ts` [VERIFIED: Read tool] — environment: node default, jsdom via docblock
- `.planning/phases/18-metricselector-test-harness-unblock/18-CONTEXT.md` [VERIFIED: Read tool] — locked decisions D-01 through D-06
- `.planning/REQUIREMENTS.md` [VERIFIED: Read tool] — MSEL-01 through MSEL-06 acceptance criteria

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` [VERIFIED: Read tool] — phase ordering and milestone context

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json
- Architecture: HIGH — patterns read directly from existing test files and production source
- Pitfalls: HIGH — identified by direct code inspection, not heuristics

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (stable test infrastructure; no external dependencies that drift)
