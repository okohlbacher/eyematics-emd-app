// @vitest-environment jsdom
/**
 * UMGMT-01/02/03 — Admin user-management dialog validation + activation checkbox.
 *
 * Spec:
 *   UMGMT-01: Edit dialog blocks save when editCenters.length === 0 (≥1 center required).
 *   UMGMT-02: Both create and edit dialogs require firstName, lastName, and role.
 *   UMGMT-03: Activation checkbox — toggling and saving puts `active` in the PUT body.
 *
 * Conventions (CLAUDE.md):
 *   - No jest-dom; RTL assertions use queryByText().not.toBeNull() / .toBeNull()
 *   - Throw-only error handling (D-03)
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

// ---------- Fixtures ----------

const ROSTER = [
  { id: 'org-uka', shorthand: 'UKA' },
  { id: 'org-ukc', shorthand: 'UKC' },
];

const USERS = [
  {
    username: 'alice',
    firstName: 'Alice',
    lastName: 'Alpha',
    role: 'admin',
    centers: ['org-uka'],
    createdAt: '2026-01-01T00:00:00Z',
    active: true,
  },
  {
    username: 'bob',
    firstName: 'Bob',
    lastName: 'Beta',
    role: 'researcher',
    centers: ['org-ukc'],
    createdAt: '2026-01-02T00:00:00Z',
    active: true,
  },
  {
    username: 'carol',
    firstName: 'Carol',
    lastName: 'Gamma',
    role: 'clinician',
    centers: ['org-uka'],
    createdAt: '2026-01-03T00:00:00Z',
    active: false,
  },
];

// Minimal translation stub — returns the key when unknown
const tStub = (k: string): string => {
  const map: Record<string, string> = {
    fieldRequired: 'Required field',
    centerRequired: 'At least one site must be assigned',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    adminFirstName: 'First name',
    adminLastName: 'Last name',
    adminRole: 'Role',
    adminAssignCenters: 'Assign Centers',
    adminUserActive: 'Active',
    adminUserInactiveBadge: 'inactive',
    adminFilterAllCenters: 'All centers',
    adminFilterAllRoles: 'All roles',
    createUser: 'Create User',
    adminAddUser: 'Create User',
    noData: 'No data available',
    roleResearcher: 'Researcher',
    roleAdmin: 'Admin',
    roleEpidemiologist: 'Epidemiologist',
    roleClinician: 'Clinician',
    roleDataManager: 'Data Manager',
    roleClinicLead: 'Clinic Lead',
    adminSessions: 'Sessions',
    adminResetPassword: 'Reset Password',
    adminResetTotp: 'Reset TOTP',
    loginUsername: 'Username',
  };
  return map[k] ?? k;
};

// ---------- Setup / teardown ----------

let mockAuthFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockAuthFetch = vi.mocked(authFetch);

  vi.mocked(useAuth).mockReturnValue({
    user: { username: 'alice', role: 'admin' },
  } as any);

  vi.mocked(useLanguage).mockReturnValue({
    t: tStub,
    locale: 'en',
    setLocale: () => {},
  } as any);

  mockAuthFetch.mockImplementation(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/api/fhir/centers')) {
      return new Response(JSON.stringify({ centers: ROSTER }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('/api/auth/users') && !url.includes('/api/auth/users/')) {
      return new Response(JSON.stringify({ users: USERS }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // Default PUT/POST stub — return 200 with updated user
    return new Response(JSON.stringify({ user: USERS[1] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------- Render helper ----------

async function renderAndWaitForUsers() {
  const utils = render(
    <MemoryRouter>
      <AdminPage />
    </MemoryRouter>,
  );
  // Wait for user list to load
  await waitFor(() => {
    expect(screen.queryByText('alice')).not.toBeNull();
    expect(screen.queryByText('bob')).not.toBeNull();
  });
  return utils;
}

/** Click the Edit button (title="Edit") for a specific username row */
function clickEditForUser(username: string) {
  const rows = document.querySelectorAll('tbody tr');
  for (const row of rows) {
    if (row.textContent?.includes(username)) {
      const editBtn = row.querySelector<HTMLButtonElement>('button[title="Edit"]');
      if (editBtn) {
        fireEvent.click(editBtn);
        return;
      }
    }
  }
  throw new Error(`Edit button not found for user: ${username}`);
}

/** Wait for the edit form to appear (first-name input with placeholder) */
async function waitForEditForm() {
  await waitFor(() => {
    const input = document.querySelector<HTMLInputElement>('input[placeholder="First name"]');
    expect(input).not.toBeNull();
  });
}

// ---------- i18n presence tests (UMGMT-03, mirror outcomesI18n.test.ts) ----------

