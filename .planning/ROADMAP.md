# Project Roadmap

**Project:** EyeMatics Clinical Demonstrator (EMD) — Backend Redesign

## Shipped Milestones

| Version | Name | Shipped | Phases | Archive |
|---------|------|---------|--------|---------|
| v1.0 | Foundational Backend (auth, audit, site restriction, Keycloak prep) | (earlier) | 1–6 | [`milestones/v1.0-ROADMAP.md`](milestones/v1.0-ROADMAP.md) |
| v1.1 | Frontend ↔ Backend Wiring | (earlier) | — | [`milestones/v1.1-ROADMAP.md`](milestones/v1.1-ROADMAP.md) |
| v1.5 | Site Roster Correction & Cohort Analytics | 2026-04-15 | 7–9 | [`milestones/v1.5-ROADMAP.md`](milestones/v1.5-ROADMAP.md) |
| v1.6 | Outcomes Polish & Scale | 2026-04-17 | 10–13 | [`milestones/v1.6-ROADMAP.md`](milestones/v1.6-ROADMAP.md) |
| v1.7 | Security, Performance & Cross-Cohort | 2026-04-21 | 14–17 | [`milestones/v1.7-ROADMAP.md`](milestones/v1.7-ROADMAP.md) |
| v1.8 | Session Resilience & Test/Code Polish | 2026-04-23 | 18–20 | [`milestones/v1.8-ROADMAP.md`](milestones/v1.8-ROADMAP.md) |
| v1.9 | Codebase Consistency & Test/Tech-Debt Polish | 2026-04-23 | 21–23 | (in-tree, see below) |
| v1.9.3 | Production Feedback Fixes (partial) | 2026-04-28 | 24 (2/4 plans) | (in-tree) |
| v1.9.4 | Terminology Resolver Refactor (partial) | 2026-04-30 | 25 (3/4 plans) | (in-tree) |
| v1.9.5 | Synthetic Data Realism | 2026-05-01 | 26 | [`milestones/v1.9.5-ROADMAP.md`](milestones/v1.9.5-ROADMAP.md) |

> Note: v1.2–v1.4 shipped between v1.1 and v1.5 but were not tracked in GSD artifacts; git history is authoritative for those releases.
> Note: v1.9.3 and v1.9.4 were partially executed; deferred plans (FB-02, FB-03, TERM-04) are folded into v1.10.

<details>
<summary>✅ v1.9.5 Synthetic Data Realism (Phase 26) — SHIPPED 2026-05-01</summary>

- [x] **Phase 26: Synthetic Data Realism** — Seed extension + comorbidity model + HbA1c/age-disease coupling + bundle regeneration (SYNTH-01..04) (completed 2026-05-01)

Full phase details: [`milestones/v1.9.5-ROADMAP.md`](milestones/v1.9.5-ROADMAP.md)

</details>

<details>
<summary>✅ v1.8 Session Resilience & Test/Code Polish (Phases 18–20) — SHIPPED 2026-04-23</summary>

- [x] **Phase 18: metricSelector Test Harness Unblock** — Unskip 5 placeholder metricSelector tests + shared `renderOutcomesView` helper (MSEL-01..06) — completed 2026-04-23
- [x] **Phase 19: AuditPage State Machine Refactor** — useReducer-driven AuditPage with characterization tests landed first (AUDIT-01..04) — completed 2026-04-23
- [x] **Phase 20: JWT Refresh Flow & Session Resilience** — Access/refresh token split, silent `authFetch` refresh, BroadcastChannel cross-tab coordination, credential-mutation invalidation (SESSION-01..09, 12, 13) — completed 2026-04-23

Full phase details: [`milestones/v1.8-ROADMAP.md`](milestones/v1.8-ROADMAP.md)

</details>

<details>
<summary>✅ v1.7 Security, Performance & Cross-Cohort (Phases 14–17) — SHIPPED 2026-04-21</summary>

- [x] **Phase 14: Security Quick Wins & Performance** — JWT algorithm pin (HS256), cohort hash secret auto-generation, forced password change, O(N+M) case extraction, FHIR bundle cache warming, ARIA chart labels (SEC-01..03, PERF-01..02, A11Y-01) — completed 2026-04-17
- [x] **Phase 15: TOTP 2FA** — Per-user TOTP enrollment with QR code + recovery codes + admin reset; RFC 6238 ±1-window (SEC-04..05) — completed 2026-04-21
- [x] **Phase 16: Cross-Cohort Comparison** — 1–4 cohort overlay, `?cohorts=` deep-link, COHORT_PALETTES, VIS-04 spaghetti-plot hierarchy (XCOHORT-01..04, VIS-04) — completed 2026-04-21
- [x] **Phase 17: Audit Log Upgrade & Dark Mode** — Multi-dim audit filters, Light/Dark/System ThemeContext, DARK_EYE_COLORS WCAG 4.5:1, Tailwind v4 `@variant dark` (AUDIT-01, VIS-01..03) — completed 2026-04-21

Full phase details: [`milestones/v1.7-ROADMAP.md`](milestones/v1.7-ROADMAP.md)

</details>

<details>
<summary>✅ v1.6 Outcomes Polish & Scale (Phases 10–13) — SHIPPED 2026-04-17</summary>

