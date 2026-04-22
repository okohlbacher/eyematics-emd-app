# Technology Stack — v1.8 Session Resilience & Test/Code Polish

**Project:** EMD (EyeMatics Clinical Demonstrator)
**Milestone:** v1.8
**Researched:** 2026-04-22
**Overall confidence:** HIGH
**Headline:** v1.8 is a **zero-new-dependency milestone.** All three features can ship using libraries already in `package.json`.

---

## Executive Summary

Each of the three v1.8 features was evaluated against the existing stack:

| Feature | New deps? | Why |
|---------|-----------|-----|
| JWT refresh flow | **None required** | `jsonwebtoken@9.0.3` already issues both access and refresh tokens; refresh token can be delivered via `Authorization: Bearer` response body (mirroring the existing `challengeToken` pattern in `authApi.ts`). A httpOnly-cookie delivery would add one dep (`cookie-parser`), but it is **not needed** because the existing access-token delivery channel is already JSON-over-HTTPS and already in sessionStorage — the refresh token can ride the same rails with no architectural change. |
| AuditPage useReducer refactor | **None required** | `useReducer` is a React 19 core hook. Confirmed no supporting libraries (Immer, Zustand, etc.) are warranted — existing 9× `useState` in `AuditPage.tsx` map cleanly onto a single reducer with 5–7 action types. |
| metricSelector integration tests | **None required** | The exact harness the `describe.skip` block in `tests/metricSelector.test.tsx` needs is already in use across the codebase: `MemoryRouter` from `react-router-dom@7.14.0` wrapping the component, with `vi.mock()` against `../src/context/DataContext`, `../src/context/LanguageContext`, `../src/services/fhirLoader`. See `tests/OutcomesViewRouting.test.tsx` lines 17–55 as the canonical template. |

**Recommendation to Roadmapper:** Lock "no new dependencies" as a v1.8 milestone constraint. If a dep is proposed mid-milestone, treat it as a scope-change flag.

---

## Recommended Stack

### Existing stack — confirmed sufficient

| Technology | Installed Version | Role in v1.8 | Why it suffices |
|------------|-------------------|--------------|-----------------|
| `jsonwebtoken` | `^9.0.3` | Access + refresh token signing/verification (HS256) | Supports multiple `expiresIn` values from the same secret; current `signSessionToken()` in `server/authApi.ts:60` is already the template. A `signRefreshToken()` sibling with `expiresIn: '8h'` (or similar) and a `purpose: 'refresh'` claim is the only code change needed. The existing `purpose: 'challenge'` pattern (authApi.ts:86 + authMiddleware.ts:60) demonstrates the exact mechanism for scope-limited tokens. |
| `bcryptjs` | `^3.0.3` | Unchanged | Not touched by v1.8. |
| `better-sqlite3` | `^12.8.0` | Optional: persist refresh-token jti for revocation if desired | **Not required for MVP.** Stateless refresh via short rotating lifetimes is acceptable. Only add a `refresh_tokens` table if explicit server-side revocation is in scope (flag for Roadmapper). |
| `express` | `^5.2.1` | Hosts new `POST /api/auth/refresh` endpoint | Straight addition to `authApiRouter` in `server/authApi.ts`. |
| `react` | `^19.2.4` | Provides `useReducer` | Built-in. |
| `react-router-dom` | `^7.14.0` | `MemoryRouter` for integration tests | Already the established test harness. |
| `vitest` | `^4.1.4` | Test runner | `tests/metricSelector.test.tsx` already imports it. |
| `@testing-library/react` | `^16.3.2` | `render`, `screen`, `fireEvent` | Already used in sibling tests. |
| `jsdom` | `^29.0.2` | DOM for router-context tests | Activated via `// @vitest-environment jsdom` (see `tests/OutcomesViewRouting.test.tsx:1`). |

### Not needed — explicitly rejected

| Candidate | Why rejected |
|-----------|--------------|
| `cookie-parser` (for httpOnly refresh cookie) | Would require CSRF-token plumbing, `credentials: 'include'` on every fetch, and a cookie-scoping decision. The current access-token path is sessionStorage + `Authorization: Bearer`. Mixing cookie-based refresh with header-based access creates a hybrid auth model — avoid. Keep delivery uniform: refresh token in response JSON, client stores in sessionStorage (same trust boundary as access token). |
| `jose` (modern JWT alternative) | `jsonwebtoken@9.0.3` is already integrated, HS256-audited, and tested. No functional gap. |
| `zustand` / `redux-toolkit` / `immer` (for AuditPage state) | Massive overkill for one page's filter panel. `useReducer` handles this idiomatically in ~40 LOC. |
| `@testing-library/user-event` | `fireEvent` is already in use across the codebase. Adding `userEvent` mid-milestone would create a style split. Stay with `fireEvent`. |

