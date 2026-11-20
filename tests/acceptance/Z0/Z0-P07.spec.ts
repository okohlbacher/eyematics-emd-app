// Z0-P07 — Streuband-Schalter wirkt auch im Kohortenvergleich (acceptance/Z0/Z0-P07.feature). Synthetic data only.
// - "each chart panel" = every Verläufe chart card `[data-testid^="outcomes-panel-"][role="img"]` of the CRT metric.
// - "shows <n> IQR bands" = the number of DRAWN band series (`.recharts-area`, one Recharts range Area per cohort)
//   in that panel — not the hidden presence marker `outcomes-panel-<eye>-iqr`, which follows the toggle even when no
//   band is drawn (PLAN Z0-P07 §1).
// - "the legend colour of its cohort" = the computed background colour of the legend swatch of the entry
//   "<Kohorte> (N=…)" in the same panel; a band's colour = the computed fill of its `.recharts-area-area` path.
// - "Diagramm-Anzeige" = the settings aside "Einstellungen" opened by that button; "Einzelne Kohorte anzeigen" = the
//   reset button in the compare drawer "Kohorten vergleichen".
import type { APIRequestContext, Locator, Page } from '@playwright/test';

import { apiToken, bearer } from '../../acceptance-at/helpers';
import { expect, test } from '../fixtures';

const COHORTS = {
  Testkohorte: { ageRange: [70, null] },
  Vergleichskohorte: { ageRange: [null, 60] },
} as const;
type CohortName = keyof typeof COHORTS;

/** Background: exactly one saved cohort per name. */
async function seedCohorts(request: APIRequestContext): Promise<void> {
  const headers = bearer(await apiToken(request, 'klinikleitung'));
  const list = await request.get('/api/data/saved-searches', { headers });
  expect(list.status()).toBe(200);
  const { savedSearches } = (await list.json()) as { savedSearches: { id: string; name: string }[] };
  for (const s of savedSearches.filter((x) => x.name in COHORTS)) {
    expect((await request.delete(`/api/data/saved-searches/${s.id}`, { headers })).status()).toBe(200);
  }
  for (const [name, filters] of Object.entries(COHORTS)) {
    const created = await request.post('/api/data/saved-searches', { headers, data: { name, filters } });
    expect(created.status()).toBe(201);
  }
}

function savedRow(page: Page, name: CohortName): Locator {
  return page.locator('div.rounded-lg').filter({ has: page.getByText(name, { exact: true }) });
}

async function openSavedCohortAnalysis(page: Page, name: CohortName): Promise<void> {
  await page.goto('/cohort');
  await page.getByRole('button', { name: /^Gespeicherte Suchen/ }).click();
  await expect(savedRow(page, name)).toHaveCount(1);
  await savedRow(page, name).getByRole('button', { name: 'Outcomes anzeigen', exact: true }).click();
  await page.waitForURL(/\/analysis\?/);
}

async function openTab(page: Page, name: 'Verläufe' | 'Aggregiert'): Promise<void> {
  await page.getByRole('tab', { name, exact: true }).click();
  await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
}

function trajectoriesPanel(page: Page): Locator {
  return page.getByTestId('analysis-tab-trajectories');
}

function compareDrawer(page: Page): Locator {
  return page.getByRole('complementary', { name: 'Kohorten vergleichen', exact: true });
}

function optionRow(drawer: Locator, name: string): Locator {
  return drawer.locator('label').filter({
    has: drawer.page().locator('[data-compare-option-label]', { hasText: new RegExp(`^${name} \\(N=`) }),
  });
}

async function openCompareDrawer(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Kohorten vergleichen', exact: true }).click();
  const d = compareDrawer(page);
  await expect(d.getByRole('checkbox').first()).toBeVisible();
  return d;
}

/** Compare the active cohort with exactly one other saved cohort (the preselected "Alle Patienten" is unticked). */
async function compareWith(page: Page, other: CohortName): Promise<void> {
  const d = await openCompareDrawer(page);
  const all = optionRow(d, 'Alle Patienten').getByRole('checkbox');
  if (await all.isChecked()) await all.uncheck();
  await optionRow(d, other).getByRole('checkbox').check();
  await expect(optionRow(d, other).getByRole('checkbox')).toBeChecked();
  await expect(all).not.toBeChecked();
  await page.keyboard.press('Escape');
}

