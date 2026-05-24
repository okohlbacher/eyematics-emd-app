# Phase 27: Stateful Session Backend - Research

**Researched:** 2026-05-11
**Domain:** Server-side refresh-token persistence, OAuth2 token rotation, signing-key rotation
**Confidence:** HIGH

## Summary

Phase 27 introduces a `sessions.db` SQLite database that records every issued refresh token, enabling RFC 6819-style token reuse detection (family revocation) and graceful signing-key rotation. All decisions are locked in CONTEXT.md — this research confirms the technical feasibility of each decision by reading the actual codebase and verifying the patterns are already established.

The existing codebase has two healthy SQLite modules (`auditDb.ts`, `dataDb.ts`) that provide a battle-tested template for the new `sessionsDb.ts`. The `/api/auth/refresh` handler already exists with rolling rotation; it needs `jti` lookup/insert wired in. The `initAuth.ts` secret loader is a straightforward extension to dual-key. All test infrastructure (Vitest + supertest + `fs.mkdtempSync` tmpdir pattern) is already in place.

The 682 passing tests (baseline at research time, Phase 24 documented 619 but the suite has grown to 682) provide the safety net. No new dependencies are needed — `better-sqlite3`, `crypto.randomUUID`, and `jsonwebtoken` are already present.

**Primary recommendation:** Implement in three task units: (1) `sessionsDb.ts` + schema + cleanup interval, (2) jti wiring in `jwtUtil.ts` + `authApi.ts` /refresh handler, (3) dual-key rotation in `initAuth.ts` + `/rotate-key` endpoint. Each unit is independently testable.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Storage**
- D-01: Sessions table lives in `data/sessions.db` (SQLite via `better-sqlite3`), new `server/sessionsDb.ts` module; `initSessionsDb(dataDir)`, exported CRUD helpers, synchronous API.
- D-02: Do NOT add sessions table to `data.db` or `audit.db`.
- D-03: JSON file storage rejected for sessions.

**Schema**
- D-04: Minimum columns: `id TEXT PRIMARY KEY` (UUID = jti), `sid TEXT NOT NULL`, `username TEXT NOT NULL`, `ver INTEGER NOT NULL`, `issued_at TEXT NOT NULL`, `expires_at TEXT NOT NULL`, `last_used_at TEXT`, `revoked INTEGER NOT NULL DEFAULT 0`, `key_id TEXT NOT NULL`.
- D-05: Indexes on `(sid)`, `(username)`, `(revoked, expires_at)`.

**Token Rotation (SESS-03)**
- D-06: On every `/api/auth/refresh`: lookup jti → if missing or revoked → family revocation (all rows WHERE sid = payload.sid → revoked=1) → 401 `token_reused`. If found and not revoked → mark old row revoked, insert new row, issue new JWT (same sid, fresh jti).
- D-07: `jti` claim added to `RefreshPayload` in `server/jwtUtil.ts`; `signRefreshToken` and `verifyRefreshToken` updated.
- D-08: Family revocation takes priority over tokenVersion mismatch check. Existing tokenVersion check remains as second-layer.

**Signing-Key Rotation (SESS-04)**
- D-09: Dual-key window: `data/jwt-secret-next.txt` → rotate → `data/jwt-secret-prev.txt` (old current), new current. `verifyRefreshToken` tries current key first, then prev. After all prev-signed tokens expire (12h cap), prev deleted.
- D-10: `key_id` = first 8 hex chars of SHA256 of key file contents.
- D-11: `POST /api/auth/rotate-key` (admin only). Response: `{ rotatedAt, prevKeyExpiresBy }`.
- D-12: `getJwtSecrets(): { current: string, prev?: string }` replaces/extends `getJwtSecret()` for dual-key verification. ESLint `no-restricted-imports` for `jsonwebtoken` stays — all JWT operations remain in `server/jwtUtil.ts`.

**Session Cleanup**
- D-13: Expired + revoked rows pruned on startup (after `initSessionsDb`) and every 24h via `setInterval`. Same lifecycle as `auditDb`'s purge.
- D-14: Cleanup deletes WHERE `expires_at < now` OR (`revoked = 1` AND `last_used_at < now - 7 days`).

