// Z0-P10 — Alle Kennzahlen der Verläufe verwenden die ausgewählte Kohorte (acceptance/Z0/Z0-P10.feature).
// Synthetic data only.
// "Kohortenanalyse header" = the count line "<c> Fälle in der aktuellen Kohorte · <p> Patient:innen" (C5 a).
// "the tab shows the number of patients" = the Verläufe subtitle (data-testid "outcomes-subtitle",
// "<p> Patient:innen · <c> Fälle") while that metric tab is selected; it is the only patient count every one of the
// four metric tabs displays.
// "a case aged at least 70" = a PatientCase of the synthetic bundles (public/data) with that pseudonym whose age
// (shared getAge, the function the cohort filter uses) is >= 70.
import type { Locator, Page } from '@playwright/test';

import { extractPatientCases, getAge } from '../../../shared/patientCases';
import { cohortCount, filterGroup, localBundles } from '../../acceptance-at/helpers';
import { expect, test } from '../fixtures';

const MIN_AGE = 70;
const METRIC_TABS = [
  { testId: 'metric-tab-visus', name: 'Visus' },
  { testId: 'metric-tab-crt', name: 'CRT' },
  { testId: 'metric-tab-interval', name: 'Behandlungsintervall' },
  { testId: 'metric-tab-responder', name: 'Responder' },
] as const;

function trajectoriesPanel(page: Page): Locator {
  return page.getByTestId('analysis-tab-trajectories');
}

async function headerPatientCount(page: Page): Promise<number> {
  const line = page.getByText(/^\d+ Fälle in der aktuellen Kohorte · \d+ Patient:innen/);
  await expect(line).toBeVisible();
  return Number(/· (\d+) Patient:innen/.exec(await line.innerText())![1]);
}

test.beforeEach(async ({ page, loginAs }) => {
  await loginAs('klinikleitung');
  await page.goto('/cohort');
  await page.getByRole('button', { name: 'Zurücksetzen' }).click();
  await filterGroup(page, 'Alter (Jahre)').getByPlaceholder('Min').fill(String(MIN_AGE));
  expect(await cohortCount(page)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Kohorte analysieren', exact: true }).click();
  await page.waitForURL(/\/analysis\?/);
  await page.getByRole('tab', { name: 'Verläufe', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Verläufe', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('[Z0-P10] Jeder Kennzahl-Tab zeigt die ausgewählte Kohorte', async ({ page }) => {
  const patients = await headerPatientCount(page);
  expect(patients, 'the synthetic cohort is not empty').toBeGreaterThan(0);

  for (const tab of METRIC_TABS) {
    const button = trajectoriesPanel(page).getByTestId(tab.testId);
    await expect(button).toContainText(tab.name);
    await button.click();
    await expect(button).toHaveAttribute('aria-selected', 'true');
    await expect(
      trajectoriesPanel(page).getByTestId('outcomes-subtitle'),
      `tab "${tab.name}" shows the header's patient count`,
    ).toHaveText(new RegExp(`^${patients} Patient:innen · \\d+ Fälle$`));
    await expect(page.getByText('Keine Patient:innen in dieser Kohorte'), `tab "${tab.name}"`).toHaveCount(0);
  }
});

test('[Z0-P10] Rohdaten enthalten nur Fälle der ausgewählten Kohorte', async ({ page }) => {
  const cases = extractPatientCases(localBundles() as unknown as Parameters<typeof extractPatientCases>[0]);
  const ageOk = new Map<string, boolean>();
  for (const c of cases) ageOk.set(c.pseudonym, (ageOk.get(c.pseudonym) ?? false) || getAge(c.birthDate) >= MIN_AGE);

  const preview = trajectoriesPanel(page).getByTestId('outcomes-data-preview').first();
  await preview.getByText('Rohdaten anzeigen', { exact: true }).click();
  await expect(preview).toHaveAttribute('open', '');
  const rows = preview.locator('table tbody tr');
  await expect(rows.first()).toBeVisible();
  const pseudonyms = [...new Set(await rows.locator('td:first-child').allInnerTexts())].map((p) => p.trim());
  expect(pseudonyms.length).toBeGreaterThan(0);

  const outside = pseudonyms.filter((p) => ageOk.get(p) !== true);
  expect(outside, `pseudonyms in "Rohdaten" without a case aged >= ${MIN_AGE}`).toEqual([]);
});