async function openMetric(page: Page, metric: 'visus' | 'crt'): Promise<void> {
  await page.getByTestId(`metric-tab-${metric}`).click();
  await expect(page.getByTestId(`metric-tab-${metric}`)).toHaveAttribute('aria-selected', 'true');
}

function chartPanels(page: Page): Locator {
  return trajectoriesPanel(page).locator('[data-testid^="outcomes-panel-"][role="img"]');
}

/** Set "Streuband (IQR)" in "Diagramm-Anzeige" to `on` and close the aside. */
async function setSpreadBand(page: Page, on: boolean): Promise<void> {
  await page.getByRole('button', { name: 'Diagramm-Anzeige', exact: true }).click();
  const settings = page.getByRole('complementary', { name: 'Einstellungen', exact: true });
  const iqr = settings.getByRole('checkbox', { name: 'Streuband (IQR)', exact: true });
  await expect(iqr).toBeVisible();
  if (on) await iqr.check();
  else await iqr.uncheck();
  if (on) await expect(iqr).toBeChecked();
  else await expect(iqr).not.toBeChecked();
  await page.keyboard.press('Escape');
}

/** Every chart panel draws exactly `n` IQR bands (at least one panel must be present). */
async function expectBandsPerPanel(page: Page, n: number): Promise<void> {
  const panels = chartPanels(page);
  await expect(panels.first()).toBeVisible({ timeout: 30_000 });
  const count = await panels.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await expect(panels.nth(i).locator('.recharts-area'), `panel ${i + 1} of ${count}`).toHaveCount(n);
  }
}

async function legendSwatchColour(panel: Locator, name: CohortName): Promise<string> {
  const entry = panel.locator('.legend .legendtext').filter({ hasText: new RegExp(`^${name} \\(N=`) }).first();
  await expect(entry).toBeVisible();
  const swatch = entry.locator('xpath=ancestor::li[1]').locator('[data-legend-swatch]').first();
  return swatch.evaluate((el) => getComputedStyle(el).backgroundColor);
}

test.beforeEach(async ({ page, request, loginAs }) => {
  await seedCohorts(request);
  await loginAs('klinikleitung');
  await openSavedCohortAnalysis(page, 'Testkohorte');
  await openTab(page, 'Verläufe');
  await compareWith(page, 'Vergleichskohorte');
  await openMetric(page, 'crt');
});

test('[Z0-P07] Streuband im Vergleich ausblenden', async ({ page }) => {
  await setSpreadBand(page, true);
  await expectBandsPerPanel(page, 2);

  await setSpreadBand(page, false);
  await expectBandsPerPanel(page, 0);
});

test('[Z0-P07] Streuband im Vergleich einblenden', async ({ page }) => {
  await setSpreadBand(page, false);
  await expectBandsPerPanel(page, 0);

  await setSpreadBand(page, true);
  await expectBandsPerPanel(page, 2);

  const panels = chartPanels(page);
  const count = await panels.count();
  for (let i = 0; i < count; i++) {
    const panel = panels.nth(i);
    const legend = [
      await legendSwatchColour(panel, 'Testkohorte'),
      await legendSwatchColour(panel, 'Vergleichskohorte'),
    ];
    expect(legend[0], 'the two cohorts have distinct legend colours').not.toBe(legend[1]);
    const bands = await panel
      .locator('.recharts-area .recharts-area-area')
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).fill));
    expect(bands, `panel ${i + 1}: one band per cohort, in the legend colour`).toHaveLength(2);
    expect([...bands].sort(), `panel ${i + 1}`).toEqual([...legend].sort());
  }
});

test('[Z0-P07] Einzelne Kohorte unverändert', async ({ page }) => {
  const d = await openCompareDrawer(page);
  await d.getByRole('button', { name: 'Einzelne Kohorte anzeigen', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(trajectoriesPanel(page).locator('.legend .legendtext').filter({ hasText: /^Vergleichskohorte/ })).toHaveCount(0);

  await setSpreadBand(page, false);
  await expectBandsPerPanel(page, 0);

  await setSpreadBand(page, true);
  await expectBandsPerPanel(page, 1);
});
