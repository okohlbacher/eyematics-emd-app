---
phase: 41-docquality-multicenter-ux
verified: 2026-05-26T00:05:00Z
status: human_needed
score: 8/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open /quality with multi-center data loaded; click two center chips in the filter panel"
    expected: "Case list narrows to only those two centers; clearing chips restores all cases"
    why_human: "Client-side filter interaction and list narrowing requires a browser with real fixture data"
  - test: "Open /quality; switch time-range to '6m'; observe Grundgesamtheit label and SummaryCard counts"
    expected: "Population count drops to reflect only cases with observations in the last 6 months; SummaryCard shows 'N / total' sublabel"
    why_human: "Date-sensitive denominator shrinkage requires runtime data with known observation dates"
  - test: "Open /quality; select a flagged case; verify approve/flag select is visible without scrolling"
    expected: "Per-flag status select renders inside the case-info header card above the patient data grid and values tab"
    why_human: "Visual DOM order in actual viewport requires human scroll judgment; RTL covers structural order but not scroll threshold"
---

# Phase 41: docquality-multicenter-ux Verification Report

**Phase Goal:** The quality module shows correct population denominators, surfaces absolute counts, supports multi-site filtering, and places the approve/flag control within easy reach.
**Verified:** 2026-05-26T00:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Grundgesamtheit denominator reflects active time-range filter (QUAL-022) | VERIFIED | `timeScopedCases` useMemo at QualityPage.tsx:145-152 applies case-level inclusion test (`c.observations.some(o => effectiveDateTime >= cutoff)`); all SummaryCard `total=` props and `statusCounts` derive from `timeScopedCases`; RTL test in `tests/QualityPage.test.tsx:162-174` fires a '6m' click and asserts denominator drops to 1 (only recentCase qualifies) |
| 2 | Denominator uses case-level inclusion (not observation trimming only) | VERIFIED | QualityPage imports `cutoffDate` (not `filterCasesByTimeRange`) and applies `.some()` predicate that **drops entire cases** with no in-window observations; plan requirement for case-level inclusion explicitly met (comment at line 142-143) |
| 3 | Absolute counts are prominent and clearly labeled (QUAL-023) | VERIFIED | `SummaryCard` renders `{count} / {total}` sublabel (line 40) whenever `total` is provided; a `qualityPopulationLabel` paragraph (line 328-331) shows `timeScopedCases.length` always visible without hover; i18n keys `qualityPopulationLabel` (de: "Grundgesamtheit" / en: "Population") and `qualityOfTotal` present in translations.ts lines 444-445 |
| 4 | CenterMultiSelect is a standalone shared component importable by Phase 42 | VERIFIED | `src/components/common/CenterMultiSelect.tsx` exports `CenterMultiSelect` function + `CenterMultiSelectProps` interface (lines 21, 28); 97 lines, well above 40-line minimum; no server calls; selection state is entirely parent-owned |
| 5 | Multi-center filter wired into QualityPage (QUAL-024) | VERIFIED | `selectedCenters: string[]` state at QualityPage.tsx:85; filteredCases guard at line 206: `selectedCenters.length > 0 && !selectedCenters.includes(c.centerName)`; empty array = all (no filter); `CenterMultiSelect` imported and rendered in QualityCaseList; props threaded through `QualityCaseListProps` |
| 6 | Server multi-center security: filterBundlesByCenters is sole authority; client cannot escalate (QUAL-024 security) | VERIFIED | `/api/fhir/bundles` handler (fhirApi.ts:395-408) reads `req.auth.centers` from verified JWT, passes directly to `filterBundlesByCenters` — no client-supplied center list is read from query/body; QUAL-024 regression test (`tests/fhirApi.test.ts:332-354`) proves `filterBundlesByCenters(bundles, ['org-uka'])` returns exactly 1 bundle (org-uka only); org-ukc cannot appear |
| 7 | Approve/flag status control is near the top of case detail (QUAL-025) | VERIFIED | `QualityCaseDetail.tsx:176-203` renders a `data-testid="top-flag-status-controls"` block inside the case-info header card when `caseFlags.length > 0`, before the patient data grid and before the values/OCT tabs section; bottom "Existing flags" section also retained |
| 8 | DOM-order test proves flag controls precede values table (QUAL-025) | VERIFIED | `tests/QualityCaseDetail.test.tsx:136-151` uses `compareDocumentPosition` to assert `top-flag-status-controls` precedes the `valuesToReview` tab button; test passes in the full suite |

