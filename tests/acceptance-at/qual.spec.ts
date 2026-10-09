// Automated acceptance tests — area QUAL (Datenqualität). UseAVibe AT suite, wave 1 (decision O-16 a); each title
// carries the AT case ID of data/ats/Akzeptanztests_EMD_Dashboard.xlsx. Synthetic data only. Expected results restate
// the workbook's "Erwartetes Ergebnis"; statuses are set by humans.
//
// [assessment] Mapping of workbook terms to the app (Datenqualität, /quality):
//  - „Prüfmodus für eine Subkohorte“ = /quality with the „Kohorte“ scope set to the saved subcohort
//    ("<Kohorte>:<Subkohorte>", created in Kohortenbildung — here created through the data API as a precondition);
//  - „zu prüfende Parameter“ = the checklist „Qualitätsprüfungen für diese Kohorte“;
//  - Prüfstatus „ungeprüft / unvollständig / abgeschlossen“ = „Ungeprüft / In Bearbeitung / Geprüft“.
// Review state is stored per user on the server and survives between runs: every test restores the user's flags,
// exclusions and reviewed marks through the data API afterwards (finally), and picks cases that are „Ungeprüft“.
import type { APIRequestContext, Page } from '@playwright/test';

import { expect, test } from '../acceptance/fixtures';
import { apiToken, bearer, repositorySnapshot, suffix } from './helpers';

test.describe.configure({ timeout: 120_000 }); // multi-step review flows

const USER = 'klinikleitung'; // decision O-11
const SNOMED_AMD = '267718000';

interface Flag { caseId: string; parameter: string; errorType: string; status: string }

/** Precondition „Subkohorte gebildet“: cohort AMD and its subcohort AMD ∩ UKA, saved for USER. */
async function createSubcohort(request: APIRequestContext, token: string) {
  const parent = `AT-QUAL ${suffix()}`;
  const sub = `${parent}:UKA`;
  for (const [name, filters] of [
    [parent, { diagnosis: [SNOMED_AMD] }],
    [sub, { diagnosis: [SNOMED_AMD], centers: ['org-uka'] }],
  ] as const) {
    const r = await request.post('/api/data/saved-searches', { headers: bearer(token), data: { name, filters } });
    expect(r.status(), `create saved search ${name}`).toBe(201);
  }
  return { parent, sub };
}

/** Snapshot of USER's review state (flags, exclusions, reviewed marks); returns a restore function. */
async function preserveReviewState(request: APIRequestContext, token: string) {
  const get = async (p: string) => (await (await request.get(`/api/data/${p}`, { headers: bearer(token) })).json()) as Record<string, unknown>;
  const flags = (await get('quality-flags')).qualityFlags;
  const excluded = (await get('excluded-cases')).excludedCases;
  const reviewed = (await get('reviewed-cases')).reviewedCases;
  return async () => {
    await request.put('/api/data/quality-flags', { headers: bearer(token), data: { qualityFlags: flags } });
    await request.put('/api/data/excluded-cases', { headers: bearer(token), data: { excludedCases: excluded } });
    await request.put('/api/data/reviewed-cases', { headers: bearer(token), data: { reviewedCases: reviewed } });
  };
}

async function flagsOf(request: APIRequestContext, token: string, caseId?: string): Promise<Flag[]> {
  const all = ((await (await request.get('/api/data/quality-flags', { headers: bearer(token) })).json()) as { qualityFlags: Flag[] }).qualityFlags;
  return caseId ? all.filter((f) => f.caseId === caseId) : all;
}

const cohortSelect = (page: Page) => page.locator('select').filter({ has: page.locator('option', { hasText: 'Alle Fälle' }) });

async function openQuality(page: Page, cohort?: string) {
  await page.goto('/quality');
  await expect(page.getByRole('heading', { name: 'Datenqualität', level: 1 })).toBeVisible();
  if (cohort) await cohortSelect(page).selectOption({ label: cohort });
}

