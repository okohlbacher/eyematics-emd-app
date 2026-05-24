---
phase: 32-user-management-auth-hardening
plan: 01
subsystem: auth
tags: [umgmt, activation, login-gate, session-revocation, dialog-validation, i18n]
dependency_graph:
  requires: []
  provides: [UserRecord.active, _migrateActiveFlag, login-inactive-gate, PUT-active-toggle, edit-dialog-validation, activation-checkbox]
  affects: [server/initAuth.ts, server/authApi.ts, src/pages/AdminPage.tsx, src/i18n/translations.ts]
tech_stack:
  added: []
  patterns: [startup-migration-idempotent, generic-401-non-enumeration, try-catch-sessionsDb-uninit, RTL-no-jest-dom]
key_files:
  created: [tests/adminUserDialog.test.tsx]
  modified: [server/initAuth.ts, server/authApi.ts, src/pages/AdminPage.tsx, src/i18n/translations.ts, tests/initAuthMigration.test.ts, tests/userCrud.test.ts]
decisions:
  - "Inactive gate placed after bcrypt.compare success + limiter reset — preserves lockout counter behavior; same generic 401 as bad credentials (T-02-05 non-enumeration)"
  - "wasDeactivated flag captured inside modifyUsers callback, revokeByUsername called after write commits — mirrors PROT-001 DELETE handler pattern exactly"
  - "editActive seeded from user.active !== false (absent → true) — migration-safe"
  - "Test file extension .tsx required for JSX rendering in adminUserDialog test"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-21T18:18:42Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 1
  files_modified: 6
---

# Phase 32 Plan 01: User Activation Lifecycle & Dialog Hardening Summary

User activation lifecycle (UMGMT-03) with login gate + session revocation, edit-dialog center enforcement (UMGMT-01), and all-fields-mandatory validation in both create and edit dialogs (UMGMT-02) with DE+EN i18n keys and behavioral RTL tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add active flag to UserRecord with startup migration | 42457ff | server/initAuth.ts, tests/initAuthMigration.test.ts |
| 2 | Reject inactive users at login; PUT active toggle revokes sessions | be984bb | server/authApi.ts, tests/userCrud.test.ts |
| 3 | Edit-dialog validation + activation checkbox in AdminPage | 5848ed0 | src/pages/AdminPage.tsx, src/i18n/translations.ts, tests/adminUserDialog.test.tsx |

## Key Changes

### server/initAuth.ts
- Added `active?: boolean` to `UserRecord` interface (documented: absent === active, migration target)
- Added exported `_migrateActiveFlag(users)` pure helper — mirrors `_migrateSessionFields` exactly: sets `active: true` only when field is not a boolean, preserves explicit `false`, idempotent
- Invoked `_migrateActiveFlag` in `_migrateUsersJson` after session-field migration block with `needsWrite` pattern and console.log

### server/authApi.ts
- `POST /login`: inactive gate after `limiter().resetAttempts(key)` — `user.active === false` → generic `{ error: 'Invalid credentials' }` 401 (T-32-01, T-02-05 non-enumeration)
- `POST /verify`: same gate after user lookup (T-32-02 — held challenge token bypass prevention)
- `PUT /users/:username`: destructures `active` from body; validates boolean (400 on non-boolean, T-32-04); sets `user.active` in `modifyUsers`; captures `wasDeactivated` flag; calls `revokeByUsername(target)` in try/catch after write (T-32-03, PROT-001 parity)
- `GET /users`: projection now includes `active` field

### src/pages/AdminPage.tsx
- `ServerUser` interface: added `active?: boolean`
- `formErrors` state: extended to include `firstName`, `lastName`, `role` fields (UMGMT-02)
- Added `editFormErrors` state for edit-dialog inline errors (UMGMT-01/02)
- Added `editActive` boolean state seeded in `startEdit` from `user.active !== false`
- `handleAdd`: validates `firstName.trim()`, `lastName.trim()`, `role` — inline errors shown
- `handleEditSave`: validates same + `editCenters.length > 0` before authFetch; includes `active: editActive` in PUT body
- Edit row: validation errors under firstName/lastName/role/center inputs; activation checkbox wired to `editActive`
- User table row: `u.active === false` shows muted `adminUserInactiveBadge` span

### src/i18n/translations.ts
- Added `adminUserActive: { de: 'Aktiv', en: 'Active' }` (checkbox label)
- Added `adminUserInactiveBadge: { de: 'inaktiv', en: 'inactive' }` (muted badge)

## Test Results

| Suite | Before | After | Delta |
|-------|--------|-------|-------|
| All tests | 783 | 806 | +23 |
| initAuthMigration.test.ts | 9 | 15 | +6 |
| userCrud.test.ts | 20 | 25 | +5 |
| adminUserDialog.test.tsx | 0 | 9 | +9 (new) |

## Deviations from Plan

**1. [Rule 3 - Blocking] Test file extension .tsx instead of .ts**
- **Found during:** Task 3 — test file compilation
- **Issue:** Plan specified `tests/adminUserDialog.test.ts` but file contains JSX for RTL rendering; Vite/oxc rejects JSX in `.ts` files
- **Fix:** Renamed to `tests/adminUserDialog.test.tsx` — equivalent content, required extension for JSX
- **Files modified:** tests/adminUserDialog.test.tsx (renamed from .ts)

**2. [Rule 2 - Missing validation] sessionsDb mock in userCrud.test.ts**
- **Found during:** Task 2 — new UMGMT-03 tests require asserting `revokeByUsername` was called
- **Issue:** `userCrud.test.ts` had no `sessionsDb` mock; DELETE handler's try/catch swallows uninit error but test can't assert call count
- **Fix:** Added `vi.mock('../server/sessionsDb.js', ...)` with `mockRevokeByUsername` spy; existing tests unaffected

## Threat Model Coverage

All T-32-* threats mitigated:
- T-32-01: Inactive → same generic 401 as bad credentials (POST /login)
- T-32-02: Inactive gate at POST /verify too (challenge token bypass)
- T-32-03: `revokeByUsername` on true→false transition (PROT-001 parity)
- T-32-04: `active` validated as boolean server-side (400 on non-boolean)
- T-32-05: Accepted — existing auditMiddleware covers PUT /users/:username

## Requirements Satisfied

- UMGMT-01: Edit dialog ≥1 center enforcement — DONE
- UMGMT-02: All fields mandatory in both dialogs — DONE
- UMGMT-03: Activation lifecycle (migration, login gate, verify gate, session revocation, UI) — DONE

## Known Stubs

None — all functionality is wired end-to-end.

## Self-Check: PASSED
