---
phase: 27
plan: 04
status: complete
completed_at: "2026-05-11"
---

# Plan 27-04 Summary — dual-key rotation + /rotate-key endpoint (SESS-04)

## What was delivered

### server/initAuth.ts changes
- `_jwtSecretPrev`, `_dataDir`, `_refreshAbsoluteCapMs` module-level state added
- `initAuth()` stores `_dataDir`, extracts `refreshAbsoluteCapMs` from settings, loads `jwt-secret-prev.txt` if present
- New exports:
  - `getJwtSecrets(): { current: string; prev?: string }` — dual-key read for verifyRefreshToken
  - `computeKeyId(secret: string): string` — SHA256 first 8 hex chars for session row key_id
  - `rotateSigningKey(): { rotatedAt, prevKeyExpiresBy }` — atomic rename chain: next→current, current→prev; throws code=NEXT_KEY_MISSING if next file absent

### server/jwtUtil.ts changes
- `verifyRefreshToken` rewritten with dual-key fallback (D-09, SESS-04):
  - Tries current key first; on JsonWebTokenError (NOT TokenExpiredError), falls back to prev if present
  - Pitfall 2 handled: expired tokens do NOT retry against prev key
- Import updated: `getJwtSecret, getJwtSecrets` from initAuth

### server/authApi.ts changes
- `rotateSigningKey` imported from initAuth
- `/api/auth/rotate-key` endpoint added (admin-only):
  - 403 for non-admin
  - 400 with `NEXT_KEY_MISSING` code → "jwt-secret-next.txt not found; stage the next key first"
  - 200 with `{ rotatedAt, prevKeyExpiresBy }` on success

### tests/rotateKey.test.ts — 7 SCAFFOLD stubs → real implementations
| Test | Behavior |
|------|----------|
| 1 | Researcher token → 403 /admin/i |
| 2 | Admin → 200 with rotatedAt + prevKeyExpiresBy (ISO8601, ~12h future) |
| 3 | Cookie signed by prev key still verifies after rotation (200) |
| 4 | Prev-key cookie with DB `issued_at = 13h ago` → 401 "Session cap exceeded" |
| 5 | JWT signed by unknown key → 401 (not 500) |
| 6 | Missing jwt-secret-next.txt → 400 /next key/i |
| 7 | No Bearer header → 401 (not in PUBLIC_PATHS) |

Mock design: module-level `_currentSecret`, `_prevSecret`, `_simulateMissingNextKey` flags
closed over by `vi.mock` factory; `beforeEach` resets all three.

### Mock updates (getJwtSecrets added)
- `tests/jwtUtil.test.ts` — `getJwtSecrets: () => ({ current: TEST_SECRET })`
- `tests/authRefresh.test.ts` — same
- `tests/sessionRotation.test.ts` — same
- `tests/credentialMutationInvalidation.test.ts` — same

## Test results
- `tests/rotateKey.test.ts`: 7/7 green ✓
- Full suite: 702/702 passing ✓
- `npm run build`: clean ✓
- `npm run lint`: exits 0 ✓

## Security properties delivered
- T-27-04-01: Stolen token from old key remains valid during dual-key window
- T-27-04-02: Expired tokens do NOT get a second chance via prev-key fallback (Pitfall 2)
- T-27-04-03: Unknown-key tokens return 401, not 500
- T-27-04-04: Absolute cap applies to prev-key tokens via DB-authoritative issued_at (no bypass)
- T-27-04-05: Key rotation endpoint gate-kept to admin role only
