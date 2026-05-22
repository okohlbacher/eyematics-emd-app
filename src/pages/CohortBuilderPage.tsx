/** Cohort builder page — EMDREQ-KOH-001 to KOH-007, EMDREQ-QUAL-009/010 (filters, saved searches, therapy discontinuation). */
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  GitBranch,
  LayoutList,
  LineChart,
  Play,
  Save,
  Search,
  Sliders,
  Table2,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import Button from '../components/primitives/Button';
import Badge from '../components/primitives/Badge';
import { isDuplicateName, parseSubcohortName } from '../services/cohortNames';
import {
  applyFilters,
  getAge,
  getLatestObservation,
  LOINC_CRT,
  LOINC_VISUS,
  SNOMED_AMD,
  SNOMED_DR,
} from '../services/fhirLoader';
import { getSettings } from '../services/settingsService';
import { getCachedDisplay, useDiagnosisDisplay } from '../services/terminology';
import type { CohortFilter, SavedSearch } from '../types/fhir';
import { formatDate } from '../utils/dateFormat';
import { datedFilename,downloadCsv, downloadJson } from '../utils/download';
import AdvancedFilterDialog from './AdvancedFilterDialog';

type SortField = 'date' | 'name';

/**
 * COH-02 / T-33-04: Safe-pick whitelist for CohortFilter deserialization from sessionStorage.
 * Accepts only known keys with correct shapes; preset only if one of the four literals.
 * flaggedCaseIds stored as string[] is reconstructed as a Set.
 */
function safePickCohortFilter(raw: unknown): CohortFilter {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const parsed = raw as Record<string, unknown>;
  const safe: CohortFilter = {};
  if (Array.isArray(parsed.diagnosis)) safe.diagnosis = parsed.diagnosis.map(String);
  if (Array.isArray(parsed.gender)) safe.gender = parsed.gender.map(String);
  if (Array.isArray(parsed.ageRange) && parsed.ageRange.length === 2) safe.ageRange = [Number(parsed.ageRange[0]), Number(parsed.ageRange[1])];
  if (Array.isArray(parsed.visusRange) && parsed.visusRange.length === 2) safe.visusRange = [Number(parsed.visusRange[0]), Number(parsed.visusRange[1])];
  if (Array.isArray(parsed.crtRange) && parsed.crtRange.length === 2) safe.crtRange = [Number(parsed.crtRange[0]), Number(parsed.crtRange[1])];
  if (Array.isArray(parsed.centers)) safe.centers = parsed.centers.map(String);
  // Phase 33 fields
  const PRESET_LITERALS = ['therapyBreaker', 'implausibleCrt', 'flaggedQuality', 'implausibleVisus'] as const;
  if (typeof parsed.preset === 'string' && (PRESET_LITERALS as readonly string[]).includes(parsed.preset)) {
    safe.preset = parsed.preset as CohortFilter['preset'];
  }
  if (Array.isArray(parsed.flaggedCaseIds)) safe.flaggedCaseIds = new Set(parsed.flaggedCaseIds.map(String));
  if (Array.isArray(parsed.diagnosisSubtype)) safe.diagnosisSubtype = parsed.diagnosisSubtype.map(String);
  if (typeof parsed.hasComorbidity === 'boolean') safe.hasComorbidity = parsed.hasComorbidity;
  if (Array.isArray(parsed.hba1cRange) && parsed.hba1cRange.length === 2) safe.hba1cRange = [Number(parsed.hba1cRange[0]), Number(parsed.hba1cRange[1])];
  if (Array.isArray(parsed.medicationCodes)) safe.medicationCodes = parsed.medicationCodes.map(String);
  const LATERALITY_LITERALS = ['OD', 'OS', 'OU'] as const;
  if (typeof parsed.laterality === 'string' && (LATERALITY_LITERALS as readonly string[]).includes(parsed.laterality)) {
    safe.laterality = parsed.laterality as CohortFilter['laterality'];
  }
  return safe;
}

/**
 * Per-code diagnosis chip rendered with the terminology resolver hook (Phase 25 D-19).
 * Extracted so `useDiagnosisDisplay` lives at the top of a component.
 * `system` is undefined here — this map iterates raw codes pulled from
 * `cond.code.coding.map((cd) => cd.code)`, which loses system context (D-05 sentinel path).
 */
