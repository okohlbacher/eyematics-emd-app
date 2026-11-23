// Z0-P15 — Vollständiger Titel der Abbildung „Veränderung zum Ausgangswert“ (acceptance/Z0/Z0-P15.feature).
// Synthetic data only.
// Readings (PLAN Z0-P15 §5 and the binding answers C12 b, Q29):
// - "any case with at least 2 visus measurements" = the first row of the cohort's Detailansicht (/cohort, all
//   patients); the precondition is asserted via the measured Visus dots of the first chart (as in Z0-P23).
// - "the second chart" = the chart card directly after the row holding the first chart (data-testid
//   "visus-crt-chart"); "titled" = the full text of that card's h3 heading (the info icon has no text content).
// - "I tick 'Kohorten-Referenz anzeigen'" = the header checkbox with that accessible name (as in Z0-P23).
// - "the UI language is English" = locale 'en' (localStorage `emd-locale`, as in Z0-P03/P05/P13) followed by a reload.
// - @visual proxy (full check in the browser pass): with the overlay on, the legend entries (`li` of the custom
//   legend) and the axis titles (`.recharts-label`) of the second chart equal the pre-change strings (added by the
//   operator after Z0-P15, release-check needs a test per scenario; legend/axis keys untouched by afab82e).
import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../fixtures';

const TITLE_DE = 'Veränderung von Visus und CRT zum Ausgangswert (jeweils erste Messung)';
const TITLE_EN = 'Change in visual acuity and CRT from baseline (first measurement of each)';

// Pre-change legend and axis strings of the baseline-change chart with the cohort overlay on (translations.ts).
const LEGEND_WITH_OVERLAY_DE = [
  'CRT %',
  'Kohorten-IQR CRT-Änderung (25.–75. Perz.)',
  'Kohorten-IQR Visus-Änderung (25.–75. Perz.)',
  'Kohorten-Median CRT-Änderung',
  'Kohorten-Median Visus-Änderung',
  'Visus %',
];
const AXIS_WITH_OVERLAY_DE = ['%', 'Monate seit Erstvisite'];

async function openCaseWithVisusSeries(page: Page): Promise<void> {
  await page.goto('/cohort');
  await page.getByRole('button', { name: 'Detailansicht', exact: true }).click();
  await page.locator('tbody tr').first().click();
  await page.waitForURL(/\/case\//);
  const chart = page.getByTestId('visus-crt-chart');
  await expect(chart).toBeVisible();
  await expect(chart.locator('circle[r="4"][fill="#10b981"]').nth(1)).toBeAttached();
}

function secondChartTitle(page: Page): Locator {
  const card = page.getByTestId('visus-crt-chart').locator('xpath=../..').locator('xpath=following-sibling::div[1]');
  return card.locator('xpath=./h3');
}

test.beforeEach(async ({ page, loginAs }) => {
  await loginAs('klinikleitung');
  await openCaseWithVisusSeries(page);
});

test('[Z0-P15] Vollständiger Titel ohne Kohortenvergleich', async ({ page }) => {
  const box = page.getByRole('checkbox', { name: 'Kohorten-Referenz anzeigen', exact: true });
  await expect(box).not.toBeChecked();
  await expect(secondChartTitle(page)).toHaveText(TITLE_DE);
});

test('[Z0-P15] Vollständiger Titel mit Kohortenvergleich', async ({ page }) => {
  const box = page.getByRole('checkbox', { name: 'Kohorten-Referenz anzeigen', exact: true });
  await box.check();
  await expect(box).toBeChecked();
  await expect(secondChartTitle(page)).toHaveText(TITLE_DE);
});

test('[Z0-P15] Englische Oberfläche', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('emd-locale', 'en'));
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Show cohort reference', exact: true })).toBeVisible();
  await expect(secondChartTitle(page)).toHaveText(TITLE_EN);
});

test('[Z0-P15] Legende und Achsenbeschriftung bleiben unverändert', async ({ page }) => {
  const box = page.getByRole('checkbox', { name: 'Kohorten-Referenz anzeigen', exact: true });
  await box.check();
  await expect(box).toBeChecked();
  const chart = secondChartTitle(page).locator('xpath=..');
  const legend = chart.locator('ul li');
  await expect(legend).toHaveCount(LEGEND_WITH_OVERLAY_DE.length);
  expect([...(await legend.allTextContents())].map((s) => s.trim()).sort()).toEqual(LEGEND_WITH_OVERLAY_DE);
  const axis = chart.locator('.recharts-label');
  await expect(axis.first()).toBeVisible();
  expect([...(await axis.allTextContents())].map((s) => s.trim()).sort()).toEqual(AXIS_WITH_OVERLAY_DE);
});
