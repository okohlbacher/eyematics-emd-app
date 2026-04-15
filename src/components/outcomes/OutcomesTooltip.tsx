import type { AxisMode, YMetric } from '../../utils/cohortTrajectory';

interface PayloadEntry {
  dataKey?: string | number;
  name?: string;
  value?: number;
  payload?: Record<string, unknown>;
  color?: string;
}

interface Props {
  active?: boolean;
  payload?: PayloadEntry[];
  yMetric: YMetric;
  axisMode: AxisMode;
  t: (key: string) => string;
  locale: 'de' | 'en';
}

export default function OutcomesTooltip({
  active,
  payload,
  yMetric,
  axisMode,
  t,
  locale,
}: Props) {
  if (!active || !payload || payload.length === 0) return null;

  const first = payload[0];
  const raw = (first.payload ?? {}) as Record<string, unknown>;

  const fmtNum = (n: number, digits = 2) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n);

  const pseudo =
    typeof raw.pseudonym === 'string'
      ? raw.pseudonym
      : typeof raw.patientId === 'string'
        ? raw.patientId
        : '';
  const eye = typeof raw.eye === 'string' ? raw.eye.toUpperCase() : '';
  const xValue =
    typeof raw.x === 'number'
      ? raw.x
      : typeof first.value === 'number'
        ? first.value
        : 0;
  const logmar =
    typeof raw.logmar === 'number'
      ? raw.logmar
      : typeof raw.y === 'number'
        ? raw.y
        : null;
  const snellen =
    typeof raw.snellenNum === 'number' && typeof raw.snellenDen === 'number'
      ? `${raw.snellenNum}/${raw.snellenDen}`
      : null;
  const clipped = Boolean(raw.clipped);
  const sparse = Boolean(raw.sparse);

  const isMedian = first.dataKey === 'y' && pseudo === '';

  const xLabel =
    axisMode === 'days'
      ? t('outcomesTooltipDay')
      : t('outcomesTooltipTreatmentIndex');

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      {isMedian ? (
        <>
          <div className="text-sm font-semibold text-gray-900">
            {t('outcomesTooltipMedian').replace('{n}', String(raw.n ?? ''))}
          </div>
          <div className="text-xs text-gray-500">
            {xLabel}: {fmtNum(xValue, 0)}
          </div>
          {logmar !== null && (
            <div className="text-xs text-gray-500">
              {t('outcomesTooltipLogmar')}: {fmtNum(logmar)}
            </div>
          )}
          {typeof raw.p25 === 'number' && typeof raw.p75 === 'number' && (
            <div className="text-xs text-gray-500">
              {t('outcomesTooltipIqr')
                .replace('{p25}', fmtNum(raw.p25))
                .replace('{p75}', fmtNum(raw.p75))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="text-sm font-semibold text-gray-900">{pseudo}</div>
          {eye && (
            <div className="text-xs text-gray-500">
              {t('outcomesTooltipEye')}: {eye}
            </div>
          )}
          <div className="text-xs text-gray-500">
            {xLabel}: {fmtNum(xValue, 0)}
          </div>
          {logmar !== null && (
            <div className="text-xs text-gray-500">
              {t('outcomesTooltipLogmar')}: {fmtNum(logmar)}
            </div>
          )}
          {snellen && (
            <div className="text-xs text-gray-500">
              {t('outcomesTooltipSnellen')}: {snellen}
            </div>
          )}
          {clipped && yMetric === 'delta_percent' && (
            <div className="text-xs text-amber-600">
              {t('outcomesTooltipClipped')}
            </div>
          )}
          {sparse && (
            <div className="text-xs text-amber-600">
              {t('outcomesTooltipSparse')}
            </div>
          )}
        </>
      )}
    </div>
  );
}
