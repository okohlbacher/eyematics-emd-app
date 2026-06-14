/**
 * C3 — Cohort "Split by" engine (cross-boundary helper, D-01).
 *
 * Pure functions that turn a parent cohort (its cases + its CohortFilter) plus a
 * split definition into a list of child groups. Each group carries a human label
 * and a child CohortFilter equal to the parent filter intersected with the split
 * predicate, so child cohorts persist via the SAME path as manual subcohorts
 * (addSavedSearch) — no parallel cohort model.
 *
 * Split kinds:
 *   - Categorical: gender / diagnosis / center → one group per distinct value
 *     present in the parent cohort.
 *   - Range (age / Visus / CRT): user-defined cut points OR quantile auto-split.
 *
 * Range edge convention (documented, see binFromBounds):
 *   Bins are HALF-OPEN [lo, hi) for every bin except the LAST, which is CLOSED
 *   [lo, hi]. Because the underlying CohortFilter range test is inclusive on both
 *   ends, half-openness is realised by subtracting RANGE_EPSILON from the upper
 *   bound of all non-final bins. This guarantees a value lands in exactly one bin.
 *
 * Throw-only (D-03). camelCase TS; FHIR/wire codes unchanged (D-05).
 */
import { LOINC_CRT, LOINC_VISUS, SNOMED_AMD, SNOMED_DR } from './fhirCodes.js';
import { getLatestObservation } from './fhirQueries.js';
import { applyFilters, type ApplyFiltersOptions,getAge } from './patientCases.js';
import type { CohortFilter, PatientCase } from './types/fhir.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CategoricalSplitAttribute = 'gender' | 'diagnosis' | 'center';
export type RangeSplitAttribute = 'age' | 'visus' | 'crt';
export type SplitAttribute = CategoricalSplitAttribute | RangeSplitAttribute;

export type RangeMode = 'cutpoints' | 'quantile';

export interface CategoricalSplitSpec {
  kind: 'categorical';
  attribute: CategoricalSplitAttribute;
}

export interface RangeCutpointsSpec {
  kind: 'range';
  attribute: RangeSplitAttribute;
  mode: 'cutpoints';
  /** Internal break values, e.g. [50, 70] → bins <50, 50–70, ≥70. */
  cutPoints: number[];
}

export interface RangeQuantileSpec {
  kind: 'range';
  attribute: RangeSplitAttribute;
  mode: 'quantile';
  /** Desired number of equal-size groups (e.g. 3 = tertiles). */
  groups: number;
}

export type SplitSpec = CategoricalSplitSpec | RangeCutpointsSpec | RangeQuantileSpec;

export interface SplitGroup {
  /** Sub-label used to build the child name `Parent:<label>` and shown in preview. */
  label: string;
  /** Child CohortFilter = parent filter ∩ this group's predicate. */
  filter: CohortFilter;
  /** Number of parent cases that fall into this group (0 groups are caller's call). */
  count: number;
}

export interface CenterLookup {
  /** centerId → display name (falls back to id when absent). */
  nameOf: (centerId: string) => string;
}

export interface GenderLabeller {
  /** raw gender value → display label (e.g. 'female' → 'Weiblich'). */
  labelOf: (gender: string) => string;
}

// Continuous-variable epsilon for realising half-open [lo, hi) bins on top of the
// inclusive-inclusive CohortFilter range test. Small relative to Visus (0..~2) and
// CRT (µm, hundreds) precision; age uses integer-safe bounds instead (see below).
const RANGE_EPSILON = 1e-6;

// Diagnosis split is restricted to the two primary diagnoses the app models.
const DIAGNOSIS_CODES: ReadonlyArray<string> = [SNOMED_AMD, SNOMED_DR];

// ---------------------------------------------------------------------------
// Value extraction (single source of truth, mirrors applyFilters predicates)
// ---------------------------------------------------------------------------

/** Numeric value of a case for a range attribute, or null when missing/implausible. */
export function rangeValueOf(c: PatientCase, attribute: RangeSplitAttribute): number | null {
  if (attribute === 'age') {
    const age = getAge(c.birthDate);
    return age < 0 ? null : age;
  }
  const loinc = attribute === 'visus' ? LOINC_VISUS : LOINC_CRT;
  const latest = getLatestObservation(c.observations, loinc);
  const val = latest?.valueQuantity?.value;
  return val == null ? null : val;
}

