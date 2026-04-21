# Phase 15: TOTP 2FA - Research

**Researched:** 2026-04-17
**Domain:** TOTP (RFC 6238) per-user authentication, Node.js/Express/React
**Confidence:** HIGH

## Summary

Phase 15 replaces the shared static `otpCode` in `settings.yaml` with per-user RFC 6238 TOTP secrets using `otplib@13.4.0`. Each `UserRecord` gains three new optional fields (`totpSecret`, `totpEnabled`, `totpRecoveryCodes`). The existing `POST /verify` static comparison is replaced with a conditional: enrolled users verify against TOTP + recovery codes, non-enrolled users fall back to the static OTP. The enrollment flow follows the Phase 14 `PasswordChangePage` pattern precisely — a purpose-checked JWT gates a full-page interstitial (`TotpEnrollPage`), which is rendered by `AppRoutes()` before the router.

All decisions have been pre-made in CONTEXT.md. The implementation is a direct extension of existing Phase 14 patterns with no novel architecture. The key risk areas are: (1) correct `otplib` ESM import syntax in a `"type": "module"` project, (2) redacting `enrollToken` and `totpSecret` in the audit middleware, and (3) ensuring new TOTP API routes are added to `PUBLIC_PATHS` in `authMiddleware.ts`.

**Primary recommendation:** Follow the Phase 14 `mustChangePassword` / `PasswordChangePage` pattern exactly — same JWT purpose-check gate, same App.tsx interstitial, same `modifyUsers()` write pattern. The codebase already has all the structural primitives.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

All decisions deferred to Claude. The following are locked as reasonable defaults:

- **D-01:** Post-password-success gate: return `{ requiresTotpEnrollment: true, enrollToken: <3-min JWT, purpose='totp-enroll'> }` instead of session token for unenrolled users when `twoFactorEnabled: true`
- **D-02:** Full-page `TotpEnrollPage` (same pattern as `PasswordChangePage`) with QR code, manual key, 6-digit confirmation field
- **D-03:** 10 recovery codes, 8 alphanumeric chars (`ABCD-1234` format), bcrypt-hashed in `totpRecoveryCodes[]`, burned on use, shown once with copy-all + download-as-txt, "I have saved" checkbox gate
- **D-04:** Admin "Reset 2FA" button in AdminPage user row (visible when `totpEnabled === true`); API: `DELETE /api/auth/users/:username/totp`; clears `totpSecret`, `totpEnabled`, `totpRecoveryCodes`
- **D-05:** LoginPage OTP step unchanged structurally; backend distinguishes TOTP vs recovery codes transparently
- **D-06:** `POST /verify` tries TOTP first; if fail, checks recovery codes (bcrypt.compareSync each); on recovery code match: burn it, issue JWT, include `{ recoveryCodeUsed: true }`
- **D-07:** `twoFactorEnabled` stays as global gate; static OTP fallback for non-enrolled users
- **D-08:** New `UserRecord` fields: `totpSecret?: string`, `totpEnabled?: boolean`, `totpRecoveryCodes?: string[]`
- **D-09:** `otplib@13.4.0` + `qrcode@1.5.4`; `Authenticator.options.window = 1` (±1 period)
- **D-10:** ±1 window tolerance
- **D-11:** New endpoints: `POST /api/auth/totp/enroll`, `POST /api/auth/totp/confirm`, `DELETE /api/auth/users/:username/totp`
- **D-12:** Audit events: `totp-enrolled`, `totp-reset`, `totp-recovery-used`

### Claude's Discretion

None — all implementation decisions locked per CONTEXT.md.

### Deferred Ideas (OUT OF SCOPE)

- Self-service TOTP disable/re-enrollment from user settings page (SEC-07)
- Recovery code regeneration after initial enrollment
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-04 | TOTP (RFC 6238) per-user secret replaces site-wide static OTP; enrollment via QR code; ±1 window | `otplib@13.4.0` `authenticator` API handles RFC 6238 exactly; `qrcode.toDataURL()` generates PNG for `<img>`; `window: 1` option verified |
| SEC-05 | TOTP recovery codes generated at enrollment, bcrypt-hashed per user, burned on use | `bcrypt.hashSync` + `bcrypt.compareSync` already in codebase; `modifyUsers()` removes burned code atomically |
</phase_requirements>

