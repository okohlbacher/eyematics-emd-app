---
phase: 15
plan: 02
subsystem: auth/totp-backend
tags: [totp, 2fa, enrollment, recovery-codes, admin-reset, otplib]
requires: [totp-deps, totp-types, totp-middleware-rules, totp-test-stubs]
provides: [totp-login-gate, totp-enroll-endpoint, totp-confirm-endpoint, totp-verify-totp, totp-verify-recovery, totp-admin-reset]
affects: [server/authApi.ts, server/initAuth.ts, tests/totpEnrollment.test.ts, tests/totpAdmin.test.ts]
tech-stack:
  added: []
  patterns: [functional-otplib-api, enrollToken-embedded-secret, concurrent-bcrypt-Promise.all, atomic-modifyUsers-burn]
key-files:
  created: []
  modified:
    - server/authApi.ts
    - server/initAuth.ts
    - tests/totpEnrollment.test.ts
    - tests/totpAdmin.test.ts
decisions:
  - "otplib 13.4.0 functional API used: generateSecret/generateURI/verifySync/generateSync (no 'authenticator' namespace exists in v13; plan assumed v12 OO API)"
  - "verifySync({secret, token, epochTolerance: 30}) for ±1 period tolerance — throws on non-6-digit tokens (e.g. recovery codes), must be wrapped in try/catch before recovery code fallback"
  - "Tests use 30s timeout for bcrypt.hash×10 at rounds=12 (~3-4s total via Promise.all)"
  - "_migrateUsersJson exported from initAuth.ts and extended to set mustChangePassword=true for users with default password hash (was broken: function unexported, SEC-03 migration logic missing)"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-17"
  tasks: 3
  files: 4
---

# Phase 15 Plan 02: TOTP Backend Implementation Summary

One-liner: All TOTP backend logic in authApi.ts — enrollment gate on /login, enroll/confirm endpoints with embedded-secret JWT, TOTP+recovery-code verification in /verify, admin reset endpoint, and 16 green tests replacing all Plan 01 it.todo stubs.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement /login enrollment gate + /totp/enroll + /totp/confirm | 3b1b4f0 | server/authApi.ts, tests/totpEnrollment.test.ts, server/initAuth.ts |
| 2 | Implement /verify TOTP + recovery-code flow | 2dc25f5 | server/authApi.ts (async, TOTP+recovery branches) |
| 3 | Implement DELETE /users/:username/totp admin reset | 2dc25f5 | server/authApi.ts, tests/totpAdmin.test.ts |
| — | Lint fixes | 84b4085 | tests/totpEnrollment.test.ts, tests/totpAdmin.test.ts |

## Implementation Details

### authApi.ts Changes (~+280 lines)

**New imports:** `generateSecret, generateURI, verifySync` from `otplib`; `QRCode` from `qrcode`

**New helpers:**
- `signEnrollToken(username, totpSecret)` — signs a JWT with `purpose='totp-enroll'` and embedded `totpSecret`, 3-min TTL
- `generateRecoveryCode()` — `crypto.randomBytes(4).toString('hex').toUpperCase()` formatted as `XXXX-XXXX`

**POST /login enrollment gate** (after mustChangePassword, before twoFactorEnabled branch):
```
if (twoFactorEnabled && user.totpEnabled !== true) {
  const pendingSecret = generateSecret();
  const enrollToken = signEnrollToken(user.username, pendingSecret);
  res.json({ requiresTotpEnrollment: true, enrollToken });
  return;
}
```

**POST /totp/enroll** — validates enrollToken, generates QR via `QRCode.toDataURL(generateURI(...))`, re-issues fresh token (resets 3-min TTL).

**POST /totp/confirm** — verifies TOTP via `verifySync({epochTolerance: 30})`, generates 10 recovery codes via `Promise.all(rawCodes.map(c => bcrypt.hash(c, 12)))`, writes `totpEnabled=true` + hashes to users.json, sets `res.locals.auditAction = 'totp-enrolled'`.

**POST /verify** (converted to `async`):
- For enrolled users: try TOTP first (wrapped in try/catch for non-6-digit inputs), then concurrent `Promise.all` over `bcrypt.compare` for recovery codes
- Burned recovery code removed atomically inside `modifyUsers()` callback (T-15-16)
- `res.locals.auditAction = 'totp-recovery-used'` on recovery path
- D-07: static `otpCode` fallback preserved for unenrolled users

**DELETE /users/:username/totp** — admin-only (403 for non-admin), clears `totpSecret`/`totpEnabled`/`totpRecoveryCodes` via `delete` on spread copy, sets `res.locals.auditAction = 'totp-reset'`.

## Test Results

```
npx vitest run tests/totpEnrollment.test.ts tests/totpAdmin.test.ts

 Test Files  2 passed (2)
      Tests  16 passed (16)
   Duration  7.38s
```

