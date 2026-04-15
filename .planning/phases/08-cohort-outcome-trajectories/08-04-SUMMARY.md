---
phase: 08
plan: 08-04
subsystem: i18n / navigation
tags: [i18n, outcomes, cohort-builder, navigation, test]
dependency_graph:
  requires: []
  provides:
    - outcomes* i18n bundle (71 keys, DE + EN)
    - CohortBuilderPage → OutcomesPage navigation entry points (D-02)
    - i18n completeness test (OUTCOME-12)
  affects:
    - src/i18n/translations.ts (TranslationKey union widens to include all outcomes* keys)
    - src/pages/CohortBuilderPage.tsx (header button + per-row button added)
tech_stack:
  added: []
  patterns:
    - Flat i18n key insertion with named export for test access
    - TDD: RED test written before GREEN implementation for Tasks 2 and 3
key_files:
  created:
    - tests/outcomesI18n.test.ts
    - tests/cohortBuilderEntryPoints.test.tsx
  modified:
    - src/i18n/translations.ts
    - src/pages/CohortBuilderPage.tsx
decisions:
  - "Per-row button color: text-violet-600 chosen to differentiate from blue Play (load-filter) action; violet is from secondary palette and not accent-blue reserved per UI-SPEC"
  - "Named export 'export { translations }' added to translations.ts to enable direct object access in completeness test without parsing AST"
  - "71 keys added vs plan estimate of ~55: UI-SPEC copywriting contract has additional keys (outcomesPanelSubtitle, outcomesSettingsScatterAdvisory, outcomesPreviewExportedStatus) that the plan estimate did not account for"
metrics:
  duration_minutes: ~15
  completed_date: "2026-04-15"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 2
---

# Phase 8 Plan 04: i18n Bundle + CohortBuilder Entry Points — Summary

Complete 71-key outcomes* i18n bundle (DE + EN) added to translations.ts, two OutcomesPage navigation entry points wired on CohortBuilderPage (D-02), and a 3-test i18n completeness suite (OUTCOME-12) that mechanically catches key drift.

## What Was Built

### Task 1: outcomes* i18n bundle (src/i18n/translations.ts)

71 new `outcomes*` keys added (plan estimated ~55; UI-SPEC copywriting contract includes additional keys not in plan estimate):

- **Page chrome** (7 keys): `outcomesTitle`, `outcomesTitleWithCohort`, `outcomesSubtitleSaved`, `outcomesSubtitleAdhoc`, `outcomesOpenSettings`, `outcomesCloseSettings`, `outcomesBackToCohort`
- **Entry points** (2 keys): `outcomesOpenForCohort`, `outcomesOpenForFilter`
- **Summary cards** (6 keys): `outcomesCardPatients`, `outcomesCardMeasurements`, `outcomesCardOdMeasurements`, `outcomesCardOsMeasurements`, `outcomesCardExcluded`, `outcomesCardExcludedTooltip`
- **Chart panels** (4 keys): `outcomesPanelOd`, `outcomesPanelOs`, `outcomesPanelCombined`, `outcomesPanelSubtitle`
- **Settings drawer** (14 keys): X-axis, Y-metric, display layers, grid slider, reset
- **Data preview** (16 keys): toggle open/close, caption, CSV export, column headers, eye labels, export status
- **Tooltips** (12 keys): patient, eye, day, treatment index, logMAR, Snellen, delta, median, IQR, clipped, sparse
- **Empty/loading/error** (8 keys): loading, empty cohort (title/body/action), no visus (title/body), panel empty, error

Named export `export { translations }` added alongside existing `export default translations` and `export function t(...)`. No existing exports modified.

**Key count deviation from plan:** 71 vs ~55 expected. The UI-SPEC copywriting contract includes `outcomesPanelSubtitle`, `outcomesSettingsScatterAdvisory`, and `outcomesPreviewExportedStatus` which are required per the spec but not counted in the plan's rough estimate. All strings are verbatim from UI-SPEC § Copywriting Contract.

### Task 2: i18n completeness test (tests/outcomesI18n.test.ts)

Three sub-tests, all passing:

1. **Non-empty check**: every `outcomes*` key has a truthy, non-empty `de` and `en` string (count asserts > 40 as floor)
2. **Placeholder parity**: `{token}` interpolation placeholders match between DE and EN for every key
3. **Source coverage**: walks `src/**/*.{ts,tsx}` by regex, collects all `t('outcomes*')` string literals, asserts all resolve to a defined key — catches any future typo or missing key before runtime

Test discovers keys by prefix regex, not a hardcoded list — adding/removing keys in translations.ts requires no test edits.

