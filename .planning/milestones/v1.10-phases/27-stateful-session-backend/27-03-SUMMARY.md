---
phase: 27
plan: 03
status: complete
completed_at: "2026-05-11"
---

# Plan 27-03 Summary — jti rotation in /refresh, family revocation (SESS-03)

## What was delivered

Implemented RFC 6819 §5.2.2.3 refresh-token family revocation with per-token jti tracking.

### server/jwtUtil.ts changes
- `RefreshPayload.jti: string` added as required field (D-07)
- `signRefreshToken` now embeds `jti` in the JWT payload
- `verifyRefreshToken` returns `{ ...payload, jti: '' }` for pre-Phase-27 tokens without a jti claim (D-18 empty-string sentinel)

### server/authApi.ts changes

**New imports:** `getJwtSecret` from initAuth, `getSession/insertSession/revokeSession/revokeFamily/SessionRow` from sessionsDb

**New helper:** `currentKeyId()` — first 8 hex chars of SHA256(current signing key)

**`emitRefreshCookies` (extended):**
- Accepts optional `existingSid?` for rolling rotation (preserves session family)
- Generates `jti = crypto.randomUUID()`
- Inserts sessions row **BEFORE** calling `signRefreshToken` (Pitfall 5 ordering)

**`/api/auth/refresh` handler (rewired — D-06, D-08):**
1. `verifyRefreshToken` — signature + typ check (unchanged)
2. **JTI lookup first (D-08):** `getSession(payload.jti)` — if missing/revoked → `revokeFamily(sid)` + 401 "Refresh token reuse detected"
3. **Server-authoritative absolute cap:** uses `existing.issued_at` from DB row, not `payload.iat` (tamper-proof per T-27-03-02)
4. **tokenVersion check (D-19):** preserved as second-layer invalidation; revokes jti on mismatch
5. **Rotation:** `revokeSession(payload.jti)` + `emitRefreshCookies(res, user, payload.sid)`

### Code metrics
- `grep -c "Refresh token reuse detected" server/authApi.ts` → 1
- `grep -c "Session cap exceeded" server/authApi.ts` → 1  
- `grep -c "revokeFamily" server/authApi.ts` → 1
- `grep -c "insertSession" server/authApi.ts` → 1
- `grep -c "getSession" server/authApi.ts` → 1
- `grep -c "revokeSession" server/authApi.ts` → 2
- `grep -c "jti" server/authApi.ts` → 8
- `grep -c "tokenVersion" server/authApi.ts` → 3 (D-19 check preserved)

### Test changes
| File | Change |
|------|--------|
| `tests/jwtUtil.test.ts` | Added `jti: 'test-jti-xyz'` to signRefreshToken call; added `expect(payload.jti).toBe('test-jti-xyz')` |
| `tests/sessionRotation.test.ts` | All 5 SESS-03 scaffolds replaced with real tests |
| `tests/authRefresh.test.ts` | sessionsDb tmpdir setup added; "Session cap exceeded" test rewritten to use DB-row `issued_at` |
| `tests/credentialMutationInvalidation.test.ts` | sessionsDb tmpdir setup added |
| `tests/authConfigProvider.test.ts` | sessionsDb tmpdir setup added |
| `tests/rotateKey.test.ts` | Unused-var lint warnings fixed with `_` prefix |

## Test results
- `tests/sessionRotation.test.ts`: 5/5 green ✓
- `tests/authRefresh.test.ts`: all green ✓
- `tests/sessionsDb.test.ts`: 8/8 green ✓ (no regression)
- `tests/jwtUtil.test.ts`: all green ✓
- Full suite: 702 total — 695 passing, 7 rotateKey scaffolds expected-red (Plan 04)
- `npm run build`: clean ✓
- `npm run lint`: exits 0 ✓

## Security properties delivered
- T-27-03-01: Stolen token replay → family revocation → forced re-login
- T-27-03-02: Tampered `iat` cannot bypass absolute cap (cap reads DB row)
- T-27-03-03: SQLite sync API prevents race between lookup/revoke/insert
- T-27-03-04: Pre-Phase-27 tokens force re-login (D-18)
