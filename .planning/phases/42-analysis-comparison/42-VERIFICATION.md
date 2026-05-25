---
phase: 42-analysis-comparison
verified: 2026-05-26T00:35:00Z
status: passed
score: 6/6 must-haves verified (2 gaps closed post-verification: lint error + SC4 CenterMultiSelect in Analysis)
overrides_applied: 0
gaps:
  - truth: "The shared multi-select center filter from Phase 41 is correctly consumed by the Analysis views"
    status: failed
    reason: "CenterMultiSelect is never imported or used in src/pages/AnalysisPage.tsx. The component exists (src/components/common/CenterMultiSelect.tsx) and is used by QualityCaseList.tsx (Phase 41), but no Phase 42 plan or task wired it into Analysis. This is ROADMAP Phase 42 Success Criterion 4."
    artifacts:
      - path: "src/pages/AnalysisPage.tsx"
        issue: "No import or usage of CenterMultiSelect"
    missing:
      - "Import CenterMultiSelect from ../components/common/CenterMultiSelect"
      - "Wire CenterMultiSelect into the AnalysisPage center filter (both aggregate and trajectories tab, or at minimum the aggregate tab)"
  - truth: "npm run lint exits 0"
    status: failed
    reason: "tests/AnalysisPage.test.tsx line 89 uses require('react') inside a vi.mock factory — introduced by Phase 42 commit b6d87b4 (42-02 RED). The 42-03 SUMMARY incorrectly claimed this was pre-existing. The file did not exist before Phase 42 (confirmed via git history). Lint exits with 1 error: '@typescript-eslint/no-require-imports'."
    artifacts:
      - path: "tests/AnalysisPage.test.tsx"
        issue: "Line 89: `const React = require('react')` inside vi.mock factory — forbidden by @typescript-eslint/no-require-imports"
    missing:
      - "Replace require('react') with a factory-safe alternative (import React from 'react' hoisted outside mock, or use import.meta.env pattern, or restructure the recharts stub without requiring React directly)"
---

# Phase 42: Analysis Cohort Comparison & Labeling Verification Report

**Phase Goal:** Cohort comparison plots are clearly labeled, the Aggregated tab supports between-cohort comparison, and the active cohort name is shown on direct-URL load.
**Verified:** 2026-05-26T00:35:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | When comparing 2+ cohorts, interval histogram identifies each series by color + name via COHORT_PALETTES | VERIFIED | `IntervalHistogram.tsx` exports `IntervalCohortSeries` interface; cross mode adds `<Bar name={s.cohortName} fill={s.color}>` per cohort, `<Legend>` element, and DOM-text median annotation with color swatch + cohort name (lines 34–250) |
| 2 | Each interval-histogram cohort series uses the same COHORT_PALETTES color as Visus/CRT panels | VERIFIED | `OutcomesView.tsx` `crossCohortCaseSeries` memo (lines 381–390) assigns `COHORT_PALETTES[idx % len]` by same index order as `crossCohortAggregates`; explicitly documented in comment at line 379 |
| 3 | Aggregated tab renders diagnosis distribution + age-vs-Visus comparison per cohort with palette colors | VERIFIED | `AnalysisPage.tsx` lines 345–476: when `isCrossMode && crossCohorts.length >= 2`, renders `data-testid="compare-diagnosis"` (small-multiple pies per cohort headed by `<h4 style={{color: cohort.color}}>`) and `data-testid="compare-age-visus"` (ScatterChart with one `<Scatter fill={cohort.color} name={cohort.cohortName}>` per cohort) |
| 4 | When Analysis loaded via `?filters=<json>`, cohort/filter name is displayed | VERIFIED | `AnalysisPage.tsx` lines 123–138: `displayCohortName` memo covers all 4 scenarios: saved-search → `activeSavedSearch.name`; `?filters=` + `?name=` → URL param (capped 80 chars); `?filters=` only → `t('analysisFilteredCohort') + ' · ' + summarizeCohortFilter(filters)`; no filter → `null`. Header renders `{displayCohortName !== null && <p>…</p>}` at line 295 |
| 5 | Single-cohort mode is unchanged (no legend clutter, eye toggle preserved) | VERIFIED | `IntervalHistogram.tsx` line 71: `isCrossMode = Boolean(cohortSeries && cohortSeries.length >= 2)`; single-cohort branch (lines 256–312) is byte-for-byte the pre-phase path — single `<Bar dataKey="count">`, eye toggle, single median `<p data-testid="interval-median">` |
| 6 | The shared multi-select center filter from Phase 41 is correctly consumed by the Analysis views | FAILED | `CenterMultiSelect` component exists at `src/components/common/CenterMultiSelect.tsx` and is wired into `QualityCaseList.tsx`, but no import or usage exists in `src/pages/AnalysisPage.tsx`. None of the three 42-xx PLANs included a task for this wiring. This is ROADMAP Phase 42 Success Criterion 4 and is unimplemented. |

