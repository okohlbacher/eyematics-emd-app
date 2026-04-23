# Phase 20: JWT Refresh Flow & Session Resilience - Research

**Researched:** 2026-04-23
**Domain:** JWT access/refresh split, single-flight client refresh, cross-tab coordination, credential-mutation invalidation, CSRF for cookie-based auth, audit hygiene
**Confidence:** HIGH (all decisions locked in CONTEXT.md; research focuses on verification, integration constraints, and pitfalls)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Module Layout**
- D-01: New `server/jwtUtil.ts` exports `verifyAccessToken`, `verifyRefreshToken`, `signAccessToken`, `signRefreshToken`. ALL existing `jwt.verify` / `jwt.sign` call sites in `server/authApi.ts` and `server/authMiddleware.ts` migrate to import from here.
- D-02: Refresh client logic lives in `src/services/authHeaders.ts` (extend existing 31-LOC file, do NOT create a parallel hook). Single-flight lock + retry guard + BroadcastChannel coordination all colocated with `authFetch`.
- D-03: `cookie-parser` is the **only** new npm dependency this milestone.
- D-04: ESLint `no-restricted-imports` rule added to `eslint.config.js`: bans `jsonwebtoken` verify/sign imports outside `server/jwtUtil.ts`.

**Token Strategy**
- D-05: Access token HS256, 10 min TTL, Bearer-in-memory only (`sessionStorage.emd-token`).
- D-06: Refresh token HS256, default 8h TTL (`auth.refreshTokenTtlMs`), httpOnly `Secure` `SameSite=Strict` cookie scoped to `Path=/api/auth/refresh`. NEVER readable by JS.
- D-07: Refresh payload `{ sub, ver: tokenVersion, iat, exp, sid }`; `sid` enforces 12h absolute cap.
- D-08: Same JWT secret (`data/jwt-secret.txt`) for both. Distinguish via `typ: 'access' | 'refresh'`. `verifyAccessToken` rejects refresh tokens and vice versa.

**Refresh Flow**
- D-09: `authFetch` 401 path: parse, if expired/401 invoke `refreshAccessToken()` once, retry exactly once. On failure → clear sessionStorage + redirect to /login.
- D-10: Retry-loop guard: mark retried request with private symbol/header `X-EMD-Retry-After-Refresh: 1`; second 401 → straight to logout.
- D-11: Single-flight: module-level `let refreshPromise: Promise<string> | null = null;`.
- D-12: `BroadcastChannel('emd-auth')` events: `refresh-start { sid }`, `refresh-success { token, expiresAt }`, `refresh-failure { reason }`, `logout`.

**Server-Side Refresh Endpoint**
- D-13: `POST /api/auth/refresh` reads cookie `emd-refresh`, verifies, checks `payload.ver === user.tokenVersion`, checks absolute cap, issues fresh access (10m) + rolling refresh (8h). Returns `{ token, expiresAt }`.
- D-14: CSRF double-submit-cookie: login response sets non-httpOnly `emd-csrf` cookie (32-byte hex). `/api/auth/refresh` and `/api/auth/logout` require header `X-CSRF-Token` matching cookie. Implement as `requireCsrf` middleware in `server/authMiddleware.ts`.
- D-15: `POST /api/auth/logout` extended: clears refresh + CSRF cookies, bumps `tokenVersion`, audited as `audit_action_logout`.

**Credential-Mutation Invalidation**
- D-16: Add `tokenVersion: number`, `passwordChangedAt: string` (ISO), `totpChangedAt: string` to user records.
- D-17: Lazy migration on boot in `initAuth.ts`; defaults `tokenVersion: 0`, timestamps = `user.createdAt` or now. Atomic write back.
- D-18: Mutation endpoints bumping `tokenVersion`: admin password reset, admin TOTP reset, self password change, self TOTP change. Bump matching `*ChangedAt`.

**Audit & i18n**
- D-19: Add `/api/auth/refresh` to `SKIP_AUDIT_PATHS` for **successful** (200) refreshes. Failed refreshes still audited via existing error paths.
- D-20: `POST /api/auth/logout` always audited as `logout`.
- D-21: Add `audit_action_refresh` (DE: "Token erneuert" / EN: "Token refreshed"); `audit_action_logout` already exists. Extend `describeAction` switch in `src/pages/audit/auditFormatters.ts`.
- D-22: Add `/api/auth/refresh` and `/api/auth/logout` to `REDACT_PATHS` in `auditMiddleware.ts`.

**Settings**
- D-23: Two new keys in `config/settings.yaml` — `auth.refreshTokenTtlMs: 28800000` (8h), `auth.refreshAbsoluteCapMs: 43200000` (12h). Auto-default in `server/settingsApi.ts` if absent.
- D-24: No UI surface in v1.8. YAML-only. Validation: positive integers, `refreshTokenTtlMs <= refreshAbsoluteCapMs`.

**Idle Logout**
- D-25: Existing 10-min idle timer in `src/context/AuthContext.tsx` UNCHANGED. Refresh does NOT extend idle countdown.

**Test Strategy**
- D-26: New tests — `tests/jwtUtil.test.ts`, `tests/authRefresh.test.ts`, `tests/authFetchRefresh.test.ts`, `tests/credentialMutationInvalidation.test.ts`.
- D-27: Existing `tests/authMiddlewareLocal.test.ts`, `tests/initAuthMigration.test.ts` extended for new fields. Existing audit/RTL tests must stay green.

### Claude's Discretion
- Cookie name (`emd-refresh` chosen; planner may pick differently if conflict).
- Exact CSRF header name (`X-CSRF-Token` is conventional).
- Whether refresh-token rotation is mandatory per call (D-13 says yes; planner may simplify if test surface explodes).
- Internal helper names in `jwtUtil.ts` and `authHeaders.ts`.

