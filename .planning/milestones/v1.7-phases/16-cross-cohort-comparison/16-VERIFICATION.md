---
phase: 16-cross-cohort-comparison
verified: 2026-04-21T14:17:00Z
status: human_needed
score: 12/12 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Load the app with ?cohort=<id>&cohorts=<id1>,<id2> in the URL, then verify the three outcome panels render both cohort medians overlaid using distinct COHORT_PALETTES colors"
    expected: "All 3 panels (OD, OS, OD+OS) display 2 median lines in emerald and amber; individual per-patient curves are absent; legend chips show 'Cohort A (N=X patients)' and 'Cohort B (N=Y patients)'"
    why_human: "Recharts canvas rendering is not exercised by jsdom; cannot verify that medians are visually distinct, readable, or drawn above per-patient curves"
  - test: "Select 4 cohorts via the CohortCompareDrawer, then attempt to select a 5th"
    expected: "5th checkbox is disabled; URL shows ?cohorts= with exactly 4 ids"
    why_human: "Max-4 enforcement is unit-tested but the full URL-update path with real browser URL parsing has not been exercised in an E2E environment"
  - test: "Copy the ?cohorts= URL, open in a new tab, and verify state restores without any interaction"
    expected: "Cross-cohort overlay with same cohorts appears immediately on page load"
    why_human: "XCOHORT-04 deep-link behaviour is covered by automated routing tests using MemoryRouter; real browser URL parsing and hydration need human confirmation"
  - test: "Open OutcomesSettingsDrawer while in cross-cohort mode"
    expected: "The 'Per-patient lines' checkbox row is hidden; the suppressed-note text is visible in its place; Median/Scatter/IQR Band checkboxes remain"
    why_human: "The conditional render is unit-tested but visual layout and the exact suppressed-note text need human review"
  - test: "Click 'Reset to single cohort' in the CohortCompareDrawer footer"
    expected: "?cohorts= parameter is removed from URL; chart reverts to single-cohort spaghetti plot with per-patient lines in gray (#9ca3af) at reduced opacity"
    why_human: "VIS-04 visual hierarchy (individual curves subordinate to median) requires perceptual confirmation that gray per-patient lines read as subordinate to the colored median"
---

# Phase 16: Cross-Cohort Comparison — Verification Report

**Phase Goal:** A researcher can overlay up to 4 saved cohorts on a single trajectory chart to compare outcome trends side by side; individual patient curves are visually subordinate to cohort medians
**Verified:** 2026-04-21T14:17:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Requirement ID Coverage Note

The plan frontmatter references requirement IDs XCOHORT-01, XCOHORT-02, XCOHORT-03, XCOHORT-04, and VIS-04. Cross-referencing against `.planning/milestones/`:

- **XCOHORT-01** and **XCOHORT-02** appear in `v1.6-REQUIREMENTS.md` under "Future Requirements (post-v1.6)".
- **XCOHORT-03**, **XCOHORT-04**, and **VIS-04** do not appear in any milestone requirements file. These IDs were introduced in the Phase 16 planning documents (CONTEXT.md, UI-SPEC.md) as sub-requirements decomposed from XCOHORT-01/02. They are verified by the plans' own must-haves.

