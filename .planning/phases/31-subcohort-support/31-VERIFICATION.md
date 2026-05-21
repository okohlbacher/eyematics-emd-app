---
phase: 31-subcohort-support
verified: 2026-05-21T16:05:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Save a subcohort in the running app and confirm it appears in the comparison drawer tree"
    expected: >
      After saving 'C1:Male' and 'C1:Female' from the cohort builder, open the compare drawer and
      confirm the 'C1' group appears as a parent row with a chevron, and 'C1:Male' / 'C1:Female'
      render indented beneath it. The chevron click collapses and expands the group.
    why_human: "Tree render with expand/collapse requires a live React component; not exercisable without a running app."
  - test: "Verify orphan subcohort soft warning in the builder save dialog"
    expected: >
      Type 'Ghost:Sub' where no 'Ghost' cohort exists. An amber warning message appears beneath the
      input but the 'Save cohort' button remains enabled; clicking it saves the subcohort.
    why_human: "Color/visual appearance of amber vs red alert cannot be determined programmatically from DOM alone."
  - test: "Verify Split button pre-fill and cursor placement"
    expected: >
      Click the teal GitBranch Split button on an existing cohort row. The name input should be
      populated with '<cohortName>:' and the cursor should be placed after the colon, ready for
      typing the subcohort identifier.
    why_human: "Cursor placement behavior (setSelectionRange) cannot be tested in jsdom and requires a real browser."
---

# Phase 31: Subcohort Support — Verification Report

