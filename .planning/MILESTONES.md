# Milestones

## v1.8 Session Resilience & Test/Code Polish (Shipped: 2026-04-23)

**Phases completed:** 3 phases, 8 plans, 11 tasks

**Key accomplishments:**

- Shared test helper `tests/helpers/renderOutcomesView.tsx` extracted from OutcomesViewRouting.test.tsx; 7 existing tests migrated to consume the helper with zero behaviour change; 14-symbol export surface in place for Plan 02 consumption.
- 5 previously-skipped metric-selector tests unskipped + migrated onto shared helper; 4 new keyboard navigation tests added (MSEL-05); duplicate .ts file deleted; all 9 tests green
- One-liner:
- One-liner:
- 1. [Rule 1 — Test Bug] Within-second iat collision in rotation test
- Migrated call sites:
- Files:
- TDD RED → GREEN.

---

## v1.7 Security, Performance & Cross-Cohort (Shipped: 2026-04-21)

**Phases completed:** 4 phases (14–17), 16 plans
**Timeline:** 2026-04-17 → 2026-04-21

**Key accomplishments:**

- **Security hardening (Phase 14):** JWT algorithm pin (HS256 only), cohort hash secret auto-generation, forced password change on default credential, ARIA chart labels
- **TOTP 2FA (Phase 15):** Per-user TOTP enrollment with QR code, ±1 window tolerance, recovery codes, admin reset
- **Cross-cohort comparison (Phase 16):** Overlay up to 4 saved cohorts on a single trajectory chart; `?cohorts=` URL param; spaghetti-plot visual hierarchy (VIS-04); COHORT_PALETTES (4-color WCAG set)
- **Audit log + dark mode (Phase 17):** Multi-dimension audit filters (user, category, date range, body search, failures-only); ThemeContext/ThemeToggle; DARK_EYE_COLORS WCAG 4.5:1; FOUC prevention; `@variant dark` Tailwind v4 class-based dark mode

**Deferred to future milestone:**

- Phase 18 (Keycloak OIDC Redirect, KEYCLK-01) — requires real Keycloak instance; infrastructure prepared in Phase 6 (v1.0)

---

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
