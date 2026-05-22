---
phase: 33-cohort-builder-ux-advanced-filters
reviewed: 2026-05-22T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - config/settings.yaml
  - shared/patientCases.ts
  - shared/qualityPredicates.ts
  - shared/types/fhir.ts
  - src/components/outcomes/OutcomesView.tsx
  - src/components/quality/QualityCaseList.tsx
  - src/context/AuthContext.tsx
  - src/i18n/translations.ts
  - src/pages/AdvancedFilterDialog.tsx
  - src/pages/AnalysisPage.tsx
  - src/pages/CohortBuilderPage.tsx
  - src/pages/LandingPage.tsx
  - src/pages/QualityPage.tsx
  - src/services/settingsService.ts
  - tests/LandingPage.test.tsx
  - tests/advancedFilterDialog.test.tsx
  - tests/cohortBuilderValidation.test.tsx
  - tests/cohortFilterPersistence.test.tsx
  - tests/cohortPresets.test.ts
  - tests/landingPageAlerts.test.tsx
  - tests/qualityPageDeepLink.test.tsx
findings:
  critical: 3
  warning: 5
  info: 2
  total: 10
status: issues_found
---

# Phase 33: Code Review Report

**Reviewed:** 2026-05-22T00:00:00Z
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Phase 33 delivers inline filter validation (COH-01), sessionStorage persistence with
logout-clear (COH-02), four preset predicates (COH-03), an AdvancedFilterDialog modal
(COH-04), and dashboard routing fixes (DASH-02). The shared/ boundary is clean — no
`src/` imports appear in `patientCases.ts` or `qualityPredicates.ts`. The logout-clear
of `emd-cohort-filters` is correctly wired in `AuthContext.performLogout`. The
`safePickFilter` whitelist in both `CohortBuilderPage` and `OutcomesView` is correctly
guarding the preset and advanced fields.

Three blockers require attention before ship. The most significant is a pair of missing
translation keys referenced by `QualityCaseList.tsx` (`qualityFilterCrt`,
`qualityFilterCrtImplausible`) that crash the quality page at runtime in both locales.
A secondary blocker is that the `AdvancedFilterDialog` applies HbA1c range filters with
silent hardcoded sentinel defaults (0 / 20) when only one bound is provided — this
silently widens the filter in a way the user cannot observe. A third blocker is that the
`visusMinText` / `visusMaxText` display state is not re-seeded when a `visusRange` filter
is restored from sessionStorage, leaving the input fields blank while a hidden filter is
actively narrowing results, giving users no indication of an active filter.

Five warnings cover: the logout-clear test being a stub that only exercises its own
assertion logic (not the real `performLogout`); the `AdvancedFilterDialog` not moving
focus to the dialog container on open (breaking keyboard-first workflows); HbA1c range
not validated for min > max before calling `onApply`; the `qualityPageDeepLink` test
fixtures using an undeclared `encounters` property that TypeScript would reject; and
`CohortBuilderPage.handleSave` saving the raw (potentially preset-containing) `filters`
rather than the validated `validFilters`.

---

## Critical Issues

### CR-01: Missing translation keys crash QualityCaseList at runtime

**File:** `src/components/quality/QualityCaseList.tsx:180,188`

**Issue:** `QualityCaseList` calls `t('qualityFilterCrt')` and
`t('qualityFilterCrtImplausible')`. Neither key exists in
`src/i18n/translations.ts`. The `t()` helper used through `useLanguage` performs a
direct property lookup on the translations object — TypeScript's `TranslationKey` type
would flag these as type errors at compile time if the component consumed the typed
helper, but `QualityCaseList` calls `t` through the context (which accepts `string`).
At runtime both calls will return `undefined`, causing the select labels and option text
to render blank and possibly throw depending on downstream consumers that treat the
result as a non-nullable string. Reproduces immediately when the Quality page is opened
in either locale.

**Fix:** Add the two missing keys to `src/i18n/translations.ts`:

```typescript
qualityFilterCrt: { de: 'CRT-Wert', en: 'CRT Value' },
qualityFilterCrtImplausible: { de: 'Unplausibel (> 400 µm)', en: 'Implausible (> 400 µm)' },
```

The exact German copy should match the established `crtAnomaly` string already present
(`'CRT > 400 µm'`). Coordinate with the UI-SPEC for precise label text.

---

### CR-02: visusMinText / visusMaxText display state not rehydrated from sessionStorage

**File:** `src/pages/CohortBuilderPage.tsx:202-203`

**Issue:** `visusMinText` and `visusMaxText` are initialised unconditionally to `''`
(line 202–203). When `safePickCohortFilter` restores a `visusRange` from sessionStorage
(line 56), the filter object carries a populated `visusRange` (e.g. `[0.3, 0.8]`) while
the two text inputs are both blank. The visus inputs are controlled by `visusMinText` /
`visusMaxText`, so after a page reload the inputs appear empty — but the hidden
`filters.visusRange` is actively filtering results. The live case-count will be narrowed
with no visible indication, violating the D-01 "filter state always visible" principle.
The `validFilters` memo also picks up this range (line 318) and passes it to
`applyFilters`.

