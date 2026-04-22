# Architecture — v1.8 Session Resilience & Test/Code Polish

## Scope

Integration analysis for three v1.8 features on the existing EMD stack:
1. JWT refresh flow
2. AuditPage useReducer refactor
3. metricSelector integration tests

---

## 1. JWT Refresh Flow

### Current state

- **Token issuance** — `server/authApi.ts`:
  - `signSessionToken()` L60–68 — HS256, 10m, `{ sub, preferred_username, role, centers }`
  - Called from `/api/auth/login` no-2FA path (L171) and `/api/auth/verify` 2FA path (L285)
  - `signChallengeToken()` L85–91 — 2m `purpose: 'challenge'` token, used only for the 2FA step
- **Token verification** — `server/authMiddleware.ts`:
  - `verifyLocalToken()` L57–69 — HS256, rejects `purpose==='challenge'` (T-02-02)
  - `PUBLIC_PATHS` allowlist L47: `/api/auth/login`, `/api/auth/verify`, `/api/auth/config`
  - Branches at L166 on provider (local HS256 vs Keycloak RS256)
- **Frontend storage** — `src/context/AuthContext.tsx`:
  - `sessionStorage.getItem('emd-token')` (L107, L198, L224)
  - `INACTIVITY_TIMEOUT = 10m` L63 — client-side idle logout + 1m warning
  - `performLogout()` L139–146 clears sessionStorage + invalidates bundle cache
- **Global 401 interceptor** — `src/services/authHeaders.ts`:
  - `authFetch()` L18–31 — on 401 clears token + redirects to `/login`
  - Single choke point used by all authenticated API calls (Phase 1.1 consolidation)

### Insertion points

**Server:**

1. **New `purpose: 'refresh'` token.** Mirror the `challenge` pattern:
   ```
   signSessionToken(...)        → session JWT, 10m
   signRefreshToken(username)   → refresh JWT, e.g. 8h, { sub, purpose:'refresh', jti, absExp, tokenVersion }
   ```
2. **New endpoint `POST /api/auth/refresh`** in `authApi.ts` below `/verify` (L288). Add to `PUBLIC_PATHS` L47 (refresh token authorizes itself, like login/verify). Handler:
   - Verify Bearer refresh token, require `purpose==='refresh'`
   - Look up user (centers/role may have changed since last login)
   - Enforce `absExp` absolute session cap
   - Check `tokenVersion` matches user record
   - Optionally check revocation (jti denylist; Pitfalls P-C1 recommends rotation)
   - Issue new session token; rotate refresh token (sliding)
3. **Symmetric guard in `verifyLocalToken()` L60–63** — reject `purpose==='refresh'` on protected routes; refresh handler rejects anything other than `purpose==='refresh'`.
4. **Response shape additive** — `/login` and `/verify` return `{ token, refreshToken }`.

### 2FA interaction

- Refresh must NOT re-trigger 2FA — refresh token is the browser-possession factor for the session window.
- Per-user TOTP check remains at `/login`→`/verify`; `absExp` cap forces periodic full re-auth with TOTP.
- Defaults: refresh TTL **8h**, absolute cap **12h**, session token **10m** (unchanged).
- **Credential-mutation invalidation:** add `tokenVersion` (int) to `UserRecord` in `users.json`; embed in refresh claims; bump on password change, TOTP enable/disable, admin TOTP reset (`POST /api/auth/users/:username/totp/reset` L689), admin user update. Refresh rejects if `claim.tokenVersion !== user.tokenVersion`. (Pitfalls P-C6 — critical.)

### Audit middleware interaction

- `auditMiddleware` auto-logs all `/api/*` including refresh — no logic change.
- **Add `/api/auth/refresh` to `REDACT_PATHS`** in `server/auditMiddleware.ts` L35–42; extend `REDACT_FIELDS` L73 with `refreshToken`.
- **Audit volume risk** (Pitfalls P-C4): with 10m access + 8h refresh, ~6 refresh events/user/hr. Add refresh path to `SKIP_AUDIT_PATHS` (or keep at low-detail level) to prevent flood drowning compliance signal.
- `describeAction` in `src/pages/AuditPage.tsx` L29–54 gets new entry `POST /api/auth/refresh` → `audit_action_refresh` (new i18n key DE+EN).

### Frontend silent-refresh pattern

`authFetch()` extension — it is the **single choke point**:

