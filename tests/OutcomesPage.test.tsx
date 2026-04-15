// @vitest-environment jsdom
/**
 * OutcomesPage RTL test suite — tests 1..7 (09-01) of the 17-case phase suite.
 * Tests 8-12 (panels, cards, tooltip, drawer) land in 09-02.
 * Tests 13-17 (data preview, CSV) land in 09-03.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import OutcomesPage from '../src/pages/OutcomesPage';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../src/context/DataContext', () => ({
  useData: vi.fn(),
}));

vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: vi.fn(),
}));

vi.mock('../src/services/fhirLoader', () => ({
  applyFilters: vi.fn((cases: unknown[]) => cases),
  LOINC_VISUS: '79880-1',
  SNOMED_IVI: '36189003',
  SNOMED_EYE_LEFT: '362503005',
  SNOMED_EYE_RIGHT: '362502000',
  getObservationsByCode: vi.fn(() => []),
}));

import { useData } from '../src/context/DataContext';
import { useLanguage } from '../src/context/LanguageContext';
import { applyFilters } from '../src/services/fhirLoader';
import type { PatientCase, SavedSearch } from '../src/types/fhir';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Minimal PatientCase stub */
function buildPatientCase(pseudo: string): PatientCase {
  return {
    id: pseudo,
    pseudonym: pseudo,
    gender: 'female',
    birthDate: '1970-01-01',
    centerId: 'org-uka',
    centerName: 'UKA',
    conditions: [],
    observations: [],
    procedures: [],
    imagingStudies: [],
    medications: [],
  } as unknown as PatientCase;
}

/** Build a minimal PatientCase with one LOINC_VISUS observation */
function buildPatientCaseWithVisus(pseudo: string): PatientCase {
  const obs = {
    resourceType: 'Observation',
    id: `obs-${pseudo}`,
    code: { coding: [{ system: 'http://loinc.org', code: '79880-1' }] },
    valueQuantity: { value: 0.8, unit: 'decimal' },
    effectiveDateTime: '2024-01-15',
    bodySite: { coding: [{ system: 'http://snomed.info/sct', code: '362503005' }] },
  };
  return {
    id: pseudo,
    pseudonym: pseudo,
    gender: 'male',
    birthDate: '1960-05-01',
    centerId: 'org-uka',
    centerName: 'UKA',
    conditions: [],
    observations: [obs],
    procedures: [],
    imagingStudies: [],
    medications: [],
  } as unknown as PatientCase;
}

/** Default mock returns */
const defaultDataMock = {
  activeCases: [] as PatientCase[],
  savedSearches: [] as SavedSearch[],
  centers: [],
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

function setupMocks(overrides: {
  activeCases?: PatientCase[];
  savedSearches?: SavedSearch[];
} = {}) {
  (useData as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    ...defaultDataMock,
    ...overrides,
  });
  (useLanguage as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    locale: 'de',
    setLocale: vi.fn(),
    t: (k: string) => k,
  });
  // applyFilters passthrough by default
  (applyFilters as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (cases: PatientCase[]) => cases,
  );
}

interface RenderOptions {
  activeCases?: PatientCase[];
  savedSearches?: SavedSearch[];
  initialEntries?: string[];
}

function renderWith({ activeCases = [], savedSearches = [], initialEntries = ['/outcomes'] }: RenderOptions = {}) {
  setupMocks({ activeCases, savedSearches });
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/outcomes" element={<OutcomesPage />} />
        <Route path="/cohort" element={<div data-testid="cohort-page" />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// fetch spy
// ---------------------------------------------------------------------------

const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));

