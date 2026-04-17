---
phase: 10-visual-ux-qa-preview-stability
verified: 2026-04-16T13:42:00Z
status: human_needed
score: 6/6 must-haves verified (light-mode scope; dark-mode explicitly deferred per REQUIREMENTS.md footnote)
overrides_applied: 0
re_verification: null
human_verification:
  - test: "Manual visual inspection of /outcomes chart panels in a live browser"
    expected: "OD (blue-700 #1d4ed8), OS (red-700 #b91c1c), OD+OS (violet-700 #6d28d9) series render with distinguishable contrast against the white panel background across median (strokeWidth=3), per-patient lines (strokeWidth=1.5, opacity 0.3/0.6), scatter dots (fillOpacity=0.7), and IQR band (fillOpacity=0.15). IQR band should appear as a soft fill, median line should dominate visually."
    why_human: "Automated tests prove WCAG ratios (6.47–7.10 vs 3.0 threshold) but cannot assess perceptual distinguishability at various zoom levels — Success Criterion #3 explicitly mentions 'at all zoom levels'."
  - test: "Manual end-to-end check of the tooltip on /outcomes"
    expected: "Hovering a per-patient series shows pseudonym → OD/OS → '{N} d' or '#{N}' → logMAR/Δ logMAR/% in the expected order. Toggling perPatient layer off suppresses those tooltips; median/scatter/IQR tooltips still appear."
    why_human: "Tooltip behavior depends on Recharts hover state which is not exercisable in jsdom; component-level tests use a mocked payload. Real hover interaction confirms Recharts payload shape matches the component's expectations."
  - test: "Manual check of the three empty states on /outcomes in DE + EN"
    expected: "'no-cohort' (no cohort selected): 'Keine Patient:innen in dieser Kohorte' / 'No patients in this cohort' with the Cohort Builder action link. 'no-visus' (empty cohort): 'Keine Visus-Messungen in dieser Kohorte' / 'No visus measurements in this cohort'. 'all-eyes-filtered' (cohort with data but all four layer toggles off): 'Keine Augen entsprechen den aktuellen Filtern.' / 'No eyes match the current filters.' with no action link."
    why_human: "Automated tests confirm the component renders the right copy when invoked with each variant, but the dispatch condition for 'all-eyes-filtered' (cohort>0 AND measurements>0 AND all four layer toggles false) requires a real user-driven layer-toggle interaction to exercise the full flow."
  - test: "Manual verification that admin center filter narrows the user list in a live admin session"
    expected: "On /admin, the Center select shows 8 options (All centers + UKA, UKC, UKD, UKG, UKL, UKMZ, UKT in that order). Selecting a specific center narrows the visible user table to only users whose assignment includes that center."
    why_human: "Automated RTL test uses mocked /api/fhir/centers and /api/auth/users responses; real session verification confirms the server-side roster endpoint agrees with data/centers.json and that real user records include the centers array shape the filter expects."
  - test: "Manual verification of OutcomesDataPreview row rendering under realistic cohort sizes"
    expected: "Expanding the preview on a cohort with hundreds of rows shows stable row ordering, no React key-collision console warnings in the devtools console, and reordering the underlying data does not cause visual jumps in rendered rows."
    why_human: "Automated test covers uniqueness + reorder stability + duplicate-tuple handling on a 10-row fixture with a synthetic duplicate; real-cohort scale confirms behavior holds at production sizes without performance degradation."
---

# Phase 10: Visual/UX QA & Preview Stability — Verification Report

