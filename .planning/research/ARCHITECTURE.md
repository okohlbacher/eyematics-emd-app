# Architecture: v1.7 Integration Points

**Project:** EyeMatics EMD v1.7 — Security, Performance & Cross-Cohort
**Researched:** 2026-04-17
**Mode:** Integration analysis on existing Express 5 + React/TypeScript codebase

---

## 1. JWT `algorithms` Pin

**File:** `server/authMiddleware.ts`

**Exact change — one call, local path only.**

`verifyLocalToken` (line 59) calls `jwt.verify(token, getJwtSecret())` with no `options` argument. Add `{ algorithms: ['HS256'] }` as the third argument:

```typescript
// BEFORE (line 59):
const payload = jwt.verify(token, getJwtSecret()) as AuthPayload;

// AFTER:
const payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as AuthPayload;
```

**Keycloak path is already pinned.** `verifyKeycloakToken` (line 101) already passes `{ algorithms: ['RS256'] }`. No change needed there.

**Challenge token in `authApi.ts` (line 181)** — `jwt.verify(challengeToken, getJwtSecret())` in `POST /verify` also lacks an algorithms pin. This is a second call site that needs the same fix. Both are HS256 operations using the same local secret.

**Summary:** Two `jwt.verify` calls need pinning — `verifyLocalToken` in `authMiddleware.ts` and the challenge-token verify in `authApi.ts`. The Keycloak `verifyKeycloakToken` branch is already correctly pinned and must not be touched.

---

## 2. `cohortHashSecret` Auto-Generation

**Current state:** `initHashCohortId` in `server/hashCohortId.ts` throws a fatal error at startup if `settings.audit.cohortHashSecret` is absent or shorter than 32 characters (lines 27–33). There is no auto-generation — the operator must set it manually in `config/settings.yaml`.

**Pattern to follow:** `initAuth` in `server/initAuth.ts` (lines 60–68):

```typescript
// Exact jwt-secret.txt pattern:
const secretFile = path.join(dataDir, 'jwt-secret.txt');
if (fs.existsSync(secretFile)) {
  _jwtSecret = fs.readFileSync(secretFile, 'utf-8').trim();
  if (!_jwtSecret) throw new Error('...');
} else {
  _jwtSecret = crypto.randomBytes(32).toString('hex');  // 64 hex chars
  fs.writeFileSync(secretFile, _jwtSecret, { encoding: 'utf-8', mode: 0o600 });
  console.log(`[initAuth] Generated new JWT secret at ${secretFile}`);
}
```

**What changes:**

- `initHashCohortId(settings)` in `server/hashCohortId.ts` currently reads the secret purely from `settings`. Change it to accept `dataDir` as a second argument and check `data/cohort-hash-secret.txt` first, falling back to `settings.audit.cohortHashSecret`, and auto-generating if both are absent.
- Write the generated secret to `data/cohort-hash-secret.txt` with `mode: 0o600`.
- The file approach (like jwt-secret.txt) is preferred over forcing it into settings.yaml — keeps secrets out of the config file that operators might version-control.

**Startup position:** `initHashCohortId` is already called at line 123 of `server/index.ts`, immediately after `initAuth` and before `initAuditDb`. No reordering needed; only the function signature changes.

**`server/index.ts` call site change:**

```typescript
// BEFORE (line 123):
initHashCohortId(settings);

// AFTER:
initHashCohortId(DATA_DIR, settings);
```

---

## 3. TOTP (RFC 6238) — User Schema + Endpoint Changes

**User schema change (prerequisite for all TOTP work).**

`data/users.json` entries (defined by `UserRecord` interface in `server/initAuth.ts` lines 21–29) currently have no TOTP fields. Add two optional fields:

```typescript
// In UserRecord interface (server/initAuth.ts):
totpSecret?: string;   // base32-encoded TOTP seed; absent = TOTP not enrolled
totpEnabled?: boolean; // explicit enable flag; false = enrolled but disabled
```

`totpSecret` lives per-user in `data/users.json`, encrypted at rest only if the threat model requires it (current design stores `passwordHash` in plaintext bcrypt, so unencrypted base32 is consistent). The TOTP library (e.g. `otplib`) generates and validates against this secret.

**Existing 2FA flow (to understand what changes):**

- `POST /api/auth/login` → if `twoFactorEnabled` (global setting), returns `{ challengeToken }` (lines 147–150 of `authApi.ts`)
- `POST /api/auth/verify` → verifies challenge token + compares `otp` against `otpCode` from `settings.yaml` (line 204) — a single global static code

