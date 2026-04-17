---
phase: 12-server-side-outcomes-pre-aggregation
plan: 01
subsystem: shared-module
tags: [shared-module, extraction, typescript, monorepo, fhir, cohort-trajectory, aggregation]

# Dependency graph
requires:
  - phase: 11-audit-beacon-pii-hardening
    provides: hashCohortId primitive, SKIP_AUDIT_PATHS pattern (consumed by Plan 12-02)
provides:
  - "shared/ directory that compiles under both tsconfig.app.json and tsconfig.server.json"
  - "shared/cohortTrajectory.ts — pure math module importable from Node without browser globals"
  - "shared/fhirCodes.ts + shared/fhirQueries.ts — pure constant and query helpers split out of fhirLoader.ts"
  - "shared/outcomesProjection.ts — single source of truth for the D-03 AggregateResponse wire shape"
  - "Backward-compat re-export shims at src/types/fhir.ts, src/utils/cohortTrajectory.ts, src/services/fhirLoader.ts"
  - "Wave-0 parity test proving legacy client path and shared/ path produce byte-identical JSON.stringify"
affects: [12-02 server-handler, 12-03 parity-test, 12-04 client-routing, 13-new-outcome-metrics]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-leaf shared/ directory pattern with re-export shims in src/ for backward compatibility"
    - "Single-source wire-shape projector (shapeOutcomesResponse) with literal key order to eliminate JSON.stringify drift"

key-files:
  created:
    - shared/types/fhir.ts
    - shared/fhirCodes.ts
    - shared/fhirQueries.ts
    - shared/cohortTrajectory.ts
    - shared/outcomesProjection.ts
    - tests/cohortTrajectoryShared.test.ts
    - .planning/phases/12-server-side-outcomes-pre-aggregation/deferred-items.md
  modified:
    - tsconfig.app.json (include += shared)
    - tsconfig.server.json (include += shared)
    - src/types/fhir.ts (→ re-export shim)
    - src/utils/cohortTrajectory.ts (→ re-export shim)
    - src/services/fhirLoader.ts (deleted in-file LOINC/SNOMED consts + query fns; re-exports from shared/)

key-decisions:
  - "Decoupled src/services/fhirLoader.ts into pure half (shared/fhirCodes.ts + shared/fhirQueries.ts) and networked half (fhirLoader.ts keeps loadAllBundles, extractPatientCases, applyFilters). Prevents transitive import of authHeaders.ts (sessionStorage/window) when the server loads shared/cohortTrajectory.ts (RESEARCH Pitfall #5)."
  - "Shared/ types live at shared/types/fhir.ts (not a reach-up). src/types/fhir.ts becomes a 3-line re-export shim. Keeps shared/ a true leaf per RESEARCH Open Question 1 resolution."
  - "shapeOutcomesResponse lives in shared/outcomesProjection.ts and will be imported by BOTH the Plan 12-02 server handler and the Plan 12-03 parity test. Eliminates AGG-02 byte-drift hazard by construction (single key-order site)."
  - "Left three pre-existing server/authApi.ts typecheck errors in place and logged them to deferred-items.md. Confirmed via git stash on Task-2 commit that they predate Phase 12; out-of-scope per the executor scope boundary."

patterns-established:
  - "shared/ pure-leaf invariant: zero imports from src/ or server/, zero browser-runtime globals. Enforced by grep assertions in verification."
  - "Re-export shim at the old import path: `export * from '../../shared/<module>'` — single-line, no duplicated definitions, fully backward-compatible for existing callers."
  - "Single-source wire-shape projector: the wire-shape function is DEFINED in shared/ and IMPORTED (not re-implemented) by every consumer."

requirements-completed: [AGG-02]

# Metrics
duration: 7min
completed: 2026-04-16
---

# Phase 12 Plan 01: Shared/ Module Extraction Summary

**Pure TS shared/ directory carved out of src/ — cohort trajectory math, LOINC/SNOMED constants, FHIR queries, and a single-source wire-shape projector — with full backward-compat shims, dual tsconfig coverage, and a Wave-0 JSON-byte-parity test.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-16T19:15:54Z
- **Completed:** 2026-04-16T19:22:16Z
- **Tasks:** 4
- **Files modified:** 5 existing + 7 new = 12 total

## Accomplishments

