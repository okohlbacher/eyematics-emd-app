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

### Validated in v1.0

- [x] Production Express backend serving static build + all APIs — v1.0 (Phase 1)
- [x] Server-side login with bcrypt-hashed passwords (POST /api/auth/login) — v1.0 (Phase 2)
- [x] JWT session tokens (HS256) with { sub, preferred_username, role, centers } — v1.0 (Phase 2)
- [x] Remove hardcoded credentials from client bundle — passwords only on server — v1.0 (Phase 2)
- [x] Server-side audit log (append-only SQLite, replaces localStorage) — v1.0 (Phase 2)
- [x] Auth middleware validating JWT on all /api/* routes — v1.0 (Phase 2)
- [x] FHIR proxy for production (http-proxy-middleware) — v1.0 (Phase 1)
- [x] Server-side user management CRUD via API — v1.0 (Phase 4)
- [x] Server-side storage for quality flags, saved searches, excluded/reviewed cases — v1.0 (Phase 4)
- [x] Center-based data restriction (users see only their assigned centers' data) — v1.0 (Phase 5)
- [x] Keycloak integration preparation (middleware, config, documentation) — v1.0 (Phase 6)
- [x] API design that allows future migration from JSON files to a database — v1.0 (Phase 4)

### Validated in v1.1

- [x] Frontend AuthContext wired to server JWT auth (no client-side credentials) — v1.1
- [x] Frontend DataContext wired to server /api/data/* endpoints (no localStorage) — v1.1
- [x] Frontend AuditPage wired to server /api/audit (immutable, no clear button) — v1.1
- [x] Frontend AdminPage wired to server /api/auth/users CRUD (org-* center IDs) — v1.1
- [x] Frontend fhirLoader wired to /api/fhir/bundles (center-filtered server-side) — v1.1
- [x] Settings.yaml moved out of webroot to config/ — v1.1
- [x] FHIR data files blocked from static serving in production — v1.1
- [x] FHIR proxy moved under auth (/api/fhir-proxy) — v1.1
- [x] Centers configurable via data/centers.json — v1.1
- [x] Consolidated auth headers (single getAuthHeaders utility) — v1.1
- [x] Center validation on excluded/reviewed cases endpoints — v1.1
- [x] Client-side audit removed (server auditMiddleware handles all logging) — v1.1

### Active

<!-- Next milestone scope — v1.5 Site Roster & Cohort Analytics -->

- [ ] Replace site roster with Aachen, Chemnitz, Dresden, Greifswald, Leipzig, Mainz, Tübingen (7 sites; was 5)
- [ ] Generate synthetic FHIR bundles for the 5 new sites (40–50 patients each with AMD/DME/RVO trajectories)
- [ ] Node.js synthetic data generator script (`scripts/generate-center-bundle.ts`) — reproducible, parameterizable
- [ ] Migrate `data/users.json` center assignments (strip removed IDs, reassign empty lists to `org-uka`)
- [ ] Update docs (Lastenheft, Pflichtenheft, Konfiguration, README) and tests (constants, ui-requirements, fhirApi, dataApiCenter, centerBypass) for new roster
- [ ] Cohort Outcome Trajectories view — longitudinal visus analysis across cohort members
- [ ] OD / OS separated panels + combined OD+OS panel
- [ ] X-axis toggle: days since baseline vs treatment index
- [ ] Y-metric toggle: absolute / Δ vs baseline / Δ %
- [ ] Display layer toggles: median line, scatter of all points, SD band, per-patient curves
- [ ] Interpolation grid slider for median computation (default 120 points)
- [ ] Summary cards: patients, total measurements, OD / OS counts
- [ ] CSV export of underlying measurements

## Current Milestone: v1.5 Site Roster & Cohort Analytics

**Goal:** Correct the site roster to the 7 real EyeMatics sites with matching synthetic data, and add cohort-level outcome analysis.

**Target features:**
- Site roster correction from 5 to 7 centers (remove Bonn/München/Münster; add Chemnitz, Dresden, Greifswald, Leipzig, Mainz)
- Reproducible synthetic FHIR bundle generator for new sites (40–50 patients each)
- Cohort Outcome Trajectories — longitudinal visus delta/absolute over time or treatment index, OD/OS, with median + SD + per-patient curves

### Out of Scope

- Full Keycloak OIDC redirect flow — prepared but not implemented (complexity, needs real Keycloak instance)
- Database storage — JSON files for v1, API designed for future DB swap
- Parameter-level exclusion from analysis — only case-level exclusion exists
- Sub-cohort comparison — not in current codebase, not part of this redesign
- Self-service password change/reset — admin sets passwords; self-service deferred to Keycloak

## Context

- **Existing codebase**: ~130 files, well-structured React SPA with Vite 8
- **Server**: Express 5 production server (server/index.ts) + Vite dev plugins for backward compat
- **Auth flow**: Server-side bcrypt + JWT (HS256), 2FA with fixed OTP, rate limiting with exponential backoff
- **Audit**: Server-side SQLite (data/audit.db), auto-logged by middleware, immutable from client, configurable retention
- **User centers**: Server-enforced center filtering on all data endpoints (Phase 5)
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
| JSON files over SQLite for v1 | No native deps, simpler deployment, fits on-premises philosophy | Implemented (Phase 1) |
| Keycloak prepare-only (no full OIDC flow) | Needs real Keycloak instance to test; middleware abstraction is the hard part | ✓ Implemented (Phase 6) |
| All localStorage to server | Audit compliance requires it; partial migration creates inconsistent patterns | ✓ Complete — audit (Phase 2), data persistence (Phase 4) |
| Raw Node http types for shared handlers | Avoids Express dependency in code shared with Vite dev plugins | Implemented (Phase 1) |
| SQLite for audit log (better-sqlite3) | SQL filtering/sorting beats JSONL for query flexibility; configurable retention with auto-purge; immutable from UI | Implemented (Phase 2) |
| Server-side login with bcrypt + JWT | Passwords must never be in client bundle; JWT format identical for local and Keycloak — seamless provider switch | Implemented (Phase 2) |
| User credentials + centers in data/users.json | Single user record holds passwordHash, role, centers — same schema regardless of auth provider | Implemented (Phase 2) |
| DSF as separate orchestration layer | DSF populates/coordinates multi-site data; EMD reads only local repository. Four-zone model: clinical/source, DSF node, EMD backend, browser. Clean separation of concerns. | Architecture decided |
| EMD never talks to remote hospitals | Express backend reads only from local FHIR store (Blaze or files). DSF upstream pushes data into local store. No direct cross-site communication from EMD. | Architecture decided |
| Pattern A (central consolidation) for v1 | Each site sends pseudonymized payloads via DSF to local consolidated repo. EMD reads from that. Pattern B (federated query) deferred to future. | Architecture decided |

---
*Last updated: 2026-04-14 — milestone v1.5 opened (Site Roster & Cohort Analytics). Note: v1.2–v1.4 shipped between v1.1 and v1.5 but were not tracked in GSD artifacts; git history is authoritative for those.*
