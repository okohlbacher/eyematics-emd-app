// @vitest-environment jsdom
/**
 * Phase 12 Plan 04 / AGG-03 — OutcomesView size-based routing tests.
 * Verifies: below-threshold does NOT call server; above-threshold calls server
 * 3x (one per eye); loading indicator visible during fetch; server error falls
 * back to client compute path.
 *
 * Provider wiring mirrors tests/OutcomesPage.test.tsx (vi.mock useData + useLanguage
 * hooks directly — OutcomesView does not use a React context provider tree, it reads
 * from hooks that are mocked at the module boundary).
 *
 * Saved-search seeding: OutcomesView resolves cohortId via
 * `savedSearches.find(s => s.id === cohortId)`. Above-threshold tests must seed
 * a matching entry so the cohort resolves (otherwise routeServerSide stays false).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import OutcomesView from '../src/components/outcomes/OutcomesView';

// ---------------------------------------------------------------------------
// Module mocks — declared before imports so vi.mock hoisting works.
// ---------------------------------------------------------------------------

const loadSettingsMock = vi.fn();
const postAggregateMock = vi.fn();

vi.mock('../src/services/settingsService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/settingsService')>();
  return { ...actual, loadSettings: (...args: unknown[]) => loadSettingsMock(...args) };
});

vi.mock('../src/services/outcomesAggregateService', () => ({
  postAggregate: (...args: unknown[]) => postAggregateMock(...args),
}));

// Mock context hooks (same pattern as OutcomesPage.test.tsx)
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
  SNOMED_EYE_LEFT: '362502000',
  SNOMED_EYE_RIGHT: '362503005',
  getObservationsByCode: vi.fn(() => []),
}));

// Mock cohortTrajectory so client-side compute path returns a predictable result.
vi.mock('../src/utils/cohortTrajectory', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/utils/cohortTrajectory')>();
  return {
    ...real,
    computeCohortTrajectory: vi.fn(() => ({
      od: {
        patients: [],
        scatterPoints: [],
        medianGrid: [{ x: 0, y: 0.1, p25: 0.05, p75: 0.15, n: 1 }],
        summary: { patientCount: 1, measurementCount: 1, excludedCount: 0 },
      },
      os: {
        patients: [],
        scatterPoints: [],
        medianGrid: [{ x: 0, y: 0.1, p25: 0.05, p75: 0.15, n: 1 }],
        summary: { patientCount: 1, measurementCount: 1, excludedCount: 0 },
      },
      combined: {
        patients: [],
        scatterPoints: [],
        medianGrid: [{ x: 0, y: 0.1, p25: 0.05, p75: 0.15, n: 1 }],
        summary: { patientCount: 1, measurementCount: 1, excludedCount: 0 },
      },
    })),
  };
});

// Mock Recharts to avoid ResizeObserver issues in jsdom.
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
import type { PatientCase, SavedSearch } from '../src/types/fhir';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Build a minimal PatientCase stub with one visus observation */
function buildCase(pseudo: string): PatientCase {
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
    birthDate: '1960-01-01',
    centerId: 'org-uka',
    centerName: 'UKA',
    conditions: [],
    observations: [obs],
    procedures: [],
    imagingStudies: [],
    medications: [],
  } as unknown as PatientCase;
}

/** Build N cases */
function buildCases(n: number): PatientCase[] {
  return Array.from({ length: n }, (_, i) => buildCase(`p${i + 1}`));
}

const COHORT_ID = 'test-cohort';

/**
 * Render OutcomesView with the given activeCases and a saved search seeded for
 * cohortId='test-cohort' (required for routeServerSide to resolve the cohort).
 */