**Phase Goal:** Users can split any saved cohort into named subcohorts (one level deep) using a `ParentName:SubcohortName` naming convention; subcohorts appear in a tree-grouped picker wherever cohorts are selectable for comparison.
**Verified:** 2026-05-21T16:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | A user can save `Cohort1:Male` from the cohort builder — validated (one colon, non-empty parent+sub, no duplicate) and appears under `Cohort1` in the comparison drawer | VERIFIED | `CohortBuilderPage.tsx:84-138` computes live validation; `handleSave` calls `addSavedSearch` when no hard error; drawer calls `groupByParent` at render to group. Full test suite 783/783 green. |
| SC2 | `CohortCompareDrawer` renders a tree: parent cohort as top-level row, subcohorts indented beneath; cohorts with no subcohorts render flat (unchanged) | VERIFIED | `CohortCompareDrawer.tsx:124-174` — `topLevelItems.map` with `isParent` check; flat path calls `renderLabel(s)` unchanged; parent path adds chevron + `space-y-1` subcohort block with `pl-6` class. |
| SC3 | Selecting the parent row applies the parent's own saved filter; selecting a subcohort applies that subcohort's filter independently; each counts toward max-4 | VERIFIED | `renderLabel` called with each `SavedSearch` object; `onChange={() => toggle(s.id)}` uses the specific entry's id. `isMaxReached` and `toggle` bodies unchanged (lines 39-49). |
| SC4 | `parseSubcohortName(name)` in `src/services/cohortNames.ts` returns `{ parent, sub }` for valid names and throws for 0 or 2+ colons; unit tested | VERIFIED | `cohortNames.ts` lines 43-59: splits on ':', throws on `parts.length !== 2`, trims both segments, throws on empty segment. 783 tests pass including all `cohortNames.test.ts` assertions. |
| SC5 | Attempting to save an orphan subcohort (parent name matches no existing `SavedSearch`) shows a validation warning but does not block save | VERIFIED | `CohortBuilderPage.tsx:117-127`: after valid parse and duplicate check, `parentExists` check emits `t('cohortNameOrphanWarning')` with `hasHardError: false`, `isHardError: false`; Save button `disabled={hasHardError \|\| !saveName.trim()}` stays enabled. |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/services/cohortNames.ts` | parseSubcohortName, isSubcohortName, normalizeCohortName, isDuplicateName, groupByParent | VERIFIED | 169 lines, all 5 functions exported; `grep -c "export function parseSubcohortName\|export function isSubcohortName\|export function groupByParent"` returns 3; normalizeCohortName and isDuplicateName also exported. |
| `src/i18n/translations.ts` | 10 new bilingual keys for subcohort UI | VERIFIED | `grep -c` for all 10 key names returns 10; each has `de:` and `en:` fields. Existing `save` key unchanged. |
| `src/pages/CohortBuilderPage.tsx` | Inline validation, soft orphan warning, per-row Split button, cohortSaveSearch label | VERIFIED | `parseSubcohortName` + `isDuplicateName` imported (line 22); `GitBranch` imported (line 8); `t('cohortSaveSearch')` on Save button (line 589); `role={isHardError ? 'alert' : 'status'}` on message `<p>` (line 595); `aria-invalid` on input (line 579). |
| `src/components/outcomes/CohortCompareDrawer.tsx` | groupByParent tree render with chevron, pl-6 subcohorts, independent selection | VERIFIED | `groupByParent` imported (line 4); `aria-expanded` (line 142); `pl-6` class on subcohort rows (line 169); `ChevronDown`/`ChevronUp` imported (line 1). |
| `tests/cohortNames.test.ts` | Unit tests for parseSubcohortName, isSubcohortName, normalizeCohortName | VERIFIED | File exists; all 13 assertions pass (part of 783/783 full suite). |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/pages/CohortBuilderPage.tsx` | `src/services/cohortNames.ts` | `import { isDuplicateName, parseSubcohortName }` | WIRED | Line 22: `from '../services/cohortNames'`; both symbols used in validation IIFE (lines 100, 113). |
| `src/components/outcomes/CohortCompareDrawer.tsx` | `src/services/cohortNames.ts` | `import { groupByParent }` | WIRED | Line 4: `from '../../services/cohortNames'`; called at render time (line 52). |
| `tests/cohortNames.test.ts` | `src/services/cohortNames.ts` | import + assertions GREEN | WIRED | Import resolves; 783/783 tests pass (cohortNames assertions part of suite). |
| `CohortBuilderPage.tsx handleSave` | `addSavedSearch` (DataContext) | called only when `!hasHardError` | WIRED | Line 167: early-return on `hasHardError`; line 174: `addSavedSearch(s)` called on success. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `CohortCompareDrawer.tsx` | `savedSearches` prop | Caller (`OutcomesView`) passes live `savedSearches` from `DataContext` | Yes — DataContext loads from `/api/data/saved-searches` | FLOWING |
| `CohortCompareDrawer.tsx` | `groupByParent(savedSearches)` | Pure derivation from prop at render time | Yes — no persisted state, derived live | FLOWING |
| `CohortBuilderPage.tsx` | `saveName` validation | User keystroke → `setSaveName` → IIFE runs on every render | Yes — real-time derived from controlled input | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `parseSubcohortName` exports present | `grep -c "export function parseSubcohortName\|export function isSubcohortName\|export function groupByParent" src/services/cohortNames.ts` | 3 | PASS |
| 10 i18n keys present | `grep -c "cohortSaveSearch:\|..." src/i18n/translations.ts` | 10 | PASS |
| Full test suite passes | `npm run test:ci` | 783/783 | PASS |
| Build clean | `npm run build` (no errors) | 0 errors | PASS |
| Lint clean (error level) | `npm run lint` | 0 errors (1 warning: import sort in test file) | PASS |
| `isSubcohortName` is a true guard (CR-01 fix) | `grep -n "parts\[0\].trim" src/services/cohortNames.ts` | Lines 50, 70 — non-empty segment check in both parseSubcohortName and isSubcohortName | PASS |
| `groupByParent` defensive try/catch (CR-01 fix) | `grep -n "try\|catch" src/services/cohortNames.ts` | Lines 136-139 — catch skips unparseable names | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| KOH-003 | 31-01-PLAN.md, 31-02-PLAN.md, 31-03-PLAN.md | Users can split any saved cohort into named subcohorts via `ParentName:SubcohortName`; validated + orphan soft-warning | SATISFIED | `cohortNames.ts` provides parseSubcohortName/isDuplicateName; `CohortBuilderPage` wires live validation + Split button; 783/783 tests green. |
| KOH-004 | 31-01-PLAN.md, 31-03-PLAN.md | Subcohorts appear in tree-grouped picker in `CohortCompareDrawer`; independent selection; counts toward max-4 | SATISFIED | `CohortCompareDrawer` uses `groupByParent` for tree render with chevron expand/collapse, `pl-6` indented subcohorts; `toggle` / `isMaxReached` unchanged. |