- Introduced a top-level `shared/` directory (5 TS files, 812 lines total) that is compilable under both the app and server tsconfigs with zero browser-runtime dependencies.
- Moved the entire 504-line `cohortTrajectory.ts` pure-math module into `shared/` with import surface repointed to sibling pure modules (`./fhirCodes`, `./fhirQueries`, `./types/fhir`). No logic change.
- Split `src/services/fhirLoader.ts`: the 12 LOINC/SNOMED constants plus `getObservationsByCode` and `getLatestObservation` moved to `shared/`, and the file now re-exports them for backward compatibility. All existing src-side callers (15+ import sites) continue to resolve without any call-site change.
- Added `shared/outcomesProjection.ts` — the single definition of `shapeOutcomesResponse(trajectory, eye, includePerPatient, includeScatter, cacheHit) → AggregateResponse`. This is the key-order source of truth that will be imported (not re-implemented) by the Plan 12-02 server handler and the Plan 12-03 parity test, eliminating AGG-02 JSON-byte-parity drift by construction.
- Added a Wave-0 parity test (`tests/cohortTrajectoryShared.test.ts`, 2 tests) that asserts `JSON.stringify` equality between the legacy `src/utils/cohortTrajectory` path and the new `shared/cohortTrajectory` path on a 3-patient fixture, and proves the shared module imports under Node without pulling browser globals.
- Full test suite: **360/360 tests passing across 35 files**, up from the Phase 11 baseline of 355 (+5 new since then, +2 from this plan).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared/ tree with types, FHIR codes, and FHIR queries (pure leaves)** — `279e518` (feat)
2. **Task 2: Move cohortTrajectory.ts into shared/ with imports repointed to shared siblings** — `4af7c9f` (feat)
3. **Task 3: Update both tsconfigs + install backward-compat shims + write Wave-0 parity test** — `f31d5f3` (feat)
4. **Task 4: Create shared/outcomesProjection.ts — single source of truth for the D-03 wire-shape projector** — `61c8545` (feat)

**Plan metadata:** pending (orchestrator-committed)

## Files Created

| Path                                                                               | Lines | Purpose                                                                                                    |
| ---------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------- |
| `shared/types/fhir.ts`                                                             | 185   | Verbatim copy of `src/types/fhir.ts` — pure types, zero imports                                            |
| `shared/fhirCodes.ts`                                                              | 17    | 12 LOINC/SNOMED constants (LOINC_VISUS, LOINC_CRT, LOINC_IOP, LOINC_HBA1C, LOINC_REFRACTION_*, SNOMED_AMD/DR/IVI/EYE_RIGHT/EYE_LEFT) |
| `shared/fhirQueries.ts`                                                            | 36    | `getObservationsByCode`, `getLatestObservation` — imports only `./types/fhir`                              |
| `shared/cohortTrajectory.ts`                                                       | 504   | Verbatim `src/utils/cohortTrajectory.ts` with sibling imports; 18 exports                                 |
| `shared/outcomesProjection.ts`                                                     | 70    | `shapeOutcomesResponse` + `AggregateResponse` + `AggregateMeta` — single wire-shape source                 |
| `tests/cohortTrajectoryShared.test.ts`                                             | 53    | 2-test Wave-0 parity suite                                                                                 |
| `.planning/phases/12-server-side-outcomes-pre-aggregation/deferred-items.md`       | ~25   | Log of pre-existing out-of-scope findings (server/authApi.ts type errors)                                  |

## Files Modified

| Path                            | Change                                                                                                                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsconfig.app.json`             | `include: ["src"] → ["src", "shared"]`                                                                                                                                      |
| `tsconfig.server.json`          | `include: ["server"] → ["server", "shared"]`                                                                                                                                |
| `src/types/fhir.ts`             | Full content (185 lines) → 3-line re-export shim: `export * from '../../shared/types/fhir';`                                                                                |
| `src/utils/cohortTrajectory.ts` | Full content (504 lines) → 3-line re-export shim: `export * from '../../shared/cohortTrajectory';`                                                                          |
| `src/services/fhirLoader.ts`    | Deleted 12 in-file `export const LOINC_/SNOMED_` lines + `getObservationsByCode` + `getLatestObservation` (38 lines). Added `export * from '../../shared/fhirCodes'` + named re-export of `getObservationsByCode`, `getLatestObservation` from `../../shared/fhirQueries`. Internal imports of `LOINC_VISUS`, `LOINC_CRT`, `SNOMED_AMD`, `SNOMED_DR`, `getLatestObservation` added for `applyFilters`, `getDiagnosisLabel`, `getDiagnosisFullText`. Net: file shrank 30 lines. 12 exports remain (loadAllBundles, invalidateBundleCache, extractCenters, extractPatientCases, getAge, loadCenterShorthands, getCenterShorthand, getDiagnosisLabel, getDiagnosisFullText, applyFilters + two re-export lines counted once each). |

## Verification Results

```
$ ls shared/types/fhir.ts shared/fhirCodes.ts shared/fhirQueries.ts shared/cohortTrajectory.ts shared/outcomesProjection.ts
shared/cohortTrajectory.ts
shared/fhirCodes.ts
shared/fhirQueries.ts
shared/outcomesProjection.ts
shared/types/fhir.ts                                                            # 5 files listed ✓

