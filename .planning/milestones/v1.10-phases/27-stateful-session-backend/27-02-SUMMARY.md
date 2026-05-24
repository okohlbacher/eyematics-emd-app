---
phase: 27
plan: 02
status: complete
completed_at: "2026-05-11"
---

# Plan 27-02 Summary — sessionsDb module + index.ts wiring

## What was delivered

Created `server/sessionsDb.ts` (216 lines) — a synchronous SQLite storage layer for refresh sessions, mirroring the `server/auditDb.ts` pattern exactly.

### Schema (SESS-02 / D-04)
```sql
CREATE TABLE IF NOT EXISTS refresh_sessions (
  id           TEXT    PRIMARY KEY,   -- jti UUID
  sid          TEXT    NOT NULL,      -- session family
  username     TEXT    NOT NULL,
  ver          INTEGER NOT NULL,      -- tokenVersion at issuance
  issued_at    TEXT    NOT NULL,      -- ISO8601
  expires_at   TEXT    NOT NULL,      -- ISO8601
  last_used_at TEXT,
  revoked      INTEGER NOT NULL DEFAULT 0,
  key_id       TEXT    NOT NULL       -- SHA256(secret) first 8 hex chars
);
CREATE INDEX idx_sess_sid      ON refresh_sessions(sid);
CREATE INDEX idx_sess_username ON refresh_sessions(username);
CREATE INDEX idx_sess_cleanup  ON refresh_sessions(revoked, expires_at);
```

### Cleanup WHERE clause (D-14)
```sql
DELETE FROM refresh_sessions
WHERE datetime(expires_at) < datetime('now')
   OR (revoked = 1 AND last_used_at IS NOT NULL
       AND datetime(last_used_at) < datetime('now', '-7 days'))
```

### Exported API
| Function | Purpose |
|----------|---------|
| `initSessionsDb(dataDir)` | Open/create sessions.db, WAL mode, prepare statements |
| `insertSession(row)` | INSERT new session row (named params) |
| `getSession(id)` | SELECT by jti, returns row or null |
| `revokeSession(id)` | UPDATE revoked=1 for single jti |
| `revokeFamily(sid)` | UPDATE revoked=1 for all rows sharing sid |
| `purgeExpiredSessions()` | DELETE expired/stale-revoked rows |
| `startSessionCleanupInterval()` | Run purge once + every 24h |
| `_closeForTests()` | Close DB singleton (test teardown only) |

### server/index.ts changes
Added after `initAuditDb`/`startPurgeInterval`:
```typescript
initSessionsDb(DATA_DIR);
startSessionCleanupInterval();
```

## Test results
- `tests/sessionsDb.test.ts`: 8/8 green ✓
- Full suite: 702 total (695 passing before Plan 03 scaffolds)

## Notes
- Committed via manual cp from worktree (executor had API error on merge)
- Commits: 884dbeb (sessionsDb.ts), fee070b (index.ts wiring)
