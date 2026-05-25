---
phase: 44-techdebt-compaction
plan: "01"
subsystem: server/auth
tags: [refactor, tech-debt, auth, routing, TECH-01, F-09]
dependency_graph:
  requires: []
  provides: [server/auth/authHelpers.ts, server/auth/loginApi.ts, server/auth/userAdminApi.ts, server/auth/totpApi.ts, server/auth/sessionApi.ts]
  affects: [server/authApi.ts, server/settingsApi.ts, server/index.ts]
tech_stack:
  added: []
  patterns: [express Router composition, module extraction, re-export aggregator]
key_files:
  created:
    - server/auth/authHelpers.ts
    - server/auth/loginApi.ts
    - server/auth/userAdminApi.ts
    - server/auth/totpApi.ts
    - server/auth/sessionApi.ts
  modified:
    - server/authApi.ts
decisions:
  - "Mount order: loginRouter → userAdminRouter → totpRouter → sessionRouter preserves original top-to-bottom registration order"
  - "Re-export resetLimiter from thin authApi.ts aggregator to preserve settingsApi.ts import without creating new cycle (AUTHCFG-04)"
  - "limiter() exported from authHelpers as function (not the singleton) so it remains lazy-init and testable"
metrics:
  duration: "~7 minutes"
  completed: "2026-05-26"
  tasks_completed: 3
  files_created: 6
  files_modified: 1
---

# Phase 44 Plan 01: TECH-01 Split authApi.ts Summary

**One-liner:** Mechanical extraction of 1,176-line auth monolith into five focused modules (authHelpers + loginApi + userAdminApi + totpApi + sessionApi) mounted by a 34-line thin aggregator — strictly behavior-preserving.

## What Was Built

`server/authApi.ts` (the F-09 God module, ~1,176 lines) was split into:

| File | Lines | Contents |
|------|-------|----------|
| `server/auth/authHelpers.ts` | 163 | Shared: VALID_ROLES, generateSecurePassword, currentKeyId, limiter singleton, resetLimiter, signSessionToken, touchLastLogin, emitRefreshCookies, signChallengeToken |
| `server/auth/loginApi.ts` | 387 | POST /login, /verify, /refresh (requireCsrf), /logout (requireCsrf), GET /config |
| `server/auth/userAdminApi.ts` | 376 | GET /users/me, GET/POST /users, DELETE/PUT /users/:username, PUT /users/me/password, PUT /users/:username/password |
| `server/auth/totpApi.ts` | 200 | POST /totp/enroll, /totp/confirm, /totp/disable, GET /totp/status, POST /users/:username/totp/reset |
| `server/auth/sessionApi.ts` | 120 | POST /rotate-key, DELETE /sessions/:id, DELETE /sessions, GET /sessions |
| `server/authApi.ts` (thin aggregator) | 34 | Mounts four routers; re-exports resetLimiter |

## Route Ordering Invariants Preserved

1. `PUT /users/me/password` registered at line 286 BEFORE `PUT /users/:username/password` at line 339 in `userAdminApi.ts` (invariant #1 — literal path wins over param match)
2. `DELETE /sessions/:id` registered at line 60 BEFORE `DELETE /sessions` at line 83 in `sessionApi.ts` (invariant #2)
3. Sub-router mounting order: `loginRouter → userAdminRouter → totpRouter → sessionRouter` matches original top-to-bottom registration order

## External Contract Preservation

- `server/index.ts` — `import { authApiRouter } from './authApi.js'`: unchanged; authApi.ts still exports `authApiRouter`
- `server/settingsApi.ts` — `import { resetLimiter } from './authApi.js'`: unchanged; authApi.ts re-exports `resetLimiter` from `./auth/authHelpers.js`
- No circular import introduced: settingsApi → authApi → authHelpers (AUTHCFG-04 direction preserved; authHelpers imports settingsApi, not vice versa at top-level)

## Security Gate Verification (STRIDE T-44-01..04)

- **T-44-01 (Elevation):** All `req.auth.role !== 'admin'` guards moved verbatim with handler bodies
- **T-44-02 (CSRF):** `requireCsrf` attached to POST /refresh and POST /logout in loginApi.ts exactly as in original
- **T-44-03 (JWT pin):** All signing routes through jwtUtil wrappers in authHelpers.ts; no direct jwt.sign introduced
- **T-44-04 (Rate limiter):** Single shared `_limiter` singleton in authHelpers.ts; `resetLimiter()` exported from authApi.ts aggregator; settingsApi import path unchanged

## Test / Lint / Knip Gates

| Check | Result |
|-------|--------|
| `npm run test:ci` | 1086/1086 pass (99 test files) |
| `npm run lint` | 0 errors, 0 warnings |
| `npm run knip` | No new unused exports (2 pre-existing: getThresholdSettings, QualityParamKey) |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `7930310` | Extract shared auth helpers into server/auth/authHelpers.ts |
| Task 2 | `9d69675` | Extract four auth router modules (login/userAdmin/totp/session) |
| Task 3 | `b9c8c8f` | Rewrite authApi.ts as thin aggregator; verify full gate parity |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused import in loginApi.ts**
- **Found during:** Task 3 (lint check)
- **Issue:** `UserRecord` was imported from `../initAuth.js` in `loginApi.ts` but never used in that file (the type is only needed inside authHelpers.ts for `emitRefreshCookies`)
- **Fix:** Removed the `import type { UserRecord }` line from loginApi.ts
- **Files modified:** server/auth/loginApi.ts
- **Commit:** b9c8c8f (included in Task 3 commit)

**2. [Rule 1 - Bug] Fixed import sort order in userAdminApi.ts**
- **Found during:** Task 3 (lint check)
- **Issue:** `getValidCenterIds` from `../constants.js` was placed after initAuth imports, violating simple-import-sort alphabetical ordering
- **Fix:** Moved `../constants.js` import before `../initAuth.js` imports
- **Files modified:** server/auth/userAdminApi.ts
- **Commit:** b9c8c8f (included in Task 3 commit)

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced. This is a purely structural reorganization of existing code.

## Self-Check: PASSED

All 6 files exist (authHelpers.ts, loginApi.ts, userAdminApi.ts, totpApi.ts, sessionApi.ts, authApi.ts).
All 3 task commits verified: 7930310, 9d69675, b9c8c8f.
