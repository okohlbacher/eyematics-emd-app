// Z0-P23 — Kohortenvergleich im Tab Aggregiert und einheitliche Abbildungen (acceptance/Z0/Z0-P23.feature).
// Synthetic data only.
// Readings (PLAN Z0-P23 §5 and the binding answers C8, C11, C15, Q17, Q18, Q21, Q22, Q31, Q32):
// - "the drawer 'Kohorten vergleichen'" = the aside with that accessible name (Z0-P05). Each option row carries its
//   visible label "<Name> (N=<n> Patient:innen)" in [data-compare-option-label]; the primary row's marker
//   "Basis-Kohorte (fest)" is a separate badge, so the label format holds for every option.
// - "the legend" (Aggregiert and Verläufe) = the cohort legend entries `.legend .legendtext` (Z0-P05/Z0-P22); each entry
//   sits in an `li` with a colour swatch [data-legend-swatch].
// - "the diagnosis chart shows N cohorts" = N [data-cohort-series] groups in the card data-testid "compare-diagnosis";
//   "the age-versus-visus chart shows N series" = N Recharts scatter series (`.recharts-scatter`) in "compare-age-visus"
//   whose legend names them.
// - Axis labels are the visible SVG axis titles (`.recharts-label`). The case view's Visus/CRT chart is
//   data-testid "visus-crt-chart" (Q31: logMAR there).
// - Series hooks: Recharts className "series-median" (Verläufe median), "series-visus"/"series-crt" (case view).
// - Tooltips use one shared box data-testid "chart-tooltip": one [data-tooltip-heading] line, rows [data-tooltip-row].
// - The case-view selection (Q22) is an analogous panel: aside named "Vergleichskohorte wählen", opened by the button
//   "Kohorten vergleichen", radio options, "Alle Patienten" first.
// - Performance: time from the click on "Streuband (IQR)" until the IQR bands (`.recharts-area` in the Verläufe panels)
//   have changed and a frame has been painted, measured in the page with performance.now().
import type { APIRequestContext, Locator, Page } from '@playwright/test';

import { apiToken, bearer, cohortCount, filterGroup } from '../../acceptance-at/helpers';
import { expect, test } from '../fixtures';

const COHORTS = {
  Testkohorte: { ageRange: [70, null] },
  Vergleichskohorte: { ageRange: [null, 60] },
} as const;
type CohortName = keyof typeof COHORTS;

const OPTION_FORMAT = /^.+ \(N=\d+ Patient:innen\)$/;

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

async function openCohortAnalysis(page: Page, name: CohortName): Promise<void> {
  await page.goto('/cohort');
  await page.getByRole('button', { name: /^Gespeicherte Suchen/ }).click();
  await expect(savedRow(page, name)).toHaveCount(1);
  await savedRow(page, name).getByRole('button', { name: 'Outcomes anzeigen', exact: true }).click();
  await page.waitForURL(/\/analysis\?/);
  await expect(page.getByTestId('analysis-active-cohort')).toContainText(name);
}

async function openTab(page: Page, name: 'Verläufe' | 'Aggregiert'): Promise<void> {
  await page.getByRole('tab', { name, exact: true }).click();
  await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
}

function aggregatePanel(page: Page): Locator {
  return page.getByTestId('analysis-tab-aggregate');
}

function trajectoriesPanel(page: Page): Locator {
  return page.getByTestId('analysis-tab-trajectories');
}

function compareButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Kohorten vergleichen', exact: true });
}

function compareDrawer(page: Page): Locator {
  return page.getByRole('complementary', { name: 'Kohorten vergleichen', exact: true });
}

function caseCompareDrawer(page: Page): Locator {
  return page.getByRole('complementary', { name: 'Vergleichskohorte wählen', exact: true });
}

function optionLabels(drawer: Locator): Locator {
  return drawer.locator('[data-compare-option-label]');
}

function optionRow(drawer: Locator, name: string): Locator {
  return drawer.locator('label').filter({
    has: drawer.page().locator('[data-compare-option-label]', { hasText: new RegExp(`^${name} \\(N=`) }),
  });
}

async function openCompareDrawer(page: Page): Promise<Locator> {
  await compareButton(page).click();
  const d = compareDrawer(page);
  await expect(d.getByRole('checkbox').first()).toBeVisible();
  return d;
}

