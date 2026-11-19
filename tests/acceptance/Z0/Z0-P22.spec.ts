// Z0-P22 — Einzelne Kohorte in der Kohortenanalyse wählen und überall übernehmen (acceptance/Z0/Z0-P22.feature).
// Synthetic data only.
// "the header" = the block with the level-1 heading "Kohortenanalyse" (above the tab bar, so the same element in both
// tabs); "selector 'Kohorte wählen'" = a combobox with that accessible name inside it (PLAN Z0-P22 §3/§5).
// Options: "Alle Patienten" first, then saved cohorts by name (Q16 b); the unsaved filtered cohort only appears when
// one is in the URL (Q16 a/Q26 a) — not the case here.
// "Kohortenanalyse header" names the cohort in the line "Aktive Kohorte: …" (data-testid "analysis-active-cohort",
// Z0-P17) and counts in "<c> Fälle in der aktuellen Kohorte · <p> Patient:innen" (C5 a). "the Verläufe view shows
// the number of patients" = the Verläufe subtitle "<p> Patient:innen · <c> Fälle" (data-testid "outcomes-subtitle").
// "the size of <cohort> shown in Kohortenbildung" = the heading "Kohorte: <n> Fälle" on /cohort after loading that
// saved cohort with its row button "Kohorte „<name>“ laden".
// "Open the cohort analysis for <saved cohort>" = the row button "Outcomes anzeigen" under "Gespeicherte Suchen";
// "compare <A> with Alle Patienten" = open the Verläufe drawer "Kohorten vergleichen" with only "Alle Patienten"
// ticked besides the active cohort (preselected since Z0-P05); "the legend" = the chart legend entries (Z0-P05).
import type { APIRequestContext, Locator, Page } from '@playwright/test';

import { apiToken, bearer, cohortCount } from '../../acceptance-at/helpers';
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

function header(page: Page): Locator {
  return page.getByRole('heading', { level: 1, name: 'Kohortenanalyse' }).locator('xpath=..');
}

function cohortSelector(page: Page): Locator {
  return header(page).getByRole('combobox', { name: 'Kohorte wählen', exact: true });
}

async function chooseCohort(page: Page, name: string): Promise<void> {
  await cohortSelector(page).selectOption({ label: name });
  await expect(page.getByTestId('analysis-active-cohort')).toContainText(name);
}

function activeCohortLine(page: Page): Locator {
  return page.getByTestId('analysis-active-cohort');
}

function trajectoriesPanel(page: Page): Locator {
  return page.getByTestId('analysis-tab-trajectories');
}

async function headerCounts(page: Page): Promise<{ cases: number; patients: number }> {
  const line = page.getByText(/^\d+ Fälle in der aktuellen Kohorte · \d+ Patient:innen/);
  await expect(line).toBeVisible();
  const m = /^(\d+) Fälle in der aktuellen Kohorte · (\d+) Patient:innen/.exec(await line.innerText())!;
  return { cases: Number(m[1]), patients: Number(m[2]) };
}

async function openTab(page: Page, name: 'Verläufe' | 'Aggregiert'): Promise<void> {
  await page.getByRole('tab', { name, exact: true }).click();
  await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
}

async function openAnalysisFromNavigation(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: 'Analyse', exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/analysis');
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

/** The size of a saved cohort as Kohortenbildung shows it after loading it. */
async function kohortenbildungSize(page: Page, name: CohortName): Promise<number> {
  await page.goto('/cohort');
  await page.getByRole('button', { name: 'Zurücksetzen' }).click();
  await page.getByRole('button', { name: /^Gespeicherte Suchen/ }).click();
  await expect(savedRow(page, name)).toHaveCount(1);
  await savedRow(page, name).getByRole('button', { name: `Kohorte „${name}“ laden`, exact: true }).click();
  await expect(page.getByText(`Geladene Kohorte: ${name}`, { exact: true })).toBeVisible();
  return cohortCount(page);
}

function legend(page: Page): Locator {
  return trajectoriesPanel(page).locator('.legend .legendtext');
}

test.beforeEach(async ({ request, loginAs }) => {
  await seedCohorts(request);
  await loginAs('klinikleitung');
});

test('[Z0-P22] Kohortenwahl im Kopf der Kohortenanalyse', async ({ page }) => {
  await openAnalysisFromNavigation(page);
  const selector = cohortSelector(page);
  await expect(selector).toBeVisible();
  const options = selector.locator('option');
  await expect(options.first()).toHaveText('Alle Patienten');
  for (const name of ['Alle Patienten', 'Testkohorte', 'Vergleichskohorte']) {
    await expect(options.filter({ hasText: new RegExp(`^\\s*${name}\\s*$`) }), `option "${name}"`).toHaveCount(1);
  }
});

test('[Z0-P22] Gewählte Kohorte gilt für Verläufe', async ({ page }) => {
  await openAnalysisFromNavigation(page);
  await chooseCohort(page, 'Testkohorte');
  const { patients } = await headerCounts(page);
  expect(patients, 'the synthetic cohort is not empty').toBeGreaterThan(0);

  await openTab(page, 'Verläufe');
  await expect(trajectoriesPanel(page).getByRole('heading', { level: 2 }).first()).toContainText('Testkohorte');
  await expect(trajectoriesPanel(page).getByTestId('outcomes-subtitle')).toHaveText(
    new RegExp(`^${patients} Patient:innen · \\d+ Fälle$`),
  );
  expect((await headerCounts(page)).patients).toBe(patients);
});

test('[Z0-P22] Wechsel in den Verläufen gilt auch für Aggregiert', async ({ page }) => {
  await openSavedCohortAnalysis(page, 'Testkohorte');
  await openTab(page, 'Verläufe');
  await chooseCohort(page, 'Vergleichskohorte');
  await openTab(page, 'Aggregiert');
  await expect(activeCohortLine(page)).toHaveText('Aktive Kohorte: Vergleichskohorte');
  const { cases } = await headerCounts(page);

  expect(cases).toBe(await kohortenbildungSize(page, 'Vergleichskohorte'));
});

test('[Z0-P22] Wechsel der Kohorte beendet einen laufenden Vergleich nicht', async ({ page }) => {
  await openSavedCohortAnalysis(page, 'Testkohorte');
  await openTab(page, 'Verläufe');
  await page.getByRole('button', { name: 'Kohorten vergleichen', exact: true }).click();
  const drawer = page.getByRole('complementary', { name: 'Kohorten vergleichen', exact: true });
  await expect(drawer.getByRole('checkbox', { name: /^Alle Patienten \(N=/ })).toBeChecked();
  await expect(drawer.getByRole('checkbox', { name: /^Vergleichskohorte \(N=/ })).not.toBeChecked();
  await expect(legend(page).filter({ hasText: /Testkohorte/ }).first()).toBeVisible();
  await expect(legend(page).filter({ hasText: /Alle Patienten/ }).first()).toBeVisible();

  await chooseCohort(page, 'Vergleichskohorte');
  await expect(legend(page).filter({ hasText: /Vergleichskohorte/ }).first()).toBeVisible();
  await expect(legend(page).filter({ hasText: /Alle Patienten/ }).first()).toBeVisible();
  await expect(legend(page).filter({ hasText: /Testkohorte/ })).toHaveCount(0);
});
