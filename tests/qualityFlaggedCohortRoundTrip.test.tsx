// @vitest-environment jsdom
/**
 * CR-01 regression: QualityPage must rehydrate a saved search's flaggedCaseIds
 * (returned by the server as string[] wire form) through safePickCohortFilter
 * before passing to applyFilters.  Without the fix, applyFilters calls
 * Set.has() on a plain array → TypeError.
 *
 * RTL: no jest-dom — use queryByText().not.toBeNull() / .toBeNull() per CLAUDE.md.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PatientCase } from '../src/types/fhir';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { username: 'test-user', role: 'admin', centers: [] },
    logout: vi.fn(),
  }),
  QUALITY_ROLES: ['admin', 'clinic_lead', 'data_manager'],
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
      crtImplausibleThresholdUm: 400,
      twoFactorEnabled: false,
      dataSource: { type: 'local', blazeUrl: 'http://localhost:8080/fhir' },
      outcomes: { serverAggregationThresholdPatients: 1000, aggregateCacheTtlMs: 1800000 },
      thresholds: { criticalCrtUm: 200, criticalVisus: 0.5, visusJump: 0.1 },
    }),
  };
});

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

// caseInCohort is referenced by flaggedCaseIds — it should be visible after scoping.
const caseInCohort: PatientCase = {
  id: 'case-flagged-001',
  pseudonym: 'IN-COHORT',
  gender: 'male',
  birthDate: '1960-01-01',
  centerId: 'CENTER-X',
  centerName: 'Center X',
  conditions: [],
  observations: [],
  medications: [],
  procedures: [],
  imagingStudies: [],
};

// caseOutsideCohort is NOT in flaggedCaseIds — it must be hidden after scoping.
const caseOutsideCohort: PatientCase = {
  id: 'case-flagged-999',
  pseudonym: 'OUT-COHORT',
  gender: 'female',
  birthDate: '1970-01-01',
  centerId: 'CENTER-X',
  centerName: 'Center X',
  conditions: [],
  observations: [],
  medications: [],
  procedures: [],
  imagingStudies: [],
};

// flaggedQuality cohort: filters.flaggedCaseIds is a plain string[] (server wire form).
// This is the scenario that previously triggered:
//   TypeError: flaggedCaseIds.has is not a function
// because applyFilters calls Set.has() on flaggedCaseIds, but the server returns an array.
const flaggedQualitySavedSearch = {
  id: 'cohort-flagged-quality',
  name: 'Flagged Quality Cohort',
  filters: {
    preset: 'flaggedQuality' as const,
    flaggedCaseIds: ['case-flagged-001'],   // wire form: plain string[], NOT a Set
  },
  qualityParams: undefined,
};

vi.mock('../src/context/DataContext', () => ({
  useData: () => ({
    activeCases: [],
    centers: [],
    cases: [caseInCohort, caseOutsideCohort],
    loading: false,
    error: null,
    bundles: [],
    savedSearches: [flaggedQualitySavedSearch],
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

import QualityPage from '../src/pages/QualityPage';

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('QualityPage — CR-01 regression: flaggedQuality cohort wire-form round-trip', () => {
  it('does not throw when a flaggedQuality cohort has flaggedCaseIds as plain string[]', () => {
    // Pre-fix: applyFilters called Set.has() on the plain array → TypeError.
    // Post-fix: safePickCohortFilter converts string[] → Set before applyFilters.
    expect(() =>
      render(
        <MemoryRouter initialEntries={['/quality']}>
          <QualityPage />
        </MemoryRouter>,
      ),
    ).not.toThrow();
  });

  it('scopes case list to flaggedCaseIds members when flaggedQuality cohort is selected', () => {
    render(
      <MemoryRouter initialEntries={['/quality']}>
        <QualityPage />
      </MemoryRouter>,
    );

    // Both cases visible before scoping
    expect(screen.queryByText('IN-COHORT')).not.toBeNull();
    expect(screen.queryByText('OUT-COHORT')).not.toBeNull();

    // Select the flaggedQuality cohort
    const selects = screen.queryAllByRole('combobox');
    const cohortSelect = selects[0] as HTMLSelectElement;
    fireEvent.change(cohortSelect, { target: { value: 'cohort-flagged-quality' } });

    // case-flagged-001 is in flaggedCaseIds → must appear
    expect(screen.queryByText('IN-COHORT')).not.toBeNull();
    // case-flagged-999 is NOT in flaggedCaseIds → must be hidden
    expect(screen.queryByText('OUT-COHORT')).toBeNull();
  });

  it('restoring "All cases" shows both cases again after flaggedQuality scope', () => {
    render(
      <MemoryRouter initialEntries={['/quality']}>
        <QualityPage />
      </MemoryRouter>,
    );

    const selects = screen.queryAllByRole('combobox');
    const cohortSelect = selects[0] as HTMLSelectElement;

    fireEvent.change(cohortSelect, { target: { value: 'cohort-flagged-quality' } });
    expect(screen.queryByText('OUT-COHORT')).toBeNull();

    fireEvent.change(cohortSelect, { target: { value: 'all' } });
    expect(screen.queryByText('IN-COHORT')).not.toBeNull();
    expect(screen.queryByText('OUT-COHORT')).not.toBeNull();
  });
});
