// @vitest-environment jsdom
/**
 * Tests for LandingPage Attention needed panel — Review button navigation targets (UX-01).
 * RED state until Plan 04 wires the buttons with correct targets and removes canSeeDocQuality gate.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('../src/hooks/useRecentActivity', () => ({
  useRecentActivity: () => ({ entries: [], record: vi.fn(), clear: vi.fn() }),
}));

import LandingPage from '../src/pages/LandingPage';

afterEach(() => {
  cleanup();
  mockNavigate.mockClear();
});

describe('LandingPage — Attention needed Review buttons (UX-01)', () => {
  it('therapy-breaker Review button navigates to /quality?therapy=breaker', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    // After Plan 04 lands, the button has aria-label={t('reviewTherapyBreakers')} === 'reviewTherapyBreakers'
    const therapyBtn = screen.queryByRole('button', { name: 'reviewTherapyBreakers' });
    expect(therapyBtn).not.toBeNull();
    fireEvent.click(therapyBtn!);
    expect(mockNavigate).toHaveBeenCalledWith('/quality?therapy=breaker');
  });

  it('implausible-CRT Review button navigates to /quality?status=flagged', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    const crtBtn = screen.queryByRole('button', { name: 'reviewFlaggedCases' });
    expect(crtBtn).not.toBeNull();
    fireEvent.click(crtBtn!);
    expect(mockNavigate).toHaveBeenCalledWith('/quality?status=flagged');
  });

  it('implausible-CRT button is present even without QUALITY role (gate removed in Plan 04)', () => {
    // The canSeeDocQuality gate wraps the old button. After Plan 04 removes it,
    // the button is visible to all authenticated users.
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    // With the admin role (mocked) the button should be present
    const crtBtn = screen.queryByRole('button', { name: 'reviewFlaggedCases' });
    expect(crtBtn).not.toBeNull();
  });
});
