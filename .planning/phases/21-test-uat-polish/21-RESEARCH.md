# Phase 21: Test & UAT Polish — Research

**Researched:** 2026-04-23
**Domain:** Vitest test-suite repair + session-resilience UAT automation
**Confidence:** HIGH (all claims grounded in direct file reads + a live vitest run)

## Summary

The three "pre-existing failing tests" are NOT the same class of bug. A live `vitest run` of `tests/outcomesPanelCrt.test.tsx` + `tests/OutcomesPage.test.tsx` produced three precise error messages that point at two distinct drift patterns:

1. **TEST-01 / TEST-02 (`outcomesPanelCrt`)** — test assertion drift. Source `src/components/outcomes/OutcomesPanel.tsx:56` returns **`[0, 1]`** for visus absolute y-domain, with an inline comment citing "admin feedback Apr-17" (commit `668bfaf` — v1.6 feat ship). The test was written against an earlier `[0, 2]` contract that was intentionally tightened. **Fix: update tests to expect `[0, 1]`.** No source change; the comment makes the intent explicit.
2. **TEST-03 (`OutcomesPage`)** — source drift. `src/components/outcomes/OutcomesView.tsx:171-178` fires `authFetch('/api/audit/events/view-open', { method, body, headers, keepalive })` but omits `credentials: 'include'`. The test (written for the Phase 11 + Phase 20 cookie-auth contract) asserts `credentials === 'include'`. Since Phase 20 locked the CSRF double-submit cookie flow, beacons crossing `/api/audit/*` must carry the auth cookie. **Fix: one-line source add (`credentials: 'include'`) in OutcomesView.tsx beacon init.** Scoped, non-refactor, honors D-09.

The remaining 6 requirements (UAT-AUTO-01..05 + TEST-04) are additive test work with zero source changes. All the infrastructure needed already exists in `tests/authFetchRefresh.test.ts`:

- **`MockBC` class** (lines 23-36) is a 13-line in-memory BroadcastChannel shim that already implements the minimum needed surface (`postMessage`, `addEventListener`, `removeEventListener`, `close`, static `instances`, `fire()` helper). It is **currently scoped to that one test file** — Decision D-03 asks for it to be promoted to `tests/setup.ts` so multi-tab tests can instantiate two channels.
- **`setCookie` + `vi.stubGlobal('fetch', vi.fn())` + `vi.resetModules()` + dynamic `await import('../src/services/authHeaders')`** is the canonical fetch-mock pattern and should be replicated verbatim for UAT-AUTO-01..03.
- **Fake timers** for idle-logout (UAT-AUTO-04) and absolute-cap (UAT-AUTO-05) follow the standard `vi.useFakeTimers({ toFake: [...] }) + vi.setSystemTime + afterEach(() => vi.useRealTimers())` pattern; no existing test in the repo uses this yet, so 21-03 establishes it fresh.

**Primary recommendation:** split 21-01 into four crisp edits (2 test updates, 1 source one-liner, 1 grep script in `package.json`). Bundle 21-02 as a new describe block inside the existing `tests/authFetchRefresh.test.ts` (three more tests — the module-isolation harness is already there). Create `tests/sessionTimers.test.tsx` for 21-03; it needs a React render harness (for `<AuthProvider>`) plus fake timers, and mixing that with the existing unit-style authFetch file would hurt readability.

## Project Constraints (from CLAUDE.md)

`./CLAUDE.md` is **absent** in the working directory. The only project-instruction source for this phase is `21-CONTEXT.md`, whose locked decisions (D-01..D-13) are reproduced verbatim below under User Constraints.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Mock Strategy**
- **D-01:** Extend existing `vi.stubGlobal('fetch', vi.fn())` pattern for all UAT-AUTO tests. `authFetchRefresh.test.ts` already uses this pattern (25 instances) — stay consistent. **No msw dependency.**
- **D-02:** `vi.mock()` factories for modules live at the consumer test-file site (Vitest hoisting constraint, per Phase 18 D-06). Shared factories may be exported from `tests/helpers/*.tsx` but `vi.mock()` calls stay in the test file.

**BroadcastChannel Testing**
- **D-03:** jsdom lacks `BroadcastChannel`. Add a minimal in-memory shim in `tests/setup.ts` (single-process, Map-backed) — no npm dep. Posting on one instance fires `message` events on all OTHER instances of the same channel name (NOT the poster itself).
- **D-04:** UAT-AUTO-02 tests instantiate two BroadcastChannel instances with the same channel name to simulate two tabs; assert single-flight lock behavior.

**Fake Timers + System Clock**
- **D-05:** Use `vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'] })` for idle-logout (UAT-AUTO-04) and absolute-cap (UAT-AUTO-05). Combine with `vi.setSystemTime(ms)`.
- **D-06:** `afterEach` MUST call `vi.useRealTimers()`.

