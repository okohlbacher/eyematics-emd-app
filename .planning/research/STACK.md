# Technology Stack — EMD v1.7 Additions

**Project:** EyeMatics EMD v1.7 — Security, TOTP, OIDC, Cross-Cohort, Dark Mode
**Researched:** 2026-04-17
**Scope:** NEW additions only. Existing stack (Express 5, better-sqlite3, jsonwebtoken, jwks-rsa, bcryptjs, Recharts, React 19, Vite) is not re-evaluated.

---

## IMPORTANT: Tailwind Version Correction

The milestone context says "Tailwind CSS v3" — this is **wrong**. The installed version is **Tailwind CSS v4** (`tailwindcss@^4.2.2` + `@tailwindcss/vite@^4.2.2`), and `src/index.css` uses `@import "tailwindcss"` (v4 CSS-first API). There is no `tailwind.config.js`. All dark mode guidance below applies to v4, not v3.

---

## 1. TOTP (RFC 6238)

### Decision: `otplib` — ADD as new dependency

**Package:** `otplib`
**Current version:** `13.4.0` (published ~25 days before 2026-04-17; actively maintained, tests run on Node 20/22/24)
**Install:**
```bash
npm install otplib
```

No peer dependencies or additional plugins are needed. The main `otplib` package bundles `@otplib/plugin-crypto-node` and `@otplib/plugin-base32-scure` internally. No separate installs required for Node.js 20+ use.

