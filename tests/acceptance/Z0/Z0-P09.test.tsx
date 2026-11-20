// @vitest-environment jsdom
// Z0-P09 — plan decisions not exercised by the container scenarios (PLAN §Z0-P09, Q28/Q36). Synthetic data only.
// - The threshold comes from settings (`thresholds.criticalCrtUm` via CRITICAL_CRT_THRESHOLD(), Q37), here mocked to 350
//   while the cohort-builder limit `crtImplausibleThresholdUm` is 400; count, label and list follow 350.
// - Count and list contain only cases of the cohort, with their highest CRT, sorted descending.
// - Compare mode: one count per cohort; each count opens the list of its own cohort.
// Mock set mirrors tests/AnalysisPage.test.tsx (no jest-dom).
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TranslationKey } from '../../../src/i18n/translations';
import { translations } from '../../../src/i18n/translations';
import type { CohortFilter, Observation, PatientCase, SavedSearch } from '../../../src/types/fhir';

const t = (key: TranslationKey) => (translations as Record<string, { de: string }>)[key]?.de ?? key;
const CRT = 'LP267955-5';
const THRESHOLD = 350;

const mockSearchParams = new URLSearchParams();
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [mockSearchParams, vi.fn()],
  useNavigate: () => mockNavigate,
}));
vi.mock('../../../src/hooks/useRecentActivity', () => ({ useRecentActivity: () => ({ record: vi.fn() }) }));
vi.mock('../../../src/context/LanguageContext', () => ({ useLanguage: () => ({ locale: 'de', t }) }));
vi.mock('../../../src/services/settingsService', () => ({
  getSettings: () => ({
    therapyInterrupterDays: 90,
    therapyBreakerDays: 365,
    crtImplausibleThresholdUm: 400,
    thresholds: { criticalCrtUm: THRESHOLD },
  }),
  loadSettings: vi.fn(),
}));
// applyFilters: a saved cohort is the set of cases at the centres named in its filter (empty = all).
vi.mock('../../../src/services/fhirLoader', () => ({
  applyFilters: (cases: PatientCase[], filters: CohortFilter) =>
    filters.centers?.length ? cases.filter((c) => filters.centers!.includes(c.centerName)) : cases,
  getAge: () => 65,
  getCenterShorthand: (_id: string, name: string) => name,
  getObservationsByCode: (obs: Observation[], code: string) =>
    obs.filter((o) => o.code.coding.some((c) => c.code === code)),
  LOINC_VISUS: '79880-1',
  LOINC_CRT: CRT,
}));
vi.mock('../../../src/services/terminology', () => ({
  getCachedDisplay: () => 'AMD',
  getCachedFullText: () => 'AMD',
}));
vi.mock('../../../src/utils/distributionBins', () => ({ computeCrtDistribution: () => [] }));
let mockData: { activeCases: PatientCase[]; savedSearches: SavedSearch[] } = { activeCases: [], savedSearches: [] };
vi.mock('../../../src/context/DataContext', () => ({ useData: () => mockData }));
vi.mock('recharts', () => {
  const stub = () => () => null;
  return Object.fromEntries(
    ['BarChart', 'Bar', 'LineChart', 'Line', 'PieChart', 'Pie', 'ScatterChart', 'Scatter', 'XAxis', 'YAxis',
      'CartesianGrid', 'Tooltip', 'Legend', 'Cell', 'ResponsiveContainer', 'ReferenceLine'].map((n) => [n, stub()]),
  );
});
vi.mock('../../../src/config/clinicalThresholds', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/config/clinicalThresholds')>()),
  CHART_COLORS: ['#a', '#b', '#c'],
}));
vi.mock('../../../src/components/outcomes/OutcomesView', () => ({ default: () => null }));

