# Phase 2: Server-Side Auth + Audit - Research

**Researched:** 2026-04-10
**Domain:** Express JWT authentication, bcrypt password hashing, SQLite audit log, server middleware
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Login Flow**
- D-01: Two-step server flow for 2FA. Step 1: POST /api/auth/login with { username, password } — server validates credentials (bcrypt), returns a challenge token if 2FA enabled. Step 2: POST /api/auth/verify with { challengeToken, otp } — server validates OTP, returns JWT. If 2FA disabled, Step 1 returns JWT directly.
- D-02: GET /api/auth/config is a public (no-auth) endpoint returning { twoFactorEnabled }. LoginPage calls this on mount to decide whether to show OTP field.
- D-03: Remove DEFAULT_CREDENTIALS from src/context/AuthContext.tsx entirely. Remove hardcoded KNOWN_USERS from server/utils.ts. All credential validation happens via data/users.json lookup.
- D-04: LoginPage posts credentials to server, receives JWT, stores in sessionStorage. No passwords ever in the client bundle.

**Token Lifecycle**
- D-05: JWT expiry matches inactivity timeout (10 minutes). When any API call returns 401, AuthContext clears session and redirects to /login. No refresh token — keep it simple.
- D-06: JWT payload: { sub: username, preferred_username: username, role, centers, iat, exp }. Same format whether issued by local auth or (future) Keycloak.
- D-07: JWT secret stored in settings.yaml under auth.jwtSecret. Generated randomly on first startup if not present.

