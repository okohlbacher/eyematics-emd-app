---
phase: 04-user-management-data-persistence
plan: 02
subsystem: data-persistence
tags: [sqlite, express, per-user, quality-flags, saved-searches, excluded-cases, reviewed-cases]
dependency_graph:
  requires: []
  provides: [data-persistence-api, data-db-layer]
  affects: [server/index.ts]
tech_stack:
  added: [better-sqlite3 (data.db), crypto.randomUUID]
  patterns: [surrogate-id-pk, full-list-replacement-transaction, named-params-sql, server-derived-audit-fields]
key_files:
  created:
    - server/dataDb.ts
    - server/dataApi.ts
  modified:
    - server/index.ts
decisions:
  - surrogate-id-on-quality-flags: quality_flags uses id TEXT PRIMARY KEY not composite, enabling multiple flags per case+parameter with different errorTypes
  - server-derived-flaggedBy: flaggedBy is always set to req.auth.preferred_username (JWT), client-supplied values silently ignored
  - full-list-replacement: setQualityFlags/setExcludedCases/setReviewedCases use DELETE+INSERT transactions (not partial updates)
  - scoped-express-json: express.json() applied only to /api/auth and /api/data (not global) to avoid consuming raw stream for issueApiHandler/settingsApiHandler
  - express-json-before-audit: /api/data body parser mounted before auditMiddleware so req.body is populated when audit captures mutation bodies
metrics:
  duration: ~20 minutes
  completed_date: "2026-04-10"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 04 Plan 02: Data Persistence Backend Summary

Per-user SQLite data layer (data/data.db) with Express Router providing 8 endpoints for quality flags (surrogate id PK), saved searches, excluded cases, and reviewed cases — server-derived audit fields, payload validation with size caps, and correct middleware ordering in index.ts.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create dataDb.ts SQLite layer with surrogate id and updated_at | b376718 | server/dataDb.ts |
| 2 | Create dataApi.ts router and mount in index.ts with correct order | eebd974 | server/dataApi.ts, server/index.ts |

## What Was Built

### server/dataDb.ts

SQLite persistence layer for `data/data.db` (separate from `audit.db`):

- `initDataDb(dataDir)` — opens/creates data.db with WAL mode, creates 4 tables
- **quality_flags**: surrogate `id TEXT PRIMARY KEY` (not composite) supporting multiple flags per case+parameter; all rows include `updated_at`
- **saved_searches**: `filters` stored as JSON blob; `updated_at` on all rows
- **excluded_cases** / **reviewed_cases**: composite `(username, case_id)` PK with `updated_at`
- All queries use named parameters (`@username`, `@case_id`) — no string concatenation
- `setQualityFlags` / `setExcludedCases` / `setReviewedCases` use `db.transaction()` for atomic DELETE+INSERT
- `crypto.randomUUID()` generates surrogate ids for quality flags when not provided

### server/dataApi.ts

Express Router with 8 endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/data/quality-flags | Return user's quality flags (camelCase) |
| PUT | /api/data/quality-flags | Replace user's quality flags; flaggedBy from JWT |
| GET | /api/data/saved-searches | Return user's saved searches |
| POST | /api/data/saved-searches | Add new saved search |
| DELETE | /api/data/saved-searches/:id | Remove saved search by id |
| GET | /api/data/excluded-cases | Return user's excluded case IDs |
| PUT | /api/data/excluded-cases | Replace user's excluded cases |
| GET | /api/data/reviewed-cases | Return user's reviewed case IDs |
| PUT | /api/data/reviewed-cases | Replace user's reviewed cases |

Security measures implemented per threat model:
- T-04-09: username always from `req.auth!.preferred_username` (JWT), never from request body
- T-04-10: all SQL uses named parameters via better-sqlite3 prepared statements
- T-04-11: authMiddleware runs on all /api/* (dataApiRouter mounted after it)
- T-04-12: flaggedBy always set to JWT username; client-supplied value silently ignored
- T-04-13: MAX_ARRAY_SIZE=10000 on all bulk arrays; filters capped at 50KB; express.json limit 1mb
- T-04-14: required fields validated (caseId, parameter, errorType for flags; id, name, filters for searches); status validated against allowlist

### server/index.ts

Three changes:
1. Added imports for `initDataDb` and `dataApiRouter`
2. Called `initDataDb(DATA_DIR)` immediately after `initAuditDb(DATA_DIR, retentionDays)`
3. Added `app.use('/api/data', express.json({ limit: '1mb' }))` BEFORE `auditMiddleware` (review concern #9), and `app.use('/api/data', dataApiRouter)` AFTER `authMiddleware`

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Surrogate id on quality_flags | Client appends multiple flags per case+parameter with different errorTypes — composite PK would reject duplicates |
| Server-derived flaggedBy | Security: client cannot spoof attribution; always comes from verified JWT |
| Full-list replacement (not patch) | Simpler consistency model — client sends authoritative list; server replaces atomically |
| express.json() before auditMiddleware | req.body must be populated before audit middleware captures mutation bodies |
| Scoped express.json() (not global) | issueApiHandler and settingsApiHandler use readBody() on the raw stream; global parser would consume it |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript error on req.params.id**
- **Found during:** Task 2 verification
- **Issue:** `req.params.id` has type `string | string[]` per `ParamsDictionary` in @types/express-serve-static-core; `removeSavedSearch` expects `string`
- **Fix:** Wrapped with `String(req.params.id ?? '')` to normalize to string
- **Files modified:** server/dataApi.ts (line 174)
- **Commit:** eebd974

## Known Stubs

None — all endpoints are fully wired to the SQLite layer.

## Threat Flags

No new threat surface beyond what was modeled in the plan's `<threat_model>`. All 7 threats (T-04-09 through T-04-15) have mitigations implemented.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| server/dataDb.ts | FOUND |
| server/dataApi.ts | FOUND |
| Commit b376718 (dataDb.ts) | FOUND |
| Commit eebd974 (dataApi.ts + index.ts) | FOUND |
| TypeScript compiles without errors | PASSED |
