import {
  Activity,
  AlertTriangle,
  Building2,
  Calendar,
  Eye,
  FileWarning,
  Layers,
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
import { InfoTooltip } from '../primitives';

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
  /** L6 (v1.17): the currently-highlighted injection date — an injection node in
   *  the timeline strip is emphasised (amber) when its date matches. */
  highlightInjectionDate?: string | null;
  /** L6: click handler for an injection node in the top "Behandlungsverlauf"
   *  strip — toggles the same temporary injection highlight used by the IVI list
   *  and the trajectory plot marker. */
  onInjectionClick?: (date: string) => void;
  /** M4 (v1.18): the cohort-reference overlay toggle now lives in the header. It
   *  governs ALL case-detail plots (Visus/CRT, baseline-change, IOD,
   *  distributions), so it is a prominent header-level control. Optional so the
   *  header still renders standalone in tests that don't exercise the toggle. */
  showCohortReference?: boolean;
  onToggleCohortReference?: (next: boolean) => void;
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
  highlightInjectionDate = null,
  onInjectionClick,
  showCohortReference = false,
  onToggleCohortReference,
}: PatientHeaderProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/40 rounded-full">
            <User className="w-6 h-6 text-blue-600 dark:text-blue-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {pseudonym}
            </h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
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
                <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded text-xs font-medium flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  {eyeLaterality === 'OD' ? t('rightEye') : t('leftEye')}
                </span>
              )}
              <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                {totalEncounters} {t('contacts')}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* M4 (v1.18): cohort-reference overlay toggle — a prominent header
              control because it governs ALL case-detail plots (Visus/CRT,
              baseline-change, IOD, distributions), not a single chart. */}
          {onToggleCohortReference && (
            <label
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer select-none border transition-colors ${
                showCohortReference
                  ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700'
                  : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-indigo-50 dark:hover:bg-gray-600'
              }`}
            >
              <Layers className="w-4 h-4" />
              <input
                type="checkbox"
                className="w-3.5 h-3.5 cursor-pointer"
                checked={showCohortReference}
                onChange={(e) => onToggleCohortReference(e.target.checked)}
                aria-label={t('cohortReferenceToggle')}
              />
              {t('cohortReferenceToggle')}
              {/* K-bl1: explain how the cohort overlay is aggregated. */}
              <InfoTooltip text={t('cohortAggregationInfo')} />
            </label>
          )}
          {adverseEvents.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 rounded-lg text-sm font-medium">
              <FileWarning className="w-4 h-4" />
              {adverseEvents.length} {t('adverseEvents')}
            </div>
          )}
          {hasCriticalValues && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-sm font-medium">
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
          <span className="px-3 py-1 bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 rounded-full text-sm flex items-center gap-1.5">
            <Stethoscope className="w-3.5 h-3.5" />
            {t('treatmentIndication')}: {treatmentIndication}
          </span>
        )}
      </div>

      {/* Encounter timeline */}
      {encounterTimeline.length > 0 && (
        <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-700">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-3">{t('treatmentTimeline')}</h4>
          <div className="flex items-start overflow-x-auto pb-2">
            {encounterTimeline.map((enc, i) => (
              <div key={enc.date} className="flex items-start flex-shrink-0">
                {i > 0 && (
                  <div className="w-6 h-px bg-gray-300 dark:bg-gray-600 mt-5 flex-shrink-0" />
                )}
                <div className="flex flex-col items-center">
                  {(() => {
                    // A node is highlightable if it carries a measurement (visit
                    // highlight) OR — L6 — an injection (injection highlight). The
                    // node-level click toggles the visit highlight when a
                    // measurement is present; injection-only nodes toggle the
                    // injection highlight. Injection icons also toggle the
                    // injection highlight directly (stopPropagation) so a mixed
                    // node still exposes the injection action.
                    const hasMeasurement = enc.events.some(e => e.type === 'visus' || e.type === 'crt');
                    const hasInjection = enc.events.some(e => e.type === 'injection');
                    const injectionActive = hasInjection && highlightInjectionDate === enc.date;
                    const visitActive = highlightDate === enc.date;
                    const clickable = hasMeasurement || (hasInjection && !!onInjectionClick);
                    const toggleNode = () => {
                      if (hasMeasurement) {
                        onHighlightDate(visitActive ? null : enc.date);
                      } else if (hasInjection && onInjectionClick) {
                        onInjectionClick(enc.date);
                      }
                    };
                    const emphasised = visitActive || injectionActive;
                    return (
                      <div
                        role={clickable ? 'button' : undefined}
                        tabIndex={clickable ? 0 : undefined}
                        onClick={clickable ? toggleNode : undefined}
                        onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleNode(); } } : undefined}
                        className={`flex items-center gap-1 border rounded-lg p-2 min-w-[40px] justify-center ${
                          clickable
                            ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-700 hover:border-blue-300 transition-colors ' + (emphasised ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-300' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700')
                            : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                        }`}
                      >
                        {enc.events.map((ev, j) => {
                          const iconClass = "w-3.5 h-3.5";
                          let icon: React.ReactNode;
                          let color: string;

                          switch (ev.type) {
                            case 'visus':
                              icon = <Eye className={iconClass} />;
                              color = 'text-emerald-600 dark:text-emerald-400';
                              break;
                            case 'crt':
                              icon = <Activity className={iconClass} />;
                              color = 'text-purple-600 dark:text-purple-400';
                              break;
                            case 'injection':
                              icon = <Syringe className={iconClass} />;
                              color = injectionActive ? 'text-amber-500' : 'text-blue-600 dark:text-blue-400';
                              break;
                            case 'oct':
                              icon = <ScanEye className={iconClass} />;
                              color = 'text-cyan-600 dark:text-cyan-400';
                              break;
                          }

                          // L6: injection icon — clickable, toggles the injection
                          // highlight (stopPropagation so a mixed node's
                          // node-level visit toggle is not also fired).
                          const isInjectionClick = ev.type === 'injection' && !!onInjectionClick;
                          const isOctClick = ev.type === 'oct' && ev.octIdx !== undefined;
                          return (
                            <button
                              key={j}
                              title={ev.label}
                              aria-pressed={ev.type === 'injection' ? injectionActive : undefined}
                              onClick={
                                isOctClick
                                  ? (e) => { e.stopPropagation(); onOctTimelineClick(ev.octIdx!); }
                                  : isInjectionClick
                                    ? (e) => { e.stopPropagation(); onInjectionClick!(enc.date); }
                                    : undefined
                              }
                              className={`${color} ${isOctClick || isInjectionClick ? 'cursor-pointer hover:scale-125 transition-transform' : 'cursor-default'}`}
                            >
                              {icon}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}

                  <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 whitespace-nowrap">
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
