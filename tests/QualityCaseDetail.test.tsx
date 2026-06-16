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

  it('J6b: the "Behoben" (corrected-upstream) action is GONE — only Bestätigen + Fehler melden remain', () => {
    render(<QualityCaseDetail {...baseProps} />);
    // No Behoben/corrected-upstream action button anywhere (its aria-label used
    // t('correctedUpstream'), which has been removed from the row actions).
    expect(screen.queryByLabelText('correctedUpstream Visual acuity 2024-01-12')).toBeNull();
    // The two remaining actions are still present on the normal row.
    expect(screen.queryByLabelText('confirmValue Visual acuity 2024-01-12')).not.toBeNull();
    expect(screen.queryByLabelText('reportError Visual acuity 2024-01-12')).not.toBeNull();
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
    // J6b: the resolved legend entry was removed, so the pill now appears ONLY
    // on the (pre-existing) resolved row, not in the legend → exactly one.
    expect(screen.getAllByLabelText('status: statusResolved').length).toBe(1);
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

  it('exposes the three settable status definitions as tooltips (J6b: no resolved entry)', () => {
    render(<QualityCaseDetail {...baseProps} />);
    expect(screen.queryByLabelText('tipStatusOpen')).not.toBeNull();
    expect(screen.queryByLabelText('tipStatusConfirmed')).not.toBeNull();
    expect(screen.queryByLabelText('tipStatusAnomalous')).not.toBeNull();
    // J6b: "Behoben"/resolved is no longer a status a reviewer can set, so its
    // legend tooltip is gone.
    expect(screen.queryByLabelText('tipStatusResolved')).toBeNull();
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

  it('J6a + L9: the status pills live in a fixed-width column (table-fixed + colgroup) so actions do not reflow', () => {
    render(<QualityCaseDetail {...baseProps} />);
    // table-fixed + an explicit colgroup pin the Status, Annotation + Aktion column
    // widths, so a changing status pill cannot re-size a column or shift the buttons.
    const table = document.querySelector('table.table-fixed');
    expect(table).not.toBeNull();
    const cols = table!.querySelectorAll('colgroup col');
    // Six columns: Parameter (flex) + Datum + Wert + Status + Annotation + Aktion.
    expect(cols.length).toBe(6);
    // The Status column (4th) carries a fixed width class.
    expect(cols[3].getAttribute('class')).toMatch(/\bw-/);
    // The Annotation column (5th) is pinned.
    expect(cols[4].getAttribute('class')).toMatch(/\bw-/);
    // The Aktion column (6th) is also pinned.
    expect(cols[5].getAttribute('class')).toMatch(/\bw-/);
  });

  it('L9: the Status header is restored AND a distinct Annotation column header is present', () => {
    render(<QualityCaseDetail {...baseProps} />);
    // L9 fix: the status-pill column gets its OWN "Status" header back (it was
    // wrongly relabelled "Annotation" in v1.16) and a SEPARATE Annotation column is
    // added on the right. The mocked t() echoes the key, so assert on the keys.
    const headers = Array.from(document.querySelectorAll('thead th')).map(
      (th) => th.textContent,
    );
    expect(headers).toEqual([
      'parameter',
      'date',
      'value',
      'status',
      'annotation',
      'action',
    ]);
    // Both a Status header and a distinct Annotation header exist.
    expect(headers.filter((h) => h === 'status').length).toBe(1);
    expect(headers.filter((h) => h === 'annotation').length).toBe(1);
    // The Status column (4th) stays snug at w-28.
    const table = document.querySelector('table.table-fixed');
    const cols = table!.querySelectorAll('colgroup col');
    expect(cols[3].getAttribute('class')).toContain('w-28');
  });

  it('L9: an annotated (anomalous) row shows its flag text in the Annotation column', () => {
    render(<QualityCaseDetail {...baseProps} />);
    // The anomalous Visus row (0.05 < 0.1) carries a system reason in its
    // Annotation cell. Locate the row by its status pill, then read the 5th cell.
    const anomalyPill = screen.getAllByLabelText('status: statusAnomalous')[0];
    const row = anomalyPill.closest('tr') as HTMLElement;
    const cells = row.querySelectorAll('td');
    // td order: Parameter, Date, Value, Status, Annotation, Action.
    const annotationCell = cells[4] as HTMLElement;
    // visusAnomaly is the derived reason for a critically-low Visus.
    expect(within(annotationCell).queryByText(/visusAnomaly/)).not.toBeNull();
    // A non-annotated (clean) row shows the em-dash placeholder instead.
    const confirmBtn = screen.getByLabelText('confirmValue Visual acuity 2024-01-12');
    const cleanRow = confirmBtn.closest('tr') as HTMLElement;
    const cleanAnnotation = cleanRow.querySelectorAll('td')[4] as HTMLElement;
    expect(cleanAnnotation.textContent).toBe('annotationNone');
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

// ---------------------------------------------------------------------------
// I6a (v1.14-p2): the reviewer's note (errorType) must remain visible after a
// confirm (status acknowledged) and on resolved rows; the confirmed/corrected
// sentinels must never display as a fake user note.
// ---------------------------------------------------------------------------

describe('QualityCaseDetail — I6a annotation persistence + sentinel suppression', () => {
  const NOTE = 'visusImplausiblyLow';

  it('shows the reviewer note while the flag is still open', () => {
    render(<QualityCaseDetail {...baseProps} caseFlags={[{
      caseId: 'case-001', parameter: 'Visual acuity (2024-01-12)', errorType: NOTE,
      flaggedAt: '2024-03-10T10:00:00Z', flaggedBy: 'r1', status: 'open',
    }]} />);
    expect(screen.queryByText(NOTE)).not.toBeNull();
  });

  it('still shows the reviewer note after Bestätigen (status acknowledged)', () => {
    render(<QualityCaseDetail {...baseProps} caseFlags={[{
      caseId: 'case-001', parameter: 'Visual acuity (2024-01-12)', errorType: NOTE,
      flaggedAt: '2024-03-10T10:00:00Z', flaggedBy: 'r1', status: 'acknowledged',
    }]} />);
    // The note must NOT disappear once the row is confirmed.
    expect(screen.queryByText(NOTE)).not.toBeNull();
  });

  it('still shows the reviewer note on a resolved row', () => {
    render(<QualityCaseDetail {...baseProps} caseFlags={[{
      caseId: 'case-001', parameter: 'Visual acuity (2024-01-12)', errorType: NOTE,
      flaggedAt: '2024-03-10T10:00:00Z', flaggedBy: 'r1', status: 'resolved',
    }]} />);
    expect(screen.queryByText(NOTE)).not.toBeNull();
  });

  it('confirming a clean row shows NO sentinel text (confirmed)', () => {
    render(<QualityCaseDetail {...baseProps} caseFlags={[{
      caseId: 'case-001', parameter: 'Visual acuity (2024-01-12)', errorType: CONFIRMED_ERROR_TYPE,
      flaggedAt: '2024-03-10T10:00:00Z', flaggedBy: 'r1', status: 'acknowledged',
    }]} />);
    // The sentinel 'confirmed' must never render as a user note (row or log).
    expect(screen.queryByText(CONFIRMED_ERROR_TYPE)).toBeNull();
  });

  it('a resolved clean row shows NO sentinel text (corrected)', () => {
    render(<QualityCaseDetail {...baseProps} caseFlags={[{
      caseId: 'case-001', parameter: 'Visual acuity (2024-01-12)', errorType: CORRECTED_ERROR_TYPE,
      flaggedAt: '2024-03-10T10:00:00Z', flaggedBy: 'r1', status: 'resolved',
    }]} />);
    expect(screen.queryByText(CORRECTED_ERROR_TYPE)).toBeNull();
  });

  it('the read-only audit log includes the real note (sentinels suppressed)', () => {
    render(<QualityCaseDetail {...baseProps} caseFlags={[{
      caseId: 'case-001', parameter: 'Visual acuity (2024-01-12)', errorType: NOTE,
      flaggedAt: '2024-03-10T10:00:00Z', flaggedBy: 'r1', status: 'acknowledged',
    }]} />);
    const log = screen.getByText('caseStatusAndLog').closest('details') as HTMLElement;
    // The note text is appended to the log entry ("… · visusImplausiblyLow").
    expect(within(log).queryByText(new RegExp(NOTE))).not.toBeNull();
  });
});
