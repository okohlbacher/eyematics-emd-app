// Automated acceptance tests — area FALL (Fallansicht). UseAVibe AT suite, wave 1 (decision O-16 a); each title
// carries the AT case ID of data/ats/Akzeptanztests_EMD_Dashboard.xlsx. Synthetic data only. Expected results restate
// the workbook's "Erwartetes Ergebnis"; statuses are set by humans.
import { expect, test } from '../acceptance/fixtures';
import { cohortPseudonyms, filterGroup, localBundles } from './helpers';

test('[AT-FALL-001-01] selecting a case from the cohort list opens its detail view with the same pseudonym', async ({ page, loginAs }) => {
  await loginAs('klinikleitung'); // decision O-11
  await page.goto('/cohort');
  // Precondition: a cohort with cases is shown — diagnosis AMD, table view („Detailansicht“).
  await filterGroup(page, 'Diagnose').getByText('AMD (Altersbedingte Makuladegeneration)').click();
  const pseudonyms = await cohortPseudonyms(page);
  expect(pseudonyms.length, 'cohort has cases').toBeGreaterThan(2);
  const chosen = pseudonyms[2];

  await page.locator('table tbody tr').nth(2).click();
  await expect(page).toHaveURL(/\/case\/[^/]+$/);
  await expect(page.getByRole('heading', { level: 1 }), 'pseudonym of the selected case').toHaveText(chosen);
  await expect(page.getByText('Fall nicht gefunden')).toHaveCount(0);
});

// [assessment] Identifier list for AT-FALL-002-01, derived from what the synthetic FHIR bundles (public/data, loaded
// by the server) actually contain for the opened patient:
//  - Patient.birthDate (exact date; checked as ISO "YYYY-MM-DD", "DD.MM.YYYY" and "D.M.YYYY"),
//  - Patient.name / address / telecom / non-pseudonym identifier values — none exist in the bundles (asserted below,
//    so the list is complete for this data set),
//  - ids of the patient's Encounters (closest analogue of a KIS-Fallnummer) and the DICOM Study/Series/Instance UIDs
//    of its ImagingStudies.
// Not on the list: the pseudonym (urn:eyematics:pseudonym, the value that must be shown) and the FHIR logical id of
// the Patient resource (e.g. "pat-uka-001"), a repository-internal technical key that the app uses in the route
// /case/<id>. Whether that key counts as a direct identifier is for the test lead to decide (reported, not asserted).
const CASE_ID = 'pat-uka-001'; // UKA patient with pseudonym identifier and an OCT ImagingStudy

function identifiersOf(patientId: string): { pseudonym: string; values: string[] } {
  const resources = localBundles().flatMap((b) => b.entry.map((e) => e.resource));
  const patient = resources.find((r) => r.resourceType === 'Patient' && r.id === patientId);
  if (!patient) throw new Error(`synthetic patient ${patientId} not found in public/data`);
  for (const k of ['name', 'address', 'telecom', 'contact', 'photo']) {
    expect(patient[k], `Patient.${k} absent in the synthetic bundle`).toBeUndefined();
  }
  const ids = (patient.identifier ?? []) as { system?: string; value?: string }[];
  const pseudonym = ids.find((i) => i.system === 'urn:eyematics:pseudonym')?.value;
  if (!pseudonym) throw new Error(`patient ${patientId} has no pseudonym identifier`);
  const values: string[] = ids.filter((i) => i.system !== 'urn:eyematics:pseudonym').map((i) => i.value ?? '');

  const birth = String(patient.birthDate);
  const [y, m, d] = birth.split('-');
  values.push(birth, `${d}.${m}.${y}`, `${Number(d)}.${Number(m)}.${y}`);

  const ref = `Patient/${patientId}`;
  for (const r of resources) {
    const subject = (r.subject as { reference?: string } | undefined)?.reference;
    if (subject !== ref) continue;
    if (r.resourceType === 'Encounter') values.push(r.id);
    if (r.resourceType === 'ImagingStudy') {
      const series = (r.series ?? []) as { uid: string; instance?: { uid: string }[] }[];
      for (const s of series) values.push(s.uid, ...(s.instance ?? []).map((i) => i.uid));
    }
  }
  return { pseudonym, values: values.filter(Boolean) };
}

test('[AT-FALL-002-01] case view shows pseudonymised data only — no direct identifiers in text, tooltips, title, URL', async ({ page, loginAs }) => {
  const { pseudonym, values } = identifiersOf(CASE_ID);
  expect(values.length).toBeGreaterThan(3);

  await loginAs('klinikleitung');
  await page.goto(`/case/${CASE_ID}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(pseudonym);
  await expect(page.getByText('Alter:').first()).toBeVisible(); // age instead of the birth date
  await page.waitForLoadState('networkidle');

  const surface = await page.evaluate(() => {
    const attrs: string[] = [];
    for (const el of Array.from(document.querySelectorAll('*'))) {
      for (const a of Array.from(el.attributes)) {
        if (/^(title|alt|aria-label|aria-description|placeholder|href|src|download|value|data-.*)$/.test(a.name)) attrs.push(a.value);
      }
    }
    return { text: document.body.innerText, attrs: attrs.join('\n'), title: document.title, url: location.href };
  });
  // Case view offers no download (no export control on /case/<id>) — asserted so a new download would be noticed.
  await expect(page.locator('main').getByRole('button', { name: /CSV|JSON|Export|Download|herunterladen/i })).toHaveCount(0);

  for (const v of values) {
    expect(surface.text, `page text must not contain ${v}`).not.toContain(v);
    expect(surface.attrs, `attributes (tooltips etc.) must not contain ${v}`).not.toContain(v);
    expect(surface.title, `document title must not contain ${v}`).not.toContain(v);
    expect(surface.url, `URL must not contain ${v}`).not.toContain(v);
  }
});
