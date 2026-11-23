// Z0-P11 — Hilfe erklärt die Möglichkeiten des Verläufe-Tabs (acceptance/Z0/Z0-P11.feature). Synthetic data only.
// "Testkohorte" = saved cohort with age >= 70 (as in Z0-P12/Z0-P13/Z0-P20/Z0-P21).
// Readings (PLAN Z0-P11 §3/§5, binding answer Q10 "four sections; wording by the developer"):
// - "next to 'Diagramm-Anzeige'" = the help button is the immediate DOM sibling (before or after) of the
//   "Diagramm-Anzeige" header button, and both boxes overlap vertically (same row).
// - "a dialog … opens" = an element with role=dialog whose accessible name is exactly the given name.
// - "explains how to open a single case" = the dialog has a section whose heading contains "Einzelfallansicht".
// - "the UI language is English" = locale 'en' (localStorage `emd-locale`, as in Z0-P03/P05/P13/P20) + reload.
import type { APIRequestContext, Page } from '@playwright/test';

import { apiToken, bearer } from '../../acceptance-at/helpers';
import { expect, test } from '../fixtures';

const COHORT = 'Testkohorte';
const HELP_DE = 'Hilfe zu Verläufen';
const HELP_EN = 'Help on trajectories';

async function seedTestkohorte(request: APIRequestContext): Promise<void> {
  const headers = bearer(await apiToken(request, 'klinikleitung'));
  const list = await request.get('/api/data/saved-searches', { headers });
  expect(list.status()).toBe(200);
  const { savedSearches } = (await list.json()) as { savedSearches: { id: string; name: string }[] };
  for (const s of savedSearches.filter((x) => x.name === COHORT)) {
    expect((await request.delete(`/api/data/saved-searches/${s.id}`, { headers })).status()).toBe(200);
  }
  const created = await request.post('/api/data/saved-searches', {
    headers,
    data: { name: COHORT, filters: { ageRange: [70, null] } },
  });
  expect(created.status()).toBe(201);
}

async function openSavedCohortAnalysis(page: Page): Promise<void> {
  await page.goto('/cohort');
  await page.getByRole('button', { name: /^Gespeicherte Suchen/ }).click();
  const row = page.locator('div.rounded-lg').filter({ has: page.getByText(COHORT, { exact: true }) });
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: 'Outcomes anzeigen', exact: true }).click();
  await page.waitForURL(/\/analysis\?/);
}

async function openTrajectories(page: Page): Promise<void> {
  const tab = page.locator('[role="tab"][aria-controls="analysis-tab-trajectories"]');
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

test.beforeEach(async ({ page, request, loginAs }) => {
  await seedTestkohorte(request);
  await loginAs('klinikleitung');
  await openSavedCohortAnalysis(page);
  await openTrajectories(page);
});

test('[Z0-P11] Hilfe-Schaltfläche im Verläufe-Tab', async ({ page }) => {
  const help = page.getByRole('button', { name: HELP_DE, exact: true });
  const settings = page.getByRole('button', { name: 'Diagramm-Anzeige', exact: true });
  await expect(help).toHaveCount(1);
  await expect(help).toBeVisible();
  await expect(settings).toBeVisible();
  const adjacent = await help.evaluate((el) => {
    const isSettings = (n: Element | null) => n?.textContent?.trim() === 'Diagramm-Anzeige';
    return isSettings(el.previousElementSibling) || isSettings(el.nextElementSibling);
  });
  expect(adjacent, 'the help button is the direct neighbour of "Diagramm-Anzeige"').toBe(true);
  const h = (await help.boundingBox())!;
  const s = (await settings.boundingBox())!;
  expect(h.y).toBeLessThan(s.y + s.height);
  expect(h.y + h.height).toBeGreaterThan(s.y);
});

test('[Z0-P11] Hilfe erklärt Einzelfallauswahl, Vergleich und Anzeige', async ({ page }) => {
  await page.getByRole('button', { name: HELP_DE, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: HELP_DE, exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: /Einzelfallansicht/ })).toHaveCount(1);
  await expect(dialog).toContainText('Einzelfallansicht');
  await expect(dialog).toContainText('Kohorten vergleichen');
  await expect(dialog).toContainText('Diagramm-Anzeige');
  await expect(dialog).toContainText('Rohdaten anzeigen');
});

test('[Z0-P11] Hilfe schließen', async ({ page }) => {
  const help = page.getByRole('button', { name: HELP_DE, exact: true });
  await help.click();
  const dialog = page.getByRole('dialog', { name: HELP_DE, exact: true });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(help).toBeFocused();
});

test('[Z0-P11] Englische Oberfläche', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('emd-locale', 'en'));
  await page.reload();
  await openTrajectories(page);
  await expect(page.locator('[role="tab"][aria-controls="analysis-tab-trajectories"]')).toHaveText(/Trajectories/);
  await page.getByRole('button', { name: HELP_EN, exact: true }).click();
  await expect(page.getByRole('dialog', { name: HELP_EN, exact: true })).toBeVisible();
});
