# Phase 27: Stateful Session Backend - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Introduce server-side persistence for refresh tokens: a stateful sessions table that records every issued refresh token, enables OAuth2-style rotation (old token invalidated immediately on reuse), and supports signing-key rotation. **No UI changes** — all work is in `server/`. Phase 28 builds the admin UI on top of these endpoints.

Requirements in scope: SESS-02, SESS-03, SESS-04.
Requirements explicitly NOT in scope: SESS-01 (force sign-out — Phase 28), SESSUI-* (admin UI — Phase 28).

</domain>

<decisions>
## Implementation Decisions

### Storage

- **D-01:** Sessions table lives in a new dedicated `data/sessions.db` (SQLite via `better-sqlite3`), following the same WAL-mode pattern as `server/auditDb.ts` and `server/dataDb.ts`. A new `server/sessionsDb.ts` module mirrors those modules' structure: `initSessionsDb(dataDir)`, exported CRUD helpers, synchronous API.
- **D-02:** Do NOT add the sessions table to `data.db` or `audit.db`. Separate file keeps concerns isolated (same reasoning as D-07 in dataDb — "separate data.db from audit.db").
- **D-03:** JSON file storage is **rejected** for sessions. Concurrent-write safety (WAL) and indexed revocation scans require SQLite. This is consistent with v1's existing SQLite usage — not a new constraint.

### Schema

- **D-04:** Minimum columns: `id TEXT PRIMARY KEY` (random UUID = jti), `sid TEXT NOT NULL` (session family from `RefreshPayload.sid`), `username TEXT NOT NULL`, `ver INTEGER NOT NULL` (tokenVersion at issuance), `issued_at TEXT NOT NULL`, `expires_at TEXT NOT NULL`, `last_used_at TEXT`, `revoked INTEGER NOT NULL DEFAULT 0`, `key_id TEXT NOT NULL` (identifies which signing key signed this token — enables dual-key window).
- **D-05:** Index on `(sid)` for family revocation; index on `(username)` for user-scoped admin queries (Phase 28); index on `(revoked, expires_at)` for cleanup scans.

### Token Rotation (SESS-03)

- **D-06:** On every `/api/auth/refresh`, after verifying the inbound token:
  1. Look up the token's `jti` in sessions table.
  2. If row doesn't exist or `revoked = 1` → **family revocation**: set `revoked = 1` for all rows WHERE `sid = payload.sid`, return `401 { error: 'token_reused' }`. This is RFC 6819 §5.2.2.3 theft detection.
  3. If row exists and not revoked → mark old row revoked, insert new row, issue new refresh JWT with fresh `jti` (same `sid` preserved — session family identity).
- **D-07:** The `jti` claim is added to `RefreshPayload` (new field). `signRefreshToken` and `verifyRefreshToken` in `server/jwtUtil.ts` are updated accordingly.
- **D-08:** Family revocation (reuse detection) takes priority over version-mismatch check. If `jti` lookup fails first, bail out before checking `tokenVersion`. The existing `tokenVersion` check remains as a second-layer invalidation for explicit logout/password-change events.

### Signing-Key Rotation (SESS-04)

