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

## v1.11 — UAT Fixes, Data Completeness & Quality Closure

**Started:** 2026-05-21
**Scope:** UAT-driven feature requests (user management hardening, auth UX, cohort builder UX, data completeness), V&V backfill for Phases 27–31, and an adversarial CODEX architecture review with compaction.

### Phases

- [ ] **Phase 32: User Management & Auth Hardening** — Enforce validation in create/edit user dialogs; add user activation/deactivation with session revocation; surface lockout feedback, live inactivity countdown, and settings.yaml-sourced auth constants
- [ ] **Phase 33: Cohort Builder UX** — Plausibility checks on age/Visus/CRT bounds; persistent filter state with reset; issue-based cohort presets (Therapie-Abbrecher, Unplausible CRT, Flagged, Implausible Visus); advanced filter dialog (spike-then-build); dashboard Review buttons routing correctly
- [ ] **Phase 34: Data Completeness** — Patient stub + Consent model for Datenvollzähligkeit (consented fraction), with strict stub isolation from clinical surfaces
- [ ] **Phase 35: V&V Backfill** — VERIFICATION.md for Phases 27 & 28; VALIDATION.md brought to nyquist_compliant/wave_0_complete for Phases 27/28/29; Phase 31 and all v1.10 VALIDATION status flipped to final
- [ ] **Phase 36: Architecture Review & Compaction** — Adversarial CODEX full-codebase review producing severity-classified findings; prioritized compaction plan; approved remediations applied with green test:ci + clean knip + lint; final milestone-integrity gate

### Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 32. User Management & Auth Hardening | 0/? | Not started | - |
| 33. Cohort Builder UX & Advanced Filters | 0/? | Not started | - |
| 34. Data Completeness (Consent + Stubs) | 0/? | Not started | - |
| 35. V&V Backfill | 0/? | Not started | - |
| 36. Architecture Review & Compaction | 0/? | Not started | - |

### Phase Details

#### Phase 32: User Management & Auth Hardening
**Goal**: Admins can reliably manage users with complete validation, and users experience precise auth feedback driven entirely by configurable server-side constants.
**Depends on**: Phase 31 (baseline)
**Requirements**: UMGMT-01, UMGMT-02, UMGMT-03, AUTHCFG-01, AUTHCFG-02, AUTHCFG-03, AUTHCFG-04
**Success Criteria** (what must be TRUE):
  1. Admin cannot save a user (create or edit) without at least one assigned center; inline error shown for all empty mandatory fields in both dialogs
  2. Admin can deactivate a user, after which the user cannot log in and all their existing sessions are immediately revoked
  3. After a failed login attempt, the login page shows the exact number of remaining attempts; the lockout screen shows the remaining lockout duration counting down
  4. The inactivity warning banner displays a live countdown to logout, beginning 3 minutes before the session expires
  5. `INACTIVITY_TIMEOUT`, `WARNING_BEFORE`, `maxLoginAttempts`, and lockout duration are read from `config/settings.yaml` — no hardcoded values remain in `src/context/AuthContext.tsx` or `server/initAuth.ts`
**Plans**: 2 plans
  - [ ] 32-01-PLAN.md — Activation lifecycle + admin dialog validation (UMGMT-01/02/03)
  - [ ] 32-02-PLAN.md — Auth feedback + config externalization (AUTHCFG-01/02/03/04)
**UI hint**: yes

#### Phase 33: Cohort Builder UX & Advanced Filters
**Goal**: Users can build cohorts with validated numeric inputs, have filter state survive navigation, reach clinically meaningful issue cohorts from the dashboard, and filter on additional fields via an advanced dialog.
**Depends on**: Phase 32
**Requirements**: COH-01, COH-02, COH-03, COH-04, DASH-02
**Success Criteria** (what must be TRUE):
  1. Entering a lower age bound above the upper bound, a Visus value outside 0–1, or non-numeric/negative values in age/Visus/CRT fields shows an inline error and blocks saving the cohort
  2. Filter selections persist when the user navigates away and returns to the cohort builder within a session; a "Reset" control clears all filters on demand
  3. Four issue-based presets are available in cohort selection: Therapie-Abbrecher, Unplausible CRT-Werte, Flagged data-quality cases, and Implausible Visus
  4. Dashboard "Attention needed" Review buttons route to the correct pre-filtered cohort or quality view — each button lands where its label promises (DASH-02; destination per button resolved at plan time — L2)
  5. An advanced filter dialog is reachable from the cohort builder; a recorded spike decides full-field vs a curated 5–10 attribute set, and the chosen approach is implemented (COH-04)
