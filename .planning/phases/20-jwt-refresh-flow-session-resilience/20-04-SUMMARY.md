---
phase: 20
plan: 04
subsystem: auth-client
tags: [jwt, refresh, single-flight, broadcast-channel, csrf, cross-tab, session-resilience]
dependency_graph:
  requires:
    - server/jwtUtil.ts + POST /api/auth/refresh + POST /api/auth/logout (Plan 20-01)
    - tokenVersion invalidation contract on credential mutations (Plan 20-02)
    - SKIP_AUDIT_IF_STATUS + describeAction wiring (Plan 20-03)
  provides:
    - src/services/authHeaders.ts (silent refresh state machine: single-flight + retry guard + BroadcastChannel + CSRF)
    - src/services/authHeaders.serverLogout (testable POST /api/auth/logout helper)
    - src/services/authHeaders.broadcastLogout (cross-tab logout broadcast)
    - src/context/AuthContext.performLogout wired to server endpoint + sibling-tab notification
  affects:
    - SESSION-01 (active user crosses 10-min boundary silently) — now LIVE
    - SESSION-05 (cross-tab coordination) — now LIVE
    - All authFetch call sites in the app inherit silent-refresh transparently
tech_stack:
  added: []
  patterns:
    - Module-level Promise<string> single-flight lock with finally-reset (Pattern 1)
    - Retry-guard request header (X-EMD-Retry-After-Refresh) preventing refresh loops
    - BroadcastChannel('emd-auth') refresh-success / logout messages (Pattern 3)
    - Double-submit-cookie CSRF (X-CSRF-Token header from emd-csrf cookie)
    - vi.resetModules + dynamic import for module-level-state test isolation
    - Extracted-helper testing alternative (pure function unit-tested without RTL harness)
key_files:
  created:
    - tests/authFetchRefresh.test.ts (15 tests across 2 describe blocks)
  modified:
    - src/services/authHeaders.ts (31 → 147 LOC; +getAuthHeaders unchanged, +broadcastLogout, +serverLogout, +refreshAccessToken, +authFetch single-flight/retry/BC)
    - src/context/AuthContext.tsx (performLogout fires serverLogout + broadcastLogout; idle-timer constants UNCHANGED)
decisions:
  - "Extracted serverLogout into authHeaders.ts (Plan's allowed alternative). Avoids the cost of mounting an AuthProvider RTL harness and keeps the test file unit-style + jsdom-only. AuthContext consumes the helper and remains under 200 LOC."
  - "Retry-guard handling: outer authFetch checks for the guard header in the original baseHeaders AND inspects the retry response's status — a 401 from the retry path triggers handleAuthFailure (cleanup + redirect), without firing a second refresh."
  - "fire-and-forget serverLogout in performLogout (void serverLogout()) — local state is cleared synchronously after the POST is dispatched. This means a slow/hung server logout never delays the UI redirect (T-20-28 mitigation)."
  - "Static-source assertion as D-25 regression guard: a test reads src/context/AuthContext.tsx and asserts INACTIVITY_TIMEOUT = 10 * 60 * 1000 still appears verbatim. Cheap, catches accidental edits in future plans without coupling to React internals."
metrics:
  duration_minutes: ~10
  completed: "2026-04-23"
  tasks: 2
  tests_added: 15
  tests_passing: "18/18 plan-touched (10 silent-refresh + 5 logout-integration + 3 existing authHeaders); 599/602 in full suite (3 pre-existing failures from deferred-items.md, unrelated)"
  loc_authHeaders: 147
---

# Phase 20 Plan 04: Client Refresh State Machine + AuthContext Logout Wiring

The client side of Phase 20 is now LIVE. `src/services/authHeaders.ts` grew from
31 → 147 LOC and is the entire client refresh state machine: single-flight refresh
on 401, retry-guard preventing refresh loops, BroadcastChannel coordination for
cross-tab session adoption, and double-submit-cookie CSRF. `AuthContext.logout`
calls the new `POST /api/auth/logout` endpoint (with CSRF) and broadcasts to
sibling tabs. The v1.7 idle-logout contract (10-min `INACTIVITY_TIMEOUT`) is
preserved verbatim per D-25.

## Tasks Executed

### Task 1 — single-flight refresh + retry guard + BroadcastChannel + CSRF (commits 6ff6845 → 86261f3)

