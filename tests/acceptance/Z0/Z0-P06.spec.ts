// Z0-P06 — Diagramm-Einstellungen der Verläufe bleiben in der Sitzung erhalten (acceptance/Z0/Z0-P06.feature).
// Synthetic data only.
// "Open the cohort analysis for <saved cohort>" = the row button "Outcomes anzeigen" under "Gespeicherte Suchen" on
// Kohortenbildung (PLAN Z0-P06 §5). "I open Kohortenbildung" = the sidebar link "Kohortenbildung" (same browser tab,
// so the same session). "Diagramm-Anzeige" = the Verläufe settings drawer opened by the button of that name; its
// x-axis radio "Anzahl Behandlungen" and its layer checkbox "Streuband (IQR)" are found by accessible name.
// Settings are session-wide, not per cohort (C7, Q24).
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

/** From Kohortenbildung (already open): "Gespeicherte Suchen" → row button "Outcomes anzeigen". */
async function openAnalysisFromSavedRow(page: Page, name: CohortName): Promise<void> {
  await page.getByRole('button', { name: /^Gespeicherte Suchen/ }).click();
  await expect(savedRow(page, name)).toHaveCount(1);
  await savedRow(page, name).getByRole('button', { name: 'Outcomes anzeigen', exact: true }).click();
  await page.waitForURL(/\/analysis\?/);
  await expect(page.getByTestId('analysis-active-cohort')).toContainText(name);
}

async function openKohortenbildung(page: Page): Promise<void> {
  await page.getByRole('navigation').getByRole('link', { name: 'Kohortenbildung', exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/cohort');
}

async function openTab(page: Page, name: 'Verläufe' | 'Aggregiert'): Promise<void> {
  await page.getByRole('tab', { name, exact: true }).click();
  await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
}

async function openDiagrammAnzeige(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Diagramm-Anzeige', exact: true }).click();
}

function treatmentsAxis(page: Page): Locator {
  return page.getByRole('radio', { name: 'Anzahl Behandlungen', exact: true });
}

function spreadBand(page: Page): Locator {
  return page.getByRole('checkbox', { name: 'Streuband (IQR)', exact: true });
}

async function expectSettingsKept(page: Page): Promise<void> {
  await openDiagrammAnzeige(page);
  await expect(treatmentsAxis(page)).toBeChecked();
  await expect(spreadBand(page)).not.toBeChecked();
}

test.beforeEach(async ({ page, request, loginAs }) => {
  await seedCohorts(request);
  await loginAs('klinikleitung');
  await page.goto('/cohort');
  await openAnalysisFromSavedRow(page, 'Testkohorte');
  await openTab(page, 'Verläufe');
  await openDiagrammAnzeige(page);
  await treatmentsAxis(page).check();
  await expect(treatmentsAxis(page)).toBeChecked();
  await expect(spreadBand(page)).toBeChecked();
  await spreadBand(page).uncheck();
  await expect(spreadBand(page)).not.toBeChecked();
  await page.keyboard.press('Escape');
});

test('[Z0-P06] Einstellungen überstehen den Wechsel zur Kohortenbildung', async ({ page }) => {
  await openKohortenbildung(page);
  await openAnalysisFromSavedRow(page, 'Testkohorte');
  await openTab(page, 'Verläufe');
  await expectSettingsKept(page);
});

test('[Z0-P06] Einstellungen gelten auch für eine neu gewählte Kohorte', async ({ page }) => {
  await openKohortenbildung(page);
  await openAnalysisFromSavedRow(page, 'Vergleichskohorte');
  await openTab(page, 'Verläufe');
  await expectSettingsKept(page);
});

test('[Z0-P06] Einstellungen überstehen den Wechsel zum Tab Aggregiert', async ({ page }) => {
  await openTab(page, 'Aggregiert');
  await openTab(page, 'Verläufe');
  await expectSettingsKept(page);
});
