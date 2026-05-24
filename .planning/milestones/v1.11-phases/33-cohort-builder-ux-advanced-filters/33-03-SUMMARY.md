---
phase: 33-cohort-builder-ux-advanced-filters
plan: "03"
subsystem: cohort-builder
tags: [cohort, presets, advanced-filters, modal, coh-03, coh-04]
dependency_graph:
  requires: [33-01, 33-02]
  provides: [AdvancedFilterDialog, preset-buttons, advanced-dialog-wiring]
  affects: [src/pages/CohortBuilderPage.tsx, src/pages/AdvancedFilterDialog.tsx]
tech_stack:
  added: []
  patterns:
    - QualityFlagDialog modal scaffold (fixed inset-0 overlay + max-w-lg panel)
    - FeedbackButton focus-trap + Escape listener pattern
    - clearPresetOnManualEdit wrapper over setFilters
    - useMemo for medicationOptions derived from activeCases
    - getSettings() options passed to applyFilters useMemo
key_files:
  created:
    - src/pages/AdvancedFilterDialog.tsx
    - tests/advancedFilterDialog.test.tsx
  modified:
    - src/pages/CohortBuilderPage.tsx
decisions:
  - AdvancedFilterDialog receives medicationOptions as a prop (not direct cases access) — parent derives the list via useMemo
  - clearPresetOnManualEdit wraps all manual filter onChange handlers, avoiding per-call boilerplate
  - flaggedQuality preset builds flaggedCaseIds Set inline via qualityFlags.filter(f => f.status === 'open').map(f => f.caseId)
  - AdvancedFilterDialog placed in src/pages/ (not src/components/) matching plan specification
metrics:
  duration: "~15 minutes"
  completed: "2026-05-22"
  tasks: 2
  files: 3
---

# Phase 33 Plan 03: Preset Buttons + Advanced Filter Dialog Summary

COH-03 preset buttons (4 presets) and COH-04 advanced filter modal wired into CohortBuilderPage via applyFilters with getSettings() thresholds. Presets toggle on/off and clear on manual filter edit; the flaggedQuality preset derives flaggedCaseIds from open qualityFlags at click time.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | AdvancedFilterDialog modal (COH-04) | 7f35852 | src/pages/AdvancedFilterDialog.tsx, tests/advancedFilterDialog.test.tsx |
| 2 | Preset buttons + advanced-dialog trigger | d9260ea | src/pages/CohortBuilderPage.tsx |

## What Was Built

### Task 1: AdvancedFilterDialog (COH-04)

`src/pages/AdvancedFilterDialog.tsx` — a centered modal exposing 5 curated filter attributes:

1. **Diagnosis subtype** — multi-select checkboxes over AMD/DR SNOMED subtypes
2. **Comorbidities** — single boolean checkbox ("Has comorbidities")
3. **HbA1c** — numeric min/max inputs with `%` unit label, `inputMode="numeric"`, `py-1.5` brownfield spacing
4. **Drug/agent** — multi-select checkboxes from `medicationOptions` prop (derived by parent, no direct cases access)
5. **Laterality** — three radio buttons OD/OS/OU

Modal: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` to heading. X close button has `aria-label={t('advancedFiltersDiscard')}`. Focus trap + Escape key listener follow FeedbackButton.tsx pattern.

Footer: Clear (resets local state only), Discard (calls onClose), Apply variant="accent" (calls onApply with Partial<CohortFilter> then onClose).

### Task 2: CohortBuilderPage — Preset buttons + advanced dialog trigger (COH-03)

**Preset section** added above Diagnosis checkboxes:
- `cohortPresets` section label  
- `grid grid-cols-2 gap-2` of four `<Button>` elements with `aria-pressed`
- Default state: `variant="ghost" size="sm" px-3`
- Active state: `variant="soft" + ring-1 ring-[var(--color-teal)]`
- Toggle: second click on active preset calls `clearPreset()`

**flaggedQuality preset**: `applyPreset('flaggedQuality')` builds `flaggedCaseIds = new Set(qualityFlags.filter(f => f.status === 'open').map(f => f.caseId))` and sets both `preset` and `flaggedCaseIds` in filters.

**Clear on manual edit**: All manual filter `onChange` handlers now call `clearPresetOnManualEdit` instead of `setFilters` directly — any edit to diagnosis, gender, centers, age, visus, or CRT clears `filters.preset` and `filters.flaggedCaseIds`.

**applyFilters options**: The `filteredCases` useMemo now passes `{ therapyInterrupterDays, therapyBreakerDays, crtImplausibleThresholdUm }` from `getSettings()`.

**medicationOptions**: Derived via `useMemo` over `activeCases` — collects distinct `medicationCodeableConcept.coding[0].code` values, maps to `{ code, label }`, deduped and sorted by label.

**Advanced filter trigger**: Button with `Sliders` icon below Reset — `variant="accent"` when `hasAdvancedFilters`, `variant="ghost"` otherwise. Shows teal `Badge` with `activeAdvancedCount` when > 0. Opens `AdvancedFilterDialog`; `onApply` merges Partial<CohortFilter> into filters.

## Test Coverage

`tests/advancedFilterDialog.test.tsx` (16 tests, all pass):

- AdvancedFilterDialog: renders nothing when open=false; renders title when open=true; one checkbox per medicationOptions entry; Apply with hasComorbidity=true; Apply with hba1cRange; Apply with medicationCodes; Apply with laterality OD; Clear resets fields without closing; Discard calls onClose; X close calls onClose; Escape calls onClose
- CohortBuilderPage: renders all 4 preset buttons; clicking sets aria-pressed=true; second click clears (toggle off); editing diagnosis checkbox clears preset; flaggedQuality preset builds flaggedCaseIds Set from open flags only

Full suite: **887/887 tests pass**.

## Deviations from Plan

None — plan executed exactly as written. The `medicationOptions` `text` field fallback in `coding[0]` was handled with a type cast since `MedicationCoding` in the FHIR type doesn't declare `text` but it's referenced in PATTERNS.md.

## Known Stubs

None. The dialog fields are fully wired to local state and emit via `onApply`. The medicationOptions list is derived from real case data.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. The preset buttons and advanced dialog operate entirely in-memory within `DataContext`'s existing trust boundary (T-33-06, T-33-07 — accepted in plan threat model).

## Self-Check: PASSED

- src/pages/AdvancedFilterDialog.tsx: FOUND
- tests/advancedFilterDialog.test.tsx: FOUND
- src/pages/CohortBuilderPage.tsx: modified (FOUND)
- Commit 7f35852: FOUND
- Commit d9260ea: FOUND
- 887 tests passing: CONFIRMED
