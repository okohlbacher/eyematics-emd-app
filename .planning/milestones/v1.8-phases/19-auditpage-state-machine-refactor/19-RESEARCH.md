# Phase 19: AuditPage State Machine Refactor — Research

**Researched:** 2026-04-23
**Domain:** React 19 useReducer refactor + characterization tests for `src/pages/AuditPage.tsx`
**Confidence:** HIGH

## Summary

Phase 19 is a pure-frontend, single-file refactor: split the existing 337-LOC `src/pages/AuditPage.tsx` (10 `useState` + a debounced `useEffect` fetch + 2 `useMemo` derivations) into a `useReducer`-driven state machine with three new sibling modules and pure unit tests. The architecture is fully locked in `19-CONTEXT.md`; this research surfaces the **concrete current-state map** so the planner can produce two bisect-friendly commits (characterization tests, then refactor) without behavior drift.

Key facts uncovered that the planner MUST internalize:

1. **There is no `src/types/audit.ts`** — `ServerAuditEntry` is declared *inline* at `AuditPage.tsx` lines 11–19 and is the ONLY consumer. There is **no `AuditFilters` type** today; filters are 6 sibling `useState` calls. Phase 19 must DEFINE `AuditFilters` for the first time (in `auditPageState.ts`).
2. **There is no client-side `src/services/auditApi.ts`** — the page calls `authFetch('/api/audit?...')` and `authFetch('/api/audit/export')` directly. The CONTEXT references `auditApi.ts` as if it existed; it does not. The hook `useAuditData.ts` will call `authFetch` from `src/services/authHeaders.ts` directly (mirroring the existing pattern).
3. **There is no existing `tests/audit.test.tsx`** (RTL component test). All `tests/audit*.ts` files are **backend Vitest tests** (Node env, no jsdom). The characterization test at `tests/auditPageCharacterization.test.tsx` will be the first frontend audit test and must mirror the convention from `tests/adminCenterFilter.test.tsx` (`@vitest-environment jsdom`, `vi.mock('../src/services/authHeaders', ...)`, `vi.mock('../src/context/AuthContext', ...)`, `vi.mock('../src/context/LanguageContext', ...)`).
4. **`useCaseData.ts` does NOT own a fetch** — it is pure-derivation `useMemo`. There is **no existing hook in the codebase that owns fetch + AbortController + cleanup**; `useAuditData.ts` will set the precedent. The CONTEXT's claim "see `src/hooks/useCaseData.ts` for hook-with-fetch+cancel" is incorrect; the closest analogue is the inline `useEffect` in `AuditPage.tsx` itself (lines 114–138).
5. The current debounce/cancel mechanism uses a `setTimeout` id + a `cancelled` boolean flag captured in the cleanup closure. There is **no `AbortController` in the current code** — adding one is part of the new hook's surface (the CONTEXT's "AbortController kept as network-cancel optimization" implies adopting one for the first time in this refactor).

**Primary recommendation:** Plan two atomic commits. Commit 1 = characterization tests against the current AuditPage exactly as it is (no source edits) → must pass. Commit 2 = create `src/pages/audit/{auditPageState.ts, auditFormatters.ts, useAuditData.ts}`, define `AuditFilters` + `ServerAuditEntry` types in the new files, slim AuditPage.tsx to a render-only component, add `tests/auditPageReducer.test.ts` → both commits green, no behavior diff.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Module Layout**
- D-01: Files exactly as roadmap mandates: `src/pages/audit/auditPageState.ts`, `auditFormatters.ts`, `useAuditData.ts`. Directory is new (`src/pages/audit/` does not exist yet).
- D-02: `AuditPage.tsx` stays at `src/pages/AuditPage.tsx` (path unchanged — preserves router import) and becomes a pure render component that calls `useAuditData()` and maps state to JSX.

**Reducer Shape**
- D-03: Single discriminated-union action type with exactly 5 variants (no extras for v1.8): `FILTER_SET` (payload: `{ key: keyof AuditFilters, value: AuditFilters[K] }`), `FILTERS_RESET`, `FETCH_START` (payload: `{ epoch: number }`), `FETCH_SUCCESS` (payload: `{ epoch, entries, total }`), `FETCH_ERROR` (payload: `{ epoch, error }`).
- D-04: State shape: `{ filters: AuditFilters, entries: ServerAuditEntry[], total: number, loading: boolean, error: string | null, requestEpoch: number }`. `distinctUsers` and `filteredEntries` are **selectors** (pure functions in `auditPageState.ts`), not stored in state — matches the existing `useMemo` derivation.
- D-05: `requestEpoch` stale-response guard: every `FETCH_START` increments `requestEpoch`; `FETCH_SUCCESS` / `FETCH_ERROR` are no-ops when `payload.epoch !== state.requestEpoch`. Replaces the AbortController-only approach with deterministic, testable ordering (AbortController is still kept as a network-cancel optimization, but the reducer guard is the source of truth).

**Hook Surface**
- D-06: `useAuditData()` returns `{ state, dispatch, refetch }`. `state` is the full reducer state; `dispatch` is exposed so the page can fire `FILTER_SET` / `FILTERS_RESET` directly without a wrapper-action explosion. `refetch` is for the explicit "Reload" button if any (currently none — included only if needed by characterization tests).
- D-07: Debounce (300 ms) and AbortController live **inside the hook**, not in the page or reducer. Reducer stays pure.

