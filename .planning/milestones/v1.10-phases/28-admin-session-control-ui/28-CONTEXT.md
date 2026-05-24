# Phase 28: Admin Session Control UI - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the admin-facing session management UI on top of the stateful refresh-sessions table delivered in Phase 27. Three capabilities: (1) view all active sessions per user, (2) revoke individual sessions or all sessions for a user, (3) configure session TTL values from the UI. All three require new backend endpoints (`GET /api/auth/sessions`, `DELETE /api/auth/sessions/:id`, `DELETE /api/auth/sessions?username=...`) and frontend integration.

Requirements in scope: SESS-01, SESSUI-01, SESSUI-02, SESSUI-03.
No new data model changes — Phase 27's `refresh_sessions` table and `sessionsDb.ts` already have the schema and `revokeByUsername` helper needed.

</domain>

<decisions>
## Implementation Decisions

### Session Panel Placement (SESSUI-01, SESSUI-02)

- **D-01:** The session listing lives as an **inline expandable section** inside `AdminPage.tsx`, revealed when an admin clicks on a user row (or a dedicated "Sessions" toggle per user). No new page or route. This is consistent with the existing user-centric pattern: each row already shows role, centers, lastLogin — the session accordion is a natural extension.
- **D-02:** The expanded panel shows a table with columns: `device` (formatted `key_id`), `Issued`, `Last used`, `Expires`, and a `Revoke` action button per row. An "Sign out everywhere" button appears at the top of the panel (SESS-01).
- **D-03:** Only **active** sessions are shown: `revoked = 0` AND `expires_at > now`. Expired/revoked rows are not displayed (no audit value in listing dead sessions in the admin UI).
- **D-04:** No confirmation dialog for individual revoke — consistent with AdminPage's existing delete-user UX (no modal). The revoked row is removed from the list immediately after the API call returns 200.
- **D-05:** "Sign out everywhere" button uses a single `DELETE /api/auth/sessions?username=…` call (calls `revokeByUsername` on the server). After success, the session list empties. Button shows a brief loading state during the API call.

### TTL Configuration UI (SESSUI-03)

- **D-06:** `refreshTokenTtlMs` and `refreshAbsoluteCapMs` are surfaced in **`SettingsPage.tsx`**, inside the existing auth settings section (currently shows TOTP toggle and data-source settings). Already wired: `settingsService.ts` → `PUT /api/settings` → `settingsApi.ts` validates and writes `settings.yaml`.
- **D-07:** The two TTL inputs are displayed in **hours** (not milliseconds) in the UI. The service layer converts: `hours * 3600 * 1000 = ms` on save, `ms / 3600000 = hours` on load. This avoids showing "28800000" to admins.
- **D-08:** Client-side validation: refresh TTL ≥ 1h; absolute cap ≥ refresh TTL. Mirrors the existing server-side validation in `settingsApi.ts` (lines ~94–100) — fail fast on client, server still enforces.
- **D-09:** Save writes immediately via `updateSettings` (same pattern as other settings). No "apply on next issued token" spinner — settings.yaml is read at call time by `getAuthSettings()`, so next issued token picks up new values automatically.

### New Backend Endpoints

- **D-10:** `GET /api/auth/sessions?username=<u>` — admin-only. Returns array of `SessionRow` objects filtered to active rows for the given user. New export `listActiveSessionsByUser(username)` in `sessionsDb.ts` using a new prepared statement (`SELECT ... WHERE username = @username AND revoked = 0 AND expires_at > datetime('now')`).
- **D-11:** `DELETE /api/auth/sessions/:id` — admin-only. Calls `revokeSession(id)` from sessionsDb. Returns `{ revoked: true }`. 404 if row not found.
- **D-12:** `DELETE /api/auth/sessions?username=<u>` — admin-only (SESS-01 force sign-out). Calls `revokeByUsername(username)`. Returns `{ revoked: number }` (count of sessions revoked).
- **D-13:** All three endpoints live in `server/authApi.ts` alongside existing auth routes (same router, same pattern as `/rotate-key`). Admin role checked via `requireRole('admin')` middleware.

### Frontend Data Fetching

- **D-14:** Sessions are fetched lazily — only when the admin expands a user's session accordion. `authFetch` is used (same pattern as AdminPage's user CRUD). No global DataContext integration; sessions are local component state in AdminPage.
- **D-15:** After a revoke action, the component re-fetches the session list for that user (single GET call). This is simpler than optimistic removal and keeps the list authoritative.

### Claude's Discretion

- Exact Lucide icon for the session panel expand toggle — `ChevronDown`/`ChevronUp` (consistent with other accordions).
- Loading spinner for session fetch — reuse existing `Loader2` pattern already used in AdminPage.
- i18n keys naming — follow existing `camelCase` convention for translation keys (e.g., `adminSessions`, `adminRevokeSession`, `adminSignOutEverywhere`, `sessionIssuedAt`, `sessionLastUsed`, `sessionExpires`, `sessionDevice`, `ttlRefreshHours`, `ttlAbsoluteCapHours`).
- Device column format — show last 8 chars of `key_id` prefixed with "Key:" (e.g., "Key: a3f2b1c0") — readable without being verbose.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 27 Backend (foundation for this phase)
- `server/sessionsDb.ts` — Full sessions DB module. Phase 28 adds `listActiveSessionsByUser`. Read for schema, patterns, prepared-statement caching style.
- `server/authApi.ts` — All auth routes. New endpoints (`GET/DELETE /api/auth/sessions`) go here. Read the `/rotate-key` handler (~line 1010) for the admin-endpoint pattern to follow.
- `server/authMiddleware.ts` — PUBLIC_PATHS list. New session endpoints must NOT be in PUBLIC_PATHS.

