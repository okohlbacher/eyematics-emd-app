---
phase: 19
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/auditPageCharacterization.test.tsx
autonomous: true
requirements:
  - AUDIT-01
  - AUDIT-02
must_haves:
  truths:
    - "Test file `tests/auditPageCharacterization.test.tsx` exists and runs in jsdom environment"
    - "Test suite asserts the 4 render states (loading on mount, error on non-OK, empty when filteredEntries===0, populated table)"
    - "Test suite asserts admin-gated CSV (always visible) and JSON (admin-only) export buttons"
    - "Test suite asserts 6-dim filter URL params (user, action_category, fromTime, toTime[+T23:59:59], body_search, status_gte=400) are emitted on the authFetch mock"
    - "Test suite asserts 300 ms debounce: filter change does NOT call authFetch synchronously, but does after the timer elapses"
    - "Test suite asserts cancel-on-unmount: unmount during in-flight fetch produces no React state-update warning"
    - "Test suite asserts isRelevantEntry behavior end-to-end (a noise GET like `/api/auth/users/me` is filtered out of the rendered table)"
    - "Test suite asserts describeAction / describeDetail outputs match expected i18n keys for known method/path pairs"
    - "All characterization tests pass against UNREFACTORED `src/pages/AuditPage.tsx` (no source edits in this plan)"
    - "Commit message starts with `test(19): characterization tests for AuditPage v1.7 behavior`"
  artifacts:
    - path: "tests/auditPageCharacterization.test.tsx"
      provides: "Frozen v1.7 behavior spec for AuditPage"
      contains: "@vitest-environment jsdom"
  key_links:
    - from: "tests/auditPageCharacterization.test.tsx"
      to: "src/pages/AuditPage.tsx"
      via: "default import after vi.mock of authHeaders/AuthContext/LanguageContext"
      pattern: "import AuditPage from '\\.\\./src/pages/AuditPage'"
    - from: "tests/auditPageCharacterization.test.tsx"
      to: "vi.mocked(authFetch)"
      via: "mockResolvedValue(new Response(JSON.stringify({entries, total})))"
      pattern: "vi\\.mocked\\(authFetch\\)\\.mock"
---

<objective>
Land characterization tests against the EXISTING (unrefactored) `src/pages/AuditPage.tsx` so that v1.7 behavior is captured byte-for-byte BEFORE Plan 02 swaps the implementation to a `useReducer` state machine. The test file must pass against the current code on its own commit (`test(19): characterization tests for AuditPage v1.7 behavior`) and remain green after the Plan 02 refactor — any post-refactor diff is a regression.

Purpose: Satisfies AUDIT-02 (characterization commit BEFORE reducer swap) and locks the AUDIT-01 contract (4 render states, 6-dim filter, 300 ms debounce, cancel-on-unmount, admin-gated exports).

Output: `tests/auditPageCharacterization.test.tsx` — green against current `AuditPage.tsx`, no source files modified.
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
@src/pages/AuditPage.tsx
@tests/adminCenterFilter.test.tsx
@tests/helpers/renderOutcomesView.tsx

<interfaces>
<!-- Extracted contracts the executor needs. Do NOT explore the codebase — use these. -->

From src/pages/AuditPage.tsx (current, unrefactored — lines 11-19):
```ts
interface ServerAuditEntry {
  id: number;        // NOTE: server actually returns string; pre-existing type lie — DO NOT FIX
  timestamp: string; // ISO 8601
  method: string;    // 'GET'|'POST'|'PUT'|'DELETE'|'PATCH'
  path: string;
  user: string;
  status: number;
  duration_ms: number;
}
```

From src/services/authHeaders.ts (mock target):
```ts
export function authFetch(url: string, init?: RequestInit): Promise<Response>;
export function getAuthHeaders(): Record<string, string>;
```

From src/context/AuthContext.tsx (mock target):
```ts
export function useAuth(): { user: { username: string; role: 'admin' | 'forscher1' | string } | null };
```

From src/context/LanguageContext.tsx (mock target):
```ts
export function useLanguage(): { locale: string; t: (key: string) => string };
```

