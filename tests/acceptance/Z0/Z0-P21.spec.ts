// Z0-P21 — Einzelverlauf durch Klick auf die Kurve öffnen (acceptance/Z0/Z0-P21.feature). Synthetic data only.
// Readings (PLAN Z0-P21 §3/§5, binding answers C14 "yes", Q12 b):
// - "a per-patient curve" = a per-patient path in the Verläufe OD card (`[data-perpatient-layer] path` that takes pointer
//   events); "its measurement points" = the vertices of its `d` attribute (one per measurement).
// - "halfway between two of its measurement points" = the screen midpoint of a straight segment between two consecutive
//   vertices of that path, at least 30 px long so that the midpoint is clearly away from both measurements; the first such
//   midpoint at which the topmost element is a per-patient curve (nothing else, e.g. the median line, covers it).
// - "the tooltip of that curve … after 'Patient'" = the row "Patient: <Pseudonym>" of the per-patient tooltip
//   `[data-testid="outcomes-hover-tooltip-od"]` while the mouse rests there.
// - "the 'Einzelfallansicht' of that patient opens" = navigation to /case/<id>; "its header" = the case view's `h1`.
// - "that curve is drawn wider than the other per-patient curves, by at least 1 px" = the widest visible (painted) path in
//   the per-patient layer with the hovered curve's geometry (`d`) has a computed stroke-width at least 1 px larger than every
//   visible per-patient path with a different geometry.
// - "the tooltip shows the pseudonym of that patient" = the Patient row equals the case-view header reached by a click at
//   the same position (the click opens the curve under the pointer).
// - "a measurement point of a per-patient curve" = an uncovered vertex of a per-patient path (as in Z0-P20).
import type { APIRequestContext, Locator, Page } from '@playwright/test';

import { apiToken, bearer } from '../../acceptance-at/helpers';
import { expect, test } from '../fixtures';

const COHORT = 'Testkohorte';
const MIN_SEGMENT_PX = 30;

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
async function tickPerPatient(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Diagramm-Anzeige', exact: true }).click();
  const settings = page.getByRole('complementary', { name: 'Einstellungen', exact: true });
  const box = settings.getByRole('checkbox', { name: 'Individuelle Kurven', exact: true });
  if (!(await box.isChecked())) await box.check();
  await expect(box).toBeChecked();
  await page.keyboard.press('Escape');
}

function odCard(page: Page): Locator {
  return page.getByTestId('analysis-tab-trajectories').locator('[data-testid="outcomes-panel-od"][role="img"]');
}

function patientTooltip(page: Page): Locator {
  return odCard(page).getByTestId('outcomes-hover-tooltip-od');
}

async function waitForCurves(page: Page): Promise<void> {
  const card = odCard(page);
  await expect(card.locator('[data-perpatient-layer] path').first()).toBeAttached({ timeout: 30_000 });
  await card.scrollIntoViewIfNeeded();
}

/** Screen midpoint of a ≥ 30 px segment between two consecutive measurements of a per-patient curve, uncovered. */
async function curveMidpoint(page: Page): Promise<{ x: number; y: number }> {
  await waitForCurves(page);
  const pos = await odCard(page).evaluate((el, minLen) => {
    const layer = el.querySelector('[data-perpatient-layer]')!;
    for (const path of Array.from(layer.querySelectorAll('path'))) {
      if (path.getAttribute('pointer-events') === 'none') continue;
      const ctm = (path as SVGPathElement).getScreenCTM();
      if (!ctm) continue;
      let prev: DOMPoint | null = null;
      for (const m of (path.getAttribute('d') ?? '').matchAll(/([ML])(-?[\d.]+),(-?[\d.]+)/g)) {
        const p = new DOMPoint(Number(m[2]), Number(m[3])).matrixTransform(ctm);
        if (m[1] === 'L' && prev && Math.hypot(p.x - prev.x, p.y - prev.y) >= minLen) {
          const mid = { x: (p.x + prev.x) / 2, y: (p.y + prev.y) / 2 };
          const hit = document.elementFromPoint(mid.x, mid.y);
          if (hit && hit.tagName.toLowerCase() === 'path' && layer.contains(hit) && hit.getAttribute('pointer-events') !== 'none') {
            return mid;
          }
        }
        prev = p;
      }
    }
    return null;
  }, MIN_SEGMENT_PX);
  expect(pos, 'a per-patient curve that is hit halfway between two of its measurement points').not.toBeNull();
  return pos!;
}

