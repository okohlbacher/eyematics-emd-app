import { ArrowRightLeft,Pill } from 'lucide-react';

import type { TranslationKey } from '../../i18n/translations';
import type { MedicationStatement } from '../../types/fhir';

export interface MedicationCardProps {
  medications: MedicationStatement[];
  dateFmt: string;
  t: (key: TranslationKey) => string;
}

export default function MedicationCard({
  medications,
  dateFmt,
  t,
}: MedicationCardProps) {
  const sorted = [...medications].sort(
    (a, b) => (a.effectivePeriod?.start ?? '').localeCompare(b.effectivePeriod?.start ?? '')
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Pill className="w-4 h-4" />
        {t('medication')} ({medications.length})
      </h3>
      {medications.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">{t('noMedication')}</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((med, i) => {
            const drugName = med.medicationCodeableConcept?.coding?.[0]?.display ?? '\u2014';
            const tradeName = med.medicationCodeableConcept?.text ?? '';
            const isActive = med.status === 'active' || !med.effectivePeriod?.end;
            const hasSwitch = medications.length > 1 && i < sorted.length - 1 && med.effectivePeriod?.end;

            return (
              <div key={med.id}>
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isActive ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                  }`}>
                    <Pill className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{drugName}</span>
                      {tradeName && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded">
                          {tradeName}
                        </span>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        isActive ? 'bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                      }`}>
                        {isActive ? t('medicationActive') : t('medicationEnded')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {med.effectivePeriod?.start && (
                        <>{t('medicationSince')} {new Date(med.effectivePeriod.start).toLocaleDateString(dateFmt)}</>
                      )}
                      {med.effectivePeriod?.end && (
                        <> &mdash; {t('medicationUntil')} {new Date(med.effectivePeriod.end).toLocaleDateString(dateFmt)}</>
                      )}
                    </p>
                  </div>
                </div>
                {hasSwitch && (
                  <div className="flex items-center gap-2 ml-4 my-1 text-xs text-amber-600 dark:text-amber-400">
                    <ArrowRightLeft className="w-3 h-3" />
                    {t('medicationSwitch')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
