/**
 * Sessions database layer — SQLite-backed, stateful refresh-session store.
 *
 * Design principles:
 * - Synchronous operations via better-sqlite3 (no async complexity)
 * - WAL mode for safe concurrent reads during writes
 * - Prepared statements cached after initSessionsDb() (never at module load time)
 * - No HTTP concerns — pure database layer
 * - All queries use named parameters (@param) — no string concatenation in SQL
 *
 * Per SESS-02: schema uses refresh_sessions(id, sid, username, ver,
 *              issued_at, expires_at, last_used_at, revoked, key_id)
 * Per D-13 / D-14: 7-day revoked-row retention; runs on startup and every 24 hours
 */

import path from 'node:path';

import Database from 'better-sqlite3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionRow {
  id: string;           // jti UUID (PRIMARY KEY)
  sid: string;          // session family
  username: string;
  ver: number;          // tokenVersion at issuance
  issued_at: string;    // ISO8601
  expires_at: string;   // ISO8601
  last_used_at: string | null;
  revoked: number;      // 0 | 1
  key_id: string;       // first 8 hex chars of SHA256(signing key)
}

// ---------------------------------------------------------------------------
// Module-level db instance and cached prepared statements
// (populated only after initSessionsDb() is called)
// ---------------------------------------------------------------------------

let db: Database.Database | null = null;

let stmtInsert: Database.Statement | null = null;
let stmtGet: Database.Statement | null = null;
let stmtRevoke: Database.Statement | null = null;
let stmtRevokeFamily: Database.Statement | null = null;
let stmtRevokeByUsername: Database.Statement | null = null;
let stmtPurge: Database.Statement | null = null;

let _cleanupTimer: ReturnType<typeof setInterval> | null = null;

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function requireDb(): Database.Database {
  if (!db) throw new Error('[sessionsDb] not initialized — call initSessionsDb(dataDir) first');
  return db;
}

// ---------------------------------------------------------------------------
// 1. initSessionsDb
// ---------------------------------------------------------------------------

/**
 * Create or open data/sessions.db with WAL mode.
 * Creates the refresh_sessions table and indexes if they do not exist.
 * Caches prepared statements for all CRUD operations.
 *
 * Must be called once at server startup before any other function.
 */
