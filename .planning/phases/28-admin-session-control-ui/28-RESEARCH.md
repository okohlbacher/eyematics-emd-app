# Phase 28: Admin Session Control UI — Research

**Researched:** 2026-05-14
**Domain:** Express REST endpoints + React admin UI + settings form integration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Session listing lives as an inline expandable section inside `AdminPage.tsx` (accordion per user row). No new page or route.
- **D-02:** Expanded panel columns: `device` (formatted `key_id`), `Issued`, `Last used`, `Expires`, `Revoke` action button. "Sign out everywhere" button at panel top.
- **D-03:** Only active sessions shown: `revoked = 0 AND expires_at > now`. No dead-row display.
- **D-04:** No confirmation dialog for individual revoke — consistent with AdminPage delete-user UX.
- **D-05:** "Sign out everywhere" uses single `DELETE /api/auth/sessions?username=…` call (`revokeByUsername`). Session list empties on success. Loading state during call.
- **D-06:** TTL inputs live in `SettingsPage.tsx` inside the existing auth settings section, below TOTP block.
- **D-07:** TTL values displayed in **hours** in the UI. Service layer converts: `hours * 3_600_000 = ms` on save, `ms / 3_600_000 = hours` on load.
- **D-08:** Client-side validation: refresh TTL ≥ 1h; absolute cap ≥ refresh TTL. Mirrors server-side validation in `settingsApi.ts` lines ~94–100.
- **D-09:** Save writes immediately via `updateSettings`. No apply-on-next-token spinner — `getAuthSettings()` reads fresh on each call.
- **D-10:** `GET /api/auth/sessions?username=<u>` — admin-only. Returns active `SessionRow[]` for user. New export `listActiveSessionsByUser(username)` in `sessionsDb.ts`.
- **D-11:** `DELETE /api/auth/sessions/:id` — admin-only. Calls `revokeSession(id)`. Returns `{ revoked: true }`. 404 if not found.
- **D-12:** `DELETE /api/auth/sessions?username=<u>` — admin-only (SESS-01). Calls `revokeByUsername(username)`. Returns `{ revoked: number }`.
- **D-13:** All three endpoints live in `server/authApi.ts` (same router as `/rotate-key`). Admin role checked via `req.auth.role !== 'admin'` inline guard (project pattern — no separate middleware).
- **D-14:** Sessions fetched lazily on accordion expand using `authFetch`. Local component state in AdminPage. No DataContext.
- **D-15:** After revoke, re-fetch session list (one GET call). No optimistic removal.

### Claude's Discretion

- Lucide icon for accordion toggle: `ChevronDown`/`ChevronUp`
- Loading spinner: reuse `Loader2` pattern from AdminPage
- i18n key naming: camelCase, e.g. `adminSessions`, `adminRevokeSession`, `adminSignOutEverywhere`, etc.
- Device column format: "Key: {last8 of key_id}"

### Deferred Ideas (OUT OF SCOPE)

- Device fingerprinting (User-Agent / `device_hint` column)
- Pagination for session list
- Key rotation UI (`POST /api/auth/rotate-key` endpoint exists, no UI)
- Rate-limit remaining timeout display (feedback backlog)
- maxLoginAttempts in admin UI (feedback backlog)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SESS-01 | Admin can trigger immediate sign-out of all active sessions for any user | `revokeByUsername` already in sessionsDb.ts; D-12 adds HTTP wrapper |
| SESSUI-01 | Admin can view all active sessions per user (device, issued-at, last-used, expires-at) | D-10 + D-14: lazy GET on accordion expand, new `listActiveSessionsByUser` query |
| SESSUI-02 | Admin can revoke individual sessions from the session listing UI | D-11: DELETE /:id wraps existing `revokeSession(id)` |
| SESSUI-03 | Admin can configure session TTL values from the admin UI (writes to settings.yaml) | D-06 through D-09: TTL inputs on SettingsPage, `updateSettings` + ms↔hours conversion |
</phase_requirements>

---

## Summary

Phase 28 has no new data-model work — Phase 27 already provides the `refresh_sessions` table, all mutation helpers (`revokeSession`, `revokeFamily`, `revokeByUsername`), and the `SessionRow` type. The phase consists of three thin wires:

