import { AlertCircle, CheckCircle2 } from 'lucide-react';

import { scoreBgClass, scoreColor, scoreIconColor } from '../../utils/qualityMetrics';

export interface MetricCardProps {
  label: string;
  score: number;
  description?: string;
}

export function MetricCard({ label, score, description }: MetricCardProps) {
  const rounded = Math.round(score);
  return (
    <div className={`rounded-xl border p-4 ${scoreBgClass(score)}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
        {score > 80 ? (
          <CheckCircle2 className={`w-4 h-4 ${scoreIconColor(score)}`} />
        ) : (
          <AlertCircle className={`w-4 h-4 ${scoreIconColor(score)}`} />
        )}
      </div>
      <div className="text-2xl font-bold">{rounded}%</div>
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
    </div>
  );
}
