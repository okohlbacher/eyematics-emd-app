# Phase 6: Keycloak Preparation - Research

**Researched:** 2026-04-10
**Domain:** JWT / JWKS validation, auth middleware branching, UI provider toggle
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** settings.yaml gains `auth.provider` field (`local` | `keycloak`) and `auth.keycloak` config block with `issuer` and `clientId`. Default: `local`.
- **D-02:** Restart required to switch providers — server reads `auth.provider` once at startup. No runtime switching. Old sessions invalidated naturally on restart.
- **D-03:** Fail closed — if `auth.provider: keycloak` but Keycloak/JWKS is unreachable, all auth fails with 503/401. No silent fallback to local auth. Operator must fix Keycloak or switch back to `local` + restart.
- **D-04:** POST /api/auth/login returns 405 when `provider=keycloak` — local login endpoint is disabled entirely in Keycloak mode.
- **D-05:** LoginPage shows Keycloak button only when `provider=keycloak` — username/password form replaced entirely with "Login with Keycloak" button.
- **D-06:** In v1, Keycloak button click shows info message: "Keycloak SSO is configured but the redirect flow is not yet implemented. Contact your administrator." Full OIDC redirect is v2 scope.
- **D-07:** Extend existing GET /api/auth/config response with `provider` field — add `provider: 'local' | 'keycloak'` to the response.
- **D-08:** Keycloak setup docs live in `docs/keycloak-setup.md`.
- **D-09:** Step-by-step admin guide — covers prerequisites, realm config, client setup (emd-app), role mapping to 6 EMD roles, custom 'centers' claim, settings.yaml example, verification steps.

### Claude's Discretion

- JWKS caching strategy (jwks-rsa library configuration, cache TTL)
- Keycloak claim mapping implementation details (how preferred_username, role, centers are extracted from Keycloak JWT)
- authMiddleware branching implementation (how to switch between HS256 local verification and RS256 JWKS verification)
- Error message wording for 503/405 responses in Keycloak mode
- i18n keys for Keycloak-related UI strings

### Deferred Ideas (OUT OF SCOPE)

- Full OIDC authorization code flow with PKCE (KC-V2-01)
- Token refresh and session management (KC-V2-02)
- docker-compose.yml with pre-configured Keycloak (KC-V2-03)
- Automatic role mapping from Keycloak realm roles (KC-V2-04)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| KC-01 | settings.yaml supports auth.provider and auth.keycloak config block | D-01, settings parsing pattern in initAuth.ts confirmed |
| KC-02 | Server-side JWT validation with jwks-rsa library | jwks-rsa 4.0.1 verified; getSigningKey + jwt.verify pattern documented |
| KC-03 | Keycloak claim mapping documented (preferred_username, roles, centers) | Keycloak mapper types and URL patterns verified |
| KC-04 | LoginPage shows "Login with Keycloak" when configured (UI only, no redirect) | /api/auth/config extension pattern documented; AuthContext flow studied |
| KC-05 | Documentation for Keycloak realm/client setup | docs/ directory exists; keycloak-setup.md structure specified |
| AUTH-03 | Keycloak mode: JWT signed by Keycloak (validated via JWKS endpoint) | jwks-rsa RS256 JWKS validation pattern fully researched |
</phase_requirements>

---

## Summary

Phase 6 adds Keycloak-mode support to the existing HS256 auth stack without breaking local mode. The existing `authMiddleware.ts` verifies all tokens using a single HS256 local secret. This phase adds a branch: if `auth.provider: keycloak`, the middleware instead fetches the RS256 public key from Keycloak's JWKS endpoint and verifies with that. The `AuthPayload` interface already uses Keycloak-compatible field names (`sub`, `preferred_username`, `role`, `centers`), so no schema changes are needed downstream.

The `jwks-rsa` library (v4.0.1, shipped March 2026) is the standard npm package for this problem. It handles JWKS endpoint fetching, LRU caching, and key rotation transparently. It ships its own TypeScript declarations — no separate `@types/jwks-rsa` package is needed. The key integration pattern is: decode the JWT header to extract `kid`, call `jwksClient.getSigningKey(kid)`, then pass the resulting public key to `jwt.verify()`.

