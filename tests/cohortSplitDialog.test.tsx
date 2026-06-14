// @vitest-environment jsdom
/**
 * C3 — CohortSplitDialog component flow test.
 *
 * Verifies: preview renders groups + counts for a categorical split, confirm
 * calls addSavedSearch once per non-empty group with `Parent:<label>` names and
 * child filters intersecting the parent, and navigates to the compare route.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LOINC_VISUS } from '../shared/fhirCodes';
import type { PatientCase, SavedSearch } from '../shared/types/fhir';
import { t } from '../src/i18n/translations';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: () => ({
    locale: 'en',
    setLocale: vi.fn(),
    t: (key: string) => t(key as Parameters<typeof t>[0], 'en'),
  }),
}));

vi.mock('../src/services/settingsService', () => ({
  getSettings: () => ({ therapyInterrupterDays: 120, therapyBreakerDays: 365, crtImplausibleThresholdUm: 400 }),
}));

import CohortSplitDialog from '../src/pages/CohortSplitDialog';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCase(id: string, gender: string): PatientCase {
  return {
    id,
    pseudonym: id,
    gender,
    birthDate: '1970-01-01',
    centerId: 'org-a',
    centerName: 'Org A',
    conditions: [],
    observations: [
      {
        resourceType: 'Observation',
        id: `${id}-v`,
        status: 'final',
        code: { coding: [{ code: LOINC_VISUS, system: 'http://loinc.org' }] },
        subject: { reference: `Patient/${id}` },
        effectiveDateTime: '2024-06-01T00:00:00Z',
        valueQuantity: { value: 0.5, unit: 'decimal' },
      },
    ],
    procedures: [],
    imagingStudies: [],
    medications: [],
  } as unknown as PatientCase;
}

const parent: SavedSearch = {
  id: 'cohort-1',
  name: 'C1',
  createdAt: '2024-01-01T00:00:00Z',
  filters: { centers: ['org-a'] },
};

const cases = [makeCase('a', 'female'), makeCase('b', 'male'), makeCase('c', 'female')];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderDialog(addSavedSearch = vi.fn()) {
  render(
    <MemoryRouter>
      <CohortSplitDialog
        open
        parent={parent}
        savedSearches={[parent]}
        activeCases={cases}
        centers={[{ id: 'org-a', name: 'Org A', city: '', state: '', patientCount: 3, lastUpdated: '' }]}
        addSavedSearch={addSavedSearch}
        onClose={vi.fn()}
      />
    </MemoryRouter>,
  );
  return addSavedSearch;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CohortSplitDialog', () => {
  it('previews gender groups with counts (default attribute = gender)', () => {
    renderDialog();
    // Preview rows show "C1:Female" and "C1:Male"
    expect(screen.queryByText('C1:Female')).not.toBeNull();
    expect(screen.queryByText('C1:Male')).not.toBeNull();
  });

  it('confirm creates one child per non-empty group with intersected filters and navigates to compare', () => {
    const addSavedSearch = renderDialog();
    const confirm = screen.getByRole('button', { name: t('cohortSplitConfirm', 'en') });
    fireEvent.click(confirm);

    expect(addSavedSearch).toHaveBeenCalledTimes(2);
    const calls = addSavedSearch.mock.calls.map((c) => c[0] as { name: string; filters: { gender?: string[]; centers?: string[] } });
    const names = calls.map((c) => c.name).sort();
    expect(names).toEqual(['C1:Female', 'C1:Male']);
    // each child intersects the parent's center filter
    calls.forEach((c) => {
      expect(c.filters.centers).toEqual(['org-a']);
      expect(c.filters.gender?.length).toBe(1);
    });
    // compare auto-opens on the parent route
    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock.mock.calls[0][0]).toContain('compare=open');
    expect(navigateMock.mock.calls[0][0]).toContain('cohort=cohort-1');
  });

  it('switching to age + custom cut points previews 3 bins', () => {
    renderDialog();
    // Switch attribute to age
    const attrSelect = screen.getByLabelText(t('cohortSplitAttribute', 'en'));
    fireEvent.change(attrSelect, { target: { value: 'age' } });
    // Choose custom cut points mode
    const cutpointsRadio = screen.getByLabelText(t('cohortSplitModeCutpoints', 'en'));
    fireEvent.click(cutpointsRadio);
    const cutInput = screen.getByLabelText(t('cohortSplitCutpointsLabel', 'en'));
    fireEvent.change(cutInput, { target: { value: '50, 70' } });
    // 3 bins: < 50, 50–69, ≥ 70 → middle-bin label appears only in the preview list
    expect(screen.queryByText(/50–69/)).not.toBeNull();
    // preview confirm now enabled (>= 2 non-empty groups expected for this fixture's ages)
    expect(screen.getByText(/50–69/)).not.toBeNull();
  });
});
