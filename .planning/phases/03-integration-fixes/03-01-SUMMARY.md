---
phase: 03-integration-fixes
plan: "01"
subsystem: server-audit-settings
tags: [bug-fix, audit, type-safety, settings-validation]
dependency_graph:
  requires: [02-server-side-auth-audit]
  provides: [audit-body-capture, audit-time-filter, settings-auth-validator]
  affects: [server/auditMiddleware.ts, server/utils.ts, src/services/auditService.ts, server/settingsApi.ts]
tech_stack:
  added: []
  patterns: [express-request-augmentation, body-capture-attach-to-req, tryParseJson-fallback]
key_files:
  created:
    - server/types.d.ts
  modified:
    - server/utils.ts
    - server/auditMiddleware.ts
    - src/services/auditService.ts
    - server/settingsApi.ts
decisions:
  - "Type augmentation in server/types.d.ts uses express-serve-static-core (not express) for full Request interface coverage"
  - "readBody() attaches _capturedBody before resolving — auditMiddleware reads it at finish time (stream-safe)"
  - "tryParseJson: JSON bodies parsed for redaction path traversal; YAML stays as raw string"
  - "validateSettingsSchema exported and validates canonical nested auth.* fields (no jwtSecret — lives in data/jwt-secret.txt)"
metrics:
  duration_minutes: 25
  completed_date: "2026-04-10T11:24:25Z"
  tasks_completed: 4
  files_changed: 5
---

# Phase 03 Plan 01: Integration Fixes — Audit Body, Time Filter, Settings Validator Summary

**One-liner:** Three integration bugs fixed via type-safe _capturedBody attach-to-req pattern, fromTime/toTime param rename, and nested auth section validator rewrite with export.

## What Was Built

Fixed three silent integration bugs found during the v1.0 milestone audit, plus added proper TypeScript type augmentation to eliminate ad-hoc casts.

### Task 1 — Express Request type augmentation (a0cc5ed)

Created `server/types.d.ts` with a `declare module 'express-serve-static-core'` augmentation adding `_capturedBody?: string` to the Express Request interface. This makes all subsequent `req._capturedBody` accesses type-safe without `as unknown as Record` casts.

### Task 2 — Audit body capture for non-auth mutations (a342789)

**Bug D-01:** `auditMiddleware` read `req.body` at `res.on('finish')` time, but `express.json()` is only mounted on `/api/auth`. For `POST /api/issues` and `PUT /api/settings`, `req.body` was always `undefined`, producing `body: null` audit entries.

**Fix:**
- `server/utils.ts`: `readBody()` now attaches the consumed body string to `req._capturedBody` before resolving — single stream consumer pattern, no replay needed.
- `server/auditMiddleware.ts`: Added `tryParseJson()` helper. Body capture now uses `req.body` first (auth routes), then `req._capturedBody` via `tryParseJson()` fallback (all other mutations). JSON bodies get parsed for REDACT_PATHS traversal; YAML bodies stay as raw strings.

### Task 3 — Audit time filter param names (4880342)

**Bug D-02:** Client sent `from`/`to` query params but server (`auditApi.ts`) reads `fromTime`/`toTime`. Time-range filtering silently returned all results.

**Fix:** Renamed filter interface fields and `URLSearchParams` keys in `src/services/auditService.ts` from `from`/`to` to `fromTime`/`toTime`. Server contract unchanged.

### Task 4 — Settings schema validator nested auth section (d1e8fb5)

**Bug D-03:** `validateSettingsSchema()` checked `obj.twoFactorEnabled` (top-level) but the canonical `settings.yaml` structure has `auth.twoFactorEnabled` (nested). Any valid settings write-back would be rejected.

**Fix:** Rewrote `validateSettingsSchema()` in `server/settingsApi.ts`:
- Added `export` keyword for direct import in unit tests (D-05)
- Removed broken top-level `obj.twoFactorEnabled` check
- Added `obj.auth` object existence check
- Validates `auth.twoFactorEnabled` (boolean), `auth.maxLoginAttempts` (positive integer), `auth.otpCode` (optional string)
- No `jwtSecret` validation — JWT secret is in `data/jwt-secret.txt`, not `settings.yaml`

## Commits

| Task | Commit | Files |
|------|--------|-------|
| 1: Type augmentation | a0cc5ed | server/types.d.ts (new) |
| 2: Body capture fix | a342789 | server/utils.ts, server/auditMiddleware.ts |
| 3: Time filter fix | 4880342 | src/services/auditService.ts |
| 4: Settings validator | d1e8fb5 | server/settingsApi.ts |

## Deviations from Plan

None — plan executed exactly as written.

The `auditMiddleware.ts` already had a `declare module 'express-serve-static-core'` block for `req.auth` (from Phase 2). The new `server/types.d.ts` adds `_capturedBody` to the same module augmentation without conflict — TypeScript merges interface declarations across files.

## Known Stubs

None — all changes are production code fixes with no placeholder values.

## Threat Flags

No new security surface introduced. Changes are:
- Type declaration only (types.d.ts)
- String attachment to existing request object (utils.ts)
- Fallback read path in existing middleware (auditMiddleware.ts)
- Client-side param rename (auditService.ts)
- Validator logic tightening with export (settingsApi.ts)

All within the existing threat model (T-03-01, T-03-02, T-03-03 in plan frontmatter).

## Self-Check: PASSED
