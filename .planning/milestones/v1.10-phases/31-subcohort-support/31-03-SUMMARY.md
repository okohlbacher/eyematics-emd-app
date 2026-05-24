---
phase: 31-subcohort-support
plan: "03"
subsystem: frontend
tags: [subcohort, validation, tree-render, CohortBuilderPage, CohortCompareDrawer, lucide-react]
dependency_graph:
  requires: ["31-01", "31-02"]
  provides: [cohort-builder-validation, cohort-builder-split-button, cohort-compare-drawer-tree]
  affects: [CohortBuilderPage, CohortCompareDrawer]
tech_stack:
  added: []
  patterns: [inline-validation, live-onChange-validation, tree-render-useState, useRef-cursor-placement]
key_files:
  created: []
  modified:
    - src/pages/CohortBuilderPage.tsx
    - src/components/outcomes/CohortCompareDrawer.tsx
decisions:
  - "Live validation computed on every saveName keystroke (not on blur) — consistent with existing disabled={!saveName.trim()} pattern"
  - "Duplicate check runs before orphan check — if a name is both orphan and duplicate, duplicate hard error takes priority"
  - "scrollIntoView guarded with typeof check for jsdom test compatibility"
  - "topLevelItems computed by filtering subcohortIdSet from savedSearches — preserves original ordering"
  - "New parents auto-expanded via useEffect keyed on savedSearches — avoids eslint exhaustive-deps infinite loop"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-21T13:48:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 31 Plan 03: Component Wiring (CohortBuilderPage + CohortCompareDrawer) Summary

**One-liner:** Inline save-dialog validation (hard errors / soft orphan warning) + per-row teal GitBranch Split button in CohortBuilderPage; expanded-by-default parent/subcohort tree with chevron toggle and pl-6 indentation in CohortCompareDrawer — both consuming the Wave 1 cohortNames service.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | CohortBuilderPage — inline validation, soft orphan warning, per-row Split button | `59382a9` | `src/pages/CohortBuilderPage.tsx` |
| 2 | CohortCompareDrawer — tree render with chevron, indented subcohorts, independent selection | `26ae24f` | `src/components/outcomes/CohortCompareDrawer.tsx` |

## What Was Built

### Task 1: CohortBuilderPage

**Imports added:**
- `GitBranch` from `lucide-react`
- `useEffect`, `useRef` from `react`
- `isDuplicateName`, `parseSubcohortName` from `../services/cohortNames`

**Live validation** computed on every `saveName` `onChange`:
- 2+ colons → hard error `t('cohortNameTooManyColons')` + Save button disabled
- `:Sub` (empty parent) → hard error `t('cohortNameEmptyParent')`
- `Parent:` (empty sub) → hard error `t('cohortNameEmptySub')`
- Normalized duplicate → hard error `t('cohortNameDuplicate')`
- `Ghost:Sub` (orphan, parent not in savedSearches) → soft warning `t('cohortNameOrphanWarning')`, Save button ENABLED

**Validation message `<p>`** rendered below the `flex gap-2` wrapper with `mt-1`, `role={isHardError ? 'alert' : 'status'}`, and color tokens from UI-SPEC (red for hard, amber for soft).

**Input ARIA:** `aria-invalid={hasHardError ? 'true' : 'false'}`, `aria-describedby="cohort-name-validation"` when message present, `id="cohort-name-input"`, `ref={saveNameInputRef}`.

**Save button:** label changed from `t('save')` to `t('cohortSaveSearch')`; `disabled={hasHardError || !saveName.trim()}`.

**Per-row Split button (GitBranch, teal-600):** inserted first in the row button group (before LineChart). On click: sets `splitPreFillRef.current = true`, calls `setSaveName('ParentName:')`, focuses input. `useEffect` keyed on `saveName` places cursor at end via `setSelectionRange` when `splitPreFillRef` is set.

