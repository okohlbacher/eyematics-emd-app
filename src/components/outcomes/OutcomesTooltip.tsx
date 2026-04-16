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
  layers: { median: boolean; perPatient: boolean; scatter: boolean; spreadBand: boolean };
  t: (key: string) => string;
  locale: 'de' | 'en';
}

export default function OutcomesTooltip({
  active,
  payload,
  yMetric,
  axisMode,
  layers,
  t,
  locale,
}: Props) {
  if (!active || !payload || payload.length === 0) return null;

  // D-06: when the per-patient layer is off, suppress per-patient tooltip entries.
  const filtered = layers.perPatient
    ? payload
    : payload.filter(
        (e) =>
          (e.payload as Record<string, unknown> | undefined)?.__series !== 'perPatient',
      );
  if (filtered.length === 0) return null;

  const first = filtered[0];
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

  // D-05: x-value formatting — "{n} d" for days, "#{n}" for treatments.
  const xDisplay =
    axisMode === 'days' ? `${fmtNum(xValue, 0)} d` : `#${fmtNum(xValue, 0)}`;

  // D-05: y-unit string — metric-specific.
  const yUnit: string =
    yMetric === 'absolute' ? 'logMAR' : yMetric === 'delta' ? 'Δ logMAR' : '%';

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      {isMedian ? (
        <>
          <div className="text-sm font-semibold text-gray-900">
            {t('outcomesTooltipMedian').replace('{n}', String(raw.n ?? ''))}
          </div>
          <div className="text-xs text-gray-500">
            {xLabel}: {xDisplay}
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
            {xLabel}: {xDisplay}
          </div>
          {logmar !== null && (
            <div className="text-xs text-gray-500">
              {t('outcomesTooltipLogmar')}: {fmtNum(logmar)} {yUnit}
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
