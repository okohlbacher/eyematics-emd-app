---
phase: 07-site-roster-correction-synthetic-data
verified: 2026-04-14T22:40:00Z
status: human_needed
score: 5/5 roadmap success criteria verified
overrides_applied: 0
overrides: []
human_verification:
  - test: "Admin cohort filter UI shows the 7 new sites"
    expected: "Logging in as admin and opening the cohort filter displays exactly the 7 German city names (Aachen, Chemnitz, Dresden, Greifswald, Leipzig, Mainz, Tübingen); none of Bonn/München/Münster appear anywhere in the UI."
    why_human: "Roadmap SC1 explicitly calls out a visual/UX check of the admin UI. Data sources (centers.json, DEFAULT_CENTERS, client _centerShorthands, users.json admin record) all contain exactly the 7 expected entries and zero removed IDs, but the actual rendered filter widget is a runtime UI concern that cannot be asserted with grep."
  - test: "Unauthorized cross-site access returns 403 on live server"
    expected: "A non-admin user whose centers array does not include org-ukd cannot GET /api/fhir/bundles?center=org-ukd (or any /api/data/* center-scoped endpoint) — response is 403."
    why_human: "Roadmap SC2 requires end-to-end confirmation against a running server. Unit tests (centerBypass.test.ts, dataApiCenter.test.ts, fhirApi.test.ts — all passing, 240/240 suite green) cover the logic, but a live 403 against the 7-site roster is a runtime check outside vitest scope."
---

# Phase 07: Site Roster Correction & Synthetic Data — Verification Report

**Phase Goal:** Replace the 5-site roster (UKA/UKB/LMU/UKT/UKM) with the 7 real EyeMatics sites (Aachen, Chemnitz, Dresden, Greifswald, Leipzig, Mainz, Tübingen) and populate matching synthetic FHIR bundles for the 5 new sites via a reproducible generator.

**Verified:** 2026-04-14T22:40:00Z
**Status:** human_needed (automated checks PASS; 2 items require human verification per roadmap SC wording)
**Re-verification:** No — initial verification

## Goal Achievement

### Roadmap Success Criteria (the contract)

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| 1 | Admin cohort filter shows exactly the 7 new sites with correct German city names; Bonn/München/Münster absent from UI | VERIFIED (data) / NEEDS HUMAN (UI render) | `data/centers.json` has exactly 7 entries with correct city names; `src/services/fhirLoader.ts _centerShorthands` maps the same 7 org IDs; `src/pages/CohortBuilderPage.tsx` + `src/i18n/translations.ts` contain 0 hits for UKB/UKM[^Z]/LMU/Bonn/München/Münster. Admin user in `data/users.json` has exactly the 7 centers. UI render requires human spot check. |
| 2 | Center-filtering on all data endpoints operates over new 7-site roster; unauthorized cross-site access still fails with 403 | VERIFIED (tests) / NEEDS HUMAN (live 403) | `tests/centerBypass.test.ts`, `tests/dataApiCenter.test.ts`, `tests/fhirApi.test.ts` updated for 7-entry roster and all pass. `server/fhirApi.ts isBypass()` rewritten from `length >= N` to explicit set-membership loop (mitigates T-07-02). Full suite 240/240 green. Live 403 check against running server left for human verification. |
| 3 | `npm run generate-bundles` regenerates 5 new-site bundles deterministically; files load via fhirLoader.ts and pass existing fhirApi/dataApiCenter/centerBypass tests | VERIFIED | `npm run generate-bundles` executed successfully (exit 0, 5 "wrote …" lines). Shasums stable across two consecutive runs — matches SUMMARY-recorded values (chemnitz e22e92d3…, dresden fd7f5909…, greifswald e5248874…, leipzig 58484f97…, mainz 393c78e1…). `tests/generatedBundles.test.ts` (5 sub-tests) passes through fhirLoader `extractCenters`/`extractPatientCases`. Downstream tests (fhirApi/dataApiCenter/centerBypass) pass (21/21). |
| 4 | `data/users.json` migration runs on server startup and leaves every user with at least one valid center from the new roster | VERIFIED | `server/initAuth.ts` lines 269–294: `REMOVED_CENTER_IDS` Set + `_migrateRemovedCenters` exported + chained in `_migrateUsersJson` AFTER `_migrateCenterIds` (line 336). On-disk `data/users.json` shows all 7 users have centers from new roster only; forscher2=[org-ukc], diz_manager=[org-ukmz], epidemiologe=[org-uka,org-ukc,org-ukd], no empty arrays. `tests/initAuthMigration.test.ts` passes (4 tests covering strip / fallback / all-removed / already-clean). |
| 5 | Docs and i18n strings for centers are coherent — grep for `UKB\|UKM\|LMU\|Bonn\|München\|Münster` in src/, server/, docs/, tests/ returns no functional hits | VERIFIED | `grep -rnE "UKB\|UKM[^Z]\|LMU\|Bonn\|Münster\|Muenster\|München\|Muenchen" src/ server/ tests/` → 1 hit at `server/initAuth.ts:263` (documented comment in migration code explaining removal scope). `docs/` has 2 hits, both accepted per plan: (a) Lastenheft.md:39 — real-world BC-coverage consortium fact (Münster clinical site is a data-collection partner, not a software roster claim); (b) Lastenheft.md:520 — v1.5 Anmerkung appended to document the roster change. README + Konfiguration.md + Benutzerhandbuch.md clean (5 / 13 / ≥1 hits respectively for new site names; 0 for removed). |