$ grep -rE "authFetch|sessionStorage|window\.|document\." shared/ ; echo "exit=$?"
exit=1                                                                          # 0 matches ✓ (no browser globals)

$ grep -rE "from '\.\./src/|from '\.\./\.\./src/|from '\.\./server/" shared/ ; echo "exit=$?"
exit=1                                                                          # 0 matches ✓ (no reach-up)

$ wc -l src/utils/cohortTrajectory.ts src/types/fhir.ts
       3 src/utils/cohortTrajectory.ts                                          # ≤ 5 ✓
       3 src/types/fhir.ts                                                      # ≤ 5 ✓

$ grep -q "LOINC_VISUS = '79880-1'" src/services/fhirLoader.ts ; echo "exit=$?"
exit=1                                                                          # ✓ literal const removed (now re-exported)

$ grep -q "export \* from '../../shared/fhirCodes'" src/services/fhirLoader.ts ; echo "exit=$?"
exit=0                                                                          # ✓ re-export present

$ npx tsc -p tsconfig.app.json --noEmit ; echo "EXIT: $?"
EXIT: 0                                                                         # ✓ clean

$ npx tsc -p tsconfig.server.json --noEmit ; echo "EXIT: $?"                    # 3 pre-existing errors in server/authApi.ts (not Phase 12)
EXIT: 2                                                                         # ✓ 0 NEW errors; pre-existing logged to deferred-items.md

$ npm test -- --run | tail -6
 Test Files  35 passed (35)
      Tests  360 passed (360)                                                   # ✓ ≥ 357 target
