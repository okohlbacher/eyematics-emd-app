# Domain Pitfalls — v1.8 (JWT refresh, AuditPage reducer, metricSelector tests)

**Domain:** Express 5 + React clinical-data app with HS256 JWT, per-user TOTP, immutable SQLite audit log, rate-limited login.
**Researched:** 2026-04-22
**Scope:** Integration pitfalls specific to *adding* v1.8 features to the existing, v1.7-hardened codebase.
**Confidence:** HIGH (pitfalls are grounded in the actual code at `server/authApi.ts`, `server/authMiddleware.ts`, `server/auditMiddleware.ts`, `.planning/reviews/v1.7-full-review/`).

---

## Critical Pitfalls

Mistakes that cause security regressions, audit-compliance breakage, or force a rewrite.

### P-C1: Refresh-token reuse without server-side rotation/revocation (detection)

**What goes wrong:** Issue a long-lived refresh token without tracking an opaque per-token identifier on the server. A stolen refresh token stays valid for its whole lifetime; there is no way to detect concurrent use ("refresh token reuse") and no way to revoke a specific session.

**Why it happens in THIS app:** v1.7 is pure-JWT with zero server-side session state (stateless by design, HS256 signed). The easy "just extend expiry + rotate" path preserves statelessness but loses detection. The existing `auditDb.ts` (SQLite, WAL-mode) is the obvious place to persist a `refresh_sessions` table, but it's currently append-only and its schema is treated as immutable by audit tooling.

**Consequences:** A refresh token exfiltrated via XSS (sessionStorage is not httpOnly-protected) gives the attacker indefinite access; the user's own "log out" click cannot invalidate it because the server has no list to mark-revoked. Breach-response is "rotate `jwt-secret.txt` and force every user to re-login" — nuclear.

**Prevention:**
- Store refresh tokens as `{ id, user, family_id, issued_at, expires_at, revoked_at }` in a new SQLite table (NOT in `audit.db` — use `data/sessions.db` or add to `data/data.db`; audit.db stays immutable-append-only).
- Rotate on every refresh: each `/api/auth/refresh` issues a new refresh token and marks the presented one as rotated. Preserve the `family_id` across rotations.
- **Reuse detection:** if a revoked/rotated refresh token is ever presented again, revoke the entire `family_id` and force re-login for that user. This is the OAuth2 Refresh Token Rotation pattern (RFC 6749 §10.4, draft-ietf-oauth-security-topics).

**Detection / warning signs:**
- Any PR that adds refresh without a `sessions` table.
- Any PR that stores the refresh token in the JWT signature itself (bearer-only rotation) — that's NOT rotation, just re-issuance.
- No `/api/auth/refresh` audit rows on the happy path (middleware misconfigured).

**Phase to address:** Phase 18 (JWT refresh core). Design the sessions table BEFORE writing the endpoint.

---

### P-C2: Refresh token stored in a way that breaks XSS isolation

**What goes wrong:** Store refresh token in `sessionStorage` / `localStorage` alongside the access token. An XSS payload now exfiltrates both tokens and owns the session indefinitely.

**Why it happens in THIS app:** `src/context/AuthContext.tsx` already uses sessionStorage for the access token. Easiest path is "same pattern, one more key." This is the wrong trade for refresh tokens because access tokens are short-lived (10 min) while refresh tokens are long-lived (hours to days).

**Consequences:** Total account compromise from a single stored-XSS or dependency-chain attack. The v1.7 security-first posture is undone for the sake of convenience.

**Prevention:**
- Refresh token lives in an httpOnly, Secure, SameSite=Strict cookie scoped to `/api/auth/refresh` (Path attribute narrows CSRF surface).
- Access token keeps its current sessionStorage home (accessed by JS for `Authorization: Bearer` header).
- Because the refresh cookie is SameSite=Strict, standard CSRF on the refresh endpoint is blocked. Add an additional CSRF check (double-submit header or custom header check) if the app ever moves to SameSite=Lax.
- `Secure` flag: set in production only, off in dev (behind a settings-driven guard; NEVER a `NODE_ENV` env var per project rule "config in settings.yaml").
- The refresh cookie must survive `new URL()` navigations in React Router — verify `Path=/api/auth/refresh` works with the SPA's base path.