**Characterization Tests (commit BEFORE refactor)**
- D-08: New file `tests/auditPageCharacterization.test.tsx` using existing RTL + `vi.mock('../src/services/auditApi')` pattern. Covers: (a) all 4 render states (loading, error, empty, populated), (b) admin-gated CSV/JSON export buttons (admin role visible, non-admin hidden), (c) filter change triggers debounced refetch, (d) unmount during in-flight fetch cancels (no state-update warning), (e) `isRelevantEntry` filtering hides health-check rows, (f) `describeAction` / `describeDetail` outputs for each known method/path pair.
- D-09: Reducer-only unit test: new file `tests/auditPageReducer.test.ts`. Covers all 5 action variants + the `requestEpoch` stale-response guard (FETCH_SUCCESS arriving with stale epoch is a no-op).
- D-10: Two commits, in order: (1) `test(19): characterization tests for AuditPage v1.7 behavior`, (2) `refactor(19): migrate AuditPage to useReducer state machine`. Bisect-friendly.

**Behavior Preservation**
- D-11: `describeAction`, `describeDetail`, `isRelevantEntry`, `statusBadgeClass` move VERBATIM (no signature change, no logic edit) from `AuditPage.tsx` to `auditFormatters.ts`. They become re-exported from the page only if any other module already imports them (none do — confirmed via grep — see Risk Register §R-04 below).
- D-12: No new dependencies. No new settings.yaml keys. No i18n string changes.

### Claude's Discretion
- Selector function names (`selectDistinctUsers`, `selectFilteredEntries`) — bikeshed-free, planner picks final names.
- Whether to colocate `tests/auditPageReducer.test.ts` with characterization or split — both fine; planner decides.
- Internal action-creator helpers (e.g., `setFilter(key, value)` thin wrappers) — only if it materially improves readability; default no.

### Deferred Ideas (OUT OF SCOPE)
- AuditPage UI redesign — out of scope for v1.8; would be a v1.9+ phase if surfaced.
- Audit row virtualization — would only matter at >5k entries; not requested. Backlog.
- Replace 300 ms debounce with a centralized hook (`useDebouncedCallback`) — only if a second consumer appears; YAGNI for now.
- Unify formatter `t` parameter into a context — would require refactoring all i18n call sites; not justified here.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (from ROADMAP.md Phase 19 success criteria) | Research Support |
|----|---------------------------------------------------------|------------------|
| AUDIT-01 | Admin sees byte-identical v1.7 behavior: 6-dim filter, 300ms debounce, cancel-on-unmount, admin-gated controls, 4 render states, CSV/JSON export | §"Current-State Map" enumerates every behavior; §"Risk Register" lists drift sources |
| AUDIT-02 | Characterization tests committed BEFORE the reducer swap (separate commit) and remain green after | §"Existing Test Patterns to Mirror" documents the RTL+vi.mock convention; §"Validation Architecture" specifies exact commands |
| AUDIT-03 | Files split: `src/pages/audit/{auditPageState.ts, auditFormatters.ts, useAuditData.ts}`; AuditPage.tsx is pure render | §"Module Layout" + §"Hook Surface" |
| AUDIT-04 | `tests/auditPageReducer.test.ts` exercises all 5 action paths + `requestEpoch` stale-guard | §"Reducer Test Spec" |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

No top-level `./CLAUDE.md` exists at the project root (only `.planning/reviews/v1.7-full-review/CLAUDE.md` from a prior review session, not a project directive). Project conventions therefore come from:

- `.planning/PROJECT.md` §"Key Decisions": **security-first** (audit immutability — do NOT touch redaction or audit storage), **config in settings.yaml only** (no env vars; phase declares no new keys per D-12), **no client trust** (admin gate stays server-enforced; UI gate is a UX nicety only — already true in current code).
- Existing test convention (observed): all RTL component tests use `// @vitest-environment jsdom` docblock at top of file; mocks declared via `vi.mock('../src/services/authHeaders', ...)` etc. before importing the SUT.

## Standard Stack (already installed — D-12 forbids new deps)

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| react | ^19.2.4 | useReducer, useEffect, useRef | `package.json` [VERIFIED] |
| react-dom | ^19.2.4 | RTL render target | `package.json` [VERIFIED] |
| react-router-dom | ^7.14.0 | (Not needed — AuditPage is leaf, no routes/links) | `package.json` [VERIFIED] |
| vitest | (devDep) | Test runner — `vitest run` is `npm test` | `package.json` `"test": "vitest run"` [VERIFIED] |
| @testing-library/react | ^16.3.2 | RTL render/screen/fireEvent/waitFor | `package.json` [VERIFIED] |

**No installs required.** Reducer is plain TS — no zustand/redux/xstate.

## Architecture Patterns

### Recommended directory layout (post-refactor)

```
src/pages/
├── AuditPage.tsx                      # ← stays here (router import unchanged)
└── audit/                             # ← NEW directory
    ├── auditPageState.ts              # types, initialState, reducer, selectors
    ├── auditFormatters.ts             # describeAction, describeDetail, isRelevantEntry, statusBadgeClass
    └── useAuditData.ts                # hook: reducer + debounced fetch + AbortController
```

