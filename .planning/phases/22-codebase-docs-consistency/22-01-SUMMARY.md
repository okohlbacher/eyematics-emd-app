---
phase: 22-codebase-docs-consistency
plan: "01"
subsystem: codebase-quality
tags: [refactor, dedup, async-await, pattern-alignment, D-04, D-06, D-15, D-16, D-17]
requires: []
provides:
  - "7 Phase 12 shim files audited and dispositioned per D-06 (all retained with concrete-reason `// retained:` comments)"
  - "Zero `.then(` chains in the 7 CONSIST-02 target files + repo-wide baseline"
  - "Canonical async/await pattern established (inner-async IIFE for effects, void-IIFE for fire-and-forget)"
  - "Result-type audit (D-16): 0 occurrences confirmed; D-03 satisfied retroactively"
  - "Naming confirmation-pass (D-17): 0 TS-identifier violations; D-05 exempt wire strings documented"
affects:
  - "src/context/DataContext.tsx (fetchData Promise.all chain → async IIFE)"
  - "src/context/AuthContext.tsx (displayName useEffect → inner-async + cancelled guard)"
  - "src/components/outcomes/OutcomesView.tsx (3 .then sites: loadSettings, audit beacon, Promise.all server aggregate)"
  - "src/pages/LoginPage.tsx (auth-config fetch useEffect)"
  - "src/pages/AdminPage.tsx (centers fetch useEffect)"
  - "src/pages/SettingsPage.tsx (3 .then sites collapsed into single mount IIFE)"
  - "server/index.ts (cache-warm nested-.then → void-IIFE)"
  - "src/utils/cohortTrajectory.ts (+ `// retained:` comment)"
  - "src/services/fhirLoader.ts (+ `// retained:` comment)"
  - "src/types/fhir.ts (+ `// retained:` comment)"
  - "src/components/outcomes/OutcomesPanel.tsx (+ `// retained:` disposition)"
  - "src/services/outcomesAggregateService.ts (+ `// retained:` disposition)"
  - "server/hashCohortId.ts (+ `// retained:` disposition)"
  - "server/outcomesAggregateApi.ts (+ `// retained:` disposition)"
tech-stack:
  added: []
  patterns:
    - "Inner-async IIFE inside useEffect with `cancelled` guard + cleanup (Pitfall 2 safe)"
    - "void-IIFE for fire-and-forget (audit beacon, server index cache warm)"
    - "Promise.all retained as orchestration primitive per D-04 explicit exception"
    - "`// retained: <concrete reason>` comments on all non-delete shim dispositions per D-06"
key-files:
  created: []
  modified:
    - src/utils/cohortTrajectory.ts
    - src/services/fhirLoader.ts
    - src/types/fhir.ts
    - src/components/outcomes/OutcomesPanel.tsx
    - src/services/outcomesAggregateService.ts
    - server/hashCohortId.ts
    - server/outcomesAggregateApi.ts
    - src/context/DataContext.tsx
    - src/context/AuthContext.tsx
    - src/components/outcomes/OutcomesView.tsx
    - src/pages/LoginPage.tsx
    - src/pages/AdminPage.tsx
    - src/pages/SettingsPage.tsx
    - server/index.ts
decisions:
  - "All 7 Phase 12 shim files retained with `// retained:` comments rather than deleted. Ground: 3 of 7 (`utils/cohortTrajectory`, `types/fhir`, `fhirLoader`) have 17–30+ callers plus test `vi.mock` mock-path strings and the Phase-12 parity test `cohortTrajectoryShared.test.ts` that deliberately imports through the shim; deletion would cascade through mock paths + delete a parity-test contract. The other 4 (`OutcomesPanel.tsx`, `outcomesAggregateService.ts`, `hashCohortId.ts`, `outcomesAggregateApi.ts`) are not re-export shims at all per D-15 reality check — they are live modules miscatalogued by 22-RESEARCH."
  - "Fire-and-forget sites converted to `void (async () => { ... })()` IIFE (audit beacon, server cache warm) rather than retained `.then` — cleaner single pattern, removes the last repo-wide `.then` sites, matches D-04 intent."
  - "Result-type audit (D-16) ran empty-handed; no migration scaffolding needed. D-03 invariant holds retroactively."
  - "Naming confirmation-pass (D-17) ran empty-handed; no TS-identifier snake_case violations. D-05 remains a confirmation pass, not a rewrite pass."