---

## Standard Stack

### Core (new installs required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| otplib | 13.4.0 | RFC 6238 TOTP secret generation, code verification | Decided in D-09; ESM-compatible, ships CJS+ESM exports; actively maintained |
| qrcode | 1.5.4 | Generate `otpauth://` URI as PNG data URL | Decided in D-09; no native deps, pure JS, `toDataURL()` API |

[VERIFIED: npm registry] — `npm view otplib version` returns `13.4.0`, `npm view qrcode version` returns `1.5.4`. Both match decisions exactly.

### Supporting (type definitions)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/qrcode | 1.5.6 | TypeScript types for qrcode | Required — qrcode ships no bundled types |
| @types/otplib | 10.0.0 | TypeScript types for otplib | Available but otplib 13 ships own `.d.ts`; verify at install |

[VERIFIED: npm registry] — `npm view @types/qrcode version` returns `1.5.6`.

### Already in project (no install needed)

| Library | Already Used For | Reused For |
|---------|-----------------|------------|
| bcryptjs | password hashing | recovery code hashing + comparison |
| jsonwebtoken | session + challenge JWTs | enrollToken (purpose='totp-enroll') |
| crypto (Node built-in) | JWT secret generation | TOTP secret via `authenticator.generateSecret()` |

**Installation:**
```bash
npm install otplib@13.4.0 qrcode@1.5.4
npm install --save-dev @types/qrcode@1.5.6
```

**Note on @types/otplib:** otplib 13.4.0 ships its own TypeScript declarations (`dist/index.d.ts`). Do NOT install `@types/otplib` — it is for older versions and will conflict. [VERIFIED: npm registry exports field shows `types` key pointing to bundled `.d.ts`]

---

## Architecture Patterns

### Existing Pattern Being Replicated: mustChangePassword / PasswordChangePage

The Phase 14 mustChangePassword flow is the exact template. Every layer has a direct parallel:

| Phase 14 (mustChangePassword) | Phase 15 (requiresTotpEnrollment) |
|-------------------------------|-----------------------------------|
| `{ mustChangePassword: true, changeToken }` from `/login` | `{ requiresTotpEnrollment: true, enrollToken }` from `/login` |
| `purpose: 'change-password'` JWT | `purpose: 'totp-enroll'` JWT |
| `mustChangePassword` state in AuthContext | `requiresTotpEnrollment` state in AuthContext |
| `pendingChangeToken` in AuthContext | `pendingEnrollToken` in AuthContext |
| `changePassword()` function in AuthContext | `startTotpEnroll()` + `confirmTotpEnroll()` in AuthContext |
| `if (mustChangePassword) return <PasswordChangePage />` in AppRoutes | `if (requiresTotpEnrollment) return <TotpEnrollPage />` in AppRoutes |
| `POST /api/auth/change-password` | `POST /api/auth/totp/enroll` + `POST /api/auth/totp/confirm` |

### Login Flow (Phase 15 modified)

```
POST /login
  ├── 1. Rate-limit check
  ├── 2. Bcrypt password verify
  ├── 3. mustChangePassword gate (Phase 14 — unchanged)
  ├── 4. [NEW] requiresTotpEnrollment gate:
  │       if twoFactorEnabled && !user.totpEnabled
  │       → return { requiresTotpEnrollment: true, enrollToken }
  └── 5. twoFactorEnabled → challengeToken, else → session JWT (unchanged)
```

### Verify Flow (Phase 15 modified)

```
POST /verify
  ├── 1. Validate challengeToken (purpose='challenge') — unchanged
  ├── 2. Rate-limit check — unchanged
  ├── 3. Load user
  └── 4. [MODIFIED] OTP check:
        if user.totpEnabled:
          a. Try TOTP: authenticator.check(otp, user.totpSecret)
          b. If TOTP fails: try recovery codes (bcrypt.compareSync each)
          c. If recovery code matches: burn it, flag recoveryCodeUsed=true
          d. If neither: 401
        else:
          static otpCode comparison (unchanged fallback)
```

