import { useState, useCallback } from 'react';
import { safeJsonParse } from '../utils/safeJson';

/**
 * useState backed by localStorage with safe JSON parsing.
 * Eliminates the duplicated init-from-storage + persist-on-update pattern.
 */
export function useLocalStorageState<T>(
  key: string,
  defaultValue: T,
): [T, (updater: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    if (stored === null) return defaultValue;
    return safeJsonParse<T>(stored, defaultValue);
  });

  const setAndPersist = useCallback(
    (updater: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = typeof updater === 'function'
          ? (updater as (prev: T) => T)(prev)
          : updater;
        localStorage.setItem(key, JSON.stringify(next));
        return next;
      });
    },
    [key],
  );

  return [value, setAndPersist];
}
