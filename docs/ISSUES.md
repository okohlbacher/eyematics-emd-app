# Known Issues — EMD v1.3

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

## Open Architecture Questions

### Center ID Lifecycle and Mapping

**Severity:** Architecture gap (not a bug — needs design decision)

It is unclear how the following aspects of center management work end-to-end:

1. **Site list provenance:** Where does the authoritative list of participating sites come from? Currently `data/centers.json` is manually maintained per deployment. In a multi-site DSF deployment, the list of participating sites should ideally be derived from DSF Organization/Endpoint resources, not a static file.

2. **Center-to-account assignment:** How are centers assigned to user accounts in practice? Currently an admin manually selects centers when creating a user (`POST /api/auth/users`). There is no automated sync between DSF site membership and EMD user center assignments.

3. **Center ID mapping to Blaze and DSF:** The EMD uses `org-*` prefixed IDs (e.g., `org-uka`). It is not documented how these map to:
   - Blaze FHIR server Organization resource IDs
   - DSF Organization/Endpoint resource identifiers
   - The `Patient.meta.source` field used for center-based filtering of Blaze bundles

4. **Adding/removing sites:** No documented process exists for onboarding a new site or decommissioning one. Changes require manual edits to `data/centers.json`, `data/users.json`, and potentially FHIR bundle filenames.

**Recommendation:** Define a center lifecycle document covering provisioning, ID mapping conventions, DSF integration, and user assignment workflows. For the demonstrator, the current manual approach is sufficient. For production multi-site deployment, consider auto-discovering centers from DSF or a central registry.

## Resolved Issues

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| H-01 | High | Code duplication (issueApi + settingsApi) | **Fixed** — Express Router refactor |
| H-02 | High | Divergent center filtering in dev vs prod | **Fixed** — shared functions |
| H-03 | High | Audit log readable by all users | **Fixed** — auto-scoped by role |
| H-06 | High | FHIR proxy bypasses center filtering | **Fixed** — admin-only |
| H-07 | High | Audit body missing for mutations | **Fixed** — readBody sets _capturedBody |
| H-10 | High | Center validation allows unknown case IDs | **Fixed** — strict rejection |
| M-03 | Medium | Duplicate center shorthands client/server | **Fixed** — GET /api/fhir/centers |
| M-05 | Medium | bcrypt.compareSync blocks event loop | **Fixed** — async compare/hash |
| M-07 | Medium | QualityFlag type missing `id` field | **Fixed** — added to interface |

## Test Coverage Gaps

| ID | Severity | Module | Gap | Status |
|----|----------|--------|-----|--------|
| T-01 | High | `settingsApi.ts` | Admin-only PUT guard, non-admin field stripping | **Fixed** — `settingsApi.test.ts` (8 tests) |
| T-02 | High | `auditMiddleware.ts` | Body redaction for passwords/OTP | **Fixed** — `auditMiddleware.test.ts` (9 tests) |
| T-03 | High | `rateLimiting.ts` | Lockout, backoff cap, cleanup | **Fixed** — `rateLimiting.test.ts` (11 tests) |
| T-04 | Medium | `dataDb.ts` | CRUD for flags, searches, exclusions, reviews | **Fixed** — `dataDb.test.ts` (16 tests) |
| T-05 | Medium | `issueApi.ts` | Issue creation, listing, export | **Fixed** — `issueApi.test.ts` (6 tests) |
| T-06 | Medium | `auditApi.ts` | Admin-only export, auto-scoping | **Fixed** — `auditApi.test.ts` (7 tests) |
| T-07 | Medium | `authMiddleware.ts` | Local HS256 verification | **Fixed** — `authMiddlewareLocal.test.ts` (8 tests) |
| T-08 | Low | `fhirApiPlugin.ts` | Vite dev plugin | Deferred (dev-only) |
| T-09 | Low | `utils.ts` | `readBody`, `validateAuth` | Deferred (dev-only) |
| T-10 | Low | `src/components/`, `src/pages/` | React component tests | Deferred (needs jsdom setup) |

## Accepted (Demonstrator)

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| M-01 | Medium | Optimistic state updates (fire-and-forget) | Accepted |
| M-09 | Medium | No JWT token refresh mechanism | Accepted |
