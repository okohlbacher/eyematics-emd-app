// Z0-P25 — Unterschiedliche Farben für Therapiestatus und auffällige/kritische Werte (acceptance/Z0/Z0-P25.feature).
// Synthetic data only.
// Readings (PLAN Z0-P25 and the binding answers C17 yes, Q19 "fine"):
// - Colours are compared as rendered RGB (computed CSS colour painted onto a canvas), classified by hue.
// - "auffällig" = the value-status pill in the case panel (aria-label "Status: auffällig"), amber family.
// - "Kritisch" is not rendered on the Quality page; per PLAN/Q19 it is the red family (hue ≈ 340°–20°).
// - A badge differs from a family when it is not a saturated colour whose hue lies in that family's range.
// - "tooltip or accessible name" = the native title (starts with the term) and aria-label (equals the term).
// - @visual scenario: DOM proxy = in the panel of a UB case with an "auffällig" value, the therapy-status element's
//   colours are outside the amber/red families and differ from the pill's; the screen check is in the browser pass.
import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../fixtures';

/** Rows of the case list (left column), as in AT-QUAL (qual.spec.ts). */
const caseRows = (page: Page) => page.locator('button').filter({ has: page.locator('p.font-mono') });

const badge = (page: Page, text: 'AB' | 'UB') =>
  caseRows(page).locator('span', { hasText: new RegExp(`^${text}$`) });

interface Rgb { r: number; g: number; b: number }

/** Paints a computed CSS colour (any syntax incl. oklch) and reads back sRGB. */
async function rendered(target: Locator, prop: 'background-color' | 'color'): Promise<Rgb> {
  return target.evaluate((el, p) => {
    const css = getComputedStyle(el).getPropertyValue(p);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return { r, g, b };
  }, prop);
}

function hueSat({ r, g, b }: Rgb): { h: number; s: number } {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === R) h = 60 * (((G - B) / d) % 6);
    else if (max === G) h = 60 * ((B - R) / d + 2);
    else h = 60 * ((R - G) / d + 4);
  }
  return { h: (h + 360) % 360, s };
}

const isRedFamily = (c: Rgb) => {
  const { h, s } = hueSat(c);
  return s > 0.2 && (h >= 340 || h <= 20);
};
const isAmberFamily = (c: Rgb) => {
  const { h, s } = hueSat(c);
  return s > 0.2 && h > 20 && h <= 65;
};
const distance = (a: Rgb, b: Rgb) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);

test.beforeEach(async ({ page, loginAs }) => {
  await loginAs('klinikleitung');
  await page.goto('/quality');
  await expect(page.getByRole('heading', { name: 'Datenqualität', level: 1 })).toBeVisible();
  await expect(caseRows(page).first()).toBeVisible();
});

/** Clicks UB rows until the case panel shows an "auffällig" pill; returns that pill. */
async function openUbCaseWithAnomaly(page: Page): Promise<Locator> {
  const ubRows = caseRows(page).filter({ has: page.locator('span', { hasText: /^UB$/ }) });
  const n = await ubRows.count();
  expect(n, 'synthetic data contain UB cases').toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    await ubRows.nth(i).click();
    const pills = page.locator('tbody tr [aria-label="Status: auffällig"]');
    await expect(page.getByText(/Therapieunterbrecher \(\d+d\)/)).toBeVisible();
    if ((await pills.count()) > 0) return pills.first();
  }
  throw new Error('no UB case with an "auffällig" value in the synthetic data');
}

test('[Z0-P25] Therapiestatus-Kennzeichen nutzen eine eigene Farbfamilie', async ({ page }) => {
  const ab = badge(page, 'AB').first();
  const ub = badge(page, 'UB').first();
  await expect(ab).toBeVisible();
  await expect(ub).toBeVisible();
  const abBg = await rendered(ab, 'background-color');
  const ubBg = await rendered(ub, 'background-color');

  const anomalousPill = await openUbCaseWithAnomaly(page);
  const anomalousBg = await rendered(anomalousPill, 'background-color');
  expect(isAmberFamily(anomalousBg), `"auffällig" reference is amber ${JSON.stringify(anomalousBg)}`).toBe(true);

  for (const [name, bg] of [['AB', abBg], ['UB', ubBg]] as const) {
    expect(isRedFamily(bg), `${name} background ${JSON.stringify(bg)} not in the red ("Kritisch") family`).toBe(false);
    expect(isAmberFamily(bg), `${name} background ${JSON.stringify(bg)} not in the amber ("auffällig") family`).toBe(false);
    expect(distance(bg, anomalousBg), `${name} background differs from "auffällig"`).toBeGreaterThan(20);
  }
  expect(distance(abBg, ubBg), 'AB and UB backgrounds differ').toBeGreaterThan(20);
});

test('[Z0-P25] Kennzeichen sind auch ohne Farbe unterscheidbar', async ({ page }) => {
  const ab = badge(page, 'AB').first();
  const ub = badge(page, 'UB').first();
  await expect(ab).toHaveAttribute('title', /^Therapieabbrecher\b/);
  await expect(ab).toHaveAttribute('aria-label', 'Therapieabbrecher');
  await expect(ub).toHaveAttribute('title', /^Therapieunterbrecher\b/);
  await expect(ub).toHaveAttribute('aria-label', 'Therapieunterbrecher');
});

test('[Z0-P25] Kein Verwechseln neben Werten', async ({ page }) => {
  const pill = await openUbCaseWithAnomaly(page);
  const status = page.getByText(/Therapieunterbrecher \(\d+d\)/);
  const statusFg = await rendered(status, 'color');
  const statusBg = await rendered(status, 'background-color');
  const pillFg = await rendered(pill, 'color');
  const pillBg = await rendered(pill, 'background-color');
  expect(isAmberFamily(statusFg), `therapy status text ${JSON.stringify(statusFg)} not amber`).toBe(false);
  expect(isRedFamily(statusFg), `therapy status text ${JSON.stringify(statusFg)} not red`).toBe(false);
  expect(distance(statusFg, pillFg), 'text colours differ').toBeGreaterThan(20);
  expect(distance(statusBg, pillBg), 'background colours differ').toBeGreaterThan(20);
});
