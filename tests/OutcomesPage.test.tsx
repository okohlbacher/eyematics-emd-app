// @vitest-environment jsdom
/**
 * OutcomesPage RTL test suite — tests 1..7 (09-01) of the 17-case phase suite.
 * Tests 8-12 (panels, cards, tooltip, drawer) land in 09-02.
 * Tests 13-17 (data preview, CSV) land in 09-03.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// download.ts mock — used by tests 15-17 (CSV export assertions).
// Declared before other imports so vi.mock hoisting works correctly.
// ---------------------------------------------------------------------------
const downloadCsvSpy = vi.fn();
const datedFilenameSpy = vi.fn((prefix: string, ext: string) => `${prefix}-2026-04-15.${ext}`);

vi.mock('../src/utils/download', () => ({
  downloadCsv: (...args: unknown[]) => downloadCsvSpy(...args),
  datedFilename: (p: string, e: string) => datedFilenameSpy(p, e),
}));
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
    computeCohortTrajectory: vi.fn(() => ({
      od: { patients: [], scatterPoints: [], medianGrid: [{ x: 0, y: 0.1, p25: 0.05, p75: 0.15, n: 1 }], summary: { patientCount: 1, measurementCount: 1, excludedCount: 0 } },
      os: { patients: [], scatterPoints: [], medianGrid: [{ x: 0, y: 0.1, p25: 0.05, p75: 0.15, n: 1 }], summary: { patientCount: 1, measurementCount: 1, excludedCount: 0 } },
      combined: { patients: [], scatterPoints: [], medianGrid: [{ x: 0, y: 0.1, p25: 0.05, p75: 0.15, n: 1 }], summary: { patientCount: 1, measurementCount: 1, excludedCount: 0 } },
    })),
  };
});

// Mock Recharts so ComposedChart renders a predictable SVG in jsdom (no ResizeObserver).
vi.mock('recharts', async (importOriginal) => {
  const real = await importOriginal<typeof import('recharts')>();
  return {
    ...real,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ResponsiveContainer: ({ children }: { children: any }) => (
      <div data-testid="recharts-responsive-container">
        <svg>{children}</svg>
      </div>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ComposedChart: ({ children }: { children: any }) => (
      <g data-testid="recharts-composed-chart">{children}</g>
    ),
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
    ReferenceLine: () => null,
    Area: () => <g data-testid="recharts-area" />,
    Line: () => null,
    Scatter: () => null,
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
   * Test 6 (Phase 11 / CRREV-01): Fires POST /api/audit/events/view-open with
   * JSON body + keepalive; no cohort id / filter in URL. Migrated from the
   * legacy GET-with-querystring shape.
   */
  it('6. fires audit beacon POST with JSON body, keepalive, and no cohort id in URL (Phase 11)', async () => {
    const cases = [buildPatientCase('p1')];
    const savedSearches: SavedSearch[] = [
      { id: 'abc', name: 'My Cohort', createdAt: '2024-01-01T00:00:00Z', filters: {} },
    ];
    renderWith({
      activeCases: cases,
      savedSearches,
      initialEntries: ['/outcomes?cohort=abc'],
    });

    await new Promise((r) => setTimeout(r, 0));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    // URL must be exactly the endpoint — no querystring.
    expect(url).toBe('/api/audit/events/view-open');
    expect(url).not.toContain('?');
    expect(url).not.toContain('cohort');

    // Method + transport flags.
    expect(init?.method).toBe('POST');
    expect(init?.keepalive).toBe(true);
    expect(init?.credentials).toBe('include');
    expect((init?.headers as Record<string, string>)?.['Content-Type']).toBe('application/json');

    // Body shape — cohortId in body, not URL.
    expect(typeof init?.body).toBe('string');
    const parsed = JSON.parse(init!.body as string);
    expect(parsed).toEqual({ name: 'open_outcomes_view', cohortId: 'abc' });
  });

  /**
   * Test 6b (Phase 11 / D-08): filter query param is decoded + parsed into the body object.
   */
  it('6b. decodes ?filter= into body.filter (no URL querystring)', async () => {
    const cases = [buildPatientCase('p1')];
    const filterObj = { diagnosis: ['AMD'], centers: ['org-uka'] };
    const filterParam = encodeURIComponent(JSON.stringify(filterObj));
    renderWith({
      activeCases: cases,
      initialEntries: [`/outcomes?filter=${filterParam}`],
    });

    await new Promise((r) => setTimeout(r, 0));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/audit/events/view-open');

    const parsed = JSON.parse(init!.body as string);
    expect(parsed.name).toBe('open_outcomes_view');
    expect(parsed.filter).toEqual(filterObj);
    expect(parsed).not.toHaveProperty('cohortId');
  });

  /**
   * Test 6c (Phase 11 / malformed-filter handling): drops unparseable filter; no crash.
   */
  it('6c. drops malformed ?filter= from the beacon body (fire-and-forget never throws)', async () => {
    const cases = [buildPatientCase('p1')];
    renderWith({
      activeCases: cases,
      initialEntries: ['/outcomes?filter=%7Binvalid'],
    });

    await new Promise((r) => setTimeout(r, 0));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const parsed = JSON.parse(init!.body as string);
    expect(parsed.name).toBe('open_outcomes_view');
    expect(parsed).not.toHaveProperty('filter');
    expect(parsed).not.toHaveProperty('cohortId');
  });

  /**
   * Test 6d (Phase 11 / no params): bare /outcomes mount produces the minimal body.
   */
  it('6d. with no query params, body contains only { name }', async () => {
    const cases = [buildPatientCase('p1')];
    renderWith({ activeCases: cases, initialEntries: ['/outcomes'] });

    await new Promise((r) => setTimeout(r, 0));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const parsed = JSON.parse(init!.body as string);
    expect(parsed).toEqual({ name: 'open_outcomes_view' });
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

// ---------------------------------------------------------------------------
// Tests 13..17 — data preview panel + CSV export (09-03)
// ---------------------------------------------------------------------------

/**
 * Build a PatientCase with N OD observations and M OS observations.
 * Each observation is a LOINC_VISUS entry with a unique date and decimal value.
 */
function buildPatientCaseWithMeasurements(
  pseudo: string,
  odCount: number,
  osCount: number,
): PatientCase {
  const observations = [
    ...Array.from({ length: odCount }, (_, i) => ({
      resourceType: 'Observation',
      id: `obs-od-${pseudo}-${i}`,
      code: { coding: [{ system: 'http://loinc.org', code: '79880-1' }] },
      valueQuantity: { value: 0.8 - i * 0.05, unit: 'decimal' },
      effectiveDateTime: `2024-0${i + 1}-01`,
      // SNOMED_EYE_RIGHT = '362503005' → eyeOf → 'od'
      bodySite: { coding: [{ system: 'http://snomed.info/sct', code: '362503005' }] },
    })),
    ...Array.from({ length: osCount }, (_, i) => ({
      resourceType: 'Observation',
      id: `obs-os-${pseudo}-${i}`,
      code: { coding: [{ system: 'http://loinc.org', code: '79880-1' }] },
      valueQuantity: { value: 0.7 - i * 0.05, unit: 'decimal' },
      effectiveDateTime: `2024-0${i + 4}-01`,
      // SNOMED_EYE_LEFT = '362502000' → eyeOf → 'os'
      bodySite: { coding: [{ system: 'http://snomed.info/sct', code: '362502000' }] },
    })),
  ];
  return {
    id: pseudo,
    pseudonym: pseudo,
    gender: 'female',
    birthDate: '1965-03-15',
    centerId: 'org-uka',
    centerName: 'UKA',
    conditions: [],
    observations,
    procedures: [],
    imagingStudies: [],
    medications: [],
  } as unknown as PatientCase;
}

describe('OutcomesPage — data preview panel + CSV export (09-03)', () => {
  // Fixture: 2 patients × (3 OD + 2 OS) = 10 rows total.
  // aggregate reflects the same counts so row-count parity holds.
  const previewCases = [
    buildPatientCaseWithMeasurements('alice', 3, 2),
    buildPatientCaseWithMeasurements('bob', 3, 2),
  ];
  const previewAggregate: TrajectoryResult = {
    od: makePanelResult(2, 6),   // 2 patients × 3 OD = 6
    os: makePanelResult(2, 4),   // 2 patients × 2 OS = 4
    combined: makePanelResult(2, 10),
  };

  beforeEach(() => {
    (computeCohortTrajectory as ReturnType<typeof vi.fn>).mockReturnValue(previewAggregate);
    downloadCsvSpy.mockClear();
    datedFilenameSpy.mockClear();
  });

  /**
   * Test 13: <details> renders collapsed by default.
   * The outcomesPreviewToggleOpen summary text is visible; its parent <details>
   * element must NOT have the `open` attribute.
   */
  it('13. <details> data preview renders collapsed by default', () => {
    renderWith({ activeCases: previewCases });
    const summary = screen.getByText('outcomesPreviewToggleOpen');
    expect(summary).toBeDefined();
    const details = summary.closest('details');
    expect(details).not.toBeNull();
    expect(details!.hasAttribute('open')).toBe(false);
  });

  /**
   * Test 14: Expanding the panel reveals all 8 column headers + parity caption.
   * Fixture: 10 rows (6 OD + 4 OS) → caption contains "10".
   */
  it('14. expanding <details> shows 8 column headers and row-count caption', () => {
    renderWith({ activeCases: previewCases });
    const summary = screen.getByText('outcomesPreviewToggleOpen');
    const details = summary.closest('details')!;
    // Programmatically open the details element
    details.setAttribute('open', '');

    // All 8 D-28 column header keys must appear as i18n keys (t(k) === k in test env)
    expect(screen.getByText('outcomesPreviewColPseudonym')).toBeDefined();
    expect(screen.getByText('outcomesPreviewColEye')).toBeDefined();
    expect(screen.getByText('outcomesPreviewColDate')).toBeDefined();
    expect(screen.getByText('outcomesPreviewColDaysSinceBaseline')).toBeDefined();
    expect(screen.getByText('outcomesPreviewColTreatmentIndex')).toBeDefined();
    expect(screen.getByText('outcomesPreviewColVisusLogmar')).toBeDefined();
    expect(screen.getByText('outcomesPreviewColSnellenNum')).toBeDefined();
    expect(screen.getByText('outcomesPreviewColSnellenDen')).toBeDefined();
  });

  /**
   * Test 15: Clicking Export CSV calls downloadCsv with headers in exact D-28 order.
   */
  it('15. Export CSV button calls downloadCsv with 8 D-28 column headers in order', () => {
    renderWith({ activeCases: previewCases });
    // Open the details
    const details = screen.getByTestId('outcomes-data-preview');
    details.setAttribute('open', '');

    const exportBtn = screen.getByLabelText('outcomesPreviewExportCsv');
    fireEvent.click(exportBtn);

    expect(downloadCsvSpy).toHaveBeenCalledTimes(1);
    const [headers] = downloadCsvSpy.mock.calls[0] as [string[], string[][], string];
    expect(headers).toHaveLength(8);
    expect(headers[0]).toBe('outcomesPreviewColPseudonym');
    expect(headers[1]).toBe('outcomesPreviewColEye');
    expect(headers[2]).toBe('outcomesPreviewColDate');
    expect(headers[3]).toBe('outcomesPreviewColDaysSinceBaseline');
    expect(headers[4]).toBe('outcomesPreviewColTreatmentIndex');
    expect(headers[5]).toBe('outcomesPreviewColVisusLogmar');
    expect(headers[6]).toBe('outcomesPreviewColSnellenNum');
    expect(headers[7]).toBe('outcomesPreviewColSnellenDen');
  });

  /**
   * Test 16: CSV headers have exactly 8 entries and do NOT contain "center_id" (D-30).
   */
  it('16. CSV headers have exactly 8 entries and do not include center_id', () => {
    renderWith({ activeCases: previewCases });
    const details = screen.getByTestId('outcomes-data-preview');
    details.setAttribute('open', '');

    fireEvent.click(screen.getByLabelText('outcomesPreviewExportCsv'));

    const [headers, rows] = downloadCsvSpy.mock.calls[0] as [string[], string[][], string];
    expect(headers).toHaveLength(8);
    expect(headers.join(',')).not.toContain('center_id');
    if (rows.length > 0) {
      expect(rows[0].join(',')).not.toContain('center_id');
    }
  });

  /**
   * Test 17: datedFilename is called with ('outcomes-cohort', 'csv') and the
   * resulting filename matches the shape outcomes-cohort-YYYY-MM-DD.csv.
   */
  it('17. CSV filename matches outcomes-cohort-YYYY-MM-DD.csv shape', () => {
    renderWith({ activeCases: previewCases });
    const details = screen.getByTestId('outcomes-data-preview');
    details.setAttribute('open', '');

    fireEvent.click(screen.getByLabelText('outcomesPreviewExportCsv'));

    expect(datedFilenameSpy).toHaveBeenCalledWith('outcomes-cohort', 'csv');
    const [, , filename] = downloadCsvSpy.mock.calls[0] as [string[], string[][], string];
    expect(filename).toMatch(/^outcomes-cohort-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
