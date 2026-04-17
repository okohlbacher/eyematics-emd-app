---
phase: 10-visual-ux-qa-preview-stability
plan: 02a
subsystem: testing
tags: [vitest, rtl, jsdom, recharts, cohort-trajectory, iqr, outcomes]

# Dependency graph
requires:
  - phase: 09-outcomes-page-ui
    provides: computeCohortTrajectory + OutcomesPanel (IQR Area layer)
  - phase: 10-visual-ux-qa-preview-stability
    provides: SERIES_STYLES palette from 10-01 (used as color value in DOM test)
provides:
  - "D-04 invariant locked at math layer: buildPanel never emits medianGrid GridPoint with n<2"
  - "DOM regression guard against 0-height IQR band in OutcomesPanel"
  - "Two-layer regression test pattern (math + DOM) for VQA-03"
affects: [phase-12-server-pre-aggregation, phase-13-new-outcome-metrics]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Local Recharts vi.mock emits <path d='M0,0 L10,10'> so jsdom can assert DOM geometry"
    - "Two-layer regression (math invariant + DOM invariant) for any future visual math guard"

key-files:
  created:
    - tests/outcomesIqrSparse.test.tsx
  modified:
    - src/utils/cohortTrajectory.ts
    - tests/cohortTrajectory.test.ts

key-decisions:
  - "Updated tests 2 and 4 in tests/cohortTrajectory.test.ts in lockstep with guard change: seed a second patient so n>=2 invariant holds while preserving original test intent (identical-series collapse; sparse flag). Plan's Task 1 action text explicitly anticipated this lockstep update."
  - "Local Recharts mock in tests/outcomesIqrSparse.test.tsx emits non-empty d= so the DOM assertion (no empty d) is meaningful against jsdom, matching the tests/OutcomesPage.test.tsx pattern."

patterns-established:
  - "Math+DOM two-layer regression: new visual math invariants get both a math-layer assertion against the producer (computeCohortTrajectory) AND a DOM-layer assertion against the consumer (OutcomesPanel) so future refactors can't silently regress either side."

requirements-completed: [VQA-03]

# Metrics
duration: 3m 21s
completed: 2026-04-16
---

# Phase 10 Plan 02a: IQR Band Guard Summary

**D-04 invariant (`ys.length >= 2`) enforced at cohortTrajectory.buildPanel with a two-layer (math + DOM) regression test so degenerate 0-height IQR bands are locked out at both producer and consumer.**

## Performance

- **Duration:** 3m 21s
- **Started:** 2026-04-16T11:23:45Z
- **Completed:** 2026-04-16T11:27:06Z
- **Tasks:** 2
- **Files modified:** 3 (1 source, 2 tests — 1 new, 1 updated)

## Accomplishments

- Tightened `buildPanel` median-grid guard from `ys.length === 0` to `ys.length < 2` with a D-04 (VQA-03) traceability comment. D-15 skip for mismatched-span is now subsumed by the stricter check.
- Added `tests/outcomesIqrSparse.test.tsx` (4 tests, 2 describe blocks): math invariants on `computeCohortTrajectory` + DOM invariants on `OutcomesPanel` rendered SVG.
- Updated two single-patient fixtures in `tests/cohortTrajectory.test.ts` (tests 2 and 4) in lockstep so the n>=2 invariant holds while preserving original test intent.
- Full suite green: 329/329 across 31 files (v1.5 baseline: 313/313). No regressions.

## Task Commits

1. **Task 1: Tighten cohortTrajectory.ts median-grid guard to `ys.length < 2` (D-04)** — `b0efe20` (fix)
2. **Task 2: Add tests/outcomesIqrSparse.test.tsx (math + DOM invariants for VQA-03)** — `8c1434b` (test)

## Files Created/Modified

- `src/utils/cohortTrajectory.ts` — buildPanel loop guard tightened to `ys.length < 2` with D-04 (VQA-03) traceability comment; D-15 comment merged into the new guard.
- `tests/cohortTrajectory.test.ts` — tests 2 and 4 updated to two-patient fixtures so n>=2 invariant holds; assertions updated (`gp.n === 2`, `every(gp => gp.n >= 2)`) while preserving identical-series collapse behavior (p25 === y === p75 when both patients carry the same values).
- `tests/outcomesIqrSparse.test.tsx` — NEW. 4 tests: (1) sparse cohort → no GridPoint with n<1, empty medianGrid; (2) dense two-patient cohort → every GridPoint n>=2; (3) dense medianGrid renders at least one `<path>` and none have empty d; (4) patientCount=0 short-circuits the chart (no ResponsiveContainer, no paths).

## Decisions Made

