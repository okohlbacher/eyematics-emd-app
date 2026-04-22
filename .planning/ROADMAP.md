# Project Roadmap

**Project:** EyeMatics Clinical Demonstrator (EMD) — Backend Redesign

## Shipped Milestones

| Version | Name | Shipped | Phases | Archive |
|---------|------|---------|--------|---------|
| v1.0 | Foundational Backend (auth, audit, center restriction, Keycloak prep) | (earlier) | 1–6 | [`milestones/v1.0-ROADMAP.md`](milestones/v1.0-ROADMAP.md) |
| v1.1 | Frontend ↔ Backend Wiring | (earlier) | — | [`milestones/v1.1-ROADMAP.md`](milestones/v1.1-ROADMAP.md) |
| v1.5 | Site Roster Correction & Cohort Analytics | 2026-04-15 | 7–9 | [`milestones/v1.5-ROADMAP.md`](milestones/v1.5-ROADMAP.md) |
| v1.6 | Outcomes Polish & Scale | 2026-04-17 | 10–13 | [`milestones/v1.6-ROADMAP.md`](milestones/v1.6-ROADMAP.md) |
| v1.7 | Security, Performance & Cross-Cohort | 2026-04-21 | 14–17 | [`milestones/v1.7-ROADMAP.md`](milestones/v1.7-ROADMAP.md) |

> Note: v1.2–v1.4 shipped between v1.1 and v1.5 but were not tracked in GSD artifacts; git history is authoritative for those releases.

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

- [x] **Phase 10: Visual/UX QA & Preview Stability** — WCAG palette, IQR guard, tooltip D-05/D-06, all-eyes-filtered empty state, admin center filter, stable row keys (VQA-01..05, CRREV-02) — completed 2026-04-16
- [x] **Phase 11: Audit Beacon PII Hardening** — HMAC-SHA256 cohort ID hashing, POST beacon with keepalive, hashCohortId reused by AGG-05 (CRREV-01) — completed 2026-04-16
- [x] **Phase 12: Server-Side Outcomes Pre-Aggregation** — `POST /api/outcomes/aggregate`, shared/ module, byte-parity with client, TTL cache, >1000-patient auto-route (AGG-01..05) — completed 2026-04-16
- [x] **Phase 13: New Outcome Metrics (CRT / Interval / Responder)** — 4 metrics, metric selector + `?metric=` deep-link, per-metric CSV, 60 i18n keys (METRIC-01..06) — completed 2026-04-17

Full phase details: [`milestones/v1.6-ROADMAP.md`](milestones/v1.6-ROADMAP.md)

</details>

---

## Active Milestone: v1.8 — Session Resilience & Test/Code Polish