### Enrollment Flow (new)

```
POST /api/auth/totp/enroll  (requires enrollToken)
  └── Returns { qrDataUrl, manualKey }
      (stores pendingSecret in-memory or re-derives — see Pitfall 2)

POST /api/auth/totp/confirm  (requires enrollToken + otp)
  ├── Verify TOTP code against pendingSecret
  ├── Generate 10 recovery codes
  ├── Hash recovery codes (bcrypt, 12 rounds)
  ├── modifyUsers(): set totpSecret, totpEnabled=true, totpRecoveryCodes
  ├── Audit: totp-enrolled
  └── Return { recoveryCodes: string[], token: sessionJWT }
```

### Anti-Patterns to Avoid

- **Storing plaintext recovery codes:** Store only bcrypt hashes. Never log or return codes after initial display.
- **Stateful pending secret server-side:** The `enrollToken` is a JWT with embedded `sub`. Re-derive or embed the secret in the JWT rather than keeping a `Map<username, pendingSecret>`. If using a Map, it is cleared on server restart — the user must restart enrollment. Simpler: sign the secret into the enrollToken payload itself (it is already server-signed; the client does not control it).
- **Accepting `totp-enroll` purpose tokens on protected routes:** The `verifyLocalToken` function in `authMiddleware.ts` already rejects `challenge` and `change-password` purpose tokens. `totp-enroll` must be added to the same rejection list.
- **Missing PUBLIC_PATHS entries:** `/api/auth/totp/enroll` and `/api/auth/totp/confirm` must be added to `PUBLIC_PATHS` in `authMiddleware.ts` — they are gated by enrollToken, not session JWT.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TOTP code generation/verification | Custom HMAC-SHA1 + time-step math | `otplib` `authenticator` | RFC 6238 has subtle clock-skew, counter, and step-size requirements |
| QR code image | Canvas/SVG generation | `qrcode.toDataURL()` | Error correction levels, quiet zone, module size — complex to get right |
| Recovery code entropy | `Math.random()` | `crypto.randomBytes()` | Cryptographically secure; already used in project for JWT secret |
| Atomic recovery code burn | Read-modify-write outside lock | `modifyUsers()` callback | Existing write lock prevents TOCTOU race on concurrent requests |

**Key insight:** The codebase already has all needed primitives (`modifyUsers`, `bcrypt`, `jwt`, `crypto`). Only `otplib` and `qrcode` are new dependencies.

---

## Common Pitfalls

### Pitfall 1: otplib ESM Import in `"type": "module"` Project

**What goes wrong:** `import { authenticator } from 'otplib'` fails at runtime or TypeScript complains about module resolution in the server context.

**Why it happens:** The project uses `"type": "module"` and `tsx` for server execution. otplib 13.4.0 ships proper ESM (`dist/index.js`) and CJS (`dist/index.cjs`), so the import works — but `tsconfig.app.json` uses `moduleResolution: "bundler"` which is Vite-side only. Server code is compiled/run via `tsx` which handles ESM natively.

**How to avoid:** Use the standard import `import { authenticator } from 'otplib';` in server files. Do NOT import from `otplib/presets` (legacy pattern from v11). The v13 `authenticator` object is the correct entry point.

**Example:**
```typescript
// Source: otplib 13.4.0 package exports (verified via npm view)
import { authenticator } from 'otplib';
authenticator.options = { window: 1 }; // ±1 period tolerance (D-10)
const secret = authenticator.generateSecret(); // base32-encoded
const isValid = authenticator.check(otp, secret);
const otpauthUri = authenticator.keyuri(username, 'EyeMatics', secret);
```

### Pitfall 2: Pending Secret Storage During Enrollment

**What goes wrong:** `POST /api/auth/totp/enroll` generates a secret and returns the QR code. `POST /api/auth/totp/confirm` must verify against the SAME secret. If stored only in-memory (a Map), server restart between the two calls loses it.

