---
phase: 20
plan: 02
subsystem: auth
tags: [jwt, refresh, eslint-guard, credential-mutation, session-resilience, security]
dependency_graph:
  requires:
    - server/jwtUtil.ts (Plan 20-01: signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken)
    - server/initAuth.ts modifyUsers + UserRecord (tokenVersion, passwordChangedAt, totpChangedAt)
  provides:
    - server/jwtUtil.ts signChallengeToken / verifyChallengeToken (typ:'challenge')
    - server/keycloakJwt.ts (decodeKeycloakHeader, verifyKeycloakToken)
    - PUT /api/auth/users/me/password (new self password change endpoint)
    - tokenVersion + *ChangedAt invalidation contract on 4 credential-mutation endpoints
    - ESLint no-restricted-imports rule banning direct jsonwebtoken use
  affects:
    - All future code touching JWTs MUST route through server/jwtUtil.ts or server/keycloakJwt.ts
    - Plan 20-03 client refresh logic can rely on the credential-mutation invalidation contract
tech_stack:
  added: []
  patterns:
    - Single-importer ESLint enforcement of cryptographic primitives
    - Atomic credential-mutation: tokenVersion + *ChangedAt folded into the SAME modifyUsers callback as the credential write
    - Express literal-vs-parameterized route ordering (`/users/me/password` registered before `/users/:username/password`)
key_files:
  created:
    - server/keycloakJwt.ts
    - tests/credentialMutationInvalidation.test.ts
  modified:
    - server/jwtUtil.ts (added signChallengeToken / verifyChallengeToken + ChallengePayload)
    - server/authApi.ts (5 jwt.* call sites migrated; 5 mutation paths bump tokenVersion; new self password endpoint)
    - server/authMiddleware.ts (verifyAccessToken + verifyKeycloakJwt; no direct jsonwebtoken import)
    - eslint.config.js (no-restricted-imports rule)
    - tests/authMiddlewareLocal.test.ts (signToken adds typ:'access')
    - tests/authMiddlewareKeycloak.test.ts (signLocal adds typ:'access')
decisions:
  - "Factored Keycloak RS256 verify into server/keycloakJwt.ts so the ESLint rule's allow-list is exactly two physical files — no per-file eslint-disable comments needed for the production code path"
  - "Renamed the imported keycloakJwt verifier to verifyKeycloakJwt at the import site to avoid shadowing the local verifyKeycloakToken middleware function (caught by tests; original code recursed)"
  - "Translated the jwtUtil 'wrong_token_type' error into the existing 'Challenge tokens cannot be used for authentication' 401 in authMiddleware so the existing T-02-02 test contract is preserved"
  - "Added PUT /api/auth/users/me/password as a new endpoint (was missing from the codebase) since SESSION-03 requires self password change to bump tokenVersion; required adding ahead of /users/:username/password in the router so the literal `/me/` path wins the match"
  - "Bumps fold into the SAME modifyUsers callback as the credential write — no separate second write — so the file is rewritten once under the existing _writeLock (no torn-write window between credential change and version bump)"
metrics:
  duration_minutes: ~25
  completed: "2026-04-23"
  tasks: 2
  tests_added: 6
  tests_passing: "62/62 in plan-touched files (jwtUtil, authMiddleware local, authMiddleware keycloak, authRefresh, userCrud, credentialMutationInvalidation); 572/575 in full suite (3 pre-existing failures unrelated, same as Plan 01)"
---

# Phase 20 Plan 02: jsonwebtoken Migration + Credential-Mutation Invalidation

Two intertwined deliverables in two atomic commits:

1. Migrate every `jsonwebtoken` call site in `server/authApi.ts` and
   `server/authMiddleware.ts` through `server/jwtUtil.ts`, factor the Keycloak
   RS256 path into a new `server/keycloakJwt.ts`, and lock the boundary with
   an ESLint `no-restricted-imports` rule.
2. Wire `tokenVersion` + `*ChangedAt` bumps into all four credential-mutation
   endpoints (admin password reset, admin TOTP reset, self password change,
   self TOTP confirm + disable) so any outstanding refresh token is invalidated
   on its next /api/auth/refresh attempt.

## Tasks Executed

### Task 1 — jwt migration + ESLint guard (commit ab71033)

