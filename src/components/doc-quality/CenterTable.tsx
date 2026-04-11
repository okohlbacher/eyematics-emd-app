import { Building2 } from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import type { CenterMetrics } from '../../utils/qualityMetrics';
import { ScoreBadge } from './ScoreBadge';

export interface CenterTableProps {
  metrics: CenterMetrics[];
  onSelectCenter: (centerId: string) => void;
}

export function CenterTable({ metrics, onSelectCenter }: CenterTableProps) {
  const { t } = useLanguage();

  const thClass = 'px-4 py-3 font-semibold text-gray-700';

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className={`text-left ${thClass}`}>{t('center')}</th>
            <th className={`text-right ${thClass}`}>{t('docQualityPatients')}</th>
            <th className={`text-right ${thClass}`}>{t('docQualityObservations')}</th>
            <th className={`text-right ${thClass}`}>{t('docQualityCompleteness')}</th>
            <th className={`text-right ${thClass}`}>{t('docQualityDataCompleteness')}</th>
            <th className={`text-right ${thClass}`}>{t('docQualityPlausibility')}</th>
            <th className={`text-right ${thClass}`}>{t('docQualityOverall')}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {metrics.map((m) => (
            <tr
              key={m.centerId}
              className="hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => onSelectCenter(m.centerId)}
            >
              <td className="px-4 py-3 font-medium text-gray-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                {m.centerLabel}
              </td>
              <td className="px-4 py-3 text-right text-gray-600">{m.patientCount}</td>
              <td className="px-4 py-3 text-right text-gray-600">{m.observationCount}</td>
              <td className="px-4 py-3 text-right"><ScoreBadge score={m.completeness} /></td>
              <td className="px-4 py-3 text-right"><ScoreBadge score={m.dataCompleteness} /></td>
              <td className="px-4 py-3 text-right"><ScoreBadge score={m.plausibility} /></td>
              <td className="px-4 py-3 text-right"><ScoreBadge score={m.overall} bold /></td>
              <td className="px-4 py-3 text-right text-blue-500 text-xs">
                {t('docQualityDetails')} &rarr;
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