**Score:** 5/5 roadmap success criteria verified (2 with data-layer confirmation + runtime UI/403 checks deferred to human per criterion wording)

### Required Artifacts

| Artifact | Level 1 Exists | Level 2 Substantive | Level 3 Wired | Level 4 Data Flows | Status |
|----------|---------------|---------------------|---------------|--------------------|--------|
| `data/centers.json` | YES | YES — 7 entries, correct IDs | YES — loaded by `initCenters()` in `server/constants.ts` | N/A (config) | VERIFIED |
| `server/constants.ts` (DEFAULT_CENTERS) | YES | YES — 7-entry literal mirrors centers.json | YES — fallback path used by `getCenters()` and `getValidCenterIds()` | N/A | VERIFIED |
| `src/services/fhirLoader.ts` (_centerShorthands) | YES | YES — 7 org→shorthand entries (lines 155-163) | YES — consumed by `centerIdToShorthand`; refreshed via `/api/fhir/centers` | N/A | VERIFIED |
| `server/initAuth.ts` (SHORTHAND_TO_ORG + _migrateRemovedCenters) | YES | YES — new sites in SHORTHAND_TO_ORG; REMOVED_CENTER_IDS Set; `_migrateRemovedCenters` exported | YES — `_migrateUsersJson` chains both migrations before any handler mounts | YES — rewrites data/users.json via `_atomicWrite` at startup | VERIFIED |
| `scripts/prng.ts` | YES | YES — `mulberry32`, `seededRandInt`, `seededPick`, `addDays` | YES — imported by `generate-center-bundle.ts` line 30 | N/A (lib) | VERIFIED |
| `scripts/generate-center-bundle.ts` | YES | YES — CLI flags + `generateCenterBundle` exported; covers AMD/DME/RVO, LOINC 79880-1/LP267955-5/56844-4, SNOMED 36189003, ATC S01LA05/L01XC07 | YES — imported by `generate-all-bundles.ts` line 19 | YES — emits bundles consumed by production fhirLoader path | VERIFIED |
| `scripts/generate-all-bundles.ts` | YES | YES — 5-site SITES list with per-site fixed seeds; excludes aachen/tuebingen (T-07-04 mitigation) | YES — invoked by `npm run generate-bundles` | YES — writes 5 bundle files | VERIFIED |
| `package.json` (generate-bundles script) | YES | YES — `"generate-bundles": "node --import tsx scripts/generate-all-bundles.ts"` | YES — `npm run generate-bundles` exits 0 | N/A | VERIFIED |
| `public/data/manifest.json` | YES | YES — exactly 7 alphabetical entries | YES — consumed by fhirApi bundle loader | YES (file list) | VERIFIED |
| `public/data/center-chemnitz.json` | YES | YES — 45 Patients, Organization id=org-ukc | YES — manifest-listed, fhirLoader-consumed | YES — smoke test passes | VERIFIED |
| `public/data/center-dresden.json` | YES | YES — 45 Patients, Organization id=org-ukd | YES | YES | VERIFIED |
| `public/data/center-greifswald.json` | YES | YES — 45 Patients, Organization id=org-ukg | YES | YES | VERIFIED |
| `public/data/center-leipzig.json` | YES | YES — 45 Patients, Organization id=org-ukl | YES | YES | VERIFIED |
| `public/data/center-mainz.json` | YES | YES — 45 Patients, Organization id=org-ukmz | YES | YES | VERIFIED |
| `data/users.json` (migrated) | YES | YES — 7 users, all centers from new roster, passwordHash preserved | YES — rewritten by startup migration | YES | VERIFIED |
| `server/index.ts` (default seed) | YES | YES — only new-roster IDs | YES — used when users.json missing | N/A | VERIFIED |
| `tests/generateCenterBundle.test.ts` | YES | YES — determinism + structural invariants | YES — vitest run, passes | N/A | VERIFIED |
| `tests/generatedBundles.test.ts` | YES | YES — 5 sub-tests through fhirLoader | YES — passes | N/A | VERIFIED |
| `tests/initAuthMigration.test.ts` | YES | YES — 4 tests (strip / fallback / all-removed / already-clean) | YES — passes | N/A | VERIFIED |
| README.md (7-site Centres table) | YES | YES — 5 new city names present; 0 removed-site hits | N/A (docs) | N/A | VERIFIED |
| docs/Konfiguration.md | YES | YES — 7-entry centers.json example + default-users table | N/A | N/A | VERIFIED |
| docs/Benutzerhandbuch.md | YES | YES — admin UI center list updated | N/A | N/A | VERIFIED |
| docs/Lastenheft.md | YES | YES — v1.5 Anmerkung appended documenting roster restriction | N/A | N/A | VERIFIED |
| docs/Pflichtenheft.md | YES | YES (no-op — zero roster references in file) | N/A | N/A | VERIFIED |
| Deleted: public/data/center-bonn.json | N/A | N/A | N/A | N/A | VERIFIED (absent) |
| Deleted: public/data/center-muenchen.json | N/A | N/A | N/A | N/A | VERIFIED (absent) |
| Deleted: public/data/center-muenster.json | N/A | N/A | N/A | N/A | VERIFIED (absent) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `server/constants.ts` | `data/centers.json` | `initCenters` loads file; DEFAULT_CENTERS fallback | WIRED | Same 7 entries in both; `getValidCenterIds()` returns 7-entry Set |
| `src/services/fhirLoader.ts` | `/api/fhir/centers` | `loadCenterShorthands()` at startup | WIRED | Default has 7 entries; fetch updates from server |
| `scripts/generate-center-bundle.ts` | `scripts/prng.ts` | `mulberry32` import (line 30) | WIRED | Named imports: addDays, mulberry32, seededPick, seededRandInt |
| `scripts/generate-all-bundles.ts` | `scripts/generate-center-bundle.ts` | `generateCenterBundle()` call (line 43) | WIRED | Import line 19; 5 SITES iterated |
| `public/data/manifest.json` | `public/data/center-*.json` | 7-filename list consumed by fhirApi | WIRED | All 7 bundle filenames present; all 7 bundle files on disk |
| `server/fhirApi.ts` | `public/data/center-chemnitz.json` | runtime bundle load | WIRED | Bundle exists; loader test in `tests/generatedBundles.test.ts` confirms through `extractCenters`/`extractPatientCases` |
| `server/index.ts` | `server/initAuth.ts` | `initAuth()` → `_migrateUsersJson()` → `_migrateRemovedCenters()` | WIRED | Chain executed before router mount; order: passwordHash → _migrateCenterIds → _migrateRemovedCenters |
| `data/users.json` | `server/initAuth.ts` | startup migration reads/rewrites | WIRED | `_atomicWrite` preserves bytewise passwordHash; on-disk state already migrated |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|---------------------|--------|
| `public/data/center-*.json` (5 files) | `bundle.entry[*].resource.*` | `scripts/generate-center-bundle.ts` via seeded Mulberry32 | YES — 45 patients × real FHIR resources per site; smoke test verifies ≥1 IVOM procedure, ≥1 visus obs, ≥1 ATC-coded MedicationStatement per patient | FLOWING |
| `data/users.json` | `users[*].centers` | `_migrateRemovedCenters` via startup chain | YES — on-disk state rewritten to new roster; 7 users, all non-empty; correct reassignments (forscher2=ukc, diz_manager=ukmz, epidemiologe=[uka,ukc,ukd]) | FLOWING |
| `server/constants.ts` (_centers cache) | `_centers` | `initCenters` reads `data/centers.json` or falls back to DEFAULT_CENTERS | YES — both paths yield 7-entry roster | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `npm run generate-bundles` exits 0 and emits 5 bundles | `npm run generate-bundles` | exit 0; 5 "wrote …" lines | PASS |
| Determinism across consecutive runs | `shasum public/data/center-*.json` twice | Byte-identical output (e22e92d3…, fd7f5909…, e5248874…, 58484f97…, 393c78e1…); matches SUMMARY-recorded hashes | PASS |
| Generated bundles have correct Organization id + 45 patients | `node -e ".../center-chemnitz.json"` / mainz | chemnitz: org-ukc / 45 patients; mainz: org-ukmz / 45 patients | PASS |
| Full vitest suite green | `npm test` | 23 files, 240 tests, all passing | PASS |
| TypeScript builds clean | `npx tsc -b --noEmit` | No output, exit 0 | PASS |
| Roster-pinned test subset | `npx vitest run tests/initAuthMigration.test.ts tests/generateCenterBundle.test.ts tests/generatedBundles.test.ts tests/fhirApi.test.ts tests/dataApiCenter.test.ts tests/centerBypass.test.ts tests/constants.test.ts` | 7 files / 48 tests passing | PASS |
| `npm run generate-bundles` script entry | `grep -c '"generate-bundles"' package.json` | 1 | PASS |
| No new deps | `grep -c 'seedrandom\|random-seed' package.json` | 0 | PASS |
| Removed bundle files absent | `ls public/data/center-bonn.json center-muenchen.json center-muenster.json` | All three: "No such file or directory" | PASS |
| Grep sweep (functional code) | `grep -rnE "UKB\|UKM[^Z]\|LMU\|Bonn\|Münster\|Muenster\|München\|Muenchen" src/ server/ tests/` | 1 hit: server/initAuth.ts:263 (documented migration comment) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SITE-01 | 07-01 | 7 centers in `data/centers.json` + `server/constants.ts DEFAULT_CENTERS` | SATISFIED | Both files verified; 7 entries each, exact id set |
| SITE-02 | 07-01 | Client-side `_centerShorthands` map matches 7-center roster | SATISFIED | `src/services/fhirLoader.ts` lines 155-163 |
| SITE-03 | 07-01, 07-03 | Removed IDs absent from config/users/bundles/tests; stale bundle files deleted | SATISFIED | Grep returns 0 functional hits in src/server/tests (only 1 documentation comment); 3 bundle files deleted; users.json clean |
| SITE-04 | 07-03 | users.json migration strips + fallback to org-uka | SATISFIED | `_migrateRemovedCenters` + chaining + on-disk users.json clean |
| SITE-05 | 07-01, 07-03 | Roster-pinned tests updated and pass | SATISFIED | 6 roster-pinned test files updated; 240/240 suite green; new `tests/initAuthMigration.test.ts` covers migration |
| SITE-06 | 07-03 | UI strings/locales no longer reference removed sites | SATISFIED | i18n/translations.ts and CohortBuilderPage.tsx: 0 hits for removed site names |
| SITE-07 | 07-03 | Docs describe 7-site roster consistently | SATISFIED | README + Konfiguration + Benutzerhandbuch sweep clean; Lastenheft has documented historical residual + v1.5 Anmerkung; Pflichtenheft no-op (no roster refs originally) |
| DATA-GEN-01 | 07-02 | Generator produces valid FHIR R4 Bundle matching center-aachen shape | SATISFIED (with documented deviation) | `scripts/generate-center-bundle.ts` emits Organization + Patient/Condition/Observation/Procedure/MedicationStatement. **Deviation:** `ImagingStudy` entries intentionally omitted — no OCT assets exist for generated sites (referenced in 07-02 PLAN `<behavior>` bullet "NO ImagingStudy entries for the 5 generated sites"); deviation is security/integrity motivated (avoid broken asset refs) not a stub. |
| DATA-GEN-02 | 07-02 | AMD/DME/RVO cohorts configurable | SATISFIED | Default mix `amd: 0.55, dme: 0.30, rvo: 0.15`; SNOMED codes 267718000/312903003/362098006 present in generator |
| DATA-GEN-03 | 07-02 | Longitudinal trajectory per patient (visus/IVOM/CRT/medications) | SATISFIED | LOINC 79880-1 (visus), LP267955-5 (CRT), 56844-4 (IOP); SNOMED 36189003 (IVOM, 1-20 per patient); ATC S01LA05/L01XC07 (aflibercept/bevacizumab) |
| DATA-GEN-04 | 07-02 | Deterministic given seed | SATISFIED | Mulberry32 + seed-derived meta.lastUpdated + byte-identical shasum across runs |
| DATA-GEN-05 | 07-02 | `npm run generate-bundles` regenerates 5 bundles @ ~45 patients to public/data/ | SATISFIED | Script in package.json; exit 0; all 5 files emitted with 45 patients each |
| DATA-GEN-06 | 07-02 | Generated bundles load via fhirLoader and satisfy schema expectations | SATISFIED | `tests/generatedBundles.test.ts` passes through `extractCenters`/`extractPatientCases`; 240-test suite green |

