/**
 * Phase 13 / METRIC-02 / D-04 — Treatment-Interval Histogram.
 *
 * Self-contained component. Reads PatientCase[] from props, computes bins via
 * shared/intervalMetric, renders Recharts BarChart with eye toggle + median
 * annotation. Does NOT register with OutcomesPanel or OutcomesView state —
 * Plan 05 mounts this component inside OutcomesView when metric='interval'.
 */
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { PatientCase } from '../../types/fhir';
import type { TranslationKey } from '../../i18n/translations';
import {
  computeIntervalDistribution,
  type IntervalEye,
} from '../../../shared/intervalMetric';
import { EYE_COLORS } from './palette';

interface Props {
  cases: PatientCase[];
  t: (key: TranslationKey) => string;
  locale: 'de' | 'en';
}

const EYE_OPTIONS: readonly IntervalEye[] = ['od', 'os', 'combined'] as const;

function colorForEye(eye: IntervalEye): string {
  if (eye === 'od') return EYE_COLORS.OD;
  if (eye === 'os') return EYE_COLORS.OS;
  return EYE_COLORS['OD+OS'];
}

function eyeLabelKey(eye: IntervalEye): TranslationKey {
  if (eye === 'od') return 'metricsIntervalEyeOd';
  if (eye === 'os') return 'metricsIntervalEyeOs';
  return 'metricsIntervalEyeCombined';
}

export default function IntervalHistogram({ cases, t, locale: _locale }: Props) {
  const [eye, setEye] = useState<IntervalEye>('combined');

  const distribution = useMemo(
    () => computeIntervalDistribution(cases, eye),
    [cases, eye],
  );

  const activeColor = colorForEye(eye);
  const allEmpty = distribution.bins.every((b) => b.count === 0);

  return (
    <div
      data-testid="interval-histogram"
      className="bg-white rounded-xl border border-gray-200 p-5"
    >
      <header className="mb-4 flex items-start justify-between">
        <h3 className="text-base font-semibold text-gray-900">
          {t('metricsIntervalTitle')}
        </h3>
        <div
          role="group"
          aria-label={t('metricsIntervalEyeSelector')}
          className="flex gap-1"
        >
          {EYE_OPTIONS.map((e) => {
            const active = e === eye;
            return (
              <button
                key={e}
                type="button"
                onClick={() => setEye(e)}
                aria-pressed={active}
                className={
                  active
                    ? 'px-3 py-1 text-xs rounded bg-violet-700 text-white'
                    : 'px-3 py-1 text-xs rounded bg-white border border-gray-200 text-gray-700'
                }
                data-testid={`interval-eye-${e}`}
              >
                {t(eyeLabelKey(e))}
              </button>
            );
          })}
        </div>
      </header>

      {allEmpty ? (
        <div
          data-testid="interval-empty"
          className="p-8 flex flex-col items-center justify-center text-center min-h-[280px]"
        >
          <h4 className="text-base font-semibold text-gray-900 mb-2">
            {t('metricsIntervalNoDataTitle')}
          </h4>
          <p className="text-sm text-gray-500 max-w-md">
            {t('metricsIntervalNoDataBody')}
          </p>
        </div>
      ) : (
        <>
          {/* Median annotation — plain text DOM element; Y-axis is count, not days. */}
          <p
            data-testid="interval-median"
            data-median-days={distribution.medianGap}
            className="text-xs text-gray-500 mb-2"
          >
            {t('metricsIntervalMedianLine').replace('{days}', String(distribution.medianGap))}
          </p>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={distribution.bins}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                label={{
                  value: t('metricsIntervalXAxis'),
                  position: 'insideBottom',
                  offset: -4,
                  fontSize: 11,
                  fill: '#6b7280',
                }}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                label={{
                  value: t('metricsIntervalYAxis'),
                  angle: -90,
                  position: 'insideLeft',
                  fontSize: 11,
                  fill: '#6b7280',
                }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }}
              />
              <Bar dataKey="count" fill={activeColor} fillOpacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
