# Feature Landscape — v1.8 Session Resilience & Test/Code Polish

**Domain:** Clinical research dashboard (React SPA + Express) — three targeted capabilities for v1.8
**Researched:** 2026-04-22
**Overall confidence:** HIGH (all three features are well-trodden patterns; ecosystem conventions are stable and verifiable against existing v1.7 code)

## Executive Summary

v1.8 adds **one user-facing capability** (JWT refresh flow) and pays down **two pieces of tech debt** (AuditPage useReducer refactor, metricSelector integration tests). Research here maps each to standard patterns, concrete acceptance behaviors, and the existing code they must integrate with:

- **JWT refresh flow** — current state: `signSessionToken(...)` issues HS256 JWT with `expiresIn: '10m'`, client stores in `sessionStorage`, `authFetch` performs a hard redirect to `/login` on any 401 (`src/services/authHeaders.ts:22-28`). An additional 10-min client-side inactivity timer in `AuthContext` (`INACTIVITY_TIMEOUT = 10 * 60 * 1000`) auto-logs-out with a 1-min warning. Two timers are conflated today: access-token lifetime and idle timeout. v1.8 must separate them.
- **AuditPage useReducer refactor** — current `AuditPage.tsx` has 8 discrete `useState` hooks (entries, total, loading, error, 6 filter fields) plus a debounced `useEffect` that rebuilds query string from all filters. Reducer target: collapse into one state machine with action-based transitions; behavior must be preserved byte-for-byte (debounce timing, cancel-on-unmount, filter semantics, admin-gated controls, relevance filter + sort).
- **metricSelector integration tests** — `tests/metricSelector.test.tsx` contains 5 `describe.skip` tests already scaffolded with `MemoryRouter`. They fail to run because `OutcomesView` requires `AuthContext`, `LanguageContext`, `DataContext`, and loads settings via `authFetch`. Unskipping requires a shared test-harness (provider wrapper + minimal auth/data fixtures + `fetch` stub).

## Feature 1 — JWT Refresh Flow

### Table Stakes

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Separate access-token lifetime from idle timeout | Today a single 10-min clock governs both; users at their desks get kicked out mid-chart. Industry norm is short access (5–15 min) + long idle (15–60 min) | Medium | `signSessionToken` in `server/authApi.ts`, `AuthContext` inactivity timer |
| Sliding refresh on active API use | Active users should not see any expiry UX; tokens refresh silently as long as activity continues within the idle window | Medium | `authFetch` wrapper (single client chokepoint for all `/api/*` calls) |
| Absolute session cap (e.g. 8–12 h) | Prevents indefinitely sliding sessions on shared clinical workstations; audit/compliance expectation | Low | JWT payload extension (issue-at-max claim) or refresh-token TTL |
| 401 → silent retry once with refreshed token | Today `authFetch` hard-redirects on any 401; during refresh window this causes false logouts | Medium | `authFetch` — add single-flight refresh with request queue |
| Graceful expiry UX — toast, not redirect, when user *was* idle | Redirect on refresh failure is fine; redirect mid-session on a transient 401 is hostile | Low | Existing inactivity warning banner in `AuthContext` (reuse pattern) |
| Refresh invalidated when password is reset server-side | Admin reset must force re-login on all sessions; today users keep working until the 10-min token expires | Low-Medium | `server/authApi.ts` password-reset endpoint — needs a token-version / jti bump |
| 2FA session not weakened by refresh | Refresh must not downgrade `totpEnabled` proof — refresh token must be minted only after the full login ladder (password + OTP) completed | Low | Existing two-step login already issues the session token only after `/verify` |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| httpOnly refresh cookie + in-memory access token | Best-practice split: refresh token is XSS-proof (httpOnly, SameSite=Strict), access token is CSRF-proof (bearer header, in-memory only, never touches storage) | Medium-High | Requires cookie-parser, same-origin assumption (EMD is same-origin — Express serves the SPA). Would also fix the current `sessionStorage` XSS exposure of the session JWT (latent risk from v1.7). |
| "Session about to expire — keep working?" modal at absolute-cap boundary | Respects clinical workflow — user can save before the hard boundary | Low | Reuse existing `inactivityWarning` banner pattern (1-min lead already exists) |
| Per-user "force sign-out everywhere" (admin action) | Useful for offboarding; ties into the password-reset-invalidates-sessions behavior | Medium | Needs a `tokenVersion` column on `users.json` that JWT embeds + middleware checks |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Long-lived (days/weeks) access tokens | Incompatible with audit/compliance posture of a clinical dashboard; a stolen token is valid for the full TTL | Keep access tokens short (10–15 min), refresh silently |
| Refresh token in `localStorage`/`sessionStorage` | Same XSS exposure problem the current architecture already has with access token | httpOnly cookie OR keep refresh in memory and accept re-login after page reload |
| Rotating-refresh detection with family invalidation | SOTA (OAuth 2.1 recommendation) but operationally heavy; needs per-token server state. Overkill for single-tenant on-premises deployment. | Simple refresh-token TTL with server-side revocation list on password change |
| Separate `/api/auth/refresh` that accepts an expired access token | Violates JWT semantics; makes access-token expiry meaningless | Use a distinct refresh token (different signing purpose claim or cookie) |
| Client-side JWT expiry polling | Current inactivity timer is already a source of conflation; adding a second clock compounds it | Let `authFetch` drive refresh on 401 or on `exp - skew` window |
| Keeping the current 10-min auto-logout *in addition to* refresh | Makes refresh pointless | Replace inactivity-auto-logout with idle-refresh-timeout (no activity for N min → refresh blocked → next call 401 → redirect) |

