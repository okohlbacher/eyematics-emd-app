/**
 * Phase 13 / METRIC-02 / D-04 — Treatment-Interval Histogram.
 *
 * Self-contained component. Reads PatientCase[] from props, computes bins via
 * shared/intervalMetric, renders Recharts BarChart with eye toggle + median
 * annotation. Does NOT register with OutcomesPanel or OutcomesView state —
 * Plan 05 mounts this component inside OutcomesView when metric='interval'.
 *
 * Phase 42 / ANL-010: optional cohortSeries prop for cross-cohort compare mode.
 * When cohortSeries has >=2 entries, renders one Bar per cohort (grouped by bin)
 * with a named Legend — consistent with COHORT_PALETTES used in Visus/CRT panels.
 * Single-cohort mode is byte-for-byte unchanged.
 */
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  computeIntervalDistribution,
  type IntervalEye,
} from '../../../shared/intervalMetric';
import { useThemeSafe } from '../../context/ThemeContext';
import type { TranslationKey } from '../../i18n/translations';
import type { PatientCase } from '../../types/fhir';
import { EYE_COLORS, rechartsTheme } from './palette';

/** Cross-cohort series entry for the interval histogram — mirrors OutcomesPanel.CohortSeriesEntry
 *  but carries raw cases instead of a pre-computed PanelResult, so the histogram can
 *  re-compute per-eye distributions when the eye toggle changes. */
export interface IntervalCohortSeries {
  cohortId: string;
  cohortName: string;
  patientCount: number;
  color: string; // COHORT_PALETTES[idx % len]
  cases: PatientCase[];
}

