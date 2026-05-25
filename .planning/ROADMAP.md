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
| v1.11 | UAT Fixes, Data Completeness & Quality Closure | 2026-05-24 | 32–36 | [`milestones/v1.11-ROADMAP.md`](milestones/v1.11-ROADMAP.md) |

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

<details>
<summary>✅ v1.11 UAT Fixes, Data Completeness & Quality Closure (Phases 32–36) — SHIPPED 2026-05-24</summary>

- [x] **Phase 32: User Management & Auth Hardening** — Create/edit-user validation, activation/deactivation + session revocation, lockout feedback, live inactivity countdown, settings.yaml-sourced auth constants (UMGMT-01/02/03, AUTHCFG-01/02/03/04) — completed 2026-05-21
- [x] **Phase 33: Cohort Builder UX & Advanced Filters** — Age/Visus/CRT plausibility validation, sessionStorage filter persistence + reset, 4 issue-based presets, advanced filter dialog, dashboard Review-button routing (COH-01/02/03/04, DASH-02) — completed 2026-05-22
- [x] **Phase 34: Data Completeness** — FHIR Consent + patient stubs across 6 bundles, single-chokepoint stub isolation (H2), Datenvollzähligkeit dashboard card (DASH-01) — completed 2026-05-24
- [x] **Phase 35: V&V Backfill** — 27/28 VERIFICATION.md (v1.10-anchored); all v1.10 VALIDATION.md → nyquist_compliant/wave_0_complete/final (VVBACK-01/02/03/04) — completed 2026-05-24
- [x] **Phase 36: Architecture Review & Compaction** — CODEX adversarial review (15 findings) + Tier A/B compaction (net −747 LOC), gates green, debt tracking closed (ARCH-01/02/03, VVBACK-05) — completed 2026-05-24

Full phase details: [`milestones/v1.11-ROADMAP.md`](milestones/v1.11-ROADMAP.md)
Audit: tech_debt (22/22 reqs, integration verified) — [`milestones/v1.11-MILESTONE-AUDIT.md`](milestones/v1.11-MILESTONE-AUDIT.md)
Deferred to v1.12: CODEX Tier C (F-01/02/03/09/10/13) + Phase 33 advisory UAT — see STATE.md Deferred Items.

</details>

---

## Active Milestone: v1.12 — Quality, Configurability & Analysis Depth (Phases 37–45)

**Locked decisions (2026-05-25):** D1 global admin thresholds · D1b plausibility ranges centralized + admin-editable · D2 QUAL-001 persists with SavedSearch (couples SEC-06/F-13 into Phase 40) · D3 multi-select centers IN · PROT-001 → `'unauthenticated'` · single milestone (no v1.12/v1.13 split).

### Phases

- [x] **Phase 37: UAT Re-test & Spec Lock** — Re-verify the 12 v1.11 fixes; capture per-phase open decisions; lock v1.12 REQ-IDs and acceptance criteria *(process/feedback — no production code)* (completed 2026-05-25)
- [x] **Phase 38: Audit Actor Correctness** — Replace `'anonymous'` with `'unauthenticated'` in audit log for 401/unauth requests; keep immutable historical actors for deleted users (AUDIT-01) (completed 2026-05-25)
- [x] **Phase 39: Configurable Clinical Thresholds + Server/Client Parity** — Move critical/action thresholds and plausibility ranges to `settings.yaml`; expose admin UI in SettingsPage; enforce server/client parity in aggregation (CFG-01, CFG-02, CFG-03) (completed 2026-05-25)
- [ ] **Phase 40: SavedSearch Hardening + Quality Check Configuration** — Server-side SavedSearch provenance (id/createdAt generated server-side, filters sanitized at API boundary); cohort-scoped configurable quality check parameters persisted with the saved cohort (SEC-06, QUAL-020, QUAL-021)
- [ ] **Phase 41: Doc-Quality Correctness, Multi-Select Centers & UX** — Time-filtered Grundgesamtheit denominator; absolute-count discoverability; multi-select center filter (D3, shared with Phase 42); repositioned approve/flag dropdown (QUAL-022, QUAL-023, QUAL-024, QUAL-025)
- [ ] **Phase 42: Analysis Cohort Comparison & Labeling** — Cohort labels on all comparison plots; Aggregated-tab cohort comparison (diagnosis distribution, age-vs-Visus); active cohort name on `?filters=` direct-load (ANL-010, ANL-011, ANL-012)
- [ ] **Phase 43: Case Navigation, Reference & Chart Clarity** — Chart-point → case-detail drill-down; cohort reference overlay in case view; self-explanatory CRT/Visus chart labels; axis-tick and responder-tooltip polish (FALL-010, FALL-011, FALL-012, CHART-01)
- [ ] **Phase 44: Tech-Debt Compaction** — Behavior-preserving: split `authApi.ts` God module; decompose `OutcomesView.tsx`; all gates (test:ci, knip, lint) green with no behavior change (TECH-01, TECH-02)
- [ ] **Phase 45: UAT Validation & Milestone Close** — Consolidated human UAT across all v1.12 changes; audit and close milestone *(process/feedback — no production code)*

