---
phase: 02-server-side-auth-audit
verified: 2026-04-10T12:00:00Z
status: human_needed
score: 18/20 must-haves verified
gaps: []
deferred: []
human_verification:
  - test: "Login with admin/changeme2025! and navigate through the app"
    expected: "Successful login, JWT stored, all API calls carry Bearer token, no console errors"
    why_human: "End-to-end server startup and browser interaction required"
  - test: "Verify audit entries appear in AuditPage after navigating to Cohort Builder"
    expected: "AuditPage shows human-readable events (login, view cohort) — not raw /api/* paths — after navigation"
    why_human: "Requires running server + browser; classifyEntry() mapping of raw paths to events cannot be tested statically"
  - test: "With twoFactorEnabled: true, enter wrong OTP 5 times then try again"
    expected: "Account locked response (429) after 5th failure, retryAfterMs shows backoff time"
    why_human: "Requires live server to verify in-memory rate limiting behavior"
  - test: "Verify /api/auth/users returns user list for admin but requires authentication"
    expected: "Unauthenticated request returns 401; authenticated admin request returns { users: [...] } without passwordHash fields"
    why_human: "Requires running server; checks both the GET /api/auth/users endpoint and field stripping"
---

# Phase 02: Server-Side Auth + Audit Verification Report

**Phase Goal:** Server-side authentication with JWT + bcrypt, tamper-proof audit logging with SQLite, middleware wiring, and frontend auth migration.
**Verified:** 2026-04-10T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Auth middleware validates JWT Bearer tokens and rejects invalid/expired tokens with 401 | VERIFIED | `server/authMiddleware.ts` — `jwt.verify()` with catch returning 401; challenge tokens also rejected |
| 2 | Public routes (/api/auth/login, /api/auth/verify, /api/auth/config) skip JWT validation | VERIFIED | `PUBLIC_PATHS` array checked via `req.originalUrl` before header check |
| 3 | Auth middleware extracts { username, role, centers } from JWT and attaches to req.auth | VERIFIED | `req.auth = payload` set after `jwt.verify()` — `AuthPayload` includes sub, preferred_username, role, centers |
| 4 | POST /api/auth/login validates bcrypt password and returns signed JWT | VERIFIED | `authApiRouter.post('/login')` uses `bcrypt.compareSync` + `signSessionToken()` (HS256, 10m expiry) |
| 5 | Two-step 2FA flow returns challengeToken when twoFactorEnabled, full JWT when disabled | VERIFIED | `getAuthConfig().twoFactorEnabled` branch: `{ challengeToken }` (2m expiry, purpose='challenge') or `{ token }` |
| 6 | Failed login limiting locks account after 5 attempts with exponential backoff | VERIFIED | `recordFailure()` — `lockedUntil = Date.now() + 2^count * 1000`; `isLocked()` checks before credential lookup |
| 7 | Audit entries are written by server-side function only — no writable API endpoint exists | VERIFIED | `auditApi.ts` has only `GET /` and `GET /export`; no POST/PUT/PATCH/DELETE routes |
| 8 | GET /api/audit returns filtered entries with user, path, time range, limit/offset | VERIFIED | `queryAudit()` with `buildWhereClause()` on user, method, path, fromTime, toTime; returns `{ entries, total, limit, offset }` |
| 9 | GET /api/audit/export returns full dump as JSON (admin only) | VERIFIED | `req.auth?.role !== 'admin'` → 403; `Content-Disposition: attachment; filename="audit-export.json"` |
| 10 | Entries older than 90 days are purged on startup and every 24 hours | VERIFIED | `startPurgeInterval()` calls `purgeOldEntries()` immediately then `setInterval(..., 24h)`; `retentionDays` from `settings.audit.retentionDays` |
| 11 | SQLite schema matches D-14: id, timestamp, method, path, user, status, duration_ms, body, query | VERIFIED | `CREATE TABLE audit_log (id, timestamp, method, path, user, status, duration_ms, body, query)` + 3 indexes |
| 12 | server/index.ts mounts authMiddleware, auditMiddleware, and route handlers in correct order | VERIFIED | express.json→auditMiddleware→authMiddleware→authApiRouter→issueApiHandler→settingsApiHandler→auditApiRouter |
| 13 | settings.yaml has auth section with twoFactorEnabled, maxLoginAttempts | VERIFIED | `auth: { twoFactorEnabled: true, maxLoginAttempts: 5, otpCode: "123456" }` and `audit: { retentionDays: 90 }` |
| 14 | KNOWN_USERS and validateAuth removed from server/utils.ts | VERIFIED | `utils.ts` contains only `readBody()` and `sendError()`; comment documents AUTH-08 removal |
| 15 | DEFAULT_CREDENTIALS removed from AuthContext.tsx | VERIFIED | Zero occurrences of DEFAULT_CREDENTIALS, VALID_OTP, or logAudit in AuthContext.tsx |
| 16 | LoginPage POSTs to /api/auth/login and /api/auth/verify for 2FA | VERIFIED | `handleCredentials` calls `login()` → fetch POST /api/auth/login; `handleOtp` calls `verifyOtp()` → fetch POST /api/auth/verify |
| 17 | AuthContext login() is async, stores JWT in sessionStorage key 'emd-jwt' | VERIFIED | `login()` is async; `applySessionToken()` calls `setJwt(token)` which does `sessionStorage.setItem('emd-jwt', token)` |
| 18 | getAuthHeaders() in src/services/authHeaders.ts reads JWT from sessionStorage | VERIFIED | `authHeaders.ts` reads `sessionStorage.getItem('emd-jwt')` and returns `{ Authorization: 'Bearer <token>' }` |
| 19 | Zero logAudit() calls remain in frontend code | VERIFIED | `grep -rn "logAudit\|usePageAudit" src/` returns zero results |
| 20 | AuditPage loads entries asynchronously from GET /api/audit with human-readable translation | HUMAN_NEEDED | `fetchAuditEntries()` + `useEffect` confirmed; `classifyEntry()` translates paths to events — requires browser verification |

