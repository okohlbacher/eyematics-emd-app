/**
 * Tests for src/services/authHeaders.ts — JWT auth header utility.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock sessionStorage
const storage: Record<string, string> = {};
vi.stubGlobal('sessionStorage', {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, val: string) => { storage[key] = val; },
  removeItem: (key: string) => { delete storage[key]; },
});

import { getAuthHeaders } from '../src/services/authHeaders';

describe('getAuthHeaders', () => {
  beforeEach(() => {
    for (const key of Object.keys(storage)) delete storage[key];
  });

  it('returns empty object when no token stored', () => {
    expect(getAuthHeaders()).toEqual({});
  });

  it('returns Bearer header when token exists', () => {
    storage['emd-token'] = 'test-jwt-token';
    const headers = getAuthHeaders();
    expect(headers).toEqual({ Authorization: 'Bearer test-jwt-token' });
  });

  it('returns empty after token is removed', () => {
    storage['emd-token'] = 'some-token';
    delete storage['emd-token'];
    expect(getAuthHeaders()).toEqual({});
  });
});
