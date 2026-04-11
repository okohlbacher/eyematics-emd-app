import {
  AlertCircle,
  Ban,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Download,
  Filter,
  Flag,
  Search,
} from 'lucide-react';
import { useMemo,useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import {
  getAge,
  getCenterShorthand,
  getDiagnosisLabel,
  getObservationsByCode,
  LOINC_CRT,
  LOINC_VISUS,
  SNOMED_IVI,
} from '../services/fhirLoader';
import { getSettings } from '../services/settingsService';
import type { PatientCase,QualityFlag, QualityStatus } from '../types/fhir';
import { getDateLocale } from '../utils/dateFormat';
import { datedFilename,downloadCsv } from '../utils/download';

// Therapy discontinuation detection (EMDREQ-QUAL-009)
// Uses configurable thresholds from settings (K06 N06.01/N06.04)
function getTherapyStatus(pc: PatientCase): { status: 'active' | 'interrupter' | 'breaker'; gapDays: number } {
  const settings = getSettings();
  const injections = pc.procedures
    .filter((p) => p.code.coding.some((c) => c.code === SNOMED_IVI))
    .map((p) => new Date(p.performedDateTime ?? '').getTime())
    .filter((t) => !isNaN(t))
    .sort((a, b) => a - b);

  if (injections.length < 2) return { status: 'active', gapDays: 0 };

  let maxGap = 0;
  for (let i = 1; i < injections.length; i++) {
    const gap = (injections[i] - injections[i - 1]) / (1000 * 60 * 60 * 24);
    if (gap > maxGap) maxGap = gap;
  }

  // Last injection to "now"
  const lastToNow = (Date.now() - injections[injections.length - 1]) / (1000 * 60 * 60 * 24);
  if (lastToNow > maxGap) maxGap = lastToNow;

  if (maxGap > settings.therapyBreakerDays) return { status: 'breaker', gapDays: Math.round(maxGap) };
  if (maxGap > settings.therapyInterrupterDays) return { status: 'interrupter', gapDays: Math.round(maxGap) };
  return { status: 'active', gapDays: Math.round(maxGap) };
}

export default function QualityPage() {
  const { cases, qualityFlags, addQualityFlag, updateQualityFlag, excludedCases, toggleExcludeCase, reviewedCases, markCaseReviewed, unmarkCaseReviewed } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { locale, t } = useLanguage();
  const [selectedCase, setSelectedCase] = useState<PatientCase | null>(null);
  const [flagDialog, setFlagDialog] = useState<{
    parameter: string;
    value: string;
  } | null>(null);
  const [errorType, setErrorType] = useState('');

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<QualityStatus | 'all'>('all');
  const [filterCenter, setFilterCenter] = useState<string>('all');
  const [filterTherapy, setFilterTherapy] = useState<string>('all');
  const [showExcluded, setShowExcluded] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const dateFmt = getDateLocale(locale);

  const caseStatus = useMemo(() => {
    const statusMap = new Map<string, QualityStatus>();
    cases.forEach((c) => {
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
  }, [cases, qualityFlags, reviewedCases]);

  const statusCounts = useMemo(() => {
    const counts = { unchecked: 0, in_progress: 0, reviewed: 0 };
    caseStatus.forEach((s) => counts[s]++);
    return counts;
  }, [caseStatus]);

  // Therapy status per case (EMDREQ-QUAL-009)
  const therapyStatuses = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getTherapyStatus>>();
    cases.forEach((c) => map.set(c.id, getTherapyStatus(c)));
    return map;
  }, [cases]);

  // Unique center names for filter dropdown
  const centerNames = useMemo(() => {
    const names = new Set(cases.map((c) => c.centerName));
    return Array.from(names).sort();
  }, [cases]);

  // Filtered cases for the list
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      // Text search
      if (searchQuery && !c.pseudonym.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      // Status filter
      if (filterStatus !== 'all') {
        const s = caseStatus.get(c.id) ?? 'unchecked';
        if (s !== filterStatus) return false;
      }
      // Center filter
      if (filterCenter !== 'all' && c.centerName !== filterCenter) return false;
      // Therapy filter
      if (filterTherapy !== 'all') {
        const ts = therapyStatuses.get(c.id);
        if (ts?.status !== filterTherapy) return false;
      }
      // Excluded filter
      if (!showExcluded && excludedCases.includes(c.id)) return false;
      return true;
    });
  }, [cases, searchQuery, filterStatus, filterCenter, filterTherapy, showExcluded, caseStatus, therapyStatuses, excludedCases]);

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

  const handleExclude = (caseId: string) => {
    toggleExcludeCase(caseId);
  };

  const handleMarkReviewed = (caseId: string) => {
    const isReviewed = reviewedCases.includes(caseId);
    if (isReviewed) {
      unmarkCaseReviewed(caseId);
    } else {
      markCaseReviewed(caseId);
    }
  };

  const handleExportCsv = () => {
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
        c.conditions.map((cond) => getDiagnosisLabel(cond.code.coding[0]?.code ?? '', locale)).join('; '),
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

  // Anomalies including missing data (N03.05, EMDREQ-QUAL-004)
  const anomalies = useMemo(() => {
    if (!selectedCase) return [];
    const results: Array<{ parameter: string; value: string; reason: string }> = [];

    // Missing data detection (N03.05)
    const visObs = getObservationsByCode(selectedCase.observations, LOINC_VISUS);
    const crtObs = getObservationsByCode(selectedCase.observations, LOINC_CRT);
    const injections = selectedCase.procedures.filter((p) =>
      p.code.coding.some((c) => c.code === SNOMED_IVI)
    );

    if (visObs.length === 0) {
      results.push({ parameter: 'Visus', value: '—', reason: t('missingVisus') });
    }
    if (crtObs.length === 0) {
      results.push({ parameter: 'CRT', value: '—', reason: t('missingCrt') });
    }
    if (injections.length === 0) {
      results.push({ parameter: 'IVOM', value: '—', reason: t('missingInjections') });
    }

    // Implausible values
    crtObs.forEach((o) => {
      const v = o.valueQuantity?.value;
      if (v != null && v > 400) {
        results.push({
          parameter: `CRT (${o.effectiveDateTime?.substring(0, 10)})`,
          value: `${v} µm`,
          reason: t('crtAnomaly'),
        });
      }
    });
    visObs.forEach((o) => {
      const v = o.valueQuantity?.value;
      if (v != null && v < 0.1) {
        results.push({
          parameter: `Visus (${o.effectiveDateTime?.substring(0, 10)})`,
          value: `${v}`,
          reason: t('visusAnomaly'),
        });
      }
    });
    for (let i = 1; i < visObs.length; i++) {
      const prev = visObs[i - 1].valueQuantity?.value ?? 0;
      const curr = visObs[i].valueQuantity?.value ?? 0;
      if (Math.abs(curr - prev) > 0.3) {
        results.push({
          parameter: `Visus (${visObs[i].effectiveDateTime?.substring(0, 10)})`,
          value: `${prev} → ${curr}`,
          reason: t('visusJump'),
        });
      }
    }
    return results;
  }, [selectedCase, t]);

  const statusIcon = (s: QualityStatus) => {
    switch (s) {
      case 'reviewed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-amber-500" />;
      default:
        return <Circle className="w-4 h-4 text-gray-300" />;
    }
  };

  const therapyBadge = (caseId: string) => {
    const ts = therapyStatuses.get(caseId);
    if (!ts || ts.status === 'active') return null;
    return (
      <span
        className={`text-[9px] px-1 py-0.5 rounded ${
          ts.status === 'breaker' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
        }`}
        title={`${ts.gapDays} ${t('therapyGapDays')}`}
      >
        {ts.status === 'breaker' ? 'AB' : 'UB'}
      </span>
    );
  };

  const errorTypes = [
    { value: 'Unplausibel', label: t('errorImplausible') },
    { value: 'Fehlend', label: t('errorMissing') },
    { value: 'Duplikat', label: t('errorDuplicate') },
    { value: 'Formatfehler', label: t('errorFormat') },
    { value: 'Sonstiger Fehler', label: t('errorOther') },
  ];

  const selectedTherapy = selectedCase ? therapyStatuses.get(selectedCase.id) : undefined;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {t('qualityTitle')}
        </h1>
        <p className="text-gray-500 mt-1">
          {t('qualitySubtitle')}
        </p>
      </div>

      {/* Export button */}
      <div className="flex justify-end mb-2">
        <button
          onClick={handleExportCsv}
          disabled={filteredCases.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {t('exportCsv')}
        </button>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <Circle className="w-5 h-5 text-gray-300" />
          <div>
            <p className="text-xl font-bold">{statusCounts.unchecked}</p>
            <p className="text-sm text-gray-500">{t('unchecked')}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-500" />
          <div>
            <p className="text-xl font-bold">{statusCounts.in_progress}</p>
            <p className="text-sm text-gray-500">{t('inProgress')}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <div>
            <p className="text-xl font-bold">{statusCounts.reviewed}</p>
            <p className="text-sm text-gray-500">{t('reviewed')}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <Ban className="w-5 h-5 text-red-400" />
          <div>
            <p className="text-xl font-bold">{excludedCases.length}</p>
            <p className="text-sm text-gray-500">{t('excludedCasesCount')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Case list */}
        <div className="col-span-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Search bar */}
            <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder={t('qualitySearchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-1.5 rounded-lg border text-sm transition-colors ${
                    showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-200 text-gray-500 hover:bg-gray-100'
                  }`}
                  title={t('filterCriteria')}
                >
                  <Filter className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Filter dropdowns */}
            {showFilters && (
              <div className="px-3 py-2 border-b border-gray-200 bg-gray-50/50 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {/* Status filter */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 uppercase mb-0.5">{t('qualityFilterStatus')}</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as QualityStatus | 'all')}
                      className="w-full text-xs border border-gray-200 rounded px-2 py-1"
                    >
                      <option value="all">{t('qualityFilterAll')}</option>
                      <option value="unchecked">{t('unchecked')}</option>
                      <option value="in_progress">{t('inProgress')}</option>
                      <option value="reviewed">{t('reviewed')}</option>
                    </select>
                  </div>
                  {/* Center filter */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 uppercase mb-0.5">{t('qualityFilterCenter')}</label>
                    <select
                      value={filterCenter}
                      onChange={(e) => setFilterCenter(e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded px-2 py-1"
                    >
                      <option value="all">{t('qualityFilterAll')}</option>
                      {centerNames.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                  {/* Therapy status filter */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 uppercase mb-0.5">{t('qualityFilterTherapy')}</label>
                    <select
                      value={filterTherapy}
                      onChange={(e) => setFilterTherapy(e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded px-2 py-1"
                    >
                      <option value="all">{t('qualityFilterAll')}</option>
                      <option value="active">{t('therapyActive')}</option>
                      <option value="interrupter">{t('therapyInterrupter')}</option>
                      <option value="breaker">{t('therapyBreaker')}</option>
                    </select>
                  </div>
                  {/* Show excluded toggle */}
                  <div className="flex items-end pb-0.5">
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showExcluded}
                        onChange={(e) => setShowExcluded(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      {t('qualityShowExcluded')}
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Case count */}
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-xs text-gray-500">
                {filteredCases.length === cases.length
                  ? `${cases.length} ${t('cases')}`
                  : `${filteredCases.length} ${t('qualityFilteredCount')} / ${cases.length} ${t('cases')}`}
              </p>
            </div>

            <div className="max-h-[55vh] overflow-y-auto divide-y divide-gray-100">
              {filteredCases.map((c) => {
                const status = caseStatus.get(c.id) ?? 'unchecked';
                const isExcluded = excludedCases.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCase(c)}
                    className={`w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-blue-50 transition-colors ${
                      selectedCase?.id === c.id ? 'bg-blue-50' : ''
                    } ${isExcluded ? 'opacity-50' : ''}`}
                  >
                    {statusIcon(status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-mono font-medium truncate">
                          {c.pseudonym}
                        </p>
                        {therapyBadge(c.id)}
                        {isExcluded && (
                          <Ban className="w-3 h-3 text-red-400 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        {c.centerName}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Detail panel */}
        <div className="col-span-8">
          {!selectedCase ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              {t('selectCaseToReview')}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Case info */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900">
                      {selectedCase.pseudonym}
                    </h3>
                    {excludedCases.includes(selectedCase.id) && (
                      <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-xs font-medium flex items-center gap-1">
                        <Ban className="w-3 h-3" /> {t('excludedCase')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleMarkReviewed(selectedCase.id)}
                      className={`px-3 py-1.5 text-xs rounded-lg border flex items-center gap-1.5 ${
                        reviewedCases.includes(selectedCase.id)
                          ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                          : 'border-green-200 text-green-700 hover:bg-green-50'
                      }`}
                    >
                      {reviewedCases.includes(selectedCase.id) ? (
                        <><Circle className="w-3.5 h-3.5" /> {t('unmarkReviewed')}</>
                      ) : (
                        <><CheckCircle2 className="w-3.5 h-3.5" /> {t('markAsReviewed')}</>
                      )}
                    </button>
                    <button
                      onClick={() => handleExclude(selectedCase.id)}
                      className={`px-3 py-1.5 text-xs rounded-lg border flex items-center gap-1.5 ${
                        excludedCases.includes(selectedCase.id)
                          ? 'border-green-200 text-green-700 hover:bg-green-50'
                          : 'border-red-200 text-red-700 hover:bg-red-50'
                      }`}
                    >
                      {excludedCases.includes(selectedCase.id) ? (
                        <><CheckCheck className="w-3.5 h-3.5" /> {t('includeInAnalysis')}</>
                      ) : (
                        <><Ban className="w-3.5 h-3.5" /> {t('excludeFromAnalysis')}</>
                      )}
                    </button>
                    <button
                      onClick={() => navigate(`/case/${selectedCase.id}`)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {t('fullCaseView')}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">{t('age')}</p>
                    <p className="font-medium">
                      {getAge(selectedCase.birthDate)} J.
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">{t('diagnosis')}</p>
                    <p className="font-medium">
                      {selectedCase.conditions
                        .map((c) =>
                          getDiagnosisLabel(c.code.coding[0]?.code ?? '', locale)
                        )
                        .join(', ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">{t('totalMeasurements')}</p>
                    <p className="font-medium">
                      {selectedCase.observations.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">{t('center')}</p>
                    <p className="font-medium">{selectedCase.centerName}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">{t('therapyDiscontinuation')}</p>
                    <p className="font-medium">
                      {selectedTherapy?.status === 'breaker' ? (
                        <span className="text-red-600">{t('therapyBreaker')} ({selectedTherapy.gapDays}d)</span>
                      ) : selectedTherapy?.status === 'interrupter' ? (
                        <span className="text-amber-600">{t('therapyInterrupter')} ({selectedTherapy.gapDays}d)</span>
                      ) : (
                        <span className="text-green-600">{t('therapyActive')}</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Anomalies + missing data */}
              {anomalies.length > 0 && (
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
                  <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {t('anomalousValues')} / {t('missingData')} ({anomalies.length})
                  </h3>
                  <div className="space-y-2">
                    {anomalies.map((a, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 bg-white rounded-lg text-sm"
                      >
                        <div>
                          <span className="font-medium">{a.parameter}</span>
                          <span className="text-gray-500 ml-2">{a.value}</span>
                          <span className="text-amber-600 ml-2 text-xs">
                            ({a.reason})
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            setFlagDialog({
                              parameter: a.parameter,
                              value: a.value,
                            })
                          }
                          className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 flex items-center gap-1"
                        >
                          <Flag className="w-3 h-3" /> {t('reportError')}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Observations table for review */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-3">
                  {t('valuesToReview')}
                </h3>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                        {t('parameter')}
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                        {t('date')}
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">
                        {t('value')}
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">
                        {t('action')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedCase.observations.map((obs) => {
                      const flag = caseFlags.find(
                        (f) =>
                          f.parameter ===
                          `${obs.code.coding[0]?.display} (${obs.effectiveDateTime?.substring(0, 10)})`
                      );
                      return (
                        <tr key={obs.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            {obs.code.coding[0]?.display}
                          </td>
                          <td className="px-3 py-2 text-gray-500">
                            {obs.effectiveDateTime?.substring(0, 10)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {obs.valueQuantity?.value}{' '}
                            {obs.valueQuantity?.unit}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {flag ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                                  flag.status === 'open'
                                    ? 'bg-red-50 text-red-600'
                                    : flag.status === 'acknowledged'
                                    ? 'bg-amber-50 text-amber-600'
                                    : 'bg-green-50 text-green-600'
                                }`}
                              >
                                {flag.errorType} — {flag.status}
                              </span>
                            ) : (
                              <button
                                onClick={() =>
                                  setFlagDialog({
                                    parameter: `${obs.code.coding[0]?.display} (${obs.effectiveDateTime?.substring(0, 10)})`,
                                    value: `${obs.valueQuantity?.value}`,
                                  })
                                }
                                className="text-gray-400 hover:text-red-500"
                                title={t('reportError')}
                              >
                                <Flag className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Existing flags */}
              {caseFlags.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    {t('reviewResults')} ({caseFlags.length})
                  </h3>
                  <div className="space-y-2">
                    {caseFlags.map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm"
                      >
                        <div>
                          <p className="font-medium">{f.parameter}</p>
                          <p className="text-xs text-gray-500">
                            {f.errorType} — {t('reportedBy')} {f.flaggedBy},{' '}
                            {new Date(f.flaggedAt).toLocaleDateString(dateFmt)}
                          </p>
                        </div>
                        <select
                          value={f.status}
                          onChange={(e) => {
                            updateQualityFlag(
                              f.caseId,
                              f.parameter,
                              e.target.value as QualityFlag['status']
                            );
                          }}
                          className="text-xs border rounded px-2 py-1"
                        >
                          <option value="open">{t('statusOpen')}</option>
                          <option value="acknowledged">{t('statusAcknowledged')}</option>
                          <option value="resolved">{t('statusResolved')}</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Flag dialog */}
      {flagDialog && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-gray-900 mb-4">
              {t('flagErrorTitle')}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {t('parameter')}: <span className="font-medium">{flagDialog.parameter}</span>
              <br />
              {t('value')}: <span className="font-medium">{flagDialog.value}</span>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('errorType')}
              </label>
              <select
                value={errorType}
                onChange={(e) => setErrorType(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">{t('selectErrorType')}</option>
                {errorTypes.map((et) => (
                  <option key={et.value} value={et.value}>
                    {et.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setFlagDialog(null);
                  setErrorType('');
                }}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleFlag}
                disabled={!errorType}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {t('reportError')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