/** Compare the active cohort with exactly one other saved cohort (the preselected "Alle Patienten" is unticked). */
async function compareWith(page: Page, other: CohortName): Promise<void> {
  const d = await openCompareDrawer(page);
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

function legendEntry(scope: Locator, name: string): Locator {
  return scope.locator('.legend .legendtext').filter({ hasText: new RegExp(`^${name}\\b`) });
}

async function legendSwatchColour(scope: Locator, name: string): Promise<string> {
  const entry = legendEntry(scope, name).first();
  await expect(entry).toBeVisible();
  const swatch = entry.locator('xpath=ancestor::li[1]').locator('[data-legend-swatch]').first();
  return swatch.evaluate((el) => getComputedStyle(el).backgroundColor);
}

/** A case of "Testkohorte": Kohortenbildung → load the saved cohort → first table row. */
async function openCaseOfTestkohorte(page: Page): Promise<void> {
  await page.goto('/cohort');
  await page.getByRole('button', { name: 'Zurücksetzen' }).click();
  await page.getByRole('button', { name: /^Gespeicherte Suchen/ }).click();
  await savedRow(page, 'Testkohorte').getByRole('button', { name: 'Kohorte „Testkohorte“ laden', exact: true }).click();
  await expect(page.getByText('Geladene Kohorte: Testkohorte', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Detailansicht', exact: true }).click();
  await page.locator('tbody tr').first().click();
  await page.waitForURL(/\/case\//);
  await expect(page.getByTestId('visus-crt-chart')).toBeVisible();
}

async function setYAbsolute(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Diagramm-Anzeige', exact: true }).click();
  const settings = page.getByRole('complementary', { name: 'Einstellungen', exact: true });
  await settings.getByRole('radio', { name: /^Absolut/ }).check();
  await expect(settings.getByRole('radio', { name: /^Absolut/ })).toBeChecked();
  await page.keyboard.press('Escape');
}

async function openMetric(page: Page, metric: 'visus' | 'crt'): Promise<void> {
  await page.getByTestId(`metric-tab-${metric}`).click();
  await expect(page.getByTestId(`metric-tab-${metric}`)).toHaveAttribute('aria-selected', 'true');
}

function axisLabel(scope: Locator, text: string): Locator {
  return scope.locator('.recharts-label').filter({ hasText: new RegExp(`^${text.replace(/[()]/g, '\\$&')}$`) });
}

/** One tooltip box: exactly one heading line = the x-axis value (`heading`), every row "<Bezeichnung>: <Wert>". */
async function expectTooltipFormat(page: Page, heading: RegExp): Promise<Locator> {
  const tip = page.getByTestId('chart-tooltip').filter({ visible: true });
  await expect(tip).toHaveCount(1);
  await expect(tip.locator('[data-tooltip-heading]')).toHaveCount(1);
  await expect(tip.locator('[data-tooltip-heading]')).toHaveText(heading);
  const rows = tip.locator('[data-tooltip-row]');
  expect(await rows.count()).toBeGreaterThan(0);
  for (const row of await rows.all()) {
    await expect(row).toHaveText(/^[^:]+: \S.*$/);
  }
  return tip;
}

async function hoverPlotCentre(chart: Locator): Promise<void> {
  const grid = chart.locator('.recharts-cartesian-grid').first();
  await expect(grid).toBeVisible();
  const box = (await grid.boundingBox())!;
  await chart.page().mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
  await chart.page().mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.5);
}

test.beforeEach(async ({ page, request, loginAs }) => {
  await seedCohorts(request);
  await loginAs('klinikleitung');
  await openCohortAnalysis(page, 'Testkohorte');
});

test('[Z0-P23] Vergleich im Tab Aggregiert starten', async ({ page }) => {
  await openTab(page, 'Verläufe');
  await expect(compareButton(page)).toBeVisible();
  const onTrajectories = (await compareButton(page).boundingBox())!;
  await openTab(page, 'Aggregiert');
  await expect(compareButton(page)).toBeVisible();
  const onAggregate = (await compareButton(page).boundingBox())!;
  expect(Math.abs(onAggregate.x - onTrajectories.x), 'same x position').toBeLessThanOrEqual(2);
  expect(Math.abs(onAggregate.y - onTrajectories.y), 'same y position').toBeLessThanOrEqual(2);

  const d = await openCompareDrawer(page);
  await expect(d).toBeVisible();
  const primary = optionRow(d, 'Testkohorte');
  await expect(primary).toHaveCount(1);
  await expect(primary).toContainText('Basis-Kohorte (fest)');
  await expect(primary.getByRole('checkbox')).toBeChecked();
  await expect(primary.getByRole('checkbox')).toBeDisabled();
});

test('[Z0-P23] Aggregierte Abbildungen zeigen den Vergleich', async ({ page }) => {
  await openTab(page, 'Aggregiert');
  const d = await openCompareDrawer(page);
  const counts: Record<string, string> = {};
  for (const name of ['Testkohorte', 'Vergleichskohorte']) {
    const label = await optionRow(d, name).locator('[data-compare-option-label]').innerText();
    counts[name] = /\(N=(\d+) Patient:innen\)/.exec(label)![1];
  }
  await page.keyboard.press('Escape');
  await compareWith(page, 'Vergleichskohorte');

  const panel = aggregatePanel(page);
  for (const name of ['Testkohorte', 'Vergleichskohorte']) {
    await expect(legendEntry(panel, name)).toHaveText(`${name} (N=${counts[name]} Patient:innen)`);
  }
  const diagnosis = panel.getByTestId('compare-diagnosis');
  await expect(diagnosis.locator('[data-cohort-series]')).toHaveCount(2);
  const ageVisus = panel.getByTestId('compare-age-visus');
  await expect(ageVisus.locator('.recharts-scatter')).toHaveCount(2);
  await expect(ageVisus.locator('.recharts-legend-item-text')).toHaveText(['Testkohorte', 'Vergleichskohorte']);
});

test('[Z0-P23] Vergleich zurücksetzen im Tab Aggregiert', async ({ page }) => {
  await openTab(page, 'Aggregiert');
  await compareWith(page, 'Vergleichskohorte');
  const panel = aggregatePanel(page);
  await expect(legendEntry(panel, 'Vergleichskohorte')).toBeVisible();

  const d = await openCompareDrawer(page);
  await d.getByRole('button', { name: 'Einzelne Kohorte anzeigen', exact: true }).click();
  await expect(legendEntry(panel, 'Vergleichskohorte')).toHaveCount(0);
  await expect(panel.locator('[data-cohort-series]')).toHaveCount(0);
  await expect(panel.getByTestId('compare-age-visus')).toHaveCount(0);
  await expect(page.getByTestId('analysis-active-cohort')).toHaveText('Aktive Kohorte: Testkohorte');
  // The single-cohort charts are back and draw one series (the active cohort).
  await expect(panel.getByTestId('age-visus-chart').locator('.recharts-scatter')).toHaveCount(1);
  await expect(panel.getByTestId('visus-trend-chart').locator('.recharts-line')).toHaveCount(1);
});

test('[Z0-P23] Vergleichsauswahl gilt für beide Tabs', async ({ page }) => {
  await openTab(page, 'Aggregiert');
  await compareWith(page, 'Vergleichskohorte');
  await openTab(page, 'Verläufe');
  await expect(trajectoriesPanel(page).getByTestId('outcomes-subtitle')).toHaveText(/^2 Kohorten verglichen/);
  await openTab(page, 'Aggregiert');
  await expect(legendEntry(aggregatePanel(page), 'Vergleichskohorte')).toBeVisible();
});

test('[Z0-P23] Gleiche Kohortenfarben in Aggregiert und Verläufe', async ({ page }) => {
  await openTab(page, 'Aggregiert');
  await compareWith(page, 'Vergleichskohorte');
  const aggregate = {
    Testkohorte: await legendSwatchColour(aggregatePanel(page), 'Testkohorte'),
    Vergleichskohorte: await legendSwatchColour(aggregatePanel(page), 'Vergleichskohorte'),
  };
  expect(aggregate.Testkohorte).not.toBe(aggregate.Vergleichskohorte);
  await openTab(page, 'Verläufe');
  await openMetric(page, 'visus');
  expect(await legendSwatchColour(trajectoriesPanel(page), 'Testkohorte')).toBe(aggregate.Testkohorte);
  expect(await legendSwatchColour(trajectoriesPanel(page), 'Vergleichskohorte')).toBe(aggregate.Vergleichskohorte);
});

test('[Z0-P23] Gleiche Achsenbeschriftung in Verläufe und Einzelfallansicht', async ({ page }) => {
  await openTab(page, 'Verläufe');
  await openMetric(page, 'visus');
  await setYAbsolute(page);
  const od = trajectoriesPanel(page).getByTestId('outcomes-panel-od');
  await expect(axisLabel(od, 'Visus (logMAR)')).toHaveCount(1);
  await openMetric(page, 'crt');
  await expect(axisLabel(trajectoriesPanel(page).getByTestId('outcomes-panel-od'), 'Netzhautdicke (µm)')).toHaveCount(1);

  await openCaseOfTestkohorte(page);
  const chart = page.getByTestId('visus-crt-chart');
  await expect(axisLabel(chart, 'Visus (logMAR)')).toHaveCount(1);
  await expect(axisLabel(chart, 'Netzhautdicke (µm)')).toHaveCount(1);
});

test('[Z0-P23] Gleiche Bezeichnung des Kohorten-Medians in Verläufe und Einzelfallansicht', async ({ page }) => {
  await openTab(page, 'Verläufe');
  await openMetric(page, 'crt');
  await expect(legendEntry(trajectoriesPanel(page), 'Kohorten-Median CRT').first()).toBeVisible();
  await expect(legendEntry(trajectoriesPanel(page), 'Kohorten-Median CRT').first()).toHaveText('Kohorten-Median CRT');

  await openCaseOfTestkohorte(page);
  await page.getByRole('checkbox', { name: 'Kohorten-Referenz anzeigen', exact: true }).check();
  const chart = page.getByTestId('visus-crt-chart');
  await expect(chart.getByText('Kohorten-Median CRT', { exact: true })).toBeVisible();
});

test('[Z0-P23] Gleiches Mouseover-Format in Aggregiert, Verläufe und Einzelfallansicht', async ({ page }) => {
  await openTab(page, 'Aggregiert');
  const ageVisus = aggregatePanel(page).getByTestId('age-visus-chart');
  const point = ageVisus.locator('.recharts-scatter-symbol').first();
  await expect(point).toBeVisible();
  await point.hover({ force: true });
  // x axis = age.
  await expectTooltipFormat(page, /^Alter: \d+ J\.$/);

  await openTab(page, 'Verläufe');
  await openMetric(page, 'visus');
  await hoverPlotCentre(trajectoriesPanel(page).getByTestId('outcomes-panel-od'));
  // x axis = days; the hovered point is a median point (its row names the cohort median).
  // Heading "<x-axis label>: <x>" since Z0-P08 (Q33 b, NF 2026-11-20; was /^Tag -?\d+$/).
  const verlaeufeTip = await expectTooltipFormat(page, /^Tage seit Baseline: -?\d+$/);
  await expect(verlaeufeTip.locator('[data-tooltip-row]').filter({ hasText: /^Kohorten-Median Visus: / })).toHaveCount(1);

  await openCaseOfTestkohorte(page);
  // A visus point = a dot of the measured Visus curve (case-view Visus colour).
  const visusPoint = page.getByTestId('visus-crt-chart').locator('circle[r="4"][fill="#10b981"]').first();
  await expect(visusPoint).toBeVisible();
  await visusPoint.hover({ force: true });
  // x axis = calendar date (the cohort reference is off).
  await expectTooltipFormat(page, /^\d{1,2}\.\d{1,2}\.\d{4}$/);
});

test('[Z0-P23] Gleiche Kohortenauswahl in Aggregiert, Verläufe und Einzelfallansicht', async ({ page }) => {
  const lists: string[][] = [];
  for (const tab of ['Aggregiert', 'Verläufe'] as const) {
    await openTab(page, tab);
    const d = await openCompareDrawer(page);
    const labels = (await optionLabels(d).allInnerTexts()).map((s) => s.trim());
    lists.push(labels);
    await page.keyboard.press('Escape');
  }
  await openCaseOfTestkohorte(page);
  await compareButton(page).click();
  const caseDrawer = caseCompareDrawer(page);
  await expect(caseDrawer.getByRole('radio').first()).toBeVisible();
  lists.push((await optionLabels(caseDrawer).allInnerTexts()).map((s) => s.trim()));

  for (const labels of lists) {
    expect(labels.length).toBeGreaterThan(0);
    expect(labels[0]).toMatch(/^Alle Patienten \(N=\d+ Patient:innen\)$/);
    for (const l of labels) expect(l).toMatch(OPTION_FORMAT);
  }
  const names = (labels: string[]) => labels.map((l) => l.replace(/ \(N=\d+ Patient:innen\)$/, ''));
  const [aggregate, trajectories, caseView] = lists.map(names);
  expect(trajectories).toEqual(aggregate);
  // The case view lists a subset (cohorts containing the case); its order must follow the same sort.
  const positions = caseView.map((n) => aggregate.indexOf(n));
  expect(positions.every((p) => p >= 0), `case-view options ${caseView.join(', ')} appear on Aggregiert`).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
});

test('[Z0-P23] Einzelfallansicht nutzt dieselbe Auswahl mit genau einer Vergleichskohorte', async ({ page }) => {
  await openTab(page, 'Verläufe');
  const trajectoriesDrawer = await openCompareDrawer(page);
  const drawerClass = await trajectoriesDrawer.getAttribute('class');
  await page.keyboard.press('Escape');

  await openCaseOfTestkohorte(page);
  await compareButton(page).click();
  const d = caseCompareDrawer(page);
  await expect(d).toBeVisible();
  await expect(d.getByRole('heading', { name: 'Vergleichskohorte wählen', exact: true })).toBeVisible();
  expect(await d.getAttribute('class'), 'same panel look as on Verläufe').toBe(drawerClass);

  await expect(d.getByRole('checkbox')).toHaveCount(0);
  const radios = d.getByRole('radio');
  expect(await radios.count()).toBeGreaterThanOrEqual(2);
  await expect(optionLabels(d).first()).toHaveText(/^Alle Patienten \(N=\d+ Patient:innen\)$/);
  await expect(optionRow(d, 'Testkohorte')).toHaveCount(1);
  await expect(optionRow(d, 'Vergleichskohorte')).toHaveCount(0);

  const checked = d.locator('input[type="radio"]:checked');
  await optionRow(d, 'Testkohorte').getByRole('radio').check();
  await expect(checked).toHaveCount(1);
  await optionRow(d, 'Alle Patienten').getByRole('radio').check();
  await expect(checked).toHaveCount(1);
  await expect(optionRow(d, 'Testkohorte').getByRole('radio')).not.toBeChecked();
});

test('[Z0-P23] Einheitliches Erscheinungsbild der Kohortenauswahl @visual', async ({ page }) => {
  // DOM proxy for the browser pass: same panel element, input style, swatches and hint text in all three views.
  const looks: Array<{ cls: string | null; inputCls: string | null; swatches: number; options: number; hint: string }> = [];
  const collect = async (d: Locator, role: 'checkbox' | 'radio') => {
    await expect(d.getByRole(role).first()).toBeVisible();
    looks.push({
      cls: await d.getAttribute('class'),
      inputCls: await d.getByRole(role).first().getAttribute('class'),
      swatches: await d.locator('[data-compare-swatch]').count(),
      options: await optionLabels(d).count(),
      hint: (await d.getByTestId('compare-hint').innerText()).trim(),
    });
  };
  for (const tab of ['Aggregiert', 'Verläufe'] as const) {
    await openTab(page, tab);
    await collect(await openCompareDrawer(page), 'checkbox');
    await page.keyboard.press('Escape');
  }
  await openCaseOfTestkohorte(page);
  await compareButton(page).click();
  await collect(caseCompareDrawer(page), 'radio');

  for (const l of looks) {
    expect(l.cls).toBe(looks[0].cls);
    expect(l.inputCls).toBe(looks[0].inputCls);
    expect(l.swatches, 'one colour swatch per option').toBe(l.options);
    expect(l.hint.length).toBeGreaterThan(0);
  }
});

test('[Z0-P23] Verläufe bleiben bei großen Kohorten bedienbar', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: 'Analyse', exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/analysis' && url.search === '');
  await expect(page.getByTestId('analysis-active-cohort')).toHaveText('Aktive Kohorte: Alle Patienten');
  await openTab(page, 'Verläufe');
  await openMetric(page, 'visus');
  await page.getByRole('button', { name: 'Diagramm-Anzeige', exact: true }).click();
  const settings = page.getByRole('complementary', { name: 'Einstellungen', exact: true });
  const perPatient = settings.getByRole('checkbox', { name: 'Individuelle Kurven', exact: true });
  if (!(await perPatient.isChecked())) await perPatient.check();
  const iqr = settings.getByRole('checkbox', { name: 'Streuband (IQR)', exact: true });
  if (!(await iqr.isChecked())) await iqr.check();
  const panels = trajectoriesPanel(page).locator('[data-testid^="outcomes-panel-"][role="img"]');
  await expect(panels).toHaveCount(3, { timeout: 30_000 });
  await expect(panels.first().locator('[data-perpatient-layer] path').first()).toBeAttached({ timeout: 30_000 });
  await expect(panels.first().locator('.recharts-area').first()).toBeAttached({ timeout: 30_000 });

  /** Click the checkbox in the page and measure until the IQR band presence matches `present` and a frame is painted. */
  const measure = (present: boolean) =>
    page.evaluate(async (want) => {
      const box = [...document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]
        .find((el) => el.getAttribute('aria-label') === 'Streuband (IQR)')!;
      const done = () => {
        const ps = [...document.querySelectorAll('[data-testid^="outcomes-panel-"][role="img"]')];
        return ps.length === 3 && ps.every((p) => (p.querySelector('.recharts-area') !== null) === want);
      };
      const t0 = performance.now();
      box.click();
      await new Promise<void>((resolve) => {
        const tick = () => (done() ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      });
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      return performance.now() - t0;
    }, present);

  const off = await measure(false);
  console.log(`[Z0-P23] IQR off: ${off.toFixed(0)} ms`);
  expect(off).toBeLessThanOrEqual(2000);
  const on = await measure(true);
  console.log(`[Z0-P23] IQR on: ${on.toFixed(0)} ms`);
  expect(on).toBeLessThanOrEqual(2000);
});

test('[Z0-P23] Einheitliches Erscheinungsbild der Diagramme @visual', async ({ page }) => {
  // DOM proxy for the browser pass: card frame, title, grid, axis font and quantity colours.
  type Look = { card: string; title: string; grid: string; tick: string };
  const look = async (card: Locator): Promise<Look> => {
    await expect(card.locator('.recharts-cartesian-grid').first()).toBeVisible();
    return {
      card: await card.evaluate((el) => {
        const s = getComputedStyle(el);
        return [s.borderTopWidth, s.borderTopColor, s.borderRadius, s.paddingTop, s.backgroundColor].join('|');
      }),
      title: await card.locator('h3').first().evaluate((el) => {
        const s = getComputedStyle(el);
        return [s.fontSize, s.fontWeight, s.color].join('|');
      }),
      grid: (await card.locator('.recharts-cartesian-grid line').first().getAttribute('stroke')) ?? '',
      tick: await card.locator('.recharts-cartesian-axis-tick-value').first().evaluate((el) => getComputedStyle(el).fontSize),
    };
  };
  const strokeOf = async (scope: Locator, selector: string) =>
    (await scope.locator(selector).first().getAttribute('stroke'))?.toLowerCase();

  await openTab(page, 'Aggregiert');
  const aggregate = await look(aggregatePanel(page).getByTestId('visus-trend-chart'));
  const aggregateVisus = await strokeOf(aggregatePanel(page).getByTestId('visus-trend-chart'), '.recharts-line-curve');
  const aggregateCrt = (await aggregatePanel(page).getByTestId('crt-distribution-chart')
    .locator('.recharts-bar-rectangle path').first().getAttribute('fill'))?.toLowerCase();

  await openTab(page, 'Verläufe');
  await openMetric(page, 'visus');
  const od = trajectoriesPanel(page).getByTestId('outcomes-panel-od');
  const trajectories = await look(od);
  const trajectoriesVisus = await strokeOf(od, '.series-median .recharts-line-curve');
  await openMetric(page, 'crt');
  const trajectoriesCrt = await strokeOf(
    trajectoriesPanel(page).getByTestId('outcomes-panel-od'), '.series-median .recharts-line-curve',
  );

  await openCaseOfTestkohorte(page);
  const chart = page.getByTestId('visus-crt-chart');
  const caseView = await look(chart);
  const caseVisus = await strokeOf(chart, '.series-visus .recharts-line-curve');
  const caseCrt = await strokeOf(chart, '.series-crt .recharts-line-curve');

  expect(trajectories).toEqual(aggregate);
  expect(caseView).toEqual(aggregate);
  expect(caseVisus).toBeTruthy();
  expect(trajectoriesVisus).toBe(caseVisus);
  expect(aggregateVisus).toBe(caseVisus);
  expect(caseCrt).toBeTruthy();
  expect(trajectoriesCrt).toBe(caseCrt);
  expect(aggregateCrt).toBe(caseCrt);
});

// --- Scenarios added by NF on 2026-11-23 (Q41, Q42; release pre-check deviations D1–D4) ---------------------------
// Readings:
// - Tick labels are the rendered Recharts axis tick texts (Recharts 3 renders them in the label layer `.recharts-xAxis-tick-labels` / `.recharts-yAxis-tick-labels`,
//   `.recharts-cartesian-axis-tick-value`) of every Verläufe chart card (`[data-testid^="outcomes-panel-"][role="img"]`).
//   German labels are parsed with the decimal comma; a label that is not a plain number (e.g. "990.3865546218487" in the
//   German UI) does not parse and fails.
// - "a multiple of 1, 2, 2.5 or 5 times a power of ten" = the ticks of one axis lie on one step s ∈ {1, 2, 2.5, 5}·10^n:
//   consecutive ticks differ by s and every tick is an integer multiple of s (D2 "98,59 / 51,41 / -48,59" fails).
// - "drawn outside the plot area" (@visual proxy): the plot area is the chart's own Recharts clip rectangle
//   (`clipPath[id^="recharts"][id$="-clip"] rect`). Every curve, point and band (per-patient layer, IQR areas, median
//   lines) has its geometry box, cut by the clip rectangles of its own or ancestor `clip-path`, inside the plot area.
// - "every decimal number in the tooltips and axis tick labels" = every token "<digits><. or ,><digits>" in the visible
//   tooltip rows and headings and the axis tick labels of the hovered chart. The case view's calendar x-axis ticks and
//   its date heading are dates, not decimal numbers, and are left out.

function chartPanels(page: Page): Locator {
  return trajectoriesPanel(page).locator('[data-testid^="outcomes-panel-"][role="img"]');
}

async function openSettings(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Diagramm-Anzeige', exact: true }).click();
  return page.getByRole('complementary', { name: 'Einstellungen', exact: true });
}

/** Parse a German tick label ("-48,59", "0", "120"); NaN if it is not a plain number with a decimal comma. */
function parseGerman(label: string): number {
  const s = label.trim().replace('−', '-');
  if (!/^-?\d+(,\d+)?$/.test(s)) return Number.NaN;
  return Number(s.replace(',', '.'));
}

function decimalPlaces(label: string): number {
  const m = /,(\d+)$/.exec(label.trim());
  return m ? m[1].length : 0;
}

function isNiceStep(step: number): boolean {
  const exp = Math.floor(Math.log10(step));
  const mant = step / 10 ** exp;
  return [1, 2, 2.5, 5, 10].some((m) => Math.abs(mant - m) < 1e-6);
}

async function tickLabels(card: Locator, axis: 'x' | 'y'): Promise<string[]> {
  const ticks = card.locator(`.recharts-${axis}Axis-tick-labels .recharts-cartesian-axis-tick-value`);
  await expect(ticks.first()).toBeVisible();
  return (await ticks.allTextContents()).map((s) => s.trim()).filter((s) => s !== '');
}

async function expectRoundedTicks(page: Page, metric: string): Promise<void> {
  const panels = chartPanels(page);
  await expect(panels).toHaveCount(3, { timeout: 30_000 });
  for (const card of await panels.all()) {
    const id = await card.getAttribute('data-testid');
    const xs = await tickLabels(card, 'x');
    for (const l of xs) {
      expect(/^-?\d+$/.test(l.replace('−', '-')), `${metric} ${id}: x tick "${l}" is a whole number`).toBe(true);
    }
    const ys = await tickLabels(card, 'y');
    expect(ys.length, `${metric} ${id}: y ticks`).toBeGreaterThan(1);
    for (const l of ys) {
      expect(Number.isNaN(parseGerman(l)), `${metric} ${id}: y tick "${l}" is a number`).toBe(false);
      expect(decimalPlaces(l), `${metric} ${id}: y tick "${l}" has at most 2 decimal places`).toBeLessThanOrEqual(2);
    }
    const vals = ys.map(parseGerman).sort((a, b) => a - b);
    const step = vals[1] - vals[0];
    expect(isNiceStep(step), `${metric} ${id}: y step ${step} (${ys.join(' / ')}) is 1, 2, 2.5 or 5 × 10^n`).toBe(true);
    for (let i = 1; i < vals.length; i++) {
      expect(Math.abs(vals[i] - vals[i - 1] - step), `${metric} ${id}: equal y steps (${ys.join(' / ')})`).toBeLessThan(step * 1e-6);
    }
    for (const v of vals) {
      const k = v / step;
      expect(Math.abs(k - Math.round(k)), `${metric} ${id}: y tick ${v} is a multiple of ${step}`).toBeLessThan(1e-6);
    }
  }
}

test('[Z0-P23] Achsenbeschriftungen der Verläufe zeigen gerundete Werte', async ({ page }) => {
  await openTab(page, 'Verläufe');
  await openMetric(page, 'crt');
  const settings = await openSettings(page);
  const delta = settings.getByRole('radio', { name: 'Δ (µm zur Baseline)', exact: true });
  await delta.check();
  await expect(delta).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('outcomes-panel-ydomain').first()).toHaveAttribute('data-ymetric', 'delta');
  await expectRoundedTicks(page, 'CRT');

  await openMetric(page, 'visus');
  await expect(page.getByTestId('outcomes-panel-ydomain').first()).toHaveAttribute('data-metric', 'visus');
  await expectRoundedTicks(page, 'Visus');
});

test('[Z0-P23] Kurven bleiben innerhalb der Diagrammfläche @visual', async ({ page }) => {
  await openTab(page, 'Verläufe');
  await openMetric(page, 'crt');
  const settings = await openSettings(page);
  const perPatient = settings.getByRole('checkbox', { name: 'Individuelle Kurven', exact: true });
  if (!(await perPatient.isChecked())) await perPatient.check();
  await expect(perPatient).toBeChecked();
  await page.keyboard.press('Escape');
  const panels = chartPanels(page);
  await expect(panels).toHaveCount(3, { timeout: 30_000 });
  await expect(panels.first().locator('[data-perpatient-layer] path').first()).toBeAttached({ timeout: 30_000 });

  for (const card of await panels.all()) {
    const id = await card.getAttribute('data-testid');
    const outside = await card.evaluate((root) => {
      type Box = { x0: number; y0: number; x1: number; y1: number };
      const rectBox = (r: Element): Box => {
        const n = (a: string) => Number(r.getAttribute(a));
        return { x0: n('x'), y0: n('y'), x1: n('x') + n('width'), y1: n('y') + n('height') };
      };
      const plotRect = root.querySelector('svg.recharts-surface clipPath[id^="recharts"][id$="-clip"] rect');
      if (!plotRect) return ['no plot-area clip rectangle'];
      const plot = rectBox(plotRect);
      const svg = plotRect.ownerSVGElement!;
      const items = svg.querySelectorAll<SVGGraphicsElement>(
        '[data-perpatient-layer] path, [data-perpatient-layer] circle, .recharts-area path, .recharts-line path',
      );
      const bad: string[] = [];
      for (const el of items) {
        const b = el.getBBox();
        if (b.width === 0 && b.height === 0) continue;
        let box: Box = { x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height };
        for (let a: Element | null = el; a && a !== svg; a = a.parentElement) {
          const cp = a.getAttribute('clip-path') ?? (a as SVGElement).style?.clipPath ?? '';
          const m = /url\(["']?#([^"')]+)["']?\)/.exec(cp);
          const r = m ? svg.querySelector(`clipPath[id="${m[1]}"] rect`) : null;
          if (!r) continue;
          const c = rectBox(r);
          box = { x0: Math.max(box.x0, c.x0), y0: Math.max(box.y0, c.y0), x1: Math.min(box.x1, c.x1), y1: Math.min(box.y1, c.y1) };
        }
        if (box.x1 <= box.x0 || box.y1 <= box.y0) continue;
        const tol = 1;
        if (box.x0 < plot.x0 - tol || box.y0 < plot.y0 - tol || box.x1 > plot.x1 + tol || box.y1 > plot.y1 + tol) {
          bad.push(`${el.tagName}.${el.getAttribute('class') ?? ''} [${box.x0.toFixed(0)},${box.y0.toFixed(0)}–${box.x1.toFixed(0)},${box.y1.toFixed(0)}]`);
        }
      }
      return bad.length ? [`plot [${plot.x0},${plot.y0}–${plot.x1},${plot.y1}]`, ...bad.slice(0, 5), `(${bad.length} elements)`] : [];
    });
    expect(outside, `${id}: curves, points and bands outside the plot area`).toEqual([]);
  }
});

/** Texts of the visible tooltip (heading unless `skipHeading`, rows) and the chart's axis tick labels. */
async function numberTexts(page: Page, chart: Locator, opts: { skipHeading?: boolean; skipXTicks?: boolean } = {}): Promise<string[]> {
  const tip = page.getByTestId('chart-tooltip').filter({ visible: true });
  await expect(tip).toHaveCount(1);
  const texts = await tip.locator('[data-tooltip-row]').allInnerTexts();
  if (!opts.skipHeading) texts.push(...(await tip.locator('[data-tooltip-heading]').allInnerTexts()));
  const axes = opts.skipXTicks ? ['.recharts-yAxis-tick-labels'] : ['.recharts-xAxis-tick-labels', '.recharts-yAxis-tick-labels'];
  for (const axis of axes) {
    texts.push(...(await chart.locator(`${axis} .recharts-cartesian-axis-tick-value`).allTextContents()));
  }
  return texts;
}

function expectDecimalSeparator(texts: string[], sep: ',' | '.', where: string): void {
  const decimals = texts.flatMap((s) => s.match(/\d+[.,]\d+/g) ?? []);
  expect(decimals.length, `${where}: decimal numbers found in ${JSON.stringify(texts)}`).toBeGreaterThan(0);
  for (const d of decimals) {
    expect(d.includes(sep), `${where}: "${d}" uses the decimal ${sep === ',' ? 'comma' : 'point'}`).toBe(true);
  }
}

async function switchLanguage(page: Page, to: 'English' | 'Deutsch'): Promise<void> {
  await page.mouse.move(0, 0);
  await page.getByRole('button', { name: to, exact: true }).click();
  await expect(page.getByRole('button', { name: to === 'English' ? 'Deutsch' : 'English', exact: true })).toBeVisible();
}

test('[Z0-P23] Einheitliches Zahlenformat in Aggregiert, Verläufe und Einzelfallansicht', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'English', exact: true })).toBeVisible(); // UI language Deutsch

  const hoverAgeVisus = async () => {
    const chart = aggregatePanel(page).getByTestId('age-visus-chart');
    const point = chart.locator('.recharts-scatter-symbol').first();
    await expect(point).toBeVisible();
    await page.mouse.move(0, 0);
    await point.hover({ force: true });
    return chart;
  };
  await openTab(page, 'Aggregiert');
  let chart = await hoverAgeVisus();
  expectDecimalSeparator(await numberTexts(page, chart), ',', 'Aggregiert (Deutsch)');
  await switchLanguage(page, 'English');
  chart = await hoverAgeVisus();
  expectDecimalSeparator(await numberTexts(page, chart), '.', 'Aggregiert (English)');
  await switchLanguage(page, 'Deutsch');

  await openTab(page, 'Verläufe');
  await openMetric(page, 'visus');
  const od = trajectoriesPanel(page).getByTestId('outcomes-panel-od');
  await page.mouse.move(0, 0);
  await hoverPlotCentre(od);
  expectDecimalSeparator(await numberTexts(page, od), ',', 'Verläufe (Deutsch)');
  await switchLanguage(page, 'English');
  await hoverPlotCentre(od);
  expectDecimalSeparator(await numberTexts(page, od), '.', 'Verläufe (English)');
  await switchLanguage(page, 'Deutsch');

  await openCaseOfTestkohorte(page);
  const caseChart = page.getByTestId('visus-crt-chart');
  const hoverVisusPoint = async () => {
    const p = caseChart.locator('circle[r="4"][fill="#10b981"]').first();
    await expect(p).toBeVisible();
    await page.mouse.move(0, 0);
    await p.hover({ force: true });
  };
  await hoverVisusPoint();
  expectDecimalSeparator(
    await numberTexts(page, caseChart, { skipHeading: true, skipXTicks: true }), ',', 'Einzelfallansicht (Deutsch)',
  );
  await switchLanguage(page, 'English');
  await hoverVisusPoint();
  expectDecimalSeparator(
    await numberTexts(page, caseChart, { skipHeading: true, skipXTicks: true }), '.', 'Einzelfallansicht (English)',
  );
  await switchLanguage(page, 'Deutsch');
});

