---
phase: 06-keycloak-preparation
plan: "01"
subsystem: auth
tags: [keycloak, jwks, rs256, auth-middleware, jwt]
dependency_graph:
  requires: []
  provides: [keycloak-jwks-client, auth-provider-branching, settings-auth-block]
  affects: [server/authMiddleware.ts, server/initAuth.ts, server/keycloakAuth.ts, public/settings.yaml]
tech_stack:
  added: [jwks-rsa]
  patterns: [JWKS RS256 validation, provider-branched middleware, claim normalization]
key_files:
  created:
    - server/keycloakAuth.ts
    - tests/authMiddlewareKeycloak.test.ts
  modified:
    - server/authMiddleware.ts
    - server/initAuth.ts
    - public/settings.yaml
    - package.json
decisions:
  - "vi.spyOn used instead of vi.mock to allow real keycloakAuth unit tests and mocked middleware tests in same file"
  - "authMiddleware changed from sync to async (Express 5 handles async natively)"
  - "verifyLocalToken extracted as named helper preserving exact existing HS256 behavior"
metrics:
  duration_min: 12
  completed: "2026-04-10T21:20:44Z"
  tasks_completed: 2
  files_changed: 6
---

# Phase 06 Plan 01: Keycloak Auth Infrastructure Summary

**One-liner:** RS256 JWKS auth middleware with provider branching — local HS256 unchanged, Keycloak mode validates via jwks-rsa with claim normalization and 503 fail-closed.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create keycloakAuth.ts, extend initAuth.ts, update settings.yaml | 57fc61f | server/keycloakAuth.ts, server/initAuth.ts, public/settings.yaml, package.json, tests/authMiddlewareKeycloak.test.ts |
| 2 | Branch authMiddleware for Keycloak RS256 JWKS validation | 7a512e8 | server/authMiddleware.ts, tests/authMiddlewareKeycloak.test.ts |

## What Was Built

**server/keycloakAuth.ts** — New module managing JWKS client singleton:
- `initKeycloakAuth(issuer)` — configures jwks-rsa client with 10min cache TTL and rateLimit (T-06-02)
- `getAuthProvider()` — returns current provider ('local' | 'keycloak'), defaults to 'local'
- `getJwksClient()` — returns JwksClient instance or null
- `_resetForTesting()` — test-only state reset

**server/initAuth.ts** — Extended with Keycloak config parsing:
- Parses `auth.provider` from settings; calls `initKeycloakAuth(kc.issuer)` when provider=keycloak
- Throws with clear message if `auth.keycloak.issuer` missing when provider=keycloak

**server/authMiddleware.ts** — Now async, branches on provider:
- `verifyLocalToken` — existing HS256 behavior extracted unchanged
- `verifyKeycloakToken` — RS256 JWKS validation with explicit `algorithms: ['RS256']` (T-06-01)
- 503 fail-closed when JWKS unreachable (D-03, T-06-05)
- Claim normalization: role array→string, centers string→array (T-06-03)
- Challenge tokens rejected in both modes (T-02-02)

**public/settings.yaml** — auth section added with `provider: local` default and commented keycloak block.

**tests/authMiddlewareKeycloak.test.ts** — 13 tests covering all behaviors.

## Verification

- `npx vitest run tests/authMiddlewareKeycloak.test.ts` — 13/13 passed
- `npx vitest run` — 45/45 passed (no regressions)
- `npx tsc --noEmit -p tsconfig.server.json` — 0 errors in new/modified files (3 pre-existing errors in authApi.ts unrelated to this plan)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed with one implementation adaptation:

**Approach: vi.spyOn instead of vi.mock for keycloakAuth module**
- **Found during:** Task 2 test writing
- **Issue:** `vi.mock` is hoisted by Vitest, replacing exports even in the first describe block which tests the real keycloakAuth functions directly — caused `getAuthProvider()` to return the mocked value in the unit tests
- **Fix:** Used `vi.spyOn` on the already-imported module instance, which allows both real-function unit tests and spy-controlled middleware tests in the same file without hoisting conflicts
- **Impact:** Tests pass correctly; no production code affected
- **Commit:** 7a512e8

## Deferred Issues (Pre-existing, Out of Scope)

- `server/authApi.ts` lines 350, 356, 383: TypeScript errors `Property 'toLowerCase' does not exist on type 'string | string[]'` — pre-existed before this plan, unrelated to Keycloak work. Not fixed per scope boundary rule.

## Known Stubs

None — all exported functions are fully implemented.

## Threat Flags

No new security-relevant surface beyond the plan's threat model. All T-06-0x mitigations implemented as specified.

## Self-Check: PASSED

Files exist:
- server/keycloakAuth.ts: FOUND
- server/authMiddleware.ts: FOUND (modified)
- server/initAuth.ts: FOUND (modified)
- public/settings.yaml: FOUND (modified)
- tests/authMiddlewareKeycloak.test.ts: FOUND

Commits exist:
- 57fc61f: FOUND
- 7a512e8: FOUND
