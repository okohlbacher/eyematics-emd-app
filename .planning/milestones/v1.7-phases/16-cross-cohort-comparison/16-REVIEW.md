---
phase: 16-cross-cohort-comparison
reviewed: 2026-04-21T10:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/components/outcomes/palette.ts
  - src/i18n/translations.ts
  - src/components/outcomes/OutcomesPanel.tsx
  - src/components/outcomes/CohortCompareDrawer.tsx
  - src/components/outcomes/OutcomesSettingsDrawer.tsx
  - src/components/outcomes/OutcomesView.tsx
  - tests/cohortCompareDrawer.test.tsx
  - tests/OutcomesPanel.test.tsx
  - tests/OutcomesViewRouting.test.tsx
  - tests/outcomesPalette.contrast.test.ts
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-04-21T10:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 16 adds cross-cohort comparison: a `CohortCompareDrawer`, a `COHORT_PALETTES` constant, cross-cohort rendering branches in `OutcomesPanel`, URL-parameter routing in `OutcomesView`, and a complete test suite. The implementation is structurally sound — hooks are ordered correctly, the 4-cohort cap is enforced consistently, and the WCAG palette contrast values are verified by automated tests.

One critical issue was found: demo credentials (passwords + OTP) are embedded verbatim in the production i18n bundle. Three warnings cover an accessibility violation on the close button, a visual subtitle bug in cross-cohort mode when the `?cohorts=` parameter contains only unknown IDs, and a code-duplication risk in two inline empty-panel literals. Three info items cover hardcoded English strings in legend labels, a subtitle template divergence, and the duplicated empty-panel pattern.

---

## Critical Issues

### CR-01: Demo credentials hardcoded in production i18n bundle

**File:** `src/i18n/translations.ts:63`
**Issue:** The `loginDemoHint` key embeds live demo passwords (`admin2025!`, `forscher2025!`) and a fixed OTP code (`123456`) in both `de` and `en` locales. These strings are compiled into every production bundle shipped to users. If the demo environment shares infrastructure or credentials with any staging/production system, or if the credentials are reused elsewhere, this constitutes a credential exposure. Even in a fully isolated demo, shipping credentials in the bundle allows any user who inspects the JS to extract them without accessing the login UI.

**Fix:**
```typescript
// Option A — remove the hint entirely for production builds:
// loginDemoHint: { de: '', en: '' },

// Option B — move credentials to a server-side rendered placeholder,
// or inject them only in development builds via an env-gated import:

// In translations.ts — replace literal values with empty strings:
loginDemoHint: {
  de: '',
  en: '',
},

// In a dev-only overlay (e.g. src/components/DevCredentialsHint.tsx),
// conditionally rendered when import.meta.env.DEV === true:
//   admin / admin2025! · forscher1 / forscher2025! · OTP: 123456
```

---

## Warnings

### WR-01: Close button aria-label duplicates the drawer heading label (WCAG 4.1.2 violation)

**File:** `src/components/outcomes/CohortCompareDrawer.tsx:62`
**Issue:** The close `<button>` uses `aria-label={t('outcomesCompareDrawerTitle')}` — the same string as the `<h2>` heading on line 56 ("Compare Cohorts" / "Kohorten vergleichen"). A screen-reader user therefore encounters two focusable elements with identical accessible names in quick succession. This fails WCAG 4.1.2 (Name, Role, Value) and is a known failure mode with NVDA/JAWS, which read both as "Compare Cohorts, heading" and "Compare Cohorts, button" with no distinction for the close action.

**Fix:**
```tsx
// In translations.ts — add a dedicated close-drawer key (reuses existing 'close' pattern):
outcomesCompareCloseDrawer: {
  de: 'Kohorten-Vergleich schließen',
  en: 'Close cohort comparison',
},

// In CohortCompareDrawer.tsx line 62 — use the new key:
<button
  type="button"
  onClick={onClose}
  aria-label={t('outcomesCompareCloseDrawer')}
  className="p-1 rounded hover:bg-gray-100"
>
  <X className="w-4 h-4" />
</button>
```

### WR-02: Cross-cohort subtitle shows "1 cohorts compared" when all cohort IDs are unknown

**File:** `src/components/outcomes/OutcomesView.tsx:88`
**Issue:** `isCrossMode` is set to `true` whenever `rawCohortsParam` is non-empty (line 88). If the `?cohorts=` value contains only unknown IDs (e.g. `?cohorts=pUNKNOWN`), the `crossCohortIds` memo filters them all out, leaving an empty array. `isCrossMode` remains `true`, so the header subtitle IIFE on line 624 runs. `crossCohortAggregates` will have 0 entries, `names.length === 0`, and the subtitle renders `"{count} cohorts compared · "` with count=0 — a confusing and grammatically incorrect display. A user deep-linking a stale URL with a deleted cohort ID will see this.

