---
phase: 10-visual-ux-qa-preview-stability
reviewed: 2026-04-16T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - src/components/outcomes/palette.ts
  - src/components/outcomes/OutcomesPanel.tsx
  - src/components/outcomes/OutcomesTooltip.tsx
  - src/components/outcomes/OutcomesEmptyState.tsx
  - src/components/outcomes/OutcomesDataPreview.tsx
  - src/pages/OutcomesPage.tsx
  - src/pages/AdminPage.tsx
  - src/utils/cohortTrajectory.ts
  - src/i18n/translations.ts
  - tests/outcomesPalette.contrast.test.ts
  - tests/outcomesTooltip.test.tsx
  - tests/outcomesEmptyState.test.tsx
  - tests/outcomesDataPreview.test.tsx
  - tests/outcomesIqrSparse.test.tsx
  - tests/cohortTrajectory.test.ts
  - tests/adminCenterFilter.test.tsx
findings:
  critical: 0
  warning: 2
  info: 6
  total: 8
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-04-16
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 10 delivers the Visual UX / QA / Preview Stability work: chart palette contrast gate (D-01..D-03), IQR band n>=2 guard (D-04), tooltip field-order + per-patient suppression (D-05/D-06), all-eyes-filtered empty state (D-07/D-08), admin center filter locked to 7-site roster (D-09), and stable composite row keys for the data preview (CRREV-02).

Overall the implementation is clean, well-documented, and the test coverage directly pins the locked decisions from `10-CONTEXT.md`. No security or critical correctness issues were found. Two warnings concern dead UI branches — code paths that appear to be functional but cannot fire in practice because the data they depend on is never populated. Six info items capture UX polish, consistency, and silent-failure patterns that do not block the phase but are worth queuing for follow-up.

## Warnings

### WR-01: `sparse` warning in per-patient tooltip is unreachable

**File:** `src/components/outcomes/OutcomesTooltip.tsx:71,137-140`
**Issue:** Line 71 reads `const sparse = Boolean(raw.sparse)` where `raw` is the Recharts tooltip payload for a single measurement. The `sparse` flag is a property of `PatientSeries` (see `cohortTrajectory.ts:47,312,407`), not of `Measurement`. In `OutcomesPanel.tsx:158-162` the per-patient line data is built as `p.measurements.map((m) => ({ ...m, __series: 'perPatient', pseudonym: p.pseudonym }))` — the parent series' `sparse` flag is never propagated onto each measurement payload. As a result `raw.sparse` is always `undefined`, so the amber "sparse series" banner (L137-140) never renders. The UI shows translated copy for `outcomesTooltipSparse` that users will never see.
**Fix:** Either propagate `sparse` into the per-point payload in `OutcomesPanel.tsx`, or drop the dead branch.
```tsx
// OutcomesPanel.tsx L158-162
data={p.measurements.map((m) => ({
  ...m,
  __series: 'perPatient' as const,
  pseudonym: p.pseudonym,
  sparse: p.sparse,   // propagate so tooltip can read raw.sparse
}))}
```

### WR-02: Median tooltip renders `n=` when `raw.n` is missing

**File:** `src/components/outcomes/OutcomesTooltip.tsx:93`
**Issue:** `t('outcomesTooltipMedian').replace('{n}', String(raw.n ?? ''))` — when `raw.n` is missing, the template substitutes an empty string. The EN copy is `'Median (n={n} patients)'` → renders as `Median (n= patients)` which is visibly broken. The median grid point in `cohortTrajectory.ts:476` always sets `n`, so in practice this should not fire; the `?? ''` fallback is therefore either unnecessary or masks a real payload-shape regression. The test at `tests/outcomesTooltip.test.tsx:161` passes a median payload that includes `n: 5`, so this branch is not covered by the fallback path.
**Fix:** Guard the render when `n` is missing, rather than substituting empty string.
```tsx
const n = typeof raw.n === 'number' ? raw.n : null;
if (n === null) return null; // or render without count
// …
{t('outcomesTooltipMedian').replace('{n}', String(n))}
```

## Info

### IN-01: `defaultScatterOn` effect is one-way (never re-enables scatter)

