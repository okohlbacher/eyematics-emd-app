import { useLanguage } from '../../context/LanguageContext';
import type { TimeRange } from '../../utils/qualityMetrics';

export interface CenterOption {
  id: string;
  label: string;
}

export interface QualityFilterBarProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  selectedCenter: string;
  onCenterChange: (centerId: string) => void;
  centerOptions: CenterOption[];
}

export function QualityFilterBar({
  timeRange,
  onTimeRangeChange,
  selectedCenter,
  onCenterChange,
  centerOptions,
}: QualityFilterBarProps) {
  const { t } = useLanguage();

  const timeRangeOptions: { value: TimeRange; label: string }[] = [
    { value: '6m', label: t('docQualityLast6Months') },
    { value: '1y', label: t('docQualityLastYear') },
    { value: 'all', label: t('docQualityAllTime') },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-4 items-center">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">
          {t('docQualityTimeRange')}:
        </span>
        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
          {timeRangeOptions.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onTimeRangeChange(value)}
              className={`px-3 py-1.5 transition-colors ${
                timeRange === value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">
          {t('center')}:
        </span>
        <select
          value={selectedCenter}
          onChange={(e) => onCenterChange(e.target.value)}
          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">{t('docQualityAllCenters')}</option>
          {centerOptions.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
