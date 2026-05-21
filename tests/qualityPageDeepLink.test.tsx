// @vitest-environment jsdom
/**
 * Tests for QualityPage deep-link filter seeding (UX-01).
 * Asserts that URL params ?therapy=breaker and ?status=flagged seed the filter selects on mount.
 * RED state until Plan 03 adds useSearchParams lazy initializers.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

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

vi.mock('../src/services/settingsService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/settingsService')>();
  return {
    ...actual,
    getSettings: () => ({
      therapyInterrupterDays: 120,
      therapyBreakerDays: 365,
      twoFactorEnabled: false,
      dataSource: { type: 'local', blazeUrl: 'http://localhost:8080/fhir' },
      outcomes: { serverAggregationThresholdPatients: 1000, aggregateCacheTtlMs: 1800000 },
    }),
  };
});

import QualityPage from '../src/pages/QualityPage';

afterEach(() => {
  cleanup();
});

describe('QualityPage — deep-link filter seeding (UX-01)', () => {
  it('seeds filterTherapy to "breaker" when ?therapy=breaker is in the URL', () => {
    render(
      <MemoryRouter initialEntries={['/quality?therapy=breaker']}>
        <QualityPage />
      </MemoryRouter>,
    );

    // After Plan 03 adds useSearchParams, the therapy select should show 'breaker'.
    // The select has value={filterTherapy}; queryAllByRole('combobox') returns all selects.
    const selects = screen.queryAllByRole('combobox');
    // The therapy filter select is present (3rd select: status, center, therapy)
    expect(selects.length).toBeGreaterThan(0);
    const therapySelect = selects.find(
      (s) => (s as HTMLSelectElement).value === 'breaker',
    );
    expect(therapySelect).not.toBeUndefined();
  });

  it('seeds filterStatus to "in_progress" (not "flagged") when ?status=flagged is in the URL', () => {
    render(
      <MemoryRouter initialEntries={['/quality?status=flagged']}>
        <QualityPage />
      </MemoryRouter>,
    );

    // 'flagged' is NOT a valid QualityStatus — it must be mapped to 'in_progress'.
    // See RESEARCH.md Pitfall 1 and PATTERNS.md QualityPage adaptation.
    const selects = screen.queryAllByRole('combobox');
    expect(selects.length).toBeGreaterThan(0);

    // status=flagged must NOT set filterStatus to 'flagged'
    const flaggedSelect = selects.find(
      (s) => (s as HTMLSelectElement).value === 'flagged',
    );
    expect(flaggedSelect).toBeUndefined();

    // status=flagged MUST map to 'in_progress'
    const inProgressSelect = selects.find(
      (s) => (s as HTMLSelectElement).value === 'in_progress',
    );
    expect(inProgressSelect).not.toBeUndefined();
  });

  it('falls back to "all" for an unknown therapy param value', () => {
    render(
      <MemoryRouter initialEntries={['/quality?therapy=zzz']}>
        <QualityPage />
      </MemoryRouter>,
    );

    const selects = screen.queryAllByRole('combobox');
    expect(selects.length).toBeGreaterThan(0);

    // Unknown value 'zzz' must fall back to 'all' (not throw)
    const allTherapySelect = selects.find(
      (s) => (s as HTMLSelectElement).value === 'all',
    );
    expect(allTherapySelect).not.toBeUndefined();
  });
});
