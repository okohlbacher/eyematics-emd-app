---
phase: 05-center-based-data-restriction
plan: 01
subsystem: server
tags: [fhir, center-filtering, access-control, tdd, security]
dependency_graph:
  requires:
    - 04-01 (dataApi.ts, dataDb.ts, authMiddleware.ts)
    - 02-01 (initAuth.ts, JWT structure with centers[])
  provides:
    - server/fhirApi.ts (fhirApiRouter, invalidateFhirCache, getCaseToCenter)
    - center-based read filtering on /api/fhir/bundles
    - center-based write validation on /api/data/quality-flags and /api/data/saved-searches
  affects:
    - server/dataApi.ts (adds getCaseToCenter import, validateCaseCenters)
    - server/initAuth.ts (adds _migrateCenterIds, SHORTHAND_TO_ORG)
    - server/index.ts (seed data org-* format, fhirApiRouter mount)
    - server/settingsApi.ts (invalidateFhirCache on PUT success)
tech_stack:
  added:
    - express (runtime dep, was missing from package.json)
    - bcryptjs, jsonwebtoken, js-yaml, better-sqlite3, http-proxy-middleware (server runtime deps)
    - @types/express, @types/bcryptjs, @types/jsonwebtoken, @types/better-sqlite3 (dev types)
    - vitest (test runner, was missing from devDependencies)
  patterns:
    - TDD red-green cycle (tests written before production code)
    - Module-level cache with explicit invalidation (invalidateFhirCache)
    - Bypass pattern: admin OR all-5-centers short-circuits filtering
    - Local bundle filtering: per-bundle Organization ID match
    - Blaze bundle filtering: Patient.meta.source + cascaded resource exclusion
key_files:
  created:
    - server/fhirApi.ts
    - tests/fhirApi.test.ts
    - tests/dataApiCenter.test.ts
  modified:
    - server/initAuth.ts
    - server/index.ts
    - server/dataApi.ts
    - server/settingsApi.ts
    - server/issueApi.ts
    - package.json
decisions:
  - "Local vs Blaze bundle discrimination: presence of Organization entry in bundle. Local center files each contain exactly one Organization; Blaze synthetic bundles (all resources in one bundle) do not have a top-level Organization."
  - "Blaze bundle fixture in tests excludes Organization entry to correctly test the meta.source filtering path."
  - "Production handlers issueApiHandler and settingsApiHandler added to their respective modules (pre-existing missing exports, Rule 1 auto-fix)."
  - "Server runtime dependencies (express, bcrypt, etc.) installed to package.json — they were missing, causing test failures (Rule 3 auto-fix)."
metrics:
  duration_minutes: 25
  completed_date: "2026-04-10"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 8
---

# Phase 05 Plan 01: Server-Side FHIR Bundle Loading with Center Filtering — Summary

**One-liner:** Server-side FHIR bundle loading (local files + Blaze) with center-based access control, case ID write validation, and startup center ID migration from shorthand to org-* format.

## Objective

Move FHIR bundle loading from client to server. Apply center-based access control so unauthorized center data never leaves the server. Add case ID validation on data API writes. Invalidate FHIR cache on settings change.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Create server/fhirApi.ts — FHIR bundle loading, caching, center filtering; migration; router mount; settingsApi cache invalidation | 2aa026e |
| 2 | Add case ID center validation on data API write operations | 87cdae5 |

## What Was Built

### server/fhirApi.ts (new)

- `fhirApiRouter` — Express router with `GET /api/fhir/bundles`
- `isBypass(role, centers)` — admin or all-5-centers short-circuits filtering
- `getOrgIdFromBundle(bundle)` — extracts Organization.resource.id; returns null for Blaze synthetic bundles
- `filterBundlesByCenters(bundles, userCenters)` — local bundles filtered by org ID, Blaze bundles filtered by Patient.meta.source with cascaded resource exclusion
- `buildCaseIndex(bundles)` — maps patient ID to org-ID for write-time validation
- `getCaseToCenter()` — returns cached case index (used by dataApi.ts)
- `invalidateFhirCache()` — clears bundle cache and case index
- Local loading reads `public/data/manifest.json` then individual `public/data/center-*.json` files
- Blaze loading fetches all resource types with pagination, assembles into synthetic bundle
- Blaze network errors return HTTP 502 with generic message (T-05-06)

### server/initAuth.ts (modified)

