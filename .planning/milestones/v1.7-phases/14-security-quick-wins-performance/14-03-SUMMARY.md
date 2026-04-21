---
phase: 14-security-quick-wins-performance
plan: 03
subsystem: auth
tags: [jwt, bcrypt, react, accessibility, aria, security, forced-password-change]

# Dependency graph
requires:
  - phase: 14-01
    provides: JWT algorithm pin and cohortHashSecret established in authMiddleware/authApi

provides:
  - UserRecord.mustChangePassword field + startup scan in initAuth.ts
  - POST /api/auth/change-password route in authApi.ts
  - /api/auth/change-password in PUBLIC_PATHS (authMiddleware.ts)
  - PasswordChangePage full-page interstitial blocking all navigation
  - AuthContext mustChangePassword state, pendingChangeToken, changePassword()
  - role="img" + aria-label on OutcomesPanel chart container div

affects:
  - future auth plans (any plan touching login flow or JWT)
  - A11Y plans (aria pattern established for chart containers)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SEC-03 forced-change-password: changeToken (purpose='change-password') gates login; separate PUBLIC_PATH endpoint exchanges token for session JWT"
    - "App.tsx pre-router gate: mustChangePassword check before <Routes> blocks all navigation"
    - "A11Y chart wrapper: role='img' + aria-label on outer div (NOT inside ResponsiveContainer)"

key-files:
  created:
    - tests/mustChangePassword.test.ts
    - tests/OutcomesPanel.test.tsx
    - src/pages/PasswordChangePage.tsx
  modified:
    - server/initAuth.ts
    - server/authApi.ts
    - server/authMiddleware.ts
    - src/context/AuthContext.tsx
    - src/App.tsx
    - src/i18n/translations.ts
    - src/components/outcomes/OutcomesPanel.tsx

key-decisions:
  - "changeToken purpose='change-password' is distinct from purpose='challenge'; verifyLocalToken rejects both on protected routes (T-14-08)"
  - "mustChangePassword gate in App.tsx is before <Routes> inside AppRoutes() which is inside AuthProvider — useAuth() is available, no URL bypass possible"
  - "_migrateUsersJson exported for test access (SEC-03 scan assertions require file-system-level testing)"
  - "aria-label on outer panel div, not inside ResponsiveContainer — Recharts may filter arbitrary props from its tree"

requirements-completed: [SEC-03, A11Y-01]

# Metrics
duration: 5min
completed: 2026-04-17
---

# Phase 14 Plan 03: Security Quick Wins — Forced Password Change & Aria Labels Summary

**Forced-password-change flow (SEC-03) with bcrypt startup scan, 5-min changeToken JWT, full-page PasswordChangePage interstitial, and ARIA role/label on OutcomesPanel chart containers (A11Y-01)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-17T10:24:50Z
- **Completed:** 2026-04-17T10:30:05Z
- **Tasks:** 3
- **Files modified:** 10 (7 modified, 3 created)

## Accomplishments

- SEC-03 backend: `_migrateUsersJson` scans users with bcrypt('changeme2025!') hash at startup and sets `mustChangePassword: true`; POST /login gate returns `{ mustChangePassword: true, changeToken }` instead of session JWT; POST /api/auth/change-password validates changeToken, rejects default password, issues full session JWT
- SEC-03 frontend: `AuthContext` detects mustChangePassword response, stores pendingChangeToken, exposes `changePassword()` function; `PasswordChangePage` full-page form blocks all navigation via pre-router check in `AppRoutes()`; 9 new i18n keys (DE+EN)
- A11Y-01: `role="img"` and `aria-label` (format: `"${title} — ${patientCount} ${t('outcomesCardPatients')}"`) on the outer `OutcomesPanel` div; 3 RTL tests confirm ARIA presence
- Test suite grew from 430 to 449 passing tests (11 new: 8 mustChangePassword + 3 OutcomesPanel ARIA), all passing

## Task Commits

1. **Task 1: Backend forced-password-change enforcement (SEC-03)** - `10b5e05` (feat)
2. **Task 2: Frontend forced-password-change interstitial (SEC-03)** - `f7ae430` (feat)
3. **Task 3: Add aria-label to OutcomesPanel chart container (A11Y-01)** - `9c32707` (feat)

## Files Created/Modified

- `server/initAuth.ts` - Added `mustChangePassword?: boolean` to UserRecord; SEC-03 scan in `_migrateUsersJson`; exported function for testing
- `server/authApi.ts` - mustChangePassword gate in POST /login; new POST /change-password route
- `server/authMiddleware.ts` - `/api/auth/change-password` added to PUBLIC_PATHS; change-password purpose token rejected on protected routes
- `src/i18n/translations.ts` - 9 changePassword i18n keys (DE+EN)
- `src/context/AuthContext.tsx` - Extended LoginResult type; mustChangePassword/pendingChangeToken state; changePassword() function
- `src/pages/PasswordChangePage.tsx` - New: full-page password change form
- `src/App.tsx` - Import PasswordChangePage; pre-router mustChangePassword gate in AppRoutes()
- `src/components/outcomes/OutcomesPanel.tsx` - role="img" + aria-label on chart container div
- `tests/mustChangePassword.test.ts` - New: 8 test cases (migration scan, login gate, change-password endpoint)
- `tests/OutcomesPanel.test.tsx` - New: 3 RTL tests confirming aria-label presence

## Decisions Made

- changeToken uses `purpose: 'change-password'`; `verifyLocalToken` extended to also reject this purpose on protected routes (closes T-14-08 elevation-of-privilege threat)
- `_migrateUsersJson` exported for testing — the SEC-03 scan logic needed file-system-level assertions
- mustChangePassword gate is placed in `AppRoutes()` (inside `AuthProvider` tree) — `useAuth()` is available, all routes render PasswordChangePage, no URL bypass is possible (T-14-09 mitigated)
- aria-label placed on the outer wrapper `<div>`, not inside `<ResponsiveContainer>` — Recharts may not forward arbitrary props to the DOM

## Deviations from Plan

**1. [Rule 2 - Missing Critical] Extended verifyLocalToken to reject change-password purpose tokens on protected routes**

- **Found during:** Task 1 (authMiddleware.ts update)
- **Issue:** T-14-08 threat: changeToken misuse as session token on protected routes. Plan only mentioned PUBLIC_PATHS addition; the purpose check was needed to close the threat
- **Fix:** Added `|| payload.purpose === 'change-password'` to the existing challenge-purpose rejection check in `verifyLocalToken`
- **Files modified:** `server/authMiddleware.ts`
- **Verification:** Test 4 (POST /login normal user returns token without changeToken) and backend test suite confirm no regression
- **Committed in:** `10b5e05` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (missing critical security enforcement)
**Impact on plan:** Required for correctness — closes T-14-08 elevation-of-privilege threat. No scope creep.

## Issues Encountered

- RTL test for aria-label initially failed with "multiple elements found" because `afterEach(cleanup)` was missing and two `render()` calls accumulated in the same document. Fixed by adding `afterEach(() => cleanup())` to the describe block.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None — PasswordChangePage wires to a real backend endpoint; no placeholder data.

## Threat Flags

None — all surfaces introduced were in scope of the plan's threat model (T-14-07 through T-14-11).

## Next Phase Readiness

- SEC-03 and A11Y-01 requirements fully closed
- 449/449 tests passing, no regressions
- Ready for Phase 14-04 (TOTP or remaining security quick wins)

---

*Phase: 14-security-quick-wins-performance*
*Completed: 2026-04-17*
