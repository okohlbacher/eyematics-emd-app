// Z0-P04 — Ausgewählte Kohorte wird in den Verläufen dargestellt (acceptance/Z0/Z0-P04.feature). Synthetic data only.
// "Verläufe heading" = the level-2 heading of the "Verläufe" tab panel; "Kohortenanalyse header" = the cohort name
// line under the level-1 heading "Kohortenanalyse" and its count "<n> Fälle in der aktuellen Kohorte".
// The Verläufe subtitle (data-testid "outcomes-subtitle") ends with the case count "<n> Fälle" (C5 a: patients and
// cases are both named).
import type { APIRequestContext, Locator, Page } from '@playwright/test';

import { apiToken, bearer, cohortCount, filterGroup } from '../../acceptance-at/helpers';
import { expect, test } from '../fixtures';

const COHORT = 'Testkohorte';

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

function headerName(page: Page): Locator {
  return page.getByRole('heading', { level: 1, name: 'Kohortenanalyse' }).locator('xpath=following-sibling::p[1]');
}

async function headerCaseCount(page: Page): Promise<number> {
  const line = page.getByText(/^\d+ Fälle in der aktuellen Kohorte/);
  await expect(line).toBeVisible();
  return Number(/^(\d+)/.exec(await line.innerText())![1]);
}

function trajectoriesPanel(page: Page): Locator {
  return page.getByTestId('analysis-tab-trajectories');
}

function trajectoriesHeading(page: Page): Locator {
  return trajectoriesPanel(page).getByRole('heading', { level: 2 }).first();
}

async function openTab(page: Page, name: 'Verläufe' | 'Aggregiert'): Promise<void> {
  await page.getByRole('tab', { name, exact: true }).click();
  await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
}

/** "the Verläufe view shows the same number of cases as 'Fälle in der aktuellen Kohorte'". */
async function expectSameCaseCount(page: Page): Promise<void> {
  const n = await headerCaseCount(page);
  expect(n, 'the synthetic cohort is not empty').toBeGreaterThan(0);
  await expect(trajectoriesPanel(page).getByTestId('outcomes-subtitle')).toHaveText(new RegExp(`(^|\\D)${n} Fälle$`));
}

async function openFilteredCohortAnalysis(page: Page): Promise<void> {
  await page.goto('/cohort');
  await page.getByRole('button', { name: 'Zurücksetzen' }).click();
  await filterGroup(page, 'Alter (Jahre)').getByPlaceholder('Min').fill('70');
  expect(await cohortCount(page)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Kohorte analysieren', exact: true }).click();
  await page.waitForURL(/\/analysis\?/);
}

test.beforeEach(async ({ loginAs }) => {
  await loginAs('klinikleitung');
});

test('[Z0-P04] Gefilterte, nicht gespeicherte Kohorte erscheint in Verläufe', async ({ page }) => {
  await openFilteredCohortAnalysis(page);
  await expect(headerName(page)).toContainText('Gefilterte Kohorte');
  // The scenario compares the cohort named in both views; the header prefix "Aktive Kohorte: " (Z0-P17) is not part
  // of the name (operator amendment, Z0 PLAN Q4/C4, NF 2026-11-19).
  const name = (await headerName(page).innerText()).trim().replace(/^Aktive Kohorte:\s*/, '');
  await headerCaseCount(page);

  await openTab(page, 'Verläufe');
  await expect(trajectoriesHeading(page)).toContainText(name);
  await expectSameCaseCount(page);
  await expect(page.getByText('Keine Patient:innen in dieser Kohorte')).toHaveCount(0);
});

test('[Z0-P04] Gespeicherte Kohorte erscheint in Verläufe', async ({ page, request }) => {
  await seedTestkohorte(request);
  await page.goto('/cohort');
  await page.getByRole('button', { name: /^Gespeicherte Suchen/ }).click();
  const row = page.locator('div.rounded-lg').filter({ has: page.getByText(COHORT, { exact: true }) });
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: 'Outcomes anzeigen', exact: true }).click();
  await page.waitForURL(/\/analysis\?/);

  await openTab(page, 'Verläufe');
  await expect(trajectoriesHeading(page)).toContainText(COHORT);
  await expectSameCaseCount(page);
});

test('[Z0-P04] Kohorte bleibt beim Wechsel zwischen Aggregiert und Verläufe erhalten', async ({ page }) => {
  await openFilteredCohortAnalysis(page);
  await openTab(page, 'Verläufe');
  await openTab(page, 'Aggregiert');
  await openTab(page, 'Verläufe');
  await expect(headerName(page)).toContainText('Gefilterte Kohorte');
  await expectSameCaseCount(page);
});