**Why `otplib` over alternatives:**
- RFC 6238 (TOTP) + RFC 4226 (HOTP) compliant, Google Authenticator compatible.
- TypeScript-first (matches project's full-TS setup).
- No native addons — pure JS, works with the `--import tsx` startup already in use.
- `speakeasy` (the only real alternative) is unmaintained since 2019.
- v13 uses `@noble/hashes` + `@scure/base` under the hood — both security-audited.

**Setup pattern for Express (replace static OTP in `authApi.ts`):**
```typescript
import { authenticator } from 'otplib';

// On user enrollment — generate a per-user secret and store it (e.g. in users.json):
const secret = authenticator.generateSecret(); // 20-byte base32 string

// On /api/auth/verify — validate the 6-digit code supplied by the user:
const isValid = authenticator.verify({ token: userSuppliedCode, secret: storedSecret });
```

The `authenticator` object from `otplib` implements the Google Authenticator TOTP profile (SHA-1, 30-second window, 6 digits). This is the correct default for compatibility with standard TOTP apps (Google Authenticator, Aegis, Bitwarden).

**Enrollment UX note (not a library question):** The server generates the secret, stores it server-side in `users.json` (per existing storage pattern), and returns an `otpauth://` URI for QR display. `otplib` generates that URI via `authenticator.keyuri(username, issuer, secret)`.

**Type declarations:** Included in `otplib` — no separate `@types/otplib` needed.

---

## 2. Keycloak OIDC Redirect Flow

### Decision: `openid-client` v6 — ADD as new dependency

**Package:** `openid-client`
**Current version:** `6.8.3` (released 2026-04-13; actively maintained by panva)
**Install:**
```bash
npm install openid-client
```

No peer dependencies. Requires Node.js 20+ (matches project constraint) and uses built-in `fetch` and `WebCryptoAPI` globals (both available in Node 20+).

**Why `openid-client` over alternatives:**

| Option | Verdict | Reason |
|--------|---------|--------|
| `openid-client` v6 | **Recommended** | Official, actively maintained, PKCE built-in, ESM-native, Node 20+ native globals |
| `passport-keycloak-bearer` | Reject | Bearer token validation only, not a redirect/OIDC client; redundant with existing jwks-rsa |
| `keycloak-connect` | Reject | Keycloak officially deprecated it for Node.js; no active maintenance |
| Manual PKCE (raw fetch + crypto) | Reject | Unnecessary complexity — `openid-client` handles state, nonce, PKCE, token exchange correctly |
| `passport` + `openid-client` strategy | Optional | Passport adds abstraction without benefit here; the raw `openid-client` v6 API is clean enough |

**v6 breaking changes relevant to this project:**
- v6 is **ESM-only**, uses ES2022 syntax. The project's `"type": "module"` and `tsx` transpilation already handle this.
- No more `Issuer.discover()` class-based API — replaced with functional `discovery()`.
- PKCE is generated per-redirect (not configurable off) — this is the correct behavior.
- Dynamic Client Registration removed — irrelevant (static Keycloak client config is used).

**Authorization code + PKCE flow pattern for `server/oidcRouter.ts` (new file):**
```typescript
import * as client from 'openid-client';
import type { Request, Response } from 'express';
import { Router } from 'express';
import session from 'express-session'; // or use signed cookies

const router = Router();
let oidcConfig: client.Configuration;

// Call once at server startup (after initAuth reads settings.yaml):
export async function initOidc(issuer: string, clientId: string, clientSecret: string) {
  oidcConfig = await client.discovery(new URL(issuer), clientId, clientSecret);
}

// GET /api/auth/oidc/login — redirect to Keycloak
router.get('/login', async (req: Request, res: Response) => {
  const code_verifier = client.randomPKCECodeVerifier();
  const code_challenge = await client.calculatePKCECodeChallenge(code_verifier);
  const state = client.randomState();

  // Store in session (existing express-session or signed cookie)
  (req.session as any).pkce = { code_verifier, state };

  const redirectUrl = client.buildAuthorizationUrl(oidcConfig, {
    redirect_uri: `${process.env.APP_BASE_URL}/api/auth/oidc/callback`,
    scope: 'openid profile email',
    code_challenge,
    code_challenge_method: 'S256',
    state,
  });
  res.redirect(redirectUrl.href);
});

// GET /api/auth/oidc/callback — handle Keycloak redirect
router.get('/callback', async (req: Request, res: Response) => {
  const { code_verifier, state } = (req.session as any).pkce ?? {};
  const tokens = await client.authorizationCodeGrant(oidcConfig, new URL(req.url, process.env.APP_BASE_URL), {
    pkceCodeVerifier: code_verifier,
    expectedState: state,
  });
  // tokens.claims() gives sub, preferred_username, etc.
  // Issue local JWT (existing signSessionToken) to keep auth flow identical to local provider.
  res.redirect('/');
});
```

**Session dependency note:** The PKCE `code_verifier` and `state` must survive between the `/login` redirect and `/callback`. Options:
1. `express-session` with an in-memory store (simple, add `npm install express-session` + `@types/express-session`) — fine for single-instance on-premises deployment.
2. Signed HttpOnly cookie containing the verifier (no new dep, but more code).

For on-premises single-instance deployments, option 1 is simpler. `express-session` is well-maintained and has no peer deps.

**Additional install (if using express-session):**
```bash
npm install express-session
npm install -D @types/express-session
```

---

## 3. Cross-Cohort Comparison on a Single ComposedChart

### Decision: No new packages — CONFIGURE EXISTING Recharts

**Current version:** `recharts@^3.8.1` (project is already on v3, which is the latest major)

Recharts `ComposedChart` natively supports multiple independent data series by:
- Passing each cohort's data to its own `<Line>` / `<Area>` child via the `data` prop override (child-level `data` prop takes precedence over the parent's `data` prop).
- Using multiple `<YAxis>` elements with `yAxisId` if cohorts need separate scales (e.g., different patient counts).
- Each cohort gets its own `dataKey` and `stroke` color (pulled from the existing `palette.ts`).

No additional Recharts packages exist or are needed. The existing `ComposedChart` + `Line` + `Area` + `Tooltip` + `Legend` components handle this fully.

**Pattern for two cohorts on one chart:**
```tsx
<ComposedChart>
  <Line data={cohortA} dataKey="median" stroke={palette.cohortA} name="Cohort A" />
  <Line data={cohortB} dataKey="median" stroke={palette.cohortB} name="Cohort B" />
  <Tooltip /> {/* Custom content prop needed to label both cohorts */}
  <Legend />
</ComposedChart>
```

Tooltip customization (custom `content` render prop) will be needed to correctly label cohort A vs B — this is pure React, no library change.

**Confidence:** HIGH — verified against Recharts v3 documentation and GitHub issues confirming child-level `data` prop behavior.

---

## 4. Dark Mode — Tailwind CSS v4

### Decision: CSS `@custom-variant` — CONFIGURE EXISTING, no new packages

The project uses **Tailwind CSS v4**, not v3. In v4, the `darkMode` key in `tailwind.config.js` does not exist. Configuration is done in CSS.

**What to add in `src/index.css`:**
```css
@import "tailwindcss";

/* Class-based dark mode: add `dark` class to <html> to activate */
@custom-variant dark (&:where(.dark, .dark *));
```