**TDD RED → GREEN.** 10 tests written first against the empty 31-LOC module:
9 failed (only Test 10 — "non-401 doesn't trigger refresh" — passed because it
matches the pre-existing pass-through behavior). Then `src/services/authHeaders.ts`
rewritten to its final 147-LOC form. All 10 + 3 existing `authHeaders.test.ts`
green.

**Behavior matrix (authFetch):**

| Scenario | Action | Total fetches | Refresh calls |
|----------|--------|---------------|---------------|
| 200 / non-401 response | Return as-is | 1 | 0 |
| 401, refresh OK, retry OK | Silent refresh + retry | 3 (orig + refresh + retry) | 1 |
| 401, refresh OK, retry 401 | Refresh + retry + handleAuthFailure | 3 | 1 |
| 401, refresh fails | handleAuthFailure | 2 (orig + refresh) | 1 |
| 5 concurrent 401s | Single-flight share | 5 origs + 1 refresh + 5 retries | 1 |
| Retried req (X-EMD-Retry-After-Refresh:1) → 401 | handleAuthFailure (no second refresh) | n/a | 0 |

**BroadcastChannel events:**

| Direction | Message | Effect |
|-----------|---------|--------|
| outbound | `{type:'refresh-success', token, expiresAt}` | Sibling tabs adopt `token` into sessionStorage |
| outbound | `{type:'logout'}` (fired by handleAuthFailure + broadcastLogout) | Sibling tabs clear sessionStorage + redirect to /login |
| inbound  | `{type:'refresh-success', token}` | This tab writes `token` to sessionStorage |
| inbound  | `{type:'logout'}` | This tab clears sessionStorage + redirects to /login |

**CSRF:** Refresh fetch includes `X-CSRF-Token: <emd-csrf cookie value>` and
`credentials:'include'`. The `getCsrfFromCookie` regex tolerates leading
whitespace/semicolons and decodes URL-encoded values.

**Module-level state isolation:** `vi.resetModules()` + dynamic
`await import('../src/services/authHeaders')` in every test guarantees a fresh
`refreshPromise` and a fresh `BroadcastChannel` instance per test.

### Task 2 — AuthContext.logout wiring (commit ae14aac)

**TDD RED → GREEN.** 5 additional tests in `tests/authFetchRefresh.test.ts`
under describe block "AuthContext.logout integration (via extracted serverLogout
helper)":

1. `serverLogout` POSTs `/api/auth/logout` with X-CSRF-Token + Bearer + credentials:'include'
2. `serverLogout` swallows network errors (caller must clear local state regardless)
3. `serverLogout` swallows non-OK (500) responses
4. `broadcastLogout` fires `{type:'logout'}` on the channel
5. **Regression guard:** `INACTIVITY_TIMEOUT = 10 * 60 * 1000` still present in `src/context/AuthContext.tsx` (D-25)

**Implementation:**

- New exported `serverLogout()` in `src/services/authHeaders.ts`. Try/catch
  swallows network errors; the caller is contractually required to clear local
  state regardless. This means a slow/hung server logout never blocks the UI
  redirect (T-20-28 mitigation).
- `src/context/AuthContext.tsx`:
  - Imported `broadcastLogout` and `serverLogout` from `../services/authHeaders`
  - Inside `performLogout`: calls `void serverLogout()` (fire-and-forget) +
    `broadcastLogout()` BEFORE clearing local state. Local clears are synchronous
    so the UI redirect happens regardless of the server response.
  - `INACTIVITY_TIMEOUT`, `WARNING_BEFORE`, the activity-listener effect, and
    the `inactivityWarning` state are all UNTOUCHED (D-25).

**Why the extracted-helper path:** The plan explicitly allowed this as an
alternative to mounting an `<AuthProvider>` RTL harness. The serverLogout
contract is pure (input: cookie + sessionStorage; output: a Promise that always
resolves; side effect: one fetch call), so unit-testing it directly is a better
fit than rendering React tree state. AuthContext.logout becomes a thin
two-line wrapper: `void serverLogout(); broadcastLogout();` + the existing
local-state cleanup.

## Confirmations

- **`wc -l src/services/authHeaders.ts` = 147** (target was ≥80, max 130 — ran a bit
  long because of the `serverLogout` extension and verbose JSDoc; trimmable but the
  doc value justified the cost).
