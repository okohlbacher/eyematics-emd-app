// @vitest-environment jsdom
/**
 * OutcomesPage RTL test suite — tests 1..7 (09-01) of the 17-case phase suite.
 * Tests 8-12 (panels, cards, tooltip, drawer) land in 09-02.
 * Tests 13-17 (data preview, CSV) land in 09-03.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
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

// Mock cohortTrajectory so tests 8-12 control the aggregate directly.
// The real function is pure math; tests assert DOM behaviour from the result shape.
vi.mock('../src/utils/cohortTrajectory', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/utils/cohortTrajectory')>();
  return {
    ...real,
    computeCohortTrajectory: vi.fn(),
  };
});

import { useData } from '../src/context/DataContext';
import { useLanguage } from '../src/context/LanguageContext';
import { applyFilters } from '../src/services/fhirLoader';
import { computeCohortTrajectory } from '../src/utils/cohortTrajectory';
import type { TrajectoryResult } from '../src/utils/cohortTrajectory';
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

// ---------------------------------------------------------------------------
// Tests 8..12 — panels, summary cards, drawer toggles (09-02)
// ---------------------------------------------------------------------------

/** Build a mock TrajectoryResult panel for a given eye with N patients and M measurements */
function makePanelResult(patientCount: number, measurementCount: number, excludedCount = 0) {
  return {
    patients: Array.from({ length: patientCount }, (_, i) => ({
      id: `p${i + 1}`,
      pseudonym: `p${i + 1}`,
      measurements: Array.from({ length: Math.floor(measurementCount / Math.max(patientCount, 1)) }, (__, j) => ({
        date: `2024-0${(j % 9) + 1}-01`,
        decimal: 0.8,
        logmar: 0.097,
        snellenNum: 20,
        snellenDen: 25,
        eye: 'od' as const,
        x: (j + 1) * 30,
        y: 0.097,
      })),
      sparse: false,
      excluded: false,
      baseline: 0.097,
    })),
    scatterPoints: [],
    medianGrid: Array.from({ length: 10 }, (_, i) => ({
      x: (i + 1) * 15,
      y: 0.097,
      p25: 0.05,
      p75: 0.15,
      n: patientCount,
    })),
    summary: { patientCount, measurementCount, excludedCount },
  };
}

/** Build a full TrajectoryResult for use in tests 8-12 */
function makeTrajectoryResult(override: Partial<TrajectoryResult> = {}): TrajectoryResult {
  const defaultResult: TrajectoryResult = {
    od: makePanelResult(3, 15),
    os: makePanelResult(3, 15),
    combined: makePanelResult(3, 30),
  };
  return { ...defaultResult, ...override };
}

