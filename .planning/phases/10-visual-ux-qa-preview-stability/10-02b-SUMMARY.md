---
phase: 10-visual-ux-qa-preview-stability
plan: 02b
subsystem: outcomes-ui
tags: [tooltip, D-05, D-06, VQA-04, outcomes, recharts]
requirements: [VQA-04]
requirements_satisfied: [VQA-04]
dependency_graph:
  requires:
    - src/components/outcomes/OutcomesTooltip.tsx (existing Props/isMedian branches)
    - src/components/outcomes/OutcomesPanel.tsx (existing Tooltip mount + per-patient Line)
    - src/utils/cohortTrajectory.ts (AxisMode, YMetric, PatientSeries.pseudonym)
    - Plan 10-01 (SERIES_STYLES constants on per-patient Line — composed cleanly)
    - Plan 10-02a (IQR band guard on cohortTrajectory — assumed landed; verified by 340/340 test pass)
  provides:
    - "OutcomesTooltip accepts required `layers` prop"
    - "D-05 field order + units (pseudonym, eye, '{n} d' or '#{n}', logMAR/Δ logMAR/%)"
    - "D-06 suppression of per-patient entries when layers.perPatient=false (via __series filter)"
    - "__series: 'perPatient' marker + pseudonym on per-patient Line payloads"
  affects:
    - Any future consumer of <OutcomesTooltip> must supply `layers` (required prop)
    - Per-patient measurement payloads are augmented with two synthetic keys (__series, pseudonym)
tech_stack:
  added: []
  patterns:
    - "Synthetic series-identifier marker (`__series`) on client-only chart payloads for tooltip filtering"
    - "Field-order + unit formatting encapsulated inside the tooltip component (not upstream)"
key_files:
  created:
    - tests/outcomesTooltip.test.tsx
  modified:
    - src/components/outcomes/OutcomesTooltip.tsx
    - src/components/outcomes/OutcomesPanel.tsx
decisions:
  - "D-06 suppression implemented via payload filtering inside the tooltip, not by unmounting `<Tooltip>` — keeps single Tooltip instance, preserves Recharts hover behavior"
  - "`__series` marker lives only on the per-patient Line data; median/scatter/IQR bypass D-06 by absence of the marker"
  - "y-unit literal strings hardcoded in the component (logMAR / Δ logMAR / %) — these are unitless identifiers, not translated strings per D-05"
metrics:
  duration_seconds: 161
  tasks_completed: 3
  files_created: 1
  files_modified: 2
  tests_added: 5
  tests_total_after: 340
  completed_at: 2026-04-16T11:33:51Z
---

# Phase 10 Plan 02b: Tooltip D-05 + D-06 Summary

VQA-04 closed: OutcomesTooltip now renders D-05 field order (pseudonym → eye uppercase → x with unit → y with metric-specific unit) and implements D-06 per-patient suppression via a `__series` marker filter inside the tooltip component, keeping a single `<Tooltip>` mount on the chart.

## What Shipped

### OutcomesTooltip.tsx — D-05 + D-06 logic

- **Props now require `layers: { median, perPatient, scatter, spreadBand }`** (previously absent).
- **D-06 filter** runs immediately after the `!active / empty payload` guard:
  - If `layers.perPatient === false`, filters out any payload entry whose `payload.__series === 'perPatient'`.
  - If all entries are dropped, returns `null` (no tooltip).
  - Median / scatter / IQR entries carry no `__series` key, so they are never dropped.
- **D-05 `xDisplay` helper** — `'{n} d'` for `axisMode='days'`, `'#{n}'` for `axisMode='treatments'`. Both branches (median + per-patient) now use `xDisplay`.
- **D-05 `yUnit` helper** — `'logMAR' | 'Δ logMAR' | '%'` keyed off `yMetric`. Appended to the per-patient branch's logMAR line as `{fmtNum(logmar)} {yUnit}`.
- **Median-branch logMAR line intentionally unchanged** — per plan, median pseudonym is absent and the IQR row carries the range; metric unit is implicit from the panel header.
- **`fmtNum` preserved** (`Intl.NumberFormat(locale, { maximumFractionDigits: digits })`).

### OutcomesPanel.tsx — wiring

