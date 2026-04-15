# Roadmap: EMD v1.5 Site Roster & Cohort Analytics

**Milestone:** v1.5
**Core Value:** Every user sees only authorized data, with tamper-proof audit trail
**Goal:** Correct the site roster to the 7 real EyeMatics sites with matching synthetic data, and add cohort-level outcome analysis.

> Phase numbering continues from v1.1 (which ended at phase 6). v1.2–v1.4 shipped without GSD phase tracking.

## Phases

### Phase 7: Site Roster Correction & Synthetic Data

**Goal:** Replace the 5-site roster (UKA/UKB/LMU/UKT/UKM) with the 7 real EyeMatics sites (Aachen, Chemnitz, Dresden, Greifswald, Leipzig, Mainz, Tübingen) and populate matching synthetic FHIR bundles for the 5 new sites via a reproducible generator.

**Requirements:** SITE-01, SITE-02, SITE-03, SITE-04, SITE-05, SITE-06, SITE-07, DATA-GEN-01, DATA-GEN-02, DATA-GEN-03, DATA-GEN-04, DATA-GEN-05, DATA-GEN-06

**Depends on:** Phase 6 (Keycloak Preparation — shipped in v1.0)

**Success criteria:**
1. Logging in as an admin and opening the cohort filter shows exactly the 7 new sites with correct German city names; none of Bonn/München/Münster appear anywhere in the UI.
2. Center-filtering on all data endpoints (GET /api/fhir/bundles, /api/data/*, user CRUD) operates over the new 7-site roster — unauthorized cross-site access still fails with 403 (existing Phase 5 test suite passes with updated roster).
3. `npm run generate-bundles` regenerates the 5 new-site bundles deterministically; the resulting files load via `fhirLoader.ts` and pass all existing fhirApi / dataApiCenter / centerBypass tests.
4. `data/users.json` migration runs on server startup and leaves every user with at least one valid center from the new roster.
5. Docs and i18n strings for centers are coherent — grep for `UKB|UKM|LMU|Bonn|München|Münster` in `src/`, `server/`, `docs/`, and `tests/` returns no functional hits (archived planning docs excluded).

**Plans:** 3 plans

Plans:
- [x] 07-01-PLAN.md — Lock 7-site roster (data/centers.json, DEFAULT_CENTERS, client _centerShorthands, roster-pinned test updates, isBypass refactor)
- [x] 07-02-PLAN.md — Deterministic synthetic FHIR Bundle generator (Mulberry32 PRNG, scripts/generate-center-bundle.ts, npm run generate-bundles, 5 new bundle files, manifest update, load-path smoke tests)
- [x] 07-03-PLAN.md — Users.json migration (_migrateRemovedCenters chained at startup), stale bundle deletion, server/index.ts seed update, README + docs sweep

### Phase 8: Cohort Outcome Trajectories — Foundations

**Goal:** Land the non-UI foundations for cohort-level outcome analysis: the pure trajectory-math utility (median/IQR/logMAR/Snellen/treatment-index), the audit view-open beacon endpoint, the outcomes* i18n bundle, and the CohortBuilder entry points into the (future) Outcomes view.

**Requirements:** OUTCOME-03, OUTCOME-04, OUTCOME-06, OUTCOME-09, OUTCOME-10, OUTCOME-11, OUTCOME-12 (+ partial OUTCOME-01 entry points)

> UI-side requirements (OUTCOME-02, -05, -07, -08 and the page-facing half of OUTCOME-01) moved to Phase 9 where they get fresh discussion, research, and planning.

**Depends on:** Phase 7 (needs the new roster + enlarged cohort-able dataset to be meaningful)

**Success criteria:**
1. `computeCohortTrajectory()` is pure, deterministic, exported from `src/utils/cohortTrajectory.ts`, and has exhaustive vitest coverage for the 5 OUTCOME-10 edge cases (empty cohort, single patient, single measurement, sparse series, mismatched spans).
2. `GET /api/audit/events/view-open` returns 204 for authenticated users and the request is captured by audit middleware; Phase 9 UI consumes this endpoint from `OutcomesPage` on mount.
3. Every `outcomes*` i18n key from the UI-SPEC copywriting contract exists in DE and EN, with a completeness test guarding regression.
4. `CohortBuilderPage` exposes entry points (header action + per-row action) that navigate to `/outcomes?cohort=<id>` — the route itself is implemented in Phase 9.
5. German and English locales cover every new non-UI string; backend + math layer have no cross-phase regressions.

**Plans:** 3 plans

Plans:
- [x] 08-01-PLAN.md — Pure trajectory math utility (src/utils/cohortTrajectory.ts) + exhaustive vitest edge-case suite (TDD; OUTCOME-03, -04, -06, -09, -10)
- [x] 08-02-PLAN.md — GET /api/audit/events/view-open no-op audit beacon endpoint + tests (OUTCOME-11)
- [x] 08-04-PLAN.md — outcomes* i18n bundle (DE+EN) + CohortBuilderPage entry points (header action + per-row saved-cohort action) + i18n completeness test (OUTCOME-01 entry points, OUTCOME-12)

> 08-03 (OutcomesPage UI + 7 co-located components + /outcomes route) deferred to Phase 9 (see below). One prior agent attempt was reverted cleanly — the only surviving 08-03 artifact is the plan file `.planning/phases/08-cohort-outcome-trajectories/08-03-PLAN.md`, retained as reference input for Phase 9 research.

### Phase 9: Outcomes Page UI

**Goal:** Build the `/outcomes` route that composes Phase 8's trajectory math + audit beacon + i18n bundle into the visible Outcomes analytics view — three Recharts panels (OD, OS, combined), summary cards, settings drawer, data preview with CSV export, custom tooltip, and empty states.

**Requirements:** OUTCOME-01 (page-facing), OUTCOME-02, OUTCOME-05, OUTCOME-07, OUTCOME-08, plus re-use of OUTCOME-03/-04/-06/-09/-11 surfaces from Phase 8.

**Depends on:** Phase 8 (needs `computeCohortTrajectory`, view-open endpoint, outcomes* i18n keys, CohortBuilder entry points — all landed).

**Success criteria:**
1. Navigating to `/outcomes?cohort=<id>` renders three panels with per-patient curves + median overlay using real observation data.
2. X-axis toggle (days vs. treatments) and Y-metric toggle (absolute/Δ/Δ%) redraw all three panels live.
3. Display-layer toggles (median, per-patient, scatter, spread band) independently show/hide; interpolation-grid slider re-computes the median live.
4. Summary cards, panel subtitles, and data-preview row count all read from the SAME memoized `aggregate` object (no drift).
5. CSV export via `downloadCsv` produces the D-28 column set (no `center_id`) with a dated filename.
6. Audit beacon fires once on mount with the correct cohort/filter param.
7. Cohorts >30 patients start with Scatter layer OFF; empty-state variants render for 0-patient / no-visus / panel-scoped-zero.
8. Fresh discussion + research + planning performed before execution — no porting of the reverted 08-03 attempt.

**Plans:** 3 plans

Plans:
- [ ] 09-01-PLAN.md — Scaffold /outcomes route + cohort resolution + audit beacon + OutcomesEmptyState + App.tsx wiring (TDD, tests 1..7; OUTCOME-01, -09, -11)
- [ ] 09-02-PLAN.md — OutcomesSummaryCards + three OutcomesPanels (OD/OS/combined) + OutcomesTooltip + OutcomesSettingsDrawer + page wire (TDD, tests 8..12; OUTCOME-02, -03, -04, -05, -06, -07)
- [ ] 09-03-PLAN.md — OutcomesDataPreview <details> + flattenToRows helper + CSV export via downloadCsv/datedFilename (TDD, tests 13..17; OUTCOME-08)

---
*Created: 2026-04-14 — opens milestone v1.5*
*Updated: 2026-04-15 — Phase 8 rescoped to foundations; 08-03 UI deferred to new Phase 9*
*Updated: 2026-04-15 — Phase 9 planned (3 plans, sequential waves 1→2→3; TDD RED/GREEN/REFACTOR per plan)*
