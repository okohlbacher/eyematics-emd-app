/**
 * Z0-P23: shared look of the analysis charts (Aggregiert, Verläufe, Einzelfallansicht) — one card frame, one title
 * style, one axis font, one colour per quantity, one cohort palette (light and dark).
 *
 * The quantity colours are the case-view colours (team answer Q18: keep case-view colours).
 */
import { COHORT_PALETTES, DARK_COHORT_PALETTES } from '../outcomes/palette';

/** Card frame of every chart. */
export const CHART_CARD_CLASS =
  'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5';

/** Chart title (h3). */
export const CHART_TITLE_CLASS = 'text-base font-semibold text-gray-900 dark:text-gray-100';

/** Axis tick font size (px) of every chart. */
export const AXIS_TICK_FONT_SIZE = 11;

/** Visus — the same colour in every view. */
export const VISUS_COLOR = '#10b981';
/** CRT / retinal thickness — the same colour in every view. */
export const CRT_COLOR = '#8b5cf6';

/**
 * Colour of the cohort at `index` in a comparison, theme-resolved. Index order is the comparison order, so a cohort
 * has the same colour on Aggregiert and Verläufe.
 */
export function cohortColor(index: number, isDark: boolean): string {
  const palette = isDark ? DARK_COHORT_PALETTES : COHORT_PALETTES;
  return palette[index % palette.length];
}

/**
 * Theme-resolve a cohort colour assigned from the light palette (the aggregation layer assigns light colours, which
 * are also the data keys of existing consumers). Colours outside the palette pass through.
 */
export function themedCohortColor(lightColor: string, isDark: boolean): string {
  if (!isDark) return lightColor;
  const i = (COHORT_PALETTES as readonly string[]).indexOf(lightColor);
  return i < 0 ? lightColor : DARK_COHORT_PALETTES[i];
}

/** Decimal visual acuity → logMAR (Q31: the case-view Visus/CRT chart shows logMAR). Non-positive → null. */
export function decimalToLogmar(decimal: number): number | null {
  if (!Number.isFinite(decimal) || decimal <= 0) return null;
  return -Math.log10(decimal);
}

/** Mean of the logMAR values of decimal Visus measurements; values without a logMAR (≤ 0) are left out; 0 if none. */
export function meanLogmar(decimals: number[]): number {
  const vals = decimals.map(decimalToLogmar).filter((v): v is number => v !== null);
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
}

/**
 * A case-view chart row with decimal Visus fields converted to logMAR: the patient value, the cohort median and the
 * IQR band — whose bounds swap, because logMAR falls as decimal Visus rises.
 */
export function toLogmarRow<T extends { visus?: number; visusMedian?: number; visusBand?: [number, number] }>(d: T): T {
  const row = { ...d };
  if (typeof d.visus === 'number') row.visus = decimalToLogmar(d.visus) ?? undefined;
  if (typeof d.visusMedian === 'number') row.visusMedian = decimalToLogmar(d.visusMedian) ?? undefined;
  if (Array.isArray(d.visusBand)) {
    const lo = decimalToLogmar(d.visusBand[1]);
    const hi = decimalToLogmar(d.visusBand[0]);
    row.visusBand = lo != null && hi != null ? [lo, hi] : undefined;
  }
  return row;
}

/** Cohort median colours of the case view (lighter tones of the quantity colours); also the case-view panel swatch. */
export const VISUS_MEDIAN_COLOR = '#6ee7b7';
export const CRT_MEDIAN_COLOR = '#c4b5fd';

/**
 * Z0-P23 (Q42): the one number format of chart tooltips and axis tick labels — decimal comma in the German UI, decimal
 * point in English; no digit grouping (so "1000" never reads as "1.000" next to a decimal comma).
 */
export function chartNumberFormat(locale: string, maxFractionDigits = 2, minFractionDigits = 0): (v: number) => string {
  const fmt = new Intl.NumberFormat(locale, {
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: maxFractionDigits,
    useGrouping: false,
  });
  return (v: number) => fmt.format(v);
}

/**
 * Z0-P23 (Q41): rounded tick values inside [lo, hi] — one step of 1, 2, 2.5 or 5 × 10^n chosen for about `target`
 * ticks (at least `minStep`; with minStep ≥ 1 a whole-number step), every tick an integer multiple of that step. The
 * domain itself is not changed.
 */
export function niceTicks(lo: number, hi: number, target = 5, minStep = 0): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return Number.isFinite(lo) ? [lo] : [];
  const raw = Math.max((hi - lo) / Math.max(target - 1, 1), minStep, Number.EPSILON);
  const exp = Math.floor(Math.log10(raw));
  const base = 10 ** exp;
  // An axis with minStep ≥ 1 counts whole units: a 2.5 step would put whole-number labels at fractional positions.
  const mant = [1, 2, 2.5, 5, 10].find((m) => m * base >= raw - 1e-12 && (minStep < 1 || Number.isInteger(m * base))) ?? 10;
  const step = Math.max(mant * base, minStep);
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  const round = (v: number) => Number(v.toFixed(decimals));
  const ticks: number[] = [];
  for (let k = Math.ceil(lo / step - 1e-9); k * step <= hi + step * 1e-9; k++) ticks.push(round(k * step) + 0);
  return ticks;
}

/**
 * Z0-P23 (Q42): decimal numbers inside a fixed label (e.g. the bin label "0.2–0.4") in the locale's decimal separator.
 */
export function localizeDecimals(text: string, locale: string): string {
  return locale === 'de' ? text.replace(/(\d)\.(\d)/g, '$1,$2') : text;
}
