# EMD Backend Redesign

## Current Milestone: v1.9 — Codebase Consistency & Test/Tech-Debt Polish

**Goal:** Raise internal quality — eliminate code duplication, enforce consistency across the codebase, green the test suite, automate deferred UAT items, and modernize deps/lint.

**Target themes:**
- Codebase consistency audit: sweep for duplicated utilities, divergent patterns, inconsistent naming, stale abstractions; refactor to single-source-of-truth
- Documentation consistency: `.planning/`, `README.md`, inline docs audited for accuracy & conciseness
- Test-suite green: fix 3 pre-existing failures (outcomesPanelCrt ×2 visus absolute y-domain; OutcomesPage ×1 audit beacon POST)
- Session UAT → automated: convert Phase 20's 5 human-verification items into automated tests
- Dependency + lint cleanup: npm audit, non-breaking upgrades, tighter ESLint rules, dead-code removal

**Explicitly out of scope:** KEYCLK-01, SESSION-10/11, Playwright E2E (MSEL-04 gap stays deferred), new product features.

**Starting phase number:** 21 (continues v1.8's Phase 20)

## What This Is

A production-readiness overhaul of the EyeMatics Clinical Demonstrator (EMD), a React/TypeScript clinical research dashboard for ophthalmological IVOM treatment data. The redesign adds a standalone Express backend, optional Keycloak OIDC authentication (with local credential fallback), server-side audit logging, site-based data restriction, and migrates all persistent state from localStorage to server-side JSON file storage.

## Core Value

Every user sees only the data they are authorized to see, with a tamper-proof audit trail of all access — while maintaining the zero-friction local development experience.

## Requirements

### Validated

<!-- Shipped and confirmed valuable — inherited from existing codebase -->

- [x] FHIR R4 data loading from local JSON bundles and Blaze FHIR server
- [x] Cohort building with multi-criteria filtering
- [x] Case detail view with clinical parameters, charts, OCT images
- [x] Data quality review with error flagging and therapy discontinuation detection
- [x] Documentation quality benchmarking across sites
- [x] User management with 6 roles and multi-site assignment
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
- [x] Site-based data restriction (users see only their assigned sites' data) — v1.0 (Phase 5)
- [x] Keycloak integration preparation (middleware, config, documentation) — v1.0 (Phase 6)
- [x] API design that allows future migration from JSON files to a database — v1.0 (Phase 4)

### Validated in v1.1

- [x] Frontend AuthContext wired to server JWT auth (no client-side credentials) — v1.1
- [x] Frontend DataContext wired to server /api/data/* endpoints (no localStorage) — v1.1
- [x] Frontend AuditPage wired to server /api/audit (immutable, no clear button) — v1.1
- [x] Frontend AdminPage wired to server /api/auth/users CRUD (org-* site IDs) — v1.1
- [x] Frontend fhirLoader wired to /api/fhir/bundles (site-filtered server-side) — v1.1
- [x] Settings.yaml moved out of webroot to config/ — v1.1
- [x] FHIR data files blocked from static serving in production — v1.1
- [x] FHIR proxy moved under auth (/api/fhir-proxy) — v1.1
- [x] Sites configurable via data/centers.json — v1.1
- [x] Consolidated auth headers (single getAuthHeaders utility) — v1.1
- [x] Site validation on excluded/reviewed cases endpoints — v1.1
- [x] Client-side audit removed (server auditMiddleware handles all logging) — v1.1

### Validated in v1.5

- [x] Replace site roster with Aachen, Chemnitz, Dresden, Greifswald, Leipzig, Mainz, Tübingen (7 sites; was 5) — v1.5 (Phase 7)
- [x] Synthetic FHIR bundles for the 5 new sites (~45 patients each with AMD/DME/RVO trajectories) — v1.5 (Phase 7)
- [x] Deterministic Node.js synthetic data generator (`scripts/generate-center-bundle.ts`, Mulberry32 PRNG) — v1.5 (Phase 7)
- [x] `data/users.json` migration (`_migrateRemovedCenters` at server startup) — v1.5 (Phase 7)
- [x] Docs + roster-pinned tests updated for new 7-site roster — v1.5 (Phase 7)
- [x] Cohort Outcome Trajectories view — longitudinal cohort-level visus analysis — v1.5 (Phase 9)
- [x] OD / OS separated panels + combined OD+OS panel — v1.5 (Phase 9)
- [x] X-axis toggle: days since baseline vs treatment index — v1.5 (Phase 9)
- [x] Y-metric toggle: absolute / Δ vs baseline / Δ % — v1.5 (Phase 9)
- [x] Display layer toggles: median, per-patient, scatter, IQR band — v1.5 (Phase 9)
- [x] Interpolation grid slider for median (default 120, range 20–300) — v1.5 (Phase 9)
- [x] Summary cards: patients, total measurements, OD / OS counts (D-26 single source) — v1.5 (Phase 9)
- [x] CSV export of underlying measurements with 8 D-28 columns (no `center_id`) — v1.5 (Phase 9)
- [x] Audit beacon on outcomes view open (`GET /api/audit/events/view-open`) — v1.5 (Phase 8 + 9)
- [x] Full DE+EN i18n for outcomes view (71 keys + completeness test) — v1.5 (Phase 8)

### Validated in v1.6

- ✓ WCAG-verified outcomes chart palette with centralized `palette.ts` module — v1.6 (Phase 10)
- ✓ IQR band n<2 guard at math + DOM layers; no 0-height artifacts — v1.6 (Phase 10)
- ✓ Outcomes tooltip field order, units, and per-patient suppression (D-05/D-06) — v1.6 (Phase 10)
- ✓ All-eyes-filtered empty-state variant (DE+EN); outcomes i18n grows to 73 keys — v1.6 (Phase 10)
- ✓ Admin site filter locked to 7-site roster with roster-change canary test (VQA-01) — v1.6 (Phase 10)
- ✓ Stable OutcomesDataPreview row keys: composite `${pseudo}|${eye}|${date}` (CRREV-02) — v1.6 (Phase 10)
- ✓ Cohort ID removed from audit beacon URL; HMAC-SHA256 hash in POST body (CRREV-01) — v1.6 (Phase 11)
- ✓ `POST /api/outcomes/aggregate` — JWT-site-filtered, cached, byte-identical to client (AGG-01..05) — v1.6 (Phase 12)
- ✓ Auto-route to server aggregation above 1000-patient threshold (AGG-03) — v1.6 (Phase 12)
- ✓ Shared `shared/` module extracted from `src/` with backward-compat shims (AGG-02 precondition) — v1.6 (Phase 12)
- ✓ CRT trajectory metric with LOINC LP267955-5, µm units, server routing (METRIC-01) — v1.6 (Phase 13)
- ✓ Treatment-interval histogram: 6 fixed bins, median annotation, eye toggle (METRIC-02) — v1.6 (Phase 13)
- ✓ Responder classification: configurable threshold, ±180-day year-1 window (METRIC-03) — v1.6 (Phase 13)
- ✓ Metric selector tab strip with `?metric=` deep-link (METRIC-04) — v1.6 (Phase 13)
- ✓ Per-metric CSV export with metric-slug filename (METRIC-05) — v1.6 (Phase 13)
- ✓ 60 metrics* i18n keys (DE+EN) with automated completeness test (METRIC-06) — v1.6 (Phase 13)

### Validated in v1.7

- [x] Cross-cohort comparison: overlay up to 4 saved cohorts on trajectory charts (XCOHORT-01..04, VIS-04) — v1.7 (Phase 16)
- [x] Dark-mode WCAG contrast for outcomes palette (VQA-02) — v1.7 (Phase 17)
- [x] Security quick wins + per-user TOTP 2FA (SEC-14..15) — v1.7 (Phases 14–15)
- [x] Full-review security hardening: C1–C5, H1–H7, M1–M8, L1–L10 resolved (v1.7-full-review)

### Validated in v1.8

- [x] metricSelector test harness unblocked: 5 skipped cases unskipped + shared `renderOutcomesView` helper + MSEL-05 keyboard tests (MSEL-01..06) — v1.8 (Phase 18)
- [x] AuditPage useReducer state machine refactor with characterization tests landed first (AUDIT-01..04) — v1.8 (Phase 19)
- [x] JWT refresh flow with silent `authFetch` refresh, BroadcastChannel cross-tab coordination, credential-mutation invalidation (SESSION-01..09, 12, 13) — v1.8 (Phase 20)
- [x] Post-UAT polish: LoginPage password toggle, Münster (UKMS) restored as 8th site, doc-quality COHORT_PALETTES, scrollable diagnosis legend — v1.8

### Validated in v1.9 / v1.9.x patch series

- [x] Full test suite green (zero skipped, UAT-AUTO-01..05 automated), codebase consistency sweep, dep + lint cleanup — v1.9 (Phases 21–23)
- [x] UKD + UKMZ removed from site roster; site count reduced from 8 to 6 participating sites (FB-01) — v1.9.3 (Phase 24-01)
- [x] DocQuality bar-chart palette aligned to muted chart tokens (FB-04) — v1.9.3 (Phase 24-04)
- [x] Terminology service `src/services/terminology.ts`: `collectCodings`, `resolveDisplay`, `getCachedDisplay`, `useDiagnosisDisplay`; well-known seed; 5 callers migrated (TERM-01..03, TERM-05) — v1.9.4 (Phase 25)
- [x] Server-side terminology proxy `POST /api/terminology/lookup`: SSRF-safe whitelist, LRU cache, 503-when-disabled (TERM-03) — v1.9.4 (Phase 25-02)
- [x] Terminology seed extended with 5 missing diagnosis codes; `audit-bundle-codes.mjs` CI gate; 0 unresolvable codes (SYNTH-01) — v1.9.5 (Phase 26-01)
- [x] Disease-conditional comorbidity model: AMD 65% ≥ 60%, DME 100% diabetes + ≥40% hypertension (SYNTH-02) — v1.9.5 (Phase 26-02)
- [x] HbA1c for DME + age-disease coupling (truncated-normal per cohort) + AMD/DME/RVO template differentiation + Faricimab/Dexamethasone (SYNTH-03) — v1.9.5 (Phase 26-03)
- [x] 4 synthetic bundles regenerated atomically; verify-bundle-distributions.mjs wired into test:ci; 682/682 tests green (SYNTH-04) — v1.9.5 (Phase 26-04)

### Active (next-milestone candidates)

- [ ] Real Keycloak OIDC redirect flow (KEYCLK-01) — blocked at initAuth until the redirect flow ships (M7)
- [x] SESSION-11: stateful refresh-sessions table with OAuth2-style rotation + family revocation (SESS-02/03) — v1.10 (Phase 27)
- [x] Refresh-token signing-key rotation + dual-key window (SESS-04) — v1.10 (Phase 27)
- [ ] SESSION-10: admin-triggered force sign-out everywhere
- [ ] UI surface for `auth.refreshTokenTtlMs` / `auth.refreshAbsoluteCapMs`
- [ ] Per-device session listing + revocation UI
- [ ] Home "Attention needed" panel Review buttons (FB-02) — deferred from v1.9.3
- [ ] Home "Jump Back In" panel routing (FB-03) — deferred from v1.9.3
- [ ] Terminology settings + Konfiguration.md docs (TERM-04) — deferred from v1.9.4

## Current State

**In Progress:** Milestone v1.10 — Session Hardening & UX Closure
- Phase 27 complete (2026-05-11): `server/sessionsDb.ts` (SQLite WAL, jti-keyed rows), jti rotation in /refresh, RFC 6819 family revocation, dual-key signing window, `/api/auth/rotate-key` admin endpoint (SESS-02/03/04); 702/702 tests green

**Shipped:** Milestone v1.9.5 — Synthetic Data Realism (2026-05-01)
- Phase 26 complete: terminology seed extended (5 codes), disease-conditional comorbidities, HbA1c + age-disease coupling, AMD/DME/RVO template differentiation, 4 synthetic bundles regenerated, verify-bundle-distributions.mjs wired into test:ci
- All SYNTH-01..04 requirements verified; 682 tests green; audit:bundles exits 0
- **Archive:** [`.planning/milestones/v1.9.5-ROADMAP.md`](milestones/v1.9.5-ROADMAP.md) · [`.planning/milestones/v1.9.5-REQUIREMENTS.md`](milestones/v1.9.5-REQUIREMENTS.md)

**Shipped:** Milestone v1.8 — Session Resilience & Test/Code Polish (2026-04-23)
- Phase 18: metricSelector test harness unblock + shared render helper
- Phase 19: AuditPage useReducer state machine refactor (characterization-first)
- Phase 20: JWT access/refresh token split, silent refresh, BroadcastChannel, credential-mutation invalidation
- Post-UAT polish: 8-site roster (Münster restored), doc-quality palette, diagnosis legend

**Archive:** [`.planning/milestones/v1.8-ROADMAP.md`](milestones/v1.8-ROADMAP.md)

**Previously Shipped:** Milestone v1.7 — Security, Performance & Cross-Cohort (2026-04-21)
- Phase 14: Security quick wins
- Phase 15: Per-user TOTP 2FA with recovery codes
- Phase 16: Cross-cohort comparison (4-cohort overlay, `?cohorts=` deep-link)
- Phase 17: Dark-mode palette + UAT
- v1.7-full-review security pass: all Critical/High/Medium/Low findings resolved (see `.planning/reviews/v1.7-full-review/SUMMARY.md`)

**Previously Shipped:** Milestone v1.6 — Outcomes Polish & Scale (2026-04-17)
- Visual/UX QA closed: WCAG palette, IQR guard, tooltip format, empty states, admin filter, stable row keys
- Audit beacon PII hardened: cohort ID → HMAC-SHA256 hash in POST body (CRREV-01)
- Server-side outcomes pre-aggregation at >1000-patient threshold (AGG-01..05)
- Four new outcome metrics: CRT, Treatment-Interval, Responder, metric selector with deep-link (METRIC-01..06)
- 429/429 tests passing across 47 files at milestone close

**Archive:** [`.planning/milestones/v1.6-ROADMAP.md`](milestones/v1.6-ROADMAP.md), [`.planning/milestones/v1.6-REQUIREMENTS.md`](milestones/v1.6-REQUIREMENTS.md)

## Next Milestone Goals (TBD)

- **Real Keycloak OIDC redirect flow** (KEYCLK-01 — blocked by M7 at initAuth)
- **SESSION-10**: admin-triggered global sign-out (Phase 28)
- **Per-device session listing / revocation UI** (Phase 28)
- **UI surface for session TTL settings** (Phase 28)
- **Home panel UX fixes** — "Attention needed" Review buttons + "Jump Back In" routing (FB-02, FB-03; deferred from v1.9.3)
- **Terminology settings + docs** — `terminology.*` settings.yaml keys + `docs/Konfiguration.md` (TERM-04; deferred from v1.9.4)

## Historical Milestone Goals (archived)

<details>
<summary>v1.6: Outcomes Polish & Scale (shipped 2026-04-17)</summary>

**Goal:** Finish v1.5 visual QA, unlock large-cohort performance via server-side pre-aggregation, extend outcome metrics beyond visus, close Phase 9 code-review info findings.

**Delivered:** VQA (Phase 10) + Audit PII hardening (Phase 11) + Server aggregation (Phase 12) + 4 new metrics (Phase 13). 429 tests, 47 test files, 178 files changed.

</details>

<details>
<summary>v1.5: Site Roster & Cohort Analytics (shipped 2026-04-15)</summary>

**Goal:** Correct the site roster to the 7 real EyeMatics sites with matching synthetic data, and add cohort-level outcome analysis.

**Target features:**
- Site roster correction from 5 to 7 sites (remove Bonn/München/Münster; add Chemnitz, Dresden, Greifswald, Leipzig, Mainz)
- Reproducible synthetic FHIR bundle generator for new sites (40–50 patients each)
- Cohort Outcome Trajectories — longitudinal visus delta/absolute over time or treatment index, OD/OS, with median + IQR + per-patient curves

</details>

### Out of Scope

- Full Keycloak OIDC redirect flow — prepared but not implemented (complexity, needs real Keycloak instance)
- Database storage — JSON files for v1, API designed for future DB swap
- Parameter-level exclusion from analysis — only case-level exclusion exists
- Sub-cohort comparison — not in current codebase, not part of this redesign
- Self-service password change/reset — admin sets passwords; self-service deferred to Keycloak

## Context

- **Codebase (v1.9.5):** React/TypeScript SPA + Express 5 server + `shared/` pure-TS module
- **Server**: Express 5 production server (server/index.ts) + Vite dev plugins for backward compat
- **Auth flow**: Server-side bcrypt + JWT (HS256), TOTP 2FA (per-user enrollment), silent refresh via httpOnly cookie + BroadcastChannel, rate limiting with exponential backoff
- **Audit**: Server-side SQLite (data/audit.db), auto-logged by middleware, immutable from client, configurable retention; cohort IDs hashed via HMAC-SHA256 (v1.6)
- **User sites**: Server-enforced site filtering on all data endpoints; 6 participating sites (Aachen, Chemnitz, Greifswald, Leipzig, Münster, Tübingen) — UKD + UKMZ removed v1.9.3
- **FHIR data**: 4 synthetic sites with deterministic synthetic data (Mulberry32 PRNG) + comorbidities + HbA1c + age-disease coupling + AMD/DME/RVO template differentiation (v1.9.5); 2 reference sites (Aachen, Tübingen)
- **Terminology**: `src/services/terminology.ts` — 15-entry `_seedMap`, `collectCodings`, `resolveDisplay`, `useDiagnosisDisplay`; server-side proxy disabled by default; CI drift-guard enforces 0 unresolvable codes
- **Outcomes**: 4 metrics (Visus, CRT, Treatment-Interval, Responder) with server-side pre-aggregation at >1000-patient threshold; metric selector with `?metric=` deep-link; cross-cohort overlay (up to 4)
- **Test surface**: 682 tests passing across ~65 test files (v1.9.5 close)
- **Requirements docs**: Lastenheft (RE-EM-LH) and Pflichtenheft (EMDREQ-*) define the formal requirements

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
| shared/ module extracted from src/ (v1.6) | Pure-TS cohort math shared between server (aggregation) and client (client-path fallback). Dual tsconfig, backward-compat shims, byte-parity parity test. | ✓ Validated — clean split, no regressions |
| Server aggregation at >1000-patient threshold (v1.6) | Configurable via settings.yaml (default 1000). Below threshold: client path. Above: POST /api/outcomes/aggregate. Both paths converge on identical grid points. | ✓ Validated — byte-parity test proves identity |
| Cohort ID hashed in audit events (v1.6) | HMAC-SHA256 truncated to 16 hex chars. Secret in settings.yaml. hashCohortId reused by aggregation audit event. URL stays clean (no querystring PII). | ✓ Validated — closes CRREV-01 / IN-01 |
| Per-metric CSV flatteners in OutcomesDataPreview (v1.6) | Each metric has its own flattenXxxRows() helper in the component file (locked-decision-3 pattern from Phase 8). No shared utility to avoid coupling. | ✓ Validated — consistent with locked decision |
| EXPECTED_SEED_KEYS hand-mirrored in audit script (v1.9.5) | ESM .mjs cannot import .ts without a loader; hand-mirror is fast and caught by drift-guard test at every CI run | ✓ Validated — drift-guard test in tests/audit-bundle-codes.test.ts catches key divergence immediately |
| Whitelist split: WHITELIST_SYSTEMS vs WHITELIST_KEYS (v1.9.5) | LOINC + ATC blanket-whitelisted (non-diagnostic); SNOMED requires specific allow-list entries (also used for diagnostics like AMD) | ✓ Validated — correct categorization; no false positives in audit:bundles |
| AMD ≥60% comorbidity assertable at bundle level only (v1.9.5) | Unit test uses ≥45% (pre-age-coupling); verifier enforces ≥60% against shipped bundles (with age coupling active). Two-layer design. | ✓ Validated — verifier confirms 65% in shipped bundles; unit test remains valid for isolated testing |
| Atomic 4-bundle commit (D-11, v1.9.5) | Prevents partial-regeneration hazard where one bundle encodes new model while others don't; all 4 JSONs committed together | ✓ Validated — commit 5bdd89a contains all 4 synthetic JSONs atomically |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-01 — after v1.9.5 milestone completion (Synthetic Data Realism, Phase 26).*
