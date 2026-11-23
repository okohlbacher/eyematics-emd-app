// Z0-P26 — Grundgesamtheit als Standardvergleich in den aggregierten Daten (acceptance/Z0/Z0-P26.feature).
// Synthetic data only.
// Readings (PLAN Z0-P26 §5 and the binding answers C5, Q6/Q23, as already applied in Z0-P05 and Z0-P23):
// - "the drawer" = the aside "Kohorten vergleichen" opened from the tab "Aggregiert"; its options are the checkboxes
//   in DOM order, each with the visible label "<Name> (N=<n> Patient:innen)" in [data-compare-option-label].
// - "I close the drawer" = Escape (as in Z0-P05/Z0-P23).
// - "the legend" = the cohort legend entries `.legend .legendtext` of the Aggregiert panel; "with their patient counts"
//   = each entry reads "<Name> (N=<n> Patient:innen)" with the n of the drawer option.
// - "the diagnosis chart shows 2 cohorts" = 2 [data-cohort-series] groups in data-testid "compare-diagnosis".
// - "Alle Patienten" = the included cases (accessible cases minus the user's exclusions, Q23). The case view's
//   selector "Vergleichskohorte wählen" (aside opened by "Kohorten vergleichen") lists it as its first radio option.
import type { APIRequestContext, Locator, Page } from '@playwright/test';

import { apiToken, bearer } from '../../acceptance-at/helpers';
import { expect, test } from '../fixtures';

const COHORT = 'Testkohorte';
const COHORT_FILTERS = { ageRange: [70, null] };
const LABEL = /^(.+) \(N=(\d+) Patient:innen\)$/;

/** Background: exactly one saved cohort "Testkohorte". */
async function seedCohort(request: APIRequestContext): Promise<void> {
  const headers = bearer(await apiToken(request, 'klinikleitung'));
  const list = await request.get('/api/data/saved-searches', { headers });
  expect(list.status()).toBe(200);
  const { savedSearches } = (await list.json()) as { savedSearches: { id: string; name: string }[] };
  for (const s of savedSearches.filter((x) => x.name === COHORT)) {
    expect((await request.delete(`/api/data/saved-searches/${s.id}`, { headers })).status()).toBe(200);
  }
  const created = await request.post('/api/data/saved-searches', { headers, data: { name: COHORT, filters: COHORT_FILTERS } });
  expect(created.status()).toBe(201);
}

function savedRow(page: Page): Locator {
  return page.locator('div.rounded-lg').filter({ has: page.getByText(COHORT, { exact: true }) });
}

function aggregatePanel(page: Page): Locator {
  return page.getByTestId('analysis-tab-aggregate');
}

function compareButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Kohorten vergleichen', exact: true });
}

function compareDrawer(page: Page): Locator {
  return page.getByRole('complementary', { name: 'Kohorten vergleichen', exact: true });
}

function optionRow(drawer: Locator, name: string): Locator {
  return drawer.locator('label').filter({
    has: drawer.page().locator('[data-compare-option-label]', { hasText: new RegExp(`^${name} \\(N=`) }),
  });
}

function legendEntry(scope: Locator, name: string): Locator {
  return scope.locator('.legend .legendtext').filter({ hasText: new RegExp(`^${name}\\b`) });
}

function countOf(label: string, name: string): number {
  const m = LABEL.exec(label.trim());
  expect(m, `label "${label}" has the format "<Name> (N=<n> Patient:innen)"`).not.toBeNull();
  expect(m![1]).toBe(name);
  return Number(m![2]);
}

async function openCompareDrawer(page: Page): Promise<Locator> {
  await compareButton(page).click();
  const d = compareDrawer(page);
  await expect(d.getByRole('checkbox').first()).toBeVisible();
  return d;
}