All five IDs are traced to specific must-haves below.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | COHORT_PALETTES exports 4 hex colors, each WCAG 3:1 vs #ffffff, none overlapping EYE_COLORS | ✓ VERIFIED | `palette.ts:41-46` exports `['#047857','#b45309','#0e7490','#a21caf']`; contrast test suite (19 passing assertions) |
| 2 | SERIES_STYLES.perPatient has color '#9ca3af', opacityDense 0.22, opacitySparse 0.12 | ✓ VERIFIED | `palette.ts:28` — exact values present |
| 3 | SERIES_STYLES.median.strokeWidth equals 4 | ✓ VERIFIED | `palette.ts:27` |
| 4 | All 7 outcomesCompare* / outcomesCrossMode i18n keys exist with both de and en values | ✓ VERIFIED | `translations.ts:809-839` — all 7 keys found; i18n test suite passes (6 assertions) |
| 5 | tests/cohortCompareDrawer.test.tsx is active (not skipped) and passes 5 tests | ✓ VERIFIED | `describe.skip` removed; import live; 5/5 passing |
| 6 | When OutcomesPanel receives cohortSeries, it renders one median Line + one IQR Area per entry using that entry's color | ✓ VERIFIED | `OutcomesPanel.tsx:265-300`; OutcomesPanel test "XCOHORT-02: renders one median Line per cohortSeries entry" passes |
| 7 | When OutcomesPanel receives cohortSeries, per-patient Lines are suppressed regardless of layers.perPatient | ✓ VERIFIED | `OutcomesPanel.tsx:213` guard `!isCrossMode && layers.perPatient`; test "per-patient lines are suppressed in cross-cohort mode" passes |
| 8 | Each per-cohort median Line name prop follows '{cohortName} (N={patientCount} patients)' format | ✓ VERIFIED | `OutcomesPanel.tsx:294`; test "XCOHORT-03: median Line name prop" passes |
| 9 | CohortCompareDrawer: primary cohort checkbox always checked+disabled; max 4 enforced; Escape calls onClose | ✓ VERIFIED | `CohortCompareDrawer.tsx:31,37,80-90`; 5 drawer tests pass |
| 10 | ?cohorts= URL param enters cross-cohort mode; crossCohortAggregates computed; cohortSeries threaded to all 6 panels | ✓ VERIFIED | `OutcomesView.tsx:86-98,319-345,477-559`; XCOHORT-04 routing tests (3) pass |
| 11 | URL parsing caps cohort count at 4; unknown ids silently dropped | ✓ VERIFIED | `OutcomesView.tsx:94,98`; routing test "caps at 4 cohorts" and "unknown ids dropped" pass |
| 12 | OutcomesSettingsDrawer hides perPatient checkbox in cross-cohort mode; shows suppressed-note | ✓ VERIFIED | `OutcomesSettingsDrawer.tsx:180,195-198`; `isCrossMode` prop wired from OutcomesView |

