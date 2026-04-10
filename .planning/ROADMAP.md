# Roadmap: EMD Backend Redesign

**Created:** 2026-04-10
**Milestone:** v1.0 — Production Backend

## Phase Overview

| Phase | Name | Requirements | Status |
|-------|------|-------------|--------|
| 1 | Production Express Backend | BACK-01..06 | Planned |
| 2 | Server-Side Auth + Audit | AUDIT-01..10, AUTH-01..09 | Planned |
| 3 | Server-Side Users + Data Persistence | USER-01..12, DATA-01..07 | Pending |
| 4 | Center-Based Data Restriction (Server-Enforced) | CENTER-01..09 | Pending |
| 5 | Keycloak Preparation | KC-01..05 | Pending |

## Phase Details

### Phase 1: Production Express Backend
**Goal:** Standalone Express server that serves the built app and all existing APIs

**Plans:** 2 plans

Plans:
- [x] 01-01-PLAN.md — Extract handler functions from Vite plugins + build infrastructure
- [ ] 01-02-PLAN.md — Express server entry point with full production wiring

**Scope:**
- Extract route handlers from Vite plugins into reusable functions (raw Node http types)
- Create Express server entry point (server/index.ts)
- FHIR proxy via http-proxy-middleware
- Static file serving + SPA fallback
- Build scripts (tsconfig.server.json, npm scripts)
- Verify `npm run dev` still works unchanged

**Success criteria:**
- `npm run build:all && npm start` serves the app on port 3000
- All existing API routes (/api/issues, /api/settings) work in production mode
- /fhir/* proxies to configured Blaze URL
- `npm run dev` behavior is identical to before

**Depends on:** Nothing (foundation phase)

---

### Phase 2: Server-Side Auth + Audit
**Goal:** Server-side login with hashed passwords, JWT session tokens, tamper-proof audit log

**Plans:** 4 plans

Plans:
- [ ] 02-01-PLAN.md — Auth middleware + auth API (login, verify, config endpoints)
- [ ] 02-02-PLAN.md — Audit SQLite database + audit middleware + read-only audit API
- [ ] 02-03-PLAN.md — Wire server middleware, create shared authHeaders, rewire LoginPage + AuthContext
- [ ] 02-04-PLAN.md — Frontend audit cleanup (remove logAudit calls) + async AuditPage rework

**Scope:**
- Create POST /api/auth/login endpoint (bcrypt password validation, issues HS256 JWT with { username, role, centers })
- Create server/authMiddleware.ts (validates JWT on all /api/* routes, extracts user context)
- Add JWT secret to settings.yaml auth section
- Create server/auditApi.ts with SQLite storage in data/audit.db (better-sqlite3) — read-only API (GET only), no write/delete endpoints
- Audit writes happen server-side only: backend middleware auto-logs every data access and mutation — client never writes audit entries
- 90-day rolling retention with auto-purge on startup and daily interval
- Create src/services/authHeaders.ts (shared, deduplicated — stores/sends JWT)
- Migrate frontend auditService.ts to read-only (remove logAudit calls, replace with server-side middleware)
- Update LoginPage.tsx to POST credentials to /api/auth/login (no more client-side validation)
- Update AuthContext.tsx: remove DEFAULT_CREDENTIALS, remove client-side password checking
- Update AuditPage.tsx for async loading, remove clear button
- Remove KNOWN_USERS from server/utils.ts (replaced by data/users.json lookup)

**Success criteria:**
- Login form POSTs to /api/auth/login, receives JWT, stores in sessionStorage
- Passwords never appear in client-side bundle
- All /api/* routes validate JWT via authMiddleware
- JWT payload contains { sub, preferred_username, role, centers }
- logAudit() calls POST /api/audit; entries stored in data/audit.db SQLite database
- AuditPage loads entries from server asynchronously; no clear/delete button
- Entries older than 90 days auto-purged on startup and daily
- getAuthHeaders() is a single shared utility sending JWT Bearer token

**Depends on:** Phase 1 (Express server for production routes)

---

### Phase 3: Server-Side Users + Data Persistence
**Goal:** All persistent application state lives on the server, with secure user management

**Scope:**
- Create server/userApi.ts with data/users.json storage (bcrypt password hashes, role, centers per user)
- GET/POST/DELETE /api/users (admin only, passwords never returned in responses)
- PUT /api/users/:username/password (admin sets password, bcrypt hashed)
- Seed data/users.json with default users + bcrypt-hashed default passwords on first start
- Create server/dataApi.ts for quality flags, saved searches, excluded/reviewed cases
- Migrate AuthContext.tsx user management from localStorage to /api/users
- Migrate DataContext.tsx from useLocalStorageState to server API calls
- Update AdminPage.tsx to use /api/users (create with initial password, delete, assign role + centers)

**Success criteria:**
- data/users.json contains { username, passwordHash, role, centers[], firstName?, lastName?, createdAt }
- AdminPage creates/deletes users via API; passwords are bcrypt hashed server-side
- GET /api/users never returns passwordHash field
- Saved searches, quality flags, excluded/reviewed cases persist on server
- No localStorage usage except emd-locale (language preference)
- Data survives browser clear and logout

**Depends on:** Phase 2 (auth middleware + login endpoint)

---

### Phase 4: Center-Based Data Restriction (Server-Enforced)
**Goal:** Server enforces center permissions — unauthorized center data never reaches the client

**Scope:**
- Server-side FHIR data endpoint that loads and filters bundles/resources by user's centers before responding
- Local mode: server loads only center JSON files matching user's permissions
- Blaze mode: server filters FHIR response resources by Patient.meta.source against user's center IDs
- Center permission check in authMiddleware — extracted from JWT, passed to all handlers
- All /api/data/* endpoints reject cross-center requests with 403
- Frontend DataContext receives pre-filtered data from server (client filtering is defense-in-depth only)
- CohortBuilder center filter shows only permitted centers
- Admin and all-centers users bypass filtering

**Success criteria:**
- forscher1 (centers: ['UKA']) receives only Aachen data from server — network tab shows no other center data
- Directly calling /api/data/* with a valid JWT for UKA returns only UKA data, 403 for other centers
- admin sees all 5 centers
- CohortBuilder checkboxes only show permitted centers
- No endpoint returns cross-center data without explicit permission in JWT

**Depends on:** Phase 3 (server-side user management provides centers)

---

### Phase 5: Keycloak Preparation
**Goal:** Auth infrastructure ready for Keycloak; documentation for setup

**Scope:**
- Extend settings.yaml with auth.provider and auth.keycloak config
- Implement JWT validation in authMiddleware.ts using jwks-rsa
- Map Keycloak claims to app user model (username, role, centers)
- Add "Login with Keycloak" button to LoginPage (visible when configured)
- Write Keycloak setup documentation (realm, client, role mapping, centers claim)

**Success criteria:**
- settings.yaml auth section is parseable and respected
- authMiddleware correctly identifies and validates JWT tokens
- LoginPage shows Keycloak button when auth.provider === 'keycloak'
- Documentation exists for Keycloak realm/client configuration

**Depends on:** Phase 2 (auth middleware abstraction)

---

## Requirement Coverage

All 37 v1 requirements mapped. See REQUIREMENTS.md traceability table.

---
*Created: 2026-04-10*
*Last updated: 2026-04-10 after phase 2 planning*
