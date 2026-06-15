/**
 * CohortSplitDialog — C3 bulk "Kohorte aufteilen" wizard.
 *
 * Takes a parent cohort + a split definition and creates ALL resulting child
 * sub-cohorts in one step, named `Parent:<group>` (existing v1.10 convention),
 * then opens compare mode on them. Lives ALONGSIDE the manual single-subcohort
 * action — it does not replace it.
 *
 * The split math is delegated to the pure engine in shared/cohortSplit.ts; this
 * component is the React shell (parent picker, attribute/mode controls, live
 * preview, confirm → addSavedSearch + navigate to compare).
 *
 * Modal scaffold + focus trap mirror AdvancedFilterDialog.tsx.
 */
import { X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  buildChildName,
  computeSplitGroups,
  type RangeMode,
  type RangeSplitAttribute,
  type SplitAttribute,
  type SplitGroup,
  type SplitSpec,
} from '../../shared/cohortSplit';
import Button from '../components/primitives/Button';
import { useLanguage } from '../context/LanguageContext';
import { isDuplicateName, parseSubcohortName } from '../services/cohortNames';
import { SNOMED_AMD, SNOMED_DR } from '../services/fhirLoader';
import { getSettings } from '../services/settingsService';
import type { CenterInfo, CohortFilter, PatientCase, SavedSearch } from '../types/fhir';

export interface CohortSplitDialogProps {
  open: boolean;
  /** Preselected parent (the cohort whose split button was clicked), or null. */
  parent: SavedSearch | null;
  savedSearches: SavedSearch[];
  activeCases: PatientCase[];
  centers: CenterInfo[];
  addSavedSearch: (
    s: Pick<SavedSearch, 'name' | 'filters'> & { qualityParams?: string[] },
  ) => Promise<SavedSearch>;
  onClose: () => void;
}

// J7 (v1.15-p3): the compare drawer caps the comparison at 4 cohorts (mirrors the
// slice(0, 4) cap in useOutcomesRouteState). If a split produces more sub-cohorts than
// this, we pre-select the first N and log the rest rather than silently dropping them.
const COMPARE_LIMIT = 4;

const CATEGORICAL_ATTRS: SplitAttribute[] = ['gender', 'diagnosis', 'center'];
const RANGE_ATTRS: RangeSplitAttribute[] = ['age', 'visus', 'crt'];

function isRangeAttr(a: SplitAttribute): a is RangeSplitAttribute {
  return (RANGE_ATTRS as string[]).includes(a);
}