### Pattern: Reducer-with-epoch stale guard

The `requestEpoch` counter is a deterministic alternative to AbortController-only race handling. Pseudocode (planner authors final code):

```ts
// auditPageState.ts — discriminated union, no enums (matches codebase style)
export type AuditFilters = {
  user: string;             // '' = all
  category: '' | 'auth' | 'data' | 'admin' | 'outcomes';
  fromDate: string;         // YYYY-MM-DD, '' = unset
  toDate: string;           // YYYY-MM-DD, '' = unset
  search: string;           // body_search, max 128 chars (server-validated)
  failuresOnly: boolean;    // status_gte=400
};

export type AuditAction =
  | { type: 'FILTER_SET'; key: keyof AuditFilters; value: AuditFilters[keyof AuditFilters] }
  | { type: 'FILTERS_RESET' }
  | { type: 'FETCH_START'; epoch: number }
  | { type: 'FETCH_SUCCESS'; epoch: number; entries: ServerAuditEntry[]; total: number }
  | { type: 'FETCH_ERROR'; epoch: number; error: string };

export interface AuditState {
  filters: AuditFilters;
  entries: ServerAuditEntry[];
  total: number;
  loading: boolean;
  error: string | null;
  requestEpoch: number;
}

// FETCH_SUCCESS / FETCH_ERROR ignore action.epoch !== state.requestEpoch (stale)
```

### Pattern: Hook owns fetch + cancellation

```ts
// useAuditData.ts — sketch
export function useAuditData() {
  const [state, dispatch] = useReducer(auditReducer, initialState);
  const epochRef = useRef(0);
  useEffect(() => {
    const epoch = ++epochRef.current;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      dispatch({ type: 'FETCH_START', epoch });
      try {
        const res = await authFetch(buildUrl(state.filters), { signal: ctrl.signal });
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json();
        dispatch({ type: 'FETCH_SUCCESS', epoch, entries: data.entries, total: data.total });
      } catch (err) {
        if (ctrl.signal.aborted) return; // network-level cancel; reducer won't act anyway
        dispatch({ type: 'FETCH_ERROR', epoch, error: err instanceof Error ? err.message : 'Failed to load audit log' });
      }
    }, 300);
    return () => { ctrl.abort(); clearTimeout(timer); };
  }, [state.filters]);
  const refetch = useCallback(() => { /* nudge by re-dispatching last filter or bumping a tick */ }, []);
  return { state, dispatch, refetch };
}
```

### Anti-patterns to avoid

- **Don't move `useAuth()` into the hook.** Admin-gated UI lives in `AuditPage.tsx` render layer (CONTEXT D-06 implies this; current code reads `user?.role === 'admin'` at lines 107 and 250).
- **Don't store `distinctUsers` or `filteredEntries` in reducer state** — they are pure functions of `entries` (D-04 explicit). Re-derive via memoized selectors at the call site.
- **Don't break the file-by-file structure** — placing the reducer inside `useAuditData.ts` would prevent reducer-only unit testing (AUDIT-04 requires a separate test file).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Generic debounce hook | Custom `useDebounce` | Inline `setTimeout`/`clearTimeout` in the effect (matches v1.7) | YAGNI per CONTEXT deferred items; only one consumer |
| State management library | redux/zustand/xstate | React `useReducer` | Phase scope is one page; CONTEXT D-12 forbids new deps |
| Custom AbortController polyfill | Anything | Native (Node 18+, all modern browsers) | Already used by `fetch`; React 19 baseline |

## Current-State Map (`src/pages/AuditPage.tsx`, 337 LOC) [VERIFIED via Read]

### Imports (lines 1–9)
- `Download`, `FileText` from `lucide-react` (icons used in CSV/JSON buttons + page header)
- `useEffect`, `useMemo`, `useState` from `react`
- `useAuth` from `../context/AuthContext` → `user?.role === 'admin'`
- `useLanguage` from `../context/LanguageContext` → `{ locale, t }`
- `TranslationKey` type from `../i18n/translations`
- `authFetch` from `../services/authHeaders` (NOT from `src/services/auditApi.ts` — that file does not exist)
- `getDateLocale` from `../utils/dateFormat`
- `datedFilename`, `downloadBlob`, `downloadCsv` from `../utils/download`

### Inline type declaration (lines 11–19) — must move
```ts
interface ServerAuditEntry {
  id: number;
  timestamp: string;
  method: string;
  path: string;
  user: string;
  status: number;
  duration_ms: number;
}
```
**Note:** server returns `id` as `number` per this declaration — but the server-side `auditDb.ts` `AuditDbRow` uses `id: string` (`crypto.randomUUID()`). This is a **pre-existing type lie**; do NOT fix it in Phase 19 (out of scope, behavior-preservation contract). Move the interface verbatim.

### Pure formatters (lines 21–85) — move VERBATIM to `auditFormatters.ts` (D-11)
- `type TranslationFn = (key: TranslationKey) => string;` (line 27)
- `describeAction(method, path, t): string` — 13 method/path branches → `audit_action_*` keys; default `audit_action_unknown` (lines 29–54)
- `describeDetail(method, path, user, t): string` — 3 branches; uses `.replace('{0}', user)` and `.replace('{0}', decodeURIComponent(username))` (lines 56–64)
- `isRelevantEntry(entry): boolean` — keeps all non-GET, plus GET on `/api/settings`, `/api/audit*`, `/api/fhir/bundles` (lines 67–77)
- `statusBadgeClass(status): string` — Tailwind class string for badges (5xx/4xx/3xx/2xx/other) with dark variants (lines 79–85)

