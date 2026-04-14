---
phase: 07-site-roster-correction-synthetic-data
plan: 01
subsystem: config-and-roster
tags: [roster, centers, tests, migration, security]
one_liner: "Locked 7-site EyeMatics roster (UKA, UKC, UKD, UKG, UKL, UKMZ, UKT) across centers.json, DEFAULT_CENTERS, client shorthand map, SHORTHAND_TO_ORG migration table, isBypass set-membership check, and 6 roster-pinned test files."
requirements: [SITE-01, SITE-02, SITE-03, SITE-05]
wave: 1
depends_on: []
provides:
  - "Authoritative 7-site roster in data/centers.json"
  - "Matching DEFAULT_CENTERS fallback in server/constants.ts"
  - "Client _centerShorthands default map aligned with roster"
  - "SHORTHAND_TO_ORG extended for new sites (UKC/UKD/UKG/UKL/UKMZ)"
  - "isBypass() uses getValidCenterIds() set-membership (mitigates T-07-02)"
requires:
  - "Existing initCenters / getCenterShorthands / getValidCenterIds (unchanged from v1.1)"
affects:
  - "Plan 07-02 (generator) — consumes locked org IDs + filenames"
  - "Plan 07-03 (users migration + docs) — strips legacy org-ukb/org-lmu/org-ukm and deletes old bundle files"
key_files:
  created: []
  modified:
    - data/centers.json
    - server/constants.ts
    - src/services/fhirLoader.ts
    - server/initAuth.ts
    - server/fhirApi.ts
    - tests/constants.test.ts
    - tests/ui-requirements.test.ts
    - tests/centerBypass.test.ts
    - tests/fhirApi.test.ts
    - tests/dataApiCenter.test.ts
    - tests/fhirApiPlugin.test.ts
decisions:
  - "isBypass generalized from >= N count check to explicit set-membership loop; prevents bypass via N arbitrary strings"
  - "SHORTHAND_TO_ORG intentionally omits UKB/LMU/UKM — legacy users.json entries pass through unchanged until Plan 07-03 runs _migrateRemovedCenters"
  - "Generic fixtures in tests/ui-requirements.test.ts (JWT payload example, filter examples) also migrated off removed IDs to keep verification grep clean"
metrics:
  duration: ~5 min (parallel executor)
  completed: 2026-04-14
tasks_completed: 3
tests_passing: 73
---

# Phase 07 Plan 01: Site Roster Correction (5 → 7 sites) Summary

## Locked 7-Site Roster

| org ID      | shorthand | full name                         | bundle file (public/data/) |
|-------------|-----------|-----------------------------------|----------------------------|
| org-uka     | UKA       | Universitätsklinikum Aachen       | center-aachen.json         |
| org-ukc     | UKC       | Universitätsklinikum Chemnitz     | center-chemnitz.json       |
| org-ukd     | UKD       | Universitätsklinikum Dresden      | center-dresden.json        |
| org-ukg     | UKG       | Universitätsklinikum Greifswald   | center-greifswald.json     |
| org-ukl     | UKL       | Universitätsklinikum Leipzig      | center-leipzig.json        |
| org-ukmz    | UKMZ      | Universitätsmedizin Mainz         | center-mainz.json          |
| org-ukt     | UKT       | Universitätsklinikum Tübingen     | center-tuebingen.json      |

- **Kept:** org-uka, org-ukt
- **Removed:** org-ukb (Bonn), org-lmu (München), org-ukm (Münster)
- **Added:** org-ukc, org-ukd, org-ukg, org-ukl, org-ukmz

## Files Modified

| File | Change |
|------|--------|
| `data/centers.json` | Replaced 5-entry JSON array with locked 7-entry roster |
| `server/constants.ts` | `DEFAULT_CENTERS` fallback mirrors 7-entry roster |
| `src/services/fhirLoader.ts` | `_centerShorthands` default now maps 7 org IDs to shorthands |
| `server/initAuth.ts` | `SHORTHAND_TO_ORG` extended with UKC/UKD/UKG/UKL/UKMZ (UKA+UKT kept); UKB/LMU/UKM removed |
| `server/fhirApi.ts` | `isBypass()` rewritten as explicit set-membership loop over `getValidCenterIds()` — every valid center must be present |
| `tests/constants.test.ts` | `VALID_CENTERS_JSON` fixture updated; length assertions `5` → `7`; UKB→UKC |
| `tests/ui-requirements.test.ts` | ANL-001 shorthand map now 7 entries; v1.1 validIds list now 7 entries; generic example fixtures updated |
| `tests/centerBypass.test.ts` | Mock `getValidCenterIds` returns 7-entry set; test titles and arrays updated (7 valid / <7 / 7 invalid / mix) |
| `tests/fhirApi.test.ts` | Renamed `BONN_BUNDLE` → `CHEMNITZ_BUNDLE` across 5 use sites; Organization id/name, Patient id/source, Observation id/subject all moved to org-ukc/pat-ukc; Blaze synthetic bundle's second Patient now on `org-ukc`; Test 3/4/5 arrays updated; Test 8 fixture uses only valid shorthands (UKA/UKC and UKD/UKT/UKG) |
| `tests/dataApiCenter.test.ts` | `mockCaseIndex` uses case-uka-001/case-ukc-001/case-ukd-001; admin token in Test 3 now has 7 centers; bypass threshold 5 → 7 |
| `tests/fhirApiPlugin.test.ts` | `getValidCenterIds` mock returns `['org-uka','org-ukc']` |

