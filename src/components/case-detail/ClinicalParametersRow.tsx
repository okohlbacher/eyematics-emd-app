import { Eye, Glasses, HeartPulse } from 'lucide-react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { CRITICAL_IOP_THRESHOLD } from '../../config/clinicalThresholds';
import { useThemeSafe } from '../../context/ThemeContext';
import type { IopDataPoint } from '../../hooks/useCaseData';
import type { TranslationKey } from '../../i18n/translations';
import type { Condition, Observation } from '../../types/fhir';
import { translateClinical } from '../../utils/clinicalTerms';
import { InfoTooltip } from '../primitives';
import { caseChartColors, IQR_FILL_OPACITY } from './chartTheme';

/** IOD/IOP series colours — shared so the legend swatch (L4b) matches the plot. */
const IOP_COLOR = '#6366f1';
const IOP_MEDIAN_COLOR = '#a5b4fc';

export interface ClinicalParametersRowProps {
  iopObs: Observation[];
  iopData: IopDataPoint[];
  refractionObs: Observation[];
  hba1cObs: Observation[];
  diabetesCond?: Condition;
  eyeLaterality: string;
  dateFmt: string;
  locale: string;
  t: (key: TranslationKey) => string;
  /** K3b: gate the IOP cohort overlay on the same toggle as the Visus/CRT overlay. */
  showCohortReference?: boolean;
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
  showCohortReference = false,
}: ClinicalParametersRowProps) {
  // L11b: theme-aware chart colours.
  const { effectiveTheme } = useThemeSafe();
  const isDark = effectiveTheme === 'dark';
  const colors = caseChartColors(isDark);

  // K3b: show the IOP cohort overlay only when the toggle is on AND the data
  // actually carries cohort reference fields for at least one row.
  const hasIopReference =
    showCohortReference && iopData.some((d) => d.iopMedian != null || d.iopBand != null);

  // M7 (v1.18): the IOD chart now switches calendar ↔ relative ("Monate seit
  // Erstvisite") exactly like Visus/CRT (L5) — relative axis when the cohort
  // overlay is active so the relative-time-aligned cohort band shares the
  // patient's axis; the linear calendar-time axis (M6) otherwise.
  const useIopRelativeAxis = hasIopReference;

  // N4 (v1.19 WS-B): on the relative axis the patient IOP series must be keyed
  // PURELY on relMonths — no leftover calendar-date rows/ticks. iopData is built
  // in iopObs (date) order, which is NOT guaranteed to be ascending in relMonths
  // nor free of relMonths collisions once a patient has many IOP dates (repro:
  // EM-UKT-0027). Recharts' numeric axis then renders out-of-order / duplicate
  // points, which surfaced as residual individual-date artefacts. Collapse rows
  // that share a relMonths bucket (last write wins) and sort ascending by
  // relMonths so each x-position is unique and the axis is a clean numeric
  // relative-time axis. The calendar variant keeps the date-ordered rows
  // untouched (its axis is the epoch-ms time axis, M6).
  const chartData = useIopRelativeAxis
    ? Array.from(
        iopData
          .reduce((m, row) => m.set(row.relMonths, { ...row }), new Map<number, IopDataPoint>())
          .values(),
      ).sort((a, b) => a.relMonths - b.relMonths)
    : iopData;

  // L4b: custom legend so the IQR band swatch reproduces the rendered band colour
  // (semi-transparent fill), not the opaque patient series colour.
  const renderIopLegend = (props: {
    payload?: ReadonlyArray<{ value?: unknown; color?: string; dataKey?: unknown }>;
  }) => {
    if (!Array.isArray(props.payload)) return null;
    return (
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs mt-1" style={{ color: colors.legend }}>
        {props.payload.map((entry, i) => {
          const isBand = String(entry.dataKey ?? '') === 'iopBand';
          return (
            <li key={i} className="flex items-center gap-1.5">
              {isBand ? (
                <span
                  aria-hidden
                  style={{
                    display: 'inline-block',
                    width: 14,
                    height: 10,
                    background: entry.color,
                    opacity: IQR_FILL_OPACITY,
                    border: `1px solid ${entry.color}`,
                  }}
                />
              ) : (
                <span
                  aria-hidden
                  style={{ display: 'inline-block', width: 14, height: 0, borderTop: `2px solid ${entry.color}` }}
                />
              )}
              <span>{String(entry.value ?? '')}</span>
            </li>
          );
        })}
      </ul>
    );
  };

  // L4c: custom tooltip whitelisting the measured IOP + cohort median (numbers only)
  // so the IQR band tuple (iopBand = [p25,p75]) never leaks into the tooltip as a raw
  // "12,14" string — mirrors the VisusCrtChart tooltip. Excludes iopBand.
  const renderIopTooltip = (props: {
    active?: boolean;
    payload?: ReadonlyArray<{ dataKey?: unknown; value?: unknown; color?: string; payload?: { date?: string; relMonths?: number } }>;
  }) => {
    if (!props.active || !Array.isArray(props.payload) || props.payload.length === 0) return null;
    const rows: Array<{ key: string; name: string; color?: string; text: string }> = [];
    for (const e of props.payload) {
      const key = String(e.dataKey ?? '');
      if (typeof e.value !== 'number') continue;
      if (key === 'iop') rows.push({ key, name: t('iop'), color: e.color, text: `${e.value} mmHg` });
      else if (key === 'iopMedian') rows.push({ key, name: t('cohortReferenceMedianIop'), color: e.color, text: `${e.value} mmHg` });
    }
    if (rows.length === 0) return null;
    // M7: the label adapts to the active axis — "X Monate seit Erstvisite" on the
    // relative axis, the calendar date otherwise (mirrors VisusCrtChart's L4c).
    const ref = props.payload.find((e) => e.payload)?.payload;
    const label = useIopRelativeAxis
      ? ref?.relMonths != null
        ? `${ref.relMonths} ${t('relativeMonthsAxisLabel')}`
        : ''
      : ref?.date
        ? new Date(ref.date).toLocaleDateString(dateFmt)
        : '';
    return (
      <div className="rounded-lg shadow-lg px-3 py-2 text-xs border" style={{ background: colors.tooltipBg, borderColor: colors.tooltipBorder }}>
        {label && <div className="font-semibold mb-1" style={{ color: colors.tooltipHeading }}>{label}</div>}
        {rows.map((r) => (
          <div key={r.key} style={{ color: colors.tooltipText }}>
            <span style={{ color: r.color }}>{r.name}</span>: {r.text}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-12 gap-6 mb-6">
      {/* IOP chart (N05.06) */}
      <div className="col-span-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          <Eye className="w-4 h-4" />
          {t('iop')} {eyeLaterality && <span className="text-xs text-gray-400 dark:text-gray-500">({eyeLaterality})</span>}
          {/* K-bl1 + L10: short explanation; when the overlay is on, append the
              overlay-specific note about the IQR band + relative-time alignment. */}
          <InfoTooltip text={hasIopReference ? `${t('iopPlotInfo')} ${t('cohortOverlayInfoIop')}` : t('iopPlotInfo')} />
        </h3>
        {iopObs.length > 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
            {t('measurementMethod')}: {translateClinical(iopObs[0].method?.coding?.[0]?.display ?? '—', locale)}
          </p>
        )}
        {iopData.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">{t('noData')}</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            {/* L4d: the IOD overlay is a cohort median LINE + IQR band over the
                patient's IOP LINE (was a bar plot), consistent with Visus/CRT.
                M7: the X axis now switches calendar ↔ relative with the overlay
                toggle (like Visus/CRT, L5); the calendar variant is a linear
                TIME axis keyed on epoch-ms (M6) so spacing tracks elapsed time. */}
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
              {useIopRelativeAxis ? (
                <XAxis
                  dataKey="relMonths"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  /* N4: numeric ticks derived strictly from the relMonths values
                     so the axis can never fall back to per-row calendar-date
                     ticks; the formatter only ever sees a number. */
                  ticks={chartData.map((d) => d.relMonths)}
                  allowDuplicatedCategory={false}
                  tickFormatter={(m: number) => String(m)}
                  tick={{ fontSize: 9, fill: colors.axisTick }}
                  stroke={colors.grid}
                  label={{ value: t('relativeMonthsAxisLabel'), position: 'insideBottom', offset: -2, fontSize: 9, fill: colors.axisLabel }}
                />
              ) : (
                <XAxis
                  dataKey="dateMs"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(ms: number) => (ms ? new Date(ms).toLocaleDateString(dateFmt, { month: '2-digit', year: '2-digit' }) : '')}
                  tick={{ fontSize: 9, fill: colors.axisTick }}
                  stroke={colors.grid}
                />
              )}
              <YAxis domain={[0, 30]} tickCount={5} tick={{ fontSize: 10, fill: colors.axisTick }} stroke={colors.grid} />
              <Tooltip content={renderIopTooltip} />
              {hasIopReference && <Legend content={renderIopLegend} />}
              <ReferenceLine y={CRITICAL_IOP_THRESHOLD()} stroke="#ef4444" strokeDasharray="3 3" label={{ value: String(CRITICAL_IOP_THRESHOLD()), fontSize: 9, fill: '#ef4444' }} />
              {hasIopReference && (
                <Area
                  dataKey="iopBand"
                  stroke="none"
                  fill={IOP_COLOR}
                  fillOpacity={IQR_FILL_OPACITY}
                  name={t('cohortReferenceBandIop')}
                  legendType="rect"
                  connectNulls
                  isAnimationActive={false}
                />
              )}
              {hasIopReference && (
                <Line
                  type="monotone"
                  dataKey="iopMedian"
                  stroke={IOP_MEDIAN_COLOR}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  name={t('cohortReferenceMedianIop')}
                  dot={false}
                  connectNulls
                />
              )}
              {/* L4d: patient IOP as a LINE (was a Bar) — consistent with the
                  Visus/CRT trajectory and the cohort median line. */}
              <Line
                type="monotone"
                dataKey="iop"
                stroke={IOP_COLOR}
                strokeWidth={2}
                name={t('iop')}
                dot={(props: Record<string, unknown>) => {
                  const { cx, cy } = props as { cx?: number; cy?: number };
                  if (cx == null || cy == null) return <circle key={`iop-${cx}-${cy}`} r={0} />;
                  return <circle key={`iop-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill={IOP_COLOR} stroke="#fff" strokeWidth={1} />;
                }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Refraction (N05.09) */}
      <div className="col-span-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Glasses className="w-4 h-4" />
          {t('refraction')} {eyeLaterality && <span className="text-xs text-gray-400 dark:text-gray-500">({eyeLaterality})</span>}
        </h3>
        {refractionObs.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">{t('noData')}</p>
        ) : (
          <div className="space-y-3">
            {refractionObs.map((obs) => {
              const sph = obs.component?.find((c) => c.code.coding[0]?.code === '79846-2')?.valueQuantity?.value;
              const cyl = obs.component?.find((c) => c.code.coding[0]?.code === '79847-0')?.valueQuantity?.value;
              const ax = obs.component?.find((c) => c.code.coding[0]?.code === '79848-8')?.valueQuantity?.value;
              return (
                <div key={obs.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                    {obs.effectiveDateTime ? new Date(obs.effectiveDateTime).toLocaleDateString(dateFmt) : '—'}
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('sphere')}</p>
                      <p className="font-mono font-medium text-gray-900 dark:text-gray-100">{sph != null ? `${sph > 0 ? '+' : ''}${sph.toFixed(2)}` : '—'} dpt</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('cylinder')}</p>
                      <p className="font-mono font-medium text-gray-900 dark:text-gray-100">{cyl != null ? `${cyl.toFixed(2)}` : '—'} dpt</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('axis')}</p>
                      <p className="font-mono font-medium text-gray-900 dark:text-gray-100">{ax != null ? `${ax}°` : '—'}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Diabetes / HbA1c (N05.16) */}
      <div className="col-span-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <HeartPulse className="w-4 h-4" />
          {t('hba1c')}
        </h3>
        {diabetesCond && (
          <div className="mb-3 p-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-300">{translateClinical(diabetesCond.code.coding[0]?.display ?? '', locale)}</p>
            {diabetesCond.onsetDateTime && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                {t('diabetesSince')} {new Date(diabetesCond.onsetDateTime).toLocaleDateString(dateFmt)}
              </p>
            )}
          </div>
        )}
        {hba1cObs.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">{t('noData')}</p>
        ) : (
          <div className="space-y-2">
            {hba1cObs.map((obs) => (
              <div key={obs.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm">
                <span className="text-gray-500 dark:text-gray-400">
                  {obs.effectiveDateTime ? new Date(obs.effectiveDateTime).toLocaleDateString(dateFmt) : '—'}
                </span>
                <span className={`font-mono font-medium ${(obs.valueQuantity?.value ?? 0) > 7.0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
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