- **Lockstep update of tests 2 and 4 in tests/cohortTrajectory.test.ts.** Test 2 originally asserted `gp.n === 1` and `p25 === y === p75` on a single-patient cohort — the exact degenerate case D-04 is fixing. Test 4 asserted a sparse single-patient cohort still contributed to medianGrid. Per the plan's Task 1 action text, the fix is to add a second patient so the invariant holds, preserving original intent (identical-series IQR collapse; sparse flag). Alternative — deleting the tests — would have reduced coverage unnecessarily.
- **Local Recharts mock emits `<path d="M0,0 L10,10">`.** Real Recharts inside jsdom would not compute geometry at all (no ResizeObserver, no layout). Mocking Area/Line as paths with a non-empty d makes the DOM assertion "no empty d" meaningful; matches the `tests/OutcomesPage.test.tsx` mock pattern so there is one pattern across the outcomes test surface.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Updated tests/cohortTrajectory.test.ts tests 2 and 4 to preserve n>=2 invariant**
- **Found during:** Task 1 (guard change caused test failures as explicitly anticipated by the plan's action text)
- **Issue:** Test 2 seeded a single-patient cohort and asserted `gp.n === 1` and `medianGrid.toHaveLength(20)`. Test 4 seeded a single-patient sparse cohort and asserted `medianGrid.length > 0`. With the new `ys.length < 2` guard, single-patient cohorts produce empty medianGrid (ys.length === 1 at every gx, pruned). Plan's Task 1 action text explicitly called out this scenario and told the executor to update lockstep fixtures.
- **Fix:** Added a second patient to each fixture. Test 2 now uses two identical-series patients so `gp.n === 2` and the IQR collapse (p25 === y === p75) invariant remains asserted. Test 4 uses two sparse patients with matching span so the sparse flag is still asserted AND medianGrid is non-empty with n>=2.
- **Files modified:** `tests/cohortTrajectory.test.ts`
- **Verification:** 46/46 cohortTrajectory tests pass; full suite 329/329 pass.
- **Committed in:** `b0efe20` (Task 1 commit — bundled per plan's action text)

**2. [Rule 2 — Missing critical] Fixture helper shape in `tests/outcomesIqrSparse.test.tsx` aligned with real `PatientCase` interface**
- **Found during:** Task 2 (test authoring)
- **Issue:** The plan's embedded test code used a simplified `PatientCase` shape `{ pseudonym, patient, observations, procedures }` that does not match `src/types/fhir.ts:PatientCase` (which requires `id`, `gender`, `birthDate`, `centerId`, `centerName`, `conditions`, `imagingStudies`, `medications`). Compiling against the plan's inline shape would typecheck-fail at `as PatientCase`.
- **Fix:** Authored `makeCase` and `makeVisusObs` helpers shaped to match `src/types/fhir.ts:PatientCase` and the existing `tests/cohortTrajectory.test.ts:makeObs` shape. All behavior of the tests matches the plan's intent (same grid seeds, same spread mode, same assertions).
- **Files modified:** `tests/outcomesIqrSparse.test.tsx` (single file, NEW)
- **Verification:** 4/4 tests pass; no TypeScript complaints.
- **Committed in:** `8c1434b` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug lockstep test update explicitly anticipated by the plan, 1 fixture-shape alignment).
**Impact on plan:** Both auto-fixes were required to make the plan's specified edits work as written; neither expanded scope.

## Issues Encountered

None. Both tasks executed cleanly; test failures in Task 1 were anticipated by the plan and resolved per the plan's own action text.

## Interaction with Plan 10-01 (palette refactor)

No interaction surfaced. The DOM test passes a hex color string directly (`color="#1d4ed8"`) to `OutcomesPanel`; it does not import from `src/components/outcomes/palette.ts`. The SERIES_STYLES refactor that shipped in 10-01 is transparent to this plan's DOM assertions because the Recharts `Area`/`Line` components are mocked.

## Phase Regression Gate

- `npx vitest run tests/cohortTrajectory.test.ts` → 46/46 pass (2 tests updated lockstep per plan action text).
- `npx vitest run tests/outcomesIqrSparse.test.tsx` → 4/4 pass.
- `npx vitest run` (full suite) → 329/329 pass across 31 files (baseline v1.5 was 313/313; wave 2 adds 16 tests so far).
- Guard pattern grep: `if (ys.length < 2) continue;` matches exactly once in `src/utils/cohortTrajectory.ts`.
- Old guard `if (ys.length === 0) continue;` fully removed.
- Traceability comment `D-04 (VQA-03)` present in source.

## User Setup Required

None — purely client-side math + test.

## Next Phase Readiness

- VQA-03 closed — math + DOM invariants locked.
- Remaining Phase 10 work: 10-02b (tooltip), 10-03 (empty-state i18n), 10-04a (admin-center filter — shipped), 10-04b (preview row keys — shipped), 10-01 (chart palette — shipped).
- No blockers introduced.

## Self-Check: PASSED

- FOUND: `src/utils/cohortTrajectory.ts` (guard line present at 453)
- FOUND: `tests/cohortTrajectory.test.ts` (updated)
- FOUND: `tests/outcomesIqrSparse.test.tsx` (new)
- FOUND commit: `b0efe20` (Task 1)
- FOUND commit: `8c1434b` (Task 2)

---
*Phase: 10-visual-ux-qa-preview-stability*
*Completed: 2026-04-16*