**3-Failing-Tests Fix Posture**
- **D-07:** Root-cause FIRST, decide SECOND. If source drifted from documented contract → fix source (regression). If test assertion was incorrect from day 1 → fix test. Document decision per-test in the plan/commit.
- **D-08:** TEST-01/02 suspected v1.6 Phase 13 visus y-domain regression. TEST-03 suspected Phase 11 beacon drift. (Note: research updates D-08 below — TEST-01/02 is actually a **test** drift, not a source regression. TEST-03 is a source drift.)
- **D-09:** Minimal, scoped source fix. No refactoring.

**Zero-Skipped-Tests Policy (TEST-04)**
- **D-10:** `describe.skip`/`it.skip` forbidden in `tests/**` except with `SKIP_REASON:` comment on prior line.
- **D-11:** Lightweight grep-based CI gate (not ESLint — that's Phase 23).

**Plan Structure**
- **D-12:** 3 plans — 21-01 (TEST-01..04), 21-02 (UAT-AUTO-01..03), 21-03 (UAT-AUTO-04..05).
- **D-13:** 21-01 has no deps. 21-02 before 21-03. Sequential 21-01 → 21-02 → 21-03 safest; 21-01 may parallel 21-02.

### Claude's Discretion

- Specific test file naming (e.g., `authFetchRefreshSuite.test.ts` vs splitting)
- Whether to extend existing `authFetchRefresh.test.ts` or create a sibling file
- Exact shape of the BroadcastChannel shim (minimal; just enough for post + listen across instances)
- Grep patterns for the zero-skip CI gate

### Deferred Ideas (OUT OF SCOPE)

- Playwright / Cypress E2E harness (MSEL-04)
- ESLint rule for `.skip` without SKIP_REASON (Phase 23 scope)
- msw migration
- jest-dom assertion library upgrade
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-01 | Fix `outcomesPanelCrt.test.tsx` "visus absolute [0, 2]" | Confirmed test assertion drift; source correctly returns `[0, 1]` per admin-feedback comment in OutcomesPanel.tsx:56. Fix = update test. |
| TEST-02 | Fix `outcomesPanelCrt.test.tsx` "backward compat default visus absolute [0, 2]" | Same root cause as TEST-01 — `metric` default = `'visus'` → `[0, 1]`. Fix = update test. |
| TEST-03 | Fix `OutcomesPage.test.tsx` Phase 11 audit beacon test | Confirmed source drift — `OutcomesView.tsx:171` omits `credentials: 'include'`. Fix = add one line to source. |
| TEST-04 | Zero skipped tests + CI gate with SKIP_REASON exemption | Grep across `tests/**` returned **zero** existing `.skip` usages — the gate starts clean. Implementation is a grep script in package.json `test:ci` chain. |
| UAT-AUTO-01 | Automate silent-refresh smoke | `tests/authFetchRefresh.test.ts` Test 1 already covers this at unit level; UAT-AUTO-01 is a "mark Test 1 as the canonical silent-refresh smoke" + optionally add an integration-level smoke asserting original request retry. |
| UAT-AUTO-02 | Automate BroadcastChannel multi-tab coordination | Existing `MockBC` (lines 23-36 of authFetchRefresh.test.ts) needs promotion to `tests/setup.ts` + enhancement: posting on one instance fires on OTHER instances of same name. Current shim only fires via explicit `.fire()` helper — needs cross-instance broadcast wiring. |
| UAT-AUTO-03 | Automate audit DB silence for 200 refresh | Unit-level test asserts `authFetch` on 401 triggers refresh → audit-middleware SKIP_AUDIT_IF_STATUS maps `/api/auth/refresh` to `new Set([200])` (`server/auditMiddleware.ts:87-89`). Recommend a pure unit test of `SKIP_AUDIT_IF_STATUS['/api/auth/refresh'].has(200)` + `tests/auditMiddleware.test.ts` already has coverage we can extend; full E2E is impractical in vitest. |
| UAT-AUTO-04 | Automate 10-min idle-logout | `INACTIVITY_TIMEOUT = 10 * 60 * 1000` at `src/context/AuthContext.tsx:64`. Import the constant (already exported indirectly — may need to export it, or keep magic number in test matched via grep, but cleaner = export the constant). Fake timers + render `<AuthProvider>` + advance. |
| UAT-AUTO-05 | Automate absolute-cap re-auth | Server-side path: `server/authApi.ts:363-366` — `ageMs > settings.refreshAbsoluteCapMs → 401 'Session cap exceeded'`. Client test = stub refresh endpoint to return 401 with that payload, assert client falls through to `/login`. Values (8h/12h) live in `config/settings.yaml:12-13`. |
</phase_requirements>

## Standard Stack

### Core (already present — nothing to install)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | (repo pin) | Test runner | Already the project default (`vitest.config.ts` defines include patterns) |
| @testing-library/react | (repo pin) | RTL for component tests | Used in every `*.test.tsx` file |
| vi.stubGlobal / vi.mock | vitest built-ins | Fetch + module mocking | 25 call sites in `authFetchRefresh.test.ts` — canonical |

### NOT being added

| Library | Why Not |
|---------|---------|
| msw | D-01 bans it. `vi.stubGlobal('fetch')` covers all refresh/logout/audit cases. |
| @testing-library/jest-dom | Out of scope per `CONTEXT.md`. Stay with `queryByText().not.toBeNull()`. |
| fake-indexeddb | No IndexedDB in scope for these tests. |
| BroadcastChannel npm shim | Hand-rolled 13-line `MockBC` class in `tests/setup.ts` is sufficient (D-03). |

**Installation:** None.

**Version verification:** [VERIFIED: repo `package.json`] vitest + RTL already installed. No new deps justified — a `package.json` change would violate the phase scope ("only if absolutely needed for mock/polyfill; justify in plan").

## Architecture Patterns

### Recommended File Layout

```
tests/
├── setup.ts                      # NEW — BroadcastChannel shim (D-03); referenced by vitest.config.ts
├── authFetchRefresh.test.ts      # EXTEND — add UAT-AUTO-01..03 describe block
├── sessionTimers.test.tsx        # NEW — UAT-AUTO-04/05 (fake timers + <AuthProvider>)
├── outcomesPanelCrt.test.tsx     # EDIT — TEST-01/02 ([0,1] not [0,2])
├── OutcomesPage.test.tsx         # EDIT — (no change needed; source gets fixed)
├── auditMiddleware.test.ts       # EXTEND (optional) — UAT-AUTO-03 server-side unit
└── helpers/
    └── renderOutcomesView.tsx    # unchanged — reference pattern for future helpers

src/components/outcomes/
└── OutcomesView.tsx              # EDIT — add `credentials: 'include'` to line 171 beacon

scripts/
└── check-skipped-tests.sh        # NEW — grep-based CI gate (or inline in package.json)
```

### Pattern 1: Module-level-state isolation (for authHeaders tests)

**What:** `authHeaders.ts` holds a module-scoped `refreshPromise` and module-scoped `BroadcastChannel`. To give each test a fresh instance, use `vi.resetModules()` + dynamic import.

**When to use:** Every test in the `authFetch` refresh suite (UAT-AUTO-01..03).

**Example (copy verbatim from `tests/authFetchRefresh.test.ts:47-50`):**
```typescript
async function loadModule() {
  vi.resetModules();
  return await import('../src/services/authHeaders');
}
```

### Pattern 2: Minimal BroadcastChannel shim (D-03 canonical)

**What:** In-memory Map-backed shim. Posting on one instance fires `message` events on all OTHER same-name instances.

**When to use:** `tests/setup.ts` (shared across all tests that import modules which construct a `BroadcastChannel`).

**Current shim** (`tests/authFetchRefresh.test.ts:23-36`) is close but does NOT implement cross-instance broadcast — it relies on an explicit `.fire()` helper. **Extension needed for UAT-AUTO-02** — `postMessage` must dispatch to other instances of the same channel name in the same process.

**Proposed shim for `tests/setup.ts`:**
```typescript
// Minimal single-process BroadcastChannel — mirrors the MDN spec for the subset
// of the API the codebase actually uses (postMessage, addEventListener('message'),
// removeEventListener, close). Cross-instance: posting on instance A fires the
// 'message' handler on every OTHER instance that shares the same `name`.
class MockBroadcastChannel {
  private static channels = new Map<string, Set<MockBroadcastChannel>>();
  private listeners: Array<(e: MessageEvent) => void> = [];
  private closed = false;
  readonly name: string;

  constructor(name: string) {
    this.name = name;
    const set = MockBroadcastChannel.channels.get(name) ?? new Set();
    set.add(this);
    MockBroadcastChannel.channels.set(name, set);
  }

  postMessage(data: unknown): void {
    if (this.closed) return;
    const peers = MockBroadcastChannel.channels.get(this.name);
    if (!peers) return;
    for (const peer of peers) {
      if (peer === this || peer.closed) continue; // spec: NOT the poster
      for (const fn of peer.listeners) fn({ data } as MessageEvent);
    }
  }

  addEventListener(type: 'message', fn: (e: MessageEvent) => void): void {
    if (type !== 'message') return;
    this.listeners.push(fn);
  }

  removeEventListener(type: 'message', fn: (e: MessageEvent) => void): void {
    if (type !== 'message') return;
    this.listeners = this.listeners.filter((l) => l !== fn);
  }

  close(): void {
    this.closed = true;
    MockBroadcastChannel.channels.get(this.name)?.delete(this);
  }

  /** Test-only: reset every channel (call in global beforeEach). */
  static _reset(): void { MockBroadcastChannel.channels.clear(); }
}

if (typeof globalThis.BroadcastChannel === 'undefined') {
  (globalThis as unknown as { BroadcastChannel: typeof MockBroadcastChannel }).BroadcastChannel = MockBroadcastChannel;
}
```

**Wire into vitest.config.ts:**
```typescript
test: {
  environment: 'node',
  setupFiles: ['tests/setup.ts'],   // NEW
  include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
}
```

**Gotcha:** The existing `authFetchRefresh.test.ts` `MockBC` uses `vi.stubGlobal('BroadcastChannel', MockBC)` per-test. With a global `setupFiles` shim, that stub becomes redundant — but **don't delete it in 21-01/02** (out of scope). Leave the stub; it overrides the global for that file's tests without breaking anything.

### Pattern 3: vi.mock hoisting + consumer-file placement (Phase 18 Pitfall #3)

`vi.mock()` calls are hoisted by Vitest to the top of the file. Place them in the consumer test file, NOT in a helper. If a shared factory is needed, export the factory from `tests/helpers/*.ts` and invoke it inside a `vi.mock()` at the test-file site.

### Pattern 4: Fake timers for idle-logout / absolute-cap

**When to use:** `tests/sessionTimers.test.tsx` (UAT-AUTO-04/05).

**Example:**
```typescript
import { render, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthProvider } from '../src/context/AuthContext';

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'],
  });
  vi.setSystemTime(new Date('2026-04-23T10:00:00Z'));
  sessionStorage.clear();
  // Seed a valid token so AuthProvider hydrates a user
  sessionStorage.setItem('emd-token', buildTestJwt({ sub: 'alice', role: 'researcher' }));
});

afterEach(() => {
  vi.useRealTimers();    // D-06 — non-negotiable
  cleanup();
});

it('idle 10 minutes → performLogout fires', () => {
  render(<AuthProvider>{/* children */}</AuthProvider>);
  act(() => { vi.advanceTimersByTime(10 * 60 * 1000); });
  expect(sessionStorage.getItem('emd-token')).toBeNull();
});
```

**Gotcha:** `<AuthProvider>` uses `useState(() => sessionStorage.getItem('emd-token'))` and `useEffect` to fetch `/api/auth/users/me`. The latter is a raw `fetch`, so stub it: `vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{"user":{"username":"alice"}}', { status: 200 }))));` before render.

### Anti-Patterns to Avoid

- **Leaking fake timers** (D-06) — always `afterEach(() => vi.useRealTimers())`. Without this, downstream tests get nondeterministic timer behavior.
- **Mocking authFetch at the module boundary instead of fetch** — the canonical pattern stubs `global.fetch`. Mocking `authFetch` would bypass the code under test.
- **Hard-coding `600000` instead of importing `INACTIVITY_TIMEOUT`** — couples tests to magic numbers. Export the constant and import it. [CITED: specifics block of CONTEXT.md]
- **`jest-dom` assertions** — `toBeInTheDocument()` will throw `TypeError: ... is not a function`. Always use `queryByText().not.toBeNull()`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP mocking | msw / node-fetch-mock | `vi.stubGlobal('fetch', vi.fn())` | D-01; 25 call sites already use this pattern |
| Timer control | setTimeout/setInterval overrides | `vi.useFakeTimers` + `vi.advanceTimersByTime` | Built into vitest |
| JWT generation in tests | Crypto libs | A 5-line `buildTestJwt` helper (base64url of header/payload + fake signature) | `userFromToken` only decodes, doesn't verify — any well-formed JWT works |
| BroadcastChannel shim | npm packages | 40-line `tests/setup.ts` shim (Pattern 2 above) | Zero deps; single-process is all the tests need |
| Skip-detection lint | ESLint custom rule | Grep script in `package.json` | D-11; ESLint rule deferred to Phase 23 |

**Key insight:** Every pattern for this phase already exists somewhere in the repo. The work is **promotion + replication**, not invention.

## Common Pitfalls

### Pitfall 1: `OutcomesView` beacon uses authFetch — and that wraps the fetch spy

**What goes wrong:** In `tests/OutcomesPage.test.tsx`, the test stubs `global.fetch`. The source calls `authFetch`, which internally calls `fetch`. So the spy DOES fire — but `authFetch` sees a 204 response (the spy default) and passes through without modification. **However**, `authFetch` never adds `credentials: 'include'` on behalf of callers — it only uses them inside `refreshAccessToken`/`serverLogout`.

**Why it happens:** The test's assertion `expect(init?.credentials).toBe('include')` relies on the caller (`OutcomesView.tsx:171`) to explicitly pass `credentials: 'include'` in the `init` object. OutcomesView omits it.

**How to avoid:** Add `credentials: 'include'` to the beacon `init` in `OutcomesView.tsx`. Do NOT try to make `authFetch` default `credentials: 'include'` for all calls — that's a refactor (forbidden under D-09) and could break other callers (e.g., cross-origin fetches that deliberately omit it).

### Pitfall 2: `visus absolute [0, 1]` vs `[0, 2]` — which is canonical?

**What goes wrong:** Temptation to "fix" the source back to `[0, 2]` to green the test.

**Why it happens:** The test comment "Phase 13 Plan 02 — OutcomesPanel CRT y-domain regression guard" suggests the test is the authority.

**How to avoid:** Read the source comment at `OutcomesPanel.tsx:56`: `// CRT: 0–800 µm clinical range. Visus logMAR: 0–1.0 covers 20/200→20/20 (admin feedback Apr-17).` The source was **intentionally** tightened after the test was written. Git log shows the change shipped in `668bfaf feat: v1.6 Outcomes Polish & Scale`. Admin feedback wins. Update the test to `[0, 1]`. Update the describe-block title text too (the `it` description says `[0, 2]`).

### Pitfall 3: MockBC's per-test reset vs global setup-file reset

**What goes wrong:** The current `MockBC.reset()` in `authFetchRefresh.test.ts`'s `beforeEach` clears `MockBC.instances`. If `tests/setup.ts` installs a global shim with its own channel registry, the per-test reset won't clear it — stale channels leak across tests.

**How to avoid:** The new global shim (Pattern 2) exposes a static `_reset()` method. Call it in a global `beforeEach` inside `tests/setup.ts`:
```typescript
import { beforeEach } from 'vitest';
beforeEach(() => { MockBroadcastChannel._reset(); });
```

### Pitfall 4: `<AuthProvider>` fetches `/api/auth/users/me` on mount

**What goes wrong:** `AuthContext.tsx:125-128` calls raw `fetch('/api/auth/users/me', ...)` inside a `useEffect` that runs whenever `user` changes. In `sessionTimers.test.tsx`, mounting `<AuthProvider>` with a seeded token → triggers this fetch → if `fetch` isn't stubbed, the promise hangs and the component re-renders with `displayName = ''`.

**How to avoid:** Stub `global.fetch` before rendering:
```typescript
vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(
  new Response(JSON.stringify({ user: { firstName: 'A', lastName: 'B', username: 'alice' } }), { status: 200 })
)));
```
Then for the refresh-failure path (UAT-AUTO-05), reassign the mock to return 401 with `{ error: 'Session cap exceeded' }`.

### Pitfall 5: `JSON.parse(init.body)` on a `BodyInit`

**What goes wrong:** `init.body` is typed `BodyInit | null` (string | Blob | FormData | ...). Test code does `JSON.parse(init!.body as string)` — works for POSTs with string bodies, but if any test ever sets a FormData body this will throw.

**How to avoid:** Keep the existing string-body assertion pattern (already shipped). For new tests, assert `typeof init.body === 'string'` before parsing.

## Code Examples

### Example 1: Silent-refresh smoke (UAT-AUTO-01) — EXISTING, reuse verbatim

```typescript
// Source: tests/authFetchRefresh.test.ts:77-93 (Test 1)
it('Test 1 — silently refreshes on 401 and retries original request once', async () => {
  sessionStorage.setItem('emd-token', 'old-token');
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(mockResp({ status: 401 }))
    .mockResolvedValueOnce(mockResp({ status: 200, body: { token: 'new-token', expiresAt: Date.now() + 600000 } }))
    .mockResolvedValueOnce(mockResp({ status: 200, body: { ok: true } }));
  vi.stubGlobal('fetch', fetchMock);

  const { authFetch } = await loadModule();
  const resp = await authFetch('/api/x');

  expect(resp.status).toBe(200);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  const refreshCalls = fetchMock.mock.calls.filter(([u]) => u === '/api/auth/refresh').length;
  expect(refreshCalls).toBe(1);
  expect(sessionStorage.getItem('emd-token')).toBe('new-token');
});
```
**Action:** Confirm in 21-02 commit message that this already satisfies UAT-AUTO-01. No new code.

### Example 2: Multi-tab coordination (UAT-AUTO-02) — NEW

```typescript
// tests/authFetchRefresh.test.ts — new it() inside existing describe
it('UAT-AUTO-02 — two tabs: only one refresh fires; other tab adopts new token', async () => {
  // Tab A loads authHeaders (constructs BC instance #1)
  sessionStorage.setItem('emd-token', 'old');
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(mockResp({ status: 401 }))
    .mockResolvedValueOnce(mockResp({ status: 200, body: { token: 'fresh', expiresAt: 9999 } }))
    .mockResolvedValueOnce(mockResp({ status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  const tabA = await loadModule();

  // Tab B opens a second BC on the same name BEFORE tabA.authFetch resolves
  const tabBChannel = new BroadcastChannel('emd-auth');
  let tabBToken: string | null = null;
  tabBChannel.addEventListener('message', (e) => {
    const m = e.data as { type: string; token?: string };
    if (m.type === 'refresh-success') tabBToken = m.token ?? null;
  });

  await tabA.authFetch('/api/x');

  // Tab B received the refresh-success broadcast
  expect(tabBToken).toBe('fresh');
  // Only one refresh call to the server
  expect(fetchMock.mock.calls.filter(([u]) => u === '/api/auth/refresh')).toHaveLength(1);
  tabBChannel.close();
});
```

### Example 3: Audit DB silence (UAT-AUTO-03) — Server-side unit

```typescript
// Source: server/auditMiddleware.ts:87-89 — SKIP_AUDIT_IF_STATUS constant
// Contract: /api/auth/refresh with status 200 is skipped; other statuses (401/403) are audited.
// A pure unit test is more valuable than an integration dance.
it('UAT-AUTO-03 — auditMiddleware skips /api/auth/refresh 200 but audits 401', () => {
  // Option A: export SKIP_AUDIT_IF_STATUS from auditMiddleware.ts and assert directly.
  // Option B: drive the middleware with fake req/res, assert no db.insert call for 200.
  // Recommendation: Option A is 3 lines; Option B needs better-sqlite3 mock scaffolding.
});
```
**Action:** Export `SKIP_AUDIT_IF_STATUS` (named export, one-line source change — justified as a test hook).

### Example 4: Idle-logout (UAT-AUTO-04) — NEW

```typescript
// tests/sessionTimers.test.tsx
import { render, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../src/context/AuthContext';

// Helper component surfaces user state to the test
function Probe() {
  const { user } = useAuth();
  return <div data-testid="user">{user?.username ?? 'null'}</div>;
}

it('UAT-AUTO-04 — idle 10 minutes logs user out', async () => {
  // Fake timers + seeded token + stubbed fetch for /api/auth/users/me
  const { getByTestId } = render(<AuthProvider><Probe /></AuthProvider>);
  // wait for user hydrate
  await act(async () => { await Promise.resolve(); });
  expect(getByTestId('user').textContent).toBe('alice');

  act(() => { vi.advanceTimersByTime(10 * 60 * 1000); });
  // performLogout clears sessionStorage synchronously
  expect(sessionStorage.getItem('emd-token')).toBeNull();
});
```

### Example 5: Absolute-cap re-auth (UAT-AUTO-05) — NEW (client side)

```typescript
// tests/sessionTimers.test.tsx or tests/authFetchRefresh.test.ts
it('UAT-AUTO-05 — refresh 401 "Session cap exceeded" redirects to /login', async () => {
  sessionStorage.setItem('emd-token', 'stale');
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(mockResp({ status: 401 }))                                     // original
    .mockResolvedValueOnce(mockResp({ status: 401, body: { error: 'Session cap exceeded' } })) // refresh denied
  );
  const { authFetch } = await loadModule();
  await authFetch('/api/x');
  expect(sessionStorage.getItem('emd-token')).toBeNull();
  expect(window.location.href).toBe('/login');
});
```

### Example 6: Zero-skip CI gate (TEST-04)

```json
// package.json scripts
{
  "scripts": {
    "test": "vitest run",
    "test:check-skips": "node scripts/check-skipped-tests.mjs",
    "test:ci": "npm run test:check-skips && npm run test"
  }
}
```

```javascript
// scripts/check-skipped-tests.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.test\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const SKIP_RE = /\b(describe|it|test)\.skip\s*\(/;
const REASON_RE = /^\s*\/\/\s*SKIP_REASON:/;
const files = walk('tests');
const violations = [];

for (const file of files) {
  const lines = readFileSync(file, 'utf-8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (SKIP_RE.test(lines[i])) {
      const prev = i > 0 ? lines[i - 1] : '';
      if (!REASON_RE.test(prev)) {
        violations.push(`${file}:${i + 1}  ${lines[i].trim()}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Skipped tests without SKIP_REASON comment:');
  for (const v of violations) console.error('  ' + v);
  process.exit(1);
}
console.log(`OK: ${files.length} test files, no unlabelled .skip`);
```

**Current state** (verified via Grep): zero `.skip` usages in `tests/**`. The gate starts green.

### Example 7: Source one-liner for TEST-03

```typescript
// src/components/outcomes/OutcomesView.tsx — around line 171
authFetch('/api/audit/events/view-open', {
  method: 'POST',
  body: JSON.stringify(body),
  headers: { 'Content-Type': 'application/json' },
  keepalive: true,
  credentials: 'include',   // NEW — Phase 20 cookie-auth contract (TEST-03)
}).catch(() => { /* beacon is fire-and-forget (D-03) */ });
```

## Runtime State Inventory

**Not applicable** — this phase makes no renames, migrations, or changes to persistent state. Scope is test code + one-line source edit. No runtime state (databases, OS-registered tasks, secrets, build artifacts) is touched.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| vitest | All | ✓ | per `package.json` pin | — |
| @testing-library/react | `*.test.tsx` | ✓ | per pin | — |
| jsdom | RTL tests via `// @vitest-environment jsdom` docblock | ✓ | vitest bundled | — |
| Node 18+ (BroadcastChannel global) | `tests/setup.ts` typeof-check | ✓ | node ≥18 has built-in BC | In-memory shim covers jsdom anyway |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

