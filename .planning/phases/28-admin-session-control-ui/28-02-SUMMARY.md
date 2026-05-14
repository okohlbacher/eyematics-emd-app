---
phase: 28-admin-session-control-ui
plan: 02
subsystem: auth
tags: [sqlite, better-sqlite3, express, sessions, admin]

# Dependency graph
requires:
  - phase: 27-stateful-session-backend
    provides: refresh_sessions table, sessionsDb.ts with revokeByUsername/revokeSession/getSession, authApi.ts router
provides:
  - "listActiveSessionsByUser(username) exported function in sessionsDb.ts — filters revoked=0 AND expires_at>now, ordered by issued_at DESC"
  - "GET /api/auth/sessions?username=<u> — admin-only, returns active sessions array"
  - "DELETE /api/auth/sessions/:id — admin-only, revokes single session by jti, 404 for unknown ids"
  - "DELETE /api/auth/sessions?username=<u> — admin-only, revokes all active sessions for user (SESS-01)"
  - "Fixed _closeForTests null-chain in sessionsDb.ts to include stmtRevokeByUsername + stmtListActiveByUsername"
affects: [28-03, 28-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route ordering: DELETE /sessions/:id registered before DELETE /sessions to prevent :id being treated as missing username"
    - "Inline admin guard: if (!req.auth || req.auth.role !== 'admin') returns 403 — consistent with /rotate-key pattern"
    - "No requireCsrf on admin CRUD endpoints — Bearer-only, consistent with DELETE /users/:username pattern"

key-files:
  created: []
  modified:
    - "server/sessionsDb.ts"
    - "server/authApi.ts"

key-decisions:
  - "Route ordering: DELETE /sessions/:id BEFORE DELETE /sessions — prevents :id path segment from being matched by query-param handler"
  - "No requireCsrf on session DELETE endpoints — follows established Bearer-only admin CRUD pattern (D-11, D-12, T-28-03 accepted)"
  - "listActiveSessionsByUser uses prepared statement cached in initSessionsDb — consistent with module's prepared-statement caching pattern"

patterns-established:
  - "Admin-only endpoint pattern: inline req.auth.role check, 403, no requireCsrf for Bearer-authenticated admin routes"

requirements-completed: [SESS-01, SESSUI-01, SESSUI-02]

# Metrics
duration: 3min
completed: 2026-05-14
---

# Phase 28 Plan 02: Backend Session Management Endpoints Summary

**Three admin-only session endpoints (GET/DELETE /api/auth/sessions) + listActiveSessionsByUser prepared statement in sessionsDb.ts, making Wave 0 RED scaffold (10 tests) GREEN**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-14T13:54:35Z
- **Completed:** 2026-05-14T13:57:22Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `listActiveSessionsByUser(username)` to `sessionsDb.ts` — prepared statement filtering active-only rows (revoked=0, expires_at>now), ordered by issued_at DESC
- Fixed `_closeForTests()` null-chain to include the previously-omitted `stmtRevokeByUsername` and `stmtListActiveByUsername` statements
- Registered three admin-only route handlers in `authApi.ts`: DELETE /sessions/:id, DELETE /sessions (query-param), GET /sessions — with correct ordering and 403 guard
- `tests/sessionRevoke.test.ts` Wave 0 scaffold: 0/10 RED → 10/10 GREEN; full test suite 704→712 passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Add listActiveSessionsByUser to sessionsDb.ts + fix _closeForTests null-chain** - `ab70263` (feat)
2. **Task 2: Add three admin-only session route handlers to authApi.ts** - `67d7647` (feat)

## Files Created/Modified

- `server/sessionsDb.ts` - Added `stmtListActiveByUsername` declaration + prepare in `initSessionsDb`, `listActiveSessionsByUser` export, fixed `_closeForTests` null-chain
- `server/authApi.ts` - Added `listActiveSessionsByUser` import, registered DELETE /sessions/:id, DELETE /sessions, GET /sessions handlers

## Decisions Made

- Route ordering: `DELETE /sessions/:id` registered before `DELETE /sessions` — Express matches `:id` first, preventing a session id from being interpreted as a missing username query-param (would have returned 400 instead of 404).
- No `requireCsrf` on any of the three new endpoints — consistent with the existing `DELETE /users/:username` pattern; Bearer tokens are not auto-sent cross-site so CSRF risk is low (T-28-03 accepted).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Worktree initialization required restoring files from HEAD (worktree was created from an older commit and soft-reset to d1bbb89), but this was a setup step, not an implementation issue.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None. All three endpoints follow the existing admin-auth pattern; no new trust boundaries introduced. Threat register T-28-01 through T-28-05 all mitigated or accepted as planned.

## Next Phase Readiness

- Backend session management endpoints fully implemented and tested
- `listActiveSessionsByUser` available for Plan 28-03 (AdminPage session accordion UI)
- `DELETE /sessions/:id` available for Plan 28-03 individual revoke button
- `DELETE /sessions?username=` available for Plan 28-03 "Sign out everywhere" button
- ttlConversion.test.ts RED scaffold remains failing (expected — Plan 28-03 delivers `src/services/ttlConversion.ts`)

## Self-Check

- [x] `server/sessionsDb.ts` modified — file exists at correct path
- [x] `server/authApi.ts` modified — file exists at correct path
- [x] Task 1 commit `ab70263` exists in git log
- [x] Task 2 commit `67d7647` exists in git log
- [x] `tests/sessionRevoke.test.ts` 10/10 GREEN
- [x] `tests/sessionsDb.test.ts` 8/8 GREEN
- [x] Full suite: 712 tests pass (up from 704 at baseline)

## Self-Check: PASSED

---
*Phase: 28-admin-session-control-ui*
*Completed: 2026-05-14*
