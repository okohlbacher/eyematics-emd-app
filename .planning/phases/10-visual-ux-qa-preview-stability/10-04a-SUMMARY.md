---
phase: 10-visual-ux-qa-preview-stability
plan: 04a
subsystem: ui
tags: [react, rtl, vitest, i18n, admin, center-filter, vqa]

# Dependency graph
requires:
  - phase: 07-site-roster-correction-synthetic-data
    provides: 7-site roster + `/api/fhir/centers` endpoint + data/centers.json shorthand list
  - phase: 04-user-management-data-persistence
    provides: `/api/auth/users` CRUD + AdminPage users-table + role/search filter scaffolding
provides:
  - AdminPage users-table center filter `<select>` populated from `/api/fhir/centers`
  - `adminFilterAllCenters` i18n key (DE + EN)
  - Locked-to-7-sites snapshot test (`tests/adminCenterFilter.test.tsx`) — roster-change canary per D-09
affects:
  - Any future plan changing `data/centers.json` MUST update `tests/adminCenterFilter.test.tsx` in the same PR
  - Later Phase 10 plans adding center-scoped admin actions can reuse the `centerFilter` predicate

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Roster-lockstep canary test: hardcoded center label list in a dedicated RTL test that breaks intentionally when data/centers.json changes"
    - "Admin toolbar filter pattern extended: new filter = new state + new useMemo predicate + new <select> sibling in Search/Filter Bar block"

key-files:
  created:
    - "tests/adminCenterFilter.test.tsx"
  modified:
    - "src/pages/AdminPage.tsx"
    - "src/i18n/translations.ts"

key-decisions:
  - "Center filter is client-side UX only — server-side center scoping on /api/auth/users remains authoritative (Rule: server authz unchanged)"
  - "Canonical center order sourced from /api/fhir/centers (reusing the existing centerOptions fetch) rather than duplicating the roster in AdminPage"
  - "Test mocks useAuth/useLanguage/authFetch at module level; useLanguage stub includes setLocale to match the real export shape"

patterns-established:
  - "Roster canary test: any filter test that asserts an exact site-label list is paired with a PR-level lockstep reminder; data/centers.json edit → test edit in same PR"
  - "Admin toolbar filter triad: useState + useMemo predicate pass + <select data-testid=\"...\"> sibling block"

requirements-completed: [VQA-01]

# Metrics
duration: 3min
completed: 2026-04-16
---

# Phase 10 Plan 04a: Admin Center Filter Summary

**Center filter select in AdminPage toolbar, sourced from /api/fhir/centers, locked to the 7-site roster by an RTL snapshot + narrowing test (the roster-change canary).**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-16T11:13:24Z
- **Completed:** 2026-04-16T11:16:07Z
- **Tasks:** 3
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments
- Added `adminFilterAllCenters` i18n key (DE: "Alle Zentren", EN: "All centers") next to `adminFilterAllRoles` — grouped admin filter keys.
- Wired a `data-testid="admin-center-filter"` `<select>` into the AdminPage users-table toolbar, populated from the existing `centerOptions` fetch (no new endpoint).
- Extended `filteredUsers` useMemo with a center-filter pass (`u.centers.includes(centerFilter)`) and refreshed the dependency array.
- Created `tests/adminCenterFilter.test.tsx` — the D-09 roster-change canary: 8-option snapshot (UKA, UKC, UKD, UKG, UKL, UKMZ, UKT in order) + narrowing assertions through org-uka → org-ukd → all.
- Closes **VQA-01**.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add adminFilterAllCenters i18n key (DE + EN)** — `8ec4ef2` (feat)
2. **Task 2: Add center filter UI to AdminPage.tsx** — `bbec4fa` (feat)
3. **Task 3: Add tests/adminCenterFilter.test.tsx** — `f91df76` (test)

_Note: Task 3 is labelled `tdd="true"` in the plan. Because Task 2 already shipped the full UI + predicate, the test was green on first run — there is no distinct RED commit. The single `test(...)` commit captures the canary lock as intended by the plan._