/** Screen position of an uncovered measurement point (vertex) of a per-patient curve (as in Z0-P20). */
async function measurementPoint(page: Page): Promise<{ x: number; y: number }> {
  await waitForCurves(page);
  const pos = await odCard(page).evaluate((el) => {
    const layer = el.querySelector('[data-perpatient-layer]')!;
    for (const path of Array.from(layer.querySelectorAll('path'))) {
      if (path.getAttribute('pointer-events') === 'none') continue;
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
  return pos!;
}

async function hoverAt(page: Page, pos: { x: number; y: number }): Promise<void> {
  await page.mouse.move(0, 0);
  await page.mouse.move(pos.x, pos.y);
}

/** Pseudonym after "Patient" in the per-patient tooltip. */
async function tooltipPseudonym(page: Page): Promise<string> {
  const tip = patientTooltip(page);
  await expect(tip).toBeVisible();
  const row = tip.locator('[data-tooltip-row]').filter({ hasText: /^Patient: / });
  await expect(row).toHaveCount(1);
  const pseudonym = ((await row.textContent()) ?? '').replace(/^Patient: /, '').trim();
  expect(pseudonym.length).toBeGreaterThan(0);
  return pseudonym;
}

async function clickAndExpectCaseOf(page: Page, pos: { x: number; y: number }, pseudonym: string): Promise<void> {
  await page.mouse.click(pos.x, pos.y);
  await page.waitForURL(/\/case\//);
  await expect(page.locator('h1').filter({ hasText: pseudonym })).toHaveText(pseudonym);
}

test.beforeEach(async ({ page, request, loginAs }) => {
  await seedTestkohorte(request);
  await loginAs('klinikleitung');
  await openSavedCohortAnalysis(page);
  await openTrajectories(page);
  await tickPerPatient(page);
});

test('[Z0-P21] Klick auf die Linie zwischen zwei Messungen', async ({ page }) => {
  const pos = await curveMidpoint(page);
  await hoverAt(page, pos);
  const pseudonym = await tooltipPseudonym(page);
  await clickAndExpectCaseOf(page, pos, pseudonym);
});

test('[Z0-P21] Kurve beim Überfahren hervorheben', async ({ page }) => {
  const pos = await curveMidpoint(page);
  await hoverAt(page, pos);
  const pseudonym = await tooltipPseudonym(page);
  const widths = await odCard(page).evaluate((el, p) => {
    const layer = el.querySelector('[data-perpatient-layer]')!;
    const hovered = document.elementFromPoint(p.x, p.y);
    const d = hovered && layer.contains(hovered) ? hovered.getAttribute('d') : null;
    const painted = Array.from(layer.querySelectorAll('path')).filter((path) => {
      const cs = getComputedStyle(path);
      return cs.stroke !== 'none' && cs.stroke !== 'transparent' && cs.stroke !== 'rgba(0, 0, 0, 0)' && Number(cs.strokeOpacity) > 0;
    });
    const w = (path: Element) => parseFloat(getComputedStyle(path).strokeWidth);
    const own = painted.filter((path) => path.getAttribute('d') === d).map(w);
    const others = painted.filter((path) => path.getAttribute('d') !== d).map(w);
    return { d, own: own.length ? Math.max(...own) : null, others: others.length ? Math.max(...others) : null };
  }, pos);
  expect(widths.d, 'the hovered element is a per-patient curve').not.toBeNull();
  expect(widths.own, 'the hovered curve is drawn').not.toBeNull();
  expect(widths.others, 'other per-patient curves are drawn').not.toBeNull();
  expect(widths.own! - widths.others!).toBeGreaterThanOrEqual(1);
  // "that patient": the curve under the pointer opens the case view of the pseudonym the tooltip names.
  await clickAndExpectCaseOf(page, pos, pseudonym);
});

test('[Z0-P21] Klick auf einen Messpunkt funktioniert weiterhin', async ({ page }) => {
  const pos = await measurementPoint(page);
  await hoverAt(page, pos);
  const pseudonym = await tooltipPseudonym(page);
  await clickAndExpectCaseOf(page, pos, pseudonym);
});
