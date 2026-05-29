---
phase: 40-savedsearch-quality-config
fixed_at: 2026-05-25T21:39:00.000Z
review_path: .planning/phases/40-savedsearch-quality-config/40-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 40: Code Review Fix Report

**Fixed at:** 2026-05-25T21:39:00Z
**Source review:** `.planning/phases/40-savedsearch-quality-config/40-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (CR-01, WR-01, WR-02, WR-03)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: QualityPage crashes scoping to a flaggedQuality cohort (Set vs array wire mismatch)

**Files modified:** `src/pages/QualityPage.tsx`, `tests/qualityFlaggedCohortRoundTrip.test.tsx`
**Commit:** `d7dcf5a`
**Applied fix:**
- Added `import { safePickCohortFilter } from '../utils/cohortFilterSerialization'` to `QualityPage.tsx` (sorted to the `../utils/` group with adjacent imports).
- Changed `applyFilters(cases, selectedSearch.filters, {...})` to `applyFilters(cases, safePickCohortFilter(selectedSearch.filters), {...})` in the `scopedCases` useMemo. This reconstructs `flaggedCaseIds` from the server's `string[]` wire form into a `Set` before `applyFilters` calls `.has()` on it.
- Added regression test file `tests/qualityFlaggedCohortRoundTrip.test.tsx` with 3 tests: (1) no throw when `flaggedCaseIds` is a plain `string[]`; (2) correct scoping — cases in `flaggedCaseIds` are visible, others hidden; (3) restoring "All cases" shows both cases again. All 3 pass.

### WR-01: Center-ownership validation checks never-persisted fields

**Files modified:** `server/dataApi.ts`, `tests/dataApiSavedSearch.test.ts`
**Commit:** `cdd71b4`
**Applied fix:**
- In `POST /saved-searches`, replaced the dead `caseIds`/`selectedCases` array extraction with a `flaggedCaseIds` extraction — the only whitelisted `CohortFilter` field that carries explicit case references and is actually persisted to the DB.
- Updated the comment to explain that `caseIds`/`selectedCases` are not in `CohortFilter`, are stripped by `sanitizeSavedSearchFilters`, and therefore are not a center-bypass vector.
- Updated test (e) in `dataApiSavedSearch.test.ts` to use `flaggedCaseIds` (now the validated field) instead of `caseIds`; added test (e2) asserting that `caseIds` is silently stripped and returns 201 — not 403.

### WR-02: Stale validateCaseCenters comment contradicts isBypass (admin-only, F-05)

**Files modified:** `server/dataApi.ts`
**Commit:** `cdd71b4`
**Applied fix:**
- Updated the `validateCaseCenters` JSDoc from "Admin users and users with all centers bypass validation (same logic as isBypass)" to "Only admin users bypass validation (see isBypass / F-05)" to accurately reflect the `isBypass` implementation.

### WR-03: getSavedSearches returns legacy filters without read-side sanitize

**Files modified:** `server/dataApi.ts`
**Commit:** `cdd71b4`
**Applied fix:**
- In the `GET /saved-searches` handler, changed `filters: JSON.parse(r.filters) as unknown` to `filters: sanitizeSavedSearchFilters(JSON.parse(r.filters) as unknown)` — defense-in-depth for legacy rows that pre-date the F-13 write-side whitelist. Strips any unknown keys from rows that were persisted before `sanitizeSavedSearchFilters` was applied on write.

## Skipped Issues

None — all in-scope findings were fixed.

---

**Final test results:** `npm run test:ci` — 1012 passed / 0 failed (1008 baseline + 4 new regression tests).
**Final lint results:** `npm run lint` — 0 errors in modified files; 2 pre-existing issues in unmodified `tests/qualityCohortScope.test.tsx` (LOINC_VISUS unused var + import sort) that existed before this fix session.

_Fixed: 2026-05-25T21:39:00Z_
_Fixer: Claude Sonnet 4.6 (gsd-code-fixer)_
_Iteration: 1_
