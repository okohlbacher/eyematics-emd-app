/**
 * Phase 13 / METRIC-03 / D-05 — Responder Classification view.
 *
 * Two sections in one card:
 *  1. Grouped BarChart: bucket counts (responder/partial/non-responder) per eye (OD/OS/combined)
 *  2. Trajectory overlay: median visus delta per bucket (3 lines, combined eye only)
 *
 * Plan 05 mounts this inside OutcomesView when metric='responder'.
 */
import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { computeCohortTrajectory } from '../../../shared/cohortTrajectory';
import {
  classifyResponders,
} from '../../../shared/responderMetric';
import type { TranslationKey } from '../../i18n/translations';
import type { PatientCase } from '../../types/fhir';

interface Props {
  cases: PatientCase[];
  thresholdLetters: number;
  t: (key: TranslationKey) => string;
  locale: 'de' | 'en';
}

/** Bucket colors — 13-UI-SPEC.md § Color */
const BUCKET_COLORS = {
  responder: '#16a34a',
  partial: '#ca8a04',
  nonResponder: '#dc2626',
} as const;

export default function ResponderView({ cases, thresholdLetters, t, locale: _locale }: Props) {
  const odBuckets = useMemo(() => classifyResponders(cases, thresholdLetters, 'od'), [cases, thresholdLetters]);
  const osBuckets = useMemo(() => classifyResponders(cases, thresholdLetters, 'os'), [cases, thresholdLetters]);
  const combinedBuckets = useMemo(() => classifyResponders(cases, thresholdLetters, 'combined'), [cases, thresholdLetters]);

  const totalClassified =
    odBuckets.responder.length + odBuckets.partial.length + odBuckets.nonResponder.length +
    osBuckets.responder.length + osBuckets.partial.length + osBuckets.nonResponder.length +
    combinedBuckets.responder.length + combinedBuckets.partial.length + combinedBuckets.nonResponder.length;

  // Trajectory overlays — use combined eye buckets (deepest data).
  const responderTraj = useMemo(
    () => computeCohortTrajectory({ cases: combinedBuckets.responder, axisMode: 'days', yMetric: 'delta', gridPoints: 120 }),
    [combinedBuckets.responder],
  );
  const partialTraj = useMemo(
    () => computeCohortTrajectory({ cases: combinedBuckets.partial, axisMode: 'days', yMetric: 'delta', gridPoints: 120 }),
    [combinedBuckets.partial],
  );
  const nonResponderTraj = useMemo(
    () => computeCohortTrajectory({ cases: combinedBuckets.nonResponder, axisMode: 'days', yMetric: 'delta', gridPoints: 120 }),
    [combinedBuckets.nonResponder],
  );

  if (totalClassified === 0) {
    return (
      <div
        data-testid="responder-empty"
        className="bg-white rounded-xl border border-gray-200 p-8 flex flex-col items-center justify-center text-center min-h-[60vh]"
      >
        <h3 className="text-base font-semibold text-gray-900 mb-2">
          {t('metricsResponderNoDataTitle')}
        </h3>
        <p className="text-sm text-gray-500 max-w-md">
          {t('metricsResponderNoDataBody')}
        </p>
      </div>
    );
  }

  // Bar chart data — one row per eye
  const barData = [
    {
      eye: t('metricsIntervalEyeOd'),
      responder: odBuckets.responder.length,
      partial: odBuckets.partial.length,
      nonResponder: odBuckets.nonResponder.length,
    },
    {
      eye: t('metricsIntervalEyeOs'),
      responder: osBuckets.responder.length,
      partial: osBuckets.partial.length,
      nonResponder: osBuckets.nonResponder.length,
    },
    {
      eye: t('metricsIntervalEyeCombined'),
      responder: combinedBuckets.responder.length,
      partial: combinedBuckets.partial.length,
      nonResponder: combinedBuckets.nonResponder.length,
    },
  ];

  // Merge the three trajectory medians by x-value into a single dataset for ComposedChart.
  const xs = Array.from(new Set([
    ...responderTraj.combined.medianGrid.map((g) => g.x),
    ...partialTraj.combined.medianGrid.map((g) => g.x),
    ...nonResponderTraj.combined.medianGrid.map((g) => g.x),
  ])).sort((a, b) => a - b);

  const trajData = xs.map((x) => {
    const r = responderTraj.combined.medianGrid.find((g) => g.x === x)?.y;
    const p = partialTraj.combined.medianGrid.find((g) => g.x === x)?.y;
    const n = nonResponderTraj.combined.medianGrid.find((g) => g.x === x)?.y;
    return {
      x,
      // Convert logMAR delta to ETDRS letter delta for display: improvement = positive letters.
      responder: Number.isFinite(r) ? Math.round((r as number) * -50) : null,
      partial: Number.isFinite(p) ? Math.round((p as number) * -50) : null,
      nonResponder: Number.isFinite(n) ? Math.round((n as number) * -50) : null,
    };
  });

  return (
    <div
      data-testid="responder-view"
      className="bg-white rounded-xl border border-gray-200 p-5"
    >
      <h3 className="text-base font-semibold text-gray-900 mb-4">
        {t('metricsResponderTitle')}
      </h3>

      {/* Section 1: grouped bar chart */}
      <div data-testid="responder-bar-section">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="eye"
              tick={{ fontSize: 11 }}
              label={{ value: t('metricsResponderBarXAxis'), position: 'insideBottom', offset: -4, fontSize: 11, fill: '#6b7280' }}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              label={{ value: t('metricsResponderBarYAxis'), angle: -90, position: 'insideLeft', fontSize: 11, fill: '#6b7280' }}
              allowDecimals={false}
            />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="responder" fill={BUCKET_COLORS.responder} name={t('metricsResponderBucketResponder')} />
            <Bar dataKey="partial" fill={BUCKET_COLORS.partial} name={t('metricsResponderBucketPartial')} />
            <Bar dataKey="nonResponder" fill={BUCKET_COLORS.nonResponder} name={t('metricsResponderBucketNonResponder')} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <hr className="my-6 border-gray-100" />

      {/* Section 2: trajectory overlay */}
      <div data-testid="responder-trajectory-section">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">
          {t('metricsResponderTrajectoryTitle')}
        </h4>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={trajData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="x"
              type="number"
              tick={{ fontSize: 11 }}
              label={{ value: 'Tage', position: 'insideBottom', offset: -4, fontSize: 11, fill: '#6b7280' }}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              label={{ value: t('metricsPreviewColDeltaVisusLetters'), angle: -90, position: 'insideLeft', fontSize: 11, fill: '#6b7280' }}
            />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="responder" stroke={BUCKET_COLORS.responder} strokeWidth={3} dot={false} name={t('metricsResponderBucketResponder')} connectNulls />
            <Line type="monotone" dataKey="partial" stroke={BUCKET_COLORS.partial} strokeWidth={3} dot={false} name={t('metricsResponderBucketPartial')} connectNulls />
            <Line type="monotone" dataKey="nonResponder" stroke={BUCKET_COLORS.nonResponder} strokeWidth={3} dot={false} name={t('metricsResponderBucketNonResponder')} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Hidden bucket counts for testing — exposes combined counts as data attrs */}
      <div
        hidden
        data-testid="responder-counts"
        data-combined-responder={combinedBuckets.responder.length}
        data-combined-partial={combinedBuckets.partial.length}
        data-combined-non-responder={combinedBuckets.nonResponder.length}
      />
    </div>
  );
}
