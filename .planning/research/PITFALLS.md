# Domain Pitfalls — EMD v1.7

**Domain:** Clinical dashboard security hardening + chart feature additions on existing Express 5 + React/TypeScript system
**Researched:** 2026-04-17
**Overall confidence:** HIGH (system code read; pitfalls verified against actual implementation)

---

## Critical Pitfalls

### Pitfall 1: TOTP Secret Stored Like the Current Static OTP

**What goes wrong:** The current `otpCode` in `config/settings.yaml` is a site-wide static string (`'123456'`). When migrating to TOTP (RFC 6238), the TOTP shared secret must be **per-user**, not site-wide. If the secret is added to `settings.yaml` (following the existing `otpCode` pattern) or to `data/users.json` in plaintext, it is stored unencrypted.

**Why it happens in THIS system:** `initAuth.ts` already stores `otpCode` as a plaintext string in `_authConfig`. The path of least resistance when adding TOTP is to follow that pattern. The `UserRecord` interface (in `initAuth.ts`) does not have a `totpSecret` field yet — whoever adds it will be tempted to add it alongside `passwordHash`.

**Consequences:**
- If `data/users.json` is exfiltrated (e.g., via a path-traversal bug), all users' TOTP secrets are compromised simultaneously.
- The bcrypt-hashed `passwordHash` in `UserRecord` gives the file a false sense of security — TOTP secrets are not hashed (they must be recoverable to verify).
- `settings.yaml` is in `config/` (not `public/`), so it is less exposed, but it is still a plaintext config file committed to or deployed alongside the app.

**Prevention:**
- Store per-user TOTP secrets in `data/users.json` as `totpSecret` (Base32 strings, per RFC 6238).
- The file already has `0o600` protection for writes (`_atomicWrite` does not set mode, but the directory should be locked down at deployment time).
- Consider encrypting secrets at rest with the JWT secret as KEK — adds minimal code, meaningful protection.
- Never store the shared TOTP secret in `settings.yaml` alongside other config; that file's admin-only GET is not sufficient protection.

**Detection:** Check `UserRecord` type for unencrypted `totpSecret` strings visible in `data/users.json` after a user enables TOTP.

---

### Pitfall 2: TOTP Clock Skew Causing Silent Login Failures

**What goes wrong:** RFC 6238 TOTP codes rotate every 30 seconds. If the server clock drifts more than ±30 seconds from the authenticator app's clock, the TOTP code the user enters will never match the one the server computes, producing silent `Invalid OTP` errors indistinguishable (to the user) from a wrong code.

**Why it happens in THIS system:** The EMD runs on-premises at 7 hospital sites, each managing their own server. NTP configuration varies. The existing `POST /verify` handler (`authApi.ts:204`) does a simple `otp !== otpCode` string comparison — there is no concept of "window" tolerance at all. TOTP requires checking T-1, T, and T+1 windows (±30 s tolerance).

**Consequences:**
- Users with correct TOTP codes locked out repeatedly, exhausting the rate limiter (`maxLoginAttempts: 5`) and triggering account lockout.
- No visible difference between "wrong code" and "clock skew" from the user's perspective.
- High support burden on clinical staff at sites with poor NTP discipline.

**Prevention:**
- Use `otplib` (the standard Node.js TOTP library) with `totp.options = { window: 1 }` to accept T-1, T, T+1.
- Log clock-skew mismatches (when T-1 or T+1 matches but T does not) to the audit log so ops staff can detect drift.
- Document NTP requirement in deployment guide.

**Phase flag:** Address in the same phase as TOTP secret storage — cannot ship TOTP without window tolerance.

---

### Pitfall 3: TOTP Backup/Recovery Left Undefined — Admin Lockout

**What goes wrong:** If a user loses access to their authenticator app (phone stolen/broken) with no recovery mechanism, the only escape is an admin manually clearing their TOTP enrollment. If the **admin** loses their authenticator, the system becomes fully locked unless there is an out-of-band recovery path.

**Why it happens in THIS system:** The current 2FA path (`authApi.ts POST /verify`) has no bypass mechanism. There are recovery codes in many TOTP implementations, but this system currently has no such field in `UserRecord`. Adding TOTP without adding recovery means the first lost phone creates a production incident.

**Consequences:**
- Admin locked out → no one can manage users → requires direct file-system intervention on the server.
- Users locked out during a clinical session → data access interrupted.

