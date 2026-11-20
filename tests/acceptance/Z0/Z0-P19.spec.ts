// Z0-P19 — Einzelfälle über die Rohdaten der Verläufe auswählen (acceptance/Z0/Z0-P19.feature).
// Synthetic data only.
// "Testkohorte" = saved cohort with age >= 70 (as in Z0-P09/Z0-P22), opened via "Outcomes anzeigen".
// "the raw data" = the first "outcomes-data-preview" on the Verläufe tab (Visus, the default metric), as in Z0-P10.
// "each value in the column 'Pseudonym' is a link" = every first-column cell of the table body holds exactly one
// element with role=link whose text is the cell's text.
// "Einzelfallansicht of that case" = route /case/<id> whose level-1 heading is the bare pseudonym (as in Z0-P09).
// "CSV exportieren" = the export button of that preview; "as before" = the CSV header row equals the table's column
// headers with "Pseudonym" first, and its Pseudonym column equals the table's pseudonym texts row by row (PLAN
// Z0-P19: CSV rows stay the unchanged plain-text arrays). "without link markup" = no cell of that column contains
// "http", "<a", "href" or "/case/".
import { readFile } from 'node:fs/promises';

import type { APIRequestContext, Locator, Page } from '@playwright/test';

import { apiToken, bearer } from '../../acceptance-at/helpers';
import { expect, test } from '../fixtures';

const COHORT = 'Testkohorte';
const FILTERS = { ageRange: [70, null] };

async function seedCohort(request: APIRequestContext): Promise<void> {
  const headers = bearer(await apiToken(request, 'klinikleitung'));
  const list = await request.get('/api/data/saved-searches', { headers });
  expect(list.status()).toBe(200);
  const { savedSearches } = (await list.json()) as { savedSearches: { id: string; name: string }[] };
  for (const s of savedSearches.filter((x) => x.name === COHORT)) {
    expect((await request.delete(`/api/data/saved-searches/${s.id}`, { headers })).status()).toBe(200);
  }
  const created = await request.post('/api/data/saved-searches', { headers, data: { name: COHORT, filters: FILTERS } });
  expect(created.status()).toBe(201);
}

function rawData(page: Page): Locator {
  return page.getByTestId('analysis-tab-trajectories').getByTestId('outcomes-data-preview').first();
}

function pseudonymCells(page: Page): Locator {
  return rawData(page).locator('table tbody tr td:first-child');
}

/** Minimal CSV parser for the app's format: every cell quoted, '""' escapes, BOM, '\n' rows. */
function parseCsv(text: string): string[][] {
  const body = text.startsWith('\uFEFF') ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

test.beforeEach(async ({ page, request, loginAs }) => {
  await seedCohort(request);
  await loginAs('klinikleitung');
  await page.goto('/cohort');
  await page.getByRole('button', { name: /^Gespeicherte Suchen/ }).click();
  const row = page.locator('div.rounded-lg').filter({ has: page.getByText(COHORT, { exact: true }) });
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: 'Outcomes anzeigen', exact: true }).click();
  await page.waitForURL(/\/analysis\?/);
  await expect(page.getByTestId('analysis-active-cohort')).toContainText(COHORT);
  await page.getByRole('tab', { name: 'Verläufe', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Verläufe', exact: true })).toHaveAttribute('aria-selected', 'true');
  await rawData(page).getByText('Rohdaten anzeigen', { exact: true }).click();
  await expect(rawData(page)).toHaveAttribute('open', '');
  await expect(pseudonymCells(page).first()).toBeVisible();
});

test('[Z0-P19] Pseudonyme in den Rohdaten sind Links', async ({ page }) => {
  const cells = pseudonymCells(page);
  const n = await cells.count();
  expect(n).toBeGreaterThan(0);
  await expect(rawData(page).locator('table thead th').first()).toHaveText('Pseudonym');
  const cellTexts = (await cells.allInnerTexts()).map((s) => s.trim());
  const links = cells.getByRole('link');
  await expect(links, 'one link per value in the column "Pseudonym"').toHaveCount(n);
  const linkTexts = (await links.allInnerTexts()).map((s) => s.trim());
  expect(linkTexts).toEqual(cellTexts);
});

test('[Z0-P19] Einzelfallansicht aus den Rohdaten öffnen', async ({ page }) => {
  const first = pseudonymCells(page).first();
  const pseudonym = (await first.innerText()).trim();
  expect(pseudonym).not.toBe('');
  await first.getByRole('link').click();
  await page.waitForURL(/\/case\/[^/?#]+/);
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveText(pseudonym);
  await expect(heading.locator('xpath=..').getByText('Pseudonym', { exact: true })).toBeVisible();
});

test('[Z0-P19] CSV-Export bleibt unverändert', async ({ page }) => {
  const headers = (await rawData(page).locator('table thead th').allInnerTexts()).map((s) => s.trim());
  const tablePseudonyms = (await pseudonymCells(page).allInnerTexts()).map((s) => s.trim());

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    rawData(page).getByRole('button', { name: 'CSV exportieren', exact: true }).click(),
  ]);
  const path = await download.path();
  expect(path).not.toBeNull();
  const csv = parseCsv(await readFile(path!, 'utf8'));

  // Header row: the table headers (the UI renders them uppercase via CSS only), "Pseudonym" first.
  expect(csv[0][0]).toBe('Pseudonym');
  expect(csv[0].map((h) => h.toUpperCase())).toEqual(headers.map((h) => h.toUpperCase()));

  const column = csv.slice(1).map((r) => r[0]);
  expect(column).toEqual(tablePseudonyms);
  for (const value of column) {
    expect(value, `CSV pseudonym "${value}" is plain text`).not.toMatch(/http|<a|href|\/case\//i);
  }
});
