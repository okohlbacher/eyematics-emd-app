---
phase: 12-server-side-outcomes-pre-aggregation
plan: 02
subsystem: server-aggregate-endpoint
tags: [server, api, cache, audit, aggregation, compression, express]

# Dependency graph
requires:
  - phase: 11-audit-beacon-pii-hardening
    provides: hashCohortId + SKIP_AUDIT_PATHS handler-own-row pattern (reused verbatim for AGG-05)
  - phase: 12-01
    provides: shared/cohortTrajectory + shared/outcomesProjection + shared/fhirCodes + shared/fhirQueries + shared/types/fhir (single projector + pure math)
provides:
  - "POST /api/outcomes/aggregate — auth-gated, body-validated, center-filtered, cached, audit-logged cohort trajectory endpoint"
  - "server/outcomesAggregateCache.ts — Map-backed TTL cache with explicit invalidateByCohort"
  - "server/outcomesAggregateApi.ts — Express Router (production) mounted at /api/outcomes"
  - "SKIP_AUDIT_PATHS +1 entry (/api/outcomes/aggregate) + dataApi invalidateByCohort hooks on POST/DELETE saved-searches"
  - "compression + @types/compression dependency (route-scoped on /api/outcomes/aggregate)"
  - "outcomes.{serverAggregationThresholdPatients,aggregateCacheTtlMs} config knobs in settings.yaml + schema validator"
affects: [12-03 test-suite, 12-04 client-routing, 13-new-outcome-metrics]

# Tech tracking
tech-stack:
  added:
    - "compression@^1.8.1 (+ @types/compression@^1.8.1 devDep)"
  patterns:
    - "Route-scoped compression() matching Phase 11 scoped-body-parser precedent (no global mount; preserves raw-stream consumers)"
    - "User-scoped Map cache with explicit invalidation hook + TTL safety-net + lazy expiry on read"
    - "Handler-own audit row with hashed identifier (Phase 11 template reused; one SKIP_AUDIT_PATHS entry added)"
    - "Static imports only in request path — types visible end-to-end, no dynamic module loading overhead"

key-files:
  created:
    - server/outcomesAggregateApi.ts
    - server/outcomesAggregateCache.ts
    - .planning/phases/12-server-side-outcomes-pre-aggregation/12-02-SUMMARY.md
  modified:
    - server/auditMiddleware.ts (SKIP_AUDIT_PATHS +1 entry)
    - server/authApi.ts (narrow req.params.username via String(...) — Rule 3 blocking unblock for tsc --noEmit acceptance)
    - server/dataApi.ts (import + call invalidateByCohort in POST + DELETE saved-search handlers)
    - server/fhirApi.ts (add `export` to getCachedBundles)
    - server/index.ts (import compression + outcomesAggregateRouter; scoped json '16kb' + compression(); mount router; init cache)
    - server/settingsApi.ts (validateSettingsSchema accepts optional outcomes section)
    - config/settings.yaml (+outcomes section)
    - package.json (+compression dep and devDep)
    - package-lock.json (dep tree)

key-decisions:
  - "Inline re-implementation of extractPatientCases + applyFilters + getAge in server/outcomesAggregateApi.ts rather than importing from src/services/fhirLoader.ts. The plan's <interfaces> block prescribes exactly this pivot when the fhirLoader import transitively fails: src/services/fhirLoader.ts imports authFetch from src/services/authHeaders.ts which references sessionStorage/window. Node runtime imports succeed (tested) but tsconfig.server.json compiles with lib:[ES2023] (no DOM), so TS fails to declare window/sessionStorage. Reimplementing the 40-line surface locally against shared/ imports keeps the server build self-contained and matches fhirLoader.ts semantics line-for-line."
  - "Fixed three pre-existing server/authApi.ts tsc narrowing errors (logged in deferred-items.md from Plan 12-01). Required under Rule 3 — the task acceptance criterion 'npx tsc -p tsconfig.server.json --noEmit exits 0' was blocked by these pre-existing findings. Fix is a 2-site String(...) narrowing mirroring server/dataApi.ts:238 convention."
  - "Landed the `export async function getCachedBundles` edit in the Task 2a commit (not Task 2b as the plan prescribed) because the Task 2a tsc check must exit 0 and the handler file references it. Both files co-land in this plan; Task 2b's remaining wiring (dataApi invalidateByCohort + index.ts mount) stayed in its own commit. Documented in the Task 2b commit message."
  - "Body parser limit set to 16kb (matching Phase 11 /api/audit/events/view-open) rather than the original 8kb suggestion in RESEARCH.md §Pattern 4. The plan explicitly revised this to 16kb for consistency across the two hashed-cohort-id POST routes — still 80× the realistic ~200-byte payload."
  - "The single-projector invariant is enforced by IMPORTING shapeOutcomesResponse from shared/outcomesProjection.ts — never redefining it locally. Grep assertion for 'function shapeResponse|function shapeOutcomesResponse' returns 0 matches in server/outcomesAggregateApi.ts, closing AGG-02 key-order drift by construction."

