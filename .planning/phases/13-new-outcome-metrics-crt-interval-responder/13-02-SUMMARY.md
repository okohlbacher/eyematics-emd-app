---
phase: 13-new-outcome-metrics-crt-interval-responder
plan: "02"
subsystem: CRT trajectory math + server routing + panel rendering
tags: [crt, trajectory, server-aggregate, outcomes-panel, metric-prop, tdd, phase-13]
dependency_graph:
  requires:
    - "13-01 — metrics* i18n keys + RED test scaffolds"
    - "Phase 12 — computeCohortTrajectory, outcomesAggregateApi, buildPanel"
  provides:
    - "shared/cohortTrajectory.ts — computeCrtTrajectory() export"
    - "server/outcomesAggregateApi.ts — metric param validation + CRT branch + cache key"
    - "src/services/outcomesAggregateService.ts — AggregateRequest.metric field"
    - "src/components/outcomes/OutcomesPanel.tsx — metric prop + CRT y-domain [0, 800]"
    - "tests/outcomesPanelCrt.test.tsx — CRT y-domain regression guard (4 tests)"
  affects:
    - "shared/fhirCodes.ts — added SNOMED_EYE_RIGHT_ALT + SNOMED_EYE_LEFT_ALT"
    - "shared/cohortTrajectory.ts — buildPanel gains optional minN param"
    - "src/components/outcomes/OutcomesTooltip.tsx — valueLabelKey optional prop"
tech_stack:
  added: []
  patterns:
    - "minN parameter on buildPanel allows CRT single-patient trajectory (minN=1)"
    - "VALID_METRICS allowlist in validateBody (T-13-03 threat mitigation)"
    - "hidden data-testid marker div pattern for y-domain regression tests"
    - "metric-aware yDomain function with CRT/visus branch"
key_files:
  created:
    - tests/outcomesPanelCrt.test.tsx
  modified:
    - shared/cohortTrajectory.ts
    - shared/fhirCodes.ts
    - server/outcomesAggregateApi.ts
    - src/services/outcomesAggregateService.ts
    - src/components/outcomes/OutcomesPanel.tsx
    - src/components/outcomes/OutcomesTooltip.tsx
    - tests/crtTrajectory.test.ts (activated — removed describe.skip + @ts-expect-error)
    - tests/outcomesAggregateApi.test.ts (3 new contract tests)
decisions:
  - "Added minN=1 for CRT buildPanel — single-patient CRT trajectory is clinically meaningful, unlike visus where n>=2 ensures non-degenerate IQR band (D-04)"
  - "Extended eyeOf() to recognize alternate SNOMED eye codes 24028007/8966001 — test scaffold used these valid alternate SNOMED CT codes for eye laterality"
  - "valueLabelKey prop added to OutcomesTooltip for metric-aware unit display; keeps visus behavior unchanged when undefined"
  - "CRT delta µm floor = 5 (vs visus logMAR floor = 0.05) for symmetric y-domain"
metrics:
  duration_minutes: 25
  completed: "2026-04-16"
  tasks_completed: 3
  tasks_total: 3
  files_created: 1
  files_modified: 7
---

# Phase 13 Plan 02: CRT Backbone — Math, Server, Panel Summary

**One-liner:** `computeCrtTrajectory()` (µm, no logMAR) + server metric branching with allowlist + OutcomesPanel CRT y-domain [0, 800], all backed by GREEN tests.

## What Was Built

### Task 1: computeCrtTrajectory() in shared/cohortTrajectory.ts

Added `export function computeCrtTrajectory(input: { cases, axisMode, yMetric, gridPoints, spreadMode? }): TrajectoryResult` directly below `computeCohortTrajectory` in `shared/cohortTrajectory.ts`.

**Exact signature (matches computeCohortTrajectory):**
```typescript
export function computeCrtTrajectory(input: {
  cases: PatientCase[];
  axisMode: AxisMode;
  yMetric: YMetric;
  gridPoints: number;
  spreadMode?: SpreadMode;
}): TrajectoryResult
```