/** Rows of the case list (left column). */
const caseRows = (page: Page) => page.locator('button').filter({ has: page.locator('p.font-mono') });

async function openFilters(page: Page) {
  const status = page.locator('label', { hasText: 'Prüfstatus' });
  if (!(await status.isVisible())) await page.getByTitle('Filterkriterien').click();
  await expect(status).toBeVisible();
}

async function setFilter(page: Page, label: 'Prüfstatus' | 'Therapiestatus', option: string) {
  await openFilters(page);
  await page.locator('label', { hasText: label }).locator('xpath=..').locator('select').selectOption({ label: option });
}

/** Pseudonyms currently listed (all rows are rendered; the list only scrolls). */
const listedPseudonyms = async (page: Page) => (await caseRows(page).locator('p.font-mono').allInnerTexts()).map((s) => s.trim());

async function selectCase(page: Page, pseudonym: string) {
  await caseRows(page).filter({ has: page.locator('p.font-mono', { hasText: new RegExp(`^${pseudonym}$`) }) }).click();
  await expect(page.locator('h3', { hasText: new RegExp(`^${pseudonym}$`) })).toBeVisible();
}

const measurementRows = (page: Page) => page.locator('table.table-fixed tbody tr');

/** Expands „Fallstatus & Prüfprotokoll“ (if collapsed) and returns the card. */
async function openLog(page: Page) {
  const details = page.locator('details').filter({ hasText: 'Fallstatus & Prüfprotokoll' });
  if (!(await details.evaluate((d) => (d as HTMLDetailsElement).open))) await details.locator('summary').click();
  return details;
}

async function flagRow(page: Page, row: ReturnType<typeof measurementRows>, typeLabel: string) {
  await row.getByTitle('Fehler melden').click();
  const dialog = page.locator('div.fixed').filter({ hasText: 'Fehler kennzeichnen' });
  await dialog.locator('select').selectOption({ label: typeLabel });
  await dialog.getByRole('button', { name: 'Fehler melden' }).click();
  await expect(dialog).toHaveCount(0);
}

/** First open (un-judged), non-anomalous measurement row of the selected case. */
const openCleanRow = (page: Page) =>
  measurementRows(page).filter({ has: page.getByRole('button', { name: /^Bestätigen/ }) }).filter({ has: page.locator('[aria-label="Status: Offen"]') }).first();

/** Measurement row of a param key "<Parameter> (<Datum>)" (the key a flag is stored under). */
function rowByKey(page: Page, key: string) {
  const label = key.slice(0, key.lastIndexOf(' ('));
  const date = key.slice(key.lastIndexOf('(') + 1, -1);
  return measurementRows(page)
    .filter({ has: page.locator('td:nth-child(1)', { hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) })
    .filter({ has: page.locator('td:nth-child(2)', { hasText: new RegExp(`^${date}$`) }) })
    .first();
}

/** Param key "<Parameter> (<Datum>)" as stored in the flag, from a measurement row. */
async function paramKey(row: ReturnType<typeof measurementRows>): Promise<string> {
  const cells = row.locator('td');
  return `${(await cells.nth(0).innerText()).trim()} (${(await cells.nth(1).innerText()).trim()})`;
}

// ---------------------------------------------------------------------------------------------------------------------

test('[AT-QUAL-001-01] parameters to check can be selected for a subcohort and are stored for it', async ({ page, loginAs, request }) => {
  const token = await apiToken(request, USER);
  const { parent, sub } = await createSubcohort(request, token);
  await loginAs(USER);
  await openQuality(page, sub);

  const card = page.locator('div.rounded-xl').filter({ has: page.getByText('Qualitätsprüfungen für diese Kohorte', { exact: true }) });
  const box = (label: string) => card.getByRole('checkbox', { name: label });
  const all = ['Kein Visus dokumentiert', 'Keine CRT dokumentiert', 'Keine Injektionen dokumentiert', 'CRT > 400 µm (kritisch)', 'Visus < 0.1 (kritisch)', 'Sprung > 0.3'];
  for (const l of all) await expect(box(l), `${l} selectable, default on`).toBeChecked();

  const deselect = ['CRT > 400 µm (kritisch)', 'Sprung > 0.3'];
  for (const l of deselect) {
    const saved = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().includes('/api/data/saved-searches/'));
    await box(l).click();
    expect((await saved).status(), `selection change of ${l} persisted`).toBe(200);
    await expect(box(l)).not.toBeChecked();
  }

  // Stored for the subcohort: survives a reload, and the parent cohort keeps its own (default) selection.
  await openQuality(page, sub);
  for (const l of all) {
    if (deselect.includes(l)) await expect(box(l), `${l} stays off`).not.toBeChecked();
    else await expect(box(l), `${l} stays on`).toBeChecked();
  }
  await cohortSelect(page).selectOption({ label: parent });
  for (const l of all) await expect(box(l), `parent cohort unaffected: ${l}`).toBeChecked();

  const saved = ((await (await request.get('/api/data/saved-searches', { headers: bearer(token) })).json()) as {
    savedSearches: { name: string; qualityParams?: string[] }[];
  }).savedSearches;
  expect(saved.find((s) => s.name === sub)?.qualityParams, 'stored selection of the subcohort').toEqual(['missingVisus', 'missingCrt', 'missingInjections', 'visusCritical']);
});