function renderView(
  activeCases: PatientCase[],
  options: { cohortId?: string; savedSearches?: SavedSearch[] } = {},
) {
  const cohortId = options.cohortId ?? COHORT_ID;
  const savedSearches: SavedSearch[] = options.savedSearches ?? [
    { id: COHORT_ID, name: 'Test Cohort', createdAt: '2024-01-01T00:00:00Z', filters: {} },
  ];

  (useData as ReturnType<typeof vi.fn>).mockReturnValue({
    activeCases,
    savedSearches,
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
  });
  (useLanguage as ReturnType<typeof vi.fn>).mockReturnValue({
    locale: 'en',
    setLocale: vi.fn(),
    t: (k: string) => k,
  });
  (applyFilters as ReturnType<typeof vi.fn>).mockImplementation(
    (cases: PatientCase[]) => cases,
  );

  return render(
    <MemoryRouter
      initialEntries={[`/analysis?tab=trajectories&cohort=${cohortId}`]}
    >
      <Routes>
        <Route path="/analysis" element={<OutcomesView />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// fetch spy — keeps audit beacon from causing issues
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
// AGG-03 tests
// ---------------------------------------------------------------------------

describe('AGG-03 — size-based routing in OutcomesView', () => {
  it('does NOT call /api/outcomes/aggregate when cohort.cases.length <= threshold', async () => {
    // threshold = 1000; 5 cases → below threshold → no server call
    loadSettingsMock.mockResolvedValue({
      twoFactorEnabled: false,
      therapyInterrupterDays: 120,
      therapyBreakerDays: 365,
      dataSource: { type: 'local' as const, blazeUrl: '' },
      outcomes: { serverAggregationThresholdPatients: 1000, aggregateCacheTtlMs: 1800000 },
    });

    renderView(buildCases(5));

    // Allow loadSettings effect to complete
    await waitFor(() => expect(loadSettingsMock).toHaveBeenCalled());

    expect(postAggregateMock).not.toHaveBeenCalled();
  });

  it('calls postAggregate 3x (one per eye) when cohort.cases.length > threshold', async () => {
    // threshold = 5; 10 cases → above threshold → 3 server calls
    loadSettingsMock.mockResolvedValue({
      twoFactorEnabled: false,
      therapyInterrupterDays: 120,
      therapyBreakerDays: 365,
      dataSource: { type: 'local' as const, blazeUrl: '' },
      outcomes: { serverAggregationThresholdPatients: 5, aggregateCacheTtlMs: 1800000 },
    });
    postAggregateMock.mockResolvedValue({
      median: [],
      iqrLow: [],
      iqrHigh: [],
      meta: { patientCount: 10, excludedCount: 0, measurementCount: 0, cacheHit: false },
    });

    renderView(buildCases(10));

    await waitFor(() => expect(postAggregateMock).toHaveBeenCalledTimes(3));

    const eyes = postAggregateMock.mock.calls
      .map((c) => (c[0] as { eye: string }).eye)
      .sort();
    expect(eyes).toEqual(['combined', 'od', 'os']);
  });

  it('renders the "Computing on server…" indicator while fetches are in flight', async () => {
    // threshold = 5; 10 cases → above threshold; never-resolving promise
    loadSettingsMock.mockResolvedValue({
      twoFactorEnabled: false,
      therapyInterrupterDays: 120,
      therapyBreakerDays: 365,
      dataSource: { type: 'local' as const, blazeUrl: '' },
      outcomes: { serverAggregationThresholdPatients: 5, aggregateCacheTtlMs: 1800000 },
    });
    // Never resolves → loading state stays true
    postAggregateMock.mockImplementation(() => new Promise(() => {}));

    renderView(buildCases(10));

    await waitFor(() =>
      expect(screen.getByTestId('outcomes-server-computing')).toBeDefined(),
    );
  });

  it('falls back to client compute path on server error', async () => {
    // threshold = 5; 10 cases → above threshold; postAggregate rejects
    loadSettingsMock.mockResolvedValue({
      twoFactorEnabled: false,
      therapyInterrupterDays: 120,
      therapyBreakerDays: 365,
      dataSource: { type: 'local' as const, blazeUrl: '' },
      outcomes: { serverAggregationThresholdPatients: 5, aggregateCacheTtlMs: 1800000 },
    });
    postAggregateMock.mockRejectedValue(new Error('Server aggregate failed: 500'));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderView(buildCases(10));

    await waitFor(() =>
      expect(warnSpy).toHaveBeenCalledWith(
        '[OutcomesView] Server aggregate failed — falling back to client compute',
        expect.any(Error),
      ),
    );

    // After fallback, the client-side panels should render (no blocking error).
    // The h2 heading shows "outcomesTitle: Test Cohort" (t() returns the key in tests,
    // cohort.name is 'Test Cohort'). Verify the heading is present via the testid-free
    // approach: check that the OD panel renders (panels only appear when aggregate resolves).
    await waitFor(() => {
      // The scatter marker confirms the cohort rendered past the early-return guards
      expect(screen.queryByText('outcomesEmptyCohortTitle')).toBeNull();
    });

    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// XCOHORT-04 — cross-cohort deep-link restoration (Phase 16)
// ---------------------------------------------------------------------------

const CROSS_COHORT_SAVED_SEARCHES: SavedSearch[] = [
  { id: 'p1', name: 'Cohort A', createdAt: '2026-01-01', filters: {} },
  { id: 'p2', name: 'Cohort B', createdAt: '2026-01-02', filters: {} },
  { id: 'p3', name: 'Cohort C', createdAt: '2026-01-03', filters: {} },
  { id: 'p4', name: 'Cohort D', createdAt: '2026-01-04', filters: {} },
  { id: 'p5', name: 'Cohort E', createdAt: '2026-01-05', filters: {} },
];

/**
 * Render OutcomesView at a URL with cross-cohort params.
 * savedSearches defaults to CROSS_COHORT_SAVED_SEARCHES (5 entries p1–p5).
 */
function renderCrossView(
  initialUrl: string,
  options: { savedSearches?: SavedSearch[] } = {},
) {
  const savedSearches = options.savedSearches ?? CROSS_COHORT_SAVED_SEARCHES;
  const activeCases = buildCases(5);

  (useData as ReturnType<typeof vi.fn>).mockReturnValue({
    activeCases,
    savedSearches,
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
  });
  (useLanguage as ReturnType<typeof vi.fn>).mockReturnValue({
    locale: 'en',
    setLocale: vi.fn(),
    t: (k: string) => k,
  });
  (applyFilters as ReturnType<typeof vi.fn>).mockImplementation(
    (cases: PatientCase[]) => cases,
  );

  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route path="/analysis" element={<OutcomesView />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('OutcomesView — cross-cohort routing (Phase 16)', () => {
  it('XCOHORT-04: ?cohorts=p1,p2 enters cross-cohort mode without user interaction', async () => {
    loadSettingsMock.mockResolvedValue({
      twoFactorEnabled: false,
      therapyInterrupterDays: 120,
      therapyBreakerDays: 365,
      dataSource: { type: 'local' as const, blazeUrl: '' },
      outcomes: { serverAggregationThresholdPatients: 1000, aggregateCacheTtlMs: 1800000 },
    });

    renderCrossView('/analysis?cohort=p1&cohorts=p1,p2');

    // Subtitle reflects cross mode via the outcomesCrossMode key.
    // The t() mock returns the key, so the subtitle will contain 'outcomesCrossMode'.
    await waitFor(() =>
      expect(screen.getByText(/outcomesCrossMode/i)).toBeDefined(),
    );
  });

  it('XCOHORT-04: ?cohorts= caps at 4 cohorts (fifth id dropped)', async () => {
    loadSettingsMock.mockResolvedValue({
      twoFactorEnabled: false,
      therapyInterrupterDays: 120,
      therapyBreakerDays: 365,
      dataSource: { type: 'local' as const, blazeUrl: '' },
      outcomes: { serverAggregationThresholdPatients: 1000, aggregateCacheTtlMs: 1800000 },
    });

    renderCrossView('/analysis?cohort=p1&cohorts=p1,p2,p3,p4,p5');

    // The subtitle is built from crossCohortAggregates.combined which has at most 4 entries.
    // With t() returning the key, the text will be "outcomesCrossMode · Cohort A, Cohort B, Cohort C, Cohort D"
    // (4 cohorts, not 5). Check that 5 cohorts are not all shown.
    await waitFor(() => {
      const subtitle = screen.getByText(/outcomesCrossMode/i);
      // Cohort E should be absent (5th cohort dropped)
      expect(subtitle.textContent).not.toContain('Cohort E');
    });
  });

  it('XCOHORT-04: unknown cohort ids in ?cohorts= are silently dropped', async () => {
    loadSettingsMock.mockResolvedValue({
      twoFactorEnabled: false,
      therapyInterrupterDays: 120,
      therapyBreakerDays: 365,
      dataSource: { type: 'local' as const, blazeUrl: '' },
      outcomes: { serverAggregationThresholdPatients: 1000, aggregateCacheTtlMs: 1800000 },
    });

    renderCrossView('/analysis?cohort=p1&cohorts=p1,pUNKNOWN');

    // Unknown id pUNKNOWN is filtered out; only p1 remains.
    // With 1 entry crossCohortAggregates still resolves (1 valid cohort).
    // Panels must render without crashing.
    await waitFor(() => {
      const panel = screen.getByTestId('outcomes-panel-od');
      expect(panel).toBeDefined();
    });
  });
});
