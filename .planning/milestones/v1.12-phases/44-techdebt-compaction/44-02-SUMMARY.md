---
phase: 44-techdebt-compaction
plan: "02"
subsystem: frontend/outcomes
tags: [refactor, tech-debt, outcomes, hooks, TECH-02, F-10]
dependency_graph:
  requires: [44-01]
  provides:
    - src/components/outcomes/useOutcomesRouteState.ts
    - src/components/outcomes/useOutcomesAggregation.ts
    - src/components/outcomes/VisusMetricContainer.tsx
    - src/components/outcomes/CrtMetricContainer.tsx
  affects:
    - src/components/outcomes/OutcomesView.tsx
tech_stack:
  added: []
  patterns: [custom hook extraction, single-responsibility components, Rules-of-Hooks-safe hook decomposition]
key_files:
  created:
    - src/components/outcomes/useOutcomesRouteState.ts
    - src/components/outcomes/useOutcomesAggregation.ts
    - src/components/outcomes/VisusMetricContainer.tsx
    - src/components/outcomes/CrtMetricContainer.tsx
  modified:
    - src/components/outcomes/OutcomesView.tsx
decisions:
  - "All useState/useMemo/useEffect owned by useOutcomesRouteState; aggregation hook receives state as args (not own state) to preserve global hook call order without reordering"
  - "COHORT_PALETTES imported directly in useOutcomesAggregation rather than re-exported through route-state hook to keep separation of concerns clean"
  - "eslint-disable for react-hooks/set-state-in-effect removed from aggregation hook because the rule does not fire when setters are passed as args (not owned state)"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-26"
  tasks_completed: 3
  files_created: 4
  files_modified: 1
---

# Phase 44 Plan 02: TECH-02 Decompose OutcomesView.tsx Summary

**One-liner:** Mechanical extraction of 785-line OutcomesView god-component into useOutcomesRouteState hook + useOutcomesAggregation hook + VisusMetricContainer + CrtMetricContainer, leaving a 240-line slim orchestrator — strictly behavior-preserving with all 1086 tests green.

## What Was Built

`src/components/outcomes/OutcomesView.tsx` (the F-10 multi-responsibility component, ~785 lines) was decomposed into:

| File | Lines | Contents |
|------|-------|----------|
| `useOutcomesRouteState.ts` | ~215 | URL params, cohort resolution, all session-only state, metric handlers, compare handlers, drill-down, recent-activity + audit beacon effects, patientCounts; exports MetricType/METRIC_TAB_ORDER/metricTitleKey/LayerState |
| `useOutcomesAggregation.ts` | ~195 | routeServerSide decision, panelFromServer helper, server-routing useEffect (Promise.all od/os/combined), aggregate/crtAggregate/crossCohortAggregates/crossCohortCaseSeries memos |
| `VisusMetricContainer.tsx` | ~100 | Empty-state guards (no-cohort/no-visus/all-eyes-filtered), OutcomesSummaryCards, scatter-default testid div, 3 OutcomesPanels, OutcomesDataPreview |
| `CrtMetricContainer.tsx` | ~80 | no-crt empty-state guard, 3 CRT OutcomesPanels (metric="crt"), OutcomesDataPreview |
| `OutcomesView.tsx` (slim orchestrator) | ~240 | Calls both hooks, renders tab strip inline, delegates to metric containers, renders interval/responder bodies inline, wires drawers |

## Rules of Hooks Preservation

Hook call order in the new OutcomesView is identical to the original:
1. `useOutcomesRouteState()` — owns all useState + all effects + routing memos (same as original lines 68-445)
2. `useOutcomesAggregation(s)` — owns only useMemo + useEffect for aggregation (same as original lines 225-406)
3. Both calls are unconditional and above any early return (WR-01 / Pitfall 3 preserved)

## Behavior Invariants Verified

- URL handling: `?cohort=`, `?cohorts=`, `?filter=`, `?metric=` — unchanged (OutcomesViewRouting.test.tsx)
- Phase-43 drill-down (IDOR gate T-44-06) — unchanged, handler moved verbatim (OutcomesPanelDrillDown.test.tsx)
- Metric tabs + keyboard nav — unchanged (metricSelector.test.tsx)
- Cross-cohort overlay (Phase 42) — unchanged (intervalHistogram.test.tsx, responderView.test.tsx)
- CRT metric panels — unchanged (outcomesPanelCrt.test.tsx)
- Audit beacon (once per mount, open_outcomes_view) — unchanged (OutcomesPage.test.tsx)
- Server-aggregation routing (Promise.all fallback) — unchanged

## Test / Lint / Knip Gates

| Check | Result |
|-------|--------|
| `npm run test:ci` | 1086/1086 pass (99 test files) |
| `npm run lint` | 0 errors, 0 warnings |
| `npm run knip` | No new unused exports (2 pre-existing: getThresholdSettings, QualityParamKey) |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `6e12d0c` | Extract useOutcomesRouteState hook from OutcomesView |
| Task 2 | `dd83a03` | Extract useOutcomesAggregation hook from OutcomesView |
| Task 3 | `9aebc1a` | Slim OutcomesView; add VisusMetricContainer + CrtMetricContainer |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused eslint-disable from useOutcomesAggregation**
- **Found during:** Task 3 (lint check)
- **Issue:** The `react-hooks/set-state-in-effect` eslint-disable at line 113 of the aggregation hook was no longer valid — the rule does not fire when `setServerAggregate`/`setServerLoading` are passed as arguments rather than being owned state. ESLint reported "Unused eslint-disable directive".
- **Fix:** Removed the eslint-disable comment (autofix via `eslint --fix`). The setters remain identical in behavior — they are the same stable refs from `useState` in the route-state hook.
- **Files modified:** src/components/outcomes/useOutcomesAggregation.ts
- **Commit:** 9aebc1a

**2. [Rule 1 - Bug] Removed unused IntervalCohortSeries type import from OutcomesView**
- **Found during:** Task 3 (lint check)
- **Issue:** `IntervalCohortSeries` was re-exported via `import { type IntervalCohortSeries }` in OutcomesView but the type is consumed inside `useOutcomesAggregation` (for `crossCohortCaseSeries` return type) — not in OutcomesView itself. The `cohortSeries` prop passed to `IntervalHistogram` is inferred.
- **Fix:** Removed the named type import from the IntervalHistogram import line.
- **Files modified:** src/components/outcomes/OutcomesView.tsx
- **Commit:** 9aebc1a

**3. [Rule 1 - Bug] Import sort on OutcomesView.tsx and useOutcomesAggregation.ts**
- **Found during:** Task 3 (lint check)
- **Issue:** `simple-import-sort` reported ordering violations in both new/modified files
- **Fix:** `eslint --fix` corrected the import ordering automatically
- **Files modified:** src/components/outcomes/OutcomesView.tsx, src/components/outcomes/useOutcomesAggregation.ts
- **Commit:** 9aebc1a

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. All trust boundaries (audit beacon, server aggregation routing, URL filter parsing) moved verbatim with their original mitigations intact.

## Self-Check: PASSED

All 4 new files exist and contain expected exports:
- useOutcomesRouteState.ts: `export function useOutcomesRouteState` + `open_outcomes_view` + `METRIC_TAB_ORDER`
- useOutcomesAggregation.ts: `export function useOutcomesAggregation` + `Promise.all`
- VisusMetricContainer.tsx: `export default function VisusMetricContainer`
- CrtMetricContainer.tsx: `export default function CrtMetricContainer`
- OutcomesView.tsx: `export default function OutcomesView` (no props)

All 3 task commits verified: 6e12d0c, dd83a03, 9aebc1a.