All 13 requirement IDs accounted for across plans 07-01 / 07-02 / 07-03. Zero orphaned requirements (all IDs that REQUIREMENTS.md maps to Phase 7 appear in at least one PLAN frontmatter).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `server/initAuth.ts` | 263 | Comment mentions removed sites: "v1.5 roster correction removes Bonn (org-ukb), München (org-lmu), Münster (org-ukm)." | Info | Intentional — documents migration intent. Removing would harm code readability. Accepted by plan 07-03. |
| `docs/Lastenheft.md` | 39 | "Ca. 20% BC-Abdeckung in Münster" | Info | Domain-level real-world BC coverage fact about EyeMatics consortium site, not a software roster claim. Accepted by plan 07-03. |
| `docs/Lastenheft.md` | 520 | v1.5 Anmerkung names removed sites explicitly | Info | Required change-tracking note. Accepted by plan 07-03. |

No blocker or warning anti-patterns found. No TODO/FIXME/PLACEHOLDER/stub returns in modified files. Generator generates real FHIR data (not placeholder arrays).

### Deviations (Documented in Plans)

- **DATA-GEN-01 — ImagingStudy omitted:** The generator does NOT emit `ImagingStudy` resources. Rationale (07-02 decisions): "the OCT jpeg asset library only has images for Aachen and Tübingen; emitting references to non-existent files would break the case detail page." This is a security/integrity-motivated intentional deviation, explicitly documented in the plan's `<behavior>` block and in SUMMARY "Decisions". Covered resource types (Organization + Patient + Condition + Observation + Procedure + MedicationStatement) still match the Aachen reference for every non-image resource. Not scored as a gap.