Additionally the visusError validation computes from `visusMinText` / `visusMaxText`
(lines 263–272), which are both empty, so even a restored `visusRange` of `[1.5, 0.1]`
(inverted) would pass the error guard silently.

**Fix:** Seed the text inputs from any restored filter range during initialisation:

```typescript
const [visusMinText, setVisusMinText] = useState(() => {
  const restored = safePickCohortFilter(
    (() => { try { return JSON.parse(sessionStorage.getItem('emd-cohort-filters') ?? '{}'); } catch { return {}; } })()
  );
  return restored.visusRange?.[0] != null ? String(restored.visusRange[0]) : '';
});
const [visusMaxText, setVisusMaxText] = useState(() => {
  // ... same pattern for index [1]
});
```

Alternatively, derive the display value directly from `filters.visusRange` as a
controlled value (removing the separate text-state layer), which eliminates the
divergence entirely.

---

### CR-03: AdvancedFilterDialog applies hardcoded sentinel bounds when only one HbA1c bound is provided

**File:** `src/pages/AdvancedFilterDialog.tsx:131-135`

**Issue:** When the user enters only a minimum HbA1c (`minVal` valid, `maxVal` NaN), the
dialog silently clamps the range to `[minVal, 20]`. When only maximum is provided, it
uses `[0, maxVal]`. The magic numbers `0` and `20` are invisible to the user and not
surfaced in any validation message. A clinician entering `HbA1c min = 7` expecting to
see "all cases with HbA1c ≥ 7 %", instead gets "all cases with HbA1c between 7 % and
20 %", which will silently exclude valid cases above 20 % (a valid pathological range
in, e.g., uncontrolled diabetes). Neither bound is communicated back to the user — the
filter UI is blank except for the single-bound input.

`applyFilters` (patientCases.ts line 189) then applies `hba1cRange` symmetrically,
excluding `val > 20`. This is data-silencing behaviour in a clinical context.

**Fix:** Either require both bounds before setting `hba1cRange` (reject partial input),
or treat a single bound as an open-ended range using `[minVal, Infinity]` / `[0, maxVal]`
and update `applyFilters` to handle `Infinity` in the upper bound:

```typescript
// AdvancedFilterDialog handleApply — require both bounds
if (!isNaN(minVal) && !isNaN(maxVal)) {
  if (minVal > maxVal) {
    // surface a validation error instead of applying silently
    setHba1cError(t('cohortValidationAgeLowerExceedsUpper'));
    return;
  }
  advancedFields.hba1cRange = [minVal, maxVal];
}
// Do NOT add hba1cRange when only one bound is present — drop partial input silently
```

---

## Warnings

### WR-01: performLogout test is a stub — does not exercise the real AuthContext code path

**File:** `tests/cohortFilterPersistence.test.tsx:229-274`

**Issue:** The test named "AuthContext performLogout removes the emd-cohort-filters
sessionStorage key" (lines 229–274) is inert. It seeds sessionStorage, then manually
calls `sessionStorage.removeItem` on lines 266–267, and asserts the keys are absent.
The real `AuthContext.performLogout` is never invoked. The test cannot catch a
regression where `sessionStorage.removeItem('emd-cohort-filters')` is accidentally
deleted from `performLogout`. The comment trail inside the test (lines 241–258) admits
this explicitly ("Simulate logout … call removeItem directly").

**Fix:** Wire the test to actually call `logout` via a rendered `AuthProvider`. The
established pattern for this (used in Phase 32 tests) is to render a test component
that calls `useAuth().logout()` via a button click, with mocked `serverLogout` and
`broadcastLogout`, and assert that the sessionStorage key was removed after the click.

---

### WR-02: AdvancedFilterDialog does not move focus to the dialog panel on open

**File:** `src/pages/AdvancedFilterDialog.tsx:103-108`

**Issue:** The dialog renders at `open=true` but never calls `.focus()` on the dialog
container or its first focusable element. The Tab-trap in `handleKeyDown` (lines 84–97)
only works after the user has already tabbed into the dialog — if the triggering button
remains focused and the user presses Tab, focus moves to the browser chrome rather than
cycling through the dialog. WCAG 2.1 SC 2.4.3 (Focus Order) requires that dialogs
receive focus on open.

The `useEffect` that attaches the `keydown` listener (lines 103–108) is the right hook
to also move focus:

```typescript
useEffect(() => {
  if (open) {
    document.addEventListener('keydown', handleKeyDown);
    // Move focus into the dialog on open
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
      'button, input, select, [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }
}, [open, handleKeyDown]);
```

---

### WR-03: HbA1c min > max is silently accepted in AdvancedFilterDialog

**File:** `src/pages/AdvancedFilterDialog.tsx:121-142`

