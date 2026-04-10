---
phase: 05-center-based-data-restriction
verified: 2026-04-10T18:11:00Z
status: human_needed
score: 7/9 must-haves verified
re_verification: false
human_verification:
  - test: "Log in as a non-admin user with 1-2 centers assigned (e.g. forscher1 with org-uka). Open CohortBuilder and confirm only permitted centers appear."
    expected: "CohortBuilder shows only the centers assigned to the user (1-2), not all 5."
    why_human: "CENTER-08 — visual confirmation that CohortBuilder derives center list from filtered server response. Automated checks confirm the wiring is correct but cannot run a browser session."
  - test: "Check DevTools Network tab during data load. Confirm all FHIR data requests go to /api/fhir/bundles (not /data/*.json or /fhir/*)."
    expected: "No requests to /data/*.json or /fhir/* for FHIR data. One request to /api/fhir/bundles with JWT Authorization header."
    why_human: "CENTER-07 — confirms client no longer performs client-side loading. Cannot verify network traffic programmatically."
  - test: "Start the production server with npm run build && npm start, then inspect data/users.json."
    expected: "After server startup, data/users.json center values are in org-* format (org-uka, org-ukb, etc.) — the startup migration must run."
    why_human: "The migration code is correct and wired, but data/users.json still contains shorthand IDs (UKA, UKB...) at verification time because the server has not been started. The migration runs at server startup via _migrateUsersJson(). Human must confirm it runs and produces correct output."
---

# Phase 5: Center-Based Data Restriction — Verification Report

**Phase Goal:** Server-enforced center filtering on all data endpoints — unauthorized center data never leaves the server
**Verified:** 2026-04-10T18:11:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /api/fhir/bundles returns only FHIR bundles for the authenticated user's centers | VERIFIED | `server/fhirApi.ts:373` — `filterBundlesByCenters(allBundles, centers)` applied before response; 10/10 unit tests pass |
| 2 | Admin users receive all bundles without filtering | VERIFIED | `isBypass()` returns true for `role === 'admin'`; Test 3 confirms; `server/index.ts:97` seeds admin with all 5 org-* centers |
| 3 | Users with all 5 org-* centers assigned receive all bundles (bypass) | VERIFIED | `isBypass()` returns true when `centers.length >= VALID_CENTERS.size`; Test 4 passes |
| 4 | GET /api/fhir/bundles returns 401 without a valid JWT | VERIFIED | `/api/fhir/*` is covered by global `authMiddleware` on `/api/*` in `server/index.ts:166-174` |
| 5 | Local FHIR bundles loaded from public/data/center-*.json, never as raw static assets | VERIFIED | `server/fhirApi.ts:259,274` — `path.resolve(process.cwd(), 'public', 'data', filename)` via `fs.readFileSync`; bundles served through authenticated endpoint only |
| 6 | Blaze proxy mode filters by Patient.meta.source with cascaded resource exclusion | VERIFIED | `server/fhirApi.ts:140-174`; Test 2 confirms Patient.meta.source filtering with cascaded exclusion of Condition/Observation |
| 7 | PUT /api/data/quality-flags returns 403 when caseId belongs to outside center | VERIFIED | `server/dataApi.ts:122-126` — `validateCaseCenters()` called before DB write; 5/5 unit tests pass |
| 8 | data/users.json stores center values in org-* format at runtime | NEEDS HUMAN | Migration code exists in `server/initAuth.ts:247-256` and is called at startup, but `data/users.json` currently contains shorthand IDs (UKA, UKB, LMU, UKT, UKM). Migration runs at first server start. **Until server is started, JWT tokens will contain shorthand center IDs, breaking center filtering for non-admin users.** |
| 9 | invalidateFhirCache() is called when settings are saved via PUT /api/settings | VERIFIED | `server/settingsApi.ts:19` imports `invalidateFhirCache`; called at lines 110 and 185 (both Vite plugin and production handler paths) |