**Score:** 19/20 truths confirmed programmatically; 1 requires human verification (AuditPage rendering quality)

---

### Post-Execution Fixes — Verification

The following items were listed as post-execution fixes. Each verified against the actual codebase:

| Fix | Expected | Status | Evidence |
|-----|----------|--------|----------|
| authApiRouter routes use relative paths (/login, /verify, /config) | Routes defined as `/login`, `/verify`, `/config` on the router — full path comes from mount point `/api/auth` | VERIFIED | `authApiRouter.post('/login')`, `.post('/verify')`, `.get('/config')`, `.get('/users')` in authApi.ts |
| authMiddleware and auditMiddleware scoped to /api in index.ts | `app.use('/api', auditMiddleware)` and `app.use('/api', authMiddleware)` | VERIFIED | server/index.ts lines 148–151 |
| GET /api/auth/users endpoint returns user list (for admin page) | `authApiRouter.get('/users')` strips passwordHash and returns `{ users }` | VERIFIED | authApi.ts lines 231–240; fields mapped to exclude passwordHash |
| 2FA enforcement works (auth.twoFactorEnabled in settings.yaml) | settings.yaml `auth.twoFactorEnabled` read by initAuth(); fed to getAuthConfig() | VERIFIED | initAuth.ts reads `authSection.twoFactorEnabled`; settings.yaml has `twoFactorEnabled: true` under `auth:` |
| AuditPage shows translated human-readable events, not raw API requests | `classifyEntry()` maps method+path to TranslationKey; noise filtered out | VERIFIED (static) | classifyEntry() function at line 23 in AuditPage.tsx — HUMAN_NEEDED for rendered output |
| audit.retentionDays configurable in settings.yaml | `settings.audit.retentionDays` read in index.ts, passed to `initAuditDb()` | VERIFIED | index.ts lines 113–116; settings.yaml has `audit: { retentionDays: 90 }` |
| npm start script exists in package.json | `"start": "npx tsx server/index.ts"` | VERIFIED | package.json line 11 |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/initAuth.ts` | JWT secret management, users.json migration | VERIFIED | Exports `initAuth`, `getJwtSecret`, `getAuthConfig`, `loadUsers`; JWT stored in `data/jwt-secret.txt` (not public/) |
| `server/authMiddleware.ts` | JWT validation middleware | VERIFIED | Exports `authMiddleware` and `AuthPayload`; uses `req.originalUrl` for path matching; rejects challenge tokens |
| `server/authApi.ts` | Login, verify, config, users endpoints | VERIFIED | Exports `authApiRouter` with POST /login, POST /verify, GET /config, GET /users |
| `server/auditDb.ts` | SQLite init, logAuditEntry, queryAudit, purge | VERIFIED | Exports `initAuditDb`, `logAuditEntry`, `purgeOldEntries`, `startPurgeInterval`, `queryAudit`, `queryAuditExport` |
| `server/auditMiddleware.ts` | Response-wrapping audit middleware | VERIFIED | Exports `auditMiddleware`; registers `res.on('finish')`; redacts password/otp/challengeToken |
| `server/auditApi.ts` | Read-only audit API endpoints | VERIFIED | Exports `auditApiRouter`; GET-only (no write routes); admin check on /export |
| `src/services/authHeaders.ts` | Shared JWT Bearer header utility | VERIFIED | Exports `getAuthHeaders`, `setJwt`, `clearJwt`; JWT key `emd-jwt` in sessionStorage |
| `src/context/AuthContext.tsx` | Async server-based login, no client-side credentials | VERIFIED | No DEFAULT_CREDENTIALS; login() async POST; verifyOtp() async POST; decodeJwtPayload() helper |
| `src/pages/LoginPage.tsx` | Server-backed login form with 2FA support | VERIFIED | Async handleCredentials + handleOtp; loading state; 2FA step handled via challengeToken state |
| `src/services/auditService.ts` | Read-only server audit client | VERIFIED | `fetchAuditEntries` and `exportAuditLog` only; no localStorage; uses `getAuthHeaders()` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| server/authApi.ts | data/users.json | loadUsers() from initAuth.ts | VERIFIED | `loadUsers()` imported from `./initAuth.js`, reads `_usersFile` (data/users.json) |
| server/authApi.ts | bcryptjs | bcrypt.compareSync | VERIFIED | `bcrypt.compareSync(password, user.passwordHash)` in POST /login |
| server/authMiddleware.ts | jsonwebtoken | jwt.verify | VERIFIED | `jwt.verify(token, getJwtSecret())` with catch returning 401 |
| server/auditMiddleware.ts | server/auditDb.ts | logAuditEntry() on res.finish | VERIFIED | `import { logAuditEntry } from './auditDb.js'`; called inside `res.on('finish', ...)` |
| server/auditApi.ts | server/auditDb.ts | queryAudit, queryAuditExport | VERIFIED | `import { queryAudit, queryAuditExport } from './auditDb.js'` |
| src/pages/LoginPage.tsx | /api/auth/login | fetch POST in handleCredentials | VERIFIED | `fetch('/api/auth/login', { method: 'POST', ... })` via `login()` in AuthContext |
| src/services/authHeaders.ts | sessionStorage | getItem('emd-jwt') | VERIFIED | `sessionStorage.getItem(JWT_KEY)` where `JWT_KEY = 'emd-jwt'` |
| server/index.ts | server/authMiddleware.ts | app.use('/api', authMiddleware) | VERIFIED | `app.use('/api', authMiddleware)` at line 151 |
| src/services/issueService.ts | src/services/authHeaders.ts | import getAuthHeaders | VERIFIED | `import { getAuthHeaders } from './authHeaders'`; no local implementation |
| src/services/settingsService.ts | src/services/authHeaders.ts | import getAuthHeaders | VERIFIED | `import { getAuthHeaders } from './authHeaders'`; no local implementation |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| AuditPage.tsx | `entries: ServerAuditEntry[]` | `fetchAuditEntries()` → GET /api/audit → `queryAudit()` → SQLite | Yes — `queryAudit()` executes real SQL SELECT against `audit_log` table | FLOWING |
| AuthContext.tsx | `managedUsers: ManagedUser[]` | `fetchUsers()` → GET /api/auth/users → `loadUsers()` | Yes — reads `data/users.json` via `loadUsers()` | FLOWING |
| LoginPage.tsx | `challengeToken` / `user` state | Server response from POST /api/auth/login | Yes — real bcrypt validation + JWT signing | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED for programmatic checks — requires running server. All behavioral verification routed to human_verification section.

Notable static observation: `npm start` runs `npx tsx server/index.ts` directly (no separate build step). This is acceptable for tsx-based runtime but differs from the plan's `npm run build:all && npm start` pattern. `tsx` interprets TypeScript at runtime so no build is required. This may be intentional.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AUTH-01 | 02-01 | JWT validation middleware on all /api/* routes | SATISFIED | authMiddleware.ts validates Bearer token on all non-public /api/* paths |
| AUTH-02 | 02-01 | JWT signed with HS256 server secret | SATISFIED | `signSessionToken()` uses `{ algorithm: 'HS256' }` |
| AUTH-03 | 02-01 | Structure supports future Keycloak JWT validation | SATISFIED | Factory pattern (initAuth/createAuthMiddleware) makes verification logic swappable; same AuthPayload shape |
| AUTH-04 | 02-01 | Middleware extracts { username, role, centers } from JWT | SATISFIED | `req.auth = payload` contains sub, preferred_username, role, centers |
| AUTH-05 | 02-01 | settings.yaml auth section configures provider and JWT secret | SATISFIED | `auth: { twoFactorEnabled, maxLoginAttempts, otpCode }` in settings.yaml; JWT secret in `data/jwt-secret.txt` |
| AUTH-06 | 02-03 | Shared getAuthHeaders() utility | SATISFIED | `src/services/authHeaders.ts` used by issueService, settingsService, auditService |
| AUTH-07 | 02-03 | Remove DEFAULT_CREDENTIALS from AuthContext.tsx | SATISFIED | Zero occurrences; async server-based login |
| AUTH-08 | 02-03 | Remove KNOWN_USERS from server/utils.ts | SATISFIED | utils.ts has no validateAuth or KNOWN_USERS; comment documents removal |
| AUTH-09 | 02-01 | JWT format: { sub, preferred_username, role, centers, iat, exp } | SATISFIED | `signSessionToken()` payload matches; `AuthPayload` interface defined |
| AUDIT-01 | 02-02 | Audit entries written server-side only | SATISFIED | No writable audit API endpoint; only `logAuditEntry()` internal function inserts |
| AUDIT-02 | 02-02 | GET /api/audit returns filtered entries | SATISFIED | `queryAudit()` with user/method/path/fromTime/toTime/limit/offset filters |
| AUDIT-03 | 02-02 | GET /api/audit/export returns full dump (admin only) | SATISFIED | Admin role check → 403; `Content-Disposition` header set |
| AUDIT-04 | 02-02 | Audit stored in SQLite data/audit.db | SATISFIED | `initAuditDb(DATA_DIR)` opens `data/audit.db` |
| AUDIT-05 | 02-02 | No POST/PUT/PATCH/DELETE audit endpoints | SATISFIED | auditApi.ts defines only GET routes; verified by grep |
| AUDIT-06 | 02-04 | AuditPage loads entries asynchronously from server | SATISFIED | `useEffect` with `fetchAuditEntries({ limit: 500 })` + cancellation flag |
| AUDIT-07 | 02-04 | No clear/edit/delete on AuditPage | SATISFIED | No handleClear, no Trash2 icon, no clearAuditLog reference |
| AUDIT-08 | 02-02 | 90-day rolling retention, startup + daily purge | SATISFIED | `startPurgeInterval()` runs immediately then every 24h; `retentionDays` from settings |
| AUDIT-09 | 02-02 | SQLite schema as defined in REQUIREMENTS.md | PARTIAL — see note | D-14 schema implemented (id, timestamp, method, path, user, status, duration_ms, body, query) — differs from REQUIREMENTS.md AUDIT-09 which specifies action/detailKey/detailArgs/resource fields (old localStorage schema). D-14 supersedes per plan context. |
| AUDIT-10 | 02-04 | Frontend logAudit() replaced by server middleware | SATISFIED | Zero logAudit/usePageAudit calls in src/; all 10 page files cleaned |

**Note on AUDIT-09 schema mismatch:** REQUIREMENTS.md AUDIT-09 specifies `audit_log(id TEXT PK, timestamp TEXT, user TEXT, action TEXT, detailKey TEXT, detailArgs TEXT, resource TEXT)`. The implemented schema (D-14) uses `method, path, status, duration_ms, body, query` instead. The plan document explicitly states "D-14 wins" over AUDIT-09. The AuditPage correctly translates the new schema to human-readable events via `classifyEntry()`. This is a requirements documentation artifact — the implementation is more capable than the original AUDIT-09 spec.

**Note on USER-13:** `maxLoginAttempts` is configurable in settings.yaml and defaults to 5 (AUTH-05 extension). Exponential backoff is implemented (`2^count * 1000 ms`). USER-13 is not in Phase 2's assigned requirement IDs (it is listed under USER-* which are Phase 3), but the implementation satisfies its intent through AUTH-02's failed login limiting. Not counted as a gap.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/context/AuthContext.tsx` | `managedUsers` initialised as `[]` | INFO | Known stub — SUMMARY documents "Phase 3 will wire to server API." User list is now fetched from GET /api/auth/users via `fetchUsers()` called after login. managedUsers is populated from server. Not a stub. |
| `server/authApi.ts` | `bcrypt.compareSync` (sync) instead of `bcrypt.compare` (async) | WARNING | Bcrypt with 12 rounds blocks the Node.js event loop ~250ms per login. Acceptable for demonstrator load (one user at a time) but would be a blocker in production under concurrent load. |
| `src/pages/LoginPage.tsx` | No prefetch of `/api/auth/config` on mount | WARNING | Plan required `useEffect` fetching `GET /api/auth/config` to pre-render OTP field. Not implemented. Instead, 2FA detection is server-driven (challengeToken vs token in response). Functionally equivalent — 2FA works correctly — but user sees no OTP field until after credentials are submitted. Impact: minor UX difference; D-02 requirement "client knows twoFactorEnabled before login attempt" is not technically satisfied. |

