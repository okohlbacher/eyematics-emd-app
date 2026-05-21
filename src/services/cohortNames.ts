/**
 * SC4 / KOH-003 — Subcohort name parsing and grouping utilities.
 *
 * A subcohort is an ordinary SavedSearch whose name contains exactly one colon.
 * The text before the colon is the parent identifier; the text after is the sub identifier.
 * All identity is derived at call time from the name string — no extra fields on SavedSearch.
 */
import type { SavedSearch } from '../types/fhir';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubcohortName {
  parent: string;
  sub: string;
}

export interface GroupByParentResult {
  /** SavedSearches that have at least one matching subcohort entry. */
  parents: SavedSearch[];
  /** SavedSearches whose isSubcohortName is true AND whose parsed parent name
   *  matches an existing SavedSearch name (case-insensitive, trimmed). */
  subcohorts: SavedSearch[];
  /** SavedSearches that are neither a parent nor a subcohort (orphan subcohorts
   *  and plain cohorts are both included here). */
  flat: SavedSearch[];
  /** Map from parent SavedSearch.id → its subcohort SavedSearch entries, for
   *  drawer tree rendering: parent row → indented subcohort rows. */
  subcohortsByParentId: Map<string, SavedSearch[]>;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parses a subcohort name string into { parent, sub }.
 * Both segments are trimmed.
 * Throws if the name does not contain exactly one colon, or if either trimmed
 * segment is empty (throw-only convention D-03; no Result type).
 */
export function parseSubcohortName(name: string): SubcohortName {
  const parts = name.split(':');
  if (parts.length !== 2) {
    throw new Error(
      `Invalid subcohort name "${name}": expected exactly one colon, got ${parts.length - 1}.`,
    );
  }
  const parent = parts[0].trim();
  const sub = parts[1].trim();
  if (!parent) {
    throw new Error(`Invalid subcohort name "${name}": parent segment must not be empty.`);
  }
  if (!sub) {
    throw new Error(`Invalid subcohort name "${name}": sub segment must not be empty.`);
  }
  return { parent, sub };
}

/**
 * Returns true when name is a VALID subcohort name: exactly one colon AND both
 * trimmed segments non-empty. This is a true guard for parseSubcohortName — when
 * it returns true, parseSubcohortName(name) will not throw. Names like ":Male" or
 * "C1:" (which would throw) return false here and are treated as plain cohorts.
 */
export function isSubcohortName(name: string): boolean {
  const parts = name.split(':');
  if (parts.length !== 2) return false;
  return parts[0].trim() !== '' && parts[1].trim() !== '';
}

// ---------------------------------------------------------------------------
// Normalization / duplicate detection (D-04)
// ---------------------------------------------------------------------------

/**
 * Normalizes a cohort name for duplicate detection:
 * - collapses whitespace around the colon
 * - collapses internal whitespace runs to a single space
 * - trims surrounding whitespace
 * - lowercases
 *
 * Two names that produce the same normalized form are considered duplicates.
 * Example: normalizeCohortName('C1 : Male ') === normalizeCohortName('c1:male') === 'c1:male'
 */
export function normalizeCohortName(name: string): string {
  return name
    .replace(/\s*:\s*/g, ':')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Returns true when candidate normalizes to the same form as any name in existingNames.
 */
export function isDuplicateName(candidate: string, existingNames: string[]): boolean {
  const normalizedCandidate = normalizeCohortName(candidate);
  return existingNames.some((n) => normalizeCohortName(n) === normalizedCandidate);
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

/**
 * Derives parents / subcohorts / flat buckets from a SavedSearch[] at call time.
 * No persisted state — call this at render time.
 *
 * Logic:
 *  - A SavedSearch is a subcohort if isSubcohortName(s.name) is true AND a matching
 *    parent entry exists (case-insensitive, trimmed match on SavedSearch.name).
 *  - A SavedSearch is a parent if it has at least one subcohort entry linked to it.
 *  - Everything else (including orphan subcohorts with no matching parent) goes into flat.
 */
export function groupByParent(searches: SavedSearch[]): GroupByParentResult {
  // Build a lookup of normalized name → SavedSearch for fast parent matching.
  // Uses the same normalization as duplicate detection (D-04 / WR-02) so parent
  // linking and duplicate checks never disagree.
  const byNormalizedName = new Map<string, SavedSearch>();
  for (const s of searches) {
    byNormalizedName.set(normalizeCohortName(s.name), s);
  }

  const parentIds = new Set<string>();
  const subcohortIds = new Set<string>();
  const subcohortsByParentId = new Map<string, SavedSearch[]>();

  for (const s of searches) {
    // isSubcohortName already guarantees non-empty segments, so parseSubcohortName
    // will not throw. The try/catch is defensive insurance: a server-loaded name
    // must never crash the drawer render (CR-01).
    if (!isSubcohortName(s.name)) continue;
    let parent: string;
    try {
      ({ parent } = parseSubcohortName(s.name));
    } catch {
      continue; // unparseable → treat as flat, never throw during render
    }
    const parentEntry = byNormalizedName.get(normalizeCohortName(parent));
    if (!parentEntry) continue; // orphan subcohort → will land in flat

    // Found a real parent-subcohort relationship.
    parentIds.add(parentEntry.id);
    subcohortIds.add(s.id);

    const existing = subcohortsByParentId.get(parentEntry.id) ?? [];
    existing.push(s);
    subcohortsByParentId.set(parentEntry.id, existing);
  }

  const parents: SavedSearch[] = [];
  const subcohorts: SavedSearch[] = [];
  const flat: SavedSearch[] = [];

  for (const s of searches) {
    if (parentIds.has(s.id)) {
      parents.push(s);
    } else if (subcohortIds.has(s.id)) {
      subcohorts.push(s);
    } else {
      flat.push(s);
    }
  }

  return { parents, subcohorts, flat, subcohortsByParentId };
}
