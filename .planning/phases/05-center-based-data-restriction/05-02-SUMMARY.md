---
phase: 05-center-based-data-restriction
plan: 02
subsystem: client
tags: [fhir, client-side, error-handling, i18n, vite-plugin, center-filtering]
status: checkpoint-pending
dependency_graph:
  requires:
    - 05-01 (server/fhirApi.ts, /api/fhir/bundles endpoint, center filtering)
  provides:
    - src/context/DataContext.tsx (FHIR data via /api/fhir/bundles, error states)
    - server/fhirApiPlugin.ts (Vite dev plugin for /api/fhir/*)
    - i18n keys: fhir403Heading, fhir403Body, fhirLoadError, retryButton,
      noCentersAssigned, mutationForbiddenCase, mutationForbiddenSearch
  affects:
    - src/i18n/translations.ts (7 new keys added)
    - src/services/dataSource.ts (gutted — FHIR loading removed)
    - vite.config.ts (/fhir proxy removed, fhirApiPlugin added)
tech_stack:
  added: []
  patterns:
    - fetch with getAuthHeaders() for server API calls
    - fhirError state to distinguish 403 vs network error (status code discrimination)
    - Vite plugin pattern (fhirApiPlugin follows issueApiPlugin/settingsApiPlugin)
    - Error rendering inside DataProvider (no separate error component)
key_files:
  created:
    - server/fhirApiPlugin.ts
  modified:
    - src/context/DataContext.tsx
    - src/services/dataSource.ts
    - src/i18n/translations.ts
    - vite.config.ts
decisions:
  - "i18n keys added to single translations.ts with {de,en} pairs — project uses one file, not separate de.ts/en.ts as plan assumed"
  - "Error rendering placed inside DataProvider as renderedChildren — 403 shows full-page error replacing children; network error shows banner above children"
  - "fhirApiPlugin validates auth via validateAuth() from utils.ts; centers field read from decoded JWT payload"
metrics:
  duration_minutes: 12
  completed_date: "2026-04-10"
  tasks_completed: 2
  tasks_total: 3
  files_created: 1
  files_modified: 4
---

# Phase 05 Plan 02: Client-Server FHIR Wiring — Summary (Checkpoint Pending)

**One-liner:** DataContext wired to server-side /api/fhir/bundles with bilingual 403/network error handling, Vite dev plugin for /api/fhir/* reachability, and client-side FHIR loading removed.

**Status:** Tasks 1–2 complete and committed. Task 3 (human verification checkpoint) is pending.

## Objective

Wire client DataContext to server-side /api/fhir/bundles endpoint, remove client-side FHIR loading, add bilingual error handling, create Vite dev plugin for /api/fhir/* reachability, and remove Vite dev proxy.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Add i18n keys, create fhirApiPlugin.ts, remove /fhir proxy from vite.config.ts | a9ae4cd |
| 2 | Wire DataContext to /api/fhir/bundles, add error handling, gut dataSource.ts | 05f3a2b |

## Task Pending

| Task | Description | Status |
|------|-------------|--------|
| 3 | Human verification: center-based data restriction end-to-end | Awaiting |

## What Was Built

### src/i18n/translations.ts (modified)

Added 7 new keys under `// Center-based data restriction (Phase 5)`:
- `fhir403Heading` — "Zugriff verweigert" / "Access Denied"
- `fhir403Body` — contact administrator message (bilingual)
- `fhirLoadError` — network error message (bilingual)
- `retryButton` — "Erneut versuchen" / "Retry"
- `noCentersAssigned` — "Keine Zentren zugewiesen" / "No centers assigned"
- `mutationForbiddenCase` — 403 on quality flag write (bilingual)
- `mutationForbiddenSearch` — 403 on saved search write (bilingual)

### server/fhirApiPlugin.ts (new)

Vite dev server plugin handling `GET /api/fhir/bundles`:
- Auth validation via `validateAuth()` from utils.ts
- Loads local bundles from `public/data/` (manifest.json or fallback filenames)
- Applies center filtering: admin/all-centers bypass; others filtered by Organization.resource.id
- Returns `{ bundles: [...] }` JSON — same response shape as production fhirApi.ts
- Follows exact pattern of `issueApiPlugin` and `settingsApiPlugin`

### vite.config.ts (modified)

- Removed `server.proxy` block with `/fhir` entry (D-08 compliance — T-05-08 mitigation)
- Added `fhirApiPlugin()` import and call in plugins array

### src/context/DataContext.tsx (modified)

- Removed `loadAllBundles` import; kept `extractCenters`, `extractPatientCases`
- Added `fhirError: { status: number; message: string } | null` state
- `fetchData` now calls `fetch('/api/fhir/bundles', { headers: getAuthHeaders() })`
- 403 response → `setFhirError({ status: 403, message: 'forbidden' })` (no retry)
- Network/other error → `setFhirError({ status: 0, message: ... })` (with retry)
- `retryFhirLoad` callback wraps `fetchData()`
- Error rendering inside `DataProvider`: 403 shows full-page centered error; network error shows red banner with Retry button above children
- `addQualityFlag` and `updateQualityFlag`: 403 → `t('mutationForbiddenCase')`
- `addSavedSearch`: 403 → `t('mutationForbiddenSearch')`
- `fhirError` and `retryFhirLoad` exposed in `DataContextType` interface and context value
- `useLanguage()` hook imported for `t()` access inside provider

### src/services/dataSource.ts (modified)

Gutted per plan:
- Removed: `loadBundlesFromSource`, `discoverLocalFiles`, `loadFromLocalFiles`, `loadFromBlaze`, `fetchAllPages`
- Kept: `DataSourceType`, `DataSourceConfig`, `getDataSourceConfig()`, `testBlazeConnection()`
- Added deprecation comment at top
- Removed dead imports that were only needed for the removed functions

## Deviations from Plan

### Auto-fixed Issues

None.

### Plan Assumption Mismatch (non-blocking)

**1. i18n file structure differs from plan assumption**
- Plan assumed separate `src/i18n/de.ts` and `src/i18n/en.ts` files
- Actual project uses a single `src/i18n/translations.ts` with `{ de: '...', en: '...' }` pairs
- Fix: Added all 7 keys to `translations.ts` using the existing `{ de, en }` object format
- No impact on behavior — the `t(key)` function already handles locale selection

## Threat Mitigations Applied

| Threat | Status |
|--------|--------|
| T-05-07 (Information Disclosure — JWT required on /api/fhir/bundles) | Mitigated: getAuthHeaders() sends JWT on every fetch; server rejects 401 without valid token |
| T-05-08 (Information Disclosure — Vite dev proxy bypass) | Mitigated: /fhir proxy removed from vite.config.ts; fhirApiPlugin added for /api/fhir/* with auth validation |

## Known Stubs

None — all error states are wired to real API responses.

## Self-Check

| Item | Status |
|------|--------|
| server/fhirApiPlugin.ts | FOUND |
| src/i18n/translations.ts (7 new keys) | FOUND |
| vite.config.ts (no /fhir proxy, has fhirApiPlugin) | FOUND |
| src/context/DataContext.tsx (fetch /api/fhir/bundles) | FOUND |
| src/services/dataSource.ts (no loadBundlesFromSource) | FOUND |
| Commit a9ae4cd (Task 1) | FOUND |
| Commit 05f3a2b (Task 2) | FOUND |
| npx tsc --noEmit exit 0 | PASS |
