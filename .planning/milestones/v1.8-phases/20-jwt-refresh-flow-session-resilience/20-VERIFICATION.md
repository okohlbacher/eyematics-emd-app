---
phase: 20-jwt-refresh-flow-session-resilience
verified: 2026-04-23T10:18:00Z
status: human_needed
score: 32/32 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Active-user smoke test — silent refresh past 10-min boundary"
    expected: "Login, set sessionStorage emd-token expiry to <now>, trigger any /api/* call. Network tab shows original 401 → POST /api/auth/refresh 200 → original retried 200. UI never prompts re-login. devtools shows emd-refresh (HttpOnly, Path=/api/auth/refresh) and emd-csrf (non-HttpOnly) cookies present."
    why_human: "Real-time browser behavior + DevTools cookie inspection cannot be programmatically verified; jsdom mocks BroadcastChannel and cannot exercise actual same-origin cross-tab message delivery."
  - test: "Multi-tab BroadcastChannel adoption"
    expected: "Open two tabs to the app; in tab A force a 401 (delete emd-token); confirm tab B's sessionStorage.emd-token updates to the new token without firing its own /api/auth/refresh request (verify in tab B's Network panel)."
    why_human: "Native browser BroadcastChannel cross-tab semantics cannot be exercised in jsdom; requires two real same-origin tabs."
  - test: "Audit DB silence for 200 refresh, presence for 401 refresh and every logout"
    expected: "Tail data/audit.db (or query via /api/audit) after multiple successful refresh cycles → zero rows with path=/api/auth/refresh, status=200. Force a 401 refresh (e.g., bump tokenVersion server-side) → row appears with status=401. Logout → row appears with status=200, action=audit_action_logout. AuditPage UI displays 'Token refreshed' / 'Token erneuert' / 'Logout' / 'Abmeldung' (no audit_action_unknown raw)."
    why_human: "End-to-end audit row visibility in the UI requires running server + browser; unit tests cover the middleware + describeAction logic in isolation but cannot prove integration."
  - test: "Idle-logout still fires at 10 minutes regardless of refresh validity"
    expected: "Login, leave tab idle (no mouse/keyboard activity) for 10 minutes; user is logged out at INACTIVITY_TIMEOUT despite a valid refresh token. D-25 contract preserved."
    why_human: "Real-time 10-minute idle countdown cannot be exercised programmatically without time-mocking the production AuthContext; static-source assertion in tests confirms the constant is unchanged but does not prove runtime behavior."
  - test: "Absolute session cap forces re-auth at 12h"
    expected: "Login, age the refresh token's iat past auth.refreshAbsoluteCapMs (default 43,200,000 ms = 12h); next /api/auth/refresh returns 401 'Session cap exceeded'; client falls through to /login."
    why_human: "Requires either a 12-hour wait or server-side time manipulation; covered server-side by tests/authRefresh.test.ts (absolute-cap test back-dates iat) but end-to-end browser experience needs human walkthrough."
---

# Phase 20: JWT Refresh Flow & Session Resilience — Verification Report

**Phase Goal:** Active users stay logged in beyond the 10-min access-token boundary without any session-expiry UX, while absolute session caps and credential-mutation invalidation preserve v1.7's security posture.

