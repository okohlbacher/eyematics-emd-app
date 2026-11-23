// Z0-P13 — Sichtbarer Hinweis zur Einzelfallauswahl in den Verläufen (acceptance/Z0/Z0-P13.feature). Synthetic data only.
// "Testkohorte" = saved cohort with age >= 70 (as in Z0-P12/Z0-P20/Z0-P21).
// Readings (PLAN Z0-P13 §3/§5, binding answers Q38 "the hint follows the actual layer state", Q39, Q12 b):
// - "Diagramm-Anzeige" = the header button that opens the aside "Einstellungen"; the layers are checkboxes in that aside.
// - "the chart" = the chart grid of the Verläufe tab (the panels OD / OS / OD + OS, default metric Visus);
//   "directly above" = the hint is the element immediately before that grid (DOM order) and its box ends above the
//   first panel's box and overlaps it horizontally (PLAN §5: DOM order and bounding box).
// - "the hint" (scenario 2) = the same hint element, now with the alternate text.
// - "the UI language is English" = locale 'en' (localStorage `emd-locale`, as in Z0-P03/P05/P20) followed by a reload.
import type { APIRequestContext, Locator, Page } from '@playwright/test';

import { apiToken, bearer } from '../../acceptance-at/helpers';
import { expect, test } from '../fixtures';

const COHORT = 'Testkohorte';
const HINT_DE = 'Klicken Sie auf eine Kurve oder einen Messpunkt, um die Einzelfallansicht zu öffnen.';
const HINT_OFF_DE = 'Blenden Sie unter „Diagramm-Anzeige“ individuelle Kurven ein, um einzelne Fälle zu öffnen.';
const HINT_EN = 'Click a curve or a measurement point to open the case view.';

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

/** Set the layer checkboxes in "Diagramm-Anzeige" / "Chart display" (aside "Einstellungen" / "Settings"). */
async function setLayers(page: Page, wanted: Record<string, boolean>, en = false): Promise<void> {
  const button = page.getByRole('button', { name: en ? 'Chart display' : 'Diagramm-Anzeige', exact: true });
  await button.click();
  const settings = page.getByRole('complementary', { name: en ? 'Settings' : 'Einstellungen', exact: true });
  await expect(settings).toBeVisible();
  for (const [label, on] of Object.entries(wanted)) {
    const box = settings.getByRole('checkbox', { name: label, exact: true });
    if ((await box.isChecked()) !== on) await box.setChecked(on);
    if (on) await expect(box).toBeChecked();
    else await expect(box).not.toBeChecked();
  }
  await page.keyboard.press('Escape');
  await expect(button).toHaveAttribute('aria-expanded', 'false'); // the closed drawer only slides off-screen
}

function trajectories(page: Page): Locator {
  return page.getByTestId('analysis-tab-trajectories');
}

/** Asserts that `hint` is visible and sits directly above the Verläufe chart (DOM order + bounding box). */
async function expectDirectlyAboveChart(page: Page, hint: Locator): Promise<void> {
  await expect(hint).toBeVisible();
  const firstPanel = trajectories(page).locator('[data-testid="outcomes-panel-od"]').first();
  await expect(firstPanel).toBeVisible({ timeout: 30_000 });
  const nextHoldsChart = await hint.evaluate(
    (el) => !!el.nextElementSibling?.querySelector('[data-testid="outcomes-panel-od"]'),
  );
  expect(nextHoldsChart, 'the element right after the hint is the chart grid').toBe(true);
  const h = (await hint.boundingBox())!;
  const c = (await firstPanel.boundingBox())!;
  expect(h.y + h.height).toBeLessThanOrEqual(c.y);
  expect(c.y - (h.y + h.height)).toBeLessThan(48);
  expect(h.x).toBeLessThan(c.x + c.width);
  expect(h.x + h.width).toBeGreaterThan(c.x);
}

test.beforeEach(async ({ page, request, loginAs }) => {
  await seedTestkohorte(request);
  await loginAs('klinikleitung');
  await openSavedCohortAnalysis(page);
  await openTrajectories(page);
});

test('[Z0-P13] Hinweis ohne Interaktion sichtbar', async ({ page }) => {
  await setLayers(page, { 'Individuelle Kurven': true });
  const hint = trajectories(page).getByText(HINT_DE, { exact: true });
  await expect(hint).toHaveCount(1);
  await expectDirectlyAboveChart(page, hint);
});

test('[Z0-P13] Hinweis bei ausgeblendeten Einzelverläufen', async ({ page }) => {
  await setLayers(page, { 'Individuelle Kurven': false, Streupunkte: false });
  const hint = trajectories(page).getByText(HINT_OFF_DE, { exact: true });
  await expect(hint).toHaveCount(1);
  await expectDirectlyAboveChart(page, hint);
  await expect(trajectories(page).getByText(HINT_DE, { exact: true })).toHaveCount(0);
});

test('[Z0-P13] Englische Oberfläche', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('emd-locale', 'en'));
  await page.reload();
  await openTrajectories(page);
  await expect(page.locator('[role="tab"][aria-controls="analysis-tab-trajectories"]')).toHaveText(/Trajectories/);
  await setLayers(page, { 'Per-patient curves': true }, true);
  const hint = trajectories(page).getByText(HINT_EN, { exact: true });
  await expect(hint).toHaveCount(1);
  await expectDirectlyAboveChart(page, hint);
});
