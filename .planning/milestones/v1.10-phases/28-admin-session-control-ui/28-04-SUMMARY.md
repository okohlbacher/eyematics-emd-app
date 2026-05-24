---
phase: 28-admin-session-control-ui
plan: "04"
subsystem: admin-ui
tags: [sessions, admin, i18n, accordion, lazy-fetch, revoke]
dependency_graph:
  requires: [28-02]
  provides: [SESSUI-01, SESSUI-02, SESS-01-ui]
  affects: [src/pages/AdminPage.tsx, src/i18n/translations.ts]
tech_stack:
  added: []
  patterns: [lazy-fetch on accordion expand, React.Fragment for paired tr rows, useCallback session fetch]
key_files:
  created: []
  modified:
    - src/pages/AdminPage.tsx
    - src/i18n/translations.ts
decisions:
  - "Used React.Fragment to pair user <tr> with conditional accordion <tr> inside filteredUsers.map"
  - "Used UI-SPEC sign-out-everywhere button style (bordered red, not solid red bg) — overrides plan text which specified solid bg-red-600; UI-SPEC is authoritative design contract"
  - "Used dataLoading key for spinner label — AdminPage uses hardcoded 'Loading…' but dataLoading is the closest matching existing key"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-14T14:11:00Z"
  tasks_completed: 2
  files_modified: 2
requirements: [SESS-01, SESSUI-01, SESSUI-02]
---

# Phase 28 Plan 04: Session Accordion UI Summary

Per-user session accordion added to AdminPage with lazy fetch, session table, Revoke, and Sign out everywhere. 12 i18n keys with de+en.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add 12 session i18n keys | 356223e | src/i18n/translations.ts |
| 2 | Add per-user session accordion | 93289ee | src/pages/AdminPage.tsx |

## What Was Built

### Task 1: 12 i18n keys
Added to `src/i18n/translations.ts` under "Session management (Phase 28 / SESSUI-01, SESSUI-02)":
- `adminSessions`, `adminSessionsTitle`, `adminSignOutEverywhere`, `adminSigningOut`
- `adminRevokeSession`, `adminNoActiveSessions`, `adminSessionsLoadError`, `adminRevokeError`
- `sessionDevice`, `sessionIssuedAt`, `sessionLastUsed`, `sessionExpires`

### Task 2: Session accordion in AdminPage.tsx
- `SessionRow` inline interface (mirrors `server/sessionsDb.ts`)
- New lucide imports: `ChevronDown`, `ChevronUp`, `Loader2`, `LogOut`
- 6 new state variables: `expandedSessionUser`, `sessionMap`, `sessionLoading`, `sessionError`, `signingOutUser`, `revokeError`
- `fetchSessions` useCallback — lazy GET `/api/auth/sessions?username=…`
- `toggleSessionAccordion` — single-open-at-a-time (expanding one collapses any other)
- `handleRevokeSession` — DELETE `/api/auth/sessions/:id`, re-fetches on 200
- `handleSignOutEverywhere` — DELETE `/api/auth/sessions?username=…`, shows loading state
- Sessions column header added to thead (8 columns total); all `colSpan={7}` → `colSpan={8}`
- Sessions toggle button with `aria-expanded` in each user row
- Accordion `<tr>` via `React.Fragment` wrapper: card with header, session table, loading/empty/error states
- `aria-busy` on Sign out everywhere button; `aria-label` on per-row Revoke buttons

## Verification

- `npx tsc --noEmit -p tsconfig.json` — clean (0 errors)
- `npm run lint` — 1 pre-existing warning (unused eslint-disable directive at line 195, present before this plan)
- `npx vitest run tests/outcomesI18n.test.ts` — 38/38 PASS
- `npm run test:ci` — 723/723 PASS (68 test files)

## Acceptance Criteria Status

| Criterion | Status |
|-----------|--------|
| `grep -q "expandedSessionUser" src/pages/AdminPage.tsx` | PASS |
| `grep -q "mirrors server/sessionsDb.ts SessionRow"` | PASS |
| `grep -q "colSpan={7}"` FAILS (none left) | PASS |
| `grep -c "colSpan={8}"` >= 4 (returns 4) | PASS |
| `grep -q "aria-expanded"` | PASS |
| `grep -q "aria-busy"` | PASS |
| `grep -q "key_id.slice(-8)"` | PASS |
| `npx tsc --noEmit -p tsconfig.json` no errors | PASS |
| `npm run lint` no new errors | PASS |
| `npx vitest run tests/outcomesI18n.test.ts` GREEN | PASS |

## Deviations from Plan

### Auto-fixed Issues

None.

### Design Adjustments

**1. [Rule 0 - Design Contract] Sign out everywhere button style**
- **Found during:** Task 2 implementation
- **Issue:** Plan text specified `bg-red-600 hover:bg-red-700 text-white` (solid red) for the Sign out everywhere button. UI-SPEC Component 2 specifies bordered style: `border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20`.
- **Fix:** Used UI-SPEC style as authoritative design contract. Bordered destructive button is consistent with the phase's design language (Sign out everywhere is dangerous but not as immediate/irreversible as a hard delete).
- **Files modified:** src/pages/AdminPage.tsx

**2. [Rule 2 - Missing functionality] React.Fragment wrapper for accordion tr**
- **Found during:** Task 2 implementation
- **Issue:** Plan spec described adding the accordion `<tr>` "immediately after each user `<tr>`", but the existing map structure returns a single element (either edit `<tr>` or normal `<tr>`). React requires a single root per map iteration.
- **Fix:** Wrapped the normal user case in `React.Fragment` (with `key={u.username}`) so the accordion `<tr>` can follow the user `<tr>` as siblings inside the fragment. Edit mode row is unchanged (no accordion shown during edit).

## Known Stubs

None — all data is fetched from live endpoints.

## Threat Flags

No new trust boundaries introduced. All session API calls go through `authFetch` (Bearer token attached), server enforces admin role check per plan 02. Session field values rendered as React text children (auto-escaped). No `dangerouslySetInnerHTML`.

## Self-Check: PASSED

- `src/pages/AdminPage.tsx` — modified, exists
- `src/i18n/translations.ts` — modified, exists
- Commit 356223e — verified in git log
- Commit 93289ee — verified in git log