export default function CohortSplitDialog({
  open,
  parent,
  savedSearches,
  activeCases,
  centers,
  addSavedSearch,
  onClose,
}: CohortSplitDialogProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDivElement>(null);

  const [parentId, setParentId] = useState<string>(parent?.id ?? savedSearches[0]?.id ?? '');
  const [attribute, setAttribute] = useState<SplitAttribute>('gender');
  const [rangeMode, setRangeMode] = useState<RangeMode>('quantile');
  const [cutPointsText, setCutPointsText] = useState<string>('');
  const [groups, setGroups] = useState<number>(3);

  // No re-seed effect needed: the parent (CohortBuilderPage) conditionally
  // mounts this dialog ({showSplitDialog && <CohortSplitDialog/>}), so it truly
  // remounts on every open and the useState initializers above re-seed parentId
  // from the freshly-passed `parent` prop / loaded savedSearches.

  // Focus trap + Escape (AdvancedFilterDialog pattern).
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, input, select, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
        'button, input, select, [tabindex]:not([tabindex="-1"])',
      );
      firstFocusable?.focus();
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  const selectedParent = useMemo(
    () => savedSearches.find((s) => s.id === parentId) ?? null,
    [savedSearches, parentId],
  );

  const centerLookup = useMemo(
    () => ({ nameOf: (id: string) => centers.find((c) => c.id === id)?.name ?? id }),
    [centers],
  );
  const genderLabeller = useMemo(
    () => ({ labelOf: (g: string) => (g === 'female' ? t('female') : g === 'male' ? t('male') : g) }),
    [t],
  );
  const diagnosisLabeller = useCallback(
    (code: string) => (code === SNOMED_AMD ? t('diagnosisAMD') : code === SNOMED_DR ? t('diagnosisDR') : code),
    [t],
  );

  // Build the SplitSpec from current controls.
  const spec: SplitSpec | null = useMemo(() => {
    if (!isRangeAttr(attribute)) {
      return { kind: 'categorical', attribute };
    }
    if (rangeMode === 'cutpoints') {
      const cutPoints = cutPointsText
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter((s) => s !== '')
        .map((s) => Number(s.replace(',', '.')));
      return { kind: 'range', attribute, mode: 'cutpoints', cutPoints };
    }
    return { kind: 'range', attribute, mode: 'quantile', groups };
  }, [attribute, rangeMode, cutPointsText, groups]);

  // Live preview: { groups } or { error }.
  const preview = useMemo<{ groups: SplitGroup[]; error: string | null }>(() => {
    if (!selectedParent || !spec) return { groups: [], error: null };
    try {
      const result = computeSplitGroups({
        parentCases: activeCases,
        parentFilter: selectedParent.filters,
        spec,
        filterOptions: getSettings(),
        centerLookup,
        genderLabeller,
        diagnosisLabeller,
      });
      return { groups: result, error: null };
    } catch (err: unknown) {
      return { groups: [], error: err instanceof Error ? err.message : String(err) };
    }
  }, [selectedParent, spec, activeCases, centerLookup, genderLabeller, diagnosisLabeller]);

  const nonEmptyGroups = preview.groups.filter((g) => g.count > 0);
  const skippedCount = preview.groups.length - nonEmptyGroups.length;
  const canConfirm = !!selectedParent && nonEmptyGroups.length >= 2 && !preview.error;

  const handleConfirm = async () => {
    if (!selectedParent || !canConfirm) return;
    // Persist children via the SAME path as manual subcohorts (addSavedSearch).
    // Collision check accumulates names created in THIS batch too, so two groups
    // that normalise identically still get distinct suffixes. Children are created
    // in order so the resolved id list keeps the preview/group order.
    const existingNames = savedSearches.map((s) => s.name);
    const createdNames: string[] = [];
    const creations: Promise<SavedSearch>[] = [];
    for (const g of nonEmptyGroups) {
      const name = buildChildName(selectedParent.name, g.label, (candidate) =>
        isDuplicateName(candidate, [...existingNames, ...createdNames]),
      );
      createdNames.push(name);
      const filters: CohortFilter = g.filter;
      creations.push(addSavedSearch({ name, filters, qualityParams: selectedParent.qualityParams }));
    }
    onClose();

    // J7 (v1.15-p3): pre-select the freshly created SUB-cohorts in compare, parent
    // optional/unlocked. addSavedSearch now resolves the server-assigned record, so we
    // await all children to collect their real ids (no name-matching race). On failure,
    // fall back to the previous parent-anchored navigation so the flow still lands on
    // the trajectories tab with the drawer open.
    let createdIds: string[];
    try {
      const created = await Promise.all(creations);
      createdIds = created.map((c) => c.id);
    } catch (err: unknown) {
      console.error('[CohortSplitDialog] Failed to create sub-cohorts; falling back to parent route:', err);
      navigate(`/analysis?tab=trajectories&cohort=${encodeURIComponent(selectedParent.id)}&compare=open`);
      return;
    }

    // Cap at the compare limit: select the first N, LOG (do not silently drop) the rest.
    // The parent is intentionally NOT included and NOT passed as ?cohort= — so no cohort
    // is locked as "primary"; the user can add the parent (and remove any sub-cohort)
    // freely in the drawer.
    const selectedIds = createdIds.slice(0, COMPARE_LIMIT);
    if (createdIds.length > COMPARE_LIMIT) {
      const droppedNames = createdNames.slice(COMPARE_LIMIT);
      console.log(
        `[CohortSplitDialog] Split produced ${createdIds.length} sub-cohorts; compare is capped at ${COMPARE_LIMIT}. ` +
          `Pre-selected the first ${COMPARE_LIMIT}; not auto-selected: ${droppedNames.join(', ')} ` +
          '(add them manually in the compare drawer).',
      );
    }

    const cohortsParam = selectedIds.map((id) => encodeURIComponent(id)).join(',');
    navigate(`/analysis?tab=trajectories&cohorts=${cohortsParam}&compare=open`);
  };

  if (!open) return null;

  const showRangeControls = isRangeAttr(attribute);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cohort-split-dialog-title"
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h3 id="cohort-split-dialog-title" className="text-base font-semibold text-gray-900 dark:text-white">
            {t('cohortSplitTitle')}
          </h3>
          <button
            onClick={onClose}
            aria-label={t('cohortSplitCancel')}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          {t('cohortSplitDesc').replace('{parent}', selectedParent?.name ?? '…')}
        </p>

        {savedSearches.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('cohortSplitNoParent')}</p>
        ) : (
          <>
            {/* Parent picker */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {t('cohortSplitParent')}
              </label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                aria-label={t('cohortSplitParent')}
                className="w-full text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5"
              >
                {savedSearches
                  .filter((s) => {
                    // Only offer plain cohorts (not subcohorts) as a split parent.
                    try {
                      parseSubcohortName(s.name);
                      return false;
                    } catch {
                      return true;
                    }
                  })
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Attribute */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {t('cohortSplitAttribute')}
              </label>
              <select
                value={attribute}
                onChange={(e) => setAttribute(e.target.value as SplitAttribute)}
                aria-label={t('cohortSplitAttribute')}
                className="w-full text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5"
              >
                <optgroup label={t('cohortSplitAttribute')}>
                  {CATEGORICAL_ATTRS.map((a) => (
                    <option key={a} value={a}>
                      {a === 'gender'
                        ? t('cohortSplitAttrGender')
                        : a === 'diagnosis'
                          ? t('cohortSplitAttrDiagnosis')
                          : t('cohortSplitAttrCenter')}
                    </option>
                  ))}
                  {RANGE_ATTRS.map((a) => (
                    <option key={a} value={a}>
                      {a === 'age'
                        ? t('cohortSplitAttrAge')
                        : a === 'visus'
                          ? t('cohortSplitAttrVisus')
                          : t('cohortSplitAttrCrt')}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Range mode controls */}
            {showRangeControls && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {t('cohortSplitMode')}
                </label>
                <div className="flex gap-4 mb-2 text-sm">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="cohort-split-mode"
                      checked={rangeMode === 'quantile'}
                      onChange={() => setRangeMode('quantile')}
                    />
                    {t('cohortSplitModeQuantile')}
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="cohort-split-mode"
                      checked={rangeMode === 'cutpoints'}
                      onChange={() => setRangeMode('cutpoints')}
                    />
                    {t('cohortSplitModeCutpoints')}
                  </label>
                </div>

                {rangeMode === 'quantile' ? (
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      {t('cohortSplitGroupsLabel')}
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={6}
                      value={groups}
                      onChange={(e) => setGroups(Math.max(2, Math.min(6, Number(e.target.value) || 2)))}
                      aria-label={t('cohortSplitGroupsLabel')}
                      className="w-24 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      {t('cohortSplitCutpointsLabel')}
                    </label>
                    <input
                      type="text"
                      value={cutPointsText}
                      onChange={(e) => setCutPointsText(e.target.value)}
                      placeholder={t('cohortSplitCutpointsHint')}
                      aria-label={t('cohortSplitCutpointsLabel')}
                      className="w-full text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5"
                    />
                    <p className="text-xs text-gray-400 mt-1">{t('cohortSplitCutpointsHint')}</p>
                  </div>
                )}
              </div>
            )}

            {/* Preview */}
            <div className="mb-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {t('cohortSplitPreview')}
              </label>
              {preview.error ? (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {t('cohortSplitError')}
                </p>
              ) : preview.groups.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('cohortSplitPreviewEmpty')}</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {preview.groups.map((g, i) => (
                    <li
                      key={`${g.label}-${i}`}
                      className={`flex justify-between rounded px-2 py-1 ${
                        g.count === 0
                          ? 'text-gray-400 dark:text-gray-500'
                          : 'bg-gray-50 dark:bg-gray-700'
                      }`}
                    >
                      <span>
                        {selectedParent?.name}:{g.label}
                      </span>
                      <span>
                        {g.count} {t('cohortSplitPatientsSuffix')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {skippedCount > 0 && !preview.error && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  {t('cohortSplitPreviewSkipped').replace('{n}', String(skippedCount))}
                </p>
              )}
              {nonEmptyGroups.length > 4 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('cohortSplitCompareNote')}</p>
              )}
              {!preview.error && preview.groups.length > 0 && nonEmptyGroups.length < 2 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{t('cohortSplitNeedTwo')}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 justify-end pt-4 border-t border-gray-100 dark:border-gray-700 mt-4">
              <Button variant="ghost" size="sm" onClick={onClose}>
                {t('cohortSplitCancel')}
              </Button>
              <Button
                variant="accent"
                size="sm"
                onClick={() => {
                  void handleConfirm();
                }}
                disabled={!canConfirm}
              >
                {t('cohortSplitConfirm')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
