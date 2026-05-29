# Phase 44: Tech-Debt Compaction - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning
**Mode:** Auto (CODEX Tier C: F-09, F-10)

<domain>
## Phase Boundary
Two behavior-preserving structural decompositions (TECH-01, TECH-02). NO behavior change — the full test suite (1086) is the contract.
- **TECH-01 / F-09:** split `server/authApi.ts` (~1,175+ lines) into cohesive routers (login / user-admin / totp / session) with shared helpers in a small auth-service module. Routes, paths, guards, responses unchanged.
- **TECH-02 / F-10:** decompose `src/components/outcomes/OutcomesView.tsx` (now larger after Phases 42/43) into hooks + metric containers. Behavior, URL handling, cross-cohort, drill-down, metric tabs unchanged.
</domain>

<decisions>
## Implementation Decisions
- **Strictly behavior-preserving.** Every endpoint path/method/guard/response shape in authApi stays identical; every OutcomesView behavior (URL `?cohorts=`/`?filters=`/`?metric=`, cross-cohort overlay, drill-down from Phase 43, recent-activity, audit beacon, aggregation routing, metric tabs) stays identical. `npm run test:ci` is the contract — must stay green at every commit; `npm run knip` no new dead code; `npm run lint` clean.
- **TECH-01:** extract route groups into separate router modules (e.g. `server/auth/loginApi.ts`, `userAdminApi.ts`, `totpApi.ts`, `sessionApi.ts`) mounted by a thin `authApi.ts`; shared helpers (rate limiter, jwt util usage, validation) into an auth-service/helpers module. Preserve route-ordering (the DTO/route-ordering invariants from v1.10 Phase 28). Preserve `resetLimiter` export + settingsApi circular-import avoidance (AUTHCFG-04).
- **TECH-02:** extract hooks (route/cohort state, recent-activity, aggregation routing) + per-metric container components from OutcomesView; keep the public component contract identical. Coordinate with the drill-down handler (Phase 43) and cross-cohort series (Phase 42) — keep them working.
- ### Claude's Discretion: exact module boundaries + file names; how granular the hook/container split is. Prefer minimal, mechanical moves over re-architecture.
</decisions>

<code_context>
## Existing Code Insights
- `server/authApi.ts` — login, refresh rotation, logout, user CRUD, password change, TOTP enroll/reset, key rotation, session admin. Imports/usages: jwtUtil (HS256 pin), rate limiter, sessionsDb, initAuth config, audit. `resetLimiter` exported (settingsApi calls it). Route ordering matters (session routes).
- `src/components/outcomes/OutcomesView.tsx` — URL parsing, cohort resolution, recent activity, audit beacon, server-aggregation routing, cross-cohort comparison, metric tabs, drill-down (Phase 43), cross-cohort case/aggregate series (Phase 42). Consumes COHORT_PALETTES, applyFilters, safePickCohortFilter.
- Tests: server auth tests (authApi, sessionRotation, rotateKey, sessionRevoke, settingsApi), outcomes tests (OutcomesView, metric selector, drill-down, interval histogram, responder) — these lock behavior.
</code_context>

<specifics>
## Specific Ideas
Mechanical extraction, not redesign. Move route groups into modules mounted by a thin authApi; extract OutcomesView hooks/containers. Run `npm run test:ci` after each extraction commit; if any test changes behavior, the move was wrong — fix or revert. End-state: smaller modules, identical behavior, green gates, knip clean.
</specifics>

<deferred>
## Deferred Ideas
F-13 already handled in Phase 40. F-03 Keycloak removal out of scope (blocked). Further re-architecture beyond the two named modules → backlog.
</deferred>