describe('i18n key presence — adminUserActive + adminUserInactiveBadge', () => {
  it('adminUserActive has non-empty de and en translations', async () => {
    const mod = await import('../src/i18n/translations');
    const translations = (mod as any).translations ?? (mod as any).default;
    expect(translations.adminUserActive).toBeDefined();
    expect(translations.adminUserActive.de).toBeTruthy();
    expect(translations.adminUserActive.de.length).toBeGreaterThan(0);
    expect(translations.adminUserActive.en).toBeTruthy();
    expect(translations.adminUserActive.en.length).toBeGreaterThan(0);
  });

  it('adminUserInactiveBadge has non-empty de and en translations', async () => {
    const mod = await import('../src/i18n/translations');
    const translations = (mod as any).translations ?? (mod as any).default;
    expect(translations.adminUserInactiveBadge).toBeDefined();
    expect(translations.adminUserInactiveBadge.de).toBeTruthy();
    expect(translations.adminUserInactiveBadge.de.length).toBeGreaterThan(0);
    expect(translations.adminUserInactiveBadge.en).toBeTruthy();
    expect(translations.adminUserInactiveBadge.en.length).toBeGreaterThan(0);
  });
});

// ---------- UMGMT-01: Edit dialog — ≥1 center required ----------

describe('UMGMT-01 — edit dialog: save blocked when no center selected', () => {
  it('shows center error and does NOT submit when editCenters is empty', async () => {
    await renderAndWaitForUsers();

    // Open edit for bob (has org-ukc selected)
    clickEditForUser('bob');
    await waitForEditForm();

    // Count PUT calls before we attempt save
    const putCallsBefore = mockAuthFetch.mock.calls.filter(
      (c) => (c[1] as RequestInit | undefined)?.method === 'PUT',
    ).length;

    // The edit row is the tr with bg-blue-50 class. Deselect all center buttons.
    const editRow = document.querySelector<HTMLTableRowElement>('tr[class*="bg-blue"]');
    if (editRow) {
      // Find buttons that are "selected" (have bg-blue-50 and border-blue-300)
      const selectedCenterBtns = Array.from(editRow.querySelectorAll('button')).filter(
        (b) => b.className.includes('bg-blue-50') && b.className.includes('border-blue-300'),
      );
      selectedCenterBtns.forEach((b) => fireEvent.click(b));
    }

    // Click the small Save button in the edit row (bg-blue-600 text-xs)
    const saveBtn = document.querySelector<HTMLButtonElement>('button.bg-blue-600.text-white.text-xs');
    expect(saveBtn).not.toBeNull();
    fireEvent.click(saveBtn!);

    // Center error should appear
    await waitFor(() => {
      expect(screen.queryByText('At least one site must be assigned')).not.toBeNull();
    });

    // No new PUT calls
    const putCallsAfter = mockAuthFetch.mock.calls.filter(
      (c) => (c[1] as RequestInit | undefined)?.method === 'PUT',
    ).length;
    expect(putCallsAfter).toBe(putCallsBefore);
  });
});

// ---------- UMGMT-02: Edit dialog — firstName, lastName required ----------

describe('UMGMT-02 — edit dialog: firstName, lastName all required', () => {
  it('shows firstName error and blocks submit when firstName is empty', async () => {
    await renderAndWaitForUsers();
    clickEditForUser('bob');
    await waitForEditForm();

    // Clear firstName
    const firstNameInput = document.querySelector<HTMLInputElement>('input[placeholder="First name"]')!;
    fireEvent.change(firstNameInput, { target: { value: '' } });

    // Click Save
    const saveBtn = document.querySelector<HTMLButtonElement>('button.bg-blue-600.text-white.text-xs');
    fireEvent.click(saveBtn!);

    await waitFor(() => {
      expect(screen.queryByText('Required field')).not.toBeNull();
    });

    // No PUT calls
    const putCalls = mockAuthFetch.mock.calls.filter(
      (c) => (c[1] as RequestInit | undefined)?.method === 'PUT',
    );
    expect(putCalls).toHaveLength(0);
  });

  it('shows lastName error and blocks submit when lastName is empty', async () => {
    await renderAndWaitForUsers();
    clickEditForUser('bob');
    await waitForEditForm();

    // Clear lastName
    const lastNameInput = document.querySelector<HTMLInputElement>('input[placeholder="Last name"]')!;
    fireEvent.change(lastNameInput, { target: { value: '' } });

    // Click Save
    const saveBtn = document.querySelector<HTMLButtonElement>('button.bg-blue-600.text-white.text-xs');
    fireEvent.click(saveBtn!);

    await waitFor(() => {
      expect(screen.queryByText('Required field')).not.toBeNull();
    });

    const putCalls = mockAuthFetch.mock.calls.filter(
      (c) => (c[1] as RequestInit | undefined)?.method === 'PUT',
    );
    expect(putCalls).toHaveLength(0);
  });
});

