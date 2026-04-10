# Roadmap: EMD Backend Redesign v1.0

**Milestone:** v1.0
**Core Value:** Every user sees only authorized data, with tamper-proof audit trail

## Phases

### Phase 1: Production Express Backend
**Goal:** Standalone Express server serving Vite production build with all API routes and FHIR proxy
**Requirements:** BACK-01, BACK-02, BACK-03, BACK-04, BACK-05, BACK-06
**Status:** Complete

### Phase 2: Server-Side Auth & Audit
**Goal:** Server-side authentication with JWT, immutable audit logging in SQLite, shared auth utilities
**Requirements:** AUDIT-01..10, AUTH-01, AUTH-02, AUTH-04..09
**Status:** Complete

### Phase 3: Phase 1-2 Integration Fixes
**Goal:** Fix 3 integration bugs found during milestone audit — audit body capture, time filter params, settings schema validator
**Requirements:** AUDIT-01, AUDIT-02, AUDIT-09, AUTH-05 (re-verify), USER-13 (formal verification)
**Gap Closure:** Closes integration and flow gaps from audit
**Depends on:** Phase 2
**Plans:** 2 plans

Plans:
- [x] 03-01-PLAN.md — Fix 3 integration bugs (body capture, time filters, settings validator)
- [x] 03-02-PLAN.md — Install vitest, extract rate limiting, write automated tests

### Phase 4: User Management & Data Persistence
**Goal:** Server-side user CRUD via API, server-side data storage replacing localStorage, AdminPage wired to API
**Requirements:** USER-01, USER-02, USER-03, USER-04, USER-05, USER-06, USER-07, USER-08, USER-09, USER-10, USER-11, USER-12, DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07
**Gap Closure:** Closes 19 orphaned requirements from audit
**Depends on:** Phase 3
**Plans:** 3 plans

Plans:
- [x] 04-01-PLAN.md — Server-side user CRUD API (saveUsers, GET/POST/DELETE/PUT endpoints)
- [x] 04-02-PLAN.md — Server-side data persistence API (SQLite data.db, 8 endpoints for 4 resources)
- [x] 04-03-PLAN.md — Client migration (AdminPage + DataContext wired to server, localStorage removed)

### Phase 5: Center-Based Data Restriction
**Goal:** Server-enforced center filtering on all data endpoints — unauthorized center data never leaves the server
**Requirements:** CENTER-01, CENTER-02, CENTER-03, CENTER-04, CENTER-05, CENTER-06, CENTER-07, CENTER-08, CENTER-09
**Gap Closure:** Closes 9 orphaned requirements from audit
**Depends on:** Phase 4

### Phase 6: Keycloak Preparation
**Goal:** Prepare auth middleware for Keycloak JWKS validation, config block, claim mapping, UI toggle, documentation
**Requirements:** KC-01, KC-02, KC-03, KC-04, KC-05, AUTH-03
**Gap Closure:** Closes 5 orphaned requirements + 1 partial from audit
**Depends on:** Phase 5

---
*Created: 2026-04-10 from milestone audit gap closure*
