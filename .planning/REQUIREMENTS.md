# Requirements: v1.9 — Codebase Consistency & Test/Tech-Debt Polish

**Milestone:** v1.9
**Started:** 2026-04-23
**Goal:** Raise internal quality — eliminate code duplication, enforce consistency across the codebase, green the test suite, automate deferred UAT items, and modernize deps/lint.

**No new product features.** All work is refactor, test, or tooling.

## Scope Themes

1. **Codebase Consistency** — deduplication, naming, pattern alignment (CONSIST-*)
2. **Documentation Consistency** — `.planning/`, README, inline docs (DOCS-*)
3. **Test-Suite Green** — fix 3 pre-existing failures (TEST-*)
4. **UAT → Automated** — convert Phase 20 human-verification items to tests (UAT-AUTO-*)
5. **Dependency & Lint Cleanup** — deps audit, lint tightening, dead code (DEPS-*)

## Out of Scope (explicit)

- **KEYCLK-01** — Real Keycloak OIDC redirect flow (blocked by M7; deferred)
- **SESSION-10** — Admin-triggered force sign-out everywhere (deferred)
- **SESSION-11** — Stateful refresh-sessions table with OAuth2 rotation (deferred)
- **Playwright / Cypress E2E harness** — MSEL-04 browser-back/forward gap stays deferred
- **Refresh-token signing-key rotation** — operational work; not this milestone
- **Per-device session listing / revocation UI** — product feature; not this milestone
- **UI for `auth.refreshTokenTtlMs` / `auth.refreshAbsoluteCapMs`** — product feature
- **Any new product features** — v1.9 is purely internal quality

---

## Requirements

### Codebase Consistency (CONSIST-*)

- [ ] **CONSIST-01** — Duplication audit across `src/`, `server/`, `shared/`. Identify duplicated utilities, copy-pasted helpers, near-identical functions. Dedupe to single-source-of-truth in the appropriate module. Delete obsoleted copies.
- [ ] **CONSIST-02** — Naming & pattern consistency sweep: verify consistent naming (camelCase vs snake_case where applicable), consistent error-handling patterns (throw vs return-result), consistent async style (async/await vs .then chains). Apply one canonical pattern per concern.
- [ ] **CONSIST-03** — Dead-code removal: unused exports (via `ts-prune` or equivalent), unreferenced files, stale feature-flag branches, commented-out code. Remove or document why retained.
- [ ] **CONSIST-04** — Type consistency: narrow overly broad `any` / `unknown` types where the shape is inferable; consolidate duplicated type definitions into shared modules.

### Documentation Consistency (DOCS-*)

- [ ] **DOCS-01** — `.planning/` docs audit: verify `PROJECT.md`, `MILESTONES.md`, `ROADMAP.md`, archived milestone files use consistent terminology (sites vs centers, patients vs cases, etc.). Fix drift; ensure links resolve.
- [ ] **DOCS-02** — `README.md` + inline doc audit: verify setup instructions current, dev scripts match `package.json`, `CLAUDE.md` accurate. Remove stale instructions. Trim verbosity.
- [ ] **DOCS-03** — Inline code comments: remove "what" comments where name/code is self-explanatory; retain only "why" comments. Consistent JSDoc style where JSDoc exists.

### Test-Suite Green (TEST-*)

- [ ] **TEST-01** — Fix `tests/outcomesPanelCrt.test.tsx` — "visus absolute mode: y-domain is [0, 2]" test. Root-cause the regression from v1.6 Phase 13, fix either source or test, green the case.
- [ ] **TEST-02** — Fix `tests/outcomesPanelCrt.test.tsx` — "backward compat: no metric prop defaults to visus absolute [0, 2]" test. Same root-cause investigation as TEST-01.
- [ ] **TEST-03** — Fix `tests/OutcomesPage.test.tsx` — "fires audit beacon POST with JSON body, keepalive, and no cohort id in URL (Phase 11)" test. Verify audit beacon POST path still correct; fix test or source.
- [ ] **TEST-04** — Full test suite passes in CI with zero skipped tests (except documented platform-impossible cases, which must have a SKIP_REASON comment citing MSEL-04 precedent).

### UAT → Automated (UAT-AUTO-*)

- [ ] **UAT-AUTO-01** — Automate silent-refresh smoke test: authFetch refreshes on 401 and retries original request once (vitest + msw or fetch mock). Replaces Phase 20 UAT item.
- [ ] **UAT-AUTO-02** — Automate BroadcastChannel multi-tab coordination: simulate two tabs, verify single-flight refresh lock via `BroadcastChannel('emd-auth')`. Replaces Phase 20 UAT item.
- [ ] **UAT-AUTO-03** — Automate audit DB silence for successful refreshes: verify `/api/auth/refresh` 200 responses are NOT written to audit.db (SKIP_AUDIT_PATHS works). Failed refreshes and logouts ARE audited. Replaces Phase 20 UAT item.
- [ ] **UAT-AUTO-04** — Automate idle-logout timer: verify 10-min idle auto-logout still fires. Replaces Phase 20 UAT item.
- [ ] **UAT-AUTO-05** — Automate absolute-cap forces re-auth: verify `auth.refreshAbsoluteCapMs` forces re-auth after cap regardless of activity. Replaces Phase 20 UAT item.

### Dependency & Lint Cleanup (DEPS-*)