// ---------- UMGMT-02: Create dialog — firstName, lastName required ----------

describe('UMGMT-02 — create dialog: firstName required', () => {
  it('blocks submit and shows error when firstName is empty', async () => {
    await renderAndWaitForUsers();

    // Open create form
    const createBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Create User',
    );
    expect(createBtn).not.toBeNull();
    fireEvent.click(createBtn!);

    await waitFor(() => {
      // Wait for the form to appear (username input)
      const inputs = document.querySelectorAll('input[type="text"]');
      expect(inputs.length).toBeGreaterThan(0);
    });

    // Fill username field (look for input near a label containing 'Username')
    const allTextInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="text"]'));
    const usernameInput = allTextInputs.find(
      (el) => el.closest('div')?.querySelector('label')?.textContent?.includes('Username'),
    );
    if (usernameInput) fireEvent.change(usernameInput, { target: { value: 'newuser' } });

    // Leave firstName empty — but fill lastName
    const lastNameInput = document.querySelector<HTMLInputElement>('input[placeholder="Last name"]');
    if (lastNameInput) fireEvent.change(lastNameInput, { target: { value: 'Smith' } });

    // Select a center
    const centerButtons = Array.from(document.querySelectorAll('button')).filter(
      (b) => b.textContent === 'UKA' || b.textContent === 'UKC',
    );
    if (centerButtons[0]) fireEvent.click(centerButtons[0]);

    // Click the larger Save button in create form (px-4 py-2)
    const saveBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Save' && b.className.includes('px-4'),
    );
    if (saveBtn) fireEvent.click(saveBtn);

    await waitFor(() => {
      const errElems = screen.queryAllByText('Required field');
      const postCalls = mockAuthFetch.mock.calls.filter(
        (c) => (c[1] as RequestInit | undefined)?.method === 'POST',
      );
      // Either inline errors appear OR no POST was made
      expect(errElems.length > 0 || postCalls.length === 0).toBe(true);
    });
  });
});

// ---------- UMGMT-03: Activation checkbox wired to PUT body ----------

describe('UMGMT-03 — activation checkbox sends active in PUT body', () => {
  it('includes active field in PUT body after toggling activation checkbox', async () => {
    await renderAndWaitForUsers();

    // Open edit for bob (active: true)
    clickEditForUser('bob');
    await waitForEditForm();

    // The activation checkbox should be present in the edit row
    const activeCheckbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(activeCheckbox).not.toBeNull();

    // Toggle it — if checked (active true), uncheck to deactivate; otherwise check to activate
    fireEvent.click(activeCheckbox!);

    // Click Save (small blue button in edit row)
    const saveBtn = document.querySelector<HTMLButtonElement>('button.bg-blue-600.text-white.text-xs');
    expect(saveBtn).not.toBeNull();
    fireEvent.click(saveBtn!);

    await waitFor(() => {
      const putCalls = mockAuthFetch.mock.calls.filter(
        (c) => (c[1] as RequestInit | undefined)?.method === 'PUT',
      );
      expect(putCalls.length).toBeGreaterThan(0);
      const body = JSON.parse((putCalls[0][1] as RequestInit).body as string) as Record<string, unknown>;
      // PUT body must include active as a boolean field
      expect(typeof body.active).toBe('boolean');
    });
  });
});

// ---------- UMGMT-03: Inactive users show badge ----------

describe('UMGMT-03 — inactive users show badge', () => {
  it('shows inactive badge next to carol (active: false)', async () => {
    await renderAndWaitForUsers();

    // carol has active: false — badge should appear
    await waitFor(() => {
      expect(screen.queryByText('carol')).not.toBeNull();
    });
    // The badge text is t('adminUserInactiveBadge') = 'inactive'
    const badges = screen.queryAllByText('inactive');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('does NOT show inactive badge in alice or bob rows (active: true)', async () => {
    await renderAndWaitForUsers();

    await waitFor(() => {
      expect(screen.queryByText('alice')).not.toBeNull();
      expect(screen.queryByText('bob')).not.toBeNull();
    });

    // Only carol (active: false) should have a badge.
    // Find rows that contain only alice or bob but not carol
    const allRows = Array.from(document.querySelectorAll('tbody tr'));
    for (const row of allRows) {
      const text = row.textContent ?? '';
      if ((text.includes('alice') || text.includes('bob')) && !text.includes('carol')) {
        const badge = Array.from(row.querySelectorAll('*')).find(
          (el) => el.textContent?.trim() === 'inactive',
        );
        expect(badge).toBeUndefined();
      }
    }
  });
});