/** Distinct diagnosis codes (from the modelled set) present on a case. */
function diagnosisCodesOf(c: PatientCase): string[] {
  const codes = new Set(c.conditions.flatMap((cond) => cond.code.coding.map((cd) => cd.code)));
  return DIAGNOSIS_CODES.filter((d) => codes.has(d));
}

// ---------------------------------------------------------------------------
// Quantile math
// ---------------------------------------------------------------------------

/**
 * Type-7 (linear interpolation) quantile of a SORTED ascending numeric array.
 * q in [0,1]. Throws on empty input (D-03).
 */
export function quantileSorted(sorted: number[], q: number): number {
  if (sorted.length === 0) throw new Error('quantileSorted: empty input');
  if (q <= 0) return sorted[0];
  if (q >= 1) return sorted[sorted.length - 1];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  const frac = pos - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

/**
 * Compute deduplicated interior cut points for an N-group quantile split.
 * Returns the cut points (length ≤ groups-1); ties collapse so the effective
 * number of bins may be smaller than `groups`. Values are rounded for display
 * via `round` BEFORE dedup so visually-identical cuts don't create empty bins.
 */
export function quantileCutPoints(values: number[], groups: number, round: (n: number) => number): number[] {
  if (groups < 2) throw new Error('quantileCutPoints: groups must be >= 2');
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const cuts: number[] = [];
  for (let i = 1; i < groups; i++) {
    cuts.push(round(quantileSorted(sorted, i / groups)));
  }
  // Dedup + keep strictly increasing (drop ties from clustered distributions).
  const dedup: number[] = [];
  for (const c of cuts) {
    if (dedup.length === 0 || c > dedup[dedup.length - 1]) dedup.push(c);
  }
  return dedup;
}

// ---------------------------------------------------------------------------
// Cut-point validation
// ---------------------------------------------------------------------------

/**
 * Normalise user-entered cut points: keep finite numbers, sort ascending, dedup.
 * Throws if nothing valid remains (D-03) so the caller surfaces a clear message.
 */
export function normalizeCutPoints(raw: number[]): number[] {
  const finite = raw.filter((n) => Number.isFinite(n));
  const sorted = [...finite].sort((a, b) => a - b);
  const dedup: number[] = [];
  for (const n of sorted) {
    if (dedup.length === 0 || n > dedup[dedup.length - 1]) dedup.push(n);
  }
  if (dedup.length === 0) throw new Error('normalizeCutPoints: no valid cut points');
  return dedup;
}

// ---------------------------------------------------------------------------
// Range bin construction
// ---------------------------------------------------------------------------

interface Bin {
  lo: number | null; // null = open lower (−∞)
  hi: number | null; // null = open upper (+∞)
  label: string;
}

/**
 * Build contiguous bins from sorted cut points.
 *   cuts [50,70] →  (−∞,50)  [50,70)  [70,+∞)
 * For `age` (integer) the boundaries are integer-safe; for continuous vars the
 * realised filter upper bound is (next cut − RANGE_EPSILON) so a value exactly on
 * a cut lands in the UPPER bin (half-open [lo, hi)). The last bin is closed.
 */
function binsFromCutPoints(cuts: number[], attribute: RangeSplitAttribute, fmt: (n: number) => string): Bin[] {
  const isAge = attribute === 'age';
  const bins: Bin[] = [];
  // First (open-lower) bin: (−∞, cuts[0])
  bins.push({ lo: null, hi: cuts[0], label: `< ${fmt(cuts[0])}` });
  for (let i = 0; i < cuts.length - 1; i++) {
    bins.push({ lo: cuts[i], hi: cuts[i + 1], label: `${fmt(cuts[i])}–${fmt(isAge ? cuts[i + 1] - 1 : cuts[i + 1])}` });
  }
  // Last (open-upper) bin: [cuts[last], +∞)
  const last = cuts[cuts.length - 1];
  bins.push({ lo: last, hi: null, label: `≥ ${fmt(last)}` });
  return bins;
}

/** Realise a bin as a CohortFilter range (inclusive-inclusive), applying half-open epsilon. */
function rangeFilterForBin(bin: Bin, attribute: RangeSplitAttribute): [number, number] {
  const isAge = attribute === 'age';
  // Lower inclusive bound.
  const lo = bin.lo == null ? Number.NEGATIVE_INFINITY : bin.lo;
  // Upper bound: closed when bin.hi == null (last bin), else half-open.
  let hi: number;
  if (bin.hi == null) {
    hi = Number.POSITIVE_INFINITY;
  } else if (isAge) {
    hi = bin.hi - 1; // integer ages: [lo, hi-1] == [lo, hi)
  } else {
    hi = bin.hi - RANGE_EPSILON; // continuous: [lo, hi-ε] == [lo, hi)
  }
  return [lo, hi];
}

function rangeFilterKey(attribute: RangeSplitAttribute): 'ageRange' | 'visusRange' | 'crtRange' {
  return attribute === 'age' ? 'ageRange' : attribute === 'visus' ? 'visusRange' : 'crtRange';
}

// ---------------------------------------------------------------------------
// Display rounding / formatting
// ---------------------------------------------------------------------------

/** Sensible rounding per attribute for displayed bounds and quantile cuts. */
export function roundFor(attribute: RangeSplitAttribute): (n: number) => number {
  if (attribute === 'age') return (n) => Math.round(n);
  if (attribute === 'visus') return (n) => Math.round(n * 100) / 100; // 2 dp (logMAR/decimal)
  return (n) => Math.round(n); // CRT µm — whole microns
}

function formatFor(attribute: RangeSplitAttribute): (n: number) => string {
  const r = roundFor(attribute);
  return (n) => String(r(n));
}

// ---------------------------------------------------------------------------
// Public: compute split groups
// ---------------------------------------------------------------------------

export interface ComputeSplitArgs {
  /** Parent cohort's cases (already extracted, e.g. activeCases). */
  parentCases: PatientCase[];
  /** Parent cohort's own filter (child = parent ∩ predicate). */
  parentFilter: CohortFilter;
  spec: SplitSpec;
  /** Filter options (therapy thresholds etc.) passed through to applyFilters. */
  filterOptions?: ApplyFiltersOptions;
  centerLookup?: CenterLookup;
  genderLabeller?: GenderLabeller;
  diagnosisLabeller?: (code: string) => string;
}

/**
 * Compute all split groups for a parent cohort. Each group's `count` is the number
 * of cases (within the parent cohort) matching the child filter. Groups with 0
 * count are RETURNED here (caller decides to skip on confirm); ordering is stable.
 *
 * Throws for an empty/invalid range definition (D-03) so the dialog can show a
 * clear message rather than silently producing nothing.
 */
export function computeSplitGroups(args: ComputeSplitArgs): SplitGroup[] {
  const { spec, parentFilter, filterOptions } = args;
  // The parent cohort = parent filter applied to all cases. We split THIS set.
  const parentCohort = applyFilters(args.parentCases, parentFilter, filterOptions ?? {});

  if (spec.kind === 'categorical') {
    return categoricalGroups(parentCohort, parentFilter, spec, args);
  }
  return rangeGroups(parentCohort, parentFilter, spec, filterOptions ?? {});
}

function categoricalGroups(
  parentCohort: PatientCase[],
  parentFilter: CohortFilter,
  spec: CategoricalSplitSpec,
  args: ComputeSplitArgs,
): SplitGroup[] {
  if (spec.attribute === 'gender') {
    const values = distinctStable(parentCohort.map((c) => c.gender));
    return values.map((g) => ({
      label: args.genderLabeller?.labelOf(g) ?? g,
      filter: { ...parentFilter, gender: [g] },
      count: parentCohort.filter((c) => c.gender === g).length,
    }));
  }
  if (spec.attribute === 'center') {
    const values = distinctStable(parentCohort.map((c) => c.centerId).filter((id) => id !== ''));
    return values.map((id) => ({
      label: args.centerLookup?.nameOf(id) ?? id,
      filter: { ...parentFilter, centers: [id] },
      count: parentCohort.filter((c) => c.centerId === id).length,
    }));
  }
  // diagnosis — distinct modelled codes present; a case may appear in more than one
  // group (it can hold both AMD and DR), matching the existing diagnosis filter.
  const present = new Set<string>();
  for (const c of parentCohort) for (const code of diagnosisCodesOf(c)) present.add(code);
  const codes = DIAGNOSIS_CODES.filter((code) => present.has(code));
  return codes.map((code) => ({
    label: args.diagnosisLabeller?.(code) ?? code,
    filter: { ...parentFilter, diagnosis: [code] },
    count: parentCohort.filter((c) => diagnosisCodesOf(c).includes(code)).length,
  }));
}

function rangeGroups(
  parentCohort: PatientCase[],
  parentFilter: CohortFilter,
  spec: RangeCutpointsSpec | RangeQuantileSpec,
  filterOptions: ApplyFiltersOptions,
): SplitGroup[] {
  const attribute = spec.attribute;
  const fmt = formatFor(attribute);

  let cuts: number[];
  if (spec.mode === 'cutpoints') {
    cuts = normalizeCutPoints(spec.cutPoints);
  } else {
    const values = parentCohort
      .map((c) => rangeValueOf(c, attribute))
      .filter((v): v is number => v != null);
    cuts = quantileCutPoints(values, spec.groups, roundFor(attribute));
    if (cuts.length === 0) {
      throw new Error('rangeGroups: too few distinct values to form quantile groups');
    }
  }

  const bins = binsFromCutPoints(cuts, attribute, fmt);
  const key = rangeFilterKey(attribute);
  // If the parent itself constrains this same attribute, the child must be the
  // INTERSECTION (parent ∩ bin), not an override — otherwise the persisted child
  // filter would discard the parent's bound and later evaluate against the full
  // dataset (preview count is right because parentCohort is pre-filtered, but the
  // saved object would diverge). C3 review HIGH-1.
  const parentRange = parentFilter[key] as [number, number] | undefined;
  return bins.map((bin) => {
    const [binLo, binHi] = rangeFilterForBin(bin, attribute);
    const range: [number, number] = parentRange
      ? [Math.max(binLo, parentRange[0]), Math.min(binHi, parentRange[1])]
      : [binLo, binHi];
    const filter: CohortFilter = { ...parentFilter, [key]: range };
    const count = applyFilters(parentCohort, filter, filterOptions).length;
    return { label: bin.label, filter, count };
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Distinct values in first-seen order (stable). */
function distinctStable(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Child naming + collision handling
// ---------------------------------------------------------------------------

/**
 * Build a unique child cohort name `Parent:<label>`. On collision (case-insensitive,
 * whitespace-normalised against existingNames) append " (2)", " (3)", … to the SUB
 * segment so the colon structure (one colon → subcohort) is preserved.
 *
 * `isTaken` should mirror the app's duplicate detection (normalizeCohortName).
 */
export function buildChildName(
  parentName: string,
  subLabel: string,
  isTaken: (candidate: string) => boolean,
): string {
  // The sub segment must not contain a colon (it would break the single-colon
  // `Parent:Sub` subcohort convention → parseSubcohortName throws, the cohort is
  // no longer recognised as a subcohort) and must not be empty. Data/i18n-driven
  // labels (center, diagnosis, an empty gender) are the open surface. C3 review HIGH-2.
  const sub = sanitizeSubLabel(subLabel);
  const base = `${parentName.trim()}:${sub}`;
  if (!isTaken(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${parentName.trim()}:${sub} (${n})`;
    if (!isTaken(candidate)) return candidate;
  }
  throw new Error('buildChildName: exhausted collision suffixes');
}

/** Make a label safe as the `Sub` segment of a `Parent:Sub` subcohort name. */
function sanitizeSubLabel(label: string): string {
  const cleaned = label.trim().replace(/:/g, '–'); // colon → en-dash (breaks the convention)
  return cleaned === '' ? 'unbekannt' : cleaned;
}