```
authFetch():
  1. Attach Bearer session token, fetch
  2. If 401 AND refresh token present AND not already retried:
       a. Acquire single-flight refresh lock (module-level Promise)
       b. POST /api/auth/refresh
       c. On success → store new session token, retry original request ONCE
       d. On failure → clear both tokens, redirect /login
  3. If 401 on retry or no refresh token → existing clear+redirect
```

Critical:
- **Single-flight lock** — `let refreshPromise: Promise<string> | null` at module scope
- **Retry guard** — prevent infinite loop if new token also rejected
- **Refresh token storage** — sessionStorage (same threat model as session token) **OR** httpOnly cookie per Pitfalls P-C2 recommendation. Decision required in requirements.
- **AuthContext unchanged** — refresh dance stays in `authHeaders.ts`; AuthContext exposes a `performLogout` callback for refresh failure
- **Inactivity timer stays** — `AuthContext.tsx` L63 10m idle-logout is orthogonal to token expiry; active users don't hit it

---

## 2. AuditPage useReducer Refactor

### Current state shape (`src/pages/AuditPage.tsx`)

9 `useState` hooks:

| Hook | Line | Type |
|------|------|------|
| `entries` | 91 | `ServerAuditEntry[]` |
| `total` | 92 | `number` |
| `loading` | 93 | `boolean` |
| `error` | 94 | `string \| null` |
| `filterUser` | 97 | `string` |
| `filterCategory` | 98 | union |
| `filterFrom` | 99 | date string |
| `filterTo` | 100 | date string |
| `filterSearch` | 101 | `string` |
| `filterFailures` | 102 | `boolean` |

Derived memos: `distinctUsers` L108, `filteredEntries` L141. Debounced fetch: `useEffect` L114, 300ms, uses `cancelled` closure flag — replace with reducer-visible epoch.

### Proposed reducer

**State:**
```ts
interface AuditPageState {
  data: { entries: ServerAuditEntry[]; total: number };
  status: 'idle' | 'loading' | 'error' | 'success';
  error: string | null;
  filters: { user; category; from; to; search; failuresOnly };
  requestEpoch: number;
}
```

**Actions:**
- `FILTER_SET { key, value }`
- `FILTERS_RESET`
- `FETCH_START` — bumps `requestEpoch`, sets `status='loading'`
- `FETCH_SUCCESS { epoch, data }` — drop if `epoch !== state.requestEpoch`
- `FETCH_ERROR { epoch, error }` — drop if stale

Epoch guard encodes the current `cancelled` flag into reducer state; fixes the race cleanly.

**File structure:**
```
src/pages/audit/
  auditPageState.ts     (reducer, actions, selectors, initial state)
  auditFormatters.ts    (describeAction, describeDetail, isRelevantEntry, statusBadgeClass)
  useAuditData.ts       (useReducer + debounced fetch effect)
AuditPage.tsx           (pure JSX + useAuditData() + selectors)
tests/auditPageReducer.test.ts  (pure reducer unit tests)
```

**No API changes.** Pure frontend. Characterization tests first (Pitfalls P-H2).

### Deep-link check

Pitfalls P-H3 flags risk that AuditPage has undiscovered `useSearchParams` deep-link. Grep check during requirements: if present, reducer state must sync bidirectionally with URL params.

---

## 3. metricSelector Integration Tests

### Existing router harness pattern

**Reference:** `tests/OutcomesViewRouting.test.tsx` (AGG-03 suite). Passes today. Uses MemoryRouter + Routes + Route and mocks every non-router dependency.

**Established mock set** (L38–109):
```
vi.mock('../src/context/DataContext',       ...)
vi.mock('../src/context/LanguageContext',   ...)
vi.mock('../src/services/fhirLoader',       ...)
vi.mock('../src/services/settingsService',  ...)
vi.mock('../src/services/outcomesAggregateService', ...)
vi.mock('../src/utils/cohortTrajectory',    ...)
vi.mock('recharts',                         ...)   // bypass ResizeObserver
```

`renderView` helper L156–197 wraps MemoryRouter + Routes + `path="/analysis"`, seeds `useData`, installs fetch spy for audit beacon.

### Why current tests skip

`tests/metricSelector.test.tsx` L6–67 mounts `OutcomesView` in bare MemoryRouter with **no context mocks** — `useData()` returns undefined → crash, Recharts triggers jsdom ResizeObserver, `loadSettings` hits real fetch.

### Wire-up — two options

