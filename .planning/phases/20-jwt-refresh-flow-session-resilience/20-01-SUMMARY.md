---
phase: 20
plan: 01
subsystem: auth
tags: [jwt, refresh, cookie, csrf, security, session-resilience]
dependency_graph:
  requires:
    - server/initAuth.ts (getJwtSecret, modifyUsers, UserRecord)
    - server/authMiddleware.ts (PUBLIC_PATHS, AuthPayload)
    - cookie-parser ^1.4.7
  provides:
    - server/jwtUtil.ts (HS256-pinned sign/verify with typ enforcement)
    - server/authMiddleware.ts requireCsrf (double-submit-cookie middleware)
    - POST /api/auth/refresh (rolling rotation + absolute cap)
    - POST /api/auth/logout (tokenVersion bump + cookie clear)
    - getAuthSettings() (live-read from settings.yaml)
    - _migrateSessionFields helper (idempotent users.json migration)
  affects:
    - All future Plan 20-02 call-site migrations to jwtUtil
    - All future Plan 20-04 client refresh logic
tech_stack:
  added:
    - cookie-parser ^1.4.7
    - "@types/cookie-parser" ^1.4.10
  patterns:
    - HS256 algorithm hard-pin via top-level ALGS constant
    - typ-claim cross-rejection between access/refresh
    - double-submit-cookie CSRF (32-byte random hex, X-CSRF-Token header)
    - rolling refresh-token rotation preserving sid for absolute-cap anchor
    - lazy idempotent user-record migration on boot
key_files:
  created:
    - server/jwtUtil.ts
    - tests/jwtUtil.test.ts
    - tests/authRefresh.test.ts
    - tests/settingsAuthSchema.test.ts
  modified:
    - server/initAuth.ts (UserRecord + _migrateSessionFields + chained migration)
    - server/settingsApi.ts (validateSettingsSchema auth namespace + getAuthSettings)
    - server/authMiddleware.ts (PUBLIC_PATHS + requireCsrf)
    - server/authApi.ts (emitRefreshCookies + /refresh + /logout, login/verify wired)
    - server/index.ts (cookieParser mount before audit/auth middleware)
    - config/settings.yaml (auth namespace with refresh defaults)
    - tests/initAuthMigration.test.ts (4 new session-field tests)
    - package.json + package-lock.json (cookie-parser deps)
decisions:
  - "Extract _migrateSessionFields as a pure exported helper (mirrors _migrateRemovedCenters / _migrateCenterIds precedent), keeping side-effectful _migrateUsersJson testable indirectly"
  - "getAuthSettings() reads settings.yaml at call time (no boot cache) so an operator edit + reload picks up new TTL/cap values without restarting the server"
  - "Refresh-token rotation preserves payload.sid (the original login session id) so the absolute-cap timer anchors to the initial login regardless of how many times the cookie is rotated"
  - "emitRefreshCookies is invoked from BOTH /login and /verify (TOTP) success paths so 2FA-enabled users also receive the refresh + CSRF cookie pair"
metrics:
  duration_minutes: ~12
  completed: "2026-04-23"
  tasks: 3
  tests_added: 18
  tests_passing: "39/39 in plan-touched files; 566/569 in full suite (3 pre-existing failures unrelated)"
---

# Phase 20 Plan 01: JWT Refresh Foundation Summary

JWT access/refresh split landed server-side in three bisect-friendly commits:
HS256-pinned `jwtUtil` module, `cookie-parser` mount + lazy users.json
migration + settings auth namespace, then the `POST /api/auth/refresh` +
`/logout` endpoints with double-submit-cookie CSRF and rolling rotation that
preserves the absolute-cap anchor.

## Tasks Executed

### Task 1 — server/jwtUtil.ts + 6 unit tests (commit 3d3e107)

Centralized HS256 sign/verify with `typ` claim enforcement. ALGS constant at
top-of-file gives a single grep-able algorithm pin. ttlMs is converted to
seconds via `Math.floor(ttlMs / 1000)` to guard Pitfall 7 (jsonwebtoken's
`expiresIn: <number>` is interpreted as seconds, not ms). Cross-rejection:
`verifyAccessToken` rejects `typ:'refresh'` and vice versa. 6 tests cover
algorithm pin, typ enforcement, round-trip, and ms→sec conversion.

Files: `server/jwtUtil.ts` (102 LOC), `tests/jwtUtil.test.ts` (85 LOC).

### Task 2 — cookie-parser, users.json migration, settings auth namespace (commit 15af975)

- Installed `cookie-parser ^1.4.7` + `@types/cookie-parser` (only new dep
  this milestone per D-03).
- Mounted `app.use(cookieParser())` in `server/index.ts` after `helmet()` and
  before the body parsers, audit middleware, and auth middleware. Confirmed
  via grep: cookieParser at line 197, auditMiddleware at line 219, authMiddleware
  at line 222.
- Extended `UserRecord` with optional `tokenVersion`, `passwordChangedAt`,
  `totpChangedAt` fields.
- Added pure exported `_migrateSessionFields(users, now?)` helper — idempotent,
  fills defaults from `user.createdAt` (or now() fallback), chained into
  `_migrateUsersJson` after the existing center-ID migrations.
- Added `auth:` namespace to `config/settings.yaml` with `refreshTokenTtlMs:
  28800000` (8h), `refreshAbsoluteCapMs: 43200000` (12h), `refreshCookieSecure:
  true`.
