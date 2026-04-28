// @vitest-environment jsdom
/**
 * VQA-01 / D-09: AdminPage center filter locked to the 6-site roster.
 *
 * This test is the roster-change canary — if data/centers.json changes, UPDATE THIS
 * TEST IN THE SAME PR (the exact label list is locked here intentionally).
 * Phase 24 / FB-01: roster reduced from 7 → 6 sites (UKD + UKMZ removed).
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------- Mocks ----------
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

import { useAuth } from '../src/context/AuthContext';
import { useLanguage } from '../src/context/LanguageContext';
import AdminPage from '../src/pages/AdminPage';
import { authFetch } from '../src/services/authHeaders';

const ROSTER = [
  { id: 'org-uka', shorthand: 'UKA' },
  { id: 'org-ukc', shorthand: 'UKC' },
  { id: 'org-ukg', shorthand: 'UKG' },
  { id: 'org-ukl', shorthand: 'UKL' },
  { id: 'org-ukm', shorthand: 'UKM' },
  { id: 'org-ukt', shorthand: 'UKT' },
];

const USERS = [
  {
    username: 'u-uka',
    firstName: 'Alice',
    lastName: 'A',
    role: 'researcher',
    centers: ['org-uka'],
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    username: 'u-ukm',
    firstName: 'Bob',
    lastName: 'B',
    role: 'researcher',
    centers: ['org-ukm'],
    createdAt: '2026-01-02T00:00:00Z',
  },
  {
    username: 'u-both',
    firstName: 'Carol',
    lastName: 'C',
    role: 'researcher',
    centers: ['org-uka', 'org-ukm'],
    createdAt: '2026-01-03T00:00:00Z',
  },
];

// Minimal translation stub — returns the key when unknown; hard-codes the strings
// the center filter actually displays for label assertions.
const tStub = (k: string) => {
  const map: Record<string, string> = {
    adminFilterAllCenters: 'All centers',
    adminFilterAllRoles: 'All roles',
  };
  return map[k] ?? k;
};

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({
    user: { username: 'admin', role: 'admin' },

  } as any);
  vi.mocked(useLanguage).mockReturnValue({
    t: tStub,
    locale: 'en',
    setLocale: () => {},

  } as any);

  vi.mocked(authFetch).mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/api/fhir/centers')) {
      return new Response(JSON.stringify({ centers: ROSTER }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('/api/auth/users')) {
      return new Response(JSON.stringify({ users: USERS }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('Not found', { status: 404 });
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function renderAdminPage() {
  const utils = render(
    <MemoryRouter>
      <AdminPage />
    </MemoryRouter>,
  );
  // Wait for /api/fhir/centers + /api/auth/users to resolve.
  await waitFor(() => {
    expect(
      utils.container.querySelector('[data-testid="admin-center-filter"]'),
    ).not.toBeNull();
  });
  // Wait for the roster options to populate (All + 6 sites = 7).
  await waitFor(() => {
    const select = utils.container.querySelector<HTMLSelectElement>(
      '[data-testid="admin-center-filter"]',
    );
    expect(select?.querySelectorAll('option').length).toBe(7);
  });
  return utils;
}

describe('AdminPage center filter — locked-to-6-sites roster (VQA-01 / D-09)', () => {
  it('renders exactly 7 <option> elements: All centers + 6 sites in roster order', async () => {
    const { container } = await renderAdminPage();
    const select = container.querySelector<HTMLSelectElement>(
      '[data-testid="admin-center-filter"]',
    );
    expect(select).not.toBeNull();
    const options = Array.from(select!.querySelectorAll('option'));
    expect(options.length).toBe(7);
    expect(options[0].value).toBe('all');
    expect(options[0].textContent).toContain('All centers');
    // Exact roster order — D-09 lock.
    expect(options.slice(1).map((o) => o.textContent)).toEqual([
      'UKA',
      'UKC',
      'UKG',
      'UKL',
      'UKM',
      'UKT',
    ]);
    expect(options.slice(1).map((o) => o.value)).toEqual([
      'org-uka',
      'org-ukc',
      'org-ukg',
      'org-ukl',
      'org-ukm',
      'org-ukt',
    ]);
  });

  it('narrows the user table to only users belonging to the selected center', async () => {
    const { container } = await renderAdminPage();
    // Wait until all 3 users visible in the table.
    await waitFor(() => {
      expect(screen.queryByText('u-uka')).not.toBeNull();
      expect(screen.queryByText('u-ukm')).not.toBeNull();
      expect(screen.queryByText('u-both')).not.toBeNull();
    });
    const select = container.querySelector<HTMLSelectElement>(
      '[data-testid="admin-center-filter"]',
    )!;

    // Narrow to org-uka — u-uka and u-both remain, u-ukm drops.
    fireEvent.change(select, { target: { value: 'org-uka' } });
    await waitFor(() => {
      expect(screen.queryByText('u-uka')).not.toBeNull();
      expect(screen.queryByText('u-both')).not.toBeNull();
      expect(screen.queryByText('u-ukm')).toBeNull();
    });

    // Narrow to org-ukm — u-ukm and u-both remain, u-uka drops.
    fireEvent.change(select, { target: { value: 'org-ukm' } });
    await waitFor(() => {
      expect(screen.queryByText('u-ukm')).not.toBeNull();
      expect(screen.queryByText('u-both')).not.toBeNull();
      expect(screen.queryByText('u-uka')).toBeNull();
    });

    // Reset — all three visible again.
    fireEvent.change(select, { target: { value: 'all' } });
    await waitFor(() => {
      expect(screen.queryByText('u-uka')).not.toBeNull();
      expect(screen.queryByText('u-ukm')).not.toBeNull();
      expect(screen.queryByText('u-both')).not.toBeNull();
    });
  });
});
