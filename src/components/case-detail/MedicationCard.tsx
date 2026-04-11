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
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Pill className="w-4 h-4" />
        {t('medication')} ({medications.length})
      </h3>
      {medications.length === 0 ? (
        <p className="text-sm text-gray-400">{t('noMedication')}</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((med, i) => {
            const drugName = med.medicationCodeableConcept?.coding?.[0]?.display ?? '\u2014';
            const tradeName = med.medicationCodeableConcept?.text ?? '';
            const isActive = med.status === 'active' || !med.effectivePeriod?.end;
            const hasSwitch = medications.length > 1 && i < sorted.length - 1 && med.effectivePeriod?.end;

            return (
              <div key={med.id}>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                  }`}>
                    <Pill className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{drugName}</span>
                      {tradeName && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                          {tradeName}
                        </span>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {isActive ? t('medicationActive') : t('medicationEnded')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
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
                  <div className="flex items-center gap-2 ml-4 my-1 text-xs text-amber-600">
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
