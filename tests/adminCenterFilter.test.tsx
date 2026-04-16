// @vitest-environment jsdom
/**
 * VQA-01 / D-09: AdminPage center filter locked to the 7-site roster.
 *
 * This test is the roster-change canary — if data/centers.json changes, UPDATE THIS
 * TEST IN THE SAME PR (the exact label list is locked here intentionally).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

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

import AdminPage from '../src/pages/AdminPage';
import { authFetch } from '../src/services/authHeaders';
import { useAuth } from '../src/context/AuthContext';
import { useLanguage } from '../src/context/LanguageContext';

const ROSTER = [
  { id: 'org-uka',  shorthand: 'UKA' },
  { id: 'org-ukc',  shorthand: 'UKC' },
  { id: 'org-ukd',  shorthand: 'UKD' },
  { id: 'org-ukg',  shorthand: 'UKG' },
  { id: 'org-ukl',  shorthand: 'UKL' },
  { id: 'org-ukmz', shorthand: 'UKMZ' },
  { id: 'org-ukt',  shorthand: 'UKT' },
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
    username: 'u-ukd',
    firstName: 'Bob',
    lastName: 'B',
    role: 'researcher',
    centers: ['org-ukd'],
    createdAt: '2026-01-02T00:00:00Z',
  },
  {
    username: 'u-both',
    firstName: 'Carol',
    lastName: 'C',
    role: 'researcher',
    centers: ['org-uka', 'org-ukd'],
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(useLanguage).mockReturnValue({
    t: tStub,
    locale: 'en',
    setLocale: () => {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // Wait for the roster options to populate (so downstream length-8 assertion is stable).
  await waitFor(() => {
    const select = utils.container.querySelector<HTMLSelectElement>(
      '[data-testid="admin-center-filter"]',
    );
    expect(select?.querySelectorAll('option').length).toBe(8);
  });
  return utils;
}

describe('AdminPage center filter — locked-to-7-sites roster (VQA-01 / D-09)', () => {
  it('renders exactly 8 <option> elements: All centers + 7 sites in roster order', async () => {
    const { container } = await renderAdminPage();
    const select = container.querySelector<HTMLSelectElement>(
      '[data-testid="admin-center-filter"]',
    );
    expect(select).not.toBeNull();
    const options = Array.from(select!.querySelectorAll('option'));
    expect(options.length).toBe(8);
    expect(options[0].value).toBe('all');
    expect(options[0].textContent).toContain('All centers');
    // Exact roster order — D-09 lock.
    expect(options.slice(1).map((o) => o.textContent)).toEqual([
      'UKA',
      'UKC',
      'UKD',
      'UKG',
      'UKL',
      'UKMZ',
      'UKT',
    ]);
    expect(options.slice(1).map((o) => o.value)).toEqual([
      'org-uka',
      'org-ukc',
      'org-ukd',
      'org-ukg',
      'org-ukl',
      'org-ukmz',
      'org-ukt',
    ]);
  });

  it('narrows the user table to only users belonging to the selected center', async () => {
    const { container } = await renderAdminPage();
    // Wait until all 3 users visible in the table.
    await waitFor(() => {
      expect(screen.queryByText('u-uka')).not.toBeNull();
      expect(screen.queryByText('u-ukd')).not.toBeNull();
      expect(screen.queryByText('u-both')).not.toBeNull();
    });
    const select = container.querySelector<HTMLSelectElement>(
      '[data-testid="admin-center-filter"]',
    )!;

    // Narrow to org-uka — u-uka and u-both remain, u-ukd drops.
    fireEvent.change(select, { target: { value: 'org-uka' } });
    await waitFor(() => {
      expect(screen.queryByText('u-uka')).not.toBeNull();
      expect(screen.queryByText('u-both')).not.toBeNull();
      expect(screen.queryByText('u-ukd')).toBeNull();
    });

    // Narrow to org-ukd — u-ukd and u-both remain, u-uka drops.
    fireEvent.change(select, { target: { value: 'org-ukd' } });
    await waitFor(() => {
      expect(screen.queryByText('u-ukd')).not.toBeNull();
      expect(screen.queryByText('u-both')).not.toBeNull();
      expect(screen.queryByText('u-uka')).toBeNull();
    });

    // Reset — all three visible again.
    fireEvent.change(select, { target: { value: 'all' } });
    await waitFor(() => {
      expect(screen.queryByText('u-uka')).not.toBeNull();
      expect(screen.queryByText('u-ukd')).not.toBeNull();
      expect(screen.queryByText('u-both')).not.toBeNull();
    });
  });
});
