// Z0-P05 — Grundgesamtheit als Standard im Kohortenvergleich der Verläufe (acceptance/Z0/Z0-P05.feature).
// Synthetic data only.
// "the drawer 'Kohorten vergleichen'" = the Verläufe compare drawer (aside, accessible name "Kohorten vergleichen");
// its options are the checkboxes in DOM order, so "first comparison option" = the first checkbox (PLAN Z0-P05 §5).
// "Alle Patienten" = the patients of the included cases, i.e. all accessible cases minus the user's exclusions
// (team answers Q6/Q23, NF 2026-11-19). The test relies on a fresh container: `klinikleitung` sees every site and has
// no exclusions, so N = distinct pseudonyms of all synthetic cases (public/data, shared extractPatientCases).
// Label: "Alle Patienten (N=<n> Patient:innen)" / EN "All patients (N=<n> patients)" (team answer).
// "the view shows" = the Verläufe subtitle (data-testid "outcomes-subtitle"); "the legend" = the chart legend entries.
// Team answer (binding): the header names it — "… · verglichen mit: Alle Patienten, <Kohorte>"; with only
// "Alle Patienten" preselected that is "· verglichen mit: Alle Patienten".
import type { APIRequestContext, Locator, Page } from '@playwright/test';

import { extractPatientCases } from '../../../shared/patientCases';
import { apiToken, bearer, localBundles } from '../../acceptance-at/helpers';
import { expect, test } from '../fixtures';

const COHORT = 'Testkohorte';
const COHORT_FILTERS = { ageRange: [70, null] };

async function seedCohort(request: APIRequestContext): Promise<void> {
  const headers = bearer(await apiToken(request, 'klinikleitung'));
  const list = await request.get('/api/data/saved-searches', { headers });
  expect(list.status()).toBe(200);
  const { savedSearches } = (await list.json()) as { savedSearches: { id: string; name: string }[] };
  for (const s of savedSearches.filter((x) => x.name === COHORT)) {
    expect((await request.delete(`/api/data/saved-searches/${s.id}`, { headers })).status()).toBe(200);
  }
  const created = await request.post('/api/data/saved-searches', { headers, data: { name: COHORT, filters: COHORT_FILTERS } });
  expect(created.status()).toBe(201);
}

function allPatientsN(): number {
  const cases = extractPatientCases(localBundles() as unknown as Parameters<typeof extractPatientCases>[0]);
  return new Set(cases.map((c) => c.pseudonym)).size;
}

function drawer(page: Page, name: string): Locator {
  return page.getByRole('complementary', { name, exact: true });
}

function subtitle(page: Page): Locator {
  return page.getByTestId('analysis-tab-trajectories').getByTestId('outcomes-subtitle');
}

async function openCompare(page: Page, button = 'Kohorten vergleichen'): Promise<Locator> {
  await page.getByRole('button', { name: button, exact: true }).click();
  const d = drawer(page, button === 'Kohorten vergleichen' ? 'Kohorten vergleichen' : 'Compare Cohorts');
  await expect(d.getByRole('checkbox').first()).toBeVisible();
  return d;
}

test.beforeEach(async ({ page, request, loginAs }) => {
  await seedCohort(request);
  await loginAs('klinikleitung');
  // Background: open the cohort analysis for "Testkohorte", tab "Verläufe".
  await page.goto('/cohort');
  await page.getByRole('button', { name: /^Gespeicherte Suchen/ }).click();
  const row = page.locator('div.rounded-lg').filter({ has: page.getByText(COHORT, { exact: true }) });
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: 'Outcomes anzeigen', exact: true }).click();
  await page.waitForURL(/\/analysis\?/);
  await page.getByRole('tab', { name: 'Verläufe', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Verläufe', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('[Z0-P05] Grundgesamtheit ist ohne eigene Kohortenbildung wählbar', async ({ page }) => {
  const n = allPatientsN();
  expect(n, 'synthetic data has patients').toBeGreaterThan(0);
  const d = await openCompare(page);
  const first = d.getByRole('checkbox').first();
  await expect(first).toHaveAccessibleName(`Alle Patienten (N=${n} Patient:innen)`);
  await expect(d.getByText(`Alle Patienten (N=${n} Patient:innen)`, { exact: true })).toBeVisible();
});

test('[Z0-P05] Grundgesamtheit ist beim ersten Öffnen vorausgewählt', async ({ page }) => {
  const d = await openCompare(page);
  await expect(d.getByRole('checkbox', { name: /^Alle Patienten \(N=/ })).toBeChecked();
  await expect(subtitle(page)).toHaveText(/^2 Kohorten verglichen/);
  const legend = page.getByTestId('analysis-tab-trajectories').locator('.legend .legendtext');
  await expect(legend.filter({ hasText: /^Testkohorte/ }).first()).toBeVisible();
  await expect(legend.filter({ hasText: /^Alle Patienten/ }).first()).toBeVisible();
  // Team answer (binding): the analysis header names the comparison with "Alle Patienten".
  await expect(page.getByTestId('analysis-active-cohort')).toHaveText(
    'Aktive Kohorte: Testkohorte · verglichen mit: Alle Patienten',
  );
});

test('[Z0-P05] Grundgesamtheit lässt sich wieder abwählen', async ({ page }) => {
  const d = await openCompare(page);
  const all = d.getByRole('checkbox', { name: /^Alle Patienten \(N=/ });
  await expect(all).toBeChecked();
  await expect(subtitle(page)).toHaveText(/^2 Kohorten verglichen/);
  await all.uncheck();
  await expect(all).not.toBeChecked();
  await expect(page.getByText('2 Kohorten verglichen')).toHaveCount(0);
});

test('[Z0-P05] Gleiche Bezeichnung wie in der Einzelfallansicht', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('emd-locale', 'en'));
  await page.reload();
  const d = await openCompare(page, 'Compare cohorts');
  await expect(d.getByRole('checkbox').first()).toHaveAccessibleName(/^All patients \(N=\d+ patients\)$/);
});
