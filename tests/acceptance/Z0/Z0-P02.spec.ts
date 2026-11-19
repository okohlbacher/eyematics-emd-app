// Z0-P02 — Gespeicherte Kohorten erkennbar laden (acceptance/Z0/Z0-P02.feature). Synthetic data only.
// Tooltips use the shared hover/focus tooltip (PLAN "Decisions applied" Z0-P02, Q12 a): the test hovers the control
// and asserts the rendered, visible role="tooltip" element (hidden before the hover) and its text.
import type { APIRequestContext, Locator, Page } from '@playwright/test';

import { apiToken, bearer, filterGroup } from '../../acceptance-at/helpers';
import { expect, test } from '../fixtures';

const COHORT = 'Testkohorte';
const LOAD_LABEL = `Kohorte „${COHORT}“ laden`;

/** Background "a saved cohort 'Testkohorte' exists with the 'Alter' filter 'Min' '70'": exactly one such cohort. */
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

function savedSearchesButton(page: Page, label: RegExp = /^Gespeicherte Suchen/): Locator {
  return page.getByRole('button', { name: label });
}

function cohortRow(page: Page): Locator {
  return page.locator('div.rounded-lg').filter({ has: page.getByText(COHORT, { exact: true }) });
}

/** Hovers `control` and asserts that exactly its tooltip becomes visible with `text` (and was hidden before). */
async function expectHoverTooltip(page: Page, control: Locator, text: string): Promise<void> {
  const visibleTooltips = page.locator('[role="tooltip"]:visible');
  await page.mouse.move(0, 0);
  await expect(visibleTooltips).toHaveCount(0);
  await control.hover();
  await expect(visibleTooltips).toHaveCount(1);
  await expect(visibleTooltips).toHaveText(text);
}

function ageMin(page: Page): Locator {
  return filterGroup(page, 'Alter (Jahre)').getByPlaceholder('Min');
}

test.beforeEach(async ({ page, request, loginAs }) => {
  await seedTestkohorte(request);
  await loginAs('klinikleitung');
  await page.goto('/cohort');
  await page.getByRole('button', { name: 'Zurücksetzen' }).click();
});

test('[Z0-P02] Schaltfläche der gespeicherten Suchen erklärt sich selbst', async ({ page }) => {
  const button = savedSearchesButton(page);
  await expectHoverTooltip(page, button, 'Gespeicherte Kohorten anzeigen und laden');
  await expect(button).toHaveAccessibleDescription('Gespeicherte Kohorten anzeigen und laden');
  // Q12 a: the same tooltip also appears on keyboard focus.
  await page.mouse.move(0, 0);
  await button.focus();
  await expect(page.locator('[role="tooltip"]:visible')).toHaveText('Gespeicherte Kohorten anzeigen und laden');
});

test('[Z0-P02] Lade-Schaltfläche nennt Aktion und Kohorte', async ({ page }) => {
  await savedSearchesButton(page).click();
  const row = cohortRow(page);
  await expect(row).toHaveCount(1);
  const load = row.getByRole('button', { name: LOAD_LABEL, exact: true });
  await expect(load).toHaveCount(1);
  await expectHoverTooltip(page, load, LOAD_LABEL);

  // "No button in the row is labelled only 'Ausführen'" — neither by accessible name nor by tooltip.
  await expect(row.getByRole('button', { name: 'Ausführen', exact: true })).toHaveCount(0);
  await expect(row.locator('button[title="Ausführen"]')).toHaveCount(0);
});

test('[Z0-P02] Laden ersetzt die aktuellen Filter durch die gespeicherten', async ({ page }) => {
  await ageMin(page).fill('50');
  await expect(ageMin(page)).toHaveValue('50');
  await savedSearchesButton(page).click();
  await cohortRow(page).getByRole('button', { name: LOAD_LABEL, exact: true }).click();
  await expect(ageMin(page)).toHaveValue('70');
  // Q2 (a): status line "Geladene Kohorte: <Name>" above the filters.
  await expect(page.getByText(`Geladene Kohorte: ${COHORT}`, { exact: true })).toBeVisible();
  // Q2 a: the line disappears on the next filter change.
  await ageMin(page).fill('71');
  await expect(page.getByText(`Geladene Kohorte: ${COHORT}`, { exact: true })).toHaveCount(0);
});

test('[Z0-P02] Englische Oberfläche', async ({ page }) => {
  await page.getByRole('button', { name: 'English', exact: true }).click();
  const button = savedSearchesButton(page, /^Saved Searches/);
  await expectHoverTooltip(page, button, 'Show and load saved cohorts');
});
