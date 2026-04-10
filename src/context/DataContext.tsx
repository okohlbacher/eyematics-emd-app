import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
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
import { useLocalStorageState } from '../hooks/useLocalStorageState';

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

export function DataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bundles, setBundles] = useState<FhirBundle[]>([]);
  const [centers, setCenters] = useState<CenterInfo[]>([]);
  const [cases, setCases] = useState<PatientCase[]>([]);
  const [savedSearches, setSavedSearches] = useLocalStorageState<SavedSearch[]>('emd-saved-searches', []);
  const [qualityFlags, setQualityFlags] = useLocalStorageState<QualityFlag[]>('emd-quality-flags', []);
  const [excludedCases, setExcludedCases] = useLocalStorageState<string[]>('emd-excluded-cases', []);
  const [reviewedCases, setReviewedCases] = useLocalStorageState<string[]>('emd-reviewed-cases', []);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    loadAllBundles()
      .then((b) => {
        setBundles(b);
        setCenters(extractCenters(b));
        setCases(extractPatientCases(b));
        setLoading(false);
      })
      .catch((err) => {
        console.error('[DataProvider] Failed to load bundles:', err);
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
  }, [setSavedSearches]);

  const removeSavedSearch = useCallback((id: string) => {
    setSavedSearches((prev) => prev.filter((s) => s.id !== id));
  }, [setSavedSearches]);

  const addQualityFlag = useCallback((f: QualityFlag) => {
    setQualityFlags((prev) => [...prev, f]);
  }, [setQualityFlags]);

  const updateQualityFlag = useCallback((
    caseId: string,
    parameter: string,
    status: QualityFlag['status']
  ) => {
    setQualityFlags((prev) =>
      prev.map((f) =>
        f.caseId === caseId && f.parameter === parameter
          ? { ...f, status }
          : f
      ),
    );
  }, [setQualityFlags]);

  const toggleExcludeCase = useCallback((caseId: string) => {
    setExcludedCases((prev) =>
      prev.includes(caseId)
        ? prev.filter((id) => id !== caseId)
        : [...prev, caseId],
    );
  }, [setExcludedCases]);

  const markCaseReviewed = useCallback((caseId: string) => {
    setReviewedCases((prev) => {
      if (prev.includes(caseId)) return prev;
      return [...prev, caseId];
    });
  }, [setReviewedCases]);

  const unmarkCaseReviewed = useCallback((caseId: string) => {
    setReviewedCases((prev) => prev.filter((id) => id !== caseId));
  }, [setReviewedCases]);

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