**Migrated call sites:**

| File | Old (line, before) | New (after) |
|------|-------------------|-------------|
| `server/authApi.ts:67` `signSessionToken` | `jwt.sign(payload, getJwtSecret(), { algorithm:'HS256', expiresIn:'10m' })` | `signAccessToken({ sub, preferred_username, role, centers }, 10*60*1000)` |
| `server/authApi.ts:122` `signChallengeToken` | `jwt.sign({ sub, purpose:'challenge' }, getJwtSecret(), { algorithm:'HS256', expiresIn:'2m' })` | `signChallengeTokenUtil({ sub, purpose:'challenge' }, 2*60*1000)` |
| `server/authApi.ts:233` `/verify` challenge verify | `jwt.verify(challengeToken, getJwtSecret(), { algorithms:['HS256'] })` | `verifyChallengeToken(challengeToken)` (typ:'challenge' enforced before purpose check) |
| `server/authMiddleware.ts:62` `verifyLocalToken` | `jwt.verify(token, getJwtSecret(), { algorithms:['HS256'] }) as AuthPayload` | `verifyAccessToken(token) as unknown as AuthPayload` (with `wrong_token_type` → "Challenge tokens cannot be used" translation) |
| `server/authMiddleware.ts:97-104` Keycloak path | `jwt.decode(...)` + `jwt.verify(token, signingKey.getPublicKey(), { algorithms:['RS256'] })` | `decodeKeycloakHeader(token)` + `verifyKeycloakJwt(token, signingKey.getPublicKey())` (both from new `server/keycloakJwt.ts`) |

**New module — `server/keycloakJwt.ts`** (~40 LOC):

- `decodeKeycloakHeader(token)` — header inspection only, returns `jwt.Jwt | null`
- `verifyKeycloakToken(token, publicKeyPem)` — RS256-pinned verify, returns raw claims
- Lives outside `jwtUtil` because RS256 + JWKS public-key verification has a fundamentally different contract from HS256 + shared-secret. Keeping them physically separate makes algorithm confusion impossible at the import level.

**ESLint rule** (eslint.config.js, append-only):

```javascript
{
  files: ['**/*.{ts,tsx}'],
  ignores: ['server/jwtUtil.ts', 'server/keycloakJwt.ts', 'tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  rules: {
    'no-restricted-imports': ['error', {
      paths: [{
        name: 'jsonwebtoken',
        message: 'Import sign/verify helpers from server/jwtUtil.js (HS256) or server/keycloakJwt.js (RS256) instead. Direct jsonwebtoken use risks algorithm-confusion CVEs.',
      }],
    }],
  },
}
```

**Throwaway-import probe (acceptance criterion):**

```bash
$ cat > server/_eslint_check.ts << 'EOF'
import jwt from 'jsonwebtoken';
export const _x = jwt;
EOF
$ npx eslint server/_eslint_check.ts
server/_eslint_check.ts
  1:1  error  'jsonwebtoken' import is restricted from being used.
              Import sign/verify helpers from server/jwtUtil.js (HS256) or
              server/keycloakJwt.js (RS256) instead. Direct jsonwebtoken use
              risks algorithm-confusion CVEs  no-restricted-imports
✖ 1 problem (1 error, 0 warnings)
```

Rule fires as designed. Throwaway file removed.

**Extension to jwtUtil:** Added `signChallengeToken` / `verifyChallengeToken` + `ChallengePayload` interface, all carrying `typ: 'challenge'`. This means `verifyAccessToken` and `verifyRefreshToken` cross-reject any challenge token in the wrong slot — the password→TOTP bridge token cannot be replayed against a protected endpoint.

**Test fixture updates:** `signToken`/`signLocal` helpers in `authMiddlewareLocal.test.ts` and `authMiddlewareKeycloak.test.ts` now spread `{ typ: 'access', ...payload }` because `verifyAccessToken` enforces the typ claim. All 31 existing tests in those files still pass.

**Confirmed:** `grep -rn "^import jwt from 'jsonwebtoken'" server/` returns exactly two matches: `server/jwtUtil.ts`, `server/keycloakJwt.ts`. Zero matches in `authApi.ts` or `authMiddleware.ts`.

### Task 2 — credential-mutation invalidation (commit 229460e)