**New endpoints:**

| Endpoint | Method | Auth required | Purpose |
|----------|--------|---------------|---------|
| `/api/auth/totp/setup` | POST | Session JWT (any role) | Generate new TOTP secret for calling user, return QR URI |
| `/api/auth/totp/confirm` | POST | Session JWT | Verify one TOTP code to activate enrollment; sets `totpEnabled: true` |
| `/api/auth/totp/disable` | POST | Session JWT or admin | Disable TOTP for calling user (or target user if admin) |

**Modified endpoints:**

| Endpoint | Change |
|----------|--------|
| `POST /api/auth/verify` | Replace global `otpCode` check with per-user TOTP validation using `otplib.authenticator.check(otp, user.totpSecret)`. Fall back to global `otpCode` if user has no `totpSecret` (backward compat during rollout). |
| `GET /api/auth/config` | Add `{ totpAvailable: true }` to response so frontend knows TOTP is available |

**`_migrateUsersJson` in `initAuth.ts`** must be extended to handle users.json entries missing the new fields — they default to `{ totpEnabled: false }` (no migration write needed since `undefined === not enrolled`).

**New dependency:** `otplib` (pure-JS, no native deps). Install as a production dependency.

---

## 4. Keycloak OIDC Redirect Flow

**Current state:** `keycloakAuth.ts` provides only JWKS token validation. `authApi.ts` line 94 blocks `POST /login` with a 405 when provider is `keycloak`. There is no redirect, no authorization code exchange, no PKCE.

**New Express endpoints needed:**

| Endpoint | Purpose |
|----------|---------|
| `GET /api/auth/keycloak/login` | Build authorization URL with PKCE (`code_challenge`, `code_challenge_method=S256`), store `state` + `code_verifier` in server-side session or signed cookie, redirect browser to Keycloak |
| `GET /api/auth/keycloak/callback` | Receive `code` + `state`, validate state, exchange code for tokens via Keycloak's token endpoint (`/protocol/openid-connect/token`), issue local session JWT from the id_token claims |
| `POST /api/auth/keycloak/logout` | Revoke tokens at Keycloak's logout endpoint, clear local session |

**PKCE state storage:** Since the app has no server-side session store (stateless JWT design), store the `state` + `code_verifier` pair in a short-lived signed cookie (use `crypto.createHmac` with `getJwtSecret()` as the signing key, 5-minute TTL). Alternatively use a small in-memory Map keyed by `state` with TTL cleanup — simpler given single-process deployment.

**Token exchange → local JWT:** After successful code exchange, extract claims from Keycloak's `id_token`, normalize them (role array→string, centers string→array — same logic as `verifyKeycloakToken` lines 112–116), then call `signSessionToken` from `authApi.ts` to issue an EMD-native JWT. The frontend never stores the Keycloak token directly.

**New `keycloakAuth.ts` additions needed:**

- `initKeycloakAuth` needs to also store `clientId`, `clientSecret`, and `redirectUri` from settings (currently stores only the JWKS client).
- New exported function `buildAuthorizationUrl(state, codeChallenge)` → URL string.
- New exported function `exchangeCode(code, codeVerifier)` → `{ idToken, accessToken }`.

**React frontend — new route needed:** `GET /auth/keycloak/callback` must be a real browser-navigable path (the redirect_uri in PKCE). Two options:

1. Serve the callback at the Express level (`/api/auth/keycloak/callback`) — Keycloak redirects to the server, server completes the exchange, then server redirects to the SPA with `?token=...` in the URL fragment. This keeps all PKCE logic server-side and is the safer approach.
2. Add a React route `/keycloak-callback` that reads `?code=&state=` from URL and calls an API endpoint to complete the exchange.

**Recommended:** Option 1 (server-side callback). The redirect_uri is `https://host/api/auth/keycloak/callback`. After successful exchange, server responds with a redirect to `/#token=<jwt>` or sets an HttpOnly cookie. This avoids shipping any PKCE secrets to the browser. The React `LoginPage.tsx` gets a "Login with Keycloak" button that calls `GET /api/auth/keycloak/login` (which immediately redirects the browser).

**PUBLIC_PATHS addition in `authMiddleware.ts`:**

```typescript
const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/verify',
  '/api/auth/config',
  '/api/auth/keycloak/login',    // ADD
  '/api/auth/keycloak/callback', // ADD
];
```

