/**
 * AdvancedFilterDialog — COH-04 advanced filter modal.
 *
 * Renders five curated filter attributes as a centered modal overlay.
 * Does NOT read cases directly — the parent derives medicationOptions and passes them
 * as a prop. All combination is AND (no OR toggle, per D-DEFER).
 *
 * Modal scaffold: QualityFlagDialog.tsx (fixed overlay + panel).
 * Focus trap + Escape: FeedbackButton.tsx lines 40-68 pattern.
 */
import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useLanguage } from '../context/LanguageContext';
import Button from '../components/primitives/Button';
import type { CohortFilter } from '../types/fhir';

// AMD and DR subtype codes sourced from shared/fhirCodes — representative SNOMED values
// used in the generated synthetic bundles. The dialog renders these as subtype checkboxes.
const AMD_SUBTYPES = [
  { code: '267718000', label: 'AMD (Allgemein / General)' },
  { code: '414173003', label: 'AMD trocken / Dry AMD' },
  { code: '414875008', label: 'AMD feucht / Wet AMD' },
];
const DR_SUBTYPES = [
  { code: '312898008', label: 'DR (Allgemein / General)' },
  { code: '312903003', label: 'NPDR (nicht-proliferativ)' },
  { code: '312904009', label: 'PDR (proliferativ)' },
];
const ALL_SUBTYPES = [...AMD_SUBTYPES, ...DR_SUBTYPES];

export interface AdvancedFilterDialogProps {
  open: boolean;
  filters: CohortFilter;
  medicationOptions: { code: string; label: string }[];
  onApply: (advancedFields: Partial<CohortFilter>) => void;
  onClose: () => void;
}