**Detection / warning signs:**
- `document.cookie` reads the refresh token in browser devtools → httpOnly flag missing.
- Network tab shows refresh token in `Authorization` header → cookie configured wrong.
- Login response body contains `refreshToken` JSON field → should only contain `{ token }`; refresh goes in `Set-Cookie`.

**Phase to address:** Phase 18 (JWT refresh core) — choose storage model in the first commit, not retrofit.

---

### P-C3: Breaking the HS256 algorithm pin when adding refresh endpoints

**What goes wrong:** v1.7-full-review H2 already flagged two `jwt.verify()` sites that lacked `{ algorithms: ['HS256'] }`. Adding `/api/auth/refresh` likely introduces *new* verify sites (session JWT decode inside refresh handler, refresh-token JWT verify if refresh tokens are JWTs). Forgetting the algorithm allowlist on any of them opens an algorithm-confusion attack (attacker signs with `none` or `RS256` using the public key as HMAC key).

**Why it happens in THIS app:** The pin is syntactically easy to omit — `jwt.verify(token, secret)` compiles and runs. The existing correct sites (`authApi.ts:195`) use the options arg; new handlers copy-paste from whichever example the author saw first.

**Consequences:** An attacker forges a token → full bypass of authentication → full access to center-filtered clinical data. This single-character omission invalidates everything Phase 14 and v1.7-full-review hardened.

**Prevention:**
- Add a server-side test: `grep -rn "jwt.verify(" server/` must match the regex `algorithms:\s*\['HS256'\]` on every hit. Automate in CI.
- Better: wrap `jsonwebtoken` in a tiny `server/jwtUtil.ts` that exports `verifyHs256(token)` and `signHs256(payload, opts)` — forbid direct `jsonwebtoken` imports outside this module via an ESLint no-restricted-imports rule.
- Negative test: craft a token signed with `alg:none` and one signed with `alg:RS256` using the HS256 secret as "public key"; assert both are rejected.

**Detection / warning signs:**
- Code-review diff introduces a new `jwt.verify(` call without the options arg.
- `jsonwebtoken` import in any file other than the new `jwtUtil.ts`.

**Phase to address:** Phase 18 first commit — introduce the wrapper before writing refresh logic. Also retrofit any sites that v1.7 missed.

---

### P-C4: Refresh-event audit-log flood drowns the signal

**What goes wrong:** `auditMiddleware` auto-logs every `/api/*` request. A 30-min session with 1-min sliding refresh = 30 audit rows per user per session for refresh alone, on top of actual data access rows. At 50 concurrent users, audit.db grows ~10× faster; SQL filters (`auditApi.ts` already flagged in H6 for input-validation DoS) become slow; the admin AuditPage becomes unusable; retention policies get hit early and legitimate rows age out.

**Why it happens in THIS app:** The auditMiddleware is a global automatic capture — `res.on('finish')` writes a row for every request that isn't in `SKIP_AUDIT_PATHS` or `PUBLIC_PATHS`. Refresh being auth-related, it's tempting to leave it on the default path.

**Consequences:** Audit-log quality degrades silently. Compliance rows (data export, user CRUD, login failures) are harder to find. Disk usage balloons; on an on-prem box with constrained storage this matters.

**Prevention:**
- Add `/api/auth/refresh` to `SKIP_AUDIT_PATHS` in `auditMiddleware.ts` — OR (better) have the handler itself write a compact audit row only on *meaningful* events: refresh-token-reuse-detected, family-revoked, refresh-after-password-change, refresh-failed.
- Happy-path refreshes should be silent (or debounced: one summary row per session per hour).
- Absolute-cap expiry (see P-C5) gets its own audit row so "why did this user re-login" is answerable.

**Detection / warning signs:**
- Post-deploy: `SELECT count(*), path FROM audit GROUP BY path ORDER BY 1 DESC LIMIT 5` shows `/api/auth/refresh` dominating.
- AuditPage UI: "refresh" rows visually flooding the list for non-admin users (who only see their own rows).

**Phase to address:** Phase 18 during refresh design, not as a follow-up. Retrofitting audit noise later is painful because you can't distinguish "was this meaningful" in already-captured rows.

---

### P-C5: Missing absolute session cap → refresh tokens live forever