## Commits

| Task | Hash      | Message |
|------|-----------|---------|
| 1    | 32350f8   | feat(07-01): lock 7-site roster in centers.json and DEFAULT_CENTERS |
| 2    | 8dfed2e   | feat(07-01): update client shorthand default and SHORTHAND_TO_ORG for 7-site roster |
| 3    | ae59252   | test(07-01): update roster-pinned tests and isBypass for 7-site roster |

## Verification Results

- `npx vitest run tests/constants.test.ts tests/ui-requirements.test.ts tests/centerBypass.test.ts tests/fhirApi.test.ts tests/dataApiCenter.test.ts tests/fhirApiPlugin.test.ts` → **6 files passed, 73 tests passed, 0 failed**
- `npx tsc -b --noEmit` → clean (no errors)
- `node -e "..."` centers.json validator → `OK` (7 entries, exact id set)
- `grep -rE "org-ukb|org-lmu|org-ukm[^z]" src/services/ tests/constants.test.ts tests/ui-requirements.test.ts tests/centerBypass.test.ts tests/dataApiCenter.test.ts tests/fhirApiPlugin.test.ts` → 0 hits
- `grep -c "BONN_BUNDLE|pat-ukb|Universitätsklinikum Bonn" tests/fhirApi.test.ts` → 0 (Test 8 test2's `'org-ukb'` literal is a documented pass-through fixture)

## Deviations from Plan

### Auto-fixed (Rule 3 — unblocking plan verification)

**1. [Rule 3 - Blocker] Migrated generic example fixtures in tests/ui-requirements.test.ts off removed IDs**
- **Found during:** Task 3 acceptance-criteria verification
- **Issue:** The plan's top-level verification grep requires **zero hits** for `org-ukb|org-lmu|org-ukm[^z]` across `tests/ui-requirements.test.ts`, but the plan's explicit Task-3 line-level edits only covered the ANL-001 shorthand block (lines 358-365) and the v1.1 validIds (line 418). Several synthetic fixture blocks (JWT payload example line 44, cases fixture line 133, filter call line 153, center-filter example lines 436-444) still referenced old IDs.
- **Fix:** Updated those synthetic fixtures to use valid current-roster IDs (`org-ukc`, `org-ukd`) with no semantic change — the tests still exercise the same code paths.
- **Files modified:** tests/ui-requirements.test.ts
- **Commit:** ae59252 (combined with Task 3 commit)

### Scope Boundary (NOT fixed — out of scope per plan)

- `data/users.json` still contains `org-ukb`, `org-lmu`, `org-ukm` — **Plan 07-03** owns the users.json migration via a new `_migrateRemovedCenters()` on startup.
- `server/index.ts` "fallback default users" seed list still references old IDs — same as above; Plan 07-03 will update this seed list.
- Test 8 test2 fixture `centers: ['org-uka', 'org-ukb']` intentionally documents pass-through behavior of `_migrateCenterIds` for unknown already-migrated IDs — to be stripped by Plan 07-03's dedicated migration.
- Public bundle files `center-bonn.json`, `center-muenchen.json`, `center-muenster.json` still on disk — Plan 07-03 deletes them and Plan 07-02 generates the replacements.

## Threat Model Outcome

| Threat ID | Disposition | Outcome |
|-----------|-------------|---------|
| T-07-01 (Tampering: centers.json) | accept | Existing validation in `initCenters` unchanged — file still validated as `Array.isArray` + per-entry `id && shorthand` before acceptance. No new attack surface. |
| T-07-02 (InfoDisclosure: isBypass) | **mitigated** | `isBypass` rewritten to require actual membership of every valid center, not just `centers.length >= N`. Tested by "7 INVALID center strings does NOT bypass" and "mix of valid and invalid does NOT bypass". |
| T-07-03 (Elevation: removed-center pass-through) | deferred to 07-03 | Intentional — Plan 07-03's `_migrateRemovedCenters()` is the dedicated mitigation. Pass-through is tested (Test 8 test2) so behavior is locked and observable until then. |

## Self-Check: PASSED

- Files confirmed on disk:
  - FOUND: data/centers.json (7 entries)
  - FOUND: server/constants.ts (DEFAULT_CENTERS updated)
  - FOUND: src/services/fhirLoader.ts (_centerShorthands updated)
  - FOUND: server/initAuth.ts (SHORTHAND_TO_ORG updated)
  - FOUND: server/fhirApi.ts (isBypass rewritten)
  - FOUND: 6 test files updated
- Commits confirmed in `git log`:
  - FOUND: 32350f8 (Task 1)
  - FOUND: 8dfed2e (Task 2)
  - FOUND: ae59252 (Task 3)
- 73/73 vitest passing in roster-pinned scope.
