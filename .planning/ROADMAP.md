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

> Phase 18 (Keycloak OIDC Redirect) deferred — carries to v1.8.

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

## Active Milestone: v1.8 — TBD

Scope to be defined via `/gsd-new-milestone`. Carry-over candidates from v1.7:

- **KEYCLK-01** — Real Keycloak OIDC redirect flow (Phase 18 deferred; blocked at initAuth until redirect flow ships)
- **M6** — JWT refresh flow (10-min session hard cap still forces re-login)
- **L4** — AuditPage useReducer refactor
- metricSelector integration tests (requires full router context)

---

*Last updated: 2026-04-21 — v1.7 archived (phases 14–17). v1.8 scope TBD.*
