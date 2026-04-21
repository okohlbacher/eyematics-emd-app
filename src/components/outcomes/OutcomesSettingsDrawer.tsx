import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { AxisMode, YMetric } from '../../utils/cohortTrajectory';

type MetricType = 'visus' | 'crt' | 'interval' | 'responder';

type LayerState = {
  median: boolean;
  perPatient: boolean;
  scatter: boolean;
  spreadBand: boolean;
};

interface Props {
  open: boolean;
  onClose: () => void;
  activeMetric: MetricType;
  axisMode: AxisMode;
  setAxisMode: (v: AxisMode) => void;
  yMetric: YMetric;
  setYMetric: (v: YMetric) => void;
  gridPoints: number;
  setGridPoints: (v: number) => void;
  layers: LayerState;
  setLayers: (updater: (L: LayerState) => LayerState) => void;
  thresholdLetters: number;
  setThresholdLetters: (n: number) => void;
  patientCount: number;
  t: (key: string) => string;
  isCrossMode?: boolean;
}

function yMetricKey(m: MetricType, y: YMetric): string {
  if (m === 'crt') {
    return y === 'absolute' ? 'metricsCrtYMetricAbsolute'
         : y === 'delta' ? 'metricsCrtYMetricDelta'
         : 'metricsCrtYMetricDeltaPercent';
  }
  // visus — existing keys
  return y === 'absolute' ? 'outcomesYAbsolute'
       : y === 'delta' ? 'outcomesYDelta'
       : 'outcomesYDeltaPercent';
}

export default function OutcomesSettingsDrawer({
  open,
  onClose,
  activeMetric,
  axisMode,
  setAxisMode,
  yMetric,
  setYMetric,
  gridPoints,
  setGridPoints,
  layers,
  setLayers,
  thresholdLetters,
  setThresholdLetters,
  patientCount,
  t,
  isCrossMode = false,
}: Props) {
  const firstRadioRef = useRef<HTMLInputElement>(null);

  // Escape key handler (D-23)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Focus first radio on open
  useEffect(() => {
    if (open) firstRadioRef.current?.focus();
  }, [open]);

  const resetDefaults = () => {
    setAxisMode('days');
    setYMetric('absolute');
    setGridPoints(120);
    setLayers(() => ({
      median: true,
      perPatient: true,
      scatter: patientCount <= 30,
      spreadBand: true,
    }));
  };

  return (
    <aside
      id="outcomes-settings-drawer"
      aria-label={t('outcomesSettingsTitle')}
      className={`fixed right-0 top-0 h-screen w-full sm:w-96 bg-white border-l border-gray-200 shadow-lg z-40 transition-transform duration-200 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
    >
      <div className="flex items-center justify-between p-6 pb-4">
        <h2 className="text-base font-semibold text-gray-900">
          {t('outcomesSettingsTitle')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('outcomesCloseSettings')}
          className="p-1 rounded hover:bg-gray-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div
        className="p-6 pt-0 space-y-6 overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 120px)' }}
      >
        {/* visus + crt: full axis / y-metric / layers / grid controls */}
        {(activeMetric === 'visus' || activeMetric === 'crt') && (
          <>
            {/* Section 1: X axis */}
            <section>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                {t('outcomesSectionXAxis')}
              </h3>
              <label className="flex items-center gap-2 text-sm">
                <input
                  ref={firstRadioRef}
                  type="radio"
                  name="x-axis"
                  aria-label={t('outcomesXAxisTime')}
                  className="accent-blue-600"
                  checked={axisMode === 'days'}
                  onChange={() => setAxisMode('days')}
                />
                {t('outcomesXAxisTime')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="x-axis"
                  aria-label={t('outcomesXAxisTreatments')}
                  className="accent-blue-600"
                  checked={axisMode === 'treatments'}
                  onChange={() => setAxisMode('treatments')}
                />
                {t('outcomesXAxisTreatments')}
              </label>
            </section>

            {/* Section 2: Y metric */}
            <section>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                {t('outcomesSectionYMetric')}
              </h3>
              {(['absolute', 'delta', 'delta_percent'] as const).map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="y-metric"
                    className="accent-blue-600"
                    checked={yMetric === m}
                    onChange={() => setYMetric(m)}
                  />
                  {t(yMetricKey(activeMetric, m))}
                </label>
              ))}
            </section>

            {/* Section 3: Display layers */}
            <section>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                {t('outcomesSectionLayers')}
              </h3>
              {(
                [
                  ['median', 'outcomesLayerMedian'],
                  ['perPatient', 'outcomesLayerPerPatient'],
                  ['scatter', 'outcomesLayerScatter'],
                  ['spreadBand', 'outcomesLayerSpreadBand'],
                ] as const
              )
                .filter(([key]) => !(isCrossMode && key === 'perPatient'))
                .map(([key, labelKey]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      aria-label={t(labelKey)}
                      className="accent-blue-600"
                      checked={layers[key]}
                      onChange={() =>
                        setLayers((L) => ({ ...L, [key]: !L[key] }))
                      }
                    />
                    {t(labelKey)}
                  </label>
                ))}
              {isCrossMode && (
                <p className="text-xs text-gray-500 italic mt-2" data-testid="perpatient-suppressed-note">
                  {t('outcomesComparePerPatientSuppressed')}
                </p>
              )}
              {patientCount > 30 && (
                <p className="text-xs text-gray-500 mt-1">
                  {t('outcomesSettingsScatterAdvisory')}
                </p>
              )}
            </section>

            {/* Section 4: Interpolation grid */}
            <section>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                {t('outcomesSectionGrid')}
              </h3>
              <input
                type="range"
                min={20}
                max={300}
                step={10}
                value={gridPoints}
                onChange={(e) => setGridPoints(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('outcomesGridSliderLabel').replace('{n}', String(gridPoints))}
              </p>
            </section>
          </>
        )}

        {/* interval: no controls */}
        {activeMetric === 'interval' && (
          <p
            className="text-sm text-gray-500 italic p-4"
            data-testid="drawer-interval-no-settings"
          >
            {t('metricsSettingsNoControls')}
          </p>
        )}

        {/* responder: threshold input */}
        {activeMetric === 'responder' && (
          <section data-testid="drawer-responder-threshold" className="p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700 mb-2">
              {t('metricsResponderThresholdSection')}
            </h3>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              <span>{t('metricsResponderThreshold').replace('{letters}', String(thresholdLetters))}</span>
              <input
                type="number"
                min={0}
                step={1}
                value={thresholdLetters}
                onChange={(e) => setThresholdLetters(Math.max(0, Number(e.target.value) || 0))}
                className="w-24 border border-gray-200 rounded px-2 py-1 text-sm"
                data-testid="responder-threshold-input"
              />
            </label>
            <p className="text-xs text-gray-500 mt-1">
              {t('metricsResponderThresholdHelper')}
            </p>
          </section>
        )}
      </div>

      <div className="border-t border-gray-100 p-6 pt-4">
        <button
          type="button"
          onClick={resetDefaults}
          className="text-sm text-gray-600 hover:text-gray-900 underline"
        >
          {t('outcomesResetSettings')}
        </button>
      </div>
    </aside>
  );
}