**Prevention:**
- Add admin-only endpoint `DELETE /api/auth/users/:username/totp` to unenroll TOTP (resetting to password-only or static OTP fallback).
- Generate a set of one-time recovery codes at enrollment time; store as bcrypt hashes in `UserRecord` (same pattern as passwords).
- Explicitly document the emergency file-system recovery path in deployment docs.

---

### Pitfall 4: TOTP Transition Breaks Existing 2FA Users (Backward Compat Gap)

**What goes wrong:** The current system has `twoFactorEnabled: true/false` as a **site-wide** flag. Some deployments may have static OTP enabled. Replacing `otpCode` with TOTP without a transition path means anyone with the old static OTP configured gets locked out immediately on deploy.

**Why it happens in THIS system:** `getAuthConfig()` returns a single `otpCode` string. The `POST /verify` handler checks `otp !== otpCode`. If this comparison is replaced with a TOTP verify call, users who haven't enrolled get errors immediately. There is no per-user `totpEnrolled: boolean` flag in `UserRecord`.

**Consequences:**
- Breaking upgrade: all users with 2FA enabled must enroll in TOTP simultaneously, or they're locked out.
- On-premises deployment at 7 sites means coordinated migrations are operationally difficult.

**Prevention:**
- Add `totpSecret?: string` and `totpEnrolled?: boolean` to `UserRecord`.
- During transition: if `totpEnrolled` is false but 2FA is enabled, fall back to static OTP comparison.
- After transition period, remove static OTP fallback.
- The settings.yaml `otpCode` field becomes deprecated (strip from `AuthConfig` eventually) rather than immediately removed.

---

### Pitfall 5: OIDC State Parameter Forgery (CSRF) in Keycloak Redirect Flow

**What goes wrong:** The OIDC `state` parameter is the primary CSRF protection for the redirect flow. If the server generates the state, sends the user to Keycloak, but does not verify the returned `state` on callback, an attacker can craft a malicious authorization code and replay it against the callback endpoint.

**Why it happens in THIS system:** The existing `keycloakAuth.ts` and `authApi.ts` implement only JWKS-based token validation (for API requests where Keycloak has already issued a token). There is no redirect-initiation or callback endpoint yet. When those are added, the state generation/verification loop is easy to omit because it requires server-side session state — which this system deliberately avoids (JWT only, no sessions).

**Consequences:**
- CSRF login attack: attacker forces a victim to be logged in as attacker's Keycloak account.
- Particularly dangerous in a clinical system where identity determines which patient data is visible.

**Prevention:**
- Generate a cryptographically random state with `crypto.randomBytes(32).toString('hex')`.
- Store it in a short-lived (5 min) signed cookie (`httpOnly`, `sameSite=lax`, `secure`).
- On callback, verify `req.query.state === cookie.state` before exchanging the code.
- This is the one place a cookie is required — the rest of the system uses JWT-only, but redirect CSRF protection requires a stateful anchor.

---

### Pitfall 6: PKCE `code_verifier` Stored in Plaintext Client-Side

**What goes wrong:** PKCE (Proof Key for Code Exchange) requires generating a `code_verifier` (random), hashing it to `code_challenge`, sending the challenge to the authorization endpoint, then sending the verifier to the token endpoint. If the verifier is stored in `localStorage` (the natural React choice), it leaks to XSS.

**Why it happens in THIS system:** The project already migrated away from `localStorage` for auth (`AuthContext` is wired to server JWTs). But the PKCE flow is browser-initiated — the redirect to Keycloak starts in the browser. The `code_verifier` must survive the redirect round-trip. The temptation is to put it in `localStorage` because that's where React apps naturally put redirect state.

**Consequences:**
- If an XSS vector exists anywhere in the React app, the code_verifier can be exfiltrated and used to exchange a stolen authorization code for tokens.

**Prevention:**
- Store the `code_verifier` in a `sessionStorage` entry with a random key, NOT `localStorage`. Session storage is tab-scoped and cleared on tab close.
- Better: route the entire OIDC redirect through the Express backend. Browser hits `/api/auth/oidc/login` → server generates state+verifier → stores in signed cookie → redirects to Keycloak. Callback hits `/api/auth/oidc/callback` → server exchanges code (using verifier from cookie) → issues local JWT. Verifier never touches client JS.

**Phase flag:** The backend-mediated approach eliminates all client-side PKCE storage problems but adds complexity. Decide the approach at phase start, not mid-implementation.

---

