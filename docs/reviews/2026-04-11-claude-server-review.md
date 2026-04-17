# Server Code Review -- 2026-04-11

**Reviewer:** Claude Opus 4.6 (1M context)
**Scope:** All 18 files in `server/`
**Application:** EyeMatics Clinical Demonstrator (Express 5 + SQLite + JWT + FHIR)

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2     |
| HIGH     | 6     |
| MEDIUM   | 10    |
| LOW      | 8     |
| **Total**| **26**|

The codebase shows strong defensive patterns: parameterized SQL everywhere, server-derived timestamps, proper body redaction in audit logs, atomic file writes, and solid center-based access control. The two critical findings are both in the Vite dev-mode authentication path, and the high-severity findings relate to TOCTOU races, unbounded audit export, OTP weakness, and a subtle FHIR proxy path issue.

---

## CRITICAL

### C-01: Vite dev plugin uses base64 token validation -- trivially forgeable

**File:** `server/utils.ts:43-72`
**Component:** `validateAuth()`

The Vite dev plugin authenticates requests by base64-decoding the Bearer token and parsing it as `{ username, role }`. While there is a `KNOWN_USERS` check (line 57-63) that verifies the claimed role matches a hardcoded list, this is security-by-obscurity: any attacker who knows a valid username (which are the 7 default users seeded at startup) can forge a valid token.

The function comment on line 42 acknowledges this: "In production, use signed JWTs or server-side sessions." However, the `configureServer` plugins (issueApiPlugin, settingsApiPlugin, fhirApiPlugin) use this for all dev-mode auth, meaning anyone who runs `npm run dev` on a network-accessible machine is completely exposed.

**Risk:** Full auth bypass in dev mode, including admin-only routes (settings write, issue export, audit export).

**Suggested fix:** Use the same JWT verification from `authMiddleware.ts` in dev plugins. Since `initAuth` runs at startup and generates the JWT secret, the Vite plugins should import and use `getJwtSecret()` + `jwt.verify()` instead of base64 decoding. Alternatively, add prominent documentation that dev mode must never be exposed beyond localhost and add a host binding guard.

---

### C-02: Vite fhirApiPlugin has no path traversal guard on manifest entries

**File:** `server/fhirApiPlugin.ts:44-46`

The production `fhirApi.ts` has a path traversal guard (line 259-262) that rejects manifest entries that resolve outside `public/data/`. The Vite dev plugin `fhirApiPlugin.ts` reads the same `manifest.json` but uses `path.join(DATA_DIR, file)` without any path traversal check:

```typescript
const filePath = path.join(DATA_DIR, file);
if (fs.existsSync(filePath)) {
  allBundles.push(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
}
```

A crafted `manifest.json` with entries like `"../../../etc/passwd"` would allow reading arbitrary files on the server.

**Risk:** Arbitrary file read via crafted manifest.json in dev mode.

**Suggested fix:** Add the same path traversal guard:
```typescript
const resolved = path.resolve(DATA_DIR, file);
if (!resolved.startsWith(DATA_DIR + path.sep) && resolved !== DATA_DIR) {
  console.warn(`[fhir-api-plugin] Skipping path-traversal attempt: ${file}`);
  continue;
}
```

---

## HIGH

### H-01: Vite dev plugin lacks center filtering for FHIR resources without Organization entry

**File:** `server/fhirApiPlugin.ts:62-69`

The dev plugin's center filtering logic passes through bundles that lack an Organization entry (`if (!orgEntry) return true`), while the production `fhirApi.ts` handles this case by filtering at the resource level using `Patient.meta.source`. This means Blaze-sourced bundles in dev mode bypass center filtering entirely.

**Risk:** Information disclosure in dev mode -- non-admin users see all patients from Blaze bundles.

**Suggested fix:** Import and reuse `filterBundlesByCenters()` from `fhirApi.ts` instead of duplicating partial logic.

---

### H-02: TOCTOU race in user CRUD operations

**File:** `server/authApi.ts:316-319` (POST /users), `server/authApi.ts:367-376` (DELETE /users)

The user management endpoints call `loadUsers()` (which reads `users.json` from disk), modify the array, then call `saveUsers()`. Between `loadUsers()` and `saveUsers()`, another concurrent request could also call `loadUsers()`, get the stale state, and overwrite the first request's changes.

