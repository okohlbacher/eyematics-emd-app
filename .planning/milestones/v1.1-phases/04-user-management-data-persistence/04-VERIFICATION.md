---
phase: 04-user-management-data-persistence
verified: 2026-04-10T00:00:00Z
status: gaps_found
score: 14/21 must-haves verified
gaps:
  - truth: "POST /api/auth/users validates credentials server-side (USER-07: bcrypt compare), returns signed JWT"
    status: failed
    reason: "AuthContext.login() never calls /api/auth/login. It validates credentials client-side against DEFAULT_CREDENTIALS and DEFAULT_MANAGED_USERS. The server endpoint exists and is correct, but is never invoked."
    artifacts:
      - path: "src/context/AuthContext.tsx"
        issue: "login() at line 185 uses DEFAULT_CREDENTIALS for validation; never calls POST /api/auth/login"
      - path: "src/pages/LoginPage.tsx"
        issue: "handleCredentials() calls login() from AuthContext (client-side); no fetch to /api/auth/login"
    missing:
      - "AuthContext.login() must be rewritten to call POST /api/auth/login and receive a JWT"
      - "LoginPage handleCredentials must be updated to handle server errors (401, 429 lockout)"

  - truth: "Passwords never sent to or stored in the client — login form POSTs to server (USER-08)"
    status: failed
    reason: "Login validates password client-side using DEFAULT_CREDENTIALS. Password comparison happens entirely in the browser. USER-08 requires server-side validation only."
    artifacts:
      - path: "src/context/AuthContext.tsx"
        issue: "Lines 188-199 compare password against DEFAULT_CREDENTIALS and DEFAULT_MANAGED_USERS in browser"
    missing:
      - "Remove DEFAULT_CREDENTIALS and client-side password comparison"
      - "Login must POST { username, password } to /api/auth/login and receive token"

  - truth: "Client stores server-signed JWT in sessionStorage and sends as Bearer token (USER-09, USER-10)"
    status: failed
    reason: "getAuthHeaders() constructs a Base64-encoded JSON object (btoa of {username, role}) — NOT a server-signed JWT. Server authMiddleware calls jwt.verify() which rejects this fake token with 401. All authenticated API calls from the client currently fail."
    artifacts:
      - path: "src/services/authHeaders.ts"
        issue: "Line 13: token = btoa(JSON.stringify({ username, role })) — not a JWT; not server-signed"
      - path: "src/context/AuthContext.tsx"
        issue: "Lines 210-211: setUser sets user object in state; sessionStorage stores user object not JWT"
    missing:
      - "After login, store the JWT token from server response in sessionStorage (not the user object)"
      - "getAuthHeaders() must read the stored JWT and send it as Bearer token unchanged"

  - truth: "AdminPage creates/deletes users via server API; DataContext loads data from server API (USER-06, DATA-06)"
    status: failed
    reason: "AdminPage and DataContext correctly call server endpoints, but getAuthHeaders() sends a fake Base64 token that jwt.verify() rejects. All calls return 401. The wiring is present but the token is invalid — API calls never succeed."
    artifacts:
      - path: "src/services/authHeaders.ts"
        issue: "Returns Base64-encoded JSON instead of server-signed JWT; causes all API calls to fail with 401"
      - path: "src/context/AuthContext.tsx"
        issue: "addManagedUser() and removeManagedUser() at lines 251-267 still write to localStorage (emd-managed-users) as backup; login() still initializes managedUsers from localStorage"
    missing:
      - "Fix getAuthHeaders() to send the actual JWT from login response"
      - "After login fix: AuthContext managedUsers localStorage fallback can be removed; fetchUsers() will populate from server"
---

# Phase 4: User Management & Data Persistence Verification Report