**Score:** 7/9 truths verified (1 needs human confirmation, 1 critical pre-launch dependency)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/fhirApi.ts` | FHIR bundle loading, caching, center filtering, /api/fhir/bundles endpoint | VERIFIED | 388 lines; exports `fhirApiRouter`, `invalidateFhirCache`, `getCaseToCenter`, `isBypass`, `filterBundlesByCenters`, `buildCaseIndex`, `getOrgIdFromBundle` |
| `server/initAuth.ts` | Center ID migration from shorthand to org-* format | VERIFIED | Contains `SHORTHAND_TO_ORG` mapping and `_migrateCenterIds()` called from `_migrateUsersJson()` at startup |
| `server/index.ts` | fhirApiRouter mounted at /api/fhir with express.json | VERIFIED | Line 174: `app.use('/api/fhir', express.json({ limit: '1mb' }), fhirApiRouter)`. Seed data uses org-* format (lines 97-103) |
| `server/dataApi.ts` | Case ID validation on write operations via getCaseToCenter | VERIFIED | Imports `getCaseToCenter` from fhirApi.ts; `validateCaseCenters()` called in PUT /quality-flags (line 122) and POST /saved-searches (line 191) |
| `server/settingsApi.ts` | Cache invalidation on settings change | VERIFIED | Imports and calls `invalidateFhirCache()` in both dev-plugin (line 110) and production handler (line 185) |
| `tests/fhirApi.test.ts` | TDD test suite for FHIR API filtering logic | VERIFIED | 10 tests all passing (10 pass / 0 fail) |
| `tests/dataApiCenter.test.ts` | TDD test suite for data API center validation | VERIFIED | 5 tests all passing (5 pass / 0 fail) |
| `src/context/DataContext.tsx` | FHIR data loading via /api/fhir/bundles with error handling | VERIFIED | Fetches `/api/fhir/bundles` with `getAuthHeaders()`; `fhirError` state; 403 and network error rendering; mutation 403 → `mutationForbiddenCase`/`mutationForbiddenSearch` |
| `src/services/dataSource.ts` | Gutted — FHIR loading removed, only test utilities remain | VERIFIED | `loadBundlesFromSource` removed (line 44 comment); `getDataSourceConfig` and `testBlazeConnection` retained |
| `vite.config.ts` | No /fhir proxy; fhirApiPlugin in plugins array | VERIFIED | No `server.proxy` block; `fhirApiPlugin()` in plugins array (line 9). `/fhir` proxy removed |
| `server/fhirApiPlugin.ts` | Vite dev server plugin for /api/fhir/* routes | VERIFIED | Exports `fhirApiPlugin()` following Vite Plugin pattern; handles GET /api/fhir/bundles with auth validation and center filtering from local files |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `server/fhirApi.ts` | `server/authMiddleware.ts` | `req.auth!.centers` from JWT | VERIFIED | `fhirApi.ts:374` — `const { role, centers } = req.auth!;` |
| `server/fhirApi.ts` | `public/data/center-*.json` | `fs.readFileSync` for local bundle loading | VERIFIED | `fhirApi.ts:274` — `fs.readFileSync(filePath, 'utf-8')` where `filePath = path.resolve(process.cwd(), 'public', 'data', filename)` |
| `server/dataApi.ts` | `server/fhirApi.ts` | `getCaseToCenter()` for case ID validation | VERIFIED | `dataApi.ts:27` — `import { getCaseToCenter } from './fhirApi.js'`; called at line 47 |
| `server/index.ts` | `server/fhirApi.ts` | router mount at /api/fhir | VERIFIED | `index.ts:39,174` — imported and mounted |
| `server/settingsApi.ts` | `server/fhirApi.ts` | `invalidateFhirCache()` on settings write | VERIFIED | `settingsApi.ts:19,110,185` — imported and called in both handlers |
| `src/context/DataContext.tsx` | `/api/fhir/bundles` | fetch with `getAuthHeaders()` | VERIFIED | `DataContext.tsx:98` — `fetch('/api/fhir/bundles', { headers: getAuthHeaders() })` |
| `src/context/DataContext.tsx` | `src/services/fhirLoader.ts` | `extractCenters()` and `extractPatientCases()` on response | VERIFIED | `DataContext.tsx:113` — `setCenters(extractCenters(data.bundles))` |
| `vite.config.ts` | `server/fhirApiPlugin.ts` | `fhirApiPlugin()` in plugins array | VERIFIED | `vite.config.ts:6,9` — imported and included |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `server/fhirApi.ts GET /bundles` | `allBundles` | `getCachedBundles()` → `loadFromLocalFiles()` via `fs.readFileSync` | Yes — reads `public/data/center-*.json` files | FLOWING |
| `src/context/DataContext.tsx` | `centers` | `extractCenters(data.bundles)` where `data` comes from `/api/fhir/bundles` | Yes — derived from server-filtered bundle response | FLOWING |
| `src/pages/CohortBuilderPage.tsx` | `centers` prop | `DataContext.centers` → `extractCenters(filteredBundles)` | Yes — only centers from permitted bundles appear | FLOWING |

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| fhirApi.ts unit tests | `npx vitest run tests/fhirApi.test.ts` | 10/10 tests pass | PASS |
| dataApiCenter.ts unit tests | `npx vitest run tests/dataApiCenter.test.ts` | 5/5 tests pass | PASS |
| TypeScript compilation | `npx tsc --noEmit` | Exit 0, no errors | PASS |
| fhirApiPlugin in vite.config.ts | `grep fhirApiPlugin vite.config.ts` | Found at line 9 | PASS |
| /fhir Vite proxy removed | `grep "'/fhir'" vite.config.ts` | No match — proxy absent | PASS |
| center IDs in seed data | `grep org-uka server/index.ts` | Found at lines 97,98,100,103 | PASS |
| data/users.json center format at runtime | `cat data/users.json` | Shorthand (UKA, UKB...) — migration pending server start | FAIL (pre-launch) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CENTER-01 | 05-01 | User's assigned centers stored in JWT payload and in data/users.json | VERIFIED | `initAuth.ts` stores centers; `authApi.ts:65` puts `centers` in JWT; `_migrateCenterIds` ensures org-* format at startup |
| CENTER-02 | 05-01 | Server-side FHIR data endpoint filters cases by user's centers before sending | VERIFIED | `fhirApi.ts:373-386` — `filterBundlesByCenters` applied before `res.json()` |
| CENTER-03 | 05-01 | Server-side center permission check on /api/data/* — reject with 403 | VERIFIED | `dataApi.ts:45-56,122-126,191-195` — `validateCaseCenters()` with 403 response |
| CENTER-04 | 05-01 | Local FHIR bundle loading: server loads only bundles matching user's centers | VERIFIED | `filterBundlesByCenters` with `getOrgIdFromBundle` — local bundles filtered by org ID |
| CENTER-05 | 05-01 | Blaze FHIR proxy: server filters by Patient.meta.source before forwarding | VERIFIED | `fhirApi.ts:140-174` — Patient.meta.source check with cascaded exclusion; Test 2 confirms |
| CENTER-06 | 05-01 | Admin users and users with all centers assigned bypass center filtering | VERIFIED | `isBypass()` logic; Tests 3, 4, 5 confirm admin bypass and all-centers bypass |
| CENTER-07 | 05-02 | Frontend DataContext receives pre-filtered data from server | NEEDS HUMAN | DataContext wiring confirmed (`fetch('/api/fhir/bundles')`); no `loadAllBundles` call; visual end-to-end confirmation pending |
| CENTER-08 | 05-02 | CohortBuilder center filter only shows centers user has permission for | NEEDS HUMAN | CohortBuilder renders `DataContext.centers` which is `extractCenters(serverFilteredBundles)` — correct wiring, visual confirmation pending. REQUIREMENTS.md still shows `[ ]` |
| CENTER-09 | 05-01 | Center permission enforced at API layer (authMiddleware extracts centers from JWT) | VERIFIED | `authMiddleware` on `/api/*` populates `req.auth.centers`; all handlers consume this; no endpoint bypasses auth |

### Anti-Patterns Found

| File | Issue | Severity | Impact |
|------|-------|----------|--------|
| `data/users.json` | All users have shorthand center IDs (UKA, UKB, LMU, UKT, UKM) instead of org-* format | WARNING | Until server starts and runs `_migrateCenterIds`, JWT tokens will contain shorthand IDs. The FHIR filter compares shorthand against org-* bundle IDs — no match means non-admin users get empty bundle results. This resolves automatically on first server startup. |

No placeholder/stub code found in production files. All implementations are substantive.

### Human Verification Required

#### 1. Center migration runs on first server start

**Test:** Run `npm run build && npm start`, then inspect `data/users.json`.
**Expected:** After startup, all user center values in `data/users.json` are in org-* format (org-uka, org-ukb, org-lmu, org-ukt, org-ukm). The server log should include the message: `[initAuth] Migrated users.json: converted center IDs to org-* format`.
**Why human:** The migration code is correct and wired — it runs via `_migrateUsersJson()` called in `initAuth()`. But `data/users.json` currently has shorthand IDs and the server hasn't been started since the code was written. A human must confirm the migration runs and produces correct output before the system is deployed.

#### 2. CohortBuilder shows only permitted centers (CENTER-08)

**Test:** Log in as `forscher1` (has `org-uka` after migration) in a running application. Navigate to CohortBuilder.
**Expected:** Only "Aachen" (or the center name for org-uka) appears in the center filter. The other 4 centers are not listed.
**Why human:** The code wiring is correct — CohortBuilder renders from `DataContext.centers` derived from `extractCenters(serverFilteredBundles)`. Visual confirmation that no extra centers appear requires a running browser session.

#### 3. Network tab confirms /api/fhir/bundles is the only FHIR data source (CENTER-07)

**Test:** Open DevTools Network tab during login and data load in both dev mode (`npm run dev`) and production mode (`npm run build && npm start`).
**Expected:** FHIR data requests go to `/api/fhir/bundles` with Authorization header. No requests to `/data/*.json` or `/fhir/*` for FHIR bundle data. The response is `{ bundles: [...] }`.
**Why human:** Cannot verify browser network traffic programmatically. The 05-02-SUMMARY marks `status: checkpoint-pending` — this checkpoint was explicitly defined as a human verification gate in Plan 02, Task 3.

### Gaps Summary

No hard gaps block the phase goal — all server-side enforcement code is implemented, tested, and wired correctly. Three items require human verification before this phase can be marked fully complete:

1. **data/users.json migration (pre-launch requirement):** The center ID migration code is correct and will run at first server start. However, until that happens, the live `data/users.json` file has shorthand center IDs. This is a pre-launch state, not a code bug. Human must start the server and confirm migration runs.

2. **CENTER-07 / CENTER-08 visual confirmation:** The Plan 02 human verification checkpoint (Task 3) was explicitly designed as a blocking gate. The SUMMARY records `status: checkpoint-pending`. The technical wiring is complete; visual end-to-end confirmation remains outstanding.

The REQUIREMENTS.md correctly marks CENTER-07 and CENTER-08 as `[ ]` pending — these require the human checkpoint to be formally closed.

---

_Verified: 2026-04-10T18:11:00Z_
_Verifier: Claude (gsd-verifier)_