export function initSessionsDb(dataDir: string): void {
  const dbPath = path.join(dataDir, 'sessions.db');
  db = new Database(dbPath);

  // WAL mode: readers do not block writers; writers do not block readers
  db.pragma('journal_mode = WAL');

  // Create table and indexes (SESS-02 schema, D-04 indexes)
  db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_sessions (
      id           TEXT    PRIMARY KEY,
      sid          TEXT    NOT NULL,
      username     TEXT    NOT NULL,
      ver          INTEGER NOT NULL,
      issued_at    TEXT    NOT NULL,
      expires_at   TEXT    NOT NULL,
      last_used_at TEXT,
      revoked      INTEGER NOT NULL DEFAULT 0,
      key_id       TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sess_sid      ON refresh_sessions(sid);
    CREATE INDEX IF NOT EXISTS idx_sess_username ON refresh_sessions(username);
    CREATE INDEX IF NOT EXISTS idx_sess_cleanup  ON refresh_sessions(revoked, expires_at);
  `);

  // Cache prepared statements
  stmtInsert = db.prepare(`
    INSERT INTO refresh_sessions
      (id, sid, username, ver, issued_at, expires_at, last_used_at, revoked, key_id)
    VALUES
      (@id, @sid, @username, @ver, @issued_at, @expires_at, @last_used_at, @revoked, @key_id)
  `);
  stmtGet = db.prepare(`SELECT * FROM refresh_sessions WHERE id = @id`);
  stmtRevoke = db.prepare(`UPDATE refresh_sessions SET revoked = 1 WHERE id = @id`);
  stmtRevokeFamily = db.prepare(`UPDATE refresh_sessions SET revoked = 1 WHERE sid = @sid`);
  stmtRevokeByUsername = db.prepare(`UPDATE refresh_sessions SET revoked = 1 WHERE username = @username AND revoked = 0`);
  stmtPurge = db.prepare(`
    DELETE FROM refresh_sessions
    WHERE datetime(expires_at) < datetime('now')
       OR (revoked = 1 AND last_used_at IS NOT NULL AND datetime(last_used_at) < datetime('now', '-7 days'))
  `);

  console.log(`[sessionsDb] Opened sessions database: ${dbPath}`);
}

// ---------------------------------------------------------------------------
// 2. insertSession
// ---------------------------------------------------------------------------

/**
 * Synchronously insert a new refresh-session row.
 * Called from /api/auth/refresh after issuing a new refresh token.
 */
export function insertSession(row: SessionRow): void {
  requireDb();
  stmtInsert!.run(row);
}

// ---------------------------------------------------------------------------
// 3. getSession
// ---------------------------------------------------------------------------

/**
 * Look up a refresh-session by its jti (id).
 * Returns the row or null if not found.
 */
export function getSession(id: string): SessionRow | null {
  requireDb();
  const row = stmtGet!.get({ id }) as SessionRow | undefined;
  return row ?? null;
}

// ---------------------------------------------------------------------------
// 4. revokeSession
// ---------------------------------------------------------------------------

/**
 * Mark a single refresh-session row as revoked (revoked=1).
 * Used on logout or detected token reuse for the individual token.
 */
export function revokeSession(id: string): void {
  requireDb();
  stmtRevoke!.run({ id });
}

// ---------------------------------------------------------------------------
// 5. revokeFamily
// ---------------------------------------------------------------------------

/**
 * Mark all refresh-session rows sharing the same sid as revoked (revoked=1).
 * Called on detected reuse of an already-consumed refresh token (T-SESS-03).
 */
export function revokeFamily(sid: string): void {
  requireDb();
  stmtRevokeFamily!.run({ sid });
}

// ---------------------------------------------------------------------------
// 6. revokeByUsername
// ---------------------------------------------------------------------------

/**
 * Revoke all active refresh-session rows for a given username.
 * Called when a user account is deleted so that any still-valid tokens
 * issued to that user cannot be used after deletion (PROT-001).
 * Returns the number of rows revoked.
 */
export function revokeByUsername(username: string): number {
  requireDb();
  const info = stmtRevokeByUsername!.run({ username });
  return info.changes;
}

// ---------------------------------------------------------------------------
// 7. purgeExpiredSessions
// ---------------------------------------------------------------------------

/**
 * Delete rows where:
 *   - expires_at < now (token expired), OR
 *   - revoked=1 AND last_used_at older than 7 days (safe audit window elapsed)
 *
 * Returns the number of deleted rows (D-14 cleanup WHERE clause).
 */
export function purgeExpiredSessions(): number {
  requireDb();
  const info = stmtPurge!.run();
  return info.changes;
}

// ---------------------------------------------------------------------------
// 8. startSessionCleanupInterval
// ---------------------------------------------------------------------------

/**
 * Run purgeExpiredSessions immediately, then schedule it every 24 hours (D-13).
 * Call once at server startup after initSessionsDb().
 * Guards against timer accumulation on hot-reload by clearing any existing
 * interval before registering a new one.
 */
export function startSessionCleanupInterval(): void {
  if (_cleanupTimer !== null) clearInterval(_cleanupTimer);
  purgeExpiredSessions();
  _cleanupTimer = setInterval(() => {
    try {
      const removed = purgeExpiredSessions();
      if (removed > 0) console.log(`[sessionsDb] cleanup removed ${removed} rows`);
    } catch (err) {
      console.error('[sessionsDb] cleanup failed', err);
    }
  }, 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Test-only: reset singleton (used by tmpdir-based tests during teardown)
// ---------------------------------------------------------------------------

export function _closeForTests(): void {
  if (_cleanupTimer !== null) { clearInterval(_cleanupTimer); _cleanupTimer = null; }
  if (db) { db.close(); db = null; }
  stmtInsert = stmtGet = stmtRevoke = stmtRevokeFamily = stmtPurge = null;
}