// AT-QUAL-002-01 is not part of the committed suite: deviation candidate (a partially checked case — one of its values
// judged — is shown as „Geprüft“, indistinguishable from a completed review; see the wave-1 report).

test('[AT-QUAL-003-01] selecting a case of the subcohort opens its review view', async ({ page, loginAs, request }) => {
  const token = await apiToken(request, USER);
  const { sub } = await createSubcohort(request, token);
  await loginAs(USER);
  await openQuality(page, sub);
  await expect(page.getByText('Fall auswählen, um Datenqualität zu prüfen')).toBeVisible();

  const listed = await listedPseudonyms(page);
  expect(listed.length, 'subcohort has cases').toBeGreaterThan(0);
  const centres = new Set((await caseRows(page).locator('p.text-xs').allInnerTexts()).map((s) => s.trim()));
  expect([...centres], 'list restricted to the subcohort (UKA)').toEqual(['Universitätsklinikum Aachen']);

  const chosen = listed[Math.min(3, listed.length - 1)];
  await selectCase(page, chosen);
  await expect(page.getByRole('button', { name: 'Zu prüfende Messwerte' })).toBeVisible();
  await expect(page.locator('table.table-fixed thead th')).toHaveText(['Parameter', 'Datum', 'Wert', 'Status', 'Annotation', 'Aktion']);
  expect(await measurementRows(page).count(), 'values of the selected case listed').toBeGreaterThan(0);
  await expect(page.getByText('Zentrum: Universitätsklinikum Aachen')).toBeVisible();
});

