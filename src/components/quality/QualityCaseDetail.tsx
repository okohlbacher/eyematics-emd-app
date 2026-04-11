import {
  AlertCircle,
  Ban,
  CheckCheck,
  CheckCircle2,
  Circle,
  Flag,
} from 'lucide-react';
import { useMemo } from 'react';

import { useLanguage } from '../../context/LanguageContext';
import {
  getAge,
  getDiagnosisLabel,
  getObservationsByCode,
  LOINC_CRT,
  LOINC_VISUS,
  SNOMED_IVI,
} from '../../services/fhirLoader';
import type { PatientCase, QualityFlag } from '../../types/fhir';
import type { TherapyStatusEntry } from './QualityCaseList';

export interface QualityCaseDetailProps {
  selectedCase: PatientCase;
  caseFlags: QualityFlag[];
  therapyStatus: TherapyStatusEntry | undefined;
  isExcluded: boolean;
  isReviewed: boolean;
  dateFmt: string;
  onMarkReviewed: (caseId: string) => void;
  onExclude: (caseId: string) => void;
  onNavigateToCase: (caseId: string) => void;
  onOpenFlagDialog: (parameter: string, value: string) => void;
  onUpdateFlagStatus: (caseId: string, parameter: string, status: QualityFlag['status']) => void;
}

