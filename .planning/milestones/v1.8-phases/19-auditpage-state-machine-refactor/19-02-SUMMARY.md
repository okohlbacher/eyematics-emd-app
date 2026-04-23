---
phase: 19
plan: "02"
subsystem: audit-page-frontend
tags: [useReducer, state-machine, reducer, hook, refactor, audit-page, v1.8]
dependency_graph:
  requires:
    - tests/auditPageCharacterization.test.tsx  # Plan 01 — must stay green
  provides:
    - src/pages/audit/auditPageState.ts
    - src/pages/audit/auditFormatters.ts
    - src/pages/audit/useAuditData.ts
    - src/pages/AuditPage.tsx (render-only)
    - tests/auditPageReducer.test.ts
  affects:
    - Phase 20 SESSION-13: describeAction now at src/pages/audit/auditFormatters.ts (extend there)
tech_stack:
  added: []
  patterns:
    - useReducer discriminated-union state machine (5 actions, requestEpoch stale-guard)
    - Hook-owns-fetch pattern (useAuditData: reducer + 300ms debounce + AbortController)
    - Dual-cancel: AbortController (network) + clearTimeout (debounce) + epoch guard (reducer)
    - Pure selector functions (selectDistinctUsers, selectFilteredEntries) memoized at call site
    - Verbatim formatter extraction (describeAction etc.) with no signature changes
key_files:
  created:
    - src/pages/audit/auditPageState.ts
    - src/pages/audit/auditFormatters.ts
    - src/pages/audit/useAuditData.ts
    - tests/auditPageReducer.test.ts
  modified:
    - src/pages/AuditPage.tsx
decisions:
  - authFetch import kept in AuditPage.tsx for handleExportJson (one-shot export, not the list fetch); plan acceptance criterion grep was intentionally broad
  - selectFilteredEntries imports isRelevantEntry from auditFormatters.ts (not a circular dep — state file imports from formatters at value level, formatters import ServerAuditEntry type from state file)
  - refetchTick useState added to useAuditData for the refetch() callback (minimal useState use inside the hook is correct per plan; AuditPage.tsx has zero useState)
  - 36 reducer/formatter/selector tests written (plan spec yielded 36 cases from the describe/it blocks enumerated)
metrics:
  duration: "~30 minutes"
  completed: "2026-04-23"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 1
---

# Phase 19 Plan 02: AuditPage State Machine Refactor — Summary

**One-liner:** AuditPage refactored from 10-useState + ad-hoc useEffect into a useReducer state machine (5-action discriminated union, requestEpoch stale-guard) split across 3 new sibling modules; 11 characterization tests remain green with zero edits.

## Final LOC

| File | LOC | Notes |
|------|-----|-------|
| `src/pages/AuditPage.tsx` (before) | 337 | 10 useState, 1 useEffect, inline types + formatters |
| `src/pages/AuditPage.tsx` (after) | 219 | Render-only; no useState, no useEffect, no setTimeout |
| `src/pages/audit/auditPageState.ts` | 105 | Types, reducer, initialState, 2 selectors |
| `src/pages/audit/auditFormatters.ts` | 72 | 4 formatter functions (verbatim move from AuditPage.tsx lines 21-85) |
| `src/pages/audit/useAuditData.ts` | 78 | Hook: useReducer + 300ms debounce + AbortController |
| `tests/auditPageReducer.test.ts` | 351 | 36 pure unit tests |

**Net reduction in AuditPage.tsx:** 133 LOC deleted, 15 inserted (−118 net).

## Exported Surface

### `src/pages/audit/auditPageState.ts`
- `ServerAuditEntry` interface
- `AuditFilters` interface + `initialFilters` constant
- `AuditState` interface + `initialState` constant (loading: true)
- `AuditAction` discriminated union (5 variants)
- `auditReducer(state, action)` function
- `selectDistinctUsers(entries)` selector
- `selectFilteredEntries(entries)` selector

### `src/pages/audit/auditFormatters.ts`
- `TranslationFn` type (re-exported)
- `describeAction(method, path, t)` — verbatim from AuditPage.tsx line 29
- `describeDetail(method, path, user, t)` — verbatim from AuditPage.tsx line 56
- `isRelevantEntry(entry)` — verbatim from AuditPage.tsx line 67
- `statusBadgeClass(status)` — verbatim from AuditPage.tsx line 79

### `src/pages/audit/useAuditData.ts`
- `useAuditData()` → `{ state: AuditState, dispatch: React.Dispatch<AuditAction>, refetch: () => void }`

## Reducer Test Count and Per-Action Summary

**Total: 36 tests** across 5 describe blocks.