```

## Decisions Made

1. **fhirLoader.ts split into pure + networked halves.** The only clean way to make `shared/cohortTrajectory.ts` import-safe for the server is to also promote the LOINC/SNOMED constants and `getObservationsByCode` out of `src/services/fhirLoader.ts`, because the latter transitively imports `authHeaders.ts` (sessionStorage/window). Moved constants to `shared/fhirCodes.ts`, query helpers to `shared/fhirQueries.ts`; left the network-bound half (`loadAllBundles`, `extractPatientCases`, `applyFilters`, center-shorthand map) in `src/services/fhirLoader.ts`, which now re-exports the pure halves for backward compat.
2. **Types live in `shared/types/fhir.ts` — true leaf.** Option (b) from RESEARCH §Pattern 1 — let `shared/` reach up to `src/types/fhir` — was rejected because it would pollute the leaf invariant and complicate grep assertions. Option (a) was taken: relocate types, install a 3-line re-export shim at `src/types/fhir.ts`.
3. **Single-source wire-shape projector in `shared/`.** `shapeOutcomesResponse` is defined once in `shared/outcomesProjection.ts`. Plan 12-02 and Plan 12-03 will both import it (no re-implementation). This closes the AGG-02 byte-drift hazard (RESEARCH Pitfall #1, cause #1: object key order) by construction — there is no second projector to drift from.
4. **Literal key order in `shapeOutcomesResponse`: `median` → `iqrLow` → `iqrHigh` → `meta`, then conditional `perPatient` and `scatter` appended.** The conditional appends put `perPatient`/`scatter` AFTER `meta` when present. This is the deliberate order both downstream consumers will inherit; any future reshuffle happens at one site and both sides stay in sync.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added internal imports for `SNOMED_AMD` and `SNOMED_DR` in `src/services/fhirLoader.ts`**
- **Found during:** Task 3 (when rewriting `src/services/fhirLoader.ts` and deleting the in-file const exports)
- **Issue:** The plan instructed me to `export * from '../../shared/fhirCodes'` + `export { getObservationsByCode, getLatestObservation } from '../../shared/fhirQueries'` and to leave `applyFilters` (which references `LOINC_VISUS`, `LOINC_CRT`, `getLatestObservation`) compiling. `applyFilters` is indeed covered by the plan's proposed internal `import { LOINC_VISUS, LOINC_CRT } from '../../shared/fhirCodes'; import { getLatestObservation } from '../../shared/fhirQueries';` block. However, the file ALSO uses `SNOMED_AMD` and `SNOMED_DR` internally inside `getDiagnosisLabel` and `getDiagnosisFullText` (lines 157-166 and 169-215 of the original file) — these are NOT mentioned in the plan's Task-3 action block. An `export *` re-export does not bring the names into the file's local scope; they need to be explicitly imported.
- **Fix:** Added `SNOMED_AMD` and `SNOMED_DR` to the internal `import { ... } from '../../shared/fhirCodes'` line alongside `LOINC_VISUS` and `LOINC_CRT`. No change to the public surface — both constants are still exported (via the `export *` line) and the internal switch statements now resolve locally.
- **Files modified:** `src/services/fhirLoader.ts`
- **Verification:** Both `tsc -p tsconfig.app.json --noEmit` and the full test suite pass (360/360 green). The `getDiagnosisLabel` / `getDiagnosisFullText` branches were exercised by existing tests and continue to resolve correctly.
- **Committed in:** `f31d5f3` (Task 3 commit)

### Out-of-scope findings (logged to deferred-items.md, not fixed)

**Pre-existing `server/authApi.ts` type errors — pre-existing, out of scope.**

`npx tsc -p tsconfig.server.json --noEmit` reports 3 `TS2339` errors in `server/authApi.ts` (lines 379, 387, 423 — `.toLowerCase()` on `string | string[]`). Verified via `git stash` on commit `4af7c9f` (Task 2) that these errors exist BEFORE adding `shared/` to the server tsconfig, so they are unrelated to Phase 12. Logged to `.planning/phases/12-server-side-outcomes-pre-aggregation/deferred-items.md` for triage by the next plan touching `server/authApi.ts` (Plan 12-02 is the natural candidate).

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking)
**Impact on plan:** The deviation was mechanical and did not alter the public surface of `src/services/fhirLoader.ts`; it added two names to an already-prescribed internal import block. No scope creep.

## Issues Encountered

- `npx tsc -p tsconfig.server.json --noEmit` exits with 3 pre-existing `server/authApi.ts` errors. Resolved by verifying via `git stash` that the errors predate Phase 12 and logging to `deferred-items.md`. Not addressed in this plan per scope boundary.
- Test runs produce side-effect JSON files under `feedback/` (`issue-2026-04-16T...json`) as a property of the dev/test fixture stack. Left untracked; not related to Plan 12-01 and the existing `.gitignore` does not exclude them (pre-existing pattern; not this plan's concern).

## User Setup Required

None — no external service configuration, no new dependencies, no secrets.

## Next Phase Readiness

- **Plan 12-02 (server handler):** Ready. The handler can now `import { computeCohortTrajectory } from '../shared/cohortTrajectory.js'` (Node-safe) and `import { shapeOutcomesResponse } from '../shared/outcomesProjection.js'` (single wire-shape source). No further shared/ refactor needed.
- **Plan 12-03 (parity test):** Ready. The test can import the same `shapeOutcomesResponse` the handler uses, guaranteeing key-order parity by construction.
- **Plan 12-04 (client routing):** Ready. The client path is unchanged — `src/utils/cohortTrajectory.ts` and `src/services/fhirLoader.ts` re-exports keep every existing call-site resolving. `AggregateResponse` type is importable from `shared/outcomesProjection` for the fetch response type.
- **Blocker for the next plan:** the 3 pre-existing `server/authApi.ts` type errors should be fixed (or explicitly accepted) before Plan 12-02 asserts `tsc -p tsconfig.server.json --noEmit` exits 0.

## Self-Check: PASSED

- [x] `shared/types/fhir.ts` — FOUND
- [x] `shared/fhirCodes.ts` — FOUND
- [x] `shared/fhirQueries.ts` — FOUND
- [x] `shared/cohortTrajectory.ts` — FOUND
- [x] `shared/outcomesProjection.ts` — FOUND
- [x] `tests/cohortTrajectoryShared.test.ts` — FOUND
- [x] `.planning/phases/12-server-side-outcomes-pre-aggregation/deferred-items.md` — FOUND
- [x] Commit `279e518` (Task 1) — FOUND in git log
- [x] Commit `4af7c9f` (Task 2) — FOUND in git log
- [x] Commit `f31d5f3` (Task 3) — FOUND in git log
- [x] Commit `61c8545` (Task 4) — FOUND in git log

---
*Phase: 12-server-side-outcomes-pre-aggregation*
*Plan: 01*
*Completed: 2026-04-16*