**Fix:**
```typescript
// OutcomesView.tsx — tighten the isCrossMode guard to require at least 2 resolved cohorts:
const isCrossMode = crossCohortIds.length >= 2;

// This requires moving the declaration below the crossCohortIds memo.
// The existing comment "placed here, above any early return, per Pitfall 3 hook-order rule"
// applies to hooks only — isCrossMode is a derived const, not a hook, so it can be placed
// after the memo without violating hook ordering rules.
```

### WR-03: Inline empty-panel literal duplicated across two render branches

**File:** `src/components/outcomes/OutcomesView.tsx:584` and `src/components/outcomes/OutcomesView.tsx:604`
**Issue:** The same 3-panel empty `TrajectoryResult` object literal (with all `patientCount: 0`, `measurementCount: 0`, `excludedCount: 0` stubs) is copy-pasted verbatim in two places — once for the `interval` metric branch (line 584) and once for the `responder` branch (line 604). If the `PanelResult` or `TrajectoryResult` types gain a new required field, only one of the two literals is likely to receive the update, causing a type error or silent runtime divergence.

**Fix:**
```typescript
// OutcomesView.tsx — extract as a module-level constant, above the component:
const EMPTY_TRAJECTORY: TrajectoryResult = {
  od:       { patients: [], scatterPoints: [], medianGrid: [], summary: { patientCount: 0, measurementCount: 0, excludedCount: 0 } },
  os:       { patients: [], scatterPoints: [], medianGrid: [], summary: { patientCount: 0, measurementCount: 0, excludedCount: 0 } },
  combined: { patients: [], scatterPoints: [], medianGrid: [], summary: { patientCount: 0, measurementCount: 0, excludedCount: 0 } },
};

// Then at lines 584 and 604:
aggregate={aggregate ?? EMPTY_TRAJECTORY}
```

---

## Info

### IN-01: Legend label hardcodes English "patients" in cross-cohort median line name

**File:** `src/components/outcomes/OutcomesPanel.tsx:294`
**Issue:** The Recharts `name` prop for cross-cohort median lines is `\`${series.cohortName} (N=${series.patientCount} patients)\``. The word "patients" is not passed through `t()`. For German locale, the legend chip will read e.g. "AMD-Kohorte (N=42 patients)" rather than "AMD-Kohorte (N=42 Patient:innen)". The same pattern occurs in `CohortCompareDrawer.tsx` at lines 83–84.

**Fix:**
```tsx
// OutcomesPanel.tsx line 294 — use the existing 'outcomesCardPatients' key:
name={`${series.cohortName} (N=${series.patientCount} ${t('outcomesCardPatients')})`}

// CohortCompareDrawer.tsx lines 83–84 — same substitution in label:
const label = isPrimary
  ? `${s.name} (N=${count} ${t('outcomesCardPatients')}) · ${t('outcomesComparePrimaryLabel')}`
  : `${s.name} (N=${count} ${t('outcomesCardPatients')})`;
```

### IN-02: OutcomesPanel subtitle bypasses the outcomesPanelSubtitle translation template

**File:** `src/components/outcomes/OutcomesPanel.tsx:90`
**Issue:** Line 90 constructs the subtitle as `\`${panel.summary.patientCount} · ${panel.summary.measurementCount}\`` rather than using the `outcomesPanelSubtitle` translation key (`'{patients} patients · {measurements} measurements'`) which already exists in translations.ts at line 634. This diverges from the established pattern and means the subtitle is not localizable.

**Fix:**
```tsx
// OutcomesPanel.tsx line 90:
const subtitle = t('outcomesPanelSubtitle')
  .replace('{patients}', String(panel.summary.patientCount))
  .replace('{measurements}', String(panel.summary.measurementCount));
```

### IN-03: loginDemoHint key appears in both locale branches — see CR-01

**File:** `src/i18n/translations.ts:63-65`
**Issue:** The OTP value `123456` is a static code used in tests (`cohortCompareDrawer.test.tsx` and routing tests reference OTP as a stub). If the demo OTP is ever a real rotating TOTP, having it hardcoded in tests and i18n simultaneously creates a maintenance coupling. Already covered by CR-01 for the security dimension; flagged here as a test-maintenance concern. No separate fix required beyond CR-01.

---

_Reviewed: 2026-04-21T10:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
