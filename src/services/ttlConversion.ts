/** Phase 28 / D-07 — session TTL hours<->ms conversion + client-side validation (mirrors server/settingsApi.ts). */
const MS_PER_HOUR = 3_600_000;

export function hoursToMs(hours: number): number {
  return hours * MS_PER_HOUR;
}

export function msToHours(ms: number): number {
  return Math.round(ms / MS_PER_HOUR);
}

export function validateTtl(refreshHours: number, capHours: number): 'ok' | 'refreshMin' | 'capMin' {
  if (!Number.isInteger(refreshHours) || refreshHours < 1) return 'refreshMin';
  if (!Number.isInteger(capHours) || capHours < refreshHours) return 'capMin';
  return 'ok';
}
