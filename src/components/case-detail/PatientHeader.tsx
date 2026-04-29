import {
  Activity,
  AlertTriangle,
  Building2,
  Calendar,
  Eye,
  FileWarning,
  ScanEye,
  Stethoscope,
  Syringe,
  User,
} from 'lucide-react';
import React from 'react';

import { pickCoding } from '../../../shared/fhirQueries';
import type { TranslationKey } from '../../i18n/translations';
import { getAge, SNOMED_EYE_RIGHT } from '../../services/fhirLoader';
import { useDiagnosisDisplay } from '../../services/terminology';
import type { Condition } from '../../types/fhir';

interface TimelineEvent {
  type: 'visus' | 'crt' | 'injection' | 'oct';
  label: string;
  octIdx?: number;
}

interface TimelineEntry {
  date: string;
  events: TimelineEvent[];
}

export interface PatientHeaderProps {
  pseudonym: string;
  birthDate: string;
  gender: string;
  centerName: string;
  eyeLaterality: string;
  totalEncounters: number;
  primaryDiagnoses: Condition[];
  treatmentIndication?: string;
  adverseEvents: Condition[];
  hasCriticalValues: boolean;
  criticalCrtCount: number;
  criticalVisusCount: number;
  criticalIopCount: number;
  encounterTimeline: TimelineEntry[];
  dateFmt: string;
  locale: string;
  t: (key: TranslationKey) => string;
  highlightDate: string | null;
  onHighlightDate: (date: string | null) => void;
  onOctTimelineClick: (octIdx: number) => void;
}

/**
 * Single diagnosis "pill" rendered with the terminology resolver hook (Phase 25 D-19).
 * Extracted from `.map(...)` so `useDiagnosisDisplay` can satisfy React's
 * rules-of-hooks (one hook call per pill = one component instance per pill).
 */
function DiagnosisPill({
  cond,
  locale,
  t,
  dateFmt,
}: {
  cond: Condition;
  locale: string;
  t: (key: TranslationKey) => string;
  dateFmt: string;
}) {
  const { system, code } = pickCoding(cond);
  const { label, fullText } = useDiagnosisDisplay(code, system, locale);
  return (
    <span
      className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm flex items-center gap-1.5 cursor-help"
      title={fullText}
    >
      {label}
      {cond.bodySite?.[0] && (
        <span className="text-purple-400 text-xs">
          ({cond.bodySite[0].coding?.[0]?.code === SNOMED_EYE_RIGHT ? 'OD' : 'OS'})
        </span>
      )}
      {cond.onsetDateTime && (
        <span className="text-purple-400">
          {t('since')}{' '}
          {new Date(cond.onsetDateTime).toLocaleDateString(dateFmt)}
        </span>
      )}
    </span>
  );
}

export default function PatientHeader({
  pseudonym,
  birthDate,
  gender,
  centerName,
  eyeLaterality,
  totalEncounters,
  primaryDiagnoses,
  treatmentIndication,
  adverseEvents,
  hasCriticalValues,
  criticalCrtCount,
  criticalVisusCount,
  criticalIopCount,
  encounterTimeline,
  dateFmt,
  locale,
  t,
  highlightDate,
  onHighlightDate,
  onOctTimelineClick,
}: PatientHeaderProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-full">
            <User className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {pseudonym}
            </h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {t('age')}: {getAge(birthDate)} {t('years')}
              </span>
              <span>
                {gender === 'female' ? t('female') : t('male')}
              </span>
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                {centerName}
              </span>
              {eyeLaterality && (
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  {eyeLaterality === 'OD' ? t('rightEye') : t('leftEye')}
                </span>
              )}
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                {totalEncounters} {t('contacts')}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {adverseEvents.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-sm font-medium">
              <FileWarning className="w-4 h-4" />
              {adverseEvents.length} {t('adverseEvents')}
            </div>
          )}
          {hasCriticalValues && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-medium">
              <AlertTriangle className="w-4 h-4" />
              {t('criticalExceedances')}:
              {criticalCrtCount > 0 && <span className="ml-1">{t('criticalCrtCount').replace('{0}', String(criticalCrtCount))}</span>}
              {criticalVisusCount > 0 && <span className="ml-1">{t('criticalVisusCount').replace('{0}', String(criticalVisusCount))}</span>}
              {criticalIopCount > 0 && <span className="ml-1">{t('criticalIopCount').replace('{0}', String(criticalIopCount))}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Diagnoses + Treatment indication */}
      <div className="mt-4 flex flex-wrap gap-2">
        {primaryDiagnoses.map((cond) => (
          <DiagnosisPill
            key={cond.id}
            cond={cond}
            locale={locale}
            t={t}
            dateFmt={dateFmt}
          />
        ))}
        {treatmentIndication && (
          <span className="px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-sm flex items-center gap-1.5">
            <Stethoscope className="w-3.5 h-3.5" />
            {t('treatmentIndication')}: {treatmentIndication}
          </span>
        )}
      </div>

      {/* Encounter timeline */}
      {encounterTimeline.length > 0 && (
        <div className="mt-5 pt-5 border-t border-gray-100">
          <h4 className="text-xs font-medium text-gray-500 uppercase mb-3">{t('treatmentTimeline')}</h4>
          <div className="flex items-start overflow-x-auto pb-2">
            {encounterTimeline.map((enc, i) => (
              <div key={enc.date} className="flex items-start flex-shrink-0">
                {i > 0 && (
                  <div className="w-6 h-px bg-gray-300 mt-5 flex-shrink-0" />
                )}
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-2 bg-gray-50 min-w-[40px] justify-center">
                    {enc.events.map((ev, j) => {
                      const iconClass = "w-3.5 h-3.5";
                      let icon: React.ReactNode;
                      let color: string;

                      switch (ev.type) {
                        case 'visus':
                          icon = <Eye className={iconClass} />;
                          color = 'text-emerald-600';
                          break;
                        case 'crt':
                          icon = <Activity className={iconClass} />;
                          color = 'text-purple-600';
                          break;
                        case 'injection':
                          icon = <Syringe className={iconClass} />;
                          color = 'text-blue-600';
                          break;
                        case 'oct':
                          icon = <ScanEye className={iconClass} />;
                          color = 'text-cyan-600';
                          break;
                      }

                      return (
                        <button
                          key={j}
                          title={ev.label}
                          onClick={
                            ev.type === 'oct' && ev.octIdx !== undefined
                              ? () => onOctTimelineClick(ev.octIdx!)
                              : (ev.type === 'visus' || ev.type === 'crt')
                                ? () => onHighlightDate(highlightDate === enc.date ? null : enc.date)
                                : undefined
                          }
                          className={`${color} ${ev.type === 'oct' || ev.type === 'visus' || ev.type === 'crt' ? 'cursor-pointer hover:scale-125 transition-transform' : 'cursor-default'}`}
                        >
                          {icon}
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1 whitespace-nowrap">
                    {new Date(enc.date).toLocaleDateString(dateFmt, { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
