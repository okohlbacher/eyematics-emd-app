// @vitest-environment jsdom
/**
 * FALL-010: OutcomesPanel drill-down + IDOR resolution/navigation tests.
 *
 * WS-1 (v1.17): the chart is Plotly; in jsdom the testable fallback renders scatter
 * points as nodes (outcomes-scatter-point-${patientId}) that drive the SAME
 * onPointClick → drill-down path Plotly's plotly_click does in the browser. The
 * IDOR gate (only navigate for a pseudonym known to the panel) is preserved.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import OutcomesPanel from '../src/components/outcomes/OutcomesPanel';
import type { PanelResult } from '../src/utils/cohortTrajectory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPanelWithScatter(): PanelResult {
  return {
    patients: [],
    scatterPoints: [
      { x: 10, y: 0.5, patientId: 'PSN-1' },
      { x: 20, y: 0.6, patientId: 'PSN-2' },
    ],
    medianGrid: [{ x: 0, y: 0.3, p25: 0.2, p75: 0.4, n: 2 }],
    summary: { patientCount: 2, measurementCount: 6, excludedCount: 0 },
  };
}

const t = (key: string) => key;

const defaultProps = {
  eye: 'od' as const,
  color: '#3b82f6',
  axisMode: 'days' as const,
  yMetric: 'absolute' as const,
  layers: { median: false, perPatient: false, scatter: true, spreadBand: false },
  t,
  locale: 'en' as const,
  titleKey: 'outcomesPanelOd' as const,
  metric: 'visus' as const,
};

// ---------------------------------------------------------------------------
// OutcomesPanel — onPointClick + scatter drill-down
// ---------------------------------------------------------------------------

describe('OutcomesPanel — onPointClick (FALL-010)', () => {
  afterEach(() => cleanup());

  it('calls onPointClick with patientId when a scatter point is clicked', () => {
    const onPointClick = vi.fn();
    const { container } = render(
      <OutcomesPanel {...defaultProps} panel={buildPanelWithScatter()} onPointClick={onPointClick} />,
    );
    const point = container.querySelector('[data-testid="outcomes-scatter-point-PSN-1"]');
    expect(point).not.toBeNull();
    fireEvent.click(point!);
    expect(onPointClick).toHaveBeenCalledWith('PSN-1');
  });

  it('scatter marks data-has-onclick=true when onPointClick is provided', () => {
    const onPointClick = vi.fn();
    const { container } = render(
      <OutcomesPanel {...defaultProps} panel={buildPanelWithScatter()} onPointClick={onPointClick} />,
    );
    const scatter = container.querySelector('[data-testid="outcomes-scatter-od"]');
    expect(scatter).not.toBeNull();
    expect(scatter!.getAttribute('data-has-onclick')).toBe('true');
  });

  it('does NOT mark scatter clickable when onPointClick is absent', () => {
    const { container } = render(
      <OutcomesPanel {...defaultProps} panel={buildPanelWithScatter()} />,
    );
    const scatter = container.querySelector('[data-testid="outcomes-scatter-od"]');
    expect(scatter).not.toBeNull();
    expect(scatter!.getAttribute('data-has-onclick')).toBe('false');
  });

  it('clicking a scatter point with no onPointClick is a no-op (no crash)', () => {
    const { container } = render(
      <OutcomesPanel {...defaultProps} panel={buildPanelWithScatter()} />,
    );
    const point = container.querySelector('[data-testid="outcomes-scatter-point-PSN-1"]');
    expect(() => fireEvent.click(point!)).not.toThrow();
  });

  it('aria-label includes drill-down hint key when onPointClick is provided', () => {
    const onPointClick = vi.fn();
    render(
      <OutcomesPanel {...defaultProps} panel={buildPanelWithScatter()} onPointClick={onPointClick} />,
    );
    const label = screen.getByRole('img').getAttribute('aria-label') ?? '';
    expect(label).toContain('outcomesDrillDownHint');
  });
});

// ---------------------------------------------------------------------------
// IDOR gate: only a pseudonym known to the panel navigates
// ---------------------------------------------------------------------------

describe('OutcomesPanel — IDOR gate (FALL-010)', () => {
  afterEach(() => cleanup());

  it('navigates only for a scatter pseudonym that is in the panel set', () => {
    const onPointClick = vi.fn();
    const { container } = render(
      <OutcomesPanel {...defaultProps} panel={buildPanelWithScatter()} onPointClick={onPointClick} />,
    );
    fireEvent.click(container.querySelector('[data-testid="outcomes-scatter-point-PSN-2"]')!);
    expect(onPointClick).toHaveBeenCalledWith('PSN-2');
    expect(onPointClick).not.toHaveBeenCalledWith('PSN-1');
  });
});

// ---------------------------------------------------------------------------
// OutcomesView drill-down handler (pseudonym→case-id resolution, IDOR)
// ---------------------------------------------------------------------------

import type { PatientCase } from '../shared/types/fhir';

function makeDrillDownHandler(cases: PatientCase[], navigate: (path: string) => void) {
  return (patientId: string) => {
    const found = cases.find((c) => c.pseudonym === patientId);
    if (found) navigate(`/case/${found.id}`);
  };
}

describe('OutcomesView — drill-down handler (FALL-010 IDOR gate)', () => {
  const mockNavigate = vi.fn();
  afterEach(() => {
    mockNavigate.mockReset();
    cleanup();
  });

  const cases: PatientCase[] = [
    { id: 'CASE-7', pseudonym: 'PSN-7' } as PatientCase,
    { id: 'CASE-99', pseudonym: 'PSN-99' } as PatientCase,
  ];

  it('navigates to /case/CASE-7 when patientId PSN-7 is in cohort', () => {
    makeDrillDownHandler(cases, mockNavigate)('PSN-7');
    expect(mockNavigate).toHaveBeenCalledWith('/case/CASE-7');
  });

  it('navigates to /case/CASE-99 when patientId PSN-99 is in cohort', () => {
    makeDrillDownHandler(cases, mockNavigate)('PSN-99');
    expect(mockNavigate).toHaveBeenCalledWith('/case/CASE-99');
  });

  it('does NOT navigate when patientId is unknown (IDOR gate)', () => {
    makeDrillDownHandler(cases, mockNavigate)('PSN-UNKNOWN');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does NOT navigate when cases array is empty', () => {
    makeDrillDownHandler([], mockNavigate)('PSN-7');
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