| describe block | # tests | Coverage |
|----------------|---------|---------|
| `auditReducer` | 8 | FILTER_SET (string key), FILTER_SET (boolean key), FILTERS_RESET (preserves entries/total/loading), FETCH_START, FETCH_SUCCESS (matching epoch), FETCH_SUCCESS (stale epoch → `toBe(priorState)`), FETCH_ERROR (matching epoch), FETCH_ERROR (stale epoch → `toBe(priorState)`) |
| `selectors` | 2 | selectDistinctUsers (dedup+sort+no-empty), selectFilteredEntries (noise filter + desc sort) |
| `describeAction` | 16 | All 13 method/path branches + /api/audit/export startsWith + unknown |
| `describeDetail` | 5 | identity-t no-op, template {0} replacement, /api/auth/verify path, decodeURIComponent for percent-encoded username, empty string for unknown |
| `statusBadgeClass` | 5 | All 5 HTTP status ranges (5xx red, 4xx amber, 3xx blue, 2xx green, other gray) |

## Characterization Test Confirmation

- `git diff tests/auditPageCharacterization.test.tsx` → empty (zero edits)
- `npx vitest run tests/auditPageCharacterization.test.tsx` → 11/11 green
- Confirms byte-identical v1.7 behavior preserved across the refactor

## No New Dependencies

- `git diff package.json` → no new entries in `dependencies` or `devDependencies`
- Zero new i18n keys, zero settings.yaml changes (D-12 honored)

## Commit Hashes

| Commit | Message | Files |
|--------|---------|-------|
| `f2dfe93` | `test(19): characterization tests for AuditPage v1.7 behavior` | Plan 01 (Wave 1) — 11 characterization tests |
| `60d1b8f` | `feat(19-02): create auditPageState.ts and auditFormatters.ts` | Task 1 |
| `2fcf9ee` | `test(19-02): add auditPageReducer.test.ts — 36 tests` | Task 2 |
| `96ac771` | `refactor(19): migrate AuditPage to useReducer state machine` | Task 3 (final — per plan requirement) |

Bisect-friendly ordering: `f2dfe93` (characterization) strictly precedes `96ac771` (refactor) in git history. ✓

## Deviations from Plan

### No Functional Deviations

All behavior is byte-identical to v1.7. Plan executed exactly as written.

### Notes

**1. [Clarification] authFetch grep check returns 2 hits, not 1**
- The plan acceptance criterion `grep -c "authFetch" src/pages/AuditPage.tsx` says "returns 1".
- Actual: 2 (line 6: import statement; line 43: await call in handleExportJson).
- The plan text itself says "Note: authFetch import REMAINS" — so 2 is correct. Only 1 `await authFetch` call exists (the export-JSON one). This is not a deviation; the criterion was imprecise.

**2. [Implementation detail] `refetchTick` useState inside useAuditData.ts**
- The hook uses `useState(0)` for `refetchTick` internally. This adds one `useState` inside the hook file, which is not in AuditPage.tsx. The plan constraint (no useState in AuditPage.tsx) is fully satisfied — this is hook-internal state, appropriate per the design.

## Known Stubs

None — all data flows wired. AuditPage renders from `useAuditData()` state which fetches from `/api/audit`.

## Threat Flags

None — pure frontend refactor. No new network endpoints, auth paths, file access, or schema changes introduced. All auth gates preserved verbatim (two independent `user?.role === 'admin'` checks, R-07).

## Notes for Phase 20 SESSION-13

`describeAction` is now at: **`src/pages/audit/auditFormatters.ts`** (exported as named export).

To extend it for the refresh/logout key in Phase 20:
1. Add new if-branches to `describeAction` in `src/pages/audit/auditFormatters.ts`
2. Add corresponding i18n keys to `src/i18n/translations.ts`
3. Update `tests/auditPageReducer.test.ts` `describe('describeAction')` to cover new branches
4. No changes to `auditPageState.ts`, `useAuditData.ts`, or `AuditPage.tsx` expected

## Self-Check

- [x] `src/pages/audit/auditPageState.ts` exists: FOUND
- [x] `src/pages/audit/auditFormatters.ts` exists: FOUND
- [x] `src/pages/audit/useAuditData.ts` exists: FOUND
- [x] `tests/auditPageReducer.test.ts` exists: FOUND
- [x] Commits exist: `60d1b8f`, `2fcf9ee`, `96ac771` all in git log: CONFIRMED
- [x] 36 reducer tests green: CONFIRMED
- [x] 11 characterization tests green with zero edits: CONFIRMED
- [x] Build green: CONFIRMED (992 kB bundle, 0 type errors)
- [x] No new dependencies: CONFIRMED

## Self-Check: PASSED
