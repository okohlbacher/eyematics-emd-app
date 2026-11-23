import {
  Ban,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
} from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import type { PatientCase, QualityStatus } from '../../types/fhir';

export interface TherapyStatusEntry {
  status: 'active' | 'interrupter' | 'breaker';
  gapDays: number;
}

export interface QualityCaseListProps {
  cases: PatientCase[];
  filteredCases: PatientCase[];
  selectedCase: PatientCase | null;
  caseStatus: Map<string, QualityStatus>;
  therapyStatuses: Map<string, TherapyStatusEntry>;
  excludedCases: string[];
  onSelectCase: (c: PatientCase) => void;
}

function statusIcon(s: QualityStatus) {
  switch (s) {
    case 'reviewed':
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'in_progress':
      return <Clock className="w-4 h-4 text-amber-500" />;
    default:
      return <Circle className="w-4 h-4 text-gray-300" />;
  }
}

export default function QualityCaseList({
  cases,
  filteredCases,
  selectedCase,
  caseStatus,
  therapyStatuses,
  excludedCases,
  onSelectCase,
}: QualityCaseListProps) {
  const { t } = useLanguage();

  const therapyBadge = (caseId: string) => {
    const ts = therapyStatuses.get(caseId);
    if (!ts || ts.status === 'active') return null;
    // Z0-P25: own colour family (slate = AB, sky = UB), distinct from the amber
    // "auffällig" and red "Kritisch" value statuses; the term is named in title/aria-label.
    const term = t(ts.status === 'breaker' ? 'therapyBreaker' : 'therapyInterrupter');
    return (
      <span
        className={`text-[9px] px-1 py-0.5 rounded ${
          ts.status === 'breaker'
            ? 'bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-slate-100'
            : 'bg-sky-200 text-sky-900 dark:bg-sky-900/60 dark:text-sky-200'
        }`}
        title={`${term} – ${ts.gapDays} ${t('therapyGapDays')}`}
        aria-label={term}
      >
        {ts.status === 'breaker' ? 'AB' : 'UB'}
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Case count */}
      <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {filteredCases.length === cases.length
            ? `${cases.length} ${t('cases')}`
            : `${filteredCases.length} ${t('qualityFilteredCount')} / ${cases.length} ${t('cases')}`}
        </p>
      </div>

      <div className="max-h-[55vh] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
        {filteredCases.map((c) => {
          const status = caseStatus.get(c.id) ?? 'unchecked';
          const isExcluded = excludedCases.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => onSelectCase(c)}
              className={`w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${
                selectedCase?.id === c.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              } ${isExcluded ? 'opacity-50' : ''}`}
            >
              {statusIcon(status)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-mono font-medium truncate">{c.pseudonym}</p>
                  {therapyBadge(c.id)}
                  {isExcluded && <Ban className="w-3 h-3 text-red-400 flex-shrink-0" />}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500">{c.centerName}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