**API Surface**
- D-15: `/api/auth/refresh` handler extended in-place in `server/authApi.ts`.
- D-16: New endpoint `POST /api/auth/rotate-key` (admin, standard Bearer auth). Returns `{ rotatedAt, prevKeyExpiresBy }`.
- D-17: Phase 28 will add `GET /api/auth/sessions` and `DELETE /api/auth/sessions/:id` — out of scope for Phase 27, but schema must support them.

**Backward Compatibility**
- D-18: Existing refresh cookies (no jti) → missing from sessions table → 401 `token_reused` → client re-logins. No migration of existing tokens.
- D-19: Existing `tokenVersion` invalidation stays unchanged.

**Claude's Discretion**
- Exact filename for previous key: `jwt-secret-prev.txt`.
- `sessionsDb.ts` exports plain functions (not class), module-level `db` singleton — follow `auditDb.ts` pattern.
- Error message for token reuse: `{ error: 'Refresh token reuse detected' }` (consistent with existing 401 patterns).

### Deferred Ideas (OUT OF SCOPE)
- `GET /api/auth/sessions` and `DELETE /api/auth/sessions/:id` → Phase 28.
- SESS-01 (force sign-out) → Phase 28.
- Device fingerprinting (`device_hint TEXT` column) → out of v1.10 scope.
- Key rotation webhook/notification → backlog.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SESS-02 | Server maintains stateful refresh-sessions table (one row per issued refresh token, tracking user, device fingerprint, issued-at, expires-at, revoked flag) | `sessionsDb.ts` module with D-04 schema; `initSessionsDb` called from `server/index.ts` after existing init calls. `emitRefreshCookies` in `authApi.ts` must insert row on every new token issuance. |
| SESS-03 | Server rotates refresh tokens on every use (OAuth2-style: previous token invalidated immediately on reuse) | Extend `/api/auth/refresh` handler: jti lookup → family revocation on reuse → row revoke + insert on valid use. RFC 6819 §5.2.2.3 pattern. |
| SESS-04 | Admin can rotate the refresh-token signing key; existing sessions gracefully expire rather than hard-crashing | `POST /api/auth/rotate-key`, dual-key window with `jwt-secret-prev.txt`, `verifyRefreshToken` tries both keys, cleanup after 12h absolute cap. |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 27 |
|-----------|-------------------|
| Test safety net: `npm run test:ci` — 619/619 must pass (Phase 24 baseline; currently 682 passing) | All new code must ship with tests; no regressions |
| Error handling: throw-only (D-03). No Result types. | sessionsDb helpers throw on DB error; authApi handler catches at route level |
| Async: async/await in new and touched files; `Promise.all` allowed | sessionsDb uses synchronous better-sqlite3 API (consistent with auditDb/dataDb) |
| Config: `config/settings.yaml` is the single source — NO env vars | No new env vars; key file paths derived from `dataDir` passed at init |
| Tests: no jest-dom; RTL assertions use `queryByText().not.toBeNull()` / `.toBeNull()` | Server tests use Vitest + supertest (no DOM concerns for Phase 27) |
| Naming: camelCase for TS identifiers; wire/DB/FHIR/HTTP strings stay as-is | Column names (`issued_at`, `expires_at`, etc.) are DB strings — keep snake_case; TS vars camelCase |
| No new SQLite tables without revisiting no-database constraint | Resolved in CONTEXT.md D-01: SQLite is already in use; decision re-affirmed |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | ^12.9.0 | SQLite persistence for sessions.db | Already used for audit.db and data.db; synchronous API fits Express sync middleware patterns [VERIFIED: package.json] |
| jsonwebtoken | ^9.0.3 | JWT sign/verify for jti-bearing refresh tokens | Existing, enforced via ESLint no-restricted-imports [VERIFIED: package.json] |
| node:crypto | built-in | `randomUUID()` for jti generation, SHA256 for key_id | Already used in authApi.ts line 100 for sid generation [VERIFIED: server/authApi.ts] |
| node:fs | built-in | Read/write jwt-secret-*.txt key files | Already used in initAuth.ts for jwt-secret.txt [VERIFIED: server/initAuth.ts] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^4.1.5 | Test runner | All new sessionsDb, authApi rotation, rotate-key endpoint tests [VERIFIED: package.json] |
| supertest | ^7.2.2 | HTTP integration tests | Route-level tests for /refresh reuse detection and /rotate-key [VERIFIED: package.json] |

