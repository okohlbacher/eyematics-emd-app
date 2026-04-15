---
phase: 08
plan: 08-01
subsystem: pure-math-utility
tags: [tdd, pure-functions, trajectory-math, vitest, typescript]
dependency_graph:
  requires: [src/services/fhirLoader.ts, src/types/fhir.ts]
  provides: [src/utils/cohortTrajectory.ts]
  affects: [08-02-PLAN, 08-03-PLAN]
tech_stack:
  added: []
  patterns: [pure-functions, tdd-red-green, linear-interpolation, iqr-percentile]
key_files:
  created:
    - src/utils/cohortTrajectory.ts
    - tests/cohortTrajectory.test.ts
  modified: []
decisions:
  - "Kept cohortTrajectory.ts as single file (502 lines vs ~450 guideline) — clean organization without cognitive fragmentation"
  - "computeCohortTrajectory implemented in Task 2 file to keep it co-located with helpers it calls"
  - "Interpolation binary search approach for O(log n) per-grid-point lookup"
  - "eyeOf accepts both CodeableConcept (object) and CodeableConcept[] (Procedure.bodySite array) forms"
  - "D-18: single-measurement patients counted in patientCount and scatterPoints but excluded from medianGrid interpolation"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-15"
  tasks_completed: 3
  files_changed: 2
---

# Phase 08 Plan 01: cohortTrajectory Pure Math Utility Summary

**One-liner:** Pure trajectory math utility with logMAR normalization, linear interpolation grid, IQR/SD spread bands, and exhaustive OUTCOME-10 TDD coverage.

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `src/utils/cohortTrajectory.ts` | 502 | Pure math utility — types, helpers, aggregator |
| `tests/cohortTrajectory.test.ts` | 629 | Vitest suite — 46 tests across helpers + OUTCOME-10 edge cases |

## Test Count

- **Task 1 RED suite:** 36 tests covering 8 pure helpers
- **Task 3 edge case + behavior suite:** 10 tests covering OUTCOME-10 cases + additional behavior
- **Total:** 46 tests, all passing

## Public API Surface (exports from `src/utils/cohortTrajectory.ts`)

### Types
```typescript
export type AxisMode = 'days' | 'treatments';
export type YMetric = 'absolute' | 'delta' | 'delta_percent';
export type SpreadMode = 'iqr' | 'sd1' | 'sd2';
export type Eye = 'od' | 'os' | 'combined';
export interface Measurement { ... }   // date, decimal, logmar, snellenNum, snellenDen, eye, x, y, clipped?
export interface PatientSeries { ... } // id, pseudonym, measurements, sparse, excluded, baseline
export interface GridPoint { x, y, p25, p75, n }
export interface PanelResult { patients, scatterPoints, medianGrid, summary }
export interface TrajectoryResult { od, os, combined }
```

### Functions
```typescript
export function computeCohortTrajectory(input: { cases, axisMode, yMetric, gridPoints, spreadMode? }): TrajectoryResult
export function decimalToLogmar(decimal: number): number
export function decimalToSnellen(decimal: number, numerator?: number): { num, den }
export function eyeOf(bodySite: unknown): 'od' | 'os' | null
export function treatmentIndexAt(procs, observationDate, eye): number
export function interpolate(series, grid): Array<number | null>
export function percentile(sorted, p): number
export function buildGrid(xsByPatient, gridPoints): number[]
export function defaultScatterOn(patientCount: number): boolean
```

## Key Algorithmic Decisions

1. **logMAR normalization at ingest:** `decimalToLogmar = -log10(decimal)`. Returns NaN for decimal ≤ 0 (D-40/pitfall 7). Callers skip NaN values.

2. **Interpolate returns null outside span (D-15):** Grid points outside each patient's observed x-range are null and excluded from per-grid-point median/IQR. This is the primary correctness guarantee against extrapolation pitfall.

3. **Single-measurement exclusion from medianGrid (D-18):** Patients with exactly 1 measurement appear in `scatterPoints` and `patients[]` (excluded=false) but contribute null to every grid-point interpolation. `medianGrid` only includes grid points where ≥1 patient with ≥2 measurements contributes a non-null value.

4. **Snellen centralized (pitfall 6):** `decimalToSnellen(decimal, numerator=20)` is the single source of truth for US 20/x conversion. The numerator parameter allows 6/x conversion in one-line future change.

5. **eyeOf polymorphic (Observation vs Procedure):** Accepts both `CodeableConcept` (object with `.coding[]`) for `Observation.bodySite` and `CodeableConcept[]` (array) for `Procedure.bodySite`. Unknown/missing → null.

6. **treatmentIndexAt per D-08:** OD/OS panels filter by `eyeOf(proc.bodySite) === eye`; combined counts all IVI procedures regardless of laterality. Procedures with no recognized laterality are excluded from OD/OS but counted in combined.

7. **Sparse threshold:** `measurements.length >= 2 && measurements.length < Math.ceil(gridPoints/10)`. Sparse patients still contribute to medianGrid (drawn at reduced opacity in the UI, D-19).

8. **spreadMode pluggable (D-13):** IQR (default), SD±1, SD±2 all implemented. sd1/sd2 smoke test confirms symmetric bands for uniform-y cohort.

9. **D-05 baseline cohort-independence:** `getObservationsByCode` returns all patient observations sorted ascending, so `visusObs[0]` is the earliest overall — not the first within any cohort window.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed interpolation test fixture with wrong midpoint**
- **Found during:** Task 2 GREEN phase
- **Issue:** Plan specified `interpolate([{x:10,y:1},{x:100,y:2}], [5,10,50,100,200]) → 1.5` at x=50. However x=50 is at 40/90 = 44.4% of the way from x=10 to x=100, yielding 1.444 (not 1.5). The 1.5 value would be correct only if x=50 were the true spatial midpoint.
- **Fix:** Changed fixture to `[{x:0,y:1},{x:100,y:2}]` where x=50 is the exact midpoint of [0,100], correctly yielding y=1.5. Linear interpolation formula is unchanged.
- **Files modified:** `tests/cohortTrajectory.test.ts`
- **Commit:** dfa616c

**2. [Discretion] Single-file above 450-line guideline**
- The plan says "split if > ~450 lines". At 502 lines (52 over), the file remains clean and cohesive. `computeCohortTrajectory` and its helpers are tightly coupled (they call each other directly). A split would introduce a `cohortTrajectory.internal.ts` that imports nothing beyond what `.ts` already provides, adding import indirection without organizational benefit. Kept as one file.

## Self-Check

### Files exist
- src/utils/cohortTrajectory.ts: FOUND
- tests/cohortTrajectory.test.ts: FOUND

### Commits exist
- 1a8e9b6 (RED tests): FOUND
- dfa616c (GREEN helpers): FOUND
- 5c13fc8 (OUTCOME-10 + aggregator): FOUND

### Tests pass
- 46/46 tests passing

## Self-Check: PASSED
