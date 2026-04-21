---
phase: 16-cross-cohort-comparison
plan: "02"
subsystem: outcomes-panel-cross-cohort
tags: [recharts, multi-series, chart-extension, XCOHORT-02, XCOHORT-03, VIS-04]
requirements: [XCOHORT-02, XCOHORT-03, VIS-04]

dependency_graph:
  requires:
    - COHORT_PALETTES from palette.ts (Plan 01)
    - SERIES_STYLES.perPatient.color (#9ca3af) from palette.ts (Plan 01)
    - SERIES_STYLES.median.strokeWidth (4) from palette.ts (Plan 01)
  provides:
    - CohortSeriesEntry interface exported from OutcomesPanel.tsx (consumed by Plans 03/04)
    - cohortSeries?: CohortSeriesEntry[] prop on OutcomesPanel (consumed by Plan 04)
    - isCrossMode logic: per-patient/scatter/IQR/median suppressed when cohortSeries active
    - VIS-04 per-patient stroke change to #9ca3af (single-cohort mode)
  affects:
    - src/components/outcomes/OutcomesPanel.tsx
    - tests/OutcomesPanel.test.tsx

tech_stack:
  added: []
  patterns:
    - Backward-compatible optional prop pattern (cohortSeries? — undefined = single-cohort mode unchanged)
    - isCrossMode guard wrapping all single-cohort Recharts elements
    - Cross-mode renders IQR Area + median Line per CohortSeriesEntry in array order
    - Recharts mock extended with data-stroke/data-stroke-width/data-name attributes for DOM assertions

key_files:
  created: []
  modified:
    - src/components/outcomes/OutcomesPanel.tsx
    - tests/OutcomesPanel.test.tsx

decisions:
  - Empty-state in cross mode uses sum of cohortSeries[*].panel.summary.patientCount so a valid cross comparison with all-zero sub-panels triggers the empty state correctly
  - IQR Areas in cross mode carry legendType="none" (Pitfall 1 from RESEARCH.md) to prevent per-cohort IQR chips in legend
  - Per-cohort IQR baseLine is a coordinate array (Pitfall 2 from RESEARCH.md), not a dataKey string
  - Recharts mock in test file extended (not replaced) to add data-* attribute forwarding for stroke/strokeWidth/name

metrics:
  duration: "~10 minutes"
  completed_date: "2026-04-21"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 2
---

# Phase 16 Plan 02: OutcomesPanel Cross-Cohort Extension Summary

OutcomesPanel extended with backward-compatible `cohortSeries?: CohortSeriesEntry[]` prop; in cross-cohort mode renders one IQR Area + one median Line per entry (XCOHORT-02); each median Line name follows `{name} (N={count} patients)` format (XCOHORT-03); per-patient/scatter/single-cohort layers suppressed in cross mode; VIS-04 per-patient stroke changed from eye color to #9ca3af.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend OutcomesPanel with cohortSeries prop + suppress per-patient in cross mode | d2c3347 | OutcomesPanel.tsx |
| 2 | Extend tests with cross-cohort + VIS-04 assertions | 454ffae | OutcomesPanel.test.tsx |

## Verification Results

```
npx tsc --noEmit → exit 0
npx vitest run tests/OutcomesPanel.test.tsx tests/outcomesIqrSparse.test.tsx tests/outcomesPalette.contrast.test.ts
Test Files  3 passed (3)
Tests       26 passed (26)
```

## Acceptance Criteria Check

Task 1:
- [x] `export interface CohortSeriesEntry` present in OutcomesPanel.tsx (line 25)
- [x] `cohortSeries?: CohortSeriesEntry[]` in Props interface (line 45)
- [x] `const isCrossMode` computed after subtitle (line 100)
- [x] `!isCrossMode && layers.perPatient` guards per-patient loop (line 213)
- [x] `!isCrossMode && layers.median` guards single-cohort median Line (line 250)
- [x] `!isCrossMode && layers.spreadBand` guards single-cohort IQR Area (line 199)
- [x] `!isCrossMode && layers.scatter` guards scatter Scatter (line 239)
- [x] `stroke={SERIES_STYLES.perPatient.color}` applied on per-patient Line (line 226)
- [x] `(N=${series.patientCount} patients)` in cross-mode median Line name (line 294)
- [x] `stroke={color}` in per-patient map block: 0 matches (replaced by SERIES_STYLES reference)
- [x] `npx tsc --noEmit` exits 0
- [x] `npx vitest run tests/OutcomesPanel.test.tsx tests/outcomesIqrSparse.test.tsx` exits 0

Task 2:
- [x] XCOHORT-02 in tests/OutcomesPanel.test.tsx: 5 matches (>= 2 required)
- [x] XCOHORT-03: 3 matches (>= 1 required)
- [x] VIS-04: 4 matches (>= 2 required)
- [x] cohortSeries references: 5 matches (>= 4 required)
- [x] #9ca3af: 3 matches (>= 1 required)
- [x] Total it() count: 9 (was 3, added 6, >5 new tests)
- [x] `npx vitest run tests/OutcomesPanel.test.tsx` exits 0

## Deviations from Plan

### Auto-fixed Issues

None.

### Implementation Notes

The plan's Task 2 test selectors were adapted slightly from the template code in the plan:
- Plan used `container.querySelector('[data-testid*="line"]')` (substring match); implementation uses `[data-testid="recharts-line"]` (exact) since the mock renders `data-testid="recharts-line"`.
- An extra scatter-suppression test was added (XCOHORT-02 scope) beyond the 5 specified in the plan — this covers the `layers.scatter` suppression truth from the must_haves, giving 6 new tests total (plan required >= 5).
- The `buildPanel` helper was extended to include a patient with 2 measurements so per-patient layer tests can exercise the patient filter path.

## Known Stubs

None — OutcomesPanel renders `cohortSeries` data passed in; the actual cohort selection/data wiring is Plan 04's responsibility. The `CohortSeriesEntry` interface is complete and exported for downstream use.

## Threat Flags

None — no new network endpoints, auth paths, file access, or schema changes. OutcomesPanel remains a pure renderer; cohortSeries entries come from already-authorized prop data (T-16-03/T-16-04 already assessed in plan threat model).

## Self-Check

```bash
[ -f "src/components/outcomes/OutcomesPanel.tsx" ] # FOUND
[ -f "tests/OutcomesPanel.test.tsx" ]              # FOUND
```

git log:
- 454ffae test(16-02): add cross-cohort + VIS-04 assertions to OutcomesPanel tests
- d2c3347 feat(16-02): extend OutcomesPanel with cohortSeries prop + VIS-04 per-patient desaturation

## Self-Check: PASSED
