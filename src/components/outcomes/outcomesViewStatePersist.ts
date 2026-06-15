/**
 * J2 (v1.15-p4): persist the trajectory view state across navigation.
 *
 * Tester: "The view is reset when leaving to another view." Leaving Analyse and
 * returning re-mounts OutcomesView, dropping its session-only useState (layers,
 * metric, axis/spread/y modes) back to defaults. This stores the view state in
 * sessionStorage keyed PER COHORT so returning restores it.
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
}

/** Stable per-cohort key. Falls back to an ad-hoc bucket when no saved cohort id. */
function storageKey(cohortId: string | null): string {
  return `${STORAGE_PREFIX}.${cohortId ?? '__adhoc__'}`;
}

/** Read persisted view state for a cohort; null on any error / absence (D-03 safe). */
export function readPersistedViewState(
  cohortId: string | null,
): PersistedOutcomesViewState | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(storageKey(cohortId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') return parsed as PersistedOutcomesViewState;
    return null;
  } catch {
    return null;
  }
}

/** Persist (merge) view state for a cohort. Silently no-ops on storage failure. */
export function writePersistedViewState(
  cohortId: string | null,
  patch: PersistedOutcomesViewState,
): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const prev = readPersistedViewState(cohortId) ?? {};
    const next: PersistedOutcomesViewState = {
      ...prev,
      ...patch,
      layers: { ...(prev.layers ?? {}), ...(patch.layers ?? {}) },
    };
    sessionStorage.setItem(storageKey(cohortId), JSON.stringify(next));
  } catch {
    /* storage unavailable / quota — persistence is best-effort (D-03) */
  }
}
