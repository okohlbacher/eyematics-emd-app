// @vitest-environment jsdom
/**
 * CHART-01 / ANL-002 — ResponderView plot-adjacent info affordance test.
 *
 * Asserts that the single-cohort ResponderView renders an info affordance
 * (element carrying title or aria-label matching t('metricsResponderTooltip'))
 * ADJACENT TO THE RESPONDER PLOT (inside data-testid="responder-view"),
 * NOT only on the OutcomesView tab strip.
 *
 * Pattern: recharts mock + no jest-dom RTL assertions.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('recharts', async (importOriginal) => {
  const real = await importOriginal<typeof import('recharts')>();
  return {
    ...real,

    ResponsiveContainer: ({ children }: { children: any }) => (
      <div data-testid="recharts-responsive-container">
        <svg>{children}</svg>
      </div>
    ),
    BarChart: ({ children }: { children: any }) => (
      <g data-testid="recharts-bar-chart">{children}</g>
    ),
    ComposedChart: ({ children }: { children: any }) => (
      <g data-testid="recharts-composed-chart">{children}</g>
    ),
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
    Bar: () => null,
    Line: () => null,
  };
});

import { cleanup, render, screen } from '@testing-library/react';

import ResponderView from '../src/components/outcomes/ResponderView';
import type { TranslationKey } from '../src/i18n/translations';
import type { PatientCase } from '../src/types/fhir';

afterEach(() => cleanup());

const enStrings: Partial<Record<TranslationKey, string>> = {
  metricsResponderTooltip: 'Responder: Visus improvement ≥ 5 ETDRS letters or CRT reduction ≥ 10 % from baseline',
  metricsResponderTitle: 'Responder Classification',
  metricsResponderBucketResponder: 'Responder',
  metricsResponderBucketPartial: 'Partial',
  metricsResponderBucketNonResponder: 'Non-responder',
  metricsIntervalEyeOd: 'OD',
  metricsIntervalEyeOs: 'OS',
  metricsIntervalEyeCombined: 'Combined',
  metricsResponderBarXAxis: 'Eye',
  metricsResponderBarYAxis: 'Count',
  metricsResponderTrajectoryTitle: 'Trajectory by Responder Group',
  metricsPreviewColDeltaVisusLetters: 'Visus Δ (letters)',
  metricsResponderNoDataTitle: 'No Data',
  metricsResponderNoDataBody: 'No data available',
};

const tEN = (key: TranslationKey): string => enStrings[key] ?? key;

function makeCase(pseudonym: string): PatientCase {
  const baseline = new Date('2024-01-01');
  return {
    pseudonym,
    observations: [
      {
        resourceType: 'Observation',
        code: { coding: [{ system: 'http://loinc.org', code: '79880-1' }] },
        bodySite: { coding: [{ code: '24028007' }] }, // OD
        effectiveDateTime: baseline.toISOString().slice(0, 10),
        valueQuantity: { value: 0.5, unit: '1' },
      } as any,
      {
        resourceType: 'Observation',
        code: { coding: [{ system: 'http://loinc.org', code: '79880-1' }] },
        bodySite: { coding: [{ code: '24028007' }] }, // OD
        effectiveDateTime: new Date(baseline.getTime() + 365 * 86400000).toISOString().slice(0, 10),
        valueQuantity: { value: 0.79, unit: '1' }, // +10 letters → responder
      } as any,
    ],
    procedures: [],
  } as unknown as PatientCase;
}

describe('ResponderView — CHART-01/ANL-002 plot-adjacent info affordance', () => {
  it('renders an info affordance with metricsResponderTooltip adjacent to the plot (inside responder-view)', () => {
    const cases = [makeCase('P1'), makeCase('P2')];
    render(<ResponderView cases={cases} thresholdLetters={5} t={tEN} locale="en" />);

    const container = screen.getByTestId('responder-view');

    // The affordance must be inside the responder-view container (adjacent to plot).
    // It carries the tooltip text as title or aria-label.
    const tooltipText = enStrings.metricsResponderTooltip!;
    const byTitle = container.querySelector(`[title="${tooltipText}"]`);
    const byAriaLabel = container.querySelector(`[aria-label="${tooltipText}"]`);

    const affordance = byTitle ?? byAriaLabel;
    expect(affordance).not.toBeNull();
  });

  it('info affordance contains ℹ character', () => {
    const cases = [makeCase('P1')];
    render(<ResponderView cases={cases} thresholdLetters={5} t={tEN} locale="en" />);

    const container = screen.getByTestId('responder-view');
    const tooltipText = enStrings.metricsResponderTooltip!;
    const byTitle = container.querySelector(`[title="${tooltipText}"]`);
    const byAriaLabel = container.querySelector(`[aria-label="${tooltipText}"]`);
    const affordance = byTitle ?? byAriaLabel;

    expect(affordance).not.toBeNull();
    // Content should be the info character (or contain it).
    expect(affordance!.textContent).toContain('ℹ');
  });
});