**Goal:** Remove the 10-min re-login friction and pay down targeted v1.7 tech debt (AuditPage refactor, metricSelector test coverage).
**Granularity:** standard (derived from scope)
**Coverage:** 21/21 v1.8 requirements mapped
**Starting phase number:** 18 (continues v1.7's Phase 17)

### Phases

- [ ] **Phase 18: metricSelector Test Harness Unblock** — Unskip the 5 placeholder metricSelector tests and extract a shared OutcomesView render helper
- [ ] **Phase 19: AuditPage State Machine Refactor** — Migrate AuditPage to a useReducer-driven state machine with characterization tests landing first
- [ ] **Phase 20: JWT Refresh Flow & Session Resilience** — Ship access/refresh token split, silent refresh in authFetch, cross-tab coordination, credential-mutation invalidation, and audit/i18n wiring

### Phase Details

#### Phase 18: metricSelector Test Harness Unblock
**Goal**: Developers can rely on automated coverage for the metric selector's deep-link, fallback, and keyboard-navigation behavior
**Depends on**: Nothing (independent, lowest-risk lead-off)
**Requirements**: MSEL-01, MSEL-02, MSEL-03, MSEL-04, MSEL-05, MSEL-06
**Success Criteria** (what must be TRUE):
  1. All 5 previously `describe.skip` cases in `tests/metricSelector.test.tsx` are active and passing in CI
  2. A `?metric=X` URL renders the matching tab selected, and clicking a different tab updates the URL (round-trip verified)
  3. Unknown metric slugs (e.g. `?metric=bogus`) render the default metric without runtime errors
  4. Browser back/forward navigation through MemoryRouter restores the previous metric selection, and keyboard arrow-key tab cycling is regression-tested
  5. Both `OutcomesViewRouting.test.tsx` and `metricSelector.test.tsx` consume a single shared `tests/helpers/renderOutcomesView.tsx` factory (7 `vi.mock` blocks + MemoryRouter)
**Plans**: TBD

#### Phase 19: AuditPage State Machine Refactor
**Goal**: AuditPage state is driven by a reducer-based state machine with behavior byte-identical to v1.7 and verifiable via pure unit tests
**Depends on**: Phase 18 (independent at the code level, but sequenced before Phase 20 to avoid `describeAction` merge conflict in AuditPage.tsx)
**Requirements**: AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04
**Success Criteria** (what must be TRUE):
  1. Admin viewing the audit log sees byte-identical behavior to v1.7: 6-dim filter, 300ms debounce, cancel-on-unmount, admin-gated controls, 4 render states, CSV/JSON export
  2. Characterization tests capturing the pre-refactor AuditPage behavior are committed BEFORE the reducer swap (separate commit) and remain green after
  3. AuditPage is split into `src/pages/audit/auditPageState.ts` (reducer + selectors), `auditFormatters.ts` (describeAction, describeDetail, isRelevantEntry, statusBadgeClass), and `useAuditData.ts` (hook wrapping reducer + debounced fetch); `AuditPage.tsx` is pure render
  4. `tests/auditPageReducer.test.ts` exercises all 5 discriminated-union action paths (`FILTER_SET`, `FILTERS_RESET`, `FETCH_START`, `FETCH_SUCCESS`, `FETCH_ERROR`) plus the `requestEpoch` stale-response guard
**Plans**: TBD
**UI hint**: yes

#### Phase 20: JWT Refresh Flow & Session Resilience
**Goal**: Active users stay logged in beyond the 10-min access-token boundary without any session-expiry UX, while absolute session caps and credential-mutation invalidation preserve v1.7's security posture
**Depends on**: Phase 19 (SESSION-13 extends the `describeAction` mapping that Phase 19 relocates to `auditFormatters.ts`)
**Requirements**: SESSION-01, SESSION-02, SESSION-03, SESSION-04, SESSION-05, SESSION-06, SESSION-07, SESSION-08, SESSION-09, SESSION-12, SESSION-13
**Success Criteria** (what must be TRUE):
  1. An active user working across the 10-min access-token boundary continues making API calls with no re-login prompt; `authFetch` silently refreshes on 401 and retries the original request once (single-flight lock, retry guard prevents loops)
  2. The 10-min idle auto-logout still fires when the user is idle, and an absolute session cap (configurable `auth.refreshTokenTtlMs` / `auth.refreshAbsoluteCapMs`, defaults 8h / 12h) forces re-auth after the cap regardless of activity
  3. After an admin resets a user's password or TOTP, or the user changes their own password/TOTP, any outstanding refresh token for that user is rejected on next use (`tokenVersion` / `passwordChangedAt` / `totpChangedAt` bumped in `data/users.json`)
  4. Refresh tokens are delivered as httpOnly `Secure` `SameSite=Strict` cookies scoped to `/api/auth/refresh` with CSRF protection; access tokens remain Bearer-in-memory; `POST /api/auth/logout` clears both server-side refresh state (cookie + tokenVersion bump) and the client invalidates both tokens
  5. Multiple open tabs coordinate via `BroadcastChannel('emd-auth')` so only one refresh fires at a time (5-second server grace window); successful refreshes are excluded from `audit.db` via `SKIP_AUDIT_PATHS` while failed refreshes and logout events are still audited with new DE+EN `audit_action_refresh` / `audit_action_logout` i18n keys
  6. All `jwt.verify()` call sites route through `server/jwtUtil.ts` with hard-pinned `algorithms: ['HS256']`; ESLint `no-restricted-imports` forbids direct `jsonwebtoken` verify imports elsewhere
**Plans**: TBD

### Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 18. metricSelector Test Harness Unblock | 0/0 | Not started | - |
| 19. AuditPage State Machine Refactor | 0/0 | Not started | - |
| 20. JWT Refresh Flow & Session Resilience | 0/0 | Not started | - |

### Coverage Map

| Requirement | Phase |
|-------------|-------|
| MSEL-01 | Phase 18 |
| MSEL-02 | Phase 18 |
| MSEL-03 | Phase 18 |
| MSEL-04 | Phase 18 |
| MSEL-05 | Phase 18 |
| MSEL-06 | Phase 18 |
| AUDIT-01 | Phase 19 |
| AUDIT-02 | Phase 19 |
| AUDIT-03 | Phase 19 |
| AUDIT-04 | Phase 19 |
| SESSION-01 | Phase 20 |
| SESSION-02 | Phase 20 |
| SESSION-03 | Phase 20 |
| SESSION-04 | Phase 20 |
| SESSION-05 | Phase 20 |
| SESSION-06 | Phase 20 |
| SESSION-07 | Phase 20 |
| SESSION-08 | Phase 20 |
| SESSION-09 | Phase 20 |
| SESSION-12 | Phase 20 |
| SESSION-13 | Phase 20 |

**Coverage:** 21/21 v1.8 requirements mapped. SESSION-10, SESSION-11, and KEYCLK-01 are explicitly out of scope per REQUIREMENTS.md.

---

*Last updated: 2026-04-22 — v1.8 roadmap created (Phases 18–20).*
