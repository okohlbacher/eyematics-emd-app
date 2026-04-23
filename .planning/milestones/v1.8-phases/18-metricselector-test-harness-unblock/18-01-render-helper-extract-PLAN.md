---
phase: 18
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/helpers/renderOutcomesView.tsx
  - tests/OutcomesViewRouting.test.tsx
autonomous: true
requirements: [MSEL-06]
tags: [test-infrastructure, vitest, react-testing-library]

must_haves:
  truths:
    - "tests/helpers/renderOutcomesView.tsx exists and exports vi.mock factory functions, shared mock fn references, buildCase/buildCases, and renderOutcomesView(url, options)"
    - "tests/OutcomesViewRouting.test.tsx imports from the helper and no longer inlines the 7 vi.mock factory bodies"
    - "All previously-passing tests in OutcomesViewRouting.test.tsx remain green after migration"
    - "describe.skip blocks in tests/metricSelector.test.tsx are NOT touched in this plan (commit 1 is refactor-only per D-06)"
  artifacts:
    - path: "tests/helpers/renderOutcomesView.tsx"
      provides: "Shared vi.mock factories + renderOutcomesView(url, options) factory"
      contains: "export function renderOutcomesView"
    - path: "tests/OutcomesViewRouting.test.tsx"
      provides: "Migrated to use the shared helper"
      contains: "from './helpers/renderOutcomesView'"
  key_links:
    - from: "tests/OutcomesViewRouting.test.tsx"
      to: "tests/helpers/renderOutcomesView.tsx"
      via: "static import of factory functions + render helper"
      pattern: "import.*helpers/renderOutcomesView"
    - from: "tests/OutcomesViewRouting.test.tsx (vi.mock calls)"
      to: "exported factories from helper"
      via: "vi.mock('module', factoryFromHelper) — call lives in test file (vi.mock hoisting constraint)"
      pattern: "vi\\.mock\\(.*(settingsServiceFactory|fhirLoaderFactory|cohortTrajectoryFactory|rechartsFactory)"
---

<objective>
Extract the 7 vi.mock blocks + MemoryRouter wrapper + render helper from `tests/OutcomesViewRouting.test.tsx` into a new shared `tests/helpers/renderOutcomesView.tsx`. Migrate `OutcomesViewRouting.test.tsx` to consume the helper. This is Commit 1 of D-06 — refactor-only, no behavior change, all currently-green tests stay green.

Purpose: Implements MSEL-06 (shared helper). Unblocks Plan 02 (which unskips metricSelector.test.tsx and migrates onto this helper).
Output: New helper file + migrated OutcomesViewRouting.test.tsx, all tests green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/18-metricselector-test-harness-unblock/18-CONTEXT.md
@.planning/phases/18-metricselector-test-harness-unblock/18-RESEARCH.md
@.planning/phases/18-metricselector-test-harness-unblock/18-VALIDATION.md
@tests/OutcomesViewRouting.test.tsx
@src/components/outcomes/OutcomesView.tsx
</context>

<interfaces>
<!-- Helper module shape required by D-01/D-02/D-03. Source-of-truth pattern lives in OutcomesViewRouting.test.tsx lines 26-197. -->

Helper exports (tests/helpers/renderOutcomesView.tsx):
```typescript
// Factory functions — passed AS the second arg to vi.mock() in the test file.
// (vi.mock calls themselves cannot live here — Vitest only hoists vi.mock from the test file being compiled.)
export const settingsServiceFactory: (importOriginal: <T = unknown>() => Promise<T>) => Promise<unknown>;
export const cohortTrajectoryFactory: (importOriginal: <T = unknown>() => Promise<T>) => Promise<unknown>;
export const rechartsFactory: (importOriginal: <T = unknown>() => Promise<T>) => Promise<unknown>;
export const dataContextFactory: () => { useData: ReturnType<typeof vi.fn> };
export const languageContextFactory: () => { useLanguage: ReturnType<typeof vi.fn> };
export const fhirLoaderFactory: () => {
  applyFilters: ReturnType<typeof vi.fn>;
  LOINC_VISUS: string;
  SNOMED_IVI: string;
  SNOMED_EYE_LEFT: string;
  SNOMED_EYE_RIGHT: string;
  getObservationsByCode: ReturnType<typeof vi.fn>;
};
export const outcomesAggregateFactory: () => { postAggregate: ReturnType<typeof vi.fn> };

// Shared mock fn references — imported by test files AFTER they declare vi.mock(...).
export const loadSettingsMock: ReturnType<typeof vi.fn>;
export const postAggregateMock: ReturnType<typeof vi.fn>;

// Stub builders.
export function buildCase(pseudo: string): PatientCase;
export function buildCases(n: number): PatientCase[];

// Render factory (D-02 signature).
export interface RenderOutcomesViewOptions {
  activeCases?: PatientCase[];
  savedSearches?: SavedSearch[];
  locale?: string;
  settings?: Partial<{
    twoFactorEnabled: boolean;
    therapyInterrupterDays: number;
    therapyBreakerDays: number;
    dataSource: { type: 'local'; blazeUrl: string };
    outcomes: { serverAggregationThresholdPatients: number; aggregateCacheTtlMs: number };
  }>;
  postAggregate?: (...args: unknown[]) => unknown;
  cohortTrajectoryResult?: unknown;
}
export function renderOutcomesView(
  url: string,
  options?: RenderOutcomesViewOptions,
): ReturnType<typeof render>;

// Audit beacon guard (Open Question #2 in RESEARCH — keep in helper for re-use).
export const fetchSpy: ReturnType<typeof vi.fn>;
```

