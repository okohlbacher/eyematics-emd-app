/**
 * Recent-activity localStorage CRUD service.
 * Keyed per-username: emd-recent:<username> (D-01 — locked decision).
 * All localStorage access is try/catch-guarded — failures are swallowed silently.
 * Mirror: src/context/ThemeContext.tsx localStorage idiom (the ONLY guarded pattern).
 */

export interface RecentActivityEntry {
  id: string;        // caseId or stable key for non-case views
  label: string;     // pseudonym or view name
  sub: string;       // "Quality review", "Outcomes", "Analysis"
  path: string;      // full route + query string, e.g. "/quality?therapy=breaker"
  visitedAt: number; // Date.now() timestamp
}

const MAX_ENTRIES = 5;

function storageKey(username: string): string {
  return `emd-recent:${username}`;
}

export function getEntries(username: string): RecentActivityEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(username));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as RecentActivityEntry[];
  } catch {
    return [];
  }
}

export function record(username: string, entry: RecentActivityEntry): void {
  try {
    const entries = getEntries(username);
    const filtered = entries.filter((e) => e.id !== entry.id);
    const next = [{ ...entry, visitedAt: Date.now() }, ...filtered].slice(0, MAX_ENTRIES);
    localStorage.setItem(storageKey(username), JSON.stringify(next));
  } catch { /* ignore */ }
}

export function clear(username: string): void {
  try {
    localStorage.removeItem(storageKey(username));
  } catch { /* ignore */ }
}

/** Clear all emd-recent:* keys — used by cross-tab logout where username is unavailable */
export function clearAll(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('emd-recent:')) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}
