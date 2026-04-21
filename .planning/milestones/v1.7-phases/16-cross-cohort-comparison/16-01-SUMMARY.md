---
phase: 16-cross-cohort-comparison
plan: "01"
subsystem: outcomes-palette-i18n
tags: [palette, i18n, test-scaffold, accessibility, WCAG]
requirements: [VIS-04]

dependency_graph:
  requires: []
  provides:
    - COHORT_PALETTES constant in palette.ts (consumed by Plans 02/03/04)
    - VIS-04 SERIES_STYLES updates (perPatient gray, median strokeWidth 4)
    - 7 i18n keys for cross-cohort UI (consumed by Plans 02/03/04)
    - Wave-0 test scaffold cohortCompareDrawer.test.tsx (un-skipped by Plan 03)
  affects:
    - src/components/outcomes/palette.ts
    - src/i18n/translations.ts
    - tests/outcomesPalette.contrast.test.ts
    - tests/cohortCompareDrawer.test.tsx

tech_stack:
  added: []
  patterns:
    - COHORT_PALETTES uses `as const satisfies readonly string[]` for type safety with mutable-array guards
    - Wave-0 describe.skip scaffold pattern (Plan 03 flips to describe)
    - WCAG 3:1 graphical contrast threshold verified per-color in test suite

key_files:
  created:
    - tests/cohortCompareDrawer.test.tsx
  modified:
    - src/components/outcomes/palette.ts
    - src/i18n/translations.ts
    - tests/outcomesPalette.contrast.test.ts

decisions:
  - COHORT_PALETTES locked to emerald/amber/cyan/fuchsia family — distinct from blue/red/violet EYE_COLORS
  - Wave-0 scaffold kept under describe.skip; import of CohortCompareDrawer stays commented until Plan 03

metrics:
  duration: "~3 minutes"
  completed_date: "2026-04-21"
  tasks_completed: 3
  tasks_total: 3
  files_created: 1
  files_modified: 3
---

# Phase 16 Plan 01: Palette + i18n Foundations Summary

COHORT_PALETTES (4 WCAG-3:1-compliant colors), VIS-04 SERIES_STYLES updates (perPatient gray #9ca3af at 0.22/0.12 opacity, median strokeWidth 4), 7 cross-cohort i18n keys, and Wave-0 test scaffold — all foundations for Plans 02/03/04.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add COHORT_PALETTES + VIS-04 SERIES_STYLES | 6897563 | palette.ts, outcomesPalette.contrast.test.ts |
| 2 | Add 7 i18n keys for Phase 16 UI copy | 908aca0 | translations.ts |
| 3 | Create Wave-0 test scaffold | 8064fcd | tests/cohortCompareDrawer.test.tsx |

## Verification Results

```
Test Files  2 passed | 1 skipped (3)
Tests       19 passed | 4 skipped (23)
TypeScript  npx tsc --noEmit → exit 0
```

## Acceptance Criteria Check

- [x] COHORT_PALETTES exports 4 WCAG-3:1-compliant hex strings, distinct from EYE_COLORS
- [x] SERIES_STYLES.perPatient.color === '#9ca3af', opacityDense 0.22, opacitySparse 0.12
- [x] SERIES_STYLES.median.strokeWidth === 4 (was 3)
- [x] `strokeWidth: 3` no longer present in palette.ts
- [x] 7 i18n keys present with DE+EN: outcomesCompareDrawerTitle, outcomesCompareDrawerHint, outcomesComparePrimaryLabel, outcomesCompareOpenDrawer, outcomesCrossMode, outcomesCompareReset, outcomesComparePerPatientSuppressed
- [x] tests/cohortCompareDrawer.test.tsx exists with describe.skip, XCOHORT-01 (x2), XCOHORT-03
- [x] All targeted test files exit 0

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan creates pure constants and test scaffolds; no UI rendering paths introduced.

## Threat Flags

None — plan introduces only static color tables, i18n strings, and a test scaffold. No network endpoints, auth paths, file access, or schema changes.

## Self-Check

```bash
[ -f "src/components/outcomes/palette.ts" ] # FOUND
[ -f "src/i18n/translations.ts" ]           # FOUND
[ -f "tests/outcomesPalette.contrast.test.ts" ] # FOUND
[ -f "tests/cohortCompareDrawer.test.tsx" ]  # FOUND
```

git log --oneline:
- 8064fcd test(16-01): add Wave-0 scaffold cohortCompareDrawer.test.tsx
- 908aca0 feat(16-01): add 7 Phase 16 i18n keys for cross-cohort comparison UI
- 6897563 feat(16-01): add COHORT_PALETTES + VIS-04 SERIES_STYLES changes to palette.ts

## Self-Check: PASSED
