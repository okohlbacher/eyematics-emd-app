// Automated acceptance tests — area USM (Benutzer- und Zugriffsverwaltung). Pilot of the UseAVibe AT suite
// (build prompt §5.6); each title carries the AT case ID of data/ats/Akzeptanztests_EMD_Dashboard.xlsx.
// Synthetic data only. Expected results restate the workbook's "Erwartetes Ergebnis"; statuses are set by humans.
import { expect, test } from '../acceptance/fixtures';

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