requirements-completed: [AGG-01, AGG-04, AGG-05]

# Metrics
duration: ~9min
completed: 2026-04-16
---

# Phase 12 Plan 02: Server-Side Aggregate Endpoint Summary

**Production-ready `POST /api/outcomes/aggregate` end-to-end: user-scoped Map cache with TTL + explicit invalidation, Express Router with auth + body validation + JWT-centers filter + cohort ownership check + shared-module compute + shared projector + hashed audit row; dataApi invalidation hooks + scoped compression + settings schema extended + compression dep installed.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-04-16T19:27:08Z
- **Tasks:** 3 (Task 1 + Task 2a + Task 2b per the revised split)
- **Files modified:** 5 new/extended server modules, 1 config, 2 dep manifests = 8 files + 2 new files

## Accomplishments

- Added the full `POST /api/outcomes/aggregate` endpoint end-to-end: body validation (D-02), JWT center filter (D-05), cohort ownership (D-06), user-scoped cache with TTL + explicit invalidation (D-07..D-10), shared-module math (AGG-02 parity by construction), hashed audit row (D-16), route-scoped compression (D-15), and SKIP_AUDIT_PATHS entry (D-17) — all three ROADMAP success criteria (AGG-01, AGG-04, AGG-05) achievable in this plan.
- `server/outcomesAggregateCache.ts` (57 lines) — 5 named exports: `initOutcomesAggregateCache`, `aggregateCacheGet`, `aggregateCacheSet`, `invalidateByCohort`, `_resetForTesting`. Map-backed, lazy-expiry on read, TTL from `settings.outcomes.aggregateCacheTtlMs` with 30-min default.
- `server/outcomesAggregateApi.ts` (305 lines) — exports `outcomesAggregateRouter` with `POST /aggregate`. Handler composition: auth → body validate → cohort lookup → cache read → (miss: shared math + shared projector) → cache set → audit write → respond. All imports are static; `shapeOutcomesResponse` is imported from `shared/outcomesProjection` (no local redefinition — AGG-02 key-order drift closed by construction).
- `SKIP_AUDIT_PATHS` in `server/auditMiddleware.ts` extended with `/api/outcomes/aggregate`. The Phase 11 awk first-statement ordering invariant (`SKIP_AUDIT_PATHS.has` precedes `rawBody =`) still holds.
- `server/dataApi.ts` saved-search POST + DELETE handlers now call `invalidateByCohort(id)` after mutation, closing the D-09 explicit-invalidation seam.
- `server/index.ts` wires: `initOutcomesAggregateCache(settings)` between `initHashCohortId` and `initAuditDb`, scoped `express.json({limit:'16kb'})` + `compression()` on `/api/outcomes/aggregate` (BEFORE `auditMiddleware` so body is populated for defense-in-depth), and `app.use('/api/outcomes', outcomesAggregateRouter)` (AFTER `authMiddleware`).
- `config/settings.yaml` gained an `outcomes:` block with `serverAggregationThresholdPatients: 1000` and `aggregateCacheTtlMs: 1800000`.
- `server/settingsApi.ts` `validateSettingsSchema` accepts an optional `outcomes` object with numeric-bound field validation (rejects non-numbers, negatives, infinities). D-12: both fields are non-sensitive — no strip required for non-admin GETs.
- Installed `compression@^1.8.1` + `@types/compression@^1.8.1` as dependency/devDep.

## Task Commits

Each task was committed atomically with `--no-verify` per the parallel-executor directive:

1. **Task 1: Install compression + outcomes config + aggregate cache module** — `f648457` (feat)
2. **Task 2a: Add POST /api/outcomes/aggregate handler + skip-list entry** — `b5d9ef5` (feat)
3. **Task 2b: Mount aggregate route + wire dataApi cache invalidation** — `c4a4206` (feat)

