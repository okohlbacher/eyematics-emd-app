---
phase: 21-test-uat-polish
plan: 03
type: execute
wave: 3
depends_on: ["21-02"]
files_modified:
  - tests/sessionTimers.test.tsx
  - src/context/AuthContext.tsx
autonomous: true
requirements: [UAT-AUTO-04, UAT-AUTO-05]
gap_closure: false

must_haves:
  truths:
    - "A new test asserts 10-minute inactivity triggers performLogout (sessionStorage emd-token cleared, broadcast sent) — imports INACTIVITY_TIMEOUT constant, no magic number"
    - "A new test asserts refresh 401 'Session cap exceeded' clears sessionStorage and redirects to /login (absolute-cap enforcement)"
    - "Tests use vi.useFakeTimers + vi.setSystemTime per CONTEXT D-05; afterEach calls vi.useRealTimers() per D-06"
    - "INACTIVITY_TIMEOUT is exported from src/context/AuthContext.tsx so the test imports rather than duplicating the magic number"
    - "<AuthProvider> /api/auth/users/me fetch is stubbed before render (RESEARCH Pitfall 4)"
  artifacts:
    - path: "tests/sessionTimers.test.tsx"
      provides: "UAT-AUTO-04 idle-logout + UAT-AUTO-05 absolute-cap tests"
      contains: "UAT-AUTO-04"
    - path: "src/context/AuthContext.tsx"
      provides: "Exported INACTIVITY_TIMEOUT constant"
      contains: "export const INACTIVITY_TIMEOUT"
  key_links:
    - from: "tests/sessionTimers.test.tsx"
      to: "src/context/AuthContext.tsx"
      via: "import { AuthProvider, useAuth, INACTIVITY_TIMEOUT }"
      pattern: "INACTIVITY_TIMEOUT"
    - from: "tests/sessionTimers.test.tsx"
      to: "BroadcastChannel shim (tests/setup.ts from 21-02)"
      via: "broadcastLogout() in performLogout triggers shim"
      pattern: "BroadcastChannel"
---

<objective>
Automate the two session-timer Phase 20 UAT items: UAT-AUTO-04 (10-min idle-logout)
and UAT-AUTO-05 (absolute-cap re-auth). Uses fake timers + React Testing Library
rendering `<AuthProvider>` for UAT-AUTO-04; uses the authFetch-refresh harness
with a 401 "Session cap exceeded" response for UAT-AUTO-05. Adds a one-word `export`
to `src/context/AuthContext.tsx:64` so the test can import `INACTIVITY_TIMEOUT`
rather than hardcoding 600000 (RESEARCH Anti-Patterns).

Purpose: Closes the last two Phase 20 UAT items. After this plan lands, the
`20-HUMAN-UAT.md` manual checklist items UAT 4 and UAT 5 can be marked
"automated by v1.9 Phase 21".
Output: 1 new test file, 1 one-word source export addition.
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
@.planning/phases/21-test-uat-polish/21-02-authfetch-refresh-suite-PLAN.md
@src/context/AuthContext.tsx
@src/services/authHeaders.ts
@server/authApi.ts
@config/settings.yaml
@tests/authFetchRefresh.test.ts
@tests/setup.ts

<interfaces>
From src/context/AuthContext.tsx (per RESEARCH Primary sources):
```typescript
// Line 64 — currently: const INACTIVITY_TIMEOUT = 10 * 60 * 1000;
// Needs:            export const INACTIVITY_TIMEOUT = 10 * 60 * 1000;

// Line 125-128 — raw fetch('/api/auth/users/me') inside useEffect triggered on user change
// MUST be stubbed in tests before render (RESEARCH Pitfall 4)

// Lines 170-186 — idle timer effect: depends on `user`, schedules setTimeout(performLogout, INACTIVITY_TIMEOUT)
// performLogout: sessionStorage.removeItem('emd-token') + broadcastLogout() + navigate('/login')
```

From server/authApi.ts:361-370 (absolute-cap enforcement path — server-side; client sees 401):
```typescript
// if (ageMs > settings.refreshAbsoluteCapMs) {
//   return res.status(401).json({ error: 'Session cap exceeded' });
// }
```

From config/settings.yaml:11-13:
```yaml
auth:
  refreshTokenTtlMs: 28800000      # 8h
  refreshAbsoluteCapMs: 43200000   # 12h
```

