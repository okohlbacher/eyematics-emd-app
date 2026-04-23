/**
 * Phase 19 / AUDIT-03: AuditPage state machine — types, reducer, initial state, selectors.
 *
 * `ServerAuditEntry.id` is typed as `number` (pre-existing type lie — server emits string
 * via crypto.randomUUID()). Do NOT fix: out of scope per R-01; preserves byte-identical contract.
 */
import { isRelevantEntry } from './auditFormatters';

export interface ServerAuditEntry {
  id: number;        // pre-existing type lie — DO NOT FIX (R-01)
  timestamp: string;
  method: string;
  path: string;
  user: string;
  status: number;
  duration_ms: number;
}

export interface AuditFilters {
  user: string;                                            // '' = all
  category: '' | 'auth' | 'data' | 'admin' | 'outcomes';
  fromDate: string;                                        // YYYY-MM-DD; '' = unset
  toDate: string;                                          // YYYY-MM-DD; '' = unset
  search: string;                                          // body_search; admin-only at UI; max 128
  failuresOnly: boolean;                                   // status_gte=400
}

export const initialFilters: AuditFilters = {
  user: '', category: '', fromDate: '', toDate: '', search: '', failuresOnly: false,
};

export interface AuditState {
  filters: AuditFilters;
  entries: ServerAuditEntry[];
  total: number;
  loading: boolean;     // initialState.loading MUST be true (R-06)
  error: string | null;
  requestEpoch: number;
}

// initialState.loading === true is load-bearing: avoids an empty flash before first fetch (R-06).
export const initialState: AuditState = {
  filters: initialFilters,
  entries: [],
  total: 0,
  loading: true,
  error: null,
  requestEpoch: 0,
};

export type AuditAction =
  | { type: 'FILTER_SET'; key: keyof AuditFilters; value: AuditFilters[keyof AuditFilters] }
  | { type: 'FILTERS_RESET' }
  | { type: 'FETCH_START'; epoch: number }
  | { type: 'FETCH_SUCCESS'; epoch: number; entries: ServerAuditEntry[]; total: number }
  | { type: 'FETCH_ERROR'; epoch: number; error: string };

/**
 * Pure reducer for AuditPage state machine.
 *
 * FILTER_SET returns a new `filters` object reference so the hook's useEffect dep
 * (`state.filters`) detects the change and re-fires the fetch (R-02).
 *
 * FETCH_SUCCESS / FETCH_ERROR are no-ops when payload.epoch !== state.requestEpoch
 * (stale-response guard, D-05). The reducer returns `state` by reference — no shallow copy —
 * so callers asserting `result === priorState` (toBe) will pass.
 */
export function auditReducer(state: AuditState, action: AuditAction): AuditState {
  switch (action.type) {
    case 'FILTER_SET':
      return { ...state, filters: { ...state.filters, [action.key]: action.value } };
    case 'FILTERS_RESET':
      return { ...state, filters: initialFilters };
    case 'FETCH_START':
      return { ...state, loading: true, error: null, requestEpoch: action.epoch };
    case 'FETCH_SUCCESS':
      if (action.epoch !== state.requestEpoch) return state;
      return { ...state, loading: false, error: null, entries: action.entries, total: action.total };
    case 'FETCH_ERROR':
      if (action.epoch !== state.requestEpoch) return state;
      // entries and total are PRESERVED on error (not cleared)
      return { ...state, loading: false, error: action.error };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Selectors — pure functions; no memoization inside (caller wraps with useMemo)
// ---------------------------------------------------------------------------

/** Returns sorted, deduped list of non-empty user strings from entries. */
export function selectDistinctUsers(entries: ServerAuditEntry[]): string[] {
  return Array.from(new Set(entries.map(e => e.user).filter(Boolean))).sort();
}

/**
 * Filters entries to only relevant ones (per isRelevantEntry) and sorts descending
 * by timestamp (newest first).
 */
export function selectFilteredEntries(entries: ServerAuditEntry[]): ServerAuditEntry[] {
  return entries
    .filter(isRelevantEntry)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