metrics:
  duration: ~7 min
  completed: 2026-04-23
---

# Phase 22 Plan 01: Dedup + Pattern Alignment Summary

Dedup shim audit completed for all 7 Phase 12 targets (all retained with concrete-reason `// retained:` comments per D-06/D-15), and all 15 identified `.then(` chains across the 7 CONSIST-02 files converted to async/await (IIFE-with-cancelled-guard inside effects, void-IIFE for fire-and-forget) per D-04 — 608/608 tests and `npm run build` green after every atomic commit.

## Phase 12 Shim Audit (Task 1, D-06 + D-15)

Each of the 7 shim candidates from 22-RESEARCH was diffed against its canonical source and static/dynamic importers enumerated. Dispositions:

| File | Disposition | Concrete reason |
|------|-------------|-----------------|
| `src/utils/cohortTrajectory.ts` | RETAIN | Pure 3-line re-export shim, but 17 direct callers + `tests/cohortTrajectoryShared.test.ts` (Phase 12 parity test that compares shim to shared for byte-identical JSON). Deletion would break the parity contract and churn ~10 test `vi.mock` path strings. |
| `src/services/fhirLoader.ts` | RETAIN | Not a pure shim — live module (`loadAllBundles`, `extractCenters`, `loadCenterShorthands`, `getDiagnosisLabel`, `getDiagnosisFullText`) that also re-exports stable helpers from shared/. Colocation is the current convention. |
| `src/types/fhir.ts` | RETAIN | Pure re-export shim with 30+ direct callers across `src/`. Convention (see `16-03-SUMMARY.md`) is that `src/` imports types via this shim; shared/ modules import from `./types/fhir.js` directly. |
| `src/components/outcomes/OutcomesPanel.tsx` | RETAIN (not a shim) | Live React chart component. Per D-15 reality check, this is NOT a dedup target — 22-RESEARCH miscatalogued it. Added disposition comment. |
| `src/services/outcomesAggregateService.ts` | RETAIN (not a shim) | Live client wrapper for `POST /api/outcomes/aggregate`. Per D-15, not a dedup target. Added disposition comment. |
| `server/hashCohortId.ts` | RETAIN (not a shim) | Live server-only module (settings init + HMAC compute). Module-local `_secret` state required. Per D-15, not a dedup target. Added disposition comment. |
| `server/outcomesAggregateApi.ts` | RETAIN (not a shim) | Live Express router for `POST /api/outcomes/aggregate` plus body validation + audit writes. Per D-15, not a dedup target. Added disposition comment. |

**Net result:** 0 shims deleted, 7 shims documented. Aligns with D-15 ("do not manufacture duplication"). Every `// retained:` comment carries a concrete reason — no generic "legacy" strings (D-06 guard satisfied).

Verification:

```text
$ grep -rn "// retained:" src/utils/cohortTrajectory.ts src/services/fhirLoader.ts src/types/fhir.ts \
    src/components/outcomes/OutcomesPanel.tsx src/services/outcomesAggregateService.ts \
    server/hashCohortId.ts server/outcomesAggregateApi.ts | wc -l
7
```

## `.then(` Chain Rewrites (Task 2, D-04)

Baseline (pre-plan): 15 `.then(` occurrences across 7 files (22-RESEARCH grep).

Per-file disposition:

| File | Before | After | Sites retained | Pattern applied |
|------|--------|-------|----------------|------------------|
| `src/context/DataContext.tsx` | 1 (Promise.all().then().catch() in `fetchData`) | 0 | 0 | Promise.all retained, chain → try/catch in void-IIFE |
| `src/context/AuthContext.tsx` | 2 (display-name useEffect chain) | 0 | 0 | Inner-async IIFE + cancelled guard |
| `src/components/outcomes/OutcomesView.tsx` | 3 (`loadSettings` effect, audit beacon, `Promise.all` server aggregate) | 0 | 0 | Inner-async effects; void-IIFE for fire-and-forget audit beacon |
| `src/pages/LoginPage.tsx` | 2 (auth-config fetch chain) | 0 | 0 | Inner-async IIFE + cancelled guard |
| `src/pages/AdminPage.tsx` | 2 (center-options fetch chain) | 0 | 0 | Inner-async IIFE + cancelled guard |
| `src/pages/SettingsPage.tsx` | 4 (3 fetches serialized over `.then`) | 0 | 0 | Collapsed into single mount-time inner-async IIFE with per-fetch try/catch |
| `server/index.ts` | 2 (nested `import().then().then().catch()`) | 0 | 0 | void-IIFE for fire-and-forget cache warm |
| **Total** | **15** | **0** | **0** | |

Repo-wide verification:

```text
$ grep -rn "\.then(" src/ server/ shared/ --include="*.ts" --include="*.tsx"
(no output)

$ grep -rnE "useEffect\(\s*async" src/
(no output)    # Pitfall 2 guard: zero async-effect-callback patterns
```

`Promise.all` / `Promise.race` orchestration sites are retained per D-04 explicit exception (still present in `DataContext.tsx:fetchData` and `OutcomesView.tsx` server-aggregate effect — both now awaited inside an IIFE, not chained).

## Result-type Audit (D-03 / D-16)

```text
$ grep -rnE "type Result<|type Ok<|type Err<|type Either<" src/ server/ shared/ --include="*.ts" --include="*.tsx"
(no output)
```

**Result-type audit: 0 occurrences found; D-03 satisfied retroactively per D-16.** No migration scaffolding required. Codebase was already throw-only before this plan; the audit is purely confirmatory.

## Naming Confirmation-Pass (D-05 / D-17)

```text
$ grep -rnE "^\s*(let|const|var|function)\s+[a-z]+_[a-z_]+" src/ server/ shared/ --include="*.ts" --include="*.tsx"
(no output)
```

**Naming confirmation-pass: 0 TS-identifier violations found; D-05 satisfied per D-17.**

Per 22-RESEARCH §Naming Audit and 22-CONTEXT D-17, existing snake_case *string literals* (role slugs like `data_manager`, auth error codes like `invalid_credentials`, audit event names like `open_outcomes_view`, CSV column names like `patient_pseudonym`, OAuth/OIDC claims like `preferred_username`) are **wire-format**, not TS identifiers. They are exempt under D-05's FHIR/HTTP/SQL exception (extended to include JSON-wire contracts, audit DB values, and CSV headers per Pitfall 4). No rewrites are required.

## Atomic Commits

| # | Commit | Type | Subject |
|---|--------|------|---------|
| 1 | `20911d0` | refactor | dedup shim src/utils/cohortTrajectory.ts (retain) per D-06 |
| 2 | `e8683ab` | refactor | dedup shim src/services/fhirLoader.ts (retain) per D-06 |
| 3 | `c8f0e74` | refactor | dedup shim src/types/fhir.ts (retain) per D-06 |
| 4 | `362b75b` | refactor | dedup shim src/components/outcomes/OutcomesPanel.tsx (retain) per D-06 |
| 5 | `b887c5f` | refactor | dedup shim src/services/outcomesAggregateService.ts (retain) per D-06 |
| 6 | `3fa32d1` | refactor | dedup shim server/hashCohortId.ts (retain) per D-06 |
| 7 | `0de943b` | refactor | dedup shim server/outcomesAggregateApi.ts (retain) per D-06 |
| 8 | `cf4dce1` | refactor | rewrite .then -> async/await in src/context/DataContext.tsx per D-04 |
| 9 | `635359b` | refactor | rewrite .then -> async/await in src/context/AuthContext.tsx per D-04 |
| 10 | `6eb9e3d` | refactor | rewrite .then -> async/await in src/components/outcomes/OutcomesView.tsx per D-04 |
| 11 | `900e35e` | refactor | rewrite .then -> async/await in src/pages/LoginPage.tsx per D-04 |
| 12 | `ce1df2c` | refactor | rewrite .then -> async/await in src/pages/AdminPage.tsx per D-04 |
| 13 | `6e7dd25` | refactor | rewrite .then -> async/await in src/pages/SettingsPage.tsx per D-04 |
| 14 | `a64291a` | refactor | rewrite .then -> async/await in server/index.ts per D-04 |

