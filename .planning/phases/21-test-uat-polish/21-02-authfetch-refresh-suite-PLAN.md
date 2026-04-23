---
phase: 21-test-uat-polish
plan: 02
type: execute
wave: 2
depends_on: ["21-01"]
files_modified:
  - tests/setup.ts
  - tests/authFetchRefreshSuite.test.ts
  - tests/authFetchRefresh.test.ts
  - server/auditMiddleware.ts
  - vitest.config.ts
autonomous: true
requirements: [UAT-AUTO-01, UAT-AUTO-02, UAT-AUTO-03]
gap_closure: false

must_haves:
  truths:
    - "A new test asserts authFetch silently refreshes on 401 and retries original request once (UAT-AUTO-01 integration-level smoke)"
    - "A new test simulates two tabs via BroadcastChannel('emd-auth') and asserts single-flight refresh lock with the non-poster tab receiving refresh-success broadcast"
    - "A new test asserts SKIP_AUDIT_IF_STATUS['/api/auth/refresh'].has(200) === true and .has(401) === false (audit silence contract)"
    - "tests/setup.ts installs a Map-backed cross-instance BroadcastChannel shim wired via vitest.config.ts setupFiles"
    - "MockBC class in authFetchRefresh.test.ts either remains scoped to that file (per D-09, RESEARCH Assumption A2) or is removed in favor of the global shim — decision documented in SUMMARY"
  artifacts:
    - path: "tests/setup.ts"
      provides: "Global MockBroadcastChannel shim with cross-instance post + static _reset()"
      contains: "class MockBroadcastChannel"
    - path: "tests/authFetchRefreshSuite.test.ts"
      provides: "UAT-AUTO-01/02/03 test cases"
      contains: "UAT-AUTO-01"
    - path: "server/auditMiddleware.ts"
      provides: "SKIP_AUDIT_IF_STATUS exported for unit assertion"
      contains: "export const SKIP_AUDIT_IF_STATUS"
    - path: "vitest.config.ts"
      provides: "setupFiles wiring for tests/setup.ts"
      contains: "tests/setup.ts"
  key_links:
    - from: "vitest.config.ts"
      to: "tests/setup.ts"
      via: "setupFiles: ['tests/setup.ts']"
      pattern: "setupFiles.*setup\\.ts"
    - from: "tests/authFetchRefreshSuite.test.ts"
      to: "server/auditMiddleware.ts"
      via: "import { SKIP_AUDIT_IF_STATUS } from '../server/auditMiddleware'"
      pattern: "SKIP_AUDIT_IF_STATUS"
    - from: "tests/authFetchRefreshSuite.test.ts"
      to: "BroadcastChannel shim"
      via: "new BroadcastChannel('emd-auth')"
      pattern: "BroadcastChannel\\('emd-auth'\\)"
---

<objective>
Automate the three authFetch-refresh Phase 20 UAT items (UAT-AUTO-01..03) into vitest:
silent refresh 401→retry, two-tab BroadcastChannel single-flight, and audit-DB silence
on 200 refresh. Promote the existing MockBC shim (authFetchRefresh.test.ts:23-36) into
a cross-instance global shim at `tests/setup.ts` per CONTEXT D-03, wire into
`vitest.config.ts` via `setupFiles`, and add one `export` to `server/auditMiddleware.ts`
so UAT-AUTO-03 can assert the SKIP_AUDIT_IF_STATUS contract directly (D-09 minimal
scoped; RESEARCH Assumption A1).

Purpose: Replaces 3 of the 5 Phase 20 manual UAT checklist items with automated tests
that run on every CI build, preventing silent regression of the session-resilience
and audit-PII-hardening contracts.
Output: 1 new setup file, 1 new test file, 1 setup-file existing-test edit, 1
one-word source export addition, 1 vitest.config.ts edit.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/21-test-uat-polish/21-CONTEXT.md
@.planning/phases/21-test-uat-polish/21-RESEARCH.md
@.planning/phases/21-test-uat-polish/21-VALIDATION.md
@.planning/phases/21-test-uat-polish/21-01-fix-failing-tests-PLAN.md
@tests/authFetchRefresh.test.ts
@src/services/authHeaders.ts
@server/auditMiddleware.ts
@vitest.config.ts

