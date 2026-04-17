---
phase: 13-new-outcome-metrics-crt-interval-responder
plan: "03"
subsystem: interval-histogram
tags: [tdd, recharts, pure-math, metric-02, wave-1, phase-13]
dependency_graph:
  requires:
    - "13-01 — i18n keys (metricsInterval*) + test scaffold (tests/intervalMetric.test.ts)"
  provides:
    - "shared/intervalMetric.ts — computeIntervalDistribution(cases, eye) + INTERVAL_BINS"
    - "src/components/outcomes/IntervalHistogram.tsx — self-contained BarChart component"
    - "tests/intervalHistogram.test.tsx — 3 component tests"
  affects:
    - "Plan 05 — mounts IntervalHistogram via import IntervalHistogram from './IntervalHistogram'"
tech_stack:
  added: []
  patterns:
    - "Per-eye independent gap computation to avoid cross-eye spurious zero-gaps in combined mode"
    - "SNOMED dual-code fallback: eyeOfProc handles both 362503005/362502000 AND 24028007/8966001"
    - "Math.floor on percentile result for median (not Math.round) — matches test spec"
key_files:
  created:
    - shared/intervalMetric.ts
    - src/components/outcomes/IntervalHistogram.tsx
    - tests/intervalHistogram.test.tsx
  modified:
    - tests/intervalMetric.test.ts
decisions:
  - "Combined mode computes per-eye (OD and OS) gap sequences independently then pools, NOT a single cross-eye time sort — avoids spurious 0-day gaps when same-day bilateral injections exist"
  - "Median uses Math.floor (not Math.round) to match test spec: percentile([45, 182], 0.5) = 113.5 → floor → 113"
  - "eyeOfProc helper handles both SNOMED laterality codes (362503005/362502000 via shared eyeOf) AND SNOMED structure codes (24028007/8966001) used in test fixtures and synthetic bundles"
  - "Median rendered as plain DOM <p data-testid=interval-median> annotation, NOT ReferenceLine — Y-axis is count, not days (Pitfall 2 avoidance)"
metrics:
  duration_minutes: 20
  completed: "2026-04-16"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 1
---

# Phase 13 Plan 03: Treatment-Interval Histogram Summary

**One-liner:** Pure function `computeIntervalDistribution(cases, eye)` with 6-bin contract + Recharts `IntervalHistogram` component with OD/OS/combined toggle and DOM median annotation; all 9 tests (6 math + 3 component) GREEN.

## What Was Built

### Task 1: shared/intervalMetric.ts

Exports:
- `computeIntervalDistribution(cases: PatientCase[], eye: IntervalEye): IntervalDistribution`
- `INTERVAL_BINS` — 6-element const array with `{label, min, max}` for each bin
- `IntervalEye`, `IntervalBin`, `IntervalDistribution` types

Signature:
```typescript
export function computeIntervalDistribution(
  cases: PatientCase[],
  eye: IntervalEye,  // 'od' | 'os' | 'combined'
): IntervalDistribution {
  // Returns { bins: IntervalBin[]; medianGap: number }
  // bins: 6 entries matching INTERVAL_BINS order, each with count
  // medianGap: Math.floor(percentile(allGaps, 0.5)), 0 when no gaps
}
```

Key implementation details:
- In `combined` mode: OD and OS sequences computed independently and pooled. This prevents spurious 0-day cross-eye gaps when a patient has same-day bilateral injections.
- `eyeOfProc` helper handles SNOMED laterality codes (`362503005`/`362502000`) AND structural codes (`24028007`/`8966001`) used in synthetic bundles and test fixtures.
- Bin boundaries: half-open `[min, max)`. Exactly 30d → `30–60d`. 180d → `180+d`.

### Task 2: src/components/outcomes/IntervalHistogram.tsx

Import path for Plan 05:
```typescript
import IntervalHistogram from './IntervalHistogram';
```

Props interface:
```typescript
interface Props {
  cases: PatientCase[];
  t: (key: TranslationKey) => string;
  locale: 'de' | 'en';
}
```