**Score:** 8/8 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/common/CenterMultiSelect.tsx` | Shared multi-select center filter component | VERIFIED | 97 lines; exports `CenterMultiSelect` + `CenterMultiSelectProps`; chip toggles, count badge, clear button; no server calls |
| `tests/CenterMultiSelect.test.tsx` | RTL coverage for multi-select behavior | VERIFIED | 7 tests covering toggle-add, toggle-remove, clear-to-empty, count indicator |
| `tests/fhirApi.test.ts` | Server-side authorized-center intersection regression | VERIFIED | Test at line 332: "QUAL-024 intersect: authorized-center intersection cannot be widened by client selection"; contains `intersect` keyword; passes |
| `src/pages/QualityPage.tsx` | Time-range state + timeScopedCases + QualityFilterBar | VERIFIED | `timeRange` useState, `timeScopedCases` useMemo with case-level inclusion, `QualityFilterBar showCenterFilter={false}` rendered above cohort row; `qualityPopulationLabel` paragraph always visible |
| `tests/QualityPage.test.tsx` | RTL proving denominator shrinks with '6m' | VERIFIED | 6 tests; two fixtures (recentCase: 2026-03-01, oldCase: 2020-01-01); tests fire '6m' button and assert population label reflects 1 case |
| `src/components/quality/QualityCaseDetail.tsx` | Flag-status control near top of case detail | VERIFIED | `data-testid="top-flag-status-controls"` block inside header card (lines 176-203), before patient data grid and values tab |
| `tests/QualityCaseDetail.test.tsx` | RTL DOM-order test for flag-status placement | VERIFIED | 6 tests including `compareDocumentPosition` check; all pass |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `QualityPage.tsx` | `CenterMultiSelect.tsx` | `QualityCaseList` → import + `selectedCenters` state | WIRED | `selectedCenters: string[]` at line 85; passed to `QualityCaseList` as prop; `QualityCaseList` renders `<CenterMultiSelect selected={selectedCenters} onChange={onSelectedCentersChange}` |
| `QualityPage.tsx filteredCases` | `timeScopedCases` multi-center guard | `selectedCenters.length > 0 && !selectedCenters.includes(c.centerName)` | WIRED | Line 206 of QualityPage.tsx |
| `QualityPage.tsx` | `qualityMetrics.cutoffDate` | `timeScopedCases` useMemo case-level inclusion | WIRED | Import at line 29; applied at line 147-150 |
| `QualityPage SummaryCard total` | `timeScopedCases.length` | Grundgesamtheit denominator | WIRED | Lines 335-337: all three status SummaryCards pass `total={timeScopedCases.length}` |
| `QualityCaseDetail header` | `onUpdateFlagStatus` callback | `data-testid="top-flag-status-controls"` select onChange | WIRED | Line 188-190: `onUpdateFlagStatus(f.caseId, f.flaggedAt, e.target.value)` |
| `/api/fhir/bundles` | `filterBundlesByCenters` | `req.auth.centers` from verified JWT — no client center input | WIRED | fhirApi.ts:396-404: `centers` from `req.auth!`, passed directly to `filterBundlesByCenters(allBundles, centers)` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `QualityPage SummaryCard` | `timeScopedCases.length` | `scopedCases` filtered by case-level cutoff | Yes — derived from DataContext `cases`, not hardcoded | FLOWING |
| `QualityPage filteredCases` | `selectedCenters` | Parent state, toggled by user via `CenterMultiSelect` | Yes — chip toggle writes real `string[]` | FLOWING |
| `QualityCaseDetail top flag select` | `f.status` | `caseFlags` prop from parent (qualityFlags store) | Yes — DataContext `qualityFlags` array | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Test suite (1032 tests) | `npm run test:ci` | 1032/1032 passed | PASS |
| Lint | `npm run lint` | 0 errors | PASS |
| CenterMultiSelect unit | `npx vitest run tests/CenterMultiSelect.test.tsx` (part of suite) | 7 passed | PASS |
| QUAL-024 intersect regression | `npx vitest run tests/fhirApi.test.ts` (part of suite) | QUAL-024 test passes | PASS |
| QualityPage denominator tests | `npx vitest run tests/QualityPage.test.tsx` (part of suite) | 6 passed | PASS |
| QualityCaseDetail DOM-order tests | `npx vitest run tests/QualityCaseDetail.test.tsx` (part of suite) | 6 passed | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| QUAL-022 | 41-02 | Grundgesamtheit denominator reflects active time-range filter | SATISFIED | `timeScopedCases` useMemo with case-level inclusion; `total={timeScopedCases.length}` on SummaryCards; RTL test proves denominator drops |
| QUAL-023 | 41-02 | Absolute counts clearly discoverable without hover | SATISFIED | `{count} / {total}` sublabel in SummaryCard; `qualityPopulationLabel` paragraph always visible; i18n keys for de+en added |
| QUAL-024 | 41-01 | Multi-center filter in quality (and later analysis); server restricts to authorized centers | SATISFIED | `CenterMultiSelect` shared component; `selectedCenters: string[]` in QualityPage; server QUAL-024 intersect regression test; `filterBundlesByCenters` remains sole authority |
| QUAL-025 | 41-03 | Approve/flag-status control reachable without scrolling past all patient data | SATISFIED | `data-testid="top-flag-status-controls"` block in header card before values tab; DOM-order RTL test passes |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX debt markers found in any phase-41 modified file | — | None |
| `QualityPage.tsx:338` | 338 | `SummaryCard` for excluded cases passes no `total` prop | Info | By design — excluded count has no meaningful denominator; percentage would be misleading |

---

### Human Verification Required

#### 1. Multi-center filter visual interaction

**Test:** Open `/quality` in the browser with multi-center fixture data loaded. Click two center chips in the filter panel.
**Expected:** Case list immediately narrows to only those two centers; the chip shows a count badge (e.g. "2"); clicking the "Clear" button restores all cases.
**Why human:** Client-side chip interaction and live list narrowing cannot be verified without a browser with real FHIR fixture data loaded.

#### 2. Time-range denominator live behavior

**Test:** Open `/quality`; switch time-range toggle to "Last 6 months"; observe the "Grundgesamtheit" label and SummaryCard "N / total" sublabels.
**Expected:** Population count drops from the total case count to only cases with observations in the last 6 months; all three status SummaryCards show reduced totals; switching back to "All time" restores the full count.
**Why human:** Date-sensitive denominator shrinkage requires runtime data with known observation dates close to today's date. The RTL tests use a fixed 2026-03-01 fixture; real clinic data may behave differently.

#### 3. Approve/flag control visible without scrolling

**Test:** Open `/quality`; select a case that has at least one quality flag; observe the case detail panel.
**Expected:** Per-flag status select dropdowns (open/acknowledged/resolved) are visible immediately in the case header section — reviewer does not need to scroll past the observations table to reach them. Changing a status updates the flag immediately.
**Why human:** Whether a control is reachable "without scrolling" depends on the actual viewport height and content length in a live browser. The RTL DOM-order test proves structural placement before the values tab, but cannot substitute for a visual scroll assessment.

---

### Gaps Summary

No gaps found. All 8 must-haves are verified in the codebase.

Three items are flagged for human verification because they require visual or browser-based confirmation (scroll behavior, live date-filtering, chip interaction). Automated tests cover the underlying logic for all three.

---

_Verified: 2026-05-26T00:05:00Z_
_Verifier: Claude (gsd-verifier)_