**Why it happens:** Two-step enrollment requires state persistence between HTTP calls.

**How to avoid:** Sign the `totpSecret` into the `enrollToken` JWT payload itself. The JWT is already signed with the server secret, so the secret cannot be tampered with by the client. Pattern:

```typescript
// POST /api/auth/totp/enroll
const secret = authenticator.generateSecret();
const enrollToken = jwt.sign(
  { sub: username, purpose: 'totp-enroll', totpSecret: secret },
  getJwtSecret(),
  { algorithm: 'HS256', expiresIn: '3m' }
);
// Return QR code + enrollToken (client sends enrollToken back to /confirm)
```

```typescript
// POST /api/auth/totp/confirm
const payload = jwt.verify(enrollToken, getJwtSecret(), { algorithms: ['HS256'] })
  as { sub: string; purpose: string; totpSecret: string };
// payload.totpSecret is the same secret — no server-side storage needed
```

This eliminates memory state and is restart-safe.

### Pitfall 3: Recovery Code bcrypt Performance

**What goes wrong:** Hashing 10 recovery codes at bcrypt rounds=12 during the confirmation request adds ~3-4 seconds of blocking CPU time.

**Why it happens:** bcrypt at 12 rounds ≈ 300ms per hash × 10 codes = ~3s.

**How to avoid:** Use `bcrypt.hash()` (async) in a `Promise.all()`:
```typescript
const rawCodes = Array.from({ length: 10 }, () => generateRecoveryCode());
const hashedCodes = await Promise.all(rawCodes.map((c) => bcrypt.hash(c, 12)));
```
`Promise.all` runs them concurrently via libuv thread pool, reducing wall time to ~300-400ms (one batch).

### Pitfall 4: Recovery Code Verification Is O(N) bcrypt Compares

**What goes wrong:** `POST /verify` must check the submitted value against up to 10 hashed recovery codes, each taking ~300ms. Sequential checking can block for 3 seconds.

**Why it happens:** bcrypt has no constant-time equality shortcut.

**How to avoid:** Run all comparisons concurrently with `Promise.all`:
```typescript
const results = await Promise.all(
  user.totpRecoveryCodes.map((hash) => bcrypt.compare(otp, hash))
);
const matchIndex = results.findIndex(Boolean);
```
Then burn `user.totpRecoveryCodes[matchIndex]` via `modifyUsers()`.

### Pitfall 5: Audit Middleware Not Redacting enrollToken and totpSecret

**What goes wrong:** `enrollToken` appears in request body for `/api/auth/totp/confirm`; `totpSecret` could appear in a logged response. Both are sensitive.

**Why it happens:** `REDACT_FIELDS` in `auditMiddleware.ts` covers `password`, `otp`, `challengeToken`, `generatedPassword` — but not `enrollToken` or `totpSecret`.

**How to avoid:**
1. Add `enrollToken` and `totpSecret` to `REDACT_FIELDS` in `auditMiddleware.ts`.
2. Add `/api/auth/totp/confirm` to `REDACT_PATHS` (the path whose body gets field-level redaction).

### Pitfall 6: LoginPage OTP maxLength Is Hardcoded to 6

**What goes wrong:** Recovery codes are 8+ chars (`ABCD-1234` = 9 chars with dash). The existing OTP input has `maxLength={6}` and `placeholder="123456"`.

**Why it happens:** The input was designed for 6-digit TOTP codes only.

**How to avoid:** Remove the `maxLength={6}` constraint or increase it to handle recovery codes (up to 9 chars for `XXXX-XXXX` format). Backend distinguishes TOTP vs recovery by length/format before trying bcrypt. Alternatively: `maxLength={9}` covers both. Update the `placeholder` to something like `"123456 or recovery code"`.

### Pitfall 7: verifyLocalToken Does Not Reject `totp-enroll` Purpose

**What goes wrong:** A user who somehow obtains an `enrollToken` (purpose=`totp-enroll`) could use it as a Bearer token on protected API routes if the middleware does not reject it.

