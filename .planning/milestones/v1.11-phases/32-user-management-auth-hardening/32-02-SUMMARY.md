---
phase: 32-user-management-auth-hardening
plan: 02
subsystem: auth
tags: [auth, rate-limiting, inactivity, i18n, config]
dependency_graph:
  requires: [32-01]
  provides: [AUTHCFG-01, AUTHCFG-02, AUTHCFG-03, AUTHCFG-04]
  affects: [server/authApi.ts, server/initAuth.ts, server/rateLimiting.ts, server/settingsApi.ts, src/context/AuthContext.tsx, src/pages/LoginPage.tsx, src/components/Layout.tsx]
tech_stack:
  added: []
  patterns: [configurable-rate-limiter, settings-driven-timers, symmetric-lockout-branches, live-countdown]
key_files:
  created:
    - tests/loginLockout.test.ts
    - tests/inactivitySettings.test.ts
  modified:
    - config/settings.yaml
    - server/authApi.ts
    - server/initAuth.ts
    - server/rateLimiting.ts
    - server/settingsApi.ts
    - src/services/settingsService.ts
    - src/context/AuthContext.tsx
    - src/pages/LoginPage.tsx
    - src/components/Layout.tsx
    - src/i18n/translations.ts
    - tests/rateLimiting.test.ts
    - tests/settingsApi.test.ts
    - tests/authConfigProvider.test.ts
decisions:
  - "lockoutCapMs named for cap semantics (not a fixed window) — formula min(2^failures*1s, cap) preserved exactly"
  - "resetLimiter() exported from authApi; settingsApi calls it after updateAuthConfig to avoid circular import"
  - "Unknown-user branch now mirrors known-user: 429 on lockout, 401+attemptsRemaining otherwise (T-32-06 non-enumeration parity)"
  - "WARNING_BEFORE default raised to 3 min (180 s) from prior 60 s (AUTHCFG-02)"
  - "auth.inactivityTimeoutMs/warningBeforeMs/lockoutCapMs NOT stripped from non-admin GET /api/settings (W5)"
  - "GET /api/auth/config unchanged — no maxLoginAttempts added (Blocker #4)"
metrics:
  duration: ~25 minutes
  completed: 2026-05-21
  tests_before: 806
  tests_after: 828
  tests_added: 22
---

# Phase 32 Plan 02: Auth Config Hardening (AUTHCFG-01..04) Summary

Settings-driven auth constants + symmetric lockout branches + live countdown UIs. All four AUTHCFG requirements closed.

## Tasks Completed

### Task 1: Externalize maxLoginAttempts + lockout cap; rebuildable rate limiter (AUTHCFG-04)

**Commits:** 011da76

