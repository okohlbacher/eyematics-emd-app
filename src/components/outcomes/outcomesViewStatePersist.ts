/**
 * J2 (v1.15-p4): persist the trajectory view state across navigation.
 *
 * Tester: "The view is reset when leaving to another view." Leaving Analyse and
 * returning re-mounts OutcomesView, dropping its session-only useState (layers,
 * metric, axis/spread/y modes) back to defaults. This stores the view state in
 * sessionStorage so returning restores it.
 *
 * Z0-P06 (C7, Q24): ONE session-wide key, not per cohort — a newly chosen cohort
 * shows the same chart settings. The header's centre selection is kept here too.
 *
 * Composition with the v1.14 size-derived layer defaults / override semantics
 * (constraint): persistence layers ON TOP of, not instead of, the derived defaults.
 * We persist ONLY layers the user EXPLICITLY toggled (tracked by the existing
 * override refs) plus the explicit axis/y/grid choices. On restore:
 *   - a persisted explicit layer choice wins (and its override ref is re-armed so
 *     the size-derived auto-off effect does not clobber it — no F3 wedge);
 *   - a layer with NO persisted choice is derived from cohort size as before.
 * So an unvisited / never-toggled cohort still gets the correct size-derived
 * defaults; only deliberate user choices survive navigation.
 *
 * sessionStorage (not localStorage): the view state is a working-session concept
 * (D-24 toggles are session-only); it should not leak across browser sessions.
 */
import type { AxisMode, SpreadMode, YMetric } from '../../utils/cohortTrajectory';
import type { LayerState, MetricType } from './useOutcomesRouteState';

const STORAGE_PREFIX = 'emd.outcomesView.v1';

export interface PersistedOutcomesViewState {
  /** Only layers the user explicitly toggled (size-derived ones are NOT persisted). */
  layers?: Partial<LayerState>;
  axisMode?: AxisMode;
  yMetric?: YMetric;
  gridPoints?: number;
  spreadMode?: SpreadMode;
  metric?: MetricType;
  /** Z0-P06 (Q24 a): the analysis header's centre narrowing (empty = all authorized centres). */
  centers?: string[];
}

/** Z0-P06: a single session-wide key (the former per-cohort suffix is dropped). */
const STORAGE_KEY = `${STORAGE_PREFIX}.session`;

/**
 * Read the persisted view state; null on any error / absence (D-03 safe).
 * The cohort id is accepted for call-site compatibility but ignored (Z0-P06: session-wide).
 */
export function readPersistedViewState(
  _cohortId?: string | null,
): PersistedOutcomesViewState | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') return parsed as PersistedOutcomesViewState;
    return null;
  } catch {
    return null;
  }
}

/**
 * Persist (merge) the view state. Silently no-ops on storage failure.
 * An EMPTY `layers` patch clears the persisted layer choices (reset); a non-empty one merges.
 */
export function writePersistedViewState(
  _cohortId: string | null,
  patch: PersistedOutcomesViewState,
): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const prev = readPersistedViewState() ?? {};
    const resetLayers = patch.layers !== undefined && Object.keys(patch.layers).length === 0;
    const next: PersistedOutcomesViewState = {
      ...prev,
      ...patch,
      layers: resetLayers ? {} : { ...(prev.layers ?? {}), ...(patch.layers ?? {}) },
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable / quota — persistence is best-effort (D-03) */
  }
}

/** Z0-P06: drop the session view state (logout — the next user starts from the defaults). */
export function clearPersistedViewState(): void {
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable — nothing to clear (D-03) */
  }
}
