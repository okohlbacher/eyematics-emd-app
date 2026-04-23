/**
 * Phase 19 / AUDIT-04: reducer + selectors + formatters spec.
 *
 * Pure unit test — no jsdom needed (Node env).
 * Covers: all 5 reducer action variants, requestEpoch stale-response guard for
 * FETCH_SUCCESS and FETCH_ERROR (strict reference identity), selectDistinctUsers,
 * selectFilteredEntries, all 15 describeAction branches, describeDetail (including
 * {0} replacement and decodeURIComponent), and all 5 statusBadgeClass ranges.
 */
import { describe, expect, it } from 'vitest';

import {
  describeAction,
  describeDetail,
  statusBadgeClass,
  type TranslationFn,
} from '../src/pages/audit/auditFormatters';
import {
  auditReducer,
  type AuditState,
  initialFilters,
  initialState,
  selectDistinctUsers,
  selectFilteredEntries,
  type ServerAuditEntry,
} from '../src/pages/audit/auditPageState';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Identity t: returns the raw i18n key unchanged — used to assert key names. */
const t: TranslationFn = (k: string) => k as never;

function makeEntry(overrides: Partial<ServerAuditEntry> = {}): ServerAuditEntry {
  return {
    id: 1,
    timestamp: '2026-04-23T10:00:00.000Z',
    method: 'POST',
    path: '/api/auth/login',
    user: 'alice',
    status: 200,
    duration_ms: 50,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// describe('auditReducer')
// ---------------------------------------------------------------------------

describe('auditReducer', () => {

  it('FILTER_SET sets a single filter and preserves others', () => {
    const result = auditReducer(initialState, { type: 'FILTER_SET', key: 'category', value: 'auth' });
    expect(result.filters.category).toBe('auth');
    // All other filters remain at defaults
    expect(result.filters.user).toBe('');
    expect(result.filters.fromDate).toBe('');
    expect(result.filters.toDate).toBe('');
    expect(result.filters.search).toBe('');
    expect(result.filters.failuresOnly).toBe(false);
    // New object reference (R-02 — useEffect dep detects change)
    expect(result.filters).not.toBe(initialState.filters);
  });

  it('FILTER_SET on boolean key flips failuresOnly', () => {
    const result = auditReducer(initialState, { type: 'FILTER_SET', key: 'failuresOnly', value: true });
    expect(result.filters.failuresOnly).toBe(true);
  });

  it('FILTERS_RESET restores initialFilters and preserves entries/total/loading', () => {
    const priorEntries: ServerAuditEntry[] = [makeEntry()];
    const priorState: AuditState = {
      ...initialState,
      filters: { user: 'bob', category: 'auth', fromDate: '2026-01-01', toDate: '2026-12-31', search: 'x', failuresOnly: true },
      entries: priorEntries,
      total: 5,
      loading: false,
    };
    const result = auditReducer(priorState, { type: 'FILTERS_RESET' });
    // filters restored to initialFilters
    expect(result.filters).toEqual(initialFilters);
    // entries, total, loading preserved
    expect(result.entries).toBe(priorEntries);
    expect(result.total).toBe(5);
    expect(result.loading).toBe(false);
  });

  it('FETCH_START sets loading=true, error=null, increments requestEpoch', () => {
    const result = auditReducer(initialState, { type: 'FETCH_START', epoch: 1 });
    expect(result.loading).toBe(true);
    expect(result.error).toBeNull();
    expect(result.requestEpoch).toBe(1);
  });

  it('FETCH_SUCCESS with matching epoch updates entries/total and clears loading', () => {
    const priorState: AuditState = {
      ...initialState,
      loading: true,
      requestEpoch: 1,
    };
    const entries = [makeEntry()];
    const result = auditReducer(priorState, {
      type: 'FETCH_SUCCESS',
      epoch: 1,
      entries,
      total: 10,
    });
    expect(result.loading).toBe(false);
    expect(result.entries.length).toBe(1);
    expect(result.total).toBe(10);
    expect(result.error).toBeNull();
  });

  it('FETCH_SUCCESS with stale epoch is a no-op', () => {
    const priorState: AuditState = {
      ...initialState,
      loading: true,
      requestEpoch: 2,
    };
    const result = auditReducer(priorState, {
      type: 'FETCH_SUCCESS',
      epoch: 1,
      entries: [makeEntry()],
      total: 99,
    });
    // Strict reference equality — reducer must return the same object, not a shallow copy
    expect(result).toBe(priorState);
  });

  it('FETCH_ERROR with matching epoch sets error and clears loading', () => {
    const priorEntries = [makeEntry()];
    const priorState: AuditState = {
      ...initialState,
      loading: true,
      requestEpoch: 1,
      entries: priorEntries,
      total: 7,
    };
    const result = auditReducer(priorState, {
      type: 'FETCH_ERROR',
      epoch: 1,
      error: 'boom',
    });
    expect(result.loading).toBe(false);
    expect(result.error).toBe('boom');
    // entries and total preserved (not cleared)
    expect(result.entries).toBe(priorEntries);
    expect(result.total).toBe(7);
  });

  it('FETCH_ERROR with stale epoch is a no-op', () => {
    const priorState: AuditState = {
      ...initialState,
      loading: true,
      requestEpoch: 2,
    };
    const result = auditReducer(priorState, {
      type: 'FETCH_ERROR',
      epoch: 1,
      error: 'stale error',
    });
    // Strict reference equality
    expect(result).toBe(priorState);
  });

});

// ---------------------------------------------------------------------------
// describe('selectors')
// ---------------------------------------------------------------------------

describe('selectors', () => {

  it('selectDistinctUsers dedups, sorts, and drops empty users', () => {
    const entries = [
      makeEntry({ user: 'bob' }),
      makeEntry({ user: '' }),
      makeEntry({ user: 'alice' }),
      makeEntry({ user: 'bob' }),
      makeEntry({ user: 'alice' }),
    ];
    const result = selectDistinctUsers(entries);
    expect(result).toEqual(['alice', 'bob']);
  });

  it('selectFilteredEntries hides noise GETs and sorts desc by timestamp', () => {
    const noiseGet = makeEntry({
      id: 1,
      method: 'GET',
      path: '/api/auth/users/me',
      timestamp: '2026-04-23T10:00:00Z',
    });
    const login = makeEntry({
      id: 2,
      method: 'POST',
      path: '/api/auth/login',
      timestamp: '2026-04-23T09:00:00Z',
    });
    const settings = makeEntry({
      id: 3,
      method: 'PUT',
      path: '/api/settings',
      timestamp: '2026-04-23T11:00:00Z',
    });
    const result = selectFilteredEntries([noiseGet, login, settings]);
    // noiseGet filtered out (GET /api/auth/users/me is noise)
    expect(result.length).toBe(2);
    // Sorted desc by timestamp: settings (11:00) before login (09:00)
    expect(result[0].path).toBe('/api/settings');
    expect(result[1].path).toBe('/api/auth/login');
  });

});

// ---------------------------------------------------------------------------
// describe('describeAction')
// ---------------------------------------------------------------------------

describe('describeAction', () => {

  it('returns audit_action_login for POST /api/auth/login', () => {
    expect(describeAction('POST', '/api/auth/login', t)).toBe('audit_action_login');
  });

  it('returns audit_action_login for POST /api/auth/verify', () => {
    expect(describeAction('POST', '/api/auth/verify', t)).toBe('audit_action_login');
  });

  it('returns audit_action_create_user for POST /api/auth/users', () => {
    expect(describeAction('POST', '/api/auth/users', t)).toBe('audit_action_create_user');
  });

  it('returns audit_action_delete_user for DELETE /api/auth/users/alice', () => {
    expect(describeAction('DELETE', '/api/auth/users/alice', t)).toBe('audit_action_delete_user');
  });

  it('returns audit_action_update_settings for PUT /api/settings', () => {
    expect(describeAction('PUT', '/api/settings', t)).toBe('audit_action_update_settings');
  });

  it('returns audit_action_view_settings for GET /api/settings', () => {
    expect(describeAction('GET', '/api/settings', t)).toBe('audit_action_view_settings');
  });

  it('returns audit_action_update_flag for PUT /api/data/quality-flags', () => {
    expect(describeAction('PUT', '/api/data/quality-flags', t)).toBe('audit_action_update_flag');
  });

  it('returns audit_action_save_search for POST /api/data/saved-searches', () => {
    expect(describeAction('POST', '/api/data/saved-searches', t)).toBe('audit_action_save_search');
  });

  it('returns audit_action_delete_search for DELETE /api/data/saved-searches/foo', () => {
    expect(describeAction('DELETE', '/api/data/saved-searches/foo', t)).toBe('audit_action_delete_search');
  });

  it('returns audit_action_exclude_case for PUT /api/data/excluded-cases', () => {
    expect(describeAction('PUT', '/api/data/excluded-cases', t)).toBe('audit_action_exclude_case');
  });

  it('returns audit_action_update_flag for PUT /api/data/reviewed-cases', () => {
    expect(describeAction('PUT', '/api/data/reviewed-cases', t)).toBe('audit_action_update_flag');
  });

  it('returns audit_action_flag_error for POST /api/issues', () => {
    expect(describeAction('POST', '/api/issues', t)).toBe('audit_action_flag_error');
  });

  it('returns audit_action_data_access for GET /api/fhir/bundles', () => {
    expect(describeAction('GET', '/api/fhir/bundles', t)).toBe('audit_action_data_access');
  });

  it('returns audit_action_view_audit for GET /api/audit', () => {
    expect(describeAction('GET', '/api/audit', t)).toBe('audit_action_view_audit');
  });

  it('returns audit_action_view_audit for GET /api/audit/export (startsWith)', () => {
    expect(describeAction('GET', '/api/audit/export', t)).toBe('audit_action_view_audit');
  });

  it('returns audit_action_unknown for unmapped POST /api/foo', () => {
    expect(describeAction('POST', '/api/foo', t)).toBe('audit_action_unknown');
  });

});

// ---------------------------------------------------------------------------
// describe('describeDetail')
// ---------------------------------------------------------------------------

describe('describeDetail', () => {

  it('returns audit_detail_login for POST /api/auth/login (identity t — no {0} in key)', () => {
    // With identity t, the raw key has no '{0}', so replace is a no-op.
    expect(describeDetail('POST', '/api/auth/login', 'alice', t)).toBe('audit_detail_login');
  });

  it('replaces {0} with user for POST /api/auth/login when t returns a template', () => {
    const tTemplate: TranslationFn = (_k: string) => 'logged in as {0}' as never;
    expect(describeDetail('POST', '/api/auth/login', 'alice', tTemplate)).toBe('logged in as alice');
  });

  it('returns audit_detail_login for POST /api/auth/verify', () => {
    expect(describeDetail('POST', '/api/auth/verify', 'bob', t)).toBe('audit_detail_login');
  });

  it('returns audit_detail_delete_user with decoded username for DELETE /api/auth/users/alice%40example.com', () => {
    const tTemplate: TranslationFn = (_k: string) => 'deleted {0}' as never;
    expect(describeDetail('DELETE', '/api/auth/users/alice%40example.com', 'admin', tTemplate)).toBe('deleted alice@example.com');
  });

  it('returns empty string for unknown method/path', () => {
    expect(describeDetail('POST', '/api/foo', 'bob', t)).toBe('');
  });

});

// ---------------------------------------------------------------------------
// describe('statusBadgeClass')
// ---------------------------------------------------------------------------

describe('statusBadgeClass', () => {

  it('returns red classes for status >= 500', () => {
    const result = statusBadgeClass(500);
    expect(result).toContain('bg-red-100');
    expect(result).toContain('dark:bg-red-900/20');
  });

  it('returns amber classes for 400-499', () => {
    const result = statusBadgeClass(404);
    expect(result).toContain('bg-amber-100');
  });

  it('returns blue classes for 300-399', () => {
    const result = statusBadgeClass(301);
    expect(result).toContain('bg-blue-100');
  });

  it('returns green classes for 200-299', () => {
    const result = statusBadgeClass(200);
    expect(result).toContain('bg-green-100');
  });

  it('returns gray classes for other statuses', () => {
    const result = statusBadgeClass(100);
    expect(result).toContain('bg-gray-100');
  });

});