**Plan metadata:** pending (orchestrator-committed)

## Files Created

| Path                                   | Lines | Purpose                                                                                          |
| -------------------------------------- | ----- | ------------------------------------------------------------------------------------------------ |
| `server/outcomesAggregateCache.ts`     | 57    | In-memory Map cache: init/get/set/invalidateByCohort/_resetForTesting + TTL from settings        |
| `server/outcomesAggregateApi.ts`       | 305   | Express Router with POST /aggregate: auth, body-validate, cohort-ownership, cache, compute, audit |

## Files Modified

| Path                      | Change                                                                                                                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/auditMiddleware.ts` | Added `'/api/outcomes/aggregate'` to `SKIP_AUDIT_PATHS` (now 2 entries). Ordering invariant preserved.                                                                                              |
| `server/authApi.ts`       | Narrowed `req.params.username` → `String(req.params.username ?? '')` at DELETE /users/:username (L379→L376) and PUT /users/:username/password (L423→L413). Rule 3 — unblocks tsc --noEmit exit 0. |
| `server/dataApi.ts`       | Added `import { invalidateByCohort } from './outcomesAggregateCache.js';`. Called `invalidateByCohort(row.id)` after `addSavedSearch` in POST. Called `invalidateByCohort(String(req.params.id ?? ''))` after `removeSavedSearch` in DELETE. |
| `server/fhirApi.ts`       | Added `export` keyword to `async function getCachedBundles`. Single-word edit, body unchanged.                                                                                                      |
| `server/index.ts`         | Imports `compression`, `outcomesAggregateRouter`, `initOutcomesAggregateCache`. Calls `initOutcomesAggregateCache(settings)` after `initHashCohortId`. Mounts `express.json({limit:'16kb'})` + `compression()` on `/api/outcomes/aggregate` BEFORE `auditMiddleware`. Mounts `app.use('/api/outcomes', outcomesAggregateRouter)` AFTER `authMiddleware`. |
| `server/settingsApi.ts`   | Added optional-outcomes validation block inside `validateSettingsSchema` before `return null`. Validates `outcomes.serverAggregationThresholdPatients` (positive number) + `outcomes.aggregateCacheTtlMs` (non-negative number). Non-admin GET projection untouched (D-12 — fields are non-sensitive). |
| `config/settings.yaml`    | Appended `outcomes:` block with `serverAggregationThresholdPatients: 1000` + `aggregateCacheTtlMs: 1800000`.                                                                                        |
| `package.json`            | +`"compression": "^1.8.1"` in dependencies, +`"@types/compression": "^1.8.1"` in devDependencies.                                                                                                   |
| `package-lock.json`       | Regenerated with new compression dep tree.                                                                                                                                                          |

## Verification Results

```
$ test -f server/outcomesAggregateApi.ts && test -f server/outcomesAggregateCache.ts ; echo "exit=$?"
exit=0                                                                          # ✓ both files exist

$ grep -c "^export function" server/outcomesAggregateCache.ts
5                                                                               # ✓ init + get + set + invalidate + _resetForTesting

$ grep -q "outcomesAggregateRouter" server/index.ts ; echo "exit=$?"
exit=0                                                                          # ✓ router wired

$ grep -q "app.use('/api/outcomes/aggregate', compression())" server/index.ts ; echo "exit=$?"
exit=0                                                                          # ✓ D-15 scoped compression

$ grep -q "app.use('/api/outcomes/aggregate', express.json({ limit: '16kb' }))" server/index.ts ; echo "exit=$?"
exit=0                                                                          # ✓ 16 KiB matches Phase 11 precedent

$ grep -q "import { shapeOutcomesResponse } from '../shared/outcomesProjection" server/outcomesAggregateApi.ts ; echo "exit=$?"
exit=0                                                                          # ✓ single projector imported

$ grep -q "await import" server/outcomesAggregateApi.ts ; echo "exit=$?"
exit=1                                                                          # ✓ 0 matches (all static imports)

$ grep -qE "function shapeResponse|function shapeOutcomesResponse" server/outcomesAggregateApi.ts ; echo "exit=$?"
exit=1                                                                          # ✓ 0 local projector redefinitions

