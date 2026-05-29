---
phase: 41-docquality-multicenter-ux
plan: "01"
subsystem: ui
tags: [react, tailwind, vitest, rtl, fhir, i18n, quality-module]

requires:
  - phase: 40-docquality-foundation
    provides: QualityPage with single-select center filter; filterBundlesByCenters server enforcement

provides:
  - CenterMultiSelect shared component (src/components/common/CenterMultiSelect.tsx) — Phase 42 ready
  - QualityPage multi-center filtering (selectedCenters:string[] replaces filterCenter:string)
  - RTL tests for CenterMultiSelect (7 tests)
  - QUAL-024 server intersection regression test — authorized-center escalation proof

affects:
  - 42-analysis-multicenter (consumes CenterMultiSelect)
  - any future quality filter work (QualityCaseListProps updated)

tech-stack:
  added: []
  patterns:
    - "CenterMultiSelect: chip-style toggle, count badge, clear button — presentational only, no server call"
    - "selectedCenters.length>0 guards multi-center membership test; empty = all (no filter)"
    - "Client multi-select is narrowing-only; server filterBundlesByCenters is sole center authority"

key-files:
  created:
    - src/components/common/CenterMultiSelect.tsx
    - tests/CenterMultiSelect.test.tsx
  modified:
    - src/pages/QualityPage.tsx
    - src/components/quality/QualityCaseList.tsx
    - src/i18n/translations.ts
    - tests/fhirApi.test.ts

key-decisions:
  - "CenterMultiSelect is chip-style toggles (not dropdown) — fits compact filter panel, clearer selection state"
  - "Empty selectedCenters = all centers shown (no filter) — matches plan spec; avoids 'all' sentinel string"
  - "Client multi-select sends NO center list to server — server always uses req.auth.centers only"
  - "QUAL-024 intersect test locks the no-escalation invariant so future client changes cannot regress it"

patterns-established:
  - "Shared components in src/components/common/ — importable by multiple pages/phases"
  - "selectedCenters:string[] pattern for multi-center filtering (Phase 42 can copy exact pattern)"

requirements-completed: [QUAL-024]

duration: 4min
completed: "2026-05-25"
---

# Phase 41 Plan 01: CenterMultiSelect + QUAL-024 Multi-Center Filter Summary

**Chip-style multi-select center filter replacing single-select dropdown in QualityPage, locked with server no-escalation intersection test and shared for Phase 42 reuse**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-25T21:49:39Z
- **Completed:** 2026-05-25T21:53:25Z
- **Tasks:** 3 (TDD: 4 commits)
- **Files modified:** 6

## Accomplishments

- Built `CenterMultiSelect` shared component (chip toggles, count badge, clear button) in `src/components/common/` — Phase 42 can import without rework
- Replaced `filterCenter:string` with `selectedCenters:string[]` in QualityPage; multi-center membership test filters correctly; empty array = all
- Added QUAL-024 server regression test: `filterBundlesByCenters(bundles, ['org-uka'])` returns only the aachen bundle — org-ukc cannot appear for an org-uka-only user
- `npm run test:ci`: 1020/1020 green (was 1012; +8 new tests across plan)

## Task Commits

1. **Task 1 RED: Failing RTL tests** - `6ee2d90` (test)
2. **Task 1 GREEN: CenterMultiSelect + i18n keys** - `b325d72` (feat)
3. **Task 2: Wire into QualityPage + QualityCaseList** - `63bd21c` (feat)
4. **Task 3: QUAL-024 intersect regression test** - `a488a1b` (test)

## Files Created/Modified

- `src/components/common/CenterMultiSelect.tsx` — Shared multi-select center filter; exports `CenterMultiSelect` + `CenterMultiSelectProps`
- `tests/CenterMultiSelect.test.tsx` — 7 RTL tests: toggle-add, toggle-remove, clear, count indicator, all-centers label, optional label prop
- `src/pages/QualityPage.tsx` — `filterCenter:string` replaced with `selectedCenters:string[]`; filteredCases guard updated; useMemo dep updated
- `src/components/quality/QualityCaseList.tsx` — Single-select `<select>` replaced with `CenterMultiSelect`; props updated
- `src/i18n/translations.ts` — Added `qualityFilterCentersAll` (de/en) and `qualityFilterCentersClear` (de/en)
- `tests/fhirApi.test.ts` — Added QUAL-024 intersect regression test (Test 9)

## Decisions Made

- Chip-style toggles chosen over checkbox dropdown for the compact filter panel — visible selection state without opening a dropdown
- Empty `selectedCenters` (not `'all'` sentinel) represents the no-filter state — cleaner, avoids stringly-typed sentinel
- `CenterMultiSelect` is purely presentational — selection state is owned by parent, component never touches the server

## Deviations from Plan

None — plan executed exactly as written. Import-sort lint warning auto-fixed by eslint --fix (no behavior change).

## Issues Encountered

None.

## Known Stubs

None — all props are wired from real data; `centerNames` derives from `scopedCases`.

## Threat Flags

None — no new network endpoints or trust boundaries introduced. CenterMultiSelect is client-side only; server authority remains with `filterBundlesByCenters` and `req.auth.centers`.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `CenterMultiSelect` is ready for Phase 42 (AnalysisPage) — import from `src/components/common/CenterMultiSelect`
- Props contract: `options:string[], selected:string[], onChange:(next:string[])=>void, label?:string`
- Server intersection invariant is locked with a regression test

---
*Phase: 41-docquality-multicenter-ux*
*Completed: 2026-05-25*
