import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import { afterEach,beforeEach, describe, expect, it } from 'vitest';

import {
  getSession,
  initSessionsDb,
  insertSession,
  purgeExpiredSessions,
  revokeFamily,
  revokeSession,
  type SessionRow,
} from '../server/sessionsDb.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sessionsdb-test-'));
  initSessionsDb(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeRow(overrides: Partial<SessionRow> = {}): SessionRow {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? 'jti-1',
    sid: overrides.sid ?? 'sid-1',
    username: overrides.username ?? 'alice',
    ver: overrides.ver ?? 0,
    issued_at: overrides.issued_at ?? now,
    expires_at: overrides.expires_at ?? new Date(Date.now() + 60_000).toISOString(),
    last_used_at: overrides.last_used_at ?? null,
    revoked: overrides.revoked ?? 0,
    key_id: overrides.key_id ?? 'abcd1234',
  };
}

describe('sessionsDb — schema (SESS-02)', () => {
  it('creates refresh_sessions table with WAL mode at initSessionsDb', () => {
    const dbPath = path.join(tmpDir, 'sessions.db');
    expect(fs.existsSync(dbPath)).toBe(true);
    const probe = new Database(dbPath);
    const mode = probe.pragma('journal_mode', { simple: true });
    expect(mode).toBe('wal');
    const cols = probe.prepare("PRAGMA table_info(refresh_sessions)").all() as Array<{ name: string }>;
    const names = cols.map(c => c.name).sort();
    expect(names).toEqual(
      ['expires_at', 'id', 'issued_at', 'key_id', 'last_used_at', 'revoked', 'sid', 'username', 'ver'].sort(),
    );
    probe.close();
  });

  it('creates required indexes (sid, username, cleanup)', () => {
    const dbPath = path.join(tmpDir, 'sessions.db');
    const probe = new Database(dbPath);
    const idx = probe.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='refresh_sessions'").all() as Array<{ name: string }>;
    const names = idx.map(i => i.name);
    expect(names).toContain('idx_sess_sid');
    expect(names).toContain('idx_sess_username');
    expect(names).toContain('idx_sess_cleanup');
    probe.close();
  });
});

describe('sessionsDb — CRUD (SESS-02)', () => {
  it('insertSession stores a row retrievable by id', () => {
    const row = makeRow({ id: 'jti-A', sid: 'sid-A', username: 'bob' });
    insertSession(row);
    const got = getSession('jti-A');
    expect(got).not.toBeNull();
    expect(got!.username).toBe('bob');
    expect(got!.sid).toBe('sid-A');
    expect(got!.revoked).toBe(0);
  });

  it('getSession returns null for unknown jti', () => {
    expect(getSession('does-not-exist')).toBeNull();
  });

  it('revokeSession sets revoked=1 on the target row only', () => {
    insertSession(makeRow({ id: 'jti-X', sid: 'sid-shared' }));
    insertSession(makeRow({ id: 'jti-Y', sid: 'sid-shared' }));
    revokeSession('jti-X');
    expect(getSession('jti-X')!.revoked).toBe(1);
    expect(getSession('jti-Y')!.revoked).toBe(0);
  });
});

describe('sessionsDb — family revocation (SESS-03, D-06)', () => {
  it('revokeFamily marks every row with the given sid as revoked=1', () => {
    insertSession(makeRow({ id: 'jti-1', sid: 'sid-fam' }));
    insertSession(makeRow({ id: 'jti-2', sid: 'sid-fam' }));
    insertSession(makeRow({ id: 'jti-3', sid: 'sid-other' }));
    revokeFamily('sid-fam');
    expect(getSession('jti-1')!.revoked).toBe(1);
    expect(getSession('jti-2')!.revoked).toBe(1);
    expect(getSession('jti-3')!.revoked).toBe(0);
  });
});

describe('sessionsDb — cleanup (D-13, D-14)', () => {
  it('purgeExpiredSessions removes rows where expires_at < now', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    insertSession(makeRow({ id: 'expired', expires_at: past }));
    insertSession(makeRow({ id: 'live', expires_at: new Date(Date.now() + 60_000).toISOString() }));
    const removed = purgeExpiredSessions();
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(getSession('expired')).toBeNull();
    expect(getSession('live')).not.toBeNull();
  });

  it('purgeExpiredSessions removes revoked rows whose last_used_at is older than 7 days', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    insertSession(makeRow({ id: 'old-revoked', revoked: 1, last_used_at: eightDaysAgo, expires_at: new Date(Date.now() + 60_000).toISOString() }));
    insertSession(makeRow({ id: 'recent-revoked', revoked: 1, last_used_at: oneDayAgo, expires_at: new Date(Date.now() + 60_000).toISOString() }));
    purgeExpiredSessions();
    expect(getSession('old-revoked')).toBeNull();
    expect(getSession('recent-revoked')).not.toBeNull();
  });
});
