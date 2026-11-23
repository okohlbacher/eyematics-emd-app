// Z0-P18 — Einzelfallansicht von jeder Seite aus öffnen (acceptance/Z0/Z0-P18.feature).
// Synthetic data only.
// "the navigation" = the navigation landmark inside the sidebar (<aside>); "the search field 'Fall öffnen (Pseudonym)'"
// = a combobox with that accessible name (PLAN Z0-P18: combobox ARIA pattern).
// "open, one after another" = click the sidebar links "Startseite", "Kohortenbildung", "Analyse", "Datenqualität".
// "an existing pseudonym" = a pseudonym of the synthetic bundles (public/data); "the suggestions" = the combobox's
// listbox; "choose that pseudonym" = click the option whose accessible name is exactly that pseudonym (Q15 b: all
// substring matches are listed, so it is among them).
// "Einzelfallansicht of that case" = route /case/<id of that case> whose level-1 heading is the bare pseudonym (as in
// Z0-P09). PLAN Z0-P18 (AT-FALL-002-01): the chosen pseudonym does not remain in the field after navigation.
// "a user restricted to '1' site" = forscher1 (centers: org-uka, data/users.json); "a pseudonym of another site" = a
// synthetic pseudonym of a case outside org-uka whose first 8 characters occur in no org-uka pseudonym (Q40);
// "the suggestion list shows 'Kein Fall gefunden'" = the listbox holds that text and no pseudonym option.
import type { Locator, Page } from '@playwright/test';

import { extractPatientCases } from '../../../shared/patientCases';
import { localBundles } from '../../acceptance-at/helpers';
import { expect, test } from '../fixtures';

const FIELD = 'Fall öffnen (Pseudonym)';
const PAGES = [
  { link: 'Startseite', path: '/' },
  { link: 'Kohortenbildung', path: '/cohort' },
  { link: 'Analyse', path: '/analysis' },
  { link: 'Datenqualität', path: '/quality' },
];

const cases = extractPatientCases(localBundles() as unknown as Parameters<typeof extractPatientCases>[0]);

function navigation(page: Page): Locator {
  return page.locator('aside').getByRole('navigation');
}

function field(page: Page): Locator {
  return navigation(page).getByRole('combobox', { name: FIELD, exact: true });
}

function suggestions(page: Page): Locator {
  return navigation(page).getByRole('listbox');
}

test('[Z0-P18] Fallsuche in der Navigation', async ({ page, loginAs }) => {
  await loginAs('klinikleitung');
  let visited = 0;
  for (const { link, path } of PAGES) {
    await navigation(page).getByRole('link', { name: link, exact: true }).click();
    await page.waitForURL((url) => url.pathname === path);
    await expect(field(page), `search field on "${link}"`).toBeVisible();
    visited++;
  }
  expect(visited).toBe(4);
});

test('[Z0-P18] Fall über die Navigation öffnen', async ({ page, loginAs }) => {
  const target = cases[Math.floor(cases.length / 2)];
  await loginAs('klinikleitung');
  await page.goto('/analysis');

  await field(page).fill(target.pseudonym.slice(0, 8));
  await expect(suggestions(page)).toBeVisible();
  await suggestions(page).getByRole('option', { name: target.pseudonym, exact: true }).click();

  await page.waitForURL((url) => url.pathname === `/case/${encodeURIComponent(target.id)}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(target.pseudonym);
  await expect(field(page)).toHaveValue('');
});

test('[Z0-P18] Nur berechtigte Fälle werden vorgeschlagen', async ({ page, loginAs }) => {
  const own = cases.filter((c) => c.centerId === 'org-uka').map((c) => c.pseudonym);
  expect(own.length).toBeGreaterThan(0);
  const other = cases.find(
    (c) => c.centerId !== 'org-uka' && !own.some((p) => p.includes(c.pseudonym.slice(0, 8))),
  );
  expect(other, 'a pseudonym of another site with a distinct 8-character prefix').toBeDefined();

  await loginAs('forscher1');
  await field(page).fill(other!.pseudonym.slice(0, 8));
  await expect(suggestions(page)).toBeVisible();
  await expect(suggestions(page)).toContainText('Kein Fall gefunden');
  await expect(suggestions(page).getByRole('option', { name: /EM-/ })).toHaveCount(0);
});