**Score:** 12/12 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/outcomes/palette.ts` | COHORT_PALETTES + updated SERIES_STYLES | ✓ VERIFIED | Lines 26-46; substantive (65 LOC with logic); imported by OutcomesPanel and OutcomesView |
| `src/i18n/translations.ts` | 7 new i18n keys | ✓ VERIFIED | Lines 809-839; used by CohortCompareDrawer and OutcomesView subtitle |
| `tests/outcomesPalette.contrast.test.ts` | WCAG assertions for COHORT_PALETTES | ✓ VERIFIED | Active, passes 19 assertions |
| `tests/cohortCompareDrawer.test.tsx` | Active XCOHORT-01/03 tests | ✓ VERIFIED | 5 passing tests; `describe.skip` removed; real import |
| `src/components/outcomes/OutcomesPanel.tsx` | cohortSeries prop + VIS-04 per-patient | ✓ VERIFIED | Lines 25-300; `CohortSeriesEntry` exported; all guards present |
| `tests/OutcomesPanel.test.tsx` | Cross-cohort + VIS-04 assertions | ✓ VERIFIED | 6 new tests (XCOHORT-02 x3, XCOHORT-03, VIS-04 x2); 13 total pass |
| `src/components/outcomes/CohortCompareDrawer.tsx` | Slide-over drawer for cohort selection | ✓ VERIFIED | `CohortCompareDrawerProps` + `CohortCompareDrawer` exported; 97 LOC; all props contract fields present |
| `src/components/outcomes/OutcomesView.tsx` | Cross-cohort mode integration | ✓ VERIFIED | GitCompare button, crossCohortAggregates memo, CohortCompareDrawer mount, cohortSeries threading (6 panels) |
| `src/components/outcomes/OutcomesSettingsDrawer.tsx` | isCrossMode + perPatient suppression | ✓ VERIFIED | Lines 30,61,180,195-198 |
| `tests/OutcomesViewRouting.test.tsx` | XCOHORT-04 deep-link tests | ✓ VERIFIED | 3 new tests in `describe('OutcomesView — cross-cohort routing (Phase 16)')` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `OutcomesPanel.tsx` | `palette.ts` | `import { SERIES_STYLES }` + `SERIES_STYLES.perPatient.color` | ✓ WIRED | Line 226 uses `SERIES_STYLES.perPatient.color` for per-patient stroke |
| `OutcomesView.tsx` | `CohortCompareDrawer.tsx` | import + render when `compareOpen` | ✓ WIRED | Lines 40, 695-704 |
| `OutcomesView.tsx` | `OutcomesPanel.tsx` | `cohortSeries=` prop on all 6 panels | ✓ WIRED | Lines 477, 489, 501, 533, 546, 559 |
| URL `?cohorts=` | `crossCohortAggregates` memo | `searchParams.get('cohorts').split(',').filter(Boolean).slice(0,4)` | ✓ WIRED | Lines 86-98, 319-345 |
| `CohortCompareDrawer.tsx` | `translations.ts` | `t('outcomesCompareDrawerTitle')` etc. | ✓ WIRED | Lines 50,56,72,84,95 |
| `OutcomesView.tsx` | `OutcomesSettingsDrawer.tsx` | `isCrossMode={isCrossMode}` prop | ✓ WIRED | Line 691 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `OutcomesPanel.tsx` | `cohortSeries` | `crossCohortAggregates` memo in OutcomesView → `computeCohortTrajectory`/`computeCrtTrajectory` on `activeCases` | Yes — uses real `applyFilters(activeCases, saved.filters)` per cohort | ✓ FLOWING |
| `CohortCompareDrawer.tsx` | `patientCounts`, `savedSearches` | `patientCounts` memo in OutcomesView → `applyFilters(activeCases, s.filters).length` per saved search | Yes — live count from activeCases | ✓ FLOWING |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| XCOHORT-01 (overlay 2+ cohort medians, distinct palettes) | Plans 01, 03, 04 | User selects up to 4 cohorts; overlay renders on single chart | ✓ SATISFIED | CohortCompareDrawer (max-4 enforced), cohortSeries prop, OutcomesView wiring, 3 XCOHORT-04 routing tests |
| XCOHORT-02 (per-cohort color legend and toggle) | Plans 01, 02, 04 | Each cohort median rendered in a distinct COHORT_PALETTES color; legend chips auto-generated via Recharts `name` prop | ✓ SATISFIED | COHORT_PALETTES assigned by index in `crossCohortAggregates` memo; IQR Areas carry `legendType="none"` to suppress extra legend entries |
| XCOHORT-03 (cohort label includes patient count) | Plans 02, 03 | Legend entry and drawer label show "Cohort Name (N=X patients)" | ✓ SATISFIED | `OutcomesPanel.tsx:294`; `CohortCompareDrawer.tsx:83-84`; drawer test "XCOHORT-03: displays patient count" passes |
| XCOHORT-04 (URL ?cohorts= deep-link restores state) | Plan 04 | Loading app with ?cohorts= URL enters cross-cohort mode without interaction | ✓ SATISFIED | `OutcomesViewRouting.test.tsx:374-430`; 3 XCOHORT-04 tests pass (enters mode, caps at 4, drops unknown) |
| VIS-04 (spaghetti-plot hierarchy: per-patient subordinate to median) | Plans 01, 02 | Per-patient stroke #9ca3af, opacities 0.22/0.12; median strokeWidth 4 | ✓ SATISFIED | `palette.ts:27-28`; `OutcomesPanel.tsx:226`; VIS-04 tests in OutcomesPanel.test.tsx pass |

---

### Anti-Patterns Found

| File | Finding | Severity | Assessment |
|------|---------|----------|------------|
| `src/i18n/translations.ts:63` | `loginDemoHint` key contains literal passwords (`admin2025!`, `forscher2025!`) and OTP (`123456`) in the production bundle | ⚠️ Warning | Pre-existing issue — not introduced by Phase 16. Documented as CR-01 in `16-REVIEW.md`. Not a Phase 16 gap. |
| `src/components/outcomes/OutcomesView.tsx:88` | `isCrossMode = Boolean(rawCohortsParam)` stays `true` even when all `?cohorts=` IDs are unknown (filtered to empty) | ⚠️ Warning | Causes subtitle to render "0 cohorts compared" with empty names string. Documented as WR-02 in `16-REVIEW.md`. Edge case affecting users who share a URL with since-deleted cohort IDs. |
| `src/components/outcomes/OutcomesPanel.tsx:294` | Legend name hardcodes English "patients" rather than using `t('outcomesCardPatients')` | ℹ️ Info | German locale displays "patients" untranslated. Documented as IN-01 in `16-REVIEW.md`. |
| `src/components/outcomes/CohortCompareDrawer.tsx:72` | Close button `aria-label` duplicates the drawer heading label | ⚠️ Warning | WCAG 4.1.2 violation — screen reader presents two consecutive elements with identical "Compare Cohorts" name. Documented as WR-01 in `16-REVIEW.md`. |

**Blocker anti-patterns:** None — the WR-02 isCrossMode edge case, WR-01 accessibility issue, and IN-01 i18n gap do not prevent the primary researcher workflow.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Palette contrast tests | `npx vitest run tests/outcomesPalette.contrast.test.ts` | 19 passed | ✓ PASS |
| i18n completeness | `npx vitest run tests/outcomesI18n.test.ts` | Included in 24 passed | ✓ PASS |
| Drawer tests (XCOHORT-01, XCOHORT-03) | `npx vitest run tests/cohortCompareDrawer.test.tsx` | 5 passed | ✓ PASS |
| OutcomesPanel cross-cohort + VIS-04 | `npx vitest run tests/OutcomesPanel.test.tsx tests/outcomesIqrSparse.test.tsx` | 13 passed | ✓ PASS |
| XCOHORT-04 routing tests | `npx vitest run tests/OutcomesViewRouting.test.tsx` | 7 passed | ✓ PASS |
| TypeScript | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Full suite | `npx vitest run` | 451 passed, 2 pre-existing failures | ✓ PASS (pre-existing failures are `outcomesPanelCrt.test.tsx` y-domain expectation and `metricSelector.test.ts` parse error — both documented in Plan 04 SUMMARY as out-of-scope) |

---

### Human Verification Required

#### 1. 4-Cohort Overlay Readability

**Test:** Start the dev server. Navigate to `/analysis` with `?cohort=<savedId>&cohorts=<id1>,<id2>,<id3>,<id4>` using 4 real saved cohort IDs. Observe all 3 trajectory panels (OD, OS, OD+OS).
**Expected:** Each of the 4 cohorts is drawn in a distinct COHORT_PALETTES color (emerald, amber, cyan, fuchsia); no per-patient spaghetti lines are visible; each panel legend shows 4 chips with "(N=X patients)" format.
**Why human:** Recharts canvas is not rendered in jsdom. Color distinction, absence of per-patient noise, and legend readability require visual inspection.

#### 2. Single-Cohort VIS-04 Hierarchy

**Test:** Navigate to `/analysis` with a single `?cohort=<id>`. Enable per-patient layer in Settings. Observe the chart.
**Expected:** Individual patient curves are rendered in light gray (`#9ca3af`) at visibly low opacity; the colored median line is clearly dominant.
**Why human:** Perceptual hierarchy ("visually subordinate") is the core goal stated in the phase description. Unit tests verify the correct stroke value but cannot verify that gray at 0.22 opacity actually reads as subordinate to the colored median.

