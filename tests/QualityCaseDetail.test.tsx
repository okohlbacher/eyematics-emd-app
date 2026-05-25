// @vitest-environment jsdom
/**
 * QUAL-025: RTL tests for QualityCaseDetail — flag-status controls reachable near top.
 *
 * RTL: no jest-dom — queryByText().not.toBeNull() / .toBeNull() per CLAUDE.md.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PatientCase, QualityFlag } from '../src/types/fhir';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k, locale: 'en' }),
}));

vi.mock('../src/services/settingsService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/settingsService')>();
  return {
    ...actual,
    getSettings: () => ({
      therapyInterrupterDays: 120,
      therapyBreakerDays: 365,
      crtImplausibleThresholdUm: 400,
      twoFactorEnabled: false,
      dataSource: { type: 'local', blazeUrl: 'http://localhost:8080/fhir' },
      outcomes: { serverAggregationThresholdPatients: 1000, aggregateCacheTtlMs: 1800000 },
      thresholds: {
        criticalCrtUm: 400,
        criticalVisus: 0.1,
        visusJump: 0.3,
      },
    }),
  };
});

vi.mock('../src/services/terminology', () => ({
  getCachedDisplay: (_system: string, code: string) => code,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const minimalCase: PatientCase = {
  id: 'case-001',
  pseudonym: 'TEST-PATIENT',
  gender: 'male',
  birthDate: '1960-01-01',
  centerId: 'CENTER-A',
  centerName: 'Center Alpha',
  conditions: [],
  observations: [],
  procedures: [],
  imagingStudies: [],
  medications: [],
};

const openFlag: QualityFlag = {
  caseId: 'case-001',
  parameter: 'Visus (2024-01-01)',
  errorType: 'visusCritical',
  flaggedAt: '2024-01-15T10:00:00Z',
  flaggedBy: 'reviewer-1',
  status: 'open',
};

// ---------------------------------------------------------------------------
// Import component AFTER mocks
// ---------------------------------------------------------------------------

import QualityCaseDetail from '../src/components/quality/QualityCaseDetail';

afterEach(() => {
  cleanup();
});

describe('QualityCaseDetail — QUAL-025 flag-status control placement', () => {
  const baseProps = {
    selectedCase: minimalCase,
    caseFlags: [openFlag],
    therapyStatus: undefined,
    isExcluded: false,
    isReviewed: false,
    dateFmt: 'de-DE',
    onMarkReviewed: vi.fn(),
    onExclude: vi.fn(),
    onNavigateToCase: vi.fn(),
    onOpenFlagDialog: vi.fn(),
    onUpdateFlagStatus: vi.fn(),
  };

  it('renders a status select when the case has flags', () => {
    render(<QualityCaseDetail {...baseProps} />);
    const selects = screen.queryAllByRole('combobox');
    expect(selects.length).toBeGreaterThan(0);
  });

  it('top status select shows the flag current status value', () => {
    render(<QualityCaseDetail {...baseProps} />);
    const topControls = document.querySelector('[data-testid="top-flag-status-controls"]');
    expect(topControls).not.toBeNull();
    const topSelect = topControls!.querySelector('select') as HTMLSelectElement;
    expect(topSelect.value).toBe('open');
  });

  it('changing the top status select fires onUpdateFlagStatus with correct args', () => {
    const onUpdateFlagStatus = vi.fn();
    render(<QualityCaseDetail {...baseProps} onUpdateFlagStatus={onUpdateFlagStatus} />);

    const topControls = document.querySelector('[data-testid="top-flag-status-controls"]');
    expect(topControls).not.toBeNull();
    const topSelect = topControls!.querySelector('select') as HTMLSelectElement;

    fireEvent.change(topSelect, { target: { value: 'resolved' } });

    expect(onUpdateFlagStatus).toHaveBeenCalledTimes(1);
    expect(onUpdateFlagStatus).toHaveBeenCalledWith('case-001', '2024-01-15T10:00:00Z', 'resolved');
  });

  it('clicking mark-reviewed fires onMarkReviewed', () => {
    const onMarkReviewed = vi.fn();
    render(<QualityCaseDetail {...baseProps} onMarkReviewed={onMarkReviewed} />);

    // markAsReviewed key is translated to 'markAsReviewed' by the mock t() which is identity
    const btn = screen.queryByText('markAsReviewed');
    expect(btn).not.toBeNull();
    fireEvent.click(btn!);
    expect(onMarkReviewed).toHaveBeenCalledWith('case-001');
  });

  it('top status control appears in DOM before the values table heading', () => {
    render(<QualityCaseDetail {...baseProps} />);

    const topControls = document.querySelector('[data-testid="top-flag-status-controls"]');
    expect(topControls).not.toBeNull();

    // 'valuesToReview' is the translation key for the values tab (identity mock)
    const valuesTabBtn = screen.queryByText('valuesToReview');
    expect(valuesTabBtn).not.toBeNull();

    // compareDocumentPosition: DOCUMENT_POSITION_FOLLOWING = 4
    // If topControls comes before the values tab button in DOM, position flag will include 4.
    const position = topControls!.compareDocumentPosition(valuesTabBtn!);
    // DOCUMENT_POSITION_FOLLOWING (4) means valuesTabBtn follows topControls → topControls is first
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('no status controls rendered when case has no flags', () => {
    render(<QualityCaseDetail {...baseProps} caseFlags={[]} />);
    const topControls = document.querySelector('[data-testid="top-flag-status-controls"]');
    expect(topControls).toBeNull();
  });
});
