# Milestones

## v1.11 UAT Fixes, Data Completeness & Quality Closure (Shipped: 2026-05-24)

**Phases completed:** 5 phases, 16 plans, 20 tasks

**Key accomplishments:**

- 1. [Rule 3 - Blocking] Test file extension .tsx instead of .ts
- 011da76
- Lifted getTherapyStatus to shared/, extended CohortFilter with 9 new fields, extended applyFilters with 4 preset + 5 advanced predicates via options param, added crtImplausibleThresholdUm to settings.yaml + AppSettings, and registered all 25 Phase 33 i18n keys.
- AnalysisPage
- Preset section
- CRT Review button re-routed from wrong `/quality?status=flagged` to `/quality?crt=implausible`; QualityPage seeds and applies the CRT filter from URL param via lazy useState + filteredCases memo clause.
- Consent and Encounter FHIR interfaces in shared/types/fhir.ts + three Wave 0 RED/skipped test scaffolds that Plans 02, 03, 04 will turn green.
- D-03 single-chokepoint stub filter in extractPatientCases + D-04 clinical-only patientCount + D-09 countRawPatients denominator helper — turns all stubIsolation.test.ts assertions green.
- Task 1 — Synthetic bundle generator extended (D-06/D-11/D-12)
- Datenvollzähligkeit completeness card on LandingPage using countRawPatients denominator and cases.length numerator, with CSS-token semantic colors and accessible progress bar — turns all 5 skipped card assertions green.
- Goal-backward verification of Phase 27 (Stateful Session Backend) mapping SESS-02/03/04 success criteria to concrete v1.10-anchored code evidence and passing tests.
- Flipped all v1.10 VALIDATION.md frontmatter to nyquist_compliant/wave_0_complete/status final, closing VVBACK-03 and VVBACK-04 via the 35-01/35-02 VERIFICATION evidence.
- 1. [Rule 3 - Blocking] Removed now-unused `CohortFilter` import in `OutcomesView.tsx`
- `npm run test:ci` → **901 passed (83 files), 0 failures** (including `audit:bundles` and `verify:bundles` distribution priors). VVBACK-05 gate satisfied.

---

## v1.11 — UAT Fixes, Data Completeness & Quality Closure (Shipped: 2026-05-24)

**Phases completed:** 5 phases (32–36), 16 plans
**Timeline:** 2026-05-21 → 2026-05-24
**Tests:** 901/901 passing at close (783 at v1.10 baseline; +118 across Phases 32–36)

**Scope summary:** UAT-driven user management hardening, cohort builder UX, FHIR data completeness card, V&V backfill for v1.10 deferred artifacts, and adversarial CODEX architecture review with Tier A + Tier B compaction (net −240 LOC). Tier C deferred to v1.12.

**Key accomplishments:**

- **User Management & Auth Hardening (Phase 32):** Edit-dialog center requirement enforced (UMGMT-01); all create+edit fields made mandatory (UMGMT-02); user activation/deactivation with real-time session revoke on deactivation (UMGMT-03); login lockout feedback with attempt counter and wait-time display (AUTHCFG-01); inactivity countdown timer starting at 3 min (AUTHCFG-02); inactivity timeout + lockout cap constants moved to `settings.yaml` (AUTHCFG-03/04). `editActive` seeded from `user.active !== false` (migration-safe).
- **Cohort Builder UX (Phase 33):** Plausibility warning preset (`implausibleCrt`) + CRT threshold in filters (COH-01); CohortFilter session persistence + reset button (COH-02); clinical issue preset selector (COH-03); advanced filter dialog with full field set (COH-04); Dashboard "Review" buttons deep-link to pre-filtered `/quality` (DASH-02).
- **Data Completeness (Phase 34):** FHIR Consent resource loading + patient-stub isolation; "Datenvollzähligkeit" completeness card on dashboard showing data completeness %; stubs never flow to clinical analysis surfaces (DASH-01). UI-SPEC design contract written and reviewed.
- **V&V Backfill (Phase 35):** Formal `VERIFICATION.md` backfilled for Phase 27 (stateful session backend) and Phase 28 (admin session control UI) via goal-backward analysis with refs anchored to `v1.10` tag (VVBACK-01/02). Nyquist `VALIDATION.md` brought to `nyquist_compliant: true` / `wave_0_complete: true` for Phases 27, 28, 29, and 31; all v1.10 `VALIDATION.md` `status: draft` flipped to `final` (VVBACK-03/04).
- **Architecture Review & Compaction (Phase 36):** CODEX adversarial review produced 15 severity-classified findings across SOC violations, duplicated logic, oversized modules, and dead code (ARCH-01). User-approved Tier A (mechanical hygiene: knip unused types, lint-sort fixes, dead code deletion) + Tier B (behavior-preserving de-duplication: centralized laterality `shared/laterality.ts`, CohortFilter safe-pick `src/utils/cohortFilterSerialization.ts`, shared interval/responder/measurement row projectors, `OutcomesDataPreview` collapsed from 751 → ~270 lines) applied cleanly (ARCH-02/03). `npm run test:ci` 901/901 green, `knip` clean, `lint` 0 warnings. Cumulative Tier A + Tier B diff: 16 files, +624 / −864 lines (net −240).
- **VVBACK-05 (final gate):** `npm run test:ci` exits 0 with 901/901 passing across 83 test files (including `audit:bundles` and `verify:bundles` distribution priors). Confirmed 2026-05-24.

