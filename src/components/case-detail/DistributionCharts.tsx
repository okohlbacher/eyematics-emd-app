import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ScatterChart,
  Scatter,
  Cell,
} from 'recharts';
import type { TranslationKey } from '../../i18n/translations';
import type { DistributionBin } from '../../utils/distributionBins';

interface ScatterPoint {
  visus: number;
  crt: number;
  date: string;
}

export interface DistributionChartsProps {
  visusDistribution: DistributionBin[];
  crtDistribution: DistributionBin[];
  visusCrtScatter: ScatterPoint[];
  t: (key: TranslationKey) => string;
}

export default function DistributionCharts({
  visusDistribution,
  crtDistribution,
  visusCrtScatter,
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
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} label={{ value: t('frequency'), angle: -90, position: 'insideLeft', fontSize: 10, fill: '#9ca3af' }} />
            <Tooltip />
            <Bar dataKey="count" fill="#10b981" name={t('measurements')} radius={[3, 3, 0, 0]} />
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
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} label={{ value: t('frequency'), angle: -90, position: 'insideLeft', fontSize: 10, fill: '#9ca3af' }} />
            <Tooltip />
            <ReferenceLine x=">400" stroke="#ef4444" strokeDasharray="3 3" />
            <Bar dataKey="count" fill="#8b5cf6" name={t('measurements')} radius={[3, 3, 0, 0]}>
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
              <XAxis dataKey="visus" name="Visus" type="number" domain={[0, 1]} tick={{ fontSize: 9 }} label={{ value: 'Visus', position: 'insideBottom', offset: -2, fontSize: 10 }} />
              <YAxis dataKey="crt" name="CRT" unit=" \u00b5m" tick={{ fontSize: 9 }} label={{ value: 'CRT (\u00b5m)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#9ca3af' }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as { visus: number; crt: number; date: string };
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
                      <p className="text-gray-500">{d.date}</p>
                      <p>Visus: <strong>{d.visus.toFixed(2)}</strong></p>
                      <p>CRT: <strong>{d.crt} \u00b5m</strong></p>
                    </div>
                  );
                }}
              />
              <Scatter data={visusCrtScatter} fill="#f59e0b" />
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-gray-400">{t('noData')}</p>
        )}
      </div>
    </div>
  );
}