### Acceptance Behaviors (for REQ-IDs)

1. Access token TTL stays ≤ 15 min (HS256, existing `signSessionToken` signature preserved).
2. Refresh endpoint issues a new access token when given a valid refresh credential; 2FA-enrolled users are not re-prompted for OTP.
3. Absolute session cap enforced server-side (e.g. 8 h from original login) — refresh past the cap returns 401.
4. `authFetch` performs a single-flight refresh on 401 and retries the original request once; concurrent requests during refresh are queued, not duplicated.
5. Admin password reset invalidates existing sessions for that user within one refresh cycle (token-version bump).
6. Idle user (no activity for N minutes) sees the existing warning banner before forced logout.
7. On refresh hard-failure, client clears session and redirects to `/login` exactly once (current `authFetch` behavior preserved for terminal failures).
8. Audit log records refresh events distinctly from login events (new `audit_action_refresh` translation key).

### Confidence

- HIGH on pattern choice (short access + refresh is universal for SPA + bearer-token architectures).
- MEDIUM on cookie vs in-memory decision — both ship today in healthcare SPAs. Decision point for requirements phase: does the deployment tolerate cookies? EMD is same-origin, so yes.

---

## Feature 2 — AuditPage useReducer Refactor

### Current State (verified from source)

`src/pages/AuditPage.tsx` uses 8 `useState` hooks:
- `entries`, `total`, `loading`, `error` (fetch outputs)
- `filterUser`, `filterCategory`, `filterFrom`, `filterTo`, `filterSearch`, `filterFailures` (6 filter controls)

One `useEffect` at lines 114–138 debounces 300 ms, builds a `URLSearchParams`, calls `authFetch('/api/audit?...')`, and commits `entries + total` OR `error`, with an in-flight `cancelled` flag. Client-side relevance filter + reverse-chronological sort runs in a `useMemo`.

### Table Stakes — Behaviors the Reducer MUST Preserve

| Behavior | Source of truth | Why it matters |
|----------|-----------------|----------------|
| 6-dimensional filter: user, category, from, to, body_search, failures-only | `AuditPage.tsx:97-102` | All 6 map to server query params — any drop is a silent regression |
| 300 ms debounce before fetch | `AuditPage.tsx:116, 137` | Prevents request-per-keystroke on `filterSearch` |
| In-flight request cancellation on unmount AND on filter-change | `AuditPage.tsx:115, 130` | `cancelled` flag guards `setState` after unmount; reducer refactor must not reintroduce the "setState on unmounted component" warning |
| Admin-only `filterUser` + `filterSearch` controls | `AuditPage.tsx:107, 185, 216` | Non-admin users never see these — reducer's initial state must respect role, and `dispatch({type:'SET_USER'})` from a non-admin path should be impossible (structural guarantee) |
| Empty-state vs filtered-empty-state vs loading-state vs error-state | `AuditPage.tsx:263-279` | 4 mutually exclusive render branches — reducer must make illegal combinations unrepresentable (e.g. no simultaneous `loading && error`) |
| Client-side `isRelevantEntry` filter + timestamp DESC sort | `AuditPage.tsx:141-145` | Runs over already-fetched entries; must stay in `useMemo`, not in reducer |
| `fromTime` raw / `toTime` with `T23:59:59` suffix | `AuditPage.tsx:123` | Inclusive-day semantic — reducer's filter → query serializer must reproduce exactly |
| 500-entry server page size (`limit: '500', offset: '0'`) | `AuditPage.tsx:119` | No UI pagination today — limit is the cap, not a page size. Don't accidentally introduce pagination in the refactor. |
| CSV/JSON export uses `filteredEntries` (post-relevance-filter) | `AuditPage.tsx:149, 157` | CSV content is the visible table, not the raw server response |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Discriminated-union state (`Idle \| Loading \| Success \| Error`) | Makes illegal states unrepresentable at the type level; eliminates `loading && error` footguns | Low | Idiomatic TS reducer pattern |
| Single `FILTERS_CHANGED` action carrying a partial filter patch | Reduces 6 per-field action types to 1; debounce key becomes the canonical filter object | Low | Matches existing `useEffect` dep-array semantics |
| Replace `cancelled` flag with `AbortController` passed to `authFetch` | More idiomatic than boolean flag; reducer action `FETCH_ABORTED` makes it explicit | Medium | `authFetch` already returns a `Response`; needs small wrapper to plumb `signal` |
| Reset-filters action with telemetry | Admin convenience; reducer makes it one line | Low | Not strictly required |