1. **Backend**: Add `listActiveSessionsByUser(username)` to `sessionsDb.ts` (one new prepared statement), then add three route handlers to `authApi.ts` (GET sessions, DELETE session by id, DELETE all sessions for user). The admin guard pattern is a simple inline `req.auth.role !== 'admin'` check — no separate middleware is used (observed in `/rotate-key`, TOTP reset, user CRUD).

2. **AdminPage accordion**: Per-user expandable session panel with lazy fetch, session table, "Revoke" per row, and "Sign out everywhere" button. The existing table already has 7 columns (`colSpan={7}`) — adding a "Sessions" toggle column makes it 8.

3. **SettingsPage TTL inputs**: Two number inputs (hours) appended inside the existing 2FA card. Uses the same `handleSave` / `updateSettings` flow already wired for therapy thresholds. The `AppSettings` type needs an `auth` sub-object field added to carry `refreshTokenTtlMs` and `refreshAbsoluteCapMs`.

**Primary recommendation:** Implement in three sequential tasks: (1) sessionsDb + authApi backend, (2) AdminPage accordion UI, (3) SettingsPage TTL form + i18n. Each task is independently testable.

---

## Standard Stack

### Core (all already in project)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| better-sqlite3 | project dep | Synchronous SQLite for sessionsDb | Prepared-statement caching pattern already established |
| express Router | project dep | Three new route handlers in authApi.ts | Same router instance (`authApiRouter`) |
| React (useState, useCallback, useEffect) | project dep | Local accordion state in AdminPage | No new hooks needed |
| lucide-react | project dep | ChevronDown/ChevronUp, LogOut, Key, Loader2, Clock | All needed icons already available |
| Tailwind CSS v4 | project dep | All styling via existing utility classes | CSS-first config, `dark:` variants required everywhere |
| js-yaml (frontend) | project dep | `updateSettings` converts AppSettings to YAML for PUT /api/settings | No change to flow |

**No new dependencies.** This phase only wires existing infrastructure.

---

## Architecture Patterns

### Backend: New sessionsDb export

```typescript
// VERIFIED by reading server/sessionsDb.ts — follow this exact caching pattern
let stmtListActiveByUsername: Database.Statement | null = null;

// In initSessionsDb(), cache alongside existing stmts:
stmtListActiveByUsername = db.prepare(`
  SELECT * FROM refresh_sessions
  WHERE username = @username
    AND revoked = 0
    AND datetime(expires_at) > datetime('now')
  ORDER BY issued_at DESC
`);

export function listActiveSessionsByUser(username: string): SessionRow[] {
  requireDb();
  return stmtListActiveByUsername!.all({ username }) as SessionRow[];
}
```

**Critical:** The new statement variable must also be nulled out in `_closeForTests()`. The current line is:
```typescript
stmtInsert = stmtGet = stmtRevoke = stmtRevokeFamily = stmtPurge = null;
```
This omits `stmtRevokeByUsername` too — add both new and existing omissions to the chain. [VERIFIED: server/sessionsDb.ts line 233]

### Backend: New authApi.ts route handlers (pattern from /rotate-key)

```typescript
// GET /api/auth/sessions?username=<u>  (SESSUI-01, D-10)
authApiRouter.get('/sessions', (req: Request, res: Response): void => {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  const username = String(req.query.username ?? '').trim();
  if (!username) { res.status(400).json({ error: 'username required' }); return; }
  const sessions = listActiveSessionsByUser(username);
  res.json({ sessions });
});

// DELETE /api/auth/sessions/:id  (SESSUI-02, D-11)
authApiRouter.delete('/sessions/:id', (req: Request, res: Response): void => {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' }); return;
  }
  const id = String(req.params.id ?? '');
  const row = getSession(id);
  if (!row) { res.status(404).json({ error: 'Session not found' }); return; }
  revokeSession(id);
  res.json({ revoked: true });
});

// DELETE /api/auth/sessions?username=<u>  (SESS-01, D-12)
authApiRouter.delete('/sessions', (req: Request, res: Response): void => {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' }); return;
  }
  const username = String(req.query.username ?? '').trim();
  if (!username) { res.status(400).json({ error: 'username required' }); return; }
  const count = revokeByUsername(username);
  res.json({ revoked: count });
});
```

