---
phase: 19
plan: 02
type: execute
wave: 2
depends_on:
  - "19-01"
files_modified:
  - src/pages/audit/auditPageState.ts
  - src/pages/audit/auditFormatters.ts
  - src/pages/audit/useAuditData.ts
  - src/pages/AuditPage.tsx
  - tests/auditPageReducer.test.ts
autonomous: true
requirements:
  - AUDIT-01
  - AUDIT-03
  - AUDIT-04
must_haves:
  truths:
    - "Three new modules exist at exact paths: src/pages/audit/auditPageState.ts, src/pages/audit/auditFormatters.ts, src/pages/audit/useAuditData.ts"
    - "src/pages/AuditPage.tsx is render-only: contains no useState, no useEffect, no authFetch, no setTimeout"
    - "AuditPage.tsx imports useAuditData() and dispatches FILTER_SET / FILTERS_RESET directly"
    - "Reducer has exactly 5 discriminated-union actions: FILTER_SET, FILTERS_RESET, FETCH_START, FETCH_SUCCESS, FETCH_ERROR"
    - "FETCH_SUCCESS and FETCH_ERROR are no-ops when payload.epoch !== state.requestEpoch (stale-response guard)"
    - "describeAction, describeDetail, isRelevantEntry, statusBadgeClass moved VERBATIM (byte-identical) from AuditPage.tsx to auditFormatters.ts"
    - "useAuditData hook owns the 300 ms debounce AND an AbortController; cleanup calls both clearTimeout and ctrl.abort()"
    - "tests/auditPageReducer.test.ts exercises all 5 action variants AND the requestEpoch stale-guard for FETCH_SUCCESS and FETCH_ERROR"
    - "tests/auditPageReducer.test.ts also covers selectDistinctUsers and selectFilteredEntries selectors plus describeAction/describeDetail formatter outputs"
    - "tests/auditPageCharacterization.test.tsx (from Plan 01) remains GREEN with zero edits — characterization is the regression spec"
    - "No new dependencies added (package.json + package-lock.json unchanged in dependencies/devDependencies sections)"
    - "No settings.yaml keys added or modified"
    - "No i18n key changes in src/i18n/translations.ts"
    - "Commit message starts with `refactor(19): migrate AuditPage to useReducer state machine`"
  artifacts:
    - path: "src/pages/audit/auditPageState.ts"
      provides: "AuditFilters, AuditState, AuditAction types; auditReducer; initialState/initialFilters; selectDistinctUsers, selectFilteredEntries selectors"
      contains: "export type AuditAction"
    - path: "src/pages/audit/auditFormatters.ts"
      provides: "describeAction, describeDetail, isRelevantEntry, statusBadgeClass (verbatim move)"
      contains: "export function describeAction"
    - path: "src/pages/audit/useAuditData.ts"
      provides: "useAuditData() hook returning { state, dispatch, refetch }"
      contains: "export function useAuditData"
    - path: "src/pages/AuditPage.tsx"
      provides: "Render-only component consuming useAuditData()"
      max_lines: 220
    - path: "tests/auditPageReducer.test.ts"
      provides: "Pure unit test for reducer + selectors + formatters"
      contains: "describe('auditReducer'"
  key_links:
    - from: "src/pages/AuditPage.tsx"
      to: "src/pages/audit/useAuditData.ts"
      via: "named import + hook call"
      pattern: "from '\\./audit/useAuditData'"
    - from: "src/pages/audit/useAuditData.ts"
      to: "src/pages/audit/auditPageState.ts"
      via: "useReducer(auditReducer, initialState)"
      pattern: "useReducer\\(auditReducer"
    - from: "src/pages/audit/useAuditData.ts"
      to: "src/services/authHeaders"
      via: "authFetch with AbortController signal"
      pattern: "authFetch\\(.*signal"
    - from: "src/pages/AuditPage.tsx"
      to: "src/pages/audit/auditFormatters"
      via: "named imports of describeAction, describeDetail, statusBadgeClass"
      pattern: "from '\\./audit/auditFormatters'"
---

<objective>
Refactor `src/pages/AuditPage.tsx` (337 LOC, 10 useState + ad-hoc useEffect fetch) into a `useReducer`-driven state machine split across three new sibling modules under `src/pages/audit/`. The Plan 01 characterization tests are the regression spec — they must remain green with ZERO edits after this refactor. Add a pure-unit reducer test exercising all 5 action variants plus the `requestEpoch` stale-response guard.

Purpose: Satisfies AUDIT-01 (byte-identical v1.7 behavior preserved), AUDIT-03 (file split + render-only AuditPage), AUDIT-04 (reducer test with epoch guard). Sets the precedent for v1.8+ async hooks (Phase 20 silent-refresh may reuse the epoch pattern). Cleanly relocates `describeAction` for Phase 20 SESSION-13 to extend.

Output: 4 source files (3 new, 1 slimmed), 1 new unit test file, characterization tests still green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/19-auditpage-state-machine-refactor/19-CONTEXT.md
@.planning/phases/19-auditpage-state-machine-refactor/19-RESEARCH.md
@.planning/phases/19-auditpage-state-machine-refactor/19-VALIDATION.md
@.planning/phases/19-auditpage-state-machine-refactor/19-01-SUMMARY.md
@src/pages/AuditPage.tsx
@tests/auditPageCharacterization.test.tsx