The `saveUsers()` function does have a write lock (initAuth.ts:141-162), but the lock only serializes the *write* itself, not the read-modify-write cycle. Two overlapping `POST /users` requests could both read the same user list, both see the username is available, and both add it -- the second write would silently overwrite the first.

**Risk:** Lost updates when two admin requests overlap. In the worst case, a user deletion could be silently reverted.

**Suggested fix:** Move `loadUsers()` + mutation + `saveUsers()` inside the write lock, or use a compare-and-swap pattern. The lock should wrap the entire read-modify-write cycle:

```typescript
export async function withUserLock<T>(fn: (users: UserRecord[]) => T): Promise<T> {
  await acquireWriteLock();
  try {
    const users = loadUsers();
    const result = fn(users);
    await saveUsers(users);
    return result;
  } finally {
    releaseWriteLock();
  }
}
```

---

### H-03: Audit export has no pagination or size limit -- potential DoS

**File:** `server/auditDb.ts:208-219`, `server/auditApi.ts:76-88`

`GET /api/audit/export` runs `SELECT * FROM audit_log ORDER BY timestamp DESC` with no LIMIT. With 90 days of retention on a busy system, this could easily be millions of rows. The entire result is serialized to JSON in memory and sent as a single HTTP response.

**Risk:** Memory exhaustion / OOM crash on the server. An admin user (or compromised admin token) could trigger a denial of service.

**Suggested fix:** Implement streaming JSON export using `JSON.stringify` per-row with `res.write()`, or add a configurable row limit (e.g. 100,000). Consider offering CSV export as it is significantly more memory-efficient for large datasets.

---

### H-04: Fixed OTP code shared across all users

**File:** `server/initAuth.ts:75`, `server/authApi.ts:199`

The OTP code is a single fixed string from `settings.yaml` (default: `'123456'`), shared by all users. This is documented as intentional ("no otplib"), but it means 2FA provides minimal additional security:

1. Any user who knows the OTP can authenticate as any other user (given they know the password).
2. The default `'123456'` is the most commonly guessed TOTP code.
3. The OTP never rotates.

**Risk:** 2FA is effectively a shared static password, not true second-factor authentication.

**Suggested fix:** If this is a demonstrator and real 2FA is out of scope, document this prominently in settings.yaml with a comment like `# WARNING: Fixed OTP -- not production-grade 2FA`. If real 2FA is desired, integrate a per-user TOTP library (e.g., `otpauth`).

---

### H-05: FHIR proxy path rewriting may allow path manipulation

**File:** `server/index.ts:208-227`

The FHIR proxy at `/api/fhir-proxy` uses `createProxyMiddleware` with `target: blazeTarget` but does not configure `pathRewrite`. By default, `http-proxy-middleware` v3 forwards the full original path. A request to `/api/fhir-proxy/../../admin` would be forwarded as-is to the Blaze server.

While Express typically normalizes paths and the Blaze server would also normalize, the proxy sits between them and could forward un-normalized paths depending on the HTTP library's behavior.

**Risk:** Potential path traversal on the proxied Blaze FHIR server if path normalization differs between Express and the target.

**Suggested fix:** Add explicit `pathRewrite`:
```typescript
pathRewrite: { '^/api/fhir-proxy': '/fhir' },
```
This ensures the forwarded path is always rooted at `/fhir` regardless of the incoming path.

---

### H-06: Settings GET exposes full config (including OTP code) to all authenticated users

**File:** `server/settingsApi.ts:76-83`

`GET /api/settings` returns the raw YAML file to any authenticated user (no role check). The settings file contains `otpCode` -- the shared 2FA code. Any authenticated researcher or clinician can read the OTP and use it for 2FA verification.

**Risk:** OTP code disclosure to all authenticated users, making 2FA ineffective even against insider threats.

**Suggested fix:** Either restrict `GET /api/settings` to admin-only, or strip sensitive fields (otpCode, keycloak secrets) from the response for non-admin users:
```typescript
settingsApiRouter.get('/', (req: Request, res: Response): void => {
  let content = readSettings();
  if (req.auth?.role !== 'admin') {
    const parsed = yaml.load(content) as Record<string, unknown>;
    delete parsed.otpCode;
    delete parsed.keycloak;
    content = yaml.dump(parsed);
  }
  res.setHeader('Content-Type', 'text/yaml');
  res.send(content);
});
```