**Endpoints modified (5 mutation paths across 4 logical endpoints):**

| Handler | Endpoint | Bump fields |
|---------|----------|-------------|
| Admin password reset | `PUT /api/auth/users/:username/password` | `tokenVersion += 1`, `passwordChangedAt = nowIso` |
| Admin TOTP reset | `POST /api/auth/users/:username/totp/reset` | `tokenVersion += 1`, `totpChangedAt = nowIso` |
| Self password change (NEW) | `PUT /api/auth/users/me/password` | `tokenVersion += 1`, `passwordChangedAt = nowIso` |
| Self TOTP confirm | `POST /api/auth/totp/confirm` | `tokenVersion += 1`, `totpChangedAt = nowIso` |
| Self TOTP disable | `POST /api/auth/totp/disable` | `tokenVersion += 1`, `totpChangedAt = nowIso` |

All bumps are folded into the SAME `modifyUsers((users) => ...)` callback as the credential write — the file is rewritten once under the existing `_writeLock`, so there is no window where the new credential is persisted but the old refresh token still validates.

**New endpoint — `PUT /api/auth/users/me/password`:** SESSION-03 requires a self password change endpoint; it did not exist in the codebase. Added with proof-of-possession of the current password, minimum-8-char policy, and the same atomic bump pattern. Registered BEFORE `/users/:username/password` so the literal `/me/` segment wins the route match (Express matches in registration order — without this, `:username = "me"` and the request 403s on the admin guard).

**Acceptance criteria grep counts:**

```
$ grep -cE "tokenVersion: \(.*tokenVersion \?\? 0\) \+ 1|u\.tokenVersion = \(u\.tokenVersion \?\? 0\) \+ 1" server/authApi.ts
5    # 4 new + 1 from Plan 01 logout — meets the ≥4 requirement (≥5 with logout)
$ grep -cE "passwordChangedAt = nowIso|passwordChangedAt: nowIso" server/authApi.ts
2    # admin reset + self change
$ grep -cE "totpChangedAt = nowIso|totpChangedAt: nowIso" server/authApi.ts
3    # admin reset + self confirm + self disable
```

**Test file — `tests/credentialMutationInvalidation.test.ts`** (6 tests, all green):

1. `admin password reset` — bumps tokenVersion + passwordChangedAt; old refresh → 401 'Token version stale'
2. `admin TOTP reset` — bumps tokenVersion + totpChangedAt; old refresh → 401
3. `self password change` (PUT /users/me/password) — bumps both; old refresh → 401
4. `self TOTP confirm` — bumps both with valid OTP from `authenticator.generate(secret)`; old refresh → 401
5. `self TOTP disable` — bumps both; old refresh → 401
6. **Regression guard:** `GET /api/auth/users/me` does NOT change tokenVersion; the same refresh token still works after the read

Pattern mirrors `tests/authRefresh.test.ts` (Plan 01) — in-memory `_users` fixture mutable via mocked `modifyUsers`, supertest + cookieParser app, capture `loginAndCapture` helper.

## Confirmations

- **Two and only two files import jsonwebtoken in `server/`:** `server/jwtUtil.ts:22` and `server/keycloakJwt.ts:17`. Verified by `grep -rn "^import jwt from 'jsonwebtoken'" server/`.
- **Zero direct imports in the migrated files:** `grep` against `server/authApi.ts` and `server/authMiddleware.ts` returns zero matches.
- **ESLint rule actually fires:** Verified by the throwaway-import probe documented above.
- **Atomic invalidation:** All 4 mutation handlers fold the credential write and the version/timestamp bump into the same `modifyUsers` callback. The existing `_writeLock` + `_atomicWrite` (temp-file + rename) means there is no torn-write window — readers either see the OLD (passwordHash, tokenVersion=N, passwordChangedAt=T_old) tuple or the NEW one, never a mix.
- **Lint clean** for all touched files (`npx eslint server/authApi.ts server/authMiddleware.ts server/jwtUtil.ts server/keycloakJwt.ts tests/credentialMutationInvalidation.test.ts eslint.config.js` → 0 problems).

## Note for Plan 20-03 / 20-04