### Human Verification Required

#### 1. Admin cohort filter UI shows the 7 new sites

**Test:** Log in as `admin` and open the cohort filter / admin center selector page in the browser.
**Expected:** Exactly 7 options visible with the German city names (Aachen, Chemnitz, Dresden, Greifswald, Leipzig, Mainz, Tübingen); none of Bonn, München, Münster, Universitätsklinikum Bonn, LMU, etc. appear.
**Why human:** Roadmap SC1 explicitly calls out an admin UI rendering. All data-layer sources are verified clean, but the rendered widget behavior is a runtime UI concern that grep cannot fully assert.

#### 2. Unauthorized cross-site access returns 403 on a live server

**Test:** Start the server (`npm start`) and exercise `/api/fhir/bundles?center=org-ukd` and representative `/api/data/*` endpoints as a user whose `centers` does not include `org-ukd`.
**Expected:** HTTP 403 for the unauthorized center; 200 (or the usual success) for authorized centers.
**Why human:** Roadmap SC2 requires live-endpoint confirmation. Unit tests (`centerBypass.test.ts`, `dataApiCenter.test.ts`, `fhirApi.test.ts`) cover the logic and all pass (240/240 suite), but a live 403 against the 7-site roster is a runtime check outside vitest scope.

### Gaps Summary