---

## JWT Refresh Flow — Detailed Recommendation

### Pattern: "Rotating refresh token, both in sessionStorage, same header channel"

**Why this pattern (vs. httpOnly cookie):**

1. **Architectural minimalism.** The existing access token already lives in `sessionStorage` (`src/context/AuthContext.tsx:106`). Refresh token placed beside it inherits the same security boundary — no new threat model to reason about.
2. **Zero-dep.** No `cookie-parser`, no CSRF double-submit token, no SameSite decisions.
3. **Tab-scoped by default.** `sessionStorage` dies with the tab, matching the current "close tab = logout" UX. A persistent httpOnly cookie would change this UX and require an explicit policy decision.
4. **Matches existing challenge-token precedent.** `authApi.ts` already issues a short-lived `challengeToken` in a JSON response body (line 168). Refresh token uses the same mechanism with `purpose: 'refresh'`.

**Trade-off acknowledged (LOW-severity):** A rotating refresh token in sessionStorage is accessible to any same-origin JS, which means an XSS finding can steal both tokens. v1.7 security pass + helmet CSP already mitigate this, and httpOnly cookies would not fully close the XSS gap either (attacker can still call `/api/auth/refresh` from the victim's page). Accept this trade-off for v1.8; revisit in a future security milestone if the threat model changes.

### Proposed shape (for Roadmapper to expand into phases)

```
Access token:  HS256, expiresIn: '10m', no purpose claim (unchanged)
Refresh token: HS256, expiresIn: '8h', purpose: 'refresh', jti: uuid (optional)

POST /api/auth/refresh
  Headers: Authorization: Bearer <refresh-token>
  200: { token, refreshToken }   // rotated pair
  401: invalid/expired/revoked
```

**authMiddleware changes:** reject `purpose: 'refresh'` on all non-`/api/auth/refresh` routes, mirroring the existing `purpose: 'challenge'` rejection at `server/authMiddleware.ts:60`.

**Client changes:** `src/context/AuthContext.tsx` gains a `refreshToken` state + a silent-refresh timer that fires ~1 minute before access-token expiry. The existing inactivity timer (`INACTIVITY_TIMEOUT`, line 63) stays as-is — refresh flow is orthogonal to idle logout.

**Confidence: HIGH** — pattern is widely documented, aligns with existing codebase idioms, and requires no new libraries.

---

## AuditPage useReducer Refactor — Detailed Recommendation

**Scope confirmed:** pure internal refactor. No new deps.

Current state in `src/pages/AuditPage.tsx` (lines 91–102): 9× `useState` across `entries`, `total`, `loading`, `error`, `filterUser`, `filterCategory`, `filterFrom`, `filterTo`, `filterSearch`, `filterFailures`. The debounced fetch effect (lines 114–138) depends on 6 filter states.

**Proposed reducer shape:**

```
state: { entries, total, loading, error, filters: { user, category, from, to, search, failuresOnly } }
actions: FETCH_START | FETCH_SUCCESS | FETCH_ERROR | FILTER_CHANGE | RESET_FILTERS
```

This collapses the 6-dep `useEffect` dependency array into a single `state.filters` dependency (via `useEffect` + `JSON.stringify(state.filters)` or preferably a ref-stable reducer-action pattern).

**Confidence: HIGH** — React `useReducer` is documented core API, zero friction.

---

## metricSelector Integration Tests — Detailed Recommendation

**No new test utility needed.** The skipped block at `tests/metricSelector.test.tsx:6` already imports the correct harness (`MemoryRouter` from `react-router-dom`). It is skipped because the `OutcomesView` component it renders depends on `DataContext`, `LanguageContext`, `fhirLoader`, and related services that need to be mocked.

**The exact template already exists at `tests/OutcomesViewRouting.test.tsx`:**

| Concern | Pattern in OutcomesViewRouting.test.tsx |
|---------|------------------------------------------|
| JSDOM env | `// @vitest-environment jsdom` (line 1) |
| Router wrapping | `<MemoryRouter initialEntries={[...]}>` (line 18) |
| Context hook mocks | `vi.mock('../src/context/DataContext', () => ({ useData: vi.fn() }))` (line 39) |
| Language mock | `vi.mock('../src/context/LanguageContext', () => ({ useLanguage: vi.fn() }))` (line 43) |
| Service mocks | `vi.mock('../src/services/fhirLoader', ...)` (line 47) |
| Deterministic compute | `vi.mock('../src/utils/cohortTrajectory', ...)` (line 57) |

**What the unskip task is:** copy the mock block from `OutcomesViewRouting.test.tsx` (lines 22–80) into `metricSelector.test.tsx`, remove `describe.skip` → `describe`, run.

**Confidence: HIGH** — pattern is already load-bearing for 6+ tests in the suite.

---

## Alternatives Considered

| Area | Chosen | Alternative | Why rejected |
|------|--------|-------------|--------------|
| Refresh token transport | JSON body + sessionStorage | httpOnly cookie + `cookie-parser` | Adds dep, adds CSRF plumbing, splits auth model, changes UX (survives tab close). |
| Refresh token revocation | Stateless (short lifetime) | `better-sqlite3` `refresh_tokens` table with jti + revoked_at | Adds schema migration, adds DB write on every refresh, adds cleanup job. Defer until a concrete revocation requirement appears. |
| AuditPage state | `useReducer` | `useState` × 10 (status quo), Zustand, Redux Toolkit | Status quo is the thing being refactored. Zustand/Redux are global-state tools for problems this component doesn't have. |
| Integration test harness | `MemoryRouter` + `vi.mock` (existing pattern) | Custom `renderWithProviders` helper | No other test in the suite uses such a helper; introducing one for a single unskip would bifurcate the test conventions. |
| JWT library | `jsonwebtoken@9.0.3` (current) | `jose`, `@node-rs/jsonwebtoken` | Current lib passes HS256/RS256 tests, already battle-tested in v1.7 full-review. No functional gap. |

---

## Installation

**Nothing to install.** If the Roadmapper concludes v1.8 stays strictly in scope:

```bash
# No-op — all required libraries are already in package.json
```

If a stretch goal adds server-side refresh-token revocation (out of current scope), the only addition would be a new SQLite table in `data/audit.db` or a sibling file — no new npm dependency, since `better-sqlite3` is already installed.

---

## Integration Points with Existing Code

| New/Changed Code | Integration Anchor |
|------------------|--------------------|
| `signRefreshToken()` helper | Add next to `signSessionToken()` in `server/authApi.ts:60` |
| `POST /api/auth/refresh` endpoint | Add to `authApiRouter` in `server/authApi.ts` (after `/verify`) |
| Refresh-token rejection on protected routes | Extend `purpose` check in `server/authMiddleware.ts:60` (and the keycloak branch at line 106) — reject both `challenge` and `refresh` |
| Client silent-refresh timer | Add to `AuthProvider` in `src/context/AuthContext.tsx:105` alongside the inactivity timer |
| AuditPage reducer | Replace `useState` block at `src/pages/AuditPage.tsx:91` |
| metricSelector tests | Copy mock block from `tests/OutcomesViewRouting.test.tsx:22-80` into `tests/metricSelector.test.tsx`, unskip |

---

## Sources

- `package.json` (verified installed versions, HIGH confidence)
- `server/authApi.ts:60-91, 108-175` — existing JWT signing/verify pattern (HIGH confidence)
- `server/authMiddleware.ts:57-69` — existing `purpose` claim gating (HIGH confidence)
- `src/context/AuthContext.tsx:105-245` — existing token lifecycle (HIGH confidence)
- `src/pages/AuditPage.tsx:91-138` — current useState sprawl (HIGH confidence)
- `tests/OutcomesViewRouting.test.tsx:1-80` — proven router+mocks test pattern (HIGH confidence)
- `tests/metricSelector.test.tsx:1-67` — the skipped block and its existing `MemoryRouter` import (HIGH confidence)
- React 19 `useReducer` docs — core hook, no version-specific caveats for this usage (HIGH confidence)
- `jsonwebtoken` v9 README — multiple-token-per-secret pattern with distinct `expiresIn` is standard usage (HIGH confidence, training data corroborated by existing in-repo usage)

---

*No Context7 / WebSearch queries executed for this research. Justification: the question is scoped entirely to "can existing deps do this?" — a question answerable from in-repo evidence. All claims are anchored to specific file:line references in the current codebase.*
