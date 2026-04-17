---
gsd_state_version: 1.0
milestone: v1.7
milestone_name: Security, Performance & Cross-Cohort
status: executing
last_updated: "2026-04-17T12:35:00.000Z"
last_activity: 2026-04-17 -- Phase 14 complete (verified 12/12 must-haves, 449 tests)
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
  percent: 20
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-17)

**Core value:** Every user sees only authorized data, with tamper-proof audit trail — while `/outcomes` stays fast, visually polished, and useful beyond visus.
**Current focus:** Milestone v1.7 — Phase 15 (TOTP) ready to plan

## Current Position

Phase: 15 of 18 (TOTP Per-User Authentication)
Plan: — (not yet planned)
Status: Ready to plan
Last activity: 2026-04-17 -- Phase 14 complete (verified 12/12 must-haves, 449 tests)

Progress: [██░░░░░░░░] 20%

## Milestones Shipped

| Version | Name | Phases | Shipped |
|---------|------|--------|---------|
| v1.0 | Foundational Backend | 1–6 | earlier |
| v1.1 | Frontend ↔ Backend Wiring | — | earlier |
| v1.5 | Site Roster Correction & Cohort Analytics | 7–9 | 2026-04-15 |
| v1.6 | Outcomes Polish & Scale | 10–13 | 2026-04-17 |

## Accumulated Context

### Key Constraints for v1.7

- Phase 14 (SEC-01 JWT pin) MUST execute before Phase 15 (TOTP) and Phase 18 (Keycloak OIDC) — closes algorithm confusion window
- Phase 15 (TOTP) MUST NOT remove the static OTP fallback until all users have enrolled — `totpEnabled` flag gates the old path
- Phase 16 (XCOHORT) can execute in parallel with Phase 15 — no auth dependency
- Phase 17 dark mode: Recharts SVG ignores Tailwind `dark:` classes — use `useTheme()` hook returning explicit hex values for chart props
- Phase 18 PKCE verifier must stay server-side (signed HttpOnly cookie) — never in localStorage
- Phase 18 cannot be E2E tested without a live Keycloak realm — integration tests deferred to post-merge

### Inherited from v1.6

- `shared/` pure-TS module: cohort math shared between server and client. No imports from `server/` or `src/`.
- Server aggregation at >1000-patient threshold via `POST /api/outcomes/aggregate`. JWT-center-filtered, TTL-cached.
- Cohort IDs HMAC-SHA256 hashed in all audit events (`server/hashCohortId.ts`). Secret auto-generated to `data/cohort-hash-secret.txt` (SEC-02).
- 4 outcome metrics: Visus logMAR, CRT µm, Treatment-Interval histogram, Responder classification.
- 449/449 tests passing across 49 files at Phase 14 close.

### Pending Todos

None.

### Blockers/Concerns

- Phase 18: No live Keycloak instance available for E2E testing. Plan must explicitly scope unit/integration tests as sufficient for merge; E2E deferred.

### Decisions (Phase 14)

- changeToken uses purpose='change-password'; verifyLocalToken rejects this purpose on protected routes (T-14-08 closed)
- mustChangePassword gate in App.tsx is before Routes, inside AppRoutes() inside AuthProvider — no URL bypass possible (T-14-09 closed)
- aria-label placed on outer OutcomesPanel div, not inside ResponsiveContainer — Recharts filters arbitrary DOM props
- _migrateUsersJson exported for testing (SEC-03 scan required file-system test assertions)

## Session Log

- 2026-04-17: Milestone v1.6 shipped. v1.7 roadmap created — 5 phases (14–18), 18 requirements mapped, 100% coverage.
- 2026-04-17: Phase 14 complete — 3/3 plans executed, verified 12/12 must-haves. SEC-01 (JWT HS256 pin on 2 call sites), SEC-02 (cohort-hash-secret.txt auto-gen), SEC-03 (forced pwd change flow end-to-end), PERF-01 (O(N+M) patientCases Map refactor), PERF-02 (FHIR cache warm IIFE at startup), A11Y-01 (aria-label on OutcomesPanel). 449 tests passing (+19 vs v1.6).