**Verified:** 2026-04-23T10:18:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria — 6)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | Active user crosses 10-min boundary; authFetch silent refresh + retry once; single-flight + retry guard prevents loops | VERIFIED | `src/services/authHeaders.ts` lines 13 (`RETRY_GUARD_HEADER`), 17 (`refreshPromise`), 97 (single-flight), 114 (`refreshPromise = null` in finally). 10 tests in `tests/authFetchRefresh.test.ts` covering silent refresh, single-flight (5 concurrent → 1 refresh), retry guard, refresh failure paths — all green. |
| SC2 | 10-min idle timer still fires; configurable absolute cap (8h/12h) forces re-auth | VERIFIED | `src/context/AuthContext.tsx:64` `INACTIVITY_TIMEOUT = 10 * 60 * 1000` unchanged (D-25). `server/authApi.ts:365` `Session cap exceeded` path; settings keys present in `config/settings.yaml:11-13`. |
| SC3 | After admin/self credential change, outstanding refresh tokens rejected on next use | VERIFIED | `server/authApi.ts` lines 718, 760, 853, 897, 944 — 5 mutation paths bump `tokenVersion + *ChangedAt` atomically. Refresh handler line 375 enforces `payload.ver === user.tokenVersion`. 6 tests in `tests/credentialMutationInvalidation.test.ts` green. |
| SC4 | httpOnly Secure SameSite=Strict refresh cookie scoped to /api/auth/refresh; CSRF; logout clears both | VERIFIED | `server/authApi.ts:111` `path: '/api/auth/refresh'`; `emitRefreshCookies` helper at line 98; logout handler line 422 bumps tokenVersion + clears cookies (Max-Age=0). `requireCsrf` middleware at `server/authMiddleware.ts:202`. |
| SC5 | BroadcastChannel cross-tab; successful refresh excluded from audit.db; failed refresh + logout audited with new i18n keys | VERIFIED | `src/services/authHeaders.ts:21` `new BroadcastChannel('emd-auth')`. `server/auditMiddleware.ts:87` `SKIP_AUDIT_IF_STATUS = { '/api/auth/refresh': new Set([200]) }`; line 180 conditional skip after the unconditional check. `src/i18n/translations.ts:434` `audit_action_refresh` (DE+EN); `audit_action_logout` already at line 433. `src/pages/audit/auditFormatters.ts:20-21` describeAction maps both. |
| SC6 | All jwt.verify route through server/jwtUtil.ts HS256-pinned; ESLint forbids direct jsonwebtoken imports | VERIFIED | `server/jwtUtil.ts:88,99,144` use `algorithms: ALGS` (top-of-file constant). `eslint.config.js:55-58` `no-restricted-imports` rule banning `jsonwebtoken` outside ignores. `grep -rn "^import jwt from 'jsonwebtoken'" server/` returns exactly two files: `server/jwtUtil.ts:22` and `server/keycloakJwt.ts:17`. ESLint probe in 20-02 SUMMARY confirms rule fires. |

**Score:** 6/6 ROADMAP success criteria verified

### Plan-Level Must-Have Truths (aggregated across plans 01-04 — 32 total)

