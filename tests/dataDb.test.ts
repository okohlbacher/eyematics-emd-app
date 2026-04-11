/**
 * T-04: Tests for dataDb.ts — CRUD for quality flags, saved searches,
 * excluded cases, and reviewed cases.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  addSavedSearch,
  getExcludedCases,
  getQualityFlags,
  getReviewedCases,
  getSavedSearches,
  initDataDb,
  removeSavedSearch,
  setExcludedCases,
  setQualityFlags,
  setReviewedCases,
} from '../server/dataDb';
import type { QualityFlagRow, SavedSearchRow } from '../server/dataDb';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'datadb-test-'));
  initDataDb(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('dataDb', () => {
  // -----------------------------------------------------------------------
  // Quality Flags
  // -----------------------------------------------------------------------
  describe('quality flags', () => {
    const flag: QualityFlagRow = {
      id: 'f1',
      case_id: 'case-001',
      parameter: 'CRT',
      error_type: 'value_anomaly',
      flagged_at: '2026-01-01T00:00:00Z',
      flagged_by: 'admin',
      status: 'open',
      updated_at: '2026-01-01T00:00:00Z',
    };

    it('starts empty', () => {
      expect(getQualityFlags('user1')).toEqual([]);
    });

    it('stores and retrieves flags', () => {
      setQualityFlags('user1', [flag]);
      const result = getQualityFlags('user1');
      expect(result).toHaveLength(1);
      expect(result[0].case_id).toBe('case-001');
      expect(result[0].parameter).toBe('CRT');
    });

    it('replaces all flags on set', () => {
      setQualityFlags('user1', [flag, { ...flag, id: 'f2', parameter: 'Visus' }]);
      expect(getQualityFlags('user1')).toHaveLength(2);

      setQualityFlags('user1', [flag]);
      expect(getQualityFlags('user1')).toHaveLength(1);
    });

    it('isolates by username', () => {
      setQualityFlags('user1', [flag]);
      setQualityFlags('user2', [{ ...flag, id: 'f2', case_id: 'case-002' }]);
      expect(getQualityFlags('user1')).toHaveLength(1);
      expect(getQualityFlags('user1')[0].case_id).toBe('case-001');
      expect(getQualityFlags('user2')[0].case_id).toBe('case-002');
    });

    it('generates UUID if id is empty', () => {
      setQualityFlags('user1', [{ ...flag, id: '' }]);
      const result = getQualityFlags('user1');
      expect(result[0].id).toBeTruthy();
      expect(result[0].id).not.toBe('');
    });
  });

  // -----------------------------------------------------------------------
  // Saved Searches
  // -----------------------------------------------------------------------
  describe('saved searches', () => {
    const search: SavedSearchRow = {
      id: 's1',
      name: 'My Search',
      created_at: '2026-01-01T00:00:00Z',
      filters: '{"diagnosis":["AMD"]}',
      updated_at: '2026-01-01T00:00:00Z',
    };

    it('starts empty', () => {
      expect(getSavedSearches('user1')).toEqual([]);
    });

    it('adds and retrieves a search', () => {
      addSavedSearch('user1', search);
      const result = getSavedSearches('user1');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('My Search');
    });

    it('replaces search with same id via INSERT OR REPLACE', () => {
      addSavedSearch('user1', search);
      addSavedSearch('user1', { ...search, name: 'Updated' });
      const result = getSavedSearches('user1');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Updated');
    });

    it('removes a search', () => {
      addSavedSearch('user1', search);
      removeSavedSearch('user1', 's1');
      expect(getSavedSearches('user1')).toEqual([]);
    });

    it('isolates by username (IDOR fix)', () => {
      addSavedSearch('user1', search);
      addSavedSearch('user2', { ...search, name: 'User2 Search' });
      // user2 cannot see user1's search
      const u2 = getSavedSearches('user2');
      expect(u2).toHaveLength(1);
      expect(u2[0].name).toBe('User2 Search');
      // user2 cannot delete user1's search
      removeSavedSearch('user2', 's1');
      expect(getSavedSearches('user1')).toHaveLength(1);
    });

    it('allows same id for different users', () => {
      addSavedSearch('user1', search);
      addSavedSearch('user2', { ...search, name: 'Different' });
      expect(getSavedSearches('user1')[0].name).toBe('My Search');
      expect(getSavedSearches('user2')[0].name).toBe('Different');
    });
  });

  // -----------------------------------------------------------------------
  // Excluded Cases
  // -----------------------------------------------------------------------
  describe('excluded cases', () => {
    it('starts empty', () => {
      expect(getExcludedCases('user1')).toEqual([]);
    });

    it('stores and retrieves excluded cases', () => {
      setExcludedCases('user1', ['case-001', 'case-002']);
      expect(getExcludedCases('user1')).toEqual(['case-001', 'case-002']);
    });

    it('replaces the full set', () => {
      setExcludedCases('user1', ['case-001', 'case-002']);
      setExcludedCases('user1', ['case-003']);
      expect(getExcludedCases('user1')).toEqual(['case-003']);
    });

    it('isolates by username', () => {
      setExcludedCases('user1', ['case-001']);
      setExcludedCases('user2', ['case-002']);
      expect(getExcludedCases('user1')).toEqual(['case-001']);
    });
  });

  // -----------------------------------------------------------------------
  // Reviewed Cases
  // -----------------------------------------------------------------------
  describe('reviewed cases', () => {
    it('starts empty', () => {
      expect(getReviewedCases('user1')).toEqual([]);
    });

    it('stores and retrieves reviewed cases', () => {
      setReviewedCases('user1', ['case-001']);
      expect(getReviewedCases('user1')).toEqual(['case-001']);
    });

    it('replaces the full set', () => {
      setReviewedCases('user1', ['case-001', 'case-002']);
      setReviewedCases('user1', ['case-003']);
      expect(getReviewedCases('user1')).toEqual(['case-003']);
    });

    it('isolates by username', () => {
      setReviewedCases('user1', ['case-001']);
      setReviewedCases('user2', ['case-002']);
      expect(getReviewedCases('user1')).toEqual(['case-001']);
    });
  });
});
