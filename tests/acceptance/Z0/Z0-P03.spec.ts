// Z0-P03 — Selbsterklärende Y-Achse der Verläufe (acceptance/Z0/Z0-P03.feature). Synthetic data only.
// Readings (PLAN Z0-P03 §5 and the binding answers C3 "yes", Q3 "ok"):
// - "the y-axis title reads X" = in the OD chart card of Verläufe, the visible SVG axis title (`.recharts-label`)
//   with exactly X exists AND the y-axis title marker `outcomes-panel-od-ylabel` carries data-ylabel = X.
// - "Diagramm-Anzeige" = the settings aside "Einstellungen" opened by that button; y-mode = radio group "y-metric".
// - "the info icon next to the y-axis title" = the control data-testid `outcomes-panel-od-ylabel-info`; its tooltip is
//   the shared hover/focus tooltip (role="tooltip", Z0-P02), hidden before the hover.
// - "the UI language is English" = locale 'en' (localStorage `emd-locale`, as in Z0-P05), applied after the
//   Background and followed by a reload; the Verläufe tab (aria-controls) and the CRT metric are then reopened by their stable ids.
import type { APIRequestContext, Locator, Page } from '@playwright/test';

import { apiToken, bearer } from '../../acceptance-at/helpers';
import { expect, test } from '../fixtures';

const COHORT = 'Testkohorte';

/** Background "a saved cohort 'Testkohorte' exists": exactly one such cohort. */
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

function savedRow(page: Page): Locator {
  return page.locator('div.rounded-lg').filter({ has: page.getByText(COHORT, { exact: true }) });
}

async function openSavedCohortAnalysis(page: Page): Promise<void> {
  await page.goto('/cohort');
  await page.getByRole('button', { name: /^Gespeicherte Suchen/ }).click();
  await expect(savedRow(page)).toHaveCount(1);
  await savedRow(page).getByRole('button', { name: 'Outcomes anzeigen', exact: true }).click();
  await page.waitForURL(/\/analysis\?/);
}

function trajectoriesTab(page: Page): Locator {
  return page.locator('[role="tab"][aria-controls="analysis-tab-trajectories"]');
}

async function openTrajectories(page: Page): Promise<void> {
  const tab = trajectoriesTab(page);
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

async function openMetric(page: Page, metric: 'visus' | 'crt'): Promise<void> {
  await page.getByTestId(`metric-tab-${metric}`).click();
  await expect(page.getByTestId(`metric-tab-${metric}`)).toHaveAttribute('aria-selected', 'true');
}

function odPanel(page: Page): Locator {
  return page.getByTestId('analysis-tab-trajectories').getByTestId('outcomes-panel-od');
}

/** "the y-axis title reads <text>": visible SVG axis title and the y-axis title marker. */
async function expectYAxisTitle(page: Page, text: string): Promise<void> {
  const panel = odPanel(page);
  await expect(panel).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('outcomes-panel-od-ylabel')).toHaveAttribute('data-ylabel', text);
  const exact = new RegExp(`^${text.replace(/[()]/g, '\\$&')}$`);
  await expect(panel.locator('.recharts-label').filter({ hasText: exact })).toHaveCount(1);
}

/** Choose the y-mode radio with label `label` in "Diagramm-Anzeige" and close the aside. */
async function setYMode(page: Page, label: string): Promise<void> {
  await page.getByRole('button', { name: 'Diagramm-Anzeige', exact: true }).click();
  const settings = page.getByRole('complementary', { name: 'Einstellungen', exact: true });
  const radio = settings.getByRole('radio', { name: label, exact: true });
  await expect(radio).toBeVisible();
  await radio.check();
  await expect(radio).toBeChecked();
  await page.keyboard.press('Escape');
}

test.beforeEach(async ({ page, request, loginAs }) => {
  await seedTestkohorte(request);
  await loginAs('klinikleitung');
  await openSavedCohortAnalysis(page);
  await openTrajectories(page);
  await openMetric(page, 'crt');
});

test('[Z0-P03] Veränderungsdarstellung CRT nennt Größe, Bezug und Einheit', async ({ page }) => {
  // Given the y-axis shows the change from baseline in µm.
  await setYMode(page, 'Δ (µm zur Baseline)');
  await expectYAxisTitle(page, 'CRT-Veränderung zum Ausgangswert (µm)');
});

test('[Z0-P03] Prozentuale Veränderung CRT', async ({ page }) => {
  await setYMode(page, 'Δ % (prozentuale Änderung)');
  await expectYAxisTitle(page, 'CRT-Veränderung zum Ausgangswert (%)');
});

test('[Z0-P03] Absolutwerte CRT', async ({ page }) => {
  await setYMode(page, 'Absolut (µm)');
  await expectYAxisTitle(page, 'Netzhautdicke (µm)');
});

test('[Z0-P03] Veränderungsdarstellung Visus', async ({ page }) => {
  await openMetric(page, 'visus');
  await expectYAxisTitle(page, 'Visus-Veränderung zum Ausgangswert (logMAR)');
});

test('[Z0-P03] Erklärung per Mouseover an der Y-Achse', async ({ page }) => {
  await expect(odPanel(page)).toBeVisible({ timeout: 30_000 });
  const icon = page.getByTestId('outcomes-panel-od-ylabel-info');
  const visibleTooltips = page.locator('[role="tooltip"]:visible');
  await page.mouse.move(0, 0);
  await expect(visibleTooltips).toHaveCount(0);
  await icon.hover();
  await expect(visibleTooltips).toHaveCount(1);
  await expect(visibleTooltips).toContainText('Ausgangswert');
  await expect(visibleTooltips).toContainText('erste Messung');
});

test('[Z0-P03] Englische Oberfläche', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('emd-locale', 'en'));
  await page.reload();
  await openTrajectories(page);
  await openMetric(page, 'crt');
  await expect(trajectoriesTab(page)).toHaveText(/Trajectories/);
  await expectYAxisTitle(page, 'CRT change from baseline (µm)');
});
