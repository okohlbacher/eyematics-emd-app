/**
 * Shared test helper for OutcomesView integration tests.
 *
 * Exports:
 *  - vi.mock factory functions for 7 modules
 *  - Shared mock fn references (loadSettingsMock, postAggregateMock, fetchSpy,
 *    useDataMock, useLanguageMock, applyFiltersMock, computeCohortTrajectoryMock)
 *  - Stub builders (buildCase, buildCases)
 *  - renderOutcomesView(url, options) factory
 *
 * Design: all mock fn instances are defined at module level here. The factory
 * functions returned by e.g. dataContextFactory() return the SAME mock fn
 * instances, so renderOutcomesView can call .mockReturnValue on them directly
 * without needing to import from the mocked module (which would create TDZ
 * issues when the helper is loaded via vi.hoisted()).
 *
 * NOTE: Do NOT add the jsdom docblock here — this is not a test file.
 */
import { vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { PatientCase, SavedSearch } from '../../src/types/fhir';

// ---------------------------------------------------------------------------
// Shared mock fn references — defined at module level; returned by factory fns
// ---------------------------------------------------------------------------

export const loadSettingsMock = vi.fn();
export const postAggregateMock = vi.fn();
export const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));

// Context hook mock instances — shared between factory return values and renderOutcomesView
const useDataMock = vi.fn();
const useLanguageMock = vi.fn();
const applyFiltersMock = vi.fn((cases: unknown[]) => cases);
const getObservationsByCodeMock = vi.fn(() => []);
const computeCohortTrajectoryMock = vi.fn(() => ({
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
}));

// ---------------------------------------------------------------------------
// vi.mock factory functions — passed as second arg to vi.mock() in the test file
// (vi.mock calls must live in the test file; Vitest only hoists them from the
// file being compiled, not from imported helpers).
// ---------------------------------------------------------------------------

/**
 * Factory for `../src/services/settingsService`.
 * Partial mock: preserves real exports, overrides loadSettings.
 */
export const settingsServiceFactory = async (importOriginal: <T = unknown>() => Promise<T>) => {
  const actual = await importOriginal<typeof import('../../src/services/settingsService')>();
  return { ...actual, loadSettings: (...args: unknown[]) => loadSettingsMock(...args) };
};

/**
 * Factory for `../src/services/outcomesAggregateService`.
 */
export const outcomesAggregateFactory = () => ({
  postAggregate: (...args: unknown[]) => postAggregateMock(...args),
});

/**
 * Factory for `../src/context/DataContext`.
 * Returns the module-level useDataMock so renderOutcomesView can set it directly.
 */
export const dataContextFactory = () => ({
  useData: useDataMock,
});

/**
 * Factory for `../src/context/LanguageContext`.
 */
export const languageContextFactory = () => ({
  useLanguage: useLanguageMock,
});

/**
 * Factory for `../src/services/fhirLoader`.
 */
export const fhirLoaderFactory = () => ({
  applyFilters: applyFiltersMock,
  LOINC_VISUS: '79880-1',
  SNOMED_IVI: '36189003',
  SNOMED_EYE_LEFT: '362502000',
  SNOMED_EYE_RIGHT: '362503005',
  getObservationsByCode: getObservationsByCodeMock,
});

/**
 * Factory for `../src/utils/cohortTrajectory`.
 * Partial mock: preserves real exports, overrides computeCohortTrajectory.
 */
export const cohortTrajectoryFactory = async (importOriginal: <T = unknown>() => Promise<T>) => {
  const real = await importOriginal<typeof import('../../src/utils/cohortTrajectory')>();
  return {
    ...real,
    computeCohortTrajectory: computeCohortTrajectoryMock,
  };
};

/**
 * Factory for `recharts`.
 * Partial mock: stubs ResizeObserver-dependent components to avoid jsdom issues.
 */
export const rechartsFactory = async (importOriginal: <T = unknown>() => Promise<T>) => {
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
};

