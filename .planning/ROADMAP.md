# Project Roadmap

**Project:** EyeMatics Clinical Demonstrator (EMD) — Backend Redesign

## Shipped Milestones

| Version | Name | Shipped | Phases | Archive |
|---------|------|---------|--------|---------|
| v1.0 | Foundational Backend (auth, audit, center restriction, Keycloak prep) | (earlier) | 1–6 | [`milestones/v1.0-ROADMAP.md`](milestones/v1.0-ROADMAP.md) |
| v1.1 | Frontend ↔ Backend Wiring | (earlier) | — | [`milestones/v1.1-ROADMAP.md`](milestones/v1.1-ROADMAP.md) |
| v1.5 | Site Roster Correction & Cohort Analytics | 2026-04-15 | 7–9 | [`milestones/v1.5-ROADMAP.md`](milestones/v1.5-ROADMAP.md) |
| v1.6 | Outcomes Polish & Scale | 2026-04-17 | 10–13 | [`milestones/v1.6-ROADMAP.md`](milestones/v1.6-ROADMAP.md) |

> Note: v1.2–v1.4 shipped between v1.1 and v1.5 but were not tracked in GSD artifacts; git history is authoritative for those releases.

<details>
<summary>✅ v1.6 Outcomes Polish & Scale (Phases 10–13) — SHIPPED 2026-04-17</summary>

- [x] **Phase 10: Visual/UX QA & Preview Stability** — WCAG palette, IQR guard, tooltip D-05/D-06, all-eyes-filtered empty state, admin center filter, stable row keys (VQA-01..05, CRREV-02) — completed 2026-04-16
- [x] **Phase 11: Audit Beacon PII Hardening** — HMAC-SHA256 cohort ID hashing, POST beacon with keepalive, hashCohortId reused by AGG-05 (CRREV-01) — completed 2026-04-16
- [x] **Phase 12: Server-Side Outcomes Pre-Aggregation** — `POST /api/outcomes/aggregate`, shared/ module, byte-parity with client, TTL cache, >1000-patient auto-route (AGG-01..05) — completed 2026-04-16
- [x] **Phase 13: New Outcome Metrics (CRT / Interval / Responder)** — 4 metrics, metric selector + `?metric=` deep-link, per-metric CSV, 60 i18n keys (METRIC-01..06) — completed 2026-04-17

Full phase details: [`milestones/v1.6-ROADMAP.md`](milestones/v1.6-ROADMAP.md)

</details>

---

## Active Milestone: v1.7 Security, Performance & Cross-Cohort

**Milestone Goal:** Harden production security (JWT pin, secret auto-generation, forced password change, TOTP 2FA), improve runtime performance (O(N+M) case extraction, startup cache warming), improve accessibility, add cross-cohort comparison, upgrade the audit log UI, add dark-mode infrastructure, and complete the Keycloak OIDC redirect flow.

### Phases

- [ ] **Phase 14: Security Quick Wins & Performance** — JWT algorithm pin, cohort hash secret auto-generation, forced password change on default credential, FHIR bundle cache warming, O(N+M) patient case extraction, ARIA chart labels
- [ ] **Phase 15: TOTP 2FA** — Per-user TOTP enrollment with QR code, ±1 window tolerance, recovery codes
- [ ] **Phase 16: Cross-Cohort Comparison** — Overlay up to 4 saved cohorts on a single trajectory chart, spaghetti-plot visual hierarchy
- [ ] **Phase 17: Audit Log Upgrade & Dark Mode** — Filterable audit controls, dark-mode infrastructure and WCAG-compliant chart palette
- [ ] **Phase 18: Keycloak OIDC Redirect** — Authorization-code + PKCE redirect flow, server-mediated callback, local JWT issuance

### Phase Details

#### Phase 14: Security Quick Wins & Performance
**Goal**: Production deployments are protected against JWT algorithm confusion and weak secrets; runtime performance is improved and all chart containers are accessible
**Depends on**: Phase 13 (v1.6)
**Requirements**: SEC-01, SEC-02, SEC-03, PERF-01, PERF-02, A11Y-01
**Success Criteria** (what must be TRUE):
  1. All `jwt.verify()` call sites in `authMiddleware.ts` and `authApi.ts` pass `{ algorithms: ['HS256'] }` — a token signed with `alg: none` or RS256 is rejected with 401
  2. On a fresh deployment, `data/cohort-hash-secret.txt` is auto-created at startup; the `audit.cohortHashSecret` fallback value in `settings.yaml` is no longer consulted for that field
  3. A user whose record carries the default migrated password `changeme2025!` is redirected to a forced password-change flow on their next login; they cannot access any other route until the change is complete
  4. `extractPatientCases` processes a 7-center bundle via O(N+M) Map pre-grouping; no `.filter()` loops nested over observations/procedures/conditions remain
  5. FHIR bundles for all configured centers are loaded into `_bundleCache` during server startup, before the first HTTP request arrives
  6. Every Recharts trajectory chart container renders an `aria-label` that names the metric, eye side, and cohort patient count
**Plans**: 3 plans

Plans:
- [ ] 14-01-PLAN.md — JWT algorithm pin (SEC-01) + cohort hash secret auto-generation (SEC-02)
- [ ] 14-02-PLAN.md — O(N+M) patient case extraction (PERF-01) + FHIR bundle cache warming (PERF-02)
- [ ] 14-03-PLAN.md — Forced password change enforcement backend + frontend (SEC-03) + ARIA chart labels (A11Y-01)

