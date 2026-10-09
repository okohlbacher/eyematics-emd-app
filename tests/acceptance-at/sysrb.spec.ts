// Automated acceptance tests — area SYS-RB (Systemrandbedingungen). UseAVibe AT suite, wave 1 (decision O-16 a); each
// title carries the AT case ID of data/ats/Akzeptanztests_EMD_Dashboard.xlsx. Synthetic data only. Expected results
// restate the workbook's "Erwartetes Ergebnis"; statuses are set by humans.
import { expect, test } from '../acceptance/fixtures';
import { apiToken, bearer, repositorySnapshot } from './helpers';

const USER = 'klinikleitung'; // decision O-11
const CASE_ID = 'pat-uka-001';
const PSEUDONYM = 'EM-UKA-0001';
const EDIT_LABEL = /bearbeiten|löschen|entfernen|hinzufügen|anlegen|ändern|speichern|neue[rs]? (wert|messung|befund)/i;

// [assessment] „Prüfsumme/Snapshot des Repositorys“ = SHA-256 over the read API's repository content
// (GET /api/fhir/bundles + /api/fhir/centers), before and after; container file inspection is wave 3.
// „Funktionen zum Anlegen/Ändern/Löschen medizinischer Daten“ are looked for in the case view (/case/<id>) and in
// the review detail (/quality): editable fields, edit/delete/add controls, and write methods on the FHIR API.
test('[AT-SYS-RB-001-01] no create/change/delete of medical data; QUAL actions leave the repository unchanged', async ({ page, loginAs, request }) => {
  test.setTimeout(90_000);
  const token = await apiToken(request, USER);
  const before = await repositorySnapshot(request, token);
  const state = async (p: string) => (await (await request.get(`/api/data/${p}`, { headers: bearer(token) })).json()) as Record<string, unknown>;
  const saved = { flags: (await state('quality-flags')).qualityFlags, excluded: (await state('excluded-cases')).excludedCases, reviewed: (await state('reviewed-cases')).reviewedCases };

  try {
    // 1. Case view: no editable fields and no edit/delete/add controls for medical data.
    await loginAs(USER);
    await page.goto(`/case/${CASE_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(PSEUDONYM);
    const main = page.locator('main');
    await expect(main.locator('textarea, [contenteditable="true"], input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])'), 'no input fields in the case view').toHaveCount(0);
    await expect(main.getByRole('button', { name: EDIT_LABEL }), 'no edit/delete/add control in the case view').toHaveCount(0);

    // 2. Review detail: values are read-only; row actions are review verdicts only.
    await page.goto('/quality');
    await page.getByPlaceholder('Pseudonym suchen...').fill(PSEUDONYM);
    await page.locator('button').filter({ has: page.locator('p.font-mono', { hasText: new RegExp(`^${PSEUDONYM}$`) }) }).click();
    const table = page.locator('table.table-fixed');
    await expect(table.locator('tbody tr').first()).toBeVisible();
    await expect(table.locator('input, textarea, select, [contenteditable="true"]'), 'measurement values not editable').toHaveCount(0);
    const titles = await table.locator('tbody button').evaluateAll((bs) => bs.map((b) => b.getAttribute('title') ?? ''));
    expect(new Set(titles), 'only review actions per value').toEqual(new Set(titles.filter((t) => ['Bestätigen', 'Fehler melden', 'Zurücksetzen'].includes(t))));
    await expect(page.locator('main').getByRole('button', { name: EDIT_LABEL }), 'no edit/delete/add control in the review view').toHaveCount(0);

    // 3. FHIR API offers no write method.
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
      for (const path of ['/api/fhir/bundles', `/api/fhir/Patient/${CASE_ID}`]) {
        const r = await request.fetch(path, { method, headers: bearer(token), data: { resourceType: 'Patient', id: CASE_ID } });
        expect(r.status(), `${method} ${path} rejected`).toBeGreaterThanOrEqual(400);
      }
    }

    // 4. QUAL functions: Kennzeichnung (flag a value), Ausschluss (exclude the case), Prüfstatus (mark reviewed).
    const row = table.locator('tbody tr').filter({ has: page.getByTitle('Fehler melden') }).first();
    await row.getByTitle('Fehler melden').click();
    const dialog = page.locator('div.fixed').filter({ hasText: 'Fehler kennzeichnen' });
    await dialog.locator('select').selectOption({ label: 'Unplausibler Wert' });
    await dialog.getByRole('button', { name: 'Fehler melden' }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole('button', { name: 'Von Analysen ausschließen' }).click();
    await expect(page.getByRole('button', { name: 'In Analysen einschließen' })).toBeVisible();
    const details = page.locator('details').filter({ hasText: 'Fallstatus & Prüfprotokoll' });
    await details.locator('summary').click();
    await details.getByRole('button', { name: 'Als geprüft markieren' }).click();
    await expect(details.getByRole('button', { name: 'Prüfung aufheben' })).toBeVisible();
    await expect.poll(async () => ((await state('excluded-cases')).excludedCases as string[]).includes(CASE_ID), 'exclusion stored').toBe(true);

    // 5. Repository snapshot unchanged.
    expect(await repositorySnapshot(request, token), 'repository content unchanged').toBe(before);
  } finally {
    await request.put('/api/data/quality-flags', { headers: bearer(token), data: { qualityFlags: saved.flags } });
    await request.put('/api/data/excluded-cases', { headers: bearer(token), data: { excludedCases: saved.excluded } });
    await request.put('/api/data/reviewed-cases', { headers: bearer(token), data: { reviewedCases: saved.reviewed } });
  }
});
