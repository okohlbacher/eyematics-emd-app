# Project Research Summary

**Project:** EMD (EyeMatics Clinical Demonstrator) — v1.8 Session Resilience & Test/Code Polish
**Domain:** Clinical research dashboard (React 19 SPA + Express 5, HS256 JWT, per-user TOTP, immutable SQLite audit log)
**Researched:** 2026-04-22
**Confidence:** HIGH

## Executive Summary

v1.8 is a **zero-new-dependency milestone** that ships one user-facing capability (JWT refresh flow to eliminate 10-minute re-login friction) and pays down two pieces of tech debt (AuditPage `useReducer` refactor, metricSelector integration tests). All three features can be delivered against libraries already in `package.json`; `jsonwebtoken@9`, `react@19`, `react-router-dom@7`, `vitest@4`, and `@testing-library/react@16` cover every need. Research strongly recommends locking "no new dependencies" as an explicit milestone constraint — any proposed dep mid-milestone should be treated as a scope-change flag.

The core architectural decision is JWT refresh: pattern choice is universal (short access token + longer refresh), but the **storage decision is non-trivial**. The simple path (refresh token in sessionStorage, Bearer header delivery, mirrors existing `challengeToken` pattern) is zero-dep and architecturally minimal but inherits the access token's XSS exposure. The hardened path (httpOnly `Secure` `SameSite=Strict` cookie scoped to `/api/auth/refresh`) preserves v1.7's security-first posture but adds CSRF plumbing and a hybrid auth model. Pitfalls research strongly recommends the cookie path for clinical-data compliance; Stack research notes the sessionStorage path is defensible given same-origin deployment and existing CSP. **This is the single decision the roadmapper must surface to requirements.**

Key risks cluster around the refresh flow: algorithm-confusion if `HS256` pin is dropped on new `jwt.verify()` sites (v1.7 already flagged this), audit-log flood if refresh events aren't added to `SKIP_AUDIT_PATHS`, silent session immortality without an absolute session cap, stale refresh tokens after password/TOTP change without `*ChangedAt` invalidation, and multi-tab refresh races without a client-side single-flight lock. The AuditPage refactor risks silent behavior change (debounce timing, cancel-on-unmount, URL sync) — characterization tests must land *before* the reducer swap. The metricSelector tests need the existing `OutcomesViewRouting.test.tsx` harness copied verbatim; a shared `renderOutcomesView` helper is the preferred generalization.

## Key Findings

### Recommended Stack

All three v1.8 features use libraries already installed. No `npm install` is required. The closest thing to a "new dep" candidate is `cookie-parser` for httpOnly refresh cookies — explicitly rejected by Stack research in favor of JSON-body delivery, but revisited by Pitfalls research as the recommended security posture. Requirements phase must resolve.

**Core technologies (existing):**
- `jsonwebtoken@9.0.3` — access + refresh token signing/verification (HS256). Mirror existing `signChallengeToken` / `purpose: 'challenge'` pattern for `purpose: 'refresh'`.
- `react@19.2.4` — `useReducer` is core; no supporting library (Immer, Zustand) warranted for AuditPage.
- `react-router-dom@7.14.0` — `MemoryRouter` + `vi.mock` harness already load-bearing for 6+ tests.
- `better-sqlite3@12.8.0` — optional, only if server-side refresh-token revocation (sessions table) is in scope. Pitfalls research recommends this for OAuth2-style refresh rotation + reuse detection. Stack research defers it.
- `express@5.2.1` — hosts new `POST /api/auth/refresh` and (per Pitfalls P-M3) `POST /api/auth/logout`.

### Expected Features

**Must have (table stakes):**
- Separate access-token lifetime from idle timeout — today's single 10-min clock kicks active users out mid-chart.
- Sliding refresh on active API use — active users see no expiry UX.
- Absolute session cap (8–12h) — prevents indefinite session resurrection on shared clinical workstations.
- 401 → single silent retry with refreshed token — current `authFetch` hard-redirects on any 401.
- Admin password reset / TOTP reset invalidates existing refresh tokens (token-version or `*ChangedAt` timestamp).
- Audit log records refresh events distinctly (new `audit_action_refresh` i18n key, DE + EN).
- AuditPage reducer preserves 6-dim filter, 300ms debounce, in-flight cancellation, admin-gated controls, 4 mutually exclusive render states, byte-identical CSV/JSON export.
- metricSelector tests: all 5 `describe.skip` cases pass, `data-testid` selectors, full URL assertions, stubbed `authFetch` audit beacon.

**Should have (competitive):**
- httpOnly refresh cookie (XSS-proof) + in-memory access token (CSRF-proof) — Pitfalls-recommended posture.
- Force-sign-out-everywhere admin action (via `tokenVersion` bump).
- Browser back/forward + keyboard arrow-key navigation tests.
- Shared `renderOutcomesView(url, options)` harness.

