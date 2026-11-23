// Z0-P14 — Einzelfallansicht und Kohortenvergleich aus der Datenqualität auffindbar (acceptance/Z0/Z0-P14.feature).
// Synthetic data only.
// Readings (PLAN Z0-P14 and the binding answers C10, C11, Q12 a, Q13):
// - "the case panel" = the detail panel right of the case list; "its header row" = the row that holds the pseudonym
//   heading (h3). The button is moved there, not duplicated (C10/Q13): exactly one button "Vollständige Fallansicht".
// - "next to the pseudonym" = same header row (vertical overlap with the h3) and directly right of it.
// - "the tooltip" = the shared hover/focus tooltip (role="tooltip", Z0-P02, Q12 a), hidden before the hover.
// - "the Einzelfallansicht of the selected case opens" = route /case/<id> whose h1 is the selected pseudonym.
// - "the selector 'Vergleichskohorte wählen'" = as in Z0-P23/Z0-P26 (C11): the always-visible button "Kohorten
//   vergleichen" opens the aside "Vergleichskohorte wählen", whose first option is "Alle Patienten".
import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../fixtures';

const BUTTON = 'Vollständige Fallansicht';
const TOOLTIP = 'Einzelfallansicht mit Verläufen und Vergleich mit einer Kohorte öffnen';
const HINT = 'In der vollständigen Fallansicht können Sie diesen Fall mit einer Kohorte vergleichen.';

/** Rows of the case list (left column), as in AT-QUAL (qual.spec.ts). */
const caseRows = (page: Page) => page.locator('button').filter({ has: page.locator('p.font-mono') });

function fullCaseViewButton(page: Page): Locator {
  return page.getByRole('button', { name: BUTTON, exact: true });
}

let pseudonym = '';

test.beforeEach(async ({ page, loginAs }) => {
  await loginAs('klinikleitung');
  await page.goto('/quality');
  await expect(page.getByRole('heading', { name: 'Datenqualität', level: 1 })).toBeVisible();
  const first = caseRows(page).first();
  await expect(first).toBeVisible();
  pseudonym = ((await first.locator('p.font-mono').first().textContent()) ?? '').trim();
  expect(pseudonym).not.toBe('');
  await first.click();
  await expect(page.locator('h3', { hasText: new RegExp(`^${pseudonym}$`) })).toBeVisible();
});

test('[Z0-P14] Einzelfallansicht als deutliche Schaltfläche', async ({ page }) => {
  const heading = page.locator('h3', { hasText: new RegExp(`^${pseudonym}$`) });
  const button = fullCaseViewButton(page);
  await expect(button).toHaveCount(1);
  await expect(button).toBeVisible();

  // Same header row as the pseudonym: vertical overlap, placed right of it.
  const h = (await heading.boundingBox())!;
  const b = (await button.boundingBox())!;
  const hCentre = h.y + h.height / 2;
  expect(hCentre, 'button in the header row of the pseudonym').toBeGreaterThanOrEqual(b.y);
  expect(hCentre, 'button in the header row of the pseudonym').toBeLessThanOrEqual(b.y + b.height);
  expect(b.x, 'button right of the pseudonym').toBeGreaterThanOrEqual(h.x + h.width);

  // Visible as a button (border or background), not as plain link text.
  const styled = await button.evaluate((el) => {
    const s = getComputedStyle(el);
    return parseFloat(s.borderTopWidth) > 0 || (s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent');
  });
  expect(styled, 'rendered as a button (border or fill)').toBe(true);

  const visibleTooltips = page.locator('[role="tooltip"]:visible');
  await page.mouse.move(0, 0);
  await expect(visibleTooltips).toHaveCount(0);
  await button.hover();
  await expect(visibleTooltips).toHaveCount(1);
  await expect(visibleTooltips).toHaveText(TOOLTIP);
  await expect(button).toHaveAccessibleDescription(TOOLTIP);
});

test('[Z0-P14] Hinweis auf den Kohortenvergleich', async ({ page }) => {
  await expect(page.getByText(HINT, { exact: true })).toBeVisible();
});

test('[Z0-P14] Einzelfallansicht öffnen', async ({ page }) => {
  await fullCaseViewButton(page).click();
  await page.waitForURL(/\/case\/[^/?#]+/);
  await expect(page.getByRole('heading', { level: 1, name: pseudonym, exact: true })).toBeVisible();

  const compare = page.getByRole('button', { name: 'Kohorten vergleichen', exact: true });
  await expect(compare).toBeVisible();
  await compare.click();
  const selector = page.getByRole('complementary', { name: 'Vergleichskohorte wählen', exact: true });
  await expect(selector).toBeVisible();
  await expect(selector.locator('[data-compare-option-label]').first()).toHaveText(/^Alle Patienten \(N=\d+ Patient:innen\)$/);
});