### State (lines 87–102) — 10 useState calls → reducer
| State var | Type | Default | Reducer mapping |
|-----------|------|---------|-----------------|
| `entries` | `ServerAuditEntry[]` | `[]` | `state.entries` |
| `total` | `number` | `0` | `state.total` |
| `loading` | `boolean` | `true` (note: starts loading) | `state.loading` |
| `error` | `string \| null` | `null` | `state.error` |
| `filterUser` | `string` | `''` | `state.filters.user` |
| `filterCategory` | `'' \| 'auth' \| 'data' \| 'admin' \| 'outcomes'` | `''` | `state.filters.category` |
| `filterFrom` | `string` (YYYY-MM-DD) | `''` | `state.filters.fromDate` |
| `filterTo` | `string` (YYYY-MM-DD) | `''` | `state.filters.toDate` |
| `filterSearch` | `string` | `''` | `state.filters.search` |
| `filterFailures` | `boolean` | `false` | `state.filters.failuresOnly` |

**Initial-state contract:** `loading: true` from mount (NOT false). The first render shows the loading state until the 300 ms timer fires and the response resolves. Characterization test must assert this.

### Derived values (lines 104–111, 141–145)
- `dateFmt = getDateLocale(locale)` — recomputed every render (cheap)
- `isAdmin = user?.role === 'admin'` (line 107) — used for filter visibility AND CSV button gating; NOTE: line 250 re-checks `user?.role === 'admin'` independently (do NOT consolidate to `isAdmin` in this phase — verbatim move).
- `distinctUsers = useMemo(() => Array.from(new Set(entries.map(e => e.user).filter(Boolean))).sort(), [entries])` — selector
- `filteredEntries = useMemo(() => entries.filter(isRelevantEntry).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()), [entries])` — selector

### Fetch effect (lines 114–138) — moves into `useAuditData.ts`
```ts
useEffect(() => {
  let cancelled = false;
  const timer = setTimeout(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: '500', offset: '0' });
    if (filterUser) params.set('user', filterUser);
    if (filterCategory) params.set('action_category', filterCategory);
    if (filterFrom) params.set('fromTime', filterFrom);
    if (filterTo) params.set('toTime', `${filterTo}T23:59:59`);  // ← end-of-day suffix
    if (filterSearch) params.set('body_search', filterSearch);
    if (filterFailures) params.set('status_gte', '400');
    try {
      const res = await authFetch(`/api/audit?${params.toString()}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json() as { entries: ServerAuditEntry[]; total: number };
      if (!cancelled) { setEntries(data.entries); setTotal(data.total); }
    } catch (err) {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      if (!cancelled) setLoading(false);
    }
  }, 300);
  return () => { cancelled = true; clearTimeout(timer); };
}, [filterUser, filterCategory, filterFrom, filterTo, filterSearch, filterFailures]);
```

**Behavior contracts to preserve in the hook:**
- 300 ms debounce
- `cancelled` flag prevents post-unmount state updates (port to `requestEpoch` guard)
- `limit=500&offset=0` hard-coded (no pagination UI)
- `toTime` gets `T23:59:59` suffix appended (end-of-day inclusive)
- `failuresOnly: true` → `status_gte=400`
- Error message format: `Server returned ${res.status}` for non-OK; `'Failed to load audit log'` fallback for non-Error throws
- Status reset between fetches: `setLoading(true)` + `setError(null)` happen inside the timer callback, not synchronously on filter change

### Event handlers (lines 147–171) — stay in AuditPage.tsx render layer
- `handleExportCsv` — builds rows from `filteredEntries` using `describeAction`/`describeDetail`/locale-aware date format; calls `downloadCsv(headers, rows, datedFilename('audit-log', 'csv'))`. Headers: `[t('auditTime'), t('auditUser'), t('auditAction'), t('auditDetail'), t('auditStatus')]`. NOT admin-gated (CSV is shown to all logged-in users).
- `handleExportJson` — admin-only (button hidden for non-admin at line 250); calls `authFetch('/api/audit/export')`; on non-OK logs `'[AuditPage] Export failed:'` + status; on network error logs `'[AuditPage] Export network error:'`. **Silent failure** (no UI feedback) — do NOT add toast in this phase.

### Render structure (lines 173–337)

**The 4 render states (per CONTEXT AUDIT-01):** they are visually exclusive but NOT modeled as a single discriminated union in the current code — they emerge from independent `loading`/`error`/`filteredEntries.length` checks. Characterization checklist:

| # | Name | Trigger condition | DOM marker |
|---|------|-------------------|------------|
| 1 | **Loading** | `loading === true` | `<div>...Loading audit log…</div>` (line 263–267) |
| 2 | **Error** | `!loading && error` | red-bordered card with `{error}` (line 269–273) |
| 3 | **Empty** | `!loading && !error && filteredEntries.length === 0` | `<div>{t('auditEmptyFiltered')}</div>` (line 278–279) |
| 4 | **Populated** | `!loading && !error && filteredEntries.length > 0` | `<table>` with rows (line 281–331) |

**Note:** filter panel + controls row + export buttons render **always** (even during loading/error). The 4 states are inside the result panel ONLY.

**Filter panel controls (lines 184–229):**
- User dropdown — `isAdmin` only (line 185)
- Category select — always visible (lines 195–205)
- From date input — always visible (lines 206–210)
- To date input — always visible (lines 211–215)
- Search input — `isAdmin` only (lines 216–224); maxLength=128
- Failures-only checkbox — always visible (lines 225–228)

**That's 6 controls, not 5** as the v1.7 17-04 plan said ("5-control"). The 6th was the search input added in v1.7. The "6-dim filter" terminology in CONTEXT/ROADMAP refers to: user, category, fromDate, toDate, search, failuresOnly = 6 dimensions. **Use "6-dim" everywhere; the comment at line 96 ("5 controls per UI-SPEC D-01..D-04") is stale and should NOT be carried into the new files.**

**Controls row (lines 232–260):**
- Entry count: `${filteredEntries.length === total ? total : filteredEntries.length + ' ' + t('auditFilteredOf') + ' ' + total}`
- CSV button: visible always; `disabled={filteredEntries.length === 0}`
- JSON button: visible **only** when `user?.role === 'admin'` (line 250)

**Table headers (lines 285–299):** `auditTime`, `auditUser`, `auditAction`, `auditDetail`, `auditStatus` (5 columns).

**Row rendering (lines 303–328):** `key={entry.id}` (numeric per the inline type), columns mirror headers; status badge uses `statusBadgeClass(entry.status)`.

## ServerAuditEntry / AuditFilters Shapes (canonical)

### `ServerAuditEntry` (move verbatim from AuditPage.tsx → auditFormatters.ts or auditPageState.ts; planner picks)
```ts
interface ServerAuditEntry {
  id: number;        // see Risk R-01: server returns string; pre-existing lie
  timestamp: string; // ISO 8601
  method: string;    // 'GET'|'POST'|'PUT'|'DELETE'|'PATCH'
  path: string;
  user: string;
  status: number;
  duration_ms: number;
}
```

### `AuditFilters` (NEW — does not exist today)
```ts
interface AuditFilters {
  user: string;                                              // server param: user
  category: '' | 'auth' | 'data' | 'admin' | 'outcomes';    // server param: action_category
  fromDate: string;                                          // YYYY-MM-DD; server param: fromTime
  toDate: string;                                            // YYYY-MM-DD; server param: toTime (with T23:59:59 suffix)
  search: string;                                            // server param: body_search; admin-only; maxLength 128
  failuresOnly: boolean;                                     // when true, server param: status_gte=400
}