function crtCase(id: string, center: string, values: number[]): PatientCase {
  return {
    id,
    pseudonym: `EM-${id}`,
    birthDate: '1960-01-01',
    gender: 'female',
    centerId: center,
    centerName: center,
    conditions: [],
    procedures: [],
    medications: [],
    imagingStudies: [],
    observations: values.map((v, i) => ({
      resourceType: 'Observation',
      id: `${id}-o${i}`,
      status: 'final',
      code: { coding: [{ system: 'http://loinc.org', code: CRT }] },
      subject: { reference: `Patient/${id}` },
      effectiveDateTime: `2025-0${i + 1}-01`,
      valueQuantity: { value: v, unit: 'µm' },
    })),
  } as unknown as PatientCase;
}

const CASES = [
  crtCase('A1', 'Site A', [300, 420, 380]), // critical in A, highest 420
  crtCase('A2', 'Site A', [360]), // critical only with threshold 350
  crtCase('A3', 'Site A', [340]), // not critical
  crtCase('B1', 'Site B', [500, 410]), // critical in B, highest 500
];
const saved = (id: string, name: string, centers: string[]): SavedSearch =>
  ({ id, name, createdAt: '2026-01-01', filters: { centers } }) as SavedSearch;

function setParams(p: Record<string, string>) {
  [...mockSearchParams.keys()].forEach((k) => mockSearchParams.delete(k));
  Object.entries(p).forEach(([k, v]) => mockSearchParams.set(k, v));
}

afterEach(() => {
  cleanup();
  setParams({});
});

const { default: AnalysisPage } = await import('../../../src/pages/AnalysisPage');

const label = `Fälle mit kritischen Werten (CRT > ${THRESHOLD} µm)`;

function entries(): string[] {
  const dialog = screen.getByRole('dialog', { name: 'Fälle mit kritischen Werten' });
  return within(dialog).getAllByRole('listitem').map((li) => li.textContent ?? '');
}

describe('Z0-P09 plan decisions', () => {
  it('[Z0-P09] threshold from settings; count and list cover only the cohort, highest CRT descending', () => {
    mockData = { activeCases: CASES, savedSearches: [saved('sa', 'Kohorte A', ['Site A'])] };
    setParams({ cohort: 'sa' });
    render(<AnalysisPage />);
    const button = screen.getByRole('button', { name: `2 ${label}` });
    fireEvent.click(button);
    const list = entries();
    expect(list).toHaveLength(2);
    expect(list[0]).toContain('EM-A1');
    expect(list[0]).toContain('420 µm');
    expect(list[1]).toContain('EM-A2');
    expect(list[1]).toContain('360 µm');
    expect(list.join(' ')).not.toContain('EM-B1');
  });

  it('[Z0-P09] compare mode: one count per cohort, each opening the list of its own cohort', () => {
    mockData = {
      activeCases: CASES,
      savedSearches: [saved('sa', 'Kohorte A', ['Site A']), saved('sb', 'Kohorte B', ['Site B'])],
    };
    setParams({ cohort: 'sa', cohorts: 'sa,sb' });
    render(<AnalysisPage />);
    const buttonA = screen.getByRole('button', { name: `Kohorte A: 2 ${label}` });
    const buttonB = screen.getByRole('button', { name: `Kohorte B: 1 ${label}` });
    expect(screen.queryByRole('button', { name: `2 ${label}` })).toBeNull();

    fireEvent.click(buttonB);
    const listB = entries();
    expect(listB).toHaveLength(1);
    expect(listB[0]).toContain('EM-B1');
    expect(listB[0]).toContain('500 µm');
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(buttonA);
    expect(entries().map((e) => /EM-[A-Z]\d/.exec(e)?.[0])).toEqual(['EM-A1', 'EM-A2']);
  });

  it('[Z0-P09] "Vollständige Fallansicht" opens the case view of the entry', () => {
    mockData = { activeCases: CASES, savedSearches: [saved('sb', 'Kohorte B', ['Site B'])] };
    setParams({ cohort: 'sb' });
    render(<AnalysisPage />);
    fireEvent.click(screen.getByRole('button', { name: `1 ${label}` }));
    fireEvent.click(screen.getByRole('button', { name: 'Vollständige Fallansicht' }));
    expect(mockNavigate).toHaveBeenCalledWith('/case/B1');
  });
});
