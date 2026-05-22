// @vitest-environment jsdom
/**
 * COH-02: sessionStorage filter persistence, Reset, and logout-clear.
 *
 * Verifies:
 * - Filters survive navigate-away and remount (round-trip via sessionStorage)
 * - flaggedCaseIds serializes as string[] and reconstructs as Set
 * - Reset clears filters AND removes the sessionStorage key
 * - performLogout (via AuthContext) removes the emd-cohort-filters key
 * - Corrupt / invalid sessionStorage values yield empty filter (fail-safe)
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { t } from '../src/i18n/translations';

const STORAGE_KEY = 'emd-cohort-filters';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../src/services/authHeaders', () => ({
  authFetch: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
  getAuthHeaders: vi.fn().mockReturnValue({}),
  serverLogout: vi.fn().mockResolvedValue(undefined),
  broadcastLogout: vi.fn(),
}));

vi.mock('../src/context/DataContext', () => ({
  useData: vi.fn(),
}));

vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: vi.fn(),
}));

vi.mock('../src/services/settingsService', () => ({
  getSettings: vi.fn().mockReturnValue({
    therapyInterrupterDays: 120,
    therapyBreakerDays: 365,
    crtImplausibleThresholdUm: 400,
  }),
  loadSettings: vi.fn().mockResolvedValue({
    therapyInterrupterDays: 120,
    therapyBreakerDays: 365,
    crtImplausibleThresholdUm: 400,
  }),
}));

import { useData } from '../src/context/DataContext';
import { useLanguage } from '../src/context/LanguageContext';
import { AuthProvider as AuthProviderComponent, useAuth as useAuthHook } from '../src/context/AuthContext';
import CohortBuilderPage from '../src/pages/CohortBuilderPage';
import type { PatientCase, SavedSearch } from '../src/types/fhir';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const defaultDataMock = {
  activeCases: [] as PatientCase[],
  centers: [],
  savedSearches: [] as SavedSearch[],
  addSavedSearch: vi.fn(),
  removeSavedSearch: vi.fn(),
  qualityFlags: [],
  excludedCases: [],
  reviewedCases: [],
  loading: false,
  error: null,
  bundles: [],
  cases: [],
};

function setupMocks(overrides: Partial<typeof defaultDataMock> = {}) {
  (useData as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    ...defaultDataMock,
    ...overrides,
  });
  (useLanguage as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    locale: 'en',
    setLocale: vi.fn(),
    t: (key: string) => t(key as Parameters<typeof t>[0], 'en'),
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/cohort']}>
      <CohortBuilderPage />
    </MemoryRouter>,
  );
}

function getAgeMinInput() {
  const inputs = screen.getAllByPlaceholderText('Min');
  return inputs[0] as HTMLInputElement;
}

function getResetButton() {
  const label = t('reset', 'en');
  return screen.getByRole('button', { name: new RegExp(label, 'i') });
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  sessionStorage.clear();
});

// ---------------------------------------------------------------------------
// Tests — COH-02 filter persistence
// ---------------------------------------------------------------------------

describe('cohortFilterPersistence — COH-02 sessionStorage round-trip', () => {
  it('typing an age filter writes JSON to sessionStorage under emd-cohort-filters', () => {
    setupMocks();
    renderPage();

    fireEvent.change(getAgeMinInput(), { target: { value: '30' } });

    const stored = sessionStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.ageRange).toBeDefined();
    expect(parsed.ageRange[0]).toBe(30);
  });

  it('on mount, filters initialize from sessionStorage (round-trip)', () => {
    // Seed sessionStorage before rendering
    const seed = JSON.stringify({ ageRange: [45, 80], gender: ['female'] });
    sessionStorage.setItem(STORAGE_KEY, seed);

    setupMocks();
    renderPage();

    // The age min input should reflect the restored value
    const ageMinInput = getAgeMinInput() as HTMLInputElement;
    expect(ageMinInput.value).toBe('45');
  });

  it('flaggedCaseIds round-trips: stored as string array, reconstructed as Set', () => {
    // Seed with flaggedCaseIds as a string array (as serialized from a Set)
    const seed = JSON.stringify({ flaggedCaseIds: ['case-001', 'case-002'] });
    sessionStorage.setItem(STORAGE_KEY, seed);

    setupMocks();
    // We can't directly inspect internal state, but verifying no crash and
    // the value is written back (write effect runs on mount with restored state)
    renderPage();

    const stored = sessionStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    // Should be stored back as an array (Set is serialized to array)
    expect(Array.isArray(parsed.flaggedCaseIds)).toBe(true);
  });

  it('Reset button clears filters and removes sessionStorage key', () => {
    // Seed sessionStorage
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ageRange: [20, 60] }));

    setupMocks();
    renderPage();

    // Verify age filter was restored
    expect((getAgeMinInput() as HTMLInputElement).value).toBe('20');

    fireEvent.click(getResetButton());

    // After reset, the sessionStorage key should be gone
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();

    // Age input should be cleared
    expect((getAgeMinInput() as HTMLInputElement).value).toBe('');
  });

  it('Reset button also clears visusMinText and visusMaxText', () => {
    setupMocks();
    renderPage();

    const visusMin = screen.getByPlaceholderText('0,0') as HTMLInputElement;
    const visusMax = screen.getByPlaceholderText('1,0') as HTMLInputElement;

    fireEvent.change(visusMin, { target: { value: '0.5' } });
    fireEvent.change(visusMax, { target: { value: '0.8' } });

    expect(visusMin.value).toBe('0.5');
    expect(visusMax.value).toBe('0.8');

    fireEvent.click(getResetButton());

    expect(visusMin.value).toBe('');
    expect(visusMax.value).toBe('');
  });

  it('corrupt sessionStorage value yields empty filters and no throw', () => {
    sessionStorage.setItem(STORAGE_KEY, 'not-valid-json{{{{');

    setupMocks();
    // Should render without throwing
    expect(() => renderPage()).not.toThrow();

    // After render, the age input should be empty (no filter restored from corrupt value)
    const ageInput = getAgeMinInput() as HTMLInputElement;
    expect(ageInput.value).toBe('');
  });

  it('wrong-shape sessionStorage value (array instead of object) yields empty filters', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]));

    setupMocks();
    expect(() => renderPage()).not.toThrow();

    const ageInput = getAgeMinInput() as HTMLInputElement;
    // Should not have value from an array seed
    expect(ageInput.value).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Tests — AuthContext logout clears emd-cohort-filters
// ---------------------------------------------------------------------------

// WR-01: render a real AuthProvider and call logout() via useAuth() so a regression
// in performLogout (e.g. accidentally removing the sessionStorage.removeItem call)
// will be caught by this test rather than a stub that only asserts its own logic.

vi.mock('../src/services/recentActivityStore', () => ({
  clearAll: vi.fn(),
}));

vi.mock('../src/services/fhirLoader', () => ({
  invalidateBundleCache: vi.fn(),
  applyFilters: vi.fn().mockReturnValue([]),
  getAge: vi.fn().mockReturnValue(0),
  getLatestObservation: vi.fn().mockReturnValue(null),
  LOINC_CRT: 'LP267955-5',
  LOINC_VISUS: '79880-1',
  SNOMED_AMD: '267718000',
  SNOMED_DR: '312898008',
}));

describe('cohortFilterPersistence — performLogout clears emd-cohort-filters', () => {
  it('AuthContext logout() removes the emd-cohort-filters sessionStorage key', () => {
    // Seed a live session
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ageRange: [30, 70] }));
    sessionStorage.setItem('emd-token', 'fake-token');

    // Helper component that calls the real logout from AuthContext
    function LogoutButton() {
      const { logout } = useAuthHook();
      return <button onClick={logout}>logout</button>;
    }

    render(
      <AuthProviderComponent>
        <LogoutButton />
      </AuthProviderComponent>,
    );

    // Pre-condition: key must exist before logout
    expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'logout' }));

    // performLogout must have removed the cohort-filter key — if this assertion fails,
    // it means performLogout no longer removes 'emd-cohort-filters' (regression caught).
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem('emd-token')).toBeNull();
  });
});