### Deferred Ideas (OUT OF SCOPE)
- SESSION-10 (force sign-out everywhere) — needs server-side session table.
- SESSION-11 (stateful refresh-sessions table with OAuth2 rotation) — current design is stateless `tokenVersion` invalidation.
- KEYCLK-01 (Keycloak OIDC refresh) — Keycloak path uses native OIDC refresh.
- UI surface for `auth.refreshTokenTtlMs` / `auth.refreshAbsoluteCapMs` — YAML-only in v1.8.
- Refresh-token signing-key rotation — needs JWKS-style kid.
- Per-device session listing / revocation UI.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (from ROADMAP.md success criteria) | Research Support |
|----|------------------------------------------------|------------------|
| SESSION-01 | Active user crosses 10-min boundary with no re-login prompt; `authFetch` silently refreshes on 401, retries original request once. | Single-flight pattern (Pattern 1) + retry guard header (D-10). Existing `authFetch` chokepoint (`src/services/authHeaders.ts`) is the only edit site. |
| SESSION-02 | 10-min idle auto-logout still fires; absolute session cap forces re-auth (defaults 8h/12h). | Idle timer in `AuthContext.tsx` (lines 63, 159–161) is preserved per D-25. Absolute cap enforced server-side via `sid + iat` check in `/api/auth/refresh` handler. |
| SESSION-03 | After admin or self credential change, outstanding refresh tokens rejected on next use. | Lazy migration adds `tokenVersion` (D-16, D-17). Mutation endpoints bump version (D-18). Refresh endpoint compares `payload.ver === user.tokenVersion` (D-13). |
| SESSION-04 | Refresh tokens delivered as httpOnly Secure SameSite=Strict cookies scoped to `/api/auth/refresh`; access tokens stay Bearer-in-memory; logout clears both. | cookie-parser (D-03) + Set-Cookie with documented attributes (Pattern 2). Dev-mode `Secure: false` toggle (Pitfall 5). |
| SESSION-05 | Multi-tab coordination via `BroadcastChannel('emd-auth')`; only one refresh at a time; 5-second server grace window. Successful refreshes excluded from `audit.db`; failed refreshes + logout audited with new i18n keys. | BroadcastChannel pattern (Pattern 3); SKIP_AUDIT_PATHS already exists (auditMiddleware lines 65–68); auditFormatters.ts switch is extension point. |
| SESSION-06 | All `jwt.verify()` route through `server/jwtUtil.ts` HS256 hard-pinned; ESLint `no-restricted-imports` forbids direct imports elsewhere. | Centralized signing module (Pattern 4); ESLint v9 flat-config rule documented in Code Examples. |
| SESSION-07 | (CSRF protection on refresh + logout). | Double-submit-cookie pattern (Pattern 5); covered by D-14. |
| SESSION-08 | (Refresh token rolling rotation, fresh refresh issued each call). | D-13 mandates rotation; covered in Pattern 2 implementation note. |
| SESSION-09 | (Audit i18n keys for refresh/logout in DE+EN). | `audit_action_logout` already exists in `src/i18n/translations.ts:433`. Only `audit_action_refresh` is net-new. |
| SESSION-12 | (Configurable session caps via `settings.yaml`). | New keys `auth.refreshTokenTtlMs` / `auth.refreshAbsoluteCapMs`; nesting note → see Pitfall 6 (current settings schema is FLAT). |
| SESSION-13 | (`describeAction` extension for refresh/logout entries). | Phase 19 relocated `describeAction` to `src/pages/audit/auditFormatters.ts`; verified — switch already maps `audit_action_login` etc. Extend with two new POST cases. |
</phase_requirements>

## Summary

Phase 20 is a tightly-scoped, decision-locked implementation. Research surfaces no library or pattern uncertainty — every architectural choice is fixed in CONTEXT.md. The work is integration-heavy: every existing `jwt.sign`/`jwt.verify` call site in `server/authApi.ts` (lines 60–91, 195) and `server/authMiddleware.ts` (lines 59, 94, 101) must route through a new `server/jwtUtil.ts`, and the 31-LOC `src/services/authHeaders.ts` `authFetch` becomes the entire client-side refresh state machine.

The four real risks are: (1) **settings-schema mismatch** — current `config/settings.yaml` is FLAT (`twoFactorEnabled` at top level), but D-23 specifies nested `auth.refreshTokenTtlMs`. The `validateSettingsSchema` function in `server/settingsApi.ts:65` must be extended carefully. (2) **CSRF cookie + SameSite=Strict interaction** — refresh cookie is `SameSite=Strict` and the CSRF cookie should be `SameSite=Lax` (or `Strict`) but readable by JS for the double-submit pattern. (3) **`Secure` cookie blocks local HTTP dev** — Vite dev proxy from `:5173` to Express is plain HTTP; need a dev-mode toggle. (4) **jsdom lacks `BroadcastChannel`** — every client-side test must `vi.stubGlobal('BroadcastChannel', ...)`.

**Primary recommendation:** Land server changes (jwtUtil + endpoint + lazy migration + settings keys) as commit 1, ESLint rule + call-site migration as commit 2, client `authFetch` extension + BroadcastChannel + tests as commit 3, audit/i18n wiring as commit 4. Each independently green per the bisect-friendly precedent (CONTEXT specifics §4).

## Project Constraints (from STATE.md / PROJECT.md)

- **Config in `settings.yaml`, never env vars** — non-negotiable. The dev-mode `Secure: false` toggle MUST come from a settings key (e.g. `auth.refreshCookieSecure: false`), NOT `process.env.NODE_ENV`.
- **No new deps without explicit roadmap approval** — `cookie-parser` is the ONLY permitted addition (D-03 + STATE.md accumulated context).
- **Test framework: Vitest + supertest (server), Vitest + RTL + jsdom (client). No jest-dom** — assertions use `queryByText().not.toBeNull()` style.
- **Audit immutability** — refresh failures and logouts MUST land in `audit.db`; the `SKIP_AUDIT_PATHS` exclusion targets ONLY 200-status refreshes (D-19). The current middleware does not differentiate by status — see Pitfall 7.
- **Server-side enforcement, no client trust** — `tokenVersion` check happens server-side every refresh; client cannot bypass.
- **Bisect-friendly commit ordering** (CONTEXT specifics §4) — each commit independently passes `npm test` and `npm run lint`.

## Standard Stack

### Core (already installed — no version changes)
| Library | Installed | Verified | Purpose | Why Standard |
|---------|-----------|----------|---------|--------------|
| jsonwebtoken | ^9.0.3 | 9.0.3 (npm view) | Sign/verify HS256 access + refresh tokens | Already the project's JWT lib; v9 fixes the algorithm-confusion CVEs that drove the HS256 hard-pin. [VERIFIED: npm view jsonwebtoken version → 9.0.3, package.json] |
| express | ^5.2.1 | — | Routing for `/api/auth/refresh` and extended `/api/auth/logout` | Already in use. Express 5 is fully compatible with cookie-parser ^1.4. [VERIFIED: package.json] |
| @types/jsonwebtoken | ^9.0.10 | — | Type defs | Already installed. [VERIFIED: package.json] |

### New (the only addition this phase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cookie-parser | ^1.4.7 | Parses `Cookie:` header into `req.cookies` for refresh cookie consumption | Express-team-maintained, de facto standard for cookie reading in Express. [VERIFIED: npm view cookie-parser version → 1.4.7] [CITED: https://github.com/expressjs/cookie-parser] |
| @types/cookie-parser | ^1.4.7 | TypeScript types | Required since project uses strict TS; plan must add as devDependency. [ASSUMED — verify exact version at install time] |