### Anti-Patterns to Avoid

| Anti-Pattern | Why Bad | Correct Approach |
|--------------|---------|-----------------|
| Reducer that dispatches side effects (fetch inside reducer) | Reducers must be pure — React may call them twice in StrictMode | Fetch stays in `useEffect`, reducer only transitions state |
| Over-granular actions (`SET_USER`, `SET_CATEGORY`, `SET_FROM`, …) | Recreates the 6-useState problem with more boilerplate | Single `FILTERS_CHANGED` with `Partial<Filters>` payload |
| Putting derived state (`filteredEntries`, `distinctUsers`) in the reducer | Derived values are `useMemo` territory; reducer state is source-of-truth only | Keep `useMemo` derivations outside |
| Losing the cancelled-request guard | Race-condition bug: fast typing in `filterSearch` can commit stale results on top of fresh ones | Preserve abort semantics (flag or AbortController) |
| Conflating server-fetched entries with client-filtered entries in one state field | Exporting the wrong collection to CSV | Keep `entries` (server) and `filteredEntries` (derived) distinct |
| Introducing pagination as part of the refactor | Scope creep; current behavior is "first 500, no pagination" | Feature-flag or separate milestone |

### Acceptance Behaviors

1. All 6 filter controls work identically (same server-side query params).
2. 300 ms debounce preserved; single in-flight request per filter snapshot.
3. Admin-gated controls render identically for admin vs non-admin.
4. Loading / error / empty / filtered-empty states are mutually exclusive in the rendered output.
5. CSV and JSON export produce byte-identical output to v1.7 for the same filter state + entry set.
6. No "setState on unmounted component" warnings under fast filter-churn.
7. Unit tests cover at least: transition graph (every action from every state), filter-to-query-string serializer, and the admin-guard invariant.

### Confidence

HIGH — this is a pure local-state refactor with no external API shape change. The existing code is small enough (~340 lines) that behavior parity can be verified with snapshot tests of the rendered table + a filter-permutation test.

---

## Feature 3 — metricSelector Integration Tests

### Current State

`tests/metricSelector.test.tsx` already has 5 `describe.skip` tests scaffolded with `MemoryRouter`. They fail to boot because `OutcomesView` requires:

- `useAuth()` from `AuthContext` (JWT, user with role+centers)
- `useLanguage()` from `LanguageContext` (i18n keys for tab labels)
- `useData()` from `DataContext` (active cases, saved searches)
- `authFetch('/api/audit/events/view-open')` — fire-and-forget audit beacon on mount (`OutcomesView.tsx:171`)
- `loadSettings()` — reads `outcomes.serverAggregationThresholdPatients`

Minimum harness needed: provider wrapper + `fetch` stub.

### Table Stakes

| Test | Coverage | Complexity | Notes |
|------|----------|------------|-------|
| Default metric is `visus` when no `?metric=` param | Already scaffolded | Low | `OutcomesView.tsx:120` — fallback branch |
| `?metric=crt` deep-link on mount preselects CRT tab | Already scaffolded | Low | Round-trip read |
| Click Treatment Interval tab → URL becomes `?metric=interval` | Already scaffolded; currently asserts only `aria-selected`, not URL | Low-Medium | Needs a `LocationDisplay` harness to read `useLocation().search` — current test doesn't actually verify URL write |
| Click tab → preserves other query params (`?cohort=abc` survives switch) | Already scaffolded | Low | `OutcomesView.tsx:203-209` uses `setSearchParams((p) => { p.set(...); return p; })` which is correct-by-construction; test must assert `cohort=abc` in final URL |
| Unknown `?metric=bogus` falls back to visus | Already scaffolded | Low | `VALID_METRICS.has()` guard at `OutcomesView.tsx:120` |
| Browser back/forward navigation restores prior metric | NOT scaffolded — gap | Medium | Use `MemoryRouter` with multiple history entries, or user-event driven tab-click sequence then `history.back()` |
| Keyboard navigation (ArrowLeft / ArrowRight) cycles tabs and updates URL | NOT scaffolded — gap | Medium | Handler exists at `OutcomesView.tsx:211-219`; test with `fireEvent.keyDown` |
| `aria-selected` and `role="tab"` semantics exposed correctly | Partially scaffolded | Low | Already asserted via `getByRole('tab')` — keep |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Shared test harness `renderWithProviders(ui, {route, user, cases})` | One factory unblocks future integration tests for `AnalysisPage`, `CohortBuilderPage`, `CaseDetailPage` | Medium | Reusable beyond this feature |
| `createMemoryRouter` (RR v6.4+) over `MemoryRouter` + children | Better control over history entries; supports `router.navigate()` imperatively for back/forward tests | Low | RR v6 data APIs |
| Stubbing `authFetch` globally via `vi.mock('../src/services/authHeaders')` | Avoids real `fetch` calls during tests; audit beacon becomes a no-op | Low | Mirror the pattern used in existing `tests/` |

