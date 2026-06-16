/**
 * CrtMetricContainer — Phase 44 / TECH-02 extraction from OutcomesView.tsx.
 *
 * Renders the CRT-metric body: no-crt empty-state guard, 3 CRT OutcomesPanel
 * renders (od/os/combined with metric="crt"), and OutcomesDataPreview.
 * Extracted verbatim from the `activeMetric === 'crt'` branch of
 * OutcomesView.renderBody().
 */
import type { TranslationKey } from '../../i18n/translations';
import type { AxisMode, TrajectoryResult, YMetric } from '../../utils/cohortTrajectory';
import OutcomesDataPreview from './OutcomesDataPreview';
import OutcomesEmptyState from './OutcomesEmptyState';
import type { CohortSeriesEntry } from './OutcomesPanel';
import OutcomesPanel from './OutcomesPanel';
import { PanelPlaceholder, PROGRESSIVE_PANEL_THRESHOLD_CASES } from './OutcomesPanelProgressive';
import { EYE_COLORS } from './palette';
import { useProgressivePanels } from './useProgressivePanels';

interface CrtMetricContainerProps {
  crtAggregate: TrajectoryResult;
  cohort: { name: string | null; cases: import('../../../shared/types/fhir').PatientCase[] };
  t: (key: TranslationKey) => string;
  locale: 'de' | 'en';
  axisMode: AxisMode;
  yMetric: YMetric;
  layers: { median: boolean; perPatient: boolean; scatter: boolean; spreadBand: boolean };
  isCrossMode: boolean;
  crossCohortAggregates: null | { od: CohortSeriesEntry[]; os: CohortSeriesEntry[]; combined: CohortSeriesEntry[] };
  handlePointDrillDown: (patientId: string) => void;
}

export default function CrtMetricContainer({
  crtAggregate,
  cohort,
  t,
  locale,
  axisMode,
  yMetric,
  layers,
  isCrossMode,
  crossCohortAggregates,
  handlePointDrillDown,
}: CrtMetricContainerProps) {
  // J2 (v1.15-p4): progressive panel staging — see VisusMetricContainer. Hook runs
  // before the early return below (the guard never changes between renders for a
  // given crtAggregate).
  // K7 (v1.16-A): stage in CROSS-MODE too (see VisusMetricContainer) so the compare-
  // drawer toggle no longer freezes building N cohorts × 3 panels synchronously.
  const crossWork = isCrossMode
    ? (crossCohortAggregates?.combined.reduce((n, c) => n + c.patientCount, 0) ?? 0)
    : 0;
  const progressiveActive = isCrossMode
    ? crossWork > PROGRESSIVE_PANEL_THRESHOLD_CASES
    : cohort.cases.length > PROGRESSIVE_PANEL_THRESHOLD_CASES;
  const stageKey = isCrossMode
    ? `crt-cross|${crossCohortAggregates?.combined.map((c) => `${c.cohortId}:${c.patientCount}`).join(',') ?? ''}|${axisMode}|${yMetric}`
    : `crt|${cohort.cases.length}|${axisMode}|${yMetric}|${layers.perPatient}|${layers.scatter}|${layers.median}|${layers.spreadBand}`;
  const mountedPanels = useProgressivePanels(3, progressiveActive, stageKey);

  if (!crtAggregate || crtAggregate.od.summary.measurementCount + crtAggregate.os.summary.measurementCount === 0) {
    return <OutcomesEmptyState variant="no-crt" t={t as (key: TranslationKey) => string} />;
  }
  return (
    <>
      <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        {mountedPanels >= 1 ? (
          <OutcomesPanel
            panel={crtAggregate.od}
            eye="od"
            color={EYE_COLORS.OD}
            axisMode={axisMode}
            yMetric={yMetric}
            layers={layers}
            t={t as (key: string) => string}
            locale={locale as 'de' | 'en'}
            titleKey="metricsCrtPanelOd"
            metric="crt"
            cohortSeries={isCrossMode && crossCohortAggregates ? crossCohortAggregates.od : undefined}
            onPointClick={!isCrossMode ? handlePointDrillDown : undefined}
          />
        ) : (
          <PanelPlaceholder eye="od" titleKey="metricsCrtPanelOd" t={t} />
        )}
        {mountedPanels >= 2 ? (
          <OutcomesPanel
            panel={crtAggregate.os}
            eye="os"
            color={EYE_COLORS.OS}
            axisMode={axisMode}
            yMetric={yMetric}
            layers={layers}
            t={t as (key: string) => string}
            locale={locale as 'de' | 'en'}
            titleKey="metricsCrtPanelOs"
            metric="crt"
            cohortSeries={isCrossMode && crossCohortAggregates ? crossCohortAggregates.os : undefined}
            onPointClick={!isCrossMode ? handlePointDrillDown : undefined}
          />
        ) : (
          <PanelPlaceholder eye="os" titleKey="metricsCrtPanelOs" t={t} />
        )}
        {mountedPanels >= 3 ? (
          <OutcomesPanel
            panel={crtAggregate.combined}
            eye="combined"
            color={EYE_COLORS['OD+OS']}
            axisMode={axisMode}
            yMetric={yMetric}
            layers={layers}
            t={t as (key: string) => string}
            locale={locale as 'de' | 'en'}
            titleKey="metricsCrtPanelCombined"
            metric="crt"
            cohortSeries={isCrossMode && crossCohortAggregates ? crossCohortAggregates.combined : undefined}
            onPointClick={!isCrossMode ? handlePointDrillDown : undefined}
          />
        ) : (
          <PanelPlaceholder eye="combined" titleKey="metricsCrtPanelCombined" t={t} />
        )}
      </div>
      <OutcomesDataPreview
        activeMetric="crt"
        cases={cohort.cases}
        aggregate={crtAggregate}
        t={t}
        locale={locale as 'de' | 'en'}
      />
    </>
  );
}