> `.planning/config.json` — checked; `workflow.nyquist_validation` status not explicitly `false` → including this section.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (see `vitest.config.ts`) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/<file>.test.ts --reporter=dot` |
| Full suite command | `npm test` (= `vitest run`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-01 | visus absolute y-domain = [0, 1] | unit | `npx vitest run tests/outcomesPanelCrt.test.tsx -t "visus absolute"` | ✅ (test needs edit) |
| TEST-02 | no-metric-prop defaults to visus [0, 1] | unit | `npx vitest run tests/outcomesPanelCrt.test.tsx -t "backward compat"` | ✅ (test needs edit) |
| TEST-03 | beacon POST sends credentials:'include' | integration | `npx vitest run tests/OutcomesPage.test.tsx -t "fires audit beacon POST"` | ✅ (source edit greens) |
| TEST-04 | No `.skip` without SKIP_REASON | static | `npm run test:check-skips` | ❌ (Wave 0: create `scripts/check-skipped-tests.mjs`) |
| UAT-AUTO-01 | silent refresh 401 → retry 200 | unit | `npx vitest run tests/authFetchRefresh.test.ts -t "Test 1"` | ✅ (already passing — formalize) |
| UAT-AUTO-02 | two BC tabs — single refresh, other adopts | unit | `npx vitest run tests/authFetchRefresh.test.ts -t "UAT-AUTO-02"` | ❌ (Wave 0: new it + shim promoted) |
| UAT-AUTO-03 | `SKIP_AUDIT_IF_STATUS['/api/auth/refresh'].has(200)` | unit | `npx vitest run tests/auditMiddleware.test.ts -t "SKIP_AUDIT_IF_STATUS"` | Partial — `auditMiddleware.test.ts` exists; may need it() added |
| UAT-AUTO-04 | Idle 10 min → sessionStorage cleared | integration (RTL + fake timers) | `npx vitest run tests/sessionTimers.test.tsx -t "idle"` | ❌ (Wave 0: new file) |
| UAT-AUTO-05 | refresh 401 "Session cap exceeded" → /login | unit | `npx vitest run tests/sessionTimers.test.tsx -t "absolute cap"` or extend authFetchRefresh | ❌ (Wave 0: new it) |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/<touched-file>.test.ts --reporter=dot` (<1s typical)
- **Per wave merge:** `npm test` — full suite (~15s historically)
- **Phase gate:** Full suite green + `npm run test:check-skips` green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/setup.ts` — create with BroadcastChannel shim (Pattern 2 above) and `_reset()` hook
- [ ] `vitest.config.ts` — add `setupFiles: ['tests/setup.ts']` line
- [ ] `tests/sessionTimers.test.tsx` — create (UAT-AUTO-04/05)
- [ ] `scripts/check-skipped-tests.mjs` — create (TEST-04)
- [ ] `package.json` — add `test:check-skips` and `test:ci` scripts
- [ ] Export `INACTIVITY_TIMEOUT` from `src/context/AuthContext.tsx` (justified: test hook, not a refactor; one-word `export` prefix)
- [ ] Export `SKIP_AUDIT_IF_STATUS` from `server/auditMiddleware.ts` (same justification)

## Security Domain

Phase scope is test code + two one-line source edits. ASVS / STRIDE coverage for the behaviors under test was satisfied in Phase 20 (see `20-VERIFICATION.md`). This phase does not introduce new attack surface; it automates existing contracts into the test suite.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (tested) | JWT access token + refresh cookie (Phase 20 contract) |
| V3 Session Management | yes (tested) | INACTIVITY_TIMEOUT (client) + refreshAbsoluteCapMs (server) |
| V5 Input Validation | no (not touched) | — |
| V6 Cryptography | no (not touched) | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation | Test coverage added |
|---------|--------|---------------------|---------------------|
| T-20-19 audit-log DoS via refresh flood | Denial of service | `SKIP_AUDIT_IF_STATUS` on `/api/auth/refresh` 200 | UAT-AUTO-03 |
| T-20-21 failed-refresh attack invisible in audit | Repudiation | Non-200 refresh NOT skipped | UAT-AUTO-03 (negative assertion — 401 IS audited) |
| T-20-23 concurrent refresh storms | DoS / race | Single-flight module lock | UAT-AUTO-01 (already); UAT-AUTO-02 (multi-tab) |
| D-25 10-min idle regression | authn bypass | Frozen INACTIVITY_TIMEOUT + static-source grep | UAT-AUTO-04 + existing grep assertion |
| Absolute cap bypass | authn bypass | Server-side `ageMs > refreshAbsoluteCapMs → 401` | UAT-AUTO-05 |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `[0, 2]` visus absolute y-domain | `[0, 1]` (logMAR 0–1.0 covers 20/200→20/20) | v1.6 `668bfaf` commit, Apr-17 admin feedback | TEST-01/02 test assertions out of date |
| Raw `fetch` for audit beacons | `authFetch` + `credentials: 'include'` (Phase 20 cookie auth) | Phase 20 (v1.8) | TEST-03 source missed the `credentials` addition |
| `vi.stubGlobal('BroadcastChannel', MockBC)` per-file | Global shim in `tests/setup.ts` (this phase) | 21-02 | Centralizes shim; D-03 |

**Deprecated/outdated:**
- Any future developer consulting `tests/outcomesPanelCrt.test.tsx` line 101-122 comments will see `[0, 2]` — those comments need updating alongside the assertion change.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Exporting `SKIP_AUDIT_IF_STATUS` and `INACTIVITY_TIMEOUT` (adding `export` keyword) counts as a "minimal scoped source fix" under D-09, not a refactor | Wave 0 Gaps | If planner disagrees, UAT-AUTO-03/04 must drive assertions via static-text grep of source files (same pattern as Phase 20 D-25 regression guard — viable fallback) |
| A2 | Current authFetchRefresh `MockBC` can be left in place when `tests/setup.ts` is added; the local `vi.stubGlobal` wins | Pitfall 3 | Low — if cross-contamination is observed, delete the local MockBC and rely on the global shim (scoped to Plan 21-02) |
| A3 | The `/api/auth/users/me` fetch in AuthProvider doesn't block idle-logout timer scheduling — timer is scheduled in a separate useEffect gated on `user`, not on `displayName` | Pitfall 4 | Low — verified via reading AuthContext.tsx:170-186; timer effect depends on `user`, not `displayName` |

**Note:** All three assumptions are about mechanism, not contract. None carry compliance/security risk; all are verifiable at plan-execution time with a 30-second experiment.

## Open Questions

1. **UAT-AUTO-01 — formalize via new test or re-label existing?**
   - What we know: `Test 1` of `tests/authFetchRefresh.test.ts` already asserts the exact contract (401 → refresh → retry → 200).
   - What's unclear: does "automate" mean add a NEW test, or is tagging the existing one sufficient?
   - Recommendation: Plan 21-02 adds a comment `// UAT-AUTO-01: replaces Phase 20 UAT item 1` to Test 1, plus **one new integration-level it()** that mounts a component issuing an authenticated request to prove the wrapper works end-to-end. Both satisfy the requirement; the new one proves the automation scales beyond the unit.

