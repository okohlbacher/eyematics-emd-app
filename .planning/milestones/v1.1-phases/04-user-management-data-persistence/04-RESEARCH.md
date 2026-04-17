# Phase 4: User Management & Data Persistence - Research

**Researched:** 2026-04-10
**Domain:** Express Router extension, better-sqlite3, React Context migration from localStorage to server API
**Confidence:** HIGH (all findings from direct codebase inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Auto-generated password on user creation — server generates random secure password, bcrypt-hashes it, stores hash in users.json, returns plaintext once in POST response only.
- **D-02:** AdminPage shows modal after successful user creation with generated password and copy-to-clipboard. Admin must explicitly dismiss.
- **D-03:** Extend `authApi.ts` with user CRUD: POST /api/auth/users (create), DELETE /api/auth/users/:username (remove), PUT /api/auth/users/:username/password (admin reset). All admin-only. GET /api/auth/users already exists.
- **D-04:** AdminPage waits for server confirmation before updating UI — POST to server, on success refresh user list from GET /api/auth/users. Loading indicator on action button during request.
- **D-05:** AdminPage create form adds no password field — server handles password generation entirely.
- **D-06:** All four data resources stored per-user — each user has isolated data.
- **D-07:** Storage in SQLite using a new `data/data.db` file (separate from audit.db). better-sqlite3 already a dependency. Tables: quality_flags, saved_searches, excluded_cases, reviewed_cases — all keyed by username.
- **D-08:** Separate data.db from audit.db — different access patterns (mutable CRUD vs immutable append-only), different retention rules, clean separation of concerns.
- **D-09:** DataContext fetches all 4 resources from server on mount (parallel requests). Shows loading state until all complete. FHIR data loads independently.
- **D-10:** Mutations use fire-and-sync pattern — POST/PUT/DELETE to server, on success update local state from response. On failure show error toast, don't update local state.
- **D-11:** If server is unreachable on DataContext mount, show error state. Pages that need persisted data display error message with retry button. FHIR data still loads and displays independently.
- **D-12:** Remove useLocalStorageState.ts completely. Remove all localStorage references for quality flags, saved searches, excluded cases, reviewed cases. Remove the localStorage cleanup from AuthContext logout. Clean break, no fallback.

### Claude's Discretion

- SQLite schema design (column types, indexes, constraints)
- Data API endpoint naming and HTTP methods for each resource
- Error toast implementation (existing toast system or new)
- Random password generation strategy (length, character set)
- Whether to create a new dataApi.ts server file or extend existing files
- Migration of AdminPage component structure (form state, fetch hooks)

### Deferred Ideas (OUT OF SCOPE)

- Center-based data restriction (filtering FHIR data by user's centers) — Phase 5 scope
- API resource boundaries for future DB migration (DATA-07 partially addressed by SQLite choice, full DB migration is v2)
- Self-service password change by users — deferred to Keycloak (out of scope per PROJECT.md)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| USER-01 | GET /api/users/me returns current user info including role and centers | req.auth (username, role, centers) already on every request via authMiddleware — trivial read |
| USER-02 | GET /api/users lists managed users (admin only, passwords never returned) | GET /api/auth/users already exists in authApi.ts (line 211); needs admin-only guard added |
| USER-03 | POST /api/users creates managed user with bcrypt-hashed password (admin only) | Extend authApiRouter; loadUsers() + _atomicWrite() are the write primitives |
| USER-04 | DELETE /api/users/:username removes managed user (admin only) | Same router, same write primitives |
| USER-05 | Users stored in data/users.json with bcrypt hashes, role, centers; seeded on first start | Already done in index.ts; UserRecord type in initAuth.ts covers the required schema |
| USER-06 | AdminPage performs CRUD via /api/users instead of localStorage | handleAdd/handleDelete rewire to fetch; addManagedUser/removeManagedUser in AuthContext become dead code after server confirmation path is wired |
| USER-07 | POST /api/auth/login validates credentials server-side | Already implemented in authApi.ts — verified complete |
| USER-08 | Passwords never sent to or stored in client | Already implemented — verified complete |
| USER-09 | Session token is server-signed JWT (HS256) with { username, role, centers } | Already implemented — verified complete |
| USER-10 | Client stores JWT in sessionStorage, sends as Bearer token | Already implemented via authHeaders.ts — verified complete |
| USER-11 | PUT /api/users/:username/password allows admin to set password | New endpoint on authApiRouter; bcrypt.hashSync + _atomicWrite |
| USER-12 | data/users.json schema: { username, passwordHash, role, centers[], firstName?, lastName?, createdAt, lastLogin? } | UserRecord interface in initAuth.ts already matches this exactly |
| USER-13 | Server-side failed login limiting (Phase 3 formal verification) | Implemented in rateLimiting.ts + authApi.ts — Phase 3 scope, not new work here |
| DATA-01 | GET/PUT /api/data/quality-flags | New dataApi.ts router; better-sqlite3 quality_flags table keyed by username |
| DATA-02 | GET/POST/DELETE /api/data/saved-searches | Same router; saved_searches table; POST creates, DELETE removes by id |
| DATA-03 | GET/PUT /api/data/excluded-cases | Same router; excluded_cases table; PUT replaces full list for user |
| DATA-04 | GET/PUT /api/data/reviewed-cases | Same router; reviewed_cases table; PUT replaces full list for user |
| DATA-05 | All data endpoints require authentication | authMiddleware already applied globally to /api/* in index.ts |
| DATA-06 | DataContext fetches from server APIs instead of localStorage | Replace useLocalStorageState(×4) with useState + parallel fetch + mutation functions |
| DATA-07 | API design uses clear resource boundaries (ready for future DB migration) | Dedicated dataApi.ts + dataDb.ts separation mirrors auditApi.ts + auditDb.ts pattern |
</phase_requirements>

---

## Summary

Phase 4 extends two existing patterns rather than introducing new technology. The user CRUD work is an additive extension to `server/authApi.ts` — three new routes, plus exposing `_atomicWrite` (currently private) as a module-level write helper in `initAuth.ts`. The data persistence work mirrors the existing `auditDb.ts + auditApi.ts` layer: create `dataDb.ts` (better-sqlite3 with 4 tables) and `dataApi.ts` (Express router with 8 endpoints), then replace the four `useLocalStorageState` calls in `DataContext.tsx` with server fetch + mutation.

The client-side work has two parts: (1) AdminPage rewired to use server calls with a password-display modal, and (2) DataContext migrated from localStorage to server API with parallel-fetch loading state and fire-and-sync mutations.

No new library dependencies are required. All needed tools (bcryptjs, better-sqlite3, Node `crypto`, Express Router) are already installed.

**Primary recommendation:** Model `dataDb.ts` directly on `auditDb.ts`, model `dataApi.ts` on `auditApi.ts`, and keep `_atomicWrite` / `loadUsers` as the sole write path for users.json.

---

## Standard Stack

### Core (all already installed — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | ^12.8.0 | SQLite for data.db | Already used for audit.db; synchronous API matches Express handler style |
| bcryptjs | ^3.0.3 | Password hashing for new users | Already used in authApi.ts and initAuth.ts |
| Node `crypto` | built-in | Secure random password generation | `crypto.randomBytes()` already used for JWT secret generation in initAuth.ts |
| express Router | ^5.2.1 | data API routes | Used by authApiRouter and auditApiRouter |

[VERIFIED: package.json + direct codebase inspection]

**Installation:** None — all dependencies already present.

---

## Architecture Patterns

### Recommended New Files

```
server/
├── dataDb.ts          # New: SQLite data.db layer (quality_flags, saved_searches, excluded_cases, reviewed_cases)
├── dataApi.ts         # New: Express router for /api/data/* endpoints
│
│   (existing files to modify)
├── initAuth.ts        # Export _atomicWrite + add saveUsers() write helper
├── authApi.ts         # Add POST/DELETE/PUT user CRUD routes
└── index.ts           # Mount dataApiRouter, add express.json() for /api/data

src/context/
├── DataContext.tsx     # Replace useLocalStorageState(×4) with server fetch + mutations
│
src/pages/
└── AdminPage.tsx       # Rewire handleAdd/handleDelete; add password modal

src/hooks/
└── useLocalStorageState.ts  # DELETE entirely (D-12)
```

### Pattern 1: SQLite module initialization (follow auditDb.ts)

```typescript
// Source: server/auditDb.ts (verified codebase)
let db: Database.Database | null = null;

export function initDataDb(dataDir: string): void {
  const dbPath = path.join(dataDir, 'data.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS quality_flags (
      id          TEXT PRIMARY KEY,
      username    TEXT NOT NULL,
      case_id     TEXT NOT NULL,
      parameter   TEXT NOT NULL,
      error_type  TEXT NOT NULL,
      flagged_at  TEXT NOT NULL,
      flagged_by  TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'open'
    );
    CREATE INDEX IF NOT EXISTS idx_qf_username ON quality_flags(username);

    CREATE TABLE IF NOT EXISTS saved_searches (
      id          TEXT PRIMARY KEY,
      username    TEXT NOT NULL,
      name        TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      filters     TEXT NOT NULL   -- JSON blob
    );
    CREATE INDEX IF NOT EXISTS idx_ss_username ON saved_searches(username);

    CREATE TABLE IF NOT EXISTS excluded_cases (
      username    TEXT NOT NULL,
      case_id     TEXT NOT NULL,
      PRIMARY KEY (username, case_id)
    );

    CREATE TABLE IF NOT EXISTS reviewed_cases (
      username    TEXT NOT NULL,
      case_id     TEXT NOT NULL,
      PRIMARY KEY (username, case_id)
    );
  `);
}
```

[VERIFIED: derived from auditDb.ts pattern + type definitions in fhir.ts]

### Pattern 2: User CRUD write helper (extending initAuth.ts)

The `_atomicWrite` function is currently module-private. It needs to become an exported helper, or a new exported `saveUsers(users: UserRecord[]): void` function should wrap it. The second approach keeps the write primitive encapsulated.

```typescript
// Source: server/initAuth.ts (verified codebase) — extend with:
export function saveUsers(users: UserRecord[]): void {
  if (_usersFile === null) {
    throw new Error('[initAuth] saveUsers() called before initAuth()');
  }
  const tmp = `${_usersFile}.tmp.${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(users, null, 2), 'utf-8');
  fs.renameSync(tmp, _usersFile);
}
```

[VERIFIED: _atomicWrite pattern in initAuth.ts lines 130-134]

### Pattern 3: Admin-only route guard

The existing GET /api/auth/users at line 211 checks `req.auth` for authentication but does NOT enforce admin role. All three new CRUD endpoints (and the existing GET /users) need an admin-role check:

```typescript
// Source: server/authApi.ts (verified codebase)
if (!req.auth || req.auth.role !== 'admin') {
  res.status(403).json({ error: 'Admin access required' });
  return;
}
```

[VERIFIED: req.auth.role is set by authMiddleware from JWT payload — authMiddleware.ts line 67]

### Pattern 4: Password generation

Node `crypto` is already used for JWT secret generation in initAuth.ts. The same module handles password generation:

```typescript
// Source: server/initAuth.ts line 63 pattern (verified)
import crypto from 'node:crypto';

function generatePassword(length = 16): string {
  // Use base64url alphabet for readability; trim to desired length
  return crypto.randomBytes(Math.ceil(length * 0.75))
    .toString('base64url')
    .slice(0, length);
}
```

A 16-character base64url password provides ~96 bits of entropy. [VERIFIED: crypto.randomBytes is used in initAuth.ts line 63]

### Pattern 5: DataContext parallel fetch with independent FHIR loading

The current DataContext uses a single `fetchData()` that loads FHIR bundles. Per D-09, persisted data loads must be parallel and independent from FHIR. The migration separates them into two effects:

```typescript
// FHIR data — unchanged, still uses loadAllBundles()
useEffect(() => { fetchFhirData(); }, [fetchFhirData]);

// Persisted data — new: parallel fetch all 4 resources
useEffect(() => {
  if (!user) return;  // don't fetch if not authenticated
  setDataLoading(true);
  Promise.all([
    fetch('/api/data/quality-flags', { headers: getAuthHeaders() }).then(r => r.json()),
    fetch('/api/data/saved-searches', { headers: getAuthHeaders() }).then(r => r.json()),
    fetch('/api/data/excluded-cases', { headers: getAuthHeaders() }).then(r => r.json()),
    fetch('/api/data/reviewed-cases', { headers: getAuthHeaders() }).then(r => r.json()),
  ])
    .then(([flags, searches, excluded, reviewed]) => {
      setQualityFlags(flags.qualityFlags ?? []);
      setSavedSearches(searches.savedSearches ?? []);
      setExcludedCases(excluded.excludedCases ?? []);
      setReviewedCases(reviewed.reviewedCases ?? []);
      setDataLoading(false);
    })
    .catch((err) => {
      setDataError(err.message);
      setDataLoading(false);
    });
}, [user]);  // re-fetch when user changes (login/logout)
```

[VERIFIED: DataContext.tsx lines 53-56 show the four useLocalStorageState calls being replaced; getAuthHeaders from authHeaders.ts]

### Pattern 6: Fire-and-sync mutation (D-10)

```typescript
const addQualityFlag = useCallback(async (f: QualityFlag) => {
  const resp = await fetch('/api/data/quality-flags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(f),
  });
  if (!resp.ok) {
    showErrorToast('Failed to save quality flag');
    return;
  }
  const data = await resp.json() as { qualityFlag: QualityFlag };
  setQualityFlags(prev => [...prev, data.qualityFlag]);
}, []);
```

[VERIFIED: derived from D-10 pattern + AdminPage's existing fire-and-wait approach]

### Pattern 7: Modal for generated password (D-02)

FeedbackButton.tsx and QualityPage.tsx both use the same Tailwind overlay pattern:

```tsx
// Source: QualityPage.tsx line 739 (verified)
{showPasswordModal && (
  <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
      <p className="font-mono text-lg text-center select-all">{generatedPassword}</p>
      <button onClick={() => navigator.clipboard.writeText(generatedPassword)}>Copy</button>
      <button onClick={() => setShowPasswordModal(false)}>Dismiss</button>
    </div>
  </div>
)}
```

No modal library needed — use the existing project pattern. [VERIFIED: QualityPage.tsx line 739, FeedbackButton.tsx lines 34-60]

### Pattern 8: express.json() scope

Currently `app.use('/api/auth', express.json({ limit: '1mb' }))` is scoped to auth routes only. New data endpoints need their own scope:

```typescript
// Source: server/index.ts line 144 (verified)
app.use('/api/data', express.json({ limit: '1mb' }));
```

This is required before mounting the dataApiRouter. [VERIFIED: index.ts line 144]

### Anti-Patterns to Avoid

- **Do NOT add express.json() globally** — issueApiHandler and settingsApiHandler use `readBody()` on the raw stream (server/utils.ts line 18). A global express.json() would consume the stream first and break them.
- **Do NOT use `fs.writeFileSync` directly in authApi.ts** — route handlers must use `saveUsers()` from initAuth.ts to maintain the atomic-write guarantee.
- **Do NOT store generated passwords anywhere** — the plaintext password is computed, returned in the POST response, and immediately discarded. Never log it.
- **Do NOT make data endpoints depend on data loading status for FHIR** — D-11 specifies FHIR must remain functional when data.db is unreachable.
- **Do NOT call `initDataDb()` lazily** — it must be called at server startup in index.ts alongside `initAuditDb()`, so the db handle is ready before any request arrives.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file writes | Custom temp-file logic | `saveUsers()` wrapping `_atomicWrite()` in initAuth.ts | Already proven pattern; prevents corrupt users.json on crash |
| Password hashing | Any custom hash | `bcrypt.hashSync(password, 12)` (bcryptjs) | Already used throughout; consistent rounds |
| SQLite WAL | Custom locking | `db.pragma('journal_mode = WAL')` | Better-sqlite3 pattern from auditDb.ts; prevents read/write contention |
| Secure random | Math.random or Date.now | `crypto.randomBytes()` | Cryptographically secure; already used in initAuth.ts |
| Auth check | Re-implement JWT decode in routes | `req.auth` from authMiddleware | authMiddleware already runs before all /api/* routes |
| Modal UI | Custom dialog library | Tailwind `fixed inset-0` overlay | Already established in FeedbackButton.tsx and QualityPage.tsx |

---

## Common Pitfalls

### Pitfall 1: GET /api/auth/users is missing admin-role guard

**What goes wrong:** Current GET /api/auth/users (authApi.ts line 211) only checks `req.auth` exists — any authenticated user can list all users.
**Why it happens:** The route was added before role enforcement was decided.
**How to avoid:** Add `req.auth.role !== 'admin'` check to GET /api/auth/users when adding CRUD endpoints in the same pass. USER-02 requires admin-only.
**Warning signs:** A researcher-role user can fetch the full user list.

### Pitfall 2: DataContext fetching before user is authenticated

**What goes wrong:** DataContext mounts at app startup; if the user is not yet logged in, the server returns 401 for all four data fetches, resulting in error state shown to unauthenticated users.
**Why it happens:** DataContext wraps the whole app including the login page.
**How to avoid:** Gate the persisted-data fetch on `user !== null`. The `user` state from AuthContext is restored from sessionStorage on mount (AuthContext.tsx line 98), so it is truthy immediately for already-authenticated sessions.
**Warning signs:** "Server unreachable" error on the login page.

### Pitfall 3: Loading state mismatch between FHIR and persisted data

**What goes wrong:** If FHIR finishes before persisted data, the `loading` flag clears early and components render with empty quality flags / saved searches.
**Why it happens:** Current `loading` state only tracks FHIR (DataContext.tsx line 49).
**How to avoid:** Use two separate loading flags — `fhirLoading` and `dataLoading` — or a combined derived state. Context value's `loading` should be `fhirLoading || dataLoading` for components that need both, or separated for components that need only one.
**Warning signs:** Quality flags flicker to empty then populate.

### Pitfall 4: express.json() not mounted before dataApiRouter

**What goes wrong:** `req.body` is `undefined` in POST/PUT data endpoints.
**Why it happens:** express.json() is scoped per-path in this codebase (to avoid breaking raw-body handlers). Easy to mount the router and forget the body parser.
**How to avoid:** Add `app.use('/api/data', express.json({ limit: '1mb' }))` immediately before `app.use('/api/data', dataApiRouter)` in index.ts.

### Pitfall 5: localStorage removal leaves stale keys in existing sessions

**What goes wrong:** Existing browser sessions still have `emd-saved-searches` etc. in localStorage. After the migration, the server is the source of truth but old data persists in localStorage silently.
**Why it happens:** D-12 is a clean break — no migration.
**How to avoid:** In `performLogout()` in AuthContext.tsx, the four `localStorage.removeItem()` calls (lines 125-128) already exist and handle this. Optionally, a one-time cleanup on DataContext mount (before the first server fetch) can also remove them. The decision is clean break per D-12, so no migration is needed — stale localStorage data is just ignored and will be cleared on next logout.

### Pitfall 6: Username self-delete not guarded server-side

**What goes wrong:** Admin deletes themselves, losing admin access.
**Why it happens:** AdminPage has a client-side guard (`mu.username === user.username`), but the server DELETE endpoint has no such check.
**How to avoid:** In the DELETE /api/auth/users/:username handler, check `req.auth.username === req.params.username` and return 409 Conflict if true.

### Pitfall 7: `useLocalStorageState` consumers other than DataContext

**What goes wrong:** If another file imports `useLocalStorageState.ts`, deleting the file breaks compilation.
**Why it happens:** The hook was a shared utility.
**How to avoid:** Grep for all imports before deleting.
**Warning signs:** TypeScript compile error on `npm run build`.

---

## Code Examples

### User CRUD endpoint structure (authApi.ts extension)

```typescript
// Source: authApi.ts pattern (verified), new endpoints follow same structure

// POST /api/auth/users — create user with auto-generated password
authApiRouter.post('/users', (req: Request, res: Response): void => {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  const { username, role, centers, firstName, lastName } = req.body as Record<string, unknown>;
  // validate, generate password, hash, save, return { user, generatedPassword }
});

// DELETE /api/auth/users/:username
authApiRouter.delete('/users/:username', (req: Request, res: Response): void => {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  if (req.auth.username === req.params.username) {
    res.status(409).json({ error: 'Cannot delete your own account' });
    return;
  }
  // load, filter, save
});

// PUT /api/auth/users/:username/password
authApiRouter.put('/users/:username/password', (req: Request, res: Response): void => {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  const { password } = req.body as { password?: string };
  // validate, hash, save
});
```

### Data endpoint structure (new dataApi.ts)

```typescript
// GET returns user's data, PUT/POST/DELETE mutates it
// All routes are already protected by authMiddleware (mounted globally on /api/*)

dataApiRouter.get('/quality-flags', (req: Request, res: Response): void => {
  const username = req.auth!.username;
  const flags = getQualityFlags(username);       // dataDb.ts function
  res.json({ qualityFlags: flags });
});

dataApiRouter.put('/quality-flags', (req: Request, res: Response): void => {
  const username = req.auth!.username;
  const { qualityFlags } = req.body as { qualityFlags?: unknown[] };
  // validate shape, upsert, return saved flags
});
```

### DataContext mutation with error handling (D-10)

```typescript
const toggleExcludeCase = useCallback(async (caseId: string) => {
  const next = excludedCases.includes(caseId)
    ? excludedCases.filter((id) => id !== caseId)
    : [...excludedCases, caseId];

  const resp = await fetch('/api/data/excluded-cases', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ excludedCases: next }),
  });
  if (!resp.ok) {
    // D-10: show error toast, do NOT update local state
    showErrorToast('Failed to save');
    return;
  }
  const data = await resp.json() as { excludedCases: string[] };
  setExcludedCases(data.excludedCases);
}, [excludedCases]);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| localStorage for saved searches, flags, exclusions, reviewed | Per-user SQLite (this phase) | Phase 4 | Data persists across browsers/devices per user |
| Client-side user creation (AuthContext addManagedUser) | Server-side POST /api/auth/users | Phase 4 | Passwords never generated client-side |
| _atomicWrite private to initAuth.ts | Exported saveUsers() | Phase 4 | Enables authApi.ts to write users.json safely |

**Deprecated/outdated after this phase:**
- `useLocalStorageState.ts` hook: deleted entirely (D-12)
- `addManagedUser()` and `removeManagedUser()` in AuthContext: become UI-only state refresh helpers after server confirmation (or can be removed in favour of calling `fetchUsers()`)
- localStorage cleanup in `performLogout()` (AuthContext.tsx lines 125-128): remove the four `localStorage.removeItem()` calls for the four data keys

---

## Existing Code: What Needs Changing vs What Already Works

### Already done (no changes needed)

| File | Already correct |
|------|----------------|
| `server/authMiddleware.ts` | Attaches `req.auth` with `{ username, role, centers }` — data endpoints use this directly |
| `server/auditDb.ts` | Template for `dataDb.ts` — copy structure verbatim |
| `src/services/authHeaders.ts` | `getAuthHeaders()` used by all client API calls — no changes |
| `server/utils.ts` | `sendError()` helper used by data/auth routes — no changes |
| `server/initAuth.ts` | UserRecord type, `loadUsers()` — just need `saveUsers()` exported |
| USER-07, USER-08, USER-09, USER-10 | Login + JWT + sessionStorage already implemented in Phase 2 |

### Changes required

| File | Change |
|------|--------|
| `server/initAuth.ts` | Export `saveUsers(users: UserRecord[]): void` using `_atomicWrite` pattern |
| `server/authApi.ts` | Add admin-role guard to existing GET /users; add POST /users, DELETE /users/:username, PUT /users/:username/password |
| `server/index.ts` | Add `initDataDb(DATA_DIR)` call; add `app.use('/api/data', express.json(...))` and `app.use('/api/data', dataApiRouter)` |
| `src/context/DataContext.tsx` | Replace 4× `useLocalStorageState` with `useState` + parallel `useEffect` fetch + async mutation functions |
| `src/context/AuthContext.tsx` | Remove 4× `localStorage.removeItem()` from `performLogout()` (lines 125-128) |
| `src/pages/AdminPage.tsx` | Rewire `handleAdd` (POST + modal) and `handleDelete` (DELETE + confirm); remove direct `addManagedUser`/`removeManagedUser` calls in favour of `fetchUsers()` |
| `src/hooks/useLocalStorageState.ts` | Delete file after verifying no other consumers |

### New files to create

| File | Purpose |
|------|---------|
| `server/dataDb.ts` | better-sqlite3 layer for data.db (4 tables, CRUD helpers) |
| `server/dataApi.ts` | Express Router: 8 endpoints across 4 resources |

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — all required tools are already installed and verified in package.json)

---

## Validation Architecture

Skipped — `workflow.nyquist_validation` is `false` in `.planning/config.json`.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | bcryptjs (already used); admin-role guard on CRUD endpoints |
| V3 Session Management | no — existing JWT pattern unchanged | — |
| V4 Access Control | yes | `req.auth.role !== 'admin'` check on all user CRUD endpoints |
| V5 Input Validation | yes | Validate username format, role enum, centers array in POST /users |
| V6 Cryptography | yes | `crypto.randomBytes()` for password generation; bcrypt with 12 rounds for hashing |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Horizontal data access (user reads another user's flags) | Information disclosure | Per-user query: `WHERE username = req.auth.username` in all data queries |
| Admin deletes own account | Elevation of privilege | Server-side self-delete guard in DELETE handler |
| Plaintext password exposure in logs | Information disclosure | Never log generated password; return in POST response body only |
| Username enumeration via 404 vs 403 | Information disclosure | DELETE non-existent user: return 404 only if admin (already authed); otherwise 403 first |
| SQLite injection via username | Tampering | Use named parameters in better-sqlite3 prepared statements (same as auditDb.ts pattern) |
| Stale admin-granted password displayed in browser history | Information disclosure | Modal dismissal required (D-02); password not stored anywhere after single display |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | No other files import `useLocalStorageState.ts` beyond `DataContext.tsx` | Common Pitfalls | Compile error if another consumer exists — verify with grep before deleting |
| A2 | `addManagedUser` / `removeManagedUser` in AuthContext are only called from AdminPage | Existing Code section | If called elsewhere, those call sites need updating |
| A3 | The `excluded_cases` and `reviewed_cases` resources are full-list replacements (PUT replaces entire list) rather than item-level PATCH | Architecture Patterns | If the lists grow very large, PUT-full-list becomes expensive — acceptable for v1 |

---

## Open Questions

1. **Error toast implementation**
   - What we know: No toast system exists in the codebase currently; FeedbackButton.tsx has a success state but no reusable toast.
   - What's unclear: Whether to implement a minimal inline toast component or a shared ToastContext.
   - Recommendation (Claude's discretion): Implement a minimal local inline error banner within DataContext consumers rather than a full toast system — a simple `{ dataError: string | null }` in context state surfaces errors to pages, which can render a dismissible banner. This avoids over-engineering for three possible error paths.

2. **USER-01 endpoint path discrepancy**
   - What we know: REQUIREMENTS.md says GET /api/users/me, but the existing auth routes all live under /api/auth/. The decision D-03 puts CRUD under /api/auth/users.
   - What's unclear: Whether /api/users/me goes under /api/auth/users/me or a separate /api/users/me path.
   - Recommendation: Mount it as GET /api/auth/users/me to stay consistent with the existing /api/auth/users (GET all) route. This keeps all user-related endpoints in one router.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `server/authApi.ts` — existing router structure, GET /users endpoint, admin check gap
- `server/initAuth.ts` — UserRecord type, loadUsers(), _atomicWrite() pattern
- `server/auditDb.ts` — SQLite initialization pattern, WAL mode, prepared statements
- `server/authMiddleware.ts` — req.auth shape (username, role, centers)
- `server/index.ts` — middleware mounting order, express.json() scoping
- `src/context/DataContext.tsx` — four useLocalStorageState calls (lines 53-56)
- `src/context/AuthContext.tsx` — addManagedUser/removeManagedUser, performLogout localStorage cleanup (lines 125-128)
- `src/pages/AdminPage.tsx` — handleAdd/handleDelete (lines 135-158), modal pattern needed
- `src/components/FeedbackButton.tsx` and `src/pages/QualityPage.tsx` — established modal overlay pattern
- `src/services/authHeaders.ts` — getAuthHeaders() for client API calls
- `src/hooks/useLocalStorageState.ts` — hook being deleted
- `src/types/fhir.ts` — SavedSearch, QualityFlag type definitions for SQLite schema
- `package.json` — confirmed dependencies: better-sqlite3 ^12.8.0, bcryptjs ^3.0.3
- `.planning/config.json` — nyquist_validation: false (skip test section)

### Secondary (MEDIUM confidence)
- REQUIREMENTS.md USER-01..12, DATA-01..07 definitions
- CONTEXT.md D-01..D-12 locked decisions

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json
- Architecture: HIGH — directly derived from existing working patterns in the same codebase
- Pitfalls: HIGH — identified from direct code reading, not speculation
- Security: HIGH — derived from existing patterns + ASVS categories applicable to the tech stack

**Research date:** 2026-04-10
**Valid until:** Indefinite (research is of this codebase — findings don't expire unless code changes)
