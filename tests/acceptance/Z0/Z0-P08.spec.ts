// Z0-P08 — Mouseover der Verläufe wie in der Einzelfallansicht (acceptance/Z0/Z0-P08.feature). Synthetic data only.
// Readings (PLAN Z0-P08 §3/§5 and the binding answers C9 "yes", Q8, Q33 b, Q34 "keep"):
// - "the tooltip" = the median axis tooltip of a Verläufe chart card: the shared box `[data-testid="chart-tooltip"]`
//   inside the Recharts tooltip wrapper of that card; its heading = `[data-tooltip-heading]`, rows = `[data-tooltip-row]`.
// - "hover over the median point at x = n" / "hover over the chart at x = n" = move the mouse across the plot of the
//   chart card until the axis tooltip shows the grid row whose x-value (the last integer of the heading) is n. The
//   cards are tried in the order OD, OS, gemeinsam; the first card whose x = n row has a "Testkohorte" row is used.
// - "a median point of Testkohorte is highlighted at x" = the Recharts active dot of the Testkohorte median line,
//   which carries `data-median-active`, `data-series` (cohort name) and `data-x`; "median points of Testkohorte" = the
//   points of that line, each `[data-median-point][data-series="Testkohorte"]` with `data-x` (PLAN §5 data-x hook).
// - "hover over any median point of Testkohorte" (time axis) = move the mouse to the pixel position of the middle
//   Testkohorte median point of the OD card; the step's Then concerns the heading only.
// - "the legend colour of Testkohorte" = the computed background colour of its legend swatch in the same card; the
//   row's colour = the computed colour of the row label.
// - "Diagramm-Anzeige" = the settings aside "Einstellungen"; the x-axis = radio group "x-axis".
// - @visual "Hervorhebung des Messpunkts wie in der Einzelfallansicht": browser pass. DOM proxy: the active dot is a
//   circle with r = 4, white 2 px ring and the cohort colour (the case view's active point is Recharts' default dot,
//   r = 4, white 2 px ring, series colour), and the tooltip is the shared box `chart-tooltip` of the case view.
import type { APIRequestContext, Locator, Page } from '@playwright/test';

import { apiToken, bearer } from '../../acceptance-at/helpers';
import { expect, test } from '../fixtures';

const COHORTS = {
  Testkohorte: { ageRange: [70, null] },
  Vergleichskohorte: { ageRange: [null, 60] },
} as const;
type CohortName = keyof typeof COHORTS;
const TEST = 'Testkohorte';

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

async function openSavedCohortAnalysis(page: Page, name: CohortName): Promise<void> {
  await page.goto('/cohort');
  await page.getByRole('button', { name: /^Gespeicherte Suchen/ }).click();
  await expect(savedRow(page, name)).toHaveCount(1);
  await savedRow(page, name).getByRole('button', { name: 'Outcomes anzeigen', exact: true }).click();
  await page.waitForURL(/\/analysis\?/);
}

async function openTab(page: Page, name: 'Verläufe'): Promise<void> {
  await page.getByRole('tab', { name, exact: true }).click();
  await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
}

function trajectoriesPanel(page: Page): Locator {
  return page.getByTestId('analysis-tab-trajectories');
}

function optionRow(drawer: Locator, name: string): Locator {
  return drawer.locator('label').filter({
    has: drawer.page().locator('[data-compare-option-label]', { hasText: new RegExp(`^${name} \\(N=`) }),
  });
}

/** Compare the active cohort with exactly one other saved cohort (the preselected "Alle Patienten" is unticked). */
async function compareWith(page: Page, other: CohortName): Promise<void> {
  await page.getByRole('button', { name: 'Kohorten vergleichen', exact: true }).click();
  const d = page.getByRole('complementary', { name: 'Kohorten vergleichen', exact: true });
  await expect(d.getByRole('checkbox').first()).toBeVisible();
  const all = optionRow(d, 'Alle Patienten').getByRole('checkbox');
  // Opening the drawer from the single-cohort view preselects "Alle Patienten" through an async URL transition
  // (Z0-P05, compareSelection.ts openCompare); wait for it before unticking, otherwise the late preselection
  // re-ticks the box after the uncheck (flaky race, Z0 deviation 20).
  await expect(all).toBeChecked();
  await all.uncheck();
  await optionRow(d, other).getByRole('checkbox').check();
  await expect(optionRow(d, other).getByRole('checkbox')).toBeChecked();
  await expect(all).not.toBeChecked();
  await page.keyboard.press('Escape');
}

