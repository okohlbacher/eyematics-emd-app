/**
 * QualityParamsChecklist (C2) — the per-cohort quality-check selection UI.
 *
 * Extracted from CohortBuilderPage so the same control can be reused on the
 * Datenqualität tab (QualityPage), where the checklist now lives. Pure
 * presentational component: it renders one checkbox per QUALITY_PARAM_KEYS and
 * reports the new selection via onChange. The parent owns persistence
 * (DataContext.updateSavedSearchQualityParams) and the tri-state canonicalization.
 *
 * `selected` is the resolved key set currently checked (a string[] of canonical
 * keys). For the "all checks" / undefined back-compat case, callers pass the
 * resolved full key set (resolveQualityParams).
 */
import { QUALITY_PARAM_KEYS } from '../../../shared/qualityParams';
import { useLanguage } from '../../context/LanguageContext';

interface QualityParamsChecklistProps {
  /** Canonical keys currently checked. */
  selected: readonly string[];
  /** Called with the full next selection (array of canonical keys) on every toggle. */
  onChange: (next: string[]) => void;
  /** Disable all checkboxes (e.g. while no cohort is selected). */
  disabled?: boolean;
}

export function QualityParamsChecklist({ selected, onChange, disabled = false }: QualityParamsChecklistProps) {
  const { t } = useLanguage();
  const selectedSet = new Set(selected);

  return (
    <div className="flex flex-col gap-1">
      {QUALITY_PARAM_KEYS.map((key) => {
        const labelKey = key as Parameters<typeof t>[0];
        const checked = selectedSet.has(key);
        return (
          <label
            key={key}
            className={`flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 ${
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={(e) => {
                const next = new Set(selectedSet);
                if (e.target.checked) {
                  next.add(key);
                } else {
                  next.delete(key);
                }
                // Emit in canonical QUALITY_PARAM_KEYS order for stable round-tripping.
                onChange(QUALITY_PARAM_KEYS.filter((k) => next.has(k)));
              }}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            {t(labelKey)}
          </label>
        );
      })}
    </div>
  );
}
