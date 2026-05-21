---
gsd_state_version: 1.0
milestone: v1.11
milestone_name: Verification & Validation Backfill
status: planning
last_updated: "2026-05-21T15:02:21.789Z"
last_activity: 2026-05-21
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-21 after v1.10)

**Core value:** Every user sees only authorized data, with tamper-proof audit trail — while maintaining the zero-friction local development experience.
**Current focus:** Between milestones — plan next via `/gsd-new-milestone` (next phase: 32)

## Current Position

Phase: Not started (defining requirements — PAUSED)
Plan: —
Status: Requirements drafted (VVBACK-01..05), NOT committed; roadmap not yet created
Last activity: 2026-05-21 — Milestone v1.11 started; paused before roadmap

**Resume note (paused 2026-05-21):** PROJECT.md + STATE.md committed (`56d882b`).
`.planning/REQUIREMENTS.md` is a draft on disk (uncommitted) with VVBACK-01..05.
Before building the roadmap, fold in a few issues from the last major UAT (to be
pulled in 2026-05-22), then commit requirements and spawn the roadmapper.
Phase numbering continues at 32. `phases.clear` was intentionally NOT run — v1.11
deliverables live inside the in-tree phase dirs `.planning/phases/27..31/`.

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
| v1.10 | Session Hardening & UX Closure | 27–31 | 2026-05-21 |

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
- Refresh sessions use a SQLite `refresh_sessions` table (jti-keyed, WAL) — the no-database constraint was revisited at Phase 27 plan time and SQLite chosen (already a dependency for audit). Mirrors `auditDb.ts`.
- Refresh tokens rotate on every use with RFC 6819 family revocation; reuse of a rotated token revokes the family and returns 401.
- Signing-key rotation uses a dual-key window: existing sessions verify against the previous key until their absolute cap (admin endpoint `POST /api/auth/rotate-key`).
- Subcohort identity is name-only: a `SavedSearch` with exactly one `:` is a subcohort (`cohortNames.ts`); no new type field. Orphan subcohorts allowed with a soft warning.
- "Jump Back In" uses a client-side, per-username localStorage recent-activity store (`emd-recent:<username>`, cap 5); cleared on logout/login same-tab and cross-tab.

### Open Items (carry to next milestone)

- KEYCLK-01: Real Keycloak OIDC redirect flow (blocked by M7) — pushed to backlog

### Deferred Items

Acknowledged and accepted as tech debt at v1.10 milestone close on 2026-05-21:

| Category | Item | Status |
|----------|------|--------|
| verification | Phases 27 & 28 have no VERIFICATION.md (evidenced by SUMMARYs + green tests + integration check) | accepted — backfill via `/gsd-verify-work` |
| nyquist | VALIDATION.md for phases 27/28/29 left `draft`/`nyquist_compliant: false` | accepted — closable via `/gsd-validate-phase` |
| nyquist | Phase 31 VALIDATION `wave_0_complete: false` despite passing VERIFICATION + UAT | accepted — cosmetic |

### Blockers

- None

## Operator Next Steps

- (2026-05-22) Pull in the few outstanding issues from the last major UAT and add them as requirements to `.planning/REQUIREMENTS.md`
- Commit requirements, then create the v1.11 roadmap (continues at Phase 32)
