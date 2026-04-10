/**
 * Safe JSON.parse wrapper — returns defaultValue on parse error.
 * Prevents crashes from corrupted or malicious localStorage/sessionStorage data.
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    console.warn('[safeJsonParse] Failed to parse JSON, using default value');
    return defaultValue;
  }
}
