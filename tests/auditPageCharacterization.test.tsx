// @vitest-environment jsdom
/**
 * Phase 19 / AUDIT-02: Characterization tests — these tests freeze v1.7 AuditPage behavior.
 *
 * They MUST pass against the unrefactored AuditPage and MUST remain green after the
 * Plan 02 refactor. Any diff is a regression.
 *
 * Design notes:
 * - The stub `t: (k: string) => k` returns the raw i18n key as-is. All assertions on
 *   translated strings therefore check the key name (e.g. "auditEmptyFiltered"), NOT
 *   the English/German text. This is intentional and documented here.
 * - Real timers are used (not vi.useFakeTimers). The 300 ms debounce is awaited via
 *   `waitFor` with a 1000 ms timeout, matching the adminCenterFilter.test.tsx precedent.
 * - download utils are mocked to prevent jsdom URL.createObjectURL errors.
 * - Assertions use `.not.toBeNull()` / `.toBeNull()` (Vitest/Chai native) rather than
 *   jest-dom's `toBeInTheDocument` — this codebase has no jest-dom setup file.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------- Mocks (MUST appear before SUT import) ----------

vi.mock('../src/services/authHeaders', () => ({
  authFetch: vi.fn(),
  getAuthHeaders: vi.fn(() => ({})),
}));

vi.mock('../src/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: vi.fn(),
}));

// Prevent jsdom errors from URL.createObjectURL / DOM anchor click in download utils
vi.mock('../src/utils/download', () => ({
  downloadBlob: vi.fn(),
  downloadCsv: vi.fn(),
  downloadJson: vi.fn(),
  downloadYaml: vi.fn(),
  datedFilename: vi.fn(() => 'audit-log-2026-04-23.csv'),
  buildCsv: vi.fn(() => ''),
}));

// ---------- SUT imports (after mocks) ----------
import { useAuth } from '../src/context/AuthContext';
import { useLanguage } from '../src/context/LanguageContext';
import AuditPage from '../src/pages/AuditPage';
import { authFetch } from '../src/services/authHeaders';

// ---------- Fixture data ----------

/** A noise GET that isRelevantEntry() must filter out. */
const NOISE_ENTRY = {
  id: 1,
  timestamp: '2026-04-22T10:00:00.000Z',
  method: 'GET',
  path: '/api/auth/users/me',
  user: 'admin',
  status: 200,
  duration_ms: 5,
};

/** A relevant POST login — survives isRelevantEntry(). */
const LOGIN_ENTRY = {
  id: 2,
  timestamp: '2026-04-23T12:00:00.000Z',
  method: 'POST',
  path: '/api/auth/login',
  user: 'alice',
  status: 200,
  duration_ms: 80,
};

/** A relevant PUT settings — survives isRelevantEntry(). */
const SETTINGS_ENTRY = {
  id: 3,
  timestamp: '2026-04-22T08:00:00.000Z',
  method: 'PUT',
  path: '/api/settings',
  user: 'alice',
  status: 201,
  duration_ms: 45,
};

/** Helper: make a resolved Response with JSON body. */
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Default empty response used by beforeEach. */
function emptyResponse() {
  return jsonResponse({ entries: [], total: 0 });
}

// ---------- Lifecycle ----------