This replaces the v3 `darkMode: 'class'` config entirely. After adding this line, all `dark:` utility classes work identically to v3's class-based mode.

**Runtime toggle (React):**
```typescript
// Toggle dark mode by adding/removing class on <html>
document.documentElement.classList.toggle('dark', isDarkMode);
// Persist preference in localStorage (existing pattern)
```

**No additional tooling needed.** The existing Vite + `@tailwindcss/vite` plugin processes the `@custom-variant` directive automatically.

**Why `class`-based over `media`-based (default):**
- The codebase has WCAG-specific palette work (`palette.ts`, VQA-02). Class-based lets users toggle dark mode manually regardless of OS setting, which is necessary for clinical dashboard accessibility testing.
- `media`-based (the v4 default) requires no config but cannot be overridden by the user — unsuitable for a professional tool where users expect a UI toggle.

**Confidence:** HIGH — verified against official Tailwind CSS v4 dark mode documentation.

---

## 5. JWT Algorithm Pinning

### Decision: Pure `jsonwebtoken` config change — NO new dependencies

This is a configuration fix to `server/authMiddleware.ts`, not a library addition.

**Current gap:** `verifyLocalToken` calls:
```typescript
jwt.verify(token, getJwtSecret())
// No `algorithms` option — accepts any algorithm including 'none'
```

The Keycloak path already pins correctly: `{ algorithms: ['RS256'] }`.

**Fix — add `algorithms` option to the local HS256 path:**
```typescript
jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] })
```

And pin the sign calls (already correct in `authApi.ts` with `{ algorithm: 'HS256' }`, but explicit for clarity).

**Why this matters:** Without algorithm pinning, a crafted token with `alg: none` or `alg: RS256` (using the HMAC secret as a public key) could bypass verification. Pinning to `['HS256']` eliminates algorithm confusion attacks (CVE class referenced in jsonwebtoken security advisories).

**No new packages.** `jsonwebtoken@^9.0.3` already supports the `algorithms` option. No upgrade needed.

**Confidence:** HIGH — jsonwebtoken v9 API verified; the gap in `verifyLocalToken` confirmed by reading `server/authMiddleware.ts`.

---

## Summary: What to ADD vs CONFIGURE

| Feature | Action | Package | Version |
|---------|--------|---------|---------|
| TOTP | ADD | `otplib` | `^13.4.0` |
| OIDC redirect flow | ADD | `openid-client` | `^6.8.3` |
| OIDC session state | ADD (if using session) | `express-session` + `@types/express-session` | latest |
| Cross-cohort comparison | CONFIGURE EXISTING | `recharts` (already `^3.8.1`) | — |
| Dark mode | CONFIGURE EXISTING | `tailwindcss` CSS (`@custom-variant`) | — |
| JWT algorithm pin | CONFIGURE EXISTING | `jsonwebtoken` (already `^9.0.3`) | — |

**Net new `dependencies`:** `otplib`, `openid-client`, optionally `express-session`
**Net new `devDependencies`:** optionally `@types/express-session`

```bash
# Minimum install for TOTP + OIDC:
npm install otplib openid-client

# Add if using express-session for PKCE state:
npm install express-session
npm install -D @types/express-session
```

---

## Peer Dependency Warnings

- `otplib@13.x` — no peer dependencies. Bundles its own crypto/base32 plugins.
- `openid-client@6.x` — no peer dependencies. Requires Node.js 20+ globals (`fetch`, `WebCryptoAPI`) which are available in the project's `Node.js >= 20` baseline.
- `express-session` — no peer deps, but requires a session store for production; in-memory default is acceptable for single-instance on-premises deployment.

---

## Sources

- otplib npm: https://www.npmjs.com/package/otplib
- otplib getting started: https://otplib.yeojz.dev/guide/getting-started.html
- otplib GitHub: https://github.com/yeojz/otplib
- openid-client npm: https://www.npmjs.com/package/openid-client
- openid-client GitHub: https://github.com/panva/openid-client
- openid-client v6 discussion: https://github.com/panva/openid-client/discussions/702
- Tailwind CSS v4 dark mode: https://tailwindcss.com/docs/dark-mode
- JWT algorithm confusion: https://www.sourcery.ai/vulnerabilities/jwt-algorithm-confusion
- Keycloak deprecating keycloak-connect: https://dev.to/austincunningham/keycloak-express-openid-client-3mmg