<interfaces>
From tests/authFetchRefresh.test.ts:23-36 (existing MockBC — model to extend):
```typescript
class MockBC {
  static instances: MockBC[] = [];
  listeners: Array<(e: MessageEvent) => void> = [];
  constructor(public name: string) { MockBC.instances.push(this); }
  postMessage(_data: unknown) { /* no-op; tests use fire() */ }
  addEventListener(_t: string, fn: (e: MessageEvent) => void) { this.listeners.push(fn); }
  removeEventListener() {}
  close() {}
  fire(data: unknown) { for (const l of this.listeners) l({ data } as MessageEvent); }
  static reset() { MockBC.instances = []; }
}
```

From tests/authFetchRefresh.test.ts:47-50 (canonical module-isolation pattern):
```typescript
async function loadModule() {
  vi.resetModules();
  return await import('../src/services/authHeaders');
}
```

From server/auditMiddleware.ts:85-95 (SKIP_AUDIT_IF_STATUS — needs export keyword):
```typescript
const SKIP_AUDIT_IF_STATUS: Record<string, Set<number>> = {
  '/api/auth/refresh': new Set([200]),
};
// Contract: 200-refresh is silent (audit DoS prevention, T-20-19);
// 401/403 refresh IS audited (repudiation guard, T-20-21).
```

