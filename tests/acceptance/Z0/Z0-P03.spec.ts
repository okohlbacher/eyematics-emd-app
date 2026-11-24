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

// Scenario "Infosymbol verdeckt den Y-Achsentitel nicht" (D8, Q52: fixed by placement, titles unchanged). Readings:
// - "every chart card" = each rendered Verläufe chart card `outcomes-panel-{od,os,combined}` (role="img");
//   y-axis settings = the "Diagramm-Anzeige" radios starting with "Absolut"/"Absolute", "Δ (" and "Δ %".
// - "stays at the upper end of the y-axis" = the icon lies left of the plot area, its vertical centre is within 24 px of
//   the plot area's top edge, and it sits above the y-axis title (icon bottom ≤ title top).
// - "overlaps neither …" = the icon's box intersects neither the y-axis title's box, nor any y-axis tick label's box,
//   nor the plot area (the box of the CartesianGrid).
// - "drawn in full inside its chart card" = the title's box lies inside the card's and the chart SVG's box, and its text
//   equals the y-axis title marker (data-ylabel), which ends with ")".
type Box = { left: number; top: number; right: number; bottom: number };
type Geometry = { icon: Box; title: Box | null; titleText: string; ylabel: string; ticks: Box[]; plot: Box; card: Box; svg: Box };

const Y_MODES: { mode: 'absolute' | 'delta' | 'delta_percent'; de: RegExp; en: RegExp }[] = [
  { mode: 'absolute', de: /^Absolut \(/, en: /^Absolute \(/ },
  { mode: 'delta', de: /^Δ \(/, en: /^Δ \(/ },
  { mode: 'delta_percent', de: /^Δ % \(/, en: /^Δ % \(/ },
];

function intersects(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function inside(inner: Box, outer: Box): boolean {
  return inner.left >= outer.left - 0.5 && inner.right <= outer.right + 0.5 && inner.top >= outer.top - 0.5 && inner.bottom <= outer.bottom + 0.5;
}

async function setYModeByPattern(page: Page, button: string, settingsName: string, label: RegExp, mode: string): Promise<void> {
  await page.getByRole('button', { name: button, exact: true }).click();
  const settings = page.getByRole('complementary', { name: settingsName, exact: true });
  const radio = settings.getByRole('radio', { name: label });
  await expect(radio).toHaveCount(1);
  await radio.check();
  await expect(radio).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('analysis-tab-trajectories').getByTestId('outcomes-panel-ydomain').first()).toHaveAttribute('data-ymetric', mode);
}

async function panelGeometry(card: Locator): Promise<Geometry> {
  return card.evaluate((el) => {
    const box = (r: DOMRect) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    const eye = (el.getAttribute('data-testid') ?? '').replace('outcomes-panel-', '');
    const icon = el.querySelector(`[data-testid="outcomes-panel-${eye}-ylabel-info"]`);
    const ylabel = el.querySelector(`[data-testid="outcomes-panel-${eye}-ylabel"]`)?.getAttribute('data-ylabel') ?? '';
    const svg = el.querySelector('svg.recharts-surface');
    const grid = el.querySelector('.recharts-cartesian-grid');
    const title = [...el.querySelectorAll('.recharts-label')].find((n) => n.textContent === ylabel) ?? null;
    const ticks = [...el.querySelectorAll('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value')];
    if (!icon || !svg || !grid) throw new Error(`chart card ${eye}: icon, svg or grid missing`);
    return {
      icon: box(icon.getBoundingClientRect()),
      title: title ? box(title.getBoundingClientRect()) : null,
      titleText: title?.textContent ?? '',
      ylabel,
      ticks: ticks.map((n) => box(n.getBoundingClientRect())),
      plot: box(grid.getBoundingClientRect()),
      card: box(el.getBoundingClientRect()),
      svg: box(svg.getBoundingClientRect()),
    };
  });
}

async function expectIconClearOfAxis(page: Page, context: string, iconName: string): Promise<void> {
  const cards = page.getByTestId('analysis-tab-trajectories').locator('[role="img"][data-testid^="outcomes-panel-"]');
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  const count = await cards.count();
  expect(count, `${context}: chart cards`).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    await expect(card.locator('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value').first()).toBeVisible();
    // The measured icon is the one named "Erläuterung der Y-Achse" (EN "Explanation of the y-axis").
    await expect(card.locator('[data-testid$="-ylabel-info"]')).toHaveAccessibleName(iconName);
    const g = await panelGeometry(card);
    const where = `${context}, card ${i} (${g.ylabel})`;
    expect(g.title, `${where}: y-axis title drawn`).not.toBeNull();
    const title = g.title as Box;
    expect(g.titleText, `${where}: title text`).toBe(g.ylabel);
    expect(g.titleText.endsWith(')'), `${where}: title ends with ")"`).toBe(true);
    // Upper end of the y-axis.
    expect(g.icon.right, `${where}: icon left of the plot area`).toBeLessThanOrEqual(g.plot.left);
    expect(Math.abs((g.icon.top + g.icon.bottom) / 2 - g.plot.top), `${where}: icon at the top of the y-axis`).toBeLessThanOrEqual(24);
    expect(g.icon.bottom, `${where}: icon above the title`).toBeLessThanOrEqual(title.top);
    // No overlap.
    expect(intersects(g.icon, title), `${where}: icon overlaps the title`).toBe(false);
    expect(g.ticks.length, `${where}: tick labels`).toBeGreaterThan(0);
    for (const tick of g.ticks) expect(intersects(g.icon, tick), `${where}: icon overlaps a tick label`).toBe(false);
    expect(intersects(g.icon, g.plot), `${where}: icon overlaps the plot area`).toBe(false);
    // Title in full.
    expect(inside(title, g.card), `${where}: title inside the card`).toBe(true);
    expect(inside(title, g.svg), `${where}: title inside the chart`).toBe(true);
  }
}

test('[Z0-P03] Infosymbol verdeckt den Y-Achsentitel nicht', async ({ page }) => {
  for (const locale of ['de', 'en'] as const) {
    if (locale === 'en') {
      await page.evaluate(() => localStorage.setItem('emd-locale', 'en'));
      await page.reload();
      await openTrajectories(page);
      await expect(trajectoriesTab(page)).toHaveText(/Trajectories/);
    }
    const button = locale === 'de' ? 'Diagramm-Anzeige' : 'Chart display';
    const settingsName = locale === 'de' ? 'Einstellungen' : 'Settings';
    const iconName = locale === 'de' ? 'Erläuterung der Y-Achse' : 'Explanation of the y-axis';
    for (const metric of ['visus', 'crt'] as const) {
      await openMetric(page, metric);
      for (const m of Y_MODES) {
        await setYModeByPattern(page, button, settingsName, m[locale], m.mode);
        await expectIconClearOfAxis(page, `${locale} ${metric} ${m.mode}`, iconName);
      }
    }
  }
});
