---
gsd_state_version: 1.0
milestone: v1.7
milestone_name: Security, Performance & Cross-Cohort
status: executing
last_updated: "2026-04-17T10:15:08.836Z"
last_activity: 2026-04-17 -- Phase 14 planning complete
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 3
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-17)

**Core value:** Every user sees only authorized data, with tamper-proof audit trail — while `/outcomes` stays fast, visually polished, and useful beyond visus.
**Current focus:** Milestone v1.7 — Phase 14 ready to plan

## Current Position

Phase: 14 of 18 (Security Quick Wins & Performance)
Plan: — (not yet planned)
Status: Ready to execute
Last activity: 2026-04-17 -- Phase 14 planning complete

Progress: [░░░░░░░░░░] 0%

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
- Cohort IDs HMAC-SHA256 hashed in all audit events (`server/hashCohortId.ts`). Secret in `config/settings.yaml`.
- 4 outcome metrics: Visus logMAR, CRT µm, Treatment-Interval histogram, Responder classification.
- 430/430 tests passing across 47 files at v1.6 close.

### Pending Todos

None.

### Blockers/Concerns

- Phase 18: No live Keycloak instance available for E2E testing. Plan must explicitly scope unit/integration tests as sufficient for merge; E2E deferred.

## Session Log

- 2026-04-17: Milestone v1.6 shipped. v1.7 roadmap created — 5 phases (14–18), 18 requirements mapped, 100% coverage.
