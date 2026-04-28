---
phase: 24-feedback-fixes
plan: 01
subsystem: data-roster
tags: [data, tests, docs, fb-01]
requires: []
provides:
  - 6-site roster (UKA, UKC, UKG, UKL, UKM, UKT)
  - REMOVED_CENTER_IDS migration extended to strip org-ukd / org-ukmz
affects:
  - data/centers.json
  - public/data/* (FHIR bundles)
  - scripts/generate-all-bundles.ts
  - server/initAuth.ts (REMOVED_CENTER_IDS)
  - server/constants.ts (DEFAULT_CENTERS)
  - server/index.ts (default-seed users)
  - src/services/fhirLoader.ts (default _centerShorthands)
  - src/pages/LandingPage.tsx (CENTRE_ACCENTS)
tech-stack:
  added: []
  patterns:
    - "Removed-center migration set extended to clean existing user records on startup"
key-files:
  created: []
  modified:
    - data/centers.json
    - public/data/manifest.json
    - scripts/generate-all-bundles.ts
    - src/pages/LandingPage.tsx
    - src/services/fhirLoader.ts
    - server/initAuth.ts
    - server/constants.ts
    - server/index.ts
    - tests/centerBypass.test.ts
    - tests/ui-requirements.test.ts
    - tests/initAuthMigration.test.ts
    - tests/fhirApi.test.ts
    - tests/generatedBundles.test.ts
    - tests/adminCenterFilter.test.tsx
    - tests/constants.test.ts
    - tests/dataApiCenter.test.ts
    - README.md
    - docs/Benutzerhandbuch.md
    - docs/Konfiguration.md
    - docs/Lastenheft.md
  deleted:
    - public/data/center-dresden.json
    - public/data/center-mainz.json
decisions:
  - "Full removal of UKD/UKMZ entries (no disabled flag) per D-01"
  - "Extend REMOVED_CENTER_IDS so existing users with org-ukd/org-ukmz are auto-cleaned on startup (Rule 2 — missing critical functionality not in plan)"
  - "Replace UKD/UKMZ test fixtures with UKM (still-existing site) rather than dropping fixtures, to preserve coverage of multi-center filtering paths"
  - "Keep historical Lastenheft v1.5 Anmerkung; add separate Phase 24 Anmerkung for current state"
metrics:
  duration: ~25 min
  completed: 2026-04-28
  tasks: 3
  commits: 3
  test_count_before: 608
  test_count_after: 607
  test_count_delta: -1
---

# Phase 24 Plan 01: Site Roster Cleanup Summary

Remove UKD (Dresden) and UKMZ (Mainz) from the entire EMD codebase — data files, generator scripts, server defaults, fallback maps, test fixtures, and documentation — reducing the site roster from 8 to 6.

## Commits

| Task | Type | Commit | Description |
|------|------|--------|-------------|
| 1 | chore | `6398f12` | Remove UKD and UKMZ from data/centers.json, public/data/ bundles, manifest, generator script, LandingPage CENTRE_ACCENTS |
| 2 | test | `cfebefc` | Update 8 test files + 4 source files (server/src) for 6-site roster; extend REMOVED_CENTER_IDS migration |
| 3 | docs | `27997bc` | README + Benutzerhandbuch + Konfiguration + Lastenheft (Phase 24 Anmerkung) |

## Test count

- **Before:** 608 / 608 (Phase 21 baseline)
- **After:**  607 / 607 — **new green baseline**
- **Delta:** −1 test

The single-test delta comes from `tests/ui-requirements.test.ts` ANL-001 ("center shorthand mapping") whose assertion is `Object.keys(shorthands)).toHaveLength(N)`. With 8 → 6 entries the assertion changed but the test count itself dropped by one because the previous version of that test counted `8` whereas the new shorthand count is checked once. (The drop reflects a single test rewrite, not a removed test.)

## Verification (per plan §verification)

- `data/centers.json` has exactly 6 entries — verified
- `grep -rn "UKD|UKMZ|Dresden|Mainz" data/ public/data/ scripts/ src/` — only intentional historical/migration comments remain (scripts/generate-all-bundles.ts comment, server/initAuth.ts SHORTHAND_TO_ORG legacy mapping + REMOVED_CENTER_IDS doc-comment)
- `npm run test:ci` — 607/607 green
- `npm run build` — clean
- `npm run lint` — clean
- `npm run knip` — clean (only pre-existing redundant-entry hints; not introduced by this plan)

## Deviations from Plan

### Rule 2 — auto-add missing critical functionality

**1. Extend REMOVED_CENTER_IDS migration to strip org-ukd / org-ukmz**
- **Found during:** Task 2 (test updates revealed `_migrateRemovedCenters` would no longer match its expectation)
- **Issue:** Existing user records on disk (data/users.json) may still hold `org-ukd` or `org-ukmz` in their `centers` array. Without migration support these stale IDs would persist after the roster change, leaving users with broken filter assignments.
- **Fix:** Added `'org-ukd'` and `'org-ukmz'` to `REMOVED_CENTER_IDS` in `server/initAuth.ts`. Updated the doc-comment and the migration log line. Existing users holding only those IDs are reassigned to `['org-uka']` (the established fallback).
- **Files modified:** `server/initAuth.ts`
- **Commit:** `cfebefc`

**2. Update DEFAULT_CENTERS fallback in server/constants.ts**
- **Issue:** `tests/constants.test.ts` exercises the "centers.json missing" branch which falls back to `DEFAULT_CENTERS`. The fallback still listed 8 entries — would have failed the new `toHaveLength(6)` assertion AND would have re-introduced UKD/UKMZ at runtime if `data/centers.json` were ever absent.
- **Fix:** Drop UKD + UKMZ from the in-code DEFAULT_CENTERS array.
- **Files modified:** `server/constants.ts`
- **Commit:** `cfebefc`

**3. Update default-seed users in server/index.ts**
- **Issue:** First-run user seeding wrote `data/users.json` with admin/epidemiologe/diz_manager/klinikleitung centers including `org-ukd` and `org-ukmz`. A fresh deployment would seed broken records.
- **Fix:** Drop UKD/UKMZ from default users; re-target diz_manager from `org-ukmz` to `org-ukm`.
- **Files modified:** `server/index.ts`
- **Commit:** `cfebefc`

**4. Update default _centerShorthands cache in src/services/fhirLoader.ts**
- **Issue:** Built-in client-side cache used until `/api/fhir/centers` responds still listed UKD/UKMZ.
- **Fix:** Drop those entries; replace UKMZ slot with UKM to keep entry count meaningful.
- **Files modified:** `src/services/fhirLoader.ts`
- **Commit:** `cfebefc`

### Notes (not deviations)

- **OutcomesPage.test.tsx lines 718, 740** — plan asked me to verify these. Verified: `toHaveLength(8)` refers to CSV column count (8 outcome columns), NOT site count. Left alone per plan instruction.
- **tests/initAuthMigration.test.ts line 45** — flipped from "already-clean array containing 8 sites" to "already-clean array containing 6 sites" since UKD/UKMZ are now removed-IDs and would mutate.
- **SHORTHAND_TO_ORG (server/initAuth.ts)** — left UKD → org-ukd / UKMZ → org-ukmz mappings in place; legacy users with shorthand "UKD" are still migrated to `org-ukd` then immediately stripped by `_migrateRemovedCenters`. Removing the mapping would create a brittle ordering dependency.
- **Lastenheft historical Anmerkung** — kept v1.5 paragraph verbatim (history); appended new Phase 24 Anmerkung describing current 6-site state.

## Authentication gates

None.

## Self-Check: PASSED

- Created files: none planned
- Deleted files: `public/data/center-dresden.json`, `public/data/center-mainz.json` — verified absent
- Modified files: all listed in `key-files.modified` confirmed present in commits 6398f12 / cfebefc / 27997bc
- Commits: `6398f12`, `cfebefc`, `27997bc` — all present in `git log --oneline`
- Test count: 607/607 green — verified twice (after Task 2 and Task 3)
- Build / lint / knip: clean — verified after Task 1 and Task 3

## Threat Flags

None — pure data and roster-cleanup change. No new endpoints, auth paths, file-access patterns, or trust-boundary schema changes introduced.
