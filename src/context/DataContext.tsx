import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  type ReactNode,
} from 'react';
import type {
  FhirBundle,
  CenterInfo,
  PatientCase,
  SavedSearch,
  QualityFlag,
} from '../types/fhir';
import {
  loadAllBundles,
  extractCenters,
  extractPatientCases,
} from '../services/fhirLoader';
import { getAuthHeaders } from '../services/authHeaders';
import { useAuth } from './AuthContext';

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
  dataLoading: boolean;
  dataError: string | null;
  mutationError: string | null;
  clearMutationError: () => void;
  retryLoadData: () => void;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // FHIR data state
  const [fhirLoading, setFhirLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bundles, setBundles] = useState<FhirBundle[]>([]);
  const [centers, setCenters] = useState<CenterInfo[]>([]);
  const [cases, setCases] = useState<PatientCase[]>([]);

  // Server-backed persisted data state
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [qualityFlags, setQualityFlags] = useState<QualityFlag[]>([]);
  const [excludedCases, setExcludedCases] = useState<string[]>([]);
  const [reviewedCases, setReviewedCases] = useState<string[]>([]);

  // Separate loading/error state for persisted data
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Error banner for mutation failures
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Per-resource mutation locks to serialize mutations
  const mutatingRef = useRef({
    qualityFlags: false,
    savedSearches: false,
    excludedCases: false,
    reviewedCases: false,
  });

  const fetchData = useCallback(() => {
    setFhirLoading(true);
    setError(null);
    loadAllBundles()
      .then((b) => {
        setBundles(b);
        setCenters(extractCenters(b));
        setCases(extractPatientCases(b));
        setFhirLoading(false);
      })
      .catch((err) => {
        console.error('[DataProvider] Failed to load bundles:', err);
        setError(err instanceof Error ? err.message : String(err));
        setFhirLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch persisted data from server using Promise.allSettled for partial-success resilience
  const fetchPersistedData = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    setDataError(null);

    const headers = getAuthHeaders();
    const results = await Promise.allSettled([
      fetch('/api/data/quality-flags', { headers }).then((r) => {
        if (!r.ok) throw new Error(`quality-flags: ${r.status}`);
        return r.json() as Promise<{ qualityFlags: QualityFlag[] }>;
      }),
      fetch('/api/data/saved-searches', { headers }).then((r) => {
        if (!r.ok) throw new Error(`saved-searches: ${r.status}`);
        return r.json() as Promise<{ savedSearches: SavedSearch[] }>;
      }),
      fetch('/api/data/excluded-cases', { headers }).then((r) => {
        if (!r.ok) throw new Error(`excluded-cases: ${r.status}`);
        return r.json() as Promise<{ excludedCases: string[] }>;
      }),
      fetch('/api/data/reviewed-cases', { headers }).then((r) => {
        if (!r.ok) throw new Error(`reviewed-cases: ${r.status}`);
        return r.json() as Promise<{ reviewedCases: string[] }>;
      }),
    ]);

    const errors: string[] = [];

    if (results[0].status === 'fulfilled') {
      setQualityFlags(results[0].value.qualityFlags ?? []);
    } else {
      errors.push(results[0].reason?.message ?? 'quality-flags failed');
    }

    if (results[1].status === 'fulfilled') {
      setSavedSearches(results[1].value.savedSearches ?? []);
    } else {
      errors.push(results[1].reason?.message ?? 'saved-searches failed');
    }

    if (results[2].status === 'fulfilled') {
      setExcludedCases(results[2].value.excludedCases ?? []);
    } else {
      errors.push(results[2].reason?.message ?? 'excluded-cases failed');
    }

    if (results[3].status === 'fulfilled') {
      setReviewedCases(results[3].value.reviewedCases ?? []);
    } else {
      errors.push(results[3].reason?.message ?? 'reviewed-cases failed');
    }

    if (errors.length > 0) {
      setDataError(`Failed to load: ${errors.join(', ')}`);
    }
    setDataLoading(false);
  }, [user]);

  useEffect(() => {
    fetchPersistedData();
  }, [fetchPersistedData]);

  // Auto-dismiss mutation error after 4000ms
  useEffect(() => {
    if (!mutationError) return;
    const timer = setTimeout(() => setMutationError(null), 4000);
    return () => clearTimeout(timer);
  }, [mutationError]);

  const reloadData = useCallback(() => {
    fetchData();
    fetchPersistedData();
  }, [fetchData, fetchPersistedData]);

  // EMDREQ-QUAL-008: cases not excluded from analyses
  const activeCases = useMemo(
    () => cases.filter((c) => !excludedCases.includes(c.id)),
    [cases, excludedCases],
  );

  const addSavedSearch = useCallback(async (s: SavedSearch) => {
    if (mutatingRef.current.savedSearches) return;
    mutatingRef.current.savedSearches = true;
    try {
      const resp = await fetch('/api/data/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(s),
      });
      if (!resp.ok) { setMutationError('Could not save search.'); return; }
      const data = await resp.json() as { savedSearch: SavedSearch };
      setSavedSearches((prev) => [...prev, data.savedSearch]);
    } catch { setMutationError('Could not save search.'); }
    finally { mutatingRef.current.savedSearches = false; }
  }, []);

  const removeSavedSearch = useCallback(async (id: string) => {
    if (mutatingRef.current.savedSearches) return;
    mutatingRef.current.savedSearches = true;
    try {
      const resp = await fetch(`/api/data/saved-searches/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!resp.ok) { setMutationError('Could not delete search.'); return; }
      setSavedSearches((prev) => prev.filter((ss) => ss.id !== id));
    } catch { setMutationError('Could not delete search.'); }
    finally { mutatingRef.current.savedSearches = false; }
  }, []);

  const addQualityFlag = useCallback(async (f: QualityFlag) => {
    if (mutatingRef.current.qualityFlags) return;
    mutatingRef.current.qualityFlags = true;
    try {
      const next = [...qualityFlags, f];
      const resp = await fetch('/api/data/quality-flags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ qualityFlags: next }),
      });
      if (!resp.ok) { setMutationError('Could not save quality flag.'); return; }
      const data = await resp.json() as { qualityFlags: QualityFlag[] };
      setQualityFlags(data.qualityFlags);
    } catch { setMutationError('Could not save quality flag.'); }
    finally { mutatingRef.current.qualityFlags = false; }
  }, [qualityFlags]);

  const updateQualityFlag = useCallback(async (caseId: string, parameter: string, status: QualityFlag['status']) => {
    if (mutatingRef.current.qualityFlags) return;
    mutatingRef.current.qualityFlags = true;
    try {
      const next = qualityFlags.map((f) =>
        f.caseId === caseId && f.parameter === parameter ? { ...f, status } : f
      );
      const resp = await fetch('/api/data/quality-flags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ qualityFlags: next }),
      });
      if (!resp.ok) { setMutationError('Could not save quality flag.'); return; }
      const data = await resp.json() as { qualityFlags: QualityFlag[] };
      setQualityFlags(data.qualityFlags);
    } catch { setMutationError('Could not save quality flag.'); }
    finally { mutatingRef.current.qualityFlags = false; }
  }, [qualityFlags]);

  const toggleExcludeCase = useCallback(async (caseId: string) => {
    if (mutatingRef.current.excludedCases) return;
    mutatingRef.current.excludedCases = true;
    try {
      const next = excludedCases.includes(caseId)
        ? excludedCases.filter((id) => id !== caseId)
        : [...excludedCases, caseId];
      const resp = await fetch('/api/data/excluded-cases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ excludedCases: next }),
      });
      if (!resp.ok) { setMutationError('Could not update excluded cases.'); return; }
      const data = await resp.json() as { excludedCases: string[] };
      setExcludedCases(data.excludedCases);
    } catch { setMutationError('Could not update excluded cases.'); }
    finally { mutatingRef.current.excludedCases = false; }
  }, [excludedCases]);

  const markCaseReviewed = useCallback(async (caseId: string) => {
    if (reviewedCases.includes(caseId)) return;
    if (mutatingRef.current.reviewedCases) return;
    mutatingRef.current.reviewedCases = true;
    try {
      const next = [...reviewedCases, caseId];
      const resp = await fetch('/api/data/reviewed-cases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ reviewedCases: next }),
      });
      if (!resp.ok) { setMutationError('Could not update reviewed cases.'); return; }
      const data = await resp.json() as { reviewedCases: string[] };
      setReviewedCases(data.reviewedCases);
    } catch { setMutationError('Could not update reviewed cases.'); }
    finally { mutatingRef.current.reviewedCases = false; }
  }, [reviewedCases]);

  const unmarkCaseReviewed = useCallback(async (caseId: string) => {
    if (mutatingRef.current.reviewedCases) return;
    mutatingRef.current.reviewedCases = true;
    try {
      const next = reviewedCases.filter((id) => id !== caseId);
      const resp = await fetch('/api/data/reviewed-cases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ reviewedCases: next }),
      });
      if (!resp.ok) { setMutationError('Could not update reviewed cases.'); return; }
      const data = await resp.json() as { reviewedCases: string[] };
      setReviewedCases(data.reviewedCases);
    } catch { setMutationError('Could not update reviewed cases.'); }
    finally { mutatingRef.current.reviewedCases = false; }
  }, [reviewedCases]);

  const value = useMemo<DataContextType>(() => ({
    loading: fhirLoading || dataLoading,
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
    dataLoading,
    dataError,
    mutationError,
    clearMutationError: () => setMutationError(null),
    retryLoadData: fetchPersistedData,
  }), [
    fhirLoading, dataLoading, error, bundles, centers, cases,
    savedSearches, addSavedSearch, removeSavedSearch,
    qualityFlags, addQualityFlag, updateQualityFlag,
    excludedCases, toggleExcludeCase, activeCases,
    reviewedCases, markCaseReviewed, unmarkCaseReviewed,
    reloadData, dataError, mutationError, fetchPersistedData,
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