- **D-09:** Key rotation uses a **dual-key window**: new signing key is stored in `data/jwt-secret-next.txt`; rotation endpoint swaps `next` → `current` (renames file). During the window, `verifyRefreshToken` tries current key first, then previous key (stored in `data/jwt-secret-prev.txt`). After all tokens signed with `prev` have expired (max 12h absolute cap), `prev` is deleted.
- **D-10:** `key_id` in the sessions table is a short identifier (e.g. first 8 hex chars of the key file's SHA256) so revocation can be scoped per-key if needed.
- **D-11:** Key rotation is triggered via a new admin endpoint `POST /api/auth/rotate-key` (admin role only). Response includes estimated time until old key is fully retired.
- **D-12:** `getJwtSecret()` in `server/initAuth.ts` is extended (or a new `getJwtSecrets(): { current, prev? }` is added) to support dual-key verification. The ESLint `no-restricted-imports` rule for `jsonwebtoken` stays — all JWT operations remain in `server/jwtUtil.ts`.

### Session Cleanup

- **D-13:** Expired + revoked rows are pruned on startup (after `initSessionsDb`) and every 24 hours via `setInterval`. Same lifecycle pattern as `auditDb`'s 90-day retention purge.
- **D-14:** Cleanup deletes rows WHERE `expires_at < now` OR (`revoked = 1` AND `last_used_at < now - 7 days`). Revoked rows kept briefly for audit trail; hard-expired rows removed immediately.

### API Surface

- **D-15:** The `/api/auth/refresh` handler already exists in `server/authApi.ts`. It is extended in-place (no new route file) to add the jti lookup + rotation logic. The `sessionsDb` module is imported there.
- **D-16:** New endpoint: `POST /api/auth/rotate-key` (admin role required, no CSRF bypass — standard Bearer auth). Returns `{ rotatedAt, prevKeyExpiresBy }`.
- **D-17:** Phase 28 will add `GET /api/auth/sessions` (list sessions per user) and `DELETE /api/auth/sessions/:id` (revoke individual). Those endpoints are **out of scope for Phase 27** but the sessions table schema must support them (username index, per-row revoked flag).

### Backward Compatibility

- **D-18:** On first boot after upgrade, existing refresh cookies (no `jti`) are treated as missing from the sessions table → return `401 token_reused` → clients fall back to re-login. This is acceptable; no migration of existing tokens.
- **D-19:** Existing `tokenVersion` invalidation logic stays unchanged — it still invalidates sessions on logout/password change. The new per-token revocation is an additional layer, not a replacement.

### Claude's Discretion

- Exact filename for the previous key (`jwt-secret-prev.txt` vs `jwt-secret-old.txt`) — use `jwt-secret-prev.txt`.
- Whether `sessionsDb.ts` exports a class or plain functions — follow `auditDb.ts` pattern (plain exported functions, module-level `db` singleton).
- Error messages for `token_reused` response body — keep consistent with existing 401 patterns (e.g., `{ error: 'Refresh token reuse detected' }`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Auth Infrastructure
- `server/jwtUtil.ts` — JWT sign/verify, HS256 pin, RefreshPayload type. D-07 requires adding `jti` field here.
- `server/authApi.ts` — `/api/auth/refresh` implementation (lines ~335–400). D-15/D-06 extend this handler.
- `server/initAuth.ts` — JWT secret loading, UserRecord type, tokenVersion field. D-09/D-12 extend secret management.
- `server/authMiddleware.ts` — PUBLIC_PATHS list. `/api/auth/rotate-key` must NOT be in PUBLIC_PATHS.

### Storage Patterns to Mirror
- `server/auditDb.ts` — Reference implementation for new `server/sessionsDb.ts`. WAL mode, synchronous better-sqlite3, startup purge pattern.
- `server/dataDb.ts` — Secondary reference. Module-level db singleton, initXxxDb(dataDir) pattern.

### Requirements
- `.planning/REQUIREMENTS.md` §Session Management (SESS-02, SESS-03, SESS-04) — acceptance criteria for this phase.
- `.planning/STATE.md` §Accumulated Context — "Phase 27 storage" decision note (now resolved: SQLite).

### Standards
- RFC 6819 §5.2.2.3 — Refresh token reuse / family revocation. This is the authoritative spec for D-06.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/jwtUtil.ts` — `signRefreshToken`, `verifyRefreshToken`: extend (don't replace) to add `jti` to RefreshPayload and support dual-key verification.
- `server/auditDb.ts` — Template for `server/sessionsDb.ts`: copy WAL setup, initXxxDb signature, periodic cleanup pattern.
- `server/initAuth.ts:getJwtSecret()` — Extend to `getJwtSecrets()` returning `{ current: string, prev?: string }` for dual-key window.
- `server/authApi.ts` — `emitRefreshAndCsrfCookies()` helper (line ~91): must pass `jti` to session insert after rotation.

### Established Patterns
- **SQLite via better-sqlite3**: synchronous API, WAL mode, module-level singleton, `initXxxDb(dataDir)` called from `server/index.ts`.
- **JWT HS256**: all operations in `jwtUtil.ts` only; ESLint `no-restricted-imports` enforces this.
- **Error handling**: throw-only (D-03 project convention); no Result types.
- **Config**: all settings from `config/settings.yaml` via `settingsApi.ts`; no new env vars.

### Integration Points
- `server/index.ts` — Add `initSessionsDb(dataDir)` call after existing `initDataDb` / `initAuditDb`.
- `server/authApi.ts` — Extend `/refresh` handler; add `/rotate-key` route.
- `server/jwtUtil.ts` — Add `jti` to `RefreshPayload`; update `signRefreshToken` and `verifyRefreshToken`.
- `server/initAuth.ts` — Extend JWT secret management for dual-key window.

</code_context>

<specifics>
## Specific Ideas

- The `sid` field is already present in `RefreshPayload` and in the comment at authApi.ts line ~382: *"preserving sid lets a stateful upgrade in SESSION-11 do per-session revocation"* — this is exactly Phase 27.
- `data/` directory already has `audit.db`, `data.db` — adding `sessions.db` is consistent.
- The absolute-cap check (`ageMs > settings.refreshAbsoluteCapMs`) should move to use `issued_at` from the sessions table row instead of `payload.iat` — makes it tamper-proof.

</specifics>

<deferred>
## Deferred Ideas

- `GET /api/auth/sessions` and `DELETE /api/auth/sessions/:id` endpoints → Phase 28 (admin session control UI depends on these, but they're Phase 28 scope).
- SESS-01 (force sign-out all sessions for a user) → Phase 28. The sessions table schema supports it (username index + revoked flag) but the endpoint/UI is Phase 28.
- Device fingerprinting (User-Agent hashing stored in sessions table) → out of v1.10 scope; table can add a `device_hint TEXT` column without breaking anything.
- Key rotation webhook / notification → backlog.

</deferred>

---

*Phase: 27-stateful-session-backend*
*Context gathered: 2026-05-11*
