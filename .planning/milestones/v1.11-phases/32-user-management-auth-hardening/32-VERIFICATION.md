---
phase: 32-user-management-auth-hardening
verified: 2026-05-21T00:00:00Z
status: passed
score: 5/5 success criteria verified
overrides_applied: 0
---

# Phase 32: User Management & Auth Hardening — Verification Report

**Phase Goal:** Harden admin user-management dialogs and the authentication feedback/config surface.
**Verified:** 2026-05-21
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Per-Criterion Verdict

### SC1 — Admin cannot save a user (create or edit) without ≥1 center; inline errors for all empty mandatory fields in both dialogs

**Verdict: MET**

**Create dialog (`handleAdd`, AdminPage.tsx:284–329):**
- `formErrors` state typed as `{ username?, firstName?, lastName?, role?, centers? }` (line 112)
- Validation at lines 287–291 checks `!username.trim()`, `!firstName.trim()`, `!lastName.trim()`, `!role`, `selectedCenters.length === 0` — all set errors and `return` without `authFetch`
- Inline error `<p className="text-xs text-red-500 mt-1">` rendered under each field (lines 554, 568, 582, 601, 626)
- Each field's onChange clears its own error (lines 551, 565, 579, 591, 615)

Note: The `!role` branch in `handleAdd` (line 290) is technically dead code because `role` state initializes to `'researcher'` and the `<select>` always has a value — however the server validates role allowlist independently, and the select has no empty option, so no real-world failure path exists.

**Edit dialog (`handleEditSave`, AdminPage.tsx:392–431):**
- `editFormErrors` state typed as `{ firstName?, lastName?, role?, centers? }` (line 120)
- Validation at lines 396–403 checks `!editFirstName.trim()`, `!editLastName.trim()`, `!editRole`, `editCenters.length === 0` — all set `editFormErrors` and `return` without `authFetch`
- Inline error `<p className="text-xs text-red-500 mt-0.5">` rendered under each edit field (lines 755, 765, 780, 813)
- Edit fields clear their error on change (lines 754, 763, 771)

**Tests:** `tests/adminUserDialog.test.tsx` covers edit dialog blocking on empty centers (UMGMT-01), both dialogs blocking on empty firstName/lastName/role (UMGMT-02), and activation checkbox body inclusion (UMGMT-03).

---

### SC2 — Admin can deactivate a user; the user cannot log in; sessions revoked immediately; reactivation restores login

**Verdict: MET**

**`active` flag on `UserRecord` (initAuth.ts:47–51):** `active?: boolean` with JSDoc "default true; an absent field means active (migration target)".

**Startup migration (`_migrateActiveFlag`, initAuth.ts:478–491):**
- Exported, pure, idempotent helper — absent `active` → set to `true`, explicit `false` preserved
- Invoked in `_migrateUsersJson` (line 550) after session-field migration, with console.log
- Tested in `tests/initAuthMigration.test.ts`

**Login gate at `/login` (authApi.ts:249–255):**
- After bcrypt success and `resetAttempts`, checks `if (user.active === false)` → `res.status(401).json({ error: 'Invalid credentials' })`
- Comment at line 250 confirms: "absent `active` means active — migration target; only an explicit `false` blocks login"
- Generic 401 (same message as bad credentials) — preserves T-02-05 non-enumeration

**Login gate at `/verify` (authApi.ts:324–330):**
- After user lookup, checks `if (user.active === false)` → 401 `Invalid credentials`
- Prevents challenge tokens issued before deactivation completing login (T-32-02)

**`PUT /users/:username` deactivation + revocation (authApi.ts:700–778):**
- Destructures `active` from body (line 707)
- Validates boolean type when present (line 717–719) → 400 on non-boolean
- Inside `modifyUsers` callback captures `previousActive` and sets `wasDeactivated` when `active === false && previousActive !== false` (lines 748–753)
- After write commits, calls `revokeByUsername(target)` inside try/catch (lines 768–774)
- `PUT active:true` does NOT call `revokeByUsername` (only true→false transition triggers it)

**GET /users projection (authApi.ts:569):** includes `active` field so admin UI can display status.