Critical constraint (Pitfall #3 in RESEARCH):
- `vi.mock(...)` calls MUST live in the test file (Vitest's hoisting transformer only runs on the test file being compiled).
- The helper exports the factory functions; the test file writes:
  ```typescript
  vi.mock('../src/services/settingsService', settingsServiceFactory);
  vi.mock('../src/context/DataContext', dataContextFactory);
  // etc.
  ```

Default mock state (D-01) — applied by `renderOutcomesView` when option fields are omitted:
- activeCases: `buildCases(5)`
- savedSearches: `[{ id: 'test-cohort', name: 'Test Cohort', createdAt: '2024-01-01T00:00:00Z', filters: {} }]`
- locale: `'en'`
- settings: `{ twoFactorEnabled: false, therapyInterrupterDays: 120, therapyBreakerDays: 365, dataSource: { type: 'local', blazeUrl: '' }, outcomes: { serverAggregationThresholdPatients: 1000, aggregateCacheTtlMs: 1800000 } }`

useData mock shape (Pitfall #5 in RESEARCH — all 12 fields required):
```typescript
{ activeCases, savedSearches, centers: [], addSavedSearch: vi.fn(), removeSavedSearch: vi.fn(),
  qualityFlags: [], excludedCases: [], reviewedCases: [], loading: false, error: null,
  bundles: [], cases: [] }
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Create tests/helpers/renderOutcomesView.tsx</name>
  <files>tests/helpers/renderOutcomesView.tsx</files>
  <read_first>
    - tests/OutcomesViewRouting.test.tsx (lines 1-220 — full source pattern to extract; copy verbatim, then generalize into options-driven helper)
    - .planning/phases/18-metricselector-test-harness-unblock/18-CONTEXT.md (D-01 through D-06 — locked decisions)
    - .planning/phases/18-metricselector-test-harness-unblock/18-RESEARCH.md (Pitfalls 1, 2, 3, 5 — vi.mock hoisting + useData shape)
    - src/components/outcomes/OutcomesView.tsx (lines 81-220 — verify hook destructure shape so the useData mock includes every field)
    - src/types/fhir.ts (PatientCase, SavedSearch type shapes referenced by buildCase / options)
  </read_first>
  <action>
    Create the new directory `tests/helpers/` (does not exist yet — `ls tests/helpers` returns ENOENT) and write `tests/helpers/renderOutcomesView.tsx` exporting the interfaces specified above.

    Concrete content requirements (per D-01):

    1. Top-of-file imports: `vi` from 'vitest'; `render` from '@testing-library/react'; React for JSX; `MemoryRouter`, `Routes`, `Route` from 'react-router-dom'; `OutcomesView` from '../../src/components/outcomes/OutcomesView'; types `PatientCase`, `SavedSearch` from '../../src/types/fhir'.

    2. Export shared mock fn references at module scope:
       ```typescript
       export const loadSettingsMock = vi.fn();
       export const postAggregateMock = vi.fn();
       export const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
       ```

    3. Export 7 factory functions, copied verbatim from `tests/OutcomesViewRouting.test.tsx` lines 29-109 with these adaptations:
       - `settingsServiceFactory`: partial mock via `importOriginal`, overrides `loadSettings` to call `loadSettingsMock`
       - `outcomesAggregateFactory`: returns `{ postAggregate: (...args) => postAggregateMock(...args) }`
       - `dataContextFactory`: returns `{ useData: vi.fn() }`
       - `languageContextFactory`: returns `{ useLanguage: vi.fn() }`
       - `fhirLoaderFactory`: returns the 6 keys from line 47-54 (applyFilters as `vi.fn((cases) => cases)`, LOINC_VISUS '79880-1', SNOMED_IVI '36189003', SNOMED_EYE_LEFT '362502000', SNOMED_EYE_RIGHT '362503005', getObservationsByCode `vi.fn(() => [])`)
       - `cohortTrajectoryFactory`: partial mock preserving `defaultScatterOn`, `type` exports; overrides `computeCohortTrajectory` with `vi.fn(() => ({ od:..., os:..., combined:... }))` shape from lines 60-81
       - `rechartsFactory`: partial mock returning the stub shape from lines 87-108

    4. Export `buildCase(pseudo: string): PatientCase` and `buildCases(n: number): PatientCase[]` copied verbatim from lines 121-148 of `OutcomesViewRouting.test.tsx`.

    5. Export `renderOutcomesView(url, options?)` per D-02 signature. Implementation:
       ```typescript
       export function renderOutcomesView(url: string, options: RenderOutcomesViewOptions = {}) {
         const activeCases = options.activeCases ?? buildCases(5);
         const savedSearches = options.savedSearches ?? [
           { id: 'test-cohort', name: 'Test Cohort', createdAt: '2024-01-01T00:00:00Z', filters: {} },
         ];
         const locale = options.locale ?? 'en';
         const settings = {
           twoFactorEnabled: false,
           therapyInterrupterDays: 120,
           therapyBreakerDays: 365,
           dataSource: { type: 'local' as const, blazeUrl: '' },
           outcomes: { serverAggregationThresholdPatients: 1000, aggregateCacheTtlMs: 1800000 },
           ...(options.settings ?? {}),
         };

         loadSettingsMock.mockResolvedValue(settings);
         if (options.postAggregate) postAggregateMock.mockImplementation(options.postAggregate);

         // Resolve the mocked hooks via the same module specifiers the test file used.
         // Test files import { useData } / { useLanguage } / { applyFilters } AFTER vi.mock so they receive the mocked exports.
         // The helper does the same and calls .mockReturnValue on them.
         const { useData } = await import('../../src/context/DataContext'); // NOTE: must be dynamic-resolved at call time
         // ... (mockReturnValue with the full 12-field useData shape)
         return render(
           <MemoryRouter initialEntries={[url]}>
             <Routes>
               <Route path="/analysis" element={<OutcomesView />} />
             </Routes>
           </MemoryRouter>,
         );
       }
       ```
       NOTE for executor: the dynamic `await import` complicates a synchronous `render`. Prefer importing the hooks at the top of the helper (after vi.mock declarations resolve at the consumer site, the imported reference is already the mocked vi.fn). Pattern verified in OutcomesViewRouting.test.tsx line 111-113: `import { useData } from '../src/context/DataContext'` AFTER the `vi.mock(...)` block at line 39 — at runtime `useData` is the `vi.fn()` returned by the factory. Mirror that here: top-level static imports of `useData`, `useLanguage`, `applyFilters` from `'../../src/context/DataContext'`, `'../../src/context/LanguageContext'`, `'../../src/services/fhirLoader'` respectively. Then `(useData as ReturnType<typeof vi.fn>).mockReturnValue({...})` inside the function — synchronous render, no `await import`.

    6. For `cohortTrajectoryResult` option: if provided, call `(computeCohortTrajectory as ReturnType<typeof vi.fn>).mockReturnValue(options.cohortTrajectoryResult)` before render. Import `computeCohortTrajectory` from `'../../src/utils/cohortTrajectory'` at top.

    7. The full `useData` mock shape MUST include all 12 fields (Pitfall #5):
       `activeCases, savedSearches, centers: [], addSavedSearch: vi.fn(), removeSavedSearch: vi.fn(), qualityFlags: [], excludedCases: [], reviewedCases: [], loading: false, error: null, bundles: [], cases: []`

    8. The `useLanguage` mock returns `{ locale, setLocale: vi.fn(), t: (k: string) => k }`.

    9. The `applyFilters` mock returns `vi.fn().mockImplementation((cases) => cases)`.

    DO NOT add `// @vitest-environment jsdom` to the helper — it's not a test file. The docblock only applies to files Vitest treats as test entrypoints.

    DO NOT delete `tests/metricSelector.test.ts` in this plan — that's Plan 02 / Commit 2.
  </action>
  <verify>
    <automated>test -f tests/helpers/renderOutcomesView.tsx &amp;&amp; npx tsc --noEmit -p tsconfig.json 2>&amp;1 | grep -i 'renderOutcomesView' || echo 'TS ok'</automated>
  </verify>
  <acceptance_criteria>
    - File `tests/helpers/renderOutcomesView.tsx` exists
    - `grep -c 'export const settingsServiceFactory' tests/helpers/renderOutcomesView.tsx` == 1
    - `grep -c 'export const cohortTrajectoryFactory' tests/helpers/renderOutcomesView.tsx` == 1
    - `grep -c 'export const rechartsFactory' tests/helpers/renderOutcomesView.tsx` == 1
    - `grep -c 'export const dataContextFactory' tests/helpers/renderOutcomesView.tsx` == 1
    - `grep -c 'export const languageContextFactory' tests/helpers/renderOutcomesView.tsx` == 1
    - `grep -c 'export const fhirLoaderFactory' tests/helpers/renderOutcomesView.tsx` == 1
    - `grep -c 'export const outcomesAggregateFactory' tests/helpers/renderOutcomesView.tsx` == 1
    - `grep -c 'export const loadSettingsMock' tests/helpers/renderOutcomesView.tsx` == 1
    - `grep -c 'export const postAggregateMock' tests/helpers/renderOutcomesView.tsx` == 1
    - `grep -c 'export function renderOutcomesView' tests/helpers/renderOutcomesView.tsx` == 1
    - `grep -c 'export function buildCase' tests/helpers/renderOutcomesView.tsx` == 1
    - `grep -c 'export function buildCases' tests/helpers/renderOutcomesView.tsx` == 1
    - `grep -c '<Route path="/analysis"' tests/helpers/renderOutcomesView.tsx` == 1
    - `grep -c "vi.mock(" tests/helpers/renderOutcomesView.tsx` == 0 (vi.mock calls MUST NOT live in helper — Pitfall #3)
    - `grep -c '@vitest-environment jsdom' tests/helpers/renderOutcomesView.tsx` == 0 (helper is not a test file)
    - useData mock object literal contains all 12 keys: activeCases, savedSearches, centers, addSavedSearch, removeSavedSearch, qualityFlags, excludedCases, reviewedCases, loading, error, bundles, cases
  </acceptance_criteria>
  <done>
    Helper file compiles cleanly under TypeScript and exports the full surface required by Plan 02. No other test files modified yet.
  </done>
</task>

<task type="auto">
  <name>Task 2: Migrate tests/OutcomesViewRouting.test.tsx onto the helper</name>
  <files>tests/OutcomesViewRouting.test.tsx</files>
  <read_first>
    - tests/OutcomesViewRouting.test.tsx (current full file — identifies which inline blocks become helper imports)
    - tests/helpers/renderOutcomesView.tsx (the file Task 1 just created — confirm exact import names)
    - .planning/phases/18-metricselector-test-harness-unblock/18-CONTEXT.md (D-06: refactor-only commit, no behavior change)
  </read_first>
  <action>
    Rewrite `tests/OutcomesViewRouting.test.tsx` to consume the helper. Preserve EVERY existing test case and its assertions verbatim — this is a pure refactor.

    Required structure of the migrated file:

    1. Keep the `// @vitest-environment jsdom` docblock as the first line (line 1).

    2. Imports section:
       - `import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'`
       - `import { cleanup, screen, waitFor } from '@testing-library/react'` (drop `render` since renderOutcomesView wraps it)
       - Import factories + mocks + builders + render helper:
         ```typescript
         import {
           settingsServiceFactory,
           outcomesAggregateFactory,
           dataContextFactory,
           languageContextFactory,
           fhirLoaderFactory,
           cohortTrajectoryFactory,
           rechartsFactory,
           loadSettingsMock,
           postAggregateMock,
           fetchSpy,
           buildCase,
           buildCases,
           renderOutcomesView,
         } from './helpers/renderOutcomesView';
         ```

    3. Replace lines 26-109 (the 7 inline vi.mock blocks) with seven `vi.mock(...)` calls referencing the imported factories — KEEP the calls in this test file (Pitfall #3):
       ```typescript
       vi.mock('../src/services/settingsService', settingsServiceFactory);
       vi.mock('../src/services/outcomesAggregateService', outcomesAggregateFactory);
       vi.mock('../src/context/DataContext', dataContextFactory);
       vi.mock('../src/context/LanguageContext', languageContextFactory);
       vi.mock('../src/services/fhirLoader', fhirLoaderFactory);
       vi.mock('../src/utils/cohortTrajectory', cohortTrajectoryFactory);
       vi.mock('recharts', rechartsFactory);
       ```

    4. Delete the inline `loadSettingsMock`, `postAggregateMock`, `fetchSpy` declarations (now imported).

    5. Delete the inline `buildCase`, `buildCases` definitions (now imported).

    6. Delete the inline `renderView` function (now imported as `renderOutcomesView`).

    7. Update test bodies: every `renderView(activeCases, options)` call becomes `renderOutcomesView(url, { activeCases, savedSearches: options.savedSearches })` — note the URL is now an explicit first arg. Existing calls implicitly used `/analysis?tab=trajectories&cohort=${cohortId}` — pass that URL string explicitly to preserve behavior.

    8. The `renderCrossView` function (lines 334-371) — KEEP it inline OR replace with `renderOutcomesView(url, { savedSearches: CROSS_COHORT_SAVED_SEARCHES, activeCases: buildCases(5) })`. Prefer replacement to maximize helper coverage.

    9. Preserve `beforeEach`/`afterEach` blocks. The fetchSpy install pattern stays in this test file (helper exports the spy fn; the test file installs `global.fetch = fetchSpy` per RESEARCH Open Question #2 recommendation).

    10. Drop the now-unused imports of `MemoryRouter`, `Routes`, `Route`, `render`, `OutcomesView`, `useData`, `useLanguage`, `applyFilters`, type imports for `PatientCase`/`SavedSearch` if no longer referenced (TypeScript will flag unused imports).

    DO NOT change any test name, any `it(...)` body assertion, any expected value. Behavior must be byte-identical — only the wiring changes.
  </action>
  <verify>
    <automated>npx vitest run tests/OutcomesViewRouting.test.tsx --reporter=verbose 2>&amp;1 | tail -40</automated>
  </verify>
  <acceptance_criteria>
    - `npx vitest run tests/OutcomesViewRouting.test.tsx` exits 0
    - Test count matches pre-migration count (count `it(` occurrences in git HEAD vs working tree — should be equal)
    - `grep -c "vi.mock(" tests/OutcomesViewRouting.test.tsx` == 7 (calls remain — only factory bodies move to helper)
    - `grep -c "from './helpers/renderOutcomesView'" tests/OutcomesViewRouting.test.tsx` == 1
    - `grep -c "function renderView" tests/OutcomesViewRouting.test.tsx` == 0 (inline render fn removed)
    - `grep -c "function buildCase" tests/OutcomesViewRouting.test.tsx` == 0 (inline builders removed)
    - `grep -c "renderOutcomesView(" tests/OutcomesViewRouting.test.tsx` &gt;= 4 (was at least 4 renderView calls)
    - No `describe.skip` introduced in metricSelector.test.tsx — file untouched in this plan
    - File still has `// @vitest-environment jsdom` as first line
  </acceptance_criteria>
  <done>
    `tests/OutcomesViewRouting.test.tsx` consumes the shared helper, all originally-passing tests still pass, no behavior diff. metricSelector.test.tsx and metricSelector.test.ts both still untouched in their pre-Plan-02 state.
  </done>
</task>

</tasks>

<verification>
- `npx vitest run tests/OutcomesViewRouting.test.tsx` — green, same test count as pre-migration
- `npx vitest run` (full suite) — green; no other test broken by the helper introduction
- `tests/helpers/renderOutcomesView.tsx` exists with the 14-symbol export surface declared above
- No production code modified (`git diff --name-only -- src/` returns empty)
- No `vi.mock(...)` calls present inside the helper file
</verification>

<success_criteria>
- MSEL-06 partially satisfied: helper extracted, OutcomesViewRouting.test.tsx migrated. (Full satisfaction comes when Plan 02 wires metricSelector.test.tsx onto the same helper.)
- All previously-passing tests in the full suite still pass.
- Single git commit per D-06 Commit 1: refactor-only.
</success_criteria>

<output>
After completion, create `.planning/phases/18-metricselector-test-harness-unblock/18-01-SUMMARY.md` capturing:
- Helper export surface (verify the 14 symbols)
- Number of test cases migrated in OutcomesViewRouting.test.tsx
- Any deviations from the planned helper API (Claude's discretion items resolved)
- Confirmation that metricSelector.test.tsx and .ts files are still in their pre-plan state
</output>