**What goes wrong:** Sliding refresh (every refresh resets the expiry) without an absolute cap means an attacker who gets a refresh token can keep it alive indefinitely by calling refresh every N minutes. Even a legitimate but forgotten session on a shared device stays valid for months.

**Why it happens in THIS app:** The PROJECT.md constraint "Remove the 10-min re-login friction" pushes toward long sliding windows. It's natural to say "refresh extends by another 30 min each time" without thinking about the upper bound.

**Consequences:** The session never actually expires, defeating the entire point of short access tokens. A password change doesn't invalidate it (unless P-C6 is also fixed). A TOTP reset doesn't invalidate it.

**Prevention:**
- Encode `absoluteExp` (wall-clock epoch) in the refresh token payload at initial login. Refresh handler rejects if `now > absoluteExp`, regardless of sliding expiry.
- Recommended default: absolute cap 8h for clinical workflow (one workday). Sliding window 30 min. Configurable via `settings.yaml` (`auth.refreshAbsoluteMaxMs`, `auth.refreshSlidingMs`) — NEVER env vars.
- Re-login at absolute expiry must go through full bcrypt + TOTP.

**Detection / warning signs:**
- Refresh token payload has only `exp`, no `absoluteExp` or `issuedAt`.
- Manual test: call refresh in a loop for 100 iterations — token still valid.

**Phase to address:** Phase 18 refresh core. Must be in the schema on day one.

---

### P-C6: Refresh after password change / TOTP disable not invalidated

**What goes wrong:** User changes password (future SEC-03 feature) or disables TOTP (`/api/auth/totp/disable` already exists). Their existing refresh tokens keep working. An attacker who stole a refresh token yesterday still has access today.

**Why it happens in THIS app:** The refresh table (from P-C1) needs a cross-reference to the user record's `passwordChangedAt` / `totpChangedAt` timestamp. Without it, refresh has no way to know the credentials rotated.

**Consequences:** "Change your password because you think you were compromised" doesn't actually lock out the attacker. This is a compliance-grade failure for clinical-data access.

**Prevention:**
- Add `passwordChangedAt`, `totpChangedAt` to `UserRecord` (initAuth.ts). Bump them whenever `passwordHash` or `totpSecret`/`totpEnabled` changes in `modifyUsers(...)` callbacks.
- Refresh handler loads the user and rejects if `user.passwordChangedAt > refreshToken.issuedAt` (same for totp).
- Admin password reset (`PUT /users/:username/password`) and admin TOTP reset (`POST /users/:username/totp/reset`) must bump both timestamps.
- Also: `POST /api/auth/totp/enroll` and `/totp/confirm` should bump `totpChangedAt` — any TOTP state change counts.

**Detection / warning signs:**
- Test: enable TOTP, obtain refresh token, disable TOTP, call refresh → should return 401.
- Test: admin resets user's password, user's existing refresh tokens should all 401.

**Phase to address:** Phase 18 refresh core. The `*ChangedAt` field additions touch every user-mutation path in `authApi.ts`, so do them as a single atomic change.

---

## High Pitfalls

### P-H1: Silent-refresh race on multi-tab / concurrent requests

**What goes wrong:** User has two tabs open. Both fire a request at `T=10:00` and both get 401. Both call `/api/auth/refresh` in parallel. With naive rotation (P-C1), one wins and invalidates the other's refresh token → second tab's refresh triggers the family-revocation logic and the entire user's session is killed.

**Why it happens in THIS app:** `AuthContext.tsx` has a single `authFetch` wrapper. Adding naive refresh means "on 401, refresh then retry." Two tabs = two authFetch wrappers = two refresh calls.

**Consequences:** Legitimate users get spuriously logged out whenever they have multiple tabs (common in research workflows — metric selector in one tab, audit page in another).

