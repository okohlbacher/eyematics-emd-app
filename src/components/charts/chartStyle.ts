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
