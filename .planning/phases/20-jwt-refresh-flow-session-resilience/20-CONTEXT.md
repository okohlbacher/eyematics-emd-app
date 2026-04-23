# Phase 20: JWT Refresh Flow & Session Resilience - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning
**Mode:** `--auto` — recommended defaults selected for all gray areas; no interactive Q&A.

<domain>
## Phase Boundary

Ship an access/refresh token split for the EMD local-auth flow:
- **Server:** new `POST /api/auth/refresh` (httpOnly cookie consumer), `POST /api/auth/logout` extension, `tokenVersion` / `passwordChangedAt` / `totpChangedAt` per user, central `server/jwtUtil.ts` with HS256 hard-pin, ESLint guard against direct `jsonwebtoken` verify imports.
- **Client:** `authFetch` silent-refresh on 401 with single-flight lock and one retry; `BroadcastChannel('emd-auth')` cross-tab coordination; access token stays Bearer-in-memory, refresh token never touched by JS.
- **Audit/i18n:** `audit_action_refresh` / `audit_action_logout` keys (DE+EN), refresh **success** events excluded via `SKIP_AUDIT_PATHS`, refresh **failures** + logouts audited; extend `describeAction` (now in `src/pages/audit/auditFormatters.ts` per Phase 19).
- **Settings:** new `auth.refreshTokenTtlMs` (default 8h) and `auth.refreshAbsoluteCapMs` (default 12h) in `config/settings.yaml`.

In scope: SESSION-01..09, SESSION-12, SESSION-13.
**Out of scope:** SESSION-10 (force sign-out everywhere), SESSION-11 (stateful refresh-sessions table with OAuth2 rotation), KEYCLK-01 (Keycloak OIDC redirect).
</domain>

<decisions>
## Implementation Decisions

### Module Layout
- **D-01:** New file `server/jwtUtil.ts` exporting `verifyAccessToken`, `verifyRefreshToken`, `signAccessToken`, `signRefreshToken`. ALL existing `jwt.verify` / `jwt.sign` call sites in `server/authApi.ts` and `server/authMiddleware.ts` migrate to import from here.
- **D-02:** Refresh client logic lives in `src/services/authHeaders.ts` (extend existing 31-LOC file, do NOT create a parallel hook). Single-flight lock + retry guard + BroadcastChannel coordination all colocated with `authFetch`.
- **D-03:** `cookie-parser` is the **only** new npm dependency this milestone (pre-approved in roadmap accumulated context).
- **D-04:** ESLint `no-restricted-imports` rule added to `eslint.config.js`: bans `import * from 'jsonwebtoken'` (and named verify/sign imports) outside `server/jwtUtil.ts`.

### Token Strategy
- **D-05:** Access token: HS256, 10 min TTL (unchanged from v1.7), Bearer-in-memory only (`sessionStorage.emd-token`).
- **D-06:** Refresh token: HS256, default 8h TTL (`auth.refreshTokenTtlMs`), httpOnly `Secure` `SameSite=Strict` cookie scoped to `Path=/api/auth/refresh`. NEVER readable by JS.
- **D-07:** Refresh token payload: `{ sub: username, ver: tokenVersion, iat, exp, sid }` where `sid` is the original login session id (used to enforce `auth.refreshAbsoluteCapMs` 12h absolute cap independent of rolling refresh).
- **D-08:** Same JWT signing secret (`data/jwt-secret.txt`) for both access and refresh tokens — secret rotation is a separate concern. Tokens distinguished by a `typ` claim (`'access'` | `'refresh'`); `verifyAccessToken` rejects refresh tokens and vice versa.

### Refresh Flow
- **D-09:** `authFetch` 401 path: parse response, if `WWW-Authenticate: Bearer error="token_expired"` (or generic 401 with no body), invoke `refreshAccessToken()` once, then retry the original request EXACTLY ONCE. If refresh fails or retry returns 401, fall through to current behavior (clear sessionStorage, redirect to /login).
- **D-10:** **Retry-loop guard:** mark the retried request with a private symbol/header (`X-EMD-Retry-After-Refresh: 1`); if the retry itself returns 401, do NOT refresh again — go straight to logout.
- **D-11:** **Single-flight lock:** module-level `let refreshPromise: Promise<string> | null = null;` ensures only one network refresh per tab; concurrent 401s `await` the same promise.
- **D-12:** **Cross-tab coordination:** `BroadcastChannel('emd-auth')` events: `refresh-start { sid }`, `refresh-success { token, expiresAt }`, `refresh-failure { reason }`, `logout`. Tab that receives `refresh-success` adopts the new token without firing its own refresh. 5-second server grace window (D-19) absorbs near-simultaneous misses.

