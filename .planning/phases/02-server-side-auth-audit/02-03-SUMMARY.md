---
phase: 02-server-side-auth-audit
plan: 03
subsystem: middleware-wiring + frontend-auth
tags: [auth, audit, middleware, jwt, react, express]
dependency_graph:
  requires: [02-01, 02-02]
  provides: [server/index.ts, src/services/authHeaders.ts, src/context/AuthContext.tsx, src/pages/LoginPage.tsx]
  affects: [server/issueApi.ts, server/settingsApi.ts, server/utils.ts, src/services/issueService.ts, src/services/settingsService.ts]
tech_stack:
  added: []
  patterns: [JWT Bearer in sessionStorage, async fetch login, express middleware chain, raw Node http handlers alongside Express]
key_files:
  created:
    - src/services/authHeaders.ts
  modified:
    - server/index.ts
    - server/utils.ts
    - server/issueApi.ts
    - server/settingsApi.ts
    - src/services/issueService.ts
    - src/services/settingsService.ts
    - src/context/AuthContext.tsx
    - src/pages/LoginPage.tsx
key_decisions:
  - "express.json() mounted only on /api/auth/* — issueApiHandler/settingsApiHandler use readBody() on raw stream; global express.json() would conflict"
  - "auditMiddleware mounted before authMiddleware — captures 401 responses with user=anonymous at res.finish time"
  - "initAuth(DATA_DIR, settings) — actual argument order reversed from plan; reading the source took precedence"
  - "authMiddleware and auditMiddleware are plain functions, not factories — plan's createAuthMiddleware/createAuditMiddleware assumptions corrected"
  - "issueApiHandler and settingsApiHandler added as separate exports alongside existing Vite plugin exports — no breaking change to dev workflow"
  - "Vite dev plugins updated to check JWT Bearer presence (not role) — full JWT validation not available in Vite context"
  - "managedUsers initialised as empty [] in AuthContext — Phase 3 will wire to server API"
  - "safeJsonParse import removed from settingsService.ts — was only used in local getAuthHeaders() which is now replaced"
metrics:
  duration_seconds: ~480
  completed_date: "2026-04-10"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 8
---

# Phase 2 Plan 3: Middleware Wiring + Frontend Auth Summary

**One-liner:** Express server wired with JWT auth + SQLite audit middleware in correct order; React login rewired to async server-side credential validation with JWT storage.

## What Was Built

### server/index.ts — Complete middleware wiring

Startup sequence:
1. Read `public/settings.yaml` (fail fast)
2. Auto-create `data/` directory; seed `users.json` if absent
3. `initAuth(DATA_DIR, settings)` — load/generate JWT secret, bcrypt-migrate users.json
4. `initAuditDb(DATA_DIR)` — open/create `data/audit.db` in WAL mode
5. `startPurgeInterval()` — run 90-day purge immediately + every 24h

Middleware order:
- `express.json({ limit: '1mb' })` on `/api/auth` only (authApiRouter needs req.body; issueApiHandler/settingsApiHandler use readBody() on raw stream)
- `auditMiddleware` — all `/api/*` requests logged; mounted before authMiddleware to capture 401s
- `authMiddleware` — JWT validated on all `/api/*` except public auth paths
- `authApiRouter` on `/api/auth` — login, verify, config
- `issueApiHandler` — raw Node http middleware (auth guaranteed upstream)
- `settingsApiHandler` — raw Node http middleware (auth guaranteed upstream)
- `auditApiRouter` on `/api/audit` — read-only audit query + admin export
- FHIR proxy on `/fhir`
- Static files from `dist/`
- SPA fallback

### server/utils.ts — validateAuth() and KNOWN_USERS removed (AUTH-08)

Both functions removed entirely. `readBody()` and `sendError()` retained — still used by issueApiHandler/settingsApiHandler. Comment documents the removal rationale.

### server/issueApi.ts + server/settingsApi.ts — Express handler exports added

New `issueApiHandler` and `settingsApiHandler` exported as raw Node http middleware functions. Auth is guaranteed by upstream `authMiddleware`; handlers check `(req as any).auth.role` for admin-only routes.

The existing Vite dev plugin functions (`issueApiPlugin`, `settingsApiPlugin`) are preserved unchanged for `npm run dev` compatibility. Their auth checks updated from `validateAuth()` to simple Bearer header presence check (JWT validation not available in Vite context).

### src/services/authHeaders.ts — Shared JWT utility (D-16)

New file. Exports `getAuthHeaders()`, `setJwt()`, `clearJwt()`. JWT stored under key `emd-jwt` in sessionStorage. Replaces duplicate implementations in issueService.ts and settingsService.ts.

### src/services/issueService.ts + settingsService.ts — Shared import

Local `getAuthHeaders()` functions removed. `import { getAuthHeaders } from './authHeaders'` added. All call sites unchanged.

### src/context/AuthContext.tsx — Server-based async auth (AUTH-07, D-03, D-04)

Major changes:
- `DEFAULT_CREDENTIALS`, `VALID_OTP`, `DEFAULT_MANAGED_USERS` constants removed entirely
- `logAudit` import and all calls removed — server middleware handles audit (D-12)
- `User` interface gains `centers: string[]` field (AUTH-09)
- `login()` is now `async`, POSTs to `/api/auth/login`
- `verifyOtp()` new async method, POSTs to `/api/auth/verify`
- `decodeJwtPayload()` helper decodes JWT middle segment to extract `{ sub, role, centers }`
- `applySessionToken()` calls `setJwt()`, stores user in sessionStorage, sets React state
- `performLogout()` calls `clearJwt()`, removes `emd-user` from sessionStorage
- `managedUsers` initialised as `[]` (no localStorage persistence — Phase 3 will wire to server)

