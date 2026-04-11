import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { authFetch } from '../services/authHeaders';
import {
  extractCenters,
  extractPatientCases,
  invalidateBundleCache,
  loadAllBundles,
  loadCenterShorthands,
} from '../services/fhirLoader';
import type {
  CenterInfo,
  FhirBundle,
  PatientCase,
  QualityFlag,
  SavedSearch,
} from '../types/fhir';

interface DataContextType {
  loading: boolean;
  error: string | null;
  bundles: FhirBundle[];
  centers: CenterInfo[];
  cases: PatientCase[];
  savedSearches: SavedSearch[];
  addSavedSearch: (s: SavedSearch) => void;
  removeSavedSearch: (id: string) => void;
  qualityFlags: QualityFlag[];
  addQualityFlag: (f: QualityFlag) => void;
  updateQualityFlag: (caseId: string, parameter: string, status: QualityFlag['status']) => void;
  excludedCases: string[];
  toggleExcludeCase: (caseId: string) => void;
  activeCases: PatientCase[];
  reviewedCases: string[];
  markCaseReviewed: (caseId: string) => void;
  unmarkCaseReviewed: (caseId: string) => void;
  reloadData: () => void;
}

const DataContext = createContext<DataContextType | null>(null);

// ---------------------------------------------------------------------------
// Server API helpers
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T> {
  const resp = await authFetch(url);
  if (!resp.ok) throw new Error(`${url}: ${resp.status}`);
  return resp.json() as Promise<T>;
}

async function putJson<T>(url: string, body: unknown): Promise<T> {
  const resp = await authFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`${url}: ${resp.status}`);
  return resp.json() as Promise<T>;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const resp = await authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`${url}: ${resp.status}`);
  return resp.json() as Promise<T>;
}

async function deleteJson(url: string): Promise<void> {
  const resp = await authFetch(url, { method: 'DELETE' });
  if (!resp.ok) throw new Error(`${url}: ${resp.status}`);
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bundles, setBundles] = useState<FhirBundle[]>([]);
  const [centers, setCenters] = useState<CenterInfo[]>([]);
  const [cases, setCases] = useState<PatientCase[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [qualityFlags, setQualityFlags] = useState<QualityFlag[]>([]);
  const [excludedCases, setExcludedCases] = useState<string[]>([]);
  const [reviewedCases, setReviewedCases] = useState<string[]>([]);

  // Load FHIR bundles + per-user data from server
  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    invalidateBundleCache();

    Promise.all([
      loadCenterShorthands().catch(() => {}), // M-03: must complete before extractCenters
      loadAllBundles(),
      fetchJson<{ qualityFlags: QualityFlag[] }>('/api/data/quality-flags').catch(() => ({ qualityFlags: [] })),
      fetchJson<{ savedSearches: SavedSearch[] }>('/api/data/saved-searches').catch(() => ({ savedSearches: [] })),
      fetchJson<{ excludedCases: string[] }>('/api/data/excluded-cases').catch(() => ({ excludedCases: [] })),
      fetchJson<{ reviewedCases: string[] }>('/api/data/reviewed-cases').catch(() => ({ reviewedCases: [] })),
    ])
      .then(([, b, qf, ss, ec, rc]) => {
        setBundles(b);
        setCenters(extractCenters(b));
        setCases(extractPatientCases(b));
        setQualityFlags(qf.qualityFlags);
        setSavedSearches(ss.savedSearches);
        setExcludedCases(ec.excludedCases);
        setReviewedCases(rc.reviewedCases);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[DataProvider] Failed to load data:', err);
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const reloadData = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // EMDREQ-QUAL-008: cases not excluded from analyses
  const activeCases = useMemo(
    () => cases.filter((c) => !excludedCases.includes(c.id)),
    [cases, excludedCases],
  );

  const addSavedSearch = useCallback((s: SavedSearch) => {
    setSavedSearches((prev) => [...prev, s]);
    postJson('/api/data/saved-searches', s).catch((err) =>
      console.error('[DataProvider] Failed to save search:', err),
    );
  }, []);

  const removeSavedSearch = useCallback((id: string) => {
    setSavedSearches((prev) => prev.filter((s) => s.id !== id));
    deleteJson(`/api/data/saved-searches/${id}`).catch((err) =>
      console.error('[DataProvider] Failed to delete search:', err),
    );
  }, []);

  const addQualityFlag = useCallback((f: QualityFlag) => {
    setQualityFlags((prev) => {
      const next = [...prev, f];
      putJson('/api/data/quality-flags', { qualityFlags: next }).catch((err) =>
        console.error('[DataProvider] Failed to save quality flags:', err),
      );
      return next;
    });
  }, []);

  const updateQualityFlag = useCallback((
    caseId: string,
    parameter: string,
    status: QualityFlag['status']
  ) => {
    setQualityFlags((prev) => {
      const next = prev.map((f) =>
        f.caseId === caseId && f.parameter === parameter
          ? { ...f, status }
          : f
      );
      putJson('/api/data/quality-flags', { qualityFlags: next }).catch((err) =>
        console.error('[DataProvider] Failed to update quality flags:', err),
      );
      return next;
    });
  }, []);

  const toggleExcludeCase = useCallback((caseId: string) => {
    setExcludedCases((prev) => {
      const next = prev.includes(caseId)
        ? prev.filter((id) => id !== caseId)
        : [...prev, caseId];
      putJson('/api/data/excluded-cases', { excludedCases: next }).catch((err) =>
        console.error('[DataProvider] Failed to update excluded cases:', err),
      );
      return next;
    });
  }, []);

  const markCaseReviewed = useCallback((caseId: string) => {
    setReviewedCases((prev) => {
      if (prev.includes(caseId)) return prev;
      const next = [...prev, caseId];
      putJson('/api/data/reviewed-cases', { reviewedCases: next }).catch((err) =>
        console.error('[DataProvider] Failed to update reviewed cases:', err),
      );
      return next;
    });
  }, []);

  const unmarkCaseReviewed = useCallback((caseId: string) => {
    setReviewedCases((prev) => {
      const next = prev.filter((id) => id !== caseId);
      putJson('/api/data/reviewed-cases', { reviewedCases: next }).catch((err) =>
        console.error('[DataProvider] Failed to update reviewed cases:', err),
      );
      return next;
    });
  }, []);

  const value = useMemo<DataContextType>(() => ({
    loading,
    error,
    bundles,
    centers,
    cases,
    savedSearches,
    addSavedSearch,
    removeSavedSearch,
    qualityFlags,
    addQualityFlag,
    updateQualityFlag,
    excludedCases,
    toggleExcludeCase,
    activeCases,
    reviewedCases,
    markCaseReviewed,
    unmarkCaseReviewed,
    reloadData,
  }), [
    loading, error, bundles, centers, cases,
    savedSearches, addSavedSearch, removeSavedSearch,
    qualityFlags, addQualityFlag, updateQualityFlag,
    excludedCases, toggleExcludeCase, activeCases,
    reviewedCases, markCaseReviewed, unmarkCaseReviewed,
    reloadData,
  ]);

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
