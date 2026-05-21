import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { groupByParent } from '../../services/cohortNames';
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

  // Derive the tree grouping at render time — no persisted state (anti-pattern per RESEARCH)
  const { parents, subcohortsByParentId } = groupByParent(savedSearches);
  const parentIds = new Set(parents.map((p) => p.id));

  // Subcohort id set for filtering top-level items
  const subcohortIdSet = new Set<string>();
  for (const [, subs] of subcohortsByParentId) {
    for (const sub of subs) subcohortIdSet.add(sub.id);
  }

  // Expand/collapse state: all parents expanded by default (D-02)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(parents.map((p) => p.id)),
  );

  // When new parent cohorts appear (e.g. after save), auto-expand them
  useEffect(() => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      for (const p of parents) {
        if (!next.has(p.id)) next.add(p.id);
      }
      return next;
    });
  // parents identity changes with every savedSearches change — exhaustive dep would
  // cause infinite loop; savedSearches is the stable dependency here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSearches]);

  /** Renders a single cohort label row (shared between flat, parent, and subcohort renders) */
  function renderLabel(s: SavedSearch, extraClass?: string) {
    const isPrimary = s.id === primaryCohortId;
    const checked = isPrimary || selectedIds.includes(s.id);
    const disabled = isPrimary || (isMaxReached && !selectedIds.includes(s.id));
    const count = patientCounts[s.id] ?? 0;
    const label = isPrimary
      ? `${s.name} (N=${count} patients) · ${t('outcomesComparePrimaryLabel')}`
      : `${s.name} (N=${count} patients)`;
    return (
      <label
        key={s.id}
        className={`flex items-center gap-2 text-sm${extraClass ? ` ${extraClass}` : ''}`}
      >
        <input
          type="checkbox"
          aria-label={label}
          className="accent-blue-600"
          checked={checked}
          disabled={disabled}
          onChange={() => toggle(s.id)}
        />
        <span className={disabled && !isPrimary ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}>
          {label}
        </span>
      </label>
    );
  }

  // Top-level items: parents and flat cohorts (subcohorts are rendered inside parent groups)
  const topLevelItems = savedSearches.filter((s) => !subcohortIdSet.has(s.id));

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
          aria-label={t('outcomesCompareCloseDrawer')}
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

        {topLevelItems.map((s) => {
          const isParent = parentIds.has(s.id);

          if (!isParent) {
            // Flat cohort — render unchanged, identical to pre-Phase-31 behavior (Pitfall 2)
            return renderLabel(s);
          }

          // Parent with subcohorts — render tree group with chevron
          const isExpanded = expandedIds.has(s.id);
          const subcohorts = subcohortsByParentId.get(s.id) ?? [];

          return (
            <div key={s.id}>
              {/* Parent row: chevron button + parent checkbox label */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? t('cohortTreeCollapseGroup') : t('cohortTreeExpandGroup')}
                  onClick={() => {
                    setExpandedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(s.id)) {
                        next.delete(s.id);
                      } else {
                        next.add(s.id);
                      }
                      return next;
                    });
                  }}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronUp className="w-4 h-4" />
                  )}
                </button>
                {renderLabel(s)}
              </div>

              {/* Subcohort rows — pl-6 indented, space-y-1 within the group (UI-SPEC) */}
              {isExpanded && (
                <div className="space-y-1 mt-1">
                  {subcohorts.map((sub) => renderLabel(sub, 'pl-6'))}
                </div>
              )}
            </div>
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
