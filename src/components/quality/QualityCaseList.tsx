import {
  Ban,
  ChevronRight,
  Circle,
  CheckCircle2,
  Clock,
  Filter,
  Search,
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
  searchQuery: string;
  filterStatus: QualityStatus | 'all';
  filterCenter: string;
  filterTherapy: string;
  showExcluded: boolean;
  showFilters: boolean;
  centerNames: string[];
  onSelectCase: (c: PatientCase) => void;
  onSearchChange: (q: string) => void;
  onFilterStatusChange: (s: QualityStatus | 'all') => void;
  onFilterCenterChange: (c: string) => void;
  onFilterTherapyChange: (t: string) => void;
  onShowExcludedChange: (v: boolean) => void;
  onToggleFilters: () => void;
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
  searchQuery,
  filterStatus,
  filterCenter,
  filterTherapy,
  showExcluded,
  showFilters,
  centerNames,
  onSelectCase,
  onSearchChange,
  onFilterStatusChange,
  onFilterCenterChange,
  onFilterTherapyChange,
  onShowExcludedChange,
  onToggleFilters,
}: QualityCaseListProps) {
  const { t } = useLanguage();

  const therapyBadge = (caseId: string) => {
    const ts = therapyStatuses.get(caseId);
    if (!ts || ts.status === 'active') return null;
    return (
      <span
        className={`text-[9px] px-1 py-0.5 rounded ${
          ts.status === 'breaker'
            ? 'bg-red-100 text-red-700'
            : 'bg-amber-100 text-amber-700'
        }`}
        title={`${ts.gapDays} ${t('therapyGapDays')}`}
      >
        {ts.status === 'breaker' ? 'AB' : 'UB'}
      </span>
    );
  };

  return (
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
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <button
            onClick={onToggleFilters}
            className={`p-1.5 rounded-lg border text-sm transition-colors ${
              showFilters
                ? 'bg-blue-50 border-blue-200 text-blue-600'
                : 'border-gray-200 text-gray-500 hover:bg-gray-100'
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
            <div>
              <label className="block text-[10px] font-medium text-gray-500 uppercase mb-0.5">
                {t('qualityFilterStatus')}
              </label>
              <select
                value={filterStatus}
                onChange={(e) => onFilterStatusChange(e.target.value as QualityStatus | 'all')}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1"
              >
                <option value="all">{t('qualityFilterAll')}</option>
                <option value="unchecked">{t('unchecked')}</option>
                <option value="in_progress">{t('inProgress')}</option>
                <option value="reviewed">{t('reviewed')}</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 uppercase mb-0.5">
                {t('qualityFilterCenter')}
              </label>
              <select
                value={filterCenter}
                onChange={(e) => onFilterCenterChange(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1"
              >
                <option value="all">{t('qualityFilterAll')}</option>
                {centerNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 uppercase mb-0.5">
                {t('qualityFilterTherapy')}
              </label>
              <select
                value={filterTherapy}
                onChange={(e) => onFilterTherapyChange(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1"
              >
                <option value="all">{t('qualityFilterAll')}</option>
                <option value="active">{t('therapyActive')}</option>
                <option value="interrupter">{t('therapyInterrupter')}</option>
                <option value="breaker">{t('therapyBreaker')}</option>
              </select>
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showExcluded}
                  onChange={(e) => onShowExcludedChange(e.target.checked)}
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
              onClick={() => onSelectCase(c)}
              className={`w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-blue-50 transition-colors ${
                selectedCase?.id === c.id ? 'bg-blue-50' : ''
              } ${isExcluded ? 'opacity-50' : ''}`}
            >
              {statusIcon(status)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-mono font-medium truncate">{c.pseudonym}</p>
                  {therapyBadge(c.id)}
                  {isExcluded && <Ban className="w-3 h-3 text-red-400 flex-shrink-0" />}
                </div>
                <p className="text-xs text-gray-400">{c.centerName}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