| # | Truth | Plan | Status | Evidence |
|---|-------|------|--------|----------|
| 1 | POST /refresh with valid cookie + matching CSRF → 200 + fresh access + rotated cookie | 01 | VERIFIED | `server/authApi.ts:340-401`; tests/authRefresh.test.ts |
| 2 | POST /refresh missing/mismatched X-CSRF-Token → 403 | 01 | VERIFIED | `requireCsrf` at authMiddleware.ts:202; tests/authRefresh.test.ts |
| 3 | POST /refresh older than refreshAbsoluteCapMs → 401 'Session cap exceeded' | 01 | VERIFIED | authApi.ts:365; tests/authRefresh.test.ts |
| 4 | POST /refresh with stale ver → 401 'Token version stale' | 01 | VERIFIED | authApi.ts:375-377; tests/authRefresh.test.ts |
| 5 | POST /logout clears both cookies + bumps tokenVersion | 01 | VERIFIED | authApi.ts:417-440; tests/authRefresh.test.ts |
| 6 | POST /login response includes both cookies with documented attrs | 01 | VERIFIED | emitRefreshCookies at authApi.ts:98-117; called from /login (212) and /verify (330) |
| 7 | verifyAccessToken rejects typ:'refresh'; verifyRefreshToken rejects typ:'access' | 01 | VERIFIED | jwtUtil.ts:88-92, 99-103; tests/jwtUtil.test.ts |
| 8 | verifyAccessToken rejects RS256-signed token (alg pin) | 01 | VERIFIED | `algorithms: ALGS = ['HS256']`; tests/jwtUtil.test.ts |
| 9 | users.json lazy migration adds tokenVersion/passwordChangedAt/totpChangedAt | 01 | VERIFIED | `_migrateSessionFields` in initAuth.ts; tests/initAuthMigration.test.ts |
| 10 | settings.yaml auth namespace parses; getAuthSettings() returns defaults when absent | 01 | VERIFIED | settingsApi.ts:91-103, 114-131; tests/settingsAuthSchema.test.ts |
| 11 | ESLint blocks direct jsonwebtoken import outside jwtUtil.ts/keycloakJwt.ts | 02 | VERIFIED | eslint.config.js:46-58; probe documented in 20-02 SUMMARY |
| 12 | All jwt.* in authApi.ts route through jwtUtil | 02 | VERIFIED | grep returns 0 direct jsonwebtoken imports in authApi.ts |
| 13 | All jwt.verify in authMiddleware.ts route through verifyAccessToken (Keycloak factored to keycloakJwt.ts) | 02 | VERIFIED | grep returns 0 direct jsonwebtoken imports in authMiddleware.ts |
| 14 | Admin password reset bumps tokenVersion + passwordChangedAt | 02 | VERIFIED | authApi.ts:718-719; tests/credentialMutationInvalidation.test.ts |
| 15 | Admin TOTP reset bumps tokenVersion + totpChangedAt | 02 | VERIFIED | authApi.ts:944-945; same test file |
| 16 | Self password change bumps tokenVersion + passwordChangedAt | 02 | VERIFIED | authApi.ts:760-761; same test file |
| 17 | Self TOTP confirm bumps tokenVersion + totpChangedAt | 02 | VERIFIED | authApi.ts:853; same test file |
| 18 | Self TOTP disable bumps tokenVersion + totpChangedAt | 02 | VERIFIED | authApi.ts:897-898; same test file |
| 19 | Successful (200) /api/auth/refresh produces ZERO audit rows | 03 | VERIFIED | auditMiddleware.ts:87-88, 180; tests/auditMiddleware.test.ts |
| 20 | Failed (401/403) /api/auth/refresh DOES produce audit row | 03 | VERIFIED | conditional skip only fires on 200; tests/auditMiddleware.test.ts |
| 21 | POST /api/auth/logout always produces audit row | 03 | VERIFIED | not in SKIP_AUDIT_IF_STATUS; tests/auditMiddleware.test.ts |
| 22 | Refresh + logout bodies redacted | 03 | VERIFIED | auditMiddleware.ts:42-43 in REDACT_PATHS |
| 23 | audit_action_refresh i18n DE+EN exists | 03 | VERIFIED | translations.ts:434 |
| 24 | describeAction maps refresh + logout | 03 | VERIFIED | auditFormatters.ts:20-21; tests/auditFormatters.test.ts (6/6 green) |
| 25 | authFetch 401 → silent refresh + retry once | 04 | VERIFIED | authHeaders.ts:124+; tests/authFetchRefresh.test.ts |
| 26 | 5 concurrent 401s → 1 refresh (single-flight) | 04 | VERIFIED | refreshPromise dedup; same test file |
| 27 | Retried request 401 → no second refresh | 04 | VERIFIED | RETRY_GUARD_HEADER check; same test file |
| 28 | Refresh fails → fall through to logout/redirect | 04 | VERIFIED | handleAuthFailure path; same test file |
| 29 | BroadcastChannel refresh-success broadcast + sibling adoption | 04 | VERIFIED | authHeaders.ts BC listener; same test file |
| 30 | BroadcastChannel logout broadcast + sibling clear | 04 | VERIFIED | broadcastLogout export at line 58; same test file |
| 31 | AuthContext.logout invokes server logout + broadcastLogout | 04 | VERIFIED | AuthContext.tsx:145-147; same test file |
| 32 | INACTIVITY_TIMEOUT preserved (D-25) | 04 | VERIFIED | AuthContext.tsx:64 — `10 * 60 * 1000` unchanged |