**Route ordering matters:** Express matches routes in registration order. `DELETE /sessions` (query-param variant) and `DELETE /sessions/:id` (path param variant) must be registered so the plain `/sessions` handler does not swallow `:id` requests. Registering the `:id` handler first is safest since Express matches path params before query params. [ASSUMED — standard Express routing behavior]

**PUBLIC_PATHS guard:** `/api/auth/sessions` must NOT be added to PUBLIC_PATHS in `authMiddleware.ts`. The current list is: `['/api/auth/login', '/api/auth/verify', '/api/auth/config', '/api/auth/refresh']`. New session endpoints must stay auth-protected. [VERIFIED: server/authMiddleware.ts line 50]

### Frontend: AdminPage accordion state

The existing component uses a single `editUsername: string | null` for one-at-a-time inline edit. The session accordion needs the same single-open-at-a-time behavior (D-01 + UI-SPEC interaction contract). Use a single `expandedSessionUser: string | null` state variable — setting to a username opens that user's accordion and closes all others.

Per-user fetch result needs local state. Use a `Record<string, SessionRow[]>` map keyed by username, plus a loading/error state per user. This avoids re-fetching on collapse/re-expand when the data is fresh.

```typescript
// State additions to AdminPage
const [expandedSessionUser, setExpandedSessionUser] = useState<string | null>(null);
const [sessionMap, setSessionMap] = useState<Record<string, SessionRow[]>>({});
const [sessionLoading, setSessionLoading] = useState<Record<string, boolean>>({});
const [sessionError, setSessionError] = useState<Record<string, string | null>>({});
const [signingOutUser, setSigningOutUser] = useState<string | null>(null);
```

`SessionRow` type must be imported from `server/sessionsDb.ts` — this is a shared type across the boundary. It currently lives only in `server/sessionsDb.ts`. Since the frontend needs it, either:
- Duplicate the interface inline in AdminPage (simple, no shared/ dependency), or
- Move it to `shared/` (consistent with D-01 cross-boundary helpers rule from CLAUDE.md)

**Recommendation:** Add a `shared/sessionTypes.ts` re-export so both server and frontend can use the same type without duplicating. This aligns with `D-01: Cross-boundary helpers live in shared/`. [ASSUMED — need to verify if `shared/` already has a pattern for type re-exports]

### Frontend: SettingsPage TTL integration

`AppSettings` in `src/services/settingsService.ts` does not currently include an `auth` sub-object. [VERIFIED: settingsService.ts lines 5-17] The TTL values must be added:

```typescript
// Add to AppSettings interface in settingsService.ts
auth?: {
  refreshTokenTtlMs?: number;
  refreshAbsoluteCapMs?: number;
};
```

