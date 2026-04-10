---
phase: 04-user-management-data-persistence
plan: 01
subsystem: server/auth-api
tags: [user-crud, auth-api, write-serialization, audit-redaction, security]
dependency_graph:
  requires: [02-server-side-auth-audit]
  provides: [user-crud-api, saveUsers-export, audit-redaction-expanded]
  affects: [server/authApi.ts, server/initAuth.ts, server/auditMiddleware.ts]
tech_stack:
  added: [supertest (test), crypto (node built-in)]
  patterns: [write-lock-queue, server-generated-passwords, allowlist-validation, TDD]
key_files:
  created: [tests/userCrud.test.ts]
  modified: [server/authApi.ts, server/initAuth.ts, server/auditMiddleware.ts, vitest.config.ts, package.json]
decisions:
  - "Server-generated passwords on both POST /users and PUT /users/:username/password — no plaintext ever in request body (T-04-07)"
  - "In-process write lock queue (acquireWriteLock/releaseWriteLock) for serialized concurrent admin writes (T-04-08)"
  - "VALID_CENTERS allowlist defined server-side as a Set (not imported from client fhirLoader.ts) to avoid client/server coupling (T-04-06)"
  - "GET /users/me placed before GET /users route so Express literal match takes precedence"
metrics:
  completed_date: "2026-04-10"
  tasks: 2
  files_modified: 5
  files_created: 1
---

# Phase 4 Plan 1: User CRUD API Backend Summary

Server-side user management API with five endpoints on authApiRouter: GET /users/me (any auth), GET /users (admin-only), POST /users (auto-generated password + centers validation), DELETE /users/:username (self-delete guard), PUT /users/:username/password (server-generated, no plaintext in request body). Backed by serialized atomic writes via exported saveUsers() with in-process write lock.

## Tasks Completed

### Task 1: saveUsers() export + audit redaction expansion
**Commit:** dc474b3

Added `saveUsers(UserRecord[]): Promise<void>` to `server/initAuth.ts` with an in-process write lock queue (`_writeLock`, `_writeQueue`, `acquireWriteLock`, `releaseWriteLock`) that serializes concurrent admin mutations, then calls the existing private `_atomicWrite`. Expanded `REDACT_PATHS` in `server/auditMiddleware.ts` to include `/api/auth/users` and added `generatedPassword` to `REDACT_FIELDS` as defense-in-depth for the one-time password returned in POST /users responses.

### Task 2: User CRUD endpoints + TDD tests
**Commit:** ffe9703

Added five user-related routes to `authApiRouter` in `server/authApi.ts`:

- **GET /users/me** — returns `{ username, role, centers, firstName, lastName }` from JWT + user record lookup for any authenticated user
- **GET /users** — admin-only guard (`role !== 'admin'` → 403); strips passwordHash from response
- **POST /users** — validates username (non-empty), role (VALID_ROLES Set, defaults to researcher), centers (VALID_CENTERS allowlist → 400 on invalid), duplicate username case-insensitive 409; generates 16-char base64url password via `crypto.randomBytes`; bcrypt round 12; returns `{ user, generatedPassword }` with `Cache-Control: no-store`
- **DELETE /users/:username** — admin only; case-insensitive self-delete guard → 409; 404 on missing user; splices and saves
- **PUT /users/:username/password** — admin only; server-generates new password (no `req.body.password` read); bcrypt round 12; `Cache-Control: no-store`

Also created `tests/userCrud.test.ts` (15 test cases with supertest) covering all five endpoints and their error paths, restored `vitest.config.ts` and updated `package.json` with vitest + supertest dev dependencies.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing test infrastructure in worktree**
- **Found during:** Task 2 (TDD setup)
- **Issue:** Worktree was created from an older commit that predated the vitest/server-deps additions to package.json. `vitest.config.ts`, `tsconfig.server.json`, and full `package.json` were missing from the working directory.
- **Fix:** Restored `vitest.config.ts`, `tsconfig.server.json`, `package.json` (full version with vitest + server deps) from HEAD via `git checkout HEAD -- <files>`, ran `npm install` to populate node_modules, installed `supertest` + `@types/supertest`.
- **Files modified:** `vitest.config.ts`, `tsconfig.server.json`, `package.json`, `package-lock.json`
- **Commit:** ffe9703 (included with Task 2)

**2. [Rule 3 - Blocking] Staged deletions from git reset --soft**
- **Found during:** Initial branch setup
- **Issue:** `git reset --soft c4a610c` left the index in a state where diffs between the old HEAD (4e07e21) and the target commit were staged as deletions of .planning files and modifications to other files. First commit attempt inadvertently included these staged changes.
- **Fix:** Ran `git restore --staged .` to clear the index, then staged only the two target files (`server/initAuth.ts`, `server/auditMiddleware.ts`) before committing Task 1.
- **Commit:** dc474b3 (clean 2-file commit after fix)

**3. [Rule 1 - Design] TDD RED phase not executable**
- **Found during:** Task 2 (TDD RED)
- **Issue:** Bash permission to run `npx vitest run` was denied, preventing confirmation of RED (failing) state before implementation.
- **Action:** Wrote tests first (correct TDD order), then implemented. TypeScript compilation (`npx tsc --noEmit`) used as primary verification. Tests are written to be run by CI or the orchestrator's post-wave hook validation.

## Known Stubs

None. All five endpoints are fully wired to real data (loadUsers/saveUsers) with no placeholder data.

## Threat Flags

No new threat surface beyond what is documented in the plan's threat model. All T-04-01 through T-04-08 mitigations are implemented.

## Self-Check

### Created files exist
- `tests/userCrud.test.ts` — FOUND (created in Task 2 commit)
- `server/authApi.ts` — FOUND (modified in Task 2 commit)
- `server/initAuth.ts` — FOUND (modified in Task 1 commit)
- `server/auditMiddleware.ts` — FOUND (modified in Task 1 commit)

### Commits exist
- `dc474b3` — Task 1: saveUsers() + audit redaction
- `ffe9703` — Task 2: user CRUD endpoints + TDD tests

## Self-Check: PASSED
