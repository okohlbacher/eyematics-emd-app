---
phase: "08"
plan: "08-02"
subsystem: "audit-api"
tags: [audit, endpoint, beacon, no-op, authentication]
dependency_graph:
  requires: []
  provides: ["GET /api/audit/events/view-open endpoint"]
  affects: ["08-03 (client calls this endpoint on OutcomesPage mount)"]
tech_stack:
  added: []
  patterns: ["Express Router no-op 204 beacon", "audit-middleware implicit capture"]
key_files:
  created: []
  modified:
    - server/auditApi.ts
    - tests/auditApi.test.ts
decisions:
  - "Handler returns 204 No Content; audit row is written implicitly by auditMiddleware — no explicit DB call from the handler (matches D-32 and RESEARCH finding 2)"
  - "No role gate applied — any authenticated user may emit a view-open beacon for their own session"
  - "Comment block at end of auditApi.ts updated to clarify append-only via middleware"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-15"
  tasks_completed: 1
  files_modified: 2
---

# Phase 8 Plan 2: Add view-open audit beacon endpoint — Summary

**One-liner:** Thin 204 no-op `GET /api/audit/events/view-open` endpoint lets the Outcomes page beacon a server-side audit row via the existing auditMiddleware capture path.

## What Was Built

Added `auditApiRouter.get('/events/view-open', ...)` to `server/auditApi.ts`. The handler does exactly one thing: `res.status(204).end()`. The audit middleware (`server/auditMiddleware.ts`), which runs before all handlers, automatically captures method / path / query string / user / duration / status into `audit_log` — so the beacon produces exactly one row per call with no handler-side DB write.

## Endpoint Contract

| Field | Value |
|-------|-------|
| Method | GET |
| Path | `/api/audit/events/view-open` |
| Auth | Inherited from `authMiddleware` (mounted in `server/index.ts` before `auditApiRouter`); unauthenticated → 401 |
| Role gate | None — any authenticated role |
| Response status | 204 No Content |
| Response body | Empty |
| Side effects | One `audit_log` row inserted by `auditMiddleware` (implicit) |

## Audit-log Row Shape (from middleware)

```
method:   GET
path:     /api/audit/events/view-open
query:    name=open_outcomes_view&cohort=<savedSearchId>   (or filter=<urlencoded-JSON>)
user:     req.auth.preferred_username
status:   204
duration: <ms>
```

The `query` field is recorded verbatim — clients cannot inject a different `user` value (that comes from the verified JWT claim `preferred_username`).

## Query-string Shape for 08-03

The client (08-03) should call one of these patterns on OutcomesPage mount:

```
# Saved cohort:
GET /api/audit/events/view-open?name=open_outcomes_view&cohort=<savedSearchId>

# Ad-hoc filter:
GET /api/audit/events/view-open?name=open_outcomes_view&filter=<urlencoded-JSON-filter>
```

Use `authFetch(...)` (the authenticated fetch wrapper) so the request carries the session cookie/token that authMiddleware validates.

## Tests Added (tests/auditApi.test.ts)

4 new test cases in `describe('GET /api/audit/events/view-open — view-open beacon')`:

1. `user` role + cohort query string → 204, empty body
2. `admin` role → 204 (no role gate)
3. Oversized urlencoded filter (20-element array) → 204 (no query-param rejection)
4. `POST` to same URL → 404 (guards against accidental write route)

All 11 tests (7 existing + 4 new) pass.

## Deviations from Plan

None — plan executed exactly as written.

## Deferred Items

- **Per-route rate limit** (T-08-03 `accept` disposition): If beacon spam is observed in production, apply `rateLimit({ max: 10, windowMs: 60_000 })` locally on the `/events/view-open` route. Not added now — the global rate limiter (`server/rateLimiting.ts`) applies to `/api/*` and the 204 handler itself does zero DB work, making individual requests cheap.

## Threat Flags

None — no new attack surface beyond what was already present for `/api/audit`. Auth gate is inherited from the existing `authMiddleware` mount.

## Self-Check: PASSED

- `server/auditApi.ts` — FOUND
- `tests/auditApi.test.ts` — FOUND
- Commit `3bbdca6` — FOUND
- 11/11 tests passing