async function openMetric(page: Page, metric: 'visus' | 'crt'): Promise<void> {
  await page.getByTestId(`metric-tab-${metric}`).click();
  await expect(page.getByTestId(`metric-tab-${metric}`)).toHaveAttribute('aria-selected', 'true');
}

/** Choose the x-axis radio `label` in "Diagramm-Anzeige" and close the aside. */
async function setXAxis(page: Page, label: 'Anzahl Behandlungen' | 'Tage seit Baseline'): Promise<void> {
  await page.getByRole('button', { name: 'Diagramm-Anzeige', exact: true }).click();
  const settings = page.getByRole('complementary', { name: 'Einstellungen', exact: true });
  const radio = settings.getByRole('radio', { name: label, exact: true });
  await expect(radio).toBeVisible();
  await radio.check();
  await expect(radio).toBeChecked();
  await page.keyboard.press('Escape');
}

function chartCards(page: Page): Locator[] {
  const p = trajectoriesPanel(page);
  return ['od', 'os', 'combined'].map((eye) => p.locator(`[data-testid="outcomes-panel-${eye}"][role="img"]`));
}

function axisTooltip(card: Locator): Locator {
  return card.locator('.recharts-tooltip-wrapper [data-testid="chart-tooltip"]');
}

/** The x value the axis tooltip shows after moving the mouse to plot pixel `px` (null: no tooltip shown). */
async function xAt(page: Page, card: Locator, px: number, ys: number[]): Promise<number | null> {
  for (const y of ys) {
    await page.mouse.move(px, y);
    const tip = axisTooltip(card);
    try {
      await expect(tip).toBeVisible({ timeout: 1_500 });
    } catch {
      continue;
    }
    const heading = (await tip.locator('[data-tooltip-heading]').textContent()) ?? '';
    const m = /(-?\d+(?:[.,]\d+)?)\s*$/.exec(heading.trim());
    if (m) return Math.round(Number(m[1].replace(',', '.')));
  }
  return null;
}

