---
phase: 02-server-side-auth-audit
plan: 01
subsystem: server-auth
tags: [auth, jwt, bcrypt, rate-limiting, middleware]
dependency_graph:
  requires: [01-02]
  provides: [server/authApi.ts, server/authMiddleware.ts, server/initAuth.ts]
  affects: [server/index.ts]
tech_stack:
  added: [bcryptjs, jsonwebtoken, @types/bcryptjs, @types/jsonwebtoken]
  patterns: [JWT HS256, bcrypt 12 rounds, in-memory rate limiting with exponential backoff, atomic file write]
key_files:
  created:
    - server/initAuth.ts
    - server/authMiddleware.ts
    - server/authApi.ts
  modified:
    - public/settings.yaml
    - package.json
    - package-lock.json
key_decisions:
  - JWT secret stored in data/jwt-secret.txt via crypto.randomBytes(32), never in public/settings.yaml
  - Fixed OTP code from settings.yaml — no otplib TOTP library (demonstrator-appropriate)
  - OTP brute-force shares lockout counter with password attempts (unified T-02-06 mitigation)
  - req.originalUrl used in middleware (not req.path) for reliable public path matching
metrics:
  duration_seconds: 119
  completed_date: "2026-04-10"
  tasks_completed: 2
  files_created: 3
  files_modified: 3
---

# Phase 2 Plan 1: Server-Side Auth Infrastructure Summary

**One-liner:** JWT HS256 authentication with bcrypt password verification, two-step 2FA login, per-username rate limiting, and challenge-token elevation prevention.

## What Was Built

Three new server files implementing production-grade authentication:

1. **server/initAuth.ts** — Startup module that loads or auto-generates the JWT secret from `data/jwt-secret.txt` (never from `public/`), migrates `users.json` to add bcrypt password hashes for any user missing one, and parses auth config from `settings.yaml`. Exports `initAuth()`, `getJwtSecret()`, `getAuthConfig()`, `loadUsers()`.

2. **server/authMiddleware.ts** — Express middleware that validates JWT Bearer tokens on all routes except the three public auth paths. Uses `req.originalUrl` (not `req.path`) for reliable matching. Rejects challenge-purpose tokens on protected routes.

3. **server/authApi.ts** — Express Router with three endpoints:
   - `POST /api/auth/login`: bcrypt credential check, returns `{ token }` (2FA off) or `{ challengeToken }` (2FA on)
   - `POST /api/auth/verify`: validates challenge token + fixed OTP code, returns `{ token }`
   - `GET /api/auth/config`: public endpoint returning `{ twoFactorEnabled }`

**public/settings.yaml** extended with `auth:` section (twoFactorEnabled, maxLoginAttempts, otpCode).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 479c7b7 | feat(02-01): create initAuth.ts — JWT secret management + users.json migration |
| Task 2 | a0bad28 | feat(02-01): create authMiddleware.ts + authApi.ts — JWT validation + auth endpoints |

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|-----------|
| T-02-01 | JWT verified via jsonwebtoken.verify(); expired tokens rejected |
| T-02-02 | Challenge tokens (purpose='challenge') rejected on protected routes |
| T-02-03 | JWT secret in data/jwt-secret.txt, file mode 0o600, never served by Express static |
| T-02-04 | Per-username rate limiting with exponential backoff (2^count * 1000ms) |
| T-02-05 | Generic "Invalid credentials" error — no username enumeration |
| T-02-06 | OTP brute-force shares lockout counter with password attempts |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all exported functions are fully wired. Note: `server/index.ts` does not yet mount `authApiRouter` or `authMiddleware` — that integration is scoped to Plan 02.

## Threat Flags

None — no new security surface beyond what is described in the plan's threat model.

## Self-Check: PASSED

- server/initAuth.ts: FOUND
- server/authMiddleware.ts: FOUND
- server/authApi.ts: FOUND
- public/settings.yaml auth section: FOUND
- Commit 479c7b7: FOUND
- Commit a0bad28: FOUND
- TypeScript: compiles without errors (npx tsc --noEmit --project tsconfig.server.json)
- No otplib in package.json: CONFIRMED
- req.originalUrl in authMiddleware.ts: CONFIRMED
- purpose='challenge' rejection: CONFIRMED
- jwt-secret.txt path (not public/): CONFIRMED
