---
phase: 18-metricselector-test-harness-unblock
plan: "01"
subsystem: testing
tags: [vitest, react-testing-library, test-infrastructure, refactor]

provides:
  - "tests/helpers/renderOutcomesView.tsx: shared render helper with 14 exported symbols (7 vi.mock factories, 3 shared mock fn refs, 2 stub builders, 1 async renderOutcomesView, 1 RenderOutcomesViewOptions type)"
  - "tests/OutcomesViewRouting.test.tsx: migrated to consume the helper, 7 tests green, behaviour unchanged"

affects:
  - "MSEL-06: shared helper in place (first-use verified by OutcomesViewRouting; Plan 02 extends coverage to metricSelector.test.tsx)"
  - "tests/metricSelector.test.tsx/.ts: untouched in this plan per D-06 Commit 1 scope"

tech-stack:
  added: []
  patterns:
    - "Factory functions live in helper; vi.mock() calls stay in the test file (Vitest hoists vi.mock only from the compiled test entrypoint — Pitfall #3)"
    - "Shared mock fn references (loadSettingsMock, postAggregateMock, fetchSpy) exported from helper for cross-test consistency"
    - "Dynamic import of OutcomesView inside renderOutcomesView() ensures module loads AFTER consumer's vi.mock() calls take effect"
    - "useData mock uses full 12-field DataContext shape per Pitfall #5"

key-files:
  created:
    - tests/helpers/renderOutcomesView.tsx
  modified:
    - tests/OutcomesViewRouting.test.tsx
  deleted: []

key-decisions:
  - "Async renderOutcomesView() signature: dynamic OutcomesView import required to avoid race with consumer's hoisted vi.mock() calls"
  - "No @vitest-environment jsdom docblock in helper — it is not a test entrypoint (per Plan acceptance criteria)"
  - "Zero vi.mock() calls inside helper; only factory functions passed to vi.mock() at consumer site"

commits:
  - "2311ab7 refactor(18-01): create shared renderOutcomesView test helper"
  - "1145320 refactor(18-01): migrate OutcomesViewRouting.test.tsx onto shared render helper"
  - "fe9bea5 chore(18-01): remove jsdom docblock string from helper comment"

metrics:
  completed: "2026-04-22"
  tasks: 2
  files_modified: 1
  files_created: 1
  test_count_preserved: 7
  note: "SUMMARY.md written retroactively on 2026-04-23 — work was completed on 2026-04-22 but the summary file was omitted at the time."
---

# Phase 18 Plan 01: Render Helper Extract Summary

**Shared test helper `tests/helpers/renderOutcomesView.tsx` extracted from OutcomesViewRouting.test.tsx; 7 existing tests migrated to consume the helper with zero behaviour change; 14-symbol export surface in place for Plan 02 consumption.**

## What shipped

- `tests/helpers/renderOutcomesView.tsx` (289 lines) exports the 14 symbols specified in the plan: 7 vi.mock factory functions (settingsServiceFactory, outcomesAggregateFactory, dataContextFactory, languageContextFactory, fhirLoaderFactory, cohortTrajectoryFactory, rechartsFactory), 3 shared mock fn references (loadSettingsMock, postAggregateMock, fetchSpy), 2 stub builders (buildCase, buildCases), 1 async render factory (renderOutcomesView), 1 options type (RenderOutcomesViewOptions).
- `tests/OutcomesViewRouting.test.tsx` (233 lines) rewritten to import from the helper and retain 7 inline `vi.mock(...)` calls (Pitfall #3 constraint honoured).
- Zero production code modified.

## Verification at completion

- `npx vitest run tests/OutcomesViewRouting.test.tsx` → 7/7 green.
- `grep -c "^export" tests/helpers/renderOutcomesView.tsx` → 14.
- `grep -c "vi\\.mock(" tests/helpers/renderOutcomesView.tsx` → 0 (all 3 matches are in comments, not calls).
- `grep -c "vi\\.mock(" tests/OutcomesViewRouting.test.tsx` → 7.

## Re-verification today (2026-04-23)

- `npx vitest run tests/OutcomesViewRouting.test.tsx tests/metricSelector.test.tsx` → 16/16 green.
- Helper file and migrated test file still match plan acceptance criteria.

## Unblocks

Plan 02 (unskip metricSelector.test.tsx + MSEL-05 keyboard tests) — already executed on 2026-04-22 against this helper.
