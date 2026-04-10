# Phase 3: Phase 1-2 Integration Fixes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 03-integration-fixes
**Areas discussed:** Param naming convention, Schema validator scope, Verification approach

---

## Gray Area Selection

User selected 3 of 4 areas. Skipped: Body capture fix (left to Claude's discretion).

---

## Param Naming Convention

| Option | Description | Selected |
|--------|-------------|----------|
| Fix server to read 'from'/'to' | Simpler param names, matches client. Less disruptive. | |
| Fix client to send 'fromTime'/'toTime' | More explicit, avoids SQL reserved word conflicts. | ✓ |
| You decide | Let Claude pick based on codebase conventions. | |

**User's choice:** Fix client to send 'fromTime'/'toTime'
**Notes:** Server API contract stays as-is. Client auditService.ts adapts to server.

---

## Schema Validator Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal: patch check path | Just fix twoFactorEnabled path. Quick. | |
| Full: validate auth section | Rewrite to validate entire auth section (twoFactorEnabled, maxLoginAttempts, jwtSecret, otpCode). | ✓ |
| Replace with schema library | Use zod or similar. Overkill for current scope. | |

**User's choice:** Full: validate auth section
**Notes:** Validate all auth fields that getAuthConfig() consumes. Catches future mismatches.

---

## Verification Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Code review + grep assertions | Verify by reading code. No runtime testing. | |
| Add automated tests | Write test files for rate limiting and settings validation. | ✓ |
| Manual test script | curl-based test script. Middle ground. | |

**User's choice:** Add automated tests
**Notes:** Tests should exercise actual server functions (unit-level), not require running server. Cover rate limiting lock/backoff/reset and full auth section validation.

---

## Claude's Discretion

- Body capture fix approach — user did not discuss, left to Claude
- Test framework choice (vitest expected)
- Long-term readBody() consolidation (note for Phase 4)

## Deferred Ideas

None — discussion stayed within phase scope.
