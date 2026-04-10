---
phase: 03-integration-fixes
plan: "02"
subsystem: test-infrastructure
tags: [test, rate-limiting, settings-validation, audit, vitest]
dependency_graph:
  requires: [03-01]
  provides: [vitest-config, rate-limiter-module, automated-test-coverage]
  affects: [server/rateLimiting.ts, server/authApi.ts, vitest.config.ts, package.json, tests/]
tech_stack:
  added: [vitest@4.1.4, "@vitest/coverage-v8@4.1.4"]
  patterns: [factory-function-extraction, lazy-init-singleton, static-source-analysis, fake-timers]
key_files:
  created:
    - vitest.config.ts
    - server/rateLimiting.ts
    - tests/rateLimiting.test.ts
    - tests/settingsValidator.test.ts
    - tests/auditBodyCapture.test.ts
    - tests/auditTimeFilter.test.ts
  modified:
    - package.json
    - server/authApi.ts
decisions:
  - "createRateLimiter factory takes maxLoginAttempts as parameter (not calling getAuthConfig internally) — enables isolated unit testing without initAuth() setup"
  - "Lazy-init singleton _limiter in authApi.ts ensures /login and /verify share one lock counter instance"
  - "auditTimeFilter tests use static source file analysis (readFileSync) rather than runtime import — avoids browser API dependency in Node test environment"
  - "import.meta.url + fileURLToPath used in auditTimeFilter.test.ts for __dirname equivalent in ESM"
metrics:
  duration_minutes: 20
  completed_date: "2026-04-10T11:30:13Z"
  tasks_completed: 3
  files_changed: 8
---

# Phase 03 Plan 02: Vitest Setup and Automated Test Coverage Summary

**One-liner:** Vitest installed and configured, rate limiting extracted into testable factory module, 30 automated tests covering USER-13 (rate limiting), AUTH-05 (settings validator), AUDIT-01/AUDIT-09 (body capture), and AUDIT-02 (time filter params).

## What Was Built

Installed the vitest test framework, extracted the rate limiting module for testability, and wrote 4 test files covering all Phase 3 bug fixes and requirements.

### Task 1 — Vitest install + rate limiting extraction (53a8141)

**vitest setup:**
- Installed `vitest@^4.1.4` and `@vitest/coverage-v8@^4.1.4` as devDependencies
- Created `vitest.config.ts` with `environment: 'node'` and `include: ['tests/**/*.test.ts']`
- Added `"test": "vitest run"` and `"test:coverage": "vitest run --coverage"` scripts to `package.json`

**Rate limiting extraction:**
- Created `server/rateLimiting.ts` with `createRateLimiter(maxLoginAttempts: number)` factory and exported `LockState` interface. The factory takes `maxLoginAttempts` as a constructor parameter rather than calling `getAuthConfig()` internally — this is the key change enabling isolated unit tests.
- Refactored `server/authApi.ts` to import `createRateLimiter` from `./rateLimiting.js` and use a lazy-init `_limiter` singleton. Both `/login` and `/verify` handlers call `limiter()` which returns the same `_limiter` instance — preserving the shared lock counter behavior.

### Task 2 — Rate limiting and settings validator tests (b9b4195)

**tests/rateLimiting.test.ts (10 tests, USER-13):**
- Uses `vi.useFakeTimers()` + `vi.setSystemTime()` for deterministic timing — Codex MEDIUM concern addressed
- Covers: zero state for unknown user, failure increment, lock threshold (N-1 does not lock, N locks), exponential backoff value (2^5 * 1000ms), reset on success, configurable maxLoginAttempts (3 and 10), isLocked returns false for past timestamp, unlock after backoff elapses

**tests/settingsValidator.test.ts (12 tests, AUTH-05):**
- Covers: valid settings null return, settings without optional otpCode, null/non-object input, missing auth section, wrong twoFactorEnabled type, invalid maxLoginAttempts (zero and float), otpCode as non-string, top-level twoFactorEnabled rejection, missing therapyInterrupterDays, missing dataSource

### Task 3 — Audit body capture and time filter tests (c7dc39a)

**tests/auditBodyCapture.test.ts (4 tests, AUDIT-01, AUDIT-09):**
- Creates mock `IncomingMessage` streams via Node.js `Readable` class
- Verifies `readBody()` attaches `_capturedBody` to req for JSON body, YAML body, and empty body
- Verifies `readBody()` return value (resolved string) is unchanged — backward compatibility preserved

**tests/auditTimeFilter.test.ts (4 tests, AUDIT-02):**
- Static source analysis using `readFileSync` on `src/services/auditService.ts`
- Verifies filter interface uses `fromTime?:` and `toTime?:` (not `from?:` and `to?:`)
- Verifies `URLSearchParams` uses `'fromTime'` and `'toTime'` keys (not `'from'` and `'to'`)
- Uses `fileURLToPath(import.meta.url)` for ESM-compatible `__dirname`

## Commits

| Task | Commit | Files |
|------|--------|-------|
| 1: Vitest + rate limiting extraction | 53a8141 | vitest.config.ts (new), server/rateLimiting.ts (new), server/authApi.ts, package.json, package-lock.json |
| 2: Rate limiting + settings validator tests | b9b4195 | tests/rateLimiting.test.ts (new), tests/settingsValidator.test.ts (new) |
| 3: Audit body capture + time filter tests | c7dc39a | tests/auditBodyCapture.test.ts (new), tests/auditTimeFilter.test.ts (new) |

## Deviations from Plan

None — plan executed exactly as written.

The plan specified `import.meta.dirname` for the auditTimeFilter test. In Node 20 ESM, `import.meta.dirname` may not be available (it was added in Node 21). Used `dirname(fileURLToPath(import.meta.url))` instead — functionally identical and broadly compatible. This is a Rule 1 auto-fix (compatibility bug prevented by preemptive correction).

## Known Stubs

None — all changes are test infrastructure and production code refactoring with no placeholder values.

## Threat Flags

No new security surface introduced. The rate limiting extraction preserves identical in-memory lockout behavior. The single shared `_limiter` instance ensures `/login` and `/verify` share one lock counter (T-03-05 mitigation confirmed).

## Self-Check: PASSED
