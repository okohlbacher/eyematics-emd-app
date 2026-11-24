import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useThemeSafe } from '../../context/ThemeContext';
import { ALL_PATIENTS_COHORT_ID } from '../../services/allPatientsCohort';
import { groupByParent } from '../../services/cohortNames';
import { FILTERED_COHORT_ID } from '../../services/filteredCompareCohort';
import type { SavedSearch } from '../../types/fhir';
import { cohortColor } from '../charts/chartStyle';

export interface CohortCompareDrawerProps {
  open: boolean;
  onClose: () => void;
  savedSearches: SavedSearch[];
  patientCounts: Record<string, number>;
  primaryCohortId: string | null;
  selectedIds: string[];
  onChange: (next: string[]) => void;
  /** Without it the reset button is not shown (case view). */
  onReset?: () => void;
  t: (key: string) => string;
  /** Z0-P23: panel title and accessible name (default "Kohorten vergleichen"). */
  title?: string;
  /** Z0-P23 (Q22): 1 = exactly one comparison cohort (radio group, case view); default 4 (checkboxes). */
  maxSelections?: number;
  /** Swatch colour of a selected option by its comparison order; default: the cohort palette of the charts. */
  swatchColor?: (order: number) => string;
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
  title,
  maxSelections = 4,
  swatchColor,
}: CohortCompareDrawerProps) {
  const { effectiveTheme } = useThemeSafe();
  const isDark = effectiveTheme === 'dark';
  const single = maxSelections === 1;
  const drawerTitle = title ?? t('outcomesCompareDrawerTitle');
  // Escape-to-close, identical to OutcomesSettingsDrawer
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Z0-P05: onChange updates the URL inside a router transition; leaving compare mode re-renders the single-cohort
  // chart synchronously, so the controlled checkbox kept its old state until that commit. Show the clicked selection
  // at once; the prop takes over as soon as it changes (keyed by its contents, not its identity). The drawer stays
  // mounted, so the pending selection is dropped on every prop change (reset during render) and never reused later.
  const selectedKey = selectedIds.join(',');
  const [pending, setPending] = useState<string[] | null>(null);
  const [pendingKey, setPendingKey] = useState(selectedKey);
  if (selectedKey !== pendingKey) {
    setPendingKey(selectedKey);
    setPending(null);
  }
  const selected = pending ?? selectedIds;

  const isMaxReached = !single && selected.length >= maxSelections;

  const toggle = (id: string) => {
    if (id === primaryCohortId) return; // primary is locked
    if (single) {
      setPending([id]);
      onChange([id]);
      return;
    }
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : isMaxReached
        ? selected
        : [...selected, id];
    setPending(next);
    onChange(next);
  };

  // Derive the tree grouping at render time — no persisted state (anti-pattern per RESEARCH)
  const { parents, subcohortsByParentId } = groupByParent(savedSearches);
  // Z0-P23: the same order in every view — "Alle Patienten" first, then the unsaved filtered cohort (Q48 a, as in
  // "Kohorte wählen"), then by name (sub-cohorts by name under their parent).
  const rank = (s: SavedSearch) => (s.id === ALL_PATIENTS_COHORT_ID ? 0 : s.id === FILTERED_COHORT_ID ? 1 : 2);
  const byName = (a: SavedSearch, b: SavedSearch) => rank(a) - rank(b) || a.name.localeCompare(b.name);
  const parentIds = new Set(parents.map((p) => p.id));

  // Subcohort id set for filtering top-level items
  const subcohortIdSet = new Set<string>();
  for (const [, subs] of subcohortsByParentId) {
    for (const sub of subs) subcohortIdSet.add(sub.id);
  }

  // Collapse state: track only explicitly-collapsed parents. Empty set = all expanded
  // by default (D-02), and parents added later (e.g. after a save) are expanded
  // automatically because they aren't in the collapsed set — no effect needed.
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());

  /** Renders a single cohort label row (shared between flat, parent, and subcohort renders) */
  function renderLabel(s: SavedSearch, extraClass?: string) {
    const isPrimary = s.id === primaryCohortId;
    const checked = isPrimary || selected.includes(s.id);
    const disabled = isPrimary || (isMaxReached && !selected.includes(s.id));
    const count = patientCounts[s.id] ?? 0;
    const name = `${s.name} (N=${count} ${t('outcomesComparePatientsUnit')})`;
    const label = isPrimary ? `${name} · ${t('outcomesComparePrimaryLabel')}` : name;
    // Z0-P23: colour swatch = the cohort's colour in the charts (comparison order); empty while not selected.
    const order = selected.indexOf(s.id);
    const swatch = checked && order >= 0 ? (swatchColor ? swatchColor(order) : cohortColor(order, isDark)) : null;
    return (
      <label
        key={s.id}
        className={`flex items-center gap-2 text-sm${extraClass ? ` ${extraClass}` : ''}`}
      >
        <input
          type={single ? 'radio' : 'checkbox'}
          name={single ? 'compare-cohort' : undefined}
          aria-label={label}
          className="accent-blue-600"
          checked={checked}
          disabled={disabled}
          onChange={() => toggle(s.id)}
        />
        <span
          aria-hidden="true"
          data-compare-swatch
          className="w-3 h-3 shrink-0 rounded-sm border border-gray-300 dark:border-gray-600"
          style={swatch ? { backgroundColor: swatch, borderColor: swatch } : undefined}
        />
        <span className={disabled && !isPrimary ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}>
          <span data-compare-option-label>{name}</span>
          {isPrimary && (
            <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">· {t('outcomesComparePrimaryLabel')}</span>
          )}
        </span>
      </label>
    );
  }

  // Top-level items: parents and flat cohorts (subcohorts are rendered inside parent groups)
  const topLevelItems = savedSearches.filter((s) => !subcohortIdSet.has(s.id)).sort(byName);

  return (
    <aside
      id="outcomes-compare-drawer"
      aria-label={drawerTitle}
      className={`fixed right-0 top-0 h-screen w-full sm:w-96 bg-white border-l border-gray-200 shadow-lg z-40 transition-transform duration-200 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
    >
      <div className="flex items-center justify-between p-6 pb-4">
        <h2 className="text-base font-semibold text-gray-900">
          {drawerTitle}
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
        <p data-testid="compare-hint" className="text-sm text-gray-500">
          {single ? t('overlayCohortCompareHint') : t('outcomesCompareDrawerHint')}
        </p>

        {topLevelItems.map((s) => {
          const isParent = parentIds.has(s.id);

          if (!isParent) {
            // Flat cohort — render unchanged, identical to pre-Phase-31 behavior (Pitfall 2)
            return renderLabel(s);
          }

          // Parent with subcohorts — render tree group with chevron
          const isExpanded = !collapsedIds.has(s.id);
          const subcohorts = [...(subcohortsByParentId.get(s.id) ?? [])].sort(byName);

          return (
            <div key={s.id}>
              {/* Parent row: chevron button + parent checkbox label */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? t('cohortTreeCollapseGroup') : t('cohortTreeExpandGroup')}
                  onClick={() => {
                    setCollapsedIds((prev) => {
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

      {onReset && (
        <div className="border-t border-gray-100 p-6 pt-4">
          <button
            type="button"
            onClick={onReset}
            className="text-sm text-gray-600 hover:text-gray-900 underline"
          >
            {t('outcomesCompareReset')}
          </button>
        </div>
      )}
    </aside>
  );
}
