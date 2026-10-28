// Automated acceptance tests — area USM (Benutzer- und Zugriffsverwaltung). Pilot of the UseAVibe AT suite
// (build prompt §5.6); each title carries the AT case ID of data/ats/Akzeptanztests_EMD_Dashboard.xlsx.
// Synthetic data only. Expected results restate the workbook's "Erwartetes Ergebnis"; statuses are set by humans.
import type { Page } from '@playwright/test';

import { expect, test } from '../acceptance/fixtures';
import { apiToken, bearer, loginWithPassword, suffix } from './helpers';

test('[AT-USM-005-03] protected pages and API without login: redirect to login / 401, no data', async ({ page, request }) => {
  for (const route of ['/cohort', '/case/pat-ukt-027', '/admin', '/analysis']) {
    await page.goto(route);
    await expect(page, `${route} must redirect to the login`).toHaveURL(/\/login/);
  }
  for (const api of ['/api/fhir/centers', '/api/fhir/bundles', '/api/data/quality-flags', '/api/audit']) {
    const r = await request.get(api);
    expect([401, 403], `${api} without token`).toContain(r.status());
    expect(await r.text()).not.toContain('"resourceType"');
  }
});

test('[AT-USM-007-01] logout reachable on every page; session invalid afterwards', async ({ page, loginAs }) => {
  for (const route of ['/', '/cohort', '/analysis', '/quality']) {
    await loginAs('klinikleitung');
    await page.goto(route);
    const logout = page.getByTitle('Abmelden');
    await expect(logout, `logout control on ${route}`).toBeVisible();
    await logout.click();
    await expect(page).toHaveURL(/\/login/);
    await page.goBack();
    await page.goto(route);
    await expect(page, `${route} after logout`).toHaveURL(/\/login/);
  }
});

// ---- Wave 1 (decision O-16 a) -------------------------------------------------------------------------------------
// Admin form on /admin („Nutzerverwaltung“): Benutzerkennung, Vorname, Nachname (both mandatory in this app), Rolle
// (select), „Zentren zuweisen“ (site toggle buttons), „Speichern“. The workbook's role „Forscher*in“ is labelled
// „Forscher/in“ in the UI. Sites: A = UKA, B = UKC (synthetic roster data/centers.json).

/** Opens the „Nutzer anlegen“ form and returns accessors for its labelled fields. */
async function openAddUserForm(page: Page) {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Nutzerverwaltung' })).toBeVisible();
  await page.getByRole('button', { name: 'Nutzer anlegen' }).click();
  const form = page.locator('div.space-y-4').filter({ has: page.getByRole('heading', { name: 'Nutzer anlegen' }) });
  // label → its wrapping <div>, which also holds the input/select and the field's validation message
  const field = (label: string) => form.locator('label', { hasText: label }).first().locator('xpath=..');
  return {
    form,
    field,
    username: field('Benutzerkennung').locator('input'),
    firstName: field('Vorname').locator('input'),
    lastName: field('Nachname').locator('input'),
    role: field('Rolle').locator('select'),
    site: (shorthand: string) => field('Zentren zuweisen').getByRole('button', { name: shorthand, exact: true }),
    save: form.getByRole('button', { name: 'Speichern', exact: true }),
  };
}

/** Row of the „Registrierte Nutzer“ table whose first cell is exactly `username`. */
function userRow(page: Page, username: string) {
  return page.locator('tbody tr').filter({ has: page.locator('td:first-child', { hasText: new RegExp(`^${username}\\b`) }) });
}

test('[AT-USM-001-01] admin creates an account (ID, role Forscher*in, site A); listed with ID, role and site; login works', async ({ page, loginAs }) => {
  const id = `at.usm001.${suffix()}`;
  await loginAs('admin');
  const f = await openAddUserForm(page);
  await f.username.fill(id);
  await f.firstName.fill('Test');
  await f.lastName.fill('Forschung');
  await f.role.selectOption({ label: 'Forscher/in' });
  await f.site('UKA').click();
  await f.save.click();

  await expect(page.getByText('Benutzer erfolgreich erstellt')).toBeVisible();
  const password = (await page.locator('code').first().innerText()).trim();
  expect(password.length, 'one-time generated password shown').toBeGreaterThan(8);

  const row = userRow(page, id);
  await expect(row, 'new account listed once').toHaveCount(1);
  const cells = row.locator('td');
  await expect(cells.nth(0)).toHaveText(id);
  await expect(cells.nth(2)).toHaveText('Forscher/in');
  await expect(cells.nth(3)).toHaveText('UKA');

  await page.getByTitle('Abmelden').click();
  await expect(page).toHaveURL(/\/login/);
  await loginWithPassword(page, id, password);
  await expect(page, 'logged in with the new account').not.toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Willkommen');
});

