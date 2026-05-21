---
gsd_state_version: 1.0
milestone: v1.10
milestone_name: — Session Hardening & UX Closure
status: executing
last_updated: "2026-05-14T14:30:00.000Z"
last_activity: 2026-05-14 -- Phase 28 complete (Admin Session Control UI)
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 8
  completed_plans: 8
  percent: 40
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-01)

**Core value:** Every user sees only authorized data, with tamper-proof audit trail — while maintaining the zero-friction local development experience.
**Current focus:** Phase 29 — home-panel-ux

## Current Position

Phase: 29 (home-panel-ux) — NEXT
Plan: 0 of ?
Status: Phase 28 complete, Phase 29 pending planning
Last activity: 2026-05-14 -- Phase 28 complete (Admin Session Control UI)

```
Progress: [████████░░░░░░░░░░░░] 40% (2/5 phases)
```

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
- Phase 27 storage: refresh-sessions table must use the same JSON-file storage pattern as the rest of v1 (no new SQLite tables without revisiting the no-database constraint; SQLite already used for audit log — decision to revisit at plan time).

### Open Items (carry to next milestone)

- KEYCLK-01: Real Keycloak OIDC redirect flow (blocked by M7) — pushed to backlog

### Blockers

- None