beforeEach(() => {
  global.fetch = fetchSpy as unknown as typeof fetch;
  fetchSpy.mockClear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests 1..7
// ---------------------------------------------------------------------------

describe('OutcomesPage — route resolution, audit beacon, empty states (09-01)', () => {
  /**
   * Test 1: Renders outcomesTitle heading when cohort resolves.
   * Path: no query params → fallback to activeCases (3 patients).
   */
  it('1. renders outcomesTitle heading when cohort resolves via fallback (activeCases)', () => {
    const cases = [
      buildPatientCase('p1'),
      buildPatientCase('p2'),
      buildPatientCase('p3'),
    ];
    renderWith({ activeCases: cases });
    expect(screen.getByText('outcomesTitle')).toBeDefined();
  });

  /**
   * Test 2: Renders no-cohort empty state when activeCases is [] and no query params.
   */
  it('2. renders no-cohort empty state when activeCases is [] and no query params', () => {
    renderWith({ activeCases: [] });
    expect(screen.getByText('outcomesEmptyCohortTitle')).toBeDefined();
  });

  /**
   * Test 3: Renders no-cohort empty state when ?cohort=does-not-exist
   * (savedSearches has no matching id → cohort resolution yields null).
   */
  it('3. renders no-cohort empty state when ?cohort=does-not-exist', () => {
    const savedSearches: SavedSearch[] = [
      { id: 'other-id', name: 'Other', createdAt: '2024-01-01T00:00:00Z', filters: {} },
    ];
    renderWith({
      activeCases: [buildPatientCase('p1')],
      savedSearches,
      initialEntries: ['/outcomes?cohort=does-not-exist'],
    });
    expect(screen.getByText('outcomesEmptyCohortTitle')).toBeDefined();
  });

  /**
   * Test 4: With ?filter=<urlencoded-json-of-valid-CohortFilter>, parses via
   * safePickFilter and renders the title.
   */
  it('4. parses ?filter= valid JSON and renders outcomesTitle', () => {
    const filter = encodeURIComponent(JSON.stringify({ diagnosis: ['AMD'] }));
    const cases = [buildPatientCase('p1'), buildPatientCase('p2')];
    // applyFilters still returns all cases (mock passthrough)
    renderWith({
      activeCases: cases,
      initialEntries: [`/outcomes?filter=${filter}`],
    });
    expect(screen.getByText('outcomesTitle')).toBeDefined();
  });

  /**
   * Test 5: With ?filter=<invalid-json>, renders the no-cohort empty state
   * (safePickFilter catch branch → null cohort).
   */
  it('5. renders no-cohort empty state when ?filter= is invalid JSON', () => {
    renderWith({
      activeCases: [buildPatientCase('p1')],
      initialEntries: ['/outcomes?filter=not-valid-json%7B%7B'],
    });
    expect(screen.getByText('outcomesEmptyCohortTitle')).toBeDefined();
  });

  /**
   * Test 6: Fires GET /api/audit/events/view-open?name=open_outcomes_view&cohort=abc
   * exactly once on mount with credentials: 'include'.
   */
  it('6. fires audit beacon exactly once on mount with correct URL and credentials', async () => {
    const cases = [buildPatientCase('p1')];
    const savedSearches: SavedSearch[] = [
      { id: 'abc', name: 'My Cohort', createdAt: '2024-01-01T00:00:00Z', filters: {} },
    ];
    renderWith({
      activeCases: cases,
      savedSearches,
      initialEntries: ['/outcomes?cohort=abc'],
    });

    // Wait for fetch to be called (fire-and-forget effect)
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('name=open_outcomes_view');
    expect(url).toContain('cohort=abc');
    expect(init?.credentials).toBe('include');
  });

  /**
   * Test 7: With a 31-patient cohort, the scatter-layer defaults to false
   * (D-37: defaultScatterOn returns false above 30). Assert via
   * data-testid="outcomes-scatter-default-off" marker.
   */
  it('7. with 31-patient cohort, scatter layer initializes to false (D-37)', async () => {
    const cases = Array.from({ length: 31 }, (_, i) =>
      buildPatientCaseWithVisus(`p${i + 1}`),
    );
    renderWith({ activeCases: cases });

    // The marker flips after the scatter useEffect runs
    const marker = await screen.findByTestId('outcomes-scatter-default-off');
    expect(marker).toBeDefined();
  });
});