// [assessment] „pro Fall“ = the case's review status (Prüfstatus filter/tiles), its „Fortschritt“ line and its
// „Fallstatus & Prüfprotokoll“ log; „pro Parameter“ = the per-value Status/Annotation in „Zu prüfende Messwerte“
// (registry UIR-QUAL-024/-034). A cross-case view per parameter type does not exist in the app (see report).
test('[AT-QUAL-006-01] review results per case and per parameter are shown and match the recorded verdicts', async ({ page, loginAs, request }) => {
  const token = await apiToken(request, USER);
  const restore = await preserveReviewState(request, token);
  try {
    const { sub } = await createSubcohort(request, token);
    await loginAs(USER);
    await openQuality(page, sub);
    await setFilter(page, 'Prüfstatus', 'Ungeprüft');
    const reviewedCases = (await listedPseudonyms(page)).slice(0, 2);
    expect(reviewedCases).toHaveLength(2);
    await setFilter(page, 'Prüfstatus', 'Alle');

    const caseIds: Record<string, string> = {};
    for (const p of reviewedCases) { // two completed reviews: values confirmed, one value flagged „Duplikat“, case „Geprüft“
      await selectCase(page, p);
      // values are judged one by one (each verdict is saved before the next one is given)
      const keys: string[] = [];
      for (let i = 0; i < 3; i++) {
        const row = openCleanRow(page);
        if ((await row.count()) === 0) break;
        const key = await paramKey(row);
        if (keys.includes(key)) break;
        keys.push(key);
        await rowByKey(page, key).getByRole('button', { name: /^Bestätigen/ }).click();
        await expect(rowByKey(page, key).locator('[aria-label="Status: bestätigt"]')).toBeVisible();
      }
      expect(keys.length, `${p}: values confirmed`).toBeGreaterThan(0);
      const flagged = openCleanRow(page);
      await expect(flagged, `${p}: a further value to flag`).toHaveCount(1);
      const flaggedKey = await paramKey(flagged);
      await flagRow(page, rowByKey(page, flaggedKey), 'Duplikat');
      await expect(rowByKey(page, flaggedKey).locator('td').nth(4)).toContainText('Duplikat');
      const log = await openLog(page);
      await log.getByRole('button', { name: 'Als geprüft markieren' }).click();
      await expect(log.getByRole('button', { name: 'Prüfung aufheben' })).toBeVisible();
      await page.getByRole('button', { name: 'Vollständige Fallansicht' }).click();
      caseIds[p] = /\/case\/([^/?#]+)/.exec(page.url())![1];
      await openQuality(page, sub);
    }

    for (const p of reviewedCases) {
      const recorded = await flagsOf(request, token, caseIds[p]);
      expect(recorded.length, `${p}: verdicts recorded`).toBeGreaterThan(1);
      expect(recorded.filter((f) => f.status === 'open').map((f) => f.errorType), `${p}: one recorded error`).toEqual(['Duplikat']);

      // per case
      await openQuality(page, sub);
      await setFilter(page, 'Prüfstatus', 'Geprüft');
      expect(await listedPseudonyms(page), `${p} shown as „Geprüft“`).toContain(p);
      await selectCase(page, p);
      const judged = recorded.filter((f) => f.status === 'acknowledged').length;
      const total = await measurementRows(page).count();
      await expect(page.getByText(new RegExp(`Fortschritt:\\s*${judged} / ${total} beurteilt`)), `${p}: progress`).toBeVisible();
      const log = await openLog(page);
      await expect(log.locator('summary'), `${p}: log size`).toContainText(`${recorded.length} Einträge`);
      for (const f of recorded) {
        const verb = f.status === 'acknowledged' ? 'als korrekt bestätigt' : 'als Fehler markiert';
        await expect(log.getByText(`${f.parameter} — ${verb}`, { exact: false }).first(), `${p}: log ${f.parameter}`).toBeVisible();
      }

      // per parameter
      for (const f of recorded) {
        const row = rowByKey(page, f.parameter);
        if (f.status === 'acknowledged') {
          await expect(row.locator('[aria-label="Status: bestätigt"]'), `${p}: ${f.parameter} bestätigt`).toBeVisible();
        } else {
          await expect(row.locator('td').nth(4), `${p}: ${f.parameter} annotated`).toContainText(f.errorType);
          await expect(row.locator('[aria-label="Status: bestätigt"]')).toHaveCount(0);
        }
      }
    }
  } finally {
    await restore();
  }
});

// [assessment] Status of the error handling per parameter = the flag's state: open („als Fehler markiert“, annotation)
// → acknowledged („Bestätigen“ → pill „bestätigt“, log „als korrekt bestätigt“); per case = Prüfstatus.
test('[AT-QUAL-007-01] error-handling status per case and per flagged parameter shown and updated; repository unchanged', async ({ page, loginAs, request }) => {
  const token = await apiToken(request, USER);
  const restore = await preserveReviewState(request, token);
  const snapshotBefore = await repositorySnapshot(request, token);
  try {
    const { sub } = await createSubcohort(request, token);
    await loginAs(USER);
    await openQuality(page, sub);
    await setFilter(page, 'Prüfstatus', 'Ungeprüft');
    const [p] = await listedPseudonyms(page);
    await setFilter(page, 'Prüfstatus', 'Alle');
    await selectCase(page, p);

    // Precondition: a parameter of the case flagged as faulty.
    const row = openCleanRow(page);
    const key = await paramKey(row);
    const value = (await row.locator('td').nth(2).innerText()).trim();
    const target = rowByKey(page, key);
    await flagRow(page, target, 'Unplausibler Wert');

    // Status per parameter
    await expect(target.locator('td').nth(4)).toContainText('Unplausibel');
    let log = await openLog(page);
    await expect(log.getByText(`${key} — als Fehler markiert · Unplausibel`)).toBeVisible();
    // Status per case
    await setFilter(page, 'Prüfstatus', 'In Bearbeitung');
    expect(await listedPseudonyms(page), 'case „In Bearbeitung“').toContain(p);

    // Change the status of the flagged parameter
    await setFilter(page, 'Prüfstatus', 'Alle');
    await selectCase(page, p);
    await target.getByRole('button', { name: /^Bestätigen/ }).click();
    await expect(target.locator('[aria-label="Status: bestätigt"]')).toBeVisible();
    log = await openLog(page);
    await expect(log.getByText(`${key} — als korrekt bestätigt · Unplausibel`)).toBeVisible();
    await expect(log.getByText(`${key} — als Fehler markiert`)).toHaveCount(0);
    await setFilter(page, 'Prüfstatus', 'In Bearbeitung');
    expect(await listedPseudonyms(page), 'case status updated (no open error left)').not.toContain(p);

    // No change in the primary system / repository: the value itself and the repository snapshot are unchanged.
    await setFilter(page, 'Prüfstatus', 'Alle');
    await selectCase(page, p);
    await expect(target.locator('td').nth(2)).toHaveText(value);
    expect(await repositorySnapshot(request, token), 'repository content unchanged').toBe(snapshotBefore);
  } finally {
    await restore();
  }
});

test('[AT-QUAL-010-01] therapy filters return exactly the flagged therapy discontinuers / interrupters', async ({ page, loginAs }) => {
  await loginAs(USER);
  await openQuality(page);
  await openFilters(page);

  // Kennzeichnungen (QUAL-009): red „AB“ = Therapieabbrecher, amber „UB“ = Therapieunterbrecher, per list row.
  const rowsWith = async () =>
    caseRows(page).evaluateAll((els) =>
      els.map((el) => ({
        key: `${el.querySelector('p.font-mono')?.textContent?.trim()}|${el.querySelector('p.text-xs')?.textContent?.trim()}`,
        badge: Array.from(el.querySelectorAll('span')).map((s) => s.textContent?.trim()).find((t) => t === 'AB' || t === 'UB') ?? '',
      })),
    );
  const all = await rowsWith();
  const ab = all.filter((r) => r.badge === 'AB').map((r) => r.key).sort();
  const ub = all.filter((r) => r.badge === 'UB').map((r) => r.key).sort();
  expect(ab.length, 'flagged therapy discontinuers exist').toBeGreaterThan(0);
  expect(ub.length, 'flagged therapy interrupters exist').toBeGreaterThan(0);

  await setFilter(page, 'Therapiestatus', 'Therapieabbrecher');
  await expect(page.getByText(`${ab.length} gefiltert / ${all.length} Fälle`)).toBeVisible();
  expect((await rowsWith()).map((r) => r.key).sort(), 'filter = exactly the AB-flagged cases').toEqual(ab);

  await setFilter(page, 'Therapiestatus', 'Therapieunterbrecher');
  await expect(page.getByText(`${ub.length} gefiltert / ${all.length} Fälle`)).toBeVisible();
  expect((await rowsWith()).map((r) => r.key).sort(), 'filter = exactly the UB-flagged cases').toEqual(ub);
});
