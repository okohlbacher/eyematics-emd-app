// Z0-P24 — Erklärung von Bestätigen und Ausschließen in der Datenqualität (acceptance/Z0/Z0-P24.feature).
// Synthetic data only.
// Readings (PLAN Z0-P24 and the binding answers C16 a, Q12 a):
// - "the first button 'Bestätigen'" = the first per-row confirm button, whose accessible name starts with
//   "Bestätigen" (aria-label "Bestätigen <param> <date>", qual.spec.ts). Its native title stays "Bestätigen" (C16 a).
// - "a tooltip" = the shared hover/focus tooltip (role="tooltip", Z0-P02, Q12 a), hidden before the hover.
// - "shown or announced as accessible description" = on keyboard focus the tooltip is visible AND the button's
//   accessible description (aria-describedby) contains the text.
import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../fixtures';

/** Rows of the case list (left column), as in AT-QUAL (qual.spec.ts). */
const caseRows = (page: Page) => page.locator('button').filter({ has: page.locator('p.font-mono') });

const visibleTooltips = (page: Page) => page.locator('[role="tooltip"]:visible');

async function hoverAndGetTooltip(page: Page, target: Locator): Promise<Locator> {
  await page.mouse.move(0, 0);
  await expect(visibleTooltips(page)).toHaveCount(0);
  await target.hover();
  await expect(visibleTooltips(page)).toHaveCount(1);
  return visibleTooltips(page);
}

test.beforeEach(async ({ page, loginAs }) => {
  await loginAs('klinikleitung');
  await page.goto('/quality');
  await expect(page.getByRole('heading', { name: 'Datenqualität', level: 1 })).toBeVisible();
  const first = caseRows(page).first();
  await expect(first).toBeVisible();
  const pseudonym = ((await first.locator('p.font-mono').first().textContent()) ?? '').trim();
  expect(pseudonym).not.toBe('');
  await first.click();
  await expect(page.locator('h3', { hasText: new RegExp(`^${pseudonym}$`) })).toBeVisible();
});

test('[Z0-P24] Bestätigen erklärt Wirkung und Geltungsbereich', async ({ page }) => {
  const confirm = page.getByRole('button', { name: /^Bestätigen/ }).first();
  await expect(confirm).toBeVisible();
  // C16 a: the native title stays "Bestätigen" (AT-SYS-RB-001-01).
  await expect(confirm).toHaveAttribute('title', 'Bestätigen');
  const tooltip = await hoverAndGetTooltip(page, confirm);
  await expect(tooltip).toContainText('Markiert diesen Messwert als geprüft und korrekt');
  await expect(tooltip).toContainText('gilt nur für Ihr Benutzerkonto');
  await expect(tooltip).toContainText('Die Daten im Quellsystem werden nicht verändert');
});

test('[Z0-P24] Ausschließen erklärt Wirkung und Geltungsbereich', async ({ page }) => {
  const exclude = page.getByRole('button', { name: 'Von Analysen ausschließen', exact: true });
  await expect(exclude).toBeVisible();
  const tooltip = await hoverAndGetTooltip(page, exclude);
  await expect(tooltip).toContainText('Dieser Fall wird in Ihren Kohortenanalysen nicht mehr berücksichtigt');
  await expect(tooltip).toContainText('gilt nur für Ihr Benutzerkonto');
  await expect(tooltip).toContainText('rückgängig');
});

test('[Z0-P24] Erklärung per Tastatur erreichbar', async ({ page }) => {
  const exclude = page.getByRole('button', { name: 'Von Analysen ausschließen', exact: true });
  await expect(exclude).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(visibleTooltips(page)).toHaveCount(0);
  await exclude.focus();
  await expect(exclude).toBeFocused();
  await expect(exclude).toHaveAccessibleDescription(/gilt nur für Ihr Benutzerkonto/);
  await expect(visibleTooltips(page)).toHaveCount(1);
  await expect(visibleTooltips(page)).toContainText('gilt nur für Ihr Benutzerkonto');
});

test('[Z0-P24] Englische Oberfläche', async ({ page }) => {
  await page.getByRole('button', { name: 'English', exact: true }).click();
  const exclude = page.getByRole('button', { name: 'Exclude from analyses', exact: true });
  await expect(exclude).toBeVisible();
  const tooltip = await hoverAndGetTooltip(page, exclude);
  await expect(tooltip).toContainText('applies to your user account only');
});
