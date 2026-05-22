// @vitest-environment jsdom
/**
 * Tests for QualityPage deep-link filter seeding (UX-01).
 * Asserts that URL params ?therapy=breaker, ?status=flagged, and ?crt=implausible
 * seed the filter selects on mount.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PatientCase } from '../src/types/fhir';

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { username: 'test-user', role: 'admin', centers: [] },
    logout: vi.fn(),
  }),
  QUALITY_ROLES: ['admin', 'clinic_lead', 'data_manager'],
}));

// A minimal case whose latest CRT observation value exceeds the 400 µm threshold.
// LOINC_CRT = 'LP267955-5'
const highCrtCase: PatientCase = {
  id: 'case-high-crt',
  pseudonym: 'HIGH-CRT',
  birthDate: '1960-01-01',
  centerId: 'CENTER-A',
  centerName: 'Center A',
  conditions: [],
  observations: [
    {
      code: { coding: [{ system: 'http://loinc.org', code: 'LP267955-5' }] },
      valueQuantity: { value: 500, unit: 'um' },
      effectiveDateTime: '2024-01-01T00:00:00Z',
    },
  ],
  encounters: [],
  medications: [],
  procedures: [],
};

// A case whose latest CRT is below the threshold (should be hidden by filterCrt=implausible).
const lowCrtCase: PatientCase = {
  id: 'case-low-crt',
  pseudonym: 'LOW-CRT',
  birthDate: '1960-01-01',
  centerId: 'CENTER-A',
  centerName: 'Center A',
  conditions: [],
  observations: [
    {
      code: { coding: [{ system: 'http://loinc.org', code: 'LP267955-5' }] },
      valueQuantity: { value: 300, unit: 'um' },
      effectiveDateTime: '2024-01-01T00:00:00Z',
    },
  ],
  encounters: [],
  medications: [],
  procedures: [],
};

vi.mock('../src/context/DataContext', () => ({
  useData: () => ({
    activeCases: [],
    centers: [],
    cases: [highCrtCase, lowCrtCase],
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
      crtImplausibleThresholdUm: 400,
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

  it('seeds filterCrt to "implausible" when ?crt=implausible is in the URL', () => {
    render(
      <MemoryRouter initialEntries={['/quality?crt=implausible']}>
        <QualityPage />
      </MemoryRouter>,
    );

    const selects = screen.queryAllByRole('combobox');
    expect(selects.length).toBeGreaterThan(0);

    // The CRT filter select should show 'implausible'
    const crtSelect = selects.find(
      (s) => (s as HTMLSelectElement).value === 'implausible',
    );
    expect(crtSelect).not.toBeUndefined();
  });

  it('auto-opens the filter panel when ?crt=implausible is in the URL', () => {
    render(
      <MemoryRouter initialEntries={['/quality?crt=implausible']}>
        <QualityPage />
      </MemoryRouter>,
    );

    // When crt param is present, the filter panel is auto-opened.
    // The filter panel contains select elements (status, center, therapy, crt).
    const selects = screen.queryAllByRole('combobox');
    // There should be at least 4 selects visible (status, center, therapy, crt)
    expect(selects.length).toBeGreaterThanOrEqual(4);
  });

  it('shows only cases with CRT > threshold when filterCrt is implausible', () => {
    render(
      <MemoryRouter initialEntries={['/quality?crt=implausible']}>
        <QualityPage />
      </MemoryRouter>,
    );

    // HIGH-CRT (500 µm > 400 µm threshold) should be visible
    expect(screen.queryByText('HIGH-CRT')).not.toBeNull();
    // LOW-CRT (300 µm <= 400 µm threshold) should be hidden
    expect(screen.queryByText('LOW-CRT')).toBeNull();
  });

  it('shows all cases when no crt param (filterCrt defaults to "all")', () => {
    render(
      <MemoryRouter initialEntries={['/quality']}>
        <QualityPage />
      </MemoryRouter>,
    );

    // Both cases visible when no crt filter active
    expect(screen.queryByText('HIGH-CRT')).not.toBeNull();
    expect(screen.queryByText('LOW-CRT')).not.toBeNull();
  });

  it('falls back to "all" for an unknown crt param value', () => {
    render(
      <MemoryRouter initialEntries={['/quality?crt=bogus']}>
        <QualityPage />
      </MemoryRouter>,
    );

    const selects = screen.queryAllByRole('combobox');
    expect(selects.length).toBeGreaterThan(0);

    // Unknown value must not set filterCrt to anything other than 'all'
    const implausibleSelect = selects.find(
      (s) => (s as HTMLSelectElement).value === 'implausible',
    );
    expect(implausibleSelect).toBeUndefined();
  });
});
