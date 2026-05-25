---
phase: 43-case-nav-clarity
verified: 2026-05-26T00:00:00Z
status: human_needed
score: 12/12
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Click a scatter point on the Visus trajectory panel (OD/OS/Combined) in the browser"
    expected: "Browser navigates to /case/:caseId for the correct patient; pointer cursor is visible on hover"
    why_human: "Recharts onClick wiring with real DOM interaction cannot be confirmed via RTL without a full E2E harness; visual cursor affordance is not assertable from unit tests"
  - test: "Enable the 'Show cohort reference' toggle on a case-detail page with a loaded cohort"
    expected: "Dashed median lines and IQR bands appear on the Visus and CRT chart aligned to case dates; disabling hides them"
    why_human: "Visual overlay rendering and date alignment require browser rendering of Recharts Area/Line SVG paths; not assertable statically"
  - test: "Confirm axis ticks render numerically on both Y-axes (CHART-01 A-06)"
    expected: "Both Visus (left) and CRT (right) Y-axes show at least 4 numeric tick labels"
    why_human: "tickCount=5 sets the intent but actual Recharts tick rendering at a fixed 300px height requires a live browser viewport; user screenshot of the original A-06 bug was the trigger — resolution must be confirmed visually"
  - test: "Open the Trajectories view and check the responder tab"
    expected: "The '(i)' info affordance appears adjacent to the responder section heading inside the chart card (inside data-testid=responder-view), distinct from the tab-strip affordance"
    why_human: "Spatial adjacency to the plot heading is a visual/layout concern; DOM presence is unit-tested but layout position requires browser rendering"
---

# Phase 43: case-nav-clarity Verification Report