**Score:** 5/6 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/outcomes/IntervalHistogram.tsx` | Cross-cohort labeled interval histogram (grouped bars + legend) | VERIFIED | Contains `IntervalCohortSeries` interface; `cohortSeries` prop; cross-mode BarChart with `<Legend>` and per-cohort `<Bar>` |
| `src/components/outcomes/ResponderView.tsx` | Cross-cohort labeled responder view (small-multiples per cohort) | VERIFIED | `CohortResponderPanel` sub-component renders one headed panel per cohort with `style={{color: series.color}}` heading; `cohortSeries` prop activates cross mode |
| `src/components/outcomes/OutcomesView.tsx` | `crossCohortCaseSeries` memo wiring both components | VERIFIED | Lines 381–390: `crossCohortCaseSeries` memo; lines 627–654: passes `cohortSeries={...}` to `IntervalHistogram` and `ResponderView` |
| `src/pages/AnalysisPage.tsx` | Cross-cohort aggregate comparison + displayCohortName | VERIFIED | `crossCohorts` memo (lines 166–187), comparison rendering (lines 345–476), `displayCohortName` memo (lines 123–138) — all implemented |
| `src/utils/cohortFilterSerialization.ts` | `summarizeCohortFilter` helper | VERIFIED | Lines 77–122: pure function, fixed field order, Set fields as count only, deterministic output |
| `src/i18n/translations.ts` | 6 new translation keys for Phase 42 | VERIFIED | `metricsIntervalCohortLegendAriaLabel`, `metricsIntervalMedianLineCohort`, `metricsResponderCohortLegendAriaLabel` (lines 833–850); `analysisCompareDiagnosisTitle`, `analysisCompareAgeVisusTitle`, `analysisCompareLegendAriaLabel` (lines 853–855); `analysisFilteredCohort` (line 858) |
| `tests/AnalysisPage.test.tsx` | Test coverage for ANL-011 and ANL-012 | VERIFIED (with caveat) | 402 lines, 24 tests covering cross-cohort parsing, comparison rendering, and 5 displayCohortName scenarios; 12 unit tests for `summarizeCohortFilter`. **Caveat:** contains 1 lint error (see Gaps) |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `OutcomesView.tsx` | `IntervalHistogram.tsx` | `cohortSeries={isCrossMode && crossCohortCaseSeries.length >= 2 ? crossCohortCaseSeries : undefined}` | WIRED | Line 631 |
| `OutcomesView.tsx` | `ResponderView.tsx` | `cohortSeries={isCrossMode && crossCohortCaseSeries.length >= 2 ? crossCohortCaseSeries : undefined}` | WIRED | Line 652 |
| `OutcomesView.tsx` | `COHORT_PALETTES` | `crossCohortCaseSeries` memo assigns `COHORT_PALETTES[idx % len]` | WIRED | Line 387 |
| `AnalysisPage.tsx` | `savedSearches + applyFilters` | `crossCohorts` memo resolves per-cohort cases from `?cohorts=` ids | WIRED | Lines 166–187 |
| `AnalysisPage.tsx` | `COHORT_PALETTES` | `crossCohorts` memo: `color = COHORT_PALETTES[idx % COHORT_PALETTES.length]` | WIRED | Line 184 |
| `AnalysisPage.tsx` | `summarizeCohortFilter` | `displayCohortName` memo calls `summarizeCohortFilter(filters)` | WIRED | Line 133 |
| `AnalysisPage.tsx` | `CenterMultiSelect` | N/A | NOT WIRED | `CenterMultiSelect` not imported or used — ROADMAP SC 4 unmet |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `IntervalHistogram.tsx` cross mode | `crossData.rows` | `computeIntervalDistribution(series.cases, eye)` per cohort | Yes — `series.cases` comes from `applyFilters(activeCases, saved.filters, filterOptions)` in `OutcomesView.crossCohortCaseSeries` | FLOWING |
| `AnalysisPage.tsx` compare-diagnosis | `crossCohorts[n].cases` conditions | `applyFilters(activeCases, saved.filters, filterOptions)` in `crossCohorts` memo | Yes — same pattern as existing single-cohort `cohort` memo | FLOWING |
| `AnalysisPage.tsx` compare-age-visus | `cohortScatter` per cohort | `getObservationsByCode(c.observations, LOINC_VISUS)` over `crossCohorts[n].cases` | Yes — uses same FHIR extraction logic as single-cohort `ageVisusScatter` | FLOWING |
| `AnalysisPage.tsx` `displayCohortName` | `displayCohortName: string \| null` | `activeSavedSearch.name` or `?name=` param or `summarizeCohortFilter(filters)` | Yes — all four code paths produce values from real data; null guard is correct | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `summarizeCohortFilter` empty filter | `node -e "const {summarizeCohortFilter}=require('./src/utils/cohortFilterSerialization.ts');console.log(summarizeCohortFilter({}))"` | N/A (TS, not directly runnable) | SKIP — covered by 12 unit tests in tests/AnalysisPage.test.tsx, all green |
| Test suite | `npm run test:ci` | 1061/1061 passed, 95 test files | PASS |
| Lint gate | `npm run lint` | 1 error in tests/AnalysisPage.test.tsx line 89 | FAIL |

---

## Probe Execution

No phase-declared probes. Conventional `scripts/*/tests/probe-*.sh` not applicable to this UI phase.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| ANL-010 | 42-01-PLAN.md | Cohort labels on all comparison plots (interval histogram + responder) | SATISFIED | `IntervalHistogram.tsx` cross-mode with `<Legend>` + per-cohort `<Bar>`, `ResponderView.tsx` small-multiples with colored headings; `OutcomesView.tsx` wires `cohortSeries` to both |
| ANL-011 | 42-02-PLAN.md | Aggregated tab between-cohort comparison | SATISFIED | `AnalysisPage.tsx` `data-testid="compare-diagnosis"` (pies) and `data-testid="compare-age-visus"` (scatter) rendered when `isCrossMode && crossCohorts.length >= 2` |
| ANL-012 | 42-03-PLAN.md | Active cohort/filter name shown on `?filters=` direct-URL load | SATISFIED | `displayCohortName` memo + header `<p>` at line 295; covers saved-search, `?name=` param, synthesized label, and null (no cohort) paths |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `tests/AnalysisPage.test.tsx` | 89 | `const React = require('react')` inside `vi.mock('recharts', ...)` factory | BLOCKER | Lint exits 1 error (`@typescript-eslint/no-require-imports`). Introduced by commit b6d87b4 (42-02 RED) — the file did not exist before Phase 42. The 42-03 SUMMARY incorrectly described this as pre-existing. The task instruction "Run `npm run lint` (0 errors)" is not satisfied. |

---

## Human Verification Required

### 1. Cross-cohort interval histogram visual rendering

**Test:** Open Analysis → Trajectories tab with `?cohorts=<id1>,<id2>` (two saved searches), switch to the Interval metric tab.
**Expected:** Two grouped bars per interval bin, each in its COHORT_PALETTES color (#047857, #b45309, etc.); a Recharts legend shows cohort names with color swatches; the per-cohort median annotation row shows a color swatch + cohort name + median day count.
**Why human:** SVG rendering and Recharts Legend color chips cannot be fully validated by RTL/jsdom.

### 2. Aggregated tab cross-cohort comparison visual rendering

**Test:** Open Analysis → Aggregated tab with `?cohorts=<id1>,<id2>` active.
**Expected:** A cohort-color legend (color swatch + name per cohort), followed by per-cohort pie charts for diagnosis distribution (each headed by cohort name in its palette color), followed by a ScatterChart with one dot-series per cohort in its palette color with a legend.
**Why human:** Pie chart proportions, scatter point colors, and legend rendering require browser confirmation.

### 3. Direct `?filters=` load cohort name display

**Test:** Navigate to `/analysis?filters={"diagnosis":["E11"]}&tab=aggregate` — no `?cohort=` or `?name=`. Then separately with `?name=Diabetiker` appended.
**Expected:** Without `?name=`: header below the "Analyse" title shows "Filtered cohort · Diagnose: E11" (English) or "Gefilterte Kohorte · Diagnose: E11" (German). With `?name=Diabetiker`: header shows "Diabetiker".
**Why human:** Text truncation (80-char cap), locale switching, and dark-mode styling need browser confirmation.

### 4. Responder view cross-cohort small-multiples

**Test:** Open Analysis → Trajectories → Responder metric tab with `?cohorts=<id1>,<id2>`.
**Expected:** Two headed panels, each with a colored `<h4>` showing the cohort name + color swatch, containing a BarChart of responder/partial/non-responder buckets per eye.
**Why human:** Visual layout of small-multiples and color fidelity require browser confirmation.

---

## Gaps Summary

Two gaps block the phase goal:

**Gap 1 — CenterMultiSelect not wired into Analysis (BLOCKER — ROADMAP SC 4)**
ROADMAP Phase 42 Success Criterion 4 ("The shared multi-select center filter from Phase 41 is correctly consumed by the Analysis views") was not addressed by any of the three Phase 42 plans. `CenterMultiSelect` exists and works in `QualityCaseList.tsx`, but `AnalysisPage.tsx` has no import or usage. No task in 42-01/42-02/42-03 planned this wiring. The CONTEXT file says "where applicable" which the plans interpreted as not applicable, but the ROADMAP SC is unambiguous. Re-planning should include a task to add `CenterMultiSelect` to the Analysis center filter.

**Gap 2 — Lint error in test file (BLOCKER — lint gate not green)**
`tests/AnalysisPage.test.tsx` line 89 uses `require('react')` inside a `vi.mock` factory, violating `@typescript-eslint/no-require-imports`. `npm run lint` exits with 1 error. This was introduced by commit `b6d87b4` (42-02). The 42-03 SUMMARY called it pre-existing, but git history shows the file was created in this phase. The fix is to replace `require('react')` with an ES module import compatible with the vi.mock factory pattern (e.g., define the React stub element creator without importing React at all — Recharts stub components only need to return a JSX-like element, which can be done with a plain `(props) => null` stub).

---

*Verified: 2026-05-26T00:35:00Z*
*Verifier: Claude (gsd-verifier)*