**No new packages needed.** [VERIFIED: all required functionality present in existing dependencies]

---

## Architecture Patterns

### Recommended Project Structure

New files and touched files for Phase 27:

```
server/
├── sessionsDb.ts          # NEW — mirrors auditDb.ts pattern exactly
├── initAuth.ts            # EXTEND — add getJwtSecrets(), key rotation logic
├── jwtUtil.ts             # EXTEND — add jti to RefreshPayload, dual-key verify
├── authApi.ts             # EXTEND — /refresh jti lookup + /rotate-key endpoint
└── index.ts               # EXTEND — add initSessionsDb(DATA_DIR) call

data/
├── sessions.db            # Created at runtime by initSessionsDb
├── jwt-secret.txt         # Existing current key
├── jwt-secret-next.txt    # Created by admin before rotation
└── jwt-secret-prev.txt    # Created by rotation endpoint, deleted after cap

tests/
└── sessionsDb.test.ts     # NEW — unit tests for sessionsDb CRUD + cleanup
└── sessionRotation.test.ts # NEW — integration: reuse detection + family revocation
└── rotateKey.test.ts      # NEW — integration: dual-key verify + graceful expiry
```

### Pattern 1: sessionsDb.ts Module Structure

**What:** Plain-function module with module-level `db` singleton, `initSessionsDb(dataDir)`, and synchronous CRUD helpers. Directly mirrors `auditDb.ts`.

**When to use:** All session table operations from `authApi.ts`.

```typescript
// Source: mirrors server/auditDb.ts pattern [VERIFIED: server/auditDb.ts]
import path from 'node:path';
import Database from 'better-sqlite3';

export interface SessionRow {
  id: string;          // jti (UUID)
  sid: string;         // session family
  username: string;
  ver: number;
  issued_at: string;   // ISO8601
  expires_at: string;  // ISO8601
  last_used_at: string | null;
  revoked: number;     // 0 | 1 (SQLite has no BOOLEAN)
  key_id: string;      // first 8 hex chars of SHA256(key)
}

let db: Database.Database | null = null;

export function initSessionsDb(dataDir: string): void {
  const dbPath = path.join(dataDir, 'sessions.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_sessions (
      id           TEXT    PRIMARY KEY,
      sid          TEXT    NOT NULL,
      username     TEXT    NOT NULL,
      ver          INTEGER NOT NULL,
      issued_at    TEXT    NOT NULL,
      expires_at   TEXT    NOT NULL,
      last_used_at TEXT,
      revoked      INTEGER NOT NULL DEFAULT 0,
      key_id       TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sess_sid      ON refresh_sessions(sid);
    CREATE INDEX IF NOT EXISTS idx_sess_username ON refresh_sessions(username);
    CREATE INDEX IF NOT EXISTS idx_sess_cleanup  ON refresh_sessions(revoked, expires_at);
  `);
  console.log(`[sessionsDb] Opened sessions database: ${dbPath}`);
}

// Insert a newly issued session row
export function insertSession(row: SessionRow): void { ... }

// Lookup by jti — returns null if not found
export function getSession(id: string): SessionRow | null { ... }

// Mark a single row revoked (on successful rotation: old jti)
export function revokeSession(id: string): void { ... }

// Family revocation: revoke all rows where sid = given sid (reuse detection)
export function revokeFamily(sid: string): void { ... }

// Cleanup: delete hard-expired rows + old revoked rows
export function purgeExpiredSessions(): number { ... }

export function startSessionCleanupInterval(): void { ... }
```

### Pattern 2: jti Flow in /refresh

**What:** RFC 6819 §5.2.2.3 refresh token reuse detection. Three possible outcomes on `/refresh` call.

**When to use:** Every `/api/auth/refresh` request after verifyRefreshToken succeeds.

```typescript
// Source: D-06 from CONTEXT.md; mirrors existing tokenVersion check pattern
// in server/authApi.ts lines ~369-378 [VERIFIED: server/authApi.ts]

// After verifyRefreshToken(cookie) succeeds:
const existing = getSession(payload.jti);

if (!existing || existing.revoked === 1) {
  // Reuse or unknown token — RFC 6819 family revocation
  revokeFamily(payload.sid);
  res.status(401).json({ error: 'Refresh token reuse detected' });
  return;
}

