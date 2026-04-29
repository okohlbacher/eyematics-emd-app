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

## Active Patch Release: v1.9.4 — Terminology Resolver Refactor

**Goal:** Factor diagnosis display-name resolution out of `src/services/fhirLoader.ts` into a dedicated terminology service. Build a code/system dictionary from loaded bundles, lazily resolve display names via a configurable FHIR terminology server (with offline fallback), and update all 5 call sites.
**Granularity:** small (single-phase architecture refactor + server-proxy stub)
**Coverage:** 5/5 TERM-* requirements mapped
**Starting phase number:** 25

### Phases

- [ ] **Phase 25: Terminology Resolver** — New `src/services/terminology.ts`, server-side proxy `POST /api/terminology/lookup`, settings keys, useDiagnosisDisplay hook, remove hardcoded maps from fhirLoader (TERM-01..TERM-05)

### Phase Details

#### Phase 25: Terminology Resolver
**Goal**: Hardcoded `getDiagnosisLabel` / `getDiagnosisFullText` are removed from `fhirLoader.ts`; a new terminology service builds a global `(system → codes)` dictionary from loaded bundles and lazily resolves display names with a 3-tier strategy (in-memory cache → server-proxied FHIR `$lookup` → well-known fallback seed). The 5 caller files use the new sync helper or React hook. Tests cover seed-fallback, cache hit, and async resolution.
**Depends on**: Phase 24 (v1.9.3 ship)
**Requirements**: TERM-01, TERM-02, TERM-03, TERM-04, TERM-05
**Success Criteria** (what must be TRUE):
  1. **TERM-01** — `src/services/terminology.ts` exports `collectCodings(bundles)`, `resolveDisplay({ system, code, locale })`, `getCachedDisplay(system, code, locale)`, and `useDiagnosisDisplay(code, system?, locale)`. The well-known seed (current AMD/DR/ICD entries) lives in this module, not in `fhirLoader.ts`.
  2. **TERM-02** — `getDiagnosisLabel` and `getDiagnosisFullText` are removed from `src/services/fhirLoader.ts`. The 5 caller files (`CohortBuilderPage`, `AnalysisPage`, `QualityPage`, `QualityCaseDetail`, `PatientHeader`) compile and pass tests against the new API.
  3. **TERM-03** — Server-side proxy endpoint `POST /api/terminology/lookup` exists at `server/terminologyApi.ts`. SSRF-safe origin whitelist (matches Blaze-proxy pattern). LRU cache with TTL. Returns `{ display, system, code }` from the configured FHIR `$lookup` endpoint. Disabled by default (`terminology.enabled: false`); when disabled, returns 503 and clients fall through to seed.
  4. **TERM-04** — New `config/settings.yaml` keys: `terminology.enabled`, `terminology.serverUrl`, `terminology.cacheTtlMs`. Documented in `docs/Konfiguration.md`. Defaults preserve current offline behavior.
  5. **TERM-05** — Tests cover: (a) `collectCodings` builds expected dictionary from a fixture bundle, (b) `getCachedDisplay` returns seed value sync without firing fetch when seed hits, (c) async `resolveDisplay` populates L1 and React hook re-renders, (d) server proxy 503 when disabled, (e) `npm run test:ci` baseline grows to ~624 with 5 new test cases.
**Plans:** 3/4 plans executed
Plans:
- [x] 25-01-terminology-module-PLAN.md — Create src/services/terminology.ts with collectCodings, resolveDisplay, getCachedDisplay, useDiagnosisDisplay, _seedMap (TERM-01, TERM-05 partial; Wave 1)
- [x] 25-02-terminology-server-proxy-PLAN.md — Add POST /api/terminology/lookup with SSRF guard + LRU cache + 503-when-disabled (TERM-03, TERM-05 partial; Wave 2, parallel-safe with 25-01)
- [x] 25-03-caller-migration-PLAN.md — Migrate 5 callers (CohortBuilder, Analysis, Quality, QualityCaseDetail, PatientHeader) to new module; remove getDiagnosisLabel/FullText from fhirLoader (TERM-02; Wave 3)
- [ ] 25-04-settings-and-docs-PLAN.md — Add terminology.* settings keys + German docs in Konfiguration.md (TERM-04; Wave 4)
**UI hint**: no (no user-visible UI change; purely architectural)

---

## Shipped Patch Release: v1.9.3 — Production Feedback Fixes

**Goal:** Address user feedback collected after the v1.9 ship — remove non-participating sites from the data set, fix two non-functional Home-page panels, and align the Documentation Quality bar-chart palette with the rest of the app.
**Granularity:** small (single-phase, scope-bounded by collected feedback)
**Coverage:** 4/4 feedback requirements mapped
**Starting phase number:** 24

### Phases

- [ ] **Phase 24: Production Feedback Fixes** — Remove UKD/UKMZ from site roster, repair Home "Attention needed" + "Jump Back In" panels, and apply muted palette to DocQuality bars (FB-01..FB-04)

### Phase Details

#### Phase 24: Production Feedback Fixes
**Goal**: All four issues reported via the in-app feedback channel on 2026-04-27 are resolved without regressions; site roster reduced to participating institutions; Home-page panel buttons either route correctly or are removed; DocQuality chart colours match the muted palette tokens used elsewhere
**Depends on**: v1.9 milestone shipped (current production)
**Requirements**: FB-01, FB-02, FB-03, FB-04
**Success Criteria** (what must be TRUE):
  1. **FB-01** — `data/centers.json` no longer lists UKD (Dresden) or UKMZ (Mainz); generated FHIR bundles for those sites are removed; README site table updated; `npm run test:ci` (608/608 baseline) and `npm run build` still green
  2. **FB-02** — Every "Review" button in the Home-page "Attention needed" panel either navigates to a real route OR the dead button is removed; no dangling click handlers
  3. **FB-03** — "Jump Back In" panel arrows route to the prior cohort/case OR show an explicit empty state when no history exists; click handlers no longer silently swallow events
  4. **FB-04** — Documentation Quality bar chart uses the project's muted chart palette (consistent with other charts on the page); series remain visually distinguishable; no contrast regression
**Plans:** 2/4 plans executed
Plans:
- [x] 24-01-site-roster-cleanup-PLAN.md — Remove UKD + UKMZ from data, bundles, scripts, tests, docs (FB-01, Wave 1)
- [ ] 24-02-attention-panel-PLAN.md — Wire or remove Review buttons in Home Attention needed panel (FB-02, Wave 2)
- [ ] 24-03-jump-back-in-panel-PLAN.md — Wire Jump Back In rows or surface explicit empty state (FB-03, Wave 3)
- [x] 24-04-docquality-palette-PLAN.md — Re-skin DocQuality bars with muted page tokens (FB-04, Wave 2)
**UI hint**: yes (FB-02, FB-03, FB-04 touch user-visible UI)

---

## Shipped Milestone: v1.9 — Codebase Consistency & Test/Tech-Debt Polish

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
- [x] **Phase 23: Dependency & Lint Cleanup** — `npm audit` clean at moderate threshold, non-breaking dep upgrades, tighter ESLint rule set, and a normalized `package.json` scripts block (completed 2026-04-23)

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
| 23. Dependency & Lint Cleanup | 3/3 | Complete   | 2026-04-23 |

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

*Last updated: 2026-04-28 — v1.9.3 patch release opened (Phase 24, FB-01..04); v1.9 marked shipped.*
