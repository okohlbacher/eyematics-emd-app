// Z0-P20 — Mouseover zeigt, dass ein Einzelfall geöffnet werden kann (acceptance/Z0/Z0-P20.feature). Synthetic data only.
// Readings (PLAN Z0-P20 §3/§5, binding answers C9 "yes", Q12 b):
// - "a measurement point of a per-patient curve" = a vertex (measurement) of a per-patient path in the Verläufe OD card
//   (`[data-perpatient-layer] path`, vertices from its `d` attribute). The mouse is moved to the first vertex whose
//   screen position hits a per-patient element (path or measurement circle of the same layer), so nothing else covers it.
// - "the tooltip" = the per-patient tooltip of that card, `[data-testid="outcomes-hover-tooltip-od"]` (shared box
//   `chart-tooltip`); "ends with" = its trimmed textContent ends with the text.
// - "the pseudonym of that patient after 'Patient'" = a row "Patient: <Pseudonym>"; "that patient" is checked by a click
//   on the same position, which opens the case view showing the same pseudonym.
// - "the mouse cursor is 'pointer'" = computed `cursor` of the element under the mouse at that position.
// - "the UI language is English" = locale 'en' (localStorage `emd-locale`, as in Z0-P03/P05) followed by a reload; the
//   Verläufe tab is reopened by its stable aria-controls id.
import type { APIRequestContext, Locator, Page } from '@playwright/test';

import { apiToken, bearer } from '../../acceptance-at/helpers';
import { expect, test } from '../fixtures';

const COHORT = 'Testkohorte';

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

async function openTrajectories(page: Page): Promise<void> {
  const tab = page.locator('[role="tab"][aria-controls="analysis-tab-trajectories"]');
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

/** Background: tick "Individuelle Kurven" in "Diagramm-Anzeige" (aside "Einstellungen"). */
async function tickPerPatient(page: Page, en = false): Promise<void> {
  await page.getByRole('button', { name: en ? 'Chart display' : 'Diagramm-Anzeige', exact: true }).click();
  const settings = page.getByRole('complementary', { name: en ? 'Settings' : 'Einstellungen', exact: true });
  const box = settings.getByRole('checkbox', { name: en ? 'Per-patient curves' : 'Individuelle Kurven', exact: true });
  if (!(await box.isChecked())) await box.check();
  await expect(box).toBeChecked();
  await page.keyboard.press('Escape');
}

function odCard(page: Page): Locator {
  return page.getByTestId('analysis-tab-trajectories').locator('[data-testid="outcomes-panel-od"][role="img"]');
}

/** Move the mouse onto an uncovered measurement point of a per-patient curve; returns its screen position. */
async function hoverPerPatientPoint(page: Page): Promise<{ x: number; y: number }> {
  const card = odCard(page);
  await expect(card.locator('[data-perpatient-layer] path').first()).toBeAttached({ timeout: 30_000 });
  await card.scrollIntoViewIfNeeded();
  const pos = await card.evaluate((el) => {
    const layer = el.querySelector('[data-perpatient-layer]')!;
    for (const path of Array.from(layer.querySelectorAll('path'))) {
      const ctm = (path as SVGPathElement).getScreenCTM();
      if (!ctm) continue;
      for (const m of (path.getAttribute('d') ?? '').matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)) {
        const p = new DOMPoint(Number(m[1]), Number(m[2])).matrixTransform(ctm);
        const hit = document.elementFromPoint(p.x, p.y);
        if (hit && layer.contains(hit) && hit.getAttribute('pointer-events') !== 'none') return { x: p.x, y: p.y };
      }
    }
    return null;
  });
  expect(pos, 'an uncovered measurement point of a per-patient curve').not.toBeNull();
  await page.mouse.move(0, 0);
  await page.mouse.move(pos!.x, pos!.y);
  return pos!;
}

function patientTooltip(page: Page): Locator {
  return odCard(page).getByTestId('outcomes-hover-tooltip-od');
}

test.beforeEach(async ({ page, request, loginAs }) => {
  await seedTestkohorte(request);
  await loginAs('klinikleitung');
  await openSavedCohortAnalysis(page);
  await openTrajectories(page);
  await tickPerPatient(page);
});

test('[Z0-P20] Mouseover eines Einzelverlaufs nennt Pseudonym und Aktion', async ({ page }) => {
  const pos = await hoverPerPatientPoint(page);
  const tip = patientTooltip(page);
  await expect(tip).toBeVisible();
  const patientRow = tip.locator('[data-tooltip-row]').filter({ hasText: /^Patient: / });
  await expect(patientRow).toHaveCount(1);
  const pseudonym = ((await patientRow.textContent()) ?? '').replace(/^Patient: /, '').trim();
  expect(pseudonym.length).toBeGreaterThan(0);
  expect(((await tip.textContent()) ?? '').trim().endsWith('Klicken öffnet die Einzelfallansicht')).toBe(true);
  // "that patient": a click at the same position opens the case view of the same pseudonym.
  await page.mouse.click(pos.x, pos.y);
  await page.waitForURL(/\/case\//);
  await expect(page.getByText(pseudonym, { exact: true }).first()).toBeVisible();
});

test('[Z0-P20] Zeiger zeigt Klickbarkeit', async ({ page }) => {
  const pos = await hoverPerPatientPoint(page);
  await expect(patientTooltip(page)).toBeVisible();
  const cursor = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    return el ? getComputedStyle(el).cursor : null;
  }, pos);
  expect(cursor).toBe('pointer');
});

test('[Z0-P20] Englische Oberfläche', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('emd-locale', 'en'));
  await page.reload();
  await openTrajectories(page);
  await expect(page.locator('[role="tab"][aria-controls="analysis-tab-trajectories"]')).toHaveText(/Trajectories/);
  await tickPerPatient(page, true); // the Background's tick, kept after the reload (no-op if the session kept it)
  await hoverPerPatientPoint(page);
  const tip = patientTooltip(page);
  await expect(tip).toBeVisible();
  expect(((await tip.textContent()) ?? '').trim().endsWith('Click to open the case view')).toBe(true);
});