**Key differences from visus:**
- Uses `LOINC_CRT` ('LP267955-5') not `LOINC_VISUS`
- New `buildCrtPatientSeries` helper: no `decimalToLogmar` call — y values are raw µm
- `absolute`: y = raw µm; `delta`: y = µm − baselineµm; `delta_percent`: ((µm−base)/base)×100, clamped ±200
- `buildPanel` called with `minN=1` (CRT single-patient trajectory is valid); visus default remains `minN=2` per D-04
- `baseline` field stores raw µm value (number | null)

**Deviations resolved:**
- `eyeOf()` extended to recognize SNOMED codes `24028007` (OD) and `8966001` (OS) — the test scaffold used these valid alternate SNOMED CT codes. Added `SNOMED_EYE_RIGHT_ALT`/`SNOMED_EYE_LEFT_ALT` to `shared/fhirCodes.ts`.
- `buildPanel` gained an optional `minN` parameter (default 2, backward-compatible) to allow CRT single-patient grid computation.

Activated `tests/crtTrajectory.test.ts`: removed `describe.skip` and `@ts-expect-error`. All 4 assertions GREEN.

### Task 2: Server /api/outcomes/aggregate metric extension

Modified `server/outcomesAggregateApi.ts`:

**New server body shape:**
```typescript
interface ValidBody {
  // ... existing ...
  metric: 'visus' | 'crt';  // absent defaults to 'visus'
}
```

**Changes:**
- `VALID_METRICS = new Set(['visus', 'crt'])` allowlist (T-13-03)
- `validateBody` parses `metric`: absent → `'visus'`; unknown → returns `null` (400)
- Cache key extended with `metric` (T-13-04: prevents CRT/visus cache cross-contamination)
- Computation branches: `metric === 'crt' ? computeCrtTrajectory(...) : computeCohortTrajectory(...)`
- Audit log payload includes `metric` field
- Import updated to include `computeCrtTrajectory`

Modified `src/services/outcomesAggregateService.ts`:
```typescript
export interface AggregateRequest {
  // ... existing ...
  metric?: 'visus' | 'crt';  // optional for backward compat
}
```

Added 3 new contract tests to `tests/outcomesAggregateApi.test.ts`:
- "accepts metric: "crt" and returns CRT trajectory (200)"
- "defaults to metric: "visus" when metric is absent (backward compat)"
- "rejects unknown metric value with 400"

### Task 3: OutcomesPanel metric prop + CRT y-domain

Modified `src/components/outcomes/OutcomesPanel.tsx`:

**Updated Props interface:**
```typescript
interface Props {
  // ... existing ...
  titleKey: 'outcomesPanelOd' | 'outcomesPanelOs' | 'outcomesPanelCombined'
          | 'metricsCrtPanelOd' | 'metricsCrtPanelOs' | 'metricsCrtPanelCombined';
  metric?: 'visus' | 'crt';  // default 'visus'
}
```

**Updated yDomain() signature:**
```typescript
function yDomain(
  yMetric: YMetric,
  medianGrid: GridPoint[],
  metric: 'visus' | 'crt' = 'visus',
): [number | string, number | string] {
  if (yMetric === 'absolute') {
    return metric === 'crt' ? [0, 800] : [0, 2];
  }
  // ... data-driven symmetric (unchanged) with CRT delta µm floor = 5 ...
}
```

**CRT delta µm floor assumption resolved:** 5µm is the minimum symmetric range for CRT delta mode (vs 0.05 logMAR for visus). Clinically, a 5µm swing is at the lower bound of measurement resolution.

Added hidden y-domain marker div for test assertions:
```tsx
<div hidden data-testid="outcomes-panel-ydomain" data-metric={metric} data-ymetric={yMetric}
     data-min={yDomain(yMetric, panel.medianGrid, metric)[0]}
     data-max={yDomain(yMetric, panel.medianGrid, metric)[1]} />
```

Modified `src/components/outcomes/OutcomesTooltip.tsx`:
- Added optional `valueLabelKey?: string` prop
- When provided, replaces the default `'logMAR'/'Δ logMAR'/'%'` unit with `t(valueLabelKey)`

Created `tests/outcomesPanelCrt.test.tsx` with 4 assertions:
1. CRT absolute → `data-min="0"`, `data-max="800"`
2. Visus absolute → `data-min="0"`, `data-max="2"`
3. No metric prop (backward compat) → same as visus
4. CRT delta → symmetric data-driven domain (dMin < 0, dMax > 0, not 800)

