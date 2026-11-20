// Z0-P09 — Fälle mit kritischen Werten aus der Kohortenanalyse öffnen (acceptance/Z0/Z0-P09.feature).
// Synthetic data only.
// "Testkohorte" = saved cohort with age >= 70 (as in Z0-P22); the precondition "at least 1 case with a CRT above
// 400 µm" is checked against the synthetic bundles (public/data) with a one-year margin on the age bound.
// "the number shown before …" = the leading integer of the button's text "<n> Fälle mit kritischen Werten (…)".
// "a list 'Fälle mit kritischen Werten' opens" = a dialog with that accessible name holding one listitem per case.
// "the pseudonym" of an entry = a pseudonym of the synthetic bundles; "the highest CRT value in µm" = "<n> µm" equal
// to the rounded maximum CRT of a case with that pseudonym (PLAN Z0-P09, Q28: sorted by that value, descending).
// "Einzelfallansicht of that case" = route /case/<id> with the patient header; "next to 'Pseudonym'" = a caption
// "Pseudonym" in the same container as the level-1 heading that holds the bare pseudonym (Q35 a).
import type { APIRequestContext, Locator, Page } from '@playwright/test';

import { LOINC_CRT } from '../../../shared/fhirCodes';
import { getObservationsByCode } from '../../../shared/fhirQueries';
import { extractPatientCases, getAge } from '../../../shared/patientCases';
import { apiToken, bearer, localBundles } from '../../acceptance-at/helpers';
import { expect, test } from '../fixtures';

const COHORT = 'Testkohorte';
const FILTERS = { ageRange: [70, null] };
const THRESHOLD = 400;
const BUTTON_TEXT = 'Fälle mit kritischen Werten (CRT > 400 µm)';
const LIST_NAME = 'Fälle mit kritischen Werten';

/** Rounded highest CRT per pseudonym (all cases of the pseudonym) in the synthetic bundles. */
function maxCrtByPseudonym(): Map<string, number[]> {
  const cases = extractPatientCases(localBundles() as unknown as Parameters<typeof extractPatientCases>[0]);
  const out = new Map<string, number[]>();
  for (const c of cases) {
    const values = getObservationsByCode(c.observations, LOINC_CRT)
      .map((o) => o.valueQuantity?.value)
      .filter((v): v is number => typeof v === 'number');
    if (values.length === 0) continue;
    out.set(c.pseudonym, [...(out.get(c.pseudonym) ?? []), Math.round(Math.max(...values))]);
  }
  return out;
}

async function seedCohort(request: APIRequestContext): Promise<void> {
  const headers = bearer(await apiToken(request, 'klinikleitung'));
  const list = await request.get('/api/data/saved-searches', { headers });
  expect(list.status()).toBe(200);
  const { savedSearches } = (await list.json()) as { savedSearches: { id: string; name: string }[] };
  for (const s of savedSearches.filter((x) => x.name === COHORT)) {
    expect((await request.delete(`/api/data/saved-searches/${s.id}`, { headers })).status()).toBe(200);
  }
  const created = await request.post('/api/data/saved-searches', { headers, data: { name: COHORT, filters: FILTERS } });
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

function criticalButton(page: Page): Locator {
  return page.getByRole('button', { name: new RegExp(`^\\d+ ${BUTTON_TEXT.replace(/[()]/g, '\\$&')}$`) });
}

function criticalList(page: Page): Locator {
  return page.getByRole('dialog', { name: LIST_NAME, exact: true });
}

async function openCriticalList(page: Page): Promise<Locator> {
  await criticalButton(page).click();
  const dialog = criticalList(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

test.beforeEach(async ({ page, request, loginAs }) => {
  const cases = extractPatientCases(localBundles() as unknown as Parameters<typeof extractPatientCases>[0]);
  const precondition = cases.some(
    (c) =>
      getAge(c.birthDate) >= 71 &&
      getObservationsByCode(c.observations, LOINC_CRT).some((o) => (o.valueQuantity?.value ?? 0) > THRESHOLD),
  );
  expect(precondition, `"${COHORT}" contains a case with CRT > ${THRESHOLD} µm`).toBe(true);
  await seedCohort(request);
  await loginAs('klinikleitung');
  await openCohortAnalysis(page);
});

test('[Z0-P09] Anzahl kritischer Fälle ist bedienbar', async ({ page }) => {
  await expect(criticalButton(page)).toHaveCount(1);
  await expect(criticalButton(page)).toBeVisible();
});

test('[Z0-P09] Liste der kritischen Fälle', async ({ page }) => {
  const shown = Number(/^(\d+)/.exec((await criticalButton(page).innerText()).trim())![1]);
  expect(shown).toBeGreaterThan(0);

  const dialog = await openCriticalList(page);
  const entries = dialog.getByRole('listitem');
  await expect(entries).toHaveCount(shown);

  const known = maxCrtByPseudonym();
  const values: number[] = [];
  for (const text of await entries.allInnerTexts()) {
    const pseudonym = [...known.keys()].find((p) => text.includes(p));
    expect(pseudonym, `entry "${text}" shows a pseudonym`).toBeDefined();
    const m = /(\d+) µm/.exec(text);
    expect(m, `entry "${text}" shows a CRT in µm`).not.toBeNull();
    const crt = Number(m![1]);
    expect(crt).toBeGreaterThan(THRESHOLD);
    expect(known.get(pseudonym!), `entry "${text}" shows the highest CRT of its case`).toContain(crt);
    values.push(crt);
  }
  expect(values, 'entries sorted by highest CRT, descending (Q28)').toEqual([...values].sort((a, b) => b - a));
});

test('[Z0-P09] Vollständige Fallansicht aus der Liste öffnen', async ({ page }) => {
  const dialog = await openCriticalList(page);
  const first = dialog.getByRole('listitem').first();
  const known = [...maxCrtByPseudonym().keys()];
  const entryText = await first.innerText();
  const pseudonym = known.find((p) => entryText.includes(p));
  expect(pseudonym).toBeDefined();

  await first.getByRole('button', { name: 'Vollständige Fallansicht' }).click();
  await page.waitForURL(/\/case\/[^/?#]+/);
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveText(pseudonym!);
  await expect(heading.locator('xpath=..').getByText('Pseudonym', { exact: true })).toBeVisible();
});

test('[Z0-P09] Zurück zur Kohortenanalyse', async ({ page }) => {
  const dialog = await openCriticalList(page);
  await dialog.getByRole('listitem').first().getByRole('button', { name: 'Vollständige Fallansicht' }).click();
  await page.waitForURL(/\/case\/[^/?#]+/);

  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await page.waitForURL(/\/analysis\?/);
  await expect(page.getByRole('heading', { level: 1, name: 'Kohortenanalyse' })).toBeVisible();
  await expect(page.getByTestId('analysis-active-cohort')).toContainText(COHORT);
});
