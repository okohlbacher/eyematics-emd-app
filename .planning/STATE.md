---
gsd_state_version: 1.0
milestone: v1.9.5
milestone_name: Synthetic Data Realism
status: shipped
last_updated: "2026-05-01T00:00:00.000Z"
last_activity: 2026-05-01
progress:
  total_phases: 1
  completed_phases: 1
  total_plans: 4
  completed_plans: 4
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-01)

**Core value:** Every user sees only authorized data, with tamper-proof audit trail — while maintaining the zero-friction local development experience.
**Current focus:** Milestone v1.9.5 shipped — planning next milestone.

## Current Position

Phase: 26 (complete)
Status: Milestone v1.9.5 shipped
Last activity: 2026-05-01

## Milestones Shipped

| Version | Name | Phases | Shipped |
|---------|------|--------|---------|
| v1.0 | Foundational Backend | 1–6 | earlier |
| v1.1 | Frontend ↔ Backend Wiring | — | earlier |
| v1.5 | Site Roster Correction & Cohort Analytics | 7–9 | 2026-04-15 |
| v1.6 | Outcomes Polish & Scale | 10–13 | 2026-04-17 |
| v1.7 | Security, Performance & Cross-Cohort | 14–17 | 2026-04-21 |
| v1.8 | Session Resilience & Test/Code Polish | 18–20 | 2026-04-23 |
| v1.9 | Codebase Consistency & Test/Tech-Debt Polish | 21–23 | 2026-04-23 |
| v1.9.3 | Production Feedback Fixes (partial) | 24 | 2026-04-28 |
| v1.9.4 | Terminology Resolver Refactor (partial) | 25 | 2026-04-30 |
| v1.9.5 | Synthetic Data Realism | 26 | 2026-05-01 |

## Accumulated Context

### Decisions (authoritative)

- All `jwt.verify()` call sites route through `server/jwtUtil.ts` with HS256 hard pin; ESLint `no-restricted-imports` enforces.
- AuditPage uses useReducer state machine; `describeAction` lives at `src/pages/audit/auditFormatters.ts`.
- Refresh storage: httpOnly `Secure` `SameSite=Strict` cookie scoped to `/api/auth/refresh`.
- Session caps: 8h refresh TTL / 12h absolute, configurable via `settings.yaml` (`auth.refreshTokenTtlMs` / `auth.refreshAbsoluteCapMs`).
- Codebase has no jest-dom — RTL uses queryByText().not.toBeNull() / .toBeNull() (Vitest/Chai native).
- Terminology: `_seedMap` has 15 entries; `EXPECTED_SEED_KEYS` in audit script mirrors it; drift-guard test enforces symmetry.
- Reference bundles (Aachen, Tübingen) are curated and must NOT be regenerated (D-06).
- Synthetic bundles (Chemnitz, Leipzig, Greifswald, Münster) must be regenerated atomically (D-11).

### Open Items (carry to next milestone)

- FB-02: Home "Attention needed" panel — Review buttons not wired (Phase 24-02 not executed)
- FB-03: Home "Jump Back In" panel — arrows not wired (Phase 24-03 not executed)
- TERM-04: Terminology settings.yaml keys + Konfiguration.md docs (Phase 25-04 not executed)
- KEYCLK-01: Real Keycloak OIDC redirect flow (blocked by M7)
- SESSION-10/11: Admin-triggered force sign-out, stateful refresh-sessions table

### Blockers

- None

## Session Continuity

Last session: 2026-05-01
Stopped at: v1.9.5 milestone archived
Next step: `/gsd-new-milestone` to plan next milestone
