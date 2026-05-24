---
phase: 34-data-completeness-consent-stubs
plan: "04"
subsystem: LandingPage, i18n
tags: [dash-01, d-08, d-09, d-10, card-render, i18n, wave-3]

dependency_graph:
  requires:
    - "34-02 — countRawPatients denominator helper + stub isolation"
    - "34-03 — test scaffold + i18n key stubs"
  provides:
    - "Datenvollzähligkeit card rendered on LandingPage (D-08/D-09/D-10)"
    - "4 DE/EN i18n keys for the card"
    - "Green tests/datenvollstaendigkeitCard.test.tsx (7/7 tests)"
  affects:
    - "src/i18n/translations.ts — 4 new keys added"
    - "src/pages/LandingPage.tsx — ShieldCheck/countRawPatients import, bundles destructure, completenessColor helper, completeness metric computations, card JSX"
    - "tests/datenvollstaendigkeitCard.test.tsx — 5 it.skip removed"
    - "tests/LandingPage.test.tsx — bundles:[] added to useData mock (Rule 1 fix)"

tech_stack:
  added: []
  patterns:
    - "completenessColor(fraction): string using CSS token variables (not hex) per UI-SPEC"
    - "countRawPatients(bundles) as denominator, cases.length as numerator — separate raw count (D-09)"
    - "Progress bar role=progressbar with aria-valuenow/min/max + aria-label from i18n key"
    - "i18n placeholder interpolation via .replace('{n}', ...) — t() returns raw string"

key_files:
  created: []
  modified:
    - src/i18n/translations.ts
    - src/pages/LandingPage.tsx
    - tests/datenvollstaendigkeitCard.test.tsx
    - tests/LandingPage.test.tsx

decisions:
  - "completenessColor uses var(--color-sage/amber/coral) CSS tokens — no hex in new markup (UI-SPEC)"
  - "Card placed in full-width row between KPI tiles and Centers row (UI-SPEC positioning)"
  - "bundles:[] added to LandingPage.test.tsx to fix breakage caused by new bundles destructure (Rule 1)"

metrics:
  duration: "~10 min"
  completed: "2026-05-24"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 4
---

# Phase 34 Plan 04: Datenvollzähligkeit Card + Green Tests Summary

**One-liner:** Datenvollzähligkeit completeness card on LandingPage using countRawPatients denominator and cases.length numerator, with CSS-token semantic colors and accessible progress bar — turns all 5 skipped card assertions green.

## What Was Done

### Task 1: Add 4 Datenvollzähligkeit i18n keys (commit `ef67f66`)

Added four keys to `src/i18n/translations.ts` in the Landing page section, following the existing `key: { de: '…', en: '…' }` shape:

```typescript
datenvollstaendigkeitCaption: { de: 'DATENVOLLZÄHLIGKEIT', en: 'DATA COMPLETENESS' },
datenvollstaendigkeitLabel: { de: 'Datenvollzähligkeit', en: 'Data completeness' },
datenvollstaendigkeitPatients: { de: '{n} / {m} Patienten', en: '{n} / {m} patients' },
datenvollstaendigkeitAriaLabel: { de: 'Datenvollzähligkeit: {pct}%', en: 'Data completeness: {pct}%' },
```

Verified: `grep -c "datenvollstaendigkeit" src/i18n/translations.ts` returns 4. `npx tsc -b --noEmit` clean.

### Task 2: Render the Datenvollzähligkeit card and green the card test (commit `342936b`)

In `src/pages/LandingPage.tsx`:

- Added `ShieldCheck` to lucide-react import; imported `countRawPatients` from `'../services/fhirLoader'`
- Added `bundles` to `useData()` destructure
- Added `completenessColor(fraction)` helper (before component) using CSS token variables: sage >= 0.5, amber >= 0.25, coral otherwise
- Added completeness metric computations after existing KPI derivations:
  ```typescript
  const totalRawPatients = countRawPatients(bundles);
  const consentedPatients = cases.length;
  const completenessFraction = totalRawPatients > 0 ? consentedPatients / totalRawPatients : 0;
  const completenessPercent = Math.round(completenessFraction * 100);
  ```
- Inserted full-width Datenvollzähligkeit card row between KPI tiles grid and Centers row
  - ShieldCheck icon with `aria-hidden="true"` in teal-soft container
  - 32px semibold mono fraction colored by `completenessColor`
  - `{n} / {m} patients` sub-label via i18n key + `.replace()`
  - Progress bar with `role="progressbar"`, `aria-valuenow/min/max`, `aria-label` from i18n key
  - Existing `totalPatients = cases.length` line unchanged

In `tests/datenvollstaendigkeitCard.test.tsx`: Removed 5 `it.skip` markers. All 7 tests now pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] LandingPage.test.tsx missing `bundles` in useData mock**
- **Found during:** Task 2, after running `npm run test:ci`
- **Issue:** `LandingPage.test.tsx` useData mock did not include `bundles: []`. Our change to destructure `bundles` from `useData()` caused `countRawPatients(undefined)` to throw `TypeError: Cannot read properties of undefined (reading 'reduce')`.
- **Fix:** Added `bundles: []` to the `setupMocks` useData mock in `tests/LandingPage.test.tsx`
- **Files modified:** `tests/LandingPage.test.tsx`
- **Commit:** `342936b`

**2. [Rule 1 - Bug] Unused `MOCK_CASES` variable caused lint error**
- **Found during:** Task 2, lint check
- **Issue:** Scaffold variable `MOCK_CASES` in `datenvollstaendigkeitCard.test.tsx` was never used, causing `@typescript-eslint/no-unused-vars` error.
- **Fix:** Renamed to `_MOCK_CASES` per project convention (allowed unused vars must match `/^_/`)
- **Files modified:** `tests/datenvollstaendigkeitCard.test.tsx`
- **Commit:** `342936b`

## Verification

- `tests/datenvollstaendigkeitCard.test.tsx`: 7/7 tests green (no remaining `.skip`)
- `tests/LandingPage.test.tsx`: 9/9 tests green
- `npm run test:ci`: 901/901 passing
- `npm run lint`: 0 errors (2 pre-existing warnings in out-of-scope files)
- `npx tsc -b --noEmit`: clean

## Known Stubs

None — card is fully wired. `countRawPatients(bundles)` is the live denominator; `cases.length` is the live numerator. Both update reactively with site filtering (D-10).

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. The completeness card operates entirely client-side on already server-filtered bundles (`req.auth.centers` enforcement is upstream). Mitigations T-34-10, T-34-11, T-34-12 are all satisfied:
- T-34-10: `countRawPatients(bundles)` uses only server-filtered bundles — no stub demographics surfaced
- T-34-11: numerator = `cases.length` (stub-free), denominator = `countRawPatients`; `totalPatients = cases.length` unchanged
- T-34-12: zero-division guard (`totalRawPatients > 0`) in place; renders `0 %` without crashing

## Self-Check: PASSED

- `src/i18n/translations.ts` 4 datenvollstaendigkeit keys — FOUND (`grep -c` returns 4)
- `src/pages/LandingPage.tsx` countRawPatients(bundles) — FOUND
- `src/pages/LandingPage.tsx` totalPatients = cases.length unchanged — FOUND
- `src/pages/LandingPage.tsx` completenessColor with CSS tokens — FOUND
- `src/pages/LandingPage.tsx` role="progressbar" — FOUND
- `tests/datenvollstaendigkeitCard.test.tsx` no remaining it.skip — VERIFIED
- Commit `ef67f66` — FOUND
- Commit `342936b` — FOUND
- `npm run test:ci`: 901/901 green — VERIFIED