**Auth Middleware**
- D-08: Express middleware validates JWT on all /api/* routes except /api/auth/login, /api/auth/verify, and /api/auth/config (public endpoints). Extracts { username, role, centers } from payload and attaches to request object for downstream handlers.
- D-09: Failed login limiting: server tracks consecutive failures per username in memory (Map). Lock account after 5 failures with exponential backoff. Reset on successful login. Configurable via settings.yaml auth.maxLoginAttempts.

**Audit Middleware**
- D-10: Request-level audit logging — server middleware auto-logs EVERY API request: method, path, user (from JWT), timestamp, response status code, response time. One row per HTTP request.
- D-11: For mutation endpoints (POST/PUT/DELETE), also capture the request body in the audit entry. GET requests log query parameters only (not full response bodies).
- D-12: Delete ALL 15 client-side logAudit() calls from frontend code. Server middleware handles all audit logging. Zero audit responsibility in the React app.
- D-13: No POST, PUT, PATCH, or DELETE endpoints for audit. Only GET /api/audit (filtered list) and GET /api/audit/export (admin full dump). All writes are internal server function calls.
- D-14: SQLite database at data/audit.db. Schema: audit_log(id TEXT PK, timestamp TEXT, method TEXT, path TEXT, user TEXT, status INTEGER, duration_ms INTEGER, body TEXT NULL, query TEXT NULL). Indexed on timestamp, user, path.
- D-15: 90-day rolling retention: DELETE FROM audit_log WHERE timestamp < datetime('now', '-90 days'). Runs on startup and via setInterval every 24 hours.

**Shared Auth Headers**
- D-16: Create src/services/authHeaders.ts as single shared utility. Reads JWT from sessionStorage, returns { Authorization: 'Bearer <jwt>' }. Replaces duplicate getAuthHeaders() in issueService.ts and settingsService.ts.

### Claude's Discretion
- Migration order of file changes (which files to modify first)
- Exact bcrypt salt rounds (10-12 is standard)
- Whether to use express-jwt middleware or custom JWT validation
- SQLite WAL mode configuration for concurrent reads during writes
- Exact error response format for 401/403

### Deferred Ideas (OUT OF SCOPE)
- User CRUD API (POST/DELETE /api/users) — Phase 3 scope
- Center-based data filtering — Phase 4 scope
- Keycloak JWT validation (RS256 via JWKS) — Phase 5 scope
- Token refresh mechanism — deferred; redirect to login is sufficient for v1
- Password change endpoint — Phase 3 scope (USER-11)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUDIT-01 | Audit entries written server-side only — backend logAudit() inserts into SQLite | better-sqlite3 synchronous insert; middleware wraps response to capture status/duration |
| AUDIT-02 | GET /api/audit returns entries with filtering (user, action, time range, limit/offset) | SQLite WHERE + LIMIT/OFFSET; verified better-sqlite3 prepared statement patterns |
| AUDIT-03 | GET /api/audit/export returns full log as downloadable JSON (admin only) | JWT role check in middleware; Content-Disposition header pattern from issueApi.ts |
| AUDIT-04 | Audit entries stored in SQLite at data/audit.db in audit_log table | better-sqlite3 12.8.0; db.exec() for CREATE TABLE IF NOT EXISTS on startup |
| AUDIT-05 | No write/delete audit endpoints — writes happen only via server-side function calls | Pattern: no route mounted, internal function only |
| AUDIT-06 | AuditPage loads entries asynchronously from server (read-only display, search, filter) | Replace getAuditLog() with fetch('/api/audit'); adapt existing filter UI |
| AUDIT-07 | No clear button, no edit, no delete — audit log is immutable from client | Remove handleClear + Trash2 button from AuditPage.tsx |
| AUDIT-08 | Rolling 90-day retention on startup and daily interval | db.prepare('DELETE ... WHERE timestamp < ...').run(); setInterval(24h) |
| AUDIT-09 | SQLite schema: audit_log(id, timestamp, user, action, detailKey, detailArgs, resource) | Note: D-14 schema differs from AUDIT-09 — see Schema Mismatch section below |
| AUDIT-10 | Frontend logAudit() calls replaced by server middleware | 12 files to clean; usePageAudit hook to delete; server middleware auto-logs all API requests |
| AUTH-01 | Unified auth middleware validates JWT Bearer tokens on all /api/* routes | Custom middleware using jsonwebtoken 9.0.3 verify(); mounts before route handlers |
| AUTH-02 | Local mode: JWT signed with HS256 server secret | jsonwebtoken sign({ ...payload }, secret, { algorithm: 'HS256', expiresIn: '10m' }) |
| AUTH-03 | Keycloak mode JWT (deferred to Phase 5) | Not in scope; middleware structure supports future provider switch |
| AUTH-04 | Auth middleware extracts { username, role, centers } from JWT payload | jwt.verify() returns decoded payload; attach to req.auth |
| AUTH-05 | settings.yaml auth section configures provider and JWT secret | Add auth.jwtSecret, auth.maxLoginAttempts, auth.twoFactorEnabled to settings.yaml |
| AUTH-06 | Shared getAuthHeaders() utility replaces duplicated implementations | New src/services/authHeaders.ts reads JWT string from sessionStorage |
| AUTH-07 | Remove hardcoded DEFAULT_CREDENTIALS from AuthContext.tsx | Login function replaced with async server call; remove DEFAULT_CREDENTIALS const |
| AUTH-08 | Remove hardcoded KNOWN_USERS from server/utils.ts | validateAuth() replaced by authMiddleware.ts; KNOWN_USERS removed |
| AUTH-09 | JWT token format identical for local and Keycloak: { sub, preferred_username, role, centers, iat, exp } | Verified D-06 payload matches; AuthContext type User extended to include centers |
| USER-07 | POST /api/auth/login validates credentials server-side (bcrypt compare), returns signed session token | bcryptjs 3.0.3 compare(); read data/users.json for passwordHash |
| USER-08 | Passwords never sent to or stored in client | Client receives JWT opaque token only; AuthContext drops password state |
| USER-09 | Session token is server-signed JWT (HS256 with server secret from settings.yaml) | jsonwebtoken sign() with settings.auth.jwtSecret |
| USER-10 | Client stores JWT in sessionStorage, sends as Bearer token | authHeaders.ts reads sessionStorage key 'emd-jwt' |
| USER-13 | Server-side failed login limiting, 5 attempts, exponential backoff | In-memory Map<username, {count, lockedUntil}>; configurable via settings.yaml |
</phase_requirements>

---

## Summary

Phase 2 replaces a demonstrator-quality auth stub (base64-encoded JSON tokens, hardcoded KNOWN_USERS) with production-grade server-side authentication using bcrypt password hashing and HS256 JWT signing. Simultaneously, it migrates audit logging from client-side localStorage to a tamper-proof SQLite database where all writes are internal server function calls — the client has no write path at all.

The stack is straightforward: `bcryptjs` for pure-JS password hashing, `jsonwebtoken` for JWT sign/verify, `better-sqlite3` for synchronous SQLite (no async complexity), and `otplib` for TOTP OTP validation. All three packages are CJS modules that tsx handles transparently via esbuild — the same pattern as `js-yaml` already in use.

The biggest migration surface is the audit removal: 12 frontend files use `logAudit()` or `usePageAudit()`. All calls are deleted (not replaced) because server request-level middleware takes over completely. The `usePageAudit` hook itself is also deleted. AuditPage.tsx needs the most rework — it must become async and lose its clear button.

**Primary recommendation:** Build server infrastructure first (authMiddleware, authApi, auditDb), then update LoginPage and AuthContext, then sweep client audit calls. Sequence prevents a broken intermediate state where the server expects JWTs but the client still sends base64 tokens.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| bcryptjs | 3.0.3 | Password hashing (pure JS) | Zero native dependencies; same API as native bcrypt; compatible with Node ESM context via tsx |
| jsonwebtoken | 9.0.3 | JWT sign and verify (HS256) | Industry standard; already has @types/jsonwebtoken 9.0.10 |
| better-sqlite3 | 12.8.0 | SQLite synchronous driver | Already decided (D-14); supports Node 20/22/24; prebuilt binaries via prebuild-install |
| otplib | 13.4.0 | TOTP generation and verification | ESM-native (exports.import path); dual CJS/ESM package; no native deps |

[VERIFIED: npm registry — versions confirmed 2026-04-10]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/bcryptjs | 3.0.0 | TypeScript types for bcryptjs | Install alongside bcryptjs |
| @types/jsonwebtoken | 9.0.10 | TypeScript types for jsonwebtoken | Install alongside jsonwebtoken |
| @types/better-sqlite3 | 7.6.13 | TypeScript types for better-sqlite3 | Install alongside better-sqlite3 |

[VERIFIED: npm registry — versions confirmed 2026-04-10]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bcryptjs | bcrypt (native) | Native bcrypt is faster but requires node-gyp compilation; bcryptjs is pure JS, zero build friction |
| jsonwebtoken | jose | jose is ESM-native with no CJS baggage; however jsonwebtoken is more familiar and tsx handles its CJS fine |
| better-sqlite3 | node:sqlite (Node 24 built-in) | Built-in sqlite is experimental and lacks the WAL/prepared statement maturity of better-sqlite3 |
| jsonwebtoken | express-jwt middleware | express-jwt adds a dependency; custom middleware (10 lines) is simpler and gives full control over public route exclusions |

**Installation:**

```bash
npm install bcryptjs jsonwebtoken better-sqlite3 otplib
npm install --save-dev @types/bcryptjs @types/jsonwebtoken @types/better-sqlite3
```

**Version verification:** Confirmed above against npm registry 2026-04-10. [VERIFIED: npm registry]

---

## Architecture Patterns

### Recommended Project Structure

```
server/
├── index.ts              # Mount authMiddleware + auditMiddleware BEFORE route handlers
├── authApi.ts            # POST /api/auth/login, POST /api/auth/verify, GET /api/auth/config
├── authMiddleware.ts     # JWT validation; attaches req.auth = { username, role, centers }
├── auditDb.ts            # SQLite init, logAuditEntry(), purgeOldEntries() — no HTTP layer
├── auditApi.ts           # GET /api/audit, GET /api/audit/export (read-only)
├── auditMiddleware.ts    # Response-wrapping middleware that calls logAuditEntry() after response
├── issueApi.ts           # (modify) replace validateAuth() with req.auth from authMiddleware
├── settingsApi.ts        # (modify) replace validateAuth() with req.auth from authMiddleware
└── utils.ts              # (modify) remove validateAuth() and KNOWN_USERS; keep readBody/sendError

src/services/
├── authHeaders.ts        # NEW: getAuthHeaders() reads sessionStorage 'emd-jwt', returns Bearer header
├── issueService.ts       # (modify) import getAuthHeaders from authHeaders.ts
└── settingsService.ts    # (modify) import getAuthHeaders from authHeaders.ts

src/context/
└── AuthContext.tsx        # (major rework) remove DEFAULT_CREDENTIALS, login() becomes async fetch

src/pages/
├── LoginPage.tsx          # (rework) fetch /api/auth/config on mount, POST /api/auth/login + /verify
└── AuditPage.tsx          # (rework) async load from /api/audit, remove clear button

src/hooks/
└── usePageAudit.ts        # DELETE entirely — server middleware handles all page audit
```

### Pattern 1: Auth Middleware with Public Route Exclusions

The middleware runs on ALL /api/* routes. Public routes are excluded by path match before JWT verification:

```typescript
// server/authMiddleware.ts
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

const PUBLIC_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/verify',
  '/api/auth/config',
]);

export interface AuthPayload {
  sub: string;
  preferred_username: string;
  role: string;
  centers: string[];
  iat: number;
  exp: number;
}

// Extend Express Request to carry auth context
declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (PUBLIC_PATHS.has(req.path)) {
    return next();
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, jwtSecret) as AuthPayload;
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

[ASSUMED] — Pattern derived from training knowledge; jsonwebtoken verify() API confirmed via npm registry version check.

### Pattern 2: Response-Wrapping Audit Middleware

Audit middleware must capture response status AFTER the handler runs. Use `res.on('finish')` — do not override `res.json()`:

```typescript
// server/auditMiddleware.ts
export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startMs = Date.now();
  const body = req.method !== 'GET' ? capturedBody : undefined; // body parsed earlier

  res.on('finish', () => {
    const duration = Date.now() - startMs;
    const user = req.auth?.preferred_username ?? 'anonymous';
    logAuditEntry({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      user,
      status: res.statusCode,
      duration_ms: duration,
      body: req.method !== 'GET' ? serializeBody(req) : null,
      query: req.method === 'GET' ? JSON.stringify(req.query) : null,
    });
  });

  next();
}
```

**Critical ordering in index.ts:**
1. `app.use(authMiddleware)` — sets req.auth
2. `app.use(express.json())` — parses body (needed before audit can read it)
3. `app.use(auditMiddleware)` — wraps response, reads req.auth and req.body
4. `app.use(authApiHandler)` — public auth routes
5. `app.use(issueApiHandler)` — protected routes
6. `app.use(settingsApiHandler)` — protected routes
7. `app.use(auditApiHandler)` — protected routes

[ASSUMED] — `res.on('finish')` is the idiomatic Node.js pattern for capturing response status post-send.

### Pattern 3: better-sqlite3 Synchronous SQLite (WAL Mode)

`better-sqlite3` is synchronous — no async/await. WAL mode allows concurrent reads while writes are in progress (relevant when audit logs are being written while reads serve AuditPage):

```typescript
// server/auditDb.ts
import Database from 'better-sqlite3';
import path from 'node:path';

let db: Database.Database;

export function initAuditDb(dataDir: string): void {
  const dbPath = path.join(dataDir, 'audit.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      user TEXT NOT NULL,
      status INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      body TEXT,
      query TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user);
    CREATE INDEX IF NOT EXISTS idx_audit_path ON audit_log(path);
  `);
}

export function logAuditEntry(entry: AuditDbRow): void {
  const stmt = db.prepare(
    `INSERT INTO audit_log (id, timestamp, method, path, user, status, duration_ms, body, query)
     VALUES (@id, @timestamp, @method, @path, @user, @status, @duration_ms, @body, @query)`
  );
  stmt.run(entry);
}

export function purgeOldEntries(): void {
  db.prepare(`DELETE FROM audit_log WHERE timestamp < datetime('now', '-90 days')`).run();
}
```

[ASSUMED] — better-sqlite3 API from training knowledge; matches documented patterns from better-sqlite3 README.

### Pattern 4: Failed Login Limiting with Exponential Backoff

In-memory Map; resets on successful login; locked until timestamp checked on every attempt:

```typescript
// Inside authApi.ts — login handler
interface LoginAttempt {
  count: number;
  lockedUntil: number; // ms timestamp, 0 = not locked
}

const loginAttempts = new Map<string, LoginAttempt>();

function checkLock(username: string, maxAttempts: number): { locked: boolean; retryAfterMs: number } {
  const attempt = loginAttempts.get(username);
  if (!attempt) return { locked: false, retryAfterMs: 0 };
  if (attempt.lockedUntil && Date.now() < attempt.lockedUntil) {
    return { locked: true, retryAfterMs: attempt.lockedUntil - Date.now() };
  }
  if (attempt.count >= maxAttempts) {
    // Lock with exponential backoff: 2^count seconds
    const backoffMs = Math.pow(2, attempt.count) * 1000;
    attempt.lockedUntil = Date.now() + backoffMs;
    return { locked: true, retryAfterMs: backoffMs };
  }
  return { locked: false, retryAfterMs: 0 };
}

function recordFailure(username: string): void {
  const prev = loginAttempts.get(username) ?? { count: 0, lockedUntil: 0 };
  loginAttempts.set(username, { count: prev.count + 1, lockedUntil: 0 });
}

function resetAttempts(username: string): void {
  loginAttempts.delete(username);
}
```

[ASSUMED] — standard in-memory rate limiting pattern.

### Pattern 5: JWT Secret Auto-Generation

On first startup, if `auth.jwtSecret` is absent from settings.yaml, generate and write it back:

```typescript
// In index.ts startup sequence, after settings are parsed
const authSection = (settings.auth ?? {}) as Record<string, unknown>;
let jwtSecret = typeof authSection.jwtSecret === 'string' ? authSection.jwtSecret : '';

if (!jwtSecret) {
  jwtSecret = randomBytes(32).toString('hex');
  // Write back to settings.yaml — preserves all other fields
  (settings as Record<string, unknown>).auth = { ...authSection, jwtSecret };
  fs.writeFileSync(SETTINGS_FILE, yaml.dump(settings), 'utf-8');
  console.log('[server] Generated JWT secret and saved to settings.yaml');
}
```

[ASSUMED] — Node.js `crypto.randomBytes` confirmed working in this environment.

### Pattern 6: Two-Step Login Flow (D-01)

**Step 1 — POST /api/auth/login:**
- Read body: `{ username, password }`
- Check login lock (D-09)
- Load users.json, find user by username
- `bcryptjs.compare(password, user.passwordHash)` — if fail: recordFailure(), return 401
- If success and `twoFactorEnabled === false`: sign JWT directly, return `{ token }`
- If success and `twoFactorEnabled === true`: sign challenge token (short expiry, payload includes username only), return `{ challengeToken }`

**Step 2 — POST /api/auth/verify:**
- Read body: `{ challengeToken, otp }`
- Verify challengeToken (short-lived, HS256)
- Extract username from challenge payload
- Validate OTP using otplib: `totp.check(otp, user.totpSecret)` or fixed OTP fallback
- If valid: sign full JWT, return `{ token }`

**GET /api/auth/config (D-02):**
- No auth required
- Return `{ twoFactorEnabled: settings.twoFactorEnabled }`

### Schema Mismatch: AUDIT-09 vs D-14

**IMPORTANT:** REQUIREMENTS.md AUDIT-09 specifies a different schema from CONTEXT.md D-14.

| Field | AUDIT-09 (REQUIREMENTS.md) | D-14 (CONTEXT.md / locked decision) |
|-------|---------------------------|-------------------------------------|
| id | TEXT PK | TEXT PK |
| timestamp | TEXT | TEXT |
| user | TEXT | TEXT |
| action | TEXT | — (replaced by method + path) |
| detailKey | TEXT | — |
| detailArgs | TEXT | — |
| resource | TEXT | — |
| method | — | TEXT |
| path | — | TEXT |
| status | — | INTEGER |
| duration_ms | — | INTEGER |
| body | — | TEXT NULL |
| query | — | TEXT NULL |

**Resolution:** D-14 is a locked decision from CONTEXT.md. D-14's request-level schema (method/path/status/duration) is what gets implemented. AUDIT-09's action/detailKey/detailArgs/resource schema was for the old client-side model. The planner should follow D-14.

### Anti-Patterns to Avoid

- **Do not use `express.json()` before authMiddleware:** Body parsing should happen after auth to avoid paying the cost of parsing unauthenticated requests. Exception: auth routes themselves need to parse body — handle via route-level middleware or parse inside the handler using the existing `readBody()` utility.
- **Do not store JWT in localStorage:** sessionStorage is correct (D-04); JWT is cleared on tab close.
- **Do not capture large response bodies in audit:** D-11 explicitly says GET logs query params only, mutations log request body only — not response bodies (which can be large FHIR bundles).
- **Do not use `res.json()` override for audit capture:** `res.on('finish')` is cleaner and does not interfere with Express internals.
- **Do not use `express-jwt` package:** A 10-line custom middleware gives full control and avoids an extra dependency (see Claude's Discretion in CONTEXT.md).
- **Do not precompile better-sqlite3 statements at module load time:** The db may not be initialized yet. Use `db.prepare()` inside the function or cache after init.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom hash/salt logic | bcryptjs.hash() + bcryptjs.compare() | Timing attack prevention, salt management, work factor tuning are all baked in |
| JWT sign/verify | Custom HMAC + base64 | jsonwebtoken.sign() + verify() | Claims validation (exp, iat), algorithm enforcement, error classification |
| SQLite WAL + prepared statements | Raw fs writes or JSON file | better-sqlite3 | Atomicity, concurrent reads, index-based filtering — hand-rolled JSON grows to O(n) |
| TOTP validation | Custom time-window OTP math | otplib.totp.check() | 30-second window, clock drift tolerance, RFC 6238 compliance |

**Key insight:** The bcrypt and JWT domains have many subtle security edge cases (timing attacks on comparison, algorithm confusion attacks on JWT, clock drift on TOTP). Using the standard libraries eliminates these entire categories of bugs.

---

## Common Pitfalls

### Pitfall 1: ESM vs CJS — better-sqlite3 import

**What goes wrong:** `better-sqlite3` is a CJS package with native bindings. Direct `import Database from 'better-sqlite3'` in an ESM project can fail at runtime with `ERR_MODULE_NOT_FOUND` or native binding resolution errors.

**Why it happens:** `"type": "module"` in package.json makes Node treat `.js` files as ESM. `better-sqlite3` uses `require()` internally.

**How to avoid:** `tsx` (esbuild-based) handles CJS interop transparently — the same pattern that works for `js-yaml` (`import yaml from 'js-yaml'`) works for `better-sqlite3`. Use `import Database from 'better-sqlite3'` directly. tsx rewrites CJS defaults at compile time.

**Warning signs:** Runtime crash mentioning `ERR_MODULE_NOT_FOUND` or `Cannot find module`. Fallback: use `createRequire` from `node:module`.

### Pitfall 2: JWT Secret Written to settings.yaml — YAML Quoting

**What goes wrong:** A 64-character hex string written back to settings.yaml via `yaml.dump()` may be interpreted as a different scalar type on next parse if not quoted.

**Why it happens:** js-yaml's `dump()` may or may not quote long strings. On re-parse, a numeric-looking string could be misinterpreted.

**How to avoid:** After generating the secret, verify `yaml.load(yaml.dump({ auth: { jwtSecret: secret } }))` round-trips correctly. Use `yaml.dump(settings, { quotingType: '"', forceQuotes: false })` — js-yaml handles this correctly for hex strings (no special chars), but verify.

### Pitfall 3: express.json() Body Consumption

**What goes wrong:** If `express.json()` is mounted globally, it consumes the request stream. The existing `readBody()` utility in `utils.ts` would then receive an empty stream.

**Why it happens:** Both `express.json()` and `readBody()` read `req` stream; streams can only be consumed once.

**How to avoid:** Either (a) continue using `readBody()` in all handlers (existing pattern, no `express.json()` global mount), or (b) add `express.json()` globally and switch handlers to use `req.body`. The auditMiddleware reads `req.body` (which requires express.json). Option (b) is cleaner for Phase 2. If switching, update all handlers that currently call `readBody()`.

**Recommended approach:** Add `express.json()` middleware globally (after authMiddleware). Update `authApi.ts` handlers to use `req.body`. The auditMiddleware then reads `req.body` for mutation logging. Phase 2 can leave `issueApi.ts` and `settingsApi.ts` using `readBody()` (the body is already consumed by express.json, so `readBody()` would return empty — this is a breaking change if not handled). **Decision for planner:** Switch all handlers to `req.body` in Phase 2, or keep `readBody()` and parse body in auditMiddleware separately.

[ASSUMED] — based on Express 5 middleware behavior; express.json is confirmed built-in to Express 5.

### Pitfall 4: AuthContext Login — Async vs Sync

**What goes wrong:** The current `login()` function in AuthContext is synchronous. Components that call `const result = login(username, password, otp)` expect an immediate return value. The new server-based login requires `await fetch(...)`.

**Why it happens:** Architectural change from local to remote validation.

**How to avoid:** Change `login()` to `async login()` returning `Promise<{ ok: boolean; error?: string }>`. Update `LoginPage.tsx` to `await` the result. Also update AuthContext's `AuthContextType` interface accordingly.

### Pitfall 5: users.json Missing passwordHash on First Seed

**What goes wrong:** Phase 1 already seeds `data/users.json` without `passwordHash` fields. Phase 2 adds bcrypt-based login that requires `user.passwordHash`. On first Phase 2 startup, the file exists (so the seed-if-absent check is skipped) but the records have no hash.

**Why it happens:** Phase 1 seeded users.json with profile data only; passwords were not needed yet.

**How to avoid:** Phase 2 startup must check whether existing users.json records contain `passwordHash`. If absent, add default bcrypt hashes for all users. This is a migration step, not just an "if absent create file" check.

**Default password strategy:** All seeded users get a default password (e.g., `changeme2025!` for all, or role-specific). Since this is a demonstrator, simple known defaults are acceptable. The password hash is computed once at startup using `bcryptjs.hashSync('changeme2025!', 12)`.

### Pitfall 6: AuditPage Filter Parameters

**What goes wrong:** The current AuditPage does all filtering client-side on a local array. After Phase 2, entries come from the server with limit/offset pagination. The UI's time range and category filters must become server-side query parameters.

**Why it happens:** Moving from sync local state to async paginated API.

**How to avoid:** Design GET /api/audit to accept `?user=&action=&from=&to=&limit=&offset=` query parameters and filter in SQL. AuditPage re-fetches when filters change (or filters client-side on a reasonable page size like 500 entries).

**Simpler alternative (recommended for Phase 2):** Fetch the last 500 entries (no pagination), filter client-side using the existing filter logic. The 90-day retention keeps the dataset manageable. Add proper pagination in a later phase.

### Pitfall 7: Challenge Token Leakage

**What goes wrong:** The 2FA challenge token (step 1 response when 2FA is enabled) must be short-lived (e.g., 5 minutes) and must only be usable for step 2. If the challenge token has the same payload as the full JWT, it could be used as an auth token by a client that skips step 2.

**How to avoid:** Sign challenge token with a different claim: `{ sub: username, purpose: 'challenge', iat, exp }`. In `authMiddleware.ts`, reject tokens where `payload.purpose === 'challenge'` — only full tokens (no `purpose` field) are accepted as auth tokens.

---

## Code Examples

### bcryptjs Usage Pattern

```typescript
// Source: bcryptjs npm README (pure JS, same API as native bcrypt)
import bcrypt from 'bcryptjs';

// Hash a password (12 rounds ~ 300ms on modern hardware — good balance)
const hash = await bcrypt.hash(plainPassword, 12);

// Compare on login — timing-safe
const match = await bcrypt.compare(attemptedPassword, storedHash);
```

[VERIFIED: npm registry version 3.0.3; API from training knowledge tagged ASSUMED for specifics]

### jsonwebtoken HS256 Sign and Verify

```typescript
// Source: jsonwebtoken npm README
import jwt from 'jsonwebtoken';

// Sign — 10m matches the 10-minute inactivity timeout (D-05)
const token = jwt.sign(
  { sub: username, preferred_username: username, role, centers },
  jwtSecret,
  { algorithm: 'HS256', expiresIn: '10m' }
);

// Verify — throws on expiry or bad signature
try {
  const payload = jwt.verify(token, jwtSecret) as AuthPayload;
  // payload.sub, payload.role, payload.centers available
} catch (err) {
  // TokenExpiredError, JsonWebTokenError, etc.
}
```

[ASSUMED] — jsonwebtoken 9.x API from training knowledge.

### better-sqlite3 Prepared Statements

```typescript
// Source: better-sqlite3 README
import Database from 'better-sqlite3';

const db = new Database('/path/to/audit.db');
db.pragma('journal_mode = WAL');

// Prepared statement — created once, run many times
const insertStmt = db.prepare(`
  INSERT INTO audit_log (id, timestamp, method, path, user, status, duration_ms, body, query)
  VALUES (@id, @timestamp, @method, @path, @user, @status, @duration_ms, @body, @query)
`);

// Named parameter binding (object syntax)
insertStmt.run({ id, timestamp, method, path, user, status, duration_ms: durationMs, body, query });

// Query with filtering
const rows = db.prepare(
  `SELECT * FROM audit_log WHERE user = ? AND timestamp > ? ORDER BY timestamp DESC LIMIT ?`
).all(username, fromTimestamp, limit);
```

[ASSUMED] — better-sqlite3 12.x API from training knowledge.

### src/services/authHeaders.ts — New Shared Utility

```typescript
// src/services/authHeaders.ts
/** Session storage key for JWT */
const JWT_KEY = 'emd-jwt';

