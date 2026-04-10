# Milestones

## v1.1 Frontend-Backend Integration (Shipped: 2026-04-11)

**Changes:** 30 files, +807/-1177 lines (net -370 lines)

**Key accomplishments:**

- Server-backed JWT authentication (removed all hardcoded credentials from client bundle)
- Frontend wired to all server APIs (FHIR bundles, audit, user CRUD, data persistence)
- Settings.yaml and FHIR data moved out of webroot (security)
- FHIR proxy moved under auth scope (/api/fhir-proxy)
- Centers made configurable via data/centers.json
- Shared server constants extracted (no more duplicated center lists)
- Client-side audit replaced by server-side auditMiddleware
- Dead code removed (auditService, useLocalStorageState, safeJson)

---

## v1.0 EMD Backend Redesign MVP (Shipped: 2026-04-10)

**Phases completed:** 4 phases, 8 plans, 7 tasks

**Key accomplishments:**

- Commit:
- 1. [Rule 1 - Bug] TypeScript error on req.params.id
- Task 1 — AuthContext.tsx rewrite:
- One-liner:
- One-liner:
- One-liner:
- server/authApi.ts

---