### Task 3: CohortBuilderPage entry points (src/pages/CohortBuilderPage.tsx)

Two entry points added per D-02:

**Header action** — "Outcomes für aktuellen Filter" / "Outcomes for current filter":
- `LineChart` icon from lucide-react (added to existing import block, alphabetically between `Filter` and `Play`)
- Blue button (`bg-blue-600 text-white`) in header right side, grouped with the Saved Searches toggle button via a new `<div className="flex items-center gap-2">` wrapper
- `disabled` when `filteredCases.length === 0` (button remains in DOM, just disabled)
- Navigates to `/outcomes?filter=<encodeURIComponent(JSON.stringify(filters))>`
- Uses `t('outcomesOpenForFilter')` for label and `title` attribute

**Per-row action** — "Outcomes anzeigen" / "View Outcomes":
- Icon-only `LineChart` button inserted *before* the existing Play button in each saved-search row's `<div className="flex gap-2">`
- Color: `text-violet-600 hover:bg-violet-50` — differentiates from blue Play (load-filter) and red Trash2 (delete)
- Navigates to `/outcomes?cohort=${encodeURIComponent(s.id)}`
- Uses `t('outcomesOpenForCohort')` for `title` and `aria-label`

**Color choice rationale:** `text-violet-600` chosen over `text-gray-600`. The three row actions (LineChart/Play/Trash2) need visual differentiation: violet = navigate to outcomes, blue = load into filter, red = delete. Using gray would make the outcomes action visually ambiguous against the play action. Violet is from the CHART_COLORS secondary palette (`#8b5cf6`) and is NOT the accent-blue reserved by UI-SPEC for CSV export and card numerals.

### New test file (tests/cohortBuilderEntryPoints.test.tsx)

3 tests:

1. Header button is `disabled` when `activeCases` is empty
2. Header button navigates to `/outcomes?filter=<encoded>` when cases are present
3. Per-row button (after opening the saved searches panel) navigates to `/outcomes?cohort=<savedSearchId>`

Uses `MemoryRouter` + `SpyLocation` pattern that captures the destination `Location` object via `useEffect`. Both module mocks (`useData`, `useLanguage`) avoid real network calls.

## Commits

| Hash | Message |
|------|---------|
| `36abb90` | feat(08-04): add 71 outcomes* i18n keys (DE + EN) per UI-SPEC |
| `49a00d6` | test(08-04): add outcomes* i18n completeness test (OUTCOME-12) |
| `f2ba109` | feat(08-04): add CohortBuilderPage entry points for OutcomesPage (D-02) |

## Verification Results

| Check | Result |
|-------|--------|
| TypeScript `--noEmit` | 0 errors |
| `tests/outcomesI18n.test.ts` | 3/3 passed |
| `tests/cohortBuilderEntryPoints.test.tsx` | 3/3 passed |
| `tests/components.test.tsx` (regression) | 7/7 passed (no regressions) |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

### Intentional Deviations

**1. 71 keys vs ~55 estimated**
- **Found during:** Task 1
- **Issue:** UI-SPEC copywriting contract has 3 more keys than the plan's rough count: `outcomesPanelSubtitle`, `outcomesSettingsScatterAdvisory`, `outcomesPreviewExportedStatus`
- **Fix:** Added all keys from the authoritative UI-SPEC — the plan explicitly says "UI-SPEC §Copywriting Contract is the authoritative source"
- **Impact:** i18n completeness test now expects > 40 keys (count = 71); no downstream breakage

**2. Named export for translations object**
- **Found during:** Task 2
- **Issue:** Plan correctly anticipated this might be needed: "If src/i18n/translations.ts doesn't export the raw object, add a minimal `export { translations }`"
- **Fix:** Added `export { translations }` — the translations object was `const` but not exported; needed for the completeness test's direct import
- **Files modified:** `src/i18n/translations.ts`

## Known Stubs

None. This plan is pure i18n + navigation wiring; no data-rendering components.

## Threat Flags

None. This plan adds no new network endpoints, auth paths, or data access patterns. The two navigation buttons use client-side `navigate()` only.

## Self-Check: PASSED

Files exist:
- `src/i18n/translations.ts` — FOUND (modified)
- `src/pages/CohortBuilderPage.tsx` — FOUND (modified)
- `tests/outcomesI18n.test.ts` — FOUND (created)
- `tests/cohortBuilderEntryPoints.test.tsx` — FOUND (created)
- `.planning/phases/08-cohort-outcome-trajectories/08-04-SUMMARY.md` — this file

Commits exist:
- `36abb90` — FOUND
- `49a00d6` — FOUND
- `f2ba109` — FOUND
