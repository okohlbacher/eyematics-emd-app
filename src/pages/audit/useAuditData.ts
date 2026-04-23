/**
 * Phase 19 / AUDIT-03: Hook owning the AuditPage fetch lifecycle.
 *
 * Dual-cancel mechanism (R-05):
 *   1. AbortController.abort() — network-level cancel: tells the browser to drop the
 *      in-flight HTTP request. The `catch` branch checks `ctrl.signal.aborted` and
 *      returns early (no dispatch) so aborted requests don't pollute state.
 *   2. clearTimeout(timer) — prevents the 300 ms debounce from firing after unmount
 *      or rapid re-render.
 *   3. requestEpoch reducer guard — source-of-truth for stale responses. Even if an
 *      aborted request somehow resolves, FETCH_SUCCESS/FETCH_ERROR with a stale epoch
 *      is a no-op in the reducer.
 *
 * React StrictMode note (R-03): StrictMode fires effects twice in dev. The epoch counter
 * ensures that the first (discarded) run's response is ignored by the reducer, and the
 * AbortController cancels its network request. No extra state-update risk.
 *
 * Effect dep is [state.filters, refetchTick] (NOT individual fields). FILTER_SET returns
 * a new filters object reference, so the effect re-fires on every filter change (R-02).
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { authFetch } from '../../services/authHeaders';
import {
  type AuditAction,
  auditReducer,
  type AuditState,
  initialState,
  type ServerAuditEntry,
} from './auditPageState';

export function useAuditData(): {
  state: AuditState;
  dispatch: React.Dispatch<AuditAction>;
  refetch: () => void;
} {
  const [state, dispatch] = useReducer(auditReducer, initialState);
  const epochRef = useRef(0);
  const [refetchTick, setRefetchTick] = useState(0);

  useEffect(() => {
    const epoch = ++epochRef.current;
    const ctrl = new AbortController();

    const timer = setTimeout(async () => {
      dispatch({ type: 'FETCH_START', epoch });
      const params = new URLSearchParams({ limit: '500', offset: '0' });
      if (state.filters.user) params.set('user', state.filters.user);
      if (state.filters.category) params.set('action_category', state.filters.category);
      if (state.filters.fromDate) params.set('fromTime', state.filters.fromDate);
      if (state.filters.toDate) params.set('toTime', `${state.filters.toDate}T23:59:59`);
      if (state.filters.search) params.set('body_search', state.filters.search);
      if (state.filters.failuresOnly) params.set('status_gte', '400');
      try {
        const res = await authFetch(`/api/audit?${params.toString()}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json() as { entries: ServerAuditEntry[]; total: number };
        dispatch({ type: 'FETCH_SUCCESS', epoch, entries: data.entries, total: data.total });
      } catch (err) {
        // Network-level cancel: AbortController fired; reducer epoch guard is also satisfied.
        if (ctrl.signal.aborted) return;
        const msg = err instanceof Error ? err.message : 'Failed to load audit log';
        dispatch({ type: 'FETCH_ERROR', epoch, error: msg });
      }
    }, 300);

    // Cleanup: abort network request AND clear debounce timer (R-05)
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [state.filters, refetchTick]);

  // refetch() bumps the tick counter, re-triggering the effect with the same filters
  const refetch = useCallback(() => setRefetchTick(t => t + 1), []);

  return { state, dispatch, refetch };
}
