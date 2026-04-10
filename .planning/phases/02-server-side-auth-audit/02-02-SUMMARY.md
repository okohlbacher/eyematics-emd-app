---
phase: 02-server-side-auth-audit
plan: 02
subsystem: audit-infrastructure
tags: [audit, sqlite, middleware, express, better-sqlite3]
dependency_graph:
  requires: []
  provides: [server/auditDb.ts, server/auditMiddleware.ts, server/auditApi.ts]
  affects: [server/index.ts]
tech_stack:
  added: [better-sqlite3@^12.8.0, "@types/better-sqlite3"]
  patterns: [WAL-mode SQLite, prepared-statement caching, res.on('finish') middleware, body redaction]
key_files:
  created:
    - server/auditDb.ts
    - server/auditMiddleware.ts
    - server/auditApi.ts
  modified:
    - package.json (added better-sqlite3, @types/better-sqlite3, @types/express, express)
decisions:
  - "WAL mode enabled via pragma journal_mode=WAL for concurrent reads during writes"
  - "Prepared statements cached after initAuditDb(), not at module load time — db may not be initialized"
  - "req.auth read at finish time (not request time) so 401 responses are captured with user=anonymous"
  - "REDACT_PATHS uses exact path matching (not prefix) — /api/auth/login and /api/auth/verify only"
  - "queryAudit uses separate COUNT(*) query (same WHERE) for accurate pagination total"
metrics:
  duration: "~20 minutes"
  completed: "2026-04-10"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 1
---

# Phase 02 Plan 02: Audit Infrastructure Summary

**One-liner:** SQLite audit database (WAL mode, 90-day purge), response-wrapping middleware with body redaction, and read-only Express API with admin-only export.

## What Was Built

Three new server files form a complete, tamper-proof audit logging system:

1. **`server/auditDb.ts`** — Pure database layer. Opens/creates `data/audit.db` with WAL mode. Exposes `initAuditDb`, `logAuditEntry` (synchronous insert), `purgeOldEntries` (90-day DELETE), `startPurgeInterval` (startup + 24h interval), `queryAudit` (filtered paginated read with correct total), and `queryAuditExport` (full admin dump).

2. **`server/auditMiddleware.ts`** — Express middleware mounted before authMiddleware to capture 401 responses. Registers `res.on('finish')` to log after response completes. Redacts `password`, `otp`, and `challengeToken` from `/api/auth/login` and `/api/auth/verify` bodies before storage. Skips non-`/api/*` paths.

3. **`server/auditApi.ts`** — Read-only Express Router. `GET /api/audit` with 7 filter params returns `{ entries, total, limit, offset }` where `total` is a separate `COUNT(*)` (correct pagination). `GET /api/audit/export` checks `req.auth?.role === 'admin'`, returns 403 otherwise, sets `Content-Disposition` for download. No write routes defined.

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: auditDb.ts | cf67abf | server/auditDb.ts, package.json, package-lock.json |
| Task 2: auditMiddleware.ts | f6ceb05 | server/auditMiddleware.ts |
| Task 3: auditApi.ts | ea56cda | server/auditApi.ts |

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-02-07 (Information Disclosure) | REDACT_FIELDS covers password, otp, challengeToken for REDACT_PATHS |
| T-02-08 (Information Disclosure) | admin role check before export; 403 for non-admin |
| T-02-09 (Tampering) | No write/delete routes in auditApi.ts — append-only from API perspective |
| T-02-10 (Repudiation) | auditMiddleware designed to mount before authMiddleware; captures 401s with user='anonymous' |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Express and @types/express not installed in worktree**
- **Found during:** Task 2 — TypeScript compilation of auditMiddleware.ts required Express types
- **Issue:** Worktree's node_modules lacked @types/express and express packages
- **Fix:** `npm install --save-dev @types/express express` in worktree context
- **Files modified:** package.json, package-lock.json
- **Commit:** cf67abf (included with Task 1)

### Out-of-scope Pre-existing Issues

`server/index.ts` has type errors `TS2305: Module '"./issueApi.js"' has no exported member 'issueApiHandler'` — these result from the worktree reset placing pre-Plan-01 versions of issueApi.ts/settingsApi.ts, while index.ts expects post-Plan-01 exports. This is a parallel wave coordination issue resolved when the orchestrator merges all worktrees. Not fixed (out of scope).

## Known Stubs

None — all three files are fully wired to each other. Plan 03 (server/index.ts wiring) is responsible for mounting these exports; that dependency is documented in acceptance criteria.

## Self-Check

- [x] server/auditDb.ts exists with 6 exports
- [x] server/auditMiddleware.ts exports auditMiddleware
- [x] server/auditApi.ts exports auditApiRouter
- [x] Commits cf67abf, f6ceb05, ea56cda exist in git log
- [x] TypeScript: no errors in audit files (`npx tsc --noEmit --project tsconfig.server.json` shows no audit errors)
- [x] No POST/PUT/PATCH/DELETE in auditApi.ts
- [x] REDACT_PATHS covers /api/auth/login and /api/auth/verify
- [x] queryAudit returns { rows, total } with separate COUNT query