Server URL contract emitted by AuditPage's debounced fetch (verbatim from AuditPage.tsx lines 119-127):
```
/api/audit?limit=500&offset=0
  [&user=<filterUser>]
  [&action_category=<auth|data|admin|outcomes>]
  [&fromTime=<YYYY-MM-DD>]
  [&toTime=<YYYY-MM-DD>T23:59:59]      ← end-of-day suffix is REQUIRED
  [&body_search=<text>]                 ← admin-only (UI gate)
  [&status_gte=400]                     ← only when failuresOnly=true
```

DOM markers for the 4 render states (verbatim from AuditPage.tsx):
- Loading: literal text "Loading audit log…" (line 265)
- Error: red-bordered card containing the raw `{error}` string (line 271)
- Empty: container with text from `t('auditEmptyFiltered')` → with stub `t: k => k` this renders the literal "auditEmptyFiltered" (line 279)
- Populated: a `<table>` element with `<tbody>` rows (lines 281-330)

Mock pattern (from tests/adminCenterFilter.test.tsx — VERIFIED template):
```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../src/services/authHeaders', () => ({
  authFetch: vi.fn(),
  getAuthHeaders: vi.fn(() => ({})),
}));
vi.mock('../src/context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../src/context/LanguageContext', () => ({ useLanguage: vi.fn() }));

import AuditPage from '../src/pages/AuditPage';
import { authFetch } from '../src/services/authHeaders';
import { useAuth } from '../src/context/AuthContext';
import { useLanguage } from '../src/context/LanguageContext';
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Author characterization test file with 4-render-states + admin-gating + isRelevantEntry coverage</name>
  <files>tests/auditPageCharacterization.test.tsx</files>
  <read_first>
    - src/pages/AuditPage.tsx (entire file — this is the SUT, frozen)
    - tests/adminCenterFilter.test.tsx (RTL+jsdom+vi.mock convention to mirror)
    - tests/helpers/renderOutcomesView.tsx (authFetch-mock pattern: `mockResolvedValueOnce(new Response(JSON.stringify({entries, total}), { status: 200 }))`)
    - .planning/phases/19-auditpage-state-machine-refactor/19-RESEARCH.md §"Existing Test Patterns to Mirror" and §"Current-State Map"
  </read_first>
  <behavior>
    File header: `// @vitest-environment jsdom` on line 1, then a docblock noting "Phase 19 / AUDIT-02: Characterization tests — these tests freeze v1.7 AuditPage behavior. They MUST pass against the unrefactored AuditPage and MUST remain green after the Plan 02 refactor. Any diff is a regression."

    `vi.mock` blocks (BEFORE imports of SUT) for:
    - `../src/services/authHeaders` → exports `authFetch: vi.fn()`, `getAuthHeaders: vi.fn(() => ({}))`
    - `../src/context/AuthContext` → exports `useAuth: vi.fn()`
    - `../src/context/LanguageContext` → exports `useLanguage: vi.fn()`

    `beforeEach`:
    - `vi.mocked(useLanguage).mockReturnValue({ locale: 'en', t: (k: string) => k })`
    - `vi.mocked(useAuth).mockReturnValue({ user: { username: 'admin', role: 'admin' } } as never)` (default; tests override for non-admin cases)
    - default `vi.mocked(authFetch).mockResolvedValue(new Response(JSON.stringify({ entries: [], total: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } }))`

    `afterEach`: `cleanup(); vi.clearAllMocks();`

    Test cases (use these EXACT `it(...)` titles so the per-task `-t "<title>"` filters in 19-VALIDATION.md match):

    1. `it('loading state on mount', ...)` — render AuditPage; assert `screen.getByText(/Loading audit log/i)` is in the document SYNCHRONOUSLY (before any timer fires). Asserts `loading: true` initial state.

    2. `it('error state on non-OK', ...)` — override mock to `mockResolvedValueOnce(new Response('boom', { status: 500 }))`; render; `await waitFor` that `screen.getByText('Server returned 500')` appears. (AuditPage throws `new Error(\`Server returned \${res.status}\`)` on non-OK.)

    3. `it('empty state when no entries match filters', ...)` — mock returns `{entries: [], total: 0}`; render; `await waitFor` that `screen.getByText('auditEmptyFiltered')` appears (raw i18n key because stub t is identity).

    4. `it('populated table renders rows', ...)` — mock returns 2 relevant entries (e.g. one POST `/api/auth/login`, one PUT `/api/settings`) with distinct timestamps and statuses 200/201. `await waitFor` that exactly 2 `<tr>` rows exist inside `<tbody>` (use `screen.getAllByRole('row')` minus the header row, or `container.querySelectorAll('tbody tr')`). Assert table is sorted DESC by timestamp.

    5. `it('debounced refetch on filter change', ...)` — render; await initial fetch resolves; clear mock call count; change the category `<select>` (use `fireEvent.change(screen.getByLabelText(/auditFilterCategory/i, { selector: 'select' })` or query by display value) to value `auth`. Assert `authFetch` was NOT called immediately (within the same tick). Then `await waitFor(() => expect(authFetch).toHaveBeenCalledTimes(2), { timeout: 1000 })` — second call confirms debounce fired. Inspect the second call's URL and assert it contains `action_category=auth`.

    6. `it('unmount cancels in-flight fetch', ...)` — install a `vi.spyOn(console, 'error').mockImplementation(() => {})`; mock authFetch to return a promise that resolves after 500 ms; render; immediately `unmount()`; wait 600 ms; assert `console.error` was NOT called with any "state update on an unmounted" / "Can't perform a React state update" warning string. (Use `consoleSpy.mock.calls.flat().join(' ')` and assert it does NOT match `/unmounted|state update/i`.)

    7. `it('admin-gated export buttons', ...)` — render with `useAuth → role: 'admin'`; assert both CSV and JSON export buttons are visible (`screen.getByText('auditExportCsv')`, `screen.getByText('auditExportJson')`). Then `cleanup()`, override `useAuth → role: 'forscher1'`, re-render; assert CSV is visible, JSON is NOT (`screen.queryByText('auditExportJson')` is `null`).

    8. `it('6-dim filter URL params emit correctly', ...)` — render as admin; await initial fetch; clear mock; change ALL 6 filters (user dropdown → pick 'alice' (requires entries with that user, OR just type into the input via `fireEvent.change`), category → 'data', fromDate → '2026-01-01', toDate → '2026-01-31', search → 'foo', failures checkbox → checked); `await waitFor` for next authFetch call; inspect the URL string passed to authFetch. Assert it contains ALL of: `user=alice`, `action_category=data`, `fromTime=2026-01-01`, `toTime=2026-01-31T23:59:59`, `body_search=foo`, `status_gte=400`. (Use `expect(url).toContain('...')` for each.)

    9. `it('isRelevantEntry filters out noise GETs from rendered table', ...)` — mock returns mix: a relevant POST `/api/auth/login` AND an irrelevant GET `/api/auth/users/me`. Render; `await waitFor` for table; assert ONLY the POST row is rendered (`screen.queryByText('/api/auth/users/me')` is null; `screen.getAllByRole('row')` count = 1 + header).

    10. `it('describeAction outputs expected i18n key for POST /api/auth/login', ...)` — mock returns a single entry with method=POST, path=/api/auth/login; render; await; assert `screen.getByText('audit_action_login')` is in the document (raw key because stub t is identity). Also test PUT `/api/settings` → `audit_action_update_settings`, and an unknown POST `/api/foo` → `audit_action_unknown` (separate entries OR sibling tests).

    11. `it('describeDetail outputs expected i18n key for DELETE /api/auth/users/alice', ...)` — entry with method=DELETE, path=/api/auth/users/alice; render; await; assert `screen.getByText('audit_detail_delete_user')` (the stub `t` returns the raw key, so the `.replace('{0}', 'alice')` is applied to the key string — adapt assertion to whatever the literal output is; document the stub-t coupling in a comment).
  </behavior>
  <action>
    Create `tests/auditPageCharacterization.test.tsx` implementing the test cases above. Use real timers (matches `tests/adminCenterFilter.test.tsx` precedent) — `waitFor` with default 1000 ms timeout handles the 300 ms debounce. Do NOT use `vi.useFakeTimers()` in this file (the inline `await res.json()` parse and React render scheduling don't play nicely with fake timers in this codebase).

    For test 8 (6-dim filter): if querying the user `<select>` proves brittle (it's only rendered when the entries response contains distinct users), seed the initial `mockResolvedValueOnce` with at least one entry whose `user: 'alice'` so the dropdown contains an `<option>` for alice; then `fireEvent.change(userSelect, { target: { value: 'alice' } })`.

    Do NOT modify `src/pages/AuditPage.tsx` or any other source file. This plan is test-only.

    Run `npx vitest run tests/auditPageCharacterization.test.tsx` after writing — every test MUST be green against the current source. If any test is red, the test is wrong (not the source) — fix the test until it captures the actual behavior.
  </action>
  <verify>
    <automated>npx vitest run tests/auditPageCharacterization.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - File exists: `test -f tests/auditPageCharacterization.test.tsx` returns 0
    - File has jsdom directive on line 1: `head -n 1 tests/auditPageCharacterization.test.tsx | grep -q '@vitest-environment jsdom'`
    - All 3 vi.mock blocks present: `grep -c "vi.mock('../src/services/authHeaders'" tests/auditPageCharacterization.test.tsx` returns 1; same for `'../src/context/AuthContext'` and `'../src/context/LanguageContext'`
    - All 11 test titles present: `grep -c "it('loading state on mount'\|it('error state on non-OK'\|it('empty state\|it('populated table\|it('debounced refetch\|it('unmount cancels\|it('admin-gated export\|it('6-dim filter URL\|it('isRelevantEntry filters\|it('describeAction outputs\|it('describeDetail outputs" tests/auditPageCharacterization.test.tsx` returns ≥ 11
    - 6-dim URL assertions present: `grep -E "toContain\\('(user=|action_category=|fromTime=|toTime=.*T23:59:59|body_search=|status_gte=400)" tests/auditPageCharacterization.test.tsx | wc -l` returns ≥ 6
    - NO source files modified: `git diff --name-only src/` returns empty
    - Test command exits 0: `npx vitest run tests/auditPageCharacterization.test.tsx` returns exit code 0 with all tests green
  </acceptance_criteria>
  <done>All 11 characterization tests pass against the unrefactored `src/pages/AuditPage.tsx`. No source files modified. File ready to be committed as `test(19): characterization tests for AuditPage v1.7 behavior` (plan-end commit performed by execute-plan).</done>
</task>

</tasks>

<threat_model>
No new threat surface — pure frontend test addition for an existing admin-gated read-only page. Tests mock all external boundaries (authFetch, AuthContext, LanguageContext) and execute in jsdom; they touch no network, no filesystem outside `tests/`, no audit DB. AUDIT immutability and admin-gating are inherited from unchanged backend and AuthContext.
</threat_model>

<verification>
- `npx vitest run tests/auditPageCharacterization.test.tsx` — green, 11/11 tests pass
- `git diff --name-only src/` — returns empty (no source modified)
- `npm test` — full suite still green (no regressions in adjacent tests)
</verification>

<success_criteria>
- `tests/auditPageCharacterization.test.tsx` exists with `// @vitest-environment jsdom` directive
- All 4 render states (loading, error, empty, populated) covered
- Admin-gated CSV (always visible) + JSON (admin-only) export buttons covered
- 6-dim filter URL contract (user, action_category, fromTime, toTime+T23:59:59, body_search, status_gte=400) asserted explicitly
- 300 ms debounce verified (no synchronous fetch after filter change; one fetch within 1s)
- Cancel-on-unmount verified (no React state-update warning in console.error)
- `isRelevantEntry`, `describeAction`, `describeDetail` outputs asserted via end-to-end render
- All tests pass against UNREFACTORED `src/pages/AuditPage.tsx`
- Zero source files modified
</success_criteria>

<output>
After completion, create `.planning/phases/19-auditpage-state-machine-refactor/19-01-SUMMARY.md` documenting:
- Final test count and per-test-title status
- Any deviations from the planned test titles (if a test had to be split or renamed) and why
- Commit hash for `test(19): characterization tests for AuditPage v1.7 behavior`
- Confirmation: zero source-file changes in this commit (`git show --stat <hash>` shows only `tests/auditPageCharacterization.test.tsx`)
</output>
