# Phase 4: User Management & Data Persistence - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Server-side user CRUD via API (create, delete, password set/reset), server-side data storage replacing localStorage for quality flags, saved searches, excluded cases, and reviewed cases. AdminPage wired to server API. DataContext migrated from localStorage to server API calls. All data persisted per-user in SQLite.

</domain>

<decisions>
## Implementation Decisions

### User CRUD API Design
- **D-01:** Auto-generated password on user creation — server generates a random secure password, bcrypt-hashes it, stores the hash in users.json, and returns the plaintext password once in the POST response. Password is never retrievable again after that response.
- **D-02:** AdminPage shows a modal dialog after successful user creation with the generated password and a copy-to-clipboard button. Admin must explicitly dismiss the modal.
- **D-03:** Extend `authApi.ts` with user CRUD endpoints — POST /api/auth/users (create), DELETE /api/auth/users/:username (remove), PUT /api/auth/users/:username/password (admin password reset). All admin-only. GET /api/auth/users already exists.
- **D-04:** AdminPage waits for server confirmation before updating UI — POST to server, on success refresh user list from GET /api/auth/users. Loading indicator on the action button during request.
- **D-05:** AdminPage create form adds no password field — the server handles password generation entirely.

### Data Persistence Scope
- **D-06:** All four data resources (quality flags, saved searches, excluded cases, reviewed cases) stored per-user — each user has their own isolated data.
- **D-07:** Storage in SQLite using a new data/data.db file (separate from audit.db). better-sqlite3 already a dependency. Tables: quality_flags, saved_searches, excluded_cases, reviewed_cases — all keyed by username.
- **D-08:** Separate data.db from audit.db — different access patterns (mutable CRUD vs immutable append-only), different retention rules, clean separation of concerns.

### DataContext Migration
- **D-09:** DataContext fetches all 4 resources from server on mount (parallel requests). Shows loading state until all complete. FHIR data loads independently.
- **D-10:** Mutations use fire-and-sync pattern — POST/PUT/DELETE to server, on success update local state from the response. On failure show error toast, don't update local state. Consistent with AdminPage pattern (D-04).
- **D-11:** If server is unreachable on DataContext mount, show error state. Pages that need persisted data display error message with retry button. FHIR data still loads and displays independently.
- **D-12:** Remove useLocalStorageState.ts completely. Remove all localStorage references for quality flags, saved searches, excluded cases, reviewed cases. Remove the localStorage cleanup from AuthContext logout. Clean break, no fallback.

### Claude's Discretion
- SQLite schema design (column types, indexes, constraints)
- Data API endpoint naming and HTTP methods for each resource
- Error toast implementation (existing toast system or new)
- Random password generation strategy (length, character set)
- Whether to create a new dataApi.ts server file or extend existing files
- Migration of AdminPage component structure (form state, fetch hooks)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### User CRUD (files to modify/extend)
- `server/authApi.ts` — Existing auth router with GET /users; add POST/DELETE/PUT endpoints here (D-03)
- `server/initAuth.ts` — UserRecord type, loadUsers(), _atomicWrite() for users.json
- `src/pages/AdminPage.tsx` — Client-side user CRUD; rewire to server API calls
- `src/context/AuthContext.tsx` — addManagedUser/removeManagedUser (currently client-only, lines 312-318); fetchUsers() already calls GET /api/auth/users (line 106)

### Data persistence (files to modify/create)
- `src/context/DataContext.tsx` — Currently uses useLocalStorageState for 4 resources (lines 53-56); replace with server API fetch/mutation
- `src/hooks/useLocalStorageState.ts` — To be deleted entirely (D-12)
- `src/types/fhir.ts` — SavedSearch, QualityFlag type definitions used by DataContext
- `server/auditDb.ts` — Reference for SQLite patterns (better-sqlite3 usage, table creation, query helpers)

### Auth integration
- `server/authMiddleware.ts` — Extracts { username, role, centers } from JWT; data endpoints use username for per-user storage
- `src/services/authHeaders.ts` — Shared getAuthHeaders() for Bearer token on API calls

### Server infrastructure
- `server/index.ts` — Mount new data API routes; reference for middleware ordering
- `server/utils.ts` — readBody(), sendError() helpers

### Requirements
- `.planning/REQUIREMENTS.md` — USER-01..12, DATA-01..07

### Prior phase decisions
- `.planning/phases/01-production-express-backend/01-CONTEXT.md` — D-02 (settings.yaml config)
- `.planning/phases/02-server-side-auth-audit/02-CONTEXT.md` — D-06 (JWT payload), D-08 (auth middleware), D-16 (shared authHeaders)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/auditDb.ts` — SQLite patterns with better-sqlite3: database init, table creation, prepared statements, query helpers. Direct template for data.db setup.
- `server/initAuth.ts:_atomicWrite()` — Atomic file write pattern for users.json updates (create/delete user)
- `server/initAuth.ts:loadUsers()` — User file read pattern; extend for user CRUD write operations
- `src/services/authHeaders.ts:getAuthHeaders()` — Shared Bearer token header for all API calls from DataContext
- `server/authApi.ts:authApiRouter` — Existing router to extend with CRUD endpoints

### Established Patterns
- Express Router pattern from authApi.ts — add routes to existing router
- SQLite database init on startup (auditDb.ts) — same pattern for data.db
- Auth middleware attaches `req.auth` with username — use for per-user data scoping
- Fire-and-wait pattern: AdminPage already fetches user list after login (AuthContext.tsx line 234)

### Integration Points
- `server/index.ts` — Mount new data API routes (after auth middleware)
- `DataContext.tsx` — Replace useLocalStorageState with useState + useEffect fetch + mutation functions
- `AuthContext.tsx` — Remove localStorage cleanup from performLogout (line 126-131)
- `AdminPage.tsx` — Rewire handleAdd/handleDelete to POST/DELETE server calls

</code_context>

<specifics>
## Specific Ideas

- Auto-generated password shown in a modal with copy-to-clipboard — password is never stored or retrievable after the creation response
- Per-user data isolation means quality flags one researcher sets don't affect another researcher's view
- SQLite for data storage (not JSON files) — leverages existing better-sqlite3 dependency, better concurrent write handling
- Clean break from localStorage — no migration path, no fallback. Server is the single source of truth.
- FHIR data loading remains independent of persisted data loading — if data.db is unreachable, FHIR data still works

</specifics>

<deferred>
## Deferred Ideas

- Center-based data restriction (filtering FHIR data by user's centers) — Phase 5 scope
- API resource boundaries for future DB migration (DATA-07 partially addressed by SQLite choice, full DB migration is v2)
- Self-service password change by users — deferred to Keycloak (out of scope per PROJECT.md)

None beyond planned phases — discussion stayed within Phase 4 scope.

</deferred>

---

*Phase: 04-user-management-data-persistence*
*Context gathered: 2026-04-10*
