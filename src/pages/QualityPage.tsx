/** Data quality review page — EMDREQ-QUAL-001 to QUAL-010 (SDV, error flagging, exclusions, therapy discontinuation). */
import { Ban, CheckCircle2, Circle, Clock, Download } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { pickCoding } from '../../shared/fhirQueries';
import { applyFilters } from '../../shared/patientCases';
import { canonicalizeQualityParams, resolveQualityParams } from '../../shared/qualityParams';
import { getTherapyStatus } from '../../shared/qualityPredicates';
import { QualityFilterBar } from '../components/doc-quality/QualityFilterBar';
import QualityCaseDetail from '../components/quality/QualityCaseDetail';
import QualityCaseList from '../components/quality/QualityCaseList';
import QualityFlagDialog from '../components/quality/QualityFlagDialog';
import { QualityParamsChecklist } from '../components/quality/QualityParamsChecklist';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { useRecentActivity } from '../hooks/useRecentActivity';
import {
  getAge,
  getCenterShorthand,
  getLatestObservation,
  LOINC_CRT,
} from '../services/fhirLoader';
import { getSettings } from '../services/settingsService';
import { getCachedDisplay } from '../services/terminology';
import type { PatientCase, QualityFlag, QualityStatus } from '../types/fhir';
import { safePickCohortFilter } from '../utils/cohortFilterSerialization';
import { getDateLocale } from '../utils/dateFormat';
import { datedFilename, downloadCsv } from '../utils/download';
import { type TimeRange, timeRangeWindow } from '../utils/qualityMetrics';

function SummaryCard({ icon, count, label, total, ofLabel }: { icon: ReactNode; count: number; label: string; total?: number; ofLabel?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
      {icon}
      <div>
        <p className="text-xl font-bold dark:text-white">{count}</p>
        {total !== undefined && total > 0 && (
          <>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {count} / {total}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{Math.round((count / total) * 100)}%{ofLabel ? ` ${ofLabel} ${total}` : ''}</p>
          </>
        )}
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      </div>
    </div>
  );
}


