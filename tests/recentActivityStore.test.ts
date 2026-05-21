/**
 * Tests for src/services/recentActivityStore.ts — localStorage-backed recent activity CRUD.
 * Node environment (no jsdom needed — localStorage is stubbed via vi.stubGlobal).
 * RED state until Plan 02 creates the production module.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stub localStorage BEFORE importing the module under test (same pattern as authHeaders.test.ts).
const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  get length() { return Object.keys(store).length; },
  key: (i: number) => Object.keys(store)[i] ?? null,
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
});

import type { RecentActivityEntry } from '../src/services/recentActivityStore';
import { clear, clearAll, getEntries, record } from '../src/services/recentActivityStore';

const makeEntry = (id: string, overrides?: Partial<RecentActivityEntry>): RecentActivityEntry => ({
  id,
  label: `Label ${id}`,
  sub: 'Quality review',
  path: `/quality?id=${id}`,
  visitedAt: Date.now(),
  ...overrides,
});

describe('recentActivityStore', () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
  });

  describe('getEntries', () => {
    it('returns empty array when no key exists', () => {
      expect(getEntries('alice')).toEqual([]);
    });

    it('returns empty array for malformed JSON', () => {
      store['emd-recent:alice'] = 'not-json';
      expect(getEntries('alice')).toEqual([]);
    });

    it('returns empty array when stored value is not an array', () => {
      store['emd-recent:alice'] = JSON.stringify({ not: 'an array' });
      expect(getEntries('alice')).toEqual([]);
    });
  });

  describe('record — deduplication', () => {
    it('adds a new entry to the front', () => {
      const entry = makeEntry('case-1');
      record('alice', entry);
      const entries = getEntries('alice');
      expect(entries[0].id).toBe('case-1');
    });

    it('dedupes by id and moves repeated entry to index 0', () => {
      record('alice', makeEntry('case-1'));
      record('alice', makeEntry('case-2'));
      // Record case-1 again — must move it to the front
      const updated = makeEntry('case-1', { label: 'Updated label' });
      record('alice', updated);
      const entries = getEntries('alice');
      expect(entries[0].id).toBe('case-1');
      expect(entries[1].id).toBe('case-2');
      expect(entries.length).toBe(2);
    });

    it('updates visitedAt when deduping (not older than before)', () => {
      const before = Date.now();
      record('alice', makeEntry('case-1', { visitedAt: before - 5000 }));
      record('alice', makeEntry('case-1'));
      const entries = getEntries('alice');
      expect(entries[0].visitedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe('record — cap at 5 entries', () => {
    it('caps the list at 5 entries, dropping the oldest', () => {
      for (let i = 1; i <= 6; i++) {
        record('alice', makeEntry(`case-${i}`));
      }
      const entries = getEntries('alice');
      expect(entries.length).toBe(5);
      // Most-recent (case-6) should be first; oldest (case-1) should be dropped
      expect(entries[0].id).toBe('case-6');
      expect(entries.find((e) => e.id === 'case-1')).toBe(undefined);
    });

    it('keeps exactly 5 after adding a 5th entry', () => {
      for (let i = 1; i <= 5; i++) {
        record('alice', makeEntry(`case-${i}`));
      }
      expect(getEntries('alice').length).toBe(5);
    });
  });

  describe('clear', () => {
    it('removes the emd-recent:<username> key for that user', () => {
      record('alice', makeEntry('case-1'));
      record('bob', makeEntry('case-2'));
      clear('alice');
      expect(getEntries('alice')).toEqual([]);
      // bob's key must remain untouched
      expect(getEntries('bob').length).toBe(1);
    });

    it('does not throw when key does not exist', () => {
      expect(() => clear('nobody')).not.toThrow();
    });
  });

  describe('clearAll', () => {
    it('removes all emd-recent:* keys', () => {
      record('alice', makeEntry('case-1'));
      record('bob', makeEntry('case-2'));
      clearAll();
      expect(getEntries('alice')).toEqual([]);
      expect(getEntries('bob')).toEqual([]);
    });

    it('leaves non-matching keys intact (e.g. emd-theme)', () => {
      store['emd-theme'] = 'dark';
      record('alice', makeEntry('case-1'));
      clearAll();
      expect(store['emd-theme']).toBe('dark');
    });

    it('does not throw when there are no emd-recent:* keys', () => {
      expect(() => clearAll()).not.toThrow();
    });
  });

  describe('per-username isolation', () => {
    it('recording under user A does not appear under user B', () => {
      record('alice', makeEntry('case-1'));
      expect(getEntries('bob')).toEqual([]);
    });

    it('each user has independent key: emd-recent:<username>', () => {
      record('alice', makeEntry('alice-case'));
      record('bob', makeEntry('bob-case'));
      expect(getEntries('alice')[0].id).toBe('alice-case');
      expect(getEntries('bob')[0].id).toBe('bob-case');
    });
  });

  describe('silent failure', () => {
    it('does not throw when localStorage.setItem throws', () => {
      const originalSetItem = Object.getOwnPropertyDescriptor(
        vi.stubGlobal.length ? localStorage : localStorage,
        'setItem',
      );
      // Directly replace setItem on the stubbed object to throw
      const ls = localStorage as unknown as Record<string, unknown>;
      const savedSetItem = ls['setItem'];
      ls['setItem'] = () => { throw new Error('QuotaExceededError'); };

      expect(() => record('alice', makeEntry('case-x'))).not.toThrow();

      // Restore
      ls['setItem'] = savedSetItem;
      void originalSetItem; // silence unused var
    });
  });
});