**Known deferred items (accepted at close):**

Tier C items from the CODEX v1.11 review — ref `.planning/reviews/v1.11-arch-review/FINDINGS.md`:

| ID | Category | Item |
|----|----------|------|
| F-01 | soc-violation | Server outcome aggregation ignores settings-derived filter thresholds (therapyBreaker, implausibleCrt) |
| F-02 | soc-violation | Clinical thresholds live in `src/config/clinicalThresholds.ts` outside `settings.yaml` |
| F-03 | dead-code | Unreachable Keycloak runtime path wired through auth middleware (tied to KEYCLK-01) |
| F-09 | oversized-module | `authApi.ts` God module (1,175 lines) — split deferred |
| F-10 | oversized-module | `OutcomesView.tsx` multi-responsibility component — decomposition deferred |
| F-13 | soc-violation | Saved-search provenance is client-owned; server-side id/createdAt generation deferred |

---

## v1.10 Session Hardening & UX Closure (Shipped: 2026-05-21)

**Phases completed:** 5 phases (27–31), 16 plans, 17 tasks
**Timeline:** 2026-05-11 → 2026-05-21
**Tests:** green (754/754 at Phase 30 baseline; Phase 31 added subcohort suites)

**Key accomplishments:**

- **Stateful session backend (Phase 27):** Persistent SQLite `refresh_sessions` table (`server/sessionsDb.ts`, WAL, mirrors auditDb pattern); OAuth2-style jti rotation with RFC 6819 family revocation in `/refresh` (reuse → revoke family + 401); dual-key signing-key rotation + admin `POST /api/auth/rotate-key` so existing sessions expire gracefully across a key change (SESS-02/03/04).
- **Admin session control UI (Phase 28):** `listActiveSessionsByUser` + three admin-only endpoints (`GET /api/auth/sessions`, `DELETE /api/auth/sessions/:id`, sign-out-everywhere `DELETE …?username=`); AdminPage session accordion with per-device listing and revoke; in-UI TTL config form persisting `refreshTokenTtlMs`/`refreshAbsoluteCapMs` to settings.yaml (read at token-issue time). Session DTO strips sid/ver/revoked from the wire (SESS-01, SESSUI-01/02/03).
- **Home panel UX (Phase 29):** "Attention needed" Review buttons wired to pre-filtered quality views via query contracts (`/quality?therapy=breaker`, `?status=flagged`→`in_progress`); new client-side recent-activity store (`emd-recent:<username>`, capped at 5) + `useRecentActivity` hook powering "Jump Back In", with recording triggers on Quality/Analysis/Outcomes and clear-on-logout across same-tab and cross-tab broadcast (UX-01/02).
- **Terminology config docs (Phase 30, cleanup):** Corrected `terminology.serverUrl` Default cell in Konfiguration.md from the Ontoserver URL to an em-dash + example-placeholder labelling (matches code default `undefined`); verified the commented offline-by-default `terminology.*` block in settings.yaml (TERM-01/02).
- **Subcohort support (Phase 31):** `ParentName:Sub` naming convention; `src/services/cohortNames.ts` (`parseSubcohortName`/`isSubcohortName`/`groupByParent`) with validation; CohortBuilderPage inline validation (hard errors + soft orphan warning) and per-row Split affordance pre-filling `Parent:`; CohortCompareDrawer tree render (parent rows + indented subcohorts, chevron toggle); max-4 comparison counts each entry individually (KOH-003/004). Human UAT passed 3/3.