export default function QualityPage() {
  const {
    cases,
    savedSearches,
    updateSavedSearchQualityParams,
    qualityFlags,
    addQualityFlag,
    updateQualityFlag,
    excludedCases,
    toggleExcludeCase,
    reviewedCases,
    markCaseReviewed,
    unmarkCaseReviewed,
  } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { locale, t } = useLanguage();
  const [searchParams] = useSearchParams();
  const { record } = useRecentActivity();

  const [selectedCase, setSelectedCase] = useState<PatientCase | null>(null);
  const [flagDialog, setFlagDialog] = useState<{ parameter: string; value: string } | null>(null);
  const [errorType, setErrorType] = useState('');

  // Search & filter state — filterStatus and filterTherapy are seeded from URL params on mount
  // via lazy initializers (no useEffect: avoids double-render flash, see RESEARCH Pitfall 3).
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<QualityStatus | 'all'>(() => {
    const v = searchParams.get('status');
    // 'flagged' is the locked D-04 URL contract value; it maps to 'in_progress' because
    // QualityStatus has no 'flagged' member and cases with an open quality flag are
    // caseStatus==='in_progress' (see caseStatus useMemo below and RESEARCH Pitfall 1).
    return v === 'flagged' ? 'in_progress' : 'all';
  });
  const [selectedCenters, setSelectedCenters] = useState<string[]>([]);
  const [filterTherapy, setFilterTherapy] = useState<string>(() => {
    const v = searchParams.get('therapy');
    return v === 'breaker' || v === 'interrupter' ? v : 'all';
  });
  const [filterCrt, setFilterCrt] = useState<'implausible' | 'all'>(() => {
    return searchParams.get('crt') === 'implausible' ? 'implausible' : 'all';
  });
  const [showExcluded, setShowExcluded] = useState(true);
  // Cohort scope selector: 'all' means no scope (global behavior); any other value is a SavedSearch.id.
  // Placed on-page above the summary cards rather than threaded through QualityCaseList to minimize
  // QualityCaseList prop churn (no new props on the list component for this feature).
  const [selectedCohortId, setSelectedCohortId] = useState<string>('all');
  // Time-range filter for Grundgesamtheit (QUAL-022): reuses DocQualityPage pattern.
  const [timeRange, setTimeRange] = useState<TimeRange>('all');

  // Auto-open the filter panel when a URL param seeds a non-default filter value
  // so the seeded filter state is immediately visible to the user.
  const [showFilters, setShowFilters] = useState<boolean>(() => {
    return (
      searchParams.get('therapy') !== null ||
      searchParams.get('status') !== null ||
      searchParams.get('crt') !== null
    );
  });

  // Record a recent-activity entry when the user opens a case (UX-02).
  // path is /quality (not the filtered URL) so restoring lands on the review surface
  // without re-applying URL filters — the user can adjust filters after returning.
  useEffect(() => {
    if (!selectedCase) return;
    record({
      id: selectedCase.id,
      label: selectedCase.pseudonym,
      sub: t('navQuality'),
      path: '/quality',
    });
  }, [selectedCase]); // eslint-disable-line react-hooks/exhaustive-deps -- record/t are stable refs; selectedCase is the meaningful dep

  const dateFmt = getDateLocale(locale);

  // Cohort-scoped base case set: when a cohort is selected, restrict to that cohort's cases
  // via applyFilters (same options as therapyStatuses below). Otherwise use the full `cases`.
  // The existing search/status/center/therapy/crt filters are layered on top of this scoped set.
  const scopedCases = useMemo(() => {
    if (selectedCohortId === 'all') return cases;
    const selectedSearch = savedSearches.find((s) => s.id === selectedCohortId);
    if (!selectedSearch) return cases;
    const settings = getSettings();
    return applyFilters(cases, safePickCohortFilter(selectedSearch.filters), {
      therapyInterrupterDays: settings.therapyInterrupterDays,
      therapyBreakerDays: settings.therapyBreakerDays,
      crtImplausibleThresholdUm: settings.crtImplausibleThresholdUm,
    });
  }, [cases, savedSearches, selectedCohortId]);

  // Time-scoped cases for QUAL-022 Grundgesamtheit: a case is INCLUDED when timeRange === 'all'
  // (or a malformed custom range) OR it has ≥1 observation inside the resolved
  // [from,to] window (B1: custom ranges carry an upper bound too — timeRangeWindow
  // resolves presets and custom ranges to concrete bounds). We keep a case-level
  // inclusion test here (rather than trimming observations) so the denominator
  // reflects only active-range cases without mutating each case's observations.
  const timeScopedCases = useMemo(() => {
    const window = timeRangeWindow(timeRange);
    if (!window) return scopedCases; // 'all' or malformed custom range → no windowing
    const fromMs = window.from.getTime();
    const toMs = window.to.getTime();
    return scopedCases.filter((c) =>
      c.observations.some((o) => {
        if (!o.effectiveDateTime) return false;
        const t = new Date(o.effectiveDateTime).getTime();
        return t >= fromMs && t <= toMs;
      })
    );
  }, [scopedCases, timeRange]);

  // activeQualityParams for the selected cohort: the raw qualityParams field from the SavedSearch.
  // QualityCaseDetail receives this and calls resolveQualityParams() to apply the tri-state logic.
  // When 'all' is selected, pass undefined so all checks run (back-compat fallback).
  const activeQualityParams = useMemo(() => {
    if (selectedCohortId === 'all') return undefined;
    return savedSearches.find((s) => s.id === selectedCohortId)?.qualityParams;
  }, [savedSearches, selectedCohortId]);

  const caseStatus = useMemo(() => {
    const statusMap = new Map<string, QualityStatus>();
    timeScopedCases.forEach((c) => {
      const flags = qualityFlags.filter((f) => f.caseId === c.id);
      if (reviewedCases.includes(c.id)) {
        statusMap.set(c.id, 'reviewed');
      } else if (flags.length === 0) {
        statusMap.set(c.id, 'unchecked');
      } else if (flags.some((f) => f.status === 'open')) {
        statusMap.set(c.id, 'in_progress');
      } else {
        statusMap.set(c.id, 'reviewed');
      }
    });
    return statusMap;
  }, [timeScopedCases, qualityFlags, reviewedCases]);

  const statusCounts = useMemo(() => {
    const counts = { unchecked: 0, in_progress: 0, reviewed: 0 };
    caseStatus.forEach((s) => counts[s]++);
    return counts;
  }, [caseStatus]);

  // Therapy status per case (EMDREQ-QUAL-009)
  const therapyStatuses = useMemo(() => {
    const settings = getSettings();
    const thresholds = {
      interrupterDays: settings.therapyInterrupterDays,
      breakerDays: settings.therapyBreakerDays,
    };
    const map = new Map<string, ReturnType<typeof getTherapyStatus>>();
    timeScopedCases.forEach((c) => map.set(c.id, getTherapyStatus(c, thresholds)));
    return map;
  }, [timeScopedCases]);

  const centerNames = useMemo(() => {
    const names = new Set(timeScopedCases.map((c) => c.centerName));
    return Array.from(names).sort();
  }, [timeScopedCases]);

  const filteredCases = useMemo(() => {
    return timeScopedCases.filter((c) => {
      if (searchQuery && !c.pseudonym.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterStatus !== 'all' && (caseStatus.get(c.id) ?? 'unchecked') !== filterStatus) return false;
      if (selectedCenters.length > 0 && !selectedCenters.includes(c.centerName)) return false;
      if (filterTherapy !== 'all' && therapyStatuses.get(c.id)?.status !== filterTherapy) return false;
      if (filterCrt === 'implausible') {
        const latest = getLatestObservation(c.observations, LOINC_CRT);
        const val = latest?.valueQuantity?.value;
        const threshold = getSettings().crtImplausibleThresholdUm;
        if (val == null || val <= threshold) return false;
      }
      if (!showExcluded && excludedCases.includes(c.id)) return false;
      return true;
    });
  }, [timeScopedCases, searchQuery, filterStatus, selectedCenters, filterTherapy, filterCrt, showExcluded, caseStatus, therapyStatuses, excludedCases]);

  const handleFlag = () => {
    if (!selectedCase || !flagDialog || !errorType) return;
    addQualityFlag({
      caseId: selectedCase.id,
      parameter: flagDialog.parameter,
      errorType,
      flaggedAt: new Date().toISOString(),
      flaggedBy: user?.username ?? 'unknown',
      status: 'open',
    });
    setFlagDialog(null);
    setErrorType('');
  };

  const handleExclude = (caseId: string) => toggleExcludeCase(caseId);

  const handleMarkReviewed = (caseId: string) => {
    if (reviewedCases.includes(caseId)) {
      unmarkCaseReviewed(caseId);
    } else {
      markCaseReviewed(caseId);
    }
  };

  const handleExportCsv = () => {
    if (filteredCases.length === 0) return;
    const headers = [
      t('pseudonym'), t('center'), t('age'), t('diagnosis'),
      t('qualityFilterStatus'), t('therapyDiscontinuation'), t('excludedCase'),
    ];
    const rows = filteredCases.map((c) => {
      const status = caseStatus.get(c.id) ?? 'unchecked';
      const ts = therapyStatuses.get(c.id);
      const statusLabel = status === 'reviewed' ? t('reviewed') : status === 'in_progress' ? t('inProgress') : t('unchecked');
      const therapyLabel = ts?.status === 'breaker' ? t('therapyBreaker') : ts?.status === 'interrupter' ? t('therapyInterrupter') : t('therapyActive');
      return [
        c.pseudonym,
        getCenterShorthand(c.centerId, c.centerName),
        String(getAge(c.birthDate)),
        (c.conditions ?? []).map((cond) => {
          const { system, code } = pickCoding(cond);
          return getCachedDisplay(system, code, locale);
        }).join('; '),
        statusLabel,
        therapyLabel,
        excludedCases.includes(c.id) ? '✓' : '',
      ];
    });
    downloadCsv(headers, rows, datedFilename('quality-review', 'csv'));
  };

  const caseFlags = selectedCase
    ? qualityFlags.filter((f) => f.caseId === selectedCase.id)
    : [];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('qualityTitle')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{t('qualitySubtitle')}</p>
      </div>

      {/* Time-range filter — QUAL-022: reuses DocQualityPage / QualityFilterBar pattern */}
      <div className="mb-4">
        <QualityFilterBar
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          selectedCenter=""
          onCenterChange={() => undefined}
          centerOptions={[]}
          showCenterFilter={false}
        />
      </div>

      {/* Export button + cohort scope selector in the same row */}
      <div className="flex items-center justify-between mb-2">
        {/* Cohort scope selector — placed on-page (not in QualityCaseList) to avoid prop churn.
            Restricts the reviewed set to a specific cohort's cases + honors its qualityParams. */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {t('qualityCohortScopeLabel')}
          </label>
          <select
            value={selectedCohortId}
            onChange={(e) => {
              setSelectedCohortId(e.target.value);
              setSelectedCase(null); // reset detail when scope changes
            }}
            className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 dark:bg-gray-800 dark:text-white"
          >
            <option value="all">{t('qualityCohortScopeAll')}</option>
            {savedSearches.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleExportCsv}
          disabled={filteredCases.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {t('exportCsv')}
        </button>
      </div>

      {/* C2 — quality-check selection, relocated here from Kohortenbildung.
          Edits the SELECTED cohort's qualityParams in place and persists via DataContext.
          Shown only when a specific cohort is in scope (the "all cases" view has no
          cohort to attach a selection to). */}
      <div className="mb-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          {t('qualityParamsLabel')}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {t('qualityParamsDescription')}
        </p>
        {selectedCohortId === 'all' ? (
          <p className="text-xs italic text-gray-400 dark:text-gray-500">
            {t('qualityParamsSelectCohortHint')}
          </p>
        ) : (
          <QualityParamsChecklist
            selected={resolveQualityParams(activeQualityParams)}
            onChange={(next) => {
              // Canonicalize all-keys ⇒ undefined (back-compat) before persisting (D2).
              updateSavedSearchQualityParams(selectedCohortId, canonicalizeQualityParams(next));
            }}
          />
        )}
      </div>

      {/* Grundgesamtheit label — QUAL-023: absolute population size always visible */}
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        <span className="font-medium text-gray-700 dark:text-gray-300">{t('qualityPopulationLabel')}:</span>{' '}
        {timeScopedCases.length}
      </p>

      {/* Status summary cards — counts + percentages reflect the time-scoped set */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <SummaryCard icon={<Circle className="w-5 h-5 text-gray-300" />} count={statusCounts.unchecked} label={t('unchecked')} total={timeScopedCases.length} />
        <SummaryCard icon={<Clock className="w-5 h-5 text-amber-500" />} count={statusCounts.in_progress} label={t('inProgress')} total={timeScopedCases.length} />
        <SummaryCard icon={<CheckCircle2 className="w-5 h-5 text-green-500" />} count={statusCounts.reviewed} label={t('reviewed')} total={timeScopedCases.length} />
        <SummaryCard icon={<Ban className="w-5 h-5 text-red-400" />} count={excludedCases.length} label={t('excludedCasesCount')} />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Case list */}
        <div className="col-span-4">
          <QualityCaseList
            cases={timeScopedCases}
            filteredCases={filteredCases}
            selectedCase={selectedCase}
            caseStatus={caseStatus}
            therapyStatuses={therapyStatuses}
            excludedCases={excludedCases}
            searchQuery={searchQuery}
            filterStatus={filterStatus}
            selectedCenters={selectedCenters}
            filterTherapy={filterTherapy}
            filterCrt={filterCrt}
            showExcluded={showExcluded}
            showFilters={showFilters}
            centerNames={centerNames}
            onSelectCase={setSelectedCase}
            onSearchChange={setSearchQuery}
            onFilterStatusChange={setFilterStatus}
            onSelectedCentersChange={setSelectedCenters}
            onFilterTherapyChange={setFilterTherapy}
            onFilterCrtChange={setFilterCrt}
            onShowExcludedChange={setShowExcluded}
            onToggleFilters={() => setShowFilters((v) => !v)}
          />
        </div>

        {/* Detail panel */}
        <div className="col-span-8">
          {!selectedCase ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-400 dark:text-gray-500">
              {t('selectCaseToReview')}
            </div>
          ) : (
            <QualityCaseDetail
              selectedCase={selectedCase}
              caseFlags={caseFlags}
              therapyStatus={therapyStatuses.get(selectedCase.id)}
              isExcluded={excludedCases.includes(selectedCase.id)}
              isReviewed={reviewedCases.includes(selectedCase.id)}
              dateFmt={dateFmt}
              activeQualityParams={activeQualityParams}
              onMarkReviewed={handleMarkReviewed}
              onExclude={handleExclude}
              onNavigateToCase={(id) => navigate(`/case/${id}`)}
              onOpenFlagDialog={(parameter, value) => setFlagDialog({ parameter, value })}
              onUpdateFlagStatus={(caseId, flaggedAt, status) =>
                updateQualityFlag(caseId, flaggedAt, status as QualityFlag['status'])
              }
            />
          )}
        </div>
      </div>

      {/* Flag dialog */}
      {flagDialog && (
        <QualityFlagDialog
          flagDialog={flagDialog}
          errorType={errorType}
          onErrorTypeChange={setErrorType}
          onSave={handleFlag}
          onCancel={() => {
            setFlagDialog(null);
            setErrorType('');
          }}
        />
      )}
    </div>
  );
}
