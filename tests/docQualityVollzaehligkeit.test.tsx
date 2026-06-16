// @vitest-environment jsdom
/**
 * I5 (v1.14): DocQuality "Vollzähligkeit" reversal.
 *
 * Covers the label reverts (Vollzähligkeit / Vollständigkeit) and the
 * presence + distinctness of definition tooltips on all four metric cards.
 * Per the M14 round-6 decision the Vollzähligkeit % keeps the FULL registered
 * total as its denominator (the count restricts to the window, the denominator
 * does not), so the "present / total registered" tooltip wording below stays
 * accurate.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MetricCard } from '../src/components/doc-quality/MetricCard';
import { LanguageProvider } from '../src/context/LanguageContext';
import { t as translate } from '../src/i18n/translations';

describe('I5 — DocQuality labels reverted', () => {
  it('docQualityCompleteness label is "Vollzähligkeit" / "Completeness"', () => {
    expect(translate('docQualityCompleteness', 'de')).toBe('Vollzähligkeit');
    expect(translate('docQualityCompleteness', 'en')).toBe('Completeness');
  });

  it('docQualityDataCompleteness label is reverted to "Vollständigkeit" / "Data Completeness"', () => {
    expect(translate('docQualityDataCompleteness', 'de')).toBe('Vollständigkeit');
    expect(translate('docQualityDataCompleteness', 'en')).toBe('Data Completeness');
    // No longer the v1.13 "Messwert-Vollständigkeit".
    expect(translate('docQualityDataCompleteness', 'de')).not.toContain('Messwert');
  });

  it('landing Vollzähligkeit label reverted from the v1.13 consent-rate wording', () => {
    expect(translate('datenvollstaendigkeitCaption', 'de')).toBe('DATENVOLLZÄHLIGKEIT');
    expect(translate('datenvollstaendigkeitLabel', 'de')).toBe('Vollzähligkeit');
    expect(translate('datenvollstaendigkeitCaption', 'de')).not.toContain('EINWILLIGUNG');
  });
});

describe('I5 — all four DocQuality cards have distinct, non-empty tooltips', () => {
  const tooltipKeys = [
    'docQualityCompletenessTooltip',
    'docQualityDataCompletenessTooltip',
    'docQualityPlausibilityTooltip',
    'docQualityOverallTooltip',
  ] as const;

  it('every tooltip key resolves to a non-empty string (de + en)', () => {
    for (const key of tooltipKeys) {
      expect(translate(key, 'de').length).toBeGreaterThan(0);
      expect(translate(key, 'en').length).toBeGreaterThan(0);
    }
  });

  it('the four tooltips are distinct from one another', () => {
    const en = tooltipKeys.map((k) => translate(k, 'en'));
    expect(new Set(en).size).toBe(tooltipKeys.length);
  });

  it('the Vollzähligkeit tooltip describes the present/total (registered) definition', () => {
    const en = translate('docQualityCompletenessTooltip', 'en');
    expect(en.toLowerCase()).toContain('registered');
    const de = translate('docQualityCompletenessTooltip', 'de');
    expect(de.toLowerCase()).toContain('registriert');
  });

  it('the Gesamtbewertung tooltip documents the 40/30/30 weighting', () => {
    const de = translate('docQualityOverallTooltip', 'de');
    expect(de).toContain('40');
    expect(de).toContain('30');
  });
});

describe('I5 — MetricCard renders the tooltip on the Plausibilität & Gesamtbewertung cards', () => {
  it('renders an accessible info tooltip for Plausibilität', () => {
    render(
      <LanguageProvider>
        <MetricCard label="Plausibility" score={88} tooltip={translate('docQualityPlausibilityTooltip', 'en')} />
      </LanguageProvider>,
    );
    const tip = screen.queryByLabelText(translate('docQualityPlausibilityTooltip', 'en'));
    expect(tip).not.toBeNull();
  });

  it('renders an accessible info tooltip for Gesamtbewertung', () => {
    render(
      <LanguageProvider>
        <MetricCard label="Overall Score" score={82} tooltip={translate('docQualityOverallTooltip', 'en')} />
      </LanguageProvider>,
    );
    const tip = screen.queryByLabelText(translate('docQualityOverallTooltip', 'en'));
    expect(tip).not.toBeNull();
  });
});