export const initialFilters: AuditFilters = {
  user: '', category: '', fromDate: '', toDate: '', search: '', failuresOnly: false,
};
```

**Server contract reference:** validation rules verified against `tests/auditApi.test.ts` Phase 17 H6 block (lines 291–373):
- `body_search` admin-only (403 for non-admin) → admin gate at UI layer is correct
- `body_search` max 128 chars → matches `maxLength={128}` at AuditPage line 221
- `body_search` rejects `%` and `_` (LIKE wildcards) → server-enforced; UI does not pre-sanitize
- `fromTime` / `toTime` must be ISO 8601 (date-only or with timezone)
- `status_gte` ignored if outside [100,599]

## Existing Test Patterns to Mirror

**Reference test for RTL+jsdom convention:** `tests/adminCenterFilter.test.tsx` (read lines 1–80).

```ts
// @vitest-environment jsdom
/**
 * Phase 19 / AUDIT-02: Characterization tests …
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../src/services/authHeaders', () => ({
  authFetch: vi.fn(),
  getAuthHeaders: vi.fn(() => ({})),
}));
vi.mock('../src/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));
vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: vi.fn(),
}));

import AuditPage from '../src/pages/AuditPage';
import { authFetch } from '../src/services/authHeaders';
import { useAuth } from '../src/context/AuthContext';
import { useLanguage } from '../src/context/LanguageContext';

beforeEach(() => {
  vi.mocked(useLanguage).mockReturnValue({ locale: 'en', t: (k: string) => k });
  vi.mocked(useAuth).mockReturnValue({ user: { username: 'admin', role: 'admin' } } as never);
  vi.mocked(authFetch).mockResolvedValue(new Response(
    JSON.stringify({ entries: [...], total: N }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  ));
});

afterEach(() => { cleanup(); vi.clearAllMocks(); });
```

**Critical RTL gotcha:** because the fetch fires inside a `setTimeout(…, 300)`, tests must use `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync(300)` OR `await waitFor(...)` with extended timeout. Pattern from `tests/adminCenterFilter.test.tsx` uses real timers + `waitFor`; that is acceptable here too.

**Backend test files** (`tests/audit.test.ts`, `tests/auditApi.test.ts`, `tests/auditMiddleware.test.ts`) are NOT a template — they are Node-env Vitest tests against `server/*` modules. They are listed in CONTEXT for "convention awareness" only.

## Reducer Test Spec (`tests/auditPageReducer.test.ts`, AUDIT-04)

Pure unit test (no jsdom needed — omit the `@vitest-environment jsdom` docblock). Coverage matrix:

| # | Action | Pre-state condition | Assertion |
|---|--------|---------------------|-----------|
| T1 | `FILTER_SET` | initial state | `state.filters[key] === value`, other filters unchanged |
| T2 | `FILTER_SET` (boolean) | filters with failuresOnly=false | dispatching with key='failuresOnly', value=true flips it |
| T3 | `FILTERS_RESET` | filters mutated by several FILTER_SET | state.filters deep-equals `initialFilters`; entries/total/loading untouched |
| T4 | `FETCH_START` | initial state | `loading=true`, `error=null`, `requestEpoch` incremented to `payload.epoch` |
| T5 | `FETCH_SUCCESS` (matching epoch) | after FETCH_START with epoch=1 | `loading=false`, `entries=payload.entries`, `total=payload.total`, `error=null` |
| T6 | `FETCH_SUCCESS` (stale epoch) | after FETCH_START with epoch=2, then payload.epoch=1 | **No-op:** state reference identity preserved or all fields unchanged from prior |
| T7 | `FETCH_ERROR` (matching epoch) | after FETCH_START with epoch=1 | `loading=false`, `error=payload.error`, entries/total preserved |
| T8 | `FETCH_ERROR` (stale epoch) | after newer FETCH_START | No-op |
| T9 | Selector `selectDistinctUsers` | entries with duplicate + empty users | dedup'd, sorted, no empty strings |
| T10 | Selector `selectFilteredEntries` | mix of relevant/noise entries | only `isRelevantEntry===true` rows; sorted desc by timestamp |

## Risk Register (drift sources)

| ID | Risk | Mitigation |
|----|------|-----------|
| R-01 | `ServerAuditEntry.id` typed as `number` but server emits `string` (`crypto.randomUUID`). Refactor temptation: "fix" to `string`. | **Do not fix.** Out of scope; preserves byte-identical contract. Document in commit message if noticed. |
| R-02 | Closure-over-stale-state: current effect captures `filterUser` etc. via deps array. Refactoring to `useReducer` changes the dep to `state.filters` (single object) — must verify object reference changes on every FILTER_SET (it does; reducer returns new object) so the effect re-fires. | Reducer must spread `{ ...state.filters, [action.key]: action.value }` (new ref). Test: characterization test "filter change triggers refetch" catches this. |
| R-03 | Double-fetch on mount: React 18+ StrictMode fires effects twice in dev. Current code handles via `cancelled` flag; new hook handles via AbortController + epoch guard. Verify no duplicate `setLoading` flicker in dev. | Characterization test runs without StrictMode (RTL default), so won't catch this. Add an in-hook comment noting StrictMode behavior. |
| R-04 | `describeAction` is referenced by Phase 20 (SESSION-13 extends it for refresh/logout). The CONTEXT explicitly notes Phase 19 must relocate cleanly so Phase 20 can extend. | Export `describeAction` as a named export from `auditFormatters.ts`. Confirmed via grep: 0 external importers today, so no other-file change needed. |
| R-05 | Race between debounce timer and unmount during in-flight fetch (CONTEXT D-08e). Current code: `cancelled=true` prevents setState; new code: `ctrl.abort()` + epoch guard. Both layers needed because abort only cancels the network read, not in-flight `await res.json()` parse. | Hook cleanup MUST call BOTH `clearTimeout(timer)` AND `ctrl.abort()`. Reducer's epoch guard is the safety net. |
| R-06 | The `loading: true` initial state is load-bearing (avoids an "empty" flash before first fetch). Tempting to set initial `loading: false`. | Keep `loading: true` in `initialState`. Add a comment. Characterization test: "first render shows loading state". |
| R-07 | The two independent `user?.role === 'admin'` checks (lines 107 + 250) — refactoring to share an `isAdmin` const would be a behavior-equivalent edit, BUT touching it inflates the refactor diff. | Move VERBATIM. Defer cleanup. |
| R-08 | i18n key `auditTime`, `auditUser`, etc. used in `handleExportCsv` headers — the formatter file does NOT receive these; they stay in the page. Don't accidentally move CSV header construction into `auditFormatters.ts`. | Page owns CSV/JSON handlers; formatters are pure pieces called by both render and export. |
| R-09 | `tests/auditPageCharacterization.test.tsx` will mount a real `AuditPage` that imports `lucide-react` icons — these must render without error in jsdom. (No prior frontend test imports AuditPage, so this is unverified.) | First test of phase: smoke-render and assert page header is in DOM. If it fails, investigate before writing more tests. |
| R-10 | `useLanguage().t` is called for `TranslationKey` typed keys — characterization test stub `t: (k: string) => k` returns the raw key. Assertions on translated strings will check the i18n keys, not English/German text. | Document this in test file header. Acceptable because all CONTEXT requirements are about behavior/structure, not localized text. |

## Runtime State Inventory

Phase 19 is a pure-frontend refactor of one file — no databases, no OS-registered state, no secrets, no env vars touched.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — audit DB schema unchanged | None |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | TS-only changes; Vite/tsc rebuild on next `npm run build` | None — automatic |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node + npm | `npm test` | ✓ | (project default) | — |
| vitest | reducer + characterization tests | ✓ | from `package.json` devDep | — |
| @testing-library/react | characterization tests | ✓ | ^16.3.2 | — |
| jsdom | characterization tests (component) | ✓ | implied by existing `*.test.tsx` files using `@vitest-environment jsdom` | — |

No missing dependencies.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (devDep) + @testing-library/react ^16.3.2 |
| Config file | `vitest.config.ts` (existing — used by all `tests/*.test.{ts,tsx}`) |
| Quick run command | `npx vitest run tests/auditPageReducer.test.ts tests/auditPageCharacterization.test.tsx` |
| Full suite command | `npm test` (= `vitest run`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUDIT-01 (a) | Loading render state visible on first mount | RTL component | `npx vitest run tests/auditPageCharacterization.test.tsx -t "loading state on mount"` | ❌ Wave 0 |
| AUDIT-01 (b) | Error render state visible on fetch failure | RTL component | `npx vitest run tests/auditPageCharacterization.test.tsx -t "error state on non-OK"` | ❌ Wave 0 |
| AUDIT-01 (c) | Empty render state when filteredEntries.length===0 | RTL component | `npx vitest run tests/auditPageCharacterization.test.tsx -t "empty state"` | ❌ Wave 0 |
| AUDIT-01 (d) | Populated table with N rows | RTL component | `npx vitest run tests/auditPageCharacterization.test.tsx -t "populated table"` | ❌ Wave 0 |
| AUDIT-01 (e) | 300ms debounce on filter change | RTL + waitFor | `npx vitest run tests/auditPageCharacterization.test.tsx -t "debounced refetch"` | ❌ Wave 0 |
| AUDIT-01 (f) | cancel-on-unmount (no setState warning, no extra fetch) | RTL | `npx vitest run tests/auditPageCharacterization.test.tsx -t "unmount cancels"` | ❌ Wave 0 |
| AUDIT-01 (g) | Admin-gated CSV (always) and JSON (admin-only) buttons | RTL | `npx vitest run tests/auditPageCharacterization.test.tsx -t "admin-gated export"` | ❌ Wave 0 |
| AUDIT-01 (h) | 6-dim filter URL params (user/action_category/fromTime/toTime/body_search/status_gte) emit correctly | RTL — assert on `authFetch` mock call | `npx vitest run tests/auditPageCharacterization.test.tsx -t "6-dim filter URL"` | ❌ Wave 0 |
| AUDIT-01 (i) | `isRelevantEntry` filters out noise GETs | unit (reducer file selector test) | `npx vitest run tests/auditPageReducer.test.ts -t "selectFilteredEntries"` | ❌ Wave 0 |
| AUDIT-01 (j) | `describeAction` / `describeDetail` outputs for known method/path pairs | unit (formatters test — colocate with reducer or split) | `npx vitest run tests/auditPageReducer.test.ts -t "describeAction"` | ❌ Wave 0 |
| AUDIT-02 | Characterization tests committed BEFORE refactor; pass against current AND refactored code | git history + CI | `git log --oneline -- tests/auditPageCharacterization.test.tsx src/pages/AuditPage.tsx` (manual review of two-commit ordering) | ❌ Wave 0 |
| AUDIT-03 | Files exist at exact paths; AuditPage.tsx is render-only (no useState, no useEffect, no fetch) | static check + smoke test | `test -f src/pages/audit/auditPageState.ts && test -f src/pages/audit/auditFormatters.ts && test -f src/pages/audit/useAuditData.ts && ! grep -E 'useState\|useEffect\|authFetch' src/pages/AuditPage.tsx` | ❌ Wave 0 |
| AUDIT-04 | Reducer test exercises 5 actions + epoch stale-guard | unit | `npx vitest run tests/auditPageReducer.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/auditPageReducer.test.ts tests/auditPageCharacterization.test.tsx` (≤ 5 s)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** `npm test` green; `npm run build` green; `npm run lint` green; bisect verification: characterization commit alone is green against the unrefactored AuditPage.

### Wave 0 Gaps
- [ ] `tests/auditPageCharacterization.test.tsx` — covers AUDIT-01 (a)–(h)
- [ ] `tests/auditPageReducer.test.ts` — covers AUDIT-04 + AUDIT-01 (i)–(j)
- [ ] `src/pages/audit/auditPageState.ts` — defines `AuditFilters`, `AuditState`, `AuditAction`, `auditReducer`, `initialState`, `selectDistinctUsers`, `selectFilteredEntries`
- [ ] `src/pages/audit/auditFormatters.ts` — verbatim move of 4 helpers from AuditPage.tsx
- [ ] `src/pages/audit/useAuditData.ts` — hook owning reducer + debounce + AbortController
- [ ] `src/pages/AuditPage.tsx` — slim down to render-only

(No framework install needed — Vitest + RTL + jsdom already present.)

## Code Examples (verified patterns from this codebase)

### RTL + vi.mock pattern (from `tests/adminCenterFilter.test.tsx`)
```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../src/services/authHeaders', () => ({
  authFetch: vi.fn(),
  getAuthHeaders: vi.fn(() => ({})),
}));
// … import SUT after mocks
```

### authFetch mock returning a Response (from `tests/helpers/renderOutcomesView.tsx` line 31)
```ts
vi.mocked(authFetch).mockResolvedValueOnce(
  new Response(JSON.stringify({ entries: [], total: 0 }), { status: 200 })
);
```

### Discriminated-union reducer (no library precedent in repo — write idiomatic React 19)
See §"Pattern: Reducer-with-epoch stale guard" above for sketch.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 10 sibling `useState` + ad-hoc `cancelled` flag | `useReducer` + epoch counter | This phase | Testable in isolation, deterministic stale-response semantics |
| AbortController-only cancellation | AbortController + reducer epoch guard (defense in depth) | This phase | Reducer is the source of truth; abort is a network optimization |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | StrictMode is NOT enabled in `src/App.tsx` (so double-mount won't surface in tests) | R-03 | If StrictMode IS on, every dev mount fires the effect twice; add explicit hook test for double-mount idempotence. **Verify before writing characterization tests.** [ASSUMED — not checked] |
| A2 | `vitest.config.ts` already has `globals: true` or tests import vi/describe explicitly. Existing tests use explicit imports, so this is fine. | Validation | If config differs, tests still work because all use explicit imports. [VERIFIED via existing tests] |
| A3 | The phrase "6-dim filter" in CONTEXT/ROADMAP refers to {user, category, fromDate, toDate, search, failuresOnly}. | Current-State Map | Counted directly in AuditPage.tsx — 6 controls. [VERIFIED via Read] |
| A4 | No file outside `src/pages/AuditPage.tsx` imports `describeAction`/`describeDetail`/`isRelevantEntry`/`statusBadgeClass`. | R-04 | Phase 20 SESSION-13 will extend the relocated `describeAction`. [VERIFIED via Grep — only AuditPage.tsx and planning docs reference these names] |
| A5 | `tests/audit.test.ts` and `tests/auditApi.test.ts` won't break — they test backend modules and are unaffected by this frontend refactor. | Risk Register | If grep on `AuditPage` in tests/ returns nothing (it does), we're safe. [VERIFIED via Grep] |

## Open Questions

1. **Should `refetch` actually be exposed?**
   - What we know: D-06 says "include only if needed by characterization tests"; current AuditPage has no Reload button.
   - What's unclear: whether characterization tests need to manually trigger a refetch (e.g., to test error recovery without remount).
   - Recommendation: Implement `refetch` (cheap — bumps epoch & re-runs effect via a counter dep) but **don't wire it into the page render**. Characterization tests can ignore it; reducer test doesn't touch it.

2. **Where do `ServerAuditEntry` and `AuditFilters` types live?**
   - What we know: D-04 says state shape is in `auditPageState.ts`; D-11 says formatters move verbatim.
   - What's unclear: `ServerAuditEntry` is consumed by both `auditFormatters.ts` (`isRelevantEntry`) and `auditPageState.ts` (state shape).
   - Recommendation: Place both types in `auditPageState.ts` and let `auditFormatters.ts` import `ServerAuditEntry` from it. Single source of truth; no circular dep (reducer doesn't import formatters).

3. **Selector colocation: same file as reducer, or separate `auditSelectors.ts`?**
   - Recommendation: Same file (`auditPageState.ts`). CONTEXT D-04 explicitly says "selectors (pure functions in `auditPageState.ts`)".

## Sources

### Primary (HIGH confidence)
- `src/pages/AuditPage.tsx` (full file, 337 LOC) — current implementation [VERIFIED via Read]
- `src/services/authHeaders.ts` — `authFetch` API [VERIFIED via Read]
- `src/hooks/useCaseData.ts` — referenced by CONTEXT but is pure useMemo, no fetch [VERIFIED via Read]
- `tests/adminCenterFilter.test.tsx` — RTL+jsdom+vi.mock pattern template [VERIFIED via Read, lines 1–80]
- `tests/audit.test.ts`, `tests/auditApi.test.ts`, `tests/auditMiddleware.test.ts` — backend Vitest convention reference [VERIFIED via Read]
- `tests/helpers/renderOutcomesView.tsx` — Phase 18 helper-extraction precedent [VERIFIED via Read]
- `package.json` — React 19.2.4, RTL 16.3.2, no missing deps [VERIFIED via Read]
- `.planning/phases/19-auditpage-state-machine-refactor/19-CONTEXT.md` — locked decisions [VERIFIED via Read]
- `.planning/STATE.md` + `.planning/ROADMAP.md` — Phase 19 success criteria + Phase 20 dependency [VERIFIED via Read]
- `.planning/milestones/v1.7-phases/17-audit-log-upgrade-dark-mode/17-04-PLAN.md` — origin of the 6-dim filter contract (lines 22–28 truths section) [VERIFIED via Read]

### Secondary (MEDIUM confidence)
- (None — this is a single-file refactor with full-file source available; no external sources needed.)

### Tertiary (LOW confidence)
- (None.)

## Metadata

**Confidence breakdown:**
- Current-state map: HIGH — full source read line-by-line
- Reducer/hook patterns: HIGH — idiomatic React 19, no library decisions
- Test conventions: HIGH — verified against `tests/adminCenterFilter.test.tsx`
- Phase 20 forward-compatibility: HIGH — verified `describeAction` has no external importers (Grep)
- Inline `ServerAuditEntry.id: number` vs server `id: string`: HIGH on the discrepancy, MEDIUM on whether to flag (recommend: leave as-is, out of scope)

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (30 days — codebase is stable, no upstream library bumps planned in v1.8)

## RESEARCH COMPLETE
