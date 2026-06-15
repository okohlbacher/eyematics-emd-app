// @vitest-environment jsdom
/**
 * C1 — RTL tests for the reworked QualityCaseDetail (inline per-row review).
 *
 * Verifies: single inline confirm path (no duplicate top/bottom control), inline
 * anomaly + synthetic missing rows, Behoben→resolved mapping (strike-through),
 * bulk-confirm scope (skips anomalous/missing/judged), status vocab + tooltips,
 * and reset. RTL: no jest-dom — queryByText().not.toBeNull() / .toBeNull().
 */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Observation, PatientCase, QualityFlag } from '../src/types/fhir';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k, locale: 'en' }),
}));

vi.mock('../src/config/clinicalThresholds', () => ({
  CRITICAL_CRT_THRESHOLD: () => 400,
  CRITICAL_VISUS_THRESHOLD: () => 0.1,
  VISUS_JUMP_THRESHOLD: () => 0.3,
}));

vi.mock('../src/services/terminology', () => ({
  getCachedDisplay: (_system: string, code: string) => code,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function visus(date: string, value: number): Observation {
  return {
    resourceType: 'Observation',
    id: `vis-${date}`,
    status: 'final',
    subject: { reference: 'Patient/p1' },
    // Real bundles render this display ("Visual acuity"), NOT the literal "Visus" —
    // exercises that anomaly highlighting keys off the observation id, not the label.
    code: { coding: [{ system: 'http://loinc.org', code: '79880-1', display: 'Visual acuity' }] },
    effectiveDateTime: `${date}T00:00:00Z`,
    valueQuantity: { value, unit: 'logMAR' },
  };
}

// Case with: one normal Visus (0.30), one anomalous Visus (0.05 < 0.1), no CRT, no injections.
const caseWithAnomaly: PatientCase = {
  id: 'case-001',
  pseudonym: 'TEST-PATIENT',
  gender: 'male',
  birthDate: '1960-01-01',
  centerId: 'CENTER-A',
  centerName: 'Center Alpha',
  conditions: [],
  observations: [visus('2024-01-12', 0.3), visus('2024-03-04', 0.05)],
  procedures: [],
  imagingStudies: [],
  medications: [],
};

// ---------------------------------------------------------------------------
// Import component AFTER mocks
// ---------------------------------------------------------------------------

import QualityCaseDetail, {
  CONFIRMED_ERROR_TYPE,
  CORRECTED_ERROR_TYPE,
} from '../src/components/quality/QualityCaseDetail';

afterEach(() => {
  cleanup();
});

const baseProps = {
  selectedCase: caseWithAnomaly,
  caseFlags: [] as QualityFlag[],
  therapyStatus: undefined,
  isExcluded: false,
  isReviewed: false,
  dateFmt: 'de-DE',
  onMarkReviewed: vi.fn(),
  onExclude: vi.fn(),
  onNavigateToCase: vi.fn(),
  onOpenFlagDialog: vi.fn(),
  onConfirmRow: vi.fn(),
  onCorrectRow: vi.fn(),
  onResetRow: vi.fn(),
};

describe('QualityCaseDetail — C1 inline review rework', () => {
  it('removes the duplicate top approve control and the second editor select', () => {
    render(<QualityCaseDetail {...baseProps} caseFlags={[{
      caseId: 'case-001', parameter: 'Visual acuity (2024-03-04)', errorType: 'visusCritical',
      flaggedAt: '2024-03-10T10:00:00Z', flaggedBy: 'r1', status: 'open',
    }]} />);
    // The old duplicate control had this testid; it must be gone.
    expect(document.querySelector('[data-testid="top-flag-status-controls"]')).toBeNull();
    // No status <select> editors remain anywhere (verdicts are inline buttons now).
    expect(screen.queryAllByRole('combobox').length).toBe(0);
  });

  it('clicking Bestätigen on a row fires onConfirmRow with the parameter key', () => {
    const onConfirmRow = vi.fn();
    render(<QualityCaseDetail {...baseProps} onConfirmRow={onConfirmRow} />);
    // The normal Visus row exposes a "Bestätigen ‹param› ‹date›" labelled button.
    const btn = screen.getByLabelText('confirmValue Visual acuity 2024-01-12');
    // I6b: the Bestätigen action now has a hover title (reusing confirmValue),
    // matching the Behoben / Fehler-melden buttons.
    expect(btn.getAttribute('title')).toBe('confirmValue');
    fireEvent.click(btn);
    expect(onConfirmRow).toHaveBeenCalledWith('case-001', 'Visual acuity (2024-01-12)', expect.any(String));
  });

  it('clicking Behoben fires onCorrectRow', () => {
    const onCorrectRow = vi.fn();
    render(<QualityCaseDetail {...baseProps} onCorrectRow={onCorrectRow} />);
    const btn = screen.getByLabelText('correctedUpstream Visual acuity 2024-01-12');
    fireEvent.click(btn);
    expect(onCorrectRow).toHaveBeenCalledWith('case-001', 'Visual acuity (2024-01-12)', expect.any(String));
  });

  it('renders the anomalous Visus row inline with an auffällig status pill', () => {
    render(<QualityCaseDetail {...baseProps} />);
    // Status pill for the anomalous row carries the verdict word via aria-label
    // (also present once in the legend, hence getAll).
    expect(screen.getAllByLabelText('status: statusAnomalous').length).toBeGreaterThan(0);
  });

  it('renders a synthetic missing row for parameters with no observation', () => {
    render(<QualityCaseDetail {...baseProps} />);
    // No CRT observation → synthetic missing row labelled CRT with a "fehlt" pill.
    expect(screen.getAllByLabelText('status: statusMissing').length).toBeGreaterThan(0);
    // missingCrt reason text appears inline.
    expect(screen.queryByText(/missingCrt/)).not.toBeNull();
  });

  it('a resolved flag renders the value struck through and the corrected-upstream note', () => {
    render(<QualityCaseDetail {...baseProps} caseFlags={[{
      caseId: 'case-001', parameter: 'Visual acuity (2024-01-12)', errorType: CORRECTED_ERROR_TYPE,
      flaggedAt: '2024-03-10T10:00:00Z', flaggedBy: 'r1', status: 'resolved',
    }]} />);
    // statusResolved appears in the row and the legend → getAll.
    expect(screen.getAllByLabelText('status: statusResolved').length).toBeGreaterThan(1);
    expect(screen.queryByText('correctedUpstreamNote')).not.toBeNull();
    const struck = document.querySelector('.line-through');
    expect(struck).not.toBeNull();
  });

  it('an acknowledged flag renders the bestätigt verdict', () => {
    render(<QualityCaseDetail {...baseProps} caseFlags={[{
      caseId: 'case-001', parameter: 'Visual acuity (2024-01-12)', errorType: CONFIRMED_ERROR_TYPE,
      flaggedAt: '2024-03-10T10:00:00Z', flaggedBy: 'r1', status: 'acknowledged',
    }]} />);
    // statusConfirmed appears in the row and the legend → getAll.
    expect(screen.getAllByLabelText('status: statusConfirmed').length).toBeGreaterThan(1);
  });

  it('bulk-confirm only confirms un-judged, non-anomalous rows', () => {
    const onConfirmRow = vi.fn();
    // Normal Visual acuity (2024-01-12) is the only confirmable row; the anomalous one and
    // the synthetic missing CRT/IVOM rows must be skipped.
    render(<QualityCaseDetail {...baseProps} onConfirmRow={onConfirmRow} />);
    fireEvent.click(screen.getByText('confirmAllVisible'));
    expect(onConfirmRow).toHaveBeenCalledTimes(1);
    expect(onConfirmRow).toHaveBeenCalledWith('case-001', 'Visual acuity (2024-01-12)', expect.any(String));
  });

  it('a judged row shows a single reset action instead of confirm/correct', () => {
    const onResetRow = vi.fn();
    render(<QualityCaseDetail {...baseProps} onResetRow={onResetRow} caseFlags={[{
      caseId: 'case-001', parameter: 'Visual acuity (2024-01-12)', errorType: CONFIRMED_ERROR_TYPE,
      flaggedAt: '2024-03-10T10:00:00Z', flaggedBy: 'r1', status: 'acknowledged',
    }]} />);
    const reset = screen.getByLabelText('resetStatus Visual acuity 2024-01-12');
    fireEvent.click(reset);
    expect(onResetRow).toHaveBeenCalledWith('case-001', 'Visual acuity (2024-01-12)');
  });

  it('exposes the four status definitions as tooltips (legend)', () => {
    render(<QualityCaseDetail {...baseProps} />);
    expect(screen.queryByLabelText('tipStatusOpen')).not.toBeNull();
    expect(screen.queryByLabelText('tipStatusConfirmed')).not.toBeNull();
    expect(screen.queryByLabelText('tipStatusAnomalous')).not.toBeNull();
    expect(screen.queryByLabelText('tipStatusResolved')).not.toBeNull();
  });

  it('the filter chips show anomaly count and filter the table', () => {
    render(<QualityCaseDetail {...baseProps} />);
    // "Nur auffällige" chip exists; clicking it hides the normal confirmable row.
    const chip = screen.getByText('filterOnlyAnomalies');
    fireEvent.click(chip);
    expect(screen.queryByLabelText('confirmValue Visual acuity 2024-01-12')).toBeNull();
    // Anomalous + missing rows remain (row pill + legend pill).
    expect(screen.getAllByLabelText('status: statusAnomalous').length).toBeGreaterThan(0);
  });

  it('mark-as-reviewed lives in the collapsed Card B and fires onMarkReviewed', () => {
    const onMarkReviewed = vi.fn();
    render(<QualityCaseDetail {...baseProps} onMarkReviewed={onMarkReviewed} />);
    const btn = screen.getByText('markAsReviewed');
    fireEvent.click(btn);
    expect(onMarkReviewed).toHaveBeenCalledWith('case-001');
  });

  it('the audit log is read-only (no select editor) and lists flags', () => {
    render(<QualityCaseDetail {...baseProps} caseFlags={[{
      caseId: 'case-001', parameter: 'Visual acuity (2024-01-12)', errorType: CONFIRMED_ERROR_TYPE,
      flaggedAt: '2024-03-10T10:00:00Z', flaggedBy: 'admin', status: 'acknowledged',
    }]} />);
    expect(screen.queryAllByRole('combobox').length).toBe(0);
    const log = screen.getByText('caseStatusAndLog').closest('details') as HTMLElement;
    expect(within(log).queryByText(/logConfirmed/)).not.toBeNull();
  });
});