---

## MEDIUM

### M-01: Rate limiter state grows unbounded in memory

**File:** `server/rateLimiting.ts:15`

The `loginAttempts` Map is never pruned. Every unique username (including attacker-supplied garbage usernames) creates a permanent entry. An attacker could send millions of login attempts with random usernames to exhaust server memory.

**Risk:** Memory exhaustion via login attempts with random usernames.

**Suggested fix:** Add a periodic cleanup (e.g., every 5 minutes) that removes entries where `lockedUntil < Date.now()` and `count` is below threshold. Alternatively, use an LRU cache with a maximum size.

---

### M-02: loadUsers() reads from disk on every request

**File:** `server/initAuth.ts:121-130`

Every call to `loadUsers()` does a synchronous `fs.readFileSync` from disk. This is called on every `/login`, `/verify`, `/users/me`, `/users` request. Under load, this causes unnecessary I/O and could become a bottleneck.

**Risk:** Performance degradation under load. Synchronous file I/O blocks the event loop.

**Suggested fix:** Cache the parsed users array in memory and invalidate on `saveUsers()`. The write lock already serializes writes, so a simple invalidation pattern works:
```typescript
let _usersCache: UserRecord[] | null = null;
export function loadUsers(): UserRecord[] {
  if (_usersCache) return _usersCache;
  // ... read from disk ...
  _usersCache = parsed;
  return _usersCache;
}
export async function saveUsers(users: UserRecord[]): Promise<void> {
  // ... write ...
  _usersCache = users;
}
```

---

### M-03: Body redaction does not cover password reset response path

**File:** `server/auditMiddleware.ts:34-38`

`REDACT_PATHS` includes `/api/auth/users` (for POST create-user), but password reset goes to `/api/auth/users/:username/password` which is not in the set. The response body containing `generatedPassword` is set via `res.json()`, and since the audit middleware logs the *request* body (not response), the request body for PUT password-reset is empty (password is server-generated), so no actual leak occurs.

However, if the response body were ever logged (future enhancement), the generated password would appear in the audit log. The current code is safe but brittle.

**Risk:** Low currently, but a future change to log response bodies would leak generated passwords.

**Suggested fix:** Add the path to `REDACT_PATHS` defensively:
```typescript
'/api/auth/users',                    // POST create
'/api/auth/users/{*/password}',       // PUT reset (future-proof)
```

---

### M-04: No CSRF protection on state-changing endpoints

**File:** `server/index.ts` (global)

The server uses JWT Bearer tokens (not cookies), which provides inherent CSRF protection since browsers do not auto-attach Authorization headers. However, if the JWT is ever stored in a cookie (e.g., for SSO/Keycloak flows), all POST/PUT/DELETE endpoints would be vulnerable to CSRF.

**Risk:** CSRF vulnerability if authentication mechanism changes to cookie-based.

**Suggested fix:** Add a `SameSite=Strict` cookie policy if cookies are ever used, or add a CSRF token middleware proactively. Document that Bearer-only auth is the CSRF mitigation strategy.

---

### M-05: Helmet CSP allows 'unsafe-inline' for scripts

**File:** `server/index.ts:160`

The Content Security Policy includes `'unsafe-inline'` for `scriptSrc`. This weakens XSS protection since inline scripts injected by an attacker would execute.

**Risk:** Reduced XSS protection. An XSS vulnerability anywhere in the frontend would not be mitigated by CSP.

**Suggested fix:** Use nonce-based CSP (`'nonce-<random>'`) for legitimate inline scripts, or move all inline scripts to external files and remove `'unsafe-inline'`.

---

### M-06: Saved search ID is client-supplied, enabling cross-user overwrites

**File:** `server/dataApi.ts:176`, `server/dataDb.ts:163-167`

`POST /saved-searches` accepts `id` from the client. The `addSavedSearch()` function uses `INSERT OR REPLACE`, which means a client that guesses or knows another user's search ID cannot overwrite it (because the query also matches on `username`). However, the client *can* overwrite their own searches by reusing an ID, which may be intentional (upsert pattern).

The `DELETE /saved-searches/:id` also scopes by username (line 232), so cross-user deletion is not possible.

**Risk:** Low -- properly scoped by username. But client-controlled IDs could allow a user to silently overwrite their own saved searches.