test('[AT-USM-001-02] account with two sites (A, B): both assigned and shown in the account details', async ({ page, loginAs }) => {
  const id = `at.usm002.${suffix()}`;
  await loginAs('admin');
  const f = await openAddUserForm(page);
  await f.username.fill(id);
  await f.firstName.fill('Test');
  await f.lastName.fill('Zweistandort');
  await f.role.selectOption({ label: 'Forscher/in' });
  await f.site('UKA').click();
  await f.site('UKC').click();
  await f.save.click();
  await expect(page.getByText('Benutzer erfolgreich erstellt')).toBeVisible();

  const row = userRow(page, id);
  await expect(row.locator('td').nth(3), 'list shows both sites').toHaveText(/UKA\s*UKC/);

  // [assessment] „Kontodetails öffnen“ = the account's „Bearbeiten“ view (the app has no separate details page):
  // the assigned sites are the highlighted (selected) site buttons there.
  await row.getByTitle('Bearbeiten').click();
  const edit = page.locator('tbody tr').filter({ has: page.getByRole('button', { name: 'Speichern' }) });
  const selected = edit.locator('button.bg-blue-50');
  await expect(selected).toHaveText(['UKA', 'UKC']);
});

test('[AT-USM-001-03] account without role / site / user ID cannot be saved; message names the missing field', async ({ page, loginAs }) => {
  await loginAs('admin');
  const countLine = page.getByText(/^\d+ Nutzer$/);

  // (a) without Benutzerkennung → „Pflichtfeld“ in the Benutzerkennung field
  let f = await openAddUserForm(page);
  await expect(countLine).toBeVisible();
  const before = await countLine.innerText();
  await f.firstName.fill('Test');
  await f.lastName.fill('OhneKennung');
  await f.site('UKA').click();
  await f.save.click();
  await expect(f.field('Benutzerkennung').getByText('Pflichtfeld')).toBeVisible();
  await expect(f.form, 'form stays open, nothing saved').toBeVisible();
  await expect(page.getByText('Benutzer erfolgreich erstellt')).toHaveCount(0);
  await expect(countLine).toHaveText(before);

  // (b) without Standort → „Mindestens ein Standort muss zugewiesen werden“
  const noSite = `at.usm003.nosite.${suffix()}`;
  f = await openAddUserForm(page);
  await f.username.fill(noSite);
  await f.firstName.fill('Test');
  await f.lastName.fill('OhneStandort');
  await f.save.click();
  await expect(f.field('Zentren zuweisen').getByText('Mindestens ein Standort muss zugewiesen werden')).toBeVisible();
  await expect(page.getByText('Benutzer erfolgreich erstellt')).toHaveCount(0);
  await expect(userRow(page, noSite)).toHaveCount(0);
  await expect(countLine).toHaveText(before);

  // (c) without Rolle — [assessment] the UI cannot produce this state: the mandatory „Rolle“ select has no empty
  // option and always holds a role, so saving an account without a role is prevented by construction (a validation
  // message cannot occur). Asserted: every option is a concrete role and the field is marked mandatory (*).
  f = await openAddUserForm(page);
  const values = await f.role.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  expect(values.length).toBeGreaterThan(0);
  for (const v of values) expect(v, 'no empty role option').not.toBe('');
  await expect(f.role).not.toHaveValue('');
  await expect(f.field('Rolle').locator('label')).toContainText('*');
});