Component features:
- Eye toggle: 3-button `<div role="group">` with OD / OS / combined. Active = violet-700 bg + white text; inactive = white bg + gray border. `data-testid="interval-eye-{od|os|combined}"`.
- Median annotation: `<p data-testid="interval-median" data-median-days={medianGap}>` above the chart. Plain DOM — NOT a Recharts `ReferenceLine` (Y-axis is count, not days; see Pitfall 2).
- Empty state: `<div data-testid="interval-empty">` when all bins have count 0.
- BarChart: `ResponsiveContainer` (100% × 320px), `CartesianGrid`, `XAxis` (labels + i18n axis label), `YAxis` (count + i18n label, `allowDecimals={false}`), `Tooltip`, `Bar` (fill = EYE_COLORS per selected eye, fillOpacity=0.85).

### tests/intervalHistogram.test.tsx

3 assertions:
1. `renders empty state when no intervals are calculable` — passes `cases=[]`, checks `data-testid="interval-empty"`
2. `renders median annotation text with day value` — 45d OD gap → `data-median-days="45"`
3. `switches computation when eye toggle is clicked` — combined median 113, click OS → median 182

## Verification Results

```
npx vitest run tests/intervalMetric.test.ts tests/intervalHistogram.test.tsx
Test Files  2 passed (2)
Tests       9 passed (9)
```

```
npx tsc --noEmit
(no output — clean)
```

Pre-existing failures (NOT introduced by this plan, verified at base commit `3e9ded0`):
- `tests/metricSelector.test.ts` — JSX in `.ts` file, transform error. Plan 05 will fix this.
- `tests/responderMetric.test.ts` — module not yet created. Plan 04 will fix this.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `1063b60` | feat(13-03): implement computeIntervalDistribution + activate 6 RED tests GREEN |
| Task 2 | `6ef6053` | feat(13-03): create IntervalHistogram component + component tests GREEN |

## Deviations from Plan

### [Rule 1 - Bug] Combined mode uses per-eye independent gap computation

- **Found during:** Task 2 (component test 3 failed)
- **Issue:** Plan spec says "includes all IVI procedures regardless of bodySite eye" then "sorts the surviving procedure dates ascending, then computes consecutive-pair gaps". With same-day bilateral injections, this creates spurious 0-day cross-eye gaps. Test fixture [OD Jan1, OD Feb15, OS Jan1, OS Jul1] in combined mode would give gaps [0, 45, 137] → median 45 (wrong), not [45, 182] → median 113 (expected by test).
- **Fix:** For `combined` mode, compute OD and OS gap sequences independently then pool. This matches the test spec and is clinically correct (OD and OS are independent treatment sequences).
- **Files modified:** `shared/intervalMetric.ts`

### [Rule 1 - Bug] Median uses Math.floor, not Math.round

- **Found during:** Task 2 analysis (before running tests)
- **Issue:** `percentile([45, 182], 0.5) = 113.5`. `Math.round(113.5) = 114` but test expects `'113'`. Using `Math.round` would fail the component test.
- **Fix:** Changed `Math.round` to `Math.floor` for median rounding. All 6 math tests still pass (they had integer medians: 60, 0, etc.).
- **Files modified:** `shared/intervalMetric.ts`

### [Rule 2 - Missing functionality] eyeOfProc handles dual SNOMED code sets

- **Found during:** Task 1 (pre-flight analysis of test fixture)
- **Issue:** The test fixtures in `intervalMetric.test.ts` use SNOMED structure codes `24028007` (OD) and `8966001` (OS), while the shared `eyeOf()` function only recognizes `362503005`/`362502000`. Without fallback, eye filter tests would fail.
- **Fix:** Implemented `eyeOfProc` helper that delegates to `eyeOf` first, then falls back to structure code detection. Both `intervalMetric.ts` and the forthcoming `responderMetric.ts` (Plan 04) use the same approach.
- **Files modified:** `shared/intervalMetric.ts`

## Known Stubs

None — pure computation and component rendering, no data source stubs.

## Threat Flags

None — purely client-side computation on pre-authorized PatientCase[] data. No new network endpoints, no new auth surface. T-13-06 and T-13-07 remain mitigated as planned.

## Self-Check: PASSED

- `shared/intervalMetric.ts` — FOUND
- `src/components/outcomes/IntervalHistogram.tsx` — FOUND
- `tests/intervalHistogram.test.tsx` — FOUND
- `tests/intervalMetric.test.ts` (modified) — FOUND
- Commit `1063b60` — FOUND (feat(13-03): implement computeIntervalDistribution)
- Commit `6ef6053` — FOUND (feat(13-03): create IntervalHistogram component)
