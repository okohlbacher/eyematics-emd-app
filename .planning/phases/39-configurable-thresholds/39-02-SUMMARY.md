---
phase: 39-configurable-thresholds
plan: "02"
subsystem: settings / UI
tags: [settings, thresholds, plausibility, CFG-01, CFG-02, i18n]
dependency_graph:
  requires: [shared/thresholdConfig.ts, src/services/settingsService.ts]
  provides: [SettingsPage clinical-thresholds section, SettingsPage plausibility-ranges section]
  affects: [src/pages/SettingsPage.tsx, src/i18n/translations.ts]
tech_stack:
  added: []
  patterns: [validateThresholds/validatePlausibility client-side UX gate, handleSave* pattern mirroring handleSaveTtl]
key_files:
  created: []
  modified:
    - src/pages/SettingsPage.tsx
    - src/i18n/translations.ts
decisions:
  - "Two separate save handlers (handleSaveThresholds, handleSavePlausibility) for independent save/validate cycles per section, mirroring handleSaveTtl"
  - "Validation error stored as a translated string (not an error code) to simplify JSX — validation code → message mapping happens in the handler"
  - "Therapy interrupter/breaker inputs left in existing Therapy Discontinuation card per plan note (already editable; not moved)"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-25"
  tasks_completed: 2
  files_changed: 2
---

# Phase 39 Plan 02: SettingsPage admin sections + i18n Summary

**One-liner:** Added Clinical thresholds and Plausibility ranges admin form sections to SettingsPage, wired to shared validators and updateSettings, with full DE/EN i18n coverage (CFG-01, CFG-02).

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add DE/EN i18n keys for Clinical thresholds + Plausibility ranges | 30cd645 | src/i18n/translations.ts |
| 2 | Add form sections to SettingsPage (state, handlers, JSX) | 67770d1 | src/pages/SettingsPage.tsx |

## What Was Built

**src/i18n/translations.ts** — 25 new entries across DE and EN:
- `settingsThreshold*` (11 keys): section title, 4 field labels, 4 field hints, 1 validation error message
- `settingsPlausibility*` (14 keys): section title, 6 field labels (min/max per Visus/CRT/IOP), 3 group hints, 1 validation error message

**src/pages/SettingsPage.tsx** — Two new card sections:

*Clinical thresholds* card (CFG-01):
- Number inputs for `criticalCrtUm`, `criticalVisus`, `criticalIopMmHg`, `visusJump`
- State hooks initialized to `THRESHOLD_DEFAULTS`, loaded from `loadSettings()` on mount
- `handleSaveThresholds`: calls `validateThresholds()` → inline error with `role="alert"` on failure → `updateSettings({ thresholds })` + `showSaved()` on success
- Red border + role="alert" validation message blocking persist on invalid input

*Plausibility ranges* card (CFG-02):
- Number inputs for `visusMin/Max`, `crtMin/Max`, `iopMin/Max`
- State initialized to `PLAUSIBILITY_DEFAULTS`, loaded from `loadSettings()` on mount
- `handleSavePlausibility`: calls `validatePlausibility()` → inline error on failure → `updateSettings({ plausibility })` + `showSaved()` on success
- Same validation/error/banner pattern as thresholds section

Both sections reuse the shared success banner (`showSaved()`) and error banner (`setSaveError`) already present on the page.

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

- `npm run test:ci`: 926/926 passed (baseline held)
- `npm run lint`: 0 errors (5 pre-existing import-sort warnings across modified+unrelated files, all from pre-existing code)
- Grep gates: `validateThresholds|validatePlausibility` in SettingsPage.tsx — found; `updateSettings({ thresholds` — found; `settingsThreshold` in translations.ts (10 matches) — found; `settingsPlausibility` in translations.ts (11 matches) — found

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes. The UI change uses the existing PUT /api/settings boundary (T-39-04) already anticipated in the plan's threat model. Client validation is UX-only; server re-validates authoritatively (Plan 01 validateSettingsSchema).

## Known Stubs

None — all inputs wire directly to loaded settings values and persist via updateSettings.

## Self-Check: PASSED

- src/pages/SettingsPage.tsx: FOUND (modified)
- src/i18n/translations.ts: FOUND (modified)
- Commit 30cd645 (i18n keys): FOUND
- Commit 67770d1 (SettingsPage sections): FOUND
