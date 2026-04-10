# Roadmap: EMD Backend Redesign

**Created:** 2026-04-10
**Milestone:** v1.0 — Production Backend

## Phase Overview

| Phase | Name | Requirements | Status |
|-------|------|-------------|--------|
| 1 | Production Express Backend | BACK-01..06 | Planned |
| 2 | Server-Side Audit + Auth Middleware | AUDIT-01..07, AUTH-01..06 | Pending |
| 3 | Server-Side Users + Data Persistence | USER-01..06, DATA-01..07 | Pending |
| 4 | Center-Based Data Restriction | CENTER-01..06 | Pending |
| 5 | Keycloak Preparation | KC-01..05 | Pending |

## Phase Details

### Phase 1: Production Express Backend
**Goal:** Standalone Express server that serves the built app and all existing APIs

**Plans:** 2 plans

Plans:
- [ ] 01-01-PLAN.md — Extract handler functions from Vite plugins + build infrastructure
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

### Phase 2: Server-Side Audit + Auth Middleware
**Goal:** Tamper-proof audit log and unified authentication layer

**Scope:**
- Create server/auditApi.ts with JSONL storage in data/audit-log.jsonl
- Create src/services/authHeaders.ts (shared, deduplicated)
- Create server/authMiddleware.ts (local token validation, JWT detection stub)
- Migrate auditService.ts from localStorage to HTTP API calls
- Update AuditPage.tsx for async loading, remove clear button
- Mount audit routes in both Express and Vite dev plugins

**Success criteria:**
- logAudit() calls POST /api/audit; entries appear in data/audit-log.jsonl
- GET /api/audit returns filtered entries
- AuditPage loads and displays server-side entries
- No localStorage usage for audit data
- getAuthHeaders() is a single shared utility

**Depends on:** Phase 1 (Express server for production routes)

---

### Phase 3: Server-Side Users + Data Persistence
**Goal:** All persistent application state lives on the server

**Scope:**
- Create server/userApi.ts with data/users.json storage
- Create server/dataApi.ts for quality flags, saved searches, excluded/reviewed cases
- Migrate AuthContext.tsx user management from localStorage to /api/users
- Migrate DataContext.tsx from useLocalStorageState to server API calls
- Update AdminPage.tsx to use /api/users
- Seed data/users.json with DEFAULT_MANAGED_USERS on first start

**Success criteria:**
- AdminPage creates/deletes users via API; data/users.json updated
- Saved searches, quality flags, excluded/reviewed cases persist on server
- No localStorage usage except emd-locale (language preference)
- Data survives browser clear and logout

**Depends on:** Phase 2 (auth middleware for API protection)

---

### Phase 4: Center-Based Data Restriction
**Goal:** Users see only data from their assigned centers

**Scope:**
- Add userCenters to auth context (fetched from /api/users/me)
- Filter cases in DataContext by user's centers after loading
- Filter centers list in DataContext
- Ensure CohortBuilder, Analysis, Quality, DocQuality pages respect restrictions
- Admin and all-centers users bypass filtering

**Success criteria:**
- forscher1 (centers: ['UKA']) sees only Aachen data
- admin sees all 5 centers
- CohortBuilder center checkboxes only show permitted centers
- Analysis, Quality, DocQuality pages show only permitted data

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
*Last updated: 2026-04-10 after phase 1 planning*
