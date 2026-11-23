// Z0-P16 — Filter der Datenqualität an einer Stelle (acceptance/Z0/Z0-P16.feature). Synthetic data only.
// Readings (PLAN Z0-P16 and the binding answers Q14 a/b, C13, Q25 a):
// - "one region labelled Filterkriterien" = exactly one landmark getByRole('region', { name: 'Filterkriterien' }).
// - The region is collapsible (Q14 b); its toggle keeps title "Filterkriterien" (C13). The test opens it before
//   checking the contained controls, as AT-QUAL's openFilters does.
// - Filter controls of the case list = Zeitraum (time-range buttons), Prüfstatus, Zentrum, Therapiestatus, CRT-Wert,
//   "Ausgeschlossene anzeigen" (Q14 a) and the search field "Pseudonym suchen...". "Outside" is checked over the
//   page's <main>: every select except the "Kohorte" one, every text search input, every time-range button and the
//   Zentrum/Ausgeschlossene controls lie inside the region.
// - "control labelled Kohorte" = getByLabel('Kohorte', { exact: true }) (accessible name exactly "Kohorte").
// - "directly next to the region" = the Kohorte control and the region share a row (vertical overlap) and the
//   horizontal gap between them is at most 32 px with no other control in between, or they are stacked with a
//   vertical gap of at most 32 px.
// - "Testkohorte" = saved search (age ≥ 70), seeded as in Z0-P22; it contains interrupter (UB) cases in the
//   synthetic data at the pinned reference date.
import type { APIRequestContext, Locator, Page } from '@playwright/test';

import { apiToken, bearer } from '../../acceptance-at/helpers';
import { expect, test } from '../fixtures';

const TESTKOHORTE = { name: 'Testkohorte', filters: { ageRange: [70, null] } } as const;

async function seedTestkohorte(request: APIRequestContext): Promise<void> {
  const headers = bearer(await apiToken(request, 'klinikleitung'));
  const list = await request.get('/api/data/saved-searches', { headers });
  expect(list.status()).toBe(200);
  const { savedSearches } = (await list.json()) as { savedSearches: { id: string; name: string }[] };
  for (const s of savedSearches.filter((x) => x.name === TESTKOHORTE.name)) {
    expect((await request.delete(`/api/data/saved-searches/${s.id}`, { headers })).status()).toBe(200);
  }
  const created = await request.post('/api/data/saved-searches', { headers, data: TESTKOHORTE });
  expect(created.status()).toBe(201);
}

async function openQuality(page: Page): Promise<void> {
  await page.goto('/quality');
  await expect(page.getByRole('heading', { name: 'Datenqualität', level: 1 })).toBeVisible();
}

const filterRegion = (page: Page) => page.getByRole('region', { name: 'Filterkriterien', exact: true });
const cohortControl = (page: Page) => page.getByLabel('Kohorte', { exact: true });

/** Opens the collapsible part of the region (Q14 b) if it is closed. */
async function openRegion(page: Page): Promise<Locator> {
  const region = filterRegion(page);
  await expect(region).toHaveCount(1);
  const status = region.locator('label', { hasText: 'Prüfstatus' });
  if (!(await status.isVisible())) await region.getByTitle('Filterkriterien').click();
  await expect(status).toBeVisible();
  return region;
}

/** The select belonging to a filter label ("<label>" followed by its select, as in AT-QUAL setFilter). */
const filterSelect = (scope: Locator, label: string) =>
  scope.locator('label', { hasText: label }).locator('xpath=..').locator('select');

const caseRows = (page: Page) => page.locator('button').filter({ has: page.locator('p.font-mono') });

test.beforeEach(async ({ loginAs, page }) => {
  await loginAs('klinikleitung');
  await openQuality(page);
});