**Phase Goal:** Every v1.5 visual/UX QA flag is closed with a verifiable test, and OutcomesDataPreview rows survive reordering without React key collisions.
**Verified:** 2026-04-16T13:42:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin filter UI renders exactly 7 EyeMatics sites and selection narrows the user list — locked by snapshot test | VERIFIED | `tests/adminCenterFilter.test.tsx` has two tests: 8-option count (All centers + 7 sites UKA, UKC, UKD, UKG, UKL, UKMZ, UKT in exact order) and narrowing via fireEvent.change — both pass |
| 2 | Median / per-patient / scatter series pass WCAG AA contrast against panel background (light mode codified; dark mode deferred per 10-CONTEXT.md) | VERIFIED | `tests/outcomesPalette.contrast.test.ts` asserts every EYE_COLORS entry ≥ 3.0:1 vs `#ffffff`. Actual ratios: OD 6.70:1, OS 6.47:1, OD+OS 7.10:1 (all > 2x threshold). Dark-mode deferral footnote recorded in REQUIREMENTS.md under VQA-02 per D-02/CONTEXT §Deferred |
| 3 | IQR band disappears cleanly (no 0-height artifact) when n < 2 at a grid point | VERIFIED | `src/utils/cohortTrajectory.ts:453` enforces `if (ys.length < 2) continue;` with D-04 (VQA-03) traceability comment. `tests/outcomesIqrSparse.test.tsx` covers math invariant (no GridPoint with n<2) + DOM invariant (no path with empty `d`) — 4/4 pass |
| 4 | Outcomes tooltip shows localized patient id / eye / x-value / y-value; per-patient tooltip suppressed when layer toggled off | VERIFIED | `OutcomesTooltip.tsx` implements D-05 field order + D-06 `__series: 'perPatient'` filter. `tests/outcomesTooltip.test.tsx` has 5 tests covering absolute/days, delta_percent/treatments, delta/days, D-06 null return for perPatient-only payload with `perPatient=false`, and median-still-renders regression — all pass |
| 5 | /outcomes empty states show distinct DE + EN copy | VERIFIED | `OutcomesEmptyState.tsx` `Variant` union is `'no-cohort' \| 'no-visus' \| 'all-eyes-filtered'` routed via switch. `OutcomesPage.tsx:135-149` dispatches the new variant. `src/i18n/translations.ts:666-667` carries D-08 verbatim DE+EN strings. `tests/outcomesEmptyState.test.tsx` (6 tests) + `tests/outcomesI18n.test.ts` completeness gate all pass |
| 6 | OutcomesDataPreview rows use stable composite key; React-key-uniqueness test passes across reorderings | VERIFIED | `OutcomesDataPreview.tsx:166-174` pre-computes stable composite keys `${pseudo}\|${eye}\|${date}` with `\|#N` counter for duplicate tuples (D-10/D-11). `data-row-key` attribute exposes key for inspection. `tests/outcomesDataPreview.test.tsx` has 4 tests: uniqueness, no array-index suffix, reorder stability, duplicate-tuple with no React warning — all pass |

