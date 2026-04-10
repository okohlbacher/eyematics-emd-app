# EMD Backend Redesign

## What This Is

A production-readiness overhaul of the EyeMatics Clinical Demonstrator (EMD), a React/TypeScript clinical research dashboard for ophthalmological IVOM treatment data. The redesign adds a standalone Express backend, optional Keycloak OIDC authentication (with local credential fallback), server-side audit logging, center-based data restriction, and migrates all persistent state from localStorage to server-side JSON file storage.

## Core Value

Every user sees only the data they are authorized to see, with a tamper-proof audit trail of all access — while maintaining the zero-friction local development experience.

## Requirements

### Validated

<!-- Shipped and confirmed valuable — inherited from existing codebase -->

- [x] FHIR R4 data loading from local JSON bundles and Blaze FHIR server
- [x] Cohort building with multi-criteria filtering
- [x] Case detail view with clinical parameters, charts, OCT images
- [x] Data quality review with error flagging and therapy discontinuation detection
- [x] Documentation quality benchmarking across centers
- [x] User management with 6 roles and multi-center assignment
- [x] Full German/English i18n
- [x] Issue reporting with screenshot capture

### Active

<!-- Current scope. Building toward these. -->

- [ ] Production Express backend serving static build + all APIs
- [ ] Server-side login with bcrypt-hashed passwords (POST /api/auth/login)
- [ ] JWT session tokens (HS256 local / RS256 Keycloak) with { username, role, centers }
- [ ] Remove hardcoded credentials from client bundle — passwords only on server
- [ ] Server-side audit log (append-only JSONL, replaces localStorage)
- [ ] Server-side user management with password hashes, role, and center permissions
- [ ] Server-side storage for quality flags, saved searches, excluded/reviewed cases
- [ ] Center-based data restriction (users see only their assigned centers' data)
- [ ] Auth middleware validating JWT on all API routes (same token format for local + Keycloak)
- [ ] Keycloak integration preparation (middleware, config, documentation)
- [ ] FHIR proxy for production (http-proxy-middleware)
- [ ] API design that allows future migration from JSON files to a database

### Out of Scope

- Full Keycloak OIDC redirect flow — prepared but not implemented (complexity, needs real Keycloak instance)
- Database storage — JSON files for v1, API designed for future DB swap
- Parameter-level exclusion from analysis — only case-level exclusion exists
- Sub-cohort comparison — not in current codebase, not part of this redesign
- Self-service password change/reset — admin sets passwords; self-service deferred to Keycloak

## Context

- **Existing codebase**: ~130 files, well-structured React SPA with Vite 8
- **Server plugins**: issueApi.ts and settingsApi.ts use Vite's `configureServer()` — dev-only
- **Auth flow**: hardcoded DEFAULT_CREDENTIALS in AuthContext.tsx, base64 Bearer tokens
- **Audit**: localStorage with 500 entry cap, cleared on logout, tamperable
- **User centers**: ManagedUser.centers field exists but is never used for data filtering
- **FHIR data**: 5 centers (UKA, UKB, LMU, UKT, UKM) with synthetic test data
- **Center mapping**: centerId (e.g., 'org-uka') maps to shorthand (e.g., 'UKA') via CENTER_SHORTHANDS in fhirLoader.ts
- **Requirements docs**: Lastenheft (RE-EM-LH) and Pflichtenheft (EMDREQ-*) define the formal requirements
- **Code review**: ISSUES.md documents 50 findings including the security and architecture gaps this redesign addresses

### DSF Integration Architecture (Multi-Site)

The EMD operates within a four-zone architecture at each site:

1. **Clinical/Source Zone**: Local source systems, ETL, pseudonymization, site's local EyeMatics-compatible FHIR repository
2. **DSF Site Node**: Local DSF FHIR server + BPE (Business Process Engine), configured with site Organization/Endpoint resources and certificates for inter-site participation. DSF uses FHIR R4 + BPMN 2.0 for workflow orchestration.
3. **Local EMD Backend**: Express app reads ONLY from the local repository or local consolidated FHIR view — never from remote hospitals directly
4. **Browser/UI Zone**: React frontend queries only its own local backend

**Key architectural principle**: DSF populates/coordinates the multi-site data layer; EMD stays a local dashboard over locally available data. The EMD backend's existing data-source abstraction (local files or Blaze) maps directly to reading from the local repository that DSF keeps populated.

**DSF responsibilities**: Site-to-site trust, process authorization, transport security, workflow traceability, approval gates
**EMD responsibilities**: User-facing auth/authz, local audit trail, visualization, local business logic

**Target pattern (Phase 1)**: Pattern A — central consolidation. Each site sends pseudonymized FHIR payloads via DSF into a local consolidated repository. EMD reads from that. Pattern B (federated query) is future work for strict data-minimization scenarios.

**Future DSF adapter service** (not in current v1 scope): Backend-only module mapping EMD requests to DSF Task payloads, tracking process state, importing validated returned data, surfacing workflow status. Three resource layers: DSF control plane (Task, Organization, Endpoint, DocumentReference), research payloads (EyeMatics FHIR Bundles), local app metadata (request status, job history, provenance, audit links).

## Constraints

- **Backward compat**: `npm run dev` must work unchanged — Vite dev plugins stay functional
- **No database**: JSON file storage only for v1; design APIs so DB can be swapped in later
- **On-premises**: Each site runs its own instance; no shared cloud infrastructure
- **Minimal deps**: Express + http-proxy-middleware + jsonwebtoken + jwks-rsa + bcrypt + better-sqlite3
- **Node.js**: Server must run on Node.js >= 20 (same as existing prerequisite)
- **Existing roles**: Keep the 6-role system (admin, researcher, epidemiologist, clinician, data_manager, clinic_lead)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| JSON files over SQLite for v1 | No native deps, simpler deployment, fits on-premises philosophy | — Pending |
| Keycloak prepare-only (no full OIDC flow) | Needs real Keycloak instance to test; middleware abstraction is the hard part | — Pending |
| All localStorage to server | Audit compliance requires it; partial migration creates inconsistent patterns | — Pending |
| Raw Node http types for shared handlers | Avoids Express dependency in code shared with Vite dev plugins | — Pending |
| SQLite for audit log (better-sqlite3) | SQL filtering/sorting beats JSONL for query flexibility; 90-day rolling retention with auto-purge; immutable from UI | — Pending |
| Server-side login with bcrypt + JWT | Passwords must never be in client bundle; JWT format identical for local and Keycloak — seamless provider switch | — Pending |
| User credentials + centers in data/users.json | Single user record holds passwordHash, role, centers — same schema regardless of auth provider | — Pending |
| DSF as separate orchestration layer | DSF populates/coordinates multi-site data; EMD reads only local repository. Four-zone model: clinical/source, DSF node, EMD backend, browser. Clean separation of concerns. | — Pending |
| EMD never talks to remote hospitals | Express backend reads only from local FHIR store (Blaze or files). DSF upstream pushes data into local store. No direct cross-site communication from EMD. | — Pending |
| Pattern A (central consolidation) for v1 | Each site sends pseudonymized payloads via DSF to local consolidated repo. EMD reads from that. Pattern B (federated query) deferred to future. | — Pending |

---
*Last updated: 2026-04-10 after auth security update*