## Files Created/Modified
- `src/i18n/translations.ts` — one-line insertion for `adminFilterAllCenters` (DE + EN) after `adminFilterAllRoles`.
- `src/pages/AdminPage.tsx` — added `centerFilter` state, extended `filteredUsers` predicate + deps, new `<select data-testid="admin-center-filter">` in the toolbar block. `Building2` icon reused from existing lucide-react import.
- `tests/adminCenterFilter.test.tsx` — new RTL suite: 2 tests, 8-option snapshot (exact labels + values) + 3-user narrowing fixture (u-uka, u-ukd, u-both).

## Decisions Made
- **Mock shape check (per plan's explicit output request):** The mocks in `tests/adminCenterFilter.test.tsx` match the real module exports:
  - `../src/services/authHeaders` exports `authFetch` (async (input, init?) → Response) and `getAuthHeaders`. Mock covers both. `authFetch` accepts `RequestInfo | URL`; the mock normalises `input` to a string before pattern-matching the path.
  - `../src/context/AuthContext` exports `useAuth` (returns `{ user, ... }`). Mock returns `{ user: { username, role } }` which is sufficient for AdminPage's `user?.role === 'admin'` gate and users-fetch path.
  - `../src/context/LanguageContext` exports `useLanguage` (returns `{ locale, setLocale, t }`). Mock adds `setLocale: () => {}` so the shape is a superset of AdminPage's `{ locale, t }` consumption.
  - No adjustments to the plan's assertion logic were needed.
- **Typecheck pre-condition:** The worktree snapshot contained 4 stale untracked files from a pre-rebase "initial commit" (`src/services/auditService.ts`, `src/hooks/useLocalStorageState.ts`, `src/hooks/usePageAudit.ts`, `src/utils/safeJson.ts`, plus 3 stale `public/data/center-*.json` files for removed centers). These were removed upstream in commit `2fa0ad6` and are unrelated to this plan's scope. Moved them to `/tmp/stale-worktree-files/` so `npx tsc -b` runs clean. Tracked as a worktree-hygiene observation (not a deviation — this is out-of-scope cleanup per the scope-boundary rule, done only to unblock verification).

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria met on first attempt.

## Issues Encountered
- The worktree snapshot was initially based on an older "Initial commit" rather than the expected phase base (`edfc59d`). Resolved by `git reset --soft edfc59d` + `git checkout HEAD -- .` to sync the working tree with the correct base; the plan file was copied in from the main repo (the worktree's pre-rebase snapshot did not include it). Stale untracked files were moved aside to allow clean typecheck. None of this touched plan-in-scope code.

## User Setup Required

None — no external service configuration required. This is a pure client-side UX change guarded by an RTL test.

## Roster Lockstep Reminder

**If `data/centers.json` ever changes (add/remove/rename a site or change a shorthand), `tests/adminCenterFilter.test.tsx` MUST be updated in the same PR.** The exact label list (`UKA, UKC, UKD, UKG, UKL, UKMZ, UKT`) and `length === 8` assertion are intentionally hardcoded as the roster-change canary per decision D-09. This is a feature — the test is the gate.

## Verification Results

- `npx vitest run tests/adminCenterFilter.test.tsx` → 2/2 passed (0.6s)
- `npx vitest run tests/outcomesI18n.test.ts` → 3/3 passed (new `adminFilterAllCenters` key does not collide with outcomes* namespace)
- `npx tsc -b` → exit 0 (typecheck clean)
- `grep -F 'adminFilterAllCenters' src/i18n/translations.ts` → match
- `grep -F 'data-testid="admin-center-filter"' src/pages/AdminPage.tsx` → match

## Next Phase Readiness

- VQA-01 closed; Phase 10 success criterion #1 (admin filter 7-site snapshot) satisfied.
- Other Phase 10 plans (`10-01` chart palette, `10-02` IQR, `10-03` tooltip, `10-05` empty states, `10-04b` preview row keys) remain independent — no seam changes.
- `centerFilter` UI state is available for any future per-center admin action.

## Self-Check: PASSED

- FOUND: `src/i18n/translations.ts` (modified)
- FOUND: `src/pages/AdminPage.tsx` (modified)
- FOUND: `tests/adminCenterFilter.test.tsx` (created)
- FOUND commit: `8ec4ef2` (Task 1)
- FOUND commit: `bbec4fa` (Task 2)
- FOUND commit: `f91df76` (Task 3)

---
*Phase: 10-visual-ux-qa-preview-stability*
*Plan: 04a (admin-center-filter)*
*Completed: 2026-04-16*