**Plans**: TBD
**UI hint**: yes

#### Phase 34: Data Completeness (Consent + Stubs)
**Goal**: The dashboard surfaces the fraction of patients with research consent (Datenvollzähligkeit) via a consent + patient-stub model, with stubs strictly isolated from all clinical surfaces.
**Depends on**: Phase 33
**Requirements**: DASH-01
**Success Criteria** (what must be TRUE):
  1. Synthetic patient bundles contain FHIR Consent resources (research-use policy) for all existing patients; reference bundles (Aachen, Tübingen) have consent added without regeneration of curated data (D-06)
  2. Each synthetic site generates a configurable number of patient stubs (default ~4–5× the consented count) containing only encounter date, gender, and birth year — no clinical detail
  3. The dashboard shows total patient count (consented + stubs), consented count, and the Datenvollzähligkeit fraction; the metric updates correctly when site filter changes
  4. **Stub isolation (H2):** stubs do NOT appear in cohort building, outcomes/trajectories, quality review, case detail, or charts — they affect only the completeness denominator; stubs are site-attributed; FHIR load + >1000-patient aggregation routing show no regression
**Plans**: TBD
**UI hint**: yes

#### Phase 35: V&V Backfill
**Goal**: The formal verification and validation artifacts for Phases 27–31 are complete, giving the milestone a full paper trail. Independent of the feature phases — verification documents v1.10 as shipped.
**Depends on**: Phase 31 (verifies v1.10 as-shipped; not the v1.11 feature phases — H1)
**Requirements**: VVBACK-01, VVBACK-02, VVBACK-03, VVBACK-04
**Note (H1):** all VERIFICATION code references cite the **`v1.10`** git tag, so the paper trail is immune to the UAT changes (Phases 32–34) and the Phase 36 compaction.
**Success Criteria** (what must be TRUE):
  1. `.planning/phases/27/VERIFICATION.md` exists, produced by goal-backward analysis of SESS-02/03/04, with each criterion mapped to concrete code references **at the `v1.10` tag** and passing tests
  2. `.planning/phases/28/VERIFICATION.md` exists, produced by goal-backward analysis of SESS-01 + SESSUI-01/02/03, with each criterion mapped to code references **at the `v1.10` tag** and passing tests
  3. Phases 27, 28, and 29 each have a `VALIDATION.md` with `nyquist_compliant: true` and `wave_0_complete: true`; any coverage gaps are closed by passing tests
  4. Phase 31's `VALIDATION.md` has `wave_0_complete: true`; every v1.10 phase (27–31) `VALIDATION.md` has `status: final`
**Plans**: TBD

#### Phase 36: Architecture Review & Compaction
**Goal**: The codebase has been reviewed adversarially by CODEX, a compaction plan has been executed, and the milestone is closed with a green test suite and updated debt tracking.
**Depends on**: Phase 35
**Requirements**: ARCH-01, ARCH-02, ARCH-03, VVBACK-05
**Success Criteria** (what must be TRUE):
  1. A severity-classified findings report exists at `.planning/reviews/v1.11-arch-review/` covering architecture, separation of concerns, and overall design — produced with CODEX
  2. A prioritized compaction plan exists with concrete file references for each finding (dead code, redundant abstractions, duplicated logic, oversized modules, SoC violations)
  3. All approved compaction remediations are applied: `npm run test:ci` passes (zero failures), `npm run knip` reports no new dead code, `npm run lint` passes, and no behavior regressions are detectable
  4. `npm run test:ci` exits green after all v1.11 work (features, backfill, compaction); STATE.md, PROJECT.md, and MILESTONES.md deferred-debt entries are updated to reflect closure
**Plans**: TBD

---

*Last updated: 2026-05-21 — v1.11 roadmap created (Phases 32–36), then revised per adversarial review: milestone renamed (M2), COH-04 moved to Phase 33 (M1), DASH-01 stub-isolation criteria added (H2), VVBACK verification anchored to the `v1.10` git tag (H1). v1.10 shipped and archived.*