**handleSave:** early-return on `hasHardError` added as defense in depth (button already disabled).

### Task 2: CohortCompareDrawer

**Imports added:**
- `ChevronDown`, `ChevronUp` from `lucide-react`
- `useState` from `react`
- `groupByParent` from `../../services/cohortNames`

**Tree grouping:** `groupByParent(savedSearches)` called at render time (no persisted state). Returns `parents`, `subcohortsByParentId`, and a `subcohortIdSet` built from the map.

**Expand/collapse state:** `useState<Set<string>>` initialized with all parent ids (expanded by default, D-02). `useEffect` auto-expands newly added parents when `savedSearches` changes.

**Top-level render list:** `topLevelItems = savedSearches.filter(s => !subcohortIdSet.has(s.id))` — subcohorts excluded from top-level, rendered inside parent groups; preserves `savedSearches` ordering.

**Parent group render:** chevron `<button type="button">` (`ChevronDown` expanded / `ChevronUp` collapsed, `w-4 h-4`, `p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700`, `aria-expanded`, `aria-label`) + parent's own checkbox label (selects parent id only, D-R4). Subcohort rows rendered inside `<div class="space-y-1 mt-1">` when expanded, each with `pl-6` indentation.

**Flat cohorts:** rendered via same `renderLabel` function, identical to pre-Phase-31 behavior (Pitfall 2 zero-regression baseline verified by original 5 drawer tests).

**isMaxReached and toggle:** UNCHANGED from lines 38-48. Selection counting and max-4 logic flow through unchanged (D-R5).

## Verification

- `npm run test:ci -- cohortBuilderEntryPoints`: 781/781 passed (includes 5 new subcohort validation tests + 1 Split test)
- `npm run test:ci -- cohortCompareDrawer`: 781/781 passed (includes new tree/selection/max-4 tests + original 5 flat tests)
- `npm run test:ci`: 781/781 passed — full suite green, no regression of 754 baseline
- `npm run build`: clean (pre-existing chunk size warning only)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] scrollIntoView not available in jsdom**
- **Found during:** Task 1, first test run
- **Issue:** `saveNameInputRef.current?.scrollIntoView(...)` threw `TypeError: scrollIntoView is not a function` as an unhandled error in jsdom (jsdom does not implement scrollIntoView)
- **Fix:** Guarded with `typeof saveNameInputRef.current?.scrollIntoView === 'function'` check before calling
- **Files modified:** `src/pages/CohortBuilderPage.tsx`
- **Commit:** `59382a9`

**2. [Rule 3 - Blocking] Edit tools wrote to main repo instead of worktree**
- **Found during:** Task 1 commit
- **Issue:** Initial edits via Edit tool went to main repo (`/Users/kohlbach/Claude/EyeMatics-EDM-UX/emd-app/src/...`) rather than worktree. Commit accidentally landed on `main` branch.
- **Fix:** Reset main repo commit (git reset --soft HEAD~1), copied file to worktree, restored main repo file, then committed from worktree on correct branch `worktree-agent-a4463dd5d635e69f4`.
- **Files modified:** worktree `src/pages/CohortBuilderPage.tsx`
- **Commit:** `59382a9` (worktree branch)

## Known Stubs

None — all validation logic is fully wired to the cohortNames service. Tree grouping is derived from live `savedSearches` data. No hardcoded empty values or placeholders.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. JSX interpolation of `{s.name}` is safe (React escapes by default). Validation is client-side only, consistent with T-31-01 / T-31-02 mitigations in the threat register.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `src/pages/CohortBuilderPage.tsx` exists | FOUND |
| `src/components/outcomes/CohortCompareDrawer.tsx` exists | FOUND |
| `.planning/phases/31-subcohort-support/31-03-SUMMARY.md` exists | FOUND |
| Commit `59382a9` (Task 1) | FOUND |
| Commit `26ae24f` (Task 2) | FOUND |