/** Move the mouse over the plot of `card` until the axis tooltip shows x = `target`; false if no such row exists. */
async function hoverAtX(page: Page, card: Locator, target: number): Promise<boolean> {
  const grid = card.locator('.recharts-cartesian-grid').first();
  await expect(grid).toBeVisible({ timeout: 30_000 });
  const box = (await grid.boundingBox())!;
  const ys = [box.y + 2, box.y + 8, box.y + box.height / 2];
  let lo = Math.ceil(box.x + 1);
  let hi = Math.floor(box.x + box.width - 1);
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = await xAt(page, card, mid, ys);
    if (v === null) return false;
    if (v === target) return true;
    if (v < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return false;
}

/** The first chart card (OD, OS, gemeinsam) whose x = `target` tooltip has a Testkohorte row; the mouse stays there. */
async function hoverTestkohorteAtX(page: Page, target: number): Promise<Locator> {
  const cards = chartCards(page);
  await expect(cards[0]).toBeVisible({ timeout: 30_000 });
  for (const card of cards) {
    if ((await card.count()) === 0) continue;
    if (!(await hoverAtX(page, card, target))) continue;
    const rows = axisTooltip(card).locator('[data-tooltip-row]').filter({ hasText: new RegExp(`^${TEST}\\b`) });
    if ((await rows.count()) > 0) return card;
  }
  throw new Error(`no chart card shows a ${TEST} median at x = ${target}`);
}

async function legendSwatchColour(card: Locator, name: CohortName): Promise<string> {
  const entry = card.locator('.legend .legendtext').filter({ hasText: new RegExp(`^${name} \\(N=`) }).first();
  await expect(entry).toBeVisible();
  const swatch = entry.locator('xpath=ancestor::li[1]').locator('[data-legend-swatch]').first();
  return swatch.evaluate((el) => getComputedStyle(el).backgroundColor);
}

test.beforeEach(async ({ page, request, loginAs }) => {
  await seedCohorts(request);
  await loginAs('klinikleitung');
  await openSavedCohortAnalysis(page, 'Testkohorte');
  await openTab(page, 'Verläufe');
  await compareWith(page, 'Vergleichskohorte');
  await openMetric(page, 'crt');
  await setXAxis(page, 'Anzahl Behandlungen');
});

test('[Z0-P08] Kopfzeile des Mouseovers nennt Achse und x-Wert', async ({ page }) => {
  const card = await hoverTestkohorteAtX(page, 5);
  await expect(axisTooltip(card).locator('[data-tooltip-heading]')).toHaveText('Anzahl Behandlungen: 5');
});

test('[Z0-P08] Zeilen des Mouseovers sind beschriftet und der Kohorte zugeordnet', async ({ page }) => {
  const card = await hoverTestkohorteAtX(page, 5);
  const row = axisTooltip(card).locator('[data-tooltip-row]').filter({ hasText: /^Testkohorte · Median/ });
  await expect(row).toHaveCount(1);
  // The value carries the unit µm: "Testkohorte · Median: <Zahl> µm".
  await expect(row).toHaveText(/^Testkohorte · Median: -?[\d.,]+ µm$/);
  const rowColour = await row.locator('span').first().evaluate((el) => getComputedStyle(el).color);
  expect(rowColour).toBe(await legendSwatchColour(card, 'Testkohorte'));
});

test('[Z0-P08] Exakter Messpunkt bei ganzzahliger Behandlungsanzahl', async ({ page }) => {
  const card = await hoverTestkohorteAtX(page, 5);
  const active = card.locator(`.recharts-active-dot [data-median-active][data-series="${TEST}"]`);
  await expect(active).toHaveCount(1);
  await expect(active).toHaveAttribute('data-x', '5');
  const xs = await card
    .locator(`[data-median-point][data-series="${TEST}"]`)
    .evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-x'))));
  expect(xs, 'the Testkohorte median line has a point at x = 5').toContain(5);
  expect(xs.filter((x) => x > 4 && x < 5), 'no Testkohorte median point between x = 4 and x = 5').toEqual([]);
});

test('[Z0-P08] Zeitachse im Mouseover', async ({ page }) => {
  await setXAxis(page, 'Tage seit Baseline');
  // "any median point of Testkohorte": the middle point of its median line in the OD card (data-x hook), hovered at
  // its own pixel position.
  const card = chartCards(page)[0];
  const points = card.locator(`[data-median-point][data-series="${TEST}"]`);
  await expect(points.first()).toBeAttached({ timeout: 30_000 });
  const point = points.nth(Math.floor((await points.count()) / 2));
  const svgBox = (await card.locator('svg.recharts-surface').first().boundingBox())!;
  await page.mouse.move(svgBox.x + Number(await point.getAttribute('cx')), svgBox.y + Number(await point.getAttribute('cy')));
  const tip = axisTooltip(card);
  await expect(tip).toBeVisible();
  await expect(tip.locator('[data-tooltip-heading]')).toHaveText(/^Tage seit Baseline: /);
});

test('[Z0-P08] Hervorhebung des Messpunkts wie in der Einzelfallansicht', async ({ page }) => {
  // @visual — DOM proxy; the visual comparison with the case view is in the browser pass.
  const card = await hoverTestkohorteAtX(page, 5);
  const active = card.locator(`.recharts-active-dot [data-median-active][data-series="${TEST}"]`);
  await expect(active).toHaveCount(1);
  await expect(active).toHaveAttribute('r', '4');
  await expect(active).toHaveAttribute('stroke', '#fff');
  await expect(active).toHaveAttribute('stroke-width', '2');
  const fill = await active.evaluate((el) => getComputedStyle(el).fill);
  expect(fill).toBe(await legendSwatchColour(card, 'Testkohorte'));
  await expect(axisTooltip(card)).toHaveCount(1);
});