$ grep -q "'/api/outcomes/aggregate'" server/auditMiddleware.ts ; echo "exit=$?"
exit=0                                                                          # ✓ skip-list entry present

$ awk '/SKIP_AUDIT_PATHS.has/{skip=NR} /rawBody =/{body=NR} END{exit !(skip < body)}' server/auditMiddleware.ts ; echo "exit=$?"
exit=0                                                                          # ✓ Phase 11 awk invariant holds (skip-check precedes body capture)

$ grep -qE "JSON\.stringify\([^)]*cohortId\b" server/outcomesAggregateApi.ts ; echo "exit=$?"
exit=1                                                                          # ✓ T-12-04: no raw cohortId in any stringify literal

$ grep -qE 'body\.centers|body\["centers"\]' server/outcomesAggregateApi.ts ; echo "exit=$?"
exit=1                                                                          # ✓ T-12-02: center filter only from req.auth.centers

$ grep -c "invalidateByCohort" server/dataApi.ts
3                                                                               # ✓ 1 import + 2 call sites (POST + DELETE)

$ npx tsc -p tsconfig.server.json --noEmit ; echo "EXIT: $?"
EXIT: 0                                                                         # ✓ server build clean (including the 3 pre-existing authApi errors now fixed)

$ npx tsc -p tsconfig.app.json --noEmit ; echo "EXIT: $?"
EXIT: 0                                                                         # ✓ client build clean

$ npm test -- --run | tail -6
 Test Files  35 passed (35)
      Tests  360 passed (360)                                                   # ✓ full regression suite — 360/360 matches Plan 12-01 close