**Option A (preferred): shared helper** `tests/helpers/renderOutcomesView.tsx` exporting `renderOutcomesView(url, options)` with the 7 mock blocks at module scope. Both `OutcomesViewRouting.test.tsx` and `metricSelector.test.tsx` import from it.

**Option B (minimal diff):** copy the 7 `vi.mock` blocks verbatim into `metricSelector.test.tsx`, drop `describe.skip`.

**Assertion compatibility:** existing skipped assertions use regex `/Visus/i`. With `t: (k) => k` mock, label renders as `metricsVisus` — `/Visus/i` still matches. `/^CRT$/i` won't match `metricsCRT` — widen to `/CRT/i`. Verify during wiring.

**Missing coverage to add** (Pitfalls P-H5 + Features):
- Deep-link `?metric=X` round-trip
- Tab click updates URL
- Browser back/forward navigation
- Unknown metric fallback (`?metric=bogus` → default metric)
- Keyboard arrow-key tab cycling (handler at `OutcomesView.tsx` L211–219)

---

## Integration Points Summary

| Feature | Files modified | Files created | New routes | New components |
|---------|---------------|---------------|------------|----------------|
| JWT refresh | `server/authApi.ts`, `server/authMiddleware.ts`, `server/auditMiddleware.ts`, `server/initAuth.ts` (tokenVersion field), `src/context/AuthContext.tsx`, `src/services/authHeaders.ts`, `src/pages/AuditPage.tsx` (describeAction + i18n) | — | `POST /api/auth/refresh` | — |
| AuditPage reducer | `src/pages/AuditPage.tsx` (rewrite) | `src/pages/audit/auditPageState.ts`, `audit/auditFormatters.ts`, `audit/useAuditData.ts`, `tests/auditPageReducer.test.ts` | — | — |
| metricSelector tests | `tests/metricSelector.test.tsx` (unskip + mocks) | `tests/helpers/renderOutcomesView.tsx` (Option A) | — | — |

## Data flow change (refresh only)

```
Before: Login → {token}                  → authFetch → 401 → /login redirect
After:  Login → {token, refreshToken}    → authFetch → 401 → POST /refresh
                                                      → {token[,refreshToken]} → retry
                                                      → 401 on refresh → clear both → /login redirect
```

Additive server change: one route, one `purpose` value, one `tokenVersion` field in `users.json` (missing → 0 for backward compat).

---

## Suggested Build Order

1. **Phase A — metricSelector Test Harness Unblock (F3)** — tests only, no runtime code. Extracts `renderOutcomesView` helper. Unblocks future integration tests for AuthContext refresh behavior. ~0.5 day.
2. **Phase B — AuditPage State Machine (F2)** — pure frontend refactor. Independent. Characterization tests → reducer + selector extraction → pure-render page. No API. ~1 day.
3. **Phase C — JWT Refresh Flow (F1)** — server + frontend + audit. Largest surface. Lands last so `describeAction` i18n change applies to the refactored AuditPage (avoids B/C merge conflict on AuditPage.tsx). ~2–3 days.

**Dependency constraints verified:**
- F3 is independent of F1 and F2.
- F1 touches AuditPage.tsx (describeAction append) → must come after F2 or coordinate.
- F2 is unaffected by F1.
- A → B → C satisfies all constraints with zero cross-phase rework.

## Phase Numbering

v1.7 ended at Phase 17. v1.8 continues at **Phase 18** (per default numbering; no `--reset-phase-numbers`).

- Phase 18 — metricSelector Test Harness Unblock
- Phase 19 — AuditPage State Machine
- Phase 20 — JWT Refresh Flow

## Open Questions

- Refresh token rotation (sliding) vs fixed-until-cap — Pitfalls P-C1 recommends rotation (OWASP standard). Decision required in requirements.
- Absolute session cap value (8h? 12h?) — policy call for clinical workstation context; should be `settings.yaml` key (`auth.refreshAbsoluteCapMs`, `auth.refreshTokenTtlMs`).
- Refresh token delivery: sessionStorage (simplest, same threat model as access token) vs httpOnly cookie (Pitfalls P-C2 recommendation, but adds `cookie-parser` + CSRF plumbing). Decision required.
- Cross-tab coordination — tab A refresh, tab B still uses stale session token until its own 10m mark. Acceptable; document.
- Does `AuditPage.tsx` currently use `useSearchParams`? Quick grep during Phase 19 requirements.
