import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { SavedSearch } from '../../types/fhir';

export interface CohortCompareDrawerProps {
  open: boolean;
  onClose: () => void;
  savedSearches: SavedSearch[];
  patientCounts: Record<string, number>;
  primaryCohortId: string | null;
  selectedIds: string[];
  onChange: (next: string[]) => void;
  onReset: () => void;
  t: (key: string) => string;
}

export default function CohortCompareDrawer({
  open,
  onClose,
  savedSearches,
  patientCounts,
  primaryCohortId,
  selectedIds,
  onChange,
  onReset,
  t,
}: CohortCompareDrawerProps) {
  // Escape-to-close, identical to OutcomesSettingsDrawer
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const isMaxReached = selectedIds.length >= 4;

  const toggle = (id: string) => {
    if (id === primaryCohortId) return; // primary is locked
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : isMaxReached
        ? selectedIds
        : [...selectedIds, id];
    onChange(next);
  };

  return (
    <aside
      id="outcomes-compare-drawer"
      aria-label={t('outcomesCompareDrawerTitle')}
      className={`fixed right-0 top-0 h-screen w-full sm:w-96 bg-white border-l border-gray-200 shadow-lg z-40 transition-transform duration-200 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
    >
      <div className="flex items-center justify-between p-6 pb-4">
        <h2 className="text-base font-semibold text-gray-900">
          {t('outcomesCompareDrawerTitle')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('outcomesCompareDrawerTitle')}
          className="p-1 rounded hover:bg-gray-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div
        className="p-6 pt-0 space-y-4 overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 120px)' }}
      >
        <p className="text-sm text-gray-500">{t('outcomesCompareDrawerHint')}</p>

        {savedSearches.map((s) => {
          const isPrimary = s.id === primaryCohortId;
          const checked = isPrimary || selectedIds.includes(s.id);
          const disabled =
            isPrimary ||
            (isMaxReached && !selectedIds.includes(s.id));
          const count = patientCounts[s.id] ?? 0;
          const label = isPrimary
            ? `${s.name} (N=${count} patients) · ${t('outcomesComparePrimaryLabel')}`
            : `${s.name} (N=${count} patients)`;
          return (
            <label
              key={s.id}
              className="flex items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                aria-label={label}
                className="accent-blue-600"
                checked={checked}
                disabled={disabled}
                onChange={() => toggle(s.id)}
              />
              <span className={disabled && !isPrimary ? 'text-gray-400' : 'text-gray-800'}>
                {label}
              </span>
            </label>
          );
        })}
      </div>

      <div className="border-t border-gray-100 p-6 pt-4">
        <button
          type="button"
          onClick={onReset}
          className="text-sm text-gray-600 hover:text-gray-900 underline"
        >
          {t('outcomesCompareReset')}
        </button>
      </div>
    </aside>
  );
}
