# Phase 32: User Management & Auth Hardening — Context

**Gathered:** 2026-05-21
**Status:** Ready for planning
**Source:** UAT batch 1 (EMD-v1.10-Changelog-Feedback_discussion.docx) + direct codebase grounding (no discuss-phase; context captured here)

<domain>
## Phase Boundary

Harden the admin user-management dialogs and the authentication feedback/config surface. Two cohesive areas:
- **UMGMT** — admin create/edit user dialog validation + user activation lifecycle
- **AUTHCFG** — login lockout feedback, inactivity countdown, and moving hardcoded auth constants to `config/settings.yaml`

In scope: UMGMT-01, UMGMT-02, UMGMT-03, AUTHCFG-01, AUTHCFG-02, AUTHCFG-03, AUTHCFG-04.
Out of scope: cohort/dashboard/data work (Phases 33–34), V&V backfill (35), compaction (36).
</domain>

<requirements>
- **UMGMT-01**: Enforce "≥1 assigned center" in the admin **edit-user** dialog (today: create-only).
- **UMGMT-02**: All user fields mandatory (non-empty) with inline errors in **both** create and edit dialogs.
- **UMGMT-03**: User activation status — `active` flag (default true) on the user model; admin de/reactivate via checkbox; inactive users cannot authenticate; deactivation immediately revokes active sessions.
- **AUTHCFG-01**: Login page shows remaining attempts (after first failure) + remaining lockout time when locked.
- **AUTHCFG-02**: Inactivity warning shows a live countdown; warning lead time = 3 minutes.
- **AUTHCFG-03**: `INACTIVITY_TIMEOUT` + `WARNING_BEFORE` sourced from `config/settings.yaml`.
- **AUTHCFG-04**: `maxLoginAttempts` + lockout duration sourced from `config/settings.yaml`.
</requirements>

<codebase_grounding>
Verified file:line references (current `main`):

**User management UI** — `src/pages/AdminPage.tsx`
- Create dialog: ~277–319 (`handleAdd`). Center-required check at `:281` (`if (selectedCenters.length === 0)`); username-required at `:280`. Fields: username, firstName, lastName, role, selectedCenters.
- Edit dialog: ~369–403 (`startEdit`, `handleEditSave`). Posts `editCenters` as-is at `:389`. **No center-required check, no field-required checks.** Username not editable.

**User model** — `server/initAuth.ts`
- `UserRecord` interface ~20–46. Fields: username, passwordHash, role, centers, firstName, lastName, createdAt, lastLogin, totpSecret, totpEnabled, recoveryCodeHashes, tokenVersion, passwordChangedAt, totpChangedAt. **No `active`/`enabled`/`status` field exists.**

**Login lockout** — `server/initAuth.ts` + `server/authApi.ts`
- `maxLoginAttempts` is **already** read from settings (`initAuth.ts:123` and `:235`, default 5). Rate limiter built from `getAuthConfig().maxLoginAttempts` in `authApi.ts`. → AUTHCFG-04's remaining gap is the **lockout duration** (and any other hardcoded auth values), not maxLoginAttempts itself. The planner must confirm where lockout duration lives.
- Client `AuthContext.tsx` login ~188–249 returns `{ ok:false, error:'account_locked', retryAfterMs? }`. No remaining-attempts or lockout-time display on the login page today.

**Inactivity** — `src/context/AuthContext.tsx`
- `INACTIVITY_TIMEOUT = 10*60*1000` (`:50`, exported), `WARNING_BEFORE = 60*1000` (`:51`). Timers at `:164`/`:168`. Banner rendered in `src/components/Layout.tsx` ~67–72 (`t('inactivityWarning')`), **no countdown**.

**Config** — `config/settings.yaml` (source) + `public/settings.yaml` (served); loader `server/settingsApi.ts` (`readSettings`/`validateSettingsSchema`/`getAuthSettings` ~36–147). Existing flat `auth` sub-object: `refreshTokenTtlMs`, `refreshAbsoluteCapMs`, `refreshCookieSecure` (`AUTH_DEFAULTS`). Client reads via authenticated `GET /api/settings` (`stripSensitiveAudit`). `ttlConversion.ts` is the precedent for hours↔ms config helpers (Phase 28).

**Session revocation precedent** — `revokeByUsername()` is already used by `DELETE /api/auth/users/:username` (PROT-001) to invalidate sessions on user deletion. UMGMT-03 deactivation should reuse it.
</codebase_grounding>

<locked_decisions>
1. Config lives in `config/settings.yaml` only — **no env vars** (project rule). New auth keys join the existing flat `auth` sub-object (F-10), coherent with `refreshTokenTtlMs` etc. Reuse the `ttlConversion.ts` hours↔ms pattern where a duration is user-facing.
2. **AUTHCFG-02 "−3min" = `WARNING_BEFORE` set to 3 minutes** (warning appears 3 min before logout). `INACTIVITY_TIMEOUT` default unchanged unless config overrides.
3. **UMGMT-03 deactivation reuses `revokeByUsername()`** to immediately revoke sessions (mirrors PROT-001 delete). Inactive users rejected at the login path (server-authoritative), default `active: true`; existing `users.json` records without the field are treated as active (startup migration like `_migrateRemovedCenters`).
4. **M4 — client bootstrap:** inactivity constants are consumed client-side; the client must read `/api/settings` (or have the values injected) **before** the inactivity timer initializes, else it falls back to safe defaults. Lockout duration + maxLoginAttempts stay server-authoritative; `maxLoginAttempts` may be surfaced to the client for the remaining-attempts display.
5. Error handling: throw-only (D-03). Naming: camelCase TS; wire/DB/FHIR strings as-is (D-05).
6. **Tests:** no jest-dom — RTL uses `queryByText().not.toBeNull()` / `.toBeNull()`. Baseline 783/783 must stay green; new behavior adds tests.
</locked_decisions>

<claude_discretion>
- Exact UI affordance for the activation checkbox in AdminPage (row toggle vs edit-dialog field) — pick the pattern consistent with existing AdminPage controls.
- Shape of the remaining-attempts/lockout-time message and i18n keys (DE+EN, with completeness test, per existing i18n convention).
- Whether lockout duration is a new `auth.lockoutDurationMs`/`auth.lockoutDurationMinutes` key — choose naming consistent with existing keys.
- Whether to split into per-area plans (UMGMT vs AUTHCFG) — recommended given the phase spans backend migration + multiple UI surfaces.
</claude_discretion>

<success_criteria>
1. Admin cannot save a user (create or edit) without ≥1 assigned center; inline errors shown for all empty mandatory fields in both dialogs.
2. Admin can deactivate a user; the user then cannot log in and all their sessions are immediately revoked; reactivation restores login.
3. After a failed login the page shows remaining attempts; when locked it shows remaining lockout time counting down.
4. The inactivity warning banner shows a live countdown, beginning 3 minutes before logout.
5. `INACTIVITY_TIMEOUT`, `WARNING_BEFORE`, `maxLoginAttempts`, and lockout duration are read from `config/settings.yaml` — no hardcoded values remain in `AuthContext.tsx` or `server/initAuth.ts`.
</success_criteria>
