/**
 * VisusMetricContainer — Phase 44 / TECH-02 extraction from OutcomesView.tsx.
 *
 * Renders the visus-metric body: empty-state guards, OutcomesSummaryCards,
 * scatter-default test div, 3 OutcomesPanel renders (od/os/combined), and
 * OutcomesDataPreview. Extracted verbatim from the `activeMetric === 'visus'`
 * branch of OutcomesView.renderBody().
 */
import type { TranslationKey } from '../../i18n/translations';
import type { AxisMode, TrajectoryResult, YMetric } from '../../utils/cohortTrajectory';
import OutcomesDataPreview from './OutcomesDataPreview';
import OutcomesEmptyState from './OutcomesEmptyState';
import type { CohortSeriesEntry } from './OutcomesPanel';
import OutcomesPanel from './OutcomesPanel';
import OutcomesSummaryCards from './OutcomesSummaryCards';
import { EYE_COLORS } from './palette';

interface VisusMetricContainerProps {
  aggregate: TrajectoryResult;
  cohort: { name: string | null; cases: import('../../../shared/types/fhir').PatientCase[] };
  t: (key: TranslationKey | string) => string;
  locale: 'de' | 'en';
  axisMode: AxisMode;
  yMetric: YMetric;
  layers: { median: boolean; perPatient: boolean; scatter: boolean; spreadBand: boolean };
  isCrossMode: boolean;
  crossCohortAggregates: null | { od: CohortSeriesEntry[]; os: CohortSeriesEntry[]; combined: CohortSeriesEntry[] };
  handlePointDrillDown: (patientId: string) => void;
}

export default function VisusMetricContainer({
  aggregate,
  cohort,
  t,
  locale,
  axisMode,
  yMetric,
  layers,
  isCrossMode,
  crossCohortAggregates,
  handlePointDrillDown,
}: VisusMetricContainerProps) {
  if (!aggregate) {
    return <OutcomesEmptyState variant="no-cohort" t={t as (key: TranslationKey) => string} />;
  }
  if (
    aggregate.od.summary.measurementCount === 0 &&
    aggregate.os.summary.measurementCount === 0
  ) {
    return <OutcomesEmptyState variant="no-visus" t={t as (key: TranslationKey) => string} />;
  }
  if (
    cohort.cases.length > 0 &&
    aggregate.od.summary.measurementCount + aggregate.os.summary.measurementCount > 0 &&
    !layers.median &&
    !layers.perPatient &&
    !layers.scatter &&
    !layers.spreadBand
  ) {
    return <OutcomesEmptyState variant="all-eyes-filtered" t={t as (key: TranslationKey) => string} />;
  }
  return (
    <>
      <OutcomesSummaryCards
        aggregate={aggregate}
        t={t as (key: string) => string}
        locale={locale as 'de' | 'en'}
      />
      <div data-testid={layers.scatter ? 'outcomes-scatter-default-on' : 'outcomes-scatter-default-off'} />
      <div className="mt-12 grid grid-cols-1 xl:grid-cols-3 gap-6">
        <OutcomesPanel
          panel={aggregate.od}
          eye="od"
          color={EYE_COLORS.OD}
          axisMode={axisMode}
          yMetric={yMetric}
          layers={layers}
          t={t as (key: string) => string}
          locale={locale as 'de' | 'en'}
          titleKey="outcomesPanelOd"
          cohortSeries={isCrossMode && crossCohortAggregates ? crossCohortAggregates.od : undefined}
          onPointClick={!isCrossMode ? handlePointDrillDown : undefined}
        />
        <OutcomesPanel
          panel={aggregate.os}
          eye="os"
          color={EYE_COLORS.OS}
          axisMode={axisMode}
          yMetric={yMetric}
          layers={layers}
          t={t as (key: string) => string}
          locale={locale as 'de' | 'en'}
          titleKey="outcomesPanelOs"
          cohortSeries={isCrossMode && crossCohortAggregates ? crossCohortAggregates.os : undefined}
          onPointClick={!isCrossMode ? handlePointDrillDown : undefined}
        />
        <OutcomesPanel
          panel={aggregate.combined}
          eye="combined"
          color={EYE_COLORS['OD+OS']}
          axisMode={axisMode}
          yMetric={yMetric}
          layers={layers}
          t={t as (key: string) => string}
          locale={locale as 'de' | 'en'}
          titleKey="outcomesPanelCombined"
          cohortSeries={isCrossMode && crossCohortAggregates ? crossCohortAggregates.combined : undefined}
          onPointClick={!isCrossMode ? handlePointDrillDown : undefined}
        />
      </div>
      <OutcomesDataPreview
        activeMetric="visus"
        cases={cohort.cases}
        aggregate={aggregate}
        t={t}
        locale={locale as 'de' | 'en'}
      />
    </>
  );
}
