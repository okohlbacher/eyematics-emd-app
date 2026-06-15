import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { TranslationKey } from '../../i18n/translations';
import type { DistributionBin } from '../../utils/distributionBins';

interface ScatterPoint {
  visus: number;
  crt: number;
  date: string;
}

/** J3d: distribution bins carry an optional cohort percentage per bin so the
 *  cohort distribution can be overlaid behind the patient's counts. */
type CohortDistributionBin = DistributionBin & { cohortPct?: number };

export interface DistributionChartsProps {
  visusDistribution: CohortDistributionBin[];
  crtDistribution: CohortDistributionBin[];
  visusCrtScatter: ScatterPoint[];
  /** J3d: cohort Visus-vs-CRT cloud drawn behind the patient's points. */
  cohortVisusCrtScatter?: Array<{ visus: number; crt: number }>;
  /** J3d: gate all cohort overlays on the same toggle as the trajectory chart. */
  showCohortReference?: boolean;
  t: (key: TranslationKey) => string;
}

export default function DistributionCharts({
  visusDistribution,
  crtDistribution,
  visusCrtScatter,
  cohortVisusCrtScatter = [],
  showCohortReference = false,
  t,
}: DistributionChartsProps) {
  return (
    <div className="grid grid-cols-12 gap-6 mb-6">
      {/* Visus distribution histogram */}
      <div className="col-span-4 bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4 text-sm">
          {t('distributionVisus')}
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={visusDistribution}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="range" tick={{ fontSize: 9 }} />
            <YAxis yAxisId="count" allowDecimals={false} tickCount={5} tick={{ fontSize: 10 }} label={{ value: t('frequency'), angle: -90, position: 'insideLeft', fontSize: 10, fill: '#9ca3af' }} />
            {showCohortReference && (
              <YAxis yAxisId="cohort" orientation="right" tickCount={5} tick={{ fontSize: 9, fill: '#9ca3af' }} unit="%" />
            )}
            <Tooltip />
            {showCohortReference && <Legend />}
            {/* J3d: cohort distribution overlay (% of cohort per bin), drawn behind
                the patient bars on its own right axis so scales don't distort. */}
            {showCohortReference && (
              <Bar yAxisId="cohort" dataKey="cohortPct" fill="#9ca3af" fillOpacity={0.35} stroke="#6b7280" strokeDasharray="2 2" name={t('cohortReferenceDistribution')} radius={[3, 3, 0, 0]} />
            )}
            <Bar yAxisId="count" dataKey="count" fill="#10b981" name={t('measurements')} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* CRT distribution histogram */}
      <div className="col-span-4 bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4 text-sm">
          {t('distributionCrt')}
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={crtDistribution}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="range" tick={{ fontSize: 9 }} />
            <YAxis yAxisId="count" allowDecimals={false} tickCount={5} tick={{ fontSize: 10 }} label={{ value: t('frequency'), angle: -90, position: 'insideLeft', fontSize: 10, fill: '#9ca3af' }} />
            {showCohortReference && (
              <YAxis yAxisId="cohort" orientation="right" tickCount={5} tick={{ fontSize: 9, fill: '#9ca3af' }} unit="%" />
            )}
            <Tooltip />
            {showCohortReference && <Legend />}
            <ReferenceLine yAxisId="count" x=">400" stroke="#ef4444" strokeDasharray="3 3" />
            {showCohortReference && (
              <Bar yAxisId="cohort" dataKey="cohortPct" fill="#9ca3af" fillOpacity={0.35} stroke="#6b7280" strokeDasharray="2 2" name={t('cohortReferenceDistribution')} radius={[3, 3, 0, 0]} />
            )}
            <Bar yAxisId="count" dataKey="count" fill="#8b5cf6" name={t('measurements')} radius={[3, 3, 0, 0]}>
              {crtDistribution.map((entry, idx) => (
                <Cell key={idx} fill={entry.range === '>400' ? '#ef4444' : '#8b5cf6'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Visus vs CRT scatter plot (N05.35) */}
      <div className="col-span-4 bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4 text-sm">
          {t('correlationVisusCrt')}
        </h3>
        {visusCrtScatter.length > 1 ? (
          <ResponsiveContainer width="100%" height={180}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="visus" name="Visus" type="number" domain={[0, 1]} tickCount={5} tick={{ fontSize: 9 }} label={{ value: t('scatterVisusAxisLabel'), position: 'insideBottom', offset: -2, fontSize: 10 }} />
              <YAxis dataKey="crt" name="CRT" unit=" µm" tickCount={5} tick={{ fontSize: 9 }} label={{ value: t('scatterCrtAxisLabel'), angle: -90, position: 'insideLeft', fontSize: 10, fill: '#9ca3af' }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as { visus: number; crt: number; date: string };
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
                      <p className="text-gray-500">{d.date}</p>
                      <p>Visus: <strong>{d.visus.toFixed(2)}</strong></p>
                      <p>CRT: <strong>{d.crt} µm</strong></p>
                    </div>
                  );
                }}
              />
              {showCohortReference && <Legend />}
              {/* J3d: cohort Visus-vs-CRT cloud behind the patient's points. */}
              {showCohortReference && cohortVisusCrtScatter.length > 0 && (
                <Scatter data={cohortVisusCrtScatter} fill="#94a3b8" fillOpacity={0.25} name={t('cohortReferenceScatter')} isAnimationActive={false} />
              )}
              <Scatter data={visusCrtScatter} fill="#f59e0b" name={t('measurements')} />
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-gray-400">{t('noData')}</p>
        )}
      </div>
    </div>
  );
}
