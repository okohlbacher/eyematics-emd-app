// Z0-P12 — Fälle mit kritischen Werten in den Verläufen hervorheben (acceptance/Z0/Z0-P12.feature). Synthetic data only.
// "Testkohorte" = saved cohort with age >= 70 (as in Z0-P09/Z0-P21); the precondition "at least 1 case with a CRT above
// 400 µm" is checked against the synthetic bundles (public/data) with a one-year margin on the age bound.
// Readings (PLAN Z0-P12 §3/§5, binding answer Q11 a "highlight the measurements from the cases", count per case):
// - "Diagramm-Anzeige" = the button that opens the aside "Einstellungen"; the option is a checkbox in that aside.
// - "a highlighted per-patient curve" = one `[data-critical="true"]` series (DOM hook, PLAN §5) in the Verläufe chart.
//   "the chart" = the CRT card "OD + OS" (`outcomes-panel-combined`): it holds one series per case, so it is the only
//   chart in which the count per case and the number of curves can agree (OD/OS lack the cases without that eye).
// - "the number before 'Fälle mit kritischen Werten (CRT > 400 µm)'" = the leading integer of the header button (Z0-P09).
// - "the legend contains …" = a `.legendtext` entry with exactly that text in that chart's legend.
// - "a measurement point of a highlighted curve" = an uncovered `circle` of a highlighted series; "that patient" = the
//   series' pseudonym (`data-patient-id`), which the case view's level-1 heading shows.
// - "its CRT chart contains a value above 400 µm" = a measured CRT dot (`circle[r="4"]` in the case-view CRT colour
//   #8b5cf6; Recharts draws dots in its own z-index layer, outside `.series-crt`, as in Z0-P23) of the case view's
//   chart `visus-crt-chart` lies above its critical reference line (y = 400 on the CRT axis, stroke #ef4444); the
//   synthetic bundles confirm that this case's highest CRT exceeds 400 µm.
import type { APIRequestContext, Locator, Page } from '@playwright/test';

import { LOINC_CRT } from '../../../shared/fhirCodes';
import { getObservationsByCode } from '../../../shared/fhirQueries';
import { extractPatientCases, getAge } from '../../../shared/patientCases';
import { apiToken, bearer, localBundles } from '../../acceptance-at/helpers';
import { expect, test } from '../fixtures';

const COHORT = 'Testkohorte';
const THRESHOLD = 400;
const OPTION = 'Fälle mit kritischen Werten hervorheben';
const LEGEND = 'Fälle mit kritischen Werten';
const COUNT_TEXT = 'Fälle mit kritischen Werten (CRT > 400 µm)';
/** A measured CRT dot of the case view's Visus/CRT chart (CRT_COLOR, VisusCrtChart.tsx). */
const CRT_DOT = 'circle[r="4"][fill="#8b5cf6"]';

function syntheticCases() {
  return extractPatientCases(localBundles() as unknown as Parameters<typeof extractPatientCases>[0]);
}

function maxCrt(c: ReturnType<typeof syntheticCases>[number]): number {
  const values = getObservationsByCode(c.observations, LOINC_CRT)
    .map((o) => o.valueQuantity?.value)
    .filter((v): v is number => typeof v === 'number');
  return values.length ? Math.max(...values) : -Infinity;
}

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

async function openCohortAnalysis(page: Page): Promise<void> {
  await page.goto('/cohort');
  await page.getByRole('button', { name: /^Gespeicherte Suchen/ }).click();
  const row = page.locator('div.rounded-lg').filter({ has: page.getByText(COHORT, { exact: true }) });
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: 'Outcomes anzeigen', exact: true }).click();
  await page.waitForURL(/\/analysis\?/);
  await expect(page.getByTestId('analysis-active-cohort')).toContainText(COHORT);
}