/** Store JWT after login */
export function storeJwt(token: string): void {
  sessionStorage.setItem(JWT_KEY, token);
}

/** Clear JWT on logout */
export function clearJwt(): void {
  sessionStorage.removeItem(JWT_KEY);
}

/** Return Authorization header object, or empty object if no JWT */
export function getAuthHeaders(): Record<string, string> {
  try {
    const token = sessionStorage.getItem(JWT_KEY);
    if (token) return { Authorization: `Bearer ${token}` };
  } catch { /* sessionStorage unavailable (SSR/test) */ }
  return {};
}
```

Note: Current codebase stores `emd-user` (JSON object) in sessionStorage. Phase 2 switches to storing the raw JWT string under `emd-jwt`. AuthContext reads user info by decoding the JWT payload client-side (no verification needed — signature is server-side only). This eliminates the redundant `emd-user` session key.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| base64(JSON) auth tokens | HS256 signed JWT | Phase 2 | Tokens are tamper-proof; server can verify without storing session |
| localStorage audit log | SQLite append-only table | Phase 2 | Tamper-proof from client; survives tab close; queryable with SQL |
| Client-side password validation | Server bcrypt compare | Phase 2 | Passwords never in client bundle |
| Per-page logAudit() calls | Request-level middleware | Phase 2 | Zero risk of missing an action; automatic for all routes |

**Deprecated/outdated after Phase 2:**
- `server/utils.ts:validateAuth()`: Replaced by `authMiddleware.ts`. Remove the function but keep `readBody()` and `sendError()`.
- `server/utils.ts:KNOWN_USERS`: Remove entirely.
- `src/services/auditService.ts:logAudit()`: Delete. The service file itself may be retained as a stub for `getAuditLog()` (now calls API) or deleted entirely.
- `src/hooks/usePageAudit.ts`: Delete the file.
- `src/context/AuthContext.tsx:DEFAULT_CREDENTIALS`: Remove the const and the synchronous login path.
- `src/context/AuthContext.tsx:VALID_OTP`: Remove the hardcoded OTP.
- `getAuthHeaders()` in `issueService.ts` and `settingsService.ts`: Remove both; import from `authHeaders.ts`.

---

## Client-Side Audit Sweep

All 12 files with `logAudit()` or `usePageAudit()` calls require modification. Scope breakdown:

| File | Type | What Changes |
|------|------|-------------|
| src/hooks/usePageAudit.ts | DELETE | Entire file deleted |
| src/services/auditService.ts | REWORK | Remove logAudit(), clearAuditLog(); keep/replace getAuditLog() with fetch call |
| src/context/AuthContext.tsx | REWORK | Remove logAudit import + 4 logAudit() calls (login, logout, auto_logout, create_user, delete_user) |
| src/pages/AuditPage.tsx | REWORK | Remove usePageAudit + clearAuditLog + handleClear; add async fetch + loading state |
| src/pages/QualityPage.tsx | MODIFY | Remove logAudit import + calls (flag/exclude actions) |
| src/pages/CohortBuilderPage.tsx | MODIFY | Remove logAudit import + calls (export action) |
| src/pages/CaseDetailPage.tsx | MODIFY | Remove logAudit import + call (case view) |
| src/pages/SettingsPage.tsx | MODIFY | Remove logAudit import + calls (setting changes) |
| src/pages/AdminPage.tsx | MODIFY | Remove usePageAudit import + call |
| src/pages/AnalysisPage.tsx | MODIFY | Remove usePageAudit import + call |
| src/pages/LandingPage.tsx | MODIFY | Remove usePageAudit import + call |
| src/pages/DocQualityPage.tsx | MODIFY | Remove usePageAudit import + call |

**Total:** 4 files require significant rework; 8 files require only import removal + 1-2 line deletion.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | tsx (esbuild) handles CJS interop for bcryptjs/jsonwebtoken/better-sqlite3 transparently via default import | Standard Stack, Pitfalls | Import fails at runtime; fallback is `createRequire` wrapper |
| A2 | `res.on('finish')` is the correct hook for capturing response status in Express 5 | Architecture Patterns | Audit entries miss status codes; alternative is `res.json()` override |
| A3 | better-sqlite3 12.x API uses `db.prepare(sql).run(obj)` with named parameters (`@name` syntax) | Code Examples | Syntax error on insert; check better-sqlite3 README for exact API |
| A4 | jsonwebtoken 9.x `sign()` accepts `{ expiresIn: '10m' }` shorthand | Code Examples | Token does not expire; check jsonwebtoken README |
| A5 | Phase 1 already creates the `data/` directory — auditDb.ts can assume it exists | Architecture Patterns | SQLite file creation fails; mitigation: always call `fs.mkdirSync(dataDir, { recursive: true })` in initAuditDb |
| A6 | otplib `totp.check(token, secret)` validates TOTP codes from authenticator apps | Standard Stack | OTP validation broken; Phase 2 may use a fixed OTP (D-01 says "challenge → OTP" but does not mandate TOTP vs fixed code) |

---

## Open Questions

1. **Body parsing strategy: readBody() vs express.json()**
   - What we know: Current handlers use `readBody()` (raw stream). Audit middleware needs `req.body`. `express.json()` global mount conflicts with `readBody()`.
   - What's unclear: Whether Phase 2 should switch all handlers from `readBody()` to `express.json()` global parse, or keep `readBody()` and parse body independently in auditMiddleware.
   - Recommendation: Switch to `express.json()` global mount in Phase 2. Update all mutation handlers to use `req.body`. Cleaner for audit middleware and all future handlers.

2. **OTP validation: TOTP (authenticator app) or fixed code?**
   - What we know: Current client uses fixed `VALID_OTP = '123456'`. D-01 says "POST /api/auth/verify with { challengeToken, otp }". No mention of TOTP secret in users.json.
   - What's unclear: Whether the server should validate against a TOTP secret (requires `totpSecret` in users.json) or a fixed configured OTP (demonstrator-grade).
   - Recommendation: Use a configurable fixed OTP in settings.yaml (e.g., `auth.demoOtp: 123456`) for the demonstrator. TOTP integration is a Phase 3+ concern when user management adds TOTP enrollment.

3. **users.json migration: how to handle existing Phase 1 seed?**
   - What we know: Phase 1 seeds users.json without `passwordHash`. Phase 2 bcrypt login requires `passwordHash`. The seed-if-absent check in index.ts won't re-run because the file already exists.
   - What's unclear: Exact startup sequence for the migration.
   - Recommendation: In Phase 2 startup, after reading users.json, check if any user lacks `passwordHash`. If so, add `bcryptjs.hashSync(DEFAULT_PASS, 12)` for each and write back. Log a warning.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | v22.22.0 | — |
| tsx | Server runner (`npm start`) | Yes | 4.21.0 | — |
| npm registry | Package install | Yes (assumed) | — | — |
| better-sqlite3 | audit.db | Not installed | 12.8.0 available | — |
| bcryptjs | Password hashing | Not installed | 3.0.3 available | — |
| jsonwebtoken | JWT sign/verify | Not installed | 9.0.3 available | — |
| otplib | OTP validation | Not installed | 13.4.0 available | — |

[VERIFIED: npm registry — all package versions confirmed 2026-04-10]
[VERIFIED: runtime — Node.js v22.22.0, tsx 4.21.0 confirmed in environment]

**Missing dependencies with no fallback:**
- All four packages (bcryptjs, jsonwebtoken, better-sqlite3, otplib) must be installed. Wave 0 plan must run `npm install`.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | bcryptjs hash + compare; JWT HS256; failed login limiting |
| V3 Session Management | Yes | sessionStorage JWT; 10-min expiry; clear on logout/401 |
| V4 Access Control | Yes | authMiddleware extracts role; admin-only routes check req.auth.role |
| V5 Input Validation | Yes | readBody() size limit; JSON.parse with try/catch; username length check on login |
| V6 Cryptography | Yes | bcryptjs (no hand-rolled hashing); JWT HS256 with 32-byte random secret; never MD5/SHA1 |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Password brute force | Spoofing | Failed login limiting (D-09): 5 attempts, exponential backoff, in-memory Map |
| JWT algorithm confusion | Tampering | Explicitly specify `{ algorithms: ['HS256'] }` in jwt.verify() options |
| Timing attack on password compare | Spoofing | bcryptjs.compare() is timing-safe by design |
| Token theft via XSS | Spoofing | sessionStorage (not cookie); mitigated by React's XSS escaping, but not a guarantee |
| Audit log tampering | Tampering | No write/delete API endpoints; SQLite writes only via internal server calls |
| Client-side credential leakage | Information Disclosure | Remove DEFAULT_CREDENTIALS from AuthContext; passwords never in bundle |
| JWT secret in version control | Disclosure | Generate at runtime; store in settings.yaml; ensure settings.yaml is in .gitignore |

**settings.yaml git exposure check:** [ASSUMED] Verify that `public/settings.yaml` is NOT in `.gitignore` currently (it's in `public/` which is typically committed). After Phase 2 adds `auth.jwtSecret`, the file must be gitignored OR the jwtSecret must be moved to an env var. This is a security decision the planner should flag.

---

## Sources

### Primary (HIGH confidence)
- npm registry — bcryptjs 3.0.3, jsonwebtoken 9.0.3, better-sqlite3 12.8.0, otplib 13.4.0, @types versions [VERIFIED: npm view commands run 2026-04-10]
- Node.js v22.22.0 runtime — crypto.randomBytes confirmed working [VERIFIED: executed in environment]
- tsx 4.21.0 — CJS interop confirmed via js-yaml default import pattern already in server/index.ts [VERIFIED: existing codebase]

### Secondary (MEDIUM confidence)
- better-sqlite3 engine field — `{ node: '20.x || 22.x || 23.x || 24.x || 25.x' }` — Node 22 supported [VERIFIED: npm view]
- bcryptjs description — "pure JavaScript with zero dependencies" — no native compilation [VERIFIED: npm view]
- otplib exports — dual CJS/ESM package with `import` path [VERIFIED: npm view exports]

### Tertiary (LOW confidence)
- better-sqlite3 WAL pragma syntax and named parameter `@name` API [ASSUMED — from training]
- jsonwebtoken 9.x sign/verify option names [ASSUMED — from training]
- res.on('finish') pattern for Express middleware audit capture [ASSUMED — from training]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via npm registry
- Architecture: MEDIUM — patterns are standard but specific API calls are ASSUMED from training
- Pitfalls: MEDIUM — based on known Node.js/Express patterns; CJS interop verified via existing js-yaml usage
- Security: HIGH — ASVS categories and threat patterns are well-established for this stack

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable libraries; packages move slowly)
