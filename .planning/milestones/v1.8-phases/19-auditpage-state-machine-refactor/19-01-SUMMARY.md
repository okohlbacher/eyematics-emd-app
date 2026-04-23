---
phase: 19
plan: "01"
subsystem: audit-page-frontend
tags: [characterization-tests, rtl, vitest, jsdom, audit-page, v1.7-freeze]
dependency_graph:
  requires: []
  provides: [tests/auditPageCharacterization.test.tsx]
  affects: [src/pages/AuditPage.tsx]
tech_stack:
  added: []
  patterns:
    - RTL + vi.mock + jsdom characterization test (mirrors adminCenterFilter.test.tsx pattern)
    - queryByText().not.toBeNull() / .toBeNull() — Vitest/Chai native (no jest-dom setup)
    - download utils mocked to prevent jsdom URL.createObjectURL errors
    - Real timers + waitFor (timeout 1000ms) for 300ms debounce verification
key_files:
  created:
    - tests/auditPageCharacterization.test.tsx
  modified: []
decisions:
  - Use queryByText/not.toBeNull pattern instead of toBeInTheDocument (no jest-dom setup file in this codebase)
  - Mock ../src/utils/download to prevent URL.createObjectURL jsdom errors
  - Assert toTime with decodeURIComponent(url) — URLSearchParams percent-encodes colons (:) as %3A
  - Real timers throughout (vi.useFakeTimers skipped per plan instruction and codebase precedent)
  - Stub t returns raw i18n key — all text assertions use key names, not English strings
metrics:
  duration: "~25 minutes"
  completed: "2026-04-23"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 19 Plan 01: Characterization Tests for AuditPage v1.7 Behavior — Summary

**One-liner:** 11 RTL jsdom characterization tests freezing AuditPage v1.7 contract (4 render states, 6-dim filter URL, 300ms debounce, cancel-on-unmount, admin-gated exports, isRelevantEntry, describeAction/describeDetail) before the Plan 02 useReducer refactor.

## Final Test Count and Status

All 11 characterization tests pass against the unrefactored `src/pages/AuditPage.tsx`:

| # | Test Title | Status |
|---|-----------|--------|
| 1 | `loading state on mount` | green |
| 2 | `error state on non-OK` | green |
| 3 | `empty state when no entries match filters` | green |
| 4 | `populated table renders rows` | green |
| 5 | `debounced refetch on filter change` | green |
| 6 | `unmount cancels in-flight fetch` | green |
| 7 | `admin-gated export buttons` | green |
| 8 | `6-dim filter URL params emit correctly` | green |
| 9 | `isRelevantEntry filters out noise GETs from rendered table` | green |
| 10 | `describeAction outputs expected i18n key for POST /api/auth/login` | green |
| 11 | `describeDetail outputs expected i18n key for DELETE /api/auth/users/alice` | green |

## Commit

- **Hash:** `f2dfe93`
- **Message:** `test(19): characterization tests for AuditPage v1.7 behavior`
- **Files in commit:** `tests/auditPageCharacterization.test.tsx` only (1 file, 376 insertions)
- **Source file changes:** zero — `git show --stat f2dfe93` shows only the test file

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `toBeInTheDocument` not available — replaced with `.not.toBeNull()` / `.toBeNull()`**
- **Found during:** First test run (all tests using `toBeInTheDocument` threw `Invalid Chai property: toBeInTheDocument`)
- **Issue:** This codebase has no `@testing-library/jest-dom` setup file. The existing `adminCenterFilter.test.tsx` (the reference template) uses `queryByText().not.toBeNull()` and `.toBeNull()` — the plan's behavior spec mentioned `toBeInTheDocument` as a shorthand but the canonical pattern in this repo is Vitest/Chai native.
- **Fix:** Replaced all `toBeInTheDocument()` calls with `.not.toBeNull()` and all `not.toBeInTheDocument()` with `.toBeNull()`. No behavioral change.
- **Files modified:** `tests/auditPageCharacterization.test.tsx`
- **Commit:** `f2dfe93` (amended into same commit)

**2. [Rule 1 - Bug] `toTime` URL assertion failed on percent-encoding**
- **Found during:** Second test run (test 8 `6-dim filter URL params emit correctly`)
- **Issue:** `URLSearchParams.toString()` encodes the colon in `T23:59:59` as `%3A`, producing `toTime=2026-01-31T23%3A59%3A59` in the URL string. The plan spec's `toContain('toTime=2026-01-31T23:59:59')` matched the INTENDED behavior but not the literal URL string.
- **Fix:** Changed assertion to `expect(decodeURIComponent(calledUrl)).toContain('toTime=2026-01-31T23:59:59')`. This correctly documents that AuditPage uses `URLSearchParams` (which encodes the value) and the end-of-day suffix is preserved semantically.
- **Files modified:** `tests/auditPageCharacterization.test.tsx`
- **Commit:** `f2dfe93` (amended into same commit)

**3. [Rule 2 - Missing] Mock `../src/utils/download` to prevent jsdom errors**
- **Found during:** Test design (pre-emptive, based on `downloadBlob` calling `URL.createObjectURL` and DOM anchor manipulation)
- **Issue:** `URL.createObjectURL` is not implemented in jsdom. Without mocking, any CSV export button click in tests would throw.
- **Fix:** Added `vi.mock('../src/utils/download', ...)` with stub implementations of all exports. This was not in the plan spec but is required for correctness — the plan noted "if it fails, investigate" (Risk R-09).
- **Files modified:** `tests/auditPageCharacterization.test.tsx`
- **Commit:** `f2dfe93`

**4. [Rule 1 - Cleanup] Removed unused `eslint-disable-next-line` comments**
- **Found during:** `npx eslint tests/auditPageCharacterization.test.tsx`
- **Issue:** Two `eslint-disable-next-line @typescript-eslint/no-explicit-any` directives were flagged as unused (the `as never` cast was already sufficient to suppress the error).
- **Fix:** Removed the directive comments; kept `as never` casts.
- **Commit:** `f2dfe93` (amended)

### Test Title Deviations

None — all 11 test titles match the plan spec exactly.

## Validation Evidence

```
npx vitest run tests/auditPageCharacterization.test.tsx
→ Tests  11 passed (11)

git diff --name-only src/
→ (empty — zero source files modified)

git show --stat f2dfe93
→ tests/auditPageCharacterization.test.tsx | 376 +++++++++++++++++++++++++++++++
  1 file changed, 376 insertions(+)
```

## Full-Suite Notes

`npm test` shows 3 pre-existing failures in `tests/outcomesPanelCrt.test.tsx` (2 tests) and `tests/OutcomesPage.test.tsx` (1 test). These failures were confirmed pre-existing by running `npm test` on the commit prior to `f2dfe93` (same 3 failures, same stack traces). They are unrelated to Phase 19.

`npm run build` — green (tsc + vite, 992 kB bundle, 0 type errors).

`npm run lint` — pre-existing 622 errors across the codebase. New file `tests/auditPageCharacterization.test.tsx` has 0 errors, 2 import-sort warnings (same category as other test files in the repo).

## Self-Check

- [x] `tests/auditPageCharacterization.test.tsx` exists: FOUND
- [x] `f2dfe93` commit exists in `git log`: FOUND
- [x] Commit contains only test file: CONFIRMED via `git show --stat`
- [x] 11/11 tests green: CONFIRMED