// ---------------------------------------------------------------------------
// Stub builders
// ---------------------------------------------------------------------------

/** Build a minimal PatientCase stub with one visus observation */
export function buildCase(pseudo: string): PatientCase {
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
export function buildCases(n: number): PatientCase[] {
  return Array.from({ length: n }, (_, i) => buildCase(`p${i + 1}`));
}

// ---------------------------------------------------------------------------
// renderOutcomesView options interface
// ---------------------------------------------------------------------------

export interface RenderOutcomesViewOptions {
  activeCases?: PatientCase[];
  savedSearches?: SavedSearch[];
  locale?: string;
  settings?: Partial<{
    twoFactorEnabled: boolean;
    therapyInterrupterDays: number;
    therapyBreakerDays: number;
    dataSource: { type: 'local'; blazeUrl: string };
    outcomes: { serverAggregationThresholdPatients: number; aggregateCacheTtlMs: number };
  }>;
  postAggregate?: (...args: unknown[]) => unknown;
  cohortTrajectoryResult?: unknown;
}

// ---------------------------------------------------------------------------
// renderOutcomesView factory
// ---------------------------------------------------------------------------

/**
 * Renders OutcomesView inside a MemoryRouter at `url` with mocked context hooks.
 *
 * The test file must have registered vi.mock() calls using the factory functions
 * exported from this helper before calling renderOutcomesView. Since the factory
 * functions above return the module-level mock fn instances (useDataMock etc.),
 * renderOutcomesView can configure them directly without going through the mocked
 * module imports (which would have TDZ issues).
 *
 * Default mock state (D-01):
 *  - activeCases: buildCases(5)
 *  - savedSearches: [{ id: 'test-cohort', name: 'Test Cohort', ... }]
 *  - locale: 'en'
 *  - settings: twoFactorEnabled=false, therapyInterrupterDays=120, etc.
 */
export async function renderOutcomesView(
  url: string,
  options: RenderOutcomesViewOptions = {},
): Promise<ReturnType<typeof render>> {
  const activeCases = options.activeCases ?? buildCases(5);
  const savedSearches: SavedSearch[] = options.savedSearches ?? [
    { id: 'test-cohort', name: 'Test Cohort', createdAt: '2024-01-01T00:00:00Z', filters: {} },
  ];
  const locale = options.locale ?? 'en';
  const settings = {
    twoFactorEnabled: false,
    therapyInterrupterDays: 120,
    therapyBreakerDays: 365,
    dataSource: { type: 'local' as const, blazeUrl: '' },
    outcomes: { serverAggregationThresholdPatients: 1000, aggregateCacheTtlMs: 1800000 },
    ...(options.settings ?? {}),
  };

  loadSettingsMock.mockResolvedValue(settings);

  if (options.postAggregate) {
    postAggregateMock.mockImplementation(options.postAggregate);
  }

  // Configure hook mocks directly using the module-level vi.fn() instances.
  // These are the SAME instances returned by the factory functions, so they
  // are already installed as the mock module's exports.
  useDataMock.mockReturnValue({
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

  useLanguageMock.mockReturnValue({
    locale,
    setLocale: vi.fn(),
    t: (k: string) => k,
  });

  applyFiltersMock.mockImplementation((cases: PatientCase[]) => cases);

  if (options.cohortTrajectoryResult !== undefined) {
    computeCohortTrajectoryMock.mockReturnValue(options.cohortTrajectoryResult);
  }

  // Dynamic import ensures OutcomesView is loaded AFTER vi.mock() calls have been
  // registered (which happens when the test file sets up its module mocks). At call
  // time the mock registry is active, so OutcomesView's transitive imports resolve
  // to the mocked versions (useData → vi.fn(), loadSettings → loadSettingsMock, etc.).
  const { default: OutcomesView } = await import('../../src/components/outcomes/OutcomesView');

  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/analysis" element={<OutcomesView />} />
      </Routes>
    </MemoryRouter>,
  );
}
