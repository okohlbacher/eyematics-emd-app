// Shared helpers for the automated acceptance tests (UseAVibe AT suite). Synthetic data only.
// The /data volume persists between runs on the same container: helpers create uniquely named objects (suffix()).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type { APIRequestContext, Locator, Page } from '@playwright/test';

import { expect } from '../acceptance/fixtures';

export const PASSWORD = process.env.USEAVIBE_TEST_PASSWORD ?? 'changeme2025!';

/** Unique, lower-case suffix for names that must not collide with earlier runs on the same /data volume. */
export function suffix(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

/** Bearer token of a seeded (or freshly created) user via POST /api/auth/login (2FA is off by default). */
export async function apiToken(request: APIRequestContext, user: string, password = PASSWORD): Promise<string> {
  const r = await request.post('/api/auth/login', { data: { username: user, password } });
  expect(r.status(), `API login of ${user}`).toBe(200);
  return ((await r.json()) as { token: string }).token;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/**
 * SHA-256 over the repository content as delivered by the read API (FHIR bundles + site roster) — the "snapshot" of
 * AT-SYS-RB-001-01 / AT-QUAL-007-01. Taken through the API, not via container file access (that is wave 3).
 */
export async function repositorySnapshot(request: APIRequestContext, token: string): Promise<string> {
  const h = createHash('sha256');
  for (const path of ['/api/fhir/bundles', '/api/fhir/centers']) {
    const r = await request.get(path, { headers: bearer(token) });
    expect(r.status(), path).toBe(200);
    h.update(path).update(await r.body());
  }
  return h.digest('hex');
}

/** Logs in through the login form with explicit credentials (fixture loginAs uses the seeded default password). */
export async function loginWithPassword(page: Page, user: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.locator('form input[type="text"]').first().fill(user);
  await page.locator('form input[type="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

// ---- Synthetic FHIR bundles (public/data, the source the server loads; the image is built from this tree) ----------

interface FhirResource { resourceType: string; id: string; [k: string]: unknown }
export interface FhirBundle { entry: { resource: FhirResource }[] }

export function localBundles(): FhirBundle[] {
  const manifest: string[] = JSON.parse(readFileSync('public/data/manifest.json', 'utf8'));
  return manifest.map((f) => JSON.parse(readFileSync(`public/data/${f}`, 'utf8')) as FhirBundle);
}

// ---- Kohortenbildung (/cohort) ------------------------------------------------------------------------------------

/** The filter group container under "Filterkriterien" whose label is `label` (e.g. "Diagnose", "Zentren"). */
export function filterGroup(page: Page, label: string): Locator {
  return page.locator('label', { hasText: label }).first().locator('xpath=..');
}

/** Number N of the results header "Kohorte: N Fälle". */
export async function cohortCount(page: Page): Promise<number> {
  const text = await page.getByRole('heading', { name: /^Kohorte: \d+ Fälle$/ }).innerText();
  return Number(/(\d+)/.exec(text)![1]);
}

/** Pseudonyms of the rows of the "Detailansicht" table on /cohort (switches to the table view if needed). */
export async function cohortPseudonyms(page: Page): Promise<string[]> {
  const toggle = page.getByRole('button', { name: 'Detailansicht' });
  if (await toggle.isVisible()) await toggle.click();
  const cells = page.locator('table tbody tr td:first-child');
  return cells.allInnerTexts();
}

/** Saves the current filter set on /cohort under `name` and waits until it is listed. */
export async function saveCohort(page: Page, name: string): Promise<void> {
  await page.locator('#cohort-name-input').fill(name);
  await page.getByRole('button', { name: 'Kohorte speichern' }).click();
  await expect(page.locator('#cohort-name-input')).toHaveValue('');
}