The UI toggle is straightforward: `GET /api/auth/config` already exists; extend its response with `provider`. `LoginPage.tsx` already fetches this config (cached via `twoFactorEnabledRef`); adding a parallel `provider` ref enables the conditional render. The v1 Keycloak button must only show an informational message (no OIDC redirect), which is a pure UI-only change.

**Primary recommendation:** Add `jwks-rsa` as a runtime dependency; extend `initAuth.ts` to parse the Keycloak config block; add a provider-aware branch in `authMiddleware.ts`; extend `/api/auth/config` and `LoginPage`; write `docs/keycloak-setup.md`. No new frameworks needed.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jwks-rsa | 4.0.1 | Fetch and cache JWKS public keys from Keycloak | Auth0 official library; handles caching, key rotation, rateLimit; TS declarations built in |
| jsonwebtoken | 9.0.3 (already installed) | jwt.verify() with RS256 + retrieved public key | Already a project dependency; works directly with jwks-rsa key output |

[VERIFIED: npm registry — `npm view jwks-rsa version` returned `4.0.1`, published 2026-03-25]
[VERIFIED: package.json — `jsonwebtoken ^9.0.3` already in dependencies]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jose | ^6.1.3 (jwks-rsa peer) | Underlying JWK/JWS handling | Used internally by jwks-rsa; do NOT import directly |

[VERIFIED: npm view jwks-rsa dependencies — lists `jose: ^6.1.3`]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jwks-rsa | openid-client | openid-client is heavier, designed for full OIDC flows; jwks-rsa is surgical for JWKS-only validation |
| jwks-rsa | manual fetch + cache | Don't hand-roll; key rotation, rateLimit, LRU cache are non-trivial |

**Installation:**
```bash
npm install jwks-rsa
```

No `@types/jwks-rsa` needed — jwks-rsa 4.x ships `index.d.ts` internally.
[VERIFIED: npm view jwks-rsa — `types` field is `index.d.ts`]

---

## Architecture Patterns

### Provider Branch in authMiddleware.ts

The middleware reads a module-level `_authProvider` string (set at startup by `initAuth`). Depending on the value, it uses either the existing HS256 path or the new RS256/JWKS path.

```typescript
// Source: pattern derived from traveling-coderman.net + jwks-rsa README
import jwksRsa from 'jwks-rsa';
import jwt from 'jsonwebtoken';

// Initialized once at startup via initAuth()
let _jwksClient: jwksRsa.JwksClient | null = null;
let _authProvider: 'local' | 'keycloak' = 'local';

export function setKeycloakConfig(issuer: string): void {
  _authProvider = 'keycloak';
  _jwksClient = jwksRsa({
    jwksUri: `${issuer}/protocol/openid-connect/certs`,
    cache: true,
    cacheMaxAge: 10 * 60 * 1000, // 10 minutes
    rateLimit: true,
  });
}

// Inside authMiddleware, after extracting token:
if (_authProvider === 'keycloak') {
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
      res.status(401).json({ error: 'Invalid token: missing kid' });
      return;
    }
    const signingKey = await _jwksClient!.getSigningKey(decoded.header.kid);
    const payload = jwt.verify(token, signingKey.getPublicKey(), {
      algorithms: ['RS256'],
    }) as AuthPayload;
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
  return;
}
// else: existing HS256 path unchanged
```

