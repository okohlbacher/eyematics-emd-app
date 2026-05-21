---
phase: 31-subcohort-support
plan: "02"
subsystem: frontend-services
tags: [cohort, subcohort, parsing, normalization, grouping, pure-functions]
dependency_graph:
  requires: ["31-01"]
  provides: ["src/services/cohortNames.ts"]
  affects: ["CohortBuilderPage.tsx", "CohortCompareDrawer.tsx"]
tech_stack:
  added: []
  patterns: ["throw-only validation (D-03)", "pure function service module", "case-insensitive normalization (D-04)"]
key_files:
  created:
    - src/services/cohortNames.ts
  modified: []
decisions:
  - "groupByParent returns subcohortsByParentId map keyed by parent SavedSearch.id for O(1) drawer tree rendering"
  - "normalizeCohortName exported (not private) to satisfy cohortNames.test.ts direct import assertions"
  - "isDuplicateName accepts string[] for existingNames (flexible; callers extract names from SavedSearch[])"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-21"
  tasks_completed: 1
  tasks_total: 1
requirements: [KOH-003]
---

# Phase 31 Plan 02: Implement cohortNames.ts Service Summary

Pure-function service module providing subcohort name parsing (throw-only), case-insensitive normalization (D-04 duplicate rule), and render-time tree grouping with no persisted state.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Implement cohortNames.ts (parseSubcohortName, isSubcohortName, normalizeCohortName, groupByParent) | 993cc2d | src/services/cohortNames.ts (+155 lines) |

## Verification

- `tests/cohortNames.test.ts`: 13/13 GREEN (all parseSubcohortName, isSubcohortName, normalizeCohortName assertions pass)
- `npm run build`: clean (no TypeScript errors)
- `git diff shared/types/fhir.ts`: empty (SavedSearch type unchanged, D-R2 satisfied)
- `grep -c "export function parseSubcohortName\|export function isSubcohortName\|export function groupByParent" src/services/cohortNames.ts`: 3

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The service module is fully implemented with no placeholder data.

## Threat Flags

None. All T-31-01 mitigations implemented: parseSubcohortName throws on 0/2+ colons and empty segments; normalizeCohortName prevents case/whitespace collisions in isDuplicateName.

## Self-Check: PASSED

- src/services/cohortNames.ts: FOUND
- Commit 993cc2d: FOUND
- cohortNames.test.ts 13/13 GREEN: VERIFIED
- SavedSearch type unchanged: VERIFIED