Fake-timer template (per RESEARCH Pattern 4):
```typescript
beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'],
  });
  vi.setSystemTime(new Date('2026-04-23T10:00:00Z'));
  sessionStorage.clear();
  sessionStorage.setItem('emd-token', buildTestJwt({ sub: 'alice', role: 'researcher' }));
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(
    new Response(JSON.stringify({ user: { firstName: 'A', lastName: 'B', username: 'alice' } }), { status: 200 })
  )));
});
afterEach(() => {
  vi.useRealTimers();  // D-06 non-negotiable
  vi.unstubAllGlobals();
});
```

buildTestJwt helper (per RESEARCH "Don't Hand-Roll" row 3 — userFromToken only decodes):
```typescript
function buildTestJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fake-signature`;
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add `export` keyword to INACTIVITY_TIMEOUT in src/context/AuthContext.tsx (test-hook)</name>
  <files>src/context/AuthContext.tsx</files>
  <read_first>
    - src/context/AuthContext.tsx line 64 (INACTIVITY_TIMEOUT declaration) and lines 170-186 (idle timer effect consumer)
    - .planning/phases/21-test-uat-polish/21-RESEARCH.md (Wave 0 Gaps list; Anti-Patterns — "Hard-coding 600000"; Assumption A1)
    - .planning/phases/21-test-uat-polish/21-CONTEXT.md (D-09 minimal scoped)
  </read_first>
  <behavior>
    - `INACTIVITY_TIMEOUT` is a named export from `src/context/AuthContext.tsx`
    - No runtime semantics changed — value stays `10 * 60 * 1000` and all internal usages remain identical
    - A comment above cites the v1.9 Phase 21 test hook rationale
  </behavior>
  <action>
    1. Open src/context/AuthContext.tsx. Find line 64 (or the current location of `const INACTIVITY_TIMEOUT = 10 * 60 * 1000;`).
    2. Add `export` keyword immediately before `const`.
    3. Add a one-line comment ABOVE: `// Exported for v1.9 Phase 21 UAT-AUTO-04 test-hook (constant import, not magic number).`
    4. DO NOT refactor, rename, or extract. No other source change.
    5. Run full suite to confirm zero regression.
    6. Commit: `fix(21-03): export INACTIVITY_TIMEOUT for UAT-AUTO-04 test hook (minimal D-09)`.
  </action>
  <verify>
    <automated>npm test --silent</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "^export const INACTIVITY_TIMEOUT" src/context/AuthContext.tsx` returns 1
    - `grep -c "UAT-AUTO-04" src/context/AuthContext.tsx` returns ≥ 1
    - `git diff src/context/AuthContext.tsx | grep '^+' | grep -vE '^\\+\\+\\+'` shows at most 2 added lines (export keyword + comment)
    - `npm test` exits 0 (no regression)
  </acceptance_criteria>
  <done>INACTIVITY_TIMEOUT importable; zero runtime change; suite still green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create tests/sessionTimers.test.tsx — UAT-AUTO-04 idle + UAT-AUTO-05 absolute-cap</name>
  <files>tests/sessionTimers.test.tsx</files>
  <read_first>
    - src/context/AuthContext.tsx (full file — AuthProvider, useAuth, performLogout, idle timer effect)
    - src/services/authHeaders.ts (authFetch + refresh behavior for UAT-AUTO-05)
    - tests/authFetchRefresh.test.ts (canonical mockResp + loadModule patterns)
    - tests/setup.ts (global BroadcastChannel shim from 21-02)
    - .planning/phases/21-test-uat-polish/21-RESEARCH.md (Pattern 4 fake-timer template; Examples 4 + 5; Pitfall 4 AuthProvider fetch stub; Anti-Patterns)
    - .planning/phases/21-test-uat-polish/21-CONTEXT.md (D-05, D-06 fake-timer usage; D-01 vi.stubGlobal; specifics block — mock getAuthSettings)
    - .planning/phases/21-test-uat-polish/21-VALIDATION.md (Per-Task Verification Map rows 21-03-01, 21-03-02)
    - config/settings.yaml (refreshTokenTtlMs / refreshAbsoluteCapMs — only for context; test mocks getAuthSettings)
  </read_first>
  <behavior>
    - File starts with `// @vitest-environment jsdom` docblock (required for RTL + sessionStorage)
    - Two top-level describe blocks: `describe('UAT-AUTO-04: idle-logout timer', ...)` and `describe('UAT-AUTO-05: absolute-cap re-auth', ...)`
    - beforeEach installs fake timers per RESEARCH Pattern 4 (exact toFake list from D-05); seeds sessionStorage with a well-formed JWT via `buildTestJwt`; stubs `global.fetch` to 200 OK for `/api/auth/users/me` so AuthProvider hydrates (Pitfall 4)
    - afterEach calls `vi.useRealTimers()` (D-06) and `vi.unstubAllGlobals()`
    - UAT-AUTO-04 test: renders `<AuthProvider><Probe/></AuthProvider>`, hydrates user, advances time by `INACTIVITY_TIMEOUT` ms, asserts `sessionStorage.getItem('emd-token')` is null (performLogout fired)
    - UAT-AUTO-04 test: test title contains the literal string "UAT-AUTO-04" and uses the imported `INACTIVITY_TIMEOUT` constant (NOT the literal 600000)
    - UAT-AUTO-05 test: seeds stale token, stubs fetch to return 401 first (original request) then 401 `{ error: 'Session cap exceeded' }` (refresh denial), calls `authFetch('/api/x')` via loadModule, asserts sessionStorage cleared and `window.location.href` is `/login`
    - UAT-AUTO-05 uses getAuthSettings mock where needed; specifically, if AuthContext or authHeaders consults `getAuthSettings()` to compute absolute-cap on the client, use `vi.mock('...getAuthSettings-module...', () => ({ getAuthSettings: () => ({ refreshAbsoluteCapMs: 43200000, refreshTokenTtlMs: 28800000 }) }))` — place at test-file site per D-02 hoisting
    - Tests import `INACTIVITY_TIMEOUT` from src/context/AuthContext.tsx (Task 1 dependency)
  </behavior>
  <action>
    1. Create tests/sessionTimers.test.tsx with `// @vitest-environment jsdom` on line 1.
    2. Imports:
       ```typescript
       import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
       import { render, act, cleanup } from '@testing-library/react';
       import { AuthProvider, useAuth, INACTIVITY_TIMEOUT } from '../src/context/AuthContext';
       ```
    3. Helper `buildTestJwt` per RESEARCH "Don't Hand-Roll" row 3 (5 lines; base64url header + payload + fake signature).
    4. Helper `mockResp({ status, body })` identical to the one in authFetchRefreshSuite.
    5. Helper component `Probe`:
       ```typescript
       function Probe() {
         const { user } = useAuth();
         return <div data-testid="user">{user?.username ?? 'null'}</div>;
       }
       ```
    6. Global `beforeEach` / `afterEach` per the `<interfaces>` block fake-timer template. Include `sessionStorage.clear(); sessionStorage.setItem('emd-token', buildTestJwt({ sub: 'alice', role: 'researcher' }));` and the users/me fetch stub.
    7. **describe('UAT-AUTO-04: idle-logout timer')** — one `it('UAT-AUTO-04: 10-minute inactivity triggers auto-logout', ...)`:
       - render(<AuthProvider><Probe/></AuthProvider>)
       - `await act(async () => { await Promise.resolve(); });` — flushes microtask queue so users/me resolves and user hydrates
       - `expect(getByTestId('user').textContent).toBe('alice')` (sanity)
       - `act(() => { vi.advanceTimersByTime(INACTIVITY_TIMEOUT); });`
       - `expect(sessionStorage.getItem('emd-token')).toBeNull();`
       - Use imported `INACTIVITY_TIMEOUT` — do NOT hardcode 600000.
    8. **describe('UAT-AUTO-05: absolute-cap re-auth')** — one `it('UAT-AUTO-05: refresh 401 \\'Session cap exceeded\\' clears session and redirects to /login', ...)`:
       - Follow RESEARCH Example 5 verbatim:
         ```typescript
         sessionStorage.setItem('emd-token', 'stale');
         vi.stubGlobal('fetch', vi.fn()
           .mockResolvedValueOnce(mockResp({ status: 401 }))
           .mockResolvedValueOnce(mockResp({ status: 401, body: { error: 'Session cap exceeded' } }))
         );
         const { authFetch } = await loadModule();
         await authFetch('/api/x');
         expect(sessionStorage.getItem('emd-token')).toBeNull();
         expect(window.location.href).toBe('/login');
         ```
       - `loadModule()` helper identical to authFetchRefresh.test.ts (vi.resetModules + dynamic import of '../src/services/authHeaders').
       - If authHeaders consults `getAuthSettings()` on the client, add a top-level `vi.mock('../path/to/settings-module', () => ({ getAuthSettings: () => ({ refreshAbsoluteCapMs: 43200000, refreshTokenTtlMs: 28800000 }) }));` BEFORE the describe blocks (hoisting per D-02). Exact module path: verify by reading src/services/authHeaders.ts during execution.
    9. Run the file in isolation; then full suite.
    10. Commit: `test(21-03): automate UAT-AUTO-04 (idle-logout) + UAT-AUTO-05 (absolute-cap) session timers`.
  </action>
  <verify>
    <automated>npx vitest run tests/sessionTimers.test.tsx --reporter=dot && npm run test:ci</automated>
  </verify>
  <acceptance_criteria>
    - `npx vitest run tests/sessionTimers.test.tsx` exits 0 with 2 passing it() cases (one per describe)
    - `grep -c "UAT-AUTO-04" tests/sessionTimers.test.tsx` returns ≥ 1
    - `grep -c "UAT-AUTO-05" tests/sessionTimers.test.tsx` returns ≥ 1
    - `grep -c "INACTIVITY_TIMEOUT" tests/sessionTimers.test.tsx` returns ≥ 1
    - `grep -c "600000" tests/sessionTimers.test.tsx` returns 0 (no magic number — must import constant per RESEARCH Anti-Pattern)
    - `grep -c "vi.useFakeTimers" tests/sessionTimers.test.tsx` returns ≥ 1
    - `grep -c "vi.useRealTimers" tests/sessionTimers.test.tsx` returns ≥ 1 (D-06 compliance)
    - `grep -c "Session cap exceeded" tests/sessionTimers.test.tsx` returns ≥ 1
    - `npm run test:ci` exits 0 (full suite green + zero skips)
  </acceptance_criteria>
  <done>UAT-AUTO-04 and UAT-AUTO-05 automated; idle + absolute-cap contracts regression-guarded; Phase 20 UAT items 4 and 5 deletable.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client session state ↔ server refresh cap | absolute-cap forces re-auth regardless of client activity; UAT-AUTO-05 asserts client honors the server 401 |
