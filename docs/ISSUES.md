# Known Issues — EMD v1.1

Issues identified during architecture/security review (2026-04-11). Deferred because the EMD is currently a demonstrator, not a production clinical system.

## Deferred (Demonstrator-Only)

### C-02: Static OTP code readable by all users

**Severity:** Critical (production) / Accepted (demonstrator)

The 2FA OTP code is a static `'123456'` shared by all users, stored in `config/settings.yaml`. The `GET /api/settings` endpoint returns the full config including `auth.otpCode` to all authenticated users (not just admins).

**Impact:** Any authenticated user can read the OTP and complete 2FA for any account.

**Fix (for production):**
1. Strip `auth` section from settings response for non-admin users
2. Implement per-user TOTP with `otplib` and per-user secrets in `users.json`

### C-03: Vite dev mode uses unsigned base64 tokens

**Severity:** Critical (if dev server exposed) / Accepted (local dev only)

The `validateAuth()` function in `server/utils.ts` (used by Vite dev plugins) decodes Authorization headers as base64 JSON without cryptographic verification. Validates against a hardcoded `KNOWN_USERS` list that can drift from `users.json`.

**Impact:** In dev mode, tokens are trivially forgeable. Any user who knows a username can craft a valid admin token.

**Fix (for production):**
1. Use `jwt.verify()` with the real JWT secret in dev plugins
2. Or share `verifyLocalToken` from `authMiddleware.ts`
3. Remove `KNOWN_USERS` from `utils.ts`, load from `users.json` via `loadUsers()`

## Other Noted Issues

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| H-03 | High | Audit log readable by all users (no role check) | **Fixed** — auto-scoped by role |
| H-06 | High | FHIR proxy has no center filtering | **Fixed** — admin-only |
| H-07 | High | Audit body missing for issue/settings mutations | Open |
| H-10 | High | Center validation allows unknown case IDs | **Fixed** — strict rejection |
| M-01 | Medium | Optimistic state updates (fire-and-forget) | Accepted (demonstrator) |
| M-05 | Medium | bcrypt.compareSync blocks event loop | Open |
| M-07 | Medium | QualityFlag type missing `id` field on client | Open |
| M-09 | Medium | No JWT token refresh mechanism | Accepted (demonstrator) |