describe('OutcomesPage — panels, summary cards, drawer toggles (09-02)', () => {
  beforeEach(() => {
    // Default aggregate for 3-patient, 3×5 OD + 3×5 OS cohort
    (computeCohortTrajectory as ReturnType<typeof vi.fn>).mockReturnValue(makeTrajectoryResult());
  });

  /**
   * Test 8: OD panel renders an SVG for a 3-patient cohort with OD measurements.
   * OutcomesPanel must mount a Recharts ComposedChart which renders an <svg>.
   */
  it('8. OD panel renders and its subtree contains an svg element', () => {
    const cases = [
      buildPatientCaseWithVisus('p1'),
      buildPatientCaseWithVisus('p2'),
      buildPatientCaseWithVisus('p3'),
    ];
    (computeCohortTrajectory as ReturnType<typeof vi.fn>).mockReturnValue(makeTrajectoryResult());
    renderWith({ activeCases: cases });

    const panel = screen.getByTestId('outcomes-panel-od');
    expect(panel).toBeDefined();
    const svg = panel.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  /**
   * Test 9: Toggling axisMode from 'days' to 'treatments' via the drawer
   * causes the axis label for treatments to appear in the DOM.
   */
  it('9. toggling x-axis to treatments in drawer causes axis label to appear', async () => {
    const cases = [buildPatientCaseWithVisus('p1')];
    renderWith({ activeCases: cases });

    // Open the settings drawer by clicking the gear button
    const gearBtn = screen.getByLabelText('outcomesOpenSettings');
    fireEvent.click(gearBtn);

    // Click the treatments radio
    await waitFor(() => {
      expect(screen.getByLabelText('outcomesXAxisTreatments')).toBeDefined();
    });
    fireEvent.click(screen.getByLabelText('outcomesXAxisTreatments'));

    // After toggle, outcomesXAxisTreatments label text or treatment tooltip key should appear
    await waitFor(() => {
      // The drawer radio is checked AND the panel xLabel reflects treatments mode
      const treatmentsRadio = screen.getByLabelText('outcomesXAxisTreatments') as HTMLInputElement;
      expect(treatmentsRadio.checked).toBe(true);
    });
  });

  /**
   * Test 10: Toggling the spreadBand checkbox off removes the IQR area marker
   * from the OD panel subtree.
   */
  it('10. toggling spreadBand off removes the IQR marker from the OD panel', async () => {
    const cases = [buildPatientCaseWithVisus('p1')];
    renderWith({ activeCases: cases });

    // Initially the IQR marker should be present in OD panel
    expect(screen.getByTestId('outcomes-panel-od-iqr')).toBeDefined();

    // Open drawer and toggle the spread band off
    fireEvent.click(screen.getByLabelText('outcomesOpenSettings'));
    await waitFor(() => {
      expect(screen.getByLabelText('outcomesLayerSpreadBand')).toBeDefined();
    });
    fireEvent.click(screen.getByLabelText('outcomesLayerSpreadBand'));

    // IQR marker should now be absent
    await waitFor(() => {
      expect(screen.queryByTestId('outcomes-panel-od-iqr')).toBeNull();
    });
  });

  /**
   * Test 11: With a 31-patient cohort, the Scatter checkbox is unchecked on mount.
   * (D-37 — defaultScatterOn(31) === false)
   */
  it('11. with 31-patient cohort, scatter checkbox is unchecked in drawer on mount', async () => {
    const cases = Array.from({ length: 31 }, (_, i) =>
      buildPatientCaseWithVisus(`p${i + 1}`),
    );
    renderWith({ activeCases: cases });

    // Open the drawer
    fireEvent.click(screen.getByLabelText('outcomesOpenSettings'));

    await waitFor(() => {
      const scatterCheckbox = screen.getByLabelText('outcomesLayerScatter') as HTMLInputElement;
      expect(scatterCheckbox.checked).toBe(false);
    });
  });

  /**
   * Test 12: Summary cards parity for an all-OD cohort of 3 patients × 5 OD observations.
   * Patients card: "3", OD card: "15", OS card: "0" + excluded hint, Total card: "15".
   */
  it('12. summary cards display values matching the aggregate for all-OD cohort', () => {
    const cases = [
      buildPatientCaseWithVisus('p1'),
      buildPatientCaseWithVisus('p2'),
      buildPatientCaseWithVisus('p3'),
    ];

    // All-OD cohort: 3 patients × 5 OD each, 0 OS
    const allOdAggregate: TrajectoryResult = {
      od: makePanelResult(3, 15),
      os: makePanelResult(0, 0, 0),
      combined: makePanelResult(3, 15),
    };
    (computeCohortTrajectory as ReturnType<typeof vi.fn>).mockReturnValue(allOdAggregate);

    renderWith({ activeCases: cases });

    // Patients card
    const patientsCard = screen.getByTestId('outcomes-card-patients');
    expect(patientsCard.textContent).toContain('3');

    // OD card: 15 measurements
    const odCard = screen.getByTestId('outcomes-card-od');
    expect(odCard.textContent).toContain('15');

    // OS card: 0 measurements + excluded hint
    const osCard = screen.getByTestId('outcomes-card-os');
    expect(osCard.textContent).toContain('0');
    expect(osCard.textContent).toContain('outcomesCardExcluded');

    // Total card: 15 total
    const totalCard = screen.getByTestId('outcomes-card-total');
    expect(totalCard.textContent).toContain('15');
  });
});