All 14 commits made with `--no-verify` per the parallel-executor worktree protocol.

## Verification

Final gate (after commit 14):

```text
$ npm run test:ci
Test Files  57 passed (57)
     Tests  608 passed (608)

$ npm run build
✓ built in 333ms   # chunk-size warning pre-existing; not a regression

$ grep -rn "\.then(" src/ server/ shared/ --include="*.ts" --include="*.tsx"
(no output)

$ grep -rnE "useEffect\(\s*async" src/
(no output)

$ grep -rnE "type Result<|type Ok<|type Err<|type Either<" src/ server/ shared/ --include="*.ts" --include="*.tsx"
(no output)
```

D-10 safety net held across all 14 atomic commits: 608/608 tests passing, zero skips, after every single commit.

## Deviations from Plan

### Scope adjustments (no architectural change)

**1. [D-15 reality check] Shim list includes 4 non-shims.**
The plan's `files_modified` list (and 22-RESEARCH §Dedup Candidates) names 7 files, but 4 of them (`OutcomesPanel.tsx`, `outcomesAggregateService.ts`, `hashCohortId.ts`, `outcomesAggregateApi.ts`) are live modules, not re-export shims — 22-CONTEXT D-15 explicitly anticipates this. These received `// retained:` disposition comments explaining their non-shim nature rather than dedup work. Commits 4–7 above.

**2. [D-04 permission] Fire-and-forget sites converted to void-IIFE.**
The plan allowed either retaining `.then` with a `// retained:` comment for fire-and-forget sites OR converting to void-IIFE. This plan chose void-IIFE uniformly (audit beacon in `OutcomesView.tsx` line 171 region, cache-warm in `server/index.ts`) so the repo-wide `.then(` count is strictly 0 after this plan — simpler invariant for Plan 22-02 / 22-03 to reason about. Documented in commit messages.

No auto-fix rule fires; no architectural changes; no blockers.

## Self-Check: PASSED

- [x] `src/utils/cohortTrajectory.ts` contains `// retained:` [VERIFIED]
- [x] `src/services/fhirLoader.ts` contains `// retained:` [VERIFIED]
- [x] `src/types/fhir.ts` contains `// retained:` [VERIFIED]
- [x] `src/components/outcomes/OutcomesPanel.tsx` contains `// retained:` [VERIFIED]
- [x] `src/services/outcomesAggregateService.ts` contains `retained:` [VERIFIED]
- [x] `server/hashCohortId.ts` contains `retained:` [VERIFIED]
- [x] `server/outcomesAggregateApi.ts` contains `retained:` [VERIFIED]
- [x] 0 `.then(` repo-wide in src/server/shared [VERIFIED via grep]
- [x] 0 `useEffect(\s*async` anywhere in src [VERIFIED via grep]
- [x] 0 Result-type declarations repo-wide [VERIFIED via grep]
- [x] 0 TS-identifier snake_case violations [VERIFIED via grep]
- [x] 608/608 tests passing after final commit [VERIFIED]
- [x] `npm run build` exits 0 [VERIFIED]
- [x] All 14 commit hashes present in git log [VERIFIED]
- [x] SUMMARY.md exists at `.planning/phases/22-codebase-docs-consistency/22-01-SUMMARY.md`