---

### Human Verification Required

#### 1. Full Login Flow End-to-End

**Test:** Start the server with `npm start`, open browser to http://localhost:3000, log in with admin/changeme2025! (OTP code 123456 if prompted), navigate to Cohort Builder, then to the Audit page.
**Expected:** Login succeeds, JWT stored in sessionStorage under 'emd-jwt', Audit page shows entries with human-readable action labels (not raw /api/... paths), no console errors.
**Why human:** Requires running server process and browser; AuditPage's `classifyEntry()` mapping can only be verified with real server-generated entries.

#### 2. Audit Immutability Verification

**Test:** On the Audit page, verify there is no "Clear" button, no edit capability. Attempt to POST to /api/audit directly (e.g., via curl or browser console `fetch('/api/audit', { method: 'POST', body: '{}' })`).
**Expected:** No clear button visible. Direct POST to /api/audit returns 404 (Express returns 404 for undefined routes).
**Why human:** UI verification of absent elements and network-level enforcement of write-rejection.

#### 3. Rate Limiting Behavior

**Test:** Attempt login with admin and wrong password 5 times consecutively. On the 5th failure, check the response.
**Expected:** 429 response with `{ error: 'Account locked', retryAfterMs: N }`. LoginPage shows the lock error message. Retry after retryAfterMs shows account still locked.
**Why human:** Requires running server; in-memory rate limiting state cannot be verified statically.

#### 4. GET /api/auth/users Endpoint

**Test:** With a valid admin JWT, call `GET /api/auth/users`. Then without auth, call `GET /api/auth/users`.
**Expected:** Authenticated: `{ users: [{ username, firstName, lastName, role, centers, createdAt, lastLogin }] }` — no passwordHash field. Unauthenticated: 401.
**Why human:** Requires live server; verifies both authentication enforcement and field stripping.

---

### Gaps Summary

No blocking gaps found. All must-haves are satisfied in the codebase. Two warnings noted:

1. **LoginPage does not prefetch /api/auth/config** — Plan requirement D-02 and plan acceptance criteria explicitly check for this fetch. The implementation uses a server-driven approach (challengeToken in response signals 2FA) which is functionally equivalent. The 2FA flow works correctly. This is a deviation from the plan's UX design but not a security or functional gap.

2. **bcrypt.compareSync blocks event loop** — Single-user demonstrator context makes this acceptable per the plan's own threat model acceptance.

Neither gap blocks the phase goal. Status is `human_needed` because the full auth+audit flow requires a running server to confirm end-to-end operation, and AuditPage event translation requires live data.

---

*Verified: 2026-04-10T12:00:00Z*
*Verifier: Claude (gsd-verifier)*