**Why it happens:** `verifyLocalToken` currently only rejects `challenge` and `change-password` purposes (line 60 of `authMiddleware.ts`).

**How to avoid:** Add `totp-enroll` to the rejection condition:
```typescript
if (payload.purpose === 'challenge' || payload.purpose === 'change-password' || payload.purpose === 'totp-enroll') {
  res.status(401).json({ error: 'Challenge tokens cannot be used for authentication' });
  return;
}
```

---

## Code Examples

### otplib: Generate Secret and QR URI

```typescript
// Source: otplib 13.4.0 verified API (npm view exports confirmed)
import { authenticator } from 'otplib';

authenticator.options = { window: 1 }; // D-10: ±1 period tolerance

// Generate new secret
const secret = authenticator.generateSecret(); // 20-byte base32 string

// Generate otpauth:// URI (D-11 / CONTEXT.md specifics)
const uri = authenticator.keyuri(username, 'EyeMatics', secret);
// → "otpauth://totp/EyeMatics:alice?secret=BASE32&issuer=EyeMatics"

// Verify a submitted code
const isValid = authenticator.check(submittedOtp, secret); // boolean
```

### qrcode: Generate Data URL

```typescript
// Source: qrcode@1.5.4 API (@types/qrcode@1.5.6)
import QRCode from 'qrcode';

const qrDataUrl = await QRCode.toDataURL(uri);
// → "data:image/png;base64,..." — ready for <img src={qrDataUrl} />
```

### Recovery Code Generation

```typescript
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

/** Generate a single 8-char recovery code: "ABCD-1234" */
function generateRecoveryCode(): string {
  const raw = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 hex chars
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`; // "ABCD-1234"
}

// Generate 10, hash concurrently
const rawCodes = Array.from({ length: 10 }, generateRecoveryCode);
const hashedCodes = await Promise.all(rawCodes.map((c) => bcrypt.hash(c, 12)));
```

### Recovery Code Verification (in POST /verify)

```typescript
import bcrypt from 'bcryptjs';

async function checkRecoveryCodes(
  submitted: string,
  hashes: string[],
): Promise<number> {
  // Returns index of matching code, or -1
  const results = await Promise.all(hashes.map((h) => bcrypt.compare(submitted, h)));
  return results.findIndex(Boolean);
}

// In /verify handler:
const matchIdx = await checkRecoveryCodes(otp, user.totpRecoveryCodes ?? []);
if (matchIdx !== -1) {
  await modifyUsers((users) =>
    users.map((u) =>
      u.username === sub
        ? { ...u, totpRecoveryCodes: u.totpRecoveryCodes!.filter((_, i) => i !== matchIdx) }
        : u,
    ),
  );
  // Issue JWT, include recoveryCodeUsed: true
}
```

### enrollToken Pattern (Pitfall 2 solution)

```typescript
// POST /api/auth/totp/enroll handler
const secret = authenticator.generateSecret();
const enrollToken = jwt.sign(
  { sub: username, purpose: 'totp-enroll', totpSecret: secret },
  getJwtSecret(),
  { algorithm: 'HS256', expiresIn: '3m' },
);
const uri = authenticator.keyuri(username, 'EyeMatics', secret);
const qrDataUrl = await QRCode.toDataURL(uri);
res.json({ qrDataUrl, manualKey: secret, enrollToken });

// POST /api/auth/totp/confirm handler
const payload = jwt.verify(enrollToken, getJwtSecret(), { algorithms: ['HS256'] })
  as { sub: string; purpose: string; totpSecret: string };
