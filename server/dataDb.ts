/**
 * Data persistence layer — per-user SQLite storage for quality flags,
 * saved searches, excluded cases, and reviewed cases.
 *
 * Mirrors auditDb.ts patterns: synchronous better-sqlite3, WAL mode,
 * named parameters in all queries.
 *
 * Per D-06: all data keyed by username for per-user isolation.
 * Per D-07: separate data.db from audit.db.
 * Per D-08: different access patterns (mutable CRUD vs immutable append-only).
 *
 * Review concern #4: quality_flags uses surrogate id (not composite PK)
 *   to support multiple flags per case/parameter with different errorTypes.
 * Review concern #5: flaggedBy/flaggedAt are server-derived, not client-supplied.
 * Review suggestion: all tables include updated_at column.
 */

import Database from 'better-sqlite3';
import path from 'node:path';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Module-level db instance (populated by initDataDb)
// ---------------------------------------------------------------------------

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) throw new Error('[dataDb] called before initDataDb()');
  return db;
}

// ---------------------------------------------------------------------------
// 1. initDataDb
// ---------------------------------------------------------------------------

export function initDataDb(dataDir: string): void {
  const dbPath = path.join(dataDir, 'data.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS quality_flags (
      id          TEXT PRIMARY KEY,
      username    TEXT NOT NULL,
      case_id     TEXT NOT NULL,
      parameter   TEXT NOT NULL,
      error_type  TEXT NOT NULL,
      flagged_at  TEXT NOT NULL,
      flagged_by  TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'open',
      updated_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_qf_username ON quality_flags(username);

    CREATE TABLE IF NOT EXISTS saved_searches (
      id          TEXT PRIMARY KEY,
      username    TEXT NOT NULL,
      name        TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      filters     TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ss_username ON saved_searches(username);

    CREATE TABLE IF NOT EXISTS excluded_cases (
      username    TEXT NOT NULL,
      case_id     TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      PRIMARY KEY (username, case_id)
    );

    CREATE TABLE IF NOT EXISTS reviewed_cases (
      username    TEXT NOT NULL,
      case_id     TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      PRIMARY KEY (username, case_id)
    );
  `);

  console.log('[dataDb] Opened data database:', dbPath);
}

// ---------------------------------------------------------------------------
// 2. Quality Flags (surrogate id PK — review concern #4)
// ---------------------------------------------------------------------------

export interface QualityFlagRow {
  id: string;
  case_id: string;
  parameter: string;
  error_type: string;
  flagged_at: string;
  flagged_by: string;
  status: string;
  updated_at: string;
}

export function getQualityFlags(username: string): QualityFlagRow[] {
  return getDb()
    .prepare(
      'SELECT id, case_id, parameter, error_type, flagged_at, flagged_by, status, updated_at FROM quality_flags WHERE username = @username ORDER BY flagged_at DESC',
    )
    .all({ username }) as QualityFlagRow[];
}

/**
 * Replace all quality flags for a user. Uses transaction: DELETE all then INSERT all.
 * Each flag gets a server-generated id if not provided.
 * flaggedBy and flaggedAt are server-derived (review concern #5).
 */
export function setQualityFlags(username: string, flags: QualityFlagRow[]): void {
  const d = getDb();
  const del = d.prepare('DELETE FROM quality_flags WHERE username = @username');
  const ins = d.prepare(
    `INSERT INTO quality_flags (id, username, case_id, parameter, error_type, flagged_at, flagged_by, status, updated_at)
     VALUES (@id, @username, @case_id, @parameter, @error_type, @flagged_at, @flagged_by, @status, @updated_at)`,
  );
  const now = new Date().toISOString();
  const tx = d.transaction(() => {
    del.run({ username });
    for (const f of flags) {
      ins.run({
        id: f.id || crypto.randomUUID(),
        username,
        case_id: f.case_id,
        parameter: f.parameter,
        error_type: f.error_type,
        flagged_at: f.flagged_at,
        flagged_by: f.flagged_by,
        status: f.status,
        updated_at: now,
      });
    }
  });
  tx();
}

// ---------------------------------------------------------------------------
// 3. Saved Searches
// ---------------------------------------------------------------------------

export interface SavedSearchRow {
  id: string;
  name: string;
  created_at: string;
  filters: string; // JSON string
  updated_at: string;
}

export function getSavedSearches(username: string): SavedSearchRow[] {
  return getDb()
    .prepare(
      'SELECT id, name, created_at, filters, updated_at FROM saved_searches WHERE username = @username ORDER BY created_at DESC',
    )
    .all({ username }) as SavedSearchRow[];
}

export function addSavedSearch(username: string, search: SavedSearchRow): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      'INSERT OR REPLACE INTO saved_searches (id, username, name, created_at, filters, updated_at) VALUES (@id, @username, @name, @created_at, @filters, @updated_at)',
    )
    .run({ username, ...search, updated_at: now });
}

export function removeSavedSearch(username: string, id: string): void {
  getDb()
    .prepare('DELETE FROM saved_searches WHERE username = @username AND id = @id')
    .run({ username, id });
}

// ---------------------------------------------------------------------------
// 4. Excluded Cases
// ---------------------------------------------------------------------------

export function getExcludedCases(username: string): string[] {
  const rows = getDb()
    .prepare('SELECT case_id FROM excluded_cases WHERE username = @username')
    .all({ username }) as { case_id: string }[];
  return rows.map((r) => r.case_id);
}

export function setExcludedCases(username: string, caseIds: string[]): void {
  const d = getDb();
  const del = d.prepare('DELETE FROM excluded_cases WHERE username = @username');
  const ins = d.prepare(
    'INSERT INTO excluded_cases (username, case_id, updated_at) VALUES (@username, @case_id, @updated_at)',
  );
  const now = new Date().toISOString();
  const tx = d.transaction(() => {
    del.run({ username });
    for (const case_id of caseIds) {
      ins.run({ username, case_id, updated_at: now });
    }
  });
  tx();
}

// ---------------------------------------------------------------------------
// 5. Reviewed Cases
// ---------------------------------------------------------------------------

export function getReviewedCases(username: string): string[] {
  const rows = getDb()
    .prepare('SELECT case_id FROM reviewed_cases WHERE username = @username')
    .all({ username }) as { case_id: string }[];
  return rows.map((r) => r.case_id);
}

export function setReviewedCases(username: string, caseIds: string[]): void {
  const d = getDb();
  const del = d.prepare('DELETE FROM reviewed_cases WHERE username = @username');
  const ins = d.prepare(
    'INSERT INTO reviewed_cases (username, case_id, updated_at) VALUES (@username, @case_id, @updated_at)',
  );
  const now = new Date().toISOString();
  const tx = d.transaction(() => {
    del.run({ username });
    for (const case_id of caseIds) {
      ins.run({ username, case_id, updated_at: now });
    }
  });
  tx();
}
