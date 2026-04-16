import { Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { TranslationKey } from '../../i18n/translations';

type Variant = 'no-cohort' | 'no-visus' | 'all-eyes-filtered';

export default function OutcomesEmptyState({
  variant,
  t,
}: {
  variant: Variant;
  t: (key: TranslationKey) => string;
}) {
  let titleKey: TranslationKey;
  let bodyKey: TranslationKey;
  let actionKey: TranslationKey | null;

  switch (variant) {
    case 'no-cohort':
      titleKey = 'outcomesEmptyCohortTitle';
      bodyKey = 'outcomesEmptyCohortBody';
      actionKey = 'outcomesEmptyCohortAction';
      break;
    case 'no-visus':
      titleKey = 'outcomesNoVisusTitle';
      bodyKey = 'outcomesNoVisusBody';
      actionKey = null;
      break;
    case 'all-eyes-filtered':
      titleKey = 'outcomesEmptyAllEyesFilteredTitle';
      bodyKey = 'outcomesEmptyAllEyesFilteredBody';
      actionKey = null;
      break;
  }

  return (
    <div className="p-8 flex flex-col items-center justify-center text-center min-h-[60vh]">
      <Users aria-hidden="true" className="w-12 h-12 text-gray-300 mb-4" />
      <h2 className="text-base font-semibold text-gray-900 mb-2">{t(titleKey)}</h2>
      <p className="text-sm text-gray-500 mb-4 max-w-md">{t(bodyKey)}</p>
      {actionKey && (
        <Link to="/cohort" className="text-sm text-blue-600 underline hover:text-blue-700">
          {t(actionKey)}
        </Link>
      )}
    </div>
  );
}
