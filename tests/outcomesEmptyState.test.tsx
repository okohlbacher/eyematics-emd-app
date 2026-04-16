// @vitest-environment jsdom
/**
 * VQA-05 / D-07 / D-08: OutcomesEmptyState third variant ('all-eyes-filtered')
 * with DE + EN localization verified verbatim.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import OutcomesEmptyState from '../src/components/outcomes/OutcomesEmptyState';
import type { TranslationKey } from '../src/i18n/translations';

afterEach(() => cleanup());

// Translation stub that reads from the real translations object, keyed by locale.
// Keeps the test independent of LanguageContext and guarantees we check the real strings.
async function makeT(locale: 'de' | 'en'): Promise<(k: TranslationKey) => string> {
  const mod = await import('../src/i18n/translations');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = (mod as any).translations ?? (mod as any).default;
  return (k: TranslationKey) => {
    const entry = table[k];
    if (!entry) throw new Error(`Missing translation key in fixture: ${k}`);
    return entry[locale];
  };
}

describe('OutcomesEmptyState — all-eyes-filtered variant (D-07 / D-08)', () => {
  it('renders EN copy for the all-eyes-filtered variant verbatim', async () => {
    const t = await makeT('en');
    const { container } = render(
      <MemoryRouter>
        <OutcomesEmptyState variant="all-eyes-filtered" t={t} />
      </MemoryRouter>,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('No eyes match the current filters.');
    expect(text).toContain('Adjust the OD/OS or layer toggles to see data.');
  });

  it('renders DE copy for the all-eyes-filtered variant verbatim', async () => {
    const t = await makeT('de');
    const { container } = render(
      <MemoryRouter>
        <OutcomesEmptyState variant="all-eyes-filtered" t={t} />
      </MemoryRouter>,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Keine Augen entsprechen den aktuellen Filtern.');
    expect(text).toContain('Passen Sie die OD/OS- oder Layer-Filter an, um Daten zu sehen.');
  });

  it('renders NO action link for the all-eyes-filtered variant (D-08)', async () => {
    const t = await makeT('en');
    const { container } = render(
      <MemoryRouter>
        <OutcomesEmptyState variant="all-eyes-filtered" t={t} />
      </MemoryRouter>,
    );
    expect(container.querySelector('a')).toBeNull();
  });

  it('still renders an action link for the no-cohort variant (regression guard)', async () => {
    const t = await makeT('en');
    const { container } = render(
      <MemoryRouter>
        <OutcomesEmptyState variant="no-cohort" t={t} />
      </MemoryRouter>,
    );
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/cohort');
  });
});

describe('VQA-05 translations — D-08 strings exist verbatim', () => {
  it('outcomesEmptyAllEyesFilteredTitle has the D-08 DE + EN strings', async () => {
    const mod = await import('../src/i18n/translations');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = (mod as any).translations ?? (mod as any).default;
    expect(table.outcomesEmptyAllEyesFilteredTitle).toBeDefined();
    expect(table.outcomesEmptyAllEyesFilteredTitle.en).toBe('No eyes match the current filters.');
    expect(table.outcomesEmptyAllEyesFilteredTitle.de).toBe('Keine Augen entsprechen den aktuellen Filtern.');
  });

  it('outcomesEmptyAllEyesFilteredBody has the D-08 DE + EN strings', async () => {
    const mod = await import('../src/i18n/translations');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = (mod as any).translations ?? (mod as any).default;
    expect(table.outcomesEmptyAllEyesFilteredBody).toBeDefined();
    expect(table.outcomesEmptyAllEyesFilteredBody.en).toBe('Adjust the OD/OS or layer toggles to see data.');
    expect(table.outcomesEmptyAllEyesFilteredBody.de).toBe('Passen Sie die OD/OS- oder Layer-Filter an, um Daten zu sehen.');
  });
});
