---
phase: 09-outcomes-page-ui
reviewed_at: 2026-04-15T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/pages/OutcomesPage.tsx
  - src/components/outcomes/OutcomesEmptyState.tsx
  - src/components/outcomes/OutcomesSummaryCards.tsx
  - src/components/outcomes/OutcomesPanel.tsx
  - src/components/outcomes/OutcomesTooltip.tsx
  - src/components/outcomes/OutcomesSettingsDrawer.tsx
  - src/components/outcomes/OutcomesDataPreview.tsx
  - src/App.tsx
status: issues_found
blockers: 0
warnings: 3
info: 2
---

# Phase 9: Code Review Report

**Reviewed:** 2026-04-15  
**Depth:** standard  
**Files Reviewed:** 8  
**Status:** issues_found — 0 blockers, 3 warnings, 2 info

## Summary

All seven outcome components are well-structured and follow project conventions. No security vulnerabilities, no hardcoded secrets, no `dangerouslySetInnerHTML`, no `as any`. The locked decisions (baseLine coordinate-array, flattenToRows inline, no second `computeCohortTrajectory` call) are correctly implemented and confirmed by grep. Three warnings concern a rules-of-hooks violation, a missing `aria-expanded` on the settings-drawer trigger, and a `Scatter` missing `isAnimationActive={false}`. Two info items flag minor issues.

---

## Warnings

| # | File:Line | Severity | Issue | Fix |
|---|-----------|----------|-------|-----|
| WR-01 | `src/pages/OutcomesPage.tsx:101-112` | Warning | `useMemo` called after an early-return (`if (!cohort \|\| cohort.cases.length === 0)` at line 96). This violates the Rules of Hooks — hooks must not be called conditionally. ESLint suppresses the warning with `// eslint-disable-line react-hooks/rules-of-hooks` but the bug is real: if React ever renders with `cohort` falsy on a re-render where it was previously truthy, hook call order changes. | Hoist the `aggregate` memo above the early-return guards, or restructure to a child component that only renders when `cohort` is non-null. Pattern already used correctly in AnalysisPage. |
| WR-02 | `src/pages/OutcomesPage.tsx:139-147` | Warning | The settings-gear `<button>` that toggles the drawer lacks `aria-expanded` and `aria-controls="outcomes-settings-drawer"`. The drawer `<aside>` has `id="outcomes-settings-drawer"` (OutcomesSettingsDrawer.tsx:71), so the pairing is available but not wired. Screen-reader users cannot discover the open/closed state. | Add `aria-expanded={drawerOpen}` and `aria-controls="outcomes-settings-drawer"` to the gear button. |
| WR-03 | `src/components/outcomes/OutcomesPanel.tsx:167-173` | Warning | The `<Scatter>` element does not pass `isAnimationActive={false}`. The three `<Line>` and one `<Area>` elements all suppress animation correctly (lines 146, 163, 183), but Scatter is omitted, causing a visible animation flash on each settings change and failing any animation-disabled test assertions. | Add `isAnimationActive={false}` to the `<Scatter>` element. |

---

## Info

| # | File:Line | Severity | Issue | Fix |
|---|-----------|----------|-------|-----|
| IN-01 | `src/pages/OutcomesPage.tsx:86-94` | Info | Audit beacon (fire-and-forget `fetch`) appends the raw `filter` query-string value to the URL: `params.set('filter', fp)`. If the filter param contains a large or malformed JSON blob the beacon URL can be very long; some proxies/log aggregators truncate at 2 KB. The value is already URL-encoded by the browser but the server-side audit log may record it verbatim. | Consider sending only a stable hash (e.g., `filter_hash`) or omitting the filter payload from the beacon entirely, consistent with the security-first posture documented in `feedback_security_first.md`. |
| IN-02 | `src/components/outcomes/OutcomesDataPreview.tsx:236-237` | Info | Table row `key` uses index `i` as a tiebreaker: `key={\`${r.patient_pseudonym}-${r.eye}-${r.observation_date}-${i}\`}`. If the same patient has two observations on the same date for the same eye (data-quality edge case), the first three segments collide and React falls back silently to index ordering. | Include `r.treatment_index` in the key to make it more unique: `key={\`${r.patient_pseudonym}-${r.eye}-${r.observation_date}-${r.treatment_index}\`}`. Remove `i` from the closure parameter to keep the map clean. |

---

## Dimension Checklist

| Dimension | Grep / Check | Result |
|-----------|-------------|--------|
| Correctness — null guard on `cohort.cases.length` | Line 96 guards before render | Pass |
| Correctness — `aggregate` null path | `aggregate` always assigned (memoized post-guard) — but see WR-01 hooks violation | Warning |
| Correctness — useEffect dep arrays | Audit beacon `[]` is intentional + suppressed; cohort effect `[cohort]` is correct | Pass |
| Security — `dangerouslySetInnerHTML` | 0 hits across all 7 component files | Pass |
| Security — URL PII leakage | Filter blob forwarded to audit endpoint verbatim — see IN-01 | Info |
| Security — `JSON.parse` without try/catch | Line 71 wrapped in `try { … } catch { return null; }` | Pass |
| Accessibility — `aria-label` on interactive elements | Present on gear button, close button, all radios, checkboxes, export button | Pass |
| Accessibility — `aria-expanded` / `aria-controls` on drawer trigger | Missing — see WR-02 | Warning |
| Accessibility — Escape key handler | `OutcomesSettingsDrawer.tsx:44-49` — `window.addEventListener('keydown', …)` | Pass |
| Performance — `isAnimationActive={false}` | Lines 146, 163, 183 present; Scatter at line 167 missing — see WR-03 | Warning |
| Performance — `useMemo` key completeness | `[cohort, axisMode, yMetric, gridPoints, spreadMode]` covers all 5 inputs (D-26) | Pass |
| Type safety — `as any` / `: any` | 0 hits in all component files | Pass |
| i18n — hardcoded user-visible strings | All user-facing text routed through `t(…)`; no raw German/English sentence literals | Pass |
| Locked decision — `baseLine` coordinate-array | `OutcomesPanel.tsx:142` — `baseLine={iqrBaseLine}` (array, not dataKey string) | Pass |
| Locked decision — no second `computeCohortTrajectory` | `OutcomesDataPreview.tsx` — comment only (line 6), zero code calls | Pass |

---

_Reviewed: 2026-04-15_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