---

## 5. Cross-Cohort Comparison (XCOHORT-01)

**Current cohort state in `OutcomesView.tsx`:**

Single cohort resolved at lines 115–129. The `cohort` variable is `{ name, cases }`. The entire `aggregate` computation (lines 264–278) and all three `OutcomesPanel` instances receive data from this single cohort.

**What changes in `OutcomesView.tsx`:**

Add a second cohort state alongside the existing primary cohort:

```typescript
// New state — second cohort for comparison (null = not active)
const [compareCohortId, setCompareCohortId] = useState<string | null>(
  searchParams.get('compare') ?? null
);

const cohort2 = useMemo(() => {
  if (!compareCohortId) return null;
  const saved = savedSearches.find((s) => s.id === compareCohortId);
  return saved ? { name: saved.name, cases: applyFilters(activeCases, saved.filters) } : null;
}, [activeCases, savedSearches, compareCohortId]);
```

The `?compare=<cohortId>` URL param mirrors `?cohort=<cohortId>`. The cohort selector UI (existing `OutcomesSettingsDrawer` or a new inline selector) allows picking the second cohort from `savedSearches`.

**Second aggregate computation:**

```typescript
const aggregate2 = useMemo(() => {
  if (!cohort2 || cohort2.cases.length === 0) return null;
  return computeCohortTrajectory({ cases: cohort2.cases, axisMode, yMetric, gridPoints, spreadMode });
}, [cohort2, axisMode, yMetric, gridPoints, spreadMode]);
```

Server-side routing for the second cohort follows the same `routeServerSide` pattern with a separate `compareCohortId` POST to `/api/outcomes/aggregate`.

**`OutcomesPanel.tsx` — two options:**

Option A (preferred, minimal disruption): Add an optional `overlay?: PanelResult` prop to `OutcomesPanel`. When present, render the overlay cohort's median line in a second color (e.g. `EYE_COLORS` already has distinct OD/OS colors; introduce `COMPARE_COLORS` in `palette.ts`). The existing Recharts `ComposedChart` can hold two `Line` series on the same axes — add the second cohort's `medianGrid` as a second `Line` with a dashed stroke.

Option B: Render two `OutcomesPanel` instances side-by-side — simpler but loses the visual comparison benefit.

**Recommended:** Option A. The `OutcomesPanel` props change is additive (optional prop, default undefined = current behavior). No existing tests break.

**`OutcomesPanel.tsx` prop interface addition:**

```typescript
interface Props {
  // ...existing props unchanged...
  overlay?: PanelResult;          // ADD — second cohort data
  overlayColor?: string;          // ADD — color for overlay series
  overlayLabel?: string;          // ADD — legend label for overlay
}
```

**`OutcomesDataPreview.tsx`:** Add a `cases2` optional prop if per-patient data from the second cohort should appear in the table. Simpler to scope this as out-of-MVP for XCOHORT-01 and add it in a follow-on task.

---

## 6. Dark Mode

**Current state:** No dark-mode infrastructure exists. Tailwind is already a dependency. The `tailwind.config.js` (or equivalent) does not currently set `darkMode`.

**Tailwind `darkMode: 'class'` approach:**

Add `darkMode: 'class'` to `tailwind.config.js`. Tailwind then applies `dark:` variant classes only when a `.dark` class is present on the `<html>` element.

**Toggle state location:** localStorage is appropriate for a UI preference (not clinical data). Store under key `emd-theme` with values `'light'` | `'dark'`. A React context reads from localStorage on mount and applies/removes the `dark` class on `document.documentElement`.

**New `src/context/ThemeContext.tsx`:**

```typescript
// Singleton context — wraps App
// On mount: read localStorage, apply class
// Toggle: flip class, persist to localStorage
export const ThemeContext = createContext<{ dark: boolean; toggle: () => void }>(...);
```

**Where the toggle lives:** A theme toggle button in the top navigation bar (same level as the language toggle). The button sets the `dark` class on `<html>` directly via `document.documentElement.classList.toggle('dark')` and persists the choice.

**Palette impact (`src/components/outcomes/palette.ts`):** The existing `EYE_COLORS` and `SERIES_STYLES` constants are WCAG-verified for light mode. Dark mode needs alternate values. Two approaches:

1. Add `DARK_EYE_COLORS` and `DARK_SERIES_STYLES` constants in `palette.ts`, consumed conditionally by `OutcomesView` / `OutcomesPanel` based on `ThemeContext.dark`.
2. Use CSS custom properties in `palette.ts` and let Tailwind's `dark:` class cascade change the CSS variable values.

Approach 1 is simpler given Recharts renders SVG (where Tailwind class utilities don't apply directly). The `OutcomesPanel` reads `dark` from `ThemeContext` and selects the palette variant.

**VQA-02 requirement:** The dark-mode palette must pass WCAG AA contrast (4.5:1 for text, 3:1 for graphical elements). New palette values need verification against dark backgrounds (`#111827` or similar).

---

## 7. O(N+M) `patientCases.ts` Refactor

**Current algorithm in `shared/patientCases.ts` — `extractPatientCases` (lines 46–73):**

The function calls `resourcesOfType` seven times (lines 47–53), producing flat arrays of each resource type. Then for each patient (line 55), it calls `.filter()` on each of the five resource arrays to find resources whose `subject.reference` matches the patient. This is O(N×M) where N = patients, M = total resources.

**Specific bottleneck:** Five `.filter()` calls inside `patients.map()`:

```typescript
// Lines 68–72 — each filter scans the entire array:
conditions: conditions.filter((c) => c.subject.reference === ref),
observations: observations.filter((o) => o.subject.reference === ref),
procedures: procedures.filter((p) => p.subject.reference === ref),
imagingStudies: imaging.filter((i) => i.subject.reference === ref),
medications: medications.filter((m) => m.subject.reference === ref),
```

With 7 centers × ~45 patients × typical resource counts per patient, this is manageable today, but will degrade quadratically as the dataset grows.

**O(N+M) Map pre-grouping pattern:**

```typescript
// Build lookup maps ONCE before iterating patients — O(M) total
function groupBySubject<T extends { subject: { reference: string } }>(
  resources: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of resources) {
    const key = r.subject.reference;
    const bucket = map.get(key);
    if (bucket) bucket.push(r);
    else map.set(key, [r]);
  }
  return map;
}

// In extractPatientCases:
const conditionsBySubject = groupBySubject(conditions);
const observationsBySubject = groupBySubject(observations);
const proceduresBySubject = groupBySubject(procedures);
const imagingBySubject = groupBySubject(imaging);
const medicationsBySubject = groupBySubject(medications);

return patients.map((pat) => {
  const ref = `Patient/${pat.id}`;
  return {
    // ...
    conditions: conditionsBySubject.get(ref) ?? [],
    observations: observationsBySubject.get(ref) ?? [],
    procedures: proceduresBySubject.get(ref) ?? [],
    imagingStudies: imagingBySubject.get(ref) ?? [],
    medications: medicationsBySubject.get(ref) ?? [],
  };
});
```

**What exactly changes:**

- **File:** `shared/patientCases.ts`
- **Function:** `extractPatientCases` only — `applyFilters` and `getAge` are unchanged
- **New helper:** `groupBySubject<T>` (private, not exported) — replaces the five `.filter()` calls
- **Output contract:** identical — same `PatientCase[]` shape, same per-patient data, just computed in O(N+M) instead of O(N×M)
- **Test impact:** all existing tests pass unchanged since the output is identical; add a performance regression test with a large synthetic bundle

The `Organization` lookup (line 57 `orgs.find(...)`) is also O(patients × orgs) but orgs are typically 7, so it's negligible. Leave it as-is or apply the same Map pattern for consistency.

---

## Suggested Build Order

Dependencies flow as follows:

```
1. UserRecord schema change (totpSecret/totpEnabled fields)
   ↓ required by
2. TOTP endpoint implementation (setup, confirm, disable)
   ↓ required by
3. POST /verify modification (per-user TOTP check)

4. JWT algorithms pin (authMiddleware.ts + authApi.ts)
   — no dependencies, can be Phase 1

5. cohortHashSecret auto-generation (hashCohortId.ts + index.ts)
   — no dependencies, can be Phase 1

6. O(N+M) patientCases.ts refactor
   — no dependencies, pure refactor, can be Phase 1

7. Dark mode infrastructure (ThemeContext, tailwind.config darkMode)
   ↓ required by
8. Dark mode palette variants (palette.ts DARK_* constants, OutcomesPanel wiring)

9. Cross-cohort comparison state (OutcomesView.tsx second cohort)
   ↓ required by
10. OutcomesPanel overlay prop (rendering second cohort on chart)

11. Keycloak OIDC: keycloakAuth.ts additions (buildAuthorizationUrl, exchangeCode)
    ↓ required by
12. Keycloak OIDC: new Express endpoints (/keycloak/login, /keycloak/callback)
    ↓ required by
13. React LoginPage: "Login with Keycloak" button
```

**Recommended phase grouping:**

| Phase | Work | Rationale |
|-------|------|-----------|
| Phase 1 (Security quick wins) | JWT pin (#4), cohortHashSecret auto-gen (#5), O(N+M) refactor (#6) | All independent, high confidence, fast |
| Phase 2 (TOTP) | UserRecord schema (#1) → TOTP endpoints (#2) → /verify modification (#3) | Strict dependency order within phase |
| Phase 3 (Dark mode) | ThemeContext (#7) → palette variants + OutcomesPanel (#8) | Two-step, frontend only |
| Phase 4 (Cross-cohort) | Second cohort state (#9) → OutcomesPanel overlay (#10) | Two-step, frontend only |
| Phase 5 (Keycloak OIDC) | keycloakAuth extensions (#11) → Express endpoints (#12) → LoginPage button (#13) | Last — needs real Keycloak for E2E testing |

---

## Component Boundaries Summary

| Component | Status | Change Type |
|-----------|--------|-------------|
| `server/authMiddleware.ts` — `verifyLocalToken` | Modified | Add `algorithms: ['HS256']` to `jwt.verify` |
| `server/authApi.ts` — `POST /verify` | Modified | Add `algorithms: ['HS256']` to challenge token verify; add per-user TOTP check |
| `server/authApi.ts` — new TOTP endpoints | New | `POST /totp/setup`, `POST /totp/confirm`, `POST /totp/disable` |
| `server/hashCohortId.ts` — `initHashCohortId` | Modified | Accept `dataDir`, add auto-generation from file |
| `server/index.ts` — `initHashCohortId` call | Modified | Pass `DATA_DIR` as first argument |
| `server/initAuth.ts` — `UserRecord` | Modified | Add `totpSecret?: string`, `totpEnabled?: boolean` |
| `server/keycloakAuth.ts` | Modified | Add `clientId`, `redirectUri` storage; add `buildAuthorizationUrl`, `exchangeCode` exports |
| `server/keycloakCallbackRouter.ts` | New | `GET /keycloak/login`, `GET /keycloak/callback`, `POST /keycloak/logout` |
| `shared/patientCases.ts` — `extractPatientCases` | Modified | Add `groupBySubject` helper, replace 5 `.filter()` calls with Map lookups |
| `src/context/ThemeContext.tsx` | New | Dark/light toggle, localStorage persistence, `<html>` class management |
| `src/components/outcomes/palette.ts` | Modified | Add `DARK_EYE_COLORS`, `DARK_SERIES_STYLES` constants |
| `src/components/outcomes/OutcomesPanel.tsx` | Modified | Accept `overlay?`, `overlayColor?`, `overlayLabel?` props; render second cohort median line |
| `src/components/outcomes/OutcomesView.tsx` | Modified | Add `cohort2`, `aggregate2` state; `?compare=` URL param; pass overlay to panels |
| `src/pages/LoginPage.tsx` | Modified | Add "Login with Keycloak" button visible when `provider === 'keycloak'` |
| `tailwind.config.js` | Modified | Add `darkMode: 'class'` |

---

## Open Questions / Flags for Phase Research

- **TOTP library choice:** `otplib` is pure-JS and zero-native-deps (consistent with project constraint). Verify current version and RFC 6238 compliance before committing.
- **Keycloak OIDC — needs real instance for E2E:** The entire OIDC flow cannot be integration-tested without a live Keycloak realm. Mark Phase 5 as "implementation only, E2E deferred."
- **cohortHashSecret file vs settings.yaml:** The auto-generation approach (file in data/) is the recommendation, but if the team wants it in settings.yaml, the migration path is: generate on first run, write to settings.yaml under `audit.cohortHashSecret`, and warn that the file is not secret-safe if version-controlled.
- **Dark mode palette WCAG verification:** WCAG AA compliance for the new `DARK_*` palette constants must be verified before shipping Phase 3. Flag this as a required manual QA step.
- **Cross-cohort server routing:** The second cohort (`?compare=`) server-side routing follows the same `>1000-patient threshold` logic. Confirm whether two simultaneous server aggregate POSTs are acceptable or whether a combined endpoint is needed.
