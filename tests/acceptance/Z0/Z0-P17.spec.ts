// Z0-P17 — Jederzeit erkennbar, welche Kohorte ausgewählt ist (acceptance/Z0/Z0-P17.feature). Synthetic data only.
// "Kohortenanalyse header" = the active-cohort line under the level-1 heading "Kohortenanalyse"
// (data-testid "analysis-active-cohort", PLAN Z0-P17 §5). It sits above the tab bar, so it is the same element in
// both tabs; the test reads it in "Aggregiert" and again after opening "Verläufe".
// "Open the cohort analysis for <saved cohort>" = the row button "Outcomes anzeigen" under "Gespeicherte Suchen";
// "compare" = the Verläufe drawer "Kohorten vergleichen" (PLAN Z0-P17 §5).
import type { APIRequestContext, Locator, Page } from '@playwright/test';

import { apiToken, bearer, cohortCount, filterGroup } from '../../acceptance-at/helpers';
import { expect, test } from '../fixtures';

const COHORTS = {
  Testkohorte: { ageRange: [70, null] },
  Vergleichskohorte: { ageRange: [null, 60] },
} as const;

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

function activeCohortLine(page: Page): Locator {
  return page.getByTestId('analysis-active-cohort');
}

async function openTab(page: Page, name: 'Verläufe' | 'Aggregiert'): Promise<void> {
  await page.getByRole('tab', { name, exact: true }).click();
  await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
}

async function openSavedCohortAnalysis(page: Page, name: keyof typeof COHORTS): Promise<void> {
  await page.goto('/cohort');
  await page.getByRole('button', { name: /^Gespeicherte Suchen/ }).click();
  const row = page.locator('div.rounded-lg').filter({ has: page.getByText(name, { exact: true }) });
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: 'Outcomes anzeigen', exact: true }).click();
  await page.waitForURL(/\/analysis\?/);
}

test.beforeEach(async ({ request, loginAs }) => {
  await seedCohorts(request);
  await loginAs('klinikleitung');
});

test('[Z0-P17] Aktive Kohorte im Kopf beider Tabs', async ({ page }) => {
  await openSavedCohortAnalysis(page, 'Testkohorte');
  await openTab(page, 'Aggregiert');
  await expect(activeCohortLine(page)).toHaveText('Aktive Kohorte: Testkohorte');
  await openTab(page, 'Verläufe');
  await expect(activeCohortLine(page)).toHaveText('Aktive Kohorte: Testkohorte');
});

test('[Z0-P17] Gefilterte Kohorte wird ebenso benannt', async ({ page }) => {
  await page.goto('/cohort');
  await page.getByRole('button', { name: 'Zurücksetzen' }).click();
  await filterGroup(page, 'Alter (Jahre)').getByPlaceholder('Min').fill('70');
  expect(await cohortCount(page)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Kohorte analysieren', exact: true }).click();
  await page.waitForURL(/\/analysis\?/);
  await expect(activeCohortLine(page)).toHaveText(/^Aktive Kohorte: Gefilterte Kohorte/);
});

test('[Z0-P17] Vergleich wird im Kopf benannt', async ({ page }) => {
  await openSavedCohortAnalysis(page, 'Testkohorte');
  await openTab(page, 'Verläufe');
  await page.getByRole('button', { name: 'Kohorten vergleichen', exact: true }).click();
  await page.getByRole('checkbox', { name: /^Vergleichskohorte \(N=/ }).check();
  await expect(activeCohortLine(page)).toHaveText('Aktive Kohorte: Testkohorte · verglichen mit: Vergleichskohorte');
});

test('[Z0-P17] Keine Kohorte ausgewählt', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: 'Analyse', exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/analysis' && url.search === '');
  await expect(activeCohortLine(page)).toHaveText('Aktive Kohorte: Alle Patienten');
});
