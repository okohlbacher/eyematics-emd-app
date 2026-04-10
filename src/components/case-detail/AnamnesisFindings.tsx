import { Stethoscope, ScanEye, FileWarning } from 'lucide-react';
import { translateClinical, getEyeLabel } from '../../utils/clinicalTerms';
import { SNOMED_EYE_RIGHT } from '../../services/fhirLoader';
import type { TranslationKey } from '../../i18n/translations';
import type { Condition, Observation } from '../../types/fhir';

export interface AnamnesisAndFindingsProps {
  ophthalmicAnamnesis: Condition[];
  nonOphthalmicAnamnesis: Condition[];
  anteriorFindings: Observation[];
  posteriorFindings: Observation[];
  adverseEvents: Condition[];
  dateFmt: string;
  locale: string;
  t: (key: TranslationKey) => string;
}

export default function AnamnesisFindings({
  ophthalmicAnamnesis,
  nonOphthalmicAnamnesis,
  anteriorFindings,
  posteriorFindings,
  adverseEvents,
  dateFmt,
  locale,
  t,
}: AnamnesisAndFindingsProps) {
  const conditionBadge = (cond: Condition, color: string) => (
    <div key={cond.id} className={`flex items-center gap-2 p-2 ${color} rounded-lg text-sm`}>
      <span className="font-medium">{translateClinical(cond.code.coding[0]?.display ?? cond.code.text ?? cond.code.coding[0]?.code ?? '', locale)}</span>
      {cond.onsetDateTime && (
        <span className="text-xs opacity-70">
          {t('since')} {new Date(cond.onsetDateTime).toLocaleDateString(dateFmt)}
        </span>
      )}
      {cond.bodySite?.[0] && (
        <span className="text-xs px-1.5 py-0.5 bg-white/50 rounded">
          {cond.bodySite[0].coding?.[0]?.code === SNOMED_EYE_RIGHT ? 'OD' : 'OS'}
        </span>
      )}
    </div>
  );

  return (
    <>
      {/* Anamnesis + Findings row (N05.08, N05.15) */}
      <div className="grid grid-cols-12 gap-6 mb-6">
        <div className="col-span-6 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Stethoscope className="w-4 h-4" />
            {t('anamnesis')}
          </h3>
          {ophthalmicAnamnesis.length === 0 && nonOphthalmicAnamnesis.length === 0 ? (
            <p className="text-sm text-gray-400">{t('noAnamnesis')}</p>
          ) : (
            <div className="space-y-3">
              {ophthalmicAnamnesis.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1.5">{t('ophthalmicAnamnesis')}</p>
                  <div className="space-y-1.5">
                    {ophthalmicAnamnesis.map((c) => conditionBadge(c, 'bg-blue-50 text-blue-800'))}
                  </div>
                </div>
              )}
              {nonOphthalmicAnamnesis.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1.5">{t('nonOphthalmicAnamnesis')}</p>
                  <div className="space-y-1.5">
                    {nonOphthalmicAnamnesis.map((c) => conditionBadge(c, 'bg-gray-100 text-gray-800'))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="col-span-6 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ScanEye className="w-4 h-4" />
            {t('findings')}
          </h3>
          {anteriorFindings.length === 0 && posteriorFindings.length === 0 ? (
            <p className="text-sm text-gray-400">{t('noFindings')}</p>
          ) : (
            <div className="space-y-3">
              {anteriorFindings.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1.5">{t('anteriorSegment')}</p>
                  <div className="space-y-1.5">
                    {anteriorFindings.map((obs) => (
                      <div key={obs.id} className="flex items-center justify-between p-2 bg-cyan-50 text-cyan-800 rounded-lg text-sm">
                        <span>{translateClinical(obs.code.text ?? obs.code.coding[0]?.display ?? '', locale)}</span>
                        <span className="text-xs text-cyan-600">
                          {obs.effectiveDateTime ? new Date(obs.effectiveDateTime).toLocaleDateString(dateFmt) : ''}
                          {obs.bodySite && <span className="ml-1">({getEyeLabel(obs) || '\u2014'})</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {posteriorFindings.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1.5">{t('posteriorSegment')}</p>
                  <div className="space-y-1.5">
                    {posteriorFindings.map((obs) => (
                      <div key={obs.id} className="flex items-center justify-between p-2 bg-violet-50 text-violet-800 rounded-lg text-sm">
                        <span>{translateClinical(obs.code.text ?? obs.code.coding[0]?.display ?? '', locale)}</span>
                        <span className="text-xs text-violet-600">
                          {obs.effectiveDateTime ? new Date(obs.effectiveDateTime).toLocaleDateString(dateFmt) : ''}
                          {obs.bodySite && <span className="ml-1">({getEyeLabel(obs) || '\u2014'})</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Adverse Events (N05.29) */}
      {adverseEvents.length > 0 && (
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-5 mb-6">
          <h3 className="font-semibold text-orange-800 mb-4 flex items-center gap-2">
            <FileWarning className="w-4 h-4" />
            {t('adverseEvents')} ({adverseEvents.length})
          </h3>
          <div className="space-y-2">
            {adverseEvents.map((ae) => (
              <div key={ae.id} className="flex items-center justify-between p-3 bg-white rounded-lg text-sm">
                <div>
                  <span className="font-medium text-orange-900">{translateClinical(ae.code.coding[0]?.display ?? ae.code.coding[0]?.code ?? '', locale)}</span>
                  {ae.bodySite?.[0] && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">
                      {ae.bodySite[0].coding?.[0]?.code === SNOMED_EYE_RIGHT ? 'OD' : 'OS'}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {ae.onsetDateTime ? new Date(ae.onsetDateTime).toLocaleDateString(dateFmt) : ''}
                  {ae.clinicalStatus?.coding?.[0]?.code && (
                    <span className={`ml-2 px-1.5 py-0.5 rounded ${
                      ae.clinicalStatus.coding[0].code === 'resolved' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {ae.clinicalStatus.coding[0].code}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
