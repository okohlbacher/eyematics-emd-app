---
phase: 25-terminology-resolver
plan: 03
subsystem: services
tags: [terminology, react-hooks, refactor, fhir]

requires:
  - phase: 25-01
    provides: useDiagnosisDisplay hook, getCachedDisplay/getCachedFullText sync helpers, _seedMap
provides:
  - All 5 callers (PatientHeader, CohortBuilderPage, AnalysisPage, QualityPage, QualityCaseDetail) migrated to terminology module
  - pickCoding(cond) helper added to shared/fhirQueries.ts (D-20)
  - getDiagnosisLabel + getDiagnosisFullText fully removed from fhirLoader.ts (TERM-02)
  - fhirLoader.ts reduced to resource-extraction-only role (D-03)
affects: [25-04, future LOINC/Procedure terminology phases]

tech-stack:
  added: []
  patterns:
    - "D-19 caller split: hook for hot render paths (PatientHeader, CohortBuilderPage chip, etc.); sync helper for CSV / .map / useMemo non-hook contexts"
    - "Extract per-row inner component (DiagnosisPill, DiagnosisCodeChip) to satisfy React rules-of-hooks when calling useDiagnosisDisplay inside .map"
    - "pickCoding(cond) lives in shared/ once a (system, code) extraction crosses 2× threshold"

key-files:
  created: []
  modified:
    - shared/fhirQueries.ts
    - src/components/case-detail/PatientHeader.tsx
    - src/pages/CohortBuilderPage.tsx
    - src/pages/AnalysisPage.tsx
    - src/pages/QualityPage.tsx
    - src/components/quality/QualityCaseDetail.tsx
    - src/services/fhirLoader.ts

key-decisions:
  - "Added pickCoding(cond) to shared/fhirQueries.ts (D-20 discretionary): 4 distinct call-sites for the (system, code) pattern crosses the >2× threshold"
  - "AnalysisPage uses getCachedDisplay/getCachedFullText (sync helpers) inside useMemo — useMemo bodies are not hook contexts, so the sync helper is the correct fit per D-19"
  - "PatientHeader and CohortBuilderPage extract per-row inner components (DiagnosisPill, DiagnosisCodeChip) to host useDiagnosisDisplay calls at component-top-level (rules-of-hooks)"
  - "CohortBuilderPage CSV path uses getCachedDisplay(undefined, code, locale) since the diagCodes flat-map drops system context (D-05 sentinel path); behavior preserved for unmapped codes (D-09 raw-code fallthrough)"
  - "Removed unused SNOMED_AMD/SNOMED_DR named-imports in fhirLoader.ts after deleting the switch statements; the export * re-export from shared/fhirCodes keeps them on the public surface for callers"

patterns-established:
  - "Inner row-component extraction is the standard pattern when a hot render path calls useDiagnosisDisplay inside .map"
  - "pickCoding helper is the canonical (system, code) extractor for Condition-like resources"

requirements-completed:
  - TERM-02

duration: 8min
completed: 2026-04-29
---

# Phase 25 Plan 03: Caller Migration Summary

**5 diagnosis-display callers migrated from fhirLoader's hardcoded switch statements to the terminology module; getDiagnosisLabel + getDiagnosisFullText fully removed from fhirLoader.ts.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-29T19:54:18Z
- **Completed:** 2026-04-29T20:03:14Z
- **Tasks:** 4 (logical) / 6 atomic commits
- **Files modified:** 7

## Accomplishments
- All 5 callers compile against the new terminology API; zero remaining `getDiagnosisLabel`/`getDiagnosisFullText` references outside doc/comment text
- TERM-02 success criterion satisfied: the loader's hardcoded switch statements (lines 112-170) are deleted; `fhirLoader.ts` is now resource-extraction-only (D-03)
- D-19 caller split applied correctly: 3 hook callers (PatientHeader, CohortBuilderPage chip render, AnalysisPage uses sync helper inside useMemo because that's a non-hook context), 2 sync-helper callers (QualityPage CSV, QualityCaseDetail join)
- D-20 pickCoding(cond) added to shared/fhirQueries.ts and consumed by 3 callers (PatientHeader, QualityPage, QualityCaseDetail)
- Display strings byte-identical to pre-migration (seed map preserves exact German + English strings per D-08)
- Test count unchanged: 642/642 throughout (no regressions, no tests touched the deleted functions)

## Task Commits

1. **Task 1: pickCoding helper + PatientHeader** — `f000908` (refactor)
2. **Task 2a: CohortBuilderPage** — `e14d007` (refactor)
3. **Task 2b: AnalysisPage** — `87cd8e8` (refactor)
4. **Task 3a: QualityPage** — `dcc705d` (refactor)
5. **Task 3b: QualityCaseDetail** — `940d2d2` (refactor)
6. **Task 4: Remove getDiagnosisLabel/FullText from fhirLoader** — `b38edcc` (refactor)

## Files Created/Modified
- `shared/fhirQueries.ts` — added `pickCoding(cond)` helper (D-20)
- `src/components/case-detail/PatientHeader.tsx` — extract `DiagnosisPill` inner component using `useDiagnosisDisplay`
- `src/pages/CohortBuilderPage.tsx` — extract `DiagnosisCodeChip` inner component for hook usage; CSV uses `getCachedDisplay`
- `src/pages/AnalysisPage.tsx` — `diagDist` useMemo uses `getCachedDisplay`/`getCachedFullText` directly (non-hook context); track `system` in inner Map
- `src/pages/QualityPage.tsx` — CSV export uses `getCachedDisplay` + `pickCoding`
- `src/components/quality/QualityCaseDetail.tsx` — diagnosis label .map uses `getCachedDisplay` + `pickCoding`
- `src/services/fhirLoader.ts` — deleted the two switch-statement exports (~58 lines); removed dangling SNOMED_AMD/DR named imports; updated header comment to point at terminology.ts

## Decisions Made
- See `key-decisions` in frontmatter for the 5 substantive decisions taken during execution.
- Per D-25, one commit per caller (5 caller commits) plus a final cleanup commit removing the loader functions = 6 atomic commits total.

## Deviations from Plan

None - plan executed exactly as written.

Two minor lint autofix runs were needed after introducing new imports in QualityPage and QualityCaseDetail (simple-import-sort). These are mechanical reordering, not deviations.

## Issues Encountered
None. Test suite stayed at 642/642 across all 6 commits; build, lint, and knip green throughout.

## Next Phase Readiness
- TERM-02 fully closed; plan 25-04 (settings + docs) is the only remaining work in Phase 25.
- The terminology module's behavior is now exercised by every caller in the app — any future regression in `getCachedDisplay` / `useDiagnosisDisplay` will surface immediately in render paths and CSV exports.
- pickCoding(cond) is now available in `shared/fhirQueries.ts` for any future Condition-like extraction needs.

## Self-Check: PASSED

- All 7 modified files exist and contain the expected changes (verified via `grep -rn` showing zero `getDiagnosisLabel\|getDiagnosisFullText` outside doc/comment text).
- All 6 commits exist in git log: `f000908`, `e14d007`, `87cd8e8`, `dcc705d`, `940d2d2`, `b38edcc`.
- Final safety net green: test:ci 642/642, build, lint, knip.

---
*Phase: 25-terminology-resolver*
*Completed: 2026-04-29*