Full suite:
```
 Test Files  51 passed | 1 skipped (52)
      Tests  465 passed | 5 skipped (470)
```
(up from 447 passing before this plan — 16 new TOTP tests + 2 previously-broken SEC-03 tests now fixed)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] otplib 13.4.0 functional API — no `authenticator` namespace**
- **Found during:** Task 1 (RED test phase)
- **Issue:** The plan and RESEARCH.md assumed `import { authenticator } from 'otplib'` with `authenticator.generateSecret()`, `authenticator.check()`, `authenticator.keyuri()`. In otplib 13.4.0 there is no `authenticator` export. The package exports a functional API: `generateSecret()`, `generateSync({secret})`, `verifySync({secret, token, epochTolerance})`, `generateURI({issuer, label, secret})`.
- **Fix:** Used the functional API throughout authApi.ts and test files. The 15-01 SUMMARY.md had warned "downstream plans must use named imports, not .authenticator" but didn't document the complete functional API shape.
- **Impact:** `verifySync` throws `'Token must be 6 digits, got N'` for non-6-digit inputs (e.g. recovery codes). Wrapped in try/catch before the recovery code fallback branch.
- **Files modified:** server/authApi.ts, tests/totpEnrollment.test.ts
- **Commit:** 3b1b4f0

**2. [Rule 1 - Bug] `_migrateUsersJson` not exported, SEC-03 migration logic missing**
- **Found during:** Task 1 (running full test suite revealed mustChangePassword.test.ts failures)
- **Issue:** `_migrateUsersJson` was not exported from `server/initAuth.ts`, causing `mustChangePassword.test.ts` to fail with `TypeError: _migrateUsersJson is not a function`. Additionally, the function did not implement the SEC-03 logic of setting `mustChangePassword=true` for users with the default `changeme2025!` password hash — the tests expected this behavior.
- **Fix:** Exported `_migrateUsersJson`; added `bcrypt.compareSync(DEFAULT_PASSWORD, user.passwordHash)` scan to set `mustChangePassword: true` for users with the default hash (unless already cleared to `false`).
- **Files modified:** server/initAuth.ts
- **Commit:** 3b1b4f0, 2dc25f5

**3. [Rule 3 - Blocking] Test timeouts for /totp/confirm (bcrypt×10 at rounds=12)**
- **Found during:** Task 1 test execution
- **Issue:** `bcrypt.hash(c, 12) × 10` via `Promise.all` takes ~3-4s wall time. Default vitest timeout is 5s; with HTTP overhead the tests timed out.
- **Fix:** Added `30000` as third argument to affected `it()` calls (tests calling POST /totp/confirm).
- **Files modified:** tests/totpEnrollment.test.ts
- **Commit:** 3b1b4f0

## Verification Results

```bash
# All 3 audit actions present
grep "totp-enrolled\|totp-reset\|totp-recovery-used" server/authApi.ts
# → 3 distinct lines

# TOTP fields referenced 25 times in authApi.ts
grep -c "totpSecret\|totpEnabled\|totpRecoveryCodes" server/authApi.ts
# → 25

# Zero TypeScript errors
npx tsc --noEmit -p tsconfig.app.json
# → (no output)

# No lint errors in modified files
npm run lint 2>&1 | grep "server/authApi\|server/initAuth\|tests/totpEnrollment\|tests/totpAdmin"
# → (no output — no errors)
```

## Known Stubs

None. All 16 `it.todo()` entries from Plan 01 have been replaced with real assertions.

## Threat Surface Scan

No new network endpoints beyond what was planned in the threat model. All T-15-07 through T-15-16 mitigations implemented:
- T-15-10 (replay — burned recovery codes): `modifyUsers()` removes burned code atomically under write lock before response
- T-15-11 (enrollToken tampering): `jwt.verify` with `algorithms: ['HS256']` rejects tampered tokens
- T-15-12 (non-admin DELETE): handler rejects `req.auth.role !== 'admin'` with 403
- T-15-16 (TOCTOU on recovery code burn): burn happens inside `modifyUsers()` callback under serialized write lock

## Wave Readiness

Wave 1 (Plans 02, 03) complete. Plans 03 and 04 (frontend) can begin:
- **Plan 03** (frontend enrollment): API shapes are final — `POST /login` returns `{requiresTotpEnrollment, enrollToken}`, `POST /totp/enroll` returns `{qrDataUrl, manualKey, enrollToken}`, `POST /totp/confirm` returns `{token, recoveryCodes}`
- **Plan 04** (admin reset UI): `DELETE /api/auth/users/:username/totp` returns `{ok: true}` or 403/404

## Self-Check

Verifying files and commits exist.

---
## Self-Check: PASSED

Files:
- FOUND: server/authApi.ts (modified)
- FOUND: server/initAuth.ts (modified)
- FOUND: tests/totpEnrollment.test.ts (modified, 12 real tests)
- FOUND: tests/totpAdmin.test.ts (modified, 4 real tests)

Commits:
- 3b1b4f0: feat(15-02): implement /login TOTP enrollment gate + /totp/enroll + /totp/confirm
- 2dc25f5: feat(15-02): implement DELETE /users/:username/totp admin reset + /verify TOTP+recovery flow
- 84b4085: fix(15-02): fix lint errors in TOTP test files