### Existing Frontend Integration Points
- `src/pages/AdminPage.tsx` — User management UI. Session accordion is added here. Read the full file to understand user row structure and existing patterns (delete, TOTP reset).
- `src/pages/SettingsPage.tsx` — Auth settings section. TTL inputs go here. Read for the `updateSettings` / `loadSettings` pattern.
- `src/services/settingsService.ts` — `updateSettings`, `loadSettings`, `resetSettings` — must use these for TTL save/load.

### Settings Layer
- `server/settingsApi.ts` — Lines ~91–100: existing server-side validation for `refreshTokenTtlMs` / `refreshAbsoluteCapMs`. Must remain consistent with client validation (D-08).
- `config/settings.yaml` — Current auth defaults (`refreshTokenTtlMs: 28800000`, `refreshAbsoluteCapMs: 43200000`). TTL UI reads/writes these.

### Requirements
- `.planning/REQUIREMENTS.md` §Session Management + §Session UI — SESS-01, SESSUI-01, SESSUI-02, SESSUI-03 acceptance criteria.

### Conventions
- `CLAUDE.md` — Naming, error handling (throw-only), async/await, i18n pattern.
- `src/i18n/translations.ts` — Add new i18n keys here (DE + EN both required, completeness test enforced).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/sessionsDb.ts:revokeByUsername` — Already implemented for SESS-01. D-12 just needs the endpoint wrapper.
- `server/sessionsDb.ts:revokeSession` — Already implemented for D-11 individual revoke.
- `src/services/authHeaders.ts:authFetch` — Use for all new API calls in AdminPage session panel.
- `src/pages/AdminPage.tsx` — `SortHeader` component, user row pattern, `authFetch` pattern for CRUD — reuse throughout session panel.
- `src/pages/SettingsPage.tsx` — `loadSettings` / `updateSettings` pattern, save/error state — directly reusable for TTL form.
- `server/settingsApi.ts:getAuthSettings()` — Returns `{ refreshTokenTtlMs, refreshAbsoluteCapMs }` with defaults. This is the read path for TTL display.

### Established Patterns
- **Admin-only endpoints**: `requireRole('admin')` middleware used in `/rotate-key` — copy for session endpoints.
- **No confirmation dialogs**: AdminPage deletes users without a modal; session revoke follows same pattern.
- **i18n**: All user-visible strings must be in `translations.ts` with DE+EN entries. Completeness test auto-checks this.
- **No env vars / Result types**: throw-only errors, config via settings.yaml (CLAUDE.md conventions).

### Integration Points
- `server/authApi.ts` — Add `listActiveSessionsByUser` import + 3 new route handlers.
- `server/sessionsDb.ts` — Add `listActiveSessionsByUser(username)` exported function with prepared statement cached in `initSessionsDb`.
- `src/pages/AdminPage.tsx` — Add session accordion UI per user row.
- `src/pages/SettingsPage.tsx` — Add TTL hour inputs in auth section.
- `src/i18n/translations.ts` — Add ~10 new translation keys.

</code_context>

<specifics>
## Specific Ideas

- Phase 27 CONTEXT.md §Deferred explicitly noted: "SESS-01 (force sign-out all sessions for a user) → Phase 28. The sessions table schema supports it (username index + revoked flag) but the endpoint/UI is Phase 28." — This phase delivers that.
- The `revokeByUsername` function in sessionsDb.ts was already added in the current session (as PROT-001 fix) — it's already in the codebase. Phase 28 adds the admin-facing HTTP endpoint wrapper.
- `getAuthSettings()` in `settingsApi.ts` reads TTL values fresh on each call — no cache invalidation needed after a TTL update save.
- Session `key_id` column stores first-8-hex of signing key SHA256. Display as "Key: {key_id}" to give admins a hint about which signing key issued the token (useful post-rotation).

</specifics>

<deferred>
## Deferred Ideas

- **Device fingerprinting (User-Agent)**: Phase 27 CONTEXT noted this is out of v1.10 scope. The `device_hint TEXT` column could be added later; for now `key_id` is the closest proxy.
- **Pagination for session list**: If a user somehow has hundreds of sessions (edge case), the current approach returns all active rows. Pagination deferred — not needed for typical clinical demo usage.
- **Key rotation UI** (`POST /api/auth/rotate-key`): The endpoint exists (Phase 27, D-16) but there is no UI for it. Could be added to SettingsPage. Deferred — not in Phase 28 requirements.
- **Rate-limit remaining timeout display** (USM-006 feedback backlog): Noted in FEEDBACK-TRACKING.md as backlog; not in v1.10 scope.
- **maxLoginAttempts in admin UI** (USM-008 feedback backlog): Noted in FEEDBACK-TRACKING.md; not in v1.10 scope.

</deferred>

---

*Phase: 28-admin-session-control-ui*
*Context gathered: 2026-05-14*
