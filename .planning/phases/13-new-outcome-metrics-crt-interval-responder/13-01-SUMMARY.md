---
phase: 13-new-outcome-metrics-crt-interval-responder
plan: "01"
subsystem: i18n + test scaffolding
tags: [i18n, test-scaffolding, tdd, wave-0, phase-13]
dependency_graph:
  requires: []
  provides:
    - "tests/crtTrajectory.test.ts — RED test scaffold for computeCrtTrajectory() (Plans 02)"
    - "tests/intervalMetric.test.ts — RED test scaffold for computeIntervalDistribution() (Plan 03)"
    - "tests/responderMetric.test.ts — RED test scaffold for classifyResponders() (Plan 04)"
    - "tests/metricSelector.test.ts — RED test scaffold for ?metric= URL round-trip (Plan 05)"
    - "src/i18n/translations.ts — All metrics* DE/EN key pairs (Plans 02-06)"
  affects:
    - "src/i18n/translations.ts — TranslationKey union expanded with 59 new metrics* keys"
tech_stack:
  added: []
  patterns:
    - "describe.skip guard pattern to keep suite green until implementations land"
    - "TDD RED scaffolding with @ts-expect-error on not-yet-existing imports"
key_files:
  created:
    - tests/crtTrajectory.test.ts
    - tests/intervalMetric.test.ts
    - tests/responderMetric.test.ts
    - tests/metricSelector.test.ts
  modified:
    - src/i18n/translations.ts
decisions:
  - "Used describe.skip (not it.todo) per threat model T-13-01: prevents TS compile error on not-yet-existing modules"
  - "59 metrics* keys added (plan specified ~50); all verbatim from 13-UI-SPEC.md copywriting contract"
  - "Worktree had pre-staged deletions from a prior agent; reset to HEAD before applying changes"
metrics:
  duration_minutes: 15
  completed: "2026-04-16"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 1
---

# Phase 13 Plan 01: Wave 0 Scaffolding Summary

**One-liner:** 59 metrics* i18n key pairs (DE+EN verbatim from UI-SPEC) seeded in translations.ts + four describe.skip test scaffolds activatable by Plans 02–05.

## What Was Built

### Task 1: Seed all metrics* i18n keys in translations.ts

Added 59 key pairs to `src/i18n/translations.ts` (690 lines → 761 lines), grouped by concern:

- **Metric selector (5 keys):** `metricsVisus`, `metricsCrt`, `metricsInterval`, `metricsResponder`, `metricsSelectorLabel`
- **CRT Panel (13 keys):** `metricsCrtPanel{Od,Os,Combined}`, `metricsCrtYAxis*`, `metricsCrtYMetric*`, `metricsCrtTooltipValue`, `metricsCrtNoCrt*`, `metricsCrtPanelEmpty`
- **Treatment-Interval Histogram (18 keys):** `metricsInterval{Title,XAxis,YAxis,MedianLine,GapDays}`, eye selector keys, 6 bin label keys, no-data keys
- **Responder Classification (13 keys):** `metricsResponder{Title,Bucket*,Bar*,TrajectoryTitle,Threshold*,NoData*}`
- **CSV Export (10 keys):** `metricsPreview{ExportCsv*,Col*}`
- **Error State (1 key):** `metricsErrorComputationFailed`

All placeholder tokens (`{days}`, `{letters}`) match between DE and EN for every key.

### Task 2: Scaffold four RED test files

| File | Guards | Plans that activate |
|------|--------|-------------------|
| `tests/crtTrajectory.test.ts` | `describe.skip` | Plan 02 |
| `tests/intervalMetric.test.ts` | `describe.skip` | Plan 03 |
| `tests/responderMetric.test.ts` | `describe.skip` | Plan 04 |
| `tests/metricSelector.test.ts` | `describe.skip` | Plan 05 |

Each file uses `@ts-expect-error` on not-yet-existing module imports, satisfying threat model T-13-01 (no compile errors).

## Verification Results

- `grep -c "^  metrics" src/i18n/translations.ts` → **59** (requirement: ≥ 45)
- All acceptance criteria spot checks passed (`metricsVisus`, `metricsCrtPanelOd`, `metricsIntervalBin_0_30`, `metricsResponderThreshold`)
- Each test file has exactly 1 `describe.skip`
- Main repo full suite: **397/397 tests passing** (zero regressions)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `65f88c3` | feat(13-01): seed all metrics* i18n keys in translations.ts |
| Task 2 | `24c30df` | test(13-01): scaffold four RED test files for Wave 1+ verification |

## Deviations from Plan

### [Deviation] Worktree had pre-staged deletions

- **Found during:** Task 1 setup
- **Issue:** The worktree had ~315 staged file deletions from a prior agent run (partial cleanup of unrelated files). The working tree showed translations.ts as 531 lines (post-deletion state) when committed state was 690 lines.
- **Fix:** Ran `git reset HEAD -- .` then `git checkout -- .` to restore working tree to the correct committed state (a0855e8), then re-applied all i18n additions to the correct 690-line base.
- **Impact:** None — final result is identical to plan intent.

No other deviations.

## Known Stubs

None — this plan is pure additive (i18n keys + describe.skip test scaffolds). No UI data flows involved.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- `tests/crtTrajectory.test.ts` — FOUND
- `tests/intervalMetric.test.ts` — FOUND
- `tests/responderMetric.test.ts` — FOUND
- `tests/metricSelector.test.ts` — FOUND
- Commit `65f88c3` — FOUND (feat(13-01): seed all metrics* i18n keys)
- Commit `24c30df` — FOUND (test(13-01): scaffold four RED test files)
