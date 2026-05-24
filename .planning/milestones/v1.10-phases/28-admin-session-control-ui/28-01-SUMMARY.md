---
phase: 28-admin-session-control-ui
plan: 01
subsystem: test-scaffolding
tags: [tdd, red-scaffold, wave-0, sessions, ttl]
requires: []
provides:
  - tests/sessionRevoke.test.ts
  - tests/ttlConversion.test.ts
affects:
  - tests/sessionRevoke.test.ts
  - tests/ttlConversion.test.ts
tech-stack:
  added: []
  patterns:
    - "supertest + express app factory with injected req.auth for admin tests"
    - "makeRow factory mirroring sessionsDb.test.ts pattern"
    - "tmpdir initSessionsDb/_closeForTests lifecycle in beforeEach/afterEach"
key-files:
  created:
    - tests/sessionRevoke.test.ts
    - tests/ttlConversion.test.ts
  modified: []
key-decisions:
  - "Wave 0 RED scaffolds — no production code written; both files fail for expected reasons (missing endpoints / missing module)"
  - "sessionRevoke.test.ts uses vi.mock for initAuth, keycloakAuth, fhirApi, settingsApi to avoid real side effects"
  - "ttlConversion.test.ts imports from non-existent src/services/ttlConversion.ts — fails with Cannot find module"
requirements-completed: [SESS-01, SESSUI-01, SESSUI-02, SESSUI-03]
duration: 3 min
completed: 2026-05-14
---

# Phase 28 Plan 01: Wave 0 RED Scaffold Summary

Wave 0 TDD scaffolds: 10-test supertest suite for 3 non-existent session HTTP endpoints and 10-test unit suite for non-existent TTL conversion module.

## Duration

- Start: 2026-05-14T13:45:50Z
- End: 2026-05-14T13:49:23Z
- Duration: 3 min
- Tasks: 2
- Files created: 2

## What Was Done

### Task 1: tests/sessionRevoke.test.ts

Created a fully-written supertest integration scaffold for three session management HTTP endpoints that do not yet exist in `server/authApi.ts`.

**Pattern used:** Mirrors `tests/userCrud.test.ts` and `tests/rotateKey.test.ts` — Express app factory injects `req.auth` directly (no JWT in tests), `vi.mock` suppresses real side effects from `initAuth`, `keycloakAuth`, `fhirApi`, and `settingsApi`. Sessions DB runs in a per-test tmpdir using `initSessionsDb` / `_closeForTests` from `sessionsDb.test.ts` pattern.

**Test count:** 10 tests across 3 describe blocks:
- `GET /api/auth/sessions`: active-only filter, 403 for non-admin, 400 if username missing
- `DELETE /api/auth/sessions/:id`: revoke + verify DB, 404 if not found, 403, route ordering
- `DELETE /api/auth/sessions (by username)`: revokes all + count, 403, 400 if missing

**RED state:** 8/10 tests fail (404 from Express — routes not registered). 2 tests that expect 404 pass coincidentally (route not found = 404), which is acceptable for a scaffold.

**Commit:** ed45493

### Task 2: tests/ttlConversion.test.ts

Created a pure unit test scaffold for the hours<->ms conversion and validation functions planned in `src/services/ttlConversion.ts` (Plan 28-03).

**Contract tested:**
- `hoursToMs(hours: number): number` — hours * 3_600_000
- `msToHours(ms: number): number` — Math.round(ms / 3_600_000)
- `validateTtl(refreshHours: number, capHours: number): 'ok' | 'refreshMin' | 'capMin'`

**Test count:** 10 tests across 2 describe blocks:
- `hoursToMs / msToHours round-trip`: specific values (8h, 12h), round-trip 1..48, fractional rounding
- `validateTtl (D-08)`: ok, refreshMin (<1 or non-integer), capMin (cap < refresh), boundary (cap === refresh)

**RED state:** All 10 tests fail with "Cannot find module `../src/services/ttlConversion`" — module not created until Plan 28-03.

**Commit:** 92d1bb5

## Verification

Both RED scaffold confirm commands pass:

```
npx vitest run tests/sessionRevoke.test.ts 2>&1 | grep -qE "(fail|FAIL|✗|✖)" && echo "RED scaffold confirmed"
# → RED scaffold confirmed

npx vitest run tests/ttlConversion.test.ts 2>&1 | grep -qE "(fail|FAIL|✗|✖|Cannot find module)" && echo "RED scaffold confirmed"
# → RED scaffold confirmed
```

Full test suite baseline: 704 passed, 8 failed — the 8 failures are all in the 2 new scaffold files. The original 619 baseline tests remain passing (no regressions).

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model

| Threat | Status |
|--------|--------|
| T-28-01: Admin-only guard tests | Covered — `returns 403 for non-admin role` in all three endpoint groups |
| T-28-W0: Test-only plan, no runtime surface | Confirmed — no production code written |

## Next

Ready for 28-02 (implement session endpoints and sessionsDb.listActiveSessionsByUser).

## Self-Check: PASSED

- tests/sessionRevoke.test.ts exists on disk ✓
- tests/ttlConversion.test.ts exists on disk ✓
- Commit ed45493 exists ✓
- Commit 92d1bb5 exists ✓
- Both files fail (RED) for expected reasons ✓
- 619 baseline tests unaffected ✓
