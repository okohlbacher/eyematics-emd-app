---
phase: 27
plan: "01"
subsystem: test-scaffolds
tags: [tdd, session, jti, rotation, sqlite, red-baseline]
dependency_graph:
  requires: []
  provides: [tests/sessionsDb.test.ts, tests/sessionRotation.test.ts, tests/rotateKey.test.ts]
  affects: [27-02, 27-03, 27-04]
tech_stack:
  added: []
  patterns: [Wave-0 red-baseline scaffold, supertest integration scaffold]
key_files:
  created:
    - tests/sessionsDb.test.ts
    - tests/sessionRotation.test.ts
    - tests/rotateKey.test.ts
  modified: []
decisions:
  - "Scaffold tests import from future module paths (../server/sessionsDb.js) so Plan 02-04 have concrete import contracts"
  - "sessionRotation.test.ts and rotateKey.test.ts mirror authRefresh.test.ts app-bootstrap pattern (vi.mock + createApp)"
  - "expect.fail('SCAFFOLD: ...') used instead of .skip() so failures are visible in red baseline, not silently skipped"
metrics:
  duration: "12m"
  completed: "2026-05-11"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 0
---

# Phase 27 Plan 01: Wave-0 Test Scaffolds (SESS-02/03/04) Summary

**One-liner:** Three red-baseline test files covering sessionsDb CRUD/schema, jti rotation reuse-detection, and dual-key signing-key rotation — Nyquist compliance for Plans 02–04.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | sessionsDb unit test scaffolds | e461578 | tests/sessionsDb.test.ts |
| 2 | sessionRotation integration scaffolds | d73c327 | tests/sessionRotation.test.ts |
| 3 | rotateKey integration scaffolds | 2aeb3ae | tests/rotateKey.test.ts |

## Scaffold Coverage

| File | Tests | Requirement | Red Reason |
|------|-------|-------------|------------|
| tests/sessionsDb.test.ts | 8 its / 4 describes | SESS-02, SESS-03 | Cannot find module `../server/sessionsDb.js` |
| tests/sessionRotation.test.ts | 5 its | SESS-03 | `expect.fail('SCAFFOLD: ...')` in all 5 stubs |
| tests/rotateKey.test.ts | 7 its | SESS-04 | `expect.fail('SCAFFOLD: ...')` in all 7 stubs |
| **Total** | **20 test cases** | SESS-02/03/04 | — |

## Requirement Coverage Map

| Requirement | Covered By | Scaffold Count |
|-------------|-----------|----------------|
| SESS-02: sessionsDb schema + CRUD | sessionsDb.test.ts (schema, CRUD) | 5 |
| SESS-03: jti rotation + family revocation | sessionsDb.test.ts (revokeFamily, cleanup) + sessionRotation.test.ts | 8 |
| SESS-04: signing-key rotation + dual-key window | rotateKey.test.ts | 7 |

## Red Baseline Commands

```bash
# All three should fail/error
npm run test:ci -- tests/sessionsDb.test.ts        # FAIL: Cannot find module server/sessionsDb.js
npm run test:ci -- tests/sessionRotation.test.ts    # FAIL: 5 SCAFFOLD assertions
npm run test:ci -- tests/rotateKey.test.ts          # FAIL: 7 SCAFFOLD assertions

# Existing suite must stay green
npm run test:ci -- --reporter=verbose 2>&1 | grep "682 passed"
```

## Plan Contract for Downstream Plans

Plans 02–04 reference these test files in their `<automated>` blocks:
- **Plan 02 (sessionsDb implementation):** `npm run test:ci -- tests/sessionsDb.test.ts` — turn green
- **Plan 03 (jti rotation in /refresh):** `npm run test:ci -- tests/sessionRotation.test.ts` — replace SCAFFOLD stubs with real assertions
- **Plan 04 (rotate-key endpoint):** `npm run test:ci -- tests/rotateKey.test.ts` — replace SCAFFOLD stubs with real assertions

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

The SCAFFOLD failures in sessionRotation.test.ts and rotateKey.test.ts are intentional Wave-0 placeholders. They will be resolved by Plans 03 and 04 respectively.

## Threat Flags

None — test scaffolds only; no production code paths introduced.

## Self-Check: PASSED

- [x] tests/sessionsDb.test.ts exists: FOUND
- [x] tests/sessionRotation.test.ts exists: FOUND
- [x] tests/rotateKey.test.ts exists: FOUND
- [x] Commit e461578: FOUND
- [x] Commit d73c327: FOUND
- [x] Commit 2aeb3ae: FOUND
- [x] 682 existing tests passing: CONFIRMED
