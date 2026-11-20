/**
 * Z0-P09: dialog "Fälle mit kritischen Werten" — the cases a cohort's critical-value count refers to, each with its
 * highest CRT (descending, Q28) and a button that opens the case view.
 * Modal scaffold, focus trap and Escape mirror CohortSplitDialog.tsx / AdvancedFilterDialog.tsx.
 */
import { X } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { useLanguage } from '../../context/LanguageContext';
import type { CriticalCase } from '../../utils/criticalCases';

interface CriticalCasesDialogProps {
  /** Cohort name shown under the title (compare mode: one list per cohort, Q36). */
  cohortName: string;
  cases: CriticalCase[];
  onClose: () => void;
}

export default function CriticalCasesDialog({ cohortName, cases, onClose }: CriticalCasesDialogProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button');
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

  // The listener and the focus move belong to the open dialog; focus returns to the opener on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    document.addEventListener('keydown', handleKeyDown);
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (opener?.isConnected) opener.focus();
    };
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="critical-cases-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-1">
          <h3 id="critical-cases-dialog-title" className="text-base font-semibold text-gray-900 dark:text-white">
            {t('criticalCasesTitle')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{cohortName}</p>
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {cases.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2">
              <span className="text-sm text-gray-900 dark:text-gray-100">
                <span className="font-medium">{c.pseudonym}</span>
                <span className="ml-3 text-red-600 dark:text-red-400">
                  {t('criticalCasesMaxCrt')}: {Math.round(c.maxCrt)} µm
                </span>
              </span>
              <button
                type="button"
                onClick={() => navigate(`/case/${c.id}`)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                {t('fullCaseView')}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