- `config/settings.yaml`: added `auth.maxLoginAttempts: 5`, `auth.lockoutCapMs: 900000` (with comment explaining cap semantics), `auth.inactivityTimeoutMs: 600000`, `auth.warningBeforeMs: 180000`
- `server/rateLimiting.ts`: `createRateLimiter(maxAttempts, lockoutCapMs = 3_600_000)` — cap is now a parameter; backoff formula `min(2^failures * 1000, lockoutCapMs)` unchanged
- `server/initAuth.ts`: `AuthConfig` extended with `lockoutCapMs`; both `initAuth()` and `updateAuthConfig()` read `settings.auth.maxLoginAttempts ?? settings.maxLoginAttempts ?? 5` and `settings.auth.lockoutCapMs ?? 900_000`
- `server/authApi.ts`: `resetLimiter()` exported; `limiter()` passes `getAuthConfig().lockoutCapMs` to `createRateLimiter()`
- `server/settingsApi.ts`: validator extended for four new auth keys (positive integers, `warningBeforeMs < inactivityTimeoutMs`); `resetLimiter()` called immediately after `updateAuthConfig()` in PUT path (Blocker #1)

### Task 2: Symmetric attempts-remaining + lockout on both login branches (AUTHCFG-01 data path)

**Commits:** c804e59

- `server/authApi.ts`: unknown-user branch now captures `newState = limiter().recordFailure(key)`, checks `isLocked(newState)` — returns 429 with `retryAfterMs` on lockout (new branch), else 401 with `attemptsRemaining` (Blocker #2 / T-32-06)
- Known-user bad-password branch updated: 401 now includes `attemptsRemaining: Math.max(0, maxLoginAttempts - newState.count)`
- `src/context/AuthContext.tsx`: `LoginResult` extended with `attemptsRemaining?: number`; 401 body parsed to extract it
- GET `/api/auth/config` left unchanged — no `maxLoginAttempts` added (Blocker #4)

### Task 3: Settings-driven client timers + live countdowns (AUTHCFG-02/03)

**Commits:** 630a15d

- `src/services/settingsService.ts`: `AppSettings.auth` extended with `inactivityTimeoutMs?`, `warningBeforeMs?`, `maxLoginAttempts?`; `DEFAULTS.auth` sets `inactivityTimeoutMs: 600000`, `warningBeforeMs: 180000`
- `src/context/AuthContext.tsx`: `WARNING_BEFORE` raised to 3 min (180 s); settings-load effect runs on user mount — uses `loadSettings()` to source timer values, falls back to exported defaults if rejected (T-32-09); adds `inactivitySecondsRemaining` (live countdown via 1s interval, only while warning active) to context type
- `src/components/Layout.tsx`: inactivity banner renders mm:ss countdown via `inactivitySecondsRemaining` + `t('inactivityCountdown')`
- `src/pages/LoginPage.tsx`: shows `loginAttemptsRemaining` count after 401 (when `> 0`); starts a 1s interval countdown when account_locked 429; disables submit button during lockout; cleans up interval on unmount/step change
- `src/i18n/translations.ts`: three new keys added with DE+EN translations: `inactivityCountdown`, `loginAttemptsRemaining`, `loginLockoutCountdown`

## Deviations from Plan

### Auto-fixed Issues

None.

### Test Structure Deviation (Rule 3 — blocked path)

The plan specified adding new tests to `tests/authConfigProvider.test.ts`. However, that file mocks `rateLimiting.js` globally (all responses hardcoded), so threshold-crossing 429 tests could not be expressed there. Created a new `tests/loginLockout.test.ts` with real rate limiting (not mocked) to verify the full lockout behavior. The plan's verification goal (unknown-user threshold crossing returns 429) is fully covered by this file.

## Test Count

| Metric | Count |
|--------|-------|
| Before 32-02 | 806 |
| After 32-02 | 828 |
| New tests added | +22 |

New test files: `tests/loginLockout.test.ts` (7 tests), `tests/inactivitySettings.test.ts` (7 tests)
Extended: `tests/rateLimiting.test.ts` (+5), `tests/settingsApi.test.ts` (+5)

## AUTHCFG Requirements Status

| Req | Description | Status |
|-----|-------------|--------|
| AUTHCFG-01 | Login page shows remaining attempts + lockout countdown | Satisfied |
| AUTHCFG-02 | Live inactivity countdown in warning banner; 3-min lead | Satisfied |
| AUTHCFG-03 | Inactivity constants sourced from settings with safe-default fallback | Satisfied |
| AUTHCFG-04 | maxLoginAttempts + lockoutCapMs from settings; live config change via resetLimiter | Satisfied |

## Blockers Resolved

| Blocker | Resolution |
|---------|------------|
| #1 Limiter frozen at construction | `resetLimiter()` exported; called by settingsApi PUT after `updateAuthConfig()` |
| #2 Unknown-user not returning 429 | Unknown-user branch now symmetric: checks `isLocked()`, returns 429 or 401+attemptsRemaining |
| #3 No inactivity settings tests | `tests/inactivitySettings.test.ts` covers settings-sourced timers + fallback |
| #4 GET /config must not add maxLoginAttempts | Left untouched; LoginPage uses only 401 body `attemptsRemaining` |

## Threat Surface Scan

No new network endpoints added. The settings PUT path already existed; the addition of `resetLimiter()` in that path is purely in-process and introduces no new attack surface. The new `auth.*` config keys are validated server-side before write (T-32-10 mitigated).

## Self-Check: PASSED

All key files confirmed present. All commits verified in git log. Full CI (828 tests) green.