**Prevention:**
- Single-flight refresh in the client: a module-level `Promise<string>` shared across all authFetch calls. First 401 starts the refresh; all subsequent 401s during that refresh await the same promise.
- Use `BroadcastChannel('emd-auth')` to sync refresh outcomes across tabs (so tab B doesn't also try to refresh when tab A already succeeded).
- Server: small grace window — accept a just-rotated refresh token for e.g. 5 seconds after rotation, specifically to tolerate multi-tab races. Document this grace window as an explicit tradeoff against P-C1's reuse detection (the detection still fires outside the grace window).

**Detection / warning signs:**
- E2E test: open two tabs, wait past access-token expiry, click in both tabs simultaneously → should not log out.
- Server logs: rapid "family revoked" events clustered at token-expiry boundaries.

**Phase to address:** Phase 18 refresh client integration. Don't ship without the single-flight pattern.

---

### P-H2: AuditPage refactor silently changes observable behavior

**What goes wrong:** Converting 7 `useState` to `useReducer` (L4 from v1.7-full-review, `src/pages/AuditPage.tsx:97-102`) is "mechanical" — except the old code has implicit ordering of setState calls, debounce timing, and effect-dep behavior that the reducer refactor accidentally changes. Filters feel subtly different, pagination resets at different times, or debounce no longer coalesces keystrokes.

**Why it happens in THIS app:** React batches multiple setState calls from the same event handler differently than a single dispatch. A `setFromTime(x); setToTime(y)` pair triggers one re-render in React 18; a reducer `dispatch({type:'SET_RANGE', from:x, to:y})` also triggers one — but if any existing effect depended on seeing `fromTime` update in one render and `toTime` in the next (which can happen in async flows), the ordering changes.

**Consequences:** Admin users report "the audit filter feels broken" — hard-to-reproduce bugs; regressions in subtle UX that wasn't covered by tests.

**Prevention:**
- Before refactoring: write characterization tests against the current AuditPage behavior — filter debounce (assert fetch fires once after 300ms of typing, not per keystroke), pagination reset on filter change, URL/query-param round-trip if any.
- Refactor with the tests passing *green* on the old code first, then swap to reducer and re-run. Any diff is a regression.
- Don't bundle feature additions (L5 MAX_EXPORT_ROWS, H6 input validation) into the reducer refactor — separate PRs.

**Detection / warning signs:**
- PR diff for AuditPage.tsx shows changes beyond state-management mechanics (new features, new UX).
- Existing AuditPage tests still pass with zero edits — either the tests don't cover the refactored surface, OR the refactor truly is behavior-preserving. Inspect which.

**Phase to address:** Phase 19 (AuditPage reducer). Characterization tests go in a preparatory commit before the refactor commit.

---

### P-H3: AuditPage reducer accidentally drops URL query-param sync

**What goes wrong:** If AuditPage currently reads `?user=foo&from=...` on mount and writes filter state back to the URL (deep-link support, consistent with metricSelector `?metric=` pattern and Phase 16 `?cohorts=` pattern), the reducer refactor can lose this by centralizing state in a reducer whose initial value doesn't read `useSearchParams()`.

**Why it happens in THIS app:** The `?metric=` and `?cohorts=` deep-link patterns are established conventions. If AuditPage follows them, a naive reducer refactor loses the URL coupling because reducer-init runs before `useSearchParams` is consulted.

**Consequences:** Admin bookmarks to filtered audit views break silently. No test catches it unless explicitly written.

**Prevention:**
- Audit AuditPage current behavior: does it read/write URL query params? (Grep for `useSearchParams` in `src/pages/AuditPage.tsx`.)
- If yes: reducer's `initialState` must be a *function* that reads from `URLSearchParams`, AND a subscription effect must write state changes back to the URL.
- Add a deep-link round-trip test: navigate to `/audit?user=foo&status_gte=400`, assert the filter state matches.

**Detection / warning signs:**
- PR diff removes any `useSearchParams` / `setSearchParams` calls from AuditPage.
- Manual: reload page with an active filter → filter is gone.

**Phase to address:** Phase 19 AuditPage reducer. Audit current URL coupling in design step.

---

### P-H4: metricSelector integration test flakiness from router / jsdom navigation

**What goes wrong:** Unskipping `describe.skip` tests and wiring up `<MemoryRouter>` / `<BrowserRouter>` introduces flake: tests fail intermittently because `useSearchParams()` updates are async relative to RTL's sync render cycle, `window.history.pushState` fires async events jsdom doesn't fully settle, or `act()` warnings fire.

**Why it happens in THIS app:** The `?metric=` deep-link relies on `useSearchParams` from react-router. Testing a Route that reads query params from a Router that's mounted inside a RTL `render()` requires careful provider nesting, and any async state transition (debounced fetch on metric change) compounds the flake.

**Consequences:** Tests pass locally, fail in CI; developers disable them; the test suite becomes unreliable and the coverage goal from v1.8 is undermined.

**Prevention:**
- Use `<MemoryRouter initialEntries={['/outcomes?metric=visus']}>` — deterministic; no real `window.history`.
- Wrap all interactions in `await user.click(...)` (userEvent v14+ is async by default, returns a promise that awaits state settlement). Avoid fireEvent for click/type — it's sync and triggers act warnings.
- For assertions after navigation: use `await screen.findBy*` (async), not `getBy*` (sync). findBy retries, getBy throws immediately.
- Mock the data-fetching layer (fhirLoader, outcomesAggregate) at the module boundary — never make real network calls. Use `vi.mock('@/services/fhirLoader', ...)`.
- Test *behavior*, not implementation: assert "selecting CRT tab causes CRT chart data to render," not "`setSelectedMetric('crt')` was called."

**Detection / warning signs:**
- Test output shows "Warning: An update to X was not wrapped in act(...)".
- Test passes 10× locally, fails 1× in CI → flaky, not fixed.
- Test uses `fireEvent` or `getBy*` after a navigation.

**Phase to address:** Phase 20 (metricSelector tests). Establish the router-test pattern in the first test file, reuse across the rest.

---

### P-H5: Deep-link round-trip tests miss the unknown-metric fallback path

**What goes wrong:** The metricSelector accepts `?metric=<slug>` and falls back to a default (visus) when the slug is unknown. Integration tests cover the happy path (`?metric=crt` → CRT tab active) but skip `?metric=bogus` → should fall back without throwing.

**Why it happens in THIS app:** Happy-path tests are the obvious thing to write. The fallback path is where bugs hide — especially because an unknown slug could come from a stale bookmark, a copy-paste from a future version, or a URL injection attempt.

**Consequences:** Shipped regression where `?metric=malformed_value` crashes the Outcomes page with a blank screen, TypeError, or router error boundary.

**Prevention:**
- Required test cases for metricSelector integration:
  1. `?metric=visus` → Visus tab active, data loads.
  2. `?metric=crt` → CRT tab.
  3. `?metric=treatment-interval` → Treatment-Interval tab.
  4. `?metric=responder` → Responder tab.
  5. **`?metric=unknown-slug` → falls back to Visus (default), no console error, no thrown exception.**
  6. **`?metric=` (empty value) → falls back to Visus.**
  7. **No `?metric=` param at all → falls back to Visus.**
  8. User clicks CRT tab when URL had `?metric=visus` → URL updates to `?metric=crt` (round-trip).
  9. Browser back button returns to `?metric=visus` → tab updates.

**Detection / warning signs:**
- Coverage report: the default-fallback branch in the metric-slug→metric-id mapping function has 0% coverage.
- Grep for `?metric=unknown` or `bogus` in test files returns nothing.

**Phase to address:** Phase 20 (metricSelector tests). Include unknown-slug cases in the initial test plan, not as a follow-up.

---

## Moderate Pitfalls

### P-M1: Refresh endpoint bypasses rate limiting

**What goes wrong:** The existing `createRateLimiter` (`server/rateLimiting.ts`) is applied per-username on `/login` and `/verify`. Refresh endpoint is new and easily forgotten. An attacker who captured one refresh token can hammer refresh to keep a session alive against a panicked admin trying to revoke.

**Prevention:** Apply a separate rate limiter on `/api/auth/refresh` keyed by refresh-token-id (not username — refresh is pre-username-lookup). Cap at e.g. 6 refreshes/minute per token. Exceeding cap → revoke family.

**Phase:** Phase 18.

---

### P-M2: Refresh response body format drift

**What goes wrong:** `/api/auth/login` currently returns `{ token }` or `{ challengeToken }`. `/api/auth/refresh` should return `{ token }` (access token) with the new refresh token in `Set-Cookie`. Inconsistency between handlers leads to client-side conditional logic that drifts.

**Prevention:** Single helper `issueSession(res, user)` in `authApi.ts` that sets the cookie + returns the JSON body. Used by `/login`, `/verify`, `/refresh`.

**Phase:** Phase 18.

---

### P-M3: Logging out doesn't revoke the refresh cookie

**What goes wrong:** Current app has no `/api/auth/logout` endpoint (v1.7-full-review F-15 noted this). Adding refresh without adding logout means the only way to clear a refresh token is waiting for absolute expiry.

**Prevention:** Add `POST /api/auth/logout`: mark current refresh token revoked + `Set-Cookie` with `Max-Age=0` to clear the httpOnly cookie. Client calls logout before wiping sessionStorage.

**Phase:** Phase 18 — ship logout in the same phase as refresh.

---

### P-M4: AuditPage reducer state becomes the single source of truth but URL is not

**What goes wrong:** Reducer state is in-memory only. Hard refresh wipes filters. Users lose context.

**Prevention:** Reducer state is derived from `useSearchParams` on mount; state changes dispatch BOTH the reducer action AND `setSearchParams`. One-way data-flow: URL → reducer → render. (See P-H3.)

**Phase:** Phase 19.

---

### P-M5: metricSelector test suite can't find the component in the DOM due to React.lazy / Suspense

**What goes wrong:** If OutcomesView / metricSelector is lazy-loaded (`React.lazy`), RTL's synchronous `render` resolves before the chunk loads. `getByRole('tab', {name: /CRT/})` fails.

**Prevention:** Either (a) render inside `<Suspense fallback={null}>` and always use `findBy*` after `render()`, OR (b) mock the lazy import to resolve synchronously in the test via `vi.mock`.

**Phase:** Phase 20.

---

### P-M6: Unhandled-promise warnings from abandoned refresh-on-unmount

**What goes wrong:** User navigates away while `/api/auth/refresh` is in flight. Promise resolves against an unmounted component, sets state → "Can't perform a React state update on an unmounted component" warning. In tests: "unhandled promise rejection" failing the test run.

**Prevention:** AbortController passed to `authFetch` — cancel on component unmount. Refresh promise-chain swallows AbortError specifically. Tests assert no unhandled rejection.

**Phase:** Phase 18 (client refresh integration).

---

## Minor Pitfalls

### P-L1: Refresh-token TTL configured via env var

**What:** Adding `REFRESH_TTL` environment variable for the new lifetime settings.
**Why bad:** Violates project rule "Config in settings.yaml — no env vars" (v1.1 key decision).
**Instead:** `auth.refreshSlidingMs` and `auth.refreshAbsoluteMaxMs` in `config/settings.yaml`.

**Phase:** Phase 18.

---

### P-L2: Refresh handler logs the refresh token value on error

**What:** `console.error('Refresh failed', refreshToken, err)` during debugging, left in code.
**Why bad:** Token ends up in stderr → log aggregator. v1.7-full-review M5 already flagged the same pattern in `sendError`.
**Instead:** Log token *id* (the opaque DB row id), never the token value. Extend v1.7's `sendError` redaction to strip cookie values.

**Phase:** Phase 18.

---

### P-L3: Reducer action types are stringly-typed

**What:** `dispatch({type: 'SET_FILTR', ...})` — typo accepted at runtime, silently no-op.
**Why bad:** Debug pain; invariant of `useReducer` is that `type` is enumerated.
**Instead:** `type FilterAction = {type: 'SET_USER', value: string} | ... ;` — discriminated union in TS. Typos become compile errors.

**Phase:** Phase 19.

---

### P-L4: Tests rely on exact tab label text ("CRT") that breaks on i18n switch

**What:** `getByText('CRT')` fails when locale switches to DE.
**Why bad:** Tests couple to user-facing strings that translate.
**Instead:** `getByRole('tab', {name: /CRT/i})` is better but still fails if the German label differs. Best: query by stable data-testid or by ARIA role + order (`getAllByRole('tab')[1]`). Or render tests with locale pinned to EN.

**Phase:** Phase 20.

---

### P-L5: metricSelector test imports real palette / real aggregation math → slow, coupled

**What:** Test transitively imports the whole outcomes math pipeline because it renders the chart.
**Why bad:** Test runtime balloons; failures in unrelated math break metricSelector tests.
**Instead:** Mock the chart component itself (`vi.mock('@/components/outcomes/MetricChart', ...)`) — assert the mock was called with the right props. Integration tests verify *wiring*, not chart rendering.

**Phase:** Phase 20.

---

## Phase-Specific Warning Matrix

| Phase | Topic | Pitfalls to actively guard against | Mitigation gate |
|-------|-------|-----------------------------------|----------------|
| 18 | JWT refresh core | P-C1, P-C2, P-C3, P-C5, P-C6, P-M1, P-M2, P-M3, P-L1 | PR checklist: sessions table designed, httpOnly cookie confirmed, HS256 wrapper introduced, absolute-cap enforced, `*ChangedAt` fields added, logout endpoint shipped in same PR, settings-driven TTLs. |
| 18 | Refresh client integration | P-C4 (audit flood), P-H1 (single-flight), P-M6 (abort) | PR checklist: `SKIP_AUDIT_PATHS` updated, single-flight Promise in AuthContext, BroadcastChannel sync, AbortController on authFetch. |
| 19 | AuditPage reducer | P-H2 (behavior change), P-H3 (URL sync lost), P-M4, P-L3 | PR checklist: characterization tests committed FIRST, grep for `useSearchParams` documented, discriminated-union action types, scope strictly limited to state-management refactor. |
| 20 | metricSelector tests | P-H4, P-H5, P-M5, P-L4, P-L5 | PR checklist: MemoryRouter used, userEvent async pattern, findBy* for post-navigation, unknown-slug fallback tested, data layer mocked, labels queried by role not text. |

---

## Security Regressions Called Out (given v1.7 just hardened this code)

v1.7-full-review closed C/H/M/L findings specifically around auth. v1.8 must not regress any of them. Concrete regression risks:

1. **HS256 pin (v1.7 H2):** Any new `jwt.verify()` call in refresh code without `{ algorithms: ['HS256'] }` re-opens algorithm-confusion. → P-C3.
2. **Audit redaction (v1.7 C1, H4):** Refresh bodies must never carry secrets. If the refresh handler accepts `{refreshToken: "..."}` in JSON body (instead of cookie) and that path isn't in `REDACT_PATHS`, the token lands in `audit.db`. → avoid body-based refresh entirely (P-C2 → cookie).
3. **Default-secret denylist (v1.7 C4):** Any new settings-driven secret (e.g. a future `auth.refreshHmacSecret`) must be on the denylist + length-checked. Reuse the `jwt-secret.txt` auto-generation pattern.
4. **Dev-plugin bypass (v1.7 C5):** Vite dev plugins accept forged base64. If refresh is implemented only in the Express production path but not the dev plugins, dev-mode tests can't exercise it — OR worse, dev-mode `validateAuth` accepts a forged refresh cookie. Implement refresh in Express only; keep dev plugins for read-only prototyping (align with v1.7 recommendation to delete dev auth bypass).
5. **TOTP reset invalidation (new in v1.8 surface):** `POST /users/:username/totp/reset` must bump `totpChangedAt` (P-C6) — otherwise an admin-forced TOTP reset on a compromised account doesn't kill existing refresh tokens. This is the most clinically-significant new invariant.

---

## Sources

- `.planning/reviews/v1.7-full-review/SUMMARY.md` — consolidated C/H/M/L findings; especially M6 (10-min JWT lifetime, no refresh), M7 (Keycloak stub), L4 (AuditPage reducer), H2 (HS256 pin), H4 (REDACT_PATHS), C1 (audit beacon auth).
- `.planning/reviews/v1.7-full-review/CLAUDE.md` — F-15 (JWT/inactivity timer coupling), F-21 (OutcomesView useEffect deps, relevant to metricSelector), F-31 (AuditPage 7 useState).
- `server/authMiddleware.ts` — HS256 pin location (line 59), PUBLIC_PATHS list.
- `server/authApi.ts` — current login/verify/TOTP handlers; refresh-token schema must extend these patterns.
- `server/auditMiddleware.ts` — SKIP_AUDIT_PATHS, REDACT_PATHS, REDACT_FIELDS.
- `src/pages/AuditPage.tsx:97-102` (per v1.7 F-31) — 7-useState refactor target.
- `.planning/PROJECT.md` — v1.8 goal + explicit scope (Keycloak OIDC OUT of scope).
- OAuth2 Security BCP (draft-ietf-oauth-security-topics) — refresh-token rotation + reuse detection pattern (MEDIUM confidence, not re-verified in this research session; pattern is well-established).
- RFC 6749 §10.4 — refresh token considerations.
- React Testing Library docs — userEvent v14 async API, findBy* vs getBy*, MemoryRouter for router tests (HIGH confidence — established community pattern).