**Audit:** tech_debt (no functional gaps; 13/13 requirements satisfied, all cross-phase flows WIRED, green tests).

**Known deferred items (accepted at close):**

- Phases 27 & 28 shipped without a formal VERIFICATION.md — work evidenced by complete SUMMARYs, green tests, and the milestone integration check. Retroactively producible via `/gsd-verify-work`.
- Nyquist VALIDATION.md for phases 27/28/29 left `draft`/`nyquist_compliant: false`; Phase 31 `wave_0_complete: false`. Closable via `/gsd-validate-phase`.
- KEYCLK-01 (real Keycloak OIDC redirect flow) — carried to backlog, needs a live Keycloak instance.

**Archive:** [milestones/v1.10-ROADMAP.md](milestones/v1.10-ROADMAP.md) · [milestones/v1.10-REQUIREMENTS.md](milestones/v1.10-REQUIREMENTS.md) · [milestones/v1.10-MILESTONE-AUDIT.md](milestones/v1.10-MILESTONE-AUDIT.md)

---

## v1.9.5 Synthetic Data Realism (Shipped: 2026-05-01)

**Phases completed:** 1 phase (26), 4 plans
**Timeline:** 2026-04-30 → 2026-05-01
**Tests:** 642 → 682 (+40 new tests)

**Key accomplishments:**

- **Terminology seed extended (SYNTH-01):** `_seedMap` grows from 10 to 15 entries (5 new: SNOMED 312903003 DME, 362098006 RVO; ICD-10-GM E11, H43.1, T85.8). `audit-bundle-codes.mjs` CI gate + drift-guard test enforce 0 unresolvable codes at every `test:ci` run.
- **Disease-conditional comorbidity model (SYNTH-02):** `sampleComorbidities` helper emits age-correlated comorbidities — AMD 65% ≥ 60% threshold, DME 100% diabetes + ≥40% hypertension, RVO 50% I10. All Conditions use BfArM ICD-10-GM system URL.
- **HbA1c + age coupling + template differentiation (SYNTH-03):** `emitHbA1c` (2–5 LOINC 4548-4 obs per DME case, random-walk drift), `sampleAge` (truncated-normal per cohort: AMD N(75,8), DME N(65,8), RVO N(68,10)), `TEMPLATES` constant (IVI/CRT/drug CDF/laterality per cohort). Faricimab (S01LA09) and Dexamethasone (S01BA01) added.
- **Bundle regeneration + CI verification (SYNTH-04):** 4 synthetic site bundles (Chemnitz, Leipzig, Greifswald, Münster) regenerated atomically. `verify-bundle-distributions.mjs` asserts all priors (AMD median age 74, DME diabetes 100%, AMD comorbidity 65%, DME HbA1c 100%). Wired into `test:ci`. 682/682 tests pass.

**Archive:** [milestones/v1.9.5-ROADMAP.md](milestones/v1.9.5-ROADMAP.md) · [milestones/v1.9.5-REQUIREMENTS.md](milestones/v1.9.5-REQUIREMENTS.md) · [milestones/v1.9.5-MILESTONE-AUDIT.md](milestones/v1.9.5-MILESTONE-AUDIT.md)

---

## v1.8 Session Resilience & Test/Code Polish (Shipped: 2026-04-23)

**Phases completed:** 3 phases, 8 plans, 11 tasks

**Key accomplishments:**

- Shared test helper `tests/helpers/renderOutcomesView.tsx` extracted from OutcomesViewRouting.test.tsx; 7 existing tests migrated to consume the helper with zero behaviour change; 14-symbol export surface in place for Plan 02 consumption.
- 5 previously-skipped metric-selector tests unskipped + migrated onto shared helper; 4 new keyboard navigation tests added (MSEL-05); duplicate .ts file deleted; all 9 tests green
- One-liner:
- One-liner:
- 1. [Rule 1 — Test Bug] Within-second iat collision in rotation test
- Migrated call sites:
- Files:
- TDD RED → GREEN.

---

## v1.7 Security, Performance & Cross-Cohort (Shipped: 2026-04-21)

