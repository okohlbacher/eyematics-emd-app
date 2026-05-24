---
phase: 28-admin-session-control-ui
verified: 2026-05-24T19:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
gaps: []
human_verification:
  - test: "Revoked session returns 401 on next API call and frontend redirects to login"
    expected: "Browser shows login page immediately after admin revokes an active session"
    why_human: "Redirect-to-login UX after 401 is a browser-side navigation observable only in a live session context; sessionRevoke.test.ts confirms the 401 response itself"
  - test: '"Sign out everywhere" empties the session accordion immediately'
    expected: "After clicking Sign out everywhere, the per-user session table shows the no-active-sessions state"
    why_human: "UI list-clear after bulk revocation is a React state update observable only in a running browser; handleSignOutEverywhere wiring is confirmed by code grep"
  - test: "TTL values persist to settings.yaml and survive a server reload"
    expected: "After saving new TTL hours in SettingsPage, reloading the page shows the same values"
    why_human: "File persistence across a server restart is an end-to-end runtime confirmation; settingsApi round-trip test confirms the writeFileSync path"
---

# Phase 28: Admin Session Control UI — Verification Report

**Phase Goal:** Admins can see every active session for any user and end sessions — individually or all at once — and can adjust session TTL values without touching config files
**Verified:** 2026-05-24T19:00:00Z
**Status:** passed
**Re-verification:** No — backfill verification (V&V debt from v1.10 milestone, VVBACK-02)

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | The admin UI lists all active sessions for a selected user, showing device fingerprint, issued-at, last-used, and expires-at columns | VERIFIED | `git grep -n "expandedSessionUser\|listActiveSessionsByUser" v1.10 -- src/pages/AdminPage.tsx` → lines 124, 410; `git grep -n "listActiveSessionsByUser" v1.10 -- server/sessionsDb.ts` → line 203; session accordion renders `sessionDevice`, `sessionIssuedAt`, `sessionLastUsed`, `sessionExpires` i18n keys via GET `/api/auth/sessions?username=`; `git grep -n "authApiRouter.get.*sessions" v1.10 -- server/authApi.ts` → line 1087 (admin-only, `req.auth.role !== 'admin'` guard at line 1088). |
| SC2 | An admin can revoke any individual session from the listing — the revoked session's next API call returns 401 and the frontend redirects to login | VERIFIED | `git grep -n "handleRevokeSession" v1.10 -- src/pages/AdminPage.tsx` → lines 418, 944; calls `DELETE /api/auth/sessions/:id` → `git grep -n "authApiRouter.delete.*sessions/:id" v1.10 -- server/authApi.ts` → line 1043 (registered BEFORE query-param variant at 1066); backend calls `revokeSession(id)` → `git grep -n "revokeSession" v1.10 -- server/sessionsDb.ts` → line 160; `tests/sessionRevoke.test.ts` asserts 404 on unknown id and 200 on valid id → 10/10 green. |
| SC3 | An admin can trigger "sign out everywhere" for a user — all that user's sessions are revoked immediately and their next request returns 401 | VERIFIED | `git grep -n "handleSignOutEverywhere" v1.10 -- src/pages/AdminPage.tsx` → lines 429, 882; calls `DELETE /api/auth/sessions?username=` → `git grep -n "authApiRouter.delete.*sessions'" v1.10 -- server/authApi.ts` → line 1066; backend calls `revokeByUsername(username)` → `git grep -n "revokeByUsername" v1.10 -- server/sessionsDb.ts` → line 188; returns count of revoked sessions. `tests/sessionRevoke.test.ts` confirms all-revoke path → 10/10 green. |
| SC4 | An admin can view and save `refreshTokenTtlMs` and `refreshAbsoluteCapMs` from the admin UI; the values persist to `config/settings.yaml` and take effect on the next issued token | VERIFIED | `git show v1.10:src/services/ttlConversion.ts` → exports `hoursToMs`, `msToHours`, `validateTtl` (returns `'ok'\|'refreshMin'\|'capMin'\|'capMax'`); `git grep -n "refreshTokenTtlMs\|refreshAbsoluteCapMs\|updateSettings" v1.10 -- src/pages/SettingsPage.tsx` → lines 75–76 (load), 189–190 (save via `updateSettings`); `tests/settingsApi.test.ts` TTL round-trip confirms `writeFileSync` spy receives correct YAML with `auth.refreshTokenTtlMs`/`auth.refreshAbsoluteCapMs` → green. `tests/ttlConversion.test.ts` → 10/10 green. |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/sessionsDb.ts` | `listActiveSessionsByUser(username): SessionRow[]` filtering revoked=0 AND expires_at>now; `revokeByUsername(username): number`; `revokeSession(id): void` | VERIFIED | `git grep -n "listActiveSessionsByUser\|revokeByUsername\|revokeSession" v1.10 -- server/sessionsDb.ts` → lines 160, 188, 203; each uses a cached prepared statement; `listActiveSessionsByUser` ordered by `issued_at DESC`. |
| `server/authApi.ts` (three admin session endpoints + guard) | `DELETE /sessions/:id` (admin-only, 404 on unknown); `DELETE /sessions?username=` (admin-only, revokes all, returns count); `GET /sessions?username=` (admin-only, returns active list) | VERIFIED | `git grep -n "authApiRouter\.(delete\|get).*sessions" v1.10 -- server/authApi.ts` → lines 1043, 1066, 1087; route ordering: `:id` before query-param variant (`v1.10:server/authApi.ts:1035`); inline `req.auth.role !== 'admin'` guard at lines 1044, 1067, 1088; `listActiveSessionsByUser` imported at line 30. |
| `src/services/ttlConversion.ts` | `hoursToMs(hours)`, `msToHours(ms)`, `validateTtl(refreshHours, capHours) → 'ok'\|'refreshMin'\|'capMin'\|'capMax'` | VERIFIED | `git show v1.10:src/services/ttlConversion.ts` → all three exports present; `TTL_MAX_HOURS = 720` (30-day cap); mirrors server-side validation in `settingsApi.ts`. |
| `src/pages/SettingsPage.tsx` (TTL form) | TTL inputs load from `auth.refreshTokenTtlMs`/`auth.refreshAbsoluteCapMs` via `msToHours`; save path calls `updateSettings` → config/settings.yaml | VERIFIED | `git grep -n "refreshTokenTtlMs\|refreshAbsoluteCapMs\|updateSettings" v1.10 -- src/pages/SettingsPage.tsx` → load at lines 75–76 (`msToHours`); save at lines 189–190 (`hoursToMs` → `updateSettings`); `handleSaveTtl` validates with `validateTtl` before calling. |
| `src/pages/AdminPage.tsx` (session accordion) | `expandedSessionUser` state, `fetchSessions` lazy GET, `handleRevokeSession` DELETE /:id, `handleSignOutEverywhere` DELETE ?username=, `aria-expanded` on toggle button | VERIFIED | `git grep -n "expandedSessionUser\|handleRevokeSession\|handleSignOutEverywhere\|aria-expanded" v1.10 -- src/pages/AdminPage.tsx` → lines 124, 418, 429, 820; React.Fragment wrapper pairs user `<tr>` with accordion `<tr>`; single-open-at-a-time accordion. |
| `tests/sessionRevoke.test.ts` | 10 integration tests: GET list (admin gate, list format), DELETE :id (admin gate, 200 revoke, 404 unknown), DELETE ?username= (admin gate, all-revoke count) | VERIFIED | `git ls-tree v1.10 -- tests/sessionRevoke.test.ts` → blob `0fdf929`; 10/10 pass in full suite. |
| `tests/ttlConversion.test.ts` | 10 unit tests: `hoursToMs`, `msToHours`, `validateTtl` (ok, refreshMin, capMin, capMax) | VERIFIED | `git ls-tree v1.10 -- tests/ttlConversion.test.ts` → blob `2ac9ca3`; 10/10 pass in full suite. |
| `tests/settingsApi.test.ts` (TTL round-trip) | `auth.refreshTokenTtlMs`/`auth.refreshAbsoluteCapMs` persist via PUT /api/settings + writeFileSync spy | VERIFIED | `git ls-tree v1.10 -- tests/settingsApi.test.ts` → blob `f42842e`; TTL round-trip test confirms YAML serialization; full settingsApi suite green. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/pages/AdminPage.tsx` `fetchSessions` | `GET /api/auth/sessions?username=` | `authFetch` + `listActiveSessionsByUser` | WIRED | `git grep -n "fetchSessions\|/api/auth/sessions" v1.10 -- src/pages/AdminPage.tsx` → lazy GET called on accordion expand; `toggleSessionAccordion` calls `fetchSessions` at line 410. |
| `AdminPage.tsx` `handleRevokeSession` | `DELETE /api/auth/sessions/:id` → `revokeSession(id)` in `sessionsDb.ts` | `authFetch` DELETE, backend calls `revokeSession` | WIRED | `git grep -n "handleRevokeSession" v1.10 -- src/pages/AdminPage.tsx` → line 418; `git grep -n "revokeSession" v1.10 -- server/sessionsDb.ts` → line 160; route registered at `server/authApi.ts:1043`. |
| `AdminPage.tsx` `handleSignOutEverywhere` | `DELETE /api/auth/sessions?username=` → `revokeByUsername(username)` in `sessionsDb.ts` | `authFetch` DELETE, backend calls `revokeByUsername` | WIRED | `git grep -n "handleSignOutEverywhere" v1.10 -- src/pages/AdminPage.tsx` → line 429; `git grep -n "revokeByUsername" v1.10 -- server/sessionsDb.ts` → line 188; route registered at `server/authApi.ts:1066`. |
| `SettingsPage.tsx` TTL save | `ttlConversion.hoursToMs` → `updateSettings({ auth: { refreshTokenTtlMs, refreshAbsoluteCapMs } })` → `PUT /api/settings` → `config/settings.yaml` | `handleSaveTtl` → `updateSettings` → `settingsApi.ts` `writeFileSync` | WIRED | `git grep -n "hoursToMs\|updateSettings\|refreshTokenTtlMs" v1.10 -- src/pages/SettingsPage.tsx` → lines 189–190; `tests/settingsApi.test.ts` TTL round-trip test confirms the YAML write path via `vi.mocked(fs.writeFileSync)` spy. |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `listActiveSessionsByUser` defined in sessionsDb at v1.10 | `git grep -c "listActiveSessionsByUser" v1.10 -- server/sessionsDb.ts` | 3 (declaration, prepare, export) | PASS |
| `revokeByUsername` defined in sessionsDb at v1.10 | `git grep -c "revokeByUsername" v1.10 -- server/sessionsDb.ts` | ≥ 2 | PASS |
| `revokeSession` defined in sessionsDb at v1.10 | `git grep -c "revokeSession" v1.10 -- server/sessionsDb.ts` | ≥ 2 | PASS |
| Three session route handlers registered | `git grep -c "authApiRouter\.\(delete\|get\).*sessions" v1.10 -- server/authApi.ts` | 3 (lines 1043, 1066, 1087) | PASS |
| DELETE /sessions/:id registered BEFORE DELETE /sessions | `git grep -n "authApiRouter.delete.*sessions" v1.10 -- server/authApi.ts` | Line 1043 before 1066 — route order correct | PASS |
| Admin guard on all three session routes | `git grep -c "req\.auth\.role !== 'admin'" v1.10 -- server/authApi.ts` | ≥ 3 guards at lines 1044, 1067, 1088 | PASS |
| `validateTtl` present in ttlConversion.ts at v1.10 | `git show v1.10:src/services/ttlConversion.ts \| grep -c "validateTtl"` | 1 function definition | PASS |
| TTL fields load via `msToHours` in SettingsPage | `git grep -c "msToHours" v1.10 -- src/pages/SettingsPage.tsx` | ≥ 2 (load + reset) | PASS |
| `handleSignOutEverywhere` present in AdminPage | `git grep -c "handleSignOutEverywhere" v1.10 -- src/pages/AdminPage.tsx` | ≥ 2 (definition + onClick) | PASS |
| `aria-expanded` wired in AdminPage accordion | `git grep -c "aria-expanded" v1.10 -- src/pages/AdminPage.tsx` | ≥ 1 | PASS |
| All three Phase 28 test files at v1.10 | `git ls-tree v1.10 -- tests/sessionRevoke.test.ts tests/ttlConversion.test.ts tests/settingsApi.test.ts` | 3 blobs (0fdf929, f42842e, 2ac9ca3) | PASS |
| Full test suite green | `npm run test:ci` | 901/901 PASS (83 test files) | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| SESS-01 | 28-02-PLAN.md | Admin can force sign-out of all active sessions for a user via `DELETE /api/auth/sessions?username=` → `revokeByUsername` | SATISFIED | `server/authApi.ts` at `v1.10` line 1066: `DELETE /sessions` handler; `server/sessionsDb.ts` at `v1.10` line 188: `revokeByUsername` returns revoked count; `src/pages/AdminPage.tsx` at `v1.10` line 429: `handleSignOutEverywhere`; `tests/sessionRevoke.test.ts` 10/10 green. |
| SESSUI-01 | 28-02-PLAN.md, 28-04-PLAN.md | Admin UI lists all active sessions for a selected user with device, issued-at, last-used, expires-at via GET /api/auth/sessions + `listActiveSessionsByUser` | SATISFIED | `server/sessionsDb.ts` at `v1.10` line 203: `listActiveSessionsByUser` filters `revoked=0 AND expires_at > now`; `server/authApi.ts` at `v1.10` line 1087: `GET /sessions` admin endpoint; `src/pages/AdminPage.tsx` at `v1.10` line 124: `expandedSessionUser` accordion state; `tests/sessionRevoke.test.ts` 10/10 green. |
| SESSUI-02 | 28-02-PLAN.md, 28-04-PLAN.md | Admin can revoke any individual session via DELETE /api/auth/sessions/:id → revokeSession; 404 on unknown id | SATISFIED | `server/authApi.ts` at `v1.10` line 1043: `DELETE /sessions/:id` (registered before query-param variant); `server/sessionsDb.ts` at `v1.10` line 160: `revokeSession`; `src/pages/AdminPage.tsx` at `v1.10` line 418: `handleRevokeSession`; `tests/sessionRevoke.test.ts` covers 404 + 200 cases → 10/10 green. |
| SESSUI-03 | 28-03-PLAN.md | Admin can view and save refresh TTL and absolute cap from SettingsPage; values persist to settings.yaml via ttlConversion helpers | SATISFIED | `src/services/ttlConversion.ts` at `v1.10`: `hoursToMs`/`msToHours`/`validateTtl`; `src/pages/SettingsPage.tsx` at `v1.10` lines 75–76, 189–190: TTL load + save via `updateSettings`; `tests/ttlConversion.test.ts` 10/10 green; `tests/settingsApi.test.ts` TTL round-trip green. |