- **All Task 1 acceptance grep checks pass:** `let refreshPromise: Promise<string> | null = null`,
  3 occurrences of `X-EMD-Retry-After-Refresh`, `new BroadcastChannel('emd-auth')`,
  `credentials: 'include'`, `X-CSRF-Token`, `refreshPromise = null` inside `finally`,
  `export function broadcastLogout`.
- **All Task 2 acceptance grep checks pass:** `broadcastLogout()` in
  `src/context/AuthContext.tsx`, `fetch('/api/auth/logout'` in
  `src/services/authHeaders.ts` (serverLogout body — extracted-helper variant),
  `X-CSRF-Token` in both files, `INACTIVITY_TIMEOUT = 10 * 60 * 1000` unchanged.
- **`grep -cE "INACTIVITY_TIMEOUT" src/context/AuthContext.tsx` = 3** —
  identical to pre-plan count (`git diff 27894f9 -- src/context/AuthContext.tsx`
  shows only the import addition and the performLogout body change; no idle-timer
  modifications).
- **All 8 STRIDE threats from the threat register addressed** (T-20-23..T-20-30):
  - T-20-23 single-flight lock: Test 2 asserts 1 refresh for 5 concurrent 401s
  - T-20-24 retry guard: Test 3 asserts no second refresh
  - T-20-25 finally-reset: Test 9 asserts next 401 can refresh again after a failure
  - T-20-26 httpOnly emd-refresh: enforced server-side in Plan 01; not touched here
  - T-20-27 BC same-origin: accept-disposed; no code action needed
  - T-20-28 logout swallow: Tests 2-3 of Task 2 assert serverLogout never throws
  - T-20-29 logout body empty: accept-disposed
  - T-20-30 logout broadcast precedes sessionStorage clear: enforced by `performLogout` ordering

## Mock-Isolation Strategy

`tests/authFetchRefresh.test.ts` runs under `// @vitest-environment jsdom`. The
key isolation idiom (documented at the top of the file):

```typescript
async function loadModule() {
  vi.resetModules();
  return await import('../src/services/authHeaders');
}
```

Every test calls `loadModule()` so the module-level `refreshPromise` and
BroadcastChannel are recreated. `MockBC.reset()` in `beforeEach` clears the
static `instances` array, so `MockBC.instances[0]` always refers to THIS test's
channel.

## Phase 20 Completion Checklist (across plans 01–04)

| Req       | Plan | Status | Where verified |
|-----------|------|--------|----------------|
| SESSION-01 | 04   | done   | tests/authFetchRefresh.test.ts Test 1 (silent refresh + retry) |
| SESSION-02 | 01+04 | done  | tests/authRefresh.test.ts (absolute cap) + Test 5 of Task 2 (idle-timer regression) |
| SESSION-03 | 02   | done   | tests/credentialMutationInvalidation.test.ts (6 tests) |
| SESSION-04 | 01   | done   | tests/authRefresh.test.ts cookie-attrs assertions |
| SESSION-05 | 04   | done   | tests/authFetchRefresh.test.ts Tests 6/7/8 (BC) + serverLogout/broadcastLogout tests |
| SESSION-06 | 01+02 | done  | tests/jwtUtil.test.ts + ESLint no-restricted-imports rule |
| SESSION-07 | 01   | done   | tests/authRefresh.test.ts (missing-csrf 403) |
| SESSION-08 | 01   | done   | tests/authRefresh.test.ts (rotation set-cookie) |
| SESSION-09 | 03   | done   | tests/auditFormatters.test.ts (DE+EN refresh/logout) |
| SESSION-12 | 01   | done   | tests/settingsAuthSchema.test.ts |
| SESSION-13 | 03   | done   | tests/auditFormatters.test.ts (describeAction) |

All 11 SESSION-XX requirements landed. Phase 20 ready for `/gsd-verify-work`.

## Manual Smoke Test

Not performed in this plan execution (orchestrator-driven autonomous run).
Recommended manual verification per PLAN.md `<verification>` steps 3 + 4:

1. Start server with `auth.refreshCookieSecure: false` for HTTP dev.
2. Login; in DevTools → Application → Cookies, confirm `emd-refresh`
   (HttpOnly, Path=/api/auth/refresh) and `emd-csrf` (non-HttpOnly).