#### Phase 15: TOTP 2FA
**Goal**: Each user account has its own TOTP secret; the shared static OTP code is retired; users locked out of TOTP have a recovery path
**Depends on**: Phase 14
**Requirements**: SEC-04, SEC-05
**Success Criteria** (what must be TRUE):
  1. A user can enroll TOTP by scanning a QR code in the UI (or entering the manual key); the enrollment is confirmed by entering a valid TOTP code before being activated
  2. After TOTP enrollment, `POST /verify` accepts only a valid RFC 6238 TOTP code (±1 window); the site-wide static `otpCode` from `settings.yaml` is no longer accepted for that user
  3. At enrollment, the user is shown a set of one-time recovery codes; using a valid recovery code against `POST /verify` succeeds exactly once and marks that code as burned in the database
  4. A user who has not yet enrolled TOTP can still authenticate via the existing static OTP fallback (backward-compat transition window)
  5. An admin can reset another user's TOTP enrollment via the admin panel, forcing them back to the pre-enrollment state
**Plans**: TBD

#### Phase 16: Cross-Cohort Comparison
**Goal**: A researcher can overlay up to 4 saved cohorts on a single trajectory chart to compare outcome trends side by side; individual patient curves are visually subordinate to cohort medians
**Depends on**: Phase 13 (v1.6)
**Requirements**: XCOHORT-01, XCOHORT-02, XCOHORT-03, XCOHORT-04, VIS-04
**Success Criteria** (what must be TRUE):
  1. From the outcomes view, the user can open a cohort selector and pick 1–4 saved cohorts; all selected cohorts render as overlapping series on a single `ComposedChart`
  2. Per-patient lines are suppressed by default in cross-cohort mode; each cohort renders a median line and IQR band using its own color from `COHORT_PALETTES` (4-color categorical set, distinct from the OD/OS palette)
  3. The chart legend shows each cohort's display name and patient count in the format `Cohort A (N=42 patients)`
  4. The URL updates to `?cohorts=id1,id2,...` and loading that URL restores the same cross-cohort selection without user interaction
  5. In single-cohort mode, individual patient curves are rendered at reduced opacity and desaturated color; the median line is overplotted with increased stroke weight and full saturation
**Plans**: TBD
**UI hint**: yes

#### Phase 17: Audit Log Upgrade & Dark Mode
**Goal**: Administrators can filter and search the audit log by multiple dimensions; all users can switch between light, dark, and system color themes with WCAG-compliant chart colors in both modes
**Depends on**: Phase 14
**Requirements**: AUDIT-01, VIS-01, VIS-02, VIS-03
**Success Criteria** (what must be TRUE):
  1. The audit log page has a user dropdown, an action-category filter (Auth / Data / Admin / Outcomes), a date-range picker, a cohort-hash text search field, and a failures-only toggle; applying any filter updates the displayed log without a page reload
  2. A sun/moon toggle in the Layout header switches the application between Light, Dark, and System modes; the `dark` CSS class is applied to `<html>` and all Tailwind `dark:` variants take effect
  3. All Recharts trajectory chart internals (axis labels, tick text, grid lines) use explicit color values from a `useTheme()` hook rather than Tailwind class strings, so they render correctly in dark mode
  4. `DARK_EYE_COLORS` in `palette.ts` passes WCAG 4.5:1 contrast against the dark background (`#111827`); a contrast-ratio test in the test suite asserts this automatically
  5. Theme preference survives page reload (stored in `localStorage`); when set to System, the preference tracks `prefers-color-scheme` media query changes; there is no flash of unstyled content on load
**Plans**: TBD
**UI hint**: yes

#### Phase 18: Keycloak OIDC Redirect
**Goal**: Deployments configured with `provider: keycloak` in `settings.yaml` have a fully functional browser-redirect login flow; the frontend receives the same JWT shape regardless of auth provider
**Depends on**: Phase 14, Phase 15
**Requirements**: KEYCLK-01
**Success Criteria** (what must be TRUE):
  1. Clicking "Login with Keycloak" on the login page redirects the browser to the Keycloak authorization endpoint with a valid PKCE `code_challenge`
  2. After Keycloak authentication, the browser is redirected back to `/api/auth/keycloak/callback`; the server completes the authorization-code exchange, validates the ID token, and issues an EMD HS256 JWT with the standard `AuthPayload` shape (`sub`, `preferred_username`, `role`, `centers`)
  3. The PKCE `code_verifier` and OIDC `state` parameter are stored server-side in a signed HttpOnly cookie and never exposed to client JavaScript
  4. The React frontend's existing `AuthContext` receives the EMD JWT without modification — no frontend code change is required for a Keycloak login vs. a local login
**Plans**: TBD

### Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 14. Security Quick Wins & Performance | v1.7 | 0/3 | Not started | - |
| 15. TOTP 2FA | v1.7 | 0/TBD | Not started | - |
| 16. Cross-Cohort Comparison | v1.7 | 0/TBD | Not started | - |
| 17. Audit Log Upgrade & Dark Mode | v1.7 | 0/TBD | Not started | - |
| 18. Keycloak OIDC Redirect | v1.7 | 0/TBD | Not started | - |

---

*Last updated: 2026-04-17 — Phase 14 planned (3 plans, 2 waves). Continues from v1.6 (Phases 10–13).*