// Scenarios 4–6 (feature amendment NF 2026-11-23, PLAN Q43/Q45/Q47 a):
// - "the same text as after 'Aktive Kohorte: ' in the header" = the header line with that prefix removed.
// - "the UI language is English" = locale 'en' (localStorage `emd-locale`, as in Z0-P03/P05/P15) followed by a reload.
// - "loaded 'Testkohorte' without changing its filters" = the row button "Kohorte „Testkohorte“ laden" (Z0-P02);
//   "change one of its filters" = the "Alter (Jahre)" Min field 70 → 75.

async function headerCohortText(page: Page): Promise<string> {
  await expect(headerName(page)).toContainText('Aktive Kohorte: ');
  return (await headerName(page).innerText()).trim().replace(/^Aktive Kohorte:\s*/, '');
}

async function openSavedCohortAnalysis(page: Page): Promise<void> {
  await page.goto('/cohort');
  await page.getByRole('button', { name: /^Gespeicherte Suchen/ }).click();
  const row = page.locator('div.rounded-lg').filter({ has: page.getByText(COHORT, { exact: true }) });
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: 'Outcomes anzeigen', exact: true }).click();
  await page.waitForURL(/\/analysis\?/);
}

async function loadSavedCohortInBuilder(page: Page): Promise<void> {
  await page.goto('/cohort');
  await page.getByRole('button', { name: 'Zurücksetzen' }).click();
  await page.getByRole('button', { name: /^Gespeicherte Suchen/ }).click();
  await page.getByRole('button', { name: `Kohorte „${COHORT}“ laden`, exact: true }).click();
  await expect(page.getByText(`Geladene Kohorte: ${COHORT}`)).toBeVisible();
}

test('[Z0-P04] Verläufe-Überschrift nennt die aktive Kohorte wie der Kopf', async ({ page, request }) => {
  await seedTestkohorte(request);
  await openSavedCohortAnalysis(page);
  await openTab(page, 'Verläufe');
  expect(await headerCohortText(page)).toBe(COHORT);
  await expect(trajectoriesHeading(page)).toHaveText(COHORT);
  await expect(trajectoriesHeading(page)).not.toContainText('Outcomes');
  await expect(page.getByText('Gespeicherte Kohorte')).toHaveCount(0);
  await expect(page.getByText('Ad-hoc-Filter')).toHaveCount(0);

  await page.evaluate(() => localStorage.setItem('emd-locale', 'en'));
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Trajectories', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(trajectoriesHeading(page)).toHaveText(COHORT);
  await expect(trajectoriesHeading(page)).not.toContainText('Outcomes');
});

test('[Z0-P04] Verläufe-Überschrift einer gefilterten Kohorte und ohne Kohorte', async ({ page }) => {
  await openFilteredCohortAnalysis(page);
  await openTab(page, 'Verläufe');
  const name = await headerCohortText(page);
  expect(name.startsWith('Gefilterte Kohorte')).toBe(true);
  await expect(trajectoriesHeading(page)).toHaveText(name);

  await page.getByRole('navigation').getByRole('link', { name: 'Analyse', exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/analysis' && !url.searchParams.has('filters'));
  await openTab(page, 'Verläufe');
  await expect(trajectoriesHeading(page)).toHaveText('Alle Patienten');
});

test('[Z0-P04] Unverändert geladene gespeicherte Kohorte behält ihren Namen', async ({ page, request }) => {
  await seedTestkohorte(request);
  await loadSavedCohortInBuilder(page);
  await page.getByRole('button', { name: 'Kohorte analysieren', exact: true }).click();
  await page.waitForURL(/\/analysis\?/);
  await expect(headerName(page)).toHaveText(`Aktive Kohorte: ${COHORT}`);
  await openTab(page, 'Verläufe');
  await expect(trajectoriesHeading(page)).toHaveText(COHORT);

  await loadSavedCohortInBuilder(page);
  await filterGroup(page, 'Alter (Jahre)').getByPlaceholder('Min').fill('75');
  expect(await cohortCount(page)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Kohorte analysieren', exact: true }).click();
  await page.waitForURL(/\/analysis\?/);
  await expect(headerName(page)).toContainText(/^Aktive Kohorte: Gefilterte Kohorte/);
});
