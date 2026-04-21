---
phase: 14-security-quick-wins-performance
plan: 01
subsystem: auth
tags: [jwt, security, algorithm-pin, cohort-hash, crypto, hs256]

# Dependency graph
requires:
  - phase: 11-audit-pii-hardening
    provides: hashCohortId HMAC primitive used and extended here
  - phase: 2-auth
    provides: JWT auth middleware and local verify call sites being pinned
provides:
  - JWT algorithm pin (HS256) on all local verify call sites — closes algorithm-confusion attack window
  - Auto-generated cohort-hash-secret.txt (mode 0o600, 64 hex chars) on fresh deployment
  - Settings fallback path for existing deployments (backward compat)
affects: [server-auth, audit-logging, all-test-files-using-initHashCohortId]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "File-first secret management: check file, fall back to settings, auto-generate if both absent (replicated from initAuth.ts jwt-secret.txt pattern)"
    - "Explicit algorithm pin: { algorithms: ['HS256'] } as third argument to jwt.verify()"

key-files:
  created: []
  modified:
    - server/authMiddleware.ts
    - server/authApi.ts
    - server/hashCohortId.ts
    - server/index.ts
    - tests/authMiddlewareLocal.test.ts
    - tests/hashCohortId.test.ts
    - tests/outcomesAggregateAudit.test.ts
    - tests/auditApi.test.ts
    - tests/outcomesAggregateParity.test.ts
    - tests/outcomesAggregateApi.test.ts

key-decisions:
  - "Settings fallback retained for backward compat: existing deployments with cohortHashSecret in settings.yaml continue to work without creating a file"
  - "Auto-generate path does NOT throw: fresh deployments get a secure auto-generated secret instead of a fatal startup error"
  - "File-first priority: data/cohort-hash-secret.txt always wins over settings.yaml value once created"
  - "dev placeholder detection: console.warn (not throw) if active secret matches known placeholder"

patterns-established:
  - "File-first secret management: file check -> settings fallback -> auto-generate + write with mode 0o600"
  - "Algorithm-pinned jwt.verify: always pass { algorithms: ['HS256'] } to local verify calls"

requirements-completed: [SEC-01, SEC-02]

# Metrics
duration: 4min
completed: 2026-04-17
---

# Phase 14 Plan 01: JWT Algorithm Pin & Cohort Hash Secret Auto-Generation Summary

**JWT algorithm pinned to HS256 on both local verify call sites; cohort hash secret now auto-generates to `data/cohort-hash-secret.txt` (mode 0o600) on fresh deployment, with settings fallback for existing deployments**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-17T10:17:40Z
- **Completed:** 2026-04-17T10:22:10Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- SEC-01: Pinned `{ algorithms: ['HS256'] }` in `verifyLocalToken` (authMiddleware.ts:59) and `/verify` challenge handler (authApi.ts:181); Keycloak RS256 path unchanged
- SEC-02: Refactored `initHashCohortId` from single-arg (throw-on-missing) to `(dataDir, settings)` with file-first, settings fallback, and auto-generate behaviors; writes `data/cohort-hash-secret.txt` with mode 0o600
- Added 2 new rejection tests to authMiddlewareLocal.test.ts (RS256 token and alg:none token both return 401)
- Added 3 new tests to hashCohortId.test.ts (auto-generation, file-first priority, settings fallback); updated all 7 existing tests to pass tmpDir as first arg
- 438 tests passing (up from 430), all 5 skipped are pre-existing skips

## Task Commits

Each task was committed atomically:

1. **Task 1: Pin JWT algorithm to HS256 on two unpinned verify call sites (SEC-01)** - `78233e4` (feat)
2. **Task 2: Auto-generate cohortHashSecret file at startup (SEC-02)** - `6bc57dd` (feat)
3. **Deviation fix: update 4 other test files to new signature** - `90b650e` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `server/authMiddleware.ts` - Added `{ algorithms: ['HS256'] }` to verifyLocalToken jwt.verify call (line 59)
- `server/authApi.ts` - Added `{ algorithms: ['HS256'] }` to /verify challenge token verify (line 181)
- `server/hashCohortId.ts` - New signature `initHashCohortId(dataDir, settings)` with file-first secret management, auto-generation, mode 0o600 write, dev-placeholder warning
- `server/index.ts` - Updated call site to `initHashCohortId(DATA_DIR, settings)`
- `tests/authMiddlewareLocal.test.ts` - Added 2 new SEC-01 rejection tests (RS256 and alg:none)
- `tests/hashCohortId.test.ts` - Updated all 7 existing tests + 3 new tests for SEC-02 behaviors
- `tests/outcomesAggregateAudit.test.ts` - Updated initHashCohortId call to pass tmpDir
- `tests/auditApi.test.ts` - Updated initHashCohortId call to pass tmpDir
- `tests/outcomesAggregateParity.test.ts` - Updated initHashCohortId call to pass tmpDir
- `tests/outcomesAggregateApi.test.ts` - Updated initHashCohortId call to pass tmpDir

## Decisions Made

- Settings fallback retained for backward compatibility: existing deployments with `cohortHashSecret` in `settings.yaml` continue working without needing to create a file first
- Auto-generate path does not throw: fresh deployments get a secure 64-hex-char secret automatically instead of a fatal startup error
- File-first priority is absolute: `data/cohort-hash-secret.txt` always wins over the settings value once it exists
- dev placeholder detection: `console.warn` (not `throw`) if the active secret equals the known dev placeholder — guides operators without blocking startup

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated 4 additional test files calling initHashCohortId with old single-arg signature**
- **Found during:** Final `npm test` run after Task 2
- **Issue:** Signature change from `initHashCohortId(settings)` to `initHashCohortId(dataDir, settings)` broke 4 other test files: `outcomesAggregateAudit.test.ts`, `auditApi.test.ts`, `outcomesAggregateParity.test.ts`, `outcomesAggregateApi.test.ts`
- **Fix:** Each file already had `tmpDir` in scope (from `fs.mkdtempSync`). Added `tmpDir` as first argument to all 4 call sites.
- **Files modified:** 4 test files listed above
- **Verification:** `npm test` passes with 438 tests green
- **Committed in:** `90b650e`

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Necessary correctness fix. The plan described updating all 7 `hashCohortId.test.ts` tests but did not mention the 4 other test files also importing `initHashCohortId`. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. `data/cohort-hash-secret.txt` is auto-created on first server startup.

## Next Phase Readiness

- SEC-01 and SEC-02 complete; JWT algorithm confusion attack window closed; cohort hash secret auto-generated on fresh deployment
- 438/438 tests passing (5 pre-existing skips)
- Ready for 14-02 (if not already executed) or next plan in Phase 14

---

## Self-Check

Key files:
- [ ] server/authMiddleware.ts — contains `algorithms: ['HS256']` at line 59: FOUND
- [ ] server/authApi.ts — contains `algorithms: ['HS256']` at line 181: FOUND
- [ ] server/hashCohortId.ts — contains `cohort-hash-secret.txt` and `mode: 0o600`: FOUND
- [ ] server/index.ts — contains `initHashCohortId(DATA_DIR, settings)`: FOUND

Commits:
- 78233e4: feat(14-01) JWT algorithm pin — FOUND
- 6bc57dd: feat(14-01) cohort hash auto-gen — FOUND
- 90b650e: fix(14-01) call site fixes — FOUND

## Self-Check: PASSED

---
*Phase: 14-security-quick-wins-performance*
*Completed: 2026-04-17*