- `<Tooltip content={<OutcomesTooltip ... layers={layers} ... />}>` — layers threaded through.
- Per-patient `<Line data={...}>` now maps `p.measurements.map((m) => ({ ...m, __series: 'perPatient' as const, pseudonym: p.pseudonym }))` so each payload entry carries the series marker AND the pseudonym (D-05 first field). No other series touched.
- Plan 10-01's `SERIES_STYLES.perPatient.*` style props remain intact — this edit only changed the `data=` attribute; style attributes are untouched.

### tests/outcomesTooltip.test.tsx — new test suite

5 tests in 2 describes:
- **D-05 field order + units** (3 tests): absolute/days, delta_percent/treatments, delta/days.
- **D-06 per-patient suppression** (2 tests): null for per-patient-only payload with `perPatient=false`; median tooltip still renders.

## OutcomesPage.test.tsx interaction

No changes were needed in `tests/OutcomesPage.test.tsx`. It mocks Recharts (`<Tooltip />` becomes a no-op stub) and never instantiates `<OutcomesTooltip>` directly, so the new required `layers` prop does not affect that suite. Regression gate passed: 17/17 tests green after the edits.

## Interaction with Plan 10-01 (SERIES_STYLES)

Clean composition, no conflict. Plan 10-01 modified the `<Line>` style props (`strokeWidth`, `strokeOpacity`) to reference `SERIES_STYLES.perPatient.*`. This plan modified only the `<Line>` `data={...}` prop to augment per-patient measurements. The two edits touch disjoint attributes on the same JSX element.

## Sequencing with Plan 10-02a (IQR guard)

Per plan, 10-02b depends on 10-02a. The full-suite test run (340/340) includes IQR band / cohortTrajectory tests that exercise the 10-02a guard; they passed, confirming 10-02a is in place and the two plans compose.

## Deviations from Plan

### Tooling

- **Plan's `npm run typecheck` script does not exist** in this repo. Used `npx tsc -b --noEmit` instead. This is a documentation-only deviation — acceptance criterion semantics (TypeScript compiles) was preserved and passed.

### Execution ordering

- **Task 1's standalone `tsc` would fail** because `OutcomesPanel.tsx` doesn't pass the new required `layers` prop until Task 2. This is inherent to the plan's design (Props.layers is required, not optional). Task 1 was committed with Tooltip-only changes; Task 2 immediately restored the build. The intermediate commit `21e92e3` briefly has a failing `tsc`, but each task was committed as a single atomic unit per protocol.

No Rule 1/2/3 auto-fixes were triggered. No Rule 4 architectural decisions. No auth gates.

## Deferred Items

None. Out-of-scope issues: none encountered.

## Commits

| Task | Hash    | Message                                                                                  |
| ---- | ------- | ---------------------------------------------------------------------------------------- |
| 1    | 21e92e3 | feat(10-02b): extend OutcomesTooltip with layers prop, D-05 format + D-06 suppression   |
| 2    | 374f176 | feat(10-02b): wire layers prop + inject __series/pseudonym markers in OutcomesPanel     |
| 3    | 57df2e2 | test(10-02b): add OutcomesTooltip D-05 format + D-06 suppression suite                  |

## Verification Results

- `npx tsc -b --noEmit` → exit 0 (after Task 2)
- `npx vitest run tests/outcomesTooltip.test.tsx` → 5/5 passed
- `npx vitest run tests/OutcomesPage.test.tsx` → 17/17 passed (regression gate)
- `npx vitest run` (full suite) → **340/340 passed** across 33 test files
- `grep layers=\{layers\} src/components/outcomes/OutcomesPanel.tsx` → matches (line 132)
- `grep __series: 'perPatient' src/components/outcomes/OutcomesPanel.tsx` → matches (line 160)
- All plan acceptance criteria `grep`s verified.

## Known Stubs

None. No hardcoded empty values, no placeholder text, no un-wired data sources.

## Self-Check: PASSED

- `src/components/outcomes/OutcomesTooltip.tsx` → FOUND (modified)
- `src/components/outcomes/OutcomesPanel.tsx` → FOUND (modified)
- `tests/outcomesTooltip.test.tsx` → FOUND (created)
- Commit 21e92e3 → FOUND in log
- Commit 374f176 → FOUND in log
- Commit 57df2e2 → FOUND in log