- Added `SHORTHAND_TO_ORG` mapping: UKA→org-uka, UKB→org-ukb, LMU→org-lmu, UKT→org-ukt, UKM→org-ukm
- Added `_migrateCenterIds(users)` — exported for testing; migrates shorthand center IDs at startup
- Called from `_migrateUsersJson()` — runs at server startup, writes atomically if changed

### server/index.ts (modified)

- Seed data center arrays updated from shorthand `['UKA']` to org-* format `['org-uka']`
- `fhirApiRouter` imported and mounted at `/api/fhir` with `express.json()` body parser

### server/dataApi.ts (modified)

- Imports `getCaseToCenter` from fhirApi.ts
- Added `validateCaseCenters(caseIds, userCenters, role)` — looks up each case ID in the index, returns error string if any case is outside permitted centers; unknown cases are allowed through
- PUT `/quality-flags` — validates all caseIds before DB write; returns 403 on violation
- POST `/saved-searches` — validates `filters.caseIds` and `filters.selectedCases` if present; returns 403 on violation

### server/settingsApi.ts (modified)

- Imports `invalidateFhirCache` from fhirApi.ts
- Both the Vite plugin handler (`settingsApiPlugin`) and production handler (`settingsApiHandler`) call `invalidateFhirCache()` after successful settings write (mitigates T-05-04)

### server/issueApi.ts (modified)

- Added `issueApiHandler` production export (Rule 1 auto-fix: was imported in index.ts but not exported)

## Test Coverage

| File | Tests | Status |
|------|-------|--------|
| tests/fhirApi.test.ts | 10 tests (8 behaviors + 2 edge cases) | All pass |
| tests/dataApiCenter.test.ts | 5 tests | All pass |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing production handlers `issueApiHandler` and `settingsApiHandler`**
- Found during: Task 1 (reading index.ts imports)
- Issue: `server/index.ts` imports `issueApiHandler` from `issueApi.js` and `settingsApiHandler` from `settingsApi.js` but neither was exported — production server would fail to start
- Fix: Added `issueApiHandler` export to `server/issueApi.ts` and `settingsApiHandler` export to `server/settingsApi.ts` as raw Node.js middleware handlers that use `req.auth` from Express authMiddleware
- Files modified: server/issueApi.ts, server/settingsApi.ts

**2. [Rule 3 - Blocking] Missing server runtime dependencies in package.json**
- Found during: Task 1 (test execution)
- Issue: `express`, `bcryptjs`, `jsonwebtoken`, `js-yaml`, `better-sqlite3`, `http-proxy-middleware` and their TypeScript types were absent from package.json, causing module-not-found errors in tests
- Fix: Installed as production/dev dependencies via npm
- Impact: Also resolved the pre-existing `userCrud.test.ts` test failures

**3. [Rule 3 - Blocking] Missing `vitest` in devDependencies**
- Found during: Task 1 setup
- Issue: `vitest` not listed in package.json devDependencies
- Fix: Installed via npm install --save-dev vitest

**4. [Rule 1 - Bug] Test fixture for Blaze bundle had Organization entry**
- Found during: Task 1 (GREEN phase — Test 2 failure)
- Issue: The Blaze synthetic bundle test fixture included an Organization resource, causing it to be treated as a local bundle (org-ID filtering) rather than a Blaze bundle (Patient.meta.source filtering)
- Fix: Removed Organization entry from `BLAZE_SYNTHETIC_BUNDLE` fixture — Blaze bundles fetched by the server omit Organizations at the bundle level (they're individual resources, not per-bundle)
- Files modified: tests/fhirApi.test.ts

## Threat Mitigations Applied

| Threat | Status |
|--------|--------|
| T-05-01 (Information Disclosure — /api/fhir/bundles) | Mitigated: filterBundlesByCenters() applied before response |
| T-05-02 (Tampering — PUT /quality-flags) | Mitigated: validateCaseCenters() with 403 on violation |
| T-05-04 (Stale cache after settings change) | Mitigated: invalidateFhirCache() in both settings handlers |
| T-05-06 (Blaze error detail disclosure) | Mitigated: Generic "Failed to load FHIR bundles" 502 response |

## Self-Check: PASSED

| Item | Status |
|------|--------|
| server/fhirApi.ts | FOUND |
| tests/fhirApi.test.ts | FOUND |
| tests/dataApiCenter.test.ts | FOUND |
| 05-01-SUMMARY.md | FOUND |
| Commit 2aa026e (Task 1) | FOUND |
| Commit 87cdae5 (Task 2) | FOUND |