3. Manually delete `emd-token` from sessionStorage; trigger any API call.
4. Network tab should show: original 401 → /api/auth/refresh 200 → original
   request retried 200. No UX disruption.
5. Open 2 tabs; force a 401 in tab A; tab B's `sessionStorage.emd-token`
   updates without firing its own /api/auth/refresh.
6. Tail audit.db: no successful-refresh rows (confirms Plan 03 SKIP_AUDIT_IF_STATUS).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Retry-401 path did not clear sessionStorage**

- **Found during:** Task 1 GREEN phase (Test 3 failed)
- **Issue:** Initial implementation returned the retry response directly without
  inspecting its status. Test 3 expects that when the retried request also
  returns 401 (server still rejects the new access token), `handleAuthFailure`
  fires (clears sessionStorage + redirects). Without this branch, the user would
  see the 401 propagate up but their (now-invalid) `emd-token` would remain in
  storage.
- **Fix:** Added `if (retryResp.status === 401) handleAuthFailure();` before
  returning the retry response. Test 3 then passes; Tests 1, 2, 9 unaffected
  (their retries return 200).
- **Files modified:** `src/services/authHeaders.ts`
- **Commit:** 86261f3

**2. [Rule 1 — Lint] Unused eslint-disable directive in test mock**

- **Found during:** Task 1 lint check
- **Issue:** A `// eslint-disable-next-line @typescript-eslint/no-unused-vars`
  comment above `MockBC`'s constructor parameter triggered the
  "Unused eslint-disable directive" warning because the `_name` underscore
  prefix already satisfies the rule.
- **Fix:** Removed the disable comment.
- **Files modified:** `tests/authFetchRefresh.test.ts`
- **Commit:** 86261f3

**3. [Rule 1 — Lint] Import sort in AuthContext.tsx**

- **Found during:** Task 2 lint check
- **Issue:** `simple-import-sort/imports` flagged the new `broadcastLogout / serverLogout`
  import as needing reordering relative to the existing `invalidateBundleCache` import.
- **Fix:** Ran `npx eslint --fix src/context/AuthContext.tsx`. Autofixer reordered
  the relative imports alphabetically (`authHeaders` before `fhirLoader`).
- **Files modified:** `src/context/AuthContext.tsx`
- **Commit:** ae14aac

### Environmental Adjustment (NOT a code deviation)

`tests/authRefresh.test.ts` and `tests/credentialMutationInvalidation.test.ts`
initially failed with `Cannot find package 'cookie-parser'` — the dependency was
recorded in `package.json` (Plan 20-01) but the worktree's `node_modules`
didn't have it materialised. Ran `npm install` once at the worktree root to
resolve. Not a code change; not committed; tests then green.

### Pre-existing Failures (out of scope — Rule SCOPE BOUNDARY)

Same 3 failures documented in `deferred-items.md` since Plan 20-01:

- `tests/outcomesPanelCrt.test.tsx` (2 — Phase 13 CRT metric scope)
- `tests/OutcomesPage.test.tsx` (1 — Phase 11 audit beacon scope)

Verified to predate this plan (no files touched here intersect those test files).

## Self-Check: PASSED

- **Files exist:**
  - `src/services/authHeaders.ts`: FOUND (modified, 147 LOC)
  - `src/context/AuthContext.tsx`: FOUND (modified, +import +performLogout body)
  - `tests/authFetchRefresh.test.ts`: FOUND (created, 15 tests in 2 describe blocks)
- **Commits exist:**
  - 6ff6845 — `test(20-04): add failing tests for silent refresh + single-flight + BroadcastChannel + CSRF` (RED)
  - 86261f3 — `feat(20-04): single-flight refresh + retry guard + BroadcastChannel + CSRF in authHeaders` (GREEN Task 1)
  - ae14aac — `feat(20-04): wire AuthContext.logout to POST /api/auth/logout + broadcastLogout` (GREEN Task 2)
- **Tests:** 18/18 plan-touched tests green (10 silent-refresh + 5 logout-integration + 3 existing authHeaders); 599/602 in full suite (3 pre-existing failures unchanged from prior plans).
- **Lint:** clean for all 3 touched files (`npx eslint src/services/authHeaders.ts src/context/AuthContext.tsx tests/authFetchRefresh.test.ts` → 0 problems).
- **Acceptance criteria:** All Task 1 + Task 2 grep + behavior assertions confirmed.
