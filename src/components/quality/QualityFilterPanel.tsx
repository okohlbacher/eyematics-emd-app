/**
 * Z0-P16: all filters of the Datenqualität case list in one labelled region "Filterkriterien".
 * Always visible: Zeitraum, pseudonym search and the collapse toggle (title "Filterkriterien", C13).
 * Collapsible (Q14 b): Prüfstatus, Zentrum, Therapiestatus, CRT-Wert, "Ausgeschlossene anzeigen" (Q14 a).
 */
import { Filter, Search } from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import type { QualityStatus } from '../../types/fhir';
import type { TimeRange } from '../../utils/qualityMetrics';
import { CenterMultiSelect } from '../common/CenterMultiSelect';
import { QualityFilterBar } from '../doc-quality/QualityFilterBar';

export interface QualityFilterPanelProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  searchQuery: string;
  filterStatus: QualityStatus | 'all';
  selectedCenters: string[];
  filterTherapy: string;
  filterCrt: 'implausible' | 'all';
  showExcluded: boolean;
  showFilters: boolean;
  centerNames: string[];
  onSearchChange: (q: string) => void;
  onFilterStatusChange: (s: QualityStatus | 'all') => void;
  onSelectedCentersChange: (centers: string[]) => void;
  onFilterTherapyChange: (t: string) => void;
  onFilterCrtChange: (v: 'implausible' | 'all') => void;
  onShowExcludedChange: (v: boolean) => void;
  onToggleFilters: () => void;
}

export default function QualityFilterPanel({
  timeRange,
  onTimeRangeChange,
  searchQuery,
  filterStatus,
  selectedCenters,
  filterTherapy,
  filterCrt,
  showExcluded,
  showFilters,
  centerNames,
  onSearchChange,
  onFilterStatusChange,
  onSelectedCentersChange,
  onFilterTherapyChange,
  onFilterCrtChange,
  onShowExcludedChange,
  onToggleFilters,
}: QualityFilterPanelProps) {
  const { t } = useLanguage();

  return (
    <section
      role="region"
      aria-label={t('filterCriteria')}
      className="flex-1 min-w-[24rem] bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-3"
    >
      <div className="flex flex-wrap items-center gap-3">
        {/* Time-range filter — QUAL-022: reuses the DocQualityPage / QualityFilterBar pattern */}
        <QualityFilterBar
          timeRange={timeRange}
          onTimeRangeChange={onTimeRangeChange}
          selectedCenter=""
          onCenterChange={() => undefined}
          centerOptions={[]}
          showCenterFilter={false}
          embedded
        />
        <div className="flex items-center gap-2 flex-1 min-w-[14rem]">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder={t('qualitySearchPlaceholder')}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            />
          </div>
          <button
            onClick={onToggleFilters}
            aria-expanded={showFilters}
            className={`p-1.5 rounded-lg border text-sm transition-colors ${
              showFilters
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 text-blue-600'
                : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600/50'
            }`}
            title={t('filterCriteria')}
          >
            <Filter className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Collapsible filter criteria */}
      {showFilters && (
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 lg:grid-cols-5 gap-2">
          <div>
            <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase mb-0.5">
              {t('qualityFilterStatus')}
            </label>
            <select
              value={filterStatus}
              onChange={(e) => onFilterStatusChange(e.target.value as QualityStatus | 'all')}
              className="w-full text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1 dark:bg-gray-700 dark:text-white"
            >
              <option value="all">{t('qualityFilterAll')}</option>
              <option value="unchecked">{t('unchecked')}</option>
              <option value="in_progress">{t('inProgress')}</option>
              <option value="reviewed">{t('reviewed')}</option>
            </select>
          </div>
          <div>
            <CenterMultiSelect
              options={centerNames}
              selected={selectedCenters}
              onChange={onSelectedCentersChange}
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase mb-0.5">
              {t('qualityFilterTherapy')}
            </label>
            <select
              value={filterTherapy}
              onChange={(e) => onFilterTherapyChange(e.target.value)}
              className="w-full text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1 dark:bg-gray-700 dark:text-white"
            >
              <option value="all">{t('qualityFilterAll')}</option>
              <option value="active">{t('therapyActive')}</option>
              <option value="interrupter">{t('therapyInterrupter')}</option>
              <option value="breaker">{t('therapyBreaker')}</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase mb-0.5">
              {t('qualityFilterCrt')}
            </label>
            <select
              value={filterCrt}
              onChange={(e) => onFilterCrtChange(e.target.value as 'implausible' | 'all')}
              className="w-full text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1 dark:bg-gray-700 dark:text-white"
            >
              <option value="all">{t('qualityFilterAll')}</option>
              <option value="implausible">{t('qualityFilterCrtImplausible')}</option>
            </select>
          </div>
          <div className="flex items-end pb-0.5">
            <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
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
      )}
    </section>
  );
}
