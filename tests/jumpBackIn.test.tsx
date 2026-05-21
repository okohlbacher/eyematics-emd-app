// @vitest-environment jsdom
/**
 * Tests for LandingPage — Jump Back In panel (UX-02).
 * Asserts empty-state, populated-rows, and row-click navigation behaviors.
 * RED state until Plan 04 wires useRecentActivity into LandingPage.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import type { RecentActivityEntry } from '../src/services/recentActivityStore';

// Spy on navigate — module-level so it's available in vi.mock factory.
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { username: 'test-user', role: 'admin', centers: [] },
    logout: vi.fn(),
  }),
  QUALITY_ROLES: ['admin', 'clinic_lead', 'data_manager'],
}));

vi.mock('../src/context/DataContext', () => ({
  useData: () => ({
    activeCases: [],
    centers: [],
    cases: [],
    loading: false,
    error: null,
    bundles: [],
    savedSearches: [],
    addSavedSearch: vi.fn(),
    removeSavedSearch: vi.fn(),
    qualityFlags: [],
    addQualityFlag: vi.fn(),
    updateQualityFlag: vi.fn(),
    excludedCases: [],
    toggleExcludeCase: vi.fn(),
    reviewedCases: [],
    markCaseReviewed: vi.fn(),
    unmarkCaseReviewed: vi.fn(),
    reloadData: vi.fn(),
  }),
}));

vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k, locale: 'en' }),
}));

// useRecentActivity mock — overridden per test via vi.mocked().mockReturnValue
vi.mock('../src/hooks/useRecentActivity', () => ({
  useRecentActivity: () => ({ entries: [], record: vi.fn(), clear: vi.fn() }),
}));

import LandingPage from '../src/pages/LandingPage';
import { useRecentActivity } from '../src/hooks/useRecentActivity';

const makeEntry = (
  id: string,
  label: string,
  path: string,
): RecentActivityEntry => ({
  id,
  label,
  sub: 'Quality review',
  path,
  visitedAt: Date.now(),
});

afterEach(() => {
  cleanup();
  mockNavigate.mockClear();
  vi.mocked(useRecentActivity).mockReturnValue({
    entries: [],
    record: vi.fn(),
    clear: vi.fn(),
  });
});

describe('LandingPage — Jump Back In panel (UX-02)', () => {
  it('shows jump-back-in-empty element when there are no entries', () => {
    vi.mocked(useRecentActivity).mockReturnValue({
      entries: [],
      record: vi.fn(),
      clear: vi.fn(),
    });

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('jump-back-in-empty')).not.toBeNull();
  });

  it('hides jump-back-in-empty and shows entry rows when entries exist', () => {
    const entries = [
      makeEntry('case-1', 'Patient Alpha', '/quality?case=case-1'),
      makeEntry('case-2', 'Patient Beta', '/outcomes?case=case-2'),
    ];
    vi.mocked(useRecentActivity).mockReturnValue({
      entries,
      record: vi.fn(),
      clear: vi.fn(),
    });

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    // Empty state must be absent
    expect(screen.queryByTestId('jump-back-in-empty')).toBeNull();

    // Both entry labels must render
    expect(screen.queryByText('Patient Alpha')).not.toBeNull();
    expect(screen.queryByText('Patient Beta')).not.toBeNull();
  });

  it('navigates to entry.path when a row is clicked', () => {
    const entries = [
      makeEntry('case-1', 'Patient Alpha', '/quality?case=case-1'),
    ];
    vi.mocked(useRecentActivity).mockReturnValue({
      entries,
      record: vi.fn(),
      clear: vi.fn(),
    });

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    const row = screen.queryByText('Patient Alpha');
    expect(row).not.toBeNull();

    // The row (or its nearest clickable ancestor) triggers navigate(entry.path)
    fireEvent.click(row!.closest('[role="button"]') ?? row!);
    expect(mockNavigate).toHaveBeenCalledWith('/quality?case=case-1');
  });
});