### Server-Side Refresh Endpoint
- **D-13:** `POST /api/auth/refresh` reads refresh JWT from `req.cookies['emd-refresh']` (cookie-parser), verifies via `verifyRefreshToken`, looks up user, checks `payload.ver === user.tokenVersion`, checks `now - payload.iat <= refreshAbsoluteCapMs`, then issues a fresh access token (10 min) AND a fresh refresh token (rolling — new 8h cookie). Returns `{ token: <access>, expiresAt }` JSON; refresh cookie set via `Set-Cookie`.
- **D-14:** **CSRF protection:** double-submit-cookie pattern — login response sets a non-httpOnly `emd-csrf` cookie (random 32-byte hex); `POST /api/auth/refresh` requires header `X-CSRF-Token` matching the cookie value. Implementation in `server/authMiddleware.ts` as `requireCsrf` middleware applied only to `/api/auth/refresh` and `/api/auth/logout`.
- **D-15:** `POST /api/auth/logout` extended: clears refresh cookie (`Set-Cookie: emd-refresh=; Max-Age=0; Path=/api/auth/refresh`), clears CSRF cookie, bumps `tokenVersion` for the user (invalidates all outstanding refresh tokens for this user), audits as `audit_action_logout`.

### Credential-Mutation Invalidation (SESSION-03)
- **D-16:** Add three columns to user records in `data/users.json`: `tokenVersion: number` (default 0), `passwordChangedAt: string` (ISO), `totpChangedAt: string` (ISO).
- **D-17:** **Lazy migration:** on server boot, `initAuth.ts` reads `users.json`; for any user missing these fields, fills with defaults (`tokenVersion: 0`, both timestamps = `user.createdAt` or now), writes file back atomically. No separate migration script.
- **D-18:** Mutation endpoints that bump `tokenVersion`: admin password reset, admin TOTP reset, self password change, self TOTP change. Each also bumps the matching `*ChangedAt` timestamp. After bump, current session's refresh token becomes invalid on next `/api/auth/refresh` (returns 401, client falls through to logout).

### Audit & i18n
- **D-19:** Add `/api/auth/refresh` to `SKIP_AUDIT_PATHS` in `server/auditMiddleware.ts` for **successful** refreshes (200 responses) — high-volume background event, would dominate audit log. **Failed** refreshes (401/403) ARE audited via existing error-path logic.
- **D-20:** `POST /api/auth/logout` always audited as `logout` action.
- **D-21:** Add to `src/i18n/de.ts` and `src/i18n/en.ts`: `audit_action_refresh` (DE: "Token erneuert" / EN: "Token refreshed"), `audit_action_logout` (DE: "Abgemeldet" / EN: "Logged out"). Extend `describeAction` switch in `src/pages/audit/auditFormatters.ts` to map these.
- **D-22:** Add `/api/auth/refresh` and `/api/auth/logout` to `REDACT_PATHS` in `auditMiddleware.ts` so request bodies (which would only contain CSRF token / be empty anyway) are not logged.

### Settings
- **D-23:** Two new keys in `config/settings.yaml` (auto-defaulted in `server/settingsApi.ts` if absent — backwards-compatible):
  - `auth.refreshTokenTtlMs: 28800000` (8h)
  - `auth.refreshAbsoluteCapMs: 43200000` (12h)
- **D-24:** No UI surface for these values in v1.8 (Settings page unchanged). YAML-only edit. Validation: both must be positive integers, `refreshTokenTtlMs <= refreshAbsoluteCapMs`.

### Idle Logout Preservation (SESSION-02)
- **D-25:** The existing 10-minute idle timer (in `src/context/AuthContext.tsx` or wherever it lives — research will confirm) is UNCHANGED. Refresh flow does not extend idle countdown. Confirms: silent-refresh keeps active users logged in across the access-token boundary; idle users still get logged out at 10 min regardless of refresh-token validity.