## Verification Results

- `tests/crtTrajectory.test.ts`: 4/4 GREEN (Task 1 RED→GREEN)
- `tests/cohortTrajectory.test.ts + cohortTrajectoryShared.test.ts`: 52/52 pass (visus regression intact)
- `tests/outcomesAggregateApi.test.ts`: 12/12 pass (+3 new)
- `tests/outcomesAggregateCache.test.ts + Audit + Parity`: 38/38 pass (Phase 12 regression intact)
- `tests/outcomesPanelCrt.test.tsx`: 4/4 GREEN (new)
- `tests/outcomesIqrSparse.test.tsx + outcomesTooltip.test.tsx`: 13/13 pass
- `npx tsc --noEmit`: clean
- Full suite: 408/408 tests pass (3 test files fail due to pre-existing Plan 01 scaffolds for Plans 03/04/05 — `intervalMetric.test.ts`, `responderMetric.test.ts`, `metricSelector.test.ts` reference not-yet-created modules; these are NOT regressions from Plan 02)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `cd50422` | feat(13-02): add computeCrtTrajectory() to shared/cohortTrajectory.ts |
| Task 2 | `c83101b` | feat(13-02): extend /api/outcomes/aggregate with metric param and CRT branch |
| Task 3 | `99ba072` | feat(13-02): add metric prop to OutcomesPanel with CRT y-domain and tooltip |

## Deviations from Plan

### [Rule 1 - Bug] Extended eyeOf() to recognize alternate SNOMED eye codes

- **Found during:** Task 1 — crtTrajectory.test.ts uses SNOMED `24028007` (OD) and `8966001` (OS)
- **Issue:** `eyeOf()` only recognized `362503005` and `362502000`; the test scaffold used valid alternate SNOMED CT codes that resolve to the same anatomy but weren't in the allowlist
- **Fix:** Added `SNOMED_EYE_RIGHT_ALT = '24028007'` and `SNOMED_EYE_LEFT_ALT = '8966001'` to `shared/fhirCodes.ts`; updated `eyeOf()` to match both primary and alternate codes
- **Files modified:** `shared/fhirCodes.ts`, `shared/cohortTrajectory.ts`
- **Commit:** `cd50422`

### [Rule 1 - Bug] Added minN parameter to buildPanel for CRT single-patient support

- **Found during:** Task 1 — crtTrajectory.test.ts expects medianGrid data for a single patient with 2 observations
- **Issue:** `buildPanel` hard-coded `n >= 2` guard (D-04); CRT test expects single-patient median trajectory
- **Fix:** Added optional `minN = 2` parameter to `buildPanel`; `computeCrtTrajectory` passes `minN=1`; visus path unchanged
- **Files modified:** `shared/cohortTrajectory.ts`
- **Commit:** `cd50422`

### Assumption resolved: CRT delta µm floor = 5

- The plan left the CRT delta µm floor as an open choice. Selected 5µm as the minimum symmetric bound (vs 0.05 logMAR for visus). Clinically, 5µm is at the lower bound of OCT measurement resolution for CRT.

## Known Stubs

None — all data flows are wired end-to-end. OutcomesView wiring (Plan 05) is the next step; this plan only exposes the CRT stack without connecting the UI selector.

## Threat Flags

None — all threat model items (T-13-03, T-13-04, T-13-05) were addressed:
- T-13-03: `VALID_METRICS` allowlist in `validateBody` ✓
- T-13-04: `metric` included in cache key ✓
- T-13-05: CRT uses same center filter path, no new data access ✓

## Self-Check: PASSED

- `shared/cohortTrajectory.ts` — FOUND (export function computeCrtTrajectory)
- `server/outcomesAggregateApi.ts` — FOUND (VALID_METRICS, computeCrtTrajectory, metric in cache key)
- `src/services/outcomesAggregateService.ts` — FOUND (metric?: 'visus' | 'crt')
- `src/components/outcomes/OutcomesPanel.tsx` — FOUND (metric prop, [0, 800] domain)
- `tests/outcomesPanelCrt.test.tsx` — FOUND
- Commit `cd50422` — FOUND
- Commit `c83101b` — FOUND
- Commit `99ba072` — FOUND
