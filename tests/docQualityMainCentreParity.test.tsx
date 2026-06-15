// @vitest-environment jsdom
/**
 * v1.15 Phase 2 — DocQuality main/centre parity (J5a + J5b).
 *
 * J5a: the global plausibility ranges render as a collapsible table in the main
 *      view (collapsed by default) and an always-open table in the centre panel,
 *      both reading the SAME global settings source (getSettings().plausibility).
 * J5b: the per-centre metric cards now show the absolute patient count AND the
 *      same definition tooltips as the main-view cards (reusing the keys).
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PLAUSIBILITY_DEFAULTS } from '../shared/thresholdConfig';
import { CenterDetailPanel } from '../src/components/doc-quality/CenterDetailPanel';
import { PlausibilityRangesTable } from '../src/components/doc-quality/PlausibilityRangesTable';
import { LanguageProvider } from '../src/context/LanguageContext';
import { t as translate } from '../src/i18n/translations';
import type { CenterMetrics } from '../src/utils/qualityMetrics';

const metrics: CenterMetrics = {
  centerId: 'CENTER-001',
  centerLabel: 'Site A',
  patientCount: 245,
  observationCount: 1320,
  completeness: 91,
  dataCompleteness: 88,
  plausibility: 95,
  overall: 91,
};

function renderWithLang(node: React.ReactNode) {
  return render(<LanguageProvider>{node}</LanguageProvider>);
}

describe('J5a — PlausibilityRangesTable reads the global settings source', () => {
  it('renders the configured global ranges (not hardcoded values)', () => {
    renderWithLang(<PlausibilityRangesTable />);
    // Values come from PLAUSIBILITY_DEFAULTS (the shared single source).
    const visusRange = `${PLAUSIBILITY_DEFAULTS.visusMin} – ${PLAUSIBILITY_DEFAULTS.visusMax}`;
    const crtRange = `${PLAUSIBILITY_DEFAULTS.crtMin} – ${PLAUSIBILITY_DEFAULTS.crtMax} µm`;
    const iopRange = `${PLAUSIBILITY_DEFAULTS.iopMin} – ${PLAUSIBILITY_DEFAULTS.iopMax} mmHg`;
    expect(screen.queryByText(visusRange)).not.toBeNull();
    expect(screen.queryByText(crtRange)).not.toBeNull();
    expect(screen.queryByText(iopRange)).not.toBeNull();
  });

  it('labels the table with the Plausibilitätsbereiche heading', () => {
    renderWithLang(<PlausibilityRangesTable />);
    expect(screen.queryAllByText(translate('docQualityPlausibilityRanges', 'de')).length).toBeGreaterThanOrEqual(1);
  });

  it('collapsible variant renders a <details> that is collapsed by default', () => {
    const { container } = renderWithLang(<PlausibilityRangesTable collapsible />);
    const details = container.querySelector('details');
    expect(details).not.toBeNull();
    // Collapsed by default → the `open` attribute is absent.
    expect(details?.hasAttribute('open')).toBe(false);
  });
});

describe('J5b — centre metric cards reach main-view parity (counts + tooltips)', () => {
  it('shows the absolute patient count on the centre cards', () => {
    renderWithLang(<CenterDetailPanel metrics={metrics} onBack={() => {}} />);
    // Four cards each render "245 Patienten/Patients" + the summary chip.
    const countLabel = `${metrics.patientCount} ${translate('docQualityPatients', 'de')}`;
    expect(screen.getAllByText(countLabel).length).toBeGreaterThanOrEqual(4);
  });

  it('renders the same four definition tooltips the main view uses', () => {
    renderWithLang(<CenterDetailPanel metrics={metrics} onBack={() => {}} />);
    for (const key of [
      'docQualityCompletenessTooltip',
      'docQualityDataCompletenessTooltip',
      'docQualityPlausibilityTooltip',
      'docQualityOverallTooltip',
    ] as const) {
      expect(screen.queryAllByLabelText(translate(key, 'de')).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('still renders the plausibility ranges table inside the centre panel', () => {
    renderWithLang(<CenterDetailPanel metrics={metrics} onBack={() => {}} />);
    expect(screen.queryAllByText(translate('docQualityPlausibilityRanges', 'de')).length).toBeGreaterThanOrEqual(1);
  });
});
