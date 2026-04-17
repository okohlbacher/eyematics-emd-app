# Milestones

## v1.6 Outcomes Polish & Scale (Shipped: 2026-04-17)

**Phases completed:** 4 phases (10–13), 19 plans, 116 commits
**Changes:** 178 files, +25,698 / −10,873 lines
**Timeline:** 2026-04-16 → 2026-04-17 (1 day)
**Tests:** 429 passing, 0 failed (was 313 at v1.5 baseline)

**Key accomplishments:**

- **VQA (Phase 10):** Closed all v1.5 visual-QA gaps — WCAG-verified outcomes palette module, IQR band n<2 guard at math + DOM layers, tooltip D-05/D-06 field order + per-patient suppression, third empty-state variant (`all-eyes-filtered`), admin center filter locked to 7-site roster, stable OutcomesDataPreview row keys (composite `${pseudo}|${eye}|${date}`)
- **Audit PII hardening (Phase 11):** Cohort IDs removed from audit beacon URL — hashed via HMAC-SHA256 (server/hashCohortId.ts) in event payload; beacon migrated from GET querystring to POST JSON with keepalive; CRREV-01 closed end-to-end
- **Server-side aggregation (Phase 12):** `POST /api/outcomes/aggregate` — JWT-center-filtered, user-scoped Map cache with TTL + invalidation, byte-identical to client path (AGG-02 parity test), hashed audit row (AGG-05), auto-routed at >1000-patient threshold; shared/ module extraction with full backward-compat shims
- **New outcome metrics (Phase 13):** CRT trajectory (LOINC LP267955-5, µm units), treatment-interval histogram (6 fixed bins, median annotation), responder classification (configurable ETDRS threshold, ±180-day year-1 window), metric selector tab strip with `?metric=` deep-link, per-metric CSV export, 60 metrics* i18n keys (DE+EN) with completeness test

**Known gaps (accepted):**
- VQA-02 dark-mode contrast: deferred — no dark-mode infrastructure in codebase
- metricSelector integration tests: `describe.skip` — require full router context; accepted for now

---

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
