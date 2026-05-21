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
| v1.10 | Session Hardening & UX Closure | 2026-05-21 | 27–31 | [`milestones/v1.10-ROADMAP.md`](milestones/v1.10-ROADMAP.md) |

> Note: v1.2–v1.4 shipped between v1.1 and v1.5 but were not tracked in GSD artifacts; git history is authoritative for those releases.
> Note: v1.9.3 and v1.9.4 were partially executed; deferred plans (FB-02, FB-03, TERM-04) shipped in v1.10.

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

<details>
<summary>✅ v1.10 Session Hardening & UX Closure (Phases 27–31) — SHIPPED 2026-05-21</summary>

- [x] **Phase 27: Stateful Session Backend** — Persistent SQLite `refresh_sessions` table, OAuth2-style jti rotation with RFC 6819 family revocation, dual-key signing-key rotation + `POST /api/auth/rotate-key` (SESS-02/03/04) — completed 2026-05-11
- [x] **Phase 28: Admin Session Control UI** — Per-user active-session listing, individual + sign-out-everywhere revocation, in-UI TTL config persisted to settings.yaml (SESS-01, SESSUI-01/02/03) — completed 2026-05-14
- [x] **Phase 29: Home Panel UX** — Review buttons → pre-filtered quality deep-links (`?therapy=breaker`, `?status=flagged`); client-side recent-activity store + `useRecentActivity` powering "Jump Back In", cleared on logout/cross-tab (UX-01/02) — completed 2026-05-21
- [x] **Phase 30: Terminology Configuration Docs (cleanup)** — Corrected `terminology.serverUrl` default-vs-placeholder wording; verified commented offline-by-default block (TERM-01/02) — completed 2026-05-21
- [x] **Phase 31: Subcohort Support** — `ParentName:Sub` convention, `cohortNames.ts` validation, tree-grouped CohortCompareDrawer picker, Split affordance in cohort builder (KOH-003/004) — completed 2026-05-21

Full phase details: [`milestones/v1.10-ROADMAP.md`](milestones/v1.10-ROADMAP.md)
Audit: tech_debt (no functional gaps) — [`milestones/v1.10-MILESTONE-AUDIT.md`](milestones/v1.10-MILESTONE-AUDIT.md)

</details>

---

*Last updated: 2026-05-21 — v1.10 shipped and archived. Next milestone TBD via `/gsd-new-milestone`.*
