/** Data quality review page — EMDREQ-QUAL-001 to QUAL-010 (SDV, error flagging, exclusions, therapy discontinuation). */
import { Ban, CheckCircle2, Circle, Clock, Download } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import QualityCaseDetail from '../components/quality/QualityCaseDetail';
import QualityCaseList from '../components/quality/QualityCaseList';
import QualityFlagDialog from '../components/quality/QualityFlagDialog';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import {
  getAge,
  getCenterShorthand,
  getDiagnosisLabel,
  SNOMED_IVI,
} from '../services/fhirLoader';
import { getSettings } from '../services/settingsService';
import type { PatientCase, QualityFlag, QualityStatus } from '../types/fhir';
import { getDateLocale } from '../utils/dateFormat';
import { datedFilename, downloadCsv } from '../utils/download';

function SummaryCard({ icon, count, label }: { icon: ReactNode; count: number; label: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      {icon}
      <div>
        <p className="text-xl font-bold">{count}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

// Therapy discontinuation detection (EMDREQ-QUAL-009)
// F-20: thresholds passed as parameters instead of reading global singleton
function getTherapyStatus(
  pc: PatientCase,
  thresholds: { interrupterDays: number; breakerDays: number },
): { status: 'active' | 'interrupter' | 'breaker'; gapDays: number } {
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

  const lastToNow = (Date.now() - injections[injections.length - 1]) / (1000 * 60 * 60 * 24);
  if (lastToNow > maxGap) maxGap = lastToNow;

  if (maxGap > thresholds.breakerDays) return { status: 'breaker', gapDays: Math.round(maxGap) };
  if (maxGap > thresholds.interrupterDays) return { status: 'interrupter', gapDays: Math.round(maxGap) };
  return { status: 'active', gapDays: Math.round(maxGap) };
}

export default function QualityPage() {
  const {
    cases,
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

  const [selectedCase, setSelectedCase] = useState<PatientCase | null>(null);
  const [flagDialog, setFlagDialog] = useState<{ parameter: string; value: string } | null>(null);
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
    const settings = getSettings();
    const thresholds = {
      interrupterDays: settings.therapyInterrupterDays,
      breakerDays: settings.therapyBreakerDays,
    };
    const map = new Map<string, ReturnType<typeof getTherapyStatus>>();
    cases.forEach((c) => map.set(c.id, getTherapyStatus(c, thresholds)));
    return map;
  }, [cases]);

  const centerNames = useMemo(() => {
    const names = new Set(cases.map((c) => c.centerName));
    return Array.from(names).sort();
  }, [cases]);

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      if (searchQuery && !c.pseudonym.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterStatus !== 'all' && (caseStatus.get(c.id) ?? 'unchecked') !== filterStatus) return false;
      if (filterCenter !== 'all' && c.centerName !== filterCenter) return false;
      if (filterTherapy !== 'all' && therapyStatuses.get(c.id)?.status !== filterTherapy) return false;
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
        (c.conditions ?? []).map((cond) => getDiagnosisLabel(cond.code?.coding?.[0]?.code ?? '', locale)).join('; '),
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
        <h1 className="text-2xl font-bold text-gray-900">{t('qualityTitle')}</h1>
        <p className="text-gray-500 mt-1">{t('qualitySubtitle')}</p>
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

      {/* Status summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <SummaryCard icon={<Circle className="w-5 h-5 text-gray-300" />} count={statusCounts.unchecked} label={t('unchecked')} />
        <SummaryCard icon={<Clock className="w-5 h-5 text-amber-500" />} count={statusCounts.in_progress} label={t('inProgress')} />
        <SummaryCard icon={<CheckCircle2 className="w-5 h-5 text-green-500" />} count={statusCounts.reviewed} label={t('reviewed')} />
        <SummaryCard icon={<Ban className="w-5 h-5 text-red-400" />} count={excludedCases.length} label={t('excludedCasesCount')} />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Case list */}
        <div className="col-span-4">
          <QualityCaseList
            cases={cases}
            filteredCases={filteredCases}
            selectedCase={selectedCase}
            caseStatus={caseStatus}
            therapyStatuses={therapyStatuses}
            excludedCases={excludedCases}
            searchQuery={searchQuery}
            filterStatus={filterStatus}
            filterCenter={filterCenter}
            filterTherapy={filterTherapy}
            showExcluded={showExcluded}
            showFilters={showFilters}
            centerNames={centerNames}
            onSelectCase={setSelectedCase}
            onSearchChange={setSearchQuery}
            onFilterStatusChange={setFilterStatus}
            onFilterCenterChange={setFilterCenter}
            onFilterTherapyChange={setFilterTherapy}
            onShowExcludedChange={setShowExcluded}
            onToggleFilters={() => setShowFilters((v) => !v)}
          />
        </div>

        {/* Detail panel */}
        <div className="col-span-8">
          {!selectedCase ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
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
              onMarkReviewed={handleMarkReviewed}
              onExclude={handleExclude}
              onNavigateToCase={(id) => navigate(`/case/${id}`)}
              onOpenFlagDialog={(parameter, value) => setFlagDialog({ parameter, value })}
              onUpdateFlagStatus={(caseId, parameter, status) =>
                updateQualityFlag(caseId, parameter, status as QualityFlag['status'])
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