// Q46 (NF, 2026-11-23): the unsaved filtered cohort is the fixed base cohort of the comparison, named as in the header.
// "the cohort named after 'Aktive Kohorte: ' in the header" = the header's cohort name span; its drawer option reads
// "<that name> (N=<n> Patient:innen)" and carries the badge "Basis-Kohorte (fest)".
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function legendStartingWith(scope: Locator, name: string): Locator {
  return scope.locator('.legend .legendtext').filter({ hasText: new RegExp(`^${escapeRegExp(name)}(\\s|$)`) });
}

test('[Z0-P23] Gefilterte, nicht gespeicherte Kohorte lässt sich vergleichen', async ({ page }) => {
  await page.goto('/cohort');
  await page.getByRole('button', { name: 'Zurücksetzen' }).click();
  await filterGroup(page, 'Alter (Jahre)').getByPlaceholder('Min').fill('70');
  expect(await cohortCount(page)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Kohorte analysieren', exact: true }).click();
  await page.waitForURL(/\/analysis\?/);
  await openTab(page, 'Aggregiert');

  // Independent reference for the filtered cohort's count: the header's "<n> Fälle in der aktuellen Kohorte"
  // (the drawer and legend count cases per cohort, Z0-P05).
  const caseLine = page.getByText(/^\d+ Fälle in der aktuellen Kohorte/);
  await expect(caseLine).toBeVisible();
  const headerCases = Number(/^(\d+)/.exec(await caseLine.innerText())![1]);
  expect(headerCases, 'the synthetic filtered cohort is not empty').toBeGreaterThan(0);

  const header = page.getByTestId('analysis-active-cohort');
  await expect(header).toHaveText(/^Aktive Kohorte: Gefilterte Kohorte/);
  const name = (await header.locator('span').first().innerText()).trim();
  expect(name.startsWith('Gefilterte Kohorte'), `header cohort name "${name}"`).toBe(true);

  const d = await openCompareDrawer(page);
  const filteredFormat = new RegExp(`^${escapeRegExp(name)} \\(N=\\d+ Patient:innen\\)$`);
  const filteredLabel = optionLabels(d).filter({ hasText: filteredFormat });
  await expect(filteredLabel).toHaveCount(1);
  // `has` takes a locator relative to the row (as in optionRow), not one rooted at the drawer.
  const filteredRow = d.locator('label').filter({
    has: page.locator('[data-compare-option-label]', { hasText: filteredFormat }),
  });
  await expect(filteredRow).toHaveCount(1);
  await expect(filteredRow).toContainText('Basis-Kohorte (fest)');
  await expect(filteredRow.getByRole('checkbox')).toBeChecked();
  await expect(filteredRow.getByRole('checkbox')).toBeDisabled();
  const all = optionRow(d, 'Alle Patienten').getByRole('checkbox');
  await expect(all).toBeChecked();
  const filteredText = await filteredLabel.innerText();
  expect(filteredText).toBe(`${name} (N=${headerCases} Patient:innen)`);
  const allText = await optionRow(d, 'Alle Patienten').locator('[data-compare-option-label]').innerText();
  const allCount = Number(/\(N=(\d+) Patient:innen\)$/.exec(allText)![1]);
  expect(allCount, '"Alle Patienten" contains the filtered cohort and more').toBeGreaterThan(headerCases);
  await page.keyboard.press('Escape');

  const panel = aggregatePanel(page);
  await expect(legendStartingWith(panel, name)).toHaveText(filteredText);
  await expect(legendStartingWith(panel, 'Alle Patienten')).toHaveText(allText);

  await openTab(page, 'Verläufe');
  const trajectories = trajectoriesPanel(page);
  await expect(legendStartingWith(trajectories, name).first()).toBeVisible();
  await expect(legendStartingWith(trajectories, 'Alle Patienten').first()).toBeVisible();
});
