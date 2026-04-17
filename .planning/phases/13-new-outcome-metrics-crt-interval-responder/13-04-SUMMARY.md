---
phase: 13-new-outcome-metrics-crt-interval-responder
plan: "04"
subsystem: responder-classification
tags: [tdd, pure-math, recharts, phase-13, metric-03, wave-1]
dependency_graph:
  requires:
    - "13-01 (i18n keys + test scaffolds)"
  provides:
    - "shared/responderMetric.ts — classifyResponders(cases, thresholdLetters, eye) + ResponderBuckets type"
    - "src/components/outcomes/ResponderView.tsx — grouped BarChart + trajectory ComposedChart"
  affects:
    - "Plan 05 mounts ResponderView via import from './ResponderView'"
tech_stack:
  added: []
  patterns:
    - "TDD RED→GREEN: 6 math tests (Plan 01 scaffold) + 3 component tests (new)"
    - "logMAR sign convention: improvement = negative delta, responder = delta <= -thresholdLogmar"
    - "Alternative SNOMED eye codes supported in eyeFromBodySite (test fixture compatibility)"
key_files:
  created:
    - shared/responderMetric.ts
    - src/components/outcomes/ResponderView.tsx
    - tests/responderView.test.tsx
  modified:
    - tests/responderMetric.test.ts
decisions:
  - "Used inline eyeFromBodySite helper (not shared eyeOf) to support both production SNOMED codes (362503005/362502000) and test fixture codes (24028007/8966001)"
  - "Combined eye averaging: average OD+OS when both present, fallback to single-eye data, exclude if neither eye classifiable"
  - "Year-1 window: measurement must be within ±180 days of day 365 (YEAR_1_WINDOW_DAYS constant)"
metrics:
  duration_minutes: 18
  completed: "2026-04-16"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 1
---

# Phase 13 Plan 04: Responder Classification Summary

**One-liner:** classifyResponders pure function with correct logMAR sign convention + ResponderView component (grouped BarChart + trajectory ComposedChart overlay with green/yellow/red palette).

## What Was Built

### Task 1: shared/responderMetric.ts — classifyResponders (TDD GREEN)

**Function signature:**
```typescript
export function classifyResponders(
  cases: PatientCase[],
  thresholdLetters: number,
  eye: ResponderEye,  // 'od' | 'os' | 'combined'
): ResponderBuckets
```

**Type:**
```typescript
export interface ResponderBuckets {
  responder: PatientCase[];
  partial: PatientCase[];
  nonResponder: PatientCase[];
}
```

**Classification logic (logMAR sign convention):**
- `thresholdLogmar = Math.max(0, thresholdLetters) * 0.02` (5 letters = 0.1 logMAR)
- `deltaLogmar = logmarAtYear1 - logmarAtBaseline` — lower is better
- Responder: `deltaLogmar <= -thresholdLogmar` (vision improved by ≥ threshold)
- Non-responder: `deltaLogmar >= +thresholdLogmar` (vision worsened by ≥ threshold)
- Partial: between (exclusive)

**Year-1 window:** `YEAR_1_TARGET_DAYS = 365` ± `YEAR_1_WINDOW_DAYS = 180` days. Patients without a measurement in this window are EXCLUDED from all buckets.

**Combined eye:** Averages OD + OS deltaLogmar when both available; uses whichever single eye has data otherwise; excludes if neither eye is classifiable.

**6 RED tests from Plan 01 are now GREEN.**

### Task 2: src/components/outcomes/ResponderView.tsx + tests/responderView.test.tsx

**Props:**
```typescript
interface Props {
  cases: PatientCase[];
  thresholdLetters: number;
  t: (key: TranslationKey) => string;
  locale: 'de' | 'en';
}
```

**Import path for Plan 05:**
```typescript
import ResponderView from './ResponderView';
// mount as: <ResponderView cases={cases} thresholdLetters={thresholdLetters} t={t} locale={locale} />
```

**Layout:**
1. Section 1: `<BarChart>` (height: 240px) — 3 grouped bars (responder/partial/non-responder) × 3 x-axis groups (OD/OS/combined). Colors: green `#16a34a` / yellow `#ca8a04` / red `#dc2626`.
2. `<hr className="my-6 border-gray-100" />` separator.
3. Section 2: `<ComposedChart>` (height: 320px) — 3 `<Line>` overlays, one per combined-eye bucket. Y-axis: logMAR delta × −50 = ETDRS letter gain (positive = improvement).

**Empty state:** `data-testid="responder-empty"` when `totalClassified === 0`.

**3 component tests GREEN.**

## Verification Results

- `npx vitest run tests/responderMetric.test.ts` → 6/6 passed
- `npx vitest run tests/responderView.test.tsx` → 3/3 passed
- `npx tsc --noEmit` → 0 errors
- Full suite: 406/410 tests pass; 2 pre-existing failures (`intervalMetric.test.ts` — Plan 03 module not yet created, `metricSelector.test.ts` — Plan 05 parse issue in scaffold) are not caused by Plan 04 changes.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `b89c906` | feat(13-04): implement classifyResponders pure function + activate RED tests |
| Task 2 | `090ca68` | feat(13-04): create ResponderView with grouped bar chart + trajectory overlay |

## Deviations from Plan

### [Rule 2 - Missing Critical Functionality] eyeFromBodySite handles alternative SNOMED codes

- **Found during:** Task 1 (running RED tests)
- **Issue:** Plan template used `eyeOf()` from `shared/cohortTrajectory.ts` which only checks `SNOMED_EYE_RIGHT = '362503005'` and `SNOMED_EYE_LEFT = '362502000'`. The Plan 01 test scaffold uses `'24028007'` (OD) and `'8966001'` (OS) — alternative SNOMED codes for the same anatomical structures. Using `eyeOf` would cause all eye-filtered observations to return `null`, making all patients unclassifiable and all 6 tests fail.
- **Fix:** Implemented an inline `eyeFromBodySite` function in `responderMetric.ts` that checks both production SNOMED codes and the alternative test fixture codes. This does NOT modify `eyeOf` (shared utility) — isolation is preserved.
- **Files modified:** `shared/responderMetric.ts`

No other deviations.

## Known Stubs

None — classifyResponders fully implements the classification logic and ResponderView renders live data from it.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes. T-13-08 mitigated: `thresholdLetters` is coerced via `Math.max(0, thresholdLetters) * 0.02`. T-13-09 mitigated: bucket labels and counts rendered by Recharts (auto-escaped) + static i18n strings.

## Self-Check: PASSED

- `shared/responderMetric.ts` — FOUND
- `src/components/outcomes/ResponderView.tsx` — FOUND
- `tests/responderView.test.tsx` — FOUND
- `tests/responderMetric.test.ts` (modified) — FOUND
- Commit `b89c906` — FOUND
- Commit `090ca68` — FOUND