Proposed global shim for tests/setup.ts (per RESEARCH Pattern 2, verbatim):
```typescript
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
      if (peer === this || peer.closed) continue;
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
  static _reset(): void { MockBroadcastChannel.channels.clear(); }
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create tests/setup.ts with cross-instance BroadcastChannel shim + wire in vitest.config.ts</name>
  <files>tests/setup.ts, vitest.config.ts</files>
  <read_first>
    - tests/authFetchRefresh.test.ts lines 23-36 (existing MockBC — model)
    - .planning/phases/21-test-uat-polish/21-RESEARCH.md (Pattern 2 — canonical shim; Pitfall 3 — reset strategy; Assumption A2)
    - .planning/phases/21-test-uat-polish/21-CONTEXT.md (D-03, D-04 — shim requirements)
    - vitest.config.ts (current shape — where setupFiles goes)
  </read_first>
  <behavior>
    - tests/setup.ts exists, exports nothing (side-effect file), installs `globalThis.BroadcastChannel` ONLY if undefined (typeof check — RESEARCH Pattern 2)
    - MockBroadcastChannel.postMessage fires `message` events on every OTHER instance sharing the same channel name in the same process; never fires on the poster itself (MDN spec)
    - MockBroadcastChannel exposes a static `_reset()` that clears the global channel registry
    - A global `beforeEach` in tests/setup.ts calls `MockBroadcastChannel._reset()` to prevent cross-test leakage (Pitfall 3)
    - vitest.config.ts includes `setupFiles: ['tests/setup.ts']` inside its `test:` block
    - Existing authFetchRefresh.test.ts continues to pass (per RESEARCH Assumption A2: the file's own vi.stubGlobal('BroadcastChannel', MockBC) overrides the global shim for that file's tests, so no breakage)
  </behavior>
  <action>
    1. Create tests/setup.ts. Top comment:
       `// v1.9 Phase 21 (D-03): Global BroadcastChannel shim for jsdom. Cross-instance single-process post semantics per MDN. Installed only if globalThis.BroadcastChannel is undefined so real browser envs and Node 18+ pass through untouched.`
    2. Paste the MockBroadcastChannel class from the `<interfaces>` block verbatim.
    3. Append the install guard:
       ```typescript
       if (typeof globalThis.BroadcastChannel === 'undefined') {
         (globalThis as unknown as { BroadcastChannel: typeof MockBroadcastChannel }).BroadcastChannel = MockBroadcastChannel;
       }
       ```
    4. Append global reset hook:
       ```typescript
       import { beforeEach } from 'vitest';
       beforeEach(() => { MockBroadcastChannel._reset(); });
       ```
       (Keep the import at the TOP of the file; JS hoisting is fine but readability matters.)
    5. Export the class so tests that need to inspect state can import it: `export { MockBroadcastChannel };`
    6. Open vitest.config.ts. Inside the `test: { ... }` block, add `setupFiles: ['tests/setup.ts'],`. If `setupFiles` already exists, extend its array; do not overwrite.
    7. Run the full existing suite to confirm no regression (Assumption A2 — existing MockBC file should still pass because its per-file `vi.stubGlobal('BroadcastChannel', MockBC)` wins for that file).
    8. Commit: `test(21-02): add global BroadcastChannel shim in tests/setup.ts (D-03)`.
  </action>
  <verify>
    <automated>npx vitest run tests/authFetchRefresh.test.ts --reporter=dot && npm test</automated>
  </verify>
  <acceptance_criteria>
    - `tests/setup.ts` contains `class MockBroadcastChannel` (grep count ≥ 1)
    - `tests/setup.ts` contains `_reset` and `channels = new Map` (grep each ≥ 1)
    - `vitest.config.ts` contains `tests/setup.ts` inside a setupFiles array
    - `npx vitest run tests/authFetchRefresh.test.ts` exits 0 (no regression)
    - `npm test` exits 0 (full suite still green)
    - Post-shim, in a fresh test file, `new BroadcastChannel('x')` succeeds without needing vi.stubGlobal
  </acceptance_criteria>
  <done>Global BroadcastChannel shim live; existing tests unaffected; downstream tests can use `new BroadcastChannel(name)` directly.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add `export` keyword to SKIP_AUDIT_IF_STATUS in server/auditMiddleware.ts (test-hook)</name>
  <files>server/auditMiddleware.ts</files>
  <read_first>
    - server/auditMiddleware.ts lines 55-105 (SKIP_AUDIT_PATHS + SKIP_AUDIT_IF_STATUS definitions)
    - .planning/phases/21-test-uat-polish/21-RESEARCH.md (Example 3 — UAT-AUTO-03 unit-level approach; Assumption A1 — minimal scoped source fix justification; Wave 0 Gaps)
    - .planning/phases/21-test-uat-polish/21-CONTEXT.md (D-09 minimal scoped)
  </read_first>
  <behavior>
    - `SKIP_AUDIT_IF_STATUS` is a named export from `server/auditMiddleware.ts`
    - No runtime semantics changed — the constant value and its usage within the middleware remain identical
    - The change is literally `const SKIP_AUDIT_IF_STATUS` → `export const SKIP_AUDIT_IF_STATUS`
    - A trailing comment documents the export justification: `// Exported for v1.9 Phase 21 UAT-AUTO-03 unit assertion (audit-silence contract regression guard)`
  </behavior>
  <action>
    1. Open server/auditMiddleware.ts. Find the `const SKIP_AUDIT_IF_STATUS: Record<string, Set<number>> = { ... };` declaration (around line 87-89 per RESEARCH).
    2. Add the `export` keyword immediately before `const`.
    3. Add a one-line comment ABOVE the declaration:
       `// Exported for v1.9 Phase 21 UAT-AUTO-03 unit assertion (audit-silence contract regression guard per D-09 minimal-scoped source fix).`
    4. Do NOT refactor, rename, or alter the object contents. No other source change.
    5. Run the existing auditMiddleware test file (if present) to confirm no regression.
    6. Commit: `fix(21-02): export SKIP_AUDIT_IF_STATUS for UAT-AUTO-03 unit assertion (minimal D-09)`.
  </action>
  <verify>
    <automated>npx vitest run tests/auditMiddleware.test.ts --reporter=dot</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "^export const SKIP_AUDIT_IF_STATUS" server/auditMiddleware.ts` returns 1
    - `grep -c "UAT-AUTO-03" server/auditMiddleware.ts` returns ≥ 1
    - `git diff server/auditMiddleware.ts | grep -c '^+'` shows only the export keyword + comment lines (no other changes)
    - `npx vitest run tests/auditMiddleware.test.ts` exits 0 (no regression)
  </acceptance_criteria>
  <done>SKIP_AUDIT_IF_STATUS importable from tests; zero runtime change.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Create tests/authFetchRefreshSuite.test.ts — UAT-AUTO-01/02/03 cases</name>
  <files>tests/authFetchRefreshSuite.test.ts</files>
  <read_first>
    - tests/authFetchRefresh.test.ts (full file — canonical mock patterns, loadModule helper, setCookie helper, mockResp helper — reuse verbatim)
    - src/services/authHeaders.ts (full file — understand authFetch + broadcastRefreshSuccess behavior)
    - server/auditMiddleware.ts (SKIP_AUDIT_IF_STATUS shape after Task 2)
    - tests/setup.ts (shim available after Task 1)
    - .planning/phases/21-test-uat-polish/21-RESEARCH.md (Examples 1, 2, 3 — verbatim test bodies; Pitfall 5 — body-type guard)
    - .planning/phases/21-test-uat-polish/21-CONTEXT.md (D-01 vi.stubGlobal, D-04 two-instance tab sim)
    - .planning/phases/21-test-uat-polish/21-VALIDATION.md (Per-Task Verification Map rows 21-02-01..03)
  </read_first>
  <behavior>
    - Test file has `// @vitest-environment jsdom` docblock at top (React-free but needs sessionStorage)
    - Three it() cases, each tagged in the title with the requirement ID:
      * `UAT-AUTO-01: silent refresh — 401 triggers refresh, original request retries once, token replaced`
      * `UAT-AUTO-02: two tabs — single-flight refresh; non-poster tab receives refresh-success broadcast with new token`
      * `UAT-AUTO-03: auditMiddleware skips /api/auth/refresh 200; audits 401` (asserts SKIP_AUDIT_IF_STATUS contract)
    - helper `loadModule()` uses `vi.resetModules(); return await import('../src/services/authHeaders');` (RESEARCH Pattern 1)
    - helper `mockResp({ status, body })` builds a `new Response(JSON.stringify(body ?? {}), { status })`
    - `beforeEach`: clear sessionStorage, stub fetch via vi.stubGlobal
    - `afterEach`: vi.unstubAllGlobals()
    - UAT-AUTO-01 asserts: fetchMock called 3× (original 401, refresh 200, retry 200); refreshCalls to '/api/auth/refresh' === 1; sessionStorage emd-token === 'new-token'
    - UAT-AUTO-02 asserts: after authFetch resolves on tab A, the tabB listener captured `{ type: 'refresh-success', token: 'fresh' }`; only one call to '/api/auth/refresh'; tabBChannel.close() cleanup
    - UAT-AUTO-03 asserts: imports `SKIP_AUDIT_IF_STATUS` from `../server/auditMiddleware`; `SKIP_AUDIT_IF_STATUS['/api/auth/refresh'].has(200) === true`; `.has(401) === false`; `.has(403) === false`
  </behavior>
  <action>
    1. Create tests/authFetchRefreshSuite.test.ts. Docblock first line: `// @vitest-environment jsdom`.
    2. Imports:
       ```typescript
       import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
       import { SKIP_AUDIT_IF_STATUS } from '../server/auditMiddleware';
       ```
    3. Helpers (copy verbatim from tests/authFetchRefresh.test.ts):
       - `loadModule()` (RESEARCH Pattern 1)
       - `mockResp({ status, body })` builder
       - Any `setCookie` helper if referenced
    4. Write UAT-AUTO-01 test body verbatim from RESEARCH Example 1 (lines 329-345 of RESEARCH.md). Title: `'UAT-AUTO-01: silent refresh — 401 triggers refresh and retries original request once'`. Assertions:
       ```typescript
       expect(resp.status).toBe(200);
       expect(fetchMock).toHaveBeenCalledTimes(3);
       const refreshCalls = fetchMock.mock.calls.filter(([u]) => u === '/api/auth/refresh').length;
       expect(refreshCalls).toBe(1);
       expect(sessionStorage.getItem('emd-token')).toBe('new-token');
       ```
    5. Write UAT-AUTO-02 test body verbatim from RESEARCH Example 2 (lines 353-378 of RESEARCH.md). Title: `'UAT-AUTO-02: two tabs — single-flight refresh; non-poster tab receives refresh-success broadcast'`. KEY: use `new BroadcastChannel('emd-auth')` (relies on Task 1 shim); register listener BEFORE calling `tabA.authFetch`. Assert `tabBToken === 'fresh'` and refresh call count === 1. Always `tabBChannel.close()`.
    6. Write UAT-AUTO-03 as a pure unit assertion. Title: `'UAT-AUTO-03: auditMiddleware SKIP_AUDIT_IF_STATUS skips /api/auth/refresh 200 but audits 401'`. Body:
       ```typescript
       expect(SKIP_AUDIT_IF_STATUS['/api/auth/refresh']).toBeInstanceOf(Set);
       expect(SKIP_AUDIT_IF_STATUS['/api/auth/refresh'].has(200)).toBe(true);
       expect(SKIP_AUDIT_IF_STATUS['/api/auth/refresh'].has(401)).toBe(false);
       expect(SKIP_AUDIT_IF_STATUS['/api/auth/refresh'].has(403)).toBe(false);
       ```
       Header comment block cites T-20-19 (audit-DoS mitigation) and T-20-21 (repudiation guard: failed refreshes are NOT silenced).
    7. Add tag comments above Test 1 of tests/authFetchRefresh.test.ts (existing) cross-referencing UAT-AUTO-01: `// UAT-AUTO-01 is ALSO covered in tests/authFetchRefreshSuite.test.ts — this file retains unit-level coverage per RESEARCH Open Question 1.` This is a non-code comment; does not affect test logic.
    8. Run the new file in isolation, then run the full suite.
    9. Commit: `test(21-02): add UAT-AUTO-01/02/03 automation in authFetchRefreshSuite`.
  </action>
  <verify>
    <automated>npx vitest run tests/authFetchRefreshSuite.test.ts --reporter=dot && npm run test:ci</automated>
  </verify>
  <acceptance_criteria>
    - `npx vitest run tests/authFetchRefreshSuite.test.ts` exits 0 with 3 passing it() cases
    - `grep -c "UAT-AUTO-01" tests/authFetchRefreshSuite.test.ts` returns ≥ 1
    - `grep -c "UAT-AUTO-02" tests/authFetchRefreshSuite.test.ts` returns ≥ 1
    - `grep -c "UAT-AUTO-03" tests/authFetchRefreshSuite.test.ts` returns ≥ 1
    - `grep -c "BroadcastChannel('emd-auth')" tests/authFetchRefreshSuite.test.ts` returns ≥ 1
    - `grep -c "SKIP_AUDIT_IF_STATUS" tests/authFetchRefreshSuite.test.ts` returns ≥ 1
    - `npm run test:ci` exits 0 (full suite green, skip-gate green)
    - No new source file outside Task 2's one-word export was modified
  </acceptance_criteria>
  <done>UAT-AUTO-01/02/03 automated; all three pass under full suite; Phase 20 UAT items 1/2/3 deletable.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| test process ↔ module-scoped state in authHeaders.ts | vi.resetModules() isolates the refresh promise / broadcast channel per test |
