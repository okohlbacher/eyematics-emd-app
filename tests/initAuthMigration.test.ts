import { describe, expect, it } from 'vitest';
import { _migrateRemovedCenters } from '../server/initAuth';
import type { UserRecord } from '../server/initAuth';

describe('_migrateRemovedCenters — strip org-ukb/org-lmu/org-ukm, fallback to org-uka', () => {
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
      { username: 'u2', role: 'data_manager', centers: ['org-ukm'], createdAt: '2025-01-01T00:00:00Z' },
    ];
    const { users: out, changed } = _migrateRemovedCenters(users);
    expect(changed).toBe(true);
    expect(out[0].centers).toEqual(['org-uka']);
  });

  it('reassigns to org-uka when centers array contains only removed IDs', () => {
    const users: UserRecord[] = [
      { username: 'u3', role: 'researcher', centers: ['org-ukb', 'org-lmu', 'org-ukm'], createdAt: '2025-01-01T00:00:00Z' },
    ];
    const { users: out, changed } = _migrateRemovedCenters(users);
    expect(changed).toBe(true);
    expect(out[0].centers).toEqual(['org-uka']);
  });

  it('returns changed=false for already-clean users', () => {
    const users: UserRecord[] = [
      { username: 'admin', role: 'admin', centers: ['org-uka', 'org-ukc', 'org-ukd', 'org-ukg', 'org-ukl', 'org-ukmz', 'org-ukt'], createdAt: '2025-01-01T00:00:00Z' },
      { username: 'forscher1', role: 'researcher', centers: ['org-uka'], createdAt: '2025-01-15T00:00:00Z' },
    ];
    const { changed } = _migrateRemovedCenters(users);
    expect(changed).toBe(false);
  });
});