<interfaces>
<!-- New module contracts. Executor implements these exactly; downstream consumers depend on them. -->

NEW src/pages/audit/auditPageState.ts:
```ts
export interface ServerAuditEntry {
  id: number;        // pre-existing type lie — DO NOT FIX (R-01)
  timestamp: string;
  method: string;
  path: string;
  user: string;
  status: number;
  duration_ms: number;
}

export interface AuditFilters {
  user: string;                                            // '' = all
  category: '' | 'auth' | 'data' | 'admin' | 'outcomes';
  fromDate: string;                                        // YYYY-MM-DD; '' = unset
  toDate: string;                                          // YYYY-MM-DD; '' = unset
  search: string;                                          // body_search; admin-only at UI; max 128
  failuresOnly: boolean;                                   // status_gte=400
}

export const initialFilters: AuditFilters = {
  user: '', category: '', fromDate: '', toDate: '', search: '', failuresOnly: false,
};

export interface AuditState {
  filters: AuditFilters;
  entries: ServerAuditEntry[];
  total: number;
  loading: boolean;     // initialState.loading MUST be true (R-06)
  error: string | null;
  requestEpoch: number;
}

export const initialState: AuditState = {
  filters: initialFilters,
  entries: [],
  total: 0,
  loading: true,
  error: null,
  requestEpoch: 0,
};

export type AuditAction =
  | { type: 'FILTER_SET'; key: keyof AuditFilters; value: AuditFilters[keyof AuditFilters] }
  | { type: 'FILTERS_RESET' }
  | { type: 'FETCH_START'; epoch: number }
  | { type: 'FETCH_SUCCESS'; epoch: number; entries: ServerAuditEntry[]; total: number }
  | { type: 'FETCH_ERROR'; epoch: number; error: string };

export function auditReducer(state: AuditState, action: AuditAction): AuditState;

// Selectors (pure functions; no memoization inside — caller wraps with useMemo)
export function selectDistinctUsers(entries: ServerAuditEntry[]): string[];
export function selectFilteredEntries(entries: ServerAuditEntry[]): ServerAuditEntry[];
```

NEW src/pages/audit/auditFormatters.ts (verbatim move from AuditPage.tsx lines 21-85):
```ts
import type { ServerAuditEntry } from './auditPageState';
import type { TranslationKey } from '../../i18n/translations';

export type TranslationFn = (key: TranslationKey) => string;
export function describeAction(method: string, path: string, t: TranslationFn): string;
export function describeDetail(method: string, path: string, user: string, t: TranslationFn): string;
export function isRelevantEntry(entry: ServerAuditEntry): boolean;
export function statusBadgeClass(status: number): string;
```

NEW src/pages/audit/useAuditData.ts:
```ts
export function useAuditData(): {
  state: AuditState;
  dispatch: React.Dispatch<AuditAction>;
  refetch: () => void;
};
```

REFACTORED src/pages/AuditPage.tsx — render-only signature unchanged:
```ts
export default function AuditPage(): JSX.Element;
```
</interfaces>

<reducer_semantics>
Reducer rules (these are the spec; tests in `tests/auditPageReducer.test.ts` enforce them):

- `FILTER_SET`: returns `{ ...state, filters: { ...state.filters, [action.key]: action.value } }`. Object identity of `state.filters` MUST change (R-02 — useEffect dep needs new ref to refire).
- `FILTERS_RESET`: returns `{ ...state, filters: initialFilters }`. `entries`, `total`, `loading`, `error`, `requestEpoch` UNTOUCHED.
- `FETCH_START`: returns `{ ...state, loading: true, error: null, requestEpoch: action.epoch }`.
- `FETCH_SUCCESS`: if `action.epoch !== state.requestEpoch` → return `state` (same reference). Otherwise return `{ ...state, loading: false, error: null, entries: action.entries, total: action.total }`.
- `FETCH_ERROR`: if `action.epoch !== state.requestEpoch` → return `state` (same reference). Otherwise return `{ ...state, loading: false, error: action.error }`. `entries` and `total` are PRESERVED (not cleared).
- Default case: `return state` (TypeScript exhaustiveness — `assertNever(action)` is fine but not required).
</reducer_semantics>

<hook_semantics>
`useAuditData()` implementation contract:

```ts
export function useAuditData() {
  const [state, dispatch] = useReducer(auditReducer, initialState);
  const epochRef = useRef(0);
  const [refetchTick, setRefetchTick] = useState(0);

  useEffect(() => {
    const epoch = ++epochRef.current;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      dispatch({ type: 'FETCH_START', epoch });
      const params = new URLSearchParams({ limit: '500', offset: '0' });
      if (state.filters.user) params.set('user', state.filters.user);
      if (state.filters.category) params.set('action_category', state.filters.category);
      if (state.filters.fromDate) params.set('fromTime', state.filters.fromDate);
      if (state.filters.toDate) params.set('toTime', `${state.filters.toDate}T23:59:59`);
      if (state.filters.search) params.set('body_search', state.filters.search);
      if (state.filters.failuresOnly) params.set('status_gte', '400');
      try {
        const res = await authFetch(`/api/audit?${params.toString()}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json() as { entries: ServerAuditEntry[]; total: number };
        dispatch({ type: 'FETCH_SUCCESS', epoch, entries: data.entries, total: data.total });
      } catch (err) {
        if (ctrl.signal.aborted) return;
        const msg = err instanceof Error ? err.message : 'Failed to load audit log';
        dispatch({ type: 'FETCH_ERROR', epoch, error: msg });
      }
    }, 300);
    return () => { ctrl.abort(); clearTimeout(timer); };
  }, [state.filters, refetchTick]);

  const refetch = useCallback(() => setRefetchTick(t => t + 1), []);
  return { state, dispatch, refetch };
}
```

Critical contracts (R-02, R-05, R-06):
- Cleanup MUST call BOTH `ctrl.abort()` AND `clearTimeout(timer)`
- Effect dep is `[state.filters, refetchTick]` (NOT individual fields — relies on FILTER_SET returning new filters object)
- AbortController is the network-cancel optimization; reducer epoch guard is the source-of-truth for stale responses
- Error message format `Server returned ${res.status}` MUST be byte-identical to v1.7 (characterization test asserts literal "Server returned 500")
- `'Failed to load audit log'` fallback string MUST be byte-identical
</hook_semantics>

<page_render_contract>
Refactored AuditPage.tsx:
- Imports: `Download`, `FileText` from `lucide-react`; `useMemo` from `react`; `useAuth`, `useLanguage`, `getDateLocale`, `datedFilename`, `downloadBlob`, `downloadCsv` (verbatim); `authFetch` ONLY for `handleExportJson` (the export-blob fetch is a one-shot, NOT in the hook); `useAuditData` from `./audit/useAuditData`; `describeAction`, `describeDetail`, `statusBadgeClass` from `./audit/auditFormatters`; `selectDistinctUsers`, `selectFilteredEntries` from `./audit/auditPageState`.
- Body: `const { state, dispatch } = useAuditData();` — destructure `entries, total, loading, error, filters` from `state`. Compute `distinctUsers = useMemo(() => selectDistinctUsers(entries), [entries])` and `filteredEntries = useMemo(() => selectFilteredEntries(entries), [entries])`.
- Filter `<input>`/`<select>` `onChange` handlers fire `dispatch({ type: 'FILTER_SET', key: '<filterName>', value: <new value> })` directly (no wrapper helpers per D-Discretion default).
- `handleExportCsv` and `handleExportJson` stay verbatim (they use `authFetch` for the JSON export which is OK — only the LIST fetch moves to the hook). The two `user?.role === 'admin'` checks at lines 107 and 250 of original stay verbatim — do NOT consolidate (R-07).
- The stale comment "5 controls per UI-SPEC D-01..D-04" at original line 96 MUST NOT be carried over. Either drop it or replace with "6-dim filter state managed via useAuditData hook".
- JSX render structure (filter panel, controls row, 4 render states, table) is byte-identical — every DOM element, class string, and i18n key call preserved.
</page_render_contract>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create auditPageState.ts (types + reducer + selectors) and auditFormatters.ts (verbatim formatter move)</name>
  <files>src/pages/audit/auditPageState.ts, src/pages/audit/auditFormatters.ts</files>
  <read_first>
    - src/pages/AuditPage.tsx (lines 11-85 — types and formatters being moved; lines 87-145 — state shape and selector logic being extracted)
    - .planning/phases/19-auditpage-state-machine-refactor/19-RESEARCH.md §"Reducer Test Spec" and §"Pattern: Reducer-with-epoch stale guard"
    - .planning/phases/19-auditpage-state-machine-refactor/19-CONTEXT.md §"Reducer Shape" (D-03, D-04, D-05) and §"Behavior Preservation" (D-11)
  </read_first>
  <behavior>
    `auditPageState.ts` exports (per <reducer_semantics> in plan context):
    - Types: `ServerAuditEntry`, `AuditFilters`, `AuditState`, `AuditAction`
    - Constants: `initialFilters`, `initialState` (note: `initialState.loading === true`)
    - `auditReducer(state, action)` implementing the 5 action semantics with epoch stale-guard
    - `selectDistinctUsers(entries)` — `Array.from(new Set(entries.map(e => e.user).filter(Boolean))).sort()` (verbatim from AuditPage.tsx line 109)
    - `selectFilteredEntries(entries)` — `entries.filter(isRelevantEntry).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())` (verbatim from AuditPage.tsx lines 142-144). NOTE: imports `isRelevantEntry` from `./auditFormatters`.

    `auditFormatters.ts` exports (verbatim move per D-11):
    - `type TranslationFn = (key: TranslationKey) => string;` (from AuditPage.tsx line 27 — make it `export`)
    - `export function describeAction(method, path, t)` — copy lines 29-54 of AuditPage.tsx VERBATIM (every if-branch, every i18n key, including the `audit_action_unknown` default)
    - `export function describeDetail(method, path, user, t)` — copy lines 56-64 VERBATIM
    - `export function isRelevantEntry(entry)` — copy lines 67-77 VERBATIM
    - `export function statusBadgeClass(status)` — copy lines 79-85 VERBATIM (every Tailwind class string with dark variants byte-identical)

    `ServerAuditEntry` lives in `auditPageState.ts`; `auditFormatters.ts` imports the type from there. No circular dep (state file does NOT import formatters at type level — selectFilteredEntries imports `isRelevantEntry` as a value at runtime, which is fine).
  </behavior>
  <action>
    Create directory and files:
    1. `mkdir -p src/pages/audit`
    2. Write `src/pages/audit/auditPageState.ts` with types, initialState, auditReducer, selectDistinctUsers, selectFilteredEntries per <reducer_semantics> and the behavior block above. Reducer body:
       ```ts
       export function auditReducer(state: AuditState, action: AuditAction): AuditState {
         switch (action.type) {
           case 'FILTER_SET':
             return { ...state, filters: { ...state.filters, [action.key]: action.value } };
           case 'FILTERS_RESET':
             return { ...state, filters: initialFilters };
           case 'FETCH_START':
             return { ...state, loading: true, error: null, requestEpoch: action.epoch };
           case 'FETCH_SUCCESS':
             if (action.epoch !== state.requestEpoch) return state;
             return { ...state, loading: false, error: null, entries: action.entries, total: action.total };
           case 'FETCH_ERROR':
             if (action.epoch !== state.requestEpoch) return state;
             return { ...state, loading: false, error: action.error };
           default:
             return state;
         }
       }
       ```
    3. Write `src/pages/audit/auditFormatters.ts` with verbatim copies of describeAction/describeDetail/isRelevantEntry/statusBadgeClass from AuditPage.tsx lines 21-85. Add `import type { ServerAuditEntry } from './auditPageState';` and `import type { TranslationKey } from '../../i18n/translations';` at top.
    4. Do NOT touch `src/pages/AuditPage.tsx` yet (Task 3 will).
    5. Run `npm run build` — must succeed (catches type errors in the new files in isolation; AuditPage.tsx still uses its own inline copies, which is fine since the new modules are not yet imported).

    Forbidden in this task:
    - Adding any new dependency
    - Editing the formatters' bodies (single-quote vs double-quote, whitespace, even trailing semicolons must match)
    - Memoizing inside selectors (caller wraps with useMemo)
  </action>
  <verify>
    <automated>npm run build</automated>
  </verify>
  <acceptance_criteria>
    - Files exist: `test -f src/pages/audit/auditPageState.ts && test -f src/pages/audit/auditFormatters.ts` returns 0
    - All 5 reducer action types declared: `grep -c "type: 'FILTER_SET'\|type: 'FILTERS_RESET'\|type: 'FETCH_START'\|type: 'FETCH_SUCCESS'\|type: 'FETCH_ERROR'" src/pages/audit/auditPageState.ts` returns ≥ 5
    - Epoch stale-guard present: `grep -c "action.epoch !== state.requestEpoch" src/pages/audit/auditPageState.ts` returns ≥ 2 (FETCH_SUCCESS + FETCH_ERROR)
    - initialState.loading is true: `grep -E "loading:\s*true" src/pages/audit/auditPageState.ts` returns 1+ match
    - All 4 formatters exported: `grep -cE "^export function (describeAction|describeDetail|isRelevantEntry|statusBadgeClass)" src/pages/audit/auditFormatters.ts` returns 4
    - Formatter byte-identity: `diff <(sed -n '29,85p' src/pages/AuditPage.tsx | grep -v '^//' | grep -v '^$') <(grep -A 200 'export function describeAction' src/pages/audit/auditFormatters.ts | grep -v '^//' | grep -v '^$' | head -n 60)` shows only the `export ` keyword diff per function (manual inspection acceptable; the key check is the build passes)
    - No new deps: `git diff package.json package-lock.json` shows no changes (or only unrelated lockfile churn)
    - Build succeeds: `npm run build` returns exit code 0
  </acceptance_criteria>
  <done>Both new files exist, compile, export the documented surface. Formatters are verbatim copies. AuditPage.tsx unchanged.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Write tests/auditPageReducer.test.ts (5 actions + epoch guard + selectors + formatter byte-identity)</name>
  <files>tests/auditPageReducer.test.ts</files>
  <read_first>
    - src/pages/audit/auditPageState.ts (just created in Task 1)
    - src/pages/audit/auditFormatters.ts (just created in Task 1)
    - src/pages/AuditPage.tsx (lines 21-85 — the source-of-truth formatter outputs to assert against)
    - .planning/phases/19-auditpage-state-machine-refactor/19-RESEARCH.md §"Reducer Test Spec" (10-row coverage matrix T1-T10)
  </read_first>
  <behavior>
    Pure unit test (no jsdom — omit `@vitest-environment jsdom` directive; this is a Node-env test). File header docblock notes "Phase 19 / AUDIT-04: reducer + selectors + formatters spec".

    Test groups (use these EXACT `describe`/`it` titles to match 19-VALIDATION.md `-t` filters):

    `describe('auditReducer')`:
    - `it('FILTER_SET sets a single filter and preserves others')` — dispatch FILTER_SET key='category' value='auth' on initialState; assert `result.filters.category === 'auth'` and `result.filters.user === ''` (and other 4 filters at defaults). Assert `result.filters !== initialState.filters` (new object reference — R-02).
    - `it('FILTER_SET on boolean key flips failuresOnly')` — dispatch FILTER_SET key='failuresOnly' value=true; assert `result.filters.failuresOnly === true`.
    - `it('FILTERS_RESET restores initialFilters and preserves entries/total/loading')` — start from a state with some filters mutated AND `entries: [...someData], total: 5, loading: false`; dispatch FILTERS_RESET; assert `result.filters` deep-equals `initialFilters` AND `result.entries === priorEntries` AND `result.total === 5` AND `result.loading === false`.
    - `it('FETCH_START sets loading=true, error=null, increments requestEpoch')` — dispatch FETCH_START with epoch=1 on initialState (where requestEpoch=0); assert `result.loading === true`, `result.error === null`, `result.requestEpoch === 1`.
    - `it('FETCH_SUCCESS with matching epoch updates entries/total and clears loading')` — set up state with requestEpoch=1, loading=true; dispatch FETCH_SUCCESS with epoch=1, entries=[<one entry>], total=10; assert `result.loading === false`, `result.entries.length === 1`, `result.total === 10`, `result.error === null`.
    - `it('FETCH_SUCCESS with stale epoch is a no-op')` — set up state with requestEpoch=2; dispatch FETCH_SUCCESS with epoch=1 (stale), entries=[<one>], total=99; assert `result === priorState` (same reference) — proves no shallow copy was made.
    - `it('FETCH_ERROR with matching epoch sets error and clears loading')` — state requestEpoch=1, loading=true; dispatch FETCH_ERROR epoch=1, error='boom'; assert `result.loading === false`, `result.error === 'boom'`. Also assert entries/total preserved from prior state.
    - `it('FETCH_ERROR with stale epoch is a no-op')` — state requestEpoch=2; dispatch FETCH_ERROR epoch=1; assert `result === priorState`.

    `describe('selectors')`:
    - `it('selectDistinctUsers dedups, sorts, and drops empty users')` — input entries with users `['bob', '', 'alice', 'bob', 'alice']`; assert output is exactly `['alice', 'bob']`.
    - `it('selectFilteredEntries hides noise GETs and sorts desc by timestamp')` — input mix: `{method:'GET', path:'/api/auth/users/me', timestamp:'2026-04-23T10:00:00Z', ...}`, `{method:'POST', path:'/api/auth/login', timestamp:'2026-04-23T09:00:00Z', ...}`, `{method:'PUT', path:'/api/settings', timestamp:'2026-04-23T11:00:00Z', ...}`. Assert output length 2 (the GET to /api/auth/users/me filtered out), output[0].path === '/api/settings' (newest first), output[1].path === '/api/auth/login'.

    `describe('describeAction')`:
    - `it('returns audit_action_login for POST /api/auth/login')` — call with t = identity; assert returns `'audit_action_login'`.
    - `it('returns audit_action_login for POST /api/auth/verify')` — same key for both per source.
    - `it('returns audit_action_create_user for POST /api/auth/users')`.
    - `it('returns audit_action_delete_user for DELETE /api/auth/users/alice')`.
    - `it('returns audit_action_update_settings for PUT /api/settings')`.
    - `it('returns audit_action_view_settings for GET /api/settings')`.
    - `it('returns audit_action_update_flag for PUT /api/data/quality-flags')`.
    - `it('returns audit_action_save_search for POST /api/data/saved-searches')`.
    - `it('returns audit_action_delete_search for DELETE /api/data/saved-searches/foo')`.
    - `it('returns audit_action_exclude_case for PUT /api/data/excluded-cases')`.
    - `it('returns audit_action_update_flag for PUT /api/data/reviewed-cases')`.
    - `it('returns audit_action_flag_error for POST /api/issues')`.
    - `it('returns audit_action_data_access for GET /api/fhir/bundles')`.
    - `it('returns audit_action_view_audit for GET /api/audit')` (and `/api/audit/export` via startsWith).
    - `it('returns audit_action_unknown for unmapped POST /api/foo')`.

    `describe('describeDetail')`:
    - `it('returns audit_detail_login with {0} replaced for POST /api/auth/login')` — call with user='alice', t = identity. The implementation does `t('audit_detail_login').replace('{0}', user)` → with identity t this returns `'audit_detail_login'.replace('{0}', 'alice')` which is the unchanged string `'audit_detail_login'` (no `{0}` substring exists in the key). To genuinely test the replacement, use `t = (k) => 'logged in as {0}'`; assert returns `'logged in as alice'`.
    - `it('returns audit_detail_login for POST /api/auth/verify')` (same path branch).
    - `it('returns audit_detail_delete_user with decoded username for DELETE /api/auth/users/alice%40example.com')` — t returns `'deleted {0}'`; assert returns `'deleted alice@example.com'` (proves `decodeURIComponent`).
    - `it('returns empty string for unknown method/path')` — POST /api/foo → ''.

    `describe('statusBadgeClass')`:
    - `it('returns red classes for status >= 500')` — call with 500; assert contains `'bg-red-100'` AND `'dark:bg-red-900/20'`.
    - `it('returns amber classes for 400-499')` — call with 404; assert contains `'bg-amber-100'`.
    - `it('returns blue classes for 300-399')` — call with 301; assert contains `'bg-blue-100'`.
    - `it('returns green classes for 200-299')` — call with 200; assert contains `'bg-green-100'`.
    - `it('returns gray classes for other statuses')` — call with 100; assert contains `'bg-gray-100'`.
  </behavior>
  <action>
    Create `tests/auditPageReducer.test.ts` implementing all `describe`/`it` blocks above. Import from the new modules: `import { auditReducer, initialState, initialFilters, selectDistinctUsers, selectFilteredEntries, type AuditState, type ServerAuditEntry } from '../src/pages/audit/auditPageState';` and `import { describeAction, describeDetail, statusBadgeClass } from '../src/pages/audit/auditFormatters';`.

    For the FETCH_SUCCESS/FETCH_ERROR stale-epoch no-op tests, use strict equality (`expect(result).toBe(priorState)`) — this verifies the reducer returns the same object reference, not just deep-equal state. This is the strongest possible no-op assertion.

    For describeAction/describeDetail tests, use `const t = (k: string) => k` for most cases; only override for the {0}-replacement assertions. Cast to `TranslationFn` if TypeScript complains: `(k: string) => k as never as TranslationFn`.

    Run `npx vitest run tests/auditPageReducer.test.ts` — every test MUST be green.
  </action>
  <verify>
    <automated>npx vitest run tests/auditPageReducer.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - File exists: `test -f tests/auditPageReducer.test.ts` returns 0
    - File is a node-env test (no jsdom directive): `! head -n 1 tests/auditPageReducer.test.ts | grep -q '@vitest-environment jsdom'`
    - All 5 reducer actions covered: `grep -cE "FILTER_SET|FILTERS_RESET|FETCH_START|FETCH_SUCCESS|FETCH_ERROR" tests/auditPageReducer.test.ts` returns ≥ 8 (each appears in setup + assertion)
    - Both stale-epoch no-op tests present: `grep -c "stale epoch is a no-op" tests/auditPageReducer.test.ts` returns 2 (FETCH_SUCCESS and FETCH_ERROR)
    - Strict-equality for no-op: `grep -c "toBe(priorState)\|toBe(staleState)" tests/auditPageReducer.test.ts` returns ≥ 2
    - Selector tests present: `grep -cE "selectDistinctUsers|selectFilteredEntries" tests/auditPageReducer.test.ts` returns ≥ 4 (import + 2 it-blocks + assertions)
    - All 13 describeAction branches covered: `grep -c "audit_action_" tests/auditPageReducer.test.ts` returns ≥ 13
    - statusBadgeClass test for all 5 ranges: `grep -cE "bg-red-100|bg-amber-100|bg-blue-100|bg-green-100|bg-gray-100" tests/auditPageReducer.test.ts` returns ≥ 5
    - Test command exits 0: `npx vitest run tests/auditPageReducer.test.ts` returns exit code 0 with all tests green
  </acceptance_criteria>
  <done>Reducer test file is comprehensive and green. All 5 actions exercised, both epoch-guard branches covered with strict-equality no-op assertion, all 13 describeAction branches + describeDetail + statusBadgeClass + selectors covered.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Create useAuditData.ts hook and slim AuditPage.tsx to render-only</name>
  <files>src/pages/audit/useAuditData.ts, src/pages/AuditPage.tsx</files>
  <read_first>
    - src/pages/AuditPage.tsx (entire file — being heavily edited; lines 87-145 contain the state and useEffect being relocated)
    - src/pages/audit/auditPageState.ts (just created — types and reducer this hook consumes)
    - src/pages/audit/auditFormatters.ts (just created — render-layer imports from here)
    - tests/auditPageCharacterization.test.tsx (the regression spec — reading this clarifies which DOM strings/behaviors must NOT change)
    - .planning/phases/19-auditpage-state-machine-refactor/19-RESEARCH.md §"Pattern: Hook owns fetch + cancellation" and §"Risk Register" R-02, R-05, R-06, R-07
  </read_first>
  <behavior>
    Create `src/pages/audit/useAuditData.ts` implementing the hook per <hook_semantics> in plan context. Imports: `useReducer, useRef, useState, useEffect, useCallback` from React; `auditReducer, initialState, type AuditState, type AuditAction, type ServerAuditEntry` from `./auditPageState`; `authFetch` from `../../services/authHeaders`. Returns `{ state, dispatch, refetch }`.

    Slim `src/pages/AuditPage.tsx` per <page_render_contract> in plan context:
    - REMOVE: inline `ServerAuditEntry` type (now imported from `./audit/auditPageState`); the 4 formatter functions (now imported from `./audit/auditFormatters`); all 10 `useState` calls; the entire `useEffect` block (lines 114-138); the `distinctUsers` and `filteredEntries` `useMemo` calls (replaced with selector calls).
    - REMOVE: stale comment "5 controls per UI-SPEC D-01..D-04" (line 96 of original).
    - KEEP VERBATIM: every JSX element, every Tailwind class string, every i18n key, every conditional render branch, both `user?.role === 'admin'` checks (DO NOT consolidate — R-07), `handleExportCsv` and `handleExportJson` bodies (`handleExportJson` continues to use `authFetch` directly for the one-shot export — that's allowed; only the LIST fetch moves to the hook).
    - REPLACE: each `setFilterX(value)` onChange handler with `dispatch({ type: 'FILTER_SET', key: 'X', value })`. Map old state name → new key:
      - `setFilterUser(v)` → `dispatch({ type: 'FILTER_SET', key: 'user', value: v })`
      - `setFilterCategory(v)` → `dispatch({ type: 'FILTER_SET', key: 'category', value: v })`
      - `setFilterFrom(v)` → `dispatch({ type: 'FILTER_SET', key: 'fromDate', value: v })`
      - `setFilterTo(v)` → `dispatch({ type: 'FILTER_SET', key: 'toDate', value: v })`
      - `setFilterSearch(v)` → `dispatch({ type: 'FILTER_SET', key: 'search', value: v })`
      - `setFilterFailures(v)` → `dispatch({ type: 'FILTER_SET', key: 'failuresOnly', value: v })`
    - REPLACE: state reads `filterUser` → `filters.user`, `filterCategory` → `filters.category`, `filterFrom` → `filters.fromDate`, `filterTo` → `filters.toDate`, `filterSearch` → `filters.search`, `filterFailures` → `filters.failuresOnly` (where `filters = state.filters`).
    - REPLACE: `entries`, `total`, `loading`, `error` are now `state.entries`, `state.total`, `state.loading`, `state.error`. Destructure at top of body for readability: `const { state, dispatch } = useAuditData(); const { entries, total, loading, error, filters } = state;`.
    - REPLACE: `distinctUsers = useMemo(...)` → `distinctUsers = useMemo(() => selectDistinctUsers(entries), [entries])`. Same for `filteredEntries`.

    Critical: The DOM output must be byte-identical to v1.7. The characterization tests in tests/auditPageCharacterization.test.tsx are the regression check — they MUST pass after this task with ZERO edits to the test file.
  </behavior>
  <action>
    1. Write `src/pages/audit/useAuditData.ts` implementing the hook per <hook_semantics>. Effect dep is `[state.filters, refetchTick]`. Cleanup calls `ctrl.abort()` THEN `clearTimeout(timer)`. AbortController signal passed to authFetch as `{ signal: ctrl.signal }`. On `ctrl.signal.aborted` in catch → return without dispatching (the reducer epoch guard handles late-arriving non-aborted errors). Add a brief comment explaining the dual-cancel mechanism (per R-05).

    2. Edit `src/pages/AuditPage.tsx` per <page_render_contract>. Resulting file should be roughly 180-220 LOC (down from 337). New top-of-file imports:
       ```ts
       import { Download, FileText } from 'lucide-react';
       import { useMemo } from 'react';
       import { useAuth } from '../context/AuthContext';
       import { useLanguage } from '../context/LanguageContext';
       import { authFetch } from '../services/authHeaders';
       import { getDateLocale } from '../utils/dateFormat';
       import { datedFilename, downloadBlob, downloadCsv } from '../utils/download';
       import { useAuditData } from './audit/useAuditData';
       import { describeAction, describeDetail, statusBadgeClass } from './audit/auditFormatters';
       import { selectDistinctUsers, selectFilteredEntries } from './audit/auditPageState';
       ```
       Note: `authFetch` import REMAINS (used by `handleExportJson`). `useEffect` and `useState` imports are GONE.

    3. Run BOTH test files to confirm no regression:
       - `npx vitest run tests/auditPageReducer.test.ts` — green (Task 2)
       - `npx vitest run tests/auditPageCharacterization.test.tsx` — green with ZERO edits to the test file (this is the byte-identity proof)

    4. Run `npm run build` and `npm run lint` — both green.

    5. Run full suite: `npm test` — green.

    Forbidden in this task:
    - Editing `tests/auditPageCharacterization.test.tsx` to make it pass (the test is the spec; if it fails, the refactor is wrong)
    - Adding `useDebounce` or any other utility hook
    - Consolidating the two `user?.role === 'admin'` checks into a shared `isAdmin` const (R-07 — defer)
    - Adding new i18n keys, settings.yaml keys, or npm dependencies (D-12)
    - Changing `ServerAuditEntry.id: number` to `string` (R-01 — pre-existing type lie, out of scope)
  </action>
  <verify>
    <automated>npx vitest run tests/auditPageCharacterization.test.tsx tests/auditPageReducer.test.ts && npm run build && npm run lint</automated>
  </verify>
  <acceptance_criteria>
    - Hook file exists: `test -f src/pages/audit/useAuditData.ts` returns 0
    - Hook returns documented surface: `grep -c "return { state, dispatch, refetch" src/pages/audit/useAuditData.ts` returns ≥ 1
    - Hook owns AbortController: `grep -c "new AbortController" src/pages/audit/useAuditData.ts` returns 1
    - Hook owns 300 ms debounce: `grep -E "setTimeout\\(.*300\\)" src/pages/audit/useAuditData.ts` returns 1
    - Cleanup calls both: `grep -c "ctrl.abort()" src/pages/audit/useAuditData.ts` ≥ 1 AND `grep -c "clearTimeout" src/pages/audit/useAuditData.ts` ≥ 1
    - Effect dep includes state.filters: `grep -E "\\[state\\.filters" src/pages/audit/useAuditData.ts` returns ≥ 1
    - Error string preserved byte-identical: `grep -c "Server returned \\${res.status}\\|Failed to load audit log" src/pages/audit/useAuditData.ts` returns 2
    - AuditPage is render-only — no useState: `! grep -E "\\buseState\\b" src/pages/AuditPage.tsx`
    - AuditPage has no useEffect: `! grep -E "\\buseEffect\\b" src/pages/AuditPage.tsx`
    - AuditPage no longer fires the LIST authFetch (only export-JSON authFetch remains): `grep -c "authFetch" src/pages/AuditPage.tsx` returns 1 (the one in handleExportJson)
    - AuditPage no longer contains setTimeout: `! grep "setTimeout" src/pages/AuditPage.tsx`
    - AuditPage imports the new modules: `grep -c "from './audit/useAuditData'" src/pages/AuditPage.tsx` returns 1; `grep -c "from './audit/auditFormatters'" src/pages/AuditPage.tsx` returns 1; `grep -c "from './audit/auditPageState'" src/pages/AuditPage.tsx` returns 1
    - Inline ServerAuditEntry interface removed from AuditPage.tsx: `! grep -E "^interface ServerAuditEntry" src/pages/AuditPage.tsx`
    - Inline formatters removed from AuditPage.tsx: `! grep -E "^function (describeAction|describeDetail|isRelevantEntry|statusBadgeClass)" src/pages/AuditPage.tsx`
    - Stale "5 controls" comment removed: `! grep "5 controls per UI-SPEC" src/pages/AuditPage.tsx`
    - No new dependencies: `git diff package.json | grep -E "^\\+.*\".*\":\\s*\".*\"" | grep -vE "^\\+\\+\\+|^\\+$"` returns empty (no new dep lines added)
    - No settings.yaml changes: `git diff settings.yaml 2>/dev/null` returns empty
    - No i18n changes: `git diff src/i18n/translations.ts 2>/dev/null` returns empty
    - Characterization tests STILL green with zero edits: `git diff tests/auditPageCharacterization.test.tsx` returns empty AND `npx vitest run tests/auditPageCharacterization.test.tsx` exits 0
    - Full quality gate: `npm test && npm run build && npm run lint` all exit 0
  </acceptance_criteria>
  <done>Hook is created, AuditPage is slimmed to render-only, both reducer and characterization tests are green, full build and lint pass, no new deps. The two-commit ordering (Plan 01 test commit → Plan 02 refactor commit) is preserved by execute-plan committing each plan separately.</done>
</task>

</tasks>

<threat_model>
No new threat surface — pure frontend refactor of an existing admin-gated read-only page; preserves all v1.7 auth gates verbatim. AUDIT immutability and admin-gating are inherited from unchanged backend and AuthContext. No new APIs, no new auth code, no new data flow, no new dependencies. The two `user?.role === 'admin'` UI checks are moved verbatim with no consolidation; server-side admin enforcement on `/api/audit*` and `/api/audit/export` is unchanged.
</threat_model>

<verification>
- `npx vitest run tests/auditPageReducer.test.ts` — green
- `npx vitest run tests/auditPageCharacterization.test.tsx` — green with ZERO edits to the test file (regression proof)
- `npm test` — full suite green
- `npm run build` — green (typecheck passes)
- `npm run lint` — green
- `git diff --stat src/pages/AuditPage.tsx` — net negative LOC (~337 → ~180-220)
- `find src/pages/audit -type f` — exactly 3 files: auditPageState.ts, auditFormatters.ts, useAuditData.ts
- `git diff package.json package-lock.json` — no dep changes
- `git log --oneline -- tests/auditPageCharacterization.test.tsx src/pages/AuditPage.tsx` — characterization commit hash strictly precedes refactor commit hash on this branch
</verification>

<success_criteria>
- Three new modules exist at exact paths from CONTEXT D-01: `src/pages/audit/auditPageState.ts`, `auditFormatters.ts`, `useAuditData.ts`
- `src/pages/AuditPage.tsx` is render-only (no useState, no useEffect, only the export-JSON authFetch remains)
- Reducer has exactly 5 discriminated-union actions per D-03; epoch stale-guard works for FETCH_SUCCESS and FETCH_ERROR per D-05
- Formatters moved verbatim per D-11
- Hook owns 300 ms debounce + AbortController per D-07; cleanup calls both
- `tests/auditPageReducer.test.ts` covers 5 actions + epoch guard + selectors + all describeAction branches + describeDetail + statusBadgeClass
- `tests/auditPageCharacterization.test.tsx` remains green with zero edits — proves byte-identical v1.7 behavior
- No new deps, no settings.yaml keys, no i18n changes per D-12
- Bisect-friendly commit ordering preserved: Plan 01's test commit → Plan 02's refactor commit
</success_criteria>

<output>
After completion, create `.planning/phases/19-auditpage-state-machine-refactor/19-02-SUMMARY.md` documenting:
- Final LOC of AuditPage.tsx (before/after)
- Final LOC and exported surface of each new module
- Reducer test count and per-action assertion summary
- Confirmation: characterization test file unchanged (`git diff tests/auditPageCharacterization.test.tsx` empty)
- Confirmation: no new dependencies
- Commit hash for `refactor(19): migrate AuditPage to useReducer state machine` and the preceding characterization commit hash from Plan 01
- Any deviations from plan (e.g., if `refetch` had to be wired into the page after all) and why
- Notes for Phase 20 SESSION-13: location of `describeAction` (`src/pages/audit/auditFormatters.ts`) for the upcoming refresh/logout key extension
</output>
