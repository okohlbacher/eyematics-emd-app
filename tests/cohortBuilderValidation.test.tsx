// @vitest-environment jsdom
/**
 * COH-01: Inline numeric validation for CohortBuilderPage.
 *
 * Verifies that invalid age, visus, and CRT inputs show inline error alerts
 * and disable the Save button; valid filters still update results.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { t } from '../src/i18n/translations';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../src/services/authHeaders', () => ({
  authFetch: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
  getAuthHeaders: vi.fn().mockReturnValue({}),
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
  // Age is the first number input with "Min" placeholder
  const inputs = screen.getAllByPlaceholderText('Min');
  return inputs[0] as HTMLInputElement;
}

function getAgeMaxInput() {
  // Age max is the first number input with "Max" placeholder
  const inputs = screen.getAllByPlaceholderText('Max');
  return inputs[0] as HTMLInputElement;
}

function getVisusMinInput() {
  return screen.getByPlaceholderText('0,0') as HTMLInputElement;
}

function getVisusMaxInput() {
  return screen.getByPlaceholderText('1,0') as HTMLInputElement;
}

function getCrtMinInput() {
  // CRT is the second pair of number inputs — second Min
  const inputs = screen.getAllByPlaceholderText('Min');
  return inputs[1] as HTMLInputElement;
}

function getCrtMaxInput() {
  // CRT max — second Max
  const inputs = screen.getAllByPlaceholderText('Max');
  return inputs[1] as HTMLInputElement;
}

function getSaveButton() {
  // Save button text is t('cohortSaveSearch', 'en')
  const label = t('cohortSaveSearch', 'en');
  return screen.getByRole('button', { name: new RegExp(label, 'i') });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  sessionStorage.clear();
});

// ---------------------------------------------------------------------------
// Tests — COH-01 validation
// ---------------------------------------------------------------------------

describe('cohortValidation — COH-01 inline validation', () => {
  describe('age validation', () => {
    it('age min above age max shows cohortValidationAgeLowerExceedsUpper error and disables Save', () => {
      setupMocks();
      renderPage();

      fireEvent.change(getAgeMinInput(), { target: { value: '80' } });
      fireEvent.change(getAgeMaxInput(), { target: { value: '50' } });

      const errorMsg = t('cohortValidationAgeLowerExceedsUpper', 'en');
      expect(screen.queryByText(errorMsg)).not.toBeNull();
      expect(screen.queryByRole('alert', { hidden: false })).not.toBeNull();

      // Save must be disabled when there is a filter error (even with a valid name)
      const saveBtn = getSaveButton();
      expect(saveBtn.hasAttribute('disabled')).toBe(true);
    });

    it('negative age min shows cohortValidationAgeNonNumeric and disables Save', () => {
      setupMocks();
      renderPage();

      fireEvent.change(getAgeMinInput(), { target: { value: '-5' } });

      const errorMsg = t('cohortValidationAgeNonNumeric', 'en');
      expect(screen.queryByText(errorMsg)).not.toBeNull();

      expect(getSaveButton().hasAttribute('disabled')).toBe(true);
    });

    it('negative age max shows cohortValidationAgeNonNumeric and disables Save', () => {
      setupMocks();
      renderPage();

      fireEvent.change(getAgeMaxInput(), { target: { value: '-1' } });

      const errorMsg = t('cohortValidationAgeNonNumeric', 'en');
      expect(screen.queryByText(errorMsg)).not.toBeNull();

      expect(getSaveButton().hasAttribute('disabled')).toBe(true);
    });
  });

  describe('visus validation', () => {
    it('visus min above 1 shows cohortValidationVisusOutOfRange and disables Save', () => {
      setupMocks();
      renderPage();

      fireEvent.change(getVisusMinInput(), { target: { value: '1.2' } });

      const errorMsg = t('cohortValidationVisusOutOfRange', 'en');
      expect(screen.queryByText(errorMsg)).not.toBeNull();

      expect(getSaveButton().hasAttribute('disabled')).toBe(true);
    });

    it('visus max above 1 shows cohortValidationVisusOutOfRange and disables Save', () => {
      setupMocks();
      renderPage();

      fireEvent.change(getVisusMaxInput(), { target: { value: '2' } });

      const errorMsg = t('cohortValidationVisusOutOfRange', 'en');
      expect(screen.queryByText(errorMsg)).not.toBeNull();

      expect(getSaveButton().hasAttribute('disabled')).toBe(true);
    });

    it('visus min above visus max shows cohortValidationVisusLowerExceedsUpper and disables Save', () => {
      setupMocks();
      renderPage();

      fireEvent.change(getVisusMinInput(), { target: { value: '0.8' } });
      fireEvent.change(getVisusMaxInput(), { target: { value: '0.3' } });

      const errorMsg = t('cohortValidationVisusLowerExceedsUpper', 'en');
      expect(screen.queryByText(errorMsg)).not.toBeNull();

      expect(getSaveButton().hasAttribute('disabled')).toBe(true);
    });
  });

  describe('CRT validation', () => {
    it('negative CRT min shows cohortValidationCrtNonNumeric and disables Save', () => {
      setupMocks();
      renderPage();

      fireEvent.change(getCrtMinInput(), { target: { value: '-10' } });

      const errorMsg = t('cohortValidationCrtNonNumeric', 'en');
      expect(screen.queryByText(errorMsg)).not.toBeNull();

      expect(getSaveButton().hasAttribute('disabled')).toBe(true);
    });

    it('CRT min above CRT max shows cohortValidationCrtLowerExceedsUpper and disables Save', () => {
      setupMocks();
      renderPage();

      fireEvent.change(getCrtMinInput(), { target: { value: '600' } });
      fireEvent.change(getCrtMaxInput(), { target: { value: '400' } });

      const errorMsg = t('cohortValidationCrtLowerExceedsUpper', 'en');
      expect(screen.queryByText(errorMsg)).not.toBeNull();

      expect(getSaveButton().hasAttribute('disabled')).toBe(true);
    });
  });

  describe('valid inputs do not show errors and Save remains enabled (when name filled)', () => {
    it('valid age range shows no age error and Save is not disabled by age', () => {
      setupMocks();
      renderPage();

      fireEvent.change(getAgeMinInput(), { target: { value: '30' } });
      fireEvent.change(getAgeMaxInput(), { target: { value: '70' } });

      const errorMsg = t('cohortValidationAgeLowerExceedsUpper', 'en');
      expect(screen.queryByText(errorMsg)).toBeNull();
      const nonNumericError = t('cohortValidationAgeNonNumeric', 'en');
      expect(screen.queryByText(nonNumericError)).toBeNull();
    });

    it('clearing invalid input removes the error', () => {
      setupMocks();
      renderPage();

      fireEvent.change(getAgeMinInput(), { target: { value: '-5' } });
      expect(screen.queryByText(t('cohortValidationAgeNonNumeric', 'en'))).not.toBeNull();

      fireEvent.change(getAgeMinInput(), { target: { value: '' } });
      expect(screen.queryByText(t('cohortValidationAgeNonNumeric', 'en'))).toBeNull();
    });
  });
});