**Reactivation:** `PUT { active: true }` sets `user.active = true` without triggering `wasDeactivated`; subsequent login checks `user.active === false` which is now false → login succeeds.

**Tests:** `tests/userCrud.test.ts` lines 339–471 cover inactive user 401, active/legacy user success, deactivation calling `revokeByUsername` once, reactivation not calling revoke, omitted active leaving unchanged, non-boolean → 400, GET returning active field.

---

### SC3 — After a failed login the page shows remaining attempts; when locked it shows remaining lockout time counting down

**Verdict: MET**

**Server — attemptsRemaining on 401 body:**
- Known user bad-password branch (authApi.ts:234–243): on non-locked failure, returns `{ error: 'Invalid credentials', attemptsRemaining: Math.max(0, getAuthConfig().maxLoginAttempts - newState.count) }`
- Unknown user branch (authApi.ts:216–229): mirrors known-user — captures `newState`, checks `isLocked` → 429 with `retryAfterMs` if locked, else 401 with `attemptsRemaining` (symmetric, Blocker #2)

**Client — AuthContext login() (AuthContext.tsx:309–316):**
- On 401 path, calls `resp.json()` to extract `attemptsRemaining`, returns `{ ok: false, error: 'invalid_credentials', attemptsRemaining }`
- On 429 path, returns `{ ok: false, error: 'account_locked', retryAfterMs }` (unchanged)
- `LoginResult` type extended with `attemptsRemaining?: number` (line 33)

**Client — LoginPage display (LoginPage.tsx):**
- `attemptsRemaining` state (line 15), `lockoutSecondsRemaining` state (line 16)
- On `invalid_credentials`: sets `attemptsRemaining` from `result.attemptsRemaining` when > 0 (lines 96–100)
- On `account_locked`: starts 1s countdown interval from `result.retryAfterMs`, updates `lockoutSecondsRemaining`, clears interval at 0 and re-enables form (lines 74–91)
- Renders inline `loginAttemptsRemaining` with `{0}` placeholder (line 149)
- Renders inline `loginLockoutCountdown` in `mm:ss` format (line 154)
- Submit button disabled while `lockoutSecondsRemaining > 0` (line 222)

**Tests:** `tests/loginLockout.test.ts` — covers known-user 401 with `attemptsRemaining`, unknown-user 401 with same shape (symmetric, line 114), decrementing attempts (line 123), known-user 429 on threshold without `attemptsRemaining` (line 135), unknown-user 429 on threshold (line 147), and `resetLimiter` rebuild (lines 160–177).

---

### SC4 — The inactivity warning banner shows a live countdown beginning 3 minutes before logout

**Verdict: MET**

**AuthContext (AuthContext.tsx):**
- `WARNING_BEFORE = 3 * 60 * 1000` (line 55, previously 60s)
- `inactivitySecondsRemaining` state (line 107), `warningEndsAtRef` (line 111)
- In `resetInactivityTimer` (lines 166–196): when the warning timer fires (at `timeoutMs - warningMs`), sets `inactivityWarning = true`, records `warningEndsAtRef.current = Date.now() + warningMs`, initializes `Math.ceil(warningMs / 1000)` seconds, then starts 1s `setInterval` updating `inactivitySecondsRemaining` until 0
- `inactivitySecondsRemaining` exposed on `AuthContextType` (line 43) and returned in context value (line 330)

**Layout.tsx (lines 67–77):**
- When `inactivityWarning` is true, renders banner containing `t('inactivityWarning')`
- Additionally, when `inactivitySecondsRemaining > 0`, renders `<span className="ml-2 font-mono">` with `t('inactivityCountdown').replace('{0}', 'mm:ss')`
- Consumes `inactivitySecondsRemaining` from `useAuth()` (line 13)

**Timer sourcing (AUTHCFG-03):**
- On user login, `useEffect` at AuthContext.tsx:201–221 calls `settingsService.loadSettings()`, reads `s.auth?.inactivityTimeoutMs ?? INACTIVITY_TIMEOUT` and `s.auth?.warningBeforeMs ?? WARNING_BEFORE` into refs
- On rejected load, refs stay at safe defaults (T-32-09)
- `resetInactivityTimer` uses `inactivityTimeoutMsRef.current` and `warningBeforeMsRef.current` (lines 175–176)

---

### SC5 — `INACTIVITY_TIMEOUT`, `WARNING_BEFORE`, `maxLoginAttempts`, and lockout cap read from `config/settings.yaml`; no hardcoded values remain; `resetLimiter` wired on settings PUT

**Verdict: MET**

**config/settings.yaml (lines 15–19):**
```yaml
maxLoginAttempts: 5              # max failed logins before lockout
lockoutCapMs: 900000             # exponential backoff cap...
inactivityTimeoutMs: 600000      # 10 min inactivity before auto-logout
warningBeforeMs: 180000          # 3 min warning before auto-logout (AUTHCFG-02)
```
All four keys are present in the `auth:` sub-object.

**server/initAuth.ts `initAuth()` (lines 127–136):**
- Reads `settings.auth?.maxLoginAttempts`, falls back to top-level then 5
- Reads `settings.auth?.lockoutCapMs`, defaults to `900_000`
- `updateAuthConfig()` (lines 245–254) mirrors the same reads — called from settings PUT path

**server/rateLimiting.ts (line 27):**
- `createRateLimiter(maxLoginAttempts: number, lockoutCapMs: number = MAX_LOCKOUT_MS)` — cap is parameter, not hardcoded in `recordFailure`
- `MAX_LOCKOUT_MS = 3_600_000` is only the default; backoff uses `lockoutCapMs` param

**server/authApi.ts (lines 63–81):**
- `limiter()` builds from `cfg.maxLoginAttempts, cfg.lockoutCapMs` (line 67)
- `resetLimiter()` exported, nulls `_limiter` (line 80)

**server/settingsApi.ts (line 241–246):**
- Settings PUT path calls `updateAuthConfig(parsedObj)` then immediately `resetLimiter()` — wired explicitly with comment "Blocker #1 / AUTHCFG-04"

**Client (AuthContext.tsx:54–55):**
- `INACTIVITY_TIMEOUT = 10 * 60 * 1000` — labeled "safe default" not active value
- `WARNING_BEFORE = 3 * 60 * 1000` — labeled "AUTHCFG-02", 3 min
- No occurrence of `WARNING_BEFORE = 60 * 1000` (old 1-min hardcode is gone)
- Active values sourced from `settingsService.loadSettings()` at lines 208–209

**Validation (settingsApi.ts:114–139):**
- `auth.maxLoginAttempts` >= 1, integer
- `auth.lockoutCapMs` > 0, integer
- `auth.inactivityTimeoutMs` > 0, integer
- `auth.warningBeforeMs` > 0, integer, < `inactivityTimeoutMs`

**Tests:** `tests/rateLimiting.test.ts` (configurable cap, lines 123–165), `tests/settingsApi.test.ts` (round-trip for all four keys, rejection of invalid values, non-admin visibility), `tests/loginLockout.test.ts` (resetLimiter rebuild on config change, lines 160–177), `tests/inactivitySettings.test.ts` (defaults 600000/180000, fallback on rejected load).

---

## Artifact Verification

| Artifact | Status | Key Evidence |
|----------|--------|--------------|
| `server/initAuth.ts` | VERIFIED | `active?: boolean` on `UserRecord` (line 50); `_migrateActiveFlag` exported (line 478); `lockoutCapMs` in `AuthConfig` (line 58); `initAuth/updateAuthConfig` read settings.auth sub-object |
| `server/authApi.ts` | VERIFIED | Login gate `user.active === false` at lines 252–255 and verify gate at 327–330; symmetric unknown-user 429 branch (lines 221–229); `attemptsRemaining` on both 401 paths; `resetLimiter()` exported (line 79); `revokeByUsername` called on deactivation (line 770) |
| `server/rateLimiting.ts` | VERIFIED | `lockoutCapMs` param to `createRateLimiter` (line 27); used in `recordFailure` backoff (line 42) |
| `server/settingsApi.ts` | VERIFIED | New auth keys validated (lines 115–139); `resetLimiter()` called after `updateAuthConfig` (line 245); non-admin strip does NOT strip `auth.*` operational params (line 201 destructure strips only `otpCode`, `maxLoginAttempts`, `provider` at top level) |
| `config/settings.yaml` | VERIFIED | All four Phase 32 auth keys present under `auth:` sub-object (lines 16–19) |
| `src/pages/AdminPage.tsx` | VERIFIED | `editFormErrors` state (line 120); `editActive` state (line 122); `handleEditSave` validates all fields (lines 396–404); `active` in PUT body (line 417); `handleAdd` validates all fields (lines 287–295); inline error rendering for all fields; activation checkbox (line 787); inactive badge (lines 839–843) |
| `src/context/AuthContext.tsx` | VERIFIED | `WARNING_BEFORE = 3 * 60 * 1000` (line 55); settings loaded before timer (lines 201–221); `inactivitySecondsRemaining` live countdown (lines 183–190); `attemptsRemaining` in `LoginResult` (line 33) and returned from 401 (lines 312–313) |
| `src/pages/LoginPage.tsx` | VERIFIED | `attemptsRemaining` state (line 15); lockout countdown interval (lines 81–90); `loginAttemptsRemaining` rendered (line 149); `loginLockoutCountdown` rendered (line 154) |
| `src/components/Layout.tsx` | VERIFIED | Banner renders `inactivitySecondsRemaining` in `mm:ss` via `inactivityCountdown` i18n key (lines 71–75) |
| `src/i18n/translations.ts` | VERIFIED | `adminUserActive`, `adminUserInactiveBadge`, `inactivityCountdown`, `loginAttemptsRemaining`, `loginLockoutCountdown` all present with non-empty `de` and `en` values (lines 361, 363, 450–460) |
| `src/services/settingsService.ts` | VERIFIED | `AppSettings.auth` extended with `inactivityTimeoutMs?`, `warningBeforeMs?` (lines 21–23); `DEFAULTS.auth` has `inactivityTimeoutMs: 600_000` and `warningBeforeMs: 180_000` (lines 44–45) |

## Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `AdminPage.tsx handleEditSave` | `PUT /api/auth/users/:username` | `authFetch` body includes `active: editActive` + validated fields | WIRED |
| `authApi.ts PUT /users/:username deactivate` | `revokeByUsername(target)` | `wasDeactivated` flag, called after `modifyUsers` write | WIRED |
| `authApi.ts POST /login inactive gate` | `401 { error: 'Invalid credentials' }` | After bcrypt success, `if (user.active === false)` | WIRED |
| `authApi.ts POST /verify inactive gate` | `401 { error: 'Invalid credentials' }` | After user lookup, `if (user.active === false)` | WIRED |
| `server/initAuth.ts updateAuthConfig` | `server/authApi.ts resetLimiter()` | Called in `settingsApi.ts` PUT immediately after `updateAuthConfig` | WIRED |
| `authApi.ts POST /login 401 body` | `LoginPage attemptsRemaining display` | `attemptsRemaining` in JSON; AuthContext parses via `resp.json()`; LoginPage renders via `loginAttemptsRemaining` i18n key | WIRED |
| `AuthContext.tsx inactivity timers` | `settingsService.loadSettings()` auth values | `inactivityTimeoutMsRef` / `warningBeforeMsRef` set from settings before `resetInactivityTimer()` called | WIRED |
| `Layout.tsx banner` | `AuthContext inactivitySecondsRemaining` | Destructured from `useAuth()` and rendered in `mm:ss` span | WIRED |

## Anti-Patterns Found

None identified. No `TBD`, `FIXME`, or `XXX` markers in Phase 32 modified files. No stub implementations or hardcoded empty returns in the new code paths.

## Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| UMGMT-01: ≥1 center in edit-user dialog | SATISFIED | `editCenters.length === 0` → error + early return in `handleEditSave` (AdminPage.tsx:400–404) |
| UMGMT-02: All mandatory fields in both dialogs | SATISFIED | `handleAdd` + `handleEditSave` both validate firstName, lastName, role, centers with inline errors |
| UMGMT-03: `active` flag, activation lifecycle, session revocation | SATISFIED | `_migrateActiveFlag`, login gate at /login + /verify, PUT toggle with `revokeByUsername`, UI checkbox + inactive badge |
| AUTHCFG-01: Remaining attempts + lockout countdown on login page | SATISFIED | Server returns `attemptsRemaining` on both 401 branches and `retryAfterMs` on 429; LoginPage renders both |
| AUTHCFG-02: Live inactivity countdown, 3-minute lead | SATISFIED | `WARNING_BEFORE = 3 * 60 * 1000`; countdown interval in AuthContext; rendered in Layout.tsx banner |
| AUTHCFG-03: INACTIVITY_TIMEOUT + WARNING_BEFORE from settings | SATISFIED | `settingsService.loadSettings()` consulted before timer starts; safe-default fallback when rejected |
| AUTHCFG-04: maxLoginAttempts + lockout cap from settings; live rebuild | SATISFIED | Both keys in `auth:` YAML sub-object; `updateAuthConfig` reads them; `resetLimiter()` called after settings PUT |

## Human Verification Required

The following behaviors are correct in code but require manual testing to confirm the runtime experience:

1. **Inactivity countdown live rendering**
   - Test: Log in, sit idle for 7 minutes (with `inactivityTimeoutMs: 600000`), observe the warning banner appear showing a live `mm:ss` countdown from `03:00` down to `00:00`
   - Expected: Warning banner with countdown appears 3 minutes before auto-logout; the counter ticks down every second; at `00:00` the user is automatically logged out
   - Why human: Requires a running browser session; cannot verify real-time timer behavior programmatically

2. **Login lockout countdown**
   - Test: Exceed `maxLoginAttempts` (default 5) on the login page; observe the 429 lockout state
   - Expected: Login form is disabled; a counting-down `mm:ss` timer shows remaining lockout time; when it reaches 00:00 the form re-enables automatically
   - Why human: Requires browser interaction with real rate limiter state

3. **Deactivation flow in Admin UI**
   - Test: Open the edit row for a non-admin user, uncheck the "Active" checkbox, save; then attempt to log in as that user
   - Expected: Login is refused with generic "Invalid credentials" message; user's sessions are revoked (visible in the sessions accordion for that user emptying)
   - Why human: Requires two simultaneous browser sessions (admin + target user)

---

## Overall Summary

All 5 success criteria are **MET** with solid code evidence and test coverage. The phase delivered:

- **SC1 (dialog validation):** Both create and edit dialogs enforce ≥1 center and all mandatory fields (firstName, lastName, role) with inline error rendering and no-submit-without-validation. RTL tests cover all paths.
- **SC2 (deactivation lifecycle):** `active?: boolean` on `UserRecord` with startup migration; server gates login at both `/login` and `/verify`; PUT toggle calls `revokeByUsername` on true→false transition; tested for both branches and the non-revoke paths.
- **SC3 (login feedback):** Both known-user and unknown-user branches are symmetric: 401 with `attemptsRemaining` before threshold, 429 with `retryAfterMs` after. LoginPage renders both. The previously-missing unknown-user 429 path (Blocker #2) is implemented and tested.
- **SC4 (inactivity countdown):** `WARNING_BEFORE` set to 3 minutes; live `inactivitySecondsRemaining` countdown computed in AuthContext via 1s interval; rendered in Layout.tsx banner as `mm:ss`.
- **SC5 (config-driven constants):** All four keys (`maxLoginAttempts`, `lockoutCapMs`, `inactivityTimeoutMs`, `warningBeforeMs`) live in `config/settings.yaml` under `auth:`; `AuthContext.tsx` has no hardcoded 60s warning; `resetLimiter()` is wired immediately after `updateAuthConfig()` in the settings PUT path (AUTHCFG-04 Blocker #1 is not illusory).

Test suite at 828/828 as reported by the operator.

---

_Verified: 2026-05-21_
_Verifier: Claude (gsd-verifier)_