**Defer:**
- Keycloak OIDC integration (explicitly out of v1.8 scope).
- Rotating-refresh detection with family invalidation — Pitfalls critical, Features calls operationally heavy; requirements decision.
- AuditPage pagination (do not bundle into reducer refactor).

### Architecture Approach

Three largely-independent slices on top of v1.7-hardened codebase. JWT refresh touches server (`authApi.ts`, `authMiddleware.ts`, `auditMiddleware.ts`, `initAuth.ts`) plus single client choke point (`authHeaders.ts` / `AuthContext.tsx`). AuditPage refactor is pure frontend in `src/pages/AuditPage.tsx` + new `src/pages/audit/` siblings. metricSelector tests are pure test code plus an optional shared helper. No cross-slice runtime coupling; only one coordination point (F1 appends an entry to `describeAction` in `AuditPage.tsx`, so F1 should land after F2).

**Major components:**
1. **Refresh token issuance** (`server/authApi.ts`) — `signRefreshToken()`, `POST /api/auth/refresh`, `POST /api/auth/logout`, unified `issueSession(res, user)` helper.
2. **Refresh token verification** (`server/authMiddleware.ts`) — extend `purpose` gate to reject `refresh` on protected routes. Wrap `jwt.verify` in `server/jwtUtil.ts` with enforced HS256 pin.
3. **Credential-mutation invalidation** — add `tokenVersion` / `passwordChangedAt` / `totpChangedAt` to `UserRecord`; bump on every credential mutation.
4. **Client silent-refresh** (`src/services/authHeaders.ts`) — module-level `refreshPromise` single-flight, retry guard, `BroadcastChannel('emd-auth')` cross-tab sync, `AbortController`.
5. **AuditPage reducer** (`src/pages/audit/{auditPageState,auditFormatters,useAuditData}.ts`) — discriminated-union actions, epoch-based race guard replacing `cancelled` closure.
6. **Test harness** (`tests/helpers/renderOutcomesView.tsx`) — 7 `vi.mock` blocks at module scope + `renderOutcomesView(url, options)` factory.

### Critical Pitfalls

1. **HS256 algorithm pin missing on new `jwt.verify()` sites** (P-C3) — v1.7 H2 regression vector. **Mitigation:** `server/jwtUtil.ts` wrapper + ESLint `no-restricted-imports` on direct `jsonwebtoken` usage.
2. **Refresh token in sessionStorage defeats XSS isolation** (P-C2) — **Mitigation:** httpOnly `Secure` `SameSite=Strict` cookie scoped to `/api/auth/refresh`. (Stack/Pitfalls disagree; requirements must decide.)
3. **Audit-log flood from refresh events** (P-C4) — 10× `audit.db` growth. **Mitigation:** add `/api/auth/refresh` to `SKIP_AUDIT_PATHS`; log only meaningful events.
4. **Missing absolute session cap → refresh tokens live forever** (P-C5) — **Mitigation:** encode `absoluteExp` in refresh payload. Default 8h, configurable via `settings.yaml` (never env vars).
5. **Refresh-after-password-change not invalidated** (P-C6) — **Mitigation:** `passwordChangedAt` / `totpChangedAt` on `UserRecord`; reject refresh if `user.passwordChangedAt > token.issuedAt`.
6. **Silent-refresh race on multi-tab** (P-H1) — **Mitigation:** module-level `refreshPromise` + `BroadcastChannel` + 5-second server grace window.
7. **AuditPage refactor silently changes behavior** (P-H2) — **Mitigation:** characterization tests land BEFORE reducer swap; any diff is a regression.

## Implications for Roadmap

v1.7 ended at Phase 17. v1.8 continues at **Phase 18**.

### Phase 18: metricSelector Test Harness Unblock
**Rationale:** Smallest scope, pure test code, zero runtime risk. Unblocks future integration tests. Closes skipped-test smell from v1.6.
**Delivers:** 5 previously-skipped tests passing + new coverage (back/forward navigation, keyboard arrow keys, unknown-slug fallback, empty `?metric=`, no-param default). New `tests/helpers/renderOutcomesView.tsx`.
**Addresses:** Feature 3.
**Uses:** Existing `MemoryRouter`, `vitest`, `@testing-library/react`, 7-mock pattern from `OutcomesViewRouting.test.tsx`.
**Avoids:** P-H4, P-H5, P-M5, P-L4, P-L5.
**Estimate:** ~0.5 day.

