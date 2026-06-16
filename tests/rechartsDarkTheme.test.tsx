// @vitest-environment jsdom
/**
 * M12 (v1.18 WS-A) — the non-Plotly outcomes charts (ResponderView, IntervalHistogram)
 * + AnalysisPage are now theme-aware. We can't introspect Recharts SVG axis colours
 * reliably in jsdom, so we (a) unit-test the shared rechartsTheme token map and
 * (b) smoke-render the charts inside a dark ThemeProvider to prove they restyle without
 * throwing (the dark tokens flow through useThemeSafe).
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import IntervalHistogram from '../src/components/outcomes/IntervalHistogram';
import { rechartsTheme } from '../src/components/outcomes/palette';
import ResponderView from '../src/components/outcomes/ResponderView';
import { ThemeProvider } from '../src/context/ThemeContext';

const t = (k: string) => k;

describe('rechartsTheme', () => {
  it('returns distinct dark vs light tokens', () => {
    const dark = rechartsTheme(true);
    const light = rechartsTheme(false);
    expect(dark.grid).not.toBe(light.grid);
    expect(dark.axisTick).not.toBe(light.axisTick);
    expect(dark.tooltipBg).toBe('#1f2937');
    expect(light.tooltipBg).toBe('#ffffff');
    expect(dark.legend).toBe('#d1d5db');
  });
});

describe('dark-mode chart smoke renders', () => {
  it('IntervalHistogram renders inside a dark ThemeProvider', () => {
    localStorage.setItem('emd-theme', 'dark');
    const { container } = render(
      <ThemeProvider>
        <IntervalHistogram cases={[]} t={t as never} locale="en" />
      </ThemeProvider>,
    );
    expect(container.querySelector('[data-testid="interval-histogram"]')).not.toBeNull();
    localStorage.removeItem('emd-theme');
  });

  it('ResponderView renders inside a dark ThemeProvider', () => {
    localStorage.setItem('emd-theme', 'dark');
    const { container } = render(
      <ThemeProvider>
        <ResponderView cases={[]} thresholdLetters={15} t={t as never} locale="en" />
      </ThemeProvider>,
    );
    // Empty cases → responder-empty card; still proves the component mounted in dark mode.
    expect(container.querySelector('[data-testid="responder-empty"]')).not.toBeNull();
    localStorage.removeItem('emd-theme');
  });
});
