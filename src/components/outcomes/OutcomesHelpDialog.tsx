/**
 * Z0-P11: dialog "Hilfe zu Verläufen" — explains single-case selection, cohort comparison, chart display and raw
 * data of the Verläufe tab (Q10: four sections). Modal scaffold, focus trap and Escape mirror CriticalCasesDialog.tsx.
 */
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import type { TranslationKey } from '../../i18n/translations';

const SECTIONS: [TranslationKey, TranslationKey][] = [
  ['outcomesHelpCaseHeading', 'outcomesHelpCaseBody'],
  ['outcomesHelpCompareHeading', 'outcomesHelpCompareBody'],
  ['outcomesHelpDisplayHeading', 'outcomesHelpDisplayBody'],
  ['outcomesHelpRawHeading', 'outcomesHelpRawBody'],
];

export default function OutcomesHelpDialog({
  onClose,
  t,
}: {
  onClose: () => void;
  t: (key: TranslationKey) => string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // The latest onClose, so a re-render of the parent (new inline callback) does not re-run the mount effect
  // and move the focus away from the dialog and back.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // The listener and the focus move belong to the open dialog (mount only); focus returns to the opener on close.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      // The close button is the only focusable element: keep Tab inside the dialog.
      if (e.key === 'Tab' && dialogRef.current) {
        e.preventDefault();
        dialogRef.current.querySelector<HTMLElement>('button')?.focus();
      }
    };
    const opener = document.activeElement as HTMLElement | null;
    document.addEventListener('keydown', handleKeyDown);
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="outcomes-help-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="outcomes-help-dialog-title" className="text-base font-semibold text-gray-900 dark:text-white">
            {t('outcomesHelpTitle')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        {SECTIONS.map(([heading, body]) => (
          <section key={heading} className="mb-4 last:mb-0">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t(heading)}</h4>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t(body)}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
