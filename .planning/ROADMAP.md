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

### Phase 8: Cohort Outcome Trajectories

**Goal:** Add a cohort-level outcome analysis view that plots longitudinal visual-acuity trajectories across all members of a cohort with OD/OS/combined panels, axis/metric toggles, display layer controls, and CSV export.

**Requirements:** OUTCOME-01, OUTCOME-02, OUTCOME-03, OUTCOME-04, OUTCOME-05, OUTCOME-06, OUTCOME-07, OUTCOME-08, OUTCOME-09, OUTCOME-10, OUTCOME-11, OUTCOME-12

**Depends on:** Phase 7 (needs the new roster + enlarged cohort-able dataset to be meaningful)

**Success criteria:**
1. From any cohort defined in `CohortBuilderPage`, the user can open an Outcomes view and see three panels (OD, OS, combined) with per-patient curves and a median overlay, using real observation data from the cohort's members.
2. Toggling the X axis between "Days since baseline" and "Number of treatments" redraws all three panels with the new abscissa; toggling Y between Absolute / Δ / Δ% rescales the ordinate consistently per patient.
3. Display toggles (median line, scatter, SD shading, individual curves) independently show/hide their layer; the interpolation-grid slider re-computes median and SD band live.
4. Summary cards show correct patient count, total measurements, and per-eye counts; values match the underlying FHIR Observations; Data preview exports CSV with matching rows.
5. Opening the Outcomes view writes an audit entry; authz is enforced — a user whose cohort includes centers they aren't assigned to cannot load data across that boundary (center-based restriction from Phase 5 still applies).
6. German and English locales cover every new UI string; the `cohortTrajectory.ts` utility has unit tests for empty / single-patient / single-measurement / sparse-series / mismatched-span edge cases.

**Plans:** 4 plans

Plans:
- [ ] 08-01-PLAN.md — Pure trajectory math utility (src/utils/cohortTrajectory.ts) + exhaustive vitest edge-case suite (TDD; OUTCOME-03, -04, -06, -09, -10)
- [ ] 08-02-PLAN.md — GET /api/audit/events/view-open no-op audit beacon endpoint + tests (OUTCOME-11)
- [ ] 08-03-PLAN.md — OutcomesPage + 6 co-located components (summary cards, 3 ComposedChart panels, settings drawer, data preview with CSV, tooltip, empty states) + /outcomes route (OUTCOME-01, -02, -03, -04, -05, -06, -07, -08, -09, -11)
- [ ] 08-04-PLAN.md — outcomes* i18n bundle (DE+EN, ~55 keys) + CohortBuilderPage entry points (header action + per-row saved-cohort action) + i18n completeness test (OUTCOME-01, -12)

---
*Created: 2026-04-14 — opens milestone v1.5*
