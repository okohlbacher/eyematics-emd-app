---
phase: 24-feedback-fixes
plan: 03
subsystem: home-page
tags: [feedback, fb-03, landing-page, empty-state, navigation, i18n]
requires:
  - 24-02 (LandingPage Wave 2 already landed; this plan extends it without collision)
provides:
  - explicit empty state in Jump Back In panel
  - i18n key `jumpBackInEmpty` (de + en)
  - regression tests for dead-row pattern
affects:
  - src/pages/LandingPage.tsx
  - src/i18n/translations.ts
  - tests/LandingPage.test.tsx
tech-stack:
  added: []
  patterns:
    - empty-state-over-fake-interactivity (D-11)
    - data-testid hook for regression assertions
key-files:
  created: []
  modified:
    - src/pages/LandingPage.tsx
    - src/i18n/translations.ts
    - tests/LandingPage.test.tsx
decisions:
  - "D-09/D-10/D-11: chose explicit empty state over wiring — no recent-activity state has ever existed in useData/useAuth/Language/Theme contexts (verified by grep)."
  - "Drop ArrowRight import (knip-clean)."
  - "Use data-testid='jump-back-in-empty' as a stable hook for the regression test that asserts no silent click handler."
metrics:
  duration: ~6 min
  tasks: 2
  files_modified: 3
  tests_baseline: 615
  tests_after: 619
  completed: 2026-04-28
---

# Phase 24 Plan 03: Jump Back In Panel Summary

**One-liner:** Replace the dead Jump Back In rows in `LandingPage.tsx` (placeholder content with `cursor-pointer` and a decorative `ArrowRight` but no `onClick`) with an explicit empty-state message backed by a new i18n key, since no recent-activity state has ever been wired into app context (D-11).

## What Changed

### `src/pages/LandingPage.tsx`
- Removed `ArrowRight` from `lucide-react` imports.
- Replaced the hard-coded two-row array (`'AMD · female · 70+'` / `'PSN-UKA-0023'`) and its `.map(...)` block with a single empty-state `<div>` rendering `t('jumpBackInEmpty')`. The element carries `data-testid="jump-back-in-empty"` for regression-test assertions and explicitly does NOT use `cursor-pointer` or any click handler (D-08/D-10).
- Added an explanatory comment block in the JSX pointing future contributors at the navigate-on-click pattern when a real history source lands.

### `src/i18n/translations.ts`
- Added `jumpBackInEmpty`: `{ de: 'Noch keine kürzlichen Aktivitäten', en: 'No recent activity yet' }` next to the existing `jumpBackIn` key.

### `tests/LandingPage.test.tsx`
- New `describe` block "LandingPage Jump Back In panel — empty state (FB-03)" with 4 assertions:
  1. Empty-state copy renders when no recent-activity state exists.
  2. Jump Back In panel header is still present.
  3. Empty-state element has neither `cursor-pointer` nor `onclick` (regression for the original dead-arrow bug).
  4. Legacy placeholder strings (`AMD · female · 70+`, `PSN-UKA-0023`) are gone.

## Why Empty-State, Not Wiring (D-11)

Grep across `src/context/*.tsx` (`AuthContext`, `DataContext`, `LanguageContext`, `ThemeContext`) found zero references to recent-activity / last-cohort / last-case state. The previous rows were pure design-stage placeholders. Per D-11, shipping fake interactivity is worse than honest emptiness — the empty state is the cleanest correct fix until a real history source is introduced.

## Verification

Per-task safety net:

| Step       | Result                  |
| ---------- | ----------------------- |
| `test:ci`  | 619/619 passed (+4)     |
| `build`    | Clean (vite 8.0.10)     |
| `lint`     | Clean                   |
| `knip`     | No new unused exports   |

Baseline before this plan: **615/615**. After: **619/619**.

## Commits

| Task | Type | Hash      | Message                                                                 |
| ---- | ---- | --------- | ----------------------------------------------------------------------- |
| 1    | fix  | `bc0a4ca` | wire Jump Back In rows or surface explicit empty state (FB-03)          |
| 2    | test | `963363d` | cover Jump Back In empty state and dead-row regression (FB-03)          |

## Deviations from Plan

None — plan executed exactly as written along the D-11 (empty-state) branch.

### Tooling note (not a code deviation)

The `Edit` tool silently reported success but did not persist changes to `src/pages/LandingPage.tsx` or `src/i18n/translations.ts` (verified by raw `cat`/`grep` after each Edit). Fell back to:
1. `git apply` with a heredoc patch for the i18n insertion (succeeded).
2. A `python3` heredoc for the LandingPage replacement (succeeded — the diff was too large for a clean `git apply` patch).

Final files were verified by `cat`/`grep` before commit; both atomic commits show the expected diffs (`git show bc0a4ca`).

## Self-Check: PASSED

- `src/pages/LandingPage.tsx` modified — verified (no `ArrowRight`, contains `jumpBackInEmpty`).
- `src/i18n/translations.ts` modified — verified (`jumpBackInEmpty` key present, line 841).
- `tests/LandingPage.test.tsx` modified — verified (4 new tests, file now 9 tests total).
- Commit `bc0a4ca` exists in git log.
- Commit `963363d` exists in git log.
- Safety net (`test:ci` 619/619, `build`, `lint`, `knip`) all green at HEAD.