Load path: `loadSettings()` already fetches and parses all of `settings.yaml` via `GET /api/settings`. The `auth.*` fields will be present in the parsed YAML (they're in `config/settings.yaml`). The `merge()` function will propagate them. [VERIFIED: settingsService.ts line 60-73, config/settings.yaml lines 12-13]

Save path: `updateSettings({ auth: { refreshTokenTtlMs: hours * 3_600_000, refreshAbsoluteCapMs: capHours * 3_600_000 } })` — the service merges and calls `persistSettings` which serializes the full `AppSettings` object to YAML and PUTs to `/api/settings`. [VERIFIED: settingsService.ts line 86-96]

**Key constraint:** `persistSettings` serializes the entire `_cached` object. If `auth` is not in `AppSettings` and `DEFAULTS`, the TTL values will be dropped on the next `resetSettings()` call. The `DEFAULTS` constant must also include `auth` defaults.

TTL form state pattern (mirrors therapy thresholds pattern):

```typescript
// State additions to SettingsPage
const [refreshTtlHours, setRefreshTtlHours] = useState(8);   // default 28800000 / 3600000
const [absoluteCapHours, setAbsoluteCapHours] = useState(12); // default 43200000 / 3600000
const [ttlValidationError, setTtlValidationError] = useState<string | null>(null);
```

Load in the existing `useEffect`: parse `s.auth?.refreshTokenTtlMs` and `s.auth?.refreshAbsoluteCapMs` from loaded settings, convert to hours, set state.

The TTL save can be wired into the existing `handleSave` function (shared Save button) or a dedicated "Save TTL" button. The UI-SPEC (Component 3) indicates a dedicated save button if the page does not have a global save for this section. Looking at the actual SettingsPage, the "Therapy Discontinuation" section has its own Save button that calls `updateSettings` — the TTL section should follow the same pattern with its own Save button rather than sharing the therapy save. [VERIFIED: SettingsPage.tsx lines 143-163]

### i18n Pattern

The project uses a flat `translations` object where each key has `{ de: string, en: string }`. There is no namespace-based enforcement test for `admin*` keys, but the `outcomesI18n.test.ts` test pattern shows how such a test could be written if needed. The TypeScript type `TranslationKey` is derived from `keyof typeof translations`, which means adding keys to `translations` automatically makes them valid. [VERIFIED: translations.ts line 1-3, outcomesI18n.test.ts]

All 19 new keys from the UI-SPEC copywriting contract must be added. The `retry` key already exists (`{ de: 'Erneut versuchen', en: 'Retry' }`). [VERIFIED: translations.ts line 14]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session query filtering | Custom in-memory filter | SQLite prepared statement with `revoked=0 AND expires_at > datetime('now')` | Atomic, indexed, no race with cleanup interval |
| Auth guard on new endpoints | New middleware | Inline `req.auth.role !== 'admin'` check (established pattern) | Consistency — every existing admin endpoint uses this pattern |
| Hours↔ms conversion | Custom utility | Inline arithmetic at call site: `* 3_600_000` / `/ 3_600_000` | Two usages, no abstraction needed |
| Settings persistence | Custom YAML write | `updateSettings(patch)` from settingsService.ts | Already handles merge, error recovery, cache invalidation |

---

## Common Pitfalls

### Pitfall 1: Route ambiguity — DELETE /sessions vs DELETE /sessions/:id

**What goes wrong:** If `DELETE /sessions` is registered before `DELETE /sessions/:id`, Express may match `DELETE /sessions/some-uuid` to the first handler (treating `some-uuid` as a query param if no trailing segment matches).

**Why it happens:** Express route matching is order-dependent. The `/sessions` route without `:id` only matches exactly `/sessions`; the `:id` route matches `/sessions/anything`. In practice, Express route segments don't overlap, but explicit ordering eliminates ambiguity.

**How to avoid:** Register `DELETE /sessions/:id` before `DELETE /sessions`. Verify with a test that sends `DELETE /api/auth/sessions/some-uuid` and confirms it hits the `:id` handler.

**Warning signs:** Revoke-individual returns 400 "username required" instead of revoking.

### Pitfall 2: `_closeForTests` not nulling new prepared statement

**What goes wrong:** After `_closeForTests()`, if `stmtListActiveByUsername` is not nulled, a subsequent `initSessionsDb()` in a new test creates a new db but the old statement still points to the closed database. Calling it throws "Database is not open".

**Why it happens:** The existing `_closeForTests` line `stmtInsert = stmtGet = stmtRevoke = stmtRevokeFamily = stmtPurge = null` already omits `stmtRevokeByUsername` (a pre-existing gap). Phase 28 adds a second statement that will have the same issue if not included.

**How to avoid:** Add both `stmtRevokeByUsername` and `stmtListActiveByUsername` to the null-chain in `_closeForTests`.

### Pitfall 3: AppSettings type omission losing TTL on resetSettings

**What goes wrong:** `resetSettings()` serializes `{ ...DEFAULTS }` — if `DEFAULTS` doesn't include `auth.refreshTokenTtlMs` and `auth.refreshAbsoluteCapMs`, calling Reset from SettingsPage will write a settings.yaml without those keys, reverting to Phase 27 defaults (which come from `AUTH_DEFAULTS` in `settingsApi.ts`). No error is thrown; the values silently revert.

**Why it happens:** `updateSettings` merges into `_cached`, but `resetSettings` replaces `_cached` with `DEFAULTS` before persisting.

**How to avoid:** Add `auth: { refreshTokenTtlMs: 28_800_000, refreshAbsoluteCapMs: 43_200_000 }` to the `DEFAULTS` constant in `settingsService.ts`.

### Pitfall 4: colSpan mismatch breaks session accordion row

**What goes wrong:** The session accordion renders as a `<tr>` with a single `<td colSpan={N}>` that spans all columns. If N doesn't match the actual column count, the row renders misaligned or truncated.

**Why it happens:** AdminPage currently has 7 columns (`colSpan={7}` for loading/error rows). Adding a "Sessions" toggle column makes it 8 columns. The accordion `<td>` must use `colSpan={8}`.

**How to avoid:** Count all `<th>` elements in the `<thead>` after adding the Sessions column header and use that count for the accordion `<td colSpan>`.

### Pitfall 5: i18n completeness test failure

**What goes wrong:** Tests like `outcomesI18n.test.ts` and the TypeScript type `TranslationKey` will catch missing keys. If a `t('adminSessions')` reference is added to the TSX before the key is added to `translations.ts`, TypeScript will fail to compile (key not in `TranslationKey`).

**Why it happens:** `TranslationKey = keyof typeof translations` — the type is derived from the translations object at compile time.

**How to avoid:** Add all i18n keys to `translations.ts` in the same task as the component code that uses them.

### Pitfall 6: Sessions endpoint added to PUBLIC_PATHS by mistake

**What goes wrong:** Any path in `PUBLIC_PATHS` bypasses JWT verification. Adding `/api/auth/sessions` there would expose all user session data without authentication.

**How to avoid:** Never add `/api/auth/sessions*` to `PUBLIC_PATHS`. The new endpoints rely on `req.auth` being populated, which only happens for non-public paths.

---

## Code Examples

### Accordion toggle button (per AdminPage pattern)

```tsx
// Source: AdminPage.tsx pattern — session toggle button in actions cell
<button
  onClick={() => setExpandedSessionUser(
    expandedSessionUser === u.username ? null : u.username
  )}
  className="text-gray-400 hover:text-blue-600 inline-flex items-center gap-1"
  aria-expanded={expandedSessionUser === u.username}
  title={t('adminSessions')}
>
  {expandedSessionUser === u.username
    ? <ChevronUp className="w-4 h-4 text-blue-600" />
    : <ChevronDown className="w-4 h-4" />}
</button>
```

### Accordion expanded row (inline after user row)

```tsx
// Spans all 8 columns (7 original + 1 sessions toggle column)
{expandedSessionUser === u.username && (
  <tr key={`${u.username}-sessions`}>
    <td colSpan={8} className="pb-3 bg-indigo-50/30 dark:bg-indigo-900/10">
      {/* session panel content */}
    </td>
  </tr>
)}
```

### Fetch sessions on expand

```tsx
const fetchSessions = useCallback(async (username: string) => {
  setSessionLoading((prev) => ({ ...prev, [username]: true }));
  setSessionError((prev) => ({ ...prev, [username]: null }));
  try {
    const resp = await authFetch(
      `/api/auth/sessions?username=${encodeURIComponent(username)}`
    );
    if (!resp.ok) throw new Error(`${resp.status}`);
    const data = await resp.json() as { sessions: SessionRow[] };
    setSessionMap((prev) => ({ ...prev, [username]: data.sessions }));
  } catch (err) {
    setSessionError((prev) => ({
      ...prev,
      [username]: err instanceof Error ? err.message : 'error',
    }));
  } finally {
    setSessionLoading((prev) => ({ ...prev, [username]: false }));
  }
}, []);
```

### TTL load in useEffect (SettingsPage)

```typescript
// In loadSettings() result handling — add to existing useEffect
const msPerHour = 3_600_000;
setRefreshTtlHours(Math.round((s.auth?.refreshTokenTtlMs ?? 28_800_000) / msPerHour));
setAbsoluteCapHours(Math.round((s.auth?.refreshAbsoluteCapMs ?? 43_200_000) / msPerHour));
```

### TTL save patch

```typescript
await updateSettings({
  auth: {
    refreshTokenTtlMs: refreshTtlHours * 3_600_000,
    refreshAbsoluteCapMs: absoluteCapHours * 3_600_000,
  },
});
```

### Validation (client-side, D-08)

```typescript
function validateTtl(refreshH: number, capH: number): string | null {
  if (!Number.isInteger(refreshH) || refreshH < 1) return t('ttlValidationRefreshMin');
  if (!Number.isInteger(capH) || capH < refreshH) return t('ttlValidationCapMin');
  return null;
}
```

---

## Runtime State Inventory

> Phase 28 is not a rename/refactor phase. No runtime state inventory required.

---

## Environment Availability

> Step 2.6: SKIPPED — Phase 28 is code/config only. All dependencies (Node.js, better-sqlite3, Express, React, Tailwind) are already in use by the running project. No new external services or CLI tools are required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run tests/sessionsDb.test.ts tests/settingsApi.test.ts` |
| Full suite command | `npm run test:ci` (619 baseline tests must remain passing) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SESS-01 | `DELETE /api/auth/sessions?username=u` revokes all sessions | integration | `npx vitest run tests/sessionRevoke.test.ts` | ❌ Wave 0 |
| SESSUI-01 | `GET /api/auth/sessions?username=u` returns active rows only | integration | `npx vitest run tests/sessionRevoke.test.ts` | ❌ Wave 0 |
| SESSUI-02 | `DELETE /api/auth/sessions/:id` revokes individual session | integration | `npx vitest run tests/sessionRevoke.test.ts` | ❌ Wave 0 |
| SESSUI-03 | TTL hours↔ms conversion round-trips correctly | unit | `npx vitest run tests/ttlConversion.test.ts` | ❌ Wave 0 |
| SESSUI-03 | Settings persist/load preserves `auth.*` sub-object | integration | existing `tests/settingsApi.test.ts` | ✅ extend |
| i18n | All new `admin*`/`session*`/`ttl*` keys have de+en | unit | `npx vitest run tests/outcomesI18n.test.ts` or new test | extend |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/sessionsDb.test.ts tests/settingsApi.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** `npm run test:ci` green (619+ tests passing) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/sessionRevoke.test.ts` — covers SESS-01, SESSUI-01, SESSUI-02 endpoint behavior (admin-only guard, 403 for non-admin, correct response shapes, 404 for missing id)
- [ ] `tests/ttlConversion.test.ts` — covers D-07 hours↔ms conversion, client-side validation logic (refresh ≥ 1h, cap ≥ refresh)
- [ ] Consider extending `tests/outcomesI18n.test.ts` or adding a dedicated `tests/adminSessionsI18n.test.ts` that checks all 19 new keys have both de + en entries

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing JWT Bearer verification via `authMiddleware.ts` |
| V3 Session Management | yes (core of this phase) | Admin-only guard on all three session endpoints; server-side revocation |
| V4 Access Control | yes | `req.auth.role !== 'admin'` inline guard on every new endpoint |
| V5 Input Validation | yes | `username` query param validated non-empty; `:id` path param passed to prepared statement (no SQL injection surface) |
| V6 Cryptography | no | No new crypto; existing JWT verification unchanged |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Non-admin reads another user's sessions | Elevation of Privilege | `req.auth.role !== 'admin'` guard — 403 response |
| Session ID enumeration via GET | Information Disclosure | Admin-only endpoint; sessions are UUIDs (jti), not sequential |
| CSRF on DELETE revoke | Tampering | Existing `requireCsrf` middleware applies to mutation endpoints — verify it is NOT excluded for new DELETE routes |
| TTL set to 0 or negative | Tampering | Server-side validation in `settingsApi.ts` lines 93-96 rejects non-positive integers |
| Admin revokes their own active session | Denial of Service (self) | No guard needed — admin can recover by re-logging in; out of scope |

**CSRF note:** The existing auth routes use `requireCsrf` selectively (e.g., `/logout`, `/refresh` have it; `/rotate-key` does not). The three new session management endpoints are admin-only Bearer-token routes. Verify whether `requireCsrf` should be applied. The existing admin user-CRUD endpoints (`DELETE /users/:username`, `POST /users`) do NOT use `requireCsrf` — they rely on Bearer token only. The new session endpoints should follow the same pattern (Bearer only, no CSRF cookie required). [VERIFIED: authApi.ts — DELETE /users/:username at line 614 has no requireCsrf]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `SessionRow` type should be moved to `shared/` for frontend consumption | Architecture Patterns | Low — inline type duplication is a safe fallback |
| A2 | Express route ordering: register `:id` before query-param variant for DELETE | Architecture Patterns | Medium — incorrect routing produces confusing 400 errors |
| A3 | New DELETE session endpoints should NOT use `requireCsrf` (consistent with existing admin CRUD) | Security Domain | Low — Bearer-only auth is the established pattern for admin endpoints |
| A4 | `stmtRevokeByUsername` gap in `_closeForTests` is benign in existing tests (tests don't call `revokeByUsername` after close) | Common Pitfalls | Low — gap exists but no test currently triggers it |

---

## Open Questions

1. **SessionRow type sharing**
   - What we know: `SessionRow` is defined only in `server/sessionsDb.ts`. The frontend AdminPage will need it for type safety.
   - What's unclear: Whether the project convention is to duplicate simple interfaces inline in the frontend or always go through `shared/`.
   - Recommendation: Check `shared/` for precedents. If no interface re-exports exist there, duplicate inline in AdminPage with a `// mirrors server/sessionsDb.ts SessionRow` comment.

2. **`AppSettings` includes `auth.*` or sends it separately**
   - What we know: `settingsService.ts` `AppSettings` does not have an `auth` field. `persistSettings` serializes the full `_cached` object.
   - What's unclear: Whether adding `auth` to `AppSettings` and `DEFAULTS` might accidentally overwrite `auth.refreshCookieSecure` or other auth sub-fields that should not be in client control.
   - Recommendation: Include only `refreshTokenTtlMs` and `refreshAbsoluteCapMs` in the `AppSettings.auth` sub-object. The `refreshCookieSecure` field is a deployment concern, not admin-UI-configurable.

---

## Sources

### Primary (HIGH confidence — verified by reading source files)

- `server/sessionsDb.ts` — SessionRow type, all exports, prepared-statement caching pattern, `_closeForTests` gap
- `server/authApi.ts` — admin endpoint pattern (`/rotate-key`, user CRUD), inline role guard, requireCsrf usage
- `server/authMiddleware.ts` — PUBLIC_PATHS list (verified new endpoints not in it)
- `server/settingsApi.ts` lines 88-106 — existing server-side validation for `auth.refreshTokenTtlMs` / `refreshAbsoluteCapMs`
- `src/pages/AdminPage.tsx` — full component: column count (7), state patterns, authFetch usage, action button styles
- `src/pages/SettingsPage.tsx` — full component: handleSave/handleReset pattern, savedBanner, saveError, Loader2 usage
- `src/services/settingsService.ts` — AppSettings interface, DEFAULTS, updateSettings, persistSettings
- `src/i18n/translations.ts` — TranslationKey derivation, existing `retry` key confirmed
- `config/settings.yaml` — confirmed `auth.refreshTokenTtlMs: 28800000`, `auth.refreshAbsoluteCapMs: 43200000`
- `tests/sessionsDb.test.ts` — test infrastructure pattern (tmpdir, makeRow, beforeEach/afterEach)
- `tests/outcomesI18n.test.ts` — i18n completeness test pattern

### Metadata

**Confidence breakdown:**
- Backend endpoints: HIGH — all dependencies verified, pattern directly observed in authApi.ts
- sessionsDb extension: HIGH — prepared-statement pattern directly observed
- AdminPage accordion: HIGH — existing state patterns verified, column count verified
- SettingsPage TTL form: HIGH — AppSettings gap identified and fix is clear
- i18n: HIGH — TranslationKey mechanism verified, all 19 keys enumerated in UI-SPEC

**Research date:** 2026-05-14
**Valid until:** 2026-06-14 (stable codebase, no fast-moving external deps)
