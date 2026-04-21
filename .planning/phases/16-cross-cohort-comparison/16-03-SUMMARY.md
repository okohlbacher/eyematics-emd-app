---
phase: 16-cross-cohort-comparison
plan: "03"
subsystem: outcomes-ui
tags: [drawer, selector, accessibility, xcohort]
requirements: [XCOHORT-01, XCOHORT-03]

dependency_graph:
  requires: ["16-01"]
  provides: ["CohortCompareDrawer component", "XCOHORT-01 test coverage", "XCOHORT-03 test coverage"]
  affects: ["src/components/outcomes/", "tests/cohortCompareDrawer.test.tsx"]

tech_stack:
  added: []
  patterns:
    - "Slide-over drawer (translate-x transition) mirroring OutcomesSettingsDrawer layout"
    - "afterEach(cleanup) pattern for jsdom component tests"
    - "vi.fn() spies with renderDrawer helper pattern"

key_files:
  created:
    - src/components/outcomes/CohortCompareDrawer.tsx
  modified:
    - tests/cohortCompareDrawer.test.tsx

decisions:
  - "Import SavedSearch from '../../types/fhir' (shim) rather than '../../../shared/types/fhir' (direct) — matches project convention"
  - "afterEach(cleanup) required — project does not configure global cleanup; matched pattern from OutcomesPanel.test.tsx and outcomesDataPreview.test.tsx"

metrics:
  duration: "~8 minutes"
  completed: "2026-04-21"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 16 Plan 03: CohortCompareDrawer Component Summary

**One-liner:** CohortCompareDrawer slide-over with max-4 enforcement, primary-lock, and patient-count label — 5 tests passing for XCOHORT-01/03.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create CohortCompareDrawer component | fdc31a4 | src/components/outcomes/CohortCompareDrawer.tsx |
| 2 | Activate cohortCompareDrawer tests | 0317dae | tests/cohortCompareDrawer.test.tsx |

## What Was Built

### CohortCompareDrawer Component (`src/components/outcomes/CohortCompareDrawer.tsx`)

A slide-over drawer that lets the researcher pick 1–4 saved cohorts for cross-cohort overlay. Layout mirrors `OutcomesSettingsDrawer` exactly (fixed right-0, w-96, translate-x transitions, X close button, footer link).

**Key behaviors:**
- `open` prop toggles `translate-x-0` vs `translate-x-full`
- Escape keydown fires `onClose`
- Each `savedSearches` entry renders as a labeled checkbox with format: `{name} (N={count} patients)`
- Primary cohort row: always `checked` + `disabled` (locked), label appends `outcomesComparePrimaryLabel`
- Max-4 enforcement: when `selectedIds.length >= 4`, every non-selected non-primary row is `disabled`
- Toggle: non-primary checkbox click calls `onChange(nextIds)` with the id added/removed
- Footer "Reset" button calls `onReset`

**Props contract** (matches Plan 04 wiring expectations):
```typescript
CohortCompareDrawerProps {
  open: boolean;
  onClose: () => void;
  savedSearches: SavedSearch[];
  patientCounts: Record<string, number>;
  primaryCohortId: string | null;
  selectedIds: string[];
  onChange: (next: string[]) => void;
  onReset: () => void;
  t: (key: string) => string;
}
```

### Test Suite (`tests/cohortCompareDrawer.test.tsx`)

Previously `describe.skip` scaffold from Plan 01 Wave-0. Activated with 5 passing tests:

1. `XCOHORT-01`: Primary cohort checkbox is checked and disabled
2. `XCOHORT-01`: Max 4 cohorts — 5th checkbox disabled when 4 already selected
3. `XCOHORT-03`: Patient count rendered next to each cohort name
4. `onChange` fires with id removed when non-primary cohort unchecked
5. `onReset` fires when footer link clicked

## Verification

```
npx tsc --noEmit        → exit 0 (clean)
npx vitest run tests/cohortCompareDrawer.test.tsx tests/outcomesI18n.test.ts → 11 passed (5 drawer + 6 i18n)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added afterEach(cleanup) to test file**
- **Found during:** Task 2 — first test run showed 4 failures with "Found multiple elements" errors
- **Issue:** Tests accumulated rendered components across test cases because Testing Library auto-cleanup was not globally configured in this project (vitest.config.ts has no `setupFiles`). All existing jsdom test files in the project manually import and call `cleanup`.
- **Fix:** Added `afterEach(cleanup)` and `import { ..., cleanup }` matching the pattern in `OutcomesPanel.test.tsx` and `outcomesDataPreview.test.tsx`.
- **Files modified:** `tests/cohortCompareDrawer.test.tsx`
- **Commit:** 0317dae (included in Task 2 commit)

## Known Stubs

None — all component data flows from props; no hardcoded empty values or placeholder text.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. Component is a pure UI element operating within the existing trust boundary (savedSearches pre-filtered by useData() server auth).

## Self-Check

- [x] `src/components/outcomes/CohortCompareDrawer.tsx` exists
- [x] `tests/cohortCompareDrawer.test.tsx` — `describe.skip` removed, 5 tests pass
- [x] `fdc31a4` commit exists (feat — component)
- [x] `0317dae` commit exists (test — activated suite)
- [x] TypeScript: `npx tsc --noEmit` exits 0
- [x] Tests: `npx vitest run tests/cohortCompareDrawer.test.tsx` — 5/5 passed

## Self-Check: PASSED
