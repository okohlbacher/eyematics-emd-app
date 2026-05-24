---
gsd_state_version: 1.0
milestone: v1.11
milestone_name: — UAT Fixes, Data Completeness & Quality Closure
status: executing
last_updated: "2026-05-24T16:49:52.102Z"
last_activity: 2026-05-24
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 13
  completed_plans: 11
  percent: 60
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-21 after v1.10)

**Core value:** Every user sees only authorized data, with tamper-proof audit trail — while maintaining the zero-friction local development experience.
**Current focus:** Phase 35 — v-v-backfill

## Current Position

Phase: 35 (v-v-backfill) — EXECUTING
Plan: 2 of 3
Status: Ready to execute
Last activity: 2026-05-24

**Progress:** [█████████░] 85%

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

- AUTHCFG-04: lockoutCapMs named for cap semantics; formula `min(2^failures*1s, cap)` preserved; `resetLimiter()` exported from authApi and called by settingsApi PUT after updateAuthConfig (avoids circular import).
- AUTHCFG-01: both unknown-user and known-user login failure branches are symmetric — 429+retryAfterMs on lockout, 401+attemptsRemaining otherwise (T-32-06 non-enumeration parity).
- AUTHCFG-02/03: WARNING_BEFORE default raised to 3 min (180 s); inactivity timers sourced from settings.auth.* with safe-default fallback (T-32-09); inactivitySecondsRemaining live countdown in context.
- auth.inactivityTimeoutMs/warningBeforeMs/lockoutCapMs are NOT stripped from non-admin GET /api/settings (W5 — operational params, not secrets).
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

1. `/gsd-plan-phase 33` — plan Phase 33: Cohort Builder UX & Advanced Filters (COH-01/02/03/04, DASH-02)
2. Then execute Phases 33–36 in sequence
3. Optional: human UAT of Phase 32's 3 runtime UI behaviors (32-VERIFICATION.md)
4. Phase 36 is the final gate: ARCH review + compaction + VVBACK-05 green test:ci

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 34 P01 | 15 | 2 tasks | 4 files |
| Phase 34 P02 | 10 | 2 tasks | 3 files |
| Phase 34 P03 | 25 minutes | 3 tasks | 14 files |
| Phase 34 P04 | 10m | 2 tasks | 4 files |

## Decisions

- [Phase ?]: Phase 34 Plan 04: CSS tokens for semantic colors