**Suggested fix:** Consider server-generating the ID (like quality flags do) and returning it in the response. This is a design preference, not a vulnerability.

---

### M-07: FHIR bundle cache never expires

**File:** `server/fhirApi.ts:336-344`

`getCachedBundles()` caches bundles indefinitely until `invalidateFhirCache()` is called (only on settings change). If the Blaze server data changes, the cache serves stale data forever. For local files, changes are also not detected.

**Risk:** Stale clinical data served to users indefinitely.

**Suggested fix:** Add a TTL to the cache (e.g., 5 minutes):
```typescript
let _bundleCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getCachedBundles(): Promise<FhirBundle[]> {
  if (_bundleCache !== null && Date.now() - _bundleCacheTime < CACHE_TTL_MS) {
    return _bundleCache;
  }
  // ... reload ...
}
```

---

### M-08: No input length validation on username in login/user-creation

**File:** `server/authApi.ts:102-103` (login), `server/authApi.ts:295` (create user)

The login endpoint validates that `username` is a non-empty string but does not check its length. An attacker could send a multi-megabyte username string. While `express.json({ limit: '1mb' })` caps the total body size, a 1MB username would still be stored in the rate limiter Map and used in case-insensitive lookups.

User creation trims but does not limit length either (line 328).

**Risk:** Minor resource abuse. A very long username stored in the rate limiter wastes memory.

**Suggested fix:** Add a maximum username length (e.g., 128 characters):
```typescript
if (username.length > 128) {
  res.status(400).json({ error: 'Username too long' });
  return;
}
```

---

### M-09: writeSettings does not validate blazeUrl as a valid URL

**File:** `server/settingsApi.ts:41-55`

`validateSettingsSchema()` checks that `dataSource.blazeUrl` is a non-empty string but does not validate it as a proper URL. A malicious admin could set `blazeUrl` to `file:///etc/passwd` or an internal network address, and the FHIR proxy or `loadFromBlaze()` would attempt to connect to it.

Since this is admin-only, the risk is limited to a compromised admin account performing SSRF.

**Risk:** Server-Side Request Forgery (SSRF) via compromised admin account.

**Suggested fix:** Validate that `blazeUrl` starts with `http://` or `https://` and optionally restrict to allowed hosts:
```typescript
if (!/^https?:\/\//.test(ds.blazeUrl)) return 'dataSource.blazeUrl must be an HTTP(S) URL';
```

---

### M-10: Keycloak role/centers claim extraction is fragile

**File:** `server/authMiddleware.ts:112-115`

The Keycloak token handler extracts `role` as the first element of an array (`raw.role[0]`), and `centers` by checking if it is a string or array. If the Keycloak realm does not include these custom claims at all, `rawRole` would be `undefined` and `rawCenters` would be `[]`, resulting in a user with `role: undefined` and no centers. This user would pass auth but fail role checks silently.

**Risk:** Users with misconfigured Keycloak claims could authenticate but get inconsistent authorization behavior. `role: undefined` would not match `'admin'` checks, so they would be a de-facto "no role" user with minimal access.

**Suggested fix:** Validate that required claims exist and reject the token if they are missing:
```typescript
if (!rawRole || typeof rawRole !== 'string') {
  res.status(401).json({ error: 'Token missing required role claim' });
  return;
}
```

---

## LOW

### L-01: Default password 'changeme2025!' is hardcoded and not rotated

**File:** `server/initAuth.ts:243`

The migration function sets `'changeme2025!'` as the default password for all users without a hash. While this is a one-time migration, the default password is in the source code and never forces a password change on first login.

**Suggested fix:** Add a `mustChangePassword` flag to user records and enforce it on login.

---

### L-02: No request logging for non-API routes

**File:** `server/auditMiddleware.ts:107-109`

The audit middleware only logs `/api/*` requests. Requests to static files, the SPA fallback, or the FHIR proxy error paths are not logged. While this is intentional for performance, it means attacks on static file serving (e.g., probing for sensitive files in `dist/`) are invisible.

**Suggested fix:** Consider logging 404s for static files at a minimum, or use a separate access log middleware (like `morgan`).

---

### L-03: Exponential backoff grows without bound

**File:** `server/rateLimiting.ts:28-29`