### Test Strategy
- **D-26:** New test files:
  - `tests/jwtUtil.test.ts` — algorithm pinning (HS256-only verify), `typ` claim enforcement, token-type cross-rejection.
  - `tests/authRefresh.test.ts` — server endpoint: happy path, expired refresh, stale tokenVersion, missing CSRF, absolute cap exceeded.
  - `tests/authFetchRefresh.test.ts` — client: single-flight lock (concurrent 401s share one network call), retry-loop guard (retry 401 → logout, no second refresh), BroadcastChannel coordination (mock `BroadcastChannel`).
  - `tests/credentialMutationInvalidation.test.ts` — admin password reset bumps `tokenVersion`; subsequent refresh with old token returns 401.
- **D-27:** Existing tests `tests/authApi.test.ts`, `tests/authMiddlewareLocal.test.ts`, `tests/userCrud.test.ts` extended for new fields; existing audit/RTL tests must stay green (no behavior regression).

### Folded Todos
- From STATE.md: confirm `data/users.json` migration path for `tokenVersion` / `passwordChangedAt` / `totpChangedAt` → folded as **D-17** (lazy migration on boot).
- From STATE.md: verify refresh events are added to both `REDACT_PATHS` and `SKIP_AUDIT_PATHS` in `auditMiddleware.ts` → folded as **D-19** + **D-22**.

### Claude's Discretion
- Cookie name (`emd-refresh` chosen; planner may pick differently if conflict).
- Exact CSRF header name (`X-CSRF-Token` is conventional).
- Whether refresh-token rotation is mandatory per call (D-13 says yes; planner may simplify if test surface explodes).
- Internal helper names in `jwtUtil.ts` and `authHeaders.ts`.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Project
- `.planning/ROADMAP.md` §"Phase 20: JWT Refresh Flow & Session Resilience" — 6 success criteria (SESSION-01..09, 12, 13), goal statement, dependency note re: Phase 19 `describeAction` relocation
- `.planning/STATE.md` §"Accumulated Context" — locked decisions: cookie-parser is the single permitted new dep; refresh storage is httpOnly Secure SameSite=Strict cookie; defaults 8h/12h; HS256 hard-pin; SESSION-13 extends `describeAction` in `auditFormatters.ts`
- `.planning/REQUIREMENTS.md` — SESSION-01..09, 12, 13 acceptance criteria
- `.planning/PROJECT.md` §"Key Decisions" — config-in-settings.yaml (no env vars), security-first (audit immutability), no client trust

### Source Files Being Modified
- `server/authApi.ts` (712 LOC) — login/logout/2FA endpoints; refresh endpoint added; logout extended
- `server/authMiddleware.ts` (171 LOC) — `requireAuth`; new `requireCsrf` middleware
- `server/auditMiddleware.ts` — `SKIP_AUDIT_PATHS`, `REDACT_PATHS` arrays
- `server/initAuth.ts` — lazy migration of new user fields
- `src/services/authHeaders.ts` (31 LOC) — `authFetch` extended with silent refresh + single-flight + cross-tab
- `src/pages/audit/auditFormatters.ts` (Phase 19 output) — extend `describeAction` switch with refresh/logout cases
- `src/i18n/de.ts`, `src/i18n/en.ts` — new keys
- `config/settings.yaml` — new `auth.*` keys
- `data/users.json` — schema additions (lazy migration)
- `eslint.config.js` — `no-restricted-imports` rule

### New Files
- `server/jwtUtil.ts` — central JWT verify/sign with HS256 hard-pin
- `tests/jwtUtil.test.ts`, `tests/authRefresh.test.ts`, `tests/authFetchRefresh.test.ts`, `tests/credentialMutationInvalidation.test.ts`

### Existing Test Patterns to Mirror
- `tests/authApi.test.ts`, `tests/authMiddlewareLocal.test.ts`, `tests/authMiddlewareKeycloak.test.ts`, `tests/userCrud.test.ts` — current auth test conventions (supertest + JWT mocking)
- `tests/auditPageReducer.test.ts` (Phase 19) — pure unit-test pattern; `tests/auditPageCharacterization.test.tsx` — RTL+vi.mock pattern