### Pitfall 7: Session Fixation After OIDC Redirect

**What goes wrong:** After a successful Keycloak callback, the server issues a local JWT and sets it in the response. If the client had a stale (pre-login) JWT in memory and the app does not explicitly clear it and re-fetch the new one, old auth state persists.

**Why it happens in THIS system:** `AuthContext` holds the JWT in React state. On Keycloak callback, the page navigates to `/?token=...` or similar. If the AuthContext does not explicitly initialize from the URL token parameter and clear any prior state, the race between old state and new is unpredictable.

**Consequences:**
- User appears logged in with old (possibly expired or wrong-role) credentials.
- In a clinical context, wrong role = wrong data visibility silently.

**Prevention:**
- On OIDC callback, the Express handler issues the JWT as an `httpOnly` cookie (not a URL parameter — tokens in URLs leak to server logs and referrer headers).
- AuthContext initializes by calling `GET /api/auth/me` (not by reading a URL param).
- On successful callback, AuthContext must explicitly `logout()` then `login()` in sequence to flush any stale state.

---

### Pitfall 8: Mixing Local JWT and Keycloak JWT in `authMiddleware.ts`

**What goes wrong:** Local JWTs are signed with HS256 + the local secret. Keycloak JWTs are signed with RS256 + the realm's private key (verified via JWKS). The existing `authMiddleware.ts` presumably checks signature with `jwt.verify(token, getJwtSecret())`. If the middleware does not branch on the token's `alg` header before verifying, a Keycloak-issued RS256 token will fail local verification and vice versa.

**Why it happens in THIS system:** The `getAuthProvider()` function returns the configured provider, but if the middleware uses it to decide which verification path to take without also validating the `alg` claim in the token itself, an attacker can submit a locally-signed HS256 token while Keycloak mode is active (or vice versa) and potentially bypass verification if `jwt.verify` is called with the wrong key type.

**Consequences:**
- Algorithm confusion attack: depends on the jsonwebtoken library's behavior with mismatched algorithm + key types. Modern versions of `jsonwebtoken` reject this, but the risk is highest during the transition period when both local and Keycloak tokens may coexist.

**Prevention:**
- Always pass `{ algorithms: ['HS256'] }` to `jwt.verify()` when in local mode.
- Always pass `{ algorithms: ['RS256'] }` when in Keycloak mode.
- This is already a v1.7 requirement ("JWT algorithms pin") — implement it before adding the OIDC redirect flow, not after.
- Never allow `algorithms: ['none']` — jsonwebtoken blocks this by default but the option must never appear.

**Phase flag:** JWT algorithms pin must land in Phase 1 of v1.7, before OIDC redirect work begins.

---

### Pitfall 9: Cross-Cohort Memory Spike from Double Bundle Load

**What goes wrong:** Each cohort requires loading and parsing one or more FHIR bundles. With 7 centers at ~45 patients each (~315 total), loading two cohorts simultaneously doubles the in-memory bundle representation. With the server-aggregation path (>1000 patients), the server holds the raw bundles in memory for the duration of `POST /api/outcomes/aggregate`. Two simultaneous aggregate requests double this.

**Why it happens in THIS system:** `shared/patientCases.ts#extractPatientCases` takes an array of `BundleLike` objects. The server aggregation handler loads bundles, calls `extractPatientCases`, computes trajectories, and returns. For cross-cohort comparison, if the server runs both aggregations in parallel (e.g., `Promise.all`), both bundle sets are in memory simultaneously.

**Consequences:**
- On low-memory on-premises hospital servers (common deployment target), this can cause OOM or significant GC pressure during clinical demos.
- Node.js V8 heap is single-threaded; a GC pause during data load causes request timeouts.

**Prevention:**
- Run cohort aggregations sequentially on the server, not in parallel — the latency difference is imperceptible for typical cohort sizes.
- Free the first cohort's raw bundle data immediately after `extractPatientCases` returns (do not hold references).
- Add a memory guard: if both cohorts together exceed a configurable size threshold (e.g., 10 MB of raw JSON), log a warning.

---

### Pitfall 10: Recharts Legend Key Collisions in Cross-Cohort Chart

**What goes wrong:** Recharts assigns legend entries by the `name` prop on `<Line>`, `<Area>`, and `<Scatter>`. In the current single-cohort chart, series names are things like "Median OD", "Patient OD". When two cohorts are overlaid, both have "Median OD" series — Recharts renders duplicate legend entries with identical labels and cannot distinguish them.