function DiagnosisCodeChip({ code, locale, prefix }: { code: string; locale: string; prefix: string }) {
  const { label, fullText } = useDiagnosisDisplay(code, undefined, locale);
  return (
    <span title={fullText} className="cursor-help border-b border-dotted border-gray-400 dark:border-gray-500">
      {prefix}{label}
    </span>
  );
}

export default function CohortBuilderPage() {
  const { activeCases, centers, savedSearches, addSavedSearch, removeSavedSearch, qualityFlags } =
    useData();
  const navigate = useNavigate();
  const { locale, t } = useLanguage();

  const [filters, setFilters] = useState<CohortFilter>(() => {
    // COH-02: restore persisted filter state from sessionStorage on mount (T-33-04 safe-pick)
    try {
      const raw = sessionStorage.getItem('emd-cohort-filters');
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      return safePickCohortFilter(parsed);
    } catch { return {}; }
  });
  const [showSaved, setShowSaved] = useState(false);
  const [saveName, setSaveName] = useState('');

  const [savedSort, setSavedSort] = useState<SortField>('date');

  // COH-02: persist filter changes to sessionStorage on every update
  useEffect(() => {
    try {
      if (Object.keys(filters).length === 0) {
        // Empty filter object — remove the key so Reset leaves no residue
        sessionStorage.removeItem('emd-cohort-filters');
        return;
      }
      // flaggedCaseIds is a Set — convert to array for JSON serialization (RESEARCH Pitfall 2)
      const serializable = filters.flaggedCaseIds !== undefined
        ? { ...filters, flaggedCaseIds: Array.from(filters.flaggedCaseIds) }
        : filters;
      sessionStorage.setItem('emd-cohort-filters', JSON.stringify(serializable));
    } catch { /* ignore — storage quota or private mode */ }
  }, [filters]);

  // Ref to the save-name input for cursor placement (Pitfall 5, D-03)
  const saveNameInputRef = useRef<HTMLInputElement>(null);
  // Track whether a Split pre-fill just occurred, so useEffect can place the cursor correctly
  const splitPreFillRef = useRef(false);

  // Effect: after saveName changes from a Split button click, place cursor at end
  useEffect(() => {
    if (splitPreFillRef.current && saveNameInputRef.current) {
      const len = saveName.length;
      saveNameInputRef.current.setSelectionRange(len, len);
      splitPreFillRef.current = false;
    }
  }, [saveName]);

  // -------------------------------------------------------------------------
  // Live validation (runs on every saveName change — consistent with existing
  // disabled={!saveName.trim()} pattern; no blur required)
  // -------------------------------------------------------------------------
  const { hasHardError, isHardError, validationMsg } = (() => {
    const trimmed = saveName.trim();
    if (!trimmed) return { hasHardError: false, isHardError: false, validationMsg: '' };

    const colonCount = trimmed.split(':').length - 1;

    // Hard error: 2+ colons
    if (colonCount >= 2) {
      return { hasHardError: true, isHardError: true, validationMsg: t('cohortNameTooManyColons') };
    }

    // Hard errors for empty segments when exactly one colon
    if (colonCount === 1) {
      // Check empty segments via parseSubcohortName (throws for invalid)
      let parent: string;
      try {
        ({ parent } = parseSubcohortName(trimmed));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('parent segment')) {
          return { hasHardError: true, isHardError: true, validationMsg: t('cohortNameEmptyParent') };
        }
        if (msg.includes('sub segment')) {
          return { hasHardError: true, isHardError: true, validationMsg: t('cohortNameEmptySub') };
        }
        return { hasHardError: true, isHardError: true, validationMsg: t('cohortNameTooManyColons') };
      }

      // Duplicate check before orphan (D-04)
      if (isDuplicateName(trimmed, savedSearches.map((s) => s.name))) {
        return { hasHardError: true, isHardError: true, validationMsg: t('cohortNameDuplicate') };
      }

      // Soft orphan warning — parent name exists as subcohort with no matching parent cohort
      const parentExists = savedSearches.some(
        (s) => s.name.trim().toLowerCase() === parent.toLowerCase(),
      );
      if (!parentExists) {
        return {
          hasHardError: false,
          isHardError: false,
          validationMsg: t('cohortNameOrphanWarning'),
        };
      }

      return { hasHardError: false, isHardError: false, validationMsg: '' };
    }

    // No colon (plain name) — duplicate check
    if (isDuplicateName(trimmed, savedSearches.map((s) => s.name))) {
      return { hasHardError: true, isHardError: true, validationMsg: t('cohortNameDuplicate') };
    }

    return { hasHardError: false, isHardError: false, validationMsg: '' };
  })();

  // Text state for visus inputs (allows typing decimals with comma or dot)
  // CR-02: seed from restored visusRange so inputs are not blank after sessionStorage rehydration
  const [visusMinText, setVisusMinText] = useState(() => {
    try {
      const raw = sessionStorage.getItem('emd-cohort-filters');
      if (!raw) return '';
      const restored = safePickCohortFilter(JSON.parse(raw) as unknown);
      return restored.visusRange?.[0] != null ? String(restored.visusRange[0]) : '';
    } catch { return ''; }
  });
  const [visusMaxText, setVisusMaxText] = useState(() => {
    try {
      const raw = sessionStorage.getItem('emd-cohort-filters');
      if (!raw) return '';
      const restored = safePickCohortFilter(JSON.parse(raw) as unknown);
      return restored.visusRange?.[1] != null ? String(restored.visusRange[1]) : '';
    } catch { return ''; }
  });

  const [showDetailedView, setShowDetailedView] = useState(false);

  // COH-03: Advanced dialog visibility
  const [showAdvancedDialog, setShowAdvancedDialog] = useState(false);

  // COH-03: Apply preset — sets filters.preset; flaggedQuality also builds flaggedCaseIds
  const applyPreset = (preset: NonNullable<CohortFilter['preset']>) => {
    if (preset === 'flaggedQuality') {
      const flaggedCaseIds = new Set(
        qualityFlags
          .filter((f) => f.status === 'open')
          .map((f) => f.caseId),
      );
      setFilters((prev) => ({ ...prev, preset, flaggedCaseIds }));
    } else {
      setFilters((prev) => ({ ...prev, preset, flaggedCaseIds: undefined }));
    }
  };

  // COH-03: Clear active preset (and flaggedCaseIds)
  const clearPreset = () => {
    setFilters((prev) => {
      const { preset: _, flaggedCaseIds: __, ...rest } = prev;
      return rest;
    });
  };

  // COH-04: Derive distinct medication options from activeCases
  const medicationOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of activeCases) {
      for (const med of c.medications) {
        const coding = med.medicationCodeableConcept?.coding;
        if (!coding || coding.length === 0) continue;
        const code = coding[0].code;
        if (!code || seen.has(code)) continue;
        const label = coding[0].display ?? (coding[0] as { text?: string }).text ?? code;
        seen.set(code, label);
      }
    }
    return [...seen.entries()]
      .map(([code, label]) => ({ code, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [activeCases]);

  // -------------------------------------------------------------------------
  // COH-01: Inline numeric field validation (derived, no useState)
  // -------------------------------------------------------------------------
  const ageError = (() => {
    const min = filters.ageRange?.[0];
    const max = filters.ageRange?.[1];
    if (min !== undefined && (isNaN(min) || min < 0)) return t('cohortValidationAgeNonNumeric');
    if (max !== undefined && (isNaN(max) || max < 0)) return t('cohortValidationAgeNonNumeric');
    if (min !== undefined && max !== undefined && min > max) return t('cohortValidationAgeLowerExceedsUpper');
    return '';
  })();

  const visusError = (() => {
    const minParsed = visusMinText !== '' && visusMinText !== '.' && visusMinText !== ','
      ? parseFloat(visusMinText.replace(',', '.'))
      : NaN;
    const maxParsed = visusMaxText !== '' && visusMaxText !== '.' && visusMaxText !== ','
      ? parseFloat(visusMaxText.replace(',', '.'))
      : NaN;
    if (!isNaN(minParsed) && minParsed > 1) return t('cohortValidationVisusOutOfRange');
    if (!isNaN(maxParsed) && maxParsed > 1) return t('cohortValidationVisusOutOfRange');
    if (!isNaN(minParsed) && !isNaN(maxParsed) && minParsed > maxParsed) return t('cohortValidationVisusLowerExceedsUpper');
    return '';
  })();

  const crtError = (() => {
    const min = filters.crtRange?.[0];
    const max = filters.crtRange?.[1];
    if (min !== undefined && (isNaN(min) || min < 0)) return t('cohortValidationCrtNonNumeric');
    if (max !== undefined && (isNaN(max) || max < 0)) return t('cohortValidationCrtNonNumeric');
    if (min !== undefined && max !== undefined && min > max) return t('cohortValidationCrtLowerExceedsUpper');
    return '';
  })();

  const hasAnyFilterError = !!(ageError || visusError || crtError);

  // COH-03: Helper to clear preset when a manual filter is edited
  const clearPresetOnManualEdit = (updater: (prev: CohortFilter) => CohortFilter) => {
    setFilters((prev) => {
      const next = updater(prev);
      if (next.preset) {
        const { preset: _, flaggedCaseIds: __, ...rest } = next;
        return rest;
      }
      return next;
    });
  };

  // COH-04: Derived advanced filter activity indicators
  const hasAdvancedFilters = !!(
    filters.diagnosisSubtype?.length ||
    filters.hasComorbidity ||
    filters.hba1cRange ||
    filters.medicationCodes?.length ||
    filters.laterality
  );
  const activeAdvancedCount = [
    filters.diagnosisSubtype?.length ? 1 : 0,
    filters.hasComorbidity ? 1 : 0,
    filters.hba1cRange ? 1 : 0,
    filters.medicationCodes?.length ? 1 : 0,
    filters.laterality ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  // Build a filter copy that excludes invalid fields so live results ignore them (D-03)
  const validFilters = useMemo<CohortFilter>(() => {
    const f = { ...filters };
    if (ageError) delete f.ageRange;
    if (visusError) delete f.visusRange;
    if (crtError) delete f.crtRange;
    return f;
  }, [filters, ageError, visusError, crtError]);

  const filteredCases = useMemo(() => {
    const { therapyInterrupterDays, therapyBreakerDays, crtImplausibleThresholdUm } = getSettings();
    return applyFilters(activeCases, validFilters, {
      therapyInterrupterDays,
      therapyBreakerDays,
      crtImplausibleThresholdUm,
    });
  }, [activeCases, validFilters]);

  // Summary metrics for the default (non-detailed) view
  const cohortSummary = useMemo(() => {
    if (filteredCases.length === 0) return null;
    const ages = filteredCases.map((c) => getAge(c.birthDate)).filter((a) => a > 0);
    const visusList = filteredCases
      .map((c) => getLatestObservation(c.observations, LOINC_VISUS)?.valueQuantity?.value)
      .filter((v): v is number => v !== undefined && v !== null && !isNaN(v));
    const uniqueCenters = new Set(filteredCases.map((c) => c.centerId));
    return {
      ageMin: ages.length ? Math.min(...ages) : null,
      ageMax: ages.length ? Math.max(...ages) : null,
      visusMin: visusList.length ? Math.min(...visusList) : null,
      visusMax: visusList.length ? Math.max(...visusList) : null,
      centerCount: uniqueCenters.size,
    };
  }, [filteredCases]);

  const handleSave = () => {
    if (!saveName.trim()) return;
    if (hasHardError) return; // defense in depth — button is already disabled on hard error
    // WR-05: persist validFilters (invalid ranges stripped) rather than raw filters,
    // so saved searches never encode a broken visus/age/crt range that bypassed the
    // disabled-button guard (e.g. after CR-02 fix: a restored-but-not-yet-validated range).
    const s: SavedSearch = {
      id: crypto.randomUUID(),
      name: saveName.trim(),
      createdAt: new Date().toISOString(),
      filters: { ...validFilters },
    };
    addSavedSearch(s);
    setSaveName('');
  };

  const handleLoadSearch = (s: SavedSearch) => {
    setFilters(s.filters);
    setShowSaved(false);
  };

  // K08 N08.01: Dataset download
  const handleExportCsv = () => {
    const headers = ['Pseudonym', 'Gender', 'Age', 'Diagnosis', 'Visus', 'CRT (µm)', 'Center'];
    const rows = filteredCases.map((c) => {
      const latestVisus = getLatestObservation(c.observations, LOINC_VISUS);
      const latestCrt = getLatestObservation(c.observations, LOINC_CRT);
      const diagCodes = c.conditions.flatMap((cond) => cond.code.coding.map((cd) => cd.code));
      return [
        c.pseudonym,
        c.gender,
        String(getAge(c.birthDate)),
        diagCodes.map((code) => getCachedDisplay(undefined, code, locale)).join('; '),
        latestVisus?.valueQuantity?.value?.toFixed(2) ?? '',
        String(latestCrt?.valueQuantity?.value ?? ''),
        c.centerName,
      ];
    });
    downloadCsv(headers, rows, datedFilename('cohort-export', 'csv'));
  };

  const handleExportJson = () => {
    const data = filteredCases.map((c) => ({
      pseudonym: c.pseudonym,
      gender: c.gender,
      birthDate: c.birthDate,
      centerId: c.centerId,
      centerName: c.centerName,
      conditions: c.conditions,
      observations: c.observations,
      procedures: c.procedures,
      medications: c.medications,
    }));
    downloadJson(data, datedFilename('cohort-export', 'json'));
  };

  const diagnoses = [
    { code: SNOMED_AMD, label: t('diagnosisAMD') },
    { code: SNOMED_DR, label: t('diagnosisDR') },
  ];

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('cohortTitle')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {t('cohortSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSaved(!showSaved)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300"
          >
            <Search className="w-4 h-4" />
            {t('savedSearches')} ({savedSearches.length})
            {showSaved ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>

      {/* Saved searches panel */}
      {showSaved && savedSearches.length > 0 && (
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {t('savedSearchDefs')}
            </h3>
            <button
              onClick={() => setSavedSort(savedSort === 'date' ? 'name' : 'date')}
              className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600/50"
              title={savedSort === 'date' ? t('sortByName') : t('sortByDate')}
            >
              <ArrowUpDown className="w-3 h-3" />
              {savedSort === 'date' ? t('sortByDate') : t('sortByName')}
            </button>
          </div>
          <div className="space-y-2">
            {[...savedSearches]
              .sort((a, b) =>
                savedSort === 'name'
                  ? a.name.localeCompare(b.name)
                  : b.createdAt.localeCompare(a.createdAt)
              )
              .map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div>
                  <p className="font-medium text-sm">{s.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(s.createdAt, locale)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      splitPreFillRef.current = true;
                      setSaveName(`${s.name.trim()}:`);
                      if (typeof saveNameInputRef.current?.scrollIntoView === 'function') {
                        saveNameInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      }
                      saveNameInputRef.current?.focus();
                    }}
                    className="p-1.5 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
                    title={t('cohortSplitIntoSubcohort')}
                    aria-label={t('cohortSplitIntoSubcohort')}
                  >
                    <GitBranch className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/analysis?tab=trajectories&cohort=${encodeURIComponent(s.id)}`)}
                    className="p-1.5 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
                    title={t('outcomesOpenForCohort')}
                    aria-label={t('outcomesOpenForCohort')}
                  >
                    <LineChart className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleLoadSearch(s)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                    title={t('execute')}
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeSavedSearch(s.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    title={t('delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Filter panel */}
        <div className="col-span-4 space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              {t('filterCriteria')}
            </h3>

            {/* COH-03: Quick presets */}
            <div className="mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                {t('cohortPresets')}
              </p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {(
                  [
                    { key: 'therapyBreaker', label: t('presetTherapyBreaker') },
                    { key: 'implausibleCrt', label: t('presetImplausibleCrt') },
                    { key: 'flaggedQuality', label: t('presetFlaggedQuality') },
                    { key: 'implausibleVisus', label: t('presetImplausibleVisus') },
                  ] as const
                ).map(({ key, label }) => {
                  const isActive = filters.preset === key;
                  return (
                    <Button
                      key={key}
                      variant={isActive ? 'soft' : 'ghost'}
                      size="sm"
                      className={`px-3${isActive ? ' ring-1 ring-[var(--color-teal)]' : ''}`}
                      aria-pressed={isActive ? 'true' : 'false'}
                      onClick={() => {
                        if (isActive) {
                          clearPreset();
                        } else {
                          applyPreset(key);
                        }
                      }}
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
              <div className="border-t border-[var(--color-line)] mt-3 mb-4" />
            </div>

            {/* Diagnosis */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('diagnosis')}
              </label>
              {diagnoses.map((d) => (
                <label
                  key={d.code}
                  className="flex items-center gap-2 mb-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={filters.diagnosis?.includes(d.code) ?? false}
                    onChange={(e) => {
                      const current = filters.diagnosis ?? [];
                      clearPresetOnManualEdit((prev) => ({
                        ...prev,
                        diagnosis: e.target.checked
                          ? [...current, d.code]
                          : current.filter((c) => c !== d.code),
                      }));
                    }}
                    className="rounded border-gray-300"
                  />
                  {d.label}
                </label>
              ))}
            </div>

            {/* Gender */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('gender')}
              </label>
              {['female', 'male'].map((g) => (
                <label
                  key={g}
                  className="flex items-center gap-2 mb-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={filters.gender?.includes(g) ?? false}
                    onChange={(e) => {
                      const current = filters.gender ?? [];
                      clearPresetOnManualEdit((prev) => ({
                        ...prev,
                        gender: e.target.checked
                          ? [...current, g]
                          : current.filter((c) => c !== g),
                      }));
                    }}
                    className="rounded border-gray-300"
                  />
                  {g === 'female' ? t('female') : t('male')}
                </label>
              ))}
            </div>

            {/* Centers */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('centers')}
              </label>
              {centers.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 mb-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={filters.centers?.includes(c.id) ?? false}
                    onChange={(e) => {
                      const current = filters.centers ?? [];
                      clearPresetOnManualEdit((prev) => ({
                        ...prev,
                        centers: e.target.checked
                          ? [...current, c.id]
                          : current.filter((x) => x !== c.id),
                      }));
                    }}
                    className="rounded border-gray-300"
                  />
                  {c.name}
                </label>
              ))}
            </div>

            {/* Age range */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('ageYears')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  min={0}
                  value={filters.ageRange?.[0] ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') {
                      clearPresetOnManualEdit((f) => { const { ageRange: _, ...rest } = f; return rest; });
                      return;
                    }
                    const v = Number(raw);
                    if (isNaN(v)) return; // skip NaN — leave current state so live results don't freeze
                    clearPresetOnManualEdit((f) => ({ ...f, ageRange: [v, f.ageRange?.[1] ?? 120] }));
                  }}
                  className="w-20 px-2 py-1.5 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                />
                <span className="text-gray-400 dark:text-gray-500">—</span>
                <input
                  type="number"
                  placeholder="Max"
                  min={0}
                  value={filters.ageRange?.[1] ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') {
                      clearPresetOnManualEdit((f) => {
                        const { ageRange } = f;
                        if (!ageRange) return f;
                        return { ...f, ageRange: [ageRange[0], 120] };
                      });
                      return;
                    }
                    const v = Number(raw);
                    if (isNaN(v)) return;
                    clearPresetOnManualEdit((f) => ({ ...f, ageRange: [f.ageRange?.[0] ?? 0, v] }));
                  }}
                  className="w-20 px-2 py-1.5 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                />
              </div>
              {ageError && (
                <p
                  id="age-range-validation"
                  role="alert"
                  className="mt-1 text-xs px-2 py-1.5 rounded border bg-red-50 border-red-200 text-red-600 dark:bg-[--color-coral-soft] dark:border-[--color-coral] dark:text-[--color-coral-ink]"
                >
                  {ageError}
                </p>
              )}
            </div>

            {/* Visus range */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('visusDecimal')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,0"
                  value={visusMinText}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setVisusMinText(raw);
                    if (raw === '' || raw === '.' || raw === ',') {
                      clearPresetOnManualEdit((f) => { const { visusRange: _, ...rest } = f; return rest; });
                      return;
                    }
                    const v = parseFloat(raw.replace(',', '.'));
                    if (!isNaN(v) && v >= 0) {
                      clearPresetOnManualEdit((f) => ({ ...f, visusRange: [v, f.visusRange?.[1] ?? 2] }));
                    }
                  }}
                  className="w-20 px-2 py-1.5 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                />
                <span className="text-gray-400 dark:text-gray-500">—</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="1,0"
                  value={visusMaxText}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setVisusMaxText(raw);
                    if (raw === '' || raw === '.' || raw === ',') {
                      clearPresetOnManualEdit((f) => { const { visusRange: _, ...rest } = f; return rest; });
                      return;
                    }
                    const v = parseFloat(raw.replace(',', '.'));
                    if (!isNaN(v) && v >= 0) {
                      clearPresetOnManualEdit((f) => ({ ...f, visusRange: [f.visusRange?.[0] ?? 0, v] }));
                    }
                  }}
                  className="w-20 px-2 py-1.5 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                />
              </div>
              {visusError && (
                <p
                  id="visus-range-validation"
                  role="alert"
                  className="mt-1 text-xs px-2 py-1.5 rounded border bg-red-50 border-red-200 text-red-600 dark:bg-[--color-coral-soft] dark:border-[--color-coral] dark:text-[--color-coral-ink]"
                >
                  {visusError}
                </p>
              )}
            </div>

            {/* CRT range */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('retinalThickness')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  min={0}
                  value={filters.crtRange?.[0] ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') {
                      clearPresetOnManualEdit((f) => { const { crtRange: _, ...rest } = f; return rest; });
                      return;
                    }
                    const v = Number(raw);
                    if (isNaN(v)) return;
                    clearPresetOnManualEdit((f) => ({ ...f, crtRange: [v, f.crtRange?.[1] ?? 800] }));
                  }}
                  className="w-20 px-2 py-1.5 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                />
                <span className="text-gray-400 dark:text-gray-500">—</span>
                <input
                  type="number"
                  placeholder="Max"
                  min={0}
                  value={filters.crtRange?.[1] ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') {
                      clearPresetOnManualEdit((f) => {
                        const { crtRange } = f;
                        if (!crtRange) return f;
                        return { ...f, crtRange: [crtRange[0], 800] };
                      });
                      return;
                    }
                    const v = Number(raw);
                    if (isNaN(v)) return;
                    clearPresetOnManualEdit((f) => ({ ...f, crtRange: [f.crtRange?.[0] ?? 0, v] }));
                  }}
                  className="w-20 px-2 py-1.5 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                />
              </div>
              {crtError && (
                <p
                  id="crt-range-validation"
                  role="alert"
                  className="mt-1 text-xs px-2 py-1.5 rounded border bg-red-50 border-red-200 text-red-600 dark:bg-[--color-coral-soft] dark:border-[--color-coral] dark:text-[--color-coral-ink]"
                >
                  {crtError}
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setFilters({});
                  setVisusMinText('');
                  setVisusMaxText('');
                  try { sessionStorage.removeItem('emd-cohort-filters'); } catch { /* ignore */ }
                }}
                className="flex-1 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300"
              >
                {t('reset')}
              </button>
            </div>

            {/* COH-04: Advanced filters trigger */}
            <div className="mt-2">
              <Button
                variant={hasAdvancedFilters ? 'accent' : 'ghost'}
                size="sm"
                icon={<Sliders className="w-3.5 h-3.5" />}
                className="w-full justify-center"
                onClick={() => setShowAdvancedDialog(true)}
              >
                {t('advancedFilters')}
                {hasAdvancedFilters && activeAdvancedCount > 0 && (
                  <Badge tone="teal" className="ml-1">{activeAdvancedCount}</Badge>
                )}
              </Button>
            </div>

            {/* COH-04: AdvancedFilterDialog */}
            <AdvancedFilterDialog
              open={showAdvancedDialog}
              filters={filters}
              medicationOptions={medicationOptions}
              onApply={(advancedFields) => {
                setFilters((prev) => ({ ...prev, ...advancedFields }));
              }}
              onClose={() => setShowAdvancedDialog(false)}
            />

            {/* Save search */}
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                {t('saveCohortLabel')}
              </p>
              <div className="flex gap-2">
                <input
                  id="cohort-name-input"
                  ref={saveNameInputRef}
                  type="text"
                  placeholder={t('searchNamePlaceholder')}
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  aria-invalid={hasHardError ? 'true' : 'false'}
                  aria-describedby={validationMsg ? 'cohort-name-validation' : undefined}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm text-left text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                />
                <button
                  onClick={handleSave}
                  disabled={hasHardError || hasAnyFilterError || !saveName.trim()}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                >
                  <Save className="w-3.5 h-3.5" />
                  {t('cohortSaveSearch')}
                </button>
              </div>
              {validationMsg && (
                <p
                  id="cohort-name-validation"
                  role={isHardError ? 'alert' : 'status'}
                  className={`mt-1 text-xs px-2 py-1 rounded border ${
                    isHardError
                      ? 'bg-red-50 border-red-200 text-red-600 dark:bg-[--color-coral-soft] dark:border-[--color-coral] dark:text-[--color-coral-ink]'
                      : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-[--color-amber-soft] dark:border-[--color-amber] dark:text-[--color-amber-ink]'
                  }`}
                >
                  {validationMsg}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="col-span-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {t('cohortCases')}: {filteredCases.length} {t('cases')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('of')} {activeCases.length} {t('totalCases')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Detailed view toggle */}
                <button
                  type="button"
                  onClick={() => setShowDetailedView((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${
                    showDetailedView
                      ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                  title={showDetailedView ? t('summaryView') : t('detailedView')}
                >
                  {showDetailedView ? (
                    <LayoutList className="w-4 h-4" />
                  ) : (
                    <Table2 className="w-4 h-4" />
                  )}
                  {showDetailedView ? t('summaryView') : t('detailedView')}
                </button>
                {/* K08 N08.01: Dataset download */}
                <button
                  onClick={handleExportCsv}
                  disabled={filteredCases.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 disabled:opacity-50"
                  title={t('downloadCsv')}
                >
                  <Download className="w-4 h-4" />
                  CSV
                </button>
                <button
                  onClick={handleExportJson}
                  disabled={filteredCases.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 disabled:opacity-50"
                  title={t('downloadJson')}
                >
                  <Download className="w-4 h-4" />
                  JSON
                </button>
                <button
                  onClick={() => {
                    const params = new URLSearchParams();
                    params.set('filters', JSON.stringify(filters));
                    navigate(`/analysis?${params.toString()}`);
                  }}
                  disabled={filteredCases.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {t('analyzeCohort')}
                </button>
              </div>
            </div>

            {/* Summary view (default) */}
            {!showDetailedView && (
              <div className="p-6">
                {!cohortSummary ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">{t('cohortSummaryNoData')}</p>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">{t('cohortSummaryAgeRange')}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {cohortSummary.ageMin ?? '—'}–{cohortSummary.ageMax ?? '—'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('yearsShort')}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">{t('cohortSummaryVisusRange')}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {cohortSummary.visusMin !== null ? cohortSummary.visusMin.toFixed(2) : '—'}–{cohortSummary.visusMax !== null ? cohortSummary.visusMax.toFixed(2) : '—'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('visusDecimal')}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">{t('cohortSummaryCenters')}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{cohortSummary.centerCount}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('centers')}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Detailed view (table) */}
            {showDetailedView && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        {t('pseudonym')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        {t('gender')}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        {t('age')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        {t('diagnosis')}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        {t('visus')}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        CRT (µm)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        {t('center')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {filteredCases.map((c) => {
                      const latestVisus = getLatestObservation(
                        c.observations,
                        LOINC_VISUS
                      );
                      const latestCrt = getLatestObservation(
                        c.observations,
                        LOINC_CRT
                      );
                      const diagCodes = c.conditions.flatMap((cond) =>
                        cond.code.coding.map((cd) => cd.code)
                      );
                      return (
                        <tr
                          key={c.id}
                          className="hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer"
                          onClick={() => navigate(`/case/${c.id}`)}
                        >
                          <td className="px-4 py-3 font-mono text-sm text-blue-600">
                            {c.pseudonym}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {c.gender === 'female' ? t('femaleShort') : t('maleShort')}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            {getAge(c.birthDate)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {diagCodes.map((code, i) => (
                              <DiagnosisCodeChip key={code} code={code} locale={locale} prefix={i > 0 ? ', ' : ''} />
                            ))}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-mono">
                            {latestVisus?.valueQuantity?.value?.toFixed(2) ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-mono">
                            {latestCrt?.valueQuantity?.value ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                            {c.centerName}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