---

## Phase Details

### Phase 37: UAT Re-test & Spec Lock
**Goal**: Verify that the 12 issues claimed fixed by v1.11 are actually resolved, capture small per-phase open decisions, and lock the v1.12 requirement set.
**Type**: process/feedback — no production code delivered
**Depends on**: Nothing (opens the milestone)
**Requirements**: None (process phase)
**Success Criteria** (what must be TRUE):
  1. Each of the 12 v1.11 fixes has been re-tested in a running build and the outcome (pass / regressed / missed intent) is recorded.
  2. Per-phase open decisions are resolved and written down: FALL-003 label wording, FALL-001 drill-down interaction, responder-tooltip placement, A-06 screenshot repro, QUAL-011 absolute-value placement.
  3. The v1.12 REQUIREMENTS.md REQ-IDs and acceptance criteria are locked — no further scope changes without a new decision record.
**Plans**: TBD

### Phase 38: Audit Actor Correctness
**Goal**: The audit log records unauthenticated/401 requests as `'unauthenticated'` (not `'anonymous'`), with no change to immutable historical actor entries.
**Depends on**: Phase 37
**Requirements**: AUDIT-01
**Success Criteria** (what must be TRUE):
  1. An unauthenticated request to any `/api/*` endpoint produces an audit row with `actor = 'unauthenticated'` — the string `'anonymous'` never appears in new rows.
  2. Audit rows created before the change (including rows for now-deleted users) are not modified; historical actor values remain as originally written.
  3. Automated tests cover both the unauthenticated path and the deleted-user historical-actor path, and both pass in `test:ci`.
**Plans**: 1 plan
Plans:
- [x] 38-01-PLAN.md — Relabel audit actor fallback to unauthenticated; extend actor-correctness tests

### Phase 39: Configurable Clinical Thresholds + Server/Client Parity
**Goal**: Admins can view and edit all clinical thresholds and plausibility ranges in the Settings UI, and the server uses the same settings-derived values as the client when computing outcome aggregates.
**Depends on**: Phase 37
**Requirements**: CFG-01, CFG-02, CFG-03
**Success Criteria** (what must be TRUE):
  1. An admin can open the Settings page and read/edit critical/action thresholds (CRT critical, Visus critical, IOP critical, Visus-jump, therapy-interrupter days); values are written to `config/settings.yaml` and survive a server restart.
  2. An admin can read and edit plausibility ranges (Visus, CRT, IOP min/max) from the same Settings UI using the same config + validation pattern.
  3. After changing any threshold, the server-side outcome aggregation (`outcomesAggregateApi.ts`) applies the updated value — a client-computed cohort and a server-computed cohort with the same data and the same settings produce identical classification results.
  4. The aggregate cache is invalidated on threshold change so stale pre-change results are not served to subsequent requests.
**Plans**: 3 plans
Plans:
- [x] 39-01-PLAN.md — Settings-backed threshold/plausibility config + shared validation + server reader (foundation)
- [x] 39-02-PLAN.md — SettingsPage "Clinical thresholds" + "Plausibility ranges" admin sections + DE/EN i18n
- [x] 39-03-PLAN.md — Server/client parity: inject settings options into applyFilters + threshold-aware cache key + parity test
**UI hint**: yes

### Phase 40: SavedSearch Hardening + Quality Check Configuration
**Goal**: SavedSearch provenance is owned by the server, and users can configure and persist which quality parameters are checked per subcohort.
**Depends on**: Phase 37, Phase 39
**Requirements**: SEC-06, QUAL-020, QUAL-021
**Success Criteria** (what must be TRUE):
  1. Creating or updating a saved search: the server generates `id` and `createdAt`; any client-supplied values for those fields are ignored; existing saved searches migrate cleanly without data loss.
  2. The API boundary sanitizes the `filters` field of an incoming saved search — malformed or extraneous fields are rejected or stripped before persistence.
  3. A user can run the quality review scoped to a selected cohort or subcohort (not only the global set), and the results reflect only that cohort's cases.
  4. A user can select which parameters to check for a given subcohort, and that selection is stored with the saved cohort so it is restored when the cohort is loaded again.
**Plans**: TBD

### Phase 41: Doc-Quality Correctness, Multi-Select Centers & UX
**Goal**: The quality module shows correct population denominators, surfaces absolute counts, supports multi-site filtering, and places the approve/flag control within easy reach.
**Depends on**: Phase 39
**Requirements**: QUAL-022, QUAL-023, QUAL-024, QUAL-025
**Success Criteria** (what must be TRUE):
  1. When the user applies a time-range filter on the quality page, the Grundgesamtheit (population denominator) updates to reflect only cases within that time range — it does not remain at the unfiltered total.
  2. Absolute patient/case counts are clearly visible on the quality overview without requiring a hover, tooltip, or secondary navigation step.
  3. A user can select multiple centers simultaneously in the quality filter; the server still restricts results to the user's authorized centers regardless of what is selected client-side.
  4. The approve/flag-status control in quality case detail is reachable without scrolling past all patient data.
  5. The multi-select center filter component is implemented as a shared component (consumed by both quality and analysis) ready for Phase 42 reuse.