No blocking gaps were found. Every must-have in the three PLAN frontmatters (Plan 07-01, 07-02, 07-03) is satisfied in the actual codebase:

- **Config layer (Plan 07-01):** `data/centers.json`, `DEFAULT_CENTERS`, `_centerShorthands`, `SHORTHAND_TO_ORG`, `isBypass()` all pinned to the 7-site roster; 6 roster-pinned test files updated and passing.
- **Generator (Plan 07-02):** `scripts/prng.ts`, `scripts/generate-center-bundle.ts`, `scripts/generate-all-bundles.ts`, `npm run generate-bundles` wired; 5 bundles emitted with stable SHAs; `tests/generateCenterBundle.test.ts` + `tests/generatedBundles.test.ts` pass; determinism re-confirmed during this verification run.
- **Migration + Docs (Plan 07-03):** `_migrateRemovedCenters` exported and chained after `_migrateCenterIds` in `_migrateUsersJson`; on-disk `data/users.json` migrated; 3 stale bundle files deleted; docs sweep clean except documented historical residuals.

Status is `human_needed` because roadmap SC1 and SC2 explicitly describe UI and live-server behaviors that require a human spot check to confirm. All automated signals (tests, grep sweeps, determinism, wiring, data flow) are green.

---

_Verified: 2026-04-14T22:40:00Z_
_Verifier: Claude (gsd-verifier)_