**Score:** 6/6 truths verified (light-mode scope for SC #2 per documented deferral)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/outcomes/palette.ts` | EYE_COLORS, SERIES_STYLES, PANEL_BACKGROUND, contrast helpers | VERIFIED | All exports present. 52 lines. Tailwind-700 anchors with pre-computed ratios in docblock |
| `src/components/outcomes/OutcomesPanel.tsx` | Consumes SERIES_STYLES; injects `__series` marker + pseudonym; threads layers prop to tooltip | VERIFIED | 197 lines. Line 16 imports SERIES_STYLES. Lines 146-147 IQR opacities from SERIES_STYLES. Lines 166-167 perPatient opacities. Line 177 scatter opacity. Line 188 median strokeWidth. Line 132 passes `layers={layers}`. Lines 158-162 `__series: 'perPatient' as const`, `pseudonym: p.pseudonym` injection. No inline chart-series literals remain |
| `src/pages/OutcomesPage.tsx` | Sources panel colors from EYE_COLORS; dispatches all-eyes-filtered variant | VERIFIED | Line 11 imports EYE_COLORS. Lines 194/205/216 use EYE_COLORS.OD / EYE_COLORS.OS / EYE_COLORS['OD+OS']. No CHART_COLORS references. Lines 135-149 dispatch the `all-eyes-filtered` variant after the no-visus early return |
| `src/components/outcomes/OutcomesTooltip.tsx` | layers prop; D-06 filter; D-05 xDisplay + yUnit | VERIFIED | Line 16 `layers` in Props interface. Line 33-39 D-06 filter. Line 81-82 xDisplay. Line 85-86 yUnit. Both median + per-patient branches use xDisplay; per-patient branch appends yUnit after fmtNum(logmar) |
| `src/components/outcomes/OutcomesEmptyState.tsx` | 3-variant union with all-eyes-filtered routing | VERIFIED | Line 6 Variant union = `'no-cohort' \| 'no-visus' \| 'all-eyes-filtered'`. Switch statement routes each to title/body/action keys. No-action-link for all-eyes-filtered per D-08 |
| `src/components/outcomes/OutcomesDataPreview.tsx` | Stable composite row key + data-row-key | VERIFIED | Lines 166-174 pre-compute rowKeys[] using pipe-delimited composite with `\|#N` for duplicates. Line 251 `key={rowKeys[i]}`, line 252 `data-row-key={rowKeys[i]}`. No inline `${pseudo}-${eye}-${date}-${i}` array-index pattern remains |
| `src/utils/cohortTrajectory.ts` | D-04 guard: omit grid points when ys.length < 2 | VERIFIED | Line 453 `if (ys.length < 2) continue;` with D-04 (VQA-03) traceability comment |
| `src/pages/AdminPage.tsx` | Center filter state, useMemo predicate, select UI with data-testid | VERIFIED | Line 74 centerFilter state. Lines 149-150 filter predicate (u.centers.includes). Line 177 useMemo deps include centerFilter. Line 463 `data-testid="admin-center-filter"` select. Line 468 All centers option |
| `src/i18n/translations.ts` | adminFilterAllCenters + outcomesEmptyAllEyesFiltered keys | VERIFIED | Line 321 adminFilterAllCenters (DE: 'Alle Zentren', EN: 'All centers'). Lines 666-667 outcomesEmptyAllEyesFilteredTitle + Body with D-08 verbatim strings |
| `tests/outcomesPalette.contrast.test.ts` | WCAG AA contrast gate | VERIFIED | 3 sanity + 3 EYE_COLORS assertions, all pass |
| `tests/outcomesIqrSparse.test.tsx` | math + DOM invariants | VERIFIED | 4/4 tests pass |
| `tests/outcomesTooltip.test.tsx` | D-05 format + D-06 suppression | VERIFIED | 5/5 tests pass |
| `tests/outcomesEmptyState.test.tsx` | D-07 dispatch + D-08 localization | VERIFIED | 6/6 tests pass |
| `tests/adminCenterFilter.test.tsx` | 7-site snapshot + narrowing | VERIFIED | 2/2 tests pass |
| `tests/outcomesDataPreview.test.tsx` | React key uniqueness + reorder + duplicate-tuple | VERIFIED | 4/4 tests pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| OutcomesPanel.tsx | palette.ts | Named import SERIES_STYLES | WIRED | Line 16 `import { SERIES_STYLES } from './palette';` — used in lines 146, 147, 166, 167, 177, 188 |
| OutcomesPage.tsx | palette.ts | Named import EYE_COLORS | WIRED | Line 11 `import { EYE_COLORS } from '../components/outcomes/palette';` — used in lines 194, 205, 216 |
| tests/outcomesPalette.contrast.test.ts | palette.ts | Named imports EYE_COLORS + helpers | WIRED | Lines 10-15 import EYE_COLORS, PANEL_BACKGROUND, computeContrastRatio, relativeLuminance |
| tests/outcomesIqrSparse.test.tsx | OutcomesPanel + cohortTrajectory | RTL render + direct computeCohortTrajectory call | WIRED | Line 40-46 imports; DOM inspection via `container.querySelectorAll('path')` |
| OutcomesPanel.tsx | OutcomesTooltip.tsx | Tooltip content prop passes `layers={layers}` | WIRED | Line 132 `layers={layers}` |
| OutcomesEmptyState.tsx | translations.ts | titleKey/bodyKey → outcomesEmptyAllEyesFiltered* | WIRED | Lines 31-32 route all-eyes-filtered to outcomesEmptyAllEyesFilteredTitle/Body |
| OutcomesPage.tsx | OutcomesEmptyState.tsx | `variant="all-eyes-filtered"` dispatch | WIRED | Lines 133-149 conditional render with dispatch predicate |
| AdminPage.tsx | /api/fhir/centers | existing centerOptions fetch reused | WIRED | Centers loaded via useEffect authFetch, populate `<select>` |
| OutcomesDataPreview.tsx (render loop) | rowKeys[] | key + data-row-key attrs | WIRED | Lines 251-252 use rowKeys[i] for React key AND data-row-key DOM attr |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| AdminPage center filter | centerOptions | `/api/fhir/centers` fetch → data/centers.json (7-site roster) | Yes — real roster data | FLOWING |
| OutcomesPanel IQR | iqrData (p25, p75) | panel.medianGrid from computeCohortTrajectory with n≥2 guard | Yes — real cohort math | FLOWING |
| OutcomesPanel per-patient | Line data with __series + pseudonym | panel.patients.measurements.map() injection | Yes — from cohort case data | FLOWING |
| OutcomesTooltip fields | pseudo, eye, xValue, logmar, yUnit | Recharts payload via __series-filtered mapping | Yes — Recharts hover payload | FLOWING |
| OutcomesEmptyState copy | titleKey/bodyKey translations | translations table via t(key) | Yes — real DE+EN strings | FLOWING |
| OutcomesDataPreview rowKeys | `${pseudo}\|${eye}\|${date}[\|#N]` | flattenToRows(cases) → deterministic pre-pass | Yes — pure function of cases | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full vitest suite green | `npx vitest run` | 33 files / 340 tests passed | PASS |
| Phase 10 test files green | `npx vitest run tests/outcomesPalette.contrast.test.ts tests/outcomesIqrSparse.test.tsx tests/outcomesTooltip.test.tsx tests/outcomesEmptyState.test.tsx tests/adminCenterFilter.test.tsx tests/outcomesDataPreview.test.tsx tests/outcomesI18n.test.ts` | 7 files / 30 tests passed | PASS |
| No CHART_COLORS in OutcomesPage | `grep -n "CHART_COLORS" src/pages/OutcomesPage.tsx` | No matches | PASS |
| No inline chart-series literals in OutcomesPanel | `grep -En "fillOpacity=\{0\.5\}\|fillOpacity=\{0\.15\}\|strokeWidth=\{3\}\|strokeWidth=\{1\.5\}" src/components/outcomes/OutcomesPanel.tsx` | No matches | PASS |
| Centers roster has exactly 7 entries | `cat data/centers.json` | 7 entries verified (UKA, UKC, UKD, UKG, UKL, UKMZ, UKT) | PASS |
| REQUIREMENTS.md footnote present | `grep -F "Phase 10 scope note" .planning/REQUIREMENTS.md` | Match found | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VQA-01 | 10-04a | Admin filter UI renders all 7 sites and filters correctly; snapshot test locked to roster | SATISFIED | adminCenterFilter.test.tsx 2/2 pass; 8-option snapshot + narrowing |
| VQA-02 | 10-01 | Outcomes chart palette meets WCAG AA contrast (light mode codified; dark mode deferred) | SATISFIED | outcomesPalette.contrast.test.ts 6/6 pass; REQUIREMENTS.md footnote records deferral |
| VQA-03 | 10-02a | IQR band clean fallback when n<2 — no 0-height artifact | SATISFIED | cohortTrajectory.ts:453 guard; outcomesIqrSparse.test.tsx 4/4 pass (math + DOM) |
| VQA-04 | 10-02b | Tooltip shows localized id/eye/x/y; per-patient suppressed on layer toggle | SATISFIED | OutcomesTooltip D-05 + D-06; outcomesTooltip.test.tsx 5/5 pass |
| VQA-05 | 10-03 | Empty-state copy for three variants localized DE + EN | SATISFIED | OutcomesEmptyState 3-variant union; outcomesEmptyState.test.tsx 6/6 pass; outcomesI18n.test.ts completeness gate green |
| CRREV-02 | 10-04b | OutcomesDataPreview stable composite key — React-key-uniqueness test | SATISFIED | OutcomesDataPreview rowKeys[] pre-pass; outcomesDataPreview.test.tsx 4/4 pass |

All 6 phase-10 requirement IDs are accounted for and each maps to a passing plan + test. No orphaned requirements — REQUIREMENTS.md §Traceability maps VQA-01..05 and CRREV-02 to Phase 10, and all 6 are covered by the phase's 6 plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | No TODO/FIXME/placeholder/stub markers found in files modified this phase | — | — |

Files scanned (from SUMMARY key-files sections): `src/components/outcomes/palette.ts`, `OutcomesPanel.tsx`, `OutcomesTooltip.tsx`, `OutcomesEmptyState.tsx`, `OutcomesDataPreview.tsx`, `src/pages/OutcomesPage.tsx`, `src/pages/AdminPage.tsx`, `src/utils/cohortTrajectory.ts`, `src/i18n/translations.ts`. No matches for TODO/FIXME/XXX/HACK/PLACEHOLDER, no "not implemented" comments, no console.log-only handlers, no hardcoded empty values that flow to rendering without a data-fetch path.

### Human Verification Required

Although all 6 Success Criteria are codified by automated tests, five behaviors require human verification to fully close the visual/UX QA intent of this phase:

1. **Chart panel visual QA in a live browser** — Test the /outcomes panels in a real cohort to confirm perceptual distinguishability of the palette at various zoom levels (Success Criterion #3 mentions "at all zoom levels").
2. **Tooltip behavior with real Recharts hover** — Verify the tooltip payload shape agreement between Recharts and the component during a real hover, which jsdom cannot exercise.
3. **Empty-state full dispatch flow** — Exercise the 'all-eyes-filtered' variant by toggling all four layers off in a real session.
4. **Admin center filter live narrowing** — Confirm the real /api/fhir/centers and /api/auth/users responses produce the expected narrowing in an admin session.
5. **OutcomesDataPreview at realistic cohort scale** — Verify key stability and no console warnings when the preview renders hundreds of rows from a real cohort.

Detailed test/expected/rationale in the YAML frontmatter above.

### Gaps Summary

No gaps. All 6 Success Criteria are codified by passing automated tests; all 6 requirement IDs map to complete plans; all key links are wired; all data flows through real sources. The phase's scope narrowing for VQA-02 (dark mode deferred) is explicitly documented in REQUIREMENTS.md and CONTEXT.md §Deferred — this is not a gap but a documented scope boundary for a future milestone.

Status is `human_needed` because, per the GSD gate taxonomy, visual appearance, real-time hover interaction, complete user-flow exercise, and real-cohort scale verification are inherently outside the reach of automated tests and require human observation to complete the phase's "visual/UX QA" intent.

---

*Verified: 2026-04-16T13:42:00Z*
*Verifier: Claude (gsd-verifier)*
