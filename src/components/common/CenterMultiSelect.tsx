/**
 * CenterMultiSelect — shared multi-select center filter component.
 *
 * QUAL-024 (D3): built once in common/, reused by QualityPage and AnalysisPage (Phase 42).
 *
 * Security: this component is CLIENT-SIDE NARROWING only.
 * It never sends a center list to the server. The server always filters by
 * req.auth.centers via filterBundlesByCenters — the sole authority over which
 * centers are returned. Selecting centers the user is not authorized for cannot
 * widen server results.
 *
 * Props:
 *   options   — display names to render as toggles (strings, generic — works for quality and analysis)
 *   selected  — currently-selected names; empty array = no filter (show all)
 *   onChange  — called with the next selected array
 *   label     — optional heading; defaults to t('qualityFilterCenter')
 */

import { useLanguage } from '../../context/LanguageContext';

export interface CenterMultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  label?: string;
}

export function CenterMultiSelect({
  options,
  selected,
  onChange,
  label,
}: CenterMultiSelectProps): JSX.Element {
  const { t } = useLanguage();

  const heading = label ?? t('qualityFilterCenter');

  function toggle(name: string) {
    if (selected.includes(name)) {
      onChange(selected.filter((n) => n !== name));
    } else {
      onChange([...selected, name]);
    }
  }

  function clear() {
    onChange([]);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">
          {heading}
          {selected.length > 0 && (
            <span className="ml-1 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded-full">
              {selected.length}
            </span>
          )}
        </label>
        {selected.length === 0 ? (
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {t('qualityFilterCentersAll')}
          </span>
        ) : (
          <button
            type="button"
            onClick={clear}
            className="text-[10px] text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {t('qualityFilterCentersClear')}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1 mt-1">
        {options.map((name) => {
          const isSelected = selected.includes(name);
          return (
            <button
              key={name}
              type="button"
              onClick={() => toggle(name)}
              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                isSelected
                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 font-medium'
                  : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600/50'
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