interface Props {
  cases: PatientCase[];
  t: (key: TranslationKey) => string;
  locale: 'de' | 'en';
  /** When provided with >=2 entries, activates cross-cohort compare mode. */
  cohortSeries?: IntervalCohortSeries[];
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

export default function IntervalHistogram({ cases, t, locale: _locale, cohortSeries }: Props) {
  const [eye, setEye] = useState<IntervalEye>('combined');
  // M12 (v1.18 WS-A): theme-aware Recharts tokens (test-safe via useThemeSafe).
  const { effectiveTheme } = useThemeSafe();
  const ct = rechartsTheme(effectiveTheme === 'dark');

  // Determine if we are in cross-cohort mode.
  const isCrossMode = Boolean(cohortSeries && cohortSeries.length >= 2);

  // Single-cohort distribution (used only when not in cross mode).
  const distribution = useMemo(
    () => (!isCrossMode ? computeIntervalDistribution(cases, eye) : null),
    [cases, eye, isCrossMode],
  );

  // Cross-cohort: compute per-series distributions and merge into grouped bar data.
  // Each row: { label: string, [cohortId]: count, ... }
  const crossData = useMemo(() => {
    if (!isCrossMode || !cohortSeries) return null;
    // Compute distribution for every cohort at the current eye selection.
    const seriesDistributions = cohortSeries.map((s) => ({
      series: s,
      dist: computeIntervalDistribution(s.cases, eye),
    }));
    // Collect all bin labels in their natural order (they are the same across cohorts).
    const labelOrder: string[] = seriesDistributions[0]?.dist.bins.map((b) => b.label) ?? [];
    // Merge bins — one row per label.
    const rows = labelOrder.map((label) => {
      const row: Record<string, unknown> = { label };
      seriesDistributions.forEach(({ series, dist }) => {
        const bin = dist.bins.find((b) => b.label === label);
        row[series.cohortId] = bin?.count ?? 0;
      });
      return row;
    });
    // Per-cohort medians for annotation.
    const medians = seriesDistributions.map(({ series, dist }) => ({
      cohortId: series.cohortId,
      cohortName: series.cohortName,
      color: series.color,
      medianGap: dist.medianGap,
    }));
    const allEmpty = rows.every((r) =>
      cohortSeries.every((s) => (r[s.cohortId] as number) === 0),
    );
    return { rows, medians, allEmpty };
  }, [isCrossMode, cohortSeries, eye]);

  // Single-mode: is there any data?
  const singleAllEmpty = !isCrossMode && distribution
    ? distribution.bins.every((b) => b.count === 0)
    : false;

  const activeColor = colorForEye(eye);

  return (
    <div
      data-testid="interval-histogram"
      className="bg-white rounded-xl border border-gray-200 p-5"
    >
      <header className="mb-4 flex items-start justify-between">
        <h3 className="text-base font-semibold text-gray-900">
          {t('metricsIntervalTitle')}
        </h3>
        {/* Eye toggle — available in both single and cross mode (re-computes all series) */}
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

      {/* ---- Cross-cohort mode ---- */}
      {isCrossMode && crossData && (
        crossData.allEmpty ? (
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
            {/* Per-cohort legend + median annotations.
                Renders cohort name as accessible DOM text so each cohort is identifiable
                by color swatch + name (consistent with Visus/CRT OutcomesPanel legend chips).
                The median annotation is prefixed with the cohort name. */}
            <div
              aria-label={t('metricsIntervalCohortLegendAriaLabel')}
              className="flex flex-wrap gap-x-4 gap-y-1 mb-2"
            >
              {crossData.medians.map((m) => (
                <p
                  key={m.cohortId}
                  data-testid={`interval-median-${m.cohortId}`}
                  data-median-days={m.medianGap}
                  className="text-xs mb-0 flex items-center gap-1"
                  style={{ color: m.color }}
                >
                  {/* Color swatch + cohort name — queryable by name text */}
                  <span
                    aria-hidden="true"
                    className="inline-block w-2 h-2 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: m.color }}
                  />
                  <span>{m.cohortName}</span>
                  {m.medianGap > 0 && (
                    <span className="text-gray-400 ml-1">
                      {' · '}
                      {t('metricsIntervalMedianLineCohort')
                        .replace('{name}', '')
                        .replace('{days}', String(m.medianGap))
                        .replace(': ', '')}
                    </span>
                  )}
                </p>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={crossData.rows}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: ct.axisTick }}
                  stroke={ct.axisTick}
                  label={{
                    value: t('metricsIntervalXAxis'),
                    position: 'insideBottom',
                    offset: -4,
                    fontSize: 11,
                    fill: ct.axisLabel,
                  }}
                />
                <YAxis
                  tickCount={5}
                  tick={{ fontSize: 11, fill: ct.axisTick }}
                  stroke={ct.axisTick}
                  label={{
                    value: t('metricsIntervalYAxis'),
                    angle: -90,
                    position: 'insideLeft',
                    fontSize: 11,
                    fill: ct.axisLabel,
                  }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 6, border: `1px solid ${ct.tooltipBorder}`, backgroundColor: ct.tooltipBg, color: ct.tooltipText }}
                  itemStyle={{ color: ct.tooltipText }}
                  labelStyle={{ color: ct.tooltipText }}
                />
                {/* Recharts Legend renders cohort name + color swatch automatically from Bar name= */}
                <Legend
                  wrapperStyle={{ fontSize: 12, color: ct.legend }}
                  aria-label={t('metricsIntervalCohortLegendAriaLabel')}
                />
                {cohortSeries!.map((s) => (
                  <Bar
                    key={s.cohortId}
                    dataKey={s.cohortId}
                    name={s.cohortName}
                    fill={s.color}
                    fillOpacity={0.85}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </>
        )
      )}

      {/* ---- Single-cohort mode (unchanged) ---- */}
      {!isCrossMode && (
        singleAllEmpty ? (
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
              data-median-days={distribution!.medianGap}
              className="text-xs text-gray-500 mb-2"
            >
              {t('metricsIntervalMedianLine').replace('{days}', String(distribution!.medianGap))}
            </p>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={distribution!.bins}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: ct.axisTick }}
                  stroke={ct.axisTick}
                  label={{
                    value: t('metricsIntervalXAxis'),
                    position: 'insideBottom',
                    offset: -4,
                    fontSize: 11,
                    fill: ct.axisLabel,
                  }}
                />
                <YAxis
                  tickCount={5}
                  tick={{ fontSize: 11, fill: ct.axisTick }}
                  stroke={ct.axisTick}
                  label={{
                    value: t('metricsIntervalYAxis'),
                    angle: -90,
                    position: 'insideLeft',
                    fontSize: 11,
                    fill: ct.axisLabel,
                  }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 6, border: `1px solid ${ct.tooltipBorder}`, backgroundColor: ct.tooltipBg, color: ct.tooltipText }}
                  itemStyle={{ color: ct.tooltipText }}
                  labelStyle={{ color: ct.tooltipText }}
                />
                <Bar dataKey="count" fill={activeColor} fillOpacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </>
        )
      )}
    </div>
  );
}
