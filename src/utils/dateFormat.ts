/**
 * Locale-aware date formatting utilities.
 * Eliminates the duplicated `locale === 'de' ? 'de-DE' : 'en-US'` pattern.
 */

export type AppLocale = 'de' | 'en';

/** Map app locale to Intl locale string. */
export function getDateLocale(locale: AppLocale): string {
  return locale === 'de' ? 'de-DE' : 'en-US';
}

/** Format a date string or Date to a localized date string. */
export function formatDate(date: string | Date, locale: AppLocale): string {
  return new Date(date).toLocaleDateString(getDateLocale(locale));
}