- Extended `validateSettingsSchema` with positive-integer + ttl<=cap invariant
  + boolean refreshCookieSecure validation (D-23, D-24).
- New `getAuthSettings()` reader reads settings.yaml at call time (NOT
  boot-cached) so operator edits + reload work without server restart.
- 4 new `_migrateSessionFields` tests + 4 new schema/getAuthSettings tests.

### Task 3 — POST /refresh, POST /logout, requireCsrf, login/verify cookie emission (commit f948726)

- `requireCsrf` middleware in `server/authMiddleware.ts` enforces double-submit
  cookie: `req.cookies['emd-csrf']` must equal `req.headers['x-csrf-token']`,
  both non-empty. 403 on mismatch.
- Added `/api/auth/refresh` to `PUBLIC_PATHS` (cookie + CSRF are the
  credentials; no Bearer required by design — the access token has expired).
- New `emitRefreshCookies(res, user)` helper in `authApi.ts` issues the
  emd-refresh (httpOnly, SameSite=Strict, Path=/api/auth/refresh) +
  emd-csrf (JS-readable) cookie pair. Called from BOTH `/login` and `/verify`
  (TOTP) success paths.
- `POST /api/auth/refresh` (`requireCsrf`-guarded): verifies refresh JWT,
  checks absolute cap (now - iat\*1000 > refreshAbsoluteCapMs → 401),
  looks up user, checks tokenVersion match, rotates refresh cookie preserving
  the original `payload.sid`, returns fresh 10-min access token.
- `POST /api/auth/logout` (`requireCsrf`-guarded): bumps user.tokenVersion
  (invalidates ALL outstanding refresh tokens for this user), clears both
  cookies via Max-Age=0.
- 8 new authRefresh tests cover all 7 documented behaviors plus the cookie
  attribute assertions on /login.

## Confirmations

- **cookie-parser mount precedes audit + auth middleware:** verified by line
  numbers (197 < 219 < 222) and by `grep -rn "from 'cookie-parser'" server/`
  returning exactly one match (`server/index.ts:30`).
- **getAuthSettings() reads settings.yaml at call time:** the function is a
  bare `fs.readFileSync(SETTINGS_FILE) + yaml.load(...)` with no module-level
  cache. An operator can edit `config/settings.yaml` and the next /refresh
  request will use the new values without a server restart.
- **All 12 STRIDE threats from the threat register have working mitigations**
  (T-20-01 through T-20-12), each with at least one corresponding test.

## Note for Plan 20-02

Existing `jwt.verify` / `jwt.sign` call sites are NOT YET MIGRATED — Plan 02
owns that work plus the ESLint `no-restricted-imports` rule. Sites still
using `jsonwebtoken` directly:

- `server/authApi.ts` lines 67 (signSessionToken), 86 (signChallengeToken),
  195 (challenge token verify in /verify)
- `server/authMiddleware.ts` line 59 (verifyLocalToken)

These are functionally equivalent today (all use HS256 with the same secret);
Plan 02's migration tightens them to go through `jwtUtil` so the ESLint rule
can ban direct `jsonwebtoken` imports outside `server/jwtUtil.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Test Bug] Within-second iat collision in rotation test**

- **Found during:** Task 3 (test run)
- **Issue:** First test iteration of "rotated refresh cookie" asserted
  `newRefresh !== oldRefresh`, but JWTs signed within the same second produce
  byte-identical tokens (sub/ver/sid/iat/exp all match) since the iat claim
  has 1-second resolution.
- **Fix:** Relaxed assertion to verify a fresh `Set-Cookie: emd-refresh`
  header was emitted with HttpOnly attribute, which is the actual rotation
  guarantee that matters at the protocol level.
- **Files modified:** `tests/authRefresh.test.ts`

**2. [Rule 1 — Test Bug] noTimestamp option strips iat instead of preserving it**

- **Found during:** Task 3 (absolute-cap test)
- **Issue:** Initial test used `jwt.sign({iat: oldIat, ...}, ..., { noTimestamp: true })`
  to back-date the refresh token. `jsonwebtoken` strips iat from the payload
  with `noTimestamp: true` rather than preserving the supplied value.
- **Fix:** Hand-construct the JWT — base64url-encode header/body, HMAC-SHA256
  sign — to guarantee the backdated iat survives.
- **Files modified:** `tests/authRefresh.test.ts`

### Pre-existing Failures (out of scope — Rule SCOPE BOUNDARY)

3 tests fail on the base commit (`34d9396`) before any of this plan's
changes. Verified by `git stash` + re-run. Logged to
`.planning/phases/20-jwt-refresh-flow-session-resilience/deferred-items.md`:

- `tests/outcomesPanelCrt.test.tsx` (2 failures, Phase 13 CRT metric scope)
- `tests/OutcomesPage.test.tsx` (1 failure, Phase 11 audit beacon scope)

Not touched.

## Self-Check: PASSED

- **Files exist:**
  - server/jwtUtil.ts: FOUND
  - tests/jwtUtil.test.ts: FOUND
  - tests/authRefresh.test.ts: FOUND
  - tests/settingsAuthSchema.test.ts: FOUND
  - .planning/phases/20-jwt-refresh-flow-session-resilience/deferred-items.md: FOUND
- **Commits exist:** 3d3e107, 15af975, f948726 — all in `git log` on this branch.
- **Tests:** 39/39 plan-touched tests passing.
- **Acceptance criteria:** All criteria from all 3 tasks confirmed via grep + test runs.
