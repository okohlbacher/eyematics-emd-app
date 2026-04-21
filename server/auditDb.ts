/**
 * Audit database layer — SQLite-backed, append-only audit log.
 *
 * Design principles:
 * - Synchronous operations via better-sqlite3 (no async complexity)
 * - WAL mode for safe concurrent reads during writes
 * - Prepared statements cached after initAuditDb() (never at module load time)
 * - No HTTP concerns — pure database layer
 *
 * Per D-14: schema uses audit_log(id, timestamp, method, path, user,
 *           status, duration_ms, body, query)
 * Per D-15: 90-day rolling retention, runs on startup and every 24 hours
 */

import path from 'node:path';

import Database from 'better-sqlite3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditDbRow {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  user: string;
  status: number;
  duration_ms: number;
  body: string | null;
  query: string | null;
}

export interface AuditFilters {
  user?: string;
  method?: string;
  path?: string;
  fromTime?: string;
  toTime?: string;
  action_category?: 'auth' | 'data' | 'admin' | 'outcomes';
  body_search?: string;
  status_gte?: number;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Module-level db instance and cached prepared statements
// (populated only after initAuditDb() is called)
// ---------------------------------------------------------------------------

let db: Database.Database | null = null;

let stmtInsert: Database.Statement | null = null;
let stmtPurge: Database.Statement | null = null;
let _retentionDays = 90;

// ---------------------------------------------------------------------------
// 1. initAuditDb
// ---------------------------------------------------------------------------

/**
 * Create or open data/audit.db with WAL mode.
 * Creates the audit_log table and indexes if they do not exist.
 * Caches prepared statements for insert and purge.
 *
 * Must be called once at server startup before any other function.
 */
export function initAuditDb(dataDir: string, retentionDays = 90): void {
  _retentionDays = retentionDays;
  const dbPath = path.join(dataDir, 'audit.db');
  db = new Database(dbPath);

  // WAL mode: readers do not block writers; writers do not block readers
  db.pragma('journal_mode = WAL');

  // Create table and indexes (D-14 schema)
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id          TEXT    PRIMARY KEY,
      timestamp   TEXT    NOT NULL,
      method      TEXT    NOT NULL,
      path        TEXT    NOT NULL,
      user        TEXT    NOT NULL DEFAULT 'anonymous',
      status      INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      body        TEXT,
      query       TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_user      ON audit_log(user);
    CREATE INDEX IF NOT EXISTS idx_audit_path      ON audit_log(path);
  `);

  // Cache prepared statements
  stmtInsert = db.prepare(`
    INSERT INTO audit_log (id, timestamp, method, path, user, status, duration_ms, body, query)
    VALUES (@id, @timestamp, @method, @path, @user, @status, @duration_ms, @body, @query)
  `);

  stmtPurge = db.prepare(
    `DELETE FROM audit_log WHERE timestamp < datetime('now', '-' || @days || ' days')`,
  );

  console.log(`[auditDb] Opened audit database: ${dbPath}`);
}

// ---------------------------------------------------------------------------
// 2. logAuditEntry
// ---------------------------------------------------------------------------

/**
 * Synchronously insert a single audit row.
 * Called from auditMiddleware on every API request.
 */
export function logAuditEntry(entry: AuditDbRow): void {
  if (!stmtInsert) {
    throw new Error('[auditDb] logAuditEntry called before initAuditDb()');
  }
  stmtInsert.run(entry);
}

// ---------------------------------------------------------------------------
// 3. purgeOldEntries
// ---------------------------------------------------------------------------

/**
 * Delete audit entries older than the configured retention period.
 * Returns the number of rows deleted.
 */
export function purgeOldEntries(): number {
  if (!stmtPurge) {
    throw new Error('[auditDb] purgeOldEntries called before initAuditDb()');
  }
  const result = stmtPurge.run({ days: _retentionDays });
  const count = result.changes;
  if (count > 0) {
    console.log(`[auditDb] Purged ${count} audit entries older than ${_retentionDays} days`);
  }
  return count;
}

// ---------------------------------------------------------------------------
// 4. startPurgeInterval
// ---------------------------------------------------------------------------

let _purgeTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Run purgeOldEntries immediately, then schedule it every 24 hours (D-15).
 * Call once at server startup after initAuditDb().
 * Guards against timer accumulation on hot-reload by clearing any existing
 * interval before registering a new one.
 */
export function startPurgeInterval(): void {
  if (_purgeTimer !== null) clearInterval(_purgeTimer);
  purgeOldEntries();
  _purgeTimer = setInterval(purgeOldEntries, 24 * 60 * 60 * 1000);
}

/** Exported for test teardown only — stops the purge interval. */
export function stopPurgeInterval(): void {
  if (_purgeTimer !== null) { clearInterval(_purgeTimer); _purgeTimer = null; }
}

// ---------------------------------------------------------------------------
// 5. queryAudit
// ---------------------------------------------------------------------------

/**
 * Query the audit log with optional filters, limit, and offset.
 *
 * Returns { rows, total } where:
 * - rows: the paginated result set
 * - total: the full COUNT(*) without LIMIT/OFFSET (enables correct pagination UI)
 *
 * Per Codex finding: total is computed with a separate COUNT query using the
 * same WHERE clauses but no LIMIT/OFFSET.
 */
export function queryAudit(
  filters: AuditFilters,
): { rows: AuditDbRow[]; total: number } {
  if (!db) {
    throw new Error('[auditDb] queryAudit called before initAuditDb()');
  }

  const limit = Math.min(filters.limit ?? 50, 500);
  const offset = filters.offset ?? 0;

  const { whereClause, params } = buildWhereClause(filters);

  const rowsSql = `
    SELECT id, timestamp, method, path, user, status, duration_ms, body, query
    FROM audit_log
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT @limit OFFSET @offset
  `;

  const countSql = `
    SELECT COUNT(*) AS total
    FROM audit_log
    ${whereClause}
  `;

  const rows = db.prepare(rowsSql).all({ ...params, limit, offset }) as AuditDbRow[];
  const countRow = db.prepare(countSql).get(params) as { total: number };

  return { rows, total: countRow.total };
}

// ---------------------------------------------------------------------------
// 6. queryAuditExport
// ---------------------------------------------------------------------------

/**
 * Return audit rows ordered by timestamp DESC with a safety limit.
 * Used for GET /api/audit/export (admin full dump).
 * F-05: Capped at 100 000 rows to prevent OOM on large databases.
 */
const MAX_EXPORT_ROWS = 100_000;

export function queryAuditExport(): AuditDbRow[] {
  if (!db) {
    throw new Error('[auditDb] queryAuditExport called before initAuditDb()');
  }
  return db
    .prepare(
      `SELECT id, timestamp, method, path, user, status, duration_ms, body, query
       FROM audit_log
       ORDER BY timestamp DESC
       LIMIT ?`,
    )
    .all(MAX_EXPORT_ROWS) as AuditDbRow[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build a parameterised WHERE clause from AuditFilters.
 * All string params use named placeholders to prevent SQL injection.
 */
function buildWhereClause(
  filters: AuditFilters,
): { whereClause: string; params: Record<string, unknown> } {
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.user !== undefined) {
    conditions.push('user = @filterUser');
    params['filterUser'] = filters.user;
  }
  if (filters.method !== undefined) {
    conditions.push('method = @filterMethod');
    params['filterMethod'] = filters.method;
  }
  if (filters.path !== undefined) {
    conditions.push('path LIKE @filterPath');
    params['filterPath'] = `%${filters.path}%`;
  }
  if (filters.fromTime !== undefined) {
    conditions.push('timestamp >= @filterFromTime');
    params['filterFromTime'] = filters.fromTime;
  }
  if (filters.toTime !== undefined) {
    conditions.push('timestamp <= @filterToTime');
    params['filterToTime'] = filters.toTime;
  }
  if (filters.action_category !== undefined) {
    switch (filters.action_category) {
      case 'auth':
        conditions.push("(path LIKE '/api/auth/%' AND path NOT LIKE '/api/auth/users/%')");
        break;
      case 'data':
        conditions.push("path LIKE '/api/data/%'");
        break;
      case 'admin':
        conditions.push("(path LIKE '/api/auth/users/%' OR path = '/api/settings')");
        break;
      case 'outcomes':
        conditions.push("(path LIKE '/api/outcomes/%' OR path = '/api/audit/events/view-open')");
        break;
    }
  }
  if (filters.body_search !== undefined) {
    conditions.push('(body LIKE @filterBodySearch OR query LIKE @filterBodySearch)');
    params['filterBodySearch'] = `%${filters.body_search}%`;
  }
  if (filters.status_gte !== undefined) {
    conditions.push('status >= @filterStatusGte');
    params['filterStatusGte'] = filters.status_gte;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, params };
}