The lockout duration is `2^count * 1000ms`. After 20 failed attempts, the lockout would be `2^20 * 1000ms = ~17 minutes`. After 30 attempts: `2^30 * 1000 = ~12 days`. After 40: `~12 years`. The counter never resets unless a successful login occurs.

**Suggested fix:** Cap the maximum lockout duration:
```typescript
const maxLockMs = 30 * 60 * 1000; // 30 minutes
const lockedUntil = newCount >= maxLoginAttempts
  ? Date.now() + Math.min(Math.pow(2, newCount) * 1000, maxLockMs)
  : 0;
```

---

### L-04: Issue filenames contain unsanitized timestamp characters

**File:** `server/issueApi.ts:76`

The filename `issue-${timestamp.replace(/[:.]/g, '-')}_${id.slice(0, 8)}.json` uses the ISO timestamp with only `:` and `.` replaced. The `T` and `Z` characters remain, but these are safe for file systems. No actual vulnerability, but the regex could be more explicit.

**Suggested fix:** No action needed -- this is cosmetic only.

---

### L-05: No graceful shutdown handling

**File:** `server/index.ts`

The server does not handle `SIGTERM` or `SIGINT`. When the process is killed, in-flight SQLite writes could be interrupted. While WAL mode provides crash recovery, explicit graceful shutdown would be cleaner.

**Suggested fix:**
```typescript
process.on('SIGTERM', () => {
  console.log('[server] Shutting down gracefully...');
  // close SQLite connections, stop intervals, close HTTP server
  process.exit(0);
});
```

---

### L-06: Audit middleware does not handle logAuditEntry errors

**File:** `server/auditMiddleware.ts:140-151`

The `res.on('finish')` callback calls `logAuditEntry()` without a try/catch. If the SQLite insert fails (e.g., disk full, database locked), the error would be an unhandled exception in the event callback, potentially crashing the process.

**Suggested fix:** Wrap in try/catch:
```typescript
res.on('finish', () => {
  try {
    logAuditEntry({ ... });
  } catch (err) {
    console.error('[audit] Failed to log entry:', err);
  }
});
```

---

### L-07: `_resetForTesting()` export in keycloakAuth.ts

**File:** `server/keycloakAuth.ts:60-63`

Test-only functions exported from production modules are a code smell. If accidentally called in production, it would disable Keycloak auth entirely.

**Suggested fix:** Gate behind `NODE_ENV === 'test'` or move to a test helper module.

---

### L-08: SPA fallback serves index.html for all unmatched GETs including API-like paths

**File:** `server/index.ts:234-236`

The catch-all `app.get('/{*path}')` serves `index.html` for any unmatched GET, including paths like `/api/nonexistent`. Since API routes are mounted before this, actual API routes are matched first. However, a GET to `/api/something-not-defined` would skip the API routers (no match) and fall through to the SPA catch-all, returning HTML with a 200 status instead of a 404 JSON response.

**Suggested fix:** Add a catch-all 404 handler for `/api/*` before the SPA fallback:
```typescript
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});
```

---

## Positive Observations

The following patterns are well-implemented and worth acknowledging:

1. **Parameterized SQL everywhere** -- all SQLite queries use named parameters (`@param`), completely preventing SQL injection.
2. **Server-derived security fields** -- `flaggedBy`, `flaggedAt`, timestamps are always derived from JWT/server clock, never trusted from client input.
3. **Atomic file writes** -- `saveUsers()` uses temp-file + rename to prevent corruption.
4. **Audit body redaction** -- sensitive fields (password, OTP, challengeToken) are redacted before audit storage.
5. **Center validation on writes** -- data mutation endpoints validate case IDs against user's permitted centers, not just reads.
6. **Challenge token purpose check** -- 2FA challenge tokens are rejected by `authMiddleware` for API access (purpose='challenge' guard).
7. **Path traversal guard on FHIR local files** -- production `fhirApi.ts` validates resolved paths stay within `public/data/`.
8. **JWT secret stored with mode 0o600** -- file permission restricted on creation.
9. **Rate limiting shared between password and OTP** -- prevents OTP brute-force via separate counter.
10. **FHIR proxy restricted to admin** -- non-admin users cannot bypass center filtering via direct Blaze queries.

---

*Review completed 2026-04-11 by Claude Opus 4.6 (1M context)*