**Phase Goal:** Server-side user CRUD via API, server-side data storage replacing localStorage, AdminPage wired to API
**Verified:** 2026-04-10
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /api/auth/users/me returns authenticated user profile | ✓ VERIFIED | authApi.ts line 236; returns { username, role, centers, firstName, lastName } |
| 2 | POST /api/auth/users creates user with auto-generated password | ✓ VERIFIED | authApi.ts line 279; generates 16-char base64url via crypto.randomBytes; bcrypt round 12 |
| 3 | DELETE /api/auth/users/:username removes user (admin, self-delete guard) | ✓ VERIFIED | authApi.ts line 341; case-insensitive self-delete returns 409 |
| 4 | PUT /api/auth/users/:username/password resets password (server-generated, no plaintext in body) | ✓ VERIFIED | authApi.ts line 373; generateSecurePassword(); no req.body.password read |
| 5 | GET /api/auth/users returns user list to admin only | ✓ VERIFIED | authApi.ts line 261; role !== 'admin' → 403; passwordHash stripped from response |
| 6 | Non-admin users receive 403 on all CRUD endpoints | ✓ VERIFIED | All four mutation endpoints check req.auth.role !== 'admin' |
| 7 | POST /api/auth/users validates centers against VALID_CENTERS allowlist | ✓ VERIFIED | authApi.ts line 27; Set(['org-uka','org-ukb','org-lmu','org-ukt','org-ukm']); invalid → 400 |
| 8 | Audit middleware redacts generatedPassword for auth mutation paths | ✓ VERIFIED | auditMiddleware.ts line 48-57; REDACT_PATHS includes /api/auth/users; REDACT_FIELDS includes generatedPassword |
| 9 | Concurrent user-write operations serialized | ✓ VERIFIED | initAuth.ts lines 132-170; _writeLock + _writeQueue; acquireWriteLock/releaseWriteLock |
| 10 | GET/PUT /api/data/quality-flags with per-user isolation and server-derived flaggedBy | ✓ VERIFIED | dataApi.ts line 53; flagged_by: username (from JWT); client-supplied value ignored |
| 11 | GET/POST/DELETE /api/data/saved-searches with payload validation | ✓ VERIFIED | dataApi.ts lines 116-176; id, name, filters validated; filtersStr.length > 50000 → 400 |
| 12 | GET/PUT /api/data/excluded-cases and reviewed-cases | ✓ VERIFIED | dataApi.ts lines 182-230; MAX_ARRAY_SIZE=10000 cap enforced |
| 13 | All /api/data/* endpoints require authentication | ✓ VERIFIED | server/index.ts line 155: app.use('/api', authMiddleware) runs before line 169: dataApiRouter mount |
| 14 | express.json() for /api/data mounted BEFORE auditMiddleware | ✓ VERIFIED | index.ts lines 148 vs 152; /api/data json parser is at line 148, auditMiddleware at 152 |
| 15 | Quality flags use surrogate id (not composite PK) | ✓ VERIFIED | dataDb.ts line 43: id TEXT PRIMARY KEY; crypto.randomUUID() in setQualityFlags |
| 16 | All data tables include updated_at column | ✓ VERIFIED | dataDb.ts: quality_flags, saved_searches, excluded_cases, reviewed_cases all have updated_at |
| 17 | AdminPage creates users via POST /api/auth/users and shows generated password in modal | ⚠️ HOLLOW | AdminPage.tsx handleAdd() correctly calls POST /api/auth/users, BUT getAuthHeaders() sends fake Base64 token rejected by jwt.verify() → all calls return 401 |
| 18 | Login validates credentials server-side, returns signed JWT (USER-07, USER-08) | ✗ FAILED | AuthContext.login() (line 185) validates client-side using DEFAULT_CREDENTIALS; never calls POST /api/auth/login |
| 19 | Client stores server-signed JWT in sessionStorage and sends as Bearer token (USER-09, USER-10) | ✗ FAILED | getAuthHeaders() (authHeaders.ts line 13) sends btoa(JSON.stringify({username,role})) — not a JWT; jwt.verify() rejects it with 401 |
| 20 | DataContext loads data from server API with Promise.allSettled (DATA-06) | ⚠️ HOLLOW | DataContext.tsx fetchPersistedData uses Promise.allSettled and calls correct endpoints, BUT token is invalid — all fetches return 401, all results are rejected |
| 21 | useLocalStorageState.ts deleted, localStorage cleanup removed from logout | ✓ VERIFIED | useLocalStorageState.ts: file deleted (confirmed absent); AuthContext performLogout has comment "Data now server-side — no localStorage cleanup needed for data" (line 138) |

**Score:** 14/21 truths verified (truths 17 and 20 are wired but hollow; truths 18 and 19 are failed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/initAuth.ts` | saveUsers() with write serialization | ✓ VERIFIED | export async function saveUsers at line 161; acquireWriteLock/releaseWriteLock |
| `server/authApi.ts` | 5 user endpoints: me, list, create, delete, password | ✓ VERIFIED | All 5 routes present; admin guards; VALID_CENTERS; server-generated passwords |
| `server/auditMiddleware.ts` | REDACT_PATHS covers user CRUD paths | ✓ VERIFIED | Line 48-57; /api/auth/users in REDACT_PATHS; generatedPassword in REDACT_FIELDS |
| `server/dataDb.ts` | SQLite layer with 4 tables, surrogate id | ✓ VERIFIED | initDataDb exports; WAL mode; surrogate id on quality_flags; updated_at on all tables |
| `server/dataApi.ts` | 8-endpoint Express Router with server-derived audit fields | ✓ VERIFIED | dataApiRouter exported; MAX_ARRAY_SIZE=10000; flagged_by from JWT |
| `server/index.ts` | initDataDb + dataApiRouter mounted in correct order | ✓ VERIFIED | Lines 37-38 import; line 119 initDataDb; line 148 express.json before line 152 auditMiddleware; line 169 dataApiRouter after authMiddleware |
| `src/pages/AdminPage.tsx` | Server-wired user CRUD with password modal | ⚠️ HOLLOW | Code calls correct endpoints and handles generatedPassword modal, BUT token is invalid so all calls fail with 401 |
| `src/context/DataContext.tsx` | Server-backed persistence with Promise.allSettled | ⚠️ HOLLOW | fetchPersistedData uses Promise.allSettled with correct endpoints, BUT token rejected — all results settled as rejected |
| `src/context/AuthContext.tsx` | fetchCurrentUser via /users/me, fetchManagedUsers admin-only | ✓ VERIFIED | fetchCurrentUser calls /api/auth/users/me (line 109); fetchUsers calls /api/auth/users (line 121); hydration conditional on admin role (line 180) |
| `src/services/authHeaders.ts` | getAuthHeaders returns real JWT Bearer token | ✗ FAILED | Returns Base64-encoded JSON: btoa({username, role}) — not a JWT; jwt.verify() on server rejects it |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| server/authApi.ts | server/initAuth.ts | saveUsers() for atomic writes | ✓ WIRED | Line 14: import saveUsers from initAuth.js; called in POST/DELETE/PUT handlers |
| server/authApi.ts | server/authMiddleware.ts | req.auth for role/username | ✓ WIRED | All handlers check req.auth; req.auth.role !== 'admin' guard; req.auth.preferred_username |
| server/auditMiddleware.ts | server/authApi.ts | REDACT_PATHS covers password endpoints | ✓ WIRED | /api/auth/users in REDACT_PATHS; generatedPassword in REDACT_FIELDS |
| server/dataApi.ts | server/dataDb.ts | CRUD helper functions | ✓ WIRED | Line 15-26: all 8 helpers imported; each route calls the corresponding helper |
| server/index.ts | server/dataDb.ts | initDataDb() at startup | ✓ WIRED | Line 37: import; line 119: initDataDb(DATA_DIR) after initAuditDb |
| server/index.ts | server/dataApi.ts | app.use('/api/data', dataApiRouter) | ✓ WIRED | Line 38: import; line 169: app.use('/api/data', dataApiRouter) after authMiddleware |
| src/pages/AdminPage.tsx | /api/auth/users | fetch POST/DELETE with getAuthHeaders() | ✗ NOT_WIRED | Code present but getAuthHeaders() sends fake Base64 token; jwt.verify() returns 401 |
| src/context/AuthContext.tsx | /api/auth/users/me | fetchCurrentUser | ✓ WIRED | fetch calls /api/auth/users/me with getAuthHeaders(); BUT token is fake → will return 401 |
| src/context/DataContext.tsx | /api/data/* | fetch GET/PUT/POST/DELETE | ✗ NOT_WIRED | All fetches present; token invalid → 401 on every call |
| src/context/AuthContext.tsx | /api/auth/login | login() → POST /api/auth/login | ✗ NOT_WIRED | login() never calls server; DEFAULT_CREDENTIALS used for client-side validation |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| src/context/DataContext.tsx | qualityFlags, savedSearches, excludedCases, reviewedCases | fetchPersistedData → fetch /api/data/* | Server responds 401 (fake token) | ✗ HOLLOW — token rejected at auth boundary |
| src/pages/AdminPage.tsx | managedUsers | useAuth() → fetchUsers() → GET /api/auth/users | Server responds 401 (fake token) | ✗ HOLLOW — token rejected at auth boundary |
| server/dataApi.ts | quality flags from DB | setQualityFlags/getQualityFlags → dataDb | SQLite queries present; WAL mode | ✓ FLOWING (server side) |
| server/authApi.ts | user list from file | loadUsers() → data/users.json | File exists with bcrypt hashes | ✓ FLOWING (server side) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| USER-01 | 04-01 | GET /api/users/me returns current user info | ✓ SATISFIED | authApi.ts /users/me route; returns { username, role, centers } |
| USER-02 | 04-01 | GET /api/users lists managed users (admin only) | ✓ SATISFIED | authApi.ts /users route; role !== 'admin' → 403 |
| USER-03 | 04-01 | POST /api/users creates user with bcrypt password | ✓ SATISFIED | authApi.ts POST /users; bcrypt.hashSync(generatedPassword, 12) |
| USER-04 | 04-01 | DELETE /api/users/:username removes user | ✓ SATISFIED | authApi.ts DELETE /users/:username; admin only |
| USER-05 | 04-01 | users.json schema with bcrypt hashes, role, centers | ✓ SATISFIED | initAuth.ts UserRecord interface; data/users.json confirmed with passwordHash fields |
| USER-06 | 04-03 | AdminPage performs CRUD via /api/users | ✗ BLOCKED | AdminPage code calls server correctly, but login produces fake token; all calls → 401 |
| USER-07 | 04-01 | POST /api/auth/login validates server-side, returns JWT | ✗ BLOCKED | Server endpoint exists and is correct (authApi.ts lines 94-150), but client never calls it |
| USER-08 | 04-01 | Passwords never validated client-side | ✗ BLOCKED | AuthContext.login() compares passwords against DEFAULT_CREDENTIALS in browser |
| USER-09 | 04-01 | Session token is server-signed JWT (HS256) | ✗ BLOCKED | getAuthHeaders() sends btoa JSON, not a JWT; sessionStorage stores user object not JWT |
| USER-10 | 04-01 | Client stores JWT in sessionStorage, sends as Bearer | ✗ BLOCKED | sessionStorage stores user object; Bearer token is Base64 JSON not a JWT |
| USER-11 | 04-01 | PUT /api/users/:username/password for admin | ✓ SATISFIED | authApi.ts PUT /users/:username/password; server-generated; Cache-Control: no-store |
| USER-12 | 04-01 | users.json schema matches spec | ✓ SATISFIED | UserRecord interface in initAuth.ts matches { username, passwordHash, role, centers[], firstName?, lastName?, createdAt, lastLogin? } |
| DATA-01 | 04-02 | GET/PUT /api/data/quality-flags | ✓ SATISFIED | dataApi.ts lines 37-110; surrogate id; server-derived flaggedBy |
| DATA-02 | 04-02 | GET/POST/DELETE /api/data/saved-searches | ✓ SATISFIED | dataApi.ts lines 116-176; validation; 50KB filter cap |
| DATA-03 | 04-02 | GET/PUT /api/data/excluded-cases | ✓ SATISFIED | dataApi.ts lines 182-203 |
| DATA-04 | 04-02 | GET/PUT /api/data/reviewed-cases | ✓ SATISFIED | dataApi.ts lines 209-230 |
| DATA-05 | 04-02 | All data endpoints require authentication | ✓ SATISFIED | dataApiRouter mounted after authMiddleware (index.ts line 169 vs 155) |
| DATA-06 | 04-03 | DataContext fetches from server APIs | ✗ BLOCKED | DataContext calls correct endpoints with Promise.allSettled, but fake token → 401 on all calls |
| DATA-07 | 04-02 | API uses clear resource boundaries (future DB migration) | ✓ SATISFIED | Separate /api/data/* namespace; dataDb.ts abstraction layer; named SQL params |

**Note on USER-05 center codes:** users.json contains shorthand centers ('UKA', 'UKB') while VALID_CENTERS requires 'org-uka', 'org-ukb'. Existing users are unaffected, but adding centers for new users requires the org-prefixed form. This is a data inconsistency but does not block the API.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/context/AuthContext.tsx | 50-58 | DEFAULT_CREDENTIALS hardcoded in client bundle | 🛑 Blocker | Passwords exposed in browser; login never reaches server |
| src/services/authHeaders.ts | 13 | btoa(JSON.stringify({username,role})) sent as Bearer token | 🛑 Blocker | Server jwt.verify() rejects this — all authenticated API calls return 401 |
| src/context/AuthContext.tsx | 100, 221, 254, 263 | emd-managed-users still read/written to localStorage | ⚠️ Warning | Managed users state uses localStorage as primary store; fetchUsers() from server is secondary (only runs after auth context hydrates with fake token → 401) |
| src/context/AuthContext.tsx | 84-92 | DEFAULT_MANAGED_USERS hardcoded as initial state | ⚠️ Warning | Initial state bypasses server; managedUsers never empty even before fetchUsers runs |

### Human Verification Required

**None identified** — all gaps are programmatically verifiable.

### Gaps Summary

The phase delivered two solid backend layers (Plans 01 and 02) plus correct client wiring code (Plan 03). However, the migration from client-side to server-side authentication was not completed — specifically, `AuthContext.login()` was never updated to call `/api/auth/login`, and `getAuthHeaders()` was never updated to store and forward the real JWT from the server response.

**Root cause:** The existing `authHeaders.ts` was documented in the plan interface as `Returns { Authorization: 'Bearer <jwt>' }` — suggesting it was already correct. In reality, it constructs a Base64-encoded plain JSON object, not a JWT. The plan assumed this file was already wired to a real JWT and did not touch it. The login flow in `AuthContext.login()` was also left unchanged.

**Blast radius:** Because the token is invalid, every call to every server API endpoint returns 401. This means:
- USER-06 (AdminPage CRUD), DATA-06 (DataContext server data) are hollow — the code paths exist but they never succeed
- USER-07, USER-08, USER-09, USER-10 are directly failed at the source

**Fix scope:** Small but load-bearing. Two files need changes:
1. `src/context/AuthContext.tsx`: `login()` must call `POST /api/auth/login`, receive JWT, store it in sessionStorage under a key like `emd-token`
2. `src/services/authHeaders.ts`: Read the stored JWT token and return `Bearer <token>` directly

Once those two changes land, all the correctly-wired Plan 01/02/03 code will function as designed.

---

_Verified: 2026-04-10_
_Verifier: Claude (gsd-verifier)_