**Score:** 32/32 plan must-haves verified

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| server/jwtUtil.ts | VERIFIED | 149 LOC; exports signAccess/Refresh/ChallengeToken + verify counterparts; ALGS pinned |
| server/keycloakJwt.ts | VERIFIED | 41 LOC; isolates RS256 path from HS256 module |
| server/authApi.ts | VERIFIED | /refresh + /logout handlers; emitRefreshCookies; 5 mutation bumps |
| server/authMiddleware.ts | VERIFIED | requireCsrf at line 202; PUBLIC_PATHS includes /api/auth/refresh |
| server/initAuth.ts | VERIFIED | _migrateSessionFields chained into _migrateUsersJson |
| server/settingsApi.ts | VERIFIED | Auth namespace validation + getAuthSettings() |
| server/auditMiddleware.ts | VERIFIED | SKIP_AUDIT_IF_STATUS + REDACT_PATHS extensions |
| server/index.ts | VERIFIED | cookieParser at line 197 (before audit/auth middleware at 219/222) |
| config/settings.yaml | VERIFIED | auth namespace with refresh defaults |
| eslint.config.js | VERIFIED | no-restricted-imports rule with proper ignores |
| src/services/authHeaders.ts | VERIFIED | 174 LOC (target ≥80); single-flight + retry guard + BC + CSRF |
| src/context/AuthContext.tsx | VERIFIED | logout fires serverLogout + broadcastLogout; idle timer untouched |
| src/i18n/translations.ts | VERIFIED | audit_action_refresh added at line 434 |
| src/pages/audit/auditFormatters.ts | VERIFIED | refresh + logout describeAction mappings at lines 20-21 |
| Test files (jwtUtil, authRefresh, credentialMutationInvalidation, authFetchRefresh, auditFormatters, settingsAuthSchema) | VERIFIED | All 6 created; 74/74 phase-20-touched tests passing |

### Key Link Verification

| From | To | Via | Status |
|------|-----|-----|--------|
| server/index.ts | cookie-parser | `app.use(cookieParser())` at line 197 (before middleware at 219, 222) | WIRED |
| server/authApi.ts /refresh | jwtUtil.verifyRefreshToken | named import + call at line 356 | WIRED |
| server/authApi.ts /refresh | tokenVersion check | line 375 `if ((user.tokenVersion ?? 0) !== payload.ver)` | WIRED |
| server/authMiddleware.ts PUBLIC_PATHS | /api/auth/refresh | line 50 | WIRED |
| eslint.config.js | jwtUtil.ts/keycloakJwt.ts (allowed) | `ignores: [...]` line 53 | WIRED |
| authApi.ts admin pwd reset | tokenVersion + passwordChangedAt bump | lines 718-719 atomic in same modifyUsers callback | WIRED |
| authMiddleware.ts requireAuth | jwtUtil.verifyAccessToken | imported and called | WIRED |
| auditMiddleware res.on('finish') | SKIP_AUDIT_IF_STATUS conditional | line 180 after unconditional check | WIRED |
| auditFormatters describeAction | audit_action_refresh translation | line 20 | WIRED |
| authHeaders authFetch | refreshAccessToken on 401 | RETRY_GUARD_HEADER pattern | WIRED |
| authHeaders refreshAccessToken | module-level refreshPromise | single-flight at line 97 | WIRED |
| authHeaders BC listener | sessionStorage adoption | implemented per Plan 04 | WIRED |
| AuthContext logout | POST /api/auth/logout + broadcastLogout | lines 145-147 | WIRED |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|------------|-------------|--------|----------|
| SESSION-01 | 04 | Active user silent refresh past 10-min boundary | SATISFIED | tests/authFetchRefresh.test.ts (10 tests) |
| SESSION-02 | 01+04 | Idle 10-min logout preserved + absolute cap | SATISFIED | INACTIVITY_TIMEOUT unchanged + Session cap exceeded path |
| SESSION-03 | 02 | Credential mutations invalidate refresh tokens | SATISFIED | 5 endpoints bump; 6 tests green |
| SESSION-04 | 01 | httpOnly Secure SameSite=Strict refresh cookie scoped + logout clears | SATISFIED | emitRefreshCookies + tests/authRefresh.test.ts cookie-attr assertions |
| SESSION-05 | 04+03 | BroadcastChannel cross-tab + audit silence/i18n | SATISFIED | BC tests + auditMiddleware status-conditional + auditFormatters tests |
| SESSION-06 | 01+02 | jwtUtil HS256-pin + ESLint guard | SATISFIED | tests/jwtUtil.test.ts + lint probe |
| SESSION-07 | 01 | CSRF protection on refresh + logout | SATISFIED | requireCsrf middleware + 403 tests |
| SESSION-08 | 01 | Refresh-token rolling rotation | SATISFIED | sid-preserved rotation tested |
| SESSION-09 | 03 | Audit i18n keys for refresh + logout (DE+EN) | SATISFIED | translations.ts:433-434; auditFormatters tests |
| SESSION-12 | 01 | Configurable session caps via settings.yaml | SATISFIED | settingsApi.ts + tests/settingsAuthSchema.test.ts |
| SESSION-13 | 03 | describeAction extension for refresh/logout | SATISFIED | auditFormatters.ts:20-21; tests/auditFormatters.test.ts |

