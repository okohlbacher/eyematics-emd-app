import { describe, expect, it } from 'vitest';

import type { UserRecord } from '../server/initAuth';
import { _migrateRemovedCenters, _migrateSessionFields } from '../server/initAuth';

describe('_migrateRemovedCenters — strip org-ukb/org-lmu, fallback to org-uka', () => {
  it('strips removed IDs while keeping valid ones', () => {
    const users: UserRecord[] = [
      { username: 'u1', role: 'researcher', centers: ['org-uka', 'org-ukb'], createdAt: '2025-01-01T00:00:00Z' },
    ];
    const { users: out, changed } = _migrateRemovedCenters(users);
    expect(changed).toBe(true);
    expect(out[0].centers).toEqual(['org-uka']);
  });

  it('reassigns to org-uka when all centers are removed', () => {
    const users: UserRecord[] = [
      { username: 'u2', role: 'data_manager', centers: ['org-lmu'], createdAt: '2025-01-01T00:00:00Z' },
    ];
    const { users: out, changed } = _migrateRemovedCenters(users);
    expect(changed).toBe(true);
    expect(out[0].centers).toEqual(['org-uka']);
  });

  it('reassigns to org-uka when centers array contains only removed IDs', () => {
    const users: UserRecord[] = [
      { username: 'u3', role: 'researcher', centers: ['org-ukb', 'org-lmu'], createdAt: '2025-01-01T00:00:00Z' },
    ];
    const { users: out, changed } = _migrateRemovedCenters(users);
    expect(changed).toBe(true);
    expect(out[0].centers).toEqual(['org-uka']);
  });

  it('preserves org-ukm (re-added post-v1.8)', () => {
    const users: UserRecord[] = [
      { username: 'u4', role: 'researcher', centers: ['org-ukm'], createdAt: '2025-01-01T00:00:00Z' },
    ];
    const { users: out, changed } = _migrateRemovedCenters(users);
    expect(changed).toBe(false);
    expect(out[0].centers).toEqual(['org-ukm']);
  });

  it('returns changed=false for already-clean users', () => {
    const users: UserRecord[] = [
      { username: 'admin', role: 'admin', centers: ['org-uka', 'org-ukc', 'org-ukg', 'org-ukl', 'org-ukm', 'org-ukt'], createdAt: '2025-01-01T00:00:00Z' },
      { username: 'forscher1', role: 'researcher', centers: ['org-uka'], createdAt: '2025-01-15T00:00:00Z' },
    ];
    const { changed } = _migrateRemovedCenters(users);
    expect(changed).toBe(false);
  });
});

describe('Phase 20 session field migration — _migrateSessionFields', () => {
  it('adds tokenVersion=0 + passwordChangedAt + totpChangedAt from createdAt for missing fields', () => {
    const users: UserRecord[] = [
      { username: 'u1', role: 'researcher', centers: ['org-uka'], createdAt: '2025-01-15T00:00:00Z' },
    ];
    const { users: out, changed } = _migrateSessionFields(users);
    expect(changed).toBe(true);
    expect(out[0].tokenVersion).toBe(0);
    expect(out[0].passwordChangedAt).toBe('2025-01-15T00:00:00Z');
    expect(out[0].totpChangedAt).toBe('2025-01-15T00:00:00Z');
  });

  it('falls back to "now" when createdAt is absent', () => {
    const NOW = '2026-04-23T10:00:00Z';
    // Simulate a user record with no createdAt — TS-cast since the type requires it
    // but real-world legacy fixtures may be missing the field.
    const users = [
      { username: 'legacy', role: 'researcher', centers: ['org-uka'] } as unknown as UserRecord,
    ];
    const { users: out } = _migrateSessionFields(users, NOW);
    expect(out[0].passwordChangedAt).toBe(NOW);
    expect(out[0].totpChangedAt).toBe(NOW);
  });

  it('is idempotent: re-running on migrated users returns changed=false and identical data', () => {
    const users: UserRecord[] = [
      {
        username: 'u1', role: 'researcher', centers: ['org-uka'],
        createdAt: '2025-01-15T00:00:00Z',
        tokenVersion: 3,
        passwordChangedAt: '2025-06-01T00:00:00Z',
        totpChangedAt: '2025-06-15T00:00:00Z',
      },
    ];
    const { users: out, changed } = _migrateSessionFields(users);
    expect(changed).toBe(false);
    expect(out[0].tokenVersion).toBe(3);
    expect(out[0].passwordChangedAt).toBe('2025-06-01T00:00:00Z');
    expect(out[0].totpChangedAt).toBe('2025-06-15T00:00:00Z');
  });

  it('preserves existing tokenVersion when only timestamps are missing', () => {
    const users: UserRecord[] = [
      {
        username: 'u1', role: 'researcher', centers: ['org-uka'],
        createdAt: '2025-01-15T00:00:00Z',
        tokenVersion: 5,
      },
    ];
    const { users: out, changed } = _migrateSessionFields(users);
    expect(changed).toBe(true);
    expect(out[0].tokenVersion).toBe(5);
    expect(out[0].passwordChangedAt).toBe('2025-01-15T00:00:00Z');
  });
});