**Issue:** `handleApply` does not validate that `minVal <= maxVal` when both bounds are
present. A user entering min=9, max=6 produces `hba1cRange: [9, 6]`, which
`applyFilters` then evaluates as `val < 9 || val > 6` — this excludes every case
because no number can be simultaneously below 9 and above 6. The cohort silently returns
zero results with no error message, identical to the "no HbA1c data" empty state.

The analogous age and CRT validators in `CohortBuilderPage` (lines 256–282) correctly
catch this condition. Add the same guard in `handleApply`:

```typescript
if (!isNaN(minVal) && !isNaN(maxVal) && minVal > maxVal) {
  // surface error; do not call onApply
  return;
}
```

---

### WR-04: Test fixture uses undeclared `encounters` property (type mismatch, test reliability)

**File:** `tests/qualityPageDeepLink.test.tsx:37,57`

**Issue:** The `highCrtCase` and `lowCrtCase` fixtures both include an `encounters: []`
property. `PatientCase` (defined in `shared/types/fhir.ts` line 145–157) has no
`encounters` field. This is not caught at runtime in plain JS but fails TypeScript
strict-type checking. If the test suite runs with `--strict` type-checking (or if
TypeScript is invoked in CI), this will produce a type error on both fixtures. More
critically, both fixtures also omit the required `gender: string` field (line 148 of
`fhir.ts`), meaning the fixtures are structurally non-conformant. Any type assertion or
narrowing on `PatientCase.gender` inside the component will receive `undefined` rather
than a string, which could mask unrelated bugs.

**Fix:** Remove the spurious `encounters` field and add the required `gender` field to
both fixtures:

```typescript
const highCrtCase: PatientCase = {
  id: 'case-high-crt',
  pseudonym: 'HIGH-CRT',
  gender: 'male',           // required
  birthDate: '1960-01-01',
  centerId: 'CENTER-A',
  centerName: 'Center A',
  conditions: [],
  observations: [...],
  procedures: [],
  imagingStudies: [],
  medications: [],
  // remove encounters: []
};
```

---

### WR-05: CohortBuilderPage.handleSave saves raw filters including invalid ranges

**File:** `src/pages/CohortBuilderPage.tsx:349-360`

**Issue:** `handleSave` (line 349) saves `{ ...filters }` — the raw filter object.
`validFilters` (lines 315–321) strips `ageRange`, `visusRange`, and `crtRange` when the
corresponding validation error is active. The `Save` button is disabled while
`hasAnyFilterError` is true (line 878), but there is a narrow race: a saved search
loaded via `handleLoadSearch` (line 362) calls `setFilters(s.filters)` — if those stored
filters contain an inconsistent range pair (e.g., created by a different code path), the
error state becomes active, yet the user cannot save. That is correct. However, the
more significant issue is that the save button guard (`disabled={hasHardError || hasAnyFilterError || !saveName.trim()}`) relies on `hasAnyFilterError` which is based on `visusError` derived from `visusMinText` / `visusMaxText` — not from `filters.visusRange`. Given CR-02 (visusMinText not rehydrated), a restored session with a visus range would have `visusError = ''` while `filters.visusRange` could be inverted, and `handleSave` would persist the broken range to saved searches.

**Fix:** Change `handleSave` to persist `validFilters` (not `filters`) so saved searches
never contain an active validation error:

```typescript
const handleSave = () => {
  if (!saveName.trim()) return;
  if (hasHardError) return;
  const s: SavedSearch = {
    id: crypto.randomUUID(),
    name: saveName.trim(),
    createdAt: new Date().toISOString(),
    filters: { ...validFilters }, // use validated copy
  };
  addSavedSearch(s);
  setSaveName('');
};
```

---

## Info

### IN-01: AdvancedFilterDialog re-seeds only on `open` change, not on `filters` prop change

**File:** `src/pages/AdvancedFilterDialog.tsx:65-75`

**Issue:** The `useEffect` that re-seeds local dialog state (lines 65–75) only runs
when `open` transitions to `true` (deps `[open]`). The eslint-disable comment on line 74
suppresses the exhaustive-deps warning for `filters`. If the parent updates `filters`
while the dialog is open (unlikely today but possible if preset logic propagates), the
dialog fields will not reflect the new external state. This is noted as `D-DEFER` in the
codebase comments, so it is a deliberate trade-off — documenting it here for traceability.

---

### IN-02: `medicationOptions` derivation uses only `coding[0]` — silently drops multi-coding medications

**File:** `src/pages/CohortBuilderPage.tsx:239-241`

**Issue:** The `medicationOptions` memo (line 238–248) reads only `coding[0].code` and
`coding[0].display` per `MedicationStatement`. A resource with multiple codings (e.g.,
a branded + generic code pair) will have all secondary codings ignored. The first coding
encountered for a given code wins the display label. Since the data is synthetic today
this has no impact, but FHIR medication statements in production data routinely carry
multiple codings (ATC + RxNorm + SNOMED). This means the dialog checkbox list could show
a blank or incorrect label if `coding[0]` lacks a `display` field but a later coding has
one.

---

_Reviewed: 2026-05-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