```

## Threat-Model Invariants (T-12-02, T-12-04, T-12-11 spot-check)

**T-12-02 (Elevation of Privilege — body.centers override):**
```
$ grep -nE "body\.centers|body\[&quot;centers&quot;\]" server/outcomesAggregateApi.ts
(no match)
```
Mitigation locked: handler reads center list only from `req.auth!.centers`.

**T-12-04 (Information Disclosure — raw cohortId in audit row):**
```
$ grep -nE "JSON\.stringify\([^)]*cohortId\b" server/outcomesAggregateApi.ts
(no match)
```
The handler's audit `body:` field uses `cohortHash: hashCohortId(cohortId)` — never a `cohortId:` key. Confirmed by manual inspection of lines 252-260.

**T-12-11 (Tampering — SKIP_AUDIT_PATHS ordering invariant):**
```
$ awk '/SKIP_AUDIT_PATHS.has/{skip=NR} /rawBody =/{body=NR} END{exit !(skip < body)}' server/auditMiddleware.ts
(exits 0)
```
The Phase 11 first-statement invariant holds: `SKIP_AUDIT_PATHS.has(urlPath)` check runs before any body capture, so the two skip-listed paths never have their raw bodies read by the middleware.

## Decisions Made

1. **Inline re-implementation of extractPatientCases + applyFilters + getAge** (305-line handler file). Plan `<interfaces>` block explicitly prescribes this pivot: `src/services/fhirLoader.ts` transitively imports `src/services/authHeaders.ts` (which references `sessionStorage`/`window`), and the server tsconfig compiles with `lib:[ES2023]` (no DOM). TS rejects the import chain even though the Node runtime import succeeds. Reimplementing the ~40-line pure surface against `shared/fhirCodes` + `shared/fhirQueries` + `shared/types/fhir` keeps the server build self-contained and preserves the `src/services/fhirLoader.ts` semantics line-for-line (verified by diff).
2. **Fixed 3 pre-existing tsc narrowing errors in `server/authApi.ts`** (Rule 3). The task acceptance criterion `npx tsc -p tsconfig.server.json --noEmit` requires exit 0, but Plan 12-01 shipped with these 3 pre-existing errors documented in `deferred-items.md` and explicitly flagged Plan 12-02 as the natural fix site. Fix is 2-character mechanical narrowing: `req.params.username` → `String(req.params.username ?? '')` — same pattern already used in `server/dataApi.ts:238`. No behavior change; lines 379 + 423 previously used `req.params.username.toLowerCase()` where the runtime value was always a string but TS typed it as `string | string[]`.
3. **Landed the `getCachedBundles` export in Task 2a instead of Task 2b.** The plan officially assigned this to Task 2b, but Task 2a's tsc check requires the handler file to compile, which requires the static import to resolve. Since both files co-land in this plan (per plan note), the reshuffle keeps each commit tsc-clean and adds no net complexity. Documented in the Task 2b commit body.
4. **Body parser limit 16 KiB, matching Phase 11 precedent** on `/api/audit/events/view-open`. Plan revised this from the research-note's 8 KiB to align both hashed-cohort-id POST routes on a single invariant. Still ~80× the realistic payload (cohortId UUID + 7 flags ≈ 200 bytes).
5. **Single-projector import enforced structurally.** The handler imports `shapeOutcomesResponse` from `shared/outcomesProjection.ts` and never defines a local equivalent. This eliminates AGG-02 JSON.stringify byte-drift between the server path (Plan 12-02) and the parity test (Plan 12-03) by construction — both sides call the same function, so object key order is physically guaranteed to match.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed three pre-existing `server/authApi.ts` tsc narrowing errors**
- **Found during:** Task 1 verification (acceptance criterion: `npx tsc -p tsconfig.server.json --noEmit` exits 0)
- **Issue:** `server/authApi.ts` had 3 `TS2339` errors at lines 379, 387, 423 — `.toLowerCase()` called on Express 5's `req.params.username` which TS narrows to `string | string[]`. These were documented as pre-existing in `.planning/phases/12-server-side-outcomes-pre-aggregation/deferred-items.md` (logged from Plan 12-01 Task 3) and explicitly flagged as a Plan 12-02 candidate ("Plan 12-02 is a good candidate since it will register a new route on the Express stack and is likely to trigger the `tsc -p tsconfig.server.json --noEmit` check again").
- **Fix:** At the two `const target = req.params.username` assignments, changed to `const target = String(req.params.username ?? '')`. The downstream `.toLowerCase()` calls at lines 379, 387, and 423 now receive a guaranteed `string`. Mirrors the existing narrowing convention at `server/dataApi.ts:238` (`String(req.params.id ?? '')`).
- **Files modified:** `server/authApi.ts` (2 line edits)
- **Verification:** `npx tsc -p tsconfig.server.json --noEmit` exits 0 after the fix. Full test suite 360/360 green. No behavior change — the runtime value of `req.params.username` for a single-parameter route is always a string in Express 5.
- **Committed in:** `f648457` (Task 1 commit).

**2. [Rule 3 - Blocking] Inline re-implementation of extractPatientCases + applyFilters + getAge in `server/outcomesAggregateApi.ts`**
- **Found during:** Task 2a handler-compile green step
- **Issue:** The plan's Task 2a action block prescribes `import { applyFilters, extractPatientCases } from '../src/services/fhirLoader.js'`. This file transitively imports `src/services/authHeaders.ts`, which references `sessionStorage` and `window` inside function bodies. `tsconfig.server.json` compiles with `lib: ["ES2023"]` (no DOM) and flags the browser-global references as `TS2304 Cannot find name 'window'` + `TS2552 Cannot find name 'RequestInfo'`. The Node runtime import actually succeeds (verified via `node --import tsx -e "import('./src/services/fhirLoader.ts')"` which returns module keys), but TS compile-time correctness is the acceptance criterion.
- **Fix:** The plan's `<interfaces>` block explicitly anticipated this and documented the pivot: "if it throws on authHeaders, pivot to reimplementing extractPatientCases + applyFilters against shared/fhirQueries inside server/outcomesAggregateApi.ts." I followed this pivot and reimplemented the three helpers (40 lines total) locally in the handler, importing only `LOINC_VISUS`, `LOINC_CRT`, `getLatestObservation` from `shared/`. The semantics are line-for-line equivalent to `src/services/fhirLoader.ts`'s exports (diff-verified) — this is a build-layer change, not a behavior change. AGG-02 byte parity is not affected because `computeCohortTrajectory` still operates on the same `PatientCase[]` shape and `shapeOutcomesResponse` is still the single projector.
- **Files modified:** `server/outcomesAggregateApi.ts`
- **Verification:** `tsc -p tsconfig.server.json --noEmit` exits 0. Existing tests 360/360 green.
- **Committed in:** `b5d9ef5` (Task 2a commit).

**3. [Rule 3 - Blocking] Moved `getCachedBundles` export from Task 2b to Task 2a commit**
- **Found during:** Task 2a handler-compile green step
- **Issue:** Plan 12-02 Task 2b.a instructs to add `export` to `getCachedBundles` in `server/fhirApi.ts`. Task 2a's new handler statically imports it. If I kept the plan's literal task split, Task 2a's tsc check would fail (missing export) and I'd need to stage Task 2b's action to land that task-atomic commit. Plan note acknowledges both files co-land in this plan.
- **Fix:** Applied the one-word edit (add `export` keyword) as part of Task 2a's atomic commit. Task 2b retained its two other prescribed actions (dataApi hooks + index.ts mount). No net change in the plan outputs, just a task-ordering adjustment to keep every commit tsc-clean.
- **Files modified:** `server/fhirApi.ts` (Task 2a commit).
- **Committed in:** `b5d9ef5` (Task 2a commit); documented explicitly in the Task 2b commit message.

### Out-of-scope items (logged to deferred-items.md — closed this plan)

The 3 pre-existing `server/authApi.ts` tsc errors logged in `deferred-items.md` at the end of Plan 12-01 are **closed by this plan** (fixed under Rule 3 — blocking). `deferred-items.md` may be updated to reflect the closure if a future plan needs it; leaving the historical entry in place is non-blocking.

### Threat Flags

None — the handler introduces exactly the threat surface enumerated in the plan's `<threat_model>` and the mitigations listed there (T-12-01 through T-12-11) are all applied or explicitly accepted. No new network endpoints, auth paths, file access patterns, or schema changes were introduced beyond the single prescribed `POST /api/outcomes/aggregate` route.

---

**Total deviations:** 3 auto-fixed (Rule 3 — blocking), 0 scope changes.
**Impact on plan:** The deviations are mechanical (narrowing, reimplement, commit ordering) and do not alter any public API, acceptance criterion, or downstream plan input. Plan 12-03 (test suite) and Plan 12-04 (client routing) consume the same surface the plan promised.

## Issues Encountered

- `src/services/fhirLoader.ts` could not be directly imported by the server handler because of its transitive `authHeaders.ts` → `sessionStorage/window` chain. The plan's `<interfaces>` block anticipated this and the reimplementation pivot was applied (see Deviation #2 above).
- The 3 pre-existing `server/authApi.ts` tsc errors were resolved under Rule 3 (Deviation #1). These had been logged in `deferred-items.md` during Plan 12-01 and explicitly flagged as a Plan 12-02 candidate — closure here is in-scope per the deferred-items log.

## User Setup Required

None. `compression` + `@types/compression` were installed autonomously; no external service configuration, no new secrets, no dashboard steps.

## Next Phase Readiness

- **Plan 12-03 (test suite — runs in parallel Wave 2):** Ready. Tests can `import { shapeOutcomesResponse } from '../shared/outcomesProjection'` (the SAME function the server handler calls) to build expected responses, guaranteeing byte parity. The live endpoint is mounted at `POST /api/outcomes/aggregate` with the D-02 body shape, D-03 response shape, and observable `meta.cacheHit` signal for AGG-04 verification.
- **Plan 12-04 (client routing — Wave 3):** Ready. The client can `fetch POST /api/outcomes/aggregate` with the documented body and expect `{median, iqrLow, iqrHigh, perPatient?, scatter?, meta}` back through compression. `settings.outcomes.serverAggregationThresholdPatients` is exposed to non-admin GET /api/settings unchanged.
- **Blocker for the next plan:** None. Both server and app tsc --noEmit exit 0; full test suite is green at 360/360.

## Self-Check: PASSED

- [x] `server/outcomesAggregateApi.ts` — FOUND (305 lines)
- [x] `server/outcomesAggregateCache.ts` — FOUND (57 lines, 5 exports)
- [x] `.planning/phases/12-server-side-outcomes-pre-aggregation/12-02-SUMMARY.md` — FOUND (this file)
- [x] Commit `f648457` (Task 1) — FOUND in git log
- [x] Commit `b5d9ef5` (Task 2a) — FOUND in git log
- [x] Commit `c4a4206` (Task 2b) — FOUND in git log
- [x] `npx tsc -p tsconfig.server.json --noEmit` exits 0 — VERIFIED
- [x] `npx tsc -p tsconfig.app.json --noEmit` exits 0 — VERIFIED
- [x] Full test suite 360/360 green — VERIFIED
- [x] All 13 phase-local verification greps pass — VERIFIED

---
*Phase: 12-server-side-outcomes-pre-aggregation*
*Plan: 02*
*Completed: 2026-04-16*
