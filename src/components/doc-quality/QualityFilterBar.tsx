import { useLanguage } from '../../context/LanguageContext';
import {
  type CustomTimeRange,
  isCustomTimeRange,
  type TimeRange,
  type TimeRangePreset,
} from '../../utils/qualityMetrics';

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
  showCenterFilter?: boolean;
}

/** Today as a yyyy-mm-dd string for the date inputs (local calendar). */
function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function QualityFilterBar({
  timeRange,
  onTimeRangeChange,
  selectedCenter,
  onCenterChange,
  centerOptions,
  showCenterFilter = true,
}: QualityFilterBarProps) {
  const { t } = useLanguage();

  const presetOptions: { value: TimeRangePreset; label: string }[] = [
    { value: '3m', label: t('docQualityLast3Months') },
    { value: '6m', label: t('docQualityLast6Months') },
    { value: '1y', label: t('docQualityLastYear') },
    { value: 'all', label: t('docQualityAllTime') },
  ];

  const custom = isCustomTimeRange(timeRange) ? timeRange : null;
  const isCustomActive = custom !== null;

  // Switching to custom seeds a sensible default window (last 30 days → today)
  // so the picker is never half-empty (which would disable windowing).
  const activateCustom = () => {
    if (isCustomActive) return;
    const to = todayIso();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);
    const mm = String(fromDate.getMonth() + 1).padStart(2, '0');
    const dd = String(fromDate.getDate()).padStart(2, '0');
    const from = `${fromDate.getFullYear()}-${mm}-${dd}`;
    onTimeRangeChange({ from, to });
  };

  const updateCustom = (patch: Partial<CustomTimeRange>) => {
    const base: CustomTimeRange = custom ?? { from: '', to: todayIso() };
    onTimeRangeChange({ ...base, ...patch });
  };

  const presetActive = (value: TimeRangePreset) =>
    !isCustomActive && timeRange === value;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-4 items-center">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">
          {t('docQualityTimeRange')}:
        </span>
        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
          {presetOptions.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onTimeRangeChange(value)}
              className={`px-3 py-1.5 transition-colors ${
                presetActive(value)
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
          <button
            onClick={activateCustom}
            className={`px-3 py-1.5 transition-colors ${
              isCustomActive
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t('docQualityCustomRange')}
          </button>
        </div>
      </div>

      {/* Custom from/to date picker — only visible when the custom range is active */}
      {isCustomActive && (
        <div className="flex items-center gap-2 text-sm">
          <label className="text-gray-700">{t('docQualityFrom')}:</label>
          <input
            type="date"
            value={custom?.from ?? ''}
            max={custom?.to || todayIso()}
            onChange={(e) => updateCustom({ from: e.target.value })}
            className="border border-gray-300 rounded-lg px-2 py-1 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <label className="text-gray-700">{t('docQualityTo')}:</label>
          <input
            type="date"
            value={custom?.to ?? ''}
            min={custom?.from || undefined}
            max={todayIso()}
            onChange={(e) => updateCustom({ to: e.target.value })}
            className="border border-gray-300 rounded-lg px-2 py-1 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {(showCenterFilter) && (
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
      )}
    </div>
  );
}
