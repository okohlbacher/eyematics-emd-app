---
phase: 21-test-uat-polish
plan: 02
subsystem: test-automation
tags: [uat-automation, broadcast-channel, audit-silence, session-resilience]
requires:
  - "Phase 20 authFetch/refresh state machine (src/services/authHeaders.ts)"
  - "Phase 20 auditMiddleware SKIP_AUDIT_IF_STATUS contract (server/auditMiddleware.ts)"
  - "Plan 21-01 fix-failing-tests green baseline"
provides:
  - "CI-enforced regression guards for UAT-AUTO-01/02/03 (Phase 20 manual checklist items 1-3)"
  - "Public export of SKIP_AUDIT_IF_STATUS for test assertions"
  - "Cross-instance BroadcastChannel shim globally available (tests/setup.ts) — opt-in via vi.stubGlobal"
affects:
  - server/auditMiddleware.ts (one-word export; zero runtime change)
  - tests/authFetchRefresh.test.ts (comment-only cross-reference)
tech-stack:
  added: []
  patterns:
    - "Map-backed cross-instance BroadcastChannel shim for jsdom + Node-native-BC override"
    - "Per-file vi.stubGlobal('BroadcastChannel', MockBroadcastChannel) to force shim over Node 18+ native BC (RESEARCH Assumption A2)"
key-files:
  created:
    - tests/authFetchRefreshSuite.test.ts
  modified:
    - server/auditMiddleware.ts
    - tests/authFetchRefresh.test.ts
decisions:
  - "Chose new test file (authFetchRefreshSuite.test.ts) over extending authFetchRefresh.test.ts — per RESEARCH Primary recommendation, keeps UAT-AUTO grouping explicit and avoids per-file MockBC coupling."
  - "Retained MockBC class scoped to authFetchRefresh.test.ts (RESEARCH Assumption A2) — existing 15 tests stay green with zero modification."
  - "Task 3 required forcing MockBroadcastChannel via vi.stubGlobal because Node 18+ provides a native BroadcastChannel that does NOT deliver cross-instance messages synchronously within a single process (install-guard in tests/setup.ts bypassed → per-file stub pattern used, matching authFetchRefresh.test.ts precedent)."
metrics:
  duration: ~10 minutes (resume — D-03 already landed)
  tasks_executed: 2 (Task 2 + Task 3; Task 1/D-03 skipped as pre-existing)
  files_created: 1
  files_modified: 2
  tests_added: 3
  tests_passing: 606/606
  date-completed: 2026-04-23
---

# Phase 21 Plan 02: authFetch Refresh Suite Summary

Automated 3 of the 5 Phase 20 manual UAT checklist items (UAT-AUTO-01 silent refresh, UAT-AUTO-02 two-tab single-flight, UAT-AUTO-03 audit-silence contract) as CI-enforced vitest cases, closing the session-resilience + audit-PII regression gap with a one-word source export (SKIP_AUDIT_IF_STATUS) and a per-file MockBroadcastChannel stub.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| D-03 (prior run) | Global BroadcastChannel shim in tests/setup.ts + vitest.config.ts setupFiles | ecb6323 | tests/setup.ts, vitest.config.ts |
| 2 | Export SKIP_AUDIT_IF_STATUS (minimal D-09) | cc5b1c4 | server/auditMiddleware.ts |
| 3 | Add UAT-AUTO-01/02/03 suite | 96d5a74 | tests/authFetchRefreshSuite.test.ts, tests/authFetchRefresh.test.ts |

## MockBC Retention Decision

**Kept** the per-file MockBC class in `tests/authFetchRefresh.test.ts` per RESEARCH Assumption A2. Evidence: after the global shim was wired (D-03) and the new suite added, `npm run test:ci` passes with all 606 tests green across all 56 files — including the original 15 authFetchRefresh.test.ts cases, which continue to use their file-local MockBC via `vi.stubGlobal('BroadcastChannel', MockBC)`.

## Test Strategy Per UAT Item

| UAT ID | Strategy | Threat-model anchor |
|--------|----------|---------------------|
| UAT-AUTO-01 | Integration: authFetch + 3-call fetchMock (401 → refresh 200 → retry 200), asserts single refresh call + token replacement | T-20-23 (session resilience) |
| UAT-AUTO-02 | Cross-tab: two BroadcastChannel instances, non-poster captures refresh-success with new token; single-flight refresh call count === 1 | T-20-19 (refresh-storm DoS), T-20-23 |
| UAT-AUTO-03 | Unit: direct import of SKIP_AUDIT_IF_STATUS, assert Set contents (200 silenced, 401/403 audited) | T-20-19 (audit DoS), T-20-21 (repudiation guard) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Node 18+ native BroadcastChannel defeated setup.ts install guard**
- **Found during:** Task 3 initial test run (UAT-AUTO-02 failed — tabBMessages === 0)
- **Issue:** tests/setup.ts installs MockBroadcastChannel only `if (typeof globalThis.BroadcastChannel === 'undefined')`. Node 18+ provides a native BroadcastChannel implementation that passes the guard but does NOT deliver cross-instance messages synchronously within a single process, breaking the cross-tab test pattern.
- **Fix:** In tests/authFetchRefreshSuite.test.ts `beforeEach`, call `MockBroadcastChannel._reset()` then `vi.stubGlobal('BroadcastChannel', MockBroadcastChannel)` to force the shim for this file's tests. Matches the precedent in tests/authFetchRefresh.test.ts (Assumption A2) where per-file `vi.stubGlobal` always wins over the global install.
- **Files modified:** tests/authFetchRefreshSuite.test.ts
- **Commit:** 96d5a74 (same commit as Task 3)

No other deviations.

## Key Links Verified

- `tests/setup.ts` → shim class + `_reset()` present.
- `vitest.config.ts` → `setupFiles: ['tests/setup.ts']` wired.
- `tests/authFetchRefreshSuite.test.ts` → imports `SKIP_AUDIT_IF_STATUS` from `../server/auditMiddleware` + `MockBroadcastChannel` from `./setup`.
- `server/auditMiddleware.ts` → `export const SKIP_AUDIT_IF_STATUS` present.

## Verification

```
npx vitest run tests/authFetchRefreshSuite.test.ts   → 3 passed
npx vitest run tests/authFetchRefresh.test.ts        → 15 passed (no regression)
npx vitest run tests/auditMiddleware.test.ts         → 20 passed (no regression)
npm run test:ci                                      → 606 passed, skip-gate green
```

## Self-Check: PASSED

- tests/authFetchRefreshSuite.test.ts: FOUND
- server/auditMiddleware.ts export: FOUND (grep `^export const SKIP_AUDIT_IF_STATUS` → 1)
- Commits found in log: ecb6323 (D-03), cc5b1c4 (Task 2), 96d5a74 (Task 3)
- Full suite green: 606/606