**Phase Goal:** Users can drill into a case from a trajectory chart, compare a single case against cohort reference values, and read chart labels without ambiguity.
**Verified:** 2026-05-26
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CRT legend chip reads a self-explanatory label sourced from i18n (not a hardcoded literal) | VERIFIED | `VisusCrtChart.tsx` line 222: `name={t('crtLegendLabel')}`; translations.ts line 651: `crtLegendLabel: { de: 'CRT (µm)', en: 'CRT (µm)' }` |
| 2 | Visus Y-axis label reads 'Visus (Dezimal, bestkorrigiert)' (DE) / 'Visual acuity (decimal, best-corrected)' (EN) from i18n | VERIFIED | `VisusCrtChart.tsx` line 83: `label={{ value: t('visusYAxisLabel'), ... }}`; translations.ts line 652 with exact locked DE+EN wording |
| 3 | Interpolation hint reads 'Offener Kreis = interpolierter Wert (keine Messung)' (DE) from i18n | VERIFIED | `VisusCrtChart.tsx` line 61: `{t('interpolatedHint')}`; translations.ts line 650 with updated locked wording |
| 4 | Both Visus and CRT Y-axes render numeric tick labels (tickCount set) | VERIFIED | `VisusCrtChart.tsx` lines 80+88: `tickCount={5}` on both YAxis elements; Visus `allowDecimals`, CRT `allowDecimals={false}` — visual confirmation deferred (human_verification #3) |
| 5 | Responder '(i)' info affordance appears adjacent to the responder plot | VERIFIED | `ResponderView.tsx` lines 241-245: `<span title={t('metricsResponderTooltip')} aria-label={...}>&#x2139;</span>` inside `data-testid="responder-view"`; test asserts inside container; visual layout deferred (human_verification #4) |
| 6 | Trajectory scatter points are clickable and navigate to case detail (/case/:caseId) | VERIFIED | `OutcomesPanel.tsx` lines 289-296: `cursor='pointer'` and `onClick` wired when `onPointClick` provided; `OutcomesView.tsx` lines 163-172: `handlePointDrillDown` calls `navigate('/case/${found.id}')`; visual E2E deferred (human_verification #1) |
| 7 | Drill-down is IDOR-gated: resolves pseudonym only within loaded cohort.cases; unknown pseudonyms do not navigate | VERIFIED | `OutcomesView.tsx` line 166: `cohort.cases.find(c => c.pseudonym === patientId)` — navigation gated on `found`; test `OutcomesPanelDrillDown.test.tsx` asserts no-navigate for unknown PSN and empty cohort |
| 8 | Cross-cohort mode excluded from drill-down | VERIFIED | `OutcomesView.tsx` all 6 OutcomesPanel instances: `onPointClick={!isCrossMode ? handlePointDrillDown : undefined}` |
| 9 | Cohort reference overlay (median + IQR band) renders on case Visus/CRT chart when toggled on | VERIFIED | `VisusCrtChart.tsx` lines 127-200: Area pairs + Line elements for visusMedian/crtMedian, gated by `hasReference`; toggle default false per FALL-011 |
| 10 | Cohort reference is user-controllable toggle (off by default) | VERIFIED | `CaseDetailPage.tsx` line 41: `useState(false)`; checkbox at lines 140-144 wired to `setShowCohortReference` with `t('cohortReferenceToggle')` aria-label |
| 11 | Reference values use existing aggregate logic (no new clinical metric) | VERIFIED | `useCaseData.ts` lines 287-343: nearest-rank percentile over `getObservationsByCode(c.observations, LOINC_VISUS/LOINC_CRT)` — same code paths used by `cohortAvgVisus`/`cohortAvgCrt`; no new LOINC codes |
| 12 | When cohort has no comparable data on a date, chart renders without crash | VERIFIED | `useCaseData.ts` line 323: `if (!hasVisus && !hasCrt) return null` + `.filter(p => p !== null)`; test asserts no crash with empty cohortReference prop |

**Score:** 12/12 truths verified (4 items require browser confirmation for visual/layout aspects)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/case-detail/VisusCrtChart.tsx` | i18n-driven CRT/Visus/interpolation labels + explicit Y-axis ticks + showCohortReference prop | VERIFIED | Contains `t('visusYAxisLabel')`, `t('crtLegendLabel')`, `t('interpolatedHint')`, `tickCount={5}` on both axes, `showCohortReference`/`cohortReference` props with overlay rendering |
| `src/components/outcomes/ResponderView.tsx` | Info affordance adjacent to responder plot | VERIFIED | `data-testid="responder-view"` wraps span with `title/aria-label={t('metricsResponderTooltip')}` and `&#x2139;` content |
| `src/i18n/translations.ts` | DE+EN keys for CRT legend, Visus axis, interpolation, drill-down hint, cohort reference | VERIFIED | Lines 650-652: `interpolatedHint`, `crtLegendLabel`, `visusYAxisLabel`; line 795: `outcomesDrillDownHint`; lines 1025-1027: `cohortReferenceToggle`, `cohortReferenceMedian`, `cohortReferenceBand` |
| `src/components/outcomes/OutcomesPanel.tsx` | Clickable scatter points with `onPointClick` prop + pointer cursor | VERIFIED | Lines 52-53: `onPointClick?: (patientId: string) => void`; lines 289-297: spread `cursor='pointer'` + `onClick` handler when prop provided; cross-mode excluded |
| `src/components/outcomes/OutcomesView.tsx` | pseudonym→case-id resolution + navigate('/case/:id') | VERIFIED | Lines 163-172: `handlePointDrillDown` with `cohort.cases.find(c => c.pseudonym === patientId)` IDOR gate + `navigate('/case/${found.id}')` |
| `src/hooks/useCaseData.ts` | `cohortReference: CohortReferencePoint[]` returned | VERIFIED | Lines 287-343: memoized `cohortReference` with per-date median/p25/p75 for both Visus and CRT; exported type `CohortReferencePoint` at lines 17-25 |
| `src/pages/CaseDetailPage.tsx` | Toggle state + wiring showCohortReference to VisusCrtChart | VERIFIED | Line 41: `useState(false)`; line 49: destructures `cohortReference` from `useCaseData`; lines 140-157: checkbox control + props passed to VisusCrtChart |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `VisusCrtChart.tsx` | `translations.ts` | `t('crtLegendLabel')` / `t('visusYAxisLabel')` / `t('interpolatedHint')` | WIRED | All three calls present in VisusCrtChart.tsx lines 61, 83, 222 |
| `OutcomesPanel.tsx` | `OutcomesView.tsx` | `onPointClick(patientId)` prop callback | WIRED | OutcomesView passes `handlePointDrillDown`; OutcomesPanel invokes `onPointClick(datum.patientId)` |
| `OutcomesView.tsx` | `/case/:caseId route` | `navigate` after pseudonym resolution within `cohort.cases` | WIRED | `navigate('/case/${found.id}')` line 168; route guarded by `cases.find()` |
| `CaseDetailPage.tsx` | `VisusCrtChart.tsx` | `showCohortReference` state + `cohortReference` data props | WIRED | Lines 156-157: both props passed; default false prevents visual clutter |
| `VisusCrtChart.tsx` | `useCaseData.ts cohortReference` | `cohortReference` series merged onto chart | WIRED | `CohortReferencePoint` type imported from `useCaseData`; `cohortReference` prop flows from CaseDetailPage |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `VisusCrtChart.tsx` | `cohortReference` | `useCaseData.ts` → nearest-rank percentile over `cases` array from DataContext | Yes — computed from live `getObservationsByCode` calls over server-loaded cases | FLOWING |
| `OutcomesView.tsx` | `handlePointDrillDown` | `cohort.cases` from `applyFilters(activeCases, ...)` | Yes — real authorized case list; `find()` against live pseudonyms | FLOWING |
| `useCaseData.ts` | `cohortReference` | `cases` prop (full cohort from CaseDetailPage) + `getObservationsByCode` | Yes — iterates all cohort cases, buckets by calendar date, computes percentiles | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Test suite green (1086 baseline per plan-03 summary) | `npm run test:ci` | 1086/1086 passed, 99 test files | PASS |
| Zero lint errors | `npm run lint` | No ESLint errors or warnings | PASS |
| New phase-43 test files exist and pass | `npx vitest run tests/VisusCrtChartLabels.test.tsx tests/ResponderTooltipPlacement.test.tsx tests/OutcomesPanelDrillDown.test.tsx tests/VisusCrtChartReference.test.tsx` | All 4 files present; subsumed in 1086 total | PASS |

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` probes defined for this phase; no migration/CLI phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FALL-010 | 43-02 | Drill from a chart data point to the corresponding case detail | SATISFIED | `OutcomesPanel.tsx` `onPointClick` + `OutcomesView.tsx` `handlePointDrillDown` wired; IDOR gate verified |
| FALL-011 | 43-03 | Case view shows cohort reference values for comparison | SATISFIED | `useCaseData.ts` `cohortReference` + `VisusCrtChart.tsx` overlay + `CaseDetailPage.tsx` toggle all implemented |
| FALL-012 | 43-01 | Case-detail chart labels self-explanatory (CRT legend, Visus axis, interpolation wording) | SATISFIED | All three labels sourced from i18n with locked DE+EN wording |
| CHART-01 | 43-01 | Axis ticks rendered (tickCount); responder '(i)' tooltip adjacent to plot | SATISFIED | `tickCount={5}` on both YAxes; `ResponderView.tsx` info affordance inside `data-testid="responder-view"` |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/i18n/translations.ts` | 62-63, 73, 107, 157 | `placeholder` / `not yet implemented` | Info | Pre-existing keys (`loginUsernamePlaceholder`, Keycloak SSO note); none in Phase 43 modified lines; no blockers |

No TBD, FIXME, or XXX markers found in any Phase 43 modified file.

### Human Verification Required

#### 1. Scatter point drill-down (FALL-010 visual + E2E)

**Test:** In a loaded cohort trajectory view (single-cohort mode), hover over a scatter point on any OD/OS/Combined Visus or CRT panel.
**Expected:** Pointer cursor visible on hover; clicking navigates to `/case/<id>` for the correct patient; CaseDetailPage loads with that patient's data.
**Why human:** Recharts `onClick` on SVG `<circle>` elements requires real DOM events and routing. Unit tests verify the handler logic; actual Recharts event dispatch and browser navigation require a live session.

#### 2. Cohort reference overlay visual (FALL-011 visual)

**Test:** On a CaseDetailPage with a cohort of 3+ patients, check the "Show cohort reference" checkbox.
**Expected:** Dashed green median line and light-green IQR band appear on the Visus chart; dashed violet median line and light-violet IQR band appear on the CRT chart; both align to the dates on the X-axis. Unchecking removes them.
**Why human:** SVG Area/Line rendering with opacity bands and date alignment requires browser Recharts rendering at a real viewport size.

#### 3. Axis tick rendering (CHART-01 A-06)

**Test:** Open a case-detail page or trajectories view and examine both Y-axes on the Visus/CRT chart.
**Expected:** Both the Visus (left, green) and CRT (right, violet) Y-axes display at least 4 numeric tick labels. This was the original A-06 regression.
**Why human:** `tickCount={5}` is the implementation; whether Recharts actually renders all 5 ticks at a 300px height is layout-dependent and cannot be verified from unit tests.

#### 4. Responder info affordance position (CHART-01 ANL-002 layout)

**Test:** Switch to the Responder metric tab in the Trajectories view.
**Expected:** A '(i)' icon appears immediately adjacent to the "Responder Classification" heading inside the chart card — not only in the metric tab strip at the top.
**Why human:** The DOM presence of the affordance inside `data-testid="responder-view"` is unit-tested. Visual proximity to the heading and absence of layout displacement need browser confirmation.

### Gaps Summary

No blocking gaps. All 12 must-have truths are VERIFIED by code inspection and test evidence. The 4 human verification items address visual rendering, SVG layout, and browser interaction concerns that are acceptable to defer to Phase 45 UAT (already logged in v1.12-deferred-questions.md Q-43 per the plan's verification notes).

---

_Verified: 2026-05-26_
_Verifier: Claude (gsd-verifier)_