**Plans**: TBD
**UI hint**: yes

### Phase 42: Analysis Cohort Comparison & Labeling
**Goal**: Cohort comparison plots are clearly labeled, the Aggregated tab supports between-cohort comparison, and the active cohort name is shown on direct-URL load.
**Depends on**: Phase 41
**Requirements**: ANL-010, ANL-011, ANL-012
**Success Criteria** (what must be TRUE):
  1. When comparing two or more cohorts, every plot — including the interval histogram — has a visible legend or label that unambiguously identifies which series belongs to which cohort.
  2. The Aggregated tab in Analysis presents side-by-side or overlaid comparison data (diagnosis distribution, age-vs-Visus) for the selected cohorts.
  3. When a user navigates to Analysis via a `?filters=` deep-link, the cohort or filter name is displayed in the UI — not just the results — without requiring the user to first save the search.
  4. The shared multi-select center filter from Phase 41 is correctly consumed by the Analysis views.
**Plans**: TBD
**UI hint**: yes

### Phase 43: Case Navigation, Reference & Chart Clarity
**Goal**: Users can drill into a case from a trajectory chart, compare a single case against cohort reference values, and read chart labels without ambiguity.
**Depends on**: Phase 42
**Requirements**: FALL-010, FALL-011, FALL-012, CHART-01
**Success Criteria** (what must be TRUE):
  1. Clicking a data point on a trajectory plot navigates to (or opens) the corresponding case detail — the drill-down interaction matches the decision captured in Phase 37.
  2. The case detail view can display cohort reference values (e.g. median trajectory) alongside the single case's values for direct comparison.
  3. CRT legend label, Visus measurement-type axis/legend, and the interpolation ("open circle") legend wording are self-explanatory without reference to external documentation — wording locked by Phase 37 decision.
  4. Trajectory and analysis charts render all expected axis ticks (A-06 fix); the responder "(i)" tooltip is placed adjacent to the relevant plot element, not in an unrelated page region.
**Plans**: TBD
**UI hint**: yes

### Phase 44: Tech-Debt Compaction
**Goal**: The `authApi.ts` God module and `OutcomesView.tsx` multi-responsibility component are restructured into cohesive units with no observable behavior change.
**Depends on**: Phase 38, Phase 39, Phase 40, Phase 41, Phase 42, Phase 43
**Requirements**: TECH-01, TECH-02
**Success Criteria** (what must be TRUE):
  1. `server/authApi.ts` is split into at minimum login, user-admin, TOTP, and session routers; no endpoint URL, response shape, or auth behavior changes; `test:ci` exits 0 with all tests green.
  2. `src/components/outcomes/OutcomesView.tsx` is decomposed into hooks and metric container components; no visible behavior, URL handling, or chart output changes; `test:ci` exits 0 with all tests green.
  3. `knip` reports no new unused exports and `lint` reports 0 warnings after the refactor.
**Plans**: TBD

### Phase 45: UAT Validation & Milestone Close
**Goal**: All v1.12 changes pass consolidated human UAT and the milestone is audited and closed.
**Type**: process/feedback — no production code delivered
**Depends on**: Phase 37, Phase 38, Phase 39, Phase 40, Phase 41, Phase 42, Phase 43, Phase 44
**Requirements**: None (process phase)
**Success Criteria** (what must be TRUE):
  1. Every v1.12 feature (Phases 38–44) has been exercised by a human tester in a running build and the result (pass / fail / caveat) is recorded — applying the v1.11 lesson that "claimed fixed" must be verified.
  2. Any failures or caveats found during UAT are triaged: either fixed before close or explicitly deferred with a decision record.
  3. The milestone audit confirms 100% requirement coverage: all 20 v1.12 REQ-IDs map to a completed phase, and the REQUIREMENTS.md Traceability table is updated to reflect final status.
  4. `test:ci` exits 0 (all tests green) at milestone close — the final gate matches the v1.11 close standard.
**Plans**: TBD

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 37. UAT Re-test & Spec Lock | 1/0 | Complete    | 2026-05-25 |
| 38. Audit Actor Correctness | 1/1 | Complete    | 2026-05-25 |
| 39. Configurable Clinical Thresholds + Parity | 3/3 | Complete    | 2026-05-25 |
| 40. SavedSearch Hardening + Quality Check Config | 0/0 | Not started | - |
| 41. Doc-Quality Correctness, Multi-Select Centers & UX | 0/0 | Not started | - |
| 42. Analysis Cohort Comparison & Labeling | 0/0 | Not started | - |
| 43. Case Navigation, Reference & Chart Clarity | 0/0 | Not started | - |
| 44. Tech-Debt Compaction | 0/0 | Not started | - |
| 45. UAT Validation & Milestone Close | 0/0 | Not started | - |

---

*Last updated: 2026-05-25 — Phase 39 planned (3 plans, 2 waves): Configurable Clinical Thresholds + Server/Client Parity (CFG-01/02/03). v1.12 milestone in progress (Phases 37–45).*
