---
phase: 31-subcohort-support
plan: "01"
subsystem: frontend-i18n-tests
tags: [i18n, tdd, red-phase, subcohort, wave-0]
dependency_graph:
  requires: []
  provides:
    - 10 bilingual i18n keys for subcohort UI (TranslationKey extended)
    - Wave 0 RED test contracts for Plans 02+ to satisfy
  affects:
    - src/i18n/translations.ts (TranslationKey type extended)
    - tests/cohortNames.test.ts (new RED target)
    - tests/cohortBuilderEntryPoints.test.tsx (extended with RED targets)
    - tests/cohortCompareDrawer.test.tsx (extended with subcohort tree tests)
tech_stack:
  added: []
  patterns:
    - Wave 0 TDD RED scaffold (tests reference unimplemented src/services/cohortNames.ts)
    - No-jest-dom RTL assertions (queryByText().not.toBeNull() style per CLAUDE.md)
key_files:
  created:
    - tests/cohortNames.test.ts
  modified:
    - src/i18n/translations.ts
    - tests/cohortBuilderEntryPoints.test.tsx
    - tests/cohortCompareDrawer.test.tsx
decisions:
  - "{parent} token in cohortTreeSubcohortOf is a literal placeholder — interpolation via .replace('{parent}', x) at call site per RESEARCH Pattern 5"
  - "normalizeCohortName exported from cohortNames.ts (Plan 02 must export it) so D-04 duplicate normalization is directly testable"
  - "cohortCompareDrawer subcohort tree tests pass on flat render now (label-based queries work against flat output); they enforce correct behavior once tree render changes label format in Plan 02"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-21"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 3
---

# Phase 31 Plan 01: Wave 0 i18n Keys + RED Test Scaffolds Summary

**One-liner:** 10 bilingual i18n keys for subcohort naming/validation/tree added to TranslationKey; three test files establish the RED contracts that Plans 02-04 must satisfy.

---

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Add 10 bilingual i18n keys | fb32ef1 | src/i18n/translations.ts (+10 keys) |
| 2 | Create RED test scaffolds | 02ed794 | tests/cohortNames.test.ts (new), cohortBuilderEntryPoints.test.tsx (+6 RED tests), cohortCompareDrawer.test.tsx (+8 tree tests) |

---

## What Was Built

### Task 1: 10 new bilingual i18n keys (src/i18n/translations.ts)

Added immediately after `saveCohortLabel` in the Cohort Builder section:

| Key | DE | EN |
|-----|----|----|
| `cohortSaveSearch` | Kohorte speichern | Save cohort |
| `cohortSplitIntoSubcohort` | Als Unterkohorte aufteilen | Split into subcohort |
| `cohortNameTooManyColons` | Name darf nur einen Doppelpunkt enthalten | Name must contain at most one colon |
| `cohortNameEmptyParent` | Übergeordneter Name darf nicht leer sein | Parent name must not be empty |
| `cohortNameEmptySub` | Unterkohortenname darf nicht leer sein | Subcohort name must not be empty |
| `cohortNameDuplicate` | Dieser Name ist bereits vergeben | This name is already in use |
| `cohortNameOrphanWarning` | Übergeordnete Kohorte nicht gefunden – Speichern trotzdem möglich | Parent cohort not found – you can still save |
| `cohortTreeExpandGroup` | Untergruppe einblenden | Expand group |
| `cohortTreeCollapseGroup` | Untergruppe ausblenden | Collapse group |
| `cohortTreeSubcohortOf` | Unterkohorte von {parent} | Subcohort of {parent} |

The existing `save` key (`Speichern` / `Save`) is unchanged. `TranslationKey = keyof typeof translations` auto-extended — any downstream `t('cohortSaveSearch')` call now compiles.

### Task 2: RED test scaffolds (3 files)

**tests/cohortNames.test.ts** (NEW — RED, fails on `Cannot find module '../src/services/cohortNames'`):
- `parseSubcohortName`: valid parse → `{parent, sub}`; 0-colon throw; 2+-colon throw; trim; empty-parent throw; empty-sub throw
- `isSubcohortName`: true/false/false for 1/0/2 colons
- `normalizeCohortName`: case-insensitive + whitespace-collapsed duplicate detection (D-04)

**tests/cohortBuilderEntryPoints.test.tsx** (EXTENDED — 6 new RED tests):
- SC1 hard errors: tooManyColons / emptyParent / emptySub / duplicate — each shows error text, disables Save cohort button
- SC5 orphan warning: shows amber warning, Save cohort button stays ENABLED
- SC5 Split pre-fill: clicking Split button sets name input to `"ParentName:"`
- All assertions use no-jest-dom style (`queryByText().not.toBeNull()`, `(btn as HTMLButtonElement).disabled`)
- Original `CohortBuilderPage entry points (D-02)` describe block untouched

**tests/cohortCompareDrawer.test.tsx** (EXTENDED — 8 new tests, currently green against flat render):
- SC2: parent row, both subcohort rows, and flat cohort all render (label queries)
- SC3: selecting parent → `onChange` called with parent id only (no subcohort ids)
- SC3: selecting subcohort → `onChange` called with that subcohort id only
- D-R5: 5th entry disabled when 4 already selected (parent + subcohort each count individually)
- Original 5 flat-render tests untouched (zero-regression baseline)

---

## Verification Results

| Check | Result |
|-------|--------|
| `grep -c` for 10 keys in translations.ts | 10 |
| `save: { de: 'Speichern'` unchanged | ✓ |
| `npm run build` | Clean (no errors) |
| `cohortNames.test.ts` RED reason | `Cannot find module '../src/services/cohortNames'` |
| `cohortBuilderEntryPoints` new tests | 6 RED (validation UI not yet implemented) |
| `cohortCompareDrawer` existing 5 tests | Still passing (zero regression) |
| `cohortCompareDrawer` new 8 tree tests | Green against flat render (enforce behavior once tree lands) |

---

## Deviations from Plan

### Auto-added: normalizeCohortName export requirement

**Rule 2 — missing critical functionality for testability**
- **Found during:** Task 2, writing D-04 duplicate normalization tests
- **Issue:** The plan specifies testing duplicate normalization behavior but the service module doesn't exist yet. To make the tests directly testable (not just implicitly via duplicate detection), `normalizeCohortName` must be exported from `src/services/cohortNames.ts`.
- **Fix:** Added `import { normalizeCohortName } from '../src/services/cohortNames'` to cohortNames.test.ts and documented in decisions that Plan 02 must export this function.
- **Files modified:** tests/cohortNames.test.ts
- **Commit:** 02ed794

### Note: cohortCompareDrawer tree tests are currently green

The subcohort tree tests in `cohortCompareDrawer.test.tsx` pass against the current flat render because the label-based queries (`/Cohort1 \(N=100 patients\)/i`) match the flat output. These tests will become meaningful enforcement once Plan 02 changes the render to a tree structure (e.g., subcohort rows may be collapsed by default or rendered differently). This is intentional per the Wave 0 design: the tests define the contract, not the current state.

---

## Known Stubs

None — this plan adds only i18n keys and test files, no production UI.

---

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. i18n key additions and test scaffolds only. T-31-01 (contract pinned by cohortNames.test.ts) is addressed: the test scaffold pins the throw-on-invalid contract for Plan 02's implementation.

---

## Self-Check

**Checking created files:**
- tests/cohortNames.test.ts: FOUND
- src/i18n/translations.ts (10 keys): FOUND (grep returned 10)

**Checking commits:**
- fb32ef1 (i18n keys): FOUND
- 02ed794 (test scaffolds): FOUND

## Self-Check: PASSED