async function openTrajectoriesCrt(page: Page): Promise<void> {
  const tab = page.getByRole('tab', { name: 'Verläufe', exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await page.getByTestId('metric-tab-crt').click();
  await expect(page.getByTestId('metric-tab-crt')).toHaveAttribute('aria-selected', 'true');
}

async function openDisplaySettings(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Diagramm-Anzeige', exact: true }).click();
  const settings = page.getByRole('complementary', { name: 'Einstellungen', exact: true });
  await expect(settings).toBeVisible();
  return settings;
}

async function tickHighlight(page: Page): Promise<void> {
  const settings = await openDisplaySettings(page);
  const box = settings.getByRole('checkbox', { name: OPTION, exact: true });
  await box.check();
  await expect(box).toBeChecked();
  await page.keyboard.press('Escape');
}

function combinedCard(page: Page): Locator {
  return page.getByTestId('analysis-tab-trajectories').locator('[data-testid="outcomes-panel-combined"][role="img"]');
}

function highlighted(page: Page): Locator {
  return combinedCard(page).locator('[data-critical="true"]');
}

async function criticalCount(page: Page): Promise<number> {
  const button = page.getByRole('button', { name: new RegExp(`^\\d+ ${COUNT_TEXT.replace(/[()]/g, '\\$&')}$`) });
  await expect(button).toHaveCount(1);
  return Number(/^(\d+)/.exec((await button.innerText()).trim())![1]);
}

test.beforeEach(async ({ page, request, loginAs }) => {
  const precondition = syntheticCases().some((c) => getAge(c.birthDate) >= 71 && maxCrt(c) > THRESHOLD);
  expect(precondition, `"${COHORT}" contains a case with CRT > ${THRESHOLD} µm`).toBe(true);
  await seedTestkohorte(request);
  await loginAs('klinikleitung');
  await openCohortAnalysis(page);
  await openTrajectoriesCrt(page);
});

test('[Z0-P12] Option zum Hervorheben', async ({ page }) => {
  const settings = await openDisplaySettings(page);
  const box = settings.getByRole('checkbox', { name: OPTION, exact: true });
  await expect(box).toHaveCount(1);
  await expect(box).toBeVisible();
  await expect(box).not.toBeChecked();
});

test('[Z0-P12] Kritische Fälle werden hervorgehoben', async ({ page }) => {
  const shown = await criticalCount(page);
  expect(shown).toBeGreaterThan(0);
  await tickHighlight(page);
  await expect(combinedCard(page)).toBeVisible({ timeout: 30_000 });
  await expect(highlighted(page)).toHaveCount(shown, { timeout: 30_000 });
  await expect(combinedCard(page).locator('.legendtext').filter({ hasText: new RegExp(`^${LEGEND}$`) })).toHaveCount(1);
});

test('[Z0-P12] Hervorgehobenen Fall öffnen', async ({ page }) => {
  await tickHighlight(page);
  await expect(highlighted(page).first()).toBeAttached({ timeout: 30_000 });
  await combinedCard(page).scrollIntoViewIfNeeded();

  const hit = await combinedCard(page).evaluate((card) => {
    for (const group of Array.from(card.querySelectorAll('[data-critical="true"]'))) {
      for (const dot of Array.from(group.querySelectorAll('circle'))) {
        const r = dot.getBoundingClientRect();
        if (r.width === 0) continue;
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        const top = document.elementFromPoint(x, y);
        if (top && group.contains(top)) return { x, y, pseudonym: group.getAttribute('data-patient-id') };
      }
    }
    return null;
  });
  expect(hit, 'an uncovered measurement point of a highlighted curve').not.toBeNull();
  expect(hit!.pseudonym).toBeTruthy();

  await page.mouse.move(hit!.x, hit!.y);
  await page.mouse.click(hit!.x, hit!.y);
  await page.waitForURL(/\/case\/[^/?#]+/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(hit!.pseudonym!);

  const chart = page.getByTestId('visus-crt-chart');
  await expect(chart.locator(CRT_DOT).first()).toBeAttached();
  const above = await chart.evaluate((el, dotSelector) => {
    const ref = el.querySelector('line[stroke="#ef4444"]');
    if (!ref) return null;
    const refY = ref.getBoundingClientRect().top;
    return Array.from(el.querySelectorAll(dotSelector)).some((c) => {
      const r = c.getBoundingClientRect();
      return r.top + r.height / 2 < refY - 0.5;
    });
  }, CRT_DOT);
  expect(above, 'the case view CRT chart draws the 400 µm reference line').not.toBeNull();
  expect(above, 'a CRT value above 400 µm in the case view chart').toBe(true);
  const synthetic = syntheticCases().filter((c) => c.pseudonym === hit!.pseudonym);
  expect(synthetic.some((c) => maxCrt(c) > THRESHOLD), 'the opened case has a CRT above 400 µm').toBe(true);
});