beforeEach(() => {
  vi.mocked(useLanguage).mockReturnValue({
    locale: 'en',
    t: (k: string) => k,
  } as never);
  vi.mocked(useAuth).mockReturnValue({
    user: { username: 'admin', role: 'admin' },
  } as never);
  // Default: empty result list so tests that don't care about rows see "auditEmptyFiltered"
  vi.mocked(authFetch).mockResolvedValue(emptyResponse());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------- Tests ----------

describe('AuditPage v1.7 characterization (Phase 19 / AUDIT-02)', () => {

  it('loading state on mount', () => {
    render(<AuditPage />);
    // Before ANY timer fires (synchronous assertion), the loading div must be present.
    expect(screen.queryByText(/Loading audit log/i)).not.toBeNull();
  });

  it('error state on non-OK', async () => {
    vi.mocked(authFetch).mockResolvedValueOnce(
      new Response('boom', { status: 500 })
    );
    render(<AuditPage />);
    await waitFor(() => {
      expect(screen.queryByText('Server returned 500')).not.toBeNull();
    }, { timeout: 1000 });
  });

  it('empty state when no entries match filters', async () => {
    // Default mock already returns {entries: [], total: 0}
    render(<AuditPage />);
    await waitFor(() => {
      // Stub t returns raw key; AuditPage renders t('auditEmptyFiltered')
      expect(screen.queryByText('auditEmptyFiltered')).not.toBeNull();
    }, { timeout: 1000 });
  });

  it('populated table renders rows', async () => {
    vi.mocked(authFetch).mockResolvedValue(
      jsonResponse({
        entries: [LOGIN_ENTRY, SETTINGS_ENTRY],
        total: 2,
      })
    );
    const { container } = render(<AuditPage />);
    await waitFor(() => {
      expect(container.querySelector('table')).not.toBeNull();
    }, { timeout: 1000 });
    const rows = container.querySelectorAll('tbody tr');
    // Both entries are relevant (POST /api/auth/login and PUT /api/settings both pass isRelevantEntry)
    expect(rows.length).toBe(2);
    // Assert DESC sort by timestamp: LOGIN_ENTRY (2026-04-23) before SETTINGS_ENTRY (2026-04-22)
    // The first row's user cell (column index 1) should show 'alice' (from LOGIN_ENTRY, newer)
    const firstRowCells = rows[0].querySelectorAll('td');
    expect(firstRowCells[1].textContent).toBe('alice');
  });

  it('debounced refetch on filter change', async () => {
    render(<AuditPage />);
    // Wait for the initial fetch to fire (after 300 ms debounce)
    await waitFor(() => expect(vi.mocked(authFetch)).toHaveBeenCalledTimes(1), { timeout: 1000 });

    // Clear call count — we watch the NEXT call only
    vi.mocked(authFetch).mockClear();

    // Change the category select — its current display value is the raw i18n key
    const categorySelect = screen.getByDisplayValue('auditFilterAllCategories');
    // Synchronous change — authFetch must NOT be called immediately
    fireEvent.change(categorySelect, { target: { value: 'auth' } });
    expect(vi.mocked(authFetch)).not.toHaveBeenCalled();

    // After the 300 ms debounce resolves, authFetch must fire with action_category=auth
    await waitFor(
      () => expect(vi.mocked(authFetch)).toHaveBeenCalledTimes(1),
      { timeout: 1000 }
    );
    const calledUrl = vi.mocked(authFetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain('action_category=auth');
  });

  it('unmount cancels in-flight fetch', async () => {
    // Spy on console.error to detect any React "state update on unmounted component" warnings
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // authFetch returns a promise that resolves after 500 ms — still in-flight at unmount
    vi.mocked(authFetch).mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) =>
          setTimeout(() => resolve(jsonResponse({ entries: [], total: 0 })), 500)
        )
    );

    const { unmount } = render(<AuditPage />);
    // Wait just past the 300 ms debounce so the fetch is in-flight, then unmount
    await new Promise((r) => setTimeout(r, 310));
    unmount();

    // Wait past the 500 ms resolve time so the promise settles
    await new Promise((r) => setTimeout(r, 600));

    const errorOutput = consoleSpy.mock.calls.flat().join(' ');
    expect(errorOutput).not.toMatch(/unmounted|state update/i);

    consoleSpy.mockRestore();
  });

  it('admin-gated export buttons', async () => {
    // Admin role: both CSV and JSON export buttons must be visible
    render(<AuditPage />);
    await waitFor(() => {
      expect(screen.queryByText('auditExportCsv')).not.toBeNull();
      expect(screen.queryByText('auditExportJson')).not.toBeNull();
    }, { timeout: 1000 });

    cleanup();
    vi.clearAllMocks();

    // Non-admin (forscher1): CSV visible, JSON hidden
    vi.mocked(useAuth).mockReturnValue({
      user: { username: 'forscher1', role: 'forscher1' },
    } as never);
    vi.mocked(authFetch).mockResolvedValue(emptyResponse());

    render(<AuditPage />);
    await waitFor(() => {
      expect(screen.queryByText('auditExportCsv')).not.toBeNull();
    }, { timeout: 1000 });
    // JSON export must NOT be rendered for non-admin
    expect(screen.queryByText('auditExportJson')).toBeNull();
  });

  it('6-dim filter URL params emit correctly', async () => {
    // Seed the initial response with an entry whose user is 'alice' so the user dropdown
    // populates and the <option value="alice"> becomes available.
    vi.mocked(authFetch).mockResolvedValue(
      jsonResponse({ entries: [LOGIN_ENTRY], total: 1 })
    );

    render(<AuditPage />);
    // Wait for the initial fetch to settle (dropdown must be populated with 'alice' option)
    await waitFor(() => expect(vi.mocked(authFetch)).toHaveBeenCalledTimes(1), { timeout: 1000 });

    vi.mocked(authFetch).mockClear();

    // Change all 6 filter controls:
    // 1. User dropdown (admin-only — rendered because useAuth returns admin)
    const userSelect = screen.getByDisplayValue('auditFilterAllUsers');
    fireEvent.change(userSelect, { target: { value: 'alice' } });

    // 2. Category
    const categorySelect = screen.getByDisplayValue('auditFilterAllCategories');
    fireEvent.change(categorySelect, { target: { value: 'data' } });

    // 3. From date input (type="date", value is empty string initially)
    const dateInputs = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="date"]')
    );
    fireEvent.change(dateInputs[0], { target: { value: '2026-01-01' } });

    // 4. To date (second date input)
    fireEvent.change(dateInputs[1], { target: { value: '2026-01-31' } });

    // 5. Search input (admin-only, type="search")
    const searchInput = document.querySelector<HTMLInputElement>('input[type="search"]')!;
    fireEvent.change(searchInput, { target: { value: 'foo' } });

    // 6. Failures-only checkbox
    const failuresCheckbox = screen.getByRole('checkbox');
    fireEvent.click(failuresCheckbox);

    // Wait for debounce to fire with ALL 6 params
    await waitFor(
      () => expect(vi.mocked(authFetch)).toHaveBeenCalled(),
      { timeout: 1000 }
    );

    const calledUrl = vi.mocked(authFetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain('user=alice');
    expect(calledUrl).toContain('action_category=data');
    expect(calledUrl).toContain('fromTime=2026-01-01');
    // URLSearchParams encodes ':' as '%3A', so toTime=2026-01-31T23:59:59 appears percent-encoded.
    // We assert the decoded form by checking decodeURIComponent of the full URL.
    expect(decodeURIComponent(calledUrl)).toContain('toTime=2026-01-31T23:59:59');
    expect(calledUrl).toContain('body_search=foo');
    expect(calledUrl).toContain('status_gte=400');
  });

  it('isRelevantEntry filters out noise GETs from rendered table', async () => {
    // Mix: one relevant POST and one noise GET
    vi.mocked(authFetch).mockResolvedValue(
      jsonResponse({
        entries: [LOGIN_ENTRY, NOISE_ENTRY],
        total: 2,
      })
    );
    const { container } = render(<AuditPage />);
    await waitFor(() => {
      expect(container.querySelector('table')).not.toBeNull();
    }, { timeout: 1000 });

    // Noise entry path must NOT appear in the table
    expect(screen.queryByText('/api/auth/users/me')).toBeNull();

    // Only 1 data row (the login entry) — the header row is in <thead>, not <tbody>
    const tbodyRows = container.querySelectorAll('tbody tr');
    expect(tbodyRows.length).toBe(1);
  });

  it('describeAction outputs expected i18n key for POST /api/auth/login', async () => {
    const loginEntry = { ...LOGIN_ENTRY, method: 'POST', path: '/api/auth/login' };
    const settingsEntry = { ...SETTINGS_ENTRY, method: 'PUT', path: '/api/settings', id: 10 };
    const unknownEntry = {
      id: 11,
      timestamp: '2026-04-21T06:00:00.000Z',
      method: 'POST',
      path: '/api/foo',
      user: 'bob',
      status: 200,
      duration_ms: 10,
    };

    vi.mocked(authFetch).mockResolvedValue(
      jsonResponse({ entries: [loginEntry, settingsEntry, unknownEntry], total: 3 })
    );
    const { container } = render(<AuditPage />);
    await waitFor(() => {
      expect(container.querySelector('table')).not.toBeNull();
    }, { timeout: 1000 });

    expect(screen.queryByText('audit_action_login')).not.toBeNull();
    expect(screen.queryByText('audit_action_update_settings')).not.toBeNull();
    expect(screen.queryByText('audit_action_unknown')).not.toBeNull();
  });

  it('describeDetail outputs expected i18n key for DELETE /api/auth/users/alice', async () => {
    const deleteEntry = {
      id: 20,
      timestamp: '2026-04-23T09:00:00.000Z',
      method: 'DELETE',
      path: '/api/auth/users/alice',
      user: 'admin',
      status: 204,
      duration_ms: 30,
    };

    vi.mocked(authFetch).mockResolvedValue(
      jsonResponse({ entries: [deleteEntry], total: 1 })
    );
    const { container } = render(<AuditPage />);
    await waitFor(() => {
      expect(container.querySelector('table')).not.toBeNull();
    }, { timeout: 1000 });

    // describeAction for DELETE /api/auth/users/* → audit_action_delete_user
    expect(screen.queryByText('audit_action_delete_user')).not.toBeNull();

    // describeDetail: t('audit_detail_delete_user').replace('{0}', 'alice')
    // Because stub t is identity, the rendered text is:
    //   'audit_detail_delete_user'.replace('{0}', 'alice') = 'audit_detail_delete_user'
    // (the raw key string has no '{0}' placeholder, so replace is a no-op).
    // NOTE (stub-t coupling): if/when tested against a real t(), the rendered text changes
    // to the interpolated English sentence and this assertion must be updated.
    expect(screen.queryByText('audit_detail_delete_user')).not.toBeNull();
  });

});