### Prior-Phase Refs Carrying Forward
- `.planning/milestones/v1.7-phases/14-security-quick-wins-performance/14-RESEARCH.md` — JWT pitfalls notes that drove HS256 hard-pin
- `.planning/milestones/v1.7-phases/15-totp-2fa/15-RESEARCH.md` — 2FA flow that the refresh path must NOT break
- `.planning/milestones/v1.1-phases/06-keycloak-preparation/06-CONTEXT.md` — JWT format choices (kept HS256 for local; refresh tokens are local-only — Keycloak path uses native OIDC refresh, out of scope here)
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `data/jwt-secret.txt` (32 random bytes, 0600) — already loaded by `initAuth.ts`; reuse for refresh token signing.
- `server/authApi.ts` already has bcrypt + JWT issuance + 2FA + lockout — refresh endpoint slots in next to existing handlers.
- `src/services/authHeaders.ts` `authFetch` is the single chokepoint for all client API calls — extending it covers the entire app automatically (no per-page changes).
- `server/auditMiddleware.ts` `SKIP_AUDIT_PATHS` / `REDACT_PATHS` already exist — just add new entries.

### Established Patterns
- Settings live in YAML, never env vars (PROJECT.md non-negotiable).
- All API endpoints under `/api/*` are JWT-guarded except explicit allow-list (`/api/auth/login`, `/api/auth/refresh` once added).
- New deps require explicit roadmap approval — `cookie-parser` is the ONLY one this milestone.
- Test framework: Vitest + supertest for server, Vitest + RTL + jsdom for client. No jest-dom.

### Integration Points
- `cookie-parser` middleware mounted in `server/index.ts` BEFORE auth routes.
- `BroadcastChannel` is browser-native (no polyfill needed; jsdom requires mock in tests).
- Existing 401 redirect in `authFetch` becomes the FALLBACK after refresh fails.
- `data/users.json` migration runs idempotently on every boot (safe to re-run).

### Constraints
- Express 5 + cookie-parser ^1.4 — no signed-cookie option needed (we sign the JWT, not the cookie).
- jsdom does not implement `BroadcastChannel` — tests must `vi.stubGlobal('BroadcastChannel', MockBC)`.
- `Secure` cookie flag means refresh cookie won't be sent over plain HTTP — local dev workaround: dev mode falls back to `Secure: false` (driven by `process.env.NODE_ENV` or — preferred — settings flag). Planner decides exact toggle.
</code_context>

<specifics>
## Specific Ideas

- **Active-user invariant** is the hard contract: a user clicking around the app every few minutes must NEVER see a session-expiry prompt within the 12h absolute cap.
- **Idle logout still fires at 10 min** even if refresh token is valid — this is a deliberate UX choice from v1.7, NOT a bug to "fix" via refresh.
- **Audit log must not bloat:** background refreshes happen every ~9 minutes for active users; over 12h that's ~80 events per user per session. SKIP_AUDIT_PATHS is mandatory, not optional.
- **Bisect-friendly commit ordering** (mirror Phase 19): land server `jwtUtil.ts` + endpoint as one commit, client `authFetch` extension as a second commit, audit/i18n wiring as a third. Each commit independently green.
- `requestEpoch`-style stale-response guard from Phase 19 is the precedent for client-side single-flight; the refresh single-flight lock is the same pattern adapted to one shared promise instead of an integer counter.
</specifics>

<deferred>
## Deferred Ideas

- **SESSION-10 (force sign-out everywhere)** — explicitly out of scope per REQUIREMENTS.md / STATE.md. Would need server-side session table.
- **SESSION-11 (stateful refresh-sessions table with OAuth2 rotation)** — explicitly out of scope; current design is stateless `tokenVersion` invalidation.
- **KEYCLK-01 (Keycloak OIDC refresh)** — Keycloak path uses native OIDC refresh, separate phase if/when activated.
- **UI surface for `auth.refreshTokenTtlMs` / `auth.refreshAbsoluteCapMs`** — YAML-only in v1.8; Settings page UI is v1.9+ if needed.
- **Refresh-token signing-key rotation** — requires JWKS-style key id; out of scope.
- **Per-device session listing / revocation UI** — needs SESSION-11 backing store; not feasible without it.

### Reviewed Todos (not folded)
None.
</deferred>

---

*Phase: 20-jwt-refresh-flow-session-resilience*
*Context gathered: 2026-04-23*