export default function QualityCaseDetail({
  selectedCase,
  caseFlags,
  therapyStatus,
  isExcluded,
  isReviewed,
  dateFmt,
  onMarkReviewed,
  onExclude,
  onNavigateToCase,
  onOpenFlagDialog,
  onUpdateFlagStatus,
}: QualityCaseDetailProps) {
  const { locale, t } = useLanguage();

  // Anomalies including missing data (N03.05, EMDREQ-QUAL-004)
  const anomalies = useMemo(() => {
    const results: Array<{ parameter: string; value: string; reason: string }> = [];

    const visObs = getObservationsByCode(selectedCase.observations, LOINC_VISUS);
    const crtObs = getObservationsByCode(selectedCase.observations, LOINC_CRT);
    const injections = selectedCase.procedures.filter((p) =>
      p.code.coding.some((c) => c.code === SNOMED_IVI)
    );

    if (visObs.length === 0) results.push({ parameter: 'Visus', value: '—', reason: t('missingVisus') });
    if (crtObs.length === 0) results.push({ parameter: 'CRT', value: '—', reason: t('missingCrt') });
    if (injections.length === 0) results.push({ parameter: 'IVOM', value: '—', reason: t('missingInjections') });

    crtObs.forEach((o) => {
      const v = o.valueQuantity?.value;
      if (v != null && v > 400) {
        results.push({ parameter: `CRT (${o.effectiveDateTime?.substring(0, 10)})`, value: `${v} µm`, reason: t('crtAnomaly') });
      }
    });
    visObs.forEach((o) => {
      const v = o.valueQuantity?.value;
      if (v != null && v < 0.1) {
        results.push({ parameter: `Visus (${o.effectiveDateTime?.substring(0, 10)})`, value: `${v}`, reason: t('visusAnomaly') });
      }
    });
    for (let i = 1; i < visObs.length; i++) {
      const prev = visObs[i - 1].valueQuantity?.value ?? 0;
      const curr = visObs[i].valueQuantity?.value ?? 0;
      if (Math.abs(curr - prev) > 0.3) {
        results.push({ parameter: `Visus (${visObs[i].effectiveDateTime?.substring(0, 10)})`, value: `${prev} → ${curr}`, reason: t('visusJump') });
      }
    }
    return results;
  }, [selectedCase, t]);

  return (
    <div className="space-y-4">
      {/* Case info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-gray-900">{selectedCase.pseudonym}</h3>
            {isExcluded && (
              <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-xs font-medium flex items-center gap-1">
                <Ban className="w-3 h-3" /> {t('excludedCase')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onMarkReviewed(selectedCase.id)}
              className={`px-3 py-1.5 text-xs rounded-lg border flex items-center gap-1.5 ${
                isReviewed
                  ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                  : 'border-green-200 text-green-700 hover:bg-green-50'
              }`}
            >
              {isReviewed ? (
                <><Circle className="w-3.5 h-3.5" /> {t('unmarkReviewed')}</>
              ) : (
                <><CheckCircle2 className="w-3.5 h-3.5" /> {t('markAsReviewed')}</>
              )}
            </button>
            <button
              onClick={() => onExclude(selectedCase.id)}
              className={`px-3 py-1.5 text-xs rounded-lg border flex items-center gap-1.5 ${
                isExcluded
                  ? 'border-green-200 text-green-700 hover:bg-green-50'
                  : 'border-red-200 text-red-700 hover:bg-red-50'
              }`}
            >
              {isExcluded ? (
                <><CheckCheck className="w-3.5 h-3.5" /> {t('includeInAnalysis')}</>
              ) : (
                <><Ban className="w-3.5 h-3.5" /> {t('excludeFromAnalysis')}</>
              )}
            </button>
            <button
              onClick={() => onNavigateToCase(selectedCase.id)}
              className="text-sm text-blue-600 hover:underline"
            >
              {t('fullCaseView')}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-4 text-sm">
          <div>
            <p className="text-gray-500">{t('age')}</p>
            <p className="font-medium">{getAge(selectedCase.birthDate)} J.</p>
          </div>
          <div>
            <p className="text-gray-500">{t('diagnosis')}</p>
            <p className="font-medium">
              {selectedCase.conditions
                .map((c) => getDiagnosisLabel(c.code.coding[0]?.code ?? '', locale))
                .join(', ')}
            </p>
          </div>
          <div>
            <p className="text-gray-500">{t('totalMeasurements')}</p>
            <p className="font-medium">{selectedCase.observations.length}</p>
          </div>
          <div>
            <p className="text-gray-500">{t('center')}</p>
            <p className="font-medium">{selectedCase.centerName}</p>
          </div>
          <div>
            <p className="text-gray-500">{t('therapyDiscontinuation')}</p>
            <p className="font-medium">
              {therapyStatus?.status === 'breaker' ? (
                <span className="text-red-600">
                  {t('therapyBreaker')} ({therapyStatus.gapDays}d)
                </span>
              ) : therapyStatus?.status === 'interrupter' ? (
                <span className="text-amber-600">
                  {t('therapyInterrupter')} ({therapyStatus.gapDays}d)
                </span>
              ) : (
                <span className="text-green-600">{t('therapyActive')}</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Anomalies + missing data */}
      {anomalies.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
          <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {t('anomalousValues')} / {t('missingData')} ({anomalies.length})
          </h3>
          <div className="space-y-2">
            {anomalies.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 bg-white rounded-lg text-sm"
              >
                <div>
                  <span className="font-medium">{a.parameter}</span>
                  <span className="text-gray-500 ml-2">{a.value}</span>
                  <span className="text-amber-600 ml-2 text-xs">({a.reason})</span>
                </div>
                <button
                  onClick={() => onOpenFlagDialog(a.parameter, a.value)}
                  className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 flex items-center gap-1"
                >
                  <Flag className="w-3 h-3" /> {t('reportError')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Observations table */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-3">{t('valuesToReview')}</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">{t('parameter')}</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">{t('date')}</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">{t('value')}</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">{t('action')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {selectedCase.observations.map((obs) => {
              const paramKey = `${obs.code.coding[0]?.display} (${obs.effectiveDateTime?.substring(0, 10)})`;
              const flag = caseFlags.find((f) => f.parameter === paramKey);
              return (
                <tr key={obs.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">{obs.code.coding[0]?.display}</td>
                  <td className="px-3 py-2 text-gray-500">{obs.effectiveDateTime?.substring(0, 10)}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {obs.valueQuantity?.value} {obs.valueQuantity?.unit}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {flag ? (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                          flag.status === 'open'
                            ? 'bg-red-50 text-red-600'
                            : flag.status === 'acknowledged'
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-green-50 text-green-600'
                        }`}
                      >
                        {flag.errorType} — {flag.status}
                      </span>
                    ) : (
                      <button
                        onClick={() => onOpenFlagDialog(paramKey, `${obs.valueQuantity?.value}`)}
                        className="text-gray-400 hover:text-red-500"
                        title={t('reportError')}
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Existing flags */}
      {caseFlags.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">
            {t('reviewResults')} ({caseFlags.length})
          </h3>
          <div className="space-y-2">
            {caseFlags.map((f, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm"
              >
                <div>
                  <p className="font-medium">{f.parameter}</p>
                  <p className="text-xs text-gray-500">
                    {f.errorType} — {t('reportedBy')} {f.flaggedBy},{' '}
                    {new Date(f.flaggedAt).toLocaleDateString(dateFmt)}
                  </p>
                </div>
                <select
                  value={f.status}
                  onChange={(e) =>
                    onUpdateFlagStatus(f.caseId, f.parameter, e.target.value as QualityFlag['status'])
                  }
                  className="text-xs border rounded px-2 py-1"
                >
                  <option value="open">{t('statusOpen')}</option>
                  <option value="acknowledged">{t('statusAcknowledged')}</option>
                  <option value="resolved">{t('statusResolved')}</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