[CITED: https://traveling-coderman.net/code/node-architecture/authentication/ — getSigningKey + jwt.verify pattern]
[CITED: https://github.com/auth0/node-jwks-rsa README — cache/rateLimit options]

**Note:** `authMiddleware` is currently synchronous (`function authMiddleware(...): void`). Adding an async JWKS lookup requires making it `async` and returning `Promise<void>`. Express 5 (already in use: `express ^5.2.1`) handles async middleware natively — no special wrapper needed.
[VERIFIED: package.json — express ^5.2.1]

### JWKS URI Derivation

Keycloak's JWKS endpoint follows a fixed URL pattern:

```
${issuer}/protocol/openid-connect/certs
```

Where `issuer` is the full realm URL, e.g.:
```
https://auth.example.com/realms/emd
```

Giving JWKS URI:
```
https://auth.example.com/realms/emd/protocol/openid-connect/certs
```

[CITED: https://www.keycloak.org/securing-apps/oidc-layers — standard Keycloak OIDC endpoint conventions]
[VERIFIED by CONTEXT.md specifics section: "jwksUri can be derived from issuer: `${issuer}/protocol/openid-connect/certs`"]

### initAuth.ts Extension

Add `KeycloakConfig` type and extend `initAuth()` to parse it:

```typescript
interface KeycloakConfig {
  issuer: string;
  clientId: string;
}

// In initAuth(), after parsing _authConfig:
const authSection = (settings.auth ?? {}) as Record<string, unknown>;
const provider = typeof authSection.provider === 'string'
  ? authSection.provider as 'local' | 'keycloak'
  : 'local';

if (provider === 'keycloak') {
  const kc = (authSection.keycloak ?? {}) as Record<string, unknown>;
  if (typeof kc.issuer !== 'string' || !kc.issuer) {
    throw new Error('[initAuth] auth.keycloak.issuer is required when auth.provider=keycloak');
  }
  // Call setKeycloakConfig from authMiddleware.ts
  setKeycloakConfig(kc.issuer);
  console.log(`[initAuth] Keycloak mode: JWKS will be fetched from ${kc.issuer}/protocol/openid-connect/certs`);
}
```

[ASSUMED] — Circular dependency risk: `authMiddleware.ts` currently imports from `initAuth.ts` (`getJwtSecret`). If `initAuth.ts` also calls `setKeycloakConfig` from `authMiddleware.ts`, a circular import results. Resolution: extract JWKS client state into a separate `server/keycloakAuth.ts` module that neither `initAuth.ts` nor `authMiddleware.ts` depends on. Both import from it.

### settings.yaml Extension

```yaml
auth:
  provider: local        # 'local' | 'keycloak'. Default: local.
  twoFactorEnabled: true
  maxLoginAttempts: 5
  otpCode: '123456'
  keycloak:              # Only read when provider=keycloak
    issuer: https://auth.example.com/realms/emd
    clientId: emd-app
```

[ASSUMED] — Current `settings.yaml` does not have an `auth:` top-level block; it has `twoFactorEnabled` at top level. The `initAuth.ts` already handles the legacy fallback: `auth.twoFactorEnabled ?? settings.twoFactorEnabled`. The new block must be added under `auth:` to be consistent with D-01. The planner must ensure the settings.yaml example shown to operators has the `auth:` section, not the legacy top-level `twoFactorEnabled`.

### /api/auth/config Extension (authApi.ts)

```typescript
// GET /config — add provider to response
authApiRouter.get('/config', (_req, res) => {
  const { twoFactorEnabled } = getAuthConfig();
  const provider = getAuthProvider(); // new export from keycloakAuth.ts or initAuth.ts
  res.json({ twoFactorEnabled, provider });
});
```

### LoginPage.tsx Conditional Render

```typescript
// In AuthContext.tsx login(), expand config fetch:
const cfg = await cfgResp.json() as { twoFactorEnabled: boolean; provider: 'local' | 'keycloak' };
providerRef.current = cfg.provider;

// In LoginPage.tsx, fetch /api/auth/config once on mount:
const [provider, setProvider] = useState<'local' | 'keycloak'>('local');

useEffect(() => {
  fetch('/api/auth/config')
    .then((r) => r.json())
    .then((cfg: { twoFactorEnabled: boolean; provider: string }) => {
      setProvider(cfg.provider === 'keycloak' ? 'keycloak' : 'local');
    })
    .catch(() => {/* default local */});
}, []);

// Render:
{provider === 'keycloak' ? (
  <KeycloakView />
) : (
  <LocalLoginForm ... />
)}
```

**Note:** The current `LoginPage.tsx` does not call `/api/auth/config` directly — it relies on `AuthContext.login()` which fetches and caches 2FA config. For the provider toggle, LoginPage needs its own config fetch on mount (before any login attempt) so it can show the right UI before the user interacts. A local `useEffect` in LoginPage is simpler than threading provider through AuthContext.

### Claim Mapping from Keycloak JWT

The existing `AuthPayload` fields map to Keycloak standard claims as follows:

| AuthPayload field | Keycloak claim | Keycloak mapper type |
|-------------------|---------------|---------------------|
| `sub` | `sub` | Built-in (automatic) |
| `preferred_username` | `preferred_username` | Built-in (automatic) |
| `role` | `role` (custom) | User Realm Role mapper (single value, mapped to claim name "role") |
| `centers` | `centers` (custom) | User Attribute mapper (multivalued, claim name "centers") |

**Keycloak client mapper setup (for docs):**
1. Role mapper: Client Scope → Mappers → Add → User Realm Role → Token Claim Name: `role` → Multivalued: OFF → Add to access token: ON
2. Centers mapper: Client Scope → Mappers → Add → User Attribute → User Attribute: `centers` → Token Claim Name: `centers` → Multivalued: ON → Claim JSON Type: String → Add to access token: ON

[CITED: https://datmt.com/backend/how-to-add-custom-claims-from-user-attributes-in-keycloak/ — User Attribute mapper for custom array claims]
[CITED: https://www.keycloak.org/securing-apps/oidc-layers — standard claim names]

**Server-side claim extraction in authMiddleware (Keycloak path):**

```typescript
// After jwt.verify() returns payload:
// Keycloak may return role as array or string depending on mapper config.
const rawRole = Array.isArray(payload.role) ? payload.role[0] : payload.role;
const rawCenters = Array.isArray(payload.centers)
  ? payload.centers
  : typeof payload.centers === 'string'
    ? [payload.centers]
    : [];

// Validate against known allowlists (same sets used in authApi.ts)
if (!VALID_ROLES.has(rawRole)) {
  res.status(403).json({ error: 'Keycloak token contains unrecognized role' });
  return;
}

req.auth = {
  sub: payload.sub,
  preferred_username: payload.preferred_username,
  role: rawRole,
  centers: rawCenters.filter((c) => VALID_CENTERS.has(c)),
  iat: payload.iat,
  exp: payload.exp,
};
```

### Anti-Patterns to Avoid

- **Do not fall back to local auth when Keycloak fails.** D-03 is explicit: fail closed with 503. Returning a local token when JWKS is unreachable is a security bypass.
- **Do not cache the entire jwt.verify result without re-verifying expiry.** JWKS public key caching (in jwks-rsa) is safe; caching the decoded payload is not — expiry check must happen on every request.
- **Do not make authMiddleware synchronous with a blocking JWKS fetch.** Always await `getSigningKey()` — it is non-blocking and the LRU cache makes it fast.
- **Do not import from authMiddleware.ts in initAuth.ts.** Circular dependency. Use a third module (`server/keycloakAuth.ts`) as the shared state container.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWKS endpoint fetching | Custom fetch + key parsing | jwks-rsa | JWK key rotation, multiple key IDs, RSA/EC key types, rate limit protection |
| JWKS caching | Custom Map with TTL | jwks-rsa (built-in LRU) | Cache invalidation on key rotation, configurable TTL, concurrent request deduplication |
| RS256 signature verification | Manual crypto | `jwt.verify(..., { algorithms: ['RS256'] })` | jsonwebtoken already handles RSA public key verification correctly |

**Key insight:** The JWKS fetch problem looks simple (it's one HTTP GET) but involves: cache invalidation when Keycloak rotates keys, handling multiple `kid` values in one JWKS response, rateLimit protection against `kid` enumeration attacks, and timeout/retry. jwks-rsa solves all of this in ~50 lines of config.

---

## Common Pitfalls

### Pitfall 1: authMiddleware becomes synchronous with async JWKS

**What goes wrong:** `authMiddleware` is currently `function(...): void`. Adding `await getSigningKey()` without making it `async` causes a silent promise drop — the middleware never calls `next()` or sends a response.

**Why it happens:** Forgetting to add `async` to the function signature when introducing the first `await`.

**How to avoid:** Change signature to `async function authMiddleware(...): Promise<void>`. Express 5 handles this correctly — async middleware that throws will be passed to the error handler automatically.

**Warning signs:** Requests to protected routes hang indefinitely (no response, no error).

### Pitfall 2: Circular import between initAuth.ts and authMiddleware.ts

**What goes wrong:** `authMiddleware.ts` imports `getJwtSecret` from `initAuth.ts`. If `initAuth.ts` also imports `setKeycloakConfig` from `authMiddleware.ts`, Node.js module loader hits a circular dependency. One module sees an incomplete export object at import time.

**Why it happens:** Naively putting JWKS client state in `authMiddleware.ts` while `initAuth.ts` needs to configure it.

**How to avoid:** Extract JWKS client state and config setter to `server/keycloakAuth.ts`. `authMiddleware.ts` imports from `keycloakAuth.ts` to get the client. `initAuth.ts` imports from `keycloakAuth.ts` to call the setter. Neither imports the other.

**Warning signs:** TypeScript compiles fine but at runtime one module's exports are `undefined`.

### Pitfall 3: Keycloak `role` claim arrives as array, not string

**What goes wrong:** The `AuthPayload.role` is typed as `string`. If the Keycloak realm role mapper is configured with Multivalued: ON, the JWT contains `"role": ["admin"]` (array). `jwt.verify` returns it as-is, and `payload.role` is an array where string is expected — silent type mismatch.

**Why it happens:** Keycloak mapper defaults for realm roles are multivalued. An admin who doesn't explicitly set Multivalued: OFF will get an array.

**How to avoid:** In the server-side claim extraction, always normalize: `const role = Array.isArray(payload.role) ? payload.role[0] : payload.role`. Document this in the setup guide. Validate against VALID_ROLES after normalization.

**Warning signs:** `role` comparisons (e.g., `req.auth.role !== 'admin'`) always evaluate to true because an array never equals a string.

### Pitfall 4: JWKS unreachable at startup vs. at request time

**What goes wrong:** The JwksClient is initialized at startup but the JWKS endpoint is only called on the first incoming request. If Keycloak is down at the time of a request (not at startup), the error occurs inside the middleware with no clear user-facing message.

**Why it happens:** JWKS is lazy-fetched on first key lookup, not eagerly fetched at startup.

**How to avoid:** Per D-03, return 503 (not 401) when JWKS fetch fails due to network error. Distinguish `JwksError` (key not found, malformed response) from fetch-level network errors in the catch block. jwks-rsa throws `SigningKeyNotFoundError` for missing kid and network errors for connectivity failures.

**Warning signs:** Users see 401 for Keycloak connectivity issues, which looks like wrong credentials rather than a server configuration problem.

### Pitfall 5: LoginPage fetches /api/auth/config too late

**What goes wrong:** If provider detection happens only inside `AuthContext.login()` (after the user submits), the page initially renders the local form. The user sees username/password fields, starts to type, and then the UI changes — jarring UX.

**Why it happens:** The existing config fetch is lazy (only runs on login attempt). Provider must be known before render.

**How to avoid:** Add a `useEffect(() => { fetch('/api/auth/config')... }, [])` in `LoginPage.tsx` that runs on mount. Initialize state as `'local'` (so the local form renders during fetch, or show a loading state). For Keycloak mode, the config response is fast (local server, no external call needed).

---

## Code Examples

### keycloakAuth.ts (new module — shared state)

```typescript
// server/keycloakAuth.ts
import jwksRsa from 'jwks-rsa';

let _provider: 'local' | 'keycloak' = 'local';
let _jwksClient: jwksRsa.JwksClient | null = null;

export function initKeycloakAuth(issuer: string): void {
  _provider = 'keycloak';
  _jwksClient = jwksRsa({
    jwksUri: `${issuer}/protocol/openid-connect/certs`,
    cache: true,
    cacheMaxAge: 10 * 60 * 1000, // 10 minutes — covers typical Keycloak key rotation window
    rateLimit: true,              // prevents kid-enumeration DoS
  });
  console.log(`[keycloakAuth] JWKS client configured for ${issuer}`);
}

export function getAuthProvider(): 'local' | 'keycloak' {
  return _provider;
}

export function getJwksClient(): jwksRsa.JwksClient | null {
  return _jwksClient;
}
```

### authMiddleware.ts — Keycloak branch

```typescript
// Replaces the existing single jwt.verify() with a branched approach
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const urlPath = req.originalUrl.split('?')[0];
  if (PUBLIC_PATHS.includes(urlPath)) return next();

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = header.slice(7);
  const provider = getAuthProvider();

  if (provider === 'keycloak') {
    await verifyKeycloakToken(token, req, res, next);
  } else {
    verifyLocalToken(token, req, res, next);
  }
}

function verifyLocalToken(token: string, req: Request, res: Response, next: NextFunction): void {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as AuthPayload;
    if (payload.purpose === 'challenge') {
      res.status(401).json({ error: 'Challenge tokens cannot be used for authentication' });
      return;
    }
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

async function verifyKeycloakToken(token: string, req: Request, res: Response, next: NextFunction): Promise<void> {
  const client = getJwksClient();
  if (!client) {
    res.status(503).json({ error: 'Keycloak auth not initialized' });
    return;
  }
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
      res.status(401).json({ error: 'Token missing key ID (kid)' });
      return;
    }
    const signingKey = await client.getSigningKey(decoded.header.kid);
    const raw = jwt.verify(token, signingKey.getPublicKey(), {
      algorithms: ['RS256'],
    }) as Record<string, unknown>;

    // Normalize and validate claims
    const rawRole = Array.isArray(raw.role) ? (raw.role as string[])[0] : (raw.role as string);
    const rawCenters = Array.isArray(raw.centers)
      ? (raw.centers as string[])
      : typeof raw.centers === 'string' ? [raw.centers] : [];

    req.auth = {
      sub: raw.sub as string,
      preferred_username: raw.preferred_username as string,
      role: rawRole,
      centers: rawCenters,
      iat: raw.iat as number,
      exp: raw.exp as number,
    };
    next();
  } catch (err: unknown) {
    // Distinguish network errors (JWKS unreachable) from token errors
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('network')) {
      res.status(503).json({ error: 'Keycloak is unreachable. Contact your administrator.' });
    } else {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  }
}
```

### /api/auth/login — 405 in Keycloak mode

```typescript
authApiRouter.post('/login', (req, res) => {
  if (getAuthProvider() === 'keycloak') {
    res.status(405).json({
      error: 'Local login is disabled. This instance uses Keycloak SSO. Contact your administrator.',
    });
    return;
  }
  // ... existing login logic unchanged
});
```

### LoginPage.tsx — provider-aware render

```typescript
// Add to top of LoginPage component:
const [provider, setProvider] = useState<'local' | 'keycloak'>('local');
const [providerLoaded, setProviderLoaded] = useState(false);

useEffect(() => {
  fetch('/api/auth/config')
    .then((r) => r.json() as Promise<{ twoFactorEnabled: boolean; provider?: string }>)
    .then((cfg) => {
      setProvider(cfg.provider === 'keycloak' ? 'keycloak' : 'local');
      setProviderLoaded(true);
    })
    .catch(() => setProviderLoaded(true)); // default local on fetch error
}, []);

// In the render, replace the credential form block:
{provider === 'keycloak' ? (
  <div className="space-y-4">
    <button
      type="button"
      onClick={() => setError(t('keycloakNotImplemented'))}
      className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
    >
      {t('loginWithKeycloak')}
    </button>
  </div>
) : (
  /* existing credential form */
)}
```

### i18n keys to add

```typescript
// Add to src/i18n/translations.ts:
loginWithKeycloak: {
  de: 'Mit Keycloak anmelden',
  en: 'Login with Keycloak',
},
keycloakNotImplemented: {
  de: 'Keycloak SSO ist konfiguriert, aber der Redirect-Flow ist noch nicht implementiert. Wenden Sie sich an Ihren Administrator.',
  en: 'Keycloak SSO is configured but the redirect flow is not yet implemented. Contact your administrator.',
},
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | (project already running) | — |
| npm | Package install | ✓ | (project active) | — |
| jwks-rsa | KC-02, AUTH-03 | ✗ (not yet installed) | 4.0.1 on registry | None — must install |
| Keycloak server | KC-02 testing | ✗ (not required for v1) | — | Not needed; jwks-rsa can be tested with a mock JWKS endpoint |

**Missing dependencies with no fallback:**
- `jwks-rsa` must be installed via `npm install jwks-rsa` before server code can use it.

**Missing dependencies with fallback:**
- A real Keycloak server is NOT required for this phase. The JWKS validation code can be integration-tested using a self-signed RSA key pair and a mock JWKS endpoint (or by directly unit-testing `verifyKeycloakToken` with a known key).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.4 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run tests/authMiddlewareKeycloak.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| KC-01 | initAuth parses auth.provider and auth.keycloak block from settings | unit | `npx vitest run tests/initAuthKeycloak.test.ts` | ❌ Wave 0 |
| KC-02 | authMiddleware validates RS256 JWT via JWKS (mocked client) | unit | `npx vitest run tests/authMiddlewareKeycloak.test.ts` | ❌ Wave 0 |
| KC-02 | authMiddleware returns 503 when JWKS unreachable | unit | `npx vitest run tests/authMiddlewareKeycloak.test.ts` | ❌ Wave 0 |
| KC-03 | Claim normalization: role as array → string; centers as array | unit | `npx vitest run tests/authMiddlewareKeycloak.test.ts` | ❌ Wave 0 |
| KC-04 | GET /api/auth/config returns provider field | unit | `npx vitest run tests/authConfigProvider.test.ts` | ❌ Wave 0 |
| KC-04 | POST /api/auth/login returns 405 when provider=keycloak | unit | `npx vitest run tests/authConfigProvider.test.ts` | ❌ Wave 0 |
| AUTH-03 | Local mode (HS256) still works when provider=local | regression | `npx vitest run tests/authMiddlewareKeycloak.test.ts` | ❌ Wave 0 |
| KC-05 | docs/keycloak-setup.md exists and covers required sections | manual | — | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/authMiddlewareKeycloak.test.ts tests/authConfigProvider.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/authMiddlewareKeycloak.test.ts` — covers KC-02, KC-03, AUTH-03
- [ ] `tests/initAuthKeycloak.test.ts` — covers KC-01 (settings parsing)
- [ ] `tests/authConfigProvider.test.ts` — covers KC-04 (config endpoint + login 405)

*(Existing tests — `tests/userCrud.test.ts`, `tests/fhirApi.test.ts`, `tests/dataApiCenter.test.ts` — must continue to pass; all operate with provider=local default)*

---

## Existing Code Compatibility Notes

These are facts confirmed by reading the codebase that the planner must account for:

1. **AuthPayload interface is already Keycloak-compatible.** `{ sub, preferred_username, role, centers }` — no changes needed to the type. [VERIFIED: server/authMiddleware.ts:16-24]

2. **authMiddleware is currently synchronous.** Must become `async` to use `await getSigningKey()`. Express 5 natively supports async middleware. [VERIFIED: server/authMiddleware.ts:51, package.json express ^5.2.1]

3. **VALID_ROLES and VALID_CENTERS live in authApi.ts as module-private constants.** To reuse them in the new `keycloakAuth.ts` or the Keycloak verification path in `authMiddleware.ts`, they must either be moved to a shared module or duplicated. Moving to `server/constants.ts` is cleaner. [VERIFIED: server/authApi.ts:27-29]

4. **settings.yaml currently has `twoFactorEnabled` at top level (not under `auth:`)**, but `initAuth.ts` already handles the fallback. Adding the `auth:` block in settings.yaml does not break backward compat. [VERIFIED: public/settings.yaml, server/initAuth.ts:70-73]

5. **LoginPage does not currently call `/api/auth/config` directly.** The config fetch is inside `AuthContext.login()` (lazy, first call only). The LoginPage needs its own config fetch on mount for the provider toggle. [VERIFIED: src/pages/LoginPage.tsx, src/context/AuthContext.tsx:183-194]

6. **GET /api/auth/config currently returns only `{ twoFactorEnabled }`.** Adding `provider` extends the response without breaking existing consumers — `AuthContext` destructures `{ twoFactorEnabled }` and ignores extras. [VERIFIED: server/authApi.ts:225-228]

7. **docs/ directory exists** (contains existing .md files). `docs/keycloak-setup.md` can be created there. [VERIFIED: ls docs/]

8. **No `@types/jwks-rsa` package exists or is needed.** The library ships its own `index.d.ts`. [VERIFIED: npm view jwks-rsa — types field is index.d.ts]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | initAuth.ts calling setKeycloakConfig() creates a circular import with authMiddleware.ts | Architecture Patterns | If wrong, no separate module needed; simpler code |
| A2 | settings.yaml `auth:` block doesn't currently exist (twoFactorEnabled is top-level) | settings.yaml Extension | If wrong, need to merge not add |
| A3 | Express 5 propagates errors from async middleware to error handler automatically | Architecture Patterns | If wrong, must wrap with try/catch (already planned) |

---

## Open Questions (RESOLVED)

1. **Should `keycloakAuth.ts` be a new module or should the JWKS state live in `initAuth.ts`?**
   - What we know: circular import risk exists if authMiddleware imports from initAuth AND initAuth calls into authMiddleware
   - What's unclear: whether the actual import graph at runtime creates a problem (Node ESM may handle some cycles)
   - Recommendation: Use `server/keycloakAuth.ts` as a safe third module — zero ambiguity, clean separation
   - **RESOLVED:** Plan 01 creates `server/keycloakAuth.ts` as a separate module

2. **Should POST /api/auth/login return 405 or 503 in Keycloak mode?**
   - What we know: D-04 says 405. The CONTEXT.md is explicit.
   - What's unclear: nothing — 405 (Method Not Allowed) is correct; local login is conceptually "not a valid method" when SSO is active
   - Recommendation: Use 405 per D-04
   - **RESOLVED:** Plan 02 Task 1 implements 405 per D-04

3. **How should tests mock the JWKS endpoint?**
   - What we know: there is no real Keycloak in this project; tests use vitest + supertest + vi.mock
   - What's unclear: whether to mock `jwks-rsa` at the module level or inject a test key directly
   - Recommendation: vi.mock('jwks-rsa') with fake JwksClient
   - **RESOLVED:** Plan 01 Task 2 uses vi.mock with ephemeral RSA key pair

---

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view jwks-rsa`) — version 4.0.1, publish date 2026-03-25, types built-in
- Codebase — `server/authMiddleware.ts`, `server/initAuth.ts`, `server/authApi.ts`, `src/pages/LoginPage.tsx`, `src/context/AuthContext.tsx`, `public/settings.yaml`, `package.json` (all read directly)
- `.planning/phases/06-keycloak-preparation/06-CONTEXT.md` — locked decisions D-01 through D-09

### Secondary (MEDIUM confidence)
- https://traveling-coderman.net/code/node-architecture/authentication/ — getSigningKey + jwt.verify integration pattern
- https://github.com/auth0/node-jwks-rsa README — cache/rateLimit configuration options
- https://www.keycloak.org/securing-apps/oidc-layers — OIDC endpoint URL conventions
- https://datmt.com/backend/how-to-add-custom-claims-from-user-attributes-in-keycloak/ — User Attribute mapper for custom claims

### Tertiary (LOW confidence)
- WebSearch results on Keycloak claim mapper setup (confirmed by multiple sources, not directly verified against current Keycloak admin console UI)

---

## Metadata

**Confidence breakdown:**
- Standard stack (jwks-rsa): HIGH — version verified from registry, types confirmed built-in
- Architecture (middleware branching): HIGH — based on direct codebase reading + verified jwks-rsa pattern
- Claim mapping: MEDIUM — based on Keycloak docs pattern; exact admin console steps may differ across Keycloak versions
- Pitfalls: HIGH — directly derived from reading existing code signatures and import graph

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (jwks-rsa is stable; Keycloak mapper UI may shift between versions)
