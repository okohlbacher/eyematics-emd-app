---
gsd_state_version: 1.0
milestone: v1.12
milestone_name: — Quality, Configurability & Analysis Depth
status: completed
last_updated: "2026-05-25T22:43:25.941Z"
last_activity: 2026-05-25
progress:
  total_phases: 9
  completed_phases: 5
  total_plans: 13
  completed_plans: 14
  percent: 56
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-25 for v1.12)

**Core value:** Every user sees only authorized data, with tamper-proof audit trail — while maintaining the zero-friction local development experience.
**Current focus:** v1.12 roadmap created — ready to begin Phase 37 (UAT Re-test & Spec Lock)

## Current Position

Phase: 43
Plan: Not started
Status: Phase 38 Plan 01 complete — audit actor fallback relabeled to 'unauthenticated'
Last activity: 2026-05-25

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

## v1.12 Phase Map

| Phase | Name | Type | Status |
|-------|------|------|--------|
| 37 | UAT Re-test & Spec Lock | process/feedback | Not started |
| 38 | Audit Actor Correctness | feature (AUDIT-01) | Not started |
| 39 | Configurable Clinical Thresholds + Parity | feature (CFG-01/02/03) | Not started |
| 40 | SavedSearch Hardening + Quality Check Config | feature (SEC-06, QUAL-020/021) | Not started |
| 41 | Doc-Quality Correctness, Multi-Select Centers & UX | feature/UI (QUAL-022/023/024/025) | Not started |
| 42 | Analysis Cohort Comparison & Labeling | feature/UI (ANL-010/011/012) | Not started |
| 43 | Case Navigation, Reference & Chart Clarity | feature/UI (FALL-010/011/012, CHART-01) | Not started |
| 44 | Tech-Debt Compaction | refactor (TECH-01/02) | Not started |
| 45 | UAT Validation & Milestone Close | process/feedback | Not started |

## Accumulated Context

### Locked Decisions (v1.12, 2026-05-25)

- **D1 — threshold scope:** GLOBAL admin-configured thresholds (per-site / per-cohort deferred).
- **D1b — plausibility ranges:** centralized to `config/settings.yaml` AND admin-editable in SettingsPage (same config + validation pattern as critical thresholds).
- **D2 — QUAL-001 persistence:** quality parameter selection PERSISTS with the saved cohort → changes `SavedSearch` shape; F-13 pulled forward to pair with this work (Phase 40).
- **D3 — multi-select centers:** IN for v1.12 → shared multi-select center filter component consumed by quality (Phase 41) and analysis (Phase 42); server still enforces user's authorized centers.
- **PROT-001:** actor label for unauthenticated/401 requests → `'unauthenticated'` (not `'anonymous'`); deleted users keep immutable historical actor identity.
- **Milestone size:** ONE milestone v1.12 (Phases 37–45) — no split.
- Source: CODEX CLI (codex-cli 0.128.0) 3-round convergence + product-owner approval 2026-05-25.

### Decisions (inherited from v1.11 — authoritative)

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
- Refresh sessions use a SQLite `refresh_sessions` table (jti-keyed, WAL) — mirrors `auditDb.ts`.
- Refresh tokens rotate on every use with RFC 6819 family revocation; reuse of a rotated token revokes the family and returns 401.
- Signing-key rotation uses a dual-key window: existing sessions verify against the previous key until their absolute cap.
- Subcohort identity is name-only: a `SavedSearch` with exactly one `:` is a subcohort (`cohortNames.ts`); no new type field. Orphan subcohorts allowed with a soft warning.
- "Jump Back In" uses a client-side, per-username localStorage recent-activity store (`emd-recent:<username>`, cap 5); cleared on logout/login same-tab and cross-tab.

### Open Items (v1.12 — to resolve in Phase 37)

- FALL-003: CRT/Visus label wording decision (Phase 37 discussion)
- FALL-001: drill-down interaction pattern (Phase 37 discussion)
- Responder tooltip placement (Phase 37 discussion)
- A-06: screenshot repro of missing axis ticks (Phase 37)
- QUAL-011: absolute-value discoverability — where on the page (Phase 37 discussion)

### Open Items (carried)

- KEYCLK-01: Real Keycloak OIDC redirect flow (blocked by M7) — pushed to backlog

### Deferred Items

#### Accepted tech debt at v1.11 close — addressed in v1.12

| Category | ID | Item | Phase |
|----------|----|------|-------|
| soc-violation | F-01 | Server outcome aggregation ignores settings-derived filter thresholds | 39 (CFG-03) |
| soc-violation | F-02 | Clinical thresholds live outside `settings.yaml` | 39 (CFG-01) |
| dead-code | F-03 | Unreachable Keycloak runtime path — blocked by KEYCLK-01 | Out of scope v1.12 |
| oversized-module | F-09 | `authApi.ts` God module (1,175 lines) | 44 (TECH-01) |
| oversized-module | F-10 | `OutcomesView.tsx` multi-responsibility | 44 (TECH-02) |
| soc-violation | F-13 | Saved-search provenance is client-owned | 40 (SEC-06) |

### Blockers

- None

## Operator Next Steps

- Phase 38 Plan 01 complete. Continue with next Phase 38 plan or advance to Phase 39.

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 34 P01 | 15 | 2 tasks | 4 files |
| Phase 34 P02 | 10 | 2 tasks | 3 files |
| Phase 34 P03 | 25 minutes | 3 tasks | 14 files |
| Phase 34 P04 | 10m | 2 tasks | 4 files |
| Phase 35 P02 | 8 minutes | 2 tasks | 1 files |
| Phase 38 P01 | 8 minutes | 2 tasks | 5 files |

## Decisions

- [Phase ?]: Phase 34 Plan 04: CSS tokens for semantic colors
