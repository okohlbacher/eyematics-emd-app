

Both reviews are complete. Here's the consolidated report.

---

# EMD v1.1 — Architecture & Security Review

## Executive Summary

The codebase is well-structured for a clinical demonstrator with strong fundamentals: zero `any` types, server-side center enforcement, parameterized SQL, atomic file writes, and append-only audit design. However, there are **3 critical security gaps**, significant **code duplication** between production and Vite dev paths, and several medium-priority issues around error handling and API design.

**Totals:** 3 Critical, 10 High, 11 Medium, 11 Low

---

## CRITICAL — Must Fix Before Production

### C-01: No HTTP Security Headers (helmet not installed)
**`server/index.ts`, `package.json`**
No helmet, no CSP, no X-Frame-Options, no HSTS, no X-Content-Type-Options. The app is vulnerable to clickjacking, has no XSS mitigation via CSP, and no HTTPS enforcement.
**Fix:** `npm i helmet` and add as first middleware with CSP, HSTS, and frame-deny directives.

### C-02: Static OTP Code Readable by All Users
**`config/settings.yaml:4`, `server/initAuth.ts:78`, `server/settingsApi.ts:73-80`**
The 2FA code is a static `'123456'` shared across all users, stored in `settings.yaml`, and **exposed to every authenticated user** via `GET /api/settings`. Any authenticated user can read the OTP and complete 2FA for any account.
**Fix:** Strip `auth` section from settings response for non-admin users. For real 2FA, implement per-user TOTP with `otplib`.

### C-03: Vite Dev `validateAuth` Trusts Base64-Decoded Tokens Without Signature Verification
**`server/utils.ts:39-68`**
Dev plugins decode the Authorization header as base64 JSON and trust the contents — no JWT signature verification. Also validates against a hardcoded `KNOWN_USERS` list that drifts from `users.json`.
**Fix:** Use `jwt.verify()` with the real secret in dev plugins, or share `verifyLocalToken` from `authMiddleware.ts`.

---

## HIGH — Should Fix Soon

### H-01: Massive Code Duplication Between Production Handlers and Vite Plugins
**`server/issueApi.ts` (82-180 vs 182-284), `server/settingsApi.ts` (67-133 vs 135-211)**
Near-identical logic duplicated between `*Handler` and `*Plugin` functions. Bug fixes must be applied twice.
**Fix:** Extract shared pure functions; only auth-check mechanism should differ between call sites.

### H-02: Divergent Center Filtering Between `fhirApi.ts` and `fhirApiPlugin.ts`
**`server/fhirApi.ts:104-156` vs `server/fhirApiPlugin.ts:49-69`**
Production handles Organization + Patient-level `meta.source` filtering with subject-reference cascade. Dev plugin only implements Organization-based filtering and keeps bundles without Organization entries. Data appears/disappears depending on mode.
**Fix:** Import and reuse `filterBundlesByCenters` from `fhirApi.ts` in the dev plugin.

### H-03: Audit Log Readable by All Authenticated Users
**`server/auditApi.ts:37-58`**
No role check — any researcher can query the full audit log including other users' activities and admin actions.
**Fix:** Restrict to admin role, or auto-scope `filters.user = req.auth.preferred_username` for non-admins.

### H-04: `GET /api/settings` Exposes Full Config to All Users
**`server/settingsApi.ts:73-80`**
Returns `auth.otpCode`, `auth.maxLoginAttempts`, `dataSource.blazeUrl` to all authenticated users.
**Fix:** Return sanitized subset for non-admin users; strip `auth` section entirely.

### H-05: Default Password `changeme2025!` With No Forced Change
**`server/initAuth.ts:246`**
All 7 default users get the same password on migration. No `mustChangePassword` mechanism exists.
**Fix:** Add `mustChangePassword` flag; force change on first login.

### H-06: No CSRF Protection on State-Mutating Endpoints
**`server/index.ts`**
Mitigated by Bearer token pattern (browsers don't auto-attach custom headers), but no explicit defense-in-depth.
**Fix:** Acceptable given current auth scheme; add CSRF tokens if cookies are ever introduced.

### H-07: Audit Body Redaction Missing Password Reset Endpoint
**`server/auditMiddleware.ts:48-53`**
`REDACT_PATHS` doesn't include `/api/auth/users/:username/password`. Actual risk is low (request body is empty, response body isn't captured), but defense-in-depth is incomplete.
**Fix:** Add pattern match for `/api/auth/users/*/password` to `REDACT_PATHS`.

### H-08: Rate Limiter Is In-Memory Only
**`server/rateLimiting.ts`**
Server restart clears all lockout state. No IP-based rate limiting.
**Fix:** Persist to SQLite audit DB; add `express-rate-limit` for IP-based limiting.

### H-09: No Rate Limiting on Non-Auth Endpoints
**`server/index.ts`**
Only `/api/auth/login` and `/api/auth/verify` are rate-limited. Authenticated users can make unlimited requests to audit export, FHIR bundles, data writes.
**Fix:** Add global `express-rate-limit` on `/api/*` (e.g., 100 req/min/IP).

### H-10: Center Validation Allows Unknown Case IDs Through
**`server/dataApi.ts:45-56`**
Comment states: "If caseId is not in the index, allow it." A user can write quality flags for case IDs from unauthorized centers before FHIR data loads.
**Fix:** Reject unknown case IDs rather than allowing them through.

---

## MEDIUM — Improvement Recommended

### M-01: Optimistic State Updates With Fire-and-Forget Server Calls
**`src/context/DataContext.tsx:139-212`**
Mutations update local state immediately, then fire server calls whose failures are only `console.error`'d. User sees success when server may have rejected.
**Fix:** Switch to server-first pattern — update local state only after server confirms. Critical for clinical data.