### Alternatives Considered (and rejected per locked decisions)
| Instead of | Could Use | Why Rejected |
|------------|-----------|--------------|
| cookie-parser | `cookie` package + manual parse | More code, no win; cookie-parser is 30 LOC and already battle-tested. |
| Stateless `tokenVersion` invalidation | Stateful refresh-token table (SESSION-11) | OUT OF SCOPE per ROADMAP.md and CONTEXT deferred. |
| Double-submit-cookie CSRF | Synchronizer-token CSRF | Synchronizer needs server-side token store; double-submit is stateless and works with our cookie+Bearer mix. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html] |
| `csrf` / `csurf` package | Hand-rolled double-submit middleware | `csurf` is deprecated as of 2022 (its README explicitly recommends migration). The double-submit pattern is ~20 LOC. [CITED: https://github.com/expressjs/csurf README — "no longer maintained"] |

**Installation:**
```bash
npm install cookie-parser
npm install --save-dev @types/cookie-parser
```

## Architecture Patterns

### Recommended Project Structure (delta from current tree)
```
server/
├── jwtUtil.ts          # NEW — central HS256 sign/verify with typ-claim enforcement
├── authApi.ts          # MODIFIED — add /refresh + /logout handlers; migrate jwt.* calls
├── authMiddleware.ts   # MODIFIED — add requireCsrf middleware; migrate jwt.verify
├── auditMiddleware.ts  # MODIFIED — extend SKIP_AUDIT_PATHS (200-only) + REDACT_PATHS
├── initAuth.ts         # MODIFIED — lazy migration: tokenVersion / *ChangedAt
├── settingsApi.ts      # MODIFIED — validate auth.refreshTokenTtlMs / auth.refreshAbsoluteCapMs
└── index.ts            # MODIFIED — mount cookie-parser BEFORE auth routes

src/services/
└── authHeaders.ts      # MODIFIED — single-flight refresh + retry guard + BroadcastChannel

src/pages/audit/
└── auditFormatters.ts  # MODIFIED — describeAction switch += refresh/logout cases

src/i18n/
└── translations.ts     # MODIFIED — add audit_action_refresh (logout already exists)

config/settings.yaml    # MODIFIED — add auth: { refreshTokenTtlMs, refreshAbsoluteCapMs, refreshCookieSecure }

eslint.config.js        # MODIFIED — no-restricted-imports rule

tests/
├── jwtUtil.test.ts                          # NEW
├── authRefresh.test.ts                      # NEW
├── authFetchRefresh.test.ts                 # NEW
└── credentialMutationInvalidation.test.ts   # NEW
```

### Pattern 1: Single-Flight Refresh with Module-Level Promise

**What:** A module-scoped `let refreshPromise: Promise<string> | null = null;` deduplicates concurrent 401s in one tab.
**When to use:** Any time multiple in-flight requests can fail with 401 simultaneously (typical SPA dashboard load: 5–10 parallel `authFetch` calls).
**Why:** Without this, every parallel 401 spawns its own POST `/api/auth/refresh`, and the LATER refreshes consume invalidated rolling refresh cookies (D-13 rotates on every call). Also avoids `tokenVersion` thrash if the server were ever to bump on refresh.

**Example:**
```typescript
// src/services/authHeaders.ts (NEW shape, mirrors React Query's deduplication idiom)
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;          // dedupe in-flight
  refreshPromise = (async () => {
    try {
      const csrf = getCsrfFromCookie();               // non-httpOnly emd-csrf
      const resp = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',                       // send refresh cookie
        headers: { 'X-CSRF-Token': csrf },
      });
      if (!resp.ok) throw new Error('refresh_failed');
      const data = await resp.json() as { token: string; expiresAt: number };
      sessionStorage.setItem('emd-token', data.token);
      bc?.postMessage({ type: 'refresh-success', token: data.token, expiresAt: data.expiresAt });
      return data.token;
    } finally {
      refreshPromise = null;                          // CRITICAL: reset on both success & failure
    }
  })();
  return refreshPromise;
}
```

**Source:** Pattern matches the precedent set by Phase 19's `requestEpoch` stale-response guard (STATE.md Accumulated Context). [VERIFIED: STATE.md line referencing requestEpoch]

### Pattern 2: Refresh Cookie Set in Response

```typescript
// server/authApi.ts (extension)
import cookieParser from 'cookie-parser';
// ... in router handler:
res.cookie('emd-refresh', refreshJwt, {
  httpOnly: true,
  secure: cookieSecureFromSettings(),     // settings-driven, not NODE_ENV
  sameSite: 'strict',
  path: '/api/auth/refresh',              // scoped — sent ONLY to refresh endpoint
  maxAge: getAuthSettings().refreshTokenTtlMs,
});
res.cookie('emd-csrf', csrfHex, {
  httpOnly: false,                        // JS must read it for double-submit
  secure: cookieSecureFromSettings(),
  sameSite: 'strict',
  path: '/',
  maxAge: getAuthSettings().refreshTokenTtlMs,
});
```

[CITED: https://expressjs.com/en/api.html#res.cookie — `res.cookie(name, value, options)`]

### Pattern 3: BroadcastChannel Cross-Tab Coordination

```typescript
// src/services/authHeaders.ts (extension)
const bc = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('emd-auth')
  : null;

bc?.addEventListener('message', (e) => {
  const msg = e.data as { type: string; token?: string };
  if (msg.type === 'refresh-success' && msg.token) {
    sessionStorage.setItem('emd-token', msg.token);   // adopt sibling tab's refresh
  } else if (msg.type === 'logout') {
    sessionStorage.removeItem('emd-token');
    if (!location.pathname.includes('/login')) location.href = '/login';
  }
});
```

[CITED: https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel — same-origin tabs auto-receive] [VERIFIED: MDN compat table — BroadcastChannel Baseline available across all modern browsers]

**jsdom limitation:** `BroadcastChannel` is **not** implemented by jsdom (verified per CONTEXT §code_context line 145). Tests MUST stub:
```typescript
class MockBC { postMessage = vi.fn(); addEventListener = vi.fn(); close = vi.fn(); }
vi.stubGlobal('BroadcastChannel', MockBC);
```

### Pattern 4: Centralized JWT Module with Type-Claim Enforcement

```typescript
// server/jwtUtil.ts (NEW)
import jwt from 'jsonwebtoken';
import { getJwtSecret } from './initAuth.js';

const ALGS: jwt.Algorithm[] = ['HS256'];           // hard-pinned, prevents alg=none / alg=RS256 confusion

export interface AccessPayload { sub: string; preferred_username: string; role: string; centers: string[]; typ: 'access'; iat: number; exp: number; }
export interface RefreshPayload { sub: string; ver: number; sid: string; typ: 'refresh'; iat: number; exp: number; }

export function signAccessToken(p: Omit<AccessPayload, 'typ' | 'iat' | 'exp'>, ttlMs: number): string {
  return jwt.sign({ ...p, typ: 'access' }, getJwtSecret(), { algorithm: 'HS256', expiresIn: Math.floor(ttlMs / 1000) });
}
export function signRefreshToken(p: Omit<RefreshPayload, 'typ' | 'iat' | 'exp'>, ttlMs: number): string {
  return jwt.sign({ ...p, typ: 'refresh' }, getJwtSecret(), { algorithm: 'HS256', expiresIn: Math.floor(ttlMs / 1000) });
}
export function verifyAccessToken(token: string): AccessPayload {
  const p = jwt.verify(token, getJwtSecret(), { algorithms: ALGS }) as AccessPayload;
  if (p.typ !== 'access') throw new Error('wrong_token_type');
  return p;
}
export function verifyRefreshToken(token: string): RefreshPayload {
  const p = jwt.verify(token, getJwtSecret(), { algorithms: ALGS }) as RefreshPayload;
  if (p.typ !== 'refresh') throw new Error('wrong_token_type');
  return p;
}
```

[CITED: https://github.com/auth0/node-jsonwebtoken#jwtverifytoken-secretorpublickey-options-callback — `algorithms` option]

### Pattern 5: Double-Submit-Cookie CSRF Middleware

```typescript
// server/authMiddleware.ts (extension)
export function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  const cookieToken = req.cookies?.['emd-csrf'];
  const headerToken = req.headers['x-csrf-token'];
  if (typeof cookieToken !== 'string' || typeof headerToken !== 'string' || !cookieToken || cookieToken !== headerToken) {
    res.status(403).json({ error: 'CSRF token mismatch' });
    return;
  }
  next();
}
```

[CITED: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#double-submit-cookie] — for stateless double-submit, both cookie and header must match server-side.

### Anti-Patterns to Avoid
- **Storing refresh token in localStorage/sessionStorage** — defeats httpOnly purpose; XSS exfiltrates it.
- **Reading the refresh cookie from JS** — impossible if `httpOnly: true`, but DON'T add a non-httpOnly mirror "for convenience."
- **Refresh on every request, regardless of token freshness** — only refresh on 401. Predictive refresh adds complexity without benefit (Pitfall 4).
- **Resetting `refreshPromise` only on success** — must reset in `finally` block, otherwise a failed refresh permanently blocks the tab.
- **Calling `refreshAccessToken()` from within the response handler of `/api/auth/refresh` itself** — infinite loop. The 401 retry guard (D-10) is the explicit prevention.
- **Bumping `tokenVersion` on /refresh success** — would invalidate the refresh token we just rotated. Only bump on credential mutations (D-18).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie parsing | Manual `req.headers.cookie.split(';')` | `cookie-parser` | Edge cases: quoted values, encoded characters, signed cookies. |
| HMAC JWT sign/verify | Custom HMAC + base64url | `jsonwebtoken` (already installed) | Algorithm pinning, timing-safe compare, claim validation all built in. |
| CSRF token generation | `Math.random().toString(36)` | `crypto.randomBytes(32).toString('hex')` (Node built-in) | CSPRNG vs. predictable PRNG. The codebase already uses this idiom (`server/initAuth.ts:86` for JWT secret). |
| Cross-tab message bus | `localStorage` `storage` event hack | `BroadcastChannel` | Native API, structured-clone payloads, no string-encoding needed. Browser-native baseline. |
| Promise deduplication | Counter / queue | Module-level `Promise` reuse | 5 LOC, idiomatic. |

**Key insight:** Phase 14 already consolidated JWT to HS256 hard-pin, and `data/jwt-secret.txt` + `modifyUsers` write-lock infrastructure already exists in `server/initAuth.ts`. This phase ADDS a few primitives — it does not introduce new categories of complexity.

## Runtime State Inventory

> Phase 20 has minor data-migration aspects but is primarily a code/config phase. Inventory below.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `data/users.json` records lack `tokenVersion`, `passwordChangedAt`, `totpChangedAt`. Verified by reading first 20 lines of `data/users.json` — fields absent. | Lazy migration on boot in `initAuth.ts._migrateUsersJson()` (D-17). Pattern matches existing `_migrateRemovedCenters` / `_migrateCenterIds` precedent in same file. |
| Live service config | None. No external service stores the refresh-cookie name or session config. | None — verified by grep for `emd-refresh`, `BroadcastChannel`, `refreshToken` in repo: 0 hits. |
| OS-registered state | None. EMD runs as a single Node process; no OS-level scheduler entries. | None. |
| Secrets/env vars | `data/jwt-secret.txt` already exists — REUSED for refresh token signing per D-08 (no new secret). No new env vars (config in settings.yaml only). | None — secret unchanged. |
| Build artifacts | None. TypeScript transpilation; no compiled binaries with embedded names. | None. |

## Common Pitfalls

### Pitfall 1: cookie-parser middleware ordering
**What goes wrong:** `req.cookies` is `undefined` in the `/api/auth/refresh` handler.
**Why it happens:** `cookieParser()` middleware not mounted, or mounted AFTER `app.use('/api', authMiddleware)`.
**How to avoid:** Mount `app.use(cookieParser())` GLOBALLY before any `/api` middleware (specifically before `auditMiddleware` so audit body capture also benefits, and before `authMiddleware`). Reference mount point: `server/index.ts` between line 192 (helmet) and line 197 (`/api/auth` body parser).
**Warning signs:** `TypeError: Cannot read properties of undefined (reading 'emd-refresh')` in tests.

### Pitfall 2: SameSite=Strict + cross-origin dev proxy
**What goes wrong:** Refresh cookie not sent when Vite dev server (`:5173`) proxies to Express (`:3000`).
**Why it happens:** Vite proxy preserves the request origin, but `SameSite=Strict` cookies are NOT sent with requests originating from a different "site" — even via a dev proxy in some browser configurations. In our setup, both run on `localhost` so they ARE same-site for cookie purposes (per RFC 6265bis "site" = registrable domain). [CITED: https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#samesite_attribute]
**How to avoid:** Verify in dev — should work. If issues arise, fall back to `SameSite=Lax` for the refresh cookie (still safe with the additional CSRF double-submit). Document in plan.
**Warning signs:** Refresh always 401s in dev but works in prod.

### Pitfall 3: `Secure` cookie blocks plain HTTP
**What goes wrong:** Login response sets `Secure` refresh cookie; browser drops it because dev server is `http://localhost`.
**Why it happens:** `Secure` flag requires HTTPS. Vite dev is HTTP by default.
**How to avoid:** Add settings key `auth.refreshCookieSecure: true` (default true in YAML), but allow override to `false` in dev. PROJECT.md forbids `process.env.NODE_ENV` driving auth — must be settings-driven.
**Warning signs:** Login appears to work, but immediate next API call after access expires gets 401 because no refresh cookie.

### Pitfall 4: Refresh storm on simultaneous 401s
**What goes wrong:** Dashboard fires 8 parallel `authFetch` calls; access expires; ALL 8 trigger `refreshAccessToken()` → 8 POST `/api/auth/refresh` → 7 fail because rolling rotation invalidated their refresh cookies.
**Why it happens:** No single-flight lock.
**How to avoid:** Pattern 1 (module-level `refreshPromise`). Tests in `tests/authFetchRefresh.test.ts` per D-26 must assert "1 network call for N concurrent 401s."
**Warning signs:** Sporadic logout under load; audit log shows multiple `/api/auth/refresh` 401 entries within the same millisecond.

### Pitfall 5: Audit middleware doesn't differentiate by status
**What goes wrong:** D-19 says "skip 200 refreshes, audit 401s." But current `auditMiddleware.ts` SKIP_AUDIT_PATHS check (line 155) runs UNCONDITIONALLY on path match — it skips both success AND failure.
**Why it happens:** The existing skip mechanism was designed for handler-self-audit (Phase 11 view-open beacon), not status-conditional skipping.
**How to avoid:** EITHER (a) add a status-aware exclusion mechanism (e.g. `SKIP_IF_STATUS: { '/api/auth/refresh': 200 }`), OR (b) keep refresh out of `SKIP_AUDIT_PATHS` and have the handler write a `audit_action_refresh` row only on failure paths — silence 200s differently. Plan must pick one and document. **Recommendation:** option (a) — minimal change to a stable file, clearer intent.
**Warning signs:** Either audit log floods with successful refreshes (option missed) or fails to record refresh failures (option wrong direction).

### Pitfall 6: Settings schema is currently FLAT
**What goes wrong:** D-23 specifies `auth.refreshTokenTtlMs` (nested under `auth:`), but current `config/settings.yaml` has `twoFactorEnabled` at root. Adding `auth: { refreshTokenTtlMs }` doesn't break existing FLAT keys, but `validateSettingsSchema` (`server/settingsApi.ts:65`) and `initAuth` (`server/initAuth.ts:92`) both read from FLAT root.
**Why it happens:** Inconsistent migration — historical decision to keep all keys flat.
**How to avoid:** Two options:
  - **Option A (consistent with locked decision):** Introduce `auth:` namespace solely for new keys. Read via `(settings.auth ?? {}).refreshTokenTtlMs`. Document the schism.
  - **Option B (consistent with existing pattern):** Use FLAT keys `refreshTokenTtlMs` / `refreshAbsoluteCapMs`. Contradicts CONTEXT D-23.
  - **Recommendation:** Option A — D-23 is locked, and a fresh nested namespace draws a clean line for future auth settings.
**Warning signs:** New keys silently default at runtime; tests pass (because tests stub `getAuthSettings`) but production reads `undefined`.

### Pitfall 7: jsonwebtoken `expiresIn` accepts seconds OR ms-string
**What goes wrong:** `jwt.sign(p, secret, { expiresIn: 28800000 })` interprets `28800000` as **seconds** (= 333 days), not ms.
**Why it happens:** API quirk: number → seconds; string `'8h'` → human-readable. Settings keys are in ms.
**How to avoid:** Convert ms → seconds: `expiresIn: Math.floor(ttlMs / 1000)`. See Pattern 4 example. Add a regression test.
**Warning signs:** Refresh tokens never expire in dev. [CITED: https://github.com/auth0/node-jsonwebtoken#usage — "expiresIn: expressed in seconds or a string describing a time span"]

### Pitfall 8: `helmet` CSP may block BroadcastChannel
**What goes wrong:** Initially appears unrelated, but `helmet`'s default CSP does NOT block BroadcastChannel (it's a same-origin browser API, no network involved).
**Why it happens / how to avoid:** No action needed — BroadcastChannel is not subject to `connect-src`. Documented for completeness. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel — uses same-origin policy, not CSP-gated]

## Code Examples

### CSRF token generation (server-side, on login response)
```typescript
// server/authApi.ts — inside POST /login success branch
import crypto from 'node:crypto';
const csrf = crypto.randomBytes(32).toString('hex');
const refreshJwt = signRefreshToken({ sub: user.username, ver: user.tokenVersion ?? 0, sid: crypto.randomUUID() }, getAuthSettings().refreshTokenTtlMs);
res.cookie('emd-refresh', refreshJwt, { httpOnly: true, secure: getAuthSettings().refreshCookieSecure, sameSite: 'strict', path: '/api/auth/refresh', maxAge: getAuthSettings().refreshTokenTtlMs });
res.cookie('emd-csrf', csrf, { httpOnly: false, secure: getAuthSettings().refreshCookieSecure, sameSite: 'strict', path: '/', maxAge: getAuthSettings().refreshTokenTtlMs });
res.json({ token: signAccessToken({ sub: user.username, preferred_username: user.username, role: user.role, centers: user.centers }, 10 * 60 * 1000) });
```

### POST /api/auth/refresh handler skeleton
```typescript
// server/authApi.ts (NEW handler)
authApiRouter.post('/refresh', requireCsrf, async (req, res) => {
  const cookie = req.cookies?.['emd-refresh'];
  if (!cookie) { res.status(401).json({ error: 'Missing refresh token' }); return; }
  let payload: RefreshPayload;
  try { payload = verifyRefreshToken(cookie); }
  catch { res.status(401).json({ error: 'Invalid refresh token' }); return; }

  const settings = getAuthSettings();
  // Absolute cap check (D-13): payload.iat is seconds, settings is ms
  const ageMs = Date.now() - payload.iat * 1000;
  if (ageMs > settings.refreshAbsoluteCapMs) { res.status(401).json({ error: 'Session cap exceeded' }); return; }

  const user = loadUsers().find(u => u.username.toLowerCase() === payload.sub.toLowerCase());
  if (!user) { res.status(401).json({ error: 'User not found' }); return; }
  if ((user.tokenVersion ?? 0) !== payload.ver) { res.status(401).json({ error: 'Token version stale' }); return; }

  // Issue rotated refresh + fresh access (D-13)
  const newRefresh = signRefreshToken({ sub: user.username, ver: user.tokenVersion ?? 0, sid: payload.sid }, settings.refreshTokenTtlMs);
  res.cookie('emd-refresh', newRefresh, { httpOnly: true, secure: settings.refreshCookieSecure, sameSite: 'strict', path: '/api/auth/refresh', maxAge: settings.refreshTokenTtlMs });
  const access = signAccessToken({ sub: user.username, preferred_username: user.username, role: user.role, centers: user.centers }, 10 * 60 * 1000);
  res.json({ token: access, expiresAt: Date.now() + 10 * 60 * 1000 });
});
```

### ESLint no-restricted-imports rule (D-04)
```javascript
// eslint.config.js — add a new files-scoped block
{
  files: ['**/*.{ts,tsx}'],
  ignores: ['server/jwtUtil.ts'],          // jwtUtil itself is the only allowed importer
  rules: {
    'no-restricted-imports': ['error', {
      paths: [{
        name: 'jsonwebtoken',
        message: 'Import sign/verify helpers from server/jwtUtil instead. Direct jsonwebtoken use risks algorithm-confusion CVEs.',
      }],
    }],
  },
}
```
[CITED: https://eslint.org/docs/latest/rules/no-restricted-imports — `paths` option supports per-package restriction]

### supertest cookie-based refresh test pattern
```typescript
// tests/authRefresh.test.ts (NEW)
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
// ... mock initAuth, mount routes ...

it('happy path: valid refresh cookie + matching CSRF returns new access token', async () => {
  const app = createApp();
  // First login to capture cookies
  const loginRes = await request(app).post('/api/auth/login').send({ username: 'u', password: 'p' });
  const cookies = loginRes.headers['set-cookie'];               // string[] — ['emd-refresh=...', 'emd-csrf=...']
  const csrf = /emd-csrf=([^;]+)/.exec(cookies.find(c => c.startsWith('emd-csrf'))!)![1];

  const refreshRes = await request(app)
    .post('/api/auth/refresh')
    .set('Cookie', cookies.join('; '))
    .set('X-CSRF-Token', csrf);

  expect(refreshRes.status).toBe(200);
  expect(refreshRes.body.token).toMatch(/^eyJ/);
  expect(refreshRes.headers['set-cookie']?.some((c: string) => c.startsWith('emd-refresh='))).toBe(true);
});
```
[CITED: https://github.com/ladjs/supertest#readme — `.set('Cookie', ...)` and `headers['set-cookie']` access]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `csurf` Express middleware | Hand-rolled double-submit-cookie | csurf deprecated 2022 | Custom 20-LOC middleware (Pattern 5). [CITED: https://github.com/expressjs/csurf — "no longer maintained"] |
| `localStorage` storage-event cross-tab sync | `BroadcastChannel` API | Baseline-supported as of 2022 | Direct messaging, no string serialization, no key-collision concerns. |
| Long-lived single tokens (`expiresIn: '7d'`) | Short access (10m) + rotating refresh (8h) | Industry post-2018 OAuth2 best practice | Reduces window of token theft; `tokenVersion` enables fast revocation without server-side store. |
| `jwt.verify(t, secret)` (algorithm-implicit) | `jwt.verify(t, secret, { algorithms: ['HS256'] })` | jsonwebtoken v9 (2022) hard-required after CVE-2022-23529 | Already enforced project-wide; this phase centralizes via `jwtUtil.ts`. |

**Deprecated/outdated:**
- `csurf` — npm package archived; do NOT add.
- `cookie-session` — alternative session store; not needed (we use stateless JWT).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@types/cookie-parser` ^1.4.7 will install cleanly with the project's TypeScript ~6.0.2. | Standard Stack | LOW — DefinitelyTyped maintains current types; if mismatch, plan adds a one-line `declare module` shim. |
| A2 | The Vite dev proxy preserves cookies on `/api/*` requests so SameSite=Strict refresh cookie reaches Express. | Pitfall 2 | MEDIUM — If broken, dev mode cannot test refresh; fallback is SameSite=Lax which still composes safely with double-submit CSRF. |
| A3 | `SKIP_AUDIT_PATHS` mechanism in `auditMiddleware.ts` (line 155) does not currently support status-conditional skipping. | Pitfall 5 | LOW — Verified by reading `auditMiddleware.ts:140-194`; confirmed unconditional. Plan must extend the mechanism. |
| A4 | Adding nested `auth:` namespace to `settings.yaml` will not break the existing `validateSettingsSchema` validator (which checks FLAT keys). | Pitfall 6 | LOW — verified `validateSettingsSchema` only checks specific FLAT keys (`twoFactorEnabled`, `provider`, `therapyInterrupterDays`, etc.); unknown keys are not rejected. |
| A5 | `BroadcastChannel('emd-auth')` between two tabs of `http://localhost:5173` and `http://localhost:5173` (same origin) will deliver messages in both directions reliably. | Pattern 3 | LOW — same-origin requirement satisfied; MDN documents this as the standard same-origin cross-context channel. |
| A6 | `crypto.randomBytes(32).toString('hex')` is a sufficient CSRF token (256-bit entropy, hex = 64 chars). | Code Examples | LOW — OWASP cheat sheet calls for ≥128-bit entropy; we exceed by 2x. |

## Open Questions

1. **Should the access token be ROTATED on refresh, or only the refresh token?**
   - What we know: D-13 says fresh access token AND fresh refresh token on every `/api/auth/refresh` call.
   - What's unclear: Nothing — D-13 is explicit. Confirmed unambiguously.
   - Recommendation: Implement as D-13 specifies. Listed here only because reviewers may flag "why rotate access if it's already short-lived?" — answer: simpler client (always swap both) and supports future TTL adjustments.

2. **What `audit_action` is recorded for a FAILED refresh?**
   - What we know: D-19 says failed refreshes ARE audited via existing error paths. CONTEXT does NOT add a `audit_action_refresh_failed` key.
   - What's unclear: Without a refresh-specific failed-path action key, the entry will display as the generic `audit_action_unknown` in the audit page table.
   - Recommendation: Plan should add a single `audit_action_refresh` key (already locked) and use it for BOTH success-handler-written rows (if option (a) of Pitfall 5 is taken) and middleware-captured 401s. Distinguish via the `status` column already in the audit row. No new i18n keys needed.

3. **Does the existing `INACTIVITY_TIMEOUT` (10 min, `AuthContext.tsx:63`) need to know about refresh, or is it fully orthogonal?**
   - What we know: D-25 says idle timer UNCHANGED. Refresh extends only the access-token boundary, not the idle countdown.
   - What's unclear: When a sibling tab refreshes via BroadcastChannel and adopts a new access token, should THIS tab reset its idle timer? Per D-25 spirit: NO (idle = no user input in THIS tab). But ergonomically, if user is active in tab B and tab A is idle, tab A should still log out at 10min — as designed.
   - Recommendation: Confirm and document: BroadcastChannel `refresh-success` does NOT reset the per-tab idle timer. This preserves the v1.7 idle-logout contract.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (`node`, `npm`) | Build / test / run | ✓ | (project requirement, assumed via package.json `"engines"` absent) | — |
| `npm install cookie-parser` | Server cookie parsing | ✓ (registry reachable, version verified) | 1.4.7 | None needed — universally available |
| `crypto` (Node built-in) | CSRF token + UUID generation | ✓ | Node ≥ 14 | — already used in `server/initAuth.ts:86` |
| `BroadcastChannel` (browser global) | Cross-tab coordination at runtime | ✓ in browsers | Baseline available | jsdom: `vi.stubGlobal` mock |
| jsdom `BroadcastChannel` | Client tests | ✗ (jsdom does not implement) | — | Stub via `vi.stubGlobal('BroadcastChannel', MockBC)` — required by tests/authFetchRefresh.test.ts |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** jsdom BroadcastChannel — handled by Vitest stub pattern.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `vitest.config.ts` (root, default node env; jsdom opt-in via `// @vitest-environment jsdom` docblock) |
| Quick run command | `npm test -- tests/jwtUtil.test.ts -t "<name>"` (single test) |
| Full suite command | `npm test` |
| Lint | `npm run lint` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SESSION-01 | `authFetch` 401 → silent refresh → retry once → success | unit (jsdom) | `npm test -- tests/authFetchRefresh.test.ts` | ❌ Wave 0 |
| SESSION-01 | Single-flight: 5 concurrent 401s → 1 refresh call | unit (jsdom) | `npm test -- tests/authFetchRefresh.test.ts -t "single-flight"` | ❌ Wave 0 |
| SESSION-01 | Retry-loop guard: retry 401 → no second refresh → logout | unit (jsdom) | `npm test -- tests/authFetchRefresh.test.ts -t "retry guard"` | ❌ Wave 0 |
| SESSION-02 | Idle timer fires at 10 min regardless of refresh | unit (jsdom) | `npm test -- tests/authIdleTimer.test.tsx` (or extend existing) | ❌ Wave 0 — may extend existing AuthContext test if any |
| SESSION-02 | Absolute cap: refresh older than 12h → 401 | unit (node) | `npm test -- tests/authRefresh.test.ts -t "absolute cap"` | ❌ Wave 0 |
| SESSION-03 | Admin password reset bumps `tokenVersion`; subsequent refresh 401 | unit (node) | `npm test -- tests/credentialMutationInvalidation.test.ts` | ❌ Wave 0 |
| SESSION-03 | Self password change bumps tokenVersion + passwordChangedAt | unit (node) | `npm test -- tests/credentialMutationInvalidation.test.ts -t "self password"` | ❌ Wave 0 |
| SESSION-04 | Login response sets httpOnly Secure SameSite=Strict refresh cookie scoped to /api/auth/refresh | unit (node) | `npm test -- tests/authRefresh.test.ts -t "cookie attrs"` | ❌ Wave 0 |
| SESSION-04 | Logout clears both cookies and bumps tokenVersion | unit (node) | `npm test -- tests/authRefresh.test.ts -t "logout"` | ❌ Wave 0 |
| SESSION-05 | BroadcastChannel `refresh-success` adopted by sibling tab without firing own refresh | unit (jsdom) | `npm test -- tests/authFetchRefresh.test.ts -t "broadcast"` | ❌ Wave 0 |
| SESSION-05 | Successful refresh NOT in audit.db; failed refresh IS | unit (node) | `npm test -- tests/auditMiddleware.test.ts -t "refresh skip"` | ❌ Wave 0 (extend existing) |
| SESSION-06 | `verifyAccessToken` rejects refresh-typ; `verifyRefreshToken` rejects access-typ | unit (node) | `npm test -- tests/jwtUtil.test.ts -t "typ enforcement"` | ❌ Wave 0 |
| SESSION-06 | `verifyAccessToken` rejects RS256-signed token (algorithm pin) | unit (node) | `npm test -- tests/jwtUtil.test.ts -t "alg pin"` | ❌ Wave 0 |
| SESSION-06 | `npm run lint` fails when a server file imports from `'jsonwebtoken'` directly | lint | `npm run lint` (must fail intentionally before fix) | ❌ Wave 0 — verified by introducing/removing a violating import in throwaway commit |
| SESSION-07 | Missing CSRF header → 403 from `/api/auth/refresh` | unit (node) | `npm test -- tests/authRefresh.test.ts -t "missing csrf"` | ❌ Wave 0 |
| SESSION-09 | i18n: `audit_action_refresh` exists in DE+EN | unit (node) | `npm test -- tests/i18n.test.ts` (or grep-style assertion) | ❌ Wave 0 |
| SESSION-13 | `describeAction('POST', '/api/auth/refresh', t)` returns refresh key | unit (node) | `npm test -- tests/auditPageReducer.test.ts` (extend) OR new auditFormatters.test.ts | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- tests/<changed-area>.test.ts -x` + `npm run lint`
- **Per wave merge:** `npm test` (full vitest suite)
- **Phase gate:** Full suite green + `npm run lint` clean before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/jwtUtil.test.ts` — covers SESSION-06 (algorithm pin, typ enforcement, cross-rejection)
- [ ] `tests/authRefresh.test.ts` — covers SESSION-02, SESSION-04, SESSION-07 (server endpoint + CSRF)
- [ ] `tests/authFetchRefresh.test.ts` — covers SESSION-01, SESSION-05 (client single-flight, retry guard, BroadcastChannel)
- [ ] `tests/credentialMutationInvalidation.test.ts` — covers SESSION-03
- [ ] Extend `tests/auditMiddleware.test.ts` — refresh-status-conditional skip behavior
- [ ] Extend `tests/initAuthMigration.test.ts` — lazy migration for `tokenVersion` / `passwordChangedAt` / `totpChangedAt`
- [ ] Optional: `tests/auditFormatters.test.ts` — describeAction extension (or extend existing reducer test)
- [ ] Framework install: none — Vitest + supertest + jsdom already configured; cookie-parser only new server dep.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | YES | bcrypt password hash (existing); HS256 JWT; rate limiting (existing `server/rateLimiting.ts`); per-user TOTP (existing Phase 15) |
| V3 Session Management | **YES — primary focus** | Short-lived access (10m) + rotating refresh (8h); absolute cap (12h); httpOnly Secure SameSite=Strict refresh cookie; `tokenVersion` for revocation; idle timeout (existing 10m) |
| V4 Access Control | YES (unchanged) | Role-based gating in route handlers; center-scoped data access (existing) |
| V5 Input Validation | YES | Settings schema validator (`server/settingsApi.ts`); JWT claim type assertions in `jwtUtil.ts` |
| V6 Cryptography | YES | `crypto.randomBytes` for CSRF + sid; `jsonwebtoken` for HMAC-SHA256 — never hand-roll |
| V13 API & Web Service | YES | CSRF double-submit on state-changing cookie-authenticated endpoints; standard error responses |

### Known Threat Patterns for Express + JWT + cookie auth

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Algorithm confusion (alg=none, alg=RS256→HMAC) | Tampering | `algorithms: ['HS256']` hard-pin in `jwtUtil.ts` (centralized via D-04 ESLint rule) |
| CSRF via cookie auth | Spoofing | Double-submit-cookie middleware on `/api/auth/refresh` and `/api/auth/logout` (D-14) |
| Refresh token theft via XSS | Information Disclosure | `httpOnly` flag — JS cannot read; CSP from `helmet` already blocks unsanctioned scripts |
| Refresh token replay after logout | Repudiation | `tokenVersion` bump on logout invalidates ALL outstanding refresh tokens for that user (D-15) |
| Session fixation | Spoofing | New `sid` (crypto.randomUUID) on each login; absolute cap from `iat` ensures bounded lifetime |
| MitM on refresh cookie | Information Disclosure | `Secure` flag forces HTTPS; HSTS via `helmet` (already on) |
| Tab-storage XSS access | Information Disclosure | Access token in `sessionStorage` (vs localStorage) — cleared on tab close, narrower XSS surface |
| Audit-log flooding (DoS-by-noise) | Denial of Service | `SKIP_AUDIT_PATHS` for 200-status refresh (D-19) — failed refreshes still recorded |
| Stale token reuse after credential change | Tampering | `tokenVersion` invalidation (D-18) — server-checked on every refresh |
| Refresh storm causing rotation race | DoS / data integrity | Single-flight `refreshPromise` lock (D-11) — only one network refresh per tab |
| CSRF cookie disclosure via XSS | Spoofing | Double-submit means attacker needs BOTH the cookie AND the ability to set a custom header — cross-origin `fetch` cannot set arbitrary headers without CORS preflight that we don't grant |

## Sources

### Primary (HIGH confidence)
- **`.planning/phases/20-jwt-refresh-flow-session-resilience/20-CONTEXT.md`** — 27 locked decisions; the source of truth for all architecture choices.
- **`.planning/STATE.md`** — accumulated context (cookie-parser as sole new dep, 8h/12h defaults, HS256 hard-pin, `describeAction` location).
- **`.planning/ROADMAP.md` §"Phase 20"** — 6 success criteria mapped to SESSION-01..09, 12, 13.
- **`server/authApi.ts`** (lines 60–91, 195) — current `jwt.sign` / `jwt.verify` call sites that must migrate.
- **`server/authMiddleware.ts`** (lines 59, 94, 101) — verify call sites + PUBLIC_PATHS allowlist (line 47) that must include `/api/auth/refresh`.
- **`server/auditMiddleware.ts`** (lines 35–68, 155) — `REDACT_PATHS` + `SKIP_AUDIT_PATHS` arrays + unconditional skip behavior.
- **`server/initAuth.ts`** (lines 333–377) — `_migrateUsersJson` precedent for D-17 lazy migration.
- **`src/services/authHeaders.ts`** (full file, 31 LOC) — current `authFetch` and `getAuthHeaders` to extend.
- **`src/context/AuthContext.tsx`** (lines 63, 159–161) — `INACTIVITY_TIMEOUT` (10 min) which D-25 preserves.
- **`src/pages/audit/auditFormatters.ts`** (lines 16–41) — `describeAction` switch for SESSION-13 extension.
- **`src/i18n/translations.ts`** (lines 432–433) — `audit_action_login` / `audit_action_logout` already exist; only `audit_action_refresh` is net-new.
- **`config/settings.yaml`** (full file) — confirms FLAT schema requiring nested-namespace decision (Pitfall 6).
- **`package.json`** (lines 18–46) — confirms jsonwebtoken ^9.0.3, express ^5.2.1, vitest ^4.1.4.
- **`eslint.config.js`** (full file) — confirms ESLint v9 flat-config; no `no-restricted-imports` rule yet.
- **`tests/authMiddlewareLocal.test.ts`** — supertest pattern for JWT route tests (vi.mock initAuth, signToken helper).
- **`tests/authHeaders.test.ts`** — pattern for stubbing `sessionStorage` in client-side unit tests.
- **`tests/initAuthMigration.test.ts`** — pattern for migration unit tests.
- `npm view cookie-parser version` → 1.4.7 [VERIFIED 2026-04-23]
- `npm view jsonwebtoken version` → 9.0.3 [VERIFIED 2026-04-23]

### Secondary (MEDIUM confidence — official docs cited)
- [MDN: BroadcastChannel API](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel) — same-origin cross-tab messaging baseline support.
- [MDN: SameSite cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#samesite_attribute) — Strict semantics on cross-site requests.
- [Express res.cookie](https://expressjs.com/en/api.html#res.cookie) — option flags reference.
- [jsonwebtoken README](https://github.com/auth0/node-jsonwebtoken) — `algorithms` option, `expiresIn` seconds-vs-string semantics.
- [OWASP CSRF Prevention Cheat Sheet — Double-Submit Cookie](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#double-submit-cookie) — pattern recommended for stateless apps.
- [ESLint no-restricted-imports](https://eslint.org/docs/latest/rules/no-restricted-imports) — `paths` option for per-package restriction.
- [supertest README](https://github.com/ladjs/supertest) — cookie set/get for test patterns.
- [csurf README](https://github.com/expressjs/csurf) — explicit "no longer maintained" notice (justifies hand-roll).

### Tertiary (LOW confidence — none required)
- None. All claims verifiable via primary sources or first-party documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — cookie-parser version verified via npm registry; jsonwebtoken already installed at locked version.
- Architecture: HIGH — every pattern locked in CONTEXT.md; Patterns 1–5 are direct implementations of D-01..D-15.
- Pitfalls: HIGH — Pitfalls 1, 5, 6, 7 verified by reading current code; Pitfalls 2, 3, 8 cited from MDN/RFC; Pitfall 4 follows directly from rotation semantics in D-13.
- Validation architecture: HIGH — test framework existing, all gap files explicitly listed in D-26.
- Security: HIGH — ASVS V3 (Session Management) coverage maps cleanly to locked decisions.

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (30 days; cookie-parser and jsonwebtoken are stable; no breaking changes anticipated.)
