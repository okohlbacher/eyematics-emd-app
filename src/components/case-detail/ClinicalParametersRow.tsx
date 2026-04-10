import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Eye, Glasses, HeartPulse } from 'lucide-react';
import { translateClinical } from '../../utils/clinicalTerms';
import { CRITICAL_IOP_THRESHOLD } from '../../config/clinicalThresholds';
import type { TranslationKey } from '../../i18n/translations';
import type { Condition, Observation } from '../../types/fhir';

export interface ClinicalParametersRowProps {
  iopObs: Observation[];
  iopData: Array<{ date: string; iop: number }>;
  refractionObs: Observation[];
  hba1cObs: Observation[];
  diabetesCond?: Condition;
  eyeLaterality: string;
  dateFmt: string;
  locale: string;
  t: (key: TranslationKey) => string;
}

export default function ClinicalParametersRow({
  iopObs,
  iopData,
  refractionObs,
  hba1cObs,
  diabetesCond,
  eyeLaterality,
  dateFmt,
  locale,
  t,
}: ClinicalParametersRowProps) {
  return (
    <div className="grid grid-cols-12 gap-6 mb-6">
      {/* IOP chart (N05.06) */}
      <div className="col-span-4 bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <Eye className="w-4 h-4" />
          {t('iop')} {eyeLaterality && <span className="text-xs text-gray-400">({eyeLaterality})</span>}
        </h3>
        {iopObs.length > 0 && (
          <p className="text-xs text-gray-400 mb-3">
            {t('measurementMethod')}: {translateClinical(iopObs[0].method?.coding?.[0]?.display ?? '\u2014', locale)}
          </p>
        )}
        {iopData.length === 0 ? (
          <p className="text-sm text-gray-400">{t('noData')}</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={iopData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} />
              <YAxis domain={[0, 30]} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: unknown) => typeof v === 'number' ? `${v} mmHg` : String(v)} />
              <ReferenceLine y={CRITICAL_IOP_THRESHOLD} stroke="#ef4444" strokeDasharray="3 3" label={{ value: String(CRITICAL_IOP_THRESHOLD), fontSize: 9, fill: '#ef4444' }} />
              <Bar dataKey="iop" fill="#6366f1" name={t('iop')} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Refraction (N05.09) */}
      <div className="col-span-4 bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Glasses className="w-4 h-4" />
          {t('refraction')} {eyeLaterality && <span className="text-xs text-gray-400">({eyeLaterality})</span>}
        </h3>
        {refractionObs.length === 0 ? (
          <p className="text-sm text-gray-400">{t('noData')}</p>
        ) : (
          <div className="space-y-3">
            {refractionObs.map((obs) => {
              const sph = obs.component?.find((c) => c.code.coding[0]?.code === '79846-2')?.valueQuantity?.value;
              const cyl = obs.component?.find((c) => c.code.coding[0]?.code === '79847-0')?.valueQuantity?.value;
              const ax = obs.component?.find((c) => c.code.coding[0]?.code === '79848-8')?.valueQuantity?.value;
              return (
                <div key={obs.id} className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-400 mb-2">
                    {obs.effectiveDateTime ? new Date(obs.effectiveDateTime).toLocaleDateString(dateFmt) : '\u2014'}
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">{t('sphere')}</p>
                      <p className="font-mono font-medium">{sph != null ? `${sph > 0 ? '+' : ''}${sph.toFixed(2)}` : '\u2014'} dpt</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{t('cylinder')}</p>
                      <p className="font-mono font-medium">{cyl != null ? `${cyl.toFixed(2)}` : '\u2014'} dpt</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{t('axis')}</p>
                      <p className="font-mono font-medium">{ax != null ? `${ax}\u00b0` : '\u2014'}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Diabetes / HbA1c (N05.16) */}
      <div className="col-span-4 bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <HeartPulse className="w-4 h-4" />
          {t('hba1c')}
        </h3>
        {diabetesCond && (
          <div className="mb-3 p-2 bg-amber-50 rounded-lg text-sm">
            <p className="font-medium text-amber-800">{translateClinical(diabetesCond.code.coding[0]?.display ?? '', locale)}</p>
            {diabetesCond.onsetDateTime && (
              <p className="text-xs text-amber-600 mt-0.5">
                {t('diabetesSince')} {new Date(diabetesCond.onsetDateTime).toLocaleDateString(dateFmt)}
              </p>
            )}
          </div>
        )}
        {hba1cObs.length === 0 ? (
          <p className="text-sm text-gray-400">{t('noData')}</p>
        ) : (
          <div className="space-y-2">
            {hba1cObs.map((obs) => (
              <div key={obs.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                <span className="text-gray-500">
                  {obs.effectiveDateTime ? new Date(obs.effectiveDateTime).toLocaleDateString(dateFmt) : '\u2014'}
                </span>
                <span className={`font-mono font-medium ${(obs.valueQuantity?.value ?? 0) > 7.0 ? 'text-red-600' : 'text-green-600'}`}>
                  {obs.valueQuantity?.value}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