if (payload.purpose !== 'totp-enroll') { /* 401 */ }
const isValid = authenticator.check(otp, payload.totpSecret);
```

### AdminPage "Reset 2FA" Button Pattern

```typescript
// Matches existing handleDelete / handleResetPassword pattern in AdminPage.tsx
const handleResetTotp = async (targetUsername: string) => {
  if (!confirm(`Reset 2FA for ${targetUsername}? They will re-enroll on next login.`)) return;
  const resp = await authFetch(
    `/api/auth/users/${encodeURIComponent(targetUsername)}/totp`,
    { method: 'DELETE' },
  );
  if (resp.ok) await loadUsers();
};
```

### AuthContext: Adding TOTP Enrollment State (mirrors mustChangePassword pattern)

```typescript
// New state alongside mustChangePassword (same shape):
const [requiresTotpEnrollment, setRequiresTotpEnrollment] = useState(false);
const [pendingEnrollToken, setPendingEnrollToken] = useState<string | null>(null);

// In login() Step 1 response handling (after mustChangePassword check):
if (data.requiresTotpEnrollment && data.enrollToken) {
  setRequiresTotpEnrollment(true);
  setPendingEnrollToken(data.enrollToken);
  return { ok: false, error: 'totp_enrollment_required', enrollToken: data.enrollToken };
}
```

### App.tsx Gate (mirrors mustChangePassword gate)

```typescript
function AppRoutes() {
  const { mustChangePassword, requiresTotpEnrollment } = useAuth();

  if (mustChangePassword) return <PasswordChangePage />;
  if (requiresTotpEnrollment) return <TotpEnrollPage />;  // NEW — Phase 15

  return (
    <Routes>
      {/* ... existing routes ... */}
    </Routes>
  );
}
```

---

## Key Integration Points (Codebase-Specific)

### Files That Must Change

| File | Change |
|------|--------|
| `server/initAuth.ts` | Add `totpSecret?`, `totpEnabled?`, `totpRecoveryCodes?` to `UserRecord` interface |
| `server/authApi.ts` | Modify `POST /login` (add TOTP enrollment gate after mustChangePassword); modify `POST /verify` (conditional TOTP vs static); add `POST /totp/enroll`, `POST /totp/confirm` handlers; add `DELETE /users/:username/totp` handler |
| `server/authMiddleware.ts` | Add `/api/auth/totp/enroll`, `/api/auth/totp/confirm` to `PUBLIC_PATHS`; add `totp-enroll` to purpose rejection in `verifyLocalToken` |
| `server/auditMiddleware.ts` | Add `enrollToken`, `totpSecret` to `REDACT_FIELDS`; add `/api/auth/totp/confirm` to `REDACT_PATHS` |
| `src/context/AuthContext.tsx` | Add `requiresTotpEnrollment`, `pendingEnrollToken`, TOTP enrollment functions to context; extend `LoginResult` type; extend `AuthContextType` interface |
| `src/App.tsx` | Add `if (requiresTotpEnrollment) return <TotpEnrollPage />` in `AppRoutes()` |
| `src/pages/LoginPage.tsx` | Remove or increase `maxLength={6}` on OTP input; update placeholder |
| `src/pages/AdminPage.tsx` | Add "Reset 2FA" button to user row (visible when `totpEnabled`); add `handleResetTotp` handler |
| `src/i18n/translations.ts` | Add TOTP enrollment i18n keys (DE + EN) |

### New Files

| File | Purpose |
|------|---------|
| `src/pages/TotpEnrollPage.tsx` | Full-page TOTP enrollment interstitial (mirrors PasswordChangePage) |
| `src/components/RecoveryCodesPanel.tsx` | Recovery codes display: list, copy-all, download-as-txt, "I have saved" checkbox |
| `tests/totpEnrollment.test.ts` | Backend TOTP enrollment + verify tests |
| `tests/totpAdmin.test.ts` | Admin reset TOTP test |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Server runtime | Yes | (existing) | — |
| otplib@13.4.0 | TOTP verify + secret gen | No — must install | — | None |
| qrcode@1.5.4 | QR code PNG generation | No — must install | — | None |
| bcryptjs | Recovery code hashing | Yes | ^3.0.3 | — |
| crypto (built-in) | Recovery code entropy | Yes | Node built-in | — |

**Missing dependencies with no fallback:**
- `otplib` — core TOTP library; must be installed before any server code using it runs
- `qrcode` — QR code generation; must be installed before `TotpEnrollPage` can render a QR

**Missing dependencies with fallback:** None that would block.

---

## Validation Architecture

**nyquist_validation:** Not explicitly disabled in `.planning/config.json` (only `_auto_chain_active` key present). Treat as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest@4.1.4 |
| Config file | `vite.config.ts` (vitest block in same file) |
| Quick run command | `npx vitest run tests/totpEnrollment.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-04 | `POST /login` returns `requiresTotpEnrollment` + `enrollToken` when unenrolled | unit (supertest) | `npx vitest run tests/totpEnrollment.test.ts` | No — Wave 0 |
| SEC-04 | `POST /totp/enroll` validates enrollToken purpose | unit (supertest) | `npx vitest run tests/totpEnrollment.test.ts` | No — Wave 0 |
| SEC-04 | `POST /totp/confirm` verifies TOTP code, activates enrollment | unit (supertest) | `npx vitest run tests/totpEnrollment.test.ts` | No — Wave 0 |
| SEC-04 | `POST /verify` with enrolled user: TOTP code accepted | unit (supertest) | `npx vitest run tests/totpEnrollment.test.ts` | No — Wave 0 |
| SEC-04 | `POST /verify` with non-enrolled user: static OTP fallback still works | unit (supertest) | `npx vitest run tests/totpEnrollment.test.ts` | No — Wave 0 |
| SEC-04 | `DELETE /users/:username/totp` admin only; clears TOTP fields | unit (supertest) | `npx vitest run tests/totpAdmin.test.ts` | No — Wave 0 |
| SEC-05 | Recovery codes returned as plaintext once, stored as bcrypt hashes | unit (supertest) | `npx vitest run tests/totpEnrollment.test.ts` | No — Wave 0 |
| SEC-05 | Valid recovery code passes `POST /verify`, is burned (removed from array) | unit (supertest) | `npx vitest run tests/totpEnrollment.test.ts` | No — Wave 0 |
| SEC-05 | Used recovery code cannot be reused | unit (supertest) | `npx vitest run tests/totpEnrollment.test.ts` | No — Wave 0 |
| SEC-05 | Response includes `recoveryCodeUsed: true` when recovery path taken | unit (supertest) | `npx vitest run tests/totpEnrollment.test.ts` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/totpEnrollment.test.ts tests/totpAdmin.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green (`449 + N new tests`) before `/gsd-verify-work`

