import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { AxisMode, YMetric } from '../../utils/cohortTrajectory';

type LayerState = {
  median: boolean;
  perPatient: boolean;
  scatter: boolean;
  spreadBand: boolean;
};

interface Props {
  open: boolean;
  onClose: () => void;
  axisMode: AxisMode;
  setAxisMode: (v: AxisMode) => void;
  yMetric: YMetric;
  setYMetric: (v: YMetric) => void;
  gridPoints: number;
  setGridPoints: (v: number) => void;
  layers: LayerState;
  setLayers: (updater: (L: LayerState) => LayerState) => void;
  patientCount: number;
  t: (key: string) => string;
}

export default function OutcomesSettingsDrawer({
  open,
  onClose,
  axisMode,
  setAxisMode,
  yMetric,
  setYMetric,
  gridPoints,
  setGridPoints,
  layers,
  setLayers,
  patientCount,
  t,
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
              {t(
                m === 'absolute'
                  ? 'outcomesYAbsolute'
                  : m === 'delta'
                    ? 'outcomesYDelta'
                    : 'outcomesYDeltaPercent',
              )}
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
          ).map(([key, labelKey]) => (
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