export default function AdvancedFilterDialog({
  open,
  filters,
  medicationOptions,
  onApply,
  onClose,
}: AdvancedFilterDialogProps) {
  const { t } = useLanguage();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Local dialog state — seeded from props.filters on open
  const [diagnosisSubtype, setDiagnosisSubtype] = useState<string[]>(filters.diagnosisSubtype ?? []);
  const [hasComorbidity, setHasComorbidity] = useState<boolean>(filters.hasComorbidity ?? false);
  const [hba1cMin, setHba1cMin] = useState<string>(
    filters.hba1cRange?.[0] != null ? String(filters.hba1cRange[0]) : '',
  );
  const [hba1cMax, setHba1cMax] = useState<string>(
    filters.hba1cRange?.[1] != null ? String(filters.hba1cRange[1]) : '',
  );
  const [medicationCodes, setMedicationCodes] = useState<string[]>(filters.medicationCodes ?? []);
  const [laterality, setLaterality] = useState<'OD' | 'OS' | 'OU' | undefined>(
    filters.laterality,
  );

  // Re-seed local state when dialog opens (or filters change externally)
  useEffect(() => {
    if (open) {
      setDiagnosisSubtype(filters.diagnosisSubtype ?? []);
      setHasComorbidity(filters.hasComorbidity ?? false);
      setHba1cMin(filters.hba1cRange?.[0] != null ? String(filters.hba1cRange[0]) : '');
      setHba1cMax(filters.hba1cRange?.[1] != null ? String(filters.hba1cRange[1]) : '');
      setMedicationCodes(filters.medicationCodes ?? []);
      setLaterality(filters.laterality);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Focus trap + Escape (FeedbackButton.tsx lines 40-68 pattern)
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
      // WR-02: move focus into the dialog on open (WCAG 2.1 SC 2.4.3 Focus Order)
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
        'button, input, select, [tabindex]:not([tabindex="-1"])',
      );
      firstFocusable?.focus();
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  const handleClear = () => {
    setDiagnosisSubtype([]);
    setHasComorbidity(false);
    setHba1cMin('');
    setHba1cMax('');
    setMedicationCodes([]);
    setLaterality(undefined);
  };

  const handleApply = () => {
    const advancedFields: Partial<CohortFilter> = {};

    if (diagnosisSubtype.length > 0) advancedFields.diagnosisSubtype = diagnosisSubtype;
    if (hasComorbidity) advancedFields.hasComorbidity = true;

    const minVal = hba1cMin !== '' ? parseFloat(hba1cMin) : NaN;
    const maxVal = hba1cMax !== '' ? parseFloat(hba1cMax) : NaN;
    // CR-03: require both bounds — partial input is silently dropped to avoid
    // silent sentinel clamping that could exclude clinically valid high HbA1c values.
    // WR-03: block apply when both bounds are present but min > max (consistent with COH-01).
    if (!isNaN(minVal) && !isNaN(maxVal)) {
      if (minVal > maxVal) {
        return; // silent block — same pattern as COH-01 visusError guard
      }
      advancedFields.hba1cRange = [minVal, maxVal];
    }
    // Single-bound input: omit hba1cRange (user must provide both bounds)

    if (medicationCodes.length > 0) advancedFields.medicationCodes = medicationCodes;
    if (laterality) advancedFields.laterality = laterality;

    onApply(advancedFields);
    onClose();
  };

  const toggleSubtype = (code: string, checked: boolean) => {
    setDiagnosisSubtype((prev) =>
      checked ? [...prev, code] : prev.filter((c) => c !== code),
    );
  };

  const toggleMedication = (code: string, checked: boolean) => {
    setMedicationCodes((prev) =>
      checked ? [...prev, code] : prev.filter((c) => c !== code),
    );
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="advanced-filter-dialog-title"
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3
            id="advanced-filter-dialog-title"
            className="text-base font-semibold text-gray-900 dark:text-white"
          >
            {t('advancedFiltersTitle')}
          </h3>
          <button
            onClick={onClose}
            aria-label={t('advancedFiltersDiscard')}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Field 1: Diagnosis subtype */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {t('advancedFiltersDiagnosisSubtype')}
          </label>
          {ALL_SUBTYPES.map((s) => (
            <label key={s.code} className="flex items-center gap-2 mb-1.5 text-sm">
              <input
                type="checkbox"
                checked={diagnosisSubtype.includes(s.code)}
                onChange={(e) => toggleSubtype(s.code, e.target.checked)}
                className="rounded border-gray-300"
              />
              {s.label}
            </label>
          ))}
        </div>

        {/* Field 2: Comorbidities */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {t('advancedFiltersComorbidities')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              id="has-comorbidity-checkbox"
              checked={hasComorbidity}
              onChange={(e) => setHasComorbidity(e.target.checked)}
              aria-label={t('advancedFiltersComorbiditiesAny')}
              className="rounded border-gray-300"
            />
            {t('advancedFiltersComorbiditiesAny')}
          </label>
        </div>

        {/* Field 3: HbA1c */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {t('advancedFiltersHba1c')}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              placeholder="Min"
              value={hba1cMin}
              onChange={(e) => setHba1cMin(e.target.value)}
              className="w-20 px-2 py-1.5 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
            />
            <span className="text-gray-400 dark:text-gray-500">—</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="Max"
              value={hba1cMax}
              onChange={(e) => setHba1cMax(e.target.value)}
              className="w-20 px-2 py-1.5 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">%</span>
          </div>
        </div>

        {/* Field 4: Drug / agent (medication codes from medicationOptions prop) */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {t('advancedFiltersMedication')}
          </label>
          {medicationOptions.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500">—</p>
          ) : (
            medicationOptions.map((opt) => (
              <label key={opt.code} className="flex items-center gap-2 mb-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={medicationCodes.includes(opt.code)}
                  onChange={(e) => toggleMedication(opt.code, e.target.checked)}
                  aria-label={opt.label}
                  className="rounded border-gray-300"
                />
                {opt.label}
              </label>
            ))
          )}
        </div>

        {/* Field 5: Laterality */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {t('advancedFiltersLaterality')}
          </label>
          {(['OD', 'OS', 'OU'] as const).map((lat) => (
            <label key={lat} className="flex items-center gap-2 mb-1.5 text-sm">
              <input
                type="radio"
                name="laterality"
                value={lat}
                checked={laterality === lat}
                onChange={() => setLaterality(lat)}
                aria-label={t(
                  lat === 'OD'
                    ? 'advancedFiltersLateralityOD'
                    : lat === 'OS'
                      ? 'advancedFiltersLateralityOS'
                      : 'advancedFiltersLateralityOU',
                )}
              />
              {t(
                lat === 'OD'
                  ? 'advancedFiltersLateralityOD'
                  : lat === 'OS'
                    ? 'advancedFiltersLateralityOS'
                    : 'advancedFiltersLateralityOU',
              )}
            </label>
          ))}
        </div>

        {/* Footer — QualityFlagDialog justify-end pattern */}
        <div className="flex gap-2 justify-end pt-4 border-t border-gray-100 dark:border-gray-700 mt-4">
          <Button variant="ghost" size="sm" onClick={handleClear}>
            {t('advancedFiltersClear')}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('advancedFiltersDiscard')}
          </Button>
          <Button variant="accent" size="sm" onClick={handleApply}>
            {t('advancedFiltersApply')}
          </Button>
        </div>
      </div>
    </div>
  );
}