**File:** `src/pages/OutcomesPage.tsx:79-83`
**Issue:** The effect turns scatter *off* when `defaultScatterOn(cohort.cases.length)` is false, but never turns it back on when the user navigates to a smaller cohort. If a user opens a 200-patient cohort (scatter auto-off), then switches to a 5-patient cohort, scatter stays off. This may be intentional (preserve user preference once the page is mounted) but the effect only reads cohort size — there's no preference flag.
**Fix:** Document the intent in a comment, or mirror the default in both directions:
```tsx
useEffect(() => {
  if (!cohort) return;
  setLayers((L) => ({ ...L, scatter: defaultScatterOn(cohort.cases.length) }));
}, [cohort]);
```

### IN-02: Panel subtitle shows raw numbers without labels

**File:** `src/components/outcomes/OutcomesPanel.tsx:54`
**Issue:** `subtitle = \`${panel.summary.patientCount} · ${panel.summary.measurementCount}\`` renders as e.g. `"5 · 23"` — unlabeled. The translations file already defines `outcomesPanelSubtitle: '{patients} patients · {measurements} measurements'` (line 607) which is a better template and was designed for exactly this use.
**Fix:** Use the existing template:
```tsx
const subtitle = t('outcomesPanelSubtitle')
  .replace('{patients}', String(panel.summary.patientCount))
  .replace('{measurements}', String(panel.summary.measurementCount));
```

### IN-03: `alert()` for user-creation errors is poor UX

**File:** `src/pages/AdminPage.tsx:234`
**Issue:** On failed `POST /api/auth/users`, the page uses `alert(err.error ?? 'Failed to create user')` which is a jarring blocking dialog. Elsewhere the page uses inline state (`loadError`) for the users-list fetch; the create flow should follow the same pattern.
**Fix:** Replace with inline error state, e.g. `setCreateError(err.error ?? 'Failed to create user')` and render as a red banner near the form.

### IN-04: Silent swallowing of `/api/fhir/centers` failures

**File:** `src/pages/AdminPage.tsx:104-114`
**Issue:** The centers-load chain is `.then(...).catch(() => {})` — any failure leaves `centerOptions` empty with no visible signal. The center filter then shows only "All centers" and the multi-center assignment UI is empty, looking like a feature gap rather than an error.
**Fix:** Surface failures via `setLoadError` (or a dedicated state) so admins know the API call failed.

### IN-05: Inconsistent day-difference rounding between CSV and chart

**File:** `src/components/outcomes/OutcomesDataPreview.tsx:120-122` vs `src/utils/cohortTrajectory.ts:253-257`
**Issue:** `OutcomesDataPreview.tsx` uses `Math.round((tB - tA) / 86400000)` for `days_since_baseline`, but `cohortTrajectory.ts:daysBetween` uses `Math.floor(...)` for the same computation. For ISO date strings without time component both parse as UTC midnight, so the difference is always an integer and `round === floor` — so there is no functional disagreement today. However the inconsistency is a latent trap: if a future change ever passes an ISO timestamp (e.g., `'2024-05-01T14:23Z'`), the two code paths will disagree by 1 day.
**Fix:** Centralize to a shared `daysBetween` helper (export from `cohortTrajectory.ts` and import here). The exported `decimalToLogmar`/`decimalToSnellen`/`eyeOf` already follow this pattern.

### IN-06: Composite row key uses `|` without validating pseudonym content

**File:** `src/components/outcomes/OutcomesDataPreview.tsx:169`
**Issue:** `\`${r.patient_pseudonym}|${r.eye}|${r.observation_date}\`` uses `|` as separator. A pseudonym containing `|` would produce ambiguous keys. In the current codebase pseudonyms appear to be alphanumeric (e.g. `'alice'`, `'carol'`), so the risk is low and the test fixture exercises correctly. Worth pinning as an assertion in `flattenToRows` to prevent a future drift where pseudonyms can include arbitrary characters.
**Fix:** Add a dev-only assertion, or pick a character that cannot appear in a pseudonym (e.g. `\x1f`), or fall back to the `#N` counter when the base key already exists regardless of source.

---

_Reviewed: 2026-04-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