test.beforeEach(async ({ page, request, loginAs }) => {
  await seedCohort(request);
  await loginAs('klinikleitung');
  // Background: open the cohort analysis for "Testkohorte", tab "Aggregiert".
  await page.goto('/cohort');
  await page.getByRole('button', { name: /^Gespeicherte Suchen/ }).click();
  await expect(savedRow(page)).toHaveCount(1);
  await savedRow(page).getByRole('button', { name: 'Outcomes anzeigen', exact: true }).click();
  await page.waitForURL(/\/analysis\?/);
  await expect(page.getByTestId('analysis-active-cohort')).toContainText(COHORT);
  await page.getByRole('tab', { name: 'Aggregiert', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Aggregiert', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('[Z0-P26] Grundgesamtheit als erste Vergleichsoption', async ({ page }) => {
  const d = await openCompareDrawer(page);
  const first = d.getByRole('checkbox').first();
  await expect(first).toHaveAccessibleName(/^Alle Patienten \(N=\d+ Patient:innen\)$/);
  await expect(d.locator('[data-compare-option-label]').first()).toHaveText(/^Alle Patienten \(N=\d+ Patient:innen\)$/);
  await expect(first).toBeChecked();
});

test('[Z0-P26] Vergleich mit der Grundgesamtheit', async ({ page }) => {
  const d = await openCompareDrawer(page);
  const counts: Record<string, number> = {};
  for (const name of [COHORT, 'Alle Patienten']) {
    counts[name] = countOf(await optionRow(d, name).locator('[data-compare-option-label]').innerText(), name);
  }
  await page.keyboard.press('Escape');
  // The drawer stays mounted and slides off-canvas (translate-x-full), so "closed" = outside the viewport.
  await expect(d).not.toBeInViewport();

  const panel = aggregatePanel(page);
  for (const name of [COHORT, 'Alle Patienten']) {
    await expect(legendEntry(panel, name)).toHaveText(`${name} (N=${counts[name]} Patient:innen)`);
  }
  await expect(panel.getByTestId('compare-diagnosis').locator('[data-cohort-series]')).toHaveCount(2);
});

test('[Z0-P26] Grundgesamtheit im Vergleich nutzt die Fälle aller berechtigten Standorte', async ({ page }) => {
  // Compare "Testkohorte" with "Alle Patienten" (exactly these two).
  const d = await openCompareDrawer(page);
  const all = optionRow(d, 'Alle Patienten').getByRole('checkbox');
  if (!(await all.isChecked())) await all.check();
  await expect(d.locator('input[type="checkbox"]:checked')).toHaveCount(2);
  await expect(optionRow(d, COHORT).getByRole('checkbox')).toBeChecked();
  await page.keyboard.press('Escape');
  const legend = legendEntry(aggregatePanel(page), 'Alle Patienten');
  await expect(legend).toHaveText(LABEL);
  const analysisN = countOf(await legend.innerText(), 'Alle Patienten');
  expect(analysisN).toBeGreaterThan(0);

  // Einzelfallansicht: a case of "Testkohorte", selector "Vergleichskohorte wählen".
  await page.goto('/cohort');
  await page.getByRole('button', { name: 'Zurücksetzen' }).click();
  await page.getByRole('button', { name: /^Gespeicherte Suchen/ }).click();
  await savedRow(page).getByRole('button', { name: `Kohorte „${COHORT}“ laden`, exact: true }).click();
  await expect(page.getByText(`Geladene Kohorte: ${COHORT}`, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Detailansicht', exact: true }).click();
  await page.locator('tbody tr').first().click();
  await page.waitForURL(/\/case\//);
  await compareButton(page).click();
  const caseDrawer = page.getByRole('complementary', { name: 'Vergleichskohorte wählen', exact: true });
  await expect(caseDrawer.getByRole('radio').first()).toBeVisible();
  const caseLabel = await optionRow(caseDrawer, 'Alle Patienten').locator('[data-compare-option-label]').innerText();
  expect(countOf(caseLabel, 'Alle Patienten')).toBe(analysisN);
});

// @visual — DOM proxy (Q44 a: series drawn in descending N, so subsets lie on top). In SVG a later sibling is painted
// over an earlier one, so "drawn on top" = the Recharts scatter series (`.recharts-scatter`) of "Testkohorte" comes
// after the one of "Alle Patienten" in "compare-age-visus". A series is identified by the computed fill of its symbols,
// matched against the colour swatch of the cohort legend entry. Visibility itself is checked in the browser pass.
test('[Z0-P26] Basis-Kohorte bleibt im Vergleich mit der Grundgesamtheit sichtbar', async ({ page }) => {
  const d = await openCompareDrawer(page);
  const all = optionRow(d, 'Alle Patienten').getByRole('checkbox');
  if (!(await all.isChecked())) await all.check();
  await expect(d.locator('input[type="checkbox"]:checked')).toHaveCount(2);
  await expect(optionRow(d, COHORT).getByRole('checkbox')).toBeChecked();
  await page.keyboard.press('Escape');

  const panel = aggregatePanel(page);
  const swatchColour = async (name: string): Promise<string> =>
    panel
      .locator('.legend li')
      .filter({ has: page.locator('.legendtext', { hasText: new RegExp(`^${name} \\(N=`) }) })
      .locator('[data-legend-swatch]')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
  const cohortColour = await swatchColour(COHORT);
  const allColour = await swatchColour('Alle Patienten');
  expect(cohortColour).not.toBe(allColour);

  const series = panel.getByTestId('compare-age-visus').locator('.recharts-scatter');
  await expect(series).toHaveCount(2);
  await expect(series.nth(0).locator('.recharts-scatter-symbol').first()).toBeAttached();
  await expect(series.nth(1).locator('.recharts-scatter-symbol').first()).toBeAttached();
  const fills = await series.evaluateAll((groups) =>
    groups.map((g) => {
      const sym = g.querySelector('.recharts-scatter-symbol path, .recharts-scatter-symbol circle, .recharts-symbols');
      return sym ? getComputedStyle(sym).fill : null;
    }),
  );
  expect(fills, 'drawing order of the series (bottom → top)').toEqual([allColour, cohortColour]);
});
