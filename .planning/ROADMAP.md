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

> Note: v1.2–v1.4 shipped between v1.1 and v1.5 but were not tracked in GSD artifacts; git history is authoritative for those releases.

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

## Active Milestone: v1.9 — Codebase Consistency & Test/Tech-Debt Polish

<!--
Phase split review: The proposed 21 → 22 → 23 linear sequence is sound.
- Phase 21 leads because greening the test suite (TEST-01..04) and landing the
  5 UAT→automated session tests (UAT-AUTO-01..05) gives Phase 22's refactors a
  trustworthy safety net before any dedup/pattern churn lands.
- Phase 22 precedes Phase 23 so the lint tightening and dead-code pruning in
  Phase 23 apply to the already-deduped, pattern-aligned codebase rather than
  to code that is about to move.
- No material concerns with the split. All three phases are non-UI (internal
  quality work); UI hint is `no` throughout.
-->

**Goal:** Raise internal quality — eliminate code duplication, enforce consistency across the codebase, green the test suite, automate the 5 deferred Phase 20 UAT items, and modernize deps/lint — without shipping any user-visible product changes.
**Granularity:** standard (derived from scope)
**Coverage:** 19/19 v1.9 requirements mapped
**Starting phase number:** 21 (continues v1.8's Phase 20)

### Phases

- [x] **Phase 21: Test & UAT Polish** — Green the 3 pre-existing failing tests, enforce zero-skipped-tests policy, and convert the 5 Phase 20 human-verification items into automated tests (completed 2026-04-23)
- [x] **Phase 22: Codebase & Docs Consistency** — Dedupe utilities across `src/`/`server/`/`shared/`, align naming/error/async patterns, narrow types, remove dead code, and reconcile `.planning/` + README + inline docs (completed 2026-04-23)
- [ ] **Phase 23: Dependency & Lint Cleanup** — `npm audit` clean at moderate threshold, non-breaking dep upgrades, tighter ESLint rule set, and a normalized `package.json` scripts block

### Phase Details

#### Phase 21: Test & UAT Polish
**Goal**: The full test suite is green in CI with zero skipped tests (except documented platform-impossible cases), and the 5 deferred Phase 20 session-resilience UAT items run as automated tests
**Depends on**: Nothing (lead-off; establishes the safety net every later phase refactors against)
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, UAT-AUTO-01, UAT-AUTO-02, UAT-AUTO-03, UAT-AUTO-04, UAT-AUTO-05
**Success Criteria** (what must be TRUE):
  1. `tests/outcomesPanelCrt.test.tsx` "visus absolute mode: y-domain is [0, 2]" and "backward compat: no metric prop defaults to visus absolute [0, 2]" both pass; the v1.6 Phase 13 regression root cause is identified in the commit message (source vs test fix)
  2. `tests/OutcomesPage.test.tsx` "fires audit beacon POST with JSON body, keepalive, and no cohort id in URL (Phase 11)" passes; the beacon path continues to match the Phase 11 contract (cohort id only in hashed POST body, never in URL)
  3. `npm test` exits 0 with zero skipped tests, except cases carrying a `SKIP_REASON` comment that cites the MSEL-04 browser-back/forward precedent; a lint or CI check enforces the SKIP_REASON policy
  4. Five new automated tests replace the Phase 20 UAT items: silent refresh (authFetch 401→refresh→retry once, single-flight), BroadcastChannel multi-tab lock (`BroadcastChannel('emd-auth')`), audit silence on 200-refresh via `SKIP_AUDIT_PATHS` (with failed refreshes and logouts still audited), idle-logout timer still fires at 10 min, and `auth.refreshAbsoluteCapMs` forces re-auth after the cap regardless of activity
  5. The Phase 20 `10-HUMAN-UAT.md`-style manual checklist items corresponding to UAT-AUTO-01..05 are removed or marked "automated by v1.9 Phase 21" with links to the replacement tests
**Plans:** 3/3 plans complete
Plans:
- [x] 21-01-fix-failing-tests-PLAN.md — Fix 3 failing tests (outcomesPanelCrt ×2, OutcomesPage beacon) + zero-skip CI gate (TEST-01..04)
- [x] 21-02-authfetch-refresh-suite-PLAN.md — Global BroadcastChannel shim + UAT-AUTO-01/02/03 automation (silent refresh, multi-tab, audit silence)
- [x] 21-03-session-timers-PLAN.md — UAT-AUTO-04 idle-logout + UAT-AUTO-05 absolute-cap (fake-timer tests)
**UI hint**: no

#### Phase 22: Codebase & Docs Consistency
**Goal**: `src/`, `server/`, and `shared/` have single-source-of-truth utilities with one canonical pattern per concern (naming, error handling, async), no dead code, tightened types, and `.planning/` + README + inline docs match the shipped codebase
**Depends on**: Phase 21 (needs green test suite + UAT automation as the refactor safety net)
**Requirements**: CONSIST-01, CONSIST-02, CONSIST-03, CONSIST-04, DOCS-01, DOCS-02, DOCS-03
**Success Criteria** (what must be TRUE):
  1. A duplication audit report across `src/`, `server/`, and `shared/` identifies every near-duplicate helper; each duplication is resolved by moving to the correct module (usually `shared/`) and deleting obsoleted copies; the full test suite stays green after each dedup commit
  2. One canonical pattern is documented and applied per concern: naming (camelCase for TS identifiers, snake_case only where FHIR/HTTP demands it), error handling (throw vs Result), and async style (async/await, no mixed `.then` chains in new code); violations in touched files are corrected
  3. `ts-prune` (or equivalent) reports zero unused exports; commented-out code and stale feature-flag branches are removed or carry a one-line "retained because X" justification; broad `any`/`unknown` types are narrowed in files whose shape is inferable, and duplicated type definitions are consolidated into `shared/` or the nearest shared module
  4. `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/MILESTONES.md`, and archived milestone ROADMAPs use consistent terminology (sites vs centers, patients vs cases, etc.) with a one-page glossary; every intra-`.planning/` link resolves
  5. `README.md`, `CLAUDE.md`, and inline code comments are audited: setup instructions match current `package.json` scripts, stale instructions removed, "what" comments deleted in favor of "why" comments, and JSDoc style is consistent where JSDoc is used
**Plans**: TBD
**UI hint**: no

#### Phase 23: Dependency & Lint Cleanup
**Goal**: `npm audit` is clean at the `moderate` threshold, non-breaking dep upgrades are applied, the ESLint rule set is tightened (with all violations fixed or suppressed with a reason), and `package.json` scripts are normalized and each verified to run
**Depends on**: Phase 22 (lint tightening and unused-code detection apply to the post-refactor, post-dedup code surface)
**Requirements**: DEPS-01, DEPS-02, DEPS-03
**Success Criteria** (what must be TRUE):
  1. `npm audit --audit-level=moderate` exits 0; all patch/minor upgrades are applied; any deferred major-version upgrades are captured in `DEFERRED-UPGRADES.md` with a one-line blocker note each
  2. ESLint configuration enables `@typescript-eslint/no-unused-vars` (strict), `prefer-const`, `no-var`, and any project-appropriate rules agreed during planning; `npm run lint` exits 0 — remaining violations are either fixed or carry a per-line `// eslint-disable-next-line <rule> -- <reason>` with a concrete justification
  3. `package.json` scripts: unused scripts removed, naming normalized around the `dev` / `build` / `test` / `lint` pattern, each script verified to run successfully in a clean checkout; CI references are updated to match renamed scripts
**Plans**: TBD
**UI hint**: no

### Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 21. Test & UAT Polish | 3/3 | Complete    | 2026-04-23 |
| 22. Codebase & Docs Consistency | 3/3 | Complete    | 2026-04-23 |
| 23. Dependency & Lint Cleanup | 1/3 | In Progress|  |

### Coverage Map

| Requirement | Phase |
|-------------|-------|
| TEST-01 | Phase 21 |
| TEST-02 | Phase 21 |
| TEST-03 | Phase 21 |
| TEST-04 | Phase 21 |
| UAT-AUTO-01 | Phase 21 |
| UAT-AUTO-02 | Phase 21 |
| UAT-AUTO-03 | Phase 21 |
| UAT-AUTO-04 | Phase 21 |
| UAT-AUTO-05 | Phase 21 |
| CONSIST-01 | Phase 22 |
| CONSIST-02 | Phase 22 |
| CONSIST-03 | Phase 22 |
| CONSIST-04 | Phase 22 |
| DOCS-01 | Phase 22 |
| DOCS-02 | Phase 22 |
| DOCS-03 | Phase 22 |
| DEPS-01 | Phase 23 |
| DEPS-02 | Phase 23 |
| DEPS-03 | Phase 23 |

**Coverage:** 19/19 v1.9 requirements mapped. KEYCLK-01, SESSION-10, SESSION-11, and the Playwright E2E harness (MSEL-04 gap) are explicitly out of scope per REQUIREMENTS.md.

---

*Last updated: 2026-04-23 — v1.9 roadmap created (Phases 21–23); v1.8 archived.*