- [x] **Phase 10: Visual/UX QA & Preview Stability** — WCAG palette, IQR guard, tooltip D-05/D-06, all-eyes-filtered empty state, admin site filter, stable row keys (VQA-01..05, CRREV-02) — completed 2026-04-16
- [x] **Phase 11: Audit Beacon PII Hardening** — HMAC-SHA256 cohort ID hashing, POST beacon with keepalive, hashCohortId reused by AGG-05 (CRREV-01) — completed 2026-04-16
- [x] **Phase 12: Server-Side Outcomes Pre-Aggregation** — `POST /api/outcomes/aggregate`, shared/ module, byte-parity with client, TTL cache, >1000-patient auto-route (AGG-01..05) — completed 2026-04-16
- [x] **Phase 13: New Outcome Metrics (CRT / Interval / Responder)** — 4 metrics, metric selector + `?metric=` deep-link, per-metric CSV, 60 i18n keys (METRIC-01..06) — completed 2026-04-17

Full phase details: [`milestones/v1.6-ROADMAP.md`](milestones/v1.6-ROADMAP.md)

</details>

---

## Active Milestone: v1.10 — Session Hardening & UX Closure

**Goal:** Close all long-deferred session management, home panel UX, and terminology documentation items.

## Phases

- [ ] **Phase 27: Stateful Session Backend** — Server-side refresh-sessions table, OAuth2-style token rotation, and signing-key rotation
- [ ] **Phase 28: Admin Session Control UI** — Force sign-out, per-device session listing + individual revocation, TTL configuration UI
- [ ] **Phase 29: Home Panel UX** — Wire "Attention needed" Review buttons and "Jump Back In" panel routing
- [ ] **Phase 30: Terminology Configuration Docs** — Document terminology settings keys in settings.yaml and Konfiguration.md

## Phase Details

### Phase 27: Stateful Session Backend
**Goal**: The server tracks every issued refresh token in a persistent table and invalidates tokens correctly on rotation and key change
**Depends on**: Nothing (server-side only; builds on existing refresh cookie infrastructure from Phase 20)
**Requirements**: SESS-02, SESS-03, SESS-04
**Success Criteria** (what must be TRUE):
  1. A new `refresh_sessions` table (or JSON equivalent) is created at server startup with one row per issued refresh token, storing user, device fingerprint, issued-at, expires-at, and revoked flag
  2. When a client uses a refresh token, the server issues a new token and immediately marks the previous row as revoked — presenting the old token a second time returns 401
  3. When an admin rotates the signing key, existing sessions continue to refresh until their absolute cap expires, then expire gracefully rather than returning 500 or a crash
  4. All session-table operations are covered by automated tests that assert row state after rotation and reuse attempts
**Plans**: TBD

### Phase 28: Admin Session Control UI
**Goal**: Admins can see every active session for any user and end sessions — individually or all at once — and can adjust session TTL values without touching config files
**Depends on**: Phase 27
**Requirements**: SESS-01, SESSUI-01, SESSUI-02, SESSUI-03
**Success Criteria** (what must be TRUE):
  1. The admin UI lists all active sessions for a selected user, showing device fingerprint, issued-at, last-used, and expires-at columns
  2. An admin can revoke any individual session from the listing — the revoked session's next API call returns 401 and the frontend redirects to login
  3. An admin can trigger "sign out everywhere" for a user — all that user's sessions are revoked immediately and their next request returns 401
  4. An admin can view and save `refreshTokenTtlMs` and `refreshAbsoluteCapMs` values from the admin UI; the values persist to `config/settings.yaml` and take effect on the next issued token
**Plans**: TBD
**UI hint**: yes

### Phase 29: Home Panel UX
**Goal**: Users can act on home-panel alerts and return to recent work with a single click
**Depends on**: Nothing (independent UI wiring; no new backend required)
**Requirements**: UX-01, UX-02
**Success Criteria** (what must be TRUE):
  1. Each "Review" button in the "Attention needed" panel navigates the user directly to the relevant case or review target — no dead-end buttons or console errors
  2. Each arrow in the "Jump Back In" panel routes to the last-visited view for that patient/case — navigating to a patient with no prior visit shows an appropriate empty state rather than an error
**Plans**: TBD
**UI hint**: yes

### Phase 30: Terminology Configuration Docs
**Goal**: Any operator can configure the terminology service by reading the shipped settings file and its documentation — no source-code archaeology required
**Depends on**: Nothing (documentation only)
**Requirements**: TERM-01, TERM-02
**Success Criteria** (what must be TRUE):
  1. `config/settings.yaml` contains a `terminology` block with `enabled`, `serverUrl`, and `cacheTtlMs` keys, each with an inline comment explaining its purpose and default value
  2. `docs/Konfiguration.md` has a "Terminology Service" section documenting all three keys with valid value examples and the behavior when the service is disabled
**Plans**: TBD

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 27. Stateful Session Backend | 0/? | Not started | - |
| 28. Admin Session Control UI | 0/? | Not started | - |
| 29. Home Panel UX | 0/? | Not started | - |
| 30. Terminology Configuration Docs | 0/? | Not started | - |

---

*Last updated: 2026-05-01 — v1.10 roadmap created (Session Hardening & UX Closure, Phases 27–30).*
