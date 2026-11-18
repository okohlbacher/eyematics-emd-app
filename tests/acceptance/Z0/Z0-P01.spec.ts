// Z0-P01 — Altersfilter ohne automatisch eingetragene Obergrenze (acceptance/Z0/Z0-P01.feature). Synthetic data only.
import type { Locator, Page } from '@playwright/test';

import { cohortCount, filterGroup } from '../../acceptance-at/helpers';
import { expect, test } from '../fixtures';

function ageField(page: Page, bound: 'Min' | 'Max'): Locator {
  return filterGroup(page, 'Alter (Jahre)').getByPlaceholder(bound);
}

/** Ages (column "Alter") of every row of the "Detailansicht" result table on /cohort. */
async function resultAges(page: Page): Promise<number[]> {
  const toggle = page.getByRole('button', { name: 'Detailansicht' });
  if (await toggle.isVisible()) await toggle.click();
  const table = page.locator('table').first();
  const headers = (await table.locator('thead th').allInnerTexts()).map((h) => h.trim().toLowerCase());
  const col = headers.indexOf('alter');
  expect(col, 'result table has an "Alter" column').toBeGreaterThanOrEqual(0);
  const cells = await table.locator(`tbody tr td:nth-child(${col + 1})`).allInnerTexts();
  return cells.map((c) => Number(c.trim()));
}

async function expectResultAges(page: Page, min: number | null, max: number | null): Promise<void> {
  const n = await cohortCount(page);
  expect(n, 'the synthetic data contains matching cases').toBeGreaterThan(0);
  const ages = await resultAges(page);
  expect(ages.length, 'every result case is listed').toBe(n);
  for (const a of ages) {
    expect(Number.isFinite(a), `age "${a}" is numeric`).toBe(true);
    if (min !== null) expect(a, `age ${a} ≥ ${min}`).toBeGreaterThanOrEqual(min);
    if (max !== null) expect(a, `age ${a} ≤ ${max}`).toBeLessThanOrEqual(max);
  }
}

test.beforeEach(async ({ page, loginAs }) => {
  await loginAs('klinikleitung');
  await page.goto('/cohort');
  await page.getByRole('button', { name: 'Zurücksetzen' }).click();
  expect(await cohortCount(page)).toBeGreaterThan(0);
});

test('[Z0-P01] Untergrenze trägt keine Obergrenze ein', async ({ page }) => {
  await ageField(page, 'Min').fill('70');
  await expect(ageField(page, 'Max')).toHaveValue('');
  await expect(ageField(page, 'Max')).not.toHaveValue(/120/);
});

test('[Z0-P01] Nur Untergrenze filtert ab der Untergrenze', async ({ page }) => {
  await ageField(page, 'Min').fill('70');
  // "I leave the Max field empty": the field must be (and stay) empty.
  await ageField(page, 'Max').fill('');
  await expect(ageField(page, 'Max')).toHaveValue('');
  await expectResultAges(page, 70, null);
  await expect(filterGroup(page, 'Alter (Jahre)').getByRole('alert')).toHaveCount(0);
  await expect(page.locator('#age-range-validation')).toHaveCount(0);
});

test('[Z0-P01] Eigene Obergrenze ohne vorheriges Löschen eingeben', async ({ page }) => {
  await ageField(page, 'Min').fill('70');
  const max = ageField(page, 'Max');
  // Type (not fill): append to whatever the field holds, as a user would, without clearing it first.
  await max.click();
  await max.press('End');
  await max.pressSequentially('85');
  await expect(max).toHaveValue('85');
  await expectResultAges(page, 70, 85);
});

test('[Z0-P01] Nur Obergrenze filtert bis zur Obergrenze', async ({ page }) => {
  await ageField(page, 'Max').fill('60');
  await expect(ageField(page, 'Min')).toHaveValue('');
  await expectResultAges(page, null, 60);
});
