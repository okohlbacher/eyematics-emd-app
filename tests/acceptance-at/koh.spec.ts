// Automated acceptance tests — area KOH (Kohortenbildung). UseAVibe AT suite, wave 1 (decision O-16 a); each title
// carries the AT case ID of data/ats/Akzeptanztests_EMD_Dashboard.xlsx. Synthetic data only. Expected results restate
// the workbook's "Erwartetes Ergebnis"; statuses are set by humans.
import { expect, test } from '../acceptance/fixtures';
import { cohortCount, cohortPseudonyms, filterGroup, saveCohort, suffix } from './helpers';

const isSubset = (sub: string[], sup: string[]) => {
  const s = new Set(sup);
  return sub.every((x) => s.has(x));
};

// [assessment] Cohort → Subkohorte → 2. Ebene are formed by adding one criterion per level in Kohortenbildung
// (AMD → + Weiblich → + one centre). Cohort and Subkohorte are also saved under the app's naming scheme
// "<Kohorte>:<Subkohorte>"; that scheme admits only one colon, so the 2nd level is formed (filtered and listed) by
// adding a criterion to the loaded Subkohorte, not saved as a named third level.
test('[AT-KOH-003-02] subcohorts are subsets of the parent cohort; two-level subdivision; cases are listed', async ({ page, loginAs }) => {
  const name = `AT-KOH-003-02 ${suffix()}`;
  await loginAs('klinikleitung'); // decision O-11
  await page.goto('/cohort');
  await page.getByRole('button', { name: 'Zurücksetzen' }).click();

  // Kohorte: Diagnose AMD
  await filterGroup(page, 'Diagnose').getByText('AMD (Altersbedingte Makuladegeneration)').click();
  const level0 = await cohortPseudonyms(page);
  const n0 = await cohortCount(page);
  expect(level0.length, 'cohort cases listed').toBe(n0);
  expect(n0).toBeGreaterThan(0);
  await saveCohort(page, name);

  // Subkohorte: + Geschlecht Weiblich
  await filterGroup(page, 'Geschlecht').getByText('Weiblich', { exact: true }).click();
  const level1 = await cohortPseudonyms(page);
  const n1 = await cohortCount(page);
  expect(level1.length, 'subcohort cases listed').toBe(n1);
  expect(n1).toBeGreaterThan(0);
  expect(n1, 'subcohort smaller than its parent').toBeLessThan(n0);
  expect(isSubset(level1, level0), 'subcohort ⊆ cohort').toBe(true);
  await saveCohort(page, `${name}:weiblich`);
  await page.getByRole('button', { name: /^Gespeicherte Suchen/ }).click();
  await expect(page.getByText(`${name}:weiblich`, { exact: true }), 'subcohort saved').toBeVisible();

  // 2. Ebene: the saved Subkohorte, further divided by one centre
  const sub = page.locator('div.rounded-lg').filter({ has: page.getByText(`${name}:weiblich`, { exact: true }) });
  await sub.getByTitle('Ausführen').click();
  await expect.poll(() => cohortCount(page), 'saved subcohort reloads the same cases').toBe(n1);
  await filterGroup(page, 'Zentren').getByText('Universitätsklinikum Aachen').click();
  const level2 = await cohortPseudonyms(page);
  const n2 = await cohortCount(page);
  expect(level2.length, '2nd-level cases listed').toBe(n2);
  expect(n2).toBeGreaterThan(0);
  expect(n2, '2nd level smaller than the subcohort').toBeLessThan(n1);
  expect(isSubset(level2, level1), '2nd level ⊆ subcohort').toBe(true);
  expect(isSubset(level2, level0), '2nd level ⊆ cohort').toBe(true);
});

test('[AT-KOH-003-03] criteria without hits: empty result shown unambiguously as „0 Fälle“, no error', async ({ page, loginAs }) => {
  await loginAs('klinikleitung');
  const pageErrors: Error[] = [];
  page.on('pageerror', (e) => pageErrors.push(e));
  await page.goto('/cohort');
  await page.getByRole('button', { name: 'Zurücksetzen' }).click();
  expect(await cohortCount(page)).toBeGreaterThan(0);

  // No synthetic patient is 0–1 years old.
  const age = filterGroup(page, 'Alter (Jahre)');
  await age.getByPlaceholder('Min').fill('0');
  await age.getByPlaceholder('Max').fill('1');

  await expect(page.getByRole('heading', { name: 'Kohorte: 0 Fälle' })).toBeVisible();
  await expect(page.getByText('Keine Fälle ausgewählt')).toBeVisible();
  await expect(page.getByRole('alert'), 'no error / validation message').toHaveCount(0);
  expect(await cohortPseudonyms(page), 'table view lists no case').toEqual([]);
  await expect(page.getByText(/Fehler|Error/)).toHaveCount(0);
  expect(pageErrors, 'no uncaught page error').toEqual([]);
});