// Valid — rotate
revokeSession(payload.jti);
const newJti = crypto.randomUUID();
const now = new Date().toISOString();
const expiresAt = new Date(Date.now() + settings.refreshTokenTtlMs).toISOString();
insertSession({
  id: newJti,
  sid: payload.sid,
  username: user.username,
  ver: user.tokenVersion ?? 0,
  issued_at: now,
  expires_at: expiresAt,
  last_used_at: now,
  revoked: 0,
  key_id: getCurrentKeyId(),
});
const newRefresh = signRefreshToken(
  { sub: user.username, ver: user.tokenVersion ?? 0, sid: payload.sid, jti: newJti },
  settings.refreshTokenTtlMs,
);
```

### Pattern 3: Dual-Key Verification

**What:** `getJwtSecrets()` returns `{ current, prev? }`. `verifyRefreshToken` tries current key first; if it throws, tries prev key (if present). If both fail, re-throws. [ASSUMED — standard dual-key pattern; exact error type from `jsonwebtoken` is `JsonWebTokenError` or `TokenExpiredError`]

**When to use:** All calls to `verifyRefreshToken` after key rotation.

```typescript
// Source: extends server/initAuth.ts getJwtSecret() pattern [VERIFIED: server/initAuth.ts]
export function getJwtSecrets(): { current: string; prev?: string } {
  if (!_jwtSecretCurrent) throw new Error('[initAuth] getJwtSecrets() called before initAuth()');
  return { current: _jwtSecretCurrent, prev: _jwtSecretPrev ?? undefined };
}

// In jwtUtil.ts verifyRefreshToken:
export function verifyRefreshToken(token: string): RefreshPayload {
  const { current, prev } = getJwtSecrets();
  let payload: RefreshPayload;
  try {
    payload = jwt.verify(token, current, { algorithms: ALGS }) as RefreshPayload;
  } catch (err) {
    if (prev) {
      payload = jwt.verify(token, prev, { algorithms: ALGS }) as RefreshPayload;
    } else {
      throw err;
    }
  }
  if (payload.typ !== 'refresh') throw new Error('wrong_token_type');
  return payload;
}
```

### Pattern 4: key_id Computation

**What:** First 8 hex chars of SHA256 of the raw key string. Deterministic from key file contents.

```typescript
// Source: D-10 from CONTEXT.md; uses node:crypto already imported [VERIFIED: server/authApi.ts]
import crypto from 'node:crypto';