### Phase 19: AuditPage State Machine
**Rationale:** Pure frontend refactor, no API surface. Must precede F1 because F1 appends `describeAction` entry in `AuditPage.tsx` — avoids merge conflict.
**Delivers:** Reducer-based AuditPage, discriminated-union actions, epoch-guarded race protection, `src/pages/audit/` file structure, pure reducer unit tests, behavior-parity characterization tests.
**Addresses:** Feature 2.
**Uses:** React 19 `useReducer`, existing `authFetch`, existing debounce pattern.
**Avoids:** P-H2 (characterization tests FIRST), P-H3, P-M4, P-L3.
**Estimate:** ~1 day.

### Phase 20: JWT Refresh Flow
**Rationale:** Largest surface (server + client + audit + i18n). Lands last so `describeAction` i18n addition applies to already-refactored AuditPage. Highest user value.
**Delivers:** `POST /api/auth/refresh` + `POST /api/auth/logout`, refresh-token issuance with `purpose: 'refresh'` and `absoluteExp`, `tokenVersion` + `passwordChangedAt` + `totpChangedAt` on `UserRecord`, `server/jwtUtil.ts` HS256-pinned wrapper, client single-flight refresh, `BroadcastChannel` multi-tab sync, `AbortController`, new `audit_action_refresh` i18n key (DE + EN), refresh added to `SKIP_AUDIT_PATHS` + `REDACT_PATHS`.
**Addresses:** Feature 1.
**Uses:** Existing `jsonwebtoken@9`, existing `authFetch` choke point, existing `purpose`-claim pattern. Optionally: `refresh_sessions` SQLite table in `data/sessions.db` (NOT `audit.db`) for OAuth2 rotation + reuse detection.
**Avoids:** P-C1 through P-C6, P-H1, P-M1, P-M2, P-M3, P-M6, P-L1, P-L2.
**Estimate:** ~2–3 days.

### Phase Ordering Rationale

- **A → B → C (18 → 19 → 20)** satisfies all dependency constraints with zero cross-phase rework.
- F3 independent and risk-free — ideal warm-up.
- F2 must precede F1 to avoid conflicting `describeAction` edits.
- F1 concentrates highest risk; landing last lets audit-flood detection (P-C4) validate against stable AuditPage reducer.

### Research Flags

**Needs research: Phase 20.** Multiple unresolved decisions: (a) refresh-token storage (sessionStorage vs httpOnly cookie — Stack/Pitfalls disagree), (b) rotation strategy (stateless short-TTL vs stateful sessions table with reuse detection), (c) absolute cap value (8h vs 12h), (d) multi-tab grace window duration. Recommend `/gsd-research-phase` before implementation.

**Standard patterns: Phases 18, 19.** `useReducer` and router+mock test harnesses are well-documented core patterns already load-bearing elsewhere in this codebase.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All claims anchored to specific `file:line` references; no external queries needed |
| Features | HIGH | Scope verified against `PROJECT.md:100-134` and source files |
| Architecture | HIGH | All integration points named with exact line numbers; no unknowns |
| Pitfalls | HIGH | Grounded in v1.7-full-review findings + codebase; one OAuth2 RFC reference is MEDIUM |

**Overall confidence:** HIGH

### Gaps to Address

- **Refresh-token storage (sessionStorage vs httpOnly cookie):** Stack/Pitfalls disagree. Resolve during Phase 20 requirements.
- **Refresh rotation strategy (stateless vs stateful):** Stack defers stateful sessions table; Pitfalls treats OAuth2 rotation + reuse detection as critical.
- **Absolute session cap value:** Architecture suggests 12h, Pitfalls suggests 8h. Should be `settings.yaml` key `auth.refreshAbsoluteCapMs`.
- **Does `AuditPage.tsx` currently use `useSearchParams`?** Grep during Phase 19 requirements; if yes, reducer initial state must read from URL.
- **Cross-tab refresh coordination:** `BroadcastChannel` recommended; acceptable without. Document trade-off during Phase 20.

## Sources

**Primary (HIGH):** `.planning/research/{STACK,FEATURES,ARCHITECTURE,PITFALLS}.md`, `.planning/reviews/v1.7-full-review/`, `.planning/PROJECT.md:100-134`, `package.json`, `server/authApi.ts`, `server/authMiddleware.ts`, `server/auditMiddleware.ts`, `src/context/AuthContext.tsx`, `src/services/authHeaders.ts`, `src/pages/AuditPage.tsx`, `tests/OutcomesViewRouting.test.tsx`, `tests/metricSelector.test.tsx`.

**Secondary (MEDIUM):** OAuth 2.0 Security BCP (draft-ietf-oauth-security-topics), RFC 6749 §10.4, React Testing Library community patterns.

---
*Research completed: 2026-04-22 — Ready for roadmap: yes*
