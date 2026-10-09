// Automated acceptance tests — area DAT (Datengrundlage). Pilot of the UseAVibe AT suite (build prompt §5.6).
import { readFileSync } from 'node:fs';

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