**Why it happens in THIS system:** `OutcomesPanel.tsx` uses hardcoded `name={t('outcomesLegendMedian')}` strings (translated). For cross-cohort comparison, two panels' data will be merged into a single `<ComposedChart>`, and both cohorts' series will collide on `name`.

**Consequences:**
- Legend shows duplicate rows with identical labels.
- Recharts `legendType` and tooltip identification rely on the `name` key — duplicate names cause the wrong series to highlight on hover.

**Prevention:**
- Prefix all series names with a cohort identifier: `name={`${cohortLabel}: ${t('outcomesLegendMedian')}`}`.
- Each cohort needs its own label (e.g., Cohort A / Cohort B, or a user-supplied name).
- The cohort label must be sanitized before display (it originates from cohort filter state, which is user-defined).

---

## Moderate Pitfalls

### Pitfall 11: WCAG Contrast Failures in Dark Mode for Existing Palette Colors

**What goes wrong:** `palette.ts` documents contrast ratios only against `#ffffff` (white background): OD blue 6.70:1, OS red 6.47:1, OD+OS violet 7.10:1. Against a dark background (e.g., `#1e1e1e` or Tailwind's `gray-900: #111827`), **all ratios invert** — light colors that fail against white (e.g., light blue) become safe, but dark colors like `#1d4ed8` (blue-700) become unsafe because the contrast with a dark background shrinks.

**Specific calculation:** `#1d4ed8` (blue-700) against `#111827` (gray-900): relative luminance of blue-700 ≈ 0.103, gray-900 ≈ 0.007. Contrast ≈ (0.103+0.05)/(0.007+0.05) ≈ 2.7:1 — below the 3.0:1 WCAG graphical threshold.

**Prevention:**
- Do not reuse `EYE_COLORS` unchanged for dark mode. Derive a `DARK_EYE_COLORS` map with lighter variants (e.g., blue-400 `#60a5fa` at ≈ 4.5:1 against gray-900).
- Add the dark-mode color set to `palette.ts` alongside the existing light-mode set.
- The `computeContrastRatio` function already exists in `palette.ts` — write a test that verifies dark-mode colors against `#111827`.

**Phase flag:** Cannot defer color selection to the phase after dark mode infrastructure is added — the colors must be selected and tested in the same phase.

---

### Pitfall 12: Recharts SVG Elements Ignore Tailwind `dark:` Classes

**What goes wrong:** Tailwind's `dark:` variant relies on the `class="dark"` toggle on `<html>` (or a CSS variable approach). SVG elements rendered by Recharts internals (axis labels, tick text, grid lines, legend text) are generated by Recharts as inline SVG — Tailwind cannot style them with utility classes because Recharts does not accept `className` on tick elements, grid lines, etc.

**Why it happens in THIS system:** The existing `OutcomesPanel.tsx` passes `tick={{ fontSize: 11 }}` as a prop to `<XAxis>` and `<YAxis>`. These become SVG `<text>` elements. Recharts only accepts `style` objects or explicit stroke/fill props, not Tailwind class strings.

**Consequences:**
- In dark mode, axis labels remain black text on dark background — invisible.
- Grid lines (currently `strokeDasharray="3 3"`, no explicit color) default to browser SVG default (black) which becomes invisible against dark backgrounds.

**Prevention:**
- Pass explicit `stroke` / `fill` props derived from a theme variable, not Tailwind classes.
- Implement a `useTheme()` hook that returns the current color scheme; use it to derive a `chartColors` object (`axisTextColor`, `gridColor`, `tooltipBg`) that gets passed down to chart components as props.
- The Tooltip component (`OutcomesTooltip.tsx`) uses Tailwind classes for its container div — those WILL respond to `dark:` correctly.

---

### Pitfall 13: Flash of Wrong Theme (FOUC) Before React Mounts

**What goes wrong:** If dark mode is implemented by toggling a `dark` class on `<html>` via React state (the most common approach), the initial render is always light mode until React mounts and reads the user's preference from `localStorage` or `matchMedia`. On slow connections or during hydration, users see a flash of the wrong theme.

**Why it happens in THIS system:** The app is a Vite-built SPA. The initial HTML served by Express has no knowledge of dark mode preference. React code runs after the HTML + bundle load.

**Prevention:**
- Add a small inline `<script>` in `index.html` (before the React bundle) that synchronously reads `localStorage.getItem('theme')` and sets `document.documentElement.classList`. This script runs before any rendering.
- This is the standard pattern (used by Tailwind docs, Radix UI, etc.) and the only reliable FOUC prevention.
- Do NOT use CSS `prefers-color-scheme` alone — it prevents FOUC for first-time users but causes flash for users who have chosen a theme that differs from their OS setting.

---

### Pitfall 14: O(N+M) Refactor Breaks Referential Equality Checks

**What goes wrong:** The v1.7 target includes an O(N+M) refactor of patient case extraction using `Map.get()`. If any downstream code (React memoization, Zustand selectors, or test assertions) depended on the old object's referential identity — e.g., `const patient = cases.find(...)` where the returned object is the same reference as the original — `Map.get()` may return a different object reference even when the logical content is identical.

**Why it happens in THIS system:** `shared/patientCases.ts` returns `PatientCase[]` from `extractPatientCases`. If the refactor changes internal data flow (e.g., constructing new objects inside the Map rather than referencing originals), downstream `React.memo` comparisons using `===` will see "changed" objects and trigger unnecessary re-renders.

**Consequences:**
- Subtle render performance regression (not a correctness bug, but causes the profiler to show unnecessary renders).
- Tests that spy on specific object references will break even if the data is logically correct.

**Prevention:**
- After refactoring, run a reference-equality audit: check if any component `prop === prev_prop` comparisons are used where `PatientCase` objects are passed.
- The existing 430-test suite covers the computation contracts; check that no test uses `toBe` (reference equality) where `toEqual` (structural equality) is the correct assertion.
- Add a byte-parity test similar to the AGG-01..05 series: verify that refactored O(N+M) output matches original O(N²) output on a fixed fixture.

---

### Pitfall 15: Test Mocks for Old Pattern Leave Coverage Gaps After Refactor

**What goes wrong:** Several test files (e.g., `dataApiCenter.test.ts`) mock `initAuth` completely (`vi.mock('../server/initAuth.js', ...)`). If the O(N+M) refactor moves logic from `server/outcomesAggregateApi.ts` into `shared/patientCases.ts`, tests that previously mocked the server handler's internal calls will no longer intercept the shared module's code path.

**Why it happens in THIS system:** The existing test pattern uses `vi.mock` at the module boundary. The refactor changes which module owns the logic. Tests that mocked the old location will silently pass without exercising the new code.

**Prevention:**
- For each moved function, verify there is a test that imports from the new location (`shared/patientCases.ts`) directly.
- Run coverage report after refactor; flag any branches in `shared/patientCases.ts` with <80% coverage.
- The `describe.skip` for `metricSelector` integration tests is already flagged — do not let the refactor add more silent gaps.

---

### Pitfall 16: Color Palette Exhaustion for Cross-Cohort + Multi-Eye Combination

**What goes wrong:** The current palette has 3 colors (OD blue, OS red, OD+OS violet). Cross-cohort comparison adds a second cohort's OD, OS, and OD+OS — that's 6 distinct series on one chart. If the second cohort reuses the same 3 colors (even as lighter variants), WCAG distinguishability between cohorts becomes very difficult, especially for users with color vision deficiency.

**Why it happens in THIS system:** `palette.ts` exports only `EYE_COLORS` (3 entries). The cross-cohort feature will need to extend this, but the extension must still pass WCAG 1.4.11 (3.0:1 contrast against background AND mutual distinguishability).

**Consequences:**
- WCAG failure on graphical elements.
- Cohort A OD and Cohort B OD look visually identical on printed reports.

**Prevention:**
- Assign cohort-level color families: Cohort A gets blue/red/violet (existing); Cohort B gets teal/orange/indigo.
- Verify each new color: teal `#0f766e` (Tailwind teal-700) ≈ 4.9:1 against white; orange `#c2410c` (orange-700) ≈ 5.5:1. Both pass.
- Add a `COHORT_PALETTES` constant to `palette.ts` (array of 3-color sets, indexed by cohort index).

---

## Minor Pitfalls

### Pitfall 17: `cohortHashSecret` Auto-Generation Missing After TOTP Secret Addition

**What goes wrong:** v1.7 adds `cohortHashSecret` auto-generation as a "security quick win". If the TOTP changes also modify `initAuth.ts` startup logic, merge conflicts or sequencing errors may accidentally skip the `cohortHashSecret` validation that ensures the secret is at least 32 characters.

**Prevention:** Add a startup assertion in `initAuth` that throws if `cohortHashSecret` is shorter than 32 characters or equals the known dev placeholder (`'dev-cohort-hash-secret-please-replace-in-prod-xxxxxxxxxxxxxx'`). This assertion should run regardless of which other changes are present.

---

### Pitfall 18: The `otpCode` Field Leaks in Error Messages During Transition

**What goes wrong:** The existing `settingsApi.ts` correctly strips `otpCode` from non-admin GET responses. During the TOTP migration, if a validation error message accidentally includes `otpCode` values (e.g., "Expected TOTP but got static OTP: 123456"), it leaks the old static code in logs.

**Prevention:** Never include the `otpCode` value in error message strings. Log only "OTP type mismatch", not the value.

---

### Pitfall 19: OIDC Callback URL Registered in Keycloak Must Match Express Route Exactly

**What goes wrong:** Keycloak validates the `redirect_uri` on the callback strictly. If the Express callback route is `/api/auth/oidc/callback` but Keycloak has `http://localhost:3000/api/auth/oidc/callback/` (trailing slash) registered, it rejects the callback with a cryptic error.

**Prevention:** Pin the exact callback URL in both `settings.yaml` (under `keycloak.callbackUrl`) and the Keycloak realm configuration. Test with trailing-slash variants. Document the exact URL format in the deployment guide.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| JWT algorithms pin (first security phase) | Must land before OIDC redirect work or algorithm confusion window exists | Implement in Phase 1 of v1.7 before any other auth changes |
| TOTP secret storage | Per-user secret added to `UserRecord` without encryption | Decide encryption strategy before writing `UserRecord` migration |
| TOTP window tolerance | Deploying without `window: 1` causes clock-skew lockouts at hospital sites | Use `otplib` `window: 1`; never implement manual TOTP without a library |
| TOTP transition | Site-wide `twoFactorEnabled` flag doesn't accommodate per-user TOTP enrollment state | Add `totpEnrolled: boolean` to `UserRecord` before toggling `twoFactorEnabled` |
| OIDC redirect implementation | State forgery protection requires cookie — the one place JWT-only is insufficient | Plan cookie strategy at phase start; don't retrofit |
| OIDC + local token coexistence | Algorithm confusion in `authMiddleware.ts` | Algorithms pin must already be merged before this phase |
| Cross-cohort chart | Legend name collisions with translated string keys | Prefix all series names with cohort identifier before first render |
| Cross-cohort memory | `Promise.all` on two aggregations doubles bundle memory | Sequence aggregations; document the decision in the plan |
| Dark mode palette | Reusing light-mode `EYE_COLORS` against dark backgrounds fails WCAG 3.0:1 | Derive `DARK_EYE_COLORS` and add palette contrast tests in the same phase |
| Dark mode Recharts SVGs | Tailwind `dark:` classes do not reach Recharts-generated SVG elements | Use a `useTheme()` hook to pass explicit `fill`/`stroke` props |
| Dark mode FOUC | React-state theme toggle flashes wrong theme on load | Inline `<script>` in `index.html` before bundle load |
| O(N+M) refactor | Referential equality breaks React.memo and test assertions | Structural equality in tests; reference-equality audit in components |
| O(N+M) refactor | Mock paths in existing tests target old module; shared/ code uncovered | Coverage report after refactor; direct tests on `shared/patientCases.ts` |
| Multi-cohort palette | 3-color set insufficient for 6 series (2 cohorts × 3 eyes) | Extend `palette.ts` with `COHORT_PALETTES` array at cross-cohort phase start |

---

## Sources

- System code read directly: `server/authApi.ts`, `server/initAuth.ts`, `server/keycloakAuth.ts`, `src/components/outcomes/palette.ts`, `src/components/outcomes/OutcomesPanel.tsx`, `shared/patientCases.ts`, `config/settings.yaml`
- RFC 6238 (TOTP): clock skew and window tolerance are specified in the RFC itself
- WCAG 2.1 SC 1.4.11 (Non-text Contrast): graphical threshold 3.0:1
- PKCE (RFC 7636): code_verifier storage risk documented in OAuth 2.0 Security BCP (RFC 9700)
- OIDC Core 1.0: state parameter CSRF protection
- Recharts SVG limitation: verified against OutcomesPanel.tsx patterns and Recharts API (tick prop accepts style object, not className)
- Tailwind dark mode FOUC: standard prevention requires synchronous inline script before React bundle
