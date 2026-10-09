// Automated acceptance tests — area DAT (Datengrundlage). Pilot of the UseAVibe AT suite (build prompt §5.6).
import { readFileSync } from 'node:fs';

import type { Page } from '@playwright/test';

import { expect, test } from '../acceptance/fixtures';

const centers: { shorthand: string; name: string }[] = JSON.parse(readFileSync('data/centers.json', 'utf8'));

test('[AT-DAT-002-01] landing page lists every connected centre with name and site', async ({ page, loginAs }) => {
  await loginAs('klinikleitung'); // all sites (decision O-11)
  await page.goto('/');
  const main = page.locator('main');
  for (const c of centers) {
    await expect(main.getByText(c.shorthand, { exact: true }).first(), `centre ${c.shorthand}`).toBeVisible();
    await expect(main.getByText(c.name).first(), `name of ${c.shorthand}`).toBeVisible();
  }
});

// ---- Wave 1 (decision O-16 a) -------------------------------------------------------------------------------------
// [assessment] „allgemeine Informationen zur Datengrundlage“ = the landing page's data-basis figures (Angeschlossene
// Zentren, Pseudonymisierte Fälle, Messwerte gesamt) and the section „Angeschlossene Zentren und Standorte“.
async function expectLandingPage(page: Page) {
  await expect(page).toHaveURL(/\/$/);
  const main = page.locator('main');
  await expect(main.getByText('Klinischer Demonstrator — Datenübersicht')).toBeVisible();
  for (const label of ['Angeschlossene Zentren', 'Pseudonymisierte Fälle', 'Messwerte gesamt']) {
    await expect(main.getByText(label, { exact: true }).first(), label).toBeVisible();
  }
  await expect(main.getByText('Angeschlossene Zentren und Standorte')).toBeVisible();
  await expect(main.getByText(`${centers.length} online`), 'number of connected centres').toBeVisible();
}

test('[AT-DAT-001-01] after login the landing page shows the data basis; reachable again via navigation', async ({ page, loginAs }) => {
  await loginAs('klinikleitung'); // researcher-style case (decision O-11)
  await expectLandingPage(page); // directly after the login, without navigating

  await page.getByRole('link', { name: 'Kohortenbildung' }).click();
  await expect(page).toHaveURL(/\/cohort/);
  await page.getByRole('link', { name: 'Analyse' }).click();
  await expect(page).toHaveURL(/\/analysis/);

  await page.getByRole('link', { name: 'Startseite' }).click();
  await expectLandingPage(page);
});