2. **UAT-AUTO-03 — unit level or server integration?**
   - What we know: `SKIP_AUDIT_IF_STATUS` is a server-side constant. Full integration requires spinning up the Express app and tailing `audit.db`.
   - What's unclear: is a unit-level assertion on the constant + a pure-function audit-middleware test sufficient?
   - Recommendation: Yes — the CONTEXT "likely unit-level on authFetch path since full server integration may be impractical in vitest" confirms. Export `SKIP_AUDIT_IF_STATUS`, write a 3-line unit test, add one `tests/auditMiddleware.test.ts` case that drives the middleware with a fake `/api/auth/refresh` req/res and asserts `auditDb.insert` not called for 200 / called for 401.

3. **Grep gate vs AST parser for TEST-04**
   - What we know: Grep is cheap and correct for current usage (zero `.skip` found).
   - What's unclear: could grep miss weird constructs like `it['skip']('...')` or a user-aliased `const skip = it.skip`?
   - Recommendation: Accept the grep limitation per D-11 (explicit handoff to Phase 23 ESLint rule). Document the known evasions in the script's header comment.

## Sources

### Primary (HIGH confidence)

- [VERIFIED: live `npx vitest run` on branch] — exact failure messages quoted in this doc (`expected '1' to be '2'` ×2, `expected undefined to be 'include'` ×1)
- [VERIFIED: direct file read] `src/components/outcomes/OutcomesPanel.tsx:49-76` — `yDomain()` function
- [VERIFIED: direct file read] `src/components/outcomes/OutcomesView.tsx:158-180` — audit beacon useEffect
- [VERIFIED: direct file read] `src/services/authHeaders.ts` (full 175 LOC) — authFetch, refreshAccessToken, serverLogout, broadcastLogout
- [VERIFIED: direct file read] `src/context/AuthContext.tsx:1-200` — INACTIVITY_TIMEOUT=10min, WARNING_BEFORE=1min, performLogout, timer effects
- [VERIFIED: direct file read] `server/auditMiddleware.ts:55-105` — SKIP_AUDIT_PATHS + SKIP_AUDIT_IF_STATUS
- [VERIFIED: direct file read] `server/authApi.ts:361-370` — absolute-cap enforcement path
- [VERIFIED: direct file read] `config/settings.yaml:11-13` — `refreshTokenTtlMs: 28800000`, `refreshAbsoluteCapMs: 43200000`
- [VERIFIED: direct file read] `tests/authFetchRefresh.test.ts` (all 290 LOC) — canonical mock patterns including `MockBC`
- [VERIFIED: direct file read] `tests/outcomesPanelCrt.test.tsx` (full 170 LOC) — failing assertions
- [VERIFIED: direct file read] `tests/OutcomesPage.test.tsx` (full 762 LOC) — failing test at line 311-342
- [VERIFIED: Grep across `tests/**`] — zero existing `.skip` usages
- [VERIFIED: `git log --oneline -- src/components/outcomes/OutcomesPanel.tsx`] — `[0,1]` shipped in `668bfaf` v1.6 feat
- [CITED: .planning/milestones/v1.8-phases/20-jwt-refresh-flow-session-resilience/20-04-SUMMARY.md] — Phase 20 client refresh contract
- [CITED: .planning/phases/21-test-uat-polish/21-CONTEXT.md] — D-01..D-13 locked decisions

### Secondary (MEDIUM confidence)

- None required — all claims grounded in primary-source file reads or live test output.

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**
- Failing-test root causes: HIGH — quoted verbatim from live vitest run
- Standard stack: HIGH — all tools already in repo, no new deps
- BroadcastChannel shim design: HIGH — extension of existing MockBC, matches MDN spec semantics
- Fake-timer patterns: HIGH — standard vitest API; direct code exists for the constants (INACTIVITY_TIMEOUT)
- Grep gate: HIGH — simple script; no existing .skip to grandfather
- UAT-AUTO-03 unit vs integration: MEDIUM — recommendation is sound, final shape left for planner

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (test infra changes slowly; only risk is if Phase 22 lands source refactors before Phase 21 executes)