### M-02: Monolithic "God Context" in DataContext
**`src/context/DataContext.tsx`**
18 properties/methods spanning FHIR bundles, centers, cases, searches, flags, exclusions, reviews. Any state change re-renders all consumers.
**Fix:** Split into domain-specific contexts or use selective-subscription state manager.

### M-03: Duplicate Center Shorthands on Client and Server
**`src/services/fhirLoader.ts:148-154` vs `server/constants.ts:55-61`**
Client hardcodes center mappings; server loads from `centers.json`. They can drift.
**Fix:** Expose center metadata via API; remove client-side hardcoded map.

### M-04: Settings Service Fire-and-Forget Writes
**`src/services/settingsService.ts:79-112`**
`updateSettings()`/`resetSettings()` update cache synchronously, then fire-and-forget the PUT. No way for callers to know if save failed.
**Fix:** Make async; return server result; callers await and handle errors.

### M-05: `bcrypt.compareSync` Blocks Event Loop
**`server/authApi.ts:129`, `:320`, `:399`**
Sync bcrypt with 12 rounds blocks ~250ms per call. Under concurrent logins, all requests queue.
**Fix:** Use `bcrypt.compare()` and `bcrypt.hash()` (async versions).

### M-06: Issue/Settings Handlers Use Raw HTTP Types With `as unknown as` Casts
**`server/issueApi.ts:82-86`, `server/settingsApi.ts:67-71`**
Production handlers cast `http.IncomingMessage` to `express.Request` via double-cast, suppressing all type safety.
**Fix:** Refactor into proper Express Routers now that they're production code.

### M-07: `QualityFlag` Type Missing `id` Field on Client
**`src/types/fhir.ts:177-184`**
Server returns `id` but client type doesn't declare it. IDs are silently dropped; PUT sends flags without IDs, causing new UUIDs each time.
**Fix:** Add `id: string` to the `QualityFlag` interface.

### M-08: JWT Uses HS256 (Symmetric)
**`server/authApi.ts:64`**
Acceptable for single-server demonstrator. Secret is 256-bit with proper file permissions. Document limitation; migrate to RS256 for production.

### M-09: No Token Refresh Mechanism
**`server/authApi.ts:64`, `src/context/AuthContext.tsx`**
10-minute JWT expiry with no refresh endpoint. Active users hit silent 401s after 10 minutes. Client inactivity timer is independent of JWT lifetime.
**Fix:** Implement `POST /api/auth/refresh` or extend JWT expiry to match inactivity timeout.

### M-10: Issue API Accepts Arbitrary Content to Filesystem
**`server/issueApi.ts:112-119`**
No field length limits; screenshot base64 could be large. Content not sanitized for XSS if rendered elsewhere.
**Fix:** Add max field length validation; cap screenshot size.

### M-11: Audit Export Loads All Records Into Memory
**`server/auditDb.ts:207-218`**
`queryAuditExport()` loads everything. With 90-day retention, could be hundreds of thousands of records.
**Fix:** Implement streaming export or add pagination.

---

## LOW — Minor/Cosmetic

| ID | Finding | File |
|----|---------|------|
| L-01 | Settings config read from disk on every FHIR request | `server/fhirApi.ts:205-218` |
| L-02 | Startup logic is imperative top-level code, no `main()` or graceful shutdown | `server/index.ts` |
| L-03 | Redundant `authMiddleware` on `/api/fhir-proxy` (already global on `/api`) | `server/index.ts:188` |
| L-04 | ErrorBoundary hardcoded English, ignores i18n | `src/components/ErrorBoundary.tsx:22-26` |
| L-05 | No global 401 interceptor — expired JWT during active use causes scattered errors | `src/context/DataContext.tsx` |
| L-06 | `Request.auth` type augmentation duplicated in two files | `auditMiddleware.ts` + `authMiddleware.ts` |
| L-07 | PUT for quality flags does full replacement but client uses it as PATCH semantics | `server/dataApi.ts` |
| L-08 | `activeCases` filter uses `Array.includes()` — O(n*m), could use Set | `src/context/DataContext.tsx:134-137` |
| L-09 | No HTTPS enforcement at application level | `src/services/authHeaders.ts` |
| L-10 | `loadUsers()` reads disk synchronously on every call | `server/initAuth.ts:124-133` |
| L-11 | Inconsistent body size limits (1MB for Express routes, 10MB for raw handlers) | `server/index.ts:152-153` |

---

## Positive Observations

- **Zero `any` types** across the entire codebase
- **Server-side center enforcement** — client never receives unauthorized data
- **Parameterized SQL** throughout — no injection risk
- **Atomic file writes** with temp-file + rename + write-lock serialization
- **Append-only audit** by API design (no write endpoints exposed)
- **Server-derived `flaggedBy`** — ignores client-supplied values
- **Challenge token rejection** in auth middleware
- **Static `/data/*` blocked** with 403 — forces use of authenticated API
- **Generic error messages** — login failures don't reveal whether username or password was wrong
- **Crypto-strong password generation** via `crypto.randomBytes`
- **Well-documented middleware ordering** with numbered comments

---

## Recommended Priority Order

1. **C-01** — Install helmet (low effort, high impact)
2. **C-02 + H-04** — Strip auth config from non-admin settings response
3. **H-01 + H-02 + C-03** — Consolidate dev/prod duplication (eliminates auth bypass and filtering divergence)
4. **H-03** — Scope audit queries by role
5. **M-01** — Server-first mutations in DataContext
6. **M-05** — Async bcrypt
7. **H-08 + H-09** — Persistent rate limiting
