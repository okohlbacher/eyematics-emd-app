# Milestone v1.8 Requirements — Session Resilience & Test/Code Polish

**Milestone:** v1.8
**Goal:** Remove the 10-min re-login friction and pay down targeted v1.7 tech debt (AuditPage refactor, metricSelector test coverage).
**Created:** 2026-04-22

## Session Resilience (JWT Refresh Flow)

### Table stakes
- [ ] **SESSION-01**: User's 10-min idle auto-logout is preserved, but active API use no longer forces re-login at the 10-min access-token boundary
- [ ] **SESSION-02**: Active users see no session-expiry UX — `authFetch` silently refreshes on 401 and retries the original request once
- [ ] **SESSION-03**: Absolute session cap enforced (configurable via `settings.yaml` keys `auth.refreshTokenTtlMs` and `auth.refreshAbsoluteCapMs`; defaults 8h TTL / 12h absolute cap)
- [ ] **SESSION-04**: `authFetch` implements single-flight refresh lock (concurrent 401s share one `/api/auth/refresh` call) with a retry guard preventing infinite loops
- [ ] **SESSION-05**: `tokenVersion`, `passwordChangedAt`, and `totpChangedAt` fields added to `UserRecord` in `data/users.json`; bumped on password change, TOTP enable/disable, admin TOTP reset, admin user update; refresh rejects if token values are stale
- [ ] **SESSION-06**: `POST /api/auth/refresh` added to `REDACT_PATHS` (strip `refreshToken` from request body) and `SKIP_AUDIT_PATHS` so successful refresh events don't flood `audit.db`; failed refreshes still audited
- [ ] **SESSION-07**: All `jwt.verify()` call sites route through `server/jwtUtil.ts` wrapper with hard-pinned `algorithms: ['HS256']`; ESLint `no-restricted-imports` forbids direct `jsonwebtoken` verify imports elsewhere
- [ ] **SESSION-12**: `POST /api/auth/logout` endpoint clears server-side refresh-token state (cookie + tokenVersion bump) and the client invalidates both tokens
- [ ] **SESSION-13**: New `audit_action_refresh` + `audit_action_logout` i18n keys (DE + EN); `describeAction` mapping in AuditPage extended; i18n-completeness test passes

### Differentiators (in scope)
- [ ] **SESSION-08**: Refresh token delivered as httpOnly `Secure` `SameSite=Strict` cookie scoped to `/api/auth/refresh` (adds `cookie-parser` dep); access token stays Bearer in memory; CSRF protection added for refresh endpoint
- [ ] **SESSION-09**: `BroadcastChannel('emd-auth')` coordinates refresh across tabs — when tab A refreshes, tab B receives the new access token rather than triggering its own refresh; 5-second server-side grace window for in-flight races

### Out of scope (explicit)
- **SESSION-10** — Admin "force sign out everywhere" — deferred; can be added later via `tokenVersion` bump without schema change
- **SESSION-11** — Stateful `refresh_sessions` SQLite table with OAuth2 rotation + reuse detection — deferred; operational complexity not justified for same-origin on-prem deployment at current scale
- KEYCLK-01 (Keycloak OIDC redirect flow) — explicitly deferred to a future milestone

## AuditPage Refactor

### Table stakes
- [ ] **AUDIT-01**: AuditPage state migrated to `useReducer` with discriminated-union actions (`FILTER_SET`, `FILTERS_RESET`, `FETCH_START`, `FETCH_SUCCESS`, `FETCH_ERROR`); behavior byte-identical to v1.7 (6-dim filter, 300ms debounce, cancel-on-unmount, admin-gated controls, 4 render states, CSV/JSON export)
- [ ] **AUDIT-02**: Characterization tests capturing current AuditPage behavior land as a separate commit BEFORE the reducer swap; any post-refactor diff is a regression
- [ ] **AUDIT-03**: Page split into `src/pages/audit/auditPageState.ts` (reducer + selectors), `src/pages/audit/auditFormatters.ts` (describeAction, describeDetail, isRelevantEntry, statusBadgeClass), `src/pages/audit/useAuditData.ts` (hook wrapping reducer + debounced fetch); `AuditPage.tsx` becomes pure render
- [ ] **AUDIT-04**: Pure reducer unit tests in `tests/auditPageReducer.test.ts` covering all 5 action paths + the `requestEpoch` stale-response guard

## metricSelector Integration Tests

### Table stakes
- [ ] **MSEL-01**: All 5 previously-skipped cases in `tests/metricSelector.test.tsx` are unskipped and passing
- [ ] **MSEL-02**: Deep-link round-trip tested — `?metric=X` renders the X tab selected; clicking a different tab updates the URL
- [ ] **MSEL-03**: Unknown metric slug (`?metric=bogus`) falls back to the default metric without error
- [ ] **MSEL-04**: Browser back/forward navigation via MemoryRouter restores the corresponding metric selection

### Differentiators (in scope)
- [ ] **MSEL-05**: Keyboard arrow-key tab cycling (the handler at `OutcomesView.tsx` L211–219) has a regression test
- [ ] **MSEL-06**: Shared `tests/helpers/renderOutcomesView.tsx` extracts the 7 `vi.mock` blocks + MemoryRouter + `renderOutcomesView(url, options)` factory, reused by both `OutcomesViewRouting.test.tsx` and `metricSelector.test.tsx`

## Future Requirements (deferred)

- Keycloak OIDC redirect flow (KEYCLK-01) — blocked on real Keycloak instance
- Admin "force sign out everywhere" (SESSION-10) — can be added via tokenVersion bump later
- OAuth2 stateful refresh rotation + reuse detection (SESSION-11) — defer until multi-admin / higher-trust deployment requires it

## Out of Scope

- Pagination work on AuditPage — do not bundle into reducer refactor (AUDIT-01 preserves current pagination behavior exactly)
- New dependencies beyond `cookie-parser` (needed for SESSION-08)
- Schema migration of `audit.db` — all audit changes are additive
- Changing the 10-min idle-logout behavior in `AuthContext.tsx` — orthogonal to access-token expiry

## Requirement → Phase Traceability

| REQ-ID | Phase (TBD by roadmapper) |
|--------|---------------------------|
| MSEL-01..06 | — |
| AUDIT-01..04 | — |
| SESSION-01..09, 12, 13 | — |

*Traceability filled in by the roadmapper.*