**Phases completed:** 4 phases (14–17), 16 plans
**Timeline:** 2026-04-17 → 2026-04-21

**Key accomplishments:**

- **Security hardening (Phase 14):** JWT algorithm pin (HS256 only), cohort hash secret auto-generation, forced password change on default credential, ARIA chart labels
- **TOTP 2FA (Phase 15):** Per-user TOTP enrollment with QR code, ±1 window tolerance, recovery codes, admin reset
- **Cross-cohort comparison (Phase 16):** Overlay up to 4 saved cohorts on a single trajectory chart; `?cohorts=` URL param; spaghetti-plot visual hierarchy (VIS-04); COHORT_PALETTES (4-color WCAG set)
- **Audit log + dark mode (Phase 17):** Multi-dimension audit filters (user, category, date range, body search, failures-only); ThemeContext/ThemeToggle; DARK_EYE_COLORS WCAG 4.5:1; FOUC prevention; `@variant dark` Tailwind v4 class-based dark mode

**Deferred to future milestone:**

- Phase 18 (Keycloak OIDC Redirect, KEYCLK-01) — requires real Keycloak instance; infrastructure prepared in Phase 6 (v1.0)

---

## v1.6 Outcomes Polish & Scale (Shipped: 2026-04-17)

**Phases completed:** 4 phases (10–13), 19 plans, 116 commits
**Changes:** 178 files, +25,698 / −10,873 lines
**Timeline:** 2026-04-16 → 2026-04-17 (1 day)
**Tests:** 429 passing, 0 failed (was 313 at v1.5 baseline)

**Key accomplishments:**

- **VQA (Phase 10):** Closed all v1.5 visual-QA gaps — WCAG-verified outcomes palette module, IQR band n<2 guard at math + DOM layers, tooltip D-05/D-06 field order + per-patient suppression, third empty-state variant (`all-eyes-filtered`), admin site filter locked to 7-site roster, stable OutcomesDataPreview row keys (composite `${pseudo}|${eye}|${date}`)
- **Audit PII hardening (Phase 11):** Cohort IDs removed from audit beacon URL — hashed via HMAC-SHA256 (server/hashCohortId.ts) in event payload; beacon migrated from GET querystring to POST JSON with keepalive; CRREV-01 closed end-to-end
- **Server-side aggregation (Phase 12):** `POST /api/outcomes/aggregate` — JWT-site-filtered, user-scoped Map cache with TTL + invalidation, byte-identical to client path (AGG-02 parity test), hashed audit row (AGG-05), auto-routed at >1000-patient threshold; shared/ module extraction with full backward-compat shims
- **New outcome metrics (Phase 13):** CRT trajectory (LOINC LP267955-5, µm units), treatment-interval histogram (6 fixed bins, median annotation), responder classification (configurable ETDRS threshold, ±180-day year-1 window), metric selector tab strip with `?metric=` deep-link, per-metric CSV export, 60 metrics* i18n keys (DE+EN) with completeness test

**Known gaps (accepted):**

- VQA-02 dark-mode contrast: deferred — no dark-mode infrastructure in codebase
- metricSelector integration tests: `describe.skip` — require full router context; accepted for now

---

## v1.1 Frontend-Backend Integration (Shipped: 2026-04-11)

**Changes:** 30 files, +807/-1177 lines (net -370 lines)

**Key accomplishments:**

- Server-backed JWT authentication (removed all hardcoded credentials from client bundle)
- Frontend wired to all server APIs (FHIR bundles, audit, user CRUD, data persistence)
- Settings.yaml and FHIR data moved out of webroot (security)
- FHIR proxy moved under auth scope (/api/fhir-proxy)
- Sites made configurable via data/centers.json
- Shared server constants extracted (no more duplicated site lists)
- Client-side audit replaced by server-side auditMiddleware
- Dead code removed (auditService, useLocalStorageState, safeJson)

---

## v1.0 EMD Backend Redesign MVP (Shipped: 2026-04-10)

**Phases completed:** 4 phases, 8 plans, 7 tasks

**Key accomplishments:**

- Commit:
- 1. [Rule 1 - Bug] TypeScript error on req.params.id
- Task 1 — AuthContext.tsx rewrite:
- One-liner:
- One-liner:
- One-liner:
- server/authApi.ts

---