export function computeKeyId(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex').slice(0, 8);
}
```

### Pattern 5: Absolute Cap Using issued_at From sessions Table

**What:** D-specifics note that `issued_at` from the sessions row should be used instead of `payload.iat` for the absolute-cap check — making it tamper-proof. [VERIFIED: CONTEXT.md `<specifics>`]

```typescript
// Instead of: const ageMs = Date.now() - payload.iat * 1000;
// Use:
const existing = getSession(payload.jti);
// ... (check exists + not revoked as above) ...
const ageMs = Date.now() - new Date(existing.issued_at).getTime();
if (ageMs > settings.refreshAbsoluteCapMs) {
  res.status(401).json({ error: 'Session cap exceeded' });
  return;
}
```

### Anti-Patterns to Avoid

- **Calling `getSession` before `verifyRefreshToken`:** The jti is in the JWT payload — must verify signature first to trust the jti claim. Always verify → then lookup.
- **Using `payload.iat` for absolute cap after Phase 27:** Once sessions table is live, use `existing.issued_at` (D-14 specifics). The payload iat is still tamper-apparent (signature protects it) but the table row is server-authoritative.
- **Adding `/api/auth/rotate-key` to PUBLIC_PATHS:** It requires admin Bearer auth. The existing pattern (role check inside handler + standard Bearer via authMiddleware) is correct.
- **Async operations in sessionsDb:** `better-sqlite3` is synchronous by design. All sessionsDb functions must use synchronous statements (`.run()`, `.get()`, `.all()`) — no async/await in sessionsDb.ts itself.
- **Multiple db instances in tests:** Use `fs.mkdtempSync` + `initSessionsDb(tmpDir)` pattern from `dataDb.test.ts`. Each `beforeEach` gets a fresh tmp dir; `afterEach` removes it. [VERIFIED: tests/dataDb.test.ts]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation for jti | Custom random string generator | `crypto.randomUUID()` | RFC 4122 compliant, already used for sid in authApi.ts [VERIFIED] |
| SQLite WAL setup | Custom file locking | `db.pragma('journal_mode = WAL')` | WAL mode is the established pattern in auditDb.ts and dataDb.ts [VERIFIED] |
| SHA256 for key_id | Custom hash | `crypto.createHash('sha256')` | Already available, standard node:crypto [VERIFIED] |
| Token reuse detection algorithm | Custom session tracking | RFC 6819 §5.2.2.3 family revocation (locked in D-06) | Industry standard; already decided |
| Periodic cleanup scheduling | cron library | `setInterval` (24h) | Matches auditDb.ts `startPurgeInterval` pattern exactly [VERIFIED] |

---

## Common Pitfalls

### Pitfall 1: jti Missing from Existing Tokens on Upgrade

**What goes wrong:** After upgrade, users with existing refresh cookies (no `jti` claim) hit `/refresh` and `payload.jti` is `undefined`. `getSession(undefined)` returns `null`, triggering family revocation and `401 token_reused`. Clients must re-login.

**Why it happens:** Old tokens were signed without jti. They cannot be retroactively added to the sessions table.

**How to avoid:** This is intentional per D-18. Document in release notes. The client-side auth flow (`authFetch`) already handles 401 by redirecting to login.

**Warning signs:** A burst of 401 `token_reused` responses immediately after upgrade. Normal — not a bug.

### Pitfall 2: verifyRefreshToken Throws on jsonwebtoken Invalid Signature vs. Expired

**What goes wrong:** During dual-key verify, `jwt.verify` throws `JsonWebTokenError` for wrong key AND `TokenExpiredError` for expired tokens. If you only catch `JsonWebTokenError` to try the prev key, an expired token signed by the current key would incorrectly fall through to try the prev key.

**Why it happens:** `jsonwebtoken` uses different error types for different failure modes. [VERIFIED: jwtUtil.ts error handling patterns]

**How to avoid:** In the dual-key fallback, only catch `JsonWebTokenError` (wrong key), not `TokenExpiredError`. An expired token signed by the current key should remain a hard failure (not trigger prev-key fallback). Alternatively, catch all errors from the first verify but check the error type before attempting prev-key fallback.

**Warning signs:** Expired tokens being accepted by the prev-key path during tests.

### Pitfall 3: Cleanup SQL Touches Semantically Live Revoked Rows Too Early

**What goes wrong:** D-14 says revoked rows are kept for 7 days after `last_used_at`. If cleanup logic uses `revoked_at` (which doesn't exist in schema) instead of `last_used_at`, the WHERE clause silently matches nothing or everything.

**Why it happens:** Schema has no `revoked_at` column — `last_used_at` doubles as the "last activity" timestamp.

**How to avoid:** Cleanup WHERE is exactly: `expires_at < datetime('now') OR (revoked = 1 AND last_used_at < datetime('now', '-7 days'))`. Test both branches. [VERIFIED: D-14 in CONTEXT.md]

**Warning signs:** Cleanup deleting 0 rows always (bad WHERE) or deleting recently-revoked rows (off-by-one on 7-day window).

### Pitfall 4: `rotate-key` Endpoint Not Protected by authMiddleware

**What goes wrong:** If `/api/auth/rotate-key` is accidentally added to `PUBLIC_PATHS`, any unauthenticated caller can rotate the signing key.

**Why it happens:** The `/api/auth/refresh` path is deliberately public (no Bearer token available at refresh time). A developer might assume all `/api/auth/*` routes are public.

**How to avoid:** Do NOT add `/api/auth/rotate-key` to `PUBLIC_PATHS` in `authMiddleware.ts`. The handler itself must also check `req.auth.role === 'admin'` (consistent with existing pattern at authApi.ts lines 491, 509, 582). [VERIFIED: server/authMiddleware.ts]

### Pitfall 5: signRefreshToken Called Before sessionsDb Row Is Inserted

**What goes wrong:** If the server crashes between `signRefreshToken` (token issued) and `insertSession` (row created), the client holds a valid token with no corresponding row. On next refresh attempt → `getSession` returns null → family revocation → forced re-login.

**Why it happens:** Non-atomic operation across JWT signing and DB write.

**How to avoid:** Insert the sessions row BEFORE emitting the cookie. If `insertSession` throws, the 500 means no cookie is set — consistent failure. The order in the login path (`emitRefreshCookies`) must be: compute jti → `insertSession(row)` → sign JWT → set cookie.

### Pitfall 6: initAuth.ts Module State After Rotation

**What goes wrong:** After `POST /rotate-key` renames files and updates the in-memory `_jwtSecretCurrent`/`_jwtSecretPrev`, a server restart re-reads from disk. If the disk state doesn't match what `initAuth` expects (current = `jwt-secret.txt`, prev = `jwt-secret-prev.txt`), the server may fail to start or silently use the wrong key.

**Why it happens:** initAuth only reads `jwt-secret.txt` today. After rotation, the new current key is in `jwt-secret.txt` (renamed from `jwt-secret-next.txt`); the old current key is in `jwt-secret-prev.txt`.

**How to avoid:** `initAuth` must also try to read `jwt-secret-prev.txt` at startup (if exists) and populate `_jwtSecretPrev`. The rotation endpoint writes the dual-key state to disk atomically (rename, not copy) so restarts always recover correctly.

---

## Code Examples

### sessionsDb init pattern (from auditDb.ts)

```typescript
// Source: server/auditDb.ts lines 70-107 [VERIFIED]
export function initAuditDb(dataDir: string, retentionDays = 90): void {
  const dbPath = path.join(dataDir, 'audit.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`CREATE TABLE IF NOT EXISTS audit_log (...)`);
  stmtInsert = db.prepare(`INSERT INTO audit_log ...`);
  stmtPurge  = db.prepare(`DELETE FROM audit_log WHERE ...`);
  console.log(`[auditDb] Opened audit database: ${dbPath}`);
}
```

### startPurgeInterval pattern (from auditDb.ts)

```typescript
// Source: server/auditDb.ts lines 148-160 [VERIFIED]
let _purgeTimer: ReturnType<typeof setInterval> | null = null;

export function startPurgeInterval(): void {
  if (_purgeTimer !== null) clearInterval(_purgeTimer);
  purgeOldEntries();
  _purgeTimer = setInterval(purgeOldEntries, 24 * 60 * 60 * 1000);
}
```

### Test tmpdir pattern (from dataDb.test.ts)

```typescript
// Source: tests/dataDb.test.ts lines 28-35 [VERIFIED]
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'datadb-test-'));
  initDataDb(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
```

### Admin role check pattern (from authApi.ts)

```typescript
// Source: server/authApi.ts lines 491-493 [VERIFIED]
if (!req.auth || req.auth.role !== 'admin') {
  res.status(403).json({ error: 'Admin access required' });
  return;
}
```

### index.ts startup sequence (insertion point)

```typescript
// Source: server/index.ts lines 96-135 [VERIFIED]
// Existing order:
initAuth(DATA_DIR, settings);
initHashCohortId(settings, DATA_DIR);
initOutcomesAggregateCache(settings);
configureSettingsApi(DATA_DIR);
// initAuditDb(...) + startPurgeInterval() come after

// Phase 27 adds (after initAuditDb / startPurgeInterval):
// initSessionsDb(DATA_DIR);
// startSessionCleanupInterval();
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stateless refresh tokens (only tokenVersion check) | Stateful per-token jti tracking + family revocation | Phase 27 | Detects stolen token reuse; invalidates entire session family on replay |
| Single JWT secret | Dual-key window (current + prev) | Phase 27 | Key rotation without forcing immediate re-login for all users |
| Absolute cap from `payload.iat` | Absolute cap from `sessions.issued_at` (server-authoritative) | Phase 27 | Tamper-proof; iat in JWT is still signature-protected but row is canonical |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `jsonwebtoken` throws `JsonWebTokenError` (not a generic `Error`) when a token is signed with the wrong key, allowing detection of wrong-key vs expired-token in dual-key verify | Common Pitfalls #2 | If the error type is different, the dual-key fallback needs different catch condition — low risk, testable |
| A2 | `db.pragma('journal_mode = WAL')` call pattern is sufficient for concurrent read safety in sessions.db (same as audit.db) | Standard Stack | auditDb has been stable — same pattern assumed safe for sessions.db |

**All other claims in this document are verified against the codebase or CONTEXT.md decisions.**

---

## Open Questions

1. **Where exactly does `emitRefreshCookies` (login path) insert the session row?**
   - What we know: `emitRefreshCookies` in `authApi.ts` at line 98 creates `sid = crypto.randomUUID()` and calls `signRefreshToken`. It does not currently insert a DB row.
   - What's unclear: After Phase 27, `emitRefreshCookies` must also call `insertSession`. It needs access to `sessionsDb` exports. This is a straightforward import addition.
   - Recommendation: Import `insertSession` from `./sessionsDb.js` in `authApi.ts` (same file already imports `initAuth`, `jwtUtil`). Compute jti before signing, insert row, sign with jti, set cookie.

2. **`getJwtSecret()` is called by `jwtUtil.ts` for access + challenge tokens (not just refresh)**
   - What we know: `signAccessToken` and `signChallengeToken` call `getJwtSecret()` — they use the single current key. Only `verifyRefreshToken` needs dual-key.
   - What's unclear: Should `getJwtSecret()` still exist for access/challenge, or should all callers migrate to `getJwtSecrets().current`?
   - Recommendation: Keep `getJwtSecret()` for access + challenge tokens (single current key is correct). Add `getJwtSecrets()` as a parallel export for the dual-key refresh path. No breaking change.

---

## Environment Availability

Step 2.6: All dependencies are runtime code-only (no external services, no CLI tools beyond what already runs). `better-sqlite3` is already installed and working (audit.db and data.db exist at `/Users/kohlbach/Claude/EyeMatics-EDM-UX/emd-app/data/`).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| better-sqlite3 | sessionsDb.ts | ✓ | ^12.9.0 | — |
| node:crypto.randomUUID | jti generation | ✓ | built-in | — |
| node:fs | key file management | ✓ | built-in | — |
| jsonwebtoken | dual-key verify | ✓ | ^9.0.3 | — |

**No missing dependencies.**

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.5 |
| Config file | `vitest.config.ts` (environment: node, setupFiles: tests/setup.ts) |
| Quick run command | `npm run test:ci -- --reporter=verbose tests/sessionsDb.test.ts` |
| Full suite command | `npm run test:ci` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SESS-02 | Sessions table created at startup with correct schema | unit | `npm run test:ci -- tests/sessionsDb.test.ts` | ❌ Wave 0 |
| SESS-02 | `insertSession` stores row with correct fields | unit | `npm run test:ci -- tests/sessionsDb.test.ts` | ❌ Wave 0 |
| SESS-02 | `getSession` returns null for unknown jti | unit | `npm run test:ci -- tests/sessionsDb.test.ts` | ❌ Wave 0 |
| SESS-03 | First refresh: old row revoked, new row inserted, new cookie issued | integration | `npm run test:ci -- tests/sessionRotation.test.ts` | ❌ Wave 0 |
| SESS-03 | Replay of old token (revoked=1): returns 401 token_reused | integration | `npm run test:ci -- tests/sessionRotation.test.ts` | ❌ Wave 0 |
| SESS-03 | Replay of unknown jti (no sessions.db row): returns 401 + family revocation | integration | `npm run test:ci -- tests/sessionRotation.test.ts` | ❌ Wave 0 |
| SESS-03 | Family revocation: all rows for sid become revoked=1 | unit | `npm run test:ci -- tests/sessionsDb.test.ts` | ❌ Wave 0 |
| SESS-04 | Token signed with prev key still verifies after rotation | unit | `npm run test:ci -- tests/rotateKey.test.ts` | ❌ Wave 0 |
| SESS-04 | Token signed with prev key returns 401 after absolute cap | integration | `npm run test:ci -- tests/rotateKey.test.ts` | ❌ Wave 0 |
| SESS-04 | `/rotate-key` returns 403 for non-admin caller | integration | `npm run test:ci -- tests/rotateKey.test.ts` | ❌ Wave 0 |
| SESS-04 | `/rotate-key` returns `{ rotatedAt, prevKeyExpiresBy }` for admin | integration | `npm run test:ci -- tests/rotateKey.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test:ci -- tests/sessionsDb.test.ts tests/sessionRotation.test.ts tests/rotateKey.test.ts`
- **Per wave merge:** `npm run test:ci`
- **Phase gate:** Full suite green (682+ passing) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/sessionsDb.test.ts` — unit coverage for sessionsDb CRUD, cleanup, purge logic (REQ SESS-02, SESS-03)
- [ ] `tests/sessionRotation.test.ts` — integration: /refresh jti rotation, reuse detection, family revocation (REQ SESS-03)
- [ ] `tests/rotateKey.test.ts` — integration: /rotate-key endpoint, dual-key verify window, graceful prev-key expiry (REQ SESS-04)

*(Existing `tests/authRefresh.test.ts` covers the current stateless /refresh behavior and will need updating to mock `sessionsDb` — but the file exists and covers the base cases.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing bcrypt + TOTP flow unchanged |
| V3 Session Management | yes | `sessionsDb.ts` per-token revocation; RFC 6819 §5.2.2.3 family revocation; dual-key rotation |
| V4 Access Control | yes | `/api/auth/rotate-key` requires admin role; standard `req.auth.role !== 'admin'` guard |
| V5 Input Validation | yes | jti from JWT payload (signature-verified); key_id computed server-side; no user-supplied values stored raw |
| V6 Cryptography | yes | HS256 pinned via `ALGS` constant in jwtUtil.ts; SHA256 for key_id via node:crypto; key files at chmod 0o600 |

### Known Threat Patterns for Refresh Token + SQLite Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stolen refresh token replay | Spoofing | RFC 6819 family revocation: detect reuse → revoke entire session family → force re-login |
| Key compromise | Spoofing | Dual-key rotation window; previous key tokens expire within 12h absolute cap |
| sessions.db file exfiltration | Disclosure | All rows contain only non-secret metadata (jti, sid, username, timestamps, revoked flag) — the actual JWT secret is NOT in the sessions table; exfiltrating sessions.db without the signing key is useless for forging tokens |
| SQLite injection | Tampering | All sessionsDb queries use named parameters (`@param`) — no string concatenation [VERIFIED: auditDb.ts pattern] |
| Race condition on token rotation | Tampering | SQLite WAL serializes writers; jti lookup + revoke + insert happen in sequence within the sync better-sqlite3 API (no async gap) |
| `/rotate-key` unauthorized call | Elevation | Admin Bearer token required; authMiddleware enforces; additional role check in handler |

---

## Sources

### Primary (HIGH confidence)
- `server/auditDb.ts` — Template for sessionsDb.ts: WAL setup, init signature, cleanup interval pattern [VERIFIED in session]
- `server/dataDb.ts` — Secondary template: module singleton, initXxxDb pattern [VERIFIED in session]
- `server/jwtUtil.ts` — RefreshPayload type, signRefreshToken, verifyRefreshToken, ALGS pin [VERIFIED in session]
- `server/authApi.ts` — emitRefreshCookies, /refresh handler, admin role check pattern [VERIFIED in session]
- `server/initAuth.ts` — getJwtSecret, file-based secret management pattern [VERIFIED in session]
- `server/authMiddleware.ts` — PUBLIC_PATHS, requireCsrf [VERIFIED in session]
- `server/index.ts` — Startup sequence and init call order [VERIFIED in session]
- `.planning/phases/27-stateful-session-backend/27-CONTEXT.md` — All locked decisions [VERIFIED in session]
- `tests/dataDb.test.ts` — tmpdir test pattern [VERIFIED in session]
- `tests/authRefresh.test.ts` — supertest auth integration test pattern [VERIFIED in session]
- `package.json` — all package versions [VERIFIED in session]

### Secondary (MEDIUM confidence)
- RFC 6819 §5.2.2.3 — Refresh token reuse / family revocation (referenced in CONTEXT.md D-06; standard industry spec) [CITED]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json; no new deps needed
- Architecture: HIGH — patterns read directly from auditDb.ts, dataDb.ts, authApi.ts, initAuth.ts
- Pitfalls: HIGH (pitfalls 1, 4, 5, 6) / MEDIUM (pitfalls 2, 3) — pitfall 2 relies on jsonwebtoken error type knowledge [ASSUMED A1], pitfall 3 is logic-derived from schema

**Research date:** 2026-05-11
**Valid until:** 2026-06-11 (stable internal codebase; no external API dependencies)