test('[Z0-P16] Alle Filter in einem Filterbereich', async ({ page }) => {
  const region = await openRegion(page);

  // Then: Zeitraum, Prüfstatus, Therapiestatus, CRT-Wert and the search field are inside the region.
  await expect(region.getByText(/^Zeitraum:?$/)).toBeVisible();
  for (const label of ['Prüfstatus', 'Therapiestatus', 'CRT-Wert']) {
    await expect(filterSelect(region, label), `select "${label}" in the region`).toHaveCount(1);
    await expect(filterSelect(region, label)).toBeVisible();
  }
  await expect(region.getByPlaceholder('Pseudonym suchen...')).toHaveCount(1);
  await expect(region.getByPlaceholder('Pseudonym suchen...')).toBeVisible();

  // And: no filter control of the case list lies outside the region.
  const main = page.locator('main');
  const cohort = cohortControl(page);
  // Every form field (select, any input incl. checkboxes and date inputs) except "Kohorte" lies in the region.
  const fieldsOutside = await main.locator('select, input, textarea').evaluateAll(
    (els, regionLabel) =>
      els
        .filter((el) => {
          const inRegion = el.closest(`[role="region"][aria-label="${regionLabel}"], section[aria-label="${regionLabel}"]`);
          const label = (el as HTMLSelectElement).labels?.[0]?.textContent?.trim();
          return !inRegion && label !== 'Kohorte';
        })
        .map((el) => el.outerHTML.slice(0, 120)),
    'Filterkriterien',
  );
  expect(fieldsOutside, 'filter fields outside the region "Filterkriterien"').toEqual([]);
  await expect(cohort).toHaveCount(1);

  await expect(main.getByPlaceholder('Pseudonym suchen...'), 'search fields on the page').toHaveCount(1);
  for (const time of ['Letzte 3 Monate', 'Letzte 6 Monate', 'Letztes Jahr', 'Gesamter Zeitraum', 'Benutzerdefiniert']) {
    const all = main.getByRole('button', { name: time, exact: true });
    const inside = region.getByRole('button', { name: time, exact: true });
    expect(await all.count(), `time-range button "${time}" on the page`).toBe(await inside.count());
  }
  for (const text of ['Zentrum', 'Ausgeschlossene anzeigen']) {
    const total = await main.locator('label', { hasText: text }).count();
    const inside = await region.locator('label', { hasText: text }).count();
    expect(inside, `"${text}" inside the region`).toBeGreaterThan(0);
    expect(total, `"${text}" outside the region`).toBe(inside);
  }
});

test('[Z0-P16] Kohortenauswahl bleibt eine einzelne Schaltfläche', async ({ page }) => {
  // Then exactly 1 control labelled "Kohorte".
  await expect(cohortControl(page)).toHaveCount(1);
  await expect(cohortControl(page)).toBeVisible();

  // And it is placed directly next to the region "Filterkriterien".
  const region = filterRegion(page);
  await expect(region).toHaveCount(1);
  const c = (await cohortControl(page).boundingBox())!;
  const r = (await region.boundingBox())!;
  expect(c, 'Kohorte control has a box').not.toBeNull();
  expect(r, 'region has a box').not.toBeNull();

  const verticalOverlap = Math.min(c.y + c.height, r.y + r.height) - Math.max(c.y, r.y);
  const horizontalOverlap = Math.min(c.x + c.width, r.x + r.width) - Math.max(c.x, r.x);
  const hGap = Math.max(r.x - (c.x + c.width), c.x - (r.x + r.width));
  const vGap = Math.max(r.y - (c.y + c.height), c.y - (r.y + r.height));
  const sideBySide = verticalOverlap > 0 && hGap >= 0 && hGap <= 32;
  const stacked = horizontalOverlap > 0 && vGap >= 0 && vGap <= 32;
  expect(sideBySide || stacked, `Kohorte ${JSON.stringify(c)} next to region ${JSON.stringify(r)}`).toBe(true);

  if (sideBySide) {
    // No other interactive control between them on that row.
    const [left, right] = c.x < r.x ? [c.x + c.width, r.x] : [r.x + r.width, c.x];
    const between = await page.locator('main').locator('button, select, input, a').evaluateAll(
      (els, b) =>
        els.filter((el) => {
          const box = el.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) return false;
          const cx = box.x + box.width / 2;
          const cy = box.y + box.height / 2;
          return cx > b.left && cx < b.right && cy > b.top && cy < b.bottom;
        }).length,
      { left, right, top: Math.max(c.y, r.y), bottom: Math.min(c.y + c.height, r.y + r.height) },
    );
    expect(between, 'controls between "Kohorte" and the region').toBe(0);
  }
});

test('[Z0-P16] Filter wirken weiterhin', async ({ page, request }) => {
  // Given a saved cohort "Testkohorte" exists.
  await seedTestkohorte(request);
  await openQuality(page);

  // When I choose "Testkohorte" in "Kohorte".
  await cohortControl(page).selectOption({ label: 'Testkohorte' });
  // And I choose "Therapieunterbrecher" in "Therapiestatus".
  const region = await openRegion(page);
  await filterSelect(region, 'Therapiestatus').selectOption({ label: 'Therapieunterbrecher' });

  // Then every case in the case list carries the badge "UB".
  const rows = caseRows(page);
  await expect(rows.first()).toBeVisible();
  const n = await rows.count();
  expect(n, 'the synthetic Testkohorte contains interrupters').toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    await expect(rows.nth(i).locator('span', { hasText: /^UB$/ }), `row ${i} carries "UB"`).toHaveCount(1);
  }
});