- [x] **DEPS-01** — `npm audit` clean at `moderate` threshold; non-breaking dep upgrades (patch + minor) applied. Breaking major upgrades documented in a DEFERRED-UPGRADES.md if any blockers.
- [x] **DEPS-02** — ESLint rule tightening: enable `no-unused-vars`/`@typescript-eslint/no-unused-vars` strict, `prefer-const`, `no-var`, and any project-appropriate rules. Fix violations (or add per-line eslint-disable with reason).
- [x] **DEPS-03** — `package.json` scripts audit: remove unused scripts, normalize naming (dev, build, test, lint pattern), ensure each script works.

### Production Feedback Fixes (FB-*) — v1.9.3

Source: in-app feedback submitted by `admin` on 2026-04-27 (4 issues).

- [ ] **FB-01** — Remove non-participating sites **UKD (Dresden)** and **UKMZ (Mainz)** from `data/centers.json`, the seeded site list, and any synthetic FHIR bundles. README site table reduces from 8 → 6 entries.
- [ ] **FB-02** — Home-page "Attention needed" panel: every "Review" button must route to a real destination OR the dead button is removed. No dangling click handlers.
- [ ] **FB-03** — Home-page "Jump Back In" panel: arrow buttons must route to the prior cohort/case OR surface an explicit empty state when no history exists. Click handlers must not silently swallow events.
- [x] **FB-04** — Documentation Quality page: bar-chart colour palette must match the project's muted chart tokens used elsewhere on the page. Series remain visually distinguishable; no contrast regression.

### Terminology Resolver (TERM-*) — v1.9.4

Source: post-v1.9.3 architecture review (FHIR mapping deep-dive 2026-04-28).

- [x] **TERM-01** — New `src/services/terminology.ts` module hosts `collectCodings(bundles)`, `resolveDisplay({ system, code, locale })`, `getCachedDisplay(system, code, locale)`, and `useDiagnosisDisplay(code, system?, locale)`. Well-known seed (AMD/DR/ICD) lives here, not in `fhirLoader.ts`.
- [x] **TERM-02** — `getDiagnosisLabel` + `getDiagnosisFullText` removed from `src/services/fhirLoader.ts`. The 5 callers (CohortBuilderPage, AnalysisPage, QualityPage, QualityCaseDetail, PatientHeader) updated to the new API.
- [x] **TERM-03** — Server-side proxy `POST /api/terminology/lookup` at `server/terminologyApi.ts`: SSRF-safe origin whitelist, LRU cache with TTL, FHIR `$lookup` translation. Disabled by default; clients fall through to seed when 503.
- [ ] **TERM-04** — `config/settings.yaml` gains `terminology.enabled`, `terminology.serverUrl`, `terminology.cacheTtlMs`. Documented in `docs/Konfiguration.md`. Defaults preserve current offline behavior.
- [x] **TERM-05** — Tests cover code-collection from a fixture bundle, sync seed-cache hit, async resolution + React hook re-render, server-proxy 503-when-disabled. Test:ci baseline grows from 619 to ~624.

---

## Traceability

| REQ-ID | Description | Phase |
|--------|-------------|-------|
| CONSIST-01 | Duplication audit + dedup | Phase 22 |
| CONSIST-02 | Naming/pattern consistency | Phase 22 |
| CONSIST-03 | Dead-code removal | Phase 22 |
| CONSIST-04 | Type consistency | Phase 22 |
| DOCS-01 | `.planning/` docs audit | Phase 22 |
| DOCS-02 | README + inline doc audit | Phase 22 |
| DOCS-03 | Inline comment audit | Phase 22 |
| TEST-01 | outcomesPanelCrt visus abs y-domain [0,2] | Phase 21 |
| TEST-02 | outcomesPanelCrt backward-compat default | Phase 21 |
| TEST-03 | OutcomesPage audit beacon POST (Phase 11) | Phase 21 |
| TEST-04 | Zero skipped tests (except documented platform-impossible) | Phase 21 |
| UAT-AUTO-01 | Silent refresh smoke | Phase 21 |
| UAT-AUTO-02 | BroadcastChannel multi-tab | Phase 21 |
| UAT-AUTO-03 | Audit DB silence on refresh | Phase 21 |
| UAT-AUTO-04 | Idle-logout timer | Phase 21 |
| UAT-AUTO-05 | Absolute-cap re-auth | Phase 21 |
| DEPS-01 | npm audit + non-breaking upgrades | Phase 23 |
| DEPS-02 | ESLint rule tightening | Phase 23 |
| DEPS-03 | `package.json` scripts audit | Phase 23 |
| FB-01 | Remove UKD + UKMZ from site roster | Phase 24 |
| FB-02 | Home "Attention needed" panel buttons | Phase 24 |
| FB-03 | Home "Jump Back In" panel arrows | Phase 24 |
| FB-04 | DocQuality bar-chart palette alignment | Phase 24 |
| TERM-01 | Terminology service module | Phase 25 |
| TERM-02 | Remove hardcoded maps from fhirLoader | Phase 25 |
| TERM-03 | Server-side terminology proxy | Phase 25 |
| TERM-04 | Settings + docs for terminology server | Phase 25 |
| TERM-05 | Test coverage for terminology resolver | Phase 25 |

**Coverage:** 28/28 requirements mapped. Phase 21: TEST-01..04 + UAT-AUTO-01..05 (9). Phase 22: CONSIST-01..04 + DOCS-01..03 (7). Phase 23: DEPS-01..03 (3). Phase 24: FB-01..04 (4). Phase 25: TERM-01..05 (5).

---

*Created: 2026-04-23*