### Anti-Features

| Anti-Feature | Why Avoid | Instead |
|--------------|-----------|---------|
| Mocking `OutcomesView`'s hooks directly with `vi.mock('../context/AuthContext')` | Brittle — any import refactor breaks tests | Wrap with real providers and feed them fixture data |
| Rendering the full chart (Recharts/SVG) in tests | Slow, pulls in canvas/chart deps, tests metric-selector not chart | Stub the sub-components (`OutcomesPanel`, `IntervalHistogram`, `ResponderView`) with lightweight markers |
| Asserting only `aria-selected` without asserting URL | Misses the actual contract — metric selector's job is to sync URL ↔ UI | Include a `LocationDisplay` harness that renders `useLocation().search` into the DOM |
| E2E (Playwright/Cypress) for this | Overkill for a URL round-trip test; slow in CI | Vitest + RTL + MemoryRouter is the right tier |
| Test that depends on `FormatMessage` i18n strings in a specific locale | Locale-flaky (DE vs EN) | Query tabs by `data-testid="metric-tab-${m}"` — already present in source (`OutcomesView.tsx:407`) |

### Acceptance Behaviors

1. All 5 existing `describe.skip` tests pass with `.skip` removed.
2. Tests use `data-testid` selectors, not i18n strings, for tab identification.
3. URL assertions check the full search string, not just `aria-selected`.
4. Back/forward navigation test added — covers a real user workflow.
5. Keyboard (ArrowLeft/Right) navigation test added — already implemented in source, currently untested.
6. Test setup extracted into a reusable `renderOutcomesView(route, fixtures)` helper.
7. No real `fetch` calls made during the test suite (audit beacon stubbed).
8. Test suite runs in < 2 s (goal: no chart rendering, no real network).

### Confidence

HIGH — the infrastructure (MemoryRouter, RTL, Vitest) is already in use; the tests are already written, just skipped; the gaps are identifiable by reading the source.

---

## Feature Dependencies

```
Test harness (Feature 3) ──┐
                           ├──► Future integration tests for other pages
AuditPage reducer (F2) ────┘    (outside v1.8 scope)

JWT refresh (F1)  ──────► Affects authFetch (F3's test harness must stub the new refresh path too)
JWT refresh (F1)  ──────► Affects AuthContext inactivity timer (F2 does NOT touch AuthContext, no conflict)
```

**Critical dependency note:** Feature 1 (JWT refresh) changes `authFetch` semantics. Feature 3 (metricSelector tests) mocks `authFetch`. Ordering: if F1 ships first, F3's harness stubs the new behavior; if F3 ships first, the harness may need a trivial update. Both orderings are tolerable; they do not block each other.

## MVP Recommendation

Prioritize for v1.8 (in this order):

1. **JWT refresh flow** — highest user value, removes the 10-min re-login friction noted in `PROJECT.md:104` (M6 deferred).
2. **metricSelector integration tests** — smallest scope, unblocks future test work, closes the skipped-test smell from v1.6.
3. **AuditPage useReducer refactor** — lowest user-facing value, pure tech debt (L4 deferred). Schedule last so any bug from F1 that lands in audit events is visible before the refactor reshuffles the page's state shape.

Defer: cookie-based httpOnly refresh (differentiator for F1) — ship in-memory refresh token first, evaluate cookie migration post-v1.8 based on security-review signal.

## Sources

- `.planning/PROJECT.md` (v1.8 milestone definition, lines 100–134)
- `src/pages/AuditPage.tsx` (current state-hook shape, lines 87–138)
- `src/components/outcomes/OutcomesView.tsx` (metric selector behavior, lines 118–219)
- `src/context/AuthContext.tsx` (inactivity timer, lines 63, 148–179)
- `src/services/authHeaders.ts` (authFetch 401-redirect behavior, full file)
- `server/authApi.ts` (JWT signing with 10-min expiry, lines 59–68; 2FA two-step flow, lines 108–288)
- `tests/metricSelector.test.tsx` (existing describe.skip scaffold)

All structural claims verified directly against source files in this repository — confidence HIGH.