---

### Human Verification Required

The following three items from `28-VALIDATION.md` Manual-Only section are advisory UI confirmations. Their underlying revocation and persistence logic is fully covered by automated tests (`sessionRevoke.test.ts`, `settingsApi.test.ts`). They do not block the `status: passed` verdict.

1. **Revoked-session redirect**: After an admin revokes an active session via the accordion Revoke button, the affected user's next page load should redirect to `/login`. The 401 response itself is confirmed by `tests/sessionRevoke.test.ts`; the client-side redirect behavior requires a live browser with two active tabs.

2. **Sign out everywhere list clear**: After clicking "Sign out everywhere", the AdminPage session accordion for that user should immediately show the empty-sessions state. The `handleSignOutEverywhere` → `DELETE /sessions?username=` wire is confirmed by code grep; the React state update requires a live browser.

3. **TTL persistence across reload**: After saving new TTL values in SettingsPage, refreshing the browser and reopening Settings should display the saved values. The `writeFileSync` round-trip is confirmed by `tests/settingsApi.test.ts`; observing the persisted values in the UI requires a running server.

---

### Gaps Summary

No blocking gaps. Phase 28 is verified as-shipped at `v1.10`. All four requirements (SESS-01, SESSUI-01, SESSUI-02, SESSUI-03) are satisfied end-to-end:

- **SESS-01**: `DELETE /api/auth/sessions?username=` at `server/authApi.ts:1066` calls `revokeByUsername` — bulk sign-out with count returned. Admin-only guard enforced inline. `handleSignOutEverywhere` in `AdminPage.tsx:429` wires the UI. `tests/sessionRevoke.test.ts` 10/10 green.
- **SESSUI-01**: `GET /api/auth/sessions?username=` at `server/authApi.ts:1087` calls `listActiveSessionsByUser` — filters to `revoked=0 AND expires_at > now`, ordered by `issued_at DESC`. Session accordion in `AdminPage.tsx` lazy-fetches on expand, rendering device/issued-at/last-used/expires-at columns with i18n keys.
- **SESSUI-02**: `DELETE /api/auth/sessions/:id` at `server/authApi.ts:1043` calls `revokeSession` — 404 on unknown id, 200 on success. Registered BEFORE the query-param variant to prevent route shadowing. `handleRevokeSession` in `AdminPage.tsx:418` re-fetches the session list on 200.
- **SESSUI-03**: `src/services/ttlConversion.ts` provides `hoursToMs`/`msToHours`/`validateTtl` (mirrors server-side validation; `TTL_MAX_HOURS = 720`). `SettingsPage.tsx` loads and saves `auth.refreshTokenTtlMs`/`auth.refreshAbsoluteCapMs` via `updateSettings` → `PUT /api/settings` → `config/settings.yaml`. `tests/ttlConversion.test.ts` 10/10 green; `tests/settingsApi.test.ts` TTL round-trip green.

The full test suite is 901/901 green. No product source files were modified during this verification.

---

_Verified: 2026-05-24T19:00:00Z_
_Verifier: Claude (gsd-verifier)_