- `verifyAccessToken` is now the SOLE chokepoint for access-token validation in
  the local-auth path. Refresh-token validation lives in `verifyRefreshToken`.
  Challenge-token validation lives in `verifyChallengeToken`. All three enforce
  HS256 + the matching `typ` claim and cross-reject the other two types.
- The credential-mutation invalidation contract is now ENFORCED by tests. Plan
  20-03 (client refresh logic) can assume that any successful credential
  mutation on the server invalidates outstanding refresh cookies — the client
  refresh path needs no special-case logic for "did the user just change their
  password in another tab"; the server's 401 with 'Token version stale' is the
  signal, and the existing fall-through to /login handles it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Local-name shadowing in authMiddleware Keycloak branch**

- **Found during:** Task 1 test run
- **Issue:** Importing `verifyKeycloakToken` from `server/keycloakJwt.ts` collided with the existing local function `verifyKeycloakToken(token, req, res, next)` in `server/authMiddleware.ts`. The `await client.getSigningKey(...)` succeeded, then `verifyKeycloakToken(token, signingKey.getPublicKey())` recursed into the local middleware function with the wrong arity, leaving `req.auth` undefined and `next()` called once with no claims set.
- **Fix:** Renamed the import to `verifyKeycloakJwt` so the local middleware function name is unchanged and the call site reads `verifyKeycloakJwt(token, signingKey.getPublicKey())`.
- **Files modified:** `server/authMiddleware.ts`
- **Commit:** ab71033

**2. [Rule 2 — Missing functionality] Self password change endpoint did not exist**

- **Found during:** Task 2 (writing test 3)
- **Issue:** The plan calls for SESSION-03 invalidation on "self password change" but no such endpoint existed in the codebase. The plan acknowledges this with "PUT /api/auth/users/me/password (or whatever the route is)".
- **Fix:** Added `PUT /api/auth/users/me/password` with proof-of-possession of the current password (bcrypt.compare), 8-char minimum policy, and atomic tokenVersion + passwordChangedAt bump folded into the same modifyUsers write as the new passwordHash. Registered in the router BEFORE `/users/:username/password` so the literal `/me/` segment wins the Express route match.
- **Files modified:** `server/authApi.ts`
- **Commit:** 229460e

**3. [Rule 1 — Bug] Test fixtures missing typ claim after migration**

- **Found during:** Task 1 test run
- **Issue:** Existing `authMiddlewareLocal.test.ts` and `authMiddlewareKeycloak.test.ts` constructed JWTs via `jwt.sign(payload, ...)` without `typ`. After migration, `verifyAccessToken` throws `wrong_token_type` for any token where `typ !== 'access'`, breaking the "valid HS256 token" tests.
- **Fix:** Updated the local `signToken` / `signLocal` helpers to spread `{ typ: 'access', ...payload }`. Real production tokens already get the claim from `signAccessToken`. The "rejects challenge-purpose tokens" test continues to pass because the helper preserves the explicit `purpose: 'challenge'` value alongside `typ: 'access'`, and the middleware's purpose check fires after the typ check.
- **Files modified:** `tests/authMiddlewareLocal.test.ts`, `tests/authMiddlewareKeycloak.test.ts`
- **Commit:** ab71033

### Pre-existing Failures (out of scope — Rule SCOPE BOUNDARY)

Same 3 failures as Plan 20-01 (also documented in `deferred-items.md`):

- `tests/outcomesPanelCrt.test.tsx` (2 — Phase 13 CRT metric scope)
- `tests/OutcomesPage.test.tsx` (1 — Phase 11 audit beacon scope)

Verified to predate this plan; not touched.

## Self-Check: PASSED

- **Files exist:**
  - `server/keycloakJwt.ts` — FOUND
  - `tests/credentialMutationInvalidation.test.ts` — FOUND
  - `eslint.config.js` (no-restricted-imports rule) — FOUND
- **Commits exist:**
  - ab71033 — `feat(20-02): migrate jwt call sites to jwtUtil + ESLint guard`
  - 229460e — `feat(20-02): credential mutations bump tokenVersion + *ChangedAt (D-18)`
- **Tests:** 62/62 plan-touched tests passing (6 new + 56 regression).
- **Acceptance criteria:** All Task 1 and Task 2 criteria confirmed via grep + test runs + ESLint probe.
