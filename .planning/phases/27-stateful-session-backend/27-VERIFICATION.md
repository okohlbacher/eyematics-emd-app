---
phase: 27-stateful-session-backend
verified: 2026-05-24T18:48:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
gaps: []
human_verification: []
---

# Phase 27: Stateful Session Backend — Verification Report

**Phase Goal:** The server tracks every issued refresh token in a persistent table and invalidates tokens correctly on rotation and key change
**Verified:** 2026-05-24T18:48:00Z
**Status:** passed
**Re-verification:** No — backfill verification (V&V debt from v1.10 milestone, VVBACK-01)

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | A `refresh_sessions` table is created at server startup with one row per issued refresh token, storing `id` (jti), `sid` (session family), `username`, `ver`, `issued_at`, `expires_at`, `last_used_at`, `revoked`, and `key_id` | VERIFIED | `git show v1.10:server/sessionsDb.ts` lines 82–95: `CREATE TABLE IF NOT EXISTS refresh_sessions (id, sid, username, ver, issued_at, expires_at, last_used_at, revoked, key_id)` with three covering indexes; `initSessionsDb` called from `server/index.ts` at startup. Schema comment at line 11 explicitly cites SESS-02. |
| SC2 | When a client uses a refresh token, the server issues a new token and immediately marks the previous row as revoked; presenting the old token a second time returns 401 | VERIFIED | `git grep -n "Refresh token reuse detected" v1.10 -- server/authApi.ts` → line 395; `revokeFamily(payload.sid)` at line 393 + `res.status(401).json({ error: 'Refresh token reuse detected' })` at line 395; rotation path: `revokeSession(payload.jti)` at line 425 before emitting new cookies. `tests/sessionRotation.test.ts` asserts reuse → 401 (5/5 green). |
| SC3 | When an admin rotates the signing key, existing sessions continue to refresh until their absolute cap expires, then expire gracefully rather than returning 500 or a crash | VERIFIED | `git grep -n "rotateSigningKey\|getJwtSecrets\|computeKeyId" v1.10 -- server/initAuth.ts` → lines 170, 178, 187; `git show v1.10:server/jwtUtil.ts` lines 97–119: `verifyRefreshToken` tries current key first, falls back to `prev` on `JsonWebTokenError` but NOT `TokenExpiredError` (Pitfall 2 guard at line 116); `POST /api/auth/rotate-key` admin endpoint at `git grep -n "rotate-key" v1.10 -- server/authApi.ts` → line 1010 (admin-only at line 1011). `tests/rotateKey.test.ts` asserts prev-key cookie still refreshes after rotation (7/7 green). |
| SC4 | All session-table operations are covered by automated tests that assert row state after rotation and reuse attempts | VERIFIED | `git ls-tree v1.10 -- tests/sessionsDb.test.ts tests/sessionRotation.test.ts tests/rotateKey.test.ts` → all three blobs present; `npm run test:ci` → 901/901 PASS. `tests/sessionsDb.test.ts` (8 tests: schema, CRUD, cleanup), `tests/sessionRotation.test.ts` (5 tests: jti rotation + reuse → 401 + family revocation), `tests/rotateKey.test.ts` (7 tests: admin gate, 200 rotation, prev-key verify, cap exceeded, unknown-key 401, missing-next 400, no-Bearer 401). |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/sessionsDb.ts` | `refresh_sessions` schema, CRUD (insertSession/getSession/revokeSession/revokeFamily/revokeByUsername/listActiveSessionsByUser), cleanup interval | VERIFIED | `git show v1.10:server/sessionsDb.ts` — 216+ lines; all 9 exports confirmed; WAL mode; three covering indexes; 7-day revoked-row retention (D-13/D-14). |
| `server/authApi.ts` (`/refresh` + `/rotate-key`) | jti lookup → reuse detection → family revocation (SESS-03); admin `POST /rotate-key` returning `{ rotatedAt, prevKeyExpiresBy }` (SESS-04) | VERIFIED | `git grep -n "Refresh token reuse detected\|revokeFamily\|getSession\|insertSession\|rotate-key" v1.10 -- server/authApi.ts` → lines 30, 124, 389–425, 1010–1024. Import of all sessionsDb symbols at line 30. |
| `server/initAuth.ts` (dual-key) | `getJwtSecrets()` returning `{ current; prev? }`, `computeKeyId(secret)`, `rotateSigningKey()` with atomic rename + `NEXT_KEY_MISSING` | VERIFIED | `git grep -n "rotateSigningKey\|getJwtSecrets\|computeKeyId" v1.10 -- server/initAuth.ts` → lines 170, 178, 187. |
| `server/jwtUtil.ts` (jti + fallback) | `RefreshPayload.jti` required; `signRefreshToken` embeds jti; `verifyRefreshToken` dual-key fallback skips prev on `TokenExpiredError` | VERIFIED | `git show v1.10:server/jwtUtil.ts` lines 97–119: dual-key fallback with `!(err instanceof jwt.TokenExpiredError)` guard at line 116; `getJwtSecrets` import at line 24. |
| `tests/sessionsDb.test.ts` | Unit tests for schema, CRUD, cleanup WHERE clause | VERIFIED | `git ls-tree v1.10 -- tests/sessionsDb.test.ts` → blob `3309e15`; 8/8 pass in full suite. |
| `tests/sessionRotation.test.ts` | RFC 6819 family revocation + reuse-→-401 tests | VERIFIED | `git ls-tree v1.10 -- tests/sessionRotation.test.ts` → blob `e4ff264`; 5/5 pass in full suite. |
| `tests/rotateKey.test.ts` | Admin gate, rotation response, prev-key verify, cap, unknown-key 401, missing-next 400 | VERIFIED | `git ls-tree v1.10 -- tests/rotateKey.test.ts` → blob `ddabce0`; 7/7 pass in full suite. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `server/authApi.ts` `/refresh` handler | `server/sessionsDb.ts` | `import { getSession, insertSession, revokeSession, revokeFamily, ... }` | WIRED | `git grep -n "from './sessionsDb.js'" v1.10 -- server/authApi.ts` → line 30; symbols `getSession`, `revokeFamily` called at lines 391–395 for reuse detection; `revokeSession` at line 425 for rotation. |
| `server/authApi.ts` `/rotate-key` handler | `server/initAuth.ts` `rotateSigningKey()` | `import { rotateSigningKey }` | WIRED | `git grep -n "rotateSigningKey" v1.10 -- server/authApi.ts` → line 1016 (`const result = rotateSigningKey()`); error code `NEXT_KEY_MISSING` re-surfaced at line 1020. |
| `server/jwtUtil.ts` `verifyRefreshToken` | `server/initAuth.ts` `getJwtSecrets()` | `import { getJwtSecret, getJwtSecrets }` | WIRED | `git show v1.10:server/jwtUtil.ts` line 24 + line 107 (`const { current, prev } = getJwtSecrets()`); dual-key fallback at lines 107–119. |
| `server/authApi.ts` refresh rotation | `server/jwtUtil.ts` `signRefreshToken` | `emitRefreshCookies` calls `signRefreshToken` with jti | WIRED | `git show v1.10:server/authApi.ts` — `insertSession(row)` at line 124 BEFORE `signRefreshToken` (Pitfall 5 ordering); jti generated via `crypto.randomUUID()`. |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `refresh_sessions` table defined in sessionsDb | `git show v1.10:server/sessionsDb.ts \| grep -c "refresh_sessions"` | ≥ 10 matches (schema, indexes, prepared statements) | PASS |
| Reuse detection response present | `git grep -c "Refresh token reuse detected" v1.10 -- server/authApi.ts` | 1 | PASS |
| `revokeFamily` called on reuse | `git grep -c "revokeFamily" v1.10 -- server/authApi.ts` | 1 | PASS |
| `rotate-key` endpoint exists | `git grep -c "rotate-key" v1.10 -- server/authApi.ts` | ≥ 1 (lines 1000, 1010) | PASS |
| Admin gate on rotate-key | `git show v1.10:server/authApi.ts \| sed -n '1010,1015p'` | `if (!req.auth \|\| req.auth.role !== 'admin') → 403` | PASS |
| Dual-key fallback skips `TokenExpiredError` | `git show v1.10:server/jwtUtil.ts \| grep -n "TokenExpiredError"` | Lines 113, 116 — `!(err instanceof jwt.TokenExpiredError)` guard | PASS |
| All three session test files at v1.10 | `git ls-tree v1.10 -- tests/sessionsDb.test.ts tests/sessionRotation.test.ts tests/rotateKey.test.ts` | 3 blobs (ddabce0, e4ff264, 3309e15) | PASS |
| Full test suite green | `npm run test:ci` | 901/901 PASS (83 test files) | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| SESS-02 | 27-02-PLAN.md | Persistent `refresh_sessions` table with CRUD: insertSession, getSession, revokeSession, revokeFamily, listActiveSessionsByUser + startup cleanup interval | SATISFIED | `server/sessionsDb.ts` at `v1.10` exports all CRUD functions; schema with 9 columns and 3 indexes; `initSessionsDb` + `startSessionCleanupInterval` called from `server/index.ts`; `tests/sessionsDb.test.ts` 8/8 green. |
| SESS-03 | 27-03-PLAN.md | OAuth2-style jti rotation on `/api/auth/refresh`; reuse of an already-rotated token triggers RFC 6819 family revocation and returns 401 | SATISFIED | `server/authApi.ts` at `v1.10` lines 389–425: jti lookup → `revokeFamily` + 401 on reuse; `revokeSession` + new session insert on valid rotation; `tests/sessionRotation.test.ts` 5/5 green. |
| SESS-04 | 27-04-PLAN.md | Dual-key signing window: `verifyRefreshToken` falls back to prev key (not on `TokenExpiredError`); admin `POST /api/auth/rotate-key` atomically promotes next→current→prev; existing sessions continue until absolute cap | SATISFIED | `server/initAuth.ts` at `v1.10` exports `getJwtSecrets`, `computeKeyId`, `rotateSigningKey`; `server/jwtUtil.ts` dual-key fallback lines 107–119; admin endpoint at `server/authApi.ts` line 1010; `tests/rotateKey.test.ts` 7/7 green. |

---

### Human Verification Required

None — all checks automatable. The one manual advisory item noted in `27-VALIDATION.md` (verifying graceful expiry after a real signing-key rotation by restarting the server and replaying a pre-rotation cookie) is a convenience integration smoke-test, not a goal-blocker. The automated `tests/rotateKey.test.ts` test 3 covers the identical behavior path programmatically.

---

### Gaps Summary

No blocking gaps. Phase 27 is verified as-shipped at `v1.10`. All three SESS requirements (SESS-02/03/04) are satisfied end-to-end:

- **SESS-02**: `refresh_sessions` table created by `sessionsDb.initSessionsDb()` at startup with the full 9-column schema and three covering indexes. CRUD functions cover insert, get, single-revoke, family-revoke, by-username revoke, and listing active sessions.
- **SESS-03**: The `/api/auth/refresh` handler performs jti-first DB lookup; any missing or revoked jti triggers `revokeFamily` + 401 "Refresh token reuse detected" (RFC 6819 §5.2.2.3). Valid rotation revokeSession + inserts new row before signing.
- **SESS-04**: `verifyRefreshToken` in `jwtUtil.ts` implements dual-key fallback with a correct `TokenExpiredError` guard (expired tokens do not get a second chance). `rotateSigningKey()` in `initAuth.ts` performs atomic rename (next→current→prev) and throws `NEXT_KEY_MISSING` when the next-key file is absent. The admin `POST /api/auth/rotate-key` endpoint is gated to `role === 'admin'`.

The full test suite is 901/901 green. No product source files were modified during this verification.

---

_Verified: 2026-05-24T18:48:00Z_
_Verifier: Claude (gsd-verifier)_
