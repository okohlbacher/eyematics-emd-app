---
gsd_state_version: 1.0
milestone: v1.11
milestone_name: — UAT Fixes, Data Completeness & Quality Closure
status: verifying
last_updated: "2026-05-24T17:48:24.641Z"
last_activity: 2026-05-24
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 16
  completed_plans: 16
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-21 after v1.10)

**Core value:** Every user sees only authorized data, with tamper-proof audit trail — while maintaining the zero-friction local development experience.
**Current focus:** v1.11 closed (2026-05-24) — ready to scope v1.12

## Current Position

Phase: 36
Plan: Not started
Status: Phase complete — ready for verification
Last activity: 2026-05-24

**Progress:** [██████████] 100%

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
| v1.11 | UAT Fixes, Data Completeness & Quality Closure | 32–36 | 2026-05-24 |

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

#### CLOSED at v1.11 (Phase 35, 2026-05-24)

| Category | Item | Status |
|----------|------|--------|
| verification | Phases 27 & 28 have no VERIFICATION.md (evidenced by SUMMARYs + green tests + integration check) | CLOSED — VVBACK-01/02 resolved by Phase 35 |
| nyquist | VALIDATION.md for phases 27/28/29 left `draft`/`nyquist_compliant: false` | CLOSED — VVBACK-03 resolved by Phase 35 |
| nyquist | Phase 31 VALIDATION `wave_0_complete: false` despite passing VERIFICATION + UAT | CLOSED — VVBACK-04 resolved by Phase 35 |

#### Accepted tech debt at v1.11 close — target v1.12

New items deferred from Phase 36 CODEX architecture review (Tier C). Reference: `.planning/reviews/v1.11-arch-review/FINDINGS.md`.

| Category | ID | Item | Target |
|----------|----|------|--------|
| soc-violation | F-01 | Server outcome aggregation ignores settings-derived filter thresholds (therapyBreaker, implausibleCrt) — latent correctness gap vs UI path | v1.12 |
| soc-violation | F-02 | Clinical thresholds (`CRITICAL_CRT_THRESHOLD`, etc.) live in `src/config/clinicalThresholds.ts` outside `settings.yaml` — violates single-config invariant | v1.12 |
| dead-code | F-03 | Unreachable Keycloak runtime path still wired through auth middleware — remove or gate behind real OIDC support (tied to KEYCLK-01) | v1.12 |
| oversized-module | F-09 | `authApi.ts` God module (1,175 lines) — split into `authLoginApi`, `authUserAdminApi`, `totpApi`, `sessionApi` | v1.12 |
| oversized-module | F-10 | `OutcomesView.tsx` owns too many unrelated responsibilities (URL parsing, cohort resolution, audit, aggregation routing, metric render) — decompose | v1.12 |
| soc-violation | F-13 | Saved-search provenance is client-owned — server should generate `id`/`createdAt` and validate/sanitize `filters` at API boundary | v1.12 |

### Blockers

- None

## Operator Next Steps

1. v1.11 is CLOSED. Use `/gsd-new-milestone` to scope v1.12.
2. v1.12 candidates: Tier C items from the v1.11 CODEX review (F-01, F-02, F-03, F-09, F-10, F-13) and KEYCLK-01 Keycloak OIDC flow.
3. 901/901 tests green; no blockers.

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 34 P01 | 15 | 2 tasks | 4 files |
| Phase 34 P02 | 10 | 2 tasks | 3 files |
| Phase 34 P03 | 25 minutes | 3 tasks | 14 files |
| Phase 34 P04 | 10m | 2 tasks | 4 files |
| Phase 35 P02 | 8 minutes | 2 tasks | 1 files |

## Decisions

- [Phase ?]: Phase 34 Plan 04: CSS tokens for semantic colors
