# Requirements: EMD Backend Redesign

**Defined:** 2026-04-10
**Core Value:** Every user sees only authorized data, with tamper-proof audit trail

## v1 Requirements

### Production Backend

- [ ] **BACK-01**: Express server serves Vite production build (static files from dist/)
- [ ] **BACK-02**: Express server mounts all API routes (issues, settings, audit, users, data)
- [ ] **BACK-03**: FHIR proxy forwards /fhir/* to configured Blaze URL in production
- [ ] **BACK-04**: SPA fallback (all unmatched GET routes serve index.html)
- [ ] **BACK-05**: Server starts via `npm start` after `npm run build:all`
- [ ] **BACK-06**: Vite dev mode (`npm run dev`) continues working unchanged

### Server-Side Audit Log

- [ ] **AUDIT-01**: Audit entries written server-side only — backend logAudit() function inserts directly into SQLite (not exposed as a writable API endpoint)
- [ ] **AUDIT-02**: GET /api/audit returns entries with filtering (user, action, time range, limit/offset) via SQL queries — read-only
- [ ] **AUDIT-03**: GET /api/audit/export returns full log as downloadable JSON (admin only) — read-only
- [ ] **AUDIT-04**: Audit entries stored in SQLite database (data/audit.db) in an append-only audit_log table
- [ ] **AUDIT-05**: No POST, PUT, PATCH, or DELETE endpoints for audit — no API route can create, modify, or delete audit entries; all writes happen internally via server-side function calls
- [ ] **AUDIT-06**: AuditPage loads entries asynchronously from server (read-only display, search, filter)
- [ ] **AUDIT-07**: No audit manipulation from UI — no clear button, no edit, no delete; audit log is immutable from the client's perspective
- [ ] **AUDIT-08**: Rolling 3-month retention — server-side scheduled cleanup deletes entries older than 90 days on startup and daily via interval (only automated server process can delete)
- [ ] **AUDIT-09**: SQLite schema: audit_log(id TEXT PK, timestamp TEXT, user TEXT, action TEXT, detailKey TEXT, detailArgs TEXT, resource TEXT); indexed on timestamp, user, action
- [ ] **AUDIT-10**: Frontend logAudit() calls are replaced by server-side middleware/hooks — every API request that accesses or modifies data is audit-logged by the backend automatically, not by client-initiated POST

### Server-Side User Management & Authentication

- [ ] **USER-01**: GET /api/users/me returns current user info including role and centers
- [ ] **USER-02**: GET /api/users lists all managed users (admin only, passwords never returned)
- [ ] **USER-03**: POST /api/users creates a managed user with bcrypt-hashed password (admin only)
- [ ] **USER-04**: DELETE /api/users/:username removes a managed user (admin only)
- [ ] **USER-05**: Users stored in data/users.json with bcrypt password hashes, role, and centers; seeded with defaults on first start
- [ ] **USER-06**: AdminPage performs CRUD via /api/users instead of localStorage
- [ ] **USER-07**: POST /api/auth/login validates credentials server-side (bcrypt compare), returns signed session token
- [ ] **USER-08**: Passwords never sent to or stored in the client — login form POSTs to server, receives opaque token
- [ ] **USER-09**: Session token is a server-signed JWT (HS256 with server secret from settings.yaml) containing { username, role, centers }
- [ ] **USER-10**: Client stores session JWT in sessionStorage and sends as Bearer token on all API requests
- [ ] **USER-11**: PUT /api/users/:username/password allows admin to set a user's password (bcrypt hashed)
- [ ] **USER-12**: data/users.json schema: { username, passwordHash, role, centers[], firstName?, lastName?, createdAt, lastLogin? } — same user model whether auth.provider is local or keycloak
- [ ] **USER-13**: Server-side failed login limiting — lock account after N consecutive failures (configurable in settings.yaml), exponential backoff on retry; Pflichtenheft EMDREQ-USM-006 compliance

### Server-Side Data Persistence

- [ ] **DATA-01**: GET/PUT /api/data/quality-flags — quality flags storage
- [ ] **DATA-02**: GET/POST/DELETE /api/data/saved-searches — saved search definitions
- [ ] **DATA-03**: GET/PUT /api/data/excluded-cases — case exclusion list
- [ ] **DATA-04**: GET/PUT /api/data/reviewed-cases — reviewed case list
- [ ] **DATA-05**: All data endpoints require authentication
- [ ] **DATA-06**: DataContext fetches from server APIs instead of localStorage
- [ ] **DATA-07**: API design uses clear resource boundaries (ready for future DB migration)

### Center-Based Data Restriction (Server-Enforced)

- [ ] **CENTER-01**: User's assigned centers stored in JWT payload and in data/users.json
- [ ] **CENTER-02**: Server-side FHIR data endpoint filters cases by user's centers before sending to client — unauthorized center data never leaves the server
- [ ] **CENTER-03**: Server-side center permission check on all data API endpoints (/api/data/*) — reject requests for data outside user's centers with 403
- [ ] **CENTER-04**: Local FHIR bundle loading: server loads only bundles matching user's centers (per-center JSON files map directly to permissions)
- [ ] **CENTER-05**: Blaze FHIR proxy: server filters response resources by Patient.meta.source matching user's center IDs before forwarding to client
- [ ] **CENTER-06**: Admin users and users with all centers assigned bypass center filtering
- [ ] **CENTER-07**: Frontend DataContext receives pre-filtered data from server — client-side filtering is defense-in-depth only, not the primary control
- [ ] **CENTER-08**: CohortBuilder center filter only shows centers the user has permission for
- [ ] **CENTER-09**: Center permission is enforced at the API layer (authMiddleware extracts centers from JWT, passes to handlers) — no endpoint can return cross-center data without explicit permission

### Auth Middleware

- [ ] **AUTH-01**: Unified auth middleware validates JWT Bearer tokens on all /api/* routes
- [ ] **AUTH-02**: Local mode: JWT signed with HS256 server secret (issued by POST /api/auth/login)
- [ ] **AUTH-03**: Keycloak mode: JWT signed by Keycloak (validated via JWKS endpoint)
- [ ] **AUTH-04**: Auth middleware extracts { username, role, centers } from JWT payload for both modes
- [ ] **AUTH-05**: settings.yaml auth section configures provider (local/keycloak) and JWT secret for local mode
- [ ] **AUTH-06**: Shared getAuthHeaders() utility replaces duplicated implementations
- [ ] **AUTH-07**: Remove hardcoded DEFAULT_CREDENTIALS from client-side AuthContext.tsx — login form POSTs to /api/auth/login
- [ ] **AUTH-08**: Remove hardcoded KNOWN_USERS from server/utils.ts — replaced by data/users.json lookup
- [ ] **AUTH-09**: JWT token format is identical for local and Keycloak: { sub, preferred_username, role, centers, iat, exp } — frontend code doesn't care which provider issued it

### Keycloak Preparation

- [ ] **KC-01**: settings.yaml supports auth.provider and auth.keycloak config block
- [ ] **KC-02**: Server-side JWT validation with jwks-rsa library
- [ ] **KC-03**: Keycloak claim mapping documented (preferred_username, roles, centers)
- [ ] **KC-04**: LoginPage shows "Login with Keycloak" when configured (UI only, no redirect)
- [ ] **KC-05**: Documentation for Keycloak realm/client setup

## v2 Requirements

### Full Keycloak OIDC Flow

- **KC-V2-01**: Authorization code flow with PKCE
- **KC-V2-02**: Token refresh and session management
- **KC-V2-03**: docker-compose.yml with pre-configured Keycloak instance
- **KC-V2-04**: Automatic role mapping from Keycloak realm roles

### Database Migration

- **DB-01**: SQLite or PostgreSQL backend replacing JSON files
- **DB-02**: Migration scripts from JSON to database
- **DB-03**: Connection pooling and concurrent write handling

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full Keycloak OIDC redirect flow | Needs real Keycloak instance; prepare middleware only |
| Database storage | JSON files for v1; API designed for future swap |
| Sub-cohort comparison | Not in current codebase, separate feature work |
| Parameter-level exclusion | Only case-level exists; would need data model changes |
| Self-service password change/reset | Admin sets passwords; self-service deferred to Keycloak flow |
| HTTPS/TLS termination | Handled by reverse proxy (nginx) in production, not the app |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BACK-01..06 | Phase 1 | Pending |
| AUDIT-01..10 | Phase 2 | Pending |
| AUTH-01..09 | Phase 2 | Pending |
| USER-01..12 | Phase 3 | Pending |
| DATA-01..07 | Phase 3 | Pending |
| CENTER-01..09 | Phase 4 | Pending |
| KC-01..05 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 56 total
- Mapped to phases: 56
- Unmapped: 0

---
*Requirements defined: 2026-04-10*
*Last updated: 2026-04-10 after initial definition*
