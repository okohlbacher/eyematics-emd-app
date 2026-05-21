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

/**
 * Shape + same-origin validation for a single deserialized entry.
 * localStorage is user-writable (DevTools) and attacker-writable under any XSS
 * foothold, and entry.path flows verbatim into navigate() on the landing page.
 * A crafted value such as "//evil.example/phish" or a "http:"/"javascript:" scheme
 * is an open-redirect / navigation-hijack primitive, so path is constrained to an
 * app-relative, same-origin route: it must start with a single "/" and NOT with
 * "//" (protocol-relative) or "/\" (which some routers normalize to "//").
 * Entries that fail validation are dropped silently (consistent with the existing
 * try/catch swallow-on-failure idiom — validation must never throw into render).
 */
function isValidEntry(value: unknown): value is RecentActivityEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.label === 'string' &&
    typeof entry.sub === 'string' &&
    typeof entry.path === 'string' &&
    entry.path.startsWith('/') &&
    !entry.path.startsWith('//') &&
    !entry.path.startsWith('/\\') &&
    typeof entry.visitedAt === 'number'
  );
}

export function getEntries(username: string): RecentActivityEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(username));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Per-element shape validation: drop entries that fail (untrusted source).
    return parsed.filter(isValidEntry);
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