### Wave 0 Gaps

- `tests/totpEnrollment.test.ts` — covers SEC-04 (enrollment flow) and SEC-05 (recovery codes)
- `tests/totpAdmin.test.ts` — covers SEC-04 (admin TOTP reset)
- Framework install: `npm install otplib@13.4.0 qrcode@1.5.4 && npm install --save-dev @types/qrcode@1.5.6` — required before Wave 1

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | otplib RFC 6238 TOTP; ±1 window; bcrypt recovery codes |
| V3 Session Management | Yes | Enrollment gated by purpose-checked JWT (enrollToken); session issued only after TOTP confirm |
| V4 Access Control | Yes | Admin-only `DELETE /users/:username/totp`; `req.auth.role !== 'admin'` guard |
| V5 Input Validation | Yes | OTP field: string, max 9 chars; enrollToken: JWT signature verified before trust |
| V6 Cryptography | Yes | `crypto.randomBytes()` for recovery codes; bcrypt for hashing; never hand-rolled |

### Known Threat Patterns for TOTP Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| TOTP brute force | Elevation of Privilege | Existing rate limiter (shared with password attempts, T-02-06) — already covers `/verify` |
| Recovery code brute force | Elevation of Privilege | Same rate limiter on `/verify`; 10 codes, each 32-bit entropy (`crypto.randomBytes(4)`) |
| Secret extraction from enrollToken | Information Disclosure | enrollToken is signed HS256 — tampering detectable; secret not persisted in logs (add to REDACT_FIELDS) |
| Replay of burned recovery code | Elevation of Privilege | `modifyUsers()` removes burned code atomically under write lock; second use finds no match |
| Admin self-reset bypass | Elevation of Privilege | Admin "Reset 2FA" targets OTHER users; no self-bypass risk (admin controls own enrollment normally) |
| Enrollment token reuse after confirm | Elevation of Privilege | `enrollToken` has 3-min expiry; `totpEnabled=true` after confirm means re-running confirm yields TOTP mismatch (secret embedded in token, cannot re-enroll with same token) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | otplib `authenticator.check()` is sufficient for RFC 6238 compliance with `window: 1` | Standard Stack | Low — widely used, tested library; TOTP spec is simple |
| A2 | Embedding `totpSecret` in the signed `enrollToken` JWT payload is secure for the 3-minute window | Code Examples | Low — JWT is signed with server secret; secret cannot be read by client without HS256 key |
| A3 | `Promise.all` over bcrypt recovery code hashes is fast enough (< 1s wall time) | Common Pitfalls | Low — libuv thread pool handles concurrent bcrypt well in practice |

