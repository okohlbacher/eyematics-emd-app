---
phase: 04-user-management-data-persistence
plan: "04"
subsystem: auth-client
tags: [auth, jwt, sessionStorage, login, 2fa]
one_liner: "Server-side login via POST /api/auth/login with real JWT stored in sessionStorage; all fake client-side credentials eliminated"

dependency_graph:
  requires: ["04-01", "04-02", "04-03"]
  provides: ["working-end-to-end-auth", "real-jwt-bearer-tokens"]
  affects: ["AdminPage CRUD", "DataContext server fetches"]

tech_stack:
  added: []
  patterns:
    - "JWT decode via atob(token.split('.')[1]) — no library, client-side display only"
    - "2FA challenge flow: POST /login -> challengeToken -> POST /verify -> session JWT"
    - "Cached 2FA config via useRef to avoid re-fetching on every login attempt"

key_files:
  created: []
  modified:
    - src/context/AuthContext.tsx
    - src/services/authHeaders.ts
    - src/pages/LoginPage.tsx

decisions:
  - "login() accepts optional 4th parameter challengeToken so LoginPage can pass it directly to /verify without storing it in AuthContext state"
  - "twoFactorEnabledRef caches GET /api/auth/config result after first fetch; avoids per-login-attempt round trip"
  - "performLogout logs were removed — server audit middleware handles all logging; client-side logAudit calls eliminated"
  - "Generic 'invalid_credentials' error shown for both user_not_found and wrong_password — prevents username enumeration (T-04-04-04)"

metrics:
  duration_minutes: 25
  completed_date: "2026-04-10"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 04 Plan 04: Auth Token Flow Gap Closure Summary

Server-side login via POST /api/auth/login with real JWT stored in sessionStorage; all fake client-side credentials eliminated.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewire AuthContext.login() to call server and store JWT | 676124a | src/context/AuthContext.tsx |
| 2 | Fix getAuthHeaders() to send real JWT and update LoginPage for async login | c798c28 | src/services/authHeaders.ts, src/pages/LoginPage.tsx |

## What Was Built

**Task 1 — AuthContext.tsx rewrite:**
- Deleted `DEFAULT_CREDENTIALS`, `VALID_OTP`, `DEFAULT_MANAGED_USERS` — no hardcoded secrets in client bundle
- `login()` is now `async`, returns `Promise<LoginResult>` with typed error discriminants
- Calls `POST /api/auth/login` with `{ username, password }`; on success stores server-signed JWT in `sessionStorage('emd-token')`
- Decodes JWT payload via `atob()` for UI state (`setUser`) only — not used for authorization
- 2FA path: if server returns `challengeToken`, surfaces `{ ok: false, error: 'otp_required', challengeToken }` to LoginPage, then calls `POST /api/auth/verify` with `{ challengeToken, otp }` on step 2
- `GET /api/auth/config` fetched once and cached in `twoFactorEnabledRef` (not re-fetched per login)
- `performLogout()` clears both `emd-user` and `emd-token` from sessionStorage
- `managedUsers` initializes as `[]`; populated by `fetchUsers()` from server (admin only)
- Removed `logAudit` and `getSettings` imports — server handles audit, server decides 2FA

**Task 2 — authHeaders.ts + LoginPage.tsx:**
- `authHeaders.ts`: reads raw JWT from `sessionStorage('emd-token')`, returns `{ Authorization: 'Bearer <jwt>' }` — eliminates `btoa(JSON.stringify(...))` fake token
- `LoginPage.tsx`: `handleCredentials` and `handleOtp` are now `async`
- Removed `getSettings()` call — server's `/api/auth/login` response decides whether 2FA is needed
- Added `challengeToken` state; populated when server returns `otp_required`, passed as 4th arg to `login()` for the OTP step
- Error handling: `otp_required` -> transition to OTP step, `account_locked` -> lockout message, `invalid_credentials` -> generic password error, `network_error` -> generic failure

## Verification Results

- `npx tsc --noEmit`: exits 0 (no type errors)
- `npm run build`: succeeds, 2335 modules transformed
- No `DEFAULT_CREDENTIALS`, `VALID_OTP`, `DEFAULT_MANAGED_USERS` in `src/`
- No `btoa(` in `src/services/authHeaders.ts`
- `emd-token` referenced in both `AuthContext.tsx` and `authHeaders.ts`
- `grep "api/auth/login" src/context/AuthContext.tsx`: match found

## Deviations from Plan

None — plan executed exactly as written.

The plan described Option A for challengeToken passing (4th parameter to login) and that was implemented as specified.

## Known Stubs

None. All login paths wire to real server endpoints. `managedUsers` is populated from `GET /api/auth/users` (admin only, via `fetchUsers()`).

## Threat Flags

No new security surface introduced beyond what is documented in the plan's threat model (T-04-04-01 through T-04-04-06). JWT decode on client is read-only for display; all authorization enforced server-side.

## Self-Check: PASSED

- `src/context/AuthContext.tsx`: exists, contains `fetch('/api/auth/login'`
- `src/services/authHeaders.ts`: exists, contains `emd-token`, no `btoa(`
- `src/pages/LoginPage.tsx`: exists, contains `await login(`, no `getSettings()`
- Commit `676124a`: present in git log
- Commit `c798c28`: present in git log