#### 3. Reset Flow

**Test:** While in cross-cohort mode (?cohorts= URL active), open CohortCompareDrawer and click "Reset to single cohort".
**Expected:** Drawer closes; URL changes to `?cohort=<primaryId>` with ?cohorts= removed; chart reverts to single-cohort view with per-patient lines visible.
**Why human:** The end-to-end URL manipulation and drawer-close sequence involves real browser navigation that is not covered by jsdom routing tests.

#### 4. Settings Drawer perPatient Suppression

**Test:** While in cross-cohort mode, open the settings gear drawer.
**Expected:** The "Per-patient lines" checkbox row is absent; in its place appears the suppressed-note: "Per-patient lines are suppressed in comparison mode." (EN) or "Einzelkurven sind im Vergleichsmodus ausgeblendet." (DE).
**Why human:** The `data-testid="perpatient-suppressed-note"` element existence is verified by code inspection but the full drawer layout needs human confirmation for usability.

---

### Gaps Summary

No automated gaps. All 12 must-haves are satisfied by the implementation. The three review findings (WR-02 stale-URL edge case, WR-01 accessibility, IN-01 i18n) are code quality issues documented in the phase code review but do not prevent the researcher workflow. Human verification is required before marking the phase as fully passed because the primary deliverable ("individual patient curves are visually subordinate to cohort medians") is an observable UI behavior that cannot be confirmed programmatically.

---

_Verified: 2026-04-21T14:17:00Z_
_Verifier: Claude (gsd-verifier)_
