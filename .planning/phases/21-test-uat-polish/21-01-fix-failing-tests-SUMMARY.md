---
phase: 21-test-uat-polish
plan: 01
subsystem: test-infra
tags: [tests, ci, outcomes, audit-beacon, skip-gate]
requires: []
provides: [trusted-ci-baseline, zero-skip-gate]
affects: [tests/outcomesPanelCrt.test.tsx, src/components/outcomes/OutcomesView.tsx, scripts/check-skipped-tests.mjs, package.json]
tech_stack_added: []
patterns: [grep-ci-gate]
key_files_created:
  - scripts/check-skipped-tests.mjs
key_files_modified:
  - tests/outcomesPanelCrt.test.tsx
  - src/components/outcomes/OutcomesView.tsx
  - package.json
decisions:
  - "TEST-01/02: test-side drift (source [0,1] authoritative per admin Apr-17, v1.6 commit 668bfaf); updated tests, not source"
  - "TEST-03: source-side drift; added credentials:'include' only to the OutcomesView beacon (not to authFetch) to honor D-09 minimal-scoped fix"
  - "TEST-04: grep-based CI gate per D-11; ESLint rule deferred to Phase 23"
metrics:
  tasks: 3
  files_changed: 4
  tests_passing: 603
  test_files: 55
  duration_minutes: ~2
  completed: 2026-04-23
requirements: [TEST-01, TEST-02, TEST-03, TEST-04]
---

# Phase 21 Plan 01: Fix Failing Tests + Zero-Skip CI Gate Summary

## One-liner

Greened 3 pre-existing failing tests (2 test-side drift in outcomesPanelCrt, 1 source-side drift in OutcomesView audit beacon) and installed a grep-based zero-skip CI gate — 603/603 tests passing; `npm run test:ci` is now the trusted baseline for v1.9 refactors.

## Per-Test Root-Cause Decisions (D-07)

| Req | Test | Root cause | Fix location | Rationale |
|-----|------|------------|--------------|-----------|
| TEST-01 | `outcomesPanelCrt.test.tsx` "visus absolute [0, 2]" | Test assertion drift | Test | `OutcomesPanel.yDomain` returns `[0, 1]` (logMAR 0–1.0) intentionally per admin feedback Apr-17 shipped in v1.6 `668bfaf`. Source is authoritative. |
| TEST-02 | `outcomesPanelCrt.test.tsx` "backward compat default [0, 2]" | Same as TEST-01 (default metric = visus) | Test | Same rationale — update assertions + titles + inline comments to `[0, 1]`. |
| TEST-03 | `OutcomesPage.test.tsx` "fires audit beacon POST" | Source drift | Source (one line) | Phase 20 cookie-auth contract requires `credentials: 'include'` on beacons crossing `/api/audit/*`. OutcomesView beacon omitted it; test asserted it. Added `credentials: 'include'` to `OutcomesView.tsx` beacon init only — did NOT default it in `authFetch` (avoids broadcast impact per RESEARCH Pitfall 1). |
| TEST-04 | CI gate | New capability | `scripts/check-skipped-tests.mjs` + `package.json` | Grep gate per D-11; baseline is clean (55 files, 0 unlabelled `.skip`). |

## Commits (in order)

| # | Hash | Message |
|---|------|---------|
| 1 | `d03d9ab` | `test(21-01): fix outcomesPanelCrt visus y-domain assertions to [0,1] (TEST-01, TEST-02)` |
| 2 | `a3455f3` | `fix(21-01): add credentials:'include' to OutcomesView audit beacon (TEST-03)` |
| 3 | `8691f24` | `chore(21-01): add zero-skip CI gate + test:ci script (TEST-04)` |

## Baseline `npm run test:ci` output (exit 0)

```
> emd-app@1.4.0 test:check-skips
> node scripts/check-skipped-tests.mjs

OK: 55 test files, no unlabelled .skip

> emd-app@1.4.0 test
> vitest run

 Test Files  55 passed (55)
      Tests  603 passed (603)
   Duration  4.82s
```

## Acceptance Criteria

- [x] `npx vitest run tests/outcomesPanelCrt.test.tsx` exits 0 (4/4 pass)
- [x] `grep -c "\\[0, 2\\]" tests/outcomesPanelCrt.test.tsx` returns 0
- [x] `grep -c "\\[0, 1\\]" tests/outcomesPanelCrt.test.tsx` returns ≥ 2 (actual: 5)
- [x] `grep -c "admin Apr-17" tests/outcomesPanelCrt.test.tsx` returns ≥ 1 (actual: 3)
- [x] `git diff src/components/outcomes/OutcomesPanel.tsx` empty (source untouched)
- [x] `npx vitest run tests/OutcomesPage.test.tsx -t "fires audit beacon POST"` exits 0
- [x] `grep -c "credentials: 'include'" src/components/outcomes/OutcomesView.tsx` ≥ 1
- [x] `grep -c "Phase 20 cookie-auth contract" src/components/outcomes/OutcomesView.tsx` ≥ 1
- [x] `git diff src/services/authHeaders.ts` empty (authFetch untouched)
- [x] `node scripts/check-skipped-tests.mjs` exits 0 (baseline clean)
- [x] `npm run test:ci` exits 0 (603/603 tests)
- [x] Simulated violation test: `it.skip(...)` without SKIP_REASON → script exits 1

## Deviations from Plan

None — plan executed exactly as written.

An extra cleanup beyond the strict action list: the header docblock comment of `outcomesPanelCrt.test.tsx` contained a stale `[0, 2]` reference outside the test bodies. To satisfy the acceptance criterion `grep -c "\\[0, 2\\]" returns 0`, that docblock bullet was reworded to "not the absolute range" (unrelated to the CRT-delta symmetric-domain case it describes, which never asserted `[0, 2]`). No assertion changed.

## Known Stubs

None.

## Threat Flags

None — scope was test code + one-line source edit; no new attack surface.

## Self-Check: PASSED

- FOUND: scripts/check-skipped-tests.mjs
- FOUND: tests/outcomesPanelCrt.test.tsx (modified)
- FOUND: src/components/outcomes/OutcomesView.tsx (modified)
- FOUND: package.json (modified)
- FOUND commit: d03d9ab
- FOUND commit: a3455f3
- FOUND commit: 8691f24