| test process ↔ global BroadcastChannel | Test-only shim; production code path untouched |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-21-02 | Repudiation | server/auditMiddleware.ts SKIP_AUDIT_IF_STATUS contract | mitigate | UAT-AUTO-03 unit test guards against regressions that would silence failed refreshes (401/403) — preventing attacker-useful repudiation of brute-force refresh attempts. Severity: medium (PII hardening regression guard). |
| T-21-03 | Denial of Service | session refresh storm | mitigate | UAT-AUTO-02 two-tab test guards the single-flight lock; regression would allow every open tab to hit /api/auth/refresh concurrently on any 401. Severity: medium. |
| T-21-04 | Tampering | BroadcastChannel shim leaks across tests | mitigate | MockBroadcastChannel._reset() called in global beforeEach per RESEARCH Pitfall 3. Severity: low (test hygiene). |
</threat_model>

<verification>
- `npx vitest run tests/authFetchRefreshSuite.test.ts` → 3 passing
- `npx vitest run tests/authFetchRefresh.test.ts` → still green (no regression from global shim)
- `npm run test:ci` → full suite + skip-gate green
- `grep -rn "BroadcastChannel" tests/setup.ts` → shim present
- `grep "^export const SKIP_AUDIT_IF_STATUS" server/auditMiddleware.ts` → match
</verification>

<success_criteria>
- 3 new automated tests replace Phase 20 UAT items 1, 2, 3
- BroadcastChannel shim is global and reset per-test
- Source changes are minimal: 1 export keyword + 1 comment in server/auditMiddleware.ts
</success_criteria>

<output>
After completion, create `.planning/phases/21-test-uat-polish/21-02-SUMMARY.md` documenting:
- Decision: new file vs extend (chose new per RESEARCH Primary recommendation)
- MockBC retention decision (kept per Assumption A2) with evidence full suite stayed green
- Per-test assertions traced to T-20-19/T-20-21/T-20-23
</output>
