/**
 * React hook wrapping the recentActivityStore, keyed to the signed-in user's username.
 * Re-hydrates entries when a different user logs in on the same machine.
 */

import { useCallback, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import type { RecentActivityEntry } from '../services/recentActivityStore';
import * as store from '../services/recentActivityStore';

export function useRecentActivity() {
  const { user } = useAuth();
  const username = user?.username ?? '';

  // Track previous username to detect user change; re-hydrate synchronously during render.
  const [prevUsername, setPrevUsername] = useState(username);
  const [entries, setEntries] = useState<RecentActivityEntry[]>(() =>
    store.getEntries(username),
  );

  // Re-hydrate synchronously during render when username changes (avoids set-state-in-effect).
  if (username !== prevUsername) {
    setPrevUsername(username);
    setEntries(store.getEntries(username));
  }

  const record = useCallback(
    (entry: Omit<RecentActivityEntry, 'visitedAt'>) => {
      store.record(username, { ...entry, visitedAt: Date.now() });
      setEntries(store.getEntries(username));
    },
    [username],
  );

  const clear = useCallback(() => {
    store.clear(username);
    setEntries([]);
  }, [username]);

  return { entries, record, clear };
}
