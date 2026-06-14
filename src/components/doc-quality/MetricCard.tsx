import { AlertCircle, CheckCircle2 } from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import { scoreBgClass, scoreColor, scoreIconColor } from '../../utils/qualityMetrics';
import { InfoTooltip } from '../primitives';

export interface MetricCardProps {
  label: string;
  score: number;
  description?: string;
  patientCount?: number;
  threshold?: number;
  /** Optional definition tooltip shown next to the label (B2 disambiguation). */
  tooltip?: string;
}

export function MetricCard({ label, score, description, patientCount, threshold = 80, tooltip }: MetricCardProps) {
  const { t } = useLanguage();
  const rounded = Math.round(score);
  return (
    <div className={`rounded-xl border p-4 ${scoreBgClass(score)}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="inline-flex items-center gap-1 text-sm font-medium">
          {label}
          {tooltip && <InfoTooltip text={tooltip} />}
        </span>
        {score > 80 ? (
          <CheckCircle2 className={`w-4 h-4 ${scoreIconColor(score)}`} />
        ) : (
          <AlertCircle className={`w-4 h-4 ${scoreIconColor(score)}`} />
        )}
      </div>
      <div className="text-2xl font-bold">{rounded}%</div>
      {/* Absolute patient count — prominent, mirrors SummaryCard style */}
      {patientCount !== undefined && (
        <div className="text-sm font-medium mt-0.5">
          {patientCount} {t('docQualityPatients')}
        </div>
      )}
      {description && (
        <div className="text-xs mt-1 opacity-75">{description}</div>
      )}
      {/* Progress bar */}
      <div className="mt-2 h-1.5 rounded-full bg-white/40">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(rounded, 100)}%`, backgroundColor: scoreColor(score) }}
        />
      </div>
      {/* Threshold marker */}
      <div className="mt-1 text-[10px] opacity-60">
        <span>{t('docQualityThreshold')}: {threshold}%</span>
      </div>
    </div>
  );
}