| user inactivity ↔ session lifetime | 10-min idle timer is client-enforced session protection |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-21-05 | Elevation of Privilege | Idle-logout regression (stale session reuse) | mitigate | UAT-AUTO-04 guards INACTIVITY_TIMEOUT wiring; regression would let an abandoned session stay valid indefinitely. Severity: medium (session-fixation / stale-session threat guard). |
| T-21-06 | Elevation of Privilege | Absolute-cap bypass (server/authApi.ts:363-366) | mitigate | UAT-AUTO-05 asserts client falls through to /login on 401 "Session cap exceeded"; regression would allow an attacker with a stolen refresh cookie to extend session indefinitely past the 12h cap. Severity: medium. |
| T-21-07 | Tampering | Fake timers leaking across files | mitigate | afterEach vi.useRealTimers() per D-06; otherwise downstream files see nondeterministic timer behavior. Severity: low (test hygiene). |
</threat_model>

<verification>
- `npx vitest run tests/sessionTimers.test.tsx` → 2 passing
- `npm run test:ci` → full suite + skip-gate green
- `grep "^export const INACTIVITY_TIMEOUT" src/context/AuthContext.tsx` → match
- `grep 600000 tests/sessionTimers.test.tsx` → no match (constant imported, not magic number)
</verification>

<success_criteria>
- UAT-AUTO-04 and UAT-AUTO-05 automated
- All 9 Phase 21 requirements (TEST-01..04, UAT-AUTO-01..05) covered across 21-01/02/03
- Full test suite green, zero skipped tests, all Phase 20 UAT items now automated
</success_criteria>

<output>
After completion, create `.planning/phases/21-test-uat-polish/21-03-SUMMARY.md` documenting:
- Fake-timer pattern established (first site in codebase; template for future timer tests)
- INACTIVITY_TIMEOUT export decision (justified under D-09 as test-hook, Assumption A1)
- Evidence: all 9 phase requirements green; link to `.planning/milestones/v1.8-phases/20-jwt-refresh-flow-session-resilience/20-HUMAN-UAT.md` for marking UAT items 1-5 automated
</output>