test('[AT-USM-003-01] duplicate user ID is rejected with a message about the ID already in use', async ({ page, loginAs, request }) => {
  // Precondition: account „test.user1“ exists (created via the admin API if an earlier run has not done so).
  const token = await apiToken(request, 'admin');
  const pre = await request.post('/api/auth/users', {
    headers: bearer(token),
    data: { username: 'test.user1', firstName: 'Test', lastName: 'User', role: 'researcher', centers: ['org-uka'] },
  });
  expect([201, 409]).toContain(pre.status());

  await loginAs('admin');
  const f = await openAddUserForm(page);
  await f.username.fill('test.user1');
  await f.firstName.fill('Test');
  await f.lastName.fill('Duplikat');
  await f.site('UKA').click();
  await f.save.click();
  await expect(page.getByText('Benutzer erfolgreich erstellt')).toHaveCount(0);
  await expect(page.getByText(/already exists|bereits (vergeben|vorhanden|existiert)/i), 'message: ID already in use').toBeVisible();
  await page.goto('/admin');
  await expect(userRow(page, 'test\\.user1'), 'still exactly one account test.user1').toHaveCount(1);

  // Variant with different letter case is a duplicate too; the message need not differ (test lead, O-21 point 4).
  const g = await openAddUserForm(page);
  await g.username.fill('TEST.User1');
  await g.firstName.fill('Test');
  await g.lastName.fill('Grossschreibung');
  await g.site('UKA').click();
  await g.save.click();
  await expect(page.getByText('Benutzer erfolgreich erstellt')).toHaveCount(0);
  await expect(page.getByText(/already exists|bereits (vergeben|vorhanden|existiert)/i), 'message: ID already in use (case-insensitive)').toBeVisible();
  await page.goto('/admin');
  const anyCase = page.locator('tbody tr').filter({ has: page.locator('td:first-child', { hasText: /^test\.user1\b/i }) });
  await expect(anyCase, 'no second account differing only in letter case').toHaveCount(1);
});

test('[AT-USM-003-02] every account has exactly one unique ID; audit entries attributable to exactly one account', async ({ page, loginAs, request }) => {
  // Generate audit entries of several users (authenticated API activity).
  const actors = ['forscher1', 'klinikleitung'];
  for (const u of actors) {
    const t = await apiToken(request, u);
    expect((await request.get('/api/fhir/centers', { headers: bearer(t) })).status()).toBe(200);
  }

  await loginAs('admin');
  await page.goto('/admin');
  const rows = page.locator('tbody tr').filter({ has: page.getByTitle('Bearbeiten') });
  await expect(rows.first()).toBeVisible();
  const ids = (await rows.locator('td:first-child').allInnerTexts()).map((s) => s.split('\n')[0].trim());
  await expect(page.getByText(`${ids.length} Nutzer`, { exact: true }), 'list complete').toBeVisible();
  for (const id of ids) expect(id, 'every account has a non-empty ID').not.toBe('');
  const lower = ids.map((s) => s.toLowerCase());
  expect(new Set(lower).size, 'IDs unique (also ignoring letter case)').toBe(ids.length);

  await page.goto('/audit');
  await expect(page.getByRole('heading', { name: 'Zugriffsprotokoll' })).toBeVisible();
  const userFilter = page.locator('select').first();
  const cells = page.locator('tbody tr td:nth-child(2)');
  await expect(cells.first()).toBeVisible();
  for (const u of [...actors, 'admin']) {
    // the user filter only offers users present in the loaded entries → reset to „all“ before each pick
    if ((await userFilter.inputValue()) !== '') {
      const all = page.waitForResponse((r) => r.url().includes('/api/audit?') && !r.url().includes('user='));
      await userFilter.selectOption('');
      await all;
    }
    const filtered = page.waitForResponse((r) => r.url().includes(`/api/audit?`) && r.url().includes(`user=${u}`));
    await userFilter.selectOption(u);
    await filtered;
    await expect(cells.first(), `entries of ${u}`).toBeVisible();
    await expect
      .poll(async () => [...new Set((await cells.allInnerTexts()).map((s) => s.trim()))], {
        message: `every entry of ${u} names exactly this one account`,
      })
      .toEqual([u]);
    expect(lower.filter((id) => id === u.toLowerCase()), `${u} maps to exactly one account`).toHaveLength(1);
  }
});
