---
phase: 39-configurable-thresholds
plan: "01"
subsystem: settings / clinical thresholds
tags: [settings, thresholds, plausibility, CFG-01, CFG-02, CFG-03]
dependency_graph:
  requires: []
  provides: [shared/thresholdConfig.ts, settings.yaml thresholds.* plausibility.*, getThresholdSettings]
  affects: [src/config/clinicalThresholds.ts, src/utils/qualityMetrics.ts, server/settingsApi.ts]
tech_stack:
  added: [shared/thresholdConfig.ts]
  patterns: [settings-backed accessor functions, validateTtl-style error unions, call-time YAML read]
key_files:
  created:
    - shared/thresholdConfig.ts
    - tests/thresholdConfig.test.ts
  modified:
    - src/services/settingsService.ts
    - config/settings.yaml
    - src/config/clinicalThresholds.ts
    - src/utils/qualityMetrics.ts
    - server/settingsApi.ts
    - src/components/quality/QualityCaseDetail.tsx
    - src/components/case-detail/VisusCrtChart.tsx
    - src/components/case-detail/ClinicalParametersRow.tsx
    - src/hooks/useCaseData.ts
    - tests/ui-requirements.test.ts
decisions:
  - "Threshold constants converted to function accessors (not module-level consts) to minimize consumer churn while enabling settings-backed reads"
  - "Single source of truth: THRESHOLD_DEFAULTS / PLAUSIBILITY_DEFAULTS in shared/thresholdConfig.ts; settingsService imports them"
  - "validateThresholds checks criticalVisus in (0,2] — 0 excluded as not clinically meaningful as an action threshold"
  - "getThresholdSettings mirrors getAuthSettings call-time pattern; returns defaults on any read/parse failure"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-25"
  tasks_completed: 3
  files_changed: 10
---

# Phase 39 Plan 01: Foundation — Configurable Clinical Thresholds Summary

**One-liner:** Settings-backed clinical threshold accessors via shared/thresholdConfig.ts, extended AppSettings + settings.yaml, server getThresholdSettings, and PUT schema validation for thresholds/plausibility (CFG-01/02/03).

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 (RED) | Failing tests for thresholdConfig validators | 0c63ab7 | tests/thresholdConfig.test.ts |
| 1 (GREEN) | shared/thresholdConfig.ts — interfaces, defaults, validators | 7a461e4 | shared/thresholdConfig.ts |
| 2 | AppSettings + DEFAULTS + settings.yaml + accessor wiring | 0152e76 | settingsService.ts, settings.yaml, clinicalThresholds.ts, qualityMetrics.ts, 4 consumers |
| 3 | server getThresholdSettings + PUT validation + test fix | f382c80 | server/settingsApi.ts, tests/ui-requirements.test.ts |

## What Was Built

**shared/thresholdConfig.ts** — Pure, browser/node-global-free module providing:
- `ThresholdConfig` interface (criticalCrtUm, criticalVisus, criticalIopMmHg, visusJump)
- `PlausibilityConfig` interface (visusMin/Max, crtMin/Max, iopMin/Max)
- `THRESHOLD_DEFAULTS` / `PLAUSIBILITY_DEFAULTS` — single source of truth for all numeric defaults
- `validateThresholds()` / `validatePlausibility()` — pure validators returning error-code unions (`'ok'` or specific code), modeled on `validateTtl`

**settingsService.ts** — Extended `AppSettings` with `thresholds?` and `plausibility?` fields; `DEFAULTS` populated directly from shared defaults (no re-typing of numbers).

**config/settings.yaml** — Added `thresholds:` block (CFG-01) and `plausibility:` block (CFG-02) with production default values and inline comments referencing requirement IDs.

**clinicalThresholds.ts** — Four exports (`CRITICAL_CRT_THRESHOLD`, `CRITICAL_VISUS_THRESHOLD`, `CRITICAL_IOP_THRESHOLD`, `VISUS_JUMP_THRESHOLD`) converted from literal `const` to function accessors reading from `getSettings().thresholds ?? THRESHOLD_DEFAULTS`. CHART_COLORS unchanged. Four consumers updated to call as functions.

**qualityMetrics.ts** — `isVisusInRange`, `isCrtInRange`, `isIopInRange` now read bounds from `getSettings().plausibility ?? PLAUSIBILITY_DEFAULTS`.

**server/settingsApi.ts** — Added:
- `getThresholdSettings()` — call-time reader mirroring `getAuthSettings()` pattern; returns merged defaults on any failure (CFG-03)
- `validateSettingsSchema` extended: rejects malformed `thresholds`/`plausibility` blocks via shared validators (400 on non-'ok' result) (T-39-02)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fix ui-requirements.test.ts breaking after constant→function conversion**
- **Found during:** Task 3 full-suite run
- **Issue:** `tests/ui-requirements.test.ts` tested `expect(CRITICAL_CRT_THRESHOLD).toBe(400)` — comparing the function object to a number
- **Fix:** Updated assertions to call the accessor functions: `CRITICAL_CRT_THRESHOLD()`, `CRITICAL_VISUS_THRESHOLD()`, `VISUS_JUMP_THRESHOLD()`
- **Files modified:** tests/ui-requirements.test.ts
- **Commit:** f382c80

## Verification Results

- `npm run test:ci`: 926/926 passed (baseline was 902 pre-v1.12; 926 after thresholdConfig tests added)
- `npx vitest run thresholdConfig clinicalThresholds qualityMetrics settingsApi`: 43/43 passed
- `npm run build`: clean (0 errors)
- Grep gates: settings.yaml contains thresholds/plausibility, clinicalThresholds.ts and qualityMetrics.ts both reference getSettings(), server/settingsApi.ts exports getThresholdSettings and references validateThresholds/validatePlausibility

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes beyond what the plan's threat model anticipated. The PUT /api/settings boundary (T-39-01, T-39-02) and GET non-admin behavior (T-39-03) are covered as planned.

## Known Stubs

None — all threshold accessors wire through to real settings.yaml values.

## Self-Check: PASSED

- shared/thresholdConfig.ts: FOUND
- tests/thresholdConfig.test.ts: FOUND
- config/settings.yaml contains thresholds block: FOUND
- server/settingsApi.ts exports getThresholdSettings: FOUND
- Commits 0c63ab7, 7a461e4, 0152e76, f382c80: FOUND