**Note:** REQUIREMENTS.md still shows `[ ]` for KOH-003 and KOH-004 (Pending). These checkbox markers should be updated to `[x]` and status changed from "Pending" to "Complete" to close the traceability record. This is a documentation update, not a code gap — the implementation is fully present.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `tests/cohortNames.test.ts` | 8 | `simple-import-sort/imports` lint warning (unresolved import sort) | Info | No runtime impact; flagged by lint as a warning only (not an error). Advisory only. |
| `src/pages/CohortBuilderPage.tsx` | 103-108 | WR-03 (open): empty-parent vs empty-sub distinguished by error message string matching (`msg.includes('parent segment')`) | Warning | Brittle under future error message reword. Non-blocking: tests pass and behavior is correct. Remains open in 31-REVIEW.md. |
| `src/components/outcomes/CohortCompareDrawer.tsx` | 31-37 | WR-05 (open): Escape key handler active even when drawer is closed (`open` not in deps array) | Warning | Can swallow Escape from other components when drawer is closed. Non-blocking. Remains open in 31-REVIEW.md. |
| `src/i18n/translations.ts` | ~168 | IN-03 (open): `cohortTreeSubcohortOf` key added but not used in any source file | Info | Dead i18n; may be flagged by `npm run knip`. No runtime impact. |

No `TBD`, `FIXME`, or `XXX` markers found in phase-modified files.

---

### Human Verification Required

#### 1. Tree Render and Chevron Collapse/Expand

**Test:** In the running app, save two cohorts `C1:Male` and `C1:Female`, then open `C1` as a comparison cohort. Open the CohortCompareDrawer.
**Expected:** `C1` appears as a parent row with a chevron. `C1:Male` and `C1:Female` render indented beneath it. Clicking the chevron collapses the group (subcohorts hidden); clicking again re-expands it. A flat cohort (no colon) renders without chevron, identical to pre-Phase-31 behavior.
**Why human:** Tree render with expand/collapse requires a running React app with live state; the jsdom test environment covers the structural assertions but visual grouping and animation need a real browser.

#### 2. Orphan Subcohort Amber Warning + Save Proceeds

**Test:** In the save dialog, type `Ghost:Sub` where no cohort named `Ghost` exists.
**Expected:** An amber (not red) warning message appears below the input reading "Parent cohort not found – you can still save". The Save cohort button remains enabled. Clicking Save persists the subcohort.
**Why human:** Amber vs red color distinction is a visual property; the ARIA `role="status"` (vs `role="alert"`) is covered by tests but the visual appearance requires human confirmation.

#### 3. Split Button Cursor Placement

**Test:** Click the teal GitBranch Split button on any cohort row.
**Expected:** The name input is populated with `<cohortName>:` and the cursor is positioned after the colon (not at position 0). The input is focused and scrolled into view.
**Why human:** `setSelectionRange` is a no-op in jsdom; cursor placement requires a real browser to verify. The `scrollIntoView` guard was added specifically because jsdom doesn't implement it.

---

### Gaps Summary

No blocking gaps found. All 5 ROADMAP success criteria are verified in the codebase. The CR-01 blocker (groupByParent crashing on empty-segment names) was fixed in commit d4ff9d5 — `isSubcohortName` now validates non-empty segments (true guard) and `groupByParent` wraps `parseSubcohortName` in a defensive try/catch. WR-03 and WR-05 remain open advisory items per 31-REVIEW.md but are non-blocking.

**REQUIREMENTS.md update needed:** KOH-003 and KOH-004 status rows still read "Pending" — the checkbox markers and traceability table should be updated to "Complete" to close the audit trail.

---

_Verified: 2026-05-21T16:05:00Z_
_Verifier: Claude (gsd-verifier)_
