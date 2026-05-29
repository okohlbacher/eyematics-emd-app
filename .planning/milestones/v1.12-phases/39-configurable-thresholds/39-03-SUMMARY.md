---
phase: 39-configurable-thresholds
plan: "03"
subsystem: server aggregation / clinical thresholds
tags: [CFG-03, server-parity, applyFilters, cache-key, thresholds]
dependency_graph:
  requires: [39-01]
  provides: [getFilterOptions, threshold-aware cache key, thresholdParity.test.ts]
  affects: [server/outcomesAggregateApi.ts, server/settingsApi.ts]
tech_stack:
  added: []
  patterns: [call-time YAML read (mirrors getAuthSettings), options injection into shared function, threshold-aware cache key]
key_files:
  created:
    - tests/thresholdParity.test.ts
  modified:
    - server/outcomesAggregateApi.ts
    - server/settingsApi.ts
decisions:
  - "getFilterOptions() added to settingsApi.ts as the call-time reader for top-level applyFilters options (therapyInterrupterDays, therapyBreakerDays, crtImplausibleThresholdUm) — mirrors getAuthSettings/getThresholdSettings pattern exactly"
  - "Cache key includes all three threshold values as T-39-07 defense-in-depth; primary invalidation remains invalidateAllAggregates() on settings PUT"
  - "crtImplausibleThresholdUm kept separate from thresholds.criticalCrtUm per CONTEXT D1b"
  - "Parity tests call applyFilters directly (no HTTP mock) — pure-logic assertions document the gap and serve as regression tests"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-25"
  tasks_completed: 2
  files_changed: 3
---

# Phase 39 Plan 03: Server/Client Parity F-01 Summary

**One-liner:** Server aggregation now injects operator-configured applyFilters options (therapyInterrupterDays, therapyBreakerDays, crtImplausibleThresholdUm) from settings.yaml at request time, with threshold values keyed in the aggregate cache, closing the F-01 parity gap (CFG-03).

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | thresholdParity.test.ts — pure-logic parity tests for implausibleCrt + therapyBreaker presets | 1f45213 | tests/thresholdParity.test.ts |
| 2 | getFilterOptions() + options injection into resolveCohortCases + threshold-aware cache key | ed9b2f3 | server/outcomesAggregateApi.ts, server/settingsApi.ts |

## What Was Built

**tests/thresholdParity.test.ts** — 9 assertions across two preset suites:
- `implausibleCrt`: proves that `applyFilters` with `crtImplausibleThresholdUm: 300` selects more cases (350, 380, 420, 500 µm) vs the 400 default (420, 500 µm only); documents the F-01 gap where calling without options silently uses the 400 fallback
- `therapyBreaker`: proves that raising `therapyBreakerDays` from 365 to 450 narrows selection consistently; parity holds on both "sides"
- All tests use direct array assertions; no jest-dom, no vi.mock of applyFilters

**server/settingsApi.ts** — Added:
- `getFilterOptions()` — call-time fs read of top-level `therapyInterrupterDays`, `therapyBreakerDays`, `crtImplausibleThresholdUm` from settings.yaml; returns `FILTER_OPTION_DEFAULTS` (120/365/400) on any read/parse failure; exported as `FilterOptions` interface

**server/outcomesAggregateApi.ts** — Changed:
- `resolveCohortCases` now accepts a fourth `options: ApplyFiltersOptions` parameter and passes it as the third argument to `applyFilters(cases, filters, options)` — closes the silent fallback to hardcoded defaults
- `getFilterOptions()` called once per request before the cache-key construction; the three threshold values (`therapyInterrupterDays`, `therapyBreakerDays`, `crtImplausibleThresholdUm`) added to the cache key JSON (T-39-07 defense-in-depth)
- `filterOptions` passed through to `resolveCohortCases` on cache miss
- Center scoping (req.auth.centers, isBypass guard), audit writes, 403/500/502 paths entirely unchanged (T-39-06)

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

- `npm run test:ci`: 935/935 passed (baseline 926 pre-plan; +9 new parity tests)
- `npx vitest run outcomesAggregate thresholdParity`: 47/47 passed
- `npm run build`: clean (0 errors; pre-existing chunk-size warning only)
- Grep gate 1: `applyFilters(cases, filters, [A-Za-z{]` — PASS (options arg present)
- Grep gate 2: `crtImplausibleThresholdUm|therapyBreakerDays` in outcomesAggregateApi.ts — PASS

## Threat Surface Scan

No new network endpoints, auth paths, or trust-boundary changes beyond what the plan's threat model anticipated.

- T-39-06 (Elevation of Privilege): `resolveCohortCases` center filtering (isBypass guard, req.auth.centers) is untouched — threshold options cannot widen a cohort beyond authorized centers.
- T-39-07 (Tampering / cache poisoning): cache key now includes threshold values AND settings PUT already calls `invalidateAllAggregates()` — dual protection confirmed.
- T-39-08 (client-supplied threshold bypass): no body field for thresholds added; `getFilterOptions()` reads settings.yaml only.

## Known Stubs

None.

## Self-Check: PASSED

- tests/thresholdParity.test.ts: FOUND
- server/outcomesAggregateApi.ts: MODIFIED (getFilterOptions import, options in resolveCohortCases + cache key)
- server/settingsApi.ts: MODIFIED (getFilterOptions exported)
- Commits 1f45213, ed9b2f3: FOUND