**All other claims verified from codebase inspection or npm registry.**

---

## Open Questions

1. **Recovery code format: with or without dash separator?**
   - What we know: D-03 specifies "8 alphanumeric chars (e.g., ABCD-1234)". The example has a dash, making it 9 chars with separator.
   - What's unclear: Whether the dash is stored in the hash or stripped before hashing.
   - Recommendation: Hash the code WITH the dash (hash `ABCD-1234`), display with dash for readability, instruct user to type it as shown. This is consistent with how most services handle formatted recovery codes.

2. **LoginPage OTP input: accept recovery codes transparently?**
   - What we know: D-05 says "backend distinguishes them"; LoginPage is "reused" without structural change.
   - What's unclear: The current `maxLength={6}` and `tracking-widest text-center text-lg` styling is optimized for 6-digit codes, not 9-char recovery codes.
   - Recommendation: Remove `maxLength` restriction (or set to 9), keep the field type as `text`. The backend handles both formats. Update placeholder text to mention recovery codes.

---

## Sources

### Primary (HIGH confidence)

- Codebase: `server/authApi.ts` — existing login/verify/change-password patterns inspected directly
- Codebase: `server/initAuth.ts` — UserRecord interface, modifyUsers pattern inspected directly
- Codebase: `server/authMiddleware.ts` — PUBLIC_PATHS, verifyLocalToken purpose rejection inspected
- Codebase: `server/auditMiddleware.ts` — REDACT_FIELDS, REDACT_PATHS inspected
- Codebase: `src/context/AuthContext.tsx` — mustChangePassword state pattern inspected
- Codebase: `src/pages/PasswordChangePage.tsx` — enrollment interstitial template inspected
- Codebase: `src/pages/LoginPage.tsx` — OTP step (maxLength=6) inspected
- Codebase: `src/pages/AdminPage.tsx` — handleDelete/handleResetPassword patterns inspected
- Codebase: `tests/mustChangePassword.test.ts` — test template for TOTP tests
- npm registry: `npm view otplib version` → `13.4.0` [VERIFIED]
- npm registry: `npm view qrcode version` → `1.5.4` [VERIFIED]
- npm registry: `npm view @types/qrcode version` → `1.5.6` [VERIFIED]
- npm registry: `npm view otplib@13.4.0 exports` — confirmed ESM + CJS exports with bundled types [VERIFIED]

### Secondary (MEDIUM confidence)

- otplib 13.x API: `authenticator.generateSecret()`, `authenticator.check()`, `authenticator.keyuri()` — [ASSUMED from training data; consistent with npm package structure]
- qrcode `QRCode.toDataURL(uri)` async API — [ASSUMED from training data; consistent with @types/qrcode@1.5.6 signature]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified via npm registry
- Architecture: HIGH — directly derived from existing Phase 14 code patterns in codebase
- Pitfalls: HIGH — identified from direct codebase inspection (maxLength, REDACT_FIELDS, PUBLIC_PATHS, purpose rejection)
- API examples: MEDIUM — otplib/qrcode APIs assumed from training; to be confirmed at install time

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (otplib and qrcode are stable; project patterns won't change)