### src/pages/LoginPage.tsx — Server-backed async form (D-01, D-02)

Major changes:
- `getSettings()` import removed — no client-side 2FA config check
- `useEffect` on mount fetches `GET /api/auth/config` to get `{ twoFactorEnabled }`
- `handleCredentials` is `async`, calls `await login(username, password)`
- `handleOtp` is `async`, calls `await verifyOtp(challengeToken, otp)`
- `loading` state disables form inputs during fetch
- `challengeToken` state stores server challenge token between steps
- Client-side `attempts` counter removed — server enforces rate limiting (D-09)
- Inputs and buttons gain `disabled={loading}` for UX feedback

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 696aa60 | feat(02-03): wire auth+audit middleware into index.ts, create authHeaders.ts |
| Task 2 | 5f1c8e2 | feat(02-03): rewire AuthContext + LoginPage for server-side auth |

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-02-13 | JWT signed server-side with HS256; tampered tokens rejected by authMiddleware |
| T-02-15 | authMiddleware mounted before all route handlers in server/index.ts; verified in acceptance criteria |
| T-02-16 | authMiddleware replaces per-handler validateAuth(); all /api/* routes protected by default |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] initAuth argument order reversed from plan**
- **Found during:** Task 1 — reading server/initAuth.ts before editing
- **Issue:** Plan's `<interfaces>` said `initAuth(settings, dataDir)` but actual implementation is `initAuth(dataDir, settings)`
- **Fix:** Used correct argument order `initAuth(DATA_DIR, settings)` in server/index.ts
- **Files modified:** server/index.ts
- **Commit:** 696aa60

**2. [Rule 1 - Bug] authMiddleware and auditMiddleware are plain functions, not factories**
- **Found during:** Task 1 — reading the actual server files before editing
- **Issue:** Plan said `createAuthMiddleware(jwtSecret)` and `createAuditMiddleware()` but actual exports are plain `authMiddleware` and `auditMiddleware` (authMiddleware calls `getJwtSecret()` internally)
- **Fix:** Used plain function references in `app.use(authMiddleware)` and `app.use(auditMiddleware)`
- **Files modified:** server/index.ts
- **Commit:** 696aa60

**3. [Rule 2 - Missing functionality] issueApi.ts and settingsApi.ts lacked Express handler exports**
- **Found during:** Task 1 — server/index.ts imports `issueApiHandler`/`settingsApiHandler` but files only exported Vite plugins
- **Issue:** Pre-existing TS2305 errors; these handlers did not exist
- **Fix:** Added `issueApiHandler` and `settingsApiHandler` as exported raw Node http middleware functions. Auth checks in Vite plugins updated from `validateAuth()` (removed) to Bearer header presence
- **Files modified:** server/issueApi.ts, server/settingsApi.ts
- **Commit:** 696aa60

**4. [Rule 1 - Bug] settingsService.ts: safeJsonParse was no longer used after getAuthHeaders removal**
- **Found during:** Task 1 — after removing local getAuthHeaders() from settingsService.ts
- **Issue:** `safeJsonParse` import became unused
- **Fix:** Removed the import to keep the file clean
- **Files modified:** src/services/settingsService.ts
- **Commit:** 696aa60

### Out-of-scope Pre-existing Issues

`server/index.ts` type error `TS2307: Cannot find module 'http-proxy-middleware'` — package not installed in this worktree. Pre-existing before this plan (visible in original server/index.ts). Not fixed (out of scope).

## Known Stubs

- `managedUsers` in AuthContext is initialised as `[]` — UI pages (AdminPage, LandingPage) that display managed users will show empty lists until Phase 3 wires the server user management API. This is intentional: Phase 3 scope.

## Threat Flags

None — no new security surface beyond what is described in the plan's threat model.

## Self-Check: PASSED

- src/services/authHeaders.ts: FOUND
- server/index.ts imports authMiddleware, authApi, auditDb, auditMiddleware, auditApi: CONFIRMED
- `grep "initAuth" server/index.ts`: FOUND
- `grep "initAuditDb" server/index.ts`: FOUND
- `grep "startPurgeInterval" server/index.ts`: FOUND
- `grep -c "validateAuth\|KNOWN_USERS" server/utils.ts` → 1 (comment only, no function definitions): CONFIRMED
- `grep "emd-jwt" src/services/authHeaders.ts`: CONFIRMED
- `grep -c "DEFAULT_CREDENTIALS" src/context/AuthContext.tsx` → 0: CONFIRMED
- `grep -c "VALID_OTP" src/context/AuthContext.tsx` → 0: CONFIRMED
- `grep -c "logAudit" src/context/AuthContext.tsx` → 0: CONFIRMED
- `grep "api/auth/login" src/context/AuthContext.tsx`: CONFIRMED
- `grep "api/auth/verify" src/context/AuthContext.tsx`: CONFIRMED
- `grep "api/auth/config" src/pages/LoginPage.tsx`: CONFIRMED
- `grep -c "getSettings" src/pages/LoginPage.tsx` → 0: CONFIRMED
- `npx tsc --noEmit -p tsconfig.json`: PASSED (no errors)
- `npx tsc --noEmit -p tsconfig.server.json`: 1 pre-existing error (http-proxy-middleware types), unrelated to this plan
- Commit 696aa60: FOUND
- Commit 5f1c8e2: FOUND
