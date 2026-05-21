---
gsd_state_version: 1.0
milestone: v1.11
milestone_name: — UAT Fixes, Data Completeness & Quality Closure
status: planning
last_updated: "2026-05-21T18:19:47.267Z"
last_activity: 2026-05-21 — Roadmap created for v1.11 (Phases 32–36)
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 2
  completed_plans: 1
  percent: 10
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-21 after v1.10)

**Core value:** Every user sees only authorized data, with tamper-proof audit trail — while maintaining the zero-friction local development experience.
**Current focus:** v1.11 — Phase 32: User Management & Auth Hardening

## Current Position

Phase: 32 — User Management & Auth Hardening
Plan: 32-01 complete; 32-02 next
Status: Plan 32-01 executed (UMGMT-01/02/03 satisfied)
Last activity: 2026-05-21 — Executed 32-01: user activation lifecycle + dialog hardening

**Progress:** `[░][ ][ ][ ][ ]` 1/2 plans in Phase 32; 0/5 phases complete

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

- Inactive user gate: `user.active === false` → generic 401 `{ error: 'Invalid credentials' }` at both POST /login and POST /verify (T-02-05 non-enumeration preserved).
- Session revocation on deactivation: `revokeByUsername(target)` called after write commits, in try/catch (sessionsDb-uninit safe, PROT-001 parity).
- `editActive` seeded from `user.active !== false` in `startEdit` (absent active field means active — migration-safe).
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

### Open Items

- KEYCLK-01: Real Keycloak OIDC redirect flow (blocked by M7) — pushed to backlog

### Deferred Items

Acknowledged and accepted as tech debt at v1.10 milestone close on 2026-05-21 — to be closed in v1.11 Phase 35:

| Category | Item | Status |
|----------|------|--------|
| verification | Phases 27 & 28 have no VERIFICATION.md (evidenced by SUMMARYs + green tests + integration check) | v1.11 Phase 35 — VVBACK-01/02 |
| nyquist | VALIDATION.md for phases 27/28/29 left `draft`/`nyquist_compliant: false` | v1.11 Phase 35 — VVBACK-03 |
| nyquist | Phase 31 VALIDATION `wave_0_complete: false` despite passing VERIFICATION + UAT | v1.11 Phase 35 — VVBACK-04 |

### Blockers

- None

## Operator Next Steps

1. `/gsd-plan-phase 32` — plan Phase 32: User Management & Auth Hardening (UMGMT-01/02/03, AUTHCFG-01/02/03/04)
2. Execute Phase 32, then plan and execute Phases 33–36 in sequence
3. Phase 36 is the final gate: ARCH review + compaction + VVBACK-05 green test:ci
