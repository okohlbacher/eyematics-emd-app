---
phase: 21-test-uat-polish
plan: 03
subsystem: test-automation
tags: [uat-automation, fake-timers, idle-logout, absolute-cap, session-resilience]
requires:
  - "Phase 20 authFetch/refresh state machine (src/services/authHeaders.ts)"
  - "Plan 21-01 test-suite green baseline"
  - "Plan 21-02 SKIP_AUDIT_IF_STATUS export + global BroadcastChannel shim"
provides:
  - "CI-enforced regression guards for UAT-AUTO-04 (idle-logout) and UAT-AUTO-05 (absolute-cap re-auth)"
  - "First codebase site for fake-timer testing pattern (D-05/D-06 template)"
  - "Public export of INACTIVITY_TIMEOUT from src/context/AuthContext.tsx for regression-guard tests"
affects:
  - "src/context/AuthContext.tsx (one-word export; zero runtime change)"
tech-stack:
  added: []
  patterns:
    - "vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'] }) + vi.setSystemTime for idle-timer tests"
    - "afterEach vi.useRealTimers() — non-negotiable (D-06) to prevent timer leaks across test files"
    - "Module-reload isolation via vi.resetModules + dynamic import for authHeaders refreshPromise state"
    - "buildTestJwt 5-line helper (base64url header + payload + fake signature) — userFromToken decodes only"
key-files:
  created:
    - tests/sessionTimers.test.tsx
  modified:
    - src/context/AuthContext.tsx
decisions:
  - "INACTIVITY_TIMEOUT exported as a named export (one-word `export` prefix) — justified under D-09 as a minimal scoped test hook (Assumption A1), not a refactor. Tests import the constant rather than hard-coding 600000 (RESEARCH Anti-Patterns)."
  - "Test file placed at tests/sessionTimers.test.tsx (new file) rather than appended to tests/authFetchRefresh.test.ts — mixing React Testing Library renders with the unit-style authFetch harness would hurt readability (RESEARCH Primary Recommendation)."
  - "UAT-AUTO-04 uses `await act(async () => { await Promise.resolve(); })` to flush the users/me microtask queue before asserting the hydrated user — avoids the AuthProvider raw fetch hang (RESEARCH Pitfall 4)."
  - "UAT-AUTO-05 reuses the Phase 20 authHeaders single-flight harness via loadModule() — asserts the client falls through to /login when the refresh endpoint denies with 401 'Session cap exceeded', closing the absolute-cap regression gap."
  - "No vi.mock of getAuthSettings needed — grep confirms the client code path in src/ does not consult getAuthSettings; absolute-cap enforcement is server-side (server/authApi.ts:361-370) and the client sees only the 401 response."
metrics:
  duration: ~5 minutes
  tasks_executed: 2
  files_created: 1
  files_modified: 1
  tests_added: 2
  tests_passing: 608/608
  date-completed: 2026-04-23
requirements: [UAT-AUTO-04, UAT-AUTO-05]
---

# Phase 21 Plan 03: Session Timers (UAT-AUTO-04/05) Summary

## One-liner

Closed the last two Phase 20 manual UAT items — 10-minute idle-logout (UAT-AUTO-04) and refresh absolute-cap re-auth (UAT-AUTO-05) — as CI-enforced vitest cases, establishing the codebase's first fake-timer pattern with a one-word `export` added to `INACTIVITY_TIMEOUT`.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Export `INACTIVITY_TIMEOUT` from AuthContext.tsx for test-hook import | `e086cce` | `src/context/AuthContext.tsx` |
| 2 | New `tests/sessionTimers.test.tsx` — UAT-AUTO-04 + UAT-AUTO-05 automated | `02446a9` | `tests/sessionTimers.test.tsx` |

## Fake-Timer Pattern Established (First Site in Codebase)

Template reusable for future timer-dependent tests. Captures D-05 / D-06 non-negotiables:

```typescript
beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'],
  });
  vi.setSystemTime(new Date('2026-04-23T10:00:00Z'));
  // seed sessionStorage + stub any fetches triggered by mount
});

afterEach(() => {
  vi.useRealTimers();  // D-06: leak = nondeterministic downstream files
  vi.unstubAllGlobals();
  cleanup();
});
```

## Test Strategy Per UAT Item

| UAT ID | Strategy | Threat-model anchor |
|--------|----------|---------------------|
| UAT-AUTO-04 | Integration (RTL + fake timers): render `<AuthProvider><Probe/></AuthProvider>`, hydrate user via stubbed `/api/auth/users/me`, `vi.advanceTimersByTime(INACTIVITY_TIMEOUT)`, assert `sessionStorage.getItem('emd-token')` null | T-21-05 (idle-logout regression / stale-session EoP) |
| UAT-AUTO-05 | Unit (authHeaders via loadModule): stub fetch 401 → 401 `'Session cap exceeded'`, call `authFetch('/api/x')`, assert sessionStorage cleared + `window.location.href === '/login'` | T-21-06 (absolute-cap bypass / refresh-cookie theft ceiling) |

## INACTIVITY_TIMEOUT Export Decision (D-09 Justification)

The source change is exactly two added lines:

```diff
+// Exported for v1.9 Phase 21 UAT-AUTO-04 test-hook (constant import, not magic number).
-const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes
+export const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes
```

- **Runtime semantics unchanged** — value identical, all internal consumers unchanged (`resetInactivityTimer` at line 164 + 168).
- **No refactor** — not a rename, extract, or move. Just adds a named export.
- **Assumption A1 confirmed** — RESEARCH called this out as a minimal D-09 scoped fix, equivalent to the `SKIP_AUDIT_IF_STATUS` export in Plan 21-02.
- **Alternative considered and rejected** — duplicating `600000` in the test with a grep-based static-content check would couple the test to a magic number and fail the RESEARCH Anti-Pattern explicitly ("Hard-coding 600000 instead of importing INACTIVITY_TIMEOUT — couples tests to magic numbers").

## Verification

```
npx vitest run tests/sessionTimers.test.tsx   → 2 passed (UAT-AUTO-04 + UAT-AUTO-05)
npm run test:ci                               → 608 passed, 57 files, skip-gate green
grep -c '^export const INACTIVITY_TIMEOUT' src/context/AuthContext.tsx  → 1
grep -c '600000' tests/sessionTimers.test.tsx                            → 0 (constant imported)
grep -c 'vi.useRealTimers' tests/sessionTimers.test.tsx                  → 2 (D-06 compliance)
```

## Acceptance Criteria

- [x] `grep -c "^export const INACTIVITY_TIMEOUT" src/context/AuthContext.tsx` returns 1
- [x] `grep -c "UAT-AUTO-04" src/context/AuthContext.tsx` returns ≥ 1 (actual: 1)
- [x] `npx vitest run tests/sessionTimers.test.tsx` exits 0 with 2 passing it() cases
- [x] `grep -c "UAT-AUTO-04" tests/sessionTimers.test.tsx` returns ≥ 1 (actual: 4)
- [x] `grep -c "UAT-AUTO-05" tests/sessionTimers.test.tsx` returns ≥ 1 (actual: 5)
- [x] `grep -c "INACTIVITY_TIMEOUT" tests/sessionTimers.test.tsx` returns ≥ 1 (actual: 4)
- [x] `grep -c "600000" tests/sessionTimers.test.tsx` returns 0 (no magic number)
- [x] `grep -c "vi.useFakeTimers" tests/sessionTimers.test.tsx` returns ≥ 1 (actual: 2)
- [x] `grep -c "vi.useRealTimers" tests/sessionTimers.test.tsx` returns ≥ 1 (actual: 2)
- [x] `grep -c "Session cap exceeded" tests/sessionTimers.test.tsx` returns ≥ 1 (actual: 3)
- [x] `npm run test:ci` exits 0 (608 / 57 files / skip-gate green)
- [x] `git diff src/context/AuthContext.tsx | grep '^+' | grep -vE '^\+\+\+'` shows exactly 2 added lines (export keyword + comment)

## Phase 21 Closeout (Across All Three Plans)

All 9 Phase 21 requirements now CI-enforced:

| Requirement | Plan | Test Site |
|-------------|------|-----------|
| TEST-01 | 21-01 | tests/outcomesPanelCrt.test.tsx |
| TEST-02 | 21-01 | tests/outcomesPanelCrt.test.tsx |
| TEST-03 | 21-01 | tests/OutcomesPage.test.tsx |
| TEST-04 | 21-01 | scripts/check-skipped-tests.mjs + npm run test:ci |
| UAT-AUTO-01 | 21-02 | tests/authFetchRefreshSuite.test.ts |
| UAT-AUTO-02 | 21-02 | tests/authFetchRefreshSuite.test.ts |
| UAT-AUTO-03 | 21-02 | tests/authFetchRefreshSuite.test.ts |
| UAT-AUTO-04 | 21-03 | tests/sessionTimers.test.tsx |
| UAT-AUTO-05 | 21-03 | tests/sessionTimers.test.tsx |

Phase 20 human-UAT checklist items 1–5 are now fully automated — see `.planning/milestones/v1.8-phases/20-jwt-refresh-flow-session-resilience/20-HUMAN-UAT.md` for marking items as "automated by v1.9 Phase 21".

## Deviations from Plan

None — plan executed exactly as written. The optional getAuthSettings vi.mock was verified unneeded (grep across `src/` for `getAuthSettings` returned no matches — absolute-cap computation is exclusively server-side at `server/authApi.ts:361-370`, so the client only sees the 401 response, matching Example 5 in RESEARCH verbatim).

## Authentication Gates

None encountered.

## Known Stubs

None.

## Threat Flags

None — scope was test code + one-line source edit (export keyword). No new attack surface, no new endpoints, no new data boundaries.

## Self-Check: PASSED

- FOUND: tests/sessionTimers.test.tsx
- FOUND: src/context/AuthContext.tsx (modified — `export const INACTIVITY_TIMEOUT` present)
- FOUND commit: e086cce (Task 1)
- FOUND commit: 02446a9 (Task 2)
- FOUND: npx vitest run tests/sessionTimers.test.tsx → 2 passed
- FOUND: npm run test:ci → 608 passed, 57 files, skip-gate green