All 11 declared requirements satisfied. No orphaned requirements.

### Anti-Patterns Found

None. Spot-checked all 14 modified/created source files for placeholders, TODOs, empty handlers, hardcoded empties. All exhibit substantive implementations with documented business logic.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase-20 test suite | `npx vitest run tests/{jwtUtil,authRefresh,credentialMutationInvalidation,authFetchRefresh,auditFormatters,settingsAuthSchema,initAuthMigration,auditMiddleware}.test.ts` | 74/74 passing | PASS |
| Auth/audit regression suite | `npx vitest run tests/{authMiddlewareLocal,authMiddlewareKeycloak,auditPageReducer,auditPageCharacterization.test.tsx,userCrud,authHeaders}.test.ts` | 92/92 passing | PASS |
| jsonwebtoken import isolation | `grep -rn "^import jwt from 'jsonwebtoken'" server/` | exactly 2 matches: jwtUtil.ts, keycloakJwt.ts | PASS |
| cookie-parser mount order | grep cookieParser/auditMiddleware/authMiddleware lines in server/index.ts | 197 < 219 < 222 | PASS |
| INACTIVITY_TIMEOUT preserved | grep `10 * 60 * 1000` in AuthContext.tsx | line 64, unchanged | PASS |

### Pre-existing Failures (Out of Scope)

Per `.planning/phases/20-jwt-refresh-flow-session-resilience/deferred-items.md`, 3 pre-existing test failures predate Phase 20 (verified at base commit `34d9396`):

- `tests/outcomesPanelCrt.test.tsx` (2 — Phase 13 CRT metric scope)
- `tests/OutcomesPage.test.tsx` (1 — Phase 11 audit beacon scope)

These do not touch any Phase 20 surface and remain out of scope per the verification override / deferred-items.md.

### Human Verification Required

5 items require human testing — see `human_verification:` frontmatter for the full structured list:

1. Active-user smoke test — silent refresh past 10-min boundary (DevTools cookie inspection)
2. Multi-tab BroadcastChannel adoption (real cross-tab semantics)
3. Audit DB silence/visibility verification end-to-end (server + browser)
4. Idle-logout still fires at 10 minutes (real-time countdown)
5. Absolute session cap forces re-auth at 12h (long-duration walkthrough)

### Gaps Summary

No automated gaps. All 32 plan must-haves and all 6 ROADMAP success criteria are verified by file-level grep, code-structure inspection, and test-suite execution. All 11 SESSION-XX requirements are satisfied by the code as committed. The phase passes all programmatic checks; the only outstanding work is human walkthrough of the 5 enumerated runtime behaviors that cannot be exercised in jsdom or short-duration test runs.

---

*Verified: 2026-04-23T10:18:00Z*
*Verifier: Claude (gsd-verifier)*
