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

import { apiToken, bearer } from '../../acceptance-at/helpers';
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
